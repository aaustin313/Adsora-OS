// Voice transcription using Whisper API (Groq free tier or OpenAI)
// Groq is preferred — free, fast. Get a key at console.groq.com
// Falls back to OpenAI if GROQ_API_KEY is not set.

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function getProvider() {
  if (GROQ_API_KEY) {
    return {
      url: "https://api.groq.com/openai/v1/audio/transcriptions",
      key: GROQ_API_KEY,
      model: "whisper-large-v3",
      name: "Groq",
    };
  }
  if (OPENAI_API_KEY) {
    return {
      url: "https://api.openai.com/v1/audio/transcriptions",
      key: OPENAI_API_KEY,
      model: "whisper-1",
      name: "OpenAI",
    };
  }
  return null;
}

const provider = getProvider();
if (provider) {
  console.log(`✅ Voice transcription ready (${provider.name} Whisper)`);
} else {
  console.warn("⚠️  Voice transcription disabled — set GROQ_API_KEY (free) or OPENAI_API_KEY in .env");
}

/**
 * Transcribe audio from a Telegram voice message using Whisper.
 * @param {Buffer} audioBuffer - The OGG audio file as a Buffer
 * @returns {Promise<string>} - The transcribed text
 */
async function transcribeVoice(audioBuffer) {
  if (!provider) {
    throw new Error("No transcription service configured. Add GROQ_API_KEY (free at console.groq.com) or OPENAI_API_KEY to .env");
  }

  // Build multipart form data manually (no extra dependencies)
  const boundary = "----WhisperBoundary" + Date.now();
  const parts = [];

  // File part
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="voice.ogg"\r\n` +
    `Content-Type: audio/ogg\r\n\r\n`
  );
  parts.push(audioBuffer);
  parts.push("\r\n");

  // Model part
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="model"\r\n\r\n` +
    `${provider.model}\r\n`
  );

  // Close boundary
  parts.push(`--${boundary}--\r\n`);

  // Combine into a single buffer
  const bodyParts = parts.map((p) => (typeof p === "string" ? Buffer.from(p) : p));
  const body = Buffer.concat(bodyParts);

  const response = await fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.key}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`Transcription failed (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const result = await response.json();
  const text = result.text?.trim();

  if (!text) {
    throw new Error("Transcription returned empty result");
  }

  console.log(`[WHISPER] Transcribed via ${provider.name}: "${text.slice(0, 80)}..."`);
  return text;
}

module.exports = { transcribeVoice };
