import { companyState } from "./demo-data.js";
import { aiProvider } from "./ai-provider.js";
import { VoiceAssistant } from "./voice-assistant.js";
import { createPrometheusScene } from "./three-scene.js";
import { routeCommandToTool } from "./agent-actions.js";
import { getClarification, normalizeIntentText, routeCommandIntent } from "./intent-router.js";
import { resolveCompanionCommandRoute } from "./companion-command-router.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const voiceStatus = $("#voiceStatus");
const voiceDebug = $("#voiceDebug");
const buildMarker = $("#buildMarker");
const coreState = $("#coreState");
const detailPanel = $("#detailPanel");
const detailKicker = $("#detailKicker");
const detailTitle = $("#detailTitle");
const detailText = $("#detailText");
const detailActions = $("#detailActions");

const forceFounderVoiceDefaults = true;
const defaultPremiumTtsProvider = "elevenlabs";
const founderGreeting = "Good to see you. What are we working on today?";
const companionShell = Boolean(window.__PROMETHEUS_COMPANION_SHELL__);
const nativeCompanionCapture = false;

let continuousListeningEnabled = forceFounderVoiceDefaults
  ? true
  : localStorage.getItem("prometheus-os-continuous-voice") === "true";
let clapDetectionEnabled = forceFounderVoiceDefaults
  ? true
  : localStorage.getItem("prometheus-os-clap-detection") === "true";
let selectedVoiceName = localStorage.getItem("prometheus-os-voice") || "";
let selectedTtsProvider = forceFounderVoiceDefaults
  ? defaultPremiumTtsProvider
  : localStorage.getItem("prometheus-os-tts-provider") || defaultPremiumTtsProvider;
let lastSpokenText = "Prometheus active.";
let backendSttEnabled = true;
let backendSttStream = null;
let backendSttRecorder = null;
let backendSttBusy = false;
let backendSttLoopEnabled = false;
let backendSttLoopTimer = 0;
let backendSttPermissionRecoveryTimer = 0;
let microphonePermissionMonitorInstalled = false;
let lastBackendTranscript = "";
let lastBackendTranscriptAt = 0;
let currentPremiumAudio = null;
let isPrometheusSpeaking = false;
let commandInFlight = false;
let lastDebugMessage = "";
let webAudioPlaybackGeneration = 0;
let webAudioStallTimer = 0;
let lastCommandResult = null;
let activeRouteDecision = null;
let suppressCardRoutesUntil = 0;
let suppressCardRoutesReason = "";
let companionVersion = null;

if (forceFounderVoiceDefaults) {
  localStorage.setItem("prometheus-os-tts-provider", selectedTtsProvider);
}

const voice = new VoiceAssistant({
  onTranscript: (text) => {
    debugVoice("Heard", text, { kind: "ok" });
    if (isPrometheusSpeaking || commandInFlight) {
      debugVoice("Error", "Prometheus is already speaking or handling a command.", { kind: "warn" });
      return;
    }
    submitCommand(text, { source: "browser speech recognition" });
  },
  onWake: (text, wake) => handleWake(text, wake),
  onClap: () => handleClap(),
  onStateChange: (state) => {
    setVoiceState(state);
  },
  onDebug: (stage, message) => debugVoice(stage, message)
});

function debugVoice(stage, message = "", { kind = "info" } = {}) {
  const readable = message ? `${stage}: ${message}` : stage;
  if (readable === lastDebugMessage) return;
  lastDebugMessage = readable;
  console.info(`[Prometheus Voice] ${readable}`);
  try {
    window.webkit?.messageHandlers?.prometheusLog?.postMessage({
      stage,
      message: String(message || "").slice(0, 500),
      kind
    });
  } catch {
    // Native logging is available only inside Prometheus Companion.
  }
  const visibleStages = new Set([
    "Listening",
    "Thinking",
    "Speaking",
    "audio playback started",
    "audio playback completed",
    "playback error",
    "playback stalled",
    "microphone recovery",
    "microphone permission changed"
  ]);
  if (voiceDebug && visibleStages.has(stage)) {
    voiceDebug.textContent = readable;
    voiceDebug.dataset.kind = kind;
  }
}

function cleanSpeechCommand(value) {
  return String(value || "")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRouteCommand(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’‘']/g, "")
    .replace(/^prometheus\s+/i, "")
    .replace(/^hey\s+prometheus\s+/i, "")
    .replace(/^good\s+morning\s+prometheus\s+/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function commandFromTranscript(value) {
  const cleaned = cleanSpeechCommand(value);
  const wake = voice.extractWakeCommand(cleaned);
  if (wake.woke && wake.command) return cleanSpeechCommand(wake.command);
  return cleaned;
}

function shouldAttachRouteDiagnostic(message) {
  return false;
}

function routeDiagnosticText(commandRoute) {
  const routeSelected = commandRoute.decision?.routeType || (commandRoute.type === "cognitive" ? "intelligence_orchestrator" : commandRoute.type);
  const cognitiveEngineUsed = commandRoute.type === "cognitive" ? "yes" : "no";
  const cardFallbackUsed = commandRoute.decision?.allowCards === false ? "no" : (commandRoute.type === "node" ? "yes" : "no");
  return `Diagnostic: route selected ${routeSelected}. Cognitive engine used: ${cognitiveEngineUsed}. Card fallback used: ${cardFallbackUsed}.`;
}

function explicitPanelRequest(message = "", response = {}) {
  if (response.metadata?.developerMode === true) return true;
  const normalized = normalizeIntentText(message);
  return /\b(reports?|charts?|exports?|long form|long-form|longform|long analysis|long-form analysis|developer mode|technical details|show contracts?|show raw|raw output)\b/.test(normalized);
}

function shouldDisplayConversationPanel(message = "", response = {}) {
  return explicitPanelRequest(message, response) || response.metadata?.showCard === true;
}

async function loadCompanionVersion() {
  try {
    const response = await fetch("./companion-runtime-version.json", { cache: "no-store" });
    companionVersion = await response.json();
  } catch {
    companionVersion = {
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
            detail: "Companion runtime version manifest could not be loaded."
          }
        ]
      }
    };
  }

  if (!buildMarker) return companionVersion;

  const outOfSync = companionVersion.sync?.outOfSync || [];
  if (outOfSync.length) {
    buildMarker.textContent = `Companion out of sync: ${outOfSync.map((item) => item.area).join(", ")}`;
    buildMarker.title = outOfSync
      .map((item) => `${item.area}: expected ${item.expected}; actual ${item.actual}; ${item.detail}`)
      .join("\n");
    buildMarker.dataset.sync = "out-of-sync";
    return companionVersion;
  }

  buildMarker.textContent = `Companion synced ${companionVersion.runtimeVersion || companionVersion.buildId || "unknown"}`;
  buildMarker.title = [
    `Source version: ${companionVersion.sourceVersion || "missing"}`,
    `Installed version: ${companionVersion.installedVersion || "missing"}`,
    `Runtime version: ${companionVersion.runtimeVersion || "missing"}`
  ].join("\n");
  buildMarker.dataset.sync = "in-sync";
  return companionVersion;
}

