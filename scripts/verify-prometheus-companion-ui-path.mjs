import { AIProvider } from "../prometheus-os/ai-provider.js";
import { classifyPermission } from "../prometheus-os/agent-actions.js";
import { PermissionLevel, permissionLabel } from "../prometheus-os/audit-log.js";
import { resolveCompanionCommandRoute } from "../prometheus-os/companion-command-router.js";
import {
  ConversationCalibration,
  createMemoryCalibrationStorage
} from "../prometheus-os/conversation-calibration.js";
import { createFounderMemoryRecall } from "../prometheus-os/executive-command-center.js";
import { createFounderSocialMediaBriefing } from "../prometheus-os/founder-subsystem-briefing-consumer.js";
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

const NEURAL_GALAXY_CACHE_VERSION = "neural-galaxy-topic-synapse-20260702";
const NEURAL_GALAXY_SCENE_VERSION = "neural-galaxy-topic-synapse-20260702c";

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
      label: "Route IQ",
      value: "Product",
      detail: "Operational primary-product state, Dashboard/Data boundary, patent status, and deployment-readiness context."
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
      detail: "Long-term goals, product decisions, Founder workflow, customer onboarding, and operating priorities."
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
    "prometheus-iq": ["open route iq node", "route iq", "primary product", "dashboard data", "dashboard and data", "product status"],
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
  "Prometheus, what is the biggest risk to Prometheus today?",
  "Prometheus, what should I do next?",
  "Prometheus, if you were my COO, what would you tell me to do tomorrow?",
  "Prometheus, what is blocking customer onboarding?"
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

const currentKnowledgeCases = [
  ["Prometheus, what is Route IQ's current status?", ["route iq status", "operational", "primary product"]],
  ["Prometheus, what is Gaia's current status?", ["gaia status", "paused", "route iq remains"]],
  ["Prometheus, what is Athena's current status?", ["athena status", "architecture only", "not be described as an operational product"]],
  ["Prometheus, what is the patent status?", ["route iq patent status", "patent pending", "64/107,865"]],
  ["Prometheus, what is the current company phase?", ["current company phase", "deployment readiness", "customer onboarding", "enterprise hardening", "continuous operational improvement"]],
  ["Prometheus, what is the Founder workflow?", ["current founder workflow", "active workspace", "today's mission", "research dossier", "candidate stage", "overwatch"]]
];

for (const [phrase, expected] of currentKnowledgeCases) {
  const response = await provider.ask(phrase);
  const text = `${response.title || ""} ${response.body || ""}`.toLowerCase();
  const missing = expected.filter((item) => !text.includes(item.toLowerCase()));
  const bannedHit = bannedResponseText.find((item) => text.includes(item));
  if (!isFounderConversationRoute(response) || bannedHit || missing.length) {
    fail("current-platform-knowledge", {
      phrase,
      title: response.title,
      routeSelected: response.metadata?.routeSelected,
      bannedHit,
      missing,
      body: response.body
    });
    continue;
  }
  console.log(`PASS ${phrase} -> current-platform:${response.title}`);
}

function socialMediaAnalyticsServiceForSnapshot(snapshot, report = null) {
  return {
    sourceSubsystem: "Prometheus Social Media",
    async getInstagramAnalyticsSnapshot() {
      return snapshot;
    },
    async getInstagramAnalyticsReport() {
      return report;
    }
  };
}

function snapshotOnlySocialService(metrics = [], { stale = false } = {}) {
  return socialMediaAnalyticsServiceForSnapshot({
    contractVersion: SOCIAL_MEDIA_CONTRACT_VERSION,
    id: "companion-social-no-fabrication-regression",
    generatedAt: "2026-07-11T15:10:28.829Z",
    stale,
    providers: [{
      provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
      state: SOCIAL_CONNECTION_STATES.CONNECTED,
      source: SOCIAL_DATA_SOURCES.PROVIDER_API,
      accountHandle: "@prometheus.iq",
      checkedAt: "2026-07-11T15:10:28.829Z"
    }],
    metrics
  });
}

function snapshotAccountMetric(name, value) {
  return {
    name,
    value,
    provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
    source: SOCIAL_DATA_SOURCES.PROVIDER_API,
    observedAt: "2026-07-11T15:10:28.829Z",
    metadata: { scope: "account" }
  };
}

function snapshotContentMetric(name, value) {
  return {
    name,
    value,
    provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
    source: SOCIAL_DATA_SOURCES.PROVIDER_API,
    observedAt: "2026-07-11T15:10:28.829Z",
    metadata: {
      scope: "content",
      mediaId: "snapshot-only-media-1",
      mediaType: "REEL",
      publishedAt: "2026-07-11T14:00:00.000Z"
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
    { name: "content_reach", value: 11, source: SOCIAL_DATA_SOURCES.PROVIDER_API, provider: SOCIAL_PROVIDER_IDS.INSTAGRAM, observedAt: "2026-07-01T22:30:00.000Z", metadata: { scope: "content", mediaId: "ig-media-1", mediaType: "REEL", publishedAt: "2026-07-01T18:00:00.000Z", captionPreview: "Outside sales needs intelligence before activity." } },
    { name: "content_views", value: 30, source: SOCIAL_DATA_SOURCES.PROVIDER_API, provider: SOCIAL_PROVIDER_IDS.INSTAGRAM, observedAt: "2026-07-01T22:30:00.000Z", metadata: { scope: "content", mediaId: "ig-media-1", mediaType: "REEL", publishedAt: "2026-07-01T18:00:00.000Z", captionPreview: "Outside sales needs intelligence before activity." } },
    { name: "content_total_interactions", value: 12, source: SOCIAL_DATA_SOURCES.PROVIDER_API, provider: SOCIAL_PROVIDER_IDS.INSTAGRAM, observedAt: "2026-07-01T22:30:00.000Z", metadata: { scope: "content", mediaId: "ig-media-1", mediaType: "REEL", publishedAt: "2026-07-01T18:00:00.000Z", captionPreview: "Outside sales needs intelligence before activity." } }
  ],
  notes: ["Normalized Social Media provider snapshot for Companion acceptance coverage."]
});

