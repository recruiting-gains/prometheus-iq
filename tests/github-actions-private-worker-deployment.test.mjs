import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import {
  DEPLOYMENT_FAILURE,
  PRIVATE_WORKER_DEPLOYMENT_POLICY,
  assertRepositoryIdentity,
  buildWranglerInvocation,
  fetchDeploymentSnapshot,
  parseDeploymentsEnvelope,
  parseJsonc,
  requireSingleActiveVersion,
  runBoundedWrangler,
  runDeploymentLifecycle,
  scrubDeploymentCredentials,
  takeDeploymentCredentials,
  validateFounderDeploymentInputs,
  verifyStaticDeploymentPolicy
} from "../scripts/lib/github-actions-private-worker-deployment.mjs";
import {
  assertSetupNodeCachingDisabled,
  verifyGithubActionsPrivateWorkerDeployment
} from "../scripts/verify-github-actions-private-worker-deployment.mjs";
import {
  fixedCloudflareUnattendedSmokePlan,
  runCloudflareUnattendedSmoke
} from "../scripts/run-cloudflare-unattended-smoke.mjs";
import {
  CLOUDFLARE_UNATTENDED_SMOKE_MARKER,
  CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN,
  isCloudflareUnattendedSmokeRequestAllowed
} from "../workers/infrastructure/cloudflare-unattended-smoke-contract.js";

const repositoryRoot = resolve(import.meta.dirname, "..");
const approvedCommit = "a".repeat(40);
const approvedTree = "b".repeat(40);
const currentVersion = "11111111-1111-1111-1111-111111111111";
const nextVersion = "22222222-2222-2222-2222-222222222222";
const publicVersion = "33333333-3333-3333-3333-333333333333";
const changedPublicVersion = "44444444-4444-4444-4444-444444444444";
const initialPrivateDeployment = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const nextPrivateDeployment = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const initialPublicDeployment = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const changedPublicDeployment = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const deploymentTokenName = ["CLOUDFLARE", "API", "TOKEN"].join("_");
const deploymentAccountName = ["CLOUDFLARE", "ACCOUNT", "ID"].join("_");
const accessClientIdName = ["CLOUDFLARE", "ACCESS", "CLIENT", "ID"].join("_");
const accessClientSecretName = ["CLOUDFLARE", "ACCESS", "CLIENT", "SECRET"].join("_");

function validEnvironment(overrides = {}) {
  return {
    PROMETHEUS_APPROVED_COMMIT: approvedCommit,
    PROMETHEUS_APPROVED_TREE: approvedTree,
    PROMETHEUS_BATCH_ID: "BATCH-20260715-010",
    PROMETHEUS_CURRENT_PRODUCTION_VERSION: currentVersion,
    GITHUB_REPOSITORY: "PrometheusRouteIQ/prometheus-iq",
    GITHUB_REF: "refs/heads/main",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_SHA: approvedCommit,
    ...overrides
  };
}

const validInputs = Object.freeze({
  approvedCommit,
  approvedTree,
  batchId: "BATCH-20260715-010",
  currentProductionVersion: currentVersion
});

function validIdentity(overrides = {}) {
  return {
    head: approvedCommit,
    tree: approvedTree,
    originMain: approvedCommit,
    branch: "main",
    originUrl: "https://github.com/PrometheusRouteIQ/prometheus-iq",
    status: "",
    unstagedClean: true,
    stagedClean: true,
    ...overrides
  };
}

function expectCode(callback, code) {
  assert.throws(callback, error => error?.code === code && error?.message === code);
}

async function expectCodeAsync(callback, code) {
  await assert.rejects(callback, error => error?.code === code && error?.message === code);
}

