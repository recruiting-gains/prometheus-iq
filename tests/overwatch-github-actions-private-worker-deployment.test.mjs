import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { fixedCloudflareUnattendedSmokePlan } from
  "../scripts/run-cloudflare-unattended-smoke.mjs";
import {
  advancePrivateWorkflowV2DashboardVisualOwnerHash,
  advancePrivateWorkflowV2GovernedLearningOwnerHash,
  advancePrivateWorkflowV2GymPreviewRouteQualityOwnerHash,
  advancePrivateWorkflowV2ProspectiveCalibrationOwnerHash,
  controlledRehearsalNode24InfrastructureSuccessor,
  evaluateActivePrivateDeploymentToolchainSuccessor,
  evaluateGithubActionsPrivateWorkerDeploymentGovernance,
  evaluateGithubActionsPrivateWorkerSuccessorOwnership,
  evaluateGithubActionsPrivateWorkerV2Governance,
  evaluatePrivateWorkflowV2FieldSessionReportTypeSuccessor,
  evaluatePrivateWorkflowV2RetentionDeletionIntelligenceSuccessors,
  evaluateGithubActionsPrivateWorkerWorkflow,
  hasActivePrivateDeploymentToolchainInfrastructureSuccessor,
  hasCloudflareToolchainInfrastructureSuccessor,
  hasClaimSafePublicDeploymentInfrastructureSuccessor,
  hasControlledRehearsalNode24InfrastructureSuccessor,
  hasDashboardVisualProtectedConsumerCompositionSuccessor,
  hasFieldSessionReportTypeInfrastructureSuccessor,
  hasGovernedLearningProtectedConsumerCompositionSuccessor,
  hasGovernedLearningPayloadInfrastructureSuccessor,
  hasOutcomeSemanticIntegrityPayloadInfrastructureSuccessor,
  hasPrivateWorkflowV2DashboardVisualDeployParitySuccessor,
  hasPrivateWorkflowV2GovernedLearningInfrastructureSuccessor,
  hasProspectiveCalibrationSourceQualificationGuardSuccessor,
  hasRetentionDeletionPayloadInfrastructureSuccessor,
  hasRetentionDeletionPayloadQualificationInfrastructureSuccessor,
  hasRetentionMaintenancePayloadInfrastructureSuccessor,
  hasLiveCanonicalIdentityOwnerEvidenceSuccessor,
  verifyOverwatchGithubActionsPrivateWorkerDeployment
} from "../scripts/verify-overwatch-github-actions-private-worker-deployment.mjs";
import {
  evaluateOverwatchGithubActionsNode24PinSuccessor,
  hasGithubActionsNode24InfrastructureSuccessor,
  verifyOverwatchGithubActionsNode24PinSuccessor
} from "../scripts/verify-overwatch-github-actions-node24-pin-successor.mjs";
import {
  verifyControlledOnboardingRehearsalSmokeContractSuccessor,
  verifyGovernedMultiSessionLearningAdvisorySuccessor
} from "../intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const governance = readJson(
  "overwatch/governance/github-actions-founder-triggered-private-worker-deployment-v1.json"
);
const report = readJson(
  "overwatch/reports/BATCH-20260715-011-github-private-repository-founder-deployment-authorization.json"
);
const contract = readJson(
  "workers/infrastructure/github-actions-founder-triggered-private-worker-deployment-v1.json"
);
const workflow = read(".github/workflows/deploy-prometheus-private-worker.yml");
const governanceV2 = readJson(
  "overwatch/governance/github-actions-private-worker-deployment-v2.json"
);
const contractV2 = readJson(
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json"
);
const clone = value => structuredClone(value);
const sha256 = value => createHash("sha256").update(value).digest("hex");
const liveCanonicalIdentityGovernance = readJson(
  "overwatch/governance/live-canonical-identity-migration-v1.json"
);
const currentReadinessSuccessors = readJson(
  "overwatch/governance/route-iq-august-1-readiness-successors-v1.json"
);
const fieldSessionReportTypeGovernance = readJson(
  "overwatch/governance/field-session-report-type-contract-drift-repair-v1.json"
);
const retentionDeletionGovernance = readJson(
  "overwatch/governance/route-iq-retention-expiry-deletion-runtime-v1.json"
);
const toolchainGovernance = readJson(
  "overwatch/governance/route-iq-wrangler-miniflare-major-transition-requalification-v1.json"
);
const node24ActionPinGovernance = readJson(
  "overwatch/governance/github-actions-official-node24-pin-successor-v1.json"
);
const node24ActionPinInfrastructure = readJson(
  "workers/infrastructure/github-actions-official-node24-pin-successor-v1.json"
);
const node24ActionPinSecurity = readJson(
  "security/github-actions-official-node24-pin-successor-v1.json"
);
const claimSafePublicGovernance = readJson(
  "overwatch/governance/route-iq-claim-safe-public-deployment-successor-v1.json"
);

test("private Workflow v2 composes only the exact governed-learning Intelligence chain", () => {
  const successor = verifyGovernedMultiSessionLearningAdvisorySuccessor();
  const path =
    "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs";
  assert.equal(advancePrivateWorkflowV2GovernedLearningOwnerHash({
    path,
    acceptedSha256:
      "ce1ab3876750043b251cb6029d0c0709159a8ff9c58c4266411883e6f9542e2c",
    successor
  }), "26a52c0699474760913f403aadbacb4c8121c8c380932d4375b071d9f5bb38c0");
  assert.equal(advancePrivateWorkflowV2GovernedLearningOwnerHash({
    path: "intelligence/provenance/not-governed.mjs",
    acceptedSha256: "f".repeat(64),
    successor
  }), "f".repeat(64));
  for (const mutate of [
    value => { value.successor.batchId = "BATCH-SUBSTITUTED"; },
    value => { value.successor.ownerSubsystem = "Prometheus Overwatch"; },
    value => { value.successor.boundaries.prospectiveCollection = "ON"; },
    value => { value.successor.boundaries.deployments = 1; },
    value => { value.transitionsByPath.get(path)[0].previousSha256 = "0".repeat(64); }
  ]) {
    const candidate = clone(successor);
    mutate(candidate);
    assert.throws(() =>
      advancePrivateWorkflowV2GovernedLearningOwnerHash({
        path,
        acceptedSha256:
          "ce1ab3876750043b251cb6029d0c0709159a8ff9c58c4266411883e6f9542e2c",
        successor: candidate
      }));
  }
});

test("private Workflow v2 composes only the exact prospective-calibration source chain", () => {
  const successor = verifyControlledOnboardingRehearsalSmokeContractSuccessor()
    .prospectiveCalibrationProductionAdmissionSuccessor;
  const path =
    "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs";
  assert.equal(advancePrivateWorkflowV2ProspectiveCalibrationOwnerHash({
    path,
    acceptedSha256:
      "26a52c0699474760913f403aadbacb4c8121c8c380932d4375b071d9f5bb38c0",
    successor
  }), "6bac7ac80a6ac9b3ef3f1bef4869a61c4f7a76a146bfd2fd7edb4c58fddcbfe2");
  assert.equal(advancePrivateWorkflowV2ProspectiveCalibrationOwnerHash({
    path: "intelligence/provenance/not-governed.mjs",
    acceptedSha256: "f".repeat(64),
    successor
  }), "f".repeat(64));
  for (const mutate of [
    value => { value.successor.batchId = "BATCH-SUBSTITUTED"; },
    value => { value.successor.ownerSubsystem = "Prometheus Overwatch"; },
    value => { value.successor.truthState.governedLearning = "SUFFICIENT"; },
    value => { value.successor.protectedState.collection = "ON"; },
    value => { value.successor.protectedState.deployments = 1; },
    value => { value.successor.releaseBoundary.deploymentAuthorized = true; },
    value => { value.transitionsByPath.get(path)[0].previousSha256 = "0".repeat(64); }
  ]) {
    const candidate = clone(successor);
    mutate(candidate);
    assert.throws(() =>
      advancePrivateWorkflowV2ProspectiveCalibrationOwnerHash({
        path,
        acceptedSha256:
          "26a52c0699474760913f403aadbacb4c8121c8c380932d4375b071d9f5bb38c0",
        successor: candidate
      }));
  }
});

test("private Workflow v2 composes only the exact gym-preview route-quality source chain", () => {
  const successor = verifyControlledOnboardingRehearsalSmokeContractSuccessor()
    .gymPreviewRouteQualityRuntimeSurfaceSuccessor;
  const provenancePath =
    "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs";
  const routeQualityPath = "scripts/lib/route-intelligence-quality-gate.mjs";
  assert.equal(advancePrivateWorkflowV2GymPreviewRouteQualityOwnerHash({
    path: provenancePath,
    acceptedSha256:
      "6bac7ac80a6ac9b3ef3f1bef4869a61c4f7a76a146bfd2fd7edb4c58fddcbfe2",
    successor
  }), "29038a1374dc771735c5da91b3113c465c4964dfe4cbfa6b647a97d4202639fa");
  assert.equal(advancePrivateWorkflowV2GymPreviewRouteQualityOwnerHash({
    path: routeQualityPath,
    acceptedSha256:
      "7a37c1d2bfc3c07e38a0e706756c64f69718c9a7d36bd0b1eebc5717a7621468",
    successor
  }), "4e021bcfcfdac2ab0eb942f137a0f97cd120dcde882b258f772abda3b2a13aa1");
  assert.equal(advancePrivateWorkflowV2GymPreviewRouteQualityOwnerHash({
    path: "intelligence/provenance/not-governed.mjs",
    acceptedSha256: "f".repeat(64),
    successor
  }), "f".repeat(64));
  for (const mutate of [
    value => { value.successor.batchId = "BATCH-SUBSTITUTED"; },
    value => { value.successor.ownerSubsystem = "Prometheus Overwatch"; },
    value => { value.successor.behavior.currentRuntimeFileCount = 33; },
    value => { value.successor.behavior.routeScoringChanged = true; },
    value => { value.successor.protectedState.collection = "ON"; },
    value => { value.successor.protectedState.deployments = 1; },
    value => {
      value.transitionsByPath.get(provenancePath)[0].previousSha256 = "0".repeat(64);
    }
  ]) {
    const candidate = clone(successor);
    mutate(candidate);
    assert.throws(() =>
      advancePrivateWorkflowV2GymPreviewRouteQualityOwnerHash({
        path: provenancePath,
        acceptedSha256:
          "6bac7ac80a6ac9b3ef3f1bef4869a61c4f7a76a146bfd2fd7edb4c58fddcbfe2",
        successor: candidate
      }));
  }
});

