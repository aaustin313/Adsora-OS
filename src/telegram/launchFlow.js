/**
 * Telegram Launch Flow — Multi-step conversation for launching ads.
 * State machine that guides Austin through: creatives → accounts → best ad → confirm → launch.
 */

const launcher = require("../facebook/launcher");
const { listFolderMedia, downloadFileBuffer } = require("../google/drive");
const fb = require("../facebook/ads");
const { sendLaunchNotification, sendLaunchFailureNotification } = require("./notify");

// Active launch sessions (one per chat)
const sessions = new Map();
const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes

// --- Session management ---

function hasActiveSession(chatId) {
  const session = sessions.get(chatId);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    sessions.delete(chatId);
    return false;
  }
  return true;
}

function cancelSession(chatId) {
  sessions.delete(chatId);
}

function createSession(chatId) {
  const session = {
    state: "INIT",
    expiresAt: Date.now() + SESSION_TIMEOUT,
    // Data accumulated through the flow
    keyword: null,
    folderId: null,
    matchedAccounts: [],
    selectedAccounts: [],
    accountDetails: [], // { id, name, bestCampaign, bestAd }
    creatives: [], // { id, name, mimeType, size }
    creativeBuffers: [], // { name, buffer }
    launchResults: null,
  };
  sessions.set(chatId, session);
  return session;
}

function refreshExpiry(chatId) {
  const session = sessions.get(chatId);
  if (session) session.expiresAt = Date.now() + SESSION_TIMEOUT;
}

// --- Parse launch request ---

function parseLaunchRequest(message) {
  const result = {
    keyword: null,
    folderId: null,
  };

  // Extract Google Drive folder ID from URL or raw ID
  // Handles: https://drive.google.com/drive/u/3/folders/1PQ3b8NNx... or raw folder ID
  const urlMatch = message.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) {
    result.folderId = urlMatch[1];
  } else {
    // Try raw folder ID (25+ char alphanumeric)
    const rawMatch = message.match(/\b([a-zA-Z0-9_-]{25,})\b/);
    if (rawMatch) {
      result.folderId = rawMatch[1];
    }
  }

  // Extract target keyword — look for patterns like "bathroom ads:", "into bathroom accounts", etc.
  const keywordPatterns = [
    /^(\w+)\s+(?:ads?|creatives?|images?|videos?)\s*:/im,  // "bathroom ads:" at start of line
    /(?:into|to|in)\s+(?:the\s+)?(\w+)\s+accounts?/i,
    /(\w+)\s+accounts?\b/i,
    /(?:for|to)\s+(\w+)\b/i,
  ];

  for (const pattern of keywordPatterns) {
    const match = message.match(pattern);
    if (match) {
      const word = match[1].toLowerCase();
      // Skip common non-keyword words
      if (!["the", "my", "our", "all", "these", "those", "some", "new", "ad", "ads", "this"].includes(word)) {
        result.keyword = word;
        break;
      }
    }
  }

  return result;
}

// --- Main step handler ---

async function handleStep(chatId, userMessage) {
  const session = sessions.get(chatId);
  if (!session) return null;

  refreshExpiry(chatId);
  const msg = userMessage.trim().toLowerCase();

  // Universal cancel
  if (msg === "cancel" || msg === "stop" || msg === "abort" || msg === "nevermind") {
    sessions.delete(chatId);
    return "\u274C Launch cancelled.";
  }

  switch (session.state) {
    case "INIT":
      return await handleInit(chatId, session, userMessage);

    case "WAITING_FOLDER":
      return await handleFolderInput(chatId, session, userMessage);

    case "WAITING_KEYWORD":
      return await handleKeywordInput(chatId, session, userMessage);

    case "CONFIRM_ACCOUNTS":
      return await handleAccountConfirm(chatId, session, userMessage);

    case "SCANNING_BEST":
      // Shouldn't normally get here — scanning is async
      return "\u23F3 Still scanning for best performing ads...";

    case "REVIEW":
      return await handleReview(chatId, session, userMessage);

    case "LAUNCHING":
      return "\u{1F680} Launch in progress... hang tight.";

    default:
      sessions.delete(chatId);
      return "\u26A0\uFE0F Session error. Try /launch again.";
  }
}

// --- Step handlers ---

async function handleInit(chatId, session, userMessage) {
  const parsed = parseLaunchRequest(userMessage);
  session.folderId = parsed.folderId;
  session.keyword = parsed.keyword;

  // If we have both, skip ahead
  if (session.folderId && session.keyword) {
    return await processLaunch(chatId, session);
  }

  // Ask for what's missing
  if (!session.folderId) {
    session.state = "WAITING_FOLDER";
    return "\u{1F4C2} What's the Google Drive folder ID with the creatives?\n\n" +
      "Paste the folder ID (the long string from the URL) or search term.";
  }

  if (!session.keyword) {
    session.state = "WAITING_KEYWORD";
    return "\u{1F3AF} What type of accounts should I launch into?\n\n" +
      "Give me a keyword to match account names (e.g., \"bathroom\", \"roofing\", \"mass tort\").";
  }
}

