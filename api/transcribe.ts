import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI, { toFile } from "openai";

const SUPPORTED_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/flac",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
]);

const MAX_FILE_SIZE = 1 * 1024 * 1024 * 1024; // 1 GB

export const config = {
  api: { bodyParser: false },
};

async function parseMultipart(
  req: VercelRequest
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const { default: Busboy } = await import("busboy");

  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_FILE_SIZE, files: 1 },
    });

    const chunks: Buffer[] = [];
    let filename = "audio.webm";
    let contentType = "audio/webm";
    let fileSizeLimitHit = false;

    busboy.on("file", (_fieldname, stream, info) => {
      filename = info.filename || filename;
      contentType = info.mimeType || contentType;

      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("limit", () => {
        fileSizeLimitHit = true;
      });
    });

    busboy.on("finish", () => {
      if (fileSizeLimitHit) {
        return reject(new Error("File too large. Maximum size is 1 GB."));
      }
      if (chunks.length === 0) {
        return reject(new Error("No audio file found in request."));
      }
      resolve({ buffer: Buffer.concat(chunks), filename, contentType });
    });

    busboy.on("error", reject);
    req.pipe(busboy);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const apiKey = process.env.FIREWORKS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "FIREWORKS_API_KEY not configured." });
  }

  // Parse multipart form data
  let buffer: Buffer;
  let filename: string;
  let contentType: string;
  try {
    ({ buffer, filename, contentType } = await parseMultipart(req));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to parse upload.";
    return res.status(400).json({ error: msg });
  }

  // Validate content type
  if (!SUPPORTED_TYPES.has(contentType)) {
    return res.status(400).json({
      error: `Unsupported audio format: ${contentType}. Supported: MP3, FLAC, WAV, WEBM.`,
    });
  }

  // Transcribe via Fireworks Whisper API
  const client = new OpenAI({
    apiKey,
    baseURL: "https://audio-prod.api.fireworks.ai/v1",
  });

  const start = Date.now();
  try {
    const audioFile = await toFile(buffer, filename, { type: contentType });
    const transcription = await client.audio.transcriptions.create({
      model: "whisper-v3",
      file: audioFile,
    });
    const latency_ms = Date.now() - start;

    console.log(
      `[transcribe] file="${filename}" type=${contentType} size=${buffer.length} latency=${latency_ms}ms`
    );

    return res.status(200).json({ text: transcription.text, latency_ms });
  } catch (err) {
    const latency_ms = Date.now() - start;
    const message = err instanceof Error ? err.message : "Transcription failed.";
    console.error(
      `[transcribe] error after ${latency_ms}ms: ${message}`
    );
    return res.status(502).json({ error: `Transcription API error: ${message}` });
  }
}
