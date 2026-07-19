import assert from "node:assert/strict";
import test from "node:test";

import { verifyOverwatchRouteIqCommercialReadiness } from "../scripts/verify-overwatch-route-iq-commercial-readiness.mjs";

test("Overwatch independently verifies all Route IQ commercial-readiness gates", async () => {
  const result = await verifyOverwatchRouteIqCommercialReadiness({ requireClean: false });
  assert.equal(result.status, "PASS");
  assert.equal(result.batchId, "BATCH-20260718-002");
  assert.equal(result.acceptanceGates, 15);
  assert.equal(result.configuredSyntheticBusiness, "summit_roofing_synthetic");
  assert.equal(result.preservedEvidenceFiles, 9);
  assert.equal(result.capacity.verifiedSafeInitialCapacity.workspaceCount, 10);
  assert.equal(result.capacity.verifiedSafeInitialCapacity.totalUsers, 100);
  assert.equal(result.capacity.verifiedSafeInitialCapacity.concurrentUsers, 25);
  assert.equal(result.capacity.recordIntegrity.lostAcceptedRecords, 0);
  assert.equal(result.capacity.recordIntegrity.duplicateAcceptedRecords, 0);
  assert.equal(result.capacity.isolation.crossWorkspaceExposure, 0);
  assert.equal(result.capacity.isolation.crossUserExposure, 0);
  assert.equal(result.readiness, "INSUFFICIENT_EVIDENCE");
  assert.equal(result.prospectiveCollection, "OFF");
  assert.equal(result.activeCohorts, 0);
  assert.equal(result.recommendationInfluence, "OFF");
  assert.equal(result.deploymentPerformed, false);
  assert.equal(result.ownershipRepairCommit, "a8068271e110f3b260624c3df6a3b39054421123");
  assert.match(result.ownershipMetadataRepairCommit, /^[a-f0-9]{40}$/u);
});
