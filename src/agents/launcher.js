/**
 * Agent 6: Ad Launcher
 * Wraps existing Facebook ad creation to launch compliant creatives.
 * Takes videos + scripts from the pipeline and creates ads in the right accounts.
 */

const fb = require("../facebook/ads");
const fbLauncher = require("../facebook/launcher");
const { addLog } = require("../pipeline/context");
const { saveAgentOutput } = require("../pipeline/store");
const { sendLaunchNotification, sendLaunchFailureNotification } = require("../telegram/notify");
const fs = require("fs");

/**
 * Run the ad launcher.
 * Creates ads from pipeline scripts/videos in target accounts.
 * @param {object} ctx - PipelineContext
 * @param {function} onProgress - Progress callback
 * @returns {object} Launch results
 */
async function run(ctx, onProgress) {
  addLog(ctx, "Ad Launcher starting...");
  ctx.currentAgent = "launcher";

  if (!fb.isConfigured()) {
    addLog(ctx, "Facebook Ads not configured — skipping launch");
    ctx.launch = { adsCreated: [], adsFailed: [{ error: "FB not configured" }], totalAds: 0 };
    return ctx.launch;
  }

  // Determine which scripts/creatives to launch
  const approvedScripts = getApprovedScripts(ctx);
  if (approvedScripts.length === 0) {
    addLog(ctx, "No approved scripts to launch");
    ctx.launch = { adsCreated: [], adsFailed: [], totalAds: 0 };
    return ctx.launch;
  }

  // Find target accounts
  const targetAccounts = await findTargetAccounts(ctx);
  if (targetAccounts.length === 0) {
    addLog(ctx, "No target accounts found");
    ctx.launch = { adsCreated: [], adsFailed: [{ error: "No matching accounts" }], totalAds: 0 };
    return ctx.launch;
  }

  addLog(ctx, `Launching ${approvedScripts.length} creatives across ${targetAccounts.length} accounts`);

  const adsCreated = [];
  const adsFailed = [];

  for (const account of targetAccounts) {
    for (const script of approvedScripts) {
      try {
        if (onProgress) {
          onProgress(`🚀 Creating ad in ${account.name}: "${script.angle}"...`);
        }

        // Check if we have a video for this script
        const video = ctx.videos?.find(v => v.scriptId === script.id && v.status === "ready");

        let adResult;
        if (video && fs.existsSync(video.localPath)) {
          // Launch with video creative
          adResult = await launchVideoAd(account, script, video);
        } else {
          // Launch with image/copy-only creative
          adResult = await launchCopyAd(account, script);
        }

        adsCreated.push({
          accountName: account.name,
          accountId: account.id,
          scriptId: script.id,
          angle: script.angle,
          adId: adResult.adId,
          creativeId: adResult.creativeId,
          status: "PAUSED", // Always create PAUSED
        });

        addLog(ctx, `✅ Ad created: ${account.name} / ${script.angle} (${adResult.adId})`);
      } catch (err) {
        adsFailed.push({
          accountName: account.name,
          accountId: account.id,
          scriptId: script.id,
          angle: script.angle,
          error: err.message?.slice(0, 100),
        });
        addLog(ctx, `❌ Ad failed: ${account.name} / ${script.angle}: ${err.message?.slice(0, 60)}`);
      }
    }
  }

  ctx.launch = {
    adsCreated,
    adsFailed,
    totalAds: adsCreated.length + adsFailed.length,
  };

  saveAgentOutput(ctx.runId, "launch", ctx.launch);
  addLog(ctx, `Launch complete: ${adsCreated.length} created, ${adsFailed.length} failed (all PAUSED)`);

  // Send Telegram launch notification (async, don't block)
  sendLaunchNotification(adsCreated.map(a => ({ ...a, success: true })), { mediaType: "pipeline", status: "PAUSED" }).catch(() => {});
  if (adsFailed.length > 0) {
    sendLaunchFailureNotification(adsFailed).catch(() => {});
  }

  return ctx.launch;
}

/**
 * Get scripts that passed compliance review.
 */
function getApprovedScripts(ctx) {
  if (!ctx.scripts?.length) return [];

  // If compliance ran, only use scripts that passed
  if (ctx.compliance?.length) {
    const passedIds = new Set(
      ctx.compliance.filter(c => c.passed).map(c => c.scriptId)
    );
    return ctx.scripts.filter(s => passedIds.has(s.id));
  }

  // If no compliance review, use all scripts
  return ctx.scripts;
}

/**
 * Find target accounts based on pipeline context.
 */
async function findTargetAccounts(ctx) {
  if (!ctx.targetAccounts?.length) return [];

  try {
    const allAccounts = await fb.listAllAdAccounts();
    const activeAccounts = allAccounts.filter(a => a.account_status === 1);

    const matched = activeAccounts.filter(a =>
      ctx.targetAccounts.some(t =>
        a.name?.toLowerCase().includes(t.toLowerCase()) ||
        a.id === t ||
        a.id === `act_${t}`
      )
    );

    return matched;
  } catch (err) {
    console.error(`[LAUNCHER] Error finding accounts: ${err.message}`);
    return [];
  }
}

