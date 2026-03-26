/**
 * Facebook Ads Launch Engine
 * Handles: account matching, best campaign/ad discovery, creative upload (image + video),
 * ad set capacity checks (50 ad limit), ad set duplication, and full launch execution.
 */

const fb = require("./ads");
const { sendAlert } = require("../telegram/notify");

const AD_SET_LIMIT = 50;

// --- Account matching ---

async function matchAccounts(keyword) {
  const accounts = await fb.listAllAdAccounts();
  const lower = keyword.toLowerCase();
  return accounts.filter(a =>
    a.account_status === 1 && (a.name || "").toLowerCase().includes(lower)
  );
}

// --- Find best performing campaign (by ROAS) ---

const MIN_SPEND_CAMPAIGN = 50; // Minimum $50 spend to be considered

async function findBestCampaign(accountId, datePreset = "last_7d") {
  const campaigns = await fb.getCampaigns(accountId);
  if (!campaigns?.data?.length) return null;

  const activeCampaigns = campaigns.data.filter(c => c.status === "ACTIVE");
  if (activeCampaigns.length === 0) return null;

  const campaignInsights = await fb.getCampaignInsightsBatch(
    activeCampaigns.map(c => c.id), datePreset
  );

  let bestCampaign = null;
  let bestRoas = -1;

  for (const campaign of activeCampaigns) {
    const insights = campaignInsights.get(campaign.id);
    if (!insights?.data?.length) continue;

    const d = insights.data[0];
    const spend = parseFloat(d.spend || 0);
    if (spend < MIN_SPEND_CAMPAIGN) continue;

    // ROAS = total conversion value / spend
    const totalValue = (d.action_values || [])
      .filter(a => ["lead", "purchase", "offsite_conversion.fb_pixel_lead", "offsite_conversion.fb_pixel_purchase"].includes(a.action_type))
      .reduce((sum, a) => sum + parseFloat(a.value || 0), 0);

    const roas = totalValue / spend;

    // Count conversions for display
    const leadAction = d.actions?.find(a => a.action_type === "lead");
    const purchaseAction = d.actions?.find(a => a.action_type === "purchase");
    const totalConversions = (leadAction ? parseInt(leadAction.value) : 0)
      + (purchaseAction ? parseInt(purchaseAction.value) : 0);

    if (roas > bestRoas) {
      bestRoas = roas;
      bestCampaign = {
        id: campaign.id,
        name: campaign.name,
        spend,
        conversions: totalConversions,
        roas,
        conversionValue: totalValue,
        insights: d,
      };
    }
  }

  return bestCampaign;
}

// --- Find best performing ACTIVE ad in a campaign (by ROAS) ---

const MIN_SPEND_AD = 20; // Minimum $20 spend for an ad to be considered

async function findBestAd(campaignId, datePreset = "last_7d") {
  const adSets = await fb.getAdSets(campaignId);
  if (!adSets?.data?.length) return null;

  let bestAd = null;
  let bestRoas = -1;

  for (const adSet of adSets.data) {
    if (adSet.status !== "ACTIVE") continue;

    const ads = await fb.getAds(adSet.id);
    if (!ads?.data?.length) continue;

    for (const ad of ads.data) {
      if (ad.status !== "ACTIVE") continue;

      try {
        const insights = await fb.getAdInsights(ad.id, datePreset);
        if (!insights?.data?.length) continue;

        const d = insights.data[0];
        const spend = parseFloat(d.spend || 0);
        if (spend < MIN_SPEND_AD) continue;

        // ROAS = total conversion value / spend
        const totalValue = (d.action_values || [])
          .filter(a => ["lead", "purchase", "offsite_conversion.fb_pixel_lead", "offsite_conversion.fb_pixel_purchase"].includes(a.action_type))
          .reduce((sum, a) => sum + parseFloat(a.value || 0), 0);

        const roas = totalValue / spend;

        // Count conversions for display
        const leadAction = d.actions?.find(a => a.action_type === "lead");
        const purchaseAction = d.actions?.find(a => a.action_type === "purchase");
        const totalConversions = (leadAction ? parseInt(leadAction.value) : 0)
          + (purchaseAction ? parseInt(purchaseAction.value) : 0);

        if (roas > bestRoas) {
          bestRoas = roas;
          bestAd = {
            id: ad.id,
            name: ad.name,
            adSetId: adSet.id,
            adSetName: adSet.name,
            spend,
            conversions: totalConversions,
            roas,
            conversionValue: totalValue,
            insights: d,
          };
        }
      } catch (e) {
        // Skip ads that error
      }
    }
  }

  return bestAd;
}

