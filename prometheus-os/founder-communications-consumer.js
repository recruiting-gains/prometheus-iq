import {
  FOUNDER_COMMUNICATIONS_CONTRACT_VERSION,
  FOUNDER_CONNECTION_STATES,
  FOUNDER_MESSAGE_CHANNELS,
  createDraftMessageRequest
} from "../integrations/founder-communications-contract.js";
import { createFounderCommunicationsService } from "../integrations/founder-communications-service.js";

const defaultService = createFounderCommunicationsService();

export function getDefaultFounderCommunicationsService() {
  return defaultService;
}

export function displayFounderConnectionState(status = {}) {
  const hasProviderError = (status.errors || []).some((error) => {
    return ["provider_error", "sync_failed", "provider_unavailable"].includes(error.code);
  });
  if (hasProviderError) return "Error";

  return {
    [FOUNDER_CONNECTION_STATES.CONNECTED]: "Connected",
    [FOUNDER_CONNECTION_STATES.DISCONNECTED]: "Disconnected",
    [FOUNDER_CONNECTION_STATES.PERMISSION_REQUIRED]: "Permission Required",
    [FOUNDER_CONNECTION_STATES.SYNC_PENDING]: "Sync Pending",
    [FOUNDER_CONNECTION_STATES.SYNC_COMPLETE]: "Sync Complete"
  }[status.state] || "Error";
}

function integrationLine(status = {}) {
  const state = displayFounderConnectionState(status);
  const error = status.errors?.[0]?.message ? ` ${status.errors[0].message}` : "";
  if (state === "Connected" || state === "Sync Complete") return "Your calendar and messages are connected.";
  if (state === "Sync Pending") return "Your calendar and messages are still syncing, so I may only have a partial read.";
  if (state === "Permission Required") return "I need calendar or message permission before I can give you the live read.";
  if (state === "Disconnected") return "I do not have your live calendar or messages connected yet.";
  return `I could not read the calendar or message connection cleanly.${error}`.trim();
}

function formatEvent(event) {
  const startsAt = event.startsAt ? new Date(event.startsAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: event.timezone || "America/Chicago"
  }) : "time unavailable";
  const location = event.location ? ` Location: ${event.location}.` : "";
  return `${event.title} at ${startsAt}.${location}`;
}

function formatMessage(message) {
  const sender = message.from?.name || message.from?.address || "Unknown sender";
  const subject = message.subject || "No subject";
  const action = message.actionRequired ? " Action required." : "";
  return `${sender}: ${subject}. ${message.preview || "No preview available."}${action}`;
}

function messageDraftText(command = "") {
  const toChris = command.includes("chris") || command.includes("leadership") || command.includes("pilot");
  if (toChris) {
    return {
      subject: "Controlled Prometheus pilot follow-up",
      body: "Chris, quick update: Prometheus is ready for a controlled pilot conversation. The ask is intentionally simple: a limited 14-day test, approved users only, GPS-verified activity, weekly review, and a final results report. I can keep proprietary routing logic out of the conversation unless leadership wants a deeper review under the right approval path. What would Dallas leadership need from me next to evaluate this cleanly?"
    };
  }

  return {
    subject: "Prometheus founder update",
    body: "Quick update from Prometheus: the product foundation is real, the next priority is validation, and I am keeping the ask focused on measurable field-sales proof instead of extra features. The next step is to collect useful feedback, confirm the blocker, and decide the smallest action that moves the pilot forward."
  };
}

function draftId() {
  return `companion_draft_${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`;
}

export async function createFounderMeetingsBrief({ service = defaultService, now = new Date() } = {}) {
  const startsAt = now.toISOString();
  const endsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const result = await service.getUpcomingMeetings({
    window: {
      startsAt,
      endsAt,
      timezone: "America/Chicago"
    }
  });
  const state = integrationLine(result.status);
  const meetings = result.meetings?.length
    ? result.meetings.map(formatEvent).join(" ")
    : "I do not see any synced meetings for the next 24 hours yet.";

  return {
    title: "Founder Meetings",
    body: `${state} ${meetings}`,
    metadata: {
      integrationContract: result.contractVersion,
      integrationState: displayFounderConnectionState(result.status),
      provider: result.status?.provider || "unconfigured",
      meetingCount: result.meetings?.length || 0
    }
  };
}

export async function createFounderAgendaBrief({ service = defaultService, command = "", date = new Date() } = {}) {
  const isoDate = date.toISOString().slice(0, 10);
  const result = await service.getDailyAgenda({
    date: isoDate,
    timezone: "America/Chicago"
  });
  const state = integrationLine(result.status);
  const events = result.events?.length
    ? result.events.map(formatEvent).join(" ")
    : "I do not see synced agenda events for today yet.";

  return {
    title: "Founder Day Plan",
    body: [
      state,
      events,
      "Plan the day around proof, not activity.",
      "Highest-value operating blocks remain: beta validation, leadership follow-up, message review, and nightly memory/backup review."
    ].join(" "),
    metadata: {
      integrationContract: result.contractVersion,
      integrationState: displayFounderConnectionState(result.status),
      provider: result.status?.provider || "unconfigured",
      eventCount: result.events?.length || 0,
      requestedCommand: command
    }
  };
}

export async function createFounderMessageSummaryBrief({ service = defaultService } = {}) {
  const result = await service.listMessageSummaries({ limit: 10 });
  const state = integrationLine(result.status);
  const messages = result.messages?.length
    ? result.messages.map(formatMessage).join(" ")
    : "I do not see synced message summaries yet.";

  return {
    title: "Founder Message Summary",
    body: `${state} ${messages}`,
    metadata: {
      integrationContract: result.contractVersion,
      integrationState: displayFounderConnectionState(result.status),
      provider: result.status?.provider || "unconfigured",
      messageCount: result.messages?.length || 0
    }
  };
}

export async function createFounderDraftMessageBrief({ service = defaultService, command = "" } = {}) {
  const draft = messageDraftText(command);
  const fallbackRequest = createDraftMessageRequest({
    id: draftId(),
    channel: FOUNDER_MESSAGE_CHANNELS.EMAIL,
    subject: draft.subject,
    body: draft.body,
    requestedBy: "companion",
    metadata: {
      source: "prometheus-companion",
      command
    }
  });
  const result = await service.createDraftMessageRequest(fallbackRequest);
  const request = result.draftRequest || fallbackRequest;
  const state = integrationLine(result.status);
  const okText = result.ok
    ? "I prepared the draft for review."
    : "I prepared the draft locally for review, but the message connection did not accept it yet.";

  return {
    title: "Message Draft",
    body: `${state} ${okText} I did not send anything. Subject: ${request.subject}. Draft: ${request.body}`,
    metadata: {
      integrationContract: result.contractVersion,
      integrationState: displayFounderConnectionState(result.status),
      provider: result.status?.provider || "unconfigured",
      draftRequestId: request.id,
      sendPolicy: request.sendPolicy
    }
  };
}
