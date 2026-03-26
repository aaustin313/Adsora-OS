/**
 * ClickFlare API Client
 * Pulls revenue, cost, profit, conversions, and attribution data from ClickFlare tracker.
 * API docs: https://developers.clickflare.io/
 */

const API_KEY = process.env.CLICKFLARE_API_KEY;
const BASE_URL = "https://public-api.clickflare.io/api";

// In-memory cache (15 min TTL — data updates aren't instant)
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000;

// Rate limit: 2 req/sec — simple delay between calls
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 550; // ms between requests

function isConfigured() {
  return !!API_KEY;
}

async function rateLimitedFetch(url, options) {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, options);
}

/**
 * Make an API call to ClickFlare.
 */
async function clickflareApi(endpoint, body = null) {
  if (!API_KEY) throw new Error("ClickFlare not configured — set CLICKFLARE_API_KEY in .env");

  const options = {
    headers: {
      "api-key": API_KEY,
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.method = "POST";
    options.body = JSON.stringify(body);
  }

  const res = await rateLimitedFetch(`${BASE_URL}${endpoint}`, options);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ClickFlare API ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

// --- Date helpers ---

function todayRange(timezone = "America/New_York") {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD
  return {
    startDate: `${dateStr} 00:00:00`,
    endDate: `${dateStr} 23:59:59`,
    timezone,
  };
}

function dateRange(preset, timezone = "America/New_York") {
  const now = new Date();
  const endStr = now.toLocaleDateString("en-CA", { timeZone: timezone });
  let startDate;

  switch (preset) {
    case "today":
      return todayRange(timezone);
    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toLocaleDateString("en-CA", { timeZone: timezone });
      return { startDate: `${yStr} 00:00:00`, endDate: `${yStr} 23:59:59`, timezone };
    }
    case "last_7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      startDate = d.toLocaleDateString("en-CA", { timeZone: timezone });
      break;
    }
    case "last_30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      startDate = d.toLocaleDateString("en-CA", { timeZone: timezone });
      break;
    }
    case "this_month": {
      startDate = `${endStr.slice(0, 7)}-01`;
      break;
    }
    default:
      return todayRange(timezone);
  }

  return {
    startDate: `${startDate} 00:00:00`,
    endDate: `${endStr} 23:59:59`,
    timezone,
  };
}

// --- Core report function ---

/**
 * Pull a ClickFlare report with specified grouping and metrics.
 * @param {object} options
 * @param {string} options.preset - Date preset: today, yesterday, last_7d, last_30d, this_month
 * @param {string[]} options.groupBy - Dimensions to group by (e.g. ["campaignID"])
 * @param {string[]} options.metrics - Metrics to include
 * @param {object} options.filters - Optional filters
 * @returns {object} Report data
 */
async function getReport(options = {}) {
  const {
    preset = "today",
    groupBy = ["campaignID"],
    metrics = [
      "campaignID", "campaignName",
      "visits", "clicks", "conversions",
      "revenue", "cost", "profit",
      "ctr", "cvr", "roi", "roas",
      "epc", "cpa",
    ],
    sortBy = "revenue",
    orderType = "desc",
    page = 1,
    pageSize = 100,
    includeAll = false,
    filters,
  } = options;

  const cacheKey = JSON.stringify({ preset, groupBy, metrics, filters });
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    console.log("[CLICKFLARE] Cache hit");
    return cached.data;
  }

  const range = dateRange(preset);
  const body = {
    startDate: range.startDate,
    endDate: range.endDate,
    timezone: range.timezone,
    groupBy,
    metrics,
    sortBy,
    orderType,
    page,
    pageSize,
    includeAll,
  };

  if (filters) body.filters = filters;

  console.log(`[CLICKFLARE] Report: ${preset}, groupBy: ${groupBy.join(",")}`);
  const raw = await clickflareApi("/report", body);

  // API returns { items: [...], totals: {...} } — extract items array
  const data = raw.items || raw.data || (Array.isArray(raw) ? raw : []);

  cache.set(cacheKey, { data, time: Date.now() });
  return data;
}

