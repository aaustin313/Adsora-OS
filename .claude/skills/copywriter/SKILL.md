---
name: copywriter
description: Generate ad copy, headlines, and scripts using swipe file library from Google Drive. Use when user asks to write any ad material.
user-invocable: true
allowed-tools: Read, Bash, Grep, Agent
---

# Copywriter Agent

Write ad copy, headlines, scripts, and email copy grounded in Austin's swipe file library.

## How It Works

1. **Swipe files** are pulled from 3 Google Drive folders via API (cached 2 hours)
2. Claude analyzes the patterns: hooks, emotional triggers, structure, CTAs, tone
3. New copy is generated following those proven patterns — never copied verbatim
4. All copy is compliant with Facebook ad policies

## Swipe File Folders (Google Drive)
- `1EVIbiz2cj4eEHk3UbvU2wqYVIujFMl6Y`
- `1Hm2oREx1hhRI0q0lR6TQ3xJMreeGTi7r`
- `1J10VgPzqNm65J_G0bFuaTKZgtEmez03J`

## Automatic Activation

The copywriter activates automatically when the message contains:
- "write ad copy", "generate headlines", "draft a script"
- "ad copy", "copywriting", "headlines", "ad creative", "primary text"
- Any `/copy` command in Telegram

## What It Can Generate
- **Ad copy** (short-form Facebook, long-form direct response)
- **Headlines** (punchy, 3-5 words, scroll-stopping)
- **Primary text** (Facebook ad primary text field)
- **Email subject lines** and body copy
- **Landing page copy** (headlines, subheads, bullet points, CTAs)
- **Video scripts** (hook → problem → solution → CTA)

## Required Info (ask if not provided)
1. **Offer/product** — what are we promoting?
2. **Target audience** — who are we talking to?
3. **Landing page URL** — where does the CTA point? (optional)
4. **Quantity** — how many variations?
5. **Length** — short (2-3 lines), medium (paragraph), or long (full DM/letter)?

## Telegram Commands
- `/copy <request>` — Generate copy (e.g., `/copy 5 headlines for disability claims`)
- `/swipe` — View loaded swipe files
- `/swipe refresh` — Force reload from Drive