function deploymentEnvelope({
  deploymentId = initialPrivateDeployment,
  versionId = currentVersion,
  versions,
  deploymentOverrides = {},
  envelopeOverrides = {}
} = {}) {
  return {
    errors: [],
    messages: [],
    result: {
      deployments: [{
        id: deploymentId,
        created_on: "2026-07-15T12:00:00.123456Z",
        source: "wrangler",
        strategy: "percentage",
        versions: versions ?? [{ percentage: 100, version_id: versionId }],
        annotations: {
          "workers/message": "synthetic test deployment",
          "workers/triggered_by": "deployment"
        },
        author_email: "synthetic@example.invalid",
        ...deploymentOverrides
      }]
    },
    success: true,
    ...envelopeOverrides
  };
}

function snapshot(deploymentId, versionId) {
  return Object.freeze({ deploymentId, versionId });
}

function lifecycleFixture(snapshotSequence, { identities = [validIdentity(), validIdentity()] } = {}) {
  const expectedWorkers = [
    "prometheus-iq",
    "prometheusrouteiq-website",
    "prometheus-iq",
    "prometheusrouteiq-website",
    "prometheus-iq",
    "prometheusrouteiq-website"
  ];
  const calls = { configuration: 0, identity: 0, workers: [], wrangler: [] };
  return {
    calls,
    options: {
      inputs: validInputs,
      verifyConfiguration() {
        calls.configuration += 1;
      },
      inspectIdentity() {
        const value = identities[Math.min(calls.identity, identities.length - 1)];
        calls.identity += 1;
        return value;
      },
      fetchSnapshot(worker) {
        const index = calls.workers.length;
        assert.equal(worker, expectedWorkers[index]);
        calls.workers.push(worker);
        return snapshotSequence[index];
      },
      runWrangler(mode) {
        calls.wrangler.push(mode);
      }
    }
  };
}

function createStaticPolicyFixture() {
  const root = mkdtempSync(join(tmpdir(), "prometheus-private-deploy-"));
  mkdirSync(join(root, "workers/infrastructure"), { recursive: true });
  const privateConfig = {
    name: "prometheus-iq",
    main: "workers/prometheus-iq-worker.js",
    assets: { directory: "./deploy/cloudflare-pages", run_worker_first: true },
    vars: { SYNTHETIC_NONSECRET: "fixed" },
    kv_namespaces: [{ binding: "SYNTHETIC", id: "0".repeat(32) }],
    send_email: [{ name: "FOUNDER_EMAIL", destination_address: "nobody@example.invalid" }],
    durable_objects: { bindings: [{ name: "SYNTHETIC", class_name: "Synthetic" }] },
    migrations: [{ tag: "synthetic-v1", new_sqlite_classes: ["Synthetic"] }]
  };
  const publicConfig = { name: "prometheusrouteiq-website" };
  writeFileSync(join(root, "wrangler.jsonc"), JSON.stringify(privateConfig));
  writeFileSync(
    join(root, "wrangler.prometheusrouteiq-website.jsonc"),
    JSON.stringify(publicConfig)
  );
  writeFileSync(
    join(root, PRIVATE_WORKER_DEPLOYMENT_POLICY.contractPath),
    readFileSync(join(repositoryRoot, PRIVATE_WORKER_DEPLOYMENT_POLICY.contractPath))
  );
  writeFileSync(
    join(root, PRIVATE_WORKER_DEPLOYMENT_POLICY.activationTemplatePath),
    readFileSync(join(repositoryRoot, PRIVATE_WORKER_DEPLOYMENT_POLICY.activationTemplatePath))
  );
  return { root, privateConfig, publicConfig };
}

function createSpawnStub({ exitCode = 0, output = "", captured }) {
  return (command, argumentsList, options) => {
    captured.push({ command, argumentsList, options });
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = signal => {
      child.killedWith = signal;
      return true;
    };
    queueMicrotask(() => {
      if (output) child.stdout.write(output);
      child.stdout.end();
      child.stderr.end();
      child.emit("close", exitCode, null);
    });
    return child;
  };
}

