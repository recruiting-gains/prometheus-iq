import { AIProvider } from "../prometheus-os/ai-provider.js";
import { resolveCompanionCommandRoute } from "../prometheus-os/companion-command-router.js";
import { normalizeIntentText } from "../prometheus-os/intent-router.js";
import { readFileSync } from "node:fs";
import {
  SOCIAL_CONNECTION_STATES,
  SOCIAL_DATA_SOURCES,
  SOCIAL_MEDIA_CONTRACT_VERSION,
  SOCIAL_PROVIDER_IDS,
  createMarketingAnalyticsSnapshot,
  createSocialProviderStatus
} from "../social-media/contracts/social-media-contract.js";
import {
  FOUNDER_COMMUNICATIONS_CONTRACT_VERSION,
  FOUNDER_CONNECTION_STATES,
  createDailyAgendaResponse,
  createDraftMessageRequest,
  createFounderIntegrationStatus,
  createMessageSummariesResponse,
  createUpcomingMeetingsResponse
} from "../integrations/founder-communications-contract.js";
import { createFounderCommunicationsService } from "../integrations/founder-communications-service.js";

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
      value: "Contract",
      detail: "Calendar, meetings, reminders, and daily agenda consume the shared Founder Calendar & Message Integration Contract."
    },
    {
      id: "messages",
      label: "Messages",
      value: "Contract",
      detail: "Message summaries and draft requests consume the shared Founder Calendar & Message Integration Contract."
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
  "i found safe prometheus context",
  "not enough signal",
  "ask me the sharper version",
  "more anchor"
];

