import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";

import {
  evaluateRouteIqProspectiveRetentionEnvelope,
  routeIqProspectiveRetentionBoundaryContractVersion,
  routeIqProspectiveRetentionPolicyVersion
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-retention-policy.mjs";
import { ROUTE_IQ_PROSPECTIVE_SHADOW_ENV } from "../workers/infrastructure/route-iq-prospective-shadow-contract.js";
import { auditRouteIqProspectiveActivationReadiness } from "../workers/infrastructure/route-iq-prospective-shadow-readiness.js";
import { verifyAutomaticCommitPushGovernance } from "./verify-overwatch-auto-push-governance.mjs";
import { verifyCrossSubsystemArtifactContracts } from "./verify-cross-subsystem-artifact-contracts.mjs";
import { verifyReleaseProvenanceRepair } from "./verify-release-provenance-repair.mjs";

const batchId = "BATCH-20260714-003";
const baseCommit = "d0ba56412de7535aa00f3d1396af037e941f2a6b";
const baseTree = "f5d8df22a696be1cc87fe52cc236fbfdaa32a406";
const governancePath = "overwatch/governance/route-iq-prospective-collection-activation-v1.json";
const reportPath = "overwatch/reports/BATCH-20260714-003-route-iq-prospective-collection-activation-readiness.json";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";

const ownerCommits = Object.freeze({
  "Prometheus Data": Object.freeze([
    "a5bd1d431e778cec045d1e8412efb396674ea321",
    "4803d7aca5810abfc1cbca84eb2f461046a10da4",
    "fdacf00da221ae5cc473fb57173a7940483deeb7"
  ]),
  "Prometheus Infrastructure": Object.freeze([
    "2280c6dae9d07bcfd744e99e9d28126188653eb2",
    "46658265248b03f7b52f9e1ec0b1ca61ca2b5920"
  ]),
  "Prometheus Intelligence Engine": Object.freeze([
    "6e4d9f70dc5a00949773f1e9fbb5206f30ea6c8a",
    "925fa5e18ab0dd816e55ce56814efadc7fef2556",
    "8479bb47195dee1c227d15064e49d988142c709a"
  ])
});

const expectedOverwatchFiles = Object.freeze([
  "overwatch/artifact-contracts/canonical-artifact-registry.json",
  governancePath,
  reportPath,
  "package.json",
  "scripts/verify-overwatch-route-iq-prospective-collection-activation.mjs",
  "scripts/verify-release-provenance-repair.mjs",
  "tests/overwatch-shadow-decision-readiness-gate.test.mjs",
  "tests/overwatch-route-iq-prospective-collection-activation.test.mjs"
].sort());

const excludedDomains = Object.freeze([
  "learning",
  "readiness",
  "evaluation",
  "representative_performance",
  "territory_metrics",
  "customer_metrics",
  "productivity_counts",
  "dashboards",
  "leaderboards",
  "baselines",
  "calibration",
  "recommendation_inputs"
]);

const read = path => fs.readFileSync(path);
const readJson = path => JSON.parse(read(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

function changedPaths(commit) {
  const result = git("diff-tree", "--no-commit-id", "--name-only", "-r", commit);
  return result ? result.split("\n").sort() : [];
}

function unionChangedPaths(commits) {
  return [...new Set(commits.flatMap(changedPaths))].sort();
}

function zeroUsage({ principals = 0 } = {}) {
  return {
    browserBodyBytes: 0,
    candidateCount: 0,
    domainCommandBytes: 0,
    eventsPerDay: 0,
    opportunitiesPerSession: 0,
    pendingOutbox: 0,
    principals,
    rowsReadPerRpc: 0,
    rowsWrittenPerRpc: 0,
    sourceArtifactBytes: 0,
    sourceArtifactTotalBytes: 0,
    sourceCount: 0,
    sqlStatementsPerRpc: 0,
    storageBytesPerCoordinator: 0
  };
}

function readinessObservation({ enabled = false } = {}) {
  return {
    fixtureKind: enabled ? "hypothetical_on" : "collection_off",
    productionAccessUsed: false,
    endpointState: enabled ? "enabled" : "disabled",
    endpointHttpStatus: enabled ? 200 : 202,
    attemptedApplicationWrites: 0,
    activeCohortCount: enabled ? 1 : 0,
    durableObjectInstanceCount: 0,
    kvWriteCount: 0,
    prospectiveRecordCount: 0,
    conflictCount: 0,
    exclusionCount: 0,
    evaluationCount: 0,
    archiveDispositionConsumerExclusionVerified: true,
    recommendationInfluence: "OFF",
    usage: zeroUsage({ principals: enabled ? 1 : 0 })
  };
}

function validRetentionEnvelope() {
  return {
    policyVersion: routeIqProspectiveRetentionPolicyVersion,
    collectionState: "on",
    recommendationInfluence: "off",
    recordOrigin: "prospective",
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz",
    evaluatedAt: "2026-07-14T12:00:00.000Z",
    retentionBoundary: {
      contractVersion: routeIqProspectiveRetentionBoundaryContractVersion,
      authorizationState: "authorized_existing_field_session_boundary",
      source: "authenticated_data_retention_contract",
      expiresAt: "2026-07-15T12:00:00.000Z"
    },
    legalHoldState: "none",
    deletionCapabilityStatus: "verified_not_activated",
    derivedProjectionExpiresAt: "2026-07-15T12:00:00.000Z"
  };
}

export function verifyOverwatchRouteIqProspectiveCollectionActivation() {
  const governance = readJson(governancePath);
  const report = readJson(reportPath);
  const registry = readJson(registryPath);
  const retentionPolicy = readJson(governance.retentionBoundary.policyPath);
  const activationTemplate = readJson(governance.activationCohort.templatePath);
  const intelligenceSpec = readJson(governance.intelligenceAdmission.specificationPath);
  const dataRuntimeContract = readJson("overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json");
  const contracts = verifyCrossSubsystemArtifactContracts();
  const provenance = verifyReleaseProvenanceRepair();
  const autoPushGovernance = verifyAutomaticCommitPushGovernance();

  assert.equal(contracts.ok, true, contracts.failures.join("\n"));
  assert.equal(provenance.status, "PASS");
  assert.equal(autoPushGovernance.status, "PASS");
  assert.equal(git("rev-parse", `${baseCommit}^{tree}`), baseTree);

  assert.equal(governance.batchId, batchId);
  assert.equal(governance.status, "SOURCE_COMPLETE_ACTIVATION_BLOCKED");
  assert.equal(governance.owningSubsystem, "Prometheus Overwatch");
  assert.equal(governance.workspaceId, "fitness_connection");
  assert.equal(governance.operatingProfileId, "fitness");
  assert.equal(governance.ownership.implementationOriginatedFromSubsystemOwners, true);
  assert.equal(governance.ownership.overwatchImplementationOwnershipViolation, false);
  assert.equal(governance.ownership.verificationOwner, "Prometheus Overwatch");

  const reportedOwners = new Map(report.dispatchAudit.subsystems.map(record => [record.subsystem, record]));
  for (const [owner, commits] of Object.entries(ownerCommits)) {
    const record = reportedOwners.get(owner);
    assert.ok(record, `Missing dispatch record for ${owner}.`);
    assert.equal(record.implementationOwner, owner);
    assert.deepEqual(record.commits, commits);
    assert.deepEqual(record.files.slice().sort(), unionChangedPaths(commits));
    for (const commit of commits) {
      assert.equal(git("cat-file", "-t", commit), "commit");
      assert.equal(git("merge-base", "--is-ancestor", baseCommit, commit), "");
    }
  }
  assert.equal(report.dispatchAudit.implementationOwnershipRespected, true);
  assert.equal(report.dispatchAudit.overwatchModifiedSubsystemImplementation, false);
  assert.deepEqual(report.dispatchAudit.filesChangedByOverwatch.slice().sort(), expectedOverwatchFiles);

  assert.equal(sha256(read(governance.retentionBoundary.policyPath)), governance.retentionBoundary.policySha256);
  assert.equal(sha256(read(governance.retentionBoundary.evaluatorPath)), governance.retentionBoundary.evaluatorSha256);
  assert.equal(retentionPolicy.status, governance.retentionBoundary.policyStatus);
  assert.equal(retentionPolicy.retentionDecision.numericDurationSelected, false);
  assert.equal(retentionPolicy.retentionDecision.durationDays, null);
  assert.equal(retentionPolicy.retentionDecision.activationEligible, false);
  assert.deepEqual(retentionPolicy.retentionDecision.activationBlockers, governance.retentionBoundary.activationBlockers);
  assert.equal(retentionPolicy.expiryAndDeletion.physicalDeletionActivated, false);
  assert.equal(retentionPolicy.legalHold.implementationStatus, "not_implemented");
  assert.equal(retentionPolicy.canonicality.additionalPropertiesAllowed, false);
  assert.equal(retentionPolicy.activationBoundary.collectionDefault, "off");
  assert.equal(retentionPolicy.activationBoundary.productionConsumerActivated, false);
  assert.equal(retentionPolicy.activationBoundary.deploymentPerformed, false);
  assert.equal(dataRuntimeContract.prospectiveShadowEvidenceLifecycleContract.retentionAndCollection.activationEligibleUnderRetentionPolicy, false);

  assert.equal(evaluateRouteIqProspectiveRetentionEnvelope(validRetentionEnvelope()).eligible, true);
  assert.throws(
    () => evaluateRouteIqProspectiveRetentionEnvelope({ ...validRetentionEnvelope(), rawNotes: "prohibited" }),
    error => error?.code === "route_iq_prospective_retention_fields_invalid"
      && error?.details?.envelopeLevel === "top_level"
      && error?.details?.unknownFieldCount === 1
  );
  assert.throws(
    () => evaluateRouteIqProspectiveRetentionEnvelope({
      ...validRetentionEnvelope(),
      retentionBoundary: { ...validRetentionEnvelope().retentionBoundary, customerName: "prohibited" }
    }),
    error => error?.code === "route_iq_prospective_retention_fields_invalid"
      && error?.details?.envelopeLevel === "retention_boundary"
      && error?.details?.unknownFieldCount === 1
  );

  assert.equal(sha256(read(governance.activationCohort.templatePath)), governance.activationCohort.templateSha256);
  assert.equal(activationTemplate.templateState, "INERT_DEFAULT_OFF");
  assert.equal(activationTemplate.collection, "OFF");
  assert.equal(activationTemplate.activeCohortCount, 0);
  assert.equal(activationTemplate.activationGuards.maximumActiveRepresentatives, 1);
  assert.equal(activationTemplate.activationGuards.maximumConfigLifetimeHours, 24);
  assert.equal(activationTemplate.activationGuards.productionUseOfThisTemplateIsProhibited, true);
  assert.deepEqual(activationTemplate.runtimeCohortConfigTemplate.supportedOpportunityTypes, ["next_stop"]);
  assert.equal(activationTemplate.runtimeCohortConfigTemplate.scopes.length, 1);

  const offAudit = auditRouteIqProspectiveActivationReadiness({
    env: {},
    observation: readinessObservation(),
    now: "2026-07-14T12:00:00.000Z"
  });
  assert.equal(offAudit.status, "PASS");
  assert.equal(offAudit.mode, "COLLECTION_OFF");
  assert.equal(offAudit.collection, "OFF");
  assert.equal(offAudit.activationAuthorized, false);
  assert.equal(offAudit.productionVerified, false);

  const onEnv = {
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.collection]: "ON",
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.cohortConfig]: JSON.stringify({
      version: "route-iq-prospective-cohort-config-v2",
      state: "ACTIVE",
      issuedAt: "2026-07-14T11:59:00.000Z",
      expiresAt: "2026-07-15T11:59:00.000Z",
      supportedOpportunityTypes: ["next_stop"],
      scopes: [{ workspaceId: "fitness_connection", operatingProfileId: "fitness", representativeId: "cruz" }]
    })
  };
  const hypotheticalOnAudit = auditRouteIqProspectiveActivationReadiness({
    env: onEnv,
    observation: readinessObservation({ enabled: true }),
    now: "2026-07-14T12:00:00.000Z"
  });
  assert.equal(hypotheticalOnAudit.status, "PASS");
  assert.equal(hypotheticalOnAudit.mode, "HYPOTHETICAL_ON");
  assert.equal(hypotheticalOnAudit.activationAuthorized, false);
  assert.equal(hypotheticalOnAudit.productionVerified, false);
  assert.equal(hypotheticalOnAudit.recommendationInfluence, "OFF");

  assert.equal(sha256(read(governance.monitoring.auditorPath)), governance.monitoring.auditorSha256);
  assert.equal(sha256(read(governance.monitoring.runbookPath)), governance.monitoring.runbookSha256);
  assert.equal(governance.monitoring.productionAccessUsed, false);
  assert.equal(governance.monitoring.productionVerified, false);

  const disposition = intelligenceSpec.administrativeDisposition;
  assert.equal(disposition.sessionId, governance.administrativeDisposition.sessionId);
  assert.equal(disposition.sourceRawSha256, governance.administrativeDisposition.rawSha256);
  assert.equal(disposition.originalRecordCount, 7);
  assert.equal(disposition.sourceArchiveRewriteAllowed, false);
  assert.equal(disposition.automaticZeroVisitExclusionAllowed, false);
  assert.equal(disposition.auditVisibility, "hash_only");
  assert.deepEqual(disposition.excludedDomains, excludedDomains);
  assert.equal(Object.keys(intelligenceSpec.consumerMatrix).length, 7);
  assert.equal(intelligenceSpec.currentState.readiness, "INSUFFICIENT_EVIDENCE");
  assert.equal(intelligenceSpec.currentState.collection, "OFF");
  assert.equal(intelligenceSpec.currentState.activeCohorts, 0);
  assert.equal(intelligenceSpec.currentState.productionProspectiveRecords, 0);
  assert.equal(intelligenceSpec.currentState.productionEvaluations, 0);
  assert.equal(intelligenceSpec.currentState.recommendationInfluence, "OFF");
  assert.equal(intelligenceSpec.currentState.representativeShadowOutput, false);

  for (const record of [
    ...governance.protectedBaselineSuccessor.currentProtectedSources,
    ...governance.protectedBaselineSuccessor.currentProtectedConsumers
  ]) {
    assert.equal(sha256(read(record.path)), record.sha256, `${record.path} protected successor hash drifted.`);
  }
  assert.equal(governance.protectedBaselineSuccessor.historicalBaselineRemainsHistorical, true);

  const fitnessWorkspace = registry.workspaces.find(workspace => workspace.workspaceId === "fitness_connection");
  const registrations = new Map(fitnessWorkspace.canonicalArtifacts.map(artifact => [artifact.artifactId, artifact]));
  const expectedRegistrations = {
    fitness_connection_route_iq_prospective_retention_policy: {
      owner: "Prometheus Data",
      path: governance.retentionBoundary.policyPath
    },
    fitness_connection_route_iq_collection_activation_governance: {
      owner: "Prometheus Overwatch",
      path: governancePath
    },
    fitness_connection_route_iq_collection_activation_batch_record: {
      owner: "Prometheus Overwatch",
      path: reportPath
    }
  };
  for (const [artifactId, expected] of Object.entries(expectedRegistrations)) {
    const artifact = registrations.get(artifactId);
    assert.ok(artifact, `${artifactId} must be registered.`);
    assert.equal(artifact.ownerSubsystem, expected.owner);
    assert.equal(artifact.path, expected.path);
    assert.deepEqual(artifact.writeAllowed, [expected.owner]);
    assert.equal(artifact.productionConsumer, false);
    assert.equal(artifact.failClosedIfMissing, true);
  }

  assert.equal(report.currentBoundaries.collection, "OFF");
  assert.equal(report.currentBoundaries.activeCohorts, 0);
  assert.equal(report.currentBoundaries.recommendationInfluence, "OFF");
  assert.equal(report.currentBoundaries.deploymentAuthorized, false);
  assert.equal(report.currentBoundaries.activationAuthorized, false);
  assert.equal(report.currentBoundaries.productionAccessUsed, false);
  assert.equal(report.release.activationReadiness, "HOLD_NOT_ACTIVATION_READY");
  assert.equal(report.verification.exactFinalHeadAndTreeRecordedOnlyInExternalHandoff, true);
  assert.equal(governance.architectureBoundary.newSubsystemCreated, false);
  assert.equal(governance.architectureBoundary.newVendorOrModelDependencyIntroduced, false);
  assert.equal(governance.architectureBoundary.newPiiCollectionIntroduced, false);
  assert.equal(governance.architectureBoundary.productionAccessPerformed, false);
  assert.equal(governance.architectureBoundary.productionMutationPerformed, false);
  assert.equal(governance.architectureBoundary.deploymentPerformed, false);
  assert.equal(governance.architectureBoundary.collectionActivated, false);
  assert.equal(governance.architectureBoundary.recommendationInfluence, "OFF");

  return {
    status: "PASS",
    batchId,
    ownerCommits: Object.values(ownerCommits).flat().length,
    retentionPolicy: "FAIL_CLOSED_PENDING_EXPLICIT_BOUNDARY",
    activationReadiness: "HOLD_NOT_ACTIVATION_READY",
    activeCohorts: 0,
    dispositionConsumers: 7,
    dispositionExcludedDomains: 12,
    productionAccessUsed: false,
    deploymentAuthorized: false,
    collection: "OFF",
    recommendationInfluence: "OFF"
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log(JSON.stringify(verifyOverwatchRouteIqProspectiveCollectionActivation(), null, 2));
}
