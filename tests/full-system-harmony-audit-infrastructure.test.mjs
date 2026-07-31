import assert from "node:assert/strict";
import test from "node:test";

import {
  FULL_SYSTEM_HARMONY_AUDIT_POLICY,
  runFullSystemHarmonyAudit,
  validateFullSystemHarmonyAuditContext
} from "../scripts/run-full-system-harmony-audit-v1.mjs";
import { verifyFullSystemHarmonyAuditV1 } from "../scripts/verify-full-system-harmony-audit-v1.mjs";

function environment(overrides = {}) {
  const commit = "a".repeat(40);
  return {
    GITHUB_REPOSITORY: "PrometheusRouteIQ/prometheus-iq",
    GITHUB_REF: "refs/heads/main",
    GITHUB_REF_NAME: "main",
    GITHUB_REF_TYPE: "branch",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_ACTOR: "PrometheusRouteIQ",
    GITHUB_TRIGGERING_ACTOR: "PrometheusRouteIQ",
    GITHUB_WORKFLOW: "Full-System Harmony Audit v1",
    GITHUB_WORKFLOW_REF: FULL_SYSTEM_HARMONY_AUDIT_POLICY.workflowRef,
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_SHA: commit,
    PROMETHEUS_CANDIDATE_COMMIT: commit,
    PROMETHEUS_CANDIDATE_TREE: "b".repeat(40),
    PROMETHEUS_BATCH_ID: "BATCH-20260731-002",
    PROMETHEUS_EXPECTED_PUBLIC_VERSION: FULL_SYSTEM_HARMONY_AUDIT_POLICY.publicWorkerVersion,
    PROMETHEUS_EXPECTED_PRIVATE_PREFIX: "b121a01a",
    PROMETHEUS_RUNTIME_REPAIR_REQUIRED: "true",
    PROMETHEUS_DEPLOYMENT_CONFIRMATION: FULL_SYSTEM_HARMONY_AUDIT_POLICY.deploymentConfirmation,
    ...overrides
  };
}

test("canonical Infrastructure workflow, provenance, rollback, and edge contracts verify", () => {
  assert.equal(verifyFullSystemHarmonyAuditV1().status, "FULL_SYSTEM_HARMONY_AUDIT_V1_VERIFIED");
});

test("exact Founder, main, commit, tree, Worker baseline, and confirmation pass", async () => {
  assert.equal(validateFullSystemHarmonyAuditContext(environment()).status,
    "FULL_SYSTEM_HARMONY_AUDIT_CONTEXT_VERIFIED");
  assert.deepEqual(await runFullSystemHarmonyAudit({ mode: "preflight", environment: environment() }), {
    status: "FULL_SYSTEM_HARMONY_AUDIT_PREFLIGHT_PASSED"
  });
});

test("identity, branch, prefix, and runtime-repair confirmation drift fail closed", () => {
  for (const drift of [
    { GITHUB_ACTOR: "someone-else" },
    { GITHUB_REF_NAME: "feature" },
    { GITHUB_SHA: "c".repeat(40) },
    { PROMETHEUS_EXPECTED_PRIVATE_PREFIX: "ffffffff" },
    { PROMETHEUS_DEPLOYMENT_CONFIRMATION: "approve" }
  ]) assert.throws(() => validateFullSystemHarmonyAuditContext(environment(drift)));
});

test("audit-only execution permits an empty confirmation but deployment mode does not", async () => {
  const auditOnly = environment({
    PROMETHEUS_RUNTIME_REPAIR_REQUIRED: "false",
    PROMETHEUS_DEPLOYMENT_CONFIRMATION: ""
  });
  assert.equal(validateFullSystemHarmonyAuditContext(auditOnly).status,
    "FULL_SYSTEM_HARMONY_AUDIT_CONTEXT_VERIFIED");
  await assert.rejects(() => runFullSystemHarmonyAudit({ mode: "qualify", environment: auditOnly }));
  await assert.rejects(() => runFullSystemHarmonyAudit({ mode: "deploy", environment: auditOnly }));
});
