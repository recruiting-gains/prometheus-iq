import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  REVENUE_READINESS_V1_FAILURE,
  REVENUE_READINESS_V1_POLICY,
  RevenueReadinessV1Error,
  assertRevenueReadinessNoProductionSecrets,
  revenueReadinessContractSha256,
  revenueReadinessPathOwner,
  projectRevenueReadinessDeploymentEnvironment,
  projectRevenueReadinessQualificationEnvironment,
  runRevenueReadinessDeployment,
  sha256RevenueReadinessFile,
  validateRevenueReadinessArchiveExposure,
  validateRevenueReadinessCommitTopology,
  validateRevenueReadinessContext,
  validateRevenueReadinessDeploymentEvidence,
  verifyRevenueReadinessArtifact,
  verifyRevenueReadinessEvidenceArtifactMetadata,
  verifyRevenueReadinessEvidence
} from "../scripts/lib/paid-customer-revenue-readiness-v1.mjs";
import {
  extractRevenueReadinessPreCheckoutGateScript,
  extractRevenueReadinessRunScripts,
  verifyPaidCustomerRevenueReadinessV1,
  verifyRevenueReadinessWorkflowSource
} from "../scripts/verify-paid-customer-revenue-readiness-v1.mjs";

const root = resolve(import.meta.dirname, "..");
const commit = "a".repeat(40);
const tree = "b".repeat(40);
const sha = "c".repeat(64);

function contextEnvironment(overrides = {}) {
  const dispatch = {
    candidate_commit: commit,
    candidate_tree: tree,
    batch_id: "BATCH-20260731-001",
    current_public_version:
      REVENUE_READINESS_V1_POLICY.currentPublicVersion,
    current_private_version:
      REVENUE_READINESS_V1_POLICY.currentPrivateVersion,
    founder_authorization:
      REVENUE_READINESS_V1_POLICY.founderAuthorization
  };
  const environment = {
    PROMETHEUS_CANDIDATE_COMMIT: dispatch.candidate_commit,
    PROMETHEUS_CANDIDATE_TREE: dispatch.candidate_tree,
    PROMETHEUS_BATCH_ID: dispatch.batch_id,
    PROMETHEUS_CURRENT_PUBLIC_VERSION: dispatch.current_public_version,
    PROMETHEUS_CURRENT_PRIVATE_VERSION: dispatch.current_private_version,
    PROMETHEUS_FOUNDER_AUTHORIZATION: dispatch.founder_authorization,
    PROMETHEUS_REVENUE_READINESS_DISPATCH_INPUTS_JSON:
      JSON.stringify(dispatch),
    GITHUB_REPOSITORY: REVENUE_READINESS_V1_POLICY.repository,
    GITHUB_REF: REVENUE_READINESS_V1_POLICY.ref,
    GITHUB_REF_NAME: REVENUE_READINESS_V1_POLICY.branch,
    GITHUB_REF_TYPE: REVENUE_READINESS_V1_POLICY.refType,
    GITHUB_EVENT_NAME: REVENUE_READINESS_V1_POLICY.eventName,
    GITHUB_ACTOR: REVENUE_READINESS_V1_POLICY.founderActor,
    GITHUB_TRIGGERING_ACTOR: REVENUE_READINESS_V1_POLICY.founderActor,
    GITHUB_WORKFLOW: REVENUE_READINESS_V1_POLICY.workflowName,
    GITHUB_WORKFLOW_REF: REVENUE_READINESS_V1_POLICY.workflowRef,
    GITHUB_RUN_ATTEMPT: REVENUE_READINESS_V1_POLICY.firstRunAttempt,
    GITHUB_RUN_ID: "123456789",
    GITHUB_SHA: commit,
    ...overrides
  };
  if (overrides.dispatch) {
    environment.PROMETHEUS_REVENUE_READINESS_DISPATCH_INPUTS_JSON =
      JSON.stringify({ ...dispatch, ...overrides.dispatch });
    delete environment.dispatch;
  }
  return environment;
}

function artifactEnvironment(overrides = {}) {
  return contextEnvironment({
    PROMETHEUS_QUALIFICATION_RUN_ID: "123456789",
    PROMETHEUS_QUALIFICATION_ARTIFACT_ID: "987654321",
    PROMETHEUS_QUALIFICATION_ARTIFACT_ZIP_SHA256: sha,
    PROMETHEUS_QUALIFIED_CONTENT_TREE_SHA256: "d".repeat(64),
    PROMETHEUS_QUALIFIED_MANIFEST_SHA256: "e".repeat(64),
    PROMETHEUS_WORKFLOW_CONTRACT_SHA256: "f".repeat(64),
    PROMETHEUS_ROLLBACK_CONTRACT_SHA256: "1".repeat(64),
    PROMETHEUS_ROLLBACK_BUNDLE_SHA256: "2".repeat(64),
    PROMETHEUS_REVENUE_READINESS_CONTRACT_SHA256:
      revenueReadinessContractSha256(root),
    ...overrides
  });
}