const founderModeBannedText = [
  "contract",
  "normalized",
  "provider_api",
  "provider:",
  "source:",
  "api calls",
  "meta credentials",
  "route selected",
  "intent routing",
  "snapshot",
  "unavailable"
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

function communicationsServiceForStatus(status) {
  return createFounderCommunicationsService({
    provider: status.provider || "test-provider",
    adapter: {
      async getConnectionStatus() {
        return status;
      },
      async getUpcomingMeetings({ window = {} } = {}) {
        return createUpcomingMeetingsResponse({
          status,
          window,
          meetings: []
        });
      },
      async getDailyAgenda({ date = "2026-06-30", timezone = "America/Chicago" } = {}) {
        return createDailyAgendaResponse({
          date,
          timezone,
          status,
          events: []
        });
      },
      async listMessageSummaries() {
        return createMessageSummariesResponse({
          status,
          messages: []
        });
      },
      async createDraftMessageRequest(payload = {}) {
        return {
          contractVersion: FOUNDER_COMMUNICATIONS_CONTRACT_VERSION,
          ok: status.state !== FOUNDER_CONNECTION_STATES.PERMISSION_REQUIRED,
          status,
          draftRequest: createDraftMessageRequest({
            id: payload.id || "draft_test",
            channel: payload.channel,
            subject: payload.subject,
            body: payload.body,
            requestedBy: "companion"
          })
        };
      }
    }
  });
}

function socialMediaAnalyticsServiceForSnapshot(snapshot) {
  return {
    sourceSubsystem: "Prometheus Social Media",
    async getInstagramAnalyticsSnapshot() {
      return snapshot;
    }
  };
}

const liveInstagramAnalyticsSnapshot = createMarketingAnalyticsSnapshot({
  id: "companion-founder-brief-instagram-test",
  generatedAt: "2026-07-01T22:30:00.000Z",
  providers: [
    createSocialProviderStatus({
      provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
      state: SOCIAL_CONNECTION_STATES.CONNECTED,
      source: SOCIAL_DATA_SOURCES.PROVIDER_API,
      accountId: "17841421929598004",
      accountHandle: "@prometheus.iq",
      checkedAt: "2026-07-01T22:30:00.000Z"
    })
  ],
  metrics: [
    { name: "followers_count", value: 50, source: SOCIAL_DATA_SOURCES.PROVIDER_API, provider: SOCIAL_PROVIDER_IDS.INSTAGRAM, observedAt: "2026-07-01T22:30:00.000Z", metadata: { scope: "account" } },
    { name: "reach", value: 20, source: SOCIAL_DATA_SOURCES.PROVIDER_API, provider: SOCIAL_PROVIDER_IDS.INSTAGRAM, observedAt: "2026-07-01T22:30:00.000Z", metadata: { scope: "account" } },
    { name: "impressions", value: 44, source: SOCIAL_DATA_SOURCES.PROVIDER_API, provider: SOCIAL_PROVIDER_IDS.INSTAGRAM, observedAt: "2026-07-01T22:30:00.000Z", metadata: { scope: "account" } },
    { name: "profile_views", value: 8, source: SOCIAL_DATA_SOURCES.PROVIDER_API, provider: SOCIAL_PROVIDER_IDS.INSTAGRAM, observedAt: "2026-07-01T22:30:00.000Z", metadata: { scope: "account" } },
    { name: "website_clicks", value: 3, source: SOCIAL_DATA_SOURCES.PROVIDER_API, provider: SOCIAL_PROVIDER_IDS.INSTAGRAM, observedAt: "2026-07-01T22:30:00.000Z", metadata: { scope: "account" } },
    { name: "followers_growth", value: 4, source: SOCIAL_DATA_SOURCES.PROVIDER_API, provider: SOCIAL_PROVIDER_IDS.INSTAGRAM, observedAt: "2026-07-01T22:30:00.000Z", metadata: { scope: "account" } },
    { name: "content_reach", value: 11, source: SOCIAL_DATA_SOURCES.PROVIDER_API, provider: SOCIAL_PROVIDER_IDS.INSTAGRAM, observedAt: "2026-07-01T22:30:00.000Z", metadata: { scope: "content", mediaId: "ig-media-1", mediaType: "REEL", captionPreview: "Outside sales needs intelligence before activity." } },
    { name: "content_views", value: 30, source: SOCIAL_DATA_SOURCES.PROVIDER_API, provider: SOCIAL_PROVIDER_IDS.INSTAGRAM, observedAt: "2026-07-01T22:30:00.000Z", metadata: { scope: "content", mediaId: "ig-media-1", mediaType: "REEL", captionPreview: "Outside sales needs intelligence before activity." } },
    { name: "content_total_interactions", value: 12, source: SOCIAL_DATA_SOURCES.PROVIDER_API, provider: SOCIAL_PROVIDER_IDS.INSTAGRAM, observedAt: "2026-07-01T22:30:00.000Z", metadata: { scope: "content", mediaId: "ig-media-1", mediaType: "REEL", captionPreview: "Outside sales needs intelligence before activity." } }
  ],
  notes: ["Normalized Social Media provider snapshot for Companion acceptance coverage."]
});

function fail(label, payload) {
  failures += 1;
  console.error(`FAIL ${label}`, JSON.stringify(payload, null, 2));
}

function isFounderConversationRoute(response) {
  return response.metadata?.routeSelected === "founder_assistant" ||
    response.metadata?.routeSelected === "founder_conversation_engine";
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
  const answeredByConversationEngine = response.metadata?.routeSelected === "founder_conversation_engine" &&
    response.metadata?.founderConversationEngine === true;
  if (
    (!answeredByConversationEngine && response.metadata?.cognitive !== true) ||
    (!answeredByConversationEngine && response.metadata?.orchestrator !== true) ||
    response.metadata?.cardFallbackUsed === true ||
    !["intelligence_orchestrator", "founder_conversation_engine"].includes(response.metadata?.routeSelected) ||
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
  ["Hello", ["i'm here", "what are we working on"]],
  ["Good morning, Companion.", ["good morning", "everything is ready"]],
  ["Catch me up on where we left off.", ["where we left off", "last recorded point"]],
  ["What’s the current engineering status of Prometheus?", ["engineering status", "founder command layer", "stay untouched"]],
  ["Help me draft a message.", ["message draft", "i did not send anything", "draft:"]],
  ["Remind me what meetings I have.", ["founder meetings", "do not have your live calendar", "next 24 hours"]],
  ["What are my long-term goals?", ["long-term founder goals", "route intelligence"]],
  ["Help me plan my day.", ["founder day plan", "do not have your live calendar", "proof, not activity"]],
  ["How should we price this feature?", ["pricing direction", "operational value"]],
  ["What did we decide about Active Pool?", ["active pool decision", "active pool"]],
  ["What are weaknesses in my current strategy?", ["strategy weaknesses", "overbuilding"]],
  ["How does the Dashboard interact with the Data subsystem?", ["dashboard and data boundary", "data supplies governed records"]]
];

for (const [phrase, expected] of founderAcceptanceCases) {
  const response = await provider.ask(phrase);
  const text = `${response.title || ""} ${response.body || ""}`.toLowerCase();
  const missing = expected.filter((item) => !text.includes(item));
  if (response.metadata?.founderAssistant !== true || !isFounderConversationRoute(response) || missing.length) {
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

const conversationalIntentCases = [
  ["Hello", ["i'm here", "what are we working on"], "natural_greeting"],
  ["Good morning", ["good morning", "everything is ready"], "morning_greeting"],
  ["How are you?", ["online", "everything is healthy", "tackle"], "health_greeting"],
  ["Overwatch", ["engineering status", "founder command layer", "stay untouched"], "engineering_status"],
  ["Anthony", ["anthony beta progress", "anthony beta", "real usage feedback"], "anthony_beta_progress"],
  ["Website", ["website performance summary", "prometheusrouteiq.com", "public website"], "website_performance_summary"],
  ["CRM", ["crm pipeline summary", "sales pipeline", "parallel crm"], "crm_pipeline_summary"],
  ["Advice", ["not start with another feature", "validate the experience", "clean beta signal"], "founder_advice"]
];

for (const [phrase, expected, intent] of conversationalIntentCases) {
  const response = await provider.ask(phrase);
  const text = `${response.title || ""} ${response.body || ""}`.toLowerCase();
  const missing = expected.map((item) => item.toLowerCase()).filter((item) => !text.includes(item));
  const bannedHit = bannedResponseText.find((item) => text.includes(item)) ||
    founderModeBannedText.find((item) => text.includes(item));
  if (
    response.metadata?.founderAssistant !== true ||
    !isFounderConversationRoute(response) ||
    response.metadata?.intent !== intent ||
    bannedHit ||
    missing.length
  ) {
    fail("conversational-intent-router", {
      phrase,
      title: response.title,
      founderAssistant: response.metadata?.founderAssistant === true,
      routeSelected: response.metadata?.routeSelected,
      intent: response.metadata?.intent,
      expectedIntent: intent,
      bannedHit,
      missing,
      body: response.body
    });
    continue;
  }
  console.log(`PASS ${phrase} -> conversational-intent:${response.title}`);
}

const executiveReasoningCases = [
  ["How are we doing?", ["strong build position", "not a strong proof position", "recommendation"], "company_rundown"],
  ["What's slowing Prometheus down?", ["slowdown is proof", "beta validation", "next move"], "risk"],
  ["What should I do next?", ["would not start with another feature", "validate", "recommendation"], "priority"],
  ["What should I work on today?", ["would not start with another feature", "validate", "recommendation"], "priority"]
];

for (const [phrase, expected, intent] of executiveReasoningCases) {
  const route = resolveCompanionCommandRoute({
    command: phrase,
    history: provider.history,
    nodes: nodesForHarness(),
    phrasesForNode
  });
  const response = await provider.ask(phrase);
  const text = `${response.title || ""} ${response.body || ""}`.toLowerCase();
  const missing = expected.map((item) => item.toLowerCase()).filter((item) => !text.includes(item));
  const bannedHit = bannedResponseText.find((item) => text.includes(item)) ||
    founderModeBannedText.find((item) => text.includes(item));
  if (
    route.type !== "cognitive" ||
    !["intelligence_orchestrator", "founder_conversation_engine"].includes(response.metadata?.routeSelected) ||
    ![intent, response.metadata?.intent].includes(response.metadata?.orchestratorIntent || response.metadata?.intent) ||
    bannedHit ||
    missing.length
  ) {
    fail("executive-question-reasoning", {
      phrase,
      routeType: route.type,
      title: response.title,
      routeSelected: response.metadata?.routeSelected,
      orchestratorIntent: response.metadata?.orchestratorIntent,
      engineIntent: response.metadata?.intent,
      expectedIntent: intent,
      bannedHit,
      missing,
      body: response.body
    });
    continue;
  }
  console.log(`PASS ${phrase} -> executive-reasoning:${response.title}`);
}

const founderConversationEngineCases = [
  ["Good morning", ["good morning", "everything is ready"], "morning_greeting"],
  ["How are we doing?", ["strong build position", "not a strong proof position", "recommendation"], "company_rundown"],
  ["What's slowing Prometheus down?", ["slowdown is proof", "beta validation", "next move"], "risk"],
  ["What should I work on first?", ["would not start with another feature", "validate mobile", "recommendation"], "priority"]
];

for (const [phrase, expected, intent] of founderConversationEngineCases) {
  const response = await provider.ask(phrase);
  const text = `${response.title || ""} ${response.body || ""}`.toLowerCase();
  const missing = expected.map((item) => item.toLowerCase()).filter((item) => !text.includes(item));
  const bannedHit = bannedResponseText.find((item) => text.includes(item)) ||
    founderModeBannedText.find((item) => text.includes(item));
  if (
    response.metadata?.founderConversationEngine !== true ||
    response.metadata?.routeSelected !== "founder_conversation_engine" ||
    response.metadata?.intent !== intent ||
    bannedHit ||
    missing.length
  ) {
    fail("founder-conversation-engine-v1", {
      phrase,
      title: response.title,
      routeSelected: response.metadata?.routeSelected,
      founderConversationEngine: response.metadata?.founderConversationEngine === true,
      intent: response.metadata?.intent,
      expectedIntent: intent,
      bannedHit,
      missing,
      body: response.body
    });
    continue;
  }
  console.log(`PASS ${phrase} -> founder-conversation-engine:${response.title}`);
}

const unknownResponse = await provider.ask("Pineapple status");
const unknownText = `${unknownResponse.title || ""} ${unknownResponse.body || ""}`.toLowerCase();
if (
  unknownText.includes("project context") ||
  unknownText.includes("i found safe prometheus context") ||
  unknownResponse.metadata?.routeSelected !== "founder_conversation"
) {
  fail("project-context-fallback-removed", {
    title: unknownResponse.title,
    routeSelected: unknownResponse.metadata?.routeSelected,
    body: unknownResponse.body
  });
} else {
  console.log(`PASS unknown prompt stays in Founder Conversation -> ${unknownResponse.title}`);
}

const disconnectedProvider = new AIProvider();
const disconnectedCases = [
  ["Remind me what meetings I have.", ["do not have your live calendar", "next 24 hours"]],
  ["Help me draft a message.", ["i prepared the draft", "i did not send anything"]],
  ["Help me plan my day.", ["do not see synced agenda events", "proof, not activity"]]
];

for (const [phrase, expected] of disconnectedCases) {
  const response = await disconnectedProvider.ask(phrase);
  const text = `${response.title || ""} ${response.body || ""}`.toLowerCase();
  const missing = expected.map((item) => item.toLowerCase()).filter((item) => !text.includes(item));
  if (response.metadata?.integrationState !== "Disconnected" || missing.length) {
    fail("disconnected-integration-state", {
      phrase,
      title: response.title,
      integrationState: response.metadata?.integrationState,
      missing,
      body: response.body
    });
    continue;
  }
  console.log(`PASS ${phrase} -> disconnected:${response.title}`);
}

const permissionRequiredStatus = createFounderIntegrationStatus({
  state: FOUNDER_CONNECTION_STATES.PERMISSION_REQUIRED,
  provider: "test-calendar-message-provider",
  requiredPermissions: ["calendar.read", "messages.read", "messages.draft"],
  grantedPermissions: [],
  checkedAt: "2026-06-30T16:00:00.000Z"
});
const permissionProvider = new AIProvider({
  communicationsService: communicationsServiceForStatus(permissionRequiredStatus)
});

for (const phrase of [
  "Remind me what meetings I have.",
  "Help me draft a message.",
  "Help me plan my day."
]) {
  const response = await permissionProvider.ask(phrase);
  const text = `${response.title || ""} ${response.body || ""}`.toLowerCase();
  if (response.metadata?.integrationState !== "Permission Required" || !text.includes("need calendar or message permission")) {
    fail("permission-required-integration-state", {
      phrase,
      title: response.title,
      integrationState: response.metadata?.integrationState,
      body: response.body
    });
    continue;
  }
  console.log(`PASS ${phrase} -> permission-required:${response.title}`);
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

const executiveCommandCenterCases = [
  [
    "Give me my Founder Morning Brief.",
    ["founder morning brief", "engineering:", "instagram status", "recommendation:", "research:", "sales:", "website:", "crm:", "beta:", "daily priorities:"]
  ],
  [
    "Give me the executive dashboard.",
    ["executive dashboard", "company:", "product:", "beta:", "sales:", "research:", "website:", "social media:"]
  ],
  [
    "Help me decide what to prioritize today.",
    ["daily decision support", "external proof first", "engineering should", "marketing should", "sales should", "product should", "research should", "recommendation:"]
  ],
  [
    "What is the company status?",
    ["company status", "outside sales", "not the gym vertical", "founder decision:"]
  ],
  [
    "Give me engineering status.",
    ["engineering status", "founder command layer", "stay untouched", "recent engineering memory:"]
  ],
  [
    "Give me research summary.",
    ["research summary", "outside evidence", "dated research brief", "strategic uncertainty"]
  ],
  [
    "Give me sales summary.",
    ["sales summary", "pilot-first", "controlled pilot", "customer workflows"]
  ],
  [
    "Give me website summary.",
    ["website summary", "public website", "should not reveal", "readout"]
  ],
  [
    "Give me social media summary.",
    ["social media summary", "instagram should support", "publish manually", "will not auto-post"]
  ],
  [
    "Give me beta summary.",
    ["beta summary", "anthony", "must not modify anthony beta", "route clarity"]
  ],
  [
    "What company decisions do you remember?",
    ["company decision memory", "prometheus is the company", "gym sales is the first production validation environment"]
  ],
  [
    "What product decisions do you remember?",
    ["product decision memory", "sell more", "route intelligence"]
  ],
  [
    "What engineering milestones do you remember?",
    ["engineering milestone memory", "prometheus companion", "founder communications"]
  ],
  [
    "What beta findings do you remember?",
    ["beta finding memory", "anthony", "real usage feedback"]
  ],
  [
    "What investor conversations do you remember?",
    ["investor conversation memory", "no verified investor conversation records", "truth rule"]
  ],
  [
    "Run an executive strategy meeting.",
    ["executive strategy meeting", "meeting frame", "evidence needed:", "decision:"]
  ]
];

for (const [phrase, expected] of executiveCommandCenterCases) {
  const response = await provider.ask(phrase);
  const text = `${response.title || ""} ${response.body || ""}`.toLowerCase();
  const missing = expected.filter((item) => !text.includes(item));
  if (response.metadata?.executiveCommandCenter !== true || missing.length) {
    fail("executive-command-center", {
      phrase,
      title: response.title,
      executiveCommandCenter: response.metadata?.executiveCommandCenter === true,
      missing,
      body: response.body
    });
    continue;
  }
  console.log(`PASS ${phrase} -> executive:${response.title}`);
}

const founderStyleCases = [
  "Give me my Founder Morning Brief.",
  "Give me the executive dashboard.",
  "Help me decide what to prioritize today.",
  "Give me engineering status.",
  "Give me research summary.",
  "Give me sales summary.",
  "Give me website summary.",
  "Give me social media summary.",
  "Give me beta summary.",
  "Show technical details."
];

for (const phrase of founderStyleCases) {
  const response = await provider.ask(phrase);
  const text = `${response.title || ""} ${response.body || ""}`.toLowerCase();
  const developerMode = response.metadata?.developerMode === true;
  const bannedHit = developerMode ? null : founderModeBannedText.find((item) => text.includes(item));
  if (bannedHit) {
    fail("founder-mode-natural-language", {
      phrase,
      title: response.title,
      bannedHit,
      body: response.body
    });
    continue;
  }
  console.log(`PASS ${phrase} -> founder-style:${developerMode ? "developer-mode" : response.title}`);
}

const instagramAnalyticsProvider = new AIProvider({
  socialMediaAnalyticsService: socialMediaAnalyticsServiceForSnapshot(liveInstagramAnalyticsSnapshot)
});

const instagramDirectCases = [
  ["Instagram", ["instagram analytics", "prometheus i q on instagram", "50 followers", "20 reach", "8 profile visits", "3 website clicks", "best post so far", "recommendation"]],
  ["How is Instagram doing?", ["instagram analytics", "instagram status", "followers", "reach", "prometheus i q on instagram"]],
  ["Show me my Instagram analytics.", ["instagram analytics", "50 followers", "20 reach", "3 website clicks"]],
  ["How many followers do we have?", ["we have 50 instagram followers"]],
  ["How much reach did we get?", ["instagram reach is 20"]],
  ["Which post performed best?", ["best post so far: reel", "outside sales needs intelligence"]],
  ["How many website clicks came from Instagram?", ["instagram sent 3 website clicks"]],
  ["What should I post next?", ["recommendation:", "public-safe"]]
];

for (const [phrase, expected] of instagramDirectCases) {
  const response = await instagramAnalyticsProvider.ask(phrase);
  const text = `${response.title || ""} ${response.body || ""}`.toLowerCase();
  const missing = expected.filter((item) => !text.includes(item.toLowerCase()));
  if (
    response.metadata?.founderAssistant !== true ||
    response.metadata?.routeSelected !== "founder_assistant" ||
    response.metadata?.intent !== "instagram_analytics_direct_query" ||
    response.metadata?.directInstagramApiCalls !== false ||
    text.includes("project context") ||
    founderModeBannedText.some((item) => text.includes(item)) ||
    missing.length
  ) {
    fail("instagram-direct-query", {
      phrase,
      title: response.title,
      founderAssistant: response.metadata?.founderAssistant === true,
      routeSelected: response.metadata?.routeSelected,
      intent: response.metadata?.intent,
      directInstagramApiCalls: response.metadata?.directInstagramApiCalls,
      founderModeBannedHit: founderModeBannedText.find((item) => text.includes(item)),
      missing,
      body: response.body
    });
    continue;
  }
  console.log(`PASS ${phrase} -> instagram-direct:${response.title}`);
}

const instagramBrief = await instagramAnalyticsProvider.ask("Give me my Founder Morning Brief.");
const instagramBriefText = `${instagramBrief.title || ""} ${instagramBrief.body || ""}`.toLowerCase();
const instagramExpected = [
  "instagram status",
  "prometheus i q on instagram",
  "50 followers",
  "20 reach",
  "44 impressions",
  "8 profile visits",
  "3 website clicks",
  "12 engagement",
  "best post so far: reel",
  "growth is up 4",
  "crm:"
];
const instagramMissing = instagramExpected.filter((item) => !instagramBriefText.includes(item.toLowerCase()));
if (
  instagramBrief.metadata?.executiveCommandCenter !== true ||
  instagramBrief.metadata?.instagramState !== SOCIAL_CONNECTION_STATES.CONNECTED ||
  founderModeBannedText.some((item) => instagramBriefText.includes(item)) ||
  instagramMissing.length
) {
  fail("founder-morning-brief-instagram-analytics", {
    title: instagramBrief.title,
    executiveCommandCenter: instagramBrief.metadata?.executiveCommandCenter === true,
    instagramState: instagramBrief.metadata?.instagramState,
    founderModeBannedHit: founderModeBannedText.find((item) => instagramBriefText.includes(item)),
    missing: instagramMissing,
    body: instagramBrief.body
  });
} else {
  console.log(`PASS Founder Morning Brief presents Instagram analytics conversationally -> ${instagramBrief.title}`);
}

const developerModeResponse = await instagramAnalyticsProvider.ask("Developer mode: show raw data for Instagram.");
const developerModeText = `${developerModeResponse.title || ""} ${developerModeResponse.body || ""}`.toLowerCase();
if (
  developerModeResponse.metadata?.developerMode !== true ||
  !developerModeText.includes(SOCIAL_MEDIA_CONTRACT_VERSION) ||
  !developerModeText.includes("raw provider state") ||
  !developerModeText.includes("raw snapshot id")
) {
  fail("instagram-developer-mode", {
    title: developerModeResponse.title,
    developerMode: developerModeResponse.metadata?.developerMode,
    body: developerModeResponse.body
  });
} else {
  console.log(`PASS Developer Mode exposes Instagram technical details only on request -> ${developerModeResponse.title}`);
}

const appSource = readFileSync(new URL("../prometheus-os/app.js", import.meta.url), "utf8");
const providerSource = readFileSync(new URL("../prometheus-os/ai-provider.js", import.meta.url), "utf8");
const voiceAssistantSource = readFileSync(new URL("../prometheus-os/voice-assistant.js", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../prometheus-os/index.html", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../prometheus-os/style.css", import.meta.url), "utf8");
const nativeSource = readFileSync(new URL("../mac-companion/PrometheusCompanion.swift", import.meta.url), "utf8");
const uiPolicyFailures = [
  appSource.includes('kicker: "Prometheus response"') ? "normal response panel still uses Prometheus response card" : "",
  appSource.includes('kicker: "Clap detected"') ? "clap detection notification panel still exists" : "",
  appSource.includes('kicker: "Speech capture"') ? "automatic speech-capture panel still exists" : "",
  appSource.includes("I did not catch that") ? "normal no-input prompt card still exists" : "",
  !appSource.includes("function shouldDisplayConversationPanel") ? "conversation panel policy helper missing" : "",
  !voiceAssistantSource.includes("lower === item || lower.startsWith(`${item} `)") ? "wake phrase parser can strip Prometheus from the middle of executive questions" : "",
  !appSource.includes("explicitPanelRequest") ? "explicit panel request gate missing" : "",
  !appSource.includes("cardDisplayed") ? "last command result does not report card display state" : "",
  !appSource.includes("function interruptSpeech") ? "voice interrupt helper missing" : "",
  !appSource.includes("window.prometheusOSInterruptSpeech") ? "native interrupt bridge missing" : "",
  !appSource.includes("interruptOnly") ? "interrupt-only listening path missing" : "",
  !appSource.includes("commandGeneration") ? "pending response cancellation token missing" : "",
  !appSource.includes("currentCommandAbortController") ? "pending command abort controller missing" : "",
  !appSource.includes("currentCommandAbortController.abort") ? "pending reply abort missing for stop command" : "",
  !appSource.includes("scheduleListeningAfterPlayback(0)") ? "stop command does not return to listening immediately" : "",
  !appSource.includes("\"actually stop\"") ? "actually stop interrupt phrase missing" : "",
  !appSource.includes("AbortController") ? "pending TTS abort controller missing" : "",
  !appSource.includes("voice.setInterruptOnly(true)") ? "browser interim interrupt mode missing for Companion shell" : "",
  !appSource.includes('source: "command interrupt listener"') ? "stop command cannot interrupt while a response is still generating" : "",
  !appSource.includes("./ai-provider.js?v=founder-regression-fix-20260702b") ? "AI provider module cache bust missing" : "",
  !appSource.includes("./three-scene.js?v=visual-presence-v3-20260702") ? "three-scene module cache bust missing" : "",
  !providerSource.includes("./founder-conversation-engine.js?v=founder-regression-fix-20260702b") ? "Founder conversation engine module cache bust missing" : "",
  !appSource.includes("installTopChromeReveal") ? "top chrome reveal behavior missing" : "",
  !appSource.includes("refreshFounderTimeline") ? "founder timeline refresh missing from Companion runtime" : "",
  !appSource.includes("/api/founder/timeline") ? "founder timeline backend consumption missing" : "",
  !appSource.includes("setFounderTimeline") ? "founder timeline is not passed into assistant provider" : "",
  !providerSource.includes("FounderConversationEngine") ? "Founder Conversation Engine is not wired into provider" : "",
  indexSource.includes('id="statusGrid"') ? "floating subsystem tile container still exists in normal view" : "",
  indexSource.includes('class="starfield"') ? "DOM starfield layer still exists" : "",
  indexSource.includes('class="network-aura"') ? "DOM aura layer still exists" : "",
  indexSource.includes('class="neural-lines"') ? "DOM neural-line layer still exists" : "",
  indexSource.includes('class="data-points"') ? "DOM data-point layer still exists" : "",
  indexSource.includes("<span>PROMETHEUS</span>") ? "large center Prometheus wordmark still present" : "",
  indexSource.includes("event-horizon-core") ? "DOM event-horizon overlay still exists" : "",
  indexSource.includes("accretion-ring") ? "DOM accretion ring overlay still exists" : "",
  !indexSource.includes("app.js?v=founder-regression-fix-20260702") ? "app module cache bust missing from installed HTML" : "",
  !nativeSource.includes("configuration.websiteDataStore = .nonPersistent()") ? "native WebView persistent cache can serve stale Companion runtime" : "",
  !nativeSource.includes("cacheBustedOSURL") ? "native WebView load does not cache-bust installed runtime" : "",
  !nativeSource.includes("nativeFounderReply") ? "native founder fallback answers missing" : "",
  !nativeSource.includes("assistantTask?.cancel()") ? "stop command does not cancel pending assistant work" : "",
  !nativeSource.includes("premiumTtsTask?.cancel()") ? "stop command does not cancel pending premium TTS request" : "",
  !nativeSource.includes(".autoHideMenuBar") ? "native shell does not auto-hide top system menu bar" : "",
  !styleSource.includes("Companion Visual Identity Reset v1") ? "visual reset CSS override missing" : "",
  !styleSource.includes("width: 100vw") ? "full-screen visual composition missing" : "",
  !styleSource.includes("visibility: hidden") || !styleSource.includes("pointer-events: none") ? "legacy center software core is not hidden from normal view" : "",
  !styleSource.includes("body.top-chrome-visible .build-marker") ? "status chrome top-edge reveal CSS missing" : "",
  !styleSource.includes("body.developer-mode .build-marker") ? "developer mode chrome reveal CSS missing" : "",
  !styleSource.includes("body[data-voice=\"thinking\"] .prometheus-core") ? "thinking amber state missing" : "",
  !styleSource.includes("body[data-voice=\"speaking\"] .prometheus-core") ? "speaking green glow state missing" : "",
  !styleSource.includes("body[data-voice=\"listening\"] .prometheus-core") ? "listening soft-blue pulse state missing" : "",
  !styleSource.includes("@keyframes holoPanelFloat") ? "holographic panel float missing" : ""
].filter(Boolean);

if (uiPolicyFailures.length) {
  fail("voice-first-ui-policy", {
    issues: uiPolicyFailures
  });
} else {
  console.log("PASS Voice-first UI policy removes normal response cards and clap notification cards");
}

const sceneSource = readFileSync(new URL("../prometheus-os/three-scene.js", import.meta.url), "utf8");
const scenePolicyFailures = [
  !sceneSource.includes("ShaderMaterial") ? "shader-based cinematic environment missing" : "",
  !sceneSource.includes("starLayer") ? "realistic procedural star field missing" : "",
  !sceneSource.includes("nebula") ? "subtle nebula haze missing" : "",
  !sceneSource.includes("disk") ? "event-horizon accretion light missing" : "",
  !sceneSource.includes("upperLens") ? "gravitational lensing missing" : "",
  !sceneSource.includes("eventRadius") ? "event horizon absorption field missing" : "",
  !sceneSource.includes("inward") ? "inward state-energy motion missing" : "",
  !sceneSource.includes("voiceState") ? "voice-state driven cinematic colors missing" : "",
  sceneSource.includes("Points") ? "point-particle scene still present" : "",
  sceneSource.includes("TorusGeometry") ? "orbit/accretion torus geometry still present" : "",
  sceneSource.includes("SphereGeometry") ? "sphere/globe geometry still present" : "",
  sceneSource.includes("Math.random") ? "scene should use deterministic visual identity instead of random particles" : "",
  sceneSource.includes("globeGroup") ? "old dashboard globe group still present" : "",
  sceneSource.includes("routesGroup") ? "old route visualization group still present" : "",
  sceneSource.includes("nodesGroup") ? "old node visualization group still present" : "",
  sceneSource.includes("SphereGeometry(1.92") ? "old wireframe globe geometry still present" : ""
].filter(Boolean);

if (scenePolicyFailures.length) {
  fail("cinematic-operating-scene", {
    issues: scenePolicyFailures
  });
} else {
  console.log("PASS Cinematic operating scene replaces dashboard globe and subsystem-node visuals");
}

if (failures) {
  process.exitCode = 1;
}
