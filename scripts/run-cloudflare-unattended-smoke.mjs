import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

import {
  CLOUDFLARE_UNATTENDED_SMOKE_FIXED_REQUESTS,
  CLOUDFLARE_UNATTENDED_SMOKE_MARKER,
  CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN,
  CLOUDFLARE_UNATTENDED_SMOKE_VERSION,
  isCloudflareUnattendedSmokeRequestAllowed
} from "../workers/infrastructure/cloudflare-unattended-smoke-contract.js";

const SMOKE_CREDENTIAL_NAMES = Object.freeze([
  "CLOUDFLARE_ACCESS_CLIENT_ID",
  "CLOUDFLARE_ACCESS_CLIENT_SECRET"
]);
const ACCESS_CLIENT_ID_HEADER = ["CF", "Access", "Client", "Id"].join("-");
const ACCESS_CLIENT_SECRET_HEADER = ["CF", "Access", "Client", "Secret"].join("-");
const CANONICAL_SMOKE_REQUESTS = Object.freeze(
  CLOUDFLARE_UNATTENDED_SMOKE_FIXED_REQUESTS.filter(entry => (
    entry.path !== "/index.html"
  ))
);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export const CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY = Object.freeze({
  BOOTSTRAP_ALLOW_MISSING: "BOOTSTRAP_ALLOW_MISSING",
  REQUIRE_EXACT: "REQUIRE_EXACT"
});

export const CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION = Object.freeze({
  delayMilliseconds: 1_500,
  requestTimeoutMilliseconds: 2_500,
  maximumWaitMilliseconds: 46_500
});

export const CLOUDFLARE_UNATTENDED_SMOKE_PROBE = Object.freeze({
  UNSPECIFIED: "UNSPECIFIED",
  ROOT_GET: "ROOT_GET",
  SERVICE_WORKER_GET: "SERVICE_WORKER_GET",
  WEB_MANIFEST_GET: "WEB_MANIFEST_GET",
  BRAND_ICON_GET: "BRAND_ICON_GET",
  ACTIVE_POOL_GET: "ACTIVE_POOL_GET",
  QUARANTINE_POOL_GET: "QUARANTINE_POOL_GET",
  RUNTIME_POOLS_GET: "RUNTIME_POOLS_GET",
  BUSINESS_HOURS_GET: "BUSINESS_HOURS_GET",
  ROUTE_REPLENISHMENT_GET: "ROUTE_REPLENISHMENT_GET",
  ROUTE_REPLENISHMENT_CONTRACT_GET: "ROUTE_REPLENISHMENT_CONTRACT_GET",
  OPERATING_PROFILES_GET: "OPERATING_PROFILES_GET",
  OPERATING_PROFILE_CONTRACT_GET: "OPERATING_PROFILE_CONTRACT_GET",
  HOURS_ELIGIBILITY_GET: "HOURS_ELIGIBILITY_GET",
  HOURS_GOVERNANCE_GET: "HOURS_GOVERNANCE_GET",
  ROOT_HEAD: "ROOT_HEAD"
});

export const CLOUDFLARE_UNATTENDED_SMOKE_FAILURE = Object.freeze({
  CREDENTIALS_INVALID: "CREDENTIALS_INVALID",
  FETCH_UNAVAILABLE: "FETCH_UNAVAILABLE",
  FIXED_PLAN_INVALID: "FIXED_PLAN_INVALID",
  NETWORK_FAILED: "NETWORK_FAILED",
  REDIRECT_DENIED: "REDIRECT_DENIED",
  HTTP_STATUS_REJECTED: "HTTP_STATUS_REJECTED",
  GUARD_MARKER_MISSING: "GUARD_MARKER_MISSING",
  GUARD_MARKER_INVALID: "GUARD_MARKER_INVALID",
  GUARD_PROPAGATION_TIMEOUT: "GUARD_PROPAGATION_TIMEOUT",
  RELEASE_IDENTITY_MISMATCH: "RELEASE_IDENTITY_MISMATCH"
});

