import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";

const batchId = "BATCH-20260713-002";
const legacyCommit = "049cf583b04900b2cbf38bbffc5f6293252365d0";
const intelligenceRepairCommit = "1bb7d09dff254503d56027a87efe0d526228f35a";
const dashboardRepairCommit = "a665b1b26db02716240b622d0b4d451d019c2896";
const dashboardProspectiveCommit = "6c7671cb3f9387fdac29961432412dfe70088b2e";
const dashboardCollectionOffCommit = "555dc6e87b1d2f884f1e18b3a06e1c62dfbd73dd";
const dashboardProductFocusCommit = "82d1e6f23ca3a75c0073c051531477913258a98f";
const currentDashboardSourceCommit = "99457bcda1abed536cc06585492d29f5ac500f05";
const currentDashboardValidationCommit = "f612e394b3af75e63cc07232d64bbd3dd1adb817";
const historicalDashboardContractCommit = "0ac5b54351e12fec954e479c1c56506c58dea6c8";
const protectedBaselineSuccessorCommit = "536d166e4a39a9caf4071e96f92a1598c00e7119";
const routeQualitySuccessorCommit = "73b477a0fdec725beb7fe6de795ec35fd457ef32";
const routeQualityDataCommit = "26b07905926662e3323e557d77c608db0cbc23ed";
const commercialRouteQualityDataCommit = "4f3acb7fd9f1f036e2d277a8323b52eb10ddce0f";
const commercialRouteQualitySuccessorCommit = "ecc9cbcc0222c627aeef952d2a651f4ba90cc42a";
const investorWebsiteRouteQualityDataCommit = "330752fb53c9466f6bc0339d771b2f2facbc2351";
const investorWebsiteRouteQualitySuccessorCommit = "88b3bbbf2c34d879881ced98620c15a602598c45";
const restored3dRouteQualityDataCommit = "85850c74564798889ba50cb15c7a7b0406a521fd";
const restored3dRouteQualitySuccessorCommit = "b065d069bdb3439a0541074d80862494e1d8a9bc";
const restored3dClaimsDataCommit = "cee8d681fd2272aca3425f10b433507819085424";
const currentAugust1IntelligenceSuccessorCommit =
  "3587c3d70526b95ae9083520ed42025c5522f764";
const currentAugust1IntelligenceSuccessorParent =
  "0ac5b54351e12fec954e479c1c56506c58dea6c8";
const currentAugust1IntelligenceSuccessorTree =
  "5ac08aecd5c1f720c03194027aef3def4083a142";
const currentCrossIndustryIntelligenceSuccessorCommit =
  "5215ad7f261590f5901dc84a3b8e59d9bde6ce8b";
const currentCrossIndustryIntelligenceSuccessorPath =
  "intelligence/provenance/protected-baseline-synchronization-cross-industry-dashboard-retention-successor-v1.json";
const currentCrossIndustryIntelligenceClaimsPath =
  "intelligence/contracts/route-iq-public-intelligence-claims-v1.json";
const currentCrossIndustryCoherenceCommit =
  "41adcee256f2b46970709542875e90a6dd711c19";
const currentCrossIndustryCoherencePaths = new Map([
  ["scripts/verify-shadow-decision-readiness.mjs", "0a6cd4730a223304f9008c375735a84ff4ea0517db83876c9b0bbc9d5106f1c2"],
  ["tests/shadow-decision-readiness.test.mjs", "ca0b685c8fc194317641f06ff0ea5a25a4be64a97ed17e6696f7c52de5f5c732"]
]);
const currentZipFounderAccessIntelligenceCommit =
  "4b7a18556e7e424f8c643c38f154ec6ed504a354";
const currentZipFounderAccessIntelligenceParent =
  "3dc4e39b2d08fd90337aea0b670ee211629dd19f";
const currentZipFounderAccessIntelligenceTree =
  "230199ba017e3f0c39d180d4642c7fff3d463c69";
const currentZipFounderAccessIntelligencePaths = [
  "intelligence/provenance/protected-baseline-synchronization-cross-industry-zip-founder-access-v1.json",
  "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
  "scripts/verify-discovery-mode-intelligence-v2.mjs",
  "scripts/verify-nearby-context-intelligence-v2.mjs",
  "scripts/verify-read-only-field-session-learning.mjs",
  "scripts/verify-shadow-decision-readiness.mjs",
  "tests/intelligence-architecture.test.mjs",
  "tests/read-only-field-session-learning.test.mjs",
  "tests/shadow-decision-readiness.test.mjs"
].sort();
const currentHardenedSmokeGuardIntelligenceSuccessorPath =
  "overwatch/governance/route-iq-release-provenance-intelligence-successor-v1.json";
const currentHardenedSmokeGuardIntelligenceSuccessorCommit =
  "0bda1d1fff7e8bee09c72e0248970b52dd013382";
const currentHardenedSmokeGuardIntelligenceSuccessorParent =
  "94c642d85a2870af4ec6c312a4e2aa3294b4aa68";
const currentHardenedSmokeGuardIntelligenceSuccessorTree =
  "53925227263d7fa3ebd8182550f6094c3fa84a90";
const currentHardenedSmokeGuardIntelligenceSuccessorPaths = [
  "intelligence/provenance/protected-baseline-synchronization-batch-20260714-006-unattended-runtime-guard-v1.json",
  "intelligence/provenance/protected-baseline-synchronization-cross-industry-zip-founder-access-v1.json",
  "scripts/verify-shadow-decision-readiness.mjs",
  "tests/shadow-decision-readiness.test.mjs"
].sort();
const currentAugust1IntelligenceSuccessorPaths = [
  "intelligence/contracts/shadow-decision-readiness-contracts.json",
  "intelligence/provenance/protected-baseline-synchronization-route-iq-august-1-launch-closeout-v1.json",
  "scripts/verify-shadow-decision-readiness.mjs"
].sort();
const currentIntelligenceSuccessorCommits = [
  "cd0a504328b0870aa695731230e6c43dd4698e3c",
  "ed46fb0964187a207468cd89fbdc1fbbb8426748",
  "e0f14743867bf765f05225e0321f2596741b8c70",
  "21471fb1c5f32c18e4356434af71e0d63925d969"
];
const historicalCanonicalCommit = "ed46fb0964187a207468cd89fbdc1fbbb8426748";
const currentIntelligenceOwnerSuccessorCommit = "21471fb1c5f32c18e4356434af71e0d63925d969";
const mappingPath = "overwatch/artifact-contracts/provenance/route-iq-release-provenance-repair-v1.json";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";
const dashboardContractPath = "overwatch/artifact-contracts/workspaces/fitness-connection/dashboard-consumer-contract-v1.json";
const intelligenceEvidencePath = "intelligence/provenance/legacy-provenance-gap-049cf583-v1.json";
const protectedBaselineSuccessorPath =
  "intelligence/provenance/protected-baseline-synchronization-batch-20260714-002-v1.json";
const routeQualitySuccessorPath =
  "intelligence/provenance/protected-baseline-synchronization-batch-20260714-002-route-quality-successor-v1.json";
const commercialRouteQualitySuccessorPath =
  "intelligence/provenance/protected-baseline-synchronization-batch-20260718-002-data-route-quality-successor-v1.json";
const investorWebsiteRouteQualitySuccessorPath =
  "intelligence/provenance/protected-baseline-synchronization-batch-20260719-002-data-route-quality-successor-v1.json";
const restored3dRouteQualitySuccessorPath =
  "intelligence/provenance/protected-baseline-synchronization-batch-20260719-006-data-route-quality-successor-v1.json";
const publicClaimsEvidenceMatrixPath =
  "data/route-iq-commercial-readiness-v1/route-iq-public-claims-evidence-matrix-v1.json";
const batchOneReportPath = "overwatch/reports/BATCH-20260713-001-route-iq-shadow-decision-readiness.json";
const dashboardEvidencePath = "dashboard/decision-context-producer-validation-v1.md";
const expectedPreBatchCommits = [
  "2774d91456e4b1734eb1caa13deaa84de2248f8f",
  "fc8f9c6a8acf04a80e4d5f93485225dfefea9407",
  "232e192a9fa5a14641d411896d43a0495a46ae01",
  "13c0bbfb72b72e1b492369fdfe896fffbddefaa6",
  legacyCommit
];

