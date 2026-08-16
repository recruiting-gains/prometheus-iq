import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import {
  appendFileSync,
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PassThrough } from "node:stream";

import {
  PUBLIC_WORKER_DEPLOYMENT_POLICY,
  PublicDeploymentPolicyError,
  runBoundedPublicWranglerForTest
} from "../scripts/lib/github-actions-public-worker-deployment.mjs";
import {
  PUBLIC_WORKFLOW_V2_PHASE,
  PUBLIC_WORKFLOW_V2_POLICY,
  PublicWorkflowV2Error,
  buildQualifiedPublicRelease,
  buildQualifiedPublicWranglerInvocation,
  canonicalPublicWorkflowJson,
  createPublicDeploymentEvidenceRecorder,
  runQualifiedPublicDeploymentLifecycle,
  sha256PublicWorkflowFile,
  validatePublicDeploymentV2Inputs,
  validatePublicQualificationInputs,
  verifyQualifiedPublicRelease
} from "../scripts/lib/github-actions-public-worker-workflow-v2.mjs";
import {
  publicWorkerSmokeV2Plan,
  runPublicWorkerSmokeV2
} from "../scripts/lib/cloudflare-public-worker-smoke-v2.mjs";
import { buildPublicForwardRollbackArtifact } from "../scripts/lib/route-iq-public-forward-rollback.mjs";
import { verifyGithubActionsPublicWorkerWorkflowV2 } from "../scripts/verify-github-actions-public-worker-workflow-v2.mjs";

const root = resolve(import.meta.dirname, "..");
const commit = "07bf2eddc9707cb410ff6670efe9465ca68cd6b4";
const tree = "e1546b4500803bb03898c6ffb18377ffd08e599e";
const batchId = "BATCH-20260720-010";
const publicVersion = "0396f868-1111-4111-8111-111111111111";
const privateVersion = "b8cba784-dfd3-4f8e-8356-816cccf6aecc";
const rollbackArtifactSha256 = buildPublicForwardRollbackArtifact(root).artifactSha256;
const runtimeIdentity = Object.freeze({
  runner: PUBLIC_WORKFLOW_V2_POLICY.runner,
  architecture: PUBLIC_WORKFLOW_V2_POLICY.architecture,
  nodeVersion: PUBLIC_WORKFLOW_V2_POLICY.nodeVersion,
  npmVersion: "11.4.2",
  wranglerVersion: PUBLIC_WORKFLOW_V2_POLICY.wranglerVersion,
  browserRuntime: PUBLIC_WORKFLOW_V2_POLICY.browserRuntime,
  smokeRuntime: PUBLIC_WORKFLOW_V2_POLICY.smokeRuntime
});

function qualificationInputs() {
  return Object.freeze({
    candidateCommit: commit,
    candidateTree: tree,
    batchId,
    currentPublicVersion: publicVersion,
    currentPrivateVersion: privateVersion,
    rollbackArtifactSha256
  });
}

function qualificationEnvironment(overrides = {}) {
  const dispatch = {
    candidate_commit: commit,
    candidate_tree: tree,
    batch_id: batchId,
    current_public_version: publicVersion,
    current_private_version: privateVersion,
    rollback_artifact_sha256: rollbackArtifactSha256
  };
  return {
    PROMETHEUS_CANDIDATE_COMMIT: commit,
    PROMETHEUS_CANDIDATE_TREE: tree,
    PROMETHEUS_BATCH_ID: batchId,
    PROMETHEUS_CURRENT_PUBLIC_VERSION: publicVersion,
    PROMETHEUS_CURRENT_PRIVATE_VERSION: privateVersion,
    PROMETHEUS_ROLLBACK_ARTIFACT_SHA256: rollbackArtifactSha256,
    PROMETHEUS_DISPATCH_INPUTS_JSON: JSON.stringify(dispatch),
    GITHUB_REPOSITORY: PUBLIC_WORKFLOW_V2_POLICY.repository,
    GITHUB_REF: PUBLIC_WORKFLOW_V2_POLICY.ref,
    GITHUB_REF_NAME: PUBLIC_WORKFLOW_V2_POLICY.branch,
    GITHUB_REF_TYPE: PUBLIC_WORKFLOW_V2_POLICY.refType,
    GITHUB_EVENT_NAME: PUBLIC_WORKFLOW_V2_POLICY.eventName,
    GITHUB_SHA: commit,
    GITHUB_ACTOR: PUBLIC_WORKFLOW_V2_POLICY.founderActor,
    GITHUB_TRIGGERING_ACTOR: PUBLIC_WORKFLOW_V2_POLICY.founderActor,
    GITHUB_WORKFLOW: PUBLIC_WORKFLOW_V2_POLICY.qualificationWorkflowName,
    GITHUB_WORKFLOW_REF: PUBLIC_WORKFLOW_V2_POLICY.qualificationWorkflowRef,
    GITHUB_RUN_ATTEMPT: "1",
    ...overrides
  };
}

