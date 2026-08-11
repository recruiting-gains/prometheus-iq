#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONTROLLED_REHEARSAL_V1_POLICY
} from "./lib/controlled-paid-customer-onboarding-rehearsal-v1.mjs";
import {
  verifyGithubActionsOfficialNode24PinSuccessor
} from "./verify-github-actions-official-node24-pin-successor.mjs";

const root = resolve(import.meta.dirname, "..");
const JOBS = Object.freeze([
  "authorize",
  "qualify",
  "reverify",
  "deploy",
  "final-evidence"
]);
const PRECHECKOUT_GATE_NAME =
  "Gate exact dispatch context before checkout or repository code";
const SECRET_NAMES = Object.freeze([
  "CLOUDFLARE_ACCESS_CLIENT_ID",
  "CLOUDFLARE_ACCESS_CLIENT_SECRET",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_AUDIENCE",
  "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_TEAM_DOMAIN"
]);

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeOfficialActionPins(source) {
  return source
    .replace(/actions\/checkout@[^\s]+/gu, "actions/checkout@<PIN>")
    .replace(/actions\/setup-node@[^\s]+/gu, "actions/setup-node@<PIN>");
}

export function verifyAcceptedAutonomousWorkflowNode24Successor({
  acceptedWorkflow,
  currentWorkflow,
  node24Contract
}) {
  const path = ".github/workflows/github-hosted-autonomous-engineering-v1.yml";
  const evidence = node24Contract?.workflows?.find(item => item.path === path);
  assert.equal(node24Contract?.batchId, "BATCH-20260810-002");
  assert.equal(node24Contract?.owner, "Prometheus Infrastructure");
  assert.ok(evidence, "autonomous workflow Node 24 evidence is missing");
  assert.equal(sha256(acceptedWorkflow), evidence.predecessorSha256);
  assert.equal(sha256(currentWorkflow), evidence.successorSha256);
  assert.equal(sha256(normalizeOfficialActionPins(acceptedWorkflow)),
    evidence.pinNeutralSha256);
  assert.equal(sha256(normalizeOfficialActionPins(currentWorkflow)),
    evidence.pinNeutralSha256);
  assert.equal(node24Contract.actions.checkout.commit,
    "3d3c42e5aac5ba805825da76410c181273ba90b1");
  assert.equal(node24Contract.actions.setupNode.commit,
    "820762786026740c76f36085b0efc47a31fe5020");
  assert.ok(currentWorkflow.includes(
    `actions/checkout@${node24Contract.actions.checkout.commit}`));
  assert.ok(currentWorkflow.includes(
    `actions/setup-node@${node24Contract.actions.setupNode.commit}`));
  return Object.freeze({
    status: "ACCEPTED_AUTONOMOUS_WORKFLOW_NODE24_SUCCESSOR_VERIFIED",
    path
  });
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
  const marker = `      - name: ${name}\n`;
  const start = job.indexOf(marker);
  const end = job.indexOf("\n      - name:", start + marker.length);
  assert.ok(start >= 0, `step section missing: ${name}`);
  return job.slice(start, end >= 0 ? end : job.length);
}

export function extractControlledRehearsalRunScripts(workflow) {
  assert.equal(typeof workflow, "string");
  const lines = workflow.split("\n");
  const scripts = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(\s*)run:\s*(.*)$/u.exec(lines[index]);
    if (!match) {
      continue;
    }
    if (match[2].trim() !== "|") {
      scripts.push(match[2].trim());
      continue;
    }
    const parentIndent = match[1].length;
    const body = [];
    index += 1;
    for (; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.trim() === "") {
        body.push("");
        continue;
      }
      const indentation = /^ */u.exec(line)[0].length;
      if (indentation <= parentIndent) {
        index -= 1;
        break;
      }
      body.push(line);
    }
    const indentation = Math.min(...body
      .filter(line => line.trim() !== "")
      .map(line => /^ */u.exec(line)[0].length));
    scripts.push(body
      .map(line => line.trim() === "" ? "" : line.slice(indentation))
      .join("\n")
      .replace(/\n+$/u, ""));
  }
  return Object.freeze(scripts);
}

