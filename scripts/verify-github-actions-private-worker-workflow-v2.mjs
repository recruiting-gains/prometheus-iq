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
  buildQualifiedPrivateWranglerInvocation,
  verifyPrivateV2ApprovedToolingSource,
  verifyPrivateV2InstalledTooling
} from "./lib/github-actions-private-worker-workflow-v2.mjs";
import {
  CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION,
  fixedCloudflareUnattendedSmokePlan
} from "./run-cloudflare-unattended-smoke.mjs";
import {
  CLOUDFLARE_UNATTENDED_SMOKE_SERVER_VERIFICATION,
  CLOUDFLARE_UNATTENDED_SMOKE_VERSION
} from "../workers/infrastructure/cloudflare-unattended-smoke-contract.js";
import {
  ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION
} from "./verify-route-iq-private-paid-customer-production-browser-acceptance.mjs";
import { inspectRouteIqPrivateDashboardDeployAssets } from "./sync-route-iq-private-dashboard-deploy-assets.mjs";
import { validateRouteIqPrivateForwardRollbackBoundaryV3 } from "./build-route-iq-private-forward-rollback-candidate-v3.mjs";

const root = resolve(import.meta.dirname, "..");
const REQUIRED_PATHS = Object.freeze([
  PRIVATE_WORKFLOW_V2_POLICY.qualificationWorkflowPath,
  PRIVATE_WORKFLOW_V2_POLICY.deploymentWorkflowPath,
  PRIVATE_WORKFLOW_V2_POLICY.productionIdentityWorkflowPath,
  PRIVATE_WORKFLOW_V2_POLICY.contractPath,
  PRIVATE_WORKFLOW_V2_POLICY.libraryPath,
  PRIVATE_WORKFLOW_V2_POLICY.qualificationRunnerPath,
  PRIVATE_WORKFLOW_V2_POLICY.deploymentRunnerPath,
  PRIVATE_WORKFLOW_V2_POLICY.productionIdentityRunnerPath,
  PRIVATE_WORKFLOW_V2_POLICY.browserAcceptanceRunnerPath,
  PRIVATE_WORKFLOW_V2_POLICY.browserAcceptanceContractPath,
  PRIVATE_WORKFLOW_V2_POLICY.browserAcceptanceTestPath,
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
  const productionIdentity = read(
    PRIVATE_WORKFLOW_V2_POLICY.productionIdentityWorkflowPath
  );
  const contract = JSON.parse(read(PRIVATE_WORKFLOW_V2_POLICY.contractPath));
  const library = read(PRIVATE_WORKFLOW_V2_POLICY.libraryPath);
  const qualificationRunner = read(PRIVATE_WORKFLOW_V2_POLICY.qualificationRunnerPath);
  const deploymentRunner = read(PRIVATE_WORKFLOW_V2_POLICY.deploymentRunnerPath);
  const productionIdentityRunner = read(
    PRIVATE_WORKFLOW_V2_POLICY.productionIdentityRunnerPath
  );
  const browserAcceptanceRunner = read(
    PRIVATE_WORKFLOW_V2_POLICY.browserAcceptanceRunnerPath
  );
  const browserAcceptanceContract = JSON.parse(read(
    PRIVATE_WORKFLOW_V2_POLICY.browserAcceptanceContractPath
  ));
  const smokeRunner = read(PRIVATE_WORKFLOW_V2_POLICY.smokeRunnerPath);
  const metadataRunner = read(PRIVATE_WORKFLOW_V2_POLICY.metadataRunnerPath);
  const deploymentPreflight = section(deployment, "  preflight:\n", "  deploy:\n");
  const deploymentJob = deployment.slice(deployment.indexOf("  deploy:\n"));

  assert.match(qualification, /^name: Qualify Prometheus Private Worker v2$/mu);
  assert.match(deployment, /^name: Deploy Prometheus Private Worker v2$/mu);
  assert.match(
    productionIdentity,
    /^name: Inspect Prometheus Worker Production Identity$/mu
  );
  assert.deepEqual(triggerInputs(qualification), QUALIFICATION_INPUTS);
  assert.deepEqual(triggerInputs(deployment), DEPLOYMENT_INPUTS);
  assert.deepEqual(triggerInputs(productionIdentity), []);
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
  assertPinnedWorkflowContext(
    productionIdentity,
    PRIVATE_WORKFLOW_V2_POLICY.productionIdentityWorkflowName,
    PRIVATE_WORKFLOW_V2_POLICY.productionIdentityWorkflowPath
  );
  assert.match(
    deployment,
    /inputs\.founder_authorization == 'I AUTHORIZE THIS EXACT PROMETHEUS PRIVATE WORKER DEPLOYMENT'/u
  );
  assert.equal(count(qualification, /^    runs-on: ubuntu-24\.04$/gmu), 1);
  assert.equal(count(deployment, /^    runs-on: ubuntu-24\.04$/gmu), 2);
  assert.equal(count(productionIdentity, /^    runs-on: ubuntu-24\.04$/gmu), 2);
  assert.equal(count(qualification, /^          node-version: "24\.4\.1"$/gmu), 1);
  assert.equal(count(deployment, /^          node-version: "24\.4\.1"$/gmu), 2);
  assert.equal(
    count(productionIdentity, /^          node-version: "24\.4\.1"$/gmu),
    2
  );
  assert.equal(count(qualification, /^        run: npm ci$/gmu), 1);
  for (const suite of ["core", "private", "security", "release"]) {
    assert.equal(count(qualification, new RegExp(`^          npm run test:${suite}$`, "gmu")), 1);
  }
  assert.equal(count(qualification, /npm test/gmu), 0);
  assert.equal(count(deployment, /^          ref: \$\{\{ inputs\.approved_commit \}\}$/gmu), 2);
  assert.equal(count(deployment, /^          ref: main$/gmu), 0);
  assert.equal(count(deployment, /^        run: npm ci --ignore-scripts$/gmu), 2);
  assert.equal(count(deployment, /^        run: npm ci$/gmu), 0);
  assert.equal(
    count(
      deployment,
      /^        run: node scripts\/verify-github-actions-private-worker-workflow-v2\.mjs verify-approved-tooling-source$/gmu
    ),
    2
  );
  assert.equal(
    count(
      deployment,
      /^        run: node scripts\/verify-github-actions-private-worker-workflow-v2\.mjs verify-installed-tooling$/gmu
    ),
    2
  );
  for (const jobSource of [deploymentPreflight, deploymentJob]) {
    const setup = jobSource.indexOf("Set up exact qualification and deployment Node runtime");
    const sourceVerification = jobSource.indexOf(
      "Verify exact approved tooling source before installation"
    );
    const install = jobSource.indexOf("Install exact locked deployment tooling");
    const installedVerification = jobSource.indexOf(
      "Verify installed deployment tooling identity"
    );
    const artifactDownload = jobSource.indexOf(
      "Download only the Founder-pinned private qualification artifact"
    );
    assert.ok(
      setup >= 0
        && setup < sourceVerification
        && sourceVerification < install
        && install < installedVerification
        && installedVerification < artifactDownload
    );
  }
  assert.equal(
    count(deployment, /test "\$\(git rev-parse HEAD\)" = "\$\{\{ inputs\.approved_commit \}\}"/gmu),
    2
  );
  assert.equal(
    count(deployment, /test "\$\(git rev-parse 'HEAD\^\{tree\}'\)" = "\$\{\{ inputs\.approved_tree \}\}"/gmu),
    2
  );
  assert.equal(
    count(
      deployment,
      /git merge-base --is-ancestor "\$\{\{ inputs\.approved_commit \}\}" refs\/remotes\/origin\/main/gmu
    ),
    2
  );
  assert.match(qualification, /group: qualify-prometheus-private-worker-v2-\$\{\{ inputs\.candidate_commit \}\}/u);
  assert.match(deployment, /group: deploy-prometheus-private-worker-v2/u);
  assert.match(qualification, /cancel-in-progress: false/u);
  assert.match(deployment, /cancel-in-progress: false/u);
  assert.match(
    productionIdentity,
    /group: inspect-prometheus-worker-production-identity/u
  );
  assert.match(productionIdentity, /cancel-in-progress: false/u);
  assert.match(deploymentJob, /environment:\n      name: prometheus-private-worker-production/u);
  assert.doesNotMatch(deploymentPreflight, /secrets\.[A-Z0-9_]+/u);
  assert.doesNotMatch(deploymentPreflight, /prometheus-private-worker-production/u);
  assert.doesNotMatch(deployment, /(?:&|\*)private-v2|<<:/u);
  const productionIdentityPreflight = section(
    productionIdentity,
    "  preflight:\n",
    "  inspect:\n"
  );
  const productionIdentityJob = productionIdentity.slice(
    productionIdentity.indexOf("  inspect:\n")
  );
  assert.doesNotMatch(productionIdentityPreflight, /secrets\.[A-Z0-9_]+/u);
  assert.doesNotMatch(
    productionIdentityPreflight,
    /prometheus-private-worker-production/u
  );
  assert.match(
    productionIdentityJob,
    /environment:\n      name: prometheus-private-worker-production/u
  );
  assert.deepEqual(
    [...productionIdentity.matchAll(
      /\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/gu
    )].map(match => match[1]),
    ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]
  );
  assert.equal(
    count(
      productionIdentity,
      /^        run: node scripts\/run-github-actions-private-worker-read-only-identity\.mjs inspect$/gmu
    ),
    1
  );
  assert.doesNotMatch(
    productionIdentity,
    /wrangler|deploy|upload-artifact|download-artifact|curl|(?:^|\s)(?:POST|PUT|PATCH|DELETE)(?:\s|$)/imu
  );

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
  assert.deepEqual(contract.deployment.toolingSourceBinding, {
    checkoutRef: "approved_commit",
    approvedCommitMustRemainAncestorOfMain: true,
    approvedTreeVerifiedBeforeInstall: true,
    installCommand: "npm ci --ignore-scripts",
    lifecycleScriptsAllowed: false,
    packageOverridesAllowed: false,
    governedSourcePaths: ["package.json", "package-lock.json"],
    installedPackageTreeVerified: true,
    installedWranglerIdentityVerified: true,
    verificationBeforeArtifactExecution: true,
    laterMainToolingAllowed: false
  });
  assert.deepEqual(contract.productionIdentityInspection, {
    workflow: PRIVATE_WORKFLOW_V2_POLICY.productionIdentityWorkflowPath,
    runner: PRIVATE_WORKFLOW_V2_POLICY.productionIdentityRunnerPath,
    trigger: "workflow_dispatch",
    protectedEnvironment: "prometheus-private-worker-production",
    founderActor: "PrometheusRouteIQ",
    requiredBranch: "main",
    requiredRunAttempt: 1,
    workerTargets: [
      PRIVATE_WORKFLOW_V2_POLICY.publicWorker,
      PRIVATE_WORKFLOW_V2_POLICY.privateWorker
    ],
    methods: ["GET"],
    cloudflareRequestCount: 4,
    cloudflareMutationAllowed: false,
    deploymentAllowed: false,
    workflowArtifactAllowed: false,
    outputFields: [
      "PUBLIC_VERSION",
      "PRIVATE_VERSION",
      "PUBLIC_TRAFFIC",
      "PRIVATE_TRAFFIC"
    ],
    credentialValuesInOutputAllowed: false,
    responseBodiesInOutputAllowed: false
  });
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
    contract.configurationPreservation.bindingTransition
      .runtimeGuardVersionMetadataAdditionAllowed,
    CLOUDFLARE_UNATTENDED_SMOKE_VERSION.binding
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
  assert.equal(
    Object.hasOwn(contract.smoke.bootstrap, "additionalVerifiedGuardlessRollbackVersion"),
    false
  );
  assert.equal(contract.smoke.bootstrap.oneTimeTransition, true);
  assert.equal(contract.smoke.bootstrap.accessServiceTokenRequired, true);
  assert.equal(
    contract.smoke.bootstrap.guardResponseMarkerMayBeOmittedOnlyForPinnedCurrentVersion,
    true
  );
  assert.equal(contract.smoke.postDeployment.exactGuardResponseMarkerRequired, true);
  assert.equal(contract.smoke.postDeployment.latestFailedRun, "30519465645");
  assert.equal(
    contract.smoke.postDeployment.latestFailureClassification,
    "SMOKE_FAILURE|DIMENSION=NETWORK_FAILED|PROBE=BUSINESS_HOURS_GET"
  );
  assert.equal(contract.smoke.postDeployment.latestFailureForwardRollbackVerified, true);
  assert.match(
    contract.smoke.postDeployment.routingCorrection,
    /canonical root GET/u
  );
  assert.match(contract.smoke.postDeployment.routingCorrection, /monotonic deadline/u);
  assert.match(contract.smoke.postDeployment.routingCorrection, /each probe/u);
  assert.match(contract.smoke.postDeployment.routingCorrection, /shared deadline/u);
  assert.deepEqual(contract.smoke.postDeployment.propagationFence, {
    scope: "canonical_root_get_then_each_fixed_probe",
    readinessProbe: "GET /",
    unconditionalWorkerFirst: true,
    concurrentRequestsPerAttempt: false,
    fixedNonsecretProbeClassification: true,
    retryableConditions: [
      "2xx_guard_marker_missing",
      "2xx_exact_guard_marker_worker_version_missing",
      "2xx_exact_guard_marker_stale_worker_version"
    ],
    expectedReleaseIdentity: "cloudflare_worker_version_id",
    versionMetadataBinding: CLOUDFLARE_UNATTENDED_SMOKE_VERSION.binding,
    versionResponseHeader: CLOUDFLARE_UNATTENDED_SMOKE_VERSION.responseHeader,
    monotonicElapsedDeadline: true,
    attemptLimitControlsAcceptance: false,
    delayMilliseconds: CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.delayMilliseconds,
    serverJwksTimeoutMilliseconds:
      CLOUDFLARE_UNATTENDED_SMOKE_SERVER_VERIFICATION.jwksTimeoutMilliseconds,
    responseSafetyMarginMilliseconds:
      CLOUDFLARE_UNATTENDED_SMOKE_SERVER_VERIFICATION.responseSafetyMarginMilliseconds,
    requestTimeoutMilliseconds:
      CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.requestTimeoutMilliseconds,
    maximumWaitMilliseconds:
      CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.maximumWaitMilliseconds,
    sleepMustAdvanceMonotonicClock: true,
    unsafeResponseRetryAllowed: false,
    requestAndResponseLifecycleDeadlineEnforced: true,
    fullSmokeRequestLifecycleDeadlineEnforced: true,
    responseBodiesConsumedOrCancelled: true,
    releaseIdentityValueLogged: false,
    finalExactRootProbeIsReadiness: true,
    fullFixedSmokeRunsAfterReadiness: true,
    fullFixedSmokeExecution: "sequential_bounded_propagation_per_probe",
    fullFixedSmokeSharedDeadline: true,
    timeoutTriggersForwardRollback: true
  });
  assert.ok(
    CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.maximumWaitMilliseconds
      > CLOUDFLARE_UNATTENDED_SMOKE_PROPAGATION.requestTimeoutMilliseconds
        * fixedCloudflareUnattendedSmokePlan().length
  );
  assert.equal(contract.smoke.crmSubmissionAllowed, false);
  assert.deepEqual(contract.browserAcceptance, {
    contract: PRIVATE_WORKFLOW_V2_POLICY.browserAcceptanceContractPath,
    runner: PRIVATE_WORKFLOW_V2_POLICY.browserAcceptanceRunnerPath,
    authentication:
      "Cloudflare Access service principal values injected only into intercepted request headers",
    viewports: ["1440x900", "390x844"],
    allowedMethods: ["GET", "HEAD", "OPTIONS"],
    writeAttemptsRequired: 0,
    browserVersionStability: {
      scriptExecutionAllowed: false,
      cacheAllowed: false,
      requiredConsecutiveExactProbes: 3,
      maximumAttempts: 10,
      applicationExecutionBeforeStabilityAllowed: false,
      failureTriggersForwardRollback: true
    },
    serviceWorkerPersistenceAllowed: false,
    configuredOrSafeEmptyStateRequired: true,
    exactPrivateWorkerVersionRequired: true,
    publicWorkerIdentityFencedBeforeAndAfter: true,
    credentialValuesInOutputAllowed: false,
    healthFailureClassification: {
      closedVocabulary: [
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.DESKTOP_CONSOLE_ERROR,
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.DESKTOP_RUNTIME_EXCEPTION,
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.DESKTOP_NETWORK_FAILURE,
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.DESKTOP_NETWORK_HTTP_FAILURE,
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.DESKTOP_EXTERNAL_REQUEST,
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.MOBILE_CONSOLE_ERROR,
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.MOBILE_RUNTIME_EXCEPTION,
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.MOBILE_NETWORK_FAILURE,
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.MOBILE_NETWORK_HTTP_FAILURE,
        ROUTE_IQ_PRIVATE_BROWSER_ACCEPTANCE_FAILURE_DIMENSION.MOBILE_EXTERNAL_REQUEST
      ],
      viewportEncoded: true,
      allMatchingDimensionsReported: true,
      safeDiagnosticCategoriesReported: true,
      guardedServiceWorkerNetworkLogRequiresExactCorrelatedBlock: true,
      arbitraryMessagesAllowed: false,
      sensitiveValuesAllowed: false
    }
  });
  assert.equal(
    browserAcceptanceContract.contractVersion,
    "route-iq-private-paid-customer-browser-acceptance-v1"
  );
  assert.equal(browserAcceptanceContract.ownerSubsystem, "Prometheus Infrastructure");
  assert.equal(browserAcceptanceContract.targetWorker, PRIVATE_WORKFLOW_V2_POLICY.privateWorker);
  assert.deepEqual(browserAcceptanceContract.viewports, [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 }
  ]);
  assert.deepEqual(
    browserAcceptanceContract.network.allowedMethods,
    ["GET", "HEAD", "OPTIONS"]
  );
  assert.equal(browserAcceptanceContract.network.writeAttemptsRequired, 0);
  assert.deepEqual(
    browserAcceptanceContract.network.browserVersionStability,
    {
      scriptExecutionAllowed: false,
      cacheAllowed: false,
      requiredConsecutiveExactProbes: 3,
      maximumAttempts: 10,
      delayMilliseconds: 1500,
      probeTimeoutMilliseconds: 15000,
      nonReadRequestsAllowed: 0,
      externalRequestsAllowed: 0,
      applicationExecutionBeforeStabilityAllowed: false
    }
  );
  assert.equal(browserAcceptanceContract.network.serviceWorkerPersistenceAllowed, false);
  assert.equal(browserAcceptanceContract.network.sameOriginHttp4xxOr5xxAllowed, false);
  assert.deepEqual(browserAcceptanceContract.network.guardedServiceWorkerNetworkLogAcceptance, {
    source: "network",
    exactPath: "/sw.js",
    correlatedBlockedRequestRequired: true,
    allServiceWorkerRequestsBlockedRequired: true,
    persistedRegistrationCountRequired: 0,
    allOtherBrowserErrorsAllowed: false
  });
  assert.equal(
    browserAcceptanceContract.acceptance.configuredOrSafeEmptyStateRequired,
    true
  );
  assert.equal(
    browserAcceptanceContract.acceptance.publicWorkerIdentityMustRemainExact,
    true
  );
  assert.equal(browserAcceptanceContract.acceptance.networkHttpFailuresAllowed, 0);
  assert.equal(browserAcceptanceContract.diagnostics.allMatchingFailureDimensionsReported, true);
  assert.equal(
    browserAcceptanceContract.diagnostics.rawMessagesUrlsHeadersStacksOrCredentialsAllowed,
    false
  );
  assert.equal(browserAcceptanceContract.safety.productionWritesAllowed, false);
  assert.equal(browserAcceptanceContract.safety.collection, "OFF");
  assert.equal(browserAcceptanceContract.safety.activeCohorts, 0);
  assert.equal(browserAcceptanceContract.safety.recommendationInfluence, "OFF");
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
  assert.equal(
    contract.runtimeGuardInjection.versionMetadataBinding,
    CLOUDFLARE_UNATTENDED_SMOKE_VERSION.binding
  );
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
  assert.match(deploymentRunner, /runRouteIqPrivateProductionBrowserAcceptance/u);
  const browserAcceptanceCall = deploymentRunner.indexOf(
    "await runRouteIqPrivateProductionBrowserAcceptance"
  );
  assert.equal(
    deploymentRunner.indexOf("publicBeforeBrowser")
      < browserAcceptanceCall,
    true
  );
  assert.equal(
    browserAcceptanceCall < deploymentRunner.indexOf("publicAfterBrowser"),
    true
  );
  assert.match(deploymentRunner, /expectedWorkerVersion/u);
  assert.doesNotMatch(deploymentRunner, /qualifiedRootAssetSha256|expectedRootSha256/u);
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
  assert.match(smokeRunner, /CANONICAL_READINESS_REQUEST/u);
  assert.match(smokeRunner, /entry\.method === "GET" && entry\.path === "\/"/u);
  assert.doesNotMatch(
    smokeRunner,
    /Promise\.allSettled\(CANONICAL_SMOKE_REQUESTS/u
  );
  assert.match(smokeRunner, /fullPlanPropagationRequestCount/u);
  assert.match(smokeRunner, /CLOUDFLARE_UNATTENDED_SMOKE_VERSION/u);
  assert.match(smokeRunner, /new AbortController\(\)/u);
  assert.match(smokeRunner, /discardResponseBody\(response\)/u);
  assert.doesNotMatch(smokeRunner, /expectedRootSha256|hashBoundedResponseBody/u);
  assert.doesNotMatch(smokeRunner, /smoke_guard_verification_failed:/u);
  assert.match(qualificationRunner, /assertNoProductionSecrets/u);
  assert.match(metadataRunner, /verifyPrivateQualificationArtifactMetadata/u);
  assert.match(browserAcceptanceRunner, /Network\.setBypassServiceWorker/u);
  assert.match(browserAcceptanceRunner, /Fetch\.failRequest/u);
  assert.match(browserAcceptanceRunner, /attemptedWrites !== 0/u);
  assert.match(browserAcceptanceRunner, /configuredOrSafeEmpty/u);
  assert.match(browserAcceptanceRunner, /horizontalOverflow/u);
  assert.match(browserAcceptanceRunner, /expectedWorkerVersion/u);
  assert.doesNotMatch(browserAcceptanceRunner, /console\.(?:log|error|warn)/u);
  assert.match(
    productionIdentityRunner,
    /fetchPublicWorkerState/u
  );
  assert.match(
    productionIdentityRunner,
    /takeDeploymentCredentials/u
  );
  assert.match(
    productionIdentityRunner,
    /scrubDeploymentCredentials/u
  );
  assert.doesNotMatch(
    productionIdentityRunner,
    /console\.|wrangler|(?:^|\s)(?:POST|PUT|PATCH|DELETE)(?:\s|$)/imu
  );

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
  const mode = process.argv[2] || "verify-workflow";
  let result;
  if (mode === "verify-approved-tooling-source") {
    result = verifyPrivateV2ApprovedToolingSource({
      repositoryRoot: root,
      approvedCommit: process.env.PROMETHEUS_APPROVED_COMMIT,
      approvedTree: process.env.PROMETHEUS_APPROVED_TREE
    });
  } else if (mode === "verify-installed-tooling") {
    result = verifyPrivateV2InstalledTooling({ repositoryRoot: root });
  } else if (mode === "verify-workflow") {
    result = verifyGithubActionsPrivateWorkerWorkflowV2();
  } else {
    throw new Error("PRIVATE_WORKER_V2_VERIFIER_MODE_INVALID");
  }
  process.stdout.write(`${result.status}\n`);
}
