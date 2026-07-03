const NODE_CACHE_VERSION = "neural-galaxy-topic-synapse-20260702c";

const VIRTUAL_CAMERA = {
  zoom: 4.85,
  focusX: 0.515,
  focusY: 0.508,
  parallax: 0.18,
  driftX: 0.00007,
  driftY: 0.00006
};

const IMMERSIVE_SUBSTRATE_SIGNALS = 4600;
const IMMERSIVE_SUBSTRATE_PATHS = 1300;

const OPERATING_SYSTEMS = [
  { id: "prometheus", label: "Prometheus", color: "#6ff7af", weight: 1.2, aliases: ["prometheus", "company", "how are we doing"] },
  { id: "companion", label: "Companion", color: "#6ff7af", weight: 1.14, aliases: ["companion", "voice", "assistant"] },
  { id: "instagram", label: "Instagram", color: "#ff7a32", weight: 1.0, aliases: ["instagram", "followers", "reach", "post", "website clicks"] },
  { id: "website", label: "Website", color: "#ffb65d", weight: 0.98, aliases: ["website", "site", "attribution"] },
  { id: "crm", label: "CRM", color: "#ffd26d", weight: 0.98, aliases: ["crm", "sales", "lead", "pipeline"] },
  { id: "research", label: "Research", color: "#8db8ff", weight: 0.94, aliases: ["research", "market", "finding"] },
  { id: "memory", label: "Founder Memory", color: "#d6a0ff", weight: 0.98, aliases: ["memory", "decision", "where we left off"] },
  { id: "overwatch", label: "Overwatch", color: "#67e4c2", weight: 0.98, aliases: ["overwatch", "checkpoint", "status"] },
  { id: "codex", label: "Codex", color: "#67e4c2", weight: 0.88, aliases: ["codex", "engineering"] },
  { id: "intelligence", label: "Intelligence Engine", color: "#6fe8f7", weight: 0.98, aliases: ["intelligence", "prometheus iq", "reasoning"] },
  { id: "dashboard", label: "Dashboard", color: "#7fb6ff", weight: 0.78, aliases: ["dashboard"] },
  { id: "mobile", label: "Mobile", color: "#86f0bd", weight: 0.80, aliases: ["mobile", "field"] },
  { id: "infrastructure", label: "Infrastructure", color: "#62d2ff", weight: 0.94, aliases: ["infrastructure", "deployment"] },
  { id: "cloudflare", label: "Cloudflare", color: "#62d2ff", weight: 0.74, aliases: ["cloudflare", "worker"] },
  { id: "calendar", label: "Calendar", color: "#d6a0ff", weight: 0.74, aliases: ["calendar", "meeting", "schedule"] },
  { id: "administration", label: "Administration", color: "#f4d36b", weight: 0.70, aliases: ["administration", "admin"] },
  { id: "future-agents", label: "Future Agents", color: "#f4d36b", weight: 0.68, aliases: ["future agents"] },
  { id: "future-apis", label: "Future APIs", color: "#f4d36b", weight: 0.66, aliases: ["future api"] },
  { id: "future-customers", label: "Future Customers", color: "#f4d36b", weight: 0.66, aliases: ["future customers"] },
  { id: "future-learning", label: "Future Learning Signals", color: "#f4d36b", weight: 0.66, aliases: ["learning signals"] }
];

const OPERATING_SIGNALS = [
  "live state",
  "decision",
  "memory",
  "evidence",
  "risk",
  "priority",
  "handoff",
  "deployment",
  "commit",
  "quality",
  "latency",
  "attribution",
  "founder action",
  "field signal",
  "buyer signal",
  "learning"
];

const OPERATING_STATES = [
  "now",
  "today",
  "this week",
  "source",
  "installed",
  "runtime",
  "verified"
];

const OPERATING_EVENTS = [
  ["instagram", "website", "marketing signal attribution"],
  ["instagram", "crm", "social interest to lead flow"],
  ["website", "crm", "buyer path"],
  ["crm", "memory", "founder sales memory"],
  ["research", "website", "market language"],
  ["research", "intelligence", "reasoning evidence"],
  ["companion", "memory", "conversation continuity"],
  ["companion", "calendar", "founder planning"],
  ["companion", "overwatch", "executive engineering brief"],
  ["overwatch", "codex", "engineering assignment"],
  ["codex", "intelligence", "implementation reasoning"],
  ["intelligence", "dashboard", "product boundary"],
  ["dashboard", "mobile", "field experience"],
  ["mobile", "crm", "route evidence to buyer proof"],
  ["infrastructure", "cloudflare", "runtime delivery"],
  ["infrastructure", "companion", "installed runtime sync"],
  ["future-agents", "companion", "future assistant capability"],
  ["future-apis", "infrastructure", "future integration surface"],
  ["future-customers", "crm", "future pipeline"],
  ["future-learning", "intelligence", "future model improvement"]
];

const NEURAL_HOTSPOTS = [
  { id: "executive", x: 0.50, y: 0.50, radius: 0.30, color: "#6ff7af", systems: ["prometheus", "companion", "memory", "intelligence"] },
  { id: "growth", x: 0.54, y: 0.58, radius: 0.24, color: "#ffb65d", systems: ["instagram", "website", "crm", "future-customers"] },
  { id: "engineering", x: 0.36, y: 0.62, radius: 0.22, color: "#67e4c2", systems: ["overwatch", "codex", "infrastructure", "cloudflare"] },
  { id: "knowledge", x: 0.47, y: 0.40, radius: 0.20, color: "#d6a0ff", systems: ["research", "calendar", "administration", "future-learning"] },
  { id: "field", x: 0.73, y: 0.47, radius: 0.19, color: "#86f0bd", systems: ["mobile", "dashboard", "future-apis", "future-agents"] }
];

const SYSTEM_HUB_ANCHORS = {
  intelligence: { x: 0.450, y: 0.478 },
  memory: { x: 0.510, y: 0.492 },
  research: { x: 0.494, y: 0.475 },
  prometheus: { x: 0.565, y: 0.488 },
  companion: { x: 0.548, y: 0.558 },
  overwatch: { x: 0.458, y: 0.542 },
  codex: { x: 0.470, y: 0.572 },
  cloudflare: { x: 0.485, y: 0.548 },
  instagram: { x: 0.545, y: 0.546 },
  dashboard: { x: 0.578, y: 0.548 },
  website: { x: 0.585, y: 0.452 },
  mobile: { x: 0.585, y: 0.552 },
  crm: { x: 0.438, y: 0.552 },
  infrastructure: { x: 0.445, y: 0.445 },
  calendar: { x: 0.470, y: 0.438 },
  administration: { x: 0.565, y: 0.575 },
  "future-agents": { x: 0.525, y: 0.425 },
  "future-apis": { x: 0.578, y: 0.575 },
  "future-customers": { x: 0.425, y: 0.518 },
  "future-learning": { x: 0.575, y: 0.580 }
};

const SIMULATION_STATES = {
  SLEEP: "sleep",
  WAKE: "wake",
  COMMUNICATE: "communicate",
  PULSE: "pulse",
  LEARN: "learn",
  COOL_DOWN: "cool-down",
  IDLE: "idle"
};

