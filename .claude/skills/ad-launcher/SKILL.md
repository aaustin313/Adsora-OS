---
name: launch-ad
description: Launch a new ad on Facebook from Trello card and Google Drive creative. Use when user wants to set up or launch a new ad.
user-invocable: true
allowed-tools: Read, Bash, Grep
---

# Ad Launch Workflow

When the user wants to launch an ad, follow this checklist:

## Required Information (ask if not provided)
1. **Trello card URL or name** - contains the landing page link
2. **Google Drive creative** - image/video file or folder
3. **Ad account** - which Facebook ad account
4. **Campaign** - which campaign to place it in
5. **Ad set** - which ad set (audience/targeting)
6. **Ad copy** - headline, primary text, description (or generate options)
7. **Budget** - daily or lifetime (if creating new ad set)

## Steps
1. Confirm all required info with user
2. Pull landing page URL from Trello
3. Identify creative from Google Drive
4. Show user the full ad setup for review:
   - Ad account → Campaign → Ad set
   - Creative + copy + landing page URL
5. Get explicit confirmation before launching
6. Launch the ad
7. Confirm ad is live and share the ad ID

## Safety
- ALWAYS show the full setup and get confirmation before launching
- Double-check the ad account is correct
- Verify landing page URL is working
