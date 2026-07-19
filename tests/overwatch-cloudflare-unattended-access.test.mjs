import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  evaluateCloudflareUnattendedAccessGovernance,
  verifyOverwatchCloudflareUnattendedAccess
} from "../scripts/verify-overwatch-cloudflare-unattended-access.mjs";

const root = resolve(import.meta.dirname, "..");
const readJson = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const infrastructure = readJson("workers/infrastructure/cloudflare-unattended-deployment-access-v1.json");
const governance = readJson("overwatch/governance/cloudflare-unattended-deployment-access-v1.json");
const report = readJson("overwatch/reports/BATCH-20260714-006-cloudflare-unattended-runtime-guard.json");
const commercialReadiness = readJson("overwatch/governance/route-iq-commercial-readiness-v1.json");
const clone = value => structuredClone(value);
const evaluate = (infra = infrastructure, gov = governance, batchReport = report) => (
  evaluateCloudflareUnattendedAccessGovernance({
    infrastructure: infra,
    governance: gov,
    report: batchReport
  })
);

test("Overwatch independently verifies the source runtime guard and held deployment boundary", () => {
  const result = verifyOverwatchCloudflareUnattendedAccess();
  assert.equal(result.status, "PASS");
  assert.equal(result.batchId, "BATCH-20260714-006");
  assert.equal(result.implementationOwner, "Prometheus Infrastructure");
  assert.equal(result.verificationOwner, "Prometheus Overwatch");
  assert.deepEqual(result.implementationCommits, [
    "e41e025173d9843de51c6c8e789570e27345a13b",
    "3c8ca61910358c13cc0c05e1fbda5d3052b31a9b"
  ]);
  assert.equal(result.intelligenceRepairCommit, "c05fa818c2ccff98447089287b110c35704ff3a4");
  assert.equal(result.guardStatus, "IMPLEMENTED_SOURCE_NOT_DEPLOYED_NOT_CONFIGURED");
  assert.equal(result.setupStatus, "NOT_CONFIGURED");
  assert.equal(result.repositorySecretFindings, 0);
  assert.equal(result.unattendedDeploymentReady, false);
  assert.equal(result.unattendedSmokeReady, false);
  assert.equal(result.deploymentPerformed, false);
  assert.equal(result.cloudflareAccessPerformed, false);
  assert.equal(result.keychainValueReadPerformed, false);
  assert.equal(result.productionMutationPerformed, false);
  assert.equal(result.prospectiveCollection, "OFF");
  assert.equal(result.recommendationInfluence, "OFF");
  assert.equal(result.deploymentRecommendation, "DO_NOT_DEPLOY");
});

test("paused unattended access accepts only explicit owner-authored commercial successors", () => {
  const subsystemSuccessors = commercialReadiness.protectedBaselineSuccessors
    .filter(entry => entry.owner !== "Prometheus Overwatch");
  assert.equal(subsystemSuccessors.length, 11);
  assert.deepEqual(
    [...new Set(subsystemSuccessors.map(entry => entry.ownerCommit))].sort(),
    [
      "11ac0668b87ed347c22bf963938b8d650370cfdb",
      "7b6e7a3423e1d1cae3068b99cc46bd3be6afb162",
      "82d1e6f23ca3a75c0073c051531477913258a98f",
      "87c95cd0d3a875a486a313759f474cc899a2d53f",
      "88b3bbbf2c34d879881ced98620c15a602598c45",
      "ecc9cbcc0222c627aeef952d2a651f4ba90cc42a"
    ].sort()
  );
  assert.ok(commercialReadiness.protectedBaselineSuccessors.every(entry => (
    /^[a-f0-9]{64}$/u.test(entry.historicalSha256)
    && /^[a-f0-9]{64}$/u.test(entry.successorSha256)
  )));
});

test("Overwatch rejects shared or broader Cloudflare credentials", () => {
  const shared = clone(infrastructure);
  shared.credentialSeparation.sharedCredentialAllowed = true;
  assert.equal(evaluate(shared).ok, false);

  const broader = clone(infrastructure);
  broader.deploymentCredential.permissions.push("Workers KV Storage Edit");
  assert.equal(evaluate(broader).ok, false);

  const allAccounts = clone(infrastructure);
  allAccounts.deploymentCredential.resourceScope.include = "all_accounts";
  assert.equal(evaluate(allAccounts).ok, false);

  const zone = clone(infrastructure);
  zone.deploymentCredential.resourceScope.zoneResourcesGranted = true;
  assert.equal(evaluate(zone).ok, false);

  const anyToken = clone(infrastructure);
  anyToken.smokeCredential.policy.anyServiceTokenAllowed = true;
  assert.equal(evaluate(anyToken).ok, false);
});

test("Overwatch rejects guard broadening or marker-only authorization", () => {
  const method = clone(infrastructure);
  method.servicePrincipalReadOnlyGuard.allowedMethods.push("POST");
  assert.equal(evaluate(method).ok, false);

  const duplicatePath = clone(infrastructure);
  duplicatePath.servicePrincipalReadOnlyGuard.allowedPaths.push("/");
  assert.equal(evaluate(duplicatePath).ok, false);

  const signature = clone(infrastructure);
  signature.servicePrincipalReadOnlyGuard.authentication.signatureRequired = false;
  assert.equal(evaluate(signature).ok, false);

  const markerOnly = clone(infrastructure);
  markerOnly.servicePrincipalReadOnlyGuard.authentication.headerPresenceAloneAccepted = true;
  assert.equal(evaluate(markerOnly).ok, false);

  const configured = clone(infrastructure);
  configured.servicePrincipalReadOnlyGuard.productionConfigured = true;
  assert.equal(evaluate(configured).ok, false);
});

