import assert from "node:assert/strict";
import fs from "node:fs";

const policyPath = "overwatch/governance/verified-engineering-batch-auto-push-v1.json";
const policyDocumentationPath = "overwatch/governance/verified-engineering-batch-auto-push-v1.md";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";
const systemMapPath = "PROMETHEUS_SYSTEM_MAP.md";
const masterStatePath = "PROMETHEUS_MASTER_ENGINEERING_STATE.md";
const packagePath = "package.json";
const securityWorkflowPath = ".github/workflows/security-gates.yml";

const requiredAutomaticPushRequirements = [
  "insideFounderAuthorizedDirective",
  "everyCommitMappedToCorrectOwner",
  "noBlockedFailedUnrelatedUnapprovedOrUnexplainedCommit",
  "ownershipAndProvenanceVerified",
  "directiveAcceptanceCriteriaPass",
  "applicableQualityAndSecurityGatesPass",
  "allTrackedChangesCommittedBeforeFinalVerification",
  "exactFinalHeadAndTreeFrozen",
  "completeApplicableSuitePassesAgainstExactCandidate",
  "headAndTreeUnchangedAcrossVerification",
  "workingTreeCompletelyClean",
  "everyCommitHasDocumentedForwardRevertPath",
  "pushCannotTriggerUnauthorizedExternalAction",
  "recommendationInfluenceRemainsAuthorized"
];

const requiredGateFamilies = [
  "directive_acceptance",
  "security",
  "secret_scan",
  "aegis",
  "contracts",
  "workspace_isolation",
  "lint",
  "typecheck",
  "build",
  "diff_integrity",
  "index_integrity",
  "git_integrity",
  "ownership",
  "release"
];

const requiredFounderReviewTriggers = [
  "production_deployment",
  "recommendation_influence",
  "representative_facing_shadow_recommendations",
  "automated_business_actions",
  "new_or_materially_changed_representative_or_customer_behavior",
  "mandatory_workflow_changes",
  "new_pii_collection",
  "material_privacy_tracking_retention_permission_or_data_sharing_change",
  "new_subsystem_or_major_architecture",
  "new_production_event_architecture",
  "new_vendor_model_provider_external_service_or_material_recurring_cost",
  "destructive_migration_or_historical_archive_rewrite",
  "material_authentication_authorization_or_security_boundary_change",
  "public_release_or_external_publication",
  "material_legal_licensing_or_intellectual_property_commitment",
  "waived_failed_or_incomplete_verification_gate",
  "work_outside_authorized_directive"
];

const requiredFinalStatuses = [
  "AUTO_PUSH_COMPLETE",
  "BATCH_PASS_NO_PUSH_REQUIRED",
  "FOUNDER_REVIEW_REQUIRED",
  "PUSH_BLOCKED",
  "BATCH_FAILED",
  "POST_PUSH_VERIFICATION_FAILED"
];

const requiredRepositoryFlags = [
  "headMatchesCandidate",
  "treeMatchesCandidate",
  "headAndTreeUnchangedAfterVerification",
  "workingTreeClean",
  "indexClean",
  "noUntrackedFiles",
  "noConflicts",
  "originMatchesExpectedBase",
  "normalFastForward"
];

const prohibitedExternalActions = [
  "deployment",
  "migration",
  "publication",
  "externalMessaging",
  "productionDataMutation",
  "recommendationActivation",
  "otherUnauthorizedAction"
];

const read = file => fs.readFileSync(file, "utf8");
const readJson = file => JSON.parse(read(file));
const sorted = values => [...values].sort();

function valueAt(source, path) {
  return path.split(".").reduce((value, key) => value?.[key], source);
}

function isFullCommit(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
}

function isTreeHash(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
}

