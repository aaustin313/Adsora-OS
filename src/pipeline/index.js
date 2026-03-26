/**
 * Pipeline Orchestrator
 * Runs the 6-agent creative production pipeline sequentially.
 * Supports approval gates, pause/resume, and progress callbacks.
 */

const EventEmitter = require("events");
const { createContext, addLog } = require("./context");
const { saveContext, loadContext } = require("./store");
const researchAgent = require("../agents/research");
const evaluatorAgent = require("../agents/evaluator");
const scriptwriterAgent = require("../agents/scriptwriter");
const videoProducerAgent = require("../agents/video-producer");
const complianceAgent = require("../agents/compliance");
const launcherAgent = require("../agents/launcher");

// Active pipeline runs (one per chat)
const activeRuns = new Map();

class AdPipeline extends EventEmitter {
  constructor(config) {
    super();
    this.ctx = createContext(config);
    this.paused = false;
    this.approvalResolver = null;
  }

  /**
   * Run the full pipeline.
   * Emits events: agent-start, agent-complete, approval-needed, gate-blocked, complete, error
   */
  async run() {
    this.ctx.status = "running";
    saveContext(this.ctx);

    try {
      // Phase 1: Research
      await this.runAgent("research", () => researchAgent.run(this.ctx));

      // Phase 2: Evaluation (gate — can block pipeline)
      await this.runAgent("evaluator", () => evaluatorAgent.run(this.ctx));

      if (!this.ctx.evaluation.proceed && !this.ctx.options.forceRun) {
        addLog(this.ctx, `Pipeline blocked: Offer scored ${this.ctx.evaluation.score}/10`);
        this.emit("gate-blocked", {
          agent: "evaluator",
          score: this.ctx.evaluation.score,
          verdict: this.ctx.evaluation.verdict,
        });
        this.ctx.status = "blocked";
        saveContext(this.ctx);
        return this.ctx;
      }

      // Phase 3: Script Generation
      await this.runAgent("scriptwriter", () => scriptwriterAgent.run(this.ctx));

      if (!this.ctx.scripts?.length) {
        addLog(this.ctx, "No scripts generated — stopping pipeline");
        this.ctx.status = "failed";
        saveContext(this.ctx);
        return this.ctx;
      }

      // APPROVAL GATE: Scripts need review before video production (costs money)
      if (!this.ctx.options.skipApproval) {
        addLog(this.ctx, "Waiting for script approval...");
        this.ctx.approvalNeeded = {
          stage: "scripts",
          message: scriptwriterAgent.formatScripts(this.ctx.scripts),
        };
        this.ctx.status = "paused";
        saveContext(this.ctx);
        this.emit("approval-needed", this.ctx.approvalNeeded);

        // Wait for approval
        const approved = await this.waitForApproval();
        if (!approved) {
          addLog(this.ctx, "Scripts rejected — pipeline cancelled");
          this.ctx.status = "cancelled";
          saveContext(this.ctx);
          return this.ctx;
        }
        this.ctx.approvalNeeded = null;
        this.ctx.status = "running";
      }

      // Phase 4: Video Production (if not skipped)
      if (!this.ctx.options.skipVideo) {
        await this.runAgent("video-producer", () =>
          videoProducerAgent.run(this.ctx, (msg) => this.emit("progress", msg))
        );
      }

      // Phase 5: Compliance Review
      await this.runAgent("compliance", () => complianceAgent.run(this.ctx));

      // Phase 6: Launch (if not skipped)
      if (!this.ctx.options.skipLaunch) {
        // APPROVAL GATE: Launch needs confirmation
        if (!this.ctx.options.skipApproval) {
          addLog(this.ctx, "Waiting for launch approval...");
          const complianceSummary = complianceAgent.formatCompliance(this.ctx.compliance);
          this.ctx.approvalNeeded = {
            stage: "launch",
            message: complianceSummary + "\n\nApprove launch?",
          };
          this.ctx.status = "paused";
          saveContext(this.ctx);
          this.emit("approval-needed", this.ctx.approvalNeeded);

          const approved = await this.waitForApproval();
          if (!approved) {
            addLog(this.ctx, "Launch rejected — pipeline complete (no launch)");
            this.ctx.status = "completed";
            saveContext(this.ctx);
            return this.ctx;
          }
          this.ctx.approvalNeeded = null;
          this.ctx.status = "running";
        }

        await this.runAgent("launcher", () =>
          launcherAgent.run(this.ctx, (msg) => this.emit("progress", msg))
        );
      }

      this.ctx.status = "completed";
      saveContext(this.ctx);
      addLog(this.ctx, "Pipeline complete!");
      this.emit("complete", this.ctx);

      return this.ctx;
    } catch (err) {
      this.ctx.status = "failed";
      addLog(this.ctx, `Pipeline error: ${err.message}`);
      saveContext(this.ctx);
      this.emit("error", err);
      throw err;
    }
  }

