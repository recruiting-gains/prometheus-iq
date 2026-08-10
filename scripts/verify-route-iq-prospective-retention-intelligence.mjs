import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  computeRouteIqProspectiveRetentionPolicySha256,
  loadRouteIqProspectiveRetentionPolicy,
  validateRouteIqProspectiveRetentionPolicy,
} from "../intelligence/route-iq-prospective-retention-admission.mjs";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path));
const readJson = (path) => JSON.parse(read(path).toString("utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const paths = Object.freeze({
  specification:
    "intelligence/provenance/specifications/prospective-retention-admission-v1.json",
  maintenanceSuccessor:
    "intelligence/provenance/protected-baseline-synchronization-retention-maintenance-consumer-admission-v1.json",
  retentionGovernance:
    "data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs",
  readOnlyContract:
    "intelligence/contracts/read-only-field-session-learning-contracts.json",
  offRouteContract:
    "intelligence/contracts/off-route-learning-intelligence-contracts.json",
  shadowContract:
    "intelligence/contracts/shadow-decision-readiness-contracts.json",
  readOnlyArtifact:
    "intelligence/artifacts/read-only-field-session-learning/fitness_connection/cruz/learning-snapshot-v1.json",
  offRouteArtifact:
    "intelligence/artifacts/off-route-learning-intelligence-v1/fitness_connection/cruz/off-route-learning-snapshot-v1.json",
  shadowLedger:
    "intelligence/artifacts/shadow-decision-readiness-v1/fitness_connection/cruz/shadow-ledger-v1.json",
  readinessReport:
    "intelligence/artifacts/shadow-decision-readiness-v1/fitness_connection/cruz/founder-readiness-report-v1.json",
});

