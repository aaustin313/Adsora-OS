/**
 * Facebook Marketing API Module
 * Handles all Facebook Ads operations: read campaigns, create ads, manage budgets, pull metrics
 */

const tokens = require("./tokens");
const { cache, ResponseCache, ttlForEndpoint, fbBatchGet, groupByToken, fetchAsyncInsights } = require("./rateLimit");
const { BATCH_API_MAX } = require("./config");

const DEFAULT_AD_ACCOUNT_ID = process.env.FACEBOOK_AD_ACCOUNT_ID || "";
const API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// Context token — set during batched operations so object-level calls
// (campaign/adset/ad IDs that don't contain act_) resolve correctly.
let contextToken = null;

// Active account (can be switched at runtime)
let activeAccountId = DEFAULT_AD_ACCOUNT_ID;

function setActiveAccount(accountId) {
  activeAccountId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
}

function getActiveAccount() {
  return activeAccountId;
}

async function listAdAccounts() {
  const data = await fbApi("/me/adaccounts", {
    fields: "id,name,account_status,currency,amount_spent",
    limit: 100,
  });
  return data.data || [];
}

// --- Helpers ---

async function resolveToken(endpoint) {
  // 1. Context token (set during batched operations)
  if (contextToken) return contextToken;
  // 2. Extract account ID from endpoint (e.g. /act_123/campaigns)
  const actMatch = endpoint.match(/\/(act_\d+)/);
  if (actMatch) return tokens.getTokenForAccount(actMatch[1]);
  // 3. Resolve from active account
  if (activeAccountId) return tokens.getTokenForAccount(activeAccountId);
  // 4. Default
  return tokens.getDefaultToken();
}

async function fbApi(endpoint, params = {}, method = "GET", token = null, { useCache = true } = {}) {
  const accessToken = token || (await resolveToken(endpoint));
  const url = new URL(`${BASE_URL}${endpoint}`);

  if (method === "GET") {
    // Check cache first
    const cacheKey = useCache ? ResponseCache.key("GET", endpoint, params) : null;
    if (cacheKey) {
      const cached = cache.get(cacheKey);
      if (cached) return cached;
    }

    url.searchParams.set("access_token", accessToken);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, typeof value === "object" ? JSON.stringify(value) : value);
    }
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.error) throw new Error(`FB API: ${data.error.message}`);

    // Store in cache
    if (cacheKey) cache.set(cacheKey, data, ttlForEndpoint(endpoint));
    return data;
  }

  // POST
  const body = new URLSearchParams();
  body.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    body.set(key, typeof value === "object" ? JSON.stringify(value) : value);
  }

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json();
  if (data.error) throw new Error(`FB API: ${data.error.message}`);
  return data;
}

// --- Read Operations ---

async function getCampaigns(accountId = activeAccountId) {
  return fbApi(`/${accountId}/campaigns`, {
    fields: "id,name,status,objective,daily_budget,lifetime_budget,budget_remaining,special_ad_categories",
    limit: 50,
  });
}

async function getAdSets(campaignId) {
  return fbApi(`/${campaignId}/adsets`, {
    fields: "id,name,status,daily_budget,lifetime_budget,targeting,optimization_goal,bid_strategy,start_time,end_time",
    limit: 50,
  });
}

async function getAds(adSetId) {
  return fbApi(`/${adSetId}/ads`, {
    fields: "id,name,status,creative,tracking_specs",
    limit: 50,
  });
}

async function getAdCreative(creativeId) {
  return fbApi(`/${creativeId}`, {
    fields: "id,name,title,body,image_url,thumbnail_url,object_story_spec,asset_feed_spec,actor_id",
  });
}

async function getAccountInfo(accountId = activeAccountId) {
  return fbApi(`/${accountId}`, {
    fields: "id,name,account_status,balance,amount_spent,currency,business_name,timezone_name,spend_cap",
  });
}

// --- Insights / Performance ---

