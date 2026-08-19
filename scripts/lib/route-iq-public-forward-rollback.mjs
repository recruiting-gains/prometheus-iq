import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  realpathSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import {
  PUBLIC_DEPLOYMENT_FAILURE,
  PUBLIC_WORKER_DEPLOYMENT_POLICY,
  PublicDeploymentPolicyError,
  verifyPublicForwardRollbackContract
} from "./github-actions-public-worker-deployment.mjs";

const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const MAX_PINNED_FILE_BYTES = 2_000_000;
const COMMAND_TIMEOUT_MS = 240_000;
const SHA256 = /^[0-9a-f]{64}$/u;
export const PUBLIC_FORWARD_ROLLBACK_BUILD_SOURCE = Object.freeze({
  commit: "e225b9e6380416cceddbfe10ee7aa318b123e75c",
  tree: "6fe395423d6b907c967e0ce588b53f7307cbba2b",
  owner: "Prometheus Infrastructure <infrastructure@prometheus.local>",
  rollbackContractSha256: "0bb6b68da599d1d89a3e95f688ea9106ed9e5031454c1e6f706d0afabdefcb28",
  packageLockSha256: "6689435e2070d0f36d97448019348dc776d28cca9f6538d3d632cd5e5c1590ec",
  artifactSha256: "a2cb4150124ff7569aa09cd50d60a12160ba52f2ef97b29967d92f494cb17f71"
});
const GENERATED_OUTPUT_FILES = Object.freeze([
  "prometheusrouteiq-website-entry.js",
  "prometheusrouteiq-website-entry.js.map",
  "README.md"
]);
const DEPLOYABLE_GENERATED_FILES = Object.freeze([
  "prometheusrouteiq-website-entry.js",
  "prometheusrouteiq-website-entry.js.map"
]);

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

function sha256File(path) {
  const content = readFileSync(path);
  try {
    return createHash("sha256").update(content).digest("hex");
  } finally {
    content.fill(0);
  }
}

function validPinnedPath(path) {
  return typeof path === "string"
    && path.length > 0
    && path.length <= 512
    && !path.startsWith("/")
    && !path.endsWith("/")
    && !path.includes("\\")
    && !path.includes("\0")
    && path.split("/").every(segment => segment.length > 0 && segment !== "." && segment !== "..");
}

function commandText(root, command, argumentsList) {
  const output = run(root, command, argumentsList, {
    encoding: "utf8",
    maxBuffer: MAX_PINNED_FILE_BYTES
  });
  return typeof output === "string" ? output.trim() : "";
}

export function verifyPublicForwardRollbackBuildSource(root) {
  try {
    const source = PUBLIC_FORWARD_ROLLBACK_BUILD_SOURCE;
    if (commandText(root, "git", ["rev-parse", `${source.commit}^{commit}`]) !== source.commit
      || commandText(root, "git", ["rev-parse", `${source.commit}^{tree}`]) !== source.tree
      || commandText(root, "git", ["show", "-s", "--format=%an <%ae>", source.commit]) !== source.owner) {
      throw new Error("public_forward_rollback_build_source_invalid");
    }
    run(root, "git", ["merge-base", "--is-ancestor", source.commit, "HEAD"]);
    if (sha256File(join(root, PUBLIC_WORKER_DEPLOYMENT_POLICY.rollbackContractPath))
        !== source.rollbackContractSha256
      || sha256File(join(root, "package-lock.json")) !== source.packageLockSha256) {
      throw new Error("public_forward_rollback_build_source_invalid");
    }
    return source;
  } catch (error) {
    if (error?.message === "public_forward_rollback_build_source_invalid") throw error;
    throw new Error("public_forward_rollback_build_source_invalid");
  }
}