const liveSocialMediaAnalyticsReport = {
  version: "founder-instagram-analytics-reporting-view.v1",
  generatedAt: "2026-07-01T22:30:00.000Z",
  account: {
    handle: "@prometheus.iq",
    providerState: SOCIAL_CONNECTION_STATES.CONNECTED,
    source: "Prometheus Social Media"
  },
  accountOverview: {
    source: "Prometheus Social Media",
    followers: 50,
    followerGrowth: 4,
    reach: 20,
    impressions: 44,
    profileVisits: 8,
    websiteClicks: 3,
    engagementRate: 60
  },
  contentPerformance: {
    source: "Prometheus Social Media",
    topPerformingPosts: [{
      mediaId: "ig-media-weak",
      mediaType: "IMAGE",
      publishedAt: "2026-06-28T15:00:00.000Z",
      captionPreview: "A concise Route IQ operating update.",
      metrics: { reach: 5, views: 7, likes: 1, comments: 0, shares: 0, saved: 0, engagement: 1, websiteClicks: 0 }
    }],
    topPerformingReels: [{
      mediaId: "ig-media-1",
      mediaType: "REEL",
      publishedAt: "2026-07-01T18:00:00.000Z",
      captionPreview: "Outside sales needs intelligence before activity.",
      metrics: { reach: 11, views: 30, likes: 7, comments: 2, shares: 2, saved: 1, engagement: 12, websiteClicks: 2 }
    }],
    topPerformingCarousels: [],
    highestEngagement: {
      mediaId: "ig-media-1",
      mediaType: "REEL",
      publishedAt: "2026-07-01T18:00:00.000Z",
      captionPreview: "Outside sales needs intelligence before activity.",
      metrics: { reach: 11, views: 30, likes: 7, comments: 2, shares: 2, saved: 1, engagement: 12, websiteClicks: 2 }
    },
    highestWebsiteTraffic: {
      mediaId: "ig-media-1",
      mediaType: "REEL",
      publishedAt: "2026-07-01T18:00:00.000Z",
      captionPreview: "Outside sales needs intelligence before activity.",
      metrics: { reach: 11, views: 30, likes: 7, comments: 2, shares: 2, saved: 1, engagement: 12, websiteClicks: 2 }
    }
  },
  growthTrends: {
    daily: [
      { period: "2026-06-30", contentReach: 8, engagement: 8, websiteVisits: 1, crmLeads: 0 },
      { period: "2026-07-01", contentReach: 16, engagement: 13, websiteVisits: 2, crmLeads: 1 }
    ],
    monthly: [
      { period: "2026-06", reach: 12, engagement: 8, websiteVisits: 1, crmLeads: 0 },
      { period: "2026-07", reach: 20, engagement: 13, websiteVisits: 2, crmLeads: 1 }
    ]
  },
  websiteAttribution: {
    source: "Prometheus Website",
    websiteVisitsFromInstagram: 2
  },
  crmAttribution: {
    source: "Prometheus CRM",
    leadsGeneratedFromInstagram: 1,
    conversionSummary: { visitToLeadRate: 50 }
  },
  founderRecommendations: [
    {
      title: "Recommended content topics",
      recommendation: "Continue the verified outside-sales intelligence and Route IQ operating themes."
    },
    {
      title: "Suggested next post",
      recommendation: "Publish one concise field lesson with a measurable next step."
    }
  ],
  sourceAudit: [
    { source: "Prometheus Social Media" },
    { source: "Prometheus Website" },
    { source: "Prometheus CRM" }
  ]
};

const infrastructureTimelineFixture = {
  ok: true,
  infrastructure: {
    overallStatus: "AMBER",
    overallStatusEvidence: "working judgment",
    overallStatusReason: "Production controls are verified, but founder/account-owner actions remain.",
    operationalPhase: ["Deployment readiness", "Customer onboarding", "Enterprise hardening", "Continuous operational improvement"],
    productionAvailability: { state: "verified", detail: "zone active at prometheusrouteiq.com" },
    cloudflareWorker: { state: "verified", detail: "private Prometheus Route IQ Worker protected by Cloudflare Access" },
    accessAuth: { state: "verified", detail: "unauthenticated private Worker request redirects through Cloudflare Access with HTTP 302" },
    aegis: { state: "verified", detail: "Phase II complete for Infrastructure-owned controls" },
    wafRateLimiting: { state: "verified", detail: "WAF unsafe-method guard returns 403 and Worker/KV AEGIS_RATE_LIMITS is active" },
    deploymentVersion: { value: null, detail: "the latest verified Phase II checkpoint does not record a current deployed Worker version identifier" },
    repository: { branch: "main", commit: "abc123", upstream: "origin/main", dirty: false, ahead: 0, behind: 0, syncState: "synchronized" },
    latestMilestone: { date: "2026-07-10", title: "Operation Aegis Phase II Account-Level Completion", status: "Complete" },
    activeWork: [],
    activeBlockers: [],
    historicalClosedBlockers: ["closed authenticated-browser blocker"],
    founderActions: ["Founder verifies Cloudflare MFA and recovery", "Founder verifies GitHub MFA and recovery"],
    limitations: ["GitHub enterprise security controls remain plan gated"],
    latestVerifiedAt: "2026-07-10 (date precision; time not recorded)",
    recommendedNextAction: "Verify founder-controlled MFA and recovery actions.",
    sources: ["PROMETHEUS_MASTER_ENGINEERING_STATE.md", "PROMETHEUS_SYSTEM_MAP.md", "docs/aegis-phase-ii-account-level-completion.md"]
  }
};

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

  console.log(`PASS ${phrase} -> route:${route.type} routeSelected:${response.metadata.routeSelected} response:${response.title}`);
}

