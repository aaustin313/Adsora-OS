/**
 * Facebook API Rate Limit Optimizations
 *
 * Three strategies to stretch the 200 calls/hr/user limit:
 * 1. Response Cache — avoid redundant GET requests
 * 2. Batch API — combine up to 50 requests into 1 HTTP call
 * 3. Async Reports — non-blocking insight fetches that skip rate limits
 */

const tokens = require("./tokens");
const config = require("./config");

const API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// ────────────────────────────────────────────────────────────
// 1. RESPONSE CACHE
// ────────────────────────────────────────────────────────────

class ResponseCache {
  constructor(defaultTtlMs = config.CACHE_DEFAULT_TTL) {
    this.defaultTtl = defaultTtlMs;
    this.store = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  /** Build a deterministic cache key from method + endpoint + sorted params */
  static key(method, endpoint, params) {
    const sorted = Object.keys(params)
      .filter((k) => k !== "access_token")
      .sort()
      .map((k) => `${k}=${typeof params[k] === "object" ? JSON.stringify(params[k]) : params[k]}`)
      .join("&");
    return `${method}:${endpoint}:${sorted}`;
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.data;
  }

  set(key, data, ttlMs) {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs || this.defaultTtl),
    });
  }

  /** Invalidate by prefix (e.g. an object ID) or clear everything */
  invalidate(prefix) {
    if (!prefix) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.includes(prefix)) this.store.delete(key);
    }
  }

  stats() {
    // Lazy eviction — clean expired entries when stats are checked
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
    return { hits: this.hits, misses: this.misses, size: this.store.size };
  }
}

const cache = new ResponseCache();

/** Get the TTL for a given endpoint — insights get a longer TTL */
function ttlForEndpoint(endpoint) {
  if (endpoint.includes("/insights")) return config.CACHE_INSIGHTS_TTL;
  return config.CACHE_DEFAULT_TTL;
}

// ────────────────────────────────────────────────────────────
// 2. FACEBOOK BATCH API
// ────────────────────────────────────────────────────────────

/**
 * Send up to 50 sub-requests in a single HTTP call.
 * Facebook counts this as 1 API call for rate-limiting.
 *
 * @param {Array<{method: string, relativeUrl: string, body?: string}>} requests
 * @param {string} token - access token (all sub-requests share one token)
 * @returns {Array<{code: number, body: object|null, error?: string}>}
 */
async function fbBatchApi(requests, token) {
  if (!requests.length) return [];

  const results = [];
  const maxPerBatch = config.BATCH_API_MAX;

  for (let i = 0; i < requests.length; i += maxPerBatch) {
    const chunk = requests.slice(i, i + maxPerBatch);
    const batchPayload = chunk.map((r) => ({
      method: r.method || "GET",
      relative_url: r.relativeUrl,
      ...(r.body ? { body: r.body } : {}),
    }));

    const body = new URLSearchParams();
    body.set("access_token", token);
    body.set("batch", JSON.stringify(batchPayload));

    const res = await fetch(`https://graph.facebook.com`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const raw = await res.json();
    if (!Array.isArray(raw)) {
      throw new Error(`Batch API error: ${JSON.stringify(raw)}`);
    }

    for (const item of raw) {
      if (!item) {
        results.push({ code: 500, body: null, error: "null response" });
        continue;
      }
      let parsed = null;
      try {
        parsed = JSON.parse(item.body);
      } catch {
        parsed = null;
      }
      results.push({
        code: item.code,
        body: parsed,
        error: parsed?.error?.message || null,
      });
    }
  }

  return results;
}

/**
 * Convenience: batch multiple GET endpoints into one HTTP call.
 * Returns an array of parsed response bodies (null for failures).
 *
 * @param {Array<{endpoint: string, params?: object}>} endpoints
 * @param {string} token
 * @returns {Array<object|null>}
 */
async function fbBatchGet(endpoints, token) {
  const requests = endpoints.map(({ endpoint, params = {} }) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      qs.set(k, typeof v === "object" ? JSON.stringify(v) : v);
    }
    const query = qs.toString();
    return {
      method: "GET",
      relativeUrl: `${API_VERSION}${endpoint}${query ? "?" + query : ""}`,
    };
  });

  const responses = await fbBatchApi(requests, token);
  return responses.map((r) => {
    if (r.code >= 200 && r.code < 300 && r.body && !r.body.error) {
      return r.body;
    }
    return null;
  });
}

