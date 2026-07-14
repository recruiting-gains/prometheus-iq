import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extname, resolve } from "node:path";

export const ENVIRONMENT_CREDENTIAL_NAMES = Object.freeze([
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_ACCESS_CLIENT_ID",
  "CLOUDFLARE_ACCESS_CLIENT_SECRET"
]);

export const KEYCHAIN_ITEMS = Object.freeze([
  Object.freeze({
    service: "com.prometheus.cloudflare.unattended.deployment",
    account: "CLOUDFLARE_API_TOKEN"
  }),
  Object.freeze({
    service: "com.prometheus.cloudflare.unattended.deployment",
    account: "CLOUDFLARE_ACCOUNT_ID"
  }),
  Object.freeze({
    service: "com.prometheus.cloudflare.unattended.smoke",
    account: "CLOUDFLARE_ACCESS_CLIENT_ID"
  }),
  Object.freeze({
    service: "com.prometheus.cloudflare.unattended.smoke",
    account: "CLOUDFLARE_ACCESS_CLIENT_SECRET"
  })
]);

export const LOCAL_SECRET_ARTIFACT_CANDIDATES = Object.freeze([
  ".cloudflare-unattended/credential-cache",
  ".cloudflare-unattended-control-v1.json",
  ".cloudflare-unattended-credentials.json",
  "cloudflare-unattended-deployment-control-v1.json",
  "cloudflare-api-token.txt",
  "cloudflare-access-service-token.txt"
]);

const assignmentNames = Object.freeze([
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCESS_CLIENT_ID",
  "CLOUDFLARE_ACCESS_CLIENT_SECRET",
  "CLOUDFLARE_API_KEY",
  "CF_API_KEY",
  "CF-Access-Client-Id",
  "CF-Access-Client-Secret",
  "PROMETHEUS_ACCESS_COOKIE",
  "CF_AUTHORIZATION",
  "CF_APPSESSION"
]);

