import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  lstatSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { devNull, tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { parseJsonc } from "./github-actions-private-worker-deployment.mjs";

export const PUBLIC_WORKER_DEPLOYMENT_POLICY = Object.freeze({
  contractVersion: "github-actions-founder-triggered-public-worker-deployment-v1",
  repository: "PrometheusRouteIQ/prometheus-iq",
  repositoryUrl: "https://github.com/PrometheusRouteIQ/prometheus-iq",
  repositorySshUrl: "git@github.com:PrometheusRouteIQ/prometheus-iq.git",
  founderActor: "PrometheusRouteIQ",
  founderAuthorization: "I AUTHORIZE THIS EXACT PROMETHEUS PUBLIC WORKER DEPLOYMENT",
  workflowName: "Deploy Prometheus Public Worker",
  workflowPath: ".github/workflows/deploy-prometheus-public-worker.yml",
  integrityWorkflowName: "Verify Prometheus Public Repository Integrity",
  integrityWorkflowPath: ".github/workflows/verify-prometheus-public-repository-integrity.yml",
  integrityContractPath: "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json",
  workflowRef: "PrometheusRouteIQ/prometheus-iq/.github/workflows/deploy-prometheus-public-worker.yml@refs/heads/main",
  environmentName: "prometheus-public-worker-production",
  branch: "main",
  ref: "refs/heads/main",
  refType: "branch",
  eventName: "workflow_dispatch",
  firstRunAttempt: "1",
  publicWorker: "prometheusrouteiq-website",
  privateWorker: "prometheus-iq",
  publicConfig: "wrangler.prometheusrouteiq-website.jsonc",
  privateConfig: "wrangler.jsonc",
  contractPath: "workers/infrastructure/github-actions-founder-triggered-public-worker-deployment-v1.json",
  accessContractPath: "workers/infrastructure/route-iq-public-crm-founder-access-v1.json",
  rollbackContractPath: "workers/infrastructure/route-iq-public-forward-rollback-v1.json",
  crmRuntimeContractPath: "workers/infrastructure/route-iq-request-crm-runtime-v1.json",
  activationTemplatePath: "workers/infrastructure/route-iq-prospective-shadow-activation-template-v1.json",
  crmBinding: "ROUTE_IQ_REQUEST_CRM_COORDINATOR",
  crmClass: "RouteIqRequestCrmCoordinator",
  crmMigration: "route-iq-request-crm-sqlite-v1",
  wranglerVersion: "4.110.0",
  wranglerModule: "node_modules/wrangler/bin/wrangler.js",
  cloudflareApiOrigin: "https://api.cloudflare.com",
  responseByteLimit: 128 * 1024,
  commandOutputByteLimit: 128 * 1024,
  requestTimeoutMs: 30_000,
  testRequestTimeoutMaximumMs: 1_000,
  dryRunTimeoutMs: 240_000,
  deployTimeoutMs: 300_000
});

export const PUBLIC_DEPLOYMENT_FAILURE = Object.freeze({
  INPUT_INVALID: "INPUT_INVALID",
  CONTEXT_INVALID: "CONTEXT_INVALID",
  REPOSITORY_IDENTITY_MISMATCH: "REPOSITORY_IDENTITY_MISMATCH",
  REPOSITORY_DIRTY: "REPOSITORY_DIRTY",
  ORIGIN_MAIN_MISMATCH: "ORIGIN_MAIN_MISMATCH",
  REPOSITORY_INTEGRITY_FAILED: "REPOSITORY_INTEGRITY_FAILED",
  PREFLIGHT_FAILED: "PREFLIGHT_FAILED",
  CONFIG_INVALID: "CONFIG_INVALID",
  GOVERNANCE_BOUNDARY_INVALID: "GOVERNANCE_BOUNDARY_INVALID",
  ROLLBACK_INVALID: "ROLLBACK_INVALID",
  WRANGLER_PIN_INVALID: "WRANGLER_PIN_INVALID",
  CREDENTIAL_CONTEXT_INVALID: "CREDENTIAL_CONTEXT_INVALID",
  SETTINGS_INVALID: "SETTINGS_INVALID",
  NETWORK_UNCERTAIN: "NETWORK_UNCERTAIN",
  REQUEST_TIMEOUT: "REQUEST_TIMEOUT",
  REDIRECT_DENIED: "REDIRECT_DENIED",
  HTTP_FAILED: "HTTP_FAILED",
  RESPONSE_BODY_FAILED: "RESPONSE_BODY_FAILED",
  RESPONSE_INVALID: "RESPONSE_INVALID",
  CURRENT_PUBLIC_VERSION_MISMATCH: "CURRENT_PUBLIC_VERSION_MISMATCH",
  CURRENT_PRIVATE_VERSION_MISMATCH: "CURRENT_PRIVATE_VERSION_MISMATCH",
  TRAFFIC_SPLIT: "TRAFFIC_SPLIT",
  CONCURRENT_DEPLOYMENT_DETECTED: "CONCURRENT_DEPLOYMENT_DETECTED",
  DRY_RUN_FAILED: "DRY_RUN_FAILED",
  DEPLOY_FAILED: "DEPLOY_FAILED",
  POST_DEPLOY_VERSION_MISMATCH: "POST_DEPLOY_VERSION_MISMATCH",
  PRIVATE_VERSION_CHANGED: "PRIVATE_VERSION_CHANGED",
  BINDING_REMOVED: "BINDING_REMOVED",
  REQUIRED_BINDING_MISSING: "REQUIRED_BINDING_MISSING"
});

export const PUBLIC_CLOUDFLARE_READ_PHASE = Object.freeze({
  PUBLIC_DEPLOYMENTS: "PUBLIC_DEPLOYMENTS",
  PUBLIC_SETTINGS: "PUBLIC_SETTINGS",
  PRIVATE_DEPLOYMENTS: "PRIVATE_DEPLOYMENTS",
  PRIVATE_SETTINGS: "PRIVATE_SETTINGS"
});

const LOWER_HEX_40 = /^[0-9a-f]{40}$/u;
const LOWER_HEX_64 = /^[0-9a-f]{64}$/u;
const ACCOUNT_ID = /^[0-9a-f]{32}$/u;
const BATCH_ID = /^BATCH-[0-9]{8}-[0-9]{3}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const TEAM_DOMAIN = /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/u;
const MAX_FILE_BYTES = 2_000_000;
const MAX_GIT_BYTES = 2_000_000;
const MAX_GIT_FSCK_BYTES = 128 * 1024;
const GIT_TIMEOUT_MS = 30_000;
const SAFE_DIAGNOSTIC = /^[A-Z][A-Z0-9_]*(?:=[A-Z0-9_,.-]+)?$/u;
const CLOUDFLARE_READ_PHASES = new Set(Object.values(PUBLIC_CLOUDFLARE_READ_PHASE));
const GIT_FSCK_ARGUMENTS = Object.freeze([
  "fsck",
  "--full",
  "--strict",
  "--no-dangling",
  "--no-progress"
]);
const FOUNDER_INPUT_NAMES = Object.freeze([
  "approved_commit",
  "approved_tree",
  "batch_id",
  "current_public_version",
  "current_private_version",
  "rollback_artifact_sha256",
  "founder_authorization"
]);
const FOUNDER_SETTING_NAMES = Object.freeze([
  "ROUTE_IQ_REQUEST_CRM_ACCESS_TEAM_DOMAIN",
  "ROUTE_IQ_REQUEST_CRM_ACCESS_AUDIENCE",
  "ROUTE_IQ_REQUEST_CRM_FOUNDER_SUBJECT_SHA256"
]);
const CREDENTIAL_NAMES = Object.freeze({
  apiToken: "CLOUDFLARE_API_TOKEN",
  accountId: "CLOUDFLARE_ACCOUNT_ID",
  teamDomain: FOUNDER_SETTING_NAMES[0],
  audience: FOUNDER_SETTING_NAMES[1],
  subjectSha256: FOUNDER_SETTING_NAMES[2]
});

export class PublicDeploymentPolicyError extends Error {
  constructor(code, diagnostics = []) {
    super(code);
    this.name = "PublicDeploymentPolicyError";
    this.code = code;
    this.diagnostics = Object.freeze([...new Set((Array.isArray(diagnostics) ? diagnostics : [])
      .map(value => String(value))
      .map(value => SAFE_DIAGNOSTIC.test(value) ? value : "DIAGNOSTIC_REDACTED"))].slice(0, 16));
  }
}

function fail(code, diagnostics) {
  throw new PublicDeploymentPolicyError(code, diagnostics);
}

function cloudflareReadPhaseDiagnostic(phase) {
  if (!CLOUDFLARE_READ_PHASES.has(phase)) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.CONFIG_INVALID);
  }
  return `CLOUDFLARE_READ_PHASE=${phase}`;
}

