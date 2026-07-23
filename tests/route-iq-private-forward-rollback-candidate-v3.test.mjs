import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  buildRouteIqPrivateForwardRollbackCandidateV3,
  validateRouteIqPrivateForwardRollbackBoundaryV3
} from "../scripts/build-route-iq-private-forward-rollback-candidate-v3.mjs";
import {
  ROUTE_IQ_PRIVATE_FORWARD_ROLLBACK_INERT_RECEIPT,
  RouteIqBusinessAvailabilityCoordinator,
  RouteIqProspectiveShadowCoordinator
} from "../workers/infrastructure/route-iq-private-forward-rollback-inert-durable-object-v3.js";

const root = resolve(import.meta.dirname, "..");
const contractPath = join(
  root,
  "workers/infrastructure/route-iq-private-forward-rollback-candidate-v3.json"
);
const configPath = join(
  root,
  "workers/infrastructure/route-iq-private-forward-rollback-wrangler-v3.json"
);
const inertPath = join(
  root,
  "workers/infrastructure/route-iq-private-forward-rollback-inert-durable-object-v3.js"
);
const builderPath = join(root, "scripts/build-route-iq-private-forward-rollback-candidate-v3.mjs");
const contract = JSON.parse(readFileSync(contractPath, "utf8"));
const config = JSON.parse(readFileSync(configPath, "utf8"));
const prospectiveRpcMethods = Object.freeze([
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
const availabilityRpcMethods = Object.freeze([
  "acceptNormalizedSnapshot",
  "recordRefreshFailure",
  "readLatestSnapshot",
  "readMonitoringSummary"
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

test("successor pins retained version-55 source and supersedes the stale version-43 rollback evidence", () => {
  const stale = JSON.parse(readFileSync(
    join(root, "workers/infrastructure/route-iq-forward-rollback-candidate-v1.json"),
    "utf8"
  ));

  assert.equal(stale.retainedDarkDeployment.workerVersion, "43c614e8-ed24-413b-9901-27241e720094");
  assert.equal(contract.owner, "Prometheus Infrastructure");
  assert.equal(contract.currentPrivateProduction.workerVersion, "b8cba784-dfd3-4f8e-8356-816cccf6aecc");
  assert.equal(contract.applicationBehaviorSource.commit, "dec2ba1b137b0123b6f072ada4b3dd184f88c80d");
  assert.equal(contract.applicationBehaviorSource.tree, "61258b4edcafe2af6e94f76b9e011e2486cb2fe6");
  assert.equal(
    git("rev-parse", `${contract.applicationBehaviorSource.commit}^{tree}`),
    contract.applicationBehaviorSource.tree
  );
  assert.equal(contract.status, "PREPARED_NOT_DEPLOYED");
  assert.equal(contract.target.publicWorkerExcluded, true);
});

test("inert compatibility classes preserve every coordinator RPC without touching storage", async () => {
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
  const prospectiveCoordinator = new RouteIqProspectiveShadowCoordinator(ctx, Object.freeze({}));
  const availabilityCoordinator = new RouteIqBusinessAvailabilityCoordinator(ctx, Object.freeze({}));

  assert.equal(Object.hasOwn(RouteIqProspectiveShadowCoordinator.prototype, "fetch"), false);
  assert.equal(Object.hasOwn(RouteIqBusinessAvailabilityCoordinator.prototype, "fetch"), false);
  for (const method of prospectiveRpcMethods) {
    assert.equal(typeof prospectiveCoordinator[method], "function", `${method} must remain callable`);
    assert.strictEqual(await prospectiveCoordinator[method]({ forged: "ignored" }), ROUTE_IQ_PRIVATE_FORWARD_ROLLBACK_INERT_RECEIPT);
  }
  for (const method of availabilityRpcMethods) {
    assert.equal(typeof availabilityCoordinator[method], "function", `${method} must remain callable`);
    assert.strictEqual(await availabilityCoordinator[method]({ forged: "ignored" }), ROUTE_IQ_PRIVATE_FORWARD_ROLLBACK_INERT_RECEIPT);
  }
  assert.equal(storageTouched, false);
  assert.deepEqual(ROUTE_IQ_PRIVATE_FORWARD_ROLLBACK_INERT_RECEIPT, {
    ok: false,
    code: "route_iq_private_forward_rollback_inert",
    state: "INERT_FORWARD_COMPATIBILITY",
    customerPwaLaunch: "OFF",
    prospectiveCollection: "OFF",
    businessAvailabilityMode: "OFF",
    activeCohortCount: 0,
    recommendationInfluence: "OFF",
    storageTouched: false
  });
});

test("rollback config preserves stateful and static bindings while forcing every launch boundary OFF", () => {
  assert.equal(config.name, "prometheus-iq");
  assert.equal(config.main, "workers/prometheus-iq-worker.js");
  assert.equal(config.keep_vars, true);
  assert.equal(config.assets.binding, "ASSETS");
  assert.deepEqual(config.assets.run_worker_first, ["/api/*"]);
  assert.equal(config.observability.enabled, true);
  assert.equal(config.vars.ROUTE_IQ_CUSTOMER_PWA_LAUNCH_ENABLED, "OFF");
  assert.equal(config.vars.ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION, "OFF");
  assert.equal(config.vars.ROUTE_IQ_BUSINESS_AVAILABILITY_MODE, "OFF");
  assert.deepEqual(config.durable_objects.bindings, [
    {
      name: "ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR",
      class_name: "RouteIqProspectiveShadowCoordinator"
    },
    {
      name: "ROUTE_IQ_BUSINESS_AVAILABILITY_COORDINATOR",
      class_name: "RouteIqBusinessAvailabilityCoordinator"
    }
  ]);
  assert.deepEqual(config.migrations, [
    {
      tag: "route-iq-prospective-shadow-sqlite-v1",
      new_sqlite_classes: ["RouteIqProspectiveShadowCoordinator"]
    },
    {
      tag: "route-iq-business-availability-sqlite-v1",
      new_sqlite_classes: ["RouteIqBusinessAvailabilityCoordinator"]
    }
  ]);
  assert.equal(config.migrations.some(migration => Object.hasOwn(migration, "deleted_classes")), false);
  assert.deepEqual(config.secrets.required, [
    "ROUTE_IQ_PROSPECTIVE_SHADOW_AUTHORITY_KEY",
    "ROUTE_IQ_PROSPECTIVE_SHADOW_AUTHORITY_KEY_VERSION"
  ]);
  assert.deepEqual(config.kv_namespaces.map(binding => binding.binding), [
    "META_INSTAGRAM_TOKEN_STORE",
    "AEGIS_RATE_LIMITS",
    "SHARED_LEAD_INTAKE_STORE",
    "CRM_WORKSPACE_LEAD_STORE",
    "DATA_ROUTE_IQ_FIELD_SESSION_STORE"
  ]);
  assert.deepEqual(config.send_email, [{
    name: "FOUNDER_EMAIL",
    destination_address: "prometheusrouteiq@gmail.com"
  }]);
  assert.equal(Object.hasOwn(config, "routes"), false);
  assert.equal(Object.hasOwn(config, "triggers"), false);
  assert.equal(Object.hasOwn(config, "services"), false);
});

test("stateful, target, and activation mutations fail closed before packaging", () => {
  const cases = [
    ["public target", candidate => { candidate.target.worker = "prometheusrouteiq-website"; }, null],
    ["public inclusion", candidate => { candidate.target.publicWorkerExcluded = false; }, null],
    ["wrong baseline", candidate => { candidate.applicationBehaviorSource.commit = "0".repeat(40); }, null],
    ["native rollback", candidate => { candidate.statefulCompatibility.nativeCloudflareRollbackAllowed = true; }, null],
    ["deploy authorization", candidate => { candidate.authorization.deploymentAuthorized = true; }, null],
    ["keep vars removed", null, candidate => { candidate.keep_vars = false; }],
    ["customer launch enabled", null, candidate => { candidate.vars.ROUTE_IQ_CUSTOMER_PWA_LAUNCH_ENABLED = "ON"; }],
    ["collection enabled", null, candidate => { candidate.vars.ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION = "ON"; }],
    ["binding removed", null, candidate => { candidate.durable_objects.bindings = []; }],
    ["class changed", null, candidate => { candidate.durable_objects.bindings[0].class_name = "OtherClass"; }],
    ["migration removed", null, candidate => { candidate.migrations = []; }],
    ["migration deletion", null, candidate => { candidate.migrations[0].deleted_classes = ["RouteIqProspectiveShadowCoordinator"]; }],
    ["secret declaration removed", null, candidate => { candidate.secrets.required = []; }],
    ["KV binding removed", null, candidate => { candidate.kv_namespaces.pop(); }],
    ["email binding removed", null, candidate => { candidate.send_email = []; }],
    ["route override added", null, candidate => { candidate.routes = ["example.invalid/*"]; }],
    ["public configuration included", candidate => { candidate.candidatePackage.publicWorkerConfigurationIncluded = true; }, null],
    ["effective cohort count changed", candidate => { candidate.runtimeBoundary.effectiveActiveCohortCount = 1; }, null]
  ];

  for (const [label, mutateContract, mutateConfig] of cases) {
    const candidateContract = clone(contract);
    const candidateConfig = clone(config);
    mutateContract?.(candidateContract);
    mutateConfig?.(candidateConfig);
    assert.throws(
      () => validateRouteIqPrivateForwardRollbackBoundaryV3(candidateContract, candidateConfig),
      /rollback boundary|source tree/u,
      label
    );
  }
});

test("builder emits one deterministic private-only artifact pinned to the retained source", () => {
  const firstRoot = mkdtempSync(join(tmpdir(), "route-iq-private-forward-rollback-v3-test-"));
  const secondRoot = mkdtempSync(join(tmpdir(), "route-iq-private-forward-rollback-v3-test-"));
  const firstOutput = join(firstRoot, "candidate");
  const secondOutput = join(secondRoot, "candidate");
  try {
    const first = buildRouteIqPrivateForwardRollbackCandidateV3({
      outputDirectory: firstOutput,
      sourceRef: "WORKTREE"
    });
    const second = buildRouteIqPrivateForwardRollbackCandidateV3({
      outputDirectory: secondOutput,
      sourceRef: "WORKTREE"
    });

    assert.equal(first.manifest.contentTreeSha256, second.manifest.contentTreeSha256);
    assert.equal(first.manifest.priorWorkerSha256, contract.applicationBehaviorSource.workerSourceSha256);
    assert.equal(first.manifest.dashboardAssetSha256, contract.applicationBehaviorSource.dashboardAssetSha256);
    assert.equal(first.manifest.customerPwaLaunch, "OFF");
    assert.equal(first.manifest.prospectiveCollection, "OFF");
    assert.equal(first.manifest.businessAvailabilityMode, "OFF");
    assert.equal(first.manifest.effectiveActiveCohortCount, 0);
    assert.equal(first.manifest.recommendationInfluence, "OFF");
    assert.equal(first.manifest.deploymentAuthorized, false);
    assert.equal(first.manifest.candidateSource.sourceMode, "noncanonical_worktree_test");

    const wrapper = readFileSync(join(firstOutput, "workers/prometheus-iq-worker.js"), "utf8");
    const retained = readFileSync(join(firstOutput, "workers/prometheus-iq-retained-version-55.js"), "utf8");
    assert.match(wrapper, /prometheus-iq-retained-version-55\.js/u);
    assert.match(wrapper, /route-iq-private-forward-rollback-inert-durable-object-v3\.js/u);
    assert.match(wrapper, /RouteIqBusinessAvailabilityCoordinator/u);
    assert.doesNotMatch(wrapper, /export \*/u);
    assert.doesNotMatch(retained, /route-iq-august-1-customer-pwa-runtime|ROUTE_IQ_CUSTOMER_PWA/u);
    assert.throws(
      () => readFileSync(join(firstOutput, "wrangler.prometheusrouteiq-website.jsonc")),
      /ENOENT/u
    );
  } finally {
    rmSync(firstRoot, { recursive: true, force: true });
    rmSync(secondRoot, { recursive: true, force: true });
  }
});

test("qualification dry-run succeeds without a deploy, secret mutation, or public Worker path", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "route-iq-private-forward-rollback-v3-dry-run-test-"));
  try {
    const result = buildRouteIqPrivateForwardRollbackCandidateV3({
      outputDirectory: join(outputRoot, "candidate"),
      sourceRef: "WORKTREE",
      runDryRun: true
    });
    const builderSource = readFileSync(builderPath, "utf8");
    assert.equal(result.manifest.dryRunPassed, true);
    assert.equal(result.manifest.deploymentAuthorized, false);
    assert.match(builderSource, /"--dry-run"/u);
    assert.doesNotMatch(builderSource, /secret (?:put|delete|bulk)|--secrets-file|prometheusrouteiq-website/u);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("contract prohibits destructive rollback and records preservation-only secret handling", () => {
  assert.equal(contract.statefulCompatibility.deploymentMode, "future_normal_forward_deployment");
  assert.equal(contract.statefulCompatibility.nativeCloudflareRollbackAllowed, false);
  assert.equal(contract.statefulCompatibility.migrationHistoryPreserved, true);
  assert.equal(contract.statefulCompatibility.namespaceDeletionAllowed, false);
  assert.equal(contract.statefulCompatibility.bindingRemovalAllowed, false);
  assert.equal(contract.statefulCompatibility.classExportRemovalAllowed, false);
  assert.equal(contract.protectedRuntimeConfiguration.keepVars, true);
  assert.equal(contract.protectedRuntimeConfiguration.allExistingSecretBindingsPreserved, true);
  assert.equal(contract.protectedRuntimeConfiguration.secretsFileAllowed, false);
  assert.equal(contract.protectedRuntimeConfiguration.secretCreateUpdateDeleteAllowed, false);
  assert.equal(contract.runtimeBoundary.customerPwaLaunch, "OFF");
  assert.equal(contract.runtimeBoundary.prospectiveCollection, "OFF");
  assert.equal(contract.runtimeBoundary.businessAvailabilityMode, "OFF");
  assert.equal(contract.runtimeBoundary.businessAvailabilityScheduleActive, false);
  assert.equal(contract.runtimeBoundary.effectiveActiveCohortCount, 0);
  assert.equal(contract.runtimeBoundary.recommendationInfluence, "OFF");
  assert.equal(contract.authorization.deploymentAuthorized, false);
  assert.equal(contract.authorization.productionMutationAuthorized, false);
  assert.equal(contract.authorization.productionDataMutationAuthorized, false);

  assert.match(sha256(readFileSync(configPath)), /^[a-f0-9]{64}$/u);
  assert.match(sha256(readFileSync(inertPath)), /^[a-f0-9]{64}$/u);
});
