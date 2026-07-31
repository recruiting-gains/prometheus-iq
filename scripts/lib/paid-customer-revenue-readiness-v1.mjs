import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

import {
  PRIVATE_WORKFLOW_V2_POLICY,
  canonicalPrivateWorkflowJson,
  privateWorkflowV2SecretEnvironmentNames
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

const ADMINISTRATION_IDENTITY =
  "Prometheus Administration <administration@prometheus.local>";
const CRM_IDENTITY = "Prometheus CRM <crm@prometheus.local>";
const DATA_IDENTITY = "Prometheus Data <data@prometheus.local>";
const DASHBOARD_IDENTITY = "Prometheus Dashboard <dashboard@prometheus.local>";
const SECURITY_IDENTITY = "Prometheus Security <security@prometheus.local>";
const INFRASTRUCTURE_IDENTITY =
  "Prometheus Infrastructure <infrastructure@prometheus.local>";
const INTELLIGENCE_IDENTITY =
  "Prometheus Intelligence Engine <intelligence@prometheus.local>";
const OVERWATCH_IDENTITY =
  "Prometheus Overwatch <overwatch@prometheus.local>";

export const REVENUE_READINESS_V1_POLICY = Object.freeze({
  contractVersion: "paid-customer-revenue-readiness-v1",
  contractPath:
    "workers/infrastructure/paid-customer-revenue-readiness-v1.json",
  workflowName: "Paid-Customer Revenue Readiness v1",
  workflowPath:
    ".github/workflows/paid-customer-revenue-readiness-v1.yml",
  workflowRef:
    "PrometheusRouteIQ/prometheus-iq/.github/workflows/paid-customer-revenue-readiness-v1.yml@refs/heads/main",
  libraryPath:
    "scripts/lib/paid-customer-revenue-readiness-v1.mjs",
  runnerPath:
    "scripts/run-paid-customer-revenue-readiness-v1.mjs",
  verifierPath:
    "scripts/verify-paid-customer-revenue-readiness-v1.mjs",
  testPath:
    "tests/paid-customer-revenue-readiness-infrastructure-lane.test.mjs",
  repository: "PrometheusRouteIQ/prometheus-iq",
  branch: "main",
  ref: "refs/heads/main",
  refType: "branch",
  eventName: "workflow_dispatch",
  founderActor: "PrometheusRouteIQ",
  founderAuthorization:
    "I AUTHORIZE THIS EXACT PAID-CUSTOMER REVENUE READINESS QUALIFICATION",
  firstRunAttempt: "1",
  baselineCommit: "50fa933f45e82224959386bd30d0e57becfb7d3c",
  baselineTree: "6d30998444d6660de7c42f5988e5f2f56f9966da",
  currentPrivateVersion: "2f2b059b-8776-4d70-8848-1a0c5d5b18d4",
  currentPublicVersion: "6a8713c0-0712-4cda-8a13-daa893ca45f2",
  privateWorker: PRIVATE_WORKFLOW_V2_POLICY.privateWorker,
  publicWorker: PRIVATE_WORKFLOW_V2_POLICY.publicWorker,
  protectedEnvironment: "prometheus-private-worker-production",
  runner: PRIVATE_WORKFLOW_V2_POLICY.runner,
  architecture: PRIVATE_WORKFLOW_V2_POLICY.architecture,
  nodeVersion: PRIVATE_WORKFLOW_V2_POLICY.nodeVersion,
  artifactRetentionDays: PRIVATE_WORKFLOW_V2_POLICY.artifactRetentionDays,
  concurrencyGroup: "paid-customer-revenue-readiness-v1",
  administrationIdentity: ADMINISTRATION_IDENTITY,
  infrastructureIdentity: INFRASTRUCTURE_IDENTITY,
  intelligenceIdentity: INTELLIGENCE_IDENTITY,
  overwatchIdentity: OVERWATCH_IDENTITY,
  administrationPaths: Object.freeze([
    "administration/"
  ]),
  crmPaths: Object.freeze([
    "crm/"
  ]),
  dataPaths: Object.freeze([
    "data/route-iq-paid-customer-revenue-readiness-v1/"
  ]),
  dashboardPaths: Object.freeze([
    "dashboard/route-iq-paid-customer-revenue-readiness.mjs",
    "index.html",
    "tests/dashboard-route-iq-paid-customer-revenue-readiness.test.mjs"
  ]),
  securityPaths: Object.freeze([
    "security/route-iq-paid-customer-revenue-v1.mjs",
    "tests/route-iq-paid-customer-revenue-security.test.mjs"
  ]),
  infrastructureNewPaths: Object.freeze([
    ".github/workflows/paid-customer-revenue-readiness-v1.yml",
    "deploy/cloudflare-pages/_headers",
    "deploy/cloudflare-pages/dashboard/route-iq-paid-customer-revenue-readiness.mjs",
    "deploy/cloudflare-pages/index.html",
    "docs/infrastructure/paid-customer-revenue-readiness-v1.md",
    "scripts/lib/paid-customer-revenue-readiness-v1.mjs",
    "scripts/run-paid-customer-revenue-readiness-v1.mjs",
    "scripts/verify-paid-customer-revenue-readiness-v1.mjs",
    "tests/paid-customer-revenue-readiness-infrastructure-lane.test.mjs",
    "tests/route-iq-paid-customer-revenue-readiness-infrastructure.test.mjs",
    "workers/infrastructure/paid-customer-revenue-readiness-v1.json",
    "workers/infrastructure/route-iq-paid-customer-revenue-readiness-runtime-v1.json",
    "workers/infrastructure/route-iq-paid-customer-revenue-readiness-runtime.js"
  ]),
  infrastructureExistingPaths: Object.freeze([
    "scripts/lib/github-actions-private-worker-workflow-v2.mjs",
    "scripts/verify-route-iq-private-paid-customer-production-browser-acceptance.mjs",
    "tests/github-actions-private-worker-workflow-v2.test.mjs",
    "tests/route-iq-paid-customer-infrastructure-browser-acceptance.test.mjs",
    "workers/infrastructure/cloudflare-unattended-smoke-contract.js",
    "workers/infrastructure/github-actions-private-worker-deployment-v2.json",
    "workers/infrastructure/route-iq-paid-customer-private-browser-acceptance-v1.json",
    "workers/infrastructure/route-iq-private-forward-rollback-candidate-v3.json",
    "workers/infrastructure/route-iq-private-forward-rollback-inert-durable-object-v3.js",
    "workers/infrastructure/route-iq-private-forward-rollback-wrangler-v3.json",
    "workers/prometheus-iq-worker.js"
  ]),
  infrastructureSuccessorPaths: Object.freeze([
    "scripts/verify-cloudflare-unattended-runtime-guard.mjs",
    "tests/cloudflare-unattended-runtime-guard.test.mjs"
  ]),
  intelligenceSuccessorPaths: Object.freeze([]),
  overwatchNewPaths: Object.freeze([
    "overwatch/governance/paid-customer-revenue-readiness-v1.json",
    "overwatch/reports/BATCH-20260731-001-paid-customer-revenue-readiness-v1.json",
    "scripts/verify-overwatch-paid-customer-revenue-readiness-v1.mjs",
    "tests/overwatch-paid-customer-revenue-readiness-v1.test.mjs"
  ]),
  overwatchSuccessorPaths: Object.freeze([
    "overwatch/governance/github-actions-private-worker-deployment-v2.json",
    "overwatch/governance/route-iq-august-1-launch-closeout-v1.json",
    "overwatch/governance/route-iq-august-1-readiness-successors-v1.json",
    "scripts/verify-overwatch-cloudflare-founder-attended-service-token.mjs",
    "scripts/verify-overwatch-controlled-paid-customer-onboarding-rehearsal-v1.mjs",
    "scripts/verify-overwatch-github-actions-private-worker-deployment.mjs",
    "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
    "scripts/verify-overwatch-route-iq-august-1-launch-readiness.mjs",
    "scripts/verify-release-provenance-repair.mjs",
    "tests/overwatch-cloudflare-founder-attended-service-token.test.mjs",
    "tests/overwatch-github-actions-private-worker-deployment.test.mjs",
    "tests/overwatch-route-iq-august-1-launch-readiness.test.mjs",
    "tests/release-provenance-repair.test.mjs"
  ]),
  overwatchExistingPaths: Object.freeze([
    "package.json"
  ])
});

export const REVENUE_READINESS_V1_FAILURE = Object.freeze({
  INPUT_INVALID: "REVENUE_READINESS_INPUT_INVALID",
  CONTEXT_INVALID: "REVENUE_READINESS_CONTEXT_INVALID",
  REPOSITORY_INVALID: "REVENUE_READINESS_REPOSITORY_INVALID",
  OWNER_INVALID: "REVENUE_READINESS_OWNER_INVALID",
  ARCHIVE_REF_EXPOSED: "REVENUE_READINESS_ARCHIVE_REF_EXPOSED",
  SECRET_BOUNDARY_INVALID: "REVENUE_READINESS_SECRET_BOUNDARY_INVALID",
  ARTIFACT_INVALID: "REVENUE_READINESS_ARTIFACT_INVALID",
  DEPLOYMENT_INVALID: "REVENUE_READINESS_DEPLOYMENT_INVALID",
  EVIDENCE_INVALID: "REVENUE_READINESS_EVIDENCE_INVALID"
});

const SHA40 = /^[0-9a-f]{40}$/u;
const SHA64 = /^[0-9a-f]{64}$/u;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const POSITIVE_INTEGER = /^[1-9][0-9]{0,15}$/u;
const BATCH_ID = /^BATCH-[0-9]{8}-[0-9]{3}$/u;
const INPUT_NAMES = Object.freeze([
  "candidate_commit",
  "candidate_tree",
  "batch_id",
  "current_public_version",
  "current_private_version",
  "founder_authorization"
]);
const ARTIFACT_ENVIRONMENT_NAMES = Object.freeze([
  "PROMETHEUS_QUALIFICATION_RUN_ID",
  "PROMETHEUS_QUALIFICATION_ARTIFACT_ID",
  "PROMETHEUS_QUALIFICATION_ARTIFACT_ZIP_SHA256",
  "PROMETHEUS_QUALIFIED_CONTENT_TREE_SHA256",
  "PROMETHEUS_QUALIFIED_MANIFEST_SHA256",
  "PROMETHEUS_WORKFLOW_CONTRACT_SHA256",
  "PROMETHEUS_ROLLBACK_CONTRACT_SHA256",
  "PROMETHEUS_ROLLBACK_BUNDLE_SHA256"
]);
const VALID_OWNERS = Object.freeze([
  "ADMINISTRATION",
  "CRM",
  "DATA",
  "DASHBOARD",
  "SECURITY",
  "INFRASTRUCTURE",
  "INTELLIGENCE",
  "OVERWATCH"
]);
const SUCCESSFUL_BROWSER_ACCEPTANCE =
  "AUTHENTICATED_DESKTOP_AND_390X844_PASSED";
const ROLLBACK_BROWSER_ACCEPTANCE =
  "AUTHENTICATED_DESKTOP_AND_390X844_NOT_ACCEPTED";
const IDENTITIES = Object.freeze({
  ADMINISTRATION: ADMINISTRATION_IDENTITY,
  CRM: CRM_IDENTITY,
  DATA: DATA_IDENTITY,
  DASHBOARD: DASHBOARD_IDENTITY,
  SECURITY: SECURITY_IDENTITY,
  INFRASTRUCTURE: INFRASTRUCTURE_IDENTITY,
  INTELLIGENCE: INTELLIGENCE_IDENTITY,
  OVERWATCH: OVERWATCH_IDENTITY
});
const EVIDENCE_KEYS = Object.freeze([
  "schemaVersion",
  "status",
  "candidateCommit",
  "candidateTree",
  "batchId",
  "currentPublicVersion",
  "previousPrivateVersion",
  "privateWorker",
  "publicWorker",
  "deploymentAttempts",
  "rollbackAttempts",
  "publicWorkerUnchanged",
  "browserAcceptance",
  "crmWrites",
  "productionCustomerWrites",
  "providerRefresh",
  "scheduler",
  "collection",
  "activeCohortCount",
  "recommendationInfluence",
  "invitations",
  "billing",
  "anthonyMapped",
  "localComputerRequiredAfterDispatch"
]);

export class RevenueReadinessV1Error extends Error {
  constructor(code) {
    super(code);
    this.name = "RevenueReadinessV1Error";
    this.code = code;
  }
}

function fail(code) {
  throw new RevenueReadinessV1Error(code);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, keys) {
  return isPlainObject(value)
    && Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
}

function parseJson(value, failure = REVENUE_READINESS_V1_FAILURE.INPUT_INVALID) {
  try {
    const parsed = JSON.parse(value);
    if (!isPlainObject(parsed)) fail(failure);
    return parsed;
  } catch (error) {
    if (error instanceof RevenueReadinessV1Error) throw error;
    fail(failure);
  }
}

function runGit(root, argumentsList, {
  allowEmpty = true,
  allowExitOne = false
} = {}) {
  const result = spawnSync("git", argumentsList, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0"
    }
  });
  if (allowExitOne
    && result.status === 1
    && !result.error
    && !result.signal) {
    return "";
  }
  if (result.status !== 0 || result.error || result.signal) {
    fail(REVENUE_READINESS_V1_FAILURE.REPOSITORY_INVALID);
  }
  const output = String(result.stdout || "").trim();
  if (!allowEmpty && output.length === 0) {
    fail(REVENUE_READINESS_V1_FAILURE.REPOSITORY_INVALID);
  }
  return output;
}

