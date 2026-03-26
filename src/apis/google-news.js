/**
 * Google News Client
 * Uses Google News RSS feeds (free, no API key needed).
 * Parses XML response to extract headlines and links.
 */

// Cache results for 30 minutes
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

/**
 * Search Google News for a query.
 * @param {string} query - Search terms
 * @param {object} options
 * @returns {Array} Array of { title, link, source, pubDate, snippet }
 */
async function searchNews(query, options = {}) {
  const { lang = "en", country = "US", limit = 15 } = options;

  const cacheKey = `${query}-${lang}-${country}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.time < CACHE_TTL) {
      return cached.data;
    }
    cache.delete(cacheKey);
  }

  const encodedQuery = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=${lang}&gl=${country}&ceid=${country}:${lang}`;

  console.log(`[GOOGLE NEWS] Searching: "${query}"`);

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    const articles = parseRssXml(xml).slice(0, limit);

    cache.set(cacheKey, { data: articles, time: Date.now() });
    console.log(`[GOOGLE NEWS] Found ${articles.length} articles for "${query}"`);

    return articles;
  } catch (err) {
    console.log(`[GOOGLE NEWS] Error: ${err.message}`);
    return [];
  }
}

/**
 * Get top headlines (no specific query).
 */
async function getTopHeadlines(options = {}) {
  const { lang = "en", country = "US", topic } = options;

  let url = `https://news.google.com/rss?hl=${lang}&gl=${country}&ceid=${country}:${lang}`;
  if (topic) {
    const topicMap = {
      business: "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB",
      technology: "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB",
      health: "CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtVnVLQUFQAQ",
      science: "CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pWVXlnQVAB",
    };
    if (topicMap[topic]) {
      url = `https://news.google.com/rss/topics/${topicMap[topic]}?hl=${lang}&gl=${country}`;
    }
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseRssXml(xml).slice(0, 20);
  } catch (err) {
    console.log(`[GOOGLE NEWS] Headlines error: ${err.message}`);
    return [];
  }
}

/**
 * Search multiple queries in parallel.
 */
async function searchMultiple(queries, options = {}) {
  const results = new Map();

  const promises = queries.map(q =>
    searchNews(q, options)
      .then(articles => ({ query: q, articles }))
      .catch(() => ({ query: q, articles: [] }))
  );

  const settled = await Promise.allSettled(promises);
  for (const r of settled) {
    if (r.status === "fulfilled") {
      results.set(r.value.query, r.value.articles);
    }
  }

  return results;
}

/**
 * Format news articles for Claude to analyze.
 */
function formatNewsForAnalysis(articlesMap) {
  let text = "RECENT NEWS (potential ad angles):\n\n";

  if (articlesMap instanceof Map) {
    for (const [query, articles] of articlesMap) {
      text += `--- "${query}" ---\n`;
      for (const a of articles.slice(0, 8)) {
        text += `• ${a.title}`;
        if (a.source) text += ` [${a.source}]`;
        if (a.pubDate) text += ` (${a.pubDate})`;
        text += "\n";
      }
      text += "\n";
    }
  } else if (Array.isArray(articlesMap)) {
    for (const a of articlesMap.slice(0, 15)) {
      text += `• ${a.title}`;
      if (a.source) text += ` [${a.source}]`;
      text += "\n";
    }
  }

  return text;
}

// --- XML Parser (lightweight, no dependencies) ---

function parseRssXml(xml) {
  const articles = [];
  const items = xml.split("<item>").slice(1); // skip header

  for (const item of items) {
    const title = extractTag(item, "title");
    const link = extractTag(item, "link");
    const pubDate = extractTag(item, "pubDate");
    const source = extractTag(item, "source");
    const description = extractTag(item, "description");

    if (title) {
      articles.push({
        title: decodeEntities(title),
        link: link || "",
        source: source ? decodeEntities(source) : "",
        pubDate: pubDate ? formatDate(pubDate) : "",
        snippet: description ? decodeEntities(description).slice(0, 200) : "",
      });
    }
  }

  return articles;
}

function extractTag(xml, tag) {
  // Handle CDATA
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([^\\]]*?)\\]\\]></${tag}>`, "i");
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1];

  // Handle regular tags
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1] : null;
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ""); // strip HTML tags
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

module.exports = {
  searchNews,
  getTopHeadlines,
  searchMultiple,
  formatNewsForAnalysis,
};