export function validateRouteIqRetentionMaintenanceConsumerAdmissionSuccessor(
  successor,
  { specification = readJson(paths.specification) } = {},
) {
  assert.equal(
    successor.version,
    "route-iq-intelligence-retention-maintenance-consumer-admission-successor-v1",
  );
  assert.equal(successor.batchId, "BATCH-20260809-002");
  assert.equal(successor.status, "OWNER_REVIEWED_PROTECTED_COHERENCE_SUCCESSOR");
  assert.equal(successor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(
    successor.predecessor.path,
    "intelligence/provenance/protected-baseline-synchronization-retention-deletion-consumer-admission-v1.json",
  );
  assert.equal(
    successor.predecessor.sha256,
    sha256(read(successor.predecessor.path)),
  );
  assert.equal(successor.predecessor.remainsHistorical, true);
  assert.equal(successor.predecessor.rewritten, false);
  assert.equal(
    specification.consumerAdmissionSuccessor.path,
    paths.maintenanceSuccessor,
  );
  assert.equal(
    specification.consumerAdmissionSuccessor.version,
    successor.version,
  );
  assert.equal(
    successor.upstreamDataAuthority.commit,
    specification.dataOwnerLineage.productionLegalHoldReadinessCommit,
  );
  assert.equal(
    successor.upstreamDataAuthority.retentionGovernance.path,
    paths.retentionGovernance,
  );
  assert.equal(
    successor.upstreamDataAuthority.retentionGovernance.currentSha256,
    sha256(read(paths.retentionGovernance)),
  );
  assert.equal(
    specification.dataOwnerLineage.retentionGovernanceSha256,
    successor.upstreamDataAuthority.retentionGovernance.currentSha256,
  );
  assert.equal(
    specification.dataOwnerLineage.previousRetentionGovernanceSha256,
    successor.upstreamDataAuthority.retentionGovernance.previousSha256,
  );
  assert.equal(
    successor.upstreamInfrastructureRelease.commit,
    specification.maintenanceReleaseReadiness.infrastructureCommit,
  );
  assert.equal(
    successor.upstreamInfrastructureRelease.tree,
    specification.maintenanceReleaseReadiness.infrastructureTree,
  );
  const infrastructureArtifacts = new Map(
    successor.upstreamInfrastructureRelease.artifacts.map((artifact) => [
      artifact.path,
      artifact.sha256,
    ]),
  );
  for (const artifact of [
    specification.maintenanceReleaseReadiness.releasePackageContract,
    specification.maintenanceReleaseReadiness.releasePackageBuilder,
    specification.maintenanceReleaseReadiness.productionAdmission,
  ]) {
    assert.equal(infrastructureArtifacts.get(artifact.path), artifact.sha256);
    assert.equal(artifact.sha256, sha256(read(artifact.path)));
  }
  assert.deepEqual(successor.composition, {
    exactFinalCommitArtifactRequired: true,
    dataProductionLegalHoldAuthorityRequired: true,
    fixtureLegalHoldEvidenceAllowed: false,
    signedShortLivedAdmissionRequired: true,
    atomicReplayRejectionRequired: true,
    consumerExclusionSemanticsChanged: false,
    recommendationBehaviorChanged: false,
    deploymentAuthorityGranted: false,
    deletionAuthorityGranted: false,
    historicalPinsRewritten: false,
  });
  assert.deepEqual(successor.boundaries, {
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    canonicalProspectiveRecords: 0,
    canonicalProspectiveEvaluations: 0,
    maintenanceRelease: "SOURCE_COMPLETE_DORMANT_NOT_DEPLOYED",
    productionContactPerformed: false,
    productionMutationPerformed: false,
    deploymentPerformed: false,
  });
  return Object.freeze({
    status: "OWNER_REVIEWED_PROTECTED_COHERENCE_SUCCESSOR",
    batchId: successor.batchId,
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
  });
}

export function verifyRouteIqProspectiveRetentionIntelligence() {
  const specification = readJson(paths.specification);
  const maintenanceSuccessor = readJson(paths.maintenanceSuccessor);
  const readOnlyContract = readJson(paths.readOnlyContract);
  const offRouteContract = readJson(paths.offRouteContract);
  const shadowContract = readJson(paths.shadowContract);
  const policy = loadRouteIqProspectiveRetentionPolicy();
  const dataPolicySha256 = computeRouteIqProspectiveRetentionPolicySha256();

  assert.equal(validateRouteIqProspectiveRetentionPolicy(policy), true);
  assert.equal(
    specification.version,
    "route-iq-intelligence-prospective-retention-admission-spec-v3",
  );
  assert.equal(specification.batchId, "BATCH-20260714-004");
  assert.equal(specification.sourceDeletionSuccessorBatchId, "BATCH-20260809-001");
  assert.equal(specification.deploymentReadinessSuccessorBatchId, "BATCH-20260809-002");
  assert.equal(specification.dataOwnerLineage.finalRetentionCommit, "c73118ddb262d3010bbc94a900f8506fb2f56192");
  assert.equal(specification.dataOwnerLineage.sourceDeletionSuccessorCommits.at(-1), "a8fedf7c0b88f0611b4f721b08641e55413c591a");
  assert.equal(specification.dataOwnerLineage.retentionPolicySha256, dataPolicySha256);
  assert.equal(
    specification.dataOwnerLineage.retentionEvaluatorSha256,
    sha256(read("data/route-iq-field-sessions-v1/route-iq-prospective-retention-policy.mjs")),
  );
  assert.equal(
    specification.dataOwnerLineage.retentionGovernanceSha256,
    sha256(read(paths.retentionGovernance)),
  );
  assert.equal(specification.dataAdmission.dataAuthenticatedAndHashBoundRequired, true);
  assert.equal(specification.dataAdmission.authoritativeLegalHoldLedgerRequired, true);
  assert.equal(specification.dataAdmission.authoritativeProductionLegalHoldRequired, true);
  assert.equal(specification.dataAdmission.fixtureLegalHoldEvidenceAllowed, false);
  assert.equal(specification.dataAdmission.immediatePreMutationRevalidationRequired, true);
  assert.equal(specification.dataAdmission.maximumCalendarMonths, 18);
  assert.equal(specification.dataAdmission.customerMayOnlyShorten, true);
  assert.equal(specification.dataAdmission.customerMayExpand, false);
  assert.equal(specification.dataAdmission.indefiniteAggregateRequiresExactDataAttestation, true);
  assert.equal(specification.administrativeDisposition.auditVisibility, "hash_only");
  validateRouteIqRetentionMaintenanceConsumerAdmissionSuccessor(
    maintenanceSuccessor,
    { specification },
  );

  for (const contract of [readOnlyContract, offRouteContract, shadowContract]) {
    const retention = contract.prospectiveRetentionAdmission;
    assert.equal(retention.batchId, "BATCH-20260714-004");
    assert.equal(retention.sourceDeletionSuccessorBatchId, "BATCH-20260809-001");
    assert.equal(retention.dataPolicySha256, dataPolicySha256);
    assert.equal(retention.dataAuthenticatedAndHashBoundRequired, true);
    assert.equal(retention.maximumCalendarMonths, 18);
    assert.equal(retention.customerMayOnlyShorten, true);
    assert.equal(retention.customerMayExpand, false);
    assert.equal(retention.unknownOrActiveLegalHoldAdmissionAllowed, false);
    assert.equal(retention.historicalSyntheticReplayAdmissionAllowed, false);
    assert.equal(retention.indefiniteRawRetentionAllowed, false);
    assert.equal(retention.recommendationInfluenceAllowed, false);
    assert.equal(retention.deletionStartedOrCompletedAdmissionAllowed, false);
  }

  const readOnlyArtifact = readJson(paths.readOnlyArtifact);
  const offRouteArtifact = readJson(paths.offRouteArtifact);
  const shadowLedger = readJson(paths.shadowLedger);
  const readinessReport = readJson(paths.readinessReport);
  assert.equal(readOnlyArtifact.recommendationSafety.recommendationInfluenceActive, false);
  assert.equal(offRouteArtifact.safety.recommendationInfluenceActive, false);
  assert.equal(shadowLedger.records.length, 0);
  assert.equal(shadowLedger.recommendationInfluence, "OFF");
  assert.equal(readinessReport.state, "INSUFFICIENT_EVIDENCE");
  assert.equal(readinessReport.recommendationInfluence, "OFF");
  assert.equal(shadowContract.prospectiveRetentionAdmission.collectionActivation, "OFF");
  assert.equal(shadowContract.prospectiveRetentionAdmission.activeCohorts, 0);

  return Object.freeze({
    status: "passed",
    batchId: specification.batchId,
    retentionPolicySha256: dataPolicySha256,
    readiness: readinessReport.state,
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    maintenanceRelease: "SOURCE_COMPLETE_DORMANT_NOT_DEPLOYED",
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  process.stdout.write(
    `${JSON.stringify(verifyRouteIqProspectiveRetentionIntelligence(), null, 2)}\n`,
  );
}
