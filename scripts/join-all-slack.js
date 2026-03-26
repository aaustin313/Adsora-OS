#!/usr/bin/env node
// Join the bot to all public Slack channels
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { WebClient } = require("@slack/web-api");

async function main() {
  const client = new WebClient(process.env.SLACK_BOT_TOKEN);

  const res = await client.conversations.list({ types: "public_channel", limit: 200 });
  const channels = res.channels || [];
  console.log("Found " + channels.length + " public channels\n");

  let joined = 0;
  let already = 0;

  for (const ch of channels) {
    if (ch.is_member) {
      console.log("  Already in #" + ch.name);
      already++;
    } else {
      try {
        await client.conversations.join({ channel: ch.id });
        console.log("  Joined #" + ch.name);
        joined++;
      } catch (e) {
        console.log("  Failed #" + ch.name + ": " + (e.data?.error || e.message));
      }
    }
  }

  console.log("\nDone! Joined " + joined + " new channels. Already in " + already + ".");
}

main().catch((e) => console.error("Error:", e.data?.error || e.message));
