import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  createFounderAttendedResponseContractAbsenceEvidence,
  prepareFounderAttendedResponseContractSuccessorControl,
  readFounderAttendedResponseContractAttemptStateTestOnly,
  reserveFounderAttendedResponseContractAttempt
} from "../scripts/lib/cloudflare-founder-attended-response-contract-artifacts.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_DURATION,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_NAME
} from "../scripts/lib/cloudflare-founder-attended-create-receipt-v2-constants.mjs";
import {
  classifyFounderAttendedCreateReceiptV2ResponseTestOnly
} from "../scripts/lib/cloudflare-founder-attended-create-receipt-v2-workflow.mjs";
import {
  evaluateFounderAttendedCreateReceiptV2Governance,
  evaluateFounderAttendedSuccessfulResponseReconciliationGovernance,
  verifyOverwatchFounderAttendedCreateReceiptV2
} from "../scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs";
import {
  evaluateFounderAttendedFreshAttemptEvidenceRotationGovernance,
  verifyManualIsolatedGymPreviewWorkflow,
  verifyOverwatchFounderAttendedFreshAttemptEvidenceRotation
} from "../scripts/verify-overwatch-cloudflare-founder-attended-fresh-attempt-evidence-rotation.mjs";

const root = resolve(import.meta.dirname, "..");
const readJson = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const governance = readJson(
  "overwatch/governance/cloudflare-founder-attended-live-create-receipt-safe-provisioning-repair-v2.json"
);
const report = readJson(
  "overwatch/reports/BATCH-20260715-004-cloudflare-live-create-receipt-safe-provisioning-repair-v2.json"
);
const reconciliationGovernance = readJson(
  "overwatch/governance/cloudflare-founder-attended-successful-response-reconciliation-v1.json"
);
const reconciliationReport = readJson(
  "overwatch/reports/BATCH-20260715-005-cloudflare-founder-attended-successful-response-reconciliation.json"
);
const rotationGovernance = readJson(
  "overwatch/governance/cloudflare-founder-attended-fresh-attempt-evidence-rotation-v1.json"
);
const rotationReport = readJson(
  "overwatch/reports/BATCH-20260715-006-cloudflare-founder-attended-fresh-attempt-evidence-rotation.json"
);
const clone = value => structuredClone(value);
const evaluate = (nextGovernance = governance, nextReport = report) =>
  evaluateFounderAttendedCreateReceiptV2Governance({
    governance: nextGovernance,
    report: nextReport
  });
const evaluateReconciliation = (
  nextGovernance = reconciliationGovernance,
  nextReport = reconciliationReport
) => evaluateFounderAttendedSuccessfulResponseReconciliationGovernance({
  governance: nextGovernance,
  report: nextReport
});
const evaluateRotation = (
  nextGovernance = rotationGovernance,
  nextReport = rotationReport
) => evaluateFounderAttendedFreshAttemptEvidenceRotationGovernance({
  governance: nextGovernance,
  report: nextReport
});

function createResponse({ status = 200, omit = [] } = {}) {
  const result = {
    id: "f174e90a-fafe-4643-bbbc-4a0ed4fc8415",
    name: CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_NAME,
    duration: CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_DURATION,
    client_id: `${"d".repeat(32)}.access.example.com`,
    client_secret: "synthetic-overwatch-client-secret-value-5005",
    created_at: "2026-07-15T23:00:01.12345Z",
    updated_at: "2026-07-15T23:00:01.12345Z"
  };
  for (const key of omit) delete result[key];
  return { status, body: JSON.stringify({ success: true, result }) };
}

