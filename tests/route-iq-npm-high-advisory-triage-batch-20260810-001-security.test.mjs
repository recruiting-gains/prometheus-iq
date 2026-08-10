import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const recordPath = "security/npm-high-advisory-triage-batch-20260810-001.json";
const testPath = "tests/route-iq-npm-high-advisory-triage-batch-20260810-001-security.test.mjs";
const predecessorRecordPath =
  "security/npm-high-advisory-triage-batch-20260809-002.json";
const predecessorTestPath =
  "tests/route-iq-npm-high-advisory-triage-batch-20260809-002-security.test.mjs";
const infrastructureContractPath =
  "workers/infrastructure/route-iq-cloudflare-toolchain-compatibility-v1.json";
const infrastructureCommit = "4b238db293e630f1dfff9e159b791e8d9a510f74";
const infrastructureTree = "9ecb94b795d612a34a84c7ba7871296872d9184a";
const startingCommit = "2d5caafc52de0c1ee42bce5b370e2232e53fd72f";

const read = path => readFileSync(resolve(root, path));
const readText = path => read(path).toString("utf8");
const readJson = path => JSON.parse(readText(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const git = args =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

const record = readJson(recordPath);
const predecessor = readJson(predecessorRecordPath);
const contract = readJson(infrastructureContractPath);
const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");

const expectedGraph = Object.freeze([
  {
    package: "wrangler",
    version: "4.120.1",
    relationship: "direct",
    stability: "stable",
    dependencyPaths: [["root", "wrangler"]],
    lockfilePath: "node_modules/wrangler",
    integrity:
      "sha512-rQJ38rY02XiVITbSBWHC7oap3M2evcXgsC4CdlIX4WQENUZMMnue9j2vXO4aIi39KR+jDH+UHK8JNqp1+UjkRQ=="
  },
  {
    package: "miniflare",
    version: "5.20260804.0-alpha",
    relationship: "direct-and-wrangler-transitive-deduped",
    stability: "official-unavoidable-prerelease",
    dependencyPaths: [
      ["root", "miniflare"],
      ["root", "wrangler", "miniflare"]
    ],
    lockfilePath: "node_modules/miniflare",
    integrity:
      "sha512-UDegnTukIpJCI/lNyQXU7B8kYFLcMZihlxqqOocnc62tV8AO6XofmFmZm3ZLDXTWZpkZnLLJ2sKCSlTIEXO3dQ=="
  },
  {
    package: "workerd",
    version: "1.20260804.1",
    relationship: "wrangler-and-miniflare-transitive-deduped",
    stability: "stable",
    dependencyPaths: [
      ["root", "miniflare", "workerd"],
      ["root", "wrangler", "workerd"],
      ["root", "wrangler", "miniflare", "workerd"]
    ],
    lockfilePath: "node_modules/workerd",
    integrity:
      "sha512-b0P38g5/ssemwWxd/mafNYggEZ0ere7PCiUH6RCHkgqjRhhXTP45nDiL2L3iIvi8uF2IjNrGpVgMXEunCaeY/w=="
  },
  {
    package: "sharp",
    version: "0.35.2",
    relationship: "miniflare-transitive",
    stability: "stable",
    dependencyPaths: [
      ["root", "miniflare", "sharp"],
      ["root", "wrangler", "miniflare", "sharp"]
    ],
    lockfilePath: "node_modules/sharp",
    integrity:
      "sha512-FVtFjtBCMiJS6yb5CX7Sop45WFMpeGw6oRKuJnXYgf/f1ms/D7LE/ZUSNxnW7rZ/dbslQWYkoqFHGPaDBtaK4w=="
  },
  {
    package: "undici",
    version: "7.29.0",
    relationship: "miniflare-transitive",
    stability: "stable",
    dependencyPaths: [
      ["root", "miniflare", "undici"],
      ["root", "wrangler", "miniflare", "undici"]
    ],
    lockfilePath: "node_modules/undici",
    integrity:
      "sha512-IDxfleLmmbSskfWSUATiN1nfn2rDuvnMOqb5CWR92iIfojA0Ud+ulOAAEQ57LPr9rWmsreUyf5lwyao+7GNNVw=="
  },
  {
    package: "ajv",
    version: "8.20.0",
    relationship: "direct-development-schema-validator",
    stability: "stable",
    dependencyPaths: [["root", "ajv"]],
    lockfilePath: "node_modules/ajv",
    integrity:
      "sha512-Thbli+OlOj+iMPYFBVBfJ3OmCAnaSyNn4M1vz9T6Gka5Jt9ba/HIR56joy65tY6kx/FCF5VXNB819Y7/GUrBGA=="
  },
  {
    package: "jsonc-parser",
    version: "3.2.0",
    relationship: "direct-development-config-parser-matching-wrangler",
    stability: "stable",
    dependencyPaths: [["root", "jsonc-parser"]],
    lockfilePath: "node_modules/jsonc-parser",
    integrity:
      "sha512-gfFQZrcTc8CnKXp6Y4/CBT3fTc0OVuDofpre4aEeEpSBPV5X5v4+Vmx+8snU7RLPrNHPKSgLxGo9YuQzz20o+w=="
  }
]);

const expectedAdvisories = Object.freeze([
  {
    source: 1124066,
    id: "GHSA-f88m-g3jw-g9cj",
    package: "sharp",
    severity: "high",
    title:
      "sharp inherited vulnerabilities in libvips: CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591",
    range: "<0.35.0",
    patchedVersionFloor: "0.35.0"
  },
  {
    source: 1130715,
    id: "GHSA-8xcm-r25x-g524",
    package: "undici",
    severity: "moderate",
    title: "undici vulnerable to downstream response desynchronization via retry interceptor",
    range: ">=7.0.0 <7.29.0",
    patchedVersionFloor: "7.29.0"
  },
  {
    source: 1130718,
    id: "GHSA-4cwx-7wf7-3272",
    package: "undici",
    severity: "high",
    title:
      "undici vulnerable to cross-user information disclosure and parse-time crash via degenerate private cache directives",
    range: ">=7.0.0 <7.29.0",
    patchedVersionFloor: "7.29.0"
  },
  {
    source: 1130726,
    id: "GHSA-m8rv-5g2x-5cg5",
    package: "undici",
    severity: "moderate",
    title: "undici vulnerable to CRLF Injection via blob-like body 'type' property",
    range: ">=7.0.0 <7.29.0",
    patchedVersionFloor: "7.29.0"
  },
  {
    source: 1130729,
    id: "GHSA-jr45-8vmc-qm54",
    package: "undici",
    severity: "moderate",
    title:
      "undici vulnerable to cross-user information disclosure via whitespace around equals in Cache-Control directives",
    range: ">=7.0.0 <7.29.0",
    patchedVersionFloor: "7.29.0"
  },
  {
    source: 1130731,
    id: "GHSA-v3r7-h72x-cjcm",
    package: "undici",
    severity: "moderate",
    title:
      "undici vulnerable to cookie attribute injection via unsanitized domain and unparsed setCookie fields",
    range: ">=7.0.0 <7.29.0",
    patchedVersionFloor: "7.29.0"
  }
]);

test("successor binds the exact Infrastructure parent and immutable Batch 002 bytes", () => {
  assert.deepEqual(Object.keys(record).sort(), [
    "actionWarning",
    "auditCommands",
    "auditDisposition",
    "auditModel",
    "batchId",
    "compatibilityEvidence",
    "normalResolution",
    "observedAt",
    "owner",
    "ownerIdentity",
    "prereleaseDisposition",
    "productionBoundary",
    "provenance",
    "removedPackageFindings",
    "removedUnderlyingAdvisories",
    "schemaVersion",
    "securityOwnedFiles",
    "selectedGraph",
    "verdict",
    "verificationResults"
  ].sort());
  assert.equal(record.schemaVersion, "prometheus-security-npm-advisory-successor-v1");
  assert.equal(record.batchId, "BATCH-20260810-001");
  assert.equal(record.owner, "Prometheus Security/Aegis");
  assert.equal(record.ownerIdentity, "Prometheus Security <security@prometheus.local>");
  assert.equal(record.verdict, "ZERO_HIGH_CLOUDFLARE_TOOLCHAIN_GRAPH_ACCEPTED_BY_SECURITY");
  assert.equal(git(["show", "-s", "--format=%T", infrastructureCommit]), infrastructureTree);
  assert.equal(record.provenance.infrastructureOwner.commit, infrastructureCommit);
  assert.equal(record.provenance.infrastructureOwner.tree, infrastructureTree);
  assert.equal(record.provenance.infrastructureOwner.parent, startingCommit);
  assert.equal(
    record.provenance.infrastructureOwner.identity,
    "Prometheus Infrastructure <infrastructure@prometheus.local>"
  );

  const predecessorBytes = read(predecessorRecordPath);
  const predecessorTestBytes = read(predecessorTestPath);
  assert.equal(sha256(predecessorBytes), record.provenance.immutablePredecessor.recordSha256);
  assert.equal(sha256(predecessorTestBytes), record.provenance.immutablePredecessor.testSha256);
  assert.equal(git(["hash-object", predecessorRecordPath]), "c82e4b81cf61570aaf5ede10556e56bc0de5b5c0");
  assert.equal(git(["hash-object", predecessorTestPath]), "045f03c484648c7eff8c8bcc89fa41298327d2b9");
  assert.equal(
    execFileSync("git", ["show", `${startingCommit}:${predecessorRecordPath}`], {
      cwd: root
    }).compare(predecessorBytes),
    0
  );
  assert.equal(
    execFileSync("git", ["show", `${startingCommit}:${predecessorTestPath}`], {
      cwd: root
    }).compare(predecessorTestBytes),
    0
  );
  assert.equal(record.provenance.immutablePredecessor.mutationAuthorized, false);
  assert.equal(record.provenance.immutablePredecessor.byteIdentical, true);
});

test("successor binds every selected version, integrity, and logical dependency path", () => {
  assert.deepEqual(record.selectedGraph, expectedGraph);
  assert.equal(sha256(read("package.json")), record.provenance.infrastructureOwner.packageJsonSha256);
  assert.equal(sha256(read("package-lock.json")), record.provenance.infrastructureOwner.packageLockSha256);
  assert.equal(
    sha256(read(infrastructureContractPath)),
    record.provenance.infrastructureOwner.contractSha256
  );

  for (const entry of expectedGraph) {
    const locked = packageLock.packages[entry.lockfilePath];
    assert.equal(locked.version, entry.version, entry.package);
    assert.equal(locked.integrity, entry.integrity, entry.package);
    assert.equal(locked.dev, true, entry.package);
    assert.equal(Object.hasOwn(packageJson.dependencies, entry.package), false, entry.package);
    const physicalNodes = Object.keys(packageLock.packages).filter(path =>
      path === entry.lockfilePath || path.endsWith(`/node_modules/${entry.package}`)
    );
    assert.deepEqual(physicalNodes, [entry.lockfilePath], entry.package);
  }

  assert.equal(packageJson.devDependencies.wrangler, "4.120.1");
  assert.equal(packageJson.devDependencies.miniflare, "5.20260804.0-alpha");
  assert.equal(packageJson.devDependencies.ajv, "8.20.0");
  assert.equal(packageJson.devDependencies["jsonc-parser"], "3.2.0");
  assert.equal(packageLock.packages["node_modules/wrangler"].dependencies.miniflare,
    "5.20260804.0-alpha");
  assert.equal(packageLock.packages["node_modules/wrangler"].dependencies.workerd,
    "1.20260804.1");
  assert.equal(packageLock.packages["node_modules/miniflare"].dependencies.sharp, "0.35.2");
  assert.equal(packageLock.packages["node_modules/miniflare"].dependencies.undici, "7.29.0");
  assert.equal(packageLock.packages["node_modules/miniflare"].dependencies.workerd,
    "1.20260804.1");
});

test("the exact four package highs and six underlying advisories are removed", () => {
  assert.equal(predecessor.after.allDependencies.high, 4);
  assert.equal(predecessor.after.productionOnly.high, 0);
  assert.deepEqual(record.auditDisposition.before, predecessor.after);
  assert.deepEqual(record.auditDisposition.after, {
    allDependencies: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
    productionOnly: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 }
  });
  assert.deepEqual(record.auditDisposition.removedPackageLevelHighFindings,
    ["miniflare", "sharp", "undici", "wrangler"]);
  assert.deepEqual(record.removedUnderlyingAdvisories, expectedAdvisories);
  assert.deepEqual(
    [...new Set(record.removedUnderlyingAdvisories.map(advisory => advisory.id))].sort(),
    [
      "GHSA-4cwx-7wf7-3272",
      "GHSA-8xcm-r25x-g524",
      "GHSA-f88m-g3jw-g9cj",
      "GHSA-jr45-8vmc-qm54",
      "GHSA-m8rv-5g2x-5cg5",
      "GHSA-v3r7-h72x-cjcm"
    ]
  );
  assert.deepEqual(
    record.removedPackageFindings.map(finding => finding.package),
    ["miniflare", "sharp", "undici", "wrangler"]
  );
  for (const finding of record.removedPackageFindings) {
    const predecessorFinding = predecessor.findings.find(entry => entry.package === finding.package);
    assert.ok(predecessorFinding, finding.package);
    assert.equal(finding.baselineVersion, predecessorFinding.installedVersionAfter);
    assert.equal(finding.severity, "high");
    assert.equal(finding.vulnerableRange, predecessorFinding.vulnerableRange);
    assert.deepEqual(finding.dependencyPaths, predecessorFinding.dependencyPaths);
    assert.deepEqual(finding.advisoryIds, predecessorFinding.advisories);
  }
  assert.deepEqual(
    Object.fromEntries(record.removedPackageFindings.map(finding => [
      finding.package,
      finding.resolvedVersion
    ])),
    {
      miniflare: "5.20260804.0-alpha",
      sharp: "0.35.2",
      undici: "7.29.0",
      wrangler: "4.120.1"
    }
  );
});

test("normal resolution and the unavoidable Miniflare prerelease remain fail-closed", () => {
  assert.deepEqual(record.normalResolution, {
    npmAuditFixForceUsed: false,
    packageOverridesUsed: false,
    packageResolutionsUsed: false,
    manualLockfileEditingUsed: false,
    transitiveSharpPinUsed: false,
    transitiveUndiciPinUsed: false,
    unrelatedDependencyUpgradeAccepted: false
  });
  assert.equal(packageJson.overrides, undefined);
  assert.equal(packageJson.resolutions, undefined);
  assert.equal(Object.hasOwn(packageJson.devDependencies, "sharp"), false);
  assert.equal(Object.hasOwn(packageJson.devDependencies, "undici"), false);
  assert.equal(contract.normalResolution.forceUsed, false);
  assert.equal(contract.normalResolution.overridesUsed, false);
  assert.equal(contract.normalResolution.manualLockfileEditingUsed, false);
  assert.deepEqual(record.prereleaseDisposition, {
    package: "miniflare",
    version: "5.20260804.0-alpha",
    isPrerelease: true,
    classification: "OFFICIAL_UNAVOIDABLE_DEPENDENCY_OF_STABLE_WRANGLER",
    wranglerVersion: "4.120.1",
    wranglerStability: "stable",
    wranglerReleaseChannel: "npm-latest",
    exactDependencyRequiredByWrangler: true,
    stableMiniflareZeroHighGraphAvailable: false,
    acceptedOnlyWithCompatibilityQualification: true
  });
  assert.equal(
    packageLock.packages["node_modules/wrangler"].dependencies.miniflare,
    record.prereleaseDisposition.version
  );
});

test("Security acceptance is bound to 121 of 121 compatibility and all nine repairs", () => {
  assert.equal(sha256(read(infrastructureContractPath)), record.compatibilityEvidence.contractSha256);
  assert.equal(record.compatibilityEvidence.command, contract.compatibilityCommand);
  assert.deepEqual(
    {
      tests: record.compatibilityEvidence.tests,
      passed: record.compatibilityEvidence.passed,
      failed: record.compatibilityEvidence.failed,
      skipped: record.compatibilityEvidence.skipped
    },
    { tests: 121, passed: 121, failed: 0, skipped: 0 }
  );
  assert.equal(contract.compatibilityGroup.governedExistingTests, 121);
  assert.equal(contract.compatibilityGroup.requiredPasses, 121);
  assert.equal(contract.compatibilityGroup.requiredFailures, 0);
  assert.equal(contract.compatibilityGroup.requiredSkips, 0);
  assert.equal(contract.priorFailureRootCauses.length, 9);
  assert.deepEqual(record.compatibilityEvidence.priorRejectedCandidate,
    { tests: 121, passed: 112, failed: 9 });
  assert.equal(record.compatibilityEvidence.documentedPriorFailureCount, 9);
  assert.equal(record.compatibilityEvidence.originalProtectionWeakened, false);
});

test("the action warning and production boundary exactly match Infrastructure evidence", () => {
  assert.equal(record.actionWarning.classification,
    contract.node24ActionMigration.classification);
  assert.equal(record.actionWarning.currentActionsUseNode20Runtime,
    contract.node24ActionMigration.currentActionsUseNode20Runtime);
  assert.equal(record.actionWarning.githubForcesNode24,
    contract.node24ActionMigration.githubForcesNode24);
  assert.deepEqual(record.actionWarning.availableReplacements,
    contract.node24ActionMigration.availableReplacements);
  assert.equal(record.actionWarning.permissionsChanged, false);
  assert.equal(record.actionWarning.workflowFilesChanged, false);
  assert.equal(record.actionWarning.securityAcceptanceBlocked, false);
  assert.equal(
    record.actionWarning.reasonDeferred,
    "The workflow consumers are coupled to Overwatch-owned exact-SHA verifiers outside the Infrastructure and Security owner scopes."
  );
  assert.equal(record.auditModel, "npm-audit-v2-package-level-findings");
  assert.deepEqual(record.auditCommands, {
    allDependencies: "npm audit --json",
    productionOnly: "npm audit --omit=dev --json"
  });
  assert.deepEqual(record.verificationResults, {
    npmCi: "PASS_ZERO_VULNERABILITIES",
    allDependencyAudit: "PASS_ZERO_FINDINGS",
    productionOnlyAudit: "PASS_ZERO_FINDINGS",
    infrastructureContractTests: "PASS_7_OF_7",
    workerEmulationCompatibility: "PASS_121_OF_121",
    security: "PASS",
    aegis: "PASS_13_OF_13",
    deterministicSuccessorTest: "PASS_7_OF_7"
  });
  assert.deepEqual(record.productionBoundary, {
    ...contract.productionBoundary,
    secretAccessCount: 0
  });
  assert.equal(record.auditDisposition.productionReachableHighFindingsBefore, 0);
  assert.equal(record.auditDisposition.productionReachableHighFindingsAfter, 0);
  assert.deepEqual(record.securityOwnedFiles, [recordPath, testPath]);
});

test("the Security owner commit has the exact Infrastructure parent and only two files", () => {
  const commits = git(["log", "--format=%H", "--diff-filter=A", "--", recordPath])
    .split("\n")
    .filter(Boolean);
  assert.equal(commits.length, 1);
  const ownerCommit = commits[0];
  assert.equal(git(["show", "-s", "--format=%P", ownerCommit]), infrastructureCommit);
  assert.equal(
    git(["show", "-s", "--format=%an <%ae>|%cn <%ce>", ownerCommit]),
    "Prometheus Security <security@prometheus.local>|Prometheus Security <security@prometheus.local>"
  );
  assert.equal(
    git(["show", "-s", "--format=%s", ownerCommit]),
    "security: accept zero-high Cloudflare toolchain graph"
  );
  const changedFiles = git([
    "diff-tree",
    "--no-commit-id",
    "--name-only",
    "-r",
    ownerCommit
  ]).split("\n").filter(Boolean).sort();
  assert.deepEqual(changedFiles, [recordPath, testPath].sort());
  assert.equal(git(["merge-base", "--is-ancestor", ownerCommit, "HEAD"]), "");
});
