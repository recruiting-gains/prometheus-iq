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
import { dirname, join, resolve } from "node:path";

import {
  scrubDeploymentCredentials,
  takeDeploymentCredentials
} from "./github-actions-private-worker-deployment.mjs";
import {
  fetchPublicWorkerState
} from "./github-actions-public-worker-deployment.mjs";
import {
  CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY
} from "../run-cloudflare-unattended-smoke.mjs";
import {
  PRIVATE_WORKFLOW_V2_FAILURE,
  PRIVATE_WORKFLOW_V2_PHASE,
  PRIVATE_WORKFLOW_V2_POLICY,
  PrivateWorkflowV2Error,
  buildQualifiedPrivateWranglerInvocation,
  canonicalPrivateWorkflowJson,
  currentPrivateV2RuntimeIdentity,
  formatPrivateWorkflowV2Failure,
  privateV2PredeploymentSmokeMarkerPolicy,
  privateWorkflowV2SecretEnvironmentNames,
  releaseDirectoryFromEnvironment,
  runQualifiedPrivateDeploymentLifecycle,
  sha256PrivateWorkflowFile,
  verifyQualifiedPrivateRelease
} from "./github-actions-private-worker-workflow-v2.mjs";
import {
  runPrivateWorkerArtifactMetadataV2Command
} from "../run-github-actions-private-worker-artifact-metadata-v2.mjs";
import {
  runPrivateWorkerDeploymentV2Command
} from "../run-github-actions-private-worker-deployment-v2.mjs";
import {
  runPrivateWorkerQualificationV2Command
} from "../run-github-actions-private-worker-qualification-v2.mjs";

export const AUTONOMOUS_ENGINEERING_V1_POLICY = Object.freeze({
  contractVersion: "github-hosted-autonomous-engineering-v1",
  contractPath:
    "workers/infrastructure/github-hosted-autonomous-engineering-v1.json",
  workflowName: "Prometheus GitHub-Hosted Autonomous Engineering v1",
  workflowPath:
    ".github/workflows/github-hosted-autonomous-engineering-v1.yml",
  workflowRef:
    "PrometheusRouteIQ/prometheus-iq/.github/workflows/github-hosted-autonomous-engineering-v1.yml@refs/heads/main",
  libraryPath: "scripts/lib/github-hosted-autonomous-engineering-v1.mjs",
  runnerPath: "scripts/run-github-hosted-autonomous-engineering-v1.mjs",
  verifierPath: "scripts/verify-github-hosted-autonomous-engineering-v1.mjs",
  testPath:
    "tests/github-hosted-autonomous-engineering-infrastructure-v1.test.mjs",
  documentationPath: "docs/github-hosted-autonomous-engineering-v1.md",
  repository: "PrometheusRouteIQ/prometheus-iq",
  branch: "main",
  ref: "refs/heads/main",
  refType: "branch",
  eventName: "workflow_dispatch",
  founderActor: "PrometheusRouteIQ",
  founderAuthorization:
    "I AUTHORIZE THIS EXACT PROMETHEUS PRIVATE WORKER DEPLOYMENT",
  firstRunAttempt: "1",
  baselineCommit: "278deb57eef0558fbf2666ed6962cbbd73dad42d",
  baselineTree: "e2464723b8ac82dfebaf4bed6bc41a800e5a7c76",
  runner: "ubuntu-24.04",
  architecture: "X64",
  nodeVersion: "24.4.1",
  protectedEnvironment: "prometheus-private-worker-production",
  artifactRetentionDays: 30,
  maximumRepairAttempts: 2,
  maximumChangedFiles: 16,
  maximumChangedLines: 5000,
  maximumChangedPatchBytes: 524288,
  maximumChangedFileBytes: 524288,
  maximumSuccessorCommits: 6,
  maximumWorkflowRecursionDepth: 0,
  maximumInRunTransientRecoveryAttempts: 1,
  maximumWallClockMinutes: 290,
  evidenceFileMode: 0o400,
  evidenceDirectoryMode: 0o700,
  infrastructureIdentity:
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
  overwatchIdentity: "Prometheus Overwatch <overwatch@prometheus.local>",
  infrastructureOwnedPaths: Object.freeze([
    ".github/workflows/github-hosted-autonomous-engineering-v1.yml",
    "docs/github-hosted-autonomous-engineering-v1.md",
    "scripts/lib/github-hosted-autonomous-engineering-v1.mjs",
    "scripts/run-github-hosted-autonomous-engineering-v1.mjs",
    "scripts/verify-github-hosted-autonomous-engineering-v1.mjs",
    "tests/github-hosted-autonomous-engineering-infrastructure-v1.test.mjs",
    "workers/infrastructure/github-hosted-autonomous-engineering-v1.json"
  ]),
  overwatchOwnedPaths: Object.freeze([
    "package.json",
    "overwatch/governance/github-hosted-autonomous-engineering-v1.json",
    "overwatch/governance/github-hosted-autonomous-engineering-v1.md",
    "overwatch/reports/github-hosted-autonomous-engineering-v1.json",
    "scripts/verify-overwatch-github-hosted-autonomous-engineering-v1.mjs",
    "tests/overwatch-github-hosted-autonomous-engineering-v1.test.mjs"
  ])
});

export const AUTONOMOUS_ENGINEERING_V1_FAILURE = Object.freeze({
  INPUT_INVALID: "AUTONOMOUS_INPUT_INVALID",
  CONTEXT_INVALID: "AUTONOMOUS_CONTEXT_INVALID",
  REPOSITORY_INVALID: "AUTONOMOUS_REPOSITORY_INVALID",
  REPAIR_SCOPE_INVALID: "AUTONOMOUS_REPAIR_SCOPE_INVALID",
  OWNER_INVALID: "AUTONOMOUS_OWNER_INVALID",
  SECRET_BOUNDARY_INVALID: "AUTONOMOUS_SECRET_BOUNDARY_INVALID",
  SOURCE_VERIFICATION_FAILED: "AUTONOMOUS_SOURCE_VERIFICATION_FAILED",
  TRANSIENT_RECOVERY_INVALID: "AUTONOMOUS_TRANSIENT_RECOVERY_INVALID",
  ARTIFACT_INVALID: "AUTONOMOUS_ARTIFACT_INVALID",
  ROLLBACK_DEMONSTRATION_FAILED: "AUTONOMOUS_ROLLBACK_DEMONSTRATION_FAILED",
  RECOVERY_VERIFICATION_FAILED: "AUTONOMOUS_RECOVERY_VERIFICATION_FAILED",
  PRODUCTION_IDENTITY_MISMATCH: "AUTONOMOUS_PRODUCTION_IDENTITY_MISMATCH",
  DEPLOYMENT_FAILED: "AUTONOMOUS_DEPLOYMENT_FAILED",
  EVIDENCE_INVALID: "AUTONOMOUS_EVIDENCE_INVALID"
});

const SHA40 = /^[0-9a-f]{40}$/u;
const SHA64 = /^[0-9a-f]{64}$/u;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const BATCH_ID = /^BATCH-[0-9]{8}-[0-9]{3}$/u;
const POSITIVE_INTEGER = /^[1-9][0-9]{0,15}$/u;
const REPAIR_ATTEMPT = /^[0-2]$/u;
const MAX_EVIDENCE_BYTES = 1024 * 1024;
const AUTONOMOUS_INPUT_NAMES = Object.freeze([
  "candidate_commit",
  "candidate_tree",
  "batch_id",
  "current_public_version",
  "current_private_version",
  "repair_attempt",
  "founder_authorization"
]);
const QUALIFICATION_OUTPUT_NAMES = Object.freeze([
  "qualification_artifact_id",
  "qualification_artifact_zip_sha256",
  "qualified_content_tree_sha256",
  "qualified_manifest_sha256",
  "forward_payload_sha256",
  "deployment_assets_sha256",
  "rollback_contract_sha256",
  "rollback_bundle_sha256",
  "workflow_contract_sha256",
  "autonomous_contract_sha256"
]);
const TRANSIENT_OUTPUT_PATTERNS = Object.freeze([
  "eai_again",
  "econnreset",
  "enotfound",
  "etimedout",
  "socket hang up",
  "network request failed",
  "network timeout",
  "503 service unavailable",
  "502 bad gateway"
]);
const TRANSIENT_ERROR_CODES = Object.freeze([
  "EAI_AGAIN",
  "ECONNRESET",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT"
]);
const CHILD_ENVIRONMENT_SECRET_NAME =
  /(?:AUTHORIZATION|COOKIE|CREDENTIAL|PASSWORD|PRIVATE_KEY|SECRET|TOKEN)/iu;
