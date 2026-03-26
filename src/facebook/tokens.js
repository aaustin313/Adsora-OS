/**
 * Multi-token registry for Facebook Marketing API.
 * Supports multiple Business Managers by mapping each ad account to its token.
 *
 * Env vars:
 *   FACEBOOK_ACCESS_TOKENS — comma-separated list of tokens (preferred)
 *   FACEBOOK_ACCESS_TOKEN  — single token (backwards compat fallback)
 */

const { ACCOUNT_CACHE_TTL } = require("./config");

const API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// --- Token parsing ---

function parseTokens() {
  const multi = process.env.FACEBOOK_ACCESS_TOKENS;
  if (multi) {
    return multi.split(",").map((t) => t.trim()).filter(Boolean);
  }
  const single = process.env.FACEBOOK_ACCESS_TOKEN;
  return single ? [single] : [];
}

// --- State ---

const tokens = parseTokens();

// Map<accountId, { token, name, account_status, currency, amount_spent }>
let accountMap = new Map();
let allAccountsList = [];
let initPromise = null;
let lastInitAt = 0;

// --- Init: build account-to-token mapping ---

async function initialize(force = false) {
  if (
    !force &&
    initPromise &&
    Date.now() - lastInitAt < ACCOUNT_CACHE_TTL
  ) {
    return initPromise;
  }
  initPromise = _buildMapping();
  return initPromise;
}

async function _buildMapping() {
  const newMap = new Map();
  const merged = [];

  for (const token of tokens) {
    const accounts = await _fetchAllAccounts(token);
    for (const acct of accounts) {
      if (!newMap.has(acct.id)) {
        newMap.set(acct.id, { token, ...acct });
        merged.push(acct);
      }
    }
  }

  accountMap = newMap;
  allAccountsList = merged;
  lastInitAt = Date.now();
}

async function _fetchAllAccounts(token) {
  const all = [];
  const firstUrl = new URL(`${BASE_URL}/me/adaccounts`);
  firstUrl.searchParams.set("fields", "id,name,account_status,currency,amount_spent");
  firstUrl.searchParams.set("limit", "100");
  firstUrl.searchParams.set("access_token", token);
  let url = firstUrl.toString();

  while (url && all.length < 500) {
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) {
      console.error("[tokens] Error fetching accounts");
      break;
    }
    all.push(...(data.data || []));
    url = data.paging?.next || null;
  }
  return all;
}

// --- Lookups ---

async function getTokenForAccount(accountId) {
  await initialize();
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const entry = accountMap.get(id);
  return entry ? entry.token : getDefaultToken();
}

function getDefaultToken() {
  return tokens[0] || "";
}

function hasTokens() {
  return tokens.length > 0;
}

async function getAllAccounts() {
  await initialize();
  return allAccountsList;
}

async function refreshMapping() {
  return initialize(true);
}

function getTokenCount() {
  return tokens.length;
}

module.exports = {
  initialize,
  getTokenForAccount,
  getDefaultToken,
  hasTokens,
  getAllAccounts,
  refreshMapping,
  getTokenCount,
};
