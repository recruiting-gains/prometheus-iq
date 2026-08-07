import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  evaluateRouteIqProspectiveRetentionEnvelope,
  routeIqProspectiveRetentionBoundaryContractVersion,
  routeIqProspectiveRetentionPolicyVersion
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-retention-policy.mjs";
import {
  addRouteIqRetentionCalendarMonths,
  calculateRouteIqRetentionBoundary,
  evaluateRouteIqDeidentifiedAggregateRetention,
  evaluateRouteIqRetentionOperation,
  openRouteIqRetentionGovernanceLedger,
  readAuthoritativeRouteIqRetentionLegalHoldSnapshot,
  routeIqDeidentifiedAggregateAttestationVersion,
  routeIqDeidentifiedAggregateVersion,
  routeIqRetentionAdministrativeDispositionTarget,
  routeIqRetentionMaximumCalendarMonths,
  validateRouteIqRetentionOperationReceipt
} from "../data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs";
import { verifyRouteIqProspectiveRetentionIntelligence } from "./verify-route-iq-prospective-retention-intelligence.mjs";
import { verifyCrossSubsystemArtifactContracts } from "./verify-cross-subsystem-artifact-contracts.mjs";
import {
  aggregateAuthorityClaims,
  aggregateGovernanceBinding,
  createRetentionAuthority,
  createRetentionStore,
  customerOverrideAuthorityClaims,
  legalHoldAuthorityClaims,
  retentionOperationAuthorityClaims,
  retentionSha256,
  stableJson
} from "../tests/route-iq-retention-test-support.mjs";

const batchId = "BATCH-20260714-004";
const baseCommit = "119d37f154ee99df1591863e745f4d1033953c71";
const baseTree = "52d248178b85d46f26d4a8a12c95f56597a8b304";
const governancePath = "overwatch/governance/route-iq-prospective-evidence-retention-v1.json";
const reportPath = "overwatch/reports/BATCH-20260714-004-route-iq-prospective-evidence-retention.json";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";
const liveIdentityGovernancePath =
  "overwatch/governance/live-canonical-identity-migration-v1.json";

const ownerCommits = Object.freeze({
  "Prometheus Data": Object.freeze([
    "d4c5e583dc11ea0285c51ab94480ed6c87859267",
    "c73118ddb262d3010bbc94a900f8506fb2f56192"
  ]),
  "Prometheus Infrastructure": Object.freeze([
    "2b4ea7d7d2f13a40f1a8cba1e671f8fb360f3c63"
  ]),
  "Prometheus Intelligence Engine": Object.freeze([
    "51256caeb3300083ea1056976893b26e3b0d2b3f",
    "f438f97a58580187481bd87598cba1830f05c75f"
  ])
});

const expectedOverwatchFiles = Object.freeze([
  "overwatch/artifact-contracts/canonical-artifact-registry.json",
  governancePath,
  reportPath,
  "package.json",
  "scripts/verify-overwatch-route-iq-prospective-collection-activation.mjs",
  "scripts/verify-overwatch-route-iq-prospective-evidence-retention.mjs",
  "tests/overwatch-route-iq-prospective-evidence-retention.test.mjs",
  "tests/overwatch-shadow-decision-readiness-gate.test.mjs"
].sort());

const read = path => readFileSync(path);
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

function assertOwnedPaths(owner, paths) {
  const allowed = owner === "Prometheus Data"
    ? ["data/", "overwatch/artifact-contracts/data/", "tests/route-iq-"]
    : owner === "Prometheus Infrastructure"
      ? ["docs/", "scripts/verify-route-iq-prospective-shadow-infrastructure.mjs", "tests/route-iq-prospective-shadow-infrastructure.test.mjs", "workers/infrastructure/"]
      : ["intelligence/", "scripts/validate-intelligence-architecture.mjs", "scripts/verify-route-iq-prospective-retention-intelligence.mjs", "scripts/verify-shadow-decision-readiness.mjs", "tests/intelligence-architecture.test.mjs", "tests/off-route-learning-intelligence.test.mjs", "tests/read-only-field-session-learning.test.mjs", "tests/route-iq-committed-outcome-evaluation.test.mjs", "tests/route-iq-prospective-retention-intelligence.test.mjs", "tests/shadow-decision-readiness.test.mjs"];
  for (const path of paths) {
    assert.equal(allowed.some(prefix => path.startsWith(prefix)), true, `${owner} changed out-of-scope path ${path}.`);
  }
}

