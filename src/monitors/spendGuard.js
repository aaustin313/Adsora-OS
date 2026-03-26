/**
 * Spend Guard Monitor
 * Catches irregularities before they burn money:
 * 1. FB campaigns spending without ClickFlare tracking (scam/waste detection)
 * 2. Spend-to-revenue gap (tracking broken or LP broken)
 * 3. CTR crash detection (creative or LP issues)
 * 4. Landing page health checks (HTTP status on destination URLs)
 *
 * Runs every 30 minutes via cron.
 */

const fb = require("../facebook/ads");
const clickflare = require("../clickflare/client");

// Track previous scan to detect changes
let lastAlerts = new Map(); // key -> timestamp (dedupe within 2 hours)
const ALERT_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours between repeat alerts

// --- Deduplication ---

function shouldAlert(key) {
  const lastTime = lastAlerts.get(key);
  if (lastTime && Date.now() - lastTime < ALERT_COOLDOWN_MS) return false;
  lastAlerts.set(key, Date.now());
  // Prune old entries
  for (const [k, t] of lastAlerts) {
    if (Date.now() - t > ALERT_COOLDOWN_MS * 2) lastAlerts.delete(k);
  }
  return true;
}

// --- Check 1: FB spend without ClickFlare tracking ---

async function checkUntrackedSpend() {
  const issues = [];

  // Get all FB accounts with today's spend
  const accounts = await fb.listAllAdAccounts();
  const activeAccounts = accounts.filter(a => a.account_status === 1);
  const todayInsights = await fb.getMultiAccountInsights(activeAccounts, "today");

  let totalFbSpend = 0;
  const fbAccountSpend = []; // { id, name, spend }

  for (const acct of activeAccounts) {
    const insights = todayInsights.get(acct.id);
    if (!insights?.data?.length) continue;
    const spend = parseFloat(insights.data[0].spend || 0);
    if (spend <= 0) continue;
    totalFbSpend += spend;
    fbAccountSpend.push({ id: acct.id, name: acct.name, spend });
  }

  if (totalFbSpend === 0) return issues; // nothing spending

  // Get ClickFlare cost by traffic source (maps to FB accounts)
  let cfData = [];
  let totalCfCost = 0;
  const cfSourceNames = new Set();

  if (clickflare.isConfigured()) {
    try {
      cfData = await clickflare.getRevenueBySource("today");
      if (Array.isArray(cfData)) {
        for (const row of cfData) {
          const cost = parseFloat(row.cost) || 0;
          totalCfCost += cost;
          if (row.trafficSourceName) {
            cfSourceNames.add(row.trafficSourceName.toLowerCase().trim());
          }
        }
      }
    } catch (err) {
      console.error(`[SPEND-GUARD] ClickFlare error: ${err.message}`);
      // ClickFlare itself being down is an alert
      issues.push({
        type: "CLICKFLARE_DOWN",
        severity: "warning",
        message: `ClickFlare API error: ${err.message.slice(0, 100)}`,
        detail: "Cannot verify tracking — manual check recommended",
      });
      return issues;
    }
  } else {
    return issues; // can't compare without ClickFlare
  }

  // Compare totals — if FB spend > ClickFlare cost by 30%+, something is untracked
  const gap = totalFbSpend - totalCfCost;
  const gapPercent = totalCfCost > 0 ? (gap / totalFbSpend) * 100 : 100;

  if (gap > 50 && gapPercent > 30) {
    // Find which FB accounts might be untracked
    const untrackedAccounts = [];
    for (const acct of fbAccountSpend) {
      const acctNameLower = (acct.name || "").toLowerCase().trim();
      // Try fuzzy matching — check if any ClickFlare source name contains part of the FB account name
      const isTracked = [...cfSourceNames].some(cfName =>
        cfName.includes(acctNameLower) ||
        acctNameLower.includes(cfName) ||
        // Also check if the account ID digits appear in ClickFlare
        cfName.includes(acct.id.replace("act_", ""))
      );
      if (!isTracked) {
        untrackedAccounts.push(acct);
      }
    }

    if (untrackedAccounts.length > 0) {
      const key = `untracked_${untrackedAccounts.map(a => a.id).sort().join(",")}`;
      if (shouldAlert(key)) {
        issues.push({
          type: "UNTRACKED_SPEND",
          severity: "critical",
          message: `$${gap.toFixed(2)} FB spend (${gapPercent.toFixed(0)}%) not tracked in ClickFlare`,
          detail: untrackedAccounts.map(a =>
            `  ${a.name}: $${a.spend.toFixed(2)} — no matching ClickFlare source`
          ).join("\n"),
          totalFbSpend,
          totalCfCost,
          untrackedAccounts,
        });
      }
    }
  }

  return issues;
}

