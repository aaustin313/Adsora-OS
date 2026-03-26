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

// Google OAuth routes
const googleRoutes = require("./google/routes");
app.use(googleRoutes);

// --- Start everything ---
async function main() {
  // 1. Start Express server
  app.listen(PORT, () => {
    console.log(`🌐 Adsora OS server running on port ${PORT}`);
  });

  // 2. Start Telegram bot
  startTelegramBot();

  // 3. Start scheduled jobs (Meta jobs auto-skip via kill switch)
  startCronJobs();

  // 4. Check Google OAuth scopes
  const { needsReauth, getMissingScopes } = require("./google/auth");
  if (needsReauth()) {
    console.log(`⚠️  Google OAuth missing scopes: ${getMissingScopes().join(", ")}`);
    console.log(`   Visit http://localhost:${PORT}/auth/google to re-authorize`);
  } else {
    console.log("✅ Google OAuth — all scopes granted");
  }

  console.log("✅ Adsora OS is fully operational.");
}

main().catch((err) => {
  console.error("Fatal error starting Adsora OS:", err);
  process.exit(1);
});