function failCloudflareRead(error, phase, signal, fallbackCode) {
  const diagnostic = cloudflareReadPhaseDiagnostic(phase);
  if (error instanceof PublicDeploymentPolicyError) {
    throw new PublicDeploymentPolicyError(error.code, [...error.diagnostics, diagnostic]);
  }
  if (signal?.aborted) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.REQUEST_TIMEOUT, [diagnostic]);
  }
  fail(fallbackCode, [diagnostic]);
}

function isExpectedPublicRepositoryOrigin(originUrl) {
  return [
    PUBLIC_WORKER_DEPLOYMENT_POLICY.repositoryUrl,
    `${PUBLIC_WORKER_DEPLOYMENT_POLICY.repositoryUrl}.git`,
    PUBLIC_WORKER_DEPLOYMENT_POLICY.repositorySshUrl
  ].includes(originUrl);
}

export function formatPublicDeploymentFailure(error, mode = "verify") {
  if (error instanceof PublicDeploymentPolicyError) {
    return Object.freeze([error.code, ...error.diagnostics]);
  }
  return Object.freeze([
    mode === "deploy" ? PUBLIC_DEPLOYMENT_FAILURE.DEPLOY_FAILED : PUBLIC_DEPLOYMENT_FAILURE.PREFLIGHT_FAILED,
    "PREFLIGHT_DIAGNOSTIC=UNCLASSIFIED_INTERNAL_FAILURE"
  ]);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, required, optional = []) {
  if (!isPlainObject(value)) return false;
  const allowed = new Set([...required, ...optional]);
  const actual = Object.keys(value);
  return required.every(key => Object.hasOwn(value, key))
    && actual.every(key => allowed.has(key));
}

function boundedString(value, maximum = 4096) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}

function readRegularFile(root, relativePath) {
  const path = resolve(root, relativePath);
  const stats = lstatSync(path);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size < 1 || stats.size > MAX_FILE_BYTES) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.CONFIG_INVALID);
  }
  return readFileSync(path, "utf8");
}

function runGit(root, argumentsList, { allowExitOne = false } = {}) {
  const result = spawnSync("git", argumentsList, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: MAX_GIT_BYTES,
    timeout: GIT_TIMEOUT_MS,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0"
    }
  });
  if (allowExitOne && result.status === 1 && !result.error && !result.signal) return null;
  if (result.status !== 0 || result.error || result.signal) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_IDENTITY_MISMATCH);
  }
  return String(result.stdout || "").trim();
}

export function readPublicRepositoryIdentity(root) {
  const unstaged = runGit(root, ["diff", "--quiet"], { allowExitOne: true });
  const staged = runGit(root, ["diff", "--cached", "--quiet"], { allowExitOne: true });
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

export function validatePublicFounderDeploymentInputs(environment) {
  const values = Object.freeze({
    approvedCommit: environment.PROMETHEUS_APPROVED_COMMIT,
    approvedTree: environment.PROMETHEUS_APPROVED_TREE,
    batchId: environment.PROMETHEUS_BATCH_ID,
    currentPublicVersion: environment.PROMETHEUS_CURRENT_PUBLIC_VERSION,
    currentPrivateVersion: environment.PROMETHEUS_CURRENT_PRIVATE_VERSION,
    rollbackArtifactSha256: environment.PROMETHEUS_ROLLBACK_ARTIFACT_SHA256,
    founderAuthorization: environment.PROMETHEUS_FOUNDER_AUTHORIZATION
  });
  if (!LOWER_HEX_40.test(values.approvedCommit || "")
    || !LOWER_HEX_40.test(values.approvedTree || "")
    || !BATCH_ID.test(values.batchId || "")
    || !UUID.test(values.currentPublicVersion || "")
    || !UUID.test(values.currentPrivateVersion || "")
    || !LOWER_HEX_64.test(values.rollbackArtifactSha256 || "")
    || values.founderAuthorization !== PUBLIC_WORKER_DEPLOYMENT_POLICY.founderAuthorization) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.INPUT_INVALID);
  }
  let dispatch;
  try {
    dispatch = JSON.parse(environment.PROMETHEUS_DISPATCH_INPUTS_JSON || "");
  } catch {
    fail(PUBLIC_DEPLOYMENT_FAILURE.INPUT_INVALID);
  }
  if (!exactKeys(dispatch, FOUNDER_INPUT_NAMES)
    || dispatch.approved_commit !== values.approvedCommit
    || dispatch.approved_tree !== values.approvedTree
    || dispatch.batch_id !== values.batchId
    || dispatch.current_public_version !== values.currentPublicVersion
    || dispatch.current_private_version !== values.currentPrivateVersion
    || dispatch.rollback_artifact_sha256 !== values.rollbackArtifactSha256
    || dispatch.founder_authorization !== values.founderAuthorization) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.INPUT_INVALID);
  }
  if (environment.GITHUB_REPOSITORY !== PUBLIC_WORKER_DEPLOYMENT_POLICY.repository
    || environment.GITHUB_REF !== PUBLIC_WORKER_DEPLOYMENT_POLICY.ref
    || environment.GITHUB_REF_NAME !== PUBLIC_WORKER_DEPLOYMENT_POLICY.branch
    || environment.GITHUB_REF_TYPE !== PUBLIC_WORKER_DEPLOYMENT_POLICY.refType
    || environment.GITHUB_EVENT_NAME !== PUBLIC_WORKER_DEPLOYMENT_POLICY.eventName
    || environment.GITHUB_SHA !== values.approvedCommit
    || environment.GITHUB_ACTOR !== PUBLIC_WORKER_DEPLOYMENT_POLICY.founderActor
    || environment.GITHUB_TRIGGERING_ACTOR !== PUBLIC_WORKER_DEPLOYMENT_POLICY.founderActor
    || environment.GITHUB_WORKFLOW !== PUBLIC_WORKER_DEPLOYMENT_POLICY.workflowName
    || environment.GITHUB_WORKFLOW_REF !== PUBLIC_WORKER_DEPLOYMENT_POLICY.workflowRef
    || environment.GITHUB_RUN_ATTEMPT !== PUBLIC_WORKER_DEPLOYMENT_POLICY.firstRunAttempt) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.CONTEXT_INVALID);
  }
  return values;
}

