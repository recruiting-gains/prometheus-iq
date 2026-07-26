import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

import {
  PRIVATE_WORKFLOW_V2_FAILURE,
  PRIVATE_WORKFLOW_V2_POLICY,
  PRIVATE_WORKFLOW_V2_RUNTIME_GUARD_BINDINGS,
  PrivateWorkflowV2Error,
  assertPrivateBindingsPreserved,
  assertQualifiedPrivateConfigCanPreserveBindings,
  buildQualifiedPrivateRelease,
  buildQualifiedPrivateWranglerInvocation,
  createPrivateDeploymentEvidenceRecorder,
  createPrivateV2RuntimeRelease,
  createPrivateV2RuntimeWorkspace,
  formatPrivateWorkflowV2Failure,
  privateWorkflowV2SecretEnvironmentNames,
  privateV2PredeploymentSmokeMarkerPolicy,
  qualifiedPrivateConfigForArtifact,
  removePrivateV2RuntimeWorkspace,
  requirePrivateV2ProtectedSecretNames,
  runQualifiedPrivateDeploymentLifecycle,
  scrubPrivateV2RuntimeGuardSettings,
  takePrivateV2RuntimeGuardSettings,
  validatePrivateV2DeploymentInputs,
  validatePrivateV2QualificationInputs,
  verifyPrivateQualificationArtifactMetadata,
  verifyPrivateV2RuntimeRelease,
  verifyQualifiedPrivateRelease
} from "../scripts/lib/github-actions-private-worker-workflow-v2.mjs";
import {
  buildRouteIqPrivateForwardRollbackCandidateV3
} from "../scripts/build-route-iq-private-forward-rollback-candidate-v3.mjs";
import {
  PUBLIC_DEPLOYMENT_FAILURE,
  PublicDeploymentPolicyError
} from "../scripts/lib/github-actions-public-worker-deployment.mjs";
import {
  CLOUDFLARE_UNATTENDED_SMOKE_FAILURE,
  CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY,
  CLOUDFLARE_UNATTENDED_SMOKE_PROBE,
  CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION,
  CloudflareUnattendedSmokeError,
  fixedCloudflareUnattendedSmokePlan,
  runCloudflareUnattendedPostDeploymentSmoke
} from "../scripts/run-cloudflare-unattended-smoke.mjs";
import {
  CLOUDFLARE_UNATTENDED_SMOKE_MARKER,
  CLOUDFLARE_UNATTENDED_SMOKE_VERSION
} from "../workers/infrastructure/cloudflare-unattended-smoke-contract.js";
import { verifyGithubActionsPrivateWorkerWorkflowV2 } from "../scripts/verify-github-actions-private-worker-workflow-v2.mjs";

const root = resolve(import.meta.dirname, "..");
const commit = "8976c077eef91147368c9b5566b5310c04fd6630";
const tree = "e6d74758013d711547ff77c7a31952d73d5deee7";
const batchId = "BATCH-20260725-001";
const publicVersion = "6a8713c0-0712-4cda-8a13-daa893ca45f2";
const privateVersion = "9ffb32d3-313a-4209-ad1d-0a6702ba8a83";
const deployedPrivateVersion = "11111111-1111-4111-8111-111111111111";
const rolledBackPrivateVersion = "22222222-2222-4222-8222-222222222222";
const runtimeIdentity = Object.freeze({
  runner: PRIVATE_WORKFLOW_V2_POLICY.runner,
  architecture: PRIVATE_WORKFLOW_V2_POLICY.architecture,
  nodeVersion: PRIVATE_WORKFLOW_V2_POLICY.nodeVersion,
  npmVersion: "11.4.2",
  wranglerVersion: PRIVATE_WORKFLOW_V2_POLICY.wranglerVersion,
  smokeRuntime: "authenticated-fixed-get-head-only"
});
const requiredBindings = Object.freeze([
  "AEGIS_RATE_LIMITS:kv_namespace",
  "ASSETS:assets",
  "FOUNDER_EMAIL:send_email",
  "ROUTE_IQ_BUSINESS_AVAILABILITY_COORDINATOR:durable_object_namespace",
  "ROUTE_IQ_PROSPECTIVE_SHADOW_AUTHORITY_KEY:secret_text",
  "ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR:durable_object_namespace"
].sort());

function qualificationInputs() {
  return Object.freeze({
    candidateCommit: commit,
    candidateTree: tree,
    batchId,
    currentPublicVersion: publicVersion,
    currentPrivateVersion: privateVersion
  });
}

