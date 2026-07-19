import { createRemoteJWKSet, jwtVerify } from "jose";

import {
  RouteIqRequestCrmError,
  exportRouteIqRequests,
  listRouteIqRequests,
  persistRouteIqRequest,
  publicRouteIqRequestReceipt,
  retrieveRouteIqRequest,
  routeIqRequestCrmVersion,
  routeIqRequestFounderAuthorization
} from "../../crm/route-iq-request-crm.mjs";

export const ROUTE_IQ_REQUEST_CRM_PATH = "/api/partner-intake";
export const ROUTE_IQ_REQUEST_CRM_FOUNDER_PATH = "/api/partner-intake/founder/requests";
export const ROUTE_IQ_REQUEST_CRM_EXPORT_PATH = "/api/partner-intake/founder/export";
export const ROUTE_IQ_REQUEST_CRM_BINDING = "ROUTE_IQ_REQUEST_CRM_COORDINATOR";
export const ROUTE_IQ_REQUEST_CRM_ENV = Object.freeze({
  accessAudience: "ROUTE_IQ_REQUEST_CRM_ACCESS_AUDIENCE",
  accessTeamDomain: "ROUTE_IQ_REQUEST_CRM_ACCESS_TEAM_DOMAIN",
  founderSubjectSha256: "ROUTE_IQ_REQUEST_CRM_FOUNDER_SUBJECT_SHA256"
});

const PUBLIC_REQUEST_VERSION = "route-iq-public-request.v1";
const PUBLIC_FORM_ID = "route_iq_request";
const INTERNAL_ORIGIN = "https://route-iq-request-crm.internal";
const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_RESPONSE_BYTES = 96 * 1024;
const MAX_SUBMISSION_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const PUBLIC_FIELDS = Object.freeze([
  "version",
  "formId",
  "businessName",
  "contactName",
  "businessEmail",
  "phone",
  "industry",
  "locationCount",
  "estimatedUserCount",
  "territory",
  "primaryProblem",
  "desiredTimeline",
  "consent",
  "submittedAt",
  "acquisitionSource",
  "websiteUrl"
]);
const TIMELINES = Object.freeze({
  "Exploring now": "exploring",
  "Within 30 days": "within_30_days",
  "Within 90 days": "within_90_days",
  "This year": "this_year",
  "No fixed timeline": "exploring"
});

let cachedJwksOrigin = null;
let cachedJwks = null;

function response(body, status = 200, headers = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

function runtimeError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function utf8Bytes(value) {
  return new TextEncoder().encode(String(value)).byteLength;
}

function exactObject(value, allowed, code = "route_iq_request_shape_invalid") {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw runtimeError(code, "Request body is invalid.", 422);
  const keys = Object.keys(value);
  if (keys.some(key => !allowed.includes(key)) || allowed.some(key => !keys.includes(key))) {
    throw runtimeError(code, "Request body is invalid.", 422);
  }
}

function boundedString(value, max, { nullable = false } = {}) {
  if (nullable && (value === null || value === undefined || value === "")) return "";
  if (typeof value !== "string") throw runtimeError("route_iq_request_field_invalid", "Request field is invalid.", 422);
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(normalized)) {
    throw runtimeError("route_iq_request_field_invalid", "Request field is invalid.", 422);
  }
  return normalized;
}

function strictPositiveInteger(value, max) {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw runtimeError("route_iq_request_field_invalid", "Request field is invalid.", 422);
  }
  return value;
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function canonicalTeamDomain(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw runtimeError("route_iq_request_founder_auth_config_invalid", "Founder access is unavailable.", 503);
  }
  if (url.protocol !== "https:"
    || !/^[a-z0-9-]+\.cloudflareaccess\.com$/u.test(url.hostname)
    || (url.pathname !== "/" && url.pathname !== "")
    || url.search
    || url.hash
    || url.username
    || url.password
    || url.port) {
    throw runtimeError("route_iq_request_founder_auth_config_invalid", "Founder access is unavailable.", 503);
  }
  return url.origin;
}

function authConfigString(value, max) {
  if (typeof value !== "string"
    || value.length < 1
    || value.length > max
    || /[\u0000-\u001F\u007F\s]/u.test(value)) {
    throw runtimeError("route_iq_request_founder_auth_config_invalid", "Founder access is unavailable.", 503);
  }
  return value;
}

function jwksFor(issuer) {
  if (cachedJwksOrigin !== issuer || !cachedJwks) {
    cachedJwksOrigin = issuer;
    cachedJwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
      timeoutDuration: 5000,
      cooldownDuration: 30000
    });
  }
  return cachedJwks;
}

