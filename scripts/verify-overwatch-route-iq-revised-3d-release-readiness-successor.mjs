#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPublicForwardRollbackArtifact } from "./lib/route-iq-public-forward-rollback.mjs";
import { verifyRouteIqPublicDeploymentAssets } from "./verify-route-iq-public-deployment-assets.mjs";

export const REVISED_3D_READINESS_SUCCESSOR_PATH =
  "overwatch/governance/route-iq-revised-3d-release-readiness-successor-v1.json";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const IMPLEMENTATION_COMMIT = "cbe50718e45faf1be264de59ae1c1990f5c8d7da";
const IMPLEMENTATION_TREE = "43f5989cad0db36701c8e092bcaa7038d7aa44ad";
const HISTORICAL_JSON_PATH =
  "overwatch/governance/route-iq-public-crm-founder-access-deployment-readiness-v1.json";
const HISTORICAL_MARKDOWN_PATH =
  "overwatch/governance/route-iq-public-crm-founder-access-deployment-readiness-v1.md";
const PREDECESSOR_GOVERNANCE_PATH = "overwatch/governance/route-iq-3d-visual-continuity-v1.json";
const HISTORICAL_JSON_SHA256 = "b5f2dedca4f561f154c7df2270ea8c1f268496e89440524bf8e8a35d61bd8e4e";
const HISTORICAL_MARKDOWN_SHA256 = "3ee3bf2685dfc75362f017174437ebdd81aa434e01e7cea016b75b65a68f8f7c";
const PREDECESSOR_GOVERNANCE_SHA256 = "9d263113cb36ac6c9eeca0cc5785c5062fc773f0817f6b2eb23f6441be24b099";
const HISTORICAL_ROLLBACK_SHA256 = "850b22be068103dd4b9d860624151293ba5e57244fd381de08e6563e368277d0";
const DEPLOYMENT_ASSETS_SHA256 = "5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15";
const ROLLBACK_CONTRACT_SHA256 = "150d24acaeee5f1f6589bb92582fc701e7480cca22d5bd136ce0f27af4fc220b";
const ROLLBACK_BUNDLE_SHA256 = "381b471ed3fa0a1fdab0b612600be2f2b6e77b45d3b9c02418a056e0eb500b5a";
const EXPECTED_SUCCESSOR_PATHS = Object.freeze([
  "overwatch/governance/route-iq-revised-3d-release-readiness-successor-v1.json",
  "scripts/verify-overwatch-route-iq-3d-visual-continuity.mjs",
  "scripts/verify-overwatch-route-iq-public-crm-founder-access-deployment-readiness.mjs",
  "scripts/verify-overwatch-route-iq-revised-3d-release-readiness-successor.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const EXPECTED_SETTING_NAMES = Object.freeze([
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "ROUTE_IQ_REQUEST_CRM_ACCESS_AUDIENCE",
  "ROUTE_IQ_REQUEST_CRM_ACCESS_TEAM_DOMAIN",
  "ROUTE_IQ_REQUEST_CRM_FOUNDER_SUBJECT_SHA256"
]);
const EXPECTED_HISTORICAL_CLASSIFICATION = Object.freeze([
  "HISTORICAL_RECONSTRUCTION_EVIDENCE",
  "NON_DEPLOYABLE",
  "NOT_AN_AUTHORIZATION_SOURCE",
  "SUPERSEDED"
]);
const ACCEPTANCE_TEXT =
  "I reviewed the revised Route IQ website and accept the restored 3D background, motion, mobile presentation, Route IQ-focused wording, and REQUEST ROUTE IQ experience as the intended public design.";

const read = (root, path) => readFileSync(resolve(root, path));
const readJson = (root, path) => JSON.parse(read(root, path).toString("utf8"));
const sha256 = value => createHash("sha256").update(value).digest("hex");

function git(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0"
    },
    maxBuffer: 8 * 1024 * 1024,
    timeout: 30_000
  }).trim();
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function commitRecord(root, commit) {
  const [author, committer, subject] = git(root, "show", "-s", "--format=%ae%n%ce%n%s", commit).split("\n");
  const paths = git(root, "diff-tree", "--no-commit-id", "--name-only", "-r", commit)
    .split("\n")
    .filter(Boolean);
  return { author, committer, subject, paths };
}