function qualificationEnvironment(overrides = {}) {
  const dispatch = {
    candidate_commit: commit,
    candidate_tree: tree,
    batch_id: batchId,
    current_public_version: publicVersion,
    current_private_version: privateVersion
  };
  return {
    PROMETHEUS_CANDIDATE_COMMIT: commit,
    PROMETHEUS_CANDIDATE_TREE: tree,
    PROMETHEUS_BATCH_ID: batchId,
    PROMETHEUS_CURRENT_PUBLIC_VERSION: publicVersion,
    PROMETHEUS_CURRENT_PRIVATE_VERSION: privateVersion,
    PROMETHEUS_DISPATCH_INPUTS_JSON: JSON.stringify(dispatch),
    GITHUB_REPOSITORY: PRIVATE_WORKFLOW_V2_POLICY.repository,
    GITHUB_REF: PRIVATE_WORKFLOW_V2_POLICY.ref,
    GITHUB_REF_NAME: PRIVATE_WORKFLOW_V2_POLICY.branch,
    GITHUB_REF_TYPE: PRIVATE_WORKFLOW_V2_POLICY.refType,
    GITHUB_EVENT_NAME: PRIVATE_WORKFLOW_V2_POLICY.eventName,
    GITHUB_SHA: commit,
    GITHUB_ACTOR: PRIVATE_WORKFLOW_V2_POLICY.founderActor,
    GITHUB_TRIGGERING_ACTOR: PRIVATE_WORKFLOW_V2_POLICY.founderActor,
    GITHUB_WORKFLOW: PRIVATE_WORKFLOW_V2_POLICY.qualificationWorkflowName,
    GITHUB_WORKFLOW_REF: PRIVATE_WORKFLOW_V2_POLICY.qualificationWorkflowRef,
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
    qualification_run_id: "30000000001",
    qualification_artifact_id: "8500000001",
    qualification_artifact_zip_sha256: "1".repeat(64),
    qualified_content_tree_sha256: "2".repeat(64),
    qualified_manifest_sha256: "3".repeat(64),
    workflow_contract_sha256: "4".repeat(64),
    rollback_contract_sha256: "5".repeat(64),
    rollback_bundle_sha256: "6".repeat(64),
    founder_authorization: PRIVATE_WORKFLOW_V2_POLICY.founderAuthorization
  };
  return {
    PROMETHEUS_APPROVED_COMMIT: commit,
    PROMETHEUS_APPROVED_TREE: tree,
    PROMETHEUS_BATCH_ID: batchId,
    PROMETHEUS_CURRENT_PUBLIC_VERSION: publicVersion,
    PROMETHEUS_CURRENT_PRIVATE_VERSION: privateVersion,
    PROMETHEUS_QUALIFICATION_RUN_ID: dispatch.qualification_run_id,
    PROMETHEUS_QUALIFICATION_ARTIFACT_ID: dispatch.qualification_artifact_id,
    PROMETHEUS_QUALIFICATION_ARTIFACT_ZIP_SHA256:
      dispatch.qualification_artifact_zip_sha256,
    PROMETHEUS_QUALIFIED_CONTENT_TREE_SHA256: dispatch.qualified_content_tree_sha256,
    PROMETHEUS_QUALIFIED_MANIFEST_SHA256: dispatch.qualified_manifest_sha256,
    PROMETHEUS_WORKFLOW_CONTRACT_SHA256: dispatch.workflow_contract_sha256,
    PROMETHEUS_ROLLBACK_CONTRACT_SHA256: dispatch.rollback_contract_sha256,
    PROMETHEUS_ROLLBACK_BUNDLE_SHA256: dispatch.rollback_bundle_sha256,
    PROMETHEUS_FOUNDER_AUTHORIZATION: dispatch.founder_authorization,
    PROMETHEUS_DISPATCH_INPUTS_JSON: JSON.stringify(dispatch),
    GITHUB_REPOSITORY: PRIVATE_WORKFLOW_V2_POLICY.repository,
    GITHUB_REF: PRIVATE_WORKFLOW_V2_POLICY.ref,
    GITHUB_REF_NAME: PRIVATE_WORKFLOW_V2_POLICY.branch,
    GITHUB_REF_TYPE: PRIVATE_WORKFLOW_V2_POLICY.refType,
    GITHUB_EVENT_NAME: PRIVATE_WORKFLOW_V2_POLICY.eventName,
    GITHUB_SHA: "f".repeat(40),
    GITHUB_ACTOR: PRIVATE_WORKFLOW_V2_POLICY.founderActor,
    GITHUB_TRIGGERING_ACTOR: PRIVATE_WORKFLOW_V2_POLICY.founderActor,
    GITHUB_WORKFLOW: PRIVATE_WORKFLOW_V2_POLICY.deploymentWorkflowName,
    GITHUB_WORKFLOW_REF: PRIVATE_WORKFLOW_V2_POLICY.deploymentWorkflowRef,
    GITHUB_RUN_ATTEMPT: "1",
    ...overrides
  };
}

function expectedFromBuild(result) {
  return Object.freeze({
    approvedCommit: commit,
    approvedTree: tree,
    batchId,
    currentPublicVersion: publicVersion,
    currentPrivateVersion: privateVersion,
    qualifiedContentTreeSha256: result.contentTreeSha256,
    qualifiedManifestSha256: result.manifestSha256,
    workflowContractSha256: result.workflowContractSha256,
    rollbackContractSha256: result.rollbackContractSha256,
    rollbackBundleSha256: result.rollbackBundleSha256
  });
}

function workerState(versionId, deploymentId, bindings = requiredBindings) {
  return Object.freeze({
    deployment: Object.freeze({ versionId, deploymentId }),
    bindings: Object.freeze([...bindings].sort())
  });
}

function runtimeGuardSettings() {
  return {
    teamDomain: "https://synthetic-private-smoke.cloudflareaccess.com",
    audience: "synthetic-private-smoke-audience",
    serviceTokenClientId: `${"a".repeat(32)}.access`
  };
}

function passingSmoke(
  markerPolicy = CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.REQUIRE_EXACT,
  {
    markerOmitted = false,
    expectedWorkerVersion = deployedPrivateVersion
  } = {}
) {
  const requestCount = 3;
  return Object.freeze({
    status: "passed",
    attemptedWriteCount: 0,
    requestCount,
    markerPolicy,
    markerVerifiedCount: markerOmitted ? 0 : requestCount,
    markerOmittedCount: markerOmitted ? requestCount : 0,
    ...(expectedWorkerVersion === null
      ? {}
      : { expectedWorkerVersion, versionVerifiedCount: requestCount })
  });
}

function lifecycleFixture({
  postSmoke = passingSmoke(),
  postSmokeError,
  deployUncertain = false,
  postSmokeImplementation,
  expectRollback = Boolean(postSmokeError) || deployUncertain
} = {}) {
  const runtimeBindings = Object.freeze([
    ...requiredBindings,
    ...PRIVATE_WORKFLOW_V2_RUNTIME_GUARD_BINDINGS.map(name => (
      name === CLOUDFLARE_UNATTENDED_SMOKE_VERSION.binding
        ? `${name}:version_metadata`
        : `${name}:plain_text`
    ))
  ].sort());
  const initialPrivate = workerState(privateVersion, "private-deployment-1");
  const initialPublic = workerState(publicVersion, "public-deployment-1", ["PUBLIC:plain_text"]);
  const deployedPrivate = workerState(
    deployedPrivateVersion,
    "private-deployment-2",
    runtimeBindings
  );
  const rolledBackPrivate = workerState(
    rolledBackPrivateVersion,
    "private-deployment-3",
    runtimeBindings
  );
  const rollbackExpected = expectRollback
    || postSmoke.status !== "passed"
    || postSmoke.attemptedWriteCount !== 0
    || postSmoke.requestCount <= 0
    || postSmoke.markerPolicy
      !== CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.REQUIRE_EXACT
    || postSmoke.markerVerifiedCount !== postSmoke.requestCount
    || postSmoke.markerOmittedCount !== 0
    || postSmoke.expectedWorkerVersion !== deployedPrivateVersion
    || postSmoke.versionVerifiedCount !== postSmoke.requestCount;
  const privateStates = [
    initialPrivate,
    initialPrivate,
    deployedPrivate,
    ...(rollbackExpected ? [rolledBackPrivate] : [])
  ];
  const publicStates = [
    initialPublic,
    initialPublic,
    initialPublic,
    ...(rollbackExpected ? [initialPublic] : [])
  ];
  const calls = {
    deploy: 0,
    rollback: 0,
    dryRun: 0,
    preSmoke: 0,
    postSmoke: 0,
    phases: []
  };
  const result = runQualifiedPrivateDeploymentLifecycle({
    inputs: Object.freeze({
      approvedCommit: commit,
      approvedTree: tree,
      batchId,
      currentPublicVersion: publicVersion,
      currentPrivateVersion: privateVersion
    }),
    verifyRelease: async () => Object.freeze({
      forwardDirectory: "/qualified/private/forward",
      rollbackDirectory: "/qualified/private/rollback"
    }),
    inspectRepository: async () => Object.freeze({ status: "clean" }),
    fetchState: async worker => (
      worker === PRIVATE_WORKFLOW_V2_POLICY.privateWorker
        ? privateStates.shift()
        : publicStates.shift()
    ),
    verifyInitialBindings: (_release, bindings) => {
      assert.deepEqual(bindings, requiredBindings);
      return Object.freeze({
        initialBindings: requiredBindings,
        forwardExpectedBindings: runtimeBindings,
        rollbackExpectedBindings: runtimeBindings
      });
    },
    runPreSmoke: async ({ markerPolicy }) => {
      calls.preSmoke += 1;
      assert.equal(
        markerPolicy,
        CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.BOOTSTRAP_ALLOW_MISSING
      );
      return passingSmoke(markerPolicy, {
        markerOmitted: true,
        expectedWorkerVersion: null
      });
    },
    runDryRun: async () => {
      calls.dryRun += 1;
    },
    runDeploy: async (_release, consume) => {
      calls.deploy += 1;
      consume();
      if (deployUncertain) throw new Error("synthetic_uncertain_deploy");
    },
    runPostSmoke: async ({ markerPolicy, expectedWorkerVersion }) => {
      calls.postSmoke += 1;
      assert.equal(markerPolicy, CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.REQUIRE_EXACT);
      assert.equal(expectedWorkerVersion, deployedPrivateVersion);
      if (postSmokeError) throw postSmokeError;
      if (postSmokeImplementation) return postSmokeImplementation(expectedWorkerVersion);
      return postSmoke;
    },
    runRollback: async () => {
      calls.rollback += 1;
    },
    evidence: Object.freeze({
      append: phase => calls.phases.push(phase)
    })
  });
  return { result, calls };
}

