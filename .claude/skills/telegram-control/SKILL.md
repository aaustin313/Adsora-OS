---
name: telegram-setup
description: Set up Telegram bot for remote business control. Use when connecting Telegram.
user-invocable: true
allowed-tools: Read, Bash, Edit, Write, Grep
---

# Telegram Bot Setup

## Overview
Create a Telegram bot that lets Austin control Adsora from his phone.

## Bot Commands to Implement
- `/status` — Quick business snapshot (spend today, leads, top performers)
- `/report` — Generate and send performance report
- `/launch` — Start ad launch workflow (guided)
- `/pause [ad_id]` — Pause an ad
- `/scale [ad_id] [amount]` — Increase budget (requires confirmation)
- `/spend` — Today's total spend across accounts
- `/leads` — Today's lead count and CPL
- `/alerts` — Show any issues needing attention

## Setup Steps
1. Create bot via @BotFather on Telegram
2. Get bot token
3. Build simple Node.js/Python bot server
4. Connect to Claude Code via MCP or direct API
5. Deploy (can run on a simple VPS or even locally)

## Design Principles
- Responses must be SHORT (it's a phone screen)
- Use emojis for quick scanning in Telegram
- Always confirm before any action that spends money
- Send proactive alerts for anomalies (spend spikes, CPL jumps, ad rejections)
