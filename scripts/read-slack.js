#!/usr/bin/env node
// Pull recent Slack messages
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { WebClient } = require("@slack/web-api");

const channelFilter = process.argv[2] || "";
const limit = parseInt(process.argv[3]) || 15;

async function main() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) { console.error("SLACK_BOT_TOKEN not set"); process.exit(1); }

  const client = new WebClient(token);

  // List public channels (avoid private_channel if scope missing)
  const res = await client.conversations.list({ types: "public_channel", limit: 50 });
  const channels = res.channels || [];

  if (channelFilter) {
    const ch = channels.find((c) => c.name === channelFilter);
    if (!ch) {
      console.error("Channel not found. Available:", channels.map((c) => c.name).join(", "));
      process.exit(1);
    }
    await printChannel(client, ch, limit);
    return;
  }

  console.log("=== SLACK CHANNELS (" + channels.length + ") ===\n");
  for (const c of channels) {
    console.log("#" + c.name + " (" + c.id + ") " + (c.is_member ? "[joined]" : "") + " - " + (c.topic?.value || ""));
  }

  // Read recent messages from joined channels
  const joined = channels.filter((c) => c.is_member);
  if (joined.length === 0) {
    console.log("\nBot not in any channels. Invite it to channels first.");
    return;
  }

  for (const ch of joined) {
    await printChannel(client, ch, limit);
  }
}

async function printChannel(client, ch, limit) {
  console.log("\n=== #" + ch.name + " ===\n");
  const hist = await client.conversations.history({ channel: ch.id, limit });
  const msgs = (hist.messages || []).reverse();

  const userCache = {};
  for (const m of msgs) {
    if (m.user && !userCache[m.user]) {
      try {
        const u = await client.users.info({ user: m.user });
        userCache[m.user] = u.user?.real_name || u.user?.name || m.user;
      } catch {
        userCache[m.user] = m.user;
      }
    }
    const name = userCache[m.user] || m.user || "bot";
    const time = new Date(parseFloat(m.ts) * 1000).toISOString().slice(0, 19).replace("T", " ");
    console.log("[" + time + "] " + name + ": " + (m.text || "").slice(0, 500));
  }
}

main().catch((e) => {
  console.error("Error:", e.data?.error || e.message);
  process.exit(1);
});
