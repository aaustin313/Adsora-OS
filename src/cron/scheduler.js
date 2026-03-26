const cron = require("node-cron");
const { sendAlert, sendAlertChunked } = require("../telegram/notify");
const { isMetaPaused } = require("../meta/killSwitch");

function startCronJobs() {
  console.log("\u23F0 Cron scheduler starting...");

  // Hourly ad performance scan — every hour, 24/7, no quiet hours
  cron.schedule("0 * * * *", async () => {
    if (isMetaPaused()) {
      console.log("[CRON] Hourly ad scan SKIPPED — Meta kill switch active");
      return;
    }
    console.log("[CRON] Running hourly ad scan...");

    try {
      const { scanAllAccounts, formatAlertMessage } = require("../facebook/monitor");
      const result = await scanAllAccounts("today");

      if (result.error) {
        console.error(`[CRON] Scan error: ${result.error}`);
        return;
      }

      // Always send alerts — no quiet hours
      if (result.flagged.length > 0) {
        const alertMsg = formatAlertMessage(result.flagged);
        if (alertMsg) {
          await sendAlertChunked(alertMsg);
          console.log(`[CRON] Sent alert for ${result.flagged.length} flagged items`);
        }
      }

      console.log(`[CRON] Hourly scan done — $${result.totalSpend.toFixed(2)} total spend, ${result.flagged.length} flagged`);
    } catch (err) {
      console.error(`[CRON] Hourly scan failed: ${err.message}`);
    }
  });

  // Daily summary at 9:00 AM ET (14:00 UTC during EDT)
  cron.schedule("0 14 * * *", async () => {
    if (isMetaPaused()) {
      console.log("[CRON] Daily summary SKIPPED — Meta kill switch active");
      return;
    }
    console.log("[CRON] Running daily summary...");

    try {
      const { scanAllAccounts, formatDailySummary } = require("../facebook/monitor");
      const result = await scanAllAccounts("today");
      const summary = formatDailySummary(result);

      await sendAlertChunked(summary);
      console.log("[CRON] Daily summary sent");
    } catch (err) {
      console.error(`[CRON] Daily summary failed: ${err.message}`);
      await sendAlert(`\u26A0\uFE0F Daily summary failed: ${err.message?.slice(0, 100)}`);
    }
  });

  // Weekly report — Monday 9:00 AM ET (14:00 UTC)
  cron.schedule("0 14 * * 1", async () => {
    if (isMetaPaused()) {
      console.log("[CRON] Weekly report SKIPPED — Meta kill switch active");
      return;
    }
    console.log("[CRON] Running weekly report...");

    try {
      const { scanAllAccounts, formatDailySummary } = require("../facebook/monitor");
      const result = await scanAllAccounts("last_7d");
      const summary = `\u{1F4CA} WEEKLY REPORT\n\n` + formatDailySummary(result);

      await sendAlertChunked(summary);
      console.log("[CRON] Weekly report sent");
    } catch (err) {
      console.error(`[CRON] Weekly report failed: ${err.message}`);
      await sendAlert(`\u26A0\uFE0F Weekly report failed: ${err.message?.slice(0, 100)}`);
    }
  });

  // Spend Guard — every 30 minutes, 24/7
  cron.schedule("*/30 * * * *", async () => {
    if (isMetaPaused()) {
      console.log("[CRON] Spend guard SKIPPED — Meta kill switch active");
      return;
    }
    console.log("[CRON] Running spend guard scan...");

    try {
      const { runSpendGuard, formatSpendGuardAlert } = require("../monitors/spendGuard");
      const result = await runSpendGuard();

      if (result.issues.length > 0) {
        const alertMsg = formatSpendGuardAlert(result.issues);
        if (alertMsg) {
          await sendAlertChunked(alertMsg);
          console.log(`[CRON] Spend guard: sent alert for ${result.issues.length} issues`);
        }
      }

      console.log(`[CRON] Spend guard done — ${result.issues.length} issues`);
    } catch (err) {
      console.error(`[CRON] Spend guard failed: ${err.message}`);
      await sendAlert(`⚠️ Spend Guard failed: ${err.message?.slice(0, 100)}`);
    }
  });

  if (isMetaPaused()) {
    console.log("⏸️  Cron scheduler active — all Meta jobs will SKIP (kill switch ON)");
  } else {
    console.log("\u2705 Cron scheduler active:");
    console.log("   \u{1F50D} Hourly ad scan (24/7 — always alerts)");
    console.log("   \u{1F6E1}\u{FE0F}  Spend guard (every 30 min — tracking gaps, CTR crashes, low ROAS)");
    console.log("   \u{1F4CA} Daily summary (9am ET)");
    console.log("   \u{1F4CB} Weekly report (Monday 9am ET)");
  }
}

module.exports = { startCronJobs };
