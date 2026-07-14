import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { scanTrackedRepository, verifyLocalSecretArtifacts } from "./check-cloudflare-unattended-secret-presence.mjs";

const root = resolve(import.meta.dirname, "..");
const infrastructurePath = "workers/infrastructure/cloudflare-unattended-deployment-access-v1.json";
const governancePath = "overwatch/governance/cloudflare-unattended-deployment-access-v1.json";
const reportPath = "overwatch/reports/BATCH-20260714-005-cloudflare-unattended-deployment-access.json";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";

const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");

function equalJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function evaluateCloudflareUnattendedAccessGovernance({ infrastructure, governance, report }) {
  const failures = [];
  const require = (condition, message) => {
    if (!condition) failures.push(message);
  };

  require(infrastructure.contractVersion === "cloudflare-unattended-deployment-access-v1", "Infrastructure contract version drifted.");
  require(infrastructure.batchId === "BATCH-20260714-005", "Infrastructure batch ID drifted.");
  require(infrastructure.owner === "Prometheus Infrastructure", "Infrastructure owner drifted.");
  require(infrastructure.setupStatus === "NOT_CONFIGURED", "Setup must remain NOT_CONFIGURED.");
  require(infrastructure.unattendedDeploymentReady === false, "Unattended deployment must remain not ready.");
  require(infrastructure.unattendedSmokeReady === false, "Unattended smoke must remain not ready.");
  require(infrastructure.deploymentAuthorized === false, "Infrastructure must not authorize deployment.");
  require(infrastructure.deploymentPerformed === false, "Infrastructure must not report deployment.");
  require(infrastructure.cloudflareAccessPerformed === false, "Infrastructure must not use Cloudflare access.");
  require(infrastructure.productionMutationPerformed === false, "Infrastructure must not mutate production.");

  require(infrastructure.target.privateWorker === "prometheus-iq", "Private target must be prometheus-iq.");
  require(infrastructure.target.publicWorker === "prometheusrouteiq-website", "Public Worker identity drifted.");
  require(infrastructure.target.publicWorkerAllowed === false, "Public Worker must remain denied.");
  require(infrastructure.target.targetExpansionAllowed === false, "Target expansion must remain denied.");

  require(infrastructure.credentialSeparation.sharedCredentialAllowed === false, "Deployment and smoke credentials must remain separate.");
  require(equalJson(infrastructure.deploymentCredential.environmentNames, ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]), "Deployment credential names drifted.");
  require(equalJson(infrastructure.deploymentCredential.permissions, ["Account Settings Read", "Workers Scripts Edit"]), "Deployment permissions are not the approved least-privilege set.");
  require(infrastructure.deploymentCredential.resourceScope.include === "exact_account_only", "Deployment token must target one exact account.");
  require(infrastructure.deploymentCredential.resourceScope.zoneResourcesGranted === false, "Deployment token must not receive zone resources.");
  require(infrastructure.deploymentCredential.permissionExpansionPolicy === "STOP_AND_RETURN_FOUNDER_REVIEW_REQUIRED", "Permission expansion must stop for Founder review.");
  require(infrastructure.deploymentCredential.lifetime.recommendedDays === 30, "Deployment token recommended lifetime drifted.");
  require(infrastructure.deploymentCredential.lifetime.maximumDays === 90, "Deployment token maximum lifetime drifted.");
  require(infrastructure.deploymentCredential.lifetime.automaticRenewalAllowed === false, "Deployment token automatic renewal must remain prohibited.");

  for (const permission of [
    "Access Apps and Policies Write",
    "Access Service Tokens Write",
    "Workers KV Storage Edit",
    "Workers R2 Storage Edit",
    "DNS Edit",
    "Workers Routes Edit",
    "API Tokens Edit",
    "Secrets Store Edit",
    "User permissions",
    "Global permissions"
  ]) {
    require(infrastructure.deploymentCredential.explicitlyDeniedPermissions.includes(permission), `${permission} must remain explicitly denied.`);
  }

  require(equalJson(infrastructure.smokeCredential.environmentNames, ["CLOUDFLARE_ACCESS_CLIENT_ID", "CLOUDFLARE_ACCESS_CLIENT_SECRET"]), "Smoke credential names drifted.");
  require(infrastructure.smokeCredential.policy.action === "Service Auth", "Access policy must use Service Auth.");
  require(infrastructure.smokeCredential.policy.include === "exact_service_token_only", "Access policy must select the exact service token.");
  require(infrastructure.smokeCredential.policy.anyServiceTokenAllowed === false, "Any Access Service Token must remain prohibited.");
  require(infrastructure.smokeCredential.policy.policyChangeAuthorizedByThisBatch === false, "This batch must not authorize an Access policy change.");
  require(infrastructure.smokeCredential.httpReadOnlyGuaranteeProvidedByAccess === false, "Access must not be represented as HTTP read-only.");

  require(infrastructure.localStorage.preferredStore === "macOS Keychain", "macOS Keychain must remain the local store.");
  require(infrastructure.localStorage.injection === "future_audited_child_process_only", "Credential injection must remain future audited child-process-only.");
  require(infrastructure.localStorage.persistentEnvironmentExportAllowed === false, "Persistent credential export must remain prohibited.");
  require(infrastructure.secretSafety.valuesMayBePrinted === false, "Secret values must not be printed.");
  require(infrastructure.secretSafety.valuesMayBeLogged === false, "Secret values must not be logged.");
  require(infrastructure.secretSafety.valuesMayBeHashedForReports === false, "Secret values must not be hashed for reports.");
  require(infrastructure.secretSafety.valuesMayBeMeasured === false, "Secret values must not be measured.");
  require(equalJson(infrastructure.secretSafety.presenceOutput, ["credential_name", "PRESENT_or_ABSENT"]), "Presence output must remain name and state only.");

  require(infrastructure.founderDeploymentControl.defaultState === "OFF", "Founder control must default OFF.");
  require(infrastructure.founderDeploymentControl.maximumLifetimeMinutes === 30, "Founder authorization window must remain bounded to 30 minutes.");
  require(infrastructure.founderDeploymentControl.exactTargetWorker === "prometheus-iq", "Founder control target drifted.");
  require(infrastructure.founderDeploymentControl.oneShot === true, "Founder control must remain one-shot.");
  require(infrastructure.founderDeploymentControl.atomicConsumptionRequired === true, "Founder nonce consumption must be atomic.");
  require(infrastructure.founderDeploymentControl.authorizationNonceReusable === false, "Founder nonce reuse must be denied.");
  require(infrastructure.founderDeploymentControl.authorizesDeploymentByItself === false, "Founder control file must not authorize deployment by itself.");
  require(infrastructure.deploymentGates.automaticEngineeringPushIsDeploymentAuthorization === false, "Engineering push must remain separate from deployment.");

  require(infrastructure.servicePrincipalReadOnlyGuard.status === "NOT_IMPLEMENTED_NOT_AUTHORIZED", "Service-principal guard status must remain not implemented/not authorized.");
  require(infrastructure.servicePrincipalReadOnlyGuard.requiredBeforeUnattendedSmoke === true, "Service-principal guard must be required before smoke readiness.");
  require(equalJson(infrastructure.servicePrincipalReadOnlyGuard.allowedMethods, ["GET", "HEAD"]), "Future smoke methods must be GET/HEAD only.");
  require(infrastructure.servicePrincipalReadOnlyGuard.allOtherMethodsAndPaths === "DENY", "Future smoke guard must default deny.");
  require(infrastructure.servicePrincipalReadOnlyGuard.writeAttemptCountRequired === 0, "Future smoke must require zero attempted writes.");

  require(governance.governanceId === "cloudflare-unattended-deployment-access-governance-v1", "Overwatch governance ID drifted.");
  require(governance.owningSubsystem === "Prometheus Overwatch", "Overwatch governance owner drifted.");
  require(governance.dispatchAudit.implementationOwner === "Prometheus Infrastructure", "Implementation owner must remain Infrastructure.");
  require(governance.dispatchAudit.verificationOwner === "Prometheus Overwatch", "Verification owner must remain Overwatch.");
  require(governance.dispatchAudit.implementationOwnershipRespected === true, "Implementation ownership must be respected.");
  require(governance.dispatchAudit.overwatchModifiedSubsystemImplementation === false, "Overwatch must not modify Infrastructure implementation.");
  require(governance.deploymentBoundary.setupStatus === "NOT_CONFIGURED", "Governance setup state must remain not configured.");
  require(governance.deploymentBoundary.unattendedDeploymentReady === false, "Governance must not claim unattended deployment readiness.");
  require(governance.smokeReadOnlyBoundary.unattendedSmokeReady === false, "Governance must not claim unattended smoke readiness.");
  require(governance.deploymentBoundary.deploymentAuthorized === false, "Governance must not authorize deployment.");
  require(governance.deploymentBoundary.deploymentPerformed === false, "Governance must not report deployment.");
  require(governance.deploymentBoundary.cloudflareAccessPerformed === false, "Governance must not report Cloudflare access.");
  require(governance.deploymentBoundary.tokenCreationPerformed === false, "Governance must not report API-token creation.");
  require(governance.deploymentBoundary.serviceTokenCreationPerformed === false, "Governance must not report service-token creation.");
  require(governance.deploymentBoundary.accessPolicyChangePerformed === false, "Governance must not report an Access-policy change.");
  require(governance.deploymentBoundary.secretStoragePerformed === false, "Governance must not report secret storage.");
  require(governance.deploymentBoundary.productionMutationPerformed === false, "Governance must not report production mutation.");
  require(governance.deploymentBoundary.recommendationInfluence === "OFF", "Recommendation influence must remain OFF.");
  require(governance.deploymentBoundary.prospectiveCollection === "OFF", "Prospective collection must remain OFF.");
  require(governance.releaseBoundary.deploymentRecommendation === "DO_NOT_DEPLOY", "Deployment recommendation must remain DO_NOT_DEPLOY.");

  require(report.batchId === "BATCH-20260714-005", "Batch report ID drifted.");
  require(report.owners.implementation === "Prometheus Infrastructure", "Batch report implementation owner drifted.");
  require(report.owners.verification === "Prometheus Overwatch", "Batch report verification owner drifted.");
  require(report.currentReadiness.setupStatus === "NOT_CONFIGURED", "Batch report must preserve setup blocker.");
  require(report.currentReadiness.unattendedDeploymentReady === false, "Batch report must not claim deployment readiness.");
  require(report.currentReadiness.unattendedSmokeReady === false, "Batch report must not claim smoke readiness.");
  require(report.boundaries.deploymentPerformed === false, "Batch report must not claim deployment.");
  require(report.boundaries.productionMutationPerformed === false, "Batch report must not claim production mutation.");
  require(report.boundaries.recommendationInfluence === "OFF", "Batch report recommendation influence must remain OFF.");
  require(report.release.deploymentStatus === "NOT_AUTHORIZED", "Batch report deployment status must remain not authorized.");

  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

