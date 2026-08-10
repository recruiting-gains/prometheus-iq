import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const routeIqRetentionMaintenanceReleasePackageVersion =
  "route-iq-retention-maintenance-release-package-v1";
export const routeIqRetentionMaintenanceReleaseManifestVersion =
  "route-iq-retention-maintenance-release-manifest-v1";
export const routeIqRetentionMaintenanceReleaseConfigurationVersion =
  "route-iq-retention-maintenance-release-configuration-v1";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RELEASE_CONTRACT_PATH =
  "workers/infrastructure/route-iq-retention-maintenance-release-package-v1.json";

export const routeIqRetentionMaintenanceReleaseSourcePaths = Object.freeze([
  "data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs",
  "data/route-iq-field-sessions-v1/route-iq-prospective-retention-policy.mjs",
  "data/route-iq-field-sessions-v1/route-iq-retention-deletion-runtime.mjs",
  "workers/infrastructure/route-iq-retention-maintenance-runtime.js",
  "workers/infrastructure/route-iq-retention-maintenance-runtime-v1.json",
  "workers/infrastructure/route-iq-retention-maintenance-production-admission.js",
  "workers/infrastructure/route-iq-retention-maintenance-forward-revert-v1.json",
  RELEASE_CONTRACT_PATH
]);

