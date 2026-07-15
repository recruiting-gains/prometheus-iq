import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

import {
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS,
  CLOUDFLARE_UNATTENDED_KEYCHAIN_REASONS,
  classifyCloudflareUnattendedKeychain
} from "./cloudflare-unattended-keychain.mjs";
import { parseStrictJson } from "./strict-json.mjs";

export const CLOUDFLARE_UNATTENDED_KEYCHAIN_INTEROPERABILITY_VERSION =
  "cloudflare-unattended-keychain-interoperability-v1";
export const CLOUDFLARE_UNATTENDED_KEYCHAIN_REMEDIATION_PHRASE =
  "REPAIR ONLY THE FOUR PROMETHEUS UNATTENDED KEYCHAIN ACCESS PERMISSIONS";
export const CLOUDFLARE_UNATTENDED_KEYCHAIN_ROLLBACK_PHRASE =
  "ROLL BACK ONLY THE PROMETHEUS UNATTENDED KEYCHAIN ACCESS PERMISSIONS ADDED BY THIS REPAIR";
export const CLOUDFLARE_UNATTENDED_KEYCHAIN_ARTIFACT_ROOT = join(
  homedir(),
  ".prometheus/infrastructure/cloudflare-unattended-keychain-interoperability-v1"
);
export const CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_HELPER = resolve(
  import.meta.dirname,
  "../helpers/cloudflare-unattended-keychain-acl.swift"
);

const CLASSIFICATION_LIFETIME_MS = 30 * 60 * 1_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const SAFE_REMEDIATION_REASONS = new Set([
  "ACL_ACCESS_DENIED",
  "INTERACTION_REQUIRED"
]);
const PHASE_PATTERN = /^(?:CLASSIFICATION_RECORDED|CLASSIFICATION_CONSUMED|(?:DEPLOYMENT_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|SMOKE_CLIENT_ID|SMOKE_CLIENT_SECRET)_(?:ACCESS_NOT_TRUSTED|ACCESS_GRANT_PENDING|ACCESS_ADDED|ACCESS_ALREADY_TRUSTED|ACCESS_REVOKED|ACCESS_FAILED)|RETRIEVAL_VERIFIED|REMEDIATION_PASS|REMEDIATION_FAIL|ROLLBACK_STARTED|ROLLBACK_PASS|ROLLBACK_FAIL)$/u;