test("private Workflow v2 composes only the exact dashboard visual-identity source chain", () => {
  const successor = verifyControlledOnboardingRehearsalSmokeContractSuccessor()
    .dashboardPublicVisualIdentitySuccessor;
  const provenancePath =
    "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs";
  const dashboardPath = "index.html";
  assert.equal(advancePrivateWorkflowV2DashboardVisualOwnerHash({
    path: provenancePath,
    acceptedSha256:
      "29038a1374dc771735c5da91b3113c465c4964dfe4cbfa6b647a97d4202639fa",
    successor
  }), "8fb3b8be0a06d9d176b8ab6cc23625810d69c9719f71a35bfe71cb34ef0ec129");
  assert.equal(advancePrivateWorkflowV2DashboardVisualOwnerHash({
    path: dashboardPath,
    acceptedSha256:
      "b450ce99d5e416677451ace590c276b74723ac64b578a00f01be13c93951e604",
    successor
  }), "ad138fdbf0a2f06c6226bb1310e575d3db867b256a25db9a03da9d1a2d2380b8");
  assert.equal(advancePrivateWorkflowV2DashboardVisualOwnerHash({
    path: "intelligence/provenance/not-governed.mjs",
    acceptedSha256: "f".repeat(64),
    successor
  }), "f".repeat(64));
  for (const mutate of [
    value => { value.successor.batchId = "BATCH-SUBSTITUTED"; },
    value => { value.successor.ownerSubsystem = "Prometheus Overwatch"; },
    value => { value.successor.behavior.dashboardVisualIdentityAligned = false; },
    value => { value.successor.behavior.recommendationBehaviorChanged = true; },
    value => { value.successor.protectedState.collection = "ON"; },
    value => { value.successor.protectedState.deployments = 1; },
    value => {
      value.transitionsByPath.get(provenancePath)[0].previousSha256 = "0".repeat(64);
    }
  ]) {
    const candidate = clone(successor);
    mutate(candidate);
    assert.throws(() =>
      advancePrivateWorkflowV2DashboardVisualOwnerHash({
        path: provenancePath,
        acceptedSha256:
          "29038a1374dc771735c5da91b3113c465c4964dfe4cbfa6b647a97d4202639fa",
        successor: candidate
      }));
  }
});

test("private Workflow v2 admits only the Infrastructure-owned dashboard deploy-parity successor", () => {
  const path = "scripts/lib/github-actions-private-worker-workflow-v2.mjs";
  const input = {
    governance: governanceV2,
    path,
    previousSha256:
      "37734d9d66d9cb5039c5d55070ea0c13cfb68f67bd46989e6942e32e84938bde",
    currentSha256:
      "f0e821b5bed6cb1caf354cc0910d9e565b04ee557a1462797734905800c3e387"
  };
  assert.equal(
    hasPrivateWorkflowV2DashboardVisualDeployParitySuccessor(input),
    true
  );
  for (const mutate of [
    value => { value.dashboardVisualDeployParitySuccessor.authorization = "BATCH-X"; },
    value => {
      value.dashboardVisualDeployParitySuccessor.implementationOwner =
        "Prometheus Overwatch <overwatch@prometheus.local>";
    },
    value => {
      value.dashboardVisualDeployParitySuccessor.deployParitySha256 = "0".repeat(64);
    },
    value => {
      value.dashboardVisualDeployParitySuccessor.protectedState.collection = "ON";
    },
    value => {
      value.dashboardVisualDeployParitySuccessor.evidence[0].successorSha256 =
        "0".repeat(64);
    }
  ]) {
    const candidate = clone(governanceV2);
    mutate(candidate);
    assert.equal(
      hasPrivateWorkflowV2DashboardVisualDeployParitySuccessor({
        ...input,
        governance: candidate
      }),
      false
    );
  }
  assert.equal(hasPrivateWorkflowV2DashboardVisualDeployParitySuccessor({
    ...input,
    path: "workers/infrastructure/not-governed.json"
  }), false);
});

test("private Workflow v2 accepts only the owner-authored unqualified-artifact guard", () => {
  const input = {
    path: "tests/github-actions-private-worker-workflow-v2.test.mjs",
    previousSha256:
      "0be634c012833c62ae58f06eec0f59328b65ebf8ca0540bcd350ecefc49d0933",
    currentSha256:
      "27469994b9f29a76e39c9165a30f1c4d82b627c11453adc00c22358815c864c8"
  };
  assert.equal(
    hasProspectiveCalibrationSourceQualificationGuardSuccessor(input),
    true
  );
  for (const candidate of [
    { ...input, path: "package.json" },
    { ...input, previousSha256: "0".repeat(64) },
    { ...input, currentSha256: "0".repeat(64) }
  ]) {
    assert.equal(
      hasProspectiveCalibrationSourceQualificationGuardSuccessor(candidate),
      false
    );
  }
});

test("private Workflow v2 accepts only the exact governed-learning Infrastructure successor", () => {
  const path = "_headers";
  const previousSha256 =
    "2be69aefc6de11fd91620e8f9c253fbd37f5561fa28527b551ae0c593cd645a4";
  const currentSha256 =
    "c221ea26b32e5087a10accc1db1a0a941f3ad4517c472b95ca96461e60948667";
  assert.equal(hasPrivateWorkflowV2GovernedLearningInfrastructureSuccessor({
    readinessSuccessors: currentReadinessSuccessors,
    path,
    previousSha256,
    currentSha256
  }), true);
  assert.equal(hasPrivateWorkflowV2GovernedLearningInfrastructureSuccessor({
    readinessSuccessors: currentReadinessSuccessors,
    path: "_redirects",
    previousSha256,
    currentSha256
  }), false);
  for (const mutate of [
    value => { value.successors[15].commit = "0".repeat(40); },
    value => {
      value.successors[15].owner =
        "Prometheus Overwatch <overwatch@prometheus.local>";
    },
    value => {
      value.successors[15].evidence[0].previousSha256 = "0".repeat(64);
    },
    value => {
      value.successors[15].evidence.push(value.successors[15].evidence[0]);
    }
  ]) {
    const candidate = clone(currentReadinessSuccessors);
    mutate(candidate);
    assert.equal(hasPrivateWorkflowV2GovernedLearningInfrastructureSuccessor({
      readinessSuccessors: candidate,
      path,
      previousSha256,
      currentSha256
    }), false);
  }
});

function evaluate(nextGovernance = governance, nextReport = report, nextContract = contract) {
  return evaluateGithubActionsPrivateWorkerDeploymentGovernance({
    governance: nextGovernance,
    report: nextReport,
    contract: nextContract
  });
}

test("Overwatch verifies Founder-authenticated private-repository deployment dispatch", () => {
  const result = verifyOverwatchGithubActionsPrivateWorkerDeployment();
  assert.equal(result.status, "passed");
  assert.equal(result.batchId, "BATCH-20260715-011");
  assert.equal(result.implementationOwner, "Prometheus Infrastructure");
  assert.equal(result.verificationOwner, "Prometheus Overwatch");
  assert.equal(result.implementationCommit,
    "38e983b6d0a121d8aadf443938ab5985771eddac");
  assert.equal(result.activeToolchainOwnerCommit,
    "d55a983134be40bf10777df293ca593e7583f138");
  assert.equal(result.activeWranglerVersion, "4.120.1");
  assert.equal(result.node24ActionPinStatus,
    "OFFICIAL_NODE24_ACTION_PIN_OVERWATCH_VERIFIED");
  assert.equal(result.node24ActionPinWorkflowFiles, 15);
  assert.equal(result.node24ActionPinCheckoutReferences, 39);
  assert.equal(result.node24ActionPinSetupNodeReferences, 39);
  assert.equal(result.founderActor, "PrometheusRouteIQ");
  assert.equal(result.founderTriggeringActor, "PrometheusRouteIQ");
  assert.equal(result.workflowBranch, "main");
  assert.equal(result.workflowTrigger, "workflow_dispatch");
  assert.equal(result.rerunAllowed, false);
  assert.equal(result.privateWorker, "prometheus-iq");
  assert.equal(result.publicWorkerDeploymentAllowed, false);
  assert.equal(result.writeAttemptsAllowed, 0);
  assert.equal(result.deploymentPerformed, false);
  assert.equal(result.firstDeploymentReady, false);
  assert.equal(result.immutableWorkflowV2SourceGoverned, true);
  assert.equal(result.immutableWorkflowV2QualificationPending, true);
  assert.equal(result.immutableWorkflowV2DeploymentReady, true);
  assert.equal(result.immutableWorkflowV2BootstrapRepairCommit,
    "a5ae6578bc0c030def8df5d4713d5ecbe5206212");
  assert.equal(result.immutableWorkflowV2RunnerWorkspaceRepairCommit,
    "254fea23e18fec27228e15e75986a1c6bb3dffd6");
  assert.equal(result.immutableWorkflowV2TrustedTempAliasRepairCommit,
    "6a764ad86ad4f99e0bd9ed835c8f1aba20f91a3b");
  assert.equal(result.immutableWorkflowV2WranglerScratchIsolationCommit,
    "947720badd46cb053c6e199b96b3739180b26690");
  assert.equal(result.immutableWorkflowV2Node24CleanupRepairCommit,
    "1341e8edf6e96603437b7bff95768531e2f5446a");
  assert.equal(result.immutableWorkflowV2CanonicalSmokeRepairCommit,
    "dfa52c70cd48b33771d6c85de6483c499d9b038f");
  assert.equal(result.immutableWorkflowV2BrowserManagedIconSecretScanRepairCommit,
    "09354a69109770c49f04aeef319246e636c8a196");
  assert.equal(result.immutableWorkflowV2BrowserSmokeMarkerPropagationRepairCommit,
    "0f26a2223c06c4c9a28cf199e5a2f183f0a6126e");
  assert.equal(result.immutableWorkflowV2PublicBundlePreservationCommit,
    "a4572b351473bf5c0183d748434d77de04d882f0");
  assert.equal(result.immutableWorkflowV2CanonicalClientIsolationCommit,
    "c7bbf6413430da2e55f94041bba70fcbdb4a95ba");
  assert.equal(result.immutableWorkflowV2PayloadContinuityCommit,
    "b64f6f05940bdf24ba57dfe488f567853e0c3d22");
  assert.equal(result.immutableWorkflowV2ReleasePropagationRepairCommit,
    "25ff53a7e61b50962144c5c689cc7a546875f724");
  assert.equal(result.immutableWorkflowV2RollbackRootGuardRepairCommit,
    "6f7216afa09b72442f53a271a8b9fc749aa34d4b");
  assert.equal(result.immutableWorkflowV2GuardConvergenceRepairCommit,
    "c217ad43e4dbae32690661463eb6cfa38a19e95c");
  assert.equal(result.immutableWorkflowV2ForwardPayloadPinCorrectionCommit,
    "b540084521c87ccad85b41b5e9d1714a497f73e0");
  assert.equal(result.immutableWorkflowV2UnconditionalGuardRoutingCommit,
    "ceea5b6496f81341a49f605622d78daf084d9f6f");
  assert.equal(result.immutableWorkflowV2PaidCustomerAcceptanceCommit,
    "3872b30d1f16acde85518ae857bae09336aaed3b");
  assert.equal(result.immutableWorkflowV2BrowserAcceptanceRepairCommit,
    "ff01434aac512f46b6c582d013056fe5b466ce6e");
  assert.equal(result.immutableWorkflowV2SmokeSequencingRepairCommit,
    "d41f900930d1c6036a536ea4d64ba5beb1779195");
  assert.equal(result.immutableWorkflowV2ProbePropagationRepairCommit,
    "89bd37ad4a05b89ed624b0f18edcffdcb7e8129d");
  assert.equal(result.immutableWorkflowV2BrowserHealthDiagnosticsRepairCommit,
    "dba70aa70f863518d9afdb7343788b998ef567e1");
  assert.equal(result.immutableWorkflowV2BrowserAcceptanceEvidenceRepairCommit,
    "f27544bfc21a1ae7ceae05a6421a6b9d02007366");
  assert.equal(result.immutableWorkflowV2ServiceWorkerGuardRepairCommit,
    "4d5b201dabf6e458633eec7500363fd28f4ac4e5");
  assert.equal(result.immutableWorkflowV2SmokeTimeoutRepairCommit,
    "a7822e6535892ee4b51c483089f9f045c3185724");
  assert.equal(result.immutableWorkflowV2SmokeReleaseContinuityCommit,
    "43159913a976b48f1279f534f8fcd5b73b48a263");
  assert.equal(result.immutableWorkflowV2BrowserVersionStabilityRepairCommit,
    "296d1ff559bfe0f916632ea59d4e702289c87065");
  assert.equal(result.immutableWorkflowV2ProductionIdentityInspectionCommit,
    "4884f3e8c410ee74620a636bdc8311f3a12186b5");
  assert.equal(
    result.immutableWorkflowV2IntelligenceSmokeTimeoutSynchronizationCommit,
    "039116040678a3cbae8016a34f17e30e674715f6"
  );
  assert.equal(
    result.immutableWorkflowV2ControlledRehearsalIntelligenceSuccessorCommit,
    "41679ab6742dc9fd8639bbc7cfe6a1dc2328d540"
  );
  assert.equal(
    result.immutableWorkflowV2LiveCanonicalIdentityIntelligenceSuccessorCommit,
    "56f67124c1beba2f9289538d65e782cd808eacb2"
  );
  assert.equal(
    result.immutableWorkflowV2RetentionDeletionIntelligenceSuccessorCommit,
    "b359d8e701e13d2f9911dcd0cb917eecce8aa7ac"
  );
  assert.equal(
    result.immutableWorkflowV2RetentionDeletionIntelligenceSynchronizationCommit,
    "99f591162093ccb1f4ad5ac2eac59fc76bec4bc0"
  );
  assert.equal(
    result.immutableWorkflowV2RetentionMaintenancePayloadSuccessorCommit,
    "ae4e8def3e1142d6c9c99b709179f4be91c1acea"
  );
  assert.equal(
    result.immutableWorkflowV2LiveCanonicalIdentityShadowReadinessRepairCommit,
    "0515e5993547e5e1b3a0b5897f12ac53060a8b35"
  );
  assert.equal(
    result.immutableWorkflowV2LiveCanonicalIdentityProtectedConsumerCompositionRepairCommit,
    "a6e85f05fe57a5bff8b2fc6bc168f541272ac0b8"
  );
  assert.equal(
    result.immutableWorkflowV2LiveCanonicalIdentityOffRouteBaselineRepairCommit,
    "db74fd379f0624f3abfaf1ddee1827c3fe4f1e60"
  );
  assert.equal(
    result.immutableWorkflowV2LiveCanonicalIdentityOverwatchAcceptanceCommit,
    "d904f5b3420d6fee328f69fba5850b49b6bb3637"
  );
  assert.equal(
    result.immutableWorkflowV2LiveCanonicalIdentityShadowReadinessAcceptanceCommit,
    "da8b92ba2a33c8ca02e8ee681877ff057ce6da70"
  );
  assert.equal(
    result.immutableWorkflowV2LiveCanonicalIdentityProtectedConsumerCompositionAcceptanceCommit,
    "b627c876d424dd9f435bf340fa86017be4eb966d"
  );
  assert.equal(
    result.immutableWorkflowV2LiveCanonicalIdentityOffRouteBaselineAcceptanceCommit,
    "ec33c3b4bc66be9b0b177eac94b50cc9d692ac23"
  );
  assert.equal(
    result.immutableWorkflowV2ControlledRehearsalGuardVerifierSuccessorCommit,
    "68b396623f6ef0190d4cd938aa6812326b5067f1"
  );
  assert.equal(
    result.immutableWorkflowV2ControlledRehearsalOwnerPreflightRepairCommit,
    "488837c74eb91950bb8cd37e9b9764490dead98e"
  );
  assert.equal(
    result.immutableWorkflowV2GovernedLearningPayloadSuccessorCommit,
    "a80916d6281b3e584de46508d9d4b2e08f582391"
  );
  assert.equal(
    result.immutableWorkflowV2OutcomeSemanticIntegrityPayloadSuccessorCommit,
    "9c85a32f296eb44cff59cf101615e133960fdd93"
  );
  assert.equal(result.localRealWranglerDryRunPassed, true);
  assert.equal(result.cleanRunnerRealWranglerEvidencePending, true);
  assert.equal(result.protectedEnvironmentRequiredNamesPresent, true);
  assert.equal(result.failedDeploymentRunReachedProductionMutation, true);
  assert.equal(result.failedDeploymentRunRollbackVerified, true);
  assert.equal(result.runnerWorkspaceFailureReachedProductionMutation, false);
  assert.equal(result.wranglerScratchFailureReachedProductionMutation, false);
});

