const { WebClient } = require("@slack/web-api");
const fs = require("fs");
const path = require("path");

const TOKEN_PATH = path.join(__dirname, "..", "..", "slack-token.json");
let slackClient = null;

/**
 * Token rotation: exchange refresh token for a short-lived access token.
 * Stores the new tokens in slack-token.json.
 */
async function refreshAccessToken() {
  const refreshToken = process.env.SLACK_REFRESH_TOKEN;
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error("Slack not configured. Set SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, and SLACK_REFRESH_TOKEN in .env");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack token refresh failed: ${data.error}`);
  }

  // Save new tokens
  const tokenData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 43200) * 1000,
    team_id: data.team?.id,
  };
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2), { mode: 0o600 });

  // Update env for current process so future refreshes use new refresh token
  process.env.SLACK_REFRESH_TOKEN = data.refresh_token;

  return tokenData.access_token;
}

async function getAccessToken() {
  // Check for cached token
  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const cached = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
      // Use cached token if it has >5 minutes remaining
      if (cached.access_token && cached.expires_at && cached.expires_at > Date.now() + 300000) {
        return cached.access_token;
      }
    } catch {}
  }

  // Also support static bot token for simpler setups
  if (process.env.SLACK_BOT_TOKEN) {
    return process.env.SLACK_BOT_TOKEN;
  }

  return refreshAccessToken();
}

async function getSlackClient() {
  const token = await getAccessToken();
  slackClient = new WebClient(token);
  return slackClient;
}

function isSlackConnected() {
  return !!(process.env.SLACK_BOT_TOKEN || process.env.SLACK_REFRESH_TOKEN);
}

async function listChannels() {
  const client = await getSlackClient();
  const res = await client.conversations.list({
    types: "public_channel,private_channel",
    limit: 50,
  });
  return (res.channels || []).map((ch) => ({
    id: ch.id,
    name: ch.name,
    topic: ch.topic?.value || "",
    is_member: ch.is_member,
  }));
}

async function readChannel(channelId, limit = 20) {
  const client = await getSlackClient();
  const res = await client.conversations.history({
    channel: channelId,
    limit,
  });

  const messages = [];
  for (const msg of res.messages || []) {
    let userName = msg.user || "unknown";
    try {
      const userInfo = await client.users.info({ user: msg.user });
      userName = userInfo.user?.real_name || userInfo.user?.name || msg.user;
    } catch {}

    messages.push({
      user: userName,
      text: msg.text,
      timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
    });
  }
  return messages.reverse(); // chronological order
}

async function sendMessage(channelId, text) {
  const client = await getSlackClient();
  const res = await client.chat.postMessage({
    channel: channelId,
    text,
  });
  return { ok: res.ok, channel: channelId, ts: res.ts };
}

async function searchMessages(query, count = 10) {
  const client = await getSlackClient();
  try {
    const res = await client.search.messages({
      query,
      count,
      sort: "timestamp",
      sort_dir: "desc",
    });
    return (res.messages?.matches || []).map((m) => ({
      text: m.text,
      user: m.username || m.user,
      channel: m.channel?.name || "",
      timestamp: m.ts,
      permalink: m.permalink,
    }));
  } catch (err) {
    if (err.data?.error === "missing_scope" || err.data?.error === "not_allowed_token_type") {
      return { error: "Search requires a user token (xoxp-). Use readChannel to read specific channels instead." };
    }
    throw err;
  }
}

module.exports = { isSlackConnected, getSlackClient, listChannels, readChannel, sendMessage, searchMessages };
