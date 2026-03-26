/**
 * Telegram Pipeline Flow
 * Handles pipeline commands and approval gates via Telegram.
 * Follows the same state machine pattern as launchFlow.js.
 */

const pipeline = require("../pipeline");
const { evaluator, scriptwriter, compliance, launcher: launcherAgent, videoProducer } = {
  evaluator: require("../agents/evaluator"),
  scriptwriter: require("../agents/scriptwriter"),
  compliance: require("../agents/compliance"),
  launcher: require("../agents/launcher"),
  videoProducer: require("../agents/video-producer"),
};
const { loadContext, listRuns } = require("../pipeline/store");

// Track which chats have active pipeline flows
const activeSessions = new Map();

/**
 * Check if a chat has an active pipeline that needs interaction.
 */
function hasActiveSession(chatId) {
  return activeSessions.has(chatId) || !!pipeline.getPipeline(chatId);
}

/**
 * Handle pipeline-related messages.
 * Returns a response string or null if not handled.
 */
async function handleMessage(chatId, message, sendReply) {
  const msg = message.trim().toLowerCase();
  const activePipeline = pipeline.getPipeline(chatId);

  // Handle approval responses for active pipelines
  if (activePipeline && activePipeline.ctx.approvalNeeded) {
    if (msg === "approve" || msg === "yes" || msg === "y" || msg === "go") {
      activePipeline.approve();
      activeSessions.delete(chatId);
      return "✅ Approved! Continuing pipeline...";
    }
    if (msg === "reject" || msg === "no" || msg === "n" || msg === "cancel" || msg === "stop") {
      activePipeline.reject();
      pipeline.removePipeline(chatId);
      activeSessions.delete(chatId);
      return "❌ Pipeline cancelled.";
    }
    // Show specific script if they ask for a number
    const scriptNum = msg.match(/^(?:script\s*)?(\d+)$/);
    if (scriptNum && activePipeline.ctx.scripts?.length) {
      const idx = parseInt(scriptNum[1]) - 1;
      const script = activePipeline.ctx.scripts[idx];
      if (script) {
        return scriptwriter.formatFullScript(script);
      }
    }
    return "Reply \"approve\" to continue, \"reject\" to cancel, or a script number to view details.";
  }

  // Pipeline is running but not at approval gate — don't intercept messages
  // User can still chat normally. Use /pipeline status to check progress.
  return null;
}

/**
 * Start the full pipeline from a Telegram command.
 * @param {number} chatId
 * @param {string} input - The command arguments
 * @param {function} sendReply - Function to send messages back to Telegram
 */
async function startFullPipeline(chatId, input, sendReply) {
  const config = parseInput(input);

  if (!config.offerName && !config.offerUrl && !config.vertical) {
    return "🔧 CREATIVE PIPELINE\n\n" +
      "Usage: /pipeline <offer> [options]\n\n" +
      "Examples:\n" +
      "/pipeline mass tort camp lejeune\n" +
      "/pipeline home services bathroom remodel\n" +
      "/pipeline https://offer-url.com solar\n\n" +
      "Options:\n" +
      "• Add a URL to analyze the landing page\n" +
      "• Specify a vertical: mass-tort, home-services, insurance, legal, solar, health, finance\n" +
      "• Add account keywords: 'into bathroom accounts'\n\n" +
      "Or run individual agents:\n" +
      "/research <offer> — Research only\n" +
      "/evaluate <url> — Score an offer\n" +
      "/scripts <offer> — Research + scripts\n" +
      "/pipeline status — Check progress\n" +
      "/pipeline cancel — Stop running pipeline";
  }

  try {
    const pipe = pipeline.startPipeline(chatId, config);
    activeSessions.set(chatId, true);

    // Set up event handlers for Telegram updates
    pipe.on("agent-start", ({ name }) => {
      const agentNames = {
        research: "🔍 Research Agent analyzing competitors...",
        evaluator: "📊 Evaluating offer viability...",
        scriptwriter: "✍️ Generating ad scripts...",
        "video-producer": "🎬 Producing videos...",
        compliance: "🛡️ Running compliance review...",
        launcher: "🚀 Launching ads...",
      };
      sendReply(agentNames[name] || `⚙️ Running ${name}...`).catch(() => {});
    });

    pipe.on("agent-complete", ({ name }) => {
      // Agent-specific completion messages
      if (name === "research" && pipe.ctx.research?.competitorAds?.length) {
        sendReply(`✅ Research complete: ${pipe.ctx.research.competitorAds.length} competitor ads analyzed`).catch(() => {});
      }
      if (name === "evaluator" && pipe.ctx.evaluation?.score !== null) {
        sendReply(evaluator.formatEvaluation(pipe.ctx.evaluation)).catch(() => {});
      }
    });

    pipe.on("approval-needed", (approval) => {
      sendReply(approval.message).catch(() => {});
    });

    pipe.on("gate-blocked", ({ score, verdict }) => {
      sendReply(`🚫 PIPELINE BLOCKED\n\nOffer scored ${score}/10 — below threshold.\n${verdict}\n\nUse /pipeline force to override.`).catch(() => {});
      pipeline.removePipeline(chatId);
      activeSessions.delete(chatId);
    });

    pipe.on("progress", (msg) => {
      sendReply(msg).catch(() => {});
    });

    pipe.on("complete", (ctx) => {
      const summary = formatPipelineSummary(ctx);
      sendReply(summary).catch(() => {});
      pipeline.removePipeline(chatId);
      activeSessions.delete(chatId);
    });

    pipe.on("error", (err) => {
      sendReply(`❌ Pipeline error: ${err.message?.slice(0, 200)}`).catch(() => {});
      pipeline.removePipeline(chatId);
      activeSessions.delete(chatId);
    });

    // Run pipeline (non-blocking — events will fire updates)
    pipe.run().catch((err) => {
      console.error(`[PIPELINE] Fatal error: ${err.message}`);
      pipeline.removePipeline(chatId);
      activeSessions.delete(chatId);
    });

    return `🚀 CREATIVE PIPELINE STARTED\n\n` +
      `Offer: ${config.offerName || config.offerUrl || "—"}\n` +
      `Vertical: ${config.vertical || "auto-detect"}\n` +
      `Accounts: ${config.targetAccounts?.length ? config.targetAccounts.join(", ") : "all"}\n\n` +
      `Pipeline: Research → Evaluate → Scripts → [Approve] → Video → Compliance → [Approve] → Launch\n\n` +
      `I'll update you at each step. Stand by...`;
  } catch (err) {
    return `❌ ${err.message}`;
  }
}

