/**
 * Agent 3: Script/Angle Generator
 * Takes research + evaluation + swipe files + performance data
 * and generates ad scripts, hooks, angles, and concepts.
 * Outputs structured scripts ready for video production.
 */

const { addLog } = require("../pipeline/context");
const { saveAgentOutput } = require("../pipeline/store");
const { getSwipeContext } = require("../ai/copywriter");
const crypto = require("crypto");

/**
 * Run the scriptwriter agent.
 * @param {object} ctx - PipelineContext
 * @returns {Array} Array of script objects
 */
async function run(ctx) {
  addLog(ctx, "Scriptwriter Agent starting...");
  ctx.currentAgent = "scriptwriter";

  // Load swipe file context if available
  let swipeContext = "";
  try {
    swipeContext = await getSwipeContext();
  } catch (err) {
    addLog(ctx, `Swipe files unavailable: ${err.message}`);
  }

  // Build the prompt with all available context
  const research = ctx.research?.synthesis || "No research available.";

  let evalContext = "";
  if (ctx.evaluation?.score !== null) {
    evalContext = `\nOFFER EVALUATION: ${ctx.evaluation.score}/10`;
    if (ctx.evaluation.psychographics) {
      evalContext += `\nPrimary Emotion: ${ctx.evaluation.psychographics.primaryEmotion}`;
      evalContext += `\nPain Points: ${(ctx.evaluation.psychographics.painPoints || []).join(", ")}`;
      evalContext += `\nDesires: ${(ctx.evaluation.psychographics.desires || []).join(", ")}`;
    }
    if (ctx.evaluation.demographics) {
      evalContext += `\nTarget Age: ${ctx.evaluation.demographics.primaryAge}`;
      evalContext += `\nGender: ${ctx.evaluation.demographics.gender}`;
    }
    if (ctx.evaluation.recommendations?.length) {
      evalContext += `\nRecommendations: ${ctx.evaluation.recommendations.join("; ")}`;
    }
  }

  const numScripts = ctx.options.numScripts || 8;

  const prompt = `You are a world-class direct-response creative strategist for Facebook ads. Generate ${numScripts} ad scripts based on the research and data below.

OFFER: ${ctx.offerName || ctx.offerUrl || "Not specified"}
VERTICAL: ${ctx.vertical || "Not specified"}
URL: ${ctx.offerUrl || "Not provided"}
${evalContext}

=== CREATIVE RESEARCH BRIEF ===
${research.slice(0, 8000)}

${swipeContext ? `=== SWIPE FILE PATTERNS ===\n${swipeContext.slice(0, 5000)}\n` : ""}

---

Generate exactly ${numScripts} ad scripts. For EACH script, respond in this exact JSON array format:

[
  {
    "type": "ugc|voiceover|text_overlay|slideshow|talking_head",
    "hook": "The first 1-3 lines that stop the scroll (THIS IS THE MOST IMPORTANT PART)",
    "angle": "2-5 word description of the angle (e.g., 'fear of missing out', 'social proof', 'news angle')",
    "headline": "Short headline for the ad (5-8 words max)",
    "primaryText": "The full ad copy / primary text (for feed ads)",
    "fullScript": "The complete video script including visual directions in [brackets]. Include: hook (0-3s), problem (3-8s), solution (8-15s), proof (15-22s), CTA (22-30s). Time each section.",
    "estimatedLength": 30,
    "targetEmotion": "fear|curiosity|desire|urgency|anger|hope|relief",
    "format": "A brief description of the visual format (e.g., 'Person talking to camera about their experience')",
    "whyItWorks": "1 sentence on why this concept should perform based on the research data"
  }
]

RULES:
- The HOOK is everything. If the first 3 seconds don't stop the scroll, the ad is dead. Make hooks visceral, specific, and pattern-interrupting.
- Vary the script types: mix UGC, voiceover, text overlay, and talking head styles
- Vary the angles: don't repeat the same emotional trigger
- Each script should be 15-45 seconds when spoken
- Use conversational language — this is Facebook, not a boardroom
- Include specific numbers and claims where possible (with compliance in mind)
- Reference current events or trends from the research if relevant
- Include clear CTAs that match the offer
- Scripts should be Facebook-compliant (no misleading claims, no "guaranteed" results)

Respond ONLY with the JSON array. No markdown, no code blocks, no explanation.`;

  const systemPrompt = `You are a direct-response creative strategist for a performance marketing agency. Generate Facebook ad scripts that convert. Focus on scroll-stopping hooks, emotional resonance, and clear CTAs. Respond only with a valid JSON array.`;

  try {
    const { callClaudeCLI } = require("../ai/claude");
    const response = await callClaudeCLI(prompt, systemPrompt, { timeoutMs: 300000 });

    // Parse JSON response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("No JSON array found in scriptwriter response");
    }

    const scripts = JSON.parse(jsonMatch[0]);

    // Add IDs and clean up
    ctx.scripts = scripts.map((script, i) => ({
      id: `script-${crypto.randomBytes(3).toString("hex")}`,
      index: i + 1,
      type: script.type || "voiceover",
      hook: script.hook || "",
      angle: script.angle || "",
      headline: script.headline || "",
      primaryText: script.primaryText || "",
      fullScript: script.fullScript || "",
      estimatedLength: script.estimatedLength || 30,
      targetEmotion: script.targetEmotion || "curiosity",
      format: script.format || "",
      whyItWorks: script.whyItWorks || "",
    }));

    saveAgentOutput(ctx.runId, "scripts", ctx.scripts);
    addLog(ctx, `Generated ${ctx.scripts.length} scripts`);

    return ctx.scripts;
  } catch (err) {
    console.error(`[SCRIPTWRITER] Error: ${err.message}`);
    addLog(ctx, `Scriptwriter error: ${err.message}`);
    return [];
  }
}

