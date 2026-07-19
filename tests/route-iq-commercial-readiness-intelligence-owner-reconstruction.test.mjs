import assert from "node:assert/strict";
import test from "node:test";
import {
  evidencePath,
  legacyCommit,
  verifyRouteIqCommercialReadinessFounderSnapshotOwnerReconstruction
} from "../intelligence/provenance/verify-route-iq-commercial-readiness-founder-snapshot-owner-reconstruction-v1.mjs";

test("Intelligence independently reconstructs and adopts the contaminated Founder snapshot commit", () => {
  const result = verifyRouteIqCommercialReadinessFounderSnapshotOwnerReconstruction();
  assert.equal(result.status, "passed");
  assert.equal(result.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(result.legacyCommit, legacyCommit);
  assert.equal(result.classification, "DISCLOSED_LOCAL_AUTHOR_IDENTITY_CONTAMINATION");
  assert.equal(result.affectedPathCount, 7);
  assert.equal(result.comparisonResult, "IDENTICAL");
  assert.equal(result.correctionRequired, false);
  assert.equal(result.snapshotSha256, "52465677d4f833cf30d0fd1353c070535e3b292637751010e8711ab02a4f6f1d");
  assert.equal(result.artifactFileSha256, "6e7ec5a0ef785aa421410bd68db0581d9b962a89d80478fa0827632c27fab706");
  assert.equal(result.recommendationInfluence, "OFF");
  assert.equal(result.comparisons.every(entry => entry.result === "IDENTICAL"), true);
});

test("tracked owner evidence remains non-self-referential at the predictable Intelligence path", () => {
  assert.equal(
    evidencePath,
    "intelligence/provenance/route-iq-commercial-readiness-founder-snapshot-owner-reconstruction-v1.json"
  );
  const result = verifyRouteIqCommercialReadinessFounderSnapshotOwnerReconstruction();
  assert.equal(result.correctionRequired, false);
});
