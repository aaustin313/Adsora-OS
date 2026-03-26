/**
 * Landing Page Scraper
 *
 * Fetches a URL and extracts page structure, content, styles, and images.
 * Uses multiple strategies to handle JS-rendered pages.
 */

const https = require("https");
const http = require("http");
const { URL } = require("url");

// Block private/internal IPs to prevent SSRF
function isPrivateHost(hostname) {
  // Block obvious internal hostnames
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1", ""].includes(hostname)) return true;

  // Block cloud metadata endpoints
  if (hostname === "169.254.169.254") return true;

  // Block private IP ranges
  const parts = hostname.split(".").map(Number);
  if (parts.length === 4 && parts.every(p => !isNaN(p))) {
    if (parts[0] === 10) return true; // 10.x.x.x
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16-31.x.x
    if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.x.x
    if (parts[0] === 127) return true; // 127.x.x.x
    if (parts[0] === 0) return true; // 0.x.x.x
  }

  return false;
}

// Fetch raw HTML from a URL
function fetchPage(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);

    // SSRF protection: block private/internal URLs
    if (isPrivateHost(parsedUrl.hostname)) {
      reject(new Error("Cannot fetch internal/private URLs"));
      return;
    }

    const protocol = parsedUrl.protocol === "https:" ? https : http;
    const timeout = options.timeout || 15000;

    const req = protocol.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      timeout,
    }, (res) => {
      // Follow redirects (up to 5)
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const redirectParsed = new URL(res.headers.location, url);
        if (isPrivateHost(redirectParsed.hostname)) {
          reject(new Error("Redirect to internal/private URL blocked"));
          return;
        }
        const redirectUrl = redirectParsed.toString();
        if ((options._redirectCount || 0) >= 5) {
          reject(new Error("Too many redirects"));
          return;
        }
        fetchPage(redirectUrl, { ...options, _redirectCount: (options._redirectCount || 0) + 1 })
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const chunks = [];
      let totalSize = 0;
      const maxSize = 10 * 1024 * 1024; // 10MB limit

      res.on("data", (chunk) => {
        totalSize += chunk.length;
        if (totalSize > maxSize) {
          req.destroy();
          reject(new Error("Response too large (>10MB)"));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        resolve({
          html: Buffer.concat(chunks).toString("utf-8"),
          url: res.responseUrl || url,
          headers: res.headers,
        });
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
  });
}

// Extract text content, structure, images, and styles from HTML
function parsePageContent(html, sourceUrl) {
  const result = {
    title: "",
    meta: {},
    sections: [],
    images: [],
    styles: {
      colors: [],
      fonts: [],
    },
    scripts: [],
    links: [],
    rawHtml: html,
  };

  // Extract <title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) result.title = titleMatch[1].trim();

  // Extract meta tags
  const metaRegex = /<meta\s+(?:[^>]*?\s+)?(?:name|property)=["']([^"']+)["']\s+content=["']([^"']+)["']/gi;
  let metaMatch;
  while ((metaMatch = metaRegex.exec(html)) !== null) {
    result.meta[metaMatch[1]] = metaMatch[2];
  }

  // Extract all images
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const src = resolveUrl(imgMatch[1], sourceUrl);
    const altMatch = imgMatch[0].match(/alt=["']([^"']*?)["']/i);
    result.images.push({
      src,
      alt: altMatch ? altMatch[1] : "",
      tag: imgMatch[0],
    });
  }

  // Extract background images from inline styles
  const bgRegex = /background(?:-image)?:\s*url\(["']?([^"')]+)["']?\)/gi;
  let bgMatch;
  while ((bgMatch = bgRegex.exec(html)) !== null) {
    result.images.push({
      src: resolveUrl(bgMatch[1], sourceUrl),
      alt: "background",
      type: "background",
    });
  }

  // Extract inline styles for color analysis
  const colorRegex = /#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)/g;
  const colorMatches = html.match(colorRegex) || [];
  result.styles.colors = [...new Set(colorMatches)].slice(0, 20);

  // Extract font references
  const fontRegex = /font-family:\s*["']?([^;"']+)/gi;
  let fontMatch;
  while ((fontMatch = fontRegex.exec(html)) !== null) {
    result.styles.fonts.push(fontMatch[1].trim());
  }
  result.styles.fonts = [...new Set(result.styles.fonts)];

  // Extract Google Fonts links
  const gfontRegex = /href=["'](https:\/\/fonts\.googleapis\.com\/[^"']+)["']/gi;
  let gfontMatch;
  while ((gfontMatch = gfontRegex.exec(html)) !== null) {
    result.styles.fonts.push(gfontMatch[1]);
  }

  // Extract visible text content section by section
  result.sections = extractSections(html);

  // Extract external stylesheets
  const cssRegex = /<link[^>]+href=["']([^"']+\.css[^"']*)["'][^>]*>/gi;
  let cssMatch;
  while ((cssMatch = cssRegex.exec(html)) !== null) {
    result.links.push({
      type: "stylesheet",
      href: resolveUrl(cssMatch[1], sourceUrl),
    });
  }

  // Extract inline <style> blocks
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  const inlineStyles = [];
  while ((styleMatch = styleRegex.exec(html)) !== null) {
    inlineStyles.push(styleMatch[1]);
  }
  result.inlineStyles = inlineStyles.join("\n");

  return result;
}

// Extract logical sections from the page
function extractSections(html) {
  const sections = [];

  // Remove script and style tags for text extraction
  let cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");

  // Extract headings with their following content
  const headingRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let headingMatch;
  while ((headingMatch = headingRegex.exec(cleanHtml)) !== null) {
    const level = headingMatch[1];
    const text = stripTags(headingMatch[2]).trim();
    if (text.length > 0) {
      sections.push({
        type: "heading",
        level,
        text,
      });
    }
  }

  // Extract paragraphs
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch;
  while ((pMatch = pRegex.exec(cleanHtml)) !== null) {
    const text = stripTags(pMatch[1]).trim();
    if (text.length > 10) {
      sections.push({
        type: "paragraph",
        text,
      });
    }
  }

  // Extract list items
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch;
  while ((liMatch = liRegex.exec(cleanHtml)) !== null) {
    const text = stripTags(liMatch[1]).trim();
    if (text.length > 3) {
      sections.push({
        type: "list-item",
        text,
      });
    }
  }

  // Extract buttons/CTAs
  const btnRegex = /<(?:button|a)[^>]*(?:class=["'][^"']*(?:btn|button|cta)[^"']*["'|href=["'][^"']*["'])[^>]*>([\s\S]*?)<\/(?:button|a)>/gi;
  let btnMatch;
  while ((btnMatch = btnRegex.exec(cleanHtml)) !== null) {
    const text = stripTags(btnMatch[1]).trim();
    if (text.length > 0 && text.length < 100) {
      sections.push({
        type: "cta",
        text,
      });
    }
  }

  return sections;
}

// Strip HTML tags from a string
function stripTags(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Resolve relative URLs to absolute
function resolveUrl(relative, base) {
  if (!relative) return "";
  if (relative.startsWith("http://") || relative.startsWith("https://") || relative.startsWith("//")) {
    return relative.startsWith("//") ? "https:" + relative : relative;
  }
  try {
    return new URL(relative, base).toString();
  } catch {
    return relative;
  }
}

// Get the full visible text content of a page (for AI analysis)
function getFullText(html) {
  let clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Remove lines that are just whitespace or very short
  const lines = clean.split("\n").filter(l => l.trim().length > 2);
  return lines.join("\n");
}

// Main scrape function
async function scrapePage(url) {
  console.log(`[SCRAPER] Fetching: ${url}`);
  const { html, url: finalUrl } = await fetchPage(url);
  console.log(`[SCRAPER] Got ${html.length} chars from ${finalUrl}`);

  const parsed = parsePageContent(html, finalUrl);
  const fullText = getFullText(html);

  return {
    url: finalUrl,
    html,
    parsed,
    fullText,
    isJsRendered: fullText.length < 500 && html.length > 5000,
  };
}

module.exports = {
  scrapePage,
  fetchPage,
  parsePageContent,
  getFullText,
  stripTags,
  resolveUrl,
};