export function assertPublicRepositoryIdentity(identity, inputs) {
  if (identity.head !== inputs.approvedCommit
    || identity.tree !== inputs.approvedTree
    || identity.branch !== PUBLIC_WORKER_DEPLOYMENT_POLICY.branch
    || !isExpectedPublicRepositoryOrigin(identity.originUrl)) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_IDENTITY_MISMATCH);
  }
  if (identity.originMain !== inputs.approvedCommit) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.ORIGIN_MAIN_MISMATCH);
  }
  if (identity.status !== "" || !identity.unstagedClean || !identity.stagedClean) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_DIRTY);
  }
}

function runPublicIntegrityGit(root, argumentsList, {
  allowAbsent = false,
  classification,
  runner = spawnSync,
  timeout = GIT_TIMEOUT_MS
} = {}) {
  const result = runner("git", argumentsList, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: MAX_GIT_BYTES,
    timeout,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: devNull,
      GIT_TERMINAL_PROMPT: "0",
      LC_ALL: "C"
    }
  });
  if (allowAbsent && result.status === 1 && !result.error && !result.signal) {
    return Object.freeze({ output: "", absent: true });
  }
  if (result.status !== 0 || result.error || result.signal) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED, [
      `GIT_PROBE=${classification || "UNKNOWN"}`,
      `GIT_PROBE_EXIT=${Number.isInteger(result.status) ? result.status : "NONE"}`,
      `GIT_PROBE_SIGNAL=${typeof result.signal === "string" ? result.signal.toUpperCase() : "NONE"}`
    ]);
  }
  return Object.freeze({ output: String(result.stdout || "").trim(), absent: false });
}

function byteLength(value) {
  return Buffer.byteLength(String(value || ""), "utf8");
}

function classifyGitFsckOutput(stdout, stderr, result) {
  const combined = `${String(stdout || "")}\n${String(stderr || "")}`;
  const classifications = new Set();
  if (result.error?.code === "ENOBUFS") classifications.add("OUTPUT_LIMIT_EXCEEDED");
  else if (result.error?.code === "ETIMEDOUT") classifications.add("TIMEOUT");
  else if (result.error) classifications.add("PROCESS_ERROR");
  if (/missing (?:blob|commit|tag|tree)|missing object|does not exist/iu.test(combined)) {
    classifications.add("MISSING_OBJECT");
  }
  if (/hash mismatch|object corrupt|corrupt loose object|sha1 mismatch|sha256 mismatch/iu.test(combined)) {
    classifications.add("CORRUPT_OBJECT");
  }
  if (/invalid sha1 pointer|invalid sha256 pointer|invalid ref|bad ref|reference broken|refs verify/iu.test(combined)) {
    classifications.add("INVALID_REF");
  }
  if (/error in (?:blob|commit|tag|tree)|malformed|bad(?:date|email|filemode|gpgsig)|missing(?:tree|type)/iu.test(combined)) {
    classifications.add("MALFORMED_OBJECT");
  }
  if (/unable to read|failed to parse|could not open/iu.test(combined)) {
    classifications.add("OBJECT_READ_FAILED");
  }
  if (result.signal) classifications.add("PROCESS_SIGNALLED");
  if (classifications.size === 0) classifications.add("UNCLASSIFIED_FAILURE");
  return [...classifications].sort();
}

function gitFsckFailureDiagnostics(result) {
  const classifications = classifyGitFsckOutput(result.stdout, result.stderr, result);
  return Object.freeze([
    `GIT_FSCK_EXIT=${Number.isInteger(result.status) ? result.status : "NONE"}`,
    `GIT_FSCK_SIGNAL=${typeof result.signal === "string" ? result.signal.toUpperCase() : "NONE"}`,
    `GIT_FSCK_STDOUT_BYTES=${byteLength(result.stdout)}`,
    `GIT_FSCK_STDERR_BYTES=${byteLength(result.stderr)}`,
    `GIT_FSCK_CAPTURE_LIMIT_BYTES=${MAX_GIT_FSCK_BYTES}`,
    `GIT_FSCK_CLASSIFICATIONS=${classifications.join(",")}`
  ]);
}

export function inspectPublicRepositoryIntegrity(root) {
  const gitVersion = runPublicIntegrityGit(root, ["version"], {
    classification: "VERSION"
  }).output;
  const shallow = runPublicIntegrityGit(root, ["rev-parse", "--is-shallow-repository"], {
    classification: "SHALLOW"
  }).output;
  const objectFormat = runPublicIntegrityGit(root, ["rev-parse", "--show-object-format"], {
    classification: "OBJECT_FORMAT"
  }).output;
  const partialClone = runPublicIntegrityGit(root, ["config", "--get", "extensions.partialClone"], {
    allowAbsent: true,
    classification: "PARTIAL_CLONE"
  });
  const promisor = runPublicIntegrityGit(root, ["config", "--get-regexp", "^remote\\..*\\.promisor$"], {
    allowAbsent: true,
    classification: "PROMISOR"
  });
  const refs = runPublicIntegrityGit(root, ["for-each-ref", "--format=%(refname)"], {
    classification: "REFERENCES"
  }).output.split("\n").filter(Boolean);
  return Object.freeze({
    gitVersion,
    shallow,
    objectFormat,
    partialClone: !partialClone.absent,
    promisor: !promisor.absent,
    refCount: refs.length
  });
}

export function verifyPublicRepositoryIntegrity(root, { fsckRunner = spawnSync } = {}) {
  const metadata = inspectPublicRepositoryIntegrity(root);
  if (metadata.shallow !== "false") {
    fail(PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED, [
      "GIT_REPOSITORY_CLASSIFICATION=SHALLOW_REPOSITORY"
    ]);
  }
  if (metadata.objectFormat !== "sha1") {
    fail(PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED, [
      "GIT_REPOSITORY_CLASSIFICATION=OBJECT_FORMAT_UNSUPPORTED"
    ]);
  }
  if (metadata.partialClone || metadata.promisor) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED, [
      "GIT_REPOSITORY_CLASSIFICATION=PARTIAL_OR_PROMISOR_REPOSITORY"
    ]);
  }
  const result = fsckRunner("git", GIT_FSCK_ARGUMENTS, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: MAX_GIT_FSCK_BYTES,
    timeout: 120_000,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: devNull,
      GIT_TERMINAL_PROMPT: "0",
      LC_ALL: "C"
    }
  });
  if (result.status !== 0
    || result.error
    || result.signal
    || byteLength(result.stdout) > 0
    || byteLength(result.stderr) > 0) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED, gitFsckFailureDiagnostics(result));
  }
  return Object.freeze({ status: "PUBLIC_REPOSITORY_INTEGRITY_VERIFIED", ...metadata });
}

