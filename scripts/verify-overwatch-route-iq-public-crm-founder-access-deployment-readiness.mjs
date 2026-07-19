#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const GOVERNANCE_PATH = "overwatch/governance/route-iq-public-crm-founder-access-deployment-readiness-v1.json";

const EXPECTED_CRM_PATHS = Object.freeze([
  "crm/README.md",
  "crm/route-iq-request-crm-contract-v1.json",
  "crm/route-iq-request-crm.mjs",
  "tests/crm-route-iq-founder-access-boundary.test.mjs",
  "tests/crm-route-iq-request-lifecycle.test.mjs"
]);

const EXPECTED_INFRASTRUCTURE_PATHS = Object.freeze([
  ".github/workflows/deploy-prometheus-public-worker.yml",
  "docs/github-actions-founder-triggered-public-worker-deployment-v1.md",
  "docs/route-iq-public-crm-founder-access-v1.md",
  "scripts/lib/cloudflare-public-crm-founder-access.mjs",
  "scripts/lib/github-actions-public-worker-deployment.mjs",
  "scripts/lib/route-iq-public-forward-rollback.mjs",
  "scripts/run-cloudflare-public-crm-founder-access.mjs",
  "scripts/run-cloudflare-public-worker-smoke.mjs",
  "scripts/run-github-actions-public-worker-deployment.mjs",
  "scripts/verify-cloudflare-public-crm-founder-access.mjs",
  "scripts/verify-github-actions-public-worker-deployment.mjs",
  "scripts/verify-route-iq-public-forward-rollback.mjs",
  "tests/cloudflare-public-crm-founder-access.test.mjs",
  "tests/github-actions-public-worker-deployment.test.mjs",
  "workers/infrastructure/cloudflare-public-worker-smoke-contract.js",
  "workers/infrastructure/github-actions-founder-triggered-public-worker-deployment-v1.json",
  "workers/infrastructure/route-iq-public-crm-founder-access-v1.json",
  "workers/infrastructure/route-iq-public-forward-rollback-v1.json"
]);

const EXPECTED_INFRASTRUCTURE_COMMIT_PATHS = Object.freeze({
  "2be88021bfc9107c200a2fef5fd065da875e52c6": EXPECTED_INFRASTRUCTURE_PATHS,
  "d9c1b3322c5ad2fb12f3ae5dbfc7f42e807d61a8": Object.freeze([
    "scripts/lib/github-actions-public-worker-deployment.mjs",
    "tests/github-actions-public-worker-deployment.test.mjs"
  ]),
  "1791728ad6a6777e828220dac6a7e93b207f95bc": Object.freeze([
    ".github/workflows/deploy-prometheus-public-worker.yml"
  ]),
  "1490d4722867a5e203eb159ffbaf01c9645fb127": Object.freeze([
    "docs/github-actions-founder-triggered-public-worker-deployment-v1.md",
    "scripts/lib/github-actions-public-worker-deployment.mjs",
    "scripts/lib/route-iq-public-forward-rollback.mjs",
    "scripts/verify-github-actions-public-worker-deployment.mjs",
    "tests/github-actions-public-worker-deployment.test.mjs",
    "workers/infrastructure/route-iq-public-forward-rollback-v1.json"
  ])
});

const EXPECTED_RECONSTRUCTED_FILE_HASHES = Object.freeze({
  "docs/github-actions-founder-triggered-public-worker-deployment-v1.md": "bb900dcf9d5efcf67819f09cffc831835208d63f2ab1f038cadfa655e52b64d8",
  "scripts/lib/github-actions-public-worker-deployment.mjs": "6c89e4323c6e97b410f6f546ff1df6daf16f4c3114219bfdc4cde60b4f6316b8",
  "scripts/lib/route-iq-public-forward-rollback.mjs": "5f8bd67241b1b50ec3c721c53c1f26df8daa45fd82d295e4b9fa3ae17b8fadb6",
  "scripts/verify-github-actions-public-worker-deployment.mjs": "62ac8cdf937346f41866529eec69ad4fe18c3e941aa75853ecea5546b5810e17",
  "tests/github-actions-public-worker-deployment.test.mjs": "46874484df143adfba56d2e3d72cdb7afcbc4a24e5c227f16be1c8163f21337d",
  "workers/infrastructure/route-iq-public-forward-rollback-v1.json": "850b22be068103dd4b9d860624151293ba5e57244fd381de08e6563e368277d0"
});

