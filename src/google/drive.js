const { google } = require("googleapis");
const { getAuthClient, isAuthenticated } = require("./auth");

function getDriveClient() {
  if (!isAuthenticated()) {
    throw new Error("Google not connected. Visit /auth/google to connect.");
  }
  return google.drive({ version: "v3", auth: getAuthClient() });
}

async function listFiles(pageSize = 10) {
  const drive = getDriveClient();
  const res = await drive.files.list({
    pageSize,
    fields: "files(id, name, mimeType, modifiedTime, parents)",
    orderBy: "modifiedTime desc",
  });
  return res.data.files || [];
}

async function searchFiles(query) {
  const drive = getDriveClient();
  const sanitized = query.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `fullText contains '${sanitized}'`,
    pageSize: 20,
    fields: "files(id, name, mimeType, modifiedTime)",
    orderBy: "modifiedTime desc",
  });
  return res.data.files || [];
}

async function listFolder(folderId) {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId.replace(/'/g, "\\'")}' in parents`,
    pageSize: 50,
    fields: "files(id, name, mimeType, modifiedTime)",
    orderBy: "name",
  });
  return res.data.files || [];
}

async function readGoogleDoc(fileId) {
  const drive = getDriveClient();
  const res = await drive.files.export({
    fileId,
    mimeType: "text/plain",
  });
  return res.data;
}

async function readGoogleSheet(fileId) {
  const drive = getDriveClient();
  const res = await drive.files.export({
    fileId,
    mimeType: "text/csv",
  });
  return res.data;
}

async function getFileMetadata(fileId) {
  const drive = getDriveClient();
  const res = await drive.files.get({
    fileId,
    fields: "id, name, mimeType, modifiedTime, size, webViewLink",
  });
  return res.data;
}

async function downloadFileBuffer(fileId) {
  const drive = getDriveClient();

  // Get metadata first for name and mimeType
  const meta = await drive.files.get({
    fileId,
    fields: "id, name, mimeType, size",
  });

  // Download the file content
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );

  return {
    buffer: Buffer.from(res.data),
    mimeType: meta.data.mimeType,
    name: meta.data.name,
    size: parseInt(meta.data.size || 0),
  };
}

async function listFolderMedia(folderId) {
  const drive = getDriveClient();
  const sanitizedId = folderId.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${sanitizedId}' in parents and (mimeType contains 'image/' or mimeType contains 'video/')`,
    pageSize: 100,
    fields: "files(id, name, mimeType, modifiedTime, size)",
    orderBy: "name",
  });
  return res.data.files || [];
}

async function createGoogleDocFromHtml(name, htmlContent) {
  const drive = getDriveClient();
  const { Readable } = require("stream");

  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.document",
    },
    media: {
      mimeType: "text/html",
      body: Readable.from(Buffer.from(htmlContent, "utf-8")),
    },
    fields: "id, name, webViewLink",
  });

  return res.data;
}

module.exports = {
  listFiles,
  searchFiles,
  listFolder,
  listFolderMedia,
  readGoogleDoc,
  readGoogleSheet,
  getFileMetadata,
  downloadFileBuffer,
  createGoogleDocFromHtml,
};