function parseContract(root, path) {
  try {
    return JSON.parse(readRegularFile(root, path));
  } catch (error) {
    if (error instanceof PublicDeploymentPolicyError) throw error;
    fail(PUBLIC_DEPLOYMENT_FAILURE.CONFIG_INVALID);
  }
}

function sha256File(root, path) {
  return createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
}

function sha256Directory(root, relativeDirectory) {
  const directory = resolve(root, relativeDirectory);
  const files = [];
  const visit = current => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isSymbolicLink()) fail(PUBLIC_DEPLOYMENT_FAILURE.ROLLBACK_INVALID);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(path);
      else fail(PUBLIC_DEPLOYMENT_FAILURE.ROLLBACK_INVALID);
    }
  };
  try {
    visit(directory);
  } catch (error) {
    if (error instanceof PublicDeploymentPolicyError) throw error;
    fail(PUBLIC_DEPLOYMENT_FAILURE.ROLLBACK_INVALID);
  }
  const digest = createHash("sha256");
  for (const path of files.sort((left, right) => relative(directory, left).localeCompare(relative(directory, right)))) {
    digest.update(relative(directory, path).split("\\").join("/"), "utf8");
    digest.update("\0", "utf8");
    digest.update(readFileSync(path));
    digest.update("\0", "utf8");
  }
  return digest.digest("hex");
}

export function verifyPublicForwardRollbackContract(root) {
  const contract = parseContract(root, PUBLIC_WORKER_DEPLOYMENT_POLICY.rollbackContractPath);
  if (contract.version !== "route-iq-public-forward-rollback-v1"
    || contract.owner !== "Prometheus Infrastructure"
    || contract.target !== PUBLIC_WORKER_DEPLOYMENT_POLICY.publicWorker
    || contract.strategy !== "new_forward_deployment"
    || contract.nativeCloudflareRollbackAllowed !== false
    || !LOWER_HEX_40.test(contract.candidateWebsiteCommit || "")
    || !LOWER_HEX_40.test(contract.candidateWebsiteTree || "")
    || !LOWER_HEX_64.test(contract.candidateDeploymentAssetsSha256 || "")
    || !LOWER_HEX_40.test(contract.sourceWebsiteCommit || "")
    || !LOWER_HEX_40.test(contract.sourceWebsiteTree || "")
    || contract.candidateWebsiteCommit === contract.sourceWebsiteCommit
    || contract.candidateWebsiteTree === contract.sourceWebsiteTree
    || contract.websiteAssetPath !== "deploy/prometheusrouteiq-website"
    || contract.statefulCompatibility?.durableObjectBinding !== PUBLIC_WORKER_DEPLOYMENT_POLICY.crmBinding
    || contract.statefulCompatibility?.durableObjectClass !== PUBLIC_WORKER_DEPLOYMENT_POLICY.crmClass
    || contract.statefulCompatibility?.migrationTag !== PUBLIC_WORKER_DEPLOYMENT_POLICY.crmMigration
    || contract.statefulCompatibility?.migrationHistoryPreserved !== true
    || contract.statefulCompatibility?.acceptedRecordsPreserved !== true
    || contract.statefulCompatibility?.deletedClassesAllowed !== false
    || contract.statefulCompatibility?.productionDataRewriteAllowed !== false
    || contract.artifact?.construction !== "canonical_deployable_bundle_with_prior_public_assets"
    || contract.artifact?.identityVersion !== "route-iq-public-forward-rollback-artifact-v3"
    || JSON.stringify(contract.artifact?.identityScope) !== JSON.stringify([
      "candidate_website_owner_identity",
      "candidate_deployment_assets_sha256",
      "candidate_stateful_file_manifest",
      "wrangler_configuration",
      "prior_public_assets",
      "generated_worker_bundle",
      "canonical_generated_source_map"
    ])
    || JSON.stringify(contract.artifact?.requiredGeneratedOutputs) !== JSON.stringify([
      "prometheus-iq-worker.js",
      "prometheus-iq-worker.js.map"
    ])
    || JSON.stringify(contract.artifact?.excludedBuildOnlyOutputs) !== JSON.stringify(["README.md"])
    || contract.artifact?.unrelatedRepositoryFilesAffectIdentity !== false
    || contract.artifact?.pathIndependentSha256Required !== true
    || contract.artifact?.founderApprovalInputRequired !== true
    || contract.artifact?.dryRunRequiredBeforeDeployment !== true) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.ROLLBACK_INVALID);
  }
  let candidateTree;
  let sourceTree;
  try {
    candidateTree = runGit(root, ["rev-parse", `${contract.candidateWebsiteCommit}^{tree}`]);
    runGit(root, ["merge-base", "--is-ancestor", contract.candidateWebsiteCommit, "HEAD"]);
    sourceTree = runGit(root, ["rev-parse", `${contract.sourceWebsiteCommit}^{tree}`]);
  } catch {
    fail(PUBLIC_DEPLOYMENT_FAILURE.ROLLBACK_INVALID);
  }
  if (candidateTree !== contract.candidateWebsiteTree) fail(PUBLIC_DEPLOYMENT_FAILURE.ROLLBACK_INVALID);
  if (sourceTree !== contract.sourceWebsiteTree) fail(PUBLIC_DEPLOYMENT_FAILURE.ROLLBACK_INVALID);
  if (sha256Directory(root, contract.websiteAssetPath) !== contract.candidateDeploymentAssetsSha256) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.ROLLBACK_INVALID);
  }
  for (const [path, expected] of Object.entries(contract.candidateStatefulFiles || {})) {
    if (!LOWER_HEX_64.test(expected) || sha256File(root, path) !== expected) {
      fail(PUBLIC_DEPLOYMENT_FAILURE.ROLLBACK_INVALID);
    }
  }
  const assetTree = runGit(root, ["rev-parse", `${contract.sourceWebsiteCommit}:${contract.websiteAssetPath}`]);
  if (!LOWER_HEX_40.test(assetTree)) fail(PUBLIC_DEPLOYMENT_FAILURE.ROLLBACK_INVALID);
  return Object.freeze(contract);
}