function deploymentEnvironment(overrides = {}) {
  const dispatch = {
    approved_commit: commit,
    approved_tree: tree,
    batch_id: batchId,
    current_public_version: publicVersion,
    current_private_version: privateVersion,
    qualification_run_id: "30000000000",
    qualification_artifact_id: "4000000000",
    qualified_artifact_sha256: "1".repeat(64),
    qualified_manifest_sha256: "2".repeat(64),
    deployment_asset_sha256: PUBLIC_WORKFLOW_V2_POLICY.successfulProductionBaseline.deploymentAssetsSha256,
    rollback_contract_sha256: "3".repeat(64),
    rollback_artifact_sha256: rollbackArtifactSha256,
    workflow_contract_sha256: "4".repeat(64),
    founder_authorization: PUBLIC_WORKFLOW_V2_POLICY.founderAuthorization
  };
  return {
    PROMETHEUS_APPROVED_COMMIT: commit,
    PROMETHEUS_APPROVED_TREE: tree,
    PROMETHEUS_BATCH_ID: batchId,
    PROMETHEUS_CURRENT_PUBLIC_VERSION: publicVersion,
    PROMETHEUS_CURRENT_PRIVATE_VERSION: privateVersion,
    PROMETHEUS_QUALIFICATION_RUN_ID: dispatch.qualification_run_id,
    PROMETHEUS_QUALIFICATION_ARTIFACT_ID: dispatch.qualification_artifact_id,
    PROMETHEUS_QUALIFIED_ARTIFACT_SHA256: dispatch.qualified_artifact_sha256,
    PROMETHEUS_QUALIFIED_MANIFEST_SHA256: dispatch.qualified_manifest_sha256,
    PROMETHEUS_DEPLOYMENT_ASSET_SHA256: dispatch.deployment_asset_sha256,
    PROMETHEUS_ROLLBACK_CONTRACT_SHA256: dispatch.rollback_contract_sha256,
    PROMETHEUS_ROLLBACK_ARTIFACT_SHA256: dispatch.rollback_artifact_sha256,
    PROMETHEUS_WORKFLOW_CONTRACT_SHA256: dispatch.workflow_contract_sha256,
    PROMETHEUS_FOUNDER_AUTHORIZATION: dispatch.founder_authorization,
    PROMETHEUS_DISPATCH_INPUTS_JSON: JSON.stringify(dispatch),
    GITHUB_REPOSITORY: PUBLIC_WORKFLOW_V2_POLICY.repository,
    GITHUB_REF: PUBLIC_WORKFLOW_V2_POLICY.ref,
    GITHUB_REF_NAME: PUBLIC_WORKFLOW_V2_POLICY.branch,
    GITHUB_REF_TYPE: PUBLIC_WORKFLOW_V2_POLICY.refType,
    GITHUB_EVENT_NAME: PUBLIC_WORKFLOW_V2_POLICY.eventName,
    GITHUB_SHA: commit,
    GITHUB_ACTOR: PUBLIC_WORKFLOW_V2_POLICY.founderActor,
    GITHUB_TRIGGERING_ACTOR: PUBLIC_WORKFLOW_V2_POLICY.founderActor,
    GITHUB_WORKFLOW: PUBLIC_WORKFLOW_V2_POLICY.deploymentWorkflowName,
    GITHUB_WORKFLOW_REF: PUBLIC_WORKFLOW_V2_POLICY.deploymentWorkflowRef,
    GITHUB_RUN_ATTEMPT: "1",
    ...overrides
  };
}

function fakeBundle(_repositoryRoot, outputDirectory) {
  writeFileSync(
    join(outputDirectory, PUBLIC_WORKFLOW_V2_POLICY.generatedWorkerFile),
    `export default { fetch() { return new Response("ok"); } };\n//# sourceMappingURL=${PUBLIC_WORKFLOW_V2_POLICY.generatedSourceMapFile}\n`,
    "utf8"
  );
  writeFileSync(join(outputDirectory, PUBLIC_WORKFLOW_V2_POLICY.generatedSourceMapFile), `${JSON.stringify({
    version: 3,
    sources: [],
    sourceRoot: "",
    names: [],
    mappings: ""
  })}\n`, "utf8");
  writeFileSync(join(outputDirectory, "README.md"), "synthetic qualification output\n", "utf8");
}

