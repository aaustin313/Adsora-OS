require("dotenv").config();

const express = require("express");
const { startTelegramBot } = require("./telegram/bot");
const { startCronJobs } = require("./cron/scheduler");

const PORT = process.env.PORT || 3000;

// --- Express server (health checks + future API routes) ---
const app = express();
app.use(express.json());

// Health check endpoint (Railway uses this to know the app is alive)
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Adsora OS",
    uptime: Math.floor(process.uptime()),
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

// --- Start everything ---
async function main() {
  // 1. Start Express server
  app.listen(PORT, () => {
    console.log(`🌐 Adsora OS server running on port ${PORT}`);
  });

  // 2. Start Telegram bot
  startTelegramBot();

  // 3. Start scheduled jobs
  startCronJobs();

  console.log("✅ Adsora OS is fully operational.");
}

main().catch((err) => {
  console.error("Fatal error starting Adsora OS:", err);
  process.exit(1);
});