const intelligenceContractPaths = [
  "intelligence/contracts/read-only-field-session-learning-contracts.json",
  "intelligence/contracts/off-route-learning-intelligence-contracts.json",
  "intelligence/contracts/discovery-mode-intelligence-v2-contracts.json",
  "intelligence/contracts/nearby-context-intelligence-v2-contracts.json"
];

const expectedLegacyPaths = [
  ...intelligenceContractPaths,
  dashboardContractPath
].sort();

const expectedIntelligenceRepairPaths = [
  "intelligence/README.md",
  "intelligence/contracts/discovery-mode-intelligence-v2-contracts.json",
  "intelligence/contracts/nearby-context-intelligence-v2-contracts.json",
  "intelligence/contracts/off-route-learning-intelligence-contracts.json",
  "intelligence/contracts/read-only-field-session-learning-contracts.json",
  "intelligence/contracts/shadow-decision-readiness-contracts.json",
  "intelligence/provenance/legacy-provenance-gap-049cf583-v1.json",
  "intelligence/provenance/reconstruct-legacy-protected-contracts-v1.mjs",
  "scripts/validate-intelligence-architecture.mjs",
  "tests/intelligence-architecture.test.mjs"
].sort();

const expectedProtectedBaselineSuccessorPaths = [
  "intelligence/contracts/discovery-mode-intelligence-v2-contracts.json",
  "intelligence/contracts/nearby-context-intelligence-v2-contracts.json",
  "intelligence/contracts/off-route-learning-intelligence-contracts.json",
  "intelligence/contracts/read-only-field-session-learning-contracts.json",
  "intelligence/contracts/shadow-decision-readiness-contracts.json",
  protectedBaselineSuccessorPath,
  "scripts/validate-intelligence-architecture.mjs",
  "tests/intelligence-architecture.test.mjs"
].sort();

const expectedRouteQualityDataPaths = [
  "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/route-intelligence-golden-route-quality-report.json",
  "scripts/lib/route-intelligence-quality-gate.mjs",
  "tests/route-intelligence-quality-gate.test.mjs"
].sort();

const expectedInvestorWebsiteRouteQualitySuccessorPaths = [
  "intelligence/contracts/route-iq-public-intelligence-claims-v1.json",
  "intelligence/contracts/shadow-decision-readiness-contracts.json",
  investorWebsiteRouteQualitySuccessorPath,
  "scripts/verify-shadow-decision-readiness.mjs",
  "tests/route-iq-commercial-readiness-intelligence-data-route-quality-successor.test.mjs",
  "tests/shadow-decision-readiness.test.mjs"
].sort();

const expectedRestored3dRouteQualitySuccessorPaths = [
  "intelligence/contracts/route-iq-public-intelligence-claims-v1.json",
  "intelligence/contracts/shadow-decision-readiness-contracts.json",
  restored3dRouteQualitySuccessorPath,
  "scripts/verify-shadow-decision-readiness.mjs",
  "tests/route-iq-commercial-readiness-intelligence-data-route-quality-successor.test.mjs",
  "tests/shadow-decision-readiness.test.mjs"
].sort();

const expectedRouteQualitySuccessorPaths = [
  "intelligence/contracts/shadow-decision-readiness-contracts.json",
  routeQualitySuccessorPath,
  "scripts/validate-intelligence-architecture.mjs",
  "scripts/verify-shadow-decision-readiness.mjs",
  "tests/intelligence-architecture.test.mjs",
  "tests/shadow-decision-readiness.test.mjs"
].sort();

const expectedCurrentIntelligenceSuccessorPaths = new Map([
  [
    currentIntelligenceSuccessorCommits[0],
    [
      "intelligence/config/shadow-decision-readiness-v1.json",
      "intelligence/contracts/discovery-mode-intelligence-v2-contracts.json",
      "intelligence/contracts/nearby-context-intelligence-v2-contracts.json",
      "intelligence/contracts/off-route-learning-intelligence-contracts.json",
      "intelligence/contracts/read-only-field-session-learning-contracts.json",
      "intelligence/contracts/shadow-decision-readiness-contracts.json",
      "intelligence/provenance/legacy-provenance-gap-049cf583-v1.json",
      "intelligence/shadow-decision-readiness.md",
      "scripts/verify-shadow-decision-readiness.mjs",
      "tests/shadow-decision-readiness.test.mjs"
    ].sort()
  ],
  [
    currentIntelligenceSuccessorCommits[1],
    [
      "intelligence/contracts/shadow-decision-readiness-contracts.json",
      "intelligence/provenance/legacy-provenance-gap-049cf583-v1.json",
      "scripts/verify-shadow-decision-readiness.mjs",
      "tests/shadow-decision-readiness.test.mjs"
    ].sort()
  ],
  [
    currentIntelligenceSuccessorCommits[2],
    [
      "intelligence/contracts/off-route-learning-intelligence-contracts.json",
      "intelligence/contracts/read-only-field-session-learning-contracts.json",
      "intelligence/contracts/shadow-decision-readiness-contracts.json",
      "intelligence/off-route-learning-intelligence.mjs",
      "intelligence/read-only-field-session-learning.mjs",
      "scripts/verify-shadow-decision-readiness.mjs",
      "tests/off-route-learning-intelligence.test.mjs",
      "tests/read-only-field-session-learning.test.mjs",
      "tests/shadow-decision-readiness.test.mjs"
    ].sort()
  ],
  [
    currentIntelligenceSuccessorCommits[3],
    [
      "intelligence/README.md",
      "intelligence/provenance/legacy-provenance-gap-049cf583-v1.json",
      "intelligence/provenance/reconstruct-legacy-protected-contracts-v1.mjs",
      "intelligence/provenance/specifications/administrative-disposition-admission-v1.json",
      "tests/intelligence-architecture.test.mjs"
    ].sort()
  ]
]);

const read = path => fs.readFileSync(path);
const readJson = path => JSON.parse(read(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortJson(value[key])]));
  }
  return value;
}

const semanticSha256 = value => sha256(JSON.stringify(sortJson(value)));

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function gitBytes(...args) {
  return execFileSync("git", args, { maxBuffer: 16 * 1024 * 1024 });
}

function changedPaths(commit) {
  const output = git("diff-tree", "--no-commit-id", "--name-only", "-r", commit);
  return output ? output.split("\n").sort() : [];
}

function verifyExactDashboardCommit({ commit, parent, tree, subject, paths }) {
  const fields = git(
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s", commit
  ).split("\n");
  assert.deepEqual(fields, [
    commit,
    parent,
    tree,
    "Prometheus Dashboard <dashboard@prometheus.local>",
    "Prometheus Dashboard <dashboard@prometheus.local>",
    subject
  ]);
  assert.deepEqual(changedPaths(commit), [...paths].sort());
  assert.doesNotThrow(() => git("merge-base", "--is-ancestor", commit, "HEAD"));
}

function verifyCurrentAugust1IntelligenceSuccessor() {
  const fields = git(
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    currentAugust1IntelligenceSuccessorCommit
  ).split("\n");
  assert.deepEqual(fields, [
    currentAugust1IntelligenceSuccessorCommit,
    currentAugust1IntelligenceSuccessorParent,
    currentAugust1IntelligenceSuccessorTree,
    "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    "Synchronize shadow-readiness runtime baselines"
  ]);
  assert.deepEqual(
    changedPaths(currentAugust1IntelligenceSuccessorCommit),
    currentAugust1IntelligenceSuccessorPaths
  );
  assert.doesNotThrow(() => git(
    "merge-base", "--is-ancestor", currentAugust1IntelligenceSuccessorCommit, "HEAD"
  ));
}

function isCurrentAugust1IntelligenceTransition(path, previousSha256, currentSha256) {
  if (!currentAugust1IntelligenceSuccessorPaths.includes(path)) return false;
  const previous = sha256(gitBytes(
    "show", `${currentAugust1IntelligenceSuccessorParent}:${path}`
  ));
  const accepted = sha256(gitBytes(
    "show", `${currentAugust1IntelligenceSuccessorCommit}:${path}`
  ));
  return previous === previousSha256
    && accepted === currentSha256
    && sha256(read(path)) === currentSha256;
}

