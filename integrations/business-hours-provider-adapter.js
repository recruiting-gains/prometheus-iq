export const BUSINESS_HOURS_PROVIDER_ADAPTER_VERSION = "route-iq-business-hours-provider-adapter.v1";
export const BUSINESS_HOURS_PROVIDER_RESPONSE_VERSION = "route-iq-business-hours-provider-response.v1";
export const BUSINESS_HOURS_DATA_NORMALIZATION_INPUT_VERSION = "route-iq-business-hours-data-normalization-input.v1";

export const BUSINESS_HOURS_PROVIDER_MODES = Object.freeze({
  OFF: "OFF",
  SHADOW: "SHADOW",
  LIVE: "LIVE"
});

export const BUSINESS_HOURS_PROVIDER_CODES = Object.freeze({
  SUCCESS: "SUCCESS",
  MODE_OFF: "MODE_OFF",
  INVALID_CONFIGURATION: "INVALID_CONFIGURATION",
  INVALID_REQUEST: "INVALID_REQUEST",
  REDIRECT_REJECTED: "REDIRECT_REJECTED",
  TIMEOUT: "TIMEOUT",
  NETWORK_FAILED: "NETWORK_FAILED",
  AUTHORIZATION_DENIED: "AUTHORIZATION_DENIED",
  RATE_LIMITED: "RATE_LIMITED",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  HTTP_STATUS_REJECTED: "HTTP_STATUS_REJECTED",
  MALFORMED_RESPONSE: "MALFORMED_RESPONSE",
  PARTIAL_RESULT: "PARTIAL_RESULT",
  IDENTITY_MISMATCH: "IDENTITY_MISMATCH"
});

export const BUSINESS_HOURS_PROVIDER_ADAPTER_CONTRACT = Object.freeze({
  contractVersion: BUSINESS_HOURS_PROVIDER_ADAPTER_VERSION,
  ownerSubsystem: "Prometheus Integrations",
  authorizedConsumerSubsystem: "Prometheus Data",
  defaultMode: BUSINESS_HOURS_PROVIDER_MODES.OFF,
  methods: Object.freeze(["GET"]),
  redirectsAllowed: false,
  maximumAttempts: 3,
  maximumBackoffMs: 2_000,
  maximumRequestBusinesses: 100,
  maximumResponseBytes: 1_000_000,
  outputSchema: BUSINESS_HOURS_DATA_NORMALIZATION_INPUT_VERSION,
  directEligibilityOutputAllowed: false,
  directRecommendationOutputAllowed: false,
  providerSecretsInOutputAllowed: false,
  providerResponseRetentionAllowed: false
});

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const ENVELOPE_FIELDS = new Set(["contractVersion", "providerId", "observedAt", "results"]);
const RESULT_FIELDS = new Set([
  "providerIdentity",
  "timeZone",
  "weeklyPeriods",
  "specialPeriods",
  "appointmentWindows",
  "open24Hours",
  "appointmentOnly",
  "providerUpdatedAt"
]);
const WEEKLY_PERIOD_FIELDS = new Set(["openDay", "openTime", "closeDay", "closeTime"]);
const SPECIAL_PERIOD_FIELDS = new Set(["date", "status", "openTime", "closeTime"]);
const APPOINTMENT_WINDOW_FIELDS = new Set(["startsAt", "endsAt"]);
const FORBIDDEN_REQUEST_HEADERS = new Set(["cookie", "host", "content-length", "transfer-encoding"]);
const TIMEOUT_MARKER = Symbol("business-hours-provider-timeout");

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyFields(value, allowed) {
  return isRecord(value) && Object.keys(value).every(key => allowed.has(key));
}

function validIsoTimestamp(value) {
  return typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
}

