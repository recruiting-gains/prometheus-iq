import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  listTrackedFiles,
  scanTrackedRepository,
  verifyLocalSecretArtifacts
} from "./check-cloudflare-unattended-secret-presence.mjs";
import { fixedCloudflareUnattendedSmokePlan } from "./run-cloudflare-unattended-smoke.mjs";
import { verifyGithubActionsPrivateWorkerDeployment } from
  "./verify-github-actions-private-worker-deployment.mjs";

const root = resolve(import.meta.dirname, "..");
const governancePath =
  "overwatch/governance/github-actions-founder-triggered-private-worker-deployment-v1.json";
const governanceDocumentationPath =
  "overwatch/governance/github-actions-founder-triggered-private-worker-deployment-v1.md";
const historicalReportPath =
  "overwatch/reports/BATCH-20260715-010-github-actions-founder-triggered-private-worker-deployment.json";
const compatibilityReportPath =
  "overwatch/reports/BATCH-20260715-011-github-private-repository-founder-deployment-authorization.json";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";
const workflowPath = ".github/workflows/deploy-prometheus-private-worker.yml";
const contractPath =
  "workers/infrastructure/github-actions-founder-triggered-private-worker-deployment-v1.json";

const historicalOwnerCommit = "7f67855145104034b32551e25d2ebf407ce2369c";
const historicalOwnerRepairCommit = "335f75fa1d7e32160624e9ebe197d11a03e77b4e";
const historicalReleaseBase = "7c79e77dc52dd6aa5eb687ea9a24128800d9a28d";
const historicalReleaseBaseTree = "cc8d5455370f8171aa64d0f1be71f02c2d9ce2a7";
const historicalOwnerTree = "890df231e06aa92a7652b0862456bd0c4394cabe";
const historicalOwnerRepairTree = "b9965d026eeba4cb06ed6ecd9066646169ece071";
const compatibilityParent = "7a67cb648cbaa67599163ac418c2e23aa3f8b0e3";
const compatibilityOwnerCommit = "38e983b6d0a121d8aadf443938ab5985771eddac";
const compatibilityOwnerTree = "6bf0c7608e4f73788bc9428ee2d40f3f8df7e811";
const founderActor = "PrometheusRouteIQ";
const founderAuthorization =
  "I AUTHORIZE THIS EXACT PROMETHEUS PRIVATE WORKER DEPLOYMENT";

const historicalOwnerHashes = Object.freeze({
  ".github/workflows/deploy-prometheus-private-worker.yml":
    "f2e672729d9bee7a4a173627e51a622b944d3b545e4ed1f4851414b5e31897e9",
  "docs/github-actions-founder-triggered-private-worker-deployment-v1.md":
    "953a40927a416b7076bdbce700048ed886b2e7b8b60d85a8770227143aba511d",
  "scripts/lib/github-actions-private-worker-deployment.mjs":
    "eb105f0e9d96937b2faa9fe3250d150e1fa21c65f4469fd900d0944f822237d9",
  "scripts/run-github-actions-private-worker-deployment.mjs":
    "4c3fac8b30031e44b9b5e5b0ee12b1f9928098f3cc539f29f83af17fd714284e",
  "scripts/verify-github-actions-private-worker-deployment.mjs":
    "07abb337aacd83cbd0d9f14ad7494da74b7978f9b80293829e342d87979bca62",
  "tests/github-actions-private-worker-deployment.test.mjs":
    "07ddb19cb186420c4849f9750db80e20c40be65f0dd92824a84c09c32b909e24",
  "workers/infrastructure/github-actions-founder-triggered-private-worker-deployment-v1.json":
    "f5488db21c5a9c8eee10c44f80a8a05e2d5fd47ca10a47db3d243dc9a934e5ce"
});

const compatibilityOwnerHashes = Object.freeze({
  ".github/workflows/deploy-prometheus-private-worker.yml":
    "0b9a8afd7d34b5d28aeec563e35ece4b5516cf154e5e01aa70e740183745b46a",
  "docs/github-actions-founder-triggered-private-worker-deployment-v1.md":
    "77f5dd3b94393ae8ee7b8bb0c3c762ed7aa3c98c92acb1c0c85a3e94006a8b53",
  "scripts/lib/github-actions-private-worker-deployment.mjs":
    "e71bdff256e2d705a3848a8e2fbe1855508416628a18956429026c5bb0ab18ad",
  "scripts/run-github-actions-private-worker-deployment.mjs":
    "4c3fac8b30031e44b9b5e5b0ee12b1f9928098f3cc539f29f83af17fd714284e",
  "scripts/verify-github-actions-private-worker-deployment.mjs":
    "aa910f195cd836866b7ccb07290880bc762f3461b65a91234d275d72502fee63",
  "tests/github-actions-private-worker-deployment.test.mjs":
    "5e9df6579ef49c334f3a5c822ac7018dfcb7c7f923e371e005ac6608939d9bf7",
  "workers/infrastructure/github-actions-founder-triggered-private-worker-deployment-v1.json":
    "95d8d50e7ac4c9abacbac879d49bbaa3799988bb886d8ad92a98c6fe415efd6c"
});

const compatibilityChangedPaths = Object.freeze([
  ".github/workflows/deploy-prometheus-private-worker.yml",
  "docs/github-actions-founder-triggered-private-worker-deployment-v1.md",
  "scripts/lib/github-actions-private-worker-deployment.mjs",
  "scripts/verify-github-actions-private-worker-deployment.mjs",
  "tests/github-actions-private-worker-deployment.test.mjs",
  "workers/infrastructure/github-actions-founder-triggered-private-worker-deployment-v1.json"
]);