export function verifyPublicStaticDeploymentPolicy(root) {
  let publicConfig;
  let privateConfig;
  try {
    publicConfig = parseJsonc(readRegularFile(root, PUBLIC_WORKER_DEPLOYMENT_POLICY.publicConfig));
    privateConfig = parseJsonc(readRegularFile(root, PUBLIC_WORKER_DEPLOYMENT_POLICY.privateConfig));
  } catch {
    fail(PUBLIC_DEPLOYMENT_FAILURE.CONFIG_INVALID);
  }
  const deployment = parseContract(root, PUBLIC_WORKER_DEPLOYMENT_POLICY.contractPath);
  const access = parseContract(root, PUBLIC_WORKER_DEPLOYMENT_POLICY.accessContractPath);
  const crm = parseContract(root, PUBLIC_WORKER_DEPLOYMENT_POLICY.crmRuntimeContractPath);
  const activation = parseContract(root, PUBLIC_WORKER_DEPLOYMENT_POLICY.activationTemplatePath);
  const bindings = publicConfig?.durable_objects?.bindings;
  const migrations = publicConfig?.migrations;
  if (publicConfig?.name !== PUBLIC_WORKER_DEPLOYMENT_POLICY.publicWorker
    || publicConfig?.main !== "workers/prometheus-iq-worker.js"
    || publicConfig?.assets?.directory !== "./deploy/prometheusrouteiq-website"
    || JSON.stringify(publicConfig?.assets?.run_worker_first) !== JSON.stringify(["/api/*"])
    || !Array.isArray(bindings)
    || bindings.length !== 1
    || bindings[0]?.name !== PUBLIC_WORKER_DEPLOYMENT_POLICY.crmBinding
    || bindings[0]?.class_name !== PUBLIC_WORKER_DEPLOYMENT_POLICY.crmClass
    || !Array.isArray(migrations)
    || migrations.length !== 1
    || migrations[0]?.tag !== PUBLIC_WORKER_DEPLOYMENT_POLICY.crmMigration
    || JSON.stringify(migrations[0]?.new_sqlite_classes) !== JSON.stringify([PUBLIC_WORKER_DEPLOYMENT_POLICY.crmClass])
    || Object.hasOwn(migrations[0], "deleted_classes")
    || privateConfig?.name !== PUBLIC_WORKER_DEPLOYMENT_POLICY.privateWorker
    || deployment.contractVersion !== PUBLIC_WORKER_DEPLOYMENT_POLICY.contractVersion
    || deployment.owner !== "Prometheus Infrastructure"
    || deployment.target?.publicWorker !== PUBLIC_WORKER_DEPLOYMENT_POLICY.publicWorker
    || deployment.target?.privateWorker !== PUBLIC_WORKER_DEPLOYMENT_POLICY.privateWorker
    || deployment.target?.privateWorkerDeploymentAllowed !== false
    || deployment.target?.nameOverrideAllowed !== false
    || deployment.workflow?.trigger !== "workflow_dispatch"
    || deployment.workflow?.deploymentAttempts !== 1
    || deployment.workflow?.generatedAssetsCommand !== "npm run build"
    || deployment.workflow?.generatedAssetsDirectory !== "dist-public"
    || deployment.workflow?.generatedAssetsBeforeNoSecretVerification !== true
    || JSON.stringify(deployment.workflow?.generatedAssetsJobs) !== JSON.stringify(["verification", "deploy"])
    || deployment.workflow?.assetIdentityVerifier !== "scripts/verify-route-iq-public-deployment-assets.mjs"
    || deployment.cleanRunnerFailureEvidence?.runId !== 29723618108
    || deployment.cleanRunnerFailureEvidence?.head !== "1e4e9be843fe418ae8920ccb109b4259fda5455c"
    || deployment.cleanRunnerFailureEvidence?.tree !== "e0d86821386d2f3d348eb88ae25f85f367878280"
    || deployment.cleanRunnerFailureEvidence?.failureClassification
      !== "GENERATED_PUBLIC_ASSETS_MISSING_BEFORE_VERIFICATION"
    || deployment.cleanRunnerFailureEvidence?.missingDirectory !== "dist-public"
    || deployment.cleanRunnerFailureEvidence?.deploymentJobSkipped !== true
    || deployment.cleanRunnerFailureEvidence?.cloudflareChanged !== false
    || deployment.cleanRunnerFailureEvidence?.immutableEvidence !== true
    || deployment.cloudflareReadFailureEvidence?.productionRequestTimeoutMs
      !== PUBLIC_WORKER_DEPLOYMENT_POLICY.requestTimeoutMs
    || deployment.cloudflareReadFailureEvidence?.testRequestTimeoutMaximumMs
      !== PUBLIC_WORKER_DEPLOYMENT_POLICY.testRequestTimeoutMaximumMs
    || deployment.cloudflareReadFailureEvidence?.maximumSerializedStateReads !== 12
    || deployment.cloudflareReadFailureEvidence?.maximumSerializedReadBudgetMs !== 360000
    || deployment.cloudflareReadFailureEvidence?.deploymentJobTimeoutMs !== 1800000
    || deployment.cloudflareReadFailureEvidence?.automaticRetryAllowed !== false
    || deployment.cloudflare?.crmMigrationTag !== PUBLIC_WORKER_DEPLOYMENT_POLICY.crmMigration
    || deployment.cloudflare?.crmBinding !== PUBLIC_WORKER_DEPLOYMENT_POLICY.crmBinding
    || deployment.cloudflare?.crmClass !== PUBLIC_WORKER_DEPLOYMENT_POLICY.crmClass
    || deployment.cloudflare?.deletedClassesAllowed !== false
    || access.application?.domain !== "prometheusrouteiq.com/api/partner-intake/founder/*"
    || access.policy?.decision !== "allow"
    || access.policy?.bypassAllowed !== false
    || access.policy?.everyoneAllowed !== false
    || access.policy?.displayNameAllowed !== false
    || access.httpBoundary?.publicWebsiteProtected !== false
    || access.httpBoundary?.publicIntake?.cloudflareAccessRequired !== false
    || access.httpBoundary?.founderEndpoints?.cloudflareAccessRequired !== true
    || access.workerSettings?.canModifyLiveVersionWithoutNewVersion !== false
    || JSON.stringify(access.workerSettings?.names) !== JSON.stringify(FOUNDER_SETTING_NAMES)
    || crm.storage?.binding !== PUBLIC_WORKER_DEPLOYMENT_POLICY.crmBinding
    || crm.storage?.className !== PUBLIC_WORKER_DEPLOYMENT_POLICY.crmClass
    || crm.storage?.migrationTag !== PUBLIC_WORKER_DEPLOYMENT_POLICY.crmMigration
    || activation.collection !== "OFF"
    || activation.activeCohortCount !== 0
    || activation.recommendationInfluence !== "OFF") {
    fail(PUBLIC_DEPLOYMENT_FAILURE.GOVERNANCE_BOUNDARY_INVALID);
  }
  for (const name of FOUNDER_SETTING_NAMES) {
    if (Object.hasOwn(publicConfig.vars || {}, name)) {
      fail(PUBLIC_DEPLOYMENT_FAILURE.GOVERNANCE_BOUNDARY_INVALID);
    }
  }
  verifyPublicForwardRollbackContract(root);
  return Object.freeze({
    publicWorker: publicConfig.name,
    privateWorker: privateConfig.name,
    collection: activation.collection,
    activeCohortCount: activation.activeCohortCount,
    recommendationInfluence: activation.recommendationInfluence
  });
}

export function verifyPublicWranglerPin(root) {
  try {
    const packageJson = JSON.parse(readRegularFile(root, "package.json"));
    const lock = JSON.parse(readRegularFile(root, "package-lock.json"));
    const installed = JSON.parse(readRegularFile(root, "node_modules/wrangler/package.json"));
    if (packageJson.devDependencies?.wrangler !== PUBLIC_WORKER_DEPLOYMENT_POLICY.wranglerVersion
      || lock.packages?.[""]?.devDependencies?.wrangler !== PUBLIC_WORKER_DEPLOYMENT_POLICY.wranglerVersion
      || lock.packages?.["node_modules/wrangler"]?.version !== PUBLIC_WORKER_DEPLOYMENT_POLICY.wranglerVersion
      || installed.version !== PUBLIC_WORKER_DEPLOYMENT_POLICY.wranglerVersion) {
      fail(PUBLIC_DEPLOYMENT_FAILURE.WRANGLER_PIN_INVALID);
    }
  } catch (error) {
    if (error instanceof PublicDeploymentPolicyError) throw error;
    fail(PUBLIC_DEPLOYMENT_FAILURE.WRANGLER_PIN_INVALID);
  }
}