test("Overwatch independently verifies the Infrastructure-owned v2 repair", () => {
  const result = verifyOverwatchFounderAttendedCreateReceiptV2();
  assert.equal(result.status, "passed");
  assert.equal(result.batchId, "BATCH-20260715-006");
  assert.equal(result.implementationOwner, "Prometheus Infrastructure");
  assert.equal(result.verificationOwner, "Prometheus Overwatch");
  assert.equal(result.focusedOwnerTests, 68);
  assert.deepEqual([...result.currentOverwatchVerifierSuccessorCommits], [
    "6db68f845e91c967e34f3b825e4cbc2372cef6d8",
    "4fb815a7e03f745685a36e24e847dbc1f109a7df",
    "1a1e130b9ffe63948ceaf7fc7d5cfff647431e3e",
    "03117292d4253b5ed31c8f47d38d149a59fa1cec",
    "0e92d266392bc82c553d546d55ef33641c894f8d",
    "02b398bdfeb1e5fb8a82bb009e4776630cb3f7d8"
  ]);
  assert.equal(result.cloudflareApiContacted, false);
  assert.equal(result.realKeychainValuesRead, false);
});

test("Overwatch independently verifies immutable fresh-attempt rotation", () => {
  const result = verifyOverwatchFounderAttendedFreshAttemptEvidenceRotation();
  assert.equal(result.status, "passed");
  assert.equal(result.batchId, "BATCH-20260715-006");
  assert.deepEqual(result.implementationCommits, [
    "20e367ccd815f059adcdfa241f34a66c0a28675b",
    "e10719d6d2ff312f2a5473c1fe000810e915509b"
  ]);
  assert.equal(result.focusedOwnerTests, 68);
  assert.equal(result.cloudflareApiContacted, false);
  assert.equal(result.realKeychainValuesRead, false);
  assert.equal(result.deploymentPerformed, false);
  assert.equal(result.nextSafeCommand,
    "node scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs");
});

test("fresh-attempt deployment guard admits only the exact manual isolated gym preview", () => {
  const path = ".github/workflows/preview-prometheus-route-iq-gym-first.yml";
  const source = readFileSync(resolve(root, path), "utf8");
  const previewGovernance = readJson(
    "overwatch/governance/route-iq-gym-first-dual-track-public-website-preview-v1.json"
  );
  const config = readJson("wrangler.prometheusrouteiq-website-gym-preview.jsonc");
  const input = { path, source, governance: previewGovernance, config };
  assert.equal(verifyManualIsolatedGymPreviewWorkflow(input), true);

  const mutateSource = mutation => {
    const changed = structuredClone(input);
    changed.source = mutation(changed.source);
    changed.governance.founderAttendedAutomaticDeploymentGuardSuccessor.workflowSha256 =
      createHash("sha256").update(changed.source).digest("hex");
    return changed;
  };
  const candidates = [
    mutateSource(value => value.replace("  workflow_dispatch:\n", "  push:\n  workflow_dispatch:\n")),
    mutateSource(value => value.replace(
      "--name prometheusrouteiq-website-gym-preview 2>&1",
      "--name prometheusrouteiq-website 2>&1"
    )),
    mutateSource(value => value.replace("github.triggering_actor == 'PrometheusRouteIQ' &&\n", "")),
    mutateSource(value => `${value}\n          npx wrangler deploy --config wrangler.prometheusrouteiq-website-gym-preview.jsonc --name prometheusrouteiq-website-gym-preview\n`),
    (() => {
      const changed = structuredClone(input);
      changed.config.workers_dev = false;
      return changed;
    })(),
    (() => {
      const changed = structuredClone(input);
      changed.governance.founderAttendedAutomaticDeploymentGuardSuccessor
        .productionWorkerDeploymentAllowed = true;
      return changed;
    })()
  ];
  for (const changed of candidates) {
    assert.throws(() => verifyManualIsolatedGymPreviewWorkflow(changed));
  }
});

