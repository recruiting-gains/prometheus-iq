import {
  ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING,
  ROUTE_IQ_BUSINESS_AVAILABILITY_ENV,
  ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES,
  ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS,
  ROUTE_IQ_BUSINESS_AVAILABILITY_PATH,
  ROUTE_IQ_BUSINESS_AVAILABILITY_PRODUCER_BINDING,
  ROUTE_IQ_BUSINESS_AVAILABILITY_SCHEDULE,
  ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS,
  RouteIqBusinessAvailabilityError,
  failRouteIqBusinessAvailability,
  findRouteIqBusinessAvailabilityScope,
  getRouteIqBusinessAvailabilityActivation,
  routeIqBusinessAvailabilityCoordinatorName,
  routeIqBusinessAvailabilitySha256,
  validateRouteIqBusinessAvailabilitySnapshot
} from "./route-iq-business-availability-contract.js";
import {
  authorizeRouteIqCustomerPwaRequest
} from "./route-iq-august-1-customer-pwa-runtime.js";

const FIXED_ERROR_MESSAGE = "Route IQ business availability is unavailable.";
const PRODUCER_PATH = "/internal/route-iq/business-availability/normalized-snapshot";
const SCHEDULER_FAILURE_MAP = Object.freeze({
  producer_timeout: "PROVIDER_TIMEOUT",
  producer_network_failed: "PROVIDER_NETWORK_FAILED",
  producer_authorization_denied: "PROVIDER_AUTHORIZATION_DENIED",
  producer_rate_limited: "PROVIDER_RATE_LIMITED",
  producer_unavailable: "PROVIDER_UNAVAILABLE",
  producer_response_invalid: "PROVIDER_RESPONSE_INVALID",
  data_projection_invalid: "DATA_PROJECTION_INVALID",
  data_producer_unavailable: "DATA_PRODUCER_UNAVAILABLE"
});

function jsonResponse(body, status = 200, { head = false, headers = {} } = {}) {
  return new Response(head ? null : JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

function safeError(error) {
  return error instanceof RouteIqBusinessAvailabilityError
    ? error
    : new RouteIqBusinessAvailabilityError(
      ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.producerContractInvalid
    );
}

export function routeIqBusinessAvailabilityErrorResponse(error, { head = false } = {}) {
  const safe = safeError(error);
  return jsonResponse({
    ok: false,
    code: safe.code,
    message: FIXED_ERROR_MESSAGE
  }, safe.status, { head });
}

function validateNamespace(namespace) {
  if (!namespace
    || typeof namespace.idFromName !== "function"
    || typeof namespace.get !== "function") {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.bindingMissing);
  }
  return namespace;
}

function coordinatorStub(env, scope) {
  const namespace = validateNamespace(env?.[ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING]);
  const id = namespace.idFromName(routeIqBusinessAvailabilityCoordinatorName(scope));
  return namespace.get(id);
}

function exactAuthorizedTerritories(principal, scope) {
  const territoryIds = principal?.territoryIds;
  if (!Array.isArray(territoryIds)
    || territoryIds.length < 1
    || territoryIds.length > ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.territoriesPerScope
    || territoryIds.some(territoryId => !scope.territoryIds.includes(territoryId))
    || new Set(territoryIds).size !== territoryIds.length) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.territoryUnauthorized, 403);
  }
  return [...territoryIds].sort();
}

async function authenticatedScope(request, env, activation, testHooks) {
  const authorization = testHooks?.enabled === true && typeof testHooks.authorizeRequest === "function"
    ? await testHooks.authorizeRequest(request, env)
    : await authorizeRouteIqCustomerPwaRequest(request, env, {
      testHooks: testHooks?.customerPwa
    });
  const principal = authorization?.principal;
  if (!principal?.authorized
    || typeof principal.workspaceId !== "string"
    || typeof principal.operatingProfileId !== "string") {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.scopeUnauthorized, 403);
  }
  const scope = findRouteIqBusinessAvailabilityScope(
    activation,
    principal.workspaceId,
    principal.operatingProfileId
  );
  return {
    scope,
    authorizedTerritoryIds: exactAuthorizedTerritories(principal, scope)
  };
}

