#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  CLOUDFLARE_PUBLIC_WORKER_SMOKE_ORIGIN,
  CLOUDFLARE_PUBLIC_WORKER_SMOKE_REQUESTS,
  isCloudflarePublicWorkerSmokeRequestAllowed
} from "../workers/infrastructure/cloudflare-public-worker-smoke-contract.js";

const REQUEST_TIMEOUT_MS = 15_000;
const ALLOW_METHOD_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u;
const PUBLIC_INTAKE_ALLOWED_METHODS = Object.freeze(new Set(["POST", "OPTIONS"]));

export function isPublicIntakeGuardAllowHeaderValid(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  const entries = value.split(",");
  if (entries.length < 1 || entries.length > PUBLIC_INTAKE_ALLOWED_METHODS.size) return false;

  const methods = new Set();
  for (const entry of entries) {
    const match = /^[\t ]*([^\t ]+)[\t ]*$/u.exec(entry);
    if (!match || !ALLOW_METHOD_TOKEN.test(match[1])) return false;
    const method = match[1];
    if (!PUBLIC_INTAKE_ALLOWED_METHODS.has(method) || methods.has(method)) return false;
    methods.add(method);
  }
  return methods.has("POST");
}

export function fixedCloudflarePublicWorkerSmokePlan() {
  return Object.freeze(CLOUDFLARE_PUBLIC_WORKER_SMOKE_REQUESTS.map(entry => Object.freeze({
    kind: entry.kind,
    method: entry.method,
    url: `${CLOUDFLARE_PUBLIC_WORKER_SMOKE_ORIGIN}${entry.path}`,
    redirect: "manual",
    credentials: "omit",
    body: false
  })));
}

function requireAccessChallenge(response) {
  if (response.status !== 302) throw new Error("founder_access_challenge_missing");
  const location = response.headers.get("location");
  let url;
  try {
    url = new URL(location);
  } catch {
    throw new Error("founder_access_challenge_invalid");
  }
  if (url.protocol !== "https:"
    || !/^[a-z0-9-]+\.cloudflareaccess\.com$/u.test(url.hostname)
    || !url.pathname.startsWith("/cdn-cgi/access/")) {
    throw new Error("founder_access_challenge_invalid");
  }
}

function verifyResponse(entry, response) {
  if (response.redirected) throw new Error("smoke_redirect_followed");
  if (entry.kind === "public_asset") {
    if (response.status !== 200) throw new Error("public_asset_unavailable");
    return;
  }
  if (entry.kind === "public_intake_guard") {
    if (response.status !== 405
      || !isPublicIntakeGuardAllowHeaderValid(response.headers.get("allow"))) {
      throw new Error("public_intake_guard_invalid");
    }
    return;
  }
  if (entry.kind === "founder_access_challenge") {
    requireAccessChallenge(response);
    return;
  }
  throw new Error("smoke_kind_invalid");
}

export async function runCloudflarePublicWorkerSmoke({
  fetchImpl = globalThis.fetch,
  dryRun = true
} = {}) {
  const plan = fixedCloudflarePublicWorkerSmokePlan();
  if (dryRun) {
    return Object.freeze({
      status: "dry_run",
      origin: CLOUDFLARE_PUBLIC_WORKER_SMOKE_ORIGIN,
      requestCount: plan.length,
      attemptedWriteCount: 0,
      requests: plan
    });
  }
  if (typeof fetchImpl !== "function") throw new Error("smoke_fetch_unavailable");

  const results = [];
  for (const entry of CLOUDFLARE_PUBLIC_WORKER_SMOKE_REQUESTS) {
    const url = new URL(entry.path, CLOUDFLARE_PUBLIC_WORKER_SMOKE_ORIGIN);
    if (!isCloudflarePublicWorkerSmokeRequestAllowed(entry.method, url)) {
      throw new Error("fixed_smoke_plan_invalid");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetchImpl(url, {
        method: entry.method,
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        keepalive: false,
        signal: controller.signal
      });
      verifyResponse(entry, response);
      results.push(Object.freeze({
        kind: entry.kind,
        method: entry.method,
        path: entry.path,
        status: response.status
      }));
    } finally {
      clearTimeout(timeout);
      if (response?.body) await response.body.cancel().catch(() => {});
    }
  }

  return Object.freeze({
    status: "passed",
    origin: CLOUDFLARE_PUBLIC_WORKER_SMOKE_ORIGIN,
    requestCount: results.length,
    attemptedWriteCount: 0,
    results: Object.freeze(results)
  });
}

function parseArguments(argv) {
  if (argv.length === 0 || (argv.length === 1 && argv[0] === "--dry-run")) {
    return Object.freeze({ dryRun: true });
  }
  if (argv.length === 1 && argv[0] === "--execute-fixed-profile") {
    return Object.freeze({ dryRun: false });
  }
  throw new Error("public_worker_smoke_arguments_invalid");
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const result = await runCloudflarePublicWorkerSmoke(parseArguments(process.argv.slice(2)));
    process.stdout.write(`${result.status === "passed" ? "PASS" : "DRY_RUN_PASS"}\n`);
  } catch {
    process.stdout.write("FAIL\n");
    process.exitCode = 1;
  }
}