function isIntelligenceDecision(decision) {
  return decision?.routeType === "intelligence_orchestrator";
}

function suppressCardRoutes(reason = "intelligence route selected", duration = 7000) {
  suppressCardRoutesUntil = Date.now() + duration;
  suppressCardRoutesReason = reason;
  debugVoice("card route blocked", reason, { kind: "ok" });
}

function clearCardSuppression() {
  suppressCardRoutesUntil = 0;
  suppressCardRoutesReason = "";
}

function cardRoutesSuppressed() {
  const activeBlocksCards = isIntelligenceDecision(activeRouteDecision) && activeRouteDecision.allowCards === false;
  return activeBlocksCards || Date.now() < suppressCardRoutesUntil;
}

function applyRouteDecision(decision) {
  activeRouteDecision = decision || null;
  if (isIntelligenceDecision(decision)) {
    suppressCardRoutes(decision.reason || "intelligence route selected");
    stopActiveAudio();
    closeDetail();
  }
}

function blockedCardRouteResult(type, nodeId, source) {
  return {
    type,
    routeSelected: activeRouteDecision?.routeType || "blocked",
    nodeId,
    cardFallbackUsed: false,
    reason: suppressCardRoutesReason || "intelligence route is exclusive",
    source
  };
}

function setVoiceState(state) {
  const friendly = {
    idle: continuousListeningEnabled ? "Listening" : "Standby",
    standby: "Standby",
    sleeping: "Sleeping",
    listening: "Listening",
    thinking: "Thinking",
    speaking: "Speaking",
    "type instead": "Voice unavailable",
    "already listening": "Listening",
    "voice recognition unavailable": "Voice unavailable",
    "clap unavailable": "Clap unavailable"
  }[state] || state;

  voiceStatus.textContent = friendly;
  coreState.textContent = friendly.toLowerCase();
  document.body.dataset.voice = state;
  if (["listening", "thinking", "speaking"].includes(state)) {
    const label = friendly === "Listening" ? "Listening" : friendly;
    if (voiceDebug) {
      voiceDebug.textContent = label;
      voiceDebug.dataset.kind = state === "speaking" ? "ok" : "info";
    }
  }
}

function handleWake(transcript, wakeDetails = null) {
  debugVoice("Wake phrase detected", transcript, { kind: "ok" });
  if (isPrometheusSpeaking || commandInFlight) {
    debugVoice("Error", "Wake phrase heard while Prometheus is busy.", { kind: "warn" });
    return;
  }
  const wake = wakeDetails || voice.extractWakeCommand(transcript);
  if (wake.command) {
    debugVoice("Command detected", wake.command, { kind: "ok" });
    submitCommand(wake.command, { source: "wake phrase" });
    return;
  }
  closeDetail();
  startBackendSttCapture({ source: "wake phrase", silentNoInput: true });
}

function handleClap() {
  if (isPrometheusSpeaking || commandInFlight) return;
  closeDetail();
  if (continuousListeningEnabled && !companionShell) voice.listen();
  startBackendSttCapture({ source: "clap", silentNoInput: true });
}

function scheduleBackendSttLoop(delay = 900) {
  window.clearTimeout(backendSttLoopTimer);
  if (!backendSttLoopEnabled || !continuousListeningEnabled) return;
  if (isPrometheusSpeaking || commandInFlight || backendSttBusy) {
    backendSttLoopTimer = window.setTimeout(() => scheduleBackendSttLoop(1200), 1200);
    return;
  }
  backendSttLoopTimer = window.setTimeout(() => {
    startBackendSttCapture({ source: "always listening", duration: 3200, silentNoInput: true });
  }, delay);
}

function startBackendSttLoop() {
  backendSttLoopEnabled = true;
  scheduleBackendSttLoop(900);
}

function stopBackendSttLoop(reason = "") {
  backendSttLoopEnabled = false;
  window.clearTimeout(backendSttLoopTimer);
  backendSttLoopTimer = 0;
  if (reason) debugVoice("Listening paused", reason, { kind: "ok" });
}

function systemNodes() {
  return [
    {
      id: "memory",
      label: "Memory",
      value: "Context",
      signal: "ready",
      detail: "Founder timeline, long-term goals, Active Pool decision recall, and where-we-left-off context.",
      command: "Prometheus, catch me up on where we left off."
    },
    {
      id: "tasks",
      label: "Tasks",
      value: "Priority",
      signal: "ready",
      detail: "Highest ROI task, production blockers, day planning, and engineering versus sales focus.",
      command: "Prometheus, what should I focus on today?"
    },
    {
      id: "calendar",
      label: "Calendar",
      value: "Agenda",
      signal: "pending",
      detail: "Meetings, reminders, and daily agenda support for founder planning.",
      command: "Prometheus, remind me what meetings I have."
    },
    {
      id: "messages",
      label: "Messages",
      value: "Drafts",
      signal: "ready",
      detail: "Message summaries and draft support. Companion never sends without explicit approval.",
      command: "Prometheus, help me draft a message."
    },
    {
      id: "prometheus-iq",
      label: "Prometheus IQ",
      value: "Product",
      signal: "ready",
      detail: "Product state, Dashboard/Data boundary, Route Intelligence relationship, and pilot readiness context.",
      command: "Prometheus, how does the Dashboard interact with the Data subsystem?"
    },
    {
      id: "overwatch",
      label: "Overwatch",
      value: "Assignments",
      signal: "ready",
      detail: "Next subsystem assignment, blocker awareness, verification discipline, and engineering handoff support.",
      command: "Prometheus, what should Overwatch assign next?"
    },
    {
      id: "analytics",
      label: "Analytics",
      value: "Signals",
      signal: "pending",
      detail: "Strategy critique, pricing direction, and proof metrics. Live customer analytics are not connected to Companion.",
      command: "Prometheus, what are weaknesses in my current strategy?"
    },
    {
      id: "strategy",
      label: "Strategy",
      value: "Founder",
      signal: "ready",
      detail: "Long-term goals, pricing, executive positioning, validation focus, and pilot proof logic.",
      command: "Prometheus, what are my long-term goals?"
    },
    {
      id: "voice-settings",
      label: "Voice",
      value: "Live",
      signal: "pending",
      detail: "Configure always-listening mode, browser voice selection, and future premium voice provider options.",
      command: "Prometheus, open voice settings."
    }
  ];
}

