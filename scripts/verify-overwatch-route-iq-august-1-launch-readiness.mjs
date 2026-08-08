#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const AUGUST_1_READINESS_MATRIX_PATH =
  "overwatch/governance/route-iq-august-1-readiness-matrix-v1.json";
export const AUGUST_1_GOVERNANCE_REPORT_PATH =
  "overwatch/governance/route-iq-august-1-launch-closeout-v1.json";
export const AUGUST_1_SUCCESSORS_PATH =
  "overwatch/governance/route-iq-august-1-readiness-successors-v1.json";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const STARTING_COMMIT = "d3bda9d86a388462dd5cab0fa789081eee59b541";
const STARTING_TREE = "bc1fb8b16fab4f795d51f838eab06e16d0a4a3d2";
const OWNER_SUCCESSOR_BASELINE = Object.freeze({
  commit: "f612e394b3af75e63cc07232d64bbd3dd1adb817",
  tree: "d0d5fb3ce8c7b9416c3695645b0ad0fb0715d650",
  dashboardGeneratedIntelligenceMirrorsCommit: "7ad906d37d827a878ca4db82029c81d2c28cd1fd",
  intelligenceRouteTargetVerifierCommit: "3b29b967056482cd95bc47fd3556daf0bb50dbd0",
  dashboardGovernedRuntimeScopeMirrorCommit: "d913a3c8c50379272503c93a8df12e75e048842d",
  dashboardProfileMismatchHarnessCommit: "f612e394b3af75e63cc07232d64bbd3dd1adb817"
});
const FINAL_BLOCKED_STATUS = "AUGUST_1_LAUNCH_BLOCKED";
const STATUS_VALUES = Object.freeze([
  "VERIFIED",
  "PARTIAL",
  "BLOCKED",
  "PENDING_EXTERNAL_ACTION",
  "PENDING_FOUNDER"
]);
const EXPECTED_REQUIREMENT_IDS = Object.freeze([
  "authoritative_readiness_governance",
  "production_crm_acceptance",
  "default_off_activation_envelope",
  "bounded_company_user_limits",
  "customer_runtime_integration",
  "cruz_only_prelaunch_acceptance",
  "founder_acceptance_execution",
  "no_external_human_testers",
  "anthony_unmapped",
  "collection_cohorts_recommendation_off",
  "one_generic_customer_pwa",
  "pwa_mobile_lifecycle_acceptance",
  "authentication_and_role_enforcement",
  "tenant_company_user_isolation",
  "route_workflow_collection_off",
  "production_not_beta_language",
  "crm_durability_and_notification_order",
  "legal_privacy_terms_contact",
  "customer_activation_and_onboarding",
  "named_user_provisioning",
  "monitoring_support_incident_response",
  "forward_rollback_readiness",
  "known_limitations_disclosure",
  "launch_day_and_post_launch_verification",
  "full_qualification_and_clean_provenance",
  "activation_and_deployment_authorization"
]);
const HISTORICAL_NONCONTROLLING_PATHS = Object.freeze([
  "administration/command-center/beta-sprint-2/",
  "administration/verification/beta-stabilization-sprint-1/",
  "docs/pilot-support-system.md",
  "docs/prometheus-release-checklist.md"
]);
const CUSTOMER_SURFACE_BETA_PATTERNS = Object.freeze([
  Object.freeze({ id: "beta_tester_role", pattern: /role\s*:\s*["']Beta tester["']/iu }),
  Object.freeze({ id: "beta_territory_label", pattern: /label\s*:\s*["'][^"']*Beta Territory["']/iu }),
  Object.freeze({ id: "beta_radius_label", pattern: /\bbeta radius\b/iu }),
  Object.freeze({ id: "beta_manifest_start", pattern: /start_url[^\n]*beta/iu }),
  Object.freeze({ id: "beta_report_producer", pattern: /reportType\s*:\s*["']beta-daily-rep-report["']/iu }),
  Object.freeze({ id: "beta_profile_instruction", pattern: /purpose\s*:\s*["'][^"']*beta tester profiles["']/iu })
]);

const read = (root, path) => readFileSync(resolveSafePath(root, path));
const readText = (root, path) => read(root, path).toString("utf8");
const readJson = (root, path) => JSON.parse(readText(root, path));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const sorted = values => [...values].sort((left, right) => left.localeCompare(right));

function resolveSafePath(root, path) {
  assert.equal(typeof path, "string", "Evidence path must be a string.");
  assert.ok(path.length > 0 && path.length <= 300, "Evidence path length is invalid.");
  assert.equal(isAbsolute(path), false, `Absolute evidence path is prohibited: ${path}`);
  assert.equal(path.includes("\\"), false, `Backslash evidence path is prohibited: ${path}`);
  const target = resolve(root, path);
  const boundary = `${resolve(root)}${sep}`;
  assert.ok(target.startsWith(boundary), `Evidence path escapes the repository: ${path}`);
  assert.equal(relative(root, target).startsWith(".."), false, `Evidence path escapes the repository: ${path}`);
  return target;
}

function assertRegularFile(root, path) {
  const target = resolveSafePath(root, path);
  assert.equal(existsSync(target), true, `Required launch artifact is absent: ${path}`);
  let current = resolve(root);
  for (const component of path.split("/").slice(0, -1)) {
    current = resolve(current, component);
    assert.equal(existsSync(current), true, `Required launch artifact parent is absent: ${path}`);
    assert.equal(lstatSync(current).isSymbolicLink(), false, `Required launch artifact parent cannot be a symlink: ${path}`);
  }
  const stat = lstatSync(target);
  assert.equal(stat.isSymbolicLink(), false, `Required launch artifact cannot be a symlink: ${path}`);
  assert.equal(stat.isFile(), true, `Required launch artifact must be a regular file: ${path}`);
  return target;
}

function git(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0"
    },
    maxBuffer: 8 * 1024 * 1024,
    timeout: 30_000
  }).trim();
}

function requirementById(matrix, id) {
  const item = matrix.requirements.find(requirement => requirement.id === id);
  assert.ok(item, `Readiness requirement is missing: ${id}`);
  return item;
}

function assertExactObjectKeys(value, expected, label) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object.`);
  assert.deepEqual(sorted(Object.keys(value)), sorted(expected), `${label} contains unexpected fields.`);
}

function assertHistoricalPolicy(policy, label) {
  assertExactObjectKeys(policy, [
    "classification",
    "controllingForLaunch",
    "paths",
    "preserved",
    "reconciliationRule"
  ], label);
  assert.equal(policy.classification, "HISTORICAL_BETA_MATERIAL_NONCONTROLLING");
  assert.equal(policy.controllingForLaunch, false);
  assert.equal(policy.preserved, true);
  assert.deepEqual(sorted(policy.paths), sorted(HISTORICAL_NONCONTROLLING_PATHS));
  assert.equal(
    policy.reconciliationRule,
    "NEWEST_GOVERNED_PRODUCTION_EVIDENCE_AND_CURRENT_CODE_CONTROL"
  );
}

export function validateAugust1ReadinessMatrix(matrix) {
  assertExactObjectKeys(matrix, [
    "authority",
    "directive",
    "historicalEvidencePolicy",
    "matrixId",
    "ownerSubsystem",
    "requirements",
    "schema",
    "statusVocabulary"
  ], "readiness matrix");
  assert.equal(matrix.matrixId, "route-iq-august-1-readiness-matrix-v1");
  assert.equal(matrix.schema, "RouteIqAugust1ReadinessMatrixV1");
  assert.equal(matrix.directive, "Prometheus August 1 Autonomous Launch-Closeout Directive");
  assert.equal(matrix.ownerSubsystem, "Prometheus Overwatch");
  assert.deepEqual(matrix.statusVocabulary, STATUS_VALUES);
  assert.deepEqual(matrix.authority, {
    authoritativeForReadinessReporting: true,
    deploymentAuthorizationSource: false,
    activationAuthorizationSource: false,
    productionEvidenceClaimedWithoutExternalVerification: false,
    subsystemImplementationOwnedByOverwatch: false
  });
  assertHistoricalPolicy(matrix.historicalEvidencePolicy, "matrix historicalEvidencePolicy");
  assert.ok(Array.isArray(matrix.requirements), "Readiness requirements must be an array.");
  assert.deepEqual(sorted(matrix.requirements.map(item => item.id)), sorted(EXPECTED_REQUIREMENT_IDS));
  assert.equal(new Set(matrix.requirements.map(item => item.id)).size, EXPECTED_REQUIREMENT_IDS.length);

  for (const requirement of matrix.requirements) {
    assertExactObjectKeys(requirement, [
      "directivePhase",
      "evidence",
      "founderAttendanceRequired",
      "id",
      "launchBlocking",
      "owner",
      "requiredWork",
      "requirement",
      "status",
      "supportingOwners"
    ], `requirement ${requirement.id}`);
    assert.match(requirement.id, /^[a-z][a-z0-9_]{2,127}$/u);
    assert.match(requirement.directivePhase, /^(?:PHASE_[1-6]|CROSS_PHASE)$/u);
    assert.ok(typeof requirement.requirement === "string" && requirement.requirement.length >= 12);
    assert.ok(typeof requirement.owner === "string" && requirement.owner.startsWith("Prometheus "));
    assert.ok(Array.isArray(requirement.supportingOwners));
    assert.ok(requirement.supportingOwners.every(owner => typeof owner === "string" && owner.startsWith("Prometheus ")));
    assert.ok(STATUS_VALUES.includes(requirement.status), `Invalid status for ${requirement.id}.`);
    assert.equal(typeof requirement.launchBlocking, "boolean");
    assert.equal(typeof requirement.founderAttendanceRequired, "boolean");
    assert.ok(typeof requirement.requiredWork === "string" && requirement.requiredWork.length >= 5);
    assert.ok(Array.isArray(requirement.evidence) && requirement.evidence.length > 0);
    if (requirement.status === "VERIFIED") {
      assert.equal(requirement.launchBlocking, false, `Verified item cannot block launch: ${requirement.id}`);
      assert.equal(requirement.requiredWork, "None.", `Verified item cannot retain work: ${requirement.id}`);
    } else {
      assert.equal(requirement.launchBlocking, true, `Unresolved item must fail closed: ${requirement.id}`);
      assert.notEqual(requirement.requiredWork, "None.", `Unresolved item must state required work: ${requirement.id}`);
    }
    if (requirement.status === "PENDING_FOUNDER") {
      assert.equal(
        requirement.founderAttendanceRequired,
        true,
        `Founder-pending item must require Founder attendance: ${requirement.id}`
      );
    }
    for (const evidence of requirement.evidence) {
      assertExactObjectKeys(evidence, ["classification", "kind", "path"], `evidence for ${requirement.id}`);
      resolveSafePath("/tmp/overwatch-evidence-root", evidence.path);
      assert.ok(["implementation", "test", "contract", "procedure", "governance"].includes(evidence.kind));
      assert.equal(evidence.classification, "CONTROLLING_CURRENT");
      assert.equal(
        HISTORICAL_NONCONTROLLING_PATHS.some(historical => (
          evidence.path === historical || evidence.path.startsWith(historical)
        )),
        false,
        `Historical beta material cannot satisfy a current requirement: ${evidence.path}`
      );
    }
  }
  return matrix;
}

function assertFixedLaunchContract(boundary) {
  assertExactObjectKeys(boundary, [
    "activationDefault",
    "activeCohorts",
    "anthonyMapped",
    "customerPwaCount",
    "externalHumanTestersAllowed",
    "maximumCustomerCompanies",
    "maximumNamedCustomerUsers",
    "prelaunchHumanAcceptanceTester",
    "productClassification",
    "prospectiveCollection",
    "recommendationInfluence"
  ], "fixedLaunchContract");
  assert.deepEqual(boundary, {
    productClassification: "PRODUCTION_NOT_BETA",
    prelaunchHumanAcceptanceTester: "cruz",
    externalHumanTestersAllowed: false,
    maximumCustomerCompanies: 2,
    maximumNamedCustomerUsers: 40,
    customerPwaCount: 1,
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    anthonyMapped: false,
    activationDefault: "OFF"
  });
}

function readinessCounts(matrix) {
  const verified = matrix.requirements.filter(item => item.status === "VERIFIED");
  const blockers = matrix.requirements.filter(item => item.launchBlocking);
  const founderAttendance = matrix.requirements.filter(item => item.founderAttendanceRequired);
  return {
    total: matrix.requirements.length,
    verified: verified.length,
    readinessPercent: Number(((verified.length / matrix.requirements.length) * 100).toFixed(1)),
    blockerIds: blockers.map(item => item.id),
    founderAttendanceIds: founderAttendance.map(item => item.id)
  };
}

function assertSourceObservations(observations) {
  assertExactObjectKeys(observations, [
    "allOwnerCommitsComplete",
    "businessHoursCompatibilityVerification",
    "businessHoursFocusedTests",
    "crmFocusedTests",
    "customerFacingBetaFindings",
    "customerPwaRuntimeWiredToPrivateWorker",
    "dashboardFocusedTests",
    "dashboardSourceMatchesGeneratedAsset",
    "dashboardRuntimeVerification",
    "dashboardBrowserQualificationComplete",
    "fullQualificationComplete",
    "genericCustomerPwa",
    "infrastructureFocusedTests",
    "intelligenceGeneratedAssetParity",
    "intelligenceGovernedRuntimeScopeFocusedTests",
    "intelligenceGovernedRuntimeScopeVerification",
    "observationState",
    "ownerArtifactsCommitted",
    "ownerFocusedTests",
    "ownerSuccessorBaseline",
    "productionCrmMonitoringImplementationPresent",
    "replenishmentCompatibilityVerification",
    "replenishmentFocusedTests",
    "rollbackSuccessorQualificationComplete",
    "workingTreeClean"
  ], "sourceObservations");
  assert.ok([
    "NONFINAL_SHARED_WORKTREE",
    "FINAL_EXACT_CANDIDATE"
  ].includes(observations.observationState));
  for (const field of [
    "allOwnerCommitsComplete",
    "dashboardBrowserQualificationComplete",
    "rollbackSuccessorQualificationComplete",
    "workingTreeClean"
  ]) assert.equal(typeof observations[field], "boolean", `${field} must be a boolean.`);
  const finalPrerequisites = observations.allOwnerCommitsComplete
    && observations.dashboardBrowserQualificationComplete
    && observations.rollbackSuccessorQualificationComplete
    && observations.workingTreeClean
    && observations.fullQualificationComplete;
  assert.equal(
    observations.observationState,
    finalPrerequisites ? "FINAL_EXACT_CANDIDATE" : "NONFINAL_SHARED_WORKTREE"
  );
  assert.equal(typeof observations.dashboardSourceMatchesGeneratedAsset, "boolean");
  assert.deepEqual(observations.dashboardRuntimeVerification, {
    command: "node scripts/verify-dashboard-runtime-workflows.mjs",
    total: 153,
    passed: 153,
    failed: 0,
    mismatchedOperatingProfilesFailClosed: 4,
    result: finalPrerequisites ? "PASS" : "LOCAL_PASS_NONFINAL"
  });
  assert.deepEqual(observations.dashboardFocusedTests, {
    command: "node --test tests/dashboard-route-iq-customer-pwa.test.mjs",
    total: 12,
    passed: 12,
    failed: 0,
    result: finalPrerequisites ? "PASS" : "LOCAL_PASS_NONFINAL"
  });
  assert.ok(Array.isArray(observations.customerFacingBetaFindings));
  assert.equal(typeof observations.customerPwaRuntimeWiredToPrivateWorker, "boolean");
  assert.equal(typeof observations.productionCrmMonitoringImplementationPresent, "boolean");
  assert.equal(typeof observations.ownerArtifactsCommitted, "boolean");
  assert.equal(typeof observations.fullQualificationComplete, "boolean");
  if (observations.allOwnerCommitsComplete) assert.equal(observations.ownerArtifactsCommitted, true);
  assert.deepEqual(observations.ownerSuccessorBaseline, OWNER_SUCCESSOR_BASELINE);
  assertExactObjectKeys(observations.crmFocusedTests, [
    "command",
    "failed",
    "passed",
    "result",
    "total"
  ], "sourceObservations.crmFocusedTests");
  assert.deepEqual(observations.crmFocusedTests, {
    command: "node --test tests/route-iq-request-crm-infrastructure.test.mjs",
    total: 20,
    passed: 20,
    failed: 0,
    result: finalPrerequisites ? "PASS" : "LOCAL_PASS_NONFINAL"
  });
  assert.deepEqual(observations.intelligenceGovernedRuntimeScopeFocusedTests, {
    command: "node --test tests/route-iq-governed-runtime-scope-intelligence.test.mjs",
    total: 5,
    passed: 5,
    failed: 0,
    result: finalPrerequisites ? "PASS" : "LOCAL_PASS_NONFINAL"
  });
  assert.deepEqual(observations.intelligenceGovernedRuntimeScopeVerification, {
    command: "node scripts/verify-route-iq-governed-runtime-scope-intelligence.mjs",
    result: finalPrerequisites ? "PASS" : "LOCAL_PASS_NONFINAL"
  });
  assert.deepEqual(observations.businessHoursFocusedTests, {
    command: "node --test tests/route-business-hours-eligibility.test.mjs",
    total: 16,
    passed: 16,
    failed: 0,
    result: finalPrerequisites ? "PASS" : "LOCAL_PASS_NONFINAL"
  });
  assert.deepEqual(observations.replenishmentFocusedTests, {
    command: "node --test tests/continuous-adaptive-route-replenishment.test.mjs",
    total: 10,
    passed: 10,
    failed: 0,
    result: finalPrerequisites ? "PASS" : "LOCAL_PASS_NONFINAL"
  });
  assertExactObjectKeys(observations.intelligenceGeneratedAssetParity, [
    "businessHoursContract",
    "businessHoursEligibilityModule",
    "businessHoursGovernanceModule",
    "continuousAdaptiveRouteReplenishmentContract",
    "continuousAdaptiveRouteReplenishmentModule",
    "governedRuntimeScopeModule"
  ], "sourceObservations.intelligenceGeneratedAssetParity");
  for (const value of Object.values(observations.intelligenceGeneratedAssetParity)) {
    assert.equal(typeof value, "boolean", "Intelligence generated-asset parity values must be boolean.");
  }
  const businessHoursParityComplete = observations.intelligenceGeneratedAssetParity.businessHoursEligibilityModule
    && observations.intelligenceGeneratedAssetParity.businessHoursGovernanceModule
    && observations.intelligenceGeneratedAssetParity.businessHoursContract;
  const replenishmentParityComplete = observations.intelligenceGeneratedAssetParity.continuousAdaptiveRouteReplenishmentModule
    && observations.intelligenceGeneratedAssetParity.continuousAdaptiveRouteReplenishmentContract;
  const governedRuntimeScopeParityComplete =
    observations.intelligenceGeneratedAssetParity.governedRuntimeScopeModule;
  const compatibilityResult = complete => (
    complete ? (finalPrerequisites ? "PASS" : "LOCAL_PASS_NONFINAL") : "LOCAL_FAIL_NONFINAL"
  );
  assert.deepEqual(observations.businessHoursCompatibilityVerification, {
    command: "node scripts/verify-route-business-hours-eligibility.mjs",
    result: compatibilityResult(businessHoursParityComplete),
    fixedReasonCode: businessHoursParityComplete ? "NONE" : "SOURCE_DEPLOYMENT_PARITY_DRIFT"
  });
  assert.deepEqual(observations.replenishmentCompatibilityVerification, {
    command: "node scripts/verify-continuous-adaptive-route-replenishment.mjs",
    result: compatibilityResult(replenishmentParityComplete),
    fixedReasonCode: replenishmentParityComplete ? "NONE" : "SOURCE_DEPLOYMENT_PARITY_DRIFT"
  });
  if (finalPrerequisites) {
    assert.equal(businessHoursParityComplete, true);
    assert.equal(replenishmentParityComplete, true);
    assert.equal(governedRuntimeScopeParityComplete, true);
  }
  assert.deepEqual(observations.infrastructureFocusedTests, {
    command: "node --test tests/route-iq-august-1-customer-pwa-infrastructure.test.mjs tests/route-iq-private-forward-rollback-candidate-v2.test.mjs",
    total: 27,
    passed: 27,
    failed: 0,
    result: finalPrerequisites ? "PASS" : "LOCAL_PASS_NONFINAL"
  });
  assertExactObjectKeys(observations.ownerFocusedTests, [
    "command",
    "failed",
    "failedAssertions",
    "passed",
    "result",
    "total"
  ], "sourceObservations.ownerFocusedTests");
  assert.equal(
    observations.ownerFocusedTests.command,
    "node --test tests/route-iq-august-1-launch-envelope.test.mjs tests/route-iq-august-1-customer-pwa-infrastructure.test.mjs tests/dashboard-route-iq-customer-pwa.test.mjs"
  );
  assert.equal(observations.ownerFocusedTests.total, 43);
  assert.equal(observations.ownerFocusedTests.passed, 43);
  assert.equal(observations.ownerFocusedTests.failed, 0);
  assert.equal(observations.ownerFocusedTests.result, finalPrerequisites ? "PASS" : "LOCAL_PASS_NONFINAL");
  assert.deepEqual(observations.ownerFocusedTests.failedAssertions, []);
}

export function validateAugust1GovernanceReport(contract, matrix) {
  assertExactObjectKeys(contract, [
    "artifactPins",
    "authority",
    "contractId",
    "directive",
    "externalActionBoundary",
    "fixedLaunchContract",
    "historicalEvidencePolicy",
    "matrix",
    "ownerSubsystem",
    "ownershipBoundary",
    "productionCrmAcceptance",
    "readinessReport",
    "schema",
    "sourceObservations",
    "startingRepositoryState"
  ], "governance report contract");
  assert.equal(contract.contractId, "route-iq-august-1-launch-closeout-v1");
  assert.equal(contract.schema, "RouteIqAugust1LaunchCloseoutGovernanceReportV1");
  assert.equal(contract.directive, matrix.directive);
  assert.equal(contract.ownerSubsystem, "Prometheus Overwatch");
  assert.deepEqual(contract.authority, {
    authoritativeReadinessMatrix: true,
    releaseGateOnly: true,
    deploymentAuthorized: false,
    activationAuthorized: false,
    productionMutationAuthorizedByThisPackage: false,
    recordsPriorAuthorizedProductionMutation: true,
    externalActionRecorded: true
  });
  assert.deepEqual(contract.startingRepositoryState, {
    branch: "main",
    commit: STARTING_COMMIT,
    tree: STARTING_TREE,
    classification: "AUTHORIZED_AUDIT_BASELINE"
  });
  assert.deepEqual(contract.ownershipBoundary, {
    overwatchMayModifySubsystemImplementation: false,
    allowedPathFamilies: [
      "overwatch/**",
      "scripts/verify-overwatch-*.mjs",
      "tests/overwatch-*.test.mjs",
      "package.json"
    ],
    packageJsonReleaseGateWiringOwnedByOverwatch: true,
    referencedSubsystemArtifactsRemainOwnerAuthored: true
  });
  assertFixedLaunchContract(contract.fixedLaunchContract);
  assertHistoricalPolicy(contract.historicalEvidencePolicy, "contract historicalEvidencePolicy");
  assert.deepEqual(contract.historicalEvidencePolicy, matrix.historicalEvidencePolicy);
  assertSourceObservations(contract.sourceObservations);
  assert.deepEqual(contract.matrix, {
    path: AUGUST_1_READINESS_MATRIX_PATH,
    sha256: sha256(Buffer.from(`${JSON.stringify(matrix, null, 2)}\n`, "utf8"))
  });
  assert.deepEqual(contract.externalActionBoundary, {
    cloudflareConfigurationMutated: false,
    githubConfigurationMutated: false,
    productionPublicIntakeAccessed: true,
    productionDataMutated: true,
    authorizedSyntheticCrmRecordCreated: true,
    productionCrmReadReconciled: false,
    crmSubmissionRetried: false,
    crmRecordDeleted: false,
    crmRecordCorrected: false,
    notificationRetryPerformed: false,
    deploymentPerformed: false,
    activationPerformed: false,
    customerContacted: false,
    secretValuesAccessed: false
  });
  assert.deepEqual(contract.productionCrmAcceptance, {
    classification: "FOUNDER_REPORTED_GOVERNED_EVIDENCE_NOT_INDEPENDENTLY_RECONCILED",
    productionAccessedByThisOverwatchPackage: false,
    productionAccessOccurredDuringAuthorizedAcceptance: true,
    productionMutationOccurred: true,
    authorizedSyntheticSubmissionAttempts: 1,
    observedSubmissionAttempts: 1,
    automaticRetryOccurred: false,
    secondSubmissionAllowed: false,
    preSubmissionCrmCount: 0,
    preSubmissionNotificationCount: 0,
    publicSubmissionResult: "ACCEPTED_STORED",
    receipt: "riq_receipt_e74e57903a211291a9f1f37a",
    postWriteReadOnlyReconciliation: "BLOCKED_FOUNDER_ACCESS_SESSION_EXPIRED",
    requiredReadOnlyChecks: [
      "CRM_COUNT_EXACTLY_1",
      "UNIQUE_RECEIPT_MATCH",
      "STORED_SYNTHETIC_VALUES_MATCH",
      "NOTIFICATION_STATE_RECORDED",
      "DUPLICATE_ABSENCE"
    ],
    founderAttendanceRequiredOnlyForAccessReauthentication: true
  });
  assert.ok(Array.isArray(contract.artifactPins) && contract.artifactPins.length > 0);
  assert.equal(new Set(contract.artifactPins.map(item => item.path)).size, contract.artifactPins.length);
  for (const artifact of contract.artifactPins) {
    assertExactObjectKeys(artifact, ["classification", "owner", "path", "required", "sha256"], `artifact pin ${artifact.path}`);
    resolveSafePath("/tmp/overwatch-artifact-root", artifact.path);
    assert.equal(artifact.classification, "CONTROLLING_CURRENT");
    assert.equal(artifact.required, true);
    assert.ok(typeof artifact.owner === "string" && artifact.owner.startsWith("Prometheus "));
    assert.match(artifact.sha256, /^[a-f0-9]{64}$/u);
  }
  const pinnedPaths = new Set(contract.artifactPins.map(item => item.path));
  const evidencePaths = new Set();
  for (const requirement of matrix.requirements) {
    for (const evidence of requirement.evidence) {
      evidencePaths.add(evidence.path);
      assert.equal(pinnedPaths.has(evidence.path), true, `Matrix evidence is not pinned: ${evidence.path}`);
    }
  }
  assert.deepEqual(
    sorted(pinnedPaths),
    sorted(evidencePaths),
    "Artifact pins must exactly match current controlling matrix evidence."
  );

  const counts = readinessCounts(matrix);
  assert.deepEqual(contract.readinessReport, {
    totalRequirements: counts.total,
    verifiedRequirements: counts.verified,
    readinessPercent: counts.readinessPercent,
    launchBlockerIds: counts.blockerIds,
    founderAttendanceRequirementIds: counts.founderAttendanceIds,
    finalStatus: FINAL_BLOCKED_STATUS
  });
  assert.ok(counts.blockerIds.length > 0, "Launch readiness cannot be declared without explicit blocker closure.");
  return contract;
}

export function validateAugust1ReadinessSuccessors(successors) {
  assertExactObjectKeys(successors, [
    "governanceId",
    "historicalCloseoutEvidenceRewritten",
    "overwatchCurrentEvidence",
    "ownerSubsystem",
    "successors"
  ], "August 1 readiness successors");
  assert.equal(successors.governanceId,
    "route-iq-august-1-readiness-successors-v1");
  assert.equal(successors.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(successors.historicalCloseoutEvidenceRewritten, false);
  assert.equal(successors.successors.length, 13);
  const infrastructureSuccessor = successors.successors[0];
  assert.equal(infrastructureSuccessor.commit,
    "96c8210b94c3b0214dede252aba3d6d46121cd05");
  assert.equal(infrastructureSuccessor.tree,
    "8e7decf92b5d55e613d8a5ddc4bb2d1e3bd200af");
  assert.equal(infrastructureSuccessor.owner,
    "Prometheus Infrastructure <infrastructure@prometheus.local>");
  assert.ok(typeof infrastructureSuccessor.reason === "string"
    && infrastructureSuccessor.reason.length >= 80);
  assert.deepEqual(infrastructureSuccessor.evidence, [{
    path: "workers/prometheus-iq-worker.js",
    previousSha256: "58d52967de329daa034751c1cf95ad1ae3da8a853c5cceeb950f0656ed51e2c8",
    successorSha256: "0ee3fb5426f5104fc70d97c0ce284d149fb5e13d2f521c04214bd361fa39ea61"
  }]);
  const overwatchSuccessor = successors.successors[1];
  assert.equal(overwatchSuccessor.commit,
    "75d03ba3440a1b97b128b0a147eff07edf59dde3");
  assert.equal(overwatchSuccessor.tree,
    "a3fc65367b789d2bdbe4f35409cf375e6f7240b4");
  assert.equal(overwatchSuccessor.owner,
    "Prometheus Overwatch <overwatch@prometheus.local>");
  assert.ok(typeof overwatchSuccessor.reason === "string"
    && overwatchSuccessor.reason.length >= 80);
  assert.deepEqual(overwatchSuccessor.evidence, [
    {
      path: "scripts/verify-overwatch-cloudflare-founder-attended-service-token.mjs",
      previousSha256: "c071d50e52a889519421cedbbd59e139b4bc5598f70b32d02096c929d3332d66",
      successorSha256: "4047aa80820da7992d00435fc5f4dc291a1cecabbb3997833e478be2d30ff1f7"
    },
    {
      path: "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
      previousSha256: "eb9aa716d7d9704dd519696599b6987cf80562c09273f9d3a204a0f77d2e9456",
      successorSha256: "37464cccb6b300605f3bccfaf7ffdf4fbd8aa74acd2b3111af7e151e97972790"
    },
    {
      path: "tests/overwatch-cloudflare-founder-attended-service-token.test.mjs",
      previousSha256: "d4977bcfffd4c3c10170d32456ddadcac38c88043e4ce3ac44cac0d9dd097e83",
      successorSha256: "26516d3cfa664bf0258ba60e8a010e726bb2f0d2881e1df29ac6762bcbbbb075"
    }
  ]);
  const dashboardSuccessor = successors.successors[2];
  assert.equal(dashboardSuccessor.commit,
    "30ea86e0a2d0176cc22bad583a01829b3f379db3");
  assert.equal(dashboardSuccessor.tree,
    "b863b743a7f54cb4ff784c60ee418addee963b97");
  assert.equal(dashboardSuccessor.owner,
    "Prometheus Dashboard <dashboard@prometheus.local>");
  assert.ok(typeof dashboardSuccessor.reason === "string"
    && dashboardSuccessor.reason.length >= 80);
  assert.deepEqual(dashboardSuccessor.evidence, [
    {
      path: "scripts/verify-dashboard-runtime-workflows.mjs",
      previousSha256: "ff8316baef4e9c02d81489a5f902de20fa17a9b9c6eb560d33d9026c5f3a66ad",
      successorSha256: "8ff5c687150a0b500dc6e8672b73156495c86021ae873e6ec13ac08ce720ee83"
    },
    {
      path: "tests/dashboard-route-iq-product-focus.test.mjs",
      previousSha256: "f319f872421ac6b50ebe7c07865239053f6639fea106eafd51061ddd52ff0cbf",
      successorSha256: "8cdf3ae813a53279a18877541b3ab60e7e3e8bf8bc11d0d8524be853ecdcf5cf"
    }
  ]);
  const harmonySuccessor = successors.successors[3];
  assert.equal(harmonySuccessor.commit,
    "f52e623f0cb9c37a7f9953bec221b52417ecfc51");
  assert.equal(harmonySuccessor.tree,
    "f6d75a51c1f0ff1bee113a67483da0e60cfcd75c");
  assert.equal(harmonySuccessor.owner,
    "Prometheus Overwatch <overwatch@prometheus.local>");
  assert.ok(typeof harmonySuccessor.reason === "string"
    && harmonySuccessor.reason.length >= 80);
  assert.deepEqual(harmonySuccessor.evidence, [
    {
      path: "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
      previousSha256: "37464cccb6b300605f3bccfaf7ffdf4fbd8aa74acd2b3111af7e151e97972790",
      successorSha256: "c9aca5d0af0bce1c675bffff4558e55cd7918d0e6b011f9747a716a6a2b7bdff"
    }
  ]);
  assert.deepEqual(
    successors.successors.slice(4).map(successor => successor.commit),
    [
      "25f4ad75f8f550ae9bcdb864fe1a6f7acb4db96c",
      "aa0c50ade9b66fd579c3609107a02e4c70de4179",
      "9647934b75c46218f6af6304e8d169ccf7285529",
      "f0782326c2339622feef098c22cf9330c342ae0b",
      "c4cb9150fb8ad218e34026a63fa577271860c270",
      "e225b9e6380416cceddbfe10ee7aa318b123e75c",
      "254218013ea7ef29eb679220a6219fd976c1a39f",
      "bb1fd5556b1dea353ec67159c263b7a7474683a0",
      "bbed83c62e6c8d2c73ce287161df282005f99187"
    ]
  );
  for (const successor of successors.successors.slice(4)) {
    assertExactObjectKeys(successor, ["commit", "evidence", "owner", "reason", "tree"], "identity successor");
    assert.match(successor.commit, /^[a-f0-9]{40}$/u);
    assert.match(successor.tree, /^[a-f0-9]{40}$/u);
    assert.match(successor.owner, /^Prometheus .+ <[^>]+@prometheus\.local>$/u);
    assert.ok(typeof successor.reason === "string" && successor.reason.length >= 80);
    assert.ok(Array.isArray(successor.evidence) && successor.evidence.length > 0);
    for (const evidence of successor.evidence) {
      assertExactObjectKeys(evidence, ["path", "previousSha256", "successorSha256"], "identity successor evidence");
      resolveSafePath("/tmp/overwatch-successor-root", evidence.path);
      assert.match(evidence.previousSha256, /^[a-f0-9]{64}$/u);
      assert.match(evidence.successorSha256, /^[a-f0-9]{64}$/u);
      assert.notEqual(evidence.previousSha256, evidence.successorSha256);
    }
  }
  const canonicalIdentityHarnessSuccessor = successors.successors[10];
  assert.equal(canonicalIdentityHarnessSuccessor.commit,
    "254218013ea7ef29eb679220a6219fd976c1a39f");
  assert.equal(canonicalIdentityHarnessSuccessor.tree,
    "9cf5db1956ced5381d4c1759822849f58a43a8d0");
  assert.equal(canonicalIdentityHarnessSuccessor.owner,
    "Prometheus Dashboard <dashboard@prometheus.local>");
  assert.deepEqual(canonicalIdentityHarnessSuccessor.evidence, [{
    path: "scripts/verify-dashboard-runtime-workflows.mjs",
    previousSha256: "ceedb7133621557fe188ccc9fec676a7d57b2b257e38b76855c6d1e98e0c29f5",
    successorSha256: "f15bef69f0bffc9104b64f71fd7328df3da4f711d73270226ff67e259789bb9c"
  }]);
  const canonicalPublicReleaseVerifierSuccessor = successors.successors[11];
  assert.equal(canonicalPublicReleaseVerifierSuccessor.commit,
    "bb1fd5556b1dea353ec67159c263b7a7474683a0");
  assert.equal(canonicalPublicReleaseVerifierSuccessor.tree,
    "9403e81467ae41a8b04b0b25f69fbf60a3aeb939");
  assert.equal(canonicalPublicReleaseVerifierSuccessor.owner,
    "Prometheus Overwatch <overwatch@prometheus.local>");
  assert.deepEqual(canonicalPublicReleaseVerifierSuccessor.evidence, [
    {
      path: "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
      previousSha256: "c9aca5d0af0bce1c675bffff4558e55cd7918d0e6b011f9747a716a6a2b7bdff",
      successorSha256: "9f9d684c4b8c01f824fe784d70364c0b72b3f2fc00343a001827d692247f11f4"
    },
    {
      path: "tests/overwatch-auto-push-governance.test.mjs",
      previousSha256: "79f76a983b13d0cf942455e2c9258e1f818b3d028aa678f4dee018ae93cc73d8",
      successorSha256: "481dde2cf97bb28b369842af0501e4895f01664ad04f5e8609760003054b535e"
    },
    {
      path: "tests/overwatch-public-deployment-workflow-v2.test.mjs",
      previousSha256: "b15f05c7a03063319cf66620a4d0c1f7fcdfe4690202932666214ade5d95f18d",
      successorSha256: "b2fe3c47929454c0e863a4592d8278352bdf791c963cdd07a88b47cc7d540b58"
    }
  ]);
  const fieldSessionProducerFixtureSuccessor = successors.successors[12];
  assert.equal(fieldSessionProducerFixtureSuccessor.commit,
    "bbed83c62e6c8d2c73ce287161df282005f99187");
  assert.equal(fieldSessionProducerFixtureSuccessor.tree,
    "bf5eefb132663c5a2fc0b424cf9613e69455ca86");
  assert.equal(fieldSessionProducerFixtureSuccessor.owner,
    "Prometheus Dashboard <dashboard@prometheus.local>");
  assert.deepEqual(fieldSessionProducerFixtureSuccessor.evidence, [{
    path: "tests/dashboard-route-iq-field-session-producer.test.mjs",
    previousSha256: "5bd7e5da3f7597034ca684f02d45026c6244025429a2e348ed2395aed59be9dd",
    successorSha256: "6f676f95c2f56bde6457c197b1fe917fa4d3b594c0bae971fb0faf51f9122477"
  }]);
  assert.ok(Array.isArray(successors.overwatchCurrentEvidence));
  assert.deepEqual(
    sorted(successors.overwatchCurrentEvidence.map(item => item.path)),
    sorted([
      "package.json",
      "scripts/verify-overwatch-route-iq-august-1-launch-readiness.mjs",
      "scripts/verify-overwatch-route-iq-august-1-launch-readiness.mjs",
      "tests/overwatch-route-iq-august-1-launch-readiness.test.mjs",
      "tests/overwatch-route-iq-august-1-launch-readiness.test.mjs"
    ])
  );
  for (const item of successors.overwatchCurrentEvidence) {
    assert.match(item.previousSha256, /^[a-f0-9]{64}$/u);
    assert.match(item.successorSha256, /^[a-f0-9]{64}$/u);
    assert.notEqual(item.previousSha256, item.successorSha256);
  }
  return successors;
}

function successorEvidenceMap(successors) {
  const evidenceByPath = new Map();
  for (const item of [
    ...successors.successors.flatMap(successor => successor.evidence),
    ...successors.overwatchCurrentEvidence
  ]) {
    const evidence = evidenceByPath.get(item.path) ?? [];
    evidence.push(item);
    evidenceByPath.set(item.path, evidence);
  }
  return evidenceByPath;
}

function successorChainReaches(evidence, historicalSha256, currentSha256) {
  const pending = [historicalSha256];
  const visited = new Set();
  while (pending.length > 0) {
    const candidate = pending.shift();
    if (candidate === currentSha256) return true;
    if (visited.has(candidate)) continue;
    visited.add(candidate);
    for (const item of evidence) {
      if (item.previousSha256 === candidate && !visited.has(item.successorSha256)) {
        pending.push(item.successorSha256);
      }
    }
  }
  return false;
}

function verifySuccessorOwnerChain(root, successors) {
  for (const successor of successors.successors) {
    assert.equal(git(root, "rev-parse", `${successor.commit}^{tree}`), successor.tree,
      `Successor tree drifted: ${successor.commit}`);
    assert.equal(git(root, "show", "-s", "--format=%an <%ae>", successor.commit), successor.owner,
      `Successor owner drifted: ${successor.commit}`);
    git(root, "merge-base", "--is-ancestor", successor.commit, "HEAD");
  }
}

function verifyArtifactPins(root, contract, successors) {
  const accepted = successorEvidenceMap(successors);
  for (const artifact of contract.artifactPins) {
    assertRegularFile(root, artifact.path);
    const actual = sha256(read(root, artifact.path));
    const successorEvidence = accepted.get(artifact.path);
    if (actual !== artifact.sha256 && successorEvidence) {
      assert.equal(
        successorChainReaches(successorEvidence, artifact.sha256, actual),
        true,
        `Launch successor evidence drifted: no chain connects the historical pin to the current artifact: ${artifact.path}`
      );
      continue;
    }
    assert.equal(
      actual,
      artifact.sha256,
      `Required launch artifact drifted: ${artifact.path}`
    );
  }
}

function findCustomerSurfaceBetaMarkers(root, paths) {
  const findings = [];
  for (const path of paths) {
    const source = readText(root, path);
    for (const entry of CUSTOMER_SURFACE_BETA_PATTERNS) {
      if (entry.pattern.test(source)) findings.push(`${path}:${entry.id}`);
    }
  }
  return sorted(findings);
}

function assertRequiredText(root, path, snippets) {
  const value = readText(root, path);
  for (const snippet of snippets) {
    assert.ok(value.includes(snippet), `${path} lost required launch language: ${snippet}`);
  }
}

function verifyFixedOwnerEvidence(root, matrix, contract) {
  const packageJson = readJson(root, "package.json");
  assert.equal(
    packageJson.scripts?.["data:route-iq-august-1-launch-envelope:check"],
    "node --test tests/route-iq-august-1-launch-envelope.test.mjs"
  );
  assert.equal(
    packageJson.scripts?.["infrastructure:route-iq-august-1-customer-pwa-rollback:check"],
    "node --test tests/route-iq-august-1-customer-pwa-infrastructure.test.mjs tests/route-iq-private-forward-rollback-candidate-v2.test.mjs"
  );
  assert.equal(
    packageJson.scripts?.["intelligence:route-iq-governed-runtime-scope:check"],
    "node scripts/verify-route-iq-governed-runtime-scope-intelligence.mjs && node --test tests/route-iq-governed-runtime-scope-intelligence.test.mjs"
  );
  assert.equal(
    packageJson.scripts?.["overwatch:route-iq-august-1-readiness:check"],
    "node scripts/verify-overwatch-route-iq-august-1-launch-readiness.mjs && node --test tests/overwatch-route-iq-august-1-launch-readiness.test.mjs"
  );
  const requiredPretestSteps = [
    "npm run data:route-iq-august-1-launch-envelope:check",
    "npm run infrastructure:route-iq-august-1-customer-pwa-rollback:check",
    "npm run intelligence:route-iq-governed-runtime-scope:check",
    "npm run overwatch:route-iq-august-1-readiness:check"
  ];
  const pretestSteps = String(packageJson.scripts?.pretest || "").split(" && ");
  let previousPretestIndex = -1;
  for (const requiredStep of requiredPretestSteps) {
    const index = pretestSteps.indexOf(requiredStep);
    assert.ok(index > previousPretestIndex, `Required pretest step is absent or out of order: ${requiredStep}`);
    previousPretestIndex = index;
  }
  const envelope = readJson(
    root,
    "data/route-iq-commercial-readiness-v1/route-iq-august-1-launch-envelope-v1.json"
  );
  assert.deepEqual(envelope, {
    version: "route-iq-august-1-launch-envelope-v1",
    state: "OFF",
    classification: "PRODUCTION_ACTIVATION",
    issuedAt: null,
    expiresAt: null,
    limits: { maximumCompanies: 2, maximumNamedUsers: 40 },
    safety: {
      prelaunchHumanAcceptanceTester: "cruz",
      externalHumanTesting: false,
      anthonyMapped: false,
      prospectiveCollection: "OFF",
      activeCohorts: 0,
      recommendationInfluence: "OFF"
    },
    workspaceAdmissions: []
  });

  assertRequiredText(root, "data/route-iq-commercial-readiness-v1/route-iq-august-1-launch-envelope.mjs", [
    "routeIqAugust1LaunchMaximumCompanies = 2",
    "routeIqAugust1LaunchMaximumNamedUsers = 40",
    "route_iq_launch_company_limit_exceeded",
    "route_iq_launch_user_limit_exceeded",
    "route_iq_launch_inactive",
    "representativeId === \"anthony\""
  ]);
  assertRequiredText(root, "tests/route-iq-august-1-launch-envelope.test.mjs", [
    "checked-in August 1 launch envelope is default OFF and admits nobody",
    "two companies and forty named users are admitted exactly at the bounded ceiling",
    "three companies and forty-one named users fail closed",
    "Anthony"
  ]);
  assertRequiredText(root, "administration/launch-operations/route-iq-2026-08-01-production-activation-v1.md", [
    "Product state: production activation, not beta",
    "Cruz alone performs prelaunch human acceptance.",
    "No customer user or external person may be used as a prelaunch tester.",
    "Collection remains `OFF`",
    "Active cohorts remain `0`",
    "Recommendation influence remains `OFF`",
    "Anthony remains unmapped",
    "One generic PWA"
  ]);
  assertRequiredText(root, "administration/workflows/route-iq-production-support-triage-v1.md", [
    "Historical beta support files remain preserved but do not control",
    "production procedure, not a beta-support process"
  ]);
  assertRequiredText(root, "docs/route-iq-production-provisioning-monitoring-incident-rollback-v1.md", [
    "Customer companies: maximum `2`.",
    "Named customer users: maximum `40`",
    "Prelaunch human acceptance: Cruz only.",
    "Any unknown state fails closed.",
    "Forward-Compatible Rollback Procedure"
  ]);
  assertRequiredText(root, "docs/route-iq-pwa-installation-and-recovery-v1.md", [
    "Application model: one generic Route IQ operational PWA",
    "No Founder CRM, Founder intelligence, owner, or administrative control appears to a representative.",
    "Collection remains `OFF`, cohorts remain `0`, and recommendation influence remains `OFF`"
  ]);
  assertRequiredText(root, "sales/route-iq-customer-onboarding-v1.md", [
    "It is not a beta script",
    "no more than two Founder-approved companies",
    "at or below 40",
    "Anthony remains unmapped"
  ]);
  assertRequiredText(root, "docs/route-iq-production-known-limitations-v1.md", [
    "It is not a beta disclaimer",
    "The August 1 production ceiling is two customer companies and 40 named customer users.",
    "Route IQ uses one generic PWA",
    "Do not describe Route IQ as a beta"
  ]);

  const manifest = readJson(root, contract.sourceObservations.genericCustomerPwa.manifestPath);
  assert.equal(manifest.name, "Prometheus Route IQ by Prometheus.IQ");
  assert.equal(manifest.short_name, "Route IQ");
  assert.equal(manifest.start_url, "/app");
  const founderManifest = readJson(root, "manifest-founder.webmanifest");
  assert.equal(founderManifest.name, "Prometheus Route IQ by Prometheus.IQ");
  assert.match(founderManifest.start_url, /role=founder/u);
  assert.deepEqual(contract.sourceObservations.genericCustomerPwa, {
    customerManifestCount: 1,
    manifestPath: "manifest.webmanifest",
    expectedName: "Route IQ",
    expectedStartUrl: "/app",
    founderManifestClassification: "INTERNAL_FOUNDER_NON_CUSTOMER"
  });

  const dashboardParityPairs = [
    ["_headers", "deploy/cloudflare-pages/_headers"],
    ["index.html", "deploy/cloudflare-pages/index.html"],
    ["manifest-founder.webmanifest", "deploy/cloudflare-pages/manifest-founder.webmanifest"],
    ["manifest.webmanifest", "deploy/cloudflare-pages/manifest.webmanifest"],
    ["sw.js", "deploy/cloudflare-pages/sw.js"]
  ];
  const dashboardParity = dashboardParityPairs.every(([source, generated]) => (
    read(root, source).equals(read(root, generated))
  ));
  assert.equal(
    dashboardParity,
    contract.sourceObservations.dashboardSourceMatchesGeneratedAsset,
    "Dashboard generated-asset parity observation drifted."
  );
  const betaFindings = findCustomerSurfaceBetaMarkers(root, [
    "index.html",
    "deploy/cloudflare-pages/index.html",
    "manifest.webmanifest",
    "manifest-founder.webmanifest"
  ]);
  assert.deepEqual(
    betaFindings,
    contract.sourceObservations.customerFacingBetaFindings,
    "Customer-facing beta-language observation drifted."
  );
  const customerManifests = readdirSync(root)
    .filter(name => /^manifest(?:-[^.]+)?\.webmanifest$/u.test(name))
    .filter(name => name !== "manifest-founder.webmanifest");
  assert.deepEqual(customerManifests, ["manifest.webmanifest"]);

  const privateWorker = readText(root, "workers/prometheus-iq-worker.js");
  const runtimeWired = privateWorker.includes("route-iq-august-1-customer-pwa-runtime.js")
    && privateWorker.includes("handleRouteIqCustomerPwaRequest");
  assert.equal(
    runtimeWired,
    contract.sourceObservations.customerPwaRuntimeWiredToPrivateWorker,
    "Customer PWA runtime-integration observation drifted."
  );
  const crmRuntime = readText(root, "workers/infrastructure/route-iq-request-crm-runtime.js");
  const crmContract = readText(root, "workers/infrastructure/route-iq-request-crm-runtime-v1.json");
  const crmMonitoringPresent = crmRuntime.includes("notification")
    && crmRuntime.includes("monitor")
    && crmContract.includes("monitor");
  assert.equal(
    crmMonitoringPresent,
    contract.sourceObservations.productionCrmMonitoringImplementationPresent,
    "CRM monitoring implementation observation drifted."
  );

  const intelligenceGeneratedAssetParity = {
    businessHoursEligibilityModule: read(root, "intelligence/route-business-hours-eligibility.mjs")
      .equals(read(root, "deploy/cloudflare-pages/intelligence/route-business-hours-eligibility.mjs")),
    businessHoursGovernanceModule: read(root, "scripts/lib/business-hours-governance.mjs")
      .equals(read(root, "deploy/cloudflare-pages/scripts/lib/business-hours-governance.mjs")),
    businessHoursContract: read(root, "intelligence/contracts/route-business-hours-eligibility-contracts.json")
      .equals(read(root, "deploy/cloudflare-pages/intelligence/contracts/route-business-hours-eligibility-contracts.json")),
    continuousAdaptiveRouteReplenishmentModule: read(root, "intelligence/continuous-adaptive-route-replenishment.mjs")
      .equals(read(root, "deploy/cloudflare-pages/intelligence/continuous-adaptive-route-replenishment.mjs")),
    continuousAdaptiveRouteReplenishmentContract: read(root, "intelligence/contracts/continuous-adaptive-route-replenishment-contracts.json")
      .equals(read(root, "deploy/cloudflare-pages/intelligence/contracts/continuous-adaptive-route-replenishment-contracts.json")),
    governedRuntimeScopeModule: read(root, "intelligence/route-iq-governed-runtime-scope.mjs")
      .equals(read(root, "deploy/cloudflare-pages/intelligence/route-iq-governed-runtime-scope.mjs"))
  };
  assert.deepEqual(
    intelligenceGeneratedAssetParity,
    contract.sourceObservations.intelligenceGeneratedAssetParity,
    "Intelligence generated-asset parity observation drifted."
  );

  const finalPrerequisites = contract.sourceObservations.observationState === "FINAL_EXACT_CANDIDATE";
  assert.equal(requirementById(matrix, "authoritative_readiness_governance").status, "VERIFIED");
  if (!finalPrerequisites) {
    for (const requirement of matrix.requirements) {
      if (requirement.id === "authoritative_readiness_governance") continue;
      assert.notEqual(
        requirement.status,
        "VERIFIED",
        `Nonfinal shared-worktree evidence cannot verify ${requirement.id}.`
      );
    }
  } else {
    assert.equal(dashboardParity, true);
    assert.deepEqual(betaFindings, []);
    assert.equal(runtimeWired, true);
    for (const id of [
      "default_off_activation_envelope",
      "bounded_company_user_limits",
      "customer_runtime_integration",
      "cruz_only_prelaunch_acceptance",
      "no_external_human_testers",
      "anthony_unmapped",
      "collection_cohorts_recommendation_off",
      "one_generic_customer_pwa",
      "authentication_and_role_enforcement",
      "tenant_company_user_isolation",
      "route_workflow_collection_off",
      "production_not_beta_language",
      "crm_durability_and_notification_order",
      "legal_privacy_terms_contact",
      "named_user_provisioning",
      "forward_rollback_readiness",
      "known_limitations_disclosure",
      "launch_day_and_post_launch_verification",
      "full_qualification_and_clean_provenance"
    ]) assert.equal(requirementById(matrix, id).status, "VERIFIED", id);
  }
  assert.equal(requirementById(matrix, "production_crm_acceptance").status, "PARTIAL");
  assert.equal(requirementById(matrix, "production_crm_acceptance").founderAttendanceRequired, true);
  assert.match(requirementById(matrix, "production_crm_acceptance").requiredWork, /Do not submit again\./u);
  assert.match(
    requirementById(matrix, "production_crm_acceptance").requiredWork,
    /riq_receipt_e74e57903a211291a9f1f37a/u
  );
  assert.equal(requirementById(matrix, "founder_acceptance_execution").status, "PENDING_FOUNDER");
  assert.equal(requirementById(matrix, "activation_and_deployment_authorization").status, "PENDING_FOUNDER");
}

function verifyRepositoryBaseline(root, contract, { requireClean }) {
  assert.equal(git(root, "rev-parse", `${STARTING_COMMIT}^{tree}`), STARTING_TREE);
  execFileSync("git", ["merge-base", "--is-ancestor", STARTING_COMMIT, "HEAD"], { cwd: root });
  assert.equal(
    git(root, "rev-parse", `${OWNER_SUCCESSOR_BASELINE.commit}^{tree}`),
    OWNER_SUCCESSOR_BASELINE.tree
  );
  execFileSync(
    "git",
    ["merge-base", "--is-ancestor", OWNER_SUCCESSOR_BASELINE.commit, "HEAD"],
    { cwd: root }
  );
  const ownerArtifactPaths = contract.artifactPins
    .filter(artifact => artifact.owner !== "Prometheus Overwatch")
    .map(artifact => artifact.path);
  const trackedOwnerArtifacts = ownerArtifactPaths.every(path => {
    try {
      git(root, "ls-files", "--error-unmatch", path);
      return git(root, "status", "--porcelain=v1", "--", path) === "";
    } catch {
      return false;
    }
  });
  const status = execFileSync("git", ["status", "--porcelain=v1"], {
    cwd: root,
    encoding: "utf8"
  }).trimEnd();
  if (requireClean) assert.equal(status, "", "Working tree must be clean.");
  const dirtyPaths = status.split("\n").filter(Boolean).map(line => line.slice(3));
  const onlyOverwatchSuccessorChanges = dirtyPaths.every(path => (
    path.startsWith("overwatch/")
    || path === "package.json"
    || /^scripts\/verify-overwatch-/u.test(path)
    || /^tests\/overwatch-/u.test(path)
  ));
  return {
    head: git(root, "rev-parse", "HEAD"),
    tree: git(root, "rev-parse", "HEAD^{tree}"),
    clean: status === "" || (!requireClean && onlyOverwatchSuccessorChanges),
    ownerArtifactsCommitted: trackedOwnerArtifacts
  };
}

export function verifyOverwatchRouteIqAugust1LaunchReadiness({
  root = ROOT,
  requireClean = false,
  verifyGit = true
} = {}) {
  assertRegularFile(root, AUGUST_1_READINESS_MATRIX_PATH);
  assertRegularFile(root, AUGUST_1_GOVERNANCE_REPORT_PATH);
  assertRegularFile(root, AUGUST_1_SUCCESSORS_PATH);
  const matrixBytes = read(root, AUGUST_1_READINESS_MATRIX_PATH);
  const matrix = validateAugust1ReadinessMatrix(JSON.parse(matrixBytes.toString("utf8")));
  const contract = validateAugust1GovernanceReport(
    readJson(root, AUGUST_1_GOVERNANCE_REPORT_PATH),
    matrix
  );
  const successors = validateAugust1ReadinessSuccessors(
    readJson(root, AUGUST_1_SUCCESSORS_PATH)
  );
  assert.equal(sha256(matrixBytes), contract.matrix.sha256, "Readiness matrix hash drifted.");
  if (verifyGit) verifySuccessorOwnerChain(root, successors);
  verifyArtifactPins(root, contract, successors);
  verifyFixedOwnerEvidence(root, matrix, contract);
  const repository = verifyGit ? verifyRepositoryBaseline(root, contract, { requireClean }) : null;
  if (repository) {
    assert.equal(
      repository.ownerArtifactsCommitted,
      contract.sourceObservations.ownerArtifactsCommitted,
      "Owner-artifact commit observation drifted."
    );
    assert.equal(
      repository.clean,
      contract.sourceObservations.workingTreeClean,
      "Working-tree observation drifted."
    );
  }
  const counts = readinessCounts(matrix);
  return Object.freeze({
    verificationStatus: "PASS",
    launchStatus: FINAL_BLOCKED_STATUS,
    matrixId: matrix.matrixId,
    contractId: contract.contractId,
    readinessPercent: counts.readinessPercent,
    totalRequirements: counts.total,
    verifiedRequirements: counts.verified,
    launchBlockerIds: Object.freeze(counts.blockerIds),
    founderAttendanceRequirementIds: Object.freeze(counts.founderAttendanceIds),
    fixedLaunchContract: Object.freeze({ ...contract.fixedLaunchContract }),
    repository,
    externalActionsPerformedByThisVerificationRun: false
  });
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    console.log(JSON.stringify(verifyOverwatchRouteIqAugust1LaunchReadiness(), null, 2));
  } catch (error) {
    console.error(`OVERWATCH_AUGUST_1_READINESS_FAILED: ${error.message}`);
    process.exitCode = 1;
  }
}
