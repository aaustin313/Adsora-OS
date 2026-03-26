require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const TOKEN_PATH = path.join(__dirname, "..", "token.json");
const FOLDER_ID = "18hsRi6B33c_5hX4Ho05cA3QRXWpG9nu_";

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
  console.error("No token found. Run the server and authenticate first.");
  process.exit(1);
}

// Cell helper
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
  if (opts.bold) format.textFormat = { bold: true };
  if (opts.bg) format.backgroundColor = opts.bg;
  if (opts.currency) format.numberFormat = { type: "CURRENCY", pattern: "$#,##0" };
  if (opts.percent) format.numberFormat = { type: "PERCENT", pattern: "0.0%" };
  if (opts.fontSize) {
    format.textFormat = { ...(format.textFormat || {}), fontSize: opts.fontSize };
  }
  if (opts.hAlign) format.horizontalAlignment = opts.hAlign;

  if (Object.keys(format).length) c.userEnteredFormat = format;
  return c;
}

function row(cells) {
  return { values: cells };
}

const HEADER_BG = { red: 0.15, green: 0.15, blue: 0.15 };
const TIER_COLORS = [
  { red: 0.85, green: 0.92, blue: 0.85 }, // green - Base
  { red: 0.85, green: 0.88, blue: 0.95 }, // blue - Scale
  { red: 0.95, green: 0.90, blue: 0.80 }, // gold - Elite
];
const INPUT_BG = { red: 1, green: 0.97, blue: 0.88 };

