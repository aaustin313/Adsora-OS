/**
 * Meta Ad Library API Client
 * Free public API for searching competitor ads across Facebook & Instagram.
 * Uses the existing FACEBOOK_ACCESS_TOKEN.
 */

const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// In-memory cache (1 hour TTL)
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000;

function getCacheKey(params) {
  return JSON.stringify(params);
}

/**
 * Search the Meta Ad Library for ads matching search terms.
 * @param {string} searchTerms - Keywords to search for
 * @param {object} options - Additional options
 * @returns {Array} Array of ad objects
 */
async function searchAds(searchTerms, options = {}) {
  const {
    country = "US",
    activeStatus = "ACTIVE",
    adType = "ALL",
    limit = 50,
    platform = "FACEBOOK",
    bypassCache = false,
  } = options;

  const params = {
    search_terms: searchTerms,
    ad_reached_countries: JSON.stringify([country]),
    ad_active_status: activeStatus,
    ad_type: adType,
    search_page_ids: options.pageIds ? JSON.stringify(options.pageIds) : undefined,
    limit: Math.min(limit, 100),
    fields: [
      "id",
      "ad_creation_time",
      "ad_creative_bodies",
      "ad_creative_link_captions",
      "ad_creative_link_descriptions",
      "ad_creative_link_titles",
      "ad_delivery_start_time",
      "ad_delivery_stop_time",
      "ad_snapshot_url",
      "page_id",
      "page_name",
      "publisher_platforms",
      "impressions",
      "spend",
      "currency",
      "languages",
      "target_locations",
      "estimated_audience_size",
      "demographic_distribution",
    ].join(","),
  };

  // Remove undefined values
  Object.keys(params).forEach(k => params[k] === undefined && delete params[k]);

  const cacheKey = getCacheKey(params);
  if (!bypassCache && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.time < CACHE_TTL) {
      console.log(`[AD LIBRARY] Cache hit for "${searchTerms}"`);
      return cached.data;
    }
    cache.delete(cacheKey);
  }

  console.log(`[AD LIBRARY] Searching: "${searchTerms}" (${country}, ${activeStatus})`);

  const url = new URL(`${BASE_URL}/ads_archive`);
  url.searchParams.set("access_token", ACCESS_TOKEN);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.error) {
    throw new Error(`Ad Library API: ${data.error.message}`);
  }

  const ads = data.data || [];

  // Paginate if needed and under limit
  let allAds = [...ads];
  let nextUrl = data.paging?.next;
  while (nextUrl && allAds.length < limit) {
    const nextRes = await fetch(nextUrl);
    const nextData = await nextRes.json();
    if (nextData.error || !nextData.data) break;
    allAds = allAds.concat(nextData.data);
    nextUrl = nextData.paging?.next;
  }

  allAds = allAds.slice(0, limit);

  // Cache results
  cache.set(cacheKey, { data: allAds, time: Date.now() });

  console.log(`[AD LIBRARY] Found ${allAds.length} ads for "${searchTerms}"`);
  return allAds;
}

/**
 * Search ads by a specific page ID (competitor page).
 */
async function searchByPage(pageId, options = {}) {
  return searchAds("", { ...options, pageIds: [pageId] });
}

/**
 * Get ads for multiple search terms in parallel.
 */
async function searchMultiple(searchTermsList, options = {}) {
  const results = new Map();
  const batchSize = 3; // Respect rate limits

  for (let i = 0; i < searchTermsList.length; i += batchSize) {
    const batch = searchTermsList.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(terms => searchAds(terms, options).then(ads => ({ terms, ads })))
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.set(result.value.terms, result.value.ads);
      }
    }

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < searchTermsList.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return results;
}

/**
 * Format ads into a concise summary for Claude to analyze.
 */
function formatAdsForAnalysis(ads) {
  if (!ads || ads.length === 0) return "No ads found.";

  let summary = "";
  for (let i = 0; i < Math.min(ads.length, 30); i++) {
    const ad = ads[i];
    summary += `\n--- AD ${i + 1} ---\n`;
    summary += `Page: ${ad.page_name || "unknown"}\n`;
    summary += `Started: ${ad.ad_delivery_start_time || ad.ad_creation_time || "unknown"}\n`;

    if (ad.ad_creative_bodies?.length) {
      summary += `Body: ${ad.ad_creative_bodies[0].slice(0, 500)}\n`;
    }
    if (ad.ad_creative_link_titles?.length) {
      summary += `Headline: ${ad.ad_creative_link_titles[0]}\n`;
    }
    if (ad.ad_creative_link_descriptions?.length) {
      summary += `Description: ${ad.ad_creative_link_descriptions[0]}\n`;
    }
    if (ad.ad_creative_link_captions?.length) {
      summary += `Link Caption: ${ad.ad_creative_link_captions[0]}\n`;
    }
    if (ad.impressions) {
      const lower = ad.impressions.lower_bound || "?";
      const upper = ad.impressions.upper_bound || "?";
      summary += `Impressions: ${lower}–${upper}\n`;
    }
    if (ad.spend) {
      const lower = ad.spend.lower_bound || "?";
      const upper = ad.spend.upper_bound || "?";
      summary += `Spend: $${lower}–$${upper}\n`;
    }
    if (ad.publisher_platforms?.length) {
      summary += `Platforms: ${ad.publisher_platforms.join(", ")}\n`;
    }
    if (ad.ad_snapshot_url) {
      summary += `Snapshot: ${ad.ad_snapshot_url}\n`;
    }
  }

  if (ads.length > 30) {
    summary += `\n[... ${ads.length - 30} more ads truncated ...]\n`;
  }

  return summary;
}

function clearCache() {
  cache.clear();
}

module.exports = {
  searchAds,
  searchByPage,
  searchMultiple,
  formatAdsForAnalysis,
  clearCache,
};
