import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  dryRunRouteIqRetentionMaintenanceReleasePackage
} from "../workers/infrastructure/route-iq-retention-maintenance-release-package.mjs";
import {
  PUBLIC_FORWARD_ROLLBACK_BUILD_SOURCE,
  verifyPublicForwardRollbackBuildSource
} from "./lib/route-iq-public-forward-rollback.mjs";

const governancePath =
  "overwatch/governance/route-iq-dormant-retention-maintenance-deployment-readiness-v1.json";
const reportPath =
  "overwatch/reports/BATCH-20260809-002-route-iq-dormant-retention-maintenance-deployment-readiness.json";
const releaseContractPath =
  "workers/infrastructure/route-iq-retention-maintenance-release-package-v1.json";
const runtimeContractPath =
  "workers/infrastructure/route-iq-retention-maintenance-runtime-v1.json";
const forwardRollbackPath =
  "workers/infrastructure/route-iq-retention-maintenance-forward-revert-v1.json";
const securityTriagePath =
  "security/npm-high-advisory-triage-batch-20260809-002.json";
const intelligenceSuccessorPath =
  "intelligence/provenance/protected-baseline-synchronization-retention-maintenance-consumer-admission-v1.json";
const startCommit = "78ec6ceecf7c0420b6da7d9f3e7bbbd62b48ae2e";
const startTree = "387760d6e7182e83ec06364abd4fc74bd5a94c07";

const ownerCommits = Object.freeze({
  "1511fe6778138c4b662381be5e6b03109e21e43d": Object.freeze({
    name: "Prometheus Overwatch",
    email: "overwatch@prometheus.local",
    files: Object.freeze([
      "PROMETHEUS_MASTER_ENGINEERING_STATE.md",
      "overwatch/governance/route-iq-retention-expiry-deletion-runtime-v1-acceptance.json"
    ])
  }),
  "b71bd0a99ff8d992694df542ec969a071c7b353d": Object.freeze({
    name: "Prometheus Infrastructure",
    email: "infrastructure@prometheus.local",
    files: Object.freeze([
      "tests/route-iq-retention-maintenance-infrastructure.test.mjs",
      "workers/infrastructure/route-iq-retention-maintenance-forward-revert-v1.json",
      "workers/infrastructure/route-iq-retention-maintenance-production-admission.js",
      "workers/infrastructure/route-iq-retention-maintenance-release-package-v1.json",
      "workers/infrastructure/route-iq-retention-maintenance-release-package.mjs",
      "workers/infrastructure/route-iq-retention-maintenance-runtime-v1.json",
      "workers/infrastructure/route-iq-retention-maintenance-runtime.js"
    ])
  }),
  "de7b3fb7ad28c621d10edb40b7225c2a2ce0b4c1": Object.freeze({
    name: "Prometheus Security",
    email: "security@prometheus.local",
    files: Object.freeze([
      "package-lock.json",
      "security/npm-high-advisory-triage-batch-20260809-002.json",
      "tests/route-iq-npm-high-advisory-triage-batch-20260809-002-security.test.mjs"
    ])
  }),
  "1513b1acec6b303823e26252c5bcf77efa05ad62": Object.freeze({
    name: "Prometheus Data",
    email: "data@prometheus.local",
    files: Object.freeze([
      "data/route-iq-field-sessions-v1/README.md",
      "data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs",
      "tests/route-iq-retention-production-legal-hold-readiness.test.mjs"
    ])
  }),
  "c2bdfa3035383293afeb7e4a16704cb121c01716": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze([
      "intelligence/provenance/specifications/prospective-retention-admission-v1.json",
      "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
      "scripts/validate-intelligence-architecture.mjs",
      "scripts/verify-route-iq-prospective-retention-intelligence.mjs",
      "tests/route-iq-prospective-retention-intelligence.test.mjs"
    ])
  }),
  "0faca7bb91b3e4ddbe7c1996ca84cc9247cd205a": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze([
      "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs"
    ])
  }),
  "04e71df9f1f1c4ddef1a5a13dc46192b057682d4": Object.freeze({
    name: "Prometheus Intelligence Engine",
    email: "intelligence@prometheus.local",
    files: Object.freeze([
      "intelligence/provenance/protected-baseline-synchronization-retention-maintenance-consumer-admission-v1.json"
    ])
  }),
  "ae4e8def3e1142d6c9c99b709179f4be91c1acea": Object.freeze({
    name: "Prometheus Infrastructure",
    email: "infrastructure@prometheus.local",
    files: Object.freeze([
      "scripts/lib/github-actions-private-worker-workflow-v2.mjs",
      "tests/github-actions-private-worker-workflow-v2.test.mjs",
      "workers/infrastructure/github-actions-private-worker-deployment-v2.json"
    ])
  })
});

