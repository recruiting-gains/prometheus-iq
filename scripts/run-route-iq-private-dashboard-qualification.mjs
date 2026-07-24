#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildRouteIqPrivateForwardRollbackCandidateV3
} from "./build-route-iq-private-forward-rollback-candidate-v3.mjs";
import {
  inspectRouteIqPrivateDashboardDeployAssets
} from "./sync-route-iq-private-dashboard-deploy-assets.mjs";

const root = resolve(import.meta.dirname, "..");
const qualificationContractPath = "workers/infrastructure/github-actions-route-iq-private-dashboard-qualification-v1.json";
const rollbackContractPath = "workers/infrastructure/route-iq-private-forward-rollback-candidate-v3.json";
const rollbackWranglerPath = "workers/infrastructure/route-iq-private-forward-rollback-wrangler-v3.json";
const rollbackInertPath = "workers/infrastructure/route-iq-private-forward-rollback-inert-durable-object-v3.js";
const rollbackBuilderPath = "scripts/build-route-iq-private-forward-rollback-candidate-v3.mjs";
const canonicalZipIntegrationPaths = Object.freeze({
  workspaceConfiguration: "administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json",
  dashboardPlatform: "dashboard/route-iq-dashboard-platform.mjs",
  customerPwaRuntime: "workers/infrastructure/route-iq-august-1-customer-pwa-runtime.js",
  infrastructureAuthorization: "workers/infrastructure/route-iq-multi-company-runtime-authorization.js"
});
const qualificationManifestName = "route-iq-private-dashboard-qualification-manifest.json";
const deployParityName = "route-iq-private-dashboard-deploy-parity.json";
const secretNames = Object.freeze([
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_ACCESS_CLIENT_ID",
  "CLOUDFLARE_ACCESS_CLIENT_SECRET"
]);

function git(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  }).trim();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path) {
  return sha256(readFileSync(resolve(root, path)));
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function walkFiles(directory, base = directory) {
  const entries = [];
  for (const entry of execFileSync("find", [directory, "-type", "f"], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean)
    .sort()) {
    entries.push(entry.startsWith(base) ? entry.slice(base.length + 1) : basename(entry));
  }
  return entries;
}

function contentTreeSha256(directory) {
  const hash = createHash("sha256");
  for (const path of walkFiles(directory)) {
    hash.update(path);
    hash.update("\0");
    hash.update(readFileSync(join(directory, path)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function requireExactEnvironment(environment, name, pattern) {
  const value = environment[name];
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new Error(`${name.toLowerCase()}_invalid`);
  }
  return value;
}

function assertSecretFree(environment) {
  for (const name of secretNames) {
    if (typeof environment[name] === "string" && environment[name].length > 0) {
      throw new Error("qualification_secret_context_invalid");
    }
  }
}

function writeOutput(path, fields) {
  if (typeof path !== "string" || path.length < 1) return;
  const lines = Object.entries(fields).map(([key, value]) => `${key}=${value}`);
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

export function buildRouteIqPrivateDashboardQualification({ environment = process.env } = {}) {
  assertSecretFree(environment);
  const candidateCommit = requireExactEnvironment(environment, "PROMETHEUS_CANDIDATE_COMMIT", /^[a-f0-9]{40}$/u);
  const candidateTree = requireExactEnvironment(environment, "PROMETHEUS_CANDIDATE_TREE", /^[a-f0-9]{40}$/u);
  const batchId = requireExactEnvironment(environment, "PROMETHEUS_BATCH_ID", /^BATCH-\d{8}-\d{3}$/u);
  const outputDirectory = environment.PROMETHEUS_QUALIFIED_RELEASE_OUTPUT;
  if (typeof outputDirectory !== "string" || outputDirectory.length < 1 || !isAbsolute(outputDirectory)) {
    throw new Error("qualified_release_output_invalid");
  }
  if (existsSync(outputDirectory)) rmSync(outputDirectory, { recursive: true, force: true });
  mkdirSync(outputDirectory, { recursive: true });

  const headCommit = git(["rev-parse", "HEAD"]);
  const headTree = git(["rev-parse", "HEAD^{tree}"]);
  if (headCommit !== candidateCommit || headTree !== candidateTree) {
    throw new Error("candidate_identity_mismatch");
  }

  const deployParity = inspectRouteIqPrivateDashboardDeployAssets();
  if (!deployParity.ok) {
    throw new Error("private_dashboard_deploy_parity_invalid");
  }
  writeJson(join(outputDirectory, deployParityName), deployParity);

  const rollbackOutput = join(outputDirectory, "rollback-v3");
  const rollback = buildRouteIqPrivateForwardRollbackCandidateV3({
    outputDirectory: rollbackOutput,
    sourceRef: candidateCommit,
    runDryRun: true
  });
  const workflowContract = readJson(qualificationContractPath);
  const manifest = {
    schemaVersion: "route-iq-private-dashboard-qualification-v1",
    ownerSubsystem: "Prometheus Infrastructure",
    batchId,
    candidateCommit,
    candidateTree,
    workflowContractSha256: sha256File(qualificationContractPath),
    qualificationContractPath,
    rollbackV3: {
      contractPath: rollbackContractPath,
      contractSha256: sha256File(rollbackContractPath),
      wranglerPath: rollbackWranglerPath,
      wranglerSha256: sha256File(rollbackWranglerPath),
      inertClassPath: rollbackInertPath,
      inertClassSha256: sha256File(rollbackInertPath),
      builderPath: rollbackBuilderPath,
      builderSha256: sha256File(rollbackBuilderPath),
      bundleSha256: rollback.manifest.contentTreeSha256,
      generatedEntrypointSha256: rollback.manifest.generatedEntrypointSha256,
      generatedConfigSha256: rollback.manifest.configSha256
    },
    canonicalZipCoverageIntegration: Object.fromEntries(
      Object.entries(canonicalZipIntegrationPaths).map(([name, path]) => [
        name,
        { path, sha256: sha256File(path) }
      ])
    ),
    deployParitySha256: sha256(readFileSync(join(outputDirectory, deployParityName))),
    workflow: {
      path: workflowContract.workflowPath,
      trigger: workflowContract.trigger,
      automaticTriggerAllowed: workflowContract.automaticTriggerAllowed,
      cloudflareCredentialsAllowed: workflowContract.cloudflareCredentialsAllowed,
      deploymentStepsAllowed: workflowContract.deploymentStepsAllowed
    }
  };
  writeJson(join(outputDirectory, qualificationManifestName), manifest);

  const artifactSha256 = contentTreeSha256(outputDirectory);
  writeOutput(environment.GITHUB_OUTPUT, {
    qualified_artifact_sha256: artifactSha256,
    qualified_manifest_sha256: sha256(readFileSync(join(outputDirectory, qualificationManifestName))),
    rollback_bundle_sha256: rollback.manifest.contentTreeSha256
  });
  return Object.freeze({
    status: "ROUTE_IQ_PRIVATE_DASHBOARD_QUALIFICATION_PASSED",
    artifactSha256,
    manifestSha256: sha256(readFileSync(join(outputDirectory, qualificationManifestName)))
  });
}

if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  try {
    const result = buildRouteIqPrivateDashboardQualification();
    process.stdout.write(`${result.status}\n`);
  } catch (error) {
    process.stdout.write(`${error instanceof Error ? error.message : "qualification_failed"}\n`);
    process.exitCode = 1;
  }
}