export function buildPublicWranglerInvocation(mode, inputs, secretFile) {
  if (!["dry-run", "deploy"].includes(mode)
    || !boundedString(secretFile, 4096)
    || !inputs) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.CONFIG_INVALID);
  }
  const message = `${inputs.batchId} founder-approved ${inputs.approvedCommit}`;
  const tag = `prometheus-${inputs.batchId.toLowerCase()}-${inputs.approvedCommit.slice(0, 12)}`;
  const argumentsList = [
    PUBLIC_WORKER_DEPLOYMENT_POLICY.wranglerModule,
    "deploy",
    "--config",
    PUBLIC_WORKER_DEPLOYMENT_POLICY.publicConfig,
    "--keep-vars",
    "--strict",
    "--secrets-file",
    secretFile,
    "--message",
    message,
    "--tag",
    tag
  ];
  if (mode === "dry-run") argumentsList.splice(2, 0, "--dry-run");
  if (argumentsList.includes("--name")
    || argumentsList.includes(PUBLIC_WORKER_DEPLOYMENT_POLICY.privateWorker)
    || !argumentsList.includes(PUBLIC_WORKER_DEPLOYMENT_POLICY.publicConfig)) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.GOVERNANCE_BOUNDARY_INVALID);
  }
  return Object.freeze(argumentsList);
}

export function takePublicDeploymentCredentials(environment) {
  const values = {
    apiToken: environment[CREDENTIAL_NAMES.apiToken],
    accountId: environment[CREDENTIAL_NAMES.accountId],
    teamDomain: environment[CREDENTIAL_NAMES.teamDomain],
    audience: environment[CREDENTIAL_NAMES.audience],
    subjectSha256: environment[CREDENTIAL_NAMES.subjectSha256]
  };
  for (const name of Object.values(CREDENTIAL_NAMES)) delete environment[name];
  if (!boundedString(values.apiToken)
    || !ACCOUNT_ID.test(values.accountId || "")
    || !TEAM_DOMAIN.test(values.teamDomain || "")
    || !LOWER_HEX_64.test(values.audience || "")
    || !LOWER_HEX_64.test(values.subjectSha256 || "")) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.CREDENTIAL_CONTEXT_INVALID);
  }
  return values;
}

export function scrubPublicDeploymentCredentials(credentials) {
  if (!credentials || typeof credentials !== "object") return;
  for (const key of Object.keys(credentials)) credentials[key] = "";
}

export function createFounderSettingsSecretFile(credentials, root = process.env.RUNNER_TEMP || tmpdir()) {
  if (!credentials || !TEAM_DOMAIN.test(credentials.teamDomain || "")
    || !LOWER_HEX_64.test(credentials.audience || "")
    || !LOWER_HEX_64.test(credentials.subjectSha256 || "")) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.SETTINGS_INVALID);
  }
  const directory = mkdtempSync(join(root, "route-iq-public-settings-"));
  try {
    chmodSync(directory, 0o700);
    const path = join(directory, "settings.json");
    const descriptor = openSync(
      path,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW || 0),
      0o600
    );
    const payload = Buffer.from(JSON.stringify({
      [FOUNDER_SETTING_NAMES[0]]: credentials.teamDomain,
      [FOUNDER_SETTING_NAMES[1]]: credentials.audience,
      [FOUNDER_SETTING_NAMES[2]]: credentials.subjectSha256
    }), "utf8");
    try {
      writeFileSync(descriptor, payload);
    } finally {
      payload.fill(0);
      closeSync(descriptor);
    }
    chmodSync(path, 0o600);
    return Object.freeze({ directory, path });
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

export function removeFounderSettingsSecretFile(artifact) {
  if (!artifact?.directory || !artifact?.path) return;
  rmSync(artifact.directory, { recursive: true, force: true });
}

function parseEnvelope(body, kind) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(String(body || ""), "utf8");
  try {
    if (bytes.length < 2 || bytes.length > PUBLIC_WORKER_DEPLOYMENT_POLICY.responseByteLimit) {
      fail(PUBLIC_DEPLOYMENT_FAILURE.RESPONSE_INVALID);
    }
    const envelope = JSON.parse(bytes.toString("utf8"));
    if (!isPlainObject(envelope)
      || envelope.success !== true
      || !Array.isArray(envelope.errors)
      || envelope.errors.length !== 0
      || !Array.isArray(envelope.messages)
      || envelope.messages.length !== 0
      || !isPlainObject(envelope.result)) {
      fail(PUBLIC_DEPLOYMENT_FAILURE.RESPONSE_INVALID);
    }
    if (kind === "deployments") {
      const deployments = envelope.result.deployments;
      if (!Array.isArray(deployments) || deployments.length < 1 || deployments.length > 100) {
        fail(PUBLIC_DEPLOYMENT_FAILURE.RESPONSE_INVALID);
      }
      const active = deployments[0];
      if (!UUID.test(active?.id || "")
        || active?.strategy !== "percentage"
        || !Array.isArray(active?.versions)
        || active.versions.length !== 1
        || active.versions[0]?.percentage !== 100
        || !UUID.test(active.versions[0]?.version_id || "")) {
        fail(PUBLIC_DEPLOYMENT_FAILURE.TRAFFIC_SPLIT);
      }
      return Object.freeze({
        deploymentId: active.id,
        versionId: active.versions[0].version_id
      });
    }
    if (kind === "settings") {
      if (!Array.isArray(envelope.result.bindings) || envelope.result.bindings.length > 256) {
        fail(PUBLIC_DEPLOYMENT_FAILURE.RESPONSE_INVALID);
      }
      const bindings = envelope.result.bindings.map(binding => {
        if (!isPlainObject(binding)
          || !/^[A-Z][A-Z0-9_]{0,127}$/u.test(binding.name || "")
          || !/^[a-z][a-z0-9_]{0,63}$/u.test(binding.type || "")) {
          fail(PUBLIC_DEPLOYMENT_FAILURE.RESPONSE_INVALID);
        }
        return `${binding.name}:${binding.type}`;
      }).sort();
      if (new Set(bindings).size !== bindings.length) fail(PUBLIC_DEPLOYMENT_FAILURE.RESPONSE_INVALID);
      return Object.freeze(bindings);
    }
    fail(PUBLIC_DEPLOYMENT_FAILURE.RESPONSE_INVALID);
  } catch (error) {
    if (error instanceof PublicDeploymentPolicyError) throw error;
    fail(PUBLIC_DEPLOYMENT_FAILURE.RESPONSE_INVALID);
  } finally {
    if (!Buffer.isBuffer(body)) bytes.fill(0);
  }
}