test("private deployment composes only the exact active Wrangler successor", () => {
  const values = {
    successor: toolchainGovernance.activeDeploymentPolicySuccessor,
    contract,
    contractV2
  };
  assert.equal(evaluateActivePrivateDeploymentToolchainSuccessor(values).ok, true);
  for (const mutate of [
    next => { next.successor.infrastructureCommit = "0".repeat(40); },
    next => { next.successor.privateWorkerTargetChanged = true; },
    next => { next.contract.wranglerDeployment.version = "4.110.0"; },
    next => { next.contractV2.qualification.wranglerVersion = "4.110.0"; }
  ]) {
    const changed = clone(values);
    mutate(changed);
    assert.equal(evaluateActivePrivateDeploymentToolchainSuccessor(changed).ok, false);
  }

  const path = "workers/infrastructure/github-actions-private-worker-deployment-v2.json";
  const transition = {
    governance: toolchainGovernance,
    path,
    previousSha256: "157977f192e5b05eacf932c82d64dd6ad51cc7f4860824d0092872f3b8a1890b",
    currentSha256: toolchainGovernance.activeDeploymentPolicySuccessor
      .currentEvidence[path]
  };
  assert.equal(hasActivePrivateDeploymentToolchainInfrastructureSuccessor(transition), true);
  const changedGovernance = clone(toolchainGovernance);
  changedGovernance.activeDeploymentPolicySuccessor.currentEvidence[path] = "0".repeat(64);
  assert.equal(hasActivePrivateDeploymentToolchainInfrastructureSuccessor({
    ...transition,
    governance: changedGovernance
  }), false);

  const publicTestPath = "tests/github-actions-public-worker-deployment.test.mjs";
  const claimSafeTransition = {
    governance: claimSafePublicGovernance,
    path: publicTestPath,
    previousSha256: toolchainGovernance.activeDeploymentPolicySuccessor
      .currentEvidence[publicTestPath],
    currentSha256: sha256(read(publicTestPath))
  };
  assert.equal(
    hasClaimSafePublicDeploymentInfrastructureSuccessor(claimSafeTransition),
    true
  );
  for (const mutate of [
    next => { next.governance.batchId = "BATCH-STALE"; },
    next => {
      next.governance.implementationCommits.find(entry =>
        entry.commit === "6c4f452723c831b1a2e3e1574eeff713fcde6682"
      ).identity = "Prometheus Overwatch <overwatch@prometheus.local>";
    },
    next => { next.governance.releaseBoundary.privateWorkerMutationAllowed = true; },
    next => { next.currentSha256 = "0".repeat(64); }
  ]) {
    const changed = clone(claimSafeTransition);
    mutate(changed);
    assert.equal(hasClaimSafePublicDeploymentInfrastructureSuccessor(changed), false);
  }

  const harnessPath = "tests/cloudflare-unattended-runtime-guard.test.mjs";
  const harnessTransition = {
    governance: toolchainGovernance,
    path: harnessPath,
    previousSha256: "20c926030decb7c6a4bf290f845703c58c33005ec499fc12bf266f7a00e5eef7",
    currentSha256: sha256(readFileSync(resolve(root, harnessPath)))
  };
  assert.equal(hasCloudflareToolchainInfrastructureSuccessor(harnessTransition), true);
  const changedOwner = clone(toolchainGovernance);
  changedOwner.ownerChain.find(item => item.commit.startsWith("da750435")).identity =
    "Prometheus Overwatch <overwatch@prometheus.local>";
  assert.equal(hasCloudflareToolchainInfrastructureSuccessor({
    ...harnessTransition,
    governance: changedOwner
  }), false);
});

