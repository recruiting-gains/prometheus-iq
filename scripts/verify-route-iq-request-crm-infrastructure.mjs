import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { runRouteIqCommercialCapacityHarness } from "../workers/infrastructure/route-iq-commercial-capacity-harness.mjs";
import {
  ROUTE_IQ_REQUEST_CRM_BINDING,
  ROUTE_IQ_REQUEST_CRM_PATH
} from "../workers/infrastructure/route-iq-request-crm-runtime.js";

const root = resolve(import.meta.dirname, "..");
const contract = JSON.parse(readFileSync(resolve(root, "workers/infrastructure/route-iq-request-crm-runtime-v1.json"), "utf8"));
const worker = readFileSync(resolve(root, "workers/prometheus-iq-worker.js"), "utf8");
const privateConfig = readFileSync(resolve(root, "wrangler.jsonc"), "utf8");
const publicConfig = readFileSync(resolve(root, "wrangler.prometheusrouteiq-website.jsonc"), "utf8");

assert.equal(ROUTE_IQ_REQUEST_CRM_PATH, "/api/partner-intake");
assert.equal(contract.publicIntake.workspaceId, "prometheus_route_iq");
assert.equal(contract.publicIntake.operatingProfileId, "route_iq_commercial");
assert.equal(contract.publicIntake.legacyFitnessRoutingActive, false);
assert.equal(contract.publicIntake.legacySmoothieRoutingActive, false);
assert.equal(contract.storage.binding, ROUTE_IQ_REQUEST_CRM_BINDING);
assert.equal(contract.storage.kvCasClaimed, false);
assert.equal(contract.boundaries.prospectiveCollection, "OFF");
assert.equal(contract.boundaries.activeCohorts, 0);
assert.equal(contract.boundaries.recommendationInfluence, "OFF");
assert.match(worker, /handleRouteIqRequestCrmRuntimeRequest/u);
assert.match(worker, /RouteIqRequestCrmCoordinator/u);
assert.doesNotMatch(privateConfig, /ROUTE_IQ_REQUEST_CRM_COORDINATOR|route-iq-request-crm-sqlite-v1/u);
assert.match(publicConfig, /ROUTE_IQ_REQUEST_CRM_COORDINATOR/u);
assert.match(publicConfig, /route-iq-request-crm-sqlite-v1/u);

const capacity = await runRouteIqCommercialCapacityHarness();
assert.deepEqual(capacity.verifiedSafeInitialCapacity, {
  workspaceCount: 10,
  totalUsers: 100,
  concurrentUsers: 25
});
assert.equal(capacity.recordIntegrity.lostAcceptedRecords, 0);
assert.equal(capacity.recordIntegrity.duplicateAcceptedRecords, 0);
assert.equal(capacity.isolation.crossWorkspaceExposure, 0);
assert.equal(capacity.isolation.crossUserExposure, 0);
assert.equal(capacity.isolation.crossWorkspaceAuthorizationFailures, 0);
assert.equal(capacity.isolation.crossUserAuthorizationFailures, 0);

console.log(JSON.stringify({
  ok: true,
  verification: "route_iq_request_crm_infrastructure_v1",
  capacity
}, null, 2));
