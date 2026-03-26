/**
 * Facebook Ads performance thresholds and configuration.
 * Rules for auto-flagging underperformers.
 */

module.exports = {
  // Performance thresholds (used as fallbacks — monitor now calculates per-account averages)
  MIN_SPEND_FOR_ZERO_CONV: 100, // flag zero conversions after this spend
  PACING_SPIKE_MULTIPLIER: 3.0, // flag if hourly pacing is 3x+ the average
  PACING_MIN_SPEND: 100, // only flag pacing spikes if spend > this amount

  // API rate limiting
  BATCH_SIZE: 10, // concurrent API calls per batch
  TIMEOUT_PER_ACCOUNT_MS: 8000,
  ACCOUNTS_LIMIT: 200, // max accounts to fetch (pagination)

  // Cache TTLs
  ACCOUNT_CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  CACHE_DEFAULT_TTL: 2 * 60 * 1000, // 2 min — default for GET responses
  CACHE_INSIGHTS_TTL: 5 * 60 * 1000, // 5 min — insights data changes slowly

  // Facebook Batch API
  BATCH_API_MAX: 50, // Facebook's hard limit per batch request

  // Async reports
  ASYNC_POLL_INITIAL_MS: 2000, // poll every 2s initially
  ASYNC_POLL_BACKOFF_MS: 5000, // back off to 5s after 5 polls
  ASYNC_MAX_WAIT_MS: 120000, // 2 min max wait
};
