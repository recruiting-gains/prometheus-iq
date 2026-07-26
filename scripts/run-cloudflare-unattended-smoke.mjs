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

export const CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY = Object.freeze({
  BOOTSTRAP_ALLOW_MISSING: "BOOTSTRAP_ALLOW_MISSING",
  REQUIRE_EXACT: "REQUIRE_EXACT"
});

export const CLOUDFLARE_UNATTENDED_SMOKE_FAILURE = Object.freeze({
  CREDENTIALS_INVALID: "CREDENTIALS_INVALID",
  FETCH_UNAVAILABLE: "FETCH_UNAVAILABLE",
  FIXED_PLAN_INVALID: "FIXED_PLAN_INVALID",
  NETWORK_FAILED: "NETWORK_FAILED",
  REDIRECT_DENIED: "REDIRECT_DENIED",
  HTTP_STATUS_REJECTED: "HTTP_STATUS_REJECTED",
  GUARD_MARKER_MISSING: "GUARD_MARKER_MISSING",
  GUARD_MARKER_INVALID: "GUARD_MARKER_INVALID"
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

export function fixedCloudflareUnattendedSmokePlan() {
  return Object.freeze(CANONICAL_SMOKE_REQUESTS.map(entry => Object.freeze({
    method: entry.method,
    url: `${CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN}${entry.path}`,
    redirect: "manual",
    credentials: "omit",
    body: false
  })));
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
    let response;
    try {
      response = await fetchImpl(url, {
        method: entry.method,
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
      });
    } catch {
      fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.NETWORK_FAILED);
    }
    requestCount += 1;
    if (response?.redirected || (response?.status >= 300 && response?.status < 400)) {
      fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.REDIRECT_DENIED);
    }
    if (!Number.isInteger(response?.status)
      || response.status < 200
      || response.status >= 300
      || typeof response.headers?.get !== "function") {
      fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.HTTP_STATUS_REJECTED);
    }
    const marker = response.headers.get(CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseHeader);
    if (marker === null) {
      if (markerPolicy === CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.REQUIRE_EXACT) {
        fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.GUARD_MARKER_MISSING);
      }
      markerOmittedCount += 1;
    } else if (marker !== CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseValue) {
      fail(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.GUARD_MARKER_INVALID);
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
