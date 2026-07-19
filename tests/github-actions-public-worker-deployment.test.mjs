import test from "node:test";
import assert from "node:assert/strict";
import { lstatSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  PUBLIC_DEPLOYMENT_FAILURE,
  PUBLIC_WORKER_DEPLOYMENT_POLICY,
  PublicDeploymentPolicyError,
  assertPublicBindingsCanBePreserved,
  buildPublicWranglerInvocation,
  createFounderSettingsSecretFile,
  fetchPublicWorkerState,
  removeFounderSettingsSecretFile,
  runPublicDeploymentLifecycle,
  scrubPublicDeploymentCredentials,
  takePublicDeploymentCredentials,
  validatePublicFounderDeploymentInputs,
  verifyPublicStaticDeploymentPolicy,
  verifyPublicWranglerPin
} from "../scripts/lib/github-actions-public-worker-deployment.mjs";
import { verifyPublicForwardRollbackArtifact } from "../scripts/lib/route-iq-public-forward-rollback.mjs";
import { runCloudflarePublicWorkerSmoke } from "../scripts/run-cloudflare-public-worker-smoke.mjs";
import { verifyGithubActionsPublicWorkerDeployment } from "../scripts/verify-github-actions-public-worker-deployment.mjs";

const root = resolve(import.meta.dirname, "..");
const approvedCommit = "a".repeat(40);
const approvedTree = "b".repeat(40);
const publicVersion = "11111111-1111-4111-8111-111111111111";
const privateVersion = "22222222-2222-4222-8222-222222222222";
const rollbackHash = "c".repeat(64);

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
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    }
    return new Response(options.method === "HEAD" ? null : "ok", { status: 200 });
  };
  const result = await runCloudflarePublicWorkerSmoke({ fetchImpl, dryRun: false });
  assert.equal(result.attemptedWriteCount, 0);
  assert.ok(ledger.every(entry => ["GET", "HEAD"].includes(entry.method) && entry.body === undefined));
});

test("static owner gates and forward rollback artifact are deterministic", () => {
  verifyGithubActionsPublicWorkerDeployment();
  verifyPublicStaticDeploymentPolicy(root);
  verifyPublicWranglerPin(root);
  const first = verifyPublicForwardRollbackArtifact(root);
  const second = verifyPublicForwardRollbackArtifact(root);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(first.websiteAssetsSha256, second.websiteAssetsSha256);
});
