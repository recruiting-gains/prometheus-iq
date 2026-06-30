import test from "node:test";
import assert from "node:assert/strict";
import {
  FOUNDER_COMMUNICATIONS_CONTRACT_VERSION,
  FOUNDER_CONNECTION_STATES,
  FOUNDER_INTEGRATION_CAPABILITIES,
  FOUNDER_INTEGRATION_ERROR_CODES,
  FOUNDER_MESSAGE_CHANNELS,
  createDailyAgendaResponse,
  createDraftMessageRequest,
  createFounderCalendarEvent,
  createFounderIntegrationError,
  createFounderIntegrationStatus,
  createFounderMessageSummary,
  createMessageSendRequest,
  createMessageSummariesResponse,
  createUpcomingMeetingsResponse,
  createUnsupportedMessageSendResponse
} from "../integrations/founder-communications-contract.js";
import {
  createDisconnectedFounderCommunicationsAdapter,
  createFounderCommunicationsService
} from "../integrations/founder-communications-service.js";

const sampleEvent = {
  id: "evt_1",
  title: "Founder check-in",
  startsAt: "2026-06-30T15:00:00-05:00",
  endsAt: "2026-06-30T15:30:00-05:00",
  timezone: "America/Chicago"
};

const sampleMessage = {
  id: "msg_1",
  channel: FOUNDER_MESSAGE_CHANNELS.EMAIL,
  from: { name: "Pilot Lead", address: "pilot@example.com" },
  to: [{ name: "Cruz", address: "founder@example.com" }],
  subject: "Pilot follow-up",
  preview: "Can we review the pilot structure?",
  receivedAt: "2026-06-30T13:00:00-05:00"
};

test("connection states include all required founder integration states", () => {
  assert.deepEqual(Object.values(FOUNDER_CONNECTION_STATES).sort(), [
    "connected",
    "disconnected",
    "permission_required",
    "sync_complete",
    "sync_pending"
  ]);
});

test("integration status exposes a shared capability map for all consumers", () => {
  const status = createFounderIntegrationStatus({
    state: FOUNDER_CONNECTION_STATES.CONNECTED,
    provider: "test-provider",
    capabilities: {
      [FOUNDER_INTEGRATION_CAPABILITIES.READ_CALENDAR_EVENTS]: true,
      [FOUNDER_INTEGRATION_CAPABILITIES.READ_MESSAGE_SUMMARIES]: true
    },
    checkedAt: "2026-06-30T16:00:00.000Z"
  });

  assert.equal(status.contractVersion, FOUNDER_COMMUNICATIONS_CONTRACT_VERSION);
  assert.equal(status.state, FOUNDER_CONNECTION_STATES.CONNECTED);
  assert.equal(status.capabilities.read_calendar_events, true);
  assert.equal(status.capabilities.read_message_summaries, true);
  assert.equal(status.capabilities.send_messages, false);
});

test("calendar, agenda, and upcoming meeting responses use normalized event models", () => {
  const event = createFounderCalendarEvent(sampleEvent);
  const upcoming = createUpcomingMeetingsResponse({
    status: createFounderIntegrationStatus({ state: FOUNDER_CONNECTION_STATES.SYNC_COMPLETE }),
    window: {
      startsAt: "2026-06-30T00:00:00-05:00",
      endsAt: "2026-07-01T00:00:00-05:00"
    },
    meetings: [sampleEvent],
    generatedAt: "2026-06-30T16:00:00.000Z"
  });
  const agenda = createDailyAgendaResponse({
    date: "2026-06-30",
    events: [sampleEvent],
    generatedAt: "2026-06-30T16:00:00.000Z"
  });

  assert.equal(event.startsAt, "2026-06-30T20:00:00.000Z");
  assert.equal(upcoming.meetings[0].id, "evt_1");
  assert.equal(upcoming.status.state, FOUNDER_CONNECTION_STATES.SYNC_COMPLETE);
  assert.equal(agenda.events[0].timezone, "America/Chicago");
});

test("message summaries and draft requests share provider-neutral data models", () => {
  const summary = createFounderMessageSummary(sampleMessage);
  const response = createMessageSummariesResponse({
    messages: [sampleMessage],
    generatedAt: "2026-06-30T16:00:00.000Z"
  });
  const draft = createDraftMessageRequest({
    id: "draft_1",
    channel: FOUNDER_MESSAGE_CHANNELS.EMAIL,
    to: sampleMessage.to,
    subject: "Re: Pilot follow-up",
    body: "Draft only.",
    createdAt: "2026-06-30T16:00:00.000Z"
  });

  assert.equal(summary.threadId, "msg_1");
  assert.equal(response.messages[0].channel, FOUNDER_MESSAGE_CHANNELS.EMAIL);
  assert.equal(draft.sendPolicy, "draft_only_until_explicit_send_capability_is_connected");
});

test("standard errors redact secret-like metadata before reaching consumers", () => {
  const error = createFounderIntegrationError({
    code: FOUNDER_INTEGRATION_ERROR_CODES.PROVIDER_ERROR,
    message: "Provider failed.",
    details: {
      accessToken: "should-not-leak",
      nested: {
        api_key: "also-secret",
        safe: "visible"
      }
    }
  });

  assert.equal(error.details.accessToken, "[redacted]");
  assert.equal(error.details.nested.api_key, "[redacted]");
  assert.equal(error.details.nested.safe, "visible");
});

test("message send contract is future-ready but requires explicit authorization", () => {
  assert.throws(() => createMessageSendRequest({
    id: "send_1",
    channel: FOUNDER_MESSAGE_CHANNELS.EMAIL,
    to: sampleMessage.to,
    subject: "Send attempt"
  }), /explicitAuthorizationId is required/);

  const sendRequest = createMessageSendRequest({
    id: "send_1",
    channel: FOUNDER_MESSAGE_CHANNELS.EMAIL,
    to: sampleMessage.to,
    subject: "Authorized send",
    explicitAuthorizationId: "approval_1"
  });
  const unsupported = createUnsupportedMessageSendResponse();

  assert.equal(sendRequest.sendPolicy, "requires_connected_provider_and_explicit_authorization");
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.status.errors[0].code, FOUNDER_INTEGRATION_ERROR_CODES.UNSUPPORTED_CAPABILITY);
});

test("default founder communications service returns safe disconnected contract responses", async () => {
  const service = createFounderCommunicationsService({
    adapter: createDisconnectedFounderCommunicationsAdapter()
  });

  const status = await service.getConnectionStatus();
  const upcoming = await service.getUpcomingMeetings({
    window: {
      startsAt: "2026-06-30T00:00:00-05:00",
      endsAt: "2026-07-01T00:00:00-05:00"
    }
  });
  const messages = await service.listMessageSummaries();
  const send = await service.sendMessage({
    id: "send_1",
    channel: FOUNDER_MESSAGE_CHANNELS.EMAIL,
    explicitAuthorizationId: "approval_1"
  });

  assert.equal(service.contractVersion, FOUNDER_COMMUNICATIONS_CONTRACT_VERSION);
  assert.equal(status.state, FOUNDER_CONNECTION_STATES.DISCONNECTED);
  assert.deepEqual(upcoming.meetings, []);
  assert.deepEqual(messages.messages, []);
  assert.equal(send.ok, false);
});