const EXCLUDED_LOCAL_COMMITS = Object.freeze([
  "0aac4732670bde05596c1c8cde60c533172663f7",
  "5a3339f465cbcd81b1c7eeca5c9d384afbcf4d1c"
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sorted(value) {
  return [...value].sort((left, right) => left.localeCompare(right));
}

function sameStrings(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

function git(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0"
    },
    maxBuffer: 4 * 1024 * 1024,
    timeout: 30_000
  }).trim();
}

function isAncestor(root, ancestor, descendant) {
  try {
    git(root, ["cat-file", "-e", `${ancestor}^{commit}`]);
  } catch {
    return false;
  }
  try {
    git(root, ["merge-base", "--is-ancestor", ancestor, descendant]);
    return true;
  } catch (error) {
    if (error?.status === 1) return false;
    throw error;
  }
}

function sha256File(root, path) {
  return createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
}

function commitRecord(root, commit) {
  const [tree, parent, author, committer, subject] = git(root, [
    "show",
    "-s",
    "--format=%T%n%P%n%an <%ae>%n%cn <%ce>%n%s",
    commit
  ]).split("\n");
  const paths = git(root, [
    "diff-tree",
    "--no-commit-id",
    "--name-only",
    "-r",
    commit
  ]).split("\n").filter(Boolean);
  return { tree, parent, author, committer, subject, paths };
}