async function handleFolderInput(chatId, session, userMessage) {
  const input = userMessage.trim();

  // Check if it looks like a folder ID
  if (/^[a-zA-Z0-9_-]{10,}$/.test(input)) {
    session.folderId = input;
  } else {
    // Treat as folder ID anyway (user might paste a URL)
    const match = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (match) {
      session.folderId = match[1];
    } else {
      session.folderId = input; // try it as-is
    }
  }

  if (!session.keyword) {
    session.state = "WAITING_KEYWORD";
    return "\u{1F3AF} Got the folder. What accounts? Give me a keyword (e.g., \"bathroom\", \"roofing\").";
  }

  return await processLaunch(chatId, session);
}

async function handleKeywordInput(chatId, session, userMessage) {
  session.keyword = userMessage.trim().toLowerCase();
  return await processLaunch(chatId, session);
}

async function processLaunch(chatId, session) {
  // Step 1: Find matching accounts
  session.matchedAccounts = await launcher.matchAccounts(session.keyword);

  if (session.matchedAccounts.length === 0) {
    sessions.delete(chatId);
    return `\u274C No active accounts matching "${session.keyword}". Use /accounts to see all account names. Try /launch again.`;
  }

  // Step 2: Load creatives from folder
  try {
    session.creatives = await listFolderMedia(session.folderId);
  } catch (err) {
    sessions.delete(chatId);
    return `\u274C Can't read Drive folder: ${err.message?.slice(0, 80)}\n\nMake sure the folder ID is correct and accessible.`;
  }

  if (session.creatives.length === 0) {
    sessions.delete(chatId);
    return `\u274C No images or videos found in that Drive folder.\n\nMake sure it contains image/video files.`;
  }

  // Show what we found and ask for confirmation
  session.state = "CONFIRM_ACCOUNTS";

  let msg = `\u{1F50D} LAUNCH SETUP:\n\n`;
  msg += `\u{1F4C2} Creatives: ${session.creatives.length} files\n`;
  for (const c of session.creatives.slice(0, 8)) {
    const icon = c.mimeType?.includes("video") ? "\u{1F3AC}" : "\u{1F5BC}\uFE0F";
    const size = c.size ? ` (${(parseInt(c.size) / 1024 / 1024).toFixed(1)}MB)` : "";
    msg += `   ${icon} ${c.name}${size}\n`;
  }
  if (session.creatives.length > 8) msg += `   ... and ${session.creatives.length - 8} more\n`;

  msg += `\n\u{1F3AF} Matching accounts (${session.matchedAccounts.length}):\n`;
  for (let i = 0; i < session.matchedAccounts.length; i++) {
    msg += `   ${i + 1}. ${session.matchedAccounts[i].name} (${session.matchedAccounts[i].id})\n`;
  }

  msg += `\nProceed with all ${session.matchedAccounts.length} accounts? Reply:\n`;
  msg += `\u2022 "yes" — use all accounts\n`;
  msg += `\u2022 numbers (e.g., "1,3,4") — select specific accounts\n`;
  msg += `\u2022 "cancel" — abort`;

  return msg;
}

async function handleAccountConfirm(chatId, session, userMessage) {
  const msg = userMessage.trim().toLowerCase();

  if (msg === "yes" || msg === "y" || msg === "all") {
    session.selectedAccounts = [...session.matchedAccounts];
  } else {
    // Parse number selections
    const nums = userMessage.match(/\d+/g);
    if (!nums) {
      return "Reply with \"yes\" for all accounts, numbers (e.g., \"1,3\") to select, or \"cancel\" to abort.";
    }

    session.selectedAccounts = nums
      .map(n => parseInt(n) - 1)
      .filter(i => i >= 0 && i < session.matchedAccounts.length)
      .map(i => session.matchedAccounts[i]);

    if (session.selectedAccounts.length === 0) {
      return "No valid accounts selected. Try again with numbers from the list, or \"cancel\".";
    }
  }

  // Step 3: Find best campaigns and ads for each account
  session.state = "SCANNING_BEST";

  let statusMsg = `\u{1F50D} Scanning ${session.selectedAccounts.length} accounts for best-performing ads...\n`;
  session.accountDetails = [];

  for (const acct of session.selectedAccounts) {
    try {
      const bestCampaign = await launcher.findBestCampaign(acct.id);
      if (!bestCampaign) {
        statusMsg += `\u26A0\uFE0F ${acct.name}: No active campaigns with data — skipping\n`;
        continue;
      }

      const bestAd = await launcher.findBestAd(bestCampaign.id);
      if (!bestAd) {
        statusMsg += `\u26A0\uFE0F ${acct.name}: No active ads with data — skipping\n`;
        continue;
      }

      session.accountDetails.push({
        id: acct.id,
        name: acct.name,
        bestCampaign,
        bestAd,
      });

      const cpr = bestAd.costPerResult < 1000 ? `$${bestAd.costPerResult.toFixed(2)}/result` : "no conversions";
      statusMsg += `\u2705 ${acct.name}: "${bestCampaign.name}" \u2192 "${bestAd.name}" (${cpr})\n`;
    } catch (err) {
      statusMsg += `\u274C ${acct.name}: Error — ${err.message?.slice(0, 50)}\n`;
    }
  }

  if (session.accountDetails.length === 0) {
    sessions.delete(chatId);
    return statusMsg + "\n\u274C No accounts had viable campaigns/ads to duplicate. Launch aborted.";
  }

  // Show review
  session.state = "REVIEW";
  const totalAds = session.accountDetails.length * session.creatives.length;

  statusMsg += `\n\u{1F680} LAUNCH PLAN:\n`;
  statusMsg += `${session.accountDetails.length} accounts \u00D7 ${session.creatives.length} creatives = ${totalAds} new ads\n`;
  statusMsg += `All will be created PAUSED.\n\n`;
  statusMsg += `Each ad duplicates the winning ad in each account (same targeting, same ad set, same budget).\n`;
  statusMsg += `Only the creative (image/video) changes.\n\n`;
  statusMsg += `Type "yes" to create all ${totalAds} ads, or "cancel" to abort.`;

  return statusMsg;
}

