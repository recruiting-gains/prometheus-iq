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
  AUGUST_1_SUCCESSORS_PATH,
  validateAugust1GovernanceReport,
  validateAugust1ReadinessMatrix,
  validateAugust1ReadinessSuccessors,
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
    AUGUST_1_SUCCESSORS_PATH,
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

function rewriteArtifactAndPin(root, path, value) {
  writeFileSync(resolve(root, path), value);
  const contract = readJson(root, AUGUST_1_GOVERNANCE_REPORT_PATH);
  const pin = contract.artifactPins.find(artifact => artifact.path === path);
  assert.ok(pin, `Missing artifact pin for ${path}`);
  pin.sha256 = sha256(readFileSync(resolve(root, path)));
  writeJson(root, AUGUST_1_GOVERNANCE_REPORT_PATH, contract);
}

test("authoritative August 1 package passes while launch remains fail-closed", () => {
  const result = verifyOverwatchRouteIqAugust1LaunchReadiness({ root: ROOT, verifyGit: false });
  assert.equal(result.verificationStatus, "PASS");
  assert.equal(result.launchStatus, "AUGUST_1_LAUNCH_BLOCKED");
  assert.equal(result.totalRequirements, 26);
  assert.equal(result.verifiedRequirements, 20);
  assert.equal(result.readinessPercent, 76.9);
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

test("August 1 successor evidence preserves historical pins and rejects drift", () => {
  const successors = readJson(ROOT, AUGUST_1_SUCCESSORS_PATH);
  assert.equal(validateAugust1ReadinessSuccessors(successors), successors);

  for (const mutate of [
    value => { value.historicalCloseoutEvidenceRewritten = true; },
    value => { value.successors[0].commit = "0".repeat(40); },
    value => { value.successors[0].owner =
      "Prometheus Overwatch <overwatch@prometheus.local>"; },
    value => { value.successors[0].evidence[0].previousSha256 = "0".repeat(64); },
    value => { value.successors[0].evidence[0].successorSha256 = "0".repeat(64); },
    value => { value.successors[1].commit = "0".repeat(40); },
    value => { value.successors[1].owner =
      "Prometheus Infrastructure <infrastructure@prometheus.local>"; },
    value => { value.successors[1].evidence[1].successorSha256 = "0".repeat(64); },
    value => { value.successors[10].commit = "0".repeat(40); },
    value => { value.successors[10].evidence[0].previousSha256 = "0".repeat(64); },
    value => { value.successors[10].evidence[0].successorSha256 = "0".repeat(64); },
    value => { value.successors[11].commit = "0".repeat(40); },
    value => { value.successors[11].owner =
      "Prometheus Infrastructure <infrastructure@prometheus.local>"; },
    value => { value.successors[11].evidence[0].previousSha256 = "0".repeat(64); },
    value => { value.successors[11].evidence[0].successorSha256 = "0".repeat(64); },
    value => { value.overwatchCurrentEvidence.pop(); }
  ]) {
    const candidate = clone(successors);
    mutate(candidate);
    assert.throws(() => validateAugust1ReadinessSuccessors(candidate));
  }
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

test("final exact-candidate evidence records the completed unattended qualification scope", () => {
  const { matrix, contract } = packageSource();
  for (const id of [
    "customer_runtime_integration",
    "authentication_and_role_enforcement",
    "tenant_company_user_isolation",
    "forward_rollback_readiness",
    "full_qualification_and_clean_provenance"
  ]) {
    const requirement = matrix.requirements.find(item => item.id === id);
    assert.equal(requirement.status, "VERIFIED", id);
    assert.equal(requirement.launchBlocking, false, id);
    assert.equal(requirement.requiredWork, "None.", id);
  }
  assert.deepEqual(contract.sourceObservations.ownerFocusedTests, {
    command: "node --test tests/route-iq-august-1-launch-envelope.test.mjs tests/route-iq-august-1-customer-pwa-infrastructure.test.mjs tests/dashboard-route-iq-customer-pwa.test.mjs",
    total: 43,
    passed: 43,
    failed: 0,
    result: "PASS",
    failedAssertions: []
  });
  assert.deepEqual(contract.sourceObservations.crmFocusedTests, {
    command: "node --test tests/route-iq-request-crm-infrastructure.test.mjs",
    total: 20,
    passed: 20,
    failed: 0,
    result: "PASS"
  });
  assert.deepEqual(contract.sourceObservations.intelligenceGovernedRuntimeScopeFocusedTests, {
    command: "node --test tests/route-iq-governed-runtime-scope-intelligence.test.mjs",
    total: 5,
    passed: 5,
    failed: 0,
    result: "PASS"
  });
  assert.deepEqual(contract.sourceObservations.intelligenceGovernedRuntimeScopeVerification, {
    command: "node scripts/verify-route-iq-governed-runtime-scope-intelligence.mjs",
    result: "PASS"
  });
  assert.deepEqual(contract.sourceObservations.businessHoursFocusedTests, {
    command: "node --test tests/route-business-hours-eligibility.test.mjs",
    total: 16,
    passed: 16,
    failed: 0,
    result: "PASS"
  });
  assert.deepEqual(contract.sourceObservations.businessHoursCompatibilityVerification, {
    command: "node scripts/verify-route-business-hours-eligibility.mjs",
    result: "PASS",
    fixedReasonCode: "NONE"
  });
  assert.deepEqual(contract.sourceObservations.replenishmentFocusedTests, {
    command: "node --test tests/continuous-adaptive-route-replenishment.test.mjs",
    total: 10,
    passed: 10,
    failed: 0,
    result: "PASS"
  });
  assert.deepEqual(contract.sourceObservations.replenishmentCompatibilityVerification, {
    command: "node scripts/verify-continuous-adaptive-route-replenishment.mjs",
    result: "PASS",
    fixedReasonCode: "NONE"
  });
  assert.deepEqual(contract.sourceObservations.intelligenceGeneratedAssetParity, {
    businessHoursEligibilityModule: true,
    businessHoursGovernanceModule: true,
    businessHoursContract: true,
    continuousAdaptiveRouteReplenishmentModule: true,
    continuousAdaptiveRouteReplenishmentContract: true,
    governedRuntimeScopeModule: true
  });
  assert.deepEqual(contract.sourceObservations.infrastructureFocusedTests, {
    command: "node --test tests/route-iq-august-1-customer-pwa-infrastructure.test.mjs tests/route-iq-private-forward-rollback-candidate-v2.test.mjs",
    total: 27,
    passed: 27,
    failed: 0,
    result: "PASS"
  });
  assert.equal(contract.sourceObservations.customerPwaRuntimeWiredToPrivateWorker, true);
  assert.equal(contract.sourceObservations.productionCrmMonitoringImplementationPresent, true);
  assert.equal(contract.sourceObservations.fullQualificationComplete, true);
  assert.equal(contract.sourceObservations.allOwnerCommitsComplete, true);
  assert.equal(contract.sourceObservations.dashboardBrowserQualificationComplete, true);
  assert.equal(contract.sourceObservations.rollbackSuccessorQualificationComplete, true);
  assert.equal(contract.sourceObservations.ownerArtifactsCommitted, true);
  assert.equal(contract.sourceObservations.workingTreeClean, true);
  assert.equal(contract.sourceObservations.observationState, "FINAL_EXACT_CANDIDATE");
  assert.deepEqual(contract.sourceObservations.dashboardRuntimeVerification, {
    command: "node scripts/verify-dashboard-runtime-workflows.mjs",
    total: 153,
    passed: 153,
    failed: 0,
    mismatchedOperatingProfilesFailClosed: 4,
    result: "PASS"
  });
  assert.deepEqual(contract.sourceObservations.dashboardFocusedTests, {
    command: "node --test tests/dashboard-route-iq-customer-pwa.test.mjs",
    total: 12,
    passed: 12,
    failed: 0,
    result: "PASS"
  });
  assert.deepEqual(contract.sourceObservations.ownerSuccessorBaseline, {
    commit: "f612e394b3af75e63cc07232d64bbd3dd1adb817",
    tree: "d0d5fb3ce8c7b9416c3695645b0ad0fb0715d650",
    dashboardGeneratedIntelligenceMirrorsCommit: "7ad906d37d827a878ca4db82029c81d2c28cd1fd",
    intelligenceRouteTargetVerifierCommit: "3b29b967056482cd95bc47fd3556daf0bb50dbd0",
    dashboardGovernedRuntimeScopeMirrorCommit: "d913a3c8c50379272503c93a8df12e75e048842d",
    dashboardProfileMismatchHarnessCommit: "f612e394b3af75e63cc07232d64bbd3dd1adb817"
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
    "deploy/cloudflare-pages/intelligence/route-iq-governed-runtime-scope.mjs",
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

test("generated governed runtime scope must remain byte-identical to its owner source", t => {
  const fixture = createPackageFixture(t);
  const generatedPath = "deploy/cloudflare-pages/intelligence/route-iq-governed-runtime-scope.mjs";
  rewriteArtifactAndPin(
    fixture,
    generatedPath,
    `${readFileSync(resolve(fixture, generatedPath), "utf8")}\n// governed mirror drift\n`
  );
  assert.throws(
    () => verifyOverwatchRouteIqAugust1LaunchReadiness({ root: fixture, verifyGit: false }),
    /Intelligence generated-asset parity observation drifted/u
  );
});

test("top-level npm lifecycle wires every August 1 owner gate before the legacy suite", () => {
  const packageJson = readJson(ROOT, "package.json");
  const pretestSteps = packageJson.scripts.pretest.split(" && ");
  let previousIndex = -1;
  for (const name of [
    "data:route-iq-august-1-launch-envelope:check",
    "infrastructure:route-iq-august-1-customer-pwa-rollback:check",
    "intelligence:route-iq-governed-runtime-scope:check",
    "overwatch:route-iq-august-1-readiness:check"
  ]) {
    assert.equal(typeof packageJson.scripts[name], "string", name);
    const index = pretestSteps.indexOf(`npm run ${name}`);
    assert.ok(index > previousIndex, `${name} must remain in the ordered pretest lifecycle`);
    previousIndex = index;
  }
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
      /(?:Required launch artifact|Launch successor evidence) drifted/u
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
