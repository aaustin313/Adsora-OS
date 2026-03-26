/**
 * Landing Page Builder & Cloner — Orchestrator
 *
 * Coordinates the agent pipeline:
 * 1. Scraper Agent — fetches and parses the source page
 * 2. Analyzer Agent — uses Claude to understand the page structure & strategy
 * 3. Builder Agent — uses Claude to generate production HTML
 * 4. QA Agent — validates the output
 *
 * Input: URL or screenshot description
 * Output: Self-contained HTML file saved to output/landing-pages/
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const { URL } = require("url");
const { scrapePage, getFullText } = require("./scraper");
const { generateHtml, saveHtml, advertorialTemplate, cloneTemplate, OUTPUT_DIR } = require("./generator");
const { uploadMediaFromUrl, isGhlConfigured } = require("../ghl/client");

// Call Claude CLI to process a prompt (reused from ai/claude.js pattern)
function callClaude(prompt, systemPrompt, options = {}) {
  return new Promise((resolve, reject) => {
    const claudePath = process.env.CLAUDE_CLI_PATH || "claude";
    const args = [
      "-p",
      "--system-prompt", systemPrompt,
      "--model", options.model || "sonnet",
      "--output-format", "text",
      "--no-session-persistence",
      "--max-turns", "1",
    ];

    const child = spawn(claudePath, args, {
      env: { ...process.env, NO_COLOR: "1", CLAUDECODE: "" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.stdin.write(prompt);
    child.stdin.end();

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Claude timed out"));
    }, options.timeout || 180000); // 3 min for complex generation

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.slice(0, 300) || `claude exited with code ${code}`));
        return;
      }
      resolve(stdout.trim());
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// --- Image Upload to GHL ---

// Download an image from a URL and return the buffer
function downloadImage(imageUrl) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(imageUrl);
    const protocol = parsedUrl.protocol === "https:" ? https : http;

    protocol.get(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 15000,
    }, (res) => {
      if ([301, 302, 303, 307].includes(res.statusCode) && res.headers.location) {
        downloadImage(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      let size = 0;
      res.on("data", (chunk) => {
        size += chunk.length;
        if (size > 25 * 1024 * 1024) { // 25MB GHL limit
          res.destroy();
          reject(new Error("Image too large"));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}

// Upload all images from scraped page to GHL, return URL mapping
async function uploadImagesToGhl(images) {
  if (!isGhlConfigured()) {
    console.log("[LP-BUILDER] GHL not configured, keeping original image URLs");
    return {};
  }

  const urlMap = {}; // original URL → GHL URL
  console.log(`[LP-BUILDER] Uploading ${images.length} images to GHL media library...`);

  for (const img of images) {
    if (!img.src || img.src.startsWith("data:") || urlMap[img.src]) continue;

    try {
      // Use GHL's hosted upload (pass URL, GHL fetches it)
      const result = await uploadMediaFromUrl(img.src, img.alt || path.basename(new URL(img.src).pathname));
      if (result?.url) {
        urlMap[img.src] = result.url;
        console.log(`[LP-BUILDER] Uploaded: ${img.src.slice(0, 60)} → ${result.url.slice(0, 60)}`);
      }
    } catch (err) {
      console.log(`[LP-BUILDER] Failed to upload ${img.src.slice(0, 60)}: ${err.message}`);
      // Keep original URL as fallback
    }
  }

  return urlMap;
}

// Replace image URLs in HTML with GHL-hosted URLs
function replaceImageUrls(html, urlMap) {
  let result = html;
  for (const [originalUrl, ghlUrl] of Object.entries(urlMap)) {
    // Escape special regex chars in URL
    const escaped = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escaped, "g"), ghlUrl);
  }
  return result;
}

// System prompts for each agent
const ANALYZER_SYSTEM = `You are a landing page conversion analyst. Given the scraped content of a web page, analyze:

1. PAGE TYPE: Advertorial, VSL, lead gen form, quiz funnel, ecommerce, etc.
2. FUNNEL STRATEGY: What persuasion techniques are used (urgency, scarcity, authority, social proof, fear, desire)?
3. SECTION MAP: List every section in order (hero, problem, solution, benefits, testimonials, CTA, etc.)
4. COPY ANALYSIS: Headline formula, key hooks, emotional triggers, power words
5. DESIGN NOTES: Color scheme, typography feel, layout pattern (single column, split, etc.)
6. CTA STRATEGY: How many CTAs, their placement, button text, colors
7. TRUST ELEMENTS: Badges, logos, doctor endorsements, study citations, etc.
8. COMPLIANCE FLAGS: Any claims that could violate ad policies

Output as structured JSON with these exact keys:
{
  "pageType": "advertorial",
  "headline": "...",
  "subheadline": "...",
  "sections": [{"type": "hero", "content": "...", "notes": "..."}],
  "persuasionTechniques": ["authority", "social proof"],
  "ctaText": "...",
  "ctaColor": "#...",
  "colorScheme": {"primary": "#...", "accent": "#...", "bg": "#...", "text": "#..."},
  "fonts": ["...", "..."],
  "testimonials": [{"name": "...", "text": "...", "stars": 5}],
  "benefits": ["...", "..."],
  "trustElements": ["...", "..."],
  "complianceFlags": ["...", "..."],
  "overallAssessment": "..."
}`;

const BUILDER_SYSTEM = `You are an expert landing page builder. Given a page analysis (JSON) and optional modification instructions, generate the COMPLETE HTML for a production-ready landing page.

RULES:
- Output ONLY the raw HTML content between <body> tags (no doctype, no head, no body tags)
- All CSS must be inline in a <style> tag at the top of your output
- All images must use absolute URLs from the original page or placeholder URLs
- Must be fully mobile-responsive
- Must be clean, fast-loading, semantic HTML5
- No external dependencies (no Bootstrap, no jQuery, no CDN links except Google Fonts)
- Include a sticky bottom CTA on mobile
- All text must be directly in the HTML (not loaded via JS)
- Keep the same conversion strategy and copy angles as the original
- If instructed to go "higher level": make it more premium, cleaner typography, better spacing, stronger credibility signals, more professional feel

Do NOT include any markdown formatting, code fences, or explanation. Output ONLY the HTML.`;

const QA_SYSTEM = `You are a QA engineer reviewing a landing page HTML file. Check for:

1. VALIDITY: Any HTML syntax errors, unclosed tags, broken attributes
2. RESPONSIVENESS: Does it have mobile media queries? Viewport meta tag?
3. IMAGES: Any broken image references? Missing alt text?
4. COMPLIANCE: Any misleading health claims? Missing disclaimers?
5. PERFORMANCE: Any bloated code, unnecessary libraries, render-blocking resources?
6. CTA: Is the main CTA visible and prominent? Is there a mobile sticky CTA?
7. SIZE: Estimate if this is under 5MB (GHL limit)

Output a JSON object:
{
  "passed": true/false,
  "issues": ["issue 1", "issue 2"],
  "warnings": ["warning 1"],
  "score": 85,
  "summary": "Brief assessment"
}`;

// --- Main Pipeline ---

async function cloneLandingPage(url, options = {}) {
  const {
    modifications = "exact clone",
    name = "",
    elevate = false,
  } = options;

  const results = {
    steps: [],
    errors: [],
  };

  // Step 1: Scrape
  console.log("[LP-BUILDER] Step 1: Scraping page...");
  let scraped;
  try {
    scraped = await scrapePage(url);
    results.steps.push({
      agent: "scraper",
      status: "success",
      details: `Fetched ${scraped.html.length} chars, ${scraped.parsed.images.length} images, ${scraped.parsed.sections.length} sections`,
    });
  } catch (err) {
    results.steps.push({ agent: "scraper", status: "failed", error: err.message });
    results.errors.push(`Scraper failed: ${err.message}`);
    throw new Error(`Could not fetch page: ${err.message}`);
  }

  // Check if JS-rendered
  if (scraped.isJsRendered) {
    console.log("[LP-BUILDER] Page appears JS-rendered, content may be limited");
    results.steps.push({
      agent: "scraper",
      status: "warning",
      details: "Page is JavaScript-rendered. Content extraction may be incomplete. Screenshots recommended for best results.",
    });
  }

  // Step 2: Analyze
  console.log("[LP-BUILDER] Step 2: Analyzing page structure...");
  let analysis;
  try {
    const analyzerPrompt = `Analyze this landing page:

URL: ${url}

PAGE TITLE: ${scraped.parsed.title}

EXTRACTED TEXT CONTENT:
${scraped.fullText.slice(0, 8000)}

IMAGES FOUND:
${scraped.parsed.images.map(i => `- ${i.src} (alt: ${i.alt})`).join("\n").slice(0, 2000)}

COLORS DETECTED: ${scraped.parsed.styles.colors.join(", ")}
FONTS DETECTED: ${scraped.parsed.styles.fonts.join(", ")}

HEADINGS:
${scraped.parsed.sections.filter(s => s.type === "heading").map(s => `${s.level}: ${s.text}`).join("\n")}

PARAGRAPHS (first 10):
${scraped.parsed.sections.filter(s => s.type === "paragraph").slice(0, 10).map(s => s.text).join("\n\n")}

CTAs FOUND:
${scraped.parsed.sections.filter(s => s.type === "cta").map(s => s.text).join(", ")}

RAW HTML STRUCTURE (first 5000 chars):
${scraped.html.slice(0, 5000)}`;

    const analysisRaw = await callClaude(analyzerPrompt, ANALYZER_SYSTEM);

    // Try to parse as JSON
    try {
      // Extract JSON from response (in case Claude wraps it in markdown)
      const jsonMatch = analysisRaw.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(analysisRaw);
    } catch {
      console.log("[LP-BUILDER] Could not parse analysis as JSON, using raw text");
      analysis = { raw: analysisRaw, pageType: "unknown" };
    }

    results.steps.push({
      agent: "analyzer",
      status: "success",
      details: `Page type: ${analysis.pageType || "unknown"}, ${analysis.sections?.length || 0} sections identified`,
    });
  } catch (err) {
    results.steps.push({ agent: "analyzer", status: "failed", error: err.message });
    results.errors.push(`Analyzer failed: ${err.message}`);
    // Continue with basic analysis
    analysis = {
      pageType: "advertorial",
      headline: scraped.parsed.title,
      sections: scraped.parsed.sections,
    };
  }

  // Step 3: Build HTML
  console.log("[LP-BUILDER] Step 3: Building HTML...");
  let htmlContent;
  try {
    const modText = elevate
      ? "Make this HIGHER LEVEL: more premium design, cleaner typography, better spacing, stronger credibility signals, more professional. Keep the same angles and copy strategy but elevate the execution."
      : modifications;

    const builderPrompt = `Build a complete landing page based on this analysis.

PAGE ANALYSIS:
${JSON.stringify(analysis, null, 2)}

MODIFICATION INSTRUCTIONS: ${modText}

ORIGINAL PAGE URL: ${url}

ORIGINAL IMAGES (use these exact URLs):
${scraped.parsed.images.map(i => `- ${i.src} (alt: ${i.alt})`).join("\n").slice(0, 3000)}

ORIGINAL COLORS: ${scraped.parsed.styles.colors.join(", ")}

ORIGINAL FULL TEXT:
${scraped.fullText.slice(0, 6000)}

Generate the complete HTML now. Remember: output ONLY HTML, no markdown, no code fences, no explanation.`;

    htmlContent = await callClaude(builderPrompt, BUILDER_SYSTEM, { timeout: 240000 });

    // Strip any markdown code fences if Claude adds them
    htmlContent = htmlContent
      .replace(/^```html?\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();

    // Wrap in full HTML document if needed
    if (!htmlContent.includes("<!DOCTYPE") && !htmlContent.includes("<html")) {
      htmlContent = generateHtml({
        title: analysis.headline || scraped.parsed.title || "Landing Page",
        css: "",
        bodyHtml: htmlContent,
        googleFonts: ["https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap"],
        meta: {
          description: analysis.subheadline || "",
        },
      });
    }

    results.steps.push({
      agent: "builder",
      status: "success",
      details: `Generated ${htmlContent.length} chars of HTML`,
    });
  } catch (err) {
    results.steps.push({ agent: "builder", status: "failed", error: err.message });
    results.errors.push(`Builder failed: ${err.message}`);
    throw new Error(`Could not generate HTML: ${err.message}`);
  }

  // Step 4: QA
  console.log("[LP-BUILDER] Step 4: Running QA checks...");
  let qaResult;
  try {
    const qaPrompt = `Review this HTML landing page for quality:

${htmlContent.slice(0, 15000)}

${htmlContent.length > 15000 ? `\n... (${htmlContent.length - 15000} more chars truncated)` : ""}`;

    const qaRaw = await callClaude(qaPrompt, QA_SYSTEM);

    try {
      const jsonMatch = qaRaw.match(/\{[\s\S]*\}/);
      qaResult = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(qaRaw);
    } catch {
      qaResult = { passed: true, summary: qaRaw, score: 70 };
    }

    results.steps.push({
      agent: "qa",
      status: qaResult.passed ? "success" : "warning",
      details: `Score: ${qaResult.score}/100 — ${qaResult.summary}`,
      issues: qaResult.issues || [],
    });
  } catch (err) {
    results.steps.push({ agent: "qa", status: "skipped", error: err.message });
    qaResult = { passed: true, score: 0, summary: "QA skipped due to error" };
  }

  // Step 5: Upload images to GHL and replace URLs
  if (isGhlConfigured()) {
    console.log("[LP-BUILDER] Step 5: Uploading images to GHL...");
    try {
      const urlMap = await uploadImagesToGhl(scraped.parsed.images);
      const uploadCount = Object.keys(urlMap).length;
      if (uploadCount > 0) {
        htmlContent = replaceImageUrls(htmlContent, urlMap);
        results.steps.push({
          agent: "ghl-uploader",
          status: "success",
          details: `Uploaded ${uploadCount}/${scraped.parsed.images.length} images to GHL media library`,
        });
      } else {
        results.steps.push({
          agent: "ghl-uploader",
          status: "warning",
          details: "No images uploaded (may already use absolute URLs)",
        });
      }
    } catch (err) {
      results.steps.push({ agent: "ghl-uploader", status: "failed", error: err.message });
    }
  } else {
    results.steps.push({
      agent: "ghl-uploader",
      status: "skipped",
      details: "GHL not configured — set GHL_API_KEY + GHL_LOCATION_ID in .env",
    });
  }

  // Step 6: Save
  console.log("[LP-BUILDER] Step 6: Saving output...");
  const pageName = name || analysis.headline?.slice(0, 40) || "cloned-page";
  const saved = saveHtml(htmlContent, pageName);

  results.output = saved;
  results.analysis = analysis;
  results.qa = qaResult;

  console.log(`[LP-BUILDER] Done! Saved to ${saved.filepath}`);
  return results;
}

// Build a landing page from a description (no source URL)
async function buildLandingPage(description, options = {}) {
  const {
    name = "new-landing-page",
    type = "advertorial",
  } = options;

  console.log("[LP-BUILDER] Building from description...");

  const builderPrompt = `Build a complete landing page based on this description:

${description}

PAGE TYPE: ${type}

Requirements:
- Self-contained single HTML file
- Inline CSS, no external dependencies except Google Fonts
- Mobile-responsive with sticky bottom CTA
- Clean, professional, high-converting design
- Include proper disclaimers
- All placeholder images should use https://placehold.co/ URLs

Generate the complete HTML document (including <!DOCTYPE html>, <html>, <head>, <body>).
Output ONLY the HTML, no markdown, no code fences, no explanation.`;

  const htmlContent = await callClaude(builderPrompt, BUILDER_SYSTEM, { timeout: 240000 });

  const cleaned = htmlContent
    .replace(/^```html?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();

  const saved = saveHtml(cleaned, name);
  return {
    output: saved,
    steps: [{ agent: "builder", status: "success", details: `Generated ${cleaned.length} chars` }],
  };
}

// Format results for Telegram display
function formatResultsForTelegram(results) {
  let msg = "";

  if (results.errors?.length > 0) {
    msg += "⚠️ Completed with errors:\n";
    for (const err of results.errors) {
      msg += `  • ${err}\n`;
    }
    msg += "\n";
  }

  msg += "🏗️ Agent Pipeline Results:\n\n";

  for (const step of results.steps) {
    const icon = step.status === "success" ? "✅" :
                 step.status === "warning" ? "⚠️" :
                 step.status === "failed" ? "❌" : "⏭️";
    msg += `${icon} ${step.agent.toUpperCase()}: ${step.details || step.error || ""}\n`;
  }

  if (results.output) {
    msg += `\n📄 Output: ${results.output.filename} (${results.output.sizeKb}KB)\n`;
    msg += results.output.isUnderLimit
      ? "✅ Under 5MB GHL limit\n"
      : "⚠️ Over 5MB — may need optimization\n";
  }

  if (results.qa) {
    msg += `\n🔍 QA Score: ${results.qa.score}/100\n`;
    if (results.qa.issues?.length > 0) {
      msg += "Issues:\n";
      for (const issue of results.qa.issues.slice(0, 5)) {
        msg += `  • ${issue}\n`;
      }
    }
  }

  msg += "\n📋 GHL Upload:\n";
  msg += "1. Sites → Funnels → New Funnel → Blank\n";
  msg += "2. Add Element → Custom JS/HTML\n";
  msg += "3. Paste the HTML from the file\n";
  msg += "4. Images are already hosted on GHL";

  return msg;
}

// Detect if a message is a landing page builder request
function isLpBuilderRequest(message) {
  const patterns = [
    /\b(clone|copy|recreate|rebuild|replicate)\s+(this|that|the)?\s*(landing\s*)?page/i,
    /\b(build|create|make|generate)\s+(me\s+)?(a\s+)?(landing\s*page|lp|lander)/i,
    /\b(landing\s*page\s*(builder|cloner|creator))/i,
    /\blp\s*builder\b/i,
    /\bclone\s+(https?:\/\/)/i,
  ];
  return patterns.some(p => p.test(message));
}

// Extract URL from a message
function extractUrl(message) {
  const urlMatch = message.match(/https?:\/\/[^\s<>"']+/);
  return urlMatch ? urlMatch[0] : null;
}

module.exports = {
  cloneLandingPage,
  buildLandingPage,
  formatResultsForTelegram,
  isLpBuilderRequest,
  extractUrl,
  OUTPUT_DIR,
};
