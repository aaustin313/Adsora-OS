const { askClaude, clearHistory: clearClaudeHistory } = require("./claude");
const { isAuthenticated } = require("../google/auth");
const { listFiles, searchFiles, readGoogleDoc } = require("../google/drive");
const { listEmails, searchEmails, readEmail } = require("../google/gmail");
const { getUpcomingEvents } = require("../google/calendar");
const { isCopywritingRequest, getSwipeContext, COPYWRITER_SYSTEM_PROMPT } = require("./copywriter");
const { isLpBuilderRequest, cloneLandingPage, buildLandingPage, formatResultsForTelegram, extractUrl } = require("../lp-builder");
const fb = require("../facebook/ads");
const clickflare = require("../clickflare/client");

// Keywords that indicate ClickFlare revenue/tracking data is needed
const TRACKING_PATTERNS = [
  /\b(revenue|profit|roi\b|roas\b|earnings|payout|income)\b/i,
  /\b(clickflare|tracking|attribution|conversion\s*data)\b/i,
  /\b(how much.*(made|earned|making|earning)|what.*(revenue|profit))\b/i,
  /\b(real\s*(numbers|data|results|revenue|profit))\b/i,
  /\b(epc|earnings per click|cost per acquisition)\b/i,
];

// Keywords that indicate Facebook Ads data is needed
const FB_PATTERNS = [
  /\b(ad\s*spend|ads?\s*performance|campaign\s*performance|how\s*are\s*(my|our|the)\s*ads?)\b/i,
  /\b(facebook\s*ads?|fb\s*ads?|meta\s*ads?)\b/i,
  /\b(cpl|cpa|roas|ctr|cpc|cpm)\b/i,
  /\b(ad\s*account|adset|ad\s*set|campaign)\b/i,
  /\b(spend|budget|impressions|clicks|leads|conversions)\b/i,
  /\b(performance|metrics|results|stats|numbers|how.*(doing|performing|going))\b/i,
  /\b(pause|enable|scale|kill|cut)\s*(the\s*)?(ad|campaign|adset)/i,
  /\b(what('?s| is| are)\s*(the\s*)?(spend|budget|results|performance))\b/i,
];

// Keywords that indicate Google data is needed
const DATA_PATTERNS = [
  /\b(email|emails|inbox|gmail|mail)\b/i,
  /\b(calendar|schedule|meeting|event|appointment)\b/i,
  /\b(drive|files|documents?|docs?|folder|google doc|spreadsheet|sheet)\b/i,
  /\b(what'?s on my|show me my|check my|list my|read my|scan my|search my)\b/i,
  /\b(who sent|who emailed|any emails from|what came in)\b/i,
  /\b(schedule a|create event|book a|set up a meeting|block off)\b/i,
];

// Keywords for specific pipeline sub-agents
const RESEARCH_PATTERNS = [
  /\b(research|competitor|ad library|spy|what ads)\b.*\b(running|competitors?|market|offers?)\b/i,
  /\b(creative\s*research|ad\s*research|market\s*research)\b/i,
];
const EVALUATE_PATTERNS = [
  /\b(evaluate|score)\b.*\b(offer|landing page|lp|url|this)\b/i,
  /\b(is this|will this|would this)\b.*\b(work|convert|perform)\b.*\b(on facebook|on fb|on meta)\b/i,
];
const SCRIPT_PATTERNS = [
  /\b(generate|write|create)\b.*\b(scripts?|angles?|hooks?|concepts?)\b.*\b(for|about)\b/i,
];
const FULL_PIPELINE_PATTERNS = [
  /\b(pipeline|creative\s*pipeline|end.to.end|production\s*pipeline|full pipeline)\b/i,
];

// Keywords that indicate ad launch intent
const LAUNCH_PATTERNS = [
  /\b(launch|push|deploy|create|duplicate|dupe)\b.{0,40}\b(ads?|creatives?|images?|videos?)\b/i,
  /\blaunch\s+(them|it|these|those)\s+(in|into|to|on)\b/i,
  /\b(from|in)\s+(this|the|that|my)\s*(drive|folder|google)\b.*\b(account|campaign)\b/i,
  /\b(into|to)\s+(the|my|our\s+)?.{1,30}\s*accounts?\b/i,
];

// Keywords that indicate deep thinking (Claude)
const STRATEGY_PATTERNS = [
  /\b(advice|advise|strategy|strategic|should i|what do you think|recommend|opinion)\b/i,
  /\b(decision|plan|approach|idea|opportunity|risk|mistake)\b/i,
  /\b(write|draft|compose|copywriting|copy|headline|ad copy|email draft|script)\b/i,
  /\b(analyze|analysis|compare|evaluate|assess|review my|break down)\b/i,
  /\b(code|build|develop|software|bug|feature|api|deploy)\b/i,
  /\b(budget|spend|invest|roi|profit|revenue|pricing|cost|10x|scale)\b/i,
  /\b(use claude|ask claude|think hard|deep think)\b/i,
];

// --- Direct Google data fetch (no Gemini needed) ---
async function fetchGoogleDataDirect(userMessage) {
  if (!isAuthenticated()) return null;

  const msg = userMessage.toLowerCase();
  const results = [];

  try {
    // Calendar data
    if (/calendar|schedule|meeting|event|appointment|what'?s on|today|tomorrow|this week/i.test(msg)) {
      const events = await getUpcomingEvents(48);
      if (events.length > 0) {
        let cal = "📅 CALENDAR (next 48 hours):\n";
        for (const e of events) {
          const start = new Date(e.start).toLocaleString("en-US", {
            weekday: "short", hour: "numeric", minute: "2-digit",
          });
          cal += `• ${start} — ${e.summary}`;
          if (e.location) cal += ` (📍 ${e.location})`;
          cal += "\n";
        }
        results.push(cal);
      } else {
        results.push("📅 CALENDAR: No events in the next 48 hours.");
      }
    }

    // Email data
    if (/email|inbox|gmail|mail|who sent|who emailed/i.test(msg)) {
      const emails = await listEmails(10);
      if (emails.length > 0) {
        let mail = "📧 RECENT EMAILS:\n";
        for (const e of emails) {
          const from = e.from.split("<")[0].trim();
          mail += `• ${e.subject} — from ${from}\n  ${e.snippet?.slice(0, 80) || ""}...\n`;
        }
        results.push(mail);
      }
    }

    // Drive data
    if (/drive|files|documents?|docs?|folder|spreadsheet|sheet/i.test(msg)) {
      const files = await listFiles(10);
      if (files.length > 0) {
        let drive = "📁 RECENT DRIVE FILES:\n";
        for (const f of files) {
          drive += `• ${f.name} (${f.mimeType.split(".").pop()})\n`;
        }
        results.push(drive);
      }
    }
  } catch (err) {
    console.log(`[DIRECT FETCH] Error: ${err.message?.slice(0, 100)}`);
  }

  return results.length > 0 ? results.join("\n") : null;
}

// --- Account cache for faster multi-account queries ---
let accountCache = { accounts: null, fetchedAt: 0 };
const ACCOUNT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedAccounts() {
  if (accountCache.accounts && Date.now() - accountCache.fetchedAt < ACCOUNT_CACHE_TTL) {
    return accountCache.accounts;
  }
  const accounts = await fb.listAllAdAccounts();
  accountCache = { accounts, fetchedAt: Date.now() };
  return accounts;
}

// --- Fetch Facebook Ads data based on the user's question ---
async function fetchFacebookData(userMessage) {
  if (!fb.isConfigured()) return null;

  const msg = userMessage.toLowerCase();
  const results = [];

  try {
    // Account-level performance (most common ask)
    if (/spend|performance|how.*(doing|performing|going)|results|stats|numbers|metrics|cpl|cpa|roas/i.test(msg)) {
      // Determine time range
      let datePreset = "today";
      if (/yesterday/i.test(msg)) datePreset = "yesterday";
      else if (/last\s*7|this\s*week|past\s*week/i.test(msg)) datePreset = "last_7d";
      else if (/last\s*30|this\s*month|past\s*month/i.test(msg)) datePreset = "last_30d";
      else if (/today/i.test(msg)) datePreset = "today";

      // Check if asking about all accounts or specific
      if (/all\s*(our|my|the)?\s*account/i.test(msg)) {
        const accounts = await getCachedAccounts();
        const activeAccounts = accounts.filter(a => a.account_status === 1);

        // Parallel batch fetching — all accounts, no cap
        const insightsMap = await fb.getMultiAccountInsights(activeAccounts, datePreset);

        let summaryText = `\u{1F4CA} FB ADS — ALL ACCOUNTS (${datePreset}):\n\n`;
        let totalSpend = 0;
        let accountResults = [];

        for (const acct of activeAccounts) {
          const insights = insightsMap.get(acct.id);
          if (!insights?.data?.length) continue;
          const d = insights.data[0];
          const spend = parseFloat(d.spend || 0);
          if (spend > 0) {
            totalSpend += spend;
            accountResults.push({ name: acct.name, id: acct.id, data: d, spend });
          }
        }

        accountResults.sort((a, b) => b.spend - a.spend);

        summaryText += `\u{1F4B0} Total Spend: $${totalSpend.toFixed(2)}\n`;
        summaryText += `\u{1F4CB} Active Accounts: ${accountResults.length}/${activeAccounts.length}\n\n`;

        for (const r of accountResults) {
          const d = r.data;
          let line = `\u2022 ${r.name}: $${r.spend.toFixed(2)} spend`;
          if (d.clicks) line += ` | ${parseInt(d.clicks)} clicks`;
          if (d.impressions) line += ` | ${parseInt(d.impressions).toLocaleString()} impr`;

          const leadAction = d.actions?.find(a =>
            a.action_type === "lead" || a.action_type === "onsite_conversion.lead_grouped"
          );
          const purchaseAction = d.actions?.find(a =>
            a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase"
          );
          if (leadAction) line += ` | ${leadAction.value} leads`;
          if (purchaseAction) line += ` | ${purchaseAction.value} purchases`;

          summaryText += line + "\n";
        }

        results.push(summaryText);
      } else {
        // Single account (active account)
        const accountInfo = await fb.getAccountInfo();
        const insights = await fb.getAccountInsights(datePreset);
        let text = `\u{1F4CA} FB ADS — ${accountInfo.name || fb.getActiveAccount()} (${datePreset}):\n`;
        text += fb.formatInsights(insights);
        results.push(text);
      }
    }

    // Campaign list
    if (/campaign|what.*(running|active|live)/i.test(msg) && !/performance|spend|results/i.test(msg)) {
      const campaigns = await fb.getCampaigns();
      results.push("\u{1F4CB} CAMPAIGNS:\n" + fb.formatCampaignList(campaigns));
    }

  } catch (err) {
    console.log(`[FB FETCH] Error: ${err.message?.slice(0, 100)}`);
    results.push(`\u26A0\uFE0F FB API error: ${err.message?.slice(0, 100)}`);
  }

  return results.length > 0 ? results.join("\n") : null;
}

// --- Fetch ClickFlare revenue data based on user's question ---
async function fetchClickFlareData(userMessage) {
  if (!clickflare.isConfigured()) return null;

  const msg = userMessage.toLowerCase();

  try {
    // Determine time range
    let preset = "today";
    if (/yesterday/i.test(msg)) preset = "yesterday";
    else if (/last\s*7|this\s*week|past\s*week/i.test(msg)) preset = "last_7d";
    else if (/last\s*30|this\s*month|past\s*month/i.test(msg)) preset = "last_30d";
    else if (/today/i.test(msg)) preset = "today";

    // Determine grouping
    let reportData;
    if (/\b(offer|affiliate|network)\b/i.test(msg)) {
      reportData = await clickflare.getRevenueByOffer(preset);
    } else if (/\b(daily|trend|day.by.day|each day)\b/i.test(msg)) {
      reportData = await clickflare.getDailyBreakdown(preset);
    } else if (/\b(source|traffic source|where.*coming)\b/i.test(msg)) {
      reportData = await clickflare.getRevenueBySource(preset);
    } else {
      reportData = await clickflare.getRevenueByCampaign(preset);
    }

    return clickflare.formatForClaude(reportData, preset);
  } catch (err) {
    console.log(`[CLICKFLARE FETCH] Error: ${err.message?.slice(0, 100)}`);
    return `⚠️ ClickFlare error: ${err.message?.slice(0, 100)}`;
  }
}

function routeMessage(message) {
  // Landing page builder requests
  if (isLpBuilderRequest(message)) return "lp-builder";

  // Copywriting requests get swipe file context
  if (isCopywritingRequest(message)) return "claude+copy";

  // Pipeline sub-agent detection (most specific first)
  if (FULL_PIPELINE_PATTERNS.some(p => p.test(message))) return "pipeline";
  if (RESEARCH_PATTERNS.some(p => p.test(message))) return "pipeline-research";
  if (EVALUATE_PATTERNS.some(p => p.test(message))) return "pipeline-evaluate";
  if (SCRIPT_PATTERNS.some(p => p.test(message))) return "pipeline-scripts";

  // Ad launch intent detection
  const launchScore = LAUNCH_PATTERNS.reduce(
    (score, pattern) => score + (pattern.test(message) ? 1 : 0), 0
  );
  if (launchScore >= 2) return "launch";

  const fbScore = FB_PATTERNS.reduce(
    (score, pattern) => score + (pattern.test(message) ? 1 : 0), 0
  );

  const dataScore = DATA_PATTERNS.reduce(
    (score, pattern) => score + (pattern.test(message) ? 1 : 0), 0
  );

  const trackingScore = TRACKING_PATTERNS.reduce(
    (score, pattern) => score + (pattern.test(message) ? 1 : 0), 0
  );

  // Revenue/tracking queries get both FB spend + ClickFlare revenue for full picture
  if (trackingScore > 0 && fbScore > 0) return "claude+fb+tracking";
  if (trackingScore > 0) return "claude+tracking";

  // If both FB and Google data needed, fetch both
  if (fbScore > 0 && dataScore > 0) return "claude+fb+data";

  // Facebook Ads data needed
  if (fbScore > 0) return "claude+fb";

  // If Google data is needed, fetch it and pass to Claude
  if (dataScore > 0) return "claude+data";

  // Everything else → Claude
  return "claude";
}

// --- Per-chat lock to prevent duplicate concurrent requests ---
const activeCalls = new Set();

async function askAI(chatId, userMessage) {
  if (activeCalls.has(chatId)) {
    return { text: "⏳ Still working on your last message...", model: "system" };
  }
  activeCalls.add(chatId);

  try {
    const route = routeMessage(userMessage);
    console.log(`[ROUTER] "${userMessage.slice(0, 60)}..." → ${route}`);

    if (route === "pipeline") {
      console.log("[ROUTER] Full pipeline intent detected");
      return { text: "__PIPELINE__:" + userMessage, model: "pipeline" };
    }
    if (route === "pipeline-research") {
      console.log("[ROUTER] Research intent detected");
      return { text: "__RESEARCH__:" + userMessage, model: "pipeline-research" };
    }
    if (route === "pipeline-evaluate") {
      console.log("[ROUTER] Evaluate intent detected");
      return { text: "__EVALUATE__:" + userMessage, model: "pipeline-evaluate" };
    }
    if (route === "pipeline-scripts") {
      console.log("[ROUTER] Scripts intent detected");
      return { text: "__SCRIPTS__:" + userMessage, model: "pipeline-scripts" };
    }

    if (route === "launch") {
      console.log("[ROUTER] Ad launch intent detected");
      return { text: "__LAUNCH__:" + userMessage, model: "launch" };
    }

    if (route === "lp-builder") {
      console.log("[ROUTER] Landing page builder request detected");
      const url = extractUrl(userMessage);
      try {
        if (url) {
          const elevate = /higher\s*level|upgrade|premium|elevate|better/i.test(userMessage);
          const results = await cloneLandingPage(url, { elevate });
          return { text: formatResultsForTelegram(results), model: "lp-builder" };
        } else {
          const results = await buildLandingPage(userMessage);
          return { text: formatResultsForTelegram(results), model: "lp-builder" };
        }
      } catch (err) {
        return { text: `❌ Landing page builder error: ${err.message}`, model: "lp-builder" };
      }
    }

    if (route === "claude+copy") {
      console.log("[ROUTER] Copywriting request — loading swipe files...");
      try {
        const swipeContext = await getSwipeContext();
        const enrichedMessage = `${COPYWRITER_SYSTEM_PROMPT}\n\n${swipeContext}\n\n--- AUSTIN'S REQUEST ---\n${userMessage}`;
        const response = await askClaude(chatId, enrichedMessage);
        return { text: response, model: "claude" };
      } catch (err) {
        console.error("[ROUTER] Swipe file load failed, falling back to Claude without swipes:", err.message);
        const fallbackMessage = `${COPYWRITER_SYSTEM_PROMPT}\n\n(Swipe files unavailable: ${err.message})\n\n--- AUSTIN'S REQUEST ---\n${userMessage}`;
        const response = await askClaude(chatId, fallbackMessage);
        return { text: response, model: "claude" };
      }
    }

    if (route === "claude+fb+tracking") {
      console.log("[ROUTER] Fetching Facebook Ads + ClickFlare tracking data...");
      const [fbSummary, trackingSummary] = await Promise.all([
        fetchFacebookData(userMessage),
        fetchClickFlareData(userMessage),
      ]);
      let enrichedMessage = userMessage;
      if (fbSummary) enrichedMessage += `\n\n--- LIVE FACEBOOK ADS DATA (fetched just now) ---\n${fbSummary}`;
      if (trackingSummary) enrichedMessage += `\n\n--- LIVE CLICKFLARE REVENUE DATA (fetched just now) ---\n${trackingSummary}`;
      const response = await askClaude(chatId, enrichedMessage);
      return { text: response, model: "claude" };
    }

    if (route === "claude+tracking") {
      console.log("[ROUTER] Fetching ClickFlare tracking data...");
      const trackingSummary = await fetchClickFlareData(userMessage);
      const enrichedMessage = trackingSummary
        ? `${userMessage}\n\n--- LIVE CLICKFLARE REVENUE DATA (fetched just now) ---\n${trackingSummary}`
        : userMessage;
      const response = await askClaude(chatId, enrichedMessage);
      return { text: response, model: "claude" };
    }

    if (route === "claude+fb+data") {
      console.log("[ROUTER] Fetching Facebook Ads + Google data...");
      const [fbSummary, dataSummary] = await Promise.all([
        fetchFacebookData(userMessage),
        fetchGoogleDataDirect(userMessage),
      ]);
      let enrichedMessage = userMessage;
      if (fbSummary) enrichedMessage += `\n\n--- LIVE FACEBOOK ADS DATA (fetched just now) ---\n${fbSummary}`;
      if (dataSummary) enrichedMessage += `\n\n--- LIVE GOOGLE DATA (fetched just now) ---\n${dataSummary}`;
      const response = await askClaude(chatId, enrichedMessage);
      return { text: response, model: "claude" };
    }

    if (route === "claude+fb") {
      console.log("[ROUTER] Fetching Facebook Ads data...");
      const fbSummary = await fetchFacebookData(userMessage);
      const enrichedMessage = fbSummary
        ? `${userMessage}\n\n--- LIVE FACEBOOK ADS DATA (fetched just now) ---\n${fbSummary}`
        : userMessage;
      const response = await askClaude(chatId, enrichedMessage);
      return { text: response, model: "claude" };
    }

    if (route === "claude+data") {
      console.log("[ROUTER] Fetching Google data directly...");
      const dataSummary = await fetchGoogleDataDirect(userMessage);
      const enrichedMessage = dataSummary
        ? `${userMessage}\n\n--- LIVE GOOGLE DATA (fetched just now) ---\n${dataSummary}`
        : userMessage;
      const response = await askClaude(chatId, enrichedMessage);
      return { text: response, model: "claude" };
    }

    // Pure Claude
    const response = await askClaude(chatId, userMessage);
    return { text: response, model: "claude" };
  } finally {
    activeCalls.delete(chatId);
  }
}

function clearAllHistory(chatId) {
  clearClaudeHistory(chatId);
}

module.exports = { askAI, clearAllHistory, routeMessage };