export async function handleRouteIqBusinessAvailabilityRequest(request, env = {}, { testHooks } = {}) {
  const head = request.method === "HEAD";
  try {
    if (!["GET", "HEAD"].includes(request.method)) {
      failRouteIqBusinessAvailability(
        ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.methodNotAllowed,
        405
      );
    }
    const activation = getRouteIqBusinessAvailabilityActivation(env, {
      now: testHooks?.enabled === true && testHooks.currentDate instanceof Date
        ? testHooks.currentDate
        : new Date()
    });
    if (!activation.active) {
      failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.inactive, 404);
    }
    const { scope, authorizedTerritoryIds } = await authenticatedScope(
      request,
      env,
      activation,
      testHooks
    );
    const stub = coordinatorStub(env, scope);
    if (typeof stub?.readLatestSnapshot !== "function") {
      failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.bindingMissing);
    }
    const result = await stub.readLatestSnapshot({
      scope,
      authorizedTerritoryIds
    });
    return jsonResponse({ ok: true, availability: result }, 200, { head });
  } catch (error) {
    return routeIqBusinessAvailabilityErrorResponse(error, { head });
  }
}

function scheduledTime(event, testHooks) {
  const value = testHooks?.enabled === true && Number.isFinite(testHooks.scheduledTime)
    ? testHooks.scheduledTime
    : event?.scheduledTime;
  if (!Number.isFinite(value) || value < 0) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.configurationInvalid);
  }
  return new Date(value).toISOString();
}

async function refreshBatchId(activation, scope, scheduledAt) {
  const digest = await routeIqBusinessAvailabilitySha256([
    activation.configurationVersion,
    scheduledAt,
    scope.workspaceId,
    scope.operatingProfileId,
    scope.manifestId,
    scope.manifestArtifactSha256
  ].join("\u0000"));
  return `riq_refresh_${digest.slice(0, 32)}`;
}

function validateProducerBinding(env) {
  const producer = env?.[ROUTE_IQ_BUSINESS_AVAILABILITY_PRODUCER_BINDING];
  if (!producer || typeof producer.fetch !== "function") {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.producerMissing);
  }
  return producer;
}

async function boundedResponseText(response) {
  const declaredLength = Number(response?.headers?.get?.("content-length") || 0);
  if (Number.isFinite(declaredLength)
    && declaredLength > ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.producerResponseBytes) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.producerContractInvalid);
  }
  if (!response?.body || typeof response.body.getReader !== "function") {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.producerContractInvalid);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      length += item.value.byteLength;
      if (length > ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.producerResponseBytes) {
        await reader.cancel("Route IQ availability producer response exceeded its byte limit.");
        failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.producerContractInvalid);
      }
      chunks.push(item.value);
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
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.producerContractInvalid);
  }
}

function producerFailureCode(response) {
  if (response.status === 401 || response.status === 403) return "producer_authorization_denied";
  if (response.status === 429) return "producer_rate_limited";
  if (response.status >= 500 && response.status <= 599) return "producer_unavailable";
  return "producer_response_invalid";
}

