#!/usr/bin/env node
/**
 * CLI tool for Claude Code to access Adsora OS business systems.
 * Usage: node scripts/cli.js <command> [args...]
 *
 * Commands:
 *   emails [query]         - List recent emails, or search
 *   email <id>             - Read full email by ID
 *   calendar [hours]       - Show upcoming events (default: 24h)
 *   drive [query]          - List or search Google Drive files
 *   doc <fileId>           - Read a Google Doc
 *   slack <channel> [msg]  - Read or send Slack messages
 *   revenue [period]       - ClickFlare revenue (today/week/month/offer)
 *   status                 - Show all system statuses
 */

const path = require("path");

// Load env first
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// Bootstrap Google auth
const { isAuthenticated, getAuthClient } = require("../src/google/auth");

async function main() {
  const [,, command, ...args] = process.argv;

  if (!command || command === "help") {
    console.log(`
Adsora OS CLI — Business Data Access
=====================================
Commands:
  emails [query]       List recent emails or search
  email <id>           Read full email
  calendar [hours]     Upcoming events (default 24h)
  drive [query]        List/search Google Drive
  doc <fileId>         Read a Google Doc
  revenue [period]     ClickFlare revenue (today/week/month/offer/source/trend)
  status               System status check
`);
    return;
  }

  try {
    // Initialize auth client
    getAuthClient();

    switch (command) {
      case "emails": {
        const gmail = require("../src/google/gmail");
        if (args[0]) {
          const results = await gmail.searchEmails(args.join(" "));
          console.log(JSON.stringify(results, null, 2));
        } else {
          const results = await gmail.listEmails(10);
          console.log(JSON.stringify(results, null, 2));
        }
        break;
      }

      case "email": {
        const gmail = require("../src/google/gmail");
        if (!args[0]) { console.log("Usage: email <id>"); return; }
        const result = await gmail.getEmail(args[0]);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case "calendar": {
        const calendar = require("../src/google/calendar");
        const hours = parseInt(args[0]) || 24;
        const events = await calendar.getUpcomingEvents(hours);
        if (events.length === 0) {
          console.log("No upcoming events in the next " + hours + " hours.");
        } else {
          console.log(JSON.stringify(events, null, 2));
        }
        break;
      }

      case "drive": {
        const drive = require("../src/google/drive");
        if (args[0]) {
          const results = await drive.searchFiles(args.join(" "));
          console.log(JSON.stringify(results, null, 2));
        } else {
          const results = await drive.listFiles(15);
          console.log(JSON.stringify(results, null, 2));
        }
        break;
      }

      case "doc": {
        const drive = require("../src/google/drive");
        if (!args[0]) { console.log("Usage: doc <fileId>"); return; }
        const content = await drive.readDoc(args[0]);
        console.log(content);
        break;
      }

      case "revenue": {
        const period = args[0] || "today";
        try {
          const { getRevenue } = require("../src/clickflare/client");
          const data = await getRevenue(period);
          console.log(JSON.stringify(data, null, 2));
        } catch (e) {
          console.log("ClickFlare error: " + e.message);
        }
        break;
      }

      case "status": {
        console.log("=== Adsora OS System Status ===\n");

        // Google
        if (isAuthenticated()) {
          console.log("✅ Google (Gmail, Drive, Calendar) — connected");
        } else {
          console.log("❌ Google — not connected");
        }

        // Slack
        if (process.env.SLACK_BOT_TOKEN) {
          console.log("✅ Slack — token configured");
        } else {
          console.log("❌ Slack — no token");
        }

        // ClickFlare
        if (process.env.CLICKFLARE_API_KEY) {
          console.log("✅ ClickFlare — API key configured");
        } else {
          console.log("❌ ClickFlare — no API key");
        }

        // Telegram
        if (process.env.TELEGRAM_BOT_TOKEN) {
          console.log("✅ Telegram — bot token configured");
        } else {
          console.log("❌ Telegram — no token");
        }

        // Facebook
        if (process.env.FACEBOOK_ACCESS_TOKEN) {
          console.log("✅ Facebook Ads — token configured");
        } else {
          console.log("❌ Facebook Ads — no token");
        }

        // Fathom
        if (process.env.FATHOM_API_KEY) {
          console.log("✅ Fathom — API key configured");
        } else {
          console.log("❌ Fathom — no API key");
        }

        // GoHighLevel
        if (process.env.GHL_API_KEY) {
          console.log("✅ GoHighLevel — API key configured");
        } else {
          console.log("❌ GoHighLevel — no API key");
        }

        console.log("");
        break;
      }

      default:
        console.log(`Unknown command: ${command}. Run 'node scripts/cli.js help' for usage.`);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