  async runAgent(name, agentFn) {
    this.ctx.currentAgent = name;
    addLog(this.ctx, `Starting agent: ${name}`);
    this.emit("agent-start", { name, runId: this.ctx.runId });
    saveContext(this.ctx);

    const result = await agentFn();

    addLog(this.ctx, `Agent complete: ${name}`);
    this.emit("agent-complete", { name, runId: this.ctx.runId });
    saveContext(this.ctx);

    return result;
  }

  /**
   * Wait for Austin's approval via Telegram.
   * Returns a promise that resolves when approve() or reject() is called.
   */
  waitForApproval() {
    return new Promise((resolve) => {
      this.approvalResolver = resolve;
      // Auto-timeout after 30 minutes
      setTimeout(() => {
        if (this.approvalResolver === resolve) {
          this.approvalResolver = null;
          resolve(false);
        }
      }, 30 * 60 * 1000);
    });
  }

  approve() {
    if (this.approvalResolver) {
      this.approvalResolver(true);
      this.approvalResolver = null;
    }
  }

  reject() {
    if (this.approvalResolver) {
      this.approvalResolver(false);
      this.approvalResolver = null;
    }
  }

  getStatus() {
    return {
      runId: this.ctx.runId,
      status: this.ctx.status,
      currentAgent: this.ctx.currentAgent,
      offer: this.ctx.offerName || this.ctx.offerUrl,
      vertical: this.ctx.vertical,
      approvalNeeded: this.ctx.approvalNeeded,
      progress: {
        research: !!this.ctx.research?.synthesis,
        evaluation: this.ctx.evaluation?.score !== null,
        scripts: this.ctx.scripts?.length || 0,
        videos: this.ctx.videos?.length || 0,
        compliance: this.ctx.compliance?.length || 0,
        launched: this.ctx.launch?.adsCreated?.length || 0,
      },
    };
  }
}

// --- Pipeline management ---

function startPipeline(chatId, config) {
  if (activeRuns.has(chatId)) {
    throw new Error("A pipeline is already running. Use /pipeline cancel to stop it first.");
  }
  const pipeline = new AdPipeline(config);
  activeRuns.set(chatId, pipeline);
  return pipeline;
}

function getPipeline(chatId) {
  return activeRuns.get(chatId) || null;
}

function cancelPipeline(chatId) {
  const pipeline = activeRuns.get(chatId);
  if (pipeline) {
    pipeline.reject();
    pipeline.ctx.status = "cancelled";
    saveContext(pipeline.ctx);
    activeRuns.delete(chatId);
  }
}

function removePipeline(chatId) {
  activeRuns.delete(chatId);
}

// --- Standalone agent runners (for individual commands) ---

async function runResearchOnly(config) {
  const ctx = createContext(config);
  ctx.status = "running";
  await researchAgent.run(ctx);
  ctx.status = "completed";
  saveContext(ctx);
  return ctx;
}

async function runEvaluatorOnly(config) {
  const ctx = createContext(config);
  ctx.status = "running";
  await evaluatorAgent.run(ctx);
  ctx.status = "completed";
  saveContext(ctx);
  return ctx;
}

async function runScriptsOnly(config) {
  const ctx = createContext(config);
  ctx.status = "running";
  await researchAgent.run(ctx);
  await evaluatorAgent.run(ctx);
  await scriptwriterAgent.run(ctx);
  ctx.status = "completed";
  saveContext(ctx);
  return ctx;
}

module.exports = {
  AdPipeline,
  startPipeline,
  getPipeline,
  cancelPipeline,
  removePipeline,
  runResearchOnly,
  runEvaluatorOnly,
  runScriptsOnly,
};