export function validatePublicCrmReadinessGovernance(governance) {
  invariant(governance?.governanceId === "route-iq-public-crm-founder-access-deployment-readiness-governance-v1", "governance id drifted");
  invariant(governance?.batchId === "BATCH-20260719-005", "batch id drifted");
  invariant(governance?.owningSubsystem === "Prometheus Overwatch", "governance owner drifted");
  invariant(governance?.dispatchAudit?.implementationOwnershipRespected === true, "implementation ownership is unverified");
  invariant(governance?.dispatchAudit?.overwatchModifiedSubsystemImplementation === false, "Overwatch implementation boundary drifted");
  invariant(sameStrings(governance?.dispatchAudit?.crm?.filesChanged || [], EXPECTED_CRM_PATHS), "CRM ownership paths drifted");
  invariant(sameStrings(governance?.dispatchAudit?.infrastructure?.filesChanged || [], EXPECTED_INFRASTRUCTURE_PATHS), "Infrastructure ownership paths drifted");

  const recovery = governance?.recovery;
  invariant(recovery?.authorizedFailedLocalHead === "5a3339f465cbcd81b1c7eeca5c9d384afbcf4d1c", "failed local HEAD evidence drifted");
  invariant(recovery?.reconstructionBase === "f0bbad58e0b9ff2cf99b8e55a875f65ec14f35c7", "reconstruction base drifted");
  invariant(recovery?.archivalEvidence?.refNamespace === "refs/archive-local/BATCH-20260719-005", "archive namespace drifted");
  invariant(recovery?.archivalEvidence?.localOnly === true && recovery?.archivalEvidence?.pushAllowed === false && recovery?.archivalEvidence?.mergeAllowed === false && recovery?.archivalEvidence?.deploymentAllowed === false && recovery?.archivalEvidence?.releaseHistoryAllowed === false, "archive isolation drifted");
  invariant(sameStrings((recovery?.excludedCommits || []).map(item => item.commit), EXCLUDED_LOCAL_COMMITS), "excluded commit set drifted");
  invariant(recovery?.pushedHistoryChanged === false && recovery?.noIntendedImplementationLost === true && recovery?.mixedOwnershipPresent === false, "release reconstruction integrity drifted");
  invariant(recovery?.infrastructureRepairComparison?.result === "IDENTICAL_TO_ARCHIVED_CORRECTED_WORKTREE", "Infrastructure reconstruction comparison drifted");
  invariant(JSON.stringify(recovery?.infrastructureRepairComparison?.files) === JSON.stringify(EXPECTED_RECONSTRUCTED_FILE_HASHES), "reconstructed file evidence drifted");

  const access = governance?.cloudflareAccess;
  invariant(access?.application?.id === "58513324-6467-49fa-a75a-0e9a9af11820", "Access app id drifted");
  invariant(access?.application?.path === "prometheusrouteiq.com/api/partner-intake/founder/*", "Access path broadened");
  invariant(access?.application?.count === 1, "Access app is not unique");
  invariant(access?.policy?.id === "82b77a0f-8640-4e55-9191-0335b0dc0025", "Access policy id drifted");
  invariant(access?.policy?.decision === "allow", "Access policy decision drifted");
  invariant(access?.policy?.include === "one_exact_verified_founder_email", "Founder selector broadened");
  invariant(access?.policy?.require === "one_exact_otp_identity_provider", "identity provider requirement drifted");
  invariant(access?.policy?.everyoneAllowed === false && access?.policy?.bypassAllowed === false && access?.policy?.displayNameAllowed === false, "broad Founder authorization is allowed");
  invariant(access?.publicWebsiteRemainsPublic === true && access?.publicRequestSubmissionRemainsPublic === true && access?.founderEndpointsProtected === true, "HTTP boundary drifted");
  invariant(access?.rawJwtStored === false && access?.rawSubjectStored === false, "raw identity material may be stored");

  invariant(JSON.stringify(governance?.runtimeSettings?.names) === JSON.stringify([
    "ROUTE_IQ_REQUEST_CRM_ACCESS_TEAM_DOMAIN",
    "ROUTE_IQ_REQUEST_CRM_ACCESS_AUDIENCE",
    "ROUTE_IQ_REQUEST_CRM_FOUNDER_SUBJECT_SHA256"
  ]), "runtime setting names drifted");
  invariant(governance?.runtimeSettings?.valuesStoredInSource === false, "runtime setting values may enter source");
  invariant(governance?.deploymentControl?.trigger === "workflow_dispatch", "automatic deployment trigger is allowed");
  invariant(governance?.deploymentControl?.publicWorker === "prometheusrouteiq-website", "public target drifted");
  invariant(governance?.deploymentControl?.privateWorkerDeploymentAllowed === false, "private Worker deployment is allowed");
  invariant(governance?.deploymentControl?.oneAttempt === true && governance?.deploymentControl?.simultaneousDeploymentsAllowed === false, "deployment attempt guard drifted");
  invariant(JSON.stringify(governance?.deploymentControl?.smokeMethods) === JSON.stringify(["GET", "HEAD"]), "smoke contract permits writes");
  invariant(governance?.liveProduction?.deploymentPerformed === false && governance?.liveProduction?.productionCrmRequestSubmitted === false && governance?.liveProduction?.productionDataMutationPerformed === false, "unauthorized production action recorded");
  invariant(governance?.safetyState?.prospectiveCollection === "OFF" && governance?.safetyState?.activeCohorts === 0 && governance?.safetyState?.recommendationInfluence === "OFF", "Route IQ safety state drifted");
  invariant(governance?.rollback?.strategy === "new_forward_deployment" && governance?.rollback?.nativeCloudflareRollbackAllowed === false && governance?.rollback?.rehearsalStatus === "PASS", "rollback governance drifted");
  invariant(governance?.rollback?.artifactSha256 === "4636e18bd3d99a803803a7ab78dcd2dbf634de8d9e34386c5c43f4df6fcb1ad1", "rollback artifact identity drifted");
  invariant(governance?.release?.sourceControlProvenanceRecovered === true && governance?.release?.deploymentAuthorized === false && governance?.release?.cloudflareMutationAuthorized === false && governance?.release?.credentialAccessAuthorized === false, "release boundary drifted");
  return governance;
}

