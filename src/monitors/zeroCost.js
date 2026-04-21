/**
 * Zero Cost Monitor
 * Checks ClickFlare traffic sources for $0 cost (active traffic but no cost tracking).
 * Alerts to Slack #alerts channel when found.
 */

const clickflare = require("../clickflare/client");
const { sendMessage, listChannels, isSlackConnected } = require("../slack/client");

// Cache the #alerts channel ID so we don't look it up every run
let alertsChannelId = null;

async function getAlertsChannelId() {
  if (alertsChannelId) return alertsChannelId;

  const channels = await listChannels();
  const alertsCh = channels.find((ch) => ch.name === "alerts");
  if (!alertsCh) {
    throw new Error("Slack #alerts channel not found. Create it or invite the bot.");
  }

  alertsChannelId = alertsCh.id;
  return alertsChannelId;
}

/**
 * Check traffic sources for zero cost with active traffic.
 * Returns { issues: [...], checked: number }
 */
async function checkZeroCostSources() {
  const sources = await clickflare.getRevenueBySource("today");

  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return { issues: [], checked: 0 };
  }

  const issues = [];

  for (const src of sources) {
    const visits = parseInt(src.visits) || 0;
    const clicks = parseInt(src.clicks) || 0;
    const cost = parseFloat(src.cost) || 0;
    const revenue = parseFloat(src.revenue) || 0;
    const name = src.trafficSourceName || src.trafficSourceID || "Unknown";

    // Flag: has traffic (visits or clicks) but zero cost
    if ((visits > 0 || clicks > 0) && cost === 0) {
      issues.push({
        name,
        id: src.trafficSourceID,
        visits,
        clicks,
        conversions: parseInt(src.conversions) || 0,
        revenue,
        cost,
      });
    }
  }

  return { issues, checked: sources.length };
}

/**
 * Format the alert message for Slack.
 */
function formatZeroCostAlert(issues) {
  const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

  let text = `:warning: *Zero Cost Alert* — ${now}\n\n`;
  text += `${issues.length} traffic source${issues.length > 1 ? "s" : ""} with active traffic but *$0 cost*:\n\n`;

  for (const src of issues) {
    text += `:red_circle: *${src.name}*\n`;
    text += `    Visits: ${src.visits} | Clicks: ${src.clicks} | Conversions: ${src.conversions}\n`;
    text += `    Revenue: $${src.revenue.toFixed(2)} | Cost: $0.00\n\n`;
  }

  text += `_Check ClickFlare cost tracking for these sources._`;
  return text;
}

/**
 * Run the full check and send Slack alert if issues found.
 */
async function runZeroCostMonitor() {
  if (!clickflare.isConfigured()) {
    console.log("[ZERO-COST] ClickFlare not configured, skipping");
    return { issues: [], checked: 0, alerted: false };
  }

  if (!isSlackConnected()) {
    console.log("[ZERO-COST] Slack not connected, skipping");
    return { issues: [], checked: 0, alerted: false };
  }

  const { issues, checked } = await checkZeroCostSources();

  if (issues.length > 0) {
    const channelId = await getAlertsChannelId();
    const message = formatZeroCostAlert(issues);
    await sendMessage(channelId, message);
    console.log(`[ZERO-COST] Alerted ${issues.length} zero-cost sources to #alerts`);
    return { issues, checked, alerted: true };
  }

  console.log(`[ZERO-COST] All clear — ${checked} sources checked, all have cost`);
  return { issues, checked, alerted: false };
}

module.exports = { runZeroCostMonitor, checkZeroCostSources, formatZeroCostAlert };
