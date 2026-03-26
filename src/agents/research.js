/**
 * Agent 1: Creative Research Agent
 * Searches Meta Ad Library for competitor ads, Google Trends for trending angles,
 * Google News for timely hooks, and pulls own performance data.
 * Then synthesizes everything into actionable creative research via Claude.
 */

const adLibrary = require("../apis/meta-ad-library");
const trends = require("../apis/google-trends");
const news = require("../apis/google-news");
const fb = require("../facebook/ads");
const { addLog } = require("../pipeline/context");
const { saveAgentOutput } = require("../pipeline/store");

// Map verticals to search terms for ad library + trends + news
const VERTICAL_SEARCH_TERMS = {
  "mass-tort": {
    direct: ["mass tort", "lawsuit settlement", "class action lawsuit", "injury claim", "toxic exposure"],
    indirect: ["personal injury", "disability benefits", "veterans benefits", "medical malpractice"],
    news: ["mass tort lawsuit", "class action settlement", "FDA recall"],
  },
  "home-services": {
    direct: ["home repair", "bathroom remodel", "roofing repair", "HVAC service", "plumbing service"],
    indirect: ["home renovation ideas", "home improvement", "kitchen remodel", "flooring installation"],
    news: ["home repair costs", "housing market", "home renovation trends"],
  },
  "insurance": {
    direct: ["car insurance quote", "auto insurance savings", "home insurance", "life insurance"],
    indirect: ["insurance comparison", "save on insurance", "insurance rates"],
    news: ["insurance rates increase", "auto insurance"],
  },
  "legal": {
    direct: ["personal injury lawyer", "car accident attorney", "workers compensation", "disability lawyer"],
    indirect: ["legal help", "lawsuit", "settlement", "attorney near me"],
    news: ["personal injury lawsuit", "legal settlement"],
  },
  "solar": {
    direct: ["solar panels", "solar installation", "solar energy savings", "free solar"],
    indirect: ["energy bills", "electricity costs", "renewable energy", "tax credit"],
    news: ["solar panel costs", "solar tax credit", "renewable energy"],
  },
  "health": {
    direct: ["weight loss", "health supplement", "joint pain relief", "hearing aids"],
    indirect: ["wellness", "natural remedies", "health tips"],
    news: ["health supplement FDA", "weight loss drug"],
  },
  "finance": {
    direct: ["debt consolidation", "credit repair", "personal loan", "refinance"],
    indirect: ["save money", "credit score", "financial freedom"],
    news: ["interest rates", "credit card debt", "student loans"],
  },
  "newsletter": {
    direct: ["newsletter signup", "email subscription", "daily digest", "news alerts"],
    indirect: ["stay informed", "breaking news", "trending stories"],
    news: ["newsletter growth", "email marketing"],
  },
};

/**
 * Run the full creative research pipeline for an offer.
 * @param {object} ctx - PipelineContext
 * @returns {object} Updated research section
 */
