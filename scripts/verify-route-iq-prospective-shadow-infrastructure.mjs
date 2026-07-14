import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const batchId = "BATCH-20260713-004";
const startupSuppressionBatchId = "BATCH-20260714-002";
const activationReadinessBatchId = "BATCH-20260714-003";
const infrastructureBaseCommit = "84319f9c70004edd50e1531e48ea1d0d7b501089";
const dataCommits = Object.freeze([
  "7970f240",
  "968212e",
  "ce9f642",
  "88b8490",
  "89e9ae46",
  "9b53a21",
  "b7896a6",
  "f4ecc7e",
  "b388849",
  "84319f9",
  "a5bd1d4",
  "4803d7a",
  "fdacf00"
]);
const intelligenceCommits = Object.freeze(["4e66667", "6e4d9f7", "925fa5e"]);

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
  readiness: "workers/infrastructure/route-iq-prospective-shadow-readiness.js",
  runtime: "workers/infrastructure/route-iq-prospective-shadow-runtime.js",
  activationTemplate: "workers/infrastructure/route-iq-prospective-shadow-activation-template-v1.json",
  privateConfig: "wrangler.jsonc",
  publicConfig: "wrangler.prometheusrouteiq-website.jsonc",
  dataRuntimeContract: "overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json",
  test: "tests/route-iq-prospective-shadow-infrastructure.test.mjs",
  documentation: "docs/route-iq-prospective-shadow-infrastructure-v1.md",
  activationRunbook: "docs/route-iq-prospective-collection-activation-runbook-v1.md"
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
const readiness = read(paths.readiness);
const runtime = read(paths.runtime);
const activationTemplate = JSON.parse(read(paths.activationTemplate));
const privateConfig = read(paths.privateConfig);
const publicConfig = read(paths.publicConfig);
const dataRuntimeContract = JSON.parse(read(paths.dataRuntimeContract));
const testSource = read(paths.test);
const documentation = read(paths.documentation);
const activationRunbook = read(paths.activationRunbook);
const packageJson = JSON.parse(read("package.json"));

for (const commit of dataCommits) {
  git("rev-parse", "--verify", `${commit}^{commit}`);
  execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], { cwd: root });
}
for (const commit of intelligenceCommits) {
  git("rev-parse", "--verify", `${commit}^{commit}`);
  execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], { cwd: root });
}
git("rev-parse", "--verify", `${infrastructureBaseCommit}^{commit}`);
execFileSync("git", ["merge-base", "--is-ancestor", infrastructureBaseCommit, "HEAD"], { cwd: root });

assert.match(privateConfig, /"name": "ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR"/u);
assert.match(privateConfig, /"class_name": "RouteIqProspectiveShadowCoordinator"/u);
assert.equal((privateConfig.match(/"new_sqlite_classes"/gu) || []).length, 1);
assert.match(privateConfig, /"tag": "route-iq-prospective-shadow-sqlite-v1"/u);
assert.doesNotMatch(publicConfig, /ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR|RouteIqProspectiveShadowCoordinator/u);
assert.doesNotMatch(privateConfig, /ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION|ROUTE_IQ_PROSPECTIVE_SHADOW_COHORT_CONFIG/u);

assert.match(worker, /export \{\s*RouteIqProspectiveShadowCoordinator\s*\}/u);
assert.match(worker, /!getRouteIqProspectiveActivation\(env\)\.active/u);
assert.match(worker, /request\.method === "GET"/u);
assert.ok(
  worker.indexOf("!getRouteIqProspectiveActivation(env).active") < worker.indexOf("await enforceAegisControls(request, env)"),
  "OFF prospective handling must precede Aegis storage"
);
assert.ok(
  worker.indexOf('request.method === "GET"') < worker.indexOf("await enforceAegisControls(request, env)"),
  "Read-only prospective bootstrap must precede Aegis storage"
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
  "readCommittedProjectionAsOf",
  "readCommittedProjectionForOutcomeArtifact"
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
  "sourceManifest",
  "retentionEnvelope",
  "retentionBoundary",
  "sourceSession"
]) {
  assert.ok(testSource.includes(`"${prohibited}"`), `Tests must reject ${prohibited}`);
}