// --- High-level queries ---

/**
 * Get revenue/profit by campaign for a given period.
 */
async function getRevenueByCampaign(preset = "today") {
  return getReport({
    preset,
    groupBy: ["campaignID"],
    metrics: [
      "campaignID", "campaignName",
      "visits", "clicks", "conversions",
      "revenue", "cost", "profit",
      "ctr", "cvr", "roi", "roas",
      "epc", "cpa",
    ],
  });
}

/**
 * Get revenue by offer (useful for affiliate tracking).
 */
async function getRevenueByOffer(preset = "today") {
  return getReport({
    preset,
    groupBy: ["offerID"],
    metrics: [
      "offerID", "offerName",
      "visits", "clicks", "conversions",
      "revenue", "cost", "profit",
      "cvr", "roi", "epc", "cpa",
    ],
  });
}

/**
 * Get daily breakdown for trend analysis.
 */
async function getDailyBreakdown(preset = "last_7d") {
  return getReport({
    preset,
    groupBy: ["date"],
    metrics: [
      "date",
      "visits", "clicks", "conversions",
      "revenue", "cost", "profit",
      "cvr", "roi", "roas",
    ],
  });
}

/**
 * Get revenue by traffic source (to match back to FB ad accounts).
 */
async function getRevenueBySource(preset = "today") {
  return getReport({
    preset,
    groupBy: ["trafficSourceID"],
    metrics: [
      "trafficSourceID", "trafficSourceName",
      "visits", "clicks", "conversions",
      "revenue", "cost", "profit",
      "roi", "roas", "epc", "cpa",
    ],
  });
}

/**
 * Get all campaigns list (for mapping).
 */
async function listCampaigns() {
  return clickflareApi("/campaigns/list");
}

/**
 * Get all offers (for mapping).
 */
async function listOffers() {
  return clickflareApi("/offers");
}

/**
 * Get account settings (timezone, currency).
 */
async function getSettings() {
  return clickflareApi("/settings");
}

// --- Formatting ---

/**
 * Format campaign revenue report for Telegram/Claude consumption.
 */
function formatCampaignRevenue(reportData, preset = "today") {
  if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
    return `📊 CLICKFLARE — No data for ${preset}`;
  }

  // Sort by revenue descending
  const sorted = [...reportData].sort((a, b) =>
    (parseFloat(b.revenue) || 0) - (parseFloat(a.revenue) || 0)
  );

  let totalRevenue = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let totalConversions = 0;

  for (const row of sorted) {
    totalRevenue += parseFloat(row.revenue) || 0;
    totalCost += parseFloat(row.cost) || 0;
    totalProfit += parseFloat(row.profit) || 0;
    totalConversions += parseInt(row.conversions) || 0;
  }

  const totalROI = totalCost > 0 ? ((totalProfit / totalCost) * 100).toFixed(1) : "N/A";

  let text = `💰 REVENUE REPORT (${preset})\n\n`;
  text += `Revenue: $${totalRevenue.toFixed(2)}\n`;
  text += `Cost: $${totalCost.toFixed(2)}\n`;
  text += `Profit: $${totalProfit.toFixed(2)}\n`;
  text += `Conversions: ${totalConversions}\n`;
  text += `ROI: ${totalROI}%\n`;
  text += `\n--- BY CAMPAIGN ---\n`;

  for (const row of sorted) {
    const rev = parseFloat(row.revenue) || 0;
    const profit = parseFloat(row.profit) || 0;
    const conversions = parseInt(row.conversions) || 0;
    const name = row.campaignName || row.campaignID || "Unknown";

    if (rev === 0 && conversions === 0) continue; // skip zero rows

    const profitIcon = profit >= 0 ? "🟢" : "🔴";
    text += `\n${profitIcon} ${name}\n`;
    text += `  Rev: $${rev.toFixed(2)} | Profit: $${profit.toFixed(2)} | Conv: ${conversions}`;
    if (row.cpa && parseFloat(row.cpa) > 0) text += ` | CPA: $${parseFloat(row.cpa).toFixed(2)}`;
    if (row.roas && parseFloat(row.roas) > 0) text += ` | ROAS: ${parseFloat(row.roas).toFixed(2)}x`;
    text += "\n";
  }

  return text;
}