export function validateRevised3dReadinessSuccessor(
  successor,
  { requireFounderAcceptance = true } = {}
) {
  assert.equal(successor?.governanceId, "route-iq-revised-3d-release-readiness-successor-v1");
  assert.equal(successor?.batchId, "BATCH-20260719-007");
  assert.equal(successor?.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(successor?.authority?.authoritativeDeploymentReadinessRecord, true);
  assert.equal(successor?.authority?.deploymentAuthorizationSource, false);
  assert.equal(successor?.authority?.explicitFounderDeploymentDecisionRequired, true);
  assert.equal(successor?.authority?.finalReleaseHeadAndTreeRecordedExternally, true);
  assert.equal(successor?.authority?.selfReferentialCommitOrTreePinAllowed, false);

  assert.equal(successor?.protectedImplementationPredecessor?.commit, IMPLEMENTATION_COMMIT);
  assert.equal(successor?.protectedImplementationPredecessor?.tree, IMPLEMENTATION_TREE);
  assert.equal(successor?.protectedImplementationPredecessor?.relationship, "PROTECTED_IMPLEMENTATION_PREDECESSOR");
  assert.equal(successor?.protectedImplementationPredecessor?.implementationChangesAllowedAfterPredecessor, false);
  assert.equal(successor?.protectedImplementationPredecessor?.allowedSuccessorOwnership, "Prometheus Overwatch");
  assert.deepEqual(sorted(successor?.protectedImplementationPredecessor?.allowedSuccessorScope || []), [
    "governance",
    "provenance",
    "tests",
    "verification"
  ]);

  assert.equal(successor?.predecessorGovernance?.path, PREDECESSOR_GOVERNANCE_PATH);
  assert.equal(successor?.predecessorGovernance?.sha256, PREDECESSOR_GOVERNANCE_SHA256);
  assert.equal(
    successor?.predecessorGovernance?.recordedState,
    "CANDIDATE_GOVERNANCE_FROZEN_EXACT_HEAD_VERIFICATION_REQUIRED"
  );
  assert.equal(successor?.predecessorGovernance?.predecessorStateIsDeploymentAuthority, false);

  const historical = successor?.historicalReadinessRecord;
  assert.equal(historical?.jsonPath, HISTORICAL_JSON_PATH);
  assert.equal(historical?.jsonSha256, HISTORICAL_JSON_SHA256);
  assert.equal(historical?.markdownPath, HISTORICAL_MARKDOWN_PATH);
  assert.equal(historical?.markdownSha256, HISTORICAL_MARKDOWN_SHA256);
  assert.deepEqual(sorted(historical?.classification || []), EXPECTED_HISTORICAL_CLASSIFICATION);
  assert.equal(historical?.historicalRollbackSha256, HISTORICAL_ROLLBACK_SHA256);
  assert.equal(historical?.historicalRollbackIdentityIsCurrent, false);
  assert.equal(historical?.executableDeploymentAuthority, false);
  assert.equal(historical?.rewritten, false);
  assert.equal((JSON.stringify(successor).match(new RegExp(HISTORICAL_ROLLBACK_SHA256, "gu")) || []).length, 1);

  assert.equal(successor?.releaseIdentities?.deploymentAssetsSha256, DEPLOYMENT_ASSETS_SHA256);
  assert.equal(successor?.releaseIdentities?.rollbackContractSha256, ROLLBACK_CONTRACT_SHA256);
  assert.equal(successor?.releaseIdentities?.deterministicForwardRollbackBundleSha256, ROLLBACK_BUNDLE_SHA256);
  assert.deepEqual(successor?.productionIdentities, {
    publicWorker: {
      name: "prometheusrouteiq-website",
      version: "a0296f92-4427-4cea-a3e2-9a5e05a4596c",
      trafficPercent: 100
    },
    privateWorker: {
      name: "prometheus-iq",
      version: "b8cba784-dfd3-4f8e-8356-816cccf6aecc",
      trafficPercent: 100
    },
    productionChangedByClosure: false
  });

  assert.equal(successor?.githubEnvironment?.name, "prometheus-public-worker-production");
  assert.equal(successor?.githubEnvironment?.branch, "main");
  assert.deepEqual(
    sorted((successor?.githubEnvironment?.settingNames || []).map(item => item.name)),
    EXPECTED_SETTING_NAMES
  );
  assert.equal((successor?.githubEnvironment?.settingNames || []).every(item => item.status === "PRESENT"), true);
  assert.equal(successor?.githubEnvironment?.valuesAccessed, false);
  assert.equal(successor?.githubEnvironment?.valuesStoredInSource, false);

  assert.equal(successor?.founderPrincipal?.mappingStatus, "COMPLETE");
  assert.equal(successor?.founderPrincipal?.twoAuthenticationConsistency, "PASS");
  assert.equal(successor?.founderPrincipal?.rawJwtStored, false);
  assert.equal(successor?.founderPrincipal?.rawSubjectStored, false);
  assert.equal(successor?.founderPrincipal?.subjectHashStoredInSource, false);
  assert.equal(successor?.founderPrincipal?.anthonyMapped, false);
  assert.equal(successor?.edgeProtections?.accessApplicationId, "58513324-6467-49fa-a75a-0e9a9af11820");
  assert.equal(successor?.edgeProtections?.accessPolicyId, "82b77a0f-8640-4e55-9191-0335b0dc0025");
  assert.equal(successor?.edgeProtections?.rawPathWafRuleId, "95b3e54b4a564f35a158b906c844b3a0");
  assert.equal(successor?.edgeProtections?.aegisWafRuleId, "af1688f3366446b991ba2ec12066093b");
  assert.equal(successor?.edgeProtections?.founderRootAndDescendantsProtected, true);
  assert.equal(successor?.edgeProtections?.wafProtectionsActive, true);
  assert.equal(successor?.edgeProtections?.workersDev, "OFF");
  assert.equal(successor?.edgeProtections?.previewUrls, "OFF");

  assert.equal(successor?.visualAcceptance?.requiredConfirmation, ACCEPTANCE_TEXT);
  if (requireFounderAcceptance) {
    assert.equal(successor?.status, "READY_FOR_EXPLICIT_FOUNDER_DEPLOYMENT_DECISION");
    assert.equal(
      successor?.predecessorGovernance?.authoritativeSuccessorState,
      "READY_FOR_EXPLICIT_FOUNDER_DEPLOYMENT_DECISION"
    );
    assert.equal(successor?.visualAcceptance?.status, "ACCEPTED");
    assert.equal(successor?.visualAcceptance?.acceptedBy, "Cruz Garza");
    assert.match(successor?.visualAcceptance?.acceptedAt || "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u);
  } else {
    assert.ok([
      "AUTHORITATIVE_SUCCESSOR_READY_FOUNDER_VISUAL_ACCEPTANCE_PENDING",
      "READY_FOR_EXPLICIT_FOUNDER_DEPLOYMENT_DECISION"
    ].includes(successor?.status));
  }

  assert.equal(successor?.safetyState?.prospectiveCollection, "OFF");
  assert.equal(successor?.safetyState?.activeCohorts, 0);
  assert.equal(successor?.safetyState?.recommendationInfluence, "OFF");
  assert.equal(successor?.safetyState?.anthonyMapped, false);
  assert.equal(successor?.safetyState?.deploymentPerformed, false);
  assert.equal(successor?.safetyState?.workflowDispatched, false);
  assert.equal(successor?.safetyState?.productionDataChanged, false);
  assert.equal(successor?.releaseBoundary?.deploymentAuthorized, false);
  assert.equal(successor?.releaseBoundary?.workflowDispatchAuthorized, false);
  assert.equal(successor?.releaseBoundary?.cloudflareMutationAuthorized, false);
  assert.equal(successor?.releaseBoundary?.githubMutationAuthorized, false);
  assert.equal(successor?.releaseBoundary?.secretAccessAuthorized, false);
  assert.equal(successor?.releaseBoundary?.archivalRefsPushAllowed, false);
  return successor;
}

function verifyProtectedSuccessor(root) {
  assert.equal(git(root, "rev-parse", `${IMPLEMENTATION_COMMIT}^{tree}`), IMPLEMENTATION_TREE);
  execFileSync("git", ["merge-base", "--is-ancestor", IMPLEMENTATION_COMMIT, "HEAD"], { cwd: root });
  assert.equal(git(root, "rev-list", "--min-parents=2", `${IMPLEMENTATION_COMMIT}..HEAD`), "");
  const commits = git(root, "rev-list", "--reverse", `${IMPLEMENTATION_COMMIT}..HEAD`)
    .split("\n")
    .filter(Boolean);
  assert.ok(commits.length > 0, "Authoritative readiness successor is not committed after the protected candidate.");
  for (const commit of commits) {
    const record = commitRecord(root, commit);
    assert.equal(record.author, "overwatch@prometheus.local", `Non-Overwatch author after protected candidate: ${commit}`);
    assert.equal(record.committer, "overwatch@prometheus.local", `Non-Overwatch committer after protected candidate: ${commit}`);
    assert.match(record.subject, /^overwatch:/u, `Non-Overwatch successor subject: ${commit}`);
    for (const path of record.paths) {
      assert.ok(EXPECTED_SUCCESSOR_PATHS.includes(path), `Out-of-scope successor path: ${path}`);
    }
  }
  const changed = git(root, "diff", "--name-only", `${IMPLEMENTATION_COMMIT}..HEAD`)
    .split("\n")
    .filter(Boolean);
  assert.deepEqual(sorted(changed), sorted(EXPECTED_SUCCESSOR_PATHS));
  return commits;
}

function verifyConsumerResolution(root) {
  for (const path of [
    "scripts/verify-overwatch-route-iq-3d-visual-continuity.mjs",
    "scripts/verify-overwatch-route-iq-public-crm-founder-access-deployment-readiness.mjs"
  ]) {
    const source = read(root, path).toString("utf8");
    assert.match(source, /verifyOverwatchRevised3dReleaseReadinessSuccessor/u, `Readiness consumer does not resolve successor: ${path}`);
  }
}

export function verifyOverwatchRevised3dReleaseReadinessSuccessor({
  root = ROOT,
  build = false,
  requireClean = true,
  requireFounderAcceptance = true,
  requireCommittedSuccessor = true
} = {}) {
  const successor = validateRevised3dReadinessSuccessor(
    readJson(root, REVISED_3D_READINESS_SUCCESSOR_PATH),
    { requireFounderAcceptance }
  );
  assert.equal(sha256(read(root, HISTORICAL_JSON_PATH)), HISTORICAL_JSON_SHA256);
  assert.equal(sha256(read(root, HISTORICAL_MARKDOWN_PATH)), HISTORICAL_MARKDOWN_SHA256);
  assert.equal(sha256(read(root, PREDECESSOR_GOVERNANCE_PATH)), PREDECESSOR_GOVERNANCE_SHA256);
  assert.equal(
    readJson(root, HISTORICAL_JSON_PATH).recovery.infrastructureRepairComparison.files[
      "workers/infrastructure/route-iq-public-forward-rollback-v1.json"
    ],
    HISTORICAL_ROLLBACK_SHA256
  );
  assert.equal(
    sha256(read(root, successor.releaseIdentities.rollbackContractPath)),
    ROLLBACK_CONTRACT_SHA256
  );

  const deployment = verifyRouteIqPublicDeploymentAssets({ build });
  assert.equal(deployment.deploymentAssetsSha256, DEPLOYMENT_ASSETS_SHA256);
  const rollback = verifyPublicForwardRollbackArtifact(root);
  assert.equal(rollback.artifactSha256, ROLLBACK_BUNDLE_SHA256);

  const wrangler = read(root, "wrangler.prometheusrouteiq-website.jsonc").toString("utf8");
  assert.match(wrangler, /"workers_dev"\s*:\s*false/u);
  assert.match(wrangler, /"preview_urls"\s*:\s*false/u);
  const workflow = read(root, ".github/workflows/deploy-prometheus-public-worker.yml").toString("utf8");
  assert.match(workflow, /workflow_dispatch:/u);
  assert.doesNotMatch(workflow, /^\s{2}(?:push|schedule|repository_dispatch|workflow_call):/mu);
  assert.match(workflow, /github\.actor == 'PrometheusRouteIQ'/u);
  assert.match(workflow, /github\.triggering_actor == 'PrometheusRouteIQ'/u);
  assert.doesNotMatch(workflow, /--name/u);
  assert.doesNotMatch(workflow, /partner-intake[^\n]*(?:POST|PUT|PATCH|DELETE)/iu);

  verifyConsumerResolution(root);
  const successorCommits = requireCommittedSuccessor ? verifyProtectedSuccessor(root) : [];
  if (requireClean) assert.equal(git(root, "status", "--porcelain"), "", "Working tree is not clean.");
  return Object.freeze({
    status: successor.status,
    batchId: successor.batchId,
    protectedImplementationCommit: IMPLEMENTATION_COMMIT,
    protectedImplementationTree: IMPLEMENTATION_TREE,
    head: git(root, "rev-parse", "HEAD"),
    tree: git(root, "rev-parse", "HEAD^{tree}"),
    successorCommits,
    deploymentAssetsSha256: DEPLOYMENT_ASSETS_SHA256,
    rollbackContractSha256: ROLLBACK_CONTRACT_SHA256,
    rollbackBundleSha256: ROLLBACK_BUNDLE_SHA256,
    publicWorkerVersion: successor.productionIdentities.publicWorker.version,
    privateWorkerVersion: successor.productionIdentities.privateWorker.version,
    founderVisualAcceptance: successor.visualAcceptance.status,
    deploymentAuthorized: false
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyOverwatchRevised3dReleaseReadinessSuccessor();
  process.stdout.write(`${result.status} ${result.deploymentAssetsSha256}\n`);
}
