import { AIProvider } from "../prometheus-os/ai-provider.js";
import { resolveCompanionCommandRoute } from "../prometheus-os/companion-command-router.js";
import { normalizeIntentText } from "../prometheus-os/intent-router.js";

function nodesForHarness() {
  return [
    {
      id: "memory",
      label: "Memory",
      value: "Context",
      detail: "Founder timeline, long-term goals, Active Pool decision recall, and where-we-left-off context."
    },
    {
      id: "tasks",
      label: "Tasks",
      value: "Priority",
      detail: "Highest ROI task, production blockers, day planning, and engineering versus sales focus."
    },
    {
      id: "calendar",
      label: "Calendar",
      value: "Placeholder",
      detail: "Calendar-style planning is available from memory, but live calendar integration is not connected yet."
    },
    {
      id: "messages",
      label: "Messages",
      value: "Draft",
      detail: "Draft founder messages, leadership follow-ups, pilot asks, and operating updates without sending anything."
    },
    {
      id: "prometheus-iq",
      label: "Prometheus IQ",
      value: "Product",
      detail: "Product state, Dashboard/Data boundary, Route Intelligence relationship, and pilot readiness context."
    },
    {
      id: "overwatch",
      label: "Overwatch",
      value: "Assignments",
      detail: "Next subsystem assignment, blocker awareness, verification discipline, and engineering handoff support."
    },
    {
      id: "analytics",
      label: "Analytics",
      value: "Signals",
      detail: "Strategy critique, pricing direction, and proof metrics."
    },
    {
      id: "strategy",
      label: "Strategy",
      value: "Founder",
      detail: "Long-term goals, pricing, executive positioning, validation focus, and pilot proof logic."
    },
    {
      id: "voice-settings",
      label: "Voice",
      value: "Live",
      detail: "Voice provider, always-listening, and premium TTS settings."
    }
  ];
}

function phrasesForNode(node) {
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

  return [node.label, node.id, node.key, ...aliases].map(normalizeIntentText).filter(Boolean);
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
  "Prometheus, what happened today?",
  "Prometheus, what happened yesterday?",
  "Prometheus, what happened this week?",
  "Prometheus, what major systems have been built?",
  "Prometheus, what changed in Prometheus over the last month?",
  "Prometheus, who is Anthony?",
  "Prometheus, what about Anthony?",
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
  "Prometheus, open memory node",
  "Prometheus, open Prometheus IQ node",
  "Prometheus, open voice settings",
  "Prometheus, display calendar node",
  "Prometheus, show tasks node"
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

const founderAcceptanceCases = [
  ["Good morning, Companion.", ["good morning", "highest roi"]],
  ["Catch me up on where we left off.", ["where we left off", "latest verified memory"]],
  ["What’s the current engineering status of Prometheus?", ["engineering status", "validation mode"]],
  ["Help me draft a message.", ["message draft", "founder message draft"]],
  ["Remind me what meetings I have.", ["calendar access", "missing integration"]],
  ["What are my long-term goals?", ["long-term founder goals", "route intelligence"]],
  ["Help me plan my day.", ["founder day plan", "calendar note"]],
  ["How should we price this feature?", ["pricing direction", "operational value"]],
  ["What did we decide about Active Pool?", ["active pool decision", "active pool"]],
  ["What are weaknesses in my current strategy?", ["strategy weaknesses", "overbuilding"]],
  ["How does the Dashboard interact with the Data subsystem?", ["dashboard and data boundary", "data supplies governed records"]]
];

for (const [phrase, expected] of founderAcceptanceCases) {
  const response = await provider.ask(phrase);
  const text = `${response.title || ""} ${response.body || ""}`.toLowerCase();
  const missing = expected.filter((item) => !text.includes(item));
  if (response.metadata?.founderAssistant !== true || response.metadata?.routeSelected !== "founder_assistant" || missing.length) {
    fail("founder-acceptance-command", {
      phrase,
      title: response.title,
      founderAssistant: response.metadata?.founderAssistant === true,
      routeSelected: response.metadata?.routeSelected,
      missing,
      body: response.body
    });
    continue;
  }
  console.log(`PASS ${phrase} -> founder-assistant:${response.title}`);
}

const protectedPassingCases = [
  ["What should I focus on today?", ["highest roi", "validation"]],
  ["What’s the next highest-priority task?", ["highest roi", "anthony"]],
  ["What production blockers remain?", ["production blockers", "anthony"]],
  ["Should I focus on engineering or sales today?", ["highest roi", "validation"]],
  ["What should Overwatch assign next?", ["overwatch next assignment", "founder acceptance"]]
];

for (const [phrase, expected] of protectedPassingCases) {
  const response = await provider.ask(phrase);
  const text = `${response.title || ""} ${response.body || ""}`.toLowerCase();
  const bannedHit = bannedResponseText.find((item) => text.includes(item));
  const missing = expected.filter((item) => !text.includes(item));
  if (bannedHit || missing.length) {
    fail("protected-passing-command", {
      phrase,
      title: response.title,
      bannedHit,
      missing,
      body: response.body
    });
    continue;
  }
  console.log(`PASS ${phrase} -> protected:${response.title}`);
}

if (failures) {
  process.exitCode = 1;
}
