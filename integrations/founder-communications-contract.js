export const FOUNDER_COMMUNICATIONS_CONTRACT_VERSION = "founder-calendar-message-contract.v1";

export const FOUNDER_CONNECTION_STATES = Object.freeze({
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  PERMISSION_REQUIRED: "permission_required",
  SYNC_PENDING: "sync_pending",
  SYNC_COMPLETE: "sync_complete",
  ERROR: "error"
});

export const FOUNDER_INTEGRATION_ERROR_CODES = Object.freeze({
  NOT_CONNECTED: "not_connected",
  PERMISSION_REQUIRED: "permission_required",
  SYNC_PENDING: "sync_pending",
  SYNC_FAILED: "sync_failed",
  PROVIDER_UNAVAILABLE: "provider_unavailable",
  PROVIDER_ERROR: "provider_error",
  UNSUPPORTED_CAPABILITY: "unsupported_capability",
  VALIDATION_FAILED: "validation_failed",
  RATE_LIMITED: "rate_limited"
});

export const FOUNDER_INTEGRATION_CAPABILITIES = Object.freeze({
  READ_CALENDAR_EVENTS: "read_calendar_events",
  READ_UPCOMING_MEETINGS: "read_upcoming_meetings",
  READ_DAILY_AGENDA: "read_daily_agenda",
  READ_MESSAGE_SUMMARIES: "read_message_summaries",
  CREATE_DRAFT_MESSAGE_REQUESTS: "create_draft_message_requests",
  SEND_MESSAGES: "send_messages"
});

export const FOUNDER_MESSAGE_CHANNELS = Object.freeze({
  EMAIL: "email",
  SMS: "sms",
  CHAT: "chat",
  UNKNOWN: "unknown"
});

export const FOUNDER_EVENT_STATUSES = Object.freeze({
  CONFIRMED: "confirmed",
  TENTATIVE: "tentative",
  CANCELLED: "cancelled"
});

const SENSITIVE_KEY_PATTERN = /(token|secret|password|credential|authorization|api[_-]?key)/i;

function nowIso() {
  return new Date().toISOString();
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertEnum(value, allowed, fieldName) {
  if (!Object.values(allowed).includes(value)) {
    throw new Error(`${fieldName} must be one of: ${Object.values(allowed).join(", ")}`);
  }
}

function assertRequiredString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }
}