const MARKER_POLICIES = new Set(Object.values(CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY));
const FAILURE_DIMENSIONS = new Set(Object.values(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE));
const PROBES = new Set(Object.values(CLOUDFLARE_UNATTENDED_SMOKE_PROBE));
const FIXED_PROBES = new Map([
  ["GET /", CLOUDFLARE_UNATTENDED_SMOKE_PROBE.ROOT_GET],
  ["GET /sw.js", CLOUDFLARE_UNATTENDED_SMOKE_PROBE.SERVICE_WORKER_GET],
  ["GET /manifest.webmanifest", CLOUDFLARE_UNATTENDED_SMOKE_PROBE.WEB_MANIFEST_GET],
  ["GET /icons/prometheus.svg", CLOUDFLARE_UNATTENDED_SMOKE_PROBE.BRAND_ICON_GET],
  [
    "GET /data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json",
    CLOUDFLARE_UNATTENDED_SMOKE_PROBE.ACTIVE_POOL_GET
  ],
  [
    "GET /data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json",
    CLOUDFLARE_UNATTENDED_SMOKE_PROBE.QUARANTINE_POOL_GET
  ],
  [
    "GET /data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json",
    CLOUDFLARE_UNATTENDED_SMOKE_PROBE.RUNTIME_POOLS_GET
  ],
  [
    "GET /data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json",
    CLOUDFLARE_UNATTENDED_SMOKE_PROBE.BUSINESS_HOURS_GET
  ],
  [
    "GET /intelligence/continuous-adaptive-route-replenishment.mjs",
    CLOUDFLARE_UNATTENDED_SMOKE_PROBE.ROUTE_REPLENISHMENT_GET
  ],
  [
    "GET /intelligence/contracts/continuous-adaptive-route-replenishment-contracts.json",
    CLOUDFLARE_UNATTENDED_SMOKE_PROBE.ROUTE_REPLENISHMENT_CONTRACT_GET
  ],
  [
    "GET /intelligence/profiles/operating-profiles.json",
    CLOUDFLARE_UNATTENDED_SMOKE_PROBE.OPERATING_PROFILES_GET
  ],
  [
    "GET /intelligence/contracts/operating-profile-contracts.json",
    CLOUDFLARE_UNATTENDED_SMOKE_PROBE.OPERATING_PROFILE_CONTRACT_GET
  ],
  [
    "GET /intelligence/route-business-hours-eligibility.mjs",
    CLOUDFLARE_UNATTENDED_SMOKE_PROBE.HOURS_ELIGIBILITY_GET
  ],
  [
    "GET /scripts/lib/business-hours-governance.mjs",
    CLOUDFLARE_UNATTENDED_SMOKE_PROBE.HOURS_GOVERNANCE_GET
  ],
  ["HEAD /", CLOUDFLARE_UNATTENDED_SMOKE_PROBE.ROOT_HEAD]
]);

export class CloudflareUnattendedSmokeError extends Error {
  constructor(dimension, probe = CLOUDFLARE_UNATTENDED_SMOKE_PROBE.UNSPECIFIED) {
    super("CLOUDFLARE_UNATTENDED_SMOKE_FAILED");
    this.name = "CloudflareUnattendedSmokeError";
    this.dimension = FAILURE_DIMENSIONS.has(dimension)
      ? dimension
      : CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.FIXED_PLAN_INVALID;
    this.probe = PROBES.has(probe)
      ? probe
      : CLOUDFLARE_UNATTENDED_SMOKE_PROBE.UNSPECIFIED;
  }
}

function fail(dimension, probe) {
  throw new CloudflareUnattendedSmokeError(dimension, probe);
}

function requireCredential(credentials, name) {
  const value = credentials?.[name];
  if (typeof value !== "string" || value.length < 1 || value.length > 4096) {
    fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.CREDENTIALS_INVALID);
  }
  return value;
}

