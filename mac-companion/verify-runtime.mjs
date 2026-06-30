#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const companionScriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(process.env.PROMETHEUS_PROJECT_ROOT || join(companionScriptDir, ".."));
const supportDir = resolve(process.env.PROMETHEUS_COMPANION_SUPPORT_DIR || join(process.env.HOME, "Library/Application Support/PrometheusCompanion"));
const reportPath = resolve(process.env.PROMETHEUS_COMPANION_REPORT || join(projectRoot, "mac-companion/reports/latest-companion-verification-report.md"));
const nodeBin = process.execPath;

const results = [];
const details = [];

function record(area, ok, detail, data = {}) {
  results.push({ area, ok, detail, data });
  const status = ok ? "PASS" : "FAIL";
  console.log(`${status} ${area}: ${detail}`);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function run(command, args, options = {}) {
  try {
    return {
      ok: true,
      stdout: execFileSync(command, args, {
        cwd: options.cwd || projectRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: options.timeout || 30_000
      })
    };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout?.toString() || "",
      stderr: error.stderr?.toString() || "",
      status: error.status
    };
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.text();
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, json, body };
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.text();
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, json, body };
}

function fileContains(path, needles) {
  if (!existsSync(path)) return false;
  const text = readFileSync(path, "utf8");
  return needles.every((needle) => text.includes(needle));
}

function generateSpeechSample(text) {
  const base = join(tmpdir(), `prometheus-founder-stt-${process.pid}`);
  const aiffPath = `${base}.aiff`;
  const wavPath = `${base}.wav`;
  const sayResult = run("/usr/bin/say", ["-o", aiffPath, text], { timeout: 30_000 });
  if (!sayResult.ok) return { ok: false, error: sayResult.stderr || "say command failed" };

  const convertResult = run("/usr/bin/afconvert", ["-f", "WAVE", "-d", "LEI16@16000", aiffPath, wavPath], {
    timeout: 30_000
  });
  if (!convertResult.ok) return { ok: false, error: convertResult.stderr || "afconvert command failed" };

  return { ok: existsSync(wavPath), wavPath };
}