/**
 * Format daily breakdown for trend view.
 */
function formatDailyTrend(reportData) {
  if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
    return "📊 No daily data available.";
  }

  const sorted = [...reportData].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  let text = "📈 DAILY TREND\n\n";
  text += "Date       | Rev      | Cost     | Profit   | Conv | ROI\n";
  text += "-----------|----------|----------|----------|------|------\n";

  for (const row of sorted) {
    const date = (row.date || "").slice(0, 10);
    const rev = (parseFloat(row.revenue) || 0).toFixed(2).padStart(8);
    const cost = (parseFloat(row.cost) || 0).toFixed(2).padStart(8);
    const profit = (parseFloat(row.profit) || 0).toFixed(2).padStart(8);
    const conv = (parseInt(row.conversions) || 0).toString().padStart(4);
    const roi = row.roi ? `${parseFloat(row.roi).toFixed(1)}%` : "N/A";
    text += `${date} | $${rev} | $${cost} | $${profit} | ${conv} | ${roi}\n`;
  }

  return text;
}

/**
 * Format for Claude enrichment — structured summary for AI analysis.
 */
function formatForClaude(reportData, preset = "today") {
  if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
    return `CLICKFLARE DATA (${preset}): No tracking data available.`;
  }

  let totalRevenue = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let totalConversions = 0;
  let totalClicks = 0;

  for (const row of reportData) {
    totalRevenue += parseFloat(row.revenue) || 0;
    totalCost += parseFloat(row.cost) || 0;
    totalProfit += parseFloat(row.profit) || 0;
    totalConversions += parseInt(row.conversions) || 0;
    totalClicks += parseInt(row.clicks) || 0;
  }

  let text = `--- CLICKFLARE TRACKING DATA (${preset}) ---\n`;
  text += `Total Revenue: $${totalRevenue.toFixed(2)}\n`;
  text += `Total Cost: $${totalCost.toFixed(2)}\n`;
  text += `Total Profit: $${totalProfit.toFixed(2)}\n`;
  text += `Total Conversions: ${totalConversions}\n`;
  text += `Total Clicks: ${totalClicks}\n`;
  text += `Overall ROI: ${totalCost > 0 ? ((totalProfit / totalCost) * 100).toFixed(1) : "N/A"}%\n\n`;

  text += "Campaign breakdown:\n";
  const sorted = [...reportData].sort((a, b) =>
    (parseFloat(b.revenue) || 0) - (parseFloat(a.revenue) || 0)
  );

  for (const row of sorted) {
    const rev = parseFloat(row.revenue) || 0;
    const conv = parseInt(row.conversions) || 0;
    if (rev === 0 && conv === 0) continue;

    const name = row.campaignName || row.offerName || row.trafficSourceName || row.date || row.campaignID || "Unknown";
    text += `• ${name}: $${rev.toFixed(2)} rev, $${(parseFloat(row.profit) || 0).toFixed(2)} profit, ${conv} conv`;
    if (row.cpa && parseFloat(row.cpa) > 0) text += `, $${parseFloat(row.cpa).toFixed(2)} CPA`;
    if (row.roas && parseFloat(row.roas) > 0) text += `, ${parseFloat(row.roas).toFixed(2)}x ROAS`;
    if (row.epc && parseFloat(row.epc) > 0) text += `, $${parseFloat(row.epc).toFixed(2)} EPC`;
    text += "\n";
  }

  return text;
}

function clearCache() {
  cache.clear();
}

module.exports = {
  isConfigured,
  getReport,
  getRevenueByCampaign,
  getRevenueByOffer,
  getDailyBreakdown,
  getRevenueBySource,
  listCampaigns,
  listOffers,
  getSettings,
  formatCampaignRevenue,
  formatDailyTrend,
  formatForClaude,
  clearCache,
};
