/**
 * Facebook Ads Auto-Monitor
 * Scans all active accounts at the AD SET level.
 * Flags based on per-account 7-day averages (not fixed thresholds).
 * Detects spend pacing spikes.
 */

const fb = require("./ads");
const config = require("./config");

// Cache last scan results for daily summary + pacing comparison
let lastScanResults = null;
let lastScanTime = 0;
// Per-account hourly spend snapshots for pacing detection
const spendHistory = new Map(); // accountId -> [{ time, spend }]

function getLastScan() {
  return { results: lastScanResults, time: lastScanTime };
}

// --- Conversion helpers ---

const CONVERSION_TYPES = [
  "lead", "onsite_conversion.lead_grouped",
  "purchase", "offsite_conversion.fb_pixel_purchase",
  "complete_registration", "offsite_conversion.fb_pixel_complete_registration",
  "submit_application", "offsite_conversion.fb_pixel_lead",
];

function countConversions(insightData) {
  let total = 0;
  for (const type of CONVERSION_TYPES) {
    const action = insightData.actions?.find(a => a.action_type === type);
    if (action) total += parseInt(action.value);
  }
  return total;
}

function getConversionLabel(insightData) {
  // Return what type of conversion this account tracks
  for (const type of CONVERSION_TYPES) {
    const action = insightData.actions?.find(a => a.action_type === type);
    if (action) {
      if (type.includes("purchase")) return "purchases";
      if (type.includes("lead")) return "leads";
      if (type.includes("registration")) return "registrations";
      if (type.includes("application")) return "applications";
    }
  }
  return "conversions";
}

// --- Pacing detection ---

function recordSpendSnapshot(accountId, spend) {
  if (!spendHistory.has(accountId)) {
    spendHistory.set(accountId, []);
  }
  const history = spendHistory.get(accountId);
  history.push({ time: Date.now(), spend });

  // Keep last 24 hours of snapshots
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const filtered = history.filter(h => h.time > cutoff);
  spendHistory.set(accountId, filtered);
}

function detectPacingSpike(accountId, currentSpend) {
  const history = spendHistory.get(accountId);
  if (!history || history.length < 2) return null;

  // Get the last snapshot (previous hour)
  const prev = history[history.length - 1]; // most recent before this one
  const hourlySpend = currentSpend - prev.spend;

  if (hourlySpend <= 0) return null;

  // Calculate average hourly spend from history
  const oldest = history[0];
  const totalHours = (Date.now() - oldest.time) / (60 * 60 * 1000);
  if (totalHours < 1) return null;

  const avgHourlySpend = (currentSpend - oldest.spend) / totalHours;
  if (avgHourlySpend <= 0) return null;

  const pacingMultiplier = hourlySpend / avgHourlySpend;

  if (pacingMultiplier >= config.PACING_SPIKE_MULTIPLIER && currentSpend >= config.PACING_MIN_SPEND) {
    return {
      hourlySpend,
      avgHourlySpend,
      multiplier: pacingMultiplier,
    };
  }

  return null;
}

// --- Main scan ---

