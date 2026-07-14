import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  ENVIRONMENT_CREDENTIAL_NAMES,
  KEYCHAIN_ITEMS,
  scanTrackedRepository,
  verifyLocalSecretArtifacts
} from "./check-cloudflare-unattended-secret-presence.mjs";

const root = resolve(import.meta.dirname, "..");
const contractPath = "workers/infrastructure/cloudflare-unattended-deployment-access-v1.json";
const documentationPath = "docs/cloudflare-unattended-deployment-access-v1.md";
const authenticatedVerificationPath = "docs/authenticated-production-verification-access.md";

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

export function validateFounderControl(control, {
  now = new Date(),
  consumedNonces = new Set(),
  expectedCommit,
  expectedTree
} = {}) {
  const reasons = [];
  const required = [
    "schemaVersion",
    "enabled",
    "targetWorker",
    "environment",
    "authorizedCommit",
    "authorizedTree",
    "founderDirectiveId",
    "issuedAt",
    "expiresAt",
    "oneShotAuthorizationNonce"
  ];
  if (!control || typeof control !== "object" || Array.isArray(control)) {
    return Object.freeze({ valid: false, reasons: Object.freeze(["control_missing_or_invalid"]) });
  }
  for (const field of required) {
    if (!Object.hasOwn(control, field)) reasons.push(`missing_${field}`);
  }
  if (control.schemaVersion !== "cloudflare-unattended-deployment-control-v1") reasons.push("invalid_schema");
  if (control.enabled !== true) reasons.push("control_off");
  if (control.targetWorker !== "prometheus-iq") reasons.push("wrong_target");
  if (control.environment !== "production_private") reasons.push("wrong_environment");
  if (!/^[0-9a-f]{40}$/u.test(control.authorizedCommit || "")) reasons.push("invalid_commit");
  if (!/^[0-9a-f]{40}$/u.test(control.authorizedTree || "")) reasons.push("invalid_tree");
  if (expectedCommit && control.authorizedCommit !== expectedCommit) reasons.push("commit_mismatch");
  if (expectedTree && control.authorizedTree !== expectedTree) reasons.push("tree_mismatch");
  if (!/^FOUNDER-[A-Z0-9-]{6,}$/u.test(control.founderDirectiveId || "")) reasons.push("invalid_founder_directive");
  if (!/^[A-Za-z0-9_-]{24,128}$/u.test(control.oneShotAuthorizationNonce || "")) reasons.push("invalid_nonce");
  if (consumedNonces.has(control.oneShotAuthorizationNonce)) reasons.push("nonce_already_consumed");

  const issuedAt = Date.parse(control.issuedAt);
  const expiresAt = Date.parse(control.expiresAt);
  const nowMs = now.getTime();
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) reasons.push("invalid_time");
  else {
    if (issuedAt > nowMs) reasons.push("not_yet_valid");
    if (expiresAt <= nowMs) reasons.push("expired");
    if (expiresAt <= issuedAt) reasons.push("invalid_time_order");
    if (expiresAt - issuedAt > 30 * 60 * 1000) reasons.push("authorization_window_too_long");
  }
  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze(reasons) });
}

