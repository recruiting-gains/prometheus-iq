import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  computeRouteIqProspectiveRetentionPolicySha256,
  evaluateRouteIqProspectiveIntelligenceRetentionAdmission,
  loadRouteIqProspectiveRetentionPolicy,
  routeIqProspectiveIntelligenceRetentionAdmissionVersion,
  routeIqProspectiveRetentionExcludedDomains,
  validateRouteIqProspectiveRetentionPolicy,
} from "../intelligence/route-iq-prospective-retention-admission.mjs";
import {
  routeIqProspectiveRetentionBoundaryContractVersion,
  routeIqProspectiveRetentionPolicyVersion,
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-retention-policy.mjs";
import {
  routeIqAcceptedIntelligenceRetentionAdmissionVersion,
  routeIqAcceptedProspectiveRetentionPolicySha256,
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path));
const readJson = (path) => JSON.parse(read(path).toString("utf8"));
const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");

const paths = Object.freeze({
  specification:
    "intelligence/provenance/specifications/prospective-retention-admission-v1.json",
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
  baselineSuccessor:
    "intelligence/provenance/protected-baseline-synchronization-batch-20260714-003-data-coordinator-successor-v1.json",
});

function digest(label) {
  return sha256(Buffer.from(label, "utf8"));
}

function validEnvelope() {
  return {
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz",
    collectionState: "on",
    recommendationInfluence: "off",
    recordOrigin: "prospective",
    policyVersion: routeIqProspectiveRetentionPolicyVersion,
    retentionBoundary: {
      contractVersion: routeIqProspectiveRetentionBoundaryContractVersion,
      authorizationState: "authorized_existing_field_session_boundary",
      source: "authenticated_data_retention_contract",
      expiresAt: "2026-08-14T12:00:00.000Z",
    },
    evaluatedAt: "2026-07-14T12:00:00.000Z",
    deletionCapabilityStatus: "verified_not_activated",
    legalHoldState: "none",
    derivedProjectionExpiresAt: "2026-08-14T12:00:00.000Z",
    sourceSession: {
      coordinatorSessionId: `riq_session_${digest("verification-session")}`,
      fieldSessionId:
        "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-15",
      rawSha256: digest("verification-raw"),
      consumptionEligibility: {
        eligible: true,
        state: "NOT_ADMINISTRATIVELY_EXCLUDED",
        reason: null,
        auditOnly: false,
        excludedDomains: [],
      },
    },
  };
}

