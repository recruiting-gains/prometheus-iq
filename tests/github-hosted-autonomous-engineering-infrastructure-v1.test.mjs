import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  AUTONOMOUS_ENGINEERING_V1_FAILURE,
  AUTONOMOUS_ENGINEERING_V1_POLICY,
  AutonomousEngineeringV1Error,
  autonomousFullSuiteCommands,
  autonomousQualificationOutputNames,
  autonomousRollbackPhases,
  demonstrateControlledRollbackLifecycle,
  runAutonomousDeployment,
  runAutonomousFullSuite,
  selectAutonomousQualification,
  validateAutonomousArtifactRunContext,
  validateAutonomousDiffShape,
  validateAutonomousEngineeringV1Context,
  validateAutonomousFilesystemPaths,
  validateAutonomousRepairScope
} from "../scripts/lib/github-hosted-autonomous-engineering-v1.mjs";
import {
  verifyGithubHostedAutonomousEngineeringV1
} from "../scripts/verify-github-hosted-autonomous-engineering-v1.mjs";

const root = resolve(import.meta.dirname, "..");
const commit = "a".repeat(40);
const tree = "b".repeat(40);
const publicVersion = "11111111-1111-4111-8111-111111111111";
const privateVersion = "22222222-2222-4222-8222-222222222222";

function contextEnvironment(overrides = {}) {
  const dispatch = {
    candidate_commit: commit,
    candidate_tree: tree,
    batch_id: "BATCH-20260730-001",
    current_public_version: publicVersion,
    current_private_version: privateVersion,
    repair_attempt: "1",
    founder_authorization:
      AUTONOMOUS_ENGINEERING_V1_POLICY.founderAuthorization
  };
  return {
    PROMETHEUS_CANDIDATE_COMMIT: dispatch.candidate_commit,
    PROMETHEUS_CANDIDATE_TREE: dispatch.candidate_tree,
    PROMETHEUS_BATCH_ID: dispatch.batch_id,
    PROMETHEUS_CURRENT_PUBLIC_VERSION: dispatch.current_public_version,
    PROMETHEUS_CURRENT_PRIVATE_VERSION: dispatch.current_private_version,
    PROMETHEUS_REPAIR_ATTEMPT: dispatch.repair_attempt,
    PROMETHEUS_FOUNDER_AUTHORIZATION: dispatch.founder_authorization,
    PROMETHEUS_AUTONOMOUS_DISPATCH_INPUTS_JSON: JSON.stringify(dispatch),
    GITHUB_REPOSITORY: AUTONOMOUS_ENGINEERING_V1_POLICY.repository,
    GITHUB_REF: AUTONOMOUS_ENGINEERING_V1_POLICY.ref,
    GITHUB_REF_NAME: AUTONOMOUS_ENGINEERING_V1_POLICY.branch,
    GITHUB_REF_TYPE: AUTONOMOUS_ENGINEERING_V1_POLICY.refType,
    GITHUB_EVENT_NAME: AUTONOMOUS_ENGINEERING_V1_POLICY.eventName,
    GITHUB_SHA: commit,
    GITHUB_ACTOR: AUTONOMOUS_ENGINEERING_V1_POLICY.founderActor,
    GITHUB_TRIGGERING_ACTOR:
      AUTONOMOUS_ENGINEERING_V1_POLICY.founderActor,
    GITHUB_WORKFLOW: AUTONOMOUS_ENGINEERING_V1_POLICY.workflowName,
    GITHUB_WORKFLOW_REF: AUTONOMOUS_ENGINEERING_V1_POLICY.workflowRef,
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_RUN_ID: "40000000001",
    ...overrides
  };
}

function temporaryOutput(environment = contextEnvironment()) {
  const directory = mkdtempSync(join(tmpdir(), "autonomous-output-"));
  return {
    directory,
    environment: {
      ...environment,
      GITHUB_OUTPUT: join(directory, "output")
    }
  };
}

function expectFailure(fn, code) {
  assert.throws(fn, error =>
    error instanceof AutonomousEngineeringV1Error && error.code === code);
}

