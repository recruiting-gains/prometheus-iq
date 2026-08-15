import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  validateDormantRetentionMaintenanceReadiness,
  verifyRetentionMaintenancePublicRollbackSuccessor,
  verifyOverwatchRouteIqRetentionMaintenanceDeploymentReadiness
} from "../scripts/verify-overwatch-route-iq-retention-maintenance-deployment-readiness.mjs";
import {
  PUBLIC_FORWARD_ROLLBACK_BUILD_SOURCE
} from "../scripts/lib/route-iq-public-forward-rollback.mjs";
import {
  dryRunRouteIqRetentionMaintenanceReleasePackage
} from "../workers/infrastructure/route-iq-retention-maintenance-release-package.mjs";

const readJson = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

function records() {
  const governance = readJson(
    "overwatch/governance/route-iq-dormant-retention-maintenance-deployment-readiness-v1.json"
  );
  return {
    governance,
    report: readJson(
      "overwatch/reports/BATCH-20260809-002-route-iq-dormant-retention-maintenance-deployment-readiness.json"
    ),
    releaseContract: readJson(
      "workers/infrastructure/route-iq-retention-maintenance-release-package-v1.json"
    ),
    runtimeContract: readJson(
      "workers/infrastructure/route-iq-retention-maintenance-runtime-v1.json"
    ),
    forwardRollback: readJson(
      "workers/infrastructure/route-iq-retention-maintenance-forward-revert-v1.json"
    ),
    securityTriage: readJson("security/npm-high-advisory-triage-batch-20260809-002.json"),
    intelligenceSuccessor: readJson(
      "intelligence/provenance/protected-baseline-synchronization-retention-maintenance-consumer-admission-v1.json"
    ),
    dryRun: dryRunRouteIqRetentionMaintenanceReleasePackage({
      sourceRef: governance.releasePackage.sourceCommit
    })
  };
}

test("Overwatch verifies the exact dormant maintenance release and owner chain", () => {
  const result = verifyOverwatchRouteIqRetentionMaintenanceDeploymentReadiness();
  assert.equal(result.status, "PASS");
  assert.equal(result.batchId, "BATCH-20260809-002");
  assert.equal(result.ownerCommitCount, 9);
  assert.equal(result.integrationCommit, "432eefb987afb06bf5c49241911953aaab559331");
  assert.equal(result.integrationTree, "931d02b13e023797cf5a70e658bbf1c2a461ac16");
  assert.equal(
    result.firstQualificationRepairCommit,
    "43be570ea4140960ce7d946a0b0191eb99a0ad88"
  );
  assert.equal(
    result.firstQualificationRepairTree,
    "bb8337bd03021af2183eb56c9e19574e95db16cd"
  );
  assert.equal(
    result.infrastructureQualificationRepairCommit,
    "929856fcf7377be0aa08888d04ca68c801ad6002"
  );
  assert.equal(
    result.infrastructureQualificationRepairTree,
    "8879320360a1b5b908cf0727028a7ed5570bc048"
  );
  assert.equal(result.qualificationRepairCommit,
    "2d5caafc52de0c1ee42bce5b370e2232e53fd72f");
  assert.equal(result.qualificationRepairTree,
    "25bd1b7015f018edbf4c8371a33598cafb28ebff");
  assert.equal(result.currentPackageLockSuccessorCommit,
    "da7504352424096869a18b66dc7c4429480393f4");
  assert.equal(result.currentPackageLockSha256,
    "6689435e2070d0f36d97448019348dc776d28cca9f6538d3d632cd5e5c1590ec");
  assert.equal(
    result.privateWorkflowForwardPayloadSha256,
    "bafde531701612f2bf5ca9fd3bb69ee1be60432c78b0a046359c7476e5785e09"
  );
  assert.equal(result.cloudflareContactCount, 0);
  assert.equal(result.productionMutationCount, 0);
  assert.equal(result.deploymentAuthorized, false);
  assert.equal(result.deletionAuthorized, false);
  assert.equal(result.collection, "OFF");
  assert.equal(result.activeCohorts, 0);
  assert.equal(result.recommendationInfluence, "OFF");
});

test("the exact deterministic dry run passes with zero authority and zero production contact", () => {
  assert.equal(validateDormantRetentionMaintenanceReadiness(records()), true);
});

test("binding collapse and route or automatic-trigger exposure fail closed", () => {
  for (const mutate of [
    value => { value.releaseContract.bindingBoundary.identicalBindingInstancesAllowed = true; },
    value => { value.releaseContract.exposure.publicRoute = true; },
    value => { value.releaseContract.automaticExecution.scheduler = true; },
    value => { value.runtimeContract.surfaceExclusion.dashboardControlConfigured = true; }
  ]) {
    const changed = structuredClone(records());
    mutate(changed);
    assert.throws(() => validateDormantRetentionMaintenanceReadiness(changed));
  }
});

test("fixture, stale, or mutation-capable legal-hold readiness fails closed", () => {
  for (const mutate of [
    value => { value.runtimeContract.legalHoldLedgerBinding.defaultsToUnavailable = false; },
    value => { value.runtimeContract.legalHoldLedgerBinding.fixtureStateAllowedInProduction = true; },
    value => { value.governance.legalHoldReadiness.immediateRevalidationRequired = false; },
    value => { value.governance.legalHoldReadiness.mutationAuthorityGranted = true; }
  ]) {
    const changed = structuredClone(records());
    mutate(changed);
    assert.throws(() => validateDormantRetentionMaintenanceReadiness(changed));
  }
});