function expectedFromBuild(result) {
  return Object.freeze({
    approvedCommit: commit,
    approvedTree: tree,
    batchId,
    currentPublicVersion: publicVersion,
    currentPrivateVersion: privateVersion,
    qualifiedArtifactSha256: result.artifactSha256,
    qualifiedManifestSha256: result.manifestSha256,
    deploymentAssetSha256: result.deploymentAssetsSha256,
    rollbackContractSha256: result.rollbackContractSha256,
    rollbackArtifactSha256: result.rollbackArtifactSha256,
    workflowContractSha256: result.workflowContractSha256
  });
}

function buildFixture() {
  const temporary = mkdtempSync(join(tmpdir(), "prometheus-public-workflow-v2-test-"));
  const release = join(temporary, "release");
  const result = buildQualifiedPublicRelease(root, {
    outputDirectory: release,
    inputs: qualificationInputs(),
    runtimeIdentity,
    temporaryRoot: temporary,
    bundlePublicWorker: fakeBundle,
    verifyRepositoryBoundary: false
  });
  return { temporary, release, result, expected: expectedFromBuild(result) };
}

function repositoryIdentity() {
  return Object.freeze({
    head: commit,
    tree,
    originMain: commit,
    branch: "main",
    originUrl: "https://github.com/PrometheusRouteIQ/prometheus-iq.git",
    status: "",
    unstagedClean: true,
    stagedClean: true
  });
}

function workerState(versionId, deploymentId, bindings = []) {
  return Object.freeze({
    deployment: Object.freeze({ versionId, deploymentId }),
    bindings: Object.freeze([...bindings].sort())
  });
}

const requiredBindings = Object.freeze([
  "ROUTE_IQ_REQUEST_CRM_COORDINATOR:durable_object_namespace",
  "ROUTE_IQ_REQUEST_CRM_ACCESS_AUDIENCE:secret_text",
  "ROUTE_IQ_REQUEST_CRM_ACCESS_TEAM_DOMAIN:secret_text",
  "ROUTE_IQ_REQUEST_CRM_FOUNDER_SUBJECT_SHA256:secret_text"
]);

function lifecycleFixture({ smoke, privateChanged = false, deployFailure = "none" } = {}) {
  const temporary = mkdtempSync(join(tmpdir(), "prometheus-public-workflow-v2-lifecycle-"));
  const evidence = createPublicDeploymentEvidenceRecorder(join(temporary, "evidence"));
  const initialPublic = workerState(publicVersion, "public-deployment-1", requiredBindings);
  const initialPrivate = workerState(privateVersion, "private-deployment-1", ["PRIVATE:plain_text"]);
  const deployedPublic = workerState("0396f868-2222-4222-8222-222222222222", "public-deployment-2", requiredBindings);
  const deployedPrivate = privateChanged
    ? workerState("b8cba784-3333-4333-8333-333333333333", "private-deployment-2", ["PRIVATE:plain_text"])
    : initialPrivate;
  const rolledBackPublic = workerState("0396f868-4444-4444-8444-444444444444", "public-deployment-3", requiredBindings);
  const states = new Map([
    [PUBLIC_WORKFLOW_V2_POLICY.publicWorker, [initialPublic, deployedPublic, rolledBackPublic]],
    [PUBLIC_WORKFLOW_V2_POLICY.privateWorker, [initialPrivate, deployedPrivate, initialPrivate]]
  ]);
  const calls = { verify: 0, fetch: 0, dryRun: 0, deploy: 0, rollback: 0, smoke: 0 };
  const result = runQualifiedPublicDeploymentLifecycle({
    inputs: Object.freeze({
      approvedCommit: commit,
      approvedTree: tree,
      batchId,
      currentPublicVersion: publicVersion,
      currentPrivateVersion: privateVersion
    }),
    verifyRelease: async () => {
      calls.verify += 1;
      return Object.freeze({ forwardDirectory: "/qualified/forward", rollbackDirectory: "/qualified/rollback" });
    },
    inspectIdentity: async () => repositoryIdentity(),
    verifyInitialBindings: bindings => assert.deepEqual(bindings, [...requiredBindings].sort()),
    assertBindingsPreserved: (before, after) => assert.deepEqual(after, before),
    fetchState: async worker => {
      calls.fetch += 1;
      return states.get(worker).shift();
    },
    runDryRun: async () => { calls.dryRun += 1; },
    runDeploy: async (_release, onMutationBoundary) => {
      calls.deploy += 1;
      if (deployFailure === "before-spawn") throw new Error("synthetic pre-spawn failure");
      onMutationBoundary();
      if (deployFailure === "after-spawn") throw new Error("synthetic post-spawn failure");
    },
    runRollback: async () => { calls.rollback += 1; },
    runSmoke: async () => {
      calls.smoke += 1;
      return smoke || Object.freeze({ attemptedWriteCount: 0, criticalFailures: [], noncriticalFailures: [] });
    },
    evidence
  });
  return { temporary, evidence, calls, result };
}