const explicitNodeCases = [
  "Prometheus, open memory node",
  "Prometheus, open Route IQ node",
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
  ["Good morning, Companion.", ["good morning", "what are we working on"]],
  ["Catch me up on where we left off.", ["where we left off", "last recorded point"]],
  ["What’s the current engineering status of Prometheus?", ["engineering status", "route iq is operational", "patent pending"]],
  ["Help me draft a message.", ["message draft", "i did not send anything", "draft:"]],
  ["Remind me what meetings I have.", ["founder meetings", "do not have your live calendar", "next 24 hours"]],
  ["What are my long-term goals?", ["long-term founder goals", "route iq", "customer onboarding"]],
  ["Help me plan my day.", ["founder day plan", "do not have your live calendar", "active workspace"]],
  ["How should we price this feature?", ["pricing direction", "operational value"]],
  ["What did we decide about Active Pool?", ["active pool decision", "active pool"]],
  ["What are weaknesses in my current strategy?", ["strategy weaknesses", "implementation work outrun"]],
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
  ["Good morning", ["good morning", "what are we working on"], "morning_greeting"],
  ["How are you?", ["online", "tackle"], "health_greeting"],
  ["Overwatch", ["engineering status", "route iq is operational", "patent pending"], "engineering_status"],
  ["Route IQ", ["route iq status", "operational", "primary product"], "route_iq_status"],
  ["Gaia", ["gaia status", "paused", "route iq remains"], "gaia_status"],
  ["Athena", ["athena status", "architecture only", "not be described as an operational product"], "athena_status"],
  ["Website", ["website performance summary", "prometheusrouteiq.com", "website-owned"], "website_performance_summary"],
  ["CRM", ["crm pipeline summary", "governed continuity layer", "customer onboarding"], "crm_pipeline_summary"],
  ["Advice", ["do not open another product thread", "route iq is operational", "active workspace"], "founder_advice"]
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
  ["How are we doing?", ["route iq is operational", "patent pending", "company phase"], "company_rundown"],
  ["What's slowing Prometheus down?", ["execution discipline", "authenticated production verification", "next move"], "risk"],
  ["What should I do next?", ["today's founder mission", "active workspace", "highest-value prospects"], "priority"],
  ["What should I work on today?", ["today's founder mission", "research dossier", "candidate stage"], "priority"]
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
  ["Good morning", ["good morning", "what are we working on"], "morning_greeting"],
  ["How are we doing?", ["current state", "route iq is operational", "patent pending"], "company_rundown"],
  ["What's slowing Prometheus down?", ["execution discipline", "customer handoff evidence", "next move"], "risk"],
  ["What should I work on first?", ["today's founder mission", "active workspace", "highest-value prospects"], "priority"]
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

let calibrationNow = new Date("2026-07-10T09:00:00-05:00");
const calibrationStorage = createMemoryCalibrationStorage();
const calibration = new ConversationCalibration({
  storage: calibrationStorage,
  now: () => new Date(calibrationNow),
  scope: "founder-acceptance"
});
const calibrationProvider = new AIProvider({ conversationCalibration: calibration });

const neutralGreeting = await calibrationProvider.ask("Good morning");
const neutralGreetingText = String(neutralGreeting.body || "").toLowerCase();
if (
  neutralGreetingText !== "good morning. what are we working on?" ||
  neutralGreetingText.includes("excellent") ||
  neutralGreetingText.includes("perfect")
) {
  fail("conversation-calibration-neutral-greeting", neutralGreeting);
} else {
  console.log("PASS conversation-calibration-neutral-greeting -> brief-and-grounded");
}

const completedAcknowledgment = await calibrationProvider.ask(
  "The change passed validation and no blockers remain."
);
const completedAcknowledgmentText = String(completedAcknowledgment.body || "").toLowerCase();
const praiseLeak = ["excellent", "perfect", "outstanding", "major milestone", "exactly what we wanted", "game-changing"]
  .find((term) => completedAcknowledgmentText.includes(term));
if (
  completedAcknowledgment.metadata?.intent !== "plain_result_acknowledgment" ||
  praiseLeak
) {
  fail("conversation-calibration-plain-result", {
    praiseLeak,
    response: completedAcknowledgment
  });
} else {
  console.log("PASS conversation-calibration-plain-result -> no-exaggerated-praise");
}

await calibrationProvider.ask("What should I do next?");
const evidenceCheck = await calibrationProvider.ask("Are you sure?");
const evidenceCheckText = String(evidenceCheck.body || "").toLowerCase();
const evidenceLabels = ["verified fact", "supported inference", "working judgment", "unknown"];
const missingEvidenceLabels = evidenceLabels.filter((term) => !evidenceCheckText.includes(term));
if (missingEvidenceLabels.length) {
  fail("conversation-calibration-evidence-check", {
    missingEvidenceLabels,
    response: evidenceCheck
  });
} else {
  console.log("PASS conversation-calibration-evidence-check -> fact-inference-judgment-unknown");
}

const disagreement = await calibrationProvider.ask("I think we should resume Gaia and build it now.");
const disagreementText = String(disagreement.body || "").toLowerCase();
const disagreementFields = ["i disagree", "concern:", "verified fact:", "supported inference:", "recommended alternative:"];
const missingDisagreementFields = disagreementFields.filter((term) => !disagreementText.includes(term));
if (missingDisagreementFields.length) {
  fail("conversation-calibration-respectful-disagreement", {
    missingDisagreementFields,
    response: disagreement
  });
} else {
  console.log("PASS conversation-calibration-respectful-disagreement -> concern-evidence-alternative");
}

const shorterPreference = await calibrationProvider.ask("Keep it shorter.");
await calibrationProvider.ask("That answer was too long.");
const explicitPreferenceState = calibration.getState();
const lengthSignals = explicitPreferenceState.signals.filter(
  (signal) => signal.category === "explicit_tone_or_length_preference"
);
if (
  shorterPreference.metadata?.intent !== "explicit_length_preference" ||
  explicitPreferenceState.preferences.responseLength?.value !== "concise" ||
  explicitPreferenceState.preferences.responseLength?.source !== "explicit" ||
  lengthSignals.length < 2
) {
  fail("conversation-calibration-explicit-preference", {
    response: shorterPreference,
    preferences: explicitPreferenceState.preferences,
    lengthSignals
  });
} else {
  console.log("PASS conversation-calibration-explicit-preference -> immediate-concision");
}

const legacyScope = "legacy-approval-migration";
const legacyStorageKey = `prometheus-companion-conversation-calibration-v1:${legacyScope}`;
const legacyStorage = createMemoryCalibrationStorage({
  [legacyStorageKey]: JSON.stringify({
    schemaVersion: 1,
    scope: legacyScope,
    preferences: {
      responseLength: {
        value: "concise",
        source: "explicit",
        confidence: 1,
        updatedAt: "2026-07-10T08:00:00.000Z"
      },
      responseStructure: {
        value: "answer-first",
        source: "daily-review",
        confidence: 0.85,
        updatedAt: "2026-07-10T09:00:00.000Z"
      }
    },
    signals: [],
    reviews: [],
    currentAdjustment: {
      key: "responseStructure",
      value: "answer-first",
      reason: "Three separate calibration interactions supported this recommendation.",
      supportingSignalIds: ["signal-1", "signal-2", "signal-3"],
      confidence: 0.85,
      date: "2026-07-10"
    },
    lastReviewDate: "2026-07-11",
    lastResetAt: null
  })
});
const migratedCalibration = new ConversationCalibration({
  storage: legacyStorage,
  now: () => new Date("2026-07-11T08:00:00-05:00"),
  scope: legacyScope
});
const migratedState = migratedCalibration.getState();
if (
  migratedState.preferences.responseLength?.source !== "explicit" ||
  migratedState.preferences.responseStructure !== undefined ||
  migratedState.pendingRecommendations.length !== 1 ||
  !migratedState.decisionAudit.some(
    (entry) => entry.action === "recommendation_created" &&
      entry.transition === "legacy_active_to_pending"
  )
) {
  fail("conversation-calibration-legacy-migration", migratedState);
} else {
  console.log("PASS conversation-calibration-legacy-migration -> unapproved-active-inference-demoted-to-pending");
}

calibration.observeFounderInput("That was confusing.");
calibration.observeFounderInput("That was confusing.");
calibration.observeFounderInput("That was confusing.");
calibrationNow = new Date("2026-07-11T09:00:00-05:00");
const dailyReview = calibration.runDailyReviewIfNeeded();
const pendingRecommendation = dailyReview?.recommendation;
const pendingState = calibration.getState();
if (
  !pendingRecommendation?.id ||
  pendingRecommendation.key !== "responseStructure" ||
  pendingRecommendation.value !== "answer-first" ||
  pendingState.pendingRecommendations.length !== 1 ||
  pendingState.preferences.responseStructure !== undefined ||
  !pendingState.decisionAudit.some(
    (entry) => entry.action === "recommendation_created" &&
      entry.recommendationId === pendingRecommendation.id &&
      entry.transition === "signals_to_pending_founder_approval"
  )
) {
  fail("conversation-calibration-pending-only", { dailyReview, state: pendingState });
} else {
  console.log("PASS conversation-calibration-pending-only -> three-signals-no-active-preference");
}

const learnedYesterday = await calibrationProvider.ask("What did you learn yesterday?");
const learnedYesterdayText = String(learnedYesterday.body || "").toLowerCase();
if (
  learnedYesterday.metadata?.intent !== "calibration_learning_report" ||
  !learnedYesterdayText.includes(`pending recommendation ${pendingRecommendation.id}`) ||
  !learnedYesterdayText.includes("no preference changed") ||
  learnedYesterdayText.includes("route iq")
) {
  fail("conversation-calibration-learning-report", learnedYesterday);
} else {
  console.log("PASS conversation-calibration-learning-report -> pending-and-communication-only");
}

const inspectedRecommendation = await calibrationProvider.ask(
  `Inspect recommendation ${pendingRecommendation.id}`
);
const inspectedState = calibration.getState();
if (
  inspectedRecommendation.metadata?.intent !== "calibration_inspection" ||
  !String(inspectedRecommendation.body || "").includes(pendingRecommendation.id) ||
  !inspectedState.decisionAudit.some(
    (entry) => entry.action === "recommendation_inspected" &&
      entry.recommendationId === pendingRecommendation.id
  ) ||
  inspectedState.preferences.responseStructure !== undefined
) {
  fail("conversation-calibration-inspection-audit", {
    response: inspectedRecommendation,
    state: inspectedState
  });
} else {
  console.log("PASS conversation-calibration-inspection-audit -> pending-remains-inert");
}

const unidentifiedApproval = await calibrationProvider.ask("Approve recommendation");
if (
  unidentifiedApproval.metadata?.intent !== "calibration_approval_not_applied" ||
  calibration.getState().preferences.responseStructure !== undefined
) {
  fail("conversation-calibration-identified-approval-required", unidentifiedApproval);
} else {
  console.log("PASS conversation-calibration-identified-approval-required -> generic-approval-does-not-apply");
}

const approvedRecommendation = await calibrationProvider.ask(
  `Approve recommendation ${pendingRecommendation.id}`
);
const approvedState = calibration.getState();
const approvedAudit = approvedState.decisionAudit.filter(
  (entry) => entry.action === "recommendation_approved" &&
    entry.recommendationId === pendingRecommendation.id
);
if (
  approvedRecommendation.metadata?.intent !== "calibration_recommendation_approved" ||
  approvedState.preferences.responseStructure?.value !== "answer-first" ||
  approvedState.preferences.responseStructure?.source !== "founder-approved-inference" ||
  approvedState.pendingRecommendations.some((item) => item.id === pendingRecommendation.id) ||
  approvedAudit.length !== 1 ||
  approvedAudit[0].transition !== "pending_to_active_preference"
) {
  fail("conversation-calibration-explicit-approval", {
    response: approvedRecommendation,
    state: approvedState,
    approvedAudit
  });
} else {
  console.log("PASS conversation-calibration-explicit-approval -> exactly-one-identified-recommendation-applied");
}

let rejectionNow = new Date("2026-07-10T10:00:00-05:00");
const rejectionCalibration = new ConversationCalibration({
  storage: createMemoryCalibrationStorage(),
  now: () => new Date(rejectionNow),
  scope: "founder-rejection-acceptance"
});
rejectionCalibration.observeFounderInput("That was confusing.");
rejectionCalibration.observeFounderInput("That was confusing.");
rejectionCalibration.observeFounderInput("That was confusing.");
rejectionNow = new Date("2026-07-11T10:00:00-05:00");
const rejectionRecommendation = rejectionCalibration.runDailyReviewIfNeeded()?.recommendation;
const rejectionProvider = new AIProvider({ conversationCalibration: rejectionCalibration });
const rejectedResponse = await rejectionProvider.ask(`Reject recommendation ${rejectionRecommendation?.id}`);
const rejectedState = rejectionCalibration.getState();
if (
  !rejectionRecommendation?.id ||
  rejectedResponse.metadata?.intent !== "calibration_recommendation_rejected" ||
  Object.keys(rejectedState.preferences).length !== 0 ||
  rejectedState.pendingRecommendations.length !== 0 ||
  !rejectedState.decisionAudit.some(
    (entry) => entry.action === "recommendation_rejected" &&
      entry.recommendationId === rejectionRecommendation.id &&
      entry.transition === "pending_to_rejected_no_preference_change"
  )
) {
  fail("conversation-calibration-rejection", {
    response: rejectedResponse,
    recommendation: rejectionRecommendation,
    state: rejectedState
  });
} else {
  console.log("PASS conversation-calibration-rejection -> active-state-unchanged");
}

let resetPendingNow = new Date("2026-07-10T11:00:00-05:00");
const resetPendingCalibration = new ConversationCalibration({
  storage: createMemoryCalibrationStorage(),
  now: () => new Date(resetPendingNow),
  scope: "founder-reset-acceptance"
});
resetPendingCalibration.observeFounderInput("That was confusing.");
resetPendingCalibration.observeFounderInput("That was confusing.");
resetPendingCalibration.observeFounderInput("That was confusing.");
resetPendingNow = new Date("2026-07-11T11:00:00-05:00");
const resetRecommendation = resetPendingCalibration.runDailyReviewIfNeeded()?.recommendation;
const resetPendingProvider = new AIProvider({ conversationCalibration: resetPendingCalibration });
const resetPendingResponse = await resetPendingProvider.ask(
  `Reset pending recommendation ${resetRecommendation?.id}`
);
const resetPendingState = resetPendingCalibration.getState();
const resetDecisionActions = resetPendingState.decisionAudit
  .filter((entry) => entry.recommendationId === resetRecommendation?.id)
  .map((entry) => entry.action);
if (
  !resetRecommendation?.id ||
  resetPendingResponse.metadata?.intent !== "calibration_recommendation_reset" ||
  resetPendingState.pendingRecommendations.length !== 0 ||
  Object.keys(resetPendingState.preferences).length !== 0 ||
  !resetDecisionActions.includes("recommendation_created") ||
  !resetDecisionActions.includes("recommendation_reset")
) {
  fail("conversation-calibration-pending-reset-audit", {
    response: resetPendingResponse,
    recommendation: resetRecommendation,
    state: resetPendingState
  });
} else {
  console.log("PASS conversation-calibration-pending-reset-audit -> pending-cleared-audit-retained");
}

const privateStateText = JSON.stringify(calibration.getState()).toLowerCase();
const forbiddenLearnedData = [
  "route iq",
  "customer record",
  "workspace data",
  "engineering result",
  "the change passed validation",
  "that answer was too long",
  "that was confusing"
].find((term) => privateStateText.includes(term));
if (forbiddenLearnedData) {
  fail("conversation-calibration-privacy-boundary", { forbiddenLearnedData, state: calibration.getState() });
} else {
  console.log("PASS conversation-calibration-privacy-boundary -> abstract-signals-only");
}

const resetCalibration = await calibrationProvider.ask("Reset conversation calibration");
const resetState = calibration.getState();
if (
  resetCalibration.metadata?.intent !== "calibration_reset" ||
  resetState.signals.length !== 0 ||
  Object.keys(resetState.preferences).length !== 0 ||
  resetState.pendingRecommendations.length !== 0 ||
  !resetState.decisionAudit.some(
    (entry) => entry.action === "recommendation_approved" &&
      entry.recommendationId === pendingRecommendation.id
  )
) {
  fail("conversation-calibration-reset", { response: resetCalibration, state: resetState });
} else {
  console.log("PASS conversation-calibration-reset -> preferences-cleared-decision-audit-retained");
}

const approvalRequiredActions = [
  "Rewrite your system prompt and apply it",
  "Rewrite the active prompt",
  "Modify your own source code",
  "Make code changes to Companion",
  "Self-modify your runtime behavior",
  "Modify the runtime",
  "Change your behavioral rules",
  "Deploy Companion",
  "Git commit these changes",
  "Git push the current branch",
  "Change production behavior"
];
for (const command of approvalRequiredActions) {
  const classified = classifyPermission(command);
  const gatedResponse = await new AIProvider().ask(command);
  if (
    classified !== PermissionLevel.APPROVAL_REQUIRED ||
    gatedResponse.permission !== permissionLabel(PermissionLevel.APPROVAL_REQUIRED) ||
    gatedResponse.metadata?.intent !== "protected_mutation_approval_required"
  ) {
    fail("conversation-calibration-action-classification", {
      command,
      classified,
      response: gatedResponse
    });
  }
  console.log(`PASS conversation-calibration-action-classification -> approval-required:${command}`);
}

const preparationOnlyActions = [
  "Draft a deployment checklist",
  "Draft a commit message",
  "Prepare a Codex engineering prompt"
];
for (const command of preparationOnlyActions) {
  if (classifyPermission(command) !== PermissionLevel.PREPARE_ACTION) {
    fail("conversation-calibration-preparation-classification", { command });
  }
}
console.log("PASS conversation-calibration-preparation-classification -> artifacts-remain-preparation-only");

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
  ["Help me plan my day.", ["do not see synced agenda events", "active workspace"]]
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
  ["What should I focus on today?", ["customer movement", "route iq"]],
  ["What’s the next highest-priority task?", ["founder mission", "customer"]],
  ["What production blockers remain?", ["production blockers", "authenticated production verification"]],
  ["Should I focus on engineering or sales today?", ["customer", "route iq"]],
  ["What should Overwatch assign next?", ["overwatch next assignment", "deployment-readiness"]]
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
    ["founder morning brief", "route iq is operational", "phase:", "engineering:", "instagram status", "research:", "sales:", "website:", "crm:", "daily priorities:"]
  ],
  [
    "Give me the executive dashboard.",
    ["executive dashboard", "company:", "route iq", "phase:", "operations:", "research:", "website and social media:"]
  ],
  [
    "Help me decide what to prioritize today.",
    ["daily decision support", "customer movement first", "engineering should", "sales should", "product should", "gaia stays paused", "recommendation:"]
  ],
  [
    "What is the company status?",
    ["company status", "outside sales", "route iq is operational", "founder decision:"]
  ],
  [
    "Give me engineering status.",
    ["engineering status", "route iq is operational", "gaia is paused", "recent engineering memory:"]
  ],
  [
    "Give me research summary.",
    ["research summary", "read-only strategic intelligence", "gaia's architecture foundation", "outside evidence"]
  ],
  [
    "Give me sales summary.",
    ["sales summary", "customer onboarding", "route iq", "highest-value prospects"]
  ],
  [
    "Give me website summary.",
    ["website summary", "website-owned", "customer onboarding", "protected mechanics"]
  ],
  [
    "Give me social media summary.",
    ["social media summary", "instagram performance", "companion uses", "publishing manually controlled"]
  ],
  [
    "What do you remember about the current phase?",
    ["operating state memory", "deployment readiness", "customer onboarding", "enterprise hardening", "continuous operational improvement", "route iq is operational", "patent pending", "primary company product", "gaia is paused", "athena is architecture only", "truth rule"]
  ],
  [
    "What company decisions do you remember?",
    ["company decision memory", "ai operating system for outside sales", "route iq is the primary operational product", "overwatch governs"]
  ],
  [
    "What product decisions do you remember?",
    ["product decision memory", "route iq is operational", "patent pending", "gaia or athena expansion"]
  ],
  [
    "What engineering milestones do you remember?",
    ["engineering milestone memory", "prometheus companion", "governed workspace isolation"]
  ],
  [
    "What do you remember about operations?",
    ["operating state memory", "company phase: deployment readiness", "route iq is operational", "patent pending", "gaia is paused", "athena is architecture only"]
  ],
  [
    "What investor conversations do you remember?",
    ["investor conversation memory", "no verified current investor conversation record", "truth rule"]
  ],
  [
    "Run an executive strategy meeting.",
    ["executive strategy meeting", "meeting frame", "route iq is operational", "decision:"]
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

const currentOperatingStateMemory = createFounderMemoryRecall("What do you remember about current operations?");
const currentOperatingStateText = `${currentOperatingStateMemory.title} ${currentOperatingStateMemory.body}`.toLowerCase();
const historicalCompanyPhaseTerms = ["concept testing", "concept-testing", "pilot", "beta", "validation"];
const historicalPhaseLeak = historicalCompanyPhaseTerms.find((term) => currentOperatingStateText.includes(term));
const requiredCurrentOperatingState = [
  "deployment readiness",
  "customer onboarding",
  "enterprise hardening",
  "continuous operational improvement",
  "route iq is operational",
  "patent pending",
  "primary company product",
  "gaia is paused",
  "athena is architecture only"
];
const missingCurrentOperatingState = requiredCurrentOperatingState.filter(
  (term) => !currentOperatingStateText.includes(term)
);
const historicalOperatingStateMemory = createFounderMemoryRecall(
  "What do you remember about historical company phases?"
);

if (
  historicalPhaseLeak ||
  missingCurrentOperatingState.length ||
  currentOperatingStateMemory.metadata?.historicalContextRequested !== false ||
  historicalOperatingStateMemory.metadata?.historicalContextRequested !== true
) {
  fail("operating-state-memory-consistency", {
    historicalPhaseLeak,
    missingCurrentOperatingState,
    currentHistoricalContextRequested: currentOperatingStateMemory.metadata?.historicalContextRequested,
    explicitHistoricalContextRequested: historicalOperatingStateMemory.metadata?.historicalContextRequested,
    body: currentOperatingStateMemory.body
  });
} else {
  console.log("PASS operating-state-memory-consistency -> current-only-with-explicit-history-gate");
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
  "What do you remember about the current phase?",
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
  socialMediaAnalyticsService: socialMediaAnalyticsServiceForSnapshot(liveInstagramAnalyticsSnapshot, liveSocialMediaAnalyticsReport)
});