test("private Workflow v2 accepts only owner-proven canonical identity assets", () => {
  const path = "_headers";
  const previousSha256 =
    "96a4816d019802805b61d88699ba952a7180428f9d9d006bb8e319ea3a536275";
  const currentSha256 = currentReadinessSuccessors.successors
    .find(item => item.commit === "267225d51e32acc6f50ce932a945e2749783734e")
    .evidence.find(item => item.path === path).previousSha256;
  assert.equal(hasLiveCanonicalIdentityOwnerEvidenceSuccessor({
    governance: liveCanonicalIdentityGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path,
    previousSha256,
    currentSha256
  }), true);

  const protectedConsumerPath =
    "intelligence/provenance/verify-paid-customer-revenue-readiness-protected-consumers-v1.mjs";
  assert.equal(hasLiveCanonicalIdentityOwnerEvidenceSuccessor({
    governance: liveCanonicalIdentityGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path: protectedConsumerPath,
    previousSha256:
      "89529db78c45767e77f2daa0fd88c20fb7eba6aed4293b333e1e0d1afe9801ce",
    currentSha256:
      "da7660a5e7e846f772ee9ef59d8bae502a2c43942a2eeec65639d4df9ba687cb"
  }), true);
  assert.equal(hasGovernedLearningProtectedConsumerCompositionSuccessor({
    path: protectedConsumerPath,
    previousSha256:
      "da7660a5e7e846f772ee9ef59d8bae502a2c43942a2eeec65639d4df9ba687cb",
    currentSha256:
      "27d87421ad191d86599524a6e4dac966b8741ffc7a5a8b065eb0cc7caf3dc3d9"
  }), true);
  assert.equal(hasGovernedLearningProtectedConsumerCompositionSuccessor({
    path: protectedConsumerPath,
    previousSha256:
      "da7660a5e7e846f772ee9ef59d8bae502a2c43942a2eeec65639d4df9ba687cb",
    currentSha256: "0".repeat(64)
  }), false);
  assert.equal(hasDashboardVisualProtectedConsumerCompositionSuccessor({
    path: protectedConsumerPath,
    previousSha256:
      "27d87421ad191d86599524a6e4dac966b8741ffc7a5a8b065eb0cc7caf3dc3d9",
    currentSha256: sha256(readFileSync(resolve(root, protectedConsumerPath)))
  }), true);
  assert.equal(hasDashboardVisualProtectedConsumerCompositionSuccessor({
    path: protectedConsumerPath,
    previousSha256:
      "27d87421ad191d86599524a6e4dac966b8741ffc7a5a8b065eb0cc7caf3dc3d9",
    currentSha256: "0".repeat(64)
  }), false);
  const protectedConsumerTestPath = "tests/intelligence-architecture.test.mjs";
  assert.equal(hasDashboardVisualProtectedConsumerCompositionSuccessor({
    path: protectedConsumerTestPath,
    previousSha256:
      "917f8a4fb2f6cf13dc0f545f8ed2cea1e0f128234ab8ef3f8212ae5e0bcb8807",
    currentSha256: sha256(readFileSync(resolve(root, protectedConsumerTestPath)))
  }), true);

  const changed = clone(currentReadinessSuccessors);
  changed.successors.find(item => item.commit.startsWith("c4cb9150"))
    .owner = "Prometheus Overwatch <overwatch@prometheus.local>";
  assert.equal(hasLiveCanonicalIdentityOwnerEvidenceSuccessor({
    governance: liveCanonicalIdentityGovernance,
    readinessSuccessors: changed,
    path,
    previousSha256,
    currentSha256
  }), false);
  assert.equal(hasLiveCanonicalIdentityOwnerEvidenceSuccessor({
    governance: liveCanonicalIdentityGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path,
    previousSha256,
    currentSha256: "0".repeat(64)
  }), false);

  const workflowPath =
    "workers/infrastructure/github-actions-private-worker-deployment-v2.json";
  const workflowPreviousSha256 =
    "30810573fc0926c03a6bbc5337db4ce7030c419a4b08c64b219db7c3abeb371b";
  const workflowCurrentSha256 = sha256(readFileSync(resolve(root, workflowPath)));
  const workflowFieldSessionEvidence = fieldSessionReportTypeGovernance
    .privateWorkflowContinuity.evidence.find(item => item.path === workflowPath);
  assert.equal(hasLiveCanonicalIdentityOwnerEvidenceSuccessor({
    governance: liveCanonicalIdentityGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path: workflowPath,
    previousSha256: workflowPreviousSha256,
    currentSha256: workflowFieldSessionEvidence.previousSha256
  }), true);
  assert.equal(hasFieldSessionReportTypeInfrastructureSuccessor({
    governance: fieldSessionReportTypeGovernance,
    liveCanonicalIdentityGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path: workflowPath,
    previousSha256: workflowPreviousSha256,
    currentSha256: workflowFieldSessionEvidence.currentSha256
  }), true);
  assert.equal(hasRetentionDeletionPayloadQualificationInfrastructureSuccessor({
    governance: governanceV2,
    fieldSessionReportTypeGovernance,
    liveCanonicalIdentityGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path: workflowPath,
    previousSha256: workflowPreviousSha256,
    currentSha256: governanceV2.retentionDeletionPayloadQualificationSuccessor.evidence
      .find(item => item.path === workflowPath).successorSha256
  }), true);
  assert.equal(hasRetentionMaintenancePayloadInfrastructureSuccessor({
    governance: governanceV2,
    fieldSessionReportTypeGovernance,
    liveCanonicalIdentityGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path: workflowPath,
    previousSha256: workflowPreviousSha256,
    currentSha256: governanceV2.governedLearningPayloadSuccessor.evidence
      .find(item => item.path === workflowPath).previousSha256
  }), true);
  assert.equal(hasGovernedLearningPayloadInfrastructureSuccessor({
    governance: governanceV2,
    fieldSessionReportTypeGovernance,
    liveCanonicalIdentityGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path: workflowPath,
    previousSha256: workflowPreviousSha256,
    currentSha256: governanceV2.outcomeSemanticIntegrityPayloadSuccessor.evidence
      .find(item => item.path === workflowPath).previousSha256
  }), true);
  assert.equal(hasOutcomeSemanticIntegrityPayloadInfrastructureSuccessor({
    governance: governanceV2,
    fieldSessionReportTypeGovernance,
    liveCanonicalIdentityGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path: workflowPath,
    previousSha256: workflowPreviousSha256,
    currentSha256: governanceV2.outcomeSemanticIntegrityPayloadSuccessor.evidence
      .find(item => item.path === workflowPath).successorSha256
  }), true);
  const workflowVisualEvidence = governanceV2.dashboardVisualDeployParitySuccessor
    .evidence.find(item => item.path === workflowPath);
  assert.equal(hasPrivateWorkflowV2DashboardVisualDeployParitySuccessor({
    governance: governanceV2,
    path: workflowPath,
    previousSha256: workflowVisualEvidence.previousSha256,
    currentSha256: workflowCurrentSha256
  }), true);

  const changedGovernance = clone(governanceV2);
  changedGovernance.governedLearningPayloadSuccessor.implementationOwner =
    "Prometheus Overwatch <overwatch@prometheus.local>";
  assert.equal(hasGovernedLearningPayloadInfrastructureSuccessor({
    governance: changedGovernance,
    fieldSessionReportTypeGovernance,
    liveCanonicalIdentityGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path: workflowPath,
    previousSha256: workflowPreviousSha256,
    currentSha256: workflowCurrentSha256
  }), false);

  const changedSemanticGovernance = clone(governanceV2);
  changedSemanticGovernance.outcomeSemanticIntegrityPayloadSuccessor.implementationOwner =
    "Prometheus Overwatch <overwatch@prometheus.local>";
  assert.equal(hasOutcomeSemanticIntegrityPayloadInfrastructureSuccessor({
    governance: changedSemanticGovernance,
    fieldSessionReportTypeGovernance,
    liveCanonicalIdentityGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path: workflowPath,
    previousSha256: workflowPreviousSha256,
    currentSha256: workflowCurrentSha256
  }), false);

  const shadowPath = "scripts/verify-shadow-decision-readiness.mjs";
  const canonicalShadowPreviousSha256 =
    "856b7f43150cc4eba0a9fee6d2df2f4254f32026dd64d92829cd4df74f17e364";
  const shadowCanonicalSuccessorSha256 =
    "0ef3dff897cb9ed90dd90a81b55e09e7a8649153192c943fd595a8a1f144b12b";
  assert.equal(hasLiveCanonicalIdentityOwnerEvidenceSuccessor({
    governance: liveCanonicalIdentityGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path: shadowPath,
    previousSha256: canonicalShadowPreviousSha256,
    currentSha256: shadowCanonicalSuccessorSha256
  }), true);
  const changedConsumerGovernance = clone(liveCanonicalIdentityGovernance);
  changedConsumerGovernance.protectedConsumerSuccessors[0].owner =
    "Prometheus Overwatch <overwatch@prometheus.local>";
  assert.equal(hasLiveCanonicalIdentityOwnerEvidenceSuccessor({
    governance: changedConsumerGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path: shadowPath,
    previousSha256: canonicalShadowPreviousSha256,
    currentSha256: shadowCanonicalSuccessorSha256
  }), false);
});

test("Overwatch governance accepts the immutable private Workflow v2 owner release", () => {
  assert.equal(evaluateGithubActionsPrivateWorkerV2Governance({
    governance: governanceV2,
    contract: contractV2
  }).ok, true);
});