export function validateFieldSessionArchiveIdentitySuccessor({
  liveIdentity,
  historicalArchiveSha256,
  currentArchiveSha256
}) {
  assert.equal(liveIdentity?.governanceId, "live-canonical-identity-migration-v1");
  const successor = liveIdentity?.dataCompatibility?.fieldSessionArchiveIdentitySuccessor;
  assert.ok(successor);
  assert.equal(
    successor.classification,
    "CANONICAL_REPORT_IDENTITY_COMPATIBILITY_SUCCESSOR"
  );
  assert.equal(
    successor.path,
    "data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs"
  );
  assert.equal(successor.previousSha256, historicalArchiveSha256);
  assert.equal(successor.currentSha256, currentArchiveSha256);
  assert.equal(successor.currentSha256,
    "4b682c744aa19fa53813dfac838a638810e55c3067033f1cf711e83df6ee73c3");
  assert.equal(successor.ownerCommit, "a0856eb22bda483aa87f361ef9bb54d63b61e686");
  assert.equal(successor.ownerSubsystem, "Prometheus Data");
  assert.equal(successor.acceptedCurrentReportIdentity, "Prometheus Route IQ");
  assert.equal(successor.acceptedHistoricalReportIdentity, "Prometheus IQ");
  assert.equal(successor.retentionSemanticsChanged, false);
  assert.equal(successor.storageSchemaChanged, false);
  assert.equal(successor.historicalContractsRewritten, false);
  return successor;
}

async function ledgerFor(subject, authority = createRetentionAuthority("overwatch-retention-verification-key-material-v1")) {
  const store = createRetentionStore();
  const ledger = await openRouteIqRetentionGovernanceLedger({
    store,
    subject,
    authorityVerifier: authority.verifier
  });
  return { authority, ledger, store, subject };
}

function boundary(subject, createdAt = "2026-07-14T12:00:00.000Z", options = {}) {
  return calculateRouteIqRetentionBoundary({
    subject,
    customerAccountId: "fitness_connection",
    createdAt,
    customerContractExpiresAt: options.customerContractExpiresAt ?? null,
    customerOverrideAuthority: options.customerOverrideAuthority ?? null
  }, options.authorityVerifier ? { authorityVerifier: options.authorityVerifier } : {});
}

function prospectiveEnvelope(retentionBoundary, evaluatedAt = "2026-07-14T12:00:01.000Z") {
  return {
    policyVersion: routeIqProspectiveRetentionPolicyVersion,
    collectionState: "on",
    recommendationInfluence: "off",
    recordOrigin: "prospective",
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz",
    evaluatedAt,
    retentionBoundary: {
      contractVersion: routeIqProspectiveRetentionBoundaryContractVersion,
      authorizationState: "founder_authorized_18_month_maximum",
      source: "authenticated_data_retention_contract",
      ...retentionBoundary
    },
    derivedProjectionExpiresAt: retentionBoundary.expiresAt
  };
}