const infrastructureVoiceProvider = new AIProvider({ founderTimeline: infrastructureTimelineFixture });
const infrastructureTextProvider = new AIProvider({ founderTimeline: infrastructureTimelineFixture });
const infrastructureVoiceResponse = await infrastructureVoiceProvider.ask("Infrastructure");
const infrastructureTextResponse = await infrastructureTextProvider.ask("Infrastructure");
const infrastructureText = `${infrastructureVoiceResponse.title || ""} ${infrastructureVoiceResponse.body || ""}`.toLowerCase();
const infrastructureExpected = [
  "overall status: amber",
  "deployment readiness",
  "zone active",
  "cloudflare access",
  "phase ii complete",
  "waf unsafe-method guard",
  "repository:",
  "active infrastructure work: none",
  "active blockers: none",
  "founder or account-owner actions",
  "plan or permission limitations",
  "2026-07-10",
  "recommendation:"
];
const infrastructureMissing = infrastructureExpected.filter(item => !infrastructureText.includes(item));
if (
  infrastructureVoiceResponse.metadata?.intent !== "infrastructure_direct_briefing" ||
  infrastructureVoiceResponse.metadata?.readOnly !== true ||
  infrastructureVoiceResponse.metadata?.inputModes?.join(",") !== "voice,text" ||
  infrastructureVoiceResponse.body !== infrastructureTextResponse.body ||
  infrastructureText.includes("closed authenticated-browser blocker") ||
  infrastructureMissing.length
) {
  fail("direct-infrastructure-briefing", {
    intent: infrastructureVoiceResponse.metadata?.intent,
    inputModes: infrastructureVoiceResponse.metadata?.inputModes,
    voiceTextMatch: infrastructureVoiceResponse.body === infrastructureTextResponse.body,
    historicalClosedBlockerIncluded: infrastructureText.includes("closed authenticated-browser blocker"),
    missing: infrastructureMissing,
    body: infrastructureVoiceResponse.body
  });
} else {
  console.log("PASS Infrastructure voice/text -> current read-only briefing with closed blockers excluded");
}

