import { spawn, spawnSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const PRIVATE_WORKER_DEPLOYMENT_POLICY = Object.freeze({
  contractVersion: "github-actions-founder-triggered-private-worker-deployment-v1",
  repository: "PrometheusRouteIQ/prometheus-iq",
  repositoryUrl: "https://github.com/PrometheusRouteIQ/prometheus-iq",
  branch: "main",
  ref: "refs/heads/main",
  eventName: "workflow_dispatch",
  privateWorker: "prometheus-iq",
  publicWorker: "prometheusrouteiq-website",
  privateConfig: "wrangler.jsonc",
  publicConfig: "wrangler.prometheusrouteiq-website.jsonc",
  contractPath: "workers/infrastructure/github-actions-founder-triggered-private-worker-deployment-v1.json",
  activationTemplatePath: "workers/infrastructure/route-iq-prospective-shadow-activation-template-v1.json",
  wranglerVersion: "4.110.0",
  wranglerModule: "node_modules/wrangler/bin/wrangler.js",
  cloudflareApiOrigin: "https://api.cloudflare.com",
  responseByteLimit: 65_536,
  commandOutputByteLimit: 65_536,
  requestTimeoutMs: 10_000,
  dryRunTimeoutMs: 180_000,
  deployTimeoutMs: 300_000
});

export const DEPLOYMENT_FAILURE = Object.freeze({
  INPUT_INVALID: "INPUT_INVALID",
  CONTEXT_INVALID: "CONTEXT_INVALID",
  REPOSITORY_IDENTITY_MISMATCH: "REPOSITORY_IDENTITY_MISMATCH",
  REPOSITORY_DIRTY: "REPOSITORY_DIRTY",
  ORIGIN_MAIN_MISMATCH: "ORIGIN_MAIN_MISMATCH",
  REPOSITORY_INTEGRITY_FAILED: "REPOSITORY_INTEGRITY_FAILED",
  CONFIG_INVALID: "CONFIG_INVALID",
  GOVERNANCE_BOUNDARY_INVALID: "GOVERNANCE_BOUNDARY_INVALID",
  WRANGLER_PIN_INVALID: "WRANGLER_PIN_INVALID",
  CREDENTIAL_CONTEXT_INVALID: "CREDENTIAL_CONTEXT_INVALID",
  DEPLOYMENTS_NETWORK_UNCERTAIN: "DEPLOYMENTS_NETWORK_UNCERTAIN",
  DEPLOYMENTS_REDIRECT_DENIED: "DEPLOYMENTS_REDIRECT_DENIED",
  DEPLOYMENTS_HTTP_FAILED: "DEPLOYMENTS_HTTP_FAILED",
  DEPLOYMENTS_BODY_INVALID: "DEPLOYMENTS_BODY_INVALID",
  CURRENT_VERSION_MISMATCH: "CURRENT_VERSION_MISMATCH",
  TRAFFIC_SPLIT: "TRAFFIC_SPLIT",
  CONCURRENT_DEPLOYMENT_DETECTED: "CONCURRENT_DEPLOYMENT_DETECTED",
  DRY_RUN_FAILED: "DRY_RUN_FAILED",
  DEPLOY_FAILED: "DEPLOY_FAILED",
  POST_DEPLOY_VERSION_MISMATCH: "POST_DEPLOY_VERSION_MISMATCH",
  PUBLIC_VERSION_CHANGED: "PUBLIC_VERSION_CHANGED"
});

const LOWER_HEX_40 = /^[0-9a-f]{40}$/u;
const ACCOUNT_ID = /^[0-9a-f]{32}$/u;
const BATCH_ID = /^BATCH-[0-9]{8}-[0-9]{3}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const MAX_TEXT_FILE_BYTES = 2_000_000;
const MAX_GIT_OUTPUT_BYTES = 1_000_000;
const GIT_TIMEOUT_MS = 30_000;
const DEPLOYMENT_CREDENTIAL_ENV = Object.freeze({
  apiToken: ["CLOUDFLARE", "API", "TOKEN"].join("_"),
  accountId: ["CLOUDFLARE", "ACCOUNT", "ID"].join("_")
});

export class DeploymentPolicyError extends Error {
  constructor(code) {
    super(code);
    this.name = "DeploymentPolicyError";
    this.code = code;
  }
}

function fail(code) {
  throw new DeploymentPolicyError(code);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value, required, optional = []) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const allowed = new Set([...required, ...optional]);
  return required.every(key => Object.hasOwn(value, key))
    && actual.every(key => allowed.has(key));
}