const protectedOverwatchVerifierSuccessors = Object.freeze([
  {
    path: "scripts/verify-overwatch-cloudflare-unattended-access.mjs",
    previousSha256: "6365219622cd6aebb4db6bfee5d8c76a5250fef7b3f735a5f1974bd0d94d635b",
    successorSha256: "bdec71cc16497e842264419e81c13dfd865c94c1a200138912208ad6e01f9e30",
    owner: "Prometheus Overwatch",
    reason: "Carry the original unattended-access package evidence through the Founder-triggered private Worker deployment release successor."
  },
  {
    path: "scripts/verify-overwatch-cloudflare-founder-attended-service-token.mjs",
    previousSha256: "2790795f724fe7d5c251cac45605e922372c4cec2f6b924e9dd11d218ad189f0",
    successorSha256: "147000b8f5cf5962f6e65a1378f6051bff8ca62212d4a0187d3eb013a14494ed",
    owner: "Prometheus Overwatch",
    reason: "Extend the protected package successor chain through the Founder-triggered private Worker deployment release wiring."
  },
  {
    path: "scripts/verify-overwatch-cloudflare-founder-attended-tty-compatibility.mjs",
    previousSha256: "e7b0c8f9072ed353ffbc912ddc6476c4db33e6d18b097e257627e1b3d030083c",
    successorSha256: "05ec07c66ea10ee5fa7200829e6e981e73c1a43e56276239e8f0e15784c76e12",
    owner: "Prometheus Overwatch",
    reason: "Extend the protected package successor chain through the Founder-triggered private Worker deployment release wiring."
  },
  {
    path: "scripts/verify-overwatch-cloudflare-founder-attended-get-only-recovery.mjs",
    previousSha256: "886a51d70c9ac5df6b30741a740f7f23b0f7a51220a52e596d93802d04f8aa1e",
    successorSha256: "e6312d6d89d4d51e8adcd5a87cfcabad46d2d7396842ea76b19521c55201c0de",
    owner: "Prometheus Overwatch",
    reason: "Extend the protected package successor chain through the Founder-triggered private Worker deployment release wiring."
  },
  {
    path: "scripts/verify-overwatch-cloudflare-founder-attended-response-contract-repair.mjs",
    previousSha256: "5b7593db044d5386d77975b81efe5691e514182fd147e5173abc49d7b8371aad",
    successorSha256: "57c46419ca3abeb4918acecac922043b4396acb660dc3d36ee05f19c5fc4269a",
    owner: "Prometheus Overwatch",
    reason: "Accept the cryptographically mapped GitHub deployment verifier successor without weakening prior response-contract checks."
  },
  {
    path: "scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs",
    previousSha256: "707644d0e0f89a02df6fa74ec3c1ad40f27272828b0dd9961c3d934ad5554518",
    successorSha256: "c7b01976f1d8564d8ec99657ff4d6df0a17c6418018afb1704bed2d8dc4ade81",
    owner: "Prometheus Overwatch",
    reason: "Accept the cryptographically mapped GitHub deployment verifier successor without weakening prior create-receipt checks."
  },
  {
    path: "scripts/verify-overwatch-cloudflare-unattended-keychain-interoperability.mjs",
    previousSha256: "ea9e5a53a4f6277087a01f3c5b2e688e33540a451248fc20f8a412cfc44dac51",
    successorSha256: "112531804f528d573065d5f6530bb845c8eed9d19ad0c198c4e80844903a94c0",
    owner: "Prometheus Overwatch",
    reason: "Recognize the two Infrastructure-owned deployment commits and exclude their files from the prior Overwatch ownership audit."
  }
]);
const protectedVerificationAssetSuccessors = Object.freeze([
  {
    path: "tests/cross-subsystem-artifact-contracts.test.mjs",
    previousSha256: "1c6a985c1d1c4933c7ee6df2d104164a5fc3645507111490ecbfea3ba41872a9",
    successorSha256: "688a21de1aecd5ef6b538200d2c828ba4e96027807c0fbb9b9adc7272b2c9e06",
    owner: "Prometheus Overwatch",
    reason: "Register the new canonical Overwatch governance artifact in the existing registry contract test."
  }
]);

const expectedOverwatchPaths = Object.freeze([
  governancePath,
  governanceDocumentationPath,
  compatibilityReportPath,
  "scripts/verify-overwatch-cloudflare-unattended-keychain-interoperability.mjs",
  "scripts/verify-overwatch-github-actions-private-worker-deployment.mjs",
  "tests/overwatch-github-actions-private-worker-deployment.test.mjs"
]);

const infrastructureIdentity =
  "Prometheus Infrastructure <infrastructure@prometheus.local>";
const overwatchIdentity = "Prometheus Overwatch <overwatch@prometheus.local>";
const infrastructureOwnedPaths = new Set([
  ...Object.keys(historicalOwnerHashes),
  ...Object.keys(compatibilityOwnerHashes)
]);
const overwatchOwnedPaths = new Set([
  ...expectedOverwatchPaths,
  ...protectedOverwatchVerifierSuccessors.map(item => item.path),
  ...protectedVerificationAssetSuccessors.map(item => item.path)
]);

function protectedPathOwner(path) {
  if (infrastructureOwnedPaths.has(path)) return infrastructureIdentity;
  if (overwatchOwnedPaths.has(path)) return overwatchIdentity;
  if (/^overwatch\/(?:governance|reports)\/.*github-actions-founder-triggered/u.test(path)
    || /^scripts\/verify-overwatch-github-actions-private-worker/u.test(path)
    || /^tests\/overwatch-github-actions-private-worker/u.test(path)) {
    return overwatchIdentity;
  }
  if (/^(?:\.github\/workflows|docs|scripts|tests|workers\/infrastructure)\/.*github-actions-(?:founder-triggered-)?private-worker/u
    .test(path)) {
    return infrastructureIdentity;
  }
  return null;
}