test("immutable private Workflow v2 governance fails closed on ownership and safety drift", () => {
  const governanceMutations = [
    value => { value.version = "1.2.0"; },
    value => { value.ownership.implementationOwner = "Prometheus Overwatch"; },
    value => { value.ownership.overwatchModifiedInfrastructureImplementation = true; },
    value => { value.ownership.implementationCommit.commit = "0".repeat(40); },
    value => {
      value.ownership.implementationBootstrapRepairCommit.commit = "0".repeat(40);
    },
    value => {
      value.ownership.implementationRunnerWorkspaceRepairCommit.commit = "0".repeat(40);
    },
    value => {
      value.ownership.implementationTrustedTempAliasRepairCommit.commit = "0".repeat(40);
    },
    value => {
      value.ownership.implementationWranglerScratchIsolationCommit.commit = "0".repeat(40);
    },
    value => {
      value.ownership.implementationNode24CleanupRepairCommit.commit = "0".repeat(40);
    },
    value => {
      value.ownership.implementationCanonicalSmokeRepairCommit.commit = "0".repeat(40);
    },
    value => {
      value.ownership.implementationPublicBundlePreservationCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.implementationCanonicalClientIsolationCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.implementationPayloadContinuityCommit.commit = "0".repeat(40);
    },
    value => {
      value.ownership.implementationReleasePropagationRepairCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.implementationRollbackRootGuardRepairCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.implementationGuardConvergenceRepairCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.implementationForwardPayloadPinCorrectionCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.implementationUnconditionalGuardRoutingCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.implementationPaidCustomerAcceptanceCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.implementationBrowserAcceptanceRepairCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.implementationSmokeSequencingRepairCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.implementationProbePropagationRepairCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.implementationHttpPathDiagnosticsRepairCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.implementationBrowserManagedIconRepairCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.implementationBrowserSmokeMarkerPropagationRepairCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.implementationSmokeTimeoutRepairCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.implementationSmokeReleaseContinuityCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.implementationBrowserVersionStabilityRepairCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.implementationProductionIdentityInspectionCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.intelligenceSmokeTimeoutSynchronizationCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.intelligenceRevenueReadinessSuccessorCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.intelligenceRevenueReadinessSuccessorCommit.author =
        "Prometheus Overwatch <overwatch@prometheus.local>";
    },
    value => {
      value.ownership.intelligenceRevenueReadinessSuccessorPaths[0] = "package.json";
    },
    value => {
      value.ownership.intelligenceRevenueReadinessSuccessorEvidence[1].sha256 =
        "0".repeat(64);
    },
    value => {
      value.ownership.intelligenceLiveCanonicalIdentitySuccessorCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.intelligenceLiveCanonicalIdentitySuccessorPaths.pop();
    },
    value => {
      value.ownership.intelligenceLiveCanonicalIdentitySuccessorEvidence[0].sha256 =
        "0".repeat(64);
    },
    value => {
      value.ownership
        .intelligenceLiveCanonicalIdentityShadowReadinessRepairCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership
        .intelligenceLiveCanonicalIdentityShadowReadinessRepairPaths.pop();
    },
    value => {
      value.ownership
        .intelligenceLiveCanonicalIdentityShadowReadinessRepairEvidence[0]
        .sha256 = "0".repeat(64);
    },
    value => {
      value.ownership
        .intelligenceLiveCanonicalIdentityProtectedConsumerCompositionRepairCommit
        .commit = "0".repeat(40);
    },
    value => {
      value.ownership
        .intelligenceLiveCanonicalIdentityProtectedConsumerCompositionRepairPaths
        .pop();
    },
    value => {
      value.ownership
        .intelligenceLiveCanonicalIdentityProtectedConsumerCompositionRepairEvidence[0]
        .sha256 = "0".repeat(64);
    },
    value => {
      value.ownership
        .intelligenceLiveCanonicalIdentityOffRouteBaselineRepairCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership
        .intelligenceLiveCanonicalIdentityOffRouteBaselineRepairPaths.pop();
    },
    value => {
      value.ownership
        .intelligenceLiveCanonicalIdentityOffRouteBaselineRepairEvidence[0]
        .sha256 = "0".repeat(64);
    },
    value => {
      value.ownership.overwatchRevenueReadinessAcceptanceCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.overwatchRevenueReadinessAcceptanceCommit.parent =
        "0".repeat(40);
    },
    value => {
      value.ownership.overwatchRevenueReadinessAcceptancePaths.pop();
    },
    value => {
      value.ownership.overwatchRevenueReadinessAcceptanceEvidence[0].sha256 =
        "0".repeat(64);
    },
    value => {
      value.ownership.overwatchLiveCanonicalIdentityAcceptanceCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.overwatchLiveCanonicalIdentityAcceptancePaths.pop();
    },
    value => {
      value.ownership.overwatchLiveCanonicalIdentityAcceptanceEvidence[0].sha256 =
        "0".repeat(64);
    },
    value => {
      value.ownership
        .overwatchLiveCanonicalIdentityShadowReadinessAcceptanceCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership
        .overwatchLiveCanonicalIdentityShadowReadinessAcceptancePaths.pop();
    },
    value => {
      value.ownership
        .overwatchLiveCanonicalIdentityShadowReadinessAcceptanceEvidence[0]
        .sha256 = "0".repeat(64);
    },
    value => {
      value.ownership
        .overwatchLiveCanonicalIdentityProtectedConsumerCompositionAcceptanceCommit
        .commit = "0".repeat(40);
    },
    value => {
      value.ownership
        .overwatchLiveCanonicalIdentityProtectedConsumerCompositionAcceptancePaths
        .pop();
    },
    value => {
      value.ownership
        .overwatchLiveCanonicalIdentityProtectedConsumerCompositionAcceptanceEvidence[0]
        .sha256 = "0".repeat(64);
    },
    value => {
      value.ownership
        .overwatchLiveCanonicalIdentityOffRouteBaselineAcceptanceCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership
        .overwatchLiveCanonicalIdentityOffRouteBaselineAcceptancePaths.pop();
    },
    value => {
      value.ownership
        .overwatchLiveCanonicalIdentityOffRouteBaselineAcceptanceEvidence[0]
        .sha256 = "0".repeat(64);
    },
    value => {
      value.ownership.intelligenceModifiedInfrastructureImplementation = true;
    },
    value => {
      value.ownership.intelligenceSynchronizationChangedRecommendationInfluence =
        true;
    },
    value => { value.ownership.bootstrapRepairEvidence[0].sha256 = "0".repeat(64); },
    value => { value.ownership.runnerWorkspaceRepairEvidence[0].sha256 = "0".repeat(64); },
    value => { value.ownership.trustedTempAliasRepairEvidence[0].sha256 = "0".repeat(64); },
    value => {
      value.ownership.wranglerScratchIsolationEvidence[0].sha256 = "0".repeat(64);
    },
    value => {
      value.ownership.node24CleanupRepairEvidence[0].sha256 = "0".repeat(64);
    },
    value => {
      value.ownership.canonicalSmokeRepairEvidence[0].sha256 = "0".repeat(64);
    },
    value => {
      value.ownership.publicBundlePreservationEvidence[0].sha256 = "0".repeat(64);
    },
    value => {
      value.ownership.canonicalClientIsolationEvidence[0].sha256 = "0".repeat(64);
    },
    value => {
      value.ownership.payloadContinuityEvidence[0].sha256 = "0".repeat(64);
    },
    value => {
      value.ownership.releasePropagationRepairEvidence[0].sha256 = "0".repeat(64);
    },
    value => {
      value.ownership.rollbackRootGuardRepairEvidence[0].sha256 = "0".repeat(64);
    },
    value => {
      value.ownership.guardConvergenceRepairEvidence[0].sha256 = "0".repeat(64);
    },
    value => {
      value.ownership.forwardPayloadPinCorrectionEvidence[0].sha256 = "0".repeat(64);
    },
    value => {
      value.ownership.unconditionalGuardRoutingEvidence[0].sha256 = "0".repeat(64);
    },
    value => {
      value.ownership.paidCustomerAcceptanceEvidence[0].sha256 = "0".repeat(64);
    },
    value => {
      value.ownership.browserAcceptanceRepairEvidence[0].sha256 = "0".repeat(64);
    },
    value => {
      value.ownership.smokeSequencingRepairEvidence[0].sha256 = "0".repeat(64);
    },
    value => {
      value.ownership.probePropagationRepairEvidence[0].sha256 = "0".repeat(64);
    },
    value => {
      value.ownership.browserHealthDiagnosticsRepairEvidence[0].sha256 =
        "0".repeat(64);
    },
    value => {
      value.ownership.httpPathDiagnosticsRepairEvidence[0].sha256 =
        "0".repeat(64);
    },
    value => {
      value.ownership.browserManagedIconRepairEvidence[0].sha256 =
        "0".repeat(64);
    },
    value => {
      value.ownership.browserManagedIconSecretScanRepairEvidence[0].sha256 =
        "0".repeat(64);
    },
    value => {
      value.ownership.browserSmokeMarkerPropagationRepairEvidence[0].sha256 =
        "0".repeat(64);
    },
    value => {
      value.ownership.smokeTimeoutRepairEvidence[0].sha256 =
        "0".repeat(64);
    },
    value => {
      value.ownership.smokeReleaseContinuityEvidence[0].sha256 =
        "0".repeat(64);
    },
    value => {
      value.ownership.browserVersionStabilityRepairEvidence[0].sha256 =
        "0".repeat(64);
    },
    value => {
      value.ownership.productionIdentityInspectionEvidence[0].sha256 =
        "0".repeat(64);
    },
    value => {
      value.ownership.intelligenceSmokeTimeoutSynchronizationEvidence[0].sha256 =
        "0".repeat(64);
    },
    value => { value.rootCause.legacyQualificationArtifactDeployable = true; },
    value => { value.rootCause.firstDeploymentReachedProductionMutation = true; },
    value => { value.rootCause.secondDeploymentReachedProductionMutation = true; },
    value => { value.rootCause.thirdDeploymentDryRunCompleted = false; },
    value => { value.rootCause.thirdDeploymentForwardWranglerSpawned = true; },
    value => { value.rootCause.thirdDeploymentReachedProductionMutation = true; },
    value => { value.rootCause.fourthQualificationReachedArtifactBuild = true; },
    value => { value.rootCause.canonicalSmokeFailedRunsReachedProductionMutation = true; },
    value => { value.rootCause.canonicalSmokeFailedRuns = []; },
    value => { value.rootCause.publicRollbackBundleChanged = true; },
    value => { value.rootCause.propagationFailureReachedProductionMutation = false; },
    value => { value.rootCause.propagationFailureRollbackVerified = false; },
    value => { value.rootCause.rollbackRootGuardGap = "No gap."; },
    value => { value.rootCause.rollbackRootGuardRepair = "No repair."; },
    value => { value.rootCause.secondPropagationFailureRollbackVerified = false; },
    value => { value.rootCause.guardConvergenceGap = "No gap."; },
    value => { value.rootCause.browserManagedIconFailureRollbackVerified = false; },
    value => { value.rootCause.browserManagedIconRepair = "Broad suppression."; },
    value => { value.rootCause.browserSmokeMarkerFailureRollbackVerified = false; },
    value => { value.rootCause.browserSmokeMarkerRepair = "No repair."; },
    value => { value.rootCause.smokeTimeoutFailureRollbackVerified = false; },
    value => { value.rootCause.smokeTimeoutCause = "No cause."; },
    value => { value.rootCause.smokeTimeoutRepair = "No repair."; },
    value => { value.rootCause.browserVersionStabilityFailureRollbackVerified = false; },
    value => { value.rootCause.browserVersionStabilityCause = "No cause."; },
    value => { value.rootCause.browserVersionStabilityRepair = "Retry the application."; },
    value => { value.rootCause.productionIdentityInspectionNeed = "Not needed."; },
    value => { value.rootCause.productionIdentityInspectionRepair = "Print everything."; },
    value => { value.rootCause.guardConvergenceRepair = "No repair."; },
    value => { value.rootCause.forwardPayloadPinCorrection = "No correction."; },
    value => { value.rootCause.thirdPropagationFailureRollbackVerified = false; },
    value => { value.rootCause.unconditionalGuardRoutingGap = "No gap."; },
    value => { value.rootCause.prematureConvergenceDeadlineGap = "No gap."; },
    value => { value.rootCause.unconditionalGuardRoutingRepair = "No repair."; },
    value => { value.rootCause.concurrentSmokeFailureRollbackVerified = false; },
    value => { value.rootCause.concurrentSmokeFailureCause = "No cause."; },
    value => { value.rootCause.smokeSequencingRepair = "No repair."; },
    value => { value.rootCause.probePropagationFailureRollbackVerified = false; },
    value => { value.rootCause.probePropagationFailureCause = "No cause."; },
    value => { value.rootCause.probePropagationRepair = "No repair."; },
    value => { value.rootCause.browserHealthFailureRollbackVerified = false; },
    value => { value.rootCause.browserHealthDiagnosticGap = "No gap."; },
    value => { value.rootCause.browserHealthDiagnosticRepair = "No repair."; },
    value => {
      value.rootCause.runnerWorkspaceCause =
        "The temporary alias was rejected before the Wrangler process could start.";
    },
    value => { value.workflowBoundary.onlyTrigger = "push"; },
    value => { value.workflowBoundary.publicWorkerMutationAllowed = true; },
    value => { value.workflowBoundary.rebuildDuringDeploymentAllowed = true; },
    value => { value.workflowBoundary.forwardDeploymentAttempts = 2; },
    value => { value.workflowBoundary.automaticRetryAllowed = true; },
    value => { value.continuity.qualifiedForwardPayloadSha256 = "0".repeat(64); },
    value => { value.continuity.previousQualifiedForwardPayloadSha256 = "0".repeat(64); },
    value => { value.continuity.qualifiedRollbackBundleSha256 = "0".repeat(64); },
    value => { value.artifactBoundary.workerNameOverrideAllowed = true; },
    value => { value.artifactBoundary.phaseSpecificOutdirRequired = false; },
    value => { value.qualificationEvidence.localRealWrangler.status = "FAIL"; },
    value => {
      value.qualificationEvidence.cleanGithubRunner.qualificationMayPassWithoutEvidence = true;
    },
    value => { value.smokeBoundary.methods = ["GET", "POST"]; },
    value => { value.smokeBoundary.attemptedApplicationWrites = 1; },
    value => { value.smokeBoundary.redirectsFollowed = true; },
    value => { value.smokeBoundary.canonicalHtmlPath = "/index.html"; },
    value => { value.smokeBoundary.noncanonicalHtmlAliasesAllowed = true; },
    value => { value.smokeBoundary.runtimeGuardHistoricalReadOnlyAliasPreserved = false; },
    value => { value.smokeBoundary.exactWorkerVersionReleaseIdentityRequired = false; },
    value => { value.smokeBoundary.versionMetadataBinding = "WRONG_BINDING"; },
    value => { value.smokeBoundary.versionResponseHeader = "X-Wrong-Version"; },
    value => { value.smokeBoundary.fullSmokeVersionIdentityRequired = false; },
    value => { value.smokeBoundary.rollbackRootVersionIdentityRequired = false; },
    value => { value.smokeBoundary.rollbackRootComposedGuardTestRequired = false; },
    value => { value.smokeBoundary.fullFixedPlanConvergenceRequired = false; },
    value => { value.smokeBoundary.fixedNonsecretProbeClassificationRequired = false; },
    value => { value.smokeBoundary.forwardAndRollbackWorkerFirstUnconditional = false; },
    value => { value.smokeBoundary.selectiveWorkerFirstArraysAccepted = true; },
    value => { value.smokeBoundary.monotonicElapsedDeadline = false; },
    value => { value.smokeBoundary.attemptLimitControlsAcceptance = true; },
    value => { value.smokeBoundary.requestAndResponseLifecycleDeadlineEnforced = false; },
    value => { value.smokeBoundary.serverJwksTimeoutMilliseconds = 8000; },
    value => { value.smokeBoundary.responseSafetyMarginMilliseconds = 0; },
    value => { value.smokeBoundary.requestTimeoutMilliseconds = 2500; },
    value => { value.smokeBoundary.propagationMaximumWaitMilliseconds = 0; },
    value => { value.smokeBoundary.unsafeResponseRetryAllowed = true; },
    value => { value.smokeBoundary.credentialsOmittedFromBrowserState = false; },
    value => { value.smokeBoundary.browserVersionStabilityRequired = false; },
    value => { value.smokeBoundary.browserVersionStabilityConsecutiveProbes = 1; },
    value => { value.smokeBoundary.browserVersionStabilityMaximumAttempts = 100; },
    value => { value.smokeBoundary.browserVersionStabilityDelayMilliseconds = 0; },
    value => { value.smokeBoundary.browserVersionStabilityProbeTimeoutMilliseconds = 0; },
    value => { value.smokeBoundary.browserVersionStabilityFreshContextPerProbe = false; },
    value => { value.smokeBoundary.browserVersionStabilityJavaScriptDisabled = false; },
    value => { value.smokeBoundary.browserVersionStabilityHttpCacheDisabled = false; },
    value => { value.smokeBoundary.browserVersionStabilityServiceWorkerBypassed = false; },
    value => { value.smokeBoundary.browserVersionStabilityApplicationRetryAllowed = true; },
    value => { value.smokeBoundary.productionIdentityInspectionRequired = false; },
    value => { value.smokeBoundary.productionIdentityInspectionMethods = ["POST"]; },
    value => {
      value.smokeBoundary.productionIdentityInspectionCloudflareRequestCount = 5;
    },
    value => { value.smokeBoundary.productionIdentityInspectionMutationAllowed = true; },
    value => {
      value.smokeBoundary
        .productionIdentityInspectionCredentialValuesInOutputAllowed = true;
    },
    value => { value.runtimeBoundary.prospectiveCollection = "ON"; },
    value => { value.runtimeBoundary.activeCohorts = 1; },
    value => { value.runtimeBoundary.recommendationInfluence = "ON"; },
    value => { value.protectedEnvironment.secretValuesAccessed = true; },
    value => {
      value.protectedEnvironment.readOnlyNameAudit.CLOUDFLARE_ACCOUNT_ID = "ABSENT";
    },
    value => { value.protectedEnvironment.deploymentReady = false; },
    value => {
      value.releaseBoundary.failedDeploymentRunReachedProductionMutation = false;
    },
    value => {
      value.releaseBoundary.failedDeploymentRunRollbackVerified = false;
    },
    value => {
      value.releaseBoundary.runnerWorkspaceFailureReachedProductionMutation = true;
    },
    value => {
      value.releaseBoundary.wranglerScratchFailureReachedProductionMutation = true;
    },
    value => { value.releaseBoundary.publicRollbackBundleChanged = true; },
    value => { value.releaseBoundary.cleanRunnerRequalificationRequired = false; },
    value => { value.releaseBoundary.productionContactPerformedByThisGovernanceCommit = true; }
  ];
  for (const mutate of governanceMutations) {
    const changed = clone(governanceV2);
    mutate(changed);
    assert.equal(evaluateGithubActionsPrivateWorkerV2Governance({
      governance: changed,
      contract: contractV2
    }).ok, false);
  }

  const changedContract = clone(contractV2);
  changedContract.deployment.rebuildAllowed = true;
  assert.equal(evaluateGithubActionsPrivateWorkerV2Governance({
    governance: governanceV2,
    contract: changedContract
  }).ok, false);

  const changedBrowserAcceptance = clone(contractV2);
  changedBrowserAcceptance.browserAcceptance.allowedMethods.push("POST");
  assert.equal(evaluateGithubActionsPrivateWorkerV2Governance({
    governance: governanceV2,
    contract: changedBrowserAcceptance
  }).ok, false);

  const changedHealthClassification = clone(contractV2);
  changedHealthClassification.browserAcceptance.healthFailureClassification
    .arbitraryMessagesAllowed = true;
  assert.equal(evaluateGithubActionsPrivateWorkerV2Governance({
    governance: governanceV2,
    contract: changedHealthClassification
  }).ok, false);
});

