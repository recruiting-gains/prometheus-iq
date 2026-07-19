import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import canonicalSnapshot from "../intelligence/artifacts/route-iq-commercial-readiness-v1/fitness_connection/founder-daily-intelligence-snapshot-v1.json" with { type: "json" };
import intelligenceContract from "../intelligence/contracts/route-iq-commercial-readiness-intelligence-v1.json" with { type: "json" };
import workspaceRegistry from "../data/route-iq-commercial-readiness-v1/route-iq-commercial-workspace-registry-v1.json" with { type: "json" };
import {
  ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV,
  ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_CONTRACT_VERSION,
  ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_PATH,
  ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_PRINCIPAL_ID,
  validateRouteIqFounderDailySnapshot
} from "../workers/prometheus-iq-worker.js";

const root = resolve(import.meta.dirname, "..");
const worker = readFileSync(resolve(root, "workers/prometheus-iq-worker.js"), "utf8");
const publicConfig = readFileSync(resolve(root, "wrangler.prometheusrouteiq-website.jsonc"), "utf8");
const privateConfig = readFileSync(resolve(root, "wrangler.jsonc"), "utf8");
const fitness = workspaceRegistry.workspaces.find(workspace => workspace.workspaceId === "fitness_connection");
const cruz = fitness.users.find(user => user.representativeId === "cruz");
const anthony = fitness.users.find(user => user.representativeId === "anthony");

assert.equal(ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_PATH, "/api/dashboard/route-iq/intelligence/daily-snapshot");
assert.equal(ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_CONTRACT_VERSION, "route-iq-commercial-readiness-intelligence-v1");
assert.match(canonicalSnapshot.businessConfigurationSha256, /^[a-f0-9]{64}$/u);
assert.equal(cruz.authenticatedPrincipalId, ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_PRINCIPAL_ID);
assert.equal(cruz.identityMappingStatus, "exact_authenticated_identity_mapped");
assert.equal(cruz.founderIntelligenceEligibility, true);
assert.equal(anthony.authenticatedPrincipalId, null);
assert.equal(anthony.identityMappingStatus, "pending_exact_authenticated_identity");
assert.equal(anthony.founderIntelligenceEligibility, true);
assert.deepEqual(intelligenceContract.founderAccess.authorizedMappings.map(mapping => mapping.immutablePrincipalId), [
  ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_PRINCIPAL_ID
]);
assert.equal(intelligenceContract.founderAccess.pendingMappings.find(mapping => mapping.person === "anthony").accessAllowed, false);
assert.equal(intelligenceContract.founderAccess.displayNameAuthorizationAllowed, false);
assert.equal(intelligenceContract.founderAccess.representativeAccessAllowed, false);
assert.equal(intelligenceContract.canonicalFounderSnapshot.stableArtifactPath,
  "intelligence/artifacts/route-iq-commercial-readiness-v1/fitness_connection/founder-daily-intelligence-snapshot-v1.json");
assert.equal(intelligenceContract.canonicalFounderSnapshot.infrastructureConsumptionMode,
  "authenticated_founder_only_read_only_static_artifact");
assert.deepEqual(await validateRouteIqFounderDailySnapshot(canonicalSnapshot), canonicalSnapshot);
assert.match(worker, /Cf-Access-Jwt-Assertion/u);
assert.match(worker, /jwtVerify/u);
assert.match(worker, /request\.method !== "GET"/u);
assert.match(worker, /"Cache-Control": "no-store"/u);
assert.equal(/shadowDecision|rankedCandidateIds|probabilities/iu.test(JSON.stringify(canonicalSnapshot)), false);
for (const name of Object.values(ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV)) {
  assert.equal(publicConfig.includes(name), false);
  assert.equal(privateConfig.includes(name), false);
}

console.log(JSON.stringify({
  ok: true,
  endpoint: ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_PATH,
  method: "GET",
  contractVersion: ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_CONTRACT_VERSION,
  canonicalSnapshotId: canonicalSnapshot.snapshotId,
  canonicalPrincipalCount: intelligenceContract.founderAccess.authorizedMappings.length,
  publicWorkerConfigured: false,
  privateWorkerConfigured: false,
  recommendationInfluence: canonicalSnapshot.safety.recommendationInfluence,
  representativeReadable: canonicalSnapshot.safety.representativeReadable,
  shadowOutputExposed: false
}, null, 2));
