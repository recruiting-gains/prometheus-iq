import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { buildRouteIqForwardRollbackCandidate } from "./build-route-iq-forward-rollback-candidate.mjs";

const root = resolve(import.meta.dirname, "..");
const ownedPaths = Object.freeze([
  "docs/route-iq-forward-compatible-rollback-v1.md",
  "package.json",
  "scripts/build-route-iq-forward-rollback-candidate.mjs",
  "scripts/verify-route-iq-forward-rollback-candidate.mjs",
  "tests/route-iq-forward-rollback-candidate.test.mjs",
  "workers/infrastructure/route-iq-forward-rollback-candidate-v1.json",
  "workers/infrastructure/route-iq-forward-rollback-inert-durable-object.js",
  "workers/infrastructure/route-iq-forward-rollback-wrangler-v1.json"
]);

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

for (const path of ownedPaths) {
  execFileSync("git", ["cat-file", "-e", `HEAD:${path}`], { cwd: root });
}
execFileSync("git", ["diff", "--quiet", "HEAD", "--", ...ownedPaths], { cwd: root });
execFileSync("git", ["diff", "--cached", "--quiet", "HEAD", "--", ...ownedPaths], { cwd: root });

const contract = readJson("workers/infrastructure/route-iq-forward-rollback-candidate-v1.json");
const config = readJson("workers/infrastructure/route-iq-forward-rollback-wrangler-v1.json");
const inertSource = readFileSync(
  resolve(root, "workers/infrastructure/route-iq-forward-rollback-inert-durable-object.js"),
  "utf8"
);

assert.equal(contract.batchId, "BATCH-20260714-001");
assert.equal(contract.owner, "Prometheus Infrastructure");
assert.equal(contract.target.worker, "prometheus-iq");
assert.equal(contract.target.publicWorkerExcluded, true);
assert.equal(contract.applicationBehaviorSource.commit, "796f59ce7ee91538211f3050dc0b3050889ee935");
assert.equal(git("rev-parse", `${contract.applicationBehaviorSource.commit}^{tree}`), contract.applicationBehaviorSource.tree);
assert.equal(contract.statefulCompatibility.nativeCloudflareRollbackAllowed, false);
assert.equal(contract.statefulCompatibility.deploymentMode, "future_normal_forward_deployment");
assert.equal(contract.authorization.deploymentAuthorized, false);
assert.equal(contract.authorization.trafficChangeAuthorized, false);
assert.equal(contract.runtimeBoundary.collection, "OFF");
assert.equal(contract.runtimeBoundary.recommendationInfluence, "OFF");
assert.equal(contract.runtimeBoundary.durableObjectWrites, false);

assert.equal(config.name, "prometheus-iq");
assert.equal(config.main, "workers/prometheus-iq-worker.js");
assert.equal(config.keep_vars, true);
assert.equal(config.observability.enabled, true);
assert.equal(config.vars.ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION, "OFF");
assert.deepEqual(config.durable_objects.bindings, [{
  name: "ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR",
  class_name: "RouteIqProspectiveShadowCoordinator"
}]);
assert.deepEqual(config.migrations, [{
  tag: "route-iq-prospective-shadow-sqlite-v1",
  new_sqlite_classes: ["RouteIqProspectiveShadowCoordinator"]
}]);
assert.equal(config.migrations.some(migration => "deleted_classes" in migration), false);
assert.deepEqual(config.secrets.required, contract.protectedSecrets.requiredNames);

assert.match(inertSource, /class RouteIqProspectiveShadowCoordinator extends DurableObjectBase/u);
assert.doesNotMatch(inertSource, /\.storage|blockConcurrencyWhile|sql\.exec|namespace\.get|fetch\s*\(/u);
assert.match(inertSource, /collection: "OFF"/u);
assert.match(inertSource, /recommendationInfluence: "OFF"/u);

const result = buildRouteIqForwardRollbackCandidate({ sourceRef: "HEAD", runDryRun: true });
try {
  const generated = result.manifest;
  const candidateConfig = JSON.parse(readFileSync(resolve(result.outputDirectory, "wrangler.jsonc"), "utf8"));
  const wrapper = readFileSync(resolve(result.outputDirectory, "workers/prometheus-iq-worker.js"), "utf8");
  const previousWorker = readFileSync(
    resolve(result.outputDirectory, "workers/prometheus-iq-previous-behavior.js"),
    "utf8"
  );

  assert.equal(generated.candidateSource.commit, git("rev-parse", "HEAD^{commit}"));
  assert.equal(generated.candidateSource.tree, git("rev-parse", "HEAD^{tree}"));
  assert.equal(generated.candidateSource.sourceMode, "committed_git_objects");
  assert.equal(generated.dryRunPassed, true);
  assert.equal(generated.deploymentAuthorized, false);
  assert.equal(generated.priorWorkerSha256, contract.applicationBehaviorSource.workerSourceSha256);
  assert.equal(generated.dashboardAssetSha256, contract.applicationBehaviorSource.dashboardAssetSha256);
  assert.equal(candidateConfig.name, "prometheus-iq");
  assert.equal(candidateConfig.vars.ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION, "OFF");
  assert.match(wrapper, /prometheus-iq-previous-behavior\.js/u);
  assert.match(wrapper, /route-iq-forward-rollback-inert-durable-object\.js/u);
  assert.doesNotMatch(previousWorker, /route-iq-prospective-shadow|ROUTE_IQ_PROSPECTIVE_SHADOW/u);
  assert.throws(
    () => readFileSync(resolve(result.outputDirectory, "wrangler.prometheusrouteiq-website.jsonc")),
    /ENOENT/u
  );
} finally {
  rmSync(result.outputDirectory, { recursive: true, force: true });
}

console.log(JSON.stringify({
  status: "passed",
  batchId: contract.batchId,
  owner: contract.owner,
  candidateHead: git("rev-parse", "HEAD^{commit}"),
  candidateTree: git("rev-parse", "HEAD^{tree}"),
  applicationBehaviorCommit: contract.applicationBehaviorSource.commit,
  applicationBehaviorTree: contract.applicationBehaviorSource.tree,
  privateWorker: config.name,
  migrationTag: contract.statefulCompatibility.migrationTag,
  binding: contract.statefulCompatibility.binding,
  collection: "OFF",
  recommendationInfluence: "OFF",
  dryRun: "passed",
  deployment: "NOT_DEPLOYED"
}, null, 2));