async function getCampaignInsights(campaignId, datePreset = "last_7d") {
  return fbApi(`/${campaignId}/insights`, {
    fields: "campaign_name,spend,impressions,clicks,ctr,cpc,cpm,actions,action_values,cost_per_action_type,reach,frequency",
    date_preset: datePreset,
  });
}

async function getAdSetInsights(adSetId, datePreset = "last_7d") {
  return fbApi(`/${adSetId}/insights`, {
    fields: "adset_name,spend,impressions,clicks,ctr,cpc,cpm,actions,action_values,cost_per_action_type,reach,frequency",
    date_preset: datePreset,
  });
}

async function getAdInsights(adId, datePreset = "last_7d") {
  return fbApi(`/${adId}/insights`, {
    fields: "ad_name,spend,impressions,clicks,ctr,cpc,cpm,actions,action_values,cost_per_action_type,reach,frequency",
    date_preset: datePreset,
  });
}

async function getAccountInsights(datePreset = "last_7d", accountId = activeAccountId) {
  return fbApi(`/${accountId}/insights`, {
    fields: "spend,impressions,clicks,ctr,cpc,cpm,actions,action_values,cost_per_action_type,reach,frequency",
    date_preset: datePreset,
  });
}

async function getAccountInsightsByDay(datePreset = "last_7d", accountId = activeAccountId) {
  return fbApi(`/${accountId}/insights`, {
    fields: "spend,impressions,clicks,ctr,cpc,actions,action_values,cost_per_action_type",
    date_preset: datePreset,
    time_increment: 1,
  });
}

// --- Write Operations ---

async function createCampaign(name, objective, { dailyBudget, specialAdCategories = [], status = "PAUSED" } = {}, accountId = activeAccountId) {
  const params = {
    name,
    objective,
    status,
    special_ad_categories: specialAdCategories,
  };
  if (dailyBudget) params.daily_budget = Math.round(dailyBudget * 100); // convert dollars to cents
  return fbApi(`/${accountId}/campaigns`, params, "POST");
}

async function createAdSet(campaignId, name, { dailyBudget, targeting, optimizationGoal = "LEAD_GENERATION", billingEvent = "IMPRESSIONS", bidStrategy = "LOWEST_COST_WITHOUT_CAP", status = "PAUSED", startTime } = {}, accountId = activeAccountId) {
  const params = {
    campaign_id: campaignId,
    name,
    optimization_goal: optimizationGoal,
    billing_event: billingEvent,
    bid_strategy: bidStrategy,
    status,
  };
  if (dailyBudget) params.daily_budget = Math.round(dailyBudget * 100);
  if (targeting) params.targeting = targeting;
  if (startTime) params.start_time = startTime;
  return fbApi(`/${accountId}/adsets`, params, "POST");
}

async function createAd(adSetId, name, creativeId, { status = "PAUSED", trackingSpecs } = {}, accountId = activeAccountId) {
  const params = {
    adset_id: adSetId,
    name,
    creative: { creative_id: creativeId },
    status,
  };
  if (trackingSpecs) params.tracking_specs = trackingSpecs;
  return fbApi(`/${accountId}/ads`, params, "POST");
}

async function createAdCreative(name, { pageId, link, message, headline, description, imageHash, imageUrl, callToAction = "LEARN_MORE" } = {}, accountId = activeAccountId) {
  const objectStorySpec = {
    page_id: pageId || process.env.META_PAGE_ID,
    link_data: {
      link,
      message,
      name: headline,
      description,
      call_to_action: { type: callToAction },
    },
  };
  if (imageHash) objectStorySpec.link_data.image_hash = imageHash;
  if (imageUrl) objectStorySpec.link_data.picture = imageUrl;

  return fbApi(`/${accountId}/adcreatives`, {
    name,
    object_story_spec: objectStorySpec,
  }, "POST");
}

async function uploadImage(imageUrl, accountId = activeAccountId) {
  return fbApi(`/${accountId}/adimages`, {
    url: imageUrl,
  }, "POST");
}

// --- Status Management ---

async function updateStatus(objectId, newStatus) {
  // newStatus: ACTIVE, PAUSED, ARCHIVED
  return fbApi(`/${objectId}`, { status: newStatus }, "POST");
}

