import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  controlledRehearsalIntelligenceSuccessor,
  fullSystemHarmonyIntelligenceSuccessor,
  fullSystemHarmonyShadowReadinessSuccessor,
  liveCanonicalIdentityIntelligenceSuccessor,
  validateControlledRehearsalIntelligenceSuccessor,
  validateFullSystemHarmonyIntelligenceSuccessor,
  validateFullSystemHarmonyShadowReadinessSuccessor,
  validateLiveCanonicalIdentityIntelligenceSuccessor,
  validateControlledRehearsalGovernance,
  validateControlledRehearsalReport,
  verifyOverwatchControlledPaidCustomerOnboardingRehearsalV1
} from "../scripts/verify-overwatch-controlled-paid-customer-onboarding-rehearsal-v1.mjs";

const root = new URL("../", import.meta.url);
const readJson = path => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const governance = readJson(
  "overwatch/governance/controlled-paid-customer-onboarding-rehearsal-v1.json"
);
const report = readJson(
  "overwatch/reports/BATCH-20260730-002-controlled-paid-customer-onboarding-rehearsal-v1.json"
);
const clone = value => structuredClone(value);

test("Overwatch accepts only the exact Intelligence revenue-readiness successor", () => {
  assert.equal(
    validateControlledRehearsalIntelligenceSuccessor(
      controlledRehearsalIntelligenceSuccessor
    ).commit,
    "c025fd95a8f5141dc4c32af3ca83292711fb1df7"
  );
  for (const mutate of [
    value => { value.commit = "0".repeat(40); },
    value => { value.parent = "0".repeat(40); },
    value => { value.tree = "0".repeat(40); },
    value => { value.identity = "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.subject = "intelligence: substitute successor"; },
    value => { value.evidence[0].path = "package.json"; },
    value => { value.evidence[1].sha256 = "0".repeat(64); },
    value => { value.evidence.pop(); }
  ]) {
    const candidate = clone(controlledRehearsalIntelligenceSuccessor);
    mutate(candidate);
    assert.throws(() => validateControlledRehearsalIntelligenceSuccessor(candidate));
  }
});

test("Overwatch accepts only the exact Full-System Harmony Intelligence successor", () => {
  assert.equal(
    validateFullSystemHarmonyIntelligenceSuccessor(
      fullSystemHarmonyIntelligenceSuccessor
    ).commit,
    "2f8992476ca37276b0ee388fe2e33a2158f9d906"
  );
  for (const mutate of [
    value => { value.commit = "0".repeat(40); },
    value => { value.parent = "0".repeat(40); },
    value => { value.tree = "0".repeat(40); },
    value => { value.identity = "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.subject = "intelligence: substitute harmony successor"; },
    value => { value.evidence[0].path = "package.json"; },
    value => { value.evidence[1].sha256 = "0".repeat(64); },
    value => { value.evidence.pop(); }
  ]) {
    const candidate = clone(fullSystemHarmonyIntelligenceSuccessor);
    mutate(candidate);
    assert.throws(() => validateFullSystemHarmonyIntelligenceSuccessor(candidate));
  }
});

test("Overwatch accepts only the exact live canonical identity Intelligence successor", () => {
  assert.equal(
    validateLiveCanonicalIdentityIntelligenceSuccessor(
      liveCanonicalIdentityIntelligenceSuccessor
    ).commit,
    "56f67124c1beba2f9289538d65e782cd808eacb2"
  );
  for (const mutate of [
    value => { value.commit = "0".repeat(40); },
    value => { value.parent = "0".repeat(40); },
    value => { value.tree = "0".repeat(40); },
    value => { value.identity = "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.subject = "intelligence: substitute canonical successor"; },
    value => { value.evidence[0].path = "package.json"; },
    value => { value.evidence[1].sha256 = "0".repeat(64); },
    value => { value.evidence.pop(); }
  ]) {
    const candidate = clone(liveCanonicalIdentityIntelligenceSuccessor);
    mutate(candidate);
    assert.throws(() =>
      validateLiveCanonicalIdentityIntelligenceSuccessor(candidate));
  }
});

test("Overwatch accepts only the exact harmony shadow-readiness successor", () => {
  assert.equal(
    validateFullSystemHarmonyShadowReadinessSuccessor(
      fullSystemHarmonyShadowReadinessSuccessor
    ).commit,
    "029ef1254aa41b6ba129424e9b3deaf3afe6a2f8"
  );
  for (const mutate of [
    value => { value.commit = "0".repeat(40); },
    value => { value.parent = "0".repeat(40); },
    value => { value.tree = "0".repeat(40); },
    value => { value.identity = "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.subject = "intelligence: substitute shadow successor"; },
    value => { value.evidence[0].path = "package.json"; },
    value => { value.evidence[0].sha256 = "0".repeat(64); },
    value => { value.evidence.pop(); }
  ]) {
    const candidate = clone(fullSystemHarmonyShadowReadinessSuccessor);
    mutate(candidate);
    assert.throws(() =>
      validateFullSystemHarmonyShadowReadinessSuccessor(candidate));
  }
});

test("Overwatch independently accepts the controlled rehearsal owner chain", async () => {
  const result = await verifyOverwatchControlledPaidCustomerOnboardingRehearsalV1();
  assert.equal(result.status,
    "CONTROLLED_PAID_CUSTOMER_ONBOARDING_REHEARSAL_OVERWATCH_PASS");
  assert.equal(result.ownerCommitCount, 7);
  assert.equal(result.fictionalCompanyCount, 1);
  assert.equal(result.locationCount, 2);
  assert.equal(result.representativeCount, 2);
  assert.equal(result.privateWorkerBaseline, "5a636567-4268-4179-8015-12a12557d286");
  assert.equal(result.publicWorkerBaseline, "6a8713c0-0712-4cda-8a13-daa893ca45f2");
});

test("governance rejects owner, commit, tree, hash, and path substitution", () => {
  for (const mutate of [
    value => { value.ownership.implementationOwners[0] = "Prometheus Overwatch"; },
    value => { value.ownership.overwatchModifiedSubsystemImplementation = true; },
    value => { value.ownership.ownerCommits[0].commit = "0".repeat(40); },
    value => { value.ownership.ownerCommits[1].parent = "0".repeat(40); },
    value => { value.ownership.ownerCommits[2].tree = "0".repeat(40); },
    value => { value.ownership.ownerCommits[3].identity =
      "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.ownership.ownerCommits[2].evidence[0].sha256 = "0".repeat(64); },
    value => { value.ownership.ownerCommits[3].evidence[0].path = "package.json"; },
    value => { value.ownership.ownerCommits[4].identity =
      "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.ownership.ownerCommits[4].evidence[0].sha256 =
      "0".repeat(64); },
    value => { value.ownership.ownerCommits[5].identity =
      "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.ownership.ownerCommits[5].evidence[0].sha256 =
      "0".repeat(64); }
  ]) {
    const candidate = clone(governance);
    mutate(candidate);
    assert.throws(() => validateControlledRehearsalGovernance(candidate));
  }
});

test("governance rejects real-data and fictional-identity drift", () => {
  for (const mutate of [
    value => { value.fictionalScope.classification = "REAL_CUSTOMER"; },
    value => { value.fictionalScope.companyId = "fitness_connection"; },
    value => { value.fictionalScope.locationIds.pop(); },
    value => { value.fictionalScope.representativePrincipalIds.pop(); },
    value => { value.fictionalScope.realCustomerDataAllowed = true; },
    value => { value.fictionalScope.existingCrmDataAllowed = true; }
  ]) {
    const candidate = clone(governance);
    mutate(candidate);
    assert.throws(() => validateControlledRehearsalGovernance(candidate));
  }
});

test("governance rejects lifecycle, authorization, hours, and cleanup weakening", () => {
  for (const mutate of [
    value => { value.requiredEvidence.draftCreated = false; },
    value => { value.requiredEvidence.controlledValidationFailurePreserved = false; },
    value => { value.requiredEvidence.finalLifecycleState = "ACTIVE"; },
    value => { value.requiredEvidence.activationImpliedByValidation = true; },
    value => {
      value.requiredEvidence.representativeFounderBillingGovernanceAccessAllowed = true;
    },
    value => { value.requiredEvidence.operatingHoursFailClosedRequired = false; },
    value => { value.requiredEvidence.cleanupStatus = "PRESERVED"; },
    value => { value.requiredEvidence.remainingRehearsalRecords = 1; }
  ]) {
    const candidate = clone(governance);
    mutate(candidate);
    assert.throws(() => validateControlledRehearsalGovernance(candidate));
  }
});

test("governance rejects billing, activation, invitation, provider, and intelligence activation", () => {
  for (const mutate of [
    value => { value.requiredEvidence.billingMode = "LIVE"; },
    value => { value.requiredEvidence.billingActivation = "ACTIVE"; },
    value => { value.requiredEvidence.customerActivation = "ON"; },
    value => { value.requiredEvidence.invitationDelivery = "ON"; },
    value => { value.requiredEvidence.providerRefresh = "ON"; },
    value => { value.requiredEvidence.scheduler = "ON"; },
    value => { value.requiredEvidence.collection = "ON"; },
    value => { value.requiredEvidence.activeCohorts = 1; },
    value => { value.requiredEvidence.recommendationInfluence = "ON"; }
  ]) {
    const candidate = clone(governance);
    mutate(candidate);
    assert.throws(() => validateControlledRehearsalGovernance(candidate));
  }
});

test("governance rejects deployment, rebuild, public mutation, and rollback acceptance", () => {
  for (const mutate of [
    value => { value.releaseBoundary.workflowTrigger = "push"; },
    value => { value.releaseBoundary.workflowDispatched = true; },
    value => { value.releaseBoundary.deploymentPerformed = true; },
    value => { value.releaseBoundary.cloudflareContacted = true; },
    value => { value.releaseBoundary.secretValuesAccessed = true; },
    value => { value.releaseBoundary.sourceBuildCount = 2; },
    value => { value.releaseBoundary.deploymentRebuildAllowed = true; },
    value => { value.releaseBoundary.publicWorkerMutationAllowed = true; },
    value => { value.releaseBoundary.pairedForwardRollbackRequired = false; },
    value => { value.releaseBoundary.rollbackMayCountAsAcceptance = true; }
  ]) {
    const candidate = clone(governance);
    mutate(candidate);
    assert.throws(() => validateControlledRehearsalGovernance(candidate));
  }
});

test("governance rejects every protected-state mutation", () => {
  for (const mutate of [
    value => { value.protectedState.collection = "ON"; },
    value => { value.protectedState.activeCohorts = 1; },
    value => { value.protectedState.recommendationInfluence = "ON"; },
    value => { value.protectedState.providerRefresh = "ON"; },
    value => { value.protectedState.scheduler = "ON"; },
    value => { value.protectedState.customerActivation = "ON"; },
    value => { value.protectedState.anthonyMapped = true; },
    value => { value.protectedState.activeBusinesses = 1; },
    value => { value.protectedState.reserveBusinesses = 1; },
    value => { value.protectedState.quarantinedBusinesses = 397; },
    value => { value.protectedState.crmReceipt = "changed"; },
    value => { value.protectedState.crmMutationAllowed = true; },
    value => { value.protectedState.publicWorkerMutationAllowed = true; }
  ]) {
    const candidate = clone(governance);
    mutate(candidate);
    assert.throws(() => validateControlledRehearsalGovernance(candidate));
  }
});

test("report cannot overstate external action or source acceptance", () => {
  for (const mutate of [
    value => { value.status = "DEPLOYED"; },
    value => { value.sourceDetermination.draftToValidated = "FAIL"; },
    value => { value.sourceDetermination.tenantIsolation = "FAIL"; },
    value => { value.sourceDetermination.cleanupRemoval = "FAIL"; },
    value => { value.externalAction.workflowDispatched = true; },
    value => { value.externalAction.workerDeployed = true; },
    value => { value.externalAction.productionMutation = true; },
    value => { value.externalAction.crmReadOrWrite = true; },
    value => { value.externalAction.secretValueAccess = true; },
    value => { value.externalAction.cloudflareContact = true; }
  ]) {
    const candidate = clone(report);
    mutate(candidate);
    assert.throws(() => validateControlledRehearsalReport(candidate));
  }
});
