// Meta Kill Switch — global pause for all Meta/Facebook automations
// Toggled via Telegram: /meta stop | /meta start

let metaPaused = true; // DEFAULT PAUSED — Austin requested all Meta automations stopped (2026-03-24)
let pausedAt = null;
let pausedBy = "system";

function pauseMeta(reason = "manual") {
  metaPaused = true;
  pausedAt = new Date();
  pausedBy = reason;
  console.log(`[META KILL SWITCH] ⛔ All Meta operations PAUSED at ${pausedAt.toISOString()} — reason: ${reason}`);
}

function resumeMeta() {
  const wasPausedAt = pausedAt;
  metaPaused = false;
  pausedAt = null;
  pausedBy = null;
  console.log(`[META KILL SWITCH] ✅ Meta operations RESUMED (was paused since ${wasPausedAt?.toISOString() || "unknown"})`);
}

function isMetaPaused() {
  return metaPaused;
}

function getStatus() {
  if (!metaPaused) return { paused: false };
  return {
    paused: true,
    pausedAt,
    pausedBy,
    duration: pausedAt ? Math.round((Date.now() - pausedAt.getTime()) / 1000 / 60) : 0, // minutes
  };
}

module.exports = { pauseMeta, resumeMeta, isMetaPaused, getStatus };
