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

export const GOOGLE_FOUNDER_PROVIDER = "google";

export const GOOGLE_REQUIRED_PERMISSIONS = Object.freeze([
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly"
]);

export const GOOGLE_OPTIONAL_PERMISSIONS = Object.freeze([
  "https://www.googleapis.com/auth/gmail.compose"
]);

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const GOOGLE_GMAIL_BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me";

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

function attendeePerson(attendee = {}) {
  return {
    name: attendee.displayName || "",
    address: attendee.email || "",
    responseStatus: attendee.responseStatus || "unknown"
  };
}

function headerValue(headers = [], name) {
  const header = headers.find(item => String(item.name || "").toLowerCase() === name.toLowerCase());
  return header?.value || "";
}

function emailPerson(value = "") {
  const text = String(value || "");
  const match = text.match(/^(.*?)\s*<([^>]+)>$/);
  if (!match) return { name: "", address: text };
  return {
    name: match[1].replace(/^"|"$/g, "").trim(),
    address: match[2].trim()
  };
}

function splitEmailPeople(value = "") {
  if (!value) return [];
  return String(value).split(",").map(item => emailPerson(item.trim())).filter(item => item.address || item.name);
}

function googleDateTime(value = {}) {
  return value.dateTime || `${value.date}T00:00:00.000Z`;
}

function mapGoogleEvent(event = {}) {
  return {
    id: `google_calendar_${event.id}`,
    providerEventId: event.id,
    calendarId: "primary",
    title: event.summary || "Untitled calendar event",
    descriptionPreview: event.description || "",
    startsAt: googleDateTime(event.start),
    endsAt: googleDateTime(event.end),
    timezone: event.start?.timeZone || event.end?.timeZone || "America/Chicago",
    allDay: Boolean(event.start?.date && !event.start?.dateTime),
    location: event.location || "",
    meetingUrl: event.hangoutLink || event.conferenceData?.entryPoints?.find(entry => entry.uri)?.uri || null,
    organizer: event.organizer ? {
      name: event.organizer.displayName || "",
      address: event.organizer.email || ""
    } : null,
    attendees: (event.attendees || []).map(attendeePerson),
    status: event.status === "cancelled" ? "cancelled" : "confirmed",
    visibility: event.transparency === "transparent" ? "free" : "busy",
    source: GOOGLE_FOUNDER_PROVIDER,
    updatedAt: event.updated || null,
    metadata: {
      htmlLink: event.htmlLink || null,
      eventType: event.eventType || null
    }
  };
}

function mapGoogleMessage(message = {}, details = {}) {
  const headers = details.payload?.headers || [];
  const labels = details.labelIds || message.labelIds || [];
  const subject = headerValue(headers, "Subject");
  const receivedAt = details.internalDate
    ? new Date(Number(details.internalDate)).toISOString()
    : new Date().toISOString();

  return {
    id: `google_message_${details.id || message.id}`,
    providerMessageId: details.id || message.id,
    threadId: details.threadId || message.threadId || details.id || message.id,
    channel: FOUNDER_MESSAGE_CHANNELS.EMAIL,
    provider: GOOGLE_FOUNDER_PROVIDER,
    from: emailPerson(headerValue(headers, "From")),
    to: splitEmailPeople(headerValue(headers, "To")),
    cc: splitEmailPeople(headerValue(headers, "Cc")),
    subject,
    preview: details.snippet || message.snippet || "",
    receivedAt,
    unread: labels.includes("UNREAD"),
    importance: labels.includes("IMPORTANT") ? "high" : "normal",
    labels,
    actionRequired: labels.includes("IMPORTANT") || labels.includes("UNREAD"),
    source: GOOGLE_FOUNDER_PROVIDER,
    metadata: {
      historyId: details.historyId || null
    }
  };
}

function mapGoogleDraft(draft = {}, details = {}) {
  const message = details.message || draft.message || {};
  const headers = message.payload?.headers || [];
  return createDraftMessageRequest({
    id: `google_draft_${details.id || draft.id}`,
    channel: FOUNDER_MESSAGE_CHANNELS.EMAIL,
    provider: GOOGLE_FOUNDER_PROVIDER,
    to: splitEmailPeople(headerValue(headers, "To")),
    cc: splitEmailPeople(headerValue(headers, "Cc")),
    bcc: splitEmailPeople(headerValue(headers, "Bcc")),
    subject: headerValue(headers, "Subject"),
    body: message.snippet || "",
    requestedBy: "provider",
    relatedMessageId: message.threadId || null,
    createdAt: new Date().toISOString(),
    metadata: {
      providerDraftId: details.id || draft.id,
      providerMessageId: message.id || null
    }
  });
}