const FULL_SUITE_COMMANDS = Object.freeze([
  Object.freeze({
    id: "DEPENDENCY_INSTALL",
    command: "npm",
    argumentsList: Object.freeze(["ci"]),
    transientClassification: "DEPENDENCY_TRANSPORT_TRANSIENT",
    timeoutMs: 15 * 60 * 1000
  }),
  Object.freeze({
    id: "PRODUCTION_DEPENDENCY_AUDIT",
    command: "npm",
    argumentsList: Object.freeze(["audit", "--omit=dev", "--audit-level=high"]),
    transientClassification: "AUDIT_TRANSPORT_TRANSIENT",
    timeoutMs: 5 * 60 * 1000
  }),
  Object.freeze({
    id: "FULL_REPOSITORY_TEST",
    command: "npm",
    argumentsList: Object.freeze(["test"]),
    transientClassification: null,
    timeoutMs: 80 * 60 * 1000
  }),
  Object.freeze({
    id: "LINT",
    command: "npm",
    argumentsList: Object.freeze(["run", "lint"]),
    transientClassification: null,
    timeoutMs: 10 * 60 * 1000
  }),
  Object.freeze({
    id: "TYPECHECK",
    command: "npm",
    argumentsList: Object.freeze(["run", "typecheck"]),
    transientClassification: null,
    timeoutMs: 10 * 60 * 1000
  }),
  Object.freeze({
    id: "SECURITY",
    command: "npm",
    argumentsList: Object.freeze(["run", "security:check"]),
    transientClassification: null,
    timeoutMs: 10 * 60 * 1000
  }),
  Object.freeze({
    id: "SECRET_SCAN",
    command: process.execPath,
    argumentsList: Object.freeze([
      "scripts/check-cloudflare-unattended-secret-presence.mjs",
      "--source=environment"
    ]),
    transientClassification: null,
    timeoutMs: 10 * 60 * 1000
  }),
  Object.freeze({
    id: "AEGIS",
    command: "npm",
    argumentsList: Object.freeze(["run", "security:aegis:verify"]),
    transientClassification: null,
    timeoutMs: 10 * 60 * 1000
  }),
  Object.freeze({
    id: "ARTIFACT_CONTRACTS",
    command: process.execPath,
    argumentsList: Object.freeze([
      "scripts/verify-cross-subsystem-artifact-contracts.mjs"
    ]),
    transientClassification: null,
    timeoutMs: 10 * 60 * 1000
  }),
  Object.freeze({
    id: "PRIVATE_V2_VERIFIER",
    command: process.execPath,
    argumentsList: Object.freeze([
      "scripts/verify-github-actions-private-worker-workflow-v2.mjs"
    ]),
    transientClassification: null,
    timeoutMs: 10 * 60 * 1000
  }),
  Object.freeze({
    id: "PRIVATE_V2_TESTS",
    command: process.execPath,
    argumentsList: Object.freeze([
      "--test",
      "tests/github-actions-private-worker-workflow-v2.test.mjs"
    ]),
    transientClassification: null,
    timeoutMs: 20 * 60 * 1000
  }),
  Object.freeze({
    id: "AUTONOMOUS_VERIFIER",
    command: process.execPath,
    argumentsList: Object.freeze([
      "scripts/verify-github-hosted-autonomous-engineering-v1.mjs"
    ]),
    transientClassification: null,
    timeoutMs: 10 * 60 * 1000
  }),
  Object.freeze({
    id: "AUTONOMOUS_TESTS",
    command: process.execPath,
    argumentsList: Object.freeze([
      "--test",
      "tests/github-hosted-autonomous-engineering-infrastructure-v1.test.mjs"
    ]),
    transientClassification: null,
    timeoutMs: 20 * 60 * 1000
  })
]);
const SUCCESS_PHASES = Object.freeze([
  PRIVATE_WORKFLOW_V2_PHASE.DEPLOYMENT_NOT_BEGUN,
  PRIVATE_WORKFLOW_V2_PHASE.LOCAL_PREFLIGHT_PASSED,
  PRIVATE_WORKFLOW_V2_PHASE.PRODUCTION_PREREQUISITES_PASSED,
  PRIVATE_WORKFLOW_V2_PHASE.PREDEPLOYMENT_SMOKE_PASSED,
  PRIVATE_WORKFLOW_V2_PHASE.AUTHORIZATION_CONSUMED,
  PRIVATE_WORKFLOW_V2_PHASE.DEPLOYMENT_REQUEST_COMPLETED,
  PRIVATE_WORKFLOW_V2_PHASE.POST_DEPLOYMENT_VERIFIED,
  PRIVATE_WORKFLOW_V2_PHASE.POSTDEPLOYMENT_SMOKE_PASSED
]);
const ROLLBACK_PHASES = Object.freeze([
  PRIVATE_WORKFLOW_V2_PHASE.DEPLOYMENT_NOT_BEGUN,
  PRIVATE_WORKFLOW_V2_PHASE.LOCAL_PREFLIGHT_PASSED,
  PRIVATE_WORKFLOW_V2_PHASE.PRODUCTION_PREREQUISITES_PASSED,
  PRIVATE_WORKFLOW_V2_PHASE.PREDEPLOYMENT_SMOKE_PASSED,
  PRIVATE_WORKFLOW_V2_PHASE.AUTHORIZATION_CONSUMED,
  PRIVATE_WORKFLOW_V2_PHASE.DEPLOYMENT_REQUEST_COMPLETED,
  PRIVATE_WORKFLOW_V2_PHASE.POST_DEPLOYMENT_VERIFIED,
  PRIVATE_WORKFLOW_V2_PHASE.CRITICAL_FAILURE_DETECTED,
  PRIVATE_WORKFLOW_V2_PHASE.ROLLBACK_REQUEST_BEGUN,
  PRIVATE_WORKFLOW_V2_PHASE.ROLLBACK_VERIFIED
]);
const PROTECTED_STATE = Object.freeze({
  collection: "OFF",
  activeCohortCount: 0,
  recommendationInfluence: "OFF",
  providerRefresh: "OFF",
  scheduler: "OFF",
  customerActivation: "OFF",
  anthonyMapped: false,
  activeBusinessCount: 0,
  reserveBusinessCount: 0,
  quarantinedBusinessCount: 398,
  crmReceipt: "riq_receipt_e74e57903a211291a9f1f37a",
  crmMutationPerformed: false,
  customerDataMutationPerformed: false,
  publicWorkerMutationPerformed: false
});

export class AutonomousEngineeringV1Error extends Error {
  constructor(code) {
    super(code);
    this.name = "AutonomousEngineeringV1Error";
    this.code = code;
  }
}

function fail(code) {
  throw new AutonomousEngineeringV1Error(code);
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

function parseJson(value, failure = AUTONOMOUS_ENGINEERING_V1_FAILURE.INPUT_INVALID) {
  try {
    return JSON.parse(value || "");
  } catch {
    fail(failure);
  }
}

function boundedAbsolutePath(value) {
  return typeof value === "string"
    && value.startsWith("/")
    && value.length <= 4096;
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
  if (allowExitOne && result.status === 1 && !result.error && !result.signal) {
    return null;
  }
  if (result.status !== 0 || result.error || result.signal) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.REPOSITORY_INVALID);
  }
  return String(result.stdout || "").trim();
}

export function sha256AutonomousFile(path) {
  try {
    const stats = lstatSync(path);
    if (!stats.isFile()
      || stats.isSymbolicLink()
      || stats.size < 1
      || stats.size > MAX_EVIDENCE_BYTES * 32) {
      fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.EVIDENCE_INVALID);
    }
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch (error) {
    if (error instanceof AutonomousEngineeringV1Error) throw error;
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.EVIDENCE_INVALID);
  }
}

export function autonomousContractSha256(root) {
  return sha256AutonomousFile(resolve(
    root,
    AUTONOMOUS_ENGINEERING_V1_POLICY.contractPath
  ));
}

export function validateAutonomousEngineeringV1Context(environment) {
  const dispatch = parseJson(environment.PROMETHEUS_AUTONOMOUS_DISPATCH_INPUTS_JSON);
  const inputs = Object.freeze({
    candidateCommit: environment.PROMETHEUS_CANDIDATE_COMMIT,
    candidateTree: environment.PROMETHEUS_CANDIDATE_TREE,
    batchId: environment.PROMETHEUS_BATCH_ID,
    currentPublicVersion: environment.PROMETHEUS_CURRENT_PUBLIC_VERSION,
    currentPrivateVersion: environment.PROMETHEUS_CURRENT_PRIVATE_VERSION,
    repairAttempt: environment.PROMETHEUS_REPAIR_ATTEMPT,
    founderAuthorization: environment.PROMETHEUS_FOUNDER_AUTHORIZATION
  });
  if (!SHA40.test(inputs.candidateCommit || "")
    || !SHA40.test(inputs.candidateTree || "")
    || !BATCH_ID.test(inputs.batchId || "")
    || !UUID.test(inputs.currentPublicVersion || "")
    || !UUID.test(inputs.currentPrivateVersion || "")
    || !REPAIR_ATTEMPT.test(inputs.repairAttempt || "")
    || Number(inputs.repairAttempt)
      > AUTONOMOUS_ENGINEERING_V1_POLICY.maximumRepairAttempts
    || inputs.founderAuthorization
      !== AUTONOMOUS_ENGINEERING_V1_POLICY.founderAuthorization
    || !exactKeys(dispatch, AUTONOMOUS_INPUT_NAMES)
    || dispatch.candidate_commit !== inputs.candidateCommit
    || dispatch.candidate_tree !== inputs.candidateTree
    || dispatch.batch_id !== inputs.batchId
    || dispatch.current_public_version !== inputs.currentPublicVersion
    || dispatch.current_private_version !== inputs.currentPrivateVersion
    || dispatch.repair_attempt !== inputs.repairAttempt
    || dispatch.founder_authorization !== inputs.founderAuthorization) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.INPUT_INVALID);
  }
  if (environment.GITHUB_REPOSITORY
      !== AUTONOMOUS_ENGINEERING_V1_POLICY.repository
    || environment.GITHUB_REF !== AUTONOMOUS_ENGINEERING_V1_POLICY.ref
    || environment.GITHUB_REF_NAME !== AUTONOMOUS_ENGINEERING_V1_POLICY.branch
    || environment.GITHUB_REF_TYPE !== AUTONOMOUS_ENGINEERING_V1_POLICY.refType
    || environment.GITHUB_EVENT_NAME
      !== AUTONOMOUS_ENGINEERING_V1_POLICY.eventName
    || environment.GITHUB_ACTOR
      !== AUTONOMOUS_ENGINEERING_V1_POLICY.founderActor
    || environment.GITHUB_TRIGGERING_ACTOR
      !== AUTONOMOUS_ENGINEERING_V1_POLICY.founderActor
    || environment.GITHUB_WORKFLOW
      !== AUTONOMOUS_ENGINEERING_V1_POLICY.workflowName
    || environment.GITHUB_WORKFLOW_REF
      !== AUTONOMOUS_ENGINEERING_V1_POLICY.workflowRef
    || environment.GITHUB_RUN_ATTEMPT
      !== AUTONOMOUS_ENGINEERING_V1_POLICY.firstRunAttempt
    || environment.GITHUB_SHA !== inputs.candidateCommit
    || !POSITIVE_INTEGER.test(environment.GITHUB_RUN_ID || "")) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.CONTEXT_INVALID);
  }
  return inputs;
}

