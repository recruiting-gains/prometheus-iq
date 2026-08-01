import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  augustReadinessHarmonySuccessorRepair,
  crmResearchBoundaryValidatorSuccessor,
  crmResearchPersistenceTypecheckRepair,
  currentHarmonySuccessorCompositionRepair,
  dashboardFounderReadinessSuccessor,
  harmonyArtifactToolchainRepair,
  intelligenceProtectedConsumerSuccessor,
  intelligenceProtectedDriftFixtureSuccessor,
  validateCrmResearchBoundaryValidatorSuccessor,
  validateCrmResearchPersistenceTypecheckRepair,
  validateAugustReadinessHarmonySuccessorRepair,
  validateCurrentHarmonySuccessorCompositionRepair,
  validateDashboardFounderReadinessSuccessor,
  validateHarmonyArtifactToolchainRepair,
  validateIntelligenceProtectedConsumerSuccessor,
  validateIntelligenceProtectedDriftFixtureSuccessor,
  verifyOverwatchFullSystemHarmonyAudit
} from "../scripts/verify-overwatch-full-system-harmony-audit-v1.mjs";

const governance = JSON.parse(readFileSync(
  new URL("../overwatch/governance/full-system-harmony-audit-v1.json", import.meta.url),
  "utf8"
));
const report = JSON.parse(readFileSync(
  new URL(
    "../overwatch/reports/BATCH-20260731-002-full-system-harmony-audit-v1.json",
    import.meta.url
  ),
  "utf8"
));

test("Overwatch accepts only the exact owner chain and harmony boundary", () => {
  const result = verifyOverwatchFullSystemHarmonyAudit({ governance, report });
  assert.deepEqual(result, {
    status: "OVERWATCH_FULL_SYSTEM_HARMONY_AUDIT_V1_VERIFIED",
    ownerCommitCount: 48,
    subsystemCount: 20,
    contractCount: 19,
    decision: "CONDITIONAL_GO"
  });
});

