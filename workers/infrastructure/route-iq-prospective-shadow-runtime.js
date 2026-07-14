import { AEGIS_API_HEADERS } from "./aegis-security-controls.js";
import {
  ROUTE_IQ_PROSPECTIVE_BROWSER_EVENT_KINDS,
  ROUTE_IQ_PROSPECTIVE_DATA_ALLOCATOR_BLOCKER,
  ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING,
  ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS,
  ROUTE_IQ_PROSPECTIVE_SHADOW_PATH,
  ROUTE_IQ_PROSPECTIVE_SHADOW_PATH_PREFIX,
  assertExactKeys,
  canonicalIsoTimestamp,
  failRouteIqProspective,
  sha256Hex
} from "./route-iq-prospective-shadow-contract.js";
import {
  getRouteIqProspectiveActivation,
  verifyRouteIqProspectiveAccess
} from "./route-iq-prospective-shadow-access.js";
import {
  createRouteIqProspectiveAuthorityEnvelope
} from "./route-iq-prospective-shadow-authority.js";

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...AEGIS_API_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

export function isRouteIqProspectiveShadowPath(pathname) {
  return pathname === ROUTE_IQ_PROSPECTIVE_SHADOW_PATH
    || pathname.startsWith(ROUTE_IQ_PROSPECTIVE_SHADOW_PATH_PREFIX);
}

export function routeIqProspectiveShadowDisabledResponse() {
  return jsonResponse({
    ok: true,
    acknowledged: true,
    status: "disabled",
    collection: "OFF",
    recommendationInfluence: "OFF"
  }, 202);
}

async function readBoundedJson(request) {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    failRouteIqProspective("Prospective event requires application/json.", "route_iq_prospective_content_type_invalid", 415);
  }
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength)
      || parsedLength < 0
      || parsedLength > ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS.browserBodyBytes) {
      failRouteIqProspective("Prospective event body is too large.", "route_iq_prospective_body_too_large", 413);
    }
  }
  if (!request.body) {
    failRouteIqProspective("Prospective event body is required.", "route_iq_prospective_body_missing", 400);
  }

  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS.browserBodyBytes) {
        await reader.cancel("Prospective event body is too large.");
        failRouteIqProspective("Prospective event body is too large.", "route_iq_prospective_body_too_large", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    assertExactKeys(body, ["eventKind", "informationalSequence", "informationalObservedAt"], "browserEvent");
    return body;
  } catch (error) {
    if (error?.code?.startsWith?.("route_iq_prospective_")) throw error;
    failRouteIqProspective("Prospective event body is invalid JSON.", "route_iq_prospective_body_invalid", 400);
  }
}

function validateBrowserEvent(body) {
  if (!ROUTE_IQ_PROSPECTIVE_BROWSER_EVENT_KINDS.includes(body.eventKind)) {
    failRouteIqProspective("Prospective event kind is invalid.", "route_iq_prospective_event_kind_invalid", 400);
  }
  if (body.informationalSequence !== undefined
    && (!Number.isSafeInteger(body.informationalSequence)
      || body.informationalSequence < 0
      || body.informationalSequence > 1_000_000_000)) {
    failRouteIqProspective("Prospective informational sequence is invalid.", "route_iq_prospective_sequence_invalid", 400);
  }
  if (body.informationalObservedAt !== undefined) {
    canonicalIsoTimestamp(body.informationalObservedAt, "browserEvent.informationalObservedAt");
  }
  return body;
}

function runtimeNow(noncanonicalTestHooks) {
  if (noncanonicalTestHooks?.enabled === true) {
    if (!(noncanonicalTestHooks.currentDate instanceof Date)
      || Number.isNaN(noncanonicalTestHooks.currentDate.getTime())) {
      failRouteIqProspective("Noncanonical runtime clock is invalid.", "route_iq_prospective_test_hook_invalid", 500);
    }
    return noncanonicalTestHooks.currentDate.toISOString();
  }
  return new Date().toISOString();
}

async function coordinatorStubName(scope) {
  const digest = await sha256Hex({
    version: "route-iq-prospective-shadow-coordinator-route-v1",
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    representativeId: scope.representativeId
  });
  return `route-iq-prospective-shadow-v1-${digest}`;
}

function recordMetric(outcome, status, eventKind = undefined) {
  console.log(JSON.stringify({
    message: "Route IQ prospective infrastructure request.",
    metric: "route_iq_prospective_shadow_request",
    outcome,
    status,
    ...(eventKind ? { eventKind } : {})
  }));
}

function safeErrorResponse(error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const code = typeof error?.code === "string" ? error.code : "route_iq_prospective_infrastructure_failed";
  const details = status < 500 && error?.details?.paths ? { paths: error.details.paths } : {};
  recordMetric("blocked", status);
  return jsonResponse({
    ok: false,
    acknowledged: false,
    code,
    message: status >= 500
      ? "Prospective event coordination is unavailable."
      : "Prospective event was rejected.",
    retryable: status === 429 || status >= 500,
    recommendationInfluence: "OFF",
    ...details
  }, status);
}

export async function handleRouteIqProspectiveShadowRequest(request, env, { noncanonicalTestHooks } = {}) {
  const activation = getRouteIqProspectiveActivation(env);
  if (!activation.active) return routeIqProspectiveShadowDisabledResponse();

  try {
    const scope = await verifyRouteIqProspectiveAccess(request, env, {
      cohortConfig: activation.cohortConfig,
      noncanonicalTestHooks
    });
    if (request.method !== "POST") {
      return jsonResponse({
        ok: false,
        acknowledged: false,
        code: "route_iq_prospective_method_not_allowed",
        recommendationInfluence: "OFF"
      }, 405, { Allow: "POST" });
    }
    if (new URL(request.url).pathname !== ROUTE_IQ_PROSPECTIVE_SHADOW_PATH) {
      return jsonResponse({
        ok: false,
        acknowledged: false,
        code: "route_iq_prospective_path_not_found",
        recommendationInfluence: "OFF"
      }, 404);
    }

    const event = validateBrowserEvent(await readBoundedJson(request));
    const scopeEnvelope = await createRouteIqProspectiveAuthorityEnvelope({
      purpose: "coordinator_scope",
      workspaceId: scope.workspaceId,
      operatingProfileId: scope.operatingProfileId,
      representativeId: scope.representativeId,
      registryVersion: scope.registryVersion,
      issuedAt: runtimeNow(noncanonicalTestHooks)
    }, env);
    const namespace = env?.[ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING];
    if (!namespace || typeof namespace.getByName !== "function") {
      failRouteIqProspective(
        "Prospective coordinator binding is unavailable.",
        "route_iq_prospective_coordinator_binding_missing",
        503
      );
    }
    const stub = namespace.getByName(await coordinatorStubName(scope));
    const result = await stub.noteBrowserSignalBlocked({ scopeEnvelope, event });
    recordMetric("owner_dependency", 503, event.eventKind);
    return jsonResponse({ ...ROUTE_IQ_PROSPECTIVE_DATA_ALLOCATOR_BLOCKER, ...result }, 503);
  } catch (error) {
    return safeErrorResponse(error);
  }
}

export {
  ROUTE_IQ_PROSPECTIVE_SHADOW_PATH,
  ROUTE_IQ_PROSPECTIVE_SHADOW_PATH_PREFIX,
  getRouteIqProspectiveActivation
};