function safeMaterializationDestination(directory, path) {
  const root = resolve(directory);
  let rootStats;
  let realRoot;
  try {
    rootStats = lstatSync(root);
    realRoot = realpathSync(root);
  } catch {
    throw new Error("public_forward_rollback_pinned_source_invalid");
  }
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new Error("public_forward_rollback_pinned_source_invalid");
  }

  const segments = path.split("/");
  let current = root;
  for (const segment of segments.slice(0, -1)) {
    current = join(current, segment);
    try {
      const stats = lstatSync(current);
      if (!stats.isDirectory() || stats.isSymbolicLink()) {
        throw new Error("public_forward_rollback_pinned_source_invalid");
      }
    } catch (error) {
      if (error?.message === "public_forward_rollback_pinned_source_invalid") throw error;
      try {
        mkdirSync(current, { mode: 0o700 });
      } catch {
        throw new Error("public_forward_rollback_pinned_source_invalid");
      }
    }
    let realCurrent;
    try {
      realCurrent = realpathSync(current);
    } catch {
      throw new Error("public_forward_rollback_pinned_source_invalid");
    }
    const relativeCurrent = relative(realRoot, realCurrent);
    if (!relativeCurrent
      || relativeCurrent === ".."
      || relativeCurrent.startsWith("../")
      || relativeCurrent.startsWith("..\\")
      || isAbsolute(relativeCurrent)) {
      throw new Error("public_forward_rollback_pinned_source_invalid");
    }
  }

  const destination = join(current, segments.at(-1));
  let projectedRealDestination;
  try {
    projectedRealDestination = join(realpathSync(current), segments.at(-1));
  } catch {
    throw new Error("public_forward_rollback_pinned_source_invalid");
  }
  const relativeDestination = relative(realRoot, projectedRealDestination);
  if (!relativeDestination
    || relativeDestination === ".."
    || relativeDestination.startsWith("../")
    || relativeDestination.startsWith("..\\")
    || isAbsolute(relativeDestination)) {
    throw new Error("public_forward_rollback_pinned_source_invalid");
  }
  try {
    lstatSync(destination);
    throw new Error("public_forward_rollback_pinned_source_invalid");
  } catch (error) {
    if (error?.message === "public_forward_rollback_pinned_source_invalid") throw error;
  }
  return Object.freeze({ destination, realRoot });
}

