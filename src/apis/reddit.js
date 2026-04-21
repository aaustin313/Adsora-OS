/**
 * Reddit Public API Client
 * Searches Reddit for discussions, comments, and sentiment around verticals/offers.
 * Uses Reddit's public JSON API — no API key required for read-only access.
 */

// In-memory cache (30 min TTL)
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

const USER_AGENT = "AdsOraResearchBot/1.0";

// Subreddits relevant to each vertical
const VERTICAL_SUBREDDITS = {
  "mass-tort": ["legaladvice", "personalinjury", "askaLawyer", "classaction"],
  "home-services": ["HomeImprovement", "homeowners", "Construction", "HVAC", "Roofing", "Plumbing"],
  "insurance": ["Insurance", "HealthInsurance", "personalfinance", "povertyfinance"],
  "legal": ["legaladvice", "personalinjury", "WorkersComp", "disability"],
  "solar": ["solar", "SolarDIY", "energy", "homeowners"],
  "health": ["Health", "Supplements", "loseit", "Fitness", "HearingAids"],
  "finance": ["personalfinance", "CRedit", "debtfree", "FinancialPlanning", "StudentLoans"],
  "newsletter": ["Emailmarketing", "Blogging", "EntrepreneurRideAlong", "SideProject"],
};

/**
 * Make a request to Reddit's public JSON API.
 */
async function redditFetch(url) {
  // Check if .json is already in the URL path (before query string)
  const [urlPath] = url.split("?");
  const hasJson = urlPath.includes(".json");
  let jsonUrl;
  if (hasJson) {
    jsonUrl = url.includes("raw_json") ? url : url + (url.includes("?") ? "&" : "?") + "raw_json=1";
  } else {
    jsonUrl = url + ".json?raw_json=1";
  }

  const res = await fetch(jsonUrl, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (res.status === 429) {
    console.log("[REDDIT] Rate limited, waiting 2s...");
    await new Promise(r => setTimeout(r, 2000));
    const retry = await fetch(jsonUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!retry.ok) throw new Error(`Reddit API: HTTP ${retry.status}`);
    return retry.json();
  }

  if (!res.ok) throw new Error(`Reddit API: HTTP ${res.status}`);
  return res.json();
}

/**
 * Search Reddit for posts matching a query.
 * @param {string} query - Search terms
 * @param {object} options - { subreddit, sort, limit, time }
 * @returns {Array} Array of post objects
 */
async function searchPosts(query, options = {}) {
  const { subreddit, sort = "relevance", limit = 25, time = "month" } = options;

  const cacheKey = `search:${query}:${subreddit || "all"}:${sort}:${time}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.time < CACHE_TTL) return cached.data;
    cache.delete(cacheKey);
  }

  const encodedQuery = encodeURIComponent(query);
  const base = subreddit
    ? `https://www.reddit.com/r/${subreddit}/search.json`
    : `https://www.reddit.com/search.json`;

  const url = `${base}?q=${encodedQuery}&sort=${sort}&t=${time}&limit=${limit}&restrict_sr=${subreddit ? "on" : "off"}`;

  try {
    const data = await redditFetch(url);
    const posts = (data?.data?.children || []).map(child => ({
      title: child.data.title,
      selftext: child.data.selftext?.slice(0, 500) || "",
      subreddit: child.data.subreddit,
      score: child.data.score,
      numComments: child.data.num_comments,
      url: `https://reddit.com${child.data.permalink}`,
      created: new Date(child.data.created_utc * 1000).toISOString(),
      author: child.data.author,
    }));

    cache.set(cacheKey, { data: posts, time: Date.now() });
    return posts;
  } catch (err) {
    console.log(`[REDDIT] Search error for "${query}": ${err.message}`);
    return [];
  }
}

/**
 * Get top comments from a specific post.
 * @param {string} permalink - Reddit permalink (e.g., /r/sub/comments/id/title/)
 * @param {number} limit - Max comments to fetch
 * @returns {Array} Array of comment objects
 */
async function getPostComments(permalink, limit = 20) {
  try {
    const url = `https://www.reddit.com${permalink}.json?limit=${limit}&sort=top`;
    const data = await redditFetch(url);

    if (!Array.isArray(data) || data.length < 2) return [];

    const comments = [];
    const children = data[1]?.data?.children || [];

    for (const child of children) {
      if (child.kind !== "t1" || !child.data.body) continue;
      comments.push({
        body: child.data.body.slice(0, 400),
        score: child.data.score,
        author: child.data.author,
      });
    }

    return comments;
  } catch (err) {
    console.log(`[REDDIT] Comments error: ${err.message}`);
    return [];
  }
}

/**
 * Search multiple terms across relevant subreddits for a vertical.
 * @param {string[]} searchTerms - Array of search terms
 * @param {string} vertical - Vertical name
 * @param {object} options - { limit, time, fetchComments }
 * @returns {Map<string, Array>} Map of searchTerm → posts
 */
async function searchVertical(searchTerms, vertical, options = {}) {
  const { limit = 15, time = "month", fetchComments = true } = options;

  const subreddits = VERTICAL_SUBREDDITS[vertical] || [];
  const results = new Map();

  // Search general Reddit + specific subreddits
  const promises = searchTerms.map(async (term) => {
    // General search
    const generalPosts = await searchPosts(term, { limit, time, sort: "relevance" });

    // Subreddit-specific search (top 2 subreddits)
    const subPosts = [];
    for (const sub of subreddits.slice(0, 2)) {
      const posts = await searchPosts(term, { subreddit: sub, limit: 5, time });
      subPosts.push(...posts);
    }

    // Combine and deduplicate
    const allPosts = [...generalPosts, ...subPosts];
    const seen = new Set();
    const unique = allPosts.filter(p => {
      if (seen.has(p.url)) return false;
      seen.add(p.url);
      return true;
    });

    // Sort by engagement (score + comments)
    unique.sort((a, b) => (b.score + b.numComments) - (a.score + a.numComments));

    // Fetch top comments from the most engaged posts
    if (fetchComments) {
      const topPosts = unique.slice(0, 3);
      for (const post of topPosts) {
        const permalink = new URL(post.url).pathname;
        const comments = await getPostComments(permalink, 10);
        post.topComments = comments.slice(0, 5);
      }
    }

    results.set(term, unique.slice(0, limit));
  });

  await Promise.allSettled(promises);
  return results;
}

/**
 * Format Reddit data for Claude analysis.
 * @param {Map<string, Array>} searchResults
 * @returns {string}
 */
function formatForAnalysis(searchResults) {
  if (!searchResults || searchResults.size === 0) return "No Reddit data available.";

  let output = "REDDIT DISCUSSIONS & SENTIMENT\n\n";

  for (const [term, posts] of searchResults) {
    output += `--- "${term}" (${posts.length} posts) ---\n`;

    for (const post of posts.slice(0, 8)) {
      output += `\n[${post.subreddit}] ${post.title} (${post.score} upvotes, ${post.numComments} comments)\n`;

      if (post.selftext) {
        output += `  Body: ${post.selftext.slice(0, 200)}...\n`;
      }

      if (post.topComments?.length) {
        output += `  Top comments:\n`;
        for (const c of post.topComments.slice(0, 3)) {
          output += `    - (${c.score} pts) ${c.body.slice(0, 150)}...\n`;
        }
      }
    }
    output += "\n";
  }

  return output;
}

module.exports = {
  searchPosts,
  getPostComments,
  searchVertical,
  formatForAnalysis,
  VERTICAL_SUBREDDITS,
};