export function autonomousPathOwner(path) {
  if (AUTONOMOUS_ENGINEERING_V1_POLICY.infrastructureOwnedPaths.includes(path)) {
    return "INFRASTRUCTURE";
  }
  if (AUTONOMOUS_ENGINEERING_V1_POLICY.overwatchOwnedPaths.includes(path)) {
    return "OVERWATCH";
  }
  return null;
}

export function validateAutonomousRepairScope({
  changedPaths,
  changedLineCount,
  changedPatchBytes,
  changedFileBytes,
  repairAttempt,
  successorCommitCount,
  recursionDepth = 0
}) {
  if (!Array.isArray(changedPaths)
    || changedPaths.length < 1
    || changedPaths.length
      > AUTONOMOUS_ENGINEERING_V1_POLICY.maximumChangedFiles
    || !Number.isInteger(changedLineCount)
    || changedLineCount < 1
    || changedLineCount
      > AUTONOMOUS_ENGINEERING_V1_POLICY.maximumChangedLines
    || !Number.isInteger(changedPatchBytes)
    || changedPatchBytes < 1
    || changedPatchBytes
      > AUTONOMOUS_ENGINEERING_V1_POLICY.maximumChangedPatchBytes
    || !Number.isInteger(changedFileBytes)
    || changedFileBytes < 1
    || changedFileBytes
      > AUTONOMOUS_ENGINEERING_V1_POLICY.maximumChangedFileBytes
    || !Number.isInteger(repairAttempt)
    || repairAttempt < 0
    || repairAttempt > AUTONOMOUS_ENGINEERING_V1_POLICY.maximumRepairAttempts
    || !Number.isInteger(successorCommitCount)
    || successorCommitCount < 1
    || successorCommitCount
      > AUTONOMOUS_ENGINEERING_V1_POLICY.maximumSuccessorCommits
    || recursionDepth
      !== AUTONOMOUS_ENGINEERING_V1_POLICY.maximumWorkflowRecursionDepth
    || new Set(changedPaths).size !== changedPaths.length
    || changedPaths.some(path => typeof path !== "string" || !autonomousPathOwner(path))) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.REPAIR_SCOPE_INVALID);
  }
  return Object.freeze({
    changedFileCount: changedPaths.length,
    changedLineCount,
    changedPatchBytes,
    changedFileBytes,
    successorCommitCount,
    repairAttempt,
    recursionDepth
  });
}

function changedLineCount(output) {
  if (output === "") {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.REPAIR_SCOPE_INVALID);
  }
  let total = 0;
  for (const line of output.split("\n")) {
    const [added, deleted, path, ...extra] = line.split("\t");
    if (extra.length > 0
      || !/^[0-9]+$/u.test(added || "")
      || !/^[0-9]+$/u.test(deleted || "")
      || !autonomousPathOwner(path)) {
      fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.REPAIR_SCOPE_INVALID);
    }
    total += Number(added) + Number(deleted);
  }
  return total;
}

function assertRegularGitModes(changedPaths, gitModes) {
  if (!Array.isArray(gitModes) || gitModes.length !== changedPaths.length) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.REPAIR_SCOPE_INVALID);
  }
  for (const [index, path] of changedPaths.entries()) {
    const entry = gitModes[index];
    if (!/^100644 [0-9a-f]{40,64} 0\t/u.test(entry)
      || !entry.endsWith(`\t${path}`)) {
      fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.REPAIR_SCOPE_INVALID);
    }
  }
}

function parseChangedPaths(output) {
  if (output === "") return [];
  return output.split("\n").map(line => {
    const [status, ...parts] = line.split("\t");
    if (!["A", "M"].includes(status) || parts.length !== 1) {
      fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.REPAIR_SCOPE_INVALID);
    }
    return parts[0];
  });
}

export function validateAutonomousDiffShape({
  nameStatus,
  numstat,
  summary,
  gitModes
}) {
  const changedPaths = parseChangedPaths(nameStatus);
  if (summary !== ""
    && summary.split("\n").some(line =>
      !/^create mode 100644 /u.test(line))) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.REPAIR_SCOPE_INVALID);
  }
  const lineCount = changedLineCount(numstat);
  assertRegularGitModes(changedPaths, gitModes);
  return Object.freeze({
    changedPaths: Object.freeze(changedPaths),
    changedLineCount: lineCount
  });
}

export function validateAutonomousFilesystemPaths(root, changedPaths) {
  let changedFileBytes = 0;
  for (const path of changedPaths) {
    const stats = lstatSync(resolve(root, path));
    if (!stats.isFile() || stats.isSymbolicLink()) {
      fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.REPAIR_SCOPE_INVALID);
    }
    changedFileBytes += stats.size;
  }
  return changedFileBytes;
}

function verifyCommitOwners(root, commits) {
  for (const commit of commits) {
    const metadata = runGit(root, [
      "show",
      "-s",
      "--format=%an <%ae>%x00%cn <%ce>",
      commit
    ]).split("\0");
    const paths = runGit(root, [
      "diff-tree",
      "--no-commit-id",
      "--name-only",
      "-r",
      commit
    ]).split("\n").filter(Boolean);
    const owners = new Set(paths.map(autonomousPathOwner));
    if (owners.size !== 1 || owners.has(null)) {
      fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.OWNER_INVALID);
    }
    const expected = owners.has("INFRASTRUCTURE")
      ? AUTONOMOUS_ENGINEERING_V1_POLICY.infrastructureIdentity
      : AUTONOMOUS_ENGINEERING_V1_POLICY.overwatchIdentity;
    if (metadata.length !== 2
      || metadata[0] !== expected
      || metadata[1] !== expected) {
      fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.OWNER_INVALID);
    }
  }
}

export function verifyAutonomousEngineeringV1Repository(root, inputs) {
  const head = runGit(root, ["rev-parse", "HEAD"]);
  const originMain = runGit(root, ["rev-parse", "refs/remotes/origin/main"]);
  const tree = runGit(root, ["rev-parse", "HEAD^{tree}"]);
  const baselineTree = runGit(root, [
    "rev-parse",
    `${AUTONOMOUS_ENGINEERING_V1_POLICY.baselineCommit}^{tree}`
  ]);
  const branch = runGit(root, ["branch", "--show-current"]);
  const status = runGit(root, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all"
  ]);
  runGit(root, [
    "merge-base",
    "--is-ancestor",
    AUTONOMOUS_ENGINEERING_V1_POLICY.baselineCommit,
    inputs.candidateCommit
  ]);
  const mergeCommits = runGit(root, [
    "rev-list",
    "--merges",
    `${AUTONOMOUS_ENGINEERING_V1_POLICY.baselineCommit}..${inputs.candidateCommit}`
  ]);
  const commits = runGit(root, [
    "rev-list",
    "--reverse",
    `${AUTONOMOUS_ENGINEERING_V1_POLICY.baselineCommit}..${inputs.candidateCommit}`
  ]).split("\n").filter(Boolean);
  const nameStatus = runGit(root, [
    "diff",
    "--name-status",
    `${AUTONOMOUS_ENGINEERING_V1_POLICY.baselineCommit}..${inputs.candidateCommit}`
  ]);
  const diffSummary = runGit(root, [
    "diff",
    "--summary",
    `${AUTONOMOUS_ENGINEERING_V1_POLICY.baselineCommit}..${inputs.candidateCommit}`
  ]);
  const numstat = runGit(root, [
    "diff",
    "--numstat",
    `${AUTONOMOUS_ENGINEERING_V1_POLICY.baselineCommit}..${inputs.candidateCommit}`
  ]);
  const provisionalPaths = parseChangedPaths(nameStatus);
  const shape = validateAutonomousDiffShape({
    nameStatus,
    numstat,
    summary: diffSummary,
    gitModes: provisionalPaths.map(path =>
      runGit(root, ["ls-files", "-s", "--", path]))
  });
  const changedPaths = [...shape.changedPaths];
  const patchBytes = Buffer.byteLength(runGit(root, [
    "diff",
    "--binary",
    "--no-ext-diff",
    `${AUTONOMOUS_ENGINEERING_V1_POLICY.baselineCommit}..${inputs.candidateCommit}`
  ]), "utf8");
  if (head !== inputs.candidateCommit
    || originMain !== inputs.candidateCommit
    || tree !== inputs.candidateTree
    || baselineTree !== AUTONOMOUS_ENGINEERING_V1_POLICY.baselineTree
    || branch !== AUTONOMOUS_ENGINEERING_V1_POLICY.branch
    || status !== ""
    || mergeCommits !== "") {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.REPOSITORY_INVALID);
  }
  const scope = validateAutonomousRepairScope({
    changedPaths,
    changedLineCount: shape.changedLineCount,
    changedPatchBytes: patchBytes,
    changedFileBytes: validateAutonomousFilesystemPaths(root, changedPaths),
    repairAttempt: Number(inputs.repairAttempt),
    successorCommitCount: commits.length,
    recursionDepth: 0
  });
  verifyCommitOwners(root, commits);
  runGit(root, [
    "diff",
    "--check",
    `${AUTONOMOUS_ENGINEERING_V1_POLICY.baselineCommit}..${inputs.candidateCommit}`
  ]);
  return Object.freeze({
    head,
    tree,
    originMain,
    changedPaths: Object.freeze(changedPaths),
    ...scope
  });
}

