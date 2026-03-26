/**
 * Forward-to-Launch Flow — Send/forward a photo or video to the bot, launch it as a Facebook ad.
 * State machine: media received → keyword → accounts → scan best → review → launch.
 */

const launcher = require("../facebook/launcher");
const fb = require("../facebook/ads");
const { sendLaunchNotification, sendLaunchFailureNotification } = require("./notify");

// Active sessions (one per chat)
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

function createSession(chatId, mediaBuffer, mediaType, fileName, caption) {
  const session = {
    state: "WAITING_KEYWORD",
    expiresAt: Date.now() + SESSION_TIMEOUT,
    mediaType,       // "photo" or "video"
    mediaBuffer,     // Buffer with the downloaded file
    mediaFileName: fileName,
    caption: caption || null,
    keyword: null,
    matchedAccounts: [],
    selectedAccounts: [],
    accountDetails: [], // { id, name, bestCampaign, bestAd }
    launchResults: null,
  };
  sessions.set(chatId, session);
  return session;
}

function refreshExpiry(chatId) {
  const session = sessions.get(chatId);
  if (session) session.expiresAt = Date.now() + SESSION_TIMEOUT;
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
    return "❌ Forward launch cancelled.";
  }

  switch (session.state) {
    case "WAITING_KEYWORD":
      return await handleKeywordInput(chatId, session, userMessage);

    case "CONFIRM_ACCOUNTS":
      return await handleAccountConfirm(chatId, session, userMessage);

    case "SCANNING_BEST":
      return "⏳ Still scanning for best performing ads...";

    case "REVIEW":
      return await handleReview(chatId, session, userMessage);

    case "LAUNCHING":
      return "🚀 Launch in progress... hang tight.";

    default:
      sessions.delete(chatId);
      return "⚠️ Session error. Send the photo/video again to restart.";
  }
}

// --- Step handlers ---

async function handleKeywordInput(chatId, session, userMessage) {
  const keyword = userMessage.trim().toLowerCase();
  session.keyword = keyword;

  // Find matching accounts
  session.matchedAccounts = await launcher.matchAccounts(keyword);

  if (session.matchedAccounts.length === 0) {
    // Don't kill session — let them try another keyword
    session.keyword = null;
    return `❌ No active accounts matching "${keyword}".\n\nTry another keyword (e.g., "bath", "roof", "tort"), or "cancel" to abort.`;
  }

  session.state = "CONFIRM_ACCOUNTS";

  const mediaIcon = session.mediaType === "video" ? "🎬" : "🖼️";
  let msg = `${mediaIcon} Creative: ${session.mediaFileName}\n`;
  msg += `🎯 Matching accounts (${session.matchedAccounts.length}):\n\n`;

  for (let i = 0; i < session.matchedAccounts.length; i++) {
    msg += `   ${i + 1}. ${session.matchedAccounts[i].name}\n`;
  }

  msg += `\nLaunch into all ${session.matchedAccounts.length} accounts? Reply:\n`;
  msg += `• "yes" — use all accounts\n`;
  msg += `• numbers (e.g., "1,3,4") — select specific ones\n`;
  msg += `• "cancel" — abort`;

  return msg;
}

