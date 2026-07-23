import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createEmptyRouteQueue } from "../intelligence/continuous-adaptive-route-replenishment.mjs";
import { buildRouteBusinessHoursIndex } from "../intelligence/route-business-hours-eligibility.mjs";
import {
  routeIqGovernedRuntimeAuthorizations,
  routeIqGovernedRuntimeScopeVersion
} from "../intelligence/route-iq-governed-runtime-scope.mjs";

const readJson = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const fixture = readJson("intelligence/fixtures/route-iq-governed-customer-business-hours-v1.json");
const hoursContract = readJson("intelligence/contracts/route-business-hours-eligibility-contracts.json");
const replenishmentContract = readJson("intelligence/contracts/continuous-adaptive-route-replenishment-contracts.json");

assert.equal(hoursContract.governedRuntimeScope.version, routeIqGovernedRuntimeScopeVersion);
assert.equal(replenishmentContract.workspacePolicy.runtimeScopeVersion, routeIqGovernedRuntimeScopeVersion);
assert.deepEqual(
  [...hoursContract.governedRuntimeScope.requiredAuthorizations].sort(),
  Object.values(routeIqGovernedRuntimeAuthorizations).sort()
);
assert.equal(hoursContract.governedRuntimeScope.callerAuthorizationClaimsAccepted, false);
assert.equal(replenishmentContract.workspacePolicy.callerAuthorizationClaimsAccepted, false);

const index = buildRouteBusinessHoursIndex(fixture);
assert.equal(index.workspaceId, fixture.workspaceId);
assert.equal(index.operatingProfileId, fixture.operatingProfileId);
assert.doesNotThrow(() => createEmptyRouteQueue({
  workspaceId: fixture.workspaceId,
  operatingProfileId: fixture.operatingProfileId,
  representativeId: "northstar_rep_001"
}));
assert.throws(() => createEmptyRouteQueue({
  workspaceId: "unregistered_workspace",
  operatingProfileId: "unregistered_profile",
  representativeId: "northstar_rep_001"
}), /scope is missing or unauthenticated/);

console.log("Route IQ governed customer runtime scope Intelligence verification passed.");
