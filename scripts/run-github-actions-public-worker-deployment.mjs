#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  PUBLIC_DEPLOYMENT_FAILURE,
  PublicDeploymentPolicyError,
  assertPublicBindingsCanBePreserved,
  assertPublicRepositoryIdentity,
  createFounderSettingsSecretFile,
  fetchPublicWorkerState,
  readPublicRepositoryIdentity,
  removeFounderSettingsSecretFile,
  runBoundedPublicWrangler,
  runPublicDeploymentLifecycle,
  scrubPublicDeploymentCredentials,
  takePublicDeploymentCredentials,
  validatePublicFounderDeploymentInputs,
  verifyPublicRepositoryIntegrity,
  verifyPublicStaticDeploymentPolicy,
  verifyPublicWranglerPin
} from "./lib/github-actions-public-worker-deployment.mjs";
import { verifyPublicForwardRollbackArtifact } from "./lib/route-iq-public-forward-rollback.mjs";

const root = resolve(import.meta.dirname, "..");

export async function runPublicWorkerDeploymentCommand({
  mode,
  environment = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  if (mode !== "verify" && mode !== "deploy") {
    throw new PublicDeploymentPolicyError(PUBLIC_DEPLOYMENT_FAILURE.INPUT_INVALID);
  }
  const inputs = validatePublicFounderDeploymentInputs(environment);
  verifyPublicStaticDeploymentPolicy(root);
  verifyPublicWranglerPin(root);
  verifyPublicForwardRollbackArtifact(root, inputs.rollbackArtifactSha256);
  assertPublicRepositoryIdentity(readPublicRepositoryIdentity(root), inputs);
  if (mode === "verify") {
    verifyPublicRepositoryIntegrity(root);
    return Object.freeze({ status: "PUBLIC_WORKER_DEPLOYMENT_PREFLIGHT_PASSED" });
  }

  const credentials = takePublicDeploymentCredentials(environment);
  let settingsArtifact;
  try {
    settingsArtifact = createFounderSettingsSecretFile(credentials);
    return await runPublicDeploymentLifecycle({
      inputs,
      inspectIdentity: () => readPublicRepositoryIdentity(root),
      verifyConfiguration: () => {
        verifyPublicStaticDeploymentPolicy(root);
        verifyPublicWranglerPin(root);
        verifyPublicForwardRollbackArtifact(root, inputs.rollbackArtifactSha256);
      },
      verifyInitialBindings: bindings => assertPublicBindingsCanBePreserved(root, bindings),
      fetchState: worker => fetchPublicWorkerState(worker, credentials, fetchImpl),
      runWrangler: modeName => runBoundedPublicWrangler({
        root,
        mode: modeName,
        inputs,
        credentials,
        secretFile: settingsArtifact.path
      })
    });
  } finally {
    removeFounderSettingsSecretFile(settingsArtifact);
    scrubPublicDeploymentCredentials(credentials);
  }
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [mode, ...extraArguments] = process.argv.slice(2);
  if (extraArguments.length > 0 || (mode !== "verify" && mode !== "deploy")) {
    process.stdout.write(`${PUBLIC_DEPLOYMENT_FAILURE.INPUT_INVALID}\n`);
    process.exitCode = 1;
  } else {
    try {
      const result = await runPublicWorkerDeploymentCommand({ mode });
      process.stdout.write(`${result.status}\n`);
    } catch (error) {
      const code = error instanceof PublicDeploymentPolicyError
        ? error.code
        : mode === "deploy"
          ? PUBLIC_DEPLOYMENT_FAILURE.DEPLOY_FAILED
          : PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED;
      process.stdout.write(`${code}\n`);
      process.exitCode = 1;
    }
  }
}