async function handleReview(chatId, session, userMessage) {
  const msg = userMessage.trim().toLowerCase();

  if (msg !== "yes" && msg !== "y" && msg !== "go" && msg !== "launch") {
    sessions.delete(chatId);
    return "\u274C Launch aborted.";
  }

  session.state = "LAUNCHING";

  // Download all creatives from Drive
  const progressLines = ["\u{1F680} Launching...\n"];

  try {
    progressLines.push("\u{1F4E5} Downloading creatives from Drive...");

    // Cap at 20 creatives and 30MB total to prevent memory exhaustion
    const MAX_CREATIVES = 20;
    const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
    let totalBytes = 0;
    const creativesToDownload = session.creatives.slice(0, MAX_CREATIVES);
    if (session.creatives.length > MAX_CREATIVES) {
      progressLines.push(`\u26A0\uFE0F Capped at ${MAX_CREATIVES} creatives (${session.creatives.length} in folder)`);
    }

    for (const creative of creativesToDownload) {
      try {
        // Only download images (skip videos for now — they need different upload)
        if (creative.mimeType?.includes("video")) {
          progressLines.push(`\u23ED\uFE0F Skipping video: ${creative.name} (video duplication not yet supported)`);
          continue;
        }

        const file = await downloadFileBuffer(creative.id);
        totalBytes += file.buffer.length;
        if (totalBytes > MAX_TOTAL_BYTES) {
          progressLines.push(`\u26A0\uFE0F Stopping downloads — hit 30MB memory limit`);
          break;
        }
        session.creativeBuffers.push({
          name: creative.name,
          buffer: file.buffer,
        });
      } catch (err) {
        progressLines.push(`\u26A0\uFE0F Failed to download ${creative.name}: ${err.message?.slice(0, 50)}`);
      }
    }

    if (session.creativeBuffers.length === 0) {
      sessions.delete(chatId);
      return progressLines.join("\n") + "\n\n\u274C No creatives could be downloaded. Launch aborted.";
    }

    progressLines.push(`\u2705 ${session.creativeBuffers.length} creatives ready\n`);

    // Build launch plan
    const plan = {
      accounts: session.accountDetails.map(a => ({
        id: a.id,
        name: a.name,
        bestAd: a.bestAd,
      })),
      creatives: session.creativeBuffers,
    };

    // Execute launch
    const results = await launcher.executeLaunch(plan, (progress) => {
      progressLines.push(progress);
    });

    // Summary
    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);

    let summary = progressLines.join("\n") + "\n\n";
    summary += `\u2705 DONE: ${successes.length}/${results.length} ads created (all PAUSED)\n`;

    if (failures.length > 0) {
      summary += `\u274C ${failures.length} failed:\n`;
      for (const f of failures) {
        summary += `   ${f.accountName}: ${f.creativeName} \u2014 ${f.error?.slice(0, 50)}\n`;
      }
    }

    summary += `\nUse /enable <adId> to activate individual ads.`;

    // Send Telegram launch notification (async, don't block)
    sendLaunchNotification(results, { mediaType: "image", status: "PAUSED" }).catch(() => {});
    if (failures.length > 0) {
      sendLaunchFailureNotification(failures).catch(() => {});
    }

    session.launchResults = results;
    sessions.delete(chatId);
    return summary;

  } catch (err) {
    sessions.delete(chatId);
    return progressLines.join("\n") + `\n\n\u274C Launch failed: ${err.message?.slice(0, 100)}`;
  }
}

module.exports = {
  hasActiveSession,
  cancelSession,
  createSession,
  handleStep,
  parseLaunchRequest,
};