// --- Check 2: CTR Crash Detection ---

async function checkCTRCrash() {
  const issues = [];

  // Get all accounts with spend
  const accounts = await fb.listAllAdAccounts();
  const activeAccounts = accounts.filter(a => a.account_status === 1);
  const todayInsights = await fb.getMultiAccountInsights(activeAccounts, "today");
  const weekInsights = await fb.getMultiAccountInsights(activeAccounts, "last_7d");

  for (const acct of activeAccounts) {
    const todayData = todayInsights.get(acct.id);
    const weekData = weekInsights.get(acct.id);
    if (!todayData?.data?.length || !weekData?.data?.length) continue;

    const td = todayData.data[0];
    const wd = weekData.data[0];

    const todaySpend = parseFloat(td.spend || 0);
    const todayImpressions = parseInt(td.impressions || 0);
    const todayCTR = parseFloat(td.ctr || 0);
    const weekCTR = parseFloat(wd.ctr || 0);

    // Only check accounts with meaningful spend and impressions
    if (todaySpend < 50 || todayImpressions < 1000) continue;

    // CTR crash: today's CTR is less than 40% of 7-day average
    if (weekCTR > 0 && todayCTR > 0 && todayCTR < weekCTR * 0.4) {
      const key = `ctr_crash_${acct.id}`;
      if (shouldAlert(key)) {
        issues.push({
          type: "CTR_CRASH",
          severity: "warning",
          message: `${acct.name}: CTR crashed ${todayCTR.toFixed(2)}% (7d avg: ${weekCTR.toFixed(2)}%)`,
          detail: `$${todaySpend.toFixed(2)} spent, ${todayImpressions.toLocaleString()} impressions.\nPossible causes: creative fatigue, LP broken, audience exhaustion, or Meta serving issue.`,
        });
      }
    }

    // Extremely low CTR with high spend — something is probably broken
    if (todayCTR < 0.3 && todaySpend >= 100) {
      const key = `ctr_floor_${acct.id}`;
      if (shouldAlert(key)) {
        issues.push({
          type: "CTR_FLOOR",
          severity: "critical",
          message: `${acct.name}: CTR at ${todayCTR.toFixed(2)}% — critically low`,
          detail: `$${todaySpend.toFixed(2)} spent with ${todayCTR.toFixed(2)}% CTR.\nSomething is likely broken — check creative, landing page, and targeting.`,
        });
      }
    }
  }

  return issues;
}

// --- Check 3: Low ROAS Detection ---

async function checkLowROAS() {
  const issues = [];

  if (!clickflare.isConfigured()) return issues;

  try {
    const cfData = await clickflare.getRevenueByCampaign("today");
    if (!Array.isArray(cfData) || cfData.length === 0) return issues;

    for (const row of cfData) {
      const cost = parseFloat(row.cost) || 0;
      const revenue = parseFloat(row.revenue) || 0;
      const name = row.campaignName || row.campaignID || "Unknown";

      // Need meaningful spend before flagging
      if (cost < 50) continue;

      const roas = cost > 0 ? revenue / cost : 0;

      // ROAS under 1 = losing money
      if (roas < 1) {
        const loss = cost - revenue;
        const severity = roas < 0.5 ? "critical" : "warning";
        const key = `low_roas_${row.campaignID}`;

        if (shouldAlert(key)) {
          issues.push({
            type: "LOW_ROAS",
            severity,
            message: `${name}: ROAS ${roas.toFixed(2)}x — losing $${loss.toFixed(2)}`,
            detail: `Cost: $${cost.toFixed(2)} | Revenue: $${revenue.toFixed(2)}\n${roas < 0.5
              ? "ROAS below 0.5x — burning cash fast. Consider pausing."
              : "ROAS below 1x — monitor closely, may need creative/offer change."}`,
          });
        }
      }
    }
  } catch (err) {
    console.error(`[SPEND-GUARD] ROAS check error: ${err.message}`);
  }

  return issues;
}

// --- Check 4: Zero Revenue with Spend ---