async function founderPrincipal(request, env, testHooks) {
  if (testHooks?.enabled === true && testHooks.principal) return testHooks.principal;
  const issuer = canonicalTeamDomain(env?.[ROUTE_IQ_REQUEST_CRM_ENV.accessTeamDomain]);
  const audience = authConfigString(env?.[ROUTE_IQ_REQUEST_CRM_ENV.accessAudience], 256);
  const expectedSubjectSha256 = authConfigString(env?.[ROUTE_IQ_REQUEST_CRM_ENV.founderSubjectSha256], 64);
  if (!/^[a-f0-9]{64}$/u.test(expectedSubjectSha256)) {
    throw runtimeError("route_iq_request_founder_auth_config_invalid", "Founder access is unavailable.", 503);
  }
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || token.length > 16 * 1024) {
    throw runtimeError("route_iq_request_founder_auth_required", "Founder authentication is required.", 403);
  }
  try {
    const currentDate = testHooks?.enabled === true ? testHooks.currentDate : undefined;
    const keyResolver = testHooks?.enabled === true ? testHooks.keyResolver : jwksFor(issuer);
    const { payload } = await jwtVerify(token, keyResolver, {
      issuer,
      audience,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "iat", "exp"],
      clockTolerance: 5,
      ...(currentDate ? { currentDate } : {})
    });
    if (typeof payload.sub !== "string" || payload.sub.length < 1 || payload.sub.length > 512) {
      throw new Error("invalid subject");
    }
    if (await sha256(payload.sub) !== expectedSubjectSha256) {
      throw runtimeError("route_iq_request_founder_principal_unmapped", "Founder authentication is not authorized.", 403);
    }
    return {
      authenticated: true,
      identityProvider: routeIqRequestFounderAuthorization.identityProvider,
      immutablePrincipalId: routeIqRequestFounderAuthorization.immutablePrincipalId,
      subject: routeIqRequestFounderAuthorization.subject,
      workspaceId: routeIqRequestFounderAuthorization.workspaceId,
      identityImmutable: true
    };
  } catch (error) {
    if (error?.code?.startsWith?.("route_iq_request_")) throw error;
    throw runtimeError("route_iq_request_founder_auth_invalid", "Founder authentication is not authorized.", 403);
  }
}

async function readPublicBody(request) {
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    throw runtimeError("route_iq_request_content_type_invalid", "Use application/json.", 415);
  }
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
    throw runtimeError("route_iq_request_too_large", "Request is too large.", 413);
  }
  const text = await request.text();
  if (utf8Bytes(text) > MAX_REQUEST_BYTES) throw runtimeError("route_iq_request_too_large", "Request is too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw runtimeError("route_iq_request_json_invalid", "Request body is invalid JSON.", 400);
  }
}

export async function normalizePublicRouteIqRequest(input, { now = new Date() } = {}) {
  exactObject(input, PUBLIC_FIELDS);
  if (input.version !== PUBLIC_REQUEST_VERSION || input.formId !== PUBLIC_FORM_ID || input.consent !== true) {
    throw runtimeError("route_iq_request_contract_invalid", "Request contract is invalid.", 422);
  }
  if (input.websiteUrl !== "") throw runtimeError("route_iq_request_spam_rejected", "Request could not be accepted.", 400);
  const submittedAt = new Date(input.submittedAt);
  const serverNow = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(submittedAt.getTime()) || Number.isNaN(serverNow.getTime())
    || submittedAt.getTime() < serverNow.getTime() - MAX_SUBMISSION_AGE_MS
    || submittedAt.getTime() > serverNow.getTime() + MAX_FUTURE_SKEW_MS) {
    throw runtimeError("route_iq_request_submission_time_invalid", "Request time is invalid.", 422);
  }
  const timeline = TIMELINES[boundedString(input.desiredTimeline, 120)];
  if (!timeline) throw runtimeError("route_iq_request_timeline_invalid", "Request timeline is invalid.", 422);
  const eventHash = await sha256(`${PUBLIC_REQUEST_VERSION}|${PUBLIC_FORM_ID}|${submittedAt.toISOString()}`);
  boundedString(input.acquisitionSource, 120);
  return {
    workspaceId: "prometheus_route_iq",
    operatingProfileId: "route_iq_commercial",
    idempotencyKey: `route_iq_request_${eventHash}`,
    businessName: boundedString(input.businessName, 140),
    contactName: boundedString(input.contactName, 140),
    businessEmail: boundedString(input.businessEmail, 180),
    phone: boundedString(input.phone, 40, { nullable: true }),
    businessType: boundedString(input.industry, 120),
    numberOfLocations: strictPositiveInteger(input.locationCount, 10000),
    estimatedUsers: strictPositiveInteger(input.estimatedUserCount, 100000),
    territory: boundedString(input.territory, 220),
    primaryProblem: boundedString(input.primaryProblem, 1200),
    desiredTimeline: timeline,
    consent: true,
    acquisitionSource: "route_iq_website"
  };
}