function renderNetwork() {
  const nodes = systemNodes();
  const total = nodes.length;

  $("#statusGrid").innerHTML = nodes.map((node, index) => {
    const angle = -90 + (360 / total) * index;
    const radius = index % 2 === 0 ? "clamp(205px, 23vw, 330px)" : "clamp(158px, 18vw, 270px)";
    return `
      <button
        class="system-node command-node"
        type="button"
        data-node-id="${node.id}"
        data-signal="${node.signal}"
        style="--angle: ${angle}deg; --radius: ${radius}; --delay: ${index * 0.16}s;"
      >
        <div class="status-meta">
          <span>${node.label}</span>
          <i>${node.signal}</i>
        </div>
        <strong>${node.value}</strong>
      </button>
    `;
  }).join("");
}

function scoreVoice(voiceItem) {
  const text = `${voiceItem.name} ${voiceItem.lang}`.toLowerCase();
  let score = 0;
  if (/en[-_]?us|en[-_]?gb|english/.test(text)) score += 12;
  if (/alex|daniel|david|fred|mark|aaron|guy|liam|ryan|matthew|brian|arthur|thomas/.test(text)) score += 18;
  if (/natural|neural|premium|enhanced|google|microsoft|samantha|ava/.test(text)) score += 10;
  if (/compact|robot|novelty|whisper|cellos|bells|zarvox/.test(text)) score -= 30;
  if (/male/.test(text)) score += 8;
  if (voiceItem.default) score += 2;
  return score;
}

function getBestVoice() {
  return voice.loadVoices()
    .filter((item) => /en/i.test(item.lang || item.name))
    .sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null;
}

function ensureBestVoiceSelected() {
  if (selectedVoiceName) {
    voice.setVoice(selectedVoiceName);
    return;
  }
  const best = getBestVoice();
  if (best) {
    selectedVoiceName = best.name;
    localStorage.setItem("prometheus-os-voice", selectedVoiceName);
    voice.setVoice(selectedVoiceName);
  }
}

function openDetail({ kicker = "Prometheus signal", title, text, actions = "" }) {
  detailKicker.textContent = kicker;
  detailTitle.textContent = title;
  detailText.textContent = text;
  detailActions.innerHTML = actions;
  detailPanel.classList.add("is-open");
  detailPanel.setAttribute("aria-hidden", "false");
}

function closeDetail() {
  detailPanel.classList.remove("is-open");
  detailPanel.setAttribute("aria-hidden", "true");
}

