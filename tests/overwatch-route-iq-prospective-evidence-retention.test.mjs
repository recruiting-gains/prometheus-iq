import assert from "node:assert/strict";
import test from "node:test";

import { verifyOverwatchRouteIqProspectiveEvidenceRetention } from "../scripts/verify-overwatch-route-iq-prospective-evidence-retention.mjs";

test("Overwatch independently verifies the Founder retention boundary and held activation state", async () => {
  assert.deepEqual(await verifyOverwatchRouteIqProspectiveEvidenceRetention(), {
    status: "PASS",
    batchId: "BATCH-20260714-004",
    ownerCommitCount: 4,
    maximumRetentionCalendarMonths: 18,
    customerOverride: "SHORTEN_ONLY",
    legalHold: "LOCAL_AUTHENTICATED_APPEND_ONLY_RUNTIME_NOT_DEPLOYED",
    physicalDeletion: "NOT_IMPLEMENTED_NOT_ACTIVATED",
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