function outputValues(path) {
  return Object.fromEntries(
    readFileSync(path, "ascii").trim().split("\n").map(line => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
  );
}

function qualificationValues(prefix, seed) {
  const values = {};
  for (const [index, name] of autonomousQualificationOutputNames.entries()) {
    values[`${prefix}_${name.toUpperCase()}`] = name
      === "qualification_artifact_id"
      ? String(8500000000 + seed)
      : String((index + seed) % 10).repeat(64);
  }
  return values;
}

function deploymentEnvironment(directory, overrides = {}) {
  return contextEnvironment({
    GITHUB_OUTPUT: join(directory, "deployment-output"),
    PROMETHEUS_AUTONOMOUS_DEPLOYMENT_OUTCOME_PATH:
      join(directory, "deployment-outcome"),
    PROMETHEUS_QUALIFICATION_RUN_ID: "40000000001",
    PROMETHEUS_QUALIFICATION_ARTIFACT_ID: "8500000001",
    PROMETHEUS_QUALIFICATION_ARTIFACT_ZIP_SHA256: "1".repeat(64),
    PROMETHEUS_QUALIFIED_CONTENT_TREE_SHA256: "2".repeat(64),
    PROMETHEUS_QUALIFIED_MANIFEST_SHA256: "3".repeat(64),
    PROMETHEUS_FORWARD_PAYLOAD_SHA256: "4".repeat(64),
    PROMETHEUS_DEPLOYMENT_ASSETS_SHA256: "5".repeat(64),
    PROMETHEUS_ROLLBACK_CONTRACT_SHA256: "6".repeat(64),
    PROMETHEUS_ROLLBACK_BUNDLE_SHA256: "7".repeat(64),
    PROMETHEUS_WORKFLOW_CONTRACT_SHA256: "8".repeat(64),
    PROMETHEUS_AUTONOMOUS_CONTRACT_SHA256: "9".repeat(64),
    PROMETHEUS_SELECTED_QUALIFICATION: "PRIMARY",
    PROMETHEUS_IN_RUN_RECOVERY_ATTEMPTS: "0",
    CLOUDFLARE_API_TOKEN: "synthetic-api-token",
    CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
    CLOUDFLARE_ACCESS_CLIENT_ID: "synthetic-client-id",
    CLOUDFLARE_ACCESS_CLIENT_SECRET: "synthetic-client-secret",
    PROMETHEUS_UNATTENDED_SMOKE_ACCESS_TEAM_DOMAIN: "example.cloudflareaccess.com",
    PROMETHEUS_UNATTENDED_SMOKE_ACCESS_AUDIENCE: "b".repeat(64),
    ...overrides
  });
}

test("static workflow, contract, YAML, timeout, secret, and wiring verification passes", () => {
  assert.equal(
    verifyGithubHostedAutonomousEngineeringV1().status,
    "GITHUB_HOSTED_AUTONOMOUS_ENGINEERING_V1_VERIFIED"
  );
});

test("outer workflow context pins workflow, branch, Founder, and first attempt", () => {
  assert.equal(
    validateAutonomousEngineeringV1Context(contextEnvironment()).candidateTree,
    tree
  );
  for (const override of [
    { GITHUB_ACTOR: "someone-else" },
    { GITHUB_TRIGGERING_ACTOR: "someone-else" },
    { GITHUB_REF: "refs/heads/release" },
    { GITHUB_WORKFLOW: "Deploy Prometheus Private Worker v2" },
    { GITHUB_RUN_ATTEMPT: "2" }
  ]) {
    expectFailure(
      () => validateAutonomousEngineeringV1Context(
        contextEnvironment(override)
      ),
      AUTONOMOUS_ENGINEERING_V1_FAILURE.CONTEXT_INVALID
    );
  }
});

test("artifact wrapper requires this exact current workflow run", () => {
  const environment = contextEnvironment({
    PROMETHEUS_QUALIFICATION_RUN_ID: "40000000001"
  });
  assert.equal(
    validateAutonomousArtifactRunContext(environment).qualificationRunId,
    environment.GITHUB_RUN_ID
  );
  for (const override of [
    { PROMETHEUS_QUALIFICATION_RUN_ID: "40000000002" },
    { PROMETHEUS_QUALIFICATION_RUN_ID: "" },
    { GITHUB_ACTOR: "other" },
    { GITHUB_RUN_ATTEMPT: "2" }
  ]) {
    expectFailure(
      () => validateAutonomousArtifactRunContext({
        ...environment,
        ...override
      }),
      override.GITHUB_ACTOR || override.GITHUB_RUN_ATTEMPT
        ? AUTONOMOUS_ENGINEERING_V1_FAILURE.CONTEXT_INVALID
        : AUTONOMOUS_ENGINEERING_V1_FAILURE.ARTIFACT_INVALID
    );
  }
});

test("complete suite is deterministic, secret-free, and contains one build owner", () => {
  const output = temporaryOutput(contextEnvironment({
    CLOUDFLARE_API_TOKEN: "",
    CLOUDFLARE_ACCOUNT_ID: "",
    SYNTHETIC_SECRET: "must-not-propagate"
  }));
  const invocations = [];
  try {
    const result = runAutonomousFullSuite({
      root,
      environment: output.environment,
      spawnImpl(command, argumentsList, options) {
        invocations.push({ command, argumentsList, options });
        assert.equal("SYNTHETIC_SECRET" in options.env, false);
        assert.equal("PROMETHEUS_FOUNDER_AUTHORIZATION" in options.env, false);
        return { status: 0, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
      }
    });
    assert.equal(result.suiteStatus, "PASSED");
    assert.equal(invocations.length, autonomousFullSuiteCommands.length);
    assert.deepEqual(
      invocations.map(item => [item.command, ...item.argumentsList]),
      autonomousFullSuiteCommands.map(item => [
        item.command,
        ...item.argumentsList
      ])
    );
    assert.equal(
      invocations.filter(item =>
        item.command === "npm" && item.argumentsList[0] === "test").length,
      1
    );
    assert.deepEqual(outputValues(output.environment.GITHUB_OUTPUT), {
      suite_status: "PASSED",
      suite_failure_classification: "NONE",
      suite_completed_command_count: String(autonomousFullSuiteCommands.length)
    });
  } finally {
    rmSync(output.directory, { recursive: true, force: true });
  }
});

test("only dependency or audit transport faults permit one clean recovery", () => {
  for (const failingIndex of [0, 1]) {
    const output = temporaryOutput();
    const captured = Buffer.from(
      failingIndex === 0 ? "npm ERR! EAI_AGAIN" : "503 Service Unavailable"
    );
    let calls = 0;
    try {
      const result = runAutonomousFullSuite({
        root,
        environment: output.environment,
        spawnImpl() {
          const index = calls++;
          return index === failingIndex
            ? { status: 1, stdout: Buffer.alloc(0), stderr: captured }
            : { status: 0, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
        }
      });
      assert.equal(result.suiteStatus, "TRANSIENT_FAILURE");
      assert.equal(calls, failingIndex + 1);
      assert.ok(captured.every(byte => byte === 0));
      assert.equal(
        outputValues(output.environment.GITHUB_OUTPUT)
          .suite_failure_classification,
        failingIndex === 0
          ? "DEPENDENCY_TRANSPORT_TRANSIENT"
          : "AUDIT_TRANSPORT_TRANSIENT"
      );
    } finally {
      rmSync(output.directory, { recursive: true, force: true });
    }
  }
});

test("source, test, and unclassified setup failures stop without retry eligibility", () => {
  for (const failingIndex of [0, 2, 4]) {
    const output = temporaryOutput();
    let calls = 0;
    try {
      expectFailure(() => runAutonomousFullSuite({
        root,
        environment: output.environment,
        spawnImpl() {
          const index = calls++;
          return index === failingIndex
            ? {
                status: 1,
                stdout: Buffer.alloc(0),
                stderr: Buffer.from("deterministic assertion failure")
              }
            : { status: 0, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
        }
      }), AUTONOMOUS_ENGINEERING_V1_FAILURE.SOURCE_VERIFICATION_FAILED);
      assert.equal(calls, failingIndex + 1);
      assert.equal(
        outputValues(output.environment.GITHUB_OUTPUT).suite_status,
        "SOURCE_FAILURE"
      );
    } finally {
      rmSync(output.directory, { recursive: true, force: true });
    }
  }
});

test("selector propagates exactly one primary or one recovery artifact", () => {
  for (const recovery of [false, true]) {
    const output = temporaryOutput(contextEnvironment({
      PROMETHEUS_PRIMARY_JOB_RESULT: "success",
      PROMETHEUS_PRIMARY_SUITE_STATUS:
        recovery ? "TRANSIENT_FAILURE" : "PASSED",
      PROMETHEUS_RECOVERY_JOB_RESULT: recovery ? "success" : "skipped",
      PROMETHEUS_RECOVERY_SUITE_STATUS: recovery ? "PASSED" : "",
      ...qualificationValues("PROMETHEUS_PRIMARY", 1),
      ...qualificationValues("PROMETHEUS_RECOVERY", 2)
    }));
    try {
      const result = selectAutonomousQualification({
        environment: output.environment
      });
      const values = outputValues(output.environment.GITHUB_OUTPUT);
      assert.equal(result.selectedQualification, recovery ? "RECOVERY" : "PRIMARY");
      assert.equal(result.inRunRecoveryAttempts, recovery ? 1 : 0);
      assert.equal(values.selected_qualification, recovery ? "RECOVERY" : "PRIMARY");
      assert.equal(values.in_run_recovery_attempts, recovery ? "1" : "0");
      assert.equal(
        values.qualification_artifact_id,
        output.environment[
          `PROMETHEUS_${recovery ? "RECOVERY" : "PRIMARY"}_QUALIFICATION_ARTIFACT_ID`
        ]
      );
    } finally {
      rmSync(output.directory, { recursive: true, force: true });
    }
  }
});

test("selector rejects source failure, second transient, and incomplete outputs", () => {
  for (const overrides of [
    {
      PROMETHEUS_PRIMARY_JOB_RESULT: "failure",
      PROMETHEUS_PRIMARY_SUITE_STATUS: "SOURCE_FAILURE",
      PROMETHEUS_RECOVERY_JOB_RESULT: "skipped",
      PROMETHEUS_RECOVERY_SUITE_STATUS: ""
    },
    {
      PROMETHEUS_PRIMARY_JOB_RESULT: "success",
      PROMETHEUS_PRIMARY_SUITE_STATUS: "TRANSIENT_FAILURE",
      PROMETHEUS_RECOVERY_JOB_RESULT: "failure",
      PROMETHEUS_RECOVERY_SUITE_STATUS: "TRANSIENT_FAILURE"
    },
    {
      PROMETHEUS_PRIMARY_JOB_RESULT: "success",
      PROMETHEUS_PRIMARY_SUITE_STATUS: "PASSED",
      PROMETHEUS_RECOVERY_JOB_RESULT: "skipped",
      PROMETHEUS_RECOVERY_SUITE_STATUS: "",
      ...qualificationValues("PROMETHEUS_PRIMARY", 1),
      PROMETHEUS_PRIMARY_QUALIFIED_MANIFEST_SHA256: ""
    }
  ]) {
    const output = temporaryOutput(contextEnvironment(overrides));
    try {
      expectFailure(
        () => selectAutonomousQualification({
          environment: output.environment
        }),
        AUTONOMOUS_ENGINEERING_V1_FAILURE.TRANSIENT_RECOVERY_INVALID
      );
    } finally {
      rmSync(output.directory, { recursive: true, force: true });
    }
  }
});

test("repair limits enforce file, line, patch-byte, file-byte, commit, and recursion caps", () => {
  const valid = {
    changedPaths: [AUTONOMOUS_ENGINEERING_V1_POLICY.libraryPath],
    changedLineCount: 1,
    changedPatchBytes: 1,
    changedFileBytes: 1,
    repairAttempt: 0,
    successorCommitCount: 1,
    recursionDepth: 0
  };
  assert.equal(validateAutonomousRepairScope(valid).changedFileCount, 1);
  for (const overflow of [
    {
      changedPaths: Array.from(
        { length: AUTONOMOUS_ENGINEERING_V1_POLICY.maximumChangedFiles + 1 },
        (_, index) => `forbidden/${index}`
      )
    },
    {
      changedLineCount:
        AUTONOMOUS_ENGINEERING_V1_POLICY.maximumChangedLines + 1
    },
    {
      changedPatchBytes:
        AUTONOMOUS_ENGINEERING_V1_POLICY.maximumChangedPatchBytes + 1
    },
    {
      changedFileBytes:
        AUTONOMOUS_ENGINEERING_V1_POLICY.maximumChangedFileBytes + 1
    },
    {
      successorCommitCount:
        AUTONOMOUS_ENGINEERING_V1_POLICY.maximumSuccessorCommits + 1
    },
    { recursionDepth: 1 },
    { changedPaths: ["src/product-forbidden.ts"] }
  ]) {
    expectFailure(
      () => validateAutonomousRepairScope({ ...valid, ...overflow }),
      AUTONOMOUS_ENGINEERING_V1_FAILURE.REPAIR_SCOPE_INVALID
    );
  }
});

test("diff-shape validation rejects binaries, renames, deletions, and mode changes", () => {
  const path = AUTONOMOUS_ENGINEERING_V1_POLICY.libraryPath;
  const hash = "c".repeat(40);
  const valid = {
    nameStatus: `M\t${path}`,
    numstat: `1\t1\t${path}`,
    summary: "",
    gitModes: [`100644 ${hash} 0\t${path}`]
  };
  assert.equal(validateAutonomousDiffShape(valid).changedLineCount, 2);
  for (const invalid of [
    { nameStatus: `R100\t${path}\t${AUTONOMOUS_ENGINEERING_V1_POLICY.runnerPath}` },
    { nameStatus: `D\t${path}` },
    { numstat: `-\t-\t${path}` },
    { summary: `mode change 100644 => 100755 ${path}` },
    { gitModes: [`120000 ${hash} 0\t${path}`] },
    { nameStatus: "M\tsrc/product-forbidden.ts" }
  ]) {
    expectFailure(
      () => validateAutonomousDiffShape({ ...valid, ...invalid }),
      AUTONOMOUS_ENGINEERING_V1_FAILURE.REPAIR_SCOPE_INVALID
    );
  }
});

test("filesystem validation rejects symlinks and accepts regular owner files", () => {
  const directory = mkdtempSync(join(tmpdir(), "autonomous-files-"));
  try {
    mkdirSync(join(directory, "scripts"));
    const regular = "scripts/regular.mjs";
    const linked = "scripts/linked.mjs";
    writeFileSync(join(directory, regular), "export {};\n");
    symlinkSync(join(directory, regular), join(directory, linked));
    assert.equal(
      validateAutonomousFilesystemPaths(directory, [regular]),
      Buffer.byteLength("export {};\n")
    );
    expectFailure(
      () => validateAutonomousFilesystemPaths(directory, [linked]),
      AUTONOMOUS_ENGINEERING_V1_FAILURE.REPAIR_SCOPE_INVALID
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("controlled rollback evidence proves one forward attempt and one recovery", async () => {
  let dryRuns = 0;
  const result = await demonstrateControlledRollbackLifecycle({
    candidateCommit: commit,
    candidateTree: tree,
    batchId: "BATCH-20260730-001",
    currentPublicVersion: publicVersion,
    currentPrivateVersion: privateVersion
  }, Object.freeze({}), async () => {
    dryRuns += 1;
  });
  assert.equal(result.result.deploymentAttempts, 1);
  assert.equal(result.result.rollbackAttempts, 1);
  assert.equal(dryRuns, 1);
  assert.deepEqual(result.phases, autonomousRollbackPhases);
  assert.deepEqual(result.calls, { dryRun: 1, deploy: 1, rollback: 1 });
});

test("deployment child receives six governed Cloudflare settings and no artifact token", async () => {
  const directory = mkdtempSync(join(tmpdir(), "autonomous-deploy-"));
  const cloudflareNames = [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_SECRET",
    "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_TEAM_DOMAIN",
    "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_AUDIENCE"
  ].sort();
  try {
    let childEnvironment;
    const result = await runAutonomousDeployment({
      root,
      environment: deploymentEnvironment(directory),
      verifyRepositoryImpl: () => Object.freeze({ status: "verified" }),
      verifyContractPinImpl: () => undefined,
      async deployImpl({ environment }) {
        childEnvironment = environment;
        return Object.freeze({
          status: "PRIVATE_WORKER_V2_DEPLOYMENT_VERIFIED",
          deploymentAttempts: 1,
          rollbackAttempts: 0
        });
      }
    });
    assert.equal(result.status, "GITHUB_HOSTED_AUTONOMOUS_DEPLOYMENT_VERIFIED");
    assert.equal("PROMETHEUS_GITHUB_TOKEN" in childEnvironment, false);
    assert.deepEqual(
      Object.keys(childEnvironment).filter(name =>
        cloudflareNames.includes(name)).sort(),
      cloudflareNames
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("deployment rejects an accidentally inherited artifact token before child execution", async () => {
  const directory = mkdtempSync(join(tmpdir(), "autonomous-deploy-token-"));
  let calls = 0;
  try {
    await assert.rejects(runAutonomousDeployment({
      root,
      environment: deploymentEnvironment(directory, {
        PROMETHEUS_GITHUB_TOKEN: "synthetic-artifact-token"
      }),
      verifyRepositoryImpl: () => Object.freeze({ status: "verified" }),
      verifyContractPinImpl: () => undefined,
      async deployImpl() {
        calls += 1;
      }
    }), error =>
      error instanceof AutonomousEngineeringV1Error
      && error.code
        === AUTONOMOUS_ENGINEERING_V1_FAILURE.SECRET_BOUNDARY_INVALID);
    assert.equal(calls, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