test("Overwatch independently exercises abandoned-attempt isolation and latest selection", t => {
  const artifactRoot = mkdtempSync(join(tmpdir(), "prometheus-overwatch-attempt-rotation-"));
  t.after(() => rmSync(artifactRoot, { recursive: true, force: true }));
  const repositoryIdentity = Object.freeze({
    commit: "a".repeat(40),
    tree: "b".repeat(40),
    clean: true
  });
  const expectedUid = process.getuid();
  const first = reserveFounderAttendedResponseContractAttempt({
    artifactRoot,
    now: new Date("2026-07-15T22:00:00.000Z"),
    repositoryIdentity,
    randomBytesImpl: () => Buffer.alloc(32, 1),
    expectedUid
  });
  const second = reserveFounderAttendedResponseContractAttempt({
    artifactRoot,
    now: new Date("2026-07-15T22:01:00.000Z"),
    repositoryIdentity,
    randomBytesImpl: () => Buffer.alloc(32, 2),
    expectedUid
  });
  createFounderAttendedResponseContractAbsenceEvidence({
    artifactRoot,
    now: new Date("2026-07-15T22:01:01.000Z"),
    repositoryIdentity,
    accountIdSha256: "c".repeat(64),
    attemptId: second.attemptId,
    randomBytesImpl: () => Buffer.alloc(32, 3),
    expectedUid
  });
  const prepared = prepareFounderAttendedResponseContractSuccessorControl({
    artifactRoot,
    now: new Date("2026-07-15T22:02:00.000Z"),
    repositoryIdentity,
    randomBytesImpl: () => Buffer.alloc(32, 4),
    expectedUid
  });
  const states = readFounderAttendedResponseContractAttemptStateTestOnly({
    artifactRoot,
    expectedUid
  });
  assert.equal(first.attemptId, states[0].attemptId);
  assert.equal(states[0].outcome, null);
  assert.equal(states[0].controlPresent, false);
  assert.equal(second.attemptId, states[1].attemptId);
  assert.equal(states[1].outcome, "EXACT_NAME_ABSENT");
  assert.equal(prepared.attemptId, second.attemptId);
});

test("Overwatch independently rejects future-dated attempt evidence", t => {
  const artifactRoot = mkdtempSync(join(tmpdir(), "prometheus-overwatch-attempt-time-"));
  t.after(() => rmSync(artifactRoot, { recursive: true, force: true }));
  const repositoryIdentity = Object.freeze({
    commit: "d".repeat(40),
    tree: "e".repeat(40),
    clean: true
  });
  const expectedUid = process.getuid();
  const attempt = reserveFounderAttendedResponseContractAttempt({
    artifactRoot,
    now: new Date("2026-07-15T22:00:00.000Z"),
    repositoryIdentity,
    randomBytesImpl: () => Buffer.alloc(32, 5),
    expectedUid
  });
  createFounderAttendedResponseContractAbsenceEvidence({
    artifactRoot,
    now: new Date("2026-07-15T22:00:01.000Z"),
    repositoryIdentity,
    accountIdSha256: "f".repeat(64),
    attemptId: attempt.attemptId,
    randomBytesImpl: () => Buffer.alloc(32, 6),
    expectedUid
  });
  const diagnosticPath = join(attempt.attemptRoot, "diagnostic-receipt.json");
  const diagnostic = JSON.parse(readFileSync(diagnosticPath, "utf8"));
  diagnostic.observedAt = "2026-07-15T22:10:00.000Z";
  diagnostic.expiresAt = "2026-07-15T22:30:00.000Z";
  writeFileSync(diagnosticPath, `${JSON.stringify(diagnostic, null, 2)}\n`, { mode: 0o600 });
  assert.throws(() => prepareFounderAttendedResponseContractSuccessorControl({
    artifactRoot,
    now: new Date("2026-07-15T22:02:00.000Z"),
    repositoryIdentity,
    randomBytesImpl: () => Buffer.alloc(32, 7),
    expectedUid
  }));
});

