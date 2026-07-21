#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  assertPublicBindingsCanBePreserved,
  assertPublicBindingsPreserved,
  createFounderSettingsSecretFile,
  fetchPublicWorkerState,
  readPublicRepositoryIdentity,
  removeFounderSettingsSecretFile,
  runBoundedPublicWrangler,
  scrubPublicDeploymentCredentials,
  takePublicDeploymentCredentials
} from "./lib/github-actions-public-worker-deployment.mjs";
import { runPublicWorkerSmokeV2 } from "./lib/cloudflare-public-worker-smoke-v2.mjs";
import {
  buildQualifiedPublicWranglerInvocation,
  createPublicDeploymentEvidenceRecorder,
  createTemporaryEvidenceDirectory,
  currentPublicWorkflowRuntimeIdentity,
  formatPublicWorkflowV2Failure,
  releaseDirectoryFromEnvironment,
  runQualifiedPublicDeploymentLifecycle,
  validatePublicDeploymentV2Inputs,
  verifyQualifiedPublicRelease
} from "./lib/github-actions-public-worker-workflow-v2.mjs";

const root = resolve(import.meta.dirname, "..");

export async function runPublicWorkerDeploymentV2Command({
  mode,
  environment = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  if (mode !== "deploy") throw new Error("public_deployment_v2_mode_invalid");
  const inputs = validatePublicDeploymentV2Inputs(environment);
  const releaseDirectory = releaseDirectoryFromEnvironment(environment);
  const runtimeIdentity = currentPublicWorkflowRuntimeIdentity(root, environment);
  const verifyRelease = () => verifyQualifiedPublicRelease(
    root,
    releaseDirectory,
    inputs,
    runtimeIdentity
  );
  verifyRelease();

  const credentials = takePublicDeploymentCredentials(environment);
  let settingsArtifact;
  try {
    settingsArtifact = createFounderSettingsSecretFile(credentials);
    const evidence = createPublicDeploymentEvidenceRecorder(
      createTemporaryEvidenceDirectory(environment)
    );
    const result = await runQualifiedPublicDeploymentLifecycle({
      inputs,
      verifyRelease,
      inspectIdentity: () => readPublicRepositoryIdentity(root),
      verifyInitialBindings: bindings => assertPublicBindingsCanBePreserved(root, bindings),
      assertBindingsPreserved: assertPublicBindingsPreserved,
      fetchState: worker => fetchPublicWorkerState(worker, credentials, fetchImpl),
      runDryRun: release => runBoundedPublicWrangler({
        root,
        mode: "dry-run",
        inputs,
        credentials,
        secretFile: settingsArtifact.path,
        invocationBuilder: () => buildQualifiedPublicWranglerInvocation(
          "dry-run",
          inputs,
          settingsArtifact.path,
          release
        )
      }),
      runDeploy: (release, onMutationBoundary) => runBoundedPublicWrangler({
        root,
        mode: "deploy",
        inputs,
        credentials,
        secretFile: settingsArtifact.path,
        onProcessStarted: onMutationBoundary,
        invocationBuilder: () => buildQualifiedPublicWranglerInvocation(
          "deploy",
          inputs,
          settingsArtifact.path,
          release
        )
      }),
      runRollback: release => runBoundedPublicWrangler({
        root,
        mode: "deploy",
        inputs,
        credentials,
        secretFile: settingsArtifact.path,
        invocationBuilder: () => buildQualifiedPublicWranglerInvocation(
          "rollback",
          inputs,
          settingsArtifact.path,
          release
        )
      }),
      runSmoke: () => runPublicWorkerSmokeV2({ fetchImpl }),
      evidence
    });
    verifyRelease();
    return result;
  } finally {
    removeFounderSettingsSecretFile(settingsArtifact);
    scrubPublicDeploymentCredentials(credentials);
  }
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [mode, ...extra] = process.argv.slice(2);
  try {
    if (extra.length > 0 || mode !== "deploy") {
      throw new Error("public_deployment_v2_arguments_invalid");
    }
    const result = await runPublicWorkerDeploymentV2Command({ mode });
    process.stdout.write(`${result.status}\n`);
    if (result.status === "PUBLIC_WORKER_FORWARD_ROLLBACK_VERIFIED") process.exitCode = 1;
  } catch (error) {
    process.stdout.write(`${formatPublicWorkflowV2Failure(error)}\n`);
    process.exitCode = 1;
  }
}
