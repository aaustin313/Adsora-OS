const { Router } = require("express");
const { getAuthUrl, handleCallback, isAuthenticated, validateState, needsReauth, getMissingScopes } = require("./auth");

const router = Router();

// Only allow auth routes from localhost in production
router.use("/auth", (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const isLocal = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
  if (!isLocal && process.env.NODE_ENV === "production") {
    return res.status(403).send("Forbidden");
  }
  next();
});

router.get("/auth/google", (req, res) => {
  const url = getAuthUrl();
  if (!url) {
    return res.status(500).send("Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env");
  }
  res.redirect(url);
});

router.get("/auth/callback", async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  if (!code) {
    return res.status(400).send("Missing authorization code");
  }

  if (!validateState(state)) {
    return res.status(403).send("Invalid OAuth state. Please try again from /auth/google");
  }

  try {
    await handleCallback(code);
    res.send("Google connected successfully! You can close this window and go back to Telegram.");
  } catch (error) {
    console.error("Google OAuth callback error:", error.message);
    res.status(500).send("Failed to connect Google. Please try again.");
  }
});

router.get("/auth/status", (req, res) => {
  const missing = getMissingScopes();
  res.json({
    google: isAuthenticated(),
    needsReauth: missing.length > 0,
    missingScopes: missing,
  });
});

module.exports = router;
