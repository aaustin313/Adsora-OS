#!/usr/bin/env node
// Pull recent emails from Gmail using stored OAuth tokens
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const TOKEN_PATH = path.join(__dirname, "..", "token.json");
const query = process.argv[2] || "";
const maxResults = parseInt(process.argv[3]) || 15;

async function main() {
  if (!fs.existsSync(TOKEN_PATH)) {
    console.error("No token.json found. Run the server and authenticate first.");
    process.exit(1);
  }

  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials(tokens);

  // Refresh token if needed
  auth.on("tokens", (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2), { mode: 0o600 });
  });

  const gmail = google.gmail({ version: "v1", auth });

  const listParams = { userId: "me", maxResults };
  if (query) listParams.q = query;

  const res = await gmail.users.messages.list(listParams);
  const messages = res.data.messages || [];

  if (messages.length === 0) {
    console.log("No emails found.");
    return;
  }

  for (const msg of messages) {
    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    });

    const headers = detail.data.payload.headers;
    const from = headers.find((h) => h.name === "From")?.value || "";
    const subject = headers.find((h) => h.name === "Subject")?.value || "";
    const date = headers.find((h) => h.name === "Date")?.value || "";
    const snippet = detail.data.snippet;

    console.log(`\n--- ${msg.id} ---`);
    console.log(`Date: ${date}`);
    console.log(`From: ${from}`);
    console.log(`Subject: ${subject}`);
    console.log(`Preview: ${snippet}`);
  }
}

main().catch(console.error);
