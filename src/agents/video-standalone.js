/**
 * Standalone Video Generator
 * Generates videos via Kling AI from a text prompt, independent of the pipeline.
 * Accessible via /video command in Telegram or router.
 */

const kling = require("../apis/kling");
const path = require("path");
const fs = require("fs");

const OUTPUT_DIR = path.join(__dirname, "..", "..", "output", "videos");

/**
 * Generate a video from a text prompt.
 * @param {string} prompt - Description of the video to generate
 * @param {object} options - { duration, aspectRatio, model, outputName }
 * @param {function} onProgress - Optional callback for status updates
 * @returns {{ taskId, videoUrl, filePath, duration, size }}
 */
async function generate(prompt, options = {}, onProgress) {
  if (!kling.isConfigured()) {
    throw new Error("Kling AI not configured. Set KLING_API_KEY and KLING_API_SECRET in .env");
  }

  const {
    duration = "5",
    aspectRatio = "9:16",
    model = "kling-v2",
    outputName,
  } = options;

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const filename = path.basename(outputName || `video-${Date.now()}.mp4`);
  const outputPath = path.join(OUTPUT_DIR, filename);

  if (onProgress) onProgress("Submitting video generation request...");

  const { taskId } = await kling.textToVideo(prompt, { duration, aspectRatio, model });

  if (onProgress) onProgress(`Video submitted (task: ${taskId}). Rendering — this takes 2-5 minutes...`);

  const { videoUrl, duration: videoDuration } = await kling.waitForVideo(taskId, 600000);

  if (onProgress) onProgress("Video rendered. Downloading...");

  const { path: filePath, size } = await kling.downloadVideo(videoUrl, outputPath);

  return {
    taskId,
    videoUrl,
    filePath,
    duration: videoDuration,
    size,
    filename,
  };
}

/**
 * Generate a video from an image + text prompt.
 * @param {string} imageUrl - URL of the source image
 * @param {string} prompt - Motion/animation description
 * @param {object} options
 * @param {function} onProgress
 */
async function generateFromImage(imageUrl, prompt, options = {}, onProgress) {
  if (!kling.isConfigured()) {
    throw new Error("Kling AI not configured. Set KLING_API_KEY and KLING_API_SECRET in .env");
  }

  const { duration = "5", model = "kling-v2", outputName } = options;

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const filename = outputName || `video-img-${Date.now()}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, filename);

  if (onProgress) onProgress("Submitting image-to-video request...");

  const { taskId } = await kling.imageToVideo(imageUrl, prompt, { duration, model });

  if (onProgress) onProgress(`Video submitted (task: ${taskId}). Rendering...`);

  const { videoUrl, duration: videoDuration } = await kling.waitForVideo(taskId, 600000);

  if (onProgress) onProgress("Video rendered. Downloading...");

  const { path: filePath, size } = await kling.downloadVideo(videoUrl, outputPath);

  return { taskId, videoUrl, filePath, duration: videoDuration, size, filename };
}

/**
 * Check status of a previously submitted video task.
 */
async function checkStatus(taskId) {
  return kling.getTaskStatus(taskId);
}

/**
 * Format video result for Telegram.
 */
function formatResult(result) {
  const sizeMB = (result.size / 1024 / 1024).toFixed(1);
  return [
    `Video ready!`,
    `Duration: ${result.duration || "N/A"}s`,
    `Size: ${sizeMB}MB`,
    `File: ${result.filename}`,
    `Saved to: output/videos/${result.filename}`,
  ].join("\n");
}

module.exports = { generate, generateFromImage, checkStatus, formatResult, OUTPUT_DIR };