/**
 * Format scripts for Telegram display.
 */
function formatScripts(scripts) {
  if (!scripts?.length) return "No scripts generated.";

  let msg = `✍️ GENERATED ${scripts.length} AD SCRIPTS\n\n`;

  for (const script of scripts) {
    const typeEmoji = {
      ugc: "🎭", voiceover: "🎙️", text_overlay: "📝",
      slideshow: "🖼️", talking_head: "🗣️",
    };

    msg += `--- SCRIPT ${script.index}: ${script.angle?.toUpperCase() || "UNTITLED"} ---\n`;
    msg += `${typeEmoji[script.type] || "📋"} Type: ${script.type} | ${script.estimatedLength}s | ${script.targetEmotion}\n`;
    msg += `🎣 Hook: ${script.hook?.slice(0, 120)}\n`;
    msg += `📰 Headline: ${script.headline}\n`;
    if (script.whyItWorks) msg += `💡 Why: ${script.whyItWorks}\n`;
    msg += `\n`;
  }

  msg += `\nReply "approve" to proceed to video production, or "revise" for changes.`;
  return msg;
}

/**
 * Format a single script in full detail.
 */
function formatFullScript(script) {
  let msg = `📋 SCRIPT: ${script.angle?.toUpperCase()}\n\n`;
  msg += `Type: ${script.type} | Length: ~${script.estimatedLength}s\n`;
  msg += `Emotion: ${script.targetEmotion}\n\n`;
  msg += `🎣 HOOK:\n${script.hook}\n\n`;
  msg += `📰 HEADLINE:\n${script.headline}\n\n`;
  msg += `📝 PRIMARY TEXT:\n${script.primaryText}\n\n`;
  msg += `🎬 FULL SCRIPT:\n${script.fullScript}\n\n`;
  if (script.format) msg += `📐 FORMAT: ${script.format}\n`;
  if (script.whyItWorks) msg += `💡 WHY: ${script.whyItWorks}\n`;
  return msg;
}

module.exports = { run, formatScripts, formatFullScript };
