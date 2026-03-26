const { Bot, InputFile } = require("grammy");
const { askAI, clearAllHistory } = require("../ai/router");
const { transcribeVoice } = require("../ai/transcribe");
const { isAuthenticated, getAuthUrl } = require("../google/auth");
const { listFiles, searchFiles, readGoogleDoc, readGoogleSheet } = require("../google/drive");
const { listEmails, readEmail, searchEmails } = require("../google/gmail");
const { getUpcomingEvents } = require("../google/calendar");
const { loadSwipeFiles, clearSwipeCache } = require("../ai/copywriter");
const { cloneLandingPage, buildLandingPage, formatResultsForTelegram, extractUrl } = require("../lp-builder");
const fb = require("../facebook/ads");
const clickflare = require("../clickflare/client");
const { scanAllAccounts, formatAlertMessage, formatDailySummary, getLastScan } = require("../facebook/monitor");
const launchFlow = require("./launchFlow");
const forwardLaunchFlow = require("./forwardLaunchFlow");
const pipelineFlow = require("./pipelineFlow");
const fs = require("fs");
const path = require("path");

// Alert suppression toggle
let alertsEnabled = true;

// Pending confirmations for dangerous FB operations (enable, budget changes)
const pendingConfirmations = new Map();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_OWNER_ID = process.env.TELEGRAM_OWNER_ID;
const MSG_LOG_PATH = path.join(__dirname, "..", "..", "logs", "telegram-messages.jsonl");