test("owner verifier proves the source-only workflow contract without network access", () => {
  const result = verifyGithubActionsPrivateWorkerDeployment();
  assert.equal(result.status, "passed");
  assert.equal(result.implementationStatus, "IMPLEMENTED_NOT_EXECUTED");
  assert.equal(result.networkRequestsPerformed, 0);
  assert.equal(result.productionMutationPerformed, false);
  assert.equal(result.publicWorkerDeploymentAllowed, false);
});

test("setup-node caching is disabled by omitting both supported inputs", () => {
  const workflow = readFileSync(join(
    repositoryRoot,
    ".github/workflows/deploy-prometheus-private-worker.yml"
  ), "utf8");
  assert.doesNotThrow(() => assertSetupNodeCachingDisabled(workflow));
  for (const injectedInput of [
    "          cache: npm",
    "          cache-dependency-path: package-lock.json",
    "          package-manager-cache: false"
  ]) {
    assert.throws(() => assertSetupNodeCachingDisabled(`${workflow}\n${injectedInput}\n`));
  }
});

test("Founder input formats and exact GitHub context are mandatory", () => {
  assert.deepEqual(validateFounderDeploymentInputs(validEnvironment()), validInputs);
  for (const overrides of [
    { PROMETHEUS_APPROVED_COMMIT: "A".repeat(40) },
    { PROMETHEUS_APPROVED_COMMIT: "a".repeat(39) },
    { PROMETHEUS_APPROVED_TREE: "g".repeat(40) },
    { PROMETHEUS_BATCH_ID: "BATCH-2026715-010" },
    { PROMETHEUS_BATCH_ID: "batch-20260715-010" },
    { PROMETHEUS_CURRENT_PRODUCTION_VERSION: "NOT-A-UUID" },
    { PROMETHEUS_CURRENT_PRODUCTION_VERSION: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa".toUpperCase() }
  ]) {
    expectCode(() => validateFounderDeploymentInputs(validEnvironment(overrides)), DEPLOYMENT_FAILURE.INPUT_INVALID);
  }
  for (const overrides of [
    { GITHUB_REPOSITORY: "PrometheusRouteIQ/other" },
    { GITHUB_REF: "refs/heads/release" },
    { GITHUB_EVENT_NAME: "push" },
    { GITHUB_SHA: "c".repeat(40) }
  ]) {
    expectCode(() => validateFounderDeploymentInputs(validEnvironment(overrides)), DEPLOYMENT_FAILURE.CONTEXT_INVALID);
  }
});

test("repository identity rejects wrong SHA, tree, branch, origin, origin/main, and dirty states", () => {
  assert.doesNotThrow(() => assertRepositoryIdentity(validIdentity(), validInputs));
  for (const overrides of [
    { head: "c".repeat(40) },
    { tree: "d".repeat(40) },
    { branch: "release" },
    { originUrl: "https://github.com/PrometheusRouteIQ/other" }
  ]) {
    expectCode(() => assertRepositoryIdentity(validIdentity(overrides), validInputs), DEPLOYMENT_FAILURE.REPOSITORY_IDENTITY_MISMATCH);
  }
  expectCode(
    () => assertRepositoryIdentity(validIdentity({ originMain: "e".repeat(40) }), validInputs),
    DEPLOYMENT_FAILURE.ORIGIN_MAIN_MISMATCH
  );
  for (const overrides of [
    { status: "?? injected" },
    { unstagedClean: false },
    { stagedClean: false }
  ]) {
    expectCode(() => assertRepositoryIdentity(validIdentity(overrides), validInputs), DEPLOYMENT_FAILURE.REPOSITORY_DIRTY);
  }
});

test("JSONC parser preserves comment-like text in strings and fails closed on malformed comments", () => {
  assert.deepEqual(parseJsonc(`{
    // fixed comment
    "url": "https://example.invalid/a//b",
    /* fixed block */
    "value": 1
  }`), { url: "https://example.invalid/a//b", value: 1 });
  expectCode(() => parseJsonc("{/* unterminated"), DEPLOYMENT_FAILURE.CONFIG_INVALID);
  expectCode(() => parseJsonc("{\"unterminated: true}"), DEPLOYMENT_FAILURE.CONFIG_INVALID);
});

test("static policy accepts only the exact private and public config identities", t => {
  const fixture = createStaticPolicyFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  assert.equal(verifyStaticDeploymentPolicy(fixture.root).privateWorker, "prometheus-iq");

  writeFileSync(join(fixture.root, "wrangler.jsonc"), JSON.stringify({
    ...fixture.privateConfig,
    name: "prometheusrouteiq-website"
  }));
  expectCode(() => verifyStaticDeploymentPolicy(fixture.root), DEPLOYMENT_FAILURE.CONFIG_INVALID);

  writeFileSync(join(fixture.root, "wrangler.jsonc"), JSON.stringify({
    ...fixture.privateConfig,
    env: { production: { name: "injected" } }
  }));
  expectCode(() => verifyStaticDeploymentPolicy(fixture.root), DEPLOYMENT_FAILURE.CONFIG_INVALID);

  writeFileSync(join(fixture.root, "wrangler.jsonc"), JSON.stringify(fixture.privateConfig));
  writeFileSync(
    join(fixture.root, "wrangler.prometheusrouteiq-website.jsonc"),
    JSON.stringify({ name: "injected-public-target" })
  );
  expectCode(() => verifyStaticDeploymentPolicy(fixture.root), DEPLOYMENT_FAILURE.CONFIG_INVALID);
});

test("Wrangler invocation is fixed despite caller target or config injection fields", () => {
  const injectedInputs = {
    ...validInputs,
    worker: "prometheusrouteiq-website",
    config: "wrangler.prometheusrouteiq-website.jsonc",
    command: "delete"
  };
  const deployment = buildWranglerInvocation("deploy", injectedInputs);
  const dryRun = buildWranglerInvocation("dry-run", injectedInputs);
  assert.deepEqual(deployment.slice(0, 8), [
    "node_modules/wrangler/bin/wrangler.js",
    "deploy",
    "--config",
    "wrangler.jsonc",
    "--name",
    "prometheus-iq",
    "--keep-vars",
    "--strict"
  ]);
  assert.equal(deployment.includes("prometheusrouteiq-website"), false);
  assert.equal(deployment.includes("wrangler.prometheusrouteiq-website.jsonc"), false);
  assert.equal(deployment.includes("--env"), false);
  assert.equal(deployment.includes("--dry-run"), false);
  assert.equal(dryRun.includes("--dry-run"), true);
  expectCode(() => buildWranglerInvocation("delete", validInputs), DEPLOYMENT_FAILURE.CONFIG_INVALID);
});

test("strict deployments parser accepts the documented bounded one-hundred-percent shape", () => {
  const deployments = parseDeploymentsEnvelope(JSON.stringify(deploymentEnvelope()));
  assert.deepEqual(requireSingleActiveVersion(deployments), {
    deploymentId: initialPrivateDeployment,
    versionId: currentVersion
  });
});

test("strict deployments parser rejects malformed, broad, and oversized envelopes", () => {
  const malformed = [
    "not-json",
    JSON.stringify({ ...deploymentEnvelope(), unexpected: true }),
    JSON.stringify(deploymentEnvelope({ envelopeOverrides: { success: false } })),
    JSON.stringify(deploymentEnvelope({ envelopeOverrides: { errors: [{ code: 1000 }] } })),
    JSON.stringify(deploymentEnvelope({ deploymentOverrides: { id: "not-a-uuid" } })),
    JSON.stringify(deploymentEnvelope({ deploymentOverrides: { unexpected: true } })),
    JSON.stringify(deploymentEnvelope({ versions: [{ percentage: 0, version_id: currentVersion }] })),
    JSON.stringify(deploymentEnvelope({ versions: [{ percentage: 101, version_id: currentVersion }] }))
  ];
  for (const body of malformed) {
    expectCode(() => parseDeploymentsEnvelope(body), DEPLOYMENT_FAILURE.DEPLOYMENTS_BODY_INVALID);
  }
  expectCode(
    () => parseDeploymentsEnvelope("x".repeat(PRIVATE_WORKER_DEPLOYMENT_POLICY.responseByteLimit + 1)),
    DEPLOYMENT_FAILURE.DEPLOYMENTS_BODY_INVALID
  );
});

test("split traffic is never treated as an active single-version deployment", () => {
  const deployments = parseDeploymentsEnvelope(JSON.stringify(deploymentEnvelope({
    versions: [
      { percentage: 50, version_id: currentVersion },
      { percentage: 50, version_id: nextVersion }
    ]
  })));
  expectCode(() => requireSingleActiveVersion(deployments), DEPLOYMENT_FAILURE.TRAFFIC_SPLIT);
});

test("deployment GET uses one fixed worker endpoint, no body, no cookies, and no redirect follow", async () => {
  const requests = [];
  let scrubbedHeaders;
  const credentials = { apiToken: "synthetic-secret-never-output", accountId: "1".repeat(32) };
  const result = await fetchDeploymentSnapshot("prometheus-iq", credentials, (url, options) => {
    scrubbedHeaders = options.headers;
    requests.push({
      url,
      options: { ...options, headers: { ...options.headers } }
    });
    return new Response(JSON.stringify(deploymentEnvelope()), { status: 200 });
  });
  assert.equal(result.versionId, currentVersion);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.origin, "https://api.cloudflare.com");
  assert.equal(requests[0].url.pathname.endsWith("/workers/scripts/prometheus-iq/deployments"), true);
  assert.equal(requests[0].options.method, "GET");
  assert.equal(requests[0].options.redirect, "manual");
  assert.equal(requests[0].options.credentials, "omit");
  assert.equal(Object.hasOwn(requests[0].options, "body"), false);
  assert.equal(requests[0].options.headers.Authorization, "Bearer synthetic-secret-never-output");
  assert.equal(Object.hasOwn(scrubbedHeaders, "Authorization"), false);

  let called = false;
  await expectCodeAsync(
    () => fetchDeploymentSnapshot("prometheusrouteiq-website-injected", credentials, () => {
      called = true;
    }),
    DEPLOYMENT_FAILURE.CREDENTIAL_CONTEXT_INVALID
  );
  assert.equal(called, false);
});

