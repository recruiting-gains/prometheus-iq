import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

import { verifyCrossSubsystemArtifactContracts } from "./verify-cross-subsystem-artifact-contracts.mjs";
import { verifyReleaseProvenanceRepair } from "./verify-release-provenance-repair.mjs";
import { verifyShadowDecisionReadiness } from "./verify-shadow-decision-readiness.mjs";

const batchId = "BATCH-20260713-004";
const baseCommit = "4411763be449e171674f2952d558153773cd0845";
const reportPath = "overwatch/reports/BATCH-20260713-004-route-iq-prospective-shadow-runtime.json";
const dataContractPath = "overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json";
const intelligenceContractPath = "intelligence/contracts/shadow-decision-readiness-contracts.json";
const dashboardPath = "index.html";
const dashboardDeployPath = "deploy/cloudflare-pages/index.html";
const wranglerPath = "wrangler.jsonc";

const read = path => fs.readFileSync(path, "utf8");
const readJson = path => JSON.parse(read(path));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

const expectedOwnerCommits = {
  "Prometheus Data": [
    "7970f240d881fb52f964a7a89bf7e0336edfb25c",
    "968212e235ee1701b0a0fc21499b831de565f669",
    "ce9f642c88921a2d0779f1b90323985c53fb371e",
    "88b8490cb96c7065623e2e23b924c261828165ea",
    "89e9ae46d1605c7d054f0b3332e816abdc266aef",
    "9b53a213e7e070e60c8ccadf27f164d83ad932d1",
    "b7896a68830f42232ccc5861bb61742cf375c3d9",
    "f4ecc7e83fae547fa7cfca6857f4f6f08d14006b",
    "8dbf0bc98b1a2218322f8d33381477455e33f36a",
    "e47a5253cc3cadd0252894fa31278409b7fa73cb",
    "b388849c21051262e0f80e4c24875147cf9889dd",
    "84319f9c70004edd50e1531e48ea1d0d7b501089",
    "00a7e68251ac597f40e35bcfcff942d3e4648a65",
    "704537ded300cb674e53c047859eda19525a168d"
  ],
  "Prometheus Infrastructure": [
    "628d8462fc209585dfa0a261e29f393e626a2d92",
    "d89b4df27fe6e5e4b714f647eb09eeaf73c1755c",
    "31be4c6a8b4e2091ac64dab05375256db4e28159",
    "1db9a8ee1220430e1053dde34d8cf7a1d9f82426",
    "74e53f378bc1cbd9fea3891cb90c5d20f2d8eb6f",
    "509a7bc0d3b4d2911d6b6b189985cccfa2536241"
  ],
  "Prometheus Intelligence Engine": [
    "4e666673415d69d075f0ae15a5b7987dc7061dac",
    "fd0f306387664e8cd3cb1d957b81d3d7dda5dc8e",
    "cd0a504328b0870aa695731230e6c43dd4698e3c",
    "ed46fb0964187a207468cd89fbdc1fbbb8426748"
  ],
  "Prometheus Dashboard": ["6c7671cb3f9387fdac29961432412dfe70088b2e"]
};

const requiredAcceptanceGates = [
  "ownership",
  "architecture",
  "zeroInfluence",
  "preActionIntegrity",
  "completeness",
  "idempotency",
  "deterministicReplay",
  "actionAndOutcomeIntegrity",
  "failureIsolation",
  "killSwitch",
  "privacyAndIsolation",
  "canonicality",
  "compatibility",
  "readiness",
  "deploymentBoundary",
  "recommendationBoundary"
];

function commitExists(commit) {
  return git("cat-file", "-t", commit) === "commit";
}