test("Overwatch rejects attempt namespace or lineage weakening", () => {
  for (const mutate of [
    value => { value.dispatchAudit.implementationOwner = "Prometheus Overwatch"; },
    value => { value.dispatchAudit.overwatchModifiedInfrastructureImplementation = true; },
    value => { value.dispatchAudit.implementationCommits[1].commit = "0".repeat(40); },
    value => { value.ownerEvidence[0].sha256AtFinalOwnerCommit = "0".repeat(64); },
    value => { value.attemptNamespace.freshExclusiveDirectoryPerDiagnostic = false; },
    value => { value.attemptNamespace.attemptReservedBeforeNetwork = false; },
    value => { value.attemptNamespace.callerChosenIdentifierAllowed = true; },
    value => { value.attemptNamespace.priorArtifactDeleteOverwriteRenameReuseOrMigrationAllowed = true; },
    value => { value.attemptNamespace.localArtifactCollisionReason = "RETRY"; },
    value => { value.lineageBoundary.lineageBindsAuthorizedCommitAndTree = false; },
    value => { value.lineageBoundary.abandonedAttemptCanBecomeEligible = true; },
    value => { value.lineageBoundary.crossAttemptSubstitutionAllowed = true; },
    value => { value.lineageBoundary.futureDatedLineageOrDiagnosticAllowed = true; },
    value => { value.lineageBoundary.exactNamePresentCanPrepare = true; },
    value => { value.lineageBoundary.expiredOrConsumedCanPrepare = true; },
    value => { value.lineageBoundary.simultaneousTimestampTieFailsClosed = false; }
  ]) {
    const changed = clone(rotationGovernance);
    mutate(changed);
    assert.equal(evaluateRotation(changed).ok, false);
  }
});

test("Overwatch rejects artifact, retry, or external-action widening", () => {
  for (const mutate of [
    value => { value.filesystemBoundary.directoryMode = "0755"; },
    value => { value.filesystemBoundary.fileMode = "0644"; },
    value => { value.filesystemBoundary.symlinksTrusted = true; },
    value => { value.filesystemBoundary.hardlinksTrusted = true; },
    value => { value.provisioningBoundary.createAttemptsMaximumPerFreshControl = 2; },
    value => { value.provisioningBoundary.automaticRetryAllowed = true; },
    value => { value.executionBoundary.cloudflareApiContacted = true; },
    value => { value.executionBoundary.realKeychainValuesReadOrWritten = true; },
    value => { value.executionBoundary.credentialCreatedDeletedStoredOrChanged = true; },
    value => { value.executionBoundary.temporaryProvisioningApiTokenChanged = true; },
    value => { value.releaseBoundary.liveGetAuthorizedByThisBatch = true; },
    value => { value.releaseBoundary.controlPreparationAuthorized = true; },
    value => { value.releaseBoundary.provisioningAuthorized = true; },
    value => { value.releaseBoundary.tokenCreationOrDeletionAuthorized = true; }
  ]) {
    const changed = clone(rotationGovernance);
    mutate(changed);
    assert.equal(evaluateRotation(changed).ok, false);
  }
});

