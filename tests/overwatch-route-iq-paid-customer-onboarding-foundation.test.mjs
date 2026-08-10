import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  validateActiveToolchainPublicLaneSuccessor,
  validateGovernedPublicLaneSuccessor,
  validatePaidCustomerProductionGateLedger,
  validatePrivateWorkerLineage,
  verifyOverwatchRouteIqPaidCustomerOnboardingFoundation
} from "../scripts/verify-overwatch-route-iq-paid-customer-onboarding-foundation.mjs";

const root = new URL("../", import.meta.url);
const readJson = path => JSON.parse(fs.readFileSync(new URL(path, root), "utf8"));
const clone = value => structuredClone(value);

test("Overwatch independently accepts the owner-separated paid-customer foundation", () => {
  const result = verifyOverwatchRouteIqPaidCustomerOnboardingFoundation();
  assert.equal(result.status, "PASS");
  assert.equal(result.ownerCommitCount, 14);
  assert.equal(result.gateCount, 17);
  assert.equal(result.syntheticCompanyCount, 2);
  assert.equal(result.privateWorkerBaseline, "16e40509-0173-4712-9138-0393a2ae1924");
  assert.equal(result.publicWorkerBaseline, "6a8713c0-0712-4cda-8a13-daa893ca45f2");
  assert.equal(result.finalBaselineRollbackOccurred, false);
  assert.equal(result.protectedOperatingState.collection, "OFF");
  assert.equal(result.protectedOperatingState.activeCohorts, 0);
  assert.equal(result.protectedOperatingState.recommendationInfluence, "OFF");
});

test("historical public-lane guard admits only the exact governed identity successor", () => {
  const governance = readJson(
    "overwatch/governance/live-canonical-identity-migration-v1.json"
  );
  const reconciliation = governance.historicalVerifierReconciliations
    .paidCustomerOnboardingFoundation;
  assert.equal(validateGovernedPublicLaneSuccessor({
    governance,
    baselineCommit: reconciliation.baselineCommit,
    changedPaths: reconciliation.changedPaths
  }), reconciliation);

  assert.throws(() => validateGovernedPublicLaneSuccessor({
    governance,
    baselineCommit: reconciliation.baselineCommit,
    changedPaths: [...reconciliation.changedPaths, "src/unapproved-public-change.js"]
  }));

  const weakened = clone(governance);
  weakened.historicalVerifierReconciliations
    .paidCustomerOnboardingFoundation.routesBindingsAndSchemaUnchanged = false;
  assert.throws(() => validateGovernedPublicLaneSuccessor({
    governance: weakened,
    baselineCommit: reconciliation.baselineCommit,
    changedPaths: reconciliation.changedPaths
  }));
});

test("paid-customer public-lane guard composes only the exact active Wrangler successor", () => {
  const governance = readJson(
    "overwatch/governance/route-iq-wrangler-miniflare-major-transition-requalification-v1.json"
  );
  const path = "workers/infrastructure/github-actions-public-worker-deployment-v2.json";
  assert.equal(validateActiveToolchainPublicLaneSuccessor({
    governance,
    additionalChangedPaths: [path]
  }), governance.activeDeploymentPolicySuccessor);

  const wrongCommit = clone(governance);
  wrongCommit.activeDeploymentPolicySuccessor.infrastructureCommit = "0".repeat(40);
  assert.throws(() => validateActiveToolchainPublicLaneSuccessor({
    governance: wrongCommit,
    additionalChangedPaths: [path]
  }));
  assert.throws(() => validateActiveToolchainPublicLaneSuccessor({
    governance,
    additionalChangedPaths: [path, "src/unapproved-public-change.js"]
  }));
});

test("paid-customer ledger rejects percentage inflation and documentation-only readiness", () => {
  const ledger = readJson(
    "overwatch/governance/route-iq-paid-customer-production-gate-ledger-v1.json"
  );

  const percentage = clone(ledger);
  percentage.percentageReadinessAllowed = true;
  assert.throws(() => validatePaidCustomerProductionGateLedger(percentage));

  const documentation = clone(ledger);
  documentation.evidenceRules.documentationAloneCanPassGate = true;
  assert.throws(() => validatePaidCustomerProductionGateLedger(documentation));

  const providerInflation = clone(ledger);
  providerInflation.gates.find(gate =>
    gate.gateId === "verified_business_acquisition").status = "PRODUCTION_OPERATIONAL";
  assert.throws(() => validatePaidCustomerProductionGateLedger(providerInflation));
});

test("paid-customer ledger rejects missing gates and protected-state activation", () => {
  const ledger = readJson(
    "overwatch/governance/route-iq-paid-customer-production-gate-ledger-v1.json"
  );

  const missingGate = clone(ledger);
  missingGate.gates.pop();
  assert.throws(() => validatePaidCustomerProductionGateLedger(missingGate));

  for (const mutation of [
    value => { value.protectedOperatingState.collection = "ON"; },
    value => { value.protectedOperatingState.activeCohorts = 1; },
    value => { value.protectedOperatingState.recommendationInfluence = "ON"; },
    value => { value.protectedOperatingState.businessPools.quarantine = 397; },
    value => { value.protectedOperatingState.crmReceiptMutationAuthorized = true; }
  ]) {
    const candidate = clone(ledger);
    mutation(candidate);
    assert.throws(() => validatePaidCustomerProductionGateLedger(candidate));
  }
});

test("private Worker lineage rejects aliases and false final rollback reporting", () => {
  const lineage = readJson(
    "overwatch/governance/route-iq-private-worker-lineage-reconciliation-v1.json"
  );

  const missingIntermediate = clone(lineage);
  missingIntermediate.lineage.splice(8, 1);
  assert.throws(() => validatePrivateWorkerLineage(missingIntermediate));

  const alias = clone(lineage);
  alias.reconciliation.meaningOf4147db04 = "This was an alias.";
  assert.throws(() => validatePrivateWorkerLineage(alias));

  const falseRollback = clone(lineage);
  falseRollback.reconciliation.finalDeploymentRollbackOccurred = true;
  assert.throws(() => validatePrivateWorkerLineage(falseRollback));
});
