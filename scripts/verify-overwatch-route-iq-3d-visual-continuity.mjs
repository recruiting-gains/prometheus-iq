#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPublicForwardRollbackArtifact } from "./lib/route-iq-public-forward-rollback.mjs";
import { verifyRouteIqPublicDeploymentAssets } from "./verify-route-iq-public-deployment-assets.mjs";

export const ROUTE_IQ_3D_GOVERNANCE_PATH = "overwatch/governance/route-iq-3d-visual-continuity-v1.json";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const STARTING_COMMIT = "08b452c4cc187fd3b8bd957e6bedef3aed12ac01";
const STARTING_TREE = "0c9e3dd9a0112c52412d6ed2977d7593773179de";
const EXPECTED_OWNER_ORDER = Object.freeze([
  "f7900d8093b49d37b1c22f0535d8860440cc4985",
  "7a66490704ca5a7f4d3a6b720ae9c498e2f1676b",
  "1bfa8c0da4a1853bc097ddeab3cbf9513f4e1da5",
  "06a3a3dbb063bbc99b73ee70dc80b54c767e1df2",
  "e99fcac45ea7bb6cc9f43a0559017749da275259",
  "dcc4f8357fdb046206b3eff8aef660c9dc4f99ac",
  "8fcb8b8d2c828c414f43c9eed9b52135fb7d92a0"
]);
const EXPECTED_OWNER_EMAILS = Object.freeze({
  "f7900d8093b49d37b1c22f0535d8860440cc4985": "website@prometheus.local",
  "7a66490704ca5a7f4d3a6b720ae9c498e2f1676b": "website@prometheus.local",
  "1bfa8c0da4a1853bc097ddeab3cbf9513f4e1da5": "infrastructure@prometheus.local",
  "06a3a3dbb063bbc99b73ee70dc80b54c767e1df2": "crm@prometheus.local",
  "e99fcac45ea7bb6cc9f43a0559017749da275259": "website@prometheus.local",
  "dcc4f8357fdb046206b3eff8aef660c9dc4f99ac": "infrastructure@prometheus.local",
  "8fcb8b8d2c828c414f43c9eed9b52135fb7d92a0": "social-media@prometheus.local"
});
const EXPECTED_EVIDENCE_SUCCESSOR_ORDER = Object.freeze([
  "85850c74564798889ba50cb15c7a7b0406a521fd",
  "b065d069bdb3439a0541074d80862494e1d8a9bc",
  "cee8d681fd2272aca3425f10b433507819085424"
]);
const EXPECTED_EVIDENCE_OWNER_EMAILS = Object.freeze({
  "85850c74564798889ba50cb15c7a7b0406a521fd": "data@prometheus.local",
  "b065d069bdb3439a0541074d80862494e1d8a9bc": "intelligence@prometheus.local",
  "cee8d681fd2272aca3425f10b433507819085424": "data@prometheus.local"
});
const ALLOWED_EVIDENCE_SUCCESSOR_PATHS = new Set([
  "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/route-intelligence-golden-route-quality-report.json",
  "data/route-iq-commercial-readiness-v1/route-iq-public-claims-evidence-matrix-v1.json",
  "intelligence/contracts/route-iq-public-intelligence-claims-v1.json",
  "intelligence/contracts/shadow-decision-readiness-contracts.json",
  "intelligence/provenance/protected-baseline-synchronization-batch-20260719-006-data-route-quality-successor-v1.json"
]);
const CRM_HASHES = Object.freeze({
  "crm/route-iq-request-crm.mjs": "05405c79698db0eeb378be37195128adb04c78da0e9720a345b757490d015825",
  "crm/route-iq-request-crm-contract-v1.json": "fb7ee1af5559f145c5e6eddf73b33e8367d584f748d60e8fe1a5a6651b2b0476",
  "src/route-iq-request-form.js": "5669cc64cac548d424f8096e1c0d0894635883a8d454cbb1a1b2b80a3fabcd3b",
  "workers/infrastructure/route-iq-request-crm-runtime.js": "54fe48b4aca2e4013107abfde914b404af77bd27380ab1e23fef5dafebb25998",
  "workers/infrastructure/route-iq-request-crm-durable-object.js": "70d3e7a46d207f12a3689191784cc2984ae42897190ee1b0ded54f1baa6f2ec6",
  "workers/infrastructure/route-iq-request-crm-runtime-v1.json": "e78245b94531d97b700ac4c25c7fc4730dd5e78e29da24b1eaeda2c4b78db32e",
  "workers/prometheus-iq-worker.js": "4950424f65b20e68d332b89bd660983107cec1dd81d55ae2d8c4e77cab0ce68a",
  "wrangler.prometheusrouteiq-website.jsonc": "a93267b924c9cca22c891df5d037483e2ecf453de19d115730756444d354f23f"
});

