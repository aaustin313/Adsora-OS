---
name: check-performance
description: Analyze Facebook ad performance and flag winners/losers. Use when user asks about ad performance, metrics, or what's working.
user-invocable: true
allowed-tools: Read, Bash, Grep
---

# Performance Analysis Workflow

## When user asks to check performance:

1. **Clarify scope** - Ask if not specified:
   - Time range (today, yesterday, last 7 days, last 30 days)
   - Which ad account(s)
   - Which vertical/campaign (or all)

2. **Pull metrics from Facebook Ads API:**
   - Spend
   - Impressions
   - Clicks / CTR
   - Leads / CPL
   - CPA / ROAS (if available)

3. **Analyze:**
   - Compare against benchmarks (see rules/facebook-ads.md)
   - Identify top performers and underperformers
   - Calculate trends (up/down vs previous period)

4. **Report format:**
   | Campaign | Spend | Leads | CPL | CTR | Status |
   |----------|-------|-------|-----|-----|--------|
   | ...      | ...   | ...   | ... | ... | Scale/Kill/Watch |

5. **Recommendations:**
   - Which ads to scale (increase budget)
   - Which ads to pause (underperforming)
   - Which ads to iterate on (promising but needs work)
   - New tests to consider
