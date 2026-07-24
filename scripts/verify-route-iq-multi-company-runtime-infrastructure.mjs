import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const contractPath = "workers/infrastructure/route-iq-72-hour-onboarding-runtime-v1.json";
const runtimePath = "workers/infrastructure/route-iq-august-1-customer-pwa-runtime.js";
const authorizationPath = "workers/infrastructure/route-iq-multi-company-runtime-authorization.js";
const onboardingPath = "workers/infrastructure/route-iq-72-hour-onboarding-runtime.js";
const documentationPath = "docs/route-iq-multi-company-runtime-infrastructure-v1.md";

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

const contract = JSON.parse(read(contractPath));
const runtime = read(runtimePath);
const authorization = read(authorizationPath);
const onboarding = read(onboardingPath);
const documentation = read(documentationPath);

assert.equal(contract.ownerSubsystem, "Prometheus Infrastructure");
assert.equal(contract.targetWorker, "prometheus-iq");
assert.equal(contract.deploymentAuthorized, false);
assert.deepEqual(contract.runtimeAssetKeys, [
  "workspaceConfiguration",
  "businessManifestRegistry",
  "businessRoster",
  "businessHours"
]);
assert.equal(contract.workspaceSelection.authorizationOwner, "Prometheus Data");
assert.equal(contract.workspaceSelection.infrastructureMayConstructAllowlist, false);
assert.equal(contract.workspaceSelection.displayNameAuthorizationAllowed, false);
assert.equal(contract.workspaceSelection.callerIdentifierAuthorizationAllowed, false);
assert.equal(contract.workspaceSelection.representativeEnumerationAllowed, false);
assert.equal(contract.workspaceSelection.sessionWorkspaceCount, 1);
assert.equal(contract.zipCoverageProjection.authority, "Prometheus Administration");
assert.equal(contract.zipCoverageProjection.missingInvalidDuplicateOrUnauthorized, "FAIL_CLOSED");
assert.deepEqual(contract.currentDataBoundary, { active: 0, reserve: 0, quarantine: 398 });
assert.equal(contract.safety.availabilityProviders, "OFF");
assert.equal(contract.safety.dailyScheduler, "OFF");
assert.equal(contract.safety.prospectiveCollection, "OFF");
assert.equal(contract.safety.activeCohorts, 0);
assert.equal(contract.safety.recommendationInfluence, "OFF");
assert.equal(contract.safety.anthonyMapped, false);
assert.equal(contract.safety.publicWorkerAffected, false);

assert.match(runtime, /authorizeRouteIqAugust1LaunchPrincipal/u);
assert.match(runtime, /requestedWorkspaceId/u);
assert.match(runtime, /dataAuthorizePrincipal/u);
assert.match(runtime, /principal\?\.workspaceId !== requestedWorkspaceId/u);
assert.match(runtime, /ROUTE_IQ_CUSTOMER_PWA_SESSION_RUNTIME_ASSET_KEYS/u);
assert.doesNotMatch(runtime, /authorizedWorkspaceIds/u);
assert.doesNotMatch(runtime, /displayName.*authorize/iu);
assert.match(authorization, /workspace\.territories/u);
assert.match(authorization, /territory\.zipCodes/u);
assert.match(authorization, /US_ZIP_CODE/u);
assert.match(authorization, /prometheus_administration_projected_by_infrastructure/u);
assert.match(onboarding, /seventyTwoHourStandardProven:\s*false/u);
assert.match(onboarding, /EXACT_390_X_844_MOBILE_ACCEPTANCE/u);
assert.match(documentation, /active `0`, reserve `0`, quarantine `398`/u);
assert.match(documentation, /providers and the scheduler remain OFF/u);

for (const source of [runtime, authorization, onboarding, documentation]) {
  assert.doesNotMatch(source, /cfut_|client[_-]?secret|authorization:\s*bearer/iu);
  assert.doesNotMatch(source, /smoothie[ _-]?depot/iu);
}

process.stdout.write(`${JSON.stringify({
  status: "PASS",
  owner: contract.ownerSubsystem,
  target: contract.targetWorker,
  sessionWorkspaceCount: contract.workspaceSelection.sessionWorkspaceCount,
  runtimeAssetCount: contract.runtimeAssetKeys.length,
  dataBoundary: contract.currentDataBoundary,
  providers: contract.safety.availabilityProviders,
  scheduler: contract.safety.dailyScheduler
}, null, 2)}\n`);