const sourceExtensions = new Set([
  "",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsonc",
  ".md",
  ".mjs",
  ".sh",
  ".toml",
  ".txt",
  ".yaml",
  ".yml"
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const assignmentPattern = new RegExp(
  `(?:^|[^A-Za-z0-9_-])(?:${assignmentNames.map(escapeRegExp).join("|")})["']?\\s*(?:=|:)\\s*(.+)$`,
  "iu"
);

const highConfidencePatterns = Object.freeze([
  Object.freeze({
    kind: "Cloudflare API token format",
    pattern: /\bcf(?:ut|at)_[A-Za-z0-9_-]{24,}\b/u
  }),
  Object.freeze({
    kind: "Cloudflare Access Client ID format",
    pattern: /\b[0-9a-f]{32,64}\.access\b/iu
  })
]);

function isPlaceholderOrReference(rawValue) {
  const value = rawValue
    .trim()
    .replace(/^[`"']+/u, "")
    .replace(/[`"',;)}\]]+$/u, "")
    .trim();

  if (!value) return true;
  return /^(?:<|\$\{|\$[A-Za-z_]|process\.env|Deno\.env|Bun\.env|env\.|REDACTED\b|PLACEHOLDER\b|EXAMPLE\b|FOUNDER_|PRESENT\b|ABSENT\b|true\b|false\b|null\b|undefined\b)/iu.test(value);
}

export function scanTextForCloudflareSecrets(content, path = "synthetic-input") {
  const findings = [];
  const seen = new Set();
  const add = (kind, line) => {
    const key = `${kind}:${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(Object.freeze({ path, kind, line }));
  };

  const lines = content.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const candidate of highConfidencePatterns) {
      if (candidate.pattern.test(line)) add(candidate.kind, index + 1);
    }
    const assignment = line.match(assignmentPattern);
    if (assignment && !isPlaceholderOrReference(assignment[1])) {
      add("literal Cloudflare credential assignment", index + 1);
    }
  }
  return findings;
}

export function listTrackedFiles(root) {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).split("\0").filter(Boolean);
}

export function scanTrackedRepository({
  root,
  trackedFiles = listTrackedFiles(root),
  readFile = path => readFileSync(resolve(root, path))
}) {
  const findings = [];
  for (const path of trackedFiles) {
    if (!sourceExtensions.has(extname(path)) && !path.endsWith("_headers")) continue;
    const absolute = resolve(root, path);
    try {
      if (statSync(absolute).size > 2_000_000) continue;
    } catch {
      continue;
    }
    const buffer = readFile(path);
    if (buffer.includes(0)) continue;
    findings.push(...scanTextForCloudflareSecrets(buffer.toString("utf8"), path));
  }
  return findings;
}

export function inspectEnvironmentPresence(hasName = name => Object.hasOwn(process.env, name)) {
  return ENVIRONMENT_CREDENTIAL_NAMES.map(name => Object.freeze({
    source: "environment",
    name,
    present: Boolean(hasName(name))
  }));
}

function keychainItemExists(item) {
  const result = spawnSync(
    "/usr/bin/security",
    ["find-generic-password", "-s", item.service, "-a", item.account],
    { stdio: "ignore" }
  );
  return result.status === 0;
}

export function inspectKeychainPresence(hasItem = keychainItemExists) {
  return KEYCHAIN_ITEMS.map(item => Object.freeze({
    source: "keychain",
    name: `${item.service}/${item.account}`,
    present: Boolean(hasItem(item))
  }));
}

export function formatPresenceReport(results) {
  return results
    .map(result => `${result.name}: ${result.present ? "PRESENT" : "ABSENT"}`)
    .join("\n");
}

export function presenceRequirementFailures(results, requirePresent) {
  if (!requirePresent) return [];
  return results
    .filter(result => !result.present)
    .map(result => `${result.name} is ABSENT`);
}

export function verifyLocalSecretArtifacts({ root }) {
  const failures = [];
  for (const path of LOCAL_SECRET_ARTIFACT_CANDIDATES) {
    const ignored = spawnSync(
      "git",
      ["check-ignore", "--quiet", "--no-index", path],
      { cwd: root, stdio: "ignore" }
    ).status === 0;
    if (!ignored) failures.push(`${path} is not ignored`);

    const tracked = spawnSync(
      "git",
      ["ls-files", "--error-unmatch", path],
      { cwd: root, stdio: "ignore" }
    ).status === 0;
    if (tracked) failures.push(`${path} is tracked`);
  }
  return failures;
}

function parseArgs(argv) {
  const parsed = { requirePresent: false, source: "environment" };
  for (const arg of argv) {
    if (arg === "--require-present") parsed.requirePresent = true;
    else if (arg.startsWith("--source=")) parsed.source = arg.slice("--source=".length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!["environment", "keychain", "both"].includes(parsed.source)) {
    throw new Error("--source must be environment, keychain, or both");
  }
  return parsed;
}

export function runSecretPresenceCheck({
  root = resolve(import.meta.dirname, ".."),
  argv = [],
  environmentHas,
  keychainHas
} = {}) {
  const options = parseArgs(argv);
  const results = [];
  if (options.source !== "keychain") results.push(...inspectEnvironmentPresence(environmentHas));
  if (options.source !== "environment") results.push(...inspectKeychainPresence(keychainHas));

  const findings = scanTrackedRepository({ root });
  const artifactFailures = verifyLocalSecretArtifacts({ root });
  const presenceFailures = presenceRequirementFailures(results, options.requirePresent);
  return Object.freeze({
    status: findings.length || artifactFailures.length || presenceFailures.length ? "failed" : "passed",
    options: Object.freeze(options),
    presence: Object.freeze(results),
    findings: Object.freeze(findings),
    artifactFailures: Object.freeze(artifactFailures),
    presenceFailures: Object.freeze(presenceFailures)
  });
}

function printCheck(result) {
  console.log(`Cloudflare unattended credential presence (${result.options.source}):`);
  console.log(formatPresenceReport(result.presence));
  console.log(`Tracked-source Cloudflare secret scan: ${result.findings.length ? "FAIL" : "PASS"}`);
  console.log(`Local secret artifact ignore/tracking check: ${result.artifactFailures.length ? "FAIL" : "PASS"}`);
  if (result.presenceFailures.length) {
    console.error("Required credential names are absent:");
    for (const failure of result.presenceFailures) console.error(`- ${failure}`);
  }
  if (result.findings.length) {
    console.error("Potential Cloudflare credentials detected:");
    for (const finding of result.findings) {
      console.error(`- ${finding.path}:${finding.line} (${finding.kind})`);
    }
  }
  if (result.artifactFailures.length) {
    console.error("Local secret artifact protection failed:");
    for (const failure of result.artifactFailures) console.error(`- ${failure}`);
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const result = runSecretPresenceCheck({ argv: process.argv.slice(2) });
    printCheck(result);
    if (result.status !== "passed") process.exitCode = 1;
  } catch (error) {
    console.error(`Cloudflare unattended credential check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