function verifyProtectedRuntimeHashes(governance, failures) {
  const checks = [
    [governance.protectedRuntimeBaselines.privateWranglerPath, governance.protectedRuntimeBaselines.privateWranglerSha256],
    [governance.protectedRuntimeBaselines.publicWranglerPath, governance.protectedRuntimeBaselines.publicWranglerSha256],
    [governance.protectedRuntimeBaselines.privateWorkerPath, governance.protectedRuntimeBaselines.privateWorkerSha256],
    [governance.protectedRuntimeBaselines.dashboardSourcePath, governance.protectedRuntimeBaselines.dashboardSourceSha256],
    [governance.protectedRuntimeBaselines.dashboardDeployPath, governance.protectedRuntimeBaselines.dashboardDeploySha256]
  ];
  for (const [path, expected] of checks) {
    if (sha256(read(path)) !== expected) failures.push(`Protected runtime hash drifted: ${path}`);
  }
}

function verifyInfrastructureHashes(governance, failures) {
  const entries = [
    [governance.infrastructureEvidence.contractPath, governance.infrastructureEvidence.contractSha256],
    [governance.infrastructureEvidence.documentationPath, governance.infrastructureEvidence.documentationSha256],
    [governance.infrastructureEvidence.secretCheckPath, governance.infrastructureEvidence.secretCheckSha256],
    [governance.infrastructureEvidence.architectureVerifierPath, governance.infrastructureEvidence.architectureVerifierSha256],
    [governance.infrastructureEvidence.testPath, governance.infrastructureEvidence.testSha256]
  ];
  for (const [path, expected] of entries) {
    if (sha256(read(path)) !== expected) failures.push(`Infrastructure evidence hash drifted: ${path}`);
  }
}

