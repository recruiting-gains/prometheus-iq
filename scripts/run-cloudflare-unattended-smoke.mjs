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

function requireCredential(credentials, name) {
  const value = credentials?.[name];
  if (typeof value !== "string" || value.length < 1 || value.length > 4096) {
    throw new Error(`required_credential_absent:${name}`);
  }
  return value;
}

export function fixedCloudflareUnattendedSmokePlan() {
  return Object.freeze(CLOUDFLARE_UNATTENDED_SMOKE_FIXED_REQUESTS.map(entry => Object.freeze({
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
  dryRun = true
} = {}) {
  const plan = fixedCloudflareUnattendedSmokePlan();
  if (dryRun) {
    return Object.freeze({
      status: "dry_run",
      origin: CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN,
      requestCount: plan.length,
      requests: plan
    });
  }
  if (typeof fetchImpl !== "function") throw new Error("smoke_fetch_unavailable");
  const clientId = requireCredential(credentials, SMOKE_CREDENTIAL_NAMES[0]);
  const clientSecret = requireCredential(credentials, SMOKE_CREDENTIAL_NAMES[1]);
  const results = [];

  for (const entry of CLOUDFLARE_UNATTENDED_SMOKE_FIXED_REQUESTS) {
    const url = new URL(entry.path, CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN);
    if (!isCloudflareUnattendedSmokeRequestAllowed(entry.method, url)) {
      throw new Error("fixed_smoke_plan_invalid");
    }
    const response = await fetchImpl(url, {
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
    if (response.redirected
      || response.status < 200
      || response.status >= 300
      || response.headers.get(CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseHeader)
        !== CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseValue) {
      throw new Error(`smoke_guard_verification_failed:${entry.method}:${entry.path}:${response.status}`);
    }
    results.push(Object.freeze({
      method: entry.method,
      path: entry.path,
      status: response.status,
      guard: "verified"
    }));
  }

  return Object.freeze({
    status: "passed",
    origin: CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN,
    requestCount: results.length,
    attemptedWriteCount: 0,
    results: Object.freeze(results)
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
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Cloudflare unattended smoke failed: ${error.message}`);
    process.exitCode = 1;
  }
}
