import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

import {
  DeploymentPolicyError,
  PRIVATE_WORKER_DEPLOYMENT_POLICY,
  parseJsonc,
  verifyStaticDeploymentPolicy,
  verifyWranglerPin
} from "./github-actions-private-worker-deployment.mjs";
import {
  PUBLIC_CLOUDFLARE_READ_PHASE,
  PUBLIC_DEPLOYMENT_FAILURE,
  PUBLIC_WRANGLER_FAILURE_REASON,
  PUBLIC_WRANGLER_PHASE,
  PublicDeploymentPolicyError
} from "./github-actions-public-worker-deployment.mjs";
import {
  CLOUDFLARE_UNATTENDED_SMOKE_FAILURE,
  CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY,
  CloudflareUnattendedSmokeError
} from "../run-cloudflare-unattended-smoke.mjs";
import {
  canonicalizeGeneratedSourceMap,
  canonicalizeGeneratedWorkerSource
} from "./route-iq-public-forward-rollback.mjs";
import {
  buildRouteIqPrivateForwardRollbackCandidateV3,
  removeTransientNodeModulesPath
} from "../build-route-iq-private-forward-rollback-candidate-v3.mjs";
import {
  inspectRouteIqPrivateDashboardDeployAssets
} from "../sync-route-iq-private-dashboard-deploy-assets.mjs";
import {
  CLOUDFLARE_UNATTENDED_SMOKE_ENV,
  CLOUDFLARE_UNATTENDED_SMOKE_VERSION
} from "../../workers/infrastructure/cloudflare-unattended-smoke-contract.js";

export const PRIVATE_WORKFLOW_V2_POLICY = Object.freeze({
  contractVersion: "github-actions-private-worker-deployment-v2",
  contractPath: "workers/infrastructure/github-actions-private-worker-deployment-v2.json",
  qualificationWorkflowName: "Qualify Prometheus Private Worker v2",
  qualificationWorkflowPath: ".github/workflows/qualify-prometheus-private-worker-v2.yml",
  qualificationWorkflowRef:
    "PrometheusRouteIQ/prometheus-iq/.github/workflows/qualify-prometheus-private-worker-v2.yml@refs/heads/main",
  deploymentWorkflowName: "Deploy Prometheus Private Worker v2",
  deploymentWorkflowPath: ".github/workflows/deploy-prometheus-private-worker-v2.yml",
  deploymentWorkflowRef:
    "PrometheusRouteIQ/prometheus-iq/.github/workflows/deploy-prometheus-private-worker-v2.yml@refs/heads/main",
  qualificationRunnerPath: "scripts/run-github-actions-private-worker-qualification-v2.mjs",
  deploymentRunnerPath: "scripts/run-github-actions-private-worker-deployment-v2.mjs",
  smokeRunnerPath: "scripts/run-cloudflare-unattended-smoke.mjs",
  metadataRunnerPath: "scripts/run-github-actions-private-worker-artifact-metadata-v2.mjs",
  libraryPath: "scripts/lib/github-actions-private-worker-workflow-v2.mjs",
  verifierPath: "scripts/verify-github-actions-private-worker-workflow-v2.mjs",
  testPath: "tests/github-actions-private-worker-workflow-v2.test.mjs",
  runtimeGuardTestPath: "tests/cloudflare-unattended-runtime-guard.test.mjs",
  repository: PRIVATE_WORKER_DEPLOYMENT_POLICY.repository,
  branch: PRIVATE_WORKER_DEPLOYMENT_POLICY.branch,
  ref: PRIVATE_WORKER_DEPLOYMENT_POLICY.ref,
  refType: PRIVATE_WORKER_DEPLOYMENT_POLICY.refType,
  eventName: PRIVATE_WORKER_DEPLOYMENT_POLICY.eventName,
  founderActor: PRIVATE_WORKER_DEPLOYMENT_POLICY.founderActor,
  founderAuthorization: PRIVATE_WORKER_DEPLOYMENT_POLICY.founderAuthorization,
  firstRunAttempt: PRIVATE_WORKER_DEPLOYMENT_POLICY.firstRunAttempt,
  privateWorker: PRIVATE_WORKER_DEPLOYMENT_POLICY.privateWorker,
  publicWorker: PRIVATE_WORKER_DEPLOYMENT_POLICY.publicWorker,
  privateConfig: PRIVATE_WORKER_DEPLOYMENT_POLICY.privateConfig,
  privateAssets: "deploy/cloudflare-pages",
  runner: "ubuntu-24.04",
  architecture: "X64",
  nodeVersion: "24.4.1",
  wranglerVersion: PRIVATE_WORKER_DEPLOYMENT_POLICY.wranglerVersion,
  artifactNamePrefix: "prometheus-private-qualified",
  artifactRetentionDays: 30,
  manifestFile: "manifest.json",
  payloadDirectory: "payload",
  qualifiedConfigFile: "wrangler-qualified.json",
  generatedWorkerFile: "prometheus-iq-worker.js",
  generatedSourceMapFile: "prometheus-iq-worker.js.map",
  forwardDirectory: "forward",
  rollbackDirectory: "rollback",
  rollbackIdentityDirectory: "identity",
  rollbackDeployableDirectory: "deployable",
  githubApiOrigin: "https://api.github.com",
  githubResponseByteLimit: 65_536,
  githubRequestTimeoutMs: 10_000,
  bootstrapGuardlessPrivateVersion: "b8cba784-dfd3-4f8e-8356-816cccf6aecc",
  verifiedGuardlessRollbackPrivateVersion: "e303f3ca-8d2b-4248-85a5-eaad938219a9",
  continuityBaseline: Object.freeze({
    candidateCommit: "3bd4b1a120672f1ecbaf3b4b245106aee095f023",
    candidateTree: "da156b1ffe2ccb0b4071dae747fe821d7eb45854",
    qualificationArtifactContentTreeSha256:
      "de7b35909f9bd1bf8f15c8fe605cf494a5f39171e6b2bdf822e60031c590b0e7",
    deployParitySha256: "35a564e4f3fed2961d7658bac57cc4ce66cb9c103e4ab03d5b17fff836ca7731",
    forwardPayloadSha256: "81bb2e724ce7433c591f7241c043b69ea329a5ecd15fe0045ed58bb37d77cb7c",
    rollbackBundleSha256: "8f700c7c5f548b66795211a415ec63da51316b86a2685ae77c6618d1fe798007"
  })
});

export const PRIVATE_WORKFLOW_V2_FAILURE = Object.freeze({
  INPUT_INVALID: "INPUT_INVALID",
  CONTEXT_INVALID: "CONTEXT_INVALID",
  REPOSITORY_INVALID: "REPOSITORY_INVALID",
  TOOLCHAIN_MISMATCH: "TOOLCHAIN_MISMATCH",
  ARTIFACT_INVALID: "ARTIFACT_INVALID",
  ARTIFACT_TAMPERED: "ARTIFACT_TAMPERED",
  MANIFEST_MISMATCH: "MANIFEST_MISMATCH",
  QUALIFICATION_FAILED: "QUALIFICATION_FAILED",
  GITHUB_METADATA_INVALID: "GITHUB_METADATA_INVALID",
  DEPLOYMENT_BOUNDARY_INVALID: "DEPLOYMENT_BOUNDARY_INVALID",
  DEPLOYMENT_ATTEMPT_LIMIT: "DEPLOYMENT_ATTEMPT_LIMIT",
  PRODUCTION_PREREQUISITE_MISMATCH: "PRODUCTION_PREREQUISITE_MISMATCH",
  BINDING_PRESERVATION_FAILED: "BINDING_PRESERVATION_FAILED",
  PUBLIC_WORKER_CHANGED: "PUBLIC_WORKER_CHANGED",
  PRIVATE_WORKER_UNCHANGED: "PRIVATE_WORKER_UNCHANGED",
  SMOKE_INVALID: "SMOKE_INVALID",
  RUNTIME_GUARD_CONFIGURATION_INVALID: "RUNTIME_GUARD_CONFIGURATION_INVALID",
  RUNTIME_GUARD_WORKSPACE_INVALID: "RUNTIME_GUARD_WORKSPACE_INVALID",
  ROLLBACK_BOUNDARY_INVALID: "ROLLBACK_BOUNDARY_INVALID",
  EVIDENCE_INVALID: "EVIDENCE_INVALID",
  REQUIRED_PROTECTED_SECRET_NAMES_MISSING: "REQUIRED_PROTECTED_SECRET_NAMES_MISSING"
});

export const PRIVATE_WORKFLOW_V2_PHASE = Object.freeze({
  DEPLOYMENT_NOT_BEGUN: "DEPLOYMENT_NOT_BEGUN",
  LOCAL_PREFLIGHT_PASSED: "LOCAL_PREFLIGHT_PASSED",
  PRODUCTION_PREREQUISITES_PASSED: "PRODUCTION_PREREQUISITES_PASSED",
  PREDEPLOYMENT_SMOKE_PASSED: "PREDEPLOYMENT_SMOKE_PASSED",
  AUTHORIZATION_CONSUMED: "AUTHORIZATION_CONSUMED",
  DEPLOYMENT_REQUEST_COMPLETED: "DEPLOYMENT_REQUEST_COMPLETED",
  POST_DEPLOYMENT_VERIFIED: "POST_DEPLOYMENT_VERIFIED",
  POSTDEPLOYMENT_SMOKE_PASSED: "POSTDEPLOYMENT_SMOKE_PASSED",
  CRITICAL_FAILURE_DETECTED: "CRITICAL_FAILURE_DETECTED",
  ROLLBACK_REQUEST_BEGUN: "ROLLBACK_REQUEST_BEGUN",
  ROLLBACK_VERIFIED: "ROLLBACK_VERIFIED"
});

