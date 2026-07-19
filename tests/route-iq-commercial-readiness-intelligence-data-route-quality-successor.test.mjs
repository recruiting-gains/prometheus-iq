import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const json = (path) => JSON.parse(read(path).toString("utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const provenancePath =
  "intelligence/provenance/protected-baseline-synchronization-batch-20260719-002-data-route-quality-successor-v1.json";
const predecessorPath =
  "intelligence/provenance/protected-baseline-synchronization-batch-20260718-002-data-route-quality-successor-v1.json";
const gatePath = "scripts/lib/route-intelligence-quality-gate.mjs";
const reportPath =
  "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/route-intelligence-golden-route-quality-report.json";
const contractPath =
  "intelligence/contracts/shadow-decision-readiness-contracts.json";
const publicClaimsPath =
  "intelligence/contracts/route-iq-public-intelligence-claims-v1.json";

const provenance = json(provenancePath);
const contract = json(contractPath);
const publicClaims = json(publicClaimsPath);
const report = json(reportPath);

test("Data route-quality successor is mapped by exact owner evidence", () => {
  assert.equal(provenance.batchId, "BATCH-20260719-002");
  assert.equal(provenance.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(provenance.status, "OWNER_REVIEWED_AND_SYNCHRONIZED");
  assert.equal(
    provenance.dataOwnerTransition.commit,
    "330752fb53c9466f6bc0339d771b2f2facbc2351",
  );
  assert.equal(
    provenance.dataOwnerTransition.tree,
    "e1fd5b3e8b1d9ecf37552b3ffb6389755dbdd9d9",
  );
  assert.equal(provenance.dataOwnerTransition.ownerSubsystem, "Prometheus Data");
  assert.deepEqual(provenance.dataOwnerTransition.changedPaths, [
    reportPath,
    gatePath,
    "tests/route-intelligence-quality-gate.test.mjs",
  ]);
  assert.equal(
    sha256(read(gatePath)),
    provenance.dataOwnerTransition.routeQualityGate.currentSha256,
  );
  assert.equal(
    sha256(read(reportPath)),
    provenance.dataOwnerTransition.canonicalRouteQualityReport.currentSha256,
  );
  assert.equal(
    sha256(read("tests/route-intelligence-quality-gate.test.mjs")),
    provenance.dataOwnerTransition.routeQualityRegression.currentSha256,
  );
});

test("shadow readiness protects the Data successor and preserves its predecessor", () => {
  const baseline = contract.protectedBehaviorBaselines.routeQualityGate;
  assert.equal(contract.artifacts.routeQualityDataSuccessor, provenancePath);
  assert.equal(baseline.provenanceSuccessor, provenancePath);
  assert.equal(baseline.sha256, sha256(read(gatePath)));
  assert.equal(baseline.sourceCommit, provenance.dataOwnerTransition.commit);
  assert.equal(baseline.sourceOwnerSubsystem, "Prometheus Data");
  assert.equal(
    baseline.predecessor.sha256,
    provenance.dataOwnerTransition.routeQualityGate.previousSha256,
  );
  assert.equal(baseline.predecessor.remainsHistorical, true);
  assert.equal(baseline.predecessor.rewritten, false);
  assert.equal(
    sha256(read(predecessorPath)),
    provenance.predecessor.sha256,
  );
  assert.equal(
    sha256(read(contractPath)),
    provenance.protectedReferenceAudit.affectedIntelligenceReferences[0]
      .currentConsumerSha256,
  );
});

test("public Intelligence claims consume the synchronized shadow contract without semantic broadening", () => {
  const shadowEvidence = publicClaims.canonicalEvidence.find(
    (entry) => entry.path === contractPath,
  );
  const affectedReference =
    provenance.protectedReferenceAudit.affectedIntelligenceReferences[1];
  assert.ok(shadowEvidence);
  assert.equal(shadowEvidence.sha256, sha256(read(contractPath)));
  assert.equal(affectedReference.consumerPath, publicClaimsPath);
  assert.equal(affectedReference.currentConsumerSha256, sha256(read(publicClaimsPath)));
  assert.equal(affectedReference.currentProtectedSha256, shadowEvidence.sha256);
  assert.equal(publicClaims.currentGovernedState.shadowReadiness, "INSUFFICIENT_EVIDENCE");
  assert.equal(publicClaims.currentGovernedState.recommendationInfluence, "OFF");
  assert.equal(publicClaims.currentGovernedState.prospectiveCollection, "OFF");
  assert.equal(publicClaims.safety.routeOrderingChanged, false);
  assert.equal(publicClaims.safety.routeScoringChanged, false);
  assert.equal(publicClaims.safety.representativeWorkflowChanged, false);
  assert.equal(provenance.reviewedInvariants.publicClaimSemanticsChanged, false);
  assert.equal(provenance.downstreamOwnerHandoff.required, true);
  assert.equal(provenance.downstreamOwnerHandoff.ownerSubsystem, "Prometheus Data");
  assert.equal(provenance.downstreamOwnerHandoff.modifiedByIntelligence, false);
});

test("canonical Data report preserves route, queue, scoring, and zero-Google invariants", () => {
  assert.equal(report.status, "passed");
  assert.equal(report.dataset.activePoolRecords, 297);
  assert.equal(report.dataset.expandedDashboardRouteRecords, 594);
  assert.equal(report.routeStability.status, "passed");
  assert.equal(report.orderingConsistency.status, "passed");
  assert.equal(report.governanceReuse.runtimeBehaviorChanged, false);
  assert.equal(report.governanceReuse.scoringChanged, false);
  assert.equal(report.businessHoursEligibility.queueValidation.initialStopCount, 15);
  assert.equal(
    report.businessHoursEligibility.queueValidation.replenishedStopCount,
    15,
  );
  assert.equal(
    report.businessHoursEligibility.queueValidation.routeScoresUnchanged,
    true,
  );
  assert.deepEqual(report.runtimeSurface, {
    status: "passed",
    checkedRuntimeFiles: 33,
    expectedRuntimeFiles: 33,
    dashboardFetches: 10,
    deployDashboardFetches: 10,
    expectedDashboardFetches: 10,
    sourceDeployFetchParity: true,
    liveGoogleApiCalls: 0,
  });
  assert.equal(report.zeroLiveGoogle.evidence.live_google_api_calls, 0);
});

test("successor synchronization cannot activate Intelligence or rewrite history", () => {
  assert.equal(contract.implementationDispatch.recommendationInfluence, "OFF");
  assert.equal(provenance.reviewedInvariants.routeOrderingChanged, false);
  assert.equal(provenance.reviewedInvariants.routeMembershipChanged, false);
  assert.equal(provenance.reviewedInvariants.routeScoringChanged, false);
  assert.equal(provenance.boundaries.recommendationInfluence, "OFF");
  assert.equal(provenance.boundaries.readinessState, "INSUFFICIENT_EVIDENCE");
  assert.equal(provenance.boundaries.representativeShadowOutputExposed, false);
  assert.equal(provenance.boundaries.historicalBaselineRewritten, false);
  assert.equal(provenance.boundaries.deploymentPerformed, false);
  assert.equal(provenance.boundaries.productionMutationPerformed, false);
});