const VOICE_STATE_TO_SYSTEM = {
  listening: "companion",
  thinking: "intelligence",
  speaking: "companion",
  idle: "",
  standby: ""
};

const SYSTEM_TIERS = {
  core: new Set(["prometheus", "companion", "memory", "intelligence", "overwatch"]),
  major: new Set(["instagram", "crm", "website", "research", "dashboard", "infrastructure", "mobile", "codex", "cloudflare", "calendar"]),
  signal: new Set(["administration", "future-agents", "future-apis", "future-customers", "future-learning"])
};

const TIER_WEIGHT = {
  core: { size: 1.78, glow: 1.64, alpha: 1.0, label: 1.0 },
  major: { size: 1.04, glow: 0.86, alpha: 0.90, label: 0.62 },
  signal: { size: 0.46, glow: 0.36, alpha: 0.70, label: 0.12 }
};

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function halton(index, base) {
  let result = 0;
  let fraction = 1 / base;
  let cursor = index;
  while (cursor > 0) {
    result += fraction * (cursor % base);
    cursor = Math.floor(cursor / base);
    fraction /= base;
  }
  return result;
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16)
  };
}

function rgba(hex, alpha) {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function mixColor(a, b, amount) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const channel = (start, end) => Math.round(start + (end - start) * amount);
  return `#${[channel(ca.r, cb.r), channel(ca.g, cb.g), channel(ca.b, cb.b)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function compactTowardCore(x, y) {
  const focusX = VIRTUAL_CAMERA.focusX;
  const focusY = VIRTUAL_CAMERA.focusY;
  const dx = x - focusX;
  const dy = y - focusY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const outerPull = clamp((distance - 0.070) / 0.24, 0, 1);
  const xScale = lerp(0.72, 0.34, outerPull);
  const yScale = lerp(0.70, 0.32, outerPull);
  return {
    x: focusX + dx * xScale,
    y: focusY + dy * yScale
  };
}

function systemById(id) {
  return OPERATING_SYSTEMS.find((system) => system.id === id) || OPERATING_SYSTEMS[0];
}

function systemTier(systemId) {
  if (SYSTEM_TIERS.core.has(systemId)) return "core";
  if (SYSTEM_TIERS.major.has(systemId)) return "major";
  return "signal";
}

function activeSystemId(nodeId) {
  return {
    instagram: "instagram",
    website: "website",
    crm: "crm",
    overwatch: "overwatch",
    companion: "companion",
    "prometheus-iq": "intelligence",
    mobile: "mobile",
    research: "research",
    infrastructure: "infrastructure",
    calendar: "calendar",
    messages: "calendar",
    memory: "memory",
    strategy: "prometheus",
    tasks: "overwatch",
    analytics: "instagram"
  }[nodeId] || "";
}

function hotspotForSystem(systemId) {
  return NEURAL_HOTSPOTS.find((hotspot) => hotspot.systems.includes(systemId)) || NEURAL_HOTSPOTS[0];
}

function tightenedSystemHubCoordinate(systemId, coordinate) {
  const anchor = SYSTEM_HUB_ANCHORS[systemId];
  if (!anchor) return coordinate;
  const tier = systemTier(systemId);
  const anchorWeight = tier === "core" ? 0.94 : tier === "major" ? 0.90 : 0.84;
  return {
    ...coordinate,
    x: clamp(lerp(coordinate.x, anchor.x, anchorWeight), 0.435, 0.585),
    y: clamp(lerp(coordinate.y, anchor.y, anchorWeight), 0.435, 0.580)
  };
}

function hotspotInfluence(x, y, hotspot) {
  const dx = x - hotspot.x;
  const dy = y - hotspot.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return clamp(1 - distance / hotspot.radius, 0, 1);
}

function initialNodeState(id, fieldIntensity) {
  const baseline = 0.018 + fieldIntensity * 0.040 + hashString(`${id}:baseline`) * 0.028;
  return {
    baseline,
    energy: baseline,
    targetEnergy: baseline,
    wake: 0,
    communication: 0,
    learning: 0,
    cooldown: hashString(`${id}:cooldown`) * 0.35,
    impulseX: 0,
    impulseY: 0,
    state: SIMULATION_STATES.SLEEP,
    lastPulseAt: 0,
    nextHeartbeatAt: 1200 + hashString(`${id}:heartbeat`) * 6500
  };
}

function operatingCoordinate(key, index, systemIndex, stateIndex) {
  const system = OPERATING_SYSTEMS[systemIndex] || OPERATING_SYSTEMS[0];
  const hotspot = hotspotForSystem(system.id);
  const angle = hashString(`${key}:angle`) * Math.PI * 2;
  const radiusSeed = hashString(`${key}:radius`);
  const outerSeed = hashString(`${key}:outer`);
  const radius = Math.pow(radiusSeed, outerSeed > 0.86 ? 0.72 : 1.72) * (outerSeed > 0.92 ? 0.58 : 0.46);
  const coreX = 0.505 + Math.cos(angle) * radius * 0.74;
  const coreY = 0.505 + Math.sin(angle) * radius * 0.56;
  const globalX = 0.100 + halton(index + 19, 2) * 0.80;
  const globalY = 0.120 + halton(index + 29, 3) * 0.76;
  const homeX = hotspot.x + (halton(systemIndex + 7, 5) - 0.5) * hotspot.radius * 0.96;
  const homeY = hotspot.y + (halton(systemIndex + 11, 7) - 0.5) * hotspot.radius * 0.72;
  const connective = hashString(`${key}:connective`);
  const centralGravity = outerSeed > 0.92 ? 0.34 : 0.56 + (1 - radiusSeed) * 0.18;
  const semanticGravity = 0.14 + connective * 0.16;
  const globalGravity = 1 - centralGravity - semanticGravity;
  const timeLift = (stateIndex - (OPERATING_STATES.length - 1) / 2) * 0.009;
  const x = coreX * centralGravity + homeX * semanticGravity + globalX * globalGravity;
  const y = coreY * centralGravity + homeY * semanticGravity + globalY * globalGravity + timeLift;
  const compacted = compactTowardCore(x, y);
  return {
    x: clamp(compacted.x, 0.085, 0.915),
    y: clamp(compacted.y, 0.095, 0.905),
    depth: 0.28 + hashString(`${key}:depth`) * 0.72,
    hotspotId: hotspot.id,
    fieldIntensity: hotspotInfluence(compacted.x, compacted.y, hotspot)
  };
}

function buildNeuralOperatingSystem() {
  const nodes = [];
  const links = [];

  for (const [systemIndex, system] of OPERATING_SYSTEMS.entries()) {
    const hubKey = `${system.id}:hub`;
    let hubCoordinate = operatingCoordinate(hubKey, systemIndex * 41 + 1, systemIndex, 3);
    hubCoordinate = tightenedSystemHubCoordinate(system.id, hubCoordinate);
    const tier = systemTier(system.id);
    const tierWeight = TIER_WEIGHT[tier];
    const labelStrength = (system.weight * 0.46 + hashString(`${system.id}:label`) * 0.20) * tierWeight.label;
    nodes.push({
      id: system.id,
      label: system.label,
      systemId: system.id,
      kind: "system",
      x: hubCoordinate.x,
      y: hubCoordinate.y,
      depth: 0.72 + system.weight * 0.18,
      baseX: hubCoordinate.x,
      baseY: hubCoordinate.y,
      color: system.color,
      tier,
      hotspotId: hubCoordinate.hotspotId,
      fieldIntensity: hubCoordinate.fieldIntensity,
      labelStrength,
      visibility: (0.76 + system.weight * 0.18) * tierWeight.alpha,
      glowStrength: (0.28 + hubCoordinate.fieldIntensity * 0.40 + system.weight * 0.18) * tierWeight.glow,
      pulse: hashString(`${system.id}:pulse`) * Math.PI * 2,
      weight: system.weight,
      size: (1.35 + system.weight * 2.00 + hashString(`${system.id}:scale`) * 0.34) * tierWeight.size,
      activity: 0,
      simulation: initialNodeState(system.id, hubCoordinate.fieldIntensity)
    });

    for (const [signalIndex, signal] of OPERATING_SIGNALS.entries()) {
      for (const [stateIndex, state] of OPERATING_STATES.entries()) {
        const id = `${system.id}:${signal.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}:${state.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
        const nodeIndex = systemIndex * OPERATING_SIGNALS.length * OPERATING_STATES.length +
          signalIndex * OPERATING_STATES.length +
          stateIndex + 1;
        const coordinate = operatingCoordinate(id, nodeIndex, systemIndex, stateIndex);
        const importance = 0.18 + hashString(`${id}:importance`) * 0.82 + coordinate.fieldIntensity * 0.32;
        const visibility = clamp(0.30 + importance * 0.70 + (coordinate.depth - 0.35) * 0.28, 0.20, 1);
        nodes.push({
          id,
          label: `${system.label} ${signal} ${state}`,
          systemId: system.id,
          kind: "signal",
          x: coordinate.x,
          y: coordinate.y,
          depth: coordinate.depth,
          baseX: coordinate.x,
          baseY: coordinate.y,
          color: mixColor(system.color, "#ffffff", stateIndex * 0.025),
          tier: "signal",
          hotspotId: coordinate.hotspotId,
          fieldIntensity: coordinate.fieldIntensity,
          labelStrength: 0,
          visibility,
          glowStrength: coordinate.fieldIntensity * 0.12,
          pulse: hashString(`${id}:pulse`) * Math.PI * 2,
          weight: importance,
          size: 0.14 + Math.pow(hashString(`${id}:size`), 1.95) * 0.94 + coordinate.fieldIntensity * 0.30,
          activity: 0,
          simulation: initialNodeState(id, coordinate.fieldIntensity)
        });
      }
    }
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const system of OPERATING_SYSTEMS) {
    const systemNodes = nodes.filter((node) => node.systemId === system.id && node.kind === "signal");
    for (const [index, node] of systemNodes.entries()) {
      if (index % 7 === 0) links.push({ source: system.id, target: node.id, strength: 0.18, kind: "system-synapse", visibility: hashString(`${system.id}:${node.id}:visible`) });
      const previous = systemNodes[index - 1];
      const sameSignalPreviousState = systemNodes[index - 7];
      const memorySkip = systemNodes[index - 19];
      if (previous && hashString(`${previous.id}:${node.id}:state`) > 0.82) {
        links.push({ source: previous.id, target: node.id, strength: 0.052, kind: "state-flow", visibility: hashString(`${previous.id}:${node.id}:visible`) });
      }
      if (sameSignalPreviousState && hashString(`${sameSignalPreviousState.id}:${node.id}`) > 0.72) {
        links.push({ source: sameSignalPreviousState.id, target: node.id, strength: 0.050, kind: "signal-memory", visibility: hashString(`${sameSignalPreviousState.id}:${node.id}:visible`) });
      }
      if (memorySkip && hashString(`${memorySkip.id}:${node.id}`) > 0.90) {
        links.push({ source: memorySkip.id, target: node.id, strength: 0.044, kind: "long-memory", visibility: hashString(`${memorySkip.id}:${node.id}:visible`) });
      }
    }
  }

  for (const [source, target, label] of OPERATING_EVENTS) {
    if (!byId.has(source) || !byId.has(target)) continue;
    links.push({ source, target, strength: 0.40, kind: "operating-event", label, visibility: hashString(`${source}:${target}:visible`) });
    const sourceSignals = nodes.filter((node) => node.systemId === source && node.kind === "signal");
    const targetSignals = nodes.filter((node) => node.systemId === target && node.kind === "signal");
    for (let index = 0; index < 8; index += 1) {
      const sourceNode = sourceSignals[Math.floor(hashString(`${label}:source:${index}`) * sourceSignals.length)];
      const targetNode = targetSignals[Math.floor(hashString(`${label}:target:${index}`) * targetSignals.length)];
      if (sourceNode && targetNode) {
        links.push({
          source: sourceNode.id,
          target: targetNode.id,
          strength: 0.052,
          kind: "cross-system-signal",
          visibility: hashString(`${sourceNode.id}:${targetNode.id}:visible`)
        });
      }
    }
  }

  const linksBySource = new Map();
  const linksByTarget = new Map();
  for (const link of links) {
    if (!linksBySource.has(link.source)) linksBySource.set(link.source, []);
    if (!linksByTarget.has(link.target)) linksByTarget.set(link.target, []);
    linksBySource.get(link.source).push(link);
    linksByTarget.get(link.target).push(link);
  }

  return { nodes, links, byId, linksBySource, linksByTarget };
}

