import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createEmptyRouteQueue } from "../intelligence/continuous-adaptive-route-replenishment.mjs";
import {
  buildRouteBusinessHoursIndex,
  isCanonicalRouteBusinessHoursEligibility
} from "../intelligence/route-business-hours-eligibility.mjs";
import {
  routeIqGovernedRuntimeAuthorizations,
  routeIqGovernedBusinessAdmissionVersion,
  routeIqGovernedRuntimeScopeVersion
} from "../intelligence/route-iq-governed-runtime-scope.mjs";

const readJson = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const fixture = readJson("intelligence/fixtures/route-iq-governed-customer-business-hours-v1.json");
const hoursContract = readJson("intelligence/contracts/route-business-hours-eligibility-contracts.json");
const replenishmentContract = readJson("intelligence/contracts/continuous-adaptive-route-replenishment-contracts.json");
const runtimeScopeSource = readFileSync(
  new URL("../intelligence/route-iq-governed-runtime-scope.mjs", import.meta.url),
  "utf8"
);
const browserSafeValidatorSource = readFileSync(
  new URL("../administration/contracts/route-iq-workspace-configuration-v2-validation.mjs", import.meta.url),
  "utf8"
);

assert.equal(hoursContract.governedRuntimeScope.version, routeIqGovernedRuntimeScopeVersion);
assert.equal(hoursContract.governedRuntimeScope.requiredAdmissionVersion, routeIqGovernedBusinessAdmissionVersion);
assert.equal(replenishmentContract.workspacePolicy.runtimeScopeVersion, routeIqGovernedRuntimeScopeVersion);
assert.equal(replenishmentContract.workspacePolicy.businessAdmissionVersion, routeIqGovernedBusinessAdmissionVersion);
assert.deepEqual(
  [...hoursContract.governedRuntimeScope.requiredAuthorizations].sort(),
  Object.values(routeIqGovernedRuntimeAuthorizations).sort()
);
assert.equal(hoursContract.governedRuntimeScope.callerAuthorizationClaimsAccepted, false);
assert.equal(replenishmentContract.workspacePolicy.callerAuthorizationClaimsAccepted, false);
assert.match(
  runtimeScopeSource,
  /from "\.\.\/administration\/contracts\/route-iq-workspace-configuration-v2-validation\.mjs";/u
);
assert.doesNotMatch(
  runtimeScopeSource,
  /from "\.\.\/administration\/contracts\/route-iq-workspace-configuration-v2\.mjs";/u
);
assert.doesNotMatch(runtimeScopeSource, /["']node:/u);
assert.doesNotMatch(browserSafeValidatorSource, /["']node:/u);
assert.equal(hoursContract.compatibility.legacyRuntimeVersionAccepted, false);
assert.equal(isCanonicalRouteBusinessHoursEligibility({
  version: hoursContract.compatibility.supersedesRuntimeVersion,
  coverageEligible: true,
  immediateRecommendationEligible: true
}), false);

const index = buildRouteBusinessHoursIndex(fixture);
assert.equal(index.workspaceId, fixture.workspaceId);
assert.equal(index.operatingProfileId, fixture.operatingProfileId);
assert.throws(() => createEmptyRouteQueue({
  workspaceId: fixture.workspaceId,
  operatingProfileId: fixture.operatingProfileId,
  representativeId: "northstar_rep_001",
  governedRuntimeScope: index.governedRuntimeScope
}), /canonical approved-business manifest/);
assert.throws(() => createEmptyRouteQueue({
  workspaceId: "unregistered_workspace",
  operatingProfileId: "unregistered_profile",
  representativeId: "northstar_rep_001"
}), /scope is missing or unauthenticated/);

console.log("Route IQ governed customer runtime scope Intelligence verification passed.");