const SHA40 = /^[0-9a-f]{40}$/u;
const SHA64 = /^[0-9a-f]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const BATCH_ID = /^BATCH-[0-9]{8}-[0-9]{3}$/u;
const POSITIVE_INTEGER = /^[1-9][0-9]{0,15}$/u;
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_PAYLOAD_BYTES = 256 * 1024 * 1024;
const COMMAND_TIMEOUT_MS = 300_000;
const ROLLBACK_MANIFEST = "route-iq-private-forward-rollback-build-manifest-v3.json";
const PHASES = new Set(Object.values(PRIVATE_WORKFLOW_V2_PHASE));
const QUALIFICATION_INPUT_NAMES = Object.freeze([
  "candidate_commit",
  "candidate_tree",
  "batch_id",
  "current_public_version",
  "current_private_version"
]);
const DEPLOYMENT_INPUT_NAMES = Object.freeze([
  "approved_commit",
  "approved_tree",
  "batch_id",
  "current_public_version",
  "current_private_version",
  "qualification_run_id",
  "qualification_artifact_id",
  "qualification_artifact_zip_sha256",
  "qualified_content_tree_sha256",
  "qualified_manifest_sha256",
  "workflow_contract_sha256",
  "rollback_contract_sha256",
  "rollback_bundle_sha256",
  "founder_authorization"
]);
const SECRET_ENVIRONMENT_NAMES = Object.freeze([
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_ACCESS_CLIENT_ID",
  "CLOUDFLARE_ACCESS_CLIENT_SECRET",
  "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_TEAM_DOMAIN",
  "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_AUDIENCE"
]);
const RUNTIME_GUARD_PROTECTED_ENVIRONMENT_NAMES = Object.freeze([
  "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_TEAM_DOMAIN",
  "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_AUDIENCE"
]);
export const PRIVATE_WORKFLOW_V2_RUNTIME_GUARD_BINDINGS = Object.freeze([
  CLOUDFLARE_UNATTENDED_SMOKE_ENV.enabled,
  CLOUDFLARE_UNATTENDED_SMOKE_ENV.teamDomain,
  CLOUDFLARE_UNATTENDED_SMOKE_ENV.audience,
  CLOUDFLARE_UNATTENDED_SMOKE_ENV.serviceTokenClientId,
  CLOUDFLARE_UNATTENDED_SMOKE_VERSION.binding
]);
const PUBLIC_FAILURE_CODES = new Set(Object.values(PUBLIC_DEPLOYMENT_FAILURE));
const PUBLIC_READ_PHASES = new Set(Object.values(PUBLIC_CLOUDFLARE_READ_PHASE));
const PUBLIC_WRANGLER_PHASES = new Set(Object.values(PUBLIC_WRANGLER_PHASE));
const PUBLIC_WRANGLER_REASONS = new Set(Object.values(PUBLIC_WRANGLER_FAILURE_REASON));
const GOVERNED_SOURCE_PATHS = Object.freeze([
  PRIVATE_WORKFLOW_V2_POLICY.contractPath,
  PRIVATE_WORKFLOW_V2_POLICY.qualificationWorkflowPath,
  PRIVATE_WORKFLOW_V2_POLICY.deploymentWorkflowPath,
  PRIVATE_WORKFLOW_V2_POLICY.qualificationRunnerPath,
  PRIVATE_WORKFLOW_V2_POLICY.deploymentRunnerPath,
  PRIVATE_WORKFLOW_V2_POLICY.smokeRunnerPath,
  PRIVATE_WORKFLOW_V2_POLICY.metadataRunnerPath,
  PRIVATE_WORKFLOW_V2_POLICY.libraryPath,
  PRIVATE_WORKFLOW_V2_POLICY.verifierPath,
  PRIVATE_WORKFLOW_V2_POLICY.testPath,
  PRIVATE_WORKFLOW_V2_POLICY.runtimeGuardTestPath
]);

export class PrivateWorkflowV2Error extends Error {
  constructor(code) {
    super(code);
    this.name = "PrivateWorkflowV2Error";
    this.code = code;
  }
}

