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
export const AUGUST_1_DASHBOARD_VISUAL_SUCCESSOR_PATH =
  "overwatch/governance/route-iq-august-1-dashboard-visual-readiness-successor-v1.json";
export const AUGUST_1_DASHBOARD_VISUAL_VERIFIER_SUCCESSOR_PATH =
  "overwatch/governance/route-iq-august-1-dashboard-visual-verifier-successor-v1.json";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PRIVATE_SESSION_REPAIR_BRANCH = "codex/private-session-v2-compatibility-repair";
const PRIVATE_SESSION_REPAIR_BASE = "c7119fcee140ab8a130cdb888439277fdcbeb6b0";
const PRIVATE_SESSION_REPAIR_PRESERVED_DIFF_SHA256 =
  "7bb1d11d90ff4c6916ecc6bfec5f4078aac18ee54c6b5b62248e6c9068f28740";
const PRIVATE_SESSION_REPAIR_PRESERVED_PATHS = Object.freeze([
  "data/route-iq-commercial-readiness-v1/route-iq-august-1-launch-envelope.mjs",
  "overwatch/governance/route-iq-governed-multi-session-learning-dashboard-advisory-bridge-v1.json",
  "scripts/verify-dashboard-runtime-workflows.mjs",
  "tests/dashboard-route-iq-customer-pwa.test.mjs",
  "tests/route-iq-august-1-customer-pwa-infrastructure.test.mjs",
  "tests/route-iq-august-1-launch-envelope.test.mjs",
  "tests/route-iq-multi-company-runtime-infrastructure.test.mjs",
  "workers/infrastructure/route-iq-august-1-customer-pwa-runtime-v1.json",
  "workers/infrastructure/route-iq-august-1-customer-pwa-runtime.js"
].sort());
const PRIVATE_SESSION_REPAIR_PATHS = Object.freeze([
  ...PRIVATE_SESSION_REPAIR_PRESERVED_PATHS,
  AUGUST_1_SUCCESSORS_PATH,
  "package.json",
  "scripts/verify-overwatch-route-iq-august-1-launch-readiness.mjs",
  "scripts/verify-overwatch-route-iq-cloudflare-toolchain-requalification.mjs",
  "scripts/verify-overwatch-route-iq-governed-multi-session-learning-dashboard-advisory-bridge-v1.mjs",
  "scripts/verify-overwatch-route-iq-retention-deletion-runtime.mjs",
  "scripts/verify-overwatch-route-iq-retention-maintenance-deployment-readiness.mjs",
  "tests/overwatch-route-iq-august-1-launch-readiness.test.mjs",
  "tests/overwatch-route-iq-3d-visual-continuity.test.mjs",
  "tests/overwatch-route-iq-cloudflare-toolchain-requalification.test.mjs",
  "tests/overwatch-route-iq-retention-deletion-runtime.test.mjs",
  "tests/overwatch-route-iq-retention-maintenance-deployment-readiness.test.mjs"
].sort());
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

function gitBytes(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: null,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0"
    },
    maxBuffer: 8 * 1024 * 1024,
    timeout: 30_000
  });
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

