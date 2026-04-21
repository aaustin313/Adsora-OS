#!/usr/bin/env node
/**
 * Updates the Media Buyer Payout Calculator spreadsheet
 * with quarterly profit targets based on days worked.
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { google } = require("googleapis");
const { getAuthClient } = require("../src/google/auth");

const SPREADSHEET_ID = "1nJvjzT7Utage03PScoT0y9yMVmEzfITdJd3IwraqEd4";
const SHEET_ID = 261814990;

async function main() {
  const auth = getAuthClient();
  if (!auth) {
    console.error("Google auth not configured. Run the server and authenticate first.");
    process.exit(1);
  }

  const sheets = google.sheets({ version: "v4", auth });

  // First, read the sheet to find where existing content ends
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "A1:H50",
  });

  const rows = existing.data.values || [];
  console.log(`Sheet has ${rows.length} rows of content.`);

  // Find the last row with content
  let lastRow = rows.length;
  console.log(`Last content row: ${lastRow}`);

  // We'll start our new section 2 rows after last content
  const startRow = lastRow + 3;
  console.log(`Writing new section starting at row ${startRow}`);

  const newData = [
    // Section header
    ["QUARTERLY PROFIT TARGETS (Based on Days Active)", "", "", "", ""],
    ["", "", "", "", ""],
    ["Quarter", "Days Active", "Min Profit Target", "Per-Day Expectation", "Your Rate If Below Target"],
    ["Q1 (First 90 days)", "90", "$15,000", "$167/day", "30% (ramp period)"],
    ["Q2 (Days 91-180)", "180", "$25,000", "$139/day", "25% if below for 2 consecutive months"],
    ["Q3 (Days 181-270)", "270", "$40,000", "$148/day", "25% if below for 2 consecutive months"],
    ["Q4 (Days 271-365)", "365", "$60,000", "$164/day", "25% if below for 2 consecutive months"],
    ["Year 2+", "365+", "$80,000", "$219/day", "25% if below for 2 consecutive months"],
    ["", "", "", "", ""],
    ["HOW IT WORKS", "", "", "", ""],
    ["", "", "", "", ""],
    ["1.", "Targets scale with tenure. The longer you've been here, the higher your floor.", "", "", ""],
    ["2.", "New buyers get a 90-day ramp at $15K min — fair runway to learn.", "", "", ""],
    ["3.", "If you're below your tenure target for 2 consecutive months, rate drops to 25%.", "", "", ""],
    ["4.", "Rate resets back to normal tier once you're above target again.", "", "", ""],
    ["5.", "Targets reset each calendar year for Year 2+ buyers at $80K floor.", "", "", ""],
    ["6.", "This ensures growth — not coasting. The more experienced you are, the more you should produce.", "", "", ""],
  ];

  // Write the data
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `A${startRow}:E${startRow + newData.length - 1}`,
    valueInputOption: "RAW",
    requestBody: {
      values: newData,
    },
  });

  // Format the header rows (bold + background color)
  const requests = [
    // "QUARTERLY PROFIT TARGETS" header - bold + dark blue bg + white text
    {
      repeatCell: {
        range: {
          sheetId: SHEET_ID,
          startRowIndex: startRow - 1,
          endRowIndex: startRow,
          startColumnIndex: 0,
          endColumnIndex: 5,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.118, green: 0.227, blue: 0.373 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 11 },
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat)",
      },
    },
    // Column headers row - bold + light gray bg
    {
      repeatCell: {
        range: {
          sheetId: SHEET_ID,
          startRowIndex: startRow + 1,
          endRowIndex: startRow + 2,
          startColumnIndex: 0,
          endColumnIndex: 5,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
            textFormat: { bold: true, fontSize: 10 },
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat)",
      },
    },
    // "HOW IT WORKS" header - bold + dark blue bg + white text
    {
      repeatCell: {
        range: {
          sheetId: SHEET_ID,
          startRowIndex: startRow + 8,
          endRowIndex: startRow + 9,
          startColumnIndex: 0,
          endColumnIndex: 5,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.118, green: 0.227, blue: 0.373 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 11 },
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat)",
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });

  console.log("✅ Quarterly profit targets added to spreadsheet!");
  console.log(`   View: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit?gid=${SHEET_ID}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
