import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const batchId = "BATCH-20260713-004";
const dataCommits = Object.freeze([
  "7970f240",
  "968212e",
  "ce9f642",
  "88b8490",
  "89e9ae46",
  "9b53a21",
  "b7896a6",
  "f4ecc7e"
]);
const intelligenceCommits = Object.freeze(["4e66667"]);

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

const paths = Object.freeze({
  worker: "workers/prometheus-iq-worker.js",
  contract: "workers/infrastructure/route-iq-prospective-shadow-contract.js",
  access: "workers/infrastructure/route-iq-prospective-shadow-access.js",
  authority: "workers/infrastructure/route-iq-prospective-shadow-authority.js",
  durableObject: "workers/infrastructure/route-iq-prospective-shadow-durable-object.js",
  orchestration: "workers/infrastructure/route-iq-prospective-shadow-orchestration.js",
  runtime: "workers/infrastructure/route-iq-prospective-shadow-runtime.js",
  privateConfig: "wrangler.jsonc",
  publicConfig: "wrangler.prometheusrouteiq-website.jsonc",
  test: "tests/route-iq-prospective-shadow-infrastructure.test.mjs",
  documentation: "docs/route-iq-prospective-shadow-infrastructure-v1.md"
});

for (const path of Object.values(paths)) {
  assert.equal(existsSync(resolve(root, path)), true, `${path} must exist`);
}

const worker = read(paths.worker);
const contract = read(paths.contract);
const access = read(paths.access);
const authority = read(paths.authority);
const durableObject = read(paths.durableObject);
const orchestration = read(paths.orchestration);
const runtime = read(paths.runtime);
const privateConfig = read(paths.privateConfig);
const publicConfig = read(paths.publicConfig);
const testSource = read(paths.test);
const documentation = read(paths.documentation);
const packageJson = JSON.parse(read("package.json"));

for (const commit of dataCommits) {
  git("rev-parse", "--verify", `${commit}^{commit}`);
  execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], { cwd: root });
}
for (const commit of intelligenceCommits) {
  git("rev-parse", "--verify", `${commit}^{commit}`);
  execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], { cwd: root });
}

assert.match(privateConfig, /"name": "ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR"/u);
assert.match(privateConfig, /"class_name": "RouteIqProspectiveShadowCoordinator"/u);
assert.equal((privateConfig.match(/"new_sqlite_classes"/gu) || []).length, 1);
assert.match(privateConfig, /"tag": "route-iq-prospective-shadow-sqlite-v1"/u);
assert.doesNotMatch(publicConfig, /ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR|RouteIqProspectiveShadowCoordinator/u);

