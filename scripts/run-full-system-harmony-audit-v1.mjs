#!/usr/bin/env node

import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runPrivateWorkerReadOnlyIdentity } from "./run-github-actions-private-worker-read-only-identity.mjs";
import { runPrivateWorkerQualificationV2Command } from "./run-github-actions-private-worker-qualification-v2.mjs";
import { runPrivateWorkerDeploymentV2Command } from "./run-github-actions-private-worker-deployment-v2.mjs";

export const FULL_SYSTEM_HARMONY_AUDIT_POLICY = Object.freeze({
  repository: "PrometheusRouteIQ/prometheus-iq",
  branch: "main",
  workflowName: "Full-System Harmony Audit v1",
  workflowRef: "PrometheusRouteIQ/prometheus-iq/.github/workflows/full-system-harmony-audit-v1.yml@refs/heads/main",
  founderActor: "PrometheusRouteIQ",
  publicWorkerVersion: "6a8713c0-0712-4cda-8a13-daa893ca45f2",
  acceptedPrivatePrefix: "b121a01a",
  deploymentConfirmation: "I AUTHORIZE THIS EXACT FULL-SYSTEM HARMONY RUNTIME REPAIR"
});

const SHA40 = /^[0-9a-f]{40}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const BATCH = /^BATCH-[0-9]{8}-[0-9]{3}$/u;

function fail() {
  throw new Error("FULL_SYSTEM_HARMONY_AUDIT_FAILED");
}

export function validateFullSystemHarmonyAuditContext(environment) {
  if (environment.GITHUB_REPOSITORY !== FULL_SYSTEM_HARMONY_AUDIT_POLICY.repository
    || environment.GITHUB_REF !== "refs/heads/main"
    || environment.GITHUB_REF_NAME !== "main"
    || environment.GITHUB_REF_TYPE !== "branch"
    || environment.GITHUB_EVENT_NAME !== "workflow_dispatch"
    || environment.GITHUB_ACTOR !== FULL_SYSTEM_HARMONY_AUDIT_POLICY.founderActor
    || environment.GITHUB_TRIGGERING_ACTOR !== FULL_SYSTEM_HARMONY_AUDIT_POLICY.founderActor
    || environment.GITHUB_WORKFLOW !== FULL_SYSTEM_HARMONY_AUDIT_POLICY.workflowName
    || environment.GITHUB_WORKFLOW_REF !== FULL_SYSTEM_HARMONY_AUDIT_POLICY.workflowRef
    || environment.GITHUB_RUN_ATTEMPT !== "1"
    || environment.GITHUB_SHA !== environment.PROMETHEUS_CANDIDATE_COMMIT
    || !SHA40.test(environment.PROMETHEUS_CANDIDATE_COMMIT || "")
    || !SHA40.test(environment.PROMETHEUS_CANDIDATE_TREE || "")
    || !BATCH.test(environment.PROMETHEUS_BATCH_ID || "")
    || environment.PROMETHEUS_EXPECTED_PUBLIC_VERSION !== FULL_SYSTEM_HARMONY_AUDIT_POLICY.publicWorkerVersion
    || environment.PROMETHEUS_EXPECTED_PRIVATE_PREFIX !== FULL_SYSTEM_HARMONY_AUDIT_POLICY.acceptedPrivatePrefix
    || !["true", "false"].includes(environment.PROMETHEUS_RUNTIME_REPAIR_REQUIRED)
    || (environment.PROMETHEUS_RUNTIME_REPAIR_REQUIRED === "true"
      && environment.PROMETHEUS_DEPLOYMENT_CONFIRMATION !== FULL_SYSTEM_HARMONY_AUDIT_POLICY.deploymentConfirmation)) {
    fail();
  }
  return Object.freeze({ status: "FULL_SYSTEM_HARMONY_AUDIT_CONTEXT_VERIFIED" });
}

function privateV2Base(environment, mode) {
  const qualification = mode === "qualification";
  return {
    ...environment,
    GITHUB_WORKFLOW: qualification ? "Qualify Prometheus Private Worker v2" : "Deploy Prometheus Private Worker v2",
    GITHUB_WORKFLOW_REF: qualification
      ? "PrometheusRouteIQ/prometheus-iq/.github/workflows/qualify-prometheus-private-worker-v2.yml@refs/heads/main"
      : "PrometheusRouteIQ/prometheus-iq/.github/workflows/deploy-prometheus-private-worker-v2.yml@refs/heads/main",
    PROMETHEUS_CURRENT_PUBLIC_VERSION: environment.PROMETHEUS_LIVE_PUBLIC_VERSION,
    PROMETHEUS_CURRENT_PRIVATE_VERSION: environment.PROMETHEUS_LIVE_PRIVATE_VERSION,
    PROMETHEUS_FOUNDER_AUTHORIZATION: "I AUTHORIZE THIS EXACT PROMETHEUS PRIVATE WORKER DEPLOYMENT"
  };
}

