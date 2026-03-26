# Current Tracking Setup — Reference Doc

## Overview
We use ClickFlare as our tracker. All Facebook traffic runs through ClickFlare before hitting the landing page.

## Current UTM Structure
All ads currently use the same UTM setup:
```
?utm_source=facebook&utm_medium=paid
```

## Pixel Setup
- Facebook Pixel ID: 44819203716482
- Pixel fires on page load (PageView event)
- Lead event fires on form submit via JavaScript
- No server-side tracking currently

## Known Issues
- Client reported that ClickFlare is showing 320 leads for home insurance this week, but Facebook is reporting 278. We haven't figured out why yet.
- The Camp Lejeune landing page was cloned from the home insurance page last month and "adapted" — no one has QA'd it since.
- Newsletter signups go directly to Beehiiv — no ClickFlare tracking on those. We just use Facebook's reported numbers.

## Conversion Values
- Home Insurance lead: $28 payout from affiliate network
- Camp Lejeune lead: $150 payout (qualified) / $0 (unqualified)
- Newsletter subscriber: monetized via Beehiiv ads, ~$0.12/subscriber/month