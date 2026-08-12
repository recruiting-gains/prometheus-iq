import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  verifyGovernedMultiSessionLearningAdvisorySuccessor
} from "../intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs";
import {
  verifyCanonicalRouteIqGovernedLearningArtifact
} from "../intelligence/provenance/verify-route-iq-governed-multi-session-learning-v1.mjs";
import {
  verifyRouteIqGovernedLearningAdvisorySecurity
} from "../security/verify-route-iq-governed-learning-advisory-v1.mjs";

const root = resolve(import.meta.dirname, "..");
const governancePath =
  "overwatch/governance/route-iq-governed-multi-session-learning-dashboard-advisory-bridge-v1.json";

const expectedChangedPaths = new Map([
  ["ff06fb0723e0842c970fd344049b999ba774faa4", [
    "data/route-iq-field-sessions-v1/route-iq-eligible-session-manifest.mjs",
    "data/route-iq-field-sessions-v1/route-iq-governed-learning-source-v1.json",
    "tests/helpers/route-iq-governed-learning-fixtures.mjs",
    "tests/route-iq-eligible-session-manifest.test.mjs"
  ]],
  ["eff79c156b1820621cf80b4e4eb87c030d8c5024", [
    "intelligence/off-route-learning-intelligence.mjs",
    "intelligence/read-only-field-session-learning.mjs",
    "intelligence/route-iq-governed-multi-session-learning.mjs",
    "tests/route-iq-governed-multi-session-learning.test.mjs"
  ]],
  ["53d080494c7377789b697d8bcc47fd0e8958b722", [
    "dashboard/route-iq-dashboard-platform.mjs",
    "index.html",
    "tests/dashboard-route-iq-governed-learning-advisory.test.mjs"
  ]],
  ["9568ccfcbb72035bbd4ff56994209a09b6e06143", [
    "intelligence/artifacts/route-iq-governed-multi-session-learning-v1/fitness_connection/cruz/governed-learning-artifact-v1.json",
    "intelligence/provenance/verify-route-iq-governed-multi-session-learning-v1.mjs",
    "tests/route-iq-governed-multi-session-learning.test.mjs"
  ]],
  ["267225d51e32acc6f50ce932a945e2749783734e", [
    "_headers",
    "deploy/cloudflare-pages/_headers",
    "deploy/cloudflare-pages/dashboard/route-iq-dashboard-platform.mjs",
    "deploy/cloudflare-pages/index.html",
    "index.html",
    "tests/route-iq-governed-learning-advisory-infrastructure.test.mjs",
    "workers/infrastructure/route-iq-governed-learning-advisory-runtime.js",
    "workers/prometheus-iq-worker.js"
  ]],
  ["5a96af214010d7b446b0f209b6239933c86cc838", [
    "security/route-iq-governed-learning-advisory-v1.json",
    "security/verify-route-iq-governed-learning-advisory-v1.mjs",
    "tests/route-iq-governed-learning-advisory-security.test.mjs"
  ]],
  ["da3f9ff739ecb883ac2bddb169aefb1b9632b525", [
    "patents/route-iq/GOVERNED_MULTI_SESSION_LEARNING_DASHBOARD_ADVISORY_BRIDGE_V1.md",
    "patents/route-iq/INVENTION_EVIDENCE_REGISTER.md"
  ]],
  ["0e3d720f09e65cea066c5181afdff44d96a4e8ca", [
    "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs"
  ]],
  ["76946be76fea7dd9ec558739f63bd7310a766a66", [
    "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs"
  ]],
  ["7633c44d5e43ca64e32ece2da38f6e9925d34d4c", [
    "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs"
  ]],
  ["f1b889bb45e357a757656d992e91d95580cc8880", [
    "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs"
  ]],
  ["2f86078e53d80f72f8ff02e36e00aa564120f9c6", [
    "intelligence/provenance/protected-baseline-synchronization-governed-multi-session-learning-advisory-v1.json"
  ]]
]);

function read(path) {
  return readFileSync(resolve(root, path));
}

function readJson(path) {
  return JSON.parse(read(path).toString("utf8"));
}

function sha256(path) {
  return createHash("sha256").update(read(path)).digest("hex");
}

