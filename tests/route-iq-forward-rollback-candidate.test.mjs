import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildRouteIqForwardRollbackCandidate } from "../scripts/build-route-iq-forward-rollback-candidate.mjs";
import {
  ROUTE_IQ_FORWARD_ROLLBACK_INERT_RECEIPT,
  RouteIqProspectiveShadowCoordinator
} from "../workers/infrastructure/route-iq-forward-rollback-inert-durable-object.js";

const root = resolve(import.meta.dirname, "..");
const rpcMethods = Object.freeze([
  "allocateNextStopOpportunity",
  "noteGovernedRepresentativeSignal",
  "closeCanonicalSession",
  "readCanonicalRuntimeContext",
  "recordRuntimeStageExclusion",
  "linkServerDerivedNextStopAction",
  "reconcileCommittedFieldSessionOutcomes",
  "admitIntelligenceScoreableOutcome",
  "admitIntelligenceEvaluation",
  "applyTrustedTrigger",
  "applyTrustedCandidateManifest",
  "applyTrustedSnapshotSeal",
  "applyTrustedShadowDecisionSeal",
  "applyTrustedAction",
  "applyTrustedOutcome",
  "applyTrustedEvaluation",
  "applyTrustedCorrection",
  "recoverNextProjection",
  "readCommittedProjectionAsOf",
  "readCommittedProjectionForOutcomeArtifact"
]);

test("inert Durable Object exposes compatibility RPCs without touching storage", async () => {
  let storageTouched = false;
  const ctx = Object.freeze({
    get storage() {
      storageTouched = true;
      throw new Error("storage must remain untouched");
    },
    blockConcurrencyWhile() {
      storageTouched = true;
      throw new Error("initialization must remain inert");
    }
  });
  const coordinator = new RouteIqProspectiveShadowCoordinator(ctx, Object.freeze({}));

  assert.equal(Object.hasOwn(RouteIqProspectiveShadowCoordinator.prototype, "fetch"), false);
  for (const method of rpcMethods) {
    assert.equal(typeof coordinator[method], "function", `${method} must remain callable`);
    assert.deepEqual(await coordinator[method]({ forged: "ignored" }), ROUTE_IQ_FORWARD_ROLLBACK_INERT_RECEIPT);
  }
  assert.equal(storageTouched, false);
});

test("candidate config retains stateful migration and protected bindings while forcing collection OFF", () => {
  const config = JSON.parse(readFileSync(
    join(root, "workers/infrastructure/route-iq-forward-rollback-wrangler-v1.json"),
    "utf8"
  ));

  assert.equal(config.name, "prometheus-iq");
  assert.equal(config.keep_vars, true);
  assert.equal(config.vars.ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION, "OFF");
  assert.deepEqual(config.durable_objects.bindings, [{
    name: "ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR",
    class_name: "RouteIqProspectiveShadowCoordinator"
  }]);
  assert.deepEqual(config.migrations, [{
    tag: "route-iq-prospective-shadow-sqlite-v1",
    new_sqlite_classes: ["RouteIqProspectiveShadowCoordinator"]
  }]);
  assert.equal(config.migrations.some(migration => migration.deleted_classes), false);
  assert.deepEqual(config.secrets.required, [
    "ROUTE_IQ_PROSPECTIVE_SHADOW_AUTHORITY_KEY",
    "ROUTE_IQ_PROSPECTIVE_SHADOW_AUTHORITY_KEY_VERSION"
  ]);
});

test("builder produces deterministic private-only packages from immutable prior behavior", () => {
  const firstOutput = join(mkdtempSync(join(tmpdir(), "route-iq-forward-rollback-test-")), "candidate-a");
  const secondOutput = join(mkdtempSync(join(tmpdir(), "route-iq-forward-rollback-test-")), "candidate-b");
  try {
    const first = buildRouteIqForwardRollbackCandidate({
      outputDirectory: firstOutput,
      sourceRef: "WORKTREE"
    });
    const second = buildRouteIqForwardRollbackCandidate({
      outputDirectory: secondOutput,
      sourceRef: "WORKTREE"
    });

    assert.equal(first.manifest.contentTreeSha256, second.manifest.contentTreeSha256);
    assert.equal(first.manifest.applicationBehaviorSource.commit, "796f59ce7ee91538211f3050dc0b3050889ee935");
    assert.equal(first.manifest.applicationBehaviorSource.tree, "ab8c11e8ef3a68a419d23501675b40a279172e3a");
    assert.equal(first.manifest.priorWorkerSha256, "d5987bdf417c5b339e2d78473dc009bfe9317573f799fca3817b198fed6bc43c");
    assert.equal(first.manifest.dashboardAssetSha256, "e654e325e7370e7d67a7c36a17307a673ef30199573f4a899cb3c3576ac934b3");
    assert.equal(first.manifest.deploymentAuthorized, false);
    assert.equal(first.manifest.dryRunPassed, false);

    const wrapper = readFileSync(join(firstOutput, "workers/prometheus-iq-worker.js"), "utf8");
    const previousWorker = readFileSync(join(firstOutput, "workers/prometheus-iq-previous-behavior.js"), "utf8");
    assert.match(wrapper, /export \{ default \} from "\.\/prometheus-iq-previous-behavior\.js"/u);
    assert.match(wrapper, /RouteIqProspectiveShadowCoordinator/u);
    assert.doesNotMatch(previousWorker, /route-iq-prospective-shadow|ROUTE_IQ_PROSPECTIVE_SHADOW/u);
    assert.throws(
      () => readFileSync(join(firstOutput, "wrangler.prometheusrouteiq-website.jsonc")),
      /ENOENT/u
    );
  } finally {
    rmSync(resolve(firstOutput, ".."), { recursive: true, force: true });
    rmSync(resolve(secondOutput, ".."), { recursive: true, force: true });
  }
});

test("rollback contract prohibits native rollback, deployment, namespace deletion, and traffic changes", () => {
  const contract = JSON.parse(readFileSync(
    join(root, "workers/infrastructure/route-iq-forward-rollback-candidate-v1.json"),
    "utf8"
  ));

  assert.equal(contract.statefulCompatibility.nativeCloudflareRollbackAllowed, false);
  assert.equal(contract.statefulCompatibility.namespaceDeletionAllowed, false);
  assert.equal(contract.statefulCompatibility.deletedClassesAllowed, false);
  assert.equal(contract.statefulCompatibility.deploymentMode, "future_normal_forward_deployment");
  assert.equal(contract.authorization.deploymentAuthorized, false);
  assert.equal(contract.authorization.trafficChangeAuthorized, false);
  assert.equal(contract.authorization.productionMutationAuthorized, false);
  assert.equal(contract.runtimeBoundary.operationalInfluence, false);
});