function appendOutputs(path, values) {
  if (typeof path !== "string" || !isAbsolute(path) || !isPlainObject(values)) {
    fail(REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID);
  }
  const lines = Object.entries(values).map(([name, value]) => {
    if (!/^[a-z][a-z0-9_]*$/u.test(name)
      || !/^[0-9A-Z_a-z-]+$/u.test(String(value))) {
      fail(REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID);
    }
    return `${name}=${value}`;
  });
  writeFileSync(path, `${lines.join("\n")}\n`, {
    encoding: "ascii",
    flag: "a",
    mode: 0o600
  });
}

export function sha256RevenueReadinessFile(path) {
  try {
    const stats = lstatSync(path);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size < 1) {
      fail(REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID);
    }
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch (error) {
    if (error instanceof RevenueReadinessV1Error) throw error;
    fail(REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID);
  }
}

export function revenueReadinessContractSha256(root) {
  return sha256RevenueReadinessFile(resolve(
    root,
    REVENUE_READINESS_V1_POLICY.contractPath
  ));
}

export function validateRevenueReadinessContext(environment) {
  const dispatch = parseJson(
    environment.PROMETHEUS_REVENUE_READINESS_DISPATCH_INPUTS_JSON
  );
  const inputs = Object.freeze({
    candidateCommit: environment.PROMETHEUS_CANDIDATE_COMMIT,
    candidateTree: environment.PROMETHEUS_CANDIDATE_TREE,
    batchId: environment.PROMETHEUS_BATCH_ID,
    currentPublicVersion: environment.PROMETHEUS_CURRENT_PUBLIC_VERSION,
    currentPrivateVersion: environment.PROMETHEUS_CURRENT_PRIVATE_VERSION,
    founderAuthorization: environment.PROMETHEUS_FOUNDER_AUTHORIZATION
  });
  if (!SHA40.test(inputs.candidateCommit || "")
    || !SHA40.test(inputs.candidateTree || "")
    || !BATCH_ID.test(inputs.batchId || "")
    || inputs.batchId !== "BATCH-20260731-001"
    || !UUID.test(inputs.currentPublicVersion || "")
    || !UUID.test(inputs.currentPrivateVersion || "")
    || inputs.currentPublicVersion
      !== REVENUE_READINESS_V1_POLICY.currentPublicVersion
    || inputs.currentPrivateVersion
      !== REVENUE_READINESS_V1_POLICY.currentPrivateVersion
    || inputs.founderAuthorization
      !== REVENUE_READINESS_V1_POLICY.founderAuthorization
    || !exactKeys(dispatch, INPUT_NAMES)
    || dispatch.candidate_commit !== inputs.candidateCommit
    || dispatch.candidate_tree !== inputs.candidateTree
    || dispatch.batch_id !== inputs.batchId
    || dispatch.current_public_version !== inputs.currentPublicVersion
    || dispatch.current_private_version !== inputs.currentPrivateVersion
    || dispatch.founder_authorization !== inputs.founderAuthorization) {
    fail(REVENUE_READINESS_V1_FAILURE.INPUT_INVALID);
  }
  if (environment.GITHUB_REPOSITORY
      !== REVENUE_READINESS_V1_POLICY.repository
    || environment.GITHUB_REF !== REVENUE_READINESS_V1_POLICY.ref
    || environment.GITHUB_REF_NAME !== REVENUE_READINESS_V1_POLICY.branch
    || environment.GITHUB_REF_TYPE !== REVENUE_READINESS_V1_POLICY.refType
    || environment.GITHUB_EVENT_NAME
      !== REVENUE_READINESS_V1_POLICY.eventName
    || environment.GITHUB_ACTOR
      !== REVENUE_READINESS_V1_POLICY.founderActor
    || environment.GITHUB_TRIGGERING_ACTOR
      !== REVENUE_READINESS_V1_POLICY.founderActor
    || environment.GITHUB_WORKFLOW
      !== REVENUE_READINESS_V1_POLICY.workflowName
    || environment.GITHUB_WORKFLOW_REF
      !== REVENUE_READINESS_V1_POLICY.workflowRef
    || environment.GITHUB_RUN_ATTEMPT
      !== REVENUE_READINESS_V1_POLICY.firstRunAttempt
    || environment.GITHUB_SHA !== inputs.candidateCommit
    || !POSITIVE_INTEGER.test(environment.GITHUB_RUN_ID || "")) {
    fail(REVENUE_READINESS_V1_FAILURE.CONTEXT_INVALID);
  }
  return inputs;
}

