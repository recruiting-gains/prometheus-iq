#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AUTONOMOUS_ENGINEERING_V1_POLICY,
  autonomousFullSuiteCommands,
  autonomousPathOwner,
  autonomousQualificationOutputNames
} from "./lib/github-hosted-autonomous-engineering-v1.mjs";

const root = resolve(import.meta.dirname, "..");
const JOBS = Object.freeze([
  "authorize",
  "qualify-primary",
  "qualify-recovery",
  "qualify",
  "reverify-and-demonstrate",
  "verify-recovery",
  "production-baseline",
  "deploy",
  "independent-acceptance"
]);
const SECRET_JOBS = Object.freeze({
  "production-baseline": Object.freeze([
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN"
  ]),
  deploy: Object.freeze([
    "CLOUDFLARE_ACCESS_CLIENT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_SECRET",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN",
    "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_AUDIENCE",
    "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_TEAM_DOMAIN"
  ]),
  "independent-acceptance": Object.freeze([
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN"
  ])
});

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function jobSection(workflow, job, nextJob) {
  const start = workflow.indexOf(`  ${job}:\n`);
  const end = nextJob
    ? workflow.indexOf(`  ${nextJob}:\n`, start + job.length + 3)
    : workflow.length;
  assert.ok(start >= 0 && end > start, `job section missing: ${job}`);
  return workflow.slice(start, end);
}

function stepSection(job, name) {
  const start = job.indexOf(`      - name: ${name}\n`);
  const end = job.indexOf("\n      - name:", start + name.length + 15);
  assert.ok(start >= 0, `step section missing: ${name}`);
  return job.slice(start, end < 0 ? job.length : end);
}

function parseWorkflow(path) {
  const result = spawnSync("ruby", [
    "-e",
    "require 'yaml'; YAML.safe_load(File.read(ARGV.fetch(0)), permitted_classes: [], permitted_symbols: [], aliases: false)",
    path
  ], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000
  });
  assert.equal(result.status, 0, `workflow YAML parse failed: ${result.stderr}`);
}

function assertImmediateIdentityGate(section, job) {
  const checkout = section.indexOf("uses: actions/checkout@");
  const clean = section.indexOf("clean: true", checkout);
  const gate = section.indexOf("- name: Gate exact checkout before repository code");
  const setup = section.indexOf("uses: actions/setup-node@", checkout);
  assert.ok(checkout >= 0 && clean > checkout, `${job} checkout missing`);
  assert.ok(gate > clean && setup > gate, `${job} identity gate ordering invalid`);
  const between = section.slice(clean + "clean: true".length, gate);
  assert.doesNotMatch(between, /^\s+- name:|^\s+run:/mu);
  const gateBody = section.slice(gate, setup);
  for (const exact of [
    'test "$(git rev-parse HEAD)" = "${{ inputs.candidate_commit }}"',
    'test "$(git rev-parse HEAD^{tree})" = "${{ inputs.candidate_tree }}"',
    'test "$(git rev-parse refs/remotes/origin/main)" = "${{ inputs.candidate_commit }}"'
  ]) {
    assert.ok(gateBody.includes(exact), `${job} gate missing ${exact}`);
  }
  assert.match(gateBody, /shell: bash/u);
  assert.match(gateBody, /set -eu/u);
}

function assertSecretSeparation(workflow) {
  for (const [index, job] of JOBS.entries()) {
    const section = jobSection(workflow, job, JOBS[index + 1]);
    const actual = [...new Set([...section.matchAll(
      /\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/gu
    )].map(match => match[1]))].sort();
    assert.deepEqual(actual, [...(SECRET_JOBS[job] || [])].sort(), job);
  }
}

