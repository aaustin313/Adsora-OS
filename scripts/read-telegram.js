#!/usr/bin/env node
// Pull recent Telegram conversations from ALL chats using User API
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const fs = require("fs");
const path = require("path");

const SESSION_PATH = path.join(__dirname, "..", "telegram-session.txt");

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

// Usage: node read-telegram.js [chatName] [limit]
const chatFilter = process.argv[2] || "";
const msgLimit = parseInt(process.argv[3]) || 20;

async function main() {
  if (!fs.existsSync(SESSION_PATH)) {
    console.error("No session found. Run telegram-login.js first.");
    process.exit(1);
  }

  const sessionStr = fs.readFileSync(SESSION_PATH, "utf-8").trim();
  const client = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, {
    connectionRetries: 3,
  });

  await client.connect();

  const dialogs = await client.getDialogs({ limit: 30 });

  if (chatFilter) {
    const dialog = dialogs.find(
      (d) => d.title?.toLowerCase().includes(chatFilter.toLowerCase()) ||
             d.entity?.username?.toLowerCase() === chatFilter.toLowerCase()
    );
    if (!dialog) {
      console.error("Chat not found. Available chats:");
      dialogs.forEach((d) => console.log("  - " + d.title));
      process.exit(1);
    }
    await printChat(client, dialog, msgLimit);
  } else {
    console.log("=== RECENT TELEGRAM CHATS ===\n");
    for (const d of dialogs) {
      const unread = d.unreadCount > 0 ? " (" + d.unreadCount + " unread)" : "";
      console.log("  " + d.title + unread);
    }

    // Print recent messages from top chats
    const topChats = dialogs.slice(0, 10);
    for (const d of topChats) {
      await printChat(client, d, msgLimit);
    }
  }

  await client.disconnect();
}

async function printChat(client, dialog, limit) {
  console.log("\n=== " + dialog.title + " ===\n");

  const messages = await client.getMessages(dialog.entity, { limit });

  // Print in chronological order (oldest first)
  const sorted = [...messages].reverse();

  for (const msg of sorted) {
    if (!msg.message && !msg.action) continue;

    const date = msg.date ? new Date(msg.date * 1000).toISOString().slice(0, 19).replace("T", " ") : "";
    let sender = "";

    if (msg.sender) {
      sender = msg.sender.firstName || msg.sender.title || msg.sender.username || "Unknown";
    } else if (msg.out) {
      sender = "You";
    }

    const text = msg.message || "(action/media)";
    console.log("[" + date + "] " + sender + ": " + text.slice(0, 500));
  }
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
