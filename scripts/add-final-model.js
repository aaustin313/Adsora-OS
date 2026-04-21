require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const TOKEN_PATH = path.join(__dirname, "..", "token.json");
const SPREADSHEET_ID = "1nJvjzT7Utage03PScoT0y9yMVmEzfITdJd3IwraqEd4";

async function getAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/auth/callback"
  );
  if (fs.existsSync(TOKEN_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
    client.setCredentials(tokens);
    if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
      const { credentials } = await client.refreshAccessToken();
      client.setCredentials(credentials);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials, null, 2), { mode: 0o600 });
    }
    return client;
  }
  console.error("No token found.");
  process.exit(1);
}

function cell(value, opts = {}) {
  const c = {};
  if (typeof value === "number") {
    c.userEnteredValue = { numberValue: value };
  } else if (typeof value === "string" && value.startsWith("=")) {
    c.userEnteredValue = { formulaValue: value };
  } else {
    c.userEnteredValue = { stringValue: String(value) };
  }
  const format = {};
  if (opts.bold) format.textFormat = { bold: true, ...(opts.fontSize ? { fontSize: opts.fontSize } : {}) };
  else if (opts.fontSize) format.textFormat = { fontSize: opts.fontSize };
  if (opts.bg) format.backgroundColor = opts.bg;
  if (opts.currency) format.numberFormat = { type: "CURRENCY", pattern: "$#,##0" };
  if (opts.percent) format.numberFormat = { type: "PERCENT", pattern: "0%" };
  if (Object.keys(format).length) c.userEnteredFormat = format;
  return c;
}

function row(cells) { return { values: cells }; }

const HDR = { red: 0.15, green: 0.15, blue: 0.15 };
const INPUT = { red: 1, green: 0.97, blue: 0.88 };
const GREEN = { red: 0.85, green: 0.93, blue: 0.85 };
const BLUE = { red: 0.85, green: 0.88, blue: 0.95 };
const GOLD = { red: 0.95, green: 0.90, blue: 0.80 };
const RED = { red: 0.95, green: 0.85, blue: 0.85 };
const BIG_GREEN = { red: 0.70, green: 0.85, blue: 0.70 };