test("owner verifier accepts the private Workflow v2 source contract", () => {
  assert.equal(
    verifyGithubActionsPrivateWorkerWorkflowV2().status,
    "GITHUB_ACTIONS_PRIVATE_WORKER_WORKFLOW_V2_VERIFIED"
  );
});

test("qualification input validation requires exact Founder, main, first-attempt context", () => {
  assert.deepEqual(validatePrivateV2QualificationInputs(qualificationEnvironment()), qualificationInputs());
  for (const overrides of [
    { GITHUB_ACTOR: "someone-else" },
    { GITHUB_TRIGGERING_ACTOR: "someone-else" },
    { GITHUB_REF_NAME: "feature" },
    { GITHUB_RUN_ATTEMPT: "2" },
    { GITHUB_SHA: "a".repeat(40) },
    { PROMETHEUS_CANDIDATE_TREE: "A".repeat(40) }
  ]) {
    assert.throws(
      () => validatePrivateV2QualificationInputs(qualificationEnvironment(overrides)),
      PrivateWorkflowV2Error
    );
  }
  const extra = qualificationEnvironment();
  const dispatch = JSON.parse(extra.PROMETHEUS_DISPATCH_INPUTS_JSON);
  dispatch.unapproved = "value";
  extra.PROMETHEUS_DISPATCH_INPUTS_JSON = JSON.stringify(dispatch);
  assert.throws(() => validatePrivateV2QualificationInputs(extra), PrivateWorkflowV2Error);
});

test("deployment input validation pins every artifact identity without requiring current main to equal candidate", () => {
  const result = validatePrivateV2DeploymentInputs(deploymentEnvironment());
  assert.equal(result.approvedCommit, commit);
  assert.equal(result.qualificationArtifactId, "8500000001");
  assert.equal(deploymentEnvironment().GITHUB_SHA, "f".repeat(40));
  for (const overrides of [
    { GITHUB_ACTOR: "someone-else" },
    { GITHUB_RUN_ATTEMPT: "2" },
    { PROMETHEUS_QUALIFICATION_ARTIFACT_ZIP_SHA256: "1".repeat(63) },
    { PROMETHEUS_FOUNDER_AUTHORIZATION: "approve" }
  ]) {
    assert.throws(
      () => validatePrivateV2DeploymentInputs(deploymentEnvironment(overrides)),
      PrivateWorkflowV2Error
    );
  }
});

test("all six protected names are required before any production request", () => {
  const complete = Object.fromEntries(
    privateWorkflowV2SecretEnvironmentNames.map(name => [name, "fixture"])
  );
  assert.equal(Object.keys(complete).length, 6);
  assert.equal(
    requirePrivateV2ProtectedSecretNames({ ...complete }).status,
    "PRIVATE_WORKER_V2_REQUIRED_PROTECTED_SECRET_NAMES_PRESENT"
  );
  for (const name of Object.keys(complete)) {
    const environment = { ...complete };
    delete environment[name];
    assert.throws(
      () => requirePrivateV2ProtectedSecretNames(environment),
      error => (
        error instanceof PrivateWorkflowV2Error
        && error.code === PRIVATE_WORKFLOW_V2_FAILURE.REQUIRED_PROTECTED_SECRET_NAMES_MISSING
        && formatPrivateWorkflowV2Failure(error)
          === PRIVATE_WORKFLOW_V2_FAILURE.REQUIRED_PROTECTED_SECRET_NAMES_MISSING
      )
    );
  }
});

test("runtime guard settings are consumed, strictly validated, scrubbed, and never returned", () => {
  const [teamDomainName, audienceName] = privateWorkflowV2SecretEnvironmentNames.slice(-2);
  const environment = {
    [teamDomainName]: "https://synthetic-private-smoke.cloudflareaccess.com",
    [audienceName]: "synthetic-private-smoke-audience"
  };
  const settings = takePrivateV2RuntimeGuardSettings(
    environment,
    `${"a".repeat(32)}.access`
  );
  assert.equal(Object.hasOwn(environment, teamDomainName), false);
  assert.equal(Object.hasOwn(environment, audienceName), false);
  assert.equal(settings.teamDomain, "https://synthetic-private-smoke.cloudflareaccess.com");
  scrubPrivateV2RuntimeGuardSettings(settings);
  assert.deepEqual(settings, {
    teamDomain: "",
    audience: "",
    serviceTokenClientId: ""
  });

  for (const [teamDomain, audience, clientId] of [
    ["http://synthetic-private-smoke.cloudflareaccess.com", "valid-audience", `${"a".repeat(32)}.access`],
    ["https://synthetic-private-smoke.cloudflareaccess.com/", "valid-audience", `${"a".repeat(32)}.access`],
    ["https://synthetic-private-smoke.cloudflareaccess.com", "contains whitespace", `${"a".repeat(32)}.access`],
    ["https://synthetic-private-smoke.cloudflareaccess.com", "valid-audience", "invalid-client"]
  ]) {
    assert.throws(
      () => takePrivateV2RuntimeGuardSettings({
        [teamDomainName]: teamDomain,
        [audienceName]: audience
      }, clientId),
      error => (
        error instanceof PrivateWorkflowV2Error
        && error.code === PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_CONFIGURATION_INVALID
      )
    );
  }
});

