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
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "..");
const contractPath = "workers/infrastructure/route-iq-private-forward-rollback-candidate-v3.json";
const configPath = "workers/infrastructure/route-iq-private-forward-rollback-wrangler-v3.json";
const inertClassPath = "workers/infrastructure/route-iq-private-forward-rollback-inert-durable-object-v3.js";
const smokeGuardPath = "workers/infrastructure/cloudflare-unattended-smoke-guard.js";
const smokeContractPath = "workers/infrastructure/cloudflare-unattended-smoke-contract.js";
const generatedManifestName = "route-iq-private-forward-rollback-build-manifest-v3.json";
const generatedWrapper = [
  "import retainedWorker from \"./prometheus-iq-retained-version-55.js\";",
  "import { authorizeCloudflareUnattendedSmokeRequest, markCloudflareUnattendedSmokeResponse, sanitizeCloudflareUnattendedSmokeAssetRequest } from \"./infrastructure/cloudflare-unattended-smoke-guard.js\";",
  "",
  "export default {",
  "  async fetch(request, env, executionContext) {",
  "    const authorization = await authorizeCloudflareUnattendedSmokeRequest(request, env);",
  "    if (authorization.kind === \"denied\") return authorization.response;",
  "    const response = await retainedWorker.fetch(",
  "      sanitizeCloudflareUnattendedSmokeAssetRequest(request, authorization),",
  "      env,",
  "      executionContext",
  "    );",
  "    return markCloudflareUnattendedSmokeResponse(response, authorization, env);",
  "  },",
  "  async scheduled(event, env, executionContext) {",
  "    if (typeof retainedWorker.scheduled === \"function\") {",
  "      return retainedWorker.scheduled(event, env, executionContext);",
  "    }",
  "  }",
  "};",
  "",
  "export { RouteIqProspectiveShadowCoordinator } from \"./infrastructure/route-iq-private-forward-rollback-inert-durable-object-v3.js\";",
  "export { RouteIqBusinessAvailabilityCoordinator } from \"./infrastructure/route-iq-private-forward-rollback-inert-durable-object-v3.js\";",
  ""
].join("\n");
const expectedAssets = Object.freeze({
  directory: "./deploy/cloudflare-pages",
  binding: "ASSETS",
  run_worker_first: ["/api/*"],
  not_found_handling: "single-page-application"
});
const expectedSecrets = Object.freeze([
  "ROUTE_IQ_PROSPECTIVE_SHADOW_AUTHORITY_KEY",
  "ROUTE_IQ_PROSPECTIVE_SHADOW_AUTHORITY_KEY_VERSION"
]);
const expectedKvBindings = Object.freeze([
  { binding: "META_INSTAGRAM_TOKEN_STORE", id: "9bc431ce712544bfa18dae1b6d59e19b" },
  { binding: "AEGIS_RATE_LIMITS", id: "1365393c0e534e44af87519e46ea1450" },
  { binding: "SHARED_LEAD_INTAKE_STORE", id: "5c78f078c68147f089f7b6423c99688c" },
  { binding: "CRM_WORKSPACE_LEAD_STORE", id: "f20a0a4f66fb4b53ab26644e2d3bd0dd" },
  { binding: "DATA_ROUTE_IQ_FIELD_SESSION_STORE", id: "7a332eaad86247f7a106a48c492b76e6" }
]);
const expectedEmailBindings = Object.freeze([{
  name: "FOUNDER_EMAIL",
  destination_address: "prometheusrouteiq@gmail.com"
}]);

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

export function removeTransientNodeModulesPath(path) {
  rmSync(path, { recursive: true, force: true });
}

function readSource(path, sourceRef) {
  if (sourceRef === "WORKTREE") return readFileSync(resolve(root, path));
  return git(["show", `${sourceRef}:${path}`], { encoding: "buffer" });
}