async function handleAccountConfirm(chatId, session, userMessage) {
  const msg = userMessage.trim().toLowerCase();

  if (msg === "yes" || msg === "y" || msg === "all") {
    session.selectedAccounts = [...session.matchedAccounts];
  } else {
    const nums = userMessage.match(/\d+/g);
    if (!nums) {
      return 'Reply with "yes" for all accounts, numbers (e.g., "1,3") to select, or "cancel" to abort.';
    }

    session.selectedAccounts = nums
      .map(n => parseInt(n) - 1)
      .filter(i => i >= 0 && i < session.matchedAccounts.length)
      .map(i => session.matchedAccounts[i]);

    if (session.selectedAccounts.length === 0) {
      return 'No valid accounts selected. Try again with numbers from the list, or "cancel".';
    }
  }

  // Scan for best campaigns and ads
  session.state = "SCANNING_BEST";
  session.accountDetails = [];

  let statusMsg = `🔍 Scanning ${session.selectedAccounts.length} accounts for best-performing ads...\n\n`;

  for (const acct of session.selectedAccounts) {
    try {
      const bestCampaign = await launcher.findBestCampaign(acct.id);
      if (!bestCampaign) {
        statusMsg += `⚠️ ${acct.name}: No active campaigns with data — skipping\n`;
        continue;
      }

      const bestAd = await launcher.findBestAd(bestCampaign.id);
      if (!bestAd) {
        statusMsg += `⚠️ ${acct.name}: No active ads with data — skipping\n`;
        continue;
      }

      session.accountDetails.push({
        id: acct.id,
        name: acct.name,
        bestCampaign,
        bestAd,
      });

      const roasStr = bestAd.roas > 0
        ? `${bestAd.roas.toFixed(2)}x ROAS`
        : "no conversion value";
      statusMsg += `✅ ${acct.name}: "${bestCampaign.name}" → "${bestAd.name}" (${roasStr}, $${bestAd.spend.toFixed(0)} spend)\n`;
    } catch (err) {
      statusMsg += `❌ ${acct.name}: Error — ${err.message?.slice(0, 50)}\n`;
    }
  }

  if (session.accountDetails.length === 0) {
    sessions.delete(chatId);
    return statusMsg + "\n❌ No accounts had viable campaigns/ads to duplicate. Launch aborted.";
  }

  // Show review with selection criteria
  session.state = "REVIEW";
  const mediaIcon = session.mediaType === "video" ? "🎬" : "🖼️";

  statusMsg += `\n📊 SELECTION CRITERIA:\n`;
  statusMsg += `• Campaigns: All ACTIVE campaigns, ranked by highest ROAS (conversion value ÷ spend) over last 7 days, min $50 spend\n`;
  statusMsg += `• Ads: All ACTIVE ads in winning campaign, ranked by highest ROAS over last 7 days, min $20 spend\n`;
  statusMsg += `• The new ad inherits the winning ad's targeting, budget, ad set, and tracking — only the creative swaps\n\n`;

  statusMsg += `🚀 LAUNCH PLAN:\n`;
  statusMsg += `${mediaIcon} 1 creative → ${session.accountDetails.length} accounts = ${session.accountDetails.length} new ads\n`;
  statusMsg += `All will be created ACTIVE.\n\n`;

  for (const acct of session.accountDetails) {
    const roasStr = acct.bestAd.roas > 0
      ? `${acct.bestAd.roas.toFixed(2)}x ROAS`
      : "no conversion value";
    const spend = `$${acct.bestAd.spend.toFixed(0)} spend`;
    const value = `$${(acct.bestAd.conversionValue || 0).toFixed(0)} value`;
    statusMsg += `📍 ${acct.name}\n`;
    statusMsg += `   Campaign: ${acct.bestCampaign.name}\n`;
    statusMsg += `   Ad Set: ${acct.bestAd.adSetName}\n`;
    statusMsg += `   Source Ad: "${acct.bestAd.name}" (${roasStr}, ${spend}, ${value})\n\n`;
  }

  statusMsg += `Type "yes" to launch, or "cancel" to abort.`;

  return statusMsg;
}

