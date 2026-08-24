import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { pathToFileURL } from "node:url";

import {
  PUBLIC_DEPLOYMENT_FAILURE,
  PUBLIC_CLOUDFLARE_READ_PHASE,
  PUBLIC_WRANGLER_FAILURE_REASON,
  PUBLIC_WRANGLER_PHASE,
  PUBLIC_WORKER_STARTUP_FAILURE_REASON,
  PUBLIC_WORKER_DEPLOYMENT_POLICY,
  PublicDeploymentPolicyError,
  assertPublicBindingsCanBePreserved,
  buildPublicWorkerStartupInvocation,
  buildPublicWranglerInvocation,
  createFounderSettingsSecretFile,
  fetchPublicWorkerState,
  fetchPublicWorkerStateForTest,
  formatPublicDeploymentFailure,
  removeFounderSettingsSecretFile,
  runBoundedPublicWranglerForTest,
  runPublicDeploymentLifecycle,
  runPublicWorkerWorkerdStartupPreflight,
  runPublicWorkerWorkerdStartupPreflightForTest,
  scrubPublicDeploymentCredentials,
  takePublicDeploymentCredentials,
  validatePublicFounderDeploymentInputs,
  verifyPublicStaticDeploymentPolicy,
  verifyPublicWranglerPin
} from "../scripts/lib/github-actions-public-worker-deployment.mjs";
import {
  verifyPublicForwardRollbackArtifact
} from "../scripts/lib/route-iq-public-forward-rollback.mjs";
import {
  isPublicIntakeGuardAllowHeaderValid,
  runCloudflarePublicWorkerSmoke
} from "../scripts/run-cloudflare-public-worker-smoke.mjs";
import { verifyGithubActionsPublicWorkerDeployment } from "../scripts/verify-github-actions-public-worker-deployment.mjs";
import { verifyRouteIqPublicDeploymentAssets } from "../scripts/verify-route-iq-public-deployment-assets.mjs";

const root = resolve(import.meta.dirname, "..");
const approvedCommit = "a".repeat(40);
const approvedTree = "b".repeat(40);
const publicVersion = "11111111-1111-4111-8111-111111111111";
const privateVersion = "22222222-2222-4222-8222-222222222222";
const rollbackHash = "c".repeat(64);
const syntheticWranglerSecrets = Object.freeze({
  apiToken: "synthetic-api-token-must-never-escape",
  accountId: "d".repeat(32),
  secretFile: "/private/synthetic/settings-must-never-escape.json",
  providerBody: "provider-body-must-never-escape",
  filesystemPath: "/Users/private/path-must-never-escape",
  resourceId: "99999999-9999-4999-8999-999999999999",
  contentHash: "e".repeat(64)
});

function wranglerSpawnFixture({
  stdout = [],
  stderr = [],
  exitCode = 1,
  signal = null,
  emitError = false,
  neverClose = false,
  throwOnSpawn = false
} = {}) {
  let calls = 0;
  const killSignals = [];
  return {
    get calls() { return calls; },
    killSignals,
    spawnImpl() {
      calls += 1;
      if (throwOnSpawn) throw new Error(syntheticWranglerSecrets.providerBody);
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = killSignal => {
        killSignals.push(killSignal);
        queueMicrotask(() => child.emit("close", null, killSignal));
        return true;
      };
      queueMicrotask(() => {
        for (const chunk of stdout) child.stdout.write(chunk);
        for (const chunk of stderr) child.stderr.write(chunk);
        if (emitError) child.emit("error", new Error(syntheticWranglerSecrets.providerBody));
        else if (!neverClose) child.emit("close", exitCode, signal);
      });
      return child;
    }
  };
}

async function captureWranglerFailure({
  mode = "deploy",
  fixture,
  timeoutMs = 100,
  outputByteLimit = 4096
}) {
  let captured;
  await assert.rejects(
    runBoundedPublicWranglerForTest({
      root,
      mode,
      inputs: {
        batchId: "BATCH-20260720-007",
        approvedCommit
      },
      credentials: {
        apiToken: syntheticWranglerSecrets.apiToken,
        accountId: syntheticWranglerSecrets.accountId
      },
      secretFile: syntheticWranglerSecrets.secretFile,
      spawnImpl: fixture.spawnImpl,
      timeoutMs,
      outputByteLimit
    }),
    error => {
      captured = error;
      return error instanceof PublicDeploymentPolicyError;
    }
  );
  assert.equal(fixture.calls, 1, "the wrapper must invoke one child exactly once");
  return {
    captured,
    formatted: formatPublicDeploymentFailure(captured, mode)
  };
}

function assertNoWranglerSensitiveOutput(formatted) {
  const output = formatted.join("\n");
  for (const value of Object.values(syntheticWranglerSecrets)) {
    assert.equal(output.includes(value), false, "fixed diagnostics must not expose sensitive child context");
  }
  assert.match(output, /^[A-Z0-9_=\n]+$/u);
}

function validEnvironment(overrides = {}) {
  const dispatch = {
    approved_commit: approvedCommit,
    approved_tree: approvedTree,
    batch_id: "BATCH-20260719-004",
    current_public_version: publicVersion,
    current_private_version: privateVersion,
    rollback_artifact_sha256: rollbackHash,
    founder_authorization: PUBLIC_WORKER_DEPLOYMENT_POLICY.founderAuthorization
  };
  return {
    PROMETHEUS_APPROVED_COMMIT: approvedCommit,
    PROMETHEUS_APPROVED_TREE: approvedTree,
    PROMETHEUS_BATCH_ID: dispatch.batch_id,
    PROMETHEUS_CURRENT_PUBLIC_VERSION: publicVersion,
    PROMETHEUS_CURRENT_PRIVATE_VERSION: privateVersion,
    PROMETHEUS_ROLLBACK_ARTIFACT_SHA256: rollbackHash,
    PROMETHEUS_FOUNDER_AUTHORIZATION: dispatch.founder_authorization,
    PROMETHEUS_DISPATCH_INPUTS_JSON: JSON.stringify(dispatch),
    GITHUB_REPOSITORY: PUBLIC_WORKER_DEPLOYMENT_POLICY.repository,
    GITHUB_REF: PUBLIC_WORKER_DEPLOYMENT_POLICY.ref,
    GITHUB_REF_NAME: PUBLIC_WORKER_DEPLOYMENT_POLICY.branch,
    GITHUB_REF_TYPE: PUBLIC_WORKER_DEPLOYMENT_POLICY.refType,
    GITHUB_EVENT_NAME: PUBLIC_WORKER_DEPLOYMENT_POLICY.eventName,
    GITHUB_SHA: approvedCommit,
    GITHUB_ACTOR: PUBLIC_WORKER_DEPLOYMENT_POLICY.founderActor,
    GITHUB_TRIGGERING_ACTOR: PUBLIC_WORKER_DEPLOYMENT_POLICY.founderActor,
    GITHUB_WORKFLOW: PUBLIC_WORKER_DEPLOYMENT_POLICY.workflowName,
    GITHUB_WORKFLOW_REF: PUBLIC_WORKER_DEPLOYMENT_POLICY.workflowRef,
    GITHUB_RUN_ATTEMPT: "1",
    ...overrides
  };
}