function voiceColor(voiceState) {
  if (voiceState === "listening") return "#67aef2";
  if (voiceState === "thinking") return "#d98a3a";
  if (voiceState === "speaking") return "#6ff7af";
  return "#b17a42";
}

function voicePower(voiceState) {
  if (voiceState === "listening") return 0.26;
  if (voiceState === "thinking") return 0.34;
  if (voiceState === "speaking") return 0.52;
  return 0.10;
}

function resolveActiveSet(nodes, links, activeId) {
  const systemId = activeSystemId(activeId);
  if (!systemId) return new Set();
  const set = new Set([systemId]);
  const active = systemById(systemId);

  for (const node of nodes) {
    if (node.systemId === systemId) set.add(node.id);
    if (node.kind === "signal" && hashString(`${active.id}:${node.id}:related`) > 0.965) set.add(node.id);
  }

  for (const link of links) {
    if (link.kind === "operating-event" && link.source === systemId) {
      set.add(link.target);
      continue;
    }
    if (link.kind === "operating-event" && link.target === systemId) {
      set.add(link.source);
      continue;
    }
    if (link.kind === "cross-system-signal" && (set.has(link.source) || set.has(link.target)) && link.visibility > 0.92) {
      set.add(link.source);
      set.add(link.target);
    }
  }

  return set;
}

function linkTouchesSystem(link, source, target, systemId) {
  if (!systemId) return false;
  return source.id === systemId ||
    target.id === systemId ||
    source.systemId === systemId ||
    target.systemId === systemId ||
    link.source === systemId ||
    link.target === systemId;
}