export function verifyCloudflareUnattendedAccessArchitecture({ requireReady = false } = {}) {
  const contract = readJson(contractPath);
  const documentation = read(documentationPath);
  const authenticatedVerification = read(authenticatedVerificationPath);
  const packageJson = readJson("package.json");
  const gitignore = read(".gitignore");
  const securityCheck = read("scripts/security-check.mjs");
  const wrangler = read("wrangler.jsonc");

  assert.equal(contract.contractVersion, "cloudflare-unattended-deployment-access-v1");
  assert.equal(contract.batchId, "BATCH-20260714-005");
  assert.equal(contract.owner, "Prometheus Infrastructure");
  assert.equal(contract.setupStatus, "NOT_CONFIGURED");
  assert.equal(contract.unattendedDeploymentReady, false);
  assert.equal(contract.unattendedSmokeReady, false);
  assert.equal(contract.deploymentAuthorized, false);
  assert.equal(contract.deploymentPerformed, false);
  assert.equal(contract.cloudflareAccessPerformed, false);
  assert.equal(contract.productionMutationPerformed, false);

  assert.equal(contract.target.privateWorker, "prometheus-iq");
  assert.equal(contract.target.publicWorker, "prometheusrouteiq-website");
  assert.equal(contract.target.publicWorkerAllowed, false);
  assert.equal(contract.credentialSeparation.sharedCredentialAllowed, false);
  assert.deepEqual(contract.credentialSeparation.prohibitedCredentials, [
    "cloudflare_username",
    "cloudflare_password",
    "browser_session_cookie",
    "mfa_code",
    "global_api_key"
  ]);

  assert.deepEqual(contract.deploymentCredential.environmentNames, ENVIRONMENT_CREDENTIAL_NAMES.slice(0, 2));
  assert.deepEqual(contract.deploymentCredential.permissions, [
    "Account Settings Read",
    "Workers Scripts Edit"
  ]);
  for (const denied of [
    "Access Apps and Policies Write",
    "Workers KV Storage Edit",
    "Workers R2 Storage Edit",
    "DNS Edit",
    "Workers Routes Edit",
    "API Tokens Edit",
    "Secrets Store Edit",
    "User permissions",
    "Global permissions"
  ]) {
    assert.ok(contract.deploymentCredential.explicitlyDeniedPermissions.includes(denied), `${denied} must be denied`);
  }
  assert.equal(contract.deploymentCredential.resourceScope.include, "exact_account_only");
  assert.equal(contract.deploymentCredential.resourceScope.zoneResourcesGranted, false);
  assert.equal(contract.deploymentCredential.permissionExpansionPolicy, "STOP_AND_RETURN_FOUNDER_REVIEW_REQUIRED");
  assert.equal(contract.deploymentCredential.lifetime.recommendedDays, 30);
  assert.equal(contract.deploymentCredential.lifetime.maximumDays, 90);

  assert.deepEqual(contract.smokeCredential.environmentNames, ENVIRONMENT_CREDENTIAL_NAMES.slice(2));
  assert.equal(contract.smokeCredential.policy.action, "Service Auth");
  assert.equal(contract.smokeCredential.policy.include, "exact_service_token_only");
  assert.equal(contract.smokeCredential.policy.anyServiceTokenAllowed, false);
  assert.equal(contract.smokeCredential.policy.policyChangeAuthorizedByThisBatch, false);
  assert.equal(contract.smokeCredential.httpReadOnlyGuaranteeProvidedByAccess, false);
  assert.deepEqual(contract.localStorage.keychainItems, KEYCHAIN_ITEMS);
  assert.equal(contract.localStorage.injection, "future_audited_child_process_only");
  for (const prohibited of ["Git", ".env", ".dev.vars", "shell_history", "command_line_arguments", "logs", "reports", "screenshots"]) {
    assert.ok(contract.localStorage.prohibitedStorage.includes(prohibited));
  }

  assert.equal(contract.founderDeploymentControl.defaultState, "OFF");
  assert.equal(contract.founderDeploymentControl.requiredFileMode, "0600");
  assert.equal(contract.founderDeploymentControl.maximumLifetimeMinutes, 30);
  assert.equal(contract.founderDeploymentControl.exactTargetWorker, "prometheus-iq");
  assert.equal(contract.founderDeploymentControl.oneShot, true);
  assert.equal(contract.founderDeploymentControl.atomicConsumptionRequired, true);
  assert.equal(contract.founderDeploymentControl.authorizesDeploymentByItself, false);
  assert.equal(contract.founderDeploymentControl.founderDirectiveStillRequired, true);
  assert.equal(contract.deploymentGates.automaticEngineeringPushIsDeploymentAuthorization, false);

  assert.equal(contract.servicePrincipalReadOnlyGuard.status, "NOT_IMPLEMENTED_NOT_AUTHORIZED");
  assert.equal(contract.servicePrincipalReadOnlyGuard.requiredBeforeUnattendedSmoke, true);
  assert.deepEqual(contract.servicePrincipalReadOnlyGuard.allowedMethods, ["GET", "HEAD"]);
  assert.ok(contract.servicePrincipalReadOnlyGuard.allowedPaths.length >= 10);
  assert.ok(contract.servicePrincipalReadOnlyGuard.allowedPaths.every(path => path.startsWith("/")));
  assert.equal(new Set(contract.servicePrincipalReadOnlyGuard.allowedPaths).size, contract.servicePrincipalReadOnlyGuard.allowedPaths.length);
  assert.equal(contract.servicePrincipalReadOnlyGuard.allOtherMethodsAndPaths, "DENY");
  assert.equal(contract.servicePrincipalReadOnlyGuard.defaultDenySmokeClientRequired, true);
  assert.equal(contract.servicePrincipalReadOnlyGuard.writeAttemptCountRequired, 0);

  for (const denied of [
    "token_management",
    "access_policy_management",
    "secret_management",
    "public_worker_deployment",
    "production_data_write",
    "cohort_activation",
    "prospective_collection_activation",
    "recommendation_influence_activation",
    "log_tail_or_data_bearing_log_read",
    "arbitrary_HTTP_request"
  ]) {
    assert.ok(contract.unattendedActions.denied.includes(denied), `${denied} must be denied`);
  }

  assert.equal(contract.runtimeBoundaries.productionDeploymentAuthorized, false);
  assert.equal(contract.runtimeBoundaries.accessPolicyChangeAuthorized, false);
  assert.equal(contract.runtimeBoundaries.tokenCreationAuthorized, false);
  assert.equal(contract.runtimeBoundaries.secretCreationAuthorized, false);
  assert.equal(contract.runtimeBoundaries.productionMutationAuthorized, false);
  assert.equal(contract.runtimeBoundaries.recommendationInfluence, "OFF");
  assert.equal(contract.runtimeBoundaries.cohortActivation, "OFF");
  assert.equal(contract.runtimeBoundaries.prospectiveCollection, "OFF");
  if (requireReady) {
    assert.equal(contract.setupStatus, "CONFIGURED_VERIFIED");
    assert.equal(contract.unattendedDeploymentReady, true);
    assert.equal(contract.unattendedSmokeReady, true);
    assert.equal(contract.servicePrincipalReadOnlyGuard.status, "IMPLEMENTED_VERIFIED");
  }

  for (const link of Object.values(contract.officialDocumentation)) {
    assert.match(link, /^https:\/\/developers\.cloudflare\.com\//u);
    assert.ok(documentation.includes(link));
  }
  for (const requiredText of [
    "NOT_CONFIGURED",
    "Unattended deployment ready: `false`",
    "Unattended smoke ready: `false`",
    "Account Settings Read",
    "Workers Scripts Edit",
    "Service Auth",
    "does not make the resulting HTTP session read-only",
    "FOUNDER_REVIEW_REQUIRED",
    "mode `0600`",
    "Automatic engineering push and production deployment remain separate decisions",
    "Rotation and Revocation Checklist"
  ]) {
    assert.ok(documentation.includes(requiredText), `documentation missing ${requiredText}`);
  }
  assert.match(authenticatedVerification, /prohibited for unattended operation/u);
  assert.match(authenticatedVerification, /Do not pass cookies as command-line arguments/u);
  assert.match(authenticatedVerification, /server-side guard enforces `GET`\/`HEAD`/u);

  assert.equal(
    packageJson.scripts["infrastructure:cloudflare-unattended-access:check"],
    "node scripts/verify-cloudflare-unattended-access-architecture.mjs && node scripts/check-cloudflare-unattended-secret-presence.mjs && node --test tests/cloudflare-unattended-access-architecture.test.mjs"
  );
  assert.equal(
    packageJson.scripts["infrastructure:cloudflare-unattended-access:preflight"],
    "node scripts/verify-cloudflare-unattended-access-architecture.mjs --require-ready && node scripts/check-cloudflare-unattended-secret-presence.mjs --source=both --require-present"
  );
  assert.ok(packageJson.scripts.test.includes("npm run infrastructure:cloudflare-unattended-access:check"));
  assert.match(securityCheck, /scanTrackedRepository/u);
  assert.match(securityCheck, /verifyLocalSecretArtifacts/u);

  for (const ignored of [
    ".cloudflare-unattended/",
    ".cloudflare-unattended-control*.json",
    ".cloudflare-unattended-credentials*",
    "cloudflare-unattended-deployment-control*.json",
    "cloudflare-api-token*",
    "cloudflare-access-service-token*"
  ]) {
    assert.ok(gitignore.includes(ignored), `.gitignore missing ${ignored}`);
  }
  assert.equal(scanTrackedRepository({ root }).length, 0);
  assert.deepEqual(verifyLocalSecretArtifacts({ root }), []);
  for (const credentialName of ENVIRONMENT_CREDENTIAL_NAMES) {
    assert.equal(wrangler.includes(credentialName), false, `${credentialName} must not enter wrangler.jsonc`);
  }

  const syntheticControl = {
    schemaVersion: "cloudflare-unattended-deployment-control-v1",
    enabled: true,
    targetWorker: "prometheus-iq",
    environment: "production_private",
    authorizedCommit: "a".repeat(40),
    authorizedTree: "b".repeat(40),
    founderDirectiveId: "FOUNDER-DEPLOY-0001",
    issuedAt: "2026-07-14T12:00:00.000Z",
    expiresAt: "2026-07-14T12:15:00.000Z",
    oneShotAuthorizationNonce: "synthetic-nonce-000000000001"
  };
  assert.equal(validateFounderControl(syntheticControl, {
    now: new Date("2026-07-14T12:05:00.000Z"),
    expectedCommit: syntheticControl.authorizedCommit,
    expectedTree: syntheticControl.authorizedTree
  }).valid, true);

  return Object.freeze({
    status: "passed",
    batchId: contract.batchId,
    owner: contract.owner,
    setupStatus: contract.setupStatus,
    unattendedDeploymentReady: contract.unattendedDeploymentReady,
    unattendedSmokeReady: contract.unattendedSmokeReady,
    deploymentAuthorized: contract.deploymentAuthorized,
    deploymentPerformed: contract.deploymentPerformed,
    privateWorker: contract.target.privateWorker,
    publicWorkerAllowed: contract.target.publicWorkerAllowed,
    repositorySecretFindings: 0,
    recommendationInfluence: contract.runtimeBoundaries.recommendationInfluence,
    prospectiveCollection: contract.runtimeBoundaries.prospectiveCollection
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== "--require-ready")) throw new Error(`Unknown argument: ${args.join(" ")}`);
    console.log(JSON.stringify(verifyCloudflareUnattendedAccessArchitecture({
      requireReady: args.includes("--require-ready")
    }), null, 2));
  } catch (error) {
    console.error(`Cloudflare unattended access architecture verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
