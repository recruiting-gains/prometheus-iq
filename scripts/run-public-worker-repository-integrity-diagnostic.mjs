#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  PUBLIC_DEPLOYMENT_FAILURE,
  PUBLIC_WORKER_DEPLOYMENT_POLICY,
  PublicDeploymentPolicyError,
  formatPublicDeploymentFailure,
  readPublicRepositoryIdentity,
  verifyPublicRepositoryIntegrity
} from "./lib/github-actions-public-worker-deployment.mjs";

const root = resolve(import.meta.dirname, "..");

export function runPublicRepositoryIntegrityDiagnostic(repositoryRoot = root) {
  const identity = readPublicRepositoryIdentity(repositoryRoot);
  if (identity.head !== identity.originMain
    || identity.branch !== PUBLIC_WORKER_DEPLOYMENT_POLICY.branch
    || ![
      PUBLIC_WORKER_DEPLOYMENT_POLICY.repositoryUrl,
      `${PUBLIC_WORKER_DEPLOYMENT_POLICY.repositoryUrl}.git`,
      PUBLIC_WORKER_DEPLOYMENT_POLICY.repositorySshUrl
    ].includes(identity.originUrl)) {
    throw new PublicDeploymentPolicyError(PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_IDENTITY_MISMATCH);
  }
  if (identity.status !== "" || !identity.unstagedClean || !identity.stagedClean) {
    throw new PublicDeploymentPolicyError(PUBLIC_DEPLOYMENT_FAILURE.REPOSITORY_DIRTY);
  }
  const integrity = verifyPublicRepositoryIntegrity(repositoryRoot);
  return Object.freeze({
    status: "PUBLIC_REPOSITORY_INTEGRITY_PASS",
    head: identity.head,
    tree: identity.tree,
    originMain: identity.originMain,
    ...integrity
  });
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const result = runPublicRepositoryIntegrityDiagnostic();
    process.stdout.write([
      result.status,
      `HEAD=${result.head}`,
      `TREE=${result.tree}`,
      `ORIGIN_MAIN=${result.originMain}`,
      `GIT_VERSION=${result.gitVersion}`,
      `SHALLOW=${result.shallow}`,
      `OBJECT_FORMAT=${result.objectFormat}`,
      `PARTIAL_CLONE=${result.partialClone}`,
      `PROMISOR=${result.promisor}`,
      `REF_COUNT=${result.refCount}`
    ].join("\n") + "\n");
  } catch (error) {
    process.stdout.write(`${formatPublicDeploymentFailure(error, "verify").join("\n")}\n`);
    process.exitCode = 1;
  }
}
