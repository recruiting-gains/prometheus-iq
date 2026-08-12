import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  evaluateActiveCloudflareToolchainSuccessor,
  evaluateCloudflareUnattendedAccessGovernance,
  isActiveCloudflareToolchainEvidenceAccepted,
  verifyOverwatchCloudflareUnattendedAccess
} from "../scripts/verify-overwatch-cloudflare-unattended-access.mjs";

const root = resolve(import.meta.dirname, "..");
const readJson = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const infrastructurePath = "workers/infrastructure/cloudflare-unattended-deployment-access-v1.json";
const governancePath = "overwatch/governance/cloudflare-unattended-deployment-access-v1.json";
const historicalEvidenceCommit = execFileSync("git", [
  "log", "-1", "--format=%H", "--", governancePath
], { cwd: root, encoding: "utf8" }).trim();
const infrastructure = JSON.parse(execFileSync("git", [
  "show", `${historicalEvidenceCommit}:${infrastructurePath}`
], { cwd: root, encoding: "utf8" }));
const currentInfrastructure = readJson(infrastructurePath);
const governance = readJson("overwatch/governance/cloudflare-unattended-deployment-access-v1.json");
const report = readJson("overwatch/reports/BATCH-20260714-006-cloudflare-unattended-runtime-guard.json");
const commercialReadiness = readJson("overwatch/governance/route-iq-commercial-readiness-v1.json");
const toolchainGovernance = readJson(
  "overwatch/governance/route-iq-wrangler-miniflare-major-transition-requalification-v1.json"
);
const privateWorkflowGovernance = readJson(
  "overwatch/governance/github-actions-private-worker-deployment-v2.json"
);
const fieldSessionReportTypeGovernance = readJson(
  "overwatch/governance/field-session-report-type-contract-drift-repair-v1.json"
);
const liveCanonicalIdentityGovernance = readJson(
  "overwatch/governance/live-canonical-identity-migration-v1.json"
);
const readinessSuccessors = readJson(
  "overwatch/governance/route-iq-august-1-readiness-successors-v1.json"
);
const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const sha256 = path => createHash("sha256")
  .update(readFileSync(resolve(root, path)))
  .digest("hex");
const clone = value => structuredClone(value);
const evaluate = (infra = infrastructure, gov = governance, batchReport = report) => (
  evaluateCloudflareUnattendedAccessGovernance({
    infrastructure: infra,
    governance: gov,
    report: batchReport,
    enforceCanonicalPathBoundary: false
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
  assert.deepEqual(result.currentOwnerSuccessorCommits, [
    "3587c3d70526b95ae9083520ed42025c5522f764",
    "fd14a3b13ac00b645857396f3d26fa069762b715",
    "99457bcda1abed536cc06585492d29f5ac500f05"
  ]);
  assert.equal(result.currentOwnerSuccessorMappings, 5);
  assert.match(result.historicalEvidenceCommit, /^[a-f0-9]{40}$/u);
  assert.equal(result.activeToolchainOwnerCommit,
    "d55a983134be40bf10777df293ca593e7583f138");
  assert.equal(result.activeWranglerVersion, "4.120.1");
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

test("active Wrangler successor is exact and cannot rewrite historical evidence", () => {
  const values = {
    successor: toolchainGovernance.activeDeploymentPolicySuccessor,
    infrastructure: currentInfrastructure,
    packageJson,
    packageLock
  };
  assert.equal(evaluateActiveCloudflareToolchainSuccessor(values).ok, true);
  for (const mutate of [
    next => { next.successor.historicalRecordsRewritten = true; },
    next => { next.successor.infrastructureCommit = "0".repeat(40); },
    next => { next.infrastructure.auditedKeychainLauncher.pinnedWranglerVersion = "4.110.0"; },
    next => { next.infrastructure.defaultDenySmokeClient.canonicalHtmlPath = "/index.html"; },
    next => { next.packageLock.packages["node_modules/wrangler"].version = "4.110.0"; }
  ]) {
    const changed = clone(values);
    mutate(changed);
    assert.equal(evaluateActiveCloudflareToolchainSuccessor(changed).ok, false);
  }
});

test("unattended access composes only the exact governed learning payload successor", () => {
  const path = "workers/infrastructure/github-actions-private-worker-deployment-v2.json";
  const expectedSha256 = toolchainGovernance.activeDeploymentPolicySuccessor
    .currentEvidence[path];
  const values = {
    path,
    expectedSha256,
    currentSha256: sha256(path),
    privateWorkflowGovernance,
    fieldSessionReportTypeGovernance,
    liveCanonicalIdentityGovernance,
    readinessSuccessors
  };
  assert.notEqual(values.currentSha256, expectedSha256);
  assert.equal(isActiveCloudflareToolchainEvidenceAccepted(values), true);

  const drifted = clone(values);
  drifted.privateWorkflowGovernance.governedLearningPayloadSuccessor.evidence
    .find(item => item.path === path).successorSha256 = "0".repeat(64);
  assert.equal(isActiveCloudflareToolchainEvidenceAccepted(drifted), false);
});

test("paused unattended access accepts only explicit owner-authored commercial successors", () => {
  const subsystemSuccessors = commercialReadiness.protectedBaselineSuccessors
    .filter(entry => entry.owner !== "Prometheus Overwatch");
  assert.equal(subsystemSuccessors.length, 12);
  assert.deepEqual(
    [...new Set(subsystemSuccessors.map(entry => entry.ownerCommit))].sort(),
    [
      "11ac0668b87ed347c22bf963938b8d650370cfdb",
      "7b6e7a3423e1d1cae3068b99cc46bd3be6afb162",
      "82d1e6f23ca3a75c0073c051531477913258a98f",
      "87c95cd0d3a875a486a313759f474cc899a2d53f",
      "88b3bbbf2c34d879881ced98620c15a602598c45",
      "94061fea1c238ca854bde9d17a860e1375af9c52",
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

  const noncanonicalHtmlAlias = clone(currentInfrastructure);
  noncanonicalHtmlAlias.defaultDenySmokeClient.noncanonicalHtmlAliasesAllowed = true;
  assert.equal(evaluateCloudflareUnattendedAccessGovernance({
    infrastructure: noncanonicalHtmlAlias,
    governance,
    report
  }).ok, false);
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