function qualificationDispatch(inputs) {
  return {
    candidate_commit: inputs.candidateCommit,
    candidate_tree: inputs.candidateTree,
    batch_id: inputs.batchId,
    current_public_version: inputs.currentPublicVersion,
    current_private_version: inputs.currentPrivateVersion
  };
}

function deploymentDispatch(inputs, environment) {
  return {
    approved_commit: inputs.candidateCommit,
    approved_tree: inputs.candidateTree,
    batch_id: inputs.batchId,
    current_public_version: inputs.currentPublicVersion,
    current_private_version: inputs.currentPrivateVersion,
    qualification_run_id: environment.PROMETHEUS_QUALIFICATION_RUN_ID,
    qualification_artifact_id: environment.PROMETHEUS_QUALIFICATION_ARTIFACT_ID,
    qualification_artifact_zip_sha256:
      environment.PROMETHEUS_QUALIFICATION_ARTIFACT_ZIP_SHA256,
    qualified_content_tree_sha256:
      environment.PROMETHEUS_QUALIFIED_CONTENT_TREE_SHA256,
    qualified_manifest_sha256:
      environment.PROMETHEUS_QUALIFIED_MANIFEST_SHA256,
    workflow_contract_sha256: environment.PROMETHEUS_WORKFLOW_CONTRACT_SHA256,
    rollback_contract_sha256: environment.PROMETHEUS_ROLLBACK_CONTRACT_SHA256,
    rollback_bundle_sha256: environment.PROMETHEUS_ROLLBACK_BUNDLE_SHA256,
    founder_authorization: inputs.founderAuthorization
  };
}

export function projectAutonomousQualificationEnvironment(environment, inputs) {
  return {
    ...environment,
    GITHUB_WORKFLOW: PRIVATE_WORKFLOW_V2_POLICY.qualificationWorkflowName,
    GITHUB_WORKFLOW_REF: PRIVATE_WORKFLOW_V2_POLICY.qualificationWorkflowRef,
    PROMETHEUS_CANDIDATE_COMMIT: inputs.candidateCommit,
    PROMETHEUS_CANDIDATE_TREE: inputs.candidateTree,
    PROMETHEUS_BATCH_ID: inputs.batchId,
    PROMETHEUS_CURRENT_PUBLIC_VERSION: inputs.currentPublicVersion,
    PROMETHEUS_CURRENT_PRIVATE_VERSION: inputs.currentPrivateVersion,
    PROMETHEUS_DISPATCH_INPUTS_JSON: JSON.stringify(qualificationDispatch(inputs))
  };
}

export function projectAutonomousDeploymentEnvironment(environment, inputs) {
  const dispatch = deploymentDispatch(inputs, environment);
  return {
    ...environment,
    GITHUB_WORKFLOW: PRIVATE_WORKFLOW_V2_POLICY.deploymentWorkflowName,
    GITHUB_WORKFLOW_REF: PRIVATE_WORKFLOW_V2_POLICY.deploymentWorkflowRef,
    PROMETHEUS_APPROVED_COMMIT: inputs.candidateCommit,
    PROMETHEUS_APPROVED_TREE: inputs.candidateTree,
    PROMETHEUS_BATCH_ID: inputs.batchId,
    PROMETHEUS_CURRENT_PUBLIC_VERSION: inputs.currentPublicVersion,
    PROMETHEUS_CURRENT_PRIVATE_VERSION: inputs.currentPrivateVersion,
    PROMETHEUS_FOUNDER_AUTHORIZATION: inputs.founderAuthorization,
    PROMETHEUS_DISPATCH_INPUTS_JSON: JSON.stringify(dispatch)
  };
}

function appendOutputs(path, values) {
  if (!boundedAbsolutePath(path) || !isPlainObject(values)) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.EVIDENCE_INVALID);
  }
  const lines = Object.entries(values).map(([key, value]) => {
    if (!/^[a-z][a-z0-9_]*$/u.test(key)
      || !/^[0-9A-Z_a-z-]+$/u.test(String(value))) {
      fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.EVIDENCE_INVALID);
    }
    return `${key}=${value}`;
  });
  writeFileSync(path, `${lines.join("\n")}\n`, {
    encoding: "ascii",
    mode: 0o600,
    flag: "a"
  });
}

function secretFree(environment) {
  return privateWorkflowV2SecretEnvironmentNames.every(name => (
    typeof environment[name] !== "string" || environment[name].length === 0
  ));
}

function isolateCloudflareDeploymentCredentials(environment) {
  const names = [
    ["CLOUDFLARE", "API", "TOKEN"].join("_"),
    ["CLOUDFLARE", "ACCOUNT", "ID"].join("_")
  ];
  const credentialEnvironment = {};
  for (const name of names) {
    credentialEnvironment[name] = environment[name];
    delete environment[name];
  }
  return credentialEnvironment;
}

function noSecretChildEnvironment(environment) {
  const childEnvironment = {};
  for (const [name, value] of Object.entries(environment)) {
    if (!CHILD_ENVIRONMENT_SECRET_NAME.test(name)
      && !privateWorkflowV2SecretEnvironmentNames.includes(name)
      && name !== "CLOUDFLARE_ACCOUNT_ID") {
      childEnvironment[name] = value;
    }
  }
  childEnvironment.CI = "true";
  childEnvironment.NO_COLOR = "1";
  childEnvironment.GIT_TERMINAL_PROMPT = "0";
  return childEnvironment;
}

function transientClassification(command, result) {
  if (!command.transientClassification) return null;
  const errorCode = result?.error?.code;
  const output = `${String(result?.stdout || "")}\n${String(result?.stderr || "")}`
    .toLowerCase();
  return TRANSIENT_ERROR_CODES.includes(errorCode)
      || TRANSIENT_OUTPUT_PATTERNS.some(pattern => output.includes(pattern))
    ? command.transientClassification
    : null;
}

function runSuiteCommand(root, environment, command, spawnImpl) {
  let result;
  try {
    result = spawnImpl(command.command, [...command.argumentsList], {
      cwd: root,
      env: noSecretChildEnvironment(environment),
      stdio: ["ignore", "pipe", "pipe"],
      timeout: command.timeoutMs,
      maxBuffer: 8 * 1024 * 1024
    });
    if (result?.status === 0 && !result.error && !result.signal) {
      return Object.freeze({ status: "PASSED" });
    }
    return Object.freeze({
      status: "FAILED",
      transientClassification: transientClassification(command, result)
    });
  } finally {
    if (result) scrubBuffers(result);
  }
}

export function runAutonomousFullSuite({
  root,
  environment = process.env,
  spawnImpl = spawnSync
}) {
  validateAutonomousEngineeringV1Context(environment);
  if (!secretFree(environment)) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.SECRET_BOUNDARY_INVALID);
  }
  let completedCommandCount = 0;
  for (const command of FULL_SUITE_COMMANDS) {
    const result = runSuiteCommand(root, environment, command, spawnImpl);
    if (result.status === "PASSED") {
      completedCommandCount += 1;
      continue;
    }
    if (result.transientClassification) {
      appendOutputs(environment.GITHUB_OUTPUT, {
        suite_status: "TRANSIENT_FAILURE",
        suite_failure_classification: result.transientClassification,
        suite_completed_command_count: completedCommandCount
      });
      return Object.freeze({
        status: "GITHUB_HOSTED_AUTONOMOUS_TRANSIENT_RECOVERY_ELIGIBLE",
        suiteStatus: "TRANSIENT_FAILURE",
        failureClassification: result.transientClassification,
        completedCommandCount
      });
    }
    appendOutputs(environment.GITHUB_OUTPUT, {
      suite_status: "SOURCE_FAILURE",
      suite_failure_classification: "SOURCE_OR_VERIFICATION_FAILURE",
      suite_completed_command_count: completedCommandCount
    });
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.SOURCE_VERIFICATION_FAILED);
  }
  appendOutputs(environment.GITHUB_OUTPUT, {
    suite_status: "PASSED",
    suite_failure_classification: "NONE",
    suite_completed_command_count: completedCommandCount
  });
  return Object.freeze({
    status: "GITHUB_HOSTED_AUTONOMOUS_FULL_SUITE_PASSED",
    suiteStatus: "PASSED",
    failureClassification: "NONE",
    completedCommandCount
  });
}

function selectedQualificationOutputs(environment, prefix) {
  const values = {};
  for (const name of QUALIFICATION_OUTPUT_NAMES) {
    values[name] = environment[`${prefix}_${name.toUpperCase()}`];
  }
  if (!POSITIVE_INTEGER.test(values.qualification_artifact_id || "")
    || !QUALIFICATION_OUTPUT_NAMES.slice(1).every(name =>
      SHA64.test(values[name] || ""))) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.TRANSIENT_RECOVERY_INVALID);
  }
  return values;
}

