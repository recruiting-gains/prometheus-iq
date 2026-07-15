import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  DEPLOYMENT_FAILURE,
  DeploymentPolicyError,
  assertRepositoryIdentity,
  fetchDeploymentSnapshot,
  readRepositoryIdentity,
  runBoundedWrangler,
  runDeploymentLifecycle,
  scrubDeploymentCredentials,
  takeDeploymentCredentials,
  validateFounderDeploymentInputs,
  verifyRepositoryIntegrity,
  verifyStaticDeploymentPolicy,
  verifyWranglerPin
} from "./lib/github-actions-private-worker-deployment.mjs";

const root = resolve(import.meta.dirname, "..");

export async function runPrivateWorkerDeploymentCommand({
  mode,
  environment = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  if (mode !== "verify" && mode !== "deploy") {
    throw new DeploymentPolicyError(DEPLOYMENT_FAILURE.INPUT_INVALID);
  }
  const inputs = validateFounderDeploymentInputs(environment);
  verifyStaticDeploymentPolicy(root);
  verifyWranglerPin(root);
  assertRepositoryIdentity(readRepositoryIdentity(root), inputs);
  if (mode === "verify") {
    verifyRepositoryIntegrity(root);
    return Object.freeze({ status: "PRIVATE_WORKER_DEPLOYMENT_PREFLIGHT_PASSED" });
  }

  const credentials = takeDeploymentCredentials(environment);
  try {
    return await runDeploymentLifecycle({
      inputs,
      inspectIdentity: () => readRepositoryIdentity(root),
      verifyConfiguration: () => {
        verifyStaticDeploymentPolicy(root);
        verifyWranglerPin(root);
      },
      fetchSnapshot: worker => fetchDeploymentSnapshot(worker, credentials, fetchImpl),
      runWrangler: modeName => runBoundedWrangler({
        root,
        mode: modeName,
        inputs,
        credentials
      })
    });
  } finally {
    scrubDeploymentCredentials(credentials);
  }
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [mode, ...extraArguments] = process.argv.slice(2);
  if (extraArguments.length > 0 || (mode !== "verify" && mode !== "deploy")) {
    console.error(DEPLOYMENT_FAILURE.INPUT_INVALID);
    process.exitCode = 1;
  } else {
    try {
      const result = await runPrivateWorkerDeploymentCommand({ mode });
      console.log(result.status);
    } catch (error) {
      const code = error instanceof DeploymentPolicyError
        ? error.code
        : mode === "deploy" ? DEPLOYMENT_FAILURE.DEPLOY_FAILED : DEPLOYMENT_FAILURE.REPOSITORY_INTEGRITY_FAILED;
      console.error(code);
      process.exitCode = 1;
    }
  }
}