/**
 * Run just the research agent.
 */
async function startResearch(chatId, input, sendReply) {
  const config = parseInput(input);
  if (!config.offerName && !config.vertical) {
    return "Usage: /research <offer or vertical>\n\nExamples:\n/research mass tort camp lejeune\n/research home services bathroom";
  }

  sendReply("🔍 Starting creative research...").catch(() => {});

  try {
    const ctx = await pipeline.runResearchOnly(config);
    const synthesis = ctx.research?.synthesis || "No synthesis available.";

    // Truncate for Telegram
    if (synthesis.length > 4000) {
      return synthesis.slice(0, 4000) + "\n\n[... truncated — full report saved to pipeline run]";
    }
    return synthesis;
  } catch (err) {
    return `❌ Research failed: ${err.message?.slice(0, 200)}`;
  }
}

/**
 * Run just the offer evaluator.
 */
async function startEvaluate(chatId, input, sendReply) {
  const config = parseInput(input);
  if (!config.offerUrl && !config.offerName) {
    return "Usage: /evaluate <url or offer name>\n\nExamples:\n/evaluate https://offer-page.com\n/evaluate auto insurance offer";
  }

  sendReply("📊 Evaluating offer...").catch(() => {});

  try {
    const ctx = await pipeline.runEvaluatorOnly(config);
    return evaluator.formatEvaluation(ctx.evaluation);
  } catch (err) {
    return `❌ Evaluation failed: ${err.message?.slice(0, 200)}`;
  }
}

/**
 * Run research + evaluation + scripts.
 */
async function startScripts(chatId, input, sendReply) {
  const config = parseInput(input);
  if (!config.offerName && !config.vertical) {
    return "Usage: /scripts <offer or vertical>\n\nExamples:\n/scripts mass tort camp lejeune\n/scripts home services bathroom remodel";
  }

  sendReply("🔍 Researching + generating scripts...").catch(() => {});

  try {
    const ctx = await pipeline.runScriptsOnly(config);
    return scriptwriter.formatScripts(ctx.scripts);
  } catch (err) {
    return `❌ Script generation failed: ${err.message?.slice(0, 200)}`;
  }
}

// --- Helpers ---