function boundedString(value, maximum) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}

function canonicalDateTime(value) {
  if (!boundedString(value, 128)) return false;
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,9})?Z$/u.test(value)
    && Number.isFinite(Date.parse(value));
}

export function validateFounderDeploymentInputs(environment) {
  const approvedCommit = environment.PROMETHEUS_APPROVED_COMMIT;
  const approvedTree = environment.PROMETHEUS_APPROVED_TREE;
  const batchId = environment.PROMETHEUS_BATCH_ID;
  const currentProductionVersion = environment.PROMETHEUS_CURRENT_PRODUCTION_VERSION;

  if (!LOWER_HEX_40.test(approvedCommit ?? "")
    || !LOWER_HEX_40.test(approvedTree ?? "")
    || !BATCH_ID.test(batchId ?? "")
    || !UUID.test(currentProductionVersion ?? "")) {
    fail(DEPLOYMENT_FAILURE.INPUT_INVALID);
  }
  if (environment.GITHUB_REPOSITORY !== PRIVATE_WORKER_DEPLOYMENT_POLICY.repository
    || environment.GITHUB_REF !== PRIVATE_WORKER_DEPLOYMENT_POLICY.ref
    || environment.GITHUB_EVENT_NAME !== PRIVATE_WORKER_DEPLOYMENT_POLICY.eventName
    || environment.GITHUB_SHA !== approvedCommit) {
    fail(DEPLOYMENT_FAILURE.CONTEXT_INVALID);
  }

  return Object.freeze({
    approvedCommit,
    approvedTree,
    batchId,
    currentProductionVersion
  });
}

export function takeDeploymentCredentials(environment) {
  const apiToken = environment[DEPLOYMENT_CREDENTIAL_ENV.apiToken];
  const accountId = environment[DEPLOYMENT_CREDENTIAL_ENV.accountId];
  delete environment[DEPLOYMENT_CREDENTIAL_ENV.apiToken];
  delete environment[DEPLOYMENT_CREDENTIAL_ENV.accountId];
  if (!boundedString(apiToken, 4096) || !ACCOUNT_ID.test(accountId ?? "")) {
    fail(DEPLOYMENT_FAILURE.CREDENTIAL_CONTEXT_INVALID);
  }
  return { apiToken, accountId };
}

export function scrubDeploymentCredentials(credentials) {
  if (!credentials || typeof credentials !== "object") return;
  credentials.apiToken = "";
  credentials.accountId = "";
}

function runGit(root, args, { quietExitOneAllowed = false } = {}) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    input: undefined,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: MAX_GIT_OUTPUT_BYTES,
    timeout: GIT_TIMEOUT_MS,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0"
    }
  });
  if (quietExitOneAllowed && result.status === 1 && !result.error && !result.signal) return null;
  if (result.status !== 0 || result.error || result.signal) {
    fail(DEPLOYMENT_FAILURE.REPOSITORY_IDENTITY_MISMATCH);
  }
  return (result.stdout ?? "").trim();
}

export function readRepositoryIdentity(root) {
  const unstaged = runGit(root, ["diff", "--quiet"], { quietExitOneAllowed: true });
  const staged = runGit(root, ["diff", "--cached", "--quiet"], { quietExitOneAllowed: true });
  return Object.freeze({
    head: runGit(root, ["rev-parse", "--verify", "HEAD"]),
    tree: runGit(root, ["rev-parse", "--verify", "HEAD^{tree}"]),
    originMain: runGit(root, ["rev-parse", "--verify", "refs/remotes/origin/main"]),
    branch: runGit(root, ["branch", "--show-current"]),
    originUrl: runGit(root, ["remote", "get-url", "origin"]),
    status: runGit(root, ["status", "--porcelain=v1", "--untracked-files=all"]),
    unstagedClean: unstaged !== null,
    stagedClean: staged !== null
  });
}

