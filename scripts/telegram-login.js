#!/usr/bin/env node
// One-time login to Telegram User API (MTProto)
// Creates a session file that persists across runs
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const fs = require("fs");
const path = require("path");

const SESSION_PATH = path.join(__dirname, "..", "telegram-session.txt");

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

async function main() {
  if (!apiId || !apiHash) {
    console.error("Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env");
    process.exit(1);
  }

  // Load existing session if available
  let sessionStr = "";
  if (fs.existsSync(SESSION_PATH)) {
    sessionStr = fs.readFileSync(SESSION_PATH, "utf-8").trim();
    console.log("Found existing session, attempting to reuse...");
  }

  const client = new TelegramClient(
    new StringSession(sessionStr),
    apiId,
    apiHash,
    { connectionRetries: 3 }
  );

  await client.start({
    phoneNumber: async () => await input.text("Enter your phone number (with country code, e.g. +1...): "),
    password: async () => await input.text("Enter your 2FA password (if set): "),
    phoneCode: async () => await input.text("Enter the code you received: "),
    onError: (err) => console.error("Auth error:", err.message),
  });

  // Save session
  const session = client.session.save();
  fs.writeFileSync(SESSION_PATH, session, { mode: 0o600 });
  console.log("\nSession saved to telegram-session.txt");

  const me = await client.getMe();
  console.log("Logged in as:", me.firstName, me.lastName || "", "(@" + (me.username || "no username") + ")");

  await client.disconnect();
  console.log("Done! You can now use read-telegram.js to pull all conversations.");
}

main().catch(console.error);