async function verifyDataSemantics() {
  assert.equal(routeIqRetentionMaximumCalendarMonths, 18);
  assert.equal(addRouteIqRetentionCalendarMonths("2026-08-31T23:59:59.999Z"), "2028-02-29T23:59:59.999Z");
  assert.equal(addRouteIqRetentionCalendarMonths("2027-08-31T05:04:03.002Z"), "2029-02-28T05:04:03.002Z");
  assert.equal(addRouteIqRetentionCalendarMonths("2024-02-29T12:30:00.000Z"), "2025-08-29T12:30:00.000Z");

  const subject = {
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    recordClass: "prospective_shadow_evidence",
    sourceRecordSha256: "b".repeat(64)
  };
  const authority = createRetentionAuthority("overwatch-retention-boundary-authority-v1");
  const createdAt = "2026-07-14T12:00:00.000Z";
  const customerContractExpiresAt = "2027-01-14T12:00:00.000Z";
  const shorteningClaims = customerOverrideAuthorityClaims({
    subject,
    customerAccountId: "fitness_connection",
    createdAt,
    customerContractExpiresAt
  });
  const shortened = boundary(subject, createdAt, {
    customerContractExpiresAt,
    customerOverrideAuthority: authority.sign(shorteningClaims, {
      authority: "prometheus_data_customer_contract_authority",
      seed: "overwatch-shortening"
    }),
    authorityVerifier: authority.verifier
  });
  assert.equal(shortened.expiresAt, customerContractExpiresAt);
  assert.equal(shortened.customerOverrideState, "authenticated_shortening");
  assert.throws(
    () => boundary(subject, createdAt, {
      customerContractExpiresAt: addRouteIqRetentionCalendarMonths(createdAt),
      customerOverrideAuthority: {},
      authorityVerifier: authority.verifier
    }),
    error => error.code === "route_iq_retention_customer_override_not_shorter"
  );

  const context = await ledgerFor(subject, createRetentionAuthority("overwatch-retention-ledger-authority-v1"));
  const fullBoundary = boundary(subject, createdAt);
  const admitted = evaluateRouteIqProspectiveRetentionEnvelope(
    prospectiveEnvelope(fullBoundary),
    { retentionGovernanceLedger: context.ledger }
  );
  assert.equal(admitted.eligible, true);
  const noLedger = evaluateRouteIqProspectiveRetentionEnvelope(prospectiveEnvelope(fullBoundary));
  assert.equal(noLedger.eligible, false);
  assert.equal(noLedger.reasons.includes("legal_hold_state_unknown"), true);

  const holdAt = "2026-07-14T12:00:00.500Z";
  await context.ledger.appendLegalHold({
    eventType: "LEGAL_HOLD_APPLIED",
    recordedAt: holdAt,
    authority: context.authority.sign(
      legalHoldAuthorityClaims({ eventType: "LEGAL_HOLD_APPLIED", recordedAt: holdAt, subject }),
      { seed: "overwatch-hold" }
    )
  });
  const held = evaluateRouteIqProspectiveRetentionEnvelope(
    prospectiveEnvelope(fullBoundary),
    { retentionGovernanceLedger: context.ledger }
  );
  assert.equal(held.eligible, false);
  assert.equal(held.reasons.includes("legal_hold_active"), true);
  await assert.rejects(
    () => context.ledger.appendLegalHold({
      eventType: "LEGAL_HOLD_RELEASED",
      recordedAt: "2026-07-14T12:00:02.000Z",
      authority: context.authority.sign(
        legalHoldAuthorityClaims({
          eventType: "LEGAL_HOLD_RELEASED",
          recordedAt: "2026-07-14T12:00:02.000Z",
          subject
        }),
        { authority: "prometheus_data", seed: "overwatch-unauthorized-release" }
      )
    }),
    error => error.code === "route_iq_retention_authority_unauthorized"
  );
  await context.ledger.appendLegalHold({
    eventType: "LEGAL_HOLD_RELEASED",
    recordedAt: "2026-07-14T12:00:03.000Z",
    authority: context.authority.sign(
      legalHoldAuthorityClaims({
        eventType: "LEGAL_HOLD_RELEASED",
        recordedAt: "2026-07-14T12:00:03.000Z",
        subject
      }),
      { authority: "authorized_counsel", seed: "overwatch-authorized-release" }
    )
  });
  assert.equal((await readAuthoritativeRouteIqRetentionLegalHoldSnapshot(
    context.ledger,
    subject,
    "2026-07-14T12:00:03.001Z"
  )).state, "none");
  assert.equal(boundary(subject, createdAt).expiresAt, fullBoundary.expiresAt);

  const dispositionSubject = {
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    recordClass: "field_session_raw_evidence",
    sourceRecordSha256: routeIqRetentionAdministrativeDispositionTarget.sourceRawSha256
  };
  const disposition = await ledgerFor(
    dispositionSubject,
    createRetentionAuthority("overwatch-retention-disposition-authority-v1")
  );
  const dispositionBoundary = boundary(dispositionSubject, "2026-07-14T23:30:00.000Z");
  const unsignedDisposition = {
    operation: "administrative_disposition",
    requestedAt: "2026-07-15T01:00:00.000Z",
    subject: dispositionSubject,
    retentionBoundary: dispositionBoundary,
    administrativeDispositionTarget: routeIqRetentionAdministrativeDispositionTarget
  };
  const dispositionInput = {
    ...unsignedDisposition,
    authorization: disposition.authority.sign(retentionOperationAuthorityClaims(unsignedDisposition), {
      seed: "overwatch-exact-disposition"
    })
  };
  const receipt = await disposition.ledger.appendOperationReceipt(dispositionInput);
  assert.equal(receipt.decision.allowed, true);
  assert.equal(receipt.productionMutationAuthorized, false);
  assert.equal((await disposition.ledger.appendOperationReceipt(dispositionInput)).receiptId, receipt.receiptId);
  assert.deepEqual(validateRouteIqRetentionOperationReceipt(receipt, disposition.ledger), receipt);
  assert.throws(
    () => validateRouteIqRetentionOperationReceipt({ ...receipt, decision: { ...receipt.decision, allowed: false } }, disposition.ledger),
    error => error.code === "route_iq_retention_receipt_not_persisted"
  );
  const generalized = structuredClone(dispositionInput);
  generalized.administrativeDispositionTarget.sessionId =
    "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-15";
  assert.throws(
    () => evaluateRouteIqRetentionOperation(generalized, { retentionGovernanceLedger: disposition.ledger }),
    error => error.code === "route_iq_retention_disposition_target_unauthorized"
  );

  const deletion = await ledgerFor(subject, createRetentionAuthority("overwatch-retention-deletion-authority-v1"));
  const unsignedDeletion = {
    operation: "physical_deletion",
    requestedAt: "2028-01-14T12:00:00.001Z",
    subject,
    retentionBoundary: fullBoundary,
    administrativeDispositionTarget: null
  };
  const deletionReceipt = await deletion.ledger.appendOperationReceipt({
    ...unsignedDeletion,
    authorization: deletion.authority.sign(retentionOperationAuthorityClaims(unsignedDeletion), {
      seed: "overwatch-blocked-deletion"
    })
  });
  assert.equal(deletionReceipt.decision.allowed, false);
  assert.equal(deletionReceipt.decision.reasons.includes("physical_deletion_not_implemented_or_activated"), true);
  assert.equal(typeof deletion.ledger.delete, "undefined");

  return { dispositionReceiptId: receipt.receiptId };
}

