import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  testSuiteExecutionGroups,
  validateTestSuiteConfiguration,
} from "../scripts/run-test-suite.mjs";
import { verifyPublicRepositoryIntegrity } from "../scripts/lib/github-actions-public-worker-deployment.mjs";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const gitLines = args => execFileSync("git", args, { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

const retainedWorkflows = Object.freeze([
  ".github/workflows/deploy-prometheus-private-worker-v2.yml",
  ".github/workflows/deploy-prometheus-public-worker.yml",
  ".github/workflows/early-github-handoff-v1.yml",
  ".github/workflows/inspect-prometheus-worker-production-identity.yml",
  ".github/workflows/qualify-prometheus-private-worker-v2.yml",
  ".github/workflows/qualify-prometheus-public-worker.yml",
  ".github/workflows/security-gates.yml"
]);

test("the lean control plane contains three concise active authorities", () => {
  const files = ["README.md", "AGENTS.md", "docs/TEST_RELEASE_MAP.md"];
  const words = files.map(read).join("\n").trim().split(/\s+/u).length;
  assert.ok(words <= 3000, `control plane is ${words} words`);
  assert.match(read("README.md"), /Public Worker:[\s\S]*Private Worker:/u);
  assert.match(read("AGENTS.md"), /Early GitHub Handoff — Mandatory When Routed/u);
  assert.match(read("docs/TEST_RELEASE_MAP.md"), /Exactly seven workflow files are active/u);
  for (const retired of [
    "PROMETHEUS_CONSTITUTION.md",
    "PROMETHEUS_MASTER_CONTEXT.md",
    "PROMETHEUS_MASTER_ENGINEERING_STATE.md",
    "PROMETHEUS_SYSTEM_MAP.md",
    "PROMETHEUS_IQ_ENGINEERING_MASTER_INVENTORY.md",
    "COMPANY_IDENTITY.md"
  ]) assert.equal(existsSync(resolve(root, retired)), false, `${retired} is still active`);
  assert.match(read("PRODUCT_VISION.md"), /Operator: Cruz Garza, sole proprietor/u);
});

test("exactly seven nondeploying-or-protected workflow lanes remain pinned", () => {
  const actual = gitLines(["ls-files", ".github/workflows/*.yml"]).sort();
  assert.deepEqual(actual, [...retainedWorkflows]);
  for (const workflow of actual) {
    const source = read(workflow);
    const actions = [...source.matchAll(/^\s*uses:\s*([^\s]+)$/gmu)].map(match => match[1]);
    for (const action of actions) assert.match(action, /^[^@\s]+@[0-9a-f]{40}$/u, `${workflow}: ${action}`);
  }
  const security = read(".github/workflows/security-gates.yml");
  assert.match(security, /npm run test:security/u);
  assert.doesNotMatch(security, /test:social-media|wrangler\s+(?:deploy|versions)/u);
  for (const deployment of [
    ".github/workflows/deploy-prometheus-public-worker.yml",
    ".github/workflows/deploy-prometheus-private-worker-v2.yml"
  ]) assert.doesNotMatch(read(deployment), /npm (?:run build|test)|vite build/u);
});

test("every tracked test and top-level script has exactly one explicit disposition", () => {
  const testResult = validateTestSuiteConfiguration({ repositoryRoot: root });
  assert.equal(testResult.total, 145);
  const scriptConfiguration = readJson("scripts/script-entrypoints.v1.json");
  const categories = Object.values(scriptConfiguration.categories);
  const classified = categories.flat();
  assert.equal(new Set(classified).size, classified.length);
  const actual = gitLines([
    "ls-files", "--cached", "--others", "--exclude-standard", "--", "scripts/*.mjs"
  ]).sort();
  assert.deepEqual([...classified].sort(), actual);
  assert.deepEqual(scriptConfiguration.unclassified, []);
});

test("the heavyweight Worker release harnesses run once without competing release workers", () => {
  const configuration = readJson("tests/test-suites.v1.json");
  const groups = testSuiteExecutionGroups("release", configuration);
  const privateWorkflowHarness = "tests/github-actions-private-worker-workflow-v2.test.mjs";
  const workerdHarness = "tests/github-actions-public-worker-deployment.test.mjs";
  assert.equal(groups.length, 2);
  assert.equal(groups[0].concurrency, 4);
  assert.equal(groups[0].files.includes(privateWorkflowHarness), false);
  assert.equal(groups[0].files.includes(workerdHarness), false);
  assert.deepEqual(groups[1], {
    concurrency: 1,
    files: [privateWorkflowHarness, workerdHarness],
  });
  for (const harness of [privateWorkflowHarness, workerdHarness]) {
    assert.equal(groups.flatMap(group => group.files)
      .filter(file => file === harness).length, 1);
  }
});

test("retired paths are absent and recoverable at their exact baseline blobs", () => {
  const manifest = readJson("overwatch/retirement/phase-1-retirement-manifest.json");
  assert.equal(manifest.baseline.commit, "c7119fcee140ab8a130cdb888439277fdcbeb6b0");
  const deletedPaths = gitLines([
    "diff",
    "--name-only",
    "--diff-filter=D",
    manifest.baseline.commit,
    "HEAD"
  ]).sort();
  const manifestPaths = manifest.entries.map(entry => entry.originalPath).sort();
  assert.equal(deletedPaths.length, 200);
  assert.equal(manifest.entries.length, 200);
  assert.equal(new Set(manifestPaths).size, 200);
  assert.deepEqual(manifestPaths, deletedPaths);
  for (const entry of manifest.entries) {
    assert.equal(existsSync(resolve(root, entry.originalPath)), false, entry.originalPath);
    const source = `${manifest.baseline.commit}:${entry.originalPath}`;
    const blob = execFileSync("git", ["rev-parse", source], {
      cwd: root,
      encoding: "utf8"
    }).trim();
    const baselineBytes = execFileSync("git", ["show", source], {
      cwd: root,
      encoding: null
    });
    assert.equal(blob, entry.baselineBlobHash, entry.originalPath);
    assert.equal(
      createHash("sha256").update(baselineBytes).digest("hex"),
      entry.baselineSha256,
      entry.originalPath
    );
    if (entry.baselineBytes !== undefined) {
      assert.equal(baselineBytes.length, entry.baselineBytes, entry.originalPath);
    }
    assert.equal(entry.baselineCommit, manifest.baseline.commit, entry.originalPath);
    assert.equal(
      entry.restorationCommand,
      `git restore --source=${manifest.baseline.commit} -- '${entry.originalPath}'`,
      entry.originalPath
    );
    assert.deepEqual(entry.protectedEvidenceReferences, [
      `git:${manifest.baseline.commit}:${entry.originalPath}`
    ], entry.originalPath);
    assert.equal(
      entry.finalDisposition,
      "REMOVED_FROM_ACTIVE_MAIN_RECOVERABLE_VIA_GIT",
      entry.originalPath
    );
  }
  assert.equal(existsSync(resolve(root, "scripts/build-qualified-prospect-routes.mjs")), true);
  assert.equal(
    execFileSync("git", ["hash-object", "scripts/build-qualified-prospect-routes.mjs"], {
      cwd: root,
      encoding: "utf8"
    }).trim(),
    "d786fd7bfa6ceec2e408c618286446ce3bbc10a5"
  );
});

test("all surviving tracked text closes every retired path through live migration or exact evidence", () => {
  const manifest = readJson("overwatch/retirement/phase-1-retirement-manifest.json");
  const manifestPath = "overwatch/retirement/phase-1-retirement-manifest.json";
  const intentional = new Set(manifest.intentionalAbsenceEvidencePaths);
  const historical = new Map(manifest.historicalEvidenceFiles.map(item => [item.path, item]));
  assert.equal(historical.size, manifest.historicalEvidenceFiles.length);
  for (const evidence of historical.values()) {
    assert.equal(evidence.baselineCommit, manifest.baseline.commit, evidence.path);
    const baselineBlob = execFileSync("git", [
      "rev-parse",
      `${evidence.baselineCommit}:${evidence.path}`
    ], { cwd: root, encoding: "utf8" }).trim();
    const currentBlob = execFileSync("git", ["hash-object", evidence.path], {
      cwd: root,
      encoding: "utf8"
    }).trim();
    assert.equal(baselineBlob, evidence.baselineBlobHash, evidence.path);
    assert.equal(currentBlob, evidence.baselineBlobHash, evidence.path);
  }

  const actionable = [];
  for (const file of gitLines(["ls-files"])) {
    if (file === manifestPath || !existsSync(resolve(root, file))) continue;
    const bytes = readFileSync(resolve(root, file));
    if (bytes.includes(0)) continue;
    let source = bytes.toString("utf8");
    for (const entry of manifest.entries) {
      const escaped = entry.originalPath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const pinnedPattern = new RegExp(`git:([0-9a-f]{40}):${escaped}`, "gu");
      source = source.replace(pinnedPattern, (reference, commit) => {
        execFileSync("git", ["cat-file", "-e", `${commit}:${entry.originalPath}`], {
          cwd: root,
          stdio: "ignore"
        });
        return "";
      });
      if (
        source.includes(entry.originalPath)
        && !intentional.has(file)
        && !historical.has(file)
      ) actionable.push(`${file} -> ${entry.originalPath}`);
    }
  }
  assert.deepEqual(actionable, []);
});

test("the restored prospect route builder remains a bounded manual operational data tool", () => {
  const fixture = mkdtempSync(join(tmpdir(), "prometheus-route-builder-"));
  const input = join(fixture, "prospects.csv");
  const output = join(fixture, "route.json");
  const headers = [
    "business_name", "full_address", "notes", "source_type", "quality_status",
    "access_type", "recommendation_for_anthony", "rep_status",
    "estimated_distance_miles", "category"
  ];
  const categories = ["Auto", "Tire", "Car Wash", "Barber", "Salon", "Restaurant"];
  const rows = categories.map((category, index) => [
    `Synthetic Business ${index + 1}`,
    `${100 + index} Test Ave Example TX`,
    "synthetic fixture",
    "governed_fixture",
    "verified",
    "Walk-in ready",
    "yes",
    "Anthony unvisited",
    String(index + 1),
    category
  ]);
  rows.push([
    "Synthetic Placeholder", "999 Test Ave Example TX", "synthetic fixture",
    "placeholder", "placeholder", "Do not recommend", "no", "unassigned", "2", "Other Storefront"
  ]);
  try {
    writeFileSync(input, [headers, ...rows].map(row => row.join(",")).join("\n"), "utf8");
    const result = spawnSync(process.execPath, [
      resolve(root, "scripts/build-qualified-prospect-routes.mjs"), input, output
    ], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const route = JSON.parse(readFileSync(output, "utf8"));
    assert.equal(route.first_route_count, 6);
    assert.equal(route.backup_queue_count, 0);
    assert.equal(route.excluded_records, 1);
    assert.equal(new Set(route.first_route.map(record => record.category)).size, 6);
    const entrypoints = readJson("scripts/script-entrypoints.v1.json");
  assert.deepEqual(entrypoints.categories.manualOperationalDataTool, [
    "scripts/build-qualified-prospect-routes.mjs"
  ]);
  assert.deepEqual(entrypoints.generatedOperationalOutputs, {
    "scripts/build-route-intelligence-quality-engine.mjs": [
      "prometheus-route-intelligence-quality-report.md"
    ]
  });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("deferred dead-code cleanup preserves the verified rollback dependency graph", () => {
  const packageJson = readJson("package.json");
  assert.equal(packageJson.dependencies.gsap, "^3.13.0");
  assert.equal(existsSync(resolve(root, "landing.js")), true);
  assert.match(read("README.md"), /Deferred dead entrypoint:[\s\S]*successor rollback package/u);
});

test("repository integrity and dependency-update noise controls fail closed", () => {
  assert.equal(verifyPublicRepositoryIntegrity(root).status, "PUBLIC_REPOSITORY_INTEGRITY_VERIFIED");
  const dependabot = read(".github/dependabot.yml");
  assert.equal((dependabot.match(/applies-to: "version-updates"/gu) || []).length, 2);
  assert.equal((dependabot.match(/update-types:/gu) || []).length, 2);
  assert.doesNotMatch(dependabot, /^\s*- "security"$/mu);
  const packageJson = readJson("package.json");
  assert.equal(Object.hasOwn(packageJson.scripts, "pretest"), false);
  assert.ok(Object.keys(packageJson.scripts).length <= 50);
  assert.equal(packageJson.scripts.test, "npm run test:core && npm run test:public && npm run test:private && npm run test:security && npm run test:release");
});
