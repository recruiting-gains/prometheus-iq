import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  PRIVATE_WORKFLOW_V2_FAILURE,
  PRIVATE_WORKFLOW_V2_POLICY,
  PrivateWorkflowV2Error,
  assertQualifiedPrivateConfigCanPreserveBindings,
  buildQualifiedPrivateRelease,
  buildQualifiedPrivateWranglerInvocation,
  createPrivateDeploymentEvidenceRecorder,
  formatPrivateWorkflowV2Failure,
  qualifiedPrivateConfigForArtifact,
  requirePrivateV2ProtectedSecretNames,
  runQualifiedPrivateDeploymentLifecycle,
  validatePrivateV2DeploymentInputs,
  validatePrivateV2QualificationInputs,
  verifyPrivateQualificationArtifactMetadata,
  verifyQualifiedPrivateRelease
} from "../scripts/lib/github-actions-private-worker-workflow-v2.mjs";
import { verifyGithubActionsPrivateWorkerWorkflowV2 } from "../scripts/verify-github-actions-private-worker-workflow-v2.mjs";

const root = resolve(import.meta.dirname, "..");
const commit = "8976c077eef91147368c9b5566b5310c04fd6630";
const tree = "e6d74758013d711547ff77c7a31952d73d5deee7";
const batchId = "BATCH-20260725-001";
const publicVersion = "6a8713c0-0712-4cda-8a13-daa893ca45f2";
const privateVersion = "b8cba784-dfd3-4f8e-8356-816cccf6aecc";
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

function passingSmoke() {
  return Object.freeze({
    status: "passed",
    attemptedWriteCount: 0,
    requestCount: 3
  });
}

function lifecycleFixture({ postSmoke = passingSmoke(), deployUncertain = false } = {}) {
  const initialPrivate = workerState(privateVersion, "private-deployment-1");
  const initialPublic = workerState(publicVersion, "public-deployment-1", ["PUBLIC:plain_text"]);
  const deployedPrivate = workerState(
    "11111111-1111-4111-8111-111111111111",
    "private-deployment-2"
  );
  const rolledBackPrivate = workerState(
    "22222222-2222-4222-8222-222222222222",
    "private-deployment-3"
  );
  const rollbackExpected = deployUncertain
    || postSmoke.status !== "passed"
    || postSmoke.attemptedWriteCount !== 0
    || postSmoke.requestCount <= 0;
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
    verifyInitialBindings: (_release, bindings) => assert.deepEqual(bindings, requiredBindings),
    runPreSmoke: async () => {
      calls.preSmoke += 1;
      return passingSmoke();
    },
    runDryRun: async () => {
      calls.dryRun += 1;
    },
    runDeploy: async (_release, consume) => {
      calls.deploy += 1;
      consume();
      if (deployUncertain) throw new Error("synthetic_uncertain_deploy");
    },
    runPostSmoke: async () => {
      calls.postSmoke += 1;
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

test("all four protected names are required before any production request", () => {
  const complete = {
    CLOUDFLARE_API_TOKEN: "fixture",
    CLOUDFLARE_ACCOUNT_ID: "fixture",
    CLOUDFLARE_ACCESS_CLIENT_ID: "fixture",
    CLOUDFLARE_ACCESS_CLIENT_SECRET: "fixture"
  };
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

test("forward and rollback qualified configurations retain their distinct request boundaries", () => {
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
  assert.equal(forward.assets.run_worker_first, true);
  assert.deepEqual(rollback.assets.run_worker_first, ["/api/*"]);
  assert.equal(Object.hasOwn(forward, "routes"), false);
  assert.equal(Object.hasOwn(rollback, "routes"), false);
  assert.throws(
    () => qualifiedPrivateConfigForArtifact(
      readFileSync(
        resolve(root, "workers/infrastructure/route-iq-private-forward-rollback-wrangler-v3.json"),
        "utf8"
      )
    ),
    PrivateWorkflowV2Error
  );
});

test("qualified artifact contains actual no-bundle forward payload and rollback and detects tampering", () => {
  const temporary = mkdtempSync(join(tmpdir(), "prometheus-private-v2-artifact-test-"));
  const release = join(temporary, "release");
  try {
    const result = buildQualifiedPrivateRelease(root, {
      outputDirectory: release,
      inputs: qualificationInputs(),
      runtimeIdentity,
      temporaryRoot: temporary,
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
    const verified = verifyQualifiedPrivateRelease(
      root,
      release,
      expectedFromBuild(result),
      runtimeIdentity,
      { verifyRepositoryBoundary: false }
    );
    assertQualifiedPrivateConfigCanPreserveBindings(verified, requiredBindings);
    assert.equal(
      readFileSync(join(
        verified.forwardDirectory,
        PRIVATE_WORKFLOW_V2_POLICY.qualifiedConfigFile
      ), "utf8").includes("\"main\":\"./worker/prometheus-iq-worker.js\""),
      true
    );
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
    forwardDirectory: "/qualified/private/forward",
    rollbackDirectory: "/qualified/private/rollback"
  };
  for (const mode of ["dry-run", "deploy", "rollback"]) {
    const invocation = buildQualifiedPrivateWranglerInvocation(mode, inputs, release);
    assert.equal(invocation.includes("--no-bundle"), true);
    assert.equal(invocation.includes("--keep-vars"), true);
    assert.equal(invocation.includes("--strict"), true);
    assert.equal(invocation.includes("--name"), false);
    assert.equal(invocation.includes(PRIVATE_WORKFLOW_V2_POLICY.publicWorker), false);
    assert.equal(invocation.includes("--dry-run"), mode === "dry-run");
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
