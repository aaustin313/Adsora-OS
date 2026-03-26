/**
 * Standalone Telegram notification sender.
 * Uses raw fetch to Telegram Bot API — no dependency on bot.js or grammY.
 * Used by cron jobs, monitors, and any module that needs to alert Austin.
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_OWNER_ID || process.env.TELEGRAM_CHAT_ID;

async function sendAlert(text, options = {}) {
  if (!TOKEN || !CHAT_ID) {
    console.warn("[NOTIFY] Telegram not configured — skipping alert");
    return null;
  }

  const chatId = options.chatId || CHAT_ID;

  // Telegram message limit is 4096 chars — truncate if needed
  const truncated = text.length > 4000
    ? text.slice(0, 3990) + "\n\n... (truncated)"
    : text;

  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: truncated,
        parse_mode: options.parseMode || undefined,
        disable_notification: options.silent || false,
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error(`[NOTIFY] Telegram error: ${data.description}`);
      return null;
    }
    return data.result;
  } catch (err) {
    console.error(`[NOTIFY] Failed to send Telegram alert: ${err.message}`);
    return null;
  }
}

async function sendAlertChunked(text, options = {}) {
  if (text.length <= 4000) {
    return sendAlert(text, options);
  }

  // Split into chunks at newline boundaries
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= 4000) {
      chunks.push(remaining);
      break;
    }
    let splitIdx = remaining.lastIndexOf("\n", 4000);
    if (splitIdx < 2000) splitIdx = 4000;
    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).trimStart();
  }

  for (const chunk of chunks) {
    await sendAlert(chunk, options);
  }
}

/**
 * Send a launch notification to Telegram summarizing what was launched.
 * @param {Array} results - Array of { success, accountName, accountId, adId, adSetId, campaignName, ... }
 * @param {object} options - { mediaType: "photo"|"video"|"image", status: "ACTIVE"|"PAUSED" }
 */
async function sendLaunchNotification(results, options = {}) {
  const successes = results.filter(r => r.success);
  if (successes.length === 0) return null;

  const status = options.status || "ACTIVE";
  const mediaType = options.mediaType || "ad";

  let msg = `🚀 AD LAUNCH COMPLETE\n\n`;
  msg += `${successes.length} ${mediaType} ${successes.length === 1 ? "ad" : "ads"} launched (${status})\n\n`;

  for (const s of successes) {
    const acctId = (s.accountId || "").replace("act_", "");
    const adSetUrl = s.adSetId
      ? `https://www.facebook.com/adsmanager/manage/ads?act=${acctId}&selected_adset_ids=${s.adSetId}`
      : null;

    msg += `📍 ${s.accountName || "Unknown Account"}\n`;
    if (s.campaignName) msg += `   Campaign: ${s.campaignName}\n`;
    if (s.angle) msg += `   Angle: ${s.angle}\n`;
    msg += `   Ad ID: ${s.adId}\n`;
    if (s.adSetId) msg += `   Ad Set: ${s.adSetId}\n`;
    if (adSetUrl) msg += `   ${adSetUrl}\n`;
    msg += `\n`;
  }

  return sendAlert(msg);
}

/**
 * Send a launch failure notification with retry info.
 * @param {Array} failures - Array of { accountName, accountId, error, ... }
 * @param {object} options - { reason, retryAt, adSetLimit }
 */
async function sendLaunchFailureNotification(failures, options = {}) {
  if (!failures || failures.length === 0) return null;

  let msg = `⚠️ AD LAUNCH ISSUE\n\n`;
  msg += `${failures.length} ${failures.length === 1 ? "ad" : "ads"} could not be launched\n\n`;

  for (const f of failures) {
    msg += `❌ ${f.accountName || "Unknown Account"}\n`;
    if (f.angle) msg += `   Angle: ${f.angle}\n`;
    if (f.creativeName) msg += `   Creative: ${f.creativeName}\n`;
    msg += `   Reason: ${f.error || "Unknown error"}\n`;

    // Detect rate limit / ad set limit issues and add context
    const err = (f.error || "").toLowerCase();
    if (err.includes("rate limit") || err.includes("too many calls")) {
      msg += `   ⏳ Hit API rate limit — will retry automatically\n`;
    }
    if (err.includes("limit") && err.includes("ad")) {
      msg += `   📊 Ad set at 50-ad capacity limit\n`;
    }
    msg += `\n`;
  }

  if (options.reason) {
    msg += `Reason: ${options.reason}\n`;
  }
  if (options.adSetLimit) {
    msg += `📊 Ad set limit: ${options.adSetLimit} ads max per ad set\n`;
  }
  if (options.retryAt) {
    msg += `🔄 Retry scheduled: ${options.retryAt}\n`;
  }

  return sendAlert(msg);
}

module.exports = { sendAlert, sendAlertChunked, sendLaunchNotification, sendLaunchFailureNotification };
