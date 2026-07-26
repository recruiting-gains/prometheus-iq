#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PRIVATE_WORKER_DEPLOYMENT_POLICY,
  parseJsonc,
  verifyStaticDeploymentPolicy,
  verifyWranglerPin
} from "./lib/github-actions-private-worker-deployment.mjs";
import {
  PRIVATE_WORKFLOW_V2_FAILURE,
  PRIVATE_WORKFLOW_V2_POLICY,
  buildQualifiedPrivateWranglerInvocation
} from "./lib/github-actions-private-worker-workflow-v2.mjs";
import {
  CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION,
  fixedCloudflareUnattendedSmokePlan
} from "./run-cloudflare-unattended-smoke.mjs";
import { inspectRouteIqPrivateDashboardDeployAssets } from "./sync-route-iq-private-dashboard-deploy-assets.mjs";
import { validateRouteIqPrivateForwardRollbackBoundaryV3 } from "./build-route-iq-private-forward-rollback-candidate-v3.mjs";

const root = resolve(import.meta.dirname, "..");
const REQUIRED_PATHS = Object.freeze([
  PRIVATE_WORKFLOW_V2_POLICY.qualificationWorkflowPath,
  PRIVATE_WORKFLOW_V2_POLICY.deploymentWorkflowPath,
  PRIVATE_WORKFLOW_V2_POLICY.contractPath,
  PRIVATE_WORKFLOW_V2_POLICY.libraryPath,
  PRIVATE_WORKFLOW_V2_POLICY.qualificationRunnerPath,
  PRIVATE_WORKFLOW_V2_POLICY.deploymentRunnerPath,
  PRIVATE_WORKFLOW_V2_POLICY.smokeRunnerPath,
  PRIVATE_WORKFLOW_V2_POLICY.metadataRunnerPath,
  "scripts/verify-github-actions-private-worker-workflow-v2.mjs",
  "tests/github-actions-private-worker-workflow-v2.test.mjs",
  PRIVATE_WORKFLOW_V2_POLICY.runtimeGuardTestPath
]);
const QUALIFICATION_INPUTS = Object.freeze([
  "candidate_commit",
  "candidate_tree",
  "batch_id",
  "current_public_version",
  "current_private_version"
]);
const DEPLOYMENT_INPUTS = Object.freeze([
  "approved_commit",
  "approved_tree",
  "batch_id",
  "current_public_version",
  "current_private_version",
  "qualification_run_id",
  "qualification_artifact_id",
  "qualification_artifact_zip_sha256",
  "qualified_content_tree_sha256",
  "qualified_manifest_sha256",
  "workflow_contract_sha256",
  "rollback_contract_sha256",
  "rollback_bundle_sha256",
  "founder_authorization"
]);
const REQUIRED_SECRET_NAMES = Object.freeze([
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_ACCESS_CLIENT_ID",
  "CLOUDFLARE_ACCESS_CLIENT_SECRET",
  "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_TEAM_DOMAIN",
  "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_AUDIENCE"
]);
const RUNTIME_GUARD_BINDINGS = Object.freeze([
  "PROMETHEUS_UNATTENDED_SMOKE_GUARD",
  "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_TEAM_DOMAIN",
  "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_AUDIENCE",
  "PROMETHEUS_UNATTENDED_SMOKE_SERVICE_TOKEN_CLIENT_ID"
]);

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `missing ${start}`);
  assert.ok(endIndex > startIndex, `missing ${end}`);
  return source.slice(startIndex, endIndex);
}

function triggerInputs(workflow) {
  const trigger = section(workflow, "on:\n", "permissions:\n");
  assert.deepEqual([...trigger.matchAll(/^  ([a-z_]+):$/gmu)].map(match => match[1]), [
    "workflow_dispatch"
  ]);
  for (const forbidden of [
    "push:",
    "pull_request:",
    "schedule:",
    "repository_dispatch:",
    "workflow_call:"
  ]) {
    assert.equal(trigger.includes(forbidden), false, `forbidden trigger ${forbidden}`);
  }
  return [...trigger.matchAll(/^      ([a-z0-9_]+):$/gmu)].map(match => match[1]);
}

