/**
 * Agent 2: Offer Evaluator
 * Takes an offer URL or description, analyzes it, and scores 0-10 for Facebook viability.
 * Checks demographics, psychology, platform culture fit, compliance risk, and market saturation.
 */

const { addLog } = require("../pipeline/context");
const { saveAgentOutput } = require("../pipeline/store");

/**
 * Run the offer evaluator.
 * @param {object} ctx - PipelineContext
 * @returns {object} Updated evaluation section
 */
async function run(ctx) {
  addLog(ctx, "Offer Evaluator starting...");
  ctx.currentAgent = "evaluator";

  // Fetch the landing page if URL provided
  let pageContent = "";
  if (ctx.offerUrl) {
    addLog(ctx, `Scraping offer URL: ${ctx.offerUrl}`);
    pageContent = await scrapePage(ctx.offerUrl);
  }

  // Build evaluation prompt
  const researchContext = ctx.research?.synthesis
    ? `\n\nRESEARCH CONTEXT (from competitor analysis):\n${ctx.research.synthesis.slice(0, 3000)}`
    : "";

  const ownPerfContext = ctx.research?.ownPerformance?.accounts?.length
    ? `\n\nOWN PERFORMANCE:\nTotal Spend: $${ctx.research.ownPerformance.totalSpend.toFixed(2)} | Leads: ${ctx.research.ownPerformance.totalLeads}`
    : "";

  const prompt = `You are an expert performance marketer who evaluates offers before running Facebook ads. Analyze this offer and score it.

OFFER: ${ctx.offerName || "Not specified"}
VERTICAL: ${ctx.vertical || "Not specified"}
URL: ${ctx.offerUrl || "Not provided"}
TARGET PLATFORM: Facebook Ads

${pageContent ? `LANDING PAGE CONTENT:\n${pageContent}\n` : "No landing page content available."}
${researchContext}
${ownPerfContext}

EVALUATE THIS OFFER ON THESE CRITERIA (score each 0-10):

1. **DEMOGRAPHIC FIT** (0-10): Does this offer match Facebook's user demographics? Consider age distribution, interests, and user behavior on the platform.

2. **EMOTIONAL RESONANCE** (0-10): How emotionally compelling is this offer? Does it trigger fear, desire, urgency, or curiosity? Rate the emotional pull.

3. **PLATFORM CULTURE FIT** (0-10): Does this offer align with how people use Facebook? Will it blend into the feed or feel like a hard sell? Consider: storytelling potential, social proof angle, shareability.

4. **MARKET SATURATION** (0-10): How crowded is this space with similar ads? (10 = untapped, 0 = oversaturated). Use the competitor research if available.

5. **COMPLIANCE RISK** (0-10 where 10=safe): How likely is this to get flagged or rejected by Facebook? Consider: health claims, income claims, special ad categories, restricted content.

6. **CONVERSION POTENTIAL** (0-10): Based on the landing page quality, offer clarity, and CTA strength — how likely is this to convert?

7. **UNIT ECONOMICS** (0-10): Based on the vertical and typical CPMs/CPAs for Facebook, can this offer be profitable? Consider: expected CPL vs payout.

RESPOND IN EXACTLY THIS JSON FORMAT (no markdown, no code blocks, just raw JSON):
{
  "overallScore": <weighted average 0-10>,
  "scores": {
    "demographicFit": <0-10>,
    "emotionalResonance": <0-10>,
    "platformCultureFit": <0-10>,
    "marketSaturation": <0-10>,
    "complianceRisk": <0-10>,
    "conversionPotential": <0-10>,
    "unitEconomics": <0-10>
  },
  "demographics": {
    "primaryAge": "<age range>",
    "gender": "<skew or balanced>",
    "interests": ["<interest1>", "<interest2>"]
  },
  "psychographics": {
    "primaryEmotion": "<fear/desire/curiosity/urgency>",
    "painPoints": ["<pain1>", "<pain2>"],
    "desires": ["<desire1>", "<desire2>"]
  },
  "platformFit": "<1-2 sentence summary>",
  "risks": ["<risk1>", "<risk2>"],
  "recommendations": ["<rec1>", "<rec2>", "<rec3>"],
  "proceed": <true if overallScore >= 4, false otherwise>,
  "verdict": "<1-2 sentence go/no-go recommendation>"
}`;

  const systemPrompt = `You are an offer evaluator for a performance marketing agency. You score offers 0-10 on their viability for Facebook Ads. Be brutally honest. Respond ONLY with valid JSON — no markdown formatting, no explanation outside the JSON.`;

  try {
    const { callClaudeCLI } = require("../ai/claude");
    const response = await callClaudeCLI(prompt, systemPrompt, { timeoutMs: 300000 });

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in evaluator response");
    }

    const evaluation = JSON.parse(jsonMatch[0]);

    ctx.evaluation = {
      score: evaluation.overallScore,
      scores: evaluation.scores,
      demographics: evaluation.demographics,
      psychographics: evaluation.psychographics,
      platformFit: evaluation.platformFit,
      risks: evaluation.risks || [],
      recommendations: evaluation.recommendations || [],
      proceed: evaluation.proceed ?? (evaluation.overallScore >= 4),
      verdict: evaluation.verdict,
    };

    saveAgentOutput(ctx.runId, "evaluator", ctx.evaluation);
    addLog(ctx, `Offer scored: ${evaluation.overallScore}/10 — ${evaluation.proceed ? "PROCEED" : "DO NOT PROCEED"}`);

    return ctx.evaluation;
  } catch (err) {
    console.error(`[EVALUATOR] Error: ${err.message}`);
    // Default to proceed on error (don't block pipeline on eval failure)
    ctx.evaluation = {
      score: null,
      proceed: true,
      risks: [`Evaluation failed: ${err.message}`],
      recommendations: ["Manual review recommended"],
      verdict: "Evaluation failed — proceeding with caution.",
    };
    addLog(ctx, `Evaluator error: ${err.message} — defaulting to proceed`);
    return ctx.evaluation;
  }
}

