import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  AUTONOMOUS_ENGINEERING_V1_POLICY,
  autonomousFullSuiteCommands
} from "../scripts/lib/github-hosted-autonomous-engineering-v1.mjs";
import {
  verifyOverwatchGithubHostedAutonomousEngineeringV1
} from "../scripts/verify-overwatch-github-hosted-autonomous-engineering-v1.mjs";

const root = resolve(import.meta.dirname, "..");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("Overwatch accepts the exact Infrastructure implementation and wiring", () => {
  assert.equal(
    verifyOverwatchGithubHostedAutonomousEngineeringV1().status,
    "OVERWATCH_GITHUB_HOSTED_AUTONOMOUS_ENGINEERING_V1_VERIFIED"
  );
});

test("the hosted full suite executes both owner and Overwatch gates", () => {
  assert.deepEqual(
    autonomousFullSuiteCommands.slice(0, 3).map(command => command.id),
    [
      "DEPENDENCY_INSTALL",
      "PRODUCTION_DEPENDENCY_AUDIT",
      "FULL_REPOSITORY_TEST"
    ]
  );
  assert.equal(
    autonomousFullSuiteCommands.filter(command =>
      command.id === "FULL_REPOSITORY_TEST").length,
    1
  );
  assert.deepEqual(
    autonomousFullSuiteCommands.slice(-2).map(command => command.id),
    ["OVERWATCH_AUTONOMOUS_VERIFIER", "OVERWATCH_AUTONOMOUS_TESTS"]
  );
});

test("no product, public site, customer data, or activation path is admitted", () => {
  const allowed = [
    ...AUTONOMOUS_ENGINEERING_V1_POLICY.infrastructureOwnedPaths,
    ...AUTONOMOUS_ENGINEERING_V1_POLICY.overwatchOwnedPaths
  ];
  const forbiddenPrefixes = [
    "src/",
    "dashboard/",
    "data/",
    "crm/",
    "intelligence/",
    "administration/",
    "public/",
    "dist/",
    "migrations/"
  ];
  assert.ok(allowed.every(path =>
    forbiddenPrefixes.every(prefix => !path.startsWith(prefix))
  ));
  assert.equal(allowed.includes("wrangler.jsonc"), false);
  assert.equal(allowed.includes("package-lock.json"), false);
  assert.equal(allowed.includes("package.json"), false);
});

test("secret-bearing steps remain narrow and evidence remains nonsecret", () => {
  const workflow = read(
    ".github/workflows/github-hosted-autonomous-engineering-v1.yml"
  );
  const githubTokenUses = workflow.match(
    /PROMETHEUS_GITHUB_TOKEN: \$\{\{ github\.token \}\}/gu
  ) || [];
  assert.equal(githubTokenUses.length, 5);
  assert.equal(
    (workflow.match(/\$\{\{\s*secrets\.CLOUDFLARE_API_TOKEN\s*\}\}/gu) || []).length,
    4
  );
  assert.doesNotMatch(workflow, /echo .*(?:TOKEN|SECRET)|set -x/iu);
  assert.doesNotMatch(workflow, /actions:\s*write/u);
  assert.ok(
    workflow.indexOf("${{ secrets.")
      > workflow.indexOf("  verify-recovery:\n")
  );
  const independentAcceptance = workflow.slice(
    workflow.indexOf("  independent-acceptance:\n")
  );
  for (const evidencePath of [
    "PROMETHEUS_AUTONOMOUS_DEPLOYMENT_OUTCOME_PATH",
    "PROMETHEUS_AUTONOMOUS_ROLLBACK_EVIDENCE_PATH",
    "PROMETHEUS_AUTONOMOUS_RECOVERY_EVIDENCE_PATH",
    "PROMETHEUS_AUTONOMOUS_PRODUCTION_EVIDENCE_PATH"
  ]) {
    assert.ok(independentAcceptance.includes(evidencePath));
  }
  const governance = JSON.parse(read(
    "overwatch/governance/github-hosted-autonomous-engineering-v1.json"
  ));
  assert.equal(
    governance.securityBoundary.secretValuesAllowedInSourceLogsOrArtifacts,
    false
  );
  assert.equal(governance.securityBoundary.newMachinePrincipalRequired, false);
  assert.equal(governance.securityBoundary.qualificationReceivesProductionSecrets, false);
  assert.equal(governance.acceptedControls.maximumRepairAttempts, 4);
  assert.equal(governance.acceptedControls.maximumSuccessorCommits, 7);
  assert.equal(governance.acceptedControls.runnerContextAllowedAtJobLevel, false);
  assert.equal(
    governance.acceptedControls.runnerTemporaryPathsBoundAtStepScope,
    true
  );
  assert.equal(governance.acceptedControls.maximumWallClockMinutes, 210);
});

test("acceptance stays pending until hosted deployment evidence passes", () => {
  const governance = JSON.parse(read(
    "overwatch/governance/github-hosted-autonomous-engineering-v1.json"
  ));
  assert.equal(governance.status, "SOURCE_GOVERNED_DEMONSTRATION_PENDING");
  assert.equal(governance.releaseBoundary.productionMutationPerformedAtGovernanceCreation, false);
  assert.equal(governance.releaseBoundary.demonstrationMustFinishBeforeAcceptance, true);
  assert.equal(governance.protectedState.collection, "OFF");
  assert.equal(governance.protectedState.activeCohortCount, 0);
  assert.equal(governance.protectedState.recommendationInfluence, "OFF");
});