test("deployment GET fails closed for redirect, HTTP error, malformed body, and network uncertainty", async () => {
  const credentials = { apiToken: "synthetic-secret-never-output", accountId: "1".repeat(32) };
  await expectCodeAsync(
    () => fetchDeploymentSnapshot("prometheus-iq", credentials, () => new Response("", { status: 302 })),
    DEPLOYMENT_FAILURE.DEPLOYMENTS_REDIRECT_DENIED
  );
  await expectCodeAsync(
    () => fetchDeploymentSnapshot("prometheus-iq", credentials, () => new Response("", { status: 500 })),
    DEPLOYMENT_FAILURE.DEPLOYMENTS_HTTP_FAILED
  );
  await expectCodeAsync(
    () => fetchDeploymentSnapshot("prometheus-iq", credentials, () => new Response("{}", { status: 200 })),
    DEPLOYMENT_FAILURE.DEPLOYMENTS_BODY_INVALID
  );
  await expectCodeAsync(
    () => fetchDeploymentSnapshot("prometheus-iq", credentials, () => {
      throw new Error("synthetic-secret-never-output");
    }),
    DEPLOYMENT_FAILURE.DEPLOYMENTS_NETWORK_UNCERTAIN
  );
  await expectCodeAsync(
    () => fetchDeploymentSnapshot("prometheus-iq", credentials, () => ({
      status: 200,
      redirected: false,
      body: {
        getReader() {
          return {
            read() {
              throw new Error("synthetic-secret-never-output");
            },
            releaseLock() {}
          };
        }
      }
    })),
    DEPLOYMENT_FAILURE.DEPLOYMENTS_NETWORK_UNCERTAIN
  );
});