async function main() {
  const auth = await getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const drive = google.drive({ version: "v3", auth });

  // ============================================================
  // SHEET 1: Calculator
  // ============================================================
  const calcRows = [
    // Title
    row([cell("MEDIA BUYER PAYOUT CALCULATOR", { bold: true, fontSize: 14 })]),
    row([cell("Adsora — Tiered Commission Structure", { fontSize: 10 })]),
    row([]),

    // --- INPUTS ---
    row([
      cell("INPUTS", { bold: true, bg: HEADER_BG }),
      cell("", { bg: HEADER_BG }),
      cell("", { bg: HEADER_BG }),
    ]),
    // Row 5 (index 4)
    row([
      cell("Revenue", { bold: true }),
      cell(100000, { currency: true, bg: INPUT_BG }),
      cell("← Enter monthly revenue"),
    ]),
    // Row 6 (index 5)
    row([
      cell("Ad Spend", { bold: true }),
      cell(55000, { currency: true, bg: INPUT_BG }),
      cell("← Enter monthly ad spend"),
    ]),
    // Row 7 (index 6)
    row([
      cell("Overhead Rate", { bold: true }),
      cell(0.18, { percent: true, bg: INPUT_BG }),
      cell("← Adjust overhead % (covers employees, software, risk)"),
    ]),
    // Row 8 (index 7)
    row([
      cell("New Vertical Profit", { bold: true }),
      cell(0, { currency: true, bg: INPUT_BG }),
      cell("← Profit from new verticals (first 90 days, +5% bonus)"),
    ]),
    row([]),

    // --- CALCULATED ---
    row([
      cell("CALCULATIONS", { bold: true, bg: HEADER_BG }),
      cell("", { bg: HEADER_BG }),
      cell("", { bg: HEADER_BG }),
    ]),
    // Row 11 (index 10)
    row([
      cell("Gross Profit"),
      cell("=B5-B6", { currency: true }),
      cell("Revenue - Ad Spend"),
    ]),
    // Row 12 (index 11)
    row([
      cell("Overhead"),
      cell("=B11*B7", { currency: true }),
      cell("Gross Profit × Overhead Rate"),
    ]),
    // Row 13 (index 12)
    row([
      cell("Net Profit", { bold: true }),
      cell("=B11-B12", { currency: true }),
      cell("This is what gets split"),
    ]),
    row([]),

    // --- TIER BREAKDOWN ---
    row([
      cell("TIER BREAKDOWN", { bold: true, bg: HEADER_BG }),
      cell("Range", { bold: true, bg: HEADER_BG }),
      cell("Rate", { bold: true, bg: HEADER_BG }),
      cell("Taxable Amount", { bold: true, bg: HEADER_BG }),
      cell("Buyer Payout", { bold: true, bg: HEADER_BG }),
    ]),
    // Row 16 (index 15) — Base: first $15K
    row([
      cell("Base", { bold: true, bg: TIER_COLORS[0] }),
      cell("$0 – $15K", { bg: TIER_COLORS[0] }),
      cell(0.30, { percent: true, bg: TIER_COLORS[0] }),
      cell("=MIN(B13,15000)", { currency: true, bg: TIER_COLORS[0] }),
      cell("=D16*C16", { currency: true, bg: TIER_COLORS[0] }),
    ]),
    // Row 17 (index 16) — Scale: $15K–$40K
    row([
      cell("Scale", { bold: true, bg: TIER_COLORS[1] }),
      cell("$15K – $40K", { bg: TIER_COLORS[1] }),
      cell(0.35, { percent: true, bg: TIER_COLORS[1] }),
      cell("=MIN(MAX(B13-15000,0),25000)", { currency: true, bg: TIER_COLORS[1] }),
      cell("=D17*C17", { currency: true, bg: TIER_COLORS[1] }),
    ]),
    // Row 18 (index 17) — Elite: $40K+
    row([
      cell("Elite", { bold: true, bg: TIER_COLORS[2] }),
      cell("$40K+", { bg: TIER_COLORS[2] }),
      cell(0.40, { percent: true, bg: TIER_COLORS[2] }),
      cell("=MAX(B13-40000,0)", { currency: true, bg: TIER_COLORS[2] }),
      cell("=D18*C18", { currency: true, bg: TIER_COLORS[2] }),
    ]),
    row([]),
    // Row 20 (index 19) — New vertical bonus
    row([
      cell("New Vertical Bonus", { bold: true }),
      cell(""),
      cell(0.05, { percent: true }),
      cell("=B8", { currency: true }),
      cell("=D20*C20", { currency: true }),
    ]),
    row([]),

    // --- SUMMARY ---
    row([
      cell("SUMMARY", { bold: true, bg: HEADER_BG }),
      cell("", { bg: HEADER_BG }),
      cell("", { bg: HEADER_BG }),
    ]),
    // Row 23 (index 22)
    row([
      cell("Total Buyer Payout", { bold: true }),
      cell("=E16+E17+E18+E20", { currency: true }),
    ]),
    // Row 24 (index 23)
    row([
      cell("Effective Rate", { bold: true }),
      cell('=IF(B13>0,B23/B13,0)', { percent: true }),
    ]),
    // Row 25 (index 24)
    row([
      cell("Owner Keeps (After Payout)", { bold: true }),
      cell("=B13-B23", { currency: true }),
    ]),
    // Row 26 (index 25)
    row([
      cell("Owner Total Take-Home", { bold: true }),
      cell("=B25+B12", { currency: true }),
      cell("Net profit you keep + overhead (which covers your costs)"),
    ]),
  ];

  // ============================================================
  // SHEET 2: Tier Reference
  // ============================================================
  const refRows = [
    row([cell("MEDIA BUYER COMMISSION TIERS", { bold: true, fontSize: 14 })]),
    row([cell("Effective March 2026")]),
    row([]),
    row([
      cell("Tier", { bold: true, bg: HEADER_BG }),
      cell("Net Profit Range", { bold: true, bg: HEADER_BG }),
      cell("Commission Rate", { bold: true, bg: HEADER_BG }),
      cell("How to Qualify", { bold: true, bg: HEADER_BG }),
    ]),
    row([
      cell("Base", { bold: true, bg: TIER_COLORS[0] }),
      cell("$0 – $15,000/mo", { bg: TIER_COLORS[0] }),
      cell("30%", { bg: TIER_COLORS[0] }),
      cell("Default — all buyers start here", { bg: TIER_COLORS[0] }),
    ]),
    row([
      cell("Scale", { bold: true, bg: TIER_COLORS[1] }),
      cell("$15,001 – $40,000/mo", { bg: TIER_COLORS[1] }),
      cell("35%", { bg: TIER_COLORS[1] }),
      cell("Progressive — applies to profit in this range", { bg: TIER_COLORS[1] }),
    ]),
    row([
      cell("Elite", { bold: true, bg: TIER_COLORS[2] }),
      cell("$40,001+/mo", { bg: TIER_COLORS[2] }),
      cell("40%", { bg: TIER_COLORS[2] }),
      cell("Progressive — applies to profit above $40K", { bg: TIER_COLORS[2] }),
    ]),
    row([]),
    row([cell("BONUSES", { bold: true, fontSize: 12 })]),
    row([
      cell("New Vertical", { bold: true }),
      cell("+5% on that vertical's profit"),
      cell("First 90 days"),
      cell("Buyer launches a profitable new vertical (outside home services)"),
    ]),
    row([]),
    row([cell("KEY TERMS", { bold: true, fontSize: 12 })]),
    row([
      cell("Net Profit"),
      cell("= Revenue − Ad Spend − 18% Overhead"),
    ]),
    row([
      cell("Overhead"),
      cell("Covers: employees, software, tracking, legal, risk"),
    ]),
    row([
      cell("Progressive"),
      cell("Like tax brackets — higher rate only applies to dollars IN that bracket"),
    ]),
    row([]),
    row([cell("COMPLIANCE & CLAWBACKS", { bold: true, fontSize: 12 })]),
    row([
      cell("Non-Payment"),
      cell("If a lead buyer doesn't pay within 60 days, profit reverses and deducts from future payouts"),
    ]),
    row([
      cell("Compliance"),
      cell("Any ad policy violation or legal issue = drop to 30% for 90 days"),
    ]),
    row([
      cell("Settlement"),
      cell("Monthly payout based on 30-day rolling net profit"),
    ]),
  ];

  // ============================================================
  // SHEET 3: Multi-Buyer Comparison
  // ============================================================
  const compRows = [
    row([cell("MULTI-BUYER COMPARISON", { bold: true, fontSize: 14 })]),
    row([cell("Enter each buyer's numbers to compare payouts side by side")]),
    row([]),
    row([
      cell("", { bg: HEADER_BG }),
      cell("Buyer 1", { bold: true, bg: HEADER_BG }),
      cell("Buyer 2", { bold: true, bg: HEADER_BG }),
      cell("Buyer 3", { bold: true, bg: HEADER_BG }),
      cell("Buyer 4", { bold: true, bg: HEADER_BG }),
      cell("Buyer 5", { bold: true, bg: HEADER_BG }),
      cell("TOTAL", { bold: true, bg: HEADER_BG }),
    ]),
    // Row 5
    row([
      cell("Revenue", { bold: true }),
      cell(50000, { currency: true, bg: INPUT_BG }),
      cell(80000, { currency: true, bg: INPUT_BG }),
      cell(200000, { currency: true, bg: INPUT_BG }),
      cell(0, { currency: true, bg: INPUT_BG }),
      cell(0, { currency: true, bg: INPUT_BG }),
      cell("=SUM(B5:F5)", { currency: true }),
    ]),
    // Row 6
    row([
      cell("Ad Spend", { bold: true }),
      cell(30000, { currency: true, bg: INPUT_BG }),
      cell(45000, { currency: true, bg: INPUT_BG }),
      cell(110000, { currency: true, bg: INPUT_BG }),
      cell(0, { currency: true, bg: INPUT_BG }),
      cell(0, { currency: true, bg: INPUT_BG }),
      cell("=SUM(B6:F6)", { currency: true }),
    ]),
    // Row 7
    row([
      cell("Gross Profit", { bold: true }),
      cell("=B5-B6", { currency: true }),
      cell("=C5-C6", { currency: true }),
      cell("=D5-D6", { currency: true }),
      cell("=E5-E6", { currency: true }),
      cell("=F5-F6", { currency: true }),
      cell("=SUM(B7:F7)", { currency: true }),
    ]),
    // Row 8
    row([
      cell("Overhead (18%)", { bold: true }),
      cell("=B7*0.18", { currency: true }),
      cell("=C7*0.18", { currency: true }),
      cell("=D7*0.18", { currency: true }),
      cell("=E7*0.18", { currency: true }),
      cell("=F7*0.18", { currency: true }),
      cell("=SUM(B8:F8)", { currency: true }),
    ]),
    // Row 9
    row([
      cell("Net Profit", { bold: true }),
      cell("=B7-B8", { currency: true }),
      cell("=C7-C8", { currency: true }),
      cell("=D7-D8", { currency: true }),
      cell("=E7-E8", { currency: true }),
      cell("=F7-F8", { currency: true }),
      cell("=SUM(B9:F9)", { currency: true }),
    ]),
    row([]),
    // Row 11 — Payout calc per buyer using the tiered formula inline
    row([
      cell("Buyer Payout", { bold: true }),
      cell("=MIN(B9,15000)*0.3+MIN(MAX(B9-15000,0),25000)*0.35+MAX(B9-40000,0)*0.4", { currency: true }),
      cell("=MIN(C9,15000)*0.3+MIN(MAX(C9-15000,0),25000)*0.35+MAX(C9-40000,0)*0.4", { currency: true }),
      cell("=MIN(D9,15000)*0.3+MIN(MAX(D9-15000,0),25000)*0.35+MAX(D9-40000,0)*0.4", { currency: true }),
      cell("=MIN(E9,15000)*0.3+MIN(MAX(E9-15000,0),25000)*0.35+MAX(E9-40000,0)*0.4", { currency: true }),
      cell("=MIN(F9,15000)*0.3+MIN(MAX(F9-15000,0),25000)*0.35+MAX(F9-40000,0)*0.4", { currency: true }),
      cell("=SUM(B11:F11)", { currency: true }),
    ]),
    // Row 12
    row([
      cell("Effective Rate", { bold: true }),
      cell("=IF(B9>0,B11/B9,0)", { percent: true }),
      cell("=IF(C9>0,C11/C9,0)", { percent: true }),
      cell("=IF(D9>0,D11/D9,0)", { percent: true }),
      cell("=IF(E9>0,E11/E9,0)", { percent: true }),
      cell("=IF(F9>0,F11/F9,0)", { percent: true }),
      cell("=IF(G9>0,G11/G9,0)", { percent: true }),
    ]),
    // Row 13
    row([
      cell("Owner Keeps", { bold: true }),
      cell("=B9-B11", { currency: true }),
      cell("=C9-C11", { currency: true }),
      cell("=D9-D11", { currency: true }),
      cell("=E9-E11", { currency: true }),
      cell("=F9-F11", { currency: true }),
      cell("=SUM(B13:F13)", { currency: true }),
    ]),
  ];

  // ============================================================
  // CREATE THE SPREADSHEET
  // ============================================================
  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: "Media Buyer Payout Calculator — Adsora" },
      sheets: [
        {
          properties: { title: "Calculator", index: 0 },
          data: [{ startRow: 0, startColumn: 0, rowData: calcRows }],
        },
        {
          properties: { title: "Tier Reference", index: 1 },
          data: [{ startRow: 0, startColumn: 0, rowData: refRows }],
        },
        {
          properties: { title: "Multi-Buyer Comparison", index: 2 },
          data: [{ startRow: 0, startColumn: 0, rowData: compRows }],
        },
      ],
    },
  });

  const spreadsheetId = res.data.spreadsheetId;
  console.log(`Spreadsheet created: ${res.data.spreadsheetUrl}`);

  // Move to the target folder
  await drive.files.update({
    fileId: spreadsheetId,
    addParents: FOLDER_ID,
    removeParents: "root",
  });
  console.log(`Moved to folder: ${FOLDER_ID}`);

  // Auto-resize columns
  const sheetIds = res.data.sheets.map(s => s.properties.sheetId);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: sheetIds.map(sheetId => ({
        autoResizeDimensions: {
          dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 7 },
        },
      })),
    },
  });

  console.log("Done! Columns auto-resized.");
  console.log(`\nLink: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