async function scanAllAccounts(datePreset = "today") {
  if (!fb.isConfigured()) {
    return { error: "Facebook Ads not configured", accounts: [], flagged: [] };
  }

  console.log(`[MONITOR] Starting scan (${datePreset})...`);
  const startTime = Date.now();

  // 1. Get all accounts
  let accounts;
  try {
    accounts = await fb.listAllAdAccounts();
  } catch (err) {
    console.error(`[MONITOR] Failed to list accounts: ${err.message}`);
    return { error: err.message, accounts: [], flagged: [] };
  }

  const activeAccounts = accounts.filter(a => a.account_status === 1);
  console.log(`[MONITOR] ${activeAccounts.length} active accounts out of ${accounts.length} total`);

  // 2. Fetch TODAY's insights for all active accounts (parallel)
  const todayInsightsMap = await fb.getMultiAccountInsights(
    activeAccounts, datePreset, config.BATCH_SIZE, config.TIMEOUT_PER_ACCOUNT_MS
  );

  // 3. Also fetch LAST 7 DAYS insights for baseline averages
  const weekInsightsMap = datePreset !== "last_7d"
    ? await fb.getMultiAccountInsights(activeAccounts, "last_7d", config.BATCH_SIZE, config.TIMEOUT_PER_ACCOUNT_MS)
    : todayInsightsMap;

  // 4. Process each account
  const accountsWithSpend = [];
  const allFlagged = [];

  for (const acct of activeAccounts) {
    const todayData = todayInsightsMap.get(acct.id);
    if (!todayData?.data?.length) continue;

    const td = todayData.data[0];
    const todaySpend = parseFloat(td.spend || 0);
    if (todaySpend <= 0) continue;

    accountsWithSpend.push({
      id: acct.id,
      name: acct.name,
      spend: todaySpend,
      data: td,
    });

    // Record spend snapshot for pacing detection
    recordSpendSnapshot(acct.id, todaySpend);

    // Calculate 7-day baseline for this account
    const weekData = weekInsightsMap.get(acct.id);
    let weekAvgCPR = null; // average cost per result over 7 days
    let convLabel = "conversions";

    if (weekData?.data?.length) {
      const wd = weekData.data[0];
      const weekSpend = parseFloat(wd.spend || 0);
      const weekConversions = countConversions(wd);
      convLabel = getConversionLabel(wd);
      if (weekConversions > 0 && weekSpend > 0) {
        weekAvgCPR = weekSpend / weekConversions;
      }
    }

    // Check account-level pacing spike
    const pacingSpike = detectPacingSpike(acct.id, todaySpend);
    const todayConversions = countConversions(td);

    if (pacingSpike && todayConversions === 0) {
      allFlagged.push({
        accountId: acct.id,
        accountName: acct.name,
        adSetId: null,
        adSetName: null,
        campaignId: null,
        campaignName: null,
        flags: [{
          type: "PACING_SPIKE",
          severity: "critical",
          message: `Pacing spike ${pacingSpike.multiplier.toFixed(1)}x ($${pacingSpike.hourlySpend.toFixed(0)}/hr vs avg $${pacingSpike.avgHourlySpend.toFixed(0)}/hr) — $${todaySpend.toFixed(2)} spent, ZERO ${convLabel}`,
          recommendation: `Check ad sets immediately — spend accelerating with no results`,
        }],
      });
    }

    // 5. Drill into AD SET level for this account
    try {
      const adSetsResult = await fb.getAccountAdSets(acct.id);
      if (!adSetsResult?.data?.length) continue;

      const activeAdSets = adSetsResult.data.filter(as => as.status === "ACTIVE");
      if (activeAdSets.length === 0) continue;

      // Fetch today's insights for each active ad set
      const adSetIds = activeAdSets.map(as => as.id);
      const adSetInsights = await fb.getAdSetInsightsBatch(adSetIds, datePreset);

      // Also fetch 7-day insights for ad set baseline
      const adSetWeekInsights = datePreset !== "last_7d"
        ? await fb.getAdSetInsightsBatch(adSetIds, "last_7d")
        : adSetInsights;

      for (const adSet of activeAdSets) {
        const asInsights = adSetInsights.get(adSet.id);
        if (!asInsights?.data?.length) continue;

        const asd = asInsights.data[0];
        const asSpend = parseFloat(asd.spend || 0);
        if (asSpend <= 0) continue;

        const asConversions = countConversions(asd);
        const asConvLabel = getConversionLabel(asd) || convLabel;

        // Calculate this ad set's 7-day average CPR
        let adSetAvgCPR = null;
        const asWeek = adSetWeekInsights.get(adSet.id);
        if (asWeek?.data?.length) {
          const aswd = asWeek.data[0];
          const weekSpend = parseFloat(aswd.spend || 0);
          const weekConv = countConversions(aswd);
          if (weekConv > 0 && weekSpend > 0) {
            adSetAvgCPR = weekSpend / weekConv;
          }
        }

        // Use ad set average first, fall back to account average
        const baselineCPR = adSetAvgCPR || weekAvgCPR;

        const flags = evaluateAdSet({
          spend: asSpend,
          conversions: asConversions,
          convLabel: asConvLabel,
          baselineCPR,
          todaySpend: todaySpend,
          insightData: asd,
        });

        if (flags.length > 0) {
          allFlagged.push({
            accountId: acct.id,
            accountName: acct.name,
            adSetId: adSet.id,
            adSetName: adSet.name || asd.adset_name,
            campaignId: adSet.campaign_id,
            campaignName: null,
            flags,
          });
        }
      }
    } catch (err) {
      console.log(`[MONITOR] Error scanning ad sets for ${acct.name}: ${err.message?.slice(0, 80)}`);
    }
  }

  accountsWithSpend.sort((a, b) => b.spend - a.spend);

  const result = {
    timestamp: new Date().toISOString(),
    datePreset,
    totalAccounts: accounts.length,
    activeAccounts: activeAccounts.length,
    accountsWithSpend: accountsWithSpend.length,
    totalSpend: accountsWithSpend.reduce((sum, a) => sum + a.spend, 0),
    accounts: accountsWithSpend,
    flagged: allFlagged,
    durationMs: Date.now() - startTime,
  };

  lastScanResults = result;
  lastScanTime = Date.now();

  console.log(`[MONITOR] Scan complete in ${result.durationMs}ms — ${accountsWithSpend.length} accounts spending, ${allFlagged.length} flagged`);
  return result;
}