function state(versionId, deploymentId, bindings = []) {
  return Object.freeze({
    deployment: Object.freeze({ versionId, deploymentId }),
    bindings: Object.freeze([...bindings].sort())
  });
}

function response(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function fixtureGit(repository, argumentsList) {
  const result = spawnSync("git", argumentsList, {
    cwd: repository,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 4 * 1024 * 1024,
    timeout: 30_000,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0"
    }
  });
  assert.equal(result.status, 0, `fixture Git failed: ${argumentsList.join(" ")}`);
  return String(result.stdout || "").trim();
}

function updateRollbackContract(repository, update) {
  const path = join(repository, PUBLIC_WORKER_DEPLOYMENT_POLICY.rollbackContractPath);
  const contract = JSON.parse(readFileSync(path, "utf8"));
  update(contract);
  writeFileSync(path, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
}

function createWorkerdFixture(source, { compatibilityFlags = [] } = {}) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "route-iq-public-workerd-fixture-"));
  symlinkSync(resolve(root, "node_modules"), join(fixtureRoot, "node_modules"), "dir");
  writeFileSync(join(fixtureRoot, "worker.mjs"), source, "utf8");
  writeFileSync(join(fixtureRoot, "wrangler.jsonc"), `${JSON.stringify({
    name: "route-iq-public-workerd-fixture",
    main: "worker.mjs",
    compatibility_date: "2026-07-01",
    compatibility_flags: compatibilityFlags,
    workers_dev: false
  }, null, 2)}\n`, "utf8");
  return fixtureRoot;
}

test("Founder dispatch requires every exact no-secret input and rejects reruns or another actor", () => {
  const inputs = validatePublicFounderDeploymentInputs(validEnvironment());
  assert.equal(inputs.approvedCommit, approvedCommit);
  assert.equal(inputs.currentPublicVersion, publicVersion);
  for (const overrides of [
    { GITHUB_ACTOR: "another-user" },
    { GITHUB_TRIGGERING_ACTOR: "another-user" },
    { GITHUB_RUN_ATTEMPT: "2" },
    { GITHUB_REF: "refs/heads/feature" },
    { PROMETHEUS_CURRENT_PUBLIC_VERSION: "invalid" }
  ]) {
    assert.throws(
      () => validatePublicFounderDeploymentInputs(validEnvironment(overrides)),
      PublicDeploymentPolicyError
    );
  }
});

test("qualification prepares source then builds one artifact while deployment never rebuilds", () => {
  const qualification = readFileSync(
    join(root, ".github", "workflows", "qualify-prometheus-public-worker.yml"),
    "utf8"
  );
  const deployment = readFileSync(
    join(root, ".github", "workflows", "deploy-prometheus-public-worker.yml"),
    "utf8"
  );
  for (const suite of ["core", "public", "security", "release"]) {
    assert.equal([...qualification.matchAll(new RegExp(`^          npm run test:${suite}$`, "gmu"))].length, 1);
  }
  assert.equal([...qualification.matchAll(/npm test/gmu)].length, 0);
  assert.equal(
    [...qualification.matchAll(/^\s*run: node scripts\/run-github-actions-public-worker-qualification\.mjs build$/gmu)].length,
    1
  );
  assert.equal([...qualification.matchAll(/^        run: npm run build$/gmu)].length, 1);
  assert.equal([...deployment.matchAll(/npm run build|npm test|vite build/gmu)].length, 0);
  assert.equal(
    [...deployment.matchAll(/actions\/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0/gmu)].length,
    2
  );
  assert.equal(
    [...deployment.matchAll(/^\s*run: node scripts\/run-github-actions-public-worker-deployment-v2\.mjs deploy$/gmu)].length,
    1
  );
});

test("public config exposes only the narrow adapter and the configured Worker passes local Workerd HEAD", async () => {
  const config = JSON.parse(readFileSync(join(root, PUBLIC_WORKER_DEPLOYMENT_POLICY.publicConfig), "utf8"));
  assert.equal(config.main, PUBLIC_WORKER_DEPLOYMENT_POLICY.publicEntrypoint);
  const adapter = readFileSync(join(root, PUBLIC_WORKER_DEPLOYMENT_POLICY.publicEntrypoint), "utf8");
  assert.match(adapter, /import worker, \{\s*RouteIqRequestCrmCoordinator\s*\}/u);
  assert.match(adapter, /export \{ RouteIqRequestCrmCoordinator \};/u);
  assert.match(adapter, /export default worker;/u);
  assert.doesNotMatch(adapter, /CALLBACK_PATH|RouteIqProspectiveShadowCoordinator/u);

  const result = await runPublicWorkerWorkerdStartupPreflight({ root });
  assert.equal(result.status, "PUBLIC_WORKER_WORKERD_STARTUP_PREFLIGHT_PASSED");
});

