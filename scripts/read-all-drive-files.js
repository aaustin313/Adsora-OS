/**
 * Read ALL files from the 3 swipe file Google Drive folders.
 * Lists folder contents, reads Google Docs/Sheets as text/csv,
 * and recursively enters subfolders one level deep.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const TOKEN_PATH = path.join(__dirname, "..", "token.json");
const OUTPUT_DIR = path.join(__dirname, "..", "output", "drive-dump");

const client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/auth/callback"
);
const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
client.setCredentials(tokens);

const drive = google.drive({ version: "v3", auth: client });

const SWIPE_FOLDER_IDS = [
  "1EVIbiz2cj4eEHk3UbvU2wqYVIujFMl6Y",
  "1Hm2oREx1hhRI0q0lR6TQ3xJMreeGTi7r",
  "1J10VgPzqNm65J_G0bFuaTKZgtEmez03J",
];

async function listFolder(folderId) {
  const allFiles = [];
  let pageToken = null;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      pageSize: 100,
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size)",
      orderBy: "name",
      pageToken,
    });
    allFiles.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return allFiles;
}

async function readFile(file) {
  const mime = file.mimeType;
  if (mime.includes("document")) {
    const res = await drive.files.export({ fileId: file.id, mimeType: "text/plain" }, { responseType: "text" });
    return { content: typeof res.data === "string" ? res.data : JSON.stringify(res.data), ext: ".txt" };
  }
  if (mime.includes("spreadsheet")) {
    const res = await drive.files.export({ fileId: file.id, mimeType: "text/csv" }, { responseType: "text" });
    return { content: typeof res.data === "string" ? res.data : JSON.stringify(res.data), ext: ".csv" };
  }
  if (mime.includes("presentation")) {
    const res = await drive.files.export({ fileId: file.id, mimeType: "text/plain" }, { responseType: "text" });
    return { content: typeof res.data === "string" ? res.data : JSON.stringify(res.data), ext: ".txt" };
  }
  if (mime === "text/plain" || mime === "application/json") {
    const res = await drive.files.get({ fileId: file.id, alt: "media" }, { responseType: "text" });
    return { content: typeof res.data === "string" ? res.data : JSON.stringify(res.data), ext: ".txt" };
  }
  // For images, PDFs, videos — just log metadata, don't download binary
  return null;
}

function sanitizeFilename(name) {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 100);
}

async function processFolder(folderId, folderLabel, parentPath) {
  const outputPath = path.join(parentPath, folderLabel);
  fs.mkdirSync(outputPath, { recursive: true });

  console.log(`\n========================================`);
  console.log(`FOLDER: ${folderLabel} (${folderId})`);
  console.log(`========================================`);

  const files = await listFolder(folderId);
  console.log(`Found ${files.length} items\n`);

  const manifest = [];

  for (const file of files) {
    const entry = {
      name: file.name,
      id: file.id,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime,
      size: file.size || "N/A",
    };

    console.log(`  ${file.mimeType.includes("folder") ? "📂" : "📄"} ${file.name} (${file.mimeType})`);

    if (file.mimeType.includes("folder")) {
      // Recurse one level into subfolders
      entry.type = "folder";
      entry.children = [];
      try {
        const subFiles = await listFolder(file.id);
        const subPath = path.join(outputPath, sanitizeFilename(file.name));
        fs.mkdirSync(subPath, { recursive: true });
        console.log(`    └─ ${subFiles.length} items inside`);

        for (const sub of subFiles) {
          const subEntry = {
            name: sub.name,
            id: sub.id,
            mimeType: sub.mimeType,
          };
          console.log(`       ${sub.mimeType.includes("folder") ? "📂" : "📄"} ${sub.name}`);

          try {
            const result = await readFile(sub);
            if (result) {
              const fname = sanitizeFilename(sub.name) + result.ext;
              fs.writeFileSync(path.join(subPath, fname), result.content, "utf-8");
              subEntry.savedAs = fname;
              subEntry.chars = result.content.length;
            } else {
              subEntry.skipped = "binary/unsupported format";
            }
          } catch (err) {
            subEntry.error = err.message?.slice(0, 100);
            console.log(`         ⚠️ ${err.message?.slice(0, 80)}`);
          }
          entry.children.push(subEntry);
        }
      } catch (err) {
        entry.error = err.message?.slice(0, 100);
        console.log(`    ⚠️ ${err.message?.slice(0, 80)}`);
      }
    } else {
      entry.type = "file";
      try {
        const result = await readFile(file);
        if (result) {
          const fname = sanitizeFilename(file.name) + result.ext;
          fs.writeFileSync(path.join(outputPath, fname), result.content, "utf-8");
          entry.savedAs = fname;
          entry.chars = result.content.length;
          console.log(`    ✅ Saved (${result.content.length} chars)`);
        } else {
          entry.skipped = "binary/unsupported format";
          console.log(`    ⏭️ Skipped (${file.mimeType})`);
        }
      } catch (err) {
        entry.error = err.message?.slice(0, 100);
        console.log(`    ⚠️ ${err.message?.slice(0, 80)}`);
      }
    }

    manifest.push(entry);
  }

  // Save manifest
  fs.writeFileSync(
    path.join(outputPath, "_manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8"
  );

  return manifest;
}

async function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("=== Reading ALL files from 3 Google Drive swipe folders ===\n");

  const allManifests = {};

  for (let i = 0; i < SWIPE_FOLDER_IDS.length; i++) {
    const folderId = SWIPE_FOLDER_IDS[i];
    try {
      // First get folder name
      let folderName;
      try {
        const meta = await drive.files.get({ fileId: folderId, fields: "name" });
        folderName = meta.data.name;
      } catch {
        folderName = `folder-${i + 1}`;
      }
      const label = sanitizeFilename(folderName);
      allManifests[folderId] = await processFolder(folderId, label, OUTPUT_DIR);
    } catch (err) {
      console.error(`\nFAILED folder ${folderId}: ${err.message}`);
      allManifests[folderId] = { error: err.message };
    }
  }

  // Save combined manifest
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "_all-manifests.json"),
    JSON.stringify(allManifests, null, 2),
    "utf-8"
  );

  console.log(`\n\n=== DONE === Output saved to: ${OUTPUT_DIR}`);
}

run().catch((e) => {
  console.error("FATAL:", e.message);
  console.error(e.stack);
  process.exit(1);
});