export function revenueReadinessPathOwner(path, baselineIdentity = null) {
  if (REVENUE_READINESS_V1_POLICY.administrationPaths.some(prefix =>
    path.startsWith(prefix))
    || path === "tests/route-iq-paid-customer-revenue-administration.test.mjs") {
    return "ADMINISTRATION";
  }
  if (REVENUE_READINESS_V1_POLICY.crmPaths.some(prefix => path.startsWith(prefix))
    || path === "tests/route-iq-paid-customer-revenue-crm.test.mjs") return "CRM";
  if (REVENUE_READINESS_V1_POLICY.dataPaths.some(prefix => path.startsWith(prefix))
    || path === "tests/route-iq-paid-customer-revenue-data.test.mjs") return "DATA";
  if (REVENUE_READINESS_V1_POLICY.dashboardPaths.includes(path)) return "DASHBOARD";
  if (REVENUE_READINESS_V1_POLICY.securityPaths.includes(path)) return "SECURITY";
  if (REVENUE_READINESS_V1_POLICY.infrastructureNewPaths.includes(path)) {
    return "INFRASTRUCTURE";
  }
  if (REVENUE_READINESS_V1_POLICY.infrastructureSuccessorPaths.includes(path)) {
    return "INFRASTRUCTURE";
  }
  if (REVENUE_READINESS_V1_POLICY.intelligenceSuccessorPaths.includes(path)) {
    return "INTELLIGENCE";
  }
  if (REVENUE_READINESS_V1_POLICY.overwatchNewPaths.includes(path)) {
    return "OVERWATCH";
  }
  if (REVENUE_READINESS_V1_POLICY.overwatchSuccessorPaths.includes(path)) {
    return "OVERWATCH";
  }
  if (REVENUE_READINESS_V1_POLICY.infrastructureExistingPaths.includes(path)) {
    return baselineIdentity === INFRASTRUCTURE_IDENTITY
      ? "INFRASTRUCTURE"
      : null;
  }
  if (REVENUE_READINESS_V1_POLICY.overwatchExistingPaths.includes(path)) {
    return baselineIdentity === OVERWATCH_IDENTITY ? "OVERWATCH" : null;
  }
  return null;
}