async function boundedResponse(response, signal, phase) {
  const diagnostic = cloudflareReadPhaseDiagnostic(phase);
  let responseBody;
  try {
    responseBody = response?.body;
  } catch (error) {
    failCloudflareRead(error, phase, signal, PUBLIC_DEPLOYMENT_FAILURE.RESPONSE_BODY_FAILED);
  }
  if (!responseBody || typeof responseBody.getReader !== "function") {
    fail(PUBLIC_DEPLOYMENT_FAILURE.RESPONSE_INVALID, [diagnostic]);
  }
  let reader;
  try {
    reader = responseBody.getReader();
  } catch (error) {
    failCloudflareRead(error, phase, signal, PUBLIC_DEPLOYMENT_FAILURE.RESPONSE_BODY_FAILED);
  }
  const chunks = [];
  let total = 0;
  let result;
  let readFailure;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        fail(PUBLIC_DEPLOYMENT_FAILURE.RESPONSE_INVALID, [diagnostic]);
      }
      total += value.byteLength;
      if (total > PUBLIC_WORKER_DEPLOYMENT_POLICY.responseByteLimit) {
        fail(PUBLIC_DEPLOYMENT_FAILURE.RESPONSE_INVALID, [diagnostic]);
      }
      chunks.push(Buffer.from(value));
    }
    result = Buffer.concat(chunks, total);
  } catch (error) {
    readFailure = error;
  } finally {
    for (const chunk of chunks) chunk.fill(0);
    try {
      reader.releaseLock();
    } catch (error) {
      readFailure ||= error;
    }
  }
  if (readFailure) {
    failCloudflareRead(
      readFailure,
      phase,
      signal,
      PUBLIC_DEPLOYMENT_FAILURE.RESPONSE_BODY_FAILED
    );
  }
  return result;
}

async function fetchCloudflareJson(path, credentials, fetchImpl, phase, requestTimeoutMs) {
  if (!boundedString(credentials?.apiToken)
    || !ACCOUNT_ID.test(credentials?.accountId || "")
    || typeof fetchImpl !== "function"
    || !CLOUDFLARE_READ_PHASES.has(phase)
    || !Number.isSafeInteger(requestTimeoutMs)
    || requestTimeoutMs < 1
    || requestTimeoutMs > PUBLIC_WORKER_DEPLOYMENT_POLICY.requestTimeoutMs) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.CREDENTIAL_CONTEXT_INVALID);
  }
  const diagnostic = cloudflareReadPhaseDiagnostic(phase);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const headers = { Accept: "application/json", Authorization: `Bearer ${credentials.apiToken}` };
  let body;
  try {
    let response;
    try {
      response = await fetchImpl(new URL(path, PUBLIC_WORKER_DEPLOYMENT_POLICY.cloudflareApiOrigin), {
        method: "GET",
        headers,
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal
      });
    } catch (error) {
      failCloudflareRead(
        error,
        phase,
        controller.signal,
        PUBLIC_DEPLOYMENT_FAILURE.NETWORK_UNCERTAIN
      );
    }
    let redirected;
    let status;
    try {
      redirected = response.redirected;
      status = response.status;
    } catch (error) {
      failCloudflareRead(
        error,
        phase,
        controller.signal,
        PUBLIC_DEPLOYMENT_FAILURE.RESPONSE_INVALID
      );
    }
    if (!Number.isInteger(status) || status < 100 || status > 599) {
      fail(PUBLIC_DEPLOYMENT_FAILURE.RESPONSE_INVALID, [diagnostic]);
    }
    if (redirected || (status >= 300 && status < 400)) {
      fail(PUBLIC_DEPLOYMENT_FAILURE.REDIRECT_DENIED, [diagnostic, `HTTP_STATUS=${status}`]);
    }
    if (status !== 200) {
      fail(PUBLIC_DEPLOYMENT_FAILURE.HTTP_FAILED, [diagnostic, `HTTP_STATUS=${status}`]);
    }
    body = await boundedResponse(response, controller.signal, phase);
    return body;
  } finally {
    clearTimeout(timeout);
    delete headers.Authorization;
  }
}

async function fetchPublicWorkerStateWithTimeout(
  worker,
  credentials,
  fetchImpl,
  requestTimeoutMs
) {
  if (![PUBLIC_WORKER_DEPLOYMENT_POLICY.publicWorker, PUBLIC_WORKER_DEPLOYMENT_POLICY.privateWorker].includes(worker)) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.CREDENTIAL_CONTEXT_INVALID);
  }
  if (!Number.isSafeInteger(requestTimeoutMs)
    || requestTimeoutMs < 1
    || requestTimeoutMs > PUBLIC_WORKER_DEPLOYMENT_POLICY.requestTimeoutMs) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.CREDENTIAL_CONTEXT_INVALID);
  }
  const phasePrefix = worker === PUBLIC_WORKER_DEPLOYMENT_POLICY.publicWorker
    ? "PUBLIC"
    : "PRIVATE";
  const deploymentPhase = PUBLIC_CLOUDFLARE_READ_PHASE[`${phasePrefix}_DEPLOYMENTS`];
  const settingsPhase = PUBLIC_CLOUDFLARE_READ_PHASE[`${phasePrefix}_SETTINGS`];
  const base = `/client/v4/accounts/${credentials.accountId}/workers/scripts/${worker}`;
  let deploymentBody;
  let settingsBody;
  try {
    deploymentBody = await fetchCloudflareJson(
      `${base}/deployments`,
      credentials,
      fetchImpl,
      deploymentPhase,
      requestTimeoutMs
    );
    settingsBody = await fetchCloudflareJson(
      `${base}/settings`,
      credentials,
      fetchImpl,
      settingsPhase,
      requestTimeoutMs
    );
    let deployment;
    let bindings;
    try {
      deployment = parseEnvelope(deploymentBody, "deployments");
    } catch (error) {
      failCloudflareRead(error, deploymentPhase, undefined, PUBLIC_DEPLOYMENT_FAILURE.RESPONSE_INVALID);
    }
    try {
      bindings = parseEnvelope(settingsBody, "settings");
    } catch (error) {
      failCloudflareRead(error, settingsPhase, undefined, PUBLIC_DEPLOYMENT_FAILURE.RESPONSE_INVALID);
    }
    return Object.freeze({
      deployment,
      bindings
    });
  } finally {
    if (deploymentBody) deploymentBody.fill(0);
    if (settingsBody) settingsBody.fill(0);
  }
}

export async function fetchPublicWorkerState(
  worker,
  credentials,
  fetchImpl = globalThis.fetch
) {
  return fetchPublicWorkerStateWithTimeout(
    worker,
    credentials,
    fetchImpl,
    PUBLIC_WORKER_DEPLOYMENT_POLICY.requestTimeoutMs
  );
}

export async function fetchPublicWorkerStateForTest(
  worker,
  credentials,
  fetchImpl,
  requestTimeoutMs
) {
  if (!Number.isSafeInteger(requestTimeoutMs)
    || requestTimeoutMs < 1
    || requestTimeoutMs > PUBLIC_WORKER_DEPLOYMENT_POLICY.testRequestTimeoutMaximumMs) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.CREDENTIAL_CONTEXT_INVALID);
  }
  return fetchPublicWorkerStateWithTimeout(worker, credentials, fetchImpl, requestTimeoutMs);
}

