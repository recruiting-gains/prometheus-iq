import assert from "node:assert/strict";
import fs from "node:fs";

const policyPath = "overwatch/governance/verified-engineering-batch-auto-push-v1.json";
const policyDocumentationPath = "overwatch/governance/verified-engineering-batch-auto-push-v1.md";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";
const architecturePath = "README.md";
const testReleaseMapPath = "docs/TEST_RELEASE_MAP.md";
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

  if (manifest.rollback?.statefulMigrationPresent === true) {
    const requiredStatefulRollback = [
      "forwardCompatibleDeploymentCandidateVerified",
      "appliedMigrationHistoryPreserved",
      "classExportsBindingsAndProtectedSecretReferencesPreserved",
      "statefulNamespacePreserved",
      "deletedClassMigrationAbsent"
    ];
    for (const field of requiredStatefulRollback) {
      if (manifest.rollback?.[field] !== true) failures.push(`rollback.${field} must be true for a stateful migration`);
    }
    if (manifest.rollback?.nativeProviderRollbackUsed !== false) {
      failures.push("rollback.nativeProviderRollbackUsed must be false for a stateful migration");
    }
  }

  if (manifest.productionSmoke?.required === true) {
    const requiredSmokeFlags = [
      "newBrowserContext",
      "authenticated",
      "readOnlyGuardInstalledBeforeNavigation",
      "viewportConfiguredBeforeNavigation",
      "viewportConfirmedBeforeNavigation",
      "defaultDenyWriteGuard",
      "serviceWorkersBlocked",
      "formSubmissionsBlocked",
      "downloadsBlocked",
      "popupsBlocked",
      "dialogsBlocked",
      "beforeAfterCountsCaptured",
      "beforeAfterCountsMatch"
    ];
    for (const field of requiredSmokeFlags) {
      if (manifest.productionSmoke?.[field] !== true) failures.push(`productionSmoke.${field} must be true`);
    }
    if (manifest.productionSmoke?.expectedViewport?.width !== manifest.productionSmoke?.actualViewport?.width ||
        manifest.productionSmoke?.expectedViewport?.height !== manifest.productionSmoke?.actualViewport?.height) {
      failures.push("production smoke viewport must exactly match the configured viewport");
    }
    if (manifest.productionSmoke?.attemptedWrites !== 0) failures.push("productionSmoke.attemptedWrites must be 0");
    if (manifest.productionSmoke?.dialogsObserved !== 0) failures.push("productionSmoke.dialogsObserved must be 0");
    if (manifest.productionSmoke?.applicationDataChanges !== 0) failures.push("productionSmoke.applicationDataChanges must be 0");
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
  const architecture = read(architecturePath);
  const testReleaseMap = read(testReleaseMapPath);
  const securityWorkflow = read(securityWorkflowPath);

  assert.equal(policy.policyId, "verified-engineering-batch-automatic-commit-push-governance-v1");
  assert.equal(policy.version, "1.2.0");
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

  assert.equal(policy.autonomousPredeploymentClosure.status, "active_permanent_until_founder_revocation_or_supersession");
  assert.equal(policy.autonomousPredeploymentClosure.adoptionBatchId, "BATCH-20260720-010");
  assert.equal(policy.autonomousPredeploymentClosure.appliesAcrossOverwatchSessions, true);
  assert.deepEqual(policy.autonomousPredeploymentClosure.scope, [
    "public_deployment_preparation",
    "equivalent_release_readiness_work"
  ]);
  assert.deepEqual(policy.autonomousPredeploymentClosure.ordinaryFailureFamilies, [
    "test",
    "ci",
    "integrity",
    "portability",
    "provenance",
    "ownership",
    "workflow",
    "build",
    "verification"
  ]);
  assert.deepEqual(policy.autonomousPredeploymentClosure.requiredBehavior, [
    "diagnose_and_dispatch_to_correct_owner",
    "repair_narrowly_with_regression_coverage",
    "commit_under_correct_owner_identity",
    "independently_verify_exact_integrated_head_and_tree",
    "normal_fast_forward_push_when_auto_push_eligible",
    "rerun_safe_no_secret_ci_until_stable",
    "freeze_one_immutable_candidate_before_requesting_deployment_authorization"
  ]);
  assert.equal(policy.autonomousPredeploymentClosure.intermediateHoldForFixableEngineeringFailureAllowed, false);
  assert.equal(policy.autonomousPredeploymentClosure.deploymentAuthorizationMayBeRequestedWhileCandidateChanges, false);
  assert.equal(policy.autonomousPredeploymentClosure.candidateMutationAfterFreezeAllowed, false);
  assert.equal(policy.autonomousPredeploymentClosure.sourceChangeInvalidatesFrozenCandidate, true);
  assert.equal(policy.autonomousPredeploymentClosure.unchangedCandidateSurvivesPreBoundaryExternalFailure, true);
  assert.deepEqual(policy.autonomousPredeploymentClosure.founderReturnConditions, [
    "immutable_candidate_passed_all_required_gates_and_needs_deployment_authorization",
    "founder_authentication_credentials_mfa_or_physical_identity_action_unavoidable",
    "material_product_security_privacy_crm_schema_data_handling_or_deployment_scope_decision_required",
    "destructive_or_irreversible_action_required",
    "genuine_blocker_remains_after_safe_in_scope_remedies_exhausted"
  ]);
  assert.equal(policy.autonomousPredeploymentClosure.deploymentWithoutExactFounderAuthorizationAllowed, false);
  assert.equal(policy.autonomousPredeploymentClosure.productionMutationDuringPredeploymentClosureAllowed, false);
  assert.equal(policy.autonomousPredeploymentClosure.secretValueAccessDuringNoSecretClosureAllowed, false);

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
  assert.equal(policy.rollbackPolicy.statefulMigrationRequirements.nativeProviderRollbackAllowed, false);
  assert.equal(policy.rollbackPolicy.statefulMigrationRequirements.forwardCompatibleDeploymentCandidateRequired, true);
  assert.equal(policy.rollbackPolicy.statefulMigrationRequirements.appliedMigrationHistoryMustRemain, true);
  assert.equal(policy.rollbackPolicy.statefulMigrationRequirements.classExportsBindingsAndProtectedSecretReferencesMustRemain, true);
  assert.equal(policy.rollbackPolicy.statefulMigrationRequirements.statefulNamespaceDeletionAllowed, false);
  assert.equal(policy.rollbackPolicy.statefulMigrationRequirements.deletedClassMigrationAllowed, false);
  assert.equal(policy.rollbackPolicy.statefulMigrationRequirements.candidateDeploymentRequiresSeparateFounderApproval, true);
  assert.equal(policy.productionSmokeVerification.newBrowserContextRequired, true);
  assert.equal(policy.productionSmokeVerification.authenticatedContextRequired, true);
  assert.equal(policy.productionSmokeVerification.readOnlyByConstruction, true);
  assert.equal(policy.productionSmokeVerification.exactViewportConfiguredAndConfirmedBeforeProductionNavigation, true);
  assert.equal(policy.productionSmokeVerification.viewportMismatchAction, "STOP_BEFORE_INTERACTION");
  assert.equal(policy.productionSmokeVerification.defaultDenyWriteGuardRequiredBeforeProductionNavigation, true);
  assert.deepEqual(policy.productionSmokeVerification.blockedCapabilities, [
    "application_write_requests",
    "service_workers",
    "form_submissions",
    "downloads",
    "popups",
    "dialogs"
  ]);
  assert.equal(policy.productionSmokeVerification.stateChangingControlsMayBeActivated, false);
  assert.equal(policy.productionSmokeVerification.beforeAfterProductionDataCountsRequired, true);
  assert.equal(policy.productionSmokeVerification.zeroAttemptedWritesRequired, true);
  assert.equal(policy.productionSmokeVerification.zeroDialogsRequired, true);
  assert.equal(policy.productionSmokeVerification.zeroApplicationDataChangesRequired, true);
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
  assert.equal(packageJson.scripts["test:release"], "node scripts/run-test-suite.mjs release");
  assert.match(packageJson.scripts.test, /test:release/);

  assert.match(documentation, /Production deployment always requires separate Founder approval/);
  assert.match(documentation, /INSUFFICIENT_EVIDENCE/);
  assert.match(documentation, /new `git revert` commits/);
  assert.match(documentation, /forward-compatible deployment candidate/);
  assert.match(documentation, /new browser context/);
  assert.match(documentation, /default-deny write guard/);
  assert.match(documentation, /production application-data counts before and after/);
  assert.match(documentation, /Autonomous Predeployment Closure/);
  assert.match(documentation, /does not return an intermediate `HOLD` for a fixable engineering failure/);
  assert.match(documentation, /does not request deployment authorization while the candidate is still changing/);
  assert.match(documentation, /temporary runner or external infrastructure failure before the production mutation boundary does not invalidate/);
  assert.match(architecture, /Git `main` is source authority/);
  assert.match(testReleaseMap, /exact hosted-qualified artifact/);
  assert.match(testReleaseMap, /forward rollback/);

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