function assertArtifactTokenSeparation(workflow) {
  assert.equal(count(
    workflow,
    /^          PROMETHEUS_GITHUB_TOKEN: \$\{\{ github\.token \}\}$/gmu
  ), 5);
  const expected = Object.freeze({
    "reverify-and-demonstrate": Object.freeze([
      "Independently verify metadata and every release identity",
      "Demonstrate one controlled non-product rollback"
    ]),
    "verify-recovery": Object.freeze([
      "Independently verify artifact, rollback evidence, and recovery"
    ]),
    deploy: Object.freeze([
      "Reverify every immutable identity before production access",
      "Reverify immutable artifact after successful deployment"
    ])
  });
  for (const [index, jobName] of JOBS.entries()) {
    const job = jobSection(workflow, jobName, JOBS[index + 1]);
    const jobHeader = job.slice(0, job.indexOf("    steps:\n"));
    assert.equal(jobHeader.includes("PROMETHEUS_GITHUB_TOKEN"), false, jobName);
    const permitted = expected[jobName] || [];
    for (const step of permitted) {
      assert.equal(
        count(stepSection(job, step), /PROMETHEUS_GITHUB_TOKEN/gu),
        1,
        `${jobName}: ${step}`
      );
    }
  }
  const deploy = jobSection(workflow, "deploy", "independent-acceptance");
  const production = stepSection(
    deploy,
    "Cross the private production boundary exactly once"
  );
  const credentialNames = [...production.matchAll(
    /\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/gu
  )].map(match => match[1]).sort();
  assert.deepEqual(credentialNames, [
    "CLOUDFLARE_ACCESS_CLIENT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_SECRET",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN",
    "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_AUDIENCE",
    "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_TEAM_DOMAIN"
  ]);
  assert.equal(production.includes("PROMETHEUS_GITHUB_TOKEN"), false);
  for (const name of [
    "Install exact locked tooling",
    "Finalize safe production evidence"
  ]) {
    assert.equal(
      stepSection(deploy, name).includes("PROMETHEUS_GITHUB_TOKEN"),
      false
    );
  }
}

