import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./local-env.js";
import { generateAssistantReply } from "./openai-assistant.js";
import { synthesizeSpeech } from "./tts-provider.js";
import { transcribeWithElevenLabs } from "./elevenlabs-stt.js";
import { transcribeWithOpenAI } from "./openai-stt.js";

loadLocalEnv();

const PORT = Number(process.env.PROMETHEUS_OS_PORT || 8792);
const HOST = process.env.PROMETHEUS_OS_HOST || "127.0.0.1";
const ROOT = normalize(join(fileURLToPath(new URL("../", import.meta.url))));

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "http://127.0.0.1:8791",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Prometheus-STT-Provider"
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20_000) {
        reject(new Error("Request too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function readBinaryBody(req, maxBytes = 8_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Audio request too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function handleTts(req, res) {
  try {
    const raw = await readBody(req);
    const payload = JSON.parse(raw || "{}");
    const result = await synthesizeSpeech({
      text: payload.text,
      provider: payload.provider,
      preferredVoice: payload.preferredVoice
    });

    if (!result.ok) {
      sendJson(res, result.status || 500, { error: result.error || "TTS failed." });
      return;
    }

    res.writeHead(200, {
      "Content-Type": result.contentType,
      "Content-Length": String(result.audio.length),
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "http://127.0.0.1:8791",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Prometheus-STT-Provider",
      "X-Prometheus-Voice-Provider": result.provider,
      "X-Prometheus-Audio-Bytes": String(result.audio.length),
      "X-Prometheus-Text-Chars": String(String(payload.text || "").length)
    });
    res.end(result.audio);
  } catch {
    sendJson(res, 500, { error: "TTS request failed." });
  }
}

async function handleStt(req, res) {
  try {
    const audio = await readBinaryBody(req);
    const mimeType = req.headers["content-type"] || "audio/webm";
    const provider = req.headers["x-prometheus-stt-provider"] || "auto";

    if (!["auto", "elevenlabs", "openai"].includes(provider)) {
      sendJson(res, 400, { error: "Unsupported STT provider." });
      return;
    }

    let result = provider === "openai"
      ? await transcribeWithOpenAI({ audio, mimeType })
      : await transcribeWithElevenLabs({ audio, mimeType });

    if (!result.ok && provider === "auto") {
      result = await transcribeWithOpenAI({ audio, mimeType });
    }

    if (!result.ok) {
      sendJson(res, result.status || 500, { error: result.error || "STT failed." });
      return;
    }

    sendJson(res, 200, {
      text: result.text,
      provider: result.provider,
      language: result.language
    });
  } catch {
    sendJson(res, 500, { error: "STT request failed." });
  }
}

async function handleAssistant(req, res) {
  try {
    const raw = await readBody(req);
    const payload = JSON.parse(raw || "{}");
    const result = await generateAssistantReply({
      message: payload.message,
      messages: payload.messages
    });

    if (!result.ok) {
      sendJson(res, result.status || 500, { error: result.error || "Assistant failed." });
      return;
    }

    sendJson(res, 200, { text: result.text });
  } catch {
    sendJson(res, 500, { error: "Assistant request failed." });
  }
}

function handleHealth(_req, res) {
  sendJson(res, 200, {
    ok: true,
    server: {
      host: HOST,
      port: PORT,
      mode: "local-only"
    },
    tts: {
      elevenlabsConfigured: Boolean(process.env.ELEVENLABS_API_KEY),
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY)
    },
    stt: {
      architecture: "companion-webview-mediarecorder-to-local-backend-stt",
      elevenlabsConfigured: Boolean(process.env.ELEVENLABS_API_KEY),
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY)
    },
    assistant: {
      localDemoFallback: true,
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY)
    }
  });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const rawPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(ROOT, rawPath));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "http://127.0.0.1:8791",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Prometheus-STT-Provider"
    });
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/api/tts") {
    await handleTts(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/stt") {
    await handleStt(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/assistant") {
    await handleAssistant(req, res);
    return;
  }

  if (req.method === "GET" && req.url === "/api/health") {
    handleHealth(req, res);
    return;
  }

  if (req.method === "GET") {
    await serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, HOST, () => {
  console.log(`Prometheus OS local backend running at http://${HOST}:${PORT}`);
});