test("credential capture deletes process-style source names and supports explicit scrubbing", () => {
  const environment = {
    [deploymentTokenName]: "synthetic-secret-never-output",
    [deploymentAccountName]: "1".repeat(32)
  };
  const credentials = takeDeploymentCredentials(environment);
  assert.equal(Object.hasOwn(environment, "CLOUDFLARE_API_TOKEN"), false);
  assert.equal(Object.hasOwn(environment, "CLOUDFLARE_ACCOUNT_ID"), false);
  scrubDeploymentCredentials(credentials);
  assert.deepEqual(credentials, { apiToken: "", accountId: "" });
  expectCode(
    () => takeDeploymentCredentials({
      [deploymentTokenName]: "",
      [deploymentAccountName]: "bad"
    }),
    DEPLOYMENT_FAILURE.CREDENTIAL_CONTEXT_INVALID
  );
});

test("bounded Wrangler child receives exact args and only allowlisted inherited environment", async t => {
  const captured = [];
  const previous = process.env.PROMETHEUS_SYNTHETIC_UNRELATED_SECRET;
  process.env.PROMETHEUS_SYNTHETIC_UNRELATED_SECRET = "must-not-enter-child";
  t.after(() => {
    if (previous === undefined) delete process.env.PROMETHEUS_SYNTHETIC_UNRELATED_SECRET;
    else process.env.PROMETHEUS_SYNTHETIC_UNRELATED_SECRET = previous;
  });
  await runBoundedWrangler({
    root: repositoryRoot,
    mode: "dry-run",
    inputs: validInputs,
    credentials: { apiToken: "synthetic-secret-never-output", accountId: "1".repeat(32) },
    spawnImpl: createSpawnStub({
      captured,
      output: "synthetic-secret-never-output"
    })
  });
  assert.equal(captured.length, 1);
  assert.equal(captured[0].command, process.execPath);
  assert.equal(captured[0].argumentsList.includes("--dry-run"), true);
  assert.equal(captured[0].argumentsList.includes("prometheusrouteiq-website"), false);
  assert.equal(captured[0].options.stdio[0], "ignore");
  assert.equal(captured[0].options.env.PROMETHEUS_SYNTHETIC_UNRELATED_SECRET, undefined);
  assert.equal(captured[0].options.env.NODE_OPTIONS, undefined);
});