// --- Ad set performance evaluation ---

function evaluateAdSet({ spend, conversions, convLabel, baselineCPR, insightData }) {
  const flags = [];

  // Rule 1: Zero conversions after $100+ spend
  if (spend >= config.MIN_SPEND_FOR_ZERO_CONV && conversions === 0) {
    flags.push({
      type: "ZERO_CONVERSIONS",
      severity: "critical",
      message: `$${spend.toFixed(2)} spent with ZERO ${convLabel}`,
      recommendation: `PAUSE this ad set — burning money with no results`,
    });
    return flags; // no point checking CPR if zero conversions
  }

  // Rule 2: CPR significantly above the 7-day average for this account
  if (conversions > 0 && baselineCPR) {
    const currentCPR = spend / conversions;
    const ratio = currentCPR / baselineCPR;

    if (ratio >= 2.0) {
      flags.push({
        type: "HIGH_CPR",
        severity: ratio >= 3.0 ? "critical" : "warning",
        message: `Cost per ${convLabel.slice(0, -1)}: $${currentCPR.toFixed(2)} (${ratio.toFixed(1)}x the 7-day avg of $${baselineCPR.toFixed(2)})`,
        recommendation: ratio >= 3.0
          ? `3x+ above average — consider pausing this ad set`
          : `2x above average — monitor closely, reduce budget if it doesn't improve`,
      });
    }
  }

  return flags;
}

// --- Alert formatting ---

