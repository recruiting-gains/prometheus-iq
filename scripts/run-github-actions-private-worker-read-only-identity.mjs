#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  scrubDeploymentCredentials,
  takeDeploymentCredentials
} from "./lib/github-actions-private-worker-deployment.mjs";
import {
  fetchPublicWorkerState
} from "./lib/github-actions-public-worker-deployment.mjs";

export const PRIVATE_WORKER_READ_ONLY_IDENTITY_POLICY = Object.freeze({
  repository: "PrometheusRouteIQ/prometheus-iq",
  branch: "main",
  ref: "refs/heads/main",
  refType: "branch",
  eventName: "workflow_dispatch",
  founderActor: "PrometheusRouteIQ",
  firstRunAttempt: "1",
  workflowName: "Inspect Prometheus Worker Production Identity",
  workflowPath:
    ".github/workflows/inspect-prometheus-worker-production-identity.yml",
  workflowRef:
    "PrometheusRouteIQ/prometheus-iq/.github/workflows/inspect-prometheus-worker-production-identity.yml@refs/heads/main",
  protectedEnvironment: "prometheus-private-worker-production",
  publicWorker: "prometheusrouteiq-website",
  privateWorker: "prometheus-iq",
  methods: Object.freeze(["GET"]),
  cloudflareRequestCount: 4
});

const SHA40 = /^[0-9a-f]{40}$/u;
const MODES = new Set(["preflight", "inspect"]);

export class PrivateWorkerReadOnlyIdentityError extends Error {
  constructor() {
    super("PRIVATE_WORKER_READ_ONLY_IDENTITY_FAILED");
    this.name = "PrivateWorkerReadOnlyIdentityError";
  }
}

function fail() {
  throw new PrivateWorkerReadOnlyIdentityError();
}

export function validatePrivateWorkerReadOnlyIdentityContext(environment) {
  if (!environment || typeof environment !== "object"
    || environment.GITHUB_REPOSITORY
      !== PRIVATE_WORKER_READ_ONLY_IDENTITY_POLICY.repository
    || environment.GITHUB_REF !== PRIVATE_WORKER_READ_ONLY_IDENTITY_POLICY.ref
    || environment.GITHUB_REF_NAME
      !== PRIVATE_WORKER_READ_ONLY_IDENTITY_POLICY.branch
    || environment.GITHUB_REF_TYPE
      !== PRIVATE_WORKER_READ_ONLY_IDENTITY_POLICY.refType
    || environment.GITHUB_EVENT_NAME
      !== PRIVATE_WORKER_READ_ONLY_IDENTITY_POLICY.eventName
    || !SHA40.test(environment.GITHUB_SHA ?? "")
    || environment.GITHUB_ACTOR
      !== PRIVATE_WORKER_READ_ONLY_IDENTITY_POLICY.founderActor
    || environment.GITHUB_TRIGGERING_ACTOR
      !== PRIVATE_WORKER_READ_ONLY_IDENTITY_POLICY.founderActor
    || environment.GITHUB_WORKFLOW
      !== PRIVATE_WORKER_READ_ONLY_IDENTITY_POLICY.workflowName
    || environment.GITHUB_WORKFLOW_REF
      !== PRIVATE_WORKER_READ_ONLY_IDENTITY_POLICY.workflowRef
    || environment.GITHUB_RUN_ATTEMPT
      !== PRIVATE_WORKER_READ_ONLY_IDENTITY_POLICY.firstRunAttempt) {
    fail();
  }

  return Object.freeze({
    status: "PRIVATE_WORKER_READ_ONLY_IDENTITY_CONTEXT_VERIFIED"
  });
}

export async function runPrivateWorkerReadOnlyIdentity({
  mode,
  environment = process.env,
  fetchImpl = globalThis.fetch
}) {
  if (!MODES.has(mode)) fail();
  validatePrivateWorkerReadOnlyIdentityContext(environment);
  if (mode === "preflight") {
    return Object.freeze({
      status: "PRIVATE_WORKER_READ_ONLY_IDENTITY_PREFLIGHT_PASSED"
    });
  }

  let credentials;
  try {
    credentials = takeDeploymentCredentials(environment);
    const publicState = await fetchPublicWorkerState(
      PRIVATE_WORKER_READ_ONLY_IDENTITY_POLICY.publicWorker,
      credentials,
      fetchImpl
    );
    const privateState = await fetchPublicWorkerState(
      PRIVATE_WORKER_READ_ONLY_IDENTITY_POLICY.privateWorker,
      credentials,
      fetchImpl
    );
    return Object.freeze({
      status: "PRIVATE_WORKER_READ_ONLY_IDENTITY_VERIFIED",
      publicVersion: publicState.deployment.versionId,
      privateVersion: privateState.deployment.versionId,
      publicTrafficPercent: 100,
      privateTrafficPercent: 100
    });
  } catch {
    fail();
  } finally {
    scrubDeploymentCredentials(credentials);
  }
}

function formatResult(result) {
  if (result.status === "PRIVATE_WORKER_READ_ONLY_IDENTITY_PREFLIGHT_PASSED") {
    return result.status;
  }
  return [
    result.status,
    `PUBLIC_VERSION=${result.publicVersion}`,
    `PRIVATE_VERSION=${result.privateVersion}`,
    `PUBLIC_TRAFFIC=${result.publicTrafficPercent}`,
    `PRIVATE_TRAFFIC=${result.privateTrafficPercent}`
  ].join("|");
}

async function main() {
  const mode = process.argv[2];
  try {
    const result = await runPrivateWorkerReadOnlyIdentity({ mode });
    process.stdout.write(`${formatResult(result)}\n`);
  } catch {
    process.stderr.write("PRIVATE_WORKER_READ_ONLY_IDENTITY_FAILED\n");
    process.exitCode = 1;
  }
}

if (process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
