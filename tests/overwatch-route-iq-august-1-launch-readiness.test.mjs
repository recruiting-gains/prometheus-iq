import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  AUGUST_1_GOVERNANCE_REPORT_PATH,
  AUGUST_1_READINESS_MATRIX_PATH,
  validateAugust1GovernanceReport,
  validateAugust1ReadinessMatrix,
  verifyOverwatchRouteIqAugust1LaunchReadiness
} from "../scripts/verify-overwatch-route-iq-august-1-launch-readiness.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const RECEIPT = "riq_receipt_e74e57903a211291a9f1f37a";
const clone = value => JSON.parse(JSON.stringify(value));
const sha256 = value => createHash("sha256").update(value).digest("hex");

function readJson(root, path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function writeJson(root, path, value) {
  writeFileSync(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function packageSource() {
  const matrix = readJson(ROOT, AUGUST_1_READINESS_MATRIX_PATH);
  const contract = readJson(ROOT, AUGUST_1_GOVERNANCE_REPORT_PATH);
  return { matrix, contract };
}

function createPackageFixture(t) {
  const fixture = mkdtempSync(resolve(tmpdir(), "route-iq-august-1-overwatch-"));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const { contract } = packageSource();
  const paths = new Set([
    AUGUST_1_READINESS_MATRIX_PATH,
    AUGUST_1_GOVERNANCE_REPORT_PATH,
    ...contract.artifactPins.map(artifact => artifact.path)
  ]);
  for (const path of paths) {
    const target = resolve(fixture, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(resolve(ROOT, path), target);
  }
  return fixture;
}

function rewriteMatrixAndPin(root, mutate) {
  const matrix = readJson(root, AUGUST_1_READINESS_MATRIX_PATH);
  mutate(matrix);
  writeJson(root, AUGUST_1_READINESS_MATRIX_PATH, matrix);
  const contract = readJson(root, AUGUST_1_GOVERNANCE_REPORT_PATH);
  contract.matrix.sha256 = sha256(readFileSync(resolve(root, AUGUST_1_READINESS_MATRIX_PATH)));
  writeJson(root, AUGUST_1_GOVERNANCE_REPORT_PATH, contract);
}

test("authoritative August 1 package passes while launch remains fail-closed", () => {
  const result = verifyOverwatchRouteIqAugust1LaunchReadiness({ root: ROOT, verifyGit: false });
  assert.equal(result.verificationStatus, "PASS");
  assert.equal(result.launchStatus, "AUGUST_1_LAUNCH_BLOCKED");
  assert.equal(result.totalRequirements, 26);
  assert.equal(result.verifiedRequirements, 1);
  assert.equal(result.readinessPercent, 3.8);
  assert.deepEqual(result.fixedLaunchContract, {
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
});

test("production CRM acceptance records one submission and forbids a second", () => {
  const { matrix, contract } = packageSource();
  const requirement = matrix.requirements.find(item => item.id === "production_crm_acceptance");
  assert.equal(requirement.status, "PARTIAL");
  assert.equal(requirement.launchBlocking, true);
  assert.equal(requirement.founderAttendanceRequired, true);
  assert.match(requirement.requiredWork, /Do not submit again\./u);
  assert.match(requirement.requiredWork, new RegExp(RECEIPT, "u"));
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
    receipt: RECEIPT,
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
  assert.equal(contract.authority.recordsPriorAuthorizedProductionMutation, true);
  assert.equal(contract.authority.productionMutationAuthorizedByThisPackage, false);
});

test("local integration evidence remains nonfinal until every qualification prerequisite closes", () => {
  const { matrix, contract } = packageSource();
  for (const id of [
    "customer_runtime_integration",
    "authentication_and_role_enforcement",
    "tenant_company_user_isolation"
  ]) {
    const requirement = matrix.requirements.find(item => item.id === id);
    assert.equal(requirement.status, "PARTIAL", id);
    assert.equal(requirement.launchBlocking, true, id);
  }
  assert.deepEqual(contract.sourceObservations.ownerFocusedTests, {
    command: "node --test tests/route-iq-august-1-launch-envelope.test.mjs tests/route-iq-august-1-customer-pwa-infrastructure.test.mjs tests/dashboard-route-iq-customer-pwa.test.mjs",
    total: 33,
    passed: 33,
    failed: 0,
    result: "LOCAL_PASS_NONFINAL",
    failedAssertions: []
  });
  assert.deepEqual(contract.sourceObservations.crmFocusedTests, {
    command: "node --test tests/route-iq-request-crm-infrastructure.test.mjs",
    total: 20,
    passed: 20,
    failed: 0,
    result: "LOCAL_PASS_NONFINAL"
  });
  assert.deepEqual(contract.sourceObservations.intelligenceGovernedRuntimeScopeFocusedTests, {
    command: "node --test tests/route-iq-governed-runtime-scope-intelligence.test.mjs",
    total: 5,
    passed: 5,
    failed: 0,
    result: "LOCAL_PASS_NONFINAL"
  });
  assert.deepEqual(contract.sourceObservations.intelligenceGovernedRuntimeScopeVerification, {
    command: "node scripts/verify-route-iq-governed-runtime-scope-intelligence.mjs",
    result: "LOCAL_PASS_NONFINAL"
  });
  assert.deepEqual(contract.sourceObservations.businessHoursFocusedTests, {
    command: "node --test tests/route-business-hours-eligibility.test.mjs",
    total: 16,
    passed: 16,
    failed: 0,
    result: "LOCAL_PASS_NONFINAL"
  });
  assert.deepEqual(contract.sourceObservations.businessHoursCompatibilityVerification, {
    command: "node scripts/verify-route-business-hours-eligibility.mjs",
    result: "LOCAL_FAIL_NONFINAL",
    fixedReasonCode: "SOURCE_DEPLOYMENT_PARITY_DRIFT"
  });
  assert.deepEqual(contract.sourceObservations.replenishmentFocusedTests, {
    command: "node --test tests/continuous-adaptive-route-replenishment.test.mjs",
    total: 10,
    passed: 10,
    failed: 0,
    result: "LOCAL_PASS_NONFINAL"
  });
  assert.deepEqual(contract.sourceObservations.replenishmentCompatibilityVerification, {
    command: "node scripts/verify-continuous-adaptive-route-replenishment.mjs",
    result: "LOCAL_FAIL_NONFINAL",
    fixedReasonCode: "SOURCE_DEPLOYMENT_PARITY_DRIFT"
  });
  assert.deepEqual(contract.sourceObservations.intelligenceGeneratedAssetParity, {
    businessHoursEligibilityModule: false,
    businessHoursGovernanceModule: true,
    businessHoursContract: false,
    continuousAdaptiveRouteReplenishmentModule: false,
    continuousAdaptiveRouteReplenishmentContract: false
  });
  assert.deepEqual(contract.sourceObservations.infrastructureFocusedTests, {
    command: "node --test tests/route-iq-august-1-customer-pwa-infrastructure.test.mjs tests/route-iq-private-forward-rollback-candidate-v2.test.mjs",
    total: 27,
    passed: 27,
    failed: 0,
    result: "LOCAL_PASS_NONFINAL"
  });
  assert.equal(contract.sourceObservations.customerPwaRuntimeWiredToPrivateWorker, true);
  assert.equal(contract.sourceObservations.productionCrmMonitoringImplementationPresent, true);
  assert.equal(contract.sourceObservations.fullQualificationComplete, false);
  assert.equal(contract.sourceObservations.allOwnerCommitsComplete, true);
  assert.equal(contract.sourceObservations.dashboardBrowserQualificationComplete, true);
  assert.equal(contract.sourceObservations.rollbackSuccessorQualificationComplete, true);
  assert.equal(contract.sourceObservations.ownerArtifactsCommitted, true);
  assert.equal(contract.sourceObservations.workingTreeClean, false);
  assert.equal(contract.sourceObservations.observationState, "NONFINAL_SHARED_WORKTREE");
  assert.deepEqual(contract.sourceObservations.dashboardRuntimeVerification, {
    command: "node scripts/verify-dashboard-runtime-workflows.mjs",
    result: "LOCAL_PASS_NONFINAL"
  });
});

test("every controlling matrix artifact is pinned exactly once with no stale rollback evidence", () => {
  const { matrix, contract } = packageSource();
  const evidencePaths = [...new Set(matrix.requirements.flatMap(requirement => (
    requirement.evidence.map(evidence => evidence.path)
  )))].sort();
  const pinPaths = contract.artifactPins.map(artifact => artifact.path).sort();
  assert.deepEqual(pinPaths, evidencePaths);
  assert.equal(pinPaths.includes("workers/infrastructure/route-iq-private-forward-rollback-candidate-v2.json"), true);
  assert.equal(pinPaths.includes("tests/route-iq-private-forward-rollback-candidate-v2.test.mjs"), true);
  assert.equal(pinPaths.includes("workers/infrastructure/route-iq-forward-rollback-candidate-v1.json"), false);
  for (const path of [
    "intelligence/route-iq-governed-runtime-scope.mjs",
    "intelligence/route-business-hours-eligibility.mjs",
    "intelligence/contracts/route-business-hours-eligibility-contracts.json",
    "intelligence/continuous-adaptive-route-replenishment.mjs",
    "intelligence/contracts/continuous-adaptive-route-replenishment-contracts.json",
    "intelligence/fixtures/route-iq-governed-customer-business-hours-v1.json",
    "scripts/verify-route-iq-governed-runtime-scope-intelligence.mjs",
    "scripts/verify-route-business-hours-eligibility.mjs",
    "scripts/verify-continuous-adaptive-route-replenishment.mjs",
    "tests/route-iq-governed-runtime-scope-intelligence.test.mjs",
    "tests/route-business-hours-eligibility.test.mjs",
    "tests/continuous-adaptive-route-replenishment.test.mjs"
  ]) assert.equal(pinPaths.includes(path), true, path);
});

test("top-level npm lifecycle wires every August 1 owner gate before the legacy suite", () => {
  const packageJson = readJson(ROOT, "package.json");
  assert.equal(
    packageJson.scripts.pretest,
    "npm run data:route-iq-august-1-launch-envelope:check && npm run infrastructure:route-iq-august-1-customer-pwa-rollback:check && npm run intelligence:route-iq-governed-runtime-scope:check && npm run overwatch:route-iq-august-1-readiness:check"
  );
  for (const name of [
    "data:route-iq-august-1-launch-envelope:check",
    "infrastructure:route-iq-august-1-customer-pwa-rollback:check",
    "intelligence:route-iq-governed-runtime-scope:check",
    "overwatch:route-iq-august-1-readiness:check"
  ]) assert.equal(typeof packageJson.scripts[name], "string", name);
});

test("missing, drifted, and symlinked required artifacts fail closed", async t => {
  await t.test("missing artifact", t => {
    const fixture = createPackageFixture(t);
    rmSync(resolve(fixture, "manifest.webmanifest"));
    assert.throws(
      () => verifyOverwatchRouteIqAugust1LaunchReadiness({ root: fixture, verifyGit: false }),
      /Required launch artifact is absent: manifest\.webmanifest/u
    );
  });

  await t.test("drifted artifact", t => {
    const fixture = createPackageFixture(t);
    const path = resolve(fixture, "docs/route-iq-production-known-limitations-v1.md");
    writeFileSync(path, `${readFileSync(path, "utf8")}drift\n`, "utf8");
    assert.throws(
      () => verifyOverwatchRouteIqAugust1LaunchReadiness({ root: fixture, verifyGit: false }),
      /Required launch artifact drifted/u
    );
  });

  await t.test("symlinked artifact", t => {
    const fixture = createPackageFixture(t);
    const path = resolve(fixture, "manifest.webmanifest");
    rmSync(path);
    symlinkSync("index.html", path);
    assert.throws(
      () => verifyOverwatchRouteIqAugust1LaunchReadiness({ root: fixture, verifyGit: false }),
      /cannot be a symlink/u
    );
  });
});

test("fixed launch boundaries cannot be softened", () => {
  const { matrix, contract } = packageSource();
  const mutations = [
    value => { value.fixedLaunchContract.prelaunchHumanAcceptanceTester = "anthony"; },
    value => { value.fixedLaunchContract.externalHumanTestersAllowed = true; },
    value => { value.fixedLaunchContract.maximumCustomerCompanies = 3; },
    value => { value.fixedLaunchContract.maximumNamedCustomerUsers = 41; },
    value => { value.fixedLaunchContract.customerPwaCount = 2; },
    value => { value.fixedLaunchContract.prospectiveCollection = "ON"; },
    value => { value.fixedLaunchContract.activeCohorts = 1; },
    value => { value.fixedLaunchContract.recommendationInfluence = "ON"; },
    value => { value.fixedLaunchContract.anthonyMapped = true; },
    value => { value.fixedLaunchContract.activationDefault = "ON"; },
    value => { value.fixedLaunchContract.productClassification = "BETA"; }
  ];
  for (const mutate of mutations) {
    const changed = clone(contract);
    mutate(changed);
    assert.throws(() => validateAugust1GovernanceReport(changed, matrix));
  }
});

test("CRM replay, retry, and premature completion claims are rejected", () => {
  const { matrix, contract } = packageSource();
  const mutations = [
    value => { value.productionCrmAcceptance.observedSubmissionAttempts = 2; },
    value => { value.productionCrmAcceptance.automaticRetryOccurred = true; },
    value => { value.productionCrmAcceptance.secondSubmissionAllowed = true; },
    value => { value.productionCrmAcceptance.receipt = "riq_receipt_replaced"; },
    value => { value.productionCrmAcceptance.postWriteReadOnlyReconciliation = "COMPLETE"; }
  ];
  for (const mutate of mutations) {
    const changed = clone(contract);
    mutate(changed);
    assert.throws(() => validateAugust1GovernanceReport(changed, matrix));
  }
});

test("historical beta evidence cannot be promoted into the controlling matrix", () => {
  const { matrix } = packageSource();
  const changed = clone(matrix);
  changed.requirements[0].evidence[0].path = "docs/pilot-support-system.md";
  assert.throws(
    () => validateAugust1ReadinessMatrix(changed),
    /Historical beta material cannot satisfy a current requirement/u
  );
});

test("status, work, blocking, and Founder-attendance fields stay internally consistent", () => {
  const { matrix } = packageSource();
  const verifiedWithWork = clone(matrix);
  verifiedWithWork.requirements.find(item => item.status === "VERIFIED").requiredWork = "More work.";
  assert.throws(
    () => validateAugust1ReadinessMatrix(verifiedWithWork),
    /Verified item cannot retain work/u
  );

  const unresolvedWithoutWork = clone(matrix);
  unresolvedWithoutWork.requirements.find(item => item.status !== "VERIFIED").requiredWork = "None.";
  assert.throws(
    () => validateAugust1ReadinessMatrix(unresolvedWithoutWork),
    /Unresolved item must state required work/u
  );

  const founderPendingWithoutAttendance = clone(matrix);
  founderPendingWithoutAttendance.requirements.find(item => item.status === "PENDING_FOUNDER")
    .founderAttendanceRequired = false;
  assert.throws(
    () => validateAugust1ReadinessMatrix(founderPendingWithoutAttendance),
    /Founder-pending item must require Founder attendance/u
  );
});

test("matrix cannot claim readiness while CRM reconciliation remains incomplete", t => {
  const fixture = createPackageFixture(t);
  rewriteMatrixAndPin(fixture, matrix => {
    const requirement = matrix.requirements.find(item => item.id === "production_crm_acceptance");
    requirement.status = "VERIFIED";
    requirement.launchBlocking = false;
    requirement.requiredWork = "None.";
    requirement.founderAttendanceRequired = false;
  });
  assert.throws(
    () => verifyOverwatchRouteIqAugust1LaunchReadiness({ root: fixture, verifyGit: false }),
    /readinessReport|production_crm_acceptance/u
  );
});

test("focused owner evidence cannot be replaced with a failed or incomplete result", () => {
  const { matrix, contract } = packageSource();
  const changed = clone(contract);
  changed.sourceObservations.ownerFocusedTests = {
    ...changed.sourceObservations.ownerFocusedTests,
    passed: 29,
    failed: 1,
    result: "FAIL",
    failedAssertions: ["CROSS_WORKSPACE_FIELD_SESSION_WRITE_REJECTION"]
  };
  assert.throws(() => validateAugust1GovernanceReport(changed, matrix));
});