// --- Upload creative from buffer to FB ---

async function uploadCreativeBuffer(buffer, accountId) {
  const base64 = buffer.toString("base64");
  const result = await fb.uploadImageBytes(base64, accountId);

  if (result.images) {
    const key = Object.keys(result.images)[0];
    return {
      hash: result.images[key].hash,
      url: result.images[key].url,
    };
  }
  throw new Error("Failed to upload image — unexpected response format");
}

// --- Upload video and wait for processing ---

async function uploadVideoBuffer(buffer, name, accountId) {
  const result = await fb.uploadVideo(buffer, name, accountId);
  console.log(`[LAUNCHER] Video uploaded: ${result.videoId}, waiting for processing...`);
  await fb.waitForVideoReady(result.videoId);
  console.log(`[LAUNCHER] Video ready: ${result.videoId}`);
  return result.videoId;
}

// --- Duplicate ad with new creative ---

async function duplicateAdWithCreative(sourceAdId, imageHash, newName, accountId, status = "ACTIVE") {
  return fb.duplicateAd(sourceAdId, {
    newName,
    imageHash,
    accountId,
    status,
  });
}

// --- Resolve target ad set (checks capacity, duplicates if needed) ---

async function resolveTargetAdSet(adSetId, neededSlots, accountId) {
  const currentCount = await fb.countAdsInAdSet(adSetId);
  const available = AD_SET_LIMIT - currentCount;

  if (available >= neededSlots) {
    return { adSetId, duplicated: false, currentCount, available };
  }

  // Need to duplicate the ad set
  const source = await fb.getAdSetFull(adSetId);
  const newAdSet = await fb.duplicateAdSet(adSetId, {
    newName: `${source.name} - ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    accountId,
  });

  // Notify Austin about the ad set limit
  sendAlert(
    `📊 AD SET LIMIT HIT\n\n` +
    `Ad set ${adSetId} is at ${currentCount}/${AD_SET_LIMIT} ads.\n` +
    `Auto-created new ad set: ${newAdSet.id}\n` +
    `New ads will go into the new ad set.`
  ).catch(() => {});

  return {
    adSetId: newAdSet.id,
    duplicated: true,
    originalAdSetId: adSetId,
    originalCount: currentCount,
    available: AD_SET_LIMIT,
  };
}

// --- Execute video launch ---

async function executeVideoLaunch(plan, progressCallback) {
  // plan: {
  //   accountId, accountName,
  //   adSetId, adSetName,
  //   sourceAd: { id, name, creative spec details },
  //   creatives: [{ name, buffer, fileId }],
  //   pageId, instagramId, link, linkCaption, callToAction, imageHash
  // }

  const results = [];
  const total = plan.creatives.length;
  const cb = (msg) => progressCallback && progressCallback(msg);

  // 1. Check ad set capacity
  cb(`Checking ad set capacity...`);
  const target = await resolveTargetAdSet(plan.adSetId, total, plan.accountId);

  if (target.duplicated) {
    cb(`⚠️ Ad set was full (${target.originalCount}/${AD_SET_LIMIT}). Created new ad set: ${target.adSetId}`);
  } else {
    cb(`Ad set has room: ${target.currentCount}/${AD_SET_LIMIT} (adding ${total})`);
  }

  const targetAdSetId = target.adSetId;

  // 2. Upload all videos first
  cb(`Uploading ${total} videos to Facebook...`);
  const uploadedVideos = [];

  for (let i = 0; i < plan.creatives.length; i++) {
    const creative = plan.creatives[i];
    try {
      cb(`[${i + 1}/${total}] Uploading ${creative.name}...`);
      const videoId = await uploadVideoBuffer(creative.buffer, creative.name, plan.accountId);
      uploadedVideos.push({ ...creative, videoId });
      cb(`[${i + 1}/${total}] ✅ ${creative.name} uploaded (${videoId})`);
    } catch (err) {
      cb(`[${i + 1}/${total}] ❌ ${creative.name} upload failed: ${err.message?.slice(0, 80)}`);
      results.push({ success: false, creativeName: creative.name, error: err.message });
    }
  }

  if (uploadedVideos.length === 0) {
    cb(`All uploads failed. Aborting.`);
    return results;
  }

  // 3. Create ad creative + ad for each uploaded video
  cb(`Creating ${uploadedVideos.length} ads (ACTIVE)...`);

  for (let i = 0; i < uploadedVideos.length; i++) {
    const video = uploadedVideos[i];
    const adName = video.name.replace(/\.[^.]+$/, "");

    try {
      // Create video ad creative
      const creative = await fb.createVideoAdCreative(adName, {
        videoId: video.videoId,
        pageId: plan.pageId,
        instagramId: plan.instagramId,
        link: plan.link,
        linkCaption: plan.linkCaption,
        callToAction: plan.callToAction,
        imageHash: plan.imageHash,
      }, plan.accountId);

      // Create the ad — ACTIVE
      const ad = await fb.createAd(targetAdSetId, adName, creative.id, {
        status: "ACTIVE",
        trackingSpecs: plan.trackingSpecs,
      }, plan.accountId);

      results.push({
        success: true,
        creativeName: video.name,
        adId: ad.id,
        creativeId: creative.id,
        adSetId: targetAdSetId,
      });

      cb(`[${i + 1}/${uploadedVideos.length}] ✅ ${adName} → ad ${ad.id} (ACTIVE)`);
    } catch (err) {
      results.push({ success: false, creativeName: video.name, error: err.message });
      cb(`[${i + 1}/${uploadedVideos.length}] ❌ ${adName} failed: ${err.message?.slice(0, 80)}`);
    }
  }

  // 4. Summary
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  let summary = `\n✅ ${succeeded}/${total} ads created ACTIVE in ad set ${targetAdSetId}`;
  if (target.duplicated) {
    summary += `\n⚠️ New ad set created (original ${target.originalAdSetId} was full at ${target.originalCount} ads)`;
  }
  if (failed > 0) {
    summary += `\n❌ ${failed} failed`;
  }
  cb(summary);

  return { results, targetAdSetId, duplicatedAdSet: target.duplicated };
}

// --- Execute image launch (original flow) ---

async function executeLaunch(plan, progressCallback) {
  const results = [];
  let completed = 0;
  const total = plan.accounts.length * plan.creatives.length;

  for (const account of plan.accounts) {
    for (const creative of plan.creatives) {
      completed++;
      const label = `[${completed}/${total}]`;

      try {
        const upload = await uploadCreativeBuffer(creative.buffer, account.id);
        const adName = `${creative.name.replace(/\.[^.]+$/, "")} - ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
        const newAd = await duplicateAdWithCreative(
          account.bestAd.id,
          upload.hash,
          adName,
          account.id,
        );

        results.push({
          success: true,
          label,
          accountName: account.name,
          creativeName: creative.name,
          adId: newAd.adId,
          adSetId: newAd.adSetId,
        });

        if (progressCallback) {
          progressCallback(`${label} ${account.name}: ${creative.name} → ad ${newAd.adId} (ACTIVE)`);
        }
      } catch (err) {
        results.push({
          success: false,
          label,
          accountName: account.name,
          creativeName: creative.name,
          error: err.message,
        });

        if (progressCallback) {
          progressCallback(`${label} ${account.name}: ${creative.name} → FAILED: ${err.message?.slice(0, 60)}`);
        }
      }
    }
  }

  return results;
}

module.exports = {
  matchAccounts,
  findBestCampaign,
  findBestAd,
  uploadCreativeBuffer,
  uploadVideoBuffer,
  duplicateAdWithCreative,
  resolveTargetAdSet,
  executeVideoLaunch,
  executeLaunch,
  AD_SET_LIMIT,
};