function repositoryIdentity(root, execFile = execFileSync) {
  const run = args => execFile("/usr/bin/git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
  return Object.freeze({
    commit: run(["rev-parse", "HEAD"]),
    tree: run(["rev-parse", "HEAD^{tree}"]),
    clean: run(["status", "--porcelain=v1", "--untracked-files=all"]) === ""
  });
}

function modeOf(stats) {
  return stats.mode & 0o777;
}

function currentUid() {
  if (typeof process.getuid !== "function") throw new Error("current_uid_unavailable");
  return process.getuid();
}

function assertSecureDirectory(path) {
  const stats = lstatSync(path);
  if (!stats.isDirectory()
    || stats.isSymbolicLink()
    || stats.uid !== currentUid()
    || stats.nlink < 2
    || modeOf(stats) !== 0o700) {
    throw new Error("interoperability_directory_invalid");
  }
}

function ensureSecureDirectory(path) {
  if (existsSync(path)) {
    assertSecureDirectory(path);
    return;
  }
  mkdirSync(path, { mode: 0o700, recursive: true });
  chmodSync(path, 0o700);
  assertSecureDirectory(path);
}

function assertSecureFile(path) {
  const stats = lstatSync(path);
  if (!stats.isFile()
    || stats.isSymbolicLink()
    || stats.uid !== currentUid()
    || stats.nlink !== 1
    || modeOf(stats) !== 0o600) {
    throw new Error("interoperability_file_invalid");
  }
}

function writeExclusive(path, value) {
  const noFollow = constants.O_NOFOLLOW || 0;
  const descriptor = openSync(
    path,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | noFollow,
    0o600
  );
  try {
    writeFileSync(descriptor, value, { encoding: "utf8" });
  } finally {
    closeSync(descriptor);
  }
  chmodSync(path, 0o600);
  assertSecureFile(path);
}

function writeJsonExclusive(path, value) {
  writeExclusive(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readJsonSecure(path) {
  assertSecureFile(path);
  const bytes = readFileSync(path);
  try {
    if (bytes.length === 0 || bytes.length > 64 * 1024) {
      throw new Error("interoperability_evidence_size_invalid");
    }
    return parseStrictJson(bytes.toString("utf8"));
  } finally {
    bytes.fill(0);
  }
}

function createAttemptDirectory(root, kind, id) {
  ensureSecureDirectory(root);
  const container = join(root, kind);
  ensureSecureDirectory(container);
  const attempt = join(container, id);
  mkdirSync(attempt, { mode: 0o700 });
  assertSecureDirectory(attempt);
  return attempt;
}

function canonicalNow(now) {
  const value = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(value.getTime())) throw new Error("interoperability_time_invalid");
  return value;
}

function validateClassificationEvidence(evidence, {
  identity,
  now
}) {
  if (!evidence
    || evidence.schemaVersion !== CLOUDFLARE_UNATTENDED_KEYCHAIN_INTEROPERABILITY_VERSION
    || evidence.kind !== "classification"
    || !UUID_PATTERN.test(evidence.attemptId || "")
    || !SHA_PATTERN.test(evidence.commit || "")
    || !SHA_PATTERN.test(evidence.tree || "")
    || evidence.commit !== identity.commit
    || evidence.tree !== identity.tree
    || !["MATCHED", "MISMATCH"].includes(evidence.executionIdentity)
    || !["UNLOCKED", "LOCKED", "UNKNOWN"].includes(evidence.keychainLockState)
    || !["PASS", "FAIL"].includes(evidence.status)
    || !Array.isArray(evidence.items)
    || evidence.items.length !== CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS.length) {
    throw new Error("classification_evidence_invalid");
  }
  const aliases = evidence.items.map(item => item.alias);
  if (JSON.stringify(aliases)
    !== JSON.stringify(CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS.map(item => item.alias))) {
    throw new Error("classification_evidence_alias_invalid");
  }
  for (const item of evidence.items) {
    if (!["PRESENT", "ABSENT", "UNKNOWN"].includes(item.presence)
      || !["RETRIEVABLE", "NOT_RETRIEVABLE"].includes(item.retrieval)
      || !CLOUDFLARE_UNATTENDED_KEYCHAIN_REASONS.includes(item.reason)
      || item.retrieval === "RETRIEVABLE"
        && (item.presence !== "PRESENT" || item.reason !== "NONE")
      || item.retrieval === "NOT_RETRIEVABLE" && item.reason === "NONE") {
      throw new Error("classification_evidence_item_invalid");
    }
  }
  if ((evidence.status === "PASS")
    !== evidence.items.every(item => item.retrieval === "RETRIEVABLE")) {
    throw new Error("classification_evidence_status_invalid");
  }
  const created = new Date(evidence.createdAt);
  const expires = new Date(evidence.expiresAt);
  if (!Number.isFinite(created.getTime())
    || !Number.isFinite(expires.getTime())
    || created.toISOString() !== evidence.createdAt
    || expires.toISOString() !== evidence.expiresAt
    || expires.getTime() <= created.getTime()
    || expires.getTime() - created.getTime() > CLASSIFICATION_LIFETIME_MS
    || now.getTime() < created.getTime()
    || now.getTime() >= expires.getTime()) {
    throw new Error("classification_evidence_time_invalid");
  }
  return evidence;
}

function listAttemptDirectories(root, kind) {
  const container = join(root, kind);
  try {
    assertSecureDirectory(root);
    assertSecureDirectory(container);
  } catch {
    return [];
  }
  return readdirSync(container, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.isSymbolicLink())
    .map(entry => join(container, entry.name));
}

function eligibleClassifications(root, identity, now) {
  const eligible = [];
  for (const directory of listAttemptDirectories(root, "classifications")) {
    try {
      assertSecureDirectory(directory);
      const evidence = validateClassificationEvidence(
        readJsonSecure(join(directory, "classification.json")),
        { identity, now }
      );
      if (secureFilePresence(join(directory, "consumed.json"))) continue;
      eligible.push(Object.freeze({ directory, evidence }));
    } catch {
      // Invalid, expired, or tampered attempts are never eligible.
    }
  }
  return eligible;
}

function requireOneEligibleClassification(root, identity, now) {
  const candidates = eligibleClassifications(root, identity, now);
  if (candidates.length !== 1) throw new Error("classification_evidence_not_unique");
  const candidate = candidates[0];
  if (candidate.evidence.status !== "FAIL"
    || candidate.evidence.executionIdentity !== "MATCHED"
    || candidate.evidence.keychainLockState !== "UNLOCKED"
    || candidate.evidence.items.some(item => (
      item.presence !== "PRESENT"
      || item.retrieval === "NOT_RETRIEVABLE"
        && !SAFE_REMEDIATION_REASONS.has(item.reason)
    ))) {
    throw new Error("classification_not_remediable");
  }
  return candidate;
}

function phaseWriter(directory) {
  let sequence = readdirSync(directory)
    .map(name => name.match(/^(\d{3})\.phase$/u))
    .filter(Boolean)
    .reduce((highest, match) => Math.max(highest, Number(match[1])), 0);
  return label => {
    if (!PHASE_PATTERN.test(label)) throw new Error("remediation_phase_invalid");
    sequence += 1;
    writeExclusive(
      join(directory, `${String(sequence).padStart(3, "0")}.phase`),
      `${label}\n`
    );
  };
}

function secureFilePresence(path) {
  if (!existsSync(path)) return false;
  assertSecureFile(path);
  return true;
}

function createConsumption(candidate, now) {
  const receipt = Object.freeze({
    schemaVersion: CLOUDFLARE_UNATTENDED_KEYCHAIN_INTEROPERABILITY_VERSION,
    kind: "classification_consumption",
    attemptId: candidate.evidence.attemptId,
    consumedAt: now.toISOString()
  });
  writeJsonExclusive(join(candidate.directory, "consumed.json"), receipt);
  return receipt;
}

export function createCloudflareUnattendedAclAdapter({
  spawnSyncImpl = spawnSync,
  helperPath = CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_HELPER,
  environment = process.env
} = {}) {
  const invoke = (operation, alias) => {
    if (!["inspect", "grant", "revoke"].includes(operation)
      || !CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS.some(item => item.alias === alias)) {
      throw new Error("acl_operation_denied");
    }
    const result = spawnSyncImpl(
      "/usr/bin/swift",
      [helperPath, operation, alias],
      {
        env: {
          PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
          HOME: environment.HOME || homedir(),
          TMPDIR: environment.TMPDIR || "/tmp"
        },
        stdio: "ignore",
        timeout: 120_000
      }
    ) || {};
    if (result.error || !Number.isInteger(result.status)) {
      throw new Error("acl_helper_failed");
    }
    return result.status;
  };
  return Object.freeze({
    inspect(alias) {
      const status = invoke("inspect", alias);
      if (status === 0) return "TRUSTED";
      if (status === 10) return "NOT_TRUSTED";
      throw new Error("acl_inspection_failed");
    },
    grant(alias) {
      const status = invoke("grant", alias);
      if (status === 0) return "ALREADY_TRUSTED";
      if (status === 10) return "ADDED";
      throw new Error("acl_grant_failed");
    },
    revoke(alias) {
      const status = invoke("revoke", alias);
      if (status === 11) return "REMOVED";
      throw new Error("acl_revoke_failed");
    }
  });
}

export function recordCloudflareUnattendedKeychainClassification({
  root = resolve(import.meta.dirname, "../.."),
  artifactRoot = CLOUDFLARE_UNATTENDED_KEYCHAIN_ARTIFACT_ROOT,
  now = new Date(),
  uuid = randomUUID,
  execFile = execFileSync,
  classify = classifyCloudflareUnattendedKeychain
} = {}) {
  const identity = repositoryIdentity(root, execFile);
  if (!identity.clean) throw new Error("repository_not_clean");
  const timestamp = canonicalNow(now);
  const attemptId = uuid();
  if (!UUID_PATTERN.test(attemptId)) throw new Error("classification_attempt_id_invalid");
  const classification = classify();
  const evidence = Object.freeze({
    schemaVersion: CLOUDFLARE_UNATTENDED_KEYCHAIN_INTEROPERABILITY_VERSION,
    kind: "classification",
    attemptId,
    commit: identity.commit,
    tree: identity.tree,
    createdAt: timestamp.toISOString(),
    expiresAt: new Date(timestamp.getTime() + CLASSIFICATION_LIFETIME_MS).toISOString(),
    executionIdentity: classification.executionIdentity,
    keychainLockState: classification.keychainLockState,
    items: classification.items,
    status: classification.status
  });
  validateClassificationEvidence(evidence, { identity, now: timestamp });
  const directory = createAttemptDirectory(artifactRoot, "classifications", attemptId);
  writeJsonExclusive(join(directory, "classification.json"), evidence);
  writeExclusive(join(directory, "001.phase"), "CLASSIFICATION_RECORDED\n");
  return classification;
}

function rollbackAliases(aliases, acl, writePhase) {
  let passed = true;
  for (const alias of [...aliases].reverse()) {
    try {
      const prior = acl.inspect(alias);
      if (prior === "NOT_TRUSTED") {
        writePhase(`${alias}_ACCESS_NOT_TRUSTED`);
        continue;
      }
      if (prior !== "TRUSTED") throw new Error("acl_inspection_failed");
      if (acl.revoke(alias) !== "REMOVED") throw new Error("acl_revoke_failed");
      writePhase(`${alias}_ACCESS_REVOKED`);
    } catch {
      passed = false;
      writePhase(`${alias}_ACCESS_FAILED`);
    }
  }
  return passed;
}

export function remediateCloudflareUnattendedKeychain({
  root = resolve(import.meta.dirname, "../.."),
  artifactRoot = CLOUDFLARE_UNATTENDED_KEYCHAIN_ARTIFACT_ROOT,
  now = new Date(),
  uuid = randomUUID,
  execFile = execFileSync,
  confirmation,
  acl = createCloudflareUnattendedAclAdapter(),
  classify = classifyCloudflareUnattendedKeychain
} = {}) {
  if (!confirmation?.confirm(
    "repair-unattended-keychain-access",
    CLOUDFLARE_UNATTENDED_KEYCHAIN_REMEDIATION_PHRASE
  )) {
    throw new Error("founder_confirmation_rejected");
  }
  const identity = repositoryIdentity(root, execFile);
  if (!identity.clean) throw new Error("repository_not_clean");
  const timestamp = canonicalNow(now);
  const candidate = requireOneEligibleClassification(artifactRoot, identity, timestamp);
  createConsumption(candidate, timestamp);

  const attemptId = uuid();
  if (!UUID_PATTERN.test(attemptId)) throw new Error("remediation_attempt_id_invalid");
  const directory = createAttemptDirectory(artifactRoot, "remediations", attemptId);
  const writePhase = phaseWriter(directory);
  const targets = candidate.evidence.items
    .filter(entry => entry.retrieval !== "RETRIEVABLE")
    .map(entry => entry.alias);
  writeJsonExclusive(join(directory, "plan.json"), {
    schemaVersion: CLOUDFLARE_UNATTENDED_KEYCHAIN_INTEROPERABILITY_VERSION,
    kind: "remediation_plan",
    attemptId,
    classificationAttemptId: candidate.evidence.attemptId,
    commit: identity.commit,
    tree: identity.tree,
    createdAt: timestamp.toISOString(),
    targets
  });
  writePhase("CLASSIFICATION_CONSUMED");
  const added = [];
  let status = "FAIL";
  let rollbackComplete = true;

  try {
    for (const item of candidate.evidence.items.filter(entry => entry.retrieval !== "RETRIEVABLE")) {
      const prior = acl.inspect(item.alias);
      if (prior !== "NOT_TRUSTED") throw new Error("acl_state_does_not_explain_failure");
      writePhase(`${item.alias}_ACCESS_NOT_TRUSTED`);
      writePhase(`${item.alias}_ACCESS_GRANT_PENDING`);
      const result = acl.grant(item.alias);
      if (result === "ADDED") {
        added.push(item.alias);
        writePhase(`${item.alias}_ACCESS_ADDED`);
      } else {
        writePhase(`${item.alias}_ACCESS_ALREADY_TRUSTED`);
      }
    }
    const verification = classify();
    if (verification.status !== "PASS") throw new Error("retrieval_verification_failed");
    writePhase("RETRIEVAL_VERIFIED");
    writePhase("REMEDIATION_PASS");
    status = "PASS";
  } catch {
    rollbackComplete = rollbackAliases(added, acl, writePhase);
    writePhase("REMEDIATION_FAIL");
  }

  const summary = Object.freeze({
    schemaVersion: CLOUDFLARE_UNATTENDED_KEYCHAIN_INTEROPERABILITY_VERSION,
    kind: "remediation",
    attemptId,
    classificationAttemptId: candidate.evidence.attemptId,
    commit: identity.commit,
    tree: identity.tree,
    createdAt: timestamp.toISOString(),
    added: Object.freeze([...added]),
    rollbackComplete,
    status
  });
  writeJsonExclusive(join(directory, "summary.json"), summary);
  return Object.freeze({ status, rollbackComplete });
}

function eligibleRemediations(root, identity) {
  const eligible = [];
  for (const directory of listAttemptDirectories(root, "remediations")) {
    try {
      assertSecureDirectory(directory);
      const plan = readJsonSecure(join(directory, "plan.json"));
      if (plan.schemaVersion !== CLOUDFLARE_UNATTENDED_KEYCHAIN_INTEROPERABILITY_VERSION
        || plan.kind !== "remediation_plan"
        || plan.commit !== identity.commit
        || plan.tree !== identity.tree
        || plan.attemptId !== basename(directory)
        || !UUID_PATTERN.test(plan.attemptId || "")
        || !UUID_PATTERN.test(plan.classificationAttemptId || "")
        || !Array.isArray(plan.targets)
        || plan.targets.length === 0
        || plan.targets.some(alias => (
          !CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS.some(item => item.alias === alias)
        ))) {
        continue;
      }
      if (secureFilePresence(join(directory, "rollback-consumed.json"))) continue;
      let aliases = plan.targets;
      if (secureFilePresence(join(directory, "summary.json"))) {
        const summary = readJsonSecure(join(directory, "summary.json"));
        if (summary.schemaVersion !== CLOUDFLARE_UNATTENDED_KEYCHAIN_INTEROPERABILITY_VERSION
          || summary.kind !== "remediation"
          || summary.attemptId !== plan.attemptId
          || summary.classificationAttemptId !== plan.classificationAttemptId
          || summary.commit !== identity.commit
          || summary.tree !== identity.tree
          || !["PASS", "FAIL"].includes(summary.status)
          || !Array.isArray(summary.added)
          || summary.added.some(alias => !plan.targets.includes(alias))) {
          continue;
        }
        if (summary.status === "FAIL" && summary.rollbackComplete === true) continue;
        aliases = summary.status === "PASS" ? summary.added : plan.targets;
      }
      if (aliases.length === 0) continue;
      eligible.push(Object.freeze({ directory, plan, aliases: Object.freeze([...aliases]) }));
    } catch {
      // Tampered or incomplete remediation records are never rollback inputs.
    }
  }
  return eligible;
}

export function rollbackCloudflareUnattendedKeychainRemediation({
  root = resolve(import.meta.dirname, "../.."),
  artifactRoot = CLOUDFLARE_UNATTENDED_KEYCHAIN_ARTIFACT_ROOT,
  now = new Date(),
  execFile = execFileSync,
  confirmation,
  acl = createCloudflareUnattendedAclAdapter()
} = {}) {
  if (!confirmation?.confirm(
    "rollback-unattended-keychain-access",
    CLOUDFLARE_UNATTENDED_KEYCHAIN_ROLLBACK_PHRASE
  )) {
    throw new Error("founder_confirmation_rejected");
  }
  const identity = repositoryIdentity(root, execFile);
  if (!identity.clean) throw new Error("repository_not_clean");
  const candidates = eligibleRemediations(artifactRoot, identity);
  if (candidates.length !== 1) throw new Error("rollback_evidence_not_unique");
  const candidate = candidates[0];
  const timestamp = canonicalNow(now);
  writeJsonExclusive(join(candidate.directory, "rollback-consumed.json"), {
    schemaVersion: CLOUDFLARE_UNATTENDED_KEYCHAIN_INTEROPERABILITY_VERSION,
    kind: "rollback_consumption",
    attemptId: candidate.plan.attemptId,
    consumedAt: timestamp.toISOString()
  });
  const writePhase = phaseWriter(candidate.directory);
  writePhase("ROLLBACK_STARTED");
  const passed = rollbackAliases(candidate.aliases, acl, writePhase);
  writePhase(passed ? "ROLLBACK_PASS" : "ROLLBACK_FAIL");
  return Object.freeze({ status: passed ? "PASS" : "FAIL" });
}