test("governance rejects ownership, authorization, secret, runtime, and release drift", () => {
  const mutations = [
    value => { value.compatibilitySuccessor.implementationOwner = "Prometheus Overwatch"; },
    value => { value.compatibilitySuccessor.overwatchModifiedInfrastructureImplementation = true; },
    value => { value.compatibilitySuccessor.implementationCommit.commit = "0".repeat(40); },
    value => { value.compatibilitySuccessor.ownerEvidence[0].sha256 = "0".repeat(64); },
    value => { value.compatibilitySuccessor.authorizationModel.actor = "AnotherActor"; },
    value => { value.compatibilitySuccessor.authorizationModel.triggeringActor = "AnotherActor"; },
    value => { value.compatibilitySuccessor.authorizationModel.rerunAllowed = true; },
    value => { value.startingStateAudit.unverifiedDiagnosticWorkPushed = true; },
    value => { value.protectedPredecessorSuccessors[0].successorOwner = "Prometheus Infrastructure"; },
    value => { value.protectedOverwatchVerifierSuccessors[0].successorSha256 = "0".repeat(64); },
    value => { value.workflowBoundary.onlyTrigger = "push"; },
    value => { value.workflowBoundary.publicWorkerDeploymentAllowed = true; },
    value => { value.workflowBoundary.environmentRequiredReviewer = true; },
    value => { value.secretBoundary.verificationJobReceivesSecrets = true; },
    value => { value.secretBoundary.deploymentJobRequiresSuccessfulPreflight = false; },
    value => { value.deploymentSafety.oneWranglerDeploymentAttemptMaximum = false; },
    value => { value.deploymentSafety.smokeWriteAttemptsAllowed = 1; },
    value => { value.runtimeBoundary.prospectiveCollection = "ON"; },
    value => { value.runtimeBoundary.activeCohorts = 1; },
    value => { value.runtimeBoundary.recommendationInfluence = "ON"; },
    value => { value.runtimeBoundary.deploymentPerformedByBatch = true; },
    value => { value.manualSetupBoundary.deploymentReadyNow = true; },
    value => { value.rollback.nativeCloudflareRollbackAllowed = true; },
    value => { value.releaseBoundary.pushMayTriggerDeployment = true; },
    value => { value.releaseBoundary.deploymentAuthorizedByThisBatch = true; }
  ];
  for (const mutate of mutations) {
    const changed = clone(governance);
    mutate(changed);
    assert.equal(evaluate(changed).ok, false);
  }
});

test("report and Infrastructure contract cannot overstate readiness or external action", () => {
  const changedReport = clone(report);
  changedReport.runtimeBoundaries.deployment = "PERFORMED";
  assert.equal(evaluate(governance, changedReport).ok, false);

  const changedContract = clone(contract);
  changedContract.runtimeBoundaries.recommendationInfluence = "ON";
  assert.equal(evaluate(governance, report, changedContract).ok, false);
});

test("workflow rejects automatic, delegated, and broader trigger routes", () => {
  for (const changed of [
    workflow.replace("  workflow_dispatch:", "  push:\n  workflow_dispatch:"),
    workflow.replace("  workflow_dispatch:", "  schedule:\n  workflow_dispatch:"),
    workflow.replace("  workflow_dispatch:", "  repository_dispatch:\n  workflow_dispatch:"),
    workflow.replace("  workflow_dispatch:", "  workflow_call:\n  workflow_dispatch:"),
    workflow.replace("  contents: read", "  contents: write"),
    workflow.replace("  cancel-in-progress: false", "  cancel-in-progress: true")
  ]) assert.equal(evaluateGithubActionsPrivateWorkerWorkflow(changed).ok, false);
});

test("workflow rejects Founder identity, branch, rerun, and phrase drift", () => {
  for (const changed of [
    workflow.replace("github.actor == 'PrometheusRouteIQ'", "github.actor == 'AnotherActor'"),
    workflow.replace("github.triggering_actor == 'PrometheusRouteIQ'",
      "github.triggering_actor == 'AnotherActor'"),
    workflow.replace("github.ref == 'refs/heads/main'", "github.ref == 'refs/heads/release'"),
    workflow.replace("github.ref_name == 'main'", "github.ref_name == 'release'"),
    workflow.replace("@refs/heads/main'", "@refs/heads/release'"),
    workflow.replace("github.run_attempt == 1", "github.run_attempt >= 1"),
    workflow.replace(
      "I AUTHORIZE THIS EXACT PROMETHEUS PRIVATE WORKER DEPLOYMENT",
      "I AUTHORIZE A BROADER DEPLOYMENT"
    )
  ]) assert.equal(evaluateGithubActionsPrivateWorkerWorkflow(changed).ok, false);
});

test("workflow rejects missing, extra, or optional Founder inputs", () => {
  const missing = workflow.replace(
    /      founder_authorization:\n(?:        .*\n){3}/u,
    ""
  );
  const extra = workflow.replace(
    "permissions:\n",
    "      bypass:\n        description: Forbidden bypass\n        required: true\n        type: string\n\npermissions:\n"
  );
  const optional = workflow.replace(
    "      founder_authorization:\n        description: Type exactly I AUTHORIZE THIS EXACT PROMETHEUS PRIVATE WORKER DEPLOYMENT\n        required: true",
    "      founder_authorization:\n        description: Type exactly I AUTHORIZE THIS EXACT PROMETHEUS PRIVATE WORKER DEPLOYMENT\n        required: false"
  );
  for (const changed of [missing, extra, optional]) {
    assert.equal(evaluateGithubActionsPrivateWorkerWorkflow(changed).ok, false);
  }
});

test("workflow rejects secret access before successful no-secret preflight", () => {
  const verificationSecret = workflow.replace(
    "      - name: Install exact locked dependencies",
    "      - name: Inject forbidden secret\n        env:\n          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}\n        run: true\n\n      - name: Install exact locked dependencies"
  );
  const verificationEnvironment = workflow.replace(
    "  verification:\n    name:",
    "  verification:\n    environment: prometheus-private-worker-production\n    name:"
  );
  const noDependency = workflow.replace("    needs: verification\n", "");
  const bypassDependency = workflow.replace(
    "if: ${{ needs.verification.result == 'success' }}",
    "if: ${{ always() }}"
  );
  for (const changed of [
    verificationSecret,
    verificationEnvironment,
    noDependency,
    bypassDependency
  ]) assert.equal(evaluateGithubActionsPrivateWorkerWorkflow(changed).ok, false);
});

