import { AIProvider } from "../prometheus-os/ai-provider.js";
import { resolveCompanionCommandRoute } from "../prometheus-os/companion-command-router.js";
import { normalizeIntentText } from "../prometheus-os/intent-router.js";
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
  ["What’s the current engineering status of Prometheus?", ["engineering status", "executive operating-system layer", "boundary:"]],
  ["Help me draft a message.", ["message draft", "shared integration contract", "no message was sent"]],
  ["Remind me what meetings I have.", ["founder meetings", "integration state: disconnected", "shared integration contract"]],
  ["What are my long-term goals?", ["long-term founder goals", "route intelligence"]],
  ["Help me plan my day.", ["founder day plan", "integration state: disconnected", "shared integration contract"]],
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

const disconnectedProvider = new AIProvider();
const disconnectedCases = [
  ["Remind me what meetings I have.", ["integration state: disconnected", FOUNDER_COMMUNICATIONS_CONTRACT_VERSION]],
  ["Help me draft a message.", ["integration state: disconnected", "draft_only_until_explicit_send_capability_is_connected"]],
  ["Help me plan my day.", ["integration state: disconnected", "no synced agenda events"]]
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
  if (response.metadata?.integrationState !== "Permission Required" || !text.includes("permission required") || !text.includes("calendar.read")) {
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
    ["founder morning brief", "engineering (source: overwatch)", "instagram (source: prometheus social media)", "research (source: prometheus research)", "sales (source: prometheus sales)", "website (source: prometheus website)", "crm (source: prometheus crm)", "beta (source: prometheus administration)", "daily priorities (source: prometheus companion priority engine)"]
  ],
  [
    "Give me the executive dashboard.",
    ["executive dashboard", "company:", "product:", "beta:", "sales:", "research:", "website:", "social media:"]
  ],
  [
    "Help me decide what to prioritize today.",
    ["daily decision support", "engineering:", "marketing:", "sales:", "product:", "research:", "recommendation:"]
  ],
  [
    "What is the company status?",
    ["company status", "outside sales", "not the gym vertical", "founder decision:"]
  ],
  [
    "Give me engineering status.",
    ["engineering status", "companion:", "boundary:", "recent engineering memory:"]
  ],
  [
    "Give me research summary.",
    ["research summary", "strategic intelligence division", "founder intelligence briefs", "boundary:"]
  ],
  [
    "Give me sales summary.",
    ["sales summary", "go-to-market", "controlled pilots", "crm workflows"]
  ],
  [
    "Give me website summary.",
    ["website summary", "public website", "without exposing", "boundary:"]
  ],
  [
    "Give me social media summary.",
    ["social media summary", "live instagram business analytics", "automated posting", "social media normalization"]
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
    ["executive strategy meeting", "agenda:", "evidence needed:", "decision:"]
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

const instagramAnalyticsProvider = new AIProvider({
  socialMediaAnalyticsService: socialMediaAnalyticsServiceForSnapshot(liveInstagramAnalyticsSnapshot)
});
const instagramBrief = await instagramAnalyticsProvider.ask("Give me my Founder Morning Brief.");
const instagramBriefText = `${instagramBrief.title || ""} ${instagramBrief.body || ""}`.toLowerCase();
const instagramExpected = [
  "instagram (source: prometheus social media)",
  SOCIAL_MEDIA_CONTRACT_VERSION,
  "followers: 50",
  "reach: 20",
  "impressions: 44",
  "profile visits: 8",
  "website clicks: 3",
  "engagement: 12",
  "top performing content: reel",
  "growth trend: 4",
  "presentation only",
  "no instagram api calls",
  "crm (source: prometheus crm)"
];
const instagramMissing = instagramExpected.filter((item) => !instagramBriefText.includes(item.toLowerCase()));
if (
  instagramBrief.metadata?.executiveCommandCenter !== true ||
  instagramBrief.metadata?.instagramState !== SOCIAL_CONNECTION_STATES.CONNECTED ||
  instagramMissing.length
) {
  fail("founder-morning-brief-instagram-analytics", {
    title: instagramBrief.title,
    executiveCommandCenter: instagramBrief.metadata?.executiveCommandCenter === true,
    instagramState: instagramBrief.metadata?.instagramState,
    missing: instagramMissing,
    body: instagramBrief.body
  });
} else {
  console.log(`PASS Founder Morning Brief consumes normalized Instagram analytics -> ${instagramBrief.title}`);
}

if (failures) {
  process.exitCode = 1;
}
