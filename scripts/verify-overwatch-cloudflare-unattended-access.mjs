import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  scanTrackedRepository,
  verifyLocalSecretArtifacts
} from "./check-cloudflare-unattended-secret-presence.mjs";

const root = resolve(import.meta.dirname, "..");
const infrastructurePath = "workers/infrastructure/cloudflare-unattended-deployment-access-v1.json";
const governancePath = "overwatch/governance/cloudflare-unattended-deployment-access-v1.json";
const reportPath = "overwatch/reports/BATCH-20260714-006-cloudflare-unattended-runtime-guard.json";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";
const founderAttendedSuccessorPath = "overwatch/governance/cloudflare-founder-attended-service-token-provisioning-v1.json";
const founderAttendedTtySuccessorPath = "overwatch/governance/cloudflare-founder-attended-real-macos-tty-compatibility-repair-v1.json";
const founderAttendedRecoverySuccessorPath = "overwatch/governance/cloudflare-founder-attended-get-only-recovery-v1.json";
const founderAttendedResponseContractSuccessorPath =
  "overwatch/governance/cloudflare-founder-attended-service-token-response-contract-repair-v1.json";
const founderAttendedCreateReceiptV2SuccessorPath =
  "overwatch/governance/cloudflare-founder-attended-live-create-receipt-safe-provisioning-repair-v2.json";
const unattendedKeychainInteroperabilitySuccessorPath =
  "overwatch/governance/cloudflare-unattended-keychain-interoperability-v1.json";
const githubDeploymentSuccessorPath =
  "overwatch/governance/github-actions-founder-triggered-private-worker-deployment-v1.json";
const commercialReadinessSuccessorPath =
  "overwatch/governance/route-iq-commercial-readiness-v1.json";
const ycInvestorFocusSuccessorPath =
  "overwatch/governance/route-iq-yc-investor-website-focus-v1.json";
const routeIq3dSuccessorPath =
  "overwatch/governance/route-iq-3d-visual-continuity-v1.json";
const publicDeploymentWorkflowV2SuccessorPath =
  "overwatch/governance/public-deployment-workflow-v2.json";

const CURRENT_OWNER_SUCCESSORS = Object.freeze([
  Object.freeze({
    predecessorGovernanceId: "cloudflare-unattended-deployment-access-governance-v1",
    path: "intelligence/contracts/shadow-decision-readiness-contracts.json",
    historicalSha256: "15c331611ff4f4e770ab6ddd4639303720f7f031e4c7f47ad5ad1e4c4f9231f8",
    previousSuccessorSha256: "f52ca21731476174cc29034e4df9d039da85f5b4cdc8011e1e9917656d5815de",
    successorSha256: "03e5bc7c12d33d14f8363beea74fd8f5ed7179b631348760c901369ee9f834c2",
    owner: "Prometheus Intelligence Engine",
    ownerCommit: "3587c3d70526b95ae9083520ed42025c5522f764"
  }),
  Object.freeze({
    predecessorGovernanceId: "cloudflare-unattended-deployment-access-governance-v1",
    path: "scripts/verify-shadow-decision-readiness.mjs",
    historicalSha256: "caed723ccdaf8aa2958298a06b549f7a4ab69a2beb9d4e3cfbb0ee284ef59b49",
    previousSuccessorSha256: "0c8a1e483c7444c76d5435397c360ce3f5028a520d85ca1e58fe24d26d93d934",
    successorSha256: "9519b7eb0e607acc1353389409e4f7b3a9c856fbb4cd5bc6393896e1f9a9a948",
    owner: "Prometheus Intelligence Engine",
    ownerCommit: "3587c3d70526b95ae9083520ed42025c5522f764"
  }),
  Object.freeze({
    predecessorGovernanceId: "cloudflare-unattended-deployment-access-governance-v1",
    path: "workers/prometheus-iq-worker.js",
    historicalSha256: "b260dcea7204c6de0c0e403a5a67bdac5f95dd46acfc62150ce852666a780870",
    previousSuccessorSha256: "4950424f65b20e68d332b89bd660983107cec1dd81d55ae2d8c4e77cab0ce68a",
    successorSha256: "eeb7346be172d33e7f04b6ec9ac4d256faae450410ea5c8a12e16a26a884f5dc",
    owner: "Prometheus Infrastructure",
    ownerCommit: "fd14a3b13ac00b645857396f3d26fa069762b715"
  }),
  Object.freeze({
    predecessorGovernanceId: "cloudflare-unattended-deployment-access-governance-v1",
    path: "index.html",
    historicalSha256: "9cae5bdb9afd51615ad834e88923c53498c712126c25bf0b717bfd9a40622e16",
    previousSuccessorSha256: "385e35bc547cb74d6ce29290bfdb317345969e316ad6650946f083796332c177",
    successorSha256: "8ce316c52b574e875eb259b0d6b5b206ef2600cf8a14243d71c3a961731249a0",
    owner: "Prometheus Dashboard",
    ownerCommit: "99457bcda1abed536cc06585492d29f5ac500f05"
  }),
  Object.freeze({
    predecessorGovernanceId: "cloudflare-unattended-deployment-access-governance-v1",
    path: "deploy/cloudflare-pages/index.html",
    historicalSha256: "9cae5bdb9afd51615ad834e88923c53498c712126c25bf0b717bfd9a40622e16",
    previousSuccessorSha256: "385e35bc547cb74d6ce29290bfdb317345969e316ad6650946f083796332c177",
    successorSha256: "8ce316c52b574e875eb259b0d6b5b206ef2600cf8a14243d71c3a961731249a0",
    owner: "Prometheus Dashboard",
    ownerCommit: "99457bcda1abed536cc06585492d29f5ac500f05"
  })
]);