export function selectAutonomousQualification({
  environment = process.env
}) {
  validateAutonomousEngineeringV1Context(environment);
  const primaryStatus = environment.PROMETHEUS_PRIMARY_SUITE_STATUS;
  const primaryResult = environment.PROMETHEUS_PRIMARY_JOB_RESULT;
  const recoveryStatus = environment.PROMETHEUS_RECOVERY_SUITE_STATUS;
  const recoveryResult = environment.PROMETHEUS_RECOVERY_JOB_RESULT;
  let selected;
  let inRunRecoveryAttempts;
  if (primaryResult === "success"
    && primaryStatus === "PASSED"
    && recoveryResult === "skipped"
    && !recoveryStatus) {
    selected = "PRIMARY";
    inRunRecoveryAttempts = 0;
  } else if (primaryResult === "success"
    && primaryStatus === "TRANSIENT_FAILURE"
    && recoveryResult === "success"
    && recoveryStatus === "PASSED") {
    selected = "RECOVERY";
    inRunRecoveryAttempts = 1;
  } else {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.TRANSIENT_RECOVERY_INVALID);
  }
  if (inRunRecoveryAttempts
      > AUTONOMOUS_ENGINEERING_V1_POLICY.maximumInRunTransientRecoveryAttempts) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.TRANSIENT_RECOVERY_INVALID);
  }
  const outputs = selectedQualificationOutputs(
    environment,
    `PROMETHEUS_${selected}`
  );
  appendOutputs(environment.GITHUB_OUTPUT, {
    ...outputs,
    selected_qualification: selected,
    in_run_recovery_attempts: inRunRecoveryAttempts
  });
  return Object.freeze({
    status: "GITHUB_HOSTED_AUTONOMOUS_QUALIFICATION_SELECTED",
    selectedQualification: selected,
    inRunRecoveryAttempts
  });
}

export function runAutonomousQualification({
  root,
  environment = process.env,
  qualificationImpl = runPrivateWorkerQualificationV2Command
}) {
  const inputs = validateAutonomousEngineeringV1Context(environment);
  const repository = verifyAutonomousEngineeringV1Repository(root, inputs);
  if (!secretFree(environment)) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.SECRET_BOUNDARY_INVALID);
  }
  const projected = projectAutonomousQualificationEnvironment(environment, inputs);
  const result = qualificationImpl({ mode: "build", environment: projected });
  appendOutputs(environment.GITHUB_OUTPUT, {
    autonomous_contract_sha256: autonomousContractSha256(root),
    changed_file_count: repository.changedFileCount,
    repair_attempt: inputs.repairAttempt
  });
  return Object.freeze({
    status: "GITHUB_HOSTED_AUTONOMOUS_QUALIFICATION_PASSED",
    result,
    repository
  });
}

function expectedArtifact(inputs, environment) {
  const values = {
    approvedCommit: inputs.candidateCommit,
    approvedTree: inputs.candidateTree,
    batchId: inputs.batchId,
    currentPublicVersion: inputs.currentPublicVersion,
    currentPrivateVersion: inputs.currentPrivateVersion,
    qualifiedContentTreeSha256:
      environment.PROMETHEUS_QUALIFIED_CONTENT_TREE_SHA256,
    qualifiedManifestSha256:
      environment.PROMETHEUS_QUALIFIED_MANIFEST_SHA256,
    workflowContractSha256: environment.PROMETHEUS_WORKFLOW_CONTRACT_SHA256,
    rollbackContractSha256: environment.PROMETHEUS_ROLLBACK_CONTRACT_SHA256,
    rollbackBundleSha256: environment.PROMETHEUS_ROLLBACK_BUNDLE_SHA256
  };
  if (![values.qualifiedContentTreeSha256, values.qualifiedManifestSha256,
    values.workflowContractSha256, values.rollbackContractSha256,
    values.rollbackBundleSha256].every(value => SHA64.test(value || ""))) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.ARTIFACT_INVALID);
  }
  return Object.freeze(values);
}

function verifyAutonomousContractPin(root, environment) {
  if (!SHA64.test(environment.PROMETHEUS_AUTONOMOUS_CONTRACT_SHA256 || "")
    || autonomousContractSha256(root)
      !== environment.PROMETHEUS_AUTONOMOUS_CONTRACT_SHA256) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.ARTIFACT_INVALID);
  }
}

export function validateAutonomousArtifactRunContext(environment) {
  validateAutonomousEngineeringV1Context(environment);
  if (!POSITIVE_INTEGER.test(environment.PROMETHEUS_QUALIFICATION_RUN_ID || "")
    || environment.PROMETHEUS_QUALIFICATION_RUN_ID
      !== environment.GITHUB_RUN_ID) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.ARTIFACT_INVALID);
  }
  return Object.freeze({
    qualificationRunId: environment.PROMETHEUS_QUALIFICATION_RUN_ID,
    workflow: environment.GITHUB_WORKFLOW,
    actor: environment.GITHUB_ACTOR,
    runAttempt: environment.GITHUB_RUN_ATTEMPT,
    ref: environment.GITHUB_REF
  });
}

export async function verifyAutonomousArtifact({
  root,
  environment = process.env,
  fetchImpl = globalThis.fetch,
  metadataImpl = runPrivateWorkerArtifactMetadataV2Command,
  qualificationImpl = runPrivateWorkerQualificationV2Command
}) {
  const inputs = validateAutonomousEngineeringV1Context(environment);
  verifyAutonomousEngineeringV1Repository(root, inputs);
  verifyAutonomousContractPin(root, environment);
  validateAutonomousArtifactRunContext(environment);
  if (!secretFree(environment)) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.SECRET_BOUNDARY_INVALID);
  }
  const projected = projectAutonomousDeploymentEnvironment(environment, inputs);
  await metadataImpl({
    mode: "verify",
    environment: { ...projected },
    fetchImpl
  });
  qualificationImpl({
    mode: "verify",
    environment: { ...projected }
  });
  return Object.freeze({
    status: "GITHUB_HOSTED_AUTONOMOUS_ARTIFACT_VERIFIED"
  });
}

export async function inspectAutonomousProductionBaseline({
  root,
  environment = process.env,
  fetchImpl = globalThis.fetch,
  fetchStateImpl = fetchPublicWorkerState
}) {
  const inputs = validateAutonomousEngineeringV1Context(environment);
  verifyAutonomousEngineeringV1Repository(root, inputs);
  let credentials;
  try {
    const credentialEnvironment =
      isolateCloudflareDeploymentCredentials(environment);
    credentials = takeDeploymentCredentials(credentialEnvironment);
    const publicState = await fetchStateImpl(
      PRIVATE_WORKFLOW_V2_POLICY.publicWorker,
      credentials,
      fetchImpl
    );
    const privateState = await fetchStateImpl(
      PRIVATE_WORKFLOW_V2_POLICY.privateWorker,
      credentials,
      fetchImpl
    );
    if (publicState.deployment.versionId !== inputs.currentPublicVersion
      || privateState.deployment.versionId !== inputs.currentPrivateVersion) {
      fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.PRODUCTION_IDENTITY_MISMATCH);
    }
    appendOutputs(environment.GITHUB_OUTPUT, {
      public_version: publicState.deployment.versionId,
      private_version: privateState.deployment.versionId,
      public_traffic: 100,
      private_traffic: 100
    });
    return Object.freeze({
      status: "GITHUB_HOSTED_AUTONOMOUS_PRODUCTION_BASELINE_VERIFIED",
      publicVersion: publicState.deployment.versionId,
      privateVersion: privateState.deployment.versionId
    });
  } finally {
    scrubDeploymentCredentials(credentials);
  }
}

function ownerOnlyDirectory(path) {
  mkdirSync(path, {
    recursive: false,
    mode: AUTONOMOUS_ENGINEERING_V1_POLICY.evidenceDirectoryMode
  });
  chmodSync(path, AUTONOMOUS_ENGINEERING_V1_POLICY.evidenceDirectoryMode);
}

function writeEvidence(directory, filename, evidence) {
  if (!boundedAbsolutePath(directory)
    || !/^[a-z0-9-]+\.json$/u.test(filename)
    || !isPlainObject(evidence)) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.EVIDENCE_INVALID);
  }
  ownerOnlyDirectory(directory);
  const path = join(directory, filename);
  writeFileSync(path, `${canonicalPrivateWorkflowJson(evidence)}\n`, {
    encoding: "ascii",
    mode: AUTONOMOUS_ENGINEERING_V1_POLICY.evidenceFileMode,
    flag: "wx"
  });
  chmodSync(path, AUTONOMOUS_ENGINEERING_V1_POLICY.evidenceFileMode);
  return Object.freeze({
    path,
    sha256: sha256AutonomousFile(path)
  });
}

function readEvidence(directory, filename) {
  try {
    const path = join(directory, filename);
    const rootStats = lstatSync(directory);
    const stats = lstatSync(path);
    if (!rootStats.isDirectory()
      || rootStats.isSymbolicLink()
      || !stats.isFile()
      || stats.isSymbolicLink()
      || (stats.mode & 0o022) !== 0
      || stats.size < 2
      || stats.size > MAX_EVIDENCE_BYTES
      || readdirSync(directory).sort().join("\0") !== filename) {
      fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.EVIDENCE_INVALID);
    }
    return Object.freeze({
      path,
      sha256: sha256AutonomousFile(path),
      value: parseJson(
        readFileSync(path, "utf8"),
        AUTONOMOUS_ENGINEERING_V1_FAILURE.EVIDENCE_INVALID
      )
    });
  } catch (error) {
    if (error instanceof AutonomousEngineeringV1Error) throw error;
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.EVIDENCE_INVALID);
  }
}

function verifiedReleaseForEnvironment(root, inputs, environment) {
  return verifyQualifiedPrivateRelease(
    root,
    releaseDirectoryFromEnvironment(environment),
    expectedArtifact(inputs, environment),
    currentPrivateV2RuntimeIdentity(root, environment)
  );
}

