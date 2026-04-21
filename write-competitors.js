require("dotenv").config();
const { google } = require("googleapis");
const { getAuthClient } = require("./src/google/auth");

const SPREADSHEET_ID = "1F75Wvh86_zWgGCzmqSeLcSqEIhWNvNtgy_VUh2-c_sY";
const SHEET_ID = 0;

// [Company, LinkedIn URL (people page), Who / vertical / role]
const rows = [
  // --- SECTION: Tier 1 - Direct lead-gen / performance marketing competitors ---
  ["TIER 1 — DIRECT COMPETITORS (FB affiliate lead gen at scale)", "", ""],
  ["Adsync Media", "https://www.linkedin.com/company/adsync-media/people/", "John Ventura, CEO. $100M+ FB ad spend. Home services, finance, legal, insurance lead gen. Priority #1."],
  ["Digital Media Solutions (DMS)", "https://www.linkedin.com/company/digital-media-solutions-inc/people/", "Public (was NYSE:DMS). Massive FB media buying team. Insurance, home services, consumer finance lead gen. Acquired Underground Elephant (UE.co)."],
  ["Centerfield", "https://www.linkedin.com/company/centerfield/people/", "Owns Business.com, Marketplace. Aggressive FB + paid social lead gen across finance + home services."],
  ["Fluent, Inc.", "https://www.linkedin.com/company/fluent-inc-/people/", "Public (NASDAQ:FLNT). Performance marketing, rewards-based lead gen, finance + insurance."],
  ["QuinStreet", "https://www.linkedin.com/company/quinstreet/people/", "Public (NASDAQ:QNST). Owns LowerMyBills. Insurance + finance lead gen. In-house FB buyers."],
  ["System1", "https://www.linkedin.com/company/system1/people/", "Public (NYSE:SST). Matthew Hrushka Sr. Director Media Buying at ASW. Financial + consumer lead gen."],
  ["MediaAlpha", "https://www.linkedin.com/company/mediaalpha/people/", "Public. Insurance + consumer finance performance marketing."],
  ["EverQuote", "https://www.linkedin.com/company/everquote/people/", "Public (NASDAQ:EVER). Insurance lead gen marketplace, strong paid-social team."],
  ["LendingTree", "https://www.linkedin.com/company/lendingtree/people/", "Public (TREE). Finance/mortgage lead gen. In-house FB + IG media buying team."],
  ["Red Ventures (Bankrate, Lonely Planet, CNET)", "https://www.linkedin.com/company/red-ventures/people/", "$100M+/yr ad spend on Bankrate alone. Finance lead gen powerhouse."],
  ["The Penny Hoarder", "https://www.linkedin.com/company/the-penny-hoarder/people/", "Zach Jacobs, Director Performance Marketing at ASW. Finance / debt content + lead gen."],
  ["Everyday Health", "https://www.linkedin.com/company/everyday-health-inc-/people/", "Trent Brown + Grant Burton run Performance Marketing. Health + consumer finance."],
  ["Lead Economy", "https://www.linkedin.com/company/lead-economy/people/", "Lilia Shamray, VP Performance Marketing. Lead gen shop."],
  ["Advanced Affiliate (Gabe Ansel)", "https://www.linkedin.com/in/gabeansel/", "YouTube: @advancedaffiliate. Austin AA Mastermind. Network of top affiliate lead gen buyers."],

  // --- SECTION: Debt relief ---
  ["TIER 2 — DEBT RELIEF ADVERTISERS (in-house FB media buying + affiliate)", "", ""],
  ["National Debt Relief", "https://www.linkedin.com/company/national-debt-relief/people/", "Scaled FB/IG ads 1000% via Level Agency. Largest debt relief advertiser. Has in-house buyers."],
  ["Freedom Debt Relief / Achieve (FFN)", "https://www.linkedin.com/company/freedom-debt-relief/people/", "Sibila Parpova + Brittany Gratsch on affiliate team at ASW. $20B+ debt resolved since 2002."],
  ["Beyond Finance (Accredited Debt Relief)", "https://www.linkedin.com/company/beyondfinance/people/", "Houston-based fintech, aggressive FB + affiliate. Owns Accredited Debt Relief brand."],
  ["Americor", "https://www.linkedin.com/company/americor-funding-inc/people/", "Irvine, CA. 500K+ customers, $3B+ debt resolved. Heavy FB lead gen."],
  ["ClearOne Advantage", "https://www.linkedin.com/company/clearone-advantage/people/", "3rd largest full-service debt settlement. CPL/CPA affiliate program, Facebook buyer team."],
  ["CuraDebt", "https://www.linkedin.com/company/curadebt/people/", "Since 2001. $55/lead affiliate program. Runs paid social."],
  ["JG Wentworth", "https://www.linkedin.com/company/jg-wentworth/people/", "Structured settlements + debt relief. In-house paid social team."],
  ["Consolidated Credit", "https://www.linkedin.com/company/consolidated-credit-counseling-services-inc-/people/", "Debt management/relief, runs FB lead gen."],
  ["New Era Debt Solutions", "https://www.linkedin.com/company/new-era-debt-solutions/people/", "Debt settlement, FB advertiser."],
  ["Debt.com", "https://www.linkedin.com/company/debt-com/people/", "Nick Downarowicz, VP Marketing at ASW. Lead gen site for debt services."],
  ["Better Debt Solutions", "https://www.linkedin.com/company/better-debt-solutions/people/", "Chase Webb, VP of Business Strategy at ASW."],
  ["Debt Relief Advocates", "https://www.linkedin.com/company/debt-relief-advocates/people/", "Austin Walker, Marketing Executive at ASW."],
  ["Finance Devil (affiliate)", "https://www.linkedin.com/in/kharilewis/", "Khari Lewis, media buyer — debt/finance affiliate offers. At ASW."],
  ["Level Agency", "https://www.linkedin.com/company/level-agency/people/", "Scaled National Debt Relief paid social 1000%. Top performance shop in debt relief."],

  // --- SECTION: Home services / solar / roofing ---
  ["TIER 3 — HOME SERVICES / SOLAR / ROOFING (lead gen advertisers)", "", ""],
  ["Modernize Home Services", "https://www.linkedin.com/company/modernize-home-services/people/", "Austin, TX. Big-ticket home improvement lead gen (roof, solar, windows, HVAC). Heavy FB."],
  ["Angi (NASDAQ:ANGI)", "https://www.linkedin.com/company/angi/people/", "Formerly Angie's/HomeAdvisor. Public since April 2025. Huge in-house media team."],
  ["HomeAdvisor / Angi Leads", "https://www.linkedin.com/company/homeadvisor/people/", "Part of Angi. Pro lead marketplace, massive paid social."],
  ["Networx", "https://www.linkedin.com/company/networx-systems/people/", "Selective contractor lead gen. FB + Google media buyers."],
  ["Thumbtack", "https://www.linkedin.com/company/thumbtack-com/people/", "Home services marketplace. Chris Kwok Sr Client Partner at ASW."],
  ["Porch Group", "https://www.linkedin.com/company/porch/people/", "Home services + insurance pivot. 1100+ service types."],
  ["HomeServe USA", "https://www.linkedin.com/company/homeserve/people/", "Home warranty + services, FB lead gen."],
  ["Solar Direct Marketing LLC", "https://www.linkedin.com/company/solar-direct-marketing/people/", "David Stodolak, President at ASW. Pure solar lead gen."],
  ["Beyond Solar", "https://www.linkedin.com/company/beyond-solar-corp/people/", "Vedika Datta, CFO at ASW."],
  ["Solar Cancellation Resource Center", "https://www.linkedin.com/company/solar-cancellation-resource-center/people/", "Tyler Ibarra, Business Director at ASW."],
  ["RingSolar", "https://www.linkedin.com/company/ringsolar/people/", "Sargun Singh, Director at ASW. Solar lead gen."],
  ["Adsolar", "https://www.linkedin.com/company/adsolar/people/", "Kristupas Mileris, CEO at ASW. Solar affiliate offers."],
  ["Z1 Tech (Home Services vertical)", "https://www.linkedin.com/company/z1tech/people/", "Kes Craig, VP Home Services at ASW."],
  ["Power Home Remodeling", "https://www.linkedin.com/company/power-home-remodeling/people/", "Windows/siding/roofing. In-house paid social team."],
  ["Renewal by Andersen", "https://www.linkedin.com/company/renewal-by-andersen-corp/people/", "Windows, national FB advertiser."],
  ["Leaf Home (Leaf Filter / Leaf Guard)", "https://www.linkedin.com/company/leaf-home/people/", "Huge home services advertiser — gutters, bath, stairlifts, walk-in tubs."],
  ["ADT", "https://www.linkedin.com/company/adt/people/", "Home security, major FB lead gen buyer."],

  // --- SECTION: Mortgage / Refinance ---
  ["TIER 4 — MORTGAGE / REFINANCE / FINTECH", "", ""],
  ["Rocket Companies (Rocket Mortgage)", "https://www.linkedin.com/company/rocketcompanies/people/", "Biggest mortgage lender, huge FB + IG paid media team."],
  ["Better.com", "https://www.linkedin.com/company/better/people/", "Digital mortgage, in-house affiliate program pays up to $200/lead."],
  ["loanDepot", "https://www.linkedin.com/company/loandepot-com/people/", "Top-10 mortgage lender, FB advertiser."],
  ["Guaranteed Rate / Rate Companies", "https://www.linkedin.com/company/rate-companies/people/", "Top mortgage lender, paid social team."],
  ["LowerMyBills (QuinStreet)", "https://www.linkedin.com/company/lowermybills/people/", "Refi lead gen legacy brand."],
  ["Credible (Fox Corp)", "https://www.linkedin.com/company/credibleofficial/people/", "Refi + student loans marketplace."],
  ["NerdWallet", "https://www.linkedin.com/company/nerdwallet/people/", "Finance content + lead gen, strong paid social."],
  ["Credit Karma (Intuit)", "https://www.linkedin.com/company/credit-karma/people/", "Finance, refi, debt. Massive paid media org."],
  ["Mortgage Research Center (Veterans United)", "https://www.linkedin.com/company/mortgage-research-center-llc/people/", "Stephen Vyskocil at ASW. VA loans / refi."],
  ["LBC Mortgage", "https://www.linkedin.com/company/lbc-mortgage/people/", "Kevin Tenin at ASW. Mortgage / refi."],
  ["Pigeonfi Inc", "https://www.linkedin.com/company/pigeonfi/people/", "Robert Mair + Andrew Chung media buyers at ASW. Fintech/loans."],
  ["Achieve (was Freedom Financial Network)", "https://www.linkedin.com/company/achievecom/people/", "Consolidation loans + debt relief. Same parent as Freedom Debt Relief."],

  // --- SECTION: Performance-marketing / media-buying shops ---
  ["TIER 5 — PERFORMANCE / MEDIA-BUYING SHOPS (poach their buyers directly)", "", ""],
  ["UPYIELD / iLOVE (dlulisa holding)", "https://www.linkedin.com/company/upyield/people/", "Thomas Kothuis, Media Buying Director at ASW."],
  ["Fat Cat Media", "https://www.linkedin.com/company/fat-cat-media/people/", "Jay Quiram media buyer at ASW."],
  ["Sanctus LLC Media Buyers", "https://www.linkedin.com/company/sanctus-llc/people/", "Michael Navarini, President at ASW."],
  ["Sapphire Media LLC", "https://www.linkedin.com/company/sapphiremediallc/people/", "Trey Yarbrough Cook media buyer at ASW."],
  ["EBS Media LLC", "https://www.linkedin.com/company/ebs-media-llc/people/", "Sureshkumar + Isha Kalathiya media buyers at ASW."],
  ["EBXMEDIA LLC", "https://www.linkedin.com/company/ebxmedia/people/", "Eden Ben-Aroya media buyer at ASW."],
  ["DataGrande", "https://www.linkedin.com/company/datagrande/people/", "Christy Marie + Carla Reece media buyers at ASW."],
  ["MetaOne Media", "https://www.linkedin.com/company/metaone-media/people/", "Anastasiia Mandryk at ASW."],
  ["Prescott Performance Strategies", "https://www.linkedin.com/company/prescott-performance-strategies/people/", "Tim Antoian media buyer at ASW."],
  ["High Sierra Media", "https://www.linkedin.com/company/high-sierra-media/people/", "Jason Adams media buyer at ASW."],
  ["Adhawk Media LLC", "https://www.linkedin.com/company/adhawk-media/people/", "Ryan Gruenwald media buyer at ASW."],
  ["Advent Media", "https://www.linkedin.com/company/advent-media/people/", "Jason Williams media buyer at ASW."],
  ["4AM Media", "https://www.linkedin.com/company/4am-media/people/", "Vivian Ngovu media buyer at ASW."],
  ["Scaling Heroes", "https://www.linkedin.com/company/scaling-heroes/people/", "Gal Madi media buyer at ASW."],
  ["The Aragon Company", "https://www.linkedin.com/company/thearagoncompany/people/", "Alec Stearn, VP Performance Marketing at ASW."],
  ["White Collar Media", "https://www.linkedin.com/company/white-collar-media/people/", "Caitlin Stageberg, VP Performance Marketing at ASW."],
  ["Avanto Media", "https://www.linkedin.com/company/avanto-media/people/", "Justin Summers, Director of Lead Generation at ASW."],
  ["Switch Media Marketing LLC", "https://www.linkedin.com/company/switch-media-marketing/people/", "Aaron May, Head of Media Buying at ASW."],
  ["Leads Market", "https://www.linkedin.com/company/leadsmarket/people/", "Andrew Neder media buyer at ASW."],
  ["MagnusEdge Marketing FZCO", "https://www.linkedin.com/company/magnusedgemarketing/people/", "Harpreet Singh, Director Media Buying at ASW."],
  ["Rise N Gain Media", "https://www.linkedin.com/company/rise-n-gain-media/people/", "Jayant Chauhan, CEO/Sr Media Buyer at ASW."],
  ["SparkAds Media", "https://www.linkedin.com/company/sparkads-media/people/", "Johnny Pukay media buyer at ASW."],
  ["Max Lead Gen", "https://www.linkedin.com/company/max-lead-gen/people/", "David Lu, CEO at ASW."],
  ["ClickLinker", "https://www.linkedin.com/company/clicklinker/people/", "Anastasiia Sorochynska, Director Lead Generation at ASW."],
  ["Lead Gen Team", "https://www.linkedin.com/company/lead-gen-team/people/", "Noaz Miller + Kyle Kinzle, co-founders at ASW."],
  ["Ifficient, Inc", "https://www.linkedin.com/company/ifficient/people/", "Matt Mockus, President — Lead Gen at ASW."],
  ["Web Service Group", "https://www.linkedin.com/company/web-service-group/people/", "Deric Lyons, Chief Media Buyer at ASW."],
  ["Point2Web", "https://www.linkedin.com/company/point2web/people/", "Arun Kumar Rajendran, Sr Director Media Buying at ASW."],
  ["Bandz Marketing L.L.C.", "https://www.linkedin.com/company/bandz-marketing/people/", "Jacob Oram media buyer at ASW."],
  ["AK LEADS / AKLEADS", "https://www.linkedin.com/company/ak-leads/people/", "Michael Mamikonjan + Ernest Sribnyi media buyers at ASW."],
  ["FS Leads, LLC", "https://www.linkedin.com/company/fs-leads/people/", "Laura Mattioli media buyer at ASW."],
  ["Big Leads Media", "https://www.linkedin.com/company/big-leads-media/people/", "Rolando Rivero media buyer at ASW."],
  ["Bearing Fruit Co. LLC", "https://www.linkedin.com/company/bearing-fruit-co/people/", "Ian Moir media buyer at ASW."],
  ["Jumpclick", "https://www.linkedin.com/company/jumpclick/people/", "Nicholas Navarini media buyer at ASW."],
  ["Monetise Affiliate Network", "https://www.linkedin.com/company/monetise-affiliate-network/people/", "Ricky May (Lead Gen Director), James Anderson (Co-Founder) at ASW."],
  ["MountainTOP Affiliate Network", "https://www.linkedin.com/company/the-mountaintop-affiliate-network/people/", "Dane Vanden Heuvel Sr. Partner Manager at ASW."],
];

async function main() {
  const auth = getAuthClient();
  if (!auth) { console.error("No auth"); process.exit(1); }
  const sheets = google.sheets({ version: "v4", auth });

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "A1:C200",
  });
  const current = existing.data.values || [];
  const startRow = current.length + 2; // leave one blank row

  console.log(`Sheet has ${current.length} rows. Appending starting at row ${startRow}, adding ${rows.length} rows.`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `A${startRow}:C${startRow + rows.length - 1}`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });

  // Format section headers (rows whose first cell starts with "TIER")
  const requests = [];
  rows.forEach((r, idx) => {
    if (typeof r[0] === "string" && r[0].startsWith("TIER")) {
      const rowIndex = startRow - 1 + idx; // zero-indexed
      requests.push({
        repeatCell: {
          range: { sheetId: SHEET_ID, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 3 },
          cell: { userEnteredFormat: {
            backgroundColor: { red: 0.118, green: 0.227, blue: 0.373 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 11 },
          }},
          fields: "userEnteredFormat(backgroundColor,textFormat)",
        },
      });
    }
  });

  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests } });
  }

  console.log(`✅ Added ${rows.length} rows to sheet`);
  console.log(`   https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
}

main().catch(e => { console.error("ERR:", e.message); process.exit(1); });