function formatAlertMessage(flaggedItems) {
  if (flaggedItems.length === 0) return null;

  // Sort: critical first, then warning
  const sorted = [...flaggedItems].sort((a, b) => {
    const sevOrder = { critical: 0, warning: 1 };
    const aMax = Math.min(...a.flags.map(f => sevOrder[f.severity] ?? 2));
    const bMax = Math.min(...b.flags.map(f => sevOrder[f.severity] ?? 2));
    return aMax - bMax;
  });

  const critical = sorted.filter(f => f.flags.some(fl => fl.severity === "critical"));
  const warnings = sorted.filter(f => f.flags.every(fl => fl.severity === "warning"));

  let msg = "";

  if (critical.length > 0) {
    msg += `\u{1F6A8} CRITICAL (${critical.length}):\n\n`;
    for (const item of critical) {
      msg += `\u{274C} ${item.accountName}\n`;
      if (item.adSetName) msg += `   Ad Set: ${item.adSetName}\n`;
      if (item.adSetId) msg += `   Ad Set ID: ${item.adSetId}\n`;
      if (item.campaignId) msg += `   Campaign ID: ${item.campaignId}\n`;
      for (const flag of item.flags) {
        msg += `   ${flag.message}\n`;
        msg += `   \u{27A1}\u{FE0F} ${flag.recommendation}\n`;
      }
      if (item.adSetId) {
        msg += `   /pause ${item.adSetId}\n`;
      } else if (item.campaignId) {
        msg += `   /pause ${item.campaignId}\n`;
      }
      msg += "\n";
    }
  }

  if (warnings.length > 0) {
    msg += `\u{26A0}\u{FE0F} WARNINGS (${warnings.length}):\n\n`;
    for (const item of warnings.slice(0, 10)) {
      msg += `\u{1F7E1} ${item.accountName}`;
      if (item.adSetName) msg += ` \u2014 ${item.adSetName}`;
      msg += "\n";
      if (item.adSetId) msg += `   Ad Set ID: ${item.adSetId}\n`;
      for (const flag of item.flags) {
        msg += `   ${flag.message}\n`;
      }
      msg += "\n";
    }
    if (warnings.length > 10) {
      msg += `... and ${warnings.length - 10} more warnings\n\n`;
    }
  }

  return msg;
}

function formatDailySummary(scanResult) {
  if (!scanResult) return "No scan data available. Run /monitor to trigger a scan.";

  const { totalSpend, accounts, flagged, activeAccounts, accountsWithSpend, datePreset } = scanResult;

  let msg = `\u{1F4CA} DAILY AD SUMMARY\n`;
  msg += `\u{1F4C5} ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}\n\n`;
  msg += `\u{1F4B0} Total Spend: $${totalSpend.toFixed(2)}\n`;
  msg += `\u{1F4CB} Active Accounts: ${accountsWithSpend} spending / ${activeAccounts} active\n`;
  msg += `\u{1F6A8} Flagged: ${flagged.length} issue${flagged.length !== 1 ? "s" : ""}\n\n`;

  // Top 5 spenders with conversion data
  if (accounts.length > 0) {
    msg += `\u{1F3C6} TOP SPENDERS:\n`;
    for (const acct of accounts.slice(0, 5)) {
      const d = acct.data;
      let line = `  ${acct.name}: $${acct.spend.toFixed(2)}`;

      const conversions = countConversions(d);
      const label = getConversionLabel(d);
      if (conversions > 0) {
        const cpr = (acct.spend / conversions).toFixed(2);
        line += ` | ${conversions} ${label} ($${cpr}/${label.slice(0, -1)})`;
      } else {
        line += ` | ${parseInt(d.clicks || 0)} clicks, 0 ${label}`;
      }

      msg += line + "\n";
    }
    msg += "\n";
  }

  // Flagged issues summary
  if (flagged.length > 0) {
    const critical = flagged.filter(f => f.flags.some(fl => fl.severity === "critical"));
    const warnings = flagged.filter(f => f.flags.every(fl => fl.severity === "warning"));
    msg += `\u{26A0}\u{FE0F} ISSUES:\n`;
    if (critical.length > 0) msg += `  \u{1F534} ${critical.length} critical (zero conversions / pacing spikes)\n`;
    if (warnings.length > 0) msg += `  \u{1F7E1} ${warnings.length} warnings (high cost per result vs 7-day avg)\n`;
    msg += `  Use /monitor for full details\n\n`;
  }

  msg += `\u{23F1} Scan took ${(scanResult.durationMs / 1000).toFixed(1)}s`;
  return msg;
}

module.exports = {
  scanAllAccounts,
  evaluateAdSet,
  formatAlertMessage,
  formatDailySummary,
  getLastScan,
};