test("local Workerd preflight is local-only, no-secret, one-child, and requires loopback HEAD 200", async () => {
  const fixture = wranglerSpawnFixture({
    stdout: ["[wrangler:info] Ready on http://127.0.0.1:43210\n"],
    neverClose: true
  });
  let invocation;
  let options;
  let probes = 0;
  const result = await runPublicWorkerWorkerdStartupPreflightForTest({
    root,
    configPath: PUBLIC_WORKER_DEPLOYMENT_POLICY.publicConfig,
    spawnImpl(command, args, spawnOptions) {
      invocation = [command, ...args];
      options = { ...spawnOptions, env: { ...spawnOptions.env } };
      return fixture.spawnImpl();
    },
    probeImpl: async port => {
      probes += 1;
      assert.equal(port, 43210);
    },
    timeoutMs: 100,
    outputByteLimit: 4096
  });
  assert.equal(result.status, "PUBLIC_WORKER_WORKERD_STARTUP_PREFLIGHT_PASSED");
  assert.equal(fixture.calls, 1);
  assert.equal(probes, 1);
  assert.deepEqual(fixture.killSignals, ["SIGTERM"]);
  assert.deepEqual(invocation, [
    process.execPath,
    ...buildPublicWorkerStartupInvocation(
      PUBLIC_WORKER_DEPLOYMENT_POLICY.publicConfig,
      invocation[invocation.indexOf("--persist-to") + 1]
    )
  ]);
  assert.ok(invocation.includes("--local"));
  assert.ok(invocation.includes("--latest=false"));
  assert.equal(invocation.includes("--remote"), false);
  assert.equal(invocation.includes("--tunnel"), false);
  assert.equal(options.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV, "false");
  assert.equal(Object.hasOwn(options.env, "CLOUDFLARE_API_TOKEN"), false);
  assert.equal(Object.hasOwn(options.env, "CLOUDFLARE_ACCOUNT_ID"), false);
  assert.deepEqual(options.stdio, ["ignore", "pipe", "pipe"]);
});

