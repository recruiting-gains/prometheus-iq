import { AIProvider } from "../prometheus-os/ai-provider.js";
import { resolveCompanionCommandRoute } from "../prometheus-os/companion-command-router.js";
import { companyState } from "../prometheus-os/demo-data.js";
import { normalizeIntentText } from "../prometheus-os/intent-router.js";

function nodesForHarness() {
  return [
    ...companyState.statusCards.map((card) => ({
      id: card.key,
      label: card.label,
      value: card.value,
      detail: card.detail,
      signal: card.signal
    })),
    {
      id: "founder-notes",
      label: "Founder Notes",
      value: "Signals",
      detail: "Founder notes and current company signals."
    },
    {
      id: "voice-settings",
      label: "Voice Settings",
      value: "Configure",
      detail: "Voice provider, always-listening, and premium TTS settings."
    }
  ];
}

function phrasesForNode(node) {
  const aliases = {
    pilot: ["pilot readiness", "pilot ready"],
    executive: ["executive readiness", "leadership packet", "executive packet", "packet"],
    anthony: ["anthony beta", "anthony status", "beta status"],
    route: ["route intelligence", "route status", "v4 1"],
    github: ["github status", "git hub status", "repo status", "repository status"],
    cloudflare: ["cloudflare", "deployment", "deployed"],
    domain: ["domain email", "domain status", "email status"],
    social: ["social media", "instagram", "prometheus iq"],
    llc: ["llc", "business setup", "company setup"],
    website: ["website status", "site status", "homepage status"],
    "founder-notes": ["founder notes", "notes", "signals", "what should i do next"],
    "voice-settings": ["voice settings", "voice", "settings"]
  }[node.id] || [];

  return [node.label, node.key, ...aliases].map(normalizeIntentText).filter(Boolean);
}

const bannedResponseText = [
  "project context",
  "company signal",
  "founder notes",
  "dashboard card",
  "status card",
  "module text",
  "opening",
  "i found safe prometheus context"
];

const reasoningCases = [
  "Prometheus, what happened yesterday?",
  "Prometheus, what happened this week?",
  "Prometheus, what major systems have been built?",
  "Prometheus, what changed in Prometheus over the last month?",
  "Prometheus, who is Anthony?",
  "Prometheus, why is Anthony important?",
  "Prometheus, what is the biggest risk to Prometheus today?",
  "Prometheus, what should I do next?",
  "Prometheus, if you were my COO, what would you tell me to do tomorrow?",
  "Prometheus, why is Google Places more important than Meta?",
  "Prometheus, how many businesses did Anthony visit today?"
];

const provider = new AIProvider();
let failures = 0;

function fail(label, payload) {
  failures += 1;
  console.error(`FAIL ${label}`, JSON.stringify(payload, null, 2));
}

for (const phrase of reasoningCases) {
  const route = resolveCompanionCommandRoute({
    command: phrase,
    history: provider.history,
    nodes: nodesForHarness(),
    phrasesForNode
  });

  if (route.type !== "cognitive") {
    fail("ui-route", {
      phrase,
      expected: "cognitive",
      actual: route.type,
      normalized: route.normalized,
      reason: route.reason,
      routedIntent: route.routedIntent
    });
    continue;
  }

  if (
    route.decision?.routeType !== "intelligence_orchestrator" ||
    route.decision?.allowCards !== false ||
    route.decision?.allowNodes !== false ||
    route.decision?.allowTTSFromCards !== false
  ) {
    fail("exclusive-intelligence-decision", {
      phrase,
      decision: route.decision
    });
    continue;
  }

  const response = await provider.ask(phrase);
  const text = `${response.title || ""} ${response.body || ""}`.toLowerCase();
  const bannedHit = bannedResponseText.find((item) => text.includes(item));
  if (
    response.metadata?.cognitive !== true ||
    response.metadata?.orchestrator !== true ||
    response.metadata?.cardFallbackUsed === true ||
    response.metadata?.routeSelected !== "intelligence_orchestrator" ||
    bannedHit
  ) {
    fail("provider-response", {
      phrase,
      title: response.title,
      cognitive: response.metadata?.cognitive === true,
      orchestrator: response.metadata?.orchestrator === true,
      cardFallbackUsed: response.metadata?.cardFallbackUsed === true,
      routeSelected: response.metadata?.routeSelected,
      bannedHit,
      body: response.body
    });
    continue;
  }

  if (phrase.toLowerCase().includes("how many businesses") && !text.includes("do not have verified visit data")) {
    fail("unknown-visit-data-truth", {
      phrase,
      body: response.body
    });
    continue;
  }

  console.log(`PASS ${phrase} -> route:${route.type} routeSelected:${response.metadata.routeSelected} response:${response.title}`);
}

const explicitNodeCases = [
  "Prometheus, open voice settings",
  "Prometheus, display website status",
  "Prometheus, show pilot readiness card"
];

for (const phrase of explicitNodeCases) {
  const route = resolveCompanionCommandRoute({
    command: phrase,
    history: provider.history,
    nodes: nodesForHarness(),
    phrasesForNode
  });

  if (route.type !== "node") {
    fail("explicit-node-route", {
      phrase,
      expected: "node",
      actual: route.type,
      normalized: route.normalized,
      reason: route.reason,
      routedIntent: route.routedIntent
    });
    continue;
  }

  if (
    route.decision?.allowCards === false ||
    route.decision?.allowNodes === false ||
    route.decision?.allowTTSFromCards === false
  ) {
    fail("explicit-node-decision", {
      phrase,
      decision: route.decision
    });
    continue;
  }

  console.log(`PASS ${phrase} -> route:${route.type} node:${route.matchedNode.nodeId}`);
}

if (failures) {
  process.exitCode = 1;
}
