/**
 * GoHighLevel API Client
 *
 * Handles authentication and API calls to GHL v2.
 * Currently supports: Media Library (upload/list/folders)
 *
 * Auth: Private Integration Token (set GHL_API_KEY in .env)
 *       OR OAuth access token (set GHL_ACCESS_TOKEN in .env)
 *
 * Required env vars:
 *   GHL_API_KEY or GHL_ACCESS_TOKEN — authentication
 *   GHL_LOCATION_ID — sub-account / location ID
 */

const https = require("https");
const { URL } = require("url");
const path = require("path");

const GHL_BASE = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

function getAuthToken() {
  return process.env.GHL_API_KEY || process.env.GHL_ACCESS_TOKEN;
}

function getLocationId() {
  return process.env.GHL_LOCATION_ID;
}

// Generic GHL API request
function ghlRequest(method, endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const token = getAuthToken();
    if (!token) {
      reject(new Error("GHL not configured. Set GHL_API_KEY or GHL_ACCESS_TOKEN in .env"));
      return;
    }

    const url = new URL(endpoint, GHL_BASE);

    // Add query params
    if (options.query) {
      for (const [key, val] of Object.entries(options.query)) {
        if (val !== undefined && val !== null) {
          url.searchParams.set(key, String(val));
        }
      }
    }

    const headers = {
      "Authorization": `Bearer ${token}`,
      "Version": API_VERSION,
      ...options.headers,
    };

    if (options.json) {
      headers["Content-Type"] = "application/json";
    }

    const reqOptions = {
      method,
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers,
      timeout: options.timeout || 30000,
    };

    const req = https.request(reqOptions, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf-8");
        if (res.statusCode >= 400) {
          reject(new Error(`GHL API ${res.statusCode}: ${body.slice(0, 300)}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("GHL API request timed out"));
    });

    if (options.body) {
      req.write(options.body);
    } else if (options.json) {
      req.write(JSON.stringify(options.json));
    }

    req.end();
  });
}

// Multipart form upload (for file uploads)
function ghlUploadMultipart(endpoint, fields, fileField) {
  return new Promise((resolve, reject) => {
    const token = getAuthToken();
    if (!token) {
      reject(new Error("GHL not configured. Set GHL_API_KEY or GHL_ACCESS_TOKEN in .env"));
      return;
    }

    const boundary = "----GHLUpload" + Date.now().toString(36);
    const url = new URL(endpoint, GHL_BASE);

    let body = "";

    // Add text fields
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined && val !== null) {
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
        body += `${val}\r\n`;
      }
    }

    // Add file field if present
    let bodyBuffer;
    if (fileField) {
      const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="${fileField.fieldName}"; filename="${fileField.filename}"\r\nContent-Type: ${fileField.contentType}\r\n\r\n`;
      const footer = `\r\n--${boundary}--\r\n`;

      bodyBuffer = Buffer.concat([
        Buffer.from(body + fileHeader, "utf-8"),
        fileField.data,
        Buffer.from(footer, "utf-8"),
      ]);
    } else {
      body += `--${boundary}--\r\n`;
      bodyBuffer = Buffer.from(body, "utf-8");
    }

    const reqOptions = {
      method: "POST",
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Version": API_VERSION,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": bodyBuffer.length,
      },
      timeout: 60000,
    };

    const req = https.request(reqOptions, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const responseBody = Buffer.concat(chunks).toString("utf-8");
        if (res.statusCode >= 400) {
          reject(new Error(`GHL Upload ${res.statusCode}: ${responseBody.slice(0, 300)}`));
          return;
        }
        try {
          resolve(JSON.parse(responseBody));
        } catch {
          resolve(responseBody);
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("GHL upload timed out"));
    });

    req.write(bodyBuffer);
    req.end();
  });
}

// --- Media Library API ---

// Download an image from a URL and return the buffer
function downloadFile(fileUrl) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(fileUrl);
    const protocol = parsedUrl.protocol === "https:" ? https : http;

    protocol.get(fileUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 15000,
    }, (res) => {
      if ([301, 302, 303, 307].includes(res.statusCode) && res.headers.location) {
        downloadFile(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      let size = 0;
      res.on("data", (chunk) => {
        size += chunk.length;
        if (size > 25 * 1024 * 1024) {
          res.destroy();
          reject(new Error("File too large (>25MB)"));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => resolve({
        buffer: Buffer.concat(chunks),
        contentType: res.headers["content-type"] || "application/octet-stream",
      }));
    }).on("error", reject);
  });
}

