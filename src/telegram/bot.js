const { Bot } = require("grammy");
const { askClaude, clearHistory } = require("../ai/claude");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_OWNER_ID = process.env.TELEGRAM_OWNER_ID;

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
    clearHistory(ctx.chat.id);
    await ctx.reply("🔄 Conversation cleared. Fresh start!");
  });

  // /help command
  bot.command("help", async (ctx) => {
    await ctx.reply(
      "📋 Adsora Bot Commands\n\n" +
      "Just chat naturally for advice, questions, or tasks.\n\n" +
      "/clear — Reset conversation memory\n" +
      "/help — Show this message\n\n" +
      "More commands coming as integrations go live."
    );
  });

  // Handle all text messages
  bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id;
    const userMessage = ctx.message.text;

    await ctx.replyWithChatAction("typing");

    try {
      const response = await askClaude(chatId, userMessage);

      if (response.length <= 4096) {
        await ctx.reply(response);
      } else {
        const chunks = splitMessage(response, 4096);
        for (const chunk of chunks) {
          await ctx.reply(chunk);
        }
      }
    } catch (error) {
      console.error("Claude API error:", error.message);
      await ctx.reply("⚠️ Something went wrong talking to Claude. Try again in a sec.");
    }
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