function preCheckoutGateEnvironment(overrides = {}) {
  return {
    GATE_EVENT_NAME: REVENUE_READINESS_V1_POLICY.eventName,
    GATE_REPOSITORY: REVENUE_READINESS_V1_POLICY.repository,
    GATE_ACTOR: REVENUE_READINESS_V1_POLICY.founderActor,
    GATE_TRIGGERING_ACTOR: REVENUE_READINESS_V1_POLICY.founderActor,
    GATE_REF: REVENUE_READINESS_V1_POLICY.ref,
    GATE_REF_NAME: REVENUE_READINESS_V1_POLICY.branch,
    GATE_REF_TYPE: REVENUE_READINESS_V1_POLICY.refType,
    GATE_WORKFLOW: REVENUE_READINESS_V1_POLICY.workflowName,
    GATE_WORKFLOW_REF: REVENUE_READINESS_V1_POLICY.workflowRef,
    GATE_RUN_ATTEMPT: String(REVENUE_READINESS_V1_POLICY.firstRunAttempt),
    GATE_CANDIDATE_COMMIT: commit,
    GATE_CANDIDATE_TREE: tree,
    GATE_BATCH_ID: "BATCH-20260731-001",
    GATE_CURRENT_PUBLIC_VERSION:
      REVENUE_READINESS_V1_POLICY.currentPublicVersion,
    GATE_CURRENT_PRIVATE_VERSION:
      REVENUE_READINESS_V1_POLICY.currentPrivateVersion,
    GATE_FOUNDER_AUTHORIZATION:
      REVENUE_READINESS_V1_POLICY.founderAuthorization,
    LC_ALL: "C",
    ...overrides
  };
}

function runPreCheckoutGate(script, overrides = {}) {
  return spawnSync("/bin/bash", [
    "--noprofile",
    "--norc",
    "-c",
    script
  ], {
    encoding: "utf8",
    env: preCheckoutGateEnvironment(overrides),
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 5_000
  });
}

function record(owner, index, paths) {
  const identity = {
    ADMINISTRATION:
      "Prometheus Administration <administration@prometheus.local>",
    CRM: "Prometheus CRM <crm@prometheus.local>",
    DATA: "Prometheus Data <data@prometheus.local>",
    DASHBOARD: "Prometheus Dashboard <dashboard@prometheus.local>",
    SECURITY: "Prometheus Security <security@prometheus.local>",
    INFRASTRUCTURE:
      "Prometheus Infrastructure <infrastructure@prometheus.local>",
    INTELLIGENCE:
      "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    OVERWATCH: "Prometheus Overwatch <overwatch@prometheus.local>"
  }[owner];
  return {
    commit: String(index).repeat(40),
    parents: [String(index - 1).repeat(40)],
    author: identity,
    committer: identity,
    owner,
    paths,
    pathOwners: paths.map(path => revenueReadinessPathOwner(path))
  };
}

function sourceFixture() {
  return {
    workflow: readFileSync(
      resolve(root, REVENUE_READINESS_V1_POLICY.workflowPath),
      "utf8"
    ),
    contract: JSON.parse(readFileSync(
      resolve(root, REVENUE_READINESS_V1_POLICY.contractPath),
      "utf8"
    )),
    library: readFileSync(
      resolve(root, REVENUE_READINESS_V1_POLICY.libraryPath),
      "utf8"
    )
  };
}

function evidenceFixture(overrides = {}) {
  return {
    schemaVersion: "paid-customer-revenue-readiness-evidence-v1",
    status: "PRIVATE_WORKER_V2_DEPLOYMENT_VERIFIED",
    candidateCommit: commit,
    candidateTree: tree,
    batchId: "BATCH-20260731-001",
    currentPublicVersion: REVENUE_READINESS_V1_POLICY.currentPublicVersion,
    previousPrivateVersion: REVENUE_READINESS_V1_POLICY.currentPrivateVersion,
    privateWorker: "prometheus-iq",
    publicWorker: "prometheusrouteiq-website",
    deploymentAttempts: 1,
    rollbackAttempts: 0,
    publicWorkerUnchanged: true,
    browserAcceptance: "AUTHENTICATED_DESKTOP_AND_390X844_PASSED",
    crmWrites: 0,
    productionCustomerWrites: 0,
    providerRefresh: "OFF",
    scheduler: "OFF",
    collection: "OFF",
    activeCohortCount: 0,
    recommendationInfluence: "OFF",
    invitations: "OFF",
    billing: "OFF",
    anthonyMapped: false,
    localComputerRequiredAfterDispatch: false,
    ...overrides
  };
}

function expectFailure(fn, code) {
  assert.throws(fn, error => (
    error instanceof RevenueReadinessV1Error && error.code === code
  ));
}

test("exact Founder/main/repository/Worker context passes", () => {
  const inputs = validateRevenueReadinessContext(contextEnvironment());
  assert.equal(inputs.candidateCommit, commit);
  assert.equal(inputs.currentPublicVersion, REVENUE_READINESS_V1_POLICY.currentPublicVersion);
  assert.equal(inputs.currentPrivateVersion, REVENUE_READINESS_V1_POLICY.currentPrivateVersion);
});

test("wrong Founder actor fails closed", () => {
  expectFailure(
    () => validateRevenueReadinessContext(contextEnvironment({
      GITHUB_ACTOR: "not-the-founder"
    })),
    REVENUE_READINESS_V1_FAILURE.CONTEXT_INVALID
  );
});

