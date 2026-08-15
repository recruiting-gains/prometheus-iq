export const ROUTE_IQ_GYM_REQUEST_ENDPOINT = "/api/partner-intake";
export const ROUTE_IQ_GYM_REQUEST_VERSION = "route-iq-gym-request.v1";
export const ROUTE_IQ_GYM_REQUEST_FORM_ID = "route_iq_gym_request";
export const ROUTE_IQ_GYM_REQUEST_ACQUISITION_SOURCE = "route_iq_website";
export const ROUTE_IQ_GYM_REQUEST_RECEIPT_PATTERN = /^riq_receipt_[a-f0-9]{24}$/u;
export const ROUTE_IQ_GYM_REQUEST_ATTRIBUTION_FIELDS = Object.freeze([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content"
]);

const MAX_RESPONSE_BYTES = 16 * 1024;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const phonePattern = /^\+?[0-9][0-9 ()-]{6,23}$/u;
const hostileTextPattern = /(?:<|>|javascript\s*:|data\s*:\s*text\/html|\$\{|\{\{|\}\}|on[a-z]+\s*=)/iu;
const spreadsheetFormulaPattern = /^[=+\-@]/u;
const queryInjectionPattern = /(?:--|\/\*|\*\/|\bunion\s+select\b|;\s*(?:select|insert|update|delete|drop|alter|create)\b)/iu;
const secretLikePattern = /(?:-----BEGIN [A-Z ]+PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~-]+|\b(?:api[_ -]?key|access[_ -]?token|auth(?:orization)?|client[_ -]?secret|credential|password|private[_ -]?key|secret|session[_ -]?token)\b|(?:^|[^A-Za-z0-9])(?:sk[-_](?:live|test|proj|svcacct)[-_]|rk_live_|gh[pousr]_|glpat-|xox[baprs]-|npm_|pypi-|cfut_)[A-Za-z0-9_-]{8,}|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\bAIza[A-Za-z0-9_-]{20,}\b|eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})/iu;

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/gu, " ");
}