export function assertRepositoryIdentity(identity, inputs) {
  if (identity.head !== inputs.approvedCommit
    || identity.tree !== inputs.approvedTree
    || identity.branch !== PRIVATE_WORKER_DEPLOYMENT_POLICY.branch
    || ![
      PRIVATE_WORKER_DEPLOYMENT_POLICY.repositoryUrl,
      `${PRIVATE_WORKER_DEPLOYMENT_POLICY.repositoryUrl}.git`
    ].includes(identity.originUrl)) {
    fail(DEPLOYMENT_FAILURE.REPOSITORY_IDENTITY_MISMATCH);
  }
  if (identity.originMain !== inputs.approvedCommit) {
    fail(DEPLOYMENT_FAILURE.ORIGIN_MAIN_MISMATCH);
  }
  if (identity.status !== "" || !identity.unstagedClean || !identity.stagedClean) {
    fail(DEPLOYMENT_FAILURE.REPOSITORY_DIRTY);
  }
}

export function verifyRepositoryIntegrity(root) {
  const result = spawnSync("git", ["fsck", "--full", "--strict"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: MAX_GIT_OUTPUT_BYTES,
    timeout: 120_000,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0"
    }
  });
  if (result.status !== 0 || result.error || result.signal) {
    fail(DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED);
  }
}

export function parseJsonc(text) {
  if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > MAX_TEXT_FILE_BYTES) {
    fail(DEPLOYMENT_FAILURE.CONFIG_INVALID);
  }
  let output = "";
  let state = "normal";
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (state === "line") {
      if (character === "\n" || character === "\r") {
        output += character;
        state = "normal";
      } else {
        output += " ";
      }
      continue;
    }
    if (state === "block") {
      if (character === "*" && next === "/") {
        output += "  ";
        index += 1;
        state = "normal";
      } else {
        output += character === "\n" || character === "\r" ? character : " ";
      }
      continue;
    }
    if (state === "string") {
      output += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "\"") {
        state = "normal";
      }
      continue;
    }
    if (character === "\"") {
      state = "string";
      output += character;
    } else if (character === "/" && next === "/") {
      state = "line";
      output += "  ";
      index += 1;
    } else if (character === "/" && next === "*") {
      state = "block";
      output += "  ";
      index += 1;
    } else {
      output += character;
    }
  }
  if (state === "string" || state === "block") fail(DEPLOYMENT_FAILURE.CONFIG_INVALID);
  try {
    return JSON.parse(output);
  } catch {
    fail(DEPLOYMENT_FAILURE.CONFIG_INVALID);
  }
}

function readBoundedRegularFile(root, relativePath) {
  const absolutePath = resolve(root, relativePath);
  const info = lstatSync(absolutePath);
  if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_TEXT_FILE_BYTES) {
    fail(DEPLOYMENT_FAILURE.CONFIG_INVALID);
  }
  return readFileSync(absolutePath, "utf8");
}

function nonemptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

