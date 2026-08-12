import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  verifyOverwatchRouteIqGovernedLearningAdvisoryBridge
} from "../scripts/verify-overwatch-route-iq-governed-multi-session-learning-dashboard-advisory-bridge-v1.mjs";

const governance = () => JSON.parse(readFileSync(
  "overwatch/governance/route-iq-governed-multi-session-learning-dashboard-advisory-bridge-v1.json",
  "utf8"
));

test("Overwatch verifies the owner chain, canonical artifact, and protected state", () => {
  assert.deepEqual(verifyOverwatchRouteIqGovernedLearningAdvisoryBridge(), {
    status: "PASS",
    batchId: "BATCH-20260812-001",
    ownerCommitCount: 12,
    artifactId: "riq_governed_learning_86f0ff03747d330844473091f46cc05350a1e0ed0b262430e23caaa0ed229a56",
    artifactSha256: "86f0ff03747d330844473091f46cc05350a1e0ed0b262430e23caaa0ed229a56",
    manifestSha256: "2371fa77495dcaef65c5bccbb751b4fb6b5c27f61e984f1e54eefabf951ee943",
    sessions: 1,
    visits: 4,
    truthState: "INSUFFICIENT_EVIDENCE",
    founderOnly: true,
    publicWorkerExposure: false,
    historicalEvidence: "UNCHANGED",
    deploymentPerformed: false,
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF"
  });
});

test("release remains source-only, advisory-only, and separately deployment gated", () => {
  const record = governance();
  assert.equal(record.delivery.target, "private_prometheus_iq_source_only");
  assert.equal(record.delivery.founderOnly, true);
  assert.equal(record.delivery.callerSelectedAuthorityAllowed, false);
  assert.equal(record.delivery.browserPersistenceWrites, 0);
  assert.equal(record.delivery.publicWorkerExposure, false);
  assert.equal(record.delivery.deploymentAuthorized, false);
  assert.equal(record.release.productionMutationAuthorized, false);
  assert.equal(record.release.nextDecision,
    "separate_founder_authorized_private_worker_release_review");
});

test("route behavior and historical archives are explicitly outside the batch", () => {
  const record = governance();
  assert.deepEqual(record.unchangedBehaviorPaths, [
    "intelligence/continuous-adaptive-route-replenishment.mjs",
    "intelligence/route-business-hours-eligibility.mjs",
    "intelligence/recommendation-explainability-engine.mjs",
    "scripts/lib/route-intelligence-quality-gate.mjs"
  ]);
  assert.equal(record.historicalEvidence.changed, false);
  assert.equal(record.historicalEvidence.archivesRewritten, false);
  assert.equal(record.protectedState.confidencePropagation, "OFF");
  assert.equal(record.protectedState.representativeShadowOutputExposed, false);
});