export function evaluateGithubActionsPrivateWorkerSuccessorOwnership(commits) {
  const failures = [];
  for (const commit of commits) {
    const protectedOwners = new Set(
      commit.paths.map(protectedPathOwner).filter(Boolean)
    );
    if (protectedOwners.size === 0) continue;
    if (protectedOwners.size !== 1) {
      failures.push(`Cross-owner protected successor detected: ${commit.commit}`);
      continue;
    }
    const expectedIdentity = [...protectedOwners][0];
    if (commit.author !== expectedIdentity || commit.committer !== expectedIdentity) {
      failures.push(`Protected successor ownership drifted: ${commit.commit}`);
    }
  }
  return Object.freeze({
    ok: failures.length === 0,
    failures: Object.freeze(failures)
  });
}

const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const equal = (left, right) => isDeepStrictEqual(left, right);
const git = args => execFileSync("/usr/bin/git", args, {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"]
}).trim();

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex === -1 || endIndex === -1) return "";
  return source.slice(startIndex, endIndex);
}

function evidenceMap(hashes) {
  return Object.entries(hashes).map(([path, hash]) => ({ path, sha256: hash }));
}

export function evaluateGithubActionsPrivateWorkerWorkflow(workflow) {
  const failures = [];
  const require = (condition, message) => {
    if (!condition) failures.push(message);
  };
  const trigger = section(workflow, "on:\n", "permissions:\n");
  const permissions = section(workflow, "permissions:\n", "concurrency:\n");
  const verification = section(workflow, "  verification:\n", "  deploy:\n");
  const deployIndex = workflow.indexOf("  deploy:\n");
  const deploy = deployIndex === -1 ? "" : workflow.slice(deployIndex);

  require(/^name: Deploy Prometheus Private Worker$/mu.test(workflow),
    "Workflow name drifted.");
  require(equal(
    [...trigger.matchAll(/^  ([a-z_]+):$/gmu)].map(match => match[1]),
    ["workflow_dispatch"]
  ), "Workflow is not manual dispatch only.");
  require(!/(?:push|pull_request|pull_request_target|schedule|workflow_call|workflow_run|repository_dispatch):/u
    .test(trigger), "An automatic or delegated trigger is present.");
  const inputNames = [...trigger.matchAll(/^      ([a-z_]+):$/gmu)]
    .map(match => match[1]);
  require(equal(inputNames, [
    "approved_commit",
    "approved_tree",
    "batch_id",
    "current_production_version",
    "founder_authorization"
  ]), "Founder input set drifted.");
  require(count(trigger, /^        required: true$/gmu) === 5
    && count(trigger, /^        type: string$/gmu) === 5,
  "Founder inputs are not five required strings.");
  require(trigger.includes(`description: Type exactly ${founderAuthorization}`),
    "Exact Founder authorization instruction drifted.");
  require(permissions.trim() === "permissions:\n  contents: read",
    "GitHub permissions are not read-only.");
  require(/concurrency:\n  group: deploy-prometheus-private-worker\n  cancel-in-progress: false/u
    .test(workflow), "Deployment concurrency boundary drifted.");

  for (const predicate of [
    "github.event_name == 'workflow_dispatch'",
    "github.repository == 'PrometheusRouteIQ/prometheus-iq'",
    "github.actor == 'PrometheusRouteIQ'",
    "github.triggering_actor == 'PrometheusRouteIQ'",
    "github.ref == 'refs/heads/main'",
    "github.ref_name == 'main'",
    "github.ref_type == 'branch'",
    "github.workflow == 'Deploy Prometheus Private Worker'",
    "github.workflow_ref == 'PrometheusRouteIQ/prometheus-iq/.github/workflows/deploy-prometheus-private-worker.yml@refs/heads/main'",
    "github.run_attempt == 1",
    `inputs.founder_authorization == '${founderAuthorization}'`
  ]) require(verification.includes(predicate), `Secret-free preflight is missing ${predicate}.`);

  require(!/\$\{\{\s*secrets\./u.test(verification)
    && !/environment:/u.test(verification),
  "Secret-free preflight receives environment authority.");
  require(count(workflow,
    /^          PROMETHEUS_FOUNDER_AUTHORIZATION: \$\{\{ inputs\.founder_authorization \}\}$/gmu) === 4
    && count(workflow,
      /^          PROMETHEUS_DISPATCH_INPUTS_JSON: \$\{\{ toJSON\(github\.event\.inputs\) \}\}$/gmu) === 4,
  "Founder authorization is not revalidated at every controller boundary.");
  require(/needs: verification/u.test(deploy)
    && /if: \$\{\{ needs\.verification\.result == 'success' \}\}/u.test(deploy),
  "Environment-backed deployment does not require successful preflight.");
  require(/environment:\n      name: prometheus-private-worker-production/u.test(deploy),
    "Protected deployment environment drifted.");

  const actions = [...workflow.matchAll(/^\s*uses:\s*(\S+)$/gmu)]
    .map(match => match[1]);
  require(equal(actions, [
    "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
    "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
    "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
    "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020"
  ]), "Pinned action set drifted.");
  require(count(workflow, /^          repository: PrometheusRouteIQ\/prometheus-iq$/gmu) === 2
    && count(workflow, /^          ref: main$/gmu) === 2
    && count(workflow, /^          fetch-depth: 0$/gmu) === 2
    && count(workflow, /^          persist-credentials: false$/gmu) === 2,
  "Checkout identity or credential boundary drifted.");
  require(!/^\s+(?:cache|cache-dependency-path|package-manager-cache):/mu.test(workflow)
    && !/actions\/(?:cache|upload-artifact|download-artifact)@/u.test(workflow),
  "Workflow may persist dependencies or artifacts.");

  for (const command of [
    "npm ci",
    "npm test",
    "npm run lint",
    "npm run typecheck",
    "npm run security:check",
    "node scripts/check-cloudflare-unattended-secret-presence.mjs --source=environment",
    "npm run security:aegis:verify",
    "node scripts/verify-cross-subsystem-artifact-contracts.mjs",
    "node scripts/verify-github-actions-private-worker-deployment.mjs",
    "node --test tests/github-actions-private-worker-deployment.test.mjs",
    "npm run build",
    "git diff --exit-code",
    "git diff --cached --exit-code",
    "git status --porcelain=v1 --untracked-files=all",
    "git fsck --full --strict"
  ]) require(verification.includes(command), `Verification job is missing ${command}.`);

  require(count(deploy,
    /run: node scripts\/run-github-actions-private-worker-deployment\.mjs verify/gmu) === 2,
  "Deploy job exact-version checks drifted.");
  require(count(deploy,
    /run: timeout 120s node scripts\/run-cloudflare-unattended-smoke\.mjs --execute-fixed-profile/gmu) === 2,
  "Guarded pre/post smoke boundary drifted.");
  require(count(deploy,
    /run: node scripts\/run-github-actions-private-worker-deployment\.mjs deploy/gmu) === 1,
  "Deployment attempt count drifted.");
  require(!/prometheusrouteiq-website/u.test(workflow)
    && !/wrangler(?:\.js)?\s+deploy/u.test(workflow),
  "Workflow exposes a public target or direct Wrangler path.");

  const secrets = [...workflow.matchAll(/\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/gu)]
    .map(match => match[1]);
  require(equal(secrets, [
    "CLOUDFLARE_ACCESS_CLIENT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_SECRET",
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_SECRET"
  ]), "Protected environment value references drifted.");

  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

export function evaluateGithubActionsPrivateWorkerDeploymentGovernance({
  governance,
  report,
  contract
}) {
  const failures = [];
  const require = (condition, message) => {
    if (!condition) failures.push(message);
  };
  const successor = governance.compatibilitySuccessor;

  require(governance.governanceId ===
    "github-actions-founder-triggered-private-worker-deployment-governance-v1"
    && governance.version === "1.1.0"
    && governance.batchId === "BATCH-20260715-010"
    && governance.owningSubsystem === "Prometheus Overwatch",
  "Canonical governance identity drifted.");
  require(governance.dispatchAudit.implementationOwner === "Prometheus Infrastructure"
    && governance.dispatchAudit.verificationOwner === "Prometheus Overwatch"
    && governance.dispatchAudit.implementationOwnershipRespected === true
    && governance.dispatchAudit.overwatchModifiedInfrastructureImplementation === false,
  "Historical dispatch ownership boundary drifted.");
  require(equal(governance.dispatchAudit.implementationCommits, [
    {
      commit: historicalOwnerCommit,
      parent: historicalReleaseBase,
      tree: historicalOwnerTree,
      subject: "infrastructure: add Founder-triggered private worker deployment"
    },
    {
      commit: historicalOwnerRepairCommit,
      parent: historicalOwnerCommit,
      tree: historicalOwnerRepairTree,
      subject: "infrastructure: repair private worker deployment invariants"
    }
  ]), "Historical implementation chain drifted.");
  require(governance.startingStateAudit.reportedLocalHead ===
    "48345d5e40d5f70ec1d1dfb4bf5eed4d337f7d23"
    && governance.startingStateAudit.reportedOriginMain === historicalReleaseBase
    && governance.startingStateAudit.reportedUncommittedDiagnosticFiles === 6
    && governance.startingStateAudit.blockedChainCommitsAhead === 7
    && governance.startingStateAudit.blockedChainCommitsBehind === 0
    && governance.startingStateAudit.diagnosticDisposition.owner ===
      "Prometheus Infrastructure"
    && governance.startingStateAudit.diagnosticDisposition.localOnly === true
    && governance.startingStateAudit.diagnosticDisposition.includedInRelease === false
    && governance.startingStateAudit.unverifiedDiagnosticWorkPushed === false
    && equal(governance.startingStateAudit.reconciledReleaseBase, {
      commit: historicalReleaseBase,
      tree: historicalReleaseBaseTree,
      branch: "main"
    }),
  "Historical starting-state audit drifted.");
  require(equal(governance.ownerEvidence, evidenceMap(historicalOwnerHashes)),
    "Historical BATCH-010 owner evidence drifted.");
  require(equal(governance.protectedPredecessorSuccessors, [{
    predecessorGovernanceId: "cloudflare-unattended-deployment-access-governance-v1",
    path: "package.json",
    historicalSha256: "a150ca1b1121c779415365551efdbff970e458915ba6491716ccbfdd0a111d0d",
    successorSha256: "4495e53724179fc0520beae1dc4b865fda003e1f2ec7472bc9d5aa4f88b50a2e",
    successorOwner: "Prometheus Overwatch",
    reason: "Carry the original unattended-access package baseline through the manual GitHub deployment release-gate successor."
  }]) && equal(governance.protectedReleaseWiringTransitions, [{
    path: "package.json",
    previousSha256: "20ef38b1eb8a04119362e72338329ddfa0c3d2b2272a4b9526a65d8a5c01061d",
    successorSha256: "4495e53724179fc0520beae1dc4b865fda003e1f2ec7472bc9d5aa4f88b50a2e",
    owner: "Prometheus Overwatch",
    reason: "Register the Infrastructure owner gate and independent Overwatch GitHub private Worker deployment gate in the complete repository suite."
  }]), "Historical package successor mapping drifted.");
  require(equal(governance.protectedOverwatchVerifierSuccessors,
    protectedOverwatchVerifierSuccessors)
    && equal(governance.protectedVerificationAssetSuccessors,
      protectedVerificationAssetSuccessors),
  "Historical protected verifier successor mapping drifted.");
  require(successor?.batchId === "BATCH-20260715-011"
    && successor.directive ===
      "GitHub Private-Repository Founder Deployment Authorization Compatibility v1"
    && successor.implementationOwner === "Prometheus Infrastructure"
    && successor.verificationOwner === "Prometheus Overwatch"
    && successor.implementationOwnershipRespected === true
    && successor.overwatchModifiedInfrastructureImplementation === false,
  "Compatibility dispatch ownership drifted.");
  require(equal(successor?.implementationCommit, {
    commit: compatibilityOwnerCommit,
    parent: compatibilityParent,
    tree: compatibilityOwnerTree,
    subject: "infrastructure: require Founder-authenticated deployment dispatch"
  }), "Compatibility owner commit mapping drifted.");
  require(equal(successor?.changedPaths, compatibilityChangedPaths)
    && equal(successor?.ownerEvidence, evidenceMap(compatibilityOwnerHashes)),
  "Compatibility owner evidence drifted.");
  require(successor?.authorizationModel?.privateRepositoryRequiredReviewerAvailable === false
    && successor.authorizationModel.actor === founderActor
    && successor.authorizationModel.triggeringActor === founderActor
    && successor.authorizationModel.workflowBranch === "main"
    && successor.authorizationModel.firstRunAttemptOnly === true
    && successor.authorizationModel.rerunAllowed === false
    && successor.authorizationModel.exactAuthorizationPhrase === founderAuthorization
    && successor.authorizationModel.founderDispatchIsExplicitApproval === true
    && successor.authorizationModel.environmentMainOnlyDeploymentRuleRequired === true
    && successor.authorizationModel.secretFreePreflightRequired === true
    && successor.authorizationModel.deploymentJobRequiresSuccessfulPreflight === true,
  "Founder authorization governance drifted.");
  require(Object.values(successor?.externalActions ?? {}).every(value => value === false),
    "Compatibility batch claims an unauthorized external action.");

  require(equal(governance.workflowBoundary.requiredInputs, [
    "approved_commit",
    "approved_tree",
    "batch_id",
    "current_production_version",
    "founder_authorization"
  ]) && governance.workflowBoundary.onlyTrigger === "workflow_dispatch"
    && governance.workflowBoundary.branch === "main"
    && governance.workflowBoundary.privateWorker === "prometheus-iq"
    && governance.workflowBoundary.publicWorker === "prometheusrouteiq-website"
    && governance.workflowBoundary.publicWorkerDeploymentAllowed === false
    && governance.workflowBoundary.repository === "PrometheusRouteIQ/prometheus-iq"
    && governance.workflowBoundary.protectedEnvironment ===
      "prometheus-private-worker-production"
    && governance.workflowBoundary.environmentRequiredReviewer === false
    && governance.workflowBoundary.environmentMainOnlyDeploymentRuleRequired === true
    && governance.workflowBoundary.founderActor === founderActor
    && governance.workflowBoundary.founderTriggeringActor === founderActor
    && governance.workflowBoundary.firstRunAttemptOnly === true
    && governance.workflowBoundary.exactFounderAuthorizationPhrase === founderAuthorization
    && governance.workflowBoundary.concurrencyGroup ===
      "deploy-prometheus-private-worker"
    && governance.workflowBoundary.cancelInProgress === false
    && equal(governance.workflowBoundary.githubPermissions, { contents: "read" }),
  "Current workflow governance drifted.");
  require(governance.supplyChainBoundary.checkoutCommit ===
    "34e114876b0b11c390a56381ad16ebd13914f8d5"
    && governance.supplyChainBoundary.setupNodeCommit ===
      "49933ea5288caeca8642d1e84afbd3f7d6820020"
    && governance.supplyChainBoundary.wranglerVersion === "4.110.0"
    && governance.supplyChainBoundary.dependencyCacheInputsOmitted === true
    && governance.supplyChainBoundary.checkoutCredentialsPersisted === false
    && governance.supplyChainBoundary.artifactsOrCachesUploaded === false,
  "Supply-chain boundary drifted.");
  require(governance.secretBoundary.verificationJobReceivesSecrets === false
    && governance.secretBoundary.founderAndInputPreflightReceivesSecrets === false
    && governance.secretBoundary.deploymentJobRequiresSuccessfulPreflight === true
    && governance.secretBoundary.valuesInGitChatWorkflowLogsArtifactsScreenshotsOrReportsAllowed === false,
  "Secret boundary drifted.");
  require(equal(governance.secretBoundary.protectedEnvironmentValueNames, [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_SECRET"
  ]) && governance.secretBoundary.founderEntersValuesDirectlyInGitHub === true
    && governance.secretBoundary.deploymentCredentialsScopedToOneDeploymentStep === true
    && governance.secretBoundary.smokeCredentialsScopedToTwoFixedSmokeSteps === true,
  "Protected value scope drifted.");
  for (const field of [
    "exactCommitTreeBatchAndCurrentVersionRequired",
    "currentOriginMainMustEqualApprovedCommit",
    "cleanRepositoryAndIndexRequired",
    "gitIntegrityRequired",
    "cloudflareCurrentVersionMustMatch",
    "singleVersionAtOneHundredPercentRequired",
    "preMutationConcurrencyRecheckRequired",
    "dryRunRequired",
    "oneWranglerDeploymentAttemptMaximum",
    "keepVarsRequired",
    "strictConflictProtectionRequired",
    "publicDeploymentIdAndVersionMustRemainUnchanged",
    "fixedGuardedSmokeBeforeAndAfter"
  ]) require(governance.deploymentSafety[field] === true,
    `Deployment safety drifted: ${field}.`);
  require(governance.deploymentSafety.privateConfigFixed === "wrangler.jsonc"
    && equal(governance.deploymentSafety.smokeMethods, ["GET", "HEAD"])
    && governance.deploymentSafety.smokeWriteAttemptsAllowed === 0,
  "Fixed deployment or smoke boundary drifted.");
  require(governance.runtimeBoundary.prospectiveCollection === "OFF"
    && governance.runtimeBoundary.activeCohorts === 0
    && governance.runtimeBoundary.recommendationInfluence === "OFF"
    && governance.runtimeBoundary.deploymentPerformedByBatch === false
    && governance.runtimeBoundary.productionMutationPerformedByBatch === false
    && governance.runtimeBoundary.cloudflareRequestPerformedByBatch === false
    && governance.runtimeBoundary.accessPolicyMutationPerformedByBatch === false
    && governance.runtimeBoundary.keychainValueReadPerformedByBatch === false
    && governance.runtimeBoundary.secretEntryPerformedByBatch === false,
  "Runtime boundary drifted.");
  require(governance.manualSetupBoundary.requiredReviewerProtectionAvailable === false
    && governance.manualSetupBoundary.environmentMainOnlyDeploymentRuleRequired === true
    && governance.manualSetupBoundary.founderDispatchIdentityIsApprovalSignal === true
    && governance.manualSetupBoundary.deploymentReadyNow === false
    && governance.manualSetupBoundary.workflowSourceReady === true
    && governance.manualSetupBoundary.protectedEnvironmentConfiguredByBatch === false
    && governance.manualSetupBoundary.environmentSecretsConfiguredByBatch === false
    && governance.manualSetupBoundary.serviceAuthPolicyConfiguredByBatch === false
    && governance.manualSetupBoundary.guardRuntimeConfiguredByBatch === false,
  "Private-repository setup boundary drifted.");
  require(governance.rollback.nativeCloudflareRollbackAllowed === false
    && governance.rollback.historyRewriteAllowed === false
    && governance.rollback.isolatedExerciseRequiredBeforePush === true
    && governance.releaseBoundary.pushMayTriggerDeployment === false
    && governance.releaseBoundary.deploymentAuthorizedByThisBatch === false,
  "Release boundary drifted.");

  require(report.batchId === "BATCH-20260715-011"
    && report.dispatchAudit.implementationOwner === "Prometheus Infrastructure"
    && report.dispatchAudit.verificationOwner === "Prometheus Overwatch"
    && report.dispatchAudit.implementationCommit === compatibilityOwnerCommit
    && report.dispatchAudit.implementationOwnershipRespected === true
    && report.completed.workflowDispatchOnly === true
    && report.completed.founderActorExact === founderActor
    && report.completed.founderTriggeringActorExact === founderActor
    && report.completed.firstRunAttemptOnly === true
    && report.completed.rerunAllowed === false
    && report.completed.secretFreePreflightRequired === true
    && report.completed.environmentJobRequiresSuccessfulPreflight === true
    && report.githubPlanCompatibility.requiredReviewerProtectionAvailable === false
    && report.runtimeBoundaries.deployment === "NOT_PERFORMED_NOT_AUTHORIZED_BY_THIS_BATCH"
    && report.runtimeBoundaries.prospectiveCollection === "OFF"
    && report.runtimeBoundaries.activeCohorts === 0
    && report.runtimeBoundaries.recommendationInfluence === "OFF"
    && report.release.pushMayTriggerDeployment === false,
  "Compatibility batch report drifted.");

  require(contract.batchId === "BATCH-20260715-011"
    && contract.owner === "Prometheus Infrastructure"
    && contract.implementationStatus ===
      "PRIVATE_REPOSITORY_COMPATIBILITY_IMPLEMENTED_NOT_EXECUTED"
    && contract.deploymentPerformed === false
    && contract.productionMutationPerformed === false
    && contract.founderAuthorization.actor === founderActor
    && contract.founderAuthorization.triggeringActor === founderActor
    && contract.founderAuthorization.workflowBranch === "main"
    && contract.founderAuthorization.firstRunAttemptOnly === true
    && contract.founderAuthorization.rerunAllowed === false
    && contract.founderAuthorization.exactPhrase === founderAuthorization
    && contract.founderAuthorization.validationOccursWithoutSecrets === true
    && contract.founderAuthorization.environmentJobRequiresSuccessfulPreflight === true
    && equal(contract.founderInputs.names, governance.workflowBoundary.requiredInputs)
    && contract.runtimeBoundaries.collection === "OFF"
    && contract.runtimeBoundaries.activeCohortCount === 0
    && contract.runtimeBoundaries.recommendationInfluence === "OFF",
  "Infrastructure compatibility contract drifted.");

  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

function verifyOwnerHistory(governance) {
  for (const commit of [historicalOwnerCommit, historicalOwnerRepairCommit]) {
    execFileSync("/usr/bin/git", ["merge-base", "--is-ancestor", commit, "HEAD"], {
      cwd: root,
      stdio: "ignore"
    });
  }
  const historicalOwnerMetadata = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    historicalOwnerCommit
  ]).split("\n");
  if (!equal(historicalOwnerMetadata, [
    historicalOwnerCommit,
    historicalReleaseBase,
    historicalOwnerTree,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "infrastructure: add Founder-triggered private worker deployment"
  ])) throw new Error("Historical Infrastructure owner provenance drifted.");
  const historicalRepairMetadata = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    historicalOwnerRepairCommit
  ]).split("\n");
  if (!equal(historicalRepairMetadata, [
    historicalOwnerRepairCommit,
    historicalOwnerCommit,
    historicalOwnerRepairTree,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "infrastructure: repair private worker deployment invariants"
  ])) throw new Error("Historical Infrastructure repair provenance drifted.");
  const metadata = git([
    "show", "-s", "--format=%H%n%T%n%P%n%an <%ae>%n%cn <%ce>%n%s",
    compatibilityOwnerCommit
  ]).split("\n");
  if (!equal(metadata, [
    compatibilityOwnerCommit,
    compatibilityOwnerTree,
    compatibilityParent,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "infrastructure: require Founder-authenticated deployment dispatch"
  ])) throw new Error("Infrastructure compatibility commit provenance drifted.");
  const changed = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", compatibilityOwnerCommit
  ]).split("\n").filter(Boolean);
  if (!equal(changed, compatibilityChangedPaths)) {
    throw new Error("Infrastructure compatibility file set drifted.");
  }
  if (changed.some(path => path.startsWith("overwatch/") || path === "package.json")) {
    throw new Error("Infrastructure crossed the Overwatch ownership boundary.");
  }

  for (const [path, expected] of Object.entries(historicalOwnerHashes)) {
    const historical = execFileSync("/usr/bin/git", [
      "show", `${historicalOwnerRepairCommit}:${path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
    if (sha256(historical) !== expected) {
      throw new Error(`Historical owner evidence drifted: ${path}`);
    }
  }
  const currentEvidence = new Map(
    governance.compatibilitySuccessor.ownerEvidence.map(item => [item.path, item.sha256])
  );
  for (const [path, expected] of Object.entries(compatibilityOwnerHashes)) {
    if (sha256(readFileSync(resolve(root, path))) !== expected
      || currentEvidence.get(path) !== expected) {
      throw new Error(`Compatibility owner evidence drifted: ${path}`);
    }
  }
}

function statusPaths() {
  return execFileSync("/usr/bin/git", [
    "status", "--porcelain=v1", "--untracked-files=all"
  ], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trimEnd()
    .split("\n").filter(Boolean).map(line => line.slice(3));
}

function verifyOverwatchOwnership() {
  const head = git(["rev-parse", "HEAD"]);
  if (head === compatibilityOwnerCommit) {
    if (!equal([...statusPaths()].sort(), [...expectedOverwatchPaths].sort())) {
      throw new Error("Uncommitted Overwatch compatibility set drifted.");
    }
    return;
  }
  const commits = git(["rev-list", "--reverse", `${compatibilityOwnerCommit}..HEAD`])
    .split("\n").filter(Boolean);
  if (commits.length < 1) {
    throw new Error("Overwatch compatibility successor is missing.");
  }
  const successorOwnership = evaluateGithubActionsPrivateWorkerSuccessorOwnership(
    commits.map(commit => {
      const [author, committer] = git([
        "show", "-s", "--format=%an <%ae>%n%cn <%ce>", commit
      ]).split("\n");
      return {
        commit,
        author,
        committer,
        paths: git(["diff-tree", "--no-commit-id", "--name-only", "-r", commit])
          .split("\n").filter(Boolean)
      };
    })
  );
  if (!successorOwnership.ok) {
    throw new Error(successorOwnership.failures.join("\n"));
  }
  const paths = git(["diff", "--name-only", compatibilityOwnerCommit, "HEAD"])
    .split("\n").filter(Boolean);
  const overwatchPaths = paths.filter(path => expectedOverwatchPaths.includes(path));
  if (!equal([...overwatchPaths].sort(), [...expectedOverwatchPaths].sort())) {
    throw new Error("Overwatch compatibility file set drifted.");
  }
  if (overwatchPaths.some(path => Object.hasOwn(compatibilityOwnerHashes, path)
    || path.startsWith("workers/infrastructure/")
    || path.startsWith("scripts/lib/github-actions-private-worker"))) {
    throw new Error("Overwatch modified Infrastructure implementation.");
  }
}

function verifyRegistryAndReleaseWiring() {
  const registry = readJson(registryPath);
  const artifact = registry.governanceArtifacts.find(item => item.artifactId ===
    "github-actions-founder-triggered-private-worker-deployment-governance-v1");
  if (!artifact
    || artifact.ownerSubsystem !== "Prometheus Overwatch"
    || artifact.path !== governancePath
    || artifact.documentationPath !== governanceDocumentationPath
    || artifact.productionConsumer !== false
    || artifact.failClosedIfMissing !== true) {
    throw new Error("Canonical GitHub deployment governance registration drifted.");
  }
  const scripts = readJson("package.json").scripts;
  if (scripts["infrastructure:github-private-worker-deployment:check"] !==
    "node scripts/verify-github-actions-private-worker-deployment.mjs && node --test tests/github-actions-private-worker-deployment.test.mjs"
    || scripts["overwatch:github-private-worker-deployment:check"] !==
      "node scripts/verify-overwatch-github-actions-private-worker-deployment.mjs && node --test tests/overwatch-github-actions-private-worker-deployment.test.mjs"
    || !scripts.test.includes("npm run infrastructure:github-private-worker-deployment:check")
    || !scripts.test.includes("npm run overwatch:github-private-worker-deployment:check")
    || !scripts["test:overwatch"].includes(
      "tests/overwatch-github-actions-private-worker-deployment.test.mjs")) {
    throw new Error("Package release wiring drifted.");
  }
}

function verifyProtectedHistoricalSuccessors() {
  for (const transition of [
    ...protectedOverwatchVerifierSuccessors,
    ...protectedVerificationAssetSuccessors
  ]) {
    const previous = execFileSync("/usr/bin/git", [
      "show", `${historicalOwnerRepairCommit}:${transition.path}`
    ], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    const acceptedSuccessor = execFileSync("/usr/bin/git", [
      "show", `${compatibilityParent}:${transition.path}`
    ], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (sha256(previous) !== transition.previousSha256
      || sha256(acceptedSuccessor) !== transition.successorSha256
      || transition.owner !== "Prometheus Overwatch") {
      throw new Error(`Protected historical successor drifted: ${transition.path}`);
    }
  }
}

export function verifyOverwatchGithubActionsPrivateWorkerDeployment() {
  const governance = readJson(governancePath);
  const historicalReport = readJson(historicalReportPath);
  const report = readJson(compatibilityReportPath);
  const contract = readJson(contractPath);
  const evaluation = evaluateGithubActionsPrivateWorkerDeploymentGovernance({
    governance,
    report,
    contract
  });
  if (!evaluation.ok) throw new Error(evaluation.failures.join("\n"));
  if (historicalReport.batchId !== "BATCH-20260715-010"
    || historicalReport.status !==
      "ENGINEERING_SOURCE_PASS_SETUP_REQUIRED_NOT_DEPLOYED"
    || historicalReport.owners.implementation !== "Prometheus Infrastructure"
    || historicalReport.owners.verification !== "Prometheus Overwatch"
    || !equal(historicalReport.owners.implementationCommits, [
      historicalOwnerCommit,
      historicalOwnerRepairCommit
    ])
    || historicalReport.owners.ownershipRespected !== true
    || historicalReport.startingState.blockedLocalHead !==
      "48345d5e40d5f70ec1d1dfb4bf5eed4d337f7d23"
    || historicalReport.startingState.releaseBase !== historicalReleaseBase
    || historicalReport.startingState.sixDiagnosticFilesPreservedByInfrastructure !== true
    || historicalReport.startingState.blockedChainIncludedInRelease !== false
    || historicalReport.independentFindingsAndRepairs.length !== 2
    || !historicalReport.independentFindingsAndRepairs.every(item =>
      item.status === "CLOSED")
    || historicalReport.boundaries.deployment !==
      "NOT_PERFORMED_NOT_AUTHORIZED_BY_THIS_BATCH"
    || historicalReport.boundaries.accessPolicyMutation !== false
    || historicalReport.boundaries.githubEnvironmentMutation !== false
    || historicalReport.boundaries.githubSecretEntry !== false
    || historicalReport.boundaries.keychainValueRead !== false
    || historicalReport.boundaries.prospectiveCollection !== "OFF"
    || historicalReport.boundaries.activeCohorts !== 0
    || historicalReport.boundaries.recommendationInfluence !== "OFF"
    || historicalReport.setupReadiness.workflowSourceReady !== true
    || historicalReport.setupReadiness.firstDeploymentReady !== false
    || historicalReport.release.deploymentStatus !== "NOT_AUTHORIZED") {
    throw new Error("Historical BATCH-010 report drifted.");
  }
  const workflowEvaluation = evaluateGithubActionsPrivateWorkerWorkflow(read(workflowPath));
  if (!workflowEvaluation.ok) throw new Error(workflowEvaluation.failures.join("\n"));

  verifyOwnerHistory(governance);
  verifyOverwatchOwnership();
  verifyRegistryAndReleaseWiring();
  verifyProtectedHistoricalSuccessors();
  const ownerResult = verifyGithubActionsPrivateWorkerDeployment();
  if (ownerResult.status !== "passed"
    || ownerResult.batchId !== "BATCH-20260715-011"
    || ownerResult.owner !== "Prometheus Infrastructure"
    || ownerResult.privateWorker !== "prometheus-iq"
    || ownerResult.publicWorkerDeploymentAllowed !== false
    || ownerResult.networkRequestsPerformed !== 0
    || ownerResult.productionMutationPerformed !== false) {
    throw new Error("Infrastructure owner verifier failed.");
  }

  const smokePlan = fixedCloudflareUnattendedSmokePlan();
  if (smokePlan.length === 0 || smokePlan.some(request => (
    !["GET", "HEAD"].includes(request.method)
    || request.redirect !== "manual"
    || request.credentials !== "omit"
    || request.body !== false
  ))) throw new Error("Fixed smoke plan is not default-deny read-only.");

  const scanPaths = [...new Set([...listTrackedFiles(root), ...expectedOverwatchPaths])];
  if (scanTrackedRepository({
    root,
    trackedFiles: scanPaths,
    readFile: path => readFileSync(resolve(root, path))
  }).length !== 0) throw new Error("Tracked secret scan failed.");
  if (verifyLocalSecretArtifacts({ root }).length !== 0) {
    throw new Error("Local secret artifact boundary failed.");
  }

  return Object.freeze({
    status: "passed",
    batchId: "BATCH-20260715-011",
    implementationOwner: "Prometheus Infrastructure",
    verificationOwner: "Prometheus Overwatch",
    implementationCommit: compatibilityOwnerCommit,
    founderActor,
    founderTriggeringActor: founderActor,
    workflowBranch: "main",
    workflowTrigger: "workflow_dispatch",
    rerunAllowed: false,
    privateWorker: "prometheus-iq",
    publicWorkerDeploymentAllowed: false,
    protectedEnvironment: "prometheus-private-worker-production",
    smokeMethods: ["GET", "HEAD"],
    writeAttemptsAllowed: 0,
    deploymentPerformed: false,
    productionMutationPerformed: false,
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    firstDeploymentReady: false
  });
}

if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(
    verifyOverwatchGithubActionsPrivateWorkerDeployment(),
    null,
    2
  ));
}
