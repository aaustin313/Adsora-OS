/**
 * Pipeline Store — File-based persistence for pipeline runs.
 * Saves/loads pipeline context to output/pipeline-runs/{runId}/
 */

const fs = require("fs");
const path = require("path");

const RUNS_DIR = path.join(__dirname, "..", "..", "output", "pipeline-runs");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function validatePathSegment(segment) {
  if (!/^[a-zA-Z0-9_-]+$/.test(segment)) {
    throw new Error(`Invalid path segment: ${segment}`);
  }
  return segment;
}

function getRunDir(runId) {
  validatePathSegment(runId);
  const dir = path.join(RUNS_DIR, runId);
  ensureDir(dir);
  return dir;
}

function saveContext(ctx) {
  const dir = getRunDir(ctx.runId);
  fs.writeFileSync(path.join(dir, "context.json"), JSON.stringify(ctx, null, 2));
}

function loadContext(runId) {
  const filePath = path.join(RUNS_DIR, runId, "context.json");
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function saveAgentOutput(runId, agentName, data) {
  const dir = getRunDir(runId); // runId validated in getRunDir
  validatePathSegment(agentName);
  const agentDir = path.join(dir, agentName);
  ensureDir(agentDir);

  if (typeof data === "string") {
    fs.writeFileSync(path.join(agentDir, "output.md"), data);
  } else {
    fs.writeFileSync(path.join(agentDir, "output.json"), JSON.stringify(data, null, 2));
  }
}

function listRuns() {
  ensureDir(RUNS_DIR);
  return fs.readdirSync(RUNS_DIR)
    .filter(f => fs.statSync(path.join(RUNS_DIR, f)).isDirectory())
    .sort()
    .reverse()
    .slice(0, 20);
}

function getLatestRun() {
  const runs = listRuns();
  if (runs.length === 0) return null;
  return loadContext(runs[0]);
}

module.exports = { saveContext, loadContext, saveAgentOutput, listRuns, getLatestRun, getRunDir };