test("Wrangler dry-run and deploy failures remain fixed nonsecret classifications", async () => {
  for (const [mode, code] of [
    ["dry-run", DEPLOYMENT_FAILURE.DRY_RUN_FAILED],
    ["deploy", DEPLOYMENT_FAILURE.DEPLOY_FAILED]
  ]) {
    await expectCodeAsync(() => runBoundedWrangler({
      root: repositoryRoot,
      mode,
      inputs: validInputs,
      credentials: { apiToken: "synthetic-secret-never-output", accountId: "1".repeat(32) },
      spawnImpl: createSpawnStub({ captured: [], exitCode: 1, output: "synthetic-secret-never-output" })
    }), code);
  }
});

test("successful lifecycle performs exact precheck, dry-run, concurrency check, deploy, and postcheck", async () => {
  const fixture = lifecycleFixture([
    snapshot(initialPrivateDeployment, currentVersion),
    snapshot(initialPublicDeployment, publicVersion),
    snapshot(initialPrivateDeployment, currentVersion),
    snapshot(initialPublicDeployment, publicVersion),
    snapshot(nextPrivateDeployment, nextVersion),
    snapshot(initialPublicDeployment, publicVersion)
  ]);
  assert.deepEqual(await runDeploymentLifecycle(fixture.options), {
    status: "PRIVATE_WORKER_DEPLOYMENT_VERIFIED"
  });
  assert.equal(fixture.calls.configuration, 1);
  assert.equal(fixture.calls.identity, 2);
  assert.deepEqual(fixture.calls.wrangler, ["dry-run", "deploy"]);
  assert.equal(fixture.calls.workers.length, 6);
});