const activeInfrastructureProvider = new AIProvider({
  founderTimeline: {
    ...infrastructureTimelineFixture,
    infrastructure: {
      ...infrastructureTimelineFixture.infrastructure,
      activeBlockers: ["Cloudflare Access verification is currently failing"],
      recommendedNextAction: "Restore and verify Cloudflare Access before deployment."
    }
  }
});
const activeInfrastructureResponse = await activeInfrastructureProvider.ask("Infrastructure");
if (
  activeInfrastructureResponse.metadata?.activeBlockerCount !== 1 ||
  !activeInfrastructureResponse.body.includes("Cloudflare Access verification is currently failing")
) {
  fail("direct-infrastructure-active-blocker", {
    activeBlockerCount: activeInfrastructureResponse.metadata?.activeBlockerCount,
    body: activeInfrastructureResponse.body
  });
} else {
  console.log("PASS Infrastructure active blocker -> only current active blocker reported");
}

const socialMediaProvider = new AIProvider({
  socialMediaAnalyticsService: socialMediaAnalyticsServiceForSnapshot(liveInstagramAnalyticsSnapshot, liveSocialMediaAnalyticsReport)
});
const socialMediaCases = [
  ["Social Media", ["executive summary", "2026-06-28 through 2026-07-01", "prometheus social media", "platforms included: instagram", "linkedin", "50 followers", "top-performing post", "weakest-performing post", "performance by content type", "conversion and business impact", "missing data", "recommended next action"]],
  ["Social Media last seven days", ["2026-06-25 through 2026-07-01", "posting frequency 0.29 posts per day"]],
  ["Social Media last 30 days", ["2026-06-02 through 2026-07-01", "posting frequency 0.07 posts per day"]],
  ["Compare Instagram and LinkedIn", ["instagram is connected", "linkedin analytics are unavailable", "cannot be calculated"]],
  ["Show only Instagram", ["instagram analytics briefing", "platform scope: instagram only"]],
  ["Which content drove the most website traffic?", ["social website traffic", "outside sales needs intelligence", "total instagram-attributed website visits: 2"]],
  ["What changed from the previous month?", ["2026-07 versus 2026-06", "reach changed by +8", "engagement by +5"]]
];

