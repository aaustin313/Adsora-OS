/**
 * Landing Page HTML Generator
 *
 * Takes structured page data (from scraper or AI analysis) and produces
 * a single self-contained HTML file ready for GoHighLevel upload.
 */

const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "..", "..", "output", "landing-pages");

// Generate a complete HTML page from structured data
function generateHtml(pageData) {
  const {
    title = "Landing Page",
    favicon = "",
    googleFonts = [],
    css = "",
    bodyHtml = "",
    scripts = "",
    meta = {},
  } = pageData;

  const fontLinks = googleFonts
    .map(f => `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="${f}" rel="stylesheet">`)
    .join("\n    ");

  const metaTags = Object.entries(meta)
    .map(([name, content]) => {
      const attr = name.startsWith("og:") ? "property" : "name";
      return `<meta ${attr}="${name}" content="${escapeAttr(content)}">`;
    })
    .join("\n    ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    ${metaTags}
    ${favicon ? `<link rel="icon" href="${escapeAttr(favicon)}">` : ""}
    ${fontLinks}
    <style>
        /* Reset */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
        body { min-height: 100vh; line-height: 1.6; -webkit-font-smoothing: antialiased; }
        img { max-width: 100%; height: auto; display: block; }
        a { text-decoration: none; color: inherit; }

        ${css}
    </style>
</head>
<body>
    ${bodyHtml}
    ${scripts ? `<script>${scripts}</script>` : ""}
</body>
</html>`;
}

// Save generated HTML to output directory
function saveHtml(html, name) {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const safeName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  const filename = `${safeName}-${timestamp}.html`;
  const filepath = path.join(OUTPUT_DIR, filename);

  fs.writeFileSync(filepath, html, "utf-8");

  const sizeKb = Math.round(html.length / 1024);
  console.log(`[GENERATOR] Saved ${filename} (${sizeKb}KB)`);

  return {
    filename,
    filepath,
    sizeKb,
    isUnderLimit: html.length < 5 * 1024 * 1024, // GHL 5MB limit
  };
}

// Generate an advertorial-style page (news article format)
function advertorialTemplate({
  headline = "",
  subheadline = "",
  heroImage = "",
  publisherLogo = "",
  publisherName = "Health & Wellness Report",
  author = "Medical Staff Reporter",
  date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  bodyParagraphs = [],
  testimonials = [],
  productImage = "",
  productName = "",
  ctaText = "Learn More",
  ctaUrl = "#",
  ctaColor = "#d20f26",
  benefits = [],
  disclaimers = [],
  primaryColor = "#1a1a1a",
  accentColor = "#d20f26",
  bgColor = "#ffffff",
  fontFamily = "'Georgia', 'Times New Roman', serif",
}) {
  const testimonialsHtml = testimonials.map(t => `
        <div class="testimonial">
            <div class="stars">${"&#9733;".repeat(t.stars || 5)}</div>
            <p class="testimonial-text">"${escapeHtml(t.text)}"</p>
            <p class="testimonial-author">— ${escapeHtml(t.name)}${t.location ? `, ${escapeHtml(t.location)}` : ""}${t.verified ? ' <span class="verified">Verified Purchase</span>' : ""}</p>
        </div>
  `).join("\n");

  const benefitsHtml = benefits.map(b => `
            <div class="benefit-item">
                <span class="benefit-check">&#10003;</span>
                <span>${escapeHtml(b)}</span>
            </div>
  `).join("\n");

  const bodyHtml = bodyParagraphs.map(p => {
    if (typeof p === "string") return `<p>${escapeHtml(p)}</p>`;
    if (p.type === "heading") return `<h2>${escapeHtml(p.text)}</h2>`;
    if (p.type === "image") return `<div class="article-image"><img src="${escapeAttr(p.src)}" alt="${escapeAttr(p.alt || "")}" loading="lazy"></div>`;
    if (p.type === "quote") return `<blockquote>${escapeHtml(p.text)}<cite>${escapeHtml(p.cite || "")}</cite></blockquote>`;
    if (p.type === "cta") return `<div class="inline-cta"><a href="${escapeAttr(ctaUrl)}" class="cta-button">${escapeHtml(p.text || ctaText)}</a></div>`;
    return `<p>${escapeHtml(p.text || "")}</p>`;
  }).join("\n        ");

  const disclaimersHtml = disclaimers.map(d => `<p>${escapeHtml(d)}</p>`).join("\n            ");

  const css = `
        /* Advertorial Styles */
        body {
            font-family: ${fontFamily};
            background: ${bgColor};
            color: ${primaryColor};
        }

        .publisher-bar {
            background: #f8f8f8;
            border-bottom: 1px solid #e0e0e0;
            padding: 8px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 13px;
            color: #666;
        }

        .publisher-bar img {
            height: 28px;
            display: inline-block;
        }

        .article-container {
            max-width: 740px;
            margin: 0 auto;
            padding: 20px;
        }

        .article-meta {
            font-size: 14px;
            color: #888;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid #eee;
        }

        .article-meta .author { font-weight: bold; color: #555; }
        .article-meta .date { margin-left: 15px; }

        h1 {
            font-size: clamp(24px, 5vw, 38px);
            line-height: 1.2;
            margin-bottom: 20px;
            color: ${primaryColor};
            font-weight: 900;
        }

        .subheadline {
            font-size: clamp(16px, 3vw, 20px);
            color: #555;
            margin-bottom: 25px;
            line-height: 1.5;
            font-style: italic;
        }

        .hero-image {
            width: 100%;
            margin-bottom: 25px;
            border-radius: 4px;
        }

        .hero-image img {
            width: 100%;
            border-radius: 4px;
        }

        .article-body p {
            font-size: 17px;
            line-height: 1.8;
            margin-bottom: 18px;
            color: #333;
        }

        .article-body h2 {
            font-size: clamp(20px, 4vw, 28px);
            margin: 35px 0 15px;
            color: ${primaryColor};
            line-height: 1.3;
        }

        .article-body blockquote {
            border-left: 4px solid ${accentColor};
            padding: 15px 20px;
            margin: 25px 0;
            background: #f9f9f9;
            font-style: italic;
            font-size: 18px;
        }

        .article-body blockquote cite {
            display: block;
            margin-top: 10px;
            font-size: 14px;
            color: #888;
            font-style: normal;
        }

        .article-image {
            margin: 25px 0;
        }

        .article-image img {
            width: 100%;
            border-radius: 4px;
        }

        /* CTA Button */
        .cta-button {
            display: inline-block;
            background: ${ctaColor};
            color: #fff;
            padding: 16px 40px;
            font-size: 18px;
            font-weight: bold;
            border-radius: 6px;
            text-transform: uppercase;
            letter-spacing: 1px;
            transition: transform 0.2s, box-shadow 0.2s;
            cursor: pointer;
            text-align: center;
        }

        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }

        .inline-cta {
            text-align: center;
            margin: 35px 0;
        }

        /* Benefits */
        .benefits-section {
            background: #f0f7f0;
            border-radius: 8px;
            padding: 25px;
            margin: 30px 0;
        }

        .benefits-section h3 {
            font-size: 22px;
            margin-bottom: 15px;
        }

        .benefit-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            margin-bottom: 12px;
            font-size: 16px;
        }

        .benefit-check {
            color: #28a745;
            font-size: 20px;
            font-weight: bold;
            flex-shrink: 0;
        }

        /* Testimonials */
        .testimonials-section {
            margin: 35px 0;
        }

        .testimonials-section h3 {
            font-size: 22px;
            margin-bottom: 20px;
            text-align: center;
        }

        .testimonial {
            background: #fafafa;
            border: 1px solid #eee;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 15px;
        }

        .stars {
            color: #ffc107;
            font-size: 20px;
            margin-bottom: 8px;
        }

        .testimonial-text {
            font-size: 16px;
            line-height: 1.6;
            font-style: italic;
            color: #444;
        }

        .testimonial-author {
            margin-top: 10px;
            font-size: 14px;
            color: #888;
            font-weight: bold;
        }

        .verified {
            background: #e8f5e9;
            color: #2e7d32;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            text-transform: uppercase;
        }

        /* Product section */
        .product-section {
            text-align: center;
            margin: 35px 0;
            padding: 30px;
            background: #fafafa;
            border-radius: 8px;
        }

        .product-section img {
            max-width: 300px;
            margin: 0 auto 20px;
        }

        .product-section h3 {
            font-size: 24px;
            margin-bottom: 15px;
        }

        /* Final CTA */
        .final-cta {
            text-align: center;
            padding: 40px 20px;
            margin: 30px 0;
            background: linear-gradient(135deg, #fafafa, #f0f0f0);
            border-radius: 8px;
        }

        .final-cta h2 {
            font-size: clamp(20px, 4vw, 28px);
            margin-bottom: 20px;
        }

        /* Disclaimer */
        .disclaimer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 11px;
            color: #999;
            line-height: 1.5;
        }

        /* Sticky bottom CTA (mobile) */
        .sticky-cta {
            display: none;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #fff;
            padding: 12px 20px;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            text-align: center;
        }

        .sticky-cta .cta-button {
            width: 100%;
            padding: 14px;
            font-size: 16px;
        }

        @media (max-width: 768px) {
            .article-container { padding: 15px; }
            .article-body p { font-size: 16px; }
            .sticky-cta { display: block; }
            body { padding-bottom: 70px; }
        }
    `;

  const html = `
    <div class="publisher-bar">
        <div>
            ${publisherLogo ? `<img src="${escapeAttr(publisherLogo)}" alt="${escapeAttr(publisherName)}">` : `<strong>${escapeHtml(publisherName)}</strong>`}
        </div>
        <div>Advertisement</div>
    </div>

    <div class="article-container">
        <div class="article-meta">
            <span class="author">${escapeHtml(author)}</span>
            <span class="date">${escapeHtml(date)}</span>
        </div>

        <h1>${escapeHtml(headline)}</h1>

        ${subheadline ? `<p class="subheadline">${escapeHtml(subheadline)}</p>` : ""}

        ${heroImage ? `<div class="hero-image"><img src="${escapeAttr(heroImage)}" alt="${escapeAttr(headline)}" loading="lazy"></div>` : ""}

        <div class="article-body">
            ${bodyHtml}
        </div>

        ${benefits.length > 0 ? `
        <div class="benefits-section">
            <h3>Key Benefits:</h3>
            ${benefitsHtml}
        </div>
        ` : ""}

        ${testimonials.length > 0 ? `
        <div class="testimonials-section">
            <h3>What People Are Saying</h3>
            ${testimonialsHtml}
        </div>
        ` : ""}

        ${productImage ? `
        <div class="product-section">
            <img src="${escapeAttr(productImage)}" alt="${escapeAttr(productName)}" loading="lazy">
            <h3>${escapeHtml(productName)}</h3>
            <a href="${escapeAttr(ctaUrl)}" class="cta-button">${escapeHtml(ctaText)}</a>
        </div>
        ` : ""}

        <div class="final-cta">
            <h2>Don't Wait — Limited Supply Available</h2>
            <a href="${escapeAttr(ctaUrl)}" class="cta-button">${escapeHtml(ctaText)}</a>
        </div>

        <div class="disclaimer">
            ${disclaimersHtml || "<p>This is an advertisement and not an actual news article, blog, or consumer protection update. Statements on this page have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease. Results may vary.</p>"}
        </div>
    </div>

    <div class="sticky-cta">
        <a href="${escapeAttr(ctaUrl)}" class="cta-button">${escapeHtml(ctaText)}</a>
    </div>
    `;

  const scripts = `
        // Show sticky CTA after scrolling past first CTA
        (function() {
            var sticky = document.querySelector('.sticky-cta');
            var shown = false;
            window.addEventListener('scroll', function() {
                if (window.scrollY > 800 && !shown) {
                    sticky.style.display = 'block';
                    shown = true;
                }
            });
        })();
    `;

  return generateHtml({
    title: stripHtmlForTitle(headline) || title,
    css,
    bodyHtml: html,
    scripts,
    googleFonts: ["https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap"],
    meta: {
      description: subheadline || headline,
      "og:title": stripHtmlForTitle(headline),
      "og:description": subheadline || "",
    },
  });
}

// Generate a raw clone (preserves original HTML/CSS as closely as possible)
function cloneTemplate(scrapedData) {
  const { parsed, html: rawHtml } = scrapedData;

  // For raw clones, we try to use the original HTML but make it self-contained
  // Replace relative URLs with absolute ones
  let processedHtml = rawHtml;

  // Make all image src absolute
  processedHtml = processedHtml.replace(
    /src=["'](?!https?:\/\/|data:)([^"']+)["']/gi,
    (match, src) => `src="${new URL(src, scrapedData.url).toString()}"`
  );

  // Make all href absolute (for CSS)
  processedHtml = processedHtml.replace(
    /href=["'](?!https?:\/\/|#|javascript:|mailto:)([^"']+)["']/gi,
    (match, href) => `href="${new URL(href, scrapedData.url).toString()}"`
  );

  return processedHtml;
}

// Utility: escape HTML entities
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Utility: escape for HTML attributes
function escapeAttr(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Strip HTML for plain text (e.g., title tag)
function stripHtmlForTitle(html) {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, "").trim();
}

module.exports = {
  generateHtml,
  saveHtml,
  advertorialTemplate,
  cloneTemplate,
  escapeHtml,
  escapeAttr,
  OUTPUT_DIR,
};
