---
name: weekly-report
description: Generate the weekly performance report combining Facebook Ads and Beehiiv data. Use when user asks for weekly report or summary.
user-invocable: true
allowed-tools: Read, Bash, Grep
---

# Weekly Report Workflow

## Data Sources
1. **Facebook Ads** - all active accounts, last 7 days
2. **Beehiiv** - newsletter metrics, last 7 days
3. **Previous week** - for comparison/trends

## Report Structure

### 1. Executive Summary (3-4 sentences)
Overall spend, leads, blended CPL, trend vs last week.

### 2. Facebook Ads Breakdown

| Vertical | Spend | Leads | CPL | CTR | vs Last Week |
|----------|-------|-------|-----|-----|-------------|
| Home Services | | | | | |
| Mass Torts | | | | | |
| Other | | | | | |
| **Total** | | | | | |

### 3. Top Performers
- Top 3 ads by volume
- Top 3 ads by efficiency (lowest CPL)
- Any breakout winners

### 4. Underperformers
- Ads to pause
- Ads to iterate
- Budget to reallocate

### 5. Newsletter (Beehiiv)
- New subscribers this week
- Total active subscribers
- Open rate / CTR
- Revenue (if applicable)
- Facebook ad performance for newsletter signups

### 6. Next Week Plan
- Budget adjustments
- New creatives to test
- New verticals/offers to launch
- Action items

## Delivery
- Format as clean markdown
- Offer to send summary to Slack