function normalizeCommandText(value) {
  return normalizeIntentText(
    String(value || "")
      .replace(/\b(show me|show|open|review|status|about|what is|what's|tell me|please)\b/gi, " ")
  );
}

function nodePhrases(node) {
  const base = normalizeCommandText(`${node.label} ${node.value} ${node.id}`);
  const aliases = {
    memory: ["open memory node", "founder memory", "company memory", "where we left off", "active pool", "long term goals"],
    tasks: ["show tasks node", "open tasks node", "priority", "priorities", "what should i focus on today", "highest priority"],
    calendar: ["calendar", "meetings", "schedule", "plan my day"],
    messages: ["messages", "message", "draft message", "email", "write a message"],
    "prometheus-iq": ["open prometheus iq node", "prometheus iq", "dashboard data", "dashboard and data", "route intelligence", "product status"],
    overwatch: ["overwatch", "assign next", "next subsystem", "handoff"],
    analytics: ["analytics", "metrics", "strategy critique", "weaknesses", "pricing"],
    strategy: ["strategy", "founder strategy", "long term goals", "pricing direction"],
    "voice-settings": ["voice settings", "voice", "settings", "tts", "stt"]
  }[node.id] || [];

  return [base, ...aliases].map(normalizeCommandText).filter(Boolean);
}

function voiceSettingsMarkup() {
  const voices = voice.loadVoices()
    .filter((item) => /en/i.test(item.lang || item.name))
    .sort((a, b) => scoreVoice(b) - scoreVoice(a));
  ensureBestVoiceSelected();
  const bestVoice = getBestVoice();
  const options = [
    `<option value="">Default system voice</option>`,
    ...voices.map((item) => {
      const naturalLabel = item.name === bestVoice?.name ? " - recommended" : "";
      return `<option value="${item.name}" ${item.name === selectedVoiceName ? "selected" : ""}>${item.name} (${item.lang})${naturalLabel}</option>`;
    })
  ].join("");

  const listeningChecked = continuousListeningEnabled ? "checked" : "";
  const clapChecked = clapDetectionEnabled ? "checked" : "";
  const selectedVoice = voices.find((item) => item.name === selectedVoiceName) || bestVoice;
  const providerOptions = [
    ["browser", "Browser voice fallback"],
    ["openai", "OpenAI premium voice via local backend"],
    ["elevenlabs", "ElevenLabs premium voice via local backend"]
  ].map(([value, label]) => `<option value="${value}" ${value === selectedTtsProvider ? "selected" : ""}>${label}</option>`).join("");
  const voiceQualityNote = selectedVoice
    ? `Selected voice: ${selectedVoice.name}. Browser voices vary by Mac/browser; if this still sounds robotic, premium backend TTS is the next upgrade.`
    : "No natural browser voice was detected. Premium backend TTS is the next upgrade.";
  return `
    <div class="settings-stack">
      <span class="voice-quality">${voiceQualityNote}</span>
      <label class="settings-label" for="ttsProviderSelect">Voice provider</label>
      <select id="ttsProviderSelect" aria-label="Voice provider">${providerOptions}</select>
      <label class="toggle-row">
        <input id="continuousVoiceToggle" type="checkbox" ${listeningChecked}>
        Always listen when browser permission is enabled
      </label>
      <label class="toggle-row">
        <input id="clapDetectionToggle" type="checkbox" ${clapChecked}>
        Clap detection wake signal
      </label>
      <label class="settings-label" for="voiceSelect">AI voice</label>
      <select id="voiceSelect" aria-label="Voice selection">${options}</select>
      <p class="settings-note">
        Browser voice depends on Chrome/Safari and installed system voices. Future premium voice APIs should run backend-only with server-side secrets.
      </p>
      <div class="voice-provider-list">
        <span>Current: Browser Speech Recognition + SpeechSynthesis fallback</span>
        <span>Premium: OpenAI TTS / Realtime through local backend only</span>
        <span>Premium: ElevenLabs-style TTS through local backend only</span>
        <span>Rule: no API keys in frontend, Git, or browser logs</span>
      </div>
      <button class="panel-command" type="button" id="testVoiceButton">Test Voice: Founder Greeting</button>
    </div>
  `;
}

function bindDetailActions() {
  const toggle = $("#continuousVoiceToggle");
  const clapToggle = $("#clapDetectionToggle");
  const select = $("#voiceSelect");
  const providerSelect = $("#ttsProviderSelect");

  if (toggle) {
    toggle.addEventListener("change", () => {
      continuousListeningEnabled = toggle.checked;
      localStorage.setItem("prometheus-os-continuous-voice", String(continuousListeningEnabled));
      if (continuousListeningEnabled) {
        const started = voice.startAlwaysListening();
        openDetail({
          kicker: "Voice settings",
          title: "Always-listening mode",
          text: started
            ? "Prometheus is listening. Browser permission controls whether continuous speech recognition can run."
            : "Voice recognition is unavailable in this browser. Prometheus will still respond when commands are typed or nodes are clicked.",
          actions: voiceSettingsMarkup()
        });
        bindDetailActions();
      } else {
        voice.stopAlwaysListening();
        setVoiceState("idle");
      }
    });
  }

  if (clapToggle) {
    clapToggle.addEventListener("change", async () => {
      clapDetectionEnabled = clapToggle.checked;
      localStorage.setItem("prometheus-os-clap-detection", String(clapDetectionEnabled));
      if (clapDetectionEnabled) {
        const started = await voice.startClapDetection();
        openDetail({
          kicker: "Voice settings",
          title: "Clap detection",
          text: started
            ? "Clap detection is active while this page is open. Browser microphone permission controls whether it can run."
            : "Clap detection is unavailable in this browser or microphone permission was not granted.",
          actions: voiceSettingsMarkup()
        });
        bindDetailActions();
      } else {
        voice.stopClapDetection();
      }
    });
  }

  if (select) {
    select.addEventListener("change", () => {
      selectedVoiceName = select.value;
      localStorage.setItem("prometheus-os-voice", selectedVoiceName);
      voice.setVoice(selectedVoiceName);
      voice.speak("Prometheus voice selected.");
    });
  }

  if (providerSelect) {
    providerSelect.addEventListener("change", () => {
      selectedTtsProvider = providerSelect.value;
      localStorage.setItem("prometheus-os-tts-provider", selectedTtsProvider);
      speakResponse(founderGreeting);
    });
  }

  const testVoiceButton = $("#testVoiceButton");
  if (testVoiceButton) {
    testVoiceButton.addEventListener("click", () => {
      speakResponse(founderGreeting);
    });
  }
}

function getSupportedAudioType() {
  if (!window.MediaRecorder) return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/wav"
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

async function getBackendSttStream() {
  if (backendSttStream?.active) return backendSttStream;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    throw new Error("Browser audio recording is unavailable.");
  }
  backendSttStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });
  debugVoice("microphone active", "backend STT stream ready", { kind: "ok" });
  return backendSttStream;
}

function isMicrophonePermissionError(errorOrMessage) {
  const value = String(errorOrMessage?.name || errorOrMessage?.message || errorOrMessage || "").toLowerCase();
  return value.includes("notallowed") ||
    value.includes("permission") ||
    value.includes("denied") ||
    value.includes("authorization") ||
    value.includes("not authorized");
}

async function readMicrophonePermissionState() {
  try {
    if (!navigator.permissions?.query) return "not detectable";
    const permission = await navigator.permissions.query({ name: "microphone" });
    return permission.state || "unknown";
  } catch {
    return "not detectable";
  }
}

function retryBackendSttAfterPermissionChange(reason = "microphone permission recovery") {
  if (!continuousListeningEnabled || isPrometheusSpeaking || commandInFlight) return;
  backendSttStream = null;
  debugVoice("microphone recovery", reason, { kind: "ok" });
  startBackendSttLoop();
  startBackendSttCapture({
    source: reason,
    silentNoInput: true
  });
}

function scheduleMicrophonePermissionRecovery(reason = "microphone permission unavailable") {
  window.clearTimeout(backendSttPermissionRecoveryTimer);
  backendSttPermissionRecoveryTimer = window.setTimeout(async () => {
    if (!continuousListeningEnabled || isPrometheusSpeaking || commandInFlight) return;

    const state = await readMicrophonePermissionState();
    debugVoice("microphone permission check", state, {
      kind: state === "denied" ? "warn" : "info"
    });

    if (state === "granted" || state === "prompt" || state === "not detectable" || state === "unknown") {
      retryBackendSttAfterPermissionChange(reason);
      return;
    }

    scheduleBackendSttLoop(2500);
  }, 1200);
}