function isCurrentCrossIndustryIntelligenceTransition(path, currentSha256) {
  const successor = readJson(currentCrossIndustryIntelligenceSuccessorPath);
  const transition = successor.intelligenceConsumerTransitions.find(
    record => record.path === path
  );
  if (transition) {
    return transition.currentSha256 === currentSha256
      && sha256(gitBytes(
        "show", `${currentCrossIndustryIntelligenceSuccessorCommit}:${path}`
      )) === currentSha256
      && sha256(read(path)) === currentSha256;
  }

  const coherenceSha256 = currentCrossIndustryCoherencePaths.get(path);
  return coherenceSha256 === currentSha256
    && sha256(gitBytes("show", `${currentCrossIndustryCoherenceCommit}:${path}`))
      === currentSha256
    && sha256(read(path)) === currentSha256;
}

function isCurrentZipFounderAccessIntelligenceTransition(path, currentSha256) {
  if (!currentZipFounderAccessIntelligencePaths.includes(path)) return false;
  const fields = git(
    "show",
    "-s",
    "--format=%H%n%T%n%P%n%an <%ae>%n%cn <%ce>%n%s",
    currentZipFounderAccessIntelligenceCommit
  ).split("\n");
  return JSON.stringify(fields) === JSON.stringify([
    currentZipFounderAccessIntelligenceCommit,
    currentZipFounderAccessIntelligenceTree,
    currentZipFounderAccessIntelligenceParent,
    "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    "intelligence: adopt ZIP and Founder dashboard baseline"
  ])
    && JSON.stringify(changedPaths(currentZipFounderAccessIntelligenceCommit))
      === JSON.stringify(currentZipFounderAccessIntelligencePaths)
    && sha256(gitBytes(
      "show", `${currentZipFounderAccessIntelligenceCommit}:${path}`
    )) === currentSha256
    && sha256(read(path)) === currentSha256;
}

