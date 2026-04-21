require("dotenv").config();
const { google } = require("googleapis");
const { getAuthClient } = require("./src/google/auth");
const fs = require("fs");

(async () => {
  const auth = getAuthClient();
  const docs = google.docs({ version: "v1", auth });
  const doc = await docs.documents.get({ documentId: "1TnJ-KEjFnHV9GgRH9eP29S1rwyAUVVRc5EOdLHvxOd8" });
  let text = "";
  const walk = (el) => {
    if (el.paragraph) for (const e of el.paragraph.elements || []) if (e.textRun) text += e.textRun.content;
    if (el.table) for (const r of el.table.tableRows || []) for (const c of r.tableCells || []) for (const x of c.content || []) walk(x);
  };
  for (const el of doc.data.body.content || []) walk(el);
  fs.writeFileSync("/tmp/asw-attendees.txt", text);
  console.log("Total length:", text.length);
  console.log("Lines:", text.split("\n").length);
  console.log("---FIRST 2000 CHARS---");
  console.log(text.substring(0, 2000));
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