export function materializePinnedPublicStatefulFiles(
  root,
  directory,
  candidateStatefulFiles
) {
  const entries = Object.entries(candidateStatefulFiles || {})
    .sort(([left], [right]) => left.localeCompare(right));
  if (entries.length < 1) throw new Error("public_forward_rollback_pinned_source_invalid");

  for (const [path, provenance] of entries) {
    if (!validPinnedPath(path)
      || typeof provenance !== "object"
      || provenance === null
      || Array.isArray(provenance)
      || !/^[0-9a-f]{40}$/u.test(provenance.sourceCommit || "")
      || !SHA256.test(provenance.sha256 || "")) {
      throw new Error("public_forward_rollback_pinned_source_invalid");
    }
    let treeEntry;
    try {
      treeEntry = commandText(root, "git", [
        "ls-tree",
        provenance.sourceCommit,
        "--",
        path
      ]);
    } catch {
      throw new Error("public_forward_rollback_pinned_source_invalid");
    }
    const tabIndex = treeEntry.indexOf("\t");
    const metadata = tabIndex > 0 ? treeEntry.slice(0, tabIndex).split(" ") : [];
    if (tabIndex < 1
      || treeEntry.slice(tabIndex + 1) !== path
      || metadata.length !== 3
      || !["100644", "100755"].includes(metadata[0])
      || metadata[1] !== "blob"
      || !/^[0-9a-f]{40}$/u.test(metadata[2] || "")) {
      throw new Error("public_forward_rollback_pinned_source_invalid");
    }
    const { destination, realRoot } = safeMaterializationDestination(directory, path);

    let content;
    try {
      content = run(root, "git", [
        "show",
        `${provenance.sourceCommit}:${path}`
      ], { maxBuffer: MAX_PINNED_FILE_BYTES });
      if (!Buffer.isBuffer(content)
        || content.length < 1
        || content.length > MAX_PINNED_FILE_BYTES
        || createHash("sha256").update(content).digest("hex") !== provenance.sha256) {
        throw new Error("public_forward_rollback_pinned_source_invalid");
      }
      writeFileSync(destination, content, { flag: "wx", mode: 0o600 });
      const materializedStats = lstatSync(destination);
      const realDestination = realpathSync(destination);
      const relativeDestination = relative(realRoot, realDestination);
      if (!materializedStats.isFile()
        || materializedStats.isSymbolicLink()
        || !relativeDestination
        || relativeDestination === ".."
        || relativeDestination.startsWith("../")
        || relativeDestination.startsWith("..\\")
        || isAbsolute(relativeDestination)
        || sha256File(destination) !== provenance.sha256) {
        throw new Error("public_forward_rollback_pinned_source_invalid");
      }
    } catch (error) {
      if (error?.message === "public_forward_rollback_pinned_source_invalid") throw error;
      throw new Error("public_forward_rollback_pinned_source_invalid");
    } finally {
      if (Buffer.isBuffer(content)) content.fill(0);
    }
  }
  return Object.freeze({
    status: "PUBLIC_FORWARD_ROLLBACK_PINNED_STATEFUL_FILES_MATERIALIZED",
    fileCount: entries.length
  });
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function exactGeneratedOutputs(directory) {
  const actual = regularFiles(directory).map(path => relative(directory, path).split("\\").join("/"));
  if (JSON.stringify(actual) !== JSON.stringify(GENERATED_OUTPUT_FILES)) {
    throw new Error("public_forward_rollback_generated_outputs_invalid");
  }
  const report = readFileSync(join(directory, "README.md"), "utf8");
  if (!/^This folder contains the built output assets for the worker "prometheusrouteiq-website" generated at [0-9TZ:.+-]+\.\n?$/u.test(report)) {
    throw new Error("public_forward_rollback_generated_report_invalid");
  }
}

function canonicalSourcePath(source, prefix, base) {
  const normalizedSources = new Set([resolve(source)]);
  try {
    normalizedSources.add(realpathSync(source));
  } catch {
    // The caller decides whether an unresolved source is inside an allowed boundary.
  }
  const candidates = new Set([resolve(base), realpathSync(base)]);
  for (const normalizedSource of normalizedSources) {
    const normalized = normalizedSource.split("\\").join("/");
    for (const candidate of candidates) {
      const marker = candidate.split("\\").join("/").replace(/^\/+|\/+$/gu, "");
      const index = normalized.indexOf(marker);
      const before = index > 0 ? normalized[index - 1] : "/";
      const after = index >= 0 ? normalized[index + marker.length] : undefined;
      if (index >= 0 && before === "/" && (after === "/" || after === undefined)) {
        const suffix = normalized.slice(index + marker.length).replace(/^\/+|\/+$/gu, "");
        return suffix ? `${prefix}/${suffix}` : prefix;
      }
    }
  }
  return null;
}

function canonicalExistingSourcePath(source, prefix, base) {
  let realSource;
  let realBase;
  try {
    realSource = realpathSync(source);
    realBase = realpathSync(base);
  } catch {
    throw new Error("public_forward_rollback_source_map_source_invalid");
  }
  const suffix = relative(realBase, realSource);
  if (!suffix
    || suffix === ".."
    || suffix.startsWith("../")
    || suffix.startsWith("..\\")
    || isAbsolute(suffix)) {
    return null;
  }
  return `${prefix}/${suffix.split("\\").join("/")}`;
}

export function canonicalizeGeneratedSourceMap(sourceMap, {
  sourceMapDirectory,
  workspace,
  repositoryRoot
}) {
  if (!sourceMap || typeof sourceMap !== "object" || !Array.isArray(sourceMap.sources)) {
    throw new Error("public_forward_rollback_source_map_invalid");
  }
  if (typeof sourceMap.sourceRoot !== "string") {
    throw new Error("public_forward_rollback_source_map_invalid");
  }
  let declaredGeneratedRoot;
  let realGeneratedRoot;
  let generatedDirectory;
  try {
    generatedDirectory = realpathSync(sourceMapDirectory);
    declaredGeneratedRoot = resolve(sourceMapDirectory, sourceMap.sourceRoot);
    realGeneratedRoot = realpathSync(declaredGeneratedRoot);
  } catch {
    throw new Error("public_forward_rollback_source_map_invalid");
  }
  if (realGeneratedRoot !== generatedDirectory) {
    throw new Error("public_forward_rollback_source_map_invalid");
  }

  const repositoryNodeModules = resolve(repositoryRoot, "node_modules");
  const sources = sourceMap.sources.map(source => {
    if (typeof source !== "string" || source.length < 1 || source.includes("\0")) {
      throw new Error("public_forward_rollback_source_map_invalid");
    }
    const absoluteSource = resolve(declaredGeneratedRoot, source);
    const dependencyPath = canonicalExistingSourcePath(
      absoluteSource,
      "node_modules",
      repositoryNodeModules
    );
    if (dependencyPath) return dependencyPath;
    const workspacePath = canonicalExistingSourcePath(absoluteSource, "workspace", workspace);
    if (workspacePath) return workspacePath;
    throw new Error("public_forward_rollback_source_map_outside_boundary");
  });
  return Object.freeze({ ...sourceMap, sourceRoot: "generated", sources: Object.freeze(sources) });
}

function canonicalSourceMap(sourceMapPath, outputPath, { workspace, repositoryRoot }) {
  let sourceMap;
  try {
    sourceMap = JSON.parse(readFileSync(sourceMapPath, "utf8"));
  } catch {
    throw new Error("public_forward_rollback_source_map_invalid");
  }
  const canonical = canonicalizeGeneratedSourceMap(sourceMap, {
    sourceMapDirectory: dirname(sourceMapPath),
    workspace,
    repositoryRoot
  });
  writeFileSync(outputPath, `${canonicalJson(canonical)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
}

export function canonicalizeGeneratedWorkerSource(source, {
  workspace,
  repositoryRoot
}) {
  if (typeof source !== "string" || source.includes("\0")) {
    throw new Error("public_forward_rollback_generated_worker_invalid");
  }
  return source.split("\n").map(line => {
    const match = /^\/\/ (.+)$/u.exec(line);
    if (!match) return line;
    const absoluteSource = resolve(workspace, match[1]);
    const workspacePath = canonicalSourcePath(absoluteSource, "workspace", workspace);
    if (workspacePath) return `// ${workspacePath}`;
    const dependencyPath = canonicalSourcePath(
      absoluteSource,
      "node_modules",
      resolve(repositoryRoot, "node_modules")
    );
    return dependencyPath ? `// ${dependencyPath}` : line;
  }).join("\n");
}