export function extractControlledRehearsalPreCheckoutGateScript(workflow) {
  const authorize = jobSection(workflow, "authorize", "qualify");
  const scripts = extractControlledRehearsalRunScripts(
    stepSection(authorize, PRECHECKOUT_GATE_NAME)
  );
  assert.equal(scripts.length, 1, "pre-checkout gate must have one run script");
  return scripts[0];
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

function assertIdentityGate(section, job) {
  const checkout = section.indexOf("uses: actions/checkout@");
  const clean = section.indexOf("clean: true", checkout);
  const gate = section.indexOf("- name: Gate exact checkout before repository code");
  const setup = section.indexOf("uses: actions/setup-node@", gate);
  assert.ok(checkout >= 0 && clean > checkout, `${job} checkout missing`);
  assert.ok(gate > clean && setup > gate, `${job} immediate identity gate missing`);
  const body = section.slice(gate, setup);
  for (const exact of [
    'test "$(git rev-parse HEAD)" = "$PROMETHEUS_CANDIDATE_COMMIT"',
    'test "$(git rev-parse HEAD^{tree})" = "$PROMETHEUS_CANDIDATE_TREE"',
    'test "$(git rev-parse refs/remotes/origin/main)" = "$PROMETHEUS_CANDIDATE_COMMIT"'
  ]) {
    assert.ok(body.includes(exact), `${job} identity gate missing ${exact}`);
  }
  assert.doesNotMatch(body, /\$\{\{\s*inputs\./u);
}

function assertPreCheckoutAuthorizationGate(workflow) {
  const authorize = jobSection(workflow, "authorize", "qualify");
  const header = authorize.slice(0, authorize.indexOf("    steps:\n"));
  assert.doesNotMatch(
    header,
    /^    if:/mu,
    "invalid authorization must fail instead of skipping the authorize job"
  );
  const steps = authorize.slice(authorize.indexOf("    steps:\n"));
  const gate = steps.indexOf(`- name: ${PRECHECKOUT_GATE_NAME}`);
  const checkout = steps.indexOf("- name: Checkout exact synchronized main");
  assert.ok(gate >= 0 && gate < checkout, "authorization gate must run first");
  assert.match(
    steps.slice(0, gate),
    /^    steps:\n      $/u,
    "no step may precede the authorization gate"
  );
  const gateSection = stepSection(authorize, PRECHECKOUT_GATE_NAME);
  for (const exact of [
    "GATE_EVENT_NAME: ${{ github.event_name }}",
    "GATE_REPOSITORY: ${{ github.repository }}",
    "GATE_ACTOR: ${{ github.actor }}",
    "GATE_TRIGGERING_ACTOR: ${{ github.triggering_actor }}",
    "GATE_REF: ${{ github.ref }}",
    "GATE_REF_NAME: ${{ github.ref_name }}",
    "GATE_REF_TYPE: ${{ github.ref_type }}",
    "GATE_WORKFLOW: ${{ github.workflow }}",
    "GATE_WORKFLOW_REF: ${{ github.workflow_ref }}",
    "GATE_RUN_ATTEMPT: ${{ github.run_attempt }}",
    "GATE_CANDIDATE_COMMIT: ${{ inputs.candidate_commit }}",
    "GATE_CANDIDATE_TREE: ${{ inputs.candidate_tree }}",
    "GATE_BATCH_ID: ${{ inputs.batch_id }}",
    "GATE_CURRENT_PUBLIC_VERSION: ${{ inputs.current_public_version }}",
    "GATE_CURRENT_PRIVATE_VERSION: ${{ inputs.current_private_version }}",
    "GATE_FOUNDER_AUTHORIZATION: ${{ inputs.founder_authorization }}"
  ]) {
    assert.ok(gateSection.includes(exact), `pre-checkout gate missing ${exact}`);
  }
  assert.doesNotMatch(gateSection, /secrets\./u);
  const script = extractControlledRehearsalPreCheckoutGateScript(workflow);
  assert.doesNotMatch(script, /\$\{\{/u);
  assert.doesNotMatch(script, /\b(?:git|node|npm|curl|wget)\b|scripts\//u);
  assert.doesNotMatch(script, /\b(?:echo|printf)\b|set\s+-[^ \n]*x/u);
  for (const exact of [
    'test "$GATE_EVENT_NAME" = "workflow_dispatch"',
    'test "$GATE_REPOSITORY" = "PrometheusRouteIQ/prometheus-iq"',
    'test "$GATE_ACTOR" = "PrometheusRouteIQ"',
    'test "$GATE_TRIGGERING_ACTOR" = "PrometheusRouteIQ"',
    'test "$GATE_REF" = "refs/heads/main"',
    'test "$GATE_REF_NAME" = "main"',
    'test "$GATE_REF_TYPE" = "branch"',
    'test "$GATE_RUN_ATTEMPT" = "1"',
    'test "$GATE_FOUNDER_AUTHORIZATION" = "I AUTHORIZE THIS EXACT CONTROLLED PAID-CUSTOMER ONBOARDING REHEARSAL"'
  ]) {
    assert.ok(script.includes(exact), `pre-checkout gate missing ${exact}`);
  }
}

function assertSecretBoundary(workflow) {
  for (const [index, job] of JOBS.entries()) {
    const section = jobSection(workflow, job, JOBS[index + 1]);
    const actual = [...new Set([...section.matchAll(
      /\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/gu
    )].map(match => match[1]))].sort();
    assert.deepEqual(
      actual,
      job === "deploy" ? [...SECRET_NAMES].sort() : [],
      `${job} secret scope`
    );
  }
  const deploy = jobSection(workflow, "deploy", "final-evidence");
  const deployStep = deploy.slice(
    deploy.indexOf("- name: Deploy private artifact once"),
    deploy.indexOf("- name: Upload bounded deployment")
  );
  for (const name of SECRET_NAMES) {
    assert.ok(
      deployStep.includes(`secrets.${name}`),
      `protected deployment missing ${name}`
    );
  }
}

export function verifyControlledRehearsalWorkflowSource({
  workflow,
  contract,
  library
}) {
  assert.equal(
    contract.contractVersion,
    CONTROLLED_REHEARSAL_V1_POLICY.contractVersion
  );
  assert.equal(contract.workflow.trigger, "workflow_dispatch");
  assert.equal(contract.workflow.automaticTriggersAllowed, false);
  assert.equal(contract.workflow.repository, CONTROLLED_REHEARSAL_V1_POLICY.repository);
  assert.equal(contract.workflow.branch, "main");
  assert.equal(contract.workflow.founderActor, "PrometheusRouteIQ");
  assert.equal(contract.workflow.githubTokenPermissions, "read_only");
  assert.equal(
    contract.workflow.invalidAuthorizationFailureMode,
    "explicit_failed_job_before_checkout"
  );
  assert.equal(contract.workflow.preCheckoutGateUsesRepositoryCode, false);
  assert.equal(contract.workflow.dispatchValuesInRunScriptsAllowed, false);
  assert.equal(contract.baseline.commit, CONTROLLED_REHEARSAL_V1_POLICY.baselineCommit);
  assert.equal(contract.baseline.tree, CONTROLLED_REHEARSAL_V1_POLICY.baselineTree);
  assert.equal(
    contract.baseline.privateWorkerVersion,
    CONTROLLED_REHEARSAL_V1_POLICY.currentPrivateVersion
  );
  assert.equal(
    contract.baseline.publicWorkerVersion,
    CONTROLLED_REHEARSAL_V1_POLICY.currentPublicVersion
  );
  assert.equal(contract.deployment.target, "prometheus-iq");
  assert.equal(contract.deployment.publicTarget, "prometheusrouteiq-website");
  assert.equal(contract.deployment.publicTargetMutationAllowed, false);
  assert.equal(contract.deployment.rebuildAllowed, false);
  assert.equal(contract.deployment.forwardDeploymentAttempts, 1);
  assert.equal(contract.deployment.automaticRetryAllowed, false);
  assert.equal(contract.deployment.cancelledRunMayDeploy, false);
  assert.equal(
    contract.deployment.authorizeQualifyAndReverifySuccessRequired,
    true
  );
  assert.equal(contract.deployment.alwaysConditionAllowed, false);
  assert.equal(contract.deployment.pairedForwardRollbackRequiredOnCriticalFailure, true);
  assert.equal(contract.qualification.privateWorkerV2PolicyIdentityDerivedAtRuntime, true);
  assert.equal(contract.qualification.privateWorkerV2ManifestIdentityDerivedAtRuntime, true);
  assert.equal(contract.qualification.acceptedBaselinePayloadHashHardcoded, false);
  assert.deepEqual(contract.acceptance.methods, ["GET", "HEAD"]);
  assert.equal(contract.acceptance.writeMethodsAllowed, false);
  assert.equal(
    contract.acceptance.successfulDeploymentStatusRequired,
    "PRIVATE_WORKER_V2_DEPLOYMENT_VERIFIED"
  );
  assert.equal(
    contract.acceptance.successfulBrowserClassification,
    "AUTHENTICATED_DESKTOP_AND_390X844_PASSED"
  );
  assert.equal(
    contract.acceptance.rollbackMayUseSuccessfulBrowserClassification,
    false
  );
  assert.equal(
    contract.acceptance.independentEvidenceArtifactMetadataVerificationRequired,
    true
  );
  assert.equal(contract.prohibitedActions.publicWorkerDeployment, true);
  assert.equal(contract.prohibitedActions.productionCustomerMutation, true);
  assert.equal(contract.prohibitedActions.crmReadOrWrite, true);
  assert.equal(contract.prohibitedActions.providerRefresh, true);
  assert.equal(contract.prohibitedActions.schedulerActivation, true);
  assert.equal(contract.prohibitedActions.collectionActivation, true);
  assert.equal(contract.prohibitedActions.cohortActivation, true);
  assert.equal(contract.prohibitedActions.recommendationInfluenceActivation, true);
  assert.equal(contract.prohibitedActions.invitationDelivery, true);
  assert.equal(contract.prohibitedActions.billingActivation, true);
  assert.equal(contract.prohibitedActions.anthonyMapping, true);

  assert.match(
    workflow,
    /^name: Controlled Paid-Customer Onboarding Rehearsal v1$/mu
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
    assert.equal(trigger.includes(forbidden), false, forbidden);
  }
  assert.match(workflow, /^permissions:\n  contents: read$/mu);
  const actionPermissions = [...workflow.matchAll(
    /^      actions: ([a-z]+)$/gmu
  )].map(match => match[1]);
  assert.deepEqual(actionPermissions, ["read", "read", "read", "read"]);
  assert.equal(workflow.includes("actions: write"), false);
  assert.match(
    workflow,
    /^  group: controlled-paid-customer-onboarding-rehearsal-v1$/mu
  );
  assert.match(workflow, /^  cancel-in-progress: false$/mu);
  assertPreCheckoutAuthorizationGate(workflow);
  for (const script of extractControlledRehearsalRunScripts(workflow)) {
    assert.doesNotMatch(
      script,
      /\$\{\{\s*inputs\./u,
      "dispatch inputs must enter run scripts only through environment variables"
    );
  }
  assertSecretBoundary(workflow);

  for (const [index, job] of JOBS.entries()) {
    assertIdentityGate(jobSection(workflow, job, JOBS[index + 1]), job);
  }
  const qualify = jobSection(workflow, "qualify", "reverify");
  for (const command of [
    "npm audit --omit=dev --audit-level=high",
    "npm test",
    "npm run lint",
    "npm run typecheck",
    "npm run security:check",
    "npm run security:aegis:verify",
    "check-cloudflare-unattended-secret-presence.mjs --source=environment",
    "verify-cross-subsystem-artifact-contracts.mjs",
    "verify-github-actions-private-worker-workflow-v2.mjs",
    "verify-controlled-paid-customer-onboarding-rehearsal-v1.mjs"
  ]) {
    assert.ok(qualify.includes(command), `qualification missing ${command}`);
  }
  assert.equal(
    [...qualify.matchAll(/\bnpm test\b/gu)].length,
    1,
    "full suite must run once"
  );
  assert.equal(
    [...workflow.matchAll(
      /node scripts\/run-controlled-paid-customer-onboarding-rehearsal-v1\.mjs qualify/gu
    )].length,
    1
  );
  assert.equal(
    [...workflow.matchAll(/actions\/upload-artifact@/gu)].length,
    2
  );
  assert.equal(
    [...workflow.matchAll(/actions\/download-artifact@/gu)].length,
    4
  );
  assert.equal(
    [...workflow.matchAll(/run-id: \$\{\{ github\.run_id \}\}/gu)].length,
    4
  );
  assert.match(
    workflow,
    /artifact-ids: \$\{\{ needs\.qualify\.outputs\.qualification_artifact_id \}\}/u
  );
  assert.match(
    workflow,
    /PROMETHEUS_ROLLBACK_CONTRACT_SHA256: \$\{\{ needs\.qualify\.outputs\.rollback_contract_sha256 \}\}/u
  );
  assert.match(
    workflow,
    /PROMETHEUS_ROLLBACK_BUNDLE_SHA256: \$\{\{ needs\.qualify\.outputs\.rollback_bundle_sha256 \}\}/u
  );
  assert.match(
    workflow,
    /PROMETHEUS_CONTROLLED_REHEARSAL_EVIDENCE_ARTIFACT_ID: \$\{\{ needs\.deploy\.outputs\.deployment_evidence_artifact_id \}\}/u
  );
  assert.match(
    workflow,
    /PROMETHEUS_CONTROLLED_REHEARSAL_EVIDENCE_ARTIFACT_ZIP_SHA256: \$\{\{ needs\.deploy\.outputs\.deployment_evidence_artifact_zip_sha256 \}\}/u
  );
  const deploy = jobSection(workflow, "deploy", "final-evidence");
  const deployHeader = deploy.slice(0, deploy.indexOf("    steps:\n"));
  assert.match(deploy, /environment:\n      name: prometheus-private-worker-production/u);
  assert.match(deployHeader, /!cancelled\(\)/u);
  assert.match(deployHeader, /needs\.authorize\.result == 'success'/u);
  assert.match(deployHeader, /needs\.qualify\.result == 'success'/u);
  assert.match(deployHeader, /needs\.reverify\.result == 'success'/u);
  assert.doesNotMatch(deploy, /always\(\)/u);
  assert.equal(deploy.includes("npm run build"), false);
  assert.equal(deploy.includes("wrangler deploy"), false);
  assert.equal(
    [...deploy.matchAll(
      /node scripts\/run-controlled-paid-customer-onboarding-rehearsal-v1\.mjs deploy/gu
    )].length,
    1
  );
  assert.match(deploy, /if: \$\{\{ !cancelled\(\) \}\}/u);
  assert.equal(workflow.includes("deploy-prometheus-public-worker"), false);
  assert.equal(workflow.includes("github-actions-public-worker"), false);
  assert.equal(workflow.includes("github-hosted-autonomous-engineering-v1.mjs"), false);
  assert.doesNotMatch(
    workflow,
    /(?:acceptance|smoke)[^\n]*(?:POST|PUT|PATCH|DELETE)/iu
  );

  for (const required of [
    "runPrivateWorkerQualificationV2Command",
    "runPrivateWorkerArtifactMetadataV2Command",
    "runPrivateWorkerDeploymentV2Command",
    "projectControlledRehearsalQualificationEnvironment",
    "projectControlledRehearsalDeploymentEnvironment",
    "validateControlledRehearsalCommitTopology",
    "validateControlledRehearsalArchiveExposure",
    "verifyControlledRehearsalEvidenceArtifactMetadata",
    "PRIVATE_WORKER_V2_FORWARD_ROLLBACK_VERIFIED",
    "AUTHENTICATED_DESKTOP_AND_390X844_PASSED",
    "AUTHENTICATED_DESKTOP_AND_390X844_NOT_ACCEPTED"
  ]) {
    assert.ok(library.includes(required), `library missing ${required}`);
  }
  assert.match(
    library,
    /value\.status !== "PRIVATE_WORKER_V2_DEPLOYMENT_VERIFIED"[\s\S]*value\.browserAcceptance !== SUCCESSFUL_BROWSER_ACCEPTANCE[\s\S]*value\.rollbackAttempts !== 0/u,
    "final evidence must require deployment success, browser PASS, and zero rollback"
  );
  assert.match(
    library,
    /if \(result\.status !== "PRIVATE_WORKER_V2_DEPLOYMENT_VERIFIED"\) \{[\s\S]*CONTROLLED_REHEARSAL_V1_FAILURE\.DEPLOYMENT_INVALID/u,
    "a rollback must leave the protected deployment job failed"
  );
  assert.equal(
    /qualified(?:ContentTree|Manifest|ForwardPayload|RollbackBundle)Sha256:\s*"[0-9a-f]{64}"/u
      .test(library),
    false,
    "project lane must not hardcode private-v2 payload identities"
  );
  return Object.freeze({
    status: "CONTROLLED_REHEARSAL_SOURCE_VERIFIED"
  });
}

export function verifyControlledPaidCustomerOnboardingRehearsalV1() {
  for (const path of [
    CONTROLLED_REHEARSAL_V1_POLICY.workflowPath,
    CONTROLLED_REHEARSAL_V1_POLICY.libraryPath,
    CONTROLLED_REHEARSAL_V1_POLICY.runnerPath,
    CONTROLLED_REHEARSAL_V1_POLICY.verifierPath,
    CONTROLLED_REHEARSAL_V1_POLICY.testPath,
    CONTROLLED_REHEARSAL_V1_POLICY.contractPath
  ]) {
    assert.equal(existsSync(resolve(root, path)), true, `${path} must exist`);
  }
  parseWorkflow(resolve(root, CONTROLLED_REHEARSAL_V1_POLICY.workflowPath));
  const workflow = read(CONTROLLED_REHEARSAL_V1_POLICY.workflowPath);
  const contract = JSON.parse(read(CONTROLLED_REHEARSAL_V1_POLICY.contractPath));
  const library = read(CONTROLLED_REHEARSAL_V1_POLICY.libraryPath);
  verifyControlledRehearsalWorkflowSource({ workflow, contract, library });

  const acceptedAutonomous = spawnSync("git", [
    "show",
    `${CONTROLLED_REHEARSAL_V1_POLICY.baselineCommit}:.github/workflows/github-hosted-autonomous-engineering-v1.yml`
  ], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000
  });
  assert.equal(acceptedAutonomous.status, 0);
  const node24Verification = verifyGithubActionsOfficialNode24PinSuccessor();
  assert.equal(node24Verification.status, "OFFICIAL_NODE24_ACTION_PIN_SOURCE_VERIFIED");
  verifyAcceptedAutonomousWorkflowNode24Successor({
    acceptedWorkflow: acceptedAutonomous.stdout,
    currentWorkflow: read(".github/workflows/github-hosted-autonomous-engineering-v1.yml"),
    node24Contract: JSON.parse(read(
      "workers/infrastructure/github-actions-official-node24-pin-successor-v1.json"
    ))
  });
  return Object.freeze({
    status: "CONTROLLED_REHEARSAL_INFRASTRUCTURE_VERIFICATION_PASSED"
  });
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    verifyControlledPaidCustomerOnboardingRehearsalV1();
    process.stdout.write(
      "CONTROLLED_REHEARSAL_INFRASTRUCTURE_VERIFICATION_PASSED\n"
    );
  } catch {
    process.stdout.write(
      "CONTROLLED_REHEARSAL_INFRASTRUCTURE_VERIFICATION_FAILED\n"
    );
    process.exitCode = 1;
  }
}