test("first no-repository gate explicitly passes only exact dispatch context", () => {
  const workflow = sourceFixture().workflow;
  const script = extractRevenueReadinessPreCheckoutGateScript(workflow);
  assert.equal(runPreCheckoutGate(script).status, 0);
  for (const overrides of [
    { GATE_ACTOR: "not-the-founder" },
    { GATE_TRIGGERING_ACTOR: "not-the-founder" },
    { GATE_REF: "refs/heads/feature", GATE_REF_NAME: "feature" },
    { GATE_FOUNDER_AUTHORIZATION: "not-authorized" }
  ]) {
    const result = runPreCheckoutGate(script, overrides);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
  }
});

test("hostile dispatch metacharacters remain inert and cannot enter run text", () => {
  const temporary = mkdtempSync(join(tmpdir(), "controlled-gate-hostile-"));
  try {
    const workflow = sourceFixture().workflow;
    const script = extractRevenueReadinessPreCheckoutGateScript(workflow);
    const marker = join(temporary, "must-not-exist");
    const hostile = `$(touch ${marker})`;
    assert.equal(script.includes(hostile), false);
    for (const overrides of [
      { GATE_CANDIDATE_COMMIT: hostile },
      { GATE_FOUNDER_AUTHORIZATION: `"; touch ${marker}; #` }
    ]) {
      const result = runPreCheckoutGate(script, overrides);
      assert.notEqual(result.status, 0);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr, "");
      assert.equal(existsSync(marker), false);
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("authorization gate cannot reveal unrelated secret environment values", () => {
  const script = extractRevenueReadinessPreCheckoutGateScript(
    sourceFixture().workflow
  );
  const syntheticSecret = "synthetic-secret-must-not-appear";
  const result = runPreCheckoutGate(script, {
    GATE_ACTOR: "not-the-founder",
    UNRELATED_PROTECTED_VALUE: syntheticSecret
  });
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout.includes(syntheticSecret), false);
  assert.equal(result.stderr.includes(syntheticSecret), false);
});

test("wrong branch fails closed", () => {
  expectFailure(
    () => validateRevenueReadinessContext(contextEnvironment({
      GITHUB_REF: "refs/heads/feature",
      GITHUB_REF_NAME: "feature"
    })),
    REVENUE_READINESS_V1_FAILURE.CONTEXT_INVALID
  );
});

test("wrong public or private production identity fails closed", () => {
  for (const [name, key] of [
    ["PROMETHEUS_CURRENT_PUBLIC_VERSION", "current_public_version"],
    ["PROMETHEUS_CURRENT_PRIVATE_VERSION", "current_private_version"]
  ]) {
    expectFailure(
      () => validateRevenueReadinessContext(contextEnvironment({
        [name]: "11111111-1111-4111-8111-111111111111",
        dispatch: {
          [key]: "11111111-1111-4111-8111-111111111111"
        }
      })),
      REVENUE_READINESS_V1_FAILURE.INPUT_INVALID
    );
  }
});

test("qualification projection derives current private-v2 inputs", () => {
  const environment = contextEnvironment();
  const inputs = validateRevenueReadinessContext(environment);
  const projected = projectRevenueReadinessQualificationEnvironment(
    environment,
    inputs
  );
  assert.equal(
    projected.GITHUB_WORKFLOW,
    "Qualify Prometheus Private Worker v2"
  );
  assert.deepEqual(JSON.parse(projected.PROMETHEUS_DISPATCH_INPUTS_JSON), {
    candidate_commit: commit,
    candidate_tree: tree,
    batch_id: "BATCH-20260731-001",
    current_public_version:
      REVENUE_READINESS_V1_POLICY.currentPublicVersion,
    current_private_version:
      REVENUE_READINESS_V1_POLICY.currentPrivateVersion
  });
});

test("deployment projection derives artifact and rollback identities", () => {
  const environment = artifactEnvironment();
  const inputs = validateRevenueReadinessContext(environment);
  const projected = projectRevenueReadinessDeploymentEnvironment(
    environment,
    inputs
  );
  const dispatch = JSON.parse(projected.PROMETHEUS_DISPATCH_INPUTS_JSON);
  assert.equal(dispatch.qualification_artifact_zip_sha256, sha);
  assert.equal(dispatch.rollback_contract_sha256, "1".repeat(64));
  assert.equal(dispatch.rollback_bundle_sha256, "2".repeat(64));
  assert.equal(
    dispatch.founder_authorization,
    "I AUTHORIZE THIS EXACT PROMETHEUS PRIVATE WORKER DEPLOYMENT"
  );
});

test("production secrets are rejected outside the protected deployment", () => {
  assert.doesNotThrow(() => {
    assertRevenueReadinessNoProductionSecrets(contextEnvironment());
  });
  const environment = contextEnvironment();
  environment[["CLOUDFLARE", "API", "TOKEN"].join("_")] =
    "synthetic-not-a-real-secret";
  expectFailure(
    () => assertRevenueReadinessNoProductionSecrets(environment),
    REVENUE_READINESS_V1_FAILURE.SECRET_BOUNDARY_INVALID
  );
});

test("complete owner-correct revenue readiness chain passes", () => {
  const topology = validateRevenueReadinessCommitTopology([
    record("ADMINISTRATION", 2, [
      REVENUE_READINESS_V1_POLICY.administrationPaths[0]
    ]),
    record("CRM", 3, [REVENUE_READINESS_V1_POLICY.crmPaths[0]]),
    record("DATA", 4, [REVENUE_READINESS_V1_POLICY.dataPaths[0]]),
    record("DASHBOARD", 5, [REVENUE_READINESS_V1_POLICY.dashboardPaths[0]]),
    record("SECURITY", 6, [REVENUE_READINESS_V1_POLICY.securityPaths[0]]),
    record("INFRASTRUCTURE", 7, [
      REVENUE_READINESS_V1_POLICY.infrastructureNewPaths[0]
    ]),
    record("OVERWATCH", 8, [
      REVENUE_READINESS_V1_POLICY.overwatchNewPaths[0]
    ])
  ]);
  assert.equal(topology.finalOwner, "OVERWATCH");
  assert.equal(topology.commitCount, 7);
});

test("owner successor followed by Overwatch acceptance passes", () => {
  const topology = validateRevenueReadinessCommitTopology([
    record("ADMINISTRATION", 2, [
      REVENUE_READINESS_V1_POLICY.administrationPaths[0]
    ]),
    record("CRM", 3, [REVENUE_READINESS_V1_POLICY.crmPaths[0]]),
    record("DATA", 4, [REVENUE_READINESS_V1_POLICY.dataPaths[0]]),
    record("DASHBOARD", 5, [REVENUE_READINESS_V1_POLICY.dashboardPaths[0]]),
    record("SECURITY", 6, [REVENUE_READINESS_V1_POLICY.securityPaths[0]]),
    record("INFRASTRUCTURE", 7, [
      REVENUE_READINESS_V1_POLICY.infrastructureNewPaths[0]
    ]),
    record("OVERWATCH", 8, [
      REVENUE_READINESS_V1_POLICY.overwatchNewPaths[0]
    ]),
    record("INFRASTRUCTURE", 9, [
      REVENUE_READINESS_V1_POLICY.infrastructureSuccessorPaths[0]
    ]),
    record("OVERWATCH", 1, [
      REVENUE_READINESS_V1_POLICY.overwatchNewPaths[0]
    ])
  ]);
  assert.equal(topology.finalOwner, "OVERWATCH");
  assert.equal(topology.infrastructureCommitCount, 2);
});

test("exact Intelligence and Overwatch revenue successors pass without admitting substitutions", () => {
  const intelligencePaths =
    REVENUE_READINESS_V1_POLICY.intelligenceSuccessorPaths;
  const overwatchPaths = [
    "scripts/verify-overwatch-controlled-paid-customer-onboarding-rehearsal-v1.mjs",
    "tests/overwatch-controlled-paid-customer-onboarding-rehearsal-v1.test.mjs",
    "overwatch/governance/github-actions-private-worker-deployment-v2.json",
    "scripts/verify-overwatch-github-actions-private-worker-deployment.mjs",
    "tests/overwatch-github-actions-private-worker-deployment.test.mjs",
    "scripts/verify-release-provenance-repair.mjs",
    "tests/release-provenance-repair.test.mjs"
  ];
  const exactAcceptedPredecessors = [
    ["_headers", "DASHBOARD"],
    ["overwatch/governance/public-deployment-workflow-v2.json", "OVERWATCH"]
  ];
  for (const path of intelligencePaths) {
    assert.equal(revenueReadinessPathOwner(path), "INTELLIGENCE");
    assert.equal(revenueReadinessPathOwner(`${path}.substituted`), null);
  }
  for (const path of overwatchPaths) {
    assert.equal(revenueReadinessPathOwner(path), "OVERWATCH");
    assert.equal(revenueReadinessPathOwner(`${path}.substituted`), null);
  }
  for (const [path, owner] of exactAcceptedPredecessors) {
    assert.equal(revenueReadinessPathOwner(path), owner);
    assert.equal(revenueReadinessPathOwner(`${path}.substituted`), null);
  }

  const topology = validateRevenueReadinessCommitTopology([
    record("ADMINISTRATION", 2, [
      REVENUE_READINESS_V1_POLICY.administrationPaths[0]
    ]),
    record("CRM", 3, [REVENUE_READINESS_V1_POLICY.crmPaths[0]]),
    record("DATA", 4, [REVENUE_READINESS_V1_POLICY.dataPaths[0]]),
    record("DASHBOARD", 5, [REVENUE_READINESS_V1_POLICY.dashboardPaths[0]]),
    record("SECURITY", 6, [REVENUE_READINESS_V1_POLICY.securityPaths[0]]),
    record("INFRASTRUCTURE", 7, [
      REVENUE_READINESS_V1_POLICY.infrastructureNewPaths[0]
    ]),
    record("OVERWATCH", 8, [
      REVENUE_READINESS_V1_POLICY.overwatchNewPaths[0]
    ]),
    record("INTELLIGENCE", 9, intelligencePaths.slice(4, 6)),
    record("INTELLIGENCE", 1, intelligencePaths.slice(0, 3)),
    record("OVERWATCH", 2, overwatchPaths.slice(0, 2)),
    record("OVERWATCH", 3, overwatchPaths.slice(2, 5)),
    record("INTELLIGENCE", 4, intelligencePaths.slice(3, 4).concat(
      intelligencePaths.slice(6)
    )),
    record("OVERWATCH", 5, overwatchPaths.slice(5))
  ]);
  assert.equal(topology.intelligenceCommitCount, 3);
  assert.equal(topology.overwatchCommitCount, 4);
  assert.equal(topology.finalOwner, "OVERWATCH");
});

test("exact terminal Infrastructure policy repair passes only after Overwatch", () => {
  const base = [
    record("ADMINISTRATION", 2, [
      REVENUE_READINESS_V1_POLICY.administrationPaths[0]
    ]),
    record("CRM", 3, [REVENUE_READINESS_V1_POLICY.crmPaths[0]]),
    record("DATA", 4, [REVENUE_READINESS_V1_POLICY.dataPaths[0]]),
    record("DASHBOARD", 5, [REVENUE_READINESS_V1_POLICY.dashboardPaths[0]]),
    record("SECURITY", 6, [REVENUE_READINESS_V1_POLICY.securityPaths[0]]),
    record("INFRASTRUCTURE", 7, [
      REVENUE_READINESS_V1_POLICY.infrastructureNewPaths[0]
    ]),
    record("OVERWATCH", 8, [
      REVENUE_READINESS_V1_POLICY.overwatchNewPaths[0]
    ])
  ];
  const topology = validateRevenueReadinessCommitTopology(base.concat(record(
    "INFRASTRUCTURE",
    9,
    REVENUE_READINESS_V1_POLICY.infrastructureTerminalPolicyPaths
  )));
  assert.equal(topology.finalOwner, "INFRASTRUCTURE");

  expectFailure(
    () => validateRevenueReadinessCommitTopology(base.concat(record(
      "INFRASTRUCTURE",
      9,
      [REVENUE_READINESS_V1_POLICY.infrastructureSuccessorPaths[0]]
    ))),
    REVENUE_READINESS_V1_FAILURE.OWNER_INVALID
  );
});

test("an owner successor without subsequent Overwatch acceptance fails closed", () => {
  expectFailure(
    () => validateRevenueReadinessCommitTopology([
      record("ADMINISTRATION", 2, [
        REVENUE_READINESS_V1_POLICY.administrationPaths[0]
      ]),
      record("CRM", 3, [REVENUE_READINESS_V1_POLICY.crmPaths[0]]),
      record("DATA", 4, [REVENUE_READINESS_V1_POLICY.dataPaths[0]]),
      record("DASHBOARD", 5, [REVENUE_READINESS_V1_POLICY.dashboardPaths[0]]),
      record("SECURITY", 6, [REVENUE_READINESS_V1_POLICY.securityPaths[0]]),
      record("INFRASTRUCTURE", 7, [
        REVENUE_READINESS_V1_POLICY.infrastructureNewPaths[0]
      ])
    ]),
    REVENUE_READINESS_V1_FAILURE.OWNER_INVALID
  );
});

test("cross-owner edits fail closed", () => {
  const invalid = record("ADMINISTRATION", 2, [
    REVENUE_READINESS_V1_POLICY.infrastructureNewPaths[0]
  ]);
  expectFailure(
    () => validateRevenueReadinessCommitTopology([
      invalid,
      record("INFRASTRUCTURE", 3, [
        REVENUE_READINESS_V1_POLICY.infrastructureNewPaths[1]
      ]),
      record("OVERWATCH", 4, [
        REVENUE_READINESS_V1_POLICY.overwatchNewPaths[0]
      ])
    ]),
    REVENUE_READINESS_V1_FAILURE.OWNER_INVALID
  );
});

test("nonlinear or non-final Overwatch ownership fails closed", () => {
  expectFailure(
    () => validateRevenueReadinessCommitTopology([
      record("ADMINISTRATION", 2, [
        REVENUE_READINESS_V1_POLICY.administrationPaths[0]
      ]),
      record("OVERWATCH", 3, [
        REVENUE_READINESS_V1_POLICY.overwatchNewPaths[0]
      ]),
      record("INFRASTRUCTURE", 4, [
        REVENUE_READINESS_V1_POLICY.infrastructureNewPaths[0]
      ])
    ]),
    REVENUE_READINESS_V1_FAILURE.OWNER_INVALID
  );
});

test("remote archive references and broad push refspecs fail closed", () => {
  assert.doesNotThrow(() => validateRevenueReadinessArchiveExposure({
    remoteRefs: ["refs/remotes/origin/main"],
    pushRefspecs: []
  }));
  for (const fixture of [
    {
      remoteRefs: ["refs/remotes/origin/archive-local/evidence"],
      pushRefspecs: []
    },
    {
      remoteRefs: ["refs/remotes/origin/main"],
      pushRefspecs: ["+refs/heads/*:refs/heads/*"]
    }
  ]) {
    expectFailure(
      () => validateRevenueReadinessArchiveExposure(fixture),
      REVENUE_READINESS_V1_FAILURE.ARCHIVE_REF_EXPOSED
    );
  }
});

test("bounded successful deployment evidence is accepted", () => {
  const inputs = validateRevenueReadinessContext(contextEnvironment());
  const value = evidenceFixture();
  assert.equal(
    validateRevenueReadinessDeploymentEvidence(value, inputs).status,
    "PRIVATE_WORKER_V2_DEPLOYMENT_VERIFIED"
  );
  expectFailure(
    () => validateRevenueReadinessDeploymentEvidence({
      ...value,
      crmWrites: 1
    }, inputs),
    REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID
  );
});

test("final evidence cannot misclassify a verified rollback as acceptance", async () => {
  const temporary = mkdtempSync(join(tmpdir(), "controlled-rehearsal-rollback-"));
  try {
    const directory = join(temporary, "evidence");
    mkdirSync(directory, { mode: 0o700 });
    const path = join(directory, "deployment-evidence.json");
    const rollback = evidenceFixture({
      status: "PRIVATE_WORKER_V2_FORWARD_ROLLBACK_VERIFIED",
      rollbackAttempts: 1,
      browserAcceptance: "AUTHENTICATED_DESKTOP_AND_390X844_NOT_ACCEPTED"
    });
    const inputs = validateRevenueReadinessContext(contextEnvironment());
    assert.equal(
      validateRevenueReadinessDeploymentEvidence(rollback, inputs).status,
      "PRIVATE_WORKER_V2_FORWARD_ROLLBACK_VERIFIED"
    );
    writeFileSync(path, `${JSON.stringify(rollback)}\n`, {
      mode: 0o400,
      flag: "wx"
    });
    const environment = artifactEnvironment({
      PROMETHEUS_REVENUE_READINESS_EVIDENCE_PATH: directory,
      PROMETHEUS_REVENUE_READINESS_EVIDENCE_SHA256:
        sha256RevenueReadinessFile(path),
      PROMETHEUS_REVENUE_READINESS_EVIDENCE_ARTIFACT_ID: "7654321",
      PROMETHEUS_REVENUE_READINESS_EVIDENCE_ARTIFACT_ZIP_SHA256:
        "9".repeat(64),
      PROMETHEUS_GITHUB_TOKEN: "synthetic-github-token"
    });
    let metadataCalls = 0;
    await assert.rejects(
      async () => verifyRevenueReadinessEvidence({
        root,
        environment,
        repositoryImpl: () => ({ status: "SYNTHETIC_REPOSITORY_VALID" }),
        metadataImpl: async () => {
          metadataCalls += 1;
        }
      }),
      error => error instanceof RevenueReadinessV1Error
        && error.code === REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID
    );
    assert.equal(metadataCalls, 0);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("deployment wrapper permits exactly one private-v2 success and emits evidence", async () => {
  const temporary = mkdtempSync(join(tmpdir(), "controlled-rehearsal-test-"));
  try {
    const output = join(temporary, "github-output");
    writeFileSync(output, "", { mode: 0o600 });
    const environment = artifactEnvironment({
      GITHUB_OUTPUT: output,
      PROMETHEUS_REVENUE_READINESS_EVIDENCE_OUTPUT:
        join(temporary, "evidence")
    });
    let calls = 0;
    const result = await runRevenueReadinessDeployment({
      root,
      environment,
      repositoryImpl: () => ({ status: "SYNTHETIC_REPOSITORY_VALID" }),
      deployImpl: async ({ mode, environment: projected }) => {
        calls += 1;
        assert.equal(mode, "deploy");
        assert.equal(projected.PROMETHEUS_APPROVED_COMMIT, commit);
        return {
          status: "PRIVATE_WORKER_V2_DEPLOYMENT_VERIFIED",
          deploymentAttempts: 1,
          rollbackAttempts: 0
        };
      }
    });
    assert.equal(result.status, "REVENUE_READINESS_DEPLOYMENT_VERIFIED");
    assert.equal(calls, 1);
    assert.match(readFileSync(output, "ascii"), /deployment_evidence_sha256=/u);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("artifact re-verification uses metadata and private-v2 verifier once", async () => {
  const environment = artifactEnvironment({
    PROMETHEUS_QUALIFIED_RELEASE_PATH: "/tmp/synthetic-qualified-release",
    PROMETHEUS_GITHUB_TOKEN: "synthetic-github-token"
  });
  const calls = { metadata: 0, qualification: 0 };
  const result = await verifyRevenueReadinessArtifact({
    root,
    environment,
    repositoryImpl: () => ({ status: "SYNTHETIC_REPOSITORY_VALID" }),
    metadataImpl: async ({ mode }) => {
      calls.metadata += 1;
      assert.equal(mode, "verify");
    },
    qualificationImpl: ({ mode }) => {
      calls.qualification += 1;
      assert.equal(mode, "verify");
    }
  });
  assert.equal(result.status, "REVENUE_READINESS_ARTIFACT_VERIFIED");
  assert.deepEqual(calls, { metadata: 1, qualification: 1 });
});

test("invalid artifact identity fails before verifier calls", async () => {
  let calls = 0;
  await assert.rejects(
    verifyRevenueReadinessArtifact({
      root,
      environment: artifactEnvironment({
        PROMETHEUS_ROLLBACK_BUNDLE_SHA256: "truncated"
      }),
      repositoryImpl: () => ({ status: "SYNTHETIC_REPOSITORY_VALID" }),
      metadataImpl: async () => {
        calls += 1;
      },
      qualificationImpl: () => {
        calls += 1;
      }
    }),
    error => error instanceof RevenueReadinessV1Error
      && error.code === REVENUE_READINESS_V1_FAILURE.ARTIFACT_INVALID
  );
  assert.equal(calls, 0);
});

test("bounded evidence artifact metadata requires the same run and head", async () => {
  const environment = artifactEnvironment({
    PROMETHEUS_GITHUB_TOKEN: "synthetic-github-token"
  });
  const metadata = {
    id: 7654321,
    expired: false,
    name: `paid-customer-revenue-readiness-evidence-${commit}`,
    digest: `sha256:${"9".repeat(64)}`,
    workflow_run: {
      id: 123456789,
      head_sha: commit
    }
  };
  const fetchImpl = async (_url, init) => {
    assert.equal(init.method, "GET");
    assert.equal(init.redirect, "manual");
    return new Response(JSON.stringify(metadata), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
  assert.equal(
    (await verifyRevenueReadinessEvidenceArtifactMetadata({
      environment,
      fetchImpl,
      artifactId: "7654321",
      artifactZipSha256: "9".repeat(64),
      candidateCommit: commit
    })).status,
    "REVENUE_READINESS_EVIDENCE_ARTIFACT_METADATA_VERIFIED"
  );
  await assert.rejects(
    verifyRevenueReadinessEvidenceArtifactMetadata({
      environment,
      fetchImpl: async () => new Response(JSON.stringify({
        ...metadata,
        workflow_run: { ...metadata.workflow_run, head_sha: "0".repeat(40) }
      }), { status: 200 }),
      artifactId: "7654321",
      artifactZipSha256: "9".repeat(64),
      candidateCommit: commit
    }),
    error => error instanceof RevenueReadinessV1Error
      && error.code === REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID
  );
});

test("final evidence verifier checks artifact metadata and rejects tampering", async () => {
  const temporary = mkdtempSync(join(tmpdir(), "controlled-rehearsal-evidence-"));
  try {
    const environment = artifactEnvironment({
      GITHUB_OUTPUT: join(temporary, "github-output"),
      PROMETHEUS_REVENUE_READINESS_EVIDENCE_OUTPUT:
        join(temporary, "evidence")
    });
    writeFileSync(environment.GITHUB_OUTPUT, "", { mode: 0o600 });
    const deployed = await runRevenueReadinessDeployment({
      root,
      environment,
      repositoryImpl: () => ({ status: "SYNTHETIC_REPOSITORY_VALID" }),
      deployImpl: async () => ({
        status: "PRIVATE_WORKER_V2_DEPLOYMENT_VERIFIED",
        deploymentAttempts: 1,
        rollbackAttempts: 0
      })
    });
    const verificationEnvironment = artifactEnvironment({
      PROMETHEUS_REVENUE_READINESS_EVIDENCE_PATH:
        environment.PROMETHEUS_REVENUE_READINESS_EVIDENCE_OUTPUT,
      PROMETHEUS_REVENUE_READINESS_EVIDENCE_SHA256:
        deployed.evidenceSha256,
      PROMETHEUS_REVENUE_READINESS_EVIDENCE_ARTIFACT_ID: "7654321",
      PROMETHEUS_REVENUE_READINESS_EVIDENCE_ARTIFACT_ZIP_SHA256:
        "9".repeat(64),
      PROMETHEUS_GITHUB_TOKEN: "synthetic-github-token"
    });
    assert.equal(
      (await verifyRevenueReadinessEvidence({
        root,
        environment: verificationEnvironment,
        repositoryImpl: () => ({ status: "SYNTHETIC_REPOSITORY_VALID" }),
        metadataImpl: async ({ artifactId, artifactZipSha256 }) => {
          assert.equal(artifactId, "7654321");
          assert.equal(artifactZipSha256, "9".repeat(64));
        }
      })).status,
      "REVENUE_READINESS_FINAL_EVIDENCE_VERIFIED"
    );
    writeFileSync(
      join(
        environment.PROMETHEUS_REVENUE_READINESS_EVIDENCE_OUTPUT,
        "unexpected-evidence.json"
      ),
      "{}\n",
      { mode: 0o600, flag: "wx" }
    );
    await assert.rejects(
      async () => verifyRevenueReadinessEvidence({
        root,
        environment: verificationEnvironment,
        repositoryImpl: () => ({ status: "SYNTHETIC_REPOSITORY_VALID" }),
        metadataImpl: async () => {}
      }),
      error => error instanceof RevenueReadinessV1Error
        && error.code === REVENUE_READINESS_V1_FAILURE.EVIDENCE_INVALID
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("actual project workflow and accepted autonomous v1 verify", () => {
  assert.equal(
    verifyPaidCustomerRevenueReadinessV1().status,
    "REVENUE_READINESS_INFRASTRUCTURE_VERIFICATION_PASSED"
  );
});

test("synthetic workflow rejects wrong actor and branch gates", () => {
  for (const mutate of [
    source => source.replace(
      'test "$GATE_ACTOR" = "PrometheusRouteIQ"',
      'test "$GATE_ACTOR" = "someone-else"'
    ),
    source => source.replace(
      'test "$GATE_REF" = "refs/heads/main"',
      'test "$GATE_REF" = "refs/heads/feature"'
    )
  ]) {
    const fixture = sourceFixture();
    fixture.workflow = mutate(fixture.workflow);
    assert.throws(() => verifyRevenueReadinessWorkflowSource(fixture));
  }
});

test("synthetic workflow rejects skip-only authorization and direct input scripts", () => {
  const skippedFixture = sourceFixture();
  skippedFixture.workflow = skippedFixture.workflow.replace(
    "    runs-on: ubuntu-24.04\n    timeout-minutes: 15",
    "    if: ${{ github.actor == 'PrometheusRouteIQ' }}\n"
      + "    runs-on: ubuntu-24.04\n"
      + "    timeout-minutes: 15"
  );
  assert.throws(() => verifyRevenueReadinessWorkflowSource(skippedFixture));

  const interpolationFixture = sourceFixture();
  interpolationFixture.workflow = interpolationFixture.workflow.replace(
    'test "$(git rev-parse HEAD)" = "$PROMETHEUS_CANDIDATE_COMMIT"',
    'test "$(git rev-parse HEAD)" = "${{ inputs.candidate_commit }}"'
  );
  assert.ok(extractRevenueReadinessRunScripts(
    interpolationFixture.workflow
  ).some(script => script.includes("${{ inputs.candidate_commit }}")));
  assert.throws(
    () => verifyRevenueReadinessWorkflowSource(interpolationFixture)
  );
});

test("synthetic workflow rejects artifact substitution and public target mutation", () => {
  const artifactFixture = sourceFixture();
  artifactFixture.workflow = artifactFixture.workflow.replace(
    "run-id: ${{ github.run_id }}",
    "run-id: 999"
  );
  assert.throws(() => verifyRevenueReadinessWorkflowSource(artifactFixture));

  const publicFixture = sourceFixture();
  publicFixture.workflow = publicFixture.workflow.replace(
    "run-paid-customer-revenue-readiness-v1.mjs deploy",
    "run-github-actions-public-worker-deployment.mjs deploy"
  );
  assert.throws(() => verifyRevenueReadinessWorkflowSource(publicFixture));
});

test("synthetic workflow rejects secret-before-preflight and deployment rebuild", () => {
  const secretFixture = sourceFixture();
  secretFixture.workflow = secretFixture.workflow.replace(
    "PROMETHEUS_CANDIDATE_COMMIT: ${{ inputs.candidate_commit }}",
    "CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}\n"
      + "      PROMETHEUS_CANDIDATE_COMMIT: ${{ inputs.candidate_commit }}"
  );
  assert.throws(() => verifyRevenueReadinessWorkflowSource(secretFixture));

  const rebuildFixture = sourceFixture();
  rebuildFixture.workflow = rebuildFixture.workflow.replace(
    "run: npm ci\n\n      - name: Download only this run's qualified private release",
    "run: npm ci\n\n      - name: Rebuild unsafely\n"
      + "        run: npm run build\n\n"
      + "      - name: Download only this run's qualified private release"
  );
  assert.throws(() => verifyRevenueReadinessWorkflowSource(rebuildFixture));
});

test("synthetic workflow rejects write-capable GitHub permissions", () => {
  const fixture = sourceFixture();
  fixture.workflow = fixture.workflow.replace(
    "actions: read",
    "actions: write"
  );
  assert.throws(() => verifyRevenueReadinessWorkflowSource(fixture));
});

test("synthetic workflow rejects deploy always or missing dependency success", () => {
  const alwaysFixture = sourceFixture();
  alwaysFixture.workflow = alwaysFixture.workflow.replace(
    "!cancelled() &&\n        needs.authorize.result == 'success'",
    "always() &&\n        needs.authorize.result == 'success'"
  );
  assert.throws(() => verifyRevenueReadinessWorkflowSource(alwaysFixture));

  const dependencyFixture = sourceFixture();
  dependencyFixture.workflow = dependencyFixture.workflow.replace(
    "needs.reverify.result == 'success'",
    "needs.reverify.result != 'failure'"
  );
  assert.throws(
    () => verifyRevenueReadinessWorkflowSource(dependencyFixture)
  );
});

test("synthetic workflow rejects missing rollback and non-read acceptance", () => {
  const rollbackFixture = sourceFixture();
  rollbackFixture.workflow = rollbackFixture.workflow.replaceAll(
    "PROMETHEUS_ROLLBACK_BUNDLE_SHA256",
    "PROMETHEUS_ROLLBACK_PACKAGE_SHA256"
  );
  assert.throws(() => verifyRevenueReadinessWorkflowSource(rollbackFixture));

  const methodFixture = sourceFixture();
  methodFixture.contract.acceptance.methods = ["GET", "POST"];
  assert.throws(() => verifyRevenueReadinessWorkflowSource(methodFixture));
});
