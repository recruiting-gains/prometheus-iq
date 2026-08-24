import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const historicalCommit = "de7b3fb7ad28c621d10edb40b7225c2a2ce0b4c1";
const readAt = path => execFileSync(
  "git",
  ["show", `${historicalCommit}:${path}`],
  { cwd: root, encoding: "utf8" }
);
const readJsonAt = path => JSON.parse(readAt(path));

const evidencePath = "security/npm-high-advisory-triage-batch-20260809-002.json";
const evidence = readJson(evidencePath);
const packageJson = readJsonAt("package.json");
const packageLock = readJsonAt("package-lock.json");

const expectedVersions = Object.freeze({
  miniflare: "4.20260708.1",
  nanoid: "3.3.18",
  postcss: "8.5.26",
  sharp: "0.34.5",
  undici: "7.28.0",
  wrangler: "4.110.0"
});

const expectedPaths = Object.freeze({
  miniflare: [
    ["root", "miniflare"],
    ["root", "wrangler", "miniflare"]
  ],
  nanoid: [["root", "vite", "postcss", "nanoid"]],
  postcss: [["root", "vite", "postcss"]],
  sharp: [
    ["root", "miniflare", "sharp"],
    ["root", "wrangler", "miniflare", "sharp"]
  ],
  undici: [
    ["root", "miniflare", "undici"],
    ["root", "wrangler", "miniflare", "undici"]
  ],
  wrangler: [["root", "wrangler"]]
});

test("Security evidence records the exact baseline and six package findings", () => {
  assert.equal(evidence.schemaVersion, "prometheus-security-npm-advisory-triage-v1");
  assert.equal(evidence.batchId, "BATCH-20260809-002");
  assert.equal(evidence.ownerIdentity, "Prometheus Security <security@prometheus.local>");
  assert.deepEqual(evidence.baseline, {
    branch: "main",
    commit: "78ec6ceecf7c0420b6da7d9f3e7bbbd62b48ae2e",
    tree: "387760d6e7182e83ec06364abd4fc74bd5a94c07"
  });
  assert.equal(evidence.before.allDependencies.high, 6);
  assert.equal(evidence.before.productionOnly.high, 0);
  assert.equal(evidence.after.allDependencies.high, 4);
  assert.equal(evidence.after.allDependencies.total, 4);
  assert.equal(evidence.after.productionOnly.total, 0);
  assert.deepEqual(
    evidence.findings.map(finding => finding.package).sort(),
    Object.keys(expectedVersions).sort()
  );
});

test("Every finding is classified and no high finding reaches production", () => {
  for (const finding of evidence.findings) {
    assert.equal(finding.severity, "high", finding.package);
    assert.equal(finding.dependencyClass, "development", finding.package);
    assert.equal(
      finding.runtimeReachability,
      "NOT_PRESENT_IN_PRODUCTION_DEPENDENCY_TREE",
      finding.package
    );
    assert.deepEqual(finding.dependencyPaths, expectedPaths[finding.package]);
    assert.equal(finding.installedVersionAfter, expectedVersions[finding.package]);
    assert.match(finding.resolutionStatus, /^(?:REMEDIATED|DEFERRED_DEVELOPMENT_ONLY)$/u);
    assert.match(finding.disposition, /^(?:REMEDIATED_|DEFERRED_)/u, finding.package);
    assert.ok(finding.affectedSurface.length > 0, finding.package);
    assert.ok(finding.advisories.length > 0, finding.package);
    assert.ok(finding.nonBreakingAssessment.length > 0, finding.package);
    assert.ok(finding.semverRisk.length > 0, finding.package);
    assert.ok(finding.exploitability.length > 0, finding.package);
  }
  assert.equal(evidence.verification.productionReachableHighFindings, 0);
  assert.equal(evidence.verification.unresolvedHighFindings, 4);
  assert.equal(
    evidence.findings.filter(finding => finding.resolutionStatus === "REMEDIATED").length,
    2
  );
  assert.equal(
    evidence.findings.filter(
      finding => finding.resolutionStatus === "DEFERRED_DEVELOPMENT_ONLY"
    ).length,
    4
  );
});