const read = path => readFileSync(path);
const readJson = path => JSON.parse(read(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

function changedPaths(commit) {
  const value = git("diff-tree", "--no-commit-id", "--name-only", "-r", commit);
  return value ? value.split("\n").sort() : [];
}

function exactMainCheckout({ branch, head, originMain, environment = {} }) {
  if (head !== originMain) return false;
  if (branch === "main") return true;
  return branch === ""
    && environment.GITHUB_ACTIONS === "true"
    && environment.GITHUB_REF === "refs/heads/main"
    && environment.GITHUB_REF_NAME === "main"
    && environment.GITHUB_REF_TYPE === "branch"
    && environment.GITHUB_SHA === head;
}

function assertAllFalse(value, dimension) {
  for (const [key, enabled] of Object.entries(value)) {
    assert.equal(enabled, false, `${dimension}.${key} must remain false.`);
  }
}

export function validateDormantRetentionMaintenanceReadiness({
  governance,
  report,
  releaseContract,
  runtimeContract,
  forwardRollback,
  securityTriage,
  intelligenceSuccessor,
  dryRun
}) {
  assert.equal(governance.batchId, "BATCH-20260809-002");
  assert.equal(governance.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(governance.candidateStatus, "SOURCE_COMPLETE_DORMANT_HOSTED_QUALIFICATION_REQUIRED");
  assert.equal(governance.startingRepository.commit, startCommit);
  assert.equal(governance.startingRepository.tree, startTree);
  assert.equal(governance.predecessorAcceptance.hostedRunId, 31343531077);
  assert.equal(governance.predecessorAcceptance.tests, 1606);
  assert.equal(governance.predecessorAcceptance.passed, 1602);
  assert.equal(governance.predecessorAcceptance.failed, 0);
  assert.equal(governance.predecessorAcceptance.skipped, 4);
  assert.equal(governance.predecessorAcceptance.buildModules, 991);
  assert.equal(governance.predecessorAcceptance.immutableBatchReportRewritten, false);
  assert.equal(governance.historicalVerifierComposition.historicalPinsRewritten, false);
  assert.deepEqual(governance.ownership.hostedQualificationRepair, {
    ownerSubsystem: "Prometheus Overwatch",
    email: "overwatch@prometheus.local",
    commit: "43be570ea4140960ce7d946a0b0191eb99a0ad88",
    tree: "bb8337bd03021af2183eb56c9e19574e95db16cd",
    subject: "overwatch: repair retention maintenance qualification",
    expectedParent: "432eefb987afb06bf5c49241911953aaab559331",
    failedRunId: 31348734489,
    failureClassification:
      "HISTORICAL_VERIFIER_OMITTED_GOVERNED_RETENTION_MAINTENANCE_PAYLOAD_SUCCESSOR",
    runtimeChanged: false,
    releasePayloadChanged: false,
    productionContactCount: 0,
    productionMutationCount: 0,
    changedPaths: [
      "overwatch/governance/route-iq-dormant-retention-maintenance-deployment-readiness-v1.json",
      "overwatch/reports/BATCH-20260809-002-route-iq-dormant-retention-maintenance-deployment-readiness.json",
      "scripts/verify-overwatch-controlled-paid-customer-onboarding-rehearsal-v1.mjs",
      "scripts/verify-overwatch-route-iq-retention-maintenance-deployment-readiness.mjs",
      "tests/overwatch-controlled-paid-customer-onboarding-rehearsal-v1.test.mjs",
      "tests/overwatch-route-iq-retention-maintenance-deployment-readiness.test.mjs"
    ]
  });
  assert.deepEqual(governance.ownership.hostedFullSuiteRepair, {
    failedRunId: 31349044214,
    failureClassifications: [
      "MASTER_STATE_ASSERTION_LAGGED_CURRENT_DORMANT_PACKAGE_BOUNDARY",
      "RELEASE_PROVENANCE_VERIFIER_OMITTED_OWNER_AUTHORED_RETENTION_MAINTENANCE_SUCCESSOR",
      "PUBLIC_FORWARD_ROLLBACK_LOCK_PIN_LAGGED_SAFE_SECURITY_PATCH"
    ],
    runtimeChanged: false,
    releasePayloadChanged: false,
    publicForwardRollbackArtifactChanged: false,
    productionContactCount: 0,
    productionMutationCount: 0,
    infrastructureRepair: {
      ownerSubsystem: "Prometheus Infrastructure",
      email: "infrastructure@prometheus.local",
      commit: "929856fcf7377be0aa08888d04ca68c801ad6002",
      parent: "43be570ea4140960ce7d946a0b0191eb99a0ad88",
      tree: "8879320360a1b5b908cf0727028a7ed5570bc048",
      subject: "infrastructure: preserve public rollback after lock patch",
      changedPaths: [
        "scripts/lib/route-iq-public-forward-rollback.mjs",
        "tests/route-iq-public-forward-rollback-pinned-source.test.mjs"
      ],
      previousPackageLockSha256:
        "70bb4bb8a4ed855307ca98c0efd295e23825504bf225609d16be474640134a0c",
      currentPackageLockSha256:
        "aa398a24dec737ccfbf49c83ccafdc9a284ebe639cb065dafb48358de7be0782",
      publicForwardRollbackArtifactSha256:
        "e3330c71600364e4e22404d005902bdcf07e5ec12fe9aa098febd01e18a3b2c6"
    },
    finalOverwatchRepair: {
      ownerSubsystem: "Prometheus Overwatch",
      email: "overwatch@prometheus.local",
      subject: "overwatch: repair retention maintenance full qualification",
      expectedParent: "929856fcf7377be0aa08888d04ca68c801ad6002",
      changedPaths: [
        "overwatch/governance/route-iq-dormant-retention-maintenance-deployment-readiness-v1.json",
        "overwatch/reports/BATCH-20260809-002-route-iq-dormant-retention-maintenance-deployment-readiness.json",
        "scripts/verify-overwatch-route-iq-retention-maintenance-deployment-readiness.mjs",
        "scripts/verify-release-provenance-repair.mjs",
        "tests/overwatch-auto-push-governance.test.mjs",
        "tests/overwatch-route-iq-retention-maintenance-deployment-readiness.test.mjs",
        "tests/release-provenance-repair.test.mjs"
      ]
    }
  });
  assert.equal(
    governance.historicalVerifierComposition.packageSuccessorCurrentSha256,
    sha256(readFileSync("package.json"))
  );

  assert.equal(releaseContract.status, "source_complete_dormant_not_deployed");
  assert.equal(releaseContract.target.worker, "prometheus-iq");
  assert.equal(releaseContract.target.publicWorkerIncluded, false);
  assert.equal(releaseContract.bindingBoundary.ordinaryDeleteCapabilityExposed, false);
  assert.equal(releaseContract.bindingBoundary.maintenanceDeleteCapabilityExposed, true);
  assert.equal(releaseContract.bindingBoundary.identicalBindingInstancesAllowed, false);
  assert.equal(releaseContract.bindingBoundary.productionBindingCreationAuthorized, false);
  assertAllFalse(releaseContract.exposure, "releaseContract.exposure");
  assertAllFalse(releaseContract.automaticExecution, "releaseContract.automaticExecution");
  assert.equal(releaseContract.dryRun.cloudflareContactCount, 0);
  assert.equal(releaseContract.dryRun.productionMutationCount, 0);
  assert.equal(releaseContract.dryRun.grantsDeploymentAuthority, false);
  assert.equal(releaseContract.dryRun.grantsDeletionAuthority, false);

  assert.equal(runtimeContract.ordinaryArchiveBinding.deleteCapabilityAllowed, false);
  assert.equal(runtimeContract.ordinaryArchiveBinding.ingestionRequiresMaintenanceBinding, false);
  assert.equal(runtimeContract.maintenanceBinding.mustBeSeparateFromOrdinaryArchiveBinding, true);
  assert.equal(runtimeContract.legalHoldLedgerBinding.defaultsToUnavailable, true);
  assert.equal(runtimeContract.legalHoldLedgerBinding.fixtureStateAllowedInProduction, false);
  assert.equal(runtimeContract.legalHoldLedgerBinding.productionBindingConfigured, false);
  assert.equal(runtimeContract.admissionProducerBinding.signedEvidenceRequired, true);
  assert.equal(runtimeContract.admissionProducerBinding.atomicReplayConsumptionRequired, true);
  assert.equal(runtimeContract.admissionProducerBinding.deletionAuthorityAvailable, false);
  assert.equal(runtimeContract.admissionProducerBinding.productionBindingConfigured, false);
  assertAllFalse(runtimeContract.activation, "runtimeContract.activation");
  assertAllFalse(runtimeContract.surfaceExclusion, "runtimeContract.surfaceExclusion");

  assert.equal(governance.legalHoldReadiness.defaultsUnavailable, true);
  assert.equal(governance.legalHoldReadiness.authoritativeProductionStateRequired, true);
  assert.equal(governance.legalHoldReadiness.fixtureStateAcceptedInProduction, false);
  assert.equal(governance.legalHoldReadiness.exactScopeRequired, true);
  assert.equal(governance.legalHoldReadiness.appendOnlyHistoryRequired, true);
  assert.equal(governance.legalHoldReadiness.immediateRevalidationRequired, true);
  assert.equal(governance.legalHoldReadiness.mutationAuthorityGranted, false);

  assert.equal(intelligenceSuccessor.batchId, governance.batchId);
  assert.equal(intelligenceSuccessor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(intelligenceSuccessor.composition.dataProductionLegalHoldAuthorityRequired, true);
  assert.equal(intelligenceSuccessor.composition.fixtureLegalHoldEvidenceAllowed, false);
  assert.equal(intelligenceSuccessor.composition.signedShortLivedAdmissionRequired, true);
  assert.equal(intelligenceSuccessor.composition.atomicReplayRejectionRequired, true);
  assert.equal(intelligenceSuccessor.composition.consumerExclusionSemanticsChanged, false);
  assert.equal(intelligenceSuccessor.composition.recommendationBehaviorChanged, false);
  assert.equal(intelligenceSuccessor.composition.deploymentAuthorityGranted, false);
  assert.equal(intelligenceSuccessor.composition.deletionAuthorityGranted, false);
  assert.equal(intelligenceSuccessor.composition.historicalPinsRewritten, false);

  assert.equal(securityTriage.batchId, governance.batchId);
  assert.equal(securityTriage.before.allDependencies.high, 6);
  assert.equal(securityTriage.after.allDependencies.high, 4);
  assert.equal(securityTriage.before.productionOnly.high, 0);
  assert.equal(securityTriage.after.productionOnly.high, 0);
  assert.equal(securityTriage.remediation.auditFixForceUsed, false);
  assert.equal(securityTriage.findings.length, 6);
  assert.equal(securityTriage.findings.every(finding => finding.dependencyClass === "development"), true);
  assert.equal(securityTriage.findings.every(finding => finding.runtimeReachability === "NOT_PRESENT_IN_PRODUCTION_DEPENDENCY_TREE"), true);
  assert.deepEqual(
    securityTriage.findings.filter(finding => finding.resolutionStatus === "REMEDIATED")
      .map(finding => finding.package).sort(),
    ["nanoid", "postcss"]
  );

  assert.equal(dryRun.ok, true);
  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.source.commit, governance.releasePackage.sourceCommit);
  assert.equal(dryRun.source.tree, governance.releasePackage.sourceTree);
  assert.equal(dryRun.identities.artifactSha256, governance.releasePackage.artifactSha256);
  assert.equal(dryRun.identities.manifestSha256, governance.releasePackage.manifestSha256);
  assert.equal(dryRun.identities.configurationSha256, governance.releasePackage.configurationSha256);
  assert.equal(dryRun.identities.contentSha256, governance.releasePackage.contentSha256);
  assert.equal(dryRun.identities.maintenanceRuntimeSha256,
    governance.releasePackage.maintenanceRuntimeSha256);
  assert.equal(dryRun.identities.retentionPolicySha256,
    governance.releasePackage.retentionPolicySha256);
  assert.equal(dryRun.identities.deletionRuntimeSha256,
    governance.releasePackage.deletionRuntimeSha256);
  assert.equal(dryRun.identities.forwardRollbackSha256, governance.forwardRollback.sha256);
  assert.deepEqual(governance.releasePackage.privateWorkflowContinuity, {
    ownerCommit: "ae4e8def3e1142d6c9c99b709179f4be91c1acea",
    ownerTree: "5c557610b05d41e22ef64cfb9bc8e568d8fef2e5",
    path: "workers/infrastructure/github-actions-private-worker-deployment-v2.json",
    sha256: "157977f192e5b05eacf932c82d64dd6ad51cc7f4860824d0092872f3b8a1890b",
    previousForwardPayloadSha256:
      "aaa8b360c1c5343020985863896844723ce30a144956bd41cfcc051ad6e0af6a",
    currentForwardPayloadSha256:
      "bafde531701612f2bf5ca9fd3bb69ee1be60432c78b0a046359c7476e5785e09",
    privateDeployParitySha256:
      "a9c8837fb8978ee43f372f229f7b08286d8ebd2efce93e76971e8a39f47730f9",
    rollbackBundleSha256:
      "ab76b6c7ffa0d3899e008c3f92fc41e61139f9a23d40c31d22609d80df919028",
    deployParityChanged: false,
    rollbackChanged: false,
    applicationReleasePackageChanged: false,
    deploymentPerformed: false
  });
  assert.equal(dryRun.cloudflareContactCount, 0);
  assert.equal(dryRun.productionMutationCount, 0);
  assert.equal(dryRun.deploymentAuthorized, false);
  assert.equal(dryRun.deletionAuthorized, false);

  assert.equal(governance.authorizationBoundaries.deployment.granted, false);
  assert.equal(governance.authorizationBoundaries.deletion.granted, false);
  assert.equal(
    governance.authorizationBoundaries.deletion.interchangeableWithDeploymentAuthority,
    false
  );
  assert.notDeepEqual(
    governance.authorizationBoundaries.deployment.mustBind,
    governance.authorizationBoundaries.deletion.mustBind
  );
  assertAllFalse(governance.exposure, "governance.exposure");

  assert.equal(forwardRollback.forwardOnly, true);
  assert.equal(forwardRollback.historyRewriteAllowed, false);
  assert.equal(forwardRollback.nativeWorkerRollbackAllowed, false);
  assert.equal(forwardRollback.deploymentPerformed, false);
  assert.equal(forwardRollback.productionStorageMutationPerformed, false);
  assert.equal(forwardRollback.historicalEvidence.rewriteAllowed, false);

  assert.equal(governance.protectedState.collection, "OFF");
  assert.equal(governance.protectedState.activeCohorts, 0);
  assert.equal(governance.protectedState.recommendationInfluence, "OFF");
  assert.equal(governance.protectedState.canonicalProspectiveRecords, 0);
  assert.equal(governance.protectedState.canonicalProspectiveEvaluations, 0);
  assert.equal(governance.protectedState.productionContactCount, 0);
  assert.equal(governance.protectedState.productionMutationCount, 0);
  assert.equal(governance.protectedState.productionDeployment, "UNCHANGED");
  assert.equal(governance.inventionReview.materiallyNewInvention, false);

  assert.equal(report.batchId, governance.batchId);
  assert.deepEqual(report.hostedQualificationRepair, {
    failedRunId: governance.ownership.hostedQualificationRepair.failedRunId,
    commit: governance.ownership.hostedQualificationRepair.commit,
    tree: governance.ownership.hostedQualificationRepair.tree,
    failureClassification:
      governance.ownership.hostedQualificationRepair.failureClassification,
    runtimeChanged: false,
    releasePayloadChanged: false,
    productionContactCount: 0,
    productionMutationCount: 0
  });
  assert.deepEqual(report.hostedFullSuiteRepair, {
    failedRunId: governance.ownership.hostedFullSuiteRepair.failedRunId,
    failureClassifications:
      governance.ownership.hostedFullSuiteRepair.failureClassifications,
    infrastructureCommit:
      governance.ownership.hostedFullSuiteRepair.infrastructureRepair.commit,
    infrastructureTree:
      governance.ownership.hostedFullSuiteRepair.infrastructureRepair.tree,
    publicForwardRollbackArtifactSha256:
      governance.ownership.hostedFullSuiteRepair.infrastructureRepair
        .publicForwardRollbackArtifactSha256,
    runtimeChanged: false,
    releasePayloadChanged: false,
    publicForwardRollbackArtifactChanged: false,
    productionContactCount: 0,
    productionMutationCount: 0
  });
  assert.equal(report.ownerCompleteReleaseCommit, governance.releasePackage.sourceCommit);
  assert.equal(report.ownerCompleteReleaseTree, governance.releasePackage.sourceTree);
  assert.equal(
    report.privateWorkflowPayloadCommit,
    governance.releasePackage.privateWorkflowContinuity.ownerCommit
  );
  assert.equal(
    report.releaseIdentities.privateWorkflowForwardPayloadSha256,
    governance.releasePackage.privateWorkflowContinuity.currentForwardPayloadSha256
  );
  assert.equal(
    report.releaseIdentities.privateWorkflowPrivateDeployParitySha256,
    governance.releasePackage.privateWorkflowContinuity.privateDeployParitySha256
  );
  assert.equal(
    report.releaseIdentities.privateWorkflowRollbackBundleSha256,
    governance.releasePackage.privateWorkflowContinuity.rollbackBundleSha256
  );
  assert.equal(
    report.ownership.implementationOwnerCommits,
    Object.keys(ownerCommits).length + 1
  );
  assert.equal(report.sourceVerification.cloudflareContactCount, 0);
  assert.equal(report.sourceVerification.productionMutationCount, 0);
  assert.equal(report.sourceVerification.deploymentPerformed, false);
  assert.equal(report.sourceVerification.physicalDeletionPerformed, false);
  assert.equal(report.releaseBoundary.deploymentAuthorized, false);
  assert.equal(report.releaseBoundary.productionBindingCreationAuthorized, false);
  assert.equal(report.releaseBoundary.productionStorageAccessAuthorized, false);
  assert.equal(report.releaseBoundary.deletionAuthorized, false);
  return true;
}

function verifyOwnerChain(governance) {
  const commits = governance.ownership.commits.map(record => record.commit);
  assert.deepEqual(commits, Object.keys(ownerCommits));
  let parent = startCommit;
  for (const [commit, expected] of Object.entries(ownerCommits)) {
    assert.equal(git("rev-parse", `${commit}^`), parent);
    assert.equal(git("show", "-s", "--format=%an", commit), expected.name);
    assert.equal(git("show", "-s", "--format=%ae", commit), expected.email);
    assert.equal(git("show", "-s", "--format=%cn", commit), expected.name);
    assert.equal(git("show", "-s", "--format=%ce", commit), expected.email);
    assert.deepEqual(changedPaths(commit), [...expected.files].sort());
    parent = commit;
  }
  return parent;
}

function verifyPinnedFiles(governance) {
  for (const pin of [
    governance.predecessorAcceptance,
    governance.historicalVerifierComposition,
    governance.releasePackage.contract,
    governance.releasePackage.builder,
    governance.releasePackage.runtimeContract,
    governance.releasePackage.admissionProducer,
    governance.releasePackage.privateWorkflowContinuity,
    governance.legalHoldReadiness,
    governance.intelligenceSuccessor,
    governance.dependencyAdvisories,
    governance.forwardRollback
  ]) {
    assert.equal(sha256(read(pin.path ?? pin.runtimePath)), pin.sha256 ?? pin.runtimeSha256,
      `${pin.path ?? pin.runtimePath} hash drifted.`);
  }
}

export function verifyOverwatchRouteIqRetentionMaintenanceDeploymentReadiness() {
  const governance = readJson(governancePath);
  const report = readJson(reportPath);
  const releaseContract = readJson(releaseContractPath);
  const runtimeContract = readJson(runtimeContractPath);
  const forwardRollback = readJson(forwardRollbackPath);
  const securityTriage = readJson(securityTriagePath);
  const intelligenceSuccessor = readJson(intelligenceSuccessorPath);
  const head = git("rev-parse", "HEAD");
  const originMain = git("rev-parse", "refs/remotes/origin/main");

  assert.equal(git("rev-parse", `${startCommit}^{tree}`), startTree);
  assert.equal(exactMainCheckout({
    branch: git("branch", "--show-current"),
    head,
    originMain,
    environment: process.env
  }), true);
  assert.equal(git("status", "--porcelain"), "");

  const terminalOwnerCommit = verifyOwnerChain(governance);
  assert.equal(terminalOwnerCommit, governance.ownership.finalIntegration.expectedParent);
  const integrationCommit = governance.ownership.finalIntegration.commit;
  assert.equal(git("rev-parse", `${integrationCommit}^`), terminalOwnerCommit);
  assert.equal(git("rev-parse", `${integrationCommit}^{tree}`),
    governance.ownership.finalIntegration.tree);
  assert.equal(git("show", "-s", "--format=%an", integrationCommit), "Prometheus Overwatch");
  assert.equal(git("show", "-s", "--format=%ae", integrationCommit), "overwatch@prometheus.local");
  assert.equal(git("show", "-s", "--format=%s", integrationCommit),
    governance.ownership.finalIntegration.subject);
  assert.deepEqual(changedPaths(integrationCommit),
    governance.ownership.finalIntegration.changedPaths.slice().sort());

  const repair = governance.ownership.hostedQualificationRepair;
  assert.equal(repair.expectedParent, integrationCommit);
  assert.equal(git("rev-parse", `${repair.commit}^`), repair.expectedParent);
  assert.equal(git("rev-parse", `${repair.commit}^{tree}`), repair.tree);
  assert.equal(git("show", "-s", "--format=%an", repair.commit), repair.ownerSubsystem);
  assert.equal(git("show", "-s", "--format=%ae", repair.commit), repair.email);
  assert.equal(git("show", "-s", "--format=%cn", repair.commit), repair.ownerSubsystem);
  assert.equal(git("show", "-s", "--format=%ce", repair.commit), repair.email);
  assert.equal(git("show", "-s", "--format=%s", repair.commit), repair.subject);
  assert.deepEqual(changedPaths(repair.commit), repair.changedPaths.slice().sort());

  const fullSuiteRepair = governance.ownership.hostedFullSuiteRepair;
  const infrastructureRepair = fullSuiteRepair.infrastructureRepair;
  assert.equal(infrastructureRepair.parent, repair.commit);
  assert.equal(git("rev-parse", `${infrastructureRepair.commit}^`),
    infrastructureRepair.parent);
  assert.equal(git("rev-parse", `${infrastructureRepair.commit}^{tree}`),
    infrastructureRepair.tree);
  assert.equal(git("show", "-s", "--format=%an", infrastructureRepair.commit),
    infrastructureRepair.ownerSubsystem);
  assert.equal(git("show", "-s", "--format=%ae", infrastructureRepair.commit),
    infrastructureRepair.email);
  assert.equal(git("show", "-s", "--format=%cn", infrastructureRepair.commit),
    infrastructureRepair.ownerSubsystem);
  assert.equal(git("show", "-s", "--format=%ce", infrastructureRepair.commit),
    infrastructureRepair.email);
  assert.equal(git("show", "-s", "--format=%s", infrastructureRepair.commit),
    infrastructureRepair.subject);
  assert.deepEqual(changedPaths(infrastructureRepair.commit),
    infrastructureRepair.changedPaths.slice().sort());
  assert.equal(
    sha256(read("package-lock.json")),
    infrastructureRepair.currentPackageLockSha256
  );
  assert.deepEqual(
    verifyPublicForwardRollbackBuildSource(process.cwd()),
    PUBLIC_FORWARD_ROLLBACK_BUILD_SOURCE
  );
  assert.equal(
    PUBLIC_FORWARD_ROLLBACK_BUILD_SOURCE.artifactSha256,
    infrastructureRepair.publicForwardRollbackArtifactSha256
  );

  const finalRepair = fullSuiteRepair.finalOverwatchRepair;
  assert.equal(finalRepair.expectedParent, infrastructureRepair.commit);
  assert.equal(git("rev-parse", `${head}^`), finalRepair.expectedParent);
  assert.equal(git("show", "-s", "--format=%an", head), finalRepair.ownerSubsystem);
  assert.equal(git("show", "-s", "--format=%ae", head), finalRepair.email);
  assert.equal(git("show", "-s", "--format=%cn", head), finalRepair.ownerSubsystem);
  assert.equal(git("show", "-s", "--format=%ce", head), finalRepair.email);
  assert.equal(git("show", "-s", "--format=%s", head), finalRepair.subject);
  assert.deepEqual(changedPaths(head), finalRepair.changedPaths.slice().sort());

  const manifestedPaths = [...new Set(Object.values(governance.exactChangedFileManifest).flat())].sort();
  const actualPaths = git("diff", "--name-only", `${startCommit}..HEAD`).split("\n").filter(Boolean).sort();
  assert.deepEqual(actualPaths, manifestedPaths);
  verifyPinnedFiles(governance);

  const dryRun = dryRunRouteIqRetentionMaintenanceReleasePackage({
    sourceRef: governance.releasePackage.sourceCommit
  });
  validateDormantRetentionMaintenanceReadiness({
    governance,
    report,
    releaseContract,
    runtimeContract,
    forwardRollback,
    securityTriage,
    intelligenceSuccessor,
    dryRun
  });

  const runtimeSource = read("workers/infrastructure/route-iq-retention-maintenance-runtime.js")
    .toString("utf8");
  const admissionSource = read(
    "workers/infrastructure/route-iq-retention-maintenance-production-admission.js"
  ).toString("utf8");
  for (const source of [runtimeSource, admissionSource]) {
    assert.doesNotMatch(source, /scheduled\s*\(|alarm\s*\(|queue\s*\(|\/api\//u);
  }
  assert.equal(
    git("rev-parse", "HEAD:data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions"),
    forwardRollback.historicalEvidence.sessionSubtreeGitObject
  );
  assert.equal(
    git("rev-parse", "HEAD:data/route-iq-field-sessions-v1/source-evidence"),
    forwardRollback.historicalEvidence.sourceEvidenceSubtreeGitObject
  );

  const packageScript = readFileSync("package.json", "utf8");
  assert.match(packageScript, /overwatch:route-iq-retention-maintenance-readiness:check/u);
  assert.match(packageScript, /tests\/overwatch-route-iq-retention-maintenance-deployment-readiness\.test\.mjs/u);

  return Object.freeze({
    status: "PASS",
    batchId: governance.batchId,
    ownerCommitCount: Object.keys(ownerCommits).length + 1,
    integrationCommit,
    firstQualificationRepairCommit: repair.commit,
    infrastructureQualificationRepairCommit: infrastructureRepair.commit,
    qualificationRepairCommit: head,
    integrationTree: governance.ownership.finalIntegration.tree,
    firstQualificationRepairTree: repair.tree,
    infrastructureQualificationRepairTree: infrastructureRepair.tree,
    qualificationRepairTree: git("rev-parse", `${head}^{tree}`),
    releaseSourceCommit: governance.releasePackage.sourceCommit,
    releaseSourceTree: governance.releasePackage.sourceTree,
    artifactSha256: dryRun.identities.artifactSha256,
    manifestSha256: dryRun.identities.manifestSha256,
    contentSha256: dryRun.identities.contentSha256,
    forwardRollbackSha256: dryRun.identities.forwardRollbackSha256,
    privateWorkflowForwardPayloadSha256:
      governance.releasePackage.privateWorkflowContinuity.currentForwardPayloadSha256,
    cloudflareContactCount: 0,
    productionMutationCount: 0,
    deploymentAuthorized: false,
    deletionAuthorized: false,
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF"
  });
}

if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(
    verifyOverwatchRouteIqRetentionMaintenanceDeploymentReadiness(),
    null,
    2
  ));
}