function smokeRequestOptions(clientId, clientSecret) {
  return {
    method: "GET",
    headers: {
      [ACCESS_CLIENT_ID_HEADER]: clientId,
      [ACCESS_CLIENT_SECRET_HEADER]: clientSecret,
      [CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestHeader]:
        CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestValue
    },
    redirect: "manual",
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    keepalive: false
  };
}

function fixedProbe(entry) {
  const probe = FIXED_PROBES.get(`${entry.method} ${entry.path}`);
  if (!probe) fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.FIXED_PLAN_INVALID);
  return probe;
}

async function withSmokeResponse(fetchImpl, url, options, timeoutMilliseconds, probe, inspect) {
  const controller = new AbortController();
  let timeoutId;
  try {
    const lifecycle = (async () => {
      const response = await fetchImpl(url, {
        ...options,
        signal: controller.signal
      });
      try {
        if (response?.redirected || (response?.status >= 300 && response?.status < 400)) {
          fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.REDIRECT_DENIED, probe);
        }
        if (!Number.isInteger(response?.status)
          || response.status < 200
          || response.status >= 300
          || typeof response.headers?.get !== "function") {
          fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.HTTP_STATUS_REJECTED, probe);
        }
        return await inspect(response);
      } finally {
        await discardResponseBody(response);
      }
    })();
    return await Promise.race([
      lifecycle,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new Error("smoke_request_timeout"));
        }, timeoutMilliseconds);
      })
    ]);
  } catch (error) {
    if (error instanceof CloudflareUnattendedSmokeError) throw error;
    fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.NETWORK_FAILED, probe);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    controller.abort();
  }
}

function markerState(response, probe) {
  const marker = response.headers.get(CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseHeader);
  if (marker === null) return "missing";
  if (marker !== CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseValue) {
    fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.GUARD_MARKER_INVALID, probe);
  }
  return "exact";
}

function workerVersionState(response, expectedWorkerVersion, probe) {
  const version = response.headers.get(
    CLOUDFLARE_UNATTENDED_SMOKE_VERSION.responseHeader
  );
  if (version === null) return "missing";
  if (!UUID.test(version)) {
    fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.RELEASE_IDENTITY_MISMATCH, probe);
  }
  return version === expectedWorkerVersion ? "exact" : "stale";
}

function defaultSleep(milliseconds) {
  return new Promise(resolveSleep => setTimeout(resolveSleep, milliseconds));
}

function defaultMonotonicNow() {
  return performance.now();
}

async function discardResponseBody(response) {
  try {
    await response?.body?.cancel();
  } catch {
    // The fixed failure classification is already determined by the response.
  }
}

export function fixedCloudflareUnattendedSmokePlan() {
  return Object.freeze(CANONICAL_SMOKE_REQUESTS.map(entry => Object.freeze({
    method: entry.method,
    url: `${CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN}${entry.path}`,
    redirect: "manual",
    credentials: "omit",
    body: false
  })));
}

