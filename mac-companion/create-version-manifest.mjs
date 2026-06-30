#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (!key.startsWith("--")) continue;
  args.set(key.slice(2), process.argv[index + 1]);
  index += 1;
}

const companionScriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(args.get("project-root") || join(companionScriptDir, ".."));
const supportDir = resolve(args.get("support-dir") || join(process.env.HOME, "Library/Application Support/PrometheusCompanion"));
const outputPath = resolve(args.get("output") || join(projectRoot, "mac-companion/companion-version.json"));
const sourceManifestPath = args.get("source-manifest") ? resolve(args.get("source-manifest")) : "";
const scope = args.get("scope") || "source";

const ignoredNames = new Set([
  ".DS_Store",
  ".env",
  "companion-runtime-version.json",
  "companion-sync-summary.json",
  "companion-version.json"
]);

const ignoredDirs = new Set([
  ".build",
  ".git",
  "logs",
  "node_modules",
  "reports",
  "run",
  "screenshots"
]);

function gitValue(argsForGit, fallback = "unknown") {
  try {
    return execFileSync("git", argsForGit, {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim() || fallback;
  } catch {
    return fallback;
  }
}

function listFiles(root, { includeAll = false } = {}) {
  const files = [];

  function visit(current) {
    let entries = [];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name)) continue;
        visit(path);
        continue;
      }

      if (!entry.isFile()) continue;
      if (ignoredNames.has(entry.name)) continue;
      if (!includeAll && entry.name.endsWith(".local")) continue;
      files.push(path);
    }
  }

  visit(root);
  return files.sort();
}

function fingerprint(root, files) {
  const hash = createHash("sha256");
  const entries = [];

  for (const file of files) {
    const relativePath = relative(root, file).split(sep).join("/");
    const data = readFileSync(file);
    const fileHash = createHash("sha256").update(data).digest("hex");
    entries.push({ path: relativePath, sha256: fileHash, bytes: data.length });
    hash.update(relativePath);
    hash.update("\0");
    hash.update(data);
    hash.update("\0");
  }

  return {
    sha256: hash.digest("hex"),
    fileCount: files.length,
    files: entries
  };
}

function pathFingerprint(path) {
  try {
    const stat = statSync(path);
    if (stat.isDirectory()) {
      return fingerprint(path, listFiles(path, { includeAll: true }));
    }
    if (stat.isFile()) {
      return fingerprint(resolve(path, ".."), [path]);
    }
  } catch {
    return { sha256: "missing", fileCount: 0, files: [] };
  }
  return { sha256: "missing", fileCount: 0, files: [] };
}

function readJson(path) {
  if (!path) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

const companionRoot = join(projectRoot, "mac-companion");
const runtimeSourceRoot = join(projectRoot, "prometheus-os");
const integrationsSourceRoot = join(projectRoot, "integrations");
const installedAppPath = join(supportDir, "PrometheusCompanion.app");
const installedRuntimeRoot = join(supportDir, "prometheus-os");
const installedIntegrationsRoot = join(supportDir, "integrations");

const companionSource = fingerprint(projectRoot, [
  ...listFiles(companionRoot),
  ...listFiles(runtimeSourceRoot),
  ...listFiles(integrationsSourceRoot)
]);
const runtimeSource = fingerprint(projectRoot, [
  ...listFiles(runtimeSourceRoot),
  ...listFiles(integrationsSourceRoot)
]);
const sourceManifest = readJson(sourceManifestPath);
const gitCommit = gitValue(["rev-parse", "--short=12", "HEAD"]);
const gitBranch = gitValue(["branch", "--show-current"]);
const sourceStatus = gitValue(["status", "--short", "--", "mac-companion", "prometheus-os", "integrations"]);
const buildId = sourceManifest?.buildId ||
  `${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}-${gitCommit}-${companionSource.sha256.slice(0, 12)}`;

const installedApp = pathFingerprint(installedAppPath);
const installedRuntime = fingerprint(supportDir, [
  ...listFiles(installedRuntimeRoot, { includeAll: true }),
  ...listFiles(installedIntegrationsRoot, { includeAll: true })
]);
const outOfSync = [];

if (scope !== "source") {
  if (sourceManifest?.source?.companionFingerprint && sourceManifest.source.companionFingerprint !== companionSource.sha256) {
    outOfSync.push({
      area: "source",
      expected: sourceManifest.source.companionFingerprint,
      actual: companionSource.sha256,
      detail: "Current Companion source differs from the source used to generate the installed manifest."
    });
  }

  if (runtimeSource.sha256 !== installedRuntime.sha256) {
    outOfSync.push({
      area: "runtime",
      expected: runtimeSource.sha256,
      actual: installedRuntime.sha256,
      detail: "Installed Companion web runtime or shared integrations contract differs from current source."
    });
  }
}

const installedVersion = scope === "source" ? "not-installed" : buildId;
const runtimeVersion = scope === "source" ? "not-installed" : buildId;
const manifest = {
  component: "Prometheus Companion",
  schemaVersion: 1,
  buildId,
  generatedAt: new Date().toISOString(),
  scope,
  sourceVersion: buildId,
  installedVersion,
  runtimeVersion,
  git: {
    branch: gitBranch,
    commit: gitCommit,
    dirty: Boolean(sourceStatus),
    companionStatus: sourceStatus ? sourceStatus.split("\n") : []
  },
  paths: {
    projectRoot,
    companionRoot,
    runtimeSourceRoot,
    integrationsSourceRoot,
    supportDir,
    installedAppPath,
    installedRuntimeRoot,
    installedIntegrationsRoot
  },
  source: {
    companionFingerprint: companionSource.sha256,
    companionFileCount: companionSource.fileCount,
    runtimeFingerprint: runtimeSource.sha256,
    runtimeFileCount: runtimeSource.fileCount
  },
  installed: {
    appFingerprint: installedApp.sha256,
    appFileCount: installedApp.fileCount
  },
  runtime: {
    fingerprint: installedRuntime.sha256,
    fileCount: installedRuntime.fileCount
  },
  sync: {
    inSync: outOfSync.length === 0,
    outOfSync
  }
};

writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(buildId);
