import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  CLOUDFLARE_UNATTENDED_SMOKE_FIXED_REQUESTS,
  CLOUDFLARE_UNATTENDED_SMOKE_MARKER,
  CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN,
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
const PROPAGATION_PROBE = Object.freeze({ method: "GET", path: "/" });
const PROPAGATION_RESPONSE_MAX_BYTES = 2 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/u;

export const CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY = Object.freeze({
  BOOTSTRAP_ALLOW_MISSING: "BOOTSTRAP_ALLOW_MISSING",
  REQUIRE_EXACT: "REQUIRE_EXACT"
});

export const CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION = Object.freeze({
  maxAttempts: 12,
  delayMilliseconds: 1_500,
  requestTimeoutMilliseconds: 2_500,
  maximumWaitMilliseconds: 46_500
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

export class CloudflareUnattendedSmokeError extends Error {
  constructor(dimension) {
    super("CLOUDFLARE_UNATTENDED_SMOKE_FAILED");
    this.name = "CloudflareUnattendedSmokeError";
    this.dimension = FAILURE_DIMENSIONS.has(dimension)
      ? dimension
      : CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.FIXED_PLAN_INVALID;
  }
}

function fail(dimension) {
  throw new CloudflareUnattendedSmokeError(dimension);
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
    method: PROPAGATION_PROBE.method,
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

async function fetchSmokeResponse(fetchImpl, url, options, timeoutMilliseconds) {
  let response;
  let timeoutId;
  try {
    const fetchPromise = fetchImpl(url, options);
    response = timeoutMilliseconds === undefined
      ? await fetchPromise
      : await Promise.race([
          fetchPromise,
          new Promise((_, reject) => {
            timeoutId = setTimeout(
              () => reject(new Error("smoke_request_timeout")),
              timeoutMilliseconds
            );
          })
        ]);
  } catch {
    fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.NETWORK_FAILED);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
  if (response?.redirected || (response?.status >= 300 && response?.status < 400)) {
    await discardResponseBody(response);
    fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.REDIRECT_DENIED);
  }
  if (!Number.isInteger(response?.status)
    || response.status < 200
    || response.status >= 300
    || typeof response.headers?.get !== "function") {
    await discardResponseBody(response);
    fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.HTTP_STATUS_REJECTED);
  }
  return response;
}

function markerState(response) {
  const marker = response.headers.get(CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseHeader);
  if (marker === null) return "missing";
  if (marker !== CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseValue) {
    fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.GUARD_MARKER_INVALID);
  }
  return "exact";
}

function defaultSleep(milliseconds) {
  return new Promise(resolveSleep => setTimeout(resolveSleep, milliseconds));
}

async function discardResponseBody(response) {
  try {
    await response?.body?.cancel();
  } catch {
    // The fixed failure classification is already determined by the response.
  }
}

async function hashBoundedResponseBody(response) {
  if (!response?.body || typeof response.body.getReader !== "function") {
    return createHash("sha256").digest("hex");
  }
  const reader = response.body.getReader();
  const hash = createHash("sha256");
  let byteCount = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.NETWORK_FAILED);
      }
      byteCount += value.byteLength;
      if (byteCount > PROPAGATION_RESPONSE_MAX_BYTES) {
        await reader.cancel();
        fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.RELEASE_IDENTITY_MISMATCH);
      }
      hash.update(value);
    }
  } catch (error) {
    if (error instanceof CloudflareUnattendedSmokeError) throw error;
    fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.NETWORK_FAILED);
  } finally {
    reader.releaseLock();
  }
  return hash.digest("hex");
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
  expectedRootSha256,
  dryRun = true
} = {}) {
  if (dryRun) {
    return Object.freeze({
      status: "dry_run",
      requestCount: 0,
      attemptedWriteCount: 0,
      maxAttempts: CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.maxAttempts,
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
  if (!SHA256.test(expectedRootSha256 || "")) {
    fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.FIXED_PLAN_INVALID);
  }
  const clientId = requireCredential(credentials, SMOKE_CREDENTIAL_NAMES[0]);
  const clientSecret = requireCredential(credentials, SMOKE_CREDENTIAL_NAMES[1]);
  const url = new URL(PROPAGATION_PROBE.path, CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN);
  if (!isCloudflareUnattendedSmokeRequestAllowed(PROPAGATION_PROBE.method, url)) {
    fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.FIXED_PLAN_INVALID);
  }

  for (let attempt = 1;
    attempt <= CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.maxAttempts;
    attempt += 1) {
    const response = await fetchSmokeResponse(
      fetchImpl,
      url,
      {
        ...smokeRequestOptions(clientId, clientSecret),
        signal: AbortSignal.timeout(
          CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.requestTimeoutMilliseconds
        )
      },
      CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.requestTimeoutMilliseconds
    );
    let observedMarkerState;
    try {
      observedMarkerState = markerState(response);
    } catch (error) {
      await discardResponseBody(response);
      throw error;
    }
    if (observedMarkerState === "exact"
      && await hashBoundedResponseBody(response) === expectedRootSha256) {
      return Object.freeze({
        status: "ready",
        requestCount: attempt,
        attemptedWriteCount: 0
      });
    }
    if (observedMarkerState === "missing") {
      await discardResponseBody(response);
    }
    if (attempt === CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.maxAttempts) {
      fail(observedMarkerState === "exact"
        ? CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.RELEASE_IDENTITY_MISMATCH
        : CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.GUARD_PROPAGATION_TIMEOUT);
    }
    await sleepImpl(CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.delayMilliseconds);
  }
  fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.GUARD_PROPAGATION_TIMEOUT);
}

export async function runCloudflareUnattendedPostDeploymentSmoke(options = {}) {
  await waitForCloudflareUnattendedSmokeGuard(options);
  return runCloudflareUnattendedSmoke({
    ...options,
    markerPolicy: CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.REQUIRE_EXACT
  });
}

export async function runCloudflareUnattendedSmoke({
  fetchImpl = globalThis.fetch,
  credentials = process.env,
  dryRun = true,
  markerPolicy = CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.REQUIRE_EXACT
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
  const clientId = requireCredential(credentials, SMOKE_CREDENTIAL_NAMES[0]);
  const clientSecret = requireCredential(credentials, SMOKE_CREDENTIAL_NAMES[1]);
  let requestCount = 0;
  let markerVerifiedCount = 0;
  let markerOmittedCount = 0;

  for (const entry of CANONICAL_SMOKE_REQUESTS) {
    const url = new URL(entry.path, CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN);
    if (!isCloudflareUnattendedSmokeRequestAllowed(entry.method, url)) {
      fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.FIXED_PLAN_INVALID);
    }
    const response = await fetchSmokeResponse(fetchImpl, url, {
      ...smokeRequestOptions(clientId, clientSecret),
      method: entry.method
    });
    requestCount += 1;
    let observedMarkerState;
    try {
      observedMarkerState = markerState(response);
    } finally {
      await discardResponseBody(response);
    }
    if (observedMarkerState === "missing") {
      if (markerPolicy === CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.REQUIRE_EXACT) {
        fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.GUARD_MARKER_MISSING);
      }
      markerOmittedCount += 1;
    } else {
      markerVerifiedCount += 1;
    }
  }

  return Object.freeze({
    status: "passed",
    requestCount,
    attemptedWriteCount: 0,
    markerPolicy,
    markerVerifiedCount,
    markerOmittedCount
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
    process.stdout.write(`SMOKE_FAILURE|DIMENSION=${dimension}\n`);
    process.exitCode = 1;
  }
}