function scrubBuffers(result) {
  if (Buffer.isBuffer(result.stdout)) result.stdout.fill(0);
  if (Buffer.isBuffer(result.stderr)) result.stderr.fill(0);
}

export function runCredentialFreeRollbackDryRun({
  root,
  inputs,
  verifiedRelease,
  spawnImpl = spawnSync,
  temporaryRoot = tmpdir()
}) {
  const workspace = mkdtempSync(join(temporaryRoot, "prometheus-autonomous-rollback-"));
  const forwardDirectory = join(workspace, "forward");
  const rollbackDirectory = join(workspace, "rollback");
  const scratchDirectory = join(workspace, "wrangler-scratch");
  const wranglerOutdirs = Object.freeze({
    "dry-run": join(scratchDirectory, "dry-run"),
    deploy: join(scratchDirectory, "deploy"),
    rollback: join(scratchDirectory, "rollback")
  });
  let result;
  try {
    chmodSync(workspace, 0o700);
    cpSync(verifiedRelease.forwardDirectory, forwardDirectory, {
      recursive: true,
      errorOnExist: true,
      force: false,
      dereference: false
    });
    cpSync(verifiedRelease.rollbackDirectory, rollbackDirectory, {
      recursive: true,
      errorOnExist: true,
      force: false,
      dereference: false
    });
    mkdirSync(scratchDirectory, { mode: 0o700 });
    for (const path of Object.values(wranglerOutdirs)) {
      mkdirSync(path, { mode: 0o700 });
    }
    const release = Object.freeze({
      forwardDirectory,
      rollbackDirectory,
      scratchDirectory,
      wranglerOutdirs
    });
    const invocation = [
      ...buildQualifiedPrivateWranglerInvocation("rollback", inputs, release)
    ];
    invocation.splice(2, 0, "--dry-run");
    if (invocation.filter(value => value === "--dry-run").length !== 1
      || invocation.includes("--name")
      || invocation.includes(PRIVATE_WORKFLOW_V2_POLICY.publicWorker)) {
      fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.ROLLBACK_DEMONSTRATION_FAILED);
    }
    result = spawnImpl(process.execPath, invocation, {
      cwd: root,
      env: {
        PATH: process.env.PATH,
        HOME: workspace,
        TMPDIR: workspace,
        XDG_CONFIG_HOME: workspace,
        CI: "true",
        NO_COLOR: "1",
        WRANGLER_SEND_METRICS: "false",
        CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false"
      },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 300_000,
      maxBuffer: 4 * 1024 * 1024
    });
    if (result.status !== 0 || result.error || result.signal) {
      fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.ROLLBACK_DEMONSTRATION_FAILED);
    }
    return Object.freeze({
      status: "CREDENTIAL_FREE_ROLLBACK_DRY_RUN_PASSED",
      cloudflareRequests: 0,
      productionMutations: 0
    });
  } finally {
    if (result) scrubBuffers(result);
    rmSync(workspace, { recursive: true, force: true });
  }
}

function workerState(versionId, deploymentId) {
  return Object.freeze({
    deployment: Object.freeze({ versionId, deploymentId }),
    bindings: Object.freeze([])
  });
}

function passingSmoke(markerPolicy, expectedWorkerVersion) {
  return Object.freeze({
    status: "passed",
    attemptedWriteCount: 0,
    requestCount: 1,
    markerPolicy,
    markerVerifiedCount: markerPolicy
      === CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.REQUIRE_EXACT ? 1 : 0,
    markerOmittedCount: markerPolicy
      === CLOUDFLARE_UNATTENDED_SMOKE_MARKER_POLICY.REQUIRE_EXACT ? 0 : 1,
    expectedWorkerVersion,
    versionVerifiedCount: expectedWorkerVersion ? 1 : 0
  });
}

export async function demonstrateControlledRollbackLifecycle(
  inputs,
  verifiedRelease,
  dryRunImpl
) {
  const deployedVersion = "11111111-1111-4111-8111-111111111111";
  const recoveredVersion = "22222222-2222-4222-8222-222222222222";
  const initialPrivate = workerState(inputs.currentPrivateVersion, "private-initial");
  const initialPublic = workerState(inputs.currentPublicVersion, "public-initial");
  const deployedPrivate = workerState(deployedVersion, "private-deployed");
  const recoveredPrivate = workerState(recoveredVersion, "private-recovered");
  const privateStates = [
    initialPrivate,
    initialPrivate,
    deployedPrivate,
    recoveredPrivate
  ];
  const publicStates = [
    initialPublic,
    initialPublic,
    initialPublic,
    initialPublic
  ];
  const phases = [];
  const calls = { dryRun: 0, deploy: 0, rollback: 0 };
  const markerPolicy = privateV2PredeploymentSmokeMarkerPolicy(
    inputs.currentPrivateVersion
  );
  const result = await runQualifiedPrivateDeploymentLifecycle({
    inputs: Object.freeze({
      approvedCommit: inputs.candidateCommit,
      approvedTree: inputs.candidateTree,
      batchId: inputs.batchId,
      currentPublicVersion: inputs.currentPublicVersion,
      currentPrivateVersion: inputs.currentPrivateVersion
    }),
    verifyRelease: async () => verifiedRelease,
    inspectRepository: async () => Object.freeze({ status: "verified" }),
    fetchState: async worker => (
      worker === PRIVATE_WORKFLOW_V2_POLICY.privateWorker
        ? privateStates.shift()
        : publicStates.shift()
    ),
    verifyInitialBindings: () => Object.freeze({
      initialBindings: Object.freeze([]),
      forwardExpectedBindings: Object.freeze([]),
      rollbackExpectedBindings: Object.freeze([])
    }),
    runPreSmoke: async () => passingSmoke(markerPolicy),
    runDryRun: async () => {
      calls.dryRun += 1;
      await dryRunImpl();
    },
    runDeploy: async (_release, consumeAuthorization) => {
      calls.deploy += 1;
      consumeAuthorization();
    },
    runPostSmoke: async () => {
      throw new PrivateWorkflowV2Error(PRIVATE_WORKFLOW_V2_FAILURE.SMOKE_INVALID);
    },
    runRollback: async () => {
      calls.rollback += 1;
    },
    evidence: Object.freeze({
      append: phase => phases.push(phase)
    })
  });
  if (result.status !== "PRIVATE_WORKER_V2_FORWARD_ROLLBACK_VERIFIED"
    || result.deploymentAttempts !== 1
    || result.rollbackAttempts !== 1
    || calls.dryRun !== 1
    || calls.deploy !== 1
    || calls.rollback !== 1
    || JSON.stringify(phases) !== JSON.stringify(ROLLBACK_PHASES)) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.ROLLBACK_DEMONSTRATION_FAILED);
  }
  return Object.freeze({ result, phases, calls });
}

function artifactEvidence(inputs, environment) {
  const inRunRecoveryAttempts = Number(
    environment.PROMETHEUS_IN_RUN_RECOVERY_ATTEMPTS
  );
  const selectedQualification = environment.PROMETHEUS_SELECTED_QUALIFICATION;
  if (!Number.isInteger(inRunRecoveryAttempts)
    || inRunRecoveryAttempts < 0
    || inRunRecoveryAttempts
      > AUTONOMOUS_ENGINEERING_V1_POLICY.maximumInRunTransientRecoveryAttempts
    || (selectedQualification === "PRIMARY" && inRunRecoveryAttempts !== 0)
    || (selectedQualification === "RECOVERY" && inRunRecoveryAttempts !== 1)
    || !["PRIMARY", "RECOVERY"].includes(selectedQualification)) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.ARTIFACT_INVALID);
  }
  return Object.freeze({
    qualificationRunId: environment.PROMETHEUS_QUALIFICATION_RUN_ID,
    qualificationArtifactId:
      environment.PROMETHEUS_QUALIFICATION_ARTIFACT_ID,
    qualificationArtifactZipSha256:
      environment.PROMETHEUS_QUALIFICATION_ARTIFACT_ZIP_SHA256,
    contentTreeSha256: environment.PROMETHEUS_QUALIFIED_CONTENT_TREE_SHA256,
    manifestSha256: environment.PROMETHEUS_QUALIFIED_MANIFEST_SHA256,
    deploymentAssetsSha256: environment.PROMETHEUS_DEPLOYMENT_ASSETS_SHA256,
    rollbackContractSha256: environment.PROMETHEUS_ROLLBACK_CONTRACT_SHA256,
    rollbackBundleSha256: environment.PROMETHEUS_ROLLBACK_BUNDLE_SHA256,
    workflowContractSha256: environment.PROMETHEUS_WORKFLOW_CONTRACT_SHA256,
    autonomousContractSha256:
      environment.PROMETHEUS_AUTONOMOUS_CONTRACT_SHA256,
    selectedQualification,
    inRunRecoveryAttempts,
    candidateCommit: inputs.candidateCommit,
    candidateTree: inputs.candidateTree
  });
}

function validArtifactEvidence(value) {
  return isPlainObject(value)
    && POSITIVE_INTEGER.test(value.qualificationRunId || "")
    && POSITIVE_INTEGER.test(value.qualificationArtifactId || "")
    && SHA40.test(value.candidateCommit || "")
    && SHA40.test(value.candidateTree || "")
    && ["PRIMARY", "RECOVERY"].includes(value.selectedQualification)
    && Number.isInteger(value.inRunRecoveryAttempts)
    && value.inRunRecoveryAttempts >= 0
    && value.inRunRecoveryAttempts
      <= AUTONOMOUS_ENGINEERING_V1_POLICY.maximumInRunTransientRecoveryAttempts
    && ((value.selectedQualification === "PRIMARY"
        && value.inRunRecoveryAttempts === 0)
      || (value.selectedQualification === "RECOVERY"
        && value.inRunRecoveryAttempts === 1))
    && [
      value.qualificationArtifactZipSha256,
      value.contentTreeSha256,
      value.manifestSha256,
      value.deploymentAssetsSha256,
      value.rollbackContractSha256,
      value.rollbackBundleSha256,
      value.workflowContractSha256,
      value.autonomousContractSha256
    ].every(item => SHA64.test(item || ""));
}

