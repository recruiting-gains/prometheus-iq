import test from "node:test";
import assert from "node:assert/strict";
import {
  FOUNDER_CONNECTION_STATES,
  FOUNDER_INTEGRATION_ERROR_CODES
} from "../integrations/founder-communications-contract.js";
import {
  createFounderCommunicationsAdapterFromEnv,
  createFounderCommunicationsService
} from "../integrations/founder-communications-service.js";
import {
  GOOGLE_REQUIRED_PERMISSIONS,
  createGoogleFounderCommunicationsAdapter
} from "../integrations/google-founder-communications-adapter.js";
import {
  MICROSOFT_REQUIRED_PERMISSIONS,
  createMicrosoftFounderCommunicationsAdapter
} from "../integrations/microsoft-founder-communications-adapter.js";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    }
  };
}

function createOrderedFetch(responses) {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    const next = responses.shift();
    assert.ok(next, `unexpected fetch call: ${String(input)}`);
    if (typeof next.assert === "function") next.assert(String(input), init);
    return jsonResponse(next.status || 200, next.body || {});
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

const googleEnv = {
  GOOGLE_FOUNDER_CLIENT_ID: "google-client",
  GOOGLE_FOUNDER_CLIENT_SECRET: "google-client-secret-placeholder",
  GOOGLE_FOUNDER_REFRESH_TOKEN: "google-refresh-placeholder",
  GOOGLE_FOUNDER_SCOPES: GOOGLE_REQUIRED_PERMISSIONS.join(" ")
};

const microsoftEnv = {
  MICROSOFT_FOUNDER_CLIENT_ID: "microsoft-client",
  MICROSOFT_FOUNDER_CLIENT_SECRET: "microsoft-client-secret-placeholder",
  MICROSOFT_FOUNDER_REFRESH_TOKEN: "microsoft-refresh-placeholder",
  MICROSOFT_FOUNDER_SCOPES: MICROSOFT_REQUIRED_PERMISSIONS.join(" ")
};

test("Google adapter maps calendar events into the founder contract", async () => {
  const fetchImpl = createOrderedFetch([
    {
      assert: (url, init) => {
        assert.equal(url, "https://oauth2.googleapis.com/token");
        assert.equal(init.method, "POST");
      },
      body: {
        access_token: "google-access-placeholder",
        scope: GOOGLE_REQUIRED_PERMISSIONS.join(" "),
        expires_in: 3600
      }
    },
    {
      assert: (url, init) => {
        assert.ok(url.startsWith("https://www.googleapis.com/calendar/v3/calendars/primary/events"));
        assert.equal(init.headers.Authorization, "Bearer google-access-placeholder");
      },
      body: {
        items: [
          {
            id: "evt-1",
            summary: "Founder operating review",
            description: "Review pilot follow-up.",
            start: { dateTime: "2026-06-30T15:00:00-05:00", timeZone: "America/Chicago" },
            end: { dateTime: "2026-06-30T15:30:00-05:00", timeZone: "America/Chicago" },
            hangoutLink: "https://meet.google.com/example",
            organizer: { email: "founder@example.com", displayName: "Founder" },
            attendees: [{ email: "pilot@example.com", displayName: "Pilot Lead", responseStatus: "accepted" }],
            updated: "2026-06-30T14:00:00Z"
          }
        ]
      }
    }
  ]);
  const adapter = createGoogleFounderCommunicationsAdapter({ env: googleEnv, fetchImpl });

  const result = await adapter.getUpcomingMeetings({
    window: {
      startsAt: "2026-06-30T00:00:00.000Z",
      endsAt: "2026-07-01T00:00:00.000Z",
      timezone: "America/Chicago"
    }
  });

  assert.equal(result.status.state, FOUNDER_CONNECTION_STATES.SYNC_COMPLETE);
  assert.equal(result.meetings[0].providerEventId, "evt-1");
  assert.equal(result.meetings[0].title, "Founder operating review");
  assert.equal(result.meetings[0].meetingUrl, "https://meet.google.com/example");
});

test("Google adapter maps Gmail summaries and draft retrieval without sending", async () => {
  const fetchImpl = createOrderedFetch([
    {
      body: {
        access_token: "google-access-placeholder",
        scope: GOOGLE_REQUIRED_PERMISSIONS.join(" ")
      }
    },
    {
      assert: url => assert.ok(url.startsWith("https://gmail.googleapis.com/gmail/v1/users/me/messages")),
      body: {
        messages: [{ id: "msg-1", threadId: "thread-1" }],
        nextPageToken: "next-messages"
      }
    },
    {
      assert: url => assert.ok(url.includes("/messages/msg-1")),
      body: {
        id: "msg-1",
        threadId: "thread-1",
        internalDate: "1782838800000",
        labelIds: ["INBOX", "UNREAD"],
        snippet: "Can we review the pilot plan?",
        payload: {
          headers: [
            { name: "From", value: "Pilot Lead <pilot@example.com>" },
            { name: "To", value: "Founder <founder@example.com>" },
            { name: "Subject", value: "Pilot plan" }
          ]
        }
      }
    },
    {
      body: {
        access_token: "google-access-placeholder",
        scope: GOOGLE_REQUIRED_PERMISSIONS.join(" ")
      }
    },
    {
      assert: url => assert.ok(url.startsWith("https://gmail.googleapis.com/gmail/v1/users/me/drafts")),
      body: {
        drafts: [{ id: "draft-1" }]
      }
    },
    {
      assert: url => assert.ok(url.includes("/drafts/draft-1")),
      body: {
        id: "draft-1",
        message: {
          id: "draft-msg-1",
          threadId: "thread-2",
          snippet: "Draft body preview",
          payload: {
            headers: [
              { name: "To", value: "Pilot Lead <pilot@example.com>" },
              { name: "Subject", value: "Draft pilot reply" }
            ]
          }
        }
      }
    }
  ]);
  const adapter = createGoogleFounderCommunicationsAdapter({ env: googleEnv, fetchImpl });

  const messages = await adapter.listMessageSummaries({ limit: 1 });
  const drafts = await adapter.listDraftMessageRequests({ limit: 1 });
  const send = await adapter.sendMessage();

  assert.equal(messages.messages[0].from.address, "pilot@example.com");
  assert.equal(messages.messages[0].unread, true);
  assert.equal(messages.cursor, "next-messages");
  assert.equal(drafts.drafts[0].subject, "Draft pilot reply");
  assert.equal(send.ok, false);
  assert.equal(send.status.errors[0].code, FOUNDER_INTEGRATION_ERROR_CODES.UNSUPPORTED_CAPABILITY);
});

test("Google adapter reports missing configuration and missing permissions", async () => {
  const missing = createGoogleFounderCommunicationsAdapter({ env: {}, fetchImpl: createOrderedFetch([]) });
  const missingStatus = await missing.getConnectionStatus();

  const scoped = createGoogleFounderCommunicationsAdapter({
    env: {
      ...googleEnv,
      GOOGLE_FOUNDER_SCOPES: "https://www.googleapis.com/auth/calendar.readonly"
    },
    fetchImpl: createOrderedFetch([])
  });
  const permissionStatus = await scoped.getConnectionStatus();

  assert.equal(missingStatus.state, FOUNDER_CONNECTION_STATES.DISCONNECTED);
  assert.equal(permissionStatus.state, FOUNDER_CONNECTION_STATES.PERMISSION_REQUIRED);
});

test("Microsoft adapter maps calendar, inbox messages, and drafts into the founder contract", async () => {
  const fetchImpl = createOrderedFetch([
    {
      assert: url => assert.equal(url, "https://login.microsoftonline.com/common/oauth2/v2.0/token"),
      body: {
        access_token: "microsoft-access-placeholder",
        scope: MICROSOFT_REQUIRED_PERMISSIONS.join(" ")
      }
    },
    {
      assert: (url, init) => {
        assert.ok(url.startsWith("https://graph.microsoft.com/v1.0/me/calendarView"));
        assert.equal(init.headers.Authorization, "Bearer microsoft-access-placeholder");
        assert.equal(init.headers.Prefer, "outlook.timezone=\"America/Chicago\"");
      },
      body: {
        value: [
          {
            id: "ms-event-1",
            subject: "Microsoft founder review",
            bodyPreview: "Review Microsoft calendar sync.",
            start: { dateTime: "2026-06-30T15:00:00", timeZone: "America/Chicago" },
            end: { dateTime: "2026-06-30T15:30:00", timeZone: "America/Chicago" },
            location: { displayName: "Teams" },
            onlineMeeting: { joinUrl: "https://teams.microsoft.com/example" },
            organizer: { emailAddress: { name: "Founder", address: "founder@example.com" } },
            attendees: [{ emailAddress: { name: "Pilot", address: "pilot@example.com" }, status: { response: "accepted" } }]
          }
        ]
      }
    },
    {
      body: {
        access_token: "microsoft-access-placeholder",
        scope: MICROSOFT_REQUIRED_PERMISSIONS.join(" ")
      }
    },
    {
      assert: url => assert.ok(url.startsWith("https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages")),
      body: {
        value: [
          {
            id: "ms-message-1",
            conversationId: "ms-thread-1",
            subject: "Microsoft inbox",
            bodyPreview: "Inbox preview",
            receivedDateTime: "2026-06-30T16:00:00Z",
            from: { emailAddress: { name: "Pilot", address: "pilot@example.com" } },
            toRecipients: [{ emailAddress: { name: "Founder", address: "founder@example.com" } }],
            isRead: false,
            importance: "high",
            categories: ["Pilot"]
          }
        ],
        "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$skip=1"
      }
    },
    {
      body: {
        access_token: "microsoft-access-placeholder",
        scope: MICROSOFT_REQUIRED_PERMISSIONS.join(" ")
      }
    },
    {
      assert: url => assert.ok(url.startsWith("https://graph.microsoft.com/v1.0/me/mailFolders/drafts/messages")),
      body: {
        value: [
          {
            id: "ms-draft-1",
            conversationId: "ms-thread-2",
            subject: "Microsoft draft",
            bodyPreview: "Draft preview",
            lastModifiedDateTime: "2026-06-30T17:00:00Z",
            toRecipients: [{ emailAddress: { name: "Pilot", address: "pilot@example.com" } }]
          }
        ]
      }
    }
  ]);
  const adapter = createMicrosoftFounderCommunicationsAdapter({ env: microsoftEnv, fetchImpl });

  const agenda = await adapter.getDailyAgenda({ date: "2026-06-30", timezone: "America/Chicago" });
  const messages = await adapter.listMessageSummaries({ limit: 1 });
  const drafts = await adapter.listDraftMessageRequests({ limit: 1 });

  assert.equal(agenda.status.state, FOUNDER_CONNECTION_STATES.SYNC_COMPLETE);
  assert.equal(agenda.events[0].providerEventId, "ms-event-1");
  assert.equal(messages.messages[0].actionRequired, true);
  assert.equal(messages.cursor, "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$skip=1");
  assert.equal(drafts.drafts[0].subject, "Microsoft draft");
});

test("service factory selects configured providers and keeps the shared interface", async () => {
  const googleAdapter = createFounderCommunicationsAdapterFromEnv({
    env: {
      ...googleEnv,
      PROMETHEUS_FOUNDER_COMMUNICATIONS_PROVIDER: "google"
    },
    fetchImpl: createOrderedFetch([])
  });
  const microsoftAdapter = createFounderCommunicationsAdapterFromEnv({
    env: {
      ...microsoftEnv,
      PROMETHEUS_FOUNDER_COMMUNICATIONS_PROVIDER: "outlook"
    },
    fetchImpl: createOrderedFetch([])
  });
  const service = createFounderCommunicationsService({
    adapter: {
      provider: "mock",
      async listDraftMessageRequests() {
        return { ok: true, drafts: [], status: { state: FOUNDER_CONNECTION_STATES.SYNC_COMPLETE } };
      }
    }
  });

  assert.equal(googleAdapter.provider, "google");
  assert.equal(microsoftAdapter.provider, "microsoft");
  assert.equal(typeof service.listDraftMessageRequests, "function");
});