function canonicalGeneratedWorker(inputPath, outputPath, context) {
  const source = readFileSync(inputPath, "utf8");
  const canonical = canonicalizeGeneratedWorkerSource(source, context);
  const forbiddenRoots = [context.workspace, context.repositoryRoot]
    .flatMap(path => [resolve(path), realpathSync(path)])
    .map(path => path.split("\\").join("/"));
  if (forbiddenRoots.some(path => canonical.includes(path))) {
    throw new Error("public_forward_rollback_generated_worker_path_leak");
  }
  writeFileSync(outputPath, canonical, { encoding: "utf8", mode: 0o600, flag: "wx" });
}

function buildIdentityManifest(contract, components) {
  return Object.freeze({
    identityVersion: contract.artifact.identityVersion,
    target: contract.target,
    strategy: contract.strategy,
    candidateWebsiteCommit: contract.candidateWebsiteCommit,
    candidateWebsiteTree: contract.candidateWebsiteTree,
    candidateDeploymentAssetsSha256: contract.candidateDeploymentAssetsSha256,
    sourceWebsiteCommit: contract.sourceWebsiteCommit,
    sourceWebsiteTree: contract.sourceWebsiteTree,
    websiteAssetPath: contract.websiteAssetPath,
    candidateStatefulFiles: Object.fromEntries(Object.entries(contract.candidateStatefulFiles)
      .sort(([left], [right]) => left.localeCompare(right))),
    statefulCompatibility: contract.statefulCompatibility,
    components
  });
}