test("Package manifest and lock pin the audited versions without production dependencies", () => {
  assert.equal(packageJson.devDependencies.miniflare, "^4.20260708.1");
  assert.equal(packageJson.devDependencies.wrangler, expectedVersions.wrangler);
  assert.equal(packageLock.packages[""].devDependencies.miniflare, "^4.20260708.1");
  assert.equal(packageLock.packages[""].devDependencies.wrangler, expectedVersions.wrangler);
  for (const [name, version] of Object.entries(expectedVersions)) {
    const node = packageLock.packages[`node_modules/${name}`];
    assert.equal(node.version, version, name);
    assert.equal(node.dev, true, name);
    assert.equal(Object.hasOwn(packageJson.dependencies, name), false, name);
  }
  assert.equal(
    packageLock.packages["node_modules/wrangler"].dependencies.miniflare,
    expectedVersions.miniflare
  );
  assert.equal(
    packageLock.packages["node_modules/miniflare"].dependencies.sharp,
    expectedVersions.sharp
  );
  assert.equal(
    packageLock.packages["node_modules/miniflare"].dependencies.undici,
    expectedVersions.undici
  );
  assert.equal(
    packageLock.packages["node_modules/postcss"].dependencies.nanoid,
    "^3.3.17"
  );
});

test("Remediation accepted only safe patches and rejected the breaking audit candidate", () => {
  assert.equal(evidence.remediation.auditFixForceUsed, false);
  assert.equal(evidence.remediation.overridesUsed, false);
  assert.deepEqual(evidence.remediation.unrelatedDirectDependenciesChanged, []);
  assert.deepEqual(evidence.remediation.productionDependenciesChanged, []);
  assert.equal(
    evidence.remediation.result,
    "TWO_SAFE_TRANSITIVE_PATCHES_FOUR_DEVELOPMENT_ONLY_HIGHS_DEFERRED"
  );
  assert.equal(Object.hasOwn(packageJson, "overrides"), false);
  assert.doesNotMatch(JSON.stringify(packageJson.scripts), /npm audit fix\s+--force/u);
  assert.equal(evidence.compatibilityTrial.status, "REJECTED_NOT_COMMITTED");
  assert.deepEqual(evidence.compatibilityTrial.testTotals, {
    tests: 121,
    passed: 112,
    failed: 9
  });
  assert.equal(evidence.compatibilityTrial.forceOrOverrideAccepted, false);
});

test("The Miniflare major transition remains bound to every known direct harness", () => {
  const importPattern = /import\s*\{\s*Miniflare\s*\}\s*from\s*["']miniflare["']/u;
  const currentImportPattern = /import\s*\{[^}]*\bMiniflare\b[^}]*\}\s*from\s*["']miniflare["']/u;
  assert.equal(
    evidence.findings.find(finding => finding.package === "miniflare").semverRisk,
    "HIGHER_THAN_PATCH_REQUIRES_ALL_MINIFLARE_HARNESSES"
  );
  assert.deepEqual(evidence.runtimeCallSites.miniflare, [
    "tests/cloudflare-unattended-runtime-guard.test.mjs",
    "tests/route-iq-business-availability-infrastructure.test.mjs",
    "tests/route-iq-prospective-shadow-infrastructure.test.mjs",
    "tests/route-iq-request-crm-infrastructure.test.mjs"
  ]);
  for (const path of evidence.runtimeCallSites.miniflare) {
    assert.match(readAt(path), importPattern, `${path} historical evidence`);
    assert.match(read(path), currentImportPattern, `${path} current harness`);
  }
  for (const name of ["wrangler", "sharp", "undici", "postcss", "nanoid"]) {
    assert.deepEqual(evidence.runtimeCallSites[name], [], name);
  }
});