test("Overwatch independently exercises documented, alternate, and rejected status classes", () => {
  const documented = classifyFounderAttendedCreateReceiptV2ResponseTestOnly(createResponse());
  assert.equal(documented.accepted, true);
  assert.equal(documented.httpStatusClass, "DOCUMENTED_200");

  const alternate = classifyFounderAttendedCreateReceiptV2ResponseTestOnly(
    createResponse({ status: 201 })
  );
  assert.equal(alternate.accepted, true);
  assert.equal(alternate.httpStatusClass, "ALTERNATE_2XX");

  const emptyAlternate = classifyFounderAttendedCreateReceiptV2ResponseTestOnly({
    status: 204,
    body: ""
  });
  assert.equal(emptyAlternate.accepted, false);
  assert.equal(emptyAlternate.reasonCode, "CREATE_BODY_REJECTED");
  assert.equal(emptyAlternate.httpStatusClass, "ALTERNATE_2XX");

  const rejectedBody = Buffer.from(createResponse({ status: 503 }).body, "utf8");
  const rejected = classifyFounderAttendedCreateReceiptV2ResponseTestOnly({
    status: 503,
    body: rejectedBody
  });
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.httpStatusClass, "NON_2XX");
  assert.equal(rejected.compensationCandidate, false);
  assert.equal(rejectedBody.every(value => value === 0), true);

  const missingSecret = classifyFounderAttendedCreateReceiptV2ResponseTestOnly(
    createResponse({ omit: ["client_secret"] })
  );
  assert.equal(missingSecret.accepted, false);
  assert.equal(missingSecret.reasonCode, "CREATE_CLIENT_SECRET_MISSING");
  assert.equal(missingSecret.compensationCandidate, true);

  const output = JSON.stringify([documented, alternate, rejected, missingSecret]);
  assert.doesNotMatch(output, /synthetic-overwatch-client-secret|access\.example\.com/u);
});

test("Overwatch rejects reconciliation ownership, evidence, or status weakening", () => {
  for (const mutate of [
    value => { value.dispatchAudit.implementationOwner = "Prometheus Overwatch"; },
    value => { value.dispatchAudit.overwatchModifiedInfrastructureImplementation = true; },
    value => { value.dispatchAudit.implementationCommit.commit = "0".repeat(40); },
    value => { value.ownerEvidence[0].sha256AtOwnerCommit = "0".repeat(64); },
    value => { value.observedLiveEvidence.historicalExactHttpStatusRecoverable = true; },
    value => { value.statusReconciliation.rawHttpStatusPersisted = true; },
    value => { value.statusReconciliation.bounded2xxEligibleOnlyForFurtherValidation = false; },
    value => { value.statusReconciliation.statusAloneCanReachSuccess = true; },
    value => { value.statusReconciliation.non2xxCanReachSuccess = true; },
    value => { value.statusReconciliation.successRequiresValidClientSecret = false; },
    value => { value.statusReconciliation.successRequiresExactNameProof = false; }
  ]) {
    const changed = clone(reconciliationGovernance);
    mutate(changed);
    assert.equal(evaluateReconciliation(changed).ok, false);
  }
});

test("Overwatch rejects retry, compensation, secret, or external-action widening", () => {
  for (const mutate of [
    value => { value.safetyBoundary.createAttemptsMaximumPerFreshControl = 2; },
    value => { value.safetyBoundary.automaticRetryAllowed = true; },
    value => { value.safetyBoundary.consumedOrAmbiguousControlReusable = true; },
    value => { value.safetyBoundary.keychainPairAllOrRollback = false; },
    value => { value.safetyBoundary.returnedIdAloneAuthorizesDelete = true; },
    value => { value.safetyBoundary.ambiguousMismatchedOrDuplicateProofDeleteAttempts = 1; },
    value => { value.safetyBoundary.compensationRequiresSeparateFounderAuthorization = false; },
    value => { value.safetyBoundary.unrelatedTokenDeletionAllowed = true; },
    value => { value.safetyBoundary.credentialValuesPrintedLoggedHashedMeasuredOrExposed = true; },
    value => { value.executionBoundary.cloudflareApiContacted = true; },
    value => { value.executionBoundary.realKeychainValuesReadOrWritten = true; },
    value => { value.releaseBoundary.provisioningAuthorized = true; },
    value => { value.releaseBoundary.tokenCreationOrDeletionAuthorized = true; }
  ]) {
    const changed = clone(reconciliationGovernance);
    mutate(changed);
    assert.equal(evaluateReconciliation(changed).ok, false);
  }
});

