/**
 * PipelineContext — Shared data object that flows through all agents.
 * Each agent reads what it needs and writes to its designated section.
 */

const crypto = require("crypto");

function createContext({ offerUrl, offerName, vertical, targetAccounts, options = {} }) {
  return {
    // Input
    runId: `${new Date().toISOString().slice(0, 10)}-${vertical || "general"}-${crypto.randomBytes(3).toString("hex")}`,
    offerUrl: offerUrl || null,
    offerName: offerName || null,
    vertical: vertical || null,
    targetAccounts: targetAccounts || [],
    options, // { forceRun, skipVideo, skipLaunch, searchTerms, competitors }

    // Agent 1: Research
    research: {
      competitorAds: [],       // from Meta Ad Library
      trendingAngles: [],      // from Google Trends
      newsHooks: [],           // from Google News
      ownPerformance: {},      // from existing FB Ads data
      topCreatives: [],        // best performers from own ads
      synthesis: "",           // Claude's research synthesis
    },

    // Agent 2: Evaluation
    evaluation: {
      score: null,             // 0-10
      demographics: {},
      psychographics: {},
      platformFit: "",
      risks: [],
      recommendations: [],
      proceed: null,           // gate: if score < 4, pipeline stops
    },

    // Agent 3: Scripts
    scripts: [],
    // Each: { id, type, hook, angle, fullScript, estimatedLength, targetEmotion, headline, primaryText }

    // Agent 4: Videos
    videos: [],
    // Each: { scriptId, localPath, klingTaskId, status, durationMs }

    // Agent 5: Compliance
    compliance: [],
    // Each: { scriptId, passed, violations, suggestions, revisedScript }

    // Agent 6: Launch
    launch: {
      adsCreated: [],
      adsFailed: [],
      totalAds: 0,
    },

    // Meta
    startedAt: new Date().toISOString(),
    status: "pending", // pending, running, paused, completed, failed
    currentAgent: null,
    log: [],
    approvalNeeded: null, // { stage, message } — set when pipeline needs Austin's OK
  };
}

function addLog(ctx, message) {
  ctx.log.push({ ts: new Date().toISOString(), message });
  console.log(`[PIPELINE ${ctx.runId}] ${message}`);
}

module.exports = { createContext, addLog };
