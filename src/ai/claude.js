const Anthropic = require("@anthropic-ai/sdk").default;
const fs = require("fs");
const path = require("path");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.warn("⚠️  ANTHROPIC_API_KEY not set — Claude AI features disabled.");
}

const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

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
If Austin asks you to do something that requires confirmation (spending money, modifying ads), always confirm first.

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

// --- Call Claude ---
async function askClaude(chatId, userMessage) {
  if (!anthropic) {
    return "⚠️ Claude AI is not configured. Set ANTHROPIC_API_KEY in .env";
  }

  addToHistory(chatId, "user", userMessage);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: systemPrompt,
    messages: getHistory(chatId),
  });

  const assistantMessage = response.content[0].text;
  addToHistory(chatId, "assistant", assistantMessage);

  return assistantMessage;
}

module.exports = { askClaude, clearHistory, loadSystemPrompt };