async function installMicrophonePermissionMonitor() {
  if (microphonePermissionMonitorInstalled) return;
  microphonePermissionMonitorInstalled = true;

  try {
    if (navigator.permissions?.query) {
      const permission = await navigator.permissions.query({ name: "microphone" });
      permission.onchange = () => {
        debugVoice("microphone permission changed", permission.state || "unknown", {
          kind: permission.state === "granted" ? "ok" : "warn"
        });
        if (permission.state === "granted") {
          retryBackendSttAfterPermissionChange("microphone permission granted");
        }
      };
    }
  } catch {
    debugVoice("microphone permission monitor", "permission API unavailable in this WebView", { kind: "warn" });
  }

  window.addEventListener("focus", () => {
    scheduleMicrophonePermissionRecovery("window focus microphone recovery");
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleMicrophonePermissionRecovery("visibility microphone recovery");
  });
}

function stopBackendSttCapture() {
  if (backendSttRecorder?.state === "recording") {
    try {
      backendSttRecorder.stop();
    } catch {
      // Recorder may already be stopping.
    }
  }
  backendSttRecorder = null;
  backendSttBusy = false;
}

function stopActiveAudio() {
  webAudioPlaybackGeneration += 1;
  window.clearInterval(webAudioStallTimer);
  if (currentPremiumAudio) {
    try {
      currentPremiumAudio.pause();
      currentPremiumAudio.currentTime = 0;
    } catch {
      // Audio may already be released.
    }
    currentPremiumAudio = null;
  }
  isPrometheusSpeaking = false;
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function scheduleListeningAfterPlayback(delay = 900) {
  setVoiceState(continuousListeningEnabled ? "standby" : "sleeping");
  if (continuousListeningEnabled && !companionShell) voice.listen();
  scheduleBackendSttLoop(delay);
}

function playPremiumAudioBlob(blob, providerLabel) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const blobSize = Number.isFinite(blob.size) ? blob.size : 0;
    let settled = false;
    let lastCurrentTime = 0;
    let lastProgressAt = Date.now();
    let lastProgressLogAt = 0;

    window.clearInterval(webAudioStallTimer);
    currentPremiumAudio = audio;
    webAudioPlaybackGeneration += 1;
    const generation = webAudioPlaybackGeneration;

    debugVoice(
      "audio blob received",
      `${providerLabel} ${blobSize.toLocaleString()} bytes`,
      { kind: "ok" }
    );

    const cleanup = (ok, label, message, delay = 900) => {
      if (settled) return;
      settled = true;
      webAudioPlaybackGeneration += 1;
      window.clearInterval(webAudioStallTimer);
      URL.revokeObjectURL(url);
      if (currentPremiumAudio === audio) currentPremiumAudio = null;
      isPrometheusSpeaking = false;

      debugVoice(label, message, { kind: ok ? "ok" : "warn" });
      scheduleListeningAfterPlayback(delay);
      resolve(ok);
    };

    audio.preload = "auto";
    audio.addEventListener("loadedmetadata", () => {
      const duration = Number.isFinite(audio.duration) && audio.duration > 0
        ? `${audio.duration.toFixed(1)}s`
        : "duration pending";
      debugVoice("audio duration detected", duration, { kind: "ok" });
    });

    audio.addEventListener("canplaythrough", () => {
      debugVoice("audio buffer ready", providerLabel, { kind: "ok" });
    });

    audio.addEventListener("play", () => {
      isPrometheusSpeaking = true;
      lastCurrentTime = audio.currentTime || 0;
      lastProgressAt = Date.now();
      debugVoice("audio playback started", providerLabel, { kind: "ok" });
      setVoiceState("speaking");
    });

    audio.addEventListener("timeupdate", () => {
      const current = audio.currentTime || 0;
      const duration = Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : 0;
      lastCurrentTime = current;
      lastProgressAt = Date.now();

      if (Date.now() - lastProgressLogAt > 2500) {
        const progress = duration
          ? `${current.toFixed(1)}s / ${duration.toFixed(1)}s`
          : `${current.toFixed(1)}s`;
        debugVoice("playback progress", progress, { kind: "info" });
        lastProgressLogAt = Date.now();
      }
    });

    audio.addEventListener("ended", () => {
      cleanup(true, "audio playback completed", providerLabel);
    });

    audio.addEventListener("error", () => {
      const reason = audio.error?.message || "Premium audio playback failed.";
      cleanup(false, "playback error", reason, 1200);
    });

    webAudioStallTimer = window.setInterval(() => {
      if (webAudioPlaybackGeneration !== generation || settled) {
        window.clearInterval(webAudioStallTimer);
        return;
      }

      if (audio.ended) {
        cleanup(true, "audio playback completed", providerLabel);
        return;
      }

      if (audio.paused && isPrometheusSpeaking) {
        cleanup(false, "playback interrupted", "Audio paused before completion.", 1200);
        return;
      }

      const current = audio.currentTime || 0;
      if (!audio.paused && Math.abs(current - lastCurrentTime) > 0.05) {
        lastCurrentTime = current;
        lastProgressAt = Date.now();
        return;
      }

      if (!audio.paused && Date.now() - lastProgressAt > 9000) {
        try {
          audio.pause();
        } catch {
          // Audio may already be released.
        }
        cleanup(false, "playback stalled", "No audio progress detected for 9 seconds.", 1200);
      }
    }, 1500);

    audio.play().catch((error) => {
      cleanup(false, "playback error", error?.message || "Audio playback could not start.", 1200);
    });
  });
}

