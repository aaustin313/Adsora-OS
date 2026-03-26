/**
 * Build exact clone of the Forest Mountain Farms CBD page
 * - Inlines external CSS (marge.css, bootstrap-v4.css)
 * - Converts relative image/font URLs to absolute
 * - Replaces CTA links with target URL
 * - Replaces image URLs with GHL-hosted versions
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { uploadMediaFromUrl, isGhlConfigured } = require("../src/ghl/client");

const BASE_URL = "https://wellnessprrime.com/forest/";
const CTA_URL = "https://click.americanprograms.org/cf/click/1";
const ORIGINAL_CTA = "https://nodentifythirends.com/click";

async function build() {
  let html = fs.readFileSync("/tmp/original-page.html", "utf-8");
  const margeCss = fs.readFileSync("/tmp/marge.css", "utf-8");
  const bootstrapCss = fs.readFileSync("/tmp/bootstrap-v4.css", "utf-8");

  console.log("[CLONE] Starting exact clone build...");

  // 1. Inline external CSS
  // Replace <link href="marge.css"> with inline <style>
  html = html.replace(
    /<link\s+href="marge\.css"[^>]*\/?\s*>/i,
    `<style type="text/css">\n${margeCss}\n</style>`
  );
  html = html.replace(
    /<link\s+href="bootstrap-v4\.css"[^>]*\/?\s*>/i,
    `<style type="text/css">\n${bootstrapCss}\n</style>`
  );
  console.log("[CLONE] Inlined CSS files");

  // 2. Convert relative URLs to absolute
  // Images: src="something.jpg" → src="https://wellnessprrime.com/forest/something.jpg"
  // But skip already-absolute URLs and data: URIs
  html = html.replace(/src="(?!https?:\/\/)(?!data:)([^"]+)"/g, function(match, p1) {
    return 'src="' + BASE_URL + p1 + '"';
  });

  // Background images in inline styles: url(something.png) → url(https://...)
  html = html.replace(/url\((?!['"]?https?:\/\/)(?!['"]?data:)['"]?([^'")]+)['"]?\)/g, function(match, p1) {
    return "url('" + BASE_URL + p1 + "')";
  });

  // Font URLs in CSS: url('Inter-UI-Regular.woff2') → absolute
  html = html.replace(/url\('(?!https?:\/\/)(?!data:)([^']+\.woff2?)'\)/g, function(match, p1) {
    return "url('" + BASE_URL + p1 + "')";
  });

  console.log("[CLONE] Converted relative URLs to absolute");

  // 3. Replace CTA links
  // Replace the original click URL with our CTA
  html = html.replace(new RegExp(ORIGINAL_CTA.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), CTA_URL);
  console.log("[CLONE] Replaced CTA links");

  // 4. Remove tracking scripts (GTM, Rocket Loader, AddThis, etc.)
  // Keep the page functional but remove external JS dependencies
  html = html.replace(/<script[^>]*src="[^"]*googletagmanager[^"]*"[^>]*><\/script>/gi, "");
  html = html.replace(/<script[^>]*src="[^"]*rocket-loader[^"]*"[^>]*><\/script>/gi, "");
  html = html.replace(/<script[^>]*src="[^"]*addthis[^"]*"[^>]*><\/script>/gi, "");
  html = html.replace(/<script[^>]*src="[^"]*cloudflare[^"]*"[^>]*><\/script>/gi, "");
  // Remove inline GTM/tracking scripts
  html = html.replace(/<!-- Google Tag Manager -->[\s\S]*?<!-- End Google Tag Manager -->/gi, "");
  html = html.replace(/<!-- Google Tag Manager \(noscript\) -->[\s\S]*?<!-- End Google Tag Manager \(noscript\) -->/gi, "");

  console.log("[CLONE] Removed tracking scripts");

  // 5. Upload images to GHL and replace URLs
  if (isGhlConfigured()) {
    console.log("[CLONE] Uploading images to GHL...");

    // Find all image URLs in the HTML
    const imgUrls = new Set();
    const imgRegex = /src="(https:\/\/wellnessprrime\.com\/forest\/[^"]+)"/g;
    let m;
    while ((m = imgRegex.exec(html)) !== null) {
      const url = m[1];
      if (!url.endsWith(".js") && !url.endsWith(".woff2")) {
        imgUrls.add(url);
      }
    }

    // Also get background-image URLs
    const bgRegex = /url\(['"]?(https:\/\/wellnessprrime\.com\/forest\/[^'")\s]+)['"]?\)/g;
    while ((m = bgRegex.exec(html)) !== null) {
      imgUrls.add(m[1]);
    }

    console.log(`[CLONE] Found ${imgUrls.size} unique images to upload`);

    const urlMap = {};
    for (const imgUrl of imgUrls) {
      try {
        const filename = decodeURIComponent(path.basename(new URL(imgUrl).pathname));
        console.log(`  Uploading: ${filename}`);
        const result = await uploadMediaFromUrl(imgUrl, filename);
        if (result && result.url) {
          urlMap[imgUrl] = result.url;
          console.log(`    → ${result.url.slice(0, 70)}`);
        }
      } catch (err) {
        console.log(`    FAILED: ${err.message.slice(0, 100)}`);
      }
    }

    // Replace all image URLs
    for (const [origUrl, ghlUrl] of Object.entries(urlMap)) {
      const escaped = origUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      html = html.replace(new RegExp(escaped, "g"), ghlUrl);
    }

    console.log(`[CLONE] Replaced ${Object.keys(urlMap).length} image URLs with GHL-hosted versions`);
  } else {
    console.log("[CLONE] GHL not configured, keeping original image URLs");
  }

  // 6. Save
  const outDir = path.join(__dirname, "..", "output", "landing-pages");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "forest-mountain-farms-cbd-clone.html");
  fs.writeFileSync(outPath, html);

  const sizeKb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`\n[CLONE] DONE! Saved to: ${outPath}`);
  console.log(`[CLONE] Size: ${sizeKb}KB (${sizeKb < 5120 ? "under" : "OVER"} 5MB GHL limit)`);

  // Count CTA links
  const ctaCount = (html.match(new RegExp(CTA_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  console.log(`[CLONE] CTA links: ${ctaCount} pointing to ${CTA_URL}`);
}

build().catch(err => {
  console.error("BUILD FAILED:", err.message);
  process.exit(1);
});