export function verifyStaticDeploymentPolicy(root) {
  let privateConfig;
  let publicConfig;
  let contract;
  let activationTemplate;
  try {
    privateConfig = parseJsonc(readBoundedRegularFile(root, PRIVATE_WORKER_DEPLOYMENT_POLICY.privateConfig));
    publicConfig = parseJsonc(readBoundedRegularFile(root, PRIVATE_WORKER_DEPLOYMENT_POLICY.publicConfig));
    contract = JSON.parse(readBoundedRegularFile(root, PRIVATE_WORKER_DEPLOYMENT_POLICY.contractPath));
    activationTemplate = JSON.parse(readBoundedRegularFile(
      root,
      PRIVATE_WORKER_DEPLOYMENT_POLICY.activationTemplatePath
    ));
  } catch (error) {
    if (error instanceof DeploymentPolicyError) throw error;
    fail(DEPLOYMENT_FAILURE.CONFIG_INVALID);
  }

  if (!isPlainObject(privateConfig)
    || privateConfig.name !== PRIVATE_WORKER_DEPLOYMENT_POLICY.privateWorker
    || privateConfig.main !== "workers/prometheus-iq-worker.js"
    || Object.hasOwn(privateConfig, "env")
    || !isPlainObject(privateConfig.assets)
    || privateConfig.assets.directory !== "./deploy/cloudflare-pages"
    || privateConfig.assets.run_worker_first !== true
    || !isPlainObject(privateConfig.vars)
    || Object.keys(privateConfig.vars).length === 0
    || !nonemptyArray(privateConfig.kv_namespaces)
    || !nonemptyArray(privateConfig.send_email)
    || !isPlainObject(privateConfig.durable_objects)
    || !nonemptyArray(privateConfig.durable_objects.bindings)
    || !nonemptyArray(privateConfig.migrations)
    || !isPlainObject(publicConfig)
    || publicConfig.name !== PRIVATE_WORKER_DEPLOYMENT_POLICY.publicWorker) {
    fail(DEPLOYMENT_FAILURE.CONFIG_INVALID);
  }

  if (!isPlainObject(contract)
    || contract.contractVersion !== PRIVATE_WORKER_DEPLOYMENT_POLICY.contractVersion
    || contract.batchId !== "BATCH-20260715-010"
    || contract.owner !== "Prometheus Infrastructure"
    || contract.implementationStatus !== "IMPLEMENTED_NOT_EXECUTED"
    || contract.deploymentPerformed !== false
    || contract.productionMutationPerformed !== false
    || contract.target?.repository !== PRIVATE_WORKER_DEPLOYMENT_POLICY.repository
    || contract.target?.branch !== PRIVATE_WORKER_DEPLOYMENT_POLICY.branch
    || contract.target?.privateWorker !== PRIVATE_WORKER_DEPLOYMENT_POLICY.privateWorker
    || contract.target?.publicWorker !== PRIVATE_WORKER_DEPLOYMENT_POLICY.publicWorker
    || contract.target?.publicWorkerDeploymentAllowed !== false
    || contract.runtimeBoundaries?.collection !== "OFF"
    || contract.runtimeBoundaries?.activeCohortCount !== 0
    || contract.runtimeBoundaries?.recommendationInfluence !== "OFF"
    || activationTemplate.collection !== "OFF"
    || activationTemplate.activeCohortCount !== 0
    || activationTemplate.recommendationInfluence !== "OFF") {
    fail(DEPLOYMENT_FAILURE.GOVERNANCE_BOUNDARY_INVALID);
  }

  return Object.freeze({
    privateWorker: privateConfig.name,
    publicWorker: publicConfig.name,
    collection: activationTemplate.collection,
    activeCohortCount: activationTemplate.activeCohortCount,
    recommendationInfluence: activationTemplate.recommendationInfluence
  });
}

export function verifyWranglerPin(root) {
  try {
    const packageJson = JSON.parse(readBoundedRegularFile(root, "package.json"));
    const packageLock = JSON.parse(readBoundedRegularFile(root, "package-lock.json"));
    const installed = JSON.parse(readBoundedRegularFile(root, "node_modules/wrangler/package.json"));
    if (packageJson.devDependencies?.wrangler !== PRIVATE_WORKER_DEPLOYMENT_POLICY.wranglerVersion
      || packageLock.packages?.[""]?.devDependencies?.wrangler
        !== PRIVATE_WORKER_DEPLOYMENT_POLICY.wranglerVersion
      || packageLock.packages?.["node_modules/wrangler"]?.version
        !== PRIVATE_WORKER_DEPLOYMENT_POLICY.wranglerVersion
      || installed.version !== PRIVATE_WORKER_DEPLOYMENT_POLICY.wranglerVersion
      || installed.bin?.wrangler !== "./bin/wrangler.js") {
      fail(DEPLOYMENT_FAILURE.WRANGLER_PIN_INVALID);
    }
  } catch (error) {
    if (error instanceof DeploymentPolicyError) throw error;
    fail(DEPLOYMENT_FAILURE.WRANGLER_PIN_INVALID);
  }
}