async function startBackendSttCapture({ duration = 4200, source = "manual", silentNoInput = false } = {}) {
  if (!backendSttEnabled || backendSttBusy) return false;
  if (isPrometheusSpeaking || commandInFlight) return false;

  try {
    backendSttBusy = true;
    debugVoice("Listening", `capturing ${source} command audio`);
    setVoiceState("listening");
    const stream = await getBackendSttStream();
    const mimeType = getSupportedAudioType();
    const options = mimeType ? { mimeType } : undefined;
    const recorder = new MediaRecorder(stream, options);
    const chunks = [];
    backendSttRecorder = recorder;

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size) chunks.push(event.data);
    });

    const transcriptPromise = new Promise((resolve) => {
      recorder.addEventListener("stop", async () => {
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
          if (blob.size < 1200) {
            debugVoice("no command audio", `captured ${blob.size} bytes from ${source}`, { kind: "warn" });
            resolve({ ok: false, error: "No usable command audio was captured." });
            return;
          }

          setVoiceState("thinking");
          debugVoice("speech recognition transcript", "sending audio to local STT");
          const response = await fetch("http://127.0.0.1:8792/api/stt", {
            method: "POST",
            headers: {
              "Content-Type": blob.type || "audio/webm",
              "X-Prometheus-STT-Provider": "auto"
            },
            body: blob
          });

          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            debugVoice("error/fallback reason", payload.error || "Speech transcription failed.", { kind: "error" });
            resolve({ ok: false, error: payload.error || "Speech transcription failed." });
            return;
          }

          debugVoice("STT response received", String(payload.text || "").trim(), { kind: "ok" });
          resolve({ ok: true, text: String(payload.text || "").trim() });
        } catch {
          debugVoice("error/fallback reason", "Speech transcription failed.", { kind: "error" });
          resolve({ ok: false, error: "Speech transcription failed." });
        }
      }, { once: true });
    });

    recorder.start();
    window.setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, duration);

    const result = await Promise.race([
      transcriptPromise,
      new Promise((resolve) => {
        window.setTimeout(() => {
          try {
            if (recorder.state === "recording") recorder.stop();
          } catch {
            // Recorder may already be stopped by the normal capture timer.
          }
          resolve({ ok: false, error: "Speech capture timed out." });
        }, duration + 5000);
      })
    ]);
    backendSttBusy = false;
    backendSttRecorder = null;

    if (!result.ok) {
      setVoiceState(continuousListeningEnabled ? "standby" : "sleeping");
      debugVoice("no command detected", result.error || "No command was detected.", { kind: "warn" });
      if (!silentNoInput) {
        openDetail({
          kicker: "Speech capture",
          title: "I did not catch that",
          text: `${result.error || "No command was detected."} Try saying a short command like “pilot readiness.”`
        });
      }
      scheduleBackendSttLoop(700);
      return false;
    }

    const transcript = result.text;
    debugVoice("Heard", transcript, { kind: "ok" });
    const now = Date.now();
    if (!transcript) {
      setVoiceState(continuousListeningEnabled ? "standby" : "sleeping");
      scheduleBackendSttLoop(700);
      return false;
    }
    if (transcript === lastBackendTranscript && now - lastBackendTranscriptAt < 5000) {
      setVoiceState(continuousListeningEnabled ? "standby" : "sleeping");
      scheduleBackendSttLoop(700);
      return true;
    }

    lastBackendTranscript = transcript;
    lastBackendTranscriptAt = now;
    stopBackendSttLoop("accepted command transcript");
    await submitCommand(transcript, { source: "backend STT" });
    if (continuousListeningEnabled) startBackendSttLoop();
    return true;
  } catch (error) {
    backendSttBusy = false;
    backendSttRecorder = null;
    setVoiceState("voice recognition unavailable");
    const reason = error?.message || "Prometheus could not access the browser microphone recorder.";
    debugVoice("Error", reason, { kind: "error" });
    openDetail({
      kicker: "Speech capture",
      title: "Browser speech capture unavailable",
      text: `${reason} Prometheus Companion uses the local WebView microphone recorder and sends audio to the local STT backend.`
    });
    if (isMicrophonePermissionError(error || reason)) {
      scheduleMicrophonePermissionRecovery(reason);
    }
    scheduleBackendSttLoop(2500);
    return false;
  }
}

function openNode(nodeId, { autoAsk = true } = {}) {
  const node = systemNodes().find((item) => item.id === nodeId);
  if (!node) return;

  if (cardRoutesSuppressed()) {
    debugVoice("card route blocked", `node:${nodeId} ${suppressCardRoutesReason}`.trim(), { kind: "warn" });
    lastCommandResult = blockedCardRouteResult("blocked_node", nodeId, "openNode");
    return lastCommandResult;
  }

  if (node.id === "voice-settings") {
    openDetail({
      kicker: "Voice settings",
      title: "Prometheus voice layer",
      text: "Prometheus can listen continuously after browser permission is granted and can answer back automatically using the selected browser voice.",
      actions: voiceSettingsMarkup()
    });
    bindDetailActions();
    return;
  }

  openDetail({
    kicker: "Company signal",
    title: node.label,
    text: `${node.value}. ${node.detail}`
  });

  if (autoAsk) {
    speakNodeStatus(node, { source: "node click" });
  }
}

function nodeResponseText(node) {
  return `${node.label}. ${node.value}. ${node.detail}`;
}

async function speakNodeStatus(node, { source = "node" } = {}) {
  if (!node || commandInFlight) return;
  if (cardRoutesSuppressed()) {
    debugVoice("card TTS blocked", `node:${node.id} ${suppressCardRoutesReason}`.trim(), { kind: "warn" });
    lastCommandResult = blockedCardRouteResult("blocked_node_tts", node.id, source);
    return lastCommandResult;
  }
  commandInFlight = true;
  try {
    const text = nodeResponseText(node);
    debugVoice("command route selected", `node:${node.id} confidence:1 source:${source}`, { kind: "ok" });
    debugVoice("response text generated", node.label, { kind: "ok" });
    lastSpokenText = text;
    openDetail({
      kicker: "Company signal",
      title: node.label,
      text: `${node.value}. ${node.detail}`
    });
    await speakResponse(lastSpokenText);
    lastCommandResult = {
      type: "node",
      routeSelected: "node",
      nodeId: node.id,
      title: node.label,
      body: `${node.value}. ${node.detail}`,
      cardFallbackUsed: true,
      source
    };
    return lastCommandResult;
  } finally {
    commandInFlight = false;
  }
}