async function callCoordinator(stub, pathname, body) {
  const result = await stub.fetch(`${INTERNAL_ORIGIN}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await result.text();
  if (utf8Bytes(text) > MAX_RESPONSE_BYTES) throw runtimeError("route_iq_request_crm_store_response_invalid", "CRM storage is unavailable.", 503);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw runtimeError("route_iq_request_crm_store_response_invalid", "CRM storage is unavailable.", 503);
  }
  if (!result.ok || parsed?.ok !== true) {
    throw runtimeError(parsed?.code || "route_iq_request_crm_store_failed", "CRM storage is unavailable.", 503);
  }
  return parsed;
}

export function createRouteIqRequestCrmDurableStore(env) {
  const namespace = env?.[ROUTE_IQ_REQUEST_CRM_BINDING];
  if (!namespace?.idFromName || !namespace?.get) {
    throw runtimeError("route_iq_request_crm_binding_missing", "CRM storage is unavailable.", 503);
  }
  const id = namespace.idFromName("prometheus_route_iq:route_iq_commercial");
  const stub = namespace.get(id);
  if (!stub?.fetch) throw runtimeError("route_iq_request_crm_binding_invalid", "CRM storage is unavailable.", 503);
  return Object.freeze({
    async get(key) {
      return (await callCoordinator(stub, "/v1/get", { key })).value;
    },
    async putIfAbsent(key, value, options = {}) {
      return (await callCoordinator(stub, "/v1/put-if-absent", { key, value, metadata: options.metadata || {} })).inserted === true;
    },
    async put(key, value, options = {}) {
      await callCoordinator(stub, "/v1/put", { key, value, metadata: options.metadata || {} });
    },
    async list({ prefix }) {
      return { keys: (await callCoordinator(stub, "/v1/list", { prefix })).keys };
    }
  });
}

function attemptId(testHooks) {
  if (testHooks?.enabled === true && typeof testHooks.attemptId === "string") return testHooks.attemptId;
  return `route_iq_attempt_${crypto.randomUUID().replaceAll("-", "")}`;
}

function safeCode(error) {
  return typeof error?.code === "string" && /^route_iq_request_[a-z0-9_]+$/u.test(error.code)
    ? error.code
    : error instanceof RouteIqRequestCrmError
      ? error.code
      : "route_iq_request_internal_failure";
}

function safeStatus(error) {
  return Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
}

async function recordFailure(store, error, id, now) {
  if (!store?.put) return;
  const occurredAt = (now instanceof Date ? now : new Date(now)).toISOString();
  const metadata = {
    version: routeIqRequestCrmVersion,
    workspaceId: "prometheus_route_iq",
    operatingProfileId: "route_iq_commercial",
    attemptId: id,
    occurredAt,
    status: "failed",
    failureCode: safeCode(error),
    httpStatus: safeStatus(error),
    containsRequestPii: false
  };
  await store.put(`infrastructure-route-iq-request-v1/failures/${id}.json`, JSON.stringify(metadata), {
    metadata: { recordType: "route_iq_request_failure", failureCode: metadata.failureCode }
  });
}

async function notifyFounder(env, store, result) {
  const key = `infrastructure-route-iq-request-v1/notifications/${result.receiptId}.json`;
  let status = "not_configured";
  let failureCode = null;
  if (env?.FOUNDER_EMAIL?.send) {
    try {
      await env.FOUNDER_EMAIL.send({
        to: env.FOUNDER_NOTIFICATION_TO || undefined,
        from: env.FOUNDER_NOTIFICATION_FROM || "intake@prometheusrouteiq.com",
        subject: `New Route IQ request ${result.receiptId}`,
        text: [
          "A Route IQ request was durably accepted.",
          `Receipt: ${result.receiptId}`,
          `Submitted: ${result.record.request.submittedAt}`,
          `Business type: ${result.record.request.businessType}`,
          `Locations: ${result.record.request.numberOfLocations}`,
          `Estimated users: ${result.record.request.estimatedUsers}`,
          `Timeline: ${result.record.request.desiredTimeline}`,
          "Use Founder-only CRM retrieval for contact details."
        ].join("\n")
      });
      status = "sent";
    } catch {
      status = "failed";
      failureCode = "founder_notification_delivery_failed";
    }
  }
  await store.put(key, JSON.stringify({
    version: routeIqRequestCrmVersion,
    receiptId: result.receiptId,
    status,
    failureCode,
    containsContactPii: false
  }), { metadata: { recordType: "route_iq_request_notification", receiptId: result.receiptId, status } });
}

async function handlePublicPost(request, env, options) {
  const id = attemptId(options.testHooks);
  let store;
  try {
    const body = await readPublicBody(request);
    const normalized = await normalizePublicRouteIqRequest(body, { now: options.now || new Date() });
    store = options.store || createRouteIqRequestCrmDurableStore(env);
    const result = await persistRouteIqRequest(store, normalized, { now: options.now || new Date() });
    if (!result.duplicate) await notifyFounder(env, store, result);
    const receipt = publicRouteIqRequestReceipt(result);
    return response({ ...receipt, timestamp: receipt.submittedAt }, result.duplicate ? 200 : 201);
  } catch (error) {
    const status = safeStatus(error);
    const code = safeCode(error);
    try {
      store ||= options.store || createRouteIqRequestCrmDurableStore(env);
      await recordFailure(store, error, id, options.now || new Date());
    } catch {
      // Failure monitoring cannot weaken the primary fail-closed response.
    }
    console.error(JSON.stringify({
      message: "Route IQ request intake failed.",
      code,
      status,
      containsRequestPii: false
    }));
    return response({
      ok: false,
      code,
      message: status >= 500 ? "Route IQ request storage is temporarily unavailable." : "Route IQ request was not accepted."
    }, status);
  }
}

async function founderScope(request, env, options) {
  return {
    principal: await founderPrincipal(request, env, options.authTestHooks),
    workspaceId: "prometheus_route_iq",
    operatingProfileId: "route_iq_commercial"
  };
}

async function handleFounderGet(request, env, options) {
  try {
    const url = new URL(request.url);
    const scope = await founderScope(request, env, options);
    const store = options.store || createRouteIqRequestCrmDurableStore(env);
    if (url.pathname === ROUTE_IQ_REQUEST_CRM_FOUNDER_PATH) {
      const records = await listRouteIqRequests(store, scope);
      return response({ ok: true, version: routeIqRequestCrmVersion, recordCount: records.length, records });
    }
    if (url.pathname.startsWith(`${ROUTE_IQ_REQUEST_CRM_FOUNDER_PATH}/`)) {
      const receiptId = decodeURIComponent(url.pathname.slice(ROUTE_IQ_REQUEST_CRM_FOUNDER_PATH.length + 1));
      const record = await retrieveRouteIqRequest(store, { ...scope, receiptId });
      return record ? response({ ok: true, record }) : response({ ok: false, code: "route_iq_request_not_found" }, 404);
    }
    if (url.pathname === ROUTE_IQ_REQUEST_CRM_EXPORT_PATH) {
      const format = url.searchParams.get("format") || "json";
      const exported = await exportRouteIqRequests(store, {
        ...scope,
        format,
        generatedAt: options.now || new Date()
      });
      return response(exported, 200, {
        "Content-Disposition": `attachment; filename="route-iq-requests.${format === "csv" ? "csv" : "json"}"`,
        "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8"
      });
    }
    return response({ ok: false, code: "route_iq_request_route_not_found" }, 404);
  } catch (error) {
    return response({ ok: false, code: safeCode(error), message: "Founder-only Route IQ CRM access is unavailable." }, safeStatus(error));
  }
}

export function isRouteIqRequestCrmPath(pathname) {
  return pathname === ROUTE_IQ_REQUEST_CRM_PATH
    || pathname === ROUTE_IQ_REQUEST_CRM_FOUNDER_PATH
    || pathname === ROUTE_IQ_REQUEST_CRM_EXPORT_PATH
    || pathname.startsWith(`${ROUTE_IQ_REQUEST_CRM_FOUNDER_PATH}/`);
}

export async function handleRouteIqRequestCrmRuntimeRequest(request, env = {}, options = {}) {
  const url = new URL(request.url);
  if (!isRouteIqRequestCrmPath(url.pathname)) return response({ ok: false, code: "route_iq_request_route_not_found" }, 404);
  if (url.pathname === ROUTE_IQ_REQUEST_CRM_PATH) {
    if (request.method !== "POST") return response({ ok: false, code: "route_iq_request_method_not_allowed" }, 405, { Allow: "POST" });
    return handlePublicPost(request, env, options);
  }
  if (request.method !== "GET") return response({ ok: false, code: "route_iq_request_method_not_allowed" }, 405, { Allow: "GET" });
  return handleFounderGet(request, env, options);
}
