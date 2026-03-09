---
name: setup-campaign
description: Create a new Facebook campaign structure (campaign, ad sets, ads). Use when user wants to start a new campaign or vertical.
user-invocable: true
allowed-tools: Read, Bash, Grep
---

# Campaign Setup Workflow

## Required Information
1. **Vertical** - home services, mass torts, newsletter, other
2. **Ad account** - which account to use
3. **Objective** - lead generation, traffic, conversions
4. **Budget** - daily budget per ad set or campaign level
5. **Targeting** - audiences, demographics, interests, locations
6. **Creatives** - how many variations to test
7. **Landing page(s)** - URL(s) from Trello

## Campaign Naming Convention
> Adjust these conventions based on user preference
- Campaign: `[Vertical] - [Offer] - [Date]`
- Ad Set: `[Audience] - [Placement] - [Budget]`
- Ad: `[Creative Type] - [Variation] - [Date]`

## Steps
1. Gather all required info (ask for anything missing)
2. Propose campaign structure for review
3. Get explicit confirmation
4. Create campaign → ad sets → ads
5. Confirm everything is set up correctly
6. Set status to paused (user activates when ready)

## Notes
- Start with campaign paused - user decides when to go live
- Use Special Ad Category for housing/employment/credit verticals
- Always set up with proper UTM parameters for tracking