/**
 * Launch a video ad in an account.
 */
async function launchVideoAd(account, script, video) {
  fb.setActiveAccount(account.id);

  // Find best campaign to add to
  const bestCampaign = await fbLauncher.findBestCampaign(account.id);
  if (!bestCampaign) throw new Error("No active campaign found");

  const bestAd = await fbLauncher.findBestAd(bestCampaign.id);
  if (!bestAd) throw new Error("No active ad found to duplicate from");

  // Upload video to FB
  const videoBuffer = fs.readFileSync(video.localPath);
  const uploadResult = await fb.uploadVideo(videoBuffer, `${script.angle}-${script.id}.mp4`, account.id);
  await fb.waitForVideoReady(uploadResult.videoId);

  // Get page ID from existing ad
  const existingAd = await fb.getAdFull(bestAd.id);
  const existingCreative = await fb.getAdCreative(existingAd.creative?.id);
  const pageId = existingCreative.object_story_spec?.page_id;
  if (!pageId) throw new Error("Could not determine page ID from existing ad");

  // Create video ad creative
  const creative = await fb.createVideoAdCreative(
    `Pipeline: ${script.angle}`,
    {
      videoId: uploadResult.videoId,
      pageId,
      link: existingCreative.object_story_spec?.link_data?.link || existingCreative.object_story_spec?.video_data?.call_to_action?.value?.link,
      message: script.primaryText,
      callToAction: "LEARN_MORE",
    },
    account.id
  );

  // Create ad in the best ad set (PAUSED)
  const adSetId = bestAd.adSetId || existingAd.adset_id;
  const ad = await fb.createAd(
    adSetId,
    `Pipeline: ${script.angle}`,
    creative.id,
    { status: "PAUSED" },
    account.id
  );

  return { adId: ad.id, creativeId: creative.id };
}

/**
 * Launch a copy-only ad (image from existing ad, new copy).
 */
async function launchCopyAd(account, script) {
  fb.setActiveAccount(account.id);

  // Find best campaign/ad to duplicate from
  const bestCampaign = await fbLauncher.findBestCampaign(account.id);
  if (!bestCampaign) throw new Error("No active campaign found");

  const bestAd = await fbLauncher.findBestAd(bestCampaign.id);
  if (!bestAd) throw new Error("No active ad found");

  // Get existing creative to reuse image/video
  const existingAd = await fb.getAdFull(bestAd.id);
  const existingCreative = await fb.getAdCreative(existingAd.creative?.id);
  const storySpec = existingCreative.object_story_spec;
  if (!storySpec) throw new Error("No object_story_spec in existing creative");

  // Modify copy
  if (storySpec.link_data) {
    storySpec.link_data.message = script.primaryText;
    storySpec.link_data.name = script.headline;
  } else if (storySpec.video_data) {
    storySpec.video_data.message = script.primaryText;
  }

  // Create new creative with new copy, existing visual
  const newCreative = await fb.createAdCreative(
    `Pipeline: ${script.angle}`,
    {
      pageId: storySpec.page_id,
      link: storySpec.link_data?.link || storySpec.video_data?.call_to_action?.value?.link,
      message: script.primaryText,
      headline: script.headline,
      imageHash: storySpec.link_data?.image_hash,
      callToAction: "LEARN_MORE",
    },
    account.id
  );

  // Create ad PAUSED
  const adSetId = existingAd.adset_id;
  const ad = await fb.createAd(
    adSetId,
    `Pipeline: ${script.angle}`,
    newCreative.id,
    { status: "PAUSED" },
    account.id
  );

  return { adId: ad.id, creativeId: newCreative.id };
}

/**
 * Format launch results for Telegram.
 */
function formatLaunchResults(launch) {
  if (!launch) return "No launch results.";

  let msg = `🚀 LAUNCH RESULTS\n\n`;
  msg += `✅ Created: ${launch.adsCreated?.length || 0} (all PAUSED)\n`;
  msg += `❌ Failed: ${launch.adsFailed?.length || 0}\n\n`;

  if (launch.adsCreated?.length) {
    msg += `Created ads:\n`;
    for (const ad of launch.adsCreated) {
      msg += `  ✅ ${ad.accountName}: "${ad.angle}" → ${ad.adId}\n`;
    }
    msg += "\n";
  }

  if (launch.adsFailed?.length) {
    msg += `Failed:\n`;
    for (const ad of launch.adsFailed) {
      msg += `  ❌ ${ad.accountName}: "${ad.angle}" — ${ad.error}\n`;
    }
    msg += "\n";
  }

  msg += `Use /enable <adId> to activate individual ads.`;
  return msg;
}

module.exports = { run, formatLaunchResults };
