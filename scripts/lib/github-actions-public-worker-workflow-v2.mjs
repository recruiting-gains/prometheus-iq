import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

import {
  PUBLIC_DEPLOYMENT_FAILURE,
  PUBLIC_WORKER_DEPLOYMENT_POLICY,
  PublicDeploymentPolicyError,
  assertPublicRepositoryIdentity,
  readPublicRepositoryIdentity,
  verifyPublicForwardRollbackContract,
  verifyPublicRepositoryIntegrity,
  verifyPublicStaticDeploymentPolicy,
  verifyPublicWranglerPin
} from "./github-actions-public-worker-deployment.mjs";
import { parseJsonc } from "./github-actions-private-worker-deployment.mjs";
import {
  buildPublicForwardRollbackArtifact,
  canonicalizeGeneratedSourceMap,
  canonicalizeGeneratedWorkerSource,
  hashPublicForwardRollbackArtifact
} from "./route-iq-public-forward-rollback.mjs";

export const PUBLIC_WORKFLOW_V2_POLICY = Object.freeze({
  contractVersion: "github-actions-public-worker-deployment-v2",
  contractPath: "workers/infrastructure/github-actions-public-worker-deployment-v2.json",
  qualificationWorkflowName: "Qualify Prometheus Public Worker",
  qualificationWorkflowPath: ".github/workflows/qualify-prometheus-public-worker.yml",
  qualificationWorkflowRef:
    "PrometheusRouteIQ/prometheus-iq/.github/workflows/qualify-prometheus-public-worker.yml@refs/heads/main",
  deploymentWorkflowName: "Deploy Prometheus Public Worker",
  deploymentWorkflowPath: ".github/workflows/deploy-prometheus-public-worker.yml",
  deploymentWorkflowRef:
    "PrometheusRouteIQ/prometheus-iq/.github/workflows/deploy-prometheus-public-worker.yml@refs/heads/main",
  repository: PUBLIC_WORKER_DEPLOYMENT_POLICY.repository,
  branch: PUBLIC_WORKER_DEPLOYMENT_POLICY.branch,
  ref: PUBLIC_WORKER_DEPLOYMENT_POLICY.ref,
  refType: PUBLIC_WORKER_DEPLOYMENT_POLICY.refType,
  eventName: "workflow_dispatch",
  founderActor: PUBLIC_WORKER_DEPLOYMENT_POLICY.founderActor,
  founderAuthorization: PUBLIC_WORKER_DEPLOYMENT_POLICY.founderAuthorization,
  firstRunAttempt: "1",
  publicWorker: PUBLIC_WORKER_DEPLOYMENT_POLICY.publicWorker,
  privateWorker: PUBLIC_WORKER_DEPLOYMENT_POLICY.privateWorker,
  publicConfig: PUBLIC_WORKER_DEPLOYMENT_POLICY.publicConfig,
  publicAssets: "deploy/prometheusrouteiq-website",
  runner: "ubuntu-24.04",
  architecture: "X64",
  nodeVersion: "24.4.1",
  wranglerVersion: PUBLIC_WORKER_DEPLOYMENT_POLICY.wranglerVersion,
  packageLockVersion: 3,
  dependencyCommand: "npm ci",
  sourceBuildCommand: "npm run build",
  completeRepositorySuiteCommand: "npm test",
  artifactBuilderCommand: "node scripts/run-github-actions-public-worker-qualification.mjs build",
  artifactVerifierCommand: "node scripts/run-github-actions-public-worker-qualification.mjs verify",
  deploymentCommand: "node scripts/run-github-actions-public-worker-deployment-v2.mjs deploy",
  artifactNamePrefix: "prometheus-public-qualified",
  artifactRetentionDays: 30,
  payloadDirectory: "payload",
  manifestFile: "manifest.json",
  qualifiedConfigFile: "wrangler-qualified.json",
  generatedWorkerFile: "prometheusrouteiq-website-entry.js",
  generatedSourceMapFile: "prometheusrouteiq-website-entry.js.map",
  browserRuntime: "none",
  smokeRuntime: "node-fetch-get-head-only",
  uploadArtifactAction: "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
  downloadArtifactAction: "actions/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0",
  successfulProductionBaseline: Object.freeze({
    batchId: "BATCH-20260720-009",
    commit: "07bf2eddc9707cb410ff6670efe9465ca68cd6b4",
    tree: "e1546b4500803bb03898c6ffb18377ffd08e599e",
    deploymentAssetsSha256: "5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15",
    previousPublicVersion: "a0296f92-4427-4cea-a3e2-9a5e05a4596c",
    deployedPublicVersionPrefix: "0396f868",
    privateVersion: "b8cba784-dfd3-4f8e-8356-816cccf6aecc"
  })
});

export const PUBLIC_WORKFLOW_V2_FAILURE = Object.freeze({
  INPUT_INVALID: "INPUT_INVALID",
  CONTEXT_INVALID: "CONTEXT_INVALID",
  TOOLCHAIN_MISMATCH: "TOOLCHAIN_MISMATCH",
  ARTIFACT_INVALID: "ARTIFACT_INVALID",
  ARTIFACT_TAMPERED: "ARTIFACT_TAMPERED",
  MANIFEST_MISMATCH: "MANIFEST_MISMATCH",
  QUALIFICATION_FAILED: "QUALIFICATION_FAILED",
  DEPLOYMENT_BOUNDARY_INVALID: "DEPLOYMENT_BOUNDARY_INVALID",
  DEPLOYMENT_ATTEMPT_LIMIT: "DEPLOYMENT_ATTEMPT_LIMIT",
  ROLLBACK_BOUNDARY_INVALID: "ROLLBACK_BOUNDARY_INVALID",
  SMOKE_INVALID: "SMOKE_INVALID",
  EVIDENCE_INVALID: "EVIDENCE_INVALID"
});

export const PUBLIC_WORKFLOW_V2_PHASE = Object.freeze({
  DEPLOYMENT_NOT_BEGUN: "DEPLOYMENT_NOT_BEGUN",
  LOCAL_PREFLIGHT_PASSED: "LOCAL_PREFLIGHT_PASSED",
  PRODUCTION_PREREQUISITES_PASSED: "PRODUCTION_PREREQUISITES_PASSED",
  AUTHORIZATION_CONSUMED: "AUTHORIZATION_CONSUMED",
  DEPLOYMENT_REQUEST_COMPLETED: "DEPLOYMENT_REQUEST_COMPLETED",
  POST_DEPLOYMENT_VERIFIED: "POST_DEPLOYMENT_VERIFIED",
  NONCRITICAL_SMOKE_REPORTED: "NONCRITICAL_SMOKE_REPORTED",
  CRITICAL_SMOKE_FAILED: "CRITICAL_SMOKE_FAILED",
  ROLLBACK_REQUEST_BEGUN: "ROLLBACK_REQUEST_BEGUN",
  ROLLBACK_VERIFIED: "ROLLBACK_VERIFIED"
});

