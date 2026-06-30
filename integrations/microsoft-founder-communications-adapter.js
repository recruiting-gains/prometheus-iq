import {
  FOUNDER_CONNECTION_STATES,
  FOUNDER_INTEGRATION_CAPABILITIES,
  FOUNDER_MESSAGE_CHANNELS,
  createDailyAgendaResponse,
  createDraftMessageRequest,
  createDraftMessageRequestsResponse,
  createMessageSummariesResponse,
  createUnsupportedMessageSendResponse,
  createUpcomingMeetingsResponse
} from "./founder-communications-contract.js";
import {
  connectedStatus,
  fetchProviderJson,
  hasRequiredScopes,
  missingConfigStatus,
  permissionRequiredStatus,
  providerErrorStatus,
  refreshOAuthAccessToken,
  splitScopes,
  syncCompleteStatus,
  syncPendingStatus
} from "./oauth-provider-auth.js";

export const MICROSOFT_FOUNDER_PROVIDER = "microsoft";

export const MICROSOFT_REQUIRED_PERMISSIONS = Object.freeze([
  "Calendars.Read",
  "Mail.Read"
]);

const MICROSOFT_GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

const capabilities = Object.freeze({
  [FOUNDER_INTEGRATION_CAPABILITIES.READ_CALENDAR_EVENTS]: true,
  [FOUNDER_INTEGRATION_CAPABILITIES.READ_UPCOMING_MEETINGS]: true,
  [FOUNDER_INTEGRATION_CAPABILITIES.READ_DAILY_AGENDA]: true,
  [FOUNDER_INTEGRATION_CAPABILITIES.READ_MESSAGE_SUMMARIES]: true,
  [FOUNDER_INTEGRATION_CAPABILITIES.CREATE_DRAFT_MESSAGE_REQUESTS]: false,
  [FOUNDER_INTEGRATION_CAPABILITIES.SEND_MESSAGES]: false
});

function addDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function dateWindow(date) {
  const start = new Date(`${date}T00:00:00.000Z`);
  return {
    startsAt: start.toISOString(),
    endsAt: addDays(start, 1).toISOString()
  };
}

function graphTokenUrl(tenantId = "common") {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
}

function microsoftPerson(value = {}) {
  const email = value.emailAddress || value;
  return {
    name: email?.name || "",
    address: email?.address || ""
  };
}

function microsoftRecipients(values = []) {
  return values.map(microsoftPerson).filter(item => item.name || item.address);
}

function microsoftDateTime(value = {}) {
  if (!value.dateTime) return new Date().toISOString();
  const normalized = value.dateTime.replace(/(\.\d{3})\d+$/, "$1");
  return normalized.endsWith("Z") ? normalized : `${normalized}Z`;
}

function mapMicrosoftEvent(event = {}) {
  return {
    id: `microsoft_calendar_${event.id}`,
    providerEventId: event.id,
    calendarId: event.calendar?.id || "primary",
    title: event.subject || "Untitled calendar event",
    descriptionPreview: event.bodyPreview || "",
    startsAt: microsoftDateTime(event.start),
    endsAt: microsoftDateTime(event.end),
    timezone: event.start?.timeZone || event.end?.timeZone || "UTC",
    allDay: Boolean(event.isAllDay),
    location: event.location?.displayName || "",
    meetingUrl: event.onlineMeeting?.joinUrl || event.onlineMeetingUrl || null,
    organizer: event.organizer ? microsoftPerson(event.organizer) : null,
    attendees: (event.attendees || []).map(attendee => ({
      ...microsoftPerson(attendee),
      responseStatus: attendee.status?.response || "unknown"
    })),
    status: event.isCancelled ? "cancelled" : "confirmed",
    visibility: event.showAs || "busy",
    source: MICROSOFT_FOUNDER_PROVIDER,
    updatedAt: event.lastModifiedDateTime || null,
    metadata: {
      webLink: event.webLink || null,
      importance: event.importance || null
    }
  };
}