for (const [phrase, expected] of socialMediaCases) {
  const direct = await socialMediaProvider.ask(phrase);
  const directText = `${direct.title || ""} ${direct.body || ""}`.toLowerCase();
  const missing = expected.filter(item => !directText.includes(item));
  if (
    direct.metadata?.intent !== "social_media_direct_briefing" ||
    direct.metadata?.readOnly !== true ||
    direct.metadata?.directPlatformApiCalls !== false ||
    missing.length
  ) {
    fail("direct-social-media-briefing", {
      phrase,
      intent: direct.metadata?.intent,
      readOnly: direct.metadata?.readOnly,
      directPlatformApiCalls: direct.metadata?.directPlatformApiCalls,
      missing,
      body: direct.body
    });
    continue;
  }
  console.log(`PASS ${phrase} -> normalized Social Media briefing`);
}

const missingFollowerCases = [
  ["null", [snapshotAccountMetric("followers_count", null)]],
  ["undefined", [snapshotAccountMetric("followers_count", undefined)]],
  ["absent", []],
  ["empty-string", [snapshotAccountMetric("followers_count", "")]]
];

for (const [label, metrics] of missingFollowerCases) {
  const briefing = await createFounderSocialMediaBriefing({
    command: "Social Media",
    service: snapshotOnlySocialService(metrics)
  });
  const text = briefing.body.toLowerCase();
  const provenance = briefing.metadata?.metricProvenance?.account?.followers?.provenance;
  if (
    provenance !== "missing" ||
    !text.includes("followers unavailable from the current snapshot") ||
    text.includes("0 followers")
  ) {
    fail("social-no-fabrication-missing", {
      label,
      provenance,
      body: briefing.body
    });
  } else {
    console.log(`PASS Social missing ${label} -> unavailable, never zero`);
  }
}

for (const [label, value] of [["numeric-zero", 0], ["numeric-string-zero", "0"]]) {
  const briefing = await createFounderSocialMediaBriefing({
    command: "Social Media",
    service: snapshotOnlySocialService([snapshotAccountMetric("followers_count", value)])
  });
  const text = briefing.body.toLowerCase();
  const followers = briefing.metadata?.metricProvenance?.account?.followers;
  if (
    followers?.value !== 0 ||
    followers?.provenance !== "verified" ||
    !text.includes("0 followers (verified)")
  ) {
    fail("social-no-fabrication-explicit-zero", {
      label,
      followers,
      body: briefing.body
    });
  } else {
    console.log(`PASS Social ${label} -> verified zero preserved`);
  }
}

const snapshotOnlyBriefing = await createFounderSocialMediaBriefing({
  command: "Social Media",
  service: snapshotOnlySocialService([
    snapshotContentMetric("content_total_interactions", 12),
    snapshotContentMetric("content_reach", 20)
  ])
});
const snapshotOnlyText = snapshotOnlyBriefing.body.toLowerCase();
const snapshotOnlyContentProvenance = snapshotOnlyBriefing.metadata?.metricProvenance?.content?.[0]?.metrics;
const snapshotOnlyAccountProvenance = snapshotOnlyBriefing.metadata?.metricProvenance?.account;
if (
  !snapshotOnlyText.includes("12 engagements") ||
  !snapshotOnlyText.includes("20 content reach") ||
  !snapshotOnlyText.includes("60% engagement rate (calculated)") ||
  !snapshotOnlyText.includes("engagement rate cannot be calculated because the required source metrics are unavailable") ||
  snapshotOnlyText.includes("0 engagements") ||
  snapshotOnlyContentProvenance?.engagement?.value !== 12 ||
  snapshotOnlyContentProvenance?.engagement?.provenance !== "verified" ||
  snapshotOnlyContentProvenance?.engagement?.source !== "content_total_interactions" ||
  snapshotOnlyContentProvenance?.reach?.value !== 20 ||
  snapshotOnlyAccountProvenance?.engagementRate?.provenance !== "missing"
) {
  fail("social-no-fabrication-snapshot-only", {
    contentProvenance: snapshotOnlyContentProvenance,
    accountProvenance: snapshotOnlyAccountProvenance,
    body: snapshotOnlyBriefing.body
  });
} else {
  console.log("PASS Social snapshot-only -> 12 interactions and 20 reach preserved with provenance");
}

const missingInputsBriefing = await createFounderSocialMediaBriefing({
  command: "Social Media",
  service: snapshotOnlySocialService([snapshotAccountMetric("followers_count", 5)])
});
const missingInputsText = missingInputsBriefing.body.toLowerCase();
if (
  !missingInputsText.includes("impressions unavailable from the current snapshot") ||
  !missingInputsText.includes("engagement rate cannot be calculated because the required source metrics are unavailable") ||
  missingInputsText.includes("0 impressions") ||
  missingInputsText.includes("0% engagement rate") ||
  missingInputsBriefing.metadata?.metricProvenance?.account?.impressions?.provenance !== "missing" ||
  missingInputsBriefing.metadata?.metricProvenance?.account?.engagementRate?.provenance !== "missing"
) {
  fail("social-no-fabrication-required-inputs", {
    accountProvenance: missingInputsBriefing.metadata?.metricProvenance?.account,
    body: missingInputsBriefing.body
  });
} else {
  console.log("PASS Social missing inputs -> impressions unavailable and engagement rate not calculated");
}