assert.match(worker, /export \{\s*RouteIqProspectiveShadowCoordinator\s*\}/u);
assert.match(worker, /!getRouteIqProspectiveActivation\(env\)\.active/u);
assert.ok(
  worker.indexOf("!getRouteIqProspectiveActivation(env).active") < worker.indexOf("await enforceAegisControls(request, env)"),
  "OFF prospective handling must precede Aegis storage"
);
assert.match(worker, /isRouteIqProspectiveShadowPath/u);
assert.match(
  worker,
  /const result = await consumeRouteIqEndOfDayHandoff[\s\S]+scheduleRouteIqProspectiveSessionClose/u
);
assert.doesNotMatch(worker, /await reconcileAndCloseRouteIqProspectiveSessionFromHandoff/u);
assert.match(worker, /executionContext\.waitUntil\(closePromise\)/u);
assert.match(worker, /async fetch\(request, env, executionContext\)/u);
assert.match(worker, /handleApiRequest\(request, env, executionContext\)/u);
assert.match(worker, /reconcileAndCloseRouteIqProspectiveSessionFromHandoff[\s\S]+\.catch\(error =>/u);
assert.match(worker, /route_iq_prospective_session_close_failure/u);

for (const required of [
  "Cf-Access-Jwt-Assertion",
  "createRemoteJWKSet",
  "jwtVerify",
  'algorithms: ["RS256"]',
  'requiredClaims: ["sub", "iat", "exp"]',
  "issuer",
  "audience",
  "accessSubjectSha256",
  "supportedFieldSessionWorkspaces",
  "territoryContext",
  "sourceRecordSha256",
  "sourceContractVersion",
  "availableAt"
]) {
  assert.ok(access.includes(required), `Access control must include ${required}`);
}
assert.doesNotMatch(access, /payload\.email|claims\.email/u);

for (const required of [
  "HMAC-SHA-256",
  "crypto.subtle.sign",
  "crypto.subtle.verify",
  "ROUTE_IQ_PROSPECTIVE_SHADOW_AUTHORITY_KEY",
  "ROUTE_IQ_PROSPECTIVE_SHADOW_AUTHORITY_KEY_VERSION"
]) {
  assert.ok(`${authority}\n${contract}`.includes(required), `Authority control must include ${required}`);
}

for (const required of [
  "initializeRouteIqProspectiveCoordinatorSchema",
  "openRouteIqProspectiveCoordinator",
  "executeSchema(sql)",
  "execute(sql, bindings = [])",
  "transactionSync(callback)",
  "this.sql.databaseSize",
  "extends DurableObjectBase",
  "allocateNextStopOpportunity",
  "noteGovernedRepresentativeSignal",
  "closeCanonicalSession",
  "applyTrustedTrigger",
  "applyTrustedCandidateManifest",
  "applyTrustedSnapshotSeal",
  "applyTrustedShadowDecisionSeal",
  "readCanonicalRuntimeContext",
  "recordRuntimeStageExclusion",
  "linkServerDerivedNextStopAction",
  "reconcileCommittedFieldSessionOutcomes",
  "admitIntelligenceScoreableOutcome",
  "admitIntelligenceEvaluation",
  "recoverNextProjection",
  "readCommittedProjectionAsOf"
]) {
  assert.ok(durableObject.includes(required), `Durable Object adapter must include ${required}`);
}
assert.doesNotMatch(durableObject, /async fetch\s*\(/u);

for (const prohibited of [
  "workspaceId",
  "operatingProfileId",
  "representativeId",
  "sessionId",
  "opportunityId",
  "authoritativeTimestamp",
  "recordSha256",
  "eligibility",
  "provenance",
  "seal",
  "engineVersion",
  "readiness",
  "candidates",
  "sourceManifest"
]) {
  assert.ok(testSource.includes(`"${prohibited}"`), `Tests must reject ${prohibited}`);
}

assert.doesNotMatch(`${contract}\n${runtime}`, /route_iq_prospective_data_server_allocator_required/u);
assert.match(runtime, /namespace\.getByName\(await coordinatorStubName\(scope\)\)/u);
assert.match(
  runtime,
  /const scope = await verifyRouteIqProspectiveAccess[\s\S]+const stub = await coordinatorStubForScope/u
);
assert.match(runtime, /await stub\.allocateNextStopOpportunity/u);
assert.match(runtime, /await stub\.noteGovernedRepresentativeSignal/u);
assert.match(runtime, /await stub\.closeCanonicalSession/u);
assert.match(runtime, /executionContext\.waitUntil\(caught\)/u);
assert.match(runtime, /readRouteIqFieldSessionArchive/u);
assert.match(runtime, /projectCommittedRouteIqFieldSessionOutcomes/u);
assert.match(runtime, /reconcileCommittedFieldSessionOutcomes/u);

for (const required of [
  "env.ASSETS.fetch",
  "canonicalAllocationTime",
  "sampleServerDate",
  "new Date()",
  "createServerMonotonicSequencer",
  "Math.max(sampledTime, lastRecordTime + 1)",
  "route_iq_prospective_allocation_time_future",
  "noncanonicalTestHooks?.enabled === true",
  "produceRouteIqNextStopCandidateManifest",
  "buildCandidateManifestCoordinatorClaims",
  "applyTrustedCandidateManifest",
  "buildSnapshotSealCoordinatorClaims",
  "applyTrustedSnapshotSeal",
  "createImmutableAcceptedCandidateSnapshot",
  "produceShadowDecisionFromAcceptedSnapshot",
  "buildShadowDecisionSealCoordinatorClaims",
  "applyTrustedShadowDecisionSeal",
  "readCanonicalRuntimeContext",
  "recordRuntimeStageExclusion",
  "linkServerDerivedNextStopAction"
]) {
  assert.ok(orchestration.includes(required), `Server orchestration must include ${required}`);
}
assert.doesNotMatch(orchestration, /lifecycleTime|allocationTime\s*\+\s*[1-9]|base\s*\+\s*offset/u);
assert.doesNotMatch(`${runtime}\n${orchestration}`, /localStorage|sessionStorage|indexedDB/u);

for (const required of [
  "production lifecycle samples server Date at every stage",
  "explicit noncanonical lifecycle clock is sampled per stage",
  "lifecycle_server_clock",
  "2099-01-01T00:00:00.000Z"
]) {
  assert.ok(testSource.includes(required), `Temporal regression coverage must include ${required}`);
}

for (const budget of [
  "browserBodyBytes",
  "candidateCount",
  "domainCommandBytes",
  "eventsPerDay",
  "opportunitiesPerSession",
  "pendingOutbox",
  "rowsReadPerRpc",
  "rowsWrittenPerRpc",
  "sourceCount",
  "sourceArtifactBytes",
  "sourceArtifactTotalBytes",
  "sqlStatementsPerRpc",
  "storageBytesPerCoordinator"
]) {
  assert.ok(contract.includes(budget), `Budget ${budget} must be configured`);
}

assert.equal(packageJson.dependencies?.jose !== undefined, true);
assert.equal(packageJson.devDependencies?.miniflare !== undefined, true);
assert.equal(
  packageJson.scripts?.["infrastructure:route-iq-prospective-shadow:check"],
  "node scripts/verify-route-iq-prospective-shadow-infrastructure.mjs && node --test tests/route-iq-prospective-shadow-infrastructure.test.mjs"
);

for (const required of [
  batchId,
  "OFF = $0 incremental",
  "ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR",
  "RouteIqProspectiveShadowCoordinator",
  "route-iq-prospective-shadow-sqlite-v1",
  "Cf-Access-Jwt-Assertion",
  "HMAC-SHA-256",
  "Prometheus Data",
  "allocateNextStopOpportunity",
  "readCanonicalRuntimeContext",
  "linkServerDerivedNextStopAction",
  "reconcileCommittedFieldSessionOutcomes",
  "admitIntelligenceScoreableOutcome",
  "admitIntelligenceEvaluation",
  "closeCanonicalSession",
  "governed_noop",
  "forward-revert",
  "never auto-delete data",
  "No push, deploy, or activation"
]) {
  assert.ok(documentation.includes(required), `Documentation must include ${required}`);
}

console.log(JSON.stringify({
  status: "passed",
  batchId,
  dataCommits,
  intelligenceCommits,
  binding: "ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR",
  className: "RouteIqProspectiveShadowCoordinator",
  migration: "route-iq-prospective-shadow-sqlite-v1",
  publicWorkerBindingPresent: false,
  collectionDefault: "OFF",
  recommendationInfluence: "OFF",
  allocatorIntegration: "allocateNextStopOpportunity",
  intelligenceLifecycle: "manifest_snapshot_shadow_decision_sealed",
  actionIntegration: "linkServerDerivedNextStopAction",
  outcomeIntegration: "reconcileCommittedFieldSessionOutcomes",
  sessionClosureIntegration: "closeCanonicalSession"
}, null, 2));
