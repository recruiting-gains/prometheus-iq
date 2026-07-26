#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  buildQualifiedPrivateRelease,
  currentPrivateV2RuntimeIdentity,
  formatPrivateWorkflowV2Failure,
  privateWorkflowV2SecretEnvironmentNames,
  releaseDirectoryFromEnvironment,
  validatePrivateV2DeploymentInputs,
  validatePrivateV2QualificationInputs,
  verifyQualifiedPrivateRelease,
  writePrivateV2QualificationOutputs
} from "./lib/github-actions-private-worker-workflow-v2.mjs";

const root = resolve(import.meta.dirname, "..");

function assertNoProductionSecrets(environment) {
  for (const name of privateWorkflowV2SecretEnvironmentNames) {
    if (typeof environment[name] === "string" && environment[name].length > 0) {
      throw new Error("qualification_secret_context_invalid");
    }
  }
}

function qualificationExpected(inputs, result) {
  return Object.freeze({
    approvedCommit: inputs.candidateCommit,
    approvedTree: inputs.candidateTree,
    batchId: inputs.batchId,
    currentPublicVersion: inputs.currentPublicVersion,
    currentPrivateVersion: inputs.currentPrivateVersion,
    qualifiedContentTreeSha256: result.contentTreeSha256,
    qualifiedManifestSha256: result.manifestSha256,
    workflowContractSha256: result.workflowContractSha256,
    rollbackContractSha256: result.rollbackContractSha256,
    rollbackBundleSha256: result.rollbackBundleSha256
  });
}

export function runPrivateWorkerQualificationV2Command({
  mode,
  environment = process.env
} = {}) {
  assertNoProductionSecrets(environment);
  const runtimeIdentity = currentPrivateV2RuntimeIdentity(root, environment);
  if (mode === "build") {
    const inputs = validatePrivateV2QualificationInputs(environment);
    const outputDirectory = environment.PROMETHEUS_QUALIFIED_RELEASE_OUTPUT;
    if (typeof outputDirectory !== "string" || !outputDirectory.startsWith("/")) {
      throw new Error("qualified_release_output_invalid");
    }
    const result = buildQualifiedPrivateRelease(root, {
      outputDirectory,
      inputs,
      runtimeIdentity
    });
    verifyQualifiedPrivateRelease(
      root,
      outputDirectory,
      qualificationExpected(inputs, result),
      runtimeIdentity
    );
    writePrivateV2QualificationOutputs(environment.GITHUB_OUTPUT, result);
    return Object.freeze({ status: "PRIVATE_WORKER_V2_QUALIFICATION_PASSED" });
  }
  if (mode === "verify") {
    const inputs = validatePrivateV2DeploymentInputs(environment);
    verifyQualifiedPrivateRelease(
      root,
      releaseDirectoryFromEnvironment(environment),
      inputs,
      runtimeIdentity
    );
    return Object.freeze({ status: "PRIVATE_WORKER_V2_QUALIFIED_ARTIFACT_VERIFIED" });
  }
  throw new Error("qualification_mode_invalid");
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [mode, ...extra] = process.argv.slice(2);
  try {
    if (extra.length > 0 || !["build", "verify"].includes(mode)) {
      throw new Error("qualification_arguments_invalid");
    }
    const result = runPrivateWorkerQualificationV2Command({ mode });
    process.stdout.write(`${result.status}\n`);
  } catch (error) {
    process.stdout.write(`${formatPrivateWorkflowV2Failure(error)}\n`);
    process.exitCode = 1;
  }
}
