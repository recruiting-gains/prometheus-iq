import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const governance = JSON.parse(
  read("overwatch/governance/early-github-handoff-v1.json")
);
const agents = read("AGENTS.md");
const autoPush = read(
  "overwatch/governance/verified-engineering-batch-auto-push-v1.md"
);

assert.equal(governance.owner, "Prometheus Overwatch");
assert.equal(governance.inheritedByFutureRepositoryTasks, true);
assert.equal(governance.acceptedQualificationArchitectureReplaced, false);
assert.equal(governance.productionMutationAuthorized, false);
assert.match(agents, /^## Early GitHub Handoff — Mandatory When Routed$/mu);
assert.match(agents, /exact commit SHA, tree, and branch/u);
assert.match(autoPush, /^## Early GitHub Handoff$/mu);

process.stdout.write("OVERWATCH_EARLY_GITHUB_HANDOFF_V1_VERIFIED\n");
