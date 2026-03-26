/**
 * Agent 5: Compliance Review
 * Reviews scripts and videos for Facebook ad policy violations.
 * Catches issues BEFORE spending money on launches.
 */

const { addLog } = require("../pipeline/context");
const { saveAgentOutput } = require("../pipeline/store");
const fs = require("fs");
const path = require("path");

// Load compliance rules from project
function loadComplianceRules() {
  const rulesDir = path.join(__dirname, "..", "..", ".claude", "rules");
  let rules = "";

  const files = ["compliance.md", "facebook-ads.md"];
  for (const file of files) {
    const filePath = path.join(rulesDir, file);
    if (fs.existsSync(filePath)) {
      rules += fs.readFileSync(filePath, "utf-8") + "\n\n";
    }
  }
  return rules;
}

/**
 * Run compliance review on all scripts.
 * @param {object} ctx - PipelineContext
 * @returns {Array} Compliance results
 */
async function run(ctx) {
  addLog(ctx, "Compliance Review starting...");
  ctx.currentAgent = "compliance";

  if (!ctx.scripts?.length) {
    addLog(ctx, "No scripts to review — skipping");
    return [];
  }

  const complianceRules = loadComplianceRules();

  // Build all scripts into one review
  let scriptsForReview = "";
  for (const script of ctx.scripts) {
    scriptsForReview += `\n--- SCRIPT ${script.index} (${script.id}): ${script.angle} ---\n`;
    scriptsForReview += `Type: ${script.type}\n`;
    scriptsForReview += `Hook: ${script.hook}\n`;
    scriptsForReview += `Headline: ${script.headline}\n`;
    scriptsForReview += `Primary Text: ${script.primaryText}\n`;
    scriptsForReview += `Full Script: ${script.fullScript}\n`;
  }

  const prompt = `You are a Facebook Ads compliance officer. Review these ${ctx.scripts.length} ad scripts for policy violations BEFORE they go live.

OFFER: ${ctx.offerName || "Not specified"}
VERTICAL: ${ctx.vertical || "Not specified"}

=== COMPLIANCE RULES ===
${complianceRules}

=== ADDITIONAL FACEBOOK ADVERTISING POLICIES ===
- No misleading or false claims
- No "guaranteed" results or income claims
- No before/after images that are misleading
- No targeting discrimination (housing, employment, credit)
- Special Ad Categories required for: housing, credit, employment, social issues, politics
- No "free" claims unless truly free with no hidden costs
- No government benefits claims ("Get your check", "Government is paying")
- No health/medical claims without proper substantiation
- No excessive capitalization or sensationalism
- No clickbait headlines that misrepresent the content
- No personal attributes targeting ("Are you overweight?", "As a diabetic...")
- No weapons, drugs, adult content, or hate speech
- Legal/mass tort ads may require specific disclaimers
- No fake news or misinformation
- CTA must match landing page content

=== SCRIPTS TO REVIEW ===
${scriptsForReview}

For EACH script, provide a compliance review. Respond in this exact JSON format:

[
  {
    "scriptId": "<script id>",
    "scriptIndex": <number>,
    "passed": <true/false>,
    "severity": "clean|minor|major|critical",
    "violations": [
      {
        "issue": "<description of the violation>",
        "location": "<which part of the script: hook/headline/primaryText/fullScript>",
        "policy": "<which policy it violates>",
        "severity": "minor|major|critical"
      }
    ],
    "suggestions": ["<how to fix each issue>"],
    "revisedHook": "<revised hook if needed, null if clean>",
    "revisedHeadline": "<revised headline if needed, null if clean>",
    "specialAdCategory": "<HOUSING|CREDIT|EMPLOYMENT|SOCIAL_ISSUES or null>",
    "disclaimerNeeded": "<disclaimer text to add, or null>"
  }
]

Be STRICT but practical. Flag real violations, not theoretical edge cases. If a script is fine, mark it as passed.
Respond ONLY with the JSON array.`;

  const systemPrompt = `You are a Facebook Ads policy compliance reviewer. Review ad scripts for violations of Facebook's advertising policies. Be thorough but practical — flag real issues, not theoretical ones. Respond only with valid JSON.`;

  try {
    const { callClaudeCLI } = require("../ai/claude");
    const response = await callClaudeCLI(prompt, systemPrompt, { timeoutMs: 300000 });

    // Parse JSON
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON found in compliance response");

    const reviews = JSON.parse(jsonMatch[0]);

    ctx.compliance = reviews.map(r => ({
      scriptId: r.scriptId,
      scriptIndex: r.scriptIndex,
      passed: r.passed,
      severity: r.severity || "clean",
      violations: r.violations || [],
      suggestions: r.suggestions || [],
      revisedHook: r.revisedHook || null,
      revisedHeadline: r.revisedHeadline || null,
      specialAdCategory: r.specialAdCategory || null,
      disclaimerNeeded: r.disclaimerNeeded || null,
    }));

    const passed = ctx.compliance.filter(r => r.passed).length;
    const failed = ctx.compliance.filter(r => !r.passed).length;

    saveAgentOutput(ctx.runId, "compliance", ctx.compliance);
    addLog(ctx, `Compliance: ${passed} passed, ${failed} flagged`);

    return ctx.compliance;
  } catch (err) {
    console.error(`[COMPLIANCE] Error: ${err.message}`);
    addLog(ctx, `Compliance error: ${err.message}`);

    // Default to all passed on error (don't block pipeline)
    ctx.compliance = ctx.scripts.map(s => ({
      scriptId: s.id,
      scriptIndex: s.index,
      passed: true,
      severity: "unknown",
      violations: [],
      suggestions: ["Manual compliance review recommended — automated review failed"],
    }));
    return ctx.compliance;
  }
}

/**
 * Format compliance results for Telegram.
 */
function formatCompliance(compliance) {
  if (!compliance?.length) return "No compliance results.";

  const passed = compliance.filter(r => r.passed).length;
  const failed = compliance.filter(r => !r.passed).length;

  let msg = `🛡️ COMPLIANCE REVIEW\n\n`;
  msg += `✅ Passed: ${passed} | ❌ Flagged: ${failed}\n\n`;

  for (const r of compliance) {
    const icon = r.passed ? "✅" : r.severity === "critical" ? "🚫" : "⚠️";
    msg += `${icon} Script ${r.scriptIndex}: ${r.passed ? "CLEAN" : r.severity?.toUpperCase()}\n`;

    if (r.violations?.length) {
      for (const v of r.violations) {
        msg += `  ⚠️ ${v.issue} (${v.location})\n`;
      }
    }
    if (r.disclaimerNeeded) {
      msg += `  📋 Disclaimer needed: ${r.disclaimerNeeded.slice(0, 80)}\n`;
    }
    if (r.specialAdCategory) {
      msg += `  🏷️ Special Ad Category: ${r.specialAdCategory}\n`;
    }
    msg += "\n";
  }

  if (failed > 0) {
    msg += `\n💡 Review flagged scripts before proceeding to launch.`;
  }

  return msg;
}

module.exports = { run, formatCompliance };
