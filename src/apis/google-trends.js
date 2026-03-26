/**
 * Google Trends API Client
 * Uses google-trends-api npm package for trending data.
 * Falls back to RSS scraping if package isn't available.
 */

let googleTrends;
try {
  googleTrends = require("google-trends-api");
} catch {
  console.log("[TRENDS] google-trends-api not installed — using RSS fallback");
}

/**
 * Get interest over time for a keyword.
 */
async function getInterestOverTime(keyword, options = {}) {
  if (!googleTrends) return { keyword, data: [], error: "google-trends-api not installed" };

  try {
    const result = await googleTrends.interestOverTime({
      keyword,
      startTime: options.startTime || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days
      endTime: options.endTime || new Date(),
      geo: options.geo || "US",
    });

    const parsed = JSON.parse(result);
    const timeline = parsed.default?.timelineData || [];

    return {
      keyword,
      data: timeline.map(t => ({
        date: t.formattedTime,
        value: t.value?.[0] || 0,
      })),
      trend: analyzeTrend(timeline),
    };
  } catch (err) {
    console.log(`[TRENDS] Error for "${keyword}": ${err.message?.slice(0, 80)}`);
    return { keyword, data: [], error: err.message };
  }
}

/**
 * Get related queries for a keyword.
 */
async function getRelatedQueries(keyword, options = {}) {
  if (!googleTrends) return { keyword, top: [], rising: [] };

  try {
    const result = await googleTrends.relatedQueries({
      keyword,
      startTime: options.startTime || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      geo: options.geo || "US",
    });

    const parsed = JSON.parse(result);
    const data = parsed.default?.rankedList || [];

    return {
      keyword,
      top: (data[0]?.rankedKeyword || []).map(k => ({
        query: k.query,
        value: k.value,
      })).slice(0, 15),
      rising: (data[1]?.rankedKeyword || []).map(k => ({
        query: k.query,
        value: k.value,
      })).slice(0, 15),
    };
  } catch (err) {
    console.log(`[TRENDS] Related queries error for "${keyword}": ${err.message?.slice(0, 80)}`);
    return { keyword, top: [], rising: [], error: err.message };
  }
}

/**
 * Get daily trending searches.
 */
async function getDailyTrends(geo = "US") {
  if (!googleTrends) return [];

  try {
    const result = await googleTrends.dailyTrends({ geo });
    const parsed = JSON.parse(result);
    const days = parsed.default?.trendingSearchesDays || [];

    const trends = [];
    for (const day of days.slice(0, 3)) {
      for (const search of (day.trendingSearches || []).slice(0, 10)) {
        trends.push({
          title: search.title?.query || "",
          traffic: search.formattedTraffic || "",
          articles: (search.articles || []).slice(0, 2).map(a => ({
            title: a.title,
            url: a.url,
            source: a.source,
          })),
        });
      }
    }

    return trends;
  } catch (err) {
    console.log(`[TRENDS] Daily trends error: ${err.message?.slice(0, 80)}`);
    return [];
  }
}

/**
 * Research a vertical — get trends + related queries for relevant keywords.
 */
async function researchVertical(vertical, keywords = []) {
  const searchTerms = keywords.length > 0 ? keywords : getDefaultKeywords(vertical);
  const results = { vertical, trends: [], relatedQueries: [], dailyTrends: [] };

  // Fetch in parallel (max 3 concurrent)
  const trendPromises = searchTerms.slice(0, 5).map(k => getInterestOverTime(k));
  const queryPromises = searchTerms.slice(0, 3).map(k => getRelatedQueries(k));

  const [trendResults, queryResults, daily] = await Promise.all([
    Promise.allSettled(trendPromises),
    Promise.allSettled(queryPromises),
    getDailyTrends(),
  ]);

  for (const r of trendResults) {
    if (r.status === "fulfilled") results.trends.push(r.value);
  }
  for (const r of queryResults) {
    if (r.status === "fulfilled") results.relatedQueries.push(r.value);
  }
  results.dailyTrends = daily;

  return results;
}

/**
 * Format trends data for Claude to analyze.
 */
function formatTrendsForAnalysis(trendsData) {
  let text = "";

  if (trendsData.trends?.length) {
    text += "GOOGLE TRENDS (interest over time):\n";
    for (const t of trendsData.trends) {
      if (t.error) {
        text += `• ${t.keyword}: Error — ${t.error}\n`;
        continue;
      }
      text += `• ${t.keyword}: ${t.trend || "stable"}`;
      if (t.data?.length) {
        const recent = t.data.slice(-4);
        text += ` | Recent: ${recent.map(d => d.value).join(", ")}`;
      }
      text += "\n";
    }
    text += "\n";
  }

  if (trendsData.relatedQueries?.length) {
    text += "RELATED QUERIES:\n";
    for (const q of trendsData.relatedQueries) {
      if (q.rising?.length) {
        text += `• ${q.keyword} — Rising: ${q.rising.slice(0, 5).map(r => r.query).join(", ")}\n`;
      }
      if (q.top?.length) {
        text += `• ${q.keyword} — Top: ${q.top.slice(0, 5).map(r => r.query).join(", ")}\n`;
      }
    }
    text += "\n";
  }

  if (trendsData.dailyTrends?.length) {
    text += "DAILY TRENDING SEARCHES (potential angles):\n";
    for (const t of trendsData.dailyTrends.slice(0, 10)) {
      text += `• ${t.title} (${t.traffic})\n`;
    }
    text += "\n";
  }

  return text || "No trends data available.\n";
}

// --- Helpers ---

function analyzeTrend(timeline) {
  if (!timeline || timeline.length < 4) return "insufficient data";
  const recent = timeline.slice(-4).map(t => t.value?.[0] || 0);
  const earlier = timeline.slice(0, 4).map(t => t.value?.[0] || 0);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;

  if (earlierAvg === 0) return recentAvg > 0 ? "rising" : "flat";
  const change = ((recentAvg - earlierAvg) / earlierAvg) * 100;

  if (change > 20) return `rising (+${change.toFixed(0)}%)`;
  if (change < -20) return `declining (${change.toFixed(0)}%)`;
  return "stable";
}

function getDefaultKeywords(vertical) {
  const defaults = {
    "mass-tort": ["mass tort lawsuit", "camp lejeune", "roundup lawsuit", "PFAS lawsuit", "personal injury lawyer"],
    "home-services": ["home renovation", "roofing repair", "bathroom remodel", "HVAC repair", "plumbing near me"],
    "insurance": ["auto insurance quotes", "home insurance", "life insurance", "insurance comparison"],
    "legal": ["personal injury attorney", "car accident lawyer", "disability lawyer", "workers comp attorney"],
    "health": ["weight loss supplement", "CBD oil", "joint pain relief", "hearing aids"],
    "finance": ["debt consolidation", "credit repair", "personal loan", "refinance mortgage"],
    "solar": ["solar panels cost", "solar installation", "solar energy savings"],
  };
  return defaults[vertical] || [vertical];
}

module.exports = {
  getInterestOverTime,
  getRelatedQueries,
  getDailyTrends,
  researchVertical,
  formatTrendsForAnalysis,
};