const SHA40 = /^[0-9a-f]{40}$/u;
const SHA64 = /^[0-9a-f]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const BATCH_ID = /^BATCH-[0-9]{8}-[0-9]{3}$/u;
const POSITIVE_INTEGER = /^[1-9][0-9]{0,15}$/u;
const SAFE_NPM_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/u;
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_PAYLOAD_BYTES = 256 * 1024 * 1024;
const COMMAND_TIMEOUT_MS = 300_000;
const FORWARD_DIRECTORY = "forward";
const ROLLBACK_DIRECTORY = "rollback";
const ROLLBACK_IDENTITY_DIRECTORY = "identity";
const DEPLOYABLE_DIRECTORY = "deployable";
const QUALIFICATION_INPUT_NAMES = Object.freeze([
  "candidate_commit",
  "candidate_tree",
  "batch_id",
  "current_public_version",
  "current_private_version",
  "rollback_artifact_sha256"
]);
const DEPLOYMENT_INPUT_NAMES = Object.freeze([
  "approved_commit",
  "approved_tree",
  "batch_id",
  "current_public_version",
  "current_private_version",
  "qualification_run_id",
  "qualification_artifact_id",
  "qualified_artifact_sha256",
  "qualified_manifest_sha256",
  "deployment_asset_sha256",
  "rollback_contract_sha256",
  "rollback_artifact_sha256",
  "workflow_contract_sha256",
  "founder_authorization"
]);
const SECRET_ENVIRONMENT_NAMES = Object.freeze([
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "ROUTE_IQ_REQUEST_CRM_ACCESS_TEAM_DOMAIN",
  "ROUTE_IQ_REQUEST_CRM_ACCESS_AUDIENCE",
  "ROUTE_IQ_REQUEST_CRM_FOUNDER_SUBJECT_SHA256"
]);
const PHASES = new Set(Object.values(PUBLIC_WORKFLOW_V2_PHASE));

export class PublicWorkflowV2Error extends Error {
  constructor(code) {
    super(code);
    this.name = "PublicWorkflowV2Error";
    this.code = code;
  }
}

function fail(code) {
  throw new PublicWorkflowV2Error(code);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, expected) {
  return isPlainObject(value)
    && Object.keys(value).sort().join("\0") === [...expected].sort().join("\0");
}

export function canonicalPublicWorkflowJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalPublicWorkflowJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map(key => `${JSON.stringify(key)}:${canonicalPublicWorkflowJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function safeRelativeName(root, path) {
  const name = relative(root, path).split("\\").join("/");
  if (!name || name === ".." || name.startsWith("../") || isAbsolute(name) || name.includes("\0")) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
  return name;
}

function regularFiles(root, current = root, output = []) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    const stats = lstatSync(path);
    if (stats.isSymbolicLink()) fail(PUBLIC_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
    if (entry.isDirectory()) regularFiles(root, path, output);
    else if (entry.isFile()) {
      if (stats.size > MAX_FILE_BYTES) fail(PUBLIC_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
      output.push(path);
    } else fail(PUBLIC_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
  const sorted = output.sort((left, right) => safeRelativeName(root, left).localeCompare(safeRelativeName(root, right)));
  if (current === root
    && sorted.reduce((total, path) => total + lstatSync(path).size, 0) > MAX_PAYLOAD_BYTES) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
  return sorted;
}

export function sha256PublicWorkflowFile(path) {
  const stats = lstatSync(path);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size > MAX_FILE_BYTES) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function fileManifest(directory) {
  return Object.freeze(regularFiles(directory).map(path => {
    const stats = lstatSync(path);
    return Object.freeze({
      path: safeRelativeName(directory, path),
      bytes: stats.size,
      sha256: sha256PublicWorkflowFile(path)
    });
  }));
}

export function hashQualifiedPublicPayload(directory) {
  const digest = createHash("sha256");
  for (const entry of fileManifest(directory)) {
    digest.update(entry.path, "utf8");
    digest.update("\0", "utf8");
    digest.update(String(entry.bytes), "utf8");
    digest.update("\0", "utf8");
    digest.update(entry.sha256, "utf8");
    digest.update("\0", "utf8");
  }
  return digest.digest("hex");
}

function readJson(path) {
  try {
    const stats = lstatSync(path);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size < 2 || stats.size > MAX_FILE_BYTES) {
      fail(PUBLIC_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
    }
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error instanceof PublicWorkflowV2Error) throw error;
    fail(PUBLIC_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
}

function parseDispatch(value) {
  try {
    return JSON.parse(value || "");
  } catch {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
}

function validateContext(environment, { workflowName, workflowRef, approvedCommit }) {
  if (environment.GITHUB_REPOSITORY !== PUBLIC_WORKFLOW_V2_POLICY.repository
    || environment.GITHUB_REF !== PUBLIC_WORKFLOW_V2_POLICY.ref
    || environment.GITHUB_REF_NAME !== PUBLIC_WORKFLOW_V2_POLICY.branch
    || environment.GITHUB_REF_TYPE !== PUBLIC_WORKFLOW_V2_POLICY.refType
    || environment.GITHUB_EVENT_NAME !== PUBLIC_WORKFLOW_V2_POLICY.eventName
    || environment.GITHUB_SHA !== approvedCommit
    || environment.GITHUB_ACTOR !== PUBLIC_WORKFLOW_V2_POLICY.founderActor
    || environment.GITHUB_TRIGGERING_ACTOR !== PUBLIC_WORKFLOW_V2_POLICY.founderActor
    || environment.GITHUB_WORKFLOW !== workflowName
    || environment.GITHUB_WORKFLOW_REF !== workflowRef
    || environment.GITHUB_RUN_ATTEMPT !== PUBLIC_WORKFLOW_V2_POLICY.firstRunAttempt) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.CONTEXT_INVALID);
  }
}

export function validatePublicQualificationInputs(environment) {
  const values = Object.freeze({
    candidateCommit: environment.PROMETHEUS_CANDIDATE_COMMIT,
    candidateTree: environment.PROMETHEUS_CANDIDATE_TREE,
    batchId: environment.PROMETHEUS_BATCH_ID,
    currentPublicVersion: environment.PROMETHEUS_CURRENT_PUBLIC_VERSION,
    currentPrivateVersion: environment.PROMETHEUS_CURRENT_PRIVATE_VERSION,
    rollbackArtifactSha256: environment.PROMETHEUS_ROLLBACK_ARTIFACT_SHA256
  });
  if (!SHA40.test(values.candidateCommit || "")
    || !SHA40.test(values.candidateTree || "")
    || !BATCH_ID.test(values.batchId || "")
    || !UUID.test(values.currentPublicVersion || "")
    || !UUID.test(values.currentPrivateVersion || "")
    || !SHA64.test(values.rollbackArtifactSha256 || "")) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
  const dispatch = parseDispatch(environment.PROMETHEUS_DISPATCH_INPUTS_JSON);
  if (!exactKeys(dispatch, QUALIFICATION_INPUT_NAMES)
    || dispatch.candidate_commit !== values.candidateCommit
    || dispatch.candidate_tree !== values.candidateTree
    || dispatch.batch_id !== values.batchId
    || dispatch.current_public_version !== values.currentPublicVersion
    || dispatch.current_private_version !== values.currentPrivateVersion
    || dispatch.rollback_artifact_sha256 !== values.rollbackArtifactSha256) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
  validateContext(environment, {
    workflowName: PUBLIC_WORKFLOW_V2_POLICY.qualificationWorkflowName,
    workflowRef: PUBLIC_WORKFLOW_V2_POLICY.qualificationWorkflowRef,
    approvedCommit: values.candidateCommit
  });
  return values;
}

export function validatePublicDeploymentV2Inputs(environment) {
  const values = Object.freeze({
    approvedCommit: environment.PROMETHEUS_APPROVED_COMMIT,
    approvedTree: environment.PROMETHEUS_APPROVED_TREE,
    batchId: environment.PROMETHEUS_BATCH_ID,
    currentPublicVersion: environment.PROMETHEUS_CURRENT_PUBLIC_VERSION,
    currentPrivateVersion: environment.PROMETHEUS_CURRENT_PRIVATE_VERSION,
    qualificationRunId: environment.PROMETHEUS_QUALIFICATION_RUN_ID,
    qualificationArtifactId: environment.PROMETHEUS_QUALIFICATION_ARTIFACT_ID,
    qualifiedArtifactSha256: environment.PROMETHEUS_QUALIFIED_ARTIFACT_SHA256,
    qualifiedManifestSha256: environment.PROMETHEUS_QUALIFIED_MANIFEST_SHA256,
    deploymentAssetSha256: environment.PROMETHEUS_DEPLOYMENT_ASSET_SHA256,
    rollbackContractSha256: environment.PROMETHEUS_ROLLBACK_CONTRACT_SHA256,
    rollbackArtifactSha256: environment.PROMETHEUS_ROLLBACK_ARTIFACT_SHA256,
    workflowContractSha256: environment.PROMETHEUS_WORKFLOW_CONTRACT_SHA256,
    founderAuthorization: environment.PROMETHEUS_FOUNDER_AUTHORIZATION
  });
  if (!SHA40.test(values.approvedCommit || "")
    || !SHA40.test(values.approvedTree || "")
    || !BATCH_ID.test(values.batchId || "")
    || !UUID.test(values.currentPublicVersion || "")
    || !UUID.test(values.currentPrivateVersion || "")
    || !POSITIVE_INTEGER.test(values.qualificationRunId || "")
    || !POSITIVE_INTEGER.test(values.qualificationArtifactId || "")
    || ![
      values.qualifiedArtifactSha256,
      values.qualifiedManifestSha256,
      values.deploymentAssetSha256,
      values.rollbackContractSha256,
      values.rollbackArtifactSha256,
      values.workflowContractSha256
    ].every(value => SHA64.test(value || ""))
    || values.founderAuthorization !== PUBLIC_WORKFLOW_V2_POLICY.founderAuthorization) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
  const dispatch = parseDispatch(environment.PROMETHEUS_DISPATCH_INPUTS_JSON);
  if (!exactKeys(dispatch, DEPLOYMENT_INPUT_NAMES)
    || dispatch.approved_commit !== values.approvedCommit
    || dispatch.approved_tree !== values.approvedTree
    || dispatch.batch_id !== values.batchId
    || dispatch.current_public_version !== values.currentPublicVersion
    || dispatch.current_private_version !== values.currentPrivateVersion
    || dispatch.qualification_run_id !== values.qualificationRunId
    || dispatch.qualification_artifact_id !== values.qualificationArtifactId
    || dispatch.qualified_artifact_sha256 !== values.qualifiedArtifactSha256
    || dispatch.qualified_manifest_sha256 !== values.qualifiedManifestSha256
    || dispatch.deployment_asset_sha256 !== values.deploymentAssetSha256
    || dispatch.rollback_contract_sha256 !== values.rollbackContractSha256
    || dispatch.rollback_artifact_sha256 !== values.rollbackArtifactSha256
    || dispatch.workflow_contract_sha256 !== values.workflowContractSha256
    || dispatch.founder_authorization !== values.founderAuthorization) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
  validateContext(environment, {
    workflowName: PUBLIC_WORKFLOW_V2_POLICY.deploymentWorkflowName,
    workflowRef: PUBLIC_WORKFLOW_V2_POLICY.deploymentWorkflowRef,
    approvedCommit: values.approvedCommit
  });
  return values;
}

function qualificationRepositoryInputs(inputs) {
  return Object.freeze({
    approvedCommit: inputs.candidateCommit,
    approvedTree: inputs.candidateTree
  });
}

export function assertPublicQualificationRepository(root, inputs) {
  assertPublicRepositoryIdentity(readPublicRepositoryIdentity(root), qualificationRepositoryInputs(inputs));
  verifyPublicRepositoryIntegrity(root);
}

function runVersion(root, command, argumentsList) {
  const result = spawnSync(command, argumentsList, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024,
    timeout: 30_000,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      CI: "true",
      NO_COLOR: "1"
    }
  });
  if (result.status !== 0 || result.error || result.signal) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.TOOLCHAIN_MISMATCH);
  }
  return String(result.stdout || "").trim();
}

export function currentPublicWorkflowRuntimeIdentity(root, environment = process.env) {
  const nodeVersion = process.version.replace(/^v/u, "");
  const npmVersion = runVersion(root, "npm", ["--version"]);
  const wranglerVersion = readJson(resolve(root, "node_modules/wrangler/package.json")).version;
  const runner = environment.PROMETHEUS_RUNNER_IMAGE || environment.ImageOS || "";
  const architecture = environment.RUNNER_ARCH || "";
  if (nodeVersion !== PUBLIC_WORKFLOW_V2_POLICY.nodeVersion
    || !SAFE_NPM_VERSION.test(npmVersion)
    || wranglerVersion !== PUBLIC_WORKFLOW_V2_POLICY.wranglerVersion
    || runner !== PUBLIC_WORKFLOW_V2_POLICY.runner
    || architecture !== PUBLIC_WORKFLOW_V2_POLICY.architecture) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.TOOLCHAIN_MISMATCH);
  }
  return Object.freeze({
    runner,
    architecture,
    nodeVersion,
    npmVersion,
    wranglerVersion,
    browserRuntime: PUBLIC_WORKFLOW_V2_POLICY.browserRuntime,
    smokeRuntime: PUBLIC_WORKFLOW_V2_POLICY.smokeRuntime
  });
}

function defaultBundlePublicWorker(root, outputDirectory) {
  const environment = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    CI: "true",
    NO_COLOR: "1",
    WRANGLER_SEND_METRICS: "false",
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false"
  };
  const result = spawnSync(process.execPath, [
    PUBLIC_WORKER_DEPLOYMENT_POLICY.wranglerModule,
    "deploy",
    "--dry-run",
    "--config",
    PUBLIC_WORKFLOW_V2_POLICY.publicConfig,
    "--keep-vars",
    "--strict",
    "--outdir",
    outputDirectory
  ], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 32 * 1024 * 1024,
    timeout: COMMAND_TIMEOUT_MS,
    env: environment
  });
  if (result.status !== 0 || result.error || result.signal) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.QUALIFICATION_FAILED);
  }
}

function qualifiedConfig(source) {
  let config;
  try {
    config = parseJsonc(source);
  } catch {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
  if (!isPlainObject(config)
    || config.name !== PUBLIC_WORKFLOW_V2_POLICY.publicWorker
    || config.workers_dev !== false
    || config.preview_urls !== false
    || !isPlainObject(config.assets)) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
  delete config.$schema;
  config.main = `./worker/${PUBLIC_WORKFLOW_V2_POLICY.generatedWorkerFile}`;
  config.assets = { ...config.assets, directory: "./assets" };
  return `${canonicalPublicWorkflowJson(config)}\n`;
}

function writeExclusive(path, value) {
  writeFileSync(path, value, { encoding: "utf8", mode: 0o600, flag: "wx" });
}

function canonicalizeGeneratedOutput({ generatedDirectory, destinationDirectory, workspace, repositoryRoot }) {
  const generatedWorkerPath = join(generatedDirectory, PUBLIC_WORKFLOW_V2_POLICY.generatedWorkerFile);
  const generatedSourceMapPath = join(generatedDirectory, PUBLIC_WORKFLOW_V2_POLICY.generatedSourceMapFile);
  const actual = readdirSync(generatedDirectory).sort();
  if (!actual.includes(PUBLIC_WORKFLOW_V2_POLICY.generatedWorkerFile)
    || !actual.includes(PUBLIC_WORKFLOW_V2_POLICY.generatedSourceMapFile)
    || actual.some(name => ![
      PUBLIC_WORKFLOW_V2_POLICY.generatedWorkerFile,
      PUBLIC_WORKFLOW_V2_POLICY.generatedSourceMapFile,
      "README.md"
    ].includes(name))) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
  mkdirSync(destinationDirectory, { mode: 0o700 });
  const worker = canonicalizeGeneratedWorkerSource(readFileSync(generatedWorkerPath, "utf8"), {
    workspace,
    repositoryRoot
  });
  const sourceMap = canonicalizeGeneratedSourceMap(readJson(generatedSourceMapPath), {
    sourceMapDirectory: generatedDirectory,
    workspace,
    repositoryRoot
  });
  writeExclusive(join(destinationDirectory, PUBLIC_WORKFLOW_V2_POLICY.generatedWorkerFile), worker);
  writeExclusive(
    join(destinationDirectory, PUBLIC_WORKFLOW_V2_POLICY.generatedSourceMapFile),
    `${canonicalPublicWorkflowJson(sourceMap)}\n`
  );
}

function createDeployablePayload({ sourceConfigPath, assetsPath, generatedDirectory, destination }) {
  mkdirSync(destination, { mode: 0o700 });
  writeExclusive(
    join(destination, PUBLIC_WORKFLOW_V2_POLICY.qualifiedConfigFile),
    qualifiedConfig(readFileSync(sourceConfigPath, "utf8"))
  );
  cpSync(assetsPath, join(destination, "assets"), {
    recursive: true,
    errorOnExist: true,
    force: false,
    dereference: false
  });
  cpSync(generatedDirectory, join(destination, "worker"), {
    recursive: true,
    errorOnExist: true,
    force: false,
    dereference: false
  });
}

function exactReleaseRoot(root) {
  const actual = readdirSync(root).sort();
  if (JSON.stringify(actual) !== JSON.stringify([
    PUBLIC_WORKFLOW_V2_POLICY.manifestFile,
    PUBLIC_WORKFLOW_V2_POLICY.payloadDirectory
  ].sort())) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
}

function buildManifest(root, inputs, runtime, payload, rollbackResult) {
  const sourceConfigPath = resolve(root, PUBLIC_WORKFLOW_V2_POLICY.publicConfig);
  const deploymentAssetsPath = resolve(root, PUBLIC_WORKFLOW_V2_POLICY.publicAssets);
  const rollbackContractPath = resolve(root, PUBLIC_WORKER_DEPLOYMENT_POLICY.rollbackContractPath);
  const workflowContractPath = resolve(root, PUBLIC_WORKFLOW_V2_POLICY.contractPath);
  const packageLockPath = resolve(root, "package-lock.json");
  const packagePath = resolve(root, "package.json");
  const lock = readJson(packageLockPath);
  const deploymentAssetsSha256 = hashPublicForwardRollbackArtifact(deploymentAssetsPath);
  const artifactSha256 = hashQualifiedPublicPayload(payload);
  const manifest = Object.freeze({
    schemaVersion: PUBLIC_WORKFLOW_V2_POLICY.contractVersion,
    target: Object.freeze({
      repository: PUBLIC_WORKFLOW_V2_POLICY.repository,
      branch: PUBLIC_WORKFLOW_V2_POLICY.branch,
      worker: PUBLIC_WORKFLOW_V2_POLICY.publicWorker,
      privateWorker: PUBLIC_WORKFLOW_V2_POLICY.privateWorker,
      privateWorkerMutationAllowed: false
    }),
    candidate: Object.freeze({
      commit: inputs.candidateCommit,
      tree: inputs.candidateTree,
      batchId: inputs.batchId
    }),
    productionPrerequisites: Object.freeze({
      publicVersion: inputs.currentPublicVersion,
      privateVersion: inputs.currentPrivateVersion,
      publicTraffic: 100,
      privateTraffic: 100
    }),
    identities: Object.freeze({
      artifactSha256,
      deploymentAssetsSha256,
      sourceConfigSha256: sha256PublicWorkflowFile(sourceConfigPath),
      rollbackContractSha256: sha256PublicWorkflowFile(rollbackContractPath),
      rollbackArtifactSha256: rollbackResult.artifactSha256,
      workflowContractSha256: sha256PublicWorkflowFile(workflowContractPath),
      qualificationWorkflowSha256: sha256PublicWorkflowFile(
        resolve(root, PUBLIC_WORKFLOW_V2_POLICY.qualificationWorkflowPath)
      ),
      deploymentWorkflowSha256: sha256PublicWorkflowFile(
        resolve(root, PUBLIC_WORKFLOW_V2_POLICY.deploymentWorkflowPath)
      ),
      packageLockSha256: sha256PublicWorkflowFile(packageLockPath),
      packageSha256: sha256PublicWorkflowFile(packagePath),
      payloadFiles: fileManifest(payload)
    }),
    rollback: Object.freeze({
      strategy: "verified_new_forward_deployment",
      nativeRollbackAllowed: false,
      identityVersion: rollbackResult.identityVersion,
      candidateWebsiteCommit: rollbackResult.candidateWebsiteCommit,
      candidateWebsiteTree: rollbackResult.candidateWebsiteTree,
      sourceWebsiteCommit: rollbackResult.sourceWebsiteCommit,
      sourceWebsiteTree: rollbackResult.sourceWebsiteTree,
      durableObjectBinding: rollbackResult.durableObjectBinding,
      durableObjectClass: rollbackResult.durableObjectClass,
      migrationTag: rollbackResult.migrationTag
    }),
    toolchain: Object.freeze({
      ...runtime,
      packageLockVersion: lock.lockfileVersion,
      dependencyCommand: PUBLIC_WORKFLOW_V2_POLICY.dependencyCommand,
      sourceBuildCommand: PUBLIC_WORKFLOW_V2_POLICY.sourceBuildCommand,
      completeRepositorySuiteCommand: PUBLIC_WORKFLOW_V2_POLICY.completeRepositorySuiteCommand,
      publicArtifactBuilds: 1,
      deployRebuildAllowed: false,
      wranglerDeployMode: "no-bundle"
    }),
    workflow: Object.freeze({
      qualification: PUBLIC_WORKFLOW_V2_POLICY.qualificationWorkflowPath,
      deployment: PUBLIC_WORKFLOW_V2_POLICY.deploymentWorkflowPath,
      artifactStorage: "github-actions-artifact-v4",
      artifactRetentionDays: PUBLIC_WORKFLOW_V2_POLICY.artifactRetentionDays,
      authorizationConsumedAt: "forward_wrangler_process_spawn_confirmed",
      preAuthorizationCloudflareReadOnlyRequestsAllowed: true,
      preAuthorizationCloudflareMutationRequestsAllowed: false,
      automaticRetriesAllowed: false,
      forwardDeploymentAttempts: 1,
      rollbackAttemptsOnCriticalSmoke: 1
    }),
    safety: Object.freeze({
      crmPostAllowed: false,
      notificationAllowed: false,
      privateWorkerMutationAllowed: false,
      collection: "OFF",
      activeCohortCount: 0,
      recommendationInfluence: "OFF",
      anthonyMapped: false,
      secretValuesInArtifactAllowed: false
    })
  });
  if (rollbackResult.artifactSha256 !== inputs.rollbackArtifactSha256
    || lock.lockfileVersion !== PUBLIC_WORKFLOW_V2_POLICY.packageLockVersion) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.MANIFEST_MISMATCH);
  }
  return manifest;
}

export function buildQualifiedPublicRelease(root, {
  outputDirectory,
  inputs,
  runtimeIdentity,
  temporaryRoot = tmpdir(),
  bundlePublicWorker = defaultBundlePublicWorker,
  verifyRepositoryBoundary = true,
  rollbackBuilder = buildPublicForwardRollbackArtifact
}) {
  if (typeof outputDirectory !== "string" || outputDirectory.length < 1 || !inputs || !runtimeIdentity) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
  if (verifyRepositoryBoundary) {
    assertPublicQualificationRepository(root, inputs);
    verifyPublicStaticDeploymentPolicy(root);
    verifyPublicWranglerPin(root);
    verifyPublicForwardRollbackContract(root);
  }
  if (runtimeIdentity.runner !== PUBLIC_WORKFLOW_V2_POLICY.runner
    || runtimeIdentity.architecture !== PUBLIC_WORKFLOW_V2_POLICY.architecture
    || runtimeIdentity.nodeVersion !== PUBLIC_WORKFLOW_V2_POLICY.nodeVersion
    || runtimeIdentity.wranglerVersion !== PUBLIC_WORKFLOW_V2_POLICY.wranglerVersion
    || runtimeIdentity.browserRuntime !== PUBLIC_WORKFLOW_V2_POLICY.browserRuntime
    || runtimeIdentity.smokeRuntime !== PUBLIC_WORKFLOW_V2_POLICY.smokeRuntime
    || !SAFE_NPM_VERSION.test(runtimeIdentity.npmVersion || "")) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.TOOLCHAIN_MISMATCH);
  }

  const workspace = mkdtempSync(join(temporaryRoot, "prometheus-public-qualification-v2-"));
  const generated = join(workspace, "generated-forward");
  const canonicalGenerated = join(workspace, "canonical-forward");
  const rollbackIdentity = join(workspace, "rollback-identity");
  let outputCreated = false;
  try {
    mkdirSync(outputDirectory, { mode: 0o700 });
    outputCreated = true;
    const payload = join(outputDirectory, PUBLIC_WORKFLOW_V2_POLICY.payloadDirectory);
    mkdirSync(payload, { mode: 0o700 });
    mkdirSync(generated, { mode: 0o700 });
    bundlePublicWorker(root, generated);
    canonicalizeGeneratedOutput({
      generatedDirectory: generated,
      destinationDirectory: canonicalGenerated,
      workspace: root,
      repositoryRoot: root
    });
    createDeployablePayload({
      sourceConfigPath: resolve(root, PUBLIC_WORKFLOW_V2_POLICY.publicConfig),
      assetsPath: resolve(root, PUBLIC_WORKFLOW_V2_POLICY.publicAssets),
      generatedDirectory: canonicalGenerated,
      destination: join(payload, FORWARD_DIRECTORY)
    });

    const rollbackResult = rollbackBuilder(root, {
      temporaryRoot,
      outputDirectory: rollbackIdentity
    });
    const rollbackRoot = join(payload, ROLLBACK_DIRECTORY);
    mkdirSync(rollbackRoot, { mode: 0o700 });
    cpSync(rollbackIdentity, join(rollbackRoot, ROLLBACK_IDENTITY_DIRECTORY), {
      recursive: true,
      errorOnExist: true,
      force: false,
      dereference: false
    });
    createDeployablePayload({
      sourceConfigPath: join(rollbackIdentity, "configuration", PUBLIC_WORKFLOW_V2_POLICY.publicConfig),
      assetsPath: join(rollbackIdentity, "public-assets"),
      generatedDirectory: join(rollbackIdentity, "generated"),
      destination: join(rollbackRoot, DEPLOYABLE_DIRECTORY)
    });

    const manifest = buildManifest(root, inputs, runtimeIdentity, payload, rollbackResult);
    const manifestPath = join(outputDirectory, PUBLIC_WORKFLOW_V2_POLICY.manifestFile);
    writeExclusive(manifestPath, `${canonicalPublicWorkflowJson(manifest)}\n`);
    exactReleaseRoot(outputDirectory);
    for (const path of regularFiles(outputDirectory)) chmodSync(path, 0o400);
    const manifestSha256 = sha256PublicWorkflowFile(manifestPath);
    return Object.freeze({
      status: "PUBLIC_WORKER_QUALIFICATION_ARTIFACT_CREATED",
      artifactSha256: manifest.identities.artifactSha256,
      manifestSha256,
      deploymentAssetsSha256: manifest.identities.deploymentAssetsSha256,
      rollbackContractSha256: manifest.identities.rollbackContractSha256,
      rollbackArtifactSha256: manifest.identities.rollbackArtifactSha256,
      workflowContractSha256: manifest.identities.workflowContractSha256
    });
  } catch (error) {
    if (outputCreated) rmSync(outputDirectory, { recursive: true, force: true });
    if (error instanceof PublicWorkflowV2Error || error instanceof PublicDeploymentPolicyError) throw error;
    fail(PUBLIC_WORKFLOW_V2_FAILURE.QUALIFICATION_FAILED);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

function validateQualifiedConfig(path) {
  let config;
  try {
    config = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
  const bindings = config.durable_objects?.bindings;
  const migrations = config.migrations;
  if (config.name !== PUBLIC_WORKFLOW_V2_POLICY.publicWorker
    || config.main !== `./worker/${PUBLIC_WORKFLOW_V2_POLICY.generatedWorkerFile}`
    || config.workers_dev !== false
    || config.preview_urls !== false
    || config.assets?.directory !== "./assets"
    || !Array.isArray(bindings)
    || bindings.length !== 1
    || bindings[0]?.name !== PUBLIC_WORKER_DEPLOYMENT_POLICY.crmBinding
    || bindings[0]?.class_name !== PUBLIC_WORKER_DEPLOYMENT_POLICY.crmClass
    || !Array.isArray(migrations)
    || migrations.length !== 1
    || migrations[0]?.tag !== PUBLIC_WORKER_DEPLOYMENT_POLICY.crmMigration
    || JSON.stringify(migrations[0]?.new_sqlite_classes)
      !== JSON.stringify([PUBLIC_WORKER_DEPLOYMENT_POLICY.crmClass])
    || Object.hasOwn(migrations[0], "deleted_classes")) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
}

export function verifyQualifiedPublicRelease(root, releaseDirectory, expected, runtimeIdentity, {
  verifyRepositoryBoundary = true
} = {}) {
  if (!expected || typeof releaseDirectory !== "string" || !runtimeIdentity) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
  exactReleaseRoot(releaseDirectory);
  const manifestPath = join(releaseDirectory, PUBLIC_WORKFLOW_V2_POLICY.manifestFile);
  const payload = join(releaseDirectory, PUBLIC_WORKFLOW_V2_POLICY.payloadDirectory);
  const manifest = readJson(manifestPath);
  if (readFileSync(manifestPath, "utf8") !== `${canonicalPublicWorkflowJson(manifest)}\n`) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
  const manifestSha256 = sha256PublicWorkflowFile(manifestPath);
  const artifactSha256 = hashQualifiedPublicPayload(payload);
  if (manifest.schemaVersion !== PUBLIC_WORKFLOW_V2_POLICY.contractVersion
    || manifest.target?.repository !== PUBLIC_WORKFLOW_V2_POLICY.repository
    || manifest.target?.branch !== PUBLIC_WORKFLOW_V2_POLICY.branch
    || manifest.target?.worker !== PUBLIC_WORKFLOW_V2_POLICY.publicWorker
    || manifest.target?.privateWorker !== PUBLIC_WORKFLOW_V2_POLICY.privateWorker
    || manifest.target?.privateWorkerMutationAllowed !== false
    || manifest.candidate?.commit !== expected.approvedCommit
    || manifest.candidate?.tree !== expected.approvedTree
    || manifest.candidate?.batchId !== expected.batchId
    || manifest.productionPrerequisites?.publicVersion !== expected.currentPublicVersion
    || manifest.productionPrerequisites?.privateVersion !== expected.currentPrivateVersion
    || manifest.identities?.artifactSha256 !== expected.qualifiedArtifactSha256
    || artifactSha256 !== expected.qualifiedArtifactSha256
    || manifestSha256 !== expected.qualifiedManifestSha256
    || manifest.identities?.deploymentAssetsSha256 !== expected.deploymentAssetSha256
    || manifest.identities?.rollbackContractSha256 !== expected.rollbackContractSha256
    || manifest.identities?.rollbackArtifactSha256 !== expected.rollbackArtifactSha256
    || manifest.identities?.workflowContractSha256 !== expected.workflowContractSha256
    || manifest.identities?.qualificationWorkflowSha256 !== sha256PublicWorkflowFile(
      resolve(root, PUBLIC_WORKFLOW_V2_POLICY.qualificationWorkflowPath)
    )
    || manifest.identities?.deploymentWorkflowSha256 !== sha256PublicWorkflowFile(
      resolve(root, PUBLIC_WORKFLOW_V2_POLICY.deploymentWorkflowPath)
    )
    || manifest.identities?.packageLockSha256 !== sha256PublicWorkflowFile(resolve(root, "package-lock.json"))
    || manifest.identities?.packageSha256 !== sha256PublicWorkflowFile(resolve(root, "package.json"))
    || manifest.identities?.sourceConfigSha256 !== sha256PublicWorkflowFile(
      resolve(root, PUBLIC_WORKFLOW_V2_POLICY.publicConfig)
    )
    || canonicalPublicWorkflowJson(manifest.identities?.payloadFiles)
      !== canonicalPublicWorkflowJson(fileManifest(payload))
    || JSON.stringify(manifest.toolchain && {
      runner: manifest.toolchain.runner,
      architecture: manifest.toolchain.architecture,
      nodeVersion: manifest.toolchain.nodeVersion,
      npmVersion: manifest.toolchain.npmVersion,
      wranglerVersion: manifest.toolchain.wranglerVersion,
      browserRuntime: manifest.toolchain.browserRuntime,
      smokeRuntime: manifest.toolchain.smokeRuntime
    }) !== JSON.stringify(runtimeIdentity)
    || manifest.toolchain?.packageLockVersion !== PUBLIC_WORKFLOW_V2_POLICY.packageLockVersion
    || manifest.toolchain?.sourceBuildCommand !== PUBLIC_WORKFLOW_V2_POLICY.sourceBuildCommand
    || manifest.toolchain?.completeRepositorySuiteCommand
      !== PUBLIC_WORKFLOW_V2_POLICY.completeRepositorySuiteCommand
    || manifest.toolchain?.publicArtifactBuilds !== 1
    || manifest.toolchain?.deployRebuildAllowed !== false
    || manifest.toolchain?.wranglerDeployMode !== "no-bundle"
    || manifest.workflow?.authorizationConsumedAt !== "forward_wrangler_process_spawn_confirmed"
    || manifest.workflow?.preAuthorizationCloudflareReadOnlyRequestsAllowed !== true
    || manifest.workflow?.preAuthorizationCloudflareMutationRequestsAllowed !== false
    || manifest.workflow?.automaticRetriesAllowed !== false
    || manifest.workflow?.forwardDeploymentAttempts !== 1
    || manifest.workflow?.rollbackAttemptsOnCriticalSmoke !== 1
    || manifest.safety?.crmPostAllowed !== false
    || manifest.safety?.notificationAllowed !== false
    || manifest.safety?.privateWorkerMutationAllowed !== false
    || manifest.safety?.collection !== "OFF"
    || manifest.safety?.activeCohortCount !== 0
    || manifest.safety?.recommendationInfluence !== "OFF"
    || manifest.safety?.anthonyMapped !== false) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.MANIFEST_MISMATCH);
  }
  if (verifyRepositoryBoundary) {
    assertPublicRepositoryIdentity(readPublicRepositoryIdentity(root), expected);
    verifyPublicRepositoryIntegrity(root);
    verifyPublicStaticDeploymentPolicy(root);
    verifyPublicWranglerPin(root);
  }
  validateQualifiedConfig(join(payload, FORWARD_DIRECTORY, PUBLIC_WORKFLOW_V2_POLICY.qualifiedConfigFile));
  validateQualifiedConfig(join(
    payload,
    ROLLBACK_DIRECTORY,
    DEPLOYABLE_DIRECTORY,
    PUBLIC_WORKFLOW_V2_POLICY.qualifiedConfigFile
  ));
  if (hashPublicForwardRollbackArtifact(join(
    payload,
    ROLLBACK_DIRECTORY,
    ROLLBACK_IDENTITY_DIRECTORY
  )) !== expected.rollbackArtifactSha256) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.ARTIFACT_TAMPERED);
  }
  if (hashPublicForwardRollbackArtifact(join(payload, FORWARD_DIRECTORY, "assets"))
    !== expected.deploymentAssetSha256) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.ARTIFACT_TAMPERED);
  }
  return Object.freeze({
    status: "PUBLIC_WORKER_QUALIFIED_ARTIFACT_VERIFIED",
    manifest,
    artifactSha256,
    manifestSha256,
    forwardDirectory: join(payload, FORWARD_DIRECTORY),
    rollbackDirectory: join(payload, ROLLBACK_DIRECTORY, DEPLOYABLE_DIRECTORY)
  });
}

export function buildQualifiedPublicWranglerInvocation(mode, inputs, secretFile, verifiedRelease) {
  if (!inputs || !verifiedRelease || !["dry-run", "deploy", "rollback"].includes(mode)
    || typeof secretFile !== "string" || secretFile.length < 1) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
  const releaseRoot = mode === "rollback"
    ? verifiedRelease.rollbackDirectory
    : verifiedRelease.forwardDirectory;
  const config = resolve(releaseRoot, PUBLIC_WORKFLOW_V2_POLICY.qualifiedConfigFile);
  const argumentsList = [
    PUBLIC_WORKER_DEPLOYMENT_POLICY.wranglerModule,
    "deploy",
    "--no-bundle",
    "--config",
    config,
    "--keep-vars",
    "--strict",
    "--secrets-file",
    secretFile,
    "--message",
    mode === "rollback"
      ? `${inputs.batchId} verified-forward-rollback ${inputs.approvedCommit}`
      : `${inputs.batchId} qualified ${inputs.approvedCommit}`,
    "--tag",
    mode === "rollback"
      ? `prometheus-${inputs.batchId.toLowerCase()}-rollback-${inputs.approvedCommit.slice(0, 8)}`
      : `prometheus-${inputs.batchId.toLowerCase()}-${inputs.approvedCommit.slice(0, 12)}`
  ];
  if (mode === "dry-run") argumentsList.splice(2, 0, "--dry-run");
  if (!argumentsList.includes("--no-bundle")
    || argumentsList.includes("--name")
    || argumentsList.includes(PUBLIC_WORKFLOW_V2_POLICY.privateWorker)
    || basename(config) !== PUBLIC_WORKFLOW_V2_POLICY.qualifiedConfigFile) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.DEPLOYMENT_BOUNDARY_INVALID);
  }
  return Object.freeze(argumentsList);
}

function sameState(left, right) {
  return left.deployment.deploymentId === right.deployment.deploymentId
    && left.deployment.versionId === right.deployment.versionId
    && JSON.stringify(left.bindings) === JSON.stringify(right.bindings);
}

export function createPublicDeploymentEvidenceRecorder(directory) {
  if (typeof directory !== "string" || directory.length < 1) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.EVIDENCE_INVALID);
  }
  try {
    mkdirSync(directory, { recursive: false, mode: 0o700 });
  } catch {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.EVIDENCE_INVALID);
  }
  const stats = lstatSync(directory);
  if (!stats.isDirectory() || stats.isSymbolicLink() || (stats.mode & 0o077) !== 0) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.EVIDENCE_INVALID);
  }
  let sequence = 0;
  const observed = [];
  return Object.freeze({
    append(phase) {
      if (!PHASES.has(phase) || observed.includes(phase)) {
        fail(PUBLIC_WORKFLOW_V2_FAILURE.EVIDENCE_INVALID);
      }
      sequence += 1;
      const path = join(directory, `${String(sequence).padStart(3, "0")}-${phase}`);
      writeFileSync(path, `${phase}\n`, { encoding: "ascii", mode: 0o600, flag: "wx" });
      observed.push(phase);
    },
    phases() {
      return Object.freeze([...observed]);
    }
  });
}

export async function runQualifiedPublicDeploymentLifecycle({
  inputs,
  verifyRelease,
  inspectIdentity,
  verifyInitialBindings,
  assertBindingsPreserved,
  fetchState,
  runDryRun,
  runDeploy,
  runRollback,
  runSmoke,
  evidence
}) {
  if (![verifyRelease, inspectIdentity, verifyInitialBindings, assertBindingsPreserved, fetchState,
    runDryRun, runDeploy, runRollback, runSmoke].every(value => typeof value === "function")
    || !evidence || typeof evidence.append !== "function") {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
  let deploymentAttempts = 0;
  let rollbackAttempts = 0;
  evidence.append(PUBLIC_WORKFLOW_V2_PHASE.DEPLOYMENT_NOT_BEGUN);
  const release = await verifyRelease();
  assertPublicRepositoryIdentity(await inspectIdentity(), inputs);
  await runDryRun(release);
  await verifyRelease();
  assertPublicRepositoryIdentity(await inspectIdentity(), inputs);
  evidence.append(PUBLIC_WORKFLOW_V2_PHASE.LOCAL_PREFLIGHT_PASSED);

  const initialPublic = await fetchState(PUBLIC_WORKFLOW_V2_POLICY.publicWorker);
  const initialPrivate = await fetchState(PUBLIC_WORKFLOW_V2_POLICY.privateWorker);
  if (initialPublic.deployment.versionId !== inputs.currentPublicVersion) {
    throw new PublicDeploymentPolicyError(PUBLIC_DEPLOYMENT_FAILURE.CURRENT_PUBLIC_VERSION_MISMATCH);
  }
  if (initialPrivate.deployment.versionId !== inputs.currentPrivateVersion) {
    throw new PublicDeploymentPolicyError(PUBLIC_DEPLOYMENT_FAILURE.CURRENT_PRIVATE_VERSION_MISMATCH);
  }
  verifyInitialBindings(initialPublic.bindings);
  await verifyRelease();
  assertPublicRepositoryIdentity(await inspectIdentity(), inputs);
  evidence.append(PUBLIC_WORKFLOW_V2_PHASE.PRODUCTION_PREREQUISITES_PASSED);

  if (deploymentAttempts !== 0) fail(PUBLIC_WORKFLOW_V2_FAILURE.DEPLOYMENT_ATTEMPT_LIMIT);
  deploymentAttempts += 1;
  let authorizationConsumed = false;
  const consumeAuthorization = () => {
    if (authorizationConsumed) fail(PUBLIC_WORKFLOW_V2_FAILURE.DEPLOYMENT_ATTEMPT_LIMIT);
    evidence.append(PUBLIC_WORKFLOW_V2_PHASE.AUTHORIZATION_CONSUMED);
    authorizationConsumed = true;
  };
  await runDeploy(release, consumeAuthorization);
  if (!authorizationConsumed) fail(PUBLIC_WORKFLOW_V2_FAILURE.DEPLOYMENT_BOUNDARY_INVALID);
  evidence.append(PUBLIC_WORKFLOW_V2_PHASE.DEPLOYMENT_REQUEST_COMPLETED);

  const deployedPublic = await fetchState(PUBLIC_WORKFLOW_V2_POLICY.publicWorker);
  const deployedPrivate = await fetchState(PUBLIC_WORKFLOW_V2_POLICY.privateWorker);
  if (deployedPublic.deployment.versionId === initialPublic.deployment.versionId
    || deployedPublic.deployment.deploymentId === initialPublic.deployment.deploymentId) {
    throw new PublicDeploymentPolicyError(PUBLIC_DEPLOYMENT_FAILURE.POST_DEPLOY_VERSION_MISMATCH);
  }
  if (!sameState(initialPrivate, deployedPrivate)) {
    throw new PublicDeploymentPolicyError(PUBLIC_DEPLOYMENT_FAILURE.PRIVATE_VERSION_CHANGED);
  }
  assertBindingsPreserved(initialPublic.bindings, deployedPublic.bindings);
  evidence.append(PUBLIC_WORKFLOW_V2_PHASE.POST_DEPLOYMENT_VERIFIED);

  const smoke = await runSmoke();
  if (!isPlainObject(smoke)
    || !Array.isArray(smoke.criticalFailures)
    || !Array.isArray(smoke.noncriticalFailures)
    || smoke.attemptedWriteCount !== 0) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.SMOKE_INVALID);
  }
  if (smoke.criticalFailures.length > 0) {
    evidence.append(PUBLIC_WORKFLOW_V2_PHASE.CRITICAL_SMOKE_FAILED);
    await verifyRelease();
    assertPublicRepositoryIdentity(await inspectIdentity(), inputs);
    if (rollbackAttempts !== 0) fail(PUBLIC_WORKFLOW_V2_FAILURE.ROLLBACK_BOUNDARY_INVALID);
    rollbackAttempts += 1;
    evidence.append(PUBLIC_WORKFLOW_V2_PHASE.ROLLBACK_REQUEST_BEGUN);
    await runRollback(release);
    const rolledBackPublic = await fetchState(PUBLIC_WORKFLOW_V2_POLICY.publicWorker);
    const rolledBackPrivate = await fetchState(PUBLIC_WORKFLOW_V2_POLICY.privateWorker);
    if (rolledBackPublic.deployment.versionId === deployedPublic.deployment.versionId
      || rolledBackPublic.deployment.deploymentId === deployedPublic.deployment.deploymentId
      || !sameState(initialPrivate, rolledBackPrivate)) {
      fail(PUBLIC_WORKFLOW_V2_FAILURE.ROLLBACK_BOUNDARY_INVALID);
    }
    assertBindingsPreserved(initialPublic.bindings, rolledBackPublic.bindings);
    evidence.append(PUBLIC_WORKFLOW_V2_PHASE.ROLLBACK_VERIFIED);
    return Object.freeze({
      status: "PUBLIC_WORKER_FORWARD_ROLLBACK_VERIFIED",
      deploymentAttempts,
      rollbackAttempts,
      noncriticalSmokeFailures: smoke.noncriticalFailures.length
    });
  }
  if (smoke.noncriticalFailures.length > 0) {
    evidence.append(PUBLIC_WORKFLOW_V2_PHASE.NONCRITICAL_SMOKE_REPORTED);
  }
  return Object.freeze({
    status: smoke.noncriticalFailures.length > 0
      ? "PUBLIC_WORKER_DEPLOYMENT_VERIFIED_WITH_NONCRITICAL_SMOKE"
      : "PUBLIC_WORKER_DEPLOYMENT_VERIFIED",
    deploymentAttempts,
    rollbackAttempts,
    noncriticalSmokeFailures: smoke.noncriticalFailures.length
  });
}

export function releaseDirectoryFromEnvironment(environment) {
  const path = environment.PROMETHEUS_QUALIFIED_RELEASE_PATH;
  if (typeof path !== "string" || path.length < 1 || !isAbsolute(path)) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
  return resolve(path);
}

export function writeQualificationOutputs(path, result) {
  if (typeof path !== "string" || path.length < 1 || !result) {
    fail(PUBLIC_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
  const lines = [
    `qualified_artifact_sha256=${result.artifactSha256}`,
    `qualified_manifest_sha256=${result.manifestSha256}`,
    `deployment_asset_sha256=${result.deploymentAssetsSha256}`,
    `rollback_contract_sha256=${result.rollbackContractSha256}`,
    `rollback_artifact_sha256=${result.rollbackArtifactSha256}`,
    `workflow_contract_sha256=${result.workflowContractSha256}`
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, { encoding: "ascii", mode: 0o600, flag: "a" });
}

export function formatPublicWorkflowV2Failure(error) {
  if (error instanceof PublicWorkflowV2Error || error instanceof PublicDeploymentPolicyError) {
    return error.code;
  }
  return PUBLIC_WORKFLOW_V2_FAILURE.QUALIFICATION_FAILED;
}

export function createTemporaryEvidenceDirectory(environment = process.env) {
  const base = environment.RUNNER_TEMP || tmpdir();
  return join(base, `prometheus-public-deployment-v2-${environment.GITHUB_RUN_ID || "local"}`);
}

export function removePublicWorkflowTemporaryDirectory(path) {
  rmSync(path, { recursive: true, force: true });
}

export const publicWorkflowV2SecretEnvironmentNames = SECRET_ENVIRONMENT_NAMES;
