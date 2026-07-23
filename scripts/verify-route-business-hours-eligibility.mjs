import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  routeBusinessHoursEligibilityVersion
} from "../intelligence/route-business-hours-eligibility.mjs";
import {
  routeIqGovernedBusinessAdmissionVersion
} from "../intelligence/route-iq-governed-runtime-scope.mjs";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));

const contract = readJson("intelligence/contracts/route-business-hours-eligibility-contracts.json");
const eligibilitySource = read("intelligence/route-business-hours-eligibility.mjs");
const scopeSource = read("intelligence/route-iq-governed-runtime-scope.mjs");
const administration = readJson("administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json");
const manifests = readJson("data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json");

assert.equal(routeBusinessHoursEligibilityVersion, "route-iq-closed-now-eligibility-v1");
assert.equal(routeIqGovernedBusinessAdmissionVersion, "route-iq-governed-business-admission-v2");
assert.equal(contract.version, "route-iq-closed-now-eligibility-contracts-v1");
assert.equal(contract.admissionVersion, routeIqGovernedBusinessAdmissionVersion);
assert.equal(contract.recommendationInfluence, "OFF");
assert.equal(contract.collection, "OFF");
assert.equal(contract.activeCohorts, 0);
assert.deepEqual(contract.configurationContract.supportedCanonicalWorkspaces, [
  "fitness_connection",
  "northstar_outside_sales_synthetic"
]);
assert.equal(contract.configurationContract.companyNameBranchingAllowed, false);
assert.equal(contract.configurationContract.demoOrFallbackCatalogAllowed, false);
assert.equal(contract.governedRuntimeScope.canonicalManifestAdmissionRequired, true);
assert.equal(contract.eligibilityPolicy.OPEN_VERIFIED.immediateRecommendationEligible, true);
assert.equal(contract.eligibilityPolicy.CLOSED_VERIFIED.immediateRecommendationEligible, false);
assert.equal(contract.eligibilityPolicy.HOURS_STALE.immediateRecommendationEligible, false);
assert.equal(contract.eligibilityPolicy.HOURS_UNKNOWN.immediateRecommendationEligible, false);
assert.equal(contract.eligibilityPolicy.SPECIAL_HOURS_UNVERIFIED.immediateRecommendationEligible, false);
assert.equal(contract.eligibilityPolicy.PROVIDER_FAILURE.immediateRecommendationEligible, false);
assert.equal(contract.eligibilityPolicy.INVALID.immediateRecommendationEligible, false);
assert.equal(contract.eligibilityPolicy.maximumFreshnessHours, 24);
assert.equal(contract.queuePolicy.persistedNowStaleRankOneRetained, false);
assert.equal(contract.presentationContract.visitDurationSeparate, true);
assert.equal(contract.safety.providerFailureMayPromoteStaleData, false);
assert.doesNotMatch(eligibilitySource, /\bfetch\s*\(/);
assert.match(scopeSource, /validateRouteIqWorkspaceConfigurationRegistry/);
assert.match(scopeSource, /sourceManifestConfigurationVersion/);
assert.match(scopeSource, /approvedRecordIds/);

const configuredScopes = administration.workspaces
  .map(workspace => `${workspace.workspaceId}:${workspace.operatingProfile.profileId}`)
  .sort();
const manifestedScopes = manifests.manifests
  .map(manifest => `${manifest.workspaceId}:${manifest.operatingProfileId}`)
  .sort();
assert.deepEqual(configuredScopes, manifestedScopes);

const focused = spawnSync(process.execPath, [
  "--test",
  "tests/route-business-hours-eligibility.test.mjs",
  "tests/route-iq-governed-runtime-scope-intelligence.test.mjs"
], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, NODE_OPTIONS: "" }
});
assert.equal(
  focused.status,
  0,
  `Route business-hours focused regression failed.\n${focused.stdout}\n${focused.stderr}`
);

console.log("Route IQ governed business-hours eligibility verification passed.");