test("Overwatch rejects a flexible or stateful smoke client", () => {
  for (const [field, value] of [
    ["arbitraryUrlAllowed", true],
    ["arbitraryMethodAllowed", true],
    ["requestBodiesAllowed", true],
    ["cookiesAllowed", true],
    ["browserOrServiceWorkerUsed", true],
    ["responseBodiesReadOrPersisted", true],
    ["productionNetworkAccessPerformedByThisBatch", true]
  ]) {
    const mutated = clone(infrastructure);
    mutated.defaultDenySmokeClient[field] = value;
    assert.equal(evaluate(mutated).ok, false, field);
  }

  const redirect = clone(infrastructure);
  redirect.defaultDenySmokeClient.redirectMode = "follow";
  assert.equal(evaluate(redirect).ok, false);
});

test("Overwatch rejects weak, broad, or reusable Founder control", () => {
  for (const [field, value] of [
    ["defaultState", "ON"],
    ["requiredFileMode", "0644"],
    ["regularFileRequired", false],
    ["symlinkAllowed", true],
    ["currentUserOwnershipRequired", false],
    ["strictJsonShapeRequired", false],
    ["exactRepositoryCommitAndTreeRequired", false],
    ["exactDirectiveMatchRequired", false],
    ["oneShot", false],
    ["atomicConsumptionRequired", false],
    ["authorizationNonceReusable", true],
    ["authorizesDeploymentByItself", true]
  ]) {
    const mutated = clone(infrastructure);
    mutated.founderDeploymentControl[field] = value;
    assert.equal(evaluate(mutated).ok, false, field);
  }

  const unbounded = clone(infrastructure);
  unbounded.founderDeploymentControl.maximumLifetimeMinutes = 1440;
  assert.equal(evaluate(unbounded).ok, false);
});

test("Overwatch rejects launcher supply-chain or redaction weakening", () => {
  for (const [field, value] of [
    ["arbitraryCommandAllowed", true],
    ["wranglerIsExactDirectDevDependency", false],
    ["nodeOptionsAllowed", true],
    ["presenceChecksReadValues", true],
    ["checkOnlyConsumesNonce", true],
    ["launchConsumesNonceBeforeChild", false],
    ["credentialValuesPassedInArguments", true],
    ["credentialValuesIncludedInAuditOutput", true],
    ["publicWorkerCommandAvailable", true],
    ["launcherExecutedByThisBatch", true]
  ]) {
    const mutated = clone(infrastructure);
    mutated.auditedKeychainLauncher[field] = value;
    assert.equal(evaluate(mutated).ok, false, field);
  }

  const version = clone(infrastructure);
  version.auditedKeychainLauncher.pinnedWranglerVersion = "latest";
  assert.equal(evaluate(version).ok, false);
});

test("Overwatch rejects incomplete tracked-secret coverage or value disclosure", () => {
  for (const [field, value] of [
    ["valuesMayBePrinted", true],
    ["valuesMayBeLogged", true],
    ["valuesMayBeHashedForReports", true],
    ["valuesMayBeMeasured", true],
    ["trackedRegularFilesAllExtensionsAndSizes", false],
    ["trackedWorktreeMustMatchIndex", false],
    ["matchedValuesMayBeReported", true]
  ]) {
    const mutated = clone(infrastructure);
    mutated.secretSafety[field] = value;
    assert.equal(evaluate(mutated).ok, false, field);
  }
});

test("Overwatch rejects readiness, deployment, production access, or influence claims", () => {
  for (const [field, value] of [
    ["unattendedDeploymentReady", true],
    ["unattendedSmokeReady", true],
    ["deploymentAuthorized", true],
    ["deploymentPerformed", true],
    ["cloudflareAccessPerformed", true],
    ["tokenCreationPerformed", true],
    ["serviceTokenCreationPerformed", true],
    ["accessPolicyChangePerformed", true],
    ["keychainValueReadPerformed", true],
    ["secretStoragePerformed", true],
    ["productionMutationPerformed", true],
    ["cohortActivation", "ON"],
    ["prospectiveCollection", "ON"],
    ["recommendationInfluence", "ON"]
  ]) {
    const mutated = clone(governance);
    mutated.deploymentBoundary[field] = value;
    assert.equal(evaluate(infrastructure, mutated).ok, false, field);
  }
});

test("Overwatch rejects implementation ownership inversion or commit substitution", () => {
  const owner = clone(governance);
  owner.dispatchAudit.implementationOwner = "Prometheus Overwatch";
  owner.dispatchAudit.overwatchModifiedSubsystemImplementation = true;
  const ownerResult = evaluate(infrastructure, owner);
  assert.equal(ownerResult.ok, false);
  assert.ok(ownerResult.failures.some(failure => failure.includes("Implementation owner")));

  const commit = clone(governance);
  commit.dispatchAudit.implementationCommits[1].commit = "0".repeat(40);
  assert.equal(evaluate(infrastructure, commit).ok, false);

  const intelligence = clone(governance);
  intelligence.dispatchAudit.intelligenceOwnerRepair.commit = "0".repeat(40);
  assert.equal(evaluate(infrastructure, intelligence).ok, false);
});

test("Overwatch rejects a report that claims setup, execution, or deployment readiness", () => {
  const ready = clone(report);
  ready.currentReadiness.unattendedDeploymentReady = true;
  assert.equal(evaluate(infrastructure, governance, ready).ok, false);

  const accessed = clone(report);
  accessed.boundaries.keychainValuesRead = true;
  assert.equal(evaluate(infrastructure, governance, accessed).ok, false);

  const deployed = clone(report);
  deployed.boundaries.deploymentPerformed = true;
  assert.equal(evaluate(infrastructure, governance, deployed).ok, false);
});