export function validateRevenueReadinessCommitTopology(records) {
  if (!Array.isArray(records) || records.length < 7) {
    fail(REVENUE_READINESS_V1_FAILURE.OWNER_INVALID);
  }
  const owners = [];
  for (const record of records) {
    if (!isPlainObject(record)
      || !SHA40.test(record.commit || "")
      || !Array.isArray(record.parents)
      || record.parents.length !== 1
      || !SHA40.test(record.parents[0] || "")
      || !Array.isArray(record.paths)
      || record.paths.length < 1
      || new Set(record.paths).size !== record.paths.length
      || !Array.isArray(record.pathOwners)
      || record.pathOwners.length !== record.paths.length
      || !VALID_OWNERS.includes(record.owner)
      || record.pathOwners.some(owner => owner !== record.owner)
      || record.author !== IDENTITIES[record.owner]
      || record.committer !== IDENTITIES[record.owner]) {
      fail(REVENUE_READINESS_V1_FAILURE.OWNER_INVALID);
    }
    owners.push(record.owner);
  }
  const counts = Object.fromEntries(VALID_OWNERS.map(owner => [owner, 0]));
  for (const owner of owners) {
    counts[owner] += 1;
  }
  if (counts.ADMINISTRATION < 1
    || counts.CRM < 1
    || counts.DATA < 1
    || counts.DASHBOARD < 1
    || counts.SECURITY < 1
    || counts.INFRASTRUCTURE < 1
    || counts.OVERWATCH < 1
    || owners.at(-1) !== "OVERWATCH") {
    fail(REVENUE_READINESS_V1_FAILURE.OWNER_INVALID);
  }
  return Object.freeze({
    commitCount: records.length,
    administrationCommitCount: counts.ADMINISTRATION,
    crmCommitCount: counts.CRM,
    dataCommitCount: counts.DATA,
    dashboardCommitCount: counts.DASHBOARD,
    securityCommitCount: counts.SECURITY,
    infrastructureCommitCount: counts.INFRASTRUCTURE,
    intelligenceCommitCount: counts.INTELLIGENCE,
    overwatchCommitCount: counts.OVERWATCH,
    finalOwner: owners.at(-1)
  });
}

