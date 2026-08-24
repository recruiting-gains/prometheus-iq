import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");

const agents = read("AGENTS.md");
const workflow = read(".github/workflows/early-github-handoff-v1.yml");
const runbook = read("docs/early-github-handoff-v1.md");
const autoPush = read("overwatch/governance/verified-engineering-batch-auto-push-v1.md");
const packageJson = JSON.parse(read("package.json"));
const testSuites = JSON.parse(read("tests/test-suites.v1.json"));

assert.match(agents, /^## Early GitHub Handoff — Mandatory When Routed$/mu);
for (const required of [
  "Minimize how long the Founder’s Mac must remain connected.",
  "GITHUB HANDOFF CONFIRMED",
  "GITHUB DISPATCH ACCEPTED — RUN REGISTRATION PENDING",
  "FOUNDER MAY CLOSE LAPTOP",
  "LOCAL CONNECTION STILL REQUIRED"
]) assert.match(agents, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));

assert.match(workflow, /^on:\n  workflow_dispatch:\n    inputs:\n      candidate_commit:/mu);
assert.match(workflow, /candidate_tree:/u);
assert.doesNotMatch(workflow, /^  (?:push|pull_request|schedule|repository_dispatch|workflow_call|workflow_run):/mu);
assert.match(workflow, /github\.sha == inputs\.candidate_commit/u);
assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
assert.match(workflow, /git rev-parse HEAD/u);
assert.match(workflow, /git rev-parse HEAD\^\{tree\}/u);
assert.match(workflow, /npm test/u);
assert.doesNotMatch(workflow, /environment:|CLOUDFLARE_|wrangler deploy|git push/u);

assert.match(workflow, /node scripts\/verify-early-github-handoff-v1\.mjs/u);
assert.match(workflow, /node scripts\/verify-overwatch-early-github-handoff-v1\.mjs/u);
assert.doesNotMatch(workflow, /node --test tests\/early-github-handoff-v1\.test\.mjs/u);
assert.equal(
  testSuites.suites.release.filter(path => path === "tests/early-github-handoff-v1.test.mjs").length,
  1,
  "The Early GitHub Handoff regression test must be routed exactly once through test:release."
);
for (const [suite, paths] of Object.entries(testSuites.suites)) {
  if (suite === "release") continue;
  assert.equal(
    paths.includes("tests/early-github-handoff-v1.test.mjs"),
    false,
    `The Early GitHub Handoff regression test is duplicated in test:${suite}.`
  );
}
assert.match(packageJson.scripts.test, /npm run test:release/u);
assert.equal(packageJson.scripts["test:release"], "node scripts/run-test-suite.mjs release");
assert.match(runbook, /exact commit SHA, branch, workflow identity, and\s+dispatch timestamp/u);
assert.match(runbook, /`candidate_commit`/u);
assert.match(runbook, /`candidate_tree`/u);
assert.match(autoPush, /Early GitHub Handoff/u);

process.stdout.write("EARLY_GITHUB_HANDOFF_V1_VERIFIED\n");
