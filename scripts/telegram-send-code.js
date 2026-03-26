#!/usr/bin/env node
// Step 1: Send verification code to phone number
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const fs = require("fs");
const path = require("path");

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const phone = process.argv[2];

if (!phone) { console.error("Usage: node telegram-send-code.js +1XXXXXXXXXX"); process.exit(1); }

async function main() {
  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 3,
  });

  await client.connect();

  const result = await client.invoke(
    new (require("telegram/tl").Api).auth.SendCode({
      phoneNumber: phone,
      apiId,
      apiHash,
      settings: new (require("telegram/tl").Api).CodeSettings({}),
    })
  );

  console.log("Code sent! Phone code hash: " + result.phoneCodeHash);

  // Save state for step 2
  const state = {
    session: client.session.save(),
    phoneCodeHash: result.phoneCodeHash,
    phone,
  };
  fs.writeFileSync(
    path.join(__dirname, "..", "telegram-auth-state.json"),
    JSON.stringify(state, null, 2),
    { mode: 0o600 }
  );

  await client.disconnect();
  console.log("State saved. Run telegram-verify-code.js with the code next.");
}

main().catch((e) => console.error("Error:", e.message));