async function verifyAggregateSemantics() {
  const authority = createRetentionAuthority("overwatch-retention-aggregate-authority-v1");
  const first = await ledgerFor({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    recordClass: "field_session_raw_evidence",
    sourceRecordSha256: "1".repeat(64)
  }, authority);
  const second = await ledgerFor({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    recordClass: "field_session_raw_evidence",
    sourceRecordSha256: "2".repeat(64)
  }, authority);
  const sourceGovernance = [first, second].map(context => ({
    subject: context.subject,
    retentionGovernanceLedger: context.ledger
  }));
  const artifact = {
    schemaVersion: routeIqDeidentifiedAggregateVersion,
    aggregationLevel: "multi_record_summary",
    dimensions: { month: "2026-07" },
    metrics: { recordCount: 2, visitCount: 4, conversationCount: 4, leadCount: 3, unitCount: 0 }
  };
  const artifactBytes = stableJson(artifact);
  const artifactSha256 = retentionSha256(artifactBytes);
  const attestedAt = "2026-07-15T12:00:00.000Z";
  const binding = aggregateGovernanceBinding(sourceGovernance, attestedAt);
  const validClaims = {
    aggregateOnly: true,
    deidentified: true,
    containsRepresentativeIdentity: false,
    containsCustomerIdentity: false,
    containsSpecificVisitIdentity: false,
    containsPreciseLocationTrail: false,
    containsReidentificationLinkage: false,
    containsHiddenRawRows: false
  };

  function attestation(claims, seed) {
    const unsigned = {
      version: routeIqDeidentifiedAggregateAttestationVersion,
      artifactSha256,
      attestedAt,
      ...binding,
      claims
    };
    return {
      ...unsigned,
      authority: authority.sign(aggregateAuthorityClaims({
        attestationVersion: unsigned.version,
        artifactSha256,
        attestedAt,
        ...binding,
        claims
      }), { authority: "prometheus_data", seed })
    };
  }

  const admitted = await evaluateRouteIqDeidentifiedAggregateRetention({
    artifactBytes,
    artifactSha256,
    attestation: attestation(validClaims, "overwatch-aggregate-valid"),
    sourceGovernance
  }, { authorityVerifier: authority.verifier });
  assert.equal(admitted.indefiniteRetentionEligible, true);

  const identifyingClaims = { ...validClaims, containsRepresentativeIdentity: true };
  const identifying = await evaluateRouteIqDeidentifiedAggregateRetention({
    artifactBytes,
    artifactSha256,
    attestation: attestation(identifyingClaims, "overwatch-aggregate-identifying"),
    sourceGovernance
  }, { authorityVerifier: authority.verifier });
  assert.equal(identifying.indefiniteRetentionEligible, false);
  assert.equal(identifying.reasons.includes("representative_identity_present_or_unknown"), true);

  await assert.rejects(
    () => evaluateRouteIqDeidentifiedAggregateRetention({
      artifactBytes: stableJson({ ...artifact, representativeId: "prohibited" }),
      artifactSha256: retentionSha256(stableJson({ ...artifact, representativeId: "prohibited" })),
      attestation: attestation(validClaims, "overwatch-aggregate-unknown-field"),
      sourceGovernance
    }, { authorityVerifier: authority.verifier }),
    error => ["route_iq_retention_fields_invalid", "route_iq_retention_aggregate_attestation_mismatch"].includes(error.code)
  );

  return { aggregateArtifactSha256: admitted.artifactSha256 };
}