function mapMicrosoftMessage(message = {}) {
  return {
    id: `microsoft_message_${message.id}`,
    providerMessageId: message.id,
    threadId: message.conversationId || message.id,
    channel: FOUNDER_MESSAGE_CHANNELS.EMAIL,
    provider: MICROSOFT_FOUNDER_PROVIDER,
    from: message.from ? microsoftPerson(message.from) : null,
    to: microsoftRecipients(message.toRecipients || []),
    cc: microsoftRecipients(message.ccRecipients || []),
    subject: message.subject || "",
    preview: message.bodyPreview || "",
    receivedAt: message.receivedDateTime || message.lastModifiedDateTime || new Date().toISOString(),
    unread: Boolean(message.isRead === false),
    importance: message.importance || "normal",
    labels: message.categories || [],
    actionRequired: message.importance === "high" || message.isRead === false,
    source: MICROSOFT_FOUNDER_PROVIDER,
    metadata: {
      webLink: message.webLink || null,
      internetMessageId: message.internetMessageId || null
    }
  };
}

function mapMicrosoftDraft(message = {}) {
  return createDraftMessageRequest({
    id: `microsoft_draft_${message.id}`,
    channel: FOUNDER_MESSAGE_CHANNELS.EMAIL,
    provider: MICROSOFT_FOUNDER_PROVIDER,
    to: microsoftRecipients(message.toRecipients || []),
    cc: microsoftRecipients(message.ccRecipients || []),
    bcc: microsoftRecipients(message.bccRecipients || []),
    subject: message.subject || "",
    body: message.bodyPreview || "",
    requestedBy: "provider",
    relatedMessageId: message.conversationId || null,
    createdAt: message.lastModifiedDateTime || new Date().toISOString(),
    metadata: {
      providerMessageId: message.id,
      webLink: message.webLink || null
    }
  });
}

function microsoftConfigFromEnv(env = process.env) {
  return {
    tenantId: env.MICROSOFT_FOUNDER_TENANT_ID || "common",
    clientId: env.MICROSOFT_FOUNDER_CLIENT_ID,
    clientSecret: env.MICROSOFT_FOUNDER_CLIENT_SECRET,
    refreshToken: env.MICROSOFT_FOUNDER_REFRESH_TOKEN,
    scopes: splitScopes(env.MICROSOFT_FOUNDER_SCOPES || MICROSOFT_REQUIRED_PERMISSIONS.join(" "))
  };
}

function missingConfig(config) {
  return [
    ["MICROSOFT_FOUNDER_CLIENT_ID", config.clientId],
    ["MICROSOFT_FOUNDER_CLIENT_SECRET", config.clientSecret],
    ["MICROSOFT_FOUNDER_REFRESH_TOKEN", config.refreshToken]
  ].filter(([, value]) => !value).map(([name]) => name);
}