const CURRENT_OWNER_COMMITS = Object.freeze([
  Object.freeze({
    commit: "3587c3d70526b95ae9083520ed42025c5522f764",
    tree: "5ac08aecd5c1f720c03194027aef3def4083a142",
    parent: "0ac5b54351e12fec954e479c1c56506c58dea6c8",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "Synchronize shadow-readiness runtime baselines",
    files: Object.freeze([
      "intelligence/contracts/shadow-decision-readiness-contracts.json",
      "intelligence/provenance/protected-baseline-synchronization-route-iq-august-1-launch-closeout-v1.json",
      "scripts/verify-shadow-decision-readiness.mjs"
    ])
  }),
  Object.freeze({
    commit: "fd14a3b13ac00b645857396f3d26fa069762b715",
    tree: "fcb370d28dd3d8598191915d9ef9323c3f3c3d00",
    parent: "2c9a17217e2560969afd31f3f42067b3703caec8",
    identity: "Prometheus Infrastructure <infrastructure@prometheus.local>",
    subject: "Add bounded Route IQ customer runtime",
    files: Object.freeze([
      "scripts/build-route-iq-private-forward-rollback-candidate-v2.mjs",
      "tests/route-iq-august-1-customer-pwa-infrastructure.test.mjs",
      "tests/route-iq-private-forward-rollback-candidate-v2.test.mjs",
      "workers/infrastructure/route-iq-august-1-customer-pwa-runtime-v1.json",
      "workers/infrastructure/route-iq-august-1-customer-pwa-runtime.js",
      "workers/infrastructure/route-iq-private-forward-rollback-candidate-v2.json",
      "workers/infrastructure/route-iq-private-forward-rollback-inert-durable-object-v2.js",
      "workers/infrastructure/route-iq-private-forward-rollback-wrangler-v2.json",
      "workers/prometheus-iq-worker.js"
    ])
  }),
  Object.freeze({
    commit: "99457bcda1abed536cc06585492d29f5ac500f05",
    tree: "ca9c01b40d763ceb707ba88118c905a8056e7407",
    parent: "54804800533e705efe7add510e5e4bb72a3ba7dc",
    identity: "Prometheus Dashboard <dashboard@prometheus.local>",
    subject: "Add bounded Route IQ customer PWA",
    files: Object.freeze([
      "_headers",
      "deploy/cloudflare-pages/_headers",
      "deploy/cloudflare-pages/index.html",
      "deploy/cloudflare-pages/manifest-founder.webmanifest",
      "deploy/cloudflare-pages/manifest.webmanifest",
      "deploy/cloudflare-pages/sw.js",
      "index.html",
      "manifest-founder.webmanifest",
      "manifest.webmanifest",
      "scripts/verify-dashboard-runtime-workflows.mjs",
      "sw.js",
      "tests/dashboard-route-iq-customer-pwa.test.mjs",
      "tests/dashboard-route-iq-field-session-producer.test.mjs",
      "tests/dashboard-route-iq-product-focus.test.mjs"
    ])
  })
]);