export function evaluateAutomaticPushEligibility(manifest, policy = readJson(policyPath)) {
  const failures = [];
  const reviewTriggers = requiredFounderReviewTriggers.filter(trigger => manifest.founderReviewTriggers?.[trigger] === true);

  if (reviewTriggers.length > 0) {
    return {
      status: "FOUNDER_REVIEW_REQUIRED",
      reviewTriggers,
      failures
    };
  }

  const requiredTruePaths = [
    "directive.founderAuthorized",
    "scope.insideAuthorizedDirective",
    "scope.noUnrelatedWork",
    "ownership.everyCommitMapped",
    "ownership.provenanceVerified",
    "acceptanceCriteriaPassed",
    "allTrackedChangesCommitted",
    "candidate.frozen",
    "candidate.completeApplicableSuitePassed",
    "rollback.manifestComplete",
    "rollback.everyCommitHasSafeForwardRevert",
    "rollback.dataAndContractConsiderationsRecorded",
    "externalActionAudit.liveProviderCheckCompleted"
  ];

  for (const path of requiredTruePaths) {
    if (valueAt(manifest, path) !== true) failures.push(`${path} must be true`);
  }

  if (!isFullCommit(manifest.candidate?.head)) failures.push("candidate.head must be a full commit hash");
  if (!isTreeHash(manifest.candidate?.tree)) failures.push("candidate.tree must be a full tree hash");
  if (!isFullCommit(manifest.candidate?.expectedOriginMain)) failures.push("candidate.expectedOriginMain must be a full commit hash");

  for (const flag of requiredRepositoryFlags) {
    if (manifest.repository?.[flag] !== true) failures.push(`repository.${flag} must be true`);
  }

  for (const gate of requiredGateFamilies) {
    if (manifest.gates?.[gate] !== "PASS") failures.push(`gates.${gate} must be PASS`);
  }

  const commits = manifest.outgoingCommits;
  if (!Array.isArray(commits)) {
    failures.push("outgoingCommits must be an array");
  } else {
    const commitIds = new Set();
    for (const [index, commit] of commits.entries()) {
      if (!isFullCommit(commit.sha)) failures.push(`outgoingCommits[${index}].sha must be a full commit hash`);
      if (!commit.owner) failures.push(`outgoingCommits[${index}].owner is required`);
      if (!Array.isArray(commit.files) || commit.files.length === 0) failures.push(`outgoingCommits[${index}].files must be non-empty`);
      if (commit.verified !== true) failures.push(`outgoingCommits[${index}].verified must be true`);
      if (commit.safeForwardRevert !== true) failures.push(`outgoingCommits[${index}].safeForwardRevert must be true`);
      if (commit.blocked !== false) failures.push(`outgoingCommits[${index}].blocked must be false`);
      if (commit.unrelated !== false) failures.push(`outgoingCommits[${index}].unrelated must be false`);
      if (commitIds.has(commit.sha)) failures.push(`outgoing commit ${commit.sha} is duplicated`);
      commitIds.add(commit.sha);
    }

    const rollbackOrder = manifest.rollback?.reverseCommitOrder || [];
    const expectedRollbackOrder = commits.map(commit => commit.sha).reverse();
    if (JSON.stringify(rollbackOrder) !== JSON.stringify(expectedRollbackOrder)) {
      failures.push("rollback.reverseCommitOrder must exactly reverse outgoingCommits");
    }
  }

  for (const action of prohibitedExternalActions) {
    if (manifest.externalActionAudit?.[action] !== false) failures.push(`externalActionAudit.${action} must be false`);
  }

  if (manifest.recommendationInfluence?.actual !== manifest.recommendationInfluence?.authorized) {
    failures.push("recommendation influence changed from its authorized state");
  }

  if (manifest.productReadiness?.state === "INSUFFICIENT_EVIDENCE" && manifest.productReadiness?.describedAsRecommendationReadiness !== false) {
    failures.push("INSUFFICIENT_EVIDENCE must not be described as recommendation readiness");
  }

  if (manifest.rollback?.isolatedExerciseRequired === true && manifest.rollback?.isolatedExercisePassed !== true) {
    failures.push("required isolated rollback exercise did not pass");
  }

  if (manifest.directive?.chiefArchitectDraftOnly === true) {
    failures.push("a Chief Architect draft alone cannot authorize implementation");
  }

  if (failures.length > 0) {
    return { status: "PUSH_BLOCKED", reviewTriggers, failures };
  }

  if (manifest.outgoingCommits.length === 0) {
    return { status: "BATCH_PASS_NO_PUSH_REQUIRED", reviewTriggers, failures };
  }

  assert.equal(policy.standingPushAuthorization.enabled, true);
  return { status: "AUTO_PUSH_ELIGIBLE", reviewTriggers, failures };
}

