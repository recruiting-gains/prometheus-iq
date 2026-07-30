#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AUTONOMOUS_ENGINEERING_V1_POLICY,
  autonomousFullSuiteCommands
} from "./lib/github-hosted-autonomous-engineering-v1.mjs";
import {
  verifyGithubHostedAutonomousEngineeringV1
} from "./verify-github-hosted-autonomous-engineering-v1.mjs";

const root = resolve(import.meta.dirname, "..");
const governancePath =
  "overwatch/governance/github-hosted-autonomous-engineering-v1.json";
const documentationPath =
  "overwatch/governance/github-hosted-autonomous-engineering-v1.md";
const infrastructureIdentity =
  "Prometheus Infrastructure <infrastructure@prometheus.local>";

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function git(...argumentsList) {
  return execFileSync("git", argumentsList, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
}

function verifyCommit(record, expectedIdentity) {
  assert.equal(git("rev-parse", `${record.commit}^`), record.parent);
  assert.equal(git("rev-parse", `${record.commit}^{tree}`), record.tree);
  const metadata = git(
    "show",
    "-s",
    "--format=%an <%ae>%x00%cn <%ce>%x00%s",
    record.commit
  ).split("\0");
  assert.deepEqual(metadata, [
    expectedIdentity,
    expectedIdentity,
    record.subject
  ]);
}

export function verifyOverwatchGithubHostedAutonomousEngineeringV1() {
  const governance = JSON.parse(read(governancePath));
  const infrastructure = JSON.parse(read(
    AUTONOMOUS_ENGINEERING_V1_POLICY.contractPath
  ));
  const workflow = read(AUTONOMOUS_ENGINEERING_V1_POLICY.workflowPath);

  assert.equal(
    verifyGithubHostedAutonomousEngineeringV1().status,
    "GITHUB_HOSTED_AUTONOMOUS_ENGINEERING_V1_VERIFIED"
  );
  assert.equal(governance.owner, "Prometheus Overwatch");
  assert.equal(governance.status, "SOURCE_GOVERNED_DEMONSTRATION_PENDING");
  assert.equal(governance.baseline.commit, AUTONOMOUS_ENGINEERING_V1_POLICY.baselineCommit);
  assert.equal(governance.baseline.tree, AUTONOMOUS_ENGINEERING_V1_POLICY.baselineTree);
  verifyCommit(governance.ownership.implementationCommit, infrastructureIdentity);
  verifyCommit(
    governance.ownership.releaseWiringDelegationCommit,
    infrastructureIdentity
  );
  verifyCommit(governance.ownership.secretScanRepairCommit, infrastructureIdentity);
  verifyCommit(governance.ownership.securityClosureCommit, infrastructureIdentity);

  assert.deepEqual(
    Object.keys(governance.implementationHashes).sort(),
    [...AUTONOMOUS_ENGINEERING_V1_POLICY.infrastructureOwnedPaths].sort()
  );
  for (const [path, expected] of Object.entries(
    governance.implementationHashes
  )) {
    assert.equal(sha256(path), expected, `Infrastructure drift: ${path}`);
  }

  const controls = governance.acceptedControls;
  assert.equal(controls.maximumChangedFiles, infrastructure.boundedRepair.maximumChangedFiles);
  assert.equal(controls.maximumChangedLines, infrastructure.boundedRepair.maximumChangedLines);
  assert.equal(
    controls.maximumChangedPatchBytes,
    infrastructure.boundedRepair.maximumChangedPatchBytes
  );
  assert.equal(
    controls.maximumChangedFileBytes,
    infrastructure.boundedRepair.maximumChangedFileBytes
  );
  assert.equal(
    controls.maximumWallClockMinutes,
    infrastructure.workflow.maximumWallClockMinutes
  );
  assert.equal(
    controls.maximumRepairAttempts,
    infrastructure.boundedRepair.maximumRepairAttempts
  );
  assert.equal(controls.inRunTransientRecoveryAttempts, 1);
  assert.equal(controls.sourceOrTestRetryAllowed, false);
  assert.equal(controls.privateDeploymentAttempts, 1);
  assert.equal(controls.productionRollbackAttempts, 1);
  assert.equal(controls.mobileAcceptanceViewport, "390x844");
  assert.equal(controls.independentFinalEvidenceReplayRequired, true);
  assert.equal(controls.productionSecretsFirstJob, "production-baseline");
  assert.equal(controls.actionsPermission, "read");

  assert.equal(infrastructure.baseline.privateWorker, "prometheus-iq");
  assert.equal(
    infrastructure.baseline.publicWorker,
    "prometheusrouteiq-website"
  );
  assert.equal(infrastructure.deployment.publicTargetAllowed, false);
  assert.equal(governance.payloadContinuity.productChangeAllowed, false);
  assert.equal(
    governance.payloadContinuity.privateForwardPayloadSha256,
    "3bb6d677c4ad6b6811ba1efc1c643abd7728c584707a26dcef26c887f2718328"
  );

  assert.match(workflow, /^on:\n  workflow_dispatch:/mu);
  assert.doesNotMatch(
    workflow.slice(workflow.indexOf("on:\n"), workflow.indexOf("permissions:\n")),
    /push:|schedule:|workflow_call:|repository_dispatch:/u
  );
  assert.doesNotMatch(workflow, /contents:\s*write|git push|gh workflow run/u);
  assert.doesNotMatch(workflow, /actions:\s*write/u);
  assert.ok(
    workflow.indexOf("${{ secrets.")
      > workflow.indexOf("  verify-recovery:\n")
  );
  assert.equal(
    (workflow.match(/run: node scripts\/run-github-hosted-autonomous-engineering-v1\.mjs deploy/gu) || []).length,
    1
  );
  assert.equal(
    (workflow.match(/\$\{\{\s*secrets\.CLOUDFLARE_ACCESS_CLIENT_SECRET\s*\}\}/gu) || []).length,
    1
  );
  assert.equal(
    AUTONOMOUS_ENGINEERING_V1_POLICY.overwatchOwnedPaths.includes("package.json"),
    false
  );
  assert.equal(
    git(
      "rev-list",
      `${AUTONOMOUS_ENGINEERING_V1_POLICY.baselineCommit}..HEAD`,
      "--",
      "package.json"
    ),
    ""
  );
  assert.deepEqual(
    AUTONOMOUS_ENGINEERING_V1_POLICY.maximumRepairAttempts,
    3
  );
  assert.deepEqual(
    AUTONOMOUS_ENGINEERING_V1_POLICY.maximumChangedLines,
    6000
  );
  assert.deepEqual(
    AUTONOMOUS_ENGINEERING_V1_POLICY.maximumWallClockMinutes,
    210
  );
  assert.deepEqual(
    infrastructure.boundedRepair.commitTopology,
    {
      everySuccessorCommitHasExactlyOneApprovedOwner: true,
      repairAttemptEqualsInfrastructureCommitCountMinusOne: true,
      atLeastOneOverwatchCommitRequired: true,
      finalCommitOwner: "OVERWATCH",
      maximumInfrastructureRepairAttempt: 3,
      maximumSuccessorCommits: 6
    }
  );
  assert.deepEqual(
    AUTONOMOUS_ENGINEERING_V1_POLICY.maximumSuccessorCommits,
    6
  );
  assert.deepEqual(
    infrastructure.qualification.actionsPermission,
    "read"
  );
  assert.equal(
    infrastructure.qualification
      .productionSecretsFirstAvailableAfterQualificationArtifactRollbackAndRecoveryVerification,
    true
  );
  assert.equal(
    infrastructure.evidence
      .independentAcceptanceReverifiesDeploymentRollbackRecoveryAndProductionEvidence,
    true
  );
  assert.deepEqual(
    autonomousFullSuiteCommands.slice(-2).map(command => command.id),
    ["OVERWATCH_AUTONOMOUS_VERIFIER", "OVERWATCH_AUTONOMOUS_TESTS"]
  );

  assert.deepEqual(governance.protectedState, {
    collection: "OFF",
    activeCohortCount: 0,
    recommendationInfluence: "OFF",
    providerRefresh: "OFF",
    scheduler: "OFF",
    customerActivation: "OFF",
    anthonyMapped: false,
    activeBusinessCount: 0,
    reserveBusinessCount: 0,
    quarantinedBusinessCount: 398,
    crmReceipt: "riq_receipt_e74e57903a211291a9f1f37a",
    crmMutationAllowed: false
  });
  assert.equal(governance.securityBoundary.secretValuesAccessedDuringEngineering, false);
  assert.equal(governance.securityBoundary.artifactTokenAllowedInDeploymentChild, false);
  assert.equal(governance.securityBoundary.packageManifestChangedByProject, false);
  assert.equal(governance.releaseBoundary.publicDeploymentAuthorized, false);
  assert.equal(governance.releaseBoundary.demonstrationMustFinishBeforeAcceptance, true);

  return Object.freeze({
    status: "OVERWATCH_GITHUB_HOSTED_AUTONOMOUS_ENGINEERING_V1_VERIFIED"
  });
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  verifyOverwatchGithubHostedAutonomousEngineeringV1();
  process.stdout.write(
    "OVERWATCH_GITHUB_HOSTED_AUTONOMOUS_ENGINEERING_V1_VERIFIED\n"
  );
}