function googleConfigFromEnv(env = process.env) {
  return {
    clientId: env.GOOGLE_FOUNDER_CLIENT_ID,
    clientSecret: env.GOOGLE_FOUNDER_CLIENT_SECRET,
    refreshToken: env.GOOGLE_FOUNDER_REFRESH_TOKEN,
    scopes: splitScopes(env.GOOGLE_FOUNDER_SCOPES || GOOGLE_REQUIRED_PERMISSIONS.join(" "))
  };
}

function missingConfig(config) {
  return [
    ["GOOGLE_FOUNDER_CLIENT_ID", config.clientId],
    ["GOOGLE_FOUNDER_CLIENT_SECRET", config.clientSecret],
    ["GOOGLE_FOUNDER_REFRESH_TOKEN", config.refreshToken]
  ].filter(([, value]) => !value).map(([name]) => name);
}

export function createGoogleFounderCommunicationsAdapter({
  env = globalThis.process?.env || {},
  fetchImpl = globalThis.fetch
} = {}) {
  const config = googleConfigFromEnv(env);
  const missing = missingConfig(config);
  let lastStatus = missing.length
    ? missingConfigStatus({
      provider: GOOGLE_FOUNDER_PROVIDER,
      missing,
      requiredPermissions: GOOGLE_REQUIRED_PERMISSIONS
    })
    : syncPendingStatus({
      provider: GOOGLE_FOUNDER_PROVIDER,
      capabilities,
      requiredPermissions: GOOGLE_REQUIRED_PERMISSIONS,
      grantedPermissions: config.scopes
    });

  async function authorize() {
    if (missing.length) {
      lastStatus = missingConfigStatus({
        provider: GOOGLE_FOUNDER_PROVIDER,
        missing,
        requiredPermissions: GOOGLE_REQUIRED_PERMISSIONS
      });
      return { ok: false, status: lastStatus };
    }

    if (!hasRequiredScopes(config.scopes, GOOGLE_REQUIRED_PERMISSIONS)) {
      lastStatus = permissionRequiredStatus({
        provider: GOOGLE_FOUNDER_PROVIDER,
        requiredPermissions: GOOGLE_REQUIRED_PERMISSIONS,
        grantedPermissions: config.scopes
      });
      return { ok: false, status: lastStatus };
    }

    const token = await refreshOAuthAccessToken({
      fetchImpl,
      tokenUrl: GOOGLE_TOKEN_URL,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: config.refreshToken,
      scope: config.scopes.join(" "),
      provider: GOOGLE_FOUNDER_PROVIDER
    });

    if (!token.ok) {
      lastStatus = token.status;
      return token;
    }

    if (!hasRequiredScopes(token.grantedPermissions, GOOGLE_REQUIRED_PERMISSIONS)) {
      lastStatus = permissionRequiredStatus({
        provider: GOOGLE_FOUNDER_PROVIDER,
        requiredPermissions: GOOGLE_REQUIRED_PERMISSIONS,
        grantedPermissions: token.grantedPermissions
      });
      return { ok: false, status: lastStatus };
    }

    lastStatus = connectedStatus({
      provider: GOOGLE_FOUNDER_PROVIDER,
      capabilities,
      requiredPermissions: GOOGLE_REQUIRED_PERMISSIONS,
      grantedPermissions: token.grantedPermissions
    });
    return token;
  }

  async function getEvents({ startsAt, endsAt, timezone = "America/Chicago", maxResults = 50 } = {}) {
    const auth = await authorize();
    if (!auth.ok) return { ok: false, status: auth.status, events: [] };

    const url = new URL(GOOGLE_CALENDAR_EVENTS_URL);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", String(maxResults));
    url.searchParams.set("timeMin", startsAt);
    url.searchParams.set("timeMax", endsAt);
    url.searchParams.set("timeZone", timezone);

    const result = await fetchProviderJson({
      fetchImpl,
      url,
      accessToken: auth.accessToken,
      provider: GOOGLE_FOUNDER_PROVIDER
    });
    if (!result.ok) return { ok: false, status: result.status, events: [] };

    lastStatus = syncCompleteStatus({
      provider: GOOGLE_FOUNDER_PROVIDER,
      capabilities,
      requiredPermissions: GOOGLE_REQUIRED_PERMISSIONS,
      grantedPermissions: auth.grantedPermissions
    });
    return {
      ok: true,
      status: lastStatus,
      events: (result.data.items || []).map(mapGoogleEvent)
    };
  }

  async function getMessageDetails(messageIds = [], authorizedToken = null) {
    const auth = authorizedToken || await authorize();
    if (!auth.ok) return { ok: false, status: auth.status, messages: [] };

    const details = [];
    for (const message of messageIds) {
      const url = new URL(`${GOOGLE_GMAIL_BASE_URL}/messages/${message.id}`);
      url.searchParams.set("format", "metadata");
      url.searchParams.set("metadataHeaders", "From");
      url.searchParams.append("metadataHeaders", "To");
      url.searchParams.append("metadataHeaders", "Cc");
      url.searchParams.append("metadataHeaders", "Subject");

      const result = await fetchProviderJson({
        fetchImpl,
        url,
        accessToken: auth.accessToken,
        provider: GOOGLE_FOUNDER_PROVIDER
      });
      if (!result.ok) return { ok: false, status: result.status, messages: [] };
      details.push(mapGoogleMessage(message, result.data));
    }

    lastStatus = syncCompleteStatus({
      provider: GOOGLE_FOUNDER_PROVIDER,
      capabilities,
      requiredPermissions: GOOGLE_REQUIRED_PERMISSIONS,
      grantedPermissions: auth.grantedPermissions
    });
    return {
      ok: true,
      status: lastStatus,
      messages: details
    };
  }

  async function getDraftDetails(drafts = [], authorizedToken = null) {
    const auth = authorizedToken || await authorize();
    if (!auth.ok) return { ok: false, status: auth.status, drafts: [] };

    const details = [];
    for (const draft of drafts) {
      const url = new URL(`${GOOGLE_GMAIL_BASE_URL}/drafts/${draft.id}`);
      url.searchParams.set("format", "metadata");

      const result = await fetchProviderJson({
        fetchImpl,
        url,
        accessToken: auth.accessToken,
        provider: GOOGLE_FOUNDER_PROVIDER
      });
      if (!result.ok) return { ok: false, status: result.status, drafts: [] };
      details.push(mapGoogleDraft(draft, result.data));
    }

    lastStatus = syncCompleteStatus({
      provider: GOOGLE_FOUNDER_PROVIDER,
      capabilities,
      requiredPermissions: GOOGLE_REQUIRED_PERMISSIONS,
      grantedPermissions: auth.grantedPermissions
    });
    return {
      ok: true,
      status: lastStatus,
      drafts: details
    };
  }

  return {
    provider: GOOGLE_FOUNDER_PROVIDER,

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

      const url = new URL(`${GOOGLE_GMAIL_BASE_URL}/messages`);
      url.searchParams.set("maxResults", String(limit));
      url.searchParams.set("labelIds", "INBOX");
      if (cursor) url.searchParams.set("pageToken", cursor);

      const list = await fetchProviderJson({
        fetchImpl,
        url,
        accessToken: auth.accessToken,
        provider: GOOGLE_FOUNDER_PROVIDER
      });
      if (!list.ok) {
        return createMessageSummariesResponse({
          status: list.status,
          messages: [],
          cursor
        });
      }

      const details = await getMessageDetails(list.data.messages || [], auth);
      return createMessageSummariesResponse({
        status: details.status,
        messages: details.messages,
        cursor: list.data.nextPageToken || null
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

      const url = new URL(`${GOOGLE_GMAIL_BASE_URL}/drafts`);
      url.searchParams.set("maxResults", String(limit));
      if (cursor) url.searchParams.set("pageToken", cursor);

      const list = await fetchProviderJson({
        fetchImpl,
        url,
        accessToken: auth.accessToken,
        provider: GOOGLE_FOUNDER_PROVIDER
      });
      if (!list.ok) {
        return createDraftMessageRequestsResponse({
          status: list.status,
          drafts: [],
          cursor
        });
      }

      const details = await getDraftDetails(list.data.drafts || [], auth);
      return createDraftMessageRequestsResponse({
        status: details.status,
        drafts: details.drafts,
        cursor: list.data.nextPageToken || null
      });
    },

    async createDraftMessageRequest() {
      return {
        ok: false,
        status: providerErrorStatus({
          provider: GOOGLE_FOUNDER_PROVIDER,
          message: "Google draft creation is intentionally disabled. Provider adapter supports retrieval only.",
          retryable: false
        }),
        draftRequest: null
      };
    },

    async sendMessage() {
      return createUnsupportedMessageSendResponse({
        provider: GOOGLE_FOUNDER_PROVIDER,
        message: "Google message sending is disabled until explicit founder approval and a send adapter are implemented."
      });
    }
  };
}