export async function waitForCloudflareUnattendedSmokeGuard({
  fetchImpl = globalThis.fetch,
  credentials = process.env,
  sleepImpl = defaultSleep,
  nowImpl = defaultMonotonicNow,
  expectedWorkerVersion,
  dryRun = true
} = {}) {
  if (dryRun) {
    return Object.freeze({
      status: "dry_run",
      requestCount: 0,
      attemptedWriteCount: 0,
      requestTimeoutMilliseconds:
        CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.requestTimeoutMilliseconds,
      maximumWaitMilliseconds:
        CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.maximumWaitMilliseconds
    });
  }
  if (typeof fetchImpl !== "function") {
    fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.FETCH_UNAVAILABLE);
  }
  if (typeof sleepImpl !== "function") {
    fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.FIXED_PLAN_INVALID);
  }
  if (typeof nowImpl !== "function") {
    fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.FIXED_PLAN_INVALID);
  }
  if (!UUID.test(expectedWorkerVersion || "")) {
    fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.FIXED_PLAN_INVALID);
  }
  const clientId = requireCredential(credentials, SMOKE_CREDENTIAL_NAMES[0]);
  const clientSecret = requireCredential(credentials, SMOKE_CREDENTIAL_NAMES[1]);
  let requestCount = 0;
  let lastClock;
  const monotonicNow = () => {
    const observed = nowImpl();
    if (!Number.isFinite(observed)
      || observed < 0
      || (lastClock !== undefined && observed < lastClock)) {
      fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.FIXED_PLAN_INVALID);
    }
    lastClock = observed;
    return observed;
  };
  const startedAt = monotonicNow();
  const deadline = startedAt
    + CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.maximumWaitMilliseconds;
  let attempt = 0;
  let incomplete;

  while (true) {
    const attemptStartedAt = monotonicNow();
    const remainingMilliseconds = deadline - attemptStartedAt;
    if (attempt > 0 && remainingMilliseconds <= 0) {
      fail(
        incomplete?.marker === "exact"
          ? CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.RELEASE_IDENTITY_MISMATCH
          : CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.GUARD_PROPAGATION_TIMEOUT,
        incomplete?.probe
      );
    }
    attempt += 1;
    const requestTimeoutMilliseconds = Math.min(
      CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.requestTimeoutMilliseconds,
      Math.max(1, Math.floor(remainingMilliseconds))
    );
    const settled = await Promise.allSettled(CANONICAL_SMOKE_REQUESTS.map(async entry => {
      const probe = fixedProbe(entry);
      const url = new URL(entry.path, CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN);
      if (!isCloudflareUnattendedSmokeRequestAllowed(entry.method, url)) {
        fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.FIXED_PLAN_INVALID);
      }
      return withSmokeResponse(
        fetchImpl,
        url,
        {
          ...smokeRequestOptions(clientId, clientSecret),
          method: entry.method
        },
        requestTimeoutMilliseconds,
        probe,
        async response => Object.freeze({
          marker: markerState(response, probe),
          workerVersion: workerVersionState(response, expectedWorkerVersion, probe),
          probe
        })
      );
    }));
    requestCount += CANONICAL_SMOKE_REQUESTS.length;
    const rejected = settled.find(result => result.status === "rejected");
    if (rejected) throw rejected.reason;
    incomplete = settled
      .map(result => result.value)
      .find(observed => observed.marker !== "exact" || observed.workerVersion !== "exact");
    if (!incomplete) {
      return Object.freeze({
        status: "ready",
        attemptCount: attempt,
        requestCount,
        attemptedWriteCount: 0
      });
    }
    const beforeSleep = monotonicNow();
    const remainingBeforeSleep = deadline - beforeSleep;
    if (remainingBeforeSleep <= 0) {
      fail(
        incomplete.marker === "exact"
          ? CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.RELEASE_IDENTITY_MISMATCH
          : CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.GUARD_PROPAGATION_TIMEOUT,
        incomplete.probe
      );
    }
    const sleepMilliseconds = Math.min(
      CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.delayMilliseconds,
      remainingBeforeSleep
    );
    await sleepImpl(sleepMilliseconds);
    if (monotonicNow() <= beforeSleep) {
      fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.FIXED_PLAN_INVALID);
    }
  }
}

export async function runCloudflareUnattendedPostDeploymentSmoke(options = {}) {
  if (options.dryRun !== false) {
    return runCloudflareUnattendedSmoke({
      ...options,
      markerPolicy: CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.REQUIRE_EXACT
    });
  }
  const readiness = await waitForCloudflareUnattendedSmokeGuard(options);
  return Object.freeze({
    status: "passed",
    requestCount: CANONICAL_SMOKE_REQUESTS.length,
    attemptedWriteCount: 0,
    markerPolicy: CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.REQUIRE_EXACT,
    markerVerifiedCount: CANONICAL_SMOKE_REQUESTS.length,
    markerOmittedCount: 0,
    expectedWorkerVersion: options.expectedWorkerVersion,
    versionVerifiedCount: CANONICAL_SMOKE_REQUESTS.length,
    propagationAttemptCount: readiness.attemptCount,
    propagationRequestCount: readiness.requestCount
  });
}