function git(arguments_) {
  return execFileSync("git", arguments_, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function prettyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readSource(path, sourceRef) {
  if (sourceRef === "WORKTREE") return readFileSync(resolve(root, path));
  return Buffer.from(execFileSync("git", ["show", `${sourceRef}:${path}`], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024
  }));
}

function sourceIdentity(sourceRef) {
  const ref = sourceRef === "WORKTREE" ? "HEAD" : sourceRef;
  const commit = git(["rev-parse", `${ref}^{commit}`]);
  const tree = git(["rev-parse", `${ref}^{tree}`]);
  return Object.freeze({
    commit,
    tree,
    sourceMode: sourceRef === "WORKTREE"
      ? "noncanonical_worktree_dry_run"
      : "committed_git_objects"
  });
}

function sourceEntries(sourceRef) {
  return routeIqRetentionMaintenanceReleaseSourcePaths.map(path => {
    const bytes = readSource(path, sourceRef);
    return Object.freeze({
      path,
      byteLength: bytes.byteLength,
      sha256: sha256(bytes),
      encoding: "base64",
      content: bytes.toString("base64")
    });
  });
}

function contentSha256(entries) {
  const hash = createHash("sha256");
  for (const entry of entries) {
    hash.update(entry.path);
    hash.update("\0");
    hash.update(Buffer.from(entry.content, "base64"));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function entryHash(entries, path) {
  const entry = entries.find(candidate => candidate.path === path);
  if (!entry) throw new Error(`Retention release source is missing: ${path}`);
  return entry.sha256;
}

function releaseConfiguration(source) {
  return Object.freeze({
    configurationVersion: routeIqRetentionMaintenanceReleaseConfigurationVersion,
    target: Object.freeze({
      worker: "prometheus-iq",
      environment: "production_private",
      publicWorkerIncluded: false,
      sourceCommit: source.commit,
      sourceTree: source.tree
    }),
    bindings: Object.freeze({
      ordinaryArchive: Object.freeze({
        name: "DATA_ROUTE_IQ_FIELD_SESSION_STORE",
        capability: "append_only_archive_adapter_v1",
        deleteCapabilityExposed: false,
        exactIdentityRequiredAtAdmission: true
      }),
      maintenance: Object.freeze({
        name: "DATA_ROUTE_IQ_RETENTION_MAINTENANCE_STORE",
        capability: "authenticated_retention_maintenance_v1",
        deleteCapabilityExposed: true,
        separateCapabilityIdentityRequired: true,
        exactIdentityRequiredAtAdmission: true
      }),
      legalHoldLedger: Object.freeze({
        name: "DATA_ROUTE_IQ_RETENTION_LEGAL_HOLD_LEDGER",
        capability: "authoritative_production_legal_hold_read_v1",
        defaultsToUnavailable: true,
        exactIdentityRequiredAtAdmission: true
      }),
      admissionProducer: Object.freeze({
        name: "ROUTE_IQ_RETENTION_MAINTENANCE_ADMISSION_PRODUCER",
        capability: "signed_retention_maintenance_admission_v1",
        exactIdentityRequiredAtAdmission: true,
        deletionAuthorityAvailable: false
      })
    }),
    bindingRules: Object.freeze({
      ordinaryAndMaintenanceCapabilityIdentitiesMustDiffer: true,
      ordinaryAndMaintenanceStorageLineageMustMatch: true,
      identicalBindingInstancesFailClosed: true,
      productionBindingIdentitiesIncludedInSource: false,
      productionBindingCreationAuthorized: false
    }),
    exposure: Object.freeze({
      publicRoute: false,
      dashboardRoute: false,
      genericAdministrationRoute: false,
      representativeControl: false,
      customerControl: false
    }),
    triggers: Object.freeze({
      scheduler: false,
      cron: false,
      alarm: false,
      queueConsumer: false,
      automaticDeletion: false
    }),
    protectedState: Object.freeze({
      collection: "OFF",
      activeCohorts: 0,
      recommendationInfluence: "OFF",
      providers: "OFF",
      scheduler: "OFF"
    }),
    authorization: Object.freeze({
      deploymentAuthorized: false,
      deletionAuthorized: false,
      dryRunGrantsLaterAuthority: false
    })
  });
}

export function buildRouteIqRetentionMaintenanceReleasePackage({
  sourceRef = "HEAD",
  outputDirectory
} = {}) {
  const source = sourceIdentity(sourceRef);
  const entries = sourceEntries(sourceRef);
  const configuration = releaseConfiguration(source);
  const configurationSha256 = sha256(stableJson(configuration));
  const releaseContentSha256 = contentSha256(entries);
  const manifestBase = Object.freeze({
    manifestVersion: routeIqRetentionMaintenanceReleaseManifestVersion,
    packageVersion: routeIqRetentionMaintenanceReleasePackageVersion,
    ownerSubsystem: "Prometheus Infrastructure",
    state: "SOURCE_COMPLETE_DORMANT_NOT_DEPLOYED",
    source,
    targetWorker: "prometheus-iq",
    publicWorkerIncluded: false,
    configurationSha256,
    contentSha256: releaseContentSha256,
    maintenanceRuntimeSha256: entryHash(
      entries,
      "workers/infrastructure/route-iq-retention-maintenance-runtime.js"
    ),
    retentionPolicySha256: entryHash(
      entries,
      "data/route-iq-field-sessions-v1/route-iq-prospective-retention-policy.mjs"
    ),
    deletionRuntimeSha256: entryHash(
      entries,
      "data/route-iq-field-sessions-v1/route-iq-retention-deletion-runtime.mjs"
    ),
    forwardRollbackSha256: entryHash(
      entries,
      "workers/infrastructure/route-iq-retention-maintenance-forward-revert-v1.json"
    ),
    files: entries.map(({ path, byteLength, sha256: digest }) => Object.freeze({
      path,
      byteLength,
      sha256: digest
    })),
    cloudflareContactCount: 0,
    productionMutationCount: 0,
    deploymentAuthorized: false,
    deletionAuthorized: false
  });
  const manifestSha256 = sha256(stableJson(manifestBase));
  const manifest = Object.freeze({ ...manifestBase, manifestSha256 });
  const artifactBody = Object.freeze({
    artifactVersion: routeIqRetentionMaintenanceReleasePackageVersion,
    manifest,
    configuration,
    sources: entries
  });
  const artifactSha256 = sha256(stableJson(artifactBody));
  const artifact = Object.freeze({ artifactSha256, ...artifactBody });

  if (outputDirectory) {
    const directory = resolve(outputDirectory);
    mkdirSync(directory, { recursive: false });
    writeFileSync(
      resolve(directory, "route-iq-retention-maintenance-configuration-v1.json"),
      prettyJson(configuration),
      "utf8"
    );
    writeFileSync(
      resolve(directory, "route-iq-retention-maintenance-manifest-v1.json"),
      prettyJson(manifest),
      "utf8"
    );
    writeFileSync(
      resolve(directory, "route-iq-retention-maintenance-artifact-v1.json"),
      prettyJson(artifact),
      "utf8"
    );
  }

  return Object.freeze({
    artifact,
    manifest,
    configuration,
    identities: Object.freeze({
      artifactSha256,
      manifestSha256,
      configurationSha256,
      contentSha256: releaseContentSha256,
      maintenanceRuntimeSha256: manifest.maintenanceRuntimeSha256,
      retentionPolicySha256: manifest.retentionPolicySha256,
      deletionRuntimeSha256: manifest.deletionRuntimeSha256,
      forwardRollbackSha256: manifest.forwardRollbackSha256
    })
  });
}

export function dryRunRouteIqRetentionMaintenanceReleasePackage({ sourceRef = "HEAD" } = {}) {
  const first = buildRouteIqRetentionMaintenanceReleasePackage({ sourceRef });
  const second = buildRouteIqRetentionMaintenanceReleasePackage({ sourceRef });
  if (stableJson(first.artifact) !== stableJson(second.artifact)) {
    throw new Error("Retention maintenance release package is not deterministic.");
  }
  return Object.freeze({
    ok: true,
    dryRun: true,
    source: first.manifest.source,
    identities: first.identities,
    cloudflareContactCount: 0,
    productionMutationCount: 0,
    deploymentAuthorized: false,
    deletionAuthorized: false
  });
}

function cliOptions(arguments_) {
  const options = { sourceRef: "HEAD" };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--source-ref") options.sourceRef = arguments_[++index];
    else if (argument === "--output") options.outputDirectory = arguments_[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const options = cliOptions(process.argv.slice(2));
  const result = options.outputDirectory
    ? buildRouteIqRetentionMaintenanceReleasePackage(options)
    : dryRunRouteIqRetentionMaintenanceReleasePackage(options);
  process.stdout.write(prettyJson({
    status: "source_complete_dormant_not_deployed",
    ...result
  }));
}
