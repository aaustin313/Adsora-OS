const cron = require("node-cron");

function startCronJobs() {
  console.log("⏰ Cron scheduler starting...");

  // Daily morning summary — 8:00 AM EST (13:00 UTC)
  // Uncomment when Facebook Ads integration is live
  // cron.schedule("0 13 * * *", async () => {
  //   console.log("Running daily morning summary...");
  //   // TODO: Pull yesterday's spend, leads, CPL from Facebook
  //   // TODO: Send summary via Telegram
  // });

  // Hourly spend check — every hour during business hours
  // Uncomment when Facebook Ads integration is live
  // cron.schedule("0 13-1 * * 1-5", async () => {
  //   console.log("Running hourly spend check...");
  //   // TODO: Check spend pacing, flag overspend
  //   // TODO: Alert via Telegram if anomaly detected
  // });

  // Weekly report — Monday 9:00 AM EST (14:00 UTC)
  // Uncomment when Facebook Ads + Beehiiv integrations are live
  // cron.schedule("0 14 * * 1", async () => {
  //   console.log("Running weekly report...");
  //   // TODO: Generate full weekly report
  //   // TODO: Send via Telegram
  // });

  console.log("✅ Cron scheduler ready (jobs will activate as integrations come online)");
}

module.exports = { startCronJobs };