export function createMicrosoftFounderCommunicationsAdapter({
  env = globalThis.process?.env || {},
  fetchImpl = globalThis.fetch
} = {}) {
  const config = microsoftConfigFromEnv(env);
  const missing = missingConfig(config);
  let lastStatus = missing.length
    ? missingConfigStatus({
      provider: MICROSOFT_FOUNDER_PROVIDER,
      missing,
      requiredPermissions: MICROSOFT_REQUIRED_PERMISSIONS
    })
    : syncPendingStatus({
      provider: MICROSOFT_FOUNDER_PROVIDER,
      capabilities,
      requiredPermissions: MICROSOFT_REQUIRED_PERMISSIONS,
      grantedPermissions: config.scopes
    });

  async function authorize() {
    if (missing.length) {
      lastStatus = missingConfigStatus({
        provider: MICROSOFT_FOUNDER_PROVIDER,
        missing,
        requiredPermissions: MICROSOFT_REQUIRED_PERMISSIONS
      });
      return { ok: false, status: lastStatus };
    }

    if (!hasRequiredScopes(config.scopes, MICROSOFT_REQUIRED_PERMISSIONS)) {
      lastStatus = permissionRequiredStatus({
        provider: MICROSOFT_FOUNDER_PROVIDER,
        requiredPermissions: MICROSOFT_REQUIRED_PERMISSIONS,
        grantedPermissions: config.scopes
      });
      return { ok: false, status: lastStatus };
    }

    const token = await refreshOAuthAccessToken({
      fetchImpl,
      tokenUrl: graphTokenUrl(config.tenantId),
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: config.refreshToken,
      scope: config.scopes.join(" "),
      provider: MICROSOFT_FOUNDER_PROVIDER
    });

    if (!token.ok) {
      lastStatus = token.status;
      return token;
    }

    if (!hasRequiredScopes(token.grantedPermissions, MICROSOFT_REQUIRED_PERMISSIONS)) {
      lastStatus = permissionRequiredStatus({
        provider: MICROSOFT_FOUNDER_PROVIDER,
        requiredPermissions: MICROSOFT_REQUIRED_PERMISSIONS,
        grantedPermissions: token.grantedPermissions
      });
      return { ok: false, status: lastStatus };
    }

    lastStatus = connectedStatus({
      provider: MICROSOFT_FOUNDER_PROVIDER,
      capabilities,
      requiredPermissions: MICROSOFT_REQUIRED_PERMISSIONS,
      grantedPermissions: token.grantedPermissions
    });
    return token;
  }

  async function getEvents({ startsAt, endsAt, timezone = "America/Chicago", maxResults = 50 } = {}) {
    const auth = await authorize();
    if (!auth.ok) return { ok: false, status: auth.status, events: [] };

    const url = new URL(`${MICROSOFT_GRAPH_BASE_URL}/me/calendarView`);
    url.searchParams.set("startDateTime", startsAt);
    url.searchParams.set("endDateTime", endsAt);
    url.searchParams.set("$top", String(maxResults));
    url.searchParams.set("$orderby", "start/dateTime");

    const result = await fetchProviderJson({
      fetchImpl,
      url,
      accessToken: auth.accessToken,
      provider: MICROSOFT_FOUNDER_PROVIDER,
      init: {
        headers: {
          Prefer: `outlook.timezone="${timezone}"`
        }
      }
    });
    if (!result.ok) return { ok: false, status: result.status, events: [] };

    lastStatus = syncCompleteStatus({
      provider: MICROSOFT_FOUNDER_PROVIDER,
      capabilities,
      requiredPermissions: MICROSOFT_REQUIRED_PERMISSIONS,
      grantedPermissions: auth.grantedPermissions
    });
    return {
      ok: true,
      status: lastStatus,
      events: (result.data.value || []).map(mapMicrosoftEvent)
    };
  }

  return {
    provider: MICROSOFT_FOUNDER_PROVIDER,

    async getConnectionStatus() {
      if (missing.length) return lastStatus;
      const auth = await authorize();
      return auth.ok ? lastStatus : auth.status;
    },

    async getUpcomingMeetings({ window = {} } = {}) {
      const startsAt = window.startsAt || new Date().toISOString();
      const endsAt = window.endsAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const result = await getEvents({
        startsAt,
        endsAt,
        timezone: window.timezone
      });
      return createUpcomingMeetingsResponse({
        status: result.status,
        window: {
          startsAt,
          endsAt,
          timezone: window.timezone || "America/Chicago"
        },
        meetings: result.events
      });
    },

    async getDailyAgenda({ date = new Date().toISOString().slice(0, 10), timezone = "America/Chicago" } = {}) {
      const window = dateWindow(date);
      const result = await getEvents({
        ...window,
        timezone,
        maxResults: 100
      });
      return createDailyAgendaResponse({
        date,
        timezone,
        status: result.status,
        events: result.events
      });
    },

    async listMessageSummaries({ cursor = null, limit = 20 } = {}) {
      const auth = await authorize();
      if (!auth.ok) {
        return createMessageSummariesResponse({
          status: auth.status,
          messages: [],
          cursor
        });
      }

      const url = cursor ? new URL(cursor) : new URL(`${MICROSOFT_GRAPH_BASE_URL}/me/mailFolders/inbox/messages`);
      if (!cursor) {
        url.searchParams.set("$top", String(limit));
        url.searchParams.set("$orderby", "receivedDateTime desc");
        url.searchParams.set("$select", [
          "id",
          "conversationId",
          "subject",
          "bodyPreview",
          "receivedDateTime",
          "lastModifiedDateTime",
          "from",
          "toRecipients",
          "ccRecipients",
          "isRead",
          "importance",
          "categories",
          "webLink",
          "internetMessageId"
        ].join(","));
      }

      const result = await fetchProviderJson({
        fetchImpl,
        url,
        accessToken: auth.accessToken,
        provider: MICROSOFT_FOUNDER_PROVIDER
      });
      if (!result.ok) {
        return createMessageSummariesResponse({
          status: result.status,
          messages: [],
          cursor
        });
      }

      lastStatus = syncCompleteStatus({
        provider: MICROSOFT_FOUNDER_PROVIDER,
        capabilities,
        requiredPermissions: MICROSOFT_REQUIRED_PERMISSIONS,
        grantedPermissions: auth.grantedPermissions
      });
      return createMessageSummariesResponse({
        status: lastStatus,
        messages: (result.data.value || []).map(mapMicrosoftMessage),
        cursor: result.data["@odata.nextLink"] || null
      });
    },

    async listDraftMessageRequests({ cursor = null, limit = 20 } = {}) {
      const auth = await authorize();
      if (!auth.ok) {
        return createDraftMessageRequestsResponse({
          status: auth.status,
          drafts: [],
          cursor
        });
      }

      const url = cursor ? new URL(cursor) : new URL(`${MICROSOFT_GRAPH_BASE_URL}/me/mailFolders/drafts/messages`);
      if (!cursor) {
        url.searchParams.set("$top", String(limit));
        url.searchParams.set("$orderby", "lastModifiedDateTime desc");
        url.searchParams.set("$select", [
          "id",
          "conversationId",
          "subject",
          "bodyPreview",
          "lastModifiedDateTime",
          "toRecipients",
          "ccRecipients",
          "bccRecipients",
          "webLink"
        ].join(","));
      }

      const result = await fetchProviderJson({
        fetchImpl,
        url,
        accessToken: auth.accessToken,
        provider: MICROSOFT_FOUNDER_PROVIDER
      });
      if (!result.ok) {
        return createDraftMessageRequestsResponse({
          status: result.status,
          drafts: [],
          cursor
        });
      }

      lastStatus = syncCompleteStatus({
        provider: MICROSOFT_FOUNDER_PROVIDER,
        capabilities,
        requiredPermissions: MICROSOFT_REQUIRED_PERMISSIONS,
        grantedPermissions: auth.grantedPermissions
      });
      return createDraftMessageRequestsResponse({
        status: lastStatus,
        drafts: (result.data.value || []).map(mapMicrosoftDraft),
        cursor: result.data["@odata.nextLink"] || null
      });
    },

    async createDraftMessageRequest() {
      return {
        ok: false,
        status: providerErrorStatus({
          provider: MICROSOFT_FOUNDER_PROVIDER,
          message: "Microsoft draft creation is intentionally disabled. Provider adapter supports retrieval only.",
          retryable: false
        }),
        draftRequest: null
      };
    },

    async sendMessage() {
      return createUnsupportedMessageSendResponse({
        provider: MICROSOFT_FOUNDER_PROVIDER,
        message: "Microsoft message sending is disabled until explicit founder approval and a send adapter are implemented."
      });
    }
  };
}
