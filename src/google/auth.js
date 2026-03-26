const { google } = require("googleapis");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const TOKEN_PATH = path.join(__dirname, "..", "..", "token.json");

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/forms.body",
  "https://www.googleapis.com/auth/spreadsheets",
];

let oAuth2Client = null;
let pendingState = null;

function createClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return null;
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/auth/callback"
  );

  // Load saved tokens if they exist
  if (fs.existsSync(TOKEN_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
    client.setCredentials(tokens);
  }

  return client;
}

function getAuthClient() {
  if (!oAuth2Client) {
    oAuth2Client = createClient();
  }
  return oAuth2Client;
}

function getMissingScopes() {
  if (!fs.existsSync(TOKEN_PATH)) return SCOPES;
  try {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
    const granted = (tokens.scope || "").split(" ");
    return SCOPES.filter((s) => !granted.includes(s));
  } catch {
    return SCOPES;
  }
}

function needsReauth() {
  return getMissingScopes().length > 0;
}

function getAuthUrl() {
  const client = getAuthClient();
  if (!client) return null;

  pendingState = crypto.randomBytes(32).toString("hex");

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: pendingState,
  });
}

function validateState(state) {
  if (!pendingState || state !== pendingState) return false;
  pendingState = null;
  return true;
}

async function handleCallback(code) {
  const client = getAuthClient();
  if (!client) throw new Error("Google OAuth client not configured");

  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  return tokens;
}

function isAuthenticated() {
  const client = getAuthClient();
  if (!client) return false;

  const creds = client.credentials;
  return !!(creds && (creds.access_token || creds.refresh_token));
}

module.exports = { getAuthClient, getAuthUrl, handleCallback, isAuthenticated, validateState, needsReauth, getMissingScopes };
