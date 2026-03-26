/**
 * Agent 4: Video Producer
 * Takes approved scripts and generates videos via Kling AI.
 * Supports batch production with progress tracking.
 * Falls back to script-only output if Kling isn't configured.
 */

const kling = require("../apis/kling");
const { addLog } = require("../pipeline/context");
const { saveAgentOutput, getRunDir } = require("../pipeline/store");
const path = require("path");
const fs = require("fs");

/**
 * Run the video producer agent.
 * @param {object} ctx - PipelineContext
 * @param {function} onProgress - Progress callback (for Telegram updates)
 * @returns {Array} Array of video objects
 */
async function run(ctx, onProgress) {
  addLog(ctx, "Video Producer starting...");
  ctx.currentAgent = "video-producer";

  if (!ctx.scripts?.length) {
    addLog(ctx, "No scripts to produce — skipping");
    return [];
  }

  // Check if Kling is configured
  if (!kling.isConfigured()) {
    addLog(ctx, "Kling AI not configured — outputting scripts only");
    ctx.videos = ctx.scripts.map(s => ({
      scriptId: s.id,
      status: "skipped",
      reason: "Kling AI not configured (set KLING_API_KEY and KLING_API_SECRET in .env)",
    }));
    saveScriptsAsStoryboards(ctx);
    return ctx.videos;
  }

  const runDir = getRunDir(ctx.runId);
  const videosDir = path.join(runDir, "videos");
  if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });

  // Generate videos for each script
  const results = [];
  const batchSize = 2; // Don't overwhelm Kling API

  for (let i = 0; i < ctx.scripts.length; i += batchSize) {
    const batch = ctx.scripts.slice(i, i + batchSize);

    const batchPromises = batch.map(async (script) => {
      const videoPrompt = buildVideoPrompt(script);
      const outputPath = path.join(videosDir, `${script.id}.mp4`);

      try {
        if (onProgress) onProgress(`🎬 Generating video ${script.index}/${ctx.scripts.length}: "${script.angle}"...`);
        addLog(ctx, `Submitting video for script ${script.id}: ${script.angle}`);

        const { taskId } = await kling.textToVideo(videoPrompt, {
          duration: script.estimatedLength <= 10 ? "5" : "10",
          aspectRatio: "9:16", // vertical for social
        });

        return {
          scriptId: script.id,
          klingTaskId: taskId,
          localPath: outputPath,
          status: "generating",
          prompt: videoPrompt,
        };
      } catch (err) {
        addLog(ctx, `Video generation failed for ${script.id}: ${err.message}`);
        return {
          scriptId: script.id,
          status: "failed",
          error: err.message,
        };
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);
    for (const r of batchResults) {
      if (r.status === "fulfilled") results.push(r.value);
    }
  }

  // Now wait for all pending videos to complete
  const pending = results.filter(r => r.status === "generating");
  if (pending.length > 0) {
    addLog(ctx, `Waiting for ${pending.length} videos to finish generating...`);
    if (onProgress) onProgress(`⏳ Waiting for ${pending.length} videos to render...`);

    for (const video of pending) {
      try {
        const { videoUrl, duration } = await kling.waitForVideo(video.klingTaskId, 600000);
        await kling.downloadVideo(videoUrl, video.localPath);
        video.status = "ready";
        video.durationMs = duration ? duration * 1000 : null;
        video.videoUrl = videoUrl;
        addLog(ctx, `Video ready: ${video.scriptId}`);
        if (onProgress) onProgress(`✅ Video ready: ${path.basename(video.localPath)}`);
      } catch (err) {
        video.status = "failed";
        video.error = err.message;
        addLog(ctx, `Video failed: ${video.scriptId} — ${err.message}`);
        if (onProgress) onProgress(`❌ Video failed: ${err.message?.slice(0, 60)}`);
      }
    }
  }

  ctx.videos = results;
  saveAgentOutput(ctx.runId, "videos", results);
  addLog(ctx, `Video Producer complete: ${results.filter(r => r.status === "ready").length}/${results.length} succeeded`);

  return ctx.videos;
}

/**
 * Build a video generation prompt from a script.
 */
function buildVideoPrompt(script) {
  // For Kling, we need a visual description, not the full script text
  let prompt = "";

  switch (script.type) {
    case "ugc":
    case "talking_head":
      prompt = `A person looking directly at the camera, speaking passionately about ${script.angle}. Natural lighting, phone-camera style, authentic feel. The person appears concerned and then relieved as they share their story. Vertical video format, casual setting like a living room or kitchen.`;
      break;
    case "text_overlay":
      prompt = `Clean, bold text appearing on screen with dynamic motion graphics. Dark background with bright text reveals. Professional but attention-grabbing style. Text slides and fades in with impact. Vertical social media format.`;
      break;
    case "slideshow":
      prompt = `A series of compelling images transitioning smoothly. Professional stock-style photos related to ${script.angle}. Each image has subtle motion (Ken Burns effect). Clean transitions. Vertical format optimized for social media feeds.`;
      break;
    case "voiceover":
    default:
      prompt = `Cinematic b-roll footage related to ${script.angle}. Wide and close-up shots, smooth camera movements. Professional look with natural color grading. The footage should evoke ${script.targetEmotion || "curiosity"}. Vertical format for social media.`;
      break;
  }

  return prompt;
}

/**
 * Save scripts as storyboard documents when video isn't available.
 */
function saveScriptsAsStoryboards(ctx) {
  const runDir = getRunDir(ctx.runId);
  const scriptsDir = path.join(runDir, "scripts");
  if (!fs.existsSync(scriptsDir)) fs.mkdirSync(scriptsDir, { recursive: true });

  for (const script of ctx.scripts) {
    const content = `# Script ${script.index}: ${script.angle}

## Type: ${script.type} | Length: ~${script.estimatedLength}s | Emotion: ${script.targetEmotion}

## Hook (0-3s)
${script.hook}

## Headline
${script.headline}

## Primary Text (for ad copy)
${script.primaryText}

## Full Script
${script.fullScript}

## Visual Format
${script.format}

## Why It Works
${script.whyItWorks}

---
Generated by Adsora OS Creative Pipeline
Run: ${ctx.runId}
`;
    fs.writeFileSync(path.join(scriptsDir, `${script.id}.md`), content);
  }

  addLog(ctx, `Saved ${ctx.scripts.length} script storyboards to ${scriptsDir}`);
}

/**
 * Format video results for Telegram.
 */
function formatVideos(videos) {
  if (!videos?.length) return "No videos produced.";

  const ready = videos.filter(v => v.status === "ready").length;
  const failed = videos.filter(v => v.status === "failed").length;
  const skipped = videos.filter(v => v.status === "skipped").length;

  let msg = `🎬 VIDEO PRODUCTION RESULTS\n\n`;
  msg += `✅ Ready: ${ready} | ❌ Failed: ${failed}`;
  if (skipped) msg += ` | ⏭️ Skipped: ${skipped}`;
  msg += "\n\n";

  for (const v of videos) {
    const icon = v.status === "ready" ? "✅" : v.status === "failed" ? "❌" : "⏭️";
    msg += `${icon} ${v.scriptId}: ${v.status}`;
    if (v.error) msg += ` — ${v.error.slice(0, 60)}`;
    if (v.localPath) msg += ` (${path.basename(v.localPath)})`;
    msg += "\n";
  }

  return msg;
}

module.exports = { run, formatVideos };