async function run(ctx) {
  addLog(ctx, "Research Agent starting...");
  ctx.currentAgent = "research";

  const vertical = ctx.vertical || "general";
  const searchConfig = VERTICAL_SEARCH_TERMS[vertical] || {
    direct: [vertical, ctx.offerName || vertical],
    indirect: [],
    news: [vertical],
  };

  // Add any custom search terms from options
  if (ctx.options.searchTerms) {
    searchConfig.direct = [...new Set([...searchConfig.direct, ...ctx.options.searchTerms])];
  }
  if (ctx.options.competitors) {
    searchConfig.direct = [...new Set([...searchConfig.direct, ...ctx.options.competitors])];
  }

  // Run all data fetches in parallel
  addLog(ctx, `Fetching data: Ad Library (${searchConfig.direct.length} terms), Trends, News, Own Performance`);

  const [competitorAds, indirectAds, trendsData, newsData, ownPerformance] = await Promise.allSettled([
    // Direct competitor ads
    adLibrary.searchMultiple(searchConfig.direct, { limit: 30 }),
    // Indirect/adjacent ads
    adLibrary.searchMultiple(searchConfig.indirect.slice(0, 3), { limit: 15 }),
    // Google Trends
    trends.researchVertical(vertical, searchConfig.direct.slice(0, 3)),
    // Google News
    news.searchMultiple(searchConfig.news || searchConfig.direct.slice(0, 3)),
    // Own FB performance
    fetchOwnPerformance(ctx),
  ]);

  // Compile competitor ads
  const allCompetitorAds = [];
  if (competitorAds.status === "fulfilled") {
    for (const [term, ads] of competitorAds.value) {
      allCompetitorAds.push(...ads.map(a => ({ ...a, _searchTerm: term })));
    }
  }
  if (indirectAds.status === "fulfilled") {
    for (const [term, ads] of indirectAds.value) {
      allCompetitorAds.push(...ads.map(a => ({ ...a, _searchTerm: term, _indirect: true })));
    }
  }
  ctx.research.competitorAds = allCompetitorAds;

  addLog(ctx, `Found ${allCompetitorAds.length} competitor ads`);

  // Compile trends
  if (trendsData.status === "fulfilled") {
    ctx.research.trendingAngles = trendsData.value;
  }

  // Compile news
  if (newsData.status === "fulfilled") {
    ctx.research.newsHooks = newsData.value;
  }

  // Compile own performance
  if (ownPerformance.status === "fulfilled") {
    ctx.research.ownPerformance = ownPerformance.value;
  }

  // Now synthesize everything through Claude
  addLog(ctx, "Synthesizing research with Claude...");
  const synthesis = await synthesizeResearch(ctx);
  ctx.research.synthesis = synthesis;

  saveAgentOutput(ctx.runId, "research", synthesis);
  addLog(ctx, "Research Agent complete");

  return ctx.research;
}

/**
 * Fetch own ad performance from Facebook.
 */
async function fetchOwnPerformance(ctx) {
  if (!fb.isConfigured()) return { error: "FB not configured" };

  try {
    const accounts = await fb.listAllAdAccounts();
    const activeAccounts = accounts.filter(a => a.account_status === 1);

    // If targeting specific accounts, filter
    let targetAccounts = activeAccounts;
    if (ctx.targetAccounts?.length) {
      targetAccounts = activeAccounts.filter(a =>
        ctx.targetAccounts.some(t =>
          a.name?.toLowerCase().includes(t.toLowerCase()) ||
          a.id === t
        )
      );
    }

    // Get insights for matching accounts (last 7 days)
    const insightsMap = await fb.getMultiAccountInsights(
      targetAccounts.slice(0, 10),
      "last_7d"
    );

    const performance = {
      accounts: [],
      totalSpend: 0,
      totalLeads: 0,
      topCreatives: [],
    };

    for (const acct of targetAccounts.slice(0, 10)) {
      const insights = insightsMap.get(acct.id);
      if (!insights?.data?.length) continue;

      const d = insights.data[0];
      const spend = parseFloat(d.spend || 0);
      const leadAction = d.actions?.find(a =>
        a.action_type === "lead" || a.action_type === "onsite_conversion.lead_grouped"
      );
      const leads = leadAction ? parseInt(leadAction.value) : 0;
      const cpl = leads > 0 ? spend / leads : null;

      performance.accounts.push({
        name: acct.name,
        id: acct.id,
        spend,
        leads,
        cpl: cpl ? cpl.toFixed(2) : "N/A",
        clicks: parseInt(d.clicks || 0),
        ctr: parseFloat(d.ctr || 0).toFixed(2),
      });

      performance.totalSpend += spend;
      performance.totalLeads += leads;
    }

    return performance;
  } catch (err) {
    console.log(`[RESEARCH] Own performance error: ${err.message?.slice(0, 80)}`);
    return { error: err.message };
  }
}

