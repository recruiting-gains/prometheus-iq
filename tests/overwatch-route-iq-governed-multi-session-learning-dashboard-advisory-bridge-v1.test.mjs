import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalGitHubRepositoryIdentity,
  isGovernedMainCheckout,
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
    ownerCommitCount: 15,
    artifactId: "riq_governed_learning_e2113e2c7290546d0bd1b637902abe38a12b3672e369a3bf01ffdbdec6d82e2f",
    artifactSha256: "e2113e2c7290546d0bd1b637902abe38a12b3672e369a3bf01ffdbdec6d82e2f",
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
    recommendationInfluence: "OFF",
    semanticIntegrityBatchId: "BATCH-20260813-001",
    successfulRelationships: 3,
    followUpRelationships: 0,
    reviewRequiredOutcomes: 1
  });
});

test("main checkout accepts local main or exact hosted detached main only", () => {
  const head = "a".repeat(40);
  const hosted = {
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: "PrometheusRouteIQ/prometheus-iq",
    GITHUB_REF: "refs/heads/main",
    GITHUB_REF_NAME: "main",
    GITHUB_REF_TYPE: "branch",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_SHA: head
  };
  assert.equal(isGovernedMainCheckout({
    branch: "main",
    head,
    originMain: "b".repeat(40)
  }), true);
  assert.equal(isGovernedMainCheckout({
    branch: "HEAD",
    head,
    originMain: head,
    environment: hosted
  }), true);
  for (const [field, value] of [
    ["branch", "release"],
    ["originMain", "b".repeat(40)],
    ["GITHUB_REPOSITORY", "PrometheusRouteIQ/other"],
    ["GITHUB_REF", "refs/heads/release"],
    ["GITHUB_SHA", "b".repeat(40)]
  ]) {
    const input = {
      branch: "HEAD",
      head,
      originMain: head,
      environment: { ...hosted }
    };
    if (field in input) input[field] = value;
    else input.environment[field] = value;
    assert.equal(isGovernedMainCheckout(input), false, field);
  }
});

test("repository identity accepts governed GitHub transports and rejects ambiguous remotes", () => {
  const expected = "prometheusrouteiq/prometheus-iq";
  for (const remote of [
    "git@github.com:PrometheusRouteIQ/prometheus-iq.git",
    "ssh://git@github.com/PrometheusRouteIQ/prometheus-iq.git",
    "https://github.com/PrometheusRouteIQ/prometheus-iq",
    "https://github.com/PrometheusRouteIQ/prometheus-iq.git/"
  ]) {
    assert.equal(canonicalGitHubRepositoryIdentity(remote), expected);
  }
  assert.notEqual(
    canonicalGitHubRepositoryIdentity("https://github.com/PrometheusRouteIQ/other"),
    expected
  );
  for (const remote of [
    "https://example.com/PrometheusRouteIQ/prometheus-iq",
    "https://github.com/PrometheusRouteIQ/prometheus-iq/extra",
    "https://github.com/PrometheusRouteIQ/prometheus-iq?ref=main",
    ""
  ]) {
    assert.equal(canonicalGitHubRepositoryIdentity(remote), null);
  }
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
    "Route IQ Prospective Calibration Production Admission + Future-Window Readiness v1");
});

test("semantic successor preserves review-required evidence and exact profile authority", () => {
  const record = governance();
  assert.equal(record.semanticIntegritySuccessor.batchId, "BATCH-20260813-001");
  assert.equal(record.semanticIntegritySuccessor.zeroPositiveLeakageFromReviewRequiredEvidence, true);
  assert.equal(record.semanticIntegritySuccessor.fitnessNoContactSuccessful, false);
  assert.equal(record.semanticIntegritySuccessor.fitnessMembershipRelationship, "Successful");
  assert.equal(record.semanticIntegritySuccessor.relationshipAuthority,
    "active_operating_profile.successEvents");
  assert.equal(record.semanticIntegritySuccessor.truthState, "INSUFFICIENT_EVIDENCE");
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