export async function runAutonomousRollbackDemonstration({
  root,
  environment = process.env,
  dryRunImpl,
  verifyArtifactImpl = verifyAutonomousArtifact
}) {
  const inputs = validateAutonomousEngineeringV1Context(environment);
  await verifyArtifactImpl({ root, environment });
  const verifiedRelease = verifiedReleaseForEnvironment(root, inputs, environment);
  const executeDryRun = dryRunImpl || (() => runCredentialFreeRollbackDryRun({
    root,
    inputs,
    verifiedRelease
  }));
  const lifecycle = await demonstrateControlledRollbackLifecycle(
    inputs,
    verifiedRelease,
    executeDryRun
  );
  const artifact = artifactEvidence(inputs, environment);
  if (!validArtifactEvidence(artifact)) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.ARTIFACT_INVALID);
  }
  const evidence = Object.freeze({
    schemaVersion: "github-hosted-autonomous-rollback-demonstration-v1",
    status: "CONTROLLED_NON_PRODUCT_ROLLBACK_DEMONSTRATION_PASSED",
    artifact,
    mechanism: "qualified_rollback_payload_dry_run_and_in_memory_lifecycle",
    forcedFailure: "SMOKE_INVALID",
    forwardAttempts: lifecycle.result.deploymentAttempts,
    rollbackAttempts: lifecycle.result.rollbackAttempts,
    phases: lifecycle.phases,
    cloudflareRequests: 0,
    productionMutations: 0,
    publicWorkerMutationPerformed: false,
    secretValuesReceived: false,
    protectedState: PROTECTED_STATE
  });
  const output = writeEvidence(
    environment.PROMETHEUS_AUTONOMOUS_EVIDENCE_OUTPUT,
    "rollback-demonstration.json",
    evidence
  );
  appendOutputs(environment.GITHUB_OUTPUT, {
    rollback_demonstration_sha256: output.sha256
  });
  return Object.freeze({
    status: "GITHUB_HOSTED_AUTONOMOUS_ROLLBACK_DEMONSTRATED",
    evidenceSha256: output.sha256
  });
}

export async function verifyAutonomousRollbackRecovery({
  root,
  environment = process.env,
  dryRunImpl,
  verifyArtifactImpl = verifyAutonomousArtifact
}) {
  const inputs = validateAutonomousEngineeringV1Context(environment);
  await verifyArtifactImpl({ root, environment });
  const demonstration = readEvidence(
    environment.PROMETHEUS_AUTONOMOUS_ROLLBACK_EVIDENCE_PATH,
    "rollback-demonstration.json"
  );
  const expectedArtifact = artifactEvidence(inputs, environment);
  const value = demonstration.value;
  if (!SHA64.test(environment.PROMETHEUS_ROLLBACK_DEMONSTRATION_SHA256 || "")
    || demonstration.sha256
      !== environment.PROMETHEUS_ROLLBACK_DEMONSTRATION_SHA256
    || value.schemaVersion
      !== "github-hosted-autonomous-rollback-demonstration-v1"
    || value.status
      !== "CONTROLLED_NON_PRODUCT_ROLLBACK_DEMONSTRATION_PASSED"
    || JSON.stringify(value.artifact) !== JSON.stringify(expectedArtifact)
    || value.forwardAttempts !== 1
    || value.rollbackAttempts !== 1
    || JSON.stringify(value.phases) !== JSON.stringify(ROLLBACK_PHASES)
    || value.cloudflareRequests !== 0
    || value.productionMutations !== 0
    || value.publicWorkerMutationPerformed !== false
    || value.secretValuesReceived !== false
    || JSON.stringify(value.protectedState) !== JSON.stringify(PROTECTED_STATE)) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.RECOVERY_VERIFICATION_FAILED);
  }
  const verifiedRelease = verifiedReleaseForEnvironment(root, inputs, environment);
  const executeDryRun = dryRunImpl || (() => runCredentialFreeRollbackDryRun({
    root,
    inputs,
    verifiedRelease
  }));
  await executeDryRun();
  const evidence = Object.freeze({
    schemaVersion: "github-hosted-autonomous-recovery-verification-v1",
    status: "CONTROLLED_ROLLBACK_RECOVERY_INDEPENDENTLY_VERIFIED",
    artifact: expectedArtifact,
    rollbackDemonstrationSha256: demonstration.sha256,
    freshRunnerArtifactVerification: true,
    freshRunnerRollbackDryRun: true,
    cloudflareRequests: 0,
    productionMutations: 0,
    protectedState: PROTECTED_STATE
  });
  const output = writeEvidence(
    environment.PROMETHEUS_AUTONOMOUS_EVIDENCE_OUTPUT,
    "recovery-verification.json",
    evidence
  );
  appendOutputs(environment.GITHUB_OUTPUT, {
    recovery_verification_sha256: output.sha256
  });
  return Object.freeze({
    status: "GITHUB_HOSTED_AUTONOMOUS_RECOVERY_VERIFIED",
    evidenceSha256: output.sha256
  });
}

function deploymentEvidenceDirectory(environment) {
  return join(
    environment.RUNNER_TEMP || tmpdir(),
    `prometheus-private-deployment-v2-${environment.GITHUB_RUN_ID || "local"}`
  );
}

function writeDeploymentOutcome(environment, outcome) {
  return writeEvidence(
    environment.PROMETHEUS_AUTONOMOUS_DEPLOYMENT_OUTCOME_PATH,
    "deployment-outcome.json",
    outcome
  );
}

export async function runAutonomousDeployment({
  root,
  environment = process.env,
  deployImpl = runPrivateWorkerDeploymentV2Command,
  verifyRepositoryImpl = verifyAutonomousEngineeringV1Repository,
  verifyContractPinImpl = verifyAutonomousContractPin
}) {
  const inputs = validateAutonomousEngineeringV1Context(environment);
  verifyRepositoryImpl(root, inputs);
  verifyContractPinImpl(root, environment);
  if (typeof environment.PROMETHEUS_GITHUB_TOKEN === "string"
    && environment.PROMETHEUS_GITHUB_TOKEN.length > 0) {
    delete environment.PROMETHEUS_GITHUB_TOKEN;
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.SECRET_BOUNDARY_INVALID);
  }
  const projected = projectAutonomousDeploymentEnvironment(environment, inputs);
  delete projected.PROMETHEUS_GITHUB_TOKEN;
  for (const name of privateWorkflowV2SecretEnvironmentNames) {
    delete environment[name];
  }
  let result;
  try {
    result = await deployImpl({ mode: "deploy", environment: projected });
    const outcome = Object.freeze({
      schemaVersion: "github-hosted-autonomous-deployment-outcome-v1",
      status: result.status,
      failureClassification: result.failureClassification || "NONE",
      deploymentAttempts: result.deploymentAttempts,
      rollbackAttempts: result.rollbackAttempts,
      artifact: artifactEvidence(inputs, projected)
    });
    const output = writeDeploymentOutcome(environment, outcome);
    appendOutputs(environment.GITHUB_OUTPUT, {
      deployment_status: result.status,
      deployment_outcome_sha256: output.sha256
    });
    if (result.status !== "PRIVATE_WORKER_V2_DEPLOYMENT_VERIFIED") {
      fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.DEPLOYMENT_FAILED);
    }
    return Object.freeze({
      status: "GITHUB_HOSTED_AUTONOMOUS_DEPLOYMENT_VERIFIED",
      outcomeSha256: output.sha256
    });
  } catch (error) {
    if (!result) {
      const classification = formatAutonomousEngineeringV1Failure(error);
      const output = writeDeploymentOutcome(environment, Object.freeze({
        schemaVersion: "github-hosted-autonomous-deployment-outcome-v1",
        status: "AUTONOMOUS_DEPLOYMENT_FAILED",
        failureClassification: classification,
        deploymentAttempts: 0,
        rollbackAttempts: 0,
        artifact: artifactEvidence(inputs, projected)
      }));
      appendOutputs(environment.GITHUB_OUTPUT, {
        deployment_status: "AUTONOMOUS_DEPLOYMENT_FAILED",
        deployment_outcome_sha256: output.sha256
      });
    }
    throw error;
  }
}

function readPhaseEvidence(environment) {
  const directory = deploymentEvidenceDirectory(environment);
  try {
    const stats = lstatSync(directory);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.EVIDENCE_INVALID);
    }
    return Object.freeze(readdirSync(directory).sort().map((filename, index) => {
      const expectedPrefix = `${String(index + 1).padStart(3, "0")}-`;
      if (!filename.startsWith(expectedPrefix)) {
        fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.EVIDENCE_INVALID);
      }
      const path = join(directory, filename);
      const phase = readFileSync(path, "ascii").trim();
      if (filename !== `${expectedPrefix}${phase}`
        || !Object.values(PRIVATE_WORKFLOW_V2_PHASE).includes(phase)) {
        fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.EVIDENCE_INVALID);
      }
      return phase;
    }));
  } catch (error) {
    if (error instanceof AutonomousEngineeringV1Error) throw error;
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.EVIDENCE_INVALID);
  }
}