export function buildWranglerInvocation(mode, inputs) {
  if (!new Set(["dry-run", "deploy"]).has(mode)) fail(DEPLOYMENT_FAILURE.CONFIG_INVALID);
  const message = `${inputs.batchId} founder-approved ${inputs.approvedCommit}`;
  const tag = `prometheus-${inputs.batchId.toLowerCase()}-${inputs.approvedCommit.slice(0, 12)}`;
  if (message.length > 128 || tag.length > 64) fail(DEPLOYMENT_FAILURE.INPUT_INVALID);
  const argumentsList = [
    PRIVATE_WORKER_DEPLOYMENT_POLICY.wranglerModule,
    "deploy",
    "--config",
    PRIVATE_WORKER_DEPLOYMENT_POLICY.privateConfig,
    "--name",
    PRIVATE_WORKER_DEPLOYMENT_POLICY.privateWorker,
    "--keep-vars",
    "--strict",
    "--message",
    message,
    "--tag",
    tag
  ];
  if (mode === "dry-run") argumentsList.splice(2, 0, "--dry-run");
  return Object.freeze(argumentsList);
}

function validAnnotationObject(value) {
  if (!hasExactKeys(value, [], ["workers/message", "workers/triggered_by"])) return false;
  return Object.values(value).every(entry => boundedString(entry, 1000));
}

export function parseDeploymentsEnvelope(body) {
  const byteLength = Buffer.isBuffer(body)
    ? body.length
    : typeof body === "string" ? Buffer.byteLength(body, "utf8") : Infinity;
  if (byteLength < 2 || byteLength > PRIVATE_WORKER_DEPLOYMENT_POLICY.responseByteLimit) {
    fail(DEPLOYMENT_FAILURE.DEPLOYMENTS_BODY_INVALID);
  }
  let envelope;
  try {
    envelope = JSON.parse(Buffer.isBuffer(body) ? body.toString("utf8") : body);
  } catch {
    fail(DEPLOYMENT_FAILURE.DEPLOYMENTS_BODY_INVALID);
  }
  if (!hasExactKeys(envelope, ["errors", "messages", "result", "success"])
    || envelope.success !== true
    || !Array.isArray(envelope.errors)
    || envelope.errors.length !== 0
    || !Array.isArray(envelope.messages)
    || envelope.messages.length !== 0
    || !hasExactKeys(envelope.result, ["deployments"])
    || !nonemptyArray(envelope.result.deployments)
    || envelope.result.deployments.length > 100) {
    fail(DEPLOYMENT_FAILURE.DEPLOYMENTS_BODY_INVALID);
  }

  const deployments = envelope.result.deployments.map(deployment => {
    if (!hasExactKeys(
      deployment,
      ["id", "created_on", "source", "strategy", "versions"],
      ["annotations", "author_email"]
    )
      || !UUID.test(deployment.id ?? "")
      || !canonicalDateTime(deployment.created_on)
      || !boundedString(deployment.source, 128)
      || deployment.strategy !== "percentage"
      || !nonemptyArray(deployment.versions)
      || deployment.versions.length > 100
      || (Object.hasOwn(deployment, "annotations")
        && !validAnnotationObject(deployment.annotations))
      || (Object.hasOwn(deployment, "author_email")
        && !boundedString(deployment.author_email, 320))) {
      fail(DEPLOYMENT_FAILURE.DEPLOYMENTS_BODY_INVALID);
    }
    const versions = deployment.versions.map(version => {
      if (!hasExactKeys(version, ["percentage", "version_id"])
        || !UUID.test(version.version_id ?? "")
        || typeof version.percentage !== "number"
        || !Number.isFinite(version.percentage)
        || version.percentage < 0.01
        || version.percentage > 100) {
        fail(DEPLOYMENT_FAILURE.DEPLOYMENTS_BODY_INVALID);
      }
      return Object.freeze({
        percentage: version.percentage,
        versionId: version.version_id
      });
    });
    return Object.freeze({
      id: deployment.id,
      strategy: deployment.strategy,
      versions: Object.freeze(versions)
    });
  });
  return Object.freeze(deployments);
}

