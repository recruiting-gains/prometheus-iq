import {
  CLOUDFLARE_PUBLIC_WORKER_SMOKE_ORIGIN,
  CLOUDFLARE_PUBLIC_WORKER_SMOKE_REQUESTS,
  isCloudflarePublicWorkerSmokeRequestAllowed
} from "../../workers/infrastructure/cloudflare-public-worker-smoke-contract.js";
import {
  verifyCloudflarePublicWorkerSmokeResponse
} from "../run-cloudflare-public-worker-smoke.mjs";

const REQUEST_TIMEOUT_MS = 15_000;
const NONCRITICAL_PATHS = new Set(["/robots.txt", "/sitemap.xml"]);
const FIXED_FAILURE = Object.freeze({
  REQUEST_FAILED: "REQUEST_FAILED",
  RESPONSE_REJECTED: "RESPONSE_REJECTED"
});

function smokeFailure(entry, reason) {
  return Object.freeze({
    method: entry.method,
    path: entry.path,
    classification: reason
  });
}

export function publicWorkerSmokeV2Plan() {
  return Object.freeze(CLOUDFLARE_PUBLIC_WORKER_SMOKE_REQUESTS.map(entry => Object.freeze({
    ...entry,
    critical: !NONCRITICAL_PATHS.has(entry.path),
    body: false
  })));
}

export async function runPublicWorkerSmokeV2({
  fetchImpl = globalThis.fetch,
  timeoutMs = REQUEST_TIMEOUT_MS
} = {}) {
  if (typeof fetchImpl !== "function"
    || !Number.isSafeInteger(timeoutMs)
    || timeoutMs < 1
    || timeoutMs > REQUEST_TIMEOUT_MS) {
    throw new Error("public_worker_smoke_v2_input_invalid");
  }
  const criticalFailures = [];
  const noncriticalFailures = [];
  let requestCount = 0;
  for (const entry of publicWorkerSmokeV2Plan()) {
    const url = new URL(entry.path, CLOUDFLARE_PUBLIC_WORKER_SMOKE_ORIGIN);
    if (!isCloudflarePublicWorkerSmokeRequestAllowed(entry.method, url)) {
      throw new Error("public_worker_smoke_v2_plan_invalid");
    }
    requestCount += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    let failure;
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
      try {
        verifyCloudflarePublicWorkerSmokeResponse(entry, response);
      } catch {
        failure = smokeFailure(entry, FIXED_FAILURE.RESPONSE_REJECTED);
      }
    } catch {
      failure = smokeFailure(entry, FIXED_FAILURE.REQUEST_FAILED);
    } finally {
      clearTimeout(timer);
      if (response?.body) await response.body.cancel().catch(() => {});
    }
    if (failure) {
      (entry.critical ? criticalFailures : noncriticalFailures).push(failure);
    }
  }
  return Object.freeze({
    status: criticalFailures.length > 0
      ? "CRITICAL_SMOKE_FAILED"
      : noncriticalFailures.length > 0
        ? "NONCRITICAL_SMOKE_REPORTED"
        : "PASS",
    requestCount,
    attemptedWriteCount: 0,
    criticalFailures: Object.freeze(criticalFailures),
    noncriticalFailures: Object.freeze(noncriticalFailures)
  });
}
