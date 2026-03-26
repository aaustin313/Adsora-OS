const { listFolder, readGoogleDoc } = require("../google/drive");
const { isAuthenticated } = require("../google/auth");

// Austin's swipe file folders in Google Drive
const SWIPE_FOLDER_IDS = [
  "1EVIbiz2cj4eEHk3UbvU2wqYVIujFMl6Y",
  "1Hm2oREx1hhRI0q0lR6TQ3xJMreeGTi7r",
  "1J10VgPzqNm65J_G0bFuaTKZgtEmez03J",
];

// Cache swipe file content (refreshes every 2 hours)
let swipeCache = null;
let swipeCacheTime = 0;
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Load all readable documents from the swipe file folders.
 * Reads Google Docs as plain text, skips images/videos/PDFs.
 */
async function loadSwipeFiles() {
  if (!isAuthenticated()) {
    throw new Error("Google not connected. Visit /auth/google to connect.");
  }

  // Return cache if fresh
  if (swipeCache && Date.now() - swipeCacheTime < CACHE_TTL) {
    console.log(`[COPYWRITER] Using cached swipe files (${swipeCache.length} docs)`);
    return swipeCache;
  }

  console.log("[COPYWRITER] Loading swipe files from Google Drive...");
  const docs = [];

  for (const folderId of SWIPE_FOLDER_IDS) {
    try {
      const files = await listFolder(folderId);
      console.log(`[COPYWRITER] Folder ${folderId.slice(0, 8)}...: ${files.length} files`);

      for (const file of files) {
        // Read Google Docs, Sheets, and text-based files
        const isDoc = file.mimeType.includes("document");
        const isSheet = file.mimeType.includes("spreadsheet");
        const isText = file.mimeType.includes("text/plain");

        if (isDoc || isText) {
          try {
            const content = await readGoogleDoc(file.id);
            const text = typeof content === "string" ? content : String(content);
            if (text.trim().length > 20) {
              docs.push({
                name: file.name,
                folderId,
                content: text.trim(),
              });
            }
          } catch (err) {
            console.log(`[COPYWRITER] Skipped ${file.name}: ${err.message?.slice(0, 60)}`);
          }
        }
        // For folders inside the swipe folders, recurse one level
        if (file.mimeType.includes("folder")) {
          try {
            const subFiles = await listFolder(file.id);
            for (const sub of subFiles) {
              if (sub.mimeType.includes("document") || sub.mimeType.includes("text")) {
                try {
                  const content = await readGoogleDoc(sub.id);
                  const text = typeof content === "string" ? content : String(content);
                  if (text.trim().length > 20) {
                    docs.push({
                      name: `${file.name}/${sub.name}`,
                      folderId,
                      content: text.trim(),
                    });
                  }
                } catch (err) {
                  // skip unreadable files
                }
              }
            }
          } catch (err) {
            // skip inaccessible subfolders
          }
        }
      }
    } catch (err) {
      console.error(`[COPYWRITER] Failed to read folder ${folderId}: ${err.message}`);
    }
  }

  console.log(`[COPYWRITER] Loaded ${docs.length} swipe files total`);
  swipeCache = docs;
  swipeCacheTime = Date.now();
  return docs;
}

/**
 * Build the swipe file context string for injection into Claude's prompt.
 * Truncates individual docs to keep total context manageable.
 */
async function getSwipeContext() {
  const docs = await loadSwipeFiles();
  if (docs.length === 0) {
    return "No swipe files found in the configured Google Drive folders.";
  }

  const MAX_PER_DOC = 3000; // chars per doc
  const MAX_TOTAL = 40000; // total chars

  let context = `--- SWIPE FILE LIBRARY (${docs.length} reference documents) ---\n`;
  context += "These are proven ad copy examples. Study their patterns: hooks, emotional triggers, ";
  context += "structure, CTAs, tone, urgency mechanics, and persuasion frameworks.\n\n";

  let totalLen = context.length;

  for (const doc of docs) {
    const snippet = doc.content.length > MAX_PER_DOC
      ? doc.content.slice(0, MAX_PER_DOC) + "..."
      : doc.content;

    if (totalLen + snippet.length + 100 > MAX_TOTAL) {
      context += `\n[... ${docs.length - docs.indexOf(doc) - 1} more swipe files truncated for context limits ...]\n`;
      break;
    }

    context += `=== ${doc.name} ===\n${snippet}\n\n`;
    totalLen += snippet.length + doc.name.length + 10;
  }

  context += "--- END SWIPE FILES ---\n";
  return context;
}

/**
 * Copywriting system prompt — instructs Claude to write like a direct-response copywriter
 * using the swipe files as style/pattern reference.
 */
const COPYWRITER_SYSTEM_PROMPT = `You are a world-class direct-response copywriter for performance marketing.

YOUR PROCESS:
1. STUDY the swipe files provided — analyze their hooks, emotional triggers, story structure,
   objection handling, urgency mechanics, and CTA patterns.
2. IDENTIFY the proven patterns: fear-based hooks, social proof, authority positioning,
   problem-agitation-solution, future pacing, loss aversion, specificity.
3. WRITE new copy that follows those same patterns but is ORIGINAL — never copy verbatim.
4. MATCH the tone and intensity level of the swipe files.

RULES:
- Lead with the strongest hook. The first line must stop the scroll.
- Use short paragraphs. One idea per paragraph. This is for mobile screens.
- Every line must earn the next line. No filler.
- Use specificity over vagueness ("63% are denied" beats "most are denied").
- Include clear CTA — tell them exactly what to do next.
- Write for Facebook ads unless told otherwise — that means punchy, emotional, scroll-stopping.
- Vary copy lengths: some ads are 2 lines, some are 15. Match what's requested.
- For headlines: max 5 words, punchy, curiosity or fear-driven.
- Compliance: no misleading claims, include disclaimers where legally required.
- Do NOT explain your copywriting choices unless asked. Just deliver the copy.

OUTPUT FORMAT:
- Label each piece clearly (Ad Copy #1, Headline #1, etc.)
- Separate each piece with a blank line
- If a landing page URL is provided, include it in the CTA`;

/**
 * Check if a message is a copywriting request.
 */
function isCopywritingRequest(message) {
  const patterns = [
    /\b(write|draft|create|generate|give me|come up with)\b.*\b(ad copy|copy|ads?|headline|script|email)\b/i,
    /\b(ad copy|copywriting|headlines?|ad creative|ad text|primary text|facebook ad)\b/i,
    /\b(swipe|swipe file|reference copy)\b/i,
    /\/copy\b/i,
  ];
  return patterns.some((p) => p.test(message));
}

/**
 * Force-refresh the swipe file cache.
 */
function clearSwipeCache() {
  swipeCache = null;
  swipeCacheTime = 0;
}

module.exports = {
  loadSwipeFiles,
  getSwipeContext,
  isCopywritingRequest,
  clearSwipeCache,
  COPYWRITER_SYSTEM_PROMPT,
};