const read = (root, path) => readFileSync(resolve(root, path), "utf8");
const readJson = (root, path) => JSON.parse(read(root, path));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const sha256File = (root, path) => sha256(readFileSync(resolve(root, path)));

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

function commitRecord(root, commit) {
  const [tree, author, committer, subject] = git(root, "show", "-s", "--format=%T%n%ae%n%ce%n%s", commit).split("\n");
  const paths = git(root, "diff-tree", "--no-commit-id", "--name-only", "-r", commit)
    .split("\n")
    .filter(Boolean)
    .sort();
  return { tree, author, committer, subject, paths };
}

function sameStrings(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

export function validateRouteIq3dVisualContinuityGovernance(governance) {
  assert.equal(governance?.governanceId, "route-iq-3d-visual-continuity-governance-v1");
  assert.equal(governance?.batchId, "BATCH-20260719-006");
  assert.equal(governance?.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(governance?.startingRepositoryState?.commit, STARTING_COMMIT);
  assert.equal(governance?.startingRepositoryState?.tree, STARTING_TREE);
  assert.equal(governance?.supersession?.supersededCandidate?.commit, STARTING_COMMIT);
  assert.equal(governance?.supersession?.supersededCandidate?.deploymentAllowed, false);
  assert.equal(governance?.supersession?.stalePinRepairInIsolationAllowed, false);
  assert.equal(governance?.visualBaseline?.commit, "cb413fdf3a9676c238c02532261ffcf3a24f2b21");
  assert.equal(governance?.visualBaseline?.tree, "ccd8356a5f820df14c574ff2be5196459422acbe");
  assert.equal(governance?.dispatchAudit?.implementationOwnershipRespected, true);
  assert.equal(governance?.dispatchAudit?.overwatchModifiedSubsystemImplementation, false);
  assert.deepEqual(governance?.dispatchAudit?.runtimeEvidenceSuccessors, [
    {
      commit: "85850c74564798889ba50cb15c7a7b0406a521fd",
      tree: "474eba67ed984b24466514b2760ed86b885ddc1e",
      owner: "Prometheus Data",
      subject: "data: synchronize restored 3D runtime surface",
      files: [
        "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/route-intelligence-golden-route-quality-report.json",
        "scripts/lib/route-intelligence-quality-gate.mjs",
        "tests/route-intelligence-quality-gate.test.mjs"
      ]
    },
    {
      commit: "b065d069bdb3439a0541074d80862494e1d8a9bc",
      tree: "5831b5c559c9fe403bb1b20623578245f4f1bcdf",
      owner: "Prometheus Intelligence Engine",
      subject: "intelligence: synchronize restored 3D route-quality consumers",
      files: [
        "intelligence/contracts/route-iq-public-intelligence-claims-v1.json",
        "intelligence/contracts/shadow-decision-readiness-contracts.json",
        "intelligence/provenance/protected-baseline-synchronization-batch-20260719-006-data-route-quality-successor-v1.json",
        "scripts/verify-shadow-decision-readiness.mjs",
        "tests/route-iq-commercial-readiness-intelligence-data-route-quality-successor.test.mjs",
        "tests/shadow-decision-readiness.test.mjs"
      ]
    },
    {
      commit: "cee8d681fd2272aca3425f10b433507819085424",
      tree: "f2a9a2ebdd710b792e77792ad1d613f0dcd1db27",
      owner: "Prometheus Data",
      subject: "data: synchronize restored 3D intelligence claims",
      files: [
        "data/route-iq-commercial-readiness-v1/route-iq-public-claims-evidence-matrix-v1.json",
        "tests/route-iq-public-claims-data.test.mjs"
      ]
    }
  ]);
  assert.equal(governance?.publicPositioning?.solePromotedProduct, "Route IQ");
  assert.equal(governance?.publicPositioning?.primaryAction, "REQUEST ROUTE IQ");
  assert.equal(governance?.publicPositioning?.recommendationSuperiorityClaimAllowed, false);
  assert.equal(governance?.visualRuntime?.supportedDevicesUse3dHero, true);
  assert.equal(governance?.visualRuntime?.fallbackImageMayReplaceSupported3d, false);
  assert.equal(governance?.generatedAssets?.deploymentAssetsSha256, "5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15");
  assert.equal(governance?.rollback?.contractSha256, "150d24acaeee5f1f6589bb92582fc701e7480cca22d5bd136ce0f27af4fc220b");
  assert.equal(governance?.rollback?.artifactSha256, "381b471ed3fa0a1fdab0b612600be2f2b6e77b45d3b9c02418a056e0eb500b5a");
  assert.equal(governance?.rollback?.nativeCloudflareRollbackAllowed, false);
  assert.equal(governance?.crmBoundary?.productionRequestSubmitted, false);
  assert.equal(governance?.safetyState?.prospectiveCollection, "OFF");
  assert.equal(governance?.safetyState?.activeCohorts, 0);
  assert.equal(governance?.safetyState?.recommendationInfluence, "OFF");
  assert.deepEqual(governance?.protectedPredecessorSuccessors, [
    {
      predecessorGovernanceId: "cloudflare-unattended-deployment-access-governance-v1",
      path: "package.json",
      historicalSha256: "a150ca1b1121c779415365551efdbff970e458915ba6491716ccbfdd0a111d0d",
      previousSuccessorSha256: "4495e53724179fc0520beae1dc4b865fda003e1f2ec7472bc9d5aa4f88b50a2e",
      successorSha256: "f34246136a294d5a7180d76a452ff8c9c69bb7d1d35419c1115426b8ea4e0247",
      owner: "Prometheus Overwatch",
      reason: "Register BATCH-20260719-006 verification and release-gate wiring while unattended deployment remains paused."
    }
  ]);
  assert.deepEqual(governance?.protectedReleaseWiringTransitions, [
    {
      path: "package.json",
      previousSha256: "4495e53724179fc0520beae1dc4b865fda003e1f2ec7472bc9d5aa4f88b50a2e",
      successorSha256: "f34246136a294d5a7180d76a452ff8c9c69bb7d1d35419c1115426b8ea4e0247",
      owner: "Prometheus Overwatch",
      reason: "Register BATCH-20260719-006 verification and release-gate wiring while unattended deployment remains paused."
    }
  ]);
  assert.deepEqual(governance?.protectedInvestorFocusBaselineSuccessors, [
    {
      predecessorGovernanceId: "route-iq-yc-investor-website-focus-v1",
      path: "intelligence/contracts/shadow-decision-readiness-contracts.json",
      previousSuccessorSha256: "3439a38b32e099d6fcd1ab17e8e4102350a037febd3f54801e9f163808bbe1dc",
      successorSha256: "f52ca21731476174cc29034e4df9d039da85f5b4cdc8011e1e9917656d5815de",
      owner: "Prometheus Intelligence Engine",
      ownerCommit: "b065d069bdb3439a0541074d80862494e1d8a9bc",
      historicalEvidenceRewritten: false
    },
    {
      predecessorGovernanceId: "route-iq-yc-investor-website-focus-v1",
      path: "scripts/verify-shadow-decision-readiness.mjs",
      previousSuccessorSha256: "910580db86a8f8a792514c3ccaeee999a392e9f07b6cbb4329ad5d08be6f3e5d",
      successorSha256: "0c8a1e483c7444c76d5435397c360ce3f5028a520d85ca1e58fe24d26d93d934",
      owner: "Prometheus Intelligence Engine",
      ownerCommit: "b065d069bdb3439a0541074d80862494e1d8a9bc",
      historicalEvidenceRewritten: false
    },
    {
      predecessorGovernanceId: "route-iq-yc-investor-website-focus-v1",
      path: "tests/shadow-decision-readiness.test.mjs",
      previousSuccessorSha256: "19db831b28c5ca991087ad1d0d677edf572801eb353e0b96d7ae4a34a88716c6",
      successorSha256: "47c3cc8a9f6a9447395c31851bd7207a25a7ed314f07c063c6daee4a71d73a79",
      owner: "Prometheus Intelligence Engine",
      ownerCommit: "b065d069bdb3439a0541074d80862494e1d8a9bc",
      historicalEvidenceRewritten: false
    }
  ]);
  const expectedVerifierSuccessors = new Map([
    ["scripts/verify-overwatch-cloudflare-unattended-access.mjs", ["c15bc5951c56e2cd8a0763b3bac4ae2ab1941f54e716ebe6b90ef613ec8d0050", "c6672fba3c5d8fc5b8d8b52bcbd24f1fdf9bcbe7e9d4155b22628aeb2a02ec71"]],
    ["scripts/verify-overwatch-cloudflare-founder-attended-service-token.mjs", ["147000b8f5cf5962f6e65a1378f6051bff8ca62212d4a0187d3eb013a14494ed", "bb08cee4db710c1ef2cfa5092cfb010a3e1395a743486d8dc380b29ff37b036d"]],
    ["scripts/verify-overwatch-cloudflare-founder-attended-tty-compatibility.mjs", ["05ec07c66ea10ee5fa7200829e6e981e73c1a43e56276239e8f0e15784c76e12", "35f0cf48a76785844b96907f31414b5f67169aed1fa9f2dad9706ff253ecfedc"]],
    ["scripts/verify-overwatch-cloudflare-founder-attended-get-only-recovery.mjs", ["e6312d6d89d4d51e8adcd5a87cfcabad46d2d7396842ea76b19521c55201c0de", "6cc5f5f7c0efdce15757416ef0c0c6c504d6283fd2abab05f3189072395b9434"]],
    ["scripts/verify-overwatch-cloudflare-founder-attended-response-contract-repair.mjs", ["1f5544c3c485065376e99d01dbb45bb8580d68817f37867d43c638ffa1d5ebf0", "44d307c19b27ce1b742253fc0b316330f6b21dff14d569e88d6fd91df02a3278"]],
    ["scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs", ["fbbee236889f9f5e1fa91971a9d973ba7acbec3c5e4e592246f31a9ad30c861e", "6b373cde5c3f4d5156cc8aeb798a623e0f5fb0cb16e7079af1bc5e04da5693c6"]]
  ]);
  assert.equal(governance?.protectedOverwatchVerifierSuccessors?.length, expectedVerifierSuccessors.size);
  for (const successor of governance.protectedOverwatchVerifierSuccessors) {
    const hashes = expectedVerifierSuccessors.get(successor.path);
    assert.ok(hashes, `Unexpected Overwatch verifier successor: ${successor.path}`);
    assert.equal(successor.predecessorGovernanceId, "route-iq-commercial-readiness-governance-v1");
    assert.equal(successor.historicalSha256, hashes[0]);
    assert.equal(successor.successorSha256, hashes[1]);
    assert.equal(successor.owner, "Prometheus Overwatch");
  }
  assert.equal(governance?.releaseBoundary?.deploymentAuthorized, false);
  assert.equal(governance?.releaseBoundary?.cloudflareMutationAuthorized, false);
  assert.equal(governance?.releaseBoundary?.secretAccessAuthorized, false);
  return governance;
}

function verifyOwnership(root, governance) {
  assert.equal(git(root, "rev-parse", `${STARTING_COMMIT}^{tree}`), STARTING_TREE);
  execFileSync("git", ["merge-base", "--is-ancestor", STARTING_COMMIT, "HEAD"], { cwd: root });
  const commits = git(root, "rev-list", "--reverse", `${STARTING_COMMIT}..HEAD`).split("\n").filter(Boolean);
  assert.deepEqual(commits.slice(0, EXPECTED_OWNER_ORDER.length), EXPECTED_OWNER_ORDER);
  assert.equal(git(root, "rev-list", "--min-parents=2", `${STARTING_COMMIT}..HEAD`), "");

  const dispatches = [
    ...governance.dispatchAudit.website.commits,
    governance.dispatchAudit.infrastructure.commit,
    governance.dispatchAudit.infrastructure.compatibilityRepair,
    governance.dispatchAudit.crm.commit,
    governance.dispatchAudit.socialMedia.commit
  ];
  const byCommit = new Map(dispatches.map(record => [record.commit, record]));
  for (const commit of EXPECTED_OWNER_ORDER) {
    const record = commitRecord(root, commit);
    const governed = byCommit.get(commit);
    assert.ok(governed, `Owner dispatch missing: ${commit}`);
    assert.equal(record.tree, governed.tree, `Owner tree drifted: ${commit}`);
    assert.equal(record.subject, governed.subject, `Owner subject drifted: ${commit}`);
    assert.equal(record.author, EXPECTED_OWNER_EMAILS[commit], `Owner author drifted: ${commit}`);
    assert.equal(record.committer, EXPECTED_OWNER_EMAILS[commit], `Owner committer drifted: ${commit}`);
    assert.equal(sameStrings(record.paths, governed.files), true, `Owner file scope drifted: ${commit}`);
  }
  const evidenceByCommit = new Map(
    governance.dispatchAudit.runtimeEvidenceSuccessors.map(record => [record.commit, record])
  );
  assert.deepEqual(
    commits.filter(commit => EXPECTED_EVIDENCE_SUCCESSOR_ORDER.includes(commit)),
    EXPECTED_EVIDENCE_SUCCESSOR_ORDER
  );
  for (const commit of EXPECTED_EVIDENCE_SUCCESSOR_ORDER) {
    const record = commitRecord(root, commit);
    const governed = evidenceByCommit.get(commit);
    assert.ok(governed, `Evidence successor dispatch missing: ${commit}`);
    assert.equal(record.tree, governed.tree, `Evidence successor tree drifted: ${commit}`);
    assert.equal(record.subject, governed.subject, `Evidence successor subject drifted: ${commit}`);
    assert.equal(record.author, EXPECTED_EVIDENCE_OWNER_EMAILS[commit], `Evidence successor author drifted: ${commit}`);
    assert.equal(record.committer, EXPECTED_EVIDENCE_OWNER_EMAILS[commit], `Evidence successor committer drifted: ${commit}`);
    assert.equal(sameStrings(record.paths, governed.files), true, `Evidence successor file scope drifted: ${commit}`);
  }
  return commits;
}

function verifyWebsiteAndClaims(root) {
  const source = read(root, "src/main.jsx");
  const scene = read(root, "src/IntelligenceScene.jsx");
  const styles = read(root, "src/styles.css");
  const landing = read(root, "landing.html");
  const publicText = [
    source,
    landing,
    read(root, "public-site-static/privacy/index.html"),
    read(root, "public-site-static/terms/index.html"),
    read(root, "public-site-static/data-deletion/index.html")
  ].join("\n");

  for (const value of [
    "React.lazy(() => import(\"./IntelligenceScene.jsx\"))",
    "useScroll()",
    "useReducedMotion()",
    "prefers-reduced-motion: reduce",
    "connection?.saveData",
    "data-visual-fallback=\"field-operations\"",
    ">REQUEST ROUTE IQ<",
    "Turn field evidence into decision-ready intelligence",
    "does not prove causal uplift or recommendation superiority"
  ]) assert.ok(`${source}\n${styles}`.includes(value), `Website invariant missing: ${value}`);

  for (const value of [
    "@react-three/fiber",
    "@react-three/drei",
    "FlameCore3D",
    "<Stars ",
    "<Line points={routeA}",
    "<torusGeometry",
    "<ringGeometry",
    "FIELD INTELLIGENCE CORE",
    "pointer.x * 0.12"
  ]) assert.ok(scene.includes(value), `3D scene invariant missing: ${value}`);

  for (const pattern of [
    /Smoothie Depot/iu,
    /\bGaia\b/u,
    /\bAthena\b/u,
    /Fitness Connection/iu,
    /franchise(?:e|ing)? expansion/iu,
    /proven recommendation superiority/iu,
    /guaranteed outcome/iu
  ]) assert.doesNotMatch(publicText, pattern);

  assert.doesNotMatch(landing, /<link[^>]+rel="preload"[^>]+route-iq-field-operations\.jpg/iu);
  assert.match(landing, /Route IQ \| Field Evidence to Decision Intelligence/u);
  assert.match(landing, /route-iq-field-operations-social\.jpg/u);
  for (const removed of [
    "deploy/prometheusrouteiq-website/enterprise-lead-intake.js",
    "deploy/prometheusrouteiq-website/route-iq-request-form.js",
    "deploy/prometheusrouteiq-website/website-attribution.js",
    "tests/website-enterprise-lead-intake.test.mjs"
  ]) assert.equal(existsSync(resolve(root, removed)), false, `Retired Website artifact remains: ${removed}`);
}

function verifyCrmAndIsolation(root) {
  for (const [path, expected] of Object.entries(CRM_HASHES)) {
    assert.equal(sha256File(root, path), expected, `CRM/public Worker boundary drifted: ${path}`);
  }
  const workflow = read(root, ".github/workflows/deploy-prometheus-public-worker.yml");
  const wrangler = read(root, "wrangler.prometheusrouteiq-website.jsonc");
  assert.match(workflow, /^name: Deploy Prometheus Public Worker$/mu);
  assert.match(workflow, /workflow_dispatch:/u);
  assert.doesNotMatch(workflow, /^\s{2}(?:push|schedule|repository_dispatch|workflow_call):/mu);
  assert.doesNotMatch(workflow, /--name/u);
  assert.match(wrangler, /"name"\s*:\s*"prometheusrouteiq-website"/u);

  const changed = git(root, "diff", "--name-only", `${STARTING_COMMIT}..HEAD`).split("\n").filter(Boolean);
  for (const prefix of ["data/", "intelligence/"]) {
    const unexpected = changed.filter(path => (
      (path === prefix || path.startsWith(prefix)) && !ALLOWED_EVIDENCE_SUCCESSOR_PATHS.has(path)
    ));
    assert.deepEqual(unexpected, [], `Protected runtime scope changed outside governed evidence successors: ${prefix}`);
  }
  for (const prefix of ["dashboard/", "index.html", "workers/prometheus-iq-worker.js"]) {
    assert.equal(changed.some(path => path === prefix || path.startsWith(prefix)), false, `Protected runtime scope changed: ${prefix}`);
  }
}

export function verifyOverwatchRouteIq3dVisualContinuity({ root = ROOT, build = true, requireClean = true } = {}) {
  const governance = validateRouteIq3dVisualContinuityGovernance(readJson(root, ROUTE_IQ_3D_GOVERNANCE_PATH));
  const commits = verifyOwnership(root, governance);
  verifyWebsiteAndClaims(root);
  verifyCrmAndIsolation(root);

  assert.equal(sha256File(root, governance.rollback.contractPath), governance.rollback.contractSha256);
  const deployment = verifyRouteIqPublicDeploymentAssets({ build });
  assert.equal(deployment.deploymentAssetsSha256, governance.generatedAssets.deploymentAssetsSha256);
  assert.equal(deployment.fileCount, governance.generatedAssets.fileCount);
  assert.equal(deployment.initialCriticalBytes, governance.generatedAssets.initialCriticalBytes);
  assert.equal(deployment.sizes.fallback, governance.generatedAssets.fallbackImageBytes);
  assert.equal(deployment.sizes.lazy3d, governance.generatedAssets.lazy3dBytes);
  const rollback = verifyPublicForwardRollbackArtifact(root);
  assert.equal(rollback.artifactSha256, governance.rollback.artifactSha256);
  assert.equal(rollback.websiteAssetsSha256, governance.rollback.priorWebsiteAssetsSha256);

  for (const path of [
    "overwatch/artifact-contracts/social-media/fitness-connection-social-media-artifact-contract-v1.json",
    "overwatch/artifact-contracts/social-media/smoothie-depot-social-media-artifact-contract-v1.json"
  ]) {
    const contract = readJson(root, path);
    assert.equal(contract.canonicalWebsiteAttributionPaths.websiteReferralUtmContract, null);
    assert.equal(contract.canonicalWebsiteAttributionPaths.activeAcquisitionSourceModule, "src/route-iq-request-form.js");
    assert.equal(contract.canonicalWebsiteAttributionPaths.persistentVisitorTrackingAllowed, false);
  }

  if (requireClean) assert.equal(git(root, "status", "--porcelain"), "", "Working tree is not clean.");
  return Object.freeze({
    status: "ROUTE_IQ_3D_VISUAL_CONTINUITY_VERIFIED",
    batchId: governance.batchId,
    head: git(root, "rev-parse", "HEAD"),
    tree: git(root, "rev-parse", "HEAD^{tree}"),
    ownerCommits: commits.slice(0, EXPECTED_OWNER_ORDER.length),
    deploymentAssetsSha256: deployment.deploymentAssetsSha256,
    rollbackArtifactSha256: rollback.artifactSha256,
    initialCriticalBytes: deployment.initialCriticalBytes,
    lazy3dBytes: deployment.sizes.lazy3d,
    recommendationInfluence: governance.safetyState.recommendationInfluence,
    prospectiveCollection: governance.safetyState.prospectiveCollection,
    activeCohorts: governance.safetyState.activeCohorts,
    deploymentPerformed: false
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyOverwatchRouteIq3dVisualContinuity();
  process.stdout.write(`${result.status} ${result.deploymentAssetsSha256}\n`);
}