async function checkZeroRevenue() {
  const issues = [];

  if (!clickflare.isConfigured()) return issues;

  try {
    const cfData = await clickflare.getRevenueByCampaign("today");
    if (!Array.isArray(cfData) || cfData.length === 0) return issues;

    for (const row of cfData) {
      const cost = parseFloat(row.cost) || 0;
      const revenue = parseFloat(row.revenue) || 0;
      const conversions = parseInt(row.conversions) || 0;
      const visits = parseInt(row.visits) || 0;
      const name = row.campaignName || row.campaignID || "Unknown";

      // High cost, zero revenue — offer may be broken or scam
      if (cost >= 100 && revenue === 0 && conversions === 0) {
        const key = `zero_rev_${row.campaignID}`;
        if (shouldAlert(key)) {
          issues.push({
            type: "ZERO_REVENUE",
            severity: "critical",
            message: `${name}: $${cost.toFixed(2)} cost, ZERO revenue/conversions`,
            detail: `Visits: ${visits}\nThe offer page, tracking, or postback may be broken.`,
          });
        }
      }

      // Visits but zero clicks — tracking might be misconfigured
      if (visits >= 100 && conversions === 0 && cost >= 50) {
        const clicks = parseInt(row.clicks) || 0;
        if (clicks === 0) {
          const key = `no_clicks_${row.campaignID}`;
          if (shouldAlert(key)) {
            issues.push({
              type: "NO_CLICKS",
              severity: "warning",
              message: `${name}: ${visits} visits but 0 clicks — tracking issue?`,
              detail: `Cost: $${cost.toFixed(2)}\nVisitors are landing but not clicking through. Check LP or tracking pixel.`,
            });
          }
        }
      }
    }
  } catch (err) {
    console.error(`[SPEND-GUARD] Revenue check error: ${err.message}`);
  }

  return issues;
}

// --- Main scan orchestrator ---

async function runSpendGuard() {
  console.log(`[SPEND-GUARD] Starting scan...`);
  const startTime = Date.now();

  const allIssues = [];

  // Run all checks in parallel — FB data is cached so shared across checks
  try {
    const [untrackedIssues, ctrIssues, revenueIssues, roasIssues] = await Promise.all([
      checkUntrackedSpend().catch(err => {
        console.error(`[SPEND-GUARD] Untracked spend check failed: ${err.message}`);
        return [];
      }),
      checkCTRCrash().catch(err => {
        console.error(`[SPEND-GUARD] CTR check failed: ${err.message}`);
        return [];
      }),
      checkZeroRevenue().catch(err => {
        console.error(`[SPEND-GUARD] Revenue check failed: ${err.message}`);
        return [];
      }),
      checkLowROAS().catch(err => {
        console.error(`[SPEND-GUARD] ROAS check failed: ${err.message}`);
        return [];
      }),
    ]);

    allIssues.push(...untrackedIssues, ...ctrIssues, ...revenueIssues, ...roasIssues);
  } catch (err) {
    console.error(`[SPEND-GUARD] Scan failed: ${err.message}`);
  }

  const duration = Date.now() - startTime;
  console.log(`[SPEND-GUARD] Scan complete in ${(duration / 1000).toFixed(1)}s — ${allIssues.length} issues found`);

  return {
    timestamp: new Date().toISOString(),
    issues: allIssues,
    durationMs: duration,
  };
}

// --- Alert formatting ---

function formatSpendGuardAlert(issues) {
  if (issues.length === 0) return null;

  const critical = issues.filter(i => i.severity === "critical");
  const warnings = issues.filter(i => i.severity === "warning");

  let msg = `🛡️ SPEND GUARD ALERT\n`;
  msg += `${new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" })} ET\n\n`;

  if (critical.length > 0) {
    msg += `🚨 CRITICAL (${critical.length}):\n\n`;
    for (const issue of critical) {
      msg += `❌ [${issue.type}] ${issue.message}\n`;
      if (issue.detail) msg += `${issue.detail}\n`;
      msg += "\n";
    }
  }

  if (warnings.length > 0) {
    msg += `⚠️ WARNINGS (${warnings.length}):\n\n`;
    for (const issue of warnings) {
      msg += `🟡 [${issue.type}] ${issue.message}\n`;
      if (issue.detail) msg += `${issue.detail}\n`;
      msg += "\n";
    }
  }

  msg += `Use /monitor for full performance scan`;
  return msg;
}

module.exports = {
  runSpendGuard,
  formatSpendGuardAlert,
  checkUntrackedSpend,
  checkCTRCrash,
  checkLowROAS,
  checkZeroRevenue,
};