function sizeScene(canvas, ctx) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: rect.width, height: rect.height };
}

function createLivingSimulationEngine(graph) {
  return {
    eventQueue: [],
    activeSystemId: "",
    lastVoiceState: "",
    lastTime: 0,
    lastAmbientCommunicationAt: 0,
    enqueue(input = {}) {
      const systemId = activeSystemId(input.nodeId) || input.systemId || (graph.byId.has(input.nodeId) ? input.nodeId : "");
      if (!systemId || !graph.byId.has(systemId)) return;
      this.eventQueue.push({
        systemId,
        kind: input.kind || "conversation",
        intensity: clamp(input.intensity ?? 0.72, 0.12, 1.4),
        createdAt: this.lastTime,
        source: input.source || "companion"
      });
      if (this.eventQueue.length > 24) this.eventQueue.splice(0, this.eventQueue.length - 24);
    }
  };
}

function setNodeState(node, state, intensity) {
  const simulation = node.simulation;
  simulation.state = state;
  simulation.targetEnergy = Math.max(simulation.targetEnergy, simulation.baseline + intensity);
  simulation.wake = Math.max(simulation.wake, intensity);
  if (state === SIMULATION_STATES.COMMUNICATE) simulation.communication = Math.max(simulation.communication, intensity);
  if (state === SIMULATION_STATES.LEARN) simulation.learning = Math.max(simulation.learning, intensity);
  if (state === SIMULATION_STATES.PULSE) simulation.lastPulseAt = 0;
}

function wakeSystem(graph, systemId, state, intensity) {
  const hub = graph.byId.get(systemId);
  if (!hub) return;
  setNodeState(hub, state, intensity);

  let activated = 0;
  for (const node of graph.nodes) {
    if (node.systemId !== systemId || node.kind !== "signal") continue;
    const affinity = hashString(`${systemId}:${node.id}:simulation-affinity`);
    const threshold = state === SIMULATION_STATES.LEARN ? 0.74 : 0.84;
    if (affinity < threshold && activated > 18) continue;
    const nodeIntensity = intensity * (0.18 + affinity * 0.36 + node.fieldIntensity * 0.18);
    setNodeState(node, state, nodeIntensity);
    activated += 1;
  }
}

function propagateSimulation(graph, sourceId, intensity, state) {
  const outgoing = graph.linksBySource.get(sourceId) || [];
  const incoming = graph.linksByTarget.get(sourceId) || [];
  const candidates = [...outgoing, ...incoming]
    .filter((link) => link.kind === "operating-event" || link.kind === "cross-system-signal" || link.visibility > 0.92)
    .sort((a, b) => (b.strength + b.visibility) - (a.strength + a.visibility))
    .slice(0, 10);

  for (const link of candidates) {
    const nextId = link.source === sourceId ? link.target : link.source;
    const next = graph.byId.get(nextId);
    if (!next) continue;
    const propagated = intensity * (0.18 + link.strength * 0.46 + link.visibility * 0.18);
    setNodeState(next, state, propagated);
    const dx = next.baseX - (graph.byId.get(sourceId)?.baseX || next.baseX);
    const dy = next.baseY - (graph.byId.get(sourceId)?.baseY || next.baseY);
    next.simulation.impulseX += dx * propagated * 0.020;
    next.simulation.impulseY += dy * propagated * 0.020;
  }
}

function injectAmbientCommunication(graph, simulation, time) {
  if (time - simulation.lastAmbientCommunicationAt < 900) return;
  simulation.lastAmbientCommunicationAt = time;
  for (const node of graph.nodes) {
    const state = node.simulation;
    if (time < state.nextHeartbeatAt) continue;
    const heartbeatStrength = state.baseline * (node.kind === "system" ? 2.8 : 1.4);
    setNodeState(node, SIMULATION_STATES.PULSE, heartbeatStrength);
    state.nextHeartbeatAt = time + 2600 + hashString(`${node.id}:${Math.floor(time / 2600)}:next-heartbeat`) * 8200;
    if (node.kind === "system" && hashString(`${node.id}:${Math.floor(time / 900)}:communication`) > 0.76) {
      propagateSimulation(graph, node.id, heartbeatStrength * 1.8, SIMULATION_STATES.COMMUNICATE);
    }
  }
}

function processSimulationEvents(graph, simulation, activeSet, voiceState, activeNodeId, time) {
  if (activeNodeId !== simulation.activeSystemId) {
    simulation.activeSystemId = activeNodeId;
    const systemId = activeSystemId(activeNodeId);
    if (systemId) simulation.enqueue({ nodeId: activeNodeId, kind: "conversation", intensity: 0.94, source: "active-node" });
  }

  if (voiceState !== simulation.lastVoiceState) {
    simulation.lastVoiceState = voiceState;
    const voiceSystemId = VOICE_STATE_TO_SYSTEM[voiceState];
    if (voiceSystemId) {
      const intensity = voiceState === "thinking" ? 0.92 : voiceState === "speaking" ? 0.78 : 0.54;
      simulation.enqueue({ systemId: voiceSystemId, kind: voiceState, intensity, source: "voice-state" });
    }
  }

  while (simulation.eventQueue.length) {
    const event = simulation.eventQueue.shift();
    const state =
      event.kind === "thinking" ? SIMULATION_STATES.LEARN :
      event.kind === "speaking" ? SIMULATION_STATES.COMMUNICATE :
      event.kind === "timeline" ? SIMULATION_STATES.LEARN :
      SIMULATION_STATES.WAKE;
    wakeSystem(graph, event.systemId, state, event.intensity);
    propagateSimulation(graph, event.systemId, event.intensity, state);
  }

  for (const id of activeSet) {
    const node = graph.byId.get(id);
    if (!node) continue;
    setNodeState(node, SIMULATION_STATES.WAKE, node.kind === "system" ? 0.72 : 0.36);
  }
}

function evolveNeuralOperatingSystem(graph, simulation, activeSet, voiceState, activeNodeId, time) {
  const elapsed = simulation.lastTime ? Math.min(24, Math.max(4, time - simulation.lastTime)) : 16;
  simulation.lastTime = time;
  processSimulationEvents(graph, simulation, activeSet, voiceState, activeNodeId, time);
  injectAmbientCommunication(graph, simulation, time);

  for (const node of graph.nodes) {
    const state = node.simulation;
    const active = activeSet.has(node.id);
    const coolingRate = 0.010 + elapsed * 0.00055;
    state.targetEnergy = Math.max(state.baseline, state.targetEnergy - coolingRate * (active ? 0.35 : 1));
    state.energy += (state.targetEnergy - state.energy) * 0.046;
    state.wake = Math.max(0, state.wake - elapsed * 0.00072);
    state.communication = Math.max(0, state.communication - elapsed * 0.00056);
    state.learning = Math.max(0, state.learning - elapsed * 0.00046);
    state.cooldown = Math.max(0, state.cooldown - elapsed * 0.00030);
    if (state.wake < 0.04 && state.communication < 0.04 && state.learning < 0.04) {
      state.state = state.energy > state.baseline * 1.45 ? SIMULATION_STATES.COOL_DOWN : SIMULATION_STATES.SLEEP;
    }

    const livingForce = state.energy + state.communication * 0.55 + state.learning * 0.72;
    const heartbeat = Math.sin(time * (0.000020 + state.baseline * 0.00036) + node.pulse) * state.energy;
    const communicateX = Math.cos(time * 0.000015 + node.pulse) * state.communication * 0.0021;
    const learnY = Math.sin(time * 0.000014 + node.pulse * 1.4) * state.learning * 0.0022;
    state.impulseX *= 0.965;
    state.impulseY *= 0.965;

    node.renderX = clamp(node.baseX + heartbeat * 0.0028 + communicateX + state.impulseX, 0.030, 0.970);
    node.renderY = clamp(node.baseY + heartbeat * 0.0022 + learnY + state.impulseY, 0.035, 0.965);
    node.renderDepth = node.depth + livingForce * 0.034 + Math.sin(time * 0.000016 + node.pulse) * state.energy * 0.004;
    node.activity = clamp(livingForce, 0, 1.6);
  }
}