function parseInput(input) {
  if (!input) return {};

  const config = {
    offerName: null,
    offerUrl: null,
    vertical: null,
    targetAccounts: [],
    options: {},
  };

  // Extract URL
  const urlMatch = input.match(/(https?:\/\/[^\s]+)/i);
  if (urlMatch) {
    config.offerUrl = urlMatch[1];
    input = input.replace(urlMatch[0], "").trim();
  }

  // Extract target accounts
  const accountMatch = input.match(/(?:into|to|in)\s+(\w+)\s+accounts?/i);
  if (accountMatch) {
    config.targetAccounts = [accountMatch[1]];
    input = input.replace(accountMatch[0], "").trim();
  }

  // Extract options
  if (/\bforce\b/i.test(input)) {
    config.options.forceRun = true;
    input = input.replace(/\bforce\b/i, "").trim();
  }
  if (/\bno\s*video\b|\bskip\s*video\b/i.test(input)) {
    config.options.skipVideo = true;
    input = input.replace(/\bno\s*video\b|\bskip\s*video\b/i, "").trim();
  }
  if (/\bno\s*launch\b|\bskip\s*launch\b/i.test(input)) {
    config.options.skipLaunch = true;
    input = input.replace(/\bno\s*launch\b|\bskip\s*launch\b/i, "").trim();
  }

  // Detect vertical from remaining text
  const verticals = {
    "mass tort": "mass-tort", "mass-tort": "mass-tort", "lawsuit": "mass-tort",
    "home service": "home-services", "home-services": "home-services",
    "bathroom": "home-services", "roofing": "home-services", "hvac": "home-services",
    "plumbing": "home-services", "remodel": "home-services",
    "insurance": "insurance", "auto insurance": "insurance",
    "legal": "legal", "attorney": "legal", "lawyer": "legal",
    "solar": "solar", "solar panel": "solar",
    "health": "health", "supplement": "health", "weight loss": "health",
    "finance": "finance", "debt": "finance", "credit": "finance", "loan": "finance",
    "newsletter": "newsletter", "email": "newsletter",
  };

  const lowerInput = input.toLowerCase();
  for (const [keyword, vertical] of Object.entries(verticals)) {
    if (lowerInput.includes(keyword)) {
      config.vertical = vertical;
      break;
    }
  }

  // Everything else is the offer name
  config.offerName = input.trim() || null;

  return config;
}

function formatStatus(status) {
  const progressIcons = {
    research: status.progress.research ? "✅" : "⏳",
    evaluation: status.progress.evaluation ? "✅" : "⏳",
    scripts: status.progress.scripts > 0 ? "✅" : "⏳",
    videos: status.progress.videos > 0 ? "✅" : "⏳",
    compliance: status.progress.compliance > 0 ? "✅" : "⏳",
    launched: status.progress.launched > 0 ? "✅" : "⏳",
  };

  let msg = `📊 PIPELINE STATUS: ${status.status?.toUpperCase()}\n\n`;
  msg += `Run: ${status.runId}\n`;
  msg += `Offer: ${status.offer || "—"}\n`;
  msg += `Vertical: ${status.vertical || "—"}\n`;
  msg += `Current: ${status.currentAgent || "—"}\n\n`;
  msg += `${progressIcons.research} Research (${status.progress.research ? "done" : "pending"})\n`;
  msg += `${progressIcons.evaluation} Evaluation (${status.progress.evaluation ? "done" : "pending"})\n`;
  msg += `${progressIcons.scripts} Scripts (${status.progress.scripts || 0} generated)\n`;
  msg += `${progressIcons.videos} Videos (${status.progress.videos || 0} produced)\n`;
  msg += `${progressIcons.compliance} Compliance (${status.progress.compliance || 0} reviewed)\n`;
  msg += `${progressIcons.launched} Launch (${status.progress.launched || 0} ads created)\n`;

  if (status.approvalNeeded) {
    msg += `\n⏸️ WAITING: ${status.approvalNeeded.stage} approval needed\n`;
    msg += `Reply "approve" or "reject"`;
  }

  return msg;
}

function formatPipelineSummary(ctx) {
  let msg = `🏁 PIPELINE COMPLETE\n\n`;
  msg += `Run: ${ctx.runId}\n`;
  msg += `Offer: ${ctx.offerName || ctx.offerUrl || "—"}\n\n`;

  msg += `📊 Results:\n`;
  msg += `• Competitor ads analyzed: ${ctx.research?.competitorAds?.length || 0}\n`;
  msg += `• Offer score: ${ctx.evaluation?.score ?? "N/A"}/10\n`;
  msg += `• Scripts generated: ${ctx.scripts?.length || 0}\n`;
  msg += `• Videos produced: ${ctx.videos?.filter(v => v.status === "ready").length || 0}\n`;
  msg += `• Compliance passed: ${ctx.compliance?.filter(c => c.passed).length || 0}/${ctx.compliance?.length || 0}\n`;
  msg += `• Ads created: ${ctx.launch?.adsCreated?.length || 0} (all PAUSED)\n`;

  if (ctx.launch?.adsCreated?.length) {
    msg += `\nUse /enable <adId> to activate individual ads.`;
  }

  return msg;
}

function cancelSession(chatId) {
  pipeline.cancelPipeline(chatId);
  activeSessions.delete(chatId);
}

module.exports = {
  hasActiveSession,
  handleMessage,
  startFullPipeline,
  startResearch,
  startEvaluate,
  startScripts,
  cancelSession,
};