export function validateRevenueReadinessArchiveExposure({
  remoteRefs,
  pushRefspecs
}) {
  if (!Array.isArray(remoteRefs) || !Array.isArray(pushRefspecs)
    || remoteRefs.some(value => typeof value !== "string")
    || pushRefspecs.some(value => typeof value !== "string")) {
    fail(REVENUE_READINESS_V1_FAILURE.ARCHIVE_REF_EXPOSED);
  }
  const archivePattern =
    /(?:^|\/)(?:archive(?:-local)?|BATCH-20260719-005)(?:\/|$)/iu;
  const broadPushPattern =
    /(?:--all|--mirror|refs\/\*|refs\/archive|refs\/heads\/\*:)/iu;
  if (remoteRefs.some(ref => archivePattern.test(ref))
    || pushRefspecs.some(refspec => broadPushPattern.test(refspec))) {
    fail(REVENUE_READINESS_V1_FAILURE.ARCHIVE_REF_EXPOSED);
  }
  return Object.freeze({
    remoteArchiveRefs: 0,
    broadPushRefspecs: 0
  });
}

function baselineIdentityForPath(root, path) {
  const result = spawnSync("git", [
    "log",
    "-1",
    "--format=%an <%ae>",
    REVENUE_READINESS_V1_POLICY.baselineCommit,
    "--",
    path
  ], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0"
    }
  });
  if (result.status !== 0 || result.error || result.signal) {
    fail(REVENUE_READINESS_V1_FAILURE.REPOSITORY_INVALID);
  }
  return String(result.stdout || "").trim() || null;
}

function commitRecord(root, commit) {
  const metadata = runGit(root, [
    "show",
    "-s",
    "--format=%H%x00%P%x00%an <%ae>%x00%cn <%ce>",
    commit
  ], { allowEmpty: false }).split("\0");
  if (metadata.length !== 4 || metadata[0] !== commit) {
    fail(REVENUE_READINESS_V1_FAILURE.REPOSITORY_INVALID);
  }
  const paths = runGit(root, [
    "diff-tree",
    "--no-commit-id",
    "--name-only",
    "-r",
    commit
  ]).split("\n").filter(Boolean);
  const pathOwners = paths.map(path => revenueReadinessPathOwner(
    path,
    baselineIdentityForPath(root, path)
  ));
  const owners = new Set(pathOwners);
  if (owners.size !== 1 || owners.has(null)) {
    fail(REVENUE_READINESS_V1_FAILURE.OWNER_INVALID);
  }
  return Object.freeze({
    commit,
    parents: metadata[1].split(" ").filter(Boolean),
    author: metadata[2],
    committer: metadata[3],
    owner: owners.values().next().value,
    paths: Object.freeze(paths),
    pathOwners: Object.freeze(pathOwners)
  });
}

export function verifyRevenueReadinessRepository(root, inputs) {
  if (!inputs || !SHA40.test(inputs.candidateCommit || "")
    || !SHA40.test(inputs.candidateTree || "")) {
    fail(REVENUE_READINESS_V1_FAILURE.REPOSITORY_INVALID);
  }
  const head = runGit(root, ["rev-parse", "HEAD"], { allowEmpty: false });
  const tree = runGit(root, ["rev-parse", "HEAD^{tree}"], { allowEmpty: false });
  const originMain = runGit(
    root,
    ["rev-parse", "refs/remotes/origin/main"],
    { allowEmpty: false }
  );
  const branch = runGit(root, ["branch", "--show-current"], { allowEmpty: false });
  const status = runGit(root, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all"
  ]);
  const baselineTree = runGit(root, [
    "rev-parse",
    `${REVENUE_READINESS_V1_POLICY.baselineCommit}^{tree}`
  ], { allowEmpty: false });
  if (head !== inputs.candidateCommit
    || tree !== inputs.candidateTree
    || originMain !== head
    || branch !== REVENUE_READINESS_V1_POLICY.branch
    || status !== ""
    || baselineTree !== REVENUE_READINESS_V1_POLICY.baselineTree) {
    fail(REVENUE_READINESS_V1_FAILURE.REPOSITORY_INVALID);
  }
  runGit(root, [
    "merge-base",
    "--is-ancestor",
    REVENUE_READINESS_V1_POLICY.baselineCommit,
    head
  ]);
  const commits = runGit(root, [
    "rev-list",
    "--reverse",
    "--topo-order",
    `${REVENUE_READINESS_V1_POLICY.baselineCommit}..${head}`
  ], { allowEmpty: false }).split("\n");
  const topology = validateRevenueReadinessCommitTopology(
    commits.map(commit => commitRecord(root, commit))
  );
  const remoteRefs = runGit(root, [
    "for-each-ref",
    "--format=%(refname)",
    "refs/remotes/origin"
  ]).split("\n").filter(Boolean);
  const pushRefspecs = runGit(root, [
    "config",
    "--get-all",
    "remote.origin.push"
  ], { allowExitOne: true }).split("\n").filter(Boolean);
  validateRevenueReadinessArchiveExposure({ remoteRefs, pushRefspecs });
  return Object.freeze({
    head,
    tree,
    originMain,
    branch,
    ...topology
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
    qualification_artifact_id:
      environment.PROMETHEUS_QUALIFICATION_ARTIFACT_ID,
    qualification_artifact_zip_sha256:
      environment.PROMETHEUS_QUALIFICATION_ARTIFACT_ZIP_SHA256,
    qualified_content_tree_sha256:
      environment.PROMETHEUS_QUALIFIED_CONTENT_TREE_SHA256,
    qualified_manifest_sha256:
      environment.PROMETHEUS_QUALIFIED_MANIFEST_SHA256,
    workflow_contract_sha256:
      environment.PROMETHEUS_WORKFLOW_CONTRACT_SHA256,
    rollback_contract_sha256:
      environment.PROMETHEUS_ROLLBACK_CONTRACT_SHA256,
    rollback_bundle_sha256:
      environment.PROMETHEUS_ROLLBACK_BUNDLE_SHA256,
    founder_authorization: PRIVATE_WORKFLOW_V2_POLICY.founderAuthorization
  };
}