export function validateAugust1ReadinessSuccessors(successors, {
  root = ROOT,
  additionalCurrentEvidence
} = {}) {
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
  assert.equal(successors.successors.length, 26);
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
      "bbed83c62e6c8d2c73ce287161df282005f99187",
      "da7504352424096869a18b66dc7c4429480393f4",
      "53d080494c7377789b697d8bcc47fd0e8958b722",
      "267225d51e32acc6f50ce932a945e2749783734e",
      "ab4940262d2eb843b2f8bf6f451e881cedf91cf9",
      "530808f3a730f76be8fc78e6bfa2f8b753741182",
      "e38bfef992d491eb9d52a1b63518cace6e9a41c5",
      "c42576db4330e2ba42373df247e6a6c65172ff55",
      "15f1d58d4d0fcf689d2ead9591a6f3c4a6598bac",
      "07377e7a115cb86e3671787ac89350c78cede46a",
      "fa3a416891e3f964e2085dc44bcd779a4a48de15",
      "e1248a556f5683763e8aeda15903e16fb9aa33e3",
      "1fbfc42eadc1bad486f92bcf0b8bd93a7d0236fd",
      "6c4f452723c831b1a2e3e1574eeff713fcde6682"
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
  const cloudflareToolchainSuccessor = successors.successors[13];
  assert.equal(cloudflareToolchainSuccessor.commit,
    "da7504352424096869a18b66dc7c4429480393f4");
  assert.equal(cloudflareToolchainSuccessor.tree,
    "9ecb94b795d612a34a84c7ba7871296872d9184a");
  assert.equal(cloudflareToolchainSuccessor.owner,
    "Prometheus Infrastructure <infrastructure@prometheus.local>");
  assert.deepEqual(cloudflareToolchainSuccessor.evidence, [{
    path: "tests/route-iq-request-crm-infrastructure.test.mjs",
    previousSha256: "08893abf7fa594159ee8e6347258dcb7fd11cee2c014f538fe3f4a80a5eda739",
    successorSha256: "1bfa49016643bfb7c81f3e10a3f543f6790a5e9cb6c571716883bca58ea29520"
  }]);
  const governedLearningDashboardSuccessor = successors.successors[14];
  assert.deepEqual(governedLearningDashboardSuccessor.evidence, [{
    path: "index.html",
    previousSha256: "235be31ca523e7ba0d008de040fde8c32a4a8871c307eacb6a5273dd3646fa72",
    successorSha256: "4d85ef879dda14887e4cc85872e1b9c46bbc1479881ee296f6a78940f080410c"
  }]);
  const governedLearningInfrastructureSuccessor = successors.successors[15];
  assert.deepEqual(governedLearningInfrastructureSuccessor.evidence, [
    {
      path: "_headers",
      previousSha256: "2be69aefc6de11fd91620e8f9c253fbd37f5561fa28527b551ae0c593cd645a4",
      successorSha256: "c221ea26b32e5087a10accc1db1a0a941f3ad4517c472b95ca96461e60948667"
    },
    {
      path: "deploy/cloudflare-pages/_headers",
      previousSha256: "2be69aefc6de11fd91620e8f9c253fbd37f5561fa28527b551ae0c593cd645a4",
      successorSha256: "c221ea26b32e5087a10accc1db1a0a941f3ad4517c472b95ca96461e60948667"
    },
    {
      path: "deploy/cloudflare-pages/index.html",
      previousSha256: "235be31ca523e7ba0d008de040fde8c32a4a8871c307eacb6a5273dd3646fa72",
      successorSha256: "b450ce99d5e416677451ace590c276b74723ac64b578a00f01be13c93951e604"
    },
    {
      path: "index.html",
      previousSha256: "4d85ef879dda14887e4cc85872e1b9c46bbc1479881ee296f6a78940f080410c",
      successorSha256: "b450ce99d5e416677451ace590c276b74723ac64b578a00f01be13c93951e604"
    },
    {
      path: "workers/prometheus-iq-worker.js",
      previousSha256: "95eeefa91c1d27f9a3dca1e60c377f8f860d0eb1125d6d915279f82187095051",
      successorSha256: "b5a5d26229d6d0808bb41a08fd2b252021df1d5cdfa9e44cda539819fc728b9a"
    }
  ]);
  const governedLearningHarnessSuccessor = successors.successors[16];
  assert.deepEqual(governedLearningHarnessSuccessor.evidence, [{
    path: "scripts/verify-dashboard-runtime-workflows.mjs",
    previousSha256: "f15bef69f0bffc9104b64f71fd7328df3da4f711d73270226ff67e259789bb9c",
    successorSha256: "c014d74ad3ab6f81befdf4880cdc0093fa9f8688e2dc90b3ab3f4cbcbfafb6d4"
  }]);
  assert.deepEqual(successors.successors[17], {
    commit: "530808f3a730f76be8fc78e6bfa2f8b753741182",
    tree: "80801bdcab87aa8d7504b655d725dd46c25dfe34",
    owner: "Prometheus CRM <crm@prometheus.local>",
    reason: "The CRM owner adds the versioned gym-intake contract to the existing durable request system while preserving receipt identity, Founder-only retrieval, and notification-after-persistence controls.",
    evidence: [{
      path: "crm/route-iq-request-crm.mjs",
      previousSha256: "3a240899a2e9ad7e736937b1ad00e6fe240527e44676c52ebae59cca7135aef2",
      successorSha256: "05ff3a54c94b561b12b539671032fa0dc66dca2dc62e45b01eadf8ae91981e0a"
    }]
  });
  assert.deepEqual(successors.successors[18], {
    commit: "e38bfef992d491eb9d52a1b63518cace6e9a41c5",
    tree: "1262a0b55c5b487c86c4468bfe66944f04d36c85",
    owner: "Prometheus Infrastructure <infrastructure@prometheus.local>",
    reason: "Infrastructure introduces the isolated synthetic preview sink and composes the gym contract into existing CRM runtime verification without granting production storage, email, or binding access.",
    evidence: [
      {
        path: "tests/route-iq-request-crm-infrastructure.test.mjs",
        previousSha256: "1bfa49016643bfb7c81f3e10a3f543f6790a5e9cb6c571716883bca58ea29520",
        successorSha256: "df5f9165487944601de579dd4167aa52288517c9bf551f5c92e9d24b4acb2288"
      },
      {
        path: "workers/infrastructure/route-iq-request-crm-runtime-v1.json",
        previousSha256: "2698f79b8714b6f10611afa54731c6ce31a356293dd5b79f7fd56567f639d068",
        successorSha256: "53a7ef488244528457fe2c28186c54ff2f1f6517eac8d3d047eba00f09a7e418"
      },
      {
        path: "workers/infrastructure/route-iq-request-crm-runtime.js",
        previousSha256: "0e85ad567529ea2d747dcc07352f7459801ca9058831e5630896ad94df081dcf",
        successorSha256: "31f6887ba2e2eaa4c30ebed568049b13fed7968f264aa36969f8a97f7ae8458f"
      }
    ]
  });
  assert.deepEqual(successors.successors[19], {
    commit: "c42576db4330e2ba42373df247e6a6c65172ff55",
    tree: "b19db314b3b4a1de582d01fdc31494466bb6d082",
    owner: "Prometheus Website <website@prometheus.local>",
    reason: "The Website owner adds the gym-first dual-track public source and regression coverage while preserving the existing investor experience and keeping production deployment separately gated.",
    evidence: [{
      path: "tests/website-route-iq-product-focus.test.mjs",
      previousSha256: "a517f51c87f9e9f1f63469acd65c5c25ba839f2b19745d0fe3e636749642b257",
      successorSha256: "4132d701b7f7b9a0df3dfc0f76fbc13f6165fabf8615af7d3963f939c5473c82"
    }]
  });
  assert.deepEqual(successors.successors[20], {
    commit: "15f1d58d4d0fcf689d2ead9591a6f3c4a6598bac",
    tree: "8f65b4d1b703c0b95e79edf4c4d82c9b540181dd",
    owner: "Prometheus Infrastructure <infrastructure@prometheus.local>",
    reason: "Infrastructure regenerates the public deployment and forward-rollback evidence for the new source candidate while preserving production identity and withholding all production deployment authority.",
    evidence: [{
      path: "workers/infrastructure/route-iq-public-forward-rollback-v1.json",
      previousSha256: "4477ddff8777d95e74023a09f2e9a7895060e1d290eeb5d9b2557ca620d827c7",
      successorSha256: "9fdd92e4ba6313ef992858ea6c377e18854005d6b18f868c6fa956da99fbe5ca"
    }]
  });
  assert.ok(Array.isArray(successors.overwatchCurrentEvidence));
  const currentEvidenceByPath = new Map();
  const allowedCurrentEvidencePaths = new Set([
    "data/route-iq-commercial-readiness-v1/route-iq-august-1-launch-envelope.mjs",
    "package.json",
    "scripts/verify-dashboard-runtime-workflows.mjs",
    "scripts/verify-overwatch-route-iq-august-1-launch-readiness.mjs",
    "scripts/verify-overwatch-route-iq-cloudflare-toolchain-requalification.mjs",
    "scripts/verify-overwatch-route-iq-governed-multi-session-learning-dashboard-advisory-bridge-v1.mjs",
    "scripts/verify-overwatch-route-iq-retention-deletion-runtime.mjs",
    "tests/overwatch-route-iq-august-1-launch-readiness.test.mjs",
    "tests/overwatch-route-iq-retention-deletion-runtime.test.mjs",
    "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
    "tests/dashboard-route-iq-customer-pwa.test.mjs",
    "tests/overwatch-public-deployment-workflow-v2.test.mjs",
    "tests/route-iq-august-1-customer-pwa-infrastructure.test.mjs",
    "tests/route-iq-august-1-launch-envelope.test.mjs",
    "workers/infrastructure/route-iq-august-1-customer-pwa-runtime-v1.json",
    "workers/infrastructure/route-iq-august-1-customer-pwa-runtime.js"
  ]);
  for (const item of successors.overwatchCurrentEvidence) {
    assert.equal(allowedCurrentEvidencePaths.has(item.path), true,
      `Unexpected current successor evidence path: ${item.path}`);
    assert.match(item.previousSha256, /^[a-f0-9]{64}$/u);
    assert.match(item.successorSha256, /^[a-f0-9]{64}$/u);
    assert.notEqual(item.previousSha256, item.successorSha256);
    const entries = currentEvidenceByPath.get(item.path) ?? [];
    entries.push(item);
    currentEvidenceByPath.set(item.path, entries);
  }
  const currentVisualEvidence = additionalCurrentEvidence ?? [
    ...dashboardVisualEvidence(
      readJson(root, AUGUST_1_DASHBOARD_VISUAL_SUCCESSOR_PATH)
    ),
    ...dashboardVisualVerifierEvidence(
      readJson(root, AUGUST_1_DASHBOARD_VISUAL_VERIFIER_SUCCESSOR_PATH)
    )
  ];
  for (const item of currentVisualEvidence.filter(entry => (
    allowedCurrentEvidencePaths.has(entry.path)
  ))) {
    const entries = currentEvidenceByPath.get(item.path) ?? [];
    entries.push(item);
    currentEvidenceByPath.set(item.path, entries);
  }
  assert.deepEqual(
    sorted([...currentEvidenceByPath.keys()]),
    sorted([...allowedCurrentEvidencePaths])
  );
  for (const [path, evidence] of currentEvidenceByPath) {
    const terminalSha256 = assertLinearSuccessorChain(evidence, path);
    assertRegularFile(root, path);
    assert.equal(
      terminalSha256,
      sha256(read(root, path)),
      `Current successor terminal drifted: ${path}`
    );
  }
  return successors;
}