function validTimeZone(value) {
  if (typeof value !== "string" || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function validWeeklyPeriod(period) {
  return hasOnlyFields(period, WEEKLY_PERIOD_FIELDS)
    && Number.isInteger(period.openDay)
    && period.openDay >= 0
    && period.openDay <= 6
    && TIME_PATTERN.test(period.openTime)
    && Number.isInteger(period.closeDay)
    && period.closeDay >= 0
    && period.closeDay <= 6
    && TIME_PATTERN.test(period.closeTime);
}

function validSpecialPeriod(period) {
  if (!hasOnlyFields(period, SPECIAL_PERIOD_FIELDS) || !DATE_PATTERN.test(period.date)) return false;
  if (!["OPEN", "CLOSED"].includes(period.status)) return false;
  if (period.status === "CLOSED") {
    return period.openTime === undefined && period.closeTime === undefined;
  }
  return TIME_PATTERN.test(period.openTime) && TIME_PATTERN.test(period.closeTime);
}

function validAppointmentWindow(window) {
  return hasOnlyFields(window, APPOINTMENT_WINDOW_FIELDS)
    && validIsoTimestamp(window.startsAt)
    && validIsoTimestamp(window.endsAt)
    && Date.parse(window.startsAt) < Date.parse(window.endsAt);
}

function fixedResult({ ok = false, code, attempts = 0, retryable = false, normalizationInputs = [] }) {
  return {
    ok,
    code,
    attempts,
    retryable,
    normalizationInputs
  };
}

function validateEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
}

function validateHeaders(headers) {
  if (!isRecord(headers)) return false;
  return Object.entries(headers).every(([name, value]) => (
    /^[A-Za-z0-9-]{1,80}$/u.test(name)
    && !FORBIDDEN_REQUEST_HEADERS.has(name.toLowerCase())
    && typeof value === "string"
    && value.length > 0
    && value.length <= 8_192
    && !/[\r\n]/u.test(value)
  ));
}

function validateRetryDelays(retryDelaysMs) {
  return Array.isArray(retryDelaysMs)
    && retryDelaysMs.length < BUSINESS_HOURS_PROVIDER_ADAPTER_CONTRACT.maximumAttempts
    && retryDelaysMs.every(delay => (
      Number.isInteger(delay)
      && delay >= 0
      && delay <= BUSINESS_HOURS_PROVIDER_ADAPTER_CONTRACT.maximumBackoffMs
    ));
}

function validateConfiguration({
  mode,
  providerId,
  endpoint,
  requestHeaders,
  transport,
  timeoutMs,
  retryDelaysMs,
  sleep
}) {
  if (!Object.values(BUSINESS_HOURS_PROVIDER_MODES).includes(mode)) return false;
  if (mode === BUSINESS_HOURS_PROVIDER_MODES.OFF) return true;
  return IDENTIFIER_PATTERN.test(providerId)
    && validateEndpoint(endpoint)
    && validateHeaders(requestHeaders)
    && typeof transport === "function"
    && Number.isInteger(timeoutMs)
    && timeoutMs >= 1
    && timeoutMs <= 15_000
    && validateRetryDelays(retryDelaysMs)
    && typeof sleep === "function";
}

function validateReadRequest(request) {
  if (!isRecord(request) || !IDENTIFIER_PATTERN.test(request.requestId)) return false;
  if (!Array.isArray(request.businesses)
    || request.businesses.length < 1
    || request.businesses.length > BUSINESS_HOURS_PROVIDER_ADAPTER_CONTRACT.maximumRequestBusinesses) {
    return false;
  }

  const businessIds = new Set();
  const providerIdentities = new Set();
  for (const business of request.businesses) {
    if (!hasOnlyFields(business, new Set(["businessId", "providerIdentity"]))
      || !IDENTIFIER_PATTERN.test(business.businessId)
      || !IDENTIFIER_PATTERN.test(business.providerIdentity)
      || businessIds.has(business.businessId)
      || providerIdentities.has(business.providerIdentity)) {
      return false;
    }
    businessIds.add(business.businessId);
    providerIdentities.add(business.providerIdentity);
  }
  return true;
}

function createProviderUrl(endpoint, businesses) {
  const url = new URL(endpoint);
  const identities = businesses.map(item => item.providerIdentity).sort();
  for (const identity of identities) url.searchParams.append("provider_identity", identity);
  return url.toString();
}

function responseHeader(response, name) {
  if (typeof response?.headers?.get === "function") return response.headers.get(name);
  if (!isRecord(response?.headers)) return null;
  const key = Object.keys(response.headers).find(item => item.toLowerCase() === name.toLowerCase());
  return key ? String(response.headers[key]) : null;
}

function responseClassification(response) {
  const status = Number(response?.status);
  if (!Number.isInteger(status)) {
    return fixedResult({ code: BUSINESS_HOURS_PROVIDER_CODES.MALFORMED_RESPONSE });
  }
  if (response.redirected === true || (status >= 300 && status < 400) || responseHeader(response, "location")) {
    return fixedResult({ code: BUSINESS_HOURS_PROVIDER_CODES.REDIRECT_REJECTED });
  }
  if (status === 401 || status === 403) {
    return fixedResult({ code: BUSINESS_HOURS_PROVIDER_CODES.AUTHORIZATION_DENIED });
  }
  if (status === 429) {
    return fixedResult({ code: BUSINESS_HOURS_PROVIDER_CODES.RATE_LIMITED, retryable: true });
  }
  if (status >= 500 && status <= 599) {
    return fixedResult({ code: BUSINESS_HOURS_PROVIDER_CODES.PROVIDER_UNAVAILABLE, retryable: true });
  }
  if (status !== 200) {
    return fixedResult({ code: BUSINESS_HOURS_PROVIDER_CODES.HTTP_STATUS_REJECTED });
  }
  const contentType = responseHeader(response, "content-type");
  if (contentType && !/^application\/json(?:;|$)/iu.test(contentType.trim())) {
    return fixedResult({ code: BUSINESS_HOURS_PROVIDER_CODES.MALFORMED_RESPONSE });
  }
  return null;
}

async function responseText(response) {
  if (typeof response?.text === "function") return response.text();
  if (typeof response?.json === "function") return JSON.stringify(await response.json());
  throw new TypeError("response body unavailable");
}

function validateProviderResult(result) {
  if (!hasOnlyFields(result, RESULT_FIELDS)
    || !IDENTIFIER_PATTERN.test(result.providerIdentity)
    || !validTimeZone(result.timeZone)
    || !Array.isArray(result.weeklyPeriods)
    || !result.weeklyPeriods.every(validWeeklyPeriod)
    || !Array.isArray(result.specialPeriods)
    || !result.specialPeriods.every(validSpecialPeriod)
    || !Array.isArray(result.appointmentWindows)
    || !result.appointmentWindows.every(validAppointmentWindow)
    || typeof result.open24Hours !== "boolean"
    || typeof result.appointmentOnly !== "boolean"
    || (result.providerUpdatedAt !== undefined && !validIsoTimestamp(result.providerUpdatedAt))) {
    return false;
  }
  if (result.open24Hours && (result.weeklyPeriods.length > 0 || result.appointmentOnly)) return false;
  return true;
}

function mapProviderEnvelope({ envelope, providerId, businesses, retrievedAt }) {
  if (!hasOnlyFields(envelope, ENVELOPE_FIELDS)
    || envelope.contractVersion !== BUSINESS_HOURS_PROVIDER_RESPONSE_VERSION
    || !validIsoTimestamp(envelope.observedAt)
    || !Array.isArray(envelope.results)
    || !envelope.results.every(validateProviderResult)) {
    return fixedResult({ code: BUSINESS_HOURS_PROVIDER_CODES.MALFORMED_RESPONSE });
  }
  if (envelope.providerId !== providerId) {
    return fixedResult({ code: BUSINESS_HOURS_PROVIDER_CODES.IDENTITY_MISMATCH });
  }

  const requestedByProviderIdentity = new Map(
    businesses.map(business => [business.providerIdentity, business])
  );
  const returnedIdentities = new Set();
  for (const result of envelope.results) {
    if (!requestedByProviderIdentity.has(result.providerIdentity)
      || returnedIdentities.has(result.providerIdentity)) {
      return fixedResult({ code: BUSINESS_HOURS_PROVIDER_CODES.IDENTITY_MISMATCH });
    }
    returnedIdentities.add(result.providerIdentity);
  }
  if (returnedIdentities.size !== requestedByProviderIdentity.size) {
    return fixedResult({ code: BUSINESS_HOURS_PROVIDER_CODES.PARTIAL_RESULT });
  }

  const byIdentity = new Map(envelope.results.map(result => [result.providerIdentity, result]));
  const normalizationInputs = businesses.map(business => {
    const result = byIdentity.get(business.providerIdentity);
    return {
      schemaVersion: BUSINESS_HOURS_DATA_NORMALIZATION_INPUT_VERSION,
      businessId: business.businessId,
      source: {
        providerId,
        providerIdentity: business.providerIdentity,
        providerContractVersion: envelope.contractVersion,
        observedAt: envelope.observedAt,
        retrievedAt
      },
      availabilityObservation: {
        timeZone: result.timeZone,
        weeklyPeriods: result.weeklyPeriods.map(period => ({ ...period })),
        specialPeriods: result.specialPeriods.map(period => ({ ...period })),
        appointmentWindows: result.appointmentWindows.map(window => ({ ...window })),
        open24Hours: result.open24Hours,
        appointmentOnly: result.appointmentOnly,
        providerUpdatedAt: result.providerUpdatedAt || null
      }
    };
  });

  return fixedResult({
    ok: true,
    code: BUSINESS_HOURS_PROVIDER_CODES.SUCCESS,
    normalizationInputs
  });
}

function defaultSleep(delayMs) {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

async function transportWithTimeout({ transport, url, init, timeoutMs }) {
  const controller = new AbortController();
  let timeoutId;
  const timeout = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(TIMEOUT_MARKER);
      controller.abort();
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      Promise.resolve(transport(url, { ...init, signal: controller.signal })),
      timeout
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export function createBusinessHoursProviderAdapter({
  mode = BUSINESS_HOURS_PROVIDER_MODES.OFF,
  providerId = "",
  endpoint = "",
  requestHeaders = {},
  transport = globalThis.fetch,
  timeoutMs = 5_000,
  retryDelaysMs = [],
  sleep = defaultSleep,
  now = () => new Date()
} = {}) {
  const configurationValid = validateConfiguration({
    mode,
    providerId,
    endpoint,
    requestHeaders,
    transport,
    timeoutMs,
    retryDelaysMs,
    sleep
  });

  return Object.freeze({
    contractVersion: BUSINESS_HOURS_PROVIDER_ADAPTER_VERSION,
    mode,
    async read(request) {
      if (mode === BUSINESS_HOURS_PROVIDER_MODES.OFF) {
        return fixedResult({ code: BUSINESS_HOURS_PROVIDER_CODES.MODE_OFF });
      }
      if (!configurationValid || typeof now !== "function") {
        return fixedResult({ code: BUSINESS_HOURS_PROVIDER_CODES.INVALID_CONFIGURATION });
      }
      if (!validateReadRequest(request)) {
        return fixedResult({ code: BUSINESS_HOURS_PROVIDER_CODES.INVALID_REQUEST });
      }

      let retrievedAt;
      try {
        const retrievedDate = now();
        retrievedAt = (retrievedDate instanceof Date ? retrievedDate : new Date(retrievedDate)).toISOString();
      } catch {
        return fixedResult({ code: BUSINESS_HOURS_PROVIDER_CODES.INVALID_CONFIGURATION });
      }
      const url = createProviderUrl(endpoint, request.businesses);
      const init = {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...requestHeaders
        },
        redirect: "manual",
        cache: "no-store"
      };
      const maximumAttempts = 1 + retryDelaysMs.length;
      let attempt = 0;
      let lastFailure = fixedResult({ code: BUSINESS_HOURS_PROVIDER_CODES.NETWORK_FAILED, retryable: true });

      while (attempt < maximumAttempts) {
        attempt += 1;
        let response;
        try {
          response = await transportWithTimeout({ transport, url, init, timeoutMs });
        } catch (error) {
          lastFailure = fixedResult({
            code: error === TIMEOUT_MARKER
              ? BUSINESS_HOURS_PROVIDER_CODES.TIMEOUT
              : BUSINESS_HOURS_PROVIDER_CODES.NETWORK_FAILED,
            attempts: attempt,
            retryable: true
          });
          if (attempt < maximumAttempts) {
            await sleep(retryDelaysMs[attempt - 1]);
            continue;
          }
          return lastFailure;
        }

        const classified = responseClassification(response);
        if (classified) {
          lastFailure = { ...classified, attempts: attempt };
          if (classified.retryable && attempt < maximumAttempts) {
            await sleep(retryDelaysMs[attempt - 1]);
            continue;
          }
          return lastFailure;
        }

        let bodyText;
        try {
          bodyText = await responseText(response);
        } catch {
          return fixedResult({
            code: BUSINESS_HOURS_PROVIDER_CODES.MALFORMED_RESPONSE,
            attempts: attempt
          });
        }
        if (typeof bodyText !== "string"
          || bodyText.length > BUSINESS_HOURS_PROVIDER_ADAPTER_CONTRACT.maximumResponseBytes) {
          return fixedResult({
            code: BUSINESS_HOURS_PROVIDER_CODES.MALFORMED_RESPONSE,
            attempts: attempt
          });
        }

        let envelope;
        try {
          envelope = JSON.parse(bodyText);
        } catch {
          return fixedResult({
            code: BUSINESS_HOURS_PROVIDER_CODES.MALFORMED_RESPONSE,
            attempts: attempt
          });
        }

        return {
          ...mapProviderEnvelope({
            envelope,
            providerId,
            businesses: request.businesses,
            retrievedAt
          }),
          attempts: attempt
        };
      }

      return lastFailure;
    }
  });
}

function mockHeaders(headers = {}) {
  const normalized = new Map(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value)])
  );
  return {
    get(name) {
      return normalized.get(String(name).toLowerCase()) || null;
    }
  };
}

export function createDeterministicBusinessHoursMockTransport(steps = []) {
  const queue = [...steps];
  const calls = [];

  const transport = async (url, init = {}) => {
    calls.push(Object.freeze({
      url: String(url),
      method: init.method || "GET",
      redirect: init.redirect || null,
      cache: init.cache || null,
      hasBody: init.body !== undefined,
      headerNames: Object.freeze(Object.keys(init.headers || {}).sort())
    }));
    const step = queue.shift();
    if (!step) throw new Error("mock_transport_exhausted");
    if (step.type === "error") throw new Error("mock_transport_failed");
    if (step.type === "timeout") {
      return new Promise((resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("mock_transport_aborted")), { once: true });
      });
    }

    const bodyText = Object.hasOwn(step, "bodyText")
      ? String(step.bodyText)
      : JSON.stringify(step.body ?? {});
    return {
      status: step.status ?? 200,
      redirected: step.redirected === true,
      url: step.url || String(url),
      headers: mockHeaders({
        "content-type": "application/json",
        ...(step.headers || {})
      }),
      async text() {
        return bodyText;
      }
    };
  };

  Object.defineProperties(transport, {
    calls: { value: calls },
    remaining: {
      value() {
        return queue.length;
      }
    }
  });
  return transport;
}