// Upload a file from a URL — downloads it first, then uploads buffer to GHL
// This ensures GHL actually hosts the file and returns a GCS URL
async function uploadMediaFromUrl(fileUrl, name) {
  const locationId = getLocationId();
  if (!locationId) throw new Error("GHL_LOCATION_ID not set in .env");

  const filename = name || path.basename(new URL(fileUrl).pathname) || "image";
  console.log(`[GHL] Downloading: ${fileUrl.slice(0, 60)}`);

  // Download the file first
  const { buffer, contentType } = await downloadFile(fileUrl);

  // Determine file extension from content type if not in filename
  let finalName = filename;
  if (!path.extname(finalName)) {
    const extMap = { "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp", "image/svg+xml": ".svg" };
    finalName += extMap[contentType] || ".jpg";
  }

  console.log(`[GHL] Uploading to GHL: ${finalName} (${Math.round(buffer.length / 1024)}KB)`);

  // Upload as buffer so GHL hosts it on GCS
  return uploadMediaBuffer(buffer, finalName, contentType);
}

// Upload a file buffer directly
async function uploadMediaBuffer(buffer, filename, contentType) {
  const locationId = getLocationId();
  if (!locationId) throw new Error("GHL_LOCATION_ID not set in .env");

  console.log(`[GHL] Uploading file: ${filename} (${Math.round(buffer.length / 1024)}KB)`);

  return ghlUploadMultipart(
    "/medias/upload-file",
    {
      altId: locationId,
      altType: "location",
      name: filename,
    },
    {
      fieldName: "file",
      filename,
      contentType: contentType || getMimeType(filename),
      data: buffer,
    }
  );
}

// List files in media library
async function listMedia(options = {}) {
  const locationId = getLocationId();
  if (!locationId) throw new Error("GHL_LOCATION_ID not set in .env");

  return ghlRequest("GET", "/medias/files", {
    query: {
      altId: locationId,
      altType: "location",
      sortBy: options.sortBy || "createdAt",
      sortOrder: options.sortOrder || "desc",
      type: options.type || "file",
      limit: options.limit || "20",
      offset: options.offset || "0",
      query: options.query,
      parentId: options.parentId,
    },
  });
}

// Create a folder in media library
async function createMediaFolder(name, parentId) {
  const locationId = getLocationId();
  if (!locationId) throw new Error("GHL_LOCATION_ID not set in .env");

  return ghlRequest("POST", "/medias/folder", {
    json: {
      altId: locationId,
      altType: "location",
      name,
      ...(parentId ? { parentId } : {}),
    },
  });
}

// Delete a media file
async function deleteMedia(fileId) {
  return ghlRequest("DELETE", `/medias/${fileId}`);
}

// --- Funnels API (read-only for now) ---

// List all funnels
async function listFunnels(options = {}) {
  const locationId = getLocationId();
  if (!locationId) throw new Error("GHL_LOCATION_ID not set in .env");

  return ghlRequest("GET", "/funnels/funnel/list", {
    query: {
      locationId,
      limit: options.limit || "20",
      offset: options.offset || "0",
    },
  });
}

// List pages in a funnel
async function listFunnelPages(funnelId, options = {}) {
  const locationId = getLocationId();
  if (!locationId) throw new Error("GHL_LOCATION_ID not set in .env");

  return ghlRequest("GET", "/funnels/page", {
    query: {
      locationId,
      funnelId,
      limit: options.limit || "20",
      offset: options.offset || "0",
    },
  });
}

// Check if GHL is configured
function isGhlConfigured() {
  return !!(getAuthToken() && getLocationId());
}

// Get MIME type from filename
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".pdf": "application/pdf",
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
  };
  return types[ext] || "application/octet-stream";
}

module.exports = {
  ghlRequest,
  uploadMediaFromUrl,
  uploadMediaBuffer,
  listMedia,
  createMediaFolder,
  deleteMedia,
  listFunnels,
  listFunnelPages,
  isGhlConfigured,
};