function assertPinnedWorkflowContext(workflow, name, path) {
  for (const predicate of [
    "github.event_name == 'workflow_dispatch'",
    "github.repository == 'PrometheusRouteIQ/prometheus-iq'",
    "github.actor == 'PrometheusRouteIQ'",
    "github.triggering_actor == 'PrometheusRouteIQ'",
    "github.ref == 'refs/heads/main'",
    "github.ref_name == 'main'",
    "github.ref_type == 'branch'",
    `github.workflow == '${name}'`,
    `github.workflow_ref == 'PrometheusRouteIQ/prometheus-iq/${path}@refs/heads/main'`,
    "github.run_attempt == 1"
  ]) {
    assert.ok(workflow.includes(predicate), `workflow context missing ${predicate}`);
  }
}

export function verifyGithubActionsPrivateWorkerWorkflowV2() {
  for (const path of REQUIRED_PATHS) {
    assert.equal(existsSync(resolve(root, path)), true, `${path} must exist`);
  }

  const qualification = read(PRIVATE_WORKFLOW_V2_POLICY.qualificationWorkflowPath);
  const deployment = read(PRIVATE_WORKFLOW_V2_POLICY.deploymentWorkflowPath);
  const contract = JSON.parse(read(PRIVATE_WORKFLOW_V2_POLICY.contractPath));
  const library = read(PRIVATE_WORKFLOW_V2_POLICY.libraryPath);
  const qualificationRunner = read(PRIVATE_WORKFLOW_V2_POLICY.qualificationRunnerPath);
  const deploymentRunner = read(PRIVATE_WORKFLOW_V2_POLICY.deploymentRunnerPath);
  const smokeRunner = read(PRIVATE_WORKFLOW_V2_POLICY.smokeRunnerPath);
  const metadataRunner = read(PRIVATE_WORKFLOW_V2_POLICY.metadataRunnerPath);
  const deploymentPreflight = section(deployment, "  preflight:\n", "  deploy:\n");
  const deploymentJob = deployment.slice(deployment.indexOf("  deploy:\n"));

  assert.match(qualification, /^name: Qualify Prometheus Private Worker v2$/mu);
  assert.match(deployment, /^name: Deploy Prometheus Private Worker v2$/mu);
  assert.deepEqual(triggerInputs(qualification), QUALIFICATION_INPUTS);
  assert.deepEqual(triggerInputs(deployment), DEPLOYMENT_INPUTS);
  assertPinnedWorkflowContext(
    qualification,
    PRIVATE_WORKFLOW_V2_POLICY.qualificationWorkflowName,
    PRIVATE_WORKFLOW_V2_POLICY.qualificationWorkflowPath
  );
  assertPinnedWorkflowContext(
    deployment,
    PRIVATE_WORKFLOW_V2_POLICY.deploymentWorkflowName,
    PRIVATE_WORKFLOW_V2_POLICY.deploymentWorkflowPath
  );
  assert.match(
    deployment,
    /inputs\.founder_authorization == 'I AUTHORIZE THIS EXACT PROMETHEUS PRIVATE WORKER DEPLOYMENT'/u
  );
  assert.equal(count(qualification, /^    runs-on: ubuntu-24\.04$/gmu), 1);
  assert.equal(count(deployment, /^    runs-on: ubuntu-24\.04$/gmu), 2);
  assert.equal(count(qualification, /^          node-version: "24\.4\.1"$/gmu), 1);
  assert.equal(count(deployment, /^          node-version: "24\.4\.1"$/gmu), 2);
  assert.equal(count(qualification, /^        run: npm ci$/gmu), 1);
  assert.equal(count(deployment, /^        run: npm ci$/gmu), 2);
  assert.match(qualification, /group: qualify-prometheus-private-worker-v2-\$\{\{ inputs\.candidate_commit \}\}/u);
  assert.match(deployment, /group: deploy-prometheus-private-worker-v2/u);
  assert.match(qualification, /cancel-in-progress: false/u);
  assert.match(deployment, /cancel-in-progress: false/u);
  assert.match(deploymentJob, /environment:\n      name: prometheus-private-worker-production/u);
  assert.doesNotMatch(deploymentPreflight, /secrets\.[A-Z0-9_]+/u);
  assert.doesNotMatch(deploymentPreflight, /prometheus-private-worker-production/u);
  assert.doesNotMatch(deployment, /(?:&|\*)private-v2|<<:/u);

  assert.equal(
    count(
      qualification,
      /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/gmu
    ),
    1
  );
  assert.equal(
    count(
      deployment,
      /actions\/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0/gmu
    ),
    2
  );
  assert.equal(count(deployment, /artifact-ids: \$\{\{ inputs\.qualification_artifact_id \}\}/gmu), 2);
  assert.equal(count(deployment, /run-id: \$\{\{ inputs\.qualification_run_id \}\}/gmu), 2);
  assert.equal(count(deployment, /npm run build|npm test|vite build/gmu), 0);
  assert.equal(count(deployment, /wrangler(?:\.js)?\s+deploy/gmu), 0);
  assert.equal(
    count(
      deployment,
      /^        run: node scripts\/run-github-actions-private-worker-deployment-v2\.mjs deploy$/gmu
    ),
    1
  );
  assert.doesNotMatch(deployment, /--name|wrangler\.prometheusrouteiq-website\.jsonc/u);
  assert.match(qualification, /compression-level: 0/u);
  assert.match(qualification, /retention-days: 30/u);

  const secretReferences = [...deployment.matchAll(/\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/gu)]
    .map(match => match[1]);
  assert.deepEqual(secretReferences, REQUIRED_SECRET_NAMES);
  assert.doesNotMatch(qualification, /\$\{\{\s*secrets\./u);
  assert.doesNotMatch(
    `${qualification}\n${deployment}`,
    /CLOUDFLARE_(?:ACCOUNT_ID|ACCESS_CLIENT_SECRET):\s*(?:ABSENT|PRESENT|INVALID)/u
  );

  assert.equal(contract.contractVersion, PRIVATE_WORKFLOW_V2_POLICY.contractVersion);
  assert.equal(contract.owner, "Prometheus Infrastructure");
  assert.equal(contract.status, "IMPLEMENTED_NOT_QUALIFIED_NOT_DEPLOYED");
  assert.equal(contract.target.privateWorker, PRIVATE_WORKFLOW_V2_POLICY.privateWorker);
  assert.equal(contract.target.publicWorker, PRIVATE_WORKFLOW_V2_POLICY.publicWorker);
  assert.equal(contract.target.publicWorkerMutationAllowed, false);
  assert.equal(contract.target.applicationSpecificReleaseLane, true);
  assert.equal(
    contract.continuity.previousQualifiedCandidateCommit,
    PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.candidateCommit
  );
  assert.equal(
    contract.continuity.previousQualifiedCandidateTree,
    PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.candidateTree
  );
  assert.equal(
    contract.continuity.privateDeployParitySha256,
    PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.deployParitySha256
  );
  assert.equal(
    contract.continuity.qualifiedForwardPayloadSha256,
    PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.forwardPayloadSha256
  );
  assert.equal(
    contract.continuity.qualifiedRollbackBundleSha256,
    PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.rollbackBundleSha256
  );
  assert.equal(contract.qualification.cloudflareRequestsAllowed, false);
  assert.equal(contract.qualification.secretAccessAllowed, false);
  assert.equal(contract.qualification.artifactIncludesActualDeployableForwardPayload, true);
  assert.equal(contract.qualification.artifactIncludesForwardCompatibleRollback, true);
  assert.equal(contract.qualification.runtimeSmokeSourcePinnedInManifest, true);
  assert.equal(contract.qualification.runtimeGuardRegressionPinnedInManifest, true);
  assert.equal(contract.deployment.rebuildAllowed, false);
  assert.equal(contract.deployment.artifactSubstitutionAllowed, false);
  assert.equal(contract.deployment.wranglerMode, "no-bundle");
  assert.equal(contract.deployment.workerNameOverrideAllowed, false);
  assert.equal(contract.deployment.forwardDeploymentAttempts, 1);
  assert.equal(contract.deployment.automaticRetryAllowed, false);
  assert.equal(contract.authorization.exactConfirmation, PRIVATE_WORKFLOW_V2_POLICY.founderAuthorization);
  assert.deepEqual(contract.authorization.requiredInputs, DEPLOYMENT_INPUTS);
  assert.equal(contract.authorization.consumedAt, "forward_wrangler_process_spawn_confirmed");
  assert.deepEqual(contract.protectedEnvironment.requiredSecretNames, REQUIRED_SECRET_NAMES);
  assert.equal(contract.protectedEnvironment.externalPresenceStateEmbeddedInSource, false);
  assert.equal(
    contract.protectedEnvironment.missingRequiredNameFailure,
    PRIVATE_WORKFLOW_V2_FAILURE.REQUIRED_PROTECTED_SECRET_NAMES_MISSING
  );
  assert.equal(contract.protectedEnvironment.missingRequiredNameBlocksBeforeCloudflareRequest, true);
  assert.equal(
    contract.configurationPreservation.bindingTransition.everyPreexistingBindingRequired,
    true
  );
  assert.deepEqual(
    contract.configurationPreservation.bindingTransition.runtimeGuardPlainTextAdditionsAllowed,
    RUNTIME_GUARD_BINDINGS
  );
  assert.equal(
    contract.configurationPreservation.bindingTransition.unexpectedAdditionsAllowed,
    false
  );
  assert.equal(contract.configurationPreservation.bindingTransition.deletionsAllowed, false);
  assert.equal(
    contract.configurationPreservation.bindingTransition.rollbackPreservesTransitionBindings,
    true
  );
  assert.equal(contract.smoke.writeMethodsAllowed, false);
  assert.equal(contract.smoke.attemptedApplicationWritesRequired, 0);
  assert.equal(contract.smoke.successStatusClass, "2xx");
  assert.equal(contract.smoke.redirectsAllowed, false);
  assert.equal(
    contract.smoke.bootstrap.currentPrivateVersionWithoutGuard,
    PRIVATE_WORKFLOW_V2_POLICY.bootstrapGuardlessPrivateVersion
  );
  assert.equal(contract.smoke.bootstrap.oneTimeTransition, true);
  assert.equal(contract.smoke.bootstrap.accessServiceTokenRequired, true);
  assert.equal(
    contract.smoke.bootstrap.guardResponseMarkerMayBeOmittedOnlyForPinnedCurrentVersion,
    true
  );
  assert.equal(contract.smoke.postDeployment.exactGuardResponseMarkerRequired, true);
  assert.deepEqual(contract.smoke.postDeployment.propagationFence, {
    method: "GET",
    path: "/",
    retryableConditions: [
      "2xx_guard_marker_missing",
      "2xx_exact_guard_marker_stale_qualified_root_sha256"
    ],
    expectedReleaseIdentity: "qualified_forward_root_asset_sha256",
    maximumResponseBytes: 2_097_152,
    maxAttempts: CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.maxAttempts,
    delayMilliseconds: CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.delayMilliseconds,
    requestTimeoutMilliseconds:
      CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.requestTimeoutMilliseconds,
    maximumWaitMilliseconds:
      CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.maximumWaitMilliseconds,
    unsafeResponseRetryAllowed: false,
    requestDeadlineEnforced: true,
    responseBodiesConsumedOrCancelled: true,
    releaseIdentityHashLogged: false,
    fullFixedSmokeRunsAfterReadiness: true,
    timeoutTriggersForwardRollback: true
  });
  assert.equal(
    CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.maximumWaitMilliseconds,
    CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.maxAttempts
      * CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.requestTimeoutMilliseconds
      + (CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.maxAttempts - 1)
        * CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.delayMilliseconds
  );
  assert.equal(contract.smoke.crmSubmissionAllowed, false);
  assert.equal(contract.runtimeGuardInjection.artifactMutationAllowed, false);
  assert.equal(contract.runtimeGuardInjection.temporaryDirectoryMode, "0700");
  assert.equal(contract.runtimeGuardInjection.temporaryConfigMode, "0600");
  assert.equal(contract.runtimeGuardInjection.temporaryBaseSource, "node:os.tmpdir()");
  assert.equal(contract.runtimeGuardInjection.defaultTemporaryBaseCanonicalized, true);
  assert.equal(contract.runtimeGuardInjection.explicitTemporaryBaseAliasesAllowed, false);
  assert.equal(contract.runtimeGuardInjection.runnerTempEnvironmentAliasAllowed, false);
  assert.equal(contract.runtimeGuardInjection.symlinksAllowed, false);
  assert.equal(contract.runtimeGuardInjection.cleanupRequiredInFinally, true);
  assert.deepEqual(contract.runtimeGuardInjection.wranglerScratch, {
    directoryName: "wrangler-scratch",
    location: "runtime-workspace-sibling-of-forward-and-rollback",
    directoryMode: "0700",
    outdirNames: {
      "dry-run": "dry-run",
      deploy: "deploy",
      rollback: "rollback"
    },
    outdirsDistinct: true,
    outdirsUserControlled: false,
    outdirFlagRequiredForEveryPhase: true,
    guardedRootMutationAllowed: false,
    dotWranglerAllowlistedInGuardedRoots: false,
    cleanupWithRuntimeWorkspace: true
  });
  assert.equal(
    contract.runtimeGuardInjection.teamDomainSource,
    "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_TEAM_DOMAIN"
  );
  assert.equal(
    contract.runtimeGuardInjection.audienceSource,
    "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_AUDIENCE"
  );
  assert.equal(
    contract.runtimeGuardInjection.serviceTokenClientIdSource,
    "CLOUDFLARE_ACCESS_CLIENT_ID"
  );
  assert.deepEqual(contract.runtimeGuardInjection.plainTextSettings, RUNTIME_GUARD_BINDINGS);
  assert.equal(contract.failureClassification.fixedNonsecretOnly, true);
  assert.equal(contract.failureClassification.publicDeploymentPolicyDiagnosticsPreserved, true);
  assert.equal(contract.failureClassification.smokeFailureDimensionPreserved, true);
  assert.equal(contract.failureClassification.urlAllowed, false);
  assert.equal(contract.failureClassification.pathAllowed, false);
  assert.equal(contract.failureClassification.httpStatusAllowed, false);
  assert.equal(contract.rollback.nativeCloudflareRollbackAllowed, false);
  assert.equal(contract.rollback.rollbackAttemptsAfterCriticalFailure, 1);
  assert.equal(contract.runtimeBoundaries.prospectiveCollection, "OFF");
  assert.equal(contract.runtimeBoundaries.activeCohortCount, 0);
  assert.equal(contract.runtimeBoundaries.recommendationInfluence, "OFF");
  assert.equal(contract.runtimeBoundaries.anthonyMapped, false);
  assert.equal(contract.releaseBoundary.deploymentAuthorized, false);
  assert.equal(contract.releaseBoundary.productionContactAuthorized, false);

  assert.match(library, /--no-bundle/u);
  assert.match(library, /AUTHORIZATION_CONSUMED/u);
  assert.match(library, /PRIVATE_WORKER_V2_FORWARD_ROLLBACK_VERIFIED/u);
  assert.match(library, /REQUIRED_PROTECTED_SECRET_NAMES_MISSING/u);
  assert.match(library, /BOOTSTRAP_ALLOW_MISSING/u);
  assert.match(library, /RUNTIME_GUARD_WORKSPACE_INVALID/u);
  assert.match(
    library,
    /const base = defaultBase \? realpathSync\(candidate\) : resolve\(candidate\)/u
  );
  assert.match(library, /PRIVATE_V2_WRANGLER_SCRATCH_DIRECTORY/u);
  assert.match(library, /"--outdir"/u);
  assert.doesNotMatch(deploymentRunner, /--outdir/u);
  assert.match(library, /PUBLIC_DEPLOYMENT_POLICY_FAILURE/u);
  assert.match(library, /SMOKE_FAILURE\|DIMENSION=/u);
  assert.doesNotMatch(library, /console\.(?:log|error|warn)/u);
  assert.match(deploymentRunner, /requirePrivateV2ProtectedSecretNames\(environment\)/u);
  assert.ok(
    deploymentRunner.indexOf("requirePrivateV2ProtectedSecretNames(environment)")
      < deploymentRunner.indexOf("takeDeploymentCredentials(environment)")
  );
  assert.match(deploymentRunner, /runCloudflareUnattendedSmoke/u);
  assert.match(deploymentRunner, /runCloudflareUnattendedPostDeploymentSmoke/u);
  assert.match(deploymentRunner, /qualifiedRootAssetSha256/u);
  assert.match(deploymentRunner, /expectedRootSha256/u);
  assert.match(deploymentRunner, /createPrivateV2RuntimeWorkspace/u);
  assert.match(deploymentRunner, /createPrivateV2RuntimeRelease/u);
  assert.match(deploymentRunner, /verifyPrivateV2RuntimeRelease/u);
  assert.match(deploymentRunner, /removePrivateV2RuntimeWorkspace\(runtimeWorkspace\)/u);
  const runtimeWorkspaceCreation = deploymentRunner.indexOf(
    "runtimeWorkspace = createPrivateV2RuntimeWorkspace()"
  );
  const lifecycleStart = deploymentRunner.indexOf(
    "const result = await runQualifiedPrivateDeploymentLifecycle({"
  );
  const forwardWranglerBoundary = deploymentRunner.indexOf(
    "runDeploy: (release, onMutationBoundary)"
  );
  assert.ok(runtimeWorkspaceCreation >= 0);
  assert.doesNotMatch(
    deploymentRunner,
    /createPrivateV2RuntimeWorkspace\(environment\.RUNNER_TEMP\)/u
  );
  assert.ok(runtimeWorkspaceCreation < lifecycleStart);
  assert.ok(lifecycleStart < forwardWranglerBoundary);
  assert.ok(
    deploymentRunner.indexOf("removePrivateV2RuntimeWorkspace(runtimeWorkspace)")
      < deploymentRunner.indexOf("scrubDeploymentCredentials(deploymentCredentials)")
  );
  assert.match(deploymentRunner, /runRollback/u);
  assert.match(smokeRunner, /BOOTSTRAP_ALLOW_MISSING/u);
  assert.match(smokeRunner, /GUARD_MARKER_MISSING/u);
  assert.match(smokeRunner, /GUARD_PROPAGATION_TIMEOUT/u);
  assert.match(smokeRunner, /RELEASE_IDENTITY_MISMATCH/u);
  assert.match(smokeRunner, /waitForCloudflareUnattendedSmokeGuard/u);
  assert.doesNotMatch(smokeRunner, /smoke_guard_verification_failed:/u);
  assert.match(qualificationRunner, /assertNoProductionSecrets/u);
  assert.match(metadataRunner, /verifyPrivateQualificationArtifactMetadata/u);

  const syntheticInputs = Object.freeze({
    approvedCommit: "a".repeat(40),
    approvedTree: "b".repeat(40),
    batchId: "BATCH-20260725-001"
  });
  const verifiedRelease = Object.freeze({
    forwardDirectory: "/qualified/private/runtime/forward",
    rollbackDirectory: "/qualified/private/runtime/rollback",
    scratchDirectory: "/qualified/private/runtime/wrangler-scratch",
    wranglerOutdirs: Object.freeze({
      "dry-run": "/qualified/private/runtime/wrangler-scratch/dry-run",
      deploy: "/qualified/private/runtime/wrangler-scratch/deploy",
      rollback: "/qualified/private/runtime/wrangler-scratch/rollback"
    })
  });
  const deploy = buildQualifiedPrivateWranglerInvocation("deploy", syntheticInputs, verifiedRelease);
  const rollback = buildQualifiedPrivateWranglerInvocation("rollback", syntheticInputs, verifiedRelease);
  assert.equal(deploy.includes("--no-bundle"), true);
  assert.equal(deploy.includes("--keep-vars"), true);
  assert.equal(deploy.includes("--strict"), true);
  assert.equal(deploy.includes("--name"), false);
  assert.equal(deploy.includes(PRIVATE_WORKFLOW_V2_POLICY.publicWorker), false);
  assert.equal(
    deploy[deploy.indexOf("--outdir") + 1],
    verifiedRelease.wranglerOutdirs.deploy
  );
  assert.equal(rollback.includes("--no-bundle"), true);
  assert.equal(
    rollback[rollback.indexOf("--outdir") + 1],
    verifiedRelease.wranglerOutdirs.rollback
  );

  const smoke = fixedCloudflareUnattendedSmokePlan();
  assert.ok(smoke.length > 0);
  assert.ok(smoke.every(request => (
    ["GET", "HEAD"].includes(request.method)
      && request.body === false
      && request.redirect === "manual"
      && request.credentials === "omit"
  )));

  const deployParity = inspectRouteIqPrivateDashboardDeployAssets();
  assert.equal(deployParity.ok, true);
  assert.ok(deployParity.mirrored.every(entry => entry.status === "in_sync"));
  assert.equal(
    createHash("sha256")
      .update(`${JSON.stringify(deployParity, null, 2)}\n`)
      .digest("hex"),
    PRIVATE_WORKFLOW_V2_POLICY.continuityBaseline.deployParitySha256
  );
  const rollbackContract = JSON.parse(read(
    "workers/infrastructure/route-iq-private-forward-rollback-candidate-v3.json"
  ));
  const rollbackConfig = parseJsonc(read(
    "workers/infrastructure/route-iq-private-forward-rollback-wrangler-v3.json"
  ));
  validateRouteIqPrivateForwardRollbackBoundaryV3(rollbackContract, rollbackConfig);
  verifyStaticDeploymentPolicy(root);
  verifyWranglerPin(root);

  return Object.freeze({
    status: "GITHUB_ACTIONS_PRIVATE_WORKER_WORKFLOW_V2_VERIFIED",
    owner: contract.owner,
    deploymentAuthorized: contract.releaseBoundary.deploymentAuthorized,
    productionRequestsPerformed: 0
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${verifyGithubActionsPrivateWorkerWorkflowV2().status}\n`);
}
