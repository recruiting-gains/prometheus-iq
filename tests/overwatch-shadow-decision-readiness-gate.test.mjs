import assert from "node:assert/strict";
import test from "node:test";

import { verifyOverwatchShadowDecisionReadinessGate } from "../scripts/verify-overwatch-shadow-decision-readiness-gate.mjs";

test("Overwatch independently gates Route IQ shadow decision readiness", () => {
  assert.deepEqual(verifyOverwatchShadowDecisionReadinessGate(), {
    status: "PASS",
    batchId: "BATCH-20260713-001",
    currentReadinessState: "INSUFFICIENT_EVIDENCE",
    opportunities: 4,
    shadows: 0,
    exclusions: 4,
    requiredSample: 97,
    recommendationInfluence: "OFF",
    contractArtifacts: 24
  });
});
