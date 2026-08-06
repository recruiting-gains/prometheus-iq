#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const outputPath = process.env.PROMETHEUS_REHEARSAL_EVIDENCE_OUTPUT || "";
const groups = Object.freeze([
  ["public_lead", [
    "tests/route-iq-request-crm-infrastructure.test.mjs",
    "tests/shared-lead-intake-pipeline.test.mjs"
  ]],
  ["onboarding_and_isolation", [
    "tests/controlled-paid-customer-onboarding-rehearsal-v1.test.mjs",
    "tests/route-iq-controlled-paid-customer-onboarding-rehearsal-runtime.test.mjs",
    "tests/route-iq-paid-customer-security-v1.test.mjs"
  ]],
  ["first_advisory_route", [
    "tests/dashboard-cross-industry-platform.test.mjs",
    "tests/route-business-hours-eligibility.test.mjs",
    "tests/continuous-adaptive-route-replenishment.test.mjs"
  ]],
  ["visit_follow_up_and_recovery", [
    "tests/crm-foundation.test.mjs",
    "tests/route-iq-paid-customer-crm-workflow.test.mjs",
    "tests/full-system-harmony-cross-subsystem.test.mjs"
  ]]
]);

function run(command, args) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    throw new Error(`first_customer_rehearsal_${args.at(-1)?.replace(/\W+/gu, "_") || "command"}_failed`);
  }
  const testCount = [...String(result.stdout).matchAll(/^ℹ tests (\d+)$/gmu)]
    .reduce((total, match) => total + Number(match[1]), 0);
  return Object.freeze({ durationMs: Date.now() - startedAt, testCount });
}

function git(...args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error("first_customer_rehearsal_git_identity_failed");
  return result.stdout.trim();
}

const commit = git("rev-parse", "HEAD");
const tree = git("rev-parse", "HEAD^{tree}");
const branch = git("branch", "--show-current");
if (branch !== "main" || git("status", "--porcelain=v1", "--untracked-files=all") !== "") {
  throw new Error("first_customer_rehearsal_repository_not_clean_main");
}
if (git("rev-list", "--left-right", "--count", "HEAD...origin/main") !== "0\t0") {
  throw new Error("first_customer_rehearsal_repository_not_synchronized");
}

const governance = JSON.parse(readFileSync(resolve(
  root,
  "overwatch/governance/first-customer-activation-dress-rehearsal-v1.json"
), "utf8"));
if (governance.protectedState.collection !== "OFF"
  || governance.protectedState.activeCohorts !== 0
  || governance.protectedState.recommendationInfluence !== "OFF"
  || governance.protectedState.providerRefresh !== "OFF"
  || governance.protectedState.scheduler !== "OFF"
  || governance.protectedState.customerActivation !== "OFF"
  || governance.protectedState.stripeMode !== "NOT_LIVE"
  || governance.protectedState.productionCrmWrites !== 0
  || governance.protectedState.productionCustomerWrites !== 0) {
  throw new Error("first_customer_rehearsal_protected_state_invalid");
}

const results = {};
for (const [name, files] of groups) results[name] = run(process.execPath, ["--test", ...files]);
const totalTests = Object.values(results).reduce((total, result) => total + result.testCount, 0);
const evidence = {
  evidenceVersion: "first-customer-activation-dress-rehearsal-v1",
  commit,
  tree,
  branch,
  fictionalTenant: "company_orion_facility_safety_rehearsal",
  workspace: "workspace_orion_facility_safety_rehearsal",
  path: [
    "PUBLIC_REQUEST_VALIDATED",
    "DURABLY_ACCEPTED_WITH_UNIQUE_RECEIPT",
    "FOUNDER_RETRIEVAL_AND_EXPORT_AUTHORIZED",
    "DRAFT_VALIDATION_REHEARSED",
    "VALIDATED_NOT_ACTIVATED",
    "ROLES_AND_TENANT_ISOLATION_VERIFIED",
    "FIRST_ADVISORY_ROUTE_VERIFIED",
    "SYNTHETIC_VISIT_AND_FOLLOW_UP_VERIFIED",
    "DEACTIVATION_AND_RECOVERY_VERIFIED"
  ],
  results,
  totalTests,
  notification: {
    productionSubmissionPerformed: false,
    existingReceiptPreserved: governance.crmReceipt,
    mailboxDeliveryObserved: false,
    classification: "EXISTING_RECEIPT_READ_ONLY_RECONCILIATION_REQUIRED"
  },
  protectedState: governance.protectedState,
  productionMutationPerformed: false
};
const canonical = `${JSON.stringify(evidence, null, 2)}\n`;
evidence.evidenceSha256 = createHash("sha256").update(canonical).digest("hex");
const finalOutput = `${JSON.stringify(evidence, null, 2)}\n`;
if (outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, finalOutput, { mode: 0o600 });
}
process.stdout.write(`FIRST_CUSTOMER_ACTIVATION_DRESS_REHEARSAL_VERIFIED ${totalTests}\n`);