assert.doesNotMatch(`${contract}\n${runtime}`, /route_iq_prospective_data_server_allocator_required/u);
for (const required of [
  "ROUTE_IQ_PROSPECTIVE_BOOTSTRAP_CONTRACT_VERSION",
  "ROUTE_IQ_PROSPECTIVE_BOOTSTRAP_TTL_SECONDS",
  "ROUTE_IQ_PROSPECTIVE_BROWSER_EVENT_CONTRACT_VERSION",
  "ROUTE_IQ_PROSPECTIVE_SUPPORTED_OPPORTUNITY_TYPES",
  "verifyRouteIqProspectiveBootstrapAccess",
  "assertRouteIqProspectiveBootstrapRuntime",
  "assertRouteIqProspectiveAuthorityConfig",
  'status: "enabled"',
  'collection: "ON"',
  'activeCohort: true',
  "supportedOpportunityTypes",
  "eventContractVersion",
  "runtimeContextContractVersion",
  "coordinatorContractVersion",
  "issuedAt",
  "expiresAt"
]) {
  assert.ok(`${contract}\n${access}\n${runtime}`.includes(required), `Bootstrap must include ${required}`);
}
for (const required of [
  "route-iq-prospective-cohort-config-v2",
  "validateRouteIqProspectiveCohortConfig",
  "state",
  "issuedAt",
  "expiresAt",
  "supportedOpportunityTypes",
  "ROUTE_IQ_PROSPECTIVE_MAX_ACTIVE_REPRESENTATIVES",
  "ROUTE_IQ_PROSPECTIVE_COHORT_CONFIG_MAX_LIFETIME_SECONDS",
  "route_iq_prospective_cohort_config_stale",
  "ROUTE_IQ_PROSPECTIVE_SUPPORTED_OPPORTUNITY_TYPES"
]) {
  assert.ok(`${contract}\n${access}`.includes(required), `Activation cohort validation must include ${required}`);
}
assert.match(access, /config\.scopes\.length !== ROUTE_IQ_PROSPECTIVE_MAX_ACTIVE_REPRESENTATIVES/u);
assert.match(access, /expiresAtMs <= nowMs/u);
assert.match(access, /expiresAtMs - issuedAtMs > ROUTE_IQ_PROSPECTIVE_COHORT_CONFIG_MAX_LIFETIME_SECONDS/u);
assert.match(access, /value\.some\(\(entry, index\) => entry !== ROUTE_IQ_PROSPECTIVE_SUPPORTED_OPPORTUNITY_TYPES\[index\]\)/u);
assert.match(runtime, /request\.method === "GET" && pathname === ROUTE_IQ_PROSPECTIVE_SHADOW_PATH/u);
assert.ok(
  runtime.indexOf("return routeIqProspectiveBootstrapResponse") < runtime.indexOf("const scope = await verifyRouteIqProspectiveAccess"),
  "Bootstrap must return before the write-capable coordinator path"
);
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
  "deriveRouteIqScoreableOutcomeFromCommittedEvidence",
  "buildRouteIqScoreableOutcomeAdmissionClaims",
  "buildRouteIqEvaluationFromAdmittedOutcome",
  "buildRouteIqEvaluationAdmissionClaims",
  "isRouteIqEvaluationReadinessCountEligible",
  "readCommittedProjectionForOutcomeArtifact",
  'purpose: "committed_outcome_projection_read"',
  "recoverNextProjection",
  "ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS.pendingOutbox",
  "processed_with_failures",
  "resolveRouteIqEvaluationRetentionEnvelope",
  "buildNoncanonicalAuthenticatedDataRetentionEnvelope",
  "route_iq_prospective_retention_input_unavailable",
  "retentionEnvelope"
]) {
  assert.ok(runtime.includes(required), `Runtime reconciliation lifecycle must include ${required}`);
}
assert.match(runtime, /for \(const \[linkIndex, link\] of \(reconciliationReceipt\.linked \|\| \[\]\)\.entries\(\)\)/u);
assert.match(runtime, /Committed outcome projection recovery exceeded its hard bound/u);
assert.match(runtime, /Route IQ prospective committed outcome link failed\./u);
assert.match(runtime, /const recovered = await stub\.recoverNextProjection/u);
assert.match(runtime, /const readOnce = async \(\) => stub\.readCommittedProjectionForOutcomeArtifact/u);
assert.match(
  runtime,
  /noncanonicalTestHooks\?\.enabled !== true[\s\S]+typeof noncanonicalTestHooks\.buildNoncanonicalAuthenticatedDataRetentionEnvelope !== "function"/u
);
assert.ok(
  runtime.indexOf("resolveRouteIqEvaluationRetentionEnvelope")
    < runtime.indexOf("buildRouteIqEvaluationFromAdmittedOutcome({", runtime.indexOf("resolveRouteIqEvaluationRetentionEnvelope")),
  "Authenticated retention resolution must precede evaluation construction"
);

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
  "authenticated GET bootstrap is strict, short-lived, no-store, and storage-free",
  "active GET bypasses Aegis storage but still requires Access before any Durable Object lookup",
  "bootstrap fails closed for invalid path, expired Access, and unauthorized cohort",
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
assert.match(durableObject, /ROUTE_IQ_PROSPECTIVE_SQLITE_STATEMENT_BYTES_MAX = 96 \* 1024/u);
assert.match(durableObject, /ROUTE_IQ_PROSPECTIVE_SQLITE_BINDINGS_MAX = 96/u);