const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const equalJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function git(...args) {
  return execFileSync("/usr/bin/git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
}

function verifyCurrentOwnerSuccessors(commercialReadiness, routeIq3dSuccessor, failures) {
  for (const expected of CURRENT_OWNER_COMMITS) {
    const identity = git("show", "-s", "--format=%T%n%P%n%an <%ae>%n%cn <%ce>%n%s", expected.commit)
      .split("\n");
    const files = git("diff-tree", "--no-commit-id", "--name-only", "-r", expected.commit)
      .split("\n").filter(Boolean).sort();
    if (identity[0] !== expected.tree
      || identity[1] !== expected.parent
      || identity[2] !== expected.identity
      || identity[3] !== expected.identity
      || identity[4] !== expected.subject
      || !equalJson(files, [...expected.files].sort())) {
      failures.push(`Current owner successor drifted: ${expected.commit}`);
    }
  }

  for (const mapping of CURRENT_OWNER_SUCCESSORS) {
    const predecessorMappings = mapping.owner === "Prometheus Intelligence Engine"
      ? routeIq3dSuccessor.protectedInvestorFocusBaselineSuccessors
      : commercialReadiness.protectedBaselineSuccessors;
    const predecessor = predecessorMappings.find(entry => (
      entry.path === mapping.path
      && entry.successorSha256 === mapping.previousSuccessorSha256
    ));
    if (!predecessor
      || sha256(read(mapping.path)) !== mapping.successorSha256
      || !CURRENT_OWNER_COMMITS.some(entry => entry.commit === mapping.ownerCommit)) {
      failures.push(`Current owner successor mapping drifted: ${mapping.path}`);
    }
  }
}

const expectedMethods = Object.freeze(["GET", "HEAD"]);
const expectedCredentialNames = Object.freeze({
  deployment: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"],
  smoke: ["CLOUDFLARE_ACCESS_CLIENT_ID", "CLOUDFLARE_ACCESS_CLIENT_SECRET"]
});
const expectedProfiles = Object.freeze([
  "presence",
  "smoke-dry-run",
  "smoke-read-only",
  "deployment-release"
]);

export function evaluateCloudflareUnattendedAccessGovernance({
  infrastructure,
  governance,
  report
}) {
  const failures = [];
  const require = (condition, message) => {
    if (!condition) failures.push(message);
  };

  require(infrastructure.contractVersion === "cloudflare-unattended-deployment-access-v1", "Infrastructure contract version drifted.");
  require(infrastructure.batchId === "BATCH-20260714-006", "Infrastructure batch ID drifted.");
  require(infrastructure.architectureBatchId === "BATCH-20260714-005", "Architecture predecessor drifted.");
  require(infrastructure.owner === "Prometheus Infrastructure", "Infrastructure owner drifted.");
  require(infrastructure.setupStatus === "NOT_CONFIGURED", "Setup must remain NOT_CONFIGURED.");
  require(infrastructure.unattendedDeploymentReady === false, "Unattended deployment must remain not ready.");
  require(infrastructure.unattendedSmokeReady === false, "Unattended smoke must remain not ready.");
  require(infrastructure.deploymentAuthorized === false, "Infrastructure must not authorize deployment.");
  require(infrastructure.deploymentPerformed === false, "Infrastructure must not report deployment.");
  require(infrastructure.cloudflareAccessPerformed === false, "Infrastructure must not report Cloudflare access.");
  require(infrastructure.productionMutationPerformed === false, "Infrastructure must not report production mutation.");

  require(infrastructure.target.privateWorker === "prometheus-iq", "Private Worker target drifted.");
  require(infrastructure.target.environment === "production_private", "Private environment drifted.");
  require(infrastructure.target.publicWorker === "prometheusrouteiq-website", "Public Worker identity drifted.");
  require(infrastructure.target.publicWorkerAllowed === false, "Public Worker must remain denied.");
  require(infrastructure.target.targetExpansionAllowed === false, "Target expansion must remain denied.");

  require(infrastructure.credentialSeparation.sharedCredentialAllowed === false, "Deployment and smoke credentials must remain separate.");
  require(equalJson(infrastructure.deploymentCredential.environmentNames, expectedCredentialNames.deployment), "Deployment credential names drifted.");
  require(equalJson(infrastructure.smokeCredential.environmentNames, expectedCredentialNames.smoke), "Smoke credential names drifted.");
  require(equalJson(infrastructure.deploymentCredential.permissions, ["Account Settings Read", "Workers Scripts Edit"]), "Deployment credential is broader than the approved least-privilege set.");
  require(infrastructure.deploymentCredential.resourceScope.include === "exact_account_only", "Deployment credential must target one exact account.");
  require(infrastructure.deploymentCredential.resourceScope.zoneResourcesGranted === false, "Deployment credential must not receive zone scope.");
  require(infrastructure.smokeCredential.policy.action === "Service Auth", "Smoke policy must use Service Auth.");
  require(infrastructure.smokeCredential.policy.include === "exact_service_token_only", "Smoke policy must select one exact service token.");
  require(infrastructure.smokeCredential.policy.anyServiceTokenAllowed === false, "Any Access Service Token must remain prohibited.");
  require(infrastructure.smokeCredential.policy.policyChangeAuthorizedByThisBatch === false, "This batch must not authorize an Access policy change.");
  require(infrastructure.smokeCredential.httpReadOnlyGuaranteeProvidedByAccess === false, "Access authentication alone must not be represented as read-only enforcement.");

  const guard = infrastructure.servicePrincipalReadOnlyGuard;
  require(guard.status === "IMPLEMENTED_SOURCE_NOT_DEPLOYED_NOT_CONFIGURED", "Service-principal guard source status drifted.");
  require(guard.sourceImplemented === true, "Service-principal guard source must be implemented.");
  require(guard.productionConfigured === false, "Service-principal guard must remain unconfigured in production.");
  require(guard.productionDeployed === false, "Service-principal guard must remain undeployed.");
  require(guard.privateWorkerRunsFirstForAllRequestsInSource === true, "Private Worker must run before assets in source.");
  require(equalJson(guard.allowedMethods, expectedMethods), "Service-principal methods must be exact GET/HEAD.");
  require(Array.isArray(guard.allowedPaths) && guard.allowedPaths.length === 15 && new Set(guard.allowedPaths).size === 15, "Service-principal path allowlist drifted or contains duplicates.");
  require(guard.allOtherMethodsAndPaths === "DENY", "Non-allowlisted service-principal requests must deny.");
  require(guard.writeAttemptCountRequired === 0, "Smoke verification must require zero attempted writes.");
  require(guard.authentication.algorithm === "RS256", "Service-principal JWT algorithm drifted.");
  require(guard.authentication.signatureRequired === true, "Service-principal JWT signature must be required.");
  require(guard.authentication.exactIssuerRequired === true, "Exact Access issuer must be required.");
  require(guard.authentication.exactAudienceRequired === true, "Exact Access audience must be required.");
  require(guard.authentication.serviceTokenSub === "", "Service-token sub must remain empty.");
  require(guard.authentication.serviceTokenCommonNameMustEqualConfiguredClientId === true, "Service-token common_name must match the configured client ID.");
  require(guard.authentication.headerPresenceAloneAccepted === false, "Headers or markers alone must never authorize.");

  const smoke = infrastructure.defaultDenySmokeClient;
  require(smoke.status === "IMPLEMENTED_LOCAL_NOT_CONFIGURED_NOT_EXECUTED", "Smoke client source status drifted.");
  require(smoke.productionOrigin === "https://prometheus-iq.prometheusrouteiq.workers.dev", "Smoke origin drifted.");
  require(smoke.fixedProfileOnly === true, "Smoke client must remain fixed-profile only.");
  require(smoke.arbitraryUrlAllowed === false && smoke.arbitraryMethodAllowed === false, "Smoke client must deny arbitrary URLs and methods.");
  require(smoke.requestBodiesAllowed === false && smoke.cookiesAllowed === false, "Smoke client must not send bodies or cookies.");
  require(smoke.redirectMode === "manual" && smoke.credentialsMode === "omit", "Smoke client redirect or credential mode drifted.");
  require(smoke.browserOrServiceWorkerUsed === false, "Smoke client must not use a browser or service worker.");
  require(smoke.responseBodiesReadOrPersisted === false, "Smoke client must not read or persist response bodies.");
  require(smoke.productionNetworkAccessPerformedByThisBatch === false, "This batch must not perform production smoke access.");

  const control = infrastructure.founderDeploymentControl;
  require(control.defaultState === "OFF", "Founder control must default OFF.");
  require(control.requiredFileMode === "0600", "Founder control mode must be 0600.");
  require(control.regularFileRequired === true && control.symlinkAllowed === false, "Founder control must be a non-symlink regular file.");
  require(control.currentUserOwnershipRequired === true, "Founder control must require current-user ownership.");
  require(control.strictJsonShapeRequired === true, "Founder control must require strict JSON shape.");
  require(control.exactRepositoryCommitAndTreeRequired === true, "Founder control must match exact commit and tree.");
  require(control.exactDirectiveMatchRequired === true, "Founder control must match the exact Founder directive.");
  require(control.maximumLifetimeMinutes === 30, "Founder control validity window must remain 30 minutes.");
  require(control.oneShot === true && control.atomicConsumptionRequired === true, "Founder control must be atomically one-shot.");
  require(control.authorizationNonceReusable === false, "Founder control nonce reuse must remain denied.");
  require(control.authorizesDeploymentByItself === false, "Founder control must not authorize deployment by itself.");

  const launcher = infrastructure.auditedKeychainLauncher;
  require(launcher.status === "IMPLEMENTED_LOCAL_NOT_CONFIGURED_NOT_EXECUTED", "Launcher source status drifted.");
  require(equalJson(launcher.fixedProfiles, expectedProfiles), "Launcher fixed profiles drifted.");
  require(launcher.arbitraryCommandAllowed === false, "Launcher must deny arbitrary commands.");
  require(launcher.pinnedWranglerModule === "node_modules/wrangler/bin/wrangler.js", "Launcher Wrangler module drifted.");
  require(launcher.pinnedWranglerVersion === "4.110.0" && launcher.wranglerIsExactDirectDevDependency === true, "Launcher Wrangler supply-chain pin is incomplete.");
  require(launcher.nodeOptionsAllowed === false, "Launcher must strip NODE_OPTIONS.");
  require(launcher.presenceChecksReadValues === false, "Name-only Keychain checks must not read values.");
  require(launcher.checkOnlyConsumesNonce === false && launcher.launchConsumesNonceBeforeChild === true, "Launcher nonce sequencing drifted.");
  require(launcher.credentialValuesPassedInArguments === false && launcher.credentialValuesIncludedInAuditOutput === false, "Launcher must not expose credential values.");
  require(launcher.publicWorkerCommandAvailable === false, "Launcher must not expose a public Worker command.");
  require(launcher.launcherExecutedByThisBatch === false, "This batch must not execute the launcher.");

  const secret = infrastructure.secretSafety;
  require(secret.valuesMayBePrinted === false && secret.valuesMayBeLogged === false, "Secret values must not be printed or logged.");
  require(secret.valuesMayBeHashedForReports === false && secret.valuesMayBeMeasured === false, "Secret values must not be hashed or measured.");
  require(secret.trackedRegularFilesAllExtensionsAndSizes === true, "Secret scan must cover all tracked regular file extensions and sizes.");
  require(secret.trackedWorktreeMustMatchIndex === true, "Secret scan must reject index/worktree drift.");
  require(secret.binarySkipCriterion === "NUL_byte_only", "Secret scan binary skip rule drifted.");
  require(secret.matchedValuesMayBeReported === false, "Secret scanner must not report matched values.");

  require(governance.governanceId === "cloudflare-unattended-deployment-access-governance-v1", "Overwatch governance ID drifted.");
  require(governance.version === "1.1.0" && governance.batchId === "BATCH-20260714-006", "Overwatch governance version or batch drifted.");
  require(governance.owningSubsystem === "Prometheus Overwatch", "Overwatch governance owner drifted.");
  require(governance.dispatchAudit.implementationOwner === "Prometheus Infrastructure", "Implementation owner must remain Infrastructure.");
  require(equalJson(governance.dispatchAudit.implementationOwners, [
    "Prometheus Infrastructure",
    "Prometheus Intelligence Engine"
  ]), "Batch implementation owner set drifted.");
  require(governance.dispatchAudit.verificationOwner === "Prometheus Overwatch", "Verification owner must remain Overwatch.");
  require(governance.dispatchAudit.implementationOwnershipRespected === true, "Implementation ownership must be verified.");
  require(governance.dispatchAudit.overwatchModifiedSubsystemImplementation === false, "Overwatch must not modify Infrastructure implementation.");
  require(equalJson(governance.dispatchAudit.implementationCommits.map(entry => entry.commit), [
    "e41e025173d9843de51c6c8e789570e27345a13b",
    "3c8ca61910358c13cc0c05e1fbda5d3052b31a9b"
  ]), "Infrastructure owner commit chain drifted.");
  require(governance.dispatchAudit.intelligenceOwnerRepair.commit === "c05fa818c2ccff98447089287b110c35704ff3a4", "Intelligence owner repair commit drifted.");
  require(governance.servicePrincipalBoundary.productionConfigured === false && governance.servicePrincipalBoundary.productionDeployed === false, "Governance must preserve the unconfigured, undeployed guard state.");
  require(equalJson(governance.servicePrincipalBoundary.allowedMethods, expectedMethods), "Governance smoke methods drifted.");
  require(governance.servicePrincipalBoundary.markerAloneAuthorizes === false, "Governance must reject marker-only authorization.");
  require(governance.founderControlBoundary.defaultState === "OFF", "Governance Founder control must remain OFF.");
  require(governance.launcherBoundary.wranglerVersion === "4.110.0", "Governance Wrangler pin drifted.");
  require(governance.secretBoundary.credentialValuesStoredConfiguredReadOrExposedByBatch === false, "Governance must not claim secret-value access.");

  for (const [field, expected] of Object.entries({
    unattendedDeploymentReady: false,
    unattendedSmokeReady: false,
    deploymentAuthorized: false,
    deploymentPerformed: false,
    cloudflareAccessPerformed: false,
    tokenCreationPerformed: false,
    serviceTokenCreationPerformed: false,
    accessPolicyChangePerformed: false,
    keychainValueReadPerformed: false,
    secretStoragePerformed: false,
    productionMutationPerformed: false,
    cohortActivation: "OFF",
    prospectiveCollection: "OFF",
    recommendationInfluence: "OFF"
  })) {
    require(governance.deploymentBoundary[field] === expected, `Governance deployment boundary drifted: ${field}.`);
  }
  require(governance.releaseBoundary.deploymentRecommendation === "DO_NOT_DEPLOY", "Deployment recommendation must remain DO_NOT_DEPLOY.");

  require(report.batchId === "BATCH-20260714-006", "Batch report ID drifted.");
  require(equalJson(report.owners.implementation, [
    "Prometheus Infrastructure",
    "Prometheus Intelligence Engine"
  ]) && report.owners.verification === "Prometheus Overwatch", "Batch report owners drifted.");
  require(report.owners.intelligenceRepairCommit === "c05fa818c2ccff98447089287b110c35704ff3a4", "Batch report Intelligence repair drifted.");
  require(report.owners.ownershipRespected === true && report.owners.overwatchModifiedInfrastructureImplementation === false, "Batch report ownership audit failed.");
  require(report.currentReadiness.setupStatus === "NOT_CONFIGURED", "Batch report setup must remain NOT_CONFIGURED.");
  require(report.currentReadiness.unattendedDeploymentReady === false && report.currentReadiness.unattendedSmokeReady === false, "Batch report must not claim unattended readiness.");
  require(report.verification.secretFindings === 0, "Batch report must record zero secret findings.");
  require(report.boundaries.cloudflareAccessUsed === false && report.boundaries.keychainValuesRead === false, "Batch report must not claim Cloudflare or Keychain access.");
  require(report.boundaries.deploymentPerformed === false && report.boundaries.productionMutationPerformed === false, "Batch report must not claim deployment or production mutation.");
  require(report.boundaries.prospectiveCollection === "OFF" && report.boundaries.recommendationInfluence === "OFF", "Batch report must preserve collection and recommendation boundaries.");
  require(report.release.deploymentStatus === "NOT_AUTHORIZED" && report.release.deploymentRecommendation === "DO_NOT_DEPLOY", "Batch report deployment boundary drifted.");
  require(report.release.unattendedDeploymentStillBlocked === true, "Batch report must retain the unattended setup blocker.");

  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

function verifyHashes(entries, failures, label, successorMappings = [], terminalMappings = []) {
  for (const entry of Object.values(entries)) {
    const current = entry?.path ? sha256(read(entry.path)) : null;
    const successors = successorMappings.filter(mapping => (
      mapping.predecessorGovernanceId === "cloudflare-unattended-deployment-access-governance-v1"
      && mapping.path === entry?.path
      && mapping.historicalSha256 === entry?.sha256
    ));
    const direct = successors.some(mapping => mapping.successorSha256 === current);
    const terminal = successors.some(successor => terminalMappings.some(mapping => (
      mapping.predecessorGovernanceId === "route-iq-yc-investor-website-focus-v1"
      && mapping.path === entry?.path
      && mapping.previousSuccessorSha256 === successor.successorSha256
      && mapping.successorSha256 === current
    )));
    if (!entry?.path || !entry?.sha256 || (
      current !== entry.sha256
      && !direct
      && !terminal
    )) {
      failures.push(`${label} hash drifted: ${entry?.path || "missing_path"}`);
    }
  }
}

function verifyProtectedRuntimeHashes(governance, failures, successorMappings = []) {
  const baselines = governance.protectedRuntimeBaselines;
  for (const prefix of ["privateWrangler", "publicWrangler", "privateWorker", "dashboardSource", "dashboardDeploy"]) {
    const path = baselines[`${prefix}Path`];
    const expected = baselines[`${prefix}Sha256`];
    const current = path ? sha256(read(path)) : null;
    const successor = successorMappings.find(mapping => (
      mapping.predecessorGovernanceId === governance.governanceId
      && mapping.path === path
      && mapping.historicalSha256 === expected
      && mapping.successorSha256 === current
    ));
    if (!path || !expected || (current !== expected && !successor)) {
      failures.push(`Protected runtime hash drifted: ${path || prefix}`);
    }
  }
}

export function verifyOverwatchCloudflareUnattendedAccess() {
  const infrastructure = readJson(infrastructurePath);
  const governance = readJson(governancePath);
  const report = readJson(reportPath);
  const registry = readJson(registryPath);
  const founderAttendedSuccessor = readJson(founderAttendedSuccessorPath);
  const founderAttendedTtySuccessor = readJson(founderAttendedTtySuccessorPath);
  const founderAttendedRecoverySuccessor = readJson(founderAttendedRecoverySuccessorPath);
  const founderAttendedResponseContractSuccessor =
    readJson(founderAttendedResponseContractSuccessorPath);
  const founderAttendedCreateReceiptV2Successor =
    readJson(founderAttendedCreateReceiptV2SuccessorPath);
  const unattendedKeychainInteroperabilitySuccessor =
    readJson(unattendedKeychainInteroperabilitySuccessorPath);
  const githubDeploymentSuccessor = readJson(githubDeploymentSuccessorPath);
  const commercialReadinessSuccessor = readJson(commercialReadinessSuccessorPath);
  const ycInvestorFocusSuccessor = readJson(ycInvestorFocusSuccessorPath);
  const routeIq3dSuccessor = readJson(routeIq3dSuccessorPath);
  const publicDeploymentWorkflowV2Successor = readJson(publicDeploymentWorkflowV2SuccessorPath);
  const packageJson = readJson("package.json");
  const packageLock = readJson("package-lock.json");
  const workflow = read(".github/workflows/security-gates.yml");
  const failures = [];

  const evaluated = evaluateCloudflareUnattendedAccessGovernance({ infrastructure, governance, report });
  failures.push(...evaluated.failures);
  verifyCurrentOwnerSuccessors(commercialReadinessSuccessor, routeIq3dSuccessor, failures);
  verifyHashes(
    governance.infrastructureEvidence,
    failures,
    "Infrastructure evidence",
    [
      ...founderAttendedSuccessor.protectedPredecessorSuccessors,
      ...founderAttendedTtySuccessor.protectedPredecessorSuccessors,
      ...founderAttendedRecoverySuccessor.protectedPredecessorSuccessors,
      ...founderAttendedResponseContractSuccessor.protectedPredecessorSuccessors,
      ...founderAttendedCreateReceiptV2Successor.protectedPredecessorSuccessors,
      ...unattendedKeychainInteroperabilitySuccessor.protectedPredecessorSuccessors,
      ...githubDeploymentSuccessor.protectedPredecessorSuccessors,
      ...routeIq3dSuccessor.protectedPredecessorSuccessors,
      ...publicDeploymentWorkflowV2Successor.protectedPredecessorSuccessors
    ]
  );
  verifyHashes(
    Object.fromEntries(Object.entries(governance.intelligenceEvidence).filter(([, value]) => value?.path)),
    failures,
    "Intelligence evidence",
    [
      ...ycInvestorFocusSuccessor.protectedBaselineSuccessors,
      ...CURRENT_OWNER_SUCCESSORS.filter(entry => entry.owner === "Prometheus Intelligence Engine")
    ],
    routeIq3dSuccessor.protectedInvestorFocusBaselineSuccessors
  );
  verifyProtectedRuntimeHashes(
    governance,
    failures,
    [
      ...commercialReadinessSuccessor.protectedBaselineSuccessors,
      ...CURRENT_OWNER_SUCCESSORS.filter(entry => entry.owner !== "Prometheus Intelligence Engine")
    ]
  );

  if (governance.intelligenceEvidence.previousWorkerSha256 !== "723ce018f4a4e1f0f731da02c0852e75c9c2ef0808b124055db2ad1b96124c59"
    || governance.intelligenceEvidence.currentWorkerSha256 !== governance.protectedRuntimeBaselines.privateWorkerSha256
    || !CURRENT_OWNER_SUCCESSORS.some(mapping => (
      mapping.predecessorGovernanceId === governance.governanceId
      && mapping.path === governance.protectedRuntimeBaselines.privateWorkerPath
      && mapping.historicalSha256 === governance.intelligenceEvidence.currentWorkerSha256
      && mapping.successorSha256 === sha256(read(governance.protectedRuntimeBaselines.privateWorkerPath))
    ))
    || governance.intelligenceEvidence.historicalBaselineRewritten !== false
    || governance.intelligenceEvidence.recommendationInfluenceChanged !== false
    || governance.intelligenceEvidence.intelligenceBehaviorChanged !== false) {
    failures.push("Intelligence protected Worker successor boundary drifted.");
  }

  const registration = registry.governanceArtifacts.find(entry => (
    entry.artifactId === governance.governanceId
  ));
  if (!registration
    || registration.ownerSubsystem !== "Prometheus Overwatch"
    || registration.path !== governancePath
    || registration.productionConsumer !== false) {
    failures.push("Cloudflare unattended governance registration drifted.");
  }

  if (packageJson.devDependencies?.wrangler !== "4.110.0"
    || packageLock.packages?.[""]?.devDependencies?.wrangler !== "4.110.0"
    || packageLock.packages?.["node_modules/wrangler"]?.version !== "4.110.0") {
    failures.push("Wrangler is not exactly pinned in the manifest and lockfile.");
  }
  if (!packageJson.scripts["infrastructure:cloudflare-unattended-runtime-guard:check"]
    || !packageJson.scripts.test.includes("infrastructure:cloudflare-unattended-runtime-guard:check")
    || !packageJson.scripts["overwatch:cloudflare-unattended-access:check"]
    || !packageJson.scripts.test.includes("overwatch:cloudflare-unattended-access:check")) {
    failures.push("Full repository release wiring omits unattended runtime verification.");
  }
  if (/wrangler\s+deploy|cloudflare\/wrangler-action|pages-action|workers deploy/iu.test(workflow)) {
    failures.push("GitHub push workflow contains a deployment trigger.");
  }

  const secretFindings = scanTrackedRepository({ root });
  const localArtifactFailures = verifyLocalSecretArtifacts({ root });
  if (secretFindings.length) failures.push(`Tracked secret scan found ${secretFindings.length} finding(s).`);
  failures.push(...localArtifactFailures.map(failure => `Local secret artifact protection failed: ${failure}`));

  if (failures.length) throw new Error(failures.join("\n"));
  return Object.freeze({
    status: "PASS",
    batchId: governance.batchId,
    implementationOwner: governance.dispatchAudit.implementationOwner,
    verificationOwner: governance.dispatchAudit.verificationOwner,
    implementationCommits: governance.dispatchAudit.implementationCommits.map(entry => entry.commit),
    intelligenceRepairCommit: governance.dispatchAudit.intelligenceOwnerRepair.commit,
    setupStatus: infrastructure.setupStatus,
    guardStatus: infrastructure.servicePrincipalReadOnlyGuard.status,
    currentOwnerSuccessorCommits: CURRENT_OWNER_COMMITS.map(entry => entry.commit),
    currentOwnerSuccessorMappings: CURRENT_OWNER_SUCCESSORS.length,
    repositorySecretFindings: secretFindings.length,
    unattendedDeploymentReady: false,
    unattendedSmokeReady: false,
    deploymentAuthorized: false,
    deploymentPerformed: false,
    cloudflareAccessPerformed: false,
    keychainValueReadPerformed: false,
    productionMutationPerformed: false,
    prospectiveCollection: "OFF",
    recommendationInfluence: "OFF",
    deploymentRecommendation: "DO_NOT_DEPLOY"
  });
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    console.log(JSON.stringify(verifyOverwatchCloudflareUnattendedAccess(), null, 2));
  } catch (error) {
    console.error(`Overwatch Cloudflare unattended access verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
