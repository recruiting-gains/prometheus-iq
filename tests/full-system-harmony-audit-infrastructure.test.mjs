import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  FULL_SYSTEM_HARMONY_AUDIT_POLICY,
  runFullSystemHarmonyAudit,
  validateFullSystemHarmonyAuditContext
} from "../scripts/run-full-system-harmony-audit-v1.mjs";
import {
  verifyFullSystemHarmonyAuditV1,
  verifyFullSystemHarmonyWorkflowText
} from "../scripts/verify-full-system-harmony-audit-v1.mjs";

const root = resolve(import.meta.dirname, "..");

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

test("artifact-sensitive jobs fail closed without the exact governed runner identity", () => {
  const workflow = readFileSync(
    resolve(root, ".github/workflows/full-system-harmony-audit-v1.yml"),
    "utf8"
  );
  const contract = JSON.parse(readFileSync(
    resolve(root, "workers/infrastructure/full-system-harmony-audit-v1.json"),
    "utf8"
  ));
  for (const job of contract.runtimeIdentity.requiredJobs) {
    const start = workflow.indexOf(`  ${job}:\n`);
    const steps = workflow.indexOf("    steps:\n", start);
    const jobConfiguration = workflow.slice(start, steps);
    const mutated = workflow.slice(0, start) +
      jobConfiguration.replace("      PROMETHEUS_RUNNER_IMAGE: ubuntu-24.04\n", "") +
      workflow.slice(steps);
    assert.throws(
      () => verifyFullSystemHarmonyWorkflowText(mutated, contract),
      new RegExp(`${job} exact governed runner identity`, "u")
    );
  }
});

test("artifact-sensitive jobs reject detached candidate checkout", () => {
  const workflow = readFileSync(
    resolve(root, ".github/workflows/full-system-harmony-audit-v1.yml"),
    "utf8"
  );
  const contract = JSON.parse(readFileSync(
    resolve(root, "workers/infrastructure/full-system-harmony-audit-v1.json"),
    "utf8"
  ));
  for (const [index, job] of contract.runtimeIdentity.requiredJobs.entries()) {
    const start = workflow.indexOf(`  ${job}:\n`);
    const nextJob = contract.runtimeIdentity.requiredJobs[index + 1];
    const end = nextJob ? workflow.indexOf(`  ${nextJob}:\n`, start) : workflow.length;
    const jobText = workflow.slice(start, end);
    const mutated = workflow.slice(0, start) +
      jobText.replace("          ref: main\n", "          ref: ${{ inputs.candidate_commit }}\n") +
      workflow.slice(end);
    assert.throws(
      () => verifyFullSystemHarmonyWorkflowText(mutated, contract),
      new RegExp(`${job} exact synchronized main checkout`, "u")
    );
  }
});

test("protected credentials exist only in the single deployment step", () => {
  const workflow = readFileSync(
    resolve(root, ".github/workflows/full-system-harmony-audit-v1.yml"),
    "utf8"
  );
  const contract = JSON.parse(readFileSync(
    resolve(root, "workers/infrastructure/full-system-harmony-audit-v1.json"),
    "utf8"
  ));
  const deployStart = workflow.indexOf("  deploy:\n");
  const deploySteps = workflow.indexOf("    steps:\n", deployStart);
  const jobScoped = workflow.slice(0, deploySteps) +
    "      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}\n" +
    workflow.slice(deploySteps);
  assert.throws(
    () => verifyFullSystemHarmonyWorkflowText(jobScoped, contract),
    /deploy job-level secret scope prohibited/u
  );

  const deployJob = workflow.slice(deployStart);
  const deployStepStart = deployJob.indexOf(
    "      - name: Deploy through the governed private v2 lane\n"
  );
  for (const name of contract.runtimeIdentity.protectedDeploymentSecretNames) {
    const binding = `          ${name}: \${{ secrets.${name} }}\n`;
    const absoluteDeployStep = deployStart + deployStepStart;
    const withoutDeployBinding = workflow.slice(0, absoluteDeployStep) +
      workflow.slice(absoluteDeployStep).replace(binding, "");
    const misplaced = withoutDeployBinding.slice(0, absoluteDeployStep) + binding +
      withoutDeployBinding.slice(absoluteDeployStep);
    assert.throws(
      () => verifyFullSystemHarmonyWorkflowText(misplaced, contract),
      /artifact reverification secret scope prohibited/u
    );
  }
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