function parseJson(buffer, path) {
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
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

function writeSourceOverlay(path, sourceRef, destination) {
  const contents = readSource(path, sourceRef);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
}

function resolveSourceIdentity(sourceRef) {
  const ref = sourceRef === "WORKTREE" ? "HEAD" : sourceRef;
  return Object.freeze({
    commit: git(["rev-parse", `${ref}^{commit}`]).trim(),
    tree: git(["rev-parse", `${ref}^{tree}`]).trim(),
    sourceMode: sourceRef === "WORKTREE" ? "noncanonical_worktree_test" : "committed_git_objects"
  });
}

export function validateRouteIqPrivateForwardRollbackBoundaryV3(contract, config) {
  const expectedBindings = JSON.stringify([
    {
      name: "ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR",
      class_name: "RouteIqProspectiveShadowCoordinator"
    },
    {
      name: "ROUTE_IQ_BUSINESS_AVAILABILITY_COORDINATOR",
      class_name: "RouteIqBusinessAvailabilityCoordinator"
    }
  ]);
  const expectedMigrations = JSON.stringify([
    {
      tag: "route-iq-prospective-shadow-sqlite-v1",
      new_sqlite_classes: ["RouteIqProspectiveShadowCoordinator"]
    },
    {
      tag: "route-iq-business-availability-sqlite-v1",
      new_sqlite_classes: ["RouteIqBusinessAvailabilityCoordinator"]
    }
  ]);
  if (contract.owner !== "Prometheus Infrastructure"
    || contract.target?.worker !== "prometheus-iq"
    || contract.target?.publicWorkerExcluded !== true
    || contract.applicationBehaviorSource?.commit !== "dec2ba1b137b0123b6f072ada4b3dd184f88c80d"
    || contract.applicationBehaviorSource?.tree !== "61258b4edcafe2af6e94f76b9e011e2486cb2fe6"
    || contract.currentPrivateProduction?.workerVersion !== "b8cba784-dfd3-4f8e-8356-816cccf6aecc"
    || contract.authorization?.deploymentAuthorized !== false
    || contract.authorization?.productionMutationAuthorized !== false
    || contract.statefulCompatibility?.nativeCloudflareRollbackAllowed !== false
    || contract.statefulCompatibility?.deletedClassesAllowed !== false
    || contract.statefulCompatibility?.migrationHistoryPreserved !== true
    || contract.statefulCompatibility?.namespaceDeletionAllowed !== false
    || contract.statefulCompatibility?.bindingRemovalAllowed !== false
    || contract.statefulCompatibility?.classExportRemovalAllowed !== false
    || contract.protectedRuntimeConfiguration?.keepVars !== true
    || contract.protectedRuntimeConfiguration?.allExistingSecretBindingsPreserved !== true
    || contract.protectedRuntimeConfiguration?.secretsFileAllowed !== false
    || contract.protectedRuntimeConfiguration?.secretCreateUpdateDeleteAllowed !== false
    || contract.runtimeBoundary?.customerPwaLaunch !== "OFF"
    || contract.runtimeBoundary?.prospectiveCollection !== "OFF"
    || contract.runtimeBoundary?.businessAvailabilityMode !== "OFF"
    || contract.runtimeBoundary?.businessAvailabilityScheduleActive !== false
    || contract.runtimeBoundary?.effectiveActiveCohortCount !== 0
    || contract.runtimeBoundary?.recommendationInfluence !== "OFF"
    || contract.candidatePackage?.publicWorkerConfigurationIncluded !== false
    || contract.candidatePackage?.smokeGuardSource !== smokeGuardPath
    || contract.candidatePackage?.smokeContractSource !== smokeContractPath
    || contract.candidatePackage?.versionMetadataBinding !== "CF_VERSION_METADATA"
    || config.name !== "prometheus-iq"
    || config.main !== "workers/prometheus-iq-worker.js"
    || config.keep_vars !== true
    || Object.hasOwn(config, "env")
    || Object.hasOwn(config, "routes")
    || JSON.stringify(config.assets) !== JSON.stringify(expectedAssets)
    || config.observability?.enabled !== true
    || config.version_metadata?.binding !== "CF_VERSION_METADATA"
    || config.vars?.ROUTE_IQ_CUSTOMER_PWA_LAUNCH_ENABLED !== "OFF"
    || config.vars?.ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION !== "OFF"
    || config.vars?.ROUTE_IQ_BUSINESS_AVAILABILITY_MODE !== "OFF"
    || Object.hasOwn(config.vars || {}, "ROUTE_IQ_BUSINESS_AVAILABILITY_ACTIVATION")
    || JSON.stringify(config.secrets?.required) !== JSON.stringify(expectedSecrets)
    || JSON.stringify(config.kv_namespaces) !== JSON.stringify(expectedKvBindings)
    || JSON.stringify(config.send_email) !== JSON.stringify(expectedEmailBindings)
    || JSON.stringify(config.durable_objects?.bindings) !== expectedBindings
    || JSON.stringify(config.migrations) !== expectedMigrations
    || Object.hasOwn(config, "triggers")
    || Object.hasOwn(config, "services")
    || config.migrations.some(migration => Object.hasOwn(migration, "deleted_classes"))) {
    throw new Error("Private forward rollback boundary is invalid.");
  }

  const actualSourceTree = git([
    "rev-parse",
    `${contract.applicationBehaviorSource.commit}^{tree}`
  ]).trim();
  if (actualSourceTree !== contract.applicationBehaviorSource.tree) {
    throw new Error("Retained application source tree does not match the rollback contract.");
  }
}

function assertArtifactIdentity(contract, artifactIdentity) {
  for (const [key, value] of Object.entries(artifactIdentity)) {
    const expected = contract.artifactIdentity?.[key];
    if (expected !== "PENDING_GENERATION" && expected !== value) {
      throw new Error(`Rollback artifact identity mismatch: ${key}`);
    }
  }
}

export function buildRouteIqPrivateForwardRollbackCandidateV3({
  outputDirectory,
  sourceRef = "HEAD",
  runDryRun = false
} = {}) {
  const contract = parseJson(readSource(contractPath, sourceRef), contractPath);
  const configBuffer = readSource(configPath, sourceRef);
  const config = parseJson(configBuffer, configPath);
  validateRouteIqPrivateForwardRollbackBoundaryV3(contract, config);

  const sourceIdentity = resolveSourceIdentity(sourceRef);
  mkdirSync(resolve(root, ".wrangler"), { recursive: true });
  const resolvedOutput = outputDirectory
    ? resolve(outputDirectory)
    : mkdtempSync(join(resolve(root, ".wrangler"), "route-iq-private-forward-rollback-v3-"));

  if (outputDirectory) assertNonexistentOutput(resolvedOutput);
  else mkdirSync(resolvedOutput, { recursive: true });

  const archivePath = join(tmpdir(), `route-iq-private-forward-rollback-v3-${process.pid}-${Date.now()}.tar`);
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
    if (/^wrangler(?:\..+)?\.(?:jsonc|json|toml)$/u.test(entry)) {
      rmSync(join(resolvedOutput, entry), { force: true });
    }
  }

  const priorEntrypoint = join(resolvedOutput, "workers/prometheus-iq-worker.js");
  const retainedEntrypoint = join(resolvedOutput, contract.candidatePackage.retainedEntrypoint);
  if (!existsSync(priorEntrypoint)) throw new Error("Retained Worker entrypoint is missing.");
  renameSync(priorEntrypoint, retainedEntrypoint);

  writeFileSync(priorEntrypoint, generatedWrapper, "utf8");
  writeSourceOverlay(inertClassPath, sourceRef, join(resolvedOutput, inertClassPath));
  writeSourceOverlay(smokeGuardPath, sourceRef, join(resolvedOutput, smokeGuardPath));
  writeSourceOverlay(smokeContractPath, sourceRef, join(resolvedOutput, smokeContractPath));
  writeFileSync(join(resolvedOutput, "wrangler.jsonc"), configBuffer);

  const priorWorkerSha256 = sha256File(retainedEntrypoint);
  const dashboardAssetPath = join(resolvedOutput, "deploy/cloudflare-pages/index.html");
  const dashboardAssetSha256 = sha256File(dashboardAssetPath);
  if (priorWorkerSha256 !== contract.applicationBehaviorSource.workerSourceSha256) {
    throw new Error("Retained Worker source hash does not match the rollback contract.");
  }
  if (dashboardAssetSha256 !== contract.applicationBehaviorSource.dashboardAssetSha256) {
    throw new Error("Retained Dashboard asset hash does not match the rollback contract.");
  }

  const artifactIdentity = Object.freeze({
    configSha256: sha256File(join(resolvedOutput, "wrangler.jsonc")),
    inertClassSha256: sha256File(join(resolvedOutput, inertClassPath)),
    generatedEntrypointSha256: sha256File(priorEntrypoint),
    contentTreeSha256: contentTreeSha256(resolvedOutput)
  });
  assertArtifactIdentity(contract, artifactIdentity);

  const generatedManifest = {
    contractId: contract.contractId,
    candidateSource: sourceIdentity,
    applicationBehaviorSource: contract.applicationBehaviorSource,
    currentPrivateProduction: contract.currentPrivateProduction,
    targetWorker: config.name,
    publicWorkerExcluded: true,
    packageDirectory: basename(resolvedOutput),
    statefulCompatibility: contract.statefulCompatibility,
    protectedRuntimeConfiguration: contract.protectedRuntimeConfiguration,
    customerPwaLaunch: config.vars.ROUTE_IQ_CUSTOMER_PWA_LAUNCH_ENABLED,
    prospectiveCollection: config.vars.ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION,
    businessAvailabilityMode: config.vars.ROUTE_IQ_BUSINESS_AVAILABILITY_MODE,
    effectiveActiveCohortCount: 0,
    recommendationInfluence: "OFF",
    deploymentAuthorized: false,
    priorWorkerSha256,
    dashboardAssetSha256,
    ...artifactIdentity,
    dryRunPassed: false
  };

  if (runDryRun) {
    const dryRunOutput = mkdtempSync(join(tmpdir(), "route-iq-private-forward-rollback-v3-dry-run-"));
    const nodeModulesLink = join(resolvedOutput, "node_modules");
    try {
      if (existsSync(nodeModulesLink)) {
        throw new Error("Rollback artifact unexpectedly contains node_modules.");
      }
      symlinkSync(resolve(root, "node_modules"), nodeModulesLink, "dir");
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
        env: {
          ...process.env,
          NODE_PATH: resolve(root, "node_modules"),
          WRANGLER_SEND_METRICS: "false"
        },
        stdio: "pipe",
        maxBuffer: 64 * 1024 * 1024
      });
      generatedManifest.dryRunPassed = true;
    } finally {
      removeTransientNodeModulesPath(nodeModulesLink);
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
    manifest: Object.freeze(generatedManifest)
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
  const result = buildRouteIqPrivateForwardRollbackCandidateV3(parseCliArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({
    status: "prepared_not_deployed",
    outputDirectory: result.outputDirectory,
    ...result.manifest
  }, null, 2)}\n`);
}