export async function verifyOverwatchRouteIqProspectiveEvidenceRetention() {
  const governance = readJson(governancePath);
  const report = readJson(reportPath);
  const registry = readJson(registryPath);
  const policy = readJson(governance.dataContract.policyPath);
  const dataRuntimeContract = readJson(governance.dataContract.runtimeContractPath);
  const protectedBaseline = readJson(governance.intelligenceAdmission.protectedBaselinePath);
  const liveIdentity = readJson(liveIdentityGovernancePath);
  const currentArchiveSha256 = sha256(read(governance.dataContract.archiveRuntimePath));
  const archiveIdentitySuccessor = validateFieldSessionArchiveIdentitySuccessor({
    liveIdentity,
    historicalArchiveSha256: governance.dataContract.archiveRuntimeSha256,
    currentArchiveSha256
  });

  assert.equal(git("rev-parse", `${baseCommit}^{tree}`), baseTree);
  assert.equal(governance.batchId, batchId);
  assert.equal(governance.status, "FOUNDER_RETENTION_POLICY_ENCODED_ACTIVATION_HELD");
  assert.equal(governance.owningSubsystem, "Prometheus Overwatch");
  assert.equal(governance.ownership.implementationOriginatedFromSubsystemOwners, true);
  assert.equal(governance.ownership.overwatchImplementationOwnershipViolation, false);

  const reportedOwners = new Map(report.dispatchAudit.subsystems.map(record => [record.subsystem, record]));
  for (const [owner, commits] of Object.entries(ownerCommits)) {
    const record = reportedOwners.get(owner);
    assert.ok(record, `Missing dispatch record for ${owner}.`);
    assert.deepEqual(record.commits, commits);
    const paths = owner === "Prometheus Data"
      ? git("diff", "--name-only", `${baseCommit}..${commits.at(-1)}`).split("\n").filter(Boolean).sort()
      : unionChangedPaths(commits);
    assert.deepEqual(record.files.slice().sort(), paths);
    assertOwnedPaths(owner, paths);
    for (const commit of commits) {
      assert.equal(git("cat-file", "-t", commit), "commit");
      execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"]);
    }
  }
  assert.equal(report.dispatchAudit.implementationOwnershipRespected, true);
  assert.equal(report.dispatchAudit.overwatchModifiedSubsystemImplementation, false);
  assert.deepEqual(report.dispatchAudit.filesChangedByOverwatch.slice().sort(), expectedOverwatchFiles);
  for (const path of expectedOverwatchFiles) {
    assert.equal(
      path.startsWith("overwatch/") || path === "package.json" || path.startsWith("scripts/verify-overwatch-") || path.startsWith("tests/overwatch-"),
      true,
      `Overwatch path ${path} is outside governance and verification ownership.`
    );
  }

  for (const [pathKey, hashKey] of [
    ["policyPath", "policySha256"],
    ["evaluatorPath", "evaluatorSha256"],
    ["governanceRuntimePath", "governanceRuntimeSha256"],
    ["coordinatorPath", "coordinatorSha256"],
    ["archiveRuntimePath", "archiveRuntimeSha256"],
    ["runtimeContractPath", "runtimeContractSha256"]
  ]) {
    if (pathKey === "archiveRuntimePath") {
      assert.equal(governance.dataContract[hashKey], archiveIdentitySuccessor.previousSha256);
      assert.equal(currentArchiveSha256, archiveIdentitySuccessor.currentSha256);
    } else {
      assert.equal(sha256(read(governance.dataContract[pathKey])), governance.dataContract[hashKey]);
    }
  }
  for (const [pathKey, hashKey] of [
    ["runtimePath", "runtimeSha256"],
    ["readinessPath", "readinessSha256"]
  ]) {
    assert.equal(sha256(read(governance.infrastructureAdmission[pathKey])), governance.infrastructureAdmission[hashKey]);
  }
  for (const [pathKey, hashKey] of [
    ["runtimePath", "runtimeSha256"],
    ["evaluationRuntimePath", "evaluationRuntimeSha256"],
    ["specificationPath", "specificationSha256"],
    ["protectedBaselinePath", "protectedBaselineSha256"],
    ["architectureSuccessorPath", "architectureSuccessorSha256"],
    ["crossIndustryAdoptionPath", "crossIndustryAdoptionSha256"]
  ]) {
    assert.equal(sha256(read(governance.intelligenceAdmission[pathKey])), governance.intelligenceAdmission[hashKey]);
  }
  assert.equal(
    governance.intelligenceAdmission.previousRuntimeSha256,
    "eea1a1f1e9a6fde8fdc8c9fe1e5606a240bbe97ac533ece88342cf7555787780"
  );
  assert.equal(
    governance.intelligenceAdmission.runtimeSuccessorOwnerCommit,
    "f0593640bae9cb9517d954415ca4980226a51073"
  );
  assert.equal(governance.intelligenceAdmission.runtimeSuccessorOwner, "Prometheus Intelligence");
  assert.equal(
    governance.intelligenceAdmission.runtimeSuccessorClassification,
    "WORKER_SAFE_STATIC_POLICY_IMPORT_WITH_UNCHANGED_GOVERNED_POLICY_HASH"
  );

  assert.equal(policy.batchId, batchId);
  assert.equal(policy.retentionDecision.maximumCalendarMonths, 18);
  assert.equal(policy.retentionDecision.customerContractMayShorten, true);
  assert.equal(policy.retentionDecision.customerContractMayExpand, false);
  assert.equal(policy.expiryAndDeletion.physicalDeletionActivated, false);
  assert.equal(policy.expiryAndDeletion.physicalDeletionEvaluatorCanPerformMutation, false);
  assert.equal(policy.legalHold.callerAssertedStateAccepted, false);
  assert.equal(policy.aggregateRetention.indefiniteRetentionAllowed, true);
  assert.equal(policy.aggregateRetention.rawEvidenceAllowed, false);
  assert.equal(policy.activationBoundary.collectionDefault, "off");
  assert.equal(policy.activationBoundary.productionConsumerActivated, false);
  assert.equal(policy.activationBoundary.productionMutationPerformed, false);
  assert.equal(
    dataRuntimeContract.prospectiveShadowEvidenceLifecycleContract.retentionAndCollection.maximumRetentionCalendarMonths,
    18
  );
  assert.equal(
    dataRuntimeContract.prospectiveShadowEvidenceLifecycleContract.retentionAndCollection.activationEligibleUnderRetentionPolicy,
    false
  );

  const dataEvidence = await verifyDataSemantics();
  const aggregateEvidence = await verifyAggregateSemantics();
  const intelligence = verifyRouteIqProspectiveRetentionIntelligence();
  assert.equal(intelligence.status, "passed");
  assert.equal(intelligence.readiness, "INSUFFICIENT_EVIDENCE");
  assert.equal(intelligence.collection, "OFF");
  assert.equal(intelligence.activeCohorts, 0);
  assert.equal(intelligence.recommendationInfluence, "OFF");

  const protectedBaselineEvidenceCommit = git(
    "log",
    "-1",
    "--format=%H",
    "--",
    governance.intelligenceAdmission.protectedBaselinePath
  );
  for (const artifact of protectedBaseline.dataOwnerLineage.artifacts) {
    assert.equal(
      sha256(execFileSync("git", [
        "show",
        `${protectedBaselineEvidenceCommit}:${artifact.path}`
      ])),
      artifact.sha256,
      `${artifact.path} historical protected hash drifted.`
    );
  }
  assert.equal(protectedBaseline.protectedBehavior.collection, "OFF");
  assert.equal(protectedBaseline.protectedBehavior.activeCohorts, 0);
  assert.equal(protectedBaseline.protectedBehavior.readiness, "INSUFFICIENT_EVIDENCE");
  assert.equal(protectedBaseline.protectedBehavior.recommendationInfluence, "OFF");
  const architectureSuccessor = readJson(governance.intelligenceAdmission.architectureSuccessorPath);
  assert.equal(architectureSuccessor.batchId, batchId);
  assert.equal(architectureSuccessor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(architectureSuccessor.currentAuthority.dataOwnerCommit, "c73118ddb262d3010bbc94a900f8506fb2f56192");
  assert.equal(
    architectureSuccessor.dataOwnerTransition.archiveRuntime.currentSha256,
    "68aa5ee9b216c4efe0fa3c8b3a01ce1c569e53ad15c2e6bfb7d5f8a80850e8b4"
  );
  assert.equal(architectureSuccessor.historicalCheckpoint.remainsHistorical, true);
  assert.equal(architectureSuccessor.historicalCheckpoint.rewritten, false);
  assert.equal(architectureSuccessor.boundaryValidation.collection, "OFF");
  assert.equal(architectureSuccessor.boundaryValidation.recommendationInfluence, "OFF");
  const crossIndustryAdoption = readJson(
    governance.intelligenceAdmission.crossIndustryAdoptionPath
  );
  assert.equal(crossIndustryAdoption.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(
    governance.intelligenceAdmission.crossIndustryAdoptionOwnerCommit,
    "5215ad7f261590f5901dc84a3b8e59d9bde6ce8b"
  );
  assert.equal(
    governance.intelligenceAdmission.crossIndustryAdoptionCorrectionCommit,
    "894ea7843e084369acf7bf6158a3ea5088deb431"
  );
  assert.equal(
    governance.intelligenceAdmission.crossIndustryAdoptionVerifierCommit,
    "2da83e12095713772d2f3c444bd15b5fabf0ef65"
  );
  for (const commit of [
    governance.intelligenceAdmission.crossIndustryAdoptionOwnerCommit,
    governance.intelligenceAdmission.crossIndustryAdoptionCorrectionCommit,
    governance.intelligenceAdmission.crossIndustryAdoptionVerifierCommit,
    governance.intelligenceAdmission.currentDataLineageOwnerCommit
  ]) {
    assert.equal(git("cat-file", "-t", commit), "commit");
    execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"]);
  }
  assert.equal(
    crossIndustryAdoption.dataOwnerTransition.commit,
    governance.intelligenceAdmission.currentDataLineageOwnerCommit
  );
  assert.equal(
    crossIndustryAdoption.dataOwnerTransition.archiveRuntime.currentSha256,
    governance.intelligenceAdmission.currentArchiveRuntimeSha256
  );
  assert.equal(
    sha256(read(crossIndustryAdoption.dataOwnerTransition.archiveRuntime.path)),
    archiveIdentitySuccessor.currentSha256
  );
  assert.equal(
    governance.intelligenceAdmission.currentArchiveRuntimeSha256,
    archiveIdentitySuccessor.previousSha256
  );
  assert.equal(git("cat-file", "-t", archiveIdentitySuccessor.ownerCommit), "commit");
  execFileSync("git", [
    "merge-base",
    "--is-ancestor",
    archiveIdentitySuccessor.ownerCommit,
    "HEAD"
  ]);
  assert.equal(crossIndustryAdoption.governedEmptyState.activeBusinessCount, 0);
  assert.equal(crossIndustryAdoption.governedEmptyState.retiredOrDemoSupplyRestored, false);
  assert.equal(crossIndustryAdoption.boundaries.prospectiveCollection, "OFF");
  assert.equal(crossIndustryAdoption.boundaries.activeCohorts, 0);
  assert.equal(crossIndustryAdoption.boundaries.recommendationInfluence, "OFF");
  assert.equal(crossIndustryAdoption.boundaries.deploymentPerformed, false);

  const contracts = verifyCrossSubsystemArtifactContracts();
  assert.equal(contracts.ok, true, contracts.failures.join("\n"));
  const fitness = registry.workspaces.find(workspace => workspace.workspaceId === "fitness_connection");
  const registrations = new Map(fitness.canonicalArtifacts.map(artifact => [artifact.artifactId, artifact]));
  for (const [artifactId, path] of [
    ["fitness_connection_route_iq_prospective_retention_policy", governance.dataContract.policyPath],
    ["fitness_connection_route_iq_retention_governance", governancePath],
    ["fitness_connection_route_iq_retention_batch_record", reportPath]
  ]) {
    const artifact = registrations.get(artifactId);
    assert.ok(artifact, `${artifactId} must be registered.`);
    assert.equal(artifact.path, path);
    assert.equal(artifact.productionConsumer, false);
    assert.equal(artifact.failClosedIfMissing, true);
  }

  assert.equal(governance.administrativeDisposition.sessionId, routeIqRetentionAdministrativeDispositionTarget.sessionId);
  assert.equal(governance.administrativeDisposition.rawSha256, routeIqRetentionAdministrativeDispositionTarget.sourceRawSha256);
  assert.equal(governance.administrativeDisposition.originalRecordCount, 7);
  assert.equal(governance.administrativeDisposition.generalZeroVisitExclusionAllowed, false);
  assert.equal(governance.infrastructureAdmission.productionAdmissionProducerAvailable, false);
  assert.equal(governance.infrastructureAdmission.productionEnvironmentAndCounts, "UNVERIFIED");
  assert.equal(governance.activationBoundary.collection, "OFF");
  assert.equal(governance.activationBoundary.activeCohorts, 0);
  assert.equal(governance.activationBoundary.recommendationInfluence, "OFF");
  assert.equal(governance.activationBoundary.activationReadiness, "HOLD_NOT_ACTIVATION_READY");
  assert.equal(governance.architectureBoundary.productionAccessPerformed, false);
  assert.equal(governance.architectureBoundary.productionMutationPerformed, false);
  assert.equal(governance.architectureBoundary.deploymentPerformed, false);
  assert.equal(governance.architectureBoundary.collectionActivated, false);
  assert.equal(report.currentBoundaries.productionProspectiveRecords, "UNVERIFIED_NO_PRODUCTION_ACCESS");
  assert.equal(report.currentBoundaries.productionEvaluations, "UNVERIFIED_NO_PRODUCTION_ACCESS");
  assert.equal(report.currentBoundaries.readiness, "INSUFFICIENT_EVIDENCE");
  assert.equal(report.release.activationReadiness, "HOLD_NOT_ACTIVATION_READY");
  assert.equal(report.release.deploymentStatus, "NOT_AUTHORIZED");

  return Object.freeze({
    status: "PASS",
    batchId,
    ownerCommitCount: Object.values(ownerCommits).flat().length,
    maximumRetentionCalendarMonths: 18,
    customerOverride: "SHORTEN_ONLY",
    legalHold: "LOCAL_AUTHENTICATED_APPEND_ONLY_RUNTIME_NOT_DEPLOYED",
    physicalDeletion: "NOT_IMPLEMENTED_NOT_ACTIVATED",
    aggregateRetention: "DATA_ATTESTED_DEIDENTIFIED_ONLY",
    accidentalArchiveRecords: 7,
    dispositionReceiptVerified: Boolean(dataEvidence.dispositionReceiptId),
    aggregateArtifactVerified: Boolean(aggregateEvidence.aggregateArtifactSha256),
    productionAccessUsed: false,
    deploymentAuthorized: false,
    activationReadiness: "HOLD_NOT_ACTIVATION_READY",
    readiness: "INSUFFICIENT_EVIDENCE",
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF"
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  console.log(JSON.stringify(await verifyOverwatchRouteIqProspectiveEvidenceRetention(), null, 2));
}
