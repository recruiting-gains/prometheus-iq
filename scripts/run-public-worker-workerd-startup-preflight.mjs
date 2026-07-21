#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  PUBLIC_DEPLOYMENT_FAILURE,
  PublicDeploymentPolicyError,
  formatPublicDeploymentFailure,
  runPublicWorkerWorkerdStartupPreflight,
  verifyPublicWorkerStartupBoundary,
  verifyPublicWranglerPin
} from "./lib/github-actions-public-worker-deployment.mjs";

const root = resolve(import.meta.dirname, "..");

export async function runPublicWorkerWorkerdStartupPreflightCommand() {
  verifyPublicWorkerStartupBoundary(root);
  verifyPublicWranglerPin(root);
  return runPublicWorkerWorkerdStartupPreflight({ root });
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.length !== 2) {
    process.stdout.write(`${PUBLIC_DEPLOYMENT_FAILURE.INPUT_INVALID}\n`);
    process.exitCode = 1;
  } else {
    try {
      const result = await runPublicWorkerWorkerdStartupPreflightCommand();
      process.stdout.write(`${result.status}\n`);
    } catch (error) {
      const safeError = error instanceof PublicDeploymentPolicyError
        ? error
        : new PublicDeploymentPolicyError(PUBLIC_DEPLOYMENT_FAILURE.WORKER_STARTUP_FAILED, [
          "WORKER_STARTUP_PHASE=LOCAL_WORKERD",
          "WORKER_STARTUP_FAILURE_REASON=UNKNOWN_NONZERO_EXIT"
        ]);
      process.stdout.write(`${formatPublicDeploymentFailure(safeError).join("\n")}\n`);
      process.exitCode = 1;
    }
  }
}
