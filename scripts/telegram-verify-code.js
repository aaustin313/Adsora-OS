#!/usr/bin/env node
// Step 2: Verify code and complete login
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { Api } = require("telegram/tl");
const fs = require("fs");
const path = require("path");

const SESSION_PATH = path.join(__dirname, "..", "telegram-session.txt");
const STATE_PATH = path.join(__dirname, "..", "telegram-auth-state.json");

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const code = process.argv[2];
const password = process.argv[3] || "";

if (!code) { console.error("Usage: node telegram-verify-code.js CODE [2FA_PASSWORD]"); process.exit(1); }

async function main() {
  if (!fs.existsSync(STATE_PATH)) {
    console.error("No auth state found. Run telegram-send-code.js first.");
    process.exit(1);
  }

  const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
  const client = new TelegramClient(new StringSession(state.session), apiId, apiHash, {
    connectionRetries: 3,
  });

  await client.connect();

  try {
    const result = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: state.phone,
        phoneCodeHash: state.phoneCodeHash,
        phoneCode: code,
      })
    );
    console.log("Signed in successfully!");
  } catch (err) {
    if (err.message.includes("SESSION_PASSWORD_NEEDED")) {
      if (!password) {
        console.error("2FA is enabled. Re-run with your password: node telegram-verify-code.js CODE YOUR_PASSWORD");
        await client.disconnect();
        process.exit(1);
      }
      const passwordResult = await client.invoke(
        new Api.account.GetPassword()
      );
      const srpResult = await client.invoke(
        new Api.auth.CheckPassword({
          password: await client._computeCheck(passwordResult, password),
        })
      );
      console.log("Signed in with 2FA!");
    } else {
      throw err;
    }
  }

  // Save session
  const session = client.session.save();
  fs.writeFileSync(SESSION_PATH, session, { mode: 0o600 });
  console.log("Session saved to telegram-session.txt");

  const me = await client.getMe();
  console.log("Logged in as:", me.firstName, me.lastName || "", "(@" + (me.username || "no username") + ")");

  // Cleanup auth state
  fs.unlinkSync(STATE_PATH);

  await client.disconnect();
  console.log("Done! You can now use read-telegram.js to pull all conversations.");
}

main().catch((e) => console.error("Error:", e.message));
