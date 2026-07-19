#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPublicForwardRollbackContract } from "./lib/github-actions-public-worker-deployment.mjs";
import { hashPublicForwardRollbackArtifact } from "./lib/route-iq-public-forward-rollback.mjs";

const root = resolve(import.meta.dirname, "..");
const SOURCE_DIRECTORY = "dist-public";
const FORBIDDEN_GENERATED_PATHS = Object.freeze([
  "enterprise-lead-intake.js",
  "route-iq-request-form.js",
  "website-attribution.js"
]);

function regularFiles(directory, current = directory, output = []) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = resolve(current, entry.name);
    if (entry.isSymbolicLink()) throw new Error("public_deployment_asset_invalid");
    if (entry.isDirectory()) regularFiles(directory, path, output);
    else if (entry.isFile()) output.push(path);
    else throw new Error("public_deployment_asset_invalid");
  }
  return output.sort((left, right) => relative(directory, left).localeCompare(relative(directory, right)));
}

function names(directory) {
  return regularFiles(directory).map(path => relative(directory, path).split("\\").join("/"));
}

function buildSource() {
  const result = spawnSync("npm", ["run", "build"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      CI: "true",
      NO_COLOR: "1"
    }
  });
  if (result.status !== 0 || result.error || result.signal) {
    throw new Error("public_deployment_build_failed");
  }
}

function assertExactParity(sourceDirectory, deploymentDirectory) {
  const sourceNames = names(sourceDirectory);
  const deploymentNames = names(deploymentDirectory);
  if (JSON.stringify(sourceNames) !== JSON.stringify(deploymentNames)) {
    throw new Error("public_deployment_file_set_mismatch");
  }
  for (const name of sourceNames) {
    const source = readFileSync(resolve(sourceDirectory, name));
    const deployed = readFileSync(resolve(deploymentDirectory, name));
    if (!source.equals(deployed)) throw new Error("public_deployment_byte_mismatch");
  }
  return sourceNames;
}

function size(directory, path) {
  const stats = lstatSync(resolve(directory, path));
  if (!stats.isFile() || stats.isSymbolicLink()) throw new Error("public_deployment_asset_invalid");
  return stats.size;
}

export function verifyRouteIqPublicDeploymentAssets({ build = true } = {}) {
  if (build) buildSource();
  const contract = verifyPublicForwardRollbackContract(root);
  const sourceDirectory = resolve(root, SOURCE_DIRECTORY);
  const deploymentDirectory = resolve(root, contract.websiteAssetPath);
  const files = assertExactParity(sourceDirectory, deploymentDirectory);

  if (FORBIDDEN_GENERATED_PATHS.some(path => files.includes(path))
    || files.some(path => path.startsWith("public-assets/"))) {
    throw new Error("public_deployment_stale_payload_present");
  }

  const index = readFileSync(resolve(deploymentDirectory, "index.html"), "utf8");
  const entry = index.match(/src="\/(assets\/landing-[^"]+\.js)"/u)?.[1];
  const css = index.match(/href="\/(assets\/landing-[^"]+\.css)"/u)?.[1];
  const lazy3d = files.find(path => /^assets\/IntelligenceScene-.+\.js$/u.test(path));
  const logo = files.find(path => /^assets\/prometheus-company-icon-512-.+\.png$/u.test(path));
  if (!entry || !css || !lazy3d || !logo
    || !files.includes(entry)
    || !files.includes(css)
    || /<link[^>]+rel="preload"[^>]+route-iq-field-operations\.jpg/iu.test(index)) {
    throw new Error("public_deployment_bundle_contract_invalid");
  }
  const entrySource = readFileSync(resolve(deploymentDirectory, entry), "utf8");
  if (!entrySource.includes(lazy3d.split("/").at(-1))) {
    throw new Error("public_deployment_lazy_bundle_invalid");
  }

  const deploymentAssetsSha256 = hashPublicForwardRollbackArtifact(deploymentDirectory);
  if (deploymentAssetsSha256 !== contract.candidateDeploymentAssetsSha256) {
    throw new Error("public_deployment_asset_hash_mismatch");
  }

  const sizes = Object.freeze({
    index: size(deploymentDirectory, "index.html"),
    criticalEntry: size(deploymentDirectory, entry),
    criticalCss: size(deploymentDirectory, css),
    logo: size(deploymentDirectory, logo),
    fallback: size(deploymentDirectory, "route-iq-field-operations.jpg"),
    socialPreview: size(deploymentDirectory, "route-iq-field-operations-social.jpg"),
    lazy3d: size(deploymentDirectory, lazy3d)
  });
  return Object.freeze({
    status: "ROUTE_IQ_PUBLIC_DEPLOYMENT_ASSETS_VERIFIED",
    candidateWebsiteCommit: contract.candidateWebsiteCommit,
    candidateWebsiteTree: contract.candidateWebsiteTree,
    deploymentAssetsSha256,
    fileCount: files.length,
    paths: Object.freeze({ entry, css, logo, lazy3d }),
    sizes,
    initialCriticalBytes: sizes.index + sizes.criticalEntry + sizes.criticalCss + sizes.logo
  });
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const result = verifyRouteIqPublicDeploymentAssets();
    process.stdout.write(`${result.status} ${result.deploymentAssetsSha256}\n`);
  } catch {
    process.stdout.write("FAIL\n");
    process.exitCode = 1;
  }
}