function wranglerBoundaryFixture({ throwOnSpawn = false, emitSpawnError = false } = {}) {
  let calls = 0;
  return {
    get calls() { return calls; },
    spawnImpl() {
      calls += 1;
      if (throwOnSpawn) throw new Error("synthetic synchronous spawn failure");
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = () => true;
      queueMicrotask(() => {
        if (emitSpawnError) child.emit("error", new Error("synthetic asynchronous spawn failure"));
        else {
          child.emit("spawn");
          child.emit("close", 0, null);
        }
      });
      return child;
    }
  };
}

function runBoundaryWrangler({ fixture, invocationBuilder, onProcessStarted }) {
  return runBoundedPublicWranglerForTest({
    root,
    mode: "deploy",
    inputs: { batchId, approvedCommit: commit },
    credentials: { apiToken: "synthetic-token", accountId: "a".repeat(32) },
    secretFile: "/tmp/synthetic-settings.json",
    spawnImpl: fixture.spawnImpl,
    invocationBuilder,
    onProcessStarted,
    timeoutMs: 100,
    outputByteLimit: 4096
  });
}

test("qualification and deployment accept only exact pinned contexts and identical toolchain workflows", () => {
  assert.equal(validatePublicQualificationInputs(qualificationEnvironment()).candidateCommit, commit);
  assert.equal(validatePublicDeploymentV2Inputs(deploymentEnvironment()).approvedCommit, commit);
  for (const invalid of [
    { GITHUB_RUN_ATTEMPT: "2" },
    { GITHUB_ACTOR: "another-actor" },
    { GITHUB_REF: "refs/heads/feature" },
    { PROMETHEUS_CANDIDATE_TREE: "x" }
  ]) assert.throws(() => validatePublicQualificationInputs(qualificationEnvironment(invalid)), PublicWorkflowV2Error);
  for (const invalid of [
    { GITHUB_TRIGGERING_ACTOR: "another-actor" },
    { PROMETHEUS_QUALIFICATION_ARTIFACT_ID: "0" },
    { PROMETHEUS_FOUNDER_AUTHORIZATION: "wrong" }
  ]) assert.throws(() => validatePublicDeploymentV2Inputs(deploymentEnvironment(invalid)), PublicWorkflowV2Error);

  const qualification = readFileSync(join(root, PUBLIC_WORKFLOW_V2_POLICY.qualificationWorkflowPath), "utf8");
  const deployment = readFileSync(join(root, PUBLIC_WORKFLOW_V2_POLICY.deploymentWorkflowPath), "utf8");
  for (const marker of ["runs-on: ubuntu-24.04", "node-version: \"24.4.1\"", "run: npm ci"]) {
    assert.ok(qualification.includes(marker));
    assert.ok(deployment.includes(marker));
  }
  assert.equal([...qualification.matchAll(/^        run: npm run build$/gmu)].length, 1);
  assert.equal([...qualification.matchAll(/^        run: npm test$/gmu)].length, 1);
  assert.doesNotMatch(deployment, /npm run build|npm test|vite build/u);
});

test("qualification emits deterministic forward and rollback payloads and deploy cannot rebuild them", () => {
  const first = buildFixture();
  const second = buildFixture();
  try {
    assert.equal(first.result.artifactSha256, second.result.artifactSha256);
    assert.equal(first.result.manifestSha256, second.result.manifestSha256);
    const verified = verifyQualifiedPublicRelease(root, first.release, first.expected, runtimeIdentity, {
      verifyRepositoryBoundary: false
    });
    assert.equal(verified.artifactSha256, first.result.artifactSha256);
    for (const mode of ["dry-run", "deploy", "rollback"]) {
      const invocation = buildQualifiedPublicWranglerInvocation(
        mode,
        { batchId, approvedCommit: commit },
        "/tmp/fixed-settings.json",
        verified
      );
      assert.ok(invocation.includes("--no-bundle"));
      assert.equal(invocation.includes("--name"), false);
      assert.equal(invocation.includes(PUBLIC_WORKFLOW_V2_POLICY.privateWorker), false);
      assert.equal(invocation.includes("build"), false);
    }
  } finally {
    rmSync(first.temporary, { recursive: true, force: true });
    rmSync(second.temporary, { recursive: true, force: true });
  }
});

