import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { validateTestSuiteConfiguration } from "../scripts/run-test-suite.mjs";
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
  assert.equal(testResult.total, 144);
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

test("retired paths are absent and recoverable at their exact baseline blobs", () => {
  const manifest = readJson("overwatch/retirement/phase-1-retirement-manifest.json");
  assert.equal(manifest.baseline.commit, "c7119fcee140ab8a130cdb888439277fdcbeb6b0");
  assert.equal(manifest.entries.length, 202);
  assert.equal(new Set(manifest.entries.map(entry => entry.originalPath)).size, 202);
  for (const entry of manifest.entries) {
    assert.equal(existsSync(resolve(root, entry.originalPath)), false, entry.originalPath);
    const blob = execFileSync("git", [
      "rev-parse",
      `${manifest.baseline.commit}:${entry.originalPath}`
    ], { cwd: root, encoding: "utf8" }).trim();
    assert.equal(blob, entry.baselineBlobHash, entry.originalPath);
    assert.match(entry.restorationCommand, /^git restore --source=c7119f/u);
  }
});

test("active executables and tests contain no unresolved retired-path dependency", () => {
  const manifest = readJson("overwatch/retirement/phase-1-retirement-manifest.json");
  const suites = readJson("tests/test-suites.v1.json").suites;
  const scripts = readJson("scripts/script-entrypoints.v1.json").categories;
  const activeFiles = new Set([
    "README.md",
    "AGENTS.md",
    "PRODUCT_VISION.md",
    "docs/TEST_RELEASE_MAP.md",
    "package.json",
    ".github/dependabot.yml",
    ...retainedWorkflows,
    ...Object.entries(suites).filter(([name]) => name !== "historical").flatMap(([, files]) => files),
    ...Object.entries(scripts).filter(([name]) => name !== "historicalManual").flatMap(([, files]) => files)
  ]);
  for (const file of activeFiles) {
    if (file === "tests/lean-control-plane.test.mjs") continue;
    const source = read(file);
    for (const entry of manifest.entries) {
      assert.equal(source.includes(entry.originalPath), false, `${file} still references ${entry.originalPath}`);
    }
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
