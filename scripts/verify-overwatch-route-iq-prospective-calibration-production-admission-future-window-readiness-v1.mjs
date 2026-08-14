import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  verifyControlledOnboardingRehearsalSmokeContractSuccessor
} from "../intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs";
import { verifyShadowDecisionReadiness } from "./verify-shadow-decision-readiness.mjs";
import {
  verifyRouteIqProspectiveRetentionIntelligence
} from "./verify-route-iq-prospective-retention-intelligence.mjs";
import {
  verifyOverwatchRouteIqProspectiveEvidenceRetention
} from "./verify-overwatch-route-iq-prospective-evidence-retention.mjs";

const root = resolve(import.meta.dirname, "..");
const governancePath =
  "overwatch/governance/route-iq-prospective-calibration-production-admission-future-window-readiness-v1.json";
const reportPath =
  "overwatch/reports/BATCH-20260814-001-route-iq-prospective-calibration-production-admission-future-window-readiness.json";

const read = path => readFileSync(resolve(root, path));
const readText = path => read(path).toString("utf8");
const readJson = path => JSON.parse(readText(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const git = (...args) => execFileSync("/usr/bin/git", args, {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024,
  stdio: ["ignore", "pipe", "ignore"]
}).trim();

function verifyCommit(record) {
  assert.deepEqual(
    git("show", "-s", "--format=%H%n%T%n%an <%ae>%n%cn <%ce>%n%s", record.commit)
      .split("\n"),
    [record.commit, record.tree, record.owner, record.owner, record.subject]
  );
  execFileSync("/usr/bin/git", ["merge-base", "--is-ancestor", record.commit, "HEAD"], {
    cwd: root,
    stdio: "ignore"
  });
}

function verifyWorkflowPins(governance) {
  const handoff = governance.privateWorkflowV2Handoff;
  const qualification = readText(handoff.designatedQualificationWorkflow.path);
  const deployment = readText(handoff.designatedDeploymentWorkflow.path);
  assert.equal(sha256(qualification), handoff.designatedQualificationWorkflow.sha256);
  assert.equal(sha256(deployment), handoff.designatedDeploymentWorkflow.sha256);
  assert.match(qualification, /node-version: "24\.4\.1"/u);
  assert.match(deployment, /node-version: "24\.4\.1"/u);
  for (const source of [qualification, deployment]) {
    assert.match(source,
      /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/u);
    assert.match(source,
      /actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020/u);
  }
  assert.match(qualification,
    /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/u);
  assert.match(deployment,
    /actions\/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0/u);
  assert.equal(sha256(read(handoff.workflowContract.path)), handoff.workflowContract.sha256);
  assert.equal(sha256(read(handoff.privateRollbackContractSource.path)),
    handoff.privateRollbackContractSource.sha256);
  assert.equal(sha256(read(handoff.privateRollbackWranglerSource.path)),
    handoff.privateRollbackWranglerSource.sha256);
  assert.equal(sha256(read(handoff.privateRollbackInertSource.path)),
    handoff.privateRollbackInertSource.sha256);
  assert.equal(handoff.targetWorker, "prometheus-iq");
  assert.equal(handoff.protectedEnvironment, "prometheus-private-worker-production");
  assert.equal(handoff.existingQualificationArtifactIncludesNewModules, false);
  assert.equal(handoff.existingQualificationArtifactStatus,
    "STALE_PREDECESSOR_NOT_DEPLOYABLE_FOR_THIS_SOURCE");
  assert.equal(handoff.deploymentWorkflowConsumesExactArtifactWithoutRebuild, true);
  for (const key of [
    "finalForwardPayloadSha256",
    "finalRollbackBundleSha256",
    "finalManifestSha256",
    "finalContentTreeSha256"
  ]) assert.equal(handoff[key], "REQUIRES_SEPARATE_PRIVATE_V2_QUALIFICATION");
  assert.equal(handoff.qualificationOrDeploymentDispatchedByThisBatch, false);
}

export async function verifyOverwatchProspectiveCalibrationProductionAdmissionFutureWindowReadiness() {
  const governance = readJson(governancePath);
  const report = readJson(reportPath);
  assert.equal(governance.batchId, "BATCH-20260814-001");
  assert.equal(governance.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(governance.status,
    "SOURCE_COMPLETE_UNDEPLOYED_HOSTED_QUALIFICATION_PENDING");
  assert.equal(git("rev-parse", `${governance.startingRepository.commit}^{tree}`),
    governance.startingRepository.tree);
  assert.equal(governance.startingRepository.commit,
    "5578456b8d5aca8b123708fcec1c1b34bea9f475");
  assert.equal(governance.startingRepository.tree,
    "8d880bdd6fb43bbad9bcc0d73434e1696ed31370");
  assert.equal(git("branch", "--show-current"), "main");

  for (const record of governance.functionalOwnerCommits) verifyCommit(record);
  for (const commit of governance.provenanceAndCompatibilityCommits) {
    assert.equal(git("cat-file", "-t", commit), "commit");
    execFileSync("/usr/bin/git", ["merge-base", "--is-ancestor", commit, "HEAD"], {
      cwd: root,
      stdio: "ignore"
    });
  }
  for (const pin of governance.criticalPins) {
    assert.equal(sha256(read(pin.path)), pin.sha256, `Protected pin drifted: ${pin.path}`);
  }

  const historical = governance.historicalProtection;
  assert.equal(sha256(read(historical.julyReadinessConfigPath)),
    historical.julyReadinessConfigSha256);
  assert.equal(read(historical.julyReadinessConfigPath).byteLength,
    historical.julyReadinessConfigByteLength);
  execFileSync("/usr/bin/git", [
    "diff", "--quiet", `${governance.startingRepository.commit}..HEAD`, "--",
    "data/route-iq-field-sessions-v1/workspaces"
  ], { cwd: root, stdio: "ignore" });
  assert.equal(historical.historicalFieldSessionArchivesChanged, false);
  assert.equal(historical.historicalEvaluationEvidenceChanged, false);
  assert.equal(historical.historicalEvidenceReassigned, false);

  assert.deepEqual(governance.readinessThresholds, {
    minimumTotalSamples: 97,
    calibrationBins: 5,
    minimumSupportingRecordsPerPopulatedBin: 20,
    minimumSupportedEvaluationWindows: 2,
    minimumConsecutivePassingWindows: 2,
    changed: false
  });
  assert.equal(governance.admissionBoundary.maximumAgeMilliseconds, 300000);
  assert.equal(governance.admissionBoundary.providerAvailableByDefault, false);
  assert.equal(governance.admissionBoundary.liveAdmissionCount, 0);
  assert.equal(governance.futureWindowBoundary.minimumFutureEvaluationWindows, 2);
  assert.equal(governance.futureWindowBoundary.gapsAllowed, false);
  assert.equal(governance.futureWindowBoundary.overlapsAllowed, false);
  assert.equal(governance.futureWindowBoundary.retroactiveReassignmentAllowed, false);

  const successor = verifyControlledOnboardingRehearsalSmokeContractSuccessor()
    .prospectiveCalibrationProductionAdmissionSuccessor.successor;
  assert.equal(successor.batchId, governance.batchId);
  assert.equal(successor.truthState.governedLearning, "INSUFFICIENT_EVIDENCE");
  assert.equal(successor.truthState.shadowEligibleDecisions, 0);
  assert.equal(successor.truthState.newCanonicalEvidenceCreated, false);
  assert.equal(successor.protectedState.collection, "OFF");
  assert.equal(successor.protectedState.activeCohorts, 0);
  assert.equal(successor.protectedState.recommendationInfluence, "OFF");
  const retention = verifyRouteIqProspectiveRetentionIntelligence();
  assert.equal(retention.readiness, "INSUFFICIENT_EVIDENCE");
  assert.equal(retention.collection, "OFF");
  const shadow = verifyShadowDecisionReadiness({ write: false });
  assert.equal(shadow.readinessState, "INSUFFICIENT_EVIDENCE");
  assert.equal(shadow.shadows, 0);
  assert.equal(shadow.recommendationInfluence, "OFF");
  const historicalRetention = await verifyOverwatchRouteIqProspectiveEvidenceRetention();
  assert.equal(historicalRetention.status, "PASS");

  verifyWorkflowPins(governance);
  assert.equal(governance.toolchain.wrangler, "4.120.1");
  assert.equal(governance.toolchain.miniflare, "5.20260804.0-alpha");
  assert.equal(sha256(read("package-lock.json")), governance.toolchain.packageLockSha256);
  assert.deepEqual(governance.patentReview, {
    patentRecordChangeRequired: false,
    classification: "WITHIN_EXISTING_DOCUMENTED_IP_001_AND_SHADOW_DECISION_SCOPE"
  });
  assert.deepEqual(governance.protectedState, {
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    confidencePropagation: "OFF",
    providers: "OFF",
    scheduler: "OFF",
    shadowDecisionVisible: false,
    productionMutations: 0,
    productionStorageAccess: 0,
    cloudflareEngineeringContacts: 0,
    deployments: 0,
    truthState: "INSUFFICIENT_EVIDENCE"
  });
  assert.equal(report.verdict,
    "SOURCE_COMPLETE_UNDEPLOYED_HOSTED_QUALIFICATION_PENDING");
  assert.equal(report.qualification.focusedTotal, "PASS_171_OF_171");
  assert.equal(report.releaseBoundary.deploymentAuthorized, false);

  return Object.freeze({
    status: "PASS",
    batchId: governance.batchId,
    ownerCommitCount: governance.functionalOwnerCommits.length
      + governance.provenanceAndCompatibilityCommits.length,
    criticalPinCount: governance.criticalPins.length,
    focusedTests: 171,
    readiness: "INSUFFICIENT_EVIDENCE",
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    cloudflareContacts: 0,
    productionMutations: 0,
    deployments: 0,
    privateArtifact: "REQUIRES_SEPARATE_PRIVATE_V2_QUALIFICATION"
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  process.stdout.write(`${JSON.stringify(
    await verifyOverwatchProspectiveCalibrationProductionAdmissionFutureWindowReadiness(),
    null,
    2
  )}\n`);
}
