import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import {
  PUBLIC_WORKER_DEPLOYMENT_POLICY,
  PublicDeploymentPolicyError,
  verifyPublicForwardRollbackContract
} from "./github-actions-public-worker-deployment.mjs";

const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const COMMAND_TIMEOUT_MS = 240_000;
const SHA256 = /^[0-9a-f]{64}$/u;

function run(root, command, argumentsList, options = {}) {
  const defaultEnvironment = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    CI: "true",
    NO_COLOR: "1",
    WRANGLER_SEND_METRICS: "false"
  };
  const result = spawnSync(command, argumentsList, {
    cwd: options.cwd || root,
    input: options.input,
    encoding: options.encoding,
    stdio: [options.input ? "pipe" : "ignore", "pipe", "pipe"],
    maxBuffer: options.maxBuffer || MAX_ARCHIVE_BYTES,
    timeout: options.timeout || COMMAND_TIMEOUT_MS,
    env: options.env || defaultEnvironment
  });
  if (result.status !== 0 || result.error || result.signal) {
    throw new Error("public_forward_rollback_command_failed");
  }
  return result.stdout;
}

function extractArchive(root, revision, workspace, path) {
  const argumentsList = ["archive", "--format=tar", revision];
  if (path) argumentsList.push("--", path);
  const archive = run(root, "git", argumentsList, { maxBuffer: MAX_ARCHIVE_BYTES });
  try {
    run(root, "tar", ["-xf", "-", "-C", workspace], {
      input: archive,
      maxBuffer: 8 * 1024 * 1024
    });
  } finally {
    if (Buffer.isBuffer(archive)) archive.fill(0);
  }
}

function regularFiles(directory, current = directory, output = [], ignored = new Set()) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    const name = relative(directory, path).split("\\").join("/");
    if (ignored.has(name)) continue;
    if (entry.isSymbolicLink()) throw new Error("public_forward_rollback_artifact_invalid");
    if (entry.isDirectory()) regularFiles(directory, path, output, ignored);
    else if (entry.isFile()) output.push(path);
    else throw new Error("public_forward_rollback_artifact_invalid");
  }
  return output.sort((left, right) => relative(directory, left).localeCompare(relative(directory, right)));
}

export function hashPublicForwardRollbackArtifact(directory, ignored = new Set()) {
  const digest = createHash("sha256");
  for (const path of regularFiles(directory, directory, [], ignored)) {
    const name = relative(directory, path).split("\\").join("/");
    const stats = lstatSync(path);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error("public_forward_rollback_artifact_invalid");
    }
    digest.update(name, "utf8");
    digest.update("\0", "utf8");
    const content = readFileSync(path);
    try {
      digest.update(content);
    } finally {
      content.fill(0);
    }
    digest.update("\0", "utf8");
  }
  return digest.digest("hex");
}

export function buildPublicForwardRollbackArtifact(root, {
  temporaryRoot = tmpdir()
} = {}) {
  const contract = verifyPublicForwardRollbackContract(root);
  const workspace = mkdtempSync(join(temporaryRoot, "route-iq-public-forward-rollback-"));
  const artifactDirectory = mkdtempSync(join(temporaryRoot, "route-iq-public-forward-bundle-"));
  try {
    extractArchive(root, "HEAD", workspace);
    const publicAssets = join(workspace, contract.websiteAssetPath);
    rmSync(publicAssets, { recursive: true, force: true });
    extractArchive(root, contract.sourceWebsiteCommit, workspace, contract.websiteAssetPath);
    symlinkSync(resolve(root, "node_modules"), join(workspace, "node_modules"), "dir");
    run(root, process.execPath, [
      PUBLIC_WORKER_DEPLOYMENT_POLICY.wranglerModule,
      "deploy",
      "--dry-run",
      "--config",
      PUBLIC_WORKER_DEPLOYMENT_POLICY.publicConfig,
      "--keep-vars",
      "--strict",
      "--outdir",
      artifactDirectory
    ], { cwd: workspace, maxBuffer: 16 * 1024 * 1024 });
    const artifactSha256 = hashPublicForwardRollbackArtifact(workspace, new Set(["node_modules"]));
    const websiteAssetsSha256 = hashPublicForwardRollbackArtifact(publicAssets);
    if (!SHA256.test(artifactSha256) || !SHA256.test(websiteAssetsSha256)) {
      throw new Error("public_forward_rollback_hash_invalid");
    }
    return Object.freeze({
      status: "PUBLIC_FORWARD_ROLLBACK_VERIFIED",
      artifactSha256,
      websiteAssetsSha256,
      sourceWebsiteCommit: contract.sourceWebsiteCommit,
      sourceWebsiteTree: contract.sourceWebsiteTree,
      durableObjectBinding: contract.statefulCompatibility.durableObjectBinding,
      durableObjectClass: contract.statefulCompatibility.durableObjectClass,
      migrationTag: contract.statefulCompatibility.migrationTag
    });
  } finally {
    rmSync(workspace, { recursive: true, force: true });
    rmSync(artifactDirectory, { recursive: true, force: true });
  }
}

export function verifyPublicForwardRollbackArtifact(root, expectedSha256) {
  if (expectedSha256 !== undefined && !SHA256.test(expectedSha256)) {
    throw new Error("public_forward_rollback_expected_hash_invalid");
  }
  let result;
  try {
    result = buildPublicForwardRollbackArtifact(root);
  } catch (error) {
    if (error instanceof PublicDeploymentPolicyError) throw error;
    throw new Error("public_forward_rollback_verification_failed");
  }
  if (expectedSha256 !== undefined && result.artifactSha256 !== expectedSha256) {
    throw new Error("public_forward_rollback_hash_mismatch");
  }
  return result;
}