test("runtime workspace canonicalizes only the default temporary alias", () => {
  const temporary = mkdtempSync(join(tmpdir(), "prometheus-private-v2-runtime-boundary-"));
  let workspace;
  const temporaryEnvironmentNames = ["RUNNER_TEMP", "TMPDIR", "TMP", "TEMP"];
  const previousTemporaryEnvironment = Object.fromEntries(
    temporaryEnvironmentNames.map(name => [name, process.env[name]])
  );
  try {
    const canonicalBase = join(temporary, "canonical-base");
    const symlink = join(temporary, "linked-base");
    mkdirSync(canonicalBase, { mode: 0o700 });
    symlinkSync(canonicalBase, symlink);
    assert.throws(
      () => createPrivateV2RuntimeWorkspace(symlink),
      error => (
        error instanceof PrivateWorkflowV2Error
        && error.code === PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID
      )
    );
    for (const name of temporaryEnvironmentNames) process.env[name] = symlink;
    workspace = createPrivateV2RuntimeWorkspace();
    assert.equal(resolve(workspace).startsWith(`${resolve(symlink)}${sep}`), false);
    assert.equal(
      resolve(workspace).startsWith(`${realpathSync(canonicalBase)}${sep}`),
      true
    );
    assert.equal(lstatSync(workspace).mode & 0o777, 0o700);
    chmodSync(workspace, 0o755);
    assert.throws(
      () => createPrivateV2RuntimeRelease({
        workspace,
        verifiedRelease: {},
        settings: runtimeGuardSettings()
      }),
      PrivateWorkflowV2Error
    );
  } finally {
    for (const name of temporaryEnvironmentNames) {
      const value = previousTemporaryEnvironment[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    removePrivateV2RuntimeWorkspace(workspace);
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("runtime workspace rejects dangling and non-directory aliases", () => {
  const temporary = mkdtempSync(join(tmpdir(), "prometheus-private-v2-runtime-invalid-"));
  try {
    const fileTarget = join(temporary, "not-a-directory");
    const fileAlias = join(temporary, "file-alias");
    const danglingAlias = join(temporary, "dangling-alias");
    writeFileSync(fileTarget, "fixture", { mode: 0o600 });
    symlinkSync(fileTarget, fileAlias);
    symlinkSync(join(temporary, "missing"), danglingAlias);
    for (const candidate of [fileAlias, danglingAlias]) {
      assert.throws(
        () => createPrivateV2RuntimeWorkspace(candidate),
        error => (
          error instanceof PrivateWorkflowV2Error
          && error.code === PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID
        )
      );
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("only the pinned guardless baseline may use bootstrap marker omission", () => {
  assert.equal(
    privateV2PredeploymentSmokeMarkerPolicy(privateVersion),
    CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.BOOTSTRAP_ALLOW_MISSING
  );
  assert.equal(
    privateV2PredeploymentSmokeMarkerPolicy("11111111-1111-4111-8111-111111111111"),
    CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.REQUIRE_EXACT
  );
});

test("forward and rollback qualified configurations use the same all-path request boundary", () => {
  const forward = JSON.parse(qualifiedPrivateConfigForArtifact(
    readFileSync(resolve(root, "wrangler.jsonc"), "utf8")
  ));
  const rollback = JSON.parse(qualifiedPrivateConfigForArtifact(
    readFileSync(
      resolve(root, "workers/infrastructure/route-iq-private-forward-rollback-wrangler-v3.json"),
      "utf8"
    ),
    { rollback: true }
  ));
  assert.equal(forward.name, PRIVATE_WORKFLOW_V2_POLICY.privateWorker);
  assert.equal(forward.keep_vars, true);
  assert.deepEqual(forward.assets.run_worker_first, ["/*"]);
  assert.deepEqual(rollback.assets.run_worker_first, ["/*"]);
  assert.equal(Object.hasOwn(forward, "routes"), false);
  assert.equal(Object.hasOwn(rollback, "routes"), false);
});

test("binding transition permits only qualified additions plus guard settings", () => {
  const temporary = mkdtempSync(join(tmpdir(), "prometheus-private-v2-bindings-"));
  const forwardDirectory = join(temporary, "forward");
  const rollbackDirectory = join(temporary, "rollback");
  mkdirSync(forwardDirectory, { mode: 0o700 });
  mkdirSync(rollbackDirectory, { mode: 0o700 });
  const guardVars = Object.fromEntries(
    PRIVATE_WORKFLOW_V2_RUNTIME_GUARD_BINDINGS
      .filter(name => name !== CLOUDFLARE_UNATTENDED_SMOKE_VERSION.binding)
      .map(name => [name, "synthetic"])
  );
  const config = {
    assets: { binding: "ASSETS" },
    vars: { QUALIFIED_ADDITION: "ON", ...guardVars },
    kv_namespaces: [{ binding: "EXISTING_STORE" }],
    durable_objects: { bindings: [{ name: "QUALIFIED_COORDINATOR" }] },
    version_metadata: { binding: CLOUDFLARE_UNATTENDED_SMOKE_VERSION.binding }
  };
  const configName = PRIVATE_WORKFLOW_V2_POLICY.qualifiedConfigFile;
  try {
    writeFileSync(join(forwardDirectory, configName), JSON.stringify(config), { mode: 0o600 });
    writeFileSync(join(rollbackDirectory, configName), JSON.stringify(config), { mode: 0o600 });
    const initial = [
      "ASSETS:assets",
      "EXISTING_STORE:kv_namespace",
      "LEGACY_RUNTIME_VALUE:plain_text",
      "PROTECTED_AUTHORITY:secret_text"
    ].sort();
    const plan = assertQualifiedPrivateConfigCanPreserveBindings({
      forwardDirectory,
      rollbackDirectory
    }, initial);
    for (const expected of [
      "QUALIFIED_ADDITION:plain_text",
      "QUALIFIED_COORDINATOR:durable_object_namespace",
      ...PRIVATE_WORKFLOW_V2_RUNTIME_GUARD_BINDINGS.map(name => (
        name === CLOUDFLARE_UNATTENDED_SMOKE_VERSION.binding
          ? `${name}:version_metadata`
          : `${name}:plain_text`
      ))
    ]) {
      assert.ok(plan.forwardExpectedBindings.includes(expected));
      assert.ok(plan.rollbackExpectedBindings.includes(expected));
    }
    assertPrivateBindingsPreserved(
      plan.forwardExpectedBindings,
      [...plan.forwardExpectedBindings].reverse()
    );
    assert.throws(
      () => assertPrivateBindingsPreserved(
        plan.forwardExpectedBindings,
        [...plan.forwardExpectedBindings, "UNEXPECTED:plain_text"]
      ),
      PrivateWorkflowV2Error
    );
    assert.throws(
      () => assertPrivateBindingsPreserved(
        plan.forwardExpectedBindings,
        plan.forwardExpectedBindings.slice(1)
      ),
      PrivateWorkflowV2Error
    );

    writeFileSync(
      join(rollbackDirectory, configName),
      JSON.stringify({ ...config, kv_namespaces: [] }),
      { mode: 0o600 }
    );
    assert.throws(
      () => assertQualifiedPrivateConfigCanPreserveBindings({
        forwardDirectory,
        rollbackDirectory
      }, initial),
      PrivateWorkflowV2Error
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("qualified artifact contains actual no-bundle forward payload and rollback and detects tampering", () => {
  const temporary = mkdtempSync(join(tmpdir(), "prometheus-private-v2-artifact-test-"));
  const release = join(temporary, "release");
  let runtimeWorkspace;
  try {
    const result = buildQualifiedPrivateRelease(root, {
      outputDirectory: release,
      inputs: qualificationInputs(),
      runtimeIdentity,
      temporaryRoot: temporary,
      rollbackBuilder: options => buildRouteIqPrivateForwardRollbackCandidateV3({
        ...options,
        sourceRef: "WORKTREE"
      }),
      verifyRepositoryBoundary: false
    });
    assert.equal(
      result.forwardPayloadSha256,
      PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.forwardPayloadSha256
    );
    assert.equal(
      result.rollbackBundleSha256,
      PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.rollbackBundleSha256
    );
    const manifest = JSON.parse(readFileSync(
      join(release, PRIVATE_WORKFLOW_V2_POLICY.manifestFile),
      "utf8"
    ));
    assert.ok(Object.hasOwn(
      manifest.identities.governedSourceSha256,
      PRIVATE_WORKFLOW_V2_POLICY.smokeRunnerPath
    ));
    assert.ok(Object.hasOwn(
      manifest.identities.governedSourceSha256,
      PRIVATE_WORKFLOW_V2_POLICY.runtimeGuardTestPath
    ));
    const verified = verifyQualifiedPrivateRelease(
      root,
      release,
      expectedFromBuild(result),
      runtimeIdentity,
      { verifyRepositoryBoundary: false }
    );
    assert.equal(
      readFileSync(join(
        verified.forwardDirectory,
        PRIVATE_WORKFLOW_V2_POLICY.qualifiedConfigFile
      ), "utf8").includes("\"main\":\"./worker/prometheus-iq-worker.js\""),
      true
    );
    const sourceConfigPath = join(
      verified.forwardDirectory,
      PRIVATE_WORKFLOW_V2_POLICY.qualifiedConfigFile
    );
    const sourceConfigBefore = readFileSync(sourceConfigPath, "utf8");
    const settings = runtimeGuardSettings();
    runtimeWorkspace = createPrivateV2RuntimeWorkspace(temporary);
    const runtimeRelease = createPrivateV2RuntimeRelease({
      workspace: runtimeWorkspace,
      verifiedRelease: verified,
      settings
    });
    assert.equal(
      verifyPrivateV2RuntimeRelease(runtimeRelease, settings).status,
      "PRIVATE_WORKER_V2_RUNTIME_GUARD_CONFIG_VERIFIED"
    );
    assert.equal(new Set(Object.values(runtimeRelease.wranglerOutdirs)).size, 3);
    const guardedRootEntries = [
      "assets",
      PRIVATE_WORKFLOW_V2_POLICY.qualifiedConfigFile,
      "worker"
    ].sort();
    const dryRunInvocation = buildQualifiedPrivateWranglerInvocation(
      "dry-run",
      { approvedCommit: commit, approvedTree: tree, batchId },
      runtimeRelease
    );
    const dryRun = spawnSync(process.execPath, dryRunInvocation, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        CI: "true",
        NO_COLOR: "1",
        WRANGLER_SEND_METRICS: "false",
        CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false"
      }
    });
    assert.equal(dryRun.status, 0);
    assert.deepEqual(readdirSync(runtimeRelease.forwardDirectory).sort(), guardedRootEntries);
    assert.deepEqual(readdirSync(runtimeRelease.rollbackDirectory).sort(), guardedRootEntries);
    assert.equal(
      readdirSync(runtimeRelease.wranglerOutdirs["dry-run"])
        .includes(PRIVATE_WORKFLOW_V2_POLICY.generatedWorkerFile),
      true
    );
    assert.equal(
      verifyPrivateV2RuntimeRelease(runtimeRelease, settings).status,
      "PRIVATE_WORKER_V2_RUNTIME_GUARD_CONFIG_VERIFIED"
    );
    const unexpectedWranglerDirectory = join(runtimeRelease.forwardDirectory, ".wrangler");
    mkdirSync(unexpectedWranglerDirectory, { mode: 0o700 });
    assert.throws(
      () => verifyPrivateV2RuntimeRelease(runtimeRelease, settings),
      PrivateWorkflowV2Error
    );
    rmSync(unexpectedWranglerDirectory, { recursive: true });
    chmodSync(runtimeRelease.scratchDirectory, 0o755);
    assert.throws(
      () => verifyPrivateV2RuntimeRelease(runtimeRelease, settings),
      PrivateWorkflowV2Error
    );
    chmodSync(runtimeRelease.scratchDirectory, 0o700);
    const deployOutdir = runtimeRelease.wranglerOutdirs.deploy;
    rmSync(deployOutdir, { recursive: true });
    symlinkSync(runtimeRelease.wranglerOutdirs.rollback, deployOutdir);
    assert.throws(
      () => verifyPrivateV2RuntimeRelease(runtimeRelease, settings),
      PrivateWorkflowV2Error
    );
    unlinkSync(deployOutdir);
    mkdirSync(deployOutdir, { mode: 0o700 });
    chmodSync(deployOutdir, 0o700);
    assert.throws(
      () => buildQualifiedPrivateWranglerInvocation(
        "deploy",
        { approvedCommit: commit, approvedTree: tree, batchId },
        {
          ...runtimeRelease,
          wranglerOutdirs: {
            ...runtimeRelease.wranglerOutdirs,
            deploy: join(runtimeRelease.forwardDirectory, "cross-target")
          }
        }
      ),
      PrivateWorkflowV2Error
    );
    assert.equal(
      verifyPrivateV2RuntimeRelease(runtimeRelease, settings).status,
      "PRIVATE_WORKER_V2_RUNTIME_GUARD_CONFIG_VERIFIED"
    );
    const bindingTransition = assertQualifiedPrivateConfigCanPreserveBindings(
      runtimeRelease,
      requiredBindings
    );
    for (const name of PRIVATE_WORKFLOW_V2_RUNTIME_GUARD_BINDINGS) {
      const type = name === CLOUDFLARE_UNATTENDED_SMOKE_VERSION.binding
        ? "version_metadata"
        : "plain_text";
      assert.ok(bindingTransition.forwardExpectedBindings.includes(`${name}:${type}`));
      assert.ok(bindingTransition.rollbackExpectedBindings.includes(`${name}:${type}`));
    }
    const runtimeConfigPath = join(
      runtimeRelease.forwardDirectory,
      PRIVATE_WORKFLOW_V2_POLICY.qualifiedConfigFile
    );
    assert.equal(lstatSync(runtimeWorkspace).mode & 0o077, 0);
    assert.equal(lstatSync(runtimeConfigPath).mode & 0o777, 0o600);
    assert.equal(JSON.stringify(runtimeRelease).includes(settings.teamDomain), false);
    assert.equal(JSON.stringify(runtimeRelease).includes(settings.audience), false);
    assert.equal(JSON.stringify(runtimeRelease).includes(settings.serviceTokenClientId), false);
    assert.equal(readFileSync(sourceConfigPath, "utf8"), sourceConfigBefore);
    assert.equal(sourceConfigBefore.includes(settings.teamDomain), false);
    assert.throws(
      () => createPrivateV2RuntimeRelease({
        workspace: runtimeWorkspace,
        verifiedRelease: verified,
        settings
      }),
      PrivateWorkflowV2Error
    );
    chmodSync(runtimeConfigPath, 0o644);
    assert.throws(
      () => verifyPrivateV2RuntimeRelease(runtimeRelease, settings),
      error => (
        error instanceof PrivateWorkflowV2Error
        && error.code === PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID
      )
    );
    chmodSync(runtimeConfigPath, 0o600);
    const runtimeConfigBackup = join(runtimeWorkspace, "forward-config-backup");
    renameSync(runtimeConfigPath, runtimeConfigBackup);
    symlinkSync(sourceConfigPath, runtimeConfigPath);
    assert.throws(
      () => verifyPrivateV2RuntimeRelease(runtimeRelease, settings),
      PrivateWorkflowV2Error
    );
    rmSync(runtimeConfigPath);
    renameSync(runtimeConfigBackup, runtimeConfigPath);
    assert.equal(
      verifyPrivateV2RuntimeRelease(runtimeRelease, settings).status,
      "PRIVATE_WORKER_V2_RUNTIME_GUARD_CONFIG_VERIFIED"
    );
    removePrivateV2RuntimeWorkspace(runtimeWorkspace);
    assert.equal(existsSync(runtimeWorkspace), false);
    runtimeWorkspace = undefined;
    const worker = join(
      verified.forwardDirectory,
      "worker",
      PRIVATE_WORKFLOW_V2_POLICY.generatedWorkerFile
    );
    const quarantined = `${worker}.quarantined`;
    renameSync(worker, quarantined);
    assert.throws(
      () => verifyQualifiedPrivateRelease(
        root,
        release,
        expectedFromBuild(result),
        runtimeIdentity,
        { verifyRepositoryBoundary: false }
      ),
      PrivateWorkflowV2Error
    );
    renameSync(quarantined, worker);
    assert.equal(
      verifyQualifiedPrivateRelease(
        root,
        release,
        expectedFromBuild(result),
        runtimeIdentity,
        { verifyRepositoryBoundary: false }
      ).status,
      "PRIVATE_WORKER_V2_QUALIFIED_ARTIFACT_VERIFIED"
    );
  } finally {
    removePrivateV2RuntimeWorkspace(runtimeWorkspace);
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("Wrangler invocations are private-only, no-bundle, strict, and carry no name override", () => {
  const inputs = {
    approvedCommit: commit,
    approvedTree: tree,
    batchId
  };
  const release = {
    forwardDirectory: "/qualified/private/runtime/forward",
    rollbackDirectory: "/qualified/private/runtime/rollback",
    scratchDirectory: "/qualified/private/runtime/wrangler-scratch",
    wranglerOutdirs: {
      "dry-run": "/qualified/private/runtime/wrangler-scratch/dry-run",
      deploy: "/qualified/private/runtime/wrangler-scratch/deploy",
      rollback: "/qualified/private/runtime/wrangler-scratch/rollback"
    }
  };
  for (const mode of ["dry-run", "deploy", "rollback"]) {
    const invocation = buildQualifiedPrivateWranglerInvocation(mode, inputs, release);
    assert.equal(invocation.includes("--no-bundle"), true);
    assert.equal(invocation.includes("--keep-vars"), true);
    assert.equal(invocation.includes("--strict"), true);
    assert.equal(invocation.includes("--name"), false);
    assert.equal(invocation.includes(PRIVATE_WORKFLOW_V2_POLICY.publicWorker), false);
    assert.equal(invocation.includes("--dry-run"), mode === "dry-run");
    assert.equal(invocation.filter(value => value === "--outdir").length, 1);
    assert.equal(
      invocation[invocation.indexOf("--outdir") + 1],
      release.wranglerOutdirs[mode]
    );
  }
});

test("GitHub artifact metadata is exact, GET-only, redirect-denying, and token-scrubbing", async () => {
  const environment = {
    PROMETHEUS_GITHUB_TOKEN: "fixture-token",
    PROMETHEUS_QUALIFICATION_ARTIFACT_ID: "8500000001",
    PROMETHEUS_QUALIFICATION_RUN_ID: "30000000001",
    PROMETHEUS_APPROVED_COMMIT: commit,
    PROMETHEUS_QUALIFICATION_ARTIFACT_ZIP_SHA256: "1".repeat(64)
  };
  let request;
  const result = await verifyPrivateQualificationArtifactMetadata(
    environment,
    async (url, options) => {
      request = { url: String(url), options };
      return new Response(JSON.stringify({
        id: 8500000001,
        expired: false,
        name: `${PRIVATE_WORKFLOW_V2_POLICY.artifactNamePrefix}-${commit}`,
        digest: `sha256:${"1".repeat(64)}`,
        workflow_run: {
          id: 30000000001,
          head_sha: commit
        }
      }), { status: 200 });
    }
  );
  assert.equal(result.status, "PRIVATE_WORKER_V2_ARTIFACT_METADATA_VERIFIED");
  assert.equal(environment.PROMETHEUS_GITHUB_TOKEN, undefined);
  assert.equal(request.options.method, "GET");
  assert.equal(request.options.redirect, "manual");
  assert.equal(request.options.credentials, "omit");
  assert.equal(Object.hasOwn(result, "token"), false);

  for (const response of [
    new Response(JSON.stringify({
      id: 8500000001,
      expired: false,
      name: `${PRIVATE_WORKFLOW_V2_POLICY.artifactNamePrefix}-${commit}`,
      digest: `sha256:${"9".repeat(64)}`,
      workflow_run: { id: 30000000001, head_sha: commit }
    }), { status: 200 }),
    {
      redirected: true,
      status: 302,
      arrayBuffer: async () => new ArrayBuffer(0)
    }
  ]) {
    const rejectedEnvironment = {
      PROMETHEUS_GITHUB_TOKEN: "fixture-token",
      PROMETHEUS_QUALIFICATION_ARTIFACT_ID: "8500000001",
      PROMETHEUS_QUALIFICATION_RUN_ID: "30000000001",
      PROMETHEUS_APPROVED_COMMIT: commit,
      PROMETHEUS_QUALIFICATION_ARTIFACT_ZIP_SHA256: "1".repeat(64)
    };
    assert.rejects(
      verifyPrivateQualificationArtifactMetadata(
        rejectedEnvironment,
        async () => response
      ),
      PrivateWorkflowV2Error
    );
    assert.equal(rejectedEnvironment.PROMETHEUS_GITHUB_TOKEN, undefined);
  }
});

test("failure output preserves only fixed public and smoke classifications", () => {
  const publicFailure = formatPrivateWorkflowV2Failure(new PublicDeploymentPolicyError(
    PUBLIC_DEPLOYMENT_FAILURE.HTTP_FAILED,
    [
      "CLOUDFLARE_READ_PHASE=PRIVATE_DEPLOYMENTS",
      "HTTP_STATUS=403",
      "URL=https://sensitive.invalid/private"
    ]
  ));
  assert.equal(
    publicFailure,
    "PUBLIC_DEPLOYMENT_POLICY_FAILURE|CODE=HTTP_FAILED|PHASE=PRIVATE_DEPLOYMENTS|REASON=UNSPECIFIED"
  );
  assert.equal(publicFailure.includes("403"), false);
  assert.equal(publicFailure.includes("sensitive"), false);

  assert.equal(
    formatPrivateWorkflowV2Failure(new PublicDeploymentPolicyError(
      PUBLIC_DEPLOYMENT_FAILURE.DEPLOY_FAILED,
      [
        "WRANGLER_PHASE=DEPLOY",
        "WRANGLER_FAILURE_REASON=AUTHORIZATION_DENIED",
        "HTTP_STATUS=403"
      ]
    )),
    "PUBLIC_DEPLOYMENT_POLICY_FAILURE|CODE=DEPLOY_FAILED|PHASE=DEPLOY|REASON=AUTHORIZATION_DENIED"
  );

  const smokeFailure = formatPrivateWorkflowV2Failure(
    new CloudflareUnattendedSmokeError(
      CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.GUARD_MARKER_MISSING,
      CLOUDFLARE_UNATTENDED_SMOKE_PROBE.WEB_MANIFEST_GET
    )
  );
  assert.equal(
    smokeFailure,
    "SMOKE_FAILURE|DIMENSION=GUARD_MARKER_MISSING|PROBE=WEB_MANIFEST_GET"
  );
  assert.equal(smokeFailure.includes("http"), false);
  assert.equal(smokeFailure.includes("/"), false);
});

test("successful lifecycle performs one private deployment and zero rollback attempts", async () => {
  const { result, calls } = lifecycleFixture();
  assert.equal((await result).status, "PRIVATE_WORKER_V2_DEPLOYMENT_VERIFIED");
  assert.equal(calls.deploy, 1);
  assert.equal(calls.rollback, 0);
  assert.equal(calls.dryRun, 1);
  assert.equal(calls.preSmoke, 1);
  assert.equal(calls.postSmoke, 1);
  assert.equal(calls.phases.filter(phase => phase === "AUTHORIZATION_CONSUMED").length, 1);
});

test("a critical post-deployment write attempt triggers one forward rollback", async () => {
  const { result, calls } = lifecycleFixture({
    postSmoke: Object.freeze({
      status: "passed",
      attemptedWriteCount: 1,
      requestCount: 3
    })
  });
  assert.equal((await result).status, "PRIVATE_WORKER_V2_FORWARD_ROLLBACK_VERIFIED");
  assert.equal(calls.deploy, 1);
  assert.equal(calls.rollback, 1);
});

test("a postdeployment guard-marker failure preserves its dimension through one rollback", async () => {
  const { result, calls } = lifecycleFixture({
    postSmokeError: new CloudflareUnattendedSmokeError(
      CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.GUARD_MARKER_MISSING,
      CLOUDFLARE_UNATTENDED_SMOKE_PROBE.WEB_MANIFEST_GET
    )
  });
  const completed = await result;
  assert.equal(completed.status, "PRIVATE_WORKER_V2_FORWARD_ROLLBACK_VERIFIED");
  assert.equal(
    completed.failureClassification,
    "SMOKE_FAILURE|DIMENSION=GUARD_MARKER_MISSING|PROBE=WEB_MANIFEST_GET"
  );
  assert.equal(calls.deploy, 1);
  assert.equal(calls.rollback, 1);
});

test("a bounded postdeployment propagation timeout triggers one forward rollback", async () => {
  const { result, calls } = lifecycleFixture({
    postSmokeError: new CloudflareUnattendedSmokeError(
      CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.GUARD_PROPAGATION_TIMEOUT
    )
  });
  const completed = await result;
  assert.equal(completed.status, "PRIVATE_WORKER_V2_FORWARD_ROLLBACK_VERIFIED");
  assert.equal(
    completed.failureClassification,
    "SMOKE_FAILURE|DIMENSION=GUARD_PROPAGATION_TIMEOUT|PROBE=UNSPECIFIED"
  );
  assert.equal(calls.deploy, 1);
  assert.equal(calls.rollback, 1);
});

test("a stale guarded release identity triggers one forward rollback", async () => {
  const { result, calls } = lifecycleFixture({
    postSmokeError: new CloudflareUnattendedSmokeError(
      CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.RELEASE_IDENTITY_MISMATCH
    )
  });
  const completed = await result;
  assert.equal(completed.status, "PRIVATE_WORKER_V2_FORWARD_ROLLBACK_VERIFIED");
  assert.equal(
    completed.failureClassification,
    "SMOKE_FAILURE|DIMENSION=RELEASE_IDENTITY_MISMATCH|PROBE=UNSPECIFIED"
  );
  assert.equal(calls.deploy, 1);
  assert.equal(calls.rollback, 1);
});

test("real bounded propagation timeout reaches the lifecycle rollback exactly once", async () => {
  let readinessRequests = 0;
  const { result, calls } = lifecycleFixture({
    expectRollback: true,
    postSmokeImplementation: expectedWorkerVersion =>
      runCloudflareUnattendedPostDeploymentSmoke({
      dryRun: false,
      expectedWorkerVersion,
      credentials: {
        [["CLOUDFLARE", "ACCESS", "CLIENT", "ID"].join("_")]: "synthetic-id",
        [["CLOUDFLARE", "ACCESS", "CLIENT", "SECRET"].join("_")]: "synthetic-secret"
      },
      sleepImpl: async () => {},
      async fetchImpl(url) {
        readinessRequests += 1;
        assert.ok(fixedCloudflareUnattendedSmokePlan().some(entry => (
          new URL(entry.url).pathname === new URL(url).pathname
        )));
        return new Response(null, { status: 200 });
      }
    })
  });
  const completed = await result;
  assert.equal(completed.status, "PRIVATE_WORKER_V2_FORWARD_ROLLBACK_VERIFIED");
  assert.equal(
    completed.failureClassification,
    "SMOKE_FAILURE|DIMENSION=GUARD_PROPAGATION_TIMEOUT|PROBE=ROOT_GET"
  );
  assert.equal(
    readinessRequests,
    CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.maxAttempts
      * fixedCloudflareUnattendedSmokePlan().length
  );
  assert.equal(calls.deploy, 1);
  assert.equal(calls.postSmoke, 1);
  assert.equal(calls.rollback, 1);
});

test("real unsafe propagation responses never retry before lifecycle rollback", async () => {
  const cases = [
    [
      () => new Response(null, {
        status: 200,
        headers: {
          [CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseHeader]: "invalid-marker"
        }
      }),
      CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.GUARD_MARKER_INVALID
    ],
    [
      () => new Response(null, {
        status: 302,
        headers: { Location: "https://example.invalid/blocked" }
      }),
      CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.REDIRECT_DENIED
    ],
    [
      () => new Response(null, { status: 403 }),
      CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.HTTP_STATUS_REJECTED
    ],
    [
      () => {
        throw new Error("sensitive transport detail");
      },
      CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.NETWORK_FAILED
    ]
  ];
  for (const [response, dimension] of cases) {
    let readinessRequests = 0;
    const { result, calls } = lifecycleFixture({
      expectRollback: true,
      postSmokeImplementation: expectedWorkerVersion =>
        runCloudflareUnattendedPostDeploymentSmoke({
        dryRun: false,
        expectedWorkerVersion,
        credentials: {
          [["CLOUDFLARE", "ACCESS", "CLIENT", "ID"].join("_")]: "synthetic-id",
          [["CLOUDFLARE", "ACCESS", "CLIENT", "SECRET"].join("_")]: "synthetic-secret"
        },
        sleepImpl: async () => {
          assert.fail("unsafe response classes must not wait or retry");
        },
        async fetchImpl() {
          readinessRequests += 1;
          return response();
        }
      })
    });
    const completed = await result;
    assert.equal(completed.status, "PRIVATE_WORKER_V2_FORWARD_ROLLBACK_VERIFIED");
    assert.equal(
      completed.failureClassification,
      `SMOKE_FAILURE|DIMENSION=${dimension}|PROBE=ROOT_GET`
    );
    assert.equal(completed.failureClassification.includes("sensitive"), false);
    assert.equal(completed.failureClassification.includes("example.invalid"), false);
    assert.equal(readinessRequests, fixedCloudflareUnattendedSmokePlan().length);
    assert.equal(calls.deploy, 1);
    assert.equal(calls.postSmoke, 1);
    assert.equal(calls.rollback, 1);
  }
});

test("an uncertain deployment after process start triggers one forward rollback without retry", async () => {
  const { result, calls } = lifecycleFixture({ deployUncertain: true });
  assert.equal((await result).status, "PRIVATE_WORKER_V2_FORWARD_ROLLBACK_VERIFIED");
  assert.equal(calls.deploy, 1);
  assert.equal(calls.rollback, 1);
});

test("stale production identity fails before smoke, deployment, or rollback", async () => {
  const calls = { deploy: 0, rollback: 0, smoke: 0 };
  await assert.rejects(
    runQualifiedPrivateDeploymentLifecycle({
      inputs: {
        currentPrivateVersion: privateVersion,
        currentPublicVersion: publicVersion
      },
      verifyRelease: async () => ({}),
      inspectRepository: async () => ({}),
      fetchState: async worker => (
        worker === PRIVATE_WORKFLOW_V2_POLICY.privateWorker
          ? workerState("33333333-3333-4333-8333-333333333333", "private-stale")
          : workerState(publicVersion, "public-current", ["PUBLIC:plain_text"])
      ),
      verifyInitialBindings: () => {},
      runPreSmoke: async () => {
        calls.smoke += 1;
        return passingSmoke();
      },
      runDryRun: async () => {},
      runDeploy: async () => {
        calls.deploy += 1;
      },
      runPostSmoke: async () => passingSmoke(),
      runRollback: async () => {
        calls.rollback += 1;
      },
      evidence: { append() {} }
    }),
    error => (
      error instanceof PrivateWorkflowV2Error
      && error.code === PRIVATE_WORKFLOW_V2_FAILURE.PRODUCTION_PREREQUISITE_MISMATCH
    )
  );
  assert.deepEqual(calls, { deploy: 0, rollback: 0, smoke: 0 });
});

test("phase evidence is owner-only, append-only, and collision-denying", () => {
  const temporary = mkdtempSync(join(tmpdir(), "prometheus-private-v2-evidence-test-"));
  const directory = join(temporary, "evidence");
  try {
    const recorder = createPrivateDeploymentEvidenceRecorder(directory);
    recorder.append("DEPLOYMENT_NOT_BEGUN");
    recorder.append("LOCAL_PREFLIGHT_PASSED");
    assert.deepEqual(recorder.phases(), [
      "DEPLOYMENT_NOT_BEGUN",
      "LOCAL_PREFLIGHT_PASSED"
    ]);
    assert.throws(
      () => recorder.append("LOCAL_PREFLIGHT_PASSED"),
      PrivateWorkflowV2Error
    );
    assert.throws(
      () => createPrivateDeploymentEvidenceRecorder(directory),
      PrivateWorkflowV2Error
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