test("stale current production version stops before public read, dry-run, or deployment", async () => {
  const fixture = lifecycleFixture([
    snapshot(initialPrivateDeployment, nextVersion)
  ]);
  await expectCodeAsync(
    () => runDeploymentLifecycle(fixture.options),
    DEPLOYMENT_FAILURE.CURRENT_VERSION_MISMATCH
  );
  assert.deepEqual(fixture.calls.workers, ["prometheus-iq"]);
  assert.deepEqual(fixture.calls.wrangler, []);
});

test("concurrent or duplicate deployment state stops the mutation boundary", async () => {
  const fixture = lifecycleFixture([
    snapshot(initialPrivateDeployment, currentVersion),
    snapshot(initialPublicDeployment, publicVersion),
    snapshot(nextPrivateDeployment, nextVersion),
    snapshot(initialPublicDeployment, publicVersion)
  ]);
  await expectCodeAsync(
    () => runDeploymentLifecycle(fixture.options),
    DEPLOYMENT_FAILURE.CONCURRENT_DEPLOYMENT_DETECTED
  );
  assert.deepEqual(fixture.calls.wrangler, ["dry-run"]);
});

test("repository tamper after dry-run stops before deploy", async () => {
  const fixture = lifecycleFixture([
    snapshot(initialPrivateDeployment, currentVersion),
    snapshot(initialPublicDeployment, publicVersion),
    snapshot(initialPrivateDeployment, currentVersion),
    snapshot(initialPublicDeployment, publicVersion)
  ], { identities: [validIdentity(), validIdentity({ status: " M injected" })] });
  await expectCodeAsync(
    () => runDeploymentLifecycle(fixture.options),
    DEPLOYMENT_FAILURE.REPOSITORY_DIRTY
  );
  assert.deepEqual(fixture.calls.wrangler, ["dry-run"]);
});

test("dry-run and deploy adapter failures never advance to a false success", async () => {
  const dryFixture = lifecycleFixture([
    snapshot(initialPrivateDeployment, currentVersion),
    snapshot(initialPublicDeployment, publicVersion)
  ]);
  dryFixture.options.runWrangler = mode => {
    dryFixture.calls.wrangler.push(mode);
    throw Object.assign(new Error(DEPLOYMENT_FAILURE.DRY_RUN_FAILED), {
      code: DEPLOYMENT_FAILURE.DRY_RUN_FAILED
    });
  };
  await expectCodeAsync(
    () => runDeploymentLifecycle(dryFixture.options),
    DEPLOYMENT_FAILURE.DRY_RUN_FAILED
  );
  assert.equal(dryFixture.calls.workers.length, 2);

  const deployFixture = lifecycleFixture([
    snapshot(initialPrivateDeployment, currentVersion),
    snapshot(initialPublicDeployment, publicVersion),
    snapshot(initialPrivateDeployment, currentVersion),
    snapshot(initialPublicDeployment, publicVersion)
  ]);
  deployFixture.options.runWrangler = mode => {
    deployFixture.calls.wrangler.push(mode);
    if (mode === "deploy") {
      throw Object.assign(new Error(DEPLOYMENT_FAILURE.DEPLOY_FAILED), {
        code: DEPLOYMENT_FAILURE.DEPLOY_FAILED
      });
    }
  };
  await expectCodeAsync(
    () => runDeploymentLifecycle(deployFixture.options),
    DEPLOYMENT_FAILURE.DEPLOY_FAILED
  );
  assert.deepEqual(deployFixture.calls.wrangler, ["dry-run", "deploy"]);
  assert.equal(deployFixture.calls.workers.length, 4);
});