function fail(code) {
  throw new PrivateWorkflowV2Error(code);
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

export function canonicalPrivateWorkflowJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalPrivateWorkflowJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map(key => `${JSON.stringify(key)}:${canonicalPrivateWorkflowJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function safeRelativeName(root, path) {
  const name = relative(root, path).split("\\").join("/");
  if (!name || name === ".." || name.startsWith("../") || isAbsolute(name) || name.includes("\0")) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
  return name;
}

function regularFiles(root, current = root, output = []) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    const stats = lstatSync(path);
    if (stats.isSymbolicLink()) fail(PRIVATE_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
    if (entry.isDirectory()) regularFiles(root, path, output);
    else if (entry.isFile()) {
      if (stats.size > MAX_FILE_BYTES) fail(PRIVATE_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
      output.push(path);
    } else fail(PRIVATE_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
  const sorted = output.sort((left, right) => safeRelativeName(root, left).localeCompare(
    safeRelativeName(root, right)
  ));
  if (current === root
    && sorted.reduce((total, path) => total + lstatSync(path).size, 0) > MAX_PAYLOAD_BYTES) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
  return sorted;
}

export function sha256PrivateWorkflowFile(path) {
  const stats = lstatSync(path);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size > MAX_FILE_BYTES) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function fileManifest(directory) {
  return Object.freeze(regularFiles(directory).map(path => {
    const stats = lstatSync(path);
    return Object.freeze({
      path: safeRelativeName(directory, path),
      bytes: stats.size,
      sha256: sha256PrivateWorkflowFile(path)
    });
  }));
}

export function hashPrivateWorkflowDirectory(directory, {
  exclude = () => false
} = {}) {
  const digest = createHash("sha256");
  for (const entry of fileManifest(directory)) {
    if (exclude(entry.path)) continue;
    digest.update(entry.path, "utf8");
    digest.update("\0", "utf8");
    digest.update(String(entry.bytes), "utf8");
    digest.update("\0", "utf8");
    digest.update(entry.sha256, "utf8");
    digest.update("\0", "utf8");
  }
  return digest.digest("hex");
}

export function hashPrivateWorkflowRawDirectory(directory, {
  exclude = () => false
} = {}) {
  const digest = createHash("sha256");
  const paths = regularFiles(directory).sort((left, right) => {
    const leftName = safeRelativeName(directory, left);
    const rightName = safeRelativeName(directory, right);
    return leftName < rightName ? -1 : leftName > rightName ? 1 : 0;
  });
  for (const path of paths) {
    const name = safeRelativeName(directory, path);
    if (exclude(name)) continue;
    digest.update(name, "utf8");
    digest.update("\0", "utf8");
    digest.update(readFileSync(path));
    digest.update("\0", "utf8");
  }
  return digest.digest("hex");
}

function readJson(path) {
  try {
    const stats = lstatSync(path);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size < 2 || stats.size > MAX_FILE_BYTES) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
    }
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error instanceof PrivateWorkflowV2Error) throw error;
    fail(PRIVATE_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
}

function parseDispatch(value) {
  try {
    return JSON.parse(value || "");
  } catch {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
}

function validateContext(environment, { workflowName, workflowRef, candidateCommit, qualification }) {
  if (environment.GITHUB_REPOSITORY !== PRIVATE_WORKFLOW_V2_POLICY.repository
    || environment.GITHUB_REF !== PRIVATE_WORKFLOW_V2_POLICY.ref
    || environment.GITHUB_REF_NAME !== PRIVATE_WORKFLOW_V2_POLICY.branch
    || environment.GITHUB_REF_TYPE !== PRIVATE_WORKFLOW_V2_POLICY.refType
    || environment.GITHUB_EVENT_NAME !== PRIVATE_WORKFLOW_V2_POLICY.eventName
    || environment.GITHUB_ACTOR !== PRIVATE_WORKFLOW_V2_POLICY.founderActor
    || environment.GITHUB_TRIGGERING_ACTOR !== PRIVATE_WORKFLOW_V2_POLICY.founderActor
    || environment.GITHUB_WORKFLOW !== workflowName
    || environment.GITHUB_WORKFLOW_REF !== workflowRef
    || environment.GITHUB_RUN_ATTEMPT !== PRIVATE_WORKFLOW_V2_POLICY.firstRunAttempt
    || (qualification && environment.GITHUB_SHA !== candidateCommit)) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.CONTEXT_INVALID);
  }
}

function baseInputs(environment, prefix) {
  return Object.freeze({
    commit: environment[`PROMETHEUS_${prefix}_COMMIT`],
    tree: environment[`PROMETHEUS_${prefix}_TREE`],
    batchId: environment.PROMETHEUS_BATCH_ID,
    currentPublicVersion: environment.PROMETHEUS_CURRENT_PUBLIC_VERSION,
    currentPrivateVersion: environment.PROMETHEUS_CURRENT_PRIVATE_VERSION
  });
}

function validBaseInputs(values) {
  return SHA40.test(values.commit || "")
    && SHA40.test(values.tree || "")
    && BATCH_ID.test(values.batchId || "")
    && UUID.test(values.currentPublicVersion || "")
    && UUID.test(values.currentPrivateVersion || "");
}

export function validatePrivateV2QualificationInputs(environment) {
  const values = baseInputs(environment, "CANDIDATE");
  if (!validBaseInputs(values)) fail(PRIVATE_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  const dispatch = parseDispatch(environment.PROMETHEUS_DISPATCH_INPUTS_JSON);
  if (!exactKeys(dispatch, QUALIFICATION_INPUT_NAMES)
    || dispatch.candidate_commit !== values.commit
    || dispatch.candidate_tree !== values.tree
    || dispatch.batch_id !== values.batchId
    || dispatch.current_public_version !== values.currentPublicVersion
    || dispatch.current_private_version !== values.currentPrivateVersion) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
  validateContext(environment, {
    workflowName: PRIVATE_WORKFLOW_V2_POLICY.qualificationWorkflowName,
    workflowRef: PRIVATE_WORKFLOW_V2_POLICY.qualificationWorkflowRef,
    candidateCommit: values.commit,
    qualification: true
  });
  return Object.freeze({
    candidateCommit: values.commit,
    candidateTree: values.tree,
    batchId: values.batchId,
    currentPublicVersion: values.currentPublicVersion,
    currentPrivateVersion: values.currentPrivateVersion
  });
}

export function validatePrivateV2DeploymentInputs(environment) {
  const values = baseInputs(environment, "APPROVED");
  const output = Object.freeze({
    approvedCommit: values.commit,
    approvedTree: values.tree,
    batchId: values.batchId,
    currentPublicVersion: values.currentPublicVersion,
    currentPrivateVersion: values.currentPrivateVersion,
    qualificationRunId: environment.PROMETHEUS_QUALIFICATION_RUN_ID,
    qualificationArtifactId: environment.PROMETHEUS_QUALIFICATION_ARTIFACT_ID,
    qualificationArtifactZipSha256: environment.PROMETHEUS_QUALIFICATION_ARTIFACT_ZIP_SHA256,
    qualifiedContentTreeSha256: environment.PROMETHEUS_QUALIFIED_CONTENT_TREE_SHA256,
    qualifiedManifestSha256: environment.PROMETHEUS_QUALIFIED_MANIFEST_SHA256,
    workflowContractSha256: environment.PROMETHEUS_WORKFLOW_CONTRACT_SHA256,
    rollbackContractSha256: environment.PROMETHEUS_ROLLBACK_CONTRACT_SHA256,
    rollbackBundleSha256: environment.PROMETHEUS_ROLLBACK_BUNDLE_SHA256,
    founderAuthorization: environment.PROMETHEUS_FOUNDER_AUTHORIZATION
  });
  if (!validBaseInputs(values)
    || !POSITIVE_INTEGER.test(output.qualificationRunId || "")
    || !POSITIVE_INTEGER.test(output.qualificationArtifactId || "")
    || ![
      output.qualificationArtifactZipSha256,
      output.qualifiedContentTreeSha256,
      output.qualifiedManifestSha256,
      output.workflowContractSha256,
      output.rollbackContractSha256,
      output.rollbackBundleSha256
    ].every(value => SHA64.test(value || ""))
    || output.founderAuthorization !== PRIVATE_WORKFLOW_V2_POLICY.founderAuthorization) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
  const dispatch = parseDispatch(environment.PROMETHEUS_DISPATCH_INPUTS_JSON);
  if (!exactKeys(dispatch, DEPLOYMENT_INPUT_NAMES)
    || dispatch.approved_commit !== output.approvedCommit
    || dispatch.approved_tree !== output.approvedTree
    || dispatch.batch_id !== output.batchId
    || dispatch.current_public_version !== output.currentPublicVersion
    || dispatch.current_private_version !== output.currentPrivateVersion
    || dispatch.qualification_run_id !== output.qualificationRunId
    || dispatch.qualification_artifact_id !== output.qualificationArtifactId
    || dispatch.qualification_artifact_zip_sha256 !== output.qualificationArtifactZipSha256
    || dispatch.qualified_content_tree_sha256 !== output.qualifiedContentTreeSha256
    || dispatch.qualified_manifest_sha256 !== output.qualifiedManifestSha256
    || dispatch.workflow_contract_sha256 !== output.workflowContractSha256
    || dispatch.rollback_contract_sha256 !== output.rollbackContractSha256
    || dispatch.rollback_bundle_sha256 !== output.rollbackBundleSha256
    || dispatch.founder_authorization !== output.founderAuthorization) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
  validateContext(environment, {
    workflowName: PRIVATE_WORKFLOW_V2_POLICY.deploymentWorkflowName,
    workflowRef: PRIVATE_WORKFLOW_V2_POLICY.deploymentWorkflowRef,
    candidateCommit: output.approvedCommit,
    qualification: false
  });
  return output;
}

export function requirePrivateV2ProtectedSecretNames(environment) {
  if (!environment || typeof environment !== "object") {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.REQUIRED_PROTECTED_SECRET_NAMES_MISSING);
  }
  const missing = SECRET_ENVIRONMENT_NAMES.filter(name => (
    typeof environment[name] !== "string" || environment[name].length === 0
  ));
  if (missing.length > 0) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.REQUIRED_PROTECTED_SECRET_NAMES_MISSING);
  }
  return Object.freeze({
    status: "PRIVATE_WORKER_V2_REQUIRED_PROTECTED_SECRET_NAMES_PRESENT"
  });
}

function boundedRuntimeGuardValue(value, pattern) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 512
    && value.trim() === value
    && pattern.test(value);
}

function normalizeRuntimeGuardTeamDomain(value) {
  if (!boundedRuntimeGuardValue(value, /^[\u0021-\u007e]+$/u)) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_CONFIGURATION_INVALID);
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:"
      || !/^[a-z0-9-]+\.cloudflareaccess\.com$/u.test(url.hostname)
      || url.origin !== value
      || url.pathname !== "/"
      || url.search
      || url.hash
      || url.username
      || url.password
      || url.port) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_CONFIGURATION_INVALID);
    }
    return url.origin;
  } catch (error) {
    if (error instanceof PrivateWorkflowV2Error) throw error;
    fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_CONFIGURATION_INVALID);
  }
}

export function takePrivateV2RuntimeGuardSettings(environment, serviceTokenClientId) {
  if (!environment || typeof environment !== "object") {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_CONFIGURATION_INVALID);
  }
  const settings = {
    teamDomain: environment[RUNTIME_GUARD_PROTECTED_ENVIRONMENT_NAMES[0]],
    audience: environment[RUNTIME_GUARD_PROTECTED_ENVIRONMENT_NAMES[1]],
    serviceTokenClientId
  };
  for (const name of RUNTIME_GUARD_PROTECTED_ENVIRONMENT_NAMES) delete environment[name];
  try {
    settings.teamDomain = normalizeRuntimeGuardTeamDomain(settings.teamDomain);
    if (!boundedRuntimeGuardValue(settings.audience, /^[A-Za-z0-9._:-]+$/u)
      || !boundedRuntimeGuardValue(
        settings.serviceTokenClientId,
        /^[a-z0-9]{32,64}\.access$/u
      )) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_CONFIGURATION_INVALID);
    }
    return settings;
  } catch (error) {
    scrubPrivateV2RuntimeGuardSettings(settings);
    throw error;
  }
}

export function scrubPrivateV2RuntimeGuardSettings(settings) {
  if (!settings || typeof settings !== "object") return;
  settings.teamDomain = "";
  settings.audience = "";
  settings.serviceTokenClientId = "";
}

function runtimeGuardVariables(settings) {
  if (!settings
    || !boundedRuntimeGuardValue(settings.teamDomain, /^[\u0021-\u007e]+$/u)
    || normalizeRuntimeGuardTeamDomain(settings.teamDomain) !== settings.teamDomain
    || !boundedRuntimeGuardValue(settings.audience, /^[A-Za-z0-9._:-]+$/u)
    || !boundedRuntimeGuardValue(
      settings.serviceTokenClientId,
      /^[a-z0-9]{32,64}\.access$/u
    )) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_CONFIGURATION_INVALID);
  }
  return Object.freeze({
    [CLOUDFLARE_UNATTENDED_SMOKE_ENV.enabled]: "ON",
    [CLOUDFLARE_UNATTENDED_SMOKE_ENV.teamDomain]: settings.teamDomain,
    [CLOUDFLARE_UNATTENDED_SMOKE_ENV.audience]: settings.audience,
    [CLOUDFLARE_UNATTENDED_SMOKE_ENV.serviceTokenClientId]:
      settings.serviceTokenClientId
  });
}

function currentOwner(stats) {
  return typeof process.getuid !== "function" || stats.uid === process.getuid();
}

function requireOwnerOnlyDirectory(path) {
  try {
    const stats = lstatSync(path);
    if (!stats.isDirectory()
      || stats.isSymbolicLink()
      || !currentOwner(stats)
      || (stats.mode & 0o777) !== 0o700) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID);
    }
  } catch (error) {
    if (error instanceof PrivateWorkflowV2Error) throw error;
    fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID);
  }
}

function requireOwnerOnlyConfig(path) {
  try {
    const stats = lstatSync(path);
    if (!stats.isFile()
      || stats.isSymbolicLink()
      || stats.nlink !== 1
      || !currentOwner(stats)
      || (stats.mode & 0o077) !== 0
      || (stats.mode & 0o700) !== 0o600) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID);
    }
  } catch (error) {
    if (error instanceof PrivateWorkflowV2Error) throw error;
    fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID);
  }
}

function requireSourceDeployableDirectory(path) {
  try {
    const stats = lstatSync(path);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID);
    }
    const entries = readdirSync(path).sort();
    if (JSON.stringify(entries) !== JSON.stringify([
      "assets",
      PRIVATE_WORKFLOW_V2_POLICY.qualifiedConfigFile,
      "worker"
    ].sort())) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID);
    }
  } catch (error) {
    if (error instanceof PrivateWorkflowV2Error) throw error;
    fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID);
  }
}

function runtimeQualifiedConfig(sourceConfigPath, settings) {
  const config = readJson(sourceConfigPath);
  validatePrivateConfig(config, {
    qualified: true,
    rollback: Array.isArray(config.assets?.run_worker_first)
  });
  if (PRIVATE_WORKFLOW_V2_RUNTIME_GUARD_BINDINGS.some(name => (
    Object.hasOwn(config.vars || {}, name)
  ))) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_CONFIGURATION_INVALID);
  }
  config.vars = {
    ...(config.vars || {}),
    ...runtimeGuardVariables(settings)
  };
  return `${canonicalPrivateWorkflowJson(config)}\n`;
}

function copyPrivateV2RuntimeTarget({
  sourceDirectory,
  destinationDirectory,
  settings
}) {
  requireSourceDeployableDirectory(sourceDirectory);
  const sourceConfig = join(
    sourceDirectory,
    PRIVATE_WORKFLOW_V2_POLICY.qualifiedConfigFile
  );
  const sourceConfigSha256 = sha256PrivateWorkflowFile(sourceConfig);
  const sourceAssets = join(sourceDirectory, "assets");
  const sourceWorker = join(sourceDirectory, "worker");
  const sourceAssetsSha256 = hashPrivateWorkflowRawDirectory(sourceAssets);
  const sourceWorkerSha256 = hashPrivateWorkflowRawDirectory(sourceWorker);
  try {
    mkdirSync(destinationDirectory, { recursive: false, mode: 0o700 });
    chmodSync(destinationDirectory, 0o700);
    requireOwnerOnlyDirectory(destinationDirectory);
    cpSync(sourceAssets, join(destinationDirectory, "assets"), {
      recursive: true,
      errorOnExist: true,
      force: false,
      dereference: false
    });
    cpSync(sourceWorker, join(destinationDirectory, "worker"), {
      recursive: true,
      errorOnExist: true,
      force: false,
      dereference: false
    });
    if (hashPrivateWorkflowRawDirectory(join(destinationDirectory, "assets"))
        !== sourceAssetsSha256
      || hashPrivateWorkflowRawDirectory(join(destinationDirectory, "worker"))
        !== sourceWorkerSha256) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID);
    }
    const runtimeConfig = join(
      destinationDirectory,
      PRIVATE_WORKFLOW_V2_POLICY.qualifiedConfigFile
    );
    writeExclusive(runtimeConfig, runtimeQualifiedConfig(sourceConfig, settings));
    chmodSync(runtimeConfig, 0o600);
    requireOwnerOnlyConfig(runtimeConfig);
    if (sha256PrivateWorkflowFile(sourceConfig) !== sourceConfigSha256) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.ARTIFACT_TAMPERED);
    }
    return Object.freeze({
      directory: destinationDirectory,
      assetsSha256: sourceAssetsSha256,
      workerSha256: sourceWorkerSha256,
      sourceConfigSha256
    });
  } catch (error) {
    if (error instanceof PrivateWorkflowV2Error) throw error;
    fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID);
  }
}

const PRIVATE_V2_WRANGLER_SCRATCH_DIRECTORY = "wrangler-scratch";
const PRIVATE_V2_WRANGLER_OUTDIR_NAMES = Object.freeze({
  "dry-run": "dry-run",
  deploy: "deploy",
  rollback: "rollback"
});

function createPrivateV2WranglerScratch(workspace) {
  const scratchDirectory = join(workspace, PRIVATE_V2_WRANGLER_SCRATCH_DIRECTORY);
  try {
    mkdirSync(scratchDirectory, { recursive: false, mode: 0o700 });
    chmodSync(scratchDirectory, 0o700);
    requireOwnerOnlyDirectory(scratchDirectory);
    const wranglerOutdirs = {};
    for (const [mode, name] of Object.entries(PRIVATE_V2_WRANGLER_OUTDIR_NAMES)) {
      const outdir = join(scratchDirectory, name);
      mkdirSync(outdir, { recursive: false, mode: 0o700 });
      chmodSync(outdir, 0o700);
      requireOwnerOnlyDirectory(outdir);
      wranglerOutdirs[mode] = outdir;
    }
    return Object.freeze({
      scratchDirectory,
      wranglerOutdirs: Object.freeze(wranglerOutdirs)
    });
  } catch (error) {
    if (error instanceof PrivateWorkflowV2Error) throw error;
    fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID);
  }
}

function privateV2WranglerScratchLayout(runtimeRelease) {
  if (!runtimeRelease
    || typeof runtimeRelease.forwardDirectory !== "string"
    || typeof runtimeRelease.rollbackDirectory !== "string"
    || typeof runtimeRelease.scratchDirectory !== "string"
    || !runtimeRelease.wranglerOutdirs
    || typeof runtimeRelease.wranglerOutdirs !== "object") {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID);
  }
  const workspace = dirname(resolve(runtimeRelease.forwardDirectory));
  const scratchDirectory = join(workspace, PRIVATE_V2_WRANGLER_SCRATCH_DIRECTORY);
  const expectedOutdirs = Object.fromEntries(
    Object.entries(PRIVATE_V2_WRANGLER_OUTDIR_NAMES).map(([mode, name]) => [
      mode,
      join(scratchDirectory, name)
    ])
  );
  if (resolve(runtimeRelease.forwardDirectory) !== join(workspace, "forward")
    || resolve(runtimeRelease.rollbackDirectory) !== join(workspace, "rollback")
    || resolve(runtimeRelease.scratchDirectory) !== scratchDirectory
    || Object.keys(runtimeRelease.wranglerOutdirs).sort().join("\0")
      !== Object.keys(expectedOutdirs).sort().join("\0")
    || Object.values(runtimeRelease.wranglerOutdirs).some(value => typeof value !== "string")
    || Object.entries(expectedOutdirs).some(([mode, outdir]) => (
      resolve(runtimeRelease.wranglerOutdirs[mode]) !== outdir
    ))) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID);
  }
  return Object.freeze({
    workspace,
    scratchDirectory,
    wranglerOutdirs: Object.freeze(expectedOutdirs)
  });
}

function verifyPrivateV2WranglerScratch(runtimeRelease) {
  const layout = privateV2WranglerScratchLayout(runtimeRelease);
  requireOwnerOnlyDirectory(layout.workspace);
  requireOwnerOnlyDirectory(layout.scratchDirectory);
  if (JSON.stringify(readdirSync(layout.workspace).sort())
      !== JSON.stringify(["forward", "rollback", PRIVATE_V2_WRANGLER_SCRATCH_DIRECTORY].sort())
    || JSON.stringify(readdirSync(layout.scratchDirectory).sort())
      !== JSON.stringify(Object.values(PRIVATE_V2_WRANGLER_OUTDIR_NAMES).sort())) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID);
  }
  for (const outdir of Object.values(layout.wranglerOutdirs)) {
    requireOwnerOnlyDirectory(outdir);
  }
  return layout;
}

export function createPrivateV2RuntimeWorkspace(baseDirectory) {
  try {
    const defaultBase = baseDirectory === undefined;
    const candidate = defaultBase ? tmpdir() : baseDirectory;
    if (typeof candidate !== "string" || candidate.length < 1) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID);
    }
    const base = defaultBase ? realpathSync(candidate) : resolve(candidate);
    const baseStats = lstatSync(base);
    if (!baseStats.isDirectory() || baseStats.isSymbolicLink()) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID);
    }
    const workspace = mkdtempSync(join(base, "prometheus-private-runtime-v2-"));
    chmodSync(workspace, 0o700);
    requireOwnerOnlyDirectory(workspace);
    return workspace;
  } catch (error) {
    if (error instanceof PrivateWorkflowV2Error) throw error;
    fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID);
  }
}

export function createPrivateV2RuntimeRelease({
  workspace,
  verifiedRelease,
  settings
}) {
  requireOwnerOnlyDirectory(workspace);
  if (!verifiedRelease
    || typeof verifiedRelease.forwardDirectory !== "string"
    || typeof verifiedRelease.rollbackDirectory !== "string") {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID);
  }
  const forward = copyPrivateV2RuntimeTarget({
    sourceDirectory: verifiedRelease.forwardDirectory,
    destinationDirectory: join(workspace, "forward"),
    settings
  });
  const rollback = copyPrivateV2RuntimeTarget({
    sourceDirectory: verifiedRelease.rollbackDirectory,
    destinationDirectory: join(workspace, "rollback"),
    settings
  });
  const scratch = createPrivateV2WranglerScratch(workspace);
  return Object.freeze({
    status: "PRIVATE_WORKER_V2_RUNTIME_GUARD_CONFIGURED",
    forwardDirectory: forward.directory,
    rollbackDirectory: rollback.directory,
    sourceForwardDirectory: verifiedRelease.forwardDirectory,
    sourceRollbackDirectory: verifiedRelease.rollbackDirectory,
    forwardAssetsSha256: forward.assetsSha256,
    forwardWorkerSha256: forward.workerSha256,
    rollbackAssetsSha256: rollback.assetsSha256,
    rollbackWorkerSha256: rollback.workerSha256,
    scratchDirectory: scratch.scratchDirectory,
    wranglerOutdirs: scratch.wranglerOutdirs
  });
}

function verifyPrivateV2RuntimeTarget({
  sourceDirectory,
  runtimeDirectory,
  expectedAssetsSha256,
  expectedWorkerSha256,
  settings
}) {
  requireSourceDeployableDirectory(sourceDirectory);
  requireSourceDeployableDirectory(runtimeDirectory);
  requireOwnerOnlyDirectory(runtimeDirectory);
  const runtimeConfig = join(
    runtimeDirectory,
    PRIVATE_WORKFLOW_V2_POLICY.qualifiedConfigFile
  );
  requireOwnerOnlyConfig(runtimeConfig);
  if (hashPrivateWorkflowRawDirectory(join(sourceDirectory, "assets"))
      !== expectedAssetsSha256
    || hashPrivateWorkflowRawDirectory(join(runtimeDirectory, "assets"))
      !== expectedAssetsSha256
    || hashPrivateWorkflowRawDirectory(join(sourceDirectory, "worker"))
      !== expectedWorkerSha256
    || hashPrivateWorkflowRawDirectory(join(runtimeDirectory, "worker"))
      !== expectedWorkerSha256
    || readFileSync(runtimeConfig, "utf8") !== runtimeQualifiedConfig(
      join(sourceDirectory, PRIVATE_WORKFLOW_V2_POLICY.qualifiedConfigFile),
      settings
    )) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID);
  }
}

export function verifyPrivateV2RuntimeRelease(runtimeRelease, settings) {
  if (!runtimeRelease) fail(PRIVATE_WORKFLOW_V2_FAILURE.RUNTIME_GUARD_WORKSPACE_INVALID);
  verifyPrivateV2WranglerScratch(runtimeRelease);
  verifyPrivateV2RuntimeTarget({
    sourceDirectory: runtimeRelease.sourceForwardDirectory,
    runtimeDirectory: runtimeRelease.forwardDirectory,
    expectedAssetsSha256: runtimeRelease.forwardAssetsSha256,
    expectedWorkerSha256: runtimeRelease.forwardWorkerSha256,
    settings
  });
  verifyPrivateV2RuntimeTarget({
    sourceDirectory: runtimeRelease.sourceRollbackDirectory,
    runtimeDirectory: runtimeRelease.rollbackDirectory,
    expectedAssetsSha256: runtimeRelease.rollbackAssetsSha256,
    expectedWorkerSha256: runtimeRelease.rollbackWorkerSha256,
    settings
  });
  return Object.freeze({ status: "PRIVATE_WORKER_V2_RUNTIME_GUARD_CONFIG_VERIFIED" });
}

export function removePrivateV2RuntimeWorkspace(path) {
  if (typeof path === "string" && path.length > 0) {
    rmSync(path, { recursive: true, force: true });
  }
}

function runGit(root, argumentsList, { allowExitOne = false } = {}) {
  const result = spawnSync("git", argumentsList, {
    cwd: root,
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
  if (allowExitOne && result.status === 1 && !result.error && !result.signal) return null;
  if (result.status !== 0 || result.error || result.signal) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.REPOSITORY_INVALID);
  }
  return String(result.stdout || "").trim();
}

export function verifyPrivateV2RepositoryBoundary(root, candidateCommit, candidateTree, {
  qualification = false
} = {}) {
  if (!SHA40.test(candidateCommit || "") || !SHA40.test(candidateTree || "")) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.REPOSITORY_INVALID);
  }
  const actualTree = runGit(root, ["rev-parse", `${candidateCommit}^{tree}`]);
  const head = runGit(root, ["rev-parse", "HEAD"]);
  const originMain = runGit(root, ["rev-parse", "refs/remotes/origin/main"]);
  const branch = runGit(root, ["branch", "--show-current"]);
  const status = runGit(root, ["status", "--porcelain=v1", "--untracked-files=all"]);
  runGit(root, ["merge-base", "--is-ancestor", candidateCommit, "HEAD"]);
  if (actualTree !== candidateTree
    || head !== originMain
    || branch !== PRIVATE_WORKFLOW_V2_POLICY.branch
    || status !== ""
    || (qualification && head !== candidateCommit)) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.REPOSITORY_INVALID);
  }
  return Object.freeze({ head, originMain, candidateCommit, candidateTree });
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
    fail(PRIVATE_WORKFLOW_V2_FAILURE.TOOLCHAIN_MISMATCH);
  }
  return String(result.stdout || "").trim();
}

export function currentPrivateV2RuntimeIdentity(root, environment = process.env) {
  const identity = Object.freeze({
    runner: environment.PROMETHEUS_RUNNER_IMAGE || environment.ImageOS || "",
    architecture: environment.RUNNER_ARCH || "",
    nodeVersion: process.version.replace(/^v/u, ""),
    npmVersion: runVersion(root, "npm", ["--version"]),
    wranglerVersion: readJson(resolve(root, "node_modules/wrangler/package.json")).version,
    smokeRuntime: "authenticated-fixed-get-head-only"
  });
  if (identity.runner !== PRIVATE_WORKFLOW_V2_POLICY.runner
    || identity.architecture !== PRIVATE_WORKFLOW_V2_POLICY.architecture
    || identity.nodeVersion !== PRIVATE_WORKFLOW_V2_POLICY.nodeVersion
    || identity.wranglerVersion !== PRIVATE_WORKFLOW_V2_POLICY.wranglerVersion
    || !/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/u.test(identity.npmVersion)) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.TOOLCHAIN_MISMATCH);
  }
  return identity;
}

function requiredCoordinator(config, name, className, migrationTag) {
  const binding = config.durable_objects?.bindings?.find(entry => entry?.name === name);
  const migration = config.migrations?.find(entry => entry?.tag === migrationTag);
  return binding?.class_name === className
    && JSON.stringify(migration?.new_sqlite_classes) === JSON.stringify([className])
    && !Object.hasOwn(migration || {}, "deleted_classes");
}

function validatePrivateConfig(config, { qualified, rollback = false }) {
  const expectedMain = qualified
    ? `./worker/${PRIVATE_WORKFLOW_V2_POLICY.generatedWorkerFile}`
    : "workers/prometheus-iq-worker.js";
  const expectedAssets = qualified ? "./assets" : "./deploy/cloudflare-pages";
  const expectedRunWorkerFirst = rollback ? ["/api/*"] : true;
  if (!isPlainObject(config)
    || config.name !== PRIVATE_WORKFLOW_V2_POLICY.privateWorker
    || config.main !== expectedMain
    || config.assets?.directory !== expectedAssets
    || config.assets?.binding !== "ASSETS"
    || JSON.stringify(config.assets?.run_worker_first) !== JSON.stringify(expectedRunWorkerFirst)
    || config.assets?.not_found_handling !== "single-page-application"
    || config.version_metadata?.binding !== CLOUDFLARE_UNATTENDED_SMOKE_VERSION.binding
    || !Array.isArray(config.kv_namespaces)
    || config.kv_namespaces.length < 1
    || !Array.isArray(config.send_email)
    || config.send_email.length < 1
    || !requiredCoordinator(
      config,
      "ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR",
      "RouteIqProspectiveShadowCoordinator",
      "route-iq-prospective-shadow-sqlite-v1"
    )
    || !requiredCoordinator(
      config,
      "ROUTE_IQ_BUSINESS_AVAILABILITY_COORDINATOR",
      "RouteIqBusinessAvailabilityCoordinator",
      "route-iq-business-availability-sqlite-v1"
    )
    || config.migrations.some(migration => Object.hasOwn(migration, "deleted_classes"))
    || Object.hasOwn(config, "routes")
    || Object.hasOwn(config, "triggers")
    || Object.hasOwn(config, "services")
    || config.vars?.ROUTE_IQ_BUSINESS_AVAILABILITY_MODE !== "OFF"
    || (Object.hasOwn(config.vars || {}, "ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION")
      && config.vars.ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION !== "OFF")
    || (Object.hasOwn(config.vars || {}, "ROUTE_IQ_CUSTOMER_PWA_LAUNCH_ENABLED")
      && config.vars.ROUTE_IQ_CUSTOMER_PWA_LAUNCH_ENABLED !== "OFF")
    || (qualified && config.keep_vars !== true)) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
}

export function qualifiedPrivateConfigForArtifact(source, { rollback = false } = {}) {
  let config;
  try {
    config = parseJsonc(source);
  } catch {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
  validatePrivateConfig(config, { qualified: false, rollback });
  delete config.$schema;
  delete config.secrets;
  config.keep_vars = true;
  config.main = `./worker/${PRIVATE_WORKFLOW_V2_POLICY.generatedWorkerFile}`;
  config.assets = { ...config.assets, directory: "./assets" };
  validatePrivateConfig(config, { qualified: true, rollback });
  return `${canonicalPrivateWorkflowJson(config)}\n`;
}

function writeExclusive(path, value) {
  writeFileSync(path, value, { encoding: "utf8", mode: 0o600, flag: "wx" });
}

function defaultBundlePrivateWorker({
  repositoryRoot,
  workspaceRoot,
  configPath,
  outputDirectory,
  temporaryHome
}) {
  const result = spawnSync(process.execPath, [
    resolve(repositoryRoot, PRIVATE_WORKER_DEPLOYMENT_POLICY.wranglerModule),
    "deploy",
    "--dry-run",
    "--config",
    configPath,
    "--keep-vars",
    "--strict",
    "--outdir",
    outputDirectory
  ], {
    cwd: workspaceRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 32 * 1024 * 1024,
    timeout: COMMAND_TIMEOUT_MS,
    env: {
      PATH: process.env.PATH,
      HOME: temporaryHome,
      TMPDIR: temporaryHome,
      XDG_CONFIG_HOME: temporaryHome,
      CI: "true",
      NO_COLOR: "1",
      WRANGLER_SEND_METRICS: "false",
      CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false"
    }
  });
  if (result.status !== 0 || result.error || result.signal) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.QUALIFICATION_FAILED);
  }
}

export function canonicalizePrivateGeneratedOutputForArtifact({
  generatedDirectory,
  destinationDirectory,
  workspace,
  repositoryRoot
}) {
  const actual = readdirSync(generatedDirectory).sort();
  if (!actual.includes(PRIVATE_WORKFLOW_V2_POLICY.generatedWorkerFile)
    || !actual.includes(PRIVATE_WORKFLOW_V2_POLICY.generatedSourceMapFile)
    || actual.some(name => ![
      PRIVATE_WORKFLOW_V2_POLICY.generatedWorkerFile,
      PRIVATE_WORKFLOW_V2_POLICY.generatedSourceMapFile,
      "README.md"
    ].includes(name))) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
  mkdirSync(destinationDirectory, { mode: 0o700 });
  const worker = canonicalizeGeneratedWorkerSource(
    readFileSync(join(generatedDirectory, PRIVATE_WORKFLOW_V2_POLICY.generatedWorkerFile), "utf8"),
    { workspace, repositoryRoot }
  );
  const sourceMap = canonicalizeGeneratedSourceMap(
    readJson(join(generatedDirectory, PRIVATE_WORKFLOW_V2_POLICY.generatedSourceMapFile)),
    {
      sourceMapDirectory: generatedDirectory,
      workspace,
      repositoryRoot
    }
  );
  writeExclusive(join(destinationDirectory, PRIVATE_WORKFLOW_V2_POLICY.generatedWorkerFile), worker);
  writeExclusive(
    join(destinationDirectory, PRIVATE_WORKFLOW_V2_POLICY.generatedSourceMapFile),
    `${canonicalPrivateWorkflowJson(sourceMap)}\n`
  );
}

function createDeployablePayload({
  sourceConfigPath,
  assetsPath,
  generatedDirectory,
  destination,
  rollback = false
}) {
  mkdirSync(destination, { mode: 0o700 });
  writeExclusive(
    join(destination, PRIVATE_WORKFLOW_V2_POLICY.qualifiedConfigFile),
    qualifiedPrivateConfigForArtifact(readFileSync(sourceConfigPath, "utf8"), { rollback })
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

function exactReleaseRoot(directory) {
  const expected = [
    PRIVATE_WORKFLOW_V2_POLICY.manifestFile,
    PRIVATE_WORKFLOW_V2_POLICY.payloadDirectory
  ].sort();
  if (JSON.stringify(readdirSync(directory).sort()) !== JSON.stringify(expected)) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
}

function governedSourceHashes(root) {
  return Object.freeze(Object.fromEntries(GOVERNED_SOURCE_PATHS.map(path => [
    path,
    sha256PrivateWorkflowFile(resolve(root, path))
  ])));
}

function rollbackBundleSha256(directory) {
  return hashPrivateWorkflowRawDirectory(directory, {
    exclude: path => path === ROLLBACK_MANIFEST || path.startsWith(".dry-run-output/")
  });
}

function deployParitySha256() {
  return createHash("sha256").update(
    `${JSON.stringify(inspectRouteIqPrivateDashboardDeployAssets(), null, 2)}\n`
  ).digest("hex");
}

function buildManifest(root, inputs, runtime, payload, rollbackResult) {
  const contract = readJson(resolve(root, PRIVATE_WORKFLOW_V2_POLICY.contractPath));
  const forward = join(payload, PRIVATE_WORKFLOW_V2_POLICY.forwardDirectory);
  const rollbackIdentity = join(
    payload,
    PRIVATE_WORKFLOW_V2_POLICY.rollbackDirectory,
    PRIVATE_WORKFLOW_V2_POLICY.rollbackIdentityDirectory
  );
  const contentTreeSha256 = hashPrivateWorkflowDirectory(payload);
  const forwardPayloadSha256 = hashPrivateWorkflowDirectory(forward);
  const assetsSha256 = hashPrivateWorkflowDirectory(join(forward, "assets"));
  const paritySha256 = deployParitySha256();
  const rollbackSha256 = rollbackBundleSha256(rollbackIdentity);
  const manifest = Object.freeze({
    schemaVersion: PRIVATE_WORKFLOW_V2_POLICY.contractVersion,
    target: Object.freeze({
      repository: PRIVATE_WORKFLOW_V2_POLICY.repository,
      branch: PRIVATE_WORKFLOW_V2_POLICY.branch,
      worker: PRIVATE_WORKFLOW_V2_POLICY.privateWorker,
      publicWorker: PRIVATE_WORKFLOW_V2_POLICY.publicWorker,
      publicWorkerMutationAllowed: false
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
      contentTreeSha256,
      forwardPayloadSha256,
      deploymentAssetsSha256: assetsSha256,
      deployParitySha256: paritySha256,
      sourceConfigSha256: sha256PrivateWorkflowFile(resolve(root, PRIVATE_WORKFLOW_V2_POLICY.privateConfig)),
      rollbackContractSha256: sha256PrivateWorkflowFile(
        resolve(root, "workers/infrastructure/route-iq-private-forward-rollback-candidate-v3.json")
      ),
      rollbackBundleSha256: rollbackSha256,
      workflowContractSha256: sha256PrivateWorkflowFile(
        resolve(root, PRIVATE_WORKFLOW_V2_POLICY.contractPath)
      ),
      governedSourceSha256: governedSourceHashes(root),
      payloadFiles: fileManifest(payload)
    }),
    continuity: Object.freeze({
      previousCandidateCommit: PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.candidateCommit,
      previousCandidateTree: PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.candidateTree,
      previousQualificationArtifactContentTreeSha256:
        PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.qualificationArtifactContentTreeSha256,
      deployParitySha256: paritySha256,
      forwardPayloadSha256
    }),
    rollback: Object.freeze({
      strategy: "verified_new_forward_deployment",
      nativeRollbackAllowed: false,
      bundleSha256: rollbackSha256,
      applicationBehaviorSource: rollbackResult.manifest.applicationBehaviorSource,
      statefulCompatibility: rollbackResult.manifest.statefulCompatibility,
      protectedRuntimeConfiguration: rollbackResult.manifest.protectedRuntimeConfiguration
    }),
    toolchain: Object.freeze({
      ...runtime,
      sourceBuildsDuringQualification: 1,
      deployRebuildAllowed: false,
      wranglerDeployMode: "no-bundle"
    }),
    workflow: Object.freeze({
      qualification: PRIVATE_WORKFLOW_V2_POLICY.qualificationWorkflowPath,
      deployment: PRIVATE_WORKFLOW_V2_POLICY.deploymentWorkflowPath,
      artifactStorage: "github-actions-artifact-v4",
      artifactRetentionDays: PRIVATE_WORKFLOW_V2_POLICY.artifactRetentionDays,
      authorizationConsumedAt: "forward_wrangler_process_spawn_confirmed",
      automaticRetriesAllowed: false,
      forwardDeploymentAttempts: 1,
      rollbackAttemptsOnCriticalFailure: 1
    }),
    safety: Object.freeze({
      crmMutationAllowed: false,
      publicWorkerMutationAllowed: false,
      collection: "OFF",
      activeCohortCount: 0,
      recommendationInfluence: "OFF",
      providerRefresh: "OFF",
      scheduler: "OFF",
      customerActivation: "OFF",
      anthonyMapped: false,
      secretValuesInArtifactAllowed: false
    })
  });
  if (contract.contractVersion !== PRIVATE_WORKFLOW_V2_POLICY.contractVersion
    || contract.owner !== "Prometheus Infrastructure"
    || paritySha256 !== PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.deployParitySha256
    || forwardPayloadSha256 !== PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.forwardPayloadSha256
    || rollbackSha256 !== PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.rollbackBundleSha256) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.MANIFEST_MISMATCH);
  }
  return manifest;
}

export function buildQualifiedPrivateRelease(root, {
  outputDirectory,
  inputs,
  runtimeIdentity,
  temporaryRoot = tmpdir(),
  bundlePrivateWorker = defaultBundlePrivateWorker,
  rollbackBuilder = buildRouteIqPrivateForwardRollbackCandidateV3,
  verifyRepositoryBoundary = true
}) {
  if (typeof outputDirectory !== "string" || outputDirectory.length < 1 || !inputs || !runtimeIdentity) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
  if (existsSync(outputDirectory)) fail(PRIVATE_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  if (verifyRepositoryBoundary) {
    verifyPrivateV2RepositoryBoundary(root, inputs.candidateCommit, inputs.candidateTree, {
      qualification: true
    });
    verifyStaticDeploymentPolicy(root);
    verifyWranglerPin(root);
  }
  const workspace = mkdtempSync(join(temporaryRoot, "prometheus-private-qualification-v2-"));
  const home = join(workspace, "home");
  const generatedForward = join(workspace, "generated-forward");
  const canonicalForward = join(workspace, "canonical-forward");
  const rollbackIdentity = join(workspace, "rollback-identity");
  const generatedRollback = join(workspace, "generated-rollback");
  const canonicalRollback = join(workspace, "canonical-rollback");
  let outputCreated = false;
  try {
    mkdirSync(home, { mode: 0o700 });
    mkdirSync(generatedForward, { mode: 0o700 });
    mkdirSync(outputDirectory, { mode: 0o700 });
    outputCreated = true;
    const payload = join(outputDirectory, PRIVATE_WORKFLOW_V2_POLICY.payloadDirectory);
    mkdirSync(payload, { mode: 0o700 });

    bundlePrivateWorker({
      repositoryRoot: root,
      workspaceRoot: root,
      configPath: resolve(root, PRIVATE_WORKFLOW_V2_POLICY.privateConfig),
      outputDirectory: generatedForward,
      temporaryHome: home
    });
    canonicalizePrivateGeneratedOutputForArtifact({
      generatedDirectory: generatedForward,
      destinationDirectory: canonicalForward,
      workspace: root,
      repositoryRoot: root
    });
    createDeployablePayload({
      sourceConfigPath: resolve(root, PRIVATE_WORKFLOW_V2_POLICY.privateConfig),
      assetsPath: resolve(root, PRIVATE_WORKFLOW_V2_POLICY.privateAssets),
      generatedDirectory: canonicalForward,
      destination: join(payload, PRIVATE_WORKFLOW_V2_POLICY.forwardDirectory)
    });

    const rollbackResult = rollbackBuilder({
      outputDirectory: rollbackIdentity,
      sourceRef: inputs.candidateCommit,
      runDryRun: true
    });
    const rollbackNodeModules = join(rollbackIdentity, "node_modules");
    try {
      symlinkSync(resolve(root, "node_modules"), rollbackNodeModules, "dir");
      mkdirSync(generatedRollback, { mode: 0o700 });
      bundlePrivateWorker({
        repositoryRoot: root,
        workspaceRoot: rollbackIdentity,
        configPath: join(rollbackIdentity, "wrangler.jsonc"),
        outputDirectory: generatedRollback,
        temporaryHome: home
      });
    } finally {
      removeTransientNodeModulesPath(rollbackNodeModules);
    }
    canonicalizePrivateGeneratedOutputForArtifact({
      generatedDirectory: generatedRollback,
      destinationDirectory: canonicalRollback,
      workspace: rollbackIdentity,
      repositoryRoot: root
    });
    const rollbackRoot = join(payload, PRIVATE_WORKFLOW_V2_POLICY.rollbackDirectory);
    mkdirSync(rollbackRoot, { mode: 0o700 });
    cpSync(
      rollbackIdentity,
      join(rollbackRoot, PRIVATE_WORKFLOW_V2_POLICY.rollbackIdentityDirectory),
      { recursive: true, errorOnExist: true, force: false, dereference: false }
    );
    createDeployablePayload({
      sourceConfigPath: join(rollbackIdentity, "wrangler.jsonc"),
      assetsPath: join(rollbackIdentity, "deploy/cloudflare-pages"),
      generatedDirectory: canonicalRollback,
      destination: join(rollbackRoot, PRIVATE_WORKFLOW_V2_POLICY.rollbackDeployableDirectory),
      rollback: true
    });

    const manifest = buildManifest(root, inputs, runtimeIdentity, payload, rollbackResult);
    const manifestPath = join(outputDirectory, PRIVATE_WORKFLOW_V2_POLICY.manifestFile);
    writeExclusive(manifestPath, `${canonicalPrivateWorkflowJson(manifest)}\n`);
    exactReleaseRoot(outputDirectory);
    for (const path of regularFiles(outputDirectory)) chmodSync(path, 0o400);
    return Object.freeze({
      status: "PRIVATE_WORKER_V2_QUALIFICATION_ARTIFACT_CREATED",
      contentTreeSha256: manifest.identities.contentTreeSha256,
      manifestSha256: sha256PrivateWorkflowFile(manifestPath),
      forwardPayloadSha256: manifest.identities.forwardPayloadSha256,
      deploymentAssetsSha256: manifest.identities.deploymentAssetsSha256,
      rollbackContractSha256: manifest.identities.rollbackContractSha256,
      rollbackBundleSha256: manifest.identities.rollbackBundleSha256,
      workflowContractSha256: manifest.identities.workflowContractSha256
    });
  } catch (error) {
    if (outputCreated) rmSync(outputDirectory, { recursive: true, force: true });
    if (error instanceof PrivateWorkflowV2Error || error instanceof DeploymentPolicyError) throw error;
    fail(PRIVATE_WORKFLOW_V2_FAILURE.QUALIFICATION_FAILED);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

function validateQualifiedConfigPath(path, { rollback = false } = {}) {
  let config;
  try {
    config = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
  validatePrivateConfig(config, { qualified: true, rollback });
}

function expectedGovernedHashes(root) {
  return canonicalPrivateWorkflowJson(governedSourceHashes(root));
}

export function verifyQualifiedPrivateRelease(root, releaseDirectory, expected, runtimeIdentity, {
  verifyRepositoryBoundary = true
} = {}) {
  if (!expected || typeof releaseDirectory !== "string" || !runtimeIdentity) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
  exactReleaseRoot(releaseDirectory);
  const manifestPath = join(releaseDirectory, PRIVATE_WORKFLOW_V2_POLICY.manifestFile);
  const payload = join(releaseDirectory, PRIVATE_WORKFLOW_V2_POLICY.payloadDirectory);
  const manifest = readJson(manifestPath);
  if (readFileSync(manifestPath, "utf8") !== `${canonicalPrivateWorkflowJson(manifest)}\n`) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.ARTIFACT_INVALID);
  }
  const manifestSha256 = sha256PrivateWorkflowFile(manifestPath);
  const contentTreeSha256 = hashPrivateWorkflowDirectory(payload);
  const forwardDirectory = join(payload, PRIVATE_WORKFLOW_V2_POLICY.forwardDirectory);
  const rollbackIdentity = join(
    payload,
    PRIVATE_WORKFLOW_V2_POLICY.rollbackDirectory,
    PRIVATE_WORKFLOW_V2_POLICY.rollbackIdentityDirectory
  );
  const rollbackDirectory = join(
    payload,
    PRIVATE_WORKFLOW_V2_POLICY.rollbackDirectory,
    PRIVATE_WORKFLOW_V2_POLICY.rollbackDeployableDirectory
  );
  if (manifest.schemaVersion !== PRIVATE_WORKFLOW_V2_POLICY.contractVersion
    || manifest.target?.repository !== PRIVATE_WORKFLOW_V2_POLICY.repository
    || manifest.target?.branch !== PRIVATE_WORKFLOW_V2_POLICY.branch
    || manifest.target?.worker !== PRIVATE_WORKFLOW_V2_POLICY.privateWorker
    || manifest.target?.publicWorker !== PRIVATE_WORKFLOW_V2_POLICY.publicWorker
    || manifest.target?.publicWorkerMutationAllowed !== false
    || manifest.candidate?.commit !== expected.approvedCommit
    || manifest.candidate?.tree !== expected.approvedTree
    || manifest.candidate?.batchId !== expected.batchId
    || manifest.productionPrerequisites?.publicVersion !== expected.currentPublicVersion
    || manifest.productionPrerequisites?.privateVersion !== expected.currentPrivateVersion
    || manifest.identities?.contentTreeSha256 !== expected.qualifiedContentTreeSha256
    || contentTreeSha256 !== expected.qualifiedContentTreeSha256
    || manifestSha256 !== expected.qualifiedManifestSha256
    || manifest.identities?.workflowContractSha256 !== expected.workflowContractSha256
    || manifest.identities?.rollbackContractSha256 !== expected.rollbackContractSha256
    || manifest.identities?.rollbackBundleSha256 !== expected.rollbackBundleSha256
    || canonicalPrivateWorkflowJson(manifest.identities?.governedSourceSha256)
      !== expectedGovernedHashes(root)
    || canonicalPrivateWorkflowJson(manifest.identities?.payloadFiles)
      !== canonicalPrivateWorkflowJson(fileManifest(payload))
    || manifest.identities?.deployParitySha256
      !== PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.deployParitySha256
    || manifest.identities?.forwardPayloadSha256
      !== PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.forwardPayloadSha256
    || manifest.identities?.rollbackBundleSha256
      !== PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.rollbackBundleSha256
    || manifest.continuity?.previousCandidateCommit
      !== PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.candidateCommit
    || manifest.continuity?.previousCandidateTree
      !== PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.candidateTree
    || manifest.continuity?.previousQualificationArtifactContentTreeSha256
      !== PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.qualificationArtifactContentTreeSha256
    || manifest.toolchain?.runner !== runtimeIdentity.runner
    || manifest.toolchain?.architecture !== runtimeIdentity.architecture
    || manifest.toolchain?.nodeVersion !== runtimeIdentity.nodeVersion
    || manifest.toolchain?.npmVersion !== runtimeIdentity.npmVersion
    || manifest.toolchain?.wranglerVersion !== runtimeIdentity.wranglerVersion
    || manifest.toolchain?.smokeRuntime !== runtimeIdentity.smokeRuntime
    || manifest.toolchain?.deployRebuildAllowed !== false
    || manifest.toolchain?.wranglerDeployMode !== "no-bundle"
    || manifest.workflow?.automaticRetriesAllowed !== false
    || manifest.workflow?.forwardDeploymentAttempts !== 1
    || manifest.workflow?.rollbackAttemptsOnCriticalFailure !== 1
    || manifest.safety?.crmMutationAllowed !== false
    || manifest.safety?.publicWorkerMutationAllowed !== false
    || manifest.safety?.collection !== "OFF"
    || manifest.safety?.activeCohortCount !== 0
    || manifest.safety?.recommendationInfluence !== "OFF"
    || manifest.safety?.providerRefresh !== "OFF"
    || manifest.safety?.scheduler !== "OFF"
    || manifest.safety?.customerActivation !== "OFF"
    || manifest.safety?.anthonyMapped !== false
    || manifest.safety?.secretValuesInArtifactAllowed !== false) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.MANIFEST_MISMATCH);
  }
  if (verifyRepositoryBoundary) {
    verifyPrivateV2RepositoryBoundary(root, expected.approvedCommit, expected.approvedTree);
    verifyWranglerPin(root);
  }
  validateQualifiedConfigPath(join(
    forwardDirectory,
    PRIVATE_WORKFLOW_V2_POLICY.qualifiedConfigFile
  ));
  validateQualifiedConfigPath(join(
    rollbackDirectory,
    PRIVATE_WORKFLOW_V2_POLICY.qualifiedConfigFile
  ), { rollback: true });
  if (hashPrivateWorkflowDirectory(forwardDirectory)
      !== PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.forwardPayloadSha256
    || hashPrivateWorkflowDirectory(join(forwardDirectory, "assets"))
      !== manifest.identities.deploymentAssetsSha256
    || rollbackBundleSha256(rollbackIdentity) !== expected.rollbackBundleSha256) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.ARTIFACT_TAMPERED);
  }
  return Object.freeze({
    status: "PRIVATE_WORKER_V2_QUALIFIED_ARTIFACT_VERIFIED",
    manifest,
    contentTreeSha256,
    manifestSha256,
    forwardDirectory,
    rollbackDirectory
  });
}

export function buildQualifiedPrivateWranglerInvocation(mode, inputs, verifiedRelease) {
  if (!inputs || !verifiedRelease || !["dry-run", "deploy", "rollback"].includes(mode)) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
  const releaseRoot = mode === "rollback"
    ? verifiedRelease.rollbackDirectory
    : verifiedRelease.forwardDirectory;
  const scratch = privateV2WranglerScratchLayout(verifiedRelease);
  const outdir = scratch.wranglerOutdirs[mode];
  const config = resolve(releaseRoot, PRIVATE_WORKFLOW_V2_POLICY.qualifiedConfigFile);
  const argumentsList = [
    PRIVATE_WORKER_DEPLOYMENT_POLICY.wranglerModule,
    "deploy",
    "--no-bundle",
    "--config",
    config,
    "--outdir",
    outdir,
    "--keep-vars",
    "--strict",
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
    || argumentsList.includes(PRIVATE_WORKFLOW_V2_POLICY.publicWorker)
    || argumentsList.filter(value => value === "--outdir").length !== 1
    || basename(config) !== PRIVATE_WORKFLOW_V2_POLICY.qualifiedConfigFile) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.DEPLOYMENT_BOUNDARY_INVALID);
  }
  return Object.freeze(argumentsList);
}

function sameState(left, right) {
  return left.deployment.deploymentId === right.deployment.deploymentId
    && left.deployment.versionId === right.deployment.versionId
    && JSON.stringify(left.bindings) === JSON.stringify(right.bindings);
}

export function privateV2PredeploymentSmokeMarkerPolicy(currentPrivateVersion) {
  if (!UUID.test(currentPrivateVersion || "")) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
  return [
    PRIVATE_WORKFLOW_V2_POLICY.bootstrapGuardlessPrivateVersion,
    PRIVATE_WORKFLOW_V2_POLICY.verifiedGuardlessRollbackPrivateVersion
  ].includes(currentPrivateVersion)
    ? CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.BOOTSTRAP_ALLOW_MISSING
    : CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.REQUIRE_EXACT;
}

function validSmoke(smoke, markerPolicy, expectedWorkerVersion) {
  const base = isPlainObject(smoke)
    && smoke.status === "passed"
    && smoke.attemptedWriteCount === 0
    && Number.isInteger(smoke.requestCount)
    && smoke.requestCount > 0
    && smoke.markerPolicy === markerPolicy
    && Number.isInteger(smoke.markerVerifiedCount)
    && smoke.markerVerifiedCount >= 0
    && Number.isInteger(smoke.markerOmittedCount)
    && smoke.markerOmittedCount >= 0
    && smoke.markerVerifiedCount + smoke.markerOmittedCount === smoke.requestCount;
  if (!base) return false;
  if (markerPolicy === CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.REQUIRE_EXACT
    && (smoke.markerVerifiedCount !== smoke.requestCount || smoke.markerOmittedCount !== 0)) {
    return false;
  }
  if (expectedWorkerVersion === undefined) return true;
  return UUID.test(expectedWorkerVersion)
    && smoke.expectedWorkerVersion === expectedWorkerVersion
    && smoke.versionVerifiedCount === smoke.requestCount;
}

export function assertPrivateBindingsPreserved(before, after) {
  if (!Array.isArray(before)
    || !Array.isArray(after)
    || JSON.stringify([...before].sort()) !== JSON.stringify([...after].sort())) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.BINDING_PRESERVATION_FAILED);
  }
}

function bindingIdentity(binding) {
  if (typeof binding !== "string") {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.BINDING_PRESERVATION_FAILED);
  }
  const separator = binding.lastIndexOf(":");
  const name = binding.slice(0, separator);
  const type = binding.slice(separator + 1);
  if (separator < 1
    || !/^[A-Z][A-Z0-9_]{0,127}$/u.test(name)
    || !/^[a-z][a-z0-9_]{0,63}$/u.test(type)) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.BINDING_PRESERVATION_FAILED);
  }
  return Object.freeze({ binding, name, type });
}

function configuredPrivateBindings(config) {
  const bindings = [
    ...(config.assets?.binding ? [`${config.assets.binding}:assets`] : []),
    ...Object.keys(config.vars || {}).map(name => `${name}:plain_text`),
    ...(config.kv_namespaces || []).map(binding => `${binding.binding}:kv_namespace`),
    ...(config.send_email || []).map(binding => `${binding.name}:send_email`),
    ...(config.durable_objects?.bindings || []).map(
      binding => `${binding.name}:durable_object_namespace`
    ),
    ...(config.version_metadata?.binding
      ? [`${config.version_metadata.binding}:version_metadata`]
      : [])
  ].sort();
  if (new Set(bindings).size !== bindings.length) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.BINDING_PRESERVATION_FAILED);
  }
  return bindings;
}

function assertNoBindingTypeCollisions(bindingGroups) {
  const typesByName = new Map();
  for (const binding of bindingGroups.flat()) {
    const identity = bindingIdentity(binding);
    const prior = typesByName.get(identity.name);
    if (prior && prior !== identity.type) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.BINDING_PRESERVATION_FAILED);
    }
    typesByName.set(identity.name, identity.type);
  }
}

export function assertQualifiedPrivateConfigCanPreserveBindings(verifiedRelease, bindings) {
  if (!verifiedRelease || !Array.isArray(bindings)) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.BINDING_PRESERVATION_FAILED);
  }
  const forwardConfig = readJson(join(
    verifiedRelease.forwardDirectory,
    PRIVATE_WORKFLOW_V2_POLICY.qualifiedConfigFile
  ));
  const rollbackConfig = readJson(join(
    verifiedRelease.rollbackDirectory,
    PRIVATE_WORKFLOW_V2_POLICY.qualifiedConfigFile
  ));
  const initial = [...bindings].sort();
  if (new Set(initial).size !== initial.length) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.BINDING_PRESERVATION_FAILED);
  }
  const forward = configuredPrivateBindings(forwardConfig);
  const rollback = configuredPrivateBindings(rollbackConfig);
  const guard = [
    ...PRIVATE_WORKFLOW_V2_RUNTIME_GUARD_BINDINGS
      .filter(name => name !== CLOUDFLARE_UNATTENDED_SMOKE_VERSION.binding)
      .map(name => `${name}:plain_text`),
    `${CLOUDFLARE_UNATTENDED_SMOKE_VERSION.binding}:version_metadata`
  ].sort();
  assertNoBindingTypeCollisions([initial, forward, rollback, guard]);
  const forwardSet = new Set(forward);
  const rollbackSet = new Set(rollback);
  for (const name of guard) {
    if (!forwardSet.has(name) || !rollbackSet.has(name)) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.BINDING_PRESERVATION_FAILED);
    }
  }
  for (const binding of initial) {
    const { type } = bindingIdentity(binding);
    if (!["secret_text", "plain_text"].includes(type)
      && (!forwardSet.has(binding) || !rollbackSet.has(binding))) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.BINDING_PRESERVATION_FAILED);
    }
  }
  for (const binding of forward) {
    const { type } = bindingIdentity(binding);
    if (!["secret_text", "plain_text"].includes(type) && !rollbackSet.has(binding)) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.BINDING_PRESERVATION_FAILED);
    }
  }
  return Object.freeze({
    initialBindings: Object.freeze(initial),
    forwardExpectedBindings: Object.freeze([...new Set([...initial, ...forward, ...guard])].sort()),
    rollbackExpectedBindings:
      Object.freeze([...new Set([...initial, ...forward, ...rollback, ...guard])].sort())
  });
}

export function createPrivateDeploymentEvidenceRecorder(directory) {
  if (typeof directory !== "string" || directory.length < 1) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.EVIDENCE_INVALID);
  }
  try {
    mkdirSync(directory, { recursive: false, mode: 0o700 });
  } catch {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.EVIDENCE_INVALID);
  }
  const stats = lstatSync(directory);
  if (!stats.isDirectory() || stats.isSymbolicLink() || (stats.mode & 0o077) !== 0) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.EVIDENCE_INVALID);
  }
  const observed = [];
  return Object.freeze({
    append(phase) {
      if (!PHASES.has(phase) || observed.includes(phase)) {
        fail(PRIVATE_WORKFLOW_V2_FAILURE.EVIDENCE_INVALID);
      }
      const path = join(directory, `${String(observed.length + 1).padStart(3, "0")}-${phase}`);
      writeFileSync(path, `${phase}\n`, { encoding: "ascii", mode: 0o600, flag: "wx" });
      observed.push(phase);
    },
    phases() {
      return Object.freeze([...observed]);
    }
  });
}

export async function runQualifiedPrivateDeploymentLifecycle({
  inputs,
  verifyRelease,
  inspectRepository,
  fetchState,
  verifyInitialBindings,
  runPreSmoke,
  runDryRun,
  runDeploy,
  runPostSmoke,
  runRollback,
  evidence
}) {
  if (![verifyRelease, inspectRepository, fetchState, verifyInitialBindings, runPreSmoke,
    runDryRun, runDeploy, runPostSmoke, runRollback].every(value => typeof value === "function")
    || !evidence || typeof evidence.append !== "function") {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
  let deploymentAttempts = 0;
  let rollbackAttempts = 0;
  evidence.append(PRIVATE_WORKFLOW_V2_PHASE.DEPLOYMENT_NOT_BEGUN);
  const release = await verifyRelease();
  await inspectRepository();
  await runDryRun(release);
  await verifyRelease();
  await inspectRepository();
  evidence.append(PRIVATE_WORKFLOW_V2_PHASE.LOCAL_PREFLIGHT_PASSED);

  const initialPrivate = await fetchState(PRIVATE_WORKFLOW_V2_POLICY.privateWorker);
  const initialPublic = await fetchState(PRIVATE_WORKFLOW_V2_POLICY.publicWorker);
  if (initialPrivate.deployment.versionId !== inputs.currentPrivateVersion
    || initialPublic.deployment.versionId !== inputs.currentPublicVersion) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.PRODUCTION_PREREQUISITE_MISMATCH);
  }
  const bindingTransition = verifyInitialBindings(release, initialPrivate.bindings);
  if (!isPlainObject(bindingTransition)
    || !Array.isArray(bindingTransition.forwardExpectedBindings)
    || !Array.isArray(bindingTransition.rollbackExpectedBindings)) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.BINDING_PRESERVATION_FAILED);
  }
  evidence.append(PRIVATE_WORKFLOW_V2_PHASE.PRODUCTION_PREREQUISITES_PASSED);
  const predeploymentMarkerPolicy = privateV2PredeploymentSmokeMarkerPolicy(
    inputs.currentPrivateVersion
  );
  if (!validSmoke(
    await runPreSmoke(Object.freeze({ markerPolicy: predeploymentMarkerPolicy })),
    predeploymentMarkerPolicy
  )) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.SMOKE_INVALID);
  }
  evidence.append(PRIVATE_WORKFLOW_V2_PHASE.PREDEPLOYMENT_SMOKE_PASSED);

  const boundaryPrivate = await fetchState(PRIVATE_WORKFLOW_V2_POLICY.privateWorker);
  const boundaryPublic = await fetchState(PRIVATE_WORKFLOW_V2_POLICY.publicWorker);
  if (!sameState(initialPrivate, boundaryPrivate) || !sameState(initialPublic, boundaryPublic)) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.PRODUCTION_PREREQUISITE_MISMATCH);
  }
  await verifyRelease();
  await inspectRepository();

  const rollback = async (deployedPrivate, failureClassification) => {
    if (rollbackAttempts !== 0) fail(PRIVATE_WORKFLOW_V2_FAILURE.ROLLBACK_BOUNDARY_INVALID);
    rollbackAttempts += 1;
    evidence.append(PRIVATE_WORKFLOW_V2_PHASE.CRITICAL_FAILURE_DETECTED);
    await verifyRelease();
    await inspectRepository();
    evidence.append(PRIVATE_WORKFLOW_V2_PHASE.ROLLBACK_REQUEST_BEGUN);
    await runRollback(release);
    const rolledBackPrivate = await fetchState(PRIVATE_WORKFLOW_V2_POLICY.privateWorker);
    const rolledBackPublic = await fetchState(PRIVATE_WORKFLOW_V2_POLICY.publicWorker);
    if (!sameState(initialPublic, rolledBackPublic)
      || rolledBackPrivate.deployment.versionId === deployedPrivate.deployment.versionId
      || rolledBackPrivate.deployment.deploymentId === deployedPrivate.deployment.deploymentId) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.ROLLBACK_BOUNDARY_INVALID);
    }
    assertPrivateBindingsPreserved(
      bindingTransition.rollbackExpectedBindings,
      rolledBackPrivate.bindings
    );
    evidence.append(PRIVATE_WORKFLOW_V2_PHASE.ROLLBACK_VERIFIED);
    return Object.freeze({
      status: "PRIVATE_WORKER_V2_FORWARD_ROLLBACK_VERIFIED",
      deploymentAttempts,
      rollbackAttempts,
      failureClassification
    });
  };

  if (deploymentAttempts !== 0) fail(PRIVATE_WORKFLOW_V2_FAILURE.DEPLOYMENT_ATTEMPT_LIMIT);
  deploymentAttempts += 1;
  let authorizationConsumed = false;
  const consumeAuthorization = () => {
    if (authorizationConsumed) fail(PRIVATE_WORKFLOW_V2_FAILURE.DEPLOYMENT_ATTEMPT_LIMIT);
    authorizationConsumed = true;
    evidence.append(PRIVATE_WORKFLOW_V2_PHASE.AUTHORIZATION_CONSUMED);
  };
  try {
    await runDeploy(release, consumeAuthorization);
  } catch (error) {
    if (!authorizationConsumed) throw error;
    const uncertainPrivate = await fetchState(PRIVATE_WORKFLOW_V2_POLICY.privateWorker);
    const uncertainPublic = await fetchState(PRIVATE_WORKFLOW_V2_POLICY.publicWorker);
    if (!sameState(initialPublic, uncertainPublic)) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.PUBLIC_WORKER_CHANGED);
    }
    if (sameState(initialPrivate, uncertainPrivate)) throw error;
    return rollback(uncertainPrivate, formatPrivateWorkflowV2Failure(error));
  }
  if (!authorizationConsumed) fail(PRIVATE_WORKFLOW_V2_FAILURE.DEPLOYMENT_BOUNDARY_INVALID);
  evidence.append(PRIVATE_WORKFLOW_V2_PHASE.DEPLOYMENT_REQUEST_COMPLETED);

  const deployedPrivate = await fetchState(PRIVATE_WORKFLOW_V2_POLICY.privateWorker);
  const deployedPublic = await fetchState(PRIVATE_WORKFLOW_V2_POLICY.publicWorker);
  try {
    if (!sameState(initialPublic, deployedPublic)) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.PUBLIC_WORKER_CHANGED);
    }
    if (deployedPrivate.deployment.versionId === initialPrivate.deployment.versionId
      || deployedPrivate.deployment.deploymentId === initialPrivate.deployment.deploymentId) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.PRIVATE_WORKER_UNCHANGED);
    }
    assertPrivateBindingsPreserved(
      bindingTransition.forwardExpectedBindings,
      deployedPrivate.bindings
    );
    evidence.append(PRIVATE_WORKFLOW_V2_PHASE.POST_DEPLOYMENT_VERIFIED);
    const expectedWorkerVersion = deployedPrivate.deployment.versionId;
    if (!validSmoke(
      await runPostSmoke(Object.freeze({
        markerPolicy: CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.REQUIRE_EXACT,
        expectedWorkerVersion
      })),
      CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.REQUIRE_EXACT,
      expectedWorkerVersion
    )) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.SMOKE_INVALID);
    }
    evidence.append(PRIVATE_WORKFLOW_V2_PHASE.POSTDEPLOYMENT_SMOKE_PASSED);
  } catch (error) {
    return rollback(deployedPrivate, formatPrivateWorkflowV2Failure(error));
  }
  return Object.freeze({
    status: "PRIVATE_WORKER_V2_DEPLOYMENT_VERIFIED",
    deploymentAttempts,
    rollbackAttempts
  });
}

export async function verifyPrivateQualificationArtifactMetadata(environment, fetchImpl = globalThis.fetch) {
  const tokenName = "PROMETHEUS_GITHUB_TOKEN";
  let token = environment[tokenName];
  delete environment[tokenName];
  const artifactId = environment.PROMETHEUS_QUALIFICATION_ARTIFACT_ID;
  const runId = environment.PROMETHEUS_QUALIFICATION_RUN_ID;
  const approvedCommit = environment.PROMETHEUS_APPROVED_COMMIT;
  const expectedZipSha256 = environment.PROMETHEUS_QUALIFICATION_ARTIFACT_ZIP_SHA256;
  if (typeof token !== "string" || token.length < 1 || token.length > 4096
    || !POSITIVE_INTEGER.test(artifactId || "")
    || !POSITIVE_INTEGER.test(runId || "")
    || !SHA40.test(approvedCommit || "")
    || !SHA64.test(expectedZipSha256 || "")
    || typeof fetchImpl !== "function") {
    token = "";
    fail(PRIVATE_WORKFLOW_V2_FAILURE.GITHUB_METADATA_INVALID);
  }
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    PRIVATE_WORKFLOW_V2_POLICY.githubRequestTimeoutMs
  );
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28"
  };
  let bytes;
  try {
    let response;
    try {
      response = await fetchImpl(new URL(
        `/repos/${PRIVATE_WORKFLOW_V2_POLICY.repository}/actions/artifacts/${artifactId}`,
        PRIVATE_WORKFLOW_V2_POLICY.githubApiOrigin
      ), {
        method: "GET",
        headers,
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal
      });
    } catch {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.GITHUB_METADATA_INVALID);
    }
    if (response.redirected || response.status !== 200) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.GITHUB_METADATA_INVALID);
    }
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 2 || bytes.length > PRIVATE_WORKFLOW_V2_POLICY.githubResponseByteLimit) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.GITHUB_METADATA_INVALID);
    }
    let metadata;
    try {
      metadata = JSON.parse(bytes.toString("utf8"));
    } catch {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.GITHUB_METADATA_INVALID);
    }
    if (String(metadata.id) !== artifactId
      || metadata.expired !== false
      || metadata.name !== `${PRIVATE_WORKFLOW_V2_POLICY.artifactNamePrefix}-${approvedCommit}`
      || metadata.digest !== `sha256:${expectedZipSha256}`
      || String(metadata.workflow_run?.id) !== runId
      || metadata.workflow_run?.head_sha !== approvedCommit) {
      fail(PRIVATE_WORKFLOW_V2_FAILURE.GITHUB_METADATA_INVALID);
    }
    return Object.freeze({ status: "PRIVATE_WORKER_V2_ARTIFACT_METADATA_VERIFIED" });
  } finally {
    clearTimeout(timeout);
    delete headers.Authorization;
    token = "";
    if (bytes) bytes.fill(0);
  }
}

export function releaseDirectoryFromEnvironment(environment) {
  const path = environment.PROMETHEUS_QUALIFIED_RELEASE_PATH;
  if (typeof path !== "string" || path.length < 1 || !isAbsolute(path)) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
  return resolve(path);
}

export function writePrivateV2QualificationOutputs(path, result) {
  if (typeof path !== "string" || path.length < 1 || !result) {
    fail(PRIVATE_WORKFLOW_V2_FAILURE.INPUT_INVALID);
  }
  const lines = [
    `qualified_content_tree_sha256=${result.contentTreeSha256}`,
    `qualified_manifest_sha256=${result.manifestSha256}`,
    `forward_payload_sha256=${result.forwardPayloadSha256}`,
    `deployment_assets_sha256=${result.deploymentAssetsSha256}`,
    `rollback_contract_sha256=${result.rollbackContractSha256}`,
    `rollback_bundle_sha256=${result.rollbackBundleSha256}`,
    `workflow_contract_sha256=${result.workflowContractSha256}`
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, { encoding: "ascii", mode: 0o600, flag: "a" });
}

export function formatPrivateWorkflowV2Failure(error) {
  if (error instanceof PrivateWorkflowV2Error || error instanceof DeploymentPolicyError) {
    return error.code;
  }
  if (error instanceof CloudflareUnattendedSmokeError
    && Object.values(CLOUDFLARE_UNATTENDED_SMOKE_FAILURE).includes(error.dimension)) {
    return `SMOKE_FAILURE|DIMENSION=${error.dimension}`;
  }
  if (error instanceof PublicDeploymentPolicyError
    && PUBLIC_FAILURE_CODES.has(error.code)) {
    let phase = "UNSPECIFIED";
    let reason = "UNSPECIFIED";
    for (const diagnostic of error.diagnostics) {
      const [key, value] = diagnostic.split("=", 2);
      if (key === "CLOUDFLARE_READ_PHASE" && PUBLIC_READ_PHASES.has(value)) phase = value;
      if (key === "WRANGLER_PHASE" && PUBLIC_WRANGLER_PHASES.has(value)) phase = value;
      if (key === "WRANGLER_FAILURE_REASON" && PUBLIC_WRANGLER_REASONS.has(value)) reason = value;
    }
    return `PUBLIC_DEPLOYMENT_POLICY_FAILURE|CODE=${error.code}|PHASE=${phase}|REASON=${reason}`;
  }
  return PRIVATE_WORKFLOW_V2_FAILURE.QUALIFICATION_FAILED;
}

export function createPrivateV2EvidenceDirectory(environment = process.env) {
  const base = environment.RUNNER_TEMP || tmpdir();
  return join(base, `prometheus-private-deployment-v2-${environment.GITHUB_RUN_ID || "local"}`);
}

export function removePrivateV2TemporaryDirectory(path) {
  rmSync(path, { recursive: true, force: true });
}

export const privateWorkflowV2SecretEnvironmentNames = SECRET_ENVIRONMENT_NAMES;