test("unsigned, replayable, or authority-bearing admission evidence fails closed", () => {
  for (const mutate of [
    value => { value.runtimeContract.admissionProducerBinding.signedEvidenceRequired = false; },
    value => { value.runtimeContract.admissionProducerBinding.atomicReplayConsumptionRequired = false; },
    value => { value.runtimeContract.admissionProducerBinding.deletionAuthorityAvailable = true; },
    value => { value.intelligenceSuccessor.composition.deploymentAuthorityGranted = true; }
  ]) {
    const changed = structuredClone(records());
    mutate(changed);
    assert.throws(() => validateDormantRetentionMaintenanceReadiness(changed));
  }
});

test("artifact drift, production contact, and protected-state drift fail closed", () => {
  for (const mutate of [
    value => { value.dryRun.identities.artifactSha256 = "0".repeat(64); },
    value => { value.dryRun.cloudflareContactCount = 1; },
    value => { value.governance.protectedState.productionMutationCount = 1; },
    value => { value.governance.protectedState.collection = "ON"; },
    value => { value.governance.authorizationBoundaries.deletion.interchangeableWithDeploymentAuthority = true; }
  ]) {
    const changed = structuredClone(records());
    mutate(changed);
    assert.throws(() => validateDormantRetentionMaintenanceReadiness(changed));
  }
});

test("private workflow forward-payload continuity drift fails closed", () => {
  for (const mutate of [
    value => {
      value.governance.releasePackage.privateWorkflowContinuity.currentForwardPayloadSha256 =
        "0".repeat(64);
    },
    value => {
      value.governance.releasePackage.privateWorkflowContinuity.deployParityChanged = true;
    },
    value => {
      value.report.privateWorkflowPayloadCommit = "0".repeat(40);
    }
  ]) {
    const changed = structuredClone(records());
    mutate(changed);
    assert.throws(() => validateDormantRetentionMaintenanceReadiness(changed));
  }
});

test("historical readiness pins are extended through a linear package successor", () => {
  const value = records();
  assert.equal(value.governance.historicalVerifierComposition.historicalPinsRewritten, false);
  assert.notEqual(
    value.governance.historicalVerifierComposition.packageSuccessorPreviousSha256,
    value.governance.historicalVerifierComposition.packageSuccessorCurrentSha256
  );
  const changed = structuredClone(value);
  changed.governance.historicalVerifierComposition.historicalPinsRewritten = true;
  assert.throws(() => validateDormantRetentionMaintenanceReadiness(changed));
});

test("historical public rollback evidence composes only the exact gym-preview successor", () => {
  const gymPreviewGovernance = readJson(
    "overwatch/governance/route-iq-gym-first-dual-track-public-website-preview-v1.json"
  );
  const successor = gymPreviewGovernance.toolchainReleaseReproducibilitySuccessor;
  const input = {
    historicalArtifactSha256:
      "e3330c71600364e4e22404d005902bdcf07e5ec12fe9aa098febd01e18a3b2c6",
    currentBuildSource: PUBLIC_FORWARD_ROLLBACK_BUILD_SOURCE,
    currentSourceSha256: successor.currentSha256,
    currentRollbackContractSha256: successor.rollbackContractSha256,
    gymPreviewGovernance
  };
  assert.equal(verifyRetentionMaintenancePublicRollbackSuccessor(input), true);
  for (const mutate of [
    value => { value.historicalArtifactSha256 = "0".repeat(64); },
    value => { value.currentBuildSource.artifactSha256 = "0".repeat(64); },
    value => { value.currentSourceSha256 = "0".repeat(64); },
    value => { value.currentRollbackContractSha256 = "0".repeat(64); },
    value => { value.gymPreviewGovernance.batchId = "BATCH-STALE"; },
    value => {
      value.gymPreviewGovernance.toolchainReleaseReproducibilitySuccessor.ownerCommit =
        "0".repeat(40);
    },
    value => {
      value.gymPreviewGovernance.toolchainReleaseReproducibilitySuccessor
        .previousRollbackBundleSha256 = "0".repeat(64);
    },
    value => {
      value.gymPreviewGovernance.toolchainReleaseReproducibilitySuccessor
        .productionDeploymentAuthorized = true;
    }
  ]) {
    const changed = structuredClone(input);
    mutate(changed);
    assert.throws(() => verifyRetentionMaintenancePublicRollbackSuccessor(changed));
  }
});

test("a production-reachable high advisory or forced fix blocks readiness", () => {
  for (const mutate of [
    value => { value.securityTriage.after.productionOnly.high = 1; },
    value => { value.securityTriage.remediation.auditFixForceUsed = true; },
    value => { value.securityTriage.findings[0].runtimeReachability = "PRODUCTION_REACHABLE"; }
  ]) {
    const changed = structuredClone(records());
    mutate(changed);
    assert.throws(() => validateDormantRetentionMaintenanceReadiness(changed));
  }
});