export function verifyAutomaticCommitPushGovernance() {
  const policy = readJson(policyPath);
  const registry = readJson(registryPath);
  const packageJson = readJson(packagePath);
  const documentation = read(policyDocumentationPath);
  const systemMap = read(systemMapPath);
  const masterState = read(masterStatePath);
  const securityWorkflow = read(securityWorkflowPath);

  assert.equal(policy.policyId, "verified-engineering-batch-automatic-commit-push-governance-v1");
  assert.equal(policy.version, "1.0.0");
  assert.equal(policy.status, "active_after_verified_origin_installation");
  assert.equal(policy.permanence, "permanent_until_revoked_or_superseded_by_founder");
  assert.equal(policy.owningSubsystem, "Prometheus Overwatch");
  assert.equal(policy.installationBatchId, "BATCH-20260713-003");
  assert.equal(policy.activation.authorizedStartingCommit, "e17ca09ee3c2bb691f2d6ebd00080160966cd810");
  assert.equal(policy.activation.authorizedStartingTree, "5381d35cffd3b95ce8c84056daca0c917147646b");
  assert.equal(policy.activation.requiresExactVersionVerification, true);
  assert.equal(policy.activation.requiresNormalFastForwardPush, true);
  assert.equal(policy.activation.requiresPostPushVerification, true);

  assert.equal(policy.supersession.routineSeparateFounderPushApprovalSuperseded, true);
  assert.equal(policy.supersession.deploymentAuthorityChanged, false);
  assert.equal(policy.supersession.FounderDeploymentApprovalAlwaysRequired, true);
  assert.equal(policy.standingCommitAuthorization.subsystemsMayPush, false);
  assert.equal(policy.standingCommitAuthorization.subsystemsMayDeploy, false);
  assert.equal(policy.standingPushAuthorization.authorizedPusher, "Prometheus Overwatch");
  assert.equal(policy.standingPushAuthorization.target, "origin/main");
  assert.equal(policy.standingPushAuthorization.founderDirectiveMustBeDirectlySubmittedApprovedOrOrdered, true);
  assert.equal(policy.standingPushAuthorization.chiefArchitectDraftAloneIsAuthorization, false);
  assert.equal(policy.standingPushAuthorization.normalFastForwardOnly, true);

  assert.deepEqual(sorted(Object.keys(policy.automaticPushRequirements)), sorted(requiredAutomaticPushRequirements));
  for (const requirement of requiredAutomaticPushRequirements) {
    assert.equal(policy.automaticPushRequirements[requirement], true, `${requirement} must remain mandatory.`);
  }

  assert.deepEqual(policy.requiredGateFamilies, requiredGateFamilies);
  assert.deepEqual(policy.founderReviewRequired.triggers, requiredFounderReviewTriggers);
  assert.equal(policy.founderReviewRequired.broadOrUnrelatedDirectiveMayImplyAuthorization, false);
  assert.deepEqual(policy.finalReleaseStatuses, requiredFinalStatuses);
  assert.equal(policy.deploymentPolicy.separateFounderApprovalAlwaysRequired, true);
  assert.equal(policy.deploymentPolicy.githubPushIsDeploymentApproval, false);
  assert.equal(policy.deploymentPolicy.automaticDeploymentFromPushProhibited, true);
  assert.equal(policy.exactVersionVerification.remoteMovementAction, "PUSH_BLOCKED");
  assert.equal(policy.exactVersionVerification.trackedChangeAfterVerificationInvalidatesVerification, true);
  assert.equal(policy.exactVersionVerification.finalHashesRecordedInExternalHandoff, true);

  for (const rule of [
    "forcePushAllowed",
    "amendAllowed",
    "historyRewriteAllowed",
    "squashAllowed",
    "rebaseAllowed",
    "dropOrReorderAllowed",
    "branchProtectionBypassAllowed",
    "remoteBranchDeletionAllowed",
    "publicReleaseCreationAllowed",
    "remoteSettingsChangeAllowed"
  ]) {
    assert.equal(policy.pushRules[rule], false, `${rule} must remain prohibited.`);
  }

  assert.equal(policy.rollbackPolicy.forwardRevertCommitsOnly, true);
  assert.equal(policy.rollbackPolicy.resetAllowed, false);
  assert.equal(policy.rollbackPolicy.forcePushAllowed, false);
  assert.equal(policy.rollbackPolicy.remoteHistoryRewriteAllowed, false);
  assert.equal(policy.postPushVerification.failureStatus, "POST_PUSH_VERIFICATION_FAILED");
  assert.equal(policy.postPushVerification.failureSuspendsFurtherAutomaticPushes, true);
  assert.equal(policy.postPushVerification.historyRewriteOnFailureAllowed, false);
  assert.equal(policy.productReadinessSemantics.insufficientEvidenceMayCoexistWithAutoPushEligibility, true);
  assert.equal(policy.productReadinessSemantics.insufficientEvidenceMayBeCalledRecommendationReadiness, false);
  assert.equal(policy.installationBoundary.overwatchOwnedChangesOnly, true);
  assert.equal(policy.installationBoundary.newSubsystemCreated, false);
  assert.equal(policy.installationBoundary.parallelGovernanceSystemCreated, false);
  assert.equal(policy.installationBoundary.deploymentAuthorized, false);
  assert.equal(policy.installationBoundary.recommendationInfluenceActivationAuthorized, false);
  assert.equal(policy.installationBoundary.productionDataMutationAuthorized, false);
  assert.equal(policy.installationBoundary.prospectiveShadowEvidenceCollectionAuthorized, false);

  const registration = registry.governanceArtifacts?.find(artifact => artifact.artifactId === policy.policyId);
  assert.ok(registration, "Automatic push governance must be registered as a canonical governance artifact.");
  assert.equal(registration.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(registration.path, policyPath);
  assert.equal(registration.documentationPath, policyDocumentationPath);
  assert.deepEqual(registration.writeAllowed, ["Prometheus Overwatch"]);
  assert.deepEqual(registration.readAllowed, ["Prometheus Overwatch"]);
  assert.equal(registration.productionConsumer, false);
  assert.equal(registration.failClosedIfMissing, true);

  assert.equal(packageJson.scripts["overwatch:auto-push-governance:check"], "node scripts/verify-overwatch-auto-push-governance.mjs");
  assert.match(packageJson.scripts["test:overwatch"], /tests\/overwatch-auto-push-governance\.test\.mjs/);
  assert.match(packageJson.scripts.test, /overwatch:auto-push-governance:check/);

  assert.match(documentation, /Production deployment always requires separate Founder approval/);
  assert.match(documentation, /INSUFFICIENT_EVIDENCE/);
  assert.match(documentation, /new `git revert` commits/);
  assert.match(systemMap, /Verified Engineering Batch Automatic Commit \+ Push Governance v1/);
  assert.match(masterState, /Automatic Commit and Push Governance/);
  assert.match(masterState, /Production deployment always requires separate Founder approval/);

  assert.doesNotMatch(
    securityWorkflow,
    /cloudflare\/wrangler-action|cloudflare\/pages-action|wrangler\s+(?:deploy|versions\s+(?:upload|deploy))|pages\s+deploy|npm\s+run\s+deploy/i,
    "The main-branch security workflow must not deploy or publish."
  );

  return {
    status: "PASS",
    policyId: policy.policyId,
    installationBatchId: policy.installationBatchId,
    automaticPushRequirements: requiredAutomaticPushRequirements.length,
    founderReviewTriggers: requiredFounderReviewTriggers.length,
    deploymentFounderGated: policy.deploymentPolicy.separateFounderApprovalAlwaysRequired,
    recommendationInfluenceActivationAuthorized: policy.installationBoundary.recommendationInfluenceActivationAuthorized
  };
}

const invokedPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).pathname : "";
if (invokedPath === new URL(import.meta.url).pathname) {
  console.log(JSON.stringify(verifyAutomaticCommitPushGovernance(), null, 2));
}
