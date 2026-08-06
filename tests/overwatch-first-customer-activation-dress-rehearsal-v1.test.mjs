import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const governance = JSON.parse(readFileSync(new URL(
  "../overwatch/governance/first-customer-activation-dress-rehearsal-v1.json",
  import.meta.url
), "utf8"));
const workflow = readFileSync(new URL(
  "../.github/workflows/first-customer-activation-dress-rehearsal-v1.yml",
  import.meta.url
), "utf8");
const verifier = readFileSync(new URL(
  "../scripts/verify-first-customer-activation-dress-rehearsal-v1.mjs",
  import.meta.url
), "utf8");

test("dress rehearsal remains synthetic, non-activating, and preserves the immutable receipt", () => {
  assert.equal(governance.crmReceipt, "riq_receipt_e74e57903a211291a9f1f37a");
  assert.equal(governance.qualificationScope.deploymentAuthorized, false);
  assert.equal(governance.protectedState.collection, "OFF");
  assert.equal(governance.protectedState.activeCohorts, 0);
  assert.equal(governance.protectedState.recommendationInfluence, "OFF");
  assert.equal(governance.protectedState.productionCrmWrites, 0);
  assert.equal(governance.protectedState.productionCustomerWrites, 0);
  assert.equal(governance.protectedState.stripeMode, "NOT_LIVE");
});

test("hosted workflow is exact-main manual qualification with no production mutation route", () => {
  assert.match(workflow, /^on:\n  workflow_dispatch:/mu);
  assert.doesNotMatch(workflow, /^  push:/mu);
  assert.match(workflow, /github\.sha == inputs\.candidate_commit/u);
  assert.match(workflow, /git rev-parse HEAD\^\{tree\}/u);
  assert.match(workflow, /PROMETHEUS_REHEARSAL_EVIDENCE_OUTPUT/u);
  assert.doesNotMatch(workflow, /wrangler deploy|workflow_call|repository_dispatch/u);
  assert.doesNotMatch(workflow, /CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID/u);
});

test("verifier joins the required accepted subsystem tests and records no production submission", () => {
  for (const required of [
    "route-iq-request-crm-infrastructure.test.mjs",
    "controlled-paid-customer-onboarding-rehearsal-v1.test.mjs",
    "route-iq-paid-customer-security-v1.test.mjs",
    "route-business-hours-eligibility.test.mjs",
    "continuous-adaptive-route-replenishment.test.mjs",
    "crm-foundation.test.mjs",
    "full-system-harmony-cross-subsystem.test.mjs"
  ]) assert.match(verifier, new RegExp(required.replaceAll(".", "\\."), "u"));
  assert.match(verifier, /productionSubmissionPerformed: false/u);
  assert.match(verifier, /productionMutationPerformed: false/u);
});