export function assertGithubContextScopes(workflow) {
  const qualifiedReleaseSteps = Object.freeze({
    "reverify-and-demonstrate": Object.freeze([
      "Independently verify metadata and every release identity",
      "Demonstrate one controlled non-product rollback"
    ]),
    "verify-recovery": Object.freeze([
      "Independently verify artifact, rollback evidence, and recovery"
    ]),
    deploy: Object.freeze([
      "Reverify every immutable identity before production access",
      "Cross the private production boundary exactly once",
      "Reverify immutable artifact after successful deployment",
      "Finalize safe production evidence"
    ])
  });
  for (const [index, jobName] of JOBS.entries()) {
    const job = jobSection(workflow, jobName, JOBS[index + 1]);
    const stepsIndex = job.indexOf("    steps:\n");
    assert.ok(stepsIndex >= 0, `${jobName} steps missing`);
    assert.doesNotMatch(
      job.slice(0, stepsIndex),
      /\$\{\{\s*runner\./u,
      `${jobName} uses runner context before step scope`
    );
    for (const name of qualifiedReleaseSteps[jobName] || []) {
      assert.equal(
        count(
          stepSection(job, name),
          /PROMETHEUS_QUALIFIED_RELEASE_PATH: \$\{\{ runner\.temp \}\}\/prometheus-private-qualified-release/gu
        ),
        1,
        `${jobName}: ${name} must bind the release path at step scope`
      );
    }
  }
  assert.equal(
    count(
      workflow,
      /PROMETHEUS_QUALIFIED_RELEASE_PATH: \$\{\{ runner\.temp \}\}\/prometheus-private-qualified-release/gu
    ),
    7
  );
}

export function assertSkippedDependencyPropagation(workflow) {
  const requiredResults = Object.freeze({
    "reverify-and-demonstrate": Object.freeze(["qualify"]),
    "verify-recovery": Object.freeze([
      "qualify",
      "reverify-and-demonstrate"
    ]),
    "production-baseline": Object.freeze([
      "authorize",
      "verify-recovery"
    ]),
    deploy: Object.freeze([
      "qualify",
      "reverify-and-demonstrate",
      "verify-recovery",
      "production-baseline"
    ]),
    "independent-acceptance": Object.freeze([
      "reverify-and-demonstrate",
      "verify-recovery",
      "deploy"
    ])
  });
  for (const [jobName, dependencies] of Object.entries(requiredResults)) {
    const index = JOBS.indexOf(jobName);
    const job = jobSection(workflow, jobName, JOBS[index + 1]);
    const stepsIndex = job.indexOf("    steps:\n");
    assert.ok(stepsIndex >= 0, `${jobName} steps missing`);
    const header = job.slice(0, stepsIndex);
    assert.match(
      header,
      /if:[\s\S]*always\(\)/u,
      `${jobName} must override skipped-dependency propagation`
    );
    for (const dependency of dependencies) {
      assert.ok(
        header.includes(`needs.${dependency}.result == 'success'`),
        `${jobName} must require ${dependency} success`
      );
    }
  }
}

function assertLegacyLaneIsolation(workflow, contract) {
  const legacyPath = ".github/workflows/deploy-prometheus-private-worker.yml";
  const legacy = read(legacyPath);
  const baseline = spawnSync("git", [
    "show",
    `${AUTONOMOUS_ENGINEERING_V1_POLICY.baselineCommit}:${legacyPath}`
  ], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000
  });
  assert.equal(baseline.status, 0);
  assert.equal(legacy, baseline.stdout);
  assert.doesNotMatch(legacy, /workflow_call:|repository_dispatch:|schedule:|push:/u);
  assert.equal(workflow.includes(legacyPath), false);
  assert.equal(contract.inheritedLegacyLane.disabledByThisFeature, false);
  assert.equal(contract.inheritedLegacyLane.newLaneCanInvokeLegacyLane, false);
  assert.equal(contract.inheritedLegacyLane.newLaneCanSelfDispatch, false);
}

export function verifyGithubHostedAutonomousEngineeringV1() {
  for (const path of AUTONOMOUS_ENGINEERING_V1_POLICY.infrastructureOwnedPaths) {
    assert.equal(existsSync(resolve(root, path)), true, `${path} must exist`);
  }
  const workflowPath = resolve(root, AUTONOMOUS_ENGINEERING_V1_POLICY.workflowPath);
  const workflow = read(AUTONOMOUS_ENGINEERING_V1_POLICY.workflowPath);
  const contract = JSON.parse(read(AUTONOMOUS_ENGINEERING_V1_POLICY.contractPath));
  const library = read(AUTONOMOUS_ENGINEERING_V1_POLICY.libraryPath);
  const runner = read(AUTONOMOUS_ENGINEERING_V1_POLICY.runnerPath);
  const documentation = read(
    AUTONOMOUS_ENGINEERING_V1_POLICY.documentationPath
  );

  parseWorkflow(workflowPath);
  assert.doesNotMatch(workflow, /(?:^|\s)<<:|(?:^|\s)[&*][A-Za-z0-9_-]+/mu);
  assert.match(
    workflow,
    /^name: Prometheus GitHub-Hosted Autonomous Engineering v1$/mu
  );
  const trigger = workflow.slice(
    workflow.indexOf("on:\n"),
    workflow.indexOf("permissions:\n")
  );
  assert.deepEqual(
    [...trigger.matchAll(/^  ([a-z_]+):$/gmu)].map(match => match[1]),
    ["workflow_dispatch"]
  );
  for (const forbidden of [
    "push:",
    "pull_request:",
    "schedule:",
    "repository_dispatch:",
    "workflow_call:"
  ]) {
    assert.equal(trigger.includes(forbidden), false);
  }
  assert.match(workflow, /^permissions:\n  contents: read$/mu);
  assert.doesNotMatch(workflow, /contents:\s*write/u);
  assert.doesNotMatch(workflow, /git push|gh workflow run|createWorkflowDispatch/u);
  assert.match(workflow, /cancel-in-progress: false/u);
  assert.equal(
    count(workflow.slice(workflow.indexOf("jobs:\n")), /^  [a-z][a-z-]+:$/gmu),
    JOBS.length
  );

  for (const [index, job] of JOBS.entries()) {
    assertImmediateIdentityGate(
      jobSection(workflow, job, JOBS[index + 1]),
      job
    );
  }
  const timeouts = [...workflow.matchAll(
    /^    timeout-minutes: ([0-9]+)$/gmu
  )].map(match => Number(match[1]));
  assert.equal(timeouts.length, JOBS.length);
  assert.equal(
    timeouts.reduce((sum, value) => sum + value, 0),
    AUTONOMOUS_ENGINEERING_V1_POLICY.maximumWallClockMinutes
  );
  assert.equal(contract.workflow.maximumWallClockMinutes, 210);
  assert.equal(contract.workflow.runnerContextAllowedAtJobLevel, false);
  assert.equal(contract.workflow.runnerTemporaryPathsBoundAtStepScope, true);
  assert.equal(
    contract.workflow.optionalRecoverySkipPropagationGuard,
    "always_with_explicit_required_result_checks"
  );
  assert.deepEqual(contract.hostedValidationEvidence, {
    qualificationOnlyRunId: 30576383131,
    primaryQualificationArtifactId: 8773054778,
    primaryQualificationArtifactZipSha256:
      "3ab7f7ef4e5d0cee7aafb645e4462c4b9eb40d622f93b06bb60b60158f2fdfcd",
    failureClassification: "OPTIONAL_RECOVERY_SKIP_PROPAGATED",
    downstreamJobsSkipped: [
      "reverify-and-demonstrate",
      "verify-recovery",
      "production-baseline",
      "deploy",
      "independent-acceptance"
    ],
    productionSecretsAccessed: false,
    productionMutationPerformed: false,
    rollbackDemonstrationFailure: {
      runId: 30579529085,
      artifactId: 8774247708,
      artifactZipSha256:
        "fdb9f1f8d4a127b6dd2049d54891bf2a1a6b5fe837061064d1babc2acc5f4cef",
      artifactContentTreeSha256:
        "bf9b5672c8e3240b5cd6f847ee748d7fabc3df0a28637c397f3bad5969d77ddb",
      qualifiedManifestSha256:
        "aba452673344c19e0389db9b6131d980d7a4acb430e0500857351032c0f81d88",
      forwardPayloadSha256:
        "3bb6d677c4ad6b6811ba1efc1c643abd7728c584707a26dcef26c887f2718328",
      deploymentAssetsSha256:
        "225a1e09cdf74570211070a704700eb4c720e563164dfb8b0988d11e5bbb5769",
      workflowContractSha256:
        "a905d83aec0511ee8b8faa2859e7f8147ee9f13b5cc1214ef233e5179365263d",
      rollbackContractSha256:
        "85d7cb58c1502961d691c60fc0e9f35ecd9bc3aa8f6914fd739c2a32e8c36134",
      rollbackBundleSha256:
        "efdb20005ee5b11c32f1714c3c3a35bdb1d4ab05349415a991743be0dfc57637",
      autonomousContractSha256:
        "72956bab27f205f58f93351efcbc6b53a97d6f753429df0fa36a9c392950cb09",
      artifactVerificationPassed: true,
      failureClassification: "AUTONOMOUS_TO_PRIVATE_INPUT_SHAPE_MISMATCH",
      wranglerProcessStarted: false,
      productionSecretsAccessed: false,
      productionMutationPerformed: false
    }
  });

  assertSecretSeparation(workflow);
  assertArtifactTokenSeparation(workflow);
  assertGithubContextScopes(workflow);
  assertSkippedDependencyPropagation(workflow);
  assert.ok(
    workflow.indexOf("${{ secrets.")
      > workflow.indexOf("  verify-recovery:\n")
  );
  assert.doesNotMatch(workflow, /actions:\s*write/u);
  assert.equal(count(workflow, /^\s+actions: read$/gmu), 6);
  const productionBaseline = jobSection(
    workflow,
    "production-baseline",
    "deploy"
  );
  assert.match(productionBaseline, /- verify-recovery/u);
  const primary = jobSection(workflow, "qualify-primary", "qualify-recovery");
  assert.match(primary, /^    needs: authorize$/mu);
  assert.equal(primary.includes("production-baseline"), false);
  const selector = jobSection(workflow, "qualify", "reverify-and-demonstrate");
  assert.match(selector, /- authorize/u);
  assert.equal(selector.includes("production-baseline"), false);
  const deploy = jobSection(workflow, "deploy", "independent-acceptance");
  assert.match(deploy, /- production-baseline/u);
  assert.match(
    deploy,
    /deployment_outcome_sha256: \$\{\{ steps\.production\.outputs\.deployment_outcome_sha256 \}\}/u
  );
  assert.equal(
    count(
      workflow,
      /run: node scripts\/run-github-hosted-autonomous-engineering-v1\.mjs full-suite/gmu
    ),
    2
  );
  assert.equal(
    count(
      workflow,
      /run: node scripts\/run-github-hosted-autonomous-engineering-v1\.mjs deploy/gmu
    ),
    1
  );
  assert.equal(
    count(
      workflow,
      /run: node scripts\/run-github-hosted-autonomous-engineering-v1\.mjs rollback-demo/gmu
    ),
    1
  );
  assert.equal(
    count(
      workflow,
      /run: node scripts\/run-github-hosted-autonomous-engineering-v1\.mjs verify-recovery/gmu
    ),
    1
  );
  assert.match(workflow, /needs\.qualify-primary\.outputs\.suite_status == 'TRANSIENT_FAILURE'/u);
  assert.match(workflow, /test "\$SUITE_STATUS" = "PASSED"/u);
  assert.match(workflow, /PROMETHEUS_RECOVERY_JOB_RESULT: \$\{\{ needs\.qualify-recovery\.result \}\}/u);
  assert.match(workflow, /PROMETHEUS_SELECTED_QUALIFICATION: \$\{\{ needs\.qualify\.outputs\.selected_qualification \}\}/u);
  assert.match(workflow, /PROMETHEUS_IN_RUN_RECOVERY_ATTEMPTS: \$\{\{ needs\.qualify\.outputs\.in_run_recovery_attempts \}\}/u);
  for (const output of autonomousQualificationOutputNames) {
    assert.ok(
      workflow.includes(
        `      ${output}: \${{ steps.select.outputs.${output} }}`
      ),
      `selector output missing: ${output}`
    );
  }
  assert.ok(
    workflow.includes(
      "PROMETHEUS_QUALIFICATION_RUN_ID: ${{ github.run_id }}"
    )
  );
  assert.match(
    library,
    /PROMETHEUS_QUALIFICATION_RUN_ID\s*!==\s*environment\.GITHUB_RUN_ID/u
  );
  assert.match(workflow, /artifact-ids: \$\{\{ needs\.qualify\.outputs\.qualification_artifact_id \}\}/u);
  assert.match(workflow, /run-id: \$\{\{ github\.run_id \}\}/u);

  assert.equal(contract.boundedRepair.maximumChangedFiles, 16);
  assert.equal(autonomousPathOwner("package.json"), null);
  assert.deepEqual(
    contract.boundedRepair.overwatchOwnedPaths,
    AUTONOMOUS_ENGINEERING_V1_POLICY.overwatchOwnedPaths
  );
  assert.equal(contract.boundedRepair.maximumChangedLines, 6000);
  assert.equal(contract.boundedRepair.maximumChangedPatchBytes, 524288);
  assert.equal(contract.boundedRepair.maximumChangedFileBytes, 524288);
  assert.equal(contract.boundedRepair.maximumInRunTransientRecoveryAttempts, 1);
  assert.equal(contract.boundedRepair.maximumRepairAttempts, 6);
  assert.equal(contract.boundedRepair.maximumSuccessorCommits, 11);
  assert.equal(
    contract.boundedRepair.commitTopology
      .repairAttemptEqualsInfrastructureCommitCountMinusOne,
    true
  );
  assert.equal(
    contract.boundedRepair.ownerIdentityStringsAreProvenanceLabelsOnly,
    true
  );
  assert.equal(contract.boundedRepair.maximumWorkflowRecursionDepth, 0);
  assert.equal(contract.boundedRepair.automaticSourceEditsAllowed, false);
  assert.equal(contract.boundedRepair.isolatedRetryMayEstablishAcceptance, false);
  assert.match(
    workflow,
    /repair attempt \(0, 1, 2, 3, 4, 5, or 6\)/u
  );
  assert.match(
    library,
    /approvedCommit:\s*inputs\.candidateCommit[\s\S]*approvedTree:\s*inputs\.candidateTree/u
  );
  assert.doesNotMatch(
    library,
    /buildQualifiedPrivateWranglerInvocation\(\s*"rollback",\s*inputs,/u
  );
  assert.equal(
    contract.qualification.artifactMetadataGithubTokenScope,
    "metadata_verification_steps_only"
  );
  assert.equal(contract.qualification.installReceivesArtifactToken, false);
  assert.equal(contract.qualification.fullSuiteReceivesArtifactToken, false);
  assert.equal(
    contract.qualification.deploymentProcessReceivesArtifactToken,
    false
  );
  assert.equal(contract.qualification.finalizationReceivesArtifactToken, false);
  assert.equal(contract.qualification.actionsPermission, "read");
  assert.equal(
    contract.qualification
      .productionSecretsFirstAvailableAfterQualificationArtifactRollbackAndRecoveryVerification,
    true
  );
  assert.deepEqual(
    autonomousFullSuiteCommands.slice(-2).map(command => command.id),
    ["OVERWATCH_AUTONOMOUS_VERIFIER", "OVERWATCH_AUTONOMOUS_TESTS"]
  );
  assert.deepEqual(
    autonomousFullSuiteCommands.slice(0, 2).map(command =>
      command.transientClassification),
    ["DEPENDENCY_TRANSPORT_TRANSIENT", "AUDIT_TRANSPORT_TRANSIENT"]
  );
  assert.ok(autonomousFullSuiteCommands.slice(2).every(command =>
    command.transientClassification === null));
  for (const source of [library, documentation]) {
    assert.match(source, /source|test/iu);
    assert.match(source, /fail|stops?/iu);
  }
  assertLegacyLaneIsolation(workflow, contract);

  assert.match(workflow, /name: prometheus-private-worker-production/u);
  assert.doesNotMatch(workflow, /environment:\n\s+name: .*public/u);
  assert.doesNotMatch(workflow, /wrangler(?:\.js)?\s+deploy/u);
  assert.doesNotMatch(workflow, /prometheusrouteiq-website.*deploy/iu);
  assert.equal(
    contract.deployment.authenticatedMobileAcceptanceViewport,
    "390x844"
  );
  assert.match(documentation, /authenticated.*390x844|390x844.*acceptance/isu);
  assert.match(workflow, /if: \$\{\{ steps\.production\.outcome == 'success' \}\}/u);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/u);
  const independent = jobSection(
    workflow,
    "independent-acceptance",
    undefined
  );
  assert.match(independent, /- reverify-and-demonstrate/u);
  assert.match(independent, /- verify-recovery/u);
  for (const artifact of [
    "production evidence",
    "rollback demonstration evidence",
    "recovery verification evidence"
  ]) {
    assert.ok(independent.includes(`Download only this run's ${artifact}`));
  }
  for (const name of [
    "PROMETHEUS_AUTONOMOUS_DEPLOYMENT_OUTCOME_PATH",
    "PROMETHEUS_AUTONOMOUS_ROLLBACK_EVIDENCE_PATH",
    "PROMETHEUS_AUTONOMOUS_RECOVERY_EVIDENCE_PATH",
    "PROMETHEUS_AUTONOMOUS_PRODUCTION_EVIDENCE_PATH"
  ]) {
    assert.ok(independent.includes(name));
  }
  assert.match(runner, /"full-suite"/u);
  assert.match(runner, /"select-qualification"/u);

  return Object.freeze({
    status: "GITHUB_HOSTED_AUTONOMOUS_ENGINEERING_V1_VERIFIED"
  });
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  verifyGithubHostedAutonomousEngineeringV1();
  process.stdout.write("GITHUB_HOSTED_AUTONOMOUS_ENGINEERING_V1_VERIFIED\n");
}