test("workflow rejects public targeting, direct Wrangler, and extra deployment attempts", () => {
  for (const changed of [
    workflow.replace(
      "run: node scripts/run-github-actions-private-worker-deployment.mjs deploy",
      "run: npx wrangler deploy --name prometheusrouteiq-website"
    ),
    workflow.replace(
      "run: node scripts/run-github-actions-private-worker-deployment.mjs deploy",
      "run: node scripts/run-github-actions-private-worker-deployment.mjs deploy\n      - run: node scripts/run-github-actions-private-worker-deployment.mjs deploy"
    )
  ]) assert.equal(evaluateGithubActionsPrivateWorkerWorkflow(changed).ok, false);
});

test("workflow rejects missing gates, environment drift, action drift, and caching", () => {
  for (const changed of [
    workflow.replace("        run: npm test", "        run: true"),
    workflow.replace("      name: prometheus-private-worker-production", "      name: unprotected"),
    workflow.replace(
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "actions/checkout@v4"
    ),
    workflow.replace("          node-version: \"24\"", "          node-version: \"24\"\n          cache: npm")
  ]) assert.equal(evaluateGithubActionsPrivateWorkerWorkflow(changed).ok, false);
});

test("Overwatch independently verifies the official Node 24 action successor", () => {
  const result = verifyOverwatchGithubActionsNode24PinSuccessor();
  assert.deepEqual({
    status: result.status,
    workflowFiles: result.workflowFiles,
    checkoutReferences: result.checkoutReferences,
    setupNodeReferences: result.setupNodeReferences,
    releaseIdentityChanged: result.releaseIdentityChanged
  }, {
    status: "OFFICIAL_NODE24_ACTION_PIN_OVERWATCH_VERIFIED",
    workflowFiles: 15,
    checkoutReferences: 39,
    setupNodeReferences: 39,
    releaseIdentityChanged: false
  });
  assert.deepEqual({
    successorWorkflowFiles: result.successorWorkflowFiles,
    activeWorkflowFiles: result.activeWorkflowFiles,
    successorCheckoutReferences: result.successorCheckoutReferences,
    successorSetupNodeReferences: result.successorSetupNodeReferences
  }, {
    successorWorkflowFiles: 1,
    activeWorkflowFiles: 16,
    successorCheckoutReferences: 2,
    successorSetupNodeReferences: 2
  });
});

test("Node 24 successor governance fails closed on pin, tag, and release drift", () => {
  const values = {
    governance: node24ActionPinGovernance,
    infrastructure: node24ActionPinInfrastructure,
    security: node24ActionPinSecurity,
    predecessorGovernance: toolchainGovernance
  };
  for (const mutate of [
    value => { value.governance.successor.checkout.commit = "0".repeat(40); },
    value => { value.governance.successor.movingTags = 1; },
    value => { value.governance.releaseIdentityContinuity.artifactSha256 =
      "0".repeat(64); }
  ]) {
    const candidate = structuredClone(values);
    mutate(candidate);
    assert.equal(evaluateOverwatchGithubActionsNode24PinSuccessor(candidate).ok, false);
  }
});

test("active private workflow accepts only the exact Infrastructure Node 24 successor", () => {
  const workflowEvidence = node24ActionPinInfrastructure.workflows.find(item =>
    item.path === ".github/workflows/deploy-prometheus-private-worker-v2.yml");
  const values = {
    governance: node24ActionPinGovernance,
    infrastructure: node24ActionPinInfrastructure,
    path: workflowEvidence.path,
    previousSha256: workflowEvidence.predecessorSha256,
    currentSha256: workflowEvidence.successorSha256
  };
  assert.equal(hasGithubActionsNode24InfrastructureSuccessor(values), true);
  assert.equal(hasGithubActionsNode24InfrastructureSuccessor({
    ...values,
    currentSha256: "0".repeat(64)
  }), false);
  assert.equal(hasGithubActionsNode24InfrastructureSuccessor({
    ...values,
    governance: {
      ...node24ActionPinGovernance,
      productionBoundary: {
        ...node24ActionPinGovernance.productionBoundary,
        deploymentCount: 1
      }
    }
  }), false);
});

test("private workflow composes only the exact controlled-rehearsal Node 24 successor", () => {
  const evidence = controlledRehearsalNode24InfrastructureSuccessor.evidence[0];
  const exact = {
    path: evidence.path,
    previousSha256: evidence.previousSha256,
    currentSha256: evidence.currentSha256
  };
  assert.equal(hasControlledRehearsalNode24InfrastructureSuccessor(exact), true);
  for (const changed of [
    { ...exact, path: "scripts/unrelated-verifier.mjs" },
    { ...exact, previousSha256: "0".repeat(64) },
    { ...exact, currentSha256: "0".repeat(64) },
    {
      ...exact,
      successor: {
        ...clone(controlledRehearsalNode24InfrastructureSuccessor),
        identity: "Prometheus Overwatch <overwatch@prometheus.local>"
      }
    },
    {
      ...exact,
      successor: {
        ...clone(controlledRehearsalNode24InfrastructureSuccessor),
        evidence: clone(controlledRehearsalNode24InfrastructureSuccessor.evidence)
          .slice(0, 1)
      }
    }
  ]) {
    assert.equal(hasControlledRehearsalNode24InfrastructureSuccessor(changed), false);
  }
});

test("fixed interoperability smoke is GET or HEAD only and bodyless", () => {
  const plan = fixedCloudflareUnattendedSmokePlan();
  assert.ok(plan.length > 0);
  assert.ok(plan.every(request => (
    ["GET", "HEAD"].includes(request.method)
    && request.redirect === "manual"
    && request.credentials === "omit"
    && request.body === false
  )));
});

test("canonical governance and workflow evaluations pass", () => {
  assert.equal(evaluate().ok, true);
  assert.equal(evaluateGithubActionsPrivateWorkerWorkflow(workflow).ok, true);
});

test("historical deployment gate ignores unrelated subsystem successors", () => {
  const result = evaluateGithubActionsPrivateWorkerSuccessorOwnership([{
    commit: "dashboard-successor",
    author: "Prometheus Dashboard <dashboard@prometheus.local>",
    committer: "Prometheus Dashboard <dashboard@prometheus.local>",
    paths: ["scripts/verify-dashboard-runtime-workflows.mjs"]
  }]);
  assert.equal(result.ok, true);

  const infrastructureWithSharedManifest =
    evaluateGithubActionsPrivateWorkerSuccessorOwnership([{
      commit: "infrastructure-shared-manifest-successor",
      author: "Prometheus Infrastructure <infrastructure@prometheus.local>",
      committer: "Prometheus Infrastructure <infrastructure@prometheus.local>",
      paths: [
        "package.json",
        "scripts/lib/github-actions-private-worker-deployment.mjs"
      ]
    }]);
  assert.equal(infrastructureWithSharedManifest.ok, true);
});

test("historical deployment gate rejects protected cross-owner successors", () => {
  const dashboardTouchesOverwatch =
    evaluateGithubActionsPrivateWorkerSuccessorOwnership([{
      commit: "dashboard-crosses-boundary",
      author: "Prometheus Dashboard <dashboard@prometheus.local>",
      committer: "Prometheus Dashboard <dashboard@prometheus.local>",
      paths: ["scripts/verify-overwatch-github-actions-private-worker-deployment.mjs"]
    }]);
  assert.equal(dashboardTouchesOverwatch.ok, false);

  const overwatchTouchesInfrastructure =
    evaluateGithubActionsPrivateWorkerSuccessorOwnership([{
      commit: "overwatch-crosses-boundary",
      author: "Prometheus Overwatch <overwatch@prometheus.local>",
      committer: "Prometheus Overwatch <overwatch@prometheus.local>",
      paths: ["scripts/lib/github-actions-private-worker-deployment.mjs"]
    }]);
  assert.equal(overwatchTouchesInfrastructure.ok, false);

  const overwatchTouchesBrowserAcceptance =
    evaluateGithubActionsPrivateWorkerSuccessorOwnership([{
      commit: "overwatch-crosses-browser-acceptance-boundary",
      author: "Prometheus Overwatch <overwatch@prometheus.local>",
      committer: "Prometheus Overwatch <overwatch@prometheus.local>",
      paths: [
        "scripts/verify-route-iq-private-paid-customer-production-browser-acceptance.mjs",
        "tests/route-iq-paid-customer-infrastructure-browser-acceptance.test.mjs"
      ]
    }]);
  assert.equal(overwatchTouchesBrowserAcceptance.ok, false);
});

test("private Workflow v2 governance rejects controlled-rehearsal successor drift", () => {
  for (const mutate of [
    value => {
      value.ownership.implementationControlledRehearsalRuntimeCommit.commit =
        "0".repeat(40);
    },
    value => {
      value.ownership.implementationControlledRehearsalLaneCommit.author =
        "Prometheus Overwatch <overwatch@prometheus.local>";
    },
    value => {
      value.ownership.controlledRehearsalRuntimeEvidence[0].sha256 =
        "0".repeat(64);
    },
    value => {
      value.ownership.controlledRehearsalLanePaths[0] = "package.json";
    },
    value => {
      value.controlledRehearsalSuccessor.historicalContinuityRewritten = true;
    },
    value => {
      value.controlledRehearsalSuccessor.qualifiedForwardPayloadSha256 =
        "0".repeat(64);
    },
    value => {
      value.controlledRehearsalSuccessor.qualifiedRollbackBundleSha256 =
        "0".repeat(64);
    },
    value => {
      value.liveCanonicalIdentitySuccessor.implementationCommit = "0".repeat(40);
    },
    value => {
      value.liveCanonicalIdentitySuccessor.deployParitySha256 = "0".repeat(64);
    },
    value => {
      value.liveCanonicalIdentitySuccessor.qualifiedForwardPayloadSha256 =
        "0".repeat(64);
    },
    value => {
      value.liveCanonicalIdentitySuccessor.productionMutationAuthorized = true;
    },
    value => {
      value.retentionDeletionPayloadSuccessor.implementationCommit = "0".repeat(40);
    },
    value => {
      value.retentionDeletionPayloadSuccessor.evidence[0].successorSha256 =
        "0".repeat(64);
    },
    value => {
      value.retentionDeletionPayloadSuccessor.qualifiedForwardPayloadSha256 =
        value.fieldSessionReportTypeSuccessor.qualifiedForwardPayloadSha256;
    },
    value => {
      value.retentionDeletionPayloadSuccessor.deploymentAuthorized = true;
    },
    value => {
      value.retentionDeletionPayloadQualificationSuccessor.implementationCommit =
        "0".repeat(40);
    },
    value => {
      value.retentionDeletionPayloadQualificationSuccessor.evidence[0].successorSha256 =
        "0".repeat(64);
    },
    value => {
      value.retentionDeletionPayloadQualificationSuccessor.qualifiedForwardPayloadSha256 =
        value.retentionDeletionPayloadSuccessor.qualifiedForwardPayloadSha256;
    },
    value => {
      value.retentionDeletionPayloadQualificationSuccessor.deploymentAuthorized = true;
    },
    value => {
      value.retentionMaintenancePayloadSuccessor.implementationCommit = "0".repeat(40);
    },
    value => {
      value.retentionMaintenancePayloadSuccessor.evidence[0].successorSha256 =
        "0".repeat(64);
    },
    value => {
      value.retentionMaintenancePayloadSuccessor.qualifiedForwardPayloadSha256 =
        value.retentionDeletionPayloadQualificationSuccessor.qualifiedForwardPayloadSha256;
    },
    value => {
      value.retentionMaintenancePayloadSuccessor.deploymentAuthorized = true;
    },
    value => {
      value.governedLearningPayloadSuccessor.implementationCommit = "0".repeat(40);
    },
    value => {
      value.governedLearningPayloadSuccessor.evidence[0].successorSha256 =
        "0".repeat(64);
    },
    value => {
      value.governedLearningPayloadSuccessor.deployParitySha256 =
        value.retentionMaintenancePayloadSuccessor.deployParitySha256;
    },
    value => {
      value.governedLearningPayloadSuccessor.deploymentAuthorized = true;
    },
    value => {
      value.outcomeSemanticIntegrityPayloadSuccessor.implementationCommit = "0".repeat(40);
    },
    value => {
      value.outcomeSemanticIntegrityPayloadSuccessor.evidence[0].successorSha256 =
        "0".repeat(64);
    },
    value => {
      value.outcomeSemanticIntegrityPayloadSuccessor.deployParitySha256 =
        value.retentionMaintenancePayloadSuccessor.deployParitySha256;
    },
    value => {
      value.outcomeSemanticIntegrityPayloadSuccessor.deploymentAuthorized = true;
    },
    value => {
      value.dashboardVisualDeployParitySuccessor.implementationCommit = "0".repeat(40);
    },
    value => {
      value.dashboardVisualDeployParitySuccessor.deployParitySha256 = "0".repeat(64);
    },
    value => {
      value.dashboardVisualDeployParitySuccessor.protectedState.collection = "ON";
    }
  ]) {
    const candidate = clone(governanceV2);
    mutate(candidate);
    const result = evaluateGithubActionsPrivateWorkerV2Governance({
      governance: candidate,
      contract: contractV2
    });
    assert.equal(result.ok, false);
  }
});