function git(args, encoding = "utf8") {
  return execFileSync("/usr/bin/git", args, {
    cwd: root,
    encoding,
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function changedPaths(commit) {
  return git(["diff-tree", "--no-commit-id", "--name-only", "-r", commit])
    .trim().split("\n").filter(Boolean).sort();
}

function verifyOwnerCommits(governance) {
  assert.equal(governance.ownerCommits.length, expectedChangedPaths.size);
  for (const ownerCommit of governance.ownerCommits) {
    const fields = git([
      "show", "-s", "--format=%H%n%T%n%an <%ae>%n%cn <%ce>%n%s",
      ownerCommit.commit
    ]).trim().split("\n");
    assert.deepEqual(fields, [
      ownerCommit.commit,
      ownerCommit.tree,
      ownerCommit.owner,
      ownerCommit.owner,
      ownerCommit.subject
    ], `Owner identity drifted: ${ownerCommit.commit}`);
    assert.deepEqual(
      changedPaths(ownerCommit.commit),
      [...expectedChangedPaths.get(ownerCommit.commit)].sort(),
      `Owner scope drifted: ${ownerCommit.commit}`
    );
    execFileSync("/usr/bin/git", [
      "merge-base", "--is-ancestor", ownerCommit.commit, "HEAD"
    ], { cwd: root, stdio: "ignore" });
  }
}

function verifyGeneratedParity() {
  for (const [source, mirror] of [
    ["index.html", "deploy/cloudflare-pages/index.html"],
    ["_headers", "deploy/cloudflare-pages/_headers"],
    [
      "dashboard/route-iq-dashboard-platform.mjs",
      "deploy/cloudflare-pages/dashboard/route-iq-dashboard-platform.mjs"
    ]
  ]) {
    assert.deepEqual(read(source), read(mirror), `Generated mirror drifted: ${mirror}`);
  }
}

function verifyRepositoryBoundaries(governance) {
  assert.equal(
    git(["rev-parse", `${governance.startingRepository.commit}^{tree}`]).trim(),
    governance.startingRepository.tree
  );
  assert.equal(git(["remote", "get-url", "origin"]).trim(), governance.startingRepository.remote);
  assert.equal(git(["rev-parse", "--abbrev-ref", "HEAD"]).trim(), "main");
  for (const path of governance.unchangedBehaviorPaths) {
    execFileSync("/usr/bin/git", [
      "diff", "--quiet", `${governance.startingRepository.commit}..HEAD`, "--", path
    ], { cwd: root, stdio: "ignore" });
  }
  execFileSync("/usr/bin/git", [
    "diff", "--quiet", `${governance.startingRepository.commit}..HEAD`, "--",
    governance.historicalEvidence.path
  ], { cwd: root, stdio: "ignore" });
  const changed = git([
    "diff", "--name-only", `${governance.startingRepository.commit}..HEAD`
  ]).trim().split("\n").filter(Boolean);
  assert.equal(changed.some(path => path.startsWith(".github/workflows/")), false);
  assert.equal(changed.some(path => /^wrangler(?:\.|\/)/u.test(path)), false);
}

export function verifyOverwatchRouteIqGovernedLearningAdvisoryBridge() {
  const governance = readJson(governancePath);
  assert.equal(governance.batchId, "BATCH-20260812-001");
  assert.equal(governance.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(
    governance.status,
    "SOURCE_COMPLETE_UNDEPLOYED_HOSTED_QUALIFICATION_PENDING"
  );
  verifyOwnerCommits(governance);
  for (const pin of governance.criticalPins) {
    assert.equal(sha256(pin.path), pin.sha256, `Critical source drifted: ${pin.path}`);
  }
  verifyGeneratedParity();
  verifyRepositoryBoundaries(governance);

  const artifact = verifyCanonicalRouteIqGovernedLearningArtifact();
  assert.deepEqual(artifact, {
    status: "PASS",
    artifactId: governance.canonicalArtifact.artifactId,
    artifactSha256: governance.canonicalArtifact.artifactSha256,
    manifestSha256: governance.canonicalArtifact.manifestSha256,
    sessions: governance.canonicalArtifact.sessions,
    visits: governance.canonicalArtifact.visits,
    recommendationInfluence: "OFF",
    productionRuntimeActivated: false
  });
  const successor = verifyGovernedMultiSessionLearningAdvisorySuccessor();
  assert.equal(successor.successor.batchId, governance.batchId);
  const security = verifyRouteIqGovernedLearningAdvisorySecurity();
  assert.equal(security.status, "PASS");
  assert.equal(security.founderOnly, true);
  assert.equal(security.publicWorkerExposure, false);
  assert.deepEqual(governance.protectedState, {
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    confidencePropagation: "OFF",
    providers: "OFF",
    scheduler: "OFF",
    productionStorageAccess: 0,
    cloudflareContacts: 0,
    deployments: 0,
    crmBehaviorChanged: false,
    companionBehaviorChanged: false,
    anthonyMappingChanged: false,
    representativeShadowOutputExposed: false,
    stripeOrLiveBillingChanged: false
  });
  assert.equal(governance.delivery.deploymentAuthorized, false);
  assert.equal(governance.release.productionMutationAuthorized, false);

  return Object.freeze({
    status: "PASS",
    batchId: governance.batchId,
    ownerCommitCount: governance.ownerCommits.length,
    artifactId: artifact.artifactId,
    artifactSha256: artifact.artifactSha256,
    manifestSha256: artifact.manifestSha256,
    sessions: artifact.sessions,
    visits: artifact.visits,
    truthState: governance.canonicalArtifact.truthState,
    founderOnly: security.founderOnly,
    publicWorkerExposure: security.publicWorkerExposure,
    historicalEvidence: "UNCHANGED",
    deploymentPerformed: false,
    collection: governance.protectedState.prospectiveCollection,
    activeCohorts: governance.protectedState.activeCohorts,
    recommendationInfluence: governance.protectedState.recommendationInfluence
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${JSON.stringify(
    verifyOverwatchRouteIqGovernedLearningAdvisoryBridge(),
    null,
    2
  )}\n`);
}
