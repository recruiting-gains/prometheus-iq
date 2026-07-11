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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function postAudioWithRetry({ url, audio, headers, attempts = 3 }) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: audio
      });
      return { response, attempt };
    } catch (error) {
      lastError = error;
      await fetchJson("http://127.0.0.1:8792/api/health").catch(() => null);
      if (attempt < attempts) await sleep(900 * attempt);
    }
  }

  throw lastError || new Error("Audio POST failed.");
}

async function postJsonWithRetry(url, payload, attempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return { ...(await postJson(url, payload)), attempt };
    } catch (error) {
      lastError = error;
      await fetchJson("http://127.0.0.1:8792/api/health").catch(() => null);
      if (attempt < attempts) await sleep(900 * attempt);
    }
  }

  throw lastError || new Error("JSON POST failed.");
}

async function generateSpeechSampleWithRetry(text, attempts = 3) {
  let lastResult = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = generateSpeechSample(text);
    if (result.ok) return { ...result, attempt };
    lastResult = result;
    if (attempt < attempts) await sleep(700 * attempt);
  }

  return { ...(lastResult || { ok: false, error: "speech sample generation failed" }), attempt: attempts };
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
    join(runtimeRoot, "conversation-calibration.js"),
    join(runtimeRoot, "voice-assistant.js"),
    join(runtimeRoot, "vendor/three.module.js"),
    join(supportDir, "integrations/founder-communications-contract.js"),
    join(supportDir, "integrations/founder-communications-service.js"),
    join(supportDir, "social-media/contracts/social-media-contract.js"),
    join(supportDir, "social-media/social-media-analytics-service.js")
  ].every((path) => existsSync(path));
  record("assets", assetsOk, assetsOk
    ? "native app resources, calibration runtime, shared integration contract, and Social Media analytics contract are installed"
    : "one or more native app resources, calibration runtime, shared integration contract files, or Social Media analytics contract files are missing");

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
    const executiveRoute = ["intelligence_orchestrator", "founder_conversation_engine"].includes(response.metadata?.routeSelected);
    const ok = route.type === "cognitive" &&
      executiveRoute &&
      Boolean(response.title && response.body);
    record("reasoning", ok, ok
      ? `founder reasoning routes to ${response.metadata?.routeSelected}`
      : "founder reasoning did not route through an executive reasoning path", {
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
    const first = await provider.ask("Prometheus, what is Route IQ's current status?");
    const followUp = await provider.ask("Why is it the primary product?");
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
    const { AIProvider } = await import(pathToFileURL(join(projectRoot, "prometheus-os/ai-provider.js")));
    const {
      ConversationCalibration,
      createMemoryCalibrationStorage
    } = await import(pathToFileURL(join(projectRoot, "prometheus-os/conversation-calibration.js")));
    let calibrationNow = new Date("2026-07-10T09:00:00-05:00");
    const calibration = new ConversationCalibration({
      storage: createMemoryCalibrationStorage(),
      now: () => new Date(calibrationNow),
      scope: "runtime-verification"
    });
    const provider = new AIProvider({ conversationCalibration: calibration });
    const preference = await provider.ask("Keep it shorter.");
    const evidence = await provider.ask("Are you sure?");
    calibration.observeFounderInput("That was confusing.");
    calibration.observeFounderInput("That was confusing.");
    calibration.observeFounderInput("That was confusing.");
    calibrationNow = new Date("2026-07-11T09:00:00-05:00");
    const recommendation = calibration.runDailyReviewIfNeeded()?.recommendation;
    const pendingState = calibration.getState();
    const approval = recommendation?.id
      ? await provider.ask(`Approve recommendation ${recommendation.id}`)
      : null;
    const approvedState = calibration.getState();
    const serializedState = JSON.stringify(approvedState).toLowerCase();
    const ok = preference.metadata?.intent === "explicit_length_preference" &&
      evidence.metadata?.intent === "evidence_check" &&
      pendingState.preferences.responseLength?.value === "concise" &&
      pendingState.preferences.responseStructure === undefined &&
      pendingState.pendingRecommendations.length === 1 &&
      recommendation?.id &&
      approval?.metadata?.intent === "calibration_recommendation_approved" &&
      approvedState.preferences.responseStructure?.value === "answer-first" &&
      approvedState.preferences.responseStructure?.source === "founder-approved-inference" &&
      approvedState.decisionAudit.some((entry) => entry.action === "recommendation_approved") &&
      !serializedState.includes("keep it shorter") &&
      !serializedState.includes("are you sure") &&
      !serializedState.includes("that was confusing");
    record("conversation-calibration", ok, ok
      ? "neutral calibration, inert recommendation, identified Founder approval, audit trail, and abstract-only persistence passed"
      : "conversation calibration did not preserve expected approval, privacy, and preference behavior", {
        preferenceIntent: preference.metadata?.intent,
        evidenceIntent: evidence.metadata?.intent,
        recommendationId: recommendation?.id,
        approvalIntent: approval?.metadata?.intent,
        pendingPreferenceBeforeApproval: pendingState.preferences.responseStructure?.value || null,
        approvedPreference: approvedState.preferences.responseStructure?.value || null,
        rawTextPersisted: serializedState.includes("keep it shorter") ||
          serializedState.includes("are you sure") ||
          serializedState.includes("that was confusing")
      });
  } catch (error) {
    record("conversation-calibration", false, `conversation calibration verification failed: ${error?.message || error}`);
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
        provider: "elevenlabs",
        text: "Prometheus founder acceptance voice test."
      })
    });
    const audio = Buffer.from(await response.arrayBuffer());
    const provider = String(response.headers.get("x-prometheus-voice-provider") || "").toLowerCase();
    const ok = response.ok &&
      provider === "elevenlabs" &&
      audio.length > 1024 &&
      String(response.headers.get("content-type") || "").startsWith("audio/");
    record("tts", ok, ok
      ? `ElevenLabs TTS returned ${audio.length} audio bytes`
      : `ElevenLabs TTS failed with HTTP ${response.status}`, {
        status: response.status,
        provider,
        bytes: audio.length,
        contentType: response.headers.get("content-type")
      });
  } catch (error) {
    record("tts", false, `TTS verification failed: ${error?.message || error}`);
  }

  try {
    const sample = await generateSpeechSampleWithRetry("Prometheus founder acceptance speech test");
    if (!sample.ok) {
      record("stt", false, `STT sample generation failed after ${sample.attempt} attempts: ${sample.error || "unknown error"}`);
    } else {
      const audio = readFileSync(sample.wavPath);
      const { response, attempt } = await postAudioWithRetry({
        url: "http://127.0.0.1:8792/api/stt",
        audio,
        headers: {
          "Content-Type": "audio/wav",
          "X-Prometheus-STT-Provider": "openai"
        }
      });
      const body = await response.json().catch(() => ({}));
      const text = String(body.text || "").toLowerCase();
      const ok = response.ok &&
        body.provider === "openai" &&
        text.includes("prometheus") &&
        text.includes("founder") &&
        text.includes("test");
      record("stt", ok, ok
        ? `OpenAI STT transcribed generated speech sample on attempt ${attempt}: ${body.text}`
        : `OpenAI STT failed or returned unexpected transcript with HTTP ${response.status}`, {
          status: response.status,
          attempt,
          provider: body.provider,
          text: body.text,
          error: body.error
        });
    }
  } catch (error) {
    record("stt", false, `STT verification failed: ${error?.message || error}`);
  }

  try {
    const assistant = await postJsonWithRetry("http://127.0.0.1:8792/api/assistant", {
      message: "Give me a concise founder readiness check for Prometheus Companion."
    });
    const text = String(assistant.json?.text || "");
    const ok = assistant.ok && text.length >= 40;
    record("assistant-conversation", ok, ok
      ? `backend assistant returned founder readiness response on attempt ${assistant.attempt}`
      : `backend assistant failed with HTTP ${assistant.status}`, {
        status: assistant.status,
        attempt: assistant.attempt,
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

  try {
    const timeline = await fetchJson("http://127.0.0.1:8792/api/founder/timeline");
    const checkpointAreas = new Set((timeline.json?.checkpoints || []).map((item) => item.area));
    const requiredAreas = ["Overwatch", "Mobile", "Website", "Intelligence", "CRM", "Social", "Research", "Infrastructure", "Administration", "Companion"];
    const missingAreas = requiredAreas.filter((area) => !checkpointAreas.has(area));
    const ok = timeline.ok &&
      timeline.json?.ok === true &&
      timeline.json?.version?.runtimeVersion === runtimeManifest?.runtimeVersion &&
      timeline.json?.safety?.presentationOnly === true &&
      timeline.json?.safety?.noExternalApiCalls === true &&
      timeline.json?.safety?.secretsIncluded === false &&
      missingAreas.length === 0;
    record("founder-timeline", ok, ok
      ? "backend exposes a read-only founder timeline without external API calls or secrets"
      : "backend founder timeline is missing required read-only operating signals", {
        status: timeline.status,
        version: timeline.json?.version,
        missingAreas,
        safety: timeline.json?.safety,
        error: timeline.json?.error
      });
  } catch (error) {
    record("founder-timeline", false, `founder timeline endpoint is not reachable: ${error?.message || error}`);
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