test("private Workflow v2 admits only the exact field-session Intelligence successor", () => {
  assert.equal(evaluatePrivateWorkflowV2FieldSessionReportTypeSuccessor({
    governance: fieldSessionReportTypeGovernance
  }).ok, true);

  for (const mutate of [
    value => { value.ownerCommits[2].commit = "0".repeat(40); },
    value => { value.ownerCommits[2].identity = "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.ownerCommits[2].paths[0] = "workers/infrastructure/unauthorized"; },
    value => { value.ownerCommits[4].identity = "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.privateWorkflowContinuity.currentForwardPayloadSha256 = "0".repeat(64); },
    value => { value.acceptedContract.exactReportTypeAllowlist.push("report-prefix-v1"); },
    value => { value.protectedState.collection = "ON"; },
    value => { value.releaseBoundary.deploymentAuthorized = true; }
  ]) {
    const candidate = clone(fieldSessionReportTypeGovernance);
    mutate(candidate);
    assert.equal(evaluatePrivateWorkflowV2FieldSessionReportTypeSuccessor({
      governance: candidate
    }).ok, false);
  }
});

test("private Workflow v2 composes the exact ordered retention payload successors", () => {
  for (const [path, previousSha256] of Object.entries({
    "scripts/lib/github-actions-private-worker-workflow-v2.mjs":
      "b3763384b6e23079f58fedaed68f63ac8fb0fd52ed5acb22478e003200a923b0",
    "tests/github-actions-private-worker-workflow-v2.test.mjs":
      "ebe86706cbf5e9cdac53a3446306df81aa054e5f63df99c7218237284e459b5d",
    "workers/infrastructure/github-actions-private-worker-deployment-v2.json":
      "30810573fc0926c03a6bbc5337db4ce7030c419a4b08c64b219db7c3abeb371b"
  })) {
    const historicalSuccessorSha256 = governanceV2.retentionDeletionPayloadSuccessor.evidence
      .find(item => item.path === path).successorSha256;
    assert.equal(hasRetentionDeletionPayloadInfrastructureSuccessor({
      governance: governanceV2,
      fieldSessionReportTypeGovernance,
      liveCanonicalIdentityGovernance,
      readinessSuccessors: currentReadinessSuccessors,
      path,
      previousSha256,
      currentSha256: historicalSuccessorSha256
    }), true);
    assert.equal(hasRetentionDeletionPayloadQualificationInfrastructureSuccessor({
      governance: governanceV2,
      fieldSessionReportTypeGovernance,
      liveCanonicalIdentityGovernance,
      readinessSuccessors: currentReadinessSuccessors,
      path,
      previousSha256,
      currentSha256: governanceV2.retentionDeletionPayloadQualificationSuccessor.evidence
        .find(item => item.path === path).successorSha256
    }), true);
    assert.equal(hasRetentionMaintenancePayloadInfrastructureSuccessor({
      governance: governanceV2,
      fieldSessionReportTypeGovernance,
      liveCanonicalIdentityGovernance,
      readinessSuccessors: currentReadinessSuccessors,
      path,
      previousSha256,
      currentSha256: governanceV2.governedLearningPayloadSuccessor.evidence
        .find(item => item.path === path).previousSha256
    }), true);
    assert.equal(hasGovernedLearningPayloadInfrastructureSuccessor({
      governance: governanceV2,
      fieldSessionReportTypeGovernance,
      liveCanonicalIdentityGovernance,
      readinessSuccessors: currentReadinessSuccessors,
      path,
      previousSha256,
      currentSha256: governanceV2.outcomeSemanticIntegrityPayloadSuccessor.evidence
        .find(item => item.path === path).previousSha256
    }), true);
    const outcomeSemanticSuccessorSha256 =
      governanceV2.outcomeSemanticIntegrityPayloadSuccessor.evidence
        .find(item => item.path === path).successorSha256;
    assert.equal(hasOutcomeSemanticIntegrityPayloadInfrastructureSuccessor({
      governance: governanceV2,
      fieldSessionReportTypeGovernance,
      liveCanonicalIdentityGovernance,
      readinessSuccessors: currentReadinessSuccessors,
      path,
      previousSha256,
      currentSha256: outcomeSemanticSuccessorSha256
    }), true);
    const currentSha256 = sha256(read(path));
    if (currentSha256 !== outcomeSemanticSuccessorSha256) {
      const visualEvidence = governanceV2.dashboardVisualDeployParitySuccessor.evidence
        .find(item => item.path === path);
      if (visualEvidence.previousSha256 !== outcomeSemanticSuccessorSha256) {
        assert.equal(hasProspectiveCalibrationSourceQualificationGuardSuccessor({
          path,
          previousSha256: outcomeSemanticSuccessorSha256,
          currentSha256: visualEvidence.previousSha256
        }), true);
      }
      assert.equal(hasPrivateWorkflowV2DashboardVisualDeployParitySuccessor({
        governance: governanceV2,
        path,
        previousSha256: visualEvidence.previousSha256,
        currentSha256
      }), true);
    }
  }
  const changed = clone(governanceV2);
  changed.retentionDeletionPayloadSuccessor.evidence[0].previousSha256 =
    "0".repeat(64);
  assert.equal(hasRetentionDeletionPayloadInfrastructureSuccessor({
    governance: changed,
    fieldSessionReportTypeGovernance,
    liveCanonicalIdentityGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path: "scripts/lib/github-actions-private-worker-workflow-v2.mjs",
    previousSha256:
      "b3763384b6e23079f58fedaed68f63ac8fb0fd52ed5acb22478e003200a923b0",
    currentSha256: governanceV2.retentionDeletionPayloadSuccessor.evidence[0].successorSha256
  }), false);
  const changedQualification = clone(governanceV2);
  changedQualification.retentionDeletionPayloadQualificationSuccessor
    .evidence[0].previousSha256 = "0".repeat(64);
  assert.equal(hasRetentionDeletionPayloadQualificationInfrastructureSuccessor({
    governance: changedQualification,
    fieldSessionReportTypeGovernance,
    liveCanonicalIdentityGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path: "scripts/lib/github-actions-private-worker-workflow-v2.mjs",
    previousSha256:
      "b3763384b6e23079f58fedaed68f63ac8fb0fd52ed5acb22478e003200a923b0",
    currentSha256: sha256(read(
      "scripts/lib/github-actions-private-worker-workflow-v2.mjs"
    ))
  }), false);
  const changedMaintenance = clone(governanceV2);
  changedMaintenance.retentionMaintenancePayloadSuccessor
    .evidence[0].previousSha256 = "0".repeat(64);
  assert.equal(hasRetentionMaintenancePayloadInfrastructureSuccessor({
    governance: changedMaintenance,
    fieldSessionReportTypeGovernance,
    liveCanonicalIdentityGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path: "scripts/lib/github-actions-private-worker-workflow-v2.mjs",
    previousSha256:
      "b3763384b6e23079f58fedaed68f63ac8fb0fd52ed5acb22478e003200a923b0",
    currentSha256: sha256(read(
      "scripts/lib/github-actions-private-worker-workflow-v2.mjs"
    ))
  }), false);
  const changedGovernedLearning = clone(governanceV2);
  changedGovernedLearning.governedLearningPayloadSuccessor
    .evidence[0].previousSha256 = "0".repeat(64);
  assert.equal(hasGovernedLearningPayloadInfrastructureSuccessor({
    governance: changedGovernedLearning,
    fieldSessionReportTypeGovernance,
    liveCanonicalIdentityGovernance,
    readinessSuccessors: currentReadinessSuccessors,
    path: "scripts/lib/github-actions-private-worker-workflow-v2.mjs",
    previousSha256:
      "b3763384b6e23079f58fedaed68f63ac8fb0fd52ed5acb22478e003200a923b0",
    currentSha256: sha256(read(
      "scripts/lib/github-actions-private-worker-workflow-v2.mjs"
    ))
  }), false);
});

test("private Workflow v2 composes only the governed retention-deletion Intelligence successors", () => {
  assert.equal(evaluatePrivateWorkflowV2RetentionDeletionIntelligenceSuccessors({
    governance: retentionDeletionGovernance
  }).ok, true);

  for (const mutate of [
    value => { value.ownership.commits["Prometheus Intelligence Engine"][2] = "0".repeat(40); },
    value => { value.qualificationRepair.liveCanonicalIdentity.verifier.sha256 = "0".repeat(64); },
    value => { value.qualificationRepair.liveCanonicalIdentity.protectedSuccessor.sha256 = "0".repeat(64); },
    value => { value.qualificationRepair.offRouteRetentionContractComposition
      .ownerRepairCommit = "0".repeat(40); },
    value => { value.qualificationRepair.offRouteRetentionContractComposition
      .files[0].sha256 = "0".repeat(64); },
    value => { value.qualificationRepair.offRouteRetentionContractComposition
      .protectedStateRequired.prospectiveCollection = "ON"; },
    value => { value.protectedState.collection = "ON"; },
    value => { value.infrastructureBoundary.deploymentAuthorized = true; }
  ]) {
    const candidate = clone(retentionDeletionGovernance);
    mutate(candidate);
    assert.equal(evaluatePrivateWorkflowV2RetentionDeletionIntelligenceSuccessors({
      governance: candidate
    }).ok, false);
  }
});