test("Overwatch rejects ownership or owner-commit substitution", () => {
  for (const mutate of [
    value => { value.dispatchAudit.implementationOwner = "Prometheus Overwatch"; },
    value => { value.dispatchAudit.verificationOwner = "Prometheus Infrastructure"; },
    value => { value.dispatchAudit.overwatchModifiedSubsystemImplementation = true; },
    value => { value.dispatchAudit.implementationCommit.commit = "0".repeat(40); },
    value => { value.ownerEvidence[0].sha256AtOwnerCommit = "0".repeat(64); }
  ]) {
    const changed = clone(governance);
    mutate(changed);
    assert.equal(evaluate(changed).ok, false);
  }
});

test("Overwatch rejects provider-contract or credential weakening", () => {
  for (const mutate of [
    value => { value.officialResponseContracts.create.httpStatus = 201; },
    value => { value.officialResponseContracts.create.nameEchoOptionalInProviderSchema = false; },
    value => { value.officialResponseContracts.create.exactRequestDuration = "1y"; },
    value => { value.officialResponseContracts.list.maximumPages = 101; },
    value => { value.officialResponseContracts.delete.responseAloneConfirmsCleanup = true; },
    value => { value.credentialBoundary.keychainPairAllOrRollback = false; },
    value => { value.credentialBoundary.valuesPrintedLoggedHashedMeasuredOrPersisted = true; }
  ]) {
    const changed = clone(governance);
    mutate(changed);
    assert.equal(evaluate(changed).ok, false);
  }
});

test("Overwatch rejects retries, ID-only deletion, or broadened compensation", () => {
  for (const mutate of [
    value => { value.createReceiptBoundary.freshAttendedGetRequired = false; },
    value => { value.createReceiptBoundary.predecessorControlOrReceiptReuseAllowed = true; },
    value => { value.createReceiptBoundary.createAttemptsMaximum = 2; },
    value => { value.createReceiptBoundary.automaticRetryAllowed = true; },
    value => { value.createReceiptBoundary.returnedIdAloneAuthorizesDelete = true; },
    value => { value.createReceiptBoundary.wrongNameOrDurationDeleteAttempts = 1; },
    value => { value.createReceiptBoundary.ambiguousMalformedMismatchedOrDuplicateProofDeleteAttempts = 1; },
    value => { value.createReceiptBoundary.compensationRequiresSeparateNativeTtyConfirmation = false; },
    value => { value.createReceiptBoundary.compensationDeleteAttemptsMaximum = 2; }
  ]) {
    const changed = clone(governance);
    mutate(changed);
    assert.equal(evaluate(changed).ok, false);
  }
});

test("Overwatch rejects reason-code or final-output widening", () => {
  const reason = clone(governance);
  reason.reasonEvidence.allowedReasonCodes.push("SECRET_DETAILS");
  assert.equal(evaluate(reason).ok, false);

  const outcome = clone(governance);
  outcome.reasonEvidence.finalCliOutcomes.push("RETRY");
  assert.equal(evaluate(outcome).ok, false);
});

test("Overwatch rejects external-action or activation claims", () => {
  for (const field of [
    "cloudflareApiContacted",
    "realKeychainValuesRead",
    "credentialCreatedDeletedStoredOrChanged",
    "realControlReceiptOrReasonEvidenceCreated",
    "temporaryProvisioningApiTokenChanged",
    "deploymentPerformed",
    "productionMutationPerformed"
  ]) {
    const changed = clone(governance);
    changed.executionBoundary[field] = true;
    assert.equal(evaluate(changed).ok, false, field);
  }
  for (const field of ["prospectiveCollection", "cohortActivation", "recommendationInfluence"]) {
    const changed = clone(governance);
    changed.executionBoundary[field] = "ON";
    assert.equal(evaluate(changed).ok, false, field);
  }
  for (const field of [
    "deploymentAuthorized",
    "liveGetAuthorizedByThisBatch",
    "controlPreparationAuthorized",
    "provisioningAuthorized"
  ]) {
    const changed = clone(governance);
    changed.releaseBoundary[field] = true;
    assert.equal(evaluate(changed).ok, false, field);
  }
});