function childEnvironment(credentials) {
  const environment = {
    CI: "true",
    NO_COLOR: "1",
    WRANGLER_SEND_METRICS: "false",
    [CREDENTIAL_NAMES.apiToken]: credentials.apiToken,
    [CREDENTIAL_NAMES.accountId]: credentials.accountId
  };
  for (const name of ["HOME", "PATH", "TMPDIR", "RUNNER_TEMP", "XDG_CONFIG_HOME"]) {
    if (boundedString(process.env[name])) environment[name] = process.env[name];
  }
  return environment;
}

export async function runBoundedPublicWrangler({
  root,
  mode,
  inputs,
  credentials,
  secretFile,
  spawnImpl = spawn
}) {
  const failureCode = mode === "dry-run"
    ? PUBLIC_DEPLOYMENT_FAILURE.DRY_RUN_FAILED
    : PUBLIC_DEPLOYMENT_FAILURE.DEPLOY_FAILED;
  const timeoutMs = mode === "dry-run"
    ? PUBLIC_WORKER_DEPLOYMENT_POLICY.dryRunTimeoutMs
    : PUBLIC_WORKER_DEPLOYMENT_POLICY.deployTimeoutMs;
  const environment = childEnvironment(credentials);
  const buffers = [];
  let outputBytes = 0;
  let child;
  let timedOut = false;
  let overflow = false;
  try {
    try {
      child = spawnImpl(process.execPath, buildPublicWranglerInvocation(mode, inputs, secretFile), {
        cwd: root,
        env: environment,
        stdio: ["ignore", "pipe", "pipe"]
      });
    } catch {
      fail(failureCode);
    }
    if (!child?.stdout || !child?.stderr || typeof child.kill !== "function") fail(failureCode);
    const capture = chunk => {
      const copy = Buffer.from(chunk);
      outputBytes += copy.length;
      if (outputBytes > PUBLIC_WORKER_DEPLOYMENT_POLICY.commandOutputByteLimit) {
        overflow = true;
        copy.fill(0);
        child.kill("SIGKILL");
        return;
      }
      buffers.push(copy);
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    const result = await new Promise(resolveResult => {
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 1_000).unref();
      }, timeoutMs);
      child.once("error", () => {
        clearTimeout(timer);
        resolveResult({ failed: true });
      });
      child.once("close", (exitCode, signal) => {
        clearTimeout(timer);
        resolveResult({ exitCode, signal });
      });
    });
    if (timedOut || overflow || result.failed || result.exitCode !== 0 || result.signal) fail(failureCode);
  } finally {
    for (const buffer of buffers) buffer.fill(0);
    environment[CREDENTIAL_NAMES.apiToken] = "";
    environment[CREDENTIAL_NAMES.accountId] = "";
  }
}

function sameState(left, right) {
  return left.deployment.deploymentId === right.deployment.deploymentId
    && left.deployment.versionId === right.deployment.versionId
    && JSON.stringify(left.bindings) === JSON.stringify(right.bindings);
}

function assertPublicBindingsPreserved(before, after) {
  const final = new Set(after);
  for (const binding of before) {
    if (!final.has(binding)) fail(PUBLIC_DEPLOYMENT_FAILURE.BINDING_REMOVED);
  }
  const required = [
    `${PUBLIC_WORKER_DEPLOYMENT_POLICY.crmBinding}:durable_object_namespace`,
    ...FOUNDER_SETTING_NAMES.map(name => `${name}:secret_text`)
  ];
  for (const binding of required) {
    if (!final.has(binding)) fail(PUBLIC_DEPLOYMENT_FAILURE.REQUIRED_BINDING_MISSING);
  }
}

export function assertPublicBindingsCanBePreserved(root, before) {
  let config;
  try {
    config = parseJsonc(readRegularFile(root, PUBLIC_WORKER_DEPLOYMENT_POLICY.publicConfig));
  } catch {
    fail(PUBLIC_DEPLOYMENT_FAILURE.CONFIG_INVALID);
  }
  const configured = new Set([
    ...(config.assets?.binding ? [`${config.assets.binding}:assets`] : []),
    ...Object.keys(config.vars || {}).map(name => `${name}:plain_text`),
    ...(config.kv_namespaces || []).map(binding => `${binding.binding}:kv_namespace`),
    ...(config.send_email || []).map(binding => `${binding.name}:send_email`),
    ...(config.durable_objects?.bindings || []).map(binding => `${binding.name}:durable_object_namespace`)
  ]);
  for (const binding of before) {
    const separator = binding.lastIndexOf(":");
    const type = separator < 0 ? "" : binding.slice(separator + 1);
    if (!configured.has(binding) && type !== "secret_text" && type !== "plain_text") {
      fail(PUBLIC_DEPLOYMENT_FAILURE.BINDING_REMOVED);
    }
  }
}

export async function runPublicDeploymentLifecycle({
  inputs,
  inspectIdentity,
  verifyConfiguration,
  verifyInitialBindings,
  fetchState,
  runWrangler
}) {
  if (typeof verifyInitialBindings !== "function") {
    fail(PUBLIC_DEPLOYMENT_FAILURE.CONFIG_INVALID);
  }
  verifyConfiguration();
  assertPublicRepositoryIdentity(await inspectIdentity(), inputs);
  const initialPublic = await fetchState(PUBLIC_WORKER_DEPLOYMENT_POLICY.publicWorker);
  const initialPrivate = await fetchState(PUBLIC_WORKER_DEPLOYMENT_POLICY.privateWorker);
  if (initialPublic.deployment.versionId !== inputs.currentPublicVersion) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.CURRENT_PUBLIC_VERSION_MISMATCH);
  }
  if (initialPrivate.deployment.versionId !== inputs.currentPrivateVersion) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.CURRENT_PRIVATE_VERSION_MISMATCH);
  }
  verifyInitialBindings(initialPublic.bindings);

  await runWrangler("dry-run");
  const boundaryPublic = await fetchState(PUBLIC_WORKER_DEPLOYMENT_POLICY.publicWorker);
  const boundaryPrivate = await fetchState(PUBLIC_WORKER_DEPLOYMENT_POLICY.privateWorker);
  if (!sameState(initialPublic, boundaryPublic) || !sameState(initialPrivate, boundaryPrivate)) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.CONCURRENT_DEPLOYMENT_DETECTED);
  }

  assertPublicRepositoryIdentity(await inspectIdentity(), inputs);
  await runWrangler("deploy");
  const finalPublic = await fetchState(PUBLIC_WORKER_DEPLOYMENT_POLICY.publicWorker);
  const finalPrivate = await fetchState(PUBLIC_WORKER_DEPLOYMENT_POLICY.privateWorker);
  if (finalPublic.deployment.versionId === initialPublic.deployment.versionId
    || finalPublic.deployment.deploymentId === initialPublic.deployment.deploymentId) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.POST_DEPLOY_VERSION_MISMATCH);
  }
  if (!sameState(initialPrivate, finalPrivate)) {
    fail(PUBLIC_DEPLOYMENT_FAILURE.PRIVATE_VERSION_CHANGED);
  }
  assertPublicBindingsPreserved(initialPublic.bindings, finalPublic.bindings);
  return Object.freeze({ status: "PUBLIC_WORKER_DEPLOYMENT_VERIFIED" });
}

export const publicFounderSettingNames = FOUNDER_SETTING_NAMES;