export function verifyOverwatchPublicCrmFounderAccessDeploymentReadiness(root = resolve(fileURLToPath(new URL("..", import.meta.url)))) {
  const governance = validatePublicCrmReadinessGovernance(JSON.parse(readFileSync(resolve(root, GOVERNANCE_PATH), "utf8")));
  const crm = commitRecord(root, governance.dispatchAudit.crm.commit);
  invariant(crm.tree === governance.dispatchAudit.crm.tree, "CRM tree drifted");
  invariant(crm.author === governance.dispatchAudit.crm.author, "CRM author drifted");
  invariant(crm.committer === governance.dispatchAudit.crm.committer, "CRM committer drifted");
  invariant(crm.subject === governance.dispatchAudit.crm.subject, "CRM subject drifted");
  invariant(sameStrings(crm.paths, EXPECTED_CRM_PATHS), "CRM commit scope drifted");

  const infrastructureCommits = governance.dispatchAudit.infrastructure.commits;
  for (const record of infrastructureCommits) {
    const actual = commitRecord(root, record.commit);
    invariant(actual.tree === record.tree, `Infrastructure tree drifted: ${record.commit}`);
    invariant(actual.author === record.author, `Infrastructure author drifted: ${record.commit}`);
    invariant(actual.committer === record.committer, `Infrastructure committer drifted: ${record.commit}`);
    invariant(actual.subject === record.subject, `Infrastructure subject drifted: ${record.commit}`);
    invariant(sameStrings(actual.paths, EXPECTED_INFRASTRUCTURE_COMMIT_PATHS[record.commit] || []), `Infrastructure commit scope drifted: ${record.commit}`);
  }
  let expectedParent = governance.dispatchAudit.crm.commit;
  for (const record of infrastructureCommits) {
    invariant(commitRecord(root, record.commit).parent === expectedParent, `Infrastructure dependency order drifted: ${record.commit}`);
    expectedParent = record.commit;
  }
  const infrastructurePaths = infrastructureCommits.flatMap(record => commitRecord(root, record.commit).paths);
  invariant(sameStrings(new Set(infrastructurePaths), EXPECTED_INFRASTRUCTURE_PATHS), "Infrastructure commit scope drifted");
  invariant(isAncestor(root, infrastructureCommits.at(-1).commit, "HEAD"), "Infrastructure successor is not in release history");
  for (const commit of EXCLUDED_LOCAL_COMMITS) {
    invariant(!isAncestor(root, commit, "HEAD"), `excluded local commit entered release history: ${commit}`);
  }
  for (const [path, expectedHash] of Object.entries(EXPECTED_RECONSTRUCTED_FILE_HASHES)) {
    invariant(sha256File(root, path) === expectedHash, `reconstructed file hash drifted: ${path}`);
  }

  const workflow = readFileSync(resolve(root, ".github/workflows/deploy-prometheus-public-worker.yml"), "utf8");
  invariant(/name: Deploy Prometheus Public Worker/u.test(workflow), "public deployment workflow name drifted");
  invariant(/workflow_dispatch:/u.test(workflow), "workflow dispatch trigger missing");
  invariant(!/^\s{2}(push|schedule|pull_request|repository_dispatch|workflow_call):/mu.test(workflow), "automatic or reusable deployment trigger present");
  invariant(/github\.actor == 'PrometheusRouteIQ'/u.test(workflow) && /github\.triggering_actor == 'PrometheusRouteIQ'/u.test(workflow), "Founder GitHub identity gate missing");
  invariant(/environment:\s*\n\s*name: prometheus-public-worker-production/u.test(workflow), "protected public environment missing");
  invariant(!/--name/u.test(workflow), "workflow permits a Worker name override");
  invariant(!/partner-intake[^\n]*(POST|PUT|PATCH|DELETE)/iu.test(workflow), "workflow can submit a CRM write");

  const crmContract = JSON.parse(readFileSync(resolve(root, "crm/route-iq-request-crm-contract-v1.json"), "utf8"));
  invariant(crmContract.httpBoundary.publicIntake.path === "/api/partner-intake" && crmContract.httpBoundary.publicIntake.cloudflareAccessRequired === false, "public intake boundary drifted");
  invariant(crmContract.httpBoundary.founderAccess.applicationPath === "/api/partner-intake/founder/*" && crmContract.httpBoundary.founderAccess.cloudflareAccessRequired === true, "Founder boundary drifted");
  invariant(crmContract.authorization.cloudflareAccess.everyoneSelectorAllowed === false && crmContract.authorization.cloudflareAccess.bypassPolicyAllowed === false && crmContract.authorization.cloudflareAccess.displayNameSelectorAllowed === false, "CRM authorization broadened");

  return Object.freeze({
    ok: true,
    batchId: governance.batchId,
    status: governance.status,
    determination: governance.determination,
    accessApplicationId: governance.cloudflareAccess.application.id,
    accessPolicyId: governance.cloudflareAccess.policy.id,
    crmCommit: governance.dispatchAudit.crm.commit,
    infrastructureCommits: infrastructureCommits.map(item => item.commit),
    excludedCommits: EXCLUDED_LOCAL_COMMITS,
    rollbackArtifactSha256: governance.rollback.artifactSha256
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyOverwatchPublicCrmFounderAccessDeploymentReadiness();
  process.stdout.write(`OVERWATCH_PUBLIC_CRM_FOUNDER_ACCESS_DEPLOYMENT_READINESS_VERIFIED ${result.status}\n`);
}