async function readProductionIdentities(environment, fetchImpl, fetchStateImpl) {
  let credentials;
  try {
    const credentialEnvironment =
      isolateCloudflareDeploymentCredentials(environment);
    credentials = takeDeploymentCredentials(credentialEnvironment);
    const publicState = await fetchStateImpl(
      PRIVATE_WORKFLOW_V2_POLICY.publicWorker,
      credentials,
      fetchImpl
    );
    const privateState = await fetchStateImpl(
      PRIVATE_WORKFLOW_V2_POLICY.privateWorker,
      credentials,
      fetchImpl
    );
    return Object.freeze({
      publicVersion: publicState.deployment.versionId,
      privateVersion: privateState.deployment.versionId
    });
  } finally {
    scrubDeploymentCredentials(credentials);
  }
}

export async function finalizeAutonomousDeploymentEvidence({
  root,
  environment = process.env,
  fetchImpl = globalThis.fetch,
  fetchStateImpl = fetchPublicWorkerState
}) {
  const inputs = validateAutonomousEngineeringV1Context(environment);
  const repository = verifyAutonomousEngineeringV1Repository(root, inputs);
  const outcome = readEvidence(
    environment.PROMETHEUS_AUTONOMOUS_DEPLOYMENT_OUTCOME_PATH,
    "deployment-outcome.json"
  );
  const phases = readPhaseEvidence(environment);
  const identities = await readProductionIdentities(
    environment,
    fetchImpl,
    fetchStateImpl
  );
  const deployed = outcome.value.status === "PRIVATE_WORKER_V2_DEPLOYMENT_VERIFIED";
  const rolledBack =
    outcome.value.status === "PRIVATE_WORKER_V2_FORWARD_ROLLBACK_VERIFIED";
  const phaseExpectation = deployed ? SUCCESS_PHASES : ROLLBACK_PHASES;
  if ((!deployed && !rolledBack)
    || identities.publicVersion !== inputs.currentPublicVersion
    || (deployed && identities.privateVersion === inputs.currentPrivateVersion)
    || JSON.stringify(phases) !== JSON.stringify(phaseExpectation)
    || outcome.sha256
      !== environment.PROMETHEUS_AUTONOMOUS_DEPLOYMENT_OUTCOME_SHA256) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.PRODUCTION_IDENTITY_MISMATCH);
  }
  const evidence = Object.freeze({
    schemaVersion: "github-hosted-autonomous-production-evidence-v1",
    status: deployed
      ? "AUTONOMOUS_PRIVATE_DEPLOYMENT_ACCEPTED"
      : "AUTONOMOUS_PRIVATE_DEPLOYMENT_ROLLBACK_VERIFIED",
    candidateCommit: inputs.candidateCommit,
    candidateTree: inputs.candidateTree,
    publicVersion: identities.publicVersion,
    previousPrivateVersion: inputs.currentPrivateVersion,
    finalPrivateVersion: identities.privateVersion,
    publicWorkerUnchanged: true,
    privateIdentityAdvanced: identities.privateVersion
      !== inputs.currentPrivateVersion,
    deploymentOutcomeSha256: outcome.sha256,
    rollbackDemonstrationSha256:
      environment.PROMETHEUS_ROLLBACK_DEMONSTRATION_SHA256,
    recoveryVerificationSha256:
      environment.PROMETHEUS_RECOVERY_VERIFICATION_SHA256,
    phases,
    desktopAcceptance: deployed,
    mobile390x844Acceptance: deployed,
    identityBeforeScriptExecution: deployed,
    writeAttempts: 0,
    maximumRepairAttempts:
      AUTONOMOUS_ENGINEERING_V1_POLICY.maximumRepairAttempts,
    actualRepairAttempt: Number(inputs.repairAttempt),
    maximumInRunTransientRecoveryAttempts:
      AUTONOMOUS_ENGINEERING_V1_POLICY.maximumInRunTransientRecoveryAttempts,
    actualInRunTransientRecoveryAttempts: Number(
      environment.PROMETHEUS_IN_RUN_RECOVERY_ATTEMPTS
    ),
    selectedQualification:
      environment.PROMETHEUS_SELECTED_QUALIFICATION,
    maximumChangedFiles:
      AUTONOMOUS_ENGINEERING_V1_POLICY.maximumChangedFiles,
    actualChangedFiles: repository.changedFileCount,
    maximumWorkflowRecursionDepth:
      AUTONOMOUS_ENGINEERING_V1_POLICY.maximumWorkflowRecursionDepth,
    actualWorkflowRecursionDepth: 0,
    maximumWallClockMinutes:
      AUTONOMOUS_ENGINEERING_V1_POLICY.maximumWallClockMinutes,
    secretsExposed: false,
    localComputerRequiredAfterDispatch: false,
    protectedState: PROTECTED_STATE
  });
  const output = writeEvidence(
    environment.PROMETHEUS_AUTONOMOUS_EVIDENCE_OUTPUT,
    "production-evidence.json",
    evidence
  );
  appendOutputs(environment.GITHUB_OUTPUT, {
    final_status: evidence.status,
    final_private_version: identities.privateVersion,
    production_evidence_sha256: output.sha256
  });
  if (!deployed) fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.DEPLOYMENT_FAILED);
  return Object.freeze({
    status: "GITHUB_HOSTED_AUTONOMOUS_PRODUCTION_EVIDENCE_VERIFIED",
    finalPrivateVersion: identities.privateVersion,
    evidenceSha256: output.sha256
  });
}

export async function independentlyVerifyAutonomousProduction({
  root,
  environment = process.env,
  fetchImpl = globalThis.fetch,
  fetchStateImpl = fetchPublicWorkerState
}) {
  const inputs = validateAutonomousEngineeringV1Context(environment);
  verifyAutonomousEngineeringV1Repository(root, inputs);
  const evidence = readEvidence(
    environment.PROMETHEUS_AUTONOMOUS_PRODUCTION_EVIDENCE_PATH,
    "production-evidence.json"
  );
  const identities = await readProductionIdentities(
    environment,
    fetchImpl,
    fetchStateImpl
  );
  const value = evidence.value;
  if (evidence.sha256 !== environment.PROMETHEUS_PRODUCTION_EVIDENCE_SHA256
    || value.status !== "AUTONOMOUS_PRIVATE_DEPLOYMENT_ACCEPTED"
    || value.candidateCommit !== inputs.candidateCommit
    || value.candidateTree !== inputs.candidateTree
    || value.publicVersion !== inputs.currentPublicVersion
    || value.publicVersion !== identities.publicVersion
    || value.finalPrivateVersion !== identities.privateVersion
    || value.previousPrivateVersion !== inputs.currentPrivateVersion
    || value.finalPrivateVersion === inputs.currentPrivateVersion
    || value.desktopAcceptance !== true
    || value.mobile390x844Acceptance !== true
    || value.identityBeforeScriptExecution !== true
    || value.writeAttempts !== 0
    || value.maximumInRunTransientRecoveryAttempts
      !== AUTONOMOUS_ENGINEERING_V1_POLICY.maximumInRunTransientRecoveryAttempts
    || value.actualInRunTransientRecoveryAttempts !== Number(
      environment.PROMETHEUS_IN_RUN_RECOVERY_ATTEMPTS
    )
    || value.selectedQualification
      !== environment.PROMETHEUS_SELECTED_QUALIFICATION
    || value.secretsExposed !== false
    || value.localComputerRequiredAfterDispatch !== false
    || JSON.stringify(value.protectedState) !== JSON.stringify(PROTECTED_STATE)) {
    fail(AUTONOMOUS_ENGINEERING_V1_FAILURE.PRODUCTION_IDENTITY_MISMATCH);
  }
  const output = writeEvidence(
    environment.PROMETHEUS_AUTONOMOUS_EVIDENCE_OUTPUT,
    "independent-production-acceptance.json",
    Object.freeze({
      schemaVersion: "github-hosted-autonomous-independent-acceptance-v1",
      status: "GITHUB_HOSTED_AUTONOMOUS_ENGINEERING_ACCEPTED",
      candidateCommit: inputs.candidateCommit,
      candidateTree: inputs.candidateTree,
      publicVersion: identities.publicVersion,
      privateVersion: identities.privateVersion,
      productionEvidenceSha256: evidence.sha256,
      publicWorkerUnchanged: true,
      authenticatedDesktopAcceptance: true,
      authenticatedMobile390x844Acceptance: true,
      identityBeforeScriptExecution: true,
      writeAttempts: 0,
      secretsExposed: false,
      localComputerRequiredAfterDispatch: false,
      protectedState: PROTECTED_STATE
    })
  );
  appendOutputs(environment.GITHUB_OUTPUT, {
    acceptance_evidence_sha256: output.sha256,
    accepted_private_version: identities.privateVersion,
    accepted_public_version: identities.publicVersion
  });
  return Object.freeze({
    status: "GITHUB_HOSTED_AUTONOMOUS_ENGINEERING_ACCEPTED",
    evidenceSha256: output.sha256
  });
}

export function formatAutonomousEngineeringV1Failure(error) {
  if (error instanceof AutonomousEngineeringV1Error) return error.code;
  const privateFailure = formatPrivateWorkflowV2Failure(error);
  return typeof privateFailure === "string" && privateFailure.length > 0
    ? privateFailure
    : AUTONOMOUS_ENGINEERING_V1_FAILURE.DEPLOYMENT_FAILED;
}

export const autonomousProtectedState = PROTECTED_STATE;
export const autonomousSuccessPhases = SUCCESS_PHASES;
export const autonomousRollbackPhases = ROLLBACK_PHASES;
export const autonomousFullSuiteCommands = FULL_SUITE_COMMANDS;
export const autonomousQualificationOutputNames = QUALIFICATION_OUTPUT_NAMES;
