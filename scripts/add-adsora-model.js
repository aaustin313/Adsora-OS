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
  console.error("No token found. Run the server and authenticate first.");
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
  if (opts.percent) format.numberFormat = { type: "PERCENT", pattern: "0.0%" };
  if (opts.wrap) format.wrapStrategy = "WRAP";
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
const PURPLE = { red: 0.90, green: 0.85, blue: 0.95 };
const DARK_GREEN = { red: 0.70, green: 0.85, blue: 0.70 };

function buildAdsoraModel() {
  return [
    row([cell("ADSORA — MEDIA BUYER COMPENSATION PLAN", { bold: true, fontSize: 16 })]),
    row([cell("Your path to earning more. The harder you scale, the higher your rate.", { fontSize: 11 })]),
    row([cell("Effective March 2026")]),
    row([]),

    // =============================================
    // SECTION 1: RAMP PERIOD
    // =============================================
    row([
      cell("HOW YOU GET STARTED (First 6 Months)", { bold: true, fontSize: 13, bg: PURPLE }),
      cell("", { bg: PURPLE }),
      cell("", { bg: PURPLE }),
      cell("", { bg: PURPLE }),
    ]),
    row([
      cell("Period", { bold: true, bg: PURPLE }),
      cell("Your Commission Rate", { bold: true, bg: PURPLE }),
      cell("What You Need to Hit", { bold: true, bg: PURPLE }),
      cell("Details", { bold: true, bg: PURPLE }),
    ]),
    // Row 7
    row([
      cell("Month 1–3"),
      cell(0.20, { percent: true }),
      cell("No minimum"),
      cell("Get your feet wet. Learn the accounts, build campaigns, start generating profit. No pressure."),
    ]),
    // Row 8
    row([
      cell("Month 4–6"),
      cell(0.25, { percent: true }),
      cell("$15K net profit/mo"),
      cell("You should be profitable by now. Hit $15K/mo to stay on track for the full tier unlock."),
    ]),
    // Row 9
    row([
      cell("Month 7+"),
      cell("Up to 40% →"),
      cell("$25K net profit/mo"),
      cell("You've proven yourself. Full accelerator tiers unlock — your rate goes up as you scale."),
    ]),
    row([]),

    // =============================================
    // SECTION 2: FULL TIER STRUCTURE
    // =============================================
    row([
      cell("HOW YOU EARN MORE (Month 7+)", { bold: true, fontSize: 13, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([cell("This works like tax brackets — the higher rate only applies to the dollars IN that bracket. You never lose money by earning more.", { fontSize: 10 })]),
    row([]),
    // Row 14
    row([
      cell("Tier", { bold: true, bg: GREEN }),
      cell("Monthly Net Profit You Generate", { bold: true, bg: GREEN }),
      cell("Your Rate", { bold: true, bg: GREEN }),
      cell("What This Means", { bold: true, bg: GREEN }),
    ]),
    // Row 15 - Decelerator
    row([
      cell("Below Floor", { bold: true, bg: RED }),
      cell("Under $25K", { bg: RED }),
      cell(0.20, { percent: true, bg: RED }),
      cell("If you're under $25K for the month, the entire month is paid at 20%. This is the minimum to stay active.", { bg: RED }),
    ]),
    // Row 16 - Base
    row([
      cell("Base", { bold: true, bg: GREEN }),
      cell("$0 – $50K", { bg: GREEN }),
      cell(0.30, { percent: true, bg: GREEN }),
      cell("Your first $50K in monthly profit earns 30%. This is the standard rate.", { bg: GREEN }),
    ]),
    // Row 17 - Accelerator 1
    row([
      cell("Accelerator", { bold: true, bg: BLUE }),
      cell("$50K – $100K", { bg: BLUE }),
      cell(0.33, { percent: true, bg: BLUE }),
      cell("Every dollar you generate between $50K–$100K earns you 33%.", { bg: BLUE }),
    ]),
    // Row 18 - Accelerator 2
    row([
      cell("Accelerator+", { bold: true, bg: BLUE }),
      cell("$100K – $200K", { bg: BLUE }),
      cell(0.36, { percent: true, bg: BLUE }),
      cell("Every dollar you generate between $100K–$200K earns you 36%.", { bg: BLUE }),
    ]),
    // Row 19 - Super Accelerator
    row([
      cell("Super Accelerator", { bold: true, bg: GOLD }),
      cell("$200K+", { bg: GOLD }),
      cell(0.40, { percent: true, bg: GOLD }),
      cell("Every dollar above $200K earns you 40%. To unlock this tier, you must be profitable in 2+ verticals.", { bg: GOLD }),
    ]),
    row([]),
    // Row 21 - Cap
    row([
      cell("MONTHLY CAP", { bold: true, bg: RED }),
      cell("Maximum payout per month = 3x your on-target earnings (see calculator below for your specific cap).", { bg: RED }),
      cell("", { bg: RED }),
      cell("This cap ensures the structure stays sustainable for both sides as you scale.", { bg: RED }),
    ]),
    row([]),

    // =============================================
    // SECTION 3: CALCULATOR
    // =============================================
    row([
      cell("CALCULATE YOUR PAYOUT", { bold: true, fontSize: 13, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([cell("Change the yellow cells below to see exactly what you'd earn.", { fontSize: 10 })]),
    // Row 25 - Inputs
    row([
      cell("YOUR INFO", { bold: true, fontSize: 12 }),
    ]),
    // Row 26
    row([
      cell("Your Current Month #", { bold: true }),
      cell(10, { bg: INPUT }),
      cell("← How many months have you been with Adsora? (1-6 = ramp, 7+ = full tiers)"),
    ]),
    // Row 27
    row([
      cell("Net Profit You Generated", { bold: true }),
      cell(120000, { currency: true, bg: INPUT }),
      cell("← Enter your net profit for the month"),
    ]),
    // Row 28
    row([
      cell("Your Monthly Target", { bold: true }),
      cell(50000, { currency: true, bg: INPUT }),
      cell("← Your assigned monthly profit target"),
    ]),
    // Row 29
    row([
      cell("Profitable in 2+ Verticals?", { bold: true }),
      cell("YES", { bg: INPUT }),
      cell("← YES or NO — required to unlock the 40% Super Accelerator tier"),
    ]),
    row([]),

    // Row 31 - Status
    row([
      cell("YOUR STATUS", { bold: true, fontSize: 12 }),
    ]),
    // Row 32
    row([
      cell("Your Current Phase"),
      cell("=IF(B26<=3,\"Ramp — Month 1-3 (20%)\",IF(B26<=6,\"Ramp — Month 4-6 (25%)\",\"Full Tiers Unlocked\"))", { bold: true }),
    ]),
    // Row 33
    row([
      cell("% of Target Hit"),
      cell("=IF(B28>0,B27/B28,0)", { percent: true, bold: true }),
    ]),
    // Row 34
    row([
      cell("Below Floor?"),
      cell("=IF(AND(B26>=7,B27<25000),\"YES — under $25K, month paid at 20%\",\"No — you're above the floor\")", { bold: true }),
    ]),
    // Row 35
    row([
      cell("Your On-Target Earnings"),
      cell("=B28*0.3", { currency: true }),
      cell("What you earn when you hit exactly 100% of target"),
    ]),
    // Row 36
    row([
      cell("Your Monthly Cap (3x OTE)"),
      cell("=B35*3", { currency: true }),
      cell("The maximum you can earn in any single month"),
    ]),
    row([]),

    // =============================================
    // RAMP CALC (months 1-6)
    // =============================================
    // Row 38
    row([
      cell("RAMP PAYOUT (Months 1–6)", { bold: true, fontSize: 12, bg: PURPLE }),
      cell("", { bg: PURPLE }),
    ]),
    // Row 39
    row([
      cell("Ramp Rate"),
      cell("=IF(B26<=3,0.20,0.25)", { percent: true }),
    ]),
    // Row 40
    row([
      cell("Ramp Payout"),
      cell("=B27*B39", { currency: true }),
    ]),
    row([]),

    // =============================================
    // FULL TIER CALC (month 7+)
    // =============================================
    // Row 42
    row([
      cell("FULL TIER PAYOUT (Month 7+)", { bold: true, fontSize: 12, bg: GREEN }),
      cell("", { bg: GREEN }),
      cell("", { bg: GREEN }),
      cell("", { bg: GREEN }),
      cell("", { bg: GREEN }),
    ]),
    row([cell("If decelerator is active (below $25K), entire month is paid at 20% — tiers do not apply.")]),
    row([]),
    // Row 45
    row([
      cell("Tier", { bold: true, bg: GREEN }),
      cell("Range", { bold: true, bg: GREEN }),
      cell("Rate", { bold: true, bg: GREEN }),
      cell("Taxable Amount", { bold: true, bg: GREEN }),
      cell("Payout", { bold: true, bg: GREEN }),
    ]),
    // Row 46 - Base: first $50K at 30%
    row([
      cell("Base", { bg: GREEN }),
      cell("$0 – $50K", { bg: GREEN }),
      cell(0.30, { percent: true, bg: GREEN }),
      cell("=MIN(B27,50000)", { currency: true, bg: GREEN }),
      cell("=D46*C46", { currency: true, bg: GREEN }),
    ]),
    // Row 47 - Accel 1: $50K–$100K at 33%
    row([
      cell("Accelerator 1", { bg: BLUE }),
      cell("$50K – $100K", { bg: BLUE }),
      cell(0.33, { percent: true, bg: BLUE }),
      cell("=MIN(MAX(B27-50000,0),50000)", { currency: true, bg: BLUE }),
      cell("=D47*C47", { currency: true, bg: BLUE }),
    ]),
    // Row 48 - Accel 2: $100K–$200K at 36%
    row([
      cell("Accelerator 2", { bg: BLUE }),
      cell("$100K – $200K", { bg: BLUE }),
      cell(0.36, { percent: true, bg: BLUE }),
      cell("=MIN(MAX(B27-100000,0),100000)", { currency: true, bg: BLUE }),
      cell("=D48*C48", { currency: true, bg: BLUE }),
    ]),
    // Row 49 - Super: $200K+ at 40% (only if 2+ verticals)
    row([
      cell("Super Accelerator", { bg: GOLD }),
      cell("$200K+", { bg: GOLD }),
      cell("=IF(B29=\"YES\",0.40,0.36)", { percent: true, bg: GOLD }),
      cell("=MAX(B27-200000,0)", { currency: true, bg: GOLD }),
      cell("=D49*C49", { currency: true, bg: GOLD }),
      cell("=IF(AND(D49>0,B29<>\"YES\"),\"⚠️ Locked at 36% — needs 2+ verticals\",\"\")", {}),
    ]),
    row([]),
    // Row 51 - Tier total before cap and decelerator check
    row([
      cell("Tier Total (before cap)"),
      cell("=E46+E47+E48+E49", { currency: true }),
    ]),
    // Row 52 - Decelerator override
    row([
      cell("After Decelerator Check"),
      cell("=IF(B27<25000,B27*0.2,B51)", { currency: true }),
      cell("=IF(B27<25000,\"⚠️ Below $25K floor — flat 20% applied\",\"Tiers applied\")", {}),
    ]),
    // Row 53 - After cap
    row([
      cell("After Cap"),
      cell("=MIN(B52,B36)", { currency: true }),
      cell("=IF(B52>B36,\"⚠️ CAP HIT — payout reduced to $\"&TEXT(B36,\"#,##0\"),\"Under cap\")", {}),
    ]),
    row([]),

    // =============================================
    // FINAL SUMMARY
    // =============================================
    // Row 55
    row([
      cell("YOUR PAYOUT", { bold: true, fontSize: 14, bg: DARK_GREEN }),
      cell("", { bg: DARK_GREEN }),
      cell("", { bg: DARK_GREEN }),
    ]),
    // Row 56 - Final payout (ramp or full)
    row([
      cell("You Earn", { bold: true, fontSize: 12 }),
      cell("=IF(B26<=6,B40,B53)", { currency: true, bold: true, fontSize: 12 }),
    ]),
    // Row 57
    row([
      cell("Your Effective Rate", { bold: true }),
      cell("=IF(B27>0,B56/B27,0)", { percent: true }),
    ]),
    // Row 58
    row([
      cell("Adsora Keeps", { bold: true, fontSize: 12 }),
      cell("=B27-B56", { currency: true, bold: true, fontSize: 12 }),
    ]),
    row([]),

    // Row 60 - vs flat 30%
    row([
      cell("HOW THIS COMPARES TO A FLAT 30%", { bold: true, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([
      cell("Flat 30% Would Pay You"),
      cell("=B27*0.3", { currency: true }),
    ]),
    row([
      cell("With This Structure You Earn"),
      cell("=B56-B27*0.3", { currency: true }),
      cell("=IF(B56>B27*0.3,\"MORE than flat 30% — scaling pays off\",IF(B56<B27*0.3,\"Less during ramp — but full tiers pay more at scale\",\"Same as flat 30%\"))", {}),
    ]),
    row([]),

    // =============================================
    // QUICK REFERENCE TABLE
    // =============================================
    row([
      cell("EARNINGS AT EVERY LEVEL — See exactly what you'd make", { bold: true, fontSize: 13, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([]),
    row([
      cell("Profit You Generate", { bold: true, bg: GREEN }),
      cell("You Earn", { bold: true, bg: GREEN }),
      cell("Your Effective Rate", { bold: true, bg: GREEN }),
      cell("Adsora Keeps", { bold: true, bg: GREEN }),
      cell("vs Flat 30%", { bold: true, bg: GREEN }),
    ]),
    // Row 67 - $25K
    row([
      cell(25000, { currency: true }),
      cell("=MIN(25000,50000)*0.3", { currency: true }),
      cell("=B67/A67", { percent: true }),
      cell("=A67-B67", { currency: true }),
      cell("=A67*0.3-B67", { currency: true }),
    ]),
    // Row 68 - $50K
    row([
      cell(50000, { currency: true }),
      cell("=50000*0.3", { currency: true }),
      cell("=B68/A68", { percent: true }),
      cell("=A68-B68", { currency: true }),
      cell("=A68*0.3-B68", { currency: true }),
    ]),
    // Row 69 - $75K
    row([
      cell(75000, { currency: true }),
      cell("=50000*0.3+25000*0.33", { currency: true }),
      cell("=B69/A69", { percent: true }),
      cell("=A69-B69", { currency: true }),
      cell("=A69*0.3-B69", { currency: true }),
    ]),
    // Row 70 - $100K
    row([
      cell(100000, { currency: true }),
      cell("=50000*0.3+50000*0.33", { currency: true }),
      cell("=B70/A70", { percent: true }),
      cell("=A70-B70", { currency: true }),
      cell("=A70*0.3-B70", { currency: true }),
    ]),
    // Row 71 - $150K
    row([
      cell(150000, { currency: true }),
      cell("=50000*0.3+50000*0.33+50000*0.36", { currency: true }),
      cell("=B71/A71", { percent: true }),
      cell("=A71-B71", { currency: true }),
      cell("=A71*0.3-B71", { currency: true }),
    ]),
    // Row 72 - $200K
    row([
      cell(200000, { currency: true }),
      cell("=50000*0.3+50000*0.33+100000*0.36", { currency: true }),
      cell("=B72/A72", { percent: true }),
      cell("=A72-B72", { currency: true }),
      cell("=A72*0.3-B72", { currency: true }),
    ]),
    // Row 73 - $300K (with super accel)
    row([
      cell(300000, { currency: true }),
      cell("=50000*0.3+50000*0.33+100000*0.36+100000*0.4", { currency: true }),
      cell("=B73/A73", { percent: true }),
      cell("=A73-B73", { currency: true }),
      cell("=A73*0.3-B73", { currency: true }),
    ]),
    // Row 74 - $500K
    row([
      cell(500000, { currency: true }),
      cell("=50000*0.3+50000*0.33+100000*0.36+300000*0.4", { currency: true }),
      cell("=B74/A74", { percent: true }),
      cell("=A74-B74", { currency: true }),
      cell("=A74*0.3-B74", { currency: true }),
    ]),
    row([]),

    // =============================================
    // COMPLIANCE & TERMS
    // =============================================
    row([
      cell("TERMS & CONDITIONS", { bold: true, fontSize: 13, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([]),
    row([
      cell("How You Get Paid", { bold: true }),
      cell("Monthly, Net 30 from end of each profit period. 80% released monthly, remaining 20% settled quarterly after final reconciliation."),
    ]),
    row([
      cell("Non-Payment Protection", { bold: true }),
      cell("If a client doesn't pay within 60 days, that profit reverses from both sides. Any overpayment is deducted from your next payout. This protects both of us."),
    ]),
    row([
      cell("Compliance", { bold: true }),
      cell("Ad policy violations or legal issues result in a rate reduction to 20% for 90 days. Repeated violations may result in termination. Run clean — it's better for everyone."),
    ]),
    row([
      cell("Unlocking 40%", { bold: true }),
      cell("The Super Accelerator tier (40%) requires you to be profitable in 2+ verticals. Single-vertical buyers cap at 36%. This rewards diversification."),
    ]),
    row([
      cell("Minimum Performance", { bold: true }),
      cell("After month 6, you need to generate at least $25K/mo net profit to stay at full tier rates. 2 consecutive months below the floor triggers a performance review."),
    ]),
  ];
}

async function main() {
  const auth = await getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  // Add the sheet
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        { addSheet: { properties: { title: "ADSORA MODEL (Final)" } } },
      ],
    },
  });

  const sheetId = addRes.data.replies[0].addSheet.properties.sheetId;
  const rows = buildAdsoraModel();

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          updateCells: {
            rows,
            fields: "userEnteredValue,userEnteredFormat",
            start: { sheetId, rowIndex: 0, columnIndex: 0 },
          },
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 6 },
          },
        },
        // Set column B width wider for the calculator
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 2 },
            properties: { pixelSize: 200 },
            fields: "pixelSize",
          },
        },
        // Set column D wider for descriptions
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: "COLUMNS", startIndex: 3, endIndex: 4 },
            properties: { pixelSize: 400 },
            fields: "pixelSize",
          },
        },
      ],
    },
  });

  console.log("Done! 'ADSORA MODEL (Final)' sheet added.");
  console.log(`\nhttps://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`);
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