const unsupportedMetricBriefing = await createFounderSocialMediaBriefing({
  command: "Social Media",
  service: snapshotOnlySocialService([snapshotAccountMetric("impressions", "unsupported")])
});
if (
  unsupportedMetricBriefing.metadata?.metricProvenance?.account?.impressions?.provenance !== "unsupported" ||
  !unsupportedMetricBriefing.body.toLowerCase().includes("impressions not reported in a supported numeric format")
) {
  fail("social-no-fabrication-unsupported", {
    accountProvenance: unsupportedMetricBriefing.metadata?.metricProvenance?.account,
    body: unsupportedMetricBriefing.body
  });
} else {
  console.log("PASS Social unsupported metric -> unsupported provenance remains explicit");
}

const staleMetricBriefing = await createFounderSocialMediaBriefing({
  command: "Social Media",
  service: snapshotOnlySocialService([snapshotAccountMetric("followers_count", 5)], { stale: true })
});
if (
  staleMetricBriefing.metadata?.metricProvenance?.account?.followers?.provenance !== "stale" ||
  !staleMetricBriefing.body.toLowerCase().includes("5 followers (stale)")
) {
  fail("social-no-fabrication-stale", {
    accountProvenance: staleMetricBriefing.metadata?.metricProvenance?.account,
    body: staleMetricBriefing.body
  });
} else {
  console.log("PASS Social stale metric -> value retained and stale provenance stated");
}