assert.equal(packageJson.dependencies?.jose !== undefined, true);
assert.equal(packageJson.devDependencies?.miniflare !== undefined, true);
assert.equal(
  packageJson.scripts?.["infrastructure:route-iq-prospective-shadow:check"],
  "node scripts/verify-route-iq-prospective-shadow-infrastructure.mjs && node --test tests/route-iq-prospective-shadow-infrastructure.test.mjs"
);

assert.equal(activationTemplate.templateVersion, "route-iq-prospective-shadow-activation-template-v1");
assert.equal(activationTemplate.templateState, "INERT_DEFAULT_OFF");
assert.equal(activationTemplate.collection, "OFF");
assert.equal(activationTemplate.recommendationInfluence, "OFF");
assert.equal(activationTemplate.activeCohortCount, 0);
assert.equal(activationTemplate.runtimeCohortConfigTemplate.version, "route-iq-prospective-cohort-config-v2");
assert.equal(activationTemplate.runtimeCohortConfigTemplate.scopes.length, 1);
assert.equal(activationTemplate.activationGuards.maximumActiveRepresentatives, 1);
assert.equal(activationTemplate.activationGuards.maximumConfigLifetimeHours, 24);
assert.equal(activationTemplate.activationGuards.productionUseOfThisTemplateIsProhibited, true);

for (const required of [
  "route-iq-prospective-activation-readiness-v1",
  "auditRouteIqProspectiveActivationReadiness",
  "attemptedApplicationWrites",
  "durableObjectInstanceCount",
  "kvWriteCount",
  "prospectiveRecordCount",
  "conflictCount",
  "exclusionCount",
  "evaluationCount",
  "archiveDispositionConsumerExclusionVerified",
  "productionAccessUsed",
  "activationAuthorized: false",
  "productionVerified: false",
  "preactivation_write_attempt_detected"
]) {
  assert.ok(readiness.includes(required), `Activation readiness audit must include ${required}`);
}
for (const budget of [
  "browserBodyBytes",
  "candidateCount",
  "domainCommandBytes",
  "eventsPerDay",
  "opportunitiesPerSession",
  "pendingOutbox",
  "principals",
  "rowsReadPerRpc",
  "rowsWrittenPerRpc",
  "sourceArtifactBytes",
  "sourceArtifactTotalBytes",
  "sourceCount",
  "sqlStatementsPerRpc",
  "storageBytesPerCoordinator"
]) {
  assert.ok(readiness.includes(budget), `Activation readiness audit must enforce ${budget}`);
}

