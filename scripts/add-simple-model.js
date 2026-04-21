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
const GOLD = { red: 0.95, green: 0.90, blue: 0.80 };
const RED = { red: 0.95, green: 0.85, blue: 0.85 };

function buildSheet() {
  return [
    row([cell("ADSORA — MEDIA BUYER COMPENSATION", { bold: true, fontSize: 16 })]),
    row([]),

    // ---- THE DEAL ----
    row([
      cell("THE DEAL", { bold: true, fontSize: 13, bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([]),
    // Row 5
    row([
      cell("You start at 30% of net profit.", { fontSize: 11 }),
    ]),
    row([
      cell("Scale more, earn more. It's that simple.", { fontSize: 11 }),
    ]),
    row([]),

    // ---- YOUR RATE ----
    row([
      cell("YOUR RATE", { bold: true, fontSize: 13, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([]),
    // Row 10
    row([
      cell("Monthly Net Profit", { bold: true, bg: GREEN }),
      cell("Your Rate", { bold: true, bg: GREEN }),
      cell("", { bg: GREEN }),
    ]),
    // Row 11
    row([
      cell("Under $25K"),
      cell(0.25, { percent: true }),
      cell("Below minimum — rate drops until you're back above $25K"),
    ]),
    // Row 12
    row([
      cell("$25K – $75K"),
      cell(0.30, { percent: true }),
      cell("Standard rate"),
    ]),
    // Row 13
    row([
      cell("$75K – $150K"),
      cell(0.33, { percent: true }),
      cell("You're scaling — rate goes up"),
    ]),
    // Row 14
    row([
      cell("$150K – $300K"),
      cell(0.36, { percent: true }),
      cell("Serious volume — serious rate"),
    ]),
    // Row 15
    row([
      cell("$300K+"),
      cell(0.40, { percent: true, bg: GOLD }),
      cell("Top tier — requires 2+ profitable verticals"),
    ]),
    row([]),

    // ---- THE RULES ----
    row([
      cell("THE RULES", { bold: true, fontSize: 13, bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([]),
    // Row 19
    row([
      cell("1.", { bold: true }),
      cell("Your rate is based on your monthly net profit. Higher profit = higher rate."),
    ]),
    row([
      cell("2.", { bold: true }),
      cell("If you drop below $25K net profit for 2 consecutive months, your rate drops to 25% until you're back above $25K."),
    ]),
    row([
      cell("3.", { bold: true }),
      cell("To unlock 40%, you need to be profitable in at least 2 verticals. Single-vertical buyers cap at 36%."),
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
    row([]),

    // ---- CALCULATOR ----
    row([
      cell("WHAT WOULD YOU EARN?", { bold: true, fontSize: 13, bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([]),
    // Row 28
    row([
      cell("Enter your monthly net profit:", { bold: true }),
      cell(100000, { currency: true, bg: INPUT }),
    ]),
    row([]),
    // Row 30
    row([
      cell("Your Rate:", { bold: true, fontSize: 12 }),
      cell("=IF(B28<25000,0.25,IF(B28<75000,0.30,IF(B28<150000,0.33,IF(B28<300000,0.36,0.40))))", { percent: true, bold: true, fontSize: 12 }),
    ]),
    // Row 31
    row([
      cell("You Earn:", { bold: true, fontSize: 14 }),
      cell("=B28*B30", { currency: true, bold: true, fontSize: 14, bg: GREEN }),
    ]),
    row([]),
    row([]),

    // ---- EXAMPLES ----
    row([
      cell("EXAMPLES", { bold: true, fontSize: 13, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([]),
    row([
      cell("You Generate", { bold: true, bg: GREEN }),
      cell("Your Rate", { bold: true, bg: GREEN }),
      cell("You Earn", { bold: true, bg: GREEN }),
    ]),
    row([
      cell(25000, { currency: true }),
      cell(0.30, { percent: true }),
      cell("=A37*B37", { currency: true }),
    ]),
    row([
      cell(50000, { currency: true }),
      cell(0.30, { percent: true }),
      cell("=A38*B38", { currency: true }),
    ]),
    row([
      cell(75000, { currency: true }),
      cell(0.33, { percent: true }),
      cell("=A39*B39", { currency: true }),
    ]),
    row([
      cell(100000, { currency: true }),
      cell(0.33, { percent: true }),
      cell("=A40*B40", { currency: true }),
    ]),
    row([
      cell(150000, { currency: true }),
      cell(0.36, { percent: true }),
      cell("=A41*B41", { currency: true }),
    ]),
    row([
      cell(200000, { currency: true }),
      cell(0.36, { percent: true }),
      cell("=A42*B42", { currency: true }),
    ]),
    row([
      cell(300000, { currency: true }),
      cell(0.40, { percent: true }),
      cell("=A43*B43", { currency: true }),
    ]),
    row([
      cell(500000, { currency: true }),
      cell(0.40, { percent: true }),
      cell("=A44*B44", { currency: true }),
    ]),
  ];
}

async function main() {
  const auth = await getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title: "ADSORA (Simple)" } } }],
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
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 2 },
            properties: { pixelSize: 180 },
            fields: "pixelSize",
          },
        },
      ],
    },
  });

  console.log("Done! 'ADSORA (Simple)' sheet added.");
  console.log(`\nhttps://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`);
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