export function buildPublicForwardRollbackArtifact(root, {
  temporaryRoot = tmpdir(),
  outputDirectory
} = {}) {
  const contract = verifyPublicForwardRollbackContract(root);
  const buildSource = verifyPublicForwardRollbackBuildSource(root);
  const workspace = mkdtempSync(join(temporaryRoot, "route-iq-public-forward-rollback-"));
  const generatedDirectory = join(workspace, ".route-iq-public-forward-generated");
  const identityDirectory = join(workspace, ".route-iq-public-forward-artifact");
  const provenanceDirectory = join(workspace, ".route-iq-public-forward-provenance");
  try {
    extractArchive(root, buildSource.commit, workspace);
    mkdirSync(provenanceDirectory, { mode: 0o700 });
    materializePinnedPublicStatefulFiles(
      root,
      provenanceDirectory,
      contract.candidateStatefulFiles
    );
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
      generatedDirectory
    ], { cwd: workspace, maxBuffer: 16 * 1024 * 1024 });
    exactGeneratedOutputs(generatedDirectory);

    const websiteAssetsSha256 = hashPublicForwardRollbackArtifact(publicAssets);
    const configurationPath = join(workspace, PUBLIC_WORKER_DEPLOYMENT_POLICY.publicConfig);
    const configurationSha256 = sha256File(configurationPath);
    const generatedWorkerPath = join(generatedDirectory, DEPLOYABLE_GENERATED_FILES[0]);
    const generatedSourceMapPath = join(generatedDirectory, DEPLOYABLE_GENERATED_FILES[1]);
    mkdirSync(identityDirectory, { mode: 0o700 });
    mkdirSync(join(identityDirectory, "configuration"), { mode: 0o700 });
    mkdirSync(join(identityDirectory, "generated"), { mode: 0o700 });
    copyFileSync(configurationPath, join(identityDirectory, "configuration", PUBLIC_WORKER_DEPLOYMENT_POLICY.publicConfig));
    cpSync(publicAssets, join(identityDirectory, "public-assets"), {
      recursive: true,
      errorOnExist: true,
      force: false,
      dereference: false
    });
    canonicalGeneratedWorker(
      generatedWorkerPath,
      join(identityDirectory, "generated", DEPLOYABLE_GENERATED_FILES[0]),
      { workspace, repositoryRoot: root }
    );
    canonicalSourceMap(
      generatedSourceMapPath,
      join(identityDirectory, "generated", DEPLOYABLE_GENERATED_FILES[1]),
      { workspace, repositoryRoot: root }
    );
    const generatedWorkerSha256 = sha256File(join(identityDirectory, "generated", DEPLOYABLE_GENERATED_FILES[0]));
    const generatedSourceMapSha256 = sha256File(join(identityDirectory, "generated", DEPLOYABLE_GENERATED_FILES[1]));
    const components = Object.freeze({
      configuration: Object.freeze({
        path: PUBLIC_WORKER_DEPLOYMENT_POLICY.publicConfig,
        sha256: configurationSha256
      }),
      publicAssets: Object.freeze({
        path: contract.websiteAssetPath,
        sha256: websiteAssetsSha256
      }),
      generatedOutputs: Object.freeze([
        Object.freeze({ path: DEPLOYABLE_GENERATED_FILES[0], sha256: generatedWorkerSha256 }),
        Object.freeze({ path: DEPLOYABLE_GENERATED_FILES[1], sha256: generatedSourceMapSha256 })
      ])
    });
    writeFileSync(
      join(identityDirectory, "manifest.json"),
      `${canonicalJson(buildIdentityManifest(contract, components))}\n`,
      { encoding: "utf8", mode: 0o600, flag: "wx" }
    );
    const artifactSha256 = hashPublicForwardRollbackArtifact(identityDirectory);
    if (![artifactSha256, websiteAssetsSha256, configurationSha256, generatedWorkerSha256, generatedSourceMapSha256]
      .every(value => SHA256.test(value))) {
      throw new Error("public_forward_rollback_hash_invalid");
    }
    if (artifactSha256 !== buildSource.artifactSha256) {
      throw new Error("public_forward_rollback_build_source_invalid");
    }
    if (outputDirectory !== undefined) {
      if (typeof outputDirectory !== "string" || outputDirectory.length < 1) {
        throw new Error("public_forward_rollback_output_invalid");
      }
      cpSync(identityDirectory, outputDirectory, {
        recursive: true,
        errorOnExist: true,
        force: false,
        dereference: false
      });
      if (hashPublicForwardRollbackArtifact(outputDirectory) !== artifactSha256) {
        throw new Error("public_forward_rollback_output_identity_mismatch");
      }
    }
    return Object.freeze({
      status: "PUBLIC_FORWARD_ROLLBACK_VERIFIED",
      artifactSha256,
      identityVersion: contract.artifact.identityVersion,
      candidateWebsiteCommit: contract.candidateWebsiteCommit,
      candidateWebsiteTree: contract.candidateWebsiteTree,
      candidateDeploymentAssetsSha256: contract.candidateDeploymentAssetsSha256,
      websiteAssetsSha256,
      configurationSha256,
      generatedWorkerSha256,
      generatedSourceMapSha256,
      sourceWebsiteCommit: contract.sourceWebsiteCommit,
      sourceWebsiteTree: contract.sourceWebsiteTree,
      publicEntrypoint: contract.statefulCompatibility.publicEntrypoint,
      publicEntrypointExports: Object.freeze([...contract.statefulCompatibility.publicEntrypointExports]),
      durableObjectBinding: contract.statefulCompatibility.durableObjectBinding,
      durableObjectClass: contract.statefulCompatibility.durableObjectClass,
      migrationTag: contract.statefulCompatibility.migrationTag
    });
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

export function verifyPublicForwardRollbackArtifact(root, expectedSha256) {
  if (expectedSha256 !== undefined && !SHA256.test(expectedSha256)) {
    throw new PublicDeploymentPolicyError(PUBLIC_DEPLOYMENT_FAILURE.ROLLBACK_INVALID, [
      "ROLLBACK_DIAGNOSTIC=EXPECTED_HASH_INVALID"
    ]);
  }
  let result;
  try {
    result = buildPublicForwardRollbackArtifact(root);
  } catch (error) {
    if (error instanceof PublicDeploymentPolicyError) throw error;
    throw new PublicDeploymentPolicyError(PUBLIC_DEPLOYMENT_FAILURE.ROLLBACK_INVALID, [
      "ROLLBACK_DIAGNOSTIC=ARTIFACT_GENERATION_FAILED"
    ]);
  }
  if (expectedSha256 !== undefined && result.artifactSha256 !== expectedSha256) {
    throw new PublicDeploymentPolicyError(PUBLIC_DEPLOYMENT_FAILURE.ROLLBACK_INVALID, [
      "ROLLBACK_DIAGNOSTIC=ARTIFACT_HASH_MISMATCH"
    ]);
  }
  return result;
}
