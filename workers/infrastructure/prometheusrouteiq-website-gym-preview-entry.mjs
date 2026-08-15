import {
  adaptRouteIqGymRequestForCrm,
  routeIqGymRequestCrmScope,
  routeIqGymRequestVersion
} from "../../crm/route-iq-gym-intake.mjs";

export const ROUTE_IQ_GYM_PREVIEW_INTAKE_PATH = "/api/partner-intake";
export const ROUTE_IQ_GYM_PREVIEW_RECEIPT_ID = "riq_receipt_000000000000000000000000";
export const ROUTE_IQ_GYM_PREVIEW_WORKER_NAME = "prometheusrouteiq-website-gym-preview";

const MAX_REQUEST_BYTES = 16 * 1024;
const API_ROOT = "/api";
const RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet"
});

function response(body, status = 200, headers = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: {
      ...RESPONSE_HEADERS,
      "Content-Type": typeof body === "string"
        ? "text/plain; charset=utf-8"
        : "application/json; charset=utf-8",
      ...headers
    }
  });
}

function previewError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function utf8Bytes(value) {
  return new TextEncoder().encode(String(value)).byteLength;
}

async function readGymPayload(request) {
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    throw previewError("route_iq_gym_preview_content_type_invalid", "Use application/json.", 415);
  }
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
    throw previewError("route_iq_gym_preview_too_large", "Request is too large.", 413);
  }
  const body = await request.text();
  if (utf8Bytes(body) > MAX_REQUEST_BYTES) {
    throw previewError("route_iq_gym_preview_too_large", "Request is too large.", 413);
  }
  try {
    return JSON.parse(body);
  } catch {
    throw previewError("route_iq_gym_preview_json_invalid", "Request body is invalid JSON.", 400);
  }
}

function safeErrorCode(error) {
  return typeof error?.code === "string" && /^route_iq_request_[a-z0-9_]+$/u.test(error.code)
    ? error.code
    : typeof error?.code === "string" && /^route_iq_gym_preview_[a-z0-9_]+$/u.test(error.code)
      ? error.code
      : "route_iq_gym_preview_validation_failed";
}

function safeErrorStatus(error) {
  return Number.isInteger(error?.status) && error.status >= 400 && error.status <= 499
    ? error.status
    : 422;
}

async function handleGymPreviewPost(request, now) {
  try {
    const payload = await readGymPayload(request);
    const normalized = adaptRouteIqGymRequestForCrm(payload, routeIqGymRequestCrmScope, { now });
    return response({
      ok: true,
      version: "route-iq-request-crm-v1",
      contractVersion: routeIqGymRequestVersion,
      receiptId: ROUTE_IQ_GYM_PREVIEW_RECEIPT_ID,
      status: "synthetic_preview_only",
      duplicate: false,
      submittedAt: normalized.submittedAt,
      timestamp: normalized.submittedAt,
      synthetic: true,
      persisted: false,
      notificationSent: false
    });
  } catch (error) {
    return response({
      ok: false,
      code: safeErrorCode(error),
      message: "Synthetic gym preview validation failed.",
      synthetic: true,
      persisted: false,
      notificationSent: false
    }, safeErrorStatus(error));
  }
}

function withPreviewHeaders(assetResponse, method) {
  const headers = new Headers(assetResponse.headers);
  for (const [name, value] of Object.entries(RESPONSE_HEADERS)) headers.set(name, value);
  return new Response(method === "HEAD" ? null : assetResponse.body, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers
  });
}

export async function handlePrometheusRouteIqGymPreviewRequest(
  request,
  env = {},
  { now = new Date() } = {}
) {
  const url = new URL(request.url);
  if (url.pathname === ROUTE_IQ_GYM_PREVIEW_INTAKE_PATH) {
    if (request.method !== "POST") {
      return response({ ok: false, code: "route_iq_gym_preview_method_not_allowed" }, 405, {
        Allow: "POST"
      });
    }
    return handleGymPreviewPost(request, now);
  }
  if (url.pathname === API_ROOT || url.pathname.startsWith(`${API_ROOT}/`)) {
    return response({ ok: false, code: "route_iq_gym_preview_route_not_found" }, 404);
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return response({ ok: false, code: "route_iq_gym_preview_method_not_allowed" }, 405, {
      Allow: "GET, HEAD"
    });
  }
  if (typeof env?.ASSETS?.fetch !== "function") {
    return response({ ok: false, code: "route_iq_gym_preview_assets_unavailable" }, 503);
  }
  try {
    return withPreviewHeaders(await env.ASSETS.fetch(request), request.method);
  } catch {
    return response({ ok: false, code: "route_iq_gym_preview_assets_unavailable" }, 503);
  }
}

export default {
  fetch: handlePrometheusRouteIqGymPreviewRequest
};
