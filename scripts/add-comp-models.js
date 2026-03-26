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
  if (opts.bold) format.textFormat = { bold: true, ...(opts.fontSize ? { fontSize: opts.fontSize } : {}) };
  else if (opts.fontSize) format.textFormat = { fontSize: opts.fontSize };
  if (opts.bg) format.backgroundColor = opts.bg;
  if (opts.currency) format.numberFormat = { type: "CURRENCY", pattern: "$#,##0" };
  if (opts.percent) format.numberFormat = { type: "PERCENT", pattern: "0.0%" };
  if (opts.hAlign) format.horizontalAlignment = opts.hAlign;
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

// ============================================================
// SHEET 1: Accelerator / Decelerator
// ============================================================
function buildAcceleratorSheet() {
  return [
    row([cell("ACCELERATOR / DECELERATOR MODEL", { bold: true, fontSize: 14 })]),
    row([cell("Used by 80% of SaaS companies. Rewards overperformance, punishes underperformance.", { fontSize: 10 })]),
    row([]),

    // --- STRUCTURE ---
    row([
      cell("STRUCTURE", { bold: true, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    // Row 5
    row([
      cell("Performance Level", { bold: true, bg: GREEN }),
      cell("% of Target", { bold: true, bg: GREEN }),
      cell("Commission Rate", { bold: true, bg: GREEN }),
      cell("Description", { bold: true, bg: GREEN }),
    ]),
    // Row 6 - Decelerator
    row([
      cell("Decelerator", { bg: RED }),
      cell("Below 50%", { bg: RED }),
      cell(0.20, { percent: true, bg: RED }),
      cell("Underperforming — reduced rate as consequence", { bg: RED }),
    ]),
    // Row 7 - Below target
    row([
      cell("Below Target", { bg: RED }),
      cell("50% – 75%", { bg: RED }),
      cell(0.25, { percent: true, bg: RED }),
      cell("Not meeting minimum expectations", { bg: RED }),
    ]),
    // Row 8 - Base
    row([
      cell("Base", { bg: GREEN }),
      cell("75% – 100%", { bg: GREEN }),
      cell(0.30, { percent: true, bg: GREEN }),
      cell("Meeting target — standard rate", { bg: GREEN }),
    ]),
    // Row 9 - Accelerator 1
    row([
      cell("Accelerator", { bg: BLUE }),
      cell("100% – 150%", { bg: BLUE }),
      cell(0.35, { percent: true, bg: BLUE }),
      cell("Exceeding target — rewarded with higher rate", { bg: BLUE }),
    ]),
    // Row 10 - Super Accelerator
    row([
      cell("Super Accelerator", { bg: GOLD }),
      cell("150%+", { bg: GOLD }),
      cell(0.40, { percent: true, bg: GOLD }),
      cell("Crushing it — top rate, capped here", { bg: GOLD }),
    ]),
    row([]),

    // --- CALCULATOR ---
    row([
      cell("CALCULATOR", { bold: true, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    // Row 13
    row([
      cell("Monthly Net Profit Target", { bold: true }),
      cell(50000, { currency: true, bg: INPUT }),
      cell("← Set the monthly target for this buyer"),
    ]),
    // Row 14
    row([
      cell("Actual Net Profit", { bold: true }),
      cell(75000, { currency: true, bg: INPUT }),
      cell("← Enter actual net profit this month"),
    ]),
    row([]),
    // Row 16
    row([
      cell("% of Target Achieved", { bold: true }),
      cell("=IF(B13>0,B14/B13,0)", { percent: true }),
    ]),
    // Row 17 - Determine rate
    row([
      cell("Commission Rate Applied", { bold: true }),
      cell("=IF(B16<0.5,0.20,IF(B16<0.75,0.25,IF(B16<1,0.30,IF(B16<1.5,0.35,0.40))))", { percent: true }),
    ]),
    // Row 18
    row([
      cell("Buyer Payout", { bold: true }),
      cell("=B14*B17", { currency: true }),
    ]),
    // Row 19
    row([
      cell("Owner Keeps", { bold: true }),
      cell("=B14-B18", { currency: true }),
    ]),
    row([]),

    // --- PROGRESSIVE VERSION ---
    row([
      cell("PROGRESSIVE VERSION (RECOMMENDED)", { bold: true, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([cell("Same tiers but progressive — each bracket only applies to dollars in that range", { fontSize: 10 })]),
    row([]),
    // Row 24 - Using target from B13 and actual from B14
    // Brackets: 0-50% of target at 20%, 50-75% at 25%, 75-100% at 30%, 100-150% at 35%, 150%+ at 40%
    row([
      cell("Bracket", { bold: true, bg: GREEN }),
      cell("Profit Range", { bold: true, bg: GREEN }),
      cell("Rate", { bold: true, bg: GREEN }),
      cell("Taxable", { bold: true, bg: GREEN }),
      cell("Payout", { bold: true, bg: GREEN }),
    ]),
    // Row 25 - 0 to 50% of target
    row([
      cell("Decelerator", { bg: RED }),
      cell("$0 – 50% of target", { bg: RED }),
      cell(0.20, { percent: true, bg: RED }),
      cell("=MIN(B14,B13*0.5)", { currency: true, bg: RED }),
      cell("=D25*C25", { currency: true, bg: RED }),
    ]),
    // Row 26 - 50% to 75%
    row([
      cell("Below Target", { bg: RED }),
      cell("50% – 75% of target", { bg: RED }),
      cell(0.25, { percent: true, bg: RED }),
      cell("=MIN(MAX(B14-B13*0.5,0),B13*0.25)", { currency: true, bg: RED }),
      cell("=D26*C26", { currency: true, bg: RED }),
    ]),
    // Row 27 - 75% to 100%
    row([
      cell("Base", { bg: GREEN }),
      cell("75% – 100% of target", { bg: GREEN }),
      cell(0.30, { percent: true, bg: GREEN }),
      cell("=MIN(MAX(B14-B13*0.75,0),B13*0.25)", { currency: true, bg: GREEN }),
      cell("=D27*C27", { currency: true, bg: GREEN }),
    ]),
    // Row 28 - 100% to 150%
    row([
      cell("Accelerator", { bg: BLUE }),
      cell("100% – 150% of target", { bg: BLUE }),
      cell(0.35, { percent: true, bg: BLUE }),
      cell("=MIN(MAX(B14-B13,0),B13*0.5)", { currency: true, bg: BLUE }),
      cell("=D28*C28", { currency: true, bg: BLUE }),
    ]),
    // Row 29 - 150%+
    row([
      cell("Super Accelerator", { bg: GOLD }),
      cell("150%+ of target", { bg: GOLD }),
      cell(0.40, { percent: true, bg: GOLD }),
      cell("=MAX(B14-B13*1.5,0)", { currency: true, bg: GOLD }),
      cell("=D29*C29", { currency: true, bg: GOLD }),
    ]),
    row([]),
    // Row 31
    row([
      cell("Progressive Buyer Payout", { bold: true }),
      cell("=E25+E26+E27+E28+E29", { currency: true }),
    ]),
    row([
      cell("Effective Rate", { bold: true }),
      cell("=IF(B14>0,B31/B14,0)", { percent: true }),
    ]),
    row([
      cell("Owner Keeps", { bold: true }),
      cell("=B14-B31", { currency: true }),
    ]),
  ];
}

// ============================================================
// SHEET 2: Hormozi Model
// ============================================================
function buildHormoziSheet() {
  return [
    row([cell("HORMOZI MODEL — Base Salary + Performance Bonus", { bold: true, fontSize: 14 })]),
    row([cell("Buyer gets a base salary. Bonus is earned by hitting profit targets. You keep all upside beyond bonus.", { fontSize: 10 })]),
    row([]),

    row([
      cell("STRUCTURE", { bold: true, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    // Row 5
    row([
      cell("Component", { bold: true, bg: PURPLE }),
      cell("Amount", { bold: true, bg: PURPLE }),
      cell("Condition", { bold: true, bg: PURPLE }),
    ]),
    row([
      cell("Base Salary (monthly)"),
      cell("$3,000 – $5,000"),
      cell("Guaranteed — paid regardless of performance"),
    ]),
    row([
      cell("Target Bonus (50% of base)"),
      cell("$1,500 – $2,500"),
      cell("100% of profit target hit"),
    ]),
    row([
      cell("Stretch Bonus (100% of base)"),
      cell("$3,000 – $5,000"),
      cell("150% of profit target hit"),
    ]),
    row([
      cell("Profit Share (on excess)"),
      cell("10% – 15%"),
      cell("Only on profit ABOVE 150% of target"),
    ]),
    row([]),

    row([
      cell("WHY THIS WORKS", { bold: true, fontSize: 12 }),
    ]),
    row([cell("• Buyer has downside (must hit targets to earn full comp)")]),
    row([cell("• You keep the majority of upside — profit share is only 10-15% on excess")]),
    row([cell("• Base salary attracts better talent than pure commission")]),
    row([cell("• Total comp is LOWER than 30% profit share at scale, but feels bigger to buyer")]),
    row([]),

    // --- CALCULATOR ---
    row([
      cell("CALCULATOR", { bold: true, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    // Row 18
    row([
      cell("Base Salary (monthly)", { bold: true }),
      cell(4000, { currency: true, bg: INPUT }),
      cell("← Monthly guaranteed pay"),
    ]),
    // Row 19
    row([
      cell("Profit Target", { bold: true }),
      cell(50000, { currency: true, bg: INPUT }),
      cell("← Monthly net profit target"),
    ]),
    // Row 20
    row([
      cell("Actual Net Profit", { bold: true }),
      cell(80000, { currency: true, bg: INPUT }),
      cell("← Enter actual net profit"),
    ]),
    // Row 21
    row([
      cell("Profit Share Rate (on excess)", { bold: true }),
      cell(0.12, { percent: true, bg: INPUT }),
      cell("← % of profit above 150% target"),
    ]),
    row([]),
    // Row 23
    row([
      cell("% of Target Hit", { bold: true }),
      cell("=IF(B19>0,B20/B19,0)", { percent: true }),
    ]),
    // Row 24 - Target bonus (50% of base if >= 100% target)
    row([
      cell("Target Bonus", { bold: true }),
      cell("=IF(B23>=1,B18*0.5,IF(B23>=0.75,B18*0.25,0))", { currency: true }),
      cell("50% of base at 100% target, 25% at 75%"),
    ]),
    // Row 25 - Stretch bonus (100% of base if >= 150% target)
    row([
      cell("Stretch Bonus", { bold: true }),
      cell("=IF(B23>=1.5,B18,IF(B23>=1.25,B18*0.5,0))", { currency: true }),
      cell("100% of base at 150%, 50% at 125%"),
    ]),
    // Row 26 - Profit share on excess above 150%
    row([
      cell("Profit Share", { bold: true }),
      cell("=IF(B20>B19*1.5,(B20-B19*1.5)*B21,0)", { currency: true }),
      cell("Only kicks in above 150% of target"),
    ]),
    row([]),
    // Row 28
    row([
      cell("TOTAL BUYER COMP", { bold: true, fontSize: 12 }),
      cell("=B18+B24+B25+B26", { currency: true }),
    ]),
    // Row 29
    row([
      cell("Effective % of Net Profit", { bold: true }),
      cell("=IF(B20>0,B28/B20,0)", { percent: true }),
    ]),
    // Row 30
    row([
      cell("Owner Keeps", { bold: true }),
      cell("=B20-B28", { currency: true }),
    ]),
    row([]),

    // --- COMPARISON ---
    row([
      cell("COMPARISON vs 30% FLAT", { bold: true, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([
      cell("30% Flat Payout Would Be"),
      cell("=B20*0.3", { currency: true }),
    ]),
    row([
      cell("Hormozi Model Saves You"),
      cell("=B20*0.3-B28", { currency: true }),
      cell("=IF(B20>0,(B20*0.3-B28)/(B20*0.3),0)", { percent: true }),
    ]),
  ];
}

// ============================================================
// SHEET 3: Salesforce Model
// ============================================================
function buildSalesforceSheet() {
  return [
    row([cell("SALESFORCE MODEL — Quota + Multiplier with Cap", { bold: true, fontSize: 14 })]),
    row([cell("Clear quota. Multipliers on commission rate based on attainment. Hard cap at 3x OTE.", { fontSize: 10 })]),
    row([]),

    row([
      cell("STRUCTURE", { bold: true, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([
      cell("Attainment", { bold: true, bg: BLUE }),
      cell("Multiplier", { bold: true, bg: BLUE }),
      cell("Effective Rate", { bold: true, bg: BLUE }),
      cell("Description", { bold: true, bg: BLUE }),
    ]),
    // Row 6
    row([
      cell("< 50%", { bg: RED }),
      cell("0.5x", { bg: RED }),
      cell("15%", { bg: RED }),
      cell("Half commission — not pulling weight", { bg: RED }),
    ]),
    row([
      cell("50% – 100%", { bg: GREEN }),
      cell("1.0x", { bg: GREEN }),
      cell("30%", { bg: GREEN }),
      cell("Standard commission rate", { bg: GREEN }),
    ]),
    row([
      cell("100% – 150%", { bg: BLUE }),
      cell("1.5x", { bg: BLUE }),
      cell("45%", { bg: BLUE }),
      cell("Exceeding quota — accelerated", { bg: BLUE }),
    ]),
    row([
      cell("150%+", { bg: GOLD }),
      cell("2.0x", { bg: GOLD }),
      cell("60%", { bg: GOLD }),
      cell("Crushing it — but CAPPED at max payout", { bg: GOLD }),
    ]),
    row([]),
    row([cell("KEY FEATURE: Hard cap at 3x of on-target earnings. Prevents runaway payouts.", { bold: true })]),
    row([]),

    // --- CALCULATOR ---
    row([
      cell("CALCULATOR", { bold: true, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    // Row 14
    row([
      cell("Monthly Quota (Net Profit Target)", { bold: true }),
      cell(50000, { currency: true, bg: INPUT }),
      cell("← Set the buyer's monthly quota"),
    ]),
    // Row 15
    row([
      cell("Base Commission Rate", { bold: true }),
      cell(0.30, { percent: true, bg: INPUT }),
      cell("← Standard rate at 100% attainment"),
    ]),
    // Row 16
    row([
      cell("Actual Net Profit", { bold: true }),
      cell(85000, { currency: true, bg: INPUT }),
      cell("← Enter actual net profit"),
    ]),
    row([]),
    // Row 18
    row([
      cell("Attainment %", { bold: true }),
      cell("=IF(B14>0,B16/B14,0)", { percent: true }),
    ]),
    // Row 19 - Multiplier
    row([
      cell("Multiplier", { bold: true }),
      cell("=IF(B18<0.5,0.5,IF(B18<1,1,IF(B18<1.5,1.5,2)))", {}),
    ]),
    // Row 20 - Effective rate
    row([
      cell("Effective Commission Rate", { bold: true }),
      cell("=B15*B19", { percent: true }),
    ]),
    // Row 21 - On-target earnings (what buyer makes at 100%)
    row([
      cell("On-Target Earnings (OTE)", { bold: true }),
      cell("=B14*B15", { currency: true }),
      cell("What buyer earns at exactly 100% quota"),
    ]),
    // Row 22 - Max payout (3x OTE cap)
    row([
      cell("Max Payout Cap (3x OTE)", { bold: true }),
      cell("=B21*3", { currency: true }),
      cell("Buyer can NEVER earn more than this"),
    ]),
    row([]),
    // Row 24 - Progressive calc with multipliers
    row([
      cell("Bracket", { bold: true, bg: BLUE }),
      cell("Profit Range", { bold: true, bg: BLUE }),
      cell("Rate", { bold: true, bg: BLUE }),
      cell("Taxable", { bold: true, bg: BLUE }),
      cell("Payout", { bold: true, bg: BLUE }),
    ]),
    // Row 25 - 0 to 50% quota at 0.5x
    row([
      cell("< 50% quota", { bg: RED }),
      cell("=CONCATENATE(\"$0 – $\",TEXT(B14*0.5,\"#,##0\"))", { bg: RED }),
      cell("=B15*0.5", { percent: true, bg: RED }),
      cell("=MIN(B16,B14*0.5)", { currency: true, bg: RED }),
      cell("=D25*C25", { currency: true, bg: RED }),
    ]),
    // Row 26 - 50% to 100% at 1x
    row([
      cell("50% – 100%", { bg: GREEN }),
      cell("=CONCATENATE(\"$\",TEXT(B14*0.5,\"#,##0\"),\" – $\",TEXT(B14,\"#,##0\"))", { bg: GREEN }),
      cell("=B15", { percent: true, bg: GREEN }),
      cell("=MIN(MAX(B16-B14*0.5,0),B14*0.5)", { currency: true, bg: GREEN }),
      cell("=D26*C26", { currency: true, bg: GREEN }),
    ]),
    // Row 27 - 100% to 150% at 1.5x
    row([
      cell("100% – 150%", { bg: BLUE }),
      cell("=CONCATENATE(\"$\",TEXT(B14,\"#,##0\"),\" – $\",TEXT(B14*1.5,\"#,##0\"))", { bg: BLUE }),
      cell("=B15*1.5", { percent: true, bg: BLUE }),
      cell("=MIN(MAX(B16-B14,0),B14*0.5)", { currency: true, bg: BLUE }),
      cell("=D27*C27", { currency: true, bg: BLUE }),
    ]),
    // Row 28 - 150%+ at 2x
    row([
      cell("150%+", { bg: GOLD }),
      cell("=CONCATENATE(\"$\",TEXT(B14*1.5,\"#,##0\"),\"+\")", { bg: GOLD }),
      cell("=B15*2", { percent: true, bg: GOLD }),
      cell("=MAX(B16-B14*1.5,0)", { currency: true, bg: GOLD }),
      cell("=D28*C28", { currency: true, bg: GOLD }),
    ]),
    row([]),
    // Row 30 - Total before cap
    row([
      cell("Payout Before Cap", { bold: true }),
      cell("=E25+E26+E27+E28", { currency: true }),
    ]),
    // Row 31 - Capped payout
    row([
      cell("FINAL BUYER PAYOUT (Capped)", { bold: true, fontSize: 12 }),
      cell("=MIN(B30,B22)", { currency: true }),
      cell("=IF(B30>B22,\"⚠️ CAP HIT — payout reduced\",\"Under cap\")", {}),
    ]),
    // Row 32
    row([
      cell("Effective Rate", { bold: true }),
      cell("=IF(B16>0,B31/B16,0)", { percent: true }),
    ]),
    // Row 33
    row([
      cell("Owner Keeps", { bold: true }),
      cell("=B16-B31", { currency: true }),
    ]),
    row([]),
    row([
      cell("COMPARISON vs 30% FLAT", { bold: true, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([
      cell("30% Flat Payout Would Be"),
      cell("=B16*0.3", { currency: true }),
    ]),
    row([
      cell("Salesforce Model Saves You"),
      cell("=B16*0.3-B31", { currency: true }),
      cell("=IF(B16>0,(B16*0.3-B31)/(B16*0.3),0)", { percent: true }),
    ]),
  ];
}

// ============================================================
// SHEET 4: HubSpot Model
// ============================================================
function buildHubspotSheet() {
  return [
    row([cell("HUBSPOT MODEL — Ramp Period + Graduated Tiers", { bold: true, fontSize: 14 })]),
    row([cell("New buyers earn their way in. Lower rate during ramp, full tiers after proving themselves.", { fontSize: 10 })]),
    row([]),

    row([
      cell("RAMP STRUCTURE (Month 1–6)", { bold: true, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([
      cell("Period", { bold: true, bg: PURPLE }),
      cell("Commission Rate", { bold: true, bg: PURPLE }),
      cell("Min Quota", { bold: true, bg: PURPLE }),
      cell("Description", { bold: true, bg: PURPLE }),
    ]),
    // Row 6
    row([
      cell("Month 1–3 (Probation)"),
      cell(0.20, { percent: true }),
      cell("None"),
      cell("Learning period — reduced rate, no minimum. Prove you can generate profit."),
    ]),
    // Row 7
    row([
      cell("Month 4–6 (Ramp)"),
      cell(0.25, { percent: true }),
      cell("75% of full quota"),
      cell("Must hit 75% of target or stay at probation rate."),
    ]),
    // Row 8
    row([
      cell("Month 7+ (Full)"),
      cell("Full tiers →"),
      cell("100% of quota"),
      cell("Unlocks full tier structure below."),
    ]),
    row([]),

    row([
      cell("FULL TIER STRUCTURE (Month 7+)", { bold: true, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([
      cell("Tier", { bold: true, bg: GREEN }),
      cell("Net Profit Range", { bold: true, bg: GREEN }),
      cell("Rate", { bold: true, bg: GREEN }),
      cell("Requirement", { bold: true, bg: GREEN }),
    ]),
    // Row 12
    row([
      cell("Base", { bg: GREEN }),
      cell("$0 – $25K"),
      cell(0.28, { percent: true }),
      cell("Default after ramp"),
    ]),
    row([
      cell("Growth", { bg: GREEN }),
      cell("$25K – $75K"),
      cell(0.32, { percent: true }),
      cell("Progressive on dollars in range"),
    ]),
    row([
      cell("Scale", { bg: BLUE }),
      cell("$75K – $150K"),
      cell(0.36, { percent: true }),
      cell("Progressive on dollars in range"),
    ]),
    row([
      cell("Elite", { bg: GOLD }),
      cell("$150K+"),
      cell(0.40, { percent: true }),
      cell("Must be profitable in 2+ verticals to unlock"),
    ]),
    row([]),

    // --- CALCULATOR ---
    row([
      cell("CALCULATOR", { bold: true, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    // Row 19
    row([
      cell("Buyer's Current Month #", { bold: true }),
      cell(8, { bg: INPUT }),
      cell("← How many months has this buyer been active?"),
    ]),
    // Row 20
    row([
      cell("Actual Net Profit", { bold: true }),
      cell(100000, { currency: true, bg: INPUT }),
      cell("← Enter actual net profit"),
    ]),
    // Row 21
    row([
      cell("Profitable in 2+ Verticals?", { bold: true }),
      cell("YES", { bg: INPUT }),
      cell("← YES or NO (required for Elite tier)"),
    ]),
    row([]),

    // Row 23 - Phase determination
    row([
      cell("Current Phase", { bold: true }),
      cell("=IF(B19<=3,\"Probation (20%)\",IF(B19<=6,\"Ramp (25%)\",\"Full Tiers\"))", {}),
    ]),
    row([]),

    // Row 25 - Ramp calc (months 1-6)
    row([
      cell("IF IN RAMP PERIOD:", { bold: true, bg: PURPLE }),
      cell("", { bg: PURPLE }),
    ]),
    row([
      cell("Ramp Payout"),
      cell("=IF(B19<=3,B20*0.20,IF(B19<=6,B20*0.25,0))", { currency: true }),
    ]),
    row([]),

    // Row 28 - Full tier calc (month 7+)
    row([
      cell("IF IN FULL TIERS (Month 7+):", { bold: true, bg: GREEN }),
      cell("", { bg: GREEN }),
      cell("", { bg: GREEN }),
      cell("", { bg: GREEN }),
      cell("", { bg: GREEN }),
    ]),
    row([
      cell("Tier", { bold: true }),
      cell("Range", { bold: true }),
      cell("Rate", { bold: true }),
      cell("Taxable", { bold: true }),
      cell("Payout", { bold: true }),
    ]),
    // Row 30 - Base
    row([
      cell("Base"),
      cell("$0 – $25K"),
      cell(0.28, { percent: true }),
      cell("=MIN(B20,25000)", { currency: true }),
      cell("=D30*C30", { currency: true }),
    ]),
    // Row 31 - Growth
    row([
      cell("Growth"),
      cell("$25K – $75K"),
      cell(0.32, { percent: true }),
      cell("=MIN(MAX(B20-25000,0),50000)", { currency: true }),
      cell("=D31*C31", { currency: true }),
    ]),
    // Row 32 - Scale
    row([
      cell("Scale"),
      cell("$75K – $150K"),
      cell(0.36, { percent: true }),
      cell("=MIN(MAX(B20-75000,0),75000)", { currency: true }),
      cell("=D32*C32", { currency: true }),
    ]),
    // Row 33 - Elite (only if 2+ verticals)
    row([
      cell("Elite"),
      cell("$150K+"),
      cell("=IF(B21=\"YES\",0.40,0.36)", { percent: true }),
      cell("=MAX(B20-150000,0)", { currency: true }),
      cell("=D33*C33", { currency: true }),
      cell("=IF(B21=\"YES\",\"\",\"⚠️ Locked — needs 2+ verticals, stays at 36%\")", {}),
    ]),
    row([]),

    // Row 35 - Final payout
    row([
      cell("FINAL BUYER PAYOUT", { bold: true, fontSize: 12 }),
      cell("=IF(B19<=6,B26,E30+E31+E32+E33)", { currency: true }),
    ]),
    row([
      cell("Effective Rate", { bold: true }),
      cell("=IF(B20>0,B35/B20,0)", { percent: true }),
    ]),
    row([
      cell("Owner Keeps", { bold: true }),
      cell("=B20-B35", { currency: true }),
    ]),
    row([]),
    row([
      cell("COMPARISON vs 30% FLAT", { bold: true, bg: HDR }),
      cell("", { bg: HDR }),
      cell("", { bg: HDR }),
    ]),
    row([
      cell("30% Flat Payout Would Be"),
      cell("=B20*0.3", { currency: true }),
    ]),
    row([
      cell("HubSpot Model Saves You"),
      cell("=B20*0.3-B35", { currency: true }),
      cell("=IF(B20>0,(B20*0.3-B35)/(B20*0.3),0)", { percent: true }),
    ]),
  ];
}

async function main() {
  const auth = await getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  // Add all 4 sheets
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        { addSheet: { properties: { title: "Accelerator-Decelerator" } } },
        { addSheet: { properties: { title: "Hormozi Model" } } },
        { addSheet: { properties: { title: "Salesforce Model" } } },
        { addSheet: { properties: { title: "HubSpot Model" } } },
      ],
    },
  });

  const sheetIds = addRes.data.replies.map(r => r.addSheet.properties.sheetId);
  const sheetData = [
    { id: sheetIds[0], rows: buildAcceleratorSheet() },
    { id: sheetIds[1], rows: buildHormoziSheet() },
    { id: sheetIds[2], rows: buildSalesforceSheet() },
    { id: sheetIds[3], rows: buildHubspotSheet() },
  ];

  // Write data + auto-resize for each sheet
  const requests = [];
  for (const { id, rows } of sheetData) {
    requests.push({
      updateCells: {
        rows,
        fields: "userEnteredValue,userEnteredFormat",
        start: { sheetId: id, rowIndex: 0, columnIndex: 0 },
      },
    });
    requests.push({
      autoResizeDimensions: {
        dimensions: { sheetId: id, dimension: "COLUMNS", startIndex: 0, endIndex: 7 },
      },
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });

  console.log("Done! 4 new sheets added:");
  console.log("  1. Accelerator-Decelerator");
  console.log("  2. Hormozi Model");
  console.log("  3. Salesforce Model");
  console.log("  4. HubSpot Model");
  console.log(`\nhttps://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`);
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