async function submitCommand(raw, { skipNodeRouting = false, source = "command" } = {}) {
  const message = commandFromTranscript(raw);
  if (!message) return;
  if (commandInFlight) {
    debugVoice("Error", "Command already in progress.", { kind: "warn" });
    return;
  }

  debugVoice("command detected", `${source}: ${message}`, { kind: "ok" });
  const normalized = normalizeIntentText(message);
  debugVoice("normalized transcript", normalized || "(empty)", { kind: "ok" });

  const commandRoute = resolveCompanionCommandRoute({
    command: message,
    history: aiProvider.history,
    skipNodeRouting,
    nodes: systemNodes(),
    phrasesForNode: nodePhrases
  });
  const routedIntent = commandRoute.routedIntent || routeCommandIntent(message);
  const shouldReason = commandRoute.type === "cognitive";
  applyRouteDecision(commandRoute.decision);
  debugVoice(
    "matched intent",
    `${shouldReason ? "intelligence_orchestrator" : routedIntent.intent} confidence:${commandRoute.confidence.toFixed(2)} reason:${commandRoute.reason}`,
    { kind: commandRoute.type !== "provider" || routedIntent.type !== "unknown" ? "ok" : "warn" }
  );

  const clarification = commandRoute.type === "clarification" ? commandRoute.clarification : null;
  if (clarification && !skipNodeRouting) {
    if (!isIntelligenceDecision(commandRoute.decision)) clearCardSuppression();
    commandInFlight = true;
    try {
      debugVoice("command route selected", `clarification:${clarification.intent}`, { kind: "ok" });
      lastSpokenText = `${clarification.title}. ${clarification.body}`;
      closeDetail();
      await speakResponse(lastSpokenText);
      lastCommandResult = {
        type: "clarification",
        routeSelected: "clarification",
        intent: clarification.intent,
        title: clarification.title,
        body: clarification.body,
        cardFallbackUsed: false,
        source
      };
      return lastCommandResult;
    } finally {
      commandInFlight = false;
    }
  }

  const matchedNode = commandRoute.type === "node" ? commandRoute.matchedNode : null;
  if (matchedNode) {
    clearCardSuppression();
    debugVoice(
      "command route selected",
      `node:${matchedNode.nodeId} confidence:${matchedNode.confidence.toFixed(2)} reason:${matchedNode.reason}`,
      { kind: "ok" }
    );
    return speakNodeStatus(matchedNode.node, { source });
  }

  commandInFlight = true;
  try {
    setVoiceState("thinking");
    const routedTool = shouldReason
      ? "intelligence orchestrator"
      : routeCommandToTool(normalizeRouteCommand(message)) || "founder conversation";
    debugVoice("Matched command", routedTool, { kind: "ok" });
    const response = await aiProvider.ask(message);
    debugVoice("response text generated", response.title, { kind: "ok" });
    const diagnostic = shouldAttachRouteDiagnostic(message) ? `\n\n${routeDiagnosticText(commandRoute)}` : "";
    const responseBody = `${response.body}${diagnostic}`;
    lastSpokenText = response.metadata?.developerMode === true
      ? `${response.title}. ${responseBody}`
      : response.metadata?.spokenText || responseBody;
    const cardDisplayed = shouldDisplayConversationPanel(message, response);
    if (cardDisplayed) {
      openDetail({
        kicker: response.metadata?.developerMode === true ? "Developer Mode" : "Requested Output",
        title: response.title,
        text: responseBody
      });
    } else {
      closeDetail();
    }

    await speakResponse(lastSpokenText);
    lastCommandResult = {
      type: commandRoute.type,
      routeSelected: response.metadata?.routeSelected || (shouldReason ? "intelligence_orchestrator" : "provider"),
      title: response.title,
      body: responseBody,
      cognitive: response.metadata?.cognitive === true,
      orchestrator: response.metadata?.orchestrator === true,
      cardFallbackUsed: response.metadata?.cardFallbackUsed === true,
      cardDisplayed,
      source
    };
    return lastCommandResult;
  } finally {
    commandInFlight = false;
    if (!shouldReason) activeRouteDecision = null;
  }
}

function speakBrowserFallback(text) {
  return new Promise((resolve) => {
    if (!voice.canSpeak || !text) {
      resolve(false);
      return;
    }

    stopBackendSttCapture();
    window.clearInterval(webAudioStallTimer);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const selected = voice.voices.find((item) => item.name === selectedVoiceName);
    if (selected) utterance.voice = selected;
    utterance.rate = 0.9;
    utterance.pitch = 0.78;
    utterance.volume = 0.95;

    let settled = false;
    const finish = (ok, stage, message) => {
      if (settled) return;
      settled = true;
      isPrometheusSpeaking = false;
      voice.isSpeaking = false;
      debugVoice(stage, message, { kind: ok ? "ok" : "warn" });
      scheduleListeningAfterPlayback(ok ? 900 : 1200);
      resolve(ok);
    };

    utterance.onstart = () => {
      isPrometheusSpeaking = true;
      voice.isSpeaking = true;
      debugVoice("audio playback started", "browser fallback", { kind: "warn" });
      setVoiceState("speaking");
    };
    utterance.onend = () => {
      finish(true, "audio playback completed", "browser fallback");
    };
    utterance.onerror = (event) => {
      finish(false, "playback error", event?.error || "Browser fallback voice failed.");
    };

    window.speechSynthesis.speak(utterance);
  });
}

async function speakResponse(text) {
  if (!text) return false;
  stopActiveAudio();
  stopBackendSttCapture();

  if (selectedTtsProvider !== "browser") {
    try {
      setVoiceState("thinking");
      debugVoice("TTS request started", selectedTtsProvider, { kind: "ok" });
      const payload = {
        text,
        provider: selectedTtsProvider
      };

      if (selectedTtsProvider === "openai" && selectedVoiceName) {
        payload.preferredVoice = selectedVoiceName;
      }

      const response = await fetch("http://127.0.0.1:8792/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        debugVoice("TTS response received", `${selectedTtsProvider} audio ready`, { kind: "ok" });
        const blob = await response.blob();
        return await playPremiumAudioBlob(blob, selectedTtsProvider);
      }

      openDetail({
        kicker: "Premium voice fallback",
        title: "Premium voice not configured",
        text: "Premium voice not configured. Using browser voice fallback.",
        actions: voiceSettingsMarkup()
      });
      debugVoice("error/fallback reason", `Premium TTS returned HTTP ${response.status}.`, { kind: "warn" });
      bindDetailActions();
    } catch (error) {
      openDetail({
        kicker: "Premium voice fallback",
        title: "Local backend unavailable",
        text: "Premium voice backend is not running locally. Using browser voice fallback.",
        actions: voiceSettingsMarkup()
      });
      debugVoice("error/fallback reason", error?.message || "Local backend unavailable.", { kind: "warn" });
      bindDetailActions();
    }
  }

  debugVoice("TTS request started", "browser fallback", { kind: "warn" });
  const spoken = await speakBrowserFallback(text);
  if (!spoken) {
    openDetail({
      kicker: "Voice unavailable",
      title: "Browser voice is blocked",
      text: "This browser is not allowing text-to-speech right now. Use Voice Settings, check system volume, or try Chrome.",
      actions: voiceSettingsMarkup()
    });
    bindDetailActions();
  }
  return spoken;
}