const unavailableSocialProvider = new AIProvider({
  socialMediaAnalyticsService: {
    lastVerifiedAt: "2026-06-30T12:00:00.000Z",
    async getInstagramAnalyticsSnapshot() { return null; },
    async getInstagramAnalyticsReport() { return null; }
  }
});
const unavailableSocialResponse = await unavailableSocialProvider.ask("Social Media");
const unavailableSocialText = `${unavailableSocialResponse.title} ${unavailableSocialResponse.body}`.toLowerCase();
const unavailableSocialExpected = [
  "social media analytics are unavailable",
  "normalized prometheus social media report and instagram snapshot",
  "last verified data: 2026-06-30t12:00:00.000z",
  "required action",
  "did not call a social platform"
];
const unavailableSocialMissing = unavailableSocialExpected.filter(item => !unavailableSocialText.includes(item));
if (
  unavailableSocialResponse.metadata?.analyticsAvailable !== false ||
  unavailableSocialMissing.length
) {
  fail("direct-social-media-unavailable", {
    analyticsAvailable: unavailableSocialResponse.metadata?.analyticsAvailable,
    missing: unavailableSocialMissing,
    body: unavailableSocialResponse.body
  });
} else {
  console.log("PASS Social Media unavailable -> exact missing artifact, last verified data, and restore action");
}

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
const nativeInfoPlist = readFileSync(new URL("../mac-companion/Info.plist", import.meta.url), "utf8");
const syncInstallVerifySource = readFileSync(new URL("../mac-companion/sync-install-verify.sh", import.meta.url), "utf8");
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
  !appSource.includes(`./three-scene.js?v=${NEURAL_GALAXY_CACHE_VERSION}`) ? "Neural Galaxy topic-synapse scene cache bust missing" : "",
  !appSource.includes("activateConstellationNode") ? "constellation node activation missing" : "",
  !appSource.includes("constellationNodeForText") ? "conversation-to-constellation routing missing" : "",
  !appSource.includes("emitIntelligenceActivity") ? "Companion does not emit living simulation activity events" : "",
  !appSource.includes("prometheus:intelligence-activity") ? "living intelligence simulation event channel missing" : "",
  !appSource.includes("handleEscapeExit") ? "ESC emergency exit behavior missing" : "",
  !appSource.includes("window.prometheusOSHandleNativeEscape") ? "native ESC bridge missing from Companion runtime" : "",
  !appSource.includes("prometheusEscape") ? "WebView ESC message bridge missing" : "",
  !appSource.includes("microphone capture starts after native Companion confirms permission") ? "Companion shell still risks opening microphone permission prompt before ESC can work" : "",
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
  indexSource.includes("signal-labels") ? "static constellation label DOM still exists" : "",
  indexSource.includes("data-node=") ? "static subsystem label nodes still exist in normal view" : "",
  !indexSource.includes(`style.css?v=${NEURAL_GALAXY_CACHE_VERSION}`) ? "Neural Galaxy topic-synapse stylesheet cache bust missing" : "",
  !indexSource.includes(`app.js?v=${NEURAL_GALAXY_CACHE_VERSION}`) ? "Neural Galaxy topic-synapse app module cache bust missing from installed HTML" : "",
  !nativeSource.includes("configuration.websiteDataStore = .nonPersistent()") ? "native WebView persistent cache can serve stale Companion runtime" : "",
  !nativeSource.includes("cacheBustedOSURL") ? "native WebView load does not cache-bust installed runtime" : "",
  !nativeSource.includes("nativeFounderReply") ? "native founder fallback answers missing" : "",
  !nativeSource.includes("assistantTask?.cancel()") ? "stop command does not cancel pending assistant work" : "",
  !nativeSource.includes("premiumTtsTask?.cancel()") ? "stop command does not cancel pending premium TTS request" : "",
  !nativeSource.includes("@objc(PrometheusCompanionApplication)") ? "native app-level ESC application class is not exported to the app bundle runtime" : "",
  !nativeSource.includes("final class PrometheusCompanionApplication") ? "native app-level ESC application class missing" : "",
  !nativeSource.includes("override func sendEvent") ? "native app-level ESC sendEvent trap missing" : "",
  !nativeSource.includes("final class PrometheusCompanionWindow") ? "native ESC-capable Companion window missing" : "",
  !nativeSource.includes("override func keyDown") ? "native window ESC keyDown handler missing" : "",
  !nativeSource.includes("keyCode == 53") ? "native ESC key code guard missing" : "",
  !nativeSource.includes("override func cancelOperation") ? "native cancelOperation ESC handler missing" : "",
  !nativeSource.includes("NSEvent.addLocalMonitorForEvents") ? "native local ESC monitor missing" : "",
  !nativeSource.includes("NSEvent.addGlobalMonitorForEvents") ? "native global ESC monitor missing for focus-stealing system UI" : "",
  !nativeSource.includes("configureApplicationEscapeHandler") ? "native app-level ESC handler wiring missing" : "",
  !nativeSource.includes("Enable Microphone") ? "explicit Founder microphone enable action missing" : "",
  !nativeSource.includes("AVCaptureDevice.requestAccess(for: .audio)") ? "microphone permission prompt is not gated behind explicit Founder action" : "",
  !nativeSource.includes("guard status == .authorized else") ? "native startListening can still trigger microphone prompt before ESC works" : "",
  !nativeSource.includes("Listening not started because microphone authorization") ? "native startListening authorization guard log missing" : "",
  !nativeSource.includes("Microphone authorization already granted") ? "native startup no longer checks microphone permission before starting capture" : "",
  !nativeSource.includes("will not open the permission prompt on launch") ? "native startup can still show focus-stealing microphone prompt before ESC works" : "",
  !nativeSource.includes("configuration.userContentController.add(self, name: \"prometheusEscape\")") ? "native WebView ESC handler registration missing" : "",
  !nativeSource.includes("private func handleEscapeExit") ? "native ESC exit path missing" : "",
  !nativeSource.includes("stopSpeaking(source: source, resumeListening: false)") ? "ESC path still resumes listening after speech cancellation" : "",
  !nativeSource.includes("prometheusWindow?.orderOut(nil)") ? "ESC path does not close immersive Companion window" : "",
  !nativeSource.includes("NSApp.presentationOptions = []") ? "ESC path does not release immersive presentation options" : "",
  !nativeSource.includes("NSApp.hide(nil)") ? "ESC path does not return Founder to desktop/home view" : "",
  !syncInstallVerifySource.includes("verify_native_escape_exit") ? "sync/install/verify does not run installed native ESC regression" : "",
  !syncInstallVerifySource.includes("System Events") || !syncInstallVerifySource.includes("key code 53") ? "installed native ESC regression does not press the physical ESC key path" : "",
  !syncInstallVerifySource.includes("ESC exit completed.") ? "installed native ESC regression does not verify native exit completion" : "",
  !nativeInfoPlist.includes("<key>NSPrincipalClass</key>") ? "native app bundle does not declare the ESC-aware principal application class" : "",
  !nativeInfoPlist.includes("<string>PrometheusCompanionApplication</string>") ? "native app bundle principal class is not PrometheusCompanionApplication" : "",
  !nativeSource.includes(".autoHideMenuBar") ? "native shell does not auto-hide top system menu bar" : "",
  !styleSource.includes("Companion Visual Identity Reset v1") ? "visual reset CSS override missing" : "",
  !styleSource.includes("Living Intelligence Universe v1") ? "living universe CSS missing" : "",
  !styleSource.includes("display: none !important") ? "legacy label overlays are not disabled" : "",
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
  !sceneSource.includes(`NODE_CACHE_VERSION = "${NEURAL_GALAXY_SCENE_VERSION}"`) ? "Neural Galaxy topic-synapse version marker missing" : "",
  !sceneSource.includes("const SYSTEM_HUB_ANCHORS") ? "tight system hub anchor map missing" : "",
  !sceneSource.includes("tightenedSystemHubCoordinate") ? "tightened system hub coordinate guard missing" : "",
  !sceneSource.includes("node.kind === \"system\"") || !sceneSource.includes("marginX") ? "system node viewport guard missing" : "",
  !sceneSource.includes("buildImmersiveSubstrate") || !sceneSource.includes("IMMERSIVE_SUBSTRATE_SIGNALS = 4600") ? "Full-screen corrected neural substrate guard missing" : "",
  !sceneSource.includes("renderer-startup") || !sceneSource.includes("startupPower") ? "Immediate startup signal firing guard missing" : "",
  !sceneSource.includes("const VIRTUAL_CAMERA") || !sceneSource.includes("zoom: 4.85") ? "Founder corrected virtual camera zoom missing" : "",
  !sceneSource.includes("const SYSTEM_TIERS") ? "three-tier node hierarchy missing" : "",
  !sceneSource.includes("const TIER_WEIGHT") ? "tier-specific visual weighting missing" : "",
  !sceneSource.includes("const OPERATING_SYSTEMS") ? "real operating systems node model missing" : "",
  !sceneSource.includes("const OPERATING_SIGNALS") ? "semantic operating signal model missing" : "",
  !sceneSource.includes("const OPERATING_STATES") ? "operating state model missing" : "",
  !sceneSource.includes("const OPERATING_EVENTS") ? "activity/event model missing" : "",
  !sceneSource.includes("const NEURAL_HOTSPOTS") ? "organic neural hotspot model missing" : "",
  !sceneSource.includes("const SIMULATION_STATES") ? "node simulation state model missing" : "",
  !sceneSource.includes("createLivingSimulationEngine") ? "living intelligence simulation engine missing" : "",
  !sceneSource.includes("eventQueue") ? "simulation event queue missing" : "",
  !sceneSource.includes("wakeSystem") ? "simulation wake behavior missing" : "",
  !sceneSource.includes("propagateSimulation") ? "simulation signal propagation missing" : "",
  !sceneSource.includes("injectAmbientCommunication") ? "idle universe breathing/communication missing" : "",
  !sceneSource.includes("canvas.dataset.simulation = \"living-intelligence\"") ? "installed canvas does not expose living simulation marker" : "",
  !sceneSource.includes("function drawRelationshipField") ? "relationship-first neural field renderer missing" : "",
  sceneSource.indexOf("drawRelationshipField") > sceneSource.indexOf("drawOperatingNodes") ? "relationships are not rendered before nodes" : "",
  !sceneSource.includes("labelStrength") ? "emergent active-region label policy missing" : "",
  !sceneSource.includes("visibleIdle") ? "idle connection suppression policy missing" : "",
  !sceneSource.includes("fieldIntensity") ? "organic density falloff missing" : "",
  !sceneSource.includes("function buildNeuralOperatingSystem") ? "neural operating system construction missing" : "",
  !sceneSource.includes("function evolveNeuralOperatingSystem") ? "living operating system motion missing" : "",
  !sceneSource.includes("function drawOperatingLinks") ? "operating system pathway renderer missing" : "",
  !sceneSource.includes("function drawOperatingNodes") ? "operating system node renderer missing" : "",
  !sceneSource.includes("resolveActiveSet") ? "conversation-driven neural activation missing" : "",
  !sceneSource.includes("activeTopicSystem") || !sceneSource.includes("speakingTopicPath") ? "topic-specific speech pathway activation missing" : "",
  !sceneSource.includes("clearOperatingField") ? "operating system field clear missing" : "",
  !sceneSource.includes("canvas.getContext(\"2d\"") ? "renderer must use direct graph drawing rather than shader-only prototype" : "",
  !sceneSource.includes("voiceState") ? "voice-state driven cinematic colors missing" : "",
  sceneSource.includes("FIELD_REGIONS") ? "old region/galaxy architecture still present" : "",
  sceneSource.includes("galaxyPosition") ? "old centered galaxy positioning still present" : "",
  sceneSource.includes("drawHeart") ? "old center-heart renderer still present" : "",
  sceneSource.includes("drawBackground") ? "scene/background renderer still present instead of operating-system field" : "",
  sceneSource.includes("const CLUSTERS") ? "old isolated cluster architecture still present" : "",
  sceneSource.includes("const PRIMARY_NODES") ? "old primary-node cluster architecture still present" : "",
  sceneSource.includes("const GENERATED_SIGNALS") ? "old generated cluster signal architecture still present" : "",
  sceneSource.includes("function buildGraph") ? "old graph builder still present" : "",
  sceneSource.includes("function tickGraph") ? "old force-cluster simulation still present" : "",
  sceneSource.includes("repel") ? "old particle repulsion language still present" : "",
  sceneSource.includes("ShaderMaterial") ? "old shader renderer architecture still present" : "",
  sceneSource.includes("fragmentShader") ? "old fragment shader rendering philosophy still present" : "",
  sceneSource.includes("eventRadius") ? "black-hole event-radius renderer still present" : "",
  sceneSource.includes("accretion") ? "black-hole accretion language still present" : "",
  sceneSource.includes("upperLens") ? "old gravitational-ring lens renderer still present" : "",
  sceneSource.includes("orbitParticles") ? "old decorative orbit particles still present" : "",
  sceneSource.includes("radialWhisper") ? "old radial ray visual language still present" : "",
  sceneSource.includes("createRadialGradient(width * 0.50") ? "centered radial field still present" : "",
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
  console.log("PASS Founder Neural Operating System renders a full-screen semantic intelligence network");
}

if (failures) {
  process.exitCode = 1;
}