export function projectRevenueReadinessQualificationEnvironment(
  environment,
  inputs
) {
  return {
    ...environment,
    GITHUB_WORKFLOW: PRIVATE_WORKFLOW_V2_POLICY.qualificationWorkflowName,
    GITHUB_WORKFLOW_REF: PRIVATE_WORKFLOW_V2_POLICY.qualificationWorkflowRef,
    PROMETHEUS_CANDIDATE_COMMIT: inputs.candidateCommit,
    PROMETHEUS_CANDIDATE_TREE: inputs.candidateTree,
    PROMETHEUS_BATCH_ID: inputs.batchId,
    PROMETHEUS_CURRENT_PUBLIC_VERSION: inputs.currentPublicVersion,
    PROMETHEUS_CURRENT_PRIVATE_VERSION: inputs.currentPrivateVersion,
    PROMETHEUS_DISPATCH_INPUTS_JSON: JSON.stringify(
      qualificationDispatch(inputs)
    )
  };
}

export function projectRevenueReadinessDeploymentEnvironment(
  environment,
  inputs
) {
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
    PROMETHEUS_FOUNDER_AUTHORIZATION:
      PRIVATE_WORKFLOW_V2_POLICY.founderAuthorization,
    PROMETHEUS_DISPATCH_INPUTS_JSON: JSON.stringify(dispatch)
  };
}

export function assertRevenueReadinessNoProductionSecrets(environment) {
  if (privateWorkflowV2SecretEnvironmentNames.some(name => (
    typeof environment[name] === "string" && environment[name].length > 0
  ))) {
    fail(REVENUE_READINESS_V1_FAILURE.SECRET_BOUNDARY_INVALID);
  }
  return Object.freeze({ status: "NO_PRODUCTION_SECRETS_PRESENT" });
}

function artifactIdentity(environment) {
  const values = Object.fromEntries(ARTIFACT_ENVIRONMENT_NAMES.map(name => [
    name,
    environment[name]
  ]));
  if (!POSITIVE_INTEGER.test(values.PROMETHEUS_QUALIFICATION_RUN_ID || "")
    || !POSITIVE_INTEGER.test(
      values.PROMETHEUS_QUALIFICATION_ARTIFACT_ID || ""
    )
    || ARTIFACT_ENVIRONMENT_NAMES.slice(2).some(name => (
      !SHA64.test(values[name] || "")
    ))) {
    fail(REVENUE_READINESS_V1_FAILURE.ARTIFACT_INVALID);
  }
  return Object.freeze(values);
}

function verifyProjectContractPin(root, environment) {
  if (!SHA64.test(
    environment.PROMETHEUS_REVENUE_READINESS_CONTRACT_SHA256 || ""
  )
    || revenueReadinessContractSha256(root)
      !== environment.PROMETHEUS_REVENUE_READINESS_CONTRACT_SHA256) {
    fail(REVENUE_READINESS_V1_FAILURE.ARTIFACT_INVALID);
  }
}

export function runRevenueReadinessQualification({
  root,
  environment = process.env,
  qualificationImpl = runPrivateWorkerQualificationV2Command,
  repositoryImpl = verifyRevenueReadinessRepository
}) {
  const inputs = validateRevenueReadinessContext(environment);
  repositoryImpl(root, inputs);
  assertRevenueReadinessNoProductionSecrets(environment);
  const projected = projectRevenueReadinessQualificationEnvironment(
    environment,
    inputs
  );
  const result = qualificationImpl({ mode: "build", environment: projected });
  appendOutputs(environment.GITHUB_OUTPUT, {
    revenue_readiness_contract_sha256:
      revenueReadinessContractSha256(root)
  });
  return Object.freeze({
    status: "REVENUE_READINESS_QUALIFICATION_PASSED",
    result
  });
}