const disposition = dataRuntimeContract.fieldSessionAdministrativeDispositionContract;
assert.equal(disposition.contractVersion, "route-iq-field-session-administrative-disposition-v1");
assert.equal(disposition.authorizedDisposition.reason, "AUTOMATION_SMOKE_TEST_ACCIDENTAL_FINALIZATION");
assert.equal(disposition.authorizedDisposition.state, "EXCLUDED_FROM_ANALYTICS");
for (const domain of [
  "learning",
  "readiness",
  "evaluation",
  "representative_performance",
  "territory_metrics",
  "customer_metrics",
  "productivity_counts",
  "dashboards",
  "leaderboards",
  "baselines",
  "calibration",
  "recommendation_inputs"
]) {
  assert.equal(disposition.excludedDomains.includes(domain), true, `Disposition must exclude ${domain}`);
}
assert.equal(disposition.consumerRules.consumptionEligibilityCheckRequired, true);
assert.equal(disposition.consumerRules.chronologicalEvidenceProjectionFailsClosed, true);
assert.equal(disposition.consumerRules.committedOutcomeProjectionFailsClosed, true);
assert.equal(disposition.consumerRules.recommendationInfluenceAllowed, false);

for (const required of [
  batchId,
  startupSuppressionBatchId,
  "b388849c21051262e0f80e4c24875147cf9889dd",
  "84319f9c70004edd50e1531e48ea1d0d7b501089",
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
  "readCommittedProjectionForOutcomeArtifact",
  "recoverNextProjection",
  "committed_outcome_projection_read",
  "pendingOutbox = 128",
  "96 KiB",
  "96 bindings",
  "two-opportunity same-session restart coverage",
  "authenticated Data retention envelope",
  "route_iq_prospective_retention_input_unavailable",
  "noncanonical test hook",
  "closeCanonicalSession",
  "governed_noop",
  "forward-revert",
  "never auto-delete data",
  "No push, deploy, or activation"
]) {
  assert.ok(documentation.includes(required), `Documentation must include ${required}`);
}

for (const required of [
  activationReadinessBatchId,
  "INERT_DEFAULT_OFF",
  "route-iq-prospective-cohort-config-v2",
  "exactly one governed workspace, operating profile, and internal representative scope",
  "24 hours",
  "Founder kill switch",
  "Immediate disable procedure",
  "productionVerified = false",
  "npx wrangler whoami",
  "npx wrangler deploy --dry-run --strict --keep-vars --config wrangler.jsonc",
  "npx wrangler deploy --keep-vars --config wrangler.jsonc",
  "exactly 390x844",
  "Dark deployment does not authorize collection",
  "Native Cloudflare rollback is prohibited",
  "new forward-revert commits only"
]) {
  assert.ok(activationRunbook.includes(required), `Activation runbook must include ${required}`);
}

console.log(JSON.stringify({
  status: "passed",
  batchId,
  startupSuppressionBatchId,
  activationReadinessBatchId,
  dataCommits,
  intelligenceCommits,
  binding: "ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR",
  className: "RouteIqProspectiveShadowCoordinator",
  migration: "route-iq-prospective-shadow-sqlite-v1",
  publicWorkerBindingPresent: false,
  collectionDefault: "OFF",
  activationTemplateState: "INERT_DEFAULT_OFF",
  activeCohortCount: 0,
  cohortConfigVersion: "route-iq-prospective-cohort-config-v2",
  activationConfigMaxLifetimeHours: 24,
  recommendationInfluence: "OFF",
  productionAccessUsed: false,
  bootstrapContractVersion: "route-iq-prospective-browser-bootstrap-v1",
  bootstrapStorageAccess: false,
  allocatorIntegration: "allocateNextStopOpportunity",
  intelligenceLifecycle: "manifest_snapshot_shadow_decision_sealed",
  actionIntegration: "linkServerDerivedNextStopAction",
  outcomeIntegration: "reconcileCommittedFieldSessionOutcomes",
  sessionClosureIntegration: "closeCanonicalSession"
}, null, 2));
