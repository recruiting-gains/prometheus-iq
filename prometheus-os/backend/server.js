import http from "node:http";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
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
const PROJECT_ROOT = normalize(join(ROOT, ".."));
const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
const SOCIAL_MEDIA_INSTAGRAM_SNAPSHOT_URL = process.env.PROMETHEUS_SOCIAL_MEDIA_SNAPSHOT_URL ||
  "https://prometheusrouteiq.com/api/social/instagram/snapshot";

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

async function readCompanionVersion() {
  try {
    const raw = await readFile(join(ROOT, "companion-runtime-version.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      component: "Prometheus Companion",
      sourceVersion: "missing",
      installedVersion: "missing",
      runtimeVersion: "missing",
      sync: {
        inSync: false,
        outOfSync: [
          {
            area: "runtime",
            expected: "companion-runtime-version.json",
            actual: "missing",
            detail: "Installed runtime version manifest was not found."
          }
        ]
      }
    };
  }
}

function runGit(args) {
  try {
    return execFileSync("git", ["-C", PROJECT_ROOT, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000
    }).trim();
  } catch {
    return "";
  }
}

function recentCommits() {
  const output = runGit(["log", "-6", "--date=iso-strict", "--pretty=format:%h%x09%H%x09%ad%x09%s"]);
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => {
    const [shortHash, hash, date, ...subjectParts] = line.split("\t");
    return {
      shortHash,
      hash,
      date,
      subject: subjectParts.join("\t")
    };
  }).filter((item) => item.shortHash && item.subject);
}

async function readTextIfPresent(path) {
  try {
    if (!existsSync(path)) return "";
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

function extractStatus(text = "", label = "") {
  if (!text) return null;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const match = lines.find((line) => line.toLowerCase().includes(label.toLowerCase()));
  if (!match) return null;
  return match.replace(/^[-*#\s]+/, "").slice(0, 220);
}

async function founderTimeline() {
  const version = await readCompanionVersion();
  const report = await readTextIfPresent(join(PROJECT_ROOT, "mac-companion/reports/latest-companion-verification-report.md"));
  const masterState = await readTextIfPresent(join(PROJECT_ROOT, "PROMETHEUS_MASTER_ENGINEERING_STATE.md"));
  const productVision = await readTextIfPresent(join(PROJECT_ROOT, "PRODUCT_VISION.md"));
  const companyIdentity = await readTextIfPresent(join(PROJECT_ROOT, "COMPANY_IDENTITY.md"));
  const resultMatch = /^Result:\s*(.+)$/m.exec(report);

  return {
    ok: true,
    source: "Prometheus Companion local founder timeline",
    generatedAt: new Date().toISOString(),
    version: {
      sourceVersion: version.sourceVersion || "missing",
      installedVersion: version.installedVersion || "missing",
      runtimeVersion: version.runtimeVersion || "missing",
      gitCommit: version.git?.commit || "missing"
    },
    commits: recentCommits(),
    verification: {
      result: resultMatch?.[1] || "unknown",
      reportPath: existsSync(join(PROJECT_ROOT, "mac-companion/reports/latest-companion-verification-report.md"))
        ? "mac-companion/reports/latest-companion-verification-report.md"
        : "unavailable"
    },
    checkpoints: [
      { area: "Overwatch", status: extractStatus(masterState, "Overwatch") || "Read-only state source not present in installed runtime." },
      { area: "Mobile", status: extractStatus(masterState, "Mobile") || "No current local status marker found." },
      { area: "Website", status: extractStatus(masterState, "Website") || extractStatus(productVision, "Website") || "No current local status marker found." },
      { area: "Intelligence", status: extractStatus(masterState, "Intelligence") || "No current local status marker found." },
      { area: "CRM", status: extractStatus(masterState, "CRM") || "No current local status marker found." },
      { area: "Social", status: extractStatus(masterState, "Social") || "No current local status marker found." },
      { area: "Research", status: extractStatus(masterState, "Research") || "No current local status marker found." },
      { area: "Infrastructure", status: extractStatus(masterState, "Infrastructure") || "No current local status marker found." },
      { area: "Administration", status: extractStatus(masterState, "Administration") || "No current local status marker found." },
      { area: "Companion", status: extractStatus(masterState, "Companion") || `Runtime synchronized at ${version.runtimeVersion || version.buildId || "unknown version"}.` },
      { area: "Company", status: extractStatus(companyIdentity, "Prometheus") || "No current local status marker found." }
    ],
    safety: {
      presentationOnly: true,
      noExternalApiCalls: true,
      secretsIncluded: false
    }
  };
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

async function handleVersion(_req, res) {
  const version = await readCompanionVersion();
  sendJson(res, 200, version);
}

async function handleFounderTimeline(_req, res) {
  sendJson(res, 200, await founderTimeline());
}

async function handleSocialInstagramSnapshot(_req, res) {
  if (typeof fetch !== "function") {
    sendJson(res, 503, {
      ok: false,
      sourceSubsystem: "Prometheus Social Media",
      error: "Fetch is unavailable in this local Companion backend."
    });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(SOCIAL_MEDIA_INSTAGRAM_SNAPSHOT_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    sendJson(res, response.ok ? 200 : response.status, {
      ok: response.ok,
      sourceSubsystem: "Prometheus Social Media",
      endpointType: "normalized-social-media-snapshot",
      snapshot: body?.snapshot || body
    });
  } catch {
    sendJson(res, 502, {
      ok: false,
      sourceSubsystem: "Prometheus Social Media",
      endpointType: "normalized-social-media-snapshot",
      error: "Normalized Instagram analytics snapshot is unavailable."
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function handleHealth(_req, res) {
  const version = await readCompanionVersion();
  sendJson(res, 200, {
    ok: true,
    server: {
      host: HOST,
      port: PORT,
      mode: "local-only"
    },
    tts: {
      elevenlabsConfigured: Boolean(process.env.ELEVENLABS_API_KEY),
      elevenlabsVoiceConfigured: Boolean(process.env.ELEVENLABS_VOICE_ID),
      defaultProvider: "elevenlabs",
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
    },
    version
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
    await handleHealth(req, res);
    return;
  }

  if (req.method === "GET" && req.url === "/api/version") {
    await handleVersion(req, res);
    return;
  }

  if (req.method === "GET" && req.url === "/api/founder/timeline") {
    await handleFounderTimeline(req, res);
    return;
  }

  if (req.method === "GET" && req.url === "/api/social/instagram/snapshot") {
    await handleSocialInstagramSnapshot(req, res);
    return;
  }

  if (req.method === "GET") {
    await serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.log(`Prometheus OS local backend already running at http://${HOST}:${PORT}`);
    if (isDirectRun) process.exit(0);
    return;
  }

  console.error("Prometheus OS local backend failed to start.");
  console.error(error?.message || error);
  if (isDirectRun) process.exit(1);
});
server.listen(PORT, HOST, () => {
  console.log(`Prometheus OS local backend running at http://${HOST}:${PORT}`);
});
