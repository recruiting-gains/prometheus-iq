import {
  FOUNDER_COMMUNICATIONS_CONTRACT_VERSION,
  FOUNDER_CONNECTION_STATES,
  FOUNDER_INTEGRATION_CAPABILITIES,
  FOUNDER_INTEGRATION_ERROR_CODES,
  createDailyAgendaResponse,
  createDisconnectedFounderIntegrationStatus,
  createDraftMessageRequest,
  createDraftMessageRequestsResponse,
  createFounderIntegrationError,
  createFounderIntegrationStatus,
  createMessageSummariesResponse,
  createUnsupportedMessageSendResponse,
  createUpcomingMeetingsResponse
} from "./founder-communications-contract.js";
import { createGoogleFounderCommunicationsAdapter } from "./google-founder-communications-adapter.js";
import { createMicrosoftFounderCommunicationsAdapter } from "./microsoft-founder-communications-adapter.js";

function integrationFailureStatus({ code, message, provider = "unconfigured", retryable = false, details = {} }) {
  const state = code === FOUNDER_INTEGRATION_ERROR_CODES.PERMISSION_REQUIRED
    ? FOUNDER_CONNECTION_STATES.PERMISSION_REQUIRED
    : code === FOUNDER_INTEGRATION_ERROR_CODES.PROVIDER_ERROR || code === FOUNDER_INTEGRATION_ERROR_CODES.PROVIDER_UNAVAILABLE || code === FOUNDER_INTEGRATION_ERROR_CODES.SYNC_FAILED
      ? FOUNDER_CONNECTION_STATES.ERROR
    : FOUNDER_CONNECTION_STATES.DISCONNECTED;

  return createFounderIntegrationStatus({
    state,
    provider,
    errors: [
      createFounderIntegrationError({
        code,
        message,
        retryable,
        details
      })
    ]
  });
}

function dateOnly(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

export function createDisconnectedFounderCommunicationsAdapter() {
  const status = createDisconnectedFounderIntegrationStatus();

  return {
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

    async getDailyAgenda({ date = dateOnly(), timezone = "America/Chicago" } = {}) {
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
        ok: true,
        status,
        draftRequest: createDraftMessageRequest(payload)
      };
    },

    async listDraftMessageRequests() {
      return createDraftMessageRequestsResponse({
        status,
        drafts: []
      });
    },

    async sendMessage() {
      return createUnsupportedMessageSendResponse();
    }
  };
}

export function createFounderCommunicationsAdapterFromEnv({
  env = globalThis.process?.env || {},
  fetchImpl = globalThis.fetch
} = {}) {
  const provider = String(env.PROMETHEUS_FOUNDER_COMMUNICATIONS_PROVIDER || "").toLowerCase();

  if (provider === "google") {
    return createGoogleFounderCommunicationsAdapter({ env, fetchImpl });
  }

  if (provider === "microsoft" || provider === "outlook" || provider === "m365" || provider === "office365") {
    return createMicrosoftFounderCommunicationsAdapter({ env, fetchImpl });
  }

  return createDisconnectedFounderCommunicationsAdapter();
}

export function createFounderCommunicationsService({
  adapter = createFounderCommunicationsAdapterFromEnv(),
  provider = adapter.provider || "unconfigured"
} = {}) {
  async function callAdapter(method, args, fallback) {
    try {
      if (typeof adapter[method] !== "function") {
        return fallback(integrationFailureStatus({
          code: FOUNDER_INTEGRATION_ERROR_CODES.UNSUPPORTED_CAPABILITY,
          message: `Founder communications adapter does not implement ${method}.`,
          provider
        }));
      }

      return await adapter[method](args);
    } catch (error) {
      return fallback(integrationFailureStatus({
        code: FOUNDER_INTEGRATION_ERROR_CODES.PROVIDER_ERROR,
        message: error?.message || "Founder communications provider request failed.",
        provider,
        retryable: true
      }));
    }
  }

  return {
    contractVersion: FOUNDER_COMMUNICATIONS_CONTRACT_VERSION,
    capabilities: { ...FOUNDER_INTEGRATION_CAPABILITIES },

    async getConnectionStatus() {
      return callAdapter("getConnectionStatus", undefined, (status) => status);
    },

    async getUpcomingMeetings({ window = {} } = {}) {
      return callAdapter("getUpcomingMeetings", { window }, (status) => createUpcomingMeetingsResponse({
        status,
        window,
        meetings: []
      }));
    },

    async getDailyAgenda({ date = dateOnly(), timezone = "America/Chicago" } = {}) {
      return callAdapter("getDailyAgenda", { date, timezone }, (status) => createDailyAgendaResponse({
        date,
        timezone,
        status,
        events: []
      }));
    },

    async listMessageSummaries({ cursor = null, limit = 20 } = {}) {
      return callAdapter("listMessageSummaries", { cursor, limit }, (status) => createMessageSummariesResponse({
        status,
        messages: [],
        cursor
      }));
    },

    async createDraftMessageRequest(payload = {}) {
      return callAdapter("createDraftMessageRequest", payload, (status) => ({
        contractVersion: FOUNDER_COMMUNICATIONS_CONTRACT_VERSION,
        ok: false,
        status,
        draftRequest: null
      }));
    },

    async listDraftMessageRequests({ cursor = null, limit = 20 } = {}) {
      return callAdapter("listDraftMessageRequests", { cursor, limit }, (status) => createDraftMessageRequestsResponse({
        status,
        drafts: [],
        cursor
      }));
    },

    async sendMessage(payload = {}) {
      return callAdapter("sendMessage", payload, () => createUnsupportedMessageSendResponse({ provider }));
    }
  };
}
