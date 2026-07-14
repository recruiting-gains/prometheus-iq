import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "..");
const manifestPath = "workers/infrastructure/route-iq-forward-rollback-candidate-v1.json";
const configPath = "workers/infrastructure/route-iq-forward-rollback-wrangler-v1.json";
const inertClassPath = "workers/infrastructure/route-iq-forward-rollback-inert-durable-object.js";
const generatedManifestName = "route-iq-forward-rollback-build-manifest.json";

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: options.encoding || "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function readSource(path, sourceRef) {
  if (sourceRef === "WORKTREE") return readFileSync(resolve(root, path));
  return git(["show", `${sourceRef}:${path}`], { encoding: "buffer" });
}

function walkFiles(directory, base = directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(path, base));
    else if (entry.isFile()) files.push(relative(base, path));
  }
  return files.sort();
}

function contentTreeSha256(directory) {
  const hash = createHash("sha256");
  for (const path of walkFiles(directory)) {
    if (path === generatedManifestName || path.startsWith(".dry-run-output/")) continue;
    hash.update(path);
    hash.update("\0");
    hash.update(readFileSync(join(directory, path)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function assertNonexistentOutput(outputDirectory) {
  if (existsSync(outputDirectory)) {
    throw new Error(`Output directory already exists: ${outputDirectory}`);
  }
  mkdirSync(outputDirectory, { recursive: true });
}

function writeCommittedOverlay(path, sourceRef, destination) {
  const contents = readSource(path, sourceRef);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
}

function resolveSourceIdentity(sourceRef) {
  const ref = sourceRef === "WORKTREE" ? "HEAD" : sourceRef;
  return {
    commit: git(["rev-parse", `${ref}^{commit}`]).trim(),
    tree: git(["rev-parse", `${ref}^{tree}`]).trim(),
    sourceMode: sourceRef === "WORKTREE" ? "noncanonical_worktree_test" : "committed_git_objects"
  };
}

function parseJsonBuffer(buffer, path) {
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
}

export function buildRouteIqForwardRollbackCandidate({
  outputDirectory,
  sourceRef = "HEAD",
  runDryRun = false
} = {}) {
  const contract = parseJsonBuffer(readSource(manifestPath, sourceRef), manifestPath);
  const configBuffer = readSource(configPath, sourceRef);
  const config = parseJsonBuffer(configBuffer, configPath);
  const sourceIdentity = resolveSourceIdentity(sourceRef);
  mkdirSync(resolve(root, ".wrangler"), { recursive: true });
  const resolvedOutput = outputDirectory
    ? resolve(outputDirectory)
    : mkdtempSync(join(resolve(root, ".wrangler"), "route-iq-forward-rollback-candidate-v1-"));

  if (outputDirectory) assertNonexistentOutput(resolvedOutput);
  else mkdirSync(resolvedOutput, { recursive: true });

  const archivePath = join(tmpdir(), `route-iq-forward-rollback-${process.pid}-${Date.now()}.tar`);
  try {
    execFileSync("git", [
      "archive",
      "--format=tar",
      `--output=${archivePath}`,
      contract.applicationBehaviorSource.commit
    ], { cwd: root, stdio: "pipe" });
    execFileSync("tar", ["-xf", archivePath, "-C", resolvedOutput], { stdio: "pipe" });
  } finally {
    rmSync(archivePath, { force: true });
  }

  for (const entry of readdirSync(resolvedOutput)) {
    if (/^wrangler(?:\..+)?\.(?:jsonc|toml)$/u.test(entry)) {
      rmSync(join(resolvedOutput, entry), { force: true });
    }
  }

  const priorEntrypoint = join(resolvedOutput, "workers/prometheus-iq-worker.js");
  const retainedPriorEntrypoint = join(resolvedOutput, contract.candidatePackage.priorEntrypoint);
  if (!existsSync(priorEntrypoint)) throw new Error("Prior Worker entrypoint is missing.");
  renameSync(priorEntrypoint, retainedPriorEntrypoint);

  const generatedEntrypoint = `export { default } from "./prometheus-iq-previous-behavior.js";\nexport * from "./prometheus-iq-previous-behavior.js";\nexport { RouteIqProspectiveShadowCoordinator } from "./infrastructure/route-iq-forward-rollback-inert-durable-object.js";\n`;
  writeFileSync(priorEntrypoint, generatedEntrypoint, "utf8");
  writeCommittedOverlay(inertClassPath, sourceRef, join(resolvedOutput, inertClassPath));
  writeFileSync(join(resolvedOutput, "wrangler.jsonc"), configBuffer);

  const priorWorkerSha256 = sha256File(retainedPriorEntrypoint);
  const dashboardAssetPath = join(resolvedOutput, "deploy/cloudflare-pages/index.html");
  const dashboardAssetSha256 = sha256File(dashboardAssetPath);
  if (priorWorkerSha256 !== contract.applicationBehaviorSource.workerSourceSha256) {
    throw new Error("Prior Worker source hash does not match the rollback contract.");
  }
  if (dashboardAssetSha256 !== contract.applicationBehaviorSource.dashboardAssetSha256) {
    throw new Error("Prior Dashboard asset hash does not match the rollback contract.");
  }

  const generatedManifest = {
    contractId: contract.contractId,
    batchId: contract.batchId,
    candidateSource: sourceIdentity,
    applicationBehaviorSource: contract.applicationBehaviorSource,
    targetWorker: config.name,
    packageDirectory: basename(resolvedOutput),
    statefulCompatibility: contract.statefulCompatibility,
    protectedSecretNames: contract.protectedSecrets.requiredNames,
    collection: config.vars.ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION,
    recommendationInfluence: contract.runtimeBoundary.recommendationInfluence,
    deploymentAuthorized: false,
    priorWorkerSha256,
    dashboardAssetSha256,
    inertClassSha256: sha256File(join(resolvedOutput, inertClassPath)),
    configSha256: sha256File(join(resolvedOutput, "wrangler.jsonc")),
    contentTreeSha256: contentTreeSha256(resolvedOutput),
    dryRunPassed: false
  };

  if (runDryRun) {
    const dryRunOutput = mkdtempSync(join(tmpdir(), "route-iq-forward-rollback-dry-run-"));
    try {
      execFileSync(resolve(root, "node_modules/.bin/wrangler"), [
        "deploy",
        "--dry-run",
        "--strict",
        "--keep-vars",
        "--config",
        "wrangler.jsonc",
        "--outdir",
        dryRunOutput
      ], {
        cwd: resolvedOutput,
        env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
        stdio: "pipe",
        maxBuffer: 64 * 1024 * 1024
      });
      generatedManifest.dryRunPassed = true;
    } finally {
      rmSync(dryRunOutput, { recursive: true, force: true });
    }
  }

  writeFileSync(
    join(resolvedOutput, generatedManifestName),
    `${JSON.stringify(generatedManifest, null, 2)}\n`,
    "utf8"
  );

  return Object.freeze({
    outputDirectory: resolvedOutput,
    manifest: generatedManifest
  });
}

function parseCliArgs(argv) {
  const options = { sourceRef: "HEAD", runDryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") options.runDryRun = true;
    else if (argument === "--source-ref") options.sourceRef = argv[++index];
    else if (argument === "--output") options.outputDirectory = argv[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const result = buildRouteIqForwardRollbackCandidate(parseCliArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({
    status: "prepared_not_deployed",
    outputDirectory: result.outputDirectory,
    ...result.manifest
  }, null, 2)}\n`);
}