function buildSheet() {
  return [
    row([cell("ADSORA — MEDIA BUYER COMPENSATION", { bold: true, fontSize: 16 })]),
    row([cell("Your rate goes up as you scale. Hit the next level, your whole month pays at the higher rate.", { fontSize: 11 })]),
    row([]),

    // ---- YOUR RATE ----
    row([
      cell("YOUR RATE", { bold: true, fontSize: 13, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([]),
    // Row 6
    row([
      cell("Monthly Net Profit", { bold: true, bg: GREEN }),
      cell("Your Rate", { bold: true, bg: GREEN }),
      cell("", { bg: GREEN }),
    ]),
    // Row 7 - Below floor
    row([
      cell("Under $15K", { bg: RED }),
      cell(0.25, { percent: true, bg: RED }),
      cell("Below floor — 2 months here triggers a review", { bg: RED }),
    ]),
    // Row 8 - Base
    row([
      cell("$15K – $50K", { bg: GREEN }),
      cell(0.30, { percent: true, bg: GREEN }),
      cell("Base — this is where you start", { bg: GREEN }),
    ]),
    // Row 9 - Accelerator 1
    row([
      cell("$50K – $100K", { bg: BLUE }),
      cell(0.33, { percent: true, bg: BLUE }),
      cell("Accelerator 1 — you're scaling", { bg: BLUE }),
    ]),
    // Row 10 - Accelerator 2
    row([
      cell("$100K – $200K", { bg: BLUE }),
      cell(0.36, { percent: true, bg: BLUE }),
      cell("Accelerator 2 — serious volume", { bg: BLUE }),
    ]),
    // Row 11 - Super
    row([
      cell("$200K+", { bg: GOLD }),
      cell(0.40, { percent: true, bg: GOLD }),
      cell("Super Accelerator — must be profitable in 2+ verticals", { bg: GOLD }),
    ]),
    row([]),
    row([cell("When you hit a tier, your ENTIRE month is paid at that rate. Simple.", { bold: true, fontSize: 10 })]),
    row([]),

    // ---- CALCULATOR ----
    row([
      cell("CALCULATE YOUR EARNINGS", { bold: true, fontSize: 13, bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([]),
    // Row 17
    row([
      cell("Your monthly net profit:", { bold: true }),
      cell(100000, { currency: true, bg: INPUT }),
    ]),
    row([]),
    // Row 19
    row([
      cell("Your Rate:", { bold: true, fontSize: 13 }),
      cell("=IF(B17<15000,0.25,IF(B17<50000,0.30,IF(B17<100000,0.33,IF(B17<200000,0.36,0.40))))", { percent: true, bold: true, fontSize: 13 }),
    ]),
    // Row 20
    row([
      cell("You Earn:", { bold: true, fontSize: 15 }),
      cell("=B17*B19", { currency: true, bold: true, fontSize: 15, bg: BIG_GREEN }),
    ]),
    row([]),
    row([]),

    // ---- EXAMPLES ----
    row([
      cell("WHAT YOU'D EARN AT EACH LEVEL", { bold: true, fontSize: 13, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([]),
    // Row 25
    row([
      cell("You Generate", { bold: true, bg: GREEN }),
      cell("Your Rate", { bold: true, bg: GREEN }),
      cell("You Earn", { bold: true, bg: GREEN }),
    ]),
    row([cell(15000, { currency: true }), cell(0.30, { percent: true }), cell("=A26*B26", { currency: true })]),
    row([cell(25000, { currency: true }), cell(0.30, { percent: true }), cell("=A27*B27", { currency: true })]),
    row([cell(50000, { currency: true }), cell(0.33, { percent: true }), cell("=A28*B28", { currency: true })]),
    row([cell(75000, { currency: true }), cell(0.33, { percent: true }), cell("=A29*B29", { currency: true })]),
    row([cell(100000, { currency: true }), cell(0.36, { percent: true }), cell("=A30*B30", { currency: true })]),
    row([cell(150000, { currency: true }), cell(0.36, { percent: true }), cell("=A31*B31", { currency: true })]),
    row([cell(200000, { currency: true }), cell(0.40, { percent: true }), cell("=A32*B32", { currency: true })]),
    row([cell(500000, { currency: true }), cell(0.40, { percent: true }), cell("=A33*B33", { currency: true })]),
    row([]),
    row([]),

    // ---- THE RULES ----
    row([
      cell("THE RULES", { bold: true, fontSize: 13, bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([]),
    row([
      cell("1.", { bold: true }),
      cell("Your rate is based on your total monthly net profit. Hit the next tier, your whole month pays at that rate."),
    ]),
    row([
      cell("2.", { bold: true }),
      cell("Drop below $15K net profit for 2 consecutive months and your rate drops to 25% until you're back above $15K."),
    ]),
    row([
      cell("3.", { bold: true }),
      cell("40% requires you to be profitable in at least 2 verticals. Single-vertical buyers cap at 36%."),
    ]),
    row([
      cell("4.", { bold: true }),
      cell("Ad policy violations or compliance issues = rate drops to 25% for 90 days."),
    ]),
    row([
      cell("5.", { bold: true }),
      cell("If a client doesn't pay within 60 days, that profit reverses from both sides."),
    ]),
    row([
      cell("6.", { bold: true }),
      cell("Paid monthly, Net 30."),
    ]),
  ];
}

async function main() {
  const auth = await getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title: "FINAL — Flat Tiers" } } }],
    },
  });

  const sheetId = addRes.data.replies[0].addSheet.properties.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          updateCells: {
            rows: buildSheet(),
            fields: "userEnteredValue,userEnteredFormat",
            start: { sheetId, rowIndex: 0, columnIndex: 0 },
          },
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 3 },
          },
        },
      ],
    },
  });

  console.log("Done! 'FINAL — Flat Tiers' sheet added.");
  console.log(`\nhttps://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`);
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