function startTelegramBot() {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_OWNER_ID) {
    console.warn("⚠️  Telegram bot not configured — skipping. Set TELEGRAM_BOT_TOKEN and TELEGRAM_OWNER_ID in .env");
    return;
  }

  const bot = new Bot(TELEGRAM_BOT_TOKEN);

  // Security: only respond to Austin
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id?.toString();
    if (userId !== TELEGRAM_OWNER_ID) {
      console.log(`Blocked message from unauthorized user: ${userId}`);
      return;
    }
    await next();
  });

  // Log all messages for context retrieval
  bot.use(async (ctx, next) => {
    try {
      const logDir = path.dirname(MSG_LOG_PATH);
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const entry = {
        ts: new Date().toISOString(),
        from: ctx.from?.first_name || "Austin",
        type: ctx.message?.text ? "text" : ctx.message?.voice ? "voice" : "other",
        text: ctx.message?.text || ctx.message?.caption || "",
        chat_id: ctx.chat?.id,
      };
      fs.appendFileSync(MSG_LOG_PATH, JSON.stringify(entry) + "\n");
    } catch {}
    await next();
  });

  // Meta kill switch middleware — block FB commands when paused
  const META_COMMANDS = new Set(["fb", "accounts", "switch", "campaigns", "adsets", "ads", "perf", "pause", "enable", "budget", "monitor", "launch"]);
  bot.use(async (ctx, next) => {
    const text = ctx.message?.text || "";
    if (text.startsWith("/")) {
      const cmd = text.split(/[\s@]/)[0].slice(1).toLowerCase();
      if (META_COMMANDS.has(cmd)) {
        const { isMetaPaused, getStatus } = require("../meta/killSwitch");
        if (isMetaPaused()) {
          const status = getStatus();
          await ctx.reply(`⛔ Meta kill switch is ACTIVE (${status.duration}min)\n\nAll FB commands blocked. Use /meta start to resume.`);
          return;
        }
      }
    }
    await next();
  });

  // /start command
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "🟢 Adsora Bot is live!\n\n" +
      "Just type naturally — I'm your AI business advisor.\n\n" +
      "Quick commands:\n" +
      "/clear — Reset conversation\n" +
      "/help — Show commands"
    );
  });

  // /clear command
  bot.command("clear", async (ctx) => {
    clearAllHistory(ctx.chat.id);
    await ctx.reply("🔄 Conversation cleared. Fresh start!");
  });

  // /help command
  bot.command("help", async (ctx) => {
    await ctx.reply(
      "📋 Adsora Bot Commands\n\n" +
      "Just chat naturally for advice, questions, or tasks.\n\n" +
      "General:\n" +
      "/clear — Reset conversation memory\n" +
      "/help — Show this message\n\n" +
      "Google Drive:\n" +
      "/drive — Recent files\n" +
      "/drive [query] — Search files\n" +
      "/doc [fileId] — Read a Google Doc\n\n" +
      "Gmail:\n" +
      "/gmail — Recent emails\n" +
      "/gmail [query] — Search emails\n" +
      "/email [id] — Read full email\n\n" +
      "Calendar:\n" +
      "/calendar — Today's events\n\n" +
      "Copywriter:\n" +
      "/copy [request] — Generate ad copy using swipe files\n" +
      "/swipe — View loaded swipe files\n" +
      "/swipe refresh — Reload swipe files from Drive\n\n" +
      "Landing Pages:\n" +
      "/clone [url] — Clone a landing page from URL\n" +
      "/lp [description] — Build a landing page from scratch\n\n" +
      "Creative Pipeline:\n" +
      "/pipeline <offer> — Full end-to-end creative production\n" +
      "/research <offer> — Research competitor ads + trends\n" +
      "/evaluate <url> — Score an offer for FB (0-10)\n" +
      "/scripts <offer> — Research + generate ad scripts\n" +
      "/pipeline status — Check pipeline progress\n" +
      "/pipeline cancel — Stop running pipeline\n\n" +
      "Facebook Ads:\n" +
      "/accounts [search] — List all ad accounts\n" +
      "/switch [id or name] — Switch active account\n" +
      "/fb — Account overview + today's stats\n" +
      "/campaigns — List all campaigns\n" +
      "/adsets [campaignId] — List ad sets\n" +
      "/ads [adSetId] — List ads\n" +
      "/perf [id] [period] — Performance metrics\n" +
      "/pause [id] — Pause campaign/adset/ad\n" +
      "/enable [id] — Enable (with confirmation)\n" +
      "/budget [id] [amount] — Set daily budget\n" +
      "/monitor — Scan all accounts, flag underperformers\n" +
      "/meta stop|start — Kill switch: pause ALL Meta automations\n" +
      "/alerts on|off — Toggle alert notifications\n" +
      "/launch [folderId] [keyword] — Launch ads from Drive creatives\n\n" +
      "Revenue (ClickFlare):\n" +
      "/revenue — Today's revenue by campaign\n" +
      "/revenue week — Last 7 days revenue\n" +
      "/revenue month — Last 30 days revenue\n" +
      "/revenue trend — Daily breakdown (7d)\n" +
      "/revenue offer — Revenue by offer\n" +
      "/revenue source — Revenue by traffic source\n\n" +
      "Status:\n" +
      "/authstatus — Check Google connection"
    );
  });

  // --- Google Auth Status ---
  bot.command("authstatus", async (ctx) => {
    if (isAuthenticated()) {
      await ctx.reply("✅ Google is connected (Drive, Gmail, Calendar)");
    } else {
      const url = getAuthUrl();
      await ctx.reply(
        "❌ Google not connected.\n\n" +
        "Open this link to connect:\n" + url
      );
    }
  });

  // --- Google Drive Commands ---
  bot.command("drive", async (ctx) => {
    const query = ctx.match?.trim();
    await ctx.replyWithChatAction("typing");

    try {
      const files = query ? await searchFiles(query) : await listFiles(15);
      if (files.length === 0) {
        await ctx.reply(query ? `No files found for "${query}"` : "No files found");
        return;
      }

      let msg = query ? `📁 Results for "${query}":\n\n` : "📁 Recent files:\n\n";
      for (const f of files) {
        const icon = f.mimeType.includes("folder") ? "📂" :
                     f.mimeType.includes("document") ? "📝" :
                     f.mimeType.includes("spreadsheet") ? "📊" :
                     f.mimeType.includes("image") ? "🖼️" :
                     f.mimeType.includes("video") ? "🎥" : "📄";
        msg += `${icon} ${f.name}\n   ID: ${f.id}\n\n`;
      }
      const chunks = splitMessage(msg, 4096);
      for (const chunk of chunks) await ctx.reply(chunk);
    } catch (error) {
      await ctx.reply("⚠️ " + error.message);
    }
  });

  bot.command("doc", async (ctx) => {
    const fileId = ctx.match?.trim();
    if (!fileId) {
      await ctx.reply("Usage: /doc <fileId>\n\nGet the file ID from /drive");
      return;
    }

    await ctx.replyWithChatAction("typing");
    try {
      const content = await readGoogleDoc(fileId);
      const text = typeof content === "string" ? content : JSON.stringify(content);
      const chunks = splitMessage(text || "(empty document)", 4096);
      for (const chunk of chunks) await ctx.reply(chunk);
    } catch (error) {
      await ctx.reply("⚠️ " + error.message);
    }
  });

  // --- Gmail Commands ---
  bot.command("gmail", async (ctx) => {
    const query = ctx.match?.trim();
    await ctx.replyWithChatAction("typing");

    try {
      const emails = query ? await searchEmails(query) : await listEmails(10);
      if (emails.length === 0) {
        await ctx.reply(query ? `No emails found for "${query}"` : "No emails found");
        return;
      }

      let msg = query ? `📧 Results for "${query}":\n\n` : "📧 Recent emails:\n\n";
      for (const e of emails) {
        const from = e.from.split("<")[0].trim();
        msg += `📩 ${e.subject}\n   From: ${from}\n   ${e.snippet.slice(0, 80)}...\n   ID: ${e.id}\n\n`;
      }
      const chunks = splitMessage(msg, 4096);
      for (const chunk of chunks) await ctx.reply(chunk);
    } catch (error) {
      await ctx.reply("⚠️ " + error.message);
    }
  });

  bot.command("email", async (ctx) => {
    const messageId = ctx.match?.trim();
    if (!messageId) {
      await ctx.reply("Usage: /email <messageId>\n\nGet the ID from /gmail");
      return;
    }

    await ctx.replyWithChatAction("typing");
    try {
      const email = await readEmail(messageId);
      let msg = `📩 ${email.subject}\nFrom: ${email.from}\nTo: ${email.to}\nDate: ${email.date}\n\n${email.body}`;
      const chunks = splitMessage(msg, 4096);
      for (const chunk of chunks) await ctx.reply(chunk);
    } catch (error) {
      await ctx.reply("⚠️ " + error.message);
    }
  });

  // --- Calendar Commands ---
  bot.command("calendar", async (ctx) => {
    await ctx.replyWithChatAction("typing");
    try {
      const events = await getUpcomingEvents(24);
      if (events.length === 0) {
        await ctx.reply("📅 No events in the next 24 hours");
        return;
      }

      let msg = "📅 Upcoming events:\n\n";
      for (const e of events) {
        const start = new Date(e.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        msg += `🕐 ${start} — ${e.summary}`;
        if (e.location) msg += `\n   📍 ${e.location}`;
        msg += "\n\n";
      }
      await ctx.reply(msg);
    } catch (error) {
      await ctx.reply("⚠️ " + error.message);
    }
  });

  // /copy command — generate ad copy using swipe files
  bot.command("copy", async (ctx) => {
    const request = ctx.match?.trim();
    if (!request) {
      await ctx.reply(
        "✍️ Copywriter Agent\n\n" +
        "Usage: /copy <what you need>\n\n" +
        "Examples:\n" +
        '/copy 5 ad copies for disability claims offer\n' +
        '/copy 3 short headlines for home services\n' +
        '/copy email subject lines for mass tort campaign\n\n' +
        "Or just say \"write me ad copy for...\" in chat — the copywriter activates automatically."
      );
      return;
    }

    const chatId = ctx.chat.id;
    const thinkingMsg = await ctx.reply("✍️ Loading swipe files & writing copy...");
    const typingInterval = setInterval(() => {
      ctx.replyWithChatAction("typing").catch(() => {});
    }, 4000);
    await ctx.replyWithChatAction("typing");

    try {
      // Route through askAI which will detect copy request and inject swipe context
      const { text: response } = await askAI(chatId, `Write ad copy: ${request}`);
      clearInterval(typingInterval);
      await ctx.api.deleteMessage(chatId, thinkingMsg.message_id).catch(() => {});

      const chunks = splitMessage(response, 4096);
      for (const chunk of chunks) {
        await ctx.reply(chunk, { parse_mode: "Markdown" }).catch(() => ctx.reply(chunk));
      }
    } catch (error) {
      clearInterval(typingInterval);
      await ctx.api.deleteMessage(chatId, thinkingMsg.message_id).catch(() => {});
      await ctx.reply("⚠️ " + (error.message?.slice(0, 100) || "Copywriter error"));
    }
  });

  // /swipe command — show loaded swipe file count / refresh cache
  bot.command("swipe", async (ctx) => {
    const action = ctx.match?.trim();
    if (action === "refresh") {
      clearSwipeCache();
      await ctx.reply("🔄 Swipe file cache cleared. Next copy request will reload from Drive.");
      return;
    }

    await ctx.replyWithChatAction("typing");
    try {
      const docs = await loadSwipeFiles();
      let msg = `📚 Swipe File Library: ${docs.length} documents loaded\n\n`;
      for (const doc of docs.slice(0, 15)) {
        msg += `• ${doc.name} (${doc.content.length} chars)\n`;
      }
      if (docs.length > 15) {
        msg += `\n... and ${docs.length - 15} more`;
      }
      msg += "\n\n/swipe refresh — Reload from Drive";
      await ctx.reply(msg);
    } catch (error) {
      await ctx.reply("⚠️ " + error.message);
    }
  });

  // /clone command — clone a landing page from URL
  bot.command("clone", async (ctx) => {
    const input = ctx.match?.trim();
    if (!input) {
      await ctx.reply(
        "🏗️ Landing Page Cloner\n\n" +
        "Usage: /clone <url> [options]\n\n" +
        "Examples:\n" +
        "/clone https://example.com/landing-page\n" +
        "/clone https://example.com/page higher level\n" +
        "/clone https://example.com/page exact clone\n\n" +
        "Options:\n" +
        "• 'higher level' — upgrade design & credibility\n" +
        "• 'exact clone' — match original as closely as possible"
      );
      return;
    }

    const url = extractUrl(input);
    if (!url) {
      await ctx.reply("⚠️ Please include a valid URL.\n\nExample: /clone https://example.com/landing-page");
      return;
    }

    const chatId = ctx.chat.id;
    const elevate = /higher\s*level|upgrade|premium|elevate/i.test(input);
    const modifications = input.replace(url, "").trim() || (elevate ? "higher level" : "exact clone");

    const statusMsg = await ctx.reply("🏗️ Cloning page...\n\n⏳ Scraper Agent starting...");
    const typingInterval = setInterval(() => {
      ctx.replyWithChatAction("typing").catch(() => {});
    }, 4000);

    try {
      const results = await cloneLandingPage(url, {
        modifications,
        elevate,
      });

      clearInterval(typingInterval);
      await ctx.api.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

      const report = formatResultsForTelegram(results);
      const chunks = splitMessage(report, 4096);
      for (const chunk of chunks) {
        await ctx.reply(chunk);
      }

      // Send the HTML file if it exists
      if (results.output?.filepath) {
        const fs = require("fs");
        if (fs.existsSync(results.output.filepath)) {
          await ctx.replyWithDocument(
            new InputFile(results.output.filepath, results.output.filename)
          );
        }
      }
    } catch (error) {
      clearInterval(typingInterval);
      await ctx.api.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
      await ctx.reply("❌ Clone failed: " + (error.message?.slice(0, 200) || "Unknown error"));
    }
  });

  // /lp command — build a landing page from description
  bot.command("lp", async (ctx) => {
    const description = ctx.match?.trim();
    if (!description) {
      await ctx.reply(
        "🏗️ Landing Page Builder\n\n" +
        "Usage: /lp <description>\n\n" +
        "Examples:\n" +
        "/lp CBD pain relief advertorial targeting seniors\n" +
        "/lp mass tort camp lejeune lead gen page\n" +
        "/lp home services HVAC landing page with form\n\n" +
        "Or to clone an existing page:\n" +
        "/clone <url>"
      );
      return;
    }

    const chatId = ctx.chat.id;
    const statusMsg = await ctx.reply("🏗️ Building landing page...\n\n⏳ Builder Agent working...");
    const typingInterval = setInterval(() => {
      ctx.replyWithChatAction("typing").catch(() => {});
    }, 4000);

    try {
      const results = await buildLandingPage(description);

      clearInterval(typingInterval);
      await ctx.api.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

      const report = formatResultsForTelegram(results);
      await ctx.reply(report);

      // Send the HTML file
      if (results.output?.filepath) {
        const fs = require("fs");
        if (fs.existsSync(results.output.filepath)) {
          await ctx.replyWithDocument(
            new InputFile(results.output.filepath, results.output.filename)
          );
        }
      }
    } catch (error) {
      clearInterval(typingInterval);
      await ctx.api.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
      await ctx.reply("❌ Build failed: " + (error.message?.slice(0, 200) || "Unknown error"));
    }
  });

  // --- Facebook Ads Commands ---

  // /accounts [search] — List all ad accounts (optionally filter by name)
  bot.command("accounts", async (ctx) => {
    if (!fb.isConfigured()) { await ctx.reply("❌ Facebook Ads not configured."); return; }
    const search = ctx.match?.trim().toLowerCase();
    await ctx.replyWithChatAction("typing");
    try {
      const accounts = await fb.listAllAdAccounts();
      let filtered = search
        ? accounts.filter(a => (a.name || "").toLowerCase().includes(search))
        : accounts;

      if (filtered.length === 0) {
        await ctx.reply(search ? `No accounts matching "${search}"` : "No accounts found.");
        return;
      }

      const current = fb.getActiveAccount();
      let msg = `📋 Ad Accounts (${filtered.length}/${accounts.length})\n`;
      msg += `Active: ${current}\n\n`;

      for (const a of filtered) {
        const status = a.account_status === 1 ? "🟢" : a.account_status === 2 ? "🔴" : "🟡";
        const active = a.id === current ? " ⬅️" : "";
        const spent = a.amount_spent ? ` | $${(parseInt(a.amount_spent) / 100).toFixed(0)} spent` : "";
        msg += `${status} ${a.name || "unnamed"}${active}\n   ${a.id}${spent}\n\n`;
      }

      const chunks = splitMessage(msg, 4096);
      for (const chunk of chunks) await ctx.reply(chunk);
    } catch (error) {
      await ctx.reply("⚠️ " + error.message);
    }
  });

  // /switch <accountId or search> — Switch active ad account
  bot.command("switch", async (ctx) => {
    if (!fb.isConfigured()) { await ctx.reply("❌ Facebook Ads not configured."); return; }
    const input = ctx.match?.trim();
    if (!input) {
      await ctx.reply("Usage: /switch <accountId or name>\n\nExamples:\n/switch act_123456789\n/switch bathroom\n/switch roof");
      return;
    }

    await ctx.replyWithChatAction("typing");
    try {
      // If it looks like an account ID, switch directly
      if (/^\d+$/.test(input) || /^act_\d+$/.test(input)) {
        const accountId = input.startsWith("act_") ? input : `act_${input}`;
        fb.setActiveAccount(accountId);
        const info = await fb.getAccountInfo();
        await ctx.reply(`✅ Switched to: ${info.name || info.id}\n   ${info.id} | ${info.currency}`);
        return;
      }

      // Otherwise search by name
      const accounts = await fb.listAllAdAccounts();
      const matches = accounts.filter(a => (a.name || "").toLowerCase().includes(input.toLowerCase()));

      if (matches.length === 0) {
        await ctx.reply(`No accounts matching "${input}". Use /accounts to see all.`);
      } else if (matches.length === 1) {
        fb.setActiveAccount(matches[0].id);
        await ctx.reply(`✅ Switched to: ${matches[0].name}\n   ${matches[0].id}`);
      } else {
        let msg = `Found ${matches.length} matches — be more specific or use the ID:\n\n`;
        for (const a of matches.slice(0, 10)) {
          msg += `• ${a.name}\n   ${a.id}\n\n`;
        }
        if (matches.length > 10) msg += `... and ${matches.length - 10} more`;
        await ctx.reply(msg);
      }
    } catch (error) {
      await ctx.reply("⚠️ " + error.message);
    }
  });

  // /fb — Account overview + today's performance
  bot.command("fb", async (ctx) => {
    if (!fb.isConfigured()) {
      await ctx.reply("❌ Facebook Ads not configured. Set FACEBOOK_ACCESS_TOKEN and FACEBOOK_AD_ACCOUNT_ID in .env");
      return;
    }
    await ctx.replyWithChatAction("typing");
    try {
      const [account, insights] = await Promise.all([
        fb.getAccountInfo(),
        fb.getAccountInsights("today"),
      ]);
      let msg = `📊 Facebook Ads Overview\n\n`;
      msg += `Account: ${account.name || account.id}\n`;
      msg += `Currency: ${account.currency}\n`;
      msg += `Total Spent: $${(account.amount_spent / 100).toFixed(2)}\n\n`;
      msg += `📈 Today's Performance:\n`;
      msg += fb.formatInsights(insights);
      await ctx.reply(msg);
    } catch (error) {
      await ctx.reply("⚠️ " + error.message);
    }
  });

  // /campaigns — List all campaigns
  bot.command("campaigns", async (ctx) => {
    if (!fb.isConfigured()) { await ctx.reply("❌ Facebook Ads not configured."); return; }
    await ctx.replyWithChatAction("typing");
    try {
      const campaigns = await fb.getCampaigns();
      let msg = `📋 Campaigns\n\n` + fb.formatCampaignList(campaigns);
      const chunks = splitMessage(msg, 4096);
      for (const chunk of chunks) await ctx.reply(chunk);
    } catch (error) {
      await ctx.reply("⚠️ " + error.message);
    }
  });

  // /adsets <campaignId> — List ad sets in a campaign
  bot.command("adsets", async (ctx) => {
    if (!fb.isConfigured()) { await ctx.reply("❌ Facebook Ads not configured."); return; }
    const campaignId = ctx.match?.trim();
    if (!campaignId || !/^\d+$/.test(campaignId)) {
      await ctx.reply("Usage: /adsets <campaignId>\n\nGet campaign IDs from /campaigns");
      return;
    }
    await ctx.replyWithChatAction("typing");
    try {
      const adSets = await fb.getAdSets(campaignId);
      let msg = `📋 Ad Sets\n\n` + fb.formatAdSetList(adSets);
      const chunks = splitMessage(msg, 4096);
      for (const chunk of chunks) await ctx.reply(chunk);
    } catch (error) {
      await ctx.reply("⚠️ " + error.message);
    }
  });

  // /ads <adSetId> — List ads in an ad set
  bot.command("ads", async (ctx) => {
    if (!fb.isConfigured()) { await ctx.reply("❌ Facebook Ads not configured."); return; }
    const adSetId = ctx.match?.trim();
    if (!adSetId || !/^\d+$/.test(adSetId)) {
      await ctx.reply("Usage: /ads <adSetId>\n\nGet ad set IDs from /adsets <campaignId>");
      return;
    }
    await ctx.replyWithChatAction("typing");
    try {
      const ads = await fb.getAds(adSetId);
      let msg = `📋 Ads\n\n` + fb.formatAdList(ads);
      const chunks = splitMessage(msg, 4096);
      for (const chunk of chunks) await ctx.reply(chunk);
    } catch (error) {
      await ctx.reply("⚠️ " + error.message);
    }
  });

  // /perf [campaignId] [period] — Performance metrics
  bot.command("perf", async (ctx) => {
    if (!fb.isConfigured()) { await ctx.reply("❌ Facebook Ads not configured."); return; }
    const args = ctx.match?.trim().split(/\s+/) || [];
    const id = args[0] || null;
    const period = args[1] || "last_7d";
    const validPeriods = ["today", "yesterday", "last_3d", "last_7d", "last_14d", "last_30d", "this_month", "last_month"];

    await ctx.replyWithChatAction("typing");
    try {
      let insights;
      let label;
      if (id) {
        insights = await fb.getCampaignInsights(id, validPeriods.includes(period) ? period : "last_7d");
        label = insights?.data?.[0]?.campaign_name || id;
      } else {
        insights = await fb.getAccountInsights(validPeriods.includes(period) ? period : "last_7d");
        label = "All Campaigns";
      }
      const periodLabel = (validPeriods.includes(period) ? period : "last_7d").replace(/_/g, " ");
      let msg = `📈 Performance: ${label}\n📅 Period: ${periodLabel}\n\n`;
      msg += fb.formatInsights(insights);
      await ctx.reply(msg);
    } catch (error) {
      await ctx.reply("⚠️ " + error.message);
    }
  });

  // /pause <id> — Pause a campaign, ad set, or ad
  bot.command("pause", async (ctx) => {
    if (!fb.isConfigured()) { await ctx.reply("❌ Facebook Ads not configured."); return; }
    const objectId = ctx.match?.trim();
    if (!objectId || !/^\d+$/.test(objectId)) {
      await ctx.reply("Usage: /pause <id>\n\nWorks with campaign, ad set, or ad IDs (numeric).");
      return;
    }
    await ctx.replyWithChatAction("typing");
    try {
      await fb.updateStatus(objectId, "PAUSED");
      await ctx.reply(`🟡 Paused: ${objectId}`);
    } catch (error) {
      await ctx.reply("⚠️ " + error.message);
    }
  });

  // /enable <id> — Enable a campaign, ad set, or ad (requires confirmation)
  bot.command("enable", async (ctx) => {
    if (!fb.isConfigured()) { await ctx.reply("❌ Facebook Ads not configured."); return; }
    const objectId = ctx.match?.trim();
    if (!objectId || !/^\d+$/.test(objectId)) {
      await ctx.reply("Usage: /enable <id>\n\nWorks with campaign, ad set, or ad IDs (numeric).");
      return;
    }

    const chatId = ctx.chat.id;
    pendingConfirmations.set(chatId, {
      action: "enable",
      objectId,
      expiresAt: Date.now() + 30000,
    });
    await ctx.reply(`⚠️ About to ENABLE ${objectId} — this will start spending money.\n\nSend "yes" to confirm, anything else to cancel. (30s timeout)`);
  });

  // /budget <id> <amount> — Update daily budget (requires confirmation)
  bot.command("budget", async (ctx) => {
    if (!fb.isConfigured()) { await ctx.reply("❌ Facebook Ads not configured."); return; }
    const args = ctx.match?.trim().split(/\s+/) || [];
    const objectId = args[0];
    const amount = parseFloat(args[1]);

    if (!objectId || !/^\d+$/.test(objectId) || isNaN(amount) || amount <= 0) {
      await ctx.reply("Usage: /budget <id> <dailyBudgetInDollars>\n\nExample: /budget 123456789 50");
      return;
    }

    if (amount > 10000) {
      await ctx.reply("⚠️ Budget cap: max $10,000/day. Adjust if needed.");
      return;
    }

    const chatId = ctx.chat.id;
    pendingConfirmations.set(chatId, {
      action: "budget",
      objectId,
      amount,
      expiresAt: Date.now() + 30000,
    });
    await ctx.reply(`⚠️ About to set daily budget to $${amount.toFixed(2)} for ${objectId}.\n\nSend "yes" to confirm, anything else to cancel. (30s timeout)`);
  });

  // /monitor — Run immediate ad scan
  bot.command("monitor", async (ctx) => {
    if (!fb.isConfigured()) { await ctx.reply("\u274C Facebook Ads not configured."); return; }

    const statusMsg = await ctx.reply("\u{1F50D} Scanning all accounts...");
    const typingInterval = setInterval(() => {
      ctx.replyWithChatAction("typing").catch(() => {});
    }, 4000);
    await ctx.replyWithChatAction("typing");

    try {
      const result = await scanAllAccounts("today");
      clearInterval(typingInterval);
      await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});

      if (result.error) {
        await ctx.reply(`\u26A0\uFE0F Scan error: ${result.error}`);
        return;
      }

      // Send daily summary
      const summary = formatDailySummary(result);
      const chunks = splitMessage(summary, 4096);
      for (const chunk of chunks) await ctx.reply(chunk);

      // Send alerts if any
      if (result.flagged.length > 0) {
        const alerts = formatAlertMessage(result.flagged);
        if (alerts) {
          const alertChunks = splitMessage(alerts, 4096);
          for (const chunk of alertChunks) await ctx.reply(chunk);
        }
      }
    } catch (error) {
      clearInterval(typingInterval);
      await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
      await ctx.reply("\u26A0\uFE0F Monitor error: " + error.message?.slice(0, 100));
    }
  });

  // /revenue [period] — ClickFlare revenue report
  // Periods: today (default), yesterday, week, month
  bot.command("revenue", async (ctx) => {
    if (!clickflare.isConfigured()) {
      await ctx.reply("❌ ClickFlare not configured — set CLICKFLARE_API_KEY in .env");
      return;
    }

    const arg = ctx.match?.trim().toLowerCase() || "";
    let preset = "today";
    if (/yesterday|yday/i.test(arg)) preset = "yesterday";
    else if (/week|7d|7\s*day/i.test(arg)) preset = "last_7d";
    else if (/month|30d|30\s*day/i.test(arg)) preset = "last_30d";
    else if (/trend|daily/i.test(arg)) preset = "last_7d";

    await ctx.replyWithChatAction("typing");

    try {
      // Determine report type
      if (/offer/i.test(arg)) {
        const data = await clickflare.getRevenueByOffer(preset);
        const text = clickflare.formatCampaignRevenue(data, preset);
        const chunks = splitMessage(text, 4096);
        for (const chunk of chunks) await ctx.reply(chunk);
      } else if (/trend|daily/i.test(arg)) {
        const data = await clickflare.getDailyBreakdown(preset);
        const text = clickflare.formatDailyTrend(data);
        const chunks = splitMessage(text, 4096);
        for (const chunk of chunks) await ctx.reply(chunk);
      } else if (/source/i.test(arg)) {
        const data = await clickflare.getRevenueBySource(preset);
        const text = clickflare.formatCampaignRevenue(data, preset);
        const chunks = splitMessage(text, 4096);
        for (const chunk of chunks) await ctx.reply(chunk);
      } else {
        // Default: campaign revenue
        const data = await clickflare.getRevenueByCampaign(preset);
        const text = clickflare.formatCampaignRevenue(data, preset);
        const chunks = splitMessage(text, 4096);
        for (const chunk of chunks) await ctx.reply(chunk);
      }
    } catch (error) {
      await ctx.reply("⚠️ ClickFlare error: " + error.message?.slice(0, 200));
    }
  });

  // /alerts on|off — Toggle alert notifications
  bot.command("alerts", async (ctx) => {
    const action = ctx.match?.trim().toLowerCase();
    if (action === "off") {
      alertsEnabled = false;
      await ctx.reply("\u{1F515} Alerts muted. Use /alerts on to re-enable.");
    } else if (action === "on") {
      alertsEnabled = true;
      await ctx.reply("\u{1F514} Alerts enabled.");
    } else {
      await ctx.reply(`\u{1F514} Alerts are currently ${alertsEnabled ? "ON" : "OFF"}.\n\nUsage: /alerts on or /alerts off`);
    }
  });

  // /meta stop|start — Kill switch for all Meta/Facebook automations
  bot.command("meta", async (ctx) => {
    const { pauseMeta, resumeMeta, getStatus } = require("../meta/killSwitch");
    const action = ctx.match?.trim().toLowerCase();
    if (action === "stop") {
      pauseMeta("Telegram /meta stop");
      await ctx.reply("⛔ META KILL SWITCH ACTIVE\n\nAll Meta automations stopped:\n• Hourly ad scans\n• Spend guard\n• Daily summaries\n• Weekly reports\n• Ad launches blocked\n\nUse /meta start to resume.");
    } else if (action === "start") {
      resumeMeta();
      await ctx.reply("✅ Meta automations resumed.\n\nAll cron jobs and FB operations are back online.");
    } else {
      const status = getStatus();
      if (status.paused) {
        await ctx.reply(`⛔ Meta is PAUSED\n\nPaused: ${status.pausedAt?.toLocaleString()}\nDuration: ${status.duration} minutes\nReason: ${status.pausedBy}\n\nUse /meta start to resume.`);
      } else {
        await ctx.reply("✅ Meta is ACTIVE — all automations running.\n\nUse /meta stop to pause everything.");
      }
    }
  });

  // /launch — Start ad launch flow
  bot.command("launch", async (ctx) => {
    if (!fb.isConfigured()) { await ctx.reply("\u274C Facebook Ads not configured."); return; }

    const chatId = ctx.chat.id;
    const input = ctx.match?.trim();

    if (!input) {
      await ctx.reply(
        "\u{1F680} Ad Launch Flow\n\n" +
        "Usage: /launch <folder_id> into <keyword> accounts\n\n" +
        "Examples:\n" +
        "/launch 1ABC...XYZ into bathroom accounts\n" +
        "/launch 1ABC...XYZ roofing\n\n" +
        "Or just describe what you want:\n" +
        "\"Launch these bathroom creatives from 1ABC...XYZ into the bathroom accounts\"\n\n" +
        "I'll find the best performing campaign and ad in each matching account, " +
        "then duplicate that ad with each creative from the folder. All new ads are created PAUSED."
      );
      return;
    }

    await ctx.replyWithChatAction("typing");
    const session = launchFlow.createSession(chatId);
    try {
      const response = await launchFlow.handleStep(chatId, input);
      if (response) {
        const chunks = splitMessage(response, 4096);
        for (const chunk of chunks) await ctx.reply(chunk);
      }
    } catch (err) {
      launchFlow.cancelSession(chatId);
      await ctx.reply("\u26A0\uFE0F Launch error: " + err.message?.slice(0, 100));
    }
  });

  // --- Creative Pipeline Commands ---

  // /pipeline — Start full creative production pipeline
  bot.command("pipeline", async (ctx) => {
    const chatId = ctx.chat.id;
    const input = ctx.match?.trim();

    // Handle subcommands
    if (input === "status") {
      const response = await pipelineFlow.handleMessage(chatId, "status", (msg) => ctx.reply(msg));
      if (response) await ctx.reply(response);
      else await ctx.reply("No active pipeline. Use /pipeline <offer> to start one.");
      return;
    }
    if (input === "cancel" || input === "stop") {
      pipelineFlow.cancelSession(chatId);
      await ctx.reply("❌ Pipeline cancelled.");
      return;
    }

    await ctx.replyWithChatAction("typing");
    const sendReply = async (msg) => {
      const chunks = splitMessage(msg, 4096);
      for (const chunk of chunks) await ctx.reply(chunk);
    };
    const response = await pipelineFlow.startFullPipeline(chatId, input, sendReply);
    const chunks = splitMessage(response, 4096);
    for (const chunk of chunks) await ctx.reply(chunk);
  });

  // /research — Run creative research only
  bot.command("research", async (ctx) => {
    const chatId = ctx.chat.id;
    const input = ctx.match?.trim();
    await ctx.replyWithChatAction("typing");
    const typingInterval = setInterval(() => {
      ctx.replyWithChatAction("typing").catch(() => {});
    }, 4000);
    try {
      const sendReply = async (msg) => ctx.reply(msg);
      const response = await pipelineFlow.startResearch(chatId, input, sendReply);
      clearInterval(typingInterval);
      const chunks = splitMessage(response, 4096);
      for (const chunk of chunks) await ctx.reply(chunk);
    } catch (err) {
      clearInterval(typingInterval);
      await ctx.reply("❌ " + (err.message?.slice(0, 200) || "Research error"));
    }
  });

  // /evaluate — Score an offer for Facebook viability
  bot.command("evaluate", async (ctx) => {
    const chatId = ctx.chat.id;
    const input = ctx.match?.trim();
    await ctx.replyWithChatAction("typing");
    const typingInterval = setInterval(() => {
      ctx.replyWithChatAction("typing").catch(() => {});
    }, 4000);
    try {
      const sendReply = async (msg) => ctx.reply(msg);
      const response = await pipelineFlow.startEvaluate(chatId, input, sendReply);
      clearInterval(typingInterval);
      const chunks = splitMessage(response, 4096);
      for (const chunk of chunks) await ctx.reply(chunk);
    } catch (err) {
      clearInterval(typingInterval);
      await ctx.reply("❌ " + (err.message?.slice(0, 200) || "Evaluation error"));
    }
  });

  // /scripts — Generate ad scripts (research + evaluate + write)
  bot.command("scripts", async (ctx) => {
    const chatId = ctx.chat.id;
    const input = ctx.match?.trim();
    await ctx.replyWithChatAction("typing");
    const typingInterval = setInterval(() => {
      ctx.replyWithChatAction("typing").catch(() => {});
    }, 4000);
    try {
      const sendReply = async (msg) => ctx.reply(msg);
      const response = await pipelineFlow.startScripts(chatId, input, sendReply);
      clearInterval(typingInterval);
      const chunks = splitMessage(response, 4096);
      for (const chunk of chunks) await ctx.reply(chunk);
    } catch (err) {
      clearInterval(typingInterval);
      await ctx.reply("❌ " + (err.message?.slice(0, 200) || "Script generation error"));
    }
  });

  // Handle voice messages — transcribe and process like text
  bot.on("message:voice", async (ctx) => {
    const chatId = ctx.chat.id;

    const transcribingMsg = await ctx.reply("🎙️ Listening...");
    await ctx.replyWithChatAction("typing");

    try {
      // Download the voice file from Telegram
      const file = await ctx.getFile();

      // Reject files over 5MB to prevent memory issues
      if (file.file_size && file.file_size > 5 * 1024 * 1024) {
        throw new Error("Voice message too large (max 5MB). Try a shorter message.");
      }

      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error("Failed to download voice message");
      const audioBuffer = Buffer.from(await response.arrayBuffer());

      // Validate OGG format (magic bytes: OggS)
      if (audioBuffer.length < 4 || audioBuffer.toString("ascii", 0, 4) !== "OggS") {
        throw new Error("Invalid audio format — expected OGG voice message");
      }

      // Transcribe with Whisper
      const transcript = await transcribeVoice(audioBuffer);
      console.log(`[VOICE] Transcribed (${audioBuffer.length} bytes): "${transcript.slice(0, 100)}..."`);

      // Delete "Listening..." and show what was heard
      await ctx.api.deleteMessage(chatId, transcribingMsg.message_id).catch(() => {});
      await ctx.reply(`🎙️ _"${transcript}"_`, { parse_mode: "Markdown" }).catch(() =>
        ctx.reply(`🎙️ "${transcript}"`)
      );

      // Now process the transcribed text through the normal AI pipeline
      const thinkingMsg = await ctx.reply("🧠 Thinking...");
      const typingInterval = setInterval(() => {
        ctx.replyWithChatAction("typing").catch(() => {});
      }, 4000);
      await ctx.replyWithChatAction("typing");

      try {
        const { text: aiResponse, model } = await askAI(chatId, transcript);
        clearInterval(typingInterval);
        await ctx.api.deleteMessage(chatId, thinkingMsg.message_id).catch(() => {});

        if (aiResponse.length <= 4096) {
          await ctx.reply(aiResponse, { parse_mode: "Markdown" }).catch(() =>
            ctx.reply(aiResponse)
          );
        } else {
          const chunks = splitMessage(aiResponse, 4096);
          for (const chunk of chunks) {
            await ctx.reply(chunk);
          }
        }
      } catch (aiError) {
        clearInterval(typingInterval);
        await ctx.api.deleteMessage(chatId, thinkingMsg.message_id).catch(() => {});
        console.error("AI error (voice):", aiError.message);
        const errMsg = aiError.message?.includes("429") || aiError.message?.includes("rate")
          ? "⚠️ Rate limited — wait 30 seconds and try again."
          : aiError.message?.includes("Timed out")
          ? "⚠️ Request timed out. Try again."
          : `⚠️ Something went wrong: ${aiError.message?.slice(0, 100) || "unknown error"}`;
        await ctx.reply(errMsg);
      }
    } catch (error) {
      await ctx.api.deleteMessage(chatId, transcribingMsg.message_id).catch(() => {});
      console.error("Voice transcription error:", error.message);
      await ctx.reply("⚠️ Couldn't process voice message: " + (error.message?.slice(0, 100) || "unknown error"));
    }
  });

  // Handle photos and videos — forward-to-launch flow
  bot.on(["message:photo", "message:video"], async (ctx) => {
    const chatId = ctx.chat.id;

    // Skip if already in a forward launch session
    if (forwardLaunchFlow.hasActiveSession(chatId)) {
      await ctx.reply("⚠️ You already have a forward launch in progress. Type 'cancel' to abort it first, then send the new creative.");
      return;
    }

    // Skip if a regular launch flow is active
    if (launchFlow.hasActiveSession(chatId)) {
      await ctx.reply("⚠️ You have an active /launch session. Type 'cancel' to abort it first.");
      return;
    }

    try {
      await ctx.replyWithChatAction("typing");

      let fileId, fileName, mediaType, fileSize;

      if (ctx.message.photo) {
        // Photos come as array of sizes — grab the largest
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        fileId = photo.file_id;
        fileSize = photo.file_size || 0;
        mediaType = "photo";
        fileName = `forward-ad-${Date.now()}.jpg`;

        if (fileSize > 10 * 1024 * 1024) {
          await ctx.reply("⚠️ Photo too large (>10MB). Try sending a smaller version.");
          return;
        }
      } else if (ctx.message.video) {
        const video = ctx.message.video;
        fileId = video.file_id;
        fileSize = video.file_size || 0;
        mediaType = "video";
        const ext = "mp4";
        fileName = `forward-ad-${Date.now()}.${ext}`;

        if (fileSize > 20 * 1024 * 1024) {
          await ctx.reply("⚠️ Video too large (>20MB). Telegram Bot API limits file downloads to 20MB. Try compressing or trimming the video.");
          return;
        }
      }

      // Download from Telegram
      const file = await ctx.api.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());

      // Defense-in-depth: verify actual download size (Telegram file_size can be 0/undefined)
      const maxBytes = mediaType === "video" ? 20 * 1024 * 1024 : 10 * 1024 * 1024;
      if (buffer.length > maxBytes) {
        await ctx.reply(`⚠️ File too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Max: ${maxBytes / 1024 / 1024}MB.`);
        return;
      }

      const caption = ctx.message.caption || "";

      // Create the forward launch session
      forwardLaunchFlow.createSession(chatId, buffer, mediaType, fileName, caption);

      const icon = mediaType === "video" ? "🎬" : "🖼️";
      const sizeMB = (buffer.length / 1024 / 1024).toFixed(1);
      let msg = `${icon} Got your creative! (${sizeMB}MB)\n`;
      if (caption) msg += `📝 Caption: "${caption.slice(0, 100)}${caption.length > 100 ? "..." : ""}"\n`;
      msg += `\n🎯 Which accounts should I launch this into?\n`;
      msg += `Type a keyword to match account names (e.g., "bath", "roof", "tort").`;

      await ctx.reply(msg);
    } catch (error) {
      console.error("Forward launch media error:", error.message);
      await ctx.reply("⚠️ Couldn't process that file: " + (error.message?.slice(0, 100) || "unknown error"));
    }
  });

  // Handle all text messages (non-command)
  bot.on("message:text", async (ctx) => {
    // Skip if this is a command — let command handlers deal with it
    if (ctx.message.text.startsWith("/")) {
      console.log(`[DEBUG] Command not matched by handler: ${ctx.message.text}`);
      return;
    }

    const chatId = ctx.chat.id;
    const userMessage = ctx.message.text;

    // Check for pipeline approval gate (only intercept when waiting for approval)
    if (pipelineFlow.hasActiveSession(chatId)) {
      const pipelineResult = await pipelineFlow.handleMessage(chatId, userMessage, async (msg) => {
        const chunks = splitMessage(msg, 4096);
        for (const chunk of chunks) await ctx.reply(chunk);
      });
      // Only intercept if the pipeline actually handled the message (approval gate)
      if (pipelineResult !== null) {
        const chunks = splitMessage(pipelineResult, 4096);
        for (const chunk of chunks) await ctx.reply(chunk);
        return;
      }
      // Otherwise fall through to normal message handling
    }

    // Check for active forward launch session (photo/video → ad)
    if (forwardLaunchFlow.hasActiveSession(chatId)) {
      await ctx.replyWithChatAction("typing");
      try {
        const response = await forwardLaunchFlow.handleStep(chatId, userMessage);
        if (response) {
          const chunks = splitMessage(response, 4096);
          for (const chunk of chunks) await ctx.reply(chunk);
        }
      } catch (err) {
        forwardLaunchFlow.cancelSession(chatId);
        await ctx.reply("⚠️ Forward launch error: " + err.message?.slice(0, 100));
      }
      return;
    }

    // Check for active launch session
    if (launchFlow.hasActiveSession(chatId)) {
      await ctx.replyWithChatAction("typing");
      try {
        const response = await launchFlow.handleStep(chatId, userMessage);
        if (response) {
          const chunks = splitMessage(response, 4096);
          for (const chunk of chunks) await ctx.reply(chunk);
        }
      } catch (err) {
        launchFlow.cancelSession(chatId);
        await ctx.reply("\u26A0\uFE0F Launch error: " + err.message?.slice(0, 100));
      }
      return;
    }

    // Check for pending FB confirmations (enable, budget)
    const pending = pendingConfirmations.get(chatId);
    if (pending) {
      pendingConfirmations.delete(chatId);

      if (Date.now() > pending.expiresAt) {
        await ctx.reply("⏰ Confirmation expired. Run the command again.");
        return;
      }

      if (userMessage.toLowerCase() === "yes") {
        try {
          if (pending.action === "enable") {
            await fb.updateStatus(pending.objectId, "ACTIVE");
            await ctx.reply(`🟢 Enabled: ${pending.objectId}`);
          } else if (pending.action === "budget") {
            await fb.updateDailyBudget(pending.objectId, pending.amount);
            await ctx.reply(`💰 Budget updated: ${pending.objectId} → $${pending.amount.toFixed(2)}/day`);
          }
        } catch (error) {
          await ctx.reply("⚠️ " + error.message);
        }
      } else {
        await ctx.reply("❌ Cancelled.");
      }
      return;
    }

    // Send immediate "thinking" message so Austin knows it's working
    const thinkingMsg = await ctx.reply("🧠 Thinking...");

    // Keep "typing..." visible while Claude thinks (refreshes every 4s)
    const typingInterval = setInterval(() => {
      ctx.replyWithChatAction("typing").catch(() => {});
    }, 4000);
    await ctx.replyWithChatAction("typing");

    try {
      const { text: response, model } = await askAI(chatId, userMessage);
      clearInterval(typingInterval);

      // Delete the "thinking" message
      await ctx.api.deleteMessage(chatId, thinkingMsg.message_id).catch(() => {});

      // Handle pipeline routes — route to specific sub-agent or full pipeline
      const pipelineRoutes = {
        "pipeline": { prefix: "__PIPELINE__:", handler: pipelineFlow.startFullPipeline },
        "pipeline-research": { prefix: "__RESEARCH__:", handler: pipelineFlow.startResearch },
        "pipeline-evaluate": { prefix: "__EVALUATE__:", handler: pipelineFlow.startEvaluate },
        "pipeline-scripts": { prefix: "__SCRIPTS__:", handler: pipelineFlow.startScripts },
      };
      const pipeRoute = pipelineRoutes[model];
      if (pipeRoute && response.startsWith(pipeRoute.prefix)) {
        const originalMsg = response.slice(pipeRoute.prefix.length);
        const sendReply = async (msg) => {
          const chunks = splitMessage(msg, 4096);
          for (const chunk of chunks) await ctx.reply(chunk);
        };
        try {
          const pipeResponse = await pipeRoute.handler(chatId, originalMsg, sendReply);
          const chunks = splitMessage(pipeResponse, 4096);
          for (const chunk of chunks) await ctx.reply(chunk);
        } catch (err) {
          await ctx.reply("⚠️ Pipeline error: " + err.message?.slice(0, 100));
        }
        return;
      }

      // Handle launch route — start a launch session
      if (model === "launch" && response.startsWith("__LAUNCH__:")) {
        const originalMsg = response.slice("__LAUNCH__:".length);
        const session = launchFlow.createSession(chatId);
        try {
          const launchResponse = await launchFlow.handleStep(chatId, originalMsg);
          if (launchResponse) {
            const chunks = splitMessage(launchResponse, 4096);
            for (const chunk of chunks) await ctx.reply(chunk);
          }
        } catch (err) {
          launchFlow.cancelSession(chatId);
          await ctx.reply("\u26A0\uFE0F Launch error: " + err.message?.slice(0, 100));
        }
        return;
      }

      const fullResponse = response;

      // Log bot response for context retrieval
      try {
        fs.appendFileSync(MSG_LOG_PATH, JSON.stringify({
          ts: new Date().toISOString(), from: "Bot", type: "response",
          text: fullResponse.slice(0, 5000), chat_id: chatId,
        }) + "\n");
      } catch {}

      if (fullResponse.length <= 4096) {
        await ctx.reply(fullResponse, { parse_mode: "Markdown" }).catch(() =>
          ctx.reply(fullResponse) // fallback without markdown if it fails
        );
      } else {
        const chunks = splitMessage(fullResponse, 4096);
        for (const chunk of chunks) {
          await ctx.reply(chunk);
        }
      }
    } catch (error) {
      clearInterval(typingInterval);
      // Delete the "thinking" message
      await ctx.api.deleteMessage(chatId, thinkingMsg.message_id).catch(() => {});
      console.error("AI error:", error.message, error.stack);
      const errMsg = error.message?.includes("429") || error.message?.includes("rate")
        ? "⚠️ Rate limited — too many requests. Wait 30 seconds and try again."
        : error.message?.includes("Timed out")
        ? "⚠️ Request timed out. Try again."
        : `⚠️ Something went wrong: ${error.message?.slice(0, 100) || "unknown error"}`;
      await ctx.reply(errMsg);
    }
  });

  // Catch errors so the bot doesn't silently stop polling
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`[BOT ERROR] Error while handling update ${ctx?.update?.update_id}:`);
    console.error(`  ${err.error?.message || err.message || err}`);
  });

  console.log("🤖 Telegram bot starting...");
  bot.start({
    onStart: () => console.log("✅ Telegram bot is running!"),
  });
}

function splitMessage(text, maxLength) {
  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = remaining.lastIndexOf("\n\n", maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf("\n", maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitIndex === -1) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
}

module.exports = { startTelegramBot };