export function verifyOverwatchRouteIqProspectiveRuntimeGate() {
  const report = readJson(reportPath);
  const dataContract = readJson(dataContractPath);
  const intelligenceContract = readJson(intelligenceContractPath);
  const wrangler = read(wranglerPath);
  const dashboard = read(dashboardPath);
  const dashboardDeploy = read(dashboardDeployPath);
  const contracts = verifyCrossSubsystemArtifactContracts();
  const provenance = verifyReleaseProvenanceRepair();
  const readiness = verifyShadowDecisionReadiness({ write: false });

  assert.equal(contracts.ok, true, contracts.failures.join("\n"));
  assert.equal(provenance.status, "PASS");
  assert.equal(readiness.status, "passed");
  assert.equal(report.batchId, batchId);
  assert.equal(report.dispatchAudit.ownershipRespected, true);
  assert.equal(report.dispatchAudit.overwatchModifiedSubsystemImplementation, false);
  assert.equal(report.dispatchAudit.verificationOwner, "Prometheus Overwatch");

  const reportedSubsystems = new Map(report.dispatchAudit.subsystems.map(record => [record.subsystem, record]));
  for (const [owner, commits] of Object.entries(expectedOwnerCommits)) {
    const record = reportedSubsystems.get(owner);
    assert.ok(record, `Missing owner dispatch record for ${owner}.`);
    assert.equal(record.implementationOwner, owner);
    assert.deepEqual(record.commits, commits);
    assert.ok(record.files.length > 0, `${owner} must report changed files.`);
    for (const commit of commits) {
      assert.equal(commitExists(commit), true, `Missing owner commit ${commit}.`);
      assert.equal(git("merge-base", "--is-ancestor", baseCommit, commit), "");
    }
  }

  const ownerCommits = Object.values(expectedOwnerCommits).flat();
  assert.equal(new Set(ownerCommits).size, ownerCommits.length);
  assert.equal(report.dispatchAudit.subsystems.reduce((sum, record) => sum + record.commits.length, 0), 25);

  assert.deepEqual(Object.keys(report.acceptanceGates), requiredAcceptanceGates);
  for (const [gate, status] of Object.entries(report.acceptanceGates)) {
    assert.match(status, /^PASS/, `${gate} must pass.`);
  }
  assert.equal(report.adversarialCoverage.status, "PASS");
  assert.ok(report.adversarialCoverage.cases.length >= 16);

  const lifecycle = dataContract.prospectiveShadowEvidenceLifecycleContract;
  assert.equal(lifecycle.batchId, batchId);
  assert.equal(lifecycle.status, "source_complete_deployable_runtime_inactive");
  assert.equal(lifecycle.storage.authoritativeTechnology, "cloudflare_sqlite_backed_durable_object");
  assert.equal(lifecycle.storage.coordinatorScope, "authenticated workspace + operating profile + representative");
  assert.equal(lifecycle.storage.productionDurableObjectBindingActivated, false);
  assert.equal(lifecycle.storage.productionDurableObjectResourceActivated, false);
  assert.equal(lifecycle.storage.productionMigrationApplied, false);
  assert.equal(lifecycle.authorityBoundary.callerRoutingIdentifiersAllowed, false);
  assert.equal(lifecycle.authorityBoundary.unkeyedDigestAcceptedAsAuthentication, false);
  assert.equal(lifecycle.privacyAllowlist.piiAllowed, false);
  assert.equal(lifecycle.privacyAllowlist.rawOrFreeFormNotesAllowed, false);
  assert.equal(lifecycle.decisionSourcePolicy.snapshotAllowed, false);
  assert.equal(lifecycle.decisionSourcePolicy.scoreable, false);
  assert.equal(lifecycle.retentionAndCollection.productionCollectionActivated, false);
  assert.equal(lifecycle.retentionAndCollection.productionEvidenceRecords, 0);
  assert.equal(lifecycle.activation.productionConsumerActivated, false);
  assert.equal(lifecycle.activation.recommendationInfluenceState, "OFF");
  assert.equal(lifecycle.activation.routeScoringMutationAllowed, false);
  assert.equal(lifecycle.activation.routeGenerationMutationAllowed, false);
  assert.equal(lifecycle.activation.representativeBehaviorInfluenceAllowed, false);

  assert.equal(intelligenceContract.prospectiveRuntimeAdapter.currentState.productionConsumerActive, false);
  assert.equal(intelligenceContract.prospectiveRuntimeAdapter.currentState.productionDeploymentActive, false);
  assert.equal(intelligenceContract.prospectiveRuntimeAdapter.currentState.collectionActivation, "OFF");
  assert.equal(intelligenceContract.prospectiveRuntimeAdapter.currentState.recommendationInfluence, "OFF");
  assert.equal(intelligenceContract.prospectiveRuntimeAdapter.readModel.representativeReadable, false);
  assert.equal(intelligenceContract.prospectiveRuntimeAdapter.readModel.browserStorageAllowed, false);
  assert.equal(intelligenceContract.committedOutcomeEvaluation.evaluation.canonicalProductionEvaluations, 0);
  assert.equal(intelligenceContract.validationFixturePolicy.canonicalReadinessContributionAllowed, false);

  assert.equal(dashboard, dashboardDeploy);
  assert.match(dashboard, /next_stop_requested/);
  assert.match(dashboard, /representative_action_observed/);
  assert.doesNotMatch(dashboard, /representative_outcome_observed/);
  assert.match(wrangler, /"name": "ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR"/);
  assert.match(wrangler, /"class_name": "RouteIqProspectiveShadowCoordinator"/);
  assert.match(wrangler, /"tag": "route-iq-prospective-shadow-sqlite-v1"/);
  assert.doesNotMatch(wrangler, /"ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION"\s*:/);

  assert.equal(report.currentState.readiness, "INSUFFICIENT_EVIDENCE");
  assert.equal(report.currentState.collection, "OFF");
  assert.equal(report.currentState.productionProspectiveRecords, 0);
  assert.equal(report.currentState.productionEvaluations, 0);
  assert.equal(report.currentState.recommendationInfluence, "OFF");
  assert.equal(report.currentState.representativeShadowOutput, false);
  assert.equal(report.currentState.productionDataMutated, false);
  assert.equal(report.operatingCost.currentIncrementalMonthlyCostUsd, 0);
  assert.equal(report.rollback.dataDeletionAutomatic, false);
  assert.equal(report.rollback.migrationHistoryRewriteAllowed, false);
  assert.equal(report.release.deploymentAuthorized, false);
  assert.equal(report.release.deploymentRecommendation, "ELIGIBLE_FOR_FOUNDER_DEPLOYMENT_REVIEW");

  return {
    status: "PASS",
    batchId,
    ownerCommits: ownerCommits.length,
    acceptanceGates: requiredAcceptanceGates.length,
    collection: "OFF",
    productionEvidence: 0,
    readiness: "INSUFFICIENT_EVIDENCE",
    recommendationInfluence: "OFF",
    deploymentAuthorized: false
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log(JSON.stringify(verifyOverwatchRouteIqProspectiveRuntimeGate(), null, 2));
}