function project(node, width, height, time) {
  const depth = Math.max(0.28, node.renderDepth || node.depth);
  const cameraDepth = 0.74 + depth * 0.09;
  const cameraDriftX = Math.sin(time * 0.000007) * VIRTUAL_CAMERA.driftX + Math.cos(time * 0.000005) * VIRTUAL_CAMERA.driftX * 0.35;
  const cameraDriftY = Math.cos(time * 0.000006) * VIRTUAL_CAMERA.driftY + Math.sin(time * 0.000004) * VIRTUAL_CAMERA.driftY * 0.32;
  const renderX = VIRTUAL_CAMERA.focusX + cameraDriftX + (node.renderX - VIRTUAL_CAMERA.focusX) * VIRTUAL_CAMERA.zoom * cameraDepth;
  const renderY = VIRTUAL_CAMERA.focusY + cameraDriftY + (node.renderY - VIRTUAL_CAMERA.focusY) * VIRTUAL_CAMERA.zoom * cameraDepth;
  const parallaxX = (depth - 0.5) * Math.sin(time * 0.000010 + node.pulse) * 8 * VIRTUAL_CAMERA.parallax;
  const parallaxY = (depth - 0.5) * Math.cos(time * 0.000009 + node.pulse) * 6 * VIRTUAL_CAMERA.parallax;
  let targetX = renderX * width + parallaxX;
  let targetY = renderY * height + parallaxY;
  if (node.kind === "system") {
    const marginX = Math.min(width * 0.13, 144);
    const marginY = Math.min(height * 0.13, 112);
    targetX = clamp(targetX, marginX, width - marginX);
    targetY = clamp(targetY, marginY, height - marginY);
  }
  if (node.screenFrame !== time) {
    if (!Number.isFinite(node.smoothX) || !Number.isFinite(node.smoothY)) {
      node.smoothX = targetX;
      node.smoothY = targetY;
    } else {
      const elapsed = node.screenFrame ? Math.min(34, Math.max(4, time - node.screenFrame)) : 16;
      const smoothing = clamp(1 - Math.exp(-elapsed / 118), 0.055, 0.18);
      node.smoothX += (targetX - node.smoothX) * smoothing;
      node.smoothY += (targetY - node.smoothY) * smoothing;
    }
    node.screenFrame = time;
  }
  return {
    x: node.smoothX,
    y: node.smoothY,
    depth
  };
}

function cubicPoint(a, c1, c2, b, amount) {
  const inverse = 1 - amount;
  const inverse2 = inverse * inverse;
  const amount2 = amount * amount;
  return {
    x: inverse2 * inverse * a.x + 3 * inverse2 * amount * c1.x + 3 * inverse * amount2 * c2.x + amount2 * amount * b.x,
    y: inverse2 * inverse * a.y + 3 * inverse2 * amount * c1.y + 3 * inverse * amount2 * c2.y + amount2 * amount * b.y
  };
}

function clearOperatingField(ctx, width, height) {
  ctx.fillStyle = "rgb(0, 3, 4)";
  ctx.fillRect(0, 0, width, height);
}