function dashboardVisualEvidence(successor) {
  assert.ok(Array.isArray(successor?.ownerCommits));
  return successor.ownerCommits.flatMap(owner => owner.evidence || []);
}

function dashboardVisualVerifierEvidence(successor) {
  assert.ok(Array.isArray(successor?.ownerCommits));
  return successor.ownerCommits.flatMap(owner => owner.evidence || []);
}

function currentReadinessEvidence(root) {
  const successors = readJson(root, AUGUST_1_SUCCESSORS_PATH);
  return [
    ...successors.successors.flatMap(successor => successor.evidence || []),
    ...successors.overwatchCurrentEvidence
  ];
}

function appendCurrentContinuations(baseEvidence, availableEvidence, path) {
  const continuations = [];
  let terminalSha256 = assertLinearSuccessorChain(baseEvidence, path);
  while (true) {
    const candidates = availableEvidence.filter(item => (
      item.path === path && item.previousSha256 === terminalSha256
    ));
    assert.ok(candidates.length <= 1, `Current successor evidence branches: ${path}`);
    if (candidates.length === 0) break;
    continuations.push(candidates[0]);
    terminalSha256 = candidates[0].successorSha256;
  }
  return [...baseEvidence, ...continuations];
}

export function validateAugust1DashboardVisualVerifierSuccessor(successor, {
  root = ROOT,
  verifyGit = false
} = {}) {
  assertExactObjectKeys(successor, [
    "batchId", "directive", "ownerCommits", "ownerSubsystem", "predecessors",
    "protectedState", "status", "version"
  ], "August 1 Dashboard visual verifier successor");
  assert.equal(successor.version,
    "route-iq-august-1-dashboard-visual-verifier-successor-v1");
  assert.equal(successor.batchId, "BATCH-20260815-001");
  assert.equal(successor.status, "INDEPENDENTLY_VERIFIED_VERIFIER_SUCCESSOR");
  assert.equal(successor.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(successor.predecessors.length, 2);
  for (const predecessor of successor.predecessors) {
    assertExactObjectKeys(predecessor,
      ["path", "remainsHistorical", "rewritten", "sha256"],
      "Dashboard visual verifier predecessor");
    assert.equal(predecessor.remainsHistorical, true);
    assert.equal(predecessor.rewritten, false);
    assert.equal(
      sha256(read(root, predecessor.path)),
      predecessor.sha256,
      `Dashboard visual verifier predecessor drifted: ${predecessor.path}`
    );
  }
  assert.equal(successor.ownerCommits.length, 4);
  const evidence = [];
  const paths = new Set();
  for (const owner of successor.ownerCommits) {
    assertExactObjectKeys(owner,
      ["commit", "evidence", "identity", "parent", "subject", "tree"],
      "Dashboard visual verifier owner commit");
    assert.match(owner.commit, /^[a-f0-9]{40}$/u);
    assert.match(owner.parent, /^[a-f0-9]{40}$/u);
    assert.match(owner.tree, /^[a-f0-9]{40}$/u);
    assert.equal(owner.identity, "Prometheus Overwatch <overwatch@prometheus.local>");
    assert.ok(typeof owner.subject === "string" && owner.subject.length > 0);
    if (verifyGit) {
      assert.deepEqual(git(
        root,
        "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
        owner.commit
      ).split("\n"), [
        owner.commit,
        owner.parent,
        owner.tree,
        owner.identity,
        owner.identity,
        owner.subject
      ]);
      const changedPaths = git(
        root,
        "diff-tree", "--no-commit-id", "--name-only", "-r", owner.commit
      ).split("\n").filter(Boolean).sort();
      assert.deepEqual(changedPaths, owner.evidence.map(item => item.path).sort());
      git(root, "merge-base", "--is-ancestor", owner.commit, "HEAD");
    }
    for (const item of owner.evidence) {
      assertExactObjectKeys(item,
        ["path", "previousSha256", "successorSha256"],
        "Dashboard visual verifier artifact evidence");
      paths.add(item.path);
      assert.match(item.previousSha256, /^[a-f0-9]{64}$/u);
      assert.match(item.successorSha256, /^[a-f0-9]{64}$/u);
      assert.notEqual(item.previousSha256, item.successorSha256);
      if (verifyGit) {
        assert.equal(
          sha256(gitBytes(root, "show", `${owner.parent}:${item.path}`)),
          item.previousSha256
        );
        assert.equal(
          sha256(gitBytes(root, "show", `${owner.commit}:${item.path}`)),
          item.successorSha256
        );
      }
      assertRegularFile(root, item.path);
      evidence.push(item);
    }
  }
  assert.deepEqual(sorted([...paths]), sorted([
    "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
    "scripts/verify-overwatch-route-iq-august-1-launch-readiness.mjs",
    "scripts/verify-overwatch-route-iq-prospective-calibration-production-admission-future-window-readiness-v1.mjs",
    "scripts/verify-release-provenance-repair.mjs",
    "tests/overwatch-public-deployment-workflow-v2.test.mjs",
    "tests/overwatch-route-iq-august-1-launch-readiness.test.mjs",
    "tests/release-provenance-repair.test.mjs"
  ]));
  for (const path of paths) {
    const terminalSha256 = assertLinearSuccessorChain(appendCurrentContinuations(
      evidence.filter(item => item.path === path),
      currentReadinessEvidence(root),
      path
    ), path);
    assert.equal(sha256(read(root, path)), terminalSha256,
      `Dashboard visual verifier successor drifted: ${path}`);
  }
  assert.deepEqual(successor.protectedState, {
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    productionDeployments: 0,
    productionDataMutations: 0
  });
  return Object.freeze({ successor, evidence: Object.freeze(evidence) });
}

export function validateAugust1DashboardVisualSuccessor(successor, {
  root = ROOT,
  verifyGit = false
} = {}) {
  assertExactObjectKeys(successor, [
    "batchId", "ownerCommits", "ownerSubsystem", "predecessor", "protectedState",
    "status", "version"
  ], "August 1 Dashboard visual successor");
  assert.equal(successor.version,
    "route-iq-august-1-dashboard-visual-readiness-successor-v1");
  assert.equal(successor.batchId, "BATCH-20260815-001");
  assert.equal(successor.status, "INDEPENDENTLY_VERIFIED_ARTIFACT_SUCCESSOR");
  assert.equal(successor.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(successor.predecessor.remainsHistorical, true);
  assert.equal(successor.predecessor.rewritten, false);
  assert.equal(
    sha256(read(root, successor.predecessor.path)),
    successor.predecessor.sha256,
    "Dashboard visual predecessor drifted"
  );
  assert.equal(successor.ownerCommits.length, 5);
  const verifierEvidence = dashboardVisualVerifierEvidence(
    readJson(root, AUGUST_1_DASHBOARD_VISUAL_VERIFIER_SUCCESSOR_PATH)
  );
  const evidence = [];
  const paths = new Set();
  for (const owner of successor.ownerCommits) {
    assertExactObjectKeys(owner,
      ["commit", "evidence", "identity", "subject", "tree"],
      "Dashboard visual owner commit");
    assert.match(owner.commit, /^[a-f0-9]{40}$/u);
    assert.match(owner.tree, /^[a-f0-9]{40}$/u);
    assert.match(owner.identity, /^Prometheus .+ <[^>]+@prometheus\.local>$/u);
    assert.ok(typeof owner.subject === "string" && owner.subject.length > 0);
    if (verifyGit) {
      assert.equal(git(root, "rev-parse", `${owner.commit}^{tree}`), owner.tree);
      assert.equal(git(root, "show", "-s", "--format=%an <%ae>", owner.commit),
        owner.identity);
      assert.equal(git(root, "show", "-s", "--format=%s", owner.commit), owner.subject);
      git(root, "merge-base", "--is-ancestor", owner.commit, "HEAD");
    }
    for (const item of owner.evidence) {
      assertExactObjectKeys(item,
        ["path", "previousSha256", "successorSha256"],
        "Dashboard visual artifact evidence");
      assert.equal(paths.has(item.path), false, `Duplicate Dashboard visual path: ${item.path}`);
      paths.add(item.path);
      assert.match(item.previousSha256, /^[a-f0-9]{64}$/u);
      assert.match(item.successorSha256, /^[a-f0-9]{64}$/u);
      assert.notEqual(item.previousSha256, item.successorSha256);
      assertRegularFile(root, item.path);
      const terminalSha256 = assertLinearSuccessorChain(appendCurrentContinuations([
        item,
        ...verifierEvidence.filter(entry => entry.path === item.path)
      ], currentReadinessEvidence(root), item.path), item.path);
      assert.equal(sha256(read(root, item.path)), terminalSha256,
        `Dashboard visual successor drifted: ${item.path}`);
      evidence.push(item);
    }
  }
  assert.deepEqual(sorted([...paths]), sorted([
    "deploy/cloudflare-pages/index.html",
    "deploy/cloudflare-pages/manifest-founder.webmanifest",
    "deploy/cloudflare-pages/manifest.webmanifest",
    "index.html",
    "manifest-founder.webmanifest",
    "manifest.webmanifest",
    "scripts/verify-overwatch-route-iq-august-1-launch-readiness.mjs",
    "tests/dashboard-route-iq-product-focus.test.mjs",
    "tests/overwatch-route-iq-august-1-launch-readiness.test.mjs",
    "tests/website-route-iq-product-focus.test.mjs",
    "workers/infrastructure/route-iq-public-forward-rollback-v1.json"
  ]));
  assert.deepEqual(successor.protectedState, {
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    productionDeployments: 0,
    productionDataMutations: 0
  });
  return Object.freeze({ successor, evidence: Object.freeze(evidence) });
}

function successorEvidenceMap(successors, additionalEvidence = []) {
  const evidenceByPath = new Map();
  for (const item of [
    ...successors.successors.flatMap(successor => successor.evidence),
    ...successors.overwatchCurrentEvidence,
    ...additionalEvidence
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

function assertLinearSuccessorChain(evidence, path) {
  assert.ok(evidence.length > 0, `Successor evidence is empty: ${path}`);
  const byPrevious = new Map(evidence.map(item => [item.previousSha256, item]));
  const successors = new Set(evidence.map(item => item.successorSha256));
  assert.equal(byPrevious.size, evidence.length, `Successor evidence branches: ${path}`);
  assert.equal(successors.size, evidence.length, `Successor evidence merges: ${path}`);
  const starts = [...byPrevious.keys()].filter(hash => !successors.has(hash));
  const ends = [...successors].filter(hash => !byPrevious.has(hash));
  assert.equal(starts.length, 1, `Successor evidence has no unique start: ${path}`);
  assert.equal(ends.length, 1, `Successor evidence has no unique end: ${path}`);
  const visited = new Set();
  let current = starts[0];
  while (byPrevious.has(current)) {
    assert.equal(visited.has(current), false, `Successor evidence cycles: ${path}`);
    visited.add(current);
    current = byPrevious.get(current).successorSha256;
  }
  assert.equal(current, ends[0], `Successor evidence terminates incorrectly: ${path}`);
  assert.equal(visited.size, evidence.length, `Successor evidence is disconnected: ${path}`);
  return ends[0];
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

function verifyArtifactPins(root, contract, successors, additionalEvidence) {
  const accepted = successorEvidenceMap(successors, additionalEvidence);
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

function isExactPrivateSessionRepairCheckout(root) {
  try {
    const branch = git(root, "branch", "--show-current");
    const head = git(root, "rev-parse", "HEAD");
    const originMain = git(root, "rev-parse", "refs/remotes/origin/main");
    if (branch !== PRIVATE_SESSION_REPAIR_BRANCH
      || originMain !== PRIVATE_SESSION_REPAIR_BASE
      || git(root, "merge-base", head, originMain) !== originMain
      || git(root, "rev-list", "--merges", `${originMain}..${head}`)) {
      return false;
    }
    const statusLines = git(root, "status", "--porcelain=v1", "--untracked-files=all")
      .split("\n").filter(Boolean);
    if (statusLines.some(line => line.startsWith("?? "))) return false;
    const changedPaths = git(root, "diff", "--name-only", originMain, "--")
      .split("\n").filter(Boolean).sort();
    if (changedPaths.length !== PRIVATE_SESSION_REPAIR_PATHS.length
      || changedPaths.some((path, index) => path !== PRIVATE_SESSION_REPAIR_PATHS[index])) {
      return false;
    }
    const preservedDiff = gitBytes(
      root,
      "diff",
      "--binary",
      originMain,
      "--",
      ...PRIVATE_SESSION_REPAIR_PRESERVED_PATHS
    );
    return sha256(preservedDiff) === PRIVATE_SESSION_REPAIR_PRESERVED_DIFF_SHA256;
  } catch {
    return false;
  }
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
  const exactPrivateSessionRepair = isExactPrivateSessionRepairCheckout(root);
  return {
    head: git(root, "rev-parse", "HEAD"),
    tree: git(root, "rev-parse", "HEAD^{tree}"),
    clean: status === "" || (!requireClean && onlyOverwatchSuccessorChanges),
    ownerArtifactsCommitted: trackedOwnerArtifacts,
    exactPrivateSessionRepair,
    onlyOverwatchSuccessorChanges,
    uncommittedChanges: status !== ""
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
  assertRegularFile(root, AUGUST_1_DASHBOARD_VISUAL_SUCCESSOR_PATH);
  assertRegularFile(root, AUGUST_1_DASHBOARD_VISUAL_VERIFIER_SUCCESSOR_PATH);
  const matrixBytes = read(root, AUGUST_1_READINESS_MATRIX_PATH);
  const matrix = validateAugust1ReadinessMatrix(JSON.parse(matrixBytes.toString("utf8")));
  const contract = validateAugust1GovernanceReport(
    readJson(root, AUGUST_1_GOVERNANCE_REPORT_PATH),
    matrix
  );
  const dashboardVisualRecord = readJson(root, AUGUST_1_DASHBOARD_VISUAL_SUCCESSOR_PATH);
  const dashboardVisualVerifierRecord = readJson(
    root,
    AUGUST_1_DASHBOARD_VISUAL_VERIFIER_SUCCESSOR_PATH
  );
  const dashboardVisualArtifactEvidence = [
    ...dashboardVisualEvidence(dashboardVisualRecord),
    ...dashboardVisualVerifierEvidence(dashboardVisualVerifierRecord)
  ];
  const successors = validateAugust1ReadinessSuccessors(
    readJson(root, AUGUST_1_SUCCESSORS_PATH),
    { root, additionalCurrentEvidence: dashboardVisualArtifactEvidence }
  );
  assert.equal(sha256(matrixBytes), contract.matrix.sha256, "Readiness matrix hash drifted.");
  if (verifyGit) verifySuccessorOwnerChain(root, successors);
  verifyArtifactPins(root, contract, successors, dashboardVisualArtifactEvidence);
  const dashboardVisualSuccessor = validateAugust1DashboardVisualSuccessor(
    dashboardVisualRecord,
    { root, verifyGit }
  );
  const dashboardVisualVerifierSuccessor =
    validateAugust1DashboardVisualVerifierSuccessor(
      dashboardVisualVerifierRecord,
      { root, verifyGit }
    );
  verifyFixedOwnerEvidence(root, matrix, contract);
  const repository = verifyGit ? verifyRepositoryBaseline(root, contract, { requireClean }) : null;
  if (repository) {
    if (repository.exactPrivateSessionRepair && repository.uncommittedChanges) {
      if (repository.ownerArtifactsCommitted) {
        assert.equal(repository.onlyOverwatchSuccessorChanges, true,
          "After owner commits, only the bounded Overwatch successor may remain uncommitted.");
        assert.equal(repository.clean, true,
          "A bounded Overwatch successor must preserve the historical readiness observation.");
      } else {
        assert.equal(repository.clean, false,
          "The pre-commit private-session repair must not be reported as a clean checkout.");
      }
    } else {
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
    dashboardVisualSuccessorBatchId: dashboardVisualSuccessor.successor.batchId,
    dashboardVisualVerifierSuccessorBatchId:
      dashboardVisualVerifierSuccessor.successor.batchId,
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