/**
 * Build a comprehensive prompt and call Claude to synthesize research.
 */
async function synthesizeResearch(ctx) {
  const adSummary = adLibrary.formatAdsForAnalysis(ctx.research.competitorAds);
  const trendsSummary = ctx.research.trendingAngles
    ? trends.formatTrendsForAnalysis(ctx.research.trendingAngles)
    : "No trends data.";

  let newsSummary = "No news data.";
  if (ctx.research.newsHooks instanceof Map && ctx.research.newsHooks.size > 0) {
    newsSummary = news.formatNewsForAnalysis(ctx.research.newsHooks);
  }

  let ownPerfSummary = "Own performance data not available.";
  if (ctx.research.ownPerformance?.accounts?.length) {
    ownPerfSummary = "OWN FB ADS PERFORMANCE (last 7 days):\n";
    ownPerfSummary += `Total Spend: $${ctx.research.ownPerformance.totalSpend.toFixed(2)}\n`;
    ownPerfSummary += `Total Leads: ${ctx.research.ownPerformance.totalLeads}\n\n`;
    for (const a of ctx.research.ownPerformance.accounts) {
      ownPerfSummary += `• ${a.name}: $${a.spend.toFixed(2)} spend, ${a.leads} leads, CPL: $${a.cpl}, CTR: ${a.ctr}%\n`;
    }
  }

  const prompt = `You are a world-class creative strategist for performance marketing. Analyze all the data below and produce a CREATIVE RESEARCH BRIEF.

OFFER: ${ctx.offerName || ctx.offerUrl || "Not specified"}
VERTICAL: ${ctx.vertical || "Not specified"}
OFFER URL: ${ctx.offerUrl || "Not provided"}

=== COMPETITOR ADS FROM META AD LIBRARY ===
${adSummary}

=== ${trendsSummary}

=== ${newsSummary}

=== ${ownPerfSummary}

---

Produce a structured research brief with these sections:

1. **MARKET OVERVIEW** (2-3 sentences): What are competitors doing? How saturated is this space?

2. **TOP COMPETITOR PATTERNS** (bullet points): What hooks, angles, emotional triggers, and CTAs are most common? What copy structures dominate?

3. **WINNING AD FORMULAS**: Identify the 3-5 most effective ad patterns you see in the competitor data. For each, explain: the hook type, the emotional trigger, the proof mechanism, and the CTA approach.

4. **TRENDING ANGLES** (from Google Trends + News): What current events, trends, or cultural moments can be leveraged? List 3-5 specific angle ideas with the trend they tie into.

5. **GAP ANALYSIS**: What angles are competitors NOT using that could work? Where is the opportunity?

6. **OWN PERFORMANCE ANALYSIS**: Based on our own ads, what's working and what's not? What should we double down on vs. cut?

7. **RECOMMENDED CONCEPTS** (5-8 specific ad concepts): For each concept, provide:
   - Concept name (short label)
   - Hook approach (first 1-2 lines)
   - Angle/emotion
   - Why it should work (based on competitor data or trend)
   - Estimated format (UGC, voiceover, text overlay, slideshow)

Be specific and actionable. No fluff. This brief will be used to generate actual ad scripts.`;

  const systemPrompt = `You are a creative research analyst for Adsora, a performance marketing agency. You analyze competitor ads, market trends, and own performance data to identify winning creative strategies. Be specific, data-driven, and actionable.`;

  try {
    const { callClaudeCLI } = require("../ai/claude");
    const response = await callClaudeCLI(prompt, systemPrompt, { timeoutMs: 300000 });
    return response;
  } catch (err) {
    console.error(`[RESEARCH] Claude synthesis error: ${err.message}`);
    return `Research data collected but synthesis failed: ${err.message}\n\nRaw data available in pipeline context.`;
  }
}

module.exports = { run };