/**
 * Scrape a landing page for content analysis.
 */
async function scrapePage(url) {
  try {
    // Block internal/private network URLs (SSRF protection)
    const parsed = new URL(url);
    const blockedHosts = ["localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254", "[::1]"];
    const blockedPrefixes = ["10.", "192.168.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31."];
    if (blockedHosts.includes(parsed.hostname) || blockedPrefixes.some(p => parsed.hostname.startsWith(p))) {
      return "Blocked: cannot fetch internal/private URLs";
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "Blocked: only HTTP/HTTPS URLs allowed";
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return `HTTP ${res.status} — couldn't fetch page`;

    const html = await res.text();

    // Extract meaningful content (strip scripts, styles, etc.)
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Truncate to reasonable size
    return text.slice(0, 5000);
  } catch (err) {
    console.log(`[EVALUATOR] Scrape error for ${url}: ${err.message?.slice(0, 60)}`);
    return `Failed to scrape: ${err.message}`;
  }
}

/**
 * Format evaluation for Telegram display.
 */
function formatEvaluation(evaluation) {
  if (!evaluation || evaluation.score === null) {
    return "Evaluation not available.";
  }

  const scoreEmoji = evaluation.score >= 7 ? "🟢" : evaluation.score >= 4 ? "🟡" : "🔴";

  let msg = `${scoreEmoji} OFFER EVALUATION: ${evaluation.score}/10\n\n`;

  if (evaluation.scores) {
    msg += `📊 Breakdown:\n`;
    const labels = {
      demographicFit: "Demographic Fit",
      emotionalResonance: "Emotional Pull",
      platformCultureFit: "Platform Fit",
      marketSaturation: "Market Space",
      complianceRisk: "Compliance Safety",
      conversionPotential: "Conversion Potential",
      unitEconomics: "Unit Economics",
    };
    for (const [key, label] of Object.entries(labels)) {
      const val = evaluation.scores[key];
      if (val !== undefined) {
        const bar = "█".repeat(val) + "░".repeat(10 - val);
        msg += `  ${bar} ${val}/10 ${label}\n`;
      }
    }
    msg += "\n";
  }

  if (evaluation.verdict) {
    msg += `💬 ${evaluation.verdict}\n\n`;
  }

  if (evaluation.risks?.length) {
    msg += `⚠️ Risks:\n`;
    for (const r of evaluation.risks) msg += `  • ${r}\n`;
    msg += "\n";
  }

  if (evaluation.recommendations?.length) {
    msg += `💡 Recommendations:\n`;
    for (const r of evaluation.recommendations) msg += `  • ${r}\n`;
  }

  return msg;
}

module.exports = { run, formatEvaluation };
