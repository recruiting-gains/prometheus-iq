import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  scanTrackedRepository,
  verifyLocalSecretArtifacts
} from "./check-cloudflare-unattended-secret-presence.mjs";
import {
  CLOUDFLARE_UNATTENDED_LAUNCH_PROFILES
} from "./lib/cloudflare-unattended-launcher.mjs";
import {
  CLOUDFLARE_UNATTENDED_SMOKE_ALLOWED_METHODS,
  CLOUDFLARE_UNATTENDED_SMOKE_ALLOWED_PATHS,
  CLOUDFLARE_UNATTENDED_SMOKE_ENV,
  CLOUDFLARE_UNATTENDED_SMOKE_MARKER,
  CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN
} from "../workers/infrastructure/cloudflare-unattended-smoke-contract.js";
import {
  fixedCloudflareUnattendedSmokePlan
} from "./run-cloudflare-unattended-smoke.mjs";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));

export function verifyCloudflareUnattendedRuntimeGuard() {
  const contract = readJson("workers/infrastructure/cloudflare-unattended-deployment-access-v1.json");
  const worker = read("workers/prometheus-iq-worker.js");
  const guard = read("workers/infrastructure/cloudflare-unattended-smoke-guard.js");
  const smokeClient = read("scripts/run-cloudflare-unattended-smoke.mjs");
  const control = read("scripts/lib/cloudflare-unattended-control.mjs");
  const launcher = read("scripts/lib/cloudflare-unattended-launcher.mjs");
  const documentation = read("docs/cloudflare-unattended-deployment-access-v1.md");
  const authenticatedDocumentation = read("docs/authenticated-production-verification-access.md");
  const wrangler = read("wrangler.jsonc");
  const publicWrangler = read("wrangler.prometheusrouteiq-website.jsonc");
  const packageJson = readJson("package.json");

  assert.equal(contract.batchId, "BATCH-20260714-006");
  assert.equal(contract.owner, "Prometheus Infrastructure");
  assert.equal(contract.setupStatus, "NOT_CONFIGURED");
  assert.equal(contract.unattendedDeploymentReady, false);
  assert.equal(contract.unattendedSmokeReady, false);
  assert.equal(contract.deploymentAuthorized, false);
  assert.equal(contract.deploymentPerformed, false);
  assert.equal(contract.cloudflareAccessPerformed, false);
  assert.equal(contract.productionMutationPerformed, false);

  const guardContract = contract.servicePrincipalReadOnlyGuard;
  assert.equal(guardContract.status, "IMPLEMENTED_SOURCE_NOT_DEPLOYED_NOT_CONFIGURED");
  assert.equal(guardContract.sourceImplemented, true);
  assert.equal(guardContract.productionConfigured, false);
  assert.equal(guardContract.productionDeployed, false);
  assert.equal(guardContract.privateWorkerRunsFirstForAllRequestsInSource, true);
  assert.match(wrangler, /"run_worker_first": true/u);
  assert.match(publicWrangler, /"run_worker_first": \[\s*"\/api\/\*"\s*\]/u);
  assert.deepEqual(guardContract.allowedMethods, CLOUDFLARE_UNATTENDED_SMOKE_ALLOWED_METHODS);
  assert.deepEqual(guardContract.allowedPaths, CLOUDFLARE_UNATTENDED_SMOKE_ALLOWED_PATHS);
  assert.deepEqual(guardContract.runtimeConfigurationNames, Object.values(CLOUDFLARE_UNATTENDED_SMOKE_ENV));
  assert.equal(guardContract.requestMarker.header, CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestHeader);
  assert.equal(guardContract.requestMarker.value, CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestValue);
  assert.equal(guardContract.verifiedResponseMarker.header, CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseHeader);
  assert.equal(guardContract.verifiedResponseMarker.value, CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseValue);
  assert.equal(guardContract.authentication.algorithm, "RS256");
  assert.equal(guardContract.authentication.signatureRequired, true);
  assert.equal(guardContract.authentication.serviceTokenSub, "");
  assert.equal(guardContract.authentication.serviceTokenCommonNameMustEqualConfiguredClientId, true);
  assert.equal(guardContract.authentication.headerPresenceAloneAccepted, false);

  assert.match(worker, /authorizeCloudflareUnattendedSmokeRequest/u);
  assert.match(worker, /markCloudflareUnattendedSmokeResponse/u);
  assert.match(guard, /createRemoteJWKSet/u);
  assert.match(guard, /jwtVerify/u);
  assert.match(guard, /requiredClaims: \["sub", "common_name", "iat", "exp"\]/u);
  assert.match(guard, /algorithms: \["RS256"\]/u);
  assert.match(guard, /payload\.sub !== ""/u);
  assert.match(guard, /payload\.common_name !== configuration\.serviceTokenClientId/u);

  assert.equal(contract.defaultDenySmokeClient.productionOrigin, CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN);
  assert.equal(contract.defaultDenySmokeClient.arbitraryUrlAllowed, false);
  assert.equal(contract.defaultDenySmokeClient.arbitraryMethodAllowed, false);
  assert.equal(contract.defaultDenySmokeClient.requestBodiesAllowed, false);
  assert.equal(contract.defaultDenySmokeClient.cookiesAllowed, false);
  assert.equal(contract.defaultDenySmokeClient.redirectMode, "manual");
  assert.equal(contract.defaultDenySmokeClient.credentialsMode, "omit");
  assert.equal(contract.defaultDenySmokeClient.productionNetworkAccessPerformedByThisBatch, false);
  assert.equal(fixedCloudflareUnattendedSmokePlan().length, CLOUDFLARE_UNATTENDED_SMOKE_ALLOWED_PATHS.length + 1);
  assert.match(smokeClient, /redirect: "manual"/u);
  assert.match(smokeClient, /credentials: "omit"/u);
  assert.doesNotMatch(smokeClient, /WebSocket|serviceWorker|document\.cookie/u);

  assert.deepEqual(contract.auditedKeychainLauncher.fixedProfiles, CLOUDFLARE_UNATTENDED_LAUNCH_PROFILES);
  assert.equal(contract.auditedKeychainLauncher.arbitraryCommandAllowed, false);
  assert.equal(contract.auditedKeychainLauncher.pinnedWranglerModule, "node_modules/wrangler/bin/wrangler.js");
  assert.equal(contract.auditedKeychainLauncher.nodeOptionsAllowed, false);
  assert.equal(contract.auditedKeychainLauncher.presenceChecksReadValues, false);
  assert.equal(contract.auditedKeychainLauncher.checkOnlyConsumesNonce, false);
  assert.equal(contract.auditedKeychainLauncher.launchConsumesNonceBeforeChild, true);
  assert.equal(contract.auditedKeychainLauncher.credentialValuesPassedInArguments, false);
  assert.equal(contract.auditedKeychainLauncher.credentialValuesIncludedInAuditOutput, false);
  assert.equal(contract.auditedKeychainLauncher.publicWorkerCommandAvailable, false);
  assert.match(launcher, /"\/usr\/bin\/security"/u);
  assert.match(launcher, /node_modules\/wrangler\/bin\/wrangler\.js/u);
  assert.match(launcher, /stdio: "ignore"/u);
  assert.doesNotMatch(launcher, /shell:\s*true|\beval\(|new Function/u);

  assert.equal(contract.founderDeploymentControl.regularFileRequired, true);
  assert.equal(contract.founderDeploymentControl.symlinkAllowed, false);
  assert.equal(contract.founderDeploymentControl.currentUserOwnershipRequired, true);
  assert.equal(contract.founderDeploymentControl.strictJsonShapeRequired, true);
  assert.equal(contract.founderDeploymentControl.requiredFileMode, "0600");
  assert.equal(contract.founderDeploymentControl.exactRepositoryCommitAndTreeRequired, true);
  assert.equal(contract.founderDeploymentControl.exactDirectiveMatchRequired, true);
  assert.equal(
    contract.founderDeploymentControl.founderDirectiveEnvironmentName,
    "PROMETHEUS_FOUNDER_DEPLOYMENT_DIRECTIVE_ID"
  );
  assert.equal(contract.founderDeploymentControl.atomicConsumptionRequired, true);
  assert.match(control, /O_NOFOLLOW/u);
  assert.match(control, /O_EXCL/u);
  assert.match(control, /nonce_already_consumed/u);

  for (const name of Object.values(CLOUDFLARE_UNATTENDED_SMOKE_ENV)) {
    assert.equal(wrangler.includes(name), false, `${name} must not be configured in private Wrangler source`);
    assert.equal(publicWrangler.includes(name), false, `${name} must not enter the public Worker`);
  }
  assert.equal(publicWrangler.includes("cloudflare-unattended-smoke-guard"), false);
  assert.equal(contract.runtimeBoundaries.productionDeploymentAuthorized, false);
  assert.equal(contract.runtimeBoundaries.accessPolicyChangeAuthorized, false);
  assert.equal(contract.runtimeBoundaries.tokenCreationAuthorized, false);
  assert.equal(contract.runtimeBoundaries.secretCreationAuthorized, false);
  assert.equal(contract.runtimeBoundaries.productionMutationAuthorized, false);
  assert.equal(contract.runtimeBoundaries.recommendationInfluence, "OFF");
  assert.equal(contract.runtimeBoundaries.cohortActivation, "OFF");
  assert.equal(contract.runtimeBoundaries.prospectiveCollection, "OFF");

  assert.equal(
    packageJson.scripts["infrastructure:cloudflare-unattended-runtime-guard:check"],
    "node scripts/verify-cloudflare-unattended-runtime-guard.mjs && node --test tests/cloudflare-unattended-runtime-guard.test.mjs"
  );
  for (const required of [
    "IMPLEMENTED_SOURCE_NOT_DEPLOYED_NOT_CONFIGURED",
    "Cloudflare's JWKS",
    "empty `sub`",
    "default-deny fixed-origin smoke client",
    "assets.run_worker_first` to `true`",
    "marker alone never authorizes",
    "exact mode `0600`",
    "exclusive `0600` consumed marker",
    "no Access policy or production Worker change is authorized"
  ]) {
    assert.ok(documentation.includes(required), `documentation missing ${required}`);
  }
  assert.match(authenticatedDocumentation, /Neither is configured or deployed/u);
  for (const link of [
    contract.officialDocumentation.accessApplicationToken,
    contract.officialDocumentation.accessJwtValidation,
    contract.officialDocumentation.accessServiceTokens
  ]) {
    assert.match(link, /^https:\/\/developers\.cloudflare\.com\//u);
    assert.ok(documentation.includes(link));
  }

  assert.deepEqual(scanTrackedRepository({ root }), []);
  assert.deepEqual(verifyLocalSecretArtifacts({ root }), []);
  return Object.freeze({
    status: "passed",
    batchId: contract.batchId,
    owner: contract.owner,
    setupStatus: contract.setupStatus,
    guardStatus: guardContract.status,
    fixedSmokeRequestCount: fixedCloudflareUnattendedSmokePlan().length,
    launcherProfiles: CLOUDFLARE_UNATTENDED_LAUNCH_PROFILES,
    productionAccessPerformed: false,
    deploymentPerformed: false,
    productionMutationPerformed: false,
    recommendationInfluence: contract.runtimeBoundaries.recommendationInfluence
  });
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    console.log(JSON.stringify(verifyCloudflareUnattendedRuntimeGuard(), null, 2));
  } catch (error) {
    console.error(`Cloudflare unattended runtime guard verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