export async function runCloudflareUnattendedSmoke({
  fetchImpl = globalThis.fetch,
  credentials = process.env,
  dryRun = true,
  markerPolicy = CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.REQUIRE_EXACT,
  expectedWorkerVersion
} = {}) {
  if (!MARKER_POLICIES.has(markerPolicy)) {
    fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.FIXED_PLAN_INVALID);
  }
  const plan = fixedCloudflareUnattendedSmokePlan();
  if (dryRun) {
    return Object.freeze({
      status: "dry_run",
      requestCount: plan.length,
      attemptedWriteCount: 0,
      markerPolicy
    });
  }
  if (typeof fetchImpl !== "function") {
    fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.FETCH_UNAVAILABLE);
  }
  if (expectedWorkerVersion !== undefined && !UUID.test(expectedWorkerVersion)) {
    fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.FIXED_PLAN_INVALID);
  }
  const clientId = requireCredential(credentials, SMOKE_CREDENTIAL_NAMES[0]);
  const clientSecret = requireCredential(credentials, SMOKE_CREDENTIAL_NAMES[1]);
  let requestCount = 0;
  let markerVerifiedCount = 0;
  let markerOmittedCount = 0;
  let versionVerifiedCount = 0;

  for (const entry of CANONICAL_SMOKE_REQUESTS) {
    const probe = fixedProbe(entry);
    const url = new URL(entry.path, CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN);
    if (!isCloudflareUnattendedSmokeRequestAllowed(entry.method, url)) {
      fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.FIXED_PLAN_INVALID);
    }
    const observed = await withSmokeResponse(
      fetchImpl,
      url,
      {
        ...smokeRequestOptions(clientId, clientSecret),
        method: entry.method
      },
      CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.requestTimeoutMilliseconds,
      probe,
      async response => Object.freeze({
        marker: markerState(response, probe),
        workerVersion: expectedWorkerVersion === undefined
          ? "not_required"
          : workerVersionState(response, expectedWorkerVersion, probe)
      })
    );
    requestCount += 1;
    if (observed.marker === "missing") {
      if (markerPolicy === CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.REQUIRE_EXACT) {
        fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.GUARD_MARKER_MISSING, probe);
      }
      markerOmittedCount += 1;
    } else {
      markerVerifiedCount += 1;
    }
    if (expectedWorkerVersion !== undefined) {
      if (observed.workerVersion !== "exact") {
        fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.RELEASE_IDENTITY_MISMATCH, probe);
      }
      versionVerifiedCount += 1;
    }
  }

  return Object.freeze({
    status: "passed",
    requestCount,
    attemptedWriteCount: 0,
    markerPolicy,
    markerVerifiedCount,
    markerOmittedCount,
    ...(expectedWorkerVersion === undefined
      ? {}
      : { expectedWorkerVersion, versionVerifiedCount })
  });
}

function parseArgs(argv) {
  if (argv.length === 0 || (argv.length === 1 && argv[0] === "--dry-run")) return { dryRun: true };
  if (argv.length === 1 && argv[0] === "--execute-fixed-profile") return { dryRun: false };
  throw new Error("Only --dry-run or --execute-fixed-profile is supported.");
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await runCloudflareUnattendedSmoke(options);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    const dimension = error instanceof CloudflareUnattendedSmokeError
      ? error.dimension
      : CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.FIXED_PLAN_INVALID;
    const probe = error instanceof CloudflareUnattendedSmokeError
      ? error.probe
      : CLOUDFLARE_UNATTENDED_SMOKE_PROBE.UNSPECIFIED;
    process.stdout.write(`SMOKE_FAILURE|DIMENSION=${dimension}|PROBE=${probe}\n`);
    process.exitCode = 1;
  }
}