async function producerRequest(producer, scope, refreshId, scheduledAt) {
  const url = new URL(PRODUCER_PATH, "https://route-iq-data-producer.invalid");
  url.searchParams.set("workspace_id", scope.workspaceId);
  url.searchParams.set("operating_profile_id", scope.operatingProfileId);
  url.searchParams.set("manifest_id", scope.manifestId);
  url.searchParams.set("refresh_batch_id", refreshId);
  url.searchParams.set("scheduled_at", scheduledAt);
  const controller = new AbortController();
  let timeoutId;
  const timeout = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new RouteIqBusinessAvailabilityError(
        ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.producerFailed
      ));
    }, ROUTE_IQ_BUSINESS_AVAILABILITY_LIMITS.producerTimeoutMs);
  });
  try {
    const response = await Promise.race([
      Promise.resolve(producer.fetch(new Request(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Route-IQ-Availability-Contract": ROUTE_IQ_BUSINESS_AVAILABILITY_VERSIONS.snapshot
        },
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal
      }))),
      timeout
    ]);
    if (response?.redirected
      || (response?.status >= 300 && response?.status < 400)
      || response?.headers?.get?.("location")) {
      return { ok: false, failure: "producer_response_invalid" };
    }
    if (response?.status !== 200) {
      return { ok: false, failure: producerFailureCode(response || {}) };
    }
    const contentType = response.headers?.get?.("content-type");
    if (contentType && !/^application\/json(?:;|$)/iu.test(contentType.trim())) {
      return { ok: false, failure: "producer_response_invalid" };
    }
    const text = await boundedResponseText(response);
    let snapshot;
    try {
      snapshot = JSON.parse(text);
    } catch {
      return { ok: false, failure: "producer_response_invalid" };
    }
    return { ok: true, snapshot };
  } catch (error) {
    return {
      ok: false,
      failure: error instanceof RouteIqBusinessAvailabilityError
        ? "producer_timeout"
        : "producer_network_failed"
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function recordSchedulerFailure(stub, scope, refreshId, failure) {
  if (typeof stub?.recordRefreshFailure !== "function") {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.bindingMissing);
  }
  const reasonCode = SCHEDULER_FAILURE_MAP[failure] || "DATA_PRODUCER_UNAVAILABLE";
  return stub.recordRefreshFailure({
    scope,
    refreshBatchId: refreshId,
    reasonCode
  });
}

function safeSchedulerMetric(result) {
  console.info(JSON.stringify({
    event: "ROUTE_IQ_AVAILABILITY_SCHEDULED_REFRESH",
    state: result.state,
    scopes: result.scopes,
    accepted: result.accepted,
    failed: result.failed,
    conflicts: result.conflicts
  }));
}

export async function runRouteIqBusinessAvailabilityScheduledRefresh(
  event,
  env = {},
  { testHooks } = {}
) {
  const now = testHooks?.enabled === true && testHooks.currentDate instanceof Date
    ? testHooks.currentDate
    : new Date();
  const activation = getRouteIqBusinessAvailabilityActivation(env, { now });
  if (!activation.active) {
    const result = {
      state: "OFF",
      scopes: 0,
      accepted: 0,
      failed: 0,
      conflicts: 0
    };
    safeSchedulerMetric(result);
    return result;
  }
  if (event?.cron !== ROUTE_IQ_BUSINESS_AVAILABILITY_SCHEDULE) {
    failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.configurationInvalid);
  }
  const scheduledAt = scheduledTime(event, testHooks);
  const producer = validateProducerBinding(env);
  validateNamespace(env?.[ROUTE_IQ_BUSINESS_AVAILABILITY_BINDING]);
  const result = {
    state: "COMPLETED",
    scopes: activation.scopes.length,
    accepted: 0,
    failed: 0,
    conflicts: 0
  };

  for (const scope of activation.scopes) {
    const refreshId = await refreshBatchId(activation, scope, scheduledAt);
    const stub = coordinatorStub(env, scope);
    const produced = testHooks?.enabled === true && typeof testHooks.produceSnapshot === "function"
      ? await testHooks.produceSnapshot({ scope, refreshBatchId: refreshId, scheduledAt })
      : await producerRequest(producer, scope, refreshId, scheduledAt);
    if (!produced?.ok) {
      await recordSchedulerFailure(stub, scope, refreshId, produced?.failure || "data_producer_unavailable");
      result.failed += 1;
      continue;
    }
    let snapshot;
    try {
      snapshot = await validateRouteIqBusinessAvailabilitySnapshot(
        produced.snapshot,
        scope,
        { now }
      );
      if (snapshot.refreshBatchId !== refreshId) {
        failRouteIqBusinessAvailability(ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotInvalid);
      }
    } catch {
      await recordSchedulerFailure(stub, scope, refreshId, "data_projection_invalid");
      result.failed += 1;
      continue;
    }
    try {
      await stub.acceptNormalizedSnapshot({ scope, snapshot });
      result.accepted += 1;
    } catch (error) {
      if (error?.code === ROUTE_IQ_BUSINESS_AVAILABILITY_FAILURES.snapshotConflict) {
        result.conflicts += 1;
      } else {
        result.failed += 1;
      }
    }
  }
  safeSchedulerMetric(result);
  return result;
}

export async function handleRouteIqBusinessAvailabilityScheduled(event, env, executionContext, options = {}) {
  const promise = runRouteIqBusinessAvailabilityScheduledRefresh(event, env, options);
  if (typeof executionContext?.waitUntil === "function") {
    executionContext.waitUntil(promise);
  }
  return promise;
}

export function isRouteIqBusinessAvailabilityPath(pathname) {
  return pathname === ROUTE_IQ_BUSINESS_AVAILABILITY_PATH;
}

export {
  ROUTE_IQ_BUSINESS_AVAILABILITY_ENV,
  ROUTE_IQ_BUSINESS_AVAILABILITY_PATH
};
