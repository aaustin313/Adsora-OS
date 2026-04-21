require("dotenv").config();
const { google } = require("googleapis");
const { getAuthClient } = require("./src/google/auth");

(async () => {
  const auth = getAuthClient();
  if (!auth) { console.error("No auth"); process.exit(1); }
  const sheets = google.sheets({ version: "v4", auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: "1F75Wvh86_zWgGCzmqSeLcSqEIhWNvNtgy_VUh2-c_sY" });
  console.log("TITLE:", meta.data.properties.title);
  for (const s of meta.data.sheets) {
    console.log("SHEET:", s.properties.title, "id:", s.properties.sheetId);
  }
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: "1F75Wvh86_zWgGCzmqSeLcSqEIhWNvNtgy_VUh2-c_sY",
    range: "A1:Z100",
  });
  console.log("---CONTENT---");
  console.log(JSON.stringify(existing.data.values, null, 2));
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