export function requireSingleActiveVersion(deployments) {
  const active = deployments[0];
  if (!active || active.strategy !== "percentage"
    || active.versions.length !== 1
    || active.versions[0].percentage !== 100) {
    fail(DEPLOYMENT_FAILURE.TRAFFIC_SPLIT);
  }
  return Object.freeze({
    deploymentId: active.id,
    versionId: active.versions[0].versionId
  });
}

async function readBoundedResponseBody(response) {
  if (!response.body || typeof response.body.getReader !== "function") {
    fail(DEPLOYMENT_FAILURE.DEPLOYMENTS_BODY_INVALID);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) fail(DEPLOYMENT_FAILURE.DEPLOYMENTS_BODY_INVALID);
      total += value.byteLength;
      if (total > PRIVATE_WORKER_DEPLOYMENT_POLICY.responseByteLimit) {
        fail(DEPLOYMENT_FAILURE.DEPLOYMENTS_BODY_INVALID);
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
  } finally {
    for (const chunk of chunks) chunk.fill(0);
    reader.releaseLock();
  }
}

export async function fetchDeploymentSnapshot(worker, credentials, fetchImpl = globalThis.fetch) {
  if (![PRIVATE_WORKER_DEPLOYMENT_POLICY.privateWorker,
    PRIVATE_WORKER_DEPLOYMENT_POLICY.publicWorker].includes(worker)
    || !boundedString(credentials?.apiToken, 4096)
    || !ACCOUNT_ID.test(credentials?.accountId ?? "")
    || typeof fetchImpl !== "function") {
    fail(DEPLOYMENT_FAILURE.CREDENTIAL_CONTEXT_INVALID);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PRIVATE_WORKER_DEPLOYMENT_POLICY.requestTimeoutMs);
  const authorization = `Bearer ${credentials.apiToken}`;
  const headers = { Accept: "application/json", Authorization: authorization };
  let body;
  try {
    const url = new URL(
      `/client/v4/accounts/${credentials.accountId}/workers/scripts/${worker}/deployments`,
      PRIVATE_WORKER_DEPLOYMENT_POLICY.cloudflareApiOrigin
    );
    let response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        headers,
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal
      });
    } catch {
      fail(DEPLOYMENT_FAILURE.DEPLOYMENTS_NETWORK_UNCERTAIN);
    }
    if (response.redirected || (response.status >= 300 && response.status < 400)) {
      fail(DEPLOYMENT_FAILURE.DEPLOYMENTS_REDIRECT_DENIED);
    }
    if (response.status !== 200) fail(DEPLOYMENT_FAILURE.DEPLOYMENTS_HTTP_FAILED);
    try {
      body = await readBoundedResponseBody(response);
    } catch (error) {
      if (error instanceof DeploymentPolicyError) throw error;
      fail(DEPLOYMENT_FAILURE.DEPLOYMENTS_NETWORK_UNCERTAIN);
    }
    return requireSingleActiveVersion(parseDeploymentsEnvelope(body));
  } finally {
    clearTimeout(timeout);
    delete headers.Authorization;
    if (body) body.fill(0);
  }
}

function childEnvironment(credentials) {
  const environment = {
    CI: "true",
    NO_COLOR: "1",
    WRANGLER_SEND_METRICS: "false",
    [DEPLOYMENT_CREDENTIAL_ENV.apiToken]: credentials.apiToken,
    [DEPLOYMENT_CREDENTIAL_ENV.accountId]: credentials.accountId
  };
  for (const name of ["HOME", "PATH", "TMPDIR", "RUNNER_TEMP", "XDG_CONFIG_HOME"]) {
    if (boundedString(process.env[name], 4096)) environment[name] = process.env[name];
  }
  return environment;
}

