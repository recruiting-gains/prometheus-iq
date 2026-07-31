import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");

const agents = read("AGENTS.md");
const workflow = read(".github/workflows/early-github-handoff-v1.yml");
const packageJson = JSON.parse(read("package.json"));
const runbook = read("docs/early-github-handoff-v1.md");
const autoPush = read("overwatch/governance/verified-engineering-batch-auto-push-v1.md");

assert.match(agents, /^## Early GitHub Handoff — Mandatory$/mu);
for (const required of [
  "Minimize how long the Founder’s Mac must remain connected.",
  "GITHUB HANDOFF CONFIRMED",
  "GITHUB DISPATCH ACCEPTED — RUN REGISTRATION PENDING",
  "FOUNDER MAY CLOSE LAPTOP",
  "LOCAL CONNECTION STILL REQUIRED"
]) assert.match(agents, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));

assert.match(workflow, /^on:\n  workflow_dispatch:\n    inputs:\n      candidate_commit:/mu);
assert.doesNotMatch(workflow, /^  (?:push|pull_request|schedule|repository_dispatch|workflow_call|workflow_run):/mu);
assert.match(workflow, /github\.sha == inputs\.candidate_commit/u);
assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
assert.match(workflow, /git rev-parse HEAD/u);
assert.match(workflow, /npm test/u);
assert.doesNotMatch(workflow, /environment:|CLOUDFLARE_|wrangler deploy|git push/u);

assert.equal(
  packageJson.scripts["overwatch:early-github-handoff:dispatch"],
  "node scripts/run-early-github-handoff-v1.mjs"
);
assert.match(workflow, /npm run overwatch:early-github-handoff:check/u);
assert.match(runbook, /exact commit SHA, branch, workflow identity, and dispatch timestamp/u);
assert.match(autoPush, /Early GitHub Handoff/u);

process.stdout.write("EARLY_GITHUB_HANDOFF_V1_VERIFIED\n");