export async function verifyRevenueReadinessArtifact({
  root,
  environment = process.env,
  fetchImpl = globalThis.fetch,
  metadataImpl = runPrivateWorkerArtifactMetadataV2Command,
  qualificationImpl = runPrivateWorkerQualificationV2Command,
  repositoryImpl = verifyRevenueReadinessRepository
}) {
  const inputs = validateRevenueReadinessContext(environment);
  repositoryImpl(root, inputs);
  assertRevenueReadinessNoProductionSecrets(environment);
  artifactIdentity(environment);
  verifyProjectContractPin(root, environment);
  const projected = projectRevenueReadinessDeploymentEnvironment(
    environment,
    inputs
  );
  await metadataImpl({
    mode: "verify",
    environment: { ...projected },
    fetchImpl
  });
  qualificationImpl({ mode: "verify", environment: { ...projected } });
  return Object.freeze({
    status: "REVENUE_READINESS_ARTIFACT_VERIFIED"
  });
}

function deploymentEvidence(inputs, result) {
  return Object.freeze({
    schemaVersion: "paid-customer-revenue-readiness-evidence-v1",
    status: result.status,
    candidateCommit: inputs.candidateCommit,
    candidateTree: inputs.candidateTree,
    batchId: inputs.batchId,
    currentPublicVersion: inputs.currentPublicVersion,
    previousPrivateVersion: inputs.currentPrivateVersion,
    privateWorker: REVENUE_READINESS_V1_POLICY.privateWorker,
    publicWorker: REVENUE_READINESS_V1_POLICY.publicWorker,
    deploymentAttempts: result.deploymentAttempts,
    rollbackAttempts: result.rollbackAttempts,
    publicWorkerUnchanged: true,
    browserAcceptance: result.status === "PRIVATE_WORKER_V2_DEPLOYMENT_VERIFIED"
      ? SUCCESSFUL_BROWSER_ACCEPTANCE
      : ROLLBACK_BROWSER_ACCEPTANCE,
    crmWrites: 0,
    productionCustomerWrites: 0,
    providerRefresh: "OFF",
    scheduler: "OFF",
    collection: "OFF",
    activeCohortCount: 0,
    recommendationInfluence: "OFF",
    invitations: "OFF",
    billing: "OFF",
    anthonyMapped: false,
    localComputerRequiredAfterDispatch: false
  });
}

export function validateRevenueReadinessDeploymentEvidence(value, inputs) {
  if (!exactKeys(value, EVIDENCE_KEYS)
    || value.schemaVersion
      !== "paid-customer-revenue-readiness-evidence-v1"
    || ![
      "PRIVATE_WORKER_V2_DEPLOYMENT_VERIFIED",
      "PRIVATE_WORKER_V2_FORWARD_ROLLBACK_VERIFIED"
    ].includes(value.status)
    || value.candidateCommit !== inputs.candidateCommit
    || value.candidateTree !== inputs.candidateTree
    || value.batchId !== inputs.batchId
    || value.currentPublicVersion !== inputs.currentPublicVersion
    || value.previousPrivateVersion !== inputs.currentPrivateVersion
    || value.privateWorker !== REVENUE_READINESS_V1_POLICY.privateWorker
    || value.publicWorker !== REVENUE_READINESS_V1_POLICY.publicWorker
    || value.deploymentAttempts !== 1
    || ![0, 1].includes(value.rollbackAttempts)
    || value.rollbackAttempts
      !== (value.status === "PRIVATE_WORKER_V2_DEPLOYMENT_VERIFIED" ? 0 : 1)
    || value.publicWorkerUnchanged !== true
    || value.browserAcceptance
      !== (value.status === "PRIVATE_WORKER_V2_DEPLOYMENT_VERIFIED"
        ? SUCCESSFUL_BROWSER_ACCEPTANCE
        : ROLLBACK_BROWSER_ACCEPTANCE)
    || value.crmWrites !== 0
    || value.productionCustomerWrites !== 0
    || value.providerRefresh !== "OFF"
    || value.scheduler !== "OFF"
    || value.collection !== "OFF"
    || value.activeCohortCount !== 0
    || value.recommendationInfluence !== "OFF"
    || value.invitations !== "OFF"
    || value.billing !== "OFF"
    || value.anthonyMapped !== false
    || value.localComputerRequiredAfterDispatch !== false) {
    fail(REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID);
  }
  return Object.freeze({ ...value });
}

function writeDeploymentEvidence(directory, value) {
  if (typeof directory !== "string" || !isAbsolute(directory)) {
    fail(REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID);
  }
  mkdirSync(directory, { recursive: false, mode: 0o700 });
  const stats = lstatSync(directory);
  if (!stats.isDirectory() || stats.isSymbolicLink()
    || (stats.mode & 0o077) !== 0) {
    fail(REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID);
  }
  const path = join(directory, "deployment-evidence.json");
  const bytes = Buffer.from(
    `${canonicalPrivateWorkflowJson(value)}\n`,
    "ascii"
  );
  writeFileSync(path, bytes, { flag: "wx", mode: 0o400 });
  chmodSync(path, 0o400);
  return Object.freeze({
    path,
    sha256: createHash("sha256").update(bytes).digest("hex")
  });
}