export function verifyRouteIqProspectiveRetentionIntelligence() {
  const specification = readJson(paths.specification);
  const readOnlyContract = readJson(paths.readOnlyContract);
  const offRouteContract = readJson(paths.offRouteContract);
  const shadowContract = readJson(paths.shadowContract);
  const baselineSuccessor = readJson(paths.baselineSuccessor);
  const dataPolicy = loadRouteIqProspectiveRetentionPolicy();

  assert.equal(
    specification.version,
    "route-iq-intelligence-prospective-retention-admission-spec-v1",
  );
  assert.equal(specification.batchId, "BATCH-20260714-003");
  assert.equal(
    specification.dataOwnerLineage.exactKeySuccessorCommit,
    "4803d7aca5810abfc1cbca84eb2f461046a10da4",
  );
  assert.equal(
    specification.dataOwnerLineage.coordinatorAdmissionSuccessorCommit,
    "fdacf00da221ae5cc473fb57173a7940483deeb7",
  );
  assert.equal(
    specification.dataOwnerLineage.coordinatorSha256,
    sha256(read("data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs")),
  );
  assert.equal(
    routeIqAcceptedIntelligenceRetentionAdmissionVersion,
    routeIqProspectiveIntelligenceRetentionAdmissionVersion,
  );
  assert.equal(
    routeIqAcceptedProspectiveRetentionPolicySha256,
    computeRouteIqProspectiveRetentionPolicySha256(),
  );
  assert.equal(validateRouteIqProspectiveRetentionPolicy(dataPolicy), true);
  assert.equal(
    computeRouteIqProspectiveRetentionPolicySha256(),
    specification.dataOwnerLineage.retentionPolicySha256,
  );
  for (const [path, expected] of [
    [
      "overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json",
      specification.dataOwnerLineage.runtimeContractSha256,
    ],
    [
      "data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs",
      specification.dataOwnerLineage.archiveRuntimeSha256,
    ],
    [
      "data/route-iq-field-sessions-v1/route-iq-prospective-retention-policy.mjs",
      specification.dataOwnerLineage.retentionEvaluatorSha256,
    ],
  ]) {
    assert.equal(sha256(read(path)), expected, path);
  }

  const admission = evaluateRouteIqProspectiveIntelligenceRetentionAdmission(
    validEnvelope(),
  );
  assert.equal(admission.admissionVersion, routeIqProspectiveIntelligenceRetentionAdmissionVersion);
  assert.equal(admission.admitted, true);
  assert.equal(admission.representativeOutputAllowed, false);
  assert.equal(admission.recommendationInfluenceAllowed, false);

  const disposed = validEnvelope();
  disposed.sourceSession = {
    coordinatorSessionId: `riq_session_${digest("disposed-session")}`,
    fieldSessionId:
      specification.administrativeDisposition.sessionId,
    rawSha256: specification.administrativeDisposition.sourceRawSha256,
    consumptionEligibility: {
      eligible: false,
      state: specification.administrativeDisposition.state,
      reason: specification.administrativeDisposition.reason,
      auditOnly: true,
      excludedDomains: [...routeIqProspectiveRetentionExcludedDomains],
      dispositionRecordSha256: digest("disposition-record"),
    },
  };
  const disposedAdmission =
    evaluateRouteIqProspectiveIntelligenceRetentionAdmission(disposed);
  assert.equal(disposedAdmission.admitted, false);
  assert.deepEqual(Object.keys(disposedAdmission.audit).sort(), [
    "dispositionRecordSha256",
    "sourceRawSha256",
  ]);
  assert.equal(
    JSON.stringify(disposedAdmission).includes(
      specification.administrativeDisposition.sessionId,
    ),
    false,
  );

  assert.equal(
    readOnlyContract.prospectiveRetentionAdmission.dataExactKeySuccessorCommit,
    specification.dataOwnerLineage.exactKeySuccessorCommit,
  );
  assert.equal(
    offRouteContract.prospectiveRetentionAdmission.inheritedFromUpstreamReadOnlyLearning,
    true,
  );
  assert.equal(
    shadowContract.prospectiveRetentionAdmission.evaluationAdmissionRequired,
    true,
  );
  assert.equal(
    shadowContract.prospectiveRetentionAdmission.dataCoordinatorAdmissionSuccessorCommit,
    specification.dataOwnerLineage.coordinatorAdmissionSuccessorCommit,
  );
  assert.equal(
    shadowContract.protectedDataRuntimeBaseline.sha256,
    specification.dataOwnerLineage.coordinatorSha256,
  );
  assert.equal(
    baselineSuccessor.dataOwnerTransition.commit,
    specification.dataOwnerLineage.coordinatorAdmissionSuccessorCommit,
  );
  assert.equal(
    baselineSuccessor.dataOwnerTransition.coordinator.currentSha256,
    specification.dataOwnerLineage.coordinatorSha256,
  );
  assert.equal(
    sha256(read(baselineSuccessor.predecessor.path)),
    baselineSuccessor.predecessor.sha256,
  );
  assert.equal(
    sha256(read(baselineSuccessor.intelligenceOwnerSynchronization.contract.path)),
    baselineSuccessor.intelligenceOwnerSynchronization.contract.currentSha256,
  );
  assert.equal(
    sha256(read(baselineSuccessor.intelligenceOwnerSynchronization.specification.path)),
    baselineSuccessor.intelligenceOwnerSynchronization.specification.currentSha256,
  );
  assert.equal(baselineSuccessor.predecessor.remainsHistorical, true);
  assert.equal(baselineSuccessor.predecessor.rewritten, false);
  for (const field of [
    "retentionAdmissionRequiredOnCanonicalEvaluationRecord",
    "exactAdmissionAndSourceEvidenceKeySetsRequired",
    "policyVersionAndSha256Pinned",
    "coordinatorSessionSha256Bound",
    "fieldSessionSha256Bound",
    "sourceArchiveRawSha256Bound",
    "outcomeAuthoritativeTimeBound",
    "retentionValidThroughDataAdmissionRequired",
    "disposedSessionRejected",
  ]) {
    assert.equal(
      baselineSuccessor.dataOwnerTransition.semanticChanges[field],
      true,
      field,
    );
  }
  for (const field of [
    "intelligenceEvaluationRecordAcceptedByDataSuccessor",
    "sourceArchiveRawSha256Present",
    "missingRetentionAdmissionRejected",
    "additionalRetentionFieldRejected",
    "expiredRetentionRejected",
    "unauthorizedRetentionRejected",
    "unknownOrActiveLegalHoldRejected",
    "tamperedPolicyRejected",
    "tamperedSourceBindingRejected",
    "disposedSessionRejected",
    "deterministicReplayPreserved",
    "appendOnlyEvidencePreserved",
  ]) {
    assert.equal(baselineSuccessor.compatibilityValidation[field], true, field);
  }
  assert.deepEqual(
    shadowContract.administrativeDispositionAdmission.requiredExcludedDomains,
    specification.administrativeDisposition.excludedDomains,
  );

  const readOnlyArtifact = readJson(paths.readOnlyArtifact);
  const offRouteArtifact = readJson(paths.offRouteArtifact);
  const shadowLedger = readJson(paths.shadowLedger);
  const readinessReport = readJson(paths.readinessReport);
  assert.equal(readOnlyArtifact.recommendationSafety.recommendationInfluenceActive, false);
  assert.equal(offRouteArtifact.safety.recommendationInfluenceActive, false);
  assert.equal(shadowLedger.recommendationInfluence, "OFF");
  assert.equal(shadowLedger.records.length, 0);
  assert.equal(readinessReport.state, "INSUFFICIENT_EVIDENCE");
  assert.equal(readinessReport.recommendationInfluence, "OFF");
  assert.equal(
    shadowContract.prospectiveRetentionAdmission.collectionActivation,
    "OFF",
  );
  assert.equal(shadowContract.prospectiveRetentionAdmission.activeCohorts, 0);
  assert.equal(
    shadowContract.prospectiveRetentionAdmission
      .canonicalProductionProspectiveRecords,
    0,
  );
  assert.equal(
    shadowContract.prospectiveRetentionAdmission.canonicalProductionEvaluations,
    0,
  );

  return Object.freeze({
    status: "passed",
    batchId: specification.batchId,
    dataExactKeySuccessorCommit:
      specification.dataOwnerLineage.exactKeySuccessorCommit,
    dataCoordinatorAdmissionSuccessorCommit:
      specification.dataOwnerLineage.coordinatorAdmissionSuccessorCommit,
    dataCoordinatorSha256: specification.dataOwnerLineage.coordinatorSha256,
    retentionPolicySha256:
      specification.dataOwnerLineage.retentionPolicySha256,
    consumersVerified: Object.keys(specification.consumerMatrix).length,
    excludedDomainCount:
      specification.administrativeDisposition.excludedDomains.length,
    auditVisibility: specification.administrativeDisposition.auditVisibility,
    readiness: readinessReport.state,
    collection: shadowContract.prospectiveRetentionAdmission.collectionActivation,
    activeCohorts: shadowContract.prospectiveRetentionAdmission.activeCohorts,
    productionProspectiveRecords:
      shadowContract.prospectiveRetentionAdmission
        .canonicalProductionProspectiveRecords,
    productionEvaluations:
      shadowContract.prospectiveRetentionAdmission.canonicalProductionEvaluations,
    recommendationInfluence: readinessReport.recommendationInfluence,
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  process.stdout.write(
    `${JSON.stringify(verifyRouteIqProspectiveRetentionIntelligence(), null, 2)}\n`,
  );
}