function optionalString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function optionalArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeIso(value, fieldName) {
  assertRequiredString(value, fieldName);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO date string.`);
  }
  return date.toISOString();
}

function stripSensitiveDetails(value) {
  if (Array.isArray(value)) {
    return value.map(stripSensitiveDetails);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : stripSensitiveDetails(child)
  ]));
}

export function createFounderIntegrationError({ code, message, retryable = false, details = {} }) {
  assertEnum(code, FOUNDER_INTEGRATION_ERROR_CODES, "error.code");
  assertRequiredString(message, "error.message");

  return {
    code,
    message,
    retryable: Boolean(retryable),
    details: stripSensitiveDetails(details)
  };
}

export function createFounderIntegrationStatus({
  state = FOUNDER_CONNECTION_STATES.DISCONNECTED,
  provider = "unconfigured",
  accountId = null,
  capabilities = {},
  requiredPermissions = [],
  grantedPermissions = [],
  lastSyncAt = null,
  checkedAt = nowIso(),
  errors = []
} = {}) {
  assertEnum(state, FOUNDER_CONNECTION_STATES, "status.state");

  return {
    contractVersion: FOUNDER_COMMUNICATIONS_CONTRACT_VERSION,
    state,
    provider,
    accountId,
    capabilities: {
      [FOUNDER_INTEGRATION_CAPABILITIES.READ_CALENDAR_EVENTS]: false,
      [FOUNDER_INTEGRATION_CAPABILITIES.READ_UPCOMING_MEETINGS]: false,
      [FOUNDER_INTEGRATION_CAPABILITIES.READ_DAILY_AGENDA]: false,
      [FOUNDER_INTEGRATION_CAPABILITIES.READ_MESSAGE_SUMMARIES]: false,
      [FOUNDER_INTEGRATION_CAPABILITIES.CREATE_DRAFT_MESSAGE_REQUESTS]: false,
      [FOUNDER_INTEGRATION_CAPABILITIES.SEND_MESSAGES]: false,
      ...capabilities
    },
    requiredPermissions: optionalArray(requiredPermissions),
    grantedPermissions: optionalArray(grantedPermissions),
    lastSyncAt,
    checkedAt: normalizeIso(checkedAt, "status.checkedAt"),
    errors: optionalArray(errors)
  };
}

export function createDisconnectedFounderIntegrationStatus({
  provider = "unconfigured",
  message = "Founder calendar and messaging integrations are not connected.",
  checkedAt = nowIso()
} = {}) {
  return createFounderIntegrationStatus({
    state: FOUNDER_CONNECTION_STATES.DISCONNECTED,
    provider,
    checkedAt,
    errors: [
      createFounderIntegrationError({
        code: FOUNDER_INTEGRATION_ERROR_CODES.NOT_CONNECTED,
        message
      })
    ]
  });
}

export function createFounderCalendarEvent(input = {}) {
  assertRequiredString(input.id, "calendarEvent.id");
  assertRequiredString(input.title, "calendarEvent.title");

  return {
    id: input.id,
    providerEventId: input.providerEventId || null,
    calendarId: input.calendarId || "primary",
    title: input.title,
    descriptionPreview: optionalString(input.descriptionPreview),
    startsAt: normalizeIso(input.startsAt, "calendarEvent.startsAt"),
    endsAt: normalizeIso(input.endsAt, "calendarEvent.endsAt"),
    timezone: optionalString(input.timezone, "America/Chicago"),
    allDay: Boolean(input.allDay),
    location: optionalString(input.location),
    meetingUrl: input.meetingUrl || null,
    organizer: input.organizer || null,
    attendees: optionalArray(input.attendees),
    status: input.status || FOUNDER_EVENT_STATUSES.CONFIRMED,
    visibility: input.visibility || "busy",
    source: input.source || "provider",
    updatedAt: input.updatedAt ? normalizeIso(input.updatedAt, "calendarEvent.updatedAt") : null,
    metadata: stripSensitiveDetails(input.metadata || {})
  };
}

export function createUpcomingMeetingsResponse({
  status = createDisconnectedFounderIntegrationStatus(),
  meetings = [],
  window = {},
  generatedAt = nowIso()
} = {}) {
  return {
    contractVersion: FOUNDER_COMMUNICATIONS_CONTRACT_VERSION,
    generatedAt: normalizeIso(generatedAt, "upcomingMeetings.generatedAt"),
    status,
    window: {
      startsAt: window.startsAt ? normalizeIso(window.startsAt, "upcomingMeetings.window.startsAt") : null,
      endsAt: window.endsAt ? normalizeIso(window.endsAt, "upcomingMeetings.window.endsAt") : null,
      timezone: optionalString(window.timezone, "America/Chicago")
    },
    meetings: meetings.map(createFounderCalendarEvent)
  };
}

export function createDailyAgendaResponse({
  date,
  timezone = "America/Chicago",
  status = createDisconnectedFounderIntegrationStatus(),
  events = [],
  generatedAt = nowIso()
} = {}) {
  assertRequiredString(date, "dailyAgenda.date");

  return {
    contractVersion: FOUNDER_COMMUNICATIONS_CONTRACT_VERSION,
    generatedAt: normalizeIso(generatedAt, "dailyAgenda.generatedAt"),
    date,
    timezone,
    status,
    events: events.map(createFounderCalendarEvent)
  };
}

export function createFounderMessageSummary(input = {}) {
  assertRequiredString(input.id, "messageSummary.id");
  assertEnum(input.channel || FOUNDER_MESSAGE_CHANNELS.UNKNOWN, FOUNDER_MESSAGE_CHANNELS, "messageSummary.channel");

  return {
    id: input.id,
    providerMessageId: input.providerMessageId || null,
    threadId: input.threadId || input.id,
    channel: input.channel || FOUNDER_MESSAGE_CHANNELS.UNKNOWN,
    provider: input.provider || "unconfigured",
    from: input.from || null,
    to: optionalArray(input.to),
    cc: optionalArray(input.cc),
    subject: optionalString(input.subject),
    preview: optionalString(input.preview),
    receivedAt: normalizeIso(input.receivedAt, "messageSummary.receivedAt"),
    unread: Boolean(input.unread),
    importance: input.importance || "normal",
    labels: optionalArray(input.labels),
    actionRequired: Boolean(input.actionRequired),
    source: input.source || "provider",
    metadata: stripSensitiveDetails(input.metadata || {})
  };
}

export function createMessageSummariesResponse({
  status = createDisconnectedFounderIntegrationStatus(),
  messages = [],
  generatedAt = nowIso(),
  cursor = null
} = {}) {
  return {
    contractVersion: FOUNDER_COMMUNICATIONS_CONTRACT_VERSION,
    generatedAt: normalizeIso(generatedAt, "messageSummaries.generatedAt"),
    status,
    cursor,
    messages: messages.map(createFounderMessageSummary)
  };
}

export function createDraftMessageRequestsResponse({
  status = createDisconnectedFounderIntegrationStatus(),
  drafts = [],
  generatedAt = nowIso(),
  cursor = null
} = {}) {
  return {
    contractVersion: FOUNDER_COMMUNICATIONS_CONTRACT_VERSION,
    generatedAt: normalizeIso(generatedAt, "draftMessageRequests.generatedAt"),
    status,
    cursor,
    drafts: drafts.map(createDraftMessageRequest)
  };
}

export function createDraftMessageRequest(input = {}) {
  assertRequiredString(input.id, "draftMessageRequest.id");
  assertEnum(input.channel || FOUNDER_MESSAGE_CHANNELS.EMAIL, FOUNDER_MESSAGE_CHANNELS, "draftMessageRequest.channel");

  return {
    id: input.id,
    channel: input.channel || FOUNDER_MESSAGE_CHANNELS.EMAIL,
    provider: input.provider || "unconfigured",
    to: optionalArray(input.to),
    cc: optionalArray(input.cc),
    bcc: optionalArray(input.bcc),
    subject: optionalString(input.subject),
    body: optionalString(input.body),
    requestedBy: input.requestedBy || "companion",
    relatedMessageId: input.relatedMessageId || null,
    createdAt: input.createdAt ? normalizeIso(input.createdAt, "draftMessageRequest.createdAt") : nowIso(),
    sendPolicy: "draft_only_until_explicit_send_capability_is_connected",
    metadata: stripSensitiveDetails(input.metadata || {})
  };
}

export function createMessageSendRequest(input = {}) {
  const draftRequest = createDraftMessageRequest(input);
  assertRequiredString(input.explicitAuthorizationId, "messageSendRequest.explicitAuthorizationId");

  return {
    ...draftRequest,
    explicitAuthorizationId: input.explicitAuthorizationId,
    sendPolicy: "requires_connected_provider_and_explicit_authorization"
  };
}

export function createUnsupportedMessageSendResponse({
  provider = "unconfigured",
  message = "Message sending is not implemented by the integrations subsystem yet."
} = {}) {
  return {
    contractVersion: FOUNDER_COMMUNICATIONS_CONTRACT_VERSION,
    ok: false,
    status: createFounderIntegrationStatus({
      state: FOUNDER_CONNECTION_STATES.DISCONNECTED,
      provider,
      errors: [
        createFounderIntegrationError({
          code: FOUNDER_INTEGRATION_ERROR_CODES.UNSUPPORTED_CAPABILITY,
          message
        })
      ]
    })
  };
}
