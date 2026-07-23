export const ROUTE_IQ_REQUEST_ENDPOINT = "/api/partner-intake";
export const ROUTE_IQ_REQUEST_FORM_ID = "route_iq_request";
export const ROUTE_IQ_REQUEST_VERSION = "route-iq-public-request.v1";
export const ROUTE_IQ_REQUEST_RECEIPT_PATTERN = /^riq_receipt_[a-f0-9]{24}$/u;

const MAX_RESPONSE_BYTES = 16 * 1024;

function normalizeText(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeLongText(value, maxLength) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validOptionalPhone(value) {
  if (!value) return true;
  const normalized = value.replace(/[\s().+-]/g, "");
  return /^\d{7,15}$/.test(normalized);
}

export function resolveAcquisitionSource(locationHref = "", referrer = "") {
  try {
    const url = new URL(locationHref || "https://prometheusrouteiq.com/");
    const campaignSource = normalizeText(url.searchParams.get("utm_source"), 80);
    if (campaignSource) return campaignSource;
  } catch {
    // Invalid browser location data falls back to a safe first-party label.
  }

  try {
    const referrerHost = normalizeText(new URL(referrer).hostname, 120);
    if (referrerHost) return referrerHost;
  } catch {
    // Empty or invalid referrers are normal for direct visits.
  }

  return "direct";
}

export function buildRouteIqRequestPayload({ formData = {}, now = new Date(), acquisitionSource = "direct" } = {}) {
  const businessName = normalizeText(formData.businessName, 140);
  const contactName = normalizeText(formData.contactName, 140);
  const businessEmail = normalizeText(formData.businessEmail, 180).toLowerCase();
  const phone = normalizeText(formData.phone, 40);
  const industry = normalizeText(formData.industry, 120);
  const locationCount = positiveInteger(formData.locationCount);
  const estimatedUserCount = positiveInteger(formData.estimatedUserCount);
  const territory = normalizeText(formData.territory, 220);
  const primaryProblem = normalizeLongText(formData.primaryProblem, 1200);
  const desiredTimeline = normalizeText(formData.desiredTimeline, 120);
  const consent = formData.consent === true || formData.consent === "true" || formData.consent === "on";
  const honeypot = normalizeText(formData.websiteUrl, 200);
  const submittedAtDate = now instanceof Date ? now : new Date(now);
  const errors = [];

  if (!businessName) errors.push("Business name is required.");
  if (!contactName) errors.push("Contact name is required.");
  if (!validEmail(businessEmail)) errors.push("A valid business email is required.");
  if (!validOptionalPhone(phone)) errors.push("Phone must contain 7 to 15 digits.");
  if (!industry) errors.push("Industry or business type is required.");
  if (!locationCount) errors.push("Number of locations must be a positive whole number.");
  if (!estimatedUserCount) errors.push("Estimated users must be a positive whole number.");
  if (!territory) errors.push("Territory or operating area is required.");
  if (!primaryProblem) errors.push("Primary problem or use case is required.");
  if (!desiredTimeline) errors.push("Desired timeline is required.");
  if (!consent) errors.push("Consent is required before submitting.");
  if (honeypot) errors.push("Submission could not be accepted.");
  if (Number.isNaN(submittedAtDate.getTime())) errors.push("Submission time is invalid.");

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    payload: {
      version: ROUTE_IQ_REQUEST_VERSION,
      formId: ROUTE_IQ_REQUEST_FORM_ID,
      businessName,
      contactName,
      businessEmail,
      phone: phone || null,
      industry,
      locationCount,
      estimatedUserCount,
      territory,
      primaryProblem,
      desiredTimeline,
      consent: true,
      submittedAt: submittedAtDate.toISOString(),
      acquisitionSource: normalizeText(acquisitionSource, 120) || "direct",
      websiteUrl: ""
    }
  };
}

function receiptFrom(body) {
  const receiptId = normalizeText(body?.receiptId, 36);
  return ROUTE_IQ_REQUEST_RECEIPT_PATTERN.test(receiptId) ? receiptId : "";
}

export async function submitRouteIqRequest({ payload, fetchImpl = globalThis.fetch } = {}) {
  if (!payload || typeof payload !== "object") throw new Error("REQUEST_PAYLOAD_INVALID");
  if (typeof fetchImpl !== "function") throw new Error("REQUEST_TRANSPORT_UNAVAILABLE");

  let response;
  try {
    response = await fetchImpl(ROUTE_IQ_REQUEST_ENDPOINT, {
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

  const receiptId = receiptFrom(body);
  if (!receiptId) throw new Error("REQUEST_RECEIPT_MISSING");

  return {
    ok: true,
    receiptId,
    duplicate: body.duplicate === true,
    submittedAt: normalizeText(body.timestamp, 80) || payload.submittedAt
  };
}