test("local Workerd preflight rejects the observed CALLBACK_PATH export surface before Cloudflare", async () => {
  const fixtureRoot = createWorkerdFixture(`
export const CALLBACK_PATH = "/api/oauth/callback";
export default { fetch() { return new Response("healthy handler"); } };
`);
  try {
    await assert.rejects(
      runPublicWorkerWorkerdStartupPreflightForTest({
        root: fixtureRoot,
        configPath: "wrangler.jsonc",
        timeoutMs: PUBLIC_WORKER_DEPLOYMENT_POLICY.startupTimeoutMs,
        outputByteLimit: 64 * 1024
      }),
      error => error instanceof PublicDeploymentPolicyError
        && error.code === PUBLIC_DEPLOYMENT_FAILURE.WORKER_STARTUP_FAILED
        && error.diagnostics.includes("WORKER_STARTUP_PHASE=LOCAL_WORKERD")
        && error.diagnostics.includes(
          `WORKER_STARTUP_FAILURE_REASON=${PUBLIC_WORKER_STARTUP_FAILURE_REASON.EXPORT_SURFACE_REJECTED}`
        )
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("local Workerd preflight rejects the original fileURLToPath import-meta startup failure", async () => {
  const fixtureRoot = createWorkerdFixture(`
import { fileURLToPath } from "node:url";
export const MODULE_PATH = fileURLToPath(import.meta.url);
export default { fetch() { return new Response("unreachable"); } };
`, { compatibilityFlags: ["nodejs_compat"] });
  try {
    await assert.rejects(
      runPublicWorkerWorkerdStartupPreflightForTest({
        root: fixtureRoot,
        configPath: "wrangler.jsonc",
        timeoutMs: PUBLIC_WORKER_DEPLOYMENT_POLICY.startupTimeoutMs,
        outputByteLimit: 64 * 1024
      }),
      error => error instanceof PublicDeploymentPolicyError
        && error.code === PUBLIC_DEPLOYMENT_FAILURE.WORKER_STARTUP_FAILED
        && error.diagnostics.includes(
          `WORKER_STARTUP_FAILURE_REASON=${PUBLIC_WORKER_STARTUP_FAILURE_REASON.MODULE_STARTUP_REJECTED}`
        )
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("a clean checkout generates exact dist-public bytes before verifier-only asset validation", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "route-iq-public-clean-runner-assets-"));
  const repository = join(fixtureRoot, "repository");
  try {
    fixtureGit(root, ["clone", "--quiet", "--no-local", root, repository]);
    assert.equal(existsSync(join(repository, "dist-public")), false);
    symlinkSync(resolve(root, "node_modules"), join(repository, "node_modules"), "dir");

    const build = spawnSync("npm", ["run", "build"], {
      cwd: repository,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 8 * 1024 * 1024,
      timeout: 120_000,
      env: { ...process.env, CI: "true", NO_COLOR: "1" }
    });
    assert.equal(build.status, 0, `clean checkout build failed\n${build.stderr}`);
    assert.equal(existsSync(join(repository, "dist-public")), true);

    const verifierUrl = pathToFileURL(
      join(repository, "scripts", "verify-route-iq-public-deployment-assets.mjs")
    ).href;
    const verify = spawnSync(process.execPath, [
      "--input-type=module",
      "--eval",
      `const { verifyRouteIqPublicDeploymentAssets } = await import(${JSON.stringify(verifierUrl)}); const result = verifyRouteIqPublicDeploymentAssets({ build: false }); process.stdout.write(result.deploymentAssetsSha256);`
    ], {
      cwd: repository,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 4 * 1024 * 1024,
      timeout: 60_000,
      env: { ...process.env, CI: "true", NO_COLOR: "1" }
    });
    assert.equal(verify.status, 0, `clean checkout asset verification failed\n${verify.stderr}`);
    assert.equal(verify.stdout, "94def2bbd52b6ffa85a40dbc4c51166fcdffdcc364ffdc99a678ddd91d2ed779");
    rmSync(join(repository, "node_modules"), { recursive: true, force: true });
    assert.equal(fixtureGit(repository, ["status", "--porcelain=v1", "--untracked-files=all"]), "");
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("Wrangler invocation is fixed to the public config with additive settings and no name override", () => {
  const inputs = { batchId: "BATCH-20260719-004", approvedCommit };
  for (const mode of ["dry-run", "deploy"]) {
    const args = buildPublicWranglerInvocation(mode, inputs, "/tmp/founder-settings.json");
    assert.ok(args.includes("wrangler.prometheusrouteiq-website.jsonc"));
    assert.ok(args.includes("--keep-vars"));
    assert.ok(args.includes("--strict"));
    assert.ok(args.includes("--secrets-file"));
    assert.equal(args.includes("--name"), false);
    assert.equal(args.includes("prometheus-iq"), false);
  }
});

test("protected credentials become one owner-only temporary settings file and are scrubbed", () => {
  const names = [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "ROUTE_IQ_REQUEST_CRM_ACCESS_TEAM_DOMAIN",
    "ROUTE_IQ_REQUEST_CRM_ACCESS_AUDIENCE",
    "ROUTE_IQ_REQUEST_CRM_FOUNDER_SUBJECT_SHA256"
  ];
  const environment = Object.fromEntries([
    [names[0], "synthetic-token"],
    [names[1], "a".repeat(32)],
    [names[2], "https://prometheus-test.cloudflareaccess.com"],
    [names[3], "b".repeat(64)],
    [names[4], "c".repeat(64)]
  ]);
  const credentials = takePublicDeploymentCredentials(environment);
  assert.deepEqual(Object.keys(environment), []);
  const temporaryRoot = mkdtempSync(join(tmpdir(), "route-iq-public-settings-test-"));
  let artifact;
  try {
    artifact = createFounderSettingsSecretFile(credentials, temporaryRoot);
    assert.equal(lstatSync(artifact.directory).mode & 0o777, 0o700);
    assert.equal(lstatSync(artifact.path).mode & 0o777, 0o600);
    const stored = JSON.parse(readFileSync(artifact.path, "utf8"));
    assert.deepEqual(Object.keys(stored).sort(), [
      "ROUTE_IQ_REQUEST_CRM_ACCESS_AUDIENCE",
      "ROUTE_IQ_REQUEST_CRM_ACCESS_TEAM_DOMAIN",
      "ROUTE_IQ_REQUEST_CRM_FOUNDER_SUBJECT_SHA256"
    ]);
  } finally {
    removeFounderSettingsSecretFile(artifact);
    scrubPublicDeploymentCredentials(credentials);
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
  assert.ok(Object.values(credentials).every(value => value === ""));
});

test("Cloudflare read-side state parser requires one version at 100 percent and bounded bindings", async () => {
  const credentials = { apiToken: "test", accountId: "a".repeat(32) };
  const requests = [];
  const fetchImpl = async url => {
    requests.push(url.pathname);
    if (url.pathname.endsWith("/deployments")) {
      return response({
        success: true,
        errors: [],
        messages: [],
        result: {
          deployments: [{
            id: "33333333-3333-4333-8333-333333333333",
            strategy: "percentage",
            versions: [{ version_id: publicVersion, percentage: 100 }]
          }]
        }
      });
    }
    return response({
      success: true,
      errors: [],
      messages: [],
      result: { bindings: [{ name: "ROUTE_IQ_REQUEST_CRM_COORDINATOR", type: "durable_object_namespace" }] }
    });
  };
  const result = await fetchPublicWorkerState(PUBLIC_WORKER_DEPLOYMENT_POLICY.publicWorker, credentials, fetchImpl);
  assert.equal(result.deployment.versionId, publicVersion);
  assert.deepEqual(result.bindings, ["ROUTE_IQ_REQUEST_CRM_COORDINATOR:durable_object_namespace"]);
  assert.equal(requests.length, 2);
});

test("production Cloudflare reads pin a bounded thirty-second deadline with only a smaller test override", async () => {
  assert.equal(PUBLIC_WORKER_DEPLOYMENT_POLICY.requestTimeoutMs, 30_000);
  assert.equal(PUBLIC_WORKER_DEPLOYMENT_POLICY.testRequestTimeoutMaximumMs, 1_000);
  let calls = 0;
  await assert.rejects(
    fetchPublicWorkerStateForTest(
      PUBLIC_WORKER_DEPLOYMENT_POLICY.publicWorker,
      { apiToken: "test", accountId: "a".repeat(32) },
      async () => {
        calls += 1;
        return response({});
      },
      1_001
    ),
    error => error.code === PUBLIC_DEPLOYMENT_FAILURE.CREDENTIAL_CONTEXT_INVALID
  );
  assert.equal(calls, 0);
  const productionCommand = readFileSync(
    join(root, "scripts", "run-github-actions-public-worker-deployment.mjs"),
    "utf8"
  );
  assert.match(
    productionCommand,
    /fetchState: worker => fetchPublicWorkerState\(worker, credentials, fetchImpl\)/u
  );
  assert.equal(productionCommand.includes("fetchPublicWorkerStateForTest"), false);
});

test("Wrangler nonzero exits emit only deterministic fixed phase and reason diagnostics", async () => {
  const cases = [
    {
      expected: PUBLIC_WRANGLER_FAILURE_REASON.ASSET_SESSION_REJECTED,
      output: `A request to the Cloudflare API (/accounts/${syntheticWranglerSecrets.accountId}/workers/scripts/public/assets-upload-session) failed.\n${syntheticWranglerSecrets.providerBody}`
    },
    {
      expected: PUBLIC_WRANGLER_FAILURE_REASON.ASSET_UPLOAD_FAILED,
      output: `Upload took too long.\nAsset upload took too long on bucket 1/3. ${syntheticWranglerSecrets.filesystemPath}`
    },
    {
      expected: PUBLIC_WRANGLER_FAILURE_REASON.ASSET_COMPLETION_MISSING,
      output: `Failed to complete asset upload. Please try again. ${syntheticWranglerSecrets.resourceId}`
    },
    {
      expected: PUBLIC_WRANGLER_FAILURE_REASON.WORKER_VERSION_UPLOAD_REJECTED,
      output: `A request to the Cloudflare API (/accounts/${syntheticWranglerSecrets.accountId}/workers/scripts/${PUBLIC_WORKER_DEPLOYMENT_POLICY.publicWorker}/versions) failed. ${syntheticWranglerSecrets.providerBody}`
    },
    {
      expected: PUBLIC_WRANGLER_FAILURE_REASON.WORKER_RUNTIME_STARTUP_REJECTED,
      output: `The Workers runtime failed to start. service core:user:${PUBLIC_WORKER_DEPLOYMENT_POLICY.publicWorker}: Uncaught TypeError: synthetic startup rejection [code: 10021] ${syntheticWranglerSecrets.providerBody}`
    },
    {
      expected: PUBLIC_WRANGLER_FAILURE_REASON.MIGRATION_BINDING_CONFIG_REJECTED,
      output: `Cannot apply new_sqlite_classes migration to existing class Example. [code: 10021] ${syntheticWranglerSecrets.contentHash}`
    },
    {
      expected: PUBLIC_WRANGLER_FAILURE_REASON.AUTHORIZATION_DENIED,
      output: `Please ensure it has the correct permissions for this operation. ${syntheticWranglerSecrets.apiToken}`
    },
    {
      expected: PUBLIC_WRANGLER_FAILURE_REASON.NETWORK_UNCERTAIN,
      output: `A fetch request failed, likely due to a connectivity issue. ${syntheticWranglerSecrets.filesystemPath}`
    },
    {
      expected: PUBLIC_WRANGLER_FAILURE_REASON.UNKNOWN_NONZERO_EXIT,
      output: `ambiguous provider asset-session authorization network message ${syntheticWranglerSecrets.providerBody} ${syntheticWranglerSecrets.filesystemPath}`
    },
    {
      expected: PUBLIC_WRANGLER_FAILURE_REASON.UNKNOWN_NONZERO_EXIT,
      output: `A request to the Cloudflare API (/accounts/${syntheticWranglerSecrets.accountId}/workers/scripts/unrelated-worker/versions) failed. ${syntheticWranglerSecrets.providerBody}`
    },
    {
      expected: PUBLIC_WRANGLER_FAILURE_REASON.WORKER_VERSION_UPLOAD_REJECTED,
      output: `A request to the Cloudflare API (/accounts/${syntheticWranglerSecrets.accountId}/workers/scripts/${PUBLIC_WORKER_DEPLOYMENT_POLICY.publicWorker}/versions) failed. [code: 10021] ${syntheticWranglerSecrets.providerBody}`
    },
    {
      expected: PUBLIC_WRANGLER_FAILURE_REASON.UNKNOWN_NONZERO_EXIT,
      output: `Unspecified Cloudflare rejection [code: 10021] ${syntheticWranglerSecrets.providerBody}`
    }
  ];
  for (const fixtureCase of cases) {
    const fixture = wranglerSpawnFixture({ stderr: [fixtureCase.output] });
    const { captured, formatted } = await captureWranglerFailure({ fixture });
    assert.equal(captured.code, PUBLIC_DEPLOYMENT_FAILURE.DEPLOY_FAILED);
    assert.deepEqual(formatted, [
      PUBLIC_DEPLOYMENT_FAILURE.DEPLOY_FAILED,
      `WRANGLER_PHASE=${PUBLIC_WRANGLER_PHASE.DEPLOY}`,
      `WRANGLER_FAILURE_REASON=${fixtureCase.expected}`
    ]);
    assertNoWranglerSensitiveOutput(formatted);
  }
});

test("Wrangler process failures distinguish spawn, timeout, overflow, signal, and dry-run phase", async () => {
  const fixtures = [
    {
      fixture: wranglerSpawnFixture({ throwOnSpawn: true }),
      reason: PUBLIC_WRANGLER_FAILURE_REASON.SPAWN_FAILED
    },
    {
      fixture: wranglerSpawnFixture({ emitError: true }),
      reason: PUBLIC_WRANGLER_FAILURE_REASON.SPAWN_FAILED
    },
    {
      fixture: wranglerSpawnFixture({ neverClose: true }),
      reason: PUBLIC_WRANGLER_FAILURE_REASON.TIMEOUT,
      timeoutMs: 5,
      expectedKill: "SIGTERM"
    },
    {
      fixture: wranglerSpawnFixture({
        stdout: [Buffer.from("x".repeat(17), "ascii")],
        neverClose: true
      }),
      reason: PUBLIC_WRANGLER_FAILURE_REASON.OUTPUT_OVERFLOW,
      outputByteLimit: 16,
      expectedKill: "SIGKILL"
    },
    {
      fixture: wranglerSpawnFixture({ signal: "SIGABRT", exitCode: null }),
      reason: PUBLIC_WRANGLER_FAILURE_REASON.TERMINATED_BY_SIGNAL
    }
  ];
  for (const fixtureCase of fixtures) {
    const { formatted } = await captureWranglerFailure({
      fixture: fixtureCase.fixture,
      timeoutMs: fixtureCase.timeoutMs ?? 100,
      outputByteLimit: fixtureCase.outputByteLimit ?? 4096
    });
    assert.deepEqual(formatted, [
      PUBLIC_DEPLOYMENT_FAILURE.DEPLOY_FAILED,
      "WRANGLER_PHASE=DEPLOY",
      `WRANGLER_FAILURE_REASON=${fixtureCase.reason}`
    ]);
    if (fixtureCase.expectedKill) {
      assert.equal(fixtureCase.fixture.killSignals[0], fixtureCase.expectedKill);
    } else {
      assert.deepEqual(fixtureCase.fixture.killSignals, []);
    }
    assertNoWranglerSensitiveOutput(formatted);
  }

  const dryRunFixture = wranglerSpawnFixture({ stderr: ["unclassified dry-run failure"] });
  const { captured, formatted } = await captureWranglerFailure({
    mode: "dry-run",
    fixture: dryRunFixture
  });
  assert.equal(captured.code, PUBLIC_DEPLOYMENT_FAILURE.DRY_RUN_FAILED);
  assert.deepEqual(formatted, [
    PUBLIC_DEPLOYMENT_FAILURE.DRY_RUN_FAILED,
    "WRANGLER_PHASE=DRY_RUN",
    "WRANGLER_FAILURE_REASON=UNKNOWN_NONZERO_EXIT"
  ]);
});

test("Wrangler classifier follows pinned 4.120.1 messages without materializing raw output strings", () => {
  const wrangler = JSON.parse(readFileSync(join(root, "node_modules", "wrangler", "package.json"), "utf8"));
  assert.equal(wrangler.version, "4.120.1");
  const wranglerSource = readFileSync(join(root, "node_modules", "wrangler", "wrangler-dist", "cli.js"), "utf8");
  for (const message of [
    "An unexpected response has been received from the Cloudflare API for assets upload. Please try again.",
    "Failed to complete asset upload. Please try again.",
    "Asset upload took too long on bucket",
    "A request to the Cloudflare API (${resource}) failed.",
    "Cannot apply new_sqlite_classes migration to existing class",
    "A fetch request failed, likely due to a connectivity issue."
  ]) assert.ok(wranglerSource.includes(message), `Wrangler source message drifted: ${message}`);

  const library = readFileSync(join(root, "scripts", "lib", "github-actions-public-worker-deployment.mjs"), "utf8");
  const classifier = library.slice(
    library.indexOf("function classifyPublicWranglerOutput"),
    library.indexOf("async function runBoundedPublicWranglerWithLimits")
  );
  assert.match(classifier, /const output = Buffer\.concat\(buffers\)/u);
  assert.match(classifier, /folded\.fill\(0\)/u);
  assert.match(classifier, /output\.fill\(0\)/u);
  assert.doesNotMatch(classifier, /\.toString\(|TextDecoder|String\(/u);
});

test("Cloudflare network, HTTP, timeout, and body failures retain safe endpoint classifications", async () => {
  const sensitiveToken = "synthetic-sensitive-token-must-not-appear";
  const sensitiveFailure = "synthetic-sensitive-provider-detail-must-not-appear";
  const credentials = { apiToken: sensitiveToken, accountId: "a".repeat(32) };
  const cases = [
    {
      expectedCode: PUBLIC_DEPLOYMENT_FAILURE.NETWORK_UNCERTAIN,
      expectedDiagnostics: ["CLOUDFLARE_READ_PHASE=PUBLIC_DEPLOYMENTS"],
      fetchImpl: async () => { throw new Error(sensitiveFailure); }
    },
    {
      expectedCode: PUBLIC_DEPLOYMENT_FAILURE.HTTP_FAILED,
      expectedDiagnostics: ["CLOUDFLARE_READ_PHASE=PUBLIC_DEPLOYMENTS", "HTTP_STATUS=503"],
      fetchImpl: async () => response({ providerDetail: sensitiveFailure }, 503)
    },
    {
      expectedCode: PUBLIC_DEPLOYMENT_FAILURE.RESPONSE_BODY_FAILED,
      expectedDiagnostics: ["CLOUDFLARE_READ_PHASE=PUBLIC_DEPLOYMENTS"],
      fetchImpl: async () => new Response(new ReadableStream({
        start(controller) {
          controller.error(new Error(sensitiveFailure));
        }
      }), { status: 200 })
    },
    {
      expectedCode: PUBLIC_DEPLOYMENT_FAILURE.REQUEST_TIMEOUT,
      expectedDiagnostics: ["CLOUDFLARE_READ_PHASE=PUBLIC_DEPLOYMENTS"],
      fetchImpl: async (_url, options) => new Response(new ReadableStream({
        start(controller) {
          options.signal.addEventListener("abort", () => {
            controller.error(new Error(sensitiveFailure));
          }, { once: true });
        }
      }), { status: 200 })
    }
  ];
  for (const fixture of cases) {
    let calls = 0;
    let captured;
    await assert.rejects(
      fetchPublicWorkerStateForTest(
        PUBLIC_WORKER_DEPLOYMENT_POLICY.publicWorker,
        credentials,
        async (...args) => {
          calls += 1;
          return fixture.fetchImpl(...args);
        },
        10
      ),
      error => {
        captured = error;
        return error instanceof PublicDeploymentPolicyError
          && error.code === fixture.expectedCode
          && fixture.expectedDiagnostics.every(value => error.diagnostics.includes(value));
      }
    );
    assert.equal(calls, 1, `${fixture.expectedCode} must not retry`);
    const output = formatPublicDeploymentFailure(captured, "deploy").join("\n");
    assert.equal(output.includes("UNCLASSIFIED_INTERNAL_FAILURE"), false);
    assert.equal(output.includes(sensitiveToken), false);
    assert.equal(output.includes(sensitiveFailure), false);
  }
});

test("private settings parser failures identify the exact safe phase", async () => {
  const credentials = { apiToken: "test", accountId: "a".repeat(32) };
  let calls = 0;
  await assert.rejects(
    fetchPublicWorkerState(
      PUBLIC_WORKER_DEPLOYMENT_POLICY.privateWorker,
      credentials,
      async url => {
        calls += 1;
        if (url.pathname.endsWith("/deployments")) {
          return response({
            success: true,
            errors: [],
            messages: [],
            result: {
              deployments: [{
                id: "33333333-3333-4333-8333-333333333333",
                strategy: "percentage",
                versions: [{ version_id: privateVersion, percentage: 100 }]
              }]
            }
          });
        }
        return response({
          success: true,
          errors: [],
          messages: [],
          result: { bindings: "not-an-array" }
        });
      }
    ),
    error => error.code === PUBLIC_DEPLOYMENT_FAILURE.RESPONSE_INVALID
      && error.diagnostics.includes(
        `CLOUDFLARE_READ_PHASE=${PUBLIC_CLOUDFLARE_READ_PHASE.PRIVATE_SETTINGS}`
      )
  );
  assert.equal(calls, 2);
});

test("unknown live bindings fail before mutation while configured, plain, and secret bindings are preservable", () => {
  assert.doesNotThrow(() => assertPublicBindingsCanBePreserved(root, [
    "ROUTE_IQ_REQUEST_CRM_COORDINATOR:durable_object_namespace",
    "META_GRAPH_API_VERSION:plain_text",
    "EXISTING_SECRET:secret_text",
    "AEGIS_RATE_LIMITS:kv_namespace",
    "FOUNDER_EMAIL:send_email"
  ]));
  assert.throws(
    () => assertPublicBindingsCanBePreserved(root, ["UNDECLARED_BUCKET:r2_bucket"]),
    error => error.code === PUBLIC_DEPLOYMENT_FAILURE.BINDING_REMOVED
  );
});

test("lifecycle checks both Workers, dry-runs, rechecks, and performs exactly one public deployment", async () => {
  const oldPublic = state(publicVersion, "33333333-3333-4333-8333-333333333333", [
    "ROUTE_IQ_REQUEST_CRM_COORDINATOR:durable_object_namespace",
    "EXISTING_SECRET:secret_text"
  ]);
  const unchangedPrivate = state(privateVersion, "44444444-4444-4444-8444-444444444444", ["PRIVATE_SECRET:secret_text"]);
  const newPublic = state("55555555-5555-4555-8555-555555555555", "66666666-6666-4666-8666-666666666666", [
    "ROUTE_IQ_REQUEST_CRM_COORDINATOR:durable_object_namespace",
    "EXISTING_SECRET:secret_text",
    "ROUTE_IQ_REQUEST_CRM_ACCESS_TEAM_DOMAIN:secret_text",
    "ROUTE_IQ_REQUEST_CRM_ACCESS_AUDIENCE:secret_text",
    "ROUTE_IQ_REQUEST_CRM_FOUNDER_SUBJECT_SHA256:secret_text"
  ]);
  const queues = new Map([
    [PUBLIC_WORKER_DEPLOYMENT_POLICY.publicWorker, [oldPublic, oldPublic, newPublic]],
    [PUBLIC_WORKER_DEPLOYMENT_POLICY.privateWorker, [unchangedPrivate, unchangedPrivate, unchangedPrivate]]
  ]);
  const wrangler = [];
  const result = await runPublicDeploymentLifecycle({
    inputs: {
      approvedCommit,
      approvedTree,
      currentPublicVersion: publicVersion,
      currentPrivateVersion: privateVersion
    },
    inspectIdentity: async () => ({
      head: approvedCommit,
      tree: approvedTree,
      originMain: approvedCommit,
      branch: "main",
      originUrl: "https://github.com/PrometheusRouteIQ/prometheus-iq",
      status: "",
      unstagedClean: true,
      stagedClean: true
    }),
    verifyConfiguration: () => {},
    verifyInitialBindings: () => {},
    fetchState: async worker => queues.get(worker).shift(),
    runWrangler: async mode => wrangler.push(mode)
  });
  assert.equal(result.status, "PUBLIC_WORKER_DEPLOYMENT_VERIFIED");
  assert.deepEqual(wrangler, ["dry-run", "deploy"]);
});

test("public version mismatch fails before a dry run or mutation", async () => {
  let wranglerCalls = 0;
  await assert.rejects(
    runPublicDeploymentLifecycle({
      inputs: {
        approvedCommit,
        approvedTree,
        currentPublicVersion: publicVersion,
        currentPrivateVersion: privateVersion
      },
      inspectIdentity: async () => ({
        head: approvedCommit,
        tree: approvedTree,
        originMain: approvedCommit,
        branch: "main",
        originUrl: "https://github.com/PrometheusRouteIQ/prometheus-iq",
        status: "",
        unstagedClean: true,
        stagedClean: true
      }),
      verifyConfiguration: () => {},
      verifyInitialBindings: () => {},
      fetchState: async worker => worker === PUBLIC_WORKER_DEPLOYMENT_POLICY.publicWorker
        ? state("77777777-7777-4777-8777-777777777777", "88888888-8888-4888-8888-888888888888")
        : state(privateVersion, "99999999-9999-4999-8999-999999999999"),
      runWrangler: async () => { wranglerCalls += 1; }
    }),
    error => error.code === PUBLIC_DEPLOYMENT_FAILURE.CURRENT_PUBLIC_VERSION_MISMATCH
  );
  assert.equal(wranglerCalls, 0);
});

test("fixed smoke ledger attempts only GET and HEAD and never submits a CRM request", async () => {
  const ledger = [];
  const fetchImpl = async (url, options) => {
    ledger.push({ method: options.method, path: url.pathname, body: options.body });
    if (url.pathname.startsWith("/api/partner-intake/founder/")) {
      return new Response(null, {
        status: 302,
        headers: { Location: "https://prometheus-test.cloudflareaccess.com/cdn-cgi/access/login" }
      });
    }
    if (url.pathname === "/api/partner-intake") {
      const allow = options.method === "GET" ? "POST, OPTIONS" : "GET, POST";
      return new Response(null, { status: 405, headers: { Allow: allow } });
    }
    return new Response(options.method === "HEAD" ? null : "ok", { status: 200 });
  };
  const result = await runCloudflarePublicWorkerSmoke({ fetchImpl, dryRun: false });
  assert.equal(result.attemptedWriteCount, 0);
  assert.ok(ledger.every(entry => ["GET", "HEAD"].includes(entry.method) && entry.body === undefined));
});

test("public intake Allow parser applies exact method-aware GET and HEAD sets", () => {
  for (const [method, value] of [
    ["GET", "POST"],
    ["GET", "POST,OPTIONS"],
    ["GET", "OPTIONS, POST"],
    ["GET", "\tOPTIONS\t,\tPOST\t"],
    ["HEAD", "GET, POST"],
    ["HEAD", "POST,GET"],
    ["HEAD", "\tPOST\t,\tGET\t"]
  ]) assert.equal(isPublicIntakeGuardAllowHeaderValid(method, value), true, `${method} ${value} must be accepted`);

  for (const [method, value] of [
    ["GET", null],
    ["GET", undefined],
    ["GET", ""],
    ["GET", "OPTIONS"],
    ["GET", "GET, POST"],
    ["GET", "POST, HEAD"],
    ["GET", "POST, PUT"],
    ["GET", "POST, PATCH"],
    ["GET", "POST, DELETE"],
    ["GET", "POST, POST"],
    ["GET", "POST, OPTIONS, OPTIONS"],
    ["GET", ",POST"],
    ["GET", "POST,"],
    ["GET", "POST,,OPTIONS"],
    ["GET", "post"],
    ["GET", "POST, options"],
    ["GET", "POST;OPTIONS"],
    ["HEAD", "POST"],
    ["HEAD", "OPTIONS"],
    ["HEAD", "POST, OPTIONS"],
    ["HEAD", "GET"],
    ["HEAD", "GET, OPTIONS"],
    ["HEAD", "GET, PUT"],
    ["HEAD", "GET, PATCH"],
    ["HEAD", "GET, DELETE"],
    ["HEAD", "GET, POST, PUT"],
    ["HEAD", "GET, GET"],
    ["HEAD", "GET, POST, OPTIONS"],
    ["HEAD", "get, POST"],
    ["HEAD", "GET, post"],
    ["HEAD", "GET,,POST"],
    ["HEAD", "GET,\nPOST"],
    ["HEAD", "GET,\u0000POST"],
    ["OPTIONS", "POST"],
    ["toString", "POST"],
    ["__proto__", "POST"]
  ]) assert.equal(
    isPublicIntakeGuardAllowHeaderValid(method, value),
    false,
    `${method} ${String(value)} must be rejected`
  );
});

test("public intake smoke fails closed on malformed, duplicate, missing, or unexpected Allow methods", async () => {
  for (const { getAllow, headAllow } of [
    { getAllow: null, headAllow: "GET, POST" },
    { getAllow: "OPTIONS", headAllow: "GET, POST" },
    { getAllow: "POST, POST", headAllow: "GET, POST" },
    { getAllow: "POST,,OPTIONS", headAllow: "GET, POST" },
    { getAllow: "POST, PUT", headAllow: "GET, POST" },
    { getAllow: "GET, POST", headAllow: "GET, POST" },
    { getAllow: "POST", headAllow: "POST, OPTIONS" },
    { getAllow: "POST, OPTIONS", headAllow: "GET, GET" },
    { getAllow: "POST, OPTIONS", headAllow: "GET, PUT" },
    { getAllow: "POST, OPTIONS", headAllow: "GET, POST, PUT" },
    { getAllow: "POST, OPTIONS", headAllow: "GET, POST, OPTIONS" }
  ]) {
    const ledger = [];
    const fetchImpl = async (url, options) => {
      ledger.push({ method: options.method, path: url.pathname, body: options.body });
      if (url.pathname === "/api/partner-intake") {
        const allow = options.method === "GET" ? getAllow : headAllow;
        return {
          status: 405,
          redirected: false,
          headers: { get: name => name.toLowerCase() === "allow" ? allow : null },
          body: null
        };
      }
      return new Response(options.method === "HEAD" ? null : "ok", { status: 200 });
    };
    await assert.rejects(
      runCloudflarePublicWorkerSmoke({ fetchImpl, dryRun: false }),
      /public_intake_guard_invalid/u
    );
    assert.ok(ledger.every(entry => ["GET", "HEAD"].includes(entry.method) && entry.body === undefined));
  }
});

test("static owner gates and forward rollback artifact are deterministic", () => {
  verifyGithubActionsPublicWorkerDeployment();
  verifyPublicStaticDeploymentPolicy(root);
  verifyPublicWranglerPin(root);
  const first = verifyPublicForwardRollbackArtifact(root);
  const second = verifyPublicForwardRollbackArtifact(root);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(first.websiteAssetsSha256, second.websiteAssetsSha256);
  assert.equal(first.identityVersion, "route-iq-public-forward-rollback-artifact-v4");
  assert.equal(first.candidateWebsiteCommit, "1fbfc42eadc1bad486f92bcf0b8bd93a7d0236fd");
  assert.equal(first.candidateWebsiteTree, "a147ed936aaa36422b01e1e997f1b5407a64468a");
  assert.equal(first.candidateDeploymentAssetsSha256, "94def2bbd52b6ffa85a40dbc4c51166fcdffdcc364ffdc99a678ddd91d2ed779");
  assert.equal(first.publicEntrypoint, PUBLIC_WORKER_DEPLOYMENT_POLICY.publicEntrypoint);
  assert.deepEqual(first.publicEntrypointExports, ["default", "RouteIqRequestCrmCoordinator"]);
  assert.equal(first.generatedWorkerSha256, second.generatedWorkerSha256);
  assert.equal(first.generatedSourceMapSha256, second.generatedSourceMapSha256);
});

test("the frozen Website build is byte-identical to the stale-free deployment tree", () => {
  const result = verifyRouteIqPublicDeploymentAssets();
  assert.equal(result.fileCount, 24);
  assert.equal(result.initialCriticalBytes, 612_003);
  assert.deepEqual(result.sizes, {
    index: 3_921,
    criticalEntry: 385_483,
    criticalCss: 34_888,
    logo: 187_711,
    fallback: 176_252,
    socialPreview: 107_247,
    lazy3d: 892_213
  });
});

test("rollback provenance ignores working-tree drift and fails closed on hash, commit, or path tampering", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "route-iq-public-rollback-drift-test-"));
  const repository = join(fixtureRoot, "repository");
  try {
    fixtureGit(root, ["clone", "--quiet", "--shared", root, repository]);
    symlinkSync(resolve(root, "node_modules"), join(repository, "node_modules"), "dir");
    const rollbackContractPath = PUBLIC_WORKER_DEPLOYMENT_POLICY.rollbackContractPath;
    writeFileSync(
      join(repository, rollbackContractPath),
      readFileSync(join(root, rollbackContractPath))
    );
    fixtureGit(repository, ["add", "--", rollbackContractPath]);
    fixtureGit(repository, [
      "-c", "user.name=Prometheus Infrastructure Test",
      "-c", "user.email=infrastructure-test@prometheus.local",
      "commit", "--quiet", "--allow-empty", "-m", "test: seed current rollback contract", "--", rollbackContractPath
    ]);
    const baseline = verifyPublicForwardRollbackArtifact(repository);
    const runtimePath = "workers/infrastructure/route-iq-request-crm-runtime.js";
    const runtimeAbsolute = join(repository, runtimePath);
    const configPath = PUBLIC_WORKER_DEPLOYMENT_POLICY.publicConfig;
    const configAbsolute = join(repository, configPath);
    const originalRuntime = readFileSync(runtimeAbsolute);
    const originalConfig = readFileSync(configAbsolute);
    writeFileSync(runtimeAbsolute, Buffer.concat([originalRuntime, Buffer.from("\n// uncommitted runtime drift\n")]));
    writeFileSync(configAbsolute, Buffer.concat([originalConfig, Buffer.from("\n// uncommitted config drift\n")]));
    assert.equal(verifyPublicForwardRollbackArtifact(repository).artifactSha256, baseline.artifactSha256);
    writeFileSync(runtimeAbsolute, originalRuntime);
    writeFileSync(configAbsolute, originalConfig);

    const contractAbsolute = join(repository, rollbackContractPath);
    const originalContract = readFileSync(contractAbsolute);
    const assertTamperingRejected = update => {
      updateRollbackContract(repository, update);
      assert.throws(
        () => verifyPublicForwardRollbackArtifact(repository),
        error => error instanceof PublicDeploymentPolicyError
          && error.code === PUBLIC_DEPLOYMENT_FAILURE.ROLLBACK_INVALID
      );
      writeFileSync(contractAbsolute, originalContract);
    };
    assertTamperingRejected(contract => {
      contract.candidateStatefulFiles[runtimePath].sha256 = "a".repeat(64);
    });
    assertTamperingRejected(contract => {
      contract.candidateStatefulFiles[runtimePath].sourceCommit = contract.candidateWebsiteCommit;
    });
    assertTamperingRejected(contract => {
      contract.candidateStatefulFiles[`${runtimePath}.tampered`] =
        contract.candidateStatefulFiles[runtimePath];
      delete contract.candidateStatefulFiles[runtimePath];
    });
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