test("a real qualified forward payload passes Wrangler no-bundle dry run without Cloudflare", () => {
  const temporary = mkdtempSync(join(tmpdir(), "prometheus-public-workflow-v2-real-"));
  const release = join(temporary, "release");
  try {
    const result = buildQualifiedPublicRelease(root, {
      outputDirectory: release,
      inputs: qualificationInputs(),
      runtimeIdentity,
      temporaryRoot: temporary,
      verifyRepositoryBoundary: false
    });
    const verified = verifyQualifiedPublicRelease(root, release, expectedFromBuild(result), runtimeIdentity, {
      verifyRepositoryBoundary: false
    });
    const config = join(verified.forwardDirectory, PUBLIC_WORKFLOW_V2_POLICY.qualifiedConfigFile);
    const output = join(temporary, "no-bundle-output");
    const dryRun = spawnSync(process.execPath, [
      PUBLIC_WORKER_DEPLOYMENT_POLICY.wranglerModule,
      "deploy",
      "--dry-run",
      "--no-bundle",
      "--config",
      config,
      "--keep-vars",
      "--strict",
      "--outdir",
      output
    ], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
      timeout: 240_000,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        CI: "true",
        NO_COLOR: "1",
        WRANGLER_SEND_METRICS: "false",
        CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false"
      }
    });
    assert.equal(dryRun.status, 0, "qualified no-bundle payload must be deployable without rebuilding");
    assert.equal(dryRun.error, undefined);
    assert.equal(dryRun.signal, null);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("payload, manifest, commit, tree, Worker, workflow, and rollback mismatches fail closed", () => {
  const fixture = buildFixture();
  try {
    const mismatches = [
      { ...fixture.expected, approvedCommit: "a".repeat(40) },
      { ...fixture.expected, approvedTree: "b".repeat(40) },
      { ...fixture.expected, qualifiedArtifactSha256: "c".repeat(64) },
      { ...fixture.expected, qualifiedManifestSha256: "d".repeat(64) },
      { ...fixture.expected, deploymentAssetSha256: "e".repeat(64) },
      { ...fixture.expected, rollbackArtifactSha256: "f".repeat(64) },
      { ...fixture.expected, workflowContractSha256: "0".repeat(64) }
    ];
    for (const expected of mismatches) {
      assert.throws(
        () => verifyQualifiedPublicRelease(root, fixture.release, expected, runtimeIdentity, {
          verifyRepositoryBoundary: false
        }),
        PublicWorkflowV2Error
      );
    }

    const manifestPath = join(fixture.release, PUBLIC_WORKFLOW_V2_POLICY.manifestFile);
    chmodSync(manifestPath, 0o600);
    appendFileSync(manifestPath, " ", "utf8");
    assert.throws(
      () => verifyQualifiedPublicRelease(root, fixture.release, fixture.expected, runtimeIdentity, {
        verifyRepositoryBoundary: false
      }),
      PublicWorkflowV2Error
    );
  } finally {
    rmSync(fixture.temporary, { recursive: true, force: true });
  }
});

test("actual payload tampering and a rehashed wrong target both fail closed", () => {
  const payloadFixture = buildFixture();
  const targetFixture = buildFixture();
  try {
    const workerPath = join(
      payloadFixture.release,
      PUBLIC_WORKFLOW_V2_POLICY.payloadDirectory,
      "forward",
      "worker",
      PUBLIC_WORKFLOW_V2_POLICY.generatedWorkerFile
    );
    chmodSync(workerPath, 0o600);
    appendFileSync(workerPath, "\n", "utf8");
    assert.throws(
      () => verifyQualifiedPublicRelease(root, payloadFixture.release, payloadFixture.expected, runtimeIdentity, {
        verifyRepositoryBoundary: false
      }),
      PublicWorkflowV2Error
    );

    const manifestPath = join(targetFixture.release, PUBLIC_WORKFLOW_V2_POLICY.manifestFile);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.target.worker = PUBLIC_WORKFLOW_V2_POLICY.privateWorker;
    chmodSync(manifestPath, 0o600);
    writeFileSync(manifestPath, `${canonicalPublicWorkflowJson(manifest)}\n`, "utf8");
    const expected = {
      ...targetFixture.expected,
      qualifiedManifestSha256: sha256PublicWorkflowFile(manifestPath)
    };
    assert.throws(
      () => verifyQualifiedPublicRelease(root, targetFixture.release, expected, runtimeIdentity, {
        verifyRepositoryBoundary: false
      }),
      PublicWorkflowV2Error
    );
  } finally {
    rmSync(payloadFixture.temporary, { recursive: true, force: true });
    rmSync(targetFixture.temporary, { recursive: true, force: true });
  }
});

test("a local pre-boundary failure records no deployment and makes zero Cloudflare or Wrangler calls", async () => {
  const temporary = mkdtempSync(join(tmpdir(), "prometheus-public-preboundary-"));
  const evidence = createPublicDeploymentEvidenceRecorder(join(temporary, "evidence"));
  const calls = { fetch: 0, dryRun: 0, deploy: 0 };
  try {
    await assert.rejects(runQualifiedPublicDeploymentLifecycle({
      inputs: { approvedCommit: commit, approvedTree: tree },
      verifyRelease: async () => { throw new PublicWorkflowV2Error("ARTIFACT_TAMPERED"); },
      inspectIdentity: async () => repositoryIdentity(),
      verifyInitialBindings() {},
      assertBindingsPreserved() {},
      fetchState: async () => { calls.fetch += 1; },
      runDryRun: async () => { calls.dryRun += 1; },
      runDeploy: async () => { calls.deploy += 1; },
      runRollback: async () => {},
      runSmoke: async () => {},
      evidence
    }), PublicWorkflowV2Error);
    assert.deepEqual(calls, { fetch: 0, dryRun: 0, deploy: 0 });
    assert.deepEqual(evidence.phases(), [PUBLIC_WORKFLOW_V2_PHASE.DEPLOYMENT_NOT_BEGUN]);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("a pre-boundary runner interruption preserves an unchanged qualified candidate", () => {
  const fixture = buildFixture();
  try {
    const before = readFileSync(
      join(fixture.release, PUBLIC_WORKFLOW_V2_POLICY.manifestFile)
    );
    assert.throws(
      () => createPublicDeploymentEvidenceRecorder(join(fixture.temporary, "missing-parent", "evidence")),
      error => error instanceof PublicWorkflowV2Error
        && error.code === "EVIDENCE_INVALID"
    );
    const verified = verifyQualifiedPublicRelease(root, fixture.release, fixture.expected, runtimeIdentity, {
      verifyRepositoryBoundary: false
    });
    assert.equal(verified.artifactSha256, fixture.result.artifactSha256);
    assert.deepEqual(
      readFileSync(join(fixture.release, PUBLIC_WORKFLOW_V2_POLICY.manifestFile)),
      before
    );
  } finally {
    rmSync(fixture.temporary, { recursive: true, force: true });
  }
});

test("deployment evidence namespaces fail closed instead of reusing prior authorization evidence", () => {
  const temporary = mkdtempSync(join(tmpdir(), "prometheus-public-evidence-collision-"));
  const directory = join(temporary, "evidence");
  try {
    createPublicDeploymentEvidenceRecorder(directory);
    assert.throws(
      () => createPublicDeploymentEvidenceRecorder(directory),
      error => error instanceof PublicWorkflowV2Error
        && error.code === "EVIDENCE_INVALID"
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("Wrangler consumes authorization only after invocation construction and a successful spawn", async () => {
  let consumed = 0;
  const onProcessStarted = () => { consumed += 1; };

  const invocationFailure = wranglerBoundaryFixture();
  await assert.rejects(
    runBoundaryWrangler({
      fixture: invocationFailure,
      invocationBuilder: () => { throw new Error("synthetic invocation failure"); },
      onProcessStarted
    }),
    PublicDeploymentPolicyError
  );
  assert.equal(invocationFailure.calls, 0);
  assert.equal(consumed, 0);

  const synchronousSpawnFailure = wranglerBoundaryFixture({ throwOnSpawn: true });
  await assert.rejects(
    runBoundaryWrangler({
      fixture: synchronousSpawnFailure,
      invocationBuilder: () => ["synthetic-wrangler"],
      onProcessStarted
    }),
    PublicDeploymentPolicyError
  );
  assert.equal(synchronousSpawnFailure.calls, 1);
  assert.equal(consumed, 0);

  const asynchronousSpawnFailure = wranglerBoundaryFixture({ emitSpawnError: true });
  await assert.rejects(
    runBoundaryWrangler({
      fixture: asynchronousSpawnFailure,
      invocationBuilder: () => ["synthetic-wrangler"],
      onProcessStarted
    }),
    PublicDeploymentPolicyError
  );
  assert.equal(asynchronousSpawnFailure.calls, 1);
  assert.equal(consumed, 0);

  const successfulSpawn = wranglerBoundaryFixture();
  await runBoundaryWrangler({
    fixture: successfulSpawn,
    invocationBuilder: () => ["synthetic-wrangler"],
    onProcessStarted
  });
  assert.equal(successfulSpawn.calls, 1);
  assert.equal(consumed, 1);
});

test("pre-spawn and post-spawn failures each stop after one deployment invocation", async () => {
  const preSpawn = lifecycleFixture({ deployFailure: "before-spawn" });
  try {
    await assert.rejects(preSpawn.result, /synthetic pre-spawn failure/u);
    assert.equal(preSpawn.calls.deploy, 1);
    assert.equal(preSpawn.calls.rollback, 0);
    assert.equal(preSpawn.calls.smoke, 0);
    assert.deepEqual(preSpawn.evidence.phases(), [
      PUBLIC_WORKFLOW_V2_PHASE.DEPLOYMENT_NOT_BEGUN,
      PUBLIC_WORKFLOW_V2_PHASE.LOCAL_PREFLIGHT_PASSED,
      PUBLIC_WORKFLOW_V2_PHASE.PRODUCTION_PREREQUISITES_PASSED
    ]);
  } finally {
    rmSync(preSpawn.temporary, { recursive: true, force: true });
  }

  const postSpawn = lifecycleFixture({ deployFailure: "after-spawn" });
  try {
    await assert.rejects(postSpawn.result, /synthetic post-spawn failure/u);
    assert.equal(postSpawn.calls.deploy, 1);
    assert.equal(postSpawn.calls.rollback, 0);
    assert.equal(postSpawn.calls.smoke, 0);
    assert.deepEqual(postSpawn.evidence.phases(), [
      PUBLIC_WORKFLOW_V2_PHASE.DEPLOYMENT_NOT_BEGUN,
      PUBLIC_WORKFLOW_V2_PHASE.LOCAL_PREFLIGHT_PASSED,
      PUBLIC_WORKFLOW_V2_PHASE.PRODUCTION_PREREQUISITES_PASSED,
      PUBLIC_WORKFLOW_V2_PHASE.AUTHORIZATION_CONSUMED
    ]);
  } finally {
    rmSync(postSpawn.temporary, { recursive: true, force: true });
  }
});

test("authorization is consumed only at the mutation boundary and exactly one forward request occurs", async () => {
  const fixture = lifecycleFixture();
  try {
    const result = await fixture.result;
    assert.equal(result.status, "PUBLIC_WORKER_DEPLOYMENT_VERIFIED");
    assert.equal(fixture.calls.dryRun, 1);
    assert.equal(fixture.calls.deploy, 1);
    assert.equal(fixture.calls.rollback, 0);
    assert.deepEqual(fixture.evidence.phases(), [
      PUBLIC_WORKFLOW_V2_PHASE.DEPLOYMENT_NOT_BEGUN,
      PUBLIC_WORKFLOW_V2_PHASE.LOCAL_PREFLIGHT_PASSED,
      PUBLIC_WORKFLOW_V2_PHASE.PRODUCTION_PREREQUISITES_PASSED,
      PUBLIC_WORKFLOW_V2_PHASE.AUTHORIZATION_CONSUMED,
      PUBLIC_WORKFLOW_V2_PHASE.DEPLOYMENT_REQUEST_COMPLETED,
      PUBLIC_WORKFLOW_V2_PHASE.POST_DEPLOYMENT_VERIFIED
    ]);
  } finally {
    rmSync(fixture.temporary, { recursive: true, force: true });
  }
});

test("private Worker mutation fails closed after the one forward attempt", async () => {
  const fixture = lifecycleFixture({ privateChanged: true });
  try {
    await assert.rejects(fixture.result, error => (
      error instanceof PublicDeploymentPolicyError
      && error.code === "PRIVATE_VERSION_CHANGED"
    ));
    assert.equal(fixture.calls.deploy, 1);
    assert.equal(fixture.calls.rollback, 0);
    assert.equal(fixture.calls.smoke, 0);
  } finally {
    rmSync(fixture.temporary, { recursive: true, force: true });
  }
});

test("critical smoke invokes only the qualified forward rollback once", async () => {
  const fixture = lifecycleFixture({
    smoke: Object.freeze({
      attemptedWriteCount: 0,
      criticalFailures: [Object.freeze({ path: "/", method: "GET" })],
      noncriticalFailures: []
    })
  });
  try {
    const result = await fixture.result;
    assert.equal(result.status, "PUBLIC_WORKER_FORWARD_ROLLBACK_VERIFIED");
    assert.equal(result.deploymentAttempts, 1);
    assert.equal(result.rollbackAttempts, 1);
    assert.equal(fixture.calls.deploy, 1);
    assert.equal(fixture.calls.rollback, 1);
    assert.deepEqual(fixture.evidence.phases().slice(-3), [
      PUBLIC_WORKFLOW_V2_PHASE.CRITICAL_SMOKE_FAILED,
      PUBLIC_WORKFLOW_V2_PHASE.ROLLBACK_REQUEST_BEGUN,
      PUBLIC_WORKFLOW_V2_PHASE.ROLLBACK_VERIFIED
    ]);
  } finally {
    rmSync(fixture.temporary, { recursive: true, force: true });
  }
});

test("noncritical smoke is reported without another mutation", async () => {
  const fixture = lifecycleFixture({
    smoke: Object.freeze({
      attemptedWriteCount: 0,
      criticalFailures: [],
      noncriticalFailures: [Object.freeze({ path: "/sitemap.xml", method: "HEAD" })]
    })
  });
  try {
    const result = await fixture.result;
    assert.equal(result.status, "PUBLIC_WORKER_DEPLOYMENT_VERIFIED_WITH_NONCRITICAL_SMOKE");
    assert.equal(fixture.calls.deploy, 1);
    assert.equal(fixture.calls.rollback, 0);
    assert.equal(fixture.evidence.phases().at(-1), PUBLIC_WORKFLOW_V2_PHASE.NONCRITICAL_SMOKE_REPORTED);
  } finally {
    rmSync(fixture.temporary, { recursive: true, force: true });
  }
});

test("smoke plan is GET/HEAD-only and classifies failures without CRM or notification mutation", async () => {
  const plan = publicWorkerSmokeV2Plan();
  assert.ok(plan.every(entry => ["GET", "HEAD"].includes(entry.method) && entry.body === false));
  let requests = 0;
  const result = await runPublicWorkerSmokeV2({
    timeoutMs: 100,
    fetchImpl: async (_url, init) => {
      requests += 1;
      assert.ok(["GET", "HEAD"].includes(init.method));
      assert.equal(Object.hasOwn(init, "body"), false);
      throw new Error("synthetic network failure");
    }
  });
  assert.equal(requests, plan.length);
  assert.equal(result.attemptedWriteCount, 0);
  assert.ok(result.criticalFailures.length > 0);
  assert.ok(result.noncriticalFailures.length > 0);
  assert.equal(JSON.stringify(result).includes("POST"), false);
  assert.equal(JSON.stringify(result).includes("notification"), false);
});

test("Infrastructure contract preserves CRM, collection, cohort, recommendation, and Anthony boundaries", () => {
  const contract = JSON.parse(readFileSync(join(root, PUBLIC_WORKFLOW_V2_POLICY.contractPath), "utf8"));
  assert.equal(contract.authorization.consumedAt, "forward_wrangler_process_spawn_confirmed");
  assert.equal(contract.authorization.preAuthorizationCloudflareReadOnlyRequestsAllowed, true);
  assert.equal(contract.authorization.preAuthorizationCloudflareMutationRequestsAllowed, false);
  assert.deepEqual(contract.cloudflare.prerequisiteReadsAfterLocalPreBoundary, [
    PUBLIC_WORKFLOW_V2_POLICY.publicWorker,
    PUBLIC_WORKFLOW_V2_POLICY.privateWorker
  ]);
  assert.equal(contract.cloudflare.crmBinding, "ROUTE_IQ_REQUEST_CRM_COORDINATOR");
  assert.equal(contract.cloudflare.crmClass, "RouteIqRequestCrmCoordinator");
  assert.equal(contract.cloudflare.crmMigration, "route-iq-request-crm-sqlite-v1");
  assert.equal(contract.smoke.crmSubmissionAllowed, false);
  assert.equal(contract.smoke.notificationAllowed, false);
  assert.equal(contract.runtimeBoundaries.collection, "OFF");
  assert.equal(contract.runtimeBoundaries.activeCohortCount, 0);
  assert.equal(contract.runtimeBoundaries.recommendationInfluence, "OFF");
  assert.equal(contract.runtimeBoundaries.anthonyMapped, false);
  assert.equal(contract.target.privateWorkerMutationAllowed, false);
});

test("historical production baseline remains immutable as the rollback candidate advances", () => {
  const rollback = JSON.parse(readFileSync(
    join(root, PUBLIC_WORKER_DEPLOYMENT_POLICY.rollbackContractPath),
    "utf8"
  ));
  assert.equal(
    PUBLIC_WORKFLOW_V2_POLICY.successfulProductionBaseline.deploymentAssetsSha256,
    "5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15"
  );
  assert.equal(
    rollback.candidateDeploymentAssetsSha256,
    "6c8361e0402a05a26002ad27f6b8af78cfc3fbacca46a1618871d8a8d814d4ec"
  );
  assert.notEqual(
    rollback.candidateDeploymentAssetsSha256,
    PUBLIC_WORKFLOW_V2_POLICY.successfulProductionBaseline.deploymentAssetsSha256
  );
});

test("the complete static Workflow v2 verifier passes", () => {
  assert.equal(
    verifyGithubActionsPublicWorkerWorkflowV2().status,
    "GITHUB_ACTIONS_PUBLIC_WORKER_WORKFLOW_V2_VERIFIED"
  );
  assert.equal(PUBLIC_WORKER_DEPLOYMENT_POLICY.publicWorker, "prometheusrouteiq-website");
});