function bindNetwork() {
  $("#detailClose").addEventListener("click", closeDetail);

  $("#statusGrid").addEventListener("click", (event) => {
    const node = event.target.closest("[data-node-id]");
    if (node) openNode(node.dataset.nodeId);
  });

  $("#prometheusCore").addEventListener("click", () => {
    openDetail({
      kicker: "Prometheus core",
      title: "Prometheus is active",
      text: companionShell
        ? "Prometheus Companion is using local WebView microphone capture. Say a short command like “pilot readiness.”"
        : "Prometheus is opening a secure speech capture window. Say a short command like “pilot readiness.”"
    });
    startBackendSttCapture({ source: "core" });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDetail();
    if (event.key === " " && event.target === document.body && !continuousListeningEnabled) {
      event.preventDefault();
      voice.listen();
    }
  });
}

function initVoice() {
  if (forceFounderVoiceDefaults) {
    continuousListeningEnabled = true;
    clapDetectionEnabled = true;
    localStorage.setItem("prometheus-os-continuous-voice", "true");
    localStorage.setItem("prometheus-os-clap-detection", "true");
  }

  voice.loadVoices();
  ensureBestVoiceSelected();
  setTimeout(ensureBestVoiceSelected, 500);
  installMicrophonePermissionMonitor();
  setVoiceState("idle");
  if (continuousListeningEnabled) {
    window.setTimeout(() => {
      if (!companionShell) {
        voice.startAlwaysListening();
        startBackendSttLoop();
      } else {
        debugVoice("Listening", "Companion WebView microphone capture owns STT in shell mode.", { kind: "ok" });
        startBackendSttLoop();
        startBackendSttCapture({
          source: "companion webview",
          silentNoInput: true
        });
      }
    }, 600);
  }
  if (clapDetectionEnabled) {
    window.setTimeout(() => voice.startClapDetection(), 900);
  }
}

function init() {
  renderNetwork();
  bindNetwork();
  initVoice();
  createPrometheusScene($("#holoCanvas"));
}

window.prometheusOSOpenNode = (nodeId) => {
  openNode(nodeId);
};

window.prometheusOSSubmitCommand = (command) => {
  return submitCommand(command, { source: "companion bridge" });
};

window.prometheusOSSetVoiceDebug = (stage, message = "", kind = "info") => {
  debugVoice(stage, message, { kind });
};

window.prometheusOSSuppressCardsForIntelligence = (reason = "native intelligence route selected") => {
  activeRouteDecision = {
    routeType: "intelligence_orchestrator",
    allowCards: false,
    allowNodes: false,
    allowTTSFromCards: false,
    cancelPendingCardUpdates: true,
    reason
  };
  suppressCardRoutes(reason);
  stopActiveAudio();
  closeDetail();
  return activeRouteDecision;
};

window.prometheusOSStartListening = (options = {}) => {
  continuousListeningEnabled = true;
  localStorage.setItem("prometheus-os-continuous-voice", "true");
  backendSttEnabled = true;
  installMicrophonePermissionMonitor();
  if (!companionShell) {
    voice.startAlwaysListening();
  }
  startBackendSttLoop();
  startBackendSttCapture({
    source: options.companionShell ? "companion webview" : "companion",
    silentNoInput: true
  });
  debugVoice(
    "Listening",
    companionShell
      ? "Companion WebView microphone capture owns STT in shell mode."
      : "Browser microphone capture owns STT.",
    { kind: "ok" }
  );
};

window.prometheusOSResolveRoute = (command) => {
  return resolveCompanionCommandRoute({
    command,
    history: aiProvider.history,
    nodes: systemNodes(),
    phrasesForNode: nodePhrases
  });
};

window.prometheusOSStartBackendSTT = () => {
  startBackendSttCapture({ source: "manual" });
};

window.prometheusOSDebugCommand = (command) => {
  return submitCommand(command, { source: "debug command" });
};

window.prometheusOSGetLastCommandResult = () => lastCommandResult;

window.prometheusOSHealthCheck = async () => {
  const browserSpeechRecognition = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const browserRecorder = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  let microphonePermission = "unknown";
  let backend = { ok: false, error: "not checked" };

  try {
    if (navigator.permissions?.query) {
      const permission = await navigator.permissions.query({ name: "microphone" });
      microphonePermission = permission.state || "unknown";
    }
  } catch {
    microphonePermission = "not detectable by this browser";
  }

  try {
    const response = await fetch("http://127.0.0.1:8792/api/health", { cache: "no-store" });
    backend = await response.json();
  } catch (error) {
    backend = { ok: false, error: error?.message || "Local backend health check failed." };
  }

  return {
    architecture: companionShell
      ? "companion-webview-mediarecorder-to-local-backend-stt"
      : "browser-mediarecorder-to-local-backend-stt",
    companionShell,
    nativeCompanionCapture,
    browserSpeechRecognition,
    browserRecorder,
    microphonePermission,
    voiceCommandRouter: {
      dailyBrief: routeCommandToTool(normalizeRouteCommand("Prometheus, give me today's brief")) === "createDailyBrief",
      progressLog: routeCommandToTool(normalizeRouteCommand("Prometheus, what changed today")) === "createProgressLogEntry",
      githubBackup: routeCommandToTool(normalizeRouteCommand("Prometheus, prepare GitHub backup")) === "createGithubBackupChecklist"
    },
    premiumTtsPlaybackPath: {
      provider: selectedTtsProvider,
      backendConfigured: Boolean(backend?.tts?.elevenlabsConfigured || backend?.tts?.openaiConfigured),
      browserAudioAvailable: typeof Audio !== "undefined"
    },
    version: companionVersion || backend?.version || null,
    backend
  };
};

loadCompanionVersion();
init();