/**
 * Group account IDs by their access token for batch operations.
 * @param {string[]} accountIds
 * @returns {Map<string, string[]>} token → [accountId, ...]
 */
async function groupByToken(accountIds) {
  const groups = new Map();
  for (const acctId of accountIds) {
    const id = acctId.startsWith("act_") ? acctId : `act_${acctId}`;
    const token = await tokens.getTokenForAccount(id);
    if (!groups.has(token)) groups.set(token, []);
    groups.get(token).push(id);
  }
  return groups;
}

// ────────────────────────────────────────────────────────────
// 3. ASYNC REPORTS
// ────────────────────────────────────────────────────────────

/**
 * Create an async report run for insights.
 * @returns {string} report_run_id
 */
async function createAsyncReport(objectId, params = {}, token) {
  const url = new URL(`${BASE_URL}/${objectId}/insights`);
  const body = new URLSearchParams();
  body.set("access_token", token);
  for (const [k, v] of Object.entries(params)) {
    body.set(k, typeof v === "object" ? JSON.stringify(v) : v);
  }

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Async report create: ${data.error.message}`);
  return data.report_run_id;
}

/**
 * Poll an async report until it completes.
 * @returns {"Job Completed"|"Job Failed"|"Job Skipped"}
 */
async function pollReportStatus(reportRunId, token, maxWaitMs = config.ASYNC_MAX_WAIT_MS) {
  const start = Date.now();
  let polls = 0;

  while (Date.now() - start < maxWaitMs) {
    const url = new URL(`${BASE_URL}/${reportRunId}`);
    url.searchParams.set("access_token", token);
    url.searchParams.set("fields", "async_status,async_percent_completion");

    const res = await fetch(url.toString());
    const data = await res.json();
    const status = data.async_status;

    if (status === "Job Completed") return status;
    if (status === "Job Failed" || status === "Job Skipped") {
      throw new Error(`Async report ${reportRunId}: ${status}`);
    }

    polls++;
    const delay = polls < 5 ? config.ASYNC_POLL_INITIAL_MS : config.ASYNC_POLL_BACKOFF_MS;
    await new Promise((r) => setTimeout(r, delay));
  }

  throw new Error(`Async report ${reportRunId} timed out after ${maxWaitMs / 1000}s`);
}

/**
 * Fetch results from a completed async report.
 */
async function fetchReportResults(reportRunId, token) {
  const url = new URL(`${BASE_URL}/${reportRunId}/insights`);
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(`Report results: ${data.error.message}`);
  return data;
}

/**
 * All-in-one: create async report → poll → fetch results.
 * Falls back to null on failure (caller can retry synchronously).
 *
 * @param {string} objectId - account/campaign/adset/ad ID
 * @param {object} params - fields, date_preset, etc.
 * @param {string} token
 * @returns {object|null} insights data or null on failure
 */
async function fetchAsyncInsights(objectId, params = {}, token) {
  try {
    const reportId = await createAsyncReport(objectId, params, token);
    await pollReportStatus(reportId, token);
    return await fetchReportResults(reportId, token);
  } catch (err) {
    console.error(`[async-report] Failed for ${objectId}: ${err.message}`);
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// EXPORTS
// ────────────────────────────────────────────────────────────

module.exports = {
  // Cache
  cache,
  ResponseCache,
  ttlForEndpoint,
  // Batch API
  fbBatchApi,
  fbBatchGet,
  groupByToken,
  // Async Reports
  createAsyncReport,
  pollReportStatus,
  fetchReportResults,
  fetchAsyncInsights,
};