function drawOperatingGlow(ctx, graph, width, height, time) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const node of graph.nodes) {
    if (node.kind !== "system") continue;
    const point = project(node, width, height, time);
    const strength = node.glowStrength + node.activity * 0.72 + node.simulation.learning * 0.24;
    if (strength < 0.42) continue;
    const radius = Math.max(width, height) * (0.060 + node.weight * 0.022 + node.fieldIntensity * 0.030);
    const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
    glow.addColorStop(0, rgba(node.color, 0.020 + strength * 0.026));
    glow.addColorStop(0.36, rgba(node.color, 0.007 + strength * 0.009));
    glow.addColorStop(0.72, rgba(node.color, 0.001 + strength * 0.0018));
    glow.addColorStop(1, rgba(node.color, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

function drawVolumetricScatter(ctx, graph, width, height, time) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const systems = graph.nodes.filter((node) => node.kind === "system");
  for (const node of systems) {
    const point = project(node, width, height, time);
    const drift = Math.sin(time * 0.000021 + node.pulse) * 0.5 + 0.5;
    const radius = Math.max(width, height) * (0.035 + node.fieldIntensity * 0.020 + node.activity * 0.010);
    const haze = ctx.createRadialGradient(
      point.x + Math.cos(node.pulse) * radius * 0.12,
      point.y + Math.sin(node.pulse) * radius * 0.08,
      0,
      point.x,
      point.y,
      radius
    );
    haze.addColorStop(0, rgba(mixColor(node.color, "#ffffff", 0.10), 0.0012 + drift * 0.0010 + node.activity * 0.0018));
    haze.addColorStop(0.45, rgba(node.color, 0.0006 + node.activity * 0.0010));
    haze.addColorStop(1, rgba(node.color, 0));
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

function buildImmersiveSubstrate() {
  const signals = [];
  const paths = [];
  for (let index = 0; index < IMMERSIVE_SUBSTRATE_SIGNALS; index += 1) {
    const seed = hashString(`substrate:${index}`);
    const depth = 0.24 + hashString(`substrate:${index}:depth`) * 0.76;
    const system = OPERATING_SYSTEMS[Math.floor(seed * OPERATING_SYSTEMS.length) % OPERATING_SYSTEMS.length];
    const angle = hashString(`substrate:${index}:angle`) * Math.PI * 2;
    const distance = Math.pow(hashString(`substrate:${index}:distance`), 0.82) * 0.74;
    const fieldBias = 0.68 + hashString(`substrate:${index}:field-bias`) * 0.42;
    const spreadX = VIRTUAL_CAMERA.focusX + Math.cos(angle) * distance * fieldBias;
    const spreadY = VIRTUAL_CAMERA.focusY + Math.sin(angle) * distance * fieldBias * 0.72;
    const fullX = halton(index + 89, 2);
    const fullY = halton(index + 131, 3);
    const outerDust = hashString(`substrate:${index}:outer-dust`);
    const mix = outerDust > 0.42 ? 0.70 : 0.26 + depth * 0.18;
    signals.push({
      baseX: clamp(lerp(spreadX, fullX, mix), 0.006, 0.994),
      baseY: clamp(lerp(spreadY, fullY, mix), 0.008, 0.992),
      depth,
      color: mixColor(system.color, "#ffffff", 0.10 + depth * 0.12),
      pulse: seed * Math.PI * 2,
      activity: 0.36 + hashString(`substrate:${index}:activity`) * 0.64,
      size: 0.18 + depth * 0.44 + hashString(`substrate:${index}:size`) * 0.34,
      drift: 0.24 + depth * 0.72
    });
  }

  for (let index = 0; index < IMMERSIVE_SUBSTRATE_PATHS; index += 1) {
    const source = (index * 2 + 7) % IMMERSIVE_SUBSTRATE_SIGNALS;
    paths.push({
      source,
      target: (source + 23 + Math.floor(hashString(`substrate-link:${index}`) * 97)) % IMMERSIVE_SUBSTRATE_SIGNALS,
      signal: hashString(`substrate-link:${index}:signal`),
      phase: hashString(`substrate-link:${index}:phase`)
    });
  }

  return { signals, paths };
}

function substrateSignalPoint(signal, width, height, time) {
  const x = signal.baseX * width +
    Math.sin(time * (0.000004 + signal.depth * 0.000002) + signal.pulse) * signal.drift +
    Math.cos(time * 0.000003 + signal.pulse * 1.7) * signal.drift * 0.16;
  const y = signal.baseY * height +
    Math.cos(time * (0.000004 + signal.depth * 0.000002) + signal.pulse) * signal.drift * 0.34 +
    Math.sin(time * 0.000003 + signal.pulse * 1.4) * signal.drift * 0.14;

  return {
    x: clamp(x, -18, width + 18),
    y: clamp(y, -18, height + 18),
    depth: signal.depth,
    color: signal.color,
    pulse: signal.pulse,
    activity: signal.activity,
    size: signal.size
  };
}

function drawImmersiveBrainSubstrate(ctx, substrate, width, height, time, voiceState, startupPower) {
  const voice = voiceColor(voiceState);
  const power = voicePower(voiceState);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const path of substrate.paths) {
    const a = substrateSignalPoint(substrate.signals[path.source], width, height, time);
    const b = substrateSignalPoint(substrate.signals[path.target], width, height, time);
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (distance > Math.max(width, height) * 0.62) continue;

    const signal = path.signal;
    const alpha = (0.014 + signal * 0.032 + power * 0.018 + startupPower * 0.036) * (0.52 + (a.depth + b.depth) * 0.36);
    const bend = Math.sin(time * 0.000014 + a.pulse + b.pulse) * (10 + signal * 24);
    const c1 = {
      x: lerp(a.x, b.x, 0.35) + bend,
      y: lerp(a.y, b.y, 0.28) - bend * 0.32
    };
    const c2 = {
      x: lerp(a.x, b.x, 0.70) - bend * 0.65,
      y: lerp(a.y, b.y, 0.74) + bend * 0.28
    };
    const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    gradient.addColorStop(0, rgba(a.color, 0));
    gradient.addColorStop(0.46, rgba(mixColor(a.color, b.color, 0.55), alpha));
    gradient.addColorStop(1, rgba(b.color, 0));
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 0.090 + signal * 0.160 + power * 0.080 + startupPower * 0.082;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
    ctx.stroke();

    if ((voiceState === "speaking" || startupPower > 0.04) && signal > 0.42) {
      const flow = (time * (0.000115 + startupPower * 0.000080) + path.phase) % 1;
      const head = cubicPoint(a, c1, c2, b, flow);
      ctx.fillStyle = rgba(voice, 0.050 + power * 0.110 + startupPower * 0.092);
      ctx.beginPath();
      ctx.arc(head.x, head.y, 0.42 + signal * 0.48, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const signal of substrate.signals) {
    const point = substrateSignalPoint(signal, width, height, time);
    const breath = 0.78 + Math.sin(time * 0.000045 + point.pulse) * 0.22;
    const alpha = (0.030 + point.depth * 0.040 + point.activity * 0.020 + power * 0.012 + startupPower * 0.020) * breath;
    const size = point.size;
    ctx.fillStyle = rgba(point.color, alpha);
    ctx.beginPath();
    ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawRelationshipField(ctx, graph, width, height, time, activeSet, startupPower, activeTopicSystem = "") {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const link of graph.links) {
    const source = graph.byId.get(link.source);
    const target = graph.byId.get(link.target);
    if (!source || !target) continue;
    const relationshipSignal = Math.max(
      source.simulation.communication,
      target.simulation.communication,
      source.simulation.learning * 0.68,
      target.simulation.learning * 0.68,
      source.simulation.energy * 0.38,
      target.simulation.energy * 0.38
    );
    const activeSystemPath =
      (source.kind === "system" && activeSet.has(source.id)) ||
      (target.kind === "system" && activeSet.has(target.id)) ||
      (link.kind === "operating-event" && (activeSet.has(source.id) || activeSet.has(target.id)));
    const topicPath = linkTouchesSystem(link, source, target, activeTopicSystem);
    const startupPath =
      startupPower > 0.02 &&
      (link.kind === "operating-event" ||
        link.kind === "cross-system-signal" ||
        link.kind === "system-synapse" ||
        link.visibility > 0.900);
    const important =
      activeSystemPath ||
      topicPath ||
      startupPath ||
      relationshipSignal > 0.12 ||
      link.visibility > 0.950;
    if (!important) continue;

    const a = project(source, width, height, time);
    const b = project(target, width, height, time);
    const depth = clamp((a.depth + b.depth) * 0.5, 0.28, 1);
    const topicBoost = topicPath ? 0.040 : 0;
    const alpha = clamp(0.0180 + relationshipSignal * 0.086 + (activeSystemPath ? 0.030 : 0) + topicBoost + (startupPath ? startupPower * 0.046 : 0), 0.0080, 0.170) * depth;
    const bend = Math.sin(time * 0.000020 + source.pulse * 0.8 + target.pulse) * (20 + relationshipSignal * 28);
    const c1 = {
      x: lerp(a.x, b.x, 0.30) + bend,
      y: lerp(a.y, b.y, 0.18) - bend * 0.18
    };
    const c2 = {
      x: lerp(a.x, b.x, 0.72) - bend,
      y: lerp(a.y, b.y, 0.84) + bend * 0.22
    };
    const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    gradient.addColorStop(0, rgba(source.color, alpha));
    gradient.addColorStop(0.50, rgba(mixColor(source.color, target.color, 0.5), alpha * 1.06));
    gradient.addColorStop(1, rgba(target.color, alpha));
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 0.26 + depth * 0.38 + relationshipSignal * 0.50 + (topicPath ? 0.24 : 0) + (startupPath ? startupPower * 0.25 : 0);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
    ctx.stroke();

    if (activeSystemPath || topicPath || startupPath || relationshipSignal > 0.30) {
      const flow = (time * (0.000060 + relationshipSignal * 0.000115 + (topicPath ? 0.000095 : 0) + startupPower * 0.000090) + link.visibility) % 1;
      const head = cubicPoint(a, c1, c2, b, flow);
      const tail = cubicPoint(a, c1, c2, b, Math.max(0, flow - 0.055));
      const current = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      current.addColorStop(0, rgba(source.color, 0));
      current.addColorStop(0.55, rgba(mixColor(source.color, target.color, 0.5), 0.080 + relationshipSignal * 0.135 + (topicPath ? 0.110 : 0) + startupPower * 0.095));
      current.addColorStop(1, rgba(target.color, 0));
      ctx.strokeStyle = current;
      ctx.lineWidth = 0.82 + depth * 0.54 + (topicPath ? 0.36 : 0);
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawOperatingLinks(ctx, graph, width, height, time, voiceState, activeSet, startupPower, activeTopicSystem = "") {
  const voice = voiceColor(voiceState);
  const power = voicePower(voiceState);
  const speaking = voiceState === "speaking";
  const speechSystems = new Set(["companion", "intelligence", "memory", "overwatch", "prometheus"]);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const link of graph.links) {
    const source = graph.byId.get(link.source);
    const target = graph.byId.get(link.target);
    if (!source || !target) continue;
    const lineSignal = Math.max(
      source.simulation.communication,
      target.simulation.communication,
      source.simulation.learning * 0.74,
      target.simulation.learning * 0.74,
      source.simulation.wake * 0.42,
      target.simulation.wake * 0.42
    );
    const activeSystemPath =
      (source.kind === "system" && activeSet.has(source.id)) ||
      (target.kind === "system" && activeSet.has(target.id)) ||
      (link.kind === "operating-event" && (activeSet.has(source.id) || activeSet.has(target.id)));
    const topicPath = linkTouchesSystem(link, source, target, activeTopicSystem);
    const speakingTopicPath = speaking && topicPath;
    const speakingPath =
      speaking &&
      (speechSystems.has(source.systemId || source.id) ||
        speechSystems.has(target.systemId || target.id) ||
        activeSystemPath ||
        topicPath);
    const startupPath =
      startupPower > 0.02 &&
      (link.kind === "operating-event" ||
        link.kind === "cross-system-signal" ||
        link.kind === "system-synapse" ||
        link.visibility > 0.900);
    const active = activeSystemPath || speakingPath || topicPath || startupPath || lineSignal > 0.24;
    if (!active) {
      const visibleIdle =
        (link.kind === "operating-event" && link.visibility > 0.50) ||
        (link.kind === "cross-system-signal" && link.visibility > 0.860) ||
        (link.kind === "system-synapse" && link.visibility > 0.870) ||
        (link.kind === "long-memory" && link.visibility > 0.910);
      if (!visibleIdle) continue;
    }
    const a = project(source, width, height, time);
    const b = project(target, width, height, time);
    const depthAlpha = clamp((a.depth + b.depth) * 0.5, 0.28, 1);
    const idleAlpha = link.kind === "operating-event" ? 0.026 : link.kind === "cross-system-signal" ? 0.019 : 0.0125;
    const speechBoost = speakingTopicPath ? 0.145 : speakingPath ? 0.075 : 0;
    const startupBoost = startupPath ? startupPower * 0.060 : 0;
    const topicBoost = topicPath ? 0.030 : 0;
    const alpha = active ? 0.030 + speechBoost + topicBoost + startupBoost + power * 0.036 + lineSignal * 0.082 : idleAlpha * depthAlpha;
    const bend = Math.sin(time * 0.000026 + source.pulse + target.pulse) * (15 + link.strength * 31 + lineSignal * 25);
    const c1 = {
      x: a.x + (b.x - a.x) * 0.34 + bend,
      y: a.y + (b.y - a.y) * 0.18 - bend * 0.35
    };
    const c2 = {
      x: a.x + (b.x - a.x) * 0.68 - bend,
      y: a.y + (b.y - a.y) * 0.82 + bend * 0.28
    };
    const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    gradient.addColorStop(0, rgba(source.color, alpha));
    gradient.addColorStop(0.52, active ? rgba(speakingTopicPath ? mixColor(voice, target.color, 0.42) : voice, alpha + (speakingTopicPath ? 0.145 : speakingPath ? 0.085 : 0.030)) : "rgba(125, 236, 195, 0.004)");
    gradient.addColorStop(1, rgba(target.color, alpha));
    ctx.strokeStyle = gradient;
    ctx.lineWidth = active ? 0.30 + (speakingTopicPath ? 0.46 : speakingPath ? 0.22 : topicPath ? 0.12 : 0) + startupPower * 0.19 + lineSignal * 0.48 : link.kind === "operating-event" ? 0.135 : 0.090;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
    ctx.stroke();

    if (active || (link.kind === "operating-event" && link.visibility > 0.90)) {
      const flow = (time * (0.000072 + lineSignal * 0.000120 + (speakingTopicPath ? 0.000280 : speakingPath ? 0.000095 : 0) + startupPower * 0.000095) + hashString(`${source.id}:${target.id}:flow`)) % 1;
      const point = cubicPoint(a, c1, c2, b, flow);
      ctx.fillStyle = rgba(active ? (speakingTopicPath ? mixColor(voice, target.color, 0.42) : voice) : target.color, active ? 0.110 + lineSignal * 0.155 + (speakingTopicPath ? 0.210 : speakingPath ? 0.120 : 0) + startupPower * 0.080 : 0.014);
      ctx.beginPath();
      ctx.arc(point.x, point.y, active ? (speakingTopicPath ? 1.65 : speakingPath ? 1.30 : 1.0) : 0.36, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawTopicSynapse(ctx, graph, width, height, time, voiceState, activeTopicSystem = "") {
  if (voiceState !== "speaking" || !activeTopicSystem || activeTopicSystem === "companion") return;

  const source = graph.byId.get("companion");
  const target = graph.byId.get(activeTopicSystem);
  if (!source || !target) return;

  const a = project(source, width, height, time);
  const b = project(target, width, height, time);
  const voice = voiceColor(voiceState);
  const seed = hashString(`companion:${activeTopicSystem}:topic-synapse`);
  const bend = (seed - 0.5) * 130;
  const c1 = {
    x: a.x + (b.x - a.x) * 0.30 + bend,
    y: a.y + (b.y - a.y) * 0.22 - bend * 0.30
  };
  const c2 = {
    x: a.x + (b.x - a.x) * 0.72 - bend * 0.54,
    y: a.y + (b.y - a.y) * 0.82 + bend * 0.24
  };

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const pathGlow = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  pathGlow.addColorStop(0, rgba(source.color, 0.038));
  pathGlow.addColorStop(0.46, rgba(mixColor(voice, target.color, 0.50), 0.40));
  pathGlow.addColorStop(1, rgba(target.color, 0.095));
  ctx.strokeStyle = pathGlow;
  ctx.lineWidth = 1.30;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
  ctx.stroke();

  const phase = (time * 0.00048) % 1;
  for (let i = 0; i < 3; i += 1) {
    const flow = (phase + i * 0.18) % 1;
    const tail = cubicPoint(a, c1, c2, b, Math.max(0, flow - 0.08));
    const head = cubicPoint(a, c1, c2, b, flow);
    const pulse = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    pulse.addColorStop(0, rgba(source.color, 0));
    pulse.addColorStop(0.55, rgba(mixColor(voice, target.color, 0.58), 0.50));
    pulse.addColorStop(1, rgba(target.color, 0));
    ctx.strokeStyle = pulse;
    ctx.lineWidth = 1.55 - i * 0.16;
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(head.x, head.y);
    ctx.stroke();

    ctx.fillStyle = rgba(mixColor(voice, target.color, 0.55), 0.40);
    ctx.beginPath();
    ctx.arc(head.x, head.y, 1.8 - i * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawOperatingNodes(ctx, graph, width, height, time, voiceState, activeSet) {
  const voice = voiceColor(voiceState);
  const power = voicePower(voiceState);
  const orderedNodes = [...graph.nodes].sort((a, b) => (a.renderDepth || a.depth) - (b.renderDepth || b.depth));

  for (const node of orderedNodes) {
    const point = project(node, width, height, time);
    const active = activeSet.has(node.id);
    const simulation = node.simulation;
    const stateBoost = simulation.energy + simulation.communication * 0.72 + simulation.learning * 0.82;
    const breath = 0.90 + Math.sin(time * (0.00018 + simulation.energy * 0.00030) + node.pulse) * (0.035 + stateBoost * 0.12);
    const visibility = clamp(node.visibility * (0.54 + point.depth * 0.52), 0.10, 1);
    const base = node.size * (0.50 + point.depth * 0.74) * breath;
    const tierWeight = TIER_WEIGHT[node.tier] || TIER_WEIGHT.signal;
    const tierScale = node.tier === "core" ? 1.14 : node.tier === "major" ? 0.92 : 0.72;
    const size = active ? base * tierScale * (1.20 + power * 0.36 + stateBoost * 0.24) : base * tierScale * (0.76 + stateBoost * 0.30);
    const color = active ? mixColor(node.color, voice, 0.56) : node.color;
    const alpha = active ? 0.92 : ((node.kind === "system" ? 0.64 : 0.58) + stateBoost * 0.42) * visibility * tierWeight.alpha;
    if (!active && node.kind === "signal" && alpha < 0.012) continue;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const haloRadius = Math.max(1.6, size * (active ? 7.6 : node.kind === "system" ? 3.8 + stateBoost * 2.2 : 2.4 + stateBoost * 1.6));
    const halo = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, haloRadius);
    halo.addColorStop(0, rgba(color, active ? 0.30 : ((node.kind === "system" ? 0.070 : 0.048) + stateBoost * 0.100) * visibility));
    halo.addColorStop(0.36, rgba(color, active ? 0.080 : (0.014 + stateBoost * 0.026) * visibility));
    halo.addColorStop(0.72, rgba(color, active ? 0.006 : (0.002 + stateBoost * 0.006) * visibility));
    halo.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(point.x, point.y, haloRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = rgba(mixColor(color, "#ffffff", node.kind === "signal" ? 0.24 : 0.12), alpha * (node.kind === "system" ? 0.88 : 0.70));
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(0.24, size * (node.kind === "system" ? 0.86 : 0.62)), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (node.kind === "system") {
      const discovered = active ||
        simulation.communication > 0.18 ||
        simulation.learning > 0.22 ||
        (node.tier === "core" && node.activity > 0.16) ||
        (node.tier !== "signal" && node.labelStrength > 0.18 && Math.sin(time * 0.00010 + node.pulse) > -0.22);
      if (!discovered) continue;
      const labelAlpha = active ? 0.50 : clamp((node.labelStrength - 0.30) * 0.24 + simulation.communication * 0.22 + simulation.learning * 0.18, 0.10, 0.34);
      const offsetAngle = node.pulse + Math.sin(time * 0.000075 + node.pulse) * 0.35;
      const offset = 9 + node.labelStrength * 10;
      ctx.save();
      ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = `rgba(234, 255, 241, ${labelAlpha})`;
      ctx.fillText(
        node.label.toUpperCase(),
        point.x + Math.cos(offsetAngle) * offset,
        point.y + Math.sin(offsetAngle) * offset
      );
      ctx.restore();
    }
  }
}

export function createPrometheusScene(canvas) {
  if (!canvas) return { destroy() {} };

  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const graph = buildNeuralOperatingSystem();
  const substrate = buildImmersiveSubstrate();
  const simulation = createLivingSimulationEngine(graph);
  let raf = 0;
  let destroyed = false;
  let lastActive = "";
  let startedAt = 0;

  const resize = () => sizeScene(canvas, ctx);
  const handleIntelligenceActivity = (event) => {
    simulation.enqueue(event.detail || {});
  };
  window.addEventListener("resize", resize);
  window.addEventListener("prometheus:intelligence-activity", handleIntelligenceActivity);
  for (const [index, systemId] of [
    "companion",
    "intelligence",
    "memory",
    "overwatch",
    "prometheus",
    "instagram",
    "website",
    "crm",
    "research",
    "infrastructure",
    "mobile",
    "dashboard",
    "codex",
    "cloudflare"
  ].entries()) {
    simulation.enqueue({ systemId, kind: "startup", intensity: 0.95 - index * 0.025, source: "renderer-startup" });
  }

  const animate = (time) => {
    if (destroyed) return;
    if (!startedAt) startedAt = time;
    const startupAge = Math.max(0, time - startedAt);
    const startupPower = clamp(1 - startupAge / 7200, 0, 1);
    const { width, height } = sizeScene(canvas, ctx);
    const voiceState = document.body.dataset.voice || "idle";
    const active = document.body.dataset.activeNode || "";
    const activeTopicSystem = activeSystemId(active);
    if (active !== lastActive) {
      lastActive = active;
      if (active) simulation.enqueue({ nodeId: active, kind: "conversation", intensity: 0.86, source: "active-node-change" });
    }

    const activeSet = resolveActiveSet(graph.nodes, graph.links, active);
    evolveNeuralOperatingSystem(graph, simulation, activeSet, voiceState, active, time);
    clearOperatingField(ctx, width, height);
    drawVolumetricScatter(ctx, graph, width, height, time);
    drawImmersiveBrainSubstrate(ctx, substrate, width, height, time, voiceState, startupPower);
    drawRelationshipField(ctx, graph, width, height, time, activeSet, startupPower, activeTopicSystem);
    drawOperatingGlow(ctx, graph, width, height, time);
  drawOperatingLinks(ctx, graph, width, height, time, voiceState, activeSet, startupPower, activeTopicSystem);
  drawTopicSynapse(ctx, graph, width, height, time, voiceState, activeTopicSystem);
  drawOperatingNodes(ctx, graph, width, height, time, voiceState, activeSet);

    raf = requestAnimationFrame(animate);
  };

  canvas.dataset.renderer = NODE_CACHE_VERSION;
  canvas.dataset.simulation = "living-intelligence";
  raf = requestAnimationFrame(animate);

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("prometheus:intelligence-activity", handleIntelligenceActivity);
    }
  };
}