function verifyCurrentHardenedSmokeGuardIntelligenceSuccessor() {
  const governance = readJson(currentHardenedSmokeGuardIntelligenceSuccessorPath);
  assert.equal(
    governance.governanceId,
    "route-iq-release-provenance-intelligence-successor-v1"
  );
  assert.equal(governance.version, "1.0.0");
  assert.equal(governance.status, "OVERWATCH_ACCEPTED_OWNER_SUCCESSOR");
  assert.equal(governance.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(governance.historicalEvidence.releaseProvenanceMapping.remainsHistorical, true);
  assert.equal(governance.historicalEvidence.releaseProvenanceMapping.rewritten, false);
  assert.equal(
    governance.historicalEvidence.zipFounderAccessSuccessor.commit,
    currentZipFounderAccessIntelligenceCommit
  );
  assert.equal(
    governance.historicalEvidence.zipFounderAccessSuccessor.tree,
    currentZipFounderAccessIntelligenceTree
  );
  assert.equal(governance.historicalEvidence.zipFounderAccessSuccessor.remainsHistorical, true);
  assert.equal(governance.historicalEvidence.zipFounderAccessSuccessor.rewritten, false);

  const successor = governance.intelligenceOwnerSuccessor;
  assert.deepEqual(
    git(
      "show",
      "-s",
      "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
      currentHardenedSmokeGuardIntelligenceSuccessorCommit
    ).split("\n"),
    [
      currentHardenedSmokeGuardIntelligenceSuccessorCommit,
      currentHardenedSmokeGuardIntelligenceSuccessorParent,
      currentHardenedSmokeGuardIntelligenceSuccessorTree,
      "Prometheus Intelligence Engine <intelligence@prometheus.local>",
      "Prometheus Intelligence Engine <intelligence@prometheus.local>",
      "intelligence: synchronize hardened smoke guard provenance"
    ]
  );
  assert.equal(successor.commit, currentHardenedSmokeGuardIntelligenceSuccessorCommit);
  assert.equal(successor.parent, currentHardenedSmokeGuardIntelligenceSuccessorParent);
  assert.equal(successor.tree, currentHardenedSmokeGuardIntelligenceSuccessorTree);
  assert.equal(successor.author, "Prometheus Intelligence Engine <intelligence@prometheus.local>");
  assert.equal(successor.committer, "Prometheus Intelligence Engine <intelligence@prometheus.local>");
  assert.equal(successor.subject, "intelligence: synchronize hardened smoke guard provenance");
  assert.deepEqual(successor.changedPaths.slice().sort(), currentHardenedSmokeGuardIntelligenceSuccessorPaths);
  assert.deepEqual(
    changedPaths(currentHardenedSmokeGuardIntelligenceSuccessorCommit),
    currentHardenedSmokeGuardIntelligenceSuccessorPaths
  );
  assert.doesNotThrow(() => git(
    "merge-base",
    "--is-ancestor",
    currentZipFounderAccessIntelligenceCommit,
    currentHardenedSmokeGuardIntelligenceSuccessorCommit
  ));
  assert.doesNotThrow(() => git(
    "merge-base",
    "--is-ancestor",
    currentHardenedSmokeGuardIntelligenceSuccessorCommit,
    "HEAD"
  ));

  const transitions = new Map(
    successor.transitions.map(transition => [transition.path, transition])
  );
  assert.deepEqual(
    [...transitions.keys()].sort(),
    currentHardenedSmokeGuardIntelligenceSuccessorPaths
  );
  for (const path of currentHardenedSmokeGuardIntelligenceSuccessorPaths) {
    const transition = transitions.get(path);
    assert.equal(
      transition.previousSha256,
      sha256(gitBytes(
        "show",
        `${currentHardenedSmokeGuardIntelligenceSuccessorParent}:${path}`
      )),
      `${path} hardened smoke-guard predecessor hash drifted.`
    );
    assert.equal(
      transition.currentSha256,
      sha256(gitBytes(
        "show",
        `${currentHardenedSmokeGuardIntelligenceSuccessorCommit}:${path}`
      )),
      `${path} hardened smoke-guard owner-successor hash drifted.`
    );
    assert.equal(
      transition.currentSha256,
      sha256(read(path)),
      `${path} current hardened smoke-guard successor drifted.`
    );
  }

  assert.deepEqual(governance.reviewedBoundaries, {
    intelligenceImplementationChangedByOverwatch: false,
    intelligenceProvenanceChangedByOverwatch: false,
    runtimeChangedByOverwatch: false,
    websiteChangedByOverwatch: false,
    deploymentPayloadChangedByOverwatch: false,
    historicalEvidenceRewritten: false,
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF"
  });
  return transitions;
}

function isCurrentHardenedSmokeGuardIntelligenceTransition(
  transitions,
  path,
  currentSha256
) {
  const transition = transitions.get(path);
  return transition?.currentSha256 === currentSha256
    && sha256(read(path)) === currentSha256;
}

export function verifyReleaseProvenanceRepair() {
  const mapping = readJson(mappingPath);
  const registry = readJson(registryPath);
  const dashboardContract = readJson(dashboardContractPath);
  const historicalDashboardContract = JSON.parse(
    gitBytes("show", `${historicalDashboardContractCommit}:${dashboardContractPath}`)
  );
  const intelligenceEvidence = readJson(intelligenceEvidencePath);
  const protectedBaselineSuccessor = readJson(protectedBaselineSuccessorPath);
  const routeQualitySuccessor = readJson(routeQualitySuccessorPath);
  const commercialRouteQualitySuccessor = readJson(commercialRouteQualitySuccessorPath);
  const investorWebsiteRouteQualitySuccessor = readJson(investorWebsiteRouteQualitySuccessorPath);
  const restored3dRouteQualitySuccessor = readJson(restored3dRouteQualitySuccessorPath);
  const batchOneReport = readJson(batchOneReportPath);
  const dashboardEvidence = read(dashboardEvidencePath).toString("utf8");

  assert.equal(mapping.contractId, "route-iq-release-provenance-repair-v1");
  assert.equal(mapping.version, "1.2.0");
  assert.equal(mapping.batchId, batchId);
  assert.equal(mapping.status, "active_governance_only");
  assert.equal(mapping.owningSubsystem, "Prometheus Overwatch");
  assert.equal(mapping.workspaceId, "fitness_connection");
  assert.equal(mapping.operatingProfileId, "fitness");
  verifyCurrentAugust1IntelligenceSuccessor();
  const hardenedSmokeGuardIntelligenceTransitions =
    verifyCurrentHardenedSmokeGuardIntelligenceSuccessor();

  const gap = mapping.legacyProvenanceGap;
  assert.equal(gap.commit, legacyCommit);
  assert.equal(gap.classification, "LEGACY_PROVENANCE_GAP");
  assert.equal(gap.historyPreserved, true);
  assert.equal(gap.retroactiveOwnershipClaimed, false);
  assert.equal(gap.mixedOwnershipDisclosed, true);
  assert.equal(gap.intelligenceOwnerRepairCommit, intelligenceRepairCommit);
  assert.equal(gap.historicalCanonicalCommit, historicalCanonicalCommit);
  assert.deepEqual(gap.currentIntelligenceSuccessorCommits, currentIntelligenceSuccessorCommits);
  assert.deepEqual(changedPaths(legacyCommit), expectedLegacyPaths);
  assert.deepEqual(changedPaths(intelligenceRepairCommit), expectedIntelligenceRepairPaths);
  assert.equal(git("merge-base", "--is-ancestor", legacyCommit, intelligenceRepairCommit), "");
  for (const commit of currentIntelligenceSuccessorCommits) {
    assert.deepEqual(changedPaths(commit), expectedCurrentIntelligenceSuccessorPaths.get(commit));
    assert.equal(git("merge-base", "--is-ancestor", intelligenceRepairCommit, commit), "");
  }
  assert.deepEqual(changedPaths(protectedBaselineSuccessorCommit), expectedProtectedBaselineSuccessorPaths);
  assert.equal(git("merge-base", "--is-ancestor", currentIntelligenceOwnerSuccessorCommit, protectedBaselineSuccessorCommit), "");
  assert.deepEqual(changedPaths(routeQualityDataCommit), expectedRouteQualityDataPaths);
  assert.deepEqual(changedPaths(routeQualitySuccessorCommit), expectedRouteQualitySuccessorPaths);
  assert.equal(git("merge-base", "--is-ancestor", protectedBaselineSuccessorCommit, routeQualityDataCommit), "");
  assert.equal(git("merge-base", "--is-ancestor", routeQualityDataCommit, routeQualitySuccessorCommit), "");
  assert.deepEqual(changedPaths(commercialRouteQualityDataCommit), expectedRouteQualityDataPaths);
  assert.deepEqual(changedPaths(commercialRouteQualitySuccessorCommit), [
    "intelligence/contracts/shadow-decision-readiness-contracts.json",
    commercialRouteQualitySuccessorPath,
    "scripts/verify-shadow-decision-readiness.mjs",
    "tests/route-iq-commercial-readiness-intelligence-data-route-quality-successor.test.mjs",
    "tests/shadow-decision-readiness.test.mjs"
  ].sort());
  assert.equal(git("merge-base", "--is-ancestor", routeQualitySuccessorCommit, commercialRouteQualityDataCommit), "");
  assert.equal(git("merge-base", "--is-ancestor", commercialRouteQualityDataCommit, commercialRouteQualitySuccessorCommit), "");

  assert.equal(intelligenceEvidence.status, "LEGACY_PROVENANCE_GAP");
  assert.equal(intelligenceEvidence.legacyCommit, legacyCommit);
  assert.match(intelligenceEvidence.ownershipStatement, /does not claim retroactive Intelligence ownership/);
  assert.deepEqual(
    intelligenceEvidence.contracts.map(contract => contract.path).sort(),
    intelligenceContractPaths.slice().sort()
  );

  for (const record of gap.intelligenceOwnedFiles) {
    assert.ok(intelligenceContractPaths.includes(record.path), `Unexpected Intelligence path: ${record.path}`);
    const ownerEvidence = intelligenceEvidence.contracts.find(contract => contract.path === record.path);
    assert.ok(ownerEvidence, `Missing owner evidence for ${record.path}`);

    const legacyBytes = gitBytes("show", `${legacyCommit}:${record.path}`);
    const historicalCanonicalBytes = gitBytes("show", `${historicalCanonicalCommit}:${record.path}`);
    const historicalCanonicalJson = JSON.parse(historicalCanonicalBytes);
    assert.equal(sha256(legacyBytes), record.legacyRawSha256, `${record.path} legacy hash drifted.`);
    assert.equal(sha256(historicalCanonicalBytes), record.canonicalAfterRepairRawSha256, `${record.path} historical repair hash drifted.`);
    assert.equal(ownerEvidence.legacyCommitRawSha256, record.legacyRawSha256);
    assert.equal(semanticSha256(historicalCanonicalJson), record.canonicalAfterRepairSemanticSha256);
    const ownerSuccessorBytes = gitBytes("show", `${currentIntelligenceOwnerSuccessorCommit}:${record.path}`);
    const ownerSuccessorJson = JSON.parse(ownerSuccessorBytes);
    assert.equal(sha256(ownerSuccessorBytes), record.currentCanonicalRawSha256);
    assert.equal(semanticSha256(ownerSuccessorJson), record.currentCanonicalSemanticSha256);
    assert.equal(ownerEvidence.reconstructedRawSha256, record.currentCanonicalRawSha256);
    assert.equal(ownerEvidence.canonicalAfterRepairRawSha256, record.currentCanonicalRawSha256);
    assert.equal(ownerEvidence.reconstructedSemanticSha256, record.currentCanonicalSemanticSha256);
    assert.equal(ownerEvidence.canonicalAfterRepairSemanticSha256, ownerEvidence.reconstructedSemanticSha256);
    assert.equal(ownerEvidence.byteIdenticalAfterRepair, true);
    assert.equal(ownerEvidence.semanticIdenticalAfterRepair, true);
  }

  const shadowEvidence = intelligenceEvidence.additionalProtectedConsumerScan.find(
    record => record.path === "intelligence/contracts/shadow-decision-readiness-contracts.json"
  );
  assert.ok(shadowEvidence, "Shadow-readiness protected consumer must be independently reconstructed.");
  const historicalShadowBytes = gitBytes("show", `${historicalCanonicalCommit}:${shadowEvidence.path}`);
  assert.equal(sha256(historicalShadowBytes), shadowEvidence.reconstructionBaseRawSha256);
  const ownerSuccessorShadowBytes = gitBytes("show", `${currentIntelligenceOwnerSuccessorCommit}:${shadowEvidence.path}`);
  assert.equal(sha256(ownerSuccessorShadowBytes), shadowEvidence.reconstructedRawSha256);
  assert.equal(semanticSha256(JSON.parse(ownerSuccessorShadowBytes)), shadowEvidence.reconstructedSemanticSha256);
  assert.equal(shadowEvidence.byteIdenticalAfterRepair, true);
  assert.equal(shadowEvidence.semanticIdenticalAfterRepair, true);

  assert.equal(dashboardContract.contractVersion, "2.0.0");
  assert.equal(dashboardContract.owningSubsystem, "Prometheus Overwatch");
  assert.equal(dashboardContract.admissionRules.crossWorkspaceFallbackAllowed, false);
  assert.equal(dashboardContract.admissionRules.demoCatalogAllowed, false);
  assert.equal(dashboardContract.safety.collection, "OFF");
  assert.equal(dashboardContract.safety.activeCohorts, 0);
  assert.equal(dashboardContract.safety.recommendationInfluence, "OFF");
  const dashboardAlignment =
    historicalDashboardContract.repViewContract.placesAccess.alignmentEvidence;
  verifyExactDashboardCommit({
    commit: currentDashboardSourceCommit,
    parent: "54804800533e705efe7add510e5e4bb72a3ba7dc",
    tree: "ca9c01b40d763ceb707ba88118c905a8056e7407",
    subject: "Add bounded Route IQ customer PWA",
    paths: [
      "_headers",
      "deploy/cloudflare-pages/_headers",
      "deploy/cloudflare-pages/index.html",
      "deploy/cloudflare-pages/manifest-founder.webmanifest",
      "deploy/cloudflare-pages/manifest.webmanifest",
      "deploy/cloudflare-pages/sw.js",
      "index.html",
      "manifest-founder.webmanifest",
      "manifest.webmanifest",
      "scripts/verify-dashboard-runtime-workflows.mjs",
      "sw.js",
      "tests/dashboard-route-iq-customer-pwa.test.mjs",
      "tests/dashboard-route-iq-field-session-producer.test.mjs",
      "tests/dashboard-route-iq-product-focus.test.mjs"
    ]
  });
  verifyExactDashboardCommit({
    commit: currentDashboardValidationCommit,
    parent: "d913a3c8c50379272503c93a8df12e75e048842d",
    tree: "d0d5fb3ce8c7b9416c3695645b0ad0fb0715d650",
    subject: "Harden governed profile mismatch harness",
    paths: [
      "scripts/verify-dashboard-runtime-workflows.mjs",
      "tests/dashboard-route-iq-customer-pwa.test.mjs"
    ]
  });
  assert.equal(gap.overwatchOwnedFile.path, dashboardContractPath);
  assert.equal(gap.overwatchOwnedFile.canonicalOwner, "Prometheus Overwatch");
  assert.equal(gap.overwatchOwnedFile.dashboardOwnerRevalidationCommit, dashboardProspectiveCommit);
  assert.equal(gap.overwatchOwnedFile.prospectiveShadowSeamCommit, dashboardProspectiveCommit);
  assert.equal(dashboardAlignment.dashboardCommit, currentDashboardValidationCommit);
  assert.equal(dashboardAlignment.dashboardOwnerRevalidationCommit, currentDashboardValidationCommit);
  assert.equal(dashboardAlignment.prospectiveShadowSeamCommit, dashboardProspectiveCommit);
  assert.equal(dashboardAlignment.prospectiveCollectionOffSuppressionCommit, dashboardCollectionOffCommit);
  assert.equal(dashboardAlignment.routeIqProductFocusCommit, dashboardProductFocusCommit);
  assert.equal(dashboardAlignment.decisionContextFeatureOriginCommit, "2774d91456e4b1734eb1caa13deaa84de2248f8f");
  assert.equal(
    sha256(read("index.html")),
    sha256(read("deploy/cloudflare-pages/index.html"))
  );
  assert.equal(
    sha256(gitBytes("show", `${currentDashboardSourceCommit}:index.html`)),
    dashboardAlignment.dashboardSourceSha256
  );
  assert.match(dashboardEvidence, /Status: FOUNDER_BEHAVIOR_APPROVAL_REQUIRED/);
  assert.match(dashboardEvidence, /post-action evidence/);
  assert.match(dashboardEvidence, /does not provide the full candidate context/);
  assert.match(dashboardEvidence, /adds no name, email, phone, manager, GPS, note/);
  assert.match(dashboardEvidence, /No shadow state or Founder readiness result is rendered to representatives/);

  const fitnessWorkspace = registry.workspaces.find(workspace => workspace.workspaceId === "fitness_connection");
  const registration = fitnessWorkspace?.canonicalArtifacts.find(
    artifact => artifact.artifactId === "fitness_connection_release_provenance_repair_mapping"
  );
  assert.ok(registration, "Release provenance mapping must be registered.");
  assert.equal(registration.path, mappingPath);
  assert.equal(registration.ownerSubsystem, "Prometheus Overwatch");
  assert.deepEqual(registration.writeAllowed, ["Prometheus Overwatch"]);
  assert.deepEqual(registration.readAllowed, [
    "Prometheus Infrastructure",
    "Prometheus Overwatch"
  ]);
  assert.equal(registration.productionConsumer, false);

  const correction = batchOneReport.releaseScopeCorrection;
  assert.equal(correction.ownerRepairTree, "c2fdbe479b92c436b076e954dfa48c0065a673ff");
  assert.equal(correction.batchFinalHead, "18ed83effdca1219729e4e71f452eeea8c3b273b");
  assert.equal(correction.batchFinalTree, "87cb850a77333dbd0e368e2bba4aad5ac3c4a56f");
  assert.equal(correction.ownerRepairTreeEqualsBatchFinalTree, false);
  assert.equal(correction.exactFinalHeadVerificationEstablishedByBatch1, false);
  assert.equal(correction.priorPushRecommendationSuperseded, true);

  assert.equal(mapping.methodology.requiredEvaluationOutcomes, "97 eligible, linked, scoreable evaluation outcomes after exclusions");
  assert.equal(mapping.methodology.requiredSampleAloneCanReachFounderReview, false);
  assert.equal(mapping.methodology.calibrationBins, 5);
  assert.equal(mapping.methodology.minimumSupportedObservationsAcrossFivePopulatedBins, 100);
  assert.equal(mapping.methodology.sparseOrEmptyBinsMayBypassEvidenceCoverage, false);
  assert.equal(mapping.methodology.chronologicalTrainingEvaluationSeparationRequired, true);
  assert.equal(mapping.methodology.calibrationStabilitySegmentSafetyAndBaselineRequired, true);
  assert.equal(mapping.methodology.causalUpliftOrRecommendationSuperiorityClaimAllowed, false);

  assert.deepEqual(mapping.preBatchOwnerValidation.map(record => record.commit), expectedPreBatchCommits);
  assert.equal(mapping.preBatchOwnerValidation[0].owner, "Prometheus Dashboard");
  assert.equal(mapping.preBatchOwnerValidation[0].status, "OWNER_REVALIDATED_FOUNDER_BEHAVIOR_APPROVAL_REQUIRED");
  for (const record of mapping.preBatchOwnerValidation.slice(1, 4)) {
    assert.equal(record.owner, "Prometheus Data");
    assert.equal(record.status, "OWNER_REVALIDATED_CONTRACT_MISMATCH_CLOSED");
  }
  assert.equal(mapping.preBatchOwnerValidation[4].owner, "MIXED_LEGACY_PROVENANCE_GAP");
  assert.equal(mapping.preBatchOwnerValidation[4].status, "LEGACY_GAP_DISCLOSED_AND_OWNER_RECONSTRUCTED");
  assert.equal(mapping.ownerRepairChain.dashboardCommit, dashboardRepairCommit);
  assert.equal(mapping.ownerRepairChain.currentDashboardSuccessorCommit, dashboardProspectiveCommit);
  assert.deepEqual(mapping.ownerRepairChain.currentIntelligenceSuccessorCommits, currentIntelligenceSuccessorCommits);

  const currentIntelligenceSuccessor = mapping.currentIntelligenceOwnerSuccessor;
  assert.equal(currentIntelligenceSuccessor.batchId, "BATCH-20260714-001");
  assert.equal(currentIntelligenceSuccessor.commit, currentIntelligenceOwnerSuccessorCommit);
  assert.equal(currentIntelligenceSuccessor.tree, git("rev-parse", `${currentIntelligenceOwnerSuccessorCommit}^{tree}`));
  assert.equal(currentIntelligenceSuccessor.canonicalOwner, "Prometheus Intelligence Engine");
  assert.equal(currentIntelligenceSuccessor.predecessorCommit, "e0f14743867bf765f05225e0321f2596741b8c70");
  assert.equal(currentIntelligenceSuccessor.legacyProvenanceArtifactsModified, true);
  assert.equal(currentIntelligenceSuccessor.legacyProvenanceGapPreserved, true);
  assert.equal(
    currentIntelligenceSuccessor.semanticSpecificationPath,
    "intelligence/provenance/specifications/administrative-disposition-admission-v1.json",
  );
  assert.equal(
    sha256(read(currentIntelligenceSuccessor.semanticSpecificationPath)),
    currentIntelligenceSuccessor.semanticSpecificationSha256,
  );
  assert.equal(currentIntelligenceSuccessor.targetHashesStoredInSemanticSpecification, false);
  assert.equal(currentIntelligenceSuccessor.recommendationInfluence, "OFF");
  for (const consumer of currentIntelligenceSuccessor.protectedConsumers) {
    assert.equal(
      sha256(gitBytes("show", `${currentIntelligenceOwnerSuccessorCommit}:${consumer.path}`)),
      consumer.sha256,
      `${consumer.path} historical owner-successor hash drifted.`
    );
  }

  assert.equal(protectedBaselineSuccessor.version, "route-iq-intelligence-protected-baseline-synchronization-v1");
  assert.equal(protectedBaselineSuccessor.batchId, "BATCH-20260714-002");
  assert.equal(protectedBaselineSuccessor.status, "OWNER_VALIDATED_SUCCESSOR");
  assert.equal(protectedBaselineSuccessor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(protectedBaselineSuccessor.historicalCheckpoint.path, intelligenceEvidencePath);
  assert.equal(protectedBaselineSuccessor.historicalCheckpoint.sha256, sha256(read(intelligenceEvidencePath)));
  assert.equal(protectedBaselineSuccessor.historicalCheckpoint.remainsHistorical, true);
  assert.equal(protectedBaselineSuccessor.historicalCheckpoint.rewritten, false);
  assert.deepEqual(
    protectedBaselineSuccessor.integratedOwnerCommits.map(record => record.commit),
    ["0027244ba069b741f283ab6871cf882d46f2c935", dashboardCollectionOffCommit]
  );

  for (const transition of protectedBaselineSuccessor.protectedSourceTransitions) {
    assert.equal(
      sha256(gitBytes("show", `${protectedBaselineSuccessorCommit}^:${transition.path}`)),
      transition.currentSha256,
      `${transition.path} was not frozen before the Intelligence successor commit.`
    );
  }

  const synchronizedConsumerPaths = protectedBaselineSuccessor.synchronizedConsumers.map(record => record.path).sort();
  assert.deepEqual(synchronizedConsumerPaths, [
    ...intelligenceContractPaths,
    "intelligence/contracts/shadow-decision-readiness-contracts.json"
  ].sort());
  for (const consumer of protectedBaselineSuccessor.synchronizedConsumers) {
    assert.equal(
      sha256(gitBytes("show", `${protectedBaselineSuccessorCommit}^:${consumer.path}`)),
      consumer.previousSha256,
      `${consumer.path} previous protected baseline drifted.`
    );
    assert.equal(
      sha256(gitBytes("show", `${protectedBaselineSuccessorCommit}:${consumer.path}`)),
      consumer.currentSha256,
      `${consumer.path} first owner successor commit drifted.`
    );
  }
  assert.equal(protectedBaselineSuccessor.advisoryArtifacts.regenerationRequired, false);
  for (const [field, expected] of Object.entries({
    collectionDefaultState: "OFF",
    recommendationInfluence: "OFF",
    representativeShadowOutputExposed: false,
    routeOrderingChanged: false,
    candidateVisibilityChanged: false,
    routeScoringChanged: false,
    notificationBehaviorChanged: false,
    automaticActionIntroduced: false,
    validCollectionOnFixturePreservesPreActionNextStopSeal: true,
    candidateCompletenessServerOwned: true,
    identityAndTimestampsServerOwned: true,
    exactlyOnceIdempotentAppendOnlyEvidencePreserved: true,
    zeroLiveGooglePreserved: true
  })) {
    assert.equal(protectedBaselineSuccessor.boundaryValidation[field], expected, `${field} successor boundary drifted.`);
  }

  assert.equal(routeQualitySuccessor.version, "route-iq-intelligence-route-quality-protected-baseline-successor-v1");
  assert.equal(routeQualitySuccessor.batchId, "BATCH-20260714-002");
  assert.equal(routeQualitySuccessor.status, "OWNER_VALIDATED_SUCCESSOR");
  assert.equal(routeQualitySuccessor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(routeQualitySuccessor.predecessor.path, protectedBaselineSuccessorPath);
  assert.equal(routeQualitySuccessor.predecessor.commit, protectedBaselineSuccessorCommit);
  assert.equal(
    routeQualitySuccessor.predecessor.sha256,
    sha256(gitBytes("show", `${protectedBaselineSuccessorCommit}:${protectedBaselineSuccessorPath}`))
  );
  assert.equal(routeQualitySuccessor.predecessor.remainsHistorical, true);
  assert.equal(routeQualitySuccessor.predecessor.rewritten, false);

  const dataTransition = routeQualitySuccessor.dataOwnerTransition;
  assert.equal(dataTransition.commit, routeQualityDataCommit);
  assert.equal(dataTransition.tree, git("rev-parse", `${routeQualityDataCommit}^{tree}`));
  assert.equal(dataTransition.ownerSubsystem, "Prometheus Data");
  assert.deepEqual(dataTransition.dashboardFetchEvidence, {
    previousSourceFetches: 8,
    previousDeployFetches: 8,
    currentSourceFetches: 9,
    currentDeployFetches: 9
  });
  for (const transition of [dataTransition.routeQualityGate, dataTransition.canonicalRouteQualityReport]) {
    assert.equal(
      sha256(gitBytes("show", `${routeQualityDataCommit}^:${transition.path}`)),
      transition.previousSha256,
      `${transition.path} previous Data hash drifted.`
    );
    assert.equal(
      sha256(gitBytes("show", `${routeQualityDataCommit}:${transition.path}`)),
      transition.currentSha256,
      `${transition.path} Data owner commit hash drifted.`
    );
  }

  const affectedReferences = routeQualitySuccessor.protectedReferenceAudit.affectedIntelligenceReferences;
  assert.equal(affectedReferences.length, 1);
  const routeQualityReference = affectedReferences[0];
  assert.equal(routeQualityReference.consumerPath, "intelligence/contracts/shadow-decision-readiness-contracts.json");
  assert.equal(routeQualityReference.protectedSourcePath, dataTransition.routeQualityGate.path);
  assert.equal(
    sha256(gitBytes("show", `${routeQualitySuccessorCommit}^:${routeQualityReference.consumerPath}`)),
    routeQualityReference.previousConsumerSha256
  );
  assert.equal(
    sha256(gitBytes("show", `${routeQualitySuccessorCommit}:${routeQualityReference.consumerPath}`)),
    routeQualityReference.currentConsumerSha256
  );
  assert.equal(routeQualityReference.previousProtectedSha256, dataTransition.routeQualityGate.previousSha256);
  assert.equal(routeQualityReference.currentProtectedSha256, dataTransition.routeQualityGate.currentSha256);
  assert.equal(routeQualitySuccessor.protectedReferenceAudit.canonicalReportPinnedByIntelligence, false);
  assert.deepEqual(routeQualitySuccessor.protectedReferenceAudit.canonicalReportReferenceMatches, []);
  assert.equal(routeQualitySuccessor.protectedReferenceAudit.allAffectedReferencesAccountedFor, true);
  assert.equal(routeQualitySuccessor.advisoryArtifacts.regenerationRequired, false);
  for (const [field, expected] of Object.entries({
    collectionDefaultState: "OFF",
    recommendationInfluence: "OFF",
    readinessState: "INSUFFICIENT_EVIDENCE",
    representativeShadowOutputExposed: false,
    routeOrderingChanged: false,
    candidateVisibilityChanged: false,
    routeScoringChanged: false,
    routeGenerationChanged: false,
    dashboardBehaviorChanged: false,
    dataBehaviorChangedByIntelligence: false,
    infrastructureBehaviorChangedByIntelligence: false,
    zeroLiveGooglePreserved: true
  })) {
    assert.equal(routeQualitySuccessor.boundaryValidation[field], expected, `${field} route-quality successor boundary drifted.`);
  }

  assert.equal(
    commercialRouteQualitySuccessor.version,
    "route-iq-intelligence-data-route-quality-protected-baseline-successor-v1"
  );
  assert.equal(commercialRouteQualitySuccessor.batchId, "BATCH-20260718-002");
  assert.equal(commercialRouteQualitySuccessor.status, "OWNER_REVIEWED_AND_SYNCHRONIZED");
  assert.equal(commercialRouteQualitySuccessor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(commercialRouteQualitySuccessor.predecessor.path, routeQualitySuccessorPath);
  assert.equal(commercialRouteQualitySuccessor.predecessor.remainsHistorical, true);
  assert.equal(commercialRouteQualitySuccessor.predecessor.rewritten, false);

  const commercialDataTransition = commercialRouteQualitySuccessor.dataOwnerTransition;
  assert.equal(commercialDataTransition.commit, commercialRouteQualityDataCommit);
  assert.equal(commercialDataTransition.tree, git("rev-parse", `${commercialRouteQualityDataCommit}^{tree}`));
  assert.equal(commercialDataTransition.ownerSubsystem, "Prometheus Data");
  assert.deepEqual(commercialDataTransition.changedPaths.slice().sort(), expectedRouteQualityDataPaths);
  for (const [historicalTransition, currentTransition] of [
    [dataTransition.routeQualityGate, commercialDataTransition.routeQualityGate],
    [dataTransition.canonicalRouteQualityReport, commercialDataTransition.canonicalRouteQualityReport]
  ]) {
    assert.equal(currentTransition.path, historicalTransition.path);
    assert.equal(currentTransition.previousSha256, historicalTransition.currentSha256);
    assert.equal(
      sha256(gitBytes("show", `${commercialRouteQualityDataCommit}:${currentTransition.path}`)),
      currentTransition.currentSha256,
      `${currentTransition.path} commercial Data owner hash drifted.`
    );
  }

  const commercialReference = commercialRouteQualitySuccessor.protectedReferenceAudit.affectedIntelligenceReferences[0];
  assert.equal(commercialReference.consumerPath, "intelligence/contracts/shadow-decision-readiness-contracts.json");
  assert.equal(commercialReference.protectedSourcePath, commercialDataTransition.routeQualityGate.path);
  assert.equal(commercialReference.previousProtectedSha256, dataTransition.routeQualityGate.currentSha256);
  assert.equal(commercialReference.currentProtectedSha256, commercialDataTransition.routeQualityGate.currentSha256);
  assert.equal(
    sha256(gitBytes("show", `${commercialRouteQualitySuccessorCommit}:${commercialReference.consumerPath}`)),
    commercialReference.currentConsumerSha256
  );
  assert.equal(commercialRouteQualitySuccessor.protectedReferenceAudit.allAffectedReferencesAccountedFor, true);
  assert.equal(commercialRouteQualitySuccessor.reviewedInvariants.runtimeBehaviorChanged, false);
  assert.equal(commercialRouteQualitySuccessor.reviewedInvariants.routeOrderingChanged, false);
  assert.equal(commercialRouteQualitySuccessor.reviewedInvariants.routeScoringChanged, false);
  assert.equal(commercialRouteQualitySuccessor.boundaries.recommendationInfluence, "OFF");
  assert.equal(commercialRouteQualitySuccessor.boundaries.readinessState, "INSUFFICIENT_EVIDENCE");
  assert.equal(commercialRouteQualitySuccessor.boundaries.representativeShadowOutputExposed, false);

  assert.equal(
    investorWebsiteRouteQualitySuccessor.version,
    "route-iq-intelligence-data-route-quality-protected-baseline-successor-v1"
  );
  assert.equal(investorWebsiteRouteQualitySuccessor.batchId, "BATCH-20260719-002");
  assert.equal(investorWebsiteRouteQualitySuccessor.status, "OWNER_REVIEWED_AND_SYNCHRONIZED");
  assert.equal(investorWebsiteRouteQualitySuccessor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(investorWebsiteRouteQualitySuccessor.predecessor.path, commercialRouteQualitySuccessorPath);
  assert.equal(
    investorWebsiteRouteQualitySuccessor.predecessor.sha256,
    sha256(read(commercialRouteQualitySuccessorPath))
  );
  assert.equal(investorWebsiteRouteQualitySuccessor.predecessor.remainsHistorical, true);
  assert.equal(investorWebsiteRouteQualitySuccessor.predecessor.rewritten, false);

  const investorWebsiteDataTransition = investorWebsiteRouteQualitySuccessor.dataOwnerTransition;
  assert.equal(investorWebsiteDataTransition.commit, investorWebsiteRouteQualityDataCommit);
  assert.equal(
    investorWebsiteDataTransition.tree,
    git("rev-parse", `${investorWebsiteRouteQualityDataCommit}^{tree}`)
  );
  assert.equal(investorWebsiteDataTransition.ownerSubsystem, "Prometheus Data");
  assert.deepEqual(
    investorWebsiteDataTransition.changedPaths.slice().sort(),
    expectedRouteQualityDataPaths
  );
  for (const [historicalTransition, currentTransition] of [
    [commercialDataTransition.routeQualityGate, investorWebsiteDataTransition.routeQualityGate],
    [commercialDataTransition.canonicalRouteQualityReport, investorWebsiteDataTransition.canonicalRouteQualityReport]
  ]) {
    assert.equal(currentTransition.path, historicalTransition.path);
    assert.equal(currentTransition.previousSha256, historicalTransition.currentSha256);
    assert.equal(
      sha256(gitBytes("show", `${investorWebsiteRouteQualityDataCommit}:${currentTransition.path}`)),
      currentTransition.currentSha256,
      `${currentTransition.path} investor Website Data owner hash drifted.`
    );
  }
  assert.equal(
    sha256(gitBytes("show", `${investorWebsiteRouteQualityDataCommit}:${investorWebsiteDataTransition.routeQualityRegression.path}`)),
    investorWebsiteDataTransition.routeQualityRegression.currentSha256
  );

  assert.deepEqual(
    changedPaths(investorWebsiteRouteQualitySuccessorCommit),
    expectedInvestorWebsiteRouteQualitySuccessorPaths
  );
  assert.equal(
    git("rev-parse", `${investorWebsiteRouteQualitySuccessorCommit}^{tree}`),
    "de525c85f2d8b02ba6c5c3ad4148668d2702230f"
  );
  assert.equal(
    investorWebsiteRouteQualitySuccessor.protectedReferenceAudit.allAffectedIntelligenceReferencesAccountedFor,
    true
  );
  for (const reference of investorWebsiteRouteQualitySuccessor.protectedReferenceAudit.affectedIntelligenceReferences) {
    assert.equal(
      sha256(gitBytes("show", `${investorWebsiteRouteQualitySuccessorCommit}:${reference.consumerPath}`)),
      reference.currentConsumerSha256
    );
  }
  for (const mirror of investorWebsiteRouteQualitySuccessor.protectedReferenceAudit.ownerVerificationMirrors) {
    assert.equal(
      sha256(gitBytes("show", `${investorWebsiteRouteQualitySuccessorCommit}:${mirror.path}`)),
      mirror.currentSha256
    );
  }
  assert.equal(investorWebsiteRouteQualitySuccessor.reviewedInvariants.runtimeBehaviorChanged, false);
  assert.equal(investorWebsiteRouteQualitySuccessor.reviewedInvariants.routeOrderingChanged, false);
  assert.equal(investorWebsiteRouteQualitySuccessor.reviewedInvariants.routeScoringChanged, false);
  assert.equal(investorWebsiteRouteQualitySuccessor.boundaries.recommendationInfluence, "OFF");
  assert.equal(investorWebsiteRouteQualitySuccessor.boundaries.readinessState, "INSUFFICIENT_EVIDENCE");
  assert.equal(investorWebsiteRouteQualitySuccessor.boundaries.representativeShadowOutputExposed, false);

  assert.equal(restored3dRouteQualitySuccessor.batchId, "BATCH-20260719-006");
  assert.equal(restored3dRouteQualitySuccessor.status, "OWNER_REVIEWED_AND_SYNCHRONIZED");
  assert.equal(restored3dRouteQualitySuccessor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(restored3dRouteQualitySuccessor.predecessor.path, investorWebsiteRouteQualitySuccessorPath);
  assert.equal(
    restored3dRouteQualitySuccessor.predecessor.sha256,
    sha256(read(investorWebsiteRouteQualitySuccessorPath))
  );
  assert.equal(restored3dRouteQualitySuccessor.predecessor.remainsHistorical, true);
  assert.equal(restored3dRouteQualitySuccessor.predecessor.rewritten, false);

  const restoredDataTransition = restored3dRouteQualitySuccessor.dataOwnerTransition;
  assert.equal(restoredDataTransition.commit, restored3dRouteQualityDataCommit);
  assert.equal(restoredDataTransition.ownerSubsystem, "Prometheus Data");
  assert.equal(
    restoredDataTransition.tree,
    git("rev-parse", `${restored3dRouteQualityDataCommit}^{tree}`)
  );
  assert.deepEqual(restoredDataTransition.changedPaths.slice().sort(), expectedRouteQualityDataPaths);
  for (const transition of [
    restoredDataTransition.routeQualityGate,
    restoredDataTransition.canonicalRouteQualityReport,
    restoredDataTransition.routeQualityRegression
  ]) {
    assert.equal(
      sha256(gitBytes("show", `${restored3dRouteQualityDataCommit}:${transition.path}`)),
      transition.currentSha256,
      `${transition.path} restored 3D Data owner hash drifted.`
    );
  }
  assert.deepEqual(
    changedPaths(restored3dRouteQualitySuccessorCommit),
    expectedRestored3dRouteQualitySuccessorPaths
  );
  assert.equal(
    restored3dRouteQualitySuccessor.dataOwnerTransition.commit,
    restored3dRouteQualityDataCommit
  );
  for (const reference of restored3dRouteQualitySuccessor.protectedReferenceAudit.affectedIntelligenceReferences) {
    assert.equal(
      sha256(gitBytes("show", `${restored3dRouteQualitySuccessorCommit}:${reference.consumerPath}`)),
      reference.currentConsumerSha256
    );
    const currentConsumerSha256 = sha256(read(reference.consumerPath));
    assert.equal(
      currentConsumerSha256 === reference.currentConsumerSha256
        || isCurrentAugust1IntelligenceTransition(
          reference.consumerPath,
          reference.currentConsumerSha256,
          currentConsumerSha256
        )
        || isCurrentCrossIndustryIntelligenceTransition(
          reference.consumerPath,
          currentConsumerSha256
        )
        || isCurrentZipFounderAccessIntelligenceTransition(
          reference.consumerPath,
          currentConsumerSha256
        )
        || isCurrentHardenedSmokeGuardIntelligenceTransition(
          hardenedSmokeGuardIntelligenceTransitions,
          reference.consumerPath,
          currentConsumerSha256
        ),
      true,
      `${reference.consumerPath} current Intelligence successor drifted.`
    );
  }
  for (const mirror of restored3dRouteQualitySuccessor.protectedReferenceAudit.ownerVerificationMirrors) {
    const currentMirrorSha256 = sha256(read(mirror.path));
    assert.equal(
      currentMirrorSha256 === mirror.currentSha256
        || isCurrentAugust1IntelligenceTransition(
          mirror.path,
          mirror.currentSha256,
          currentMirrorSha256
        )
        || isCurrentCrossIndustryIntelligenceTransition(
          mirror.path,
          currentMirrorSha256
        )
        || isCurrentZipFounderAccessIntelligenceTransition(
          mirror.path,
          currentMirrorSha256
        )
        || isCurrentHardenedSmokeGuardIntelligenceTransition(
          hardenedSmokeGuardIntelligenceTransitions,
          mirror.path,
          currentMirrorSha256
        ),
      true,
      `${mirror.path} current Intelligence successor drifted.`
    );
  }
  assert.equal(restored3dRouteQualitySuccessor.reviewedInvariants.runtimeBehaviorChanged, false);
  assert.equal(restored3dRouteQualitySuccessor.reviewedInvariants.routeOrderingChanged, false);
  assert.equal(restored3dRouteQualitySuccessor.reviewedInvariants.routeScoringChanged, false);
  assert.equal(restored3dRouteQualitySuccessor.boundaries.recommendationInfluence, "OFF");
  assert.equal(restored3dRouteQualitySuccessor.boundaries.readinessState, "INSUFFICIENT_EVIDENCE");
  assert.equal(restored3dRouteQualitySuccessor.boundaries.representativeShadowOutputExposed, false);

  assert.deepEqual(changedPaths(restored3dClaimsDataCommit), [
    publicClaimsEvidenceMatrixPath,
    "tests/route-iq-public-claims-data.test.mjs"
  ].sort());
  const publicClaimsEvidenceMatrix = readJson(publicClaimsEvidenceMatrixPath);
  const intelligenceCorroboration = publicClaimsEvidenceMatrix.crossOwnerCorroborationSources.find(
    source => source.ownerSubsystem === "Prometheus Intelligence Engine"
  );
  assert.equal(
    intelligenceCorroboration.ownerCommit === restored3dRouteQualitySuccessorCommit
      || intelligenceCorroboration.ownerCommit === currentCrossIndustryIntelligenceSuccessorCommit,
    true
  );
  if (intelligenceCorroboration.ownerCommit === currentCrossIndustryIntelligenceSuccessorCommit) {
    assert.equal(intelligenceCorroboration.path, currentCrossIndustryIntelligenceClaimsPath);
    assert.deepEqual(
      git(
        "show",
        "-s",
        "--format=%an <%ae>%n%cn <%ce>",
        currentCrossIndustryIntelligenceSuccessorCommit
      ).split("\n"),
      [
        "Prometheus Intelligence Engine <intelligence@prometheus.local>",
        "Prometheus Intelligence Engine <intelligence@prometheus.local>"
      ]
    );
    assert.equal(
      changedPaths(currentCrossIndustryIntelligenceSuccessorCommit)
        .includes(currentCrossIndustryIntelligenceClaimsPath),
      true
    );
    assert.doesNotThrow(() => git(
      "merge-base",
      "--is-ancestor",
      currentCrossIndustryIntelligenceSuccessorCommit,
      "HEAD"
    ));
  }
  assert.equal(
    intelligenceCorroboration.ownerTree,
    git("rev-parse", `${intelligenceCorroboration.ownerCommit}^{tree}`)
  );
  assert.equal(
    intelligenceCorroboration.sha256,
    sha256(gitBytes(
      "show",
      `${intelligenceCorroboration.ownerCommit}:${intelligenceCorroboration.path}`
    ))
  );

  const dataValidation = mapping.dataOwnerValidation;
  assert.equal(dataValidation.contractMismatchClosed, true);
  assert.equal(
    sha256(gitBytes("show", `${dataValidation.currentOwnerSuccessorCommit}:${dataValidation.dataArchiveRuntimePath}`)),
    dataValidation.dataArchiveRuntimeSha256
  );
  assert.equal(
    sha256(gitBytes("show", `${dataValidation.currentOwnerSuccessorCommit}:${dataValidation.dataRuntimeContractPath}`)),
    dataValidation.dataRuntimeContractSha256
  );
  assert.equal(sha256(read(dataValidation.historicalRawArchivePath)), dataValidation.historicalRawArchiveSha256);
  assert.equal(sha256(read(dataValidation.historicalNormalizedArchivePath)), dataValidation.historicalNormalizedArchiveSha256);
  assert.equal(dataValidation.knownAndContemporaneousUnknownClassification, "action_time_observation");
  assert.equal(dataValidation.legacyFallbackClassification, "late_report_finalization_unknown");
  assert.equal(dataValidation.lateFallbackMaySatisfyOriginalShadowOpportunity, false);
  assert.equal(dataValidation.historicalArchiveRewritten, false);
  assert.equal(dataValidation.retryAndReplayRemainIdempotent, true);
  assert.equal(dataValidation.workspaceIsolationPreserved, true);
  assert.equal(dataValidation.currentOwnerSuccessorCommit, "f50d10f14f993b4e6ff42887e76c10721852cc43");

  const dashboardValidation = mapping.dashboardOwnerValidation;
  assert.equal(dashboardValidation.evidencePath, dashboardEvidencePath);
  assert.equal(dashboardValidation.representativeBehaviorApproval, "FOUNDER_BEHAVIOR_APPROVAL_REQUIRED");
  assert.equal(dashboardValidation.decisionSourceOptional, true);
  assert.equal(dashboardValidation.captureTiming, "visit_submission_post_action");
  assert.equal(dashboardValidation.preActionFrozenCandidateContextProduced, false);
  assert.equal(dashboardValidation.fullShadowCandidateContextPreserved, false);
  assert.equal(dashboardValidation.personallyIdentifiableInformationCollectionExpanded, false);
  assert.equal(dashboardValidation.shadowOutputsVisibleToRepresentatives, false);
  assert.equal(dashboardValidation.recommendationInfluence, "OFF");

  for (const flag of [
    "newSubsystemIntroduced",
    "parallelProductionEventArchitectureIntroduced",
    "newModelOrVendorDependencyIntroduced",
    "personallyIdentifiableInformationCollectionExpanded",
    "shadowOutputRepresentativeVisibility",
    "routeOrderingInfluenceIntroduced",
    "notificationInfluenceIntroduced",
    "automaticActionInfluenceIntroduced",
    "productionConsumerIntroduced",
    "prospectiveShadowEvidenceCollectionStarted",
    "historicalArchiveRewritten"
  ]) {
    assert.equal(mapping.architectureConfirmation[flag], false, `${flag} must remain false.`);
  }
  assert.equal(mapping.architectureConfirmation.recommendationInfluence, "OFF");
  assert.equal(mapping.releaseBoundary.pushPerformed, false);
  assert.equal(mapping.releaseBoundary.deploymentPerformed, false);
  assert.equal(mapping.releaseBoundary.founderBehaviorApprovalRequired, true);

  return {
    status: "PASS",
    batchId,
    legacyCommit,
    intelligenceContractsReconstructed: intelligenceContractPaths.length,
    protectedConsumersVerified: intelligenceContractPaths.length + 1,
    dashboardBehaviorApproval: "FOUNDER_BEHAVIOR_APPROVAL_REQUIRED",
    recommendationInfluence: "OFF",
    productionConsumerIntroduced: false,
    currentIntelligenceOwnerSuccessor: currentIntelligenceOwnerSuccessorCommit,
    protectedBaselineSuccessor: protectedBaselineSuccessorCommit,
    routeQualitySuccessor: routeQualitySuccessorCommit,
    commercialRouteQualitySuccessor: commercialRouteQualitySuccessorCommit,
    currentDashboardSourceCommit,
    currentDashboardValidationCommit,
    currentAugust1IntelligenceSuccessorCommit
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log(JSON.stringify(verifyReleaseProvenanceRepair(), null, 2));
}