function qualificationEnvironment(environment) {
  const value = privateV2Base(environment, "qualification");
  value.PROMETHEUS_DISPATCH_INPUTS_JSON = JSON.stringify({
    candidate_commit: value.PROMETHEUS_CANDIDATE_COMMIT,
    candidate_tree: value.PROMETHEUS_CANDIDATE_TREE,
    batch_id: value.PROMETHEUS_BATCH_ID,
    current_public_version: value.PROMETHEUS_CURRENT_PUBLIC_VERSION,
    current_private_version: value.PROMETHEUS_CURRENT_PRIVATE_VERSION
  });
  return value;
}

function deploymentEnvironment(environment) {
  const value = privateV2Base(environment, "deployment");
  value.PROMETHEUS_APPROVED_COMMIT = value.PROMETHEUS_CANDIDATE_COMMIT;
  value.PROMETHEUS_APPROVED_TREE = value.PROMETHEUS_CANDIDATE_TREE;
  value.PROMETHEUS_DISPATCH_INPUTS_JSON = JSON.stringify({
    approved_commit: value.PROMETHEUS_APPROVED_COMMIT,
    approved_tree: value.PROMETHEUS_APPROVED_TREE,
    batch_id: value.PROMETHEUS_BATCH_ID,
    current_public_version: value.PROMETHEUS_CURRENT_PUBLIC_VERSION,
    current_private_version: value.PROMETHEUS_CURRENT_PRIVATE_VERSION,
    qualification_run_id: value.PROMETHEUS_QUALIFICATION_RUN_ID,
    qualification_artifact_id: value.PROMETHEUS_QUALIFICATION_ARTIFACT_ID,
    qualification_artifact_zip_sha256: value.PROMETHEUS_QUALIFICATION_ARTIFACT_ZIP_SHA256,
    qualified_content_tree_sha256: value.PROMETHEUS_QUALIFIED_CONTENT_TREE_SHA256,
    qualified_manifest_sha256: value.PROMETHEUS_QUALIFIED_MANIFEST_SHA256,
    workflow_contract_sha256: value.PROMETHEUS_WORKFLOW_CONTRACT_SHA256,
    rollback_contract_sha256: value.PROMETHEUS_ROLLBACK_CONTRACT_SHA256,
    rollback_bundle_sha256: value.PROMETHEUS_ROLLBACK_BUNDLE_SHA256,
    founder_authorization: value.PROMETHEUS_FOUNDER_AUTHORIZATION
  });
  return value;
}

function identityEnvironment(environment) {
  return {
    ...environment,
    GITHUB_WORKFLOW: "Inspect Prometheus Worker Production Identity",
    GITHUB_WORKFLOW_REF: "PrometheusRouteIQ/prometheus-iq/.github/workflows/inspect-prometheus-worker-production-identity.yml@refs/heads/main"
  };
}

function writeIdentityOutputs(environment, result) {
  if (!environment.GITHUB_OUTPUT) fail();
  appendFileSync(environment.GITHUB_OUTPUT, [
    `public_version=${result.publicVersion}`,
    `private_version=${result.privateVersion}`,
    `public_traffic=${result.publicTrafficPercent}`,
    `private_traffic=${result.privateTrafficPercent}`
  ].join("\n") + "\n", { mode: 0o600 });
}

export async function runFullSystemHarmonyAudit({ mode, environment = process.env, fetchImpl = globalThis.fetch } = {}) {
  validateFullSystemHarmonyAuditContext(environment);
  if (mode === "preflight") return { status: "FULL_SYSTEM_HARMONY_AUDIT_PREFLIGHT_PASSED" };
  if (mode === "inspect") {
    const result = await runPrivateWorkerReadOnlyIdentity({
      mode: "inspect",
      environment: identityEnvironment(environment),
      fetchImpl
    });
    if (result.publicVersion !== environment.PROMETHEUS_EXPECTED_PUBLIC_VERSION
      || !result.privateVersion.startsWith(`${environment.PROMETHEUS_EXPECTED_PRIVATE_PREFIX}-`)
      || result.publicTrafficPercent !== 100
      || result.privateTrafficPercent !== 100) fail();
    writeIdentityOutputs(environment, result);
    return { status: "FULL_SYSTEM_HARMONY_AUDIT_IDENTITY_VERIFIED" };
  }
  if (mode === "qualify") {
    if (environment.PROMETHEUS_RUNTIME_REPAIR_REQUIRED !== "true") fail();
    return runPrivateWorkerQualificationV2Command({ mode: "build", environment: qualificationEnvironment(environment) });
  }
  if (mode === "verify-artifact") {
    return runPrivateWorkerQualificationV2Command({ mode: "verify", environment: deploymentEnvironment(environment) });
  }
  if (mode === "deploy") {
    if (environment.PROMETHEUS_RUNTIME_REPAIR_REQUIRED !== "true") fail();
    return runPrivateWorkerDeploymentV2Command({ mode: "deploy", environment: deploymentEnvironment(environment), fetchImpl });
  }
  fail();
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const result = await runFullSystemHarmonyAudit({ mode: process.argv[2] });
    process.stdout.write(`${result.status}\n`);
  } catch {
    process.stdout.write("FULL_SYSTEM_HARMONY_AUDIT_FAILED\n");
    process.exitCode = 1;
  }
}
