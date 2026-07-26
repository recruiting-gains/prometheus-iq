#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  fetchPublicWorkerState,
  runBoundedPublicWrangler
} from "./lib/github-actions-public-worker-deployment.mjs";
import {
  scrubDeploymentCredentials,
  takeDeploymentCredentials
} from "./lib/github-actions-private-worker-deployment.mjs";
import {
  assertQualifiedPrivateConfigCanPreserveBindings,
  buildQualifiedPrivateWranglerInvocation,
  createPrivateDeploymentEvidenceRecorder,
  createPrivateV2RuntimeRelease,
  createPrivateV2RuntimeWorkspace,
  createPrivateV2EvidenceDirectory,
  currentPrivateV2RuntimeIdentity,
  formatPrivateWorkflowV2Failure,
  removePrivateV2RuntimeWorkspace,
  requirePrivateV2ProtectedSecretNames,
  releaseDirectoryFromEnvironment,
  runQualifiedPrivateDeploymentLifecycle,
  scrubPrivateV2RuntimeGuardSettings,
  takePrivateV2RuntimeGuardSettings,
  validatePrivateV2DeploymentInputs,
  verifyPrivateV2RuntimeRelease,
  verifyPrivateV2RepositoryBoundary,
  verifyQualifiedPrivateRelease
} from "./lib/github-actions-private-worker-workflow-v2.mjs";
import {
  CLOUDFLARE_UNATTENDED_SMOKE_FAILURE,
  CloudflareUnattendedSmokeError,
  runCloudflareUnattendedSmoke
} from "./run-cloudflare-unattended-smoke.mjs";

const root = resolve(import.meta.dirname, "..");
const smokeCredentialNames = Object.freeze([
  "CLOUDFLARE_ACCESS_CLIENT_ID",
  "CLOUDFLARE_ACCESS_CLIENT_SECRET"
]);

function takeSmokeCredentials(environment) {
  const credentials = {};
  for (const name of smokeCredentialNames) {
    credentials[name] = environment[name];
    delete environment[name];
    if (typeof credentials[name] !== "string"
      || credentials[name].length < 1
      || credentials[name].length > 4096) {
      scrubSmokeCredentials(credentials);
      throw new CloudflareUnattendedSmokeError(
        CLOUDFLARE_UNATTENDED_SMOKE_FAILURE.CREDENTIALS_INVALID
      );
    }
  }
  return credentials;
}

function scrubSmokeCredentials(credentials) {
  if (!credentials) return;
  for (const name of smokeCredentialNames) credentials[name] = "";
}

export async function runPrivateWorkerDeploymentV2Command({
  mode,
  environment = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  if (mode !== "deploy") throw new Error("private_deployment_v2_mode_invalid");
  const inputs = validatePrivateV2DeploymentInputs(environment);
  const releaseDirectory = releaseDirectoryFromEnvironment(environment);
  const runtimeIdentity = currentPrivateV2RuntimeIdentity(root, environment);
  const verifyImmutableRelease = () => verifyQualifiedPrivateRelease(
    root,
    releaseDirectory,
    inputs,
    runtimeIdentity
  );
  const verifiedArtifact = verifyImmutableRelease();
  requirePrivateV2ProtectedSecretNames(environment);

  let deploymentCredentials;
  let smokeCredentials;
  let runtimeGuardSettings;
  let runtimeWorkspace;
  try {
    deploymentCredentials = takeDeploymentCredentials(environment);
    smokeCredentials = takeSmokeCredentials(environment);
    runtimeGuardSettings = takePrivateV2RuntimeGuardSettings(
      environment,
      smokeCredentials.CLOUDFLARE_ACCESS_CLIENT_ID
    );
    runtimeWorkspace = createPrivateV2RuntimeWorkspace();
    const runtimeRelease = createPrivateV2RuntimeRelease({
      workspace: runtimeWorkspace,
      verifiedRelease: verifiedArtifact,
      settings: runtimeGuardSettings
    });
    const verifyRelease = () => {
      verifyImmutableRelease();
      verifyPrivateV2RuntimeRelease(runtimeRelease, runtimeGuardSettings);
      return runtimeRelease;
    };
    const result = await runQualifiedPrivateDeploymentLifecycle({
      inputs,
      verifyRelease,
      inspectRepository: () => verifyPrivateV2RepositoryBoundary(
        root,
        inputs.approvedCommit,
        inputs.approvedTree
      ),
      fetchState: worker => fetchPublicWorkerState(
        worker,
        deploymentCredentials,
        fetchImpl
      ),
      verifyInitialBindings: assertQualifiedPrivateConfigCanPreserveBindings,
      runPreSmoke: ({ markerPolicy }) => runCloudflareUnattendedSmoke({
        fetchImpl,
        credentials: smokeCredentials,
        dryRun: false,
        markerPolicy
      }),
      runDryRun: release => runBoundedPublicWrangler({
        root,
        mode: "dry-run",
        inputs,
        credentials: deploymentCredentials,
        invocationBuilder: () => buildQualifiedPrivateWranglerInvocation(
          "dry-run",
          inputs,
          release
        )
      }),
      runDeploy: (release, onMutationBoundary) => runBoundedPublicWrangler({
        root,
        mode: "deploy",
        inputs,
        credentials: deploymentCredentials,
        onProcessStarted: onMutationBoundary,
        invocationBuilder: () => buildQualifiedPrivateWranglerInvocation(
          "deploy",
          inputs,
          release
        )
      }),
      runPostSmoke: ({ markerPolicy }) => runCloudflareUnattendedSmoke({
        fetchImpl,
        credentials: smokeCredentials,
        dryRun: false,
        markerPolicy
      }),
      runRollback: release => runBoundedPublicWrangler({
        root,
        mode: "deploy",
        inputs,
        credentials: deploymentCredentials,
        invocationBuilder: () => buildQualifiedPrivateWranglerInvocation(
          "rollback",
          inputs,
          release
        )
      }),
      evidence: createPrivateDeploymentEvidenceRecorder(
        createPrivateV2EvidenceDirectory(environment)
      )
    });
    verifyRelease();
    return result;
  } finally {
    removePrivateV2RuntimeWorkspace(runtimeWorkspace);
    scrubPrivateV2RuntimeGuardSettings(runtimeGuardSettings);
    scrubSmokeCredentials(smokeCredentials);
    scrubDeploymentCredentials(deploymentCredentials);
  }
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [mode, ...extra] = process.argv.slice(2);
  try {
    if (extra.length > 0 || mode !== "deploy") {
      throw new Error("private_deployment_v2_arguments_invalid");
    }
    const result = await runPrivateWorkerDeploymentV2Command({ mode });
    const classification = result.failureClassification
      ? `${result.status}|CAUSE=${result.failureClassification}`
      : result.status;
    process.stdout.write(`${classification}\n`);
    if (result.status === "PRIVATE_WORKER_V2_FORWARD_ROLLBACK_VERIFIED") {
      process.exitCode = 1;
    }
  } catch (error) {
    process.stdout.write(`${formatPrivateWorkflowV2Failure(error)}\n`);
    process.exitCode = 1;
  }
}