async function handleReview(chatId, session, userMessage) {
  const msg = userMessage.trim().toLowerCase();

  if (msg !== "yes" && msg !== "y" && msg !== "go" && msg !== "launch") {
    sessions.delete(chatId);
    return "❌ Launch aborted.";
  }

  session.state = "LAUNCHING";
  const progressLines = ["🚀 Launching...\n"];

  try {
    if (session.mediaType === "photo") {
      // Image launch — upload to each account and duplicate best ad
      const results = [];
      const total = session.accountDetails.length;

      for (let i = 0; i < session.accountDetails.length; i++) {
        const acct = session.accountDetails[i];
        const label = `[${i + 1}/${total}]`;

        try {
          // Upload image to this account
          const upload = await launcher.uploadCreativeBuffer(session.mediaBuffer, acct.id);
          const adName = `${session.mediaFileName.replace(/\.[^.]+$/, "")} - ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

          // Duplicate best ad with new image
          const newAd = await launcher.duplicateAdWithCreative(
            acct.bestAd.id,
            upload.hash,
            adName,
            acct.id,
          );

          results.push({
            success: true,
            accountName: acct.name,
            accountId: acct.id,
            adId: newAd.adId,
            adSetId: newAd.adSetId,
            campaignName: acct.bestCampaign.name,
          });
          progressLines.push(`${label} ✅ ${acct.name} → ad ${newAd.adId} (ACTIVE)`);
        } catch (err) {
          results.push({ success: false, accountName: acct.name, error: err.message });
          progressLines.push(`${label} ❌ ${acct.name}: ${err.message?.slice(0, 60)}`);
        }
      }

      // Summary with links
      const successes = results.filter(r => r.success);
      const failures = results.filter(r => !r.success);

      let summary = progressLines.join("\n") + "\n\n";
      summary += `✅ DONE: ${successes.length}/${results.length} ads created (all ACTIVE)\n\n`;

      if (successes.length > 0) {
        // Group by ad set for cleaner links
        const byAdSet = new Map();
        for (const s of successes) {
          const key = `${s.accountId}|${s.adSetId}`;
          if (!byAdSet.has(key)) byAdSet.set(key, { ...s, adIds: [] });
          byAdSet.get(key).adIds.push(s.adId);
        }

        summary += `🔗 VERIFY YOUR ADS:\n`;
        for (const [, group] of byAdSet) {
          const adSetUrl = `https://www.facebook.com/adsmanager/manage/ads?act=${group.accountId.replace("act_", "")}&selected_adset_ids=${group.adSetId}`;
          summary += `${group.accountName} — "${group.campaignName}"\n`;
          summary += `   Ad Set: ${group.adSetId}\n`;
          summary += `   ${adSetUrl}\n\n`;
        }
      }

      if (failures.length > 0) {
        summary += `❌ ${failures.length} failed:\n`;
        for (const f of failures) {
          summary += `   ${f.accountName}: ${f.error?.slice(0, 50)}\n`;
        }
      }

      // Send Telegram launch notification (async, don't block)
      sendLaunchNotification(results, { mediaType: "photo", status: "ACTIVE" }).catch(() => {});
      if (failures.length > 0) {
        sendLaunchFailureNotification(failures).catch(() => {});
      }

      sessions.delete(chatId);
      return summary;

    } else {
      // Video launch — upload video to each account and create video ad
      const results = [];
      const total = session.accountDetails.length;

      for (let i = 0; i < session.accountDetails.length; i++) {
        const acct = session.accountDetails[i];
        const label = `[${i + 1}/${total}]`;

        try {
          // Upload video
          progressLines.push(`${label} Uploading video to ${acct.name}...`);
          const videoId = await launcher.uploadVideoBuffer(
            session.mediaBuffer,
            session.mediaFileName,
            acct.id,
          );

          // Get source ad's creative to extract page ID, link, CTA etc.
          const sourceAd = await fb.getAdFull(acct.bestAd.id);
          const sourceCreative = await fb.getAdCreative(sourceAd.creative?.id);
          const storySpec = sourceCreative.object_story_spec;

          if (!storySpec) {
            throw new Error("Source ad has no object_story_spec");
          }

          // Extract page ID and other creative params from source
          const pageId = storySpec.page_id;
          const instagramId = storySpec.instagram_actor_id;

          // Build video creative params from source ad's link_data or video_data
          const sourceData = storySpec.video_data || storySpec.link_data || {};
          const link = sourceData.link || sourceData.call_to_action?.value?.link;
          const linkCaption = sourceData.link_caption || sourceData.caption;
          const callToAction = sourceData.call_to_action?.type || "LEARN_MORE";
          const imageHash = sourceData.image_hash;

          const adName = `${session.mediaFileName.replace(/\.[^.]+$/, "")} - ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

          // Check ad set capacity
          const target = await launcher.resolveTargetAdSet(acct.bestAd.adSetId, 1, acct.id);
          const targetAdSetId = target.adSetId;

          // Create video ad creative
          const creative = await fb.createVideoAdCreative(adName, {
            videoId,
            pageId,
            instagramId,
            link,
            linkCaption,
            callToAction,
            imageHash,
          }, acct.id);

          // Create the ad — ACTIVE
          const ad = await fb.createAd(targetAdSetId, adName, creative.id, {
            status: "ACTIVE",
            trackingSpecs: sourceAd.tracking_specs || undefined,
          }, acct.id);

          results.push({
            success: true,
            accountName: acct.name,
            accountId: acct.id,
            adId: ad.id,
            adSetId: targetAdSetId,
            campaignName: acct.bestCampaign.name,
          });
          progressLines.push(`${label} ✅ ${acct.name} → ad ${ad.id} (ACTIVE)`);
        } catch (err) {
          results.push({ success: false, accountName: acct.name, error: err.message });
          progressLines.push(`${label} ❌ ${acct.name}: ${err.message?.slice(0, 60)}`);
        }
      }

      // Summary with links
      const successes = results.filter(r => r.success);
      const failures = results.filter(r => !r.success);

      let summary = progressLines.join("\n") + "\n\n";
      summary += `✅ DONE: ${successes.length}/${results.length} video ads created (all ACTIVE)\n\n`;

      if (successes.length > 0) {
        // Group by ad set for cleaner links
        const byAdSet = new Map();
        for (const s of successes) {
          const key = `${s.accountId}|${s.adSetId}`;
          if (!byAdSet.has(key)) byAdSet.set(key, { ...s, adIds: [] });
          byAdSet.get(key).adIds.push(s.adId);
        }

        summary += `🔗 VERIFY YOUR ADS:\n`;
        for (const [, group] of byAdSet) {
          const adSetUrl = `https://www.facebook.com/adsmanager/manage/ads?act=${group.accountId.replace("act_", "")}&selected_adset_ids=${group.adSetId}`;
          summary += `${group.accountName} — "${group.campaignName}"\n`;
          summary += `   Ad Set: ${group.adSetId}\n`;
          summary += `   ${adSetUrl}\n\n`;
        }
      }

      if (failures.length > 0) {
        summary += `❌ ${failures.length} failed:\n`;
        for (const f of failures) {
          summary += `   ${f.accountName}: ${f.error?.slice(0, 50)}\n`;
        }
      }

      // Send Telegram launch notification (async, don't block)
      sendLaunchNotification(results, { mediaType: "video", status: "ACTIVE" }).catch(() => {});
      if (failures.length > 0) {
        sendLaunchFailureNotification(failures).catch(() => {});
      }

      sessions.delete(chatId);
      return summary;
    }
  } catch (err) {
    sessions.delete(chatId);
    return progressLines.join("\n") + `\n\n❌ Launch failed: ${err.message?.slice(0, 100)}`;
  }
}

module.exports = {
  hasActiveSession,
  cancelSession,
  createSession,
  handleStep,
};
