import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  verifyPaidCustomerRevenueReadinessGovernance
} from "../scripts/verify-overwatch-paid-customer-revenue-readiness-v1.mjs";

const readJson = path =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

test("Overwatch accepts the exact owner chain and conditional-go boundary", () => {
  const result = verifyPaidCustomerRevenueReadinessGovernance();
  assert.equal(result.ownerCommitCount, 17);
  assert.equal(result.verdict, "CONDITIONAL_GO");
  assert.equal(result.protectedState.collection, "OFF");
  assert.equal(result.protectedState.activeCohorts, 0);
  assert.equal(result.protectedState.recommendationInfluence, "OFF");
});

test("Overwatch rejects Live billing or customer activation claims", () => {
  const governance = readJson(
    "../overwatch/governance/paid-customer-revenue-readiness-v1.json"
  );
  governance.commercialDecision.liveBilling = "ACTIVE";
  assert.throws(() =>
    verifyPaidCustomerRevenueReadinessGovernance({ governance }));
  governance.commercialDecision.liveBilling = "BLOCKED";
  governance.commercialDecision.customerActivation = "ACTIVE";
  assert.throws(() =>
    verifyPaidCustomerRevenueReadinessGovernance({ governance }));
});

test("Overwatch rejects a false GO verdict", () => {
  const report = readJson(
    "../overwatch/reports/BATCH-20260731-001-paid-customer-revenue-readiness-v1.json"
  );
  report.sourceDetermination.verdict = "GO";
  assert.throws(() =>
    verifyPaidCustomerRevenueReadinessGovernance({ report }));
});