export async function runBoundedWrangler({ root, mode, inputs, credentials, spawnImpl = spawn }) {
  const code = mode === "dry-run" ? DEPLOYMENT_FAILURE.DRY_RUN_FAILED : DEPLOYMENT_FAILURE.DEPLOY_FAILED;
  const timeoutMs = mode === "dry-run"
    ? PRIVATE_WORKER_DEPLOYMENT_POLICY.dryRunTimeoutMs
    : PRIVATE_WORKER_DEPLOYMENT_POLICY.deployTimeoutMs;
  const childEnv = childEnvironment(credentials);
  const buffers = [];
  let outputBytes = 0;
  let overflow = false;
  let timedOut = false;
  let child;
  try {
    try {
      child = spawnImpl(process.execPath, buildWranglerInvocation(mode, inputs), {
        cwd: root,
        env: childEnv,
        stdio: ["ignore", "pipe", "pipe"]
      });
    } catch {
      fail(code);
    }
    if (!child?.stdout || !child?.stderr || typeof child.kill !== "function") fail(code);
    const capture = chunk => {
      const copy = Buffer.from(chunk);
      outputBytes += copy.length;
      if (outputBytes > PRIVATE_WORKER_DEPLOYMENT_POLICY.commandOutputByteLimit) {
        overflow = true;
        copy.fill(0);
        child.kill("SIGKILL");
        return;
      }
      buffers.push(copy);
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    const status = await new Promise(resolveStatus => {
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 1_000).unref();
      }, timeoutMs);
      child.once("error", () => {
        clearTimeout(timer);
        resolveStatus({ failed: true });
      });
      child.once("close", (exitCode, signal) => {
        clearTimeout(timer);
        resolveStatus({ exitCode, signal });
      });
    });
    if (timedOut || overflow || status.failed || status.exitCode !== 0 || status.signal) fail(code);
  } finally {
    for (const buffer of buffers) buffer.fill(0);
    childEnv[DEPLOYMENT_CREDENTIAL_ENV.apiToken] = "";
    childEnv[DEPLOYMENT_CREDENTIAL_ENV.accountId] = "";
  }
}

export async function runDeploymentLifecycle({
  inputs,
  inspectIdentity,
  verifyConfiguration,
  fetchSnapshot,
  runWrangler
}) {
  verifyConfiguration();
  assertRepositoryIdentity(await inspectIdentity(), inputs);

  const initialPrivate = await fetchSnapshot(PRIVATE_WORKER_DEPLOYMENT_POLICY.privateWorker);
  if (initialPrivate.versionId !== inputs.currentProductionVersion) {
    fail(DEPLOYMENT_FAILURE.CURRENT_VERSION_MISMATCH);
  }
  const initialPublic = await fetchSnapshot(PRIVATE_WORKER_DEPLOYMENT_POLICY.publicWorker);

  await runWrangler("dry-run");
  const mutationBoundaryPrivate = await fetchSnapshot(PRIVATE_WORKER_DEPLOYMENT_POLICY.privateWorker);
  const mutationBoundaryPublic = await fetchSnapshot(PRIVATE_WORKER_DEPLOYMENT_POLICY.publicWorker);
  if (mutationBoundaryPrivate.deploymentId !== initialPrivate.deploymentId
    || mutationBoundaryPrivate.versionId !== initialPrivate.versionId
    || mutationBoundaryPublic.deploymentId !== initialPublic.deploymentId
    || mutationBoundaryPublic.versionId !== initialPublic.versionId) {
    fail(DEPLOYMENT_FAILURE.CONCURRENT_DEPLOYMENT_DETECTED);
  }

  assertRepositoryIdentity(await inspectIdentity(), inputs);
  await runWrangler("deploy");

  const finalPrivate = await fetchSnapshot(PRIVATE_WORKER_DEPLOYMENT_POLICY.privateWorker);
  const finalPublic = await fetchSnapshot(PRIVATE_WORKER_DEPLOYMENT_POLICY.publicWorker);
  if (finalPrivate.versionId === initialPrivate.versionId
    || finalPrivate.deploymentId === initialPrivate.deploymentId) {
    fail(DEPLOYMENT_FAILURE.POST_DEPLOY_VERSION_MISMATCH);
  }
  if (finalPublic.deploymentId !== initialPublic.deploymentId
    || finalPublic.versionId !== initialPublic.versionId) {
    fail(DEPLOYMENT_FAILURE.PUBLIC_VERSION_CHANGED);
  }
  return Object.freeze({ status: "PRIVATE_WORKER_DEPLOYMENT_VERIFIED" });
}