async function pauseAd(adId) {
  return updateStatus(adId, "PAUSED");
}

async function enableAd(adId) {
  return updateStatus(adId, "ACTIVE");
}

async function pauseCampaign(campaignId) {
  return updateStatus(campaignId, "PAUSED");
}

async function enableCampaign(campaignId) {
  return updateStatus(campaignId, "ACTIVE");
}

async function pauseAdSet(adSetId) {
  return updateStatus(adSetId, "PAUSED");
}

async function enableAdSet(adSetId) {
  return updateStatus(adSetId, "ACTIVE");
}

// --- Budget Management ---

async function updateDailyBudget(objectId, newBudgetDollars) {
  return fbApi(`/${objectId}`, { daily_budget: Math.round(newBudgetDollars * 100) }, "POST");
}

// --- Formatting Helpers ---

function formatMoney(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatInsights(insights) {
  if (!insights?.data?.length) return "No data available for this period.";

  const d = insights.data[0];

  let text = "";
  text += `Spend: $${parseFloat(d.spend).toFixed(2)}\n`;
  text += `Impressions: ${parseInt(d.impressions).toLocaleString()}\n`;
  text += `Reach: ${parseInt(d.reach).toLocaleString()}\n`;
  text += `Clicks: ${parseInt(d.clicks).toLocaleString()}\n`;
  text += `CTR: ${parseFloat(d.ctr).toFixed(2)}%\n`;
  text += `CPC: $${parseFloat(d.cpc).toFixed(2)}\n`;

  // Show all conversion actions (not just leads/purchases)
  const conversionTypes = [
    { type: "lead", label: "Leads" },
    { type: "onsite_conversion.lead_grouped", label: "Leads" },
    { type: "purchase", label: "Purchases" },
    { type: "offsite_conversion.fb_pixel_purchase", label: "Purchases" },
    { type: "complete_registration", label: "Registrations" },
    { type: "offsite_conversion.fb_pixel_complete_registration", label: "Registrations" },
    { type: "submit_application", label: "Applications" },
    { type: "offsite_conversion.fb_pixel_lead", label: "Pixel Leads" },
    { type: "onsite_web_app_purchase", label: "Web Purchases" },
    { type: "landing_page_view", label: "LP Views" },
  ];

  const shown = new Set();
  let hasConversions = false;

  for (const ct of conversionTypes) {
    if (shown.has(ct.label)) continue;
    const action = d.actions?.find(a => a.action_type === ct.type);
    if (action) {
      const count = parseInt(action.value);
      const costAction = d.cost_per_action_type?.find(a => a.action_type === ct.type);
      const cost = costAction ? `$${parseFloat(costAction.value).toFixed(2)}` : "N/A";
      text += `${ct.label}: ${count} | Cost: ${cost}\n`;
      shown.add(ct.label);
      hasConversions = true;
    }
  }

  // Show conversion value / ROAS if available
  if (d.action_values) {
    const purchaseValue = d.action_values.find(a => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase");
    if (purchaseValue) {
      const value = parseFloat(purchaseValue.value);
      const spend = parseFloat(d.spend);
      const roas = spend > 0 ? (value / spend).toFixed(2) : "N/A";
      text += `Revenue: $${value.toFixed(2)}\n`;
      text += `ROAS: ${roas}x\n`;
    }
  }

  if (!hasConversions) {
    text += `Conversions: 0\n`;
  }

  return text;
}

function formatCampaignList(campaigns) {
  if (!campaigns?.data?.length) return "No campaigns found.";

  let text = "";
  for (const c of campaigns.data) {
    const status = c.status === "ACTIVE" ? "🟢" : c.status === "PAUSED" ? "🟡" : "⚫";
    const budget = c.daily_budget ? formatMoney(c.daily_budget) + "/day" : c.lifetime_budget ? formatMoney(c.lifetime_budget) + " lifetime" : "no budget set";
    text += `${status} ${c.name}\n   ID: ${c.id} | ${budget}\n\n`;
  }
  return text;
}

function formatAdSetList(adSets) {
  if (!adSets?.data?.length) return "No ad sets found.";

  let text = "";
  for (const a of adSets.data) {
    const status = a.status === "ACTIVE" ? "🟢" : a.status === "PAUSED" ? "🟡" : "⚫";
    const budget = a.daily_budget ? formatMoney(a.daily_budget) + "/day" : a.lifetime_budget ? formatMoney(a.lifetime_budget) + " lifetime" : "no budget";
    text += `${status} ${a.name}\n   ID: ${a.id} | ${budget}\n\n`;
  }
  return text;
}

function formatAdList(ads) {
  if (!ads?.data?.length) return "No ads found.";

  let text = "";
  for (const a of ads.data) {
    const status = a.status === "ACTIVE" ? "🟢" : a.status === "PAUSED" ? "🟡" : "⚫";
    text += `${status} ${a.name}\n   ID: ${a.id}\n\n`;
  }
  return text;
}

// --- Batch Operations ---

async function listAllAdAccounts() {
  // Returns merged, deduplicated accounts from all configured tokens
  return tokens.getAllAccounts();
}

async function getMultiAccountInsights(accounts, datePreset = "today") {
  const results = new Map();
  const insightFields = "spend,impressions,clicks,ctr,cpc,cpm,actions,action_values,cost_per_action_type,reach,frequency";

  // Normalize account IDs
  const accountIds = accounts.map((a) => (typeof a === "string" ? a : a.id));

  // Group by token (different BMs need separate batch calls)
  const tokenGroups = await groupByToken(accountIds);

  for (const [token, acctIds] of tokenGroups) {
    // Use Facebook Batch API — up to 50 per call (1 API call instead of 50)
    const endpoints = acctIds.map((acctId) => ({
      endpoint: `/${acctId}/insights`,
      params: { fields: insightFields, date_preset: datePreset },
    }));

    const responses = await fbBatchGet(endpoints, token);

    for (let i = 0; i < acctIds.length; i++) {
      if (responses[i]) {
        results.set(acctIds[i], responses[i]);
      }
    }
  }
  return results;
}

async function getCampaignInsightsBatch(campaignIds, datePreset = "last_7d") {
  const results = new Map();
  const insightFields = "campaign_name,spend,impressions,clicks,ctr,cpc,cpm,actions,action_values,cost_per_action_type,reach,frequency";

  // Campaign IDs don't encode the account, so use context token resolution
  const token = contextToken || (await tokens.getTokenForAccount(activeAccountId));

  for (let i = 0; i < campaignIds.length; i += BATCH_API_MAX) {
    const chunk = campaignIds.slice(i, i + BATCH_API_MAX);
    const endpoints = chunk.map((id) => ({
      endpoint: `/${id}/insights`,
      params: { fields: insightFields, date_preset: datePreset },
    }));

    const responses = await fbBatchGet(endpoints, token);

    for (let j = 0; j < chunk.length; j++) {
      if (responses[j]) {
        results.set(chunk[j], responses[j]);
      }
    }
  }
  return results;
}

async function getAdSetInsightsBatch(adSetIds, datePreset = "last_7d") {
  const results = new Map();
  const insightFields = "adset_name,spend,impressions,clicks,ctr,cpc,cpm,actions,action_values,cost_per_action_type,reach,frequency";

  const token = contextToken || (await tokens.getTokenForAccount(activeAccountId));

  for (let i = 0; i < adSetIds.length; i += BATCH_API_MAX) {
    const chunk = adSetIds.slice(i, i + BATCH_API_MAX);
    const endpoints = chunk.map((id) => ({
      endpoint: `/${id}/insights`,
      params: { fields: insightFields, date_preset: datePreset },
    }));

    const responses = await fbBatchGet(endpoints, token);

    for (let j = 0; j < chunk.length; j++) {
      if (responses[j]) {
        results.set(chunk[j], responses[j]);
      }
    }
  }
  return results;
}

async function getAccountAdSets(accountId = activeAccountId) {
  return fbApi(`/${accountId}/adsets`, {
    fields: "id,name,status,daily_budget,lifetime_budget,campaign_id",
    effective_status: '["ACTIVE"]',
    limit: 100,
  });
}

// --- Ad Duplication ---

async function getAdFull(adId) {
  return fbApi(`/${adId}`, {
    fields: "id,name,status,creative{id,name,object_story_spec,image_url,image_hash,thumbnail_url},adset_id,campaign_id,tracking_specs",
  });
}

async function getAdSetFull(adSetId) {
  return fbApi(`/${adSetId}`, {
    fields: "id,name,status,daily_budget,lifetime_budget,targeting,optimization_goal,billing_event,bid_strategy,start_time,end_time,campaign_id,promoted_object",
  });
}

async function uploadImageBytes(base64Data, accountId = activeAccountId) {
  return fbApi(`/${accountId}/adimages`, {
    bytes: base64Data,
  }, "POST");
}

async function uploadVideo(buffer, name, accountId = activeAccountId) {
  // Facebook video upload via multipart form data to /act_xxx/advideos
  const acctId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const url = `${BASE_URL}/${acctId}/advideos`;
  const accessToken = await tokens.getTokenForAccount(acctId);

  const formData = new FormData();
  formData.append("access_token", accessToken);
  formData.append("title", name);
  const blob = new Blob([buffer], { type: "video/mp4" });
  formData.append("source", blob, name);

  const res = await fetch(url, { method: "POST", body: formData });
  const data = await res.json();
  if (data.error) throw new Error(`FB Video Upload: ${data.error.message}`);
  return { videoId: data.id };
}

async function waitForVideoReady(videoId, maxWaitMs = 120000) {
  // Poll video status until it's ready for use in ads
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const data = await fbApi(`/${videoId}`, { fields: "status" });
    const phase = data.status?.video_status;
    if (phase === "ready") return true;
    if (phase === "error") throw new Error(`Video ${videoId} processing failed`);
    await new Promise(r => setTimeout(r, 3000)); // check every 3s
  }
  throw new Error(`Video ${videoId} not ready after ${maxWaitMs / 1000}s`);
}

async function createVideoAdCreative(name, { videoId, pageId, instagramId, link, linkCaption, callToAction = "LEARN_MORE", imageHash, message } = {}, accountId = activeAccountId) {
  const acctId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const videoData = {
    video_id: videoId,
    call_to_action: {
      type: callToAction,
      value: { link, link_caption: linkCaption },
    },
  };
  if (imageHash) videoData.image_hash = imageHash;
  if (message) videoData.message = message;

  const objectStorySpec = {
    page_id: pageId,
    video_data: videoData,
  };
  if (instagramId) objectStorySpec.instagram_user_id = instagramId;

  return fbApi(`/${acctId}/adcreatives`, {
    name,
    object_story_spec: objectStorySpec,
  }, "POST");
}

async function duplicateAdSet(sourceAdSetId, { newName, accountId } = {}) {
  const source = await getAdSetFull(sourceAdSetId);

  const params = {
    campaign_id: source.campaign_id,
    name: newName || `${source.name} - Copy`,
    optimization_goal: source.optimization_goal,
    billing_event: source.billing_event,
    bid_strategy: source.bid_strategy,
    status: "ACTIVE",
  };
  if (source.targeting) params.targeting = source.targeting;
  if (source.daily_budget) params.daily_budget = source.daily_budget;
  if (source.lifetime_budget) params.lifetime_budget = source.lifetime_budget;
  if (source.promoted_object) params.promoted_object = source.promoted_object;

  const targetAcct = accountId || activeAccountId;
  return fbApi(`/${targetAcct}/adsets`, params, "POST");
}

async function countAdsInAdSet(adSetId) {
  const data = await fbApi(`/${adSetId}/ads`, { fields: "id", limit: 100 });
  return data.data ? data.data.length : 0;
}

async function duplicateAd(sourceAdId, { newName, imageHash, imageUrl, accountId, status = "ACTIVE" } = {}) {
  // 1. Get source ad with full creative details
  const sourceAd = await getAdFull(sourceAdId);
  const creativeId = sourceAd.creative?.id;
  if (!creativeId) throw new Error(`Ad ${sourceAdId} has no creative`);

  // 2. Get the full creative
  const sourceCreative = await getAdCreative(creativeId);
  const acctId = accountId || activeAccountId;

  // 3. Build new creative with swapped image
  const storySpec = { ...sourceCreative.object_story_spec };
  if (!storySpec) throw new Error(`Creative ${creativeId} has no object_story_spec`);

  if (storySpec.link_data) {
    // Source is an image/link ad — swap the image
    storySpec.link_data = { ...storySpec.link_data };
    if (imageHash) storySpec.link_data.image_hash = imageHash;
    if (imageUrl) storySpec.link_data.picture = imageUrl;
  } else if (storySpec.video_data && (imageHash || imageUrl)) {
    // Source is a video ad but we're inserting an image — convert to link_data creative
    const vd = storySpec.video_data;
    const link = vd.call_to_action?.value?.link || vd.link_url || "";
    const cta = vd.call_to_action?.type || "LEARN_MORE";
    const message = vd.message || "";
    storySpec.link_data = {
      link,
      message,
      image_hash: imageHash || undefined,
      picture: imageUrl || undefined,
      call_to_action: { type: cta, value: { link } },
    };
    delete storySpec.video_data;
  }

  // 4. Create new creative
  const newCreative = await fbApi(`/${acctId}/adcreatives`, {
    name: newName || `${sourceCreative.name} - copy`,
    object_story_spec: storySpec,
  }, "POST");

  // 5. Create new ad in same ad set
  const newAd = await fbApi(`/${acctId}/ads`, {
    adset_id: sourceAd.adset_id,
    name: newName || `${sourceAd.name} - copy`,
    creative: { creative_id: newCreative.id },
    status,
    tracking_specs: sourceAd.tracking_specs || undefined,
  }, "POST");

  return { adId: newAd.id, creativeId: newCreative.id, adSetId: sourceAd.adset_id };
}

function isConfigured() {
  return !!(tokens.hasTokens() && activeAccountId);
}

/**
 * Run a function with a specific token in context.
 * Useful for batched operations on object IDs (campaigns, ad sets, ads)
 * that don't contain the account ID in the endpoint.
 */
async function withToken(token, fn) {
  const prev = contextToken;
  contextToken = token;
  try {
    return await fn();
  } finally {
    contextToken = prev;
  }
}

module.exports = {
  // Read
  getCampaigns,
  getAdSets,
  getAds,
  getAdCreative,
  getAccountInfo,
  // Insights
  getCampaignInsights,
  getAdSetInsights,
  getAdInsights,
  getAccountInsights,
  getAccountInsightsByDay,
  // Write
  createCampaign,
  createAdSet,
  createAd,
  createAdCreative,
  uploadImage,
  // Status
  updateStatus,
  pauseAd,
  enableAd,
  pauseCampaign,
  enableCampaign,
  pauseAdSet,
  enableAdSet,
  // Budget
  updateDailyBudget,
  // Formatting
  formatMoney,
  formatInsights,
  formatCampaignList,
  formatAdSetList,
  formatAdList,
  // Multi-account
  listAdAccounts,
  setActiveAccount,
  getActiveAccount,
  // Batch
  listAllAdAccounts,
  getMultiAccountInsights,
  getCampaignInsightsBatch,
  getAdSetInsightsBatch,
  getAccountAdSets,
  // Ad duplication
  getAdFull,
  getAdSetFull,
  uploadImageBytes,
  duplicateAd,
  // Video
  uploadVideo,
  waitForVideoReady,
  createVideoAdCreative,
  // Ad set operations
  duplicateAdSet,
  countAdsInAdSet,
  // Config
  isConfigured,
  // Multi-token
  withToken,
  // Rate limit optimizations
  cache,
  fetchAsyncInsights,
  fbBatchGet,
  groupByToken,
};