test("unchanged private version after deploy is a post-deploy mismatch", async () => {
  const fixture = lifecycleFixture([
    snapshot(initialPrivateDeployment, currentVersion),
    snapshot(initialPublicDeployment, publicVersion),
    snapshot(initialPrivateDeployment, currentVersion),
    snapshot(initialPublicDeployment, publicVersion),
    snapshot(initialPrivateDeployment, currentVersion),
    snapshot(initialPublicDeployment, publicVersion)
  ]);
  await expectCodeAsync(
    () => runDeploymentLifecycle(fixture.options),
    DEPLOYMENT_FAILURE.POST_DEPLOY_VERSION_MISMATCH
  );
});

test("public Worker version change fails after a valid new private version", async () => {
  const fixture = lifecycleFixture([
    snapshot(initialPrivateDeployment, currentVersion),
    snapshot(initialPublicDeployment, publicVersion),
    snapshot(initialPrivateDeployment, currentVersion),
    snapshot(initialPublicDeployment, publicVersion),
    snapshot(nextPrivateDeployment, nextVersion),
    snapshot(initialPublicDeployment, changedPublicVersion)
  ]);
  await expectCodeAsync(
    () => runDeploymentLifecycle(fixture.options),
    DEPLOYMENT_FAILURE.PUBLIC_VERSION_CHANGED
  );
});

test("public Worker deployment ID change fails even when its version is unchanged", async () => {
  const fixture = lifecycleFixture([
    snapshot(initialPrivateDeployment, currentVersion),
    snapshot(initialPublicDeployment, publicVersion),
    snapshot(initialPrivateDeployment, currentVersion),
    snapshot(initialPublicDeployment, publicVersion),
    snapshot(nextPrivateDeployment, nextVersion),
    snapshot(changedPublicDeployment, publicVersion)
  ]);
  await expectCodeAsync(
    () => runDeploymentLifecycle(fixture.options),
    DEPLOYMENT_FAILURE.PUBLIC_VERSION_CHANGED
  );
});

test("fixed smoke client rejects writes, bodies, redirects, cookies, and arbitrary origins", async () => {
  const plan = fixedCloudflareUnattendedSmokePlan();
  assert.ok(plan.length > 0);
  assert.equal(plan.every(request => ["GET", "HEAD"].includes(request.method)), true);
  assert.equal(plan.every(request => request.body === false), true);
  assert.equal(plan.every(request => request.redirect === "manual"), true);
  assert.equal(plan.every(request => request.credentials === "omit"), true);
  assert.equal(
    isCloudflareUnattendedSmokeRequestAllowed("POST", new URL(CLOUDFLARE_UNATTENDED_SMOKE_ORIGIN)),
    false
  );
  assert.equal(
    isCloudflareUnattendedSmokeRequestAllowed("GET", new URL("https://example.invalid/")),
    false
  );

  const requests = [];
  const result = await runCloudflareUnattendedSmoke({
    dryRun: false,
    credentials: {
      [accessClientIdName]: "synthetic-client-id",
      [accessClientSecretName]: "synthetic-secret-never-output"
    },
    fetchImpl(url, options) {
      requests.push({ url: String(url), options });
      return new Response(null, {
        status: 200,
        headers: {
          [CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseHeader]:
            CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseValue
        }
      });
    }
  });
  assert.equal(result.status, "passed");
  assert.equal(result.attemptedWriteCount, 0);
  assert.equal(requests.every(request => !Object.hasOwn(request.options, "body")), true);
  assert.equal(requests.every(request => request.options.redirect === "manual"), true);
  assert.equal(requests.every(request => request.options.credentials === "omit"), true);
  assert.equal(JSON.stringify(result).includes("synthetic-secret-never-output"), false);
});