export async function runRevenueReadinessDeployment({
  root,
  environment = process.env,
  deployImpl = runPrivateWorkerDeploymentV2Command,
  repositoryImpl = verifyRevenueReadinessRepository
}) {
  const inputs = validateRevenueReadinessContext(environment);
  repositoryImpl(root, inputs);
  artifactIdentity(environment);
  verifyProjectContractPin(root, environment);
  const projected = projectRevenueReadinessDeploymentEnvironment(
    environment,
    inputs
  );
  delete projected.PROMETHEUS_GITHUB_TOKEN;
  const result = await deployImpl({ mode: "deploy", environment: projected });
  const evidence = validateRevenueReadinessDeploymentEvidence(
    deploymentEvidence(inputs, result),
    inputs
  );
  const output = writeDeploymentEvidence(
    environment.PROMETHEUS_REVENUE_READINESS_EVIDENCE_OUTPUT,
    evidence
  );
  appendOutputs(environment.GITHUB_OUTPUT, {
    deployment_status: result.status,
    deployment_evidence_sha256: output.sha256
  });
  if (result.status !== "PRIVATE_WORKER_V2_DEPLOYMENT_VERIFIED") {
    fail(REVENUE_READINESS_V1_FAILURE.DEPLOYMENT_INVALID);
  }
  return Object.freeze({
    status: "REVENUE_READINESS_DEPLOYMENT_VERIFIED",
    evidenceSha256: output.sha256
  });
}

export function verifyRevenueReadinessEvidence({
  root,
  environment = process.env,
  repositoryImpl = verifyRevenueReadinessRepository,
  fetchImpl = globalThis.fetch,
  metadataImpl = verifyRevenueReadinessEvidenceArtifactMetadata
}) {
  const inputs = validateRevenueReadinessContext(environment);
  repositoryImpl(root, inputs);
  assertRevenueReadinessNoProductionSecrets(environment);
  verifyProjectContractPin(root, environment);
  const directory = environment.PROMETHEUS_REVENUE_READINESS_EVIDENCE_PATH;
  const expectedSha256 =
    environment.PROMETHEUS_REVENUE_READINESS_EVIDENCE_SHA256;
  if (typeof directory !== "string" || !isAbsolute(directory)
    || !SHA64.test(expectedSha256 || "")) {
    fail(REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID);
  }
  const artifactId =
    environment.PROMETHEUS_REVENUE_READINESS_EVIDENCE_ARTIFACT_ID;
  const artifactZipSha256 =
    environment.PROMETHEUS_REVENUE_READINESS_EVIDENCE_ARTIFACT_ZIP_SHA256;
  if (!POSITIVE_INTEGER.test(artifactId || "")
    || !SHA64.test(artifactZipSha256 || "")) {
    fail(REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID);
  }
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    fail(REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID);
  }
  if (entries.length !== 1 || entries[0] !== "deployment-evidence.json") {
    fail(REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID);
  }
  const path = join(directory, entries[0]);
  if (sha256RevenueReadinessFile(path) !== expectedSha256) {
    fail(REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID);
  }
  const value = parseJson(
    readFileSync(path, "ascii"),
    REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID
  );
  validateRevenueReadinessDeploymentEvidence(value, inputs);
  if (value.status !== "PRIVATE_WORKER_V2_DEPLOYMENT_VERIFIED"
    || value.browserAcceptance !== SUCCESSFUL_BROWSER_ACCEPTANCE
    || value.rollbackAttempts !== 0) {
    fail(REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID);
  }
  return Promise.resolve(metadataImpl({
    environment,
    fetchImpl,
    artifactId,
    artifactZipSha256,
    candidateCommit: inputs.candidateCommit
  })).then(() => Object.freeze({
    status: "REVENUE_READINESS_FINAL_EVIDENCE_VERIFIED"
  }));
}

export async function verifyRevenueReadinessEvidenceArtifactMetadata({
  environment,
  fetchImpl = globalThis.fetch,
  artifactId,
  artifactZipSha256,
  candidateCommit
}) {
  let token = environment.PROMETHEUS_GITHUB_TOKEN;
  if (typeof token !== "string"
    || token.length < 1
    || token.length > 4096
    || typeof fetchImpl !== "function"
    || !POSITIVE_INTEGER.test(artifactId || "")
    || !SHA64.test(artifactZipSha256 || "")
    || !SHA40.test(candidateCommit || "")) {
    token = "";
    fail(REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
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
        `/repos/${REVENUE_READINESS_V1_POLICY.repository}/actions/artifacts/${artifactId}`,
        "https://api.github.com"
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
      fail(REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID);
    }
    if (response.redirected || response.status !== 200) {
      fail(REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID);
    }
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 2 || bytes.length > 65_536) {
      fail(REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID);
    }
    const metadata = parseJson(
      bytes.toString("utf8"),
      REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID
    );
    if (String(metadata.id) !== artifactId
      || metadata.expired !== false
      || metadata.name
        !== `paid-customer-revenue-readiness-evidence-${candidateCommit}`
      || metadata.digest !== `sha256:${artifactZipSha256}`
      || String(metadata.workflow_run?.id)
        !== environment.PROMETHEUS_QUALIFICATION_RUN_ID
      || metadata.workflow_run?.head_sha !== candidateCommit) {
      fail(REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID);
    }
    return Object.freeze({
      status: "REVENUE_READINESS_EVIDENCE_ARTIFACT_METADATA_VERIFIED"
    });
  } finally {
    clearTimeout(timeout);
    delete headers.Authorization;
    token = "";
    if (bytes) bytes.fill(0);
  }
}

export function formatRevenueReadinessFailure(error) {
  if (error instanceof RevenueReadinessV1Error) return error.code;
  return REVENUE_READINESS_V1_FAILURE.DEPLOYMENT_INVALID;
}
