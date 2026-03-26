/**
 * Kling AI API Client
 * Handles video generation from text prompts or image+text.
 * Requires KLING_API_KEY and KLING_API_SECRET in .env
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const API_BASE = "https://api.klingai.com/v1";

function getApiKey() {
  return process.env.KLING_API_KEY;
}

function getApiSecret() {
  return process.env.KLING_API_SECRET;
}

function isConfigured() {
  return !!(getApiKey() && getApiSecret());
}

/**
 * Generate a JWT token for Kling API authentication.
 */
function generateToken() {
  const apiKey = getApiKey();
  const apiSecret = getApiSecret();

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: apiKey,
    exp: now + 1800, // 30 min
    nbf: now - 5,
  })).toString("base64url");

  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

/**
 * Make an authenticated API request to Kling.
 */
async function klingApi(endpoint, options = {}) {
  const token = generateToken();
  const url = `${API_BASE}${endpoint}`;

  const res = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json();
  if (data.code !== 0 && data.code !== undefined) {
    throw new Error(`Kling API: ${data.message || JSON.stringify(data)}`);
  }
  return data;
}

/**
 * Generate a video from a text prompt.
 * @param {string} prompt - Text description of the video
 * @param {object} options - { duration, aspectRatio, model }
 * @returns {{ taskId: string }}
 */
async function textToVideo(prompt, options = {}) {
  if (!isConfigured()) throw new Error("Kling AI not configured. Set KLING_API_KEY and KLING_API_SECRET in .env");

  const {
    duration = "5",    // "5" or "10" seconds
    aspectRatio = "16:9",
    model = "kling-v2",
    negativePrompt = "",
  } = options;

  console.log(`[KLING] Submitting text-to-video: "${prompt.slice(0, 80)}..."`);

  const result = await klingApi("/videos/text2video", {
    method: "POST",
    body: {
      model_name: model,
      prompt,
      negative_prompt: negativePrompt,
      cfg_scale: 0.5,
      mode: "std",
      aspect_ratio: aspectRatio,
      duration,
    },
  });

  const taskId = result.data?.task_id;
  if (!taskId) throw new Error("No task_id returned from Kling");

  console.log(`[KLING] Task submitted: ${taskId}`);
  return { taskId };
}

/**
 * Generate a video from an image + text prompt.
 */
async function imageToVideo(imageUrl, prompt, options = {}) {
  if (!isConfigured()) throw new Error("Kling AI not configured");

  const {
    duration = "5",
    model = "kling-v2",
  } = options;

  console.log(`[KLING] Submitting image-to-video: "${prompt.slice(0, 80)}..."`);

  const result = await klingApi("/videos/image2video", {
    method: "POST",
    body: {
      model_name: model,
      prompt,
      image: imageUrl,
      mode: "std",
      duration,
    },
  });

  const taskId = result.data?.task_id;
  if (!taskId) throw new Error("No task_id returned from Kling");
  return { taskId };
}

/**
 * Check the status of a video generation task.
 * @returns {{ status, videoUrl, duration }}
 */
async function getTaskStatus(taskId) {
  const result = await klingApi(`/videos/text2video/${taskId}`);
  const task = result.data;

  if (!task) return { status: "unknown" };

  return {
    status: task.task_status, // submitted, processing, succeed, failed
    videoUrl: task.task_result?.videos?.[0]?.url || null,
    duration: task.task_result?.videos?.[0]?.duration || null,
    createdAt: task.created_at,
  };
}

/**
 * Wait for a video to be ready, polling every 10s.
 * @param {string} taskId
 * @param {number} maxWaitMs - Max wait time (default 10 min)
 * @returns {{ videoUrl, duration }}
 */
async function waitForVideo(taskId, maxWaitMs = 600000) {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const status = await getTaskStatus(taskId);
    console.log(`[KLING] Task ${taskId}: ${status.status}`);

    if (status.status === "succeed") {
      return { videoUrl: status.videoUrl, duration: status.duration };
    }
    if (status.status === "failed") {
      throw new Error(`Video generation failed for task ${taskId}`);
    }

    await new Promise(r => setTimeout(r, 10000)); // poll every 10s
  }

  throw new Error(`Video generation timed out after ${maxWaitMs / 1000}s`);
}

/**
 * Download a video from URL to local path.
 */
async function downloadVideo(videoUrl, outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`Failed to download video: HTTP ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  console.log(`[KLING] Video saved: ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
  return { path: outputPath, size: buffer.length };
}

/**
 * Full workflow: generate + wait + download.
 */
async function generateVideo(prompt, outputPath, options = {}) {
  const { taskId } = await textToVideo(prompt, options);
  const { videoUrl, duration } = await waitForVideo(taskId);
  const { path: filePath, size } = await downloadVideo(videoUrl, outputPath);
  return { taskId, videoUrl, filePath, duration, size };
}

module.exports = {
  isConfigured,
  textToVideo,
  imageToVideo,
  getTaskStatus,
  waitForVideo,
  downloadVideo,
  generateVideo,
};
