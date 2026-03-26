const { google } = require("googleapis");
const { getAuthClient, isAuthenticated } = require("./auth");

function getGmailClient() {
  if (!isAuthenticated()) {
    throw new Error("Google not connected. Visit /auth/google to connect.");
  }
  return google.gmail({ version: "v1", auth: getAuthClient() });
}

async function listEmails(maxResults = 10) {
  const gmail = getGmailClient();
  const res = await gmail.users.messages.list({
    userId: "me",
    maxResults,
  });

  const messages = res.data.messages || [];
  const detailed = [];

  for (const msg of messages) {
    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    });

    const headers = detail.data.payload.headers;
    detailed.push({
      id: msg.id,
      from: headers.find((h) => h.name === "From")?.value || "",
      subject: headers.find((h) => h.name === "Subject")?.value || "",
      date: headers.find((h) => h.name === "Date")?.value || "",
      snippet: detail.data.snippet,
    });
  }

  return detailed;
}

async function readEmail(messageId) {
  const gmail = getGmailClient();
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = res.data.payload.headers;
  const body = extractBody(res.data.payload);

  return {
    id: messageId,
    from: headers.find((h) => h.name === "From")?.value || "",
    to: headers.find((h) => h.name === "To")?.value || "",
    subject: headers.find((h) => h.name === "Subject")?.value || "",
    date: headers.find((h) => h.name === "Date")?.value || "",
    body,
  };
}

async function searchEmails(query, maxResults = 10) {
  const gmail = getGmailClient();
  const res = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  const messages = res.data.messages || [];
  const detailed = [];

  for (const msg of messages) {
    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    });

    const headers = detail.data.payload.headers;
    detailed.push({
      id: msg.id,
      from: headers.find((h) => h.name === "From")?.value || "",
      subject: headers.find((h) => h.name === "Subject")?.value || "",
      date: headers.find((h) => h.name === "Date")?.value || "",
      snippet: detail.data.snippet,
    });
  }

  return detailed;
}

function extractBody(payload) {
  if (payload.body && payload.body.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  if (payload.parts) {
    // Prefer plain text
    const textPart = payload.parts.find((p) => p.mimeType === "text/plain");
    if (textPart && textPart.body && textPart.body.data) {
      return Buffer.from(textPart.body.data, "base64").toString("utf-8");
    }

    // Fall back to HTML
    const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
    if (htmlPart && htmlPart.body && htmlPart.body.data) {
      return Buffer.from(htmlPart.body.data, "base64").toString("utf-8");
    }

    // Check nested parts (multipart/alternative inside multipart/mixed)
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
  }

  return "(no readable body)";
}

module.exports = { listEmails, readEmail, searchEmails };
