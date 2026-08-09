import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  validateFieldSessionArchiveIdentitySuccessor,
  verifyOverwatchRouteIqProspectiveEvidenceRetention
} from "../scripts/verify-overwatch-route-iq-prospective-evidence-retention.mjs";

const retentionGovernance = () => JSON.parse(readFileSync(
  new URL("../overwatch/governance/route-iq-prospective-evidence-retention-v1.json", import.meta.url),
  "utf8"
));
const liveIdentity = () => JSON.parse(readFileSync(
  new URL("../overwatch/governance/live-canonical-identity-migration-v1.json", import.meta.url),
  "utf8"
));
const reportTypeRepair = () => JSON.parse(readFileSync(
  new URL("../overwatch/governance/field-session-report-type-contract-drift-repair-v1.json", import.meta.url),
  "utf8"
));

test("Overwatch independently verifies the Founder retention boundary and held activation state", async () => {
  assert.deepEqual(await verifyOverwatchRouteIqProspectiveEvidenceRetention(), {
    status: "PASS",
    batchId: "BATCH-20260714-004",
    ownerCommitCount: 5,
    maximumRetentionCalendarMonths: 18,
    customerOverride: "SHORTEN_ONLY",
    legalHold: "LOCAL_AUTHENTICATED_APPEND_ONLY_RUNTIME_NOT_DEPLOYED",
    physicalDeletion: "SOURCE_COMPLETE_DORMANT_NOT_DEPLOYED",
    aggregateRetention: "DATA_ATTESTED_DEIDENTIFIED_ONLY",
    accidentalArchiveRecords: 7,
    dispositionReceiptVerified: true,
    aggregateArtifactVerified: true,
    productionAccessUsed: false,
    deploymentAuthorized: false,
    activationReadiness: "HOLD_NOT_ACTIVATION_READY",
    readiness: "INSUFFICIENT_EVIDENCE",
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF"
  });
});

test("retention governance admits only the exact Intelligence Worker-safe successor", () => {
  const admission = retentionGovernance().intelligenceAdmission;
  assert.equal(admission.runtimeSha256, "9d2ef3b3ff4a440432ab31af041aa3c19e55c384ac788c2a4e0c7db7452bfcda");
  assert.equal(admission.previousRuntimeSha256, "eea1a1f1e9a6fde8fdc8c9fe1e5606a240bbe97ac533ece88342cf7555787780");
  assert.equal(admission.runtimeSuccessorOwnerCommit, "f0593640bae9cb9517d954415ca4980226a51073");
  assert.equal(admission.runtimeSuccessorOwner, "Prometheus Intelligence");
  assert.equal(
    admission.runtimeSuccessorClassification,
    "WORKER_SAFE_STATIC_POLICY_IMPORT_WITH_UNCHANGED_GOVERNED_POLICY_HASH"
  );
});

test("retention preserves its historical archive checkpoint through the exact identity successor", () => {
  const identity = liveIdentity();
  const repair = reportTypeRepair();
  const identitySuccessor = identity.dataCompatibility.fieldSessionArchiveIdentitySuccessor;
  const reportTypeSuccessor = repair.retentionCompatibility;
  assert.equal(validateFieldSessionArchiveIdentitySuccessor({
    liveIdentity: identity,
    reportTypeRepair: repair,
    historicalArchiveSha256: identitySuccessor.previousSha256,
    currentArchiveSha256: reportTypeSuccessor.currentSha256
  }).reportTypeSuccessor, reportTypeSuccessor);

  for (const [mutateIdentity, mutateRepair] of [
    [value => { value.currentSha256 = "0".repeat(64); }, () => {}],
    [() => {}, value => { value.currentSha256 = "0".repeat(64); }],
    [() => {}, value => { value.retentionSemanticsChanged = true; }],
    [() => {}, value => { value.storageSchemaChanged = true; }]
  ]) {
    const changed = structuredClone(identity);
    const changedRepair = structuredClone(repair);
    mutateIdentity(changed.dataCompatibility.fieldSessionArchiveIdentitySuccessor);
    mutateRepair(changedRepair.retentionCompatibility);
    assert.throws(() => validateFieldSessionArchiveIdentitySuccessor({
      liveIdentity: changed,
      reportTypeRepair: changedRepair,
      historicalArchiveSha256: identitySuccessor.previousSha256,
      currentArchiveSha256: reportTypeSuccessor.currentSha256
    }));
  }
});
