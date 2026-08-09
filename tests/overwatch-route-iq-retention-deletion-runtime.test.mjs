import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isExactMainCheckout,
  verifyOverwatchRouteIqRetentionDeletionRuntime
} from "../scripts/verify-overwatch-route-iq-retention-deletion-runtime.mjs";

const governance = () => JSON.parse(readFileSync(
  "overwatch/governance/route-iq-retention-expiry-deletion-runtime-v1.json",
  "utf8"
));

test("Overwatch verifies the exact owner chain and dormant deletion release boundary", () => {
  assert.deepEqual(verifyOverwatchRouteIqRetentionDeletionRuntime(), {
    status: "PASS",
    batchId: "BATCH-20260809-001",
    ownerCommitCount: 12,
    sourceRuntime: "COMPLETE_DORMANT",
    physicalDeletionActivated: false,
    productionStorageAccessed: false,
    productionDeletionPerformed: false,
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    historicalEvidence: "UNCHANGED",
    forwardRevert: "VERIFIED_NOT_EXECUTED"
  });
});

test("governance keeps production activation and deletion behind separate Founder boundaries", () => {
  const record = governance();
  assert.equal(record.status, "SOURCE_COMPLETE_DORMANT_DEPLOYMENT_HELD");
  assert.equal(record.infrastructureBoundary.productionBindingConfigured, false);
  assert.equal(record.infrastructureBoundary.deploymentAuthorized, false);
  assert.equal(record.protectedState.productionStorageAccessPerformed, false);
  assert.equal(record.protectedState.productionDeletionPerformed, false);
  assert.equal(record.activationDecision.prospectiveCollectionMayActivate, false);
  assert.equal(record.remainingBlockers.includes("separate_founder_deployment_authorization_required"), true);
  assert.equal(record.remainingBlockers.includes("separate_exact_production_deletion_authorization_required"), true);
});

test("the governed deletion graph is manifest-derived and fail closed", () => {
  const graph = governance().canonicalDeletionGraph;
  assert.equal(graph.authority, "field_session_commit_manifest_plus_stored_relationships");
  assert.equal(graph.prefixScanIsDeletionAuthority, false);
  assert.equal(graph.prefixScanUsedOnlyForUnknownArtifactDetection, true);
  assert.equal(graph.unknownOrphanedCrossScopeCorruptOrUnmanifestedFailsClosed, true);
  assert.equal(graph.coordinatorRepositorySetHashBound, true);
  assert.equal(graph.fieldSessionArtifacts.includes("every_commit_named_session_history_entry"), true);
  assert.equal(graph.coordinatorTables.includes("field_session_evaluation_contexts"), true);
  assert.equal(graph.coordinatorTables.includes("opportunities"), true);
});

test("hosted detached checkout is accepted only for the exact synchronized main identity", () => {
  const head = "a".repeat(40);
  const hostedMain = {
    GITHUB_ACTIONS: "true",
    GITHUB_REF: "refs/heads/main",
    GITHUB_REF_NAME: "main",
    GITHUB_REF_TYPE: "branch",
    GITHUB_SHA: head
  };
  assert.equal(isExactMainCheckout({ branch: "main", head, originMain: head }), true);
  assert.equal(isExactMainCheckout({
    branch: "",
    head,
    originMain: head,
    environment: hostedMain
  }), true);
  for (const [field, value] of [
    ["GITHUB_ACTIONS", "false"],
    ["GITHUB_REF", "refs/heads/release"],
    ["GITHUB_REF_NAME", "release"],
    ["GITHUB_REF_TYPE", "tag"],
    ["GITHUB_SHA", "b".repeat(40)]
  ]) {
    assert.equal(isExactMainCheckout({
      branch: "",
      head,
      originMain: head,
      environment: { ...hostedMain, [field]: value }
    }), false, `${field} drift must fail closed.`);
  }
  assert.equal(isExactMainCheckout({
    branch: "",
    head,
    originMain: "b".repeat(40),
    environment: hostedMain
  }), false);
  assert.equal(isExactMainCheckout({ branch: "release", head, originMain: head }), false);
});