function validGovernedText(value, min, max) {
  return value.length >= min
    && value.length <= max
    && !/[\u0000-\u001F\u007F]/u.test(value)
    && !hostileTextPattern.test(value)
    && !spreadsheetFormulaPattern.test(value)
    && !queryInjectionPattern.test(value);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizedAttribution(attribution, errors) {
  if (!isPlainObject(attribution)) {
    errors.push("Campaign attribution is invalid.");
    return {};
  }

  const keys = Object.keys(attribution);
  if (keys.some(key => !ROUTE_IQ_GYM_REQUEST_ATTRIBUTION_FIELDS.includes(key))) {
    errors.push("Campaign attribution is invalid.");
    return {};
  }

  const result = {};
  for (const field of ROUTE_IQ_GYM_REQUEST_ATTRIBUTION_FIELDS) {
    if (!Object.hasOwn(attribution, field)) continue;
    if (typeof attribution[field] !== "string") {
      errors.push("Campaign attribution is invalid.");
      continue;
    }
    const value = normalizeText(attribution[field]);
    if (!value) continue;
    if (!validGovernedText(value, 1, 120) || secretLikePattern.test(value)) {
      errors.push("Campaign attribution is invalid.");
      continue;
    }
    result[field] = value;
  }
  return result;
}

export function collectRouteIqGymAttribution(locationHref = "") {
  let url;
  try {
    url = new URL(locationHref || "https://prometheusrouteiq.com/");
  } catch {
    return {};
  }

  const attribution = {};
  for (const field of ROUTE_IQ_GYM_REQUEST_ATTRIBUTION_FIELDS) {
    const value = normalizeText(url.searchParams.get(field));
    if (value && validGovernedText(value, 1, 120) && !secretLikePattern.test(value)) {
      attribution[field] = value;
    }
  }
  return attribution;
}

export function preserveRouteIqGymAttribution(href, locationHref = "") {
  if (typeof href !== "string" || !href.startsWith("/") || href.startsWith("//")) return href;

  try {
    const current = new URL(locationHref || "https://prometheusrouteiq.com/");
    const target = new URL(href, current.origin);
    if (target.origin !== current.origin) return href;
    const attribution = collectRouteIqGymAttribution(current.href);
    for (const field of ROUTE_IQ_GYM_REQUEST_ATTRIBUTION_FIELDS) {
      if (attribution[field] && !target.searchParams.has(field)) {
        target.searchParams.set(field, attribution[field]);
      }
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return href;
  }
}

export function buildRouteIqGymRequestPayload({ formData = {}, attribution = {}, now = new Date() } = {}) {
  const fullName = normalizeText(formData.fullName);
  const gymName = normalizeText(formData.gymName);
  const cityState = normalizeText(formData.cityState);
  const outsideRepCount = Number(formData.outsideRepCount);
  const workEmail = normalizeText(formData.workEmail).toLowerCase();
  const cell = normalizeText(formData.cell);
  const consent = formData.consent === true || formData.consent === "true" || formData.consent === "on";
  const websiteUrl = normalizeText(formData.websiteUrl);
  const submittedAt = now instanceof Date ? now : new Date(now);
  const errors = [];

  if (!validGovernedText(fullName, 2, 120)) errors.push("Full name is required.");
  if (!validGovernedText(gymName, 2, 160)) errors.push("Gym name is required.");
  if (!validGovernedText(cityState, 3, 160)) errors.push("City and state are required.");
  if (!Number.isSafeInteger(outsideRepCount) || outsideRepCount < 1 || outsideRepCount > 10) {
    errors.push("Outside reps must be a whole number from 1 through 10.");
  }
  if (workEmail.length > 254 || !emailPattern.test(workEmail) || hostileTextPattern.test(workEmail)) {
    errors.push("A valid work email is required.");
  }
  const cellDigits = cell.replace(/\D/gu, "");
  if (cell.length > 24 || !phonePattern.test(cell) || cellDigits.length < 7 || cellDigits.length > 15) {
    errors.push("A valid cell number is required.");
  }
  if (!consent) errors.push("Consent is required before submitting.");
  if (websiteUrl) errors.push("Submission could not be accepted.");
  if (Number.isNaN(submittedAt.getTime())) errors.push("Submission time is invalid.");

  const normalizedCampaign = normalizedAttribution(attribution, errors);
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };

  return {
    ok: true,
    payload: {
      version: ROUTE_IQ_GYM_REQUEST_VERSION,
      formId: ROUTE_IQ_GYM_REQUEST_FORM_ID,
      fullName,
      gymName,
      cityState,
      outsideRepCount,
      workEmail,
      cell,
      consent: true,
      submittedAt: submittedAt.toISOString(),
      acquisitionSource: ROUTE_IQ_GYM_REQUEST_ACQUISITION_SOURCE,
      attribution: normalizedCampaign,
      websiteUrl: ""
    }
  };
}

export function buildRouteIqGymThankYouPath(receiptId) {
  const canonicalReceipt = normalizeText(receiptId);
  return ROUTE_IQ_GYM_REQUEST_RECEIPT_PATTERN.test(canonicalReceipt)
    ? `/thank-you?receipt=${encodeURIComponent(canonicalReceipt)}`
    : "";
}

export async function submitRouteIqGymRequest({ payload, fetchImpl = globalThis.fetch } = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("REQUEST_PAYLOAD_INVALID");
  }
  if (typeof fetchImpl !== "function") throw new Error("REQUEST_TRANSPORT_UNAVAILABLE");

  let response;
  try {
    response = await fetchImpl(ROUTE_IQ_GYM_REQUEST_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch {
    throw new Error("REQUEST_NETWORK_FAILED");
  }

  const declaredLength = Number(response.headers?.get?.("content-length") || 0);
  if (declaredLength > MAX_RESPONSE_BYTES) throw new Error("REQUEST_RESPONSE_INVALID");
  const responseText = await response.text();
  if (responseText.length > MAX_RESPONSE_BYTES) throw new Error("REQUEST_RESPONSE_INVALID");

  let body;
  try {
    body = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error("REQUEST_RESPONSE_INVALID");
  }

  if (!response.ok || body?.ok !== true) {
    throw new Error(response.status === 429 ? "REQUEST_RATE_LIMITED" : "REQUEST_REJECTED");
  }

  const receiptId = normalizeText(body.receiptId);
  if (!ROUTE_IQ_GYM_REQUEST_RECEIPT_PATTERN.test(receiptId)) {
    throw new Error("REQUEST_RECEIPT_MISSING");
  }

  return Object.freeze({ ok: true, receiptId });
}
