#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { isAbsolute, resolve } from "node:path";

import {
  buildQualifiedPublicRelease,
  currentPublicWorkflowRuntimeIdentity,
  formatPublicWorkflowV2Failure,
  publicWorkflowV2SecretEnvironmentNames,
  validatePublicDeploymentV2Inputs,
  validatePublicQualificationInputs,
  verifyQualifiedPublicRelease,
  writeQualificationOutputs
} from "./lib/github-actions-public-worker-workflow-v2.mjs";

const root = resolve(import.meta.dirname, "..");

function requireArtifactPath(environment, name) {
  const path = environment[name];
  if (typeof path !== "string" || path.length < 1 || !isAbsolute(path)) {
    throw new Error("qualified_release_path_invalid");
  }
  return resolve(path);
}

function assertNoGovernedSecrets(environment) {
  for (const name of publicWorkflowV2SecretEnvironmentNames) {
    if (typeof environment[name] === "string" && environment[name].length > 0) {
      throw new Error("qualification_secret_context_invalid");
    }
  }
}

function deploymentExpectedFromQualification(inputs, result) {
  return Object.freeze({
    approvedCommit: inputs.candidateCommit,
    approvedTree: inputs.candidateTree,
    batchId: inputs.batchId,
    currentPublicVersion: inputs.currentPublicVersion,
    currentPrivateVersion: inputs.currentPrivateVersion,
    qualifiedArtifactSha256: result.artifactSha256,
    qualifiedManifestSha256: result.manifestSha256,
    deploymentAssetSha256: result.deploymentAssetsSha256,
    rollbackContractSha256: result.rollbackContractSha256,
    rollbackArtifactSha256: result.rollbackArtifactSha256,
    workflowContractSha256: result.workflowContractSha256
  });
}

export function runPublicWorkerQualificationCommand({
  mode,
  environment = process.env
} = {}) {
  assertNoGovernedSecrets(environment);
  const runtimeIdentity = currentPublicWorkflowRuntimeIdentity(root, environment);
  if (mode === "build") {
    const inputs = validatePublicQualificationInputs(environment);
    const outputDirectory = requireArtifactPath(environment, "PROMETHEUS_QUALIFIED_RELEASE_OUTPUT");
    const result = buildQualifiedPublicRelease(root, {
      outputDirectory,
      inputs,
      runtimeIdentity
    });
    verifyQualifiedPublicRelease(
      root,
      outputDirectory,
      deploymentExpectedFromQualification(inputs, result),
      runtimeIdentity
    );
    writeQualificationOutputs(environment.GITHUB_OUTPUT, result);
    return Object.freeze({ status: "PUBLIC_WORKER_QUALIFICATION_PASSED" });
  }
  if (mode === "verify") {
    const inputs = validatePublicDeploymentV2Inputs(environment);
    const releaseDirectory = requireArtifactPath(environment, "PROMETHEUS_QUALIFIED_RELEASE_PATH");
    verifyQualifiedPublicRelease(root, releaseDirectory, inputs, runtimeIdentity);
    return Object.freeze({ status: "PUBLIC_WORKER_QUALIFIED_ARTIFACT_VERIFIED" });
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
    const result = runPublicWorkerQualificationCommand({ mode });
    process.stdout.write(`${result.status}\n`);
  } catch (error) {
    process.stdout.write(`${formatPublicWorkflowV2Failure(error)}\n`);
    process.exitCode = 1;
  }
}