function verifyNameOnlyOutput(failures) {
  const synthetic = ["never", "print", "this", "credential"].join("-");
  const result = spawnSync(process.execPath, ["scripts/check-cloudflare-unattended-secret-presence.mjs"], {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH || "",
      HOME: process.env.HOME || "",
      CLOUDFLARE_API_TOKEN: synthetic,
      CLOUDFLARE_ACCOUNT_ID: synthetic,
      CLOUDFLARE_ACCESS_CLIENT_ID: synthetic,
      CLOUDFLARE_ACCESS_CLIENT_SECRET: synthetic
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  if (result.status !== 0) failures.push("Name-only presence subprocess failed.");
  if (output.includes(synthetic)) failures.push("Name-only presence subprocess exposed a credential value.");
  for (const name of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_ACCESS_CLIENT_ID", "CLOUDFLARE_ACCESS_CLIENT_SECRET"]) {
    if (!output.includes(`${name}: PRESENT`)) failures.push(`Name-only presence output omitted ${name}.`);
  }
}

export function verifyOverwatchCloudflareUnattendedAccess() {
  const infrastructure = readJson(infrastructurePath);
  const governance = readJson(governancePath);
  const report = readJson(reportPath);
  const registry = readJson(registryPath);
  const evaluation = evaluateCloudflareUnattendedAccessGovernance({ infrastructure, governance, report });
  const failures = [...evaluation.failures];

  verifyInfrastructureHashes(governance, failures);
  verifyProtectedRuntimeHashes(governance, failures);
  verifyNameOnlyOutput(failures);

  for (const finding of scanTrackedRepository({ root })) {
    failures.push(`Tracked secret finding: ${finding.path}:${finding.line} ${finding.kind}`);
  }
  failures.push(...verifyLocalSecretArtifacts({ root }).map(failure => `Local secret artifact protection: ${failure}`));

  const registration = registry.governanceArtifacts?.find(item => item.artifactId === governance.governanceId);
  if (!registration) failures.push("Cloudflare unattended access governance is not registered.");
  else {
    if (registration.ownerSubsystem !== "Prometheus Overwatch") failures.push("Governance registry owner drifted.");
    if (registration.path !== governancePath) failures.push("Governance registry path drifted.");
    if (registration.productionConsumer !== false) failures.push("Governance registry must remain non-production.");
    if (JSON.stringify(registration.writeAllowed) !== JSON.stringify(["Prometheus Overwatch"])) failures.push("Governance writes must remain Overwatch-only.");
  }

  const packageJson = readJson("package.json");
  if (!packageJson.scripts["overwatch:cloudflare-unattended-access:check"]?.includes("verify-overwatch-cloudflare-unattended-access.mjs")) {
    failures.push("Overwatch package verification command is missing.");
  }
  if (!packageJson.scripts.test.includes("overwatch:cloudflare-unattended-access:check")) {
    failures.push("Full repository test does not include Overwatch unattended access verification.");
  }

  if (failures.length) throw new Error(failures.join("\n"));
  return Object.freeze({
    status: "PASS",
    batchId: governance.batchId,
    implementationOwner: governance.dispatchAudit.implementationOwner,
    verificationOwner: governance.dispatchAudit.verificationOwner,
    setupStatus: governance.deploymentBoundary.setupStatus,
    deploymentCredentialNames: infrastructure.deploymentCredential.environmentNames,
    smokeCredentialNames: infrastructure.smokeCredential.environmentNames,
    repositorySecretFindings: 0,
    unattendedDeploymentReady: false,
    unattendedSmokeReady: false,
    deploymentAuthorized: false,
    deploymentPerformed: false,
    cloudflareAccessPerformed: false,
    productionMutationPerformed: false,
    prospectiveCollection: governance.deploymentBoundary.prospectiveCollection,
    recommendationInfluence: governance.deploymentBoundary.recommendationInfluence
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    console.log(JSON.stringify(verifyOverwatchCloudflareUnattendedAccess(), null, 2));
  } catch (error) {
    console.error(`Overwatch Cloudflare unattended access verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