test("Infrastructure harmony artifact toolchain repair is exact and owner-produced", () => {
  assert.equal(
    validateHarmonyArtifactToolchainRepair().commit,
    harmonyArtifactToolchainRepair.commit
  );
  for (const mutate of [
    value => { value.commit = "0".repeat(40); },
    value => { value.parent = "0".repeat(40); },
    value => { value.tree = "0".repeat(40); },
    value => { value.identity = "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.subject = "infrastructure: substitute harmony toolchain"; },
    value => { value.evidence[0].path = "package.json"; },
    value => { value.evidence[0].sha256 = "0".repeat(64); },
    value => { value.evidence.pop(); }
  ]) {
    const candidate = structuredClone(harmonyArtifactToolchainRepair);
    mutate(candidate);
    assert.throws(() => validateHarmonyArtifactToolchainRepair(candidate));
  }
});

test("CRM research-persistence typecheck repair is exact and CRM-owned", () => {
  assert.equal(
    validateCrmResearchPersistenceTypecheckRepair().commit,
    crmResearchPersistenceTypecheckRepair.commit
  );
  for (const mutate of [
    value => { value.commit = "0".repeat(40); },
    value => { value.parent = "0".repeat(40); },
    value => { value.tree = "0".repeat(40); },
    value => { value.identity = "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.subject = "crm: substitute research typecheck"; },
    value => { value.evidence[0].path = "package.json"; },
    value => { value.evidence[0].sha256 = "0".repeat(64); },
    value => { value.evidence.pop(); }
  ]) {
    const candidate = structuredClone(crmResearchPersistenceTypecheckRepair);
    mutate(candidate);
    assert.throws(() => validateCrmResearchPersistenceTypecheckRepair(candidate));
  }
});

test("August readiness harmony successor is exact and Overwatch-owned", () => {
  assert.equal(
    validateAugustReadinessHarmonySuccessorRepair().commit,
    augustReadinessHarmonySuccessorRepair.commit
  );
  for (const mutate of [
    value => { value.commit = "0".repeat(40); },
    value => { value.parent = "0".repeat(40); },
    value => { value.tree = "0".repeat(40); },
    value => { value.identity = "Prometheus Infrastructure <infrastructure@prometheus.local>"; },
    value => { value.subject = "overwatch: substitute August successor"; },
    value => { value.evidence[0].path = "package.json"; },
    value => { value.evidence[0].sha256 = "0".repeat(64); },
    value => { value.evidence.pop(); }
  ]) {
    const candidate = structuredClone(augustReadinessHarmonySuccessorRepair);
    mutate(candidate);
    assert.throws(() => validateAugustReadinessHarmonySuccessorRepair(candidate));
  }
});

test("current harmony successor composition is exact and Overwatch-owned", () => {
  assert.equal(
    validateCurrentHarmonySuccessorCompositionRepair().commit,
    currentHarmonySuccessorCompositionRepair.commit
  );
  for (const mutate of [
    value => { value.commit = "0".repeat(40); },
    value => { value.parent = "0".repeat(40); },
    value => { value.tree = "0".repeat(40); },
    value => { value.identity = "Prometheus Intelligence Engine <intelligence@prometheus.local>"; },
    value => { value.subject = "overwatch: substitute harmony successors"; },
    value => { value.evidence[0].path = "package.json"; },
    value => { value.evidence[0].sha256 = "0".repeat(64); },
    value => { value.evidence.pop(); }
  ]) {
    const candidate = structuredClone(currentHarmonySuccessorCompositionRepair);
    mutate(candidate);
    assert.throws(() => validateCurrentHarmonySuccessorCompositionRepair(candidate));
  }
});

test("Intelligence protected-drift fixture repair is exact and owner-produced", () => {
  assert.equal(
    validateIntelligenceProtectedDriftFixtureSuccessor().commit,
    intelligenceProtectedDriftFixtureSuccessor.commit
  );
  for (const mutate of [
    value => { value.commit = "0".repeat(40); },
    value => { value.parent = "0".repeat(40); },
    value => { value.tree = "0".repeat(40); },
    value => { value.identity = "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.subject = "intelligence: substitute protected drift fixture"; },
    value => { value.evidence[0].path = "package.json"; },
    value => { value.evidence[0].sha256 = "0".repeat(64); },
    value => { value.evidence.pop(); }
  ]) {
    const candidate = structuredClone(intelligenceProtectedDriftFixtureSuccessor);
    mutate(candidate);
    assert.throws(() => validateIntelligenceProtectedDriftFixtureSuccessor(candidate));
  }
});

test("Intelligence protected-consumer repair is exact and owner-produced", () => {
  assert.equal(
    validateIntelligenceProtectedConsumerSuccessor().commit,
    intelligenceProtectedConsumerSuccessor.commit
  );
  for (const mutate of [
    value => { value.commit = "0".repeat(40); },
    value => { value.parent = "0".repeat(40); },
    value => { value.tree = "0".repeat(40); },
    value => { value.identity = "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.subject = "intelligence: substitute protected consumers"; },
    value => { value.evidence[0].path = "package.json"; },
    value => { value.evidence[0].sha256 = "0".repeat(64); },
    value => { value.evidence.pop(); }
  ]) {
    const candidate = structuredClone(intelligenceProtectedConsumerSuccessor);
    mutate(candidate);
    assert.throws(() => validateIntelligenceProtectedConsumerSuccessor(candidate));
  }
});

test("CRM research-boundary validator repair is exact and owner-produced", () => {
  assert.equal(
    validateCrmResearchBoundaryValidatorSuccessor().commit,
    crmResearchBoundaryValidatorSuccessor.commit
  );
  for (const mutate of [
    value => { value.commit = "0".repeat(40); },
    value => { value.parent = "0".repeat(40); },
    value => { value.tree = "0".repeat(40); },
    value => { value.identity = "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.subject = "crm: substitute research boundary"; },
    value => { value.evidence[0].path = "package.json"; },
    value => { value.evidence[0].sha256 = "0".repeat(64); },
    value => { value.evidence.pop(); }
  ]) {
    const candidate = structuredClone(crmResearchBoundaryValidatorSuccessor);
    mutate(candidate);
    assert.throws(() => validateCrmResearchBoundaryValidatorSuccessor(candidate));
  }
});

test("Dashboard Founder-readiness repair is exact and owner-produced", () => {
  assert.equal(
    validateDashboardFounderReadinessSuccessor().commit,
    dashboardFounderReadinessSuccessor.commit
  );
  for (const mutate of [
    value => { value.commit = "0".repeat(40); },
    value => { value.parent = "0".repeat(40); },
    value => { value.tree = "0".repeat(40); },
    value => { value.identity = "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.subject = "dashboard: substitute readiness repair"; },
    value => { value.evidence[0].path = "package.json"; },
    value => { value.evidence[0].sha256 = "0".repeat(64); },
    value => { value.evidence.pop(); }
  ]) {
    const candidate = structuredClone(dashboardFounderReadinessSuccessor);
    mutate(candidate);
    assert.throws(() => validateDashboardFounderReadinessSuccessor(candidate));
  }
});

test("P0 and P1 remain empty while external commercial prerequisites stay explicit", () => {
  assert.deepEqual(governance.defectLedger.p0, []);
  assert.deepEqual(governance.defectLedger.p1, []);
  assert.ok(governance.defectLedger.p2.length > 0);
  assert.ok(report.externalPrerequisites.includes("EIN"));
  assert.ok(report.externalPrerequisites.includes("Stripe account and Live Mode authorization"));
  assert.equal(report.releaseBoundary.liveBillingAllowed, false);
});

test("every material subsystem declares authority, containment, audit, and recovery", () => {
  assert.equal(governance.subsystems.length, 20);
  for (const subsystem of governance.subsystems) {
    assert.ok(subsystem.authority);
    assert.ok(subsystem.failure);
    assert.ok(subsystem.audit);
    assert.ok(subsystem.recovery);
    assert.ok(subsystem.tenantBoundary);
  }
});

test("all cross-subsystem contracts are explicit and passing", () => {
  assert.equal(governance.contractMatrix.length, 19);
  assert.equal(
    governance.contractMatrix.every(item => item.result.startsWith("PASS")),
    true
  );
  assert.ok(governance.contractMatrix.some(item =>
    item.from === "billing_state" && item.to === "activation_gate"
  ));
  assert.ok(governance.contractMatrix.some(item =>
    item.from === "rollback_artifact" && item.to === "restored_state"
  ));
});

test("protected state forbids production writes, live billing, and public mutation", () => {
  assert.equal(governance.protectedState.productionCustomerWrites, 0);
  assert.equal(governance.protectedState.productionCrmWrites, 0);
  assert.equal(governance.protectedState.productionReceiptMutations, 0);
  assert.equal(governance.protectedState.liveModeObjectsCreated, 0);
  assert.equal(governance.protectedState.charges, 0);
  assert.equal(governance.protectedState.publicWorkerMutationAllowed, false);
  assert.equal(governance.protectedState.secretExposure, false);
});
