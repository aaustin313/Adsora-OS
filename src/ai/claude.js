const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// --- Load business context from project files ---
function loadSystemPrompt() {
  const rootDir = path.join(__dirname, "..", "..");
  const files = [
    "CLAUDE.md",
    ".claude/rules/facebook-ads.md",
    ".claude/rules/reporting.md",
    ".claude/rules/compliance.md",
  ];

  let context = `You are Austin's AI business advisor for Adsora, running via Telegram.
Keep responses SHORT and scannable — this is a phone screen.
Use emojis for quick visual scanning.
Be direct, opinionated, and action-oriented.
Don't ask Austin for permission or confirmation unless it involves spending money or modifying live ads. Just do the work.

Google data (calendar, emails, drive) is automatically fetched and included in your context when relevant — you don't need to fetch it yourself.
If Google data is included below, use it in your analysis. If not, give your best advice based on what you know.

IMPORTANT — Facebook Ads API IS CONNECTED and live. We have 67 ad accounts linked.
Facebook Ads data (spend, performance, campaigns, leads, purchases, ROAS) is automatically fetched and included in your context when Austin asks about ads.
If Facebook Ads data is included below, analyze it and give insights. Do NOT say "Facebook Ads API isn't connected" — it IS connected.
For actions like pausing/enabling ads or changing budgets, tell Austin to use the slash commands: /pause, /enable, /budget, /switch, /accounts, /campaigns, /adsets, /ads, /perf, /fb.

--- BUSINESS CONTEXT ---\n\n`;

  for (const file of files) {
    const filePath = path.join(rootDir, file);
    if (fs.existsSync(filePath)) {
      context += fs.readFileSync(filePath, "utf-8") + "\n\n";
    }
  }

  return context;
}

const systemPrompt = loadSystemPrompt();

// --- Conversation history (in-memory) ---
const conversations = new Map();
const MAX_HISTORY = 40;

function getHistory(chatId) {
  if (!conversations.has(chatId)) {
    conversations.set(chatId, []);
  }
  return conversations.get(chatId);
}

function addToHistory(chatId, role, content) {
  const history = getHistory(chatId);
  history.push({ role, content });
  if (history.length > MAX_HISTORY) {
    conversations.set(chatId, history.slice(-MAX_HISTORY));
  }
}

function clearHistory(chatId) {
  conversations.delete(chatId);
}

// --- Format conversation history into a prompt string ---
function formatHistoryForPrompt(chatId) {
  const history = getHistory(chatId);
  if (history.length === 0) return "";

  let formatted = "--- CONVERSATION HISTORY ---\n";
  for (const msg of history) {
    const role = msg.role === "user" ? "Austin" : "You";
    const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    formatted += `${role}: ${text.slice(0, 1000)}\n\n`;
  }
  formatted += "--- END HISTORY ---\n\n";
  return formatted;
}

// --- Call Claude Code CLI via spawn + stdin pipe ---
function callClaudeCLI(prompt, systemPromptText, options = {}) {
  return new Promise((resolve, reject) => {
    const claudePath = process.env.CLAUDE_CLI_PATH || "claude";
    const args = [
      "-p",
      "--system-prompt", systemPromptText,
      "--model", options.model || "sonnet",
      "--output-format", "text",
      "--no-session-persistence",
      "--max-turns", "10",
    ];

    console.log(`[CLAUDE CLI] Spawning claude -p (prompt: ${prompt.length} chars)...`);

    const child = spawn(claudePath, args, {
      env: { ...process.env, NO_COLOR: "1", CLAUDECODE: "" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => { stderr += data.toString(); });

    // Send the prompt via stdin, then close it
    child.stdin.write(prompt);
    child.stdin.end();

    // Configurable timeout (default 2 min, pipeline agents get 5 min)
    const timeoutMs = options.timeoutMs || 120000;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Timed out"));
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        console.error(`[CLAUDE CLI] Exit code ${code}`);
        if (stderr) console.error(`[CLAUDE CLI] stderr:`, stderr.slice(0, 500));
        reject(new Error(stderr.slice(0, 200) || `claude exited with code ${code}`));
        return;
      }
      console.log(`[CLAUDE CLI] Response received (${stdout.length} chars)`);
      resolve(stdout.trim());
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// --- Main ask function ---
async function askClaude(chatId, userMessage) {
  const historyContext = formatHistoryForPrompt(chatId);
  const fullPrompt = historyContext
    ? `${historyContext}Austin's latest message:\n${userMessage}`
    : userMessage;

  addToHistory(chatId, "user", userMessage);

  try {
    const response = await callClaudeCLI(fullPrompt, systemPrompt);
    addToHistory(chatId, "assistant", response);
    return response || "(no response)";
  } catch (err) {
    const history = getHistory(chatId);
    if (history.length > 0 && history[history.length - 1].role === "user") {
      history.pop();
    }

    if (err.message?.includes("Timed out") || err.killed) {
      throw new Error("Timed out");
    }
    throw err;
  }
}

module.exports = { askClaude, clearHistory, loadSystemPrompt, callClaudeCLI };