async function verify() {
  const appPath = join(supportDir, "PrometheusCompanion.app");
  const executablePath = join(appPath, "Contents/MacOS/PrometheusCompanion");
  const runtimeRoot = join(supportDir, "prometheus-os");
  const sourceManifestPath = join(projectRoot, "mac-companion/companion-version.json");
  const installedManifestPath = join(supportDir, "companion-version.json");
  const runtimeManifestPath = join(runtimeRoot, "companion-runtime-version.json");
  const syncSummaryPath = join(supportDir, "companion-sync-summary.json");
  const runtimeSyncSummaryPath = join(runtimeRoot, "companion-sync-summary.json");
  const currentSourceManifestPath = join(tmpdir(), `prometheus-companion-current-source-${process.pid}.json`);
  run(nodeBin, [
    "mac-companion/create-version-manifest.mjs",
    "--project-root",
    projectRoot,
    "--support-dir",
    supportDir,
    "--scope",
    "source",
    "--output",
    currentSourceManifestPath
  ]);
  const sourceManifest = readJson(sourceManifestPath);
  const currentSourceManifest = readJson(currentSourceManifestPath);
  const installedManifest = readJson(installedManifestPath);
  const runtimeManifest = readJson(runtimeManifestPath);
  const syncSummary = readJson(syncSummaryPath);
  const currentSourceIssues = [];

  if (
    currentSourceManifest?.source?.companionFingerprint &&
    installedManifest?.source?.companionFingerprint &&
    currentSourceManifest.source.companionFingerprint !== installedManifest.source.companionFingerprint
  ) {
    currentSourceIssues.push({
      area: "source",
      expected: currentSourceManifest.source.companionFingerprint,
      actual: installedManifest.source.companionFingerprint,
      detail: "Current Companion source differs from the installed Companion build source."
    });
  }

  if (
    currentSourceManifest?.source?.runtimeFingerprint &&
    runtimeManifest?.runtime?.fingerprint &&
    currentSourceManifest.source.runtimeFingerprint !== runtimeManifest.runtime.fingerprint
  ) {
    currentSourceIssues.push({
      area: "runtime",
      expected: currentSourceManifest.source.runtimeFingerprint,
      actual: runtimeManifest.runtime.fingerprint,
      detail: "Current prometheus-os source differs from the installed Companion runtime."
    });
  }

  record("build", existsSync(executablePath), existsSync(executablePath)
    ? `native app executable exists at ${executablePath}`
    : `native app executable is missing at ${executablePath}`);

  record("install", existsSync(appPath) && existsSync(runtimeRoot), existsSync(appPath) && existsSync(runtimeRoot)
    ? `installed app and runtime exist under ${supportDir}`
    : `installed app or runtime missing under ${supportDir}`);

  const manifestsOk = Boolean(sourceManifest && installedManifest && runtimeManifest && syncSummary) &&
    existsSync(runtimeSyncSummaryPath);
  record("version-manifests", manifestsOk, manifestsOk
    ? "source, installed, runtime, and sync summary manifests exist"
    : "one or more Companion version/sync manifests are missing", {
      sourceManifest: existsSync(sourceManifestPath),
      installedManifest: existsSync(installedManifestPath),
      runtimeManifest: existsSync(runtimeManifestPath),
      syncSummary: existsSync(syncSummaryPath),
      runtimeSyncSummary: existsSync(runtimeSyncSummaryPath)
    });

  const envOk = syncSummary?.env?.preserved === true;
  record("env-preservation", envOk, envOk
    ? `installed backend .env preservation verified (${syncSummary.env.existsAfter ? "present" : "not present before or after"})`
    : "installed backend .env preservation failed or was not recorded", syncSummary?.env || {});

  const assetsOk = [
    join(appPath, "Contents/Resources/PrometheusCompanion.icns"),
    join(appPath, "Contents/Resources/companion-version.json"),
    join(runtimeRoot, "index.html"),
    join(runtimeRoot, "app.js"),
    join(runtimeRoot, "voice-assistant.js"),
    join(runtimeRoot, "vendor/three.module.js")
  ].every((path) => existsSync(path));
  record("assets", assetsOk, assetsOk
    ? "native app resources and runtime assets are installed"
    : "one or more native app resources or runtime assets are missing");

  const versionOk = Boolean(sourceManifest && installedManifest && runtimeManifest) &&
    sourceManifest.buildId === installedManifest.buildId &&
    installedManifest.buildId === runtimeManifest.buildId &&
    installedManifest.sync?.inSync === true &&
    runtimeManifest.sync?.inSync === true &&
    currentSourceIssues.length === 0;
  record("synchronization", versionOk, versionOk
    ? `source, installed, and runtime versions match: ${runtimeManifest?.buildId}`
    : "version manifests are missing or out of sync", {
      source: sourceManifest?.sourceVersion || "missing",
      installed: installedManifest?.installedVersion || "missing",
      runtime: runtimeManifest?.runtimeVersion || "missing",
      installedOutOfSync: installedManifest?.sync?.outOfSync || [],
      runtimeOutOfSync: runtimeManifest?.sync?.outOfSync || [],
      currentSourceOutOfSync: currentSourceIssues
    });

  try {
    const staticResponse = await fetch("http://127.0.0.1:8791/prometheus-os/", { cache: "no-store" });
    const text = await staticResponse.text();
    record("startup", staticResponse.ok && text.includes("Prometheus OS"), `static runtime HTTP ${staticResponse.status}`);
  } catch (error) {
    record("startup", false, `static runtime is not reachable: ${error?.message || error}`);
  }

  try {
    const health = await fetchJson("http://127.0.0.1:8792/api/health");
    const ok = health.ok && health.json?.ok === true;
    record("diagnostics", ok, ok ? "backend /api/health returned ok" : `backend /api/health failed with HTTP ${health.status}`, health.json || {});
    details.push({ area: "backend-health", value: health.json || health.body });
  } catch (error) {
    record("diagnostics", false, `backend health is not reachable: ${error?.message || error}`);
  }

  const routing = run(nodeBin, ["scripts/verify-prometheus-companion-ui-path.mjs"]);
  record("routing", routing.ok, routing.ok
    ? "Companion command routing harness passed"
    : "Companion command routing harness failed", {
      stdout: routing.stdout,
      stderr: routing.stderr
    });

  try {
    const memoryModule = await import(pathToFileURL(join(projectRoot, "prometheus-os/memory-system.js")));
    const summary = memoryModule.createMemorySystemSummary();
    const ok = Boolean(summary?.title && summary?.body && memoryModule.memoryEvents?.length > 0);
    record("memory", ok, ok
      ? `memory system returned ${memoryModule.memoryEvents.length} verified events`
      : "memory system did not return expected summary data");
  } catch (error) {
    record("memory", false, `memory verification failed: ${error?.message || error}`);
  }

  try {
    const { AIProvider } = await import(pathToFileURL(join(projectRoot, "prometheus-os/ai-provider.js")));
    const { resolveCompanionCommandRoute } = await import(pathToFileURL(join(projectRoot, "prometheus-os/companion-command-router.js")));
    const provider = new AIProvider();
    const phrase = "Prometheus, what should I do next?";
    const route = resolveCompanionCommandRoute({ command: phrase, history: provider.history });
    const response = await provider.ask(phrase);
    const ok = route.type === "cognitive" &&
      response.metadata?.routeSelected === "intelligence_orchestrator" &&
      Boolean(response.title && response.body);
    record("reasoning", ok, ok
      ? "founder reasoning routes to Intelligence Orchestrator"
      : "founder reasoning did not route through Intelligence Orchestrator", {
        routeType: route.type,
        routeSelected: response.metadata?.routeSelected,
        title: response.title
      });
  } catch (error) {
    record("reasoning", false, `reasoning verification failed: ${error?.message || error}`);
  }

  try {
    const { AIProvider } = await import(pathToFileURL(join(projectRoot, "prometheus-os/ai-provider.js")));
    const provider = new AIProvider();
    const first = await provider.ask("Prometheus, who is Anthony?");
    const followUp = await provider.ask("Why is he important?");
    const ok = provider.history.length >= 2 &&
      Boolean(first.body) &&
      Boolean(followUp.body) &&
      !String(followUp.title || "").toLowerCase().includes("project context");
    record("conversation-flow", ok, ok
      ? "multi-turn founder conversation produces contextual follow-up"
      : "multi-turn founder conversation did not preserve useful context", {
        turns: provider.history.length,
        firstTitle: first.title,
        followUpTitle: followUp.title
      });
  } catch (error) {
    record("conversation-flow", false, `conversation flow verification failed: ${error?.message || error}`);
  }

  try {
    const { createDailyBrief } = await import(pathToFileURL(join(projectRoot, "prometheus-os/daily-brief.js")));
    const brief = createDailyBrief();
    const body = String(brief.body || "");
    const ok = brief.title === "Daily Founder Brief" &&
      body.includes("Highest ROI task") &&
      body.includes("Recommended focus");
    record("founder-briefing", ok, ok
      ? "Daily Founder Brief generated with ROI and recommended focus"
      : "Daily Founder Brief did not include expected founder briefing fields", brief);
  } catch (error) {
    record("founder-briefing", false, `founder briefing verification failed: ${error?.message || error}`);
  }

  const voiceOk = fileContains(join(runtimeRoot, "voice-assistant.js"), [
    "good morning prometheus",
    "hey prometheus",
    "prometheus"
  ]) && fileContains(join(runtimeRoot, "app.js"), [
    "window.prometheusOSStartListening",
    "http://127.0.0.1:8792/api/stt",
    "http://127.0.0.1:8792/api/tts"
  ]);
  record("voice", voiceOk, voiceOk
    ? "wake phrases and local STT/TTS paths are present in installed runtime"
    : "installed runtime is missing expected voice paths");

  try {
    const response = await fetch("http://127.0.0.1:8792/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "openai",
        text: "Prometheus founder acceptance voice test."
      })
    });
    const audio = Buffer.from(await response.arrayBuffer());
    const ok = response.ok &&
      audio.length > 1024 &&
      String(response.headers.get("content-type") || "").startsWith("audio/");
    record("tts", ok, ok
      ? `OpenAI TTS returned ${audio.length} audio bytes`
      : `OpenAI TTS failed with HTTP ${response.status}`, {
        status: response.status,
        bytes: audio.length,
        contentType: response.headers.get("content-type")
      });
  } catch (error) {
    record("tts", false, `TTS verification failed: ${error?.message || error}`);
  }

  try {
    const sample = generateSpeechSample("Prometheus founder acceptance speech test");
    if (!sample.ok) {
      record("stt", false, `STT sample generation failed: ${sample.error || "unknown error"}`);
    } else {
      const audio = readFileSync(sample.wavPath);
      const response = await fetch("http://127.0.0.1:8792/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": "audio/wav",
          "X-Prometheus-STT-Provider": "openai"
        },
        body: audio
      });
      const body = await response.json().catch(() => ({}));
      const text = String(body.text || "").toLowerCase();
      const ok = response.ok &&
        body.provider === "openai" &&
        text.includes("prometheus") &&
        text.includes("founder") &&
        text.includes("test");
      record("stt", ok, ok
        ? `OpenAI STT transcribed generated speech sample: ${body.text}`
        : `OpenAI STT failed or returned unexpected transcript with HTTP ${response.status}`, {
          status: response.status,
          provider: body.provider,
          text: body.text,
          error: body.error
        });
    }
  } catch (error) {
    record("stt", false, `STT verification failed: ${error?.message || error}`);
  }

  try {
    const assistant = await postJson("http://127.0.0.1:8792/api/assistant", {
      message: "Give me a concise founder readiness check for Prometheus Companion."
    });
    const text = String(assistant.json?.text || "");
    const ok = assistant.ok && text.length >= 40;
    record("assistant-conversation", ok, ok
      ? "backend assistant returned founder readiness response"
      : `backend assistant failed with HTTP ${assistant.status}`, {
        status: assistant.status,
        chars: text.length,
        error: assistant.json?.error
      });
  } catch (error) {
    record("assistant-conversation", false, `assistant conversation verification failed: ${error?.message || error}`);
  }

  try {
    const version = await fetchJson("http://127.0.0.1:8792/api/version");
    const ok = version.ok && version.json?.buildId === runtimeManifest?.buildId;
    record("version-display", ok, ok
      ? "backend exposes source, installed, and runtime version data"
      : "backend version endpoint did not match installed manifest", version.json || {});
  } catch (error) {
    record("version-display", false, `backend version endpoint is not reachable: ${error?.message || error}`);
  }

  const passed = results.filter((item) => item.ok).length;
  const failed = results.length - passed;
  mkdirSync(dirname(reportPath), { recursive: true });

  const lines = [
    "# Prometheus Companion Verification Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Project: ${projectRoot}`,
    `Runtime: ${supportDir}`,
    `Result: ${failed === 0 ? "PASS" : "FAIL"} (${passed}/${results.length})`,
    "",
    "## Versions",
    "",
    `- Source version: ${sourceManifest?.sourceVersion || "missing"}`,
    `- Installed version: ${installedManifest?.installedVersion || "missing"}`,
    `- Runtime version: ${runtimeManifest?.runtimeVersion || "missing"}`,
    `- Build ID: ${runtimeManifest?.buildId || installedManifest?.buildId || sourceManifest?.buildId || "missing"}`,
    "",
    "## Checks",
    "",
    ...results.map((item) => `- ${item.ok ? "PASS" : "FAIL"} ${item.area}: ${item.detail}`),
    "",
    "## Out Of Sync",
    ""
  ];

  const syncIssues = [
    ...currentSourceIssues,
    ...(installedManifest?.sync?.outOfSync || []),
    ...(runtimeManifest?.sync?.outOfSync || [])
  ];
  if (syncIssues.length) {
    for (const issue of syncIssues) {
      lines.push(`- ${issue.area}: expected ${issue.expected}; actual ${issue.actual}; ${issue.detail}`);
    }
  } else {
    lines.push("- None detected.");
  }

  lines.push("", "## Diagnostic Detail", "");
  for (const detail of details) {
    lines.push(`### ${detail.area}`, "", "```json", JSON.stringify(detail.value, null, 2), "```", "");
  }

  writeFileSync(reportPath, `${lines.join("\n")}\n`);
  console.log(`Report: ${reportPath}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

verify();
