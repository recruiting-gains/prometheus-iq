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

export const CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_VERSION =
  "cloudflare-unattended-keychain-acl-interoperability-v2";
export const CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_REMEDIATION_PHRASE =
  "REPAIR ONLY THE FOUR PROMETHEUS UNATTENDED KEYCHAIN ACL AUTHORIZATION SETS";
export const CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_ROLLBACK_PHRASE =
  "ROLL BACK ONLY THE PROMETHEUS UNATTENDED KEYCHAIN AUTHORIZATIONS ADDED BY THE V2 REPAIR";
export const CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_ARTIFACT_ROOT = join(
  homedir(),
  ".prometheus/infrastructure/cloudflare-unattended-keychain-acl-interoperability-v2"
);
export const CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_HELPER = resolve(
  import.meta.dirname,
  "../helpers/cloudflare-unattended-keychain-acl-v2.swift"
);

export const CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_FAILURES = Object.freeze([
  "NONE",
  "AUTHORIZATION_SET_INVALID",
  "ACL_HELPER_TIMEOUT",
  "ACL_CHANGE_FAILED",
  "ACL_STATE_MISMATCH",
  "PARTIAL_GRANT",
  "POST_GRANT_INTERACTION_REQUIRED",
  "POST_GRANT_RETRIEVAL_FAILED",
  "ROLLBACK_FAILED"
]);

const CLASSIFICATION_LIFETIME_MS = 30 * 60 * 1_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const SAFE_REMEDIATION_REASONS = new Set([
  "ACL_ACCESS_DENIED",
  "INTERACTION_REQUIRED"
]);
const COMPONENTS = Object.freeze(["retrievalAcl", "appleToolPartition"]);
const ITEM_ALIASES = Object.freeze(CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS.map(item => item.alias));
const PHASES = new Set([
  "CLASSIFICATION_RECORDED",
  "CLASSIFICATION_CONSUMED",
  "RETRIEVAL_VERIFIED",
  "REMEDIATION_PASS",
  "REMEDIATION_FAIL",
  "ROLLBACK_STARTED",
  "ROLLBACK_PASS",
  "ROLLBACK_FAIL",
  ...CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_FAILURES
    .filter(reason => reason !== "NONE")
    .map(reason => `FAILURE_${reason}`),
  ...ITEM_ALIASES.flatMap(alias => [
    `${alias}_RETRIEVAL_ACL_PRESENT`,
    `${alias}_RETRIEVAL_ACL_MISSING`,
    `${alias}_RETRIEVAL_ACL_ADDED`,
    `${alias}_RETRIEVAL_ACL_REVOKED`,
    `${alias}_RETRIEVAL_ACL_FAILED`,
    `${alias}_APPLE_TOOL_PARTITION_PRESENT`,
    `${alias}_APPLE_TOOL_PARTITION_MISSING`,
    `${alias}_APPLE_TOOL_PARTITION_ADDED`,
    `${alias}_APPLE_TOOL_PARTITION_REVOKED`,
    `${alias}_APPLE_TOOL_PARTITION_FAILED`,
    `${alias}_POST_GRANT_RETRIEVABLE`,
    `${alias}_POST_GRANT_NOT_RETRIEVABLE`
  ])
]);

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

function currentUid() {
  if (typeof process.getuid !== "function") throw new Error("current_uid_unavailable");
  return process.getuid();
}

function modeOf(stats) {
  return stats.mode & 0o777;
}

function assertSecureDirectory(path) {
  const stats = lstatSync(path);
  if (!stats.isDirectory()
    || stats.isSymbolicLink()
    || stats.uid !== currentUid()
    || stats.nlink < 2
    || modeOf(stats) !== 0o700) {
    throw new Error("acl_v2_directory_invalid");
  }
}

function ensureSecureDirectory(path) {
  if (!existsSync(path)) {
    mkdirSync(path, { mode: 0o700, recursive: true });
    chmodSync(path, 0o700);
  }
  assertSecureDirectory(path);
}

function assertSecureFile(path) {
  const stats = lstatSync(path);
  if (!stats.isFile()
    || stats.isSymbolicLink()
    || stats.uid !== currentUid()
    || stats.nlink !== 1
    || modeOf(stats) !== 0o600) {
    throw new Error("acl_v2_file_invalid");
  }
}

function writeExclusive(path, value) {
  const descriptor = openSync(
    path,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW || 0),
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
      throw new Error("acl_v2_evidence_size_invalid");
    }
    return parseStrictJson(bytes.toString("utf8"));
  } finally {
    bytes.fill(0);
  }
}

function secureFilePresence(path) {
  if (!existsSync(path)) return false;
  assertSecureFile(path);
  return true;
}

function createAttemptDirectory(root, kind, attemptId) {
  ensureSecureDirectory(root);
  const container = join(root, kind);
  ensureSecureDirectory(container);
  const directory = join(container, attemptId);
  mkdirSync(directory, { mode: 0o700 });
  assertSecureDirectory(directory);
  return directory;
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

function canonicalNow(now) {
  const value = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(value.getTime())) throw new Error("acl_v2_time_invalid");
  return value;
}

function phaseWriter(directory) {
  let sequence = readdirSync(directory)
    .map(name => name.match(/^(\d{3})\.phase$/u))
    .filter(Boolean)
    .reduce((highest, match) => Math.max(highest, Number(match[1])), 0);
  return label => {
    if (!PHASES.has(label)) throw new Error("acl_v2_phase_invalid");
    sequence += 1;
    writeExclusive(
      join(directory, `${String(sequence).padStart(3, "0")}.phase`),
      `${label}\n`
    );
  };
}

function validateClassificationEvidence(evidence, { identity, now }) {
  if (!evidence
    || evidence.schemaVersion !== CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_VERSION
    || evidence.kind !== "classification"
    || !UUID_PATTERN.test(evidence.attemptId || "")
    || evidence.commit !== identity.commit
    || evidence.tree !== identity.tree
    || !SHA_PATTERN.test(evidence.commit || "")
    || !SHA_PATTERN.test(evidence.tree || "")
    || evidence.executionIdentity !== "MATCHED"
    || evidence.keychainLockState !== "UNLOCKED"
    || evidence.status !== "FAIL"
    || !Array.isArray(evidence.items)
    || evidence.items.length !== ITEM_ALIASES.length) {
    throw new Error("acl_v2_classification_invalid");
  }
  if (JSON.stringify(evidence.items.map(item => item.alias)) !== JSON.stringify(ITEM_ALIASES)) {
    throw new Error("acl_v2_classification_alias_invalid");
  }
  for (const item of evidence.items) {
    if (item.presence !== "PRESENT"
      || item.retrieval !== "NOT_RETRIEVABLE"
      || !CLOUDFLARE_UNATTENDED_KEYCHAIN_REASONS.includes(item.reason)
      || !SAFE_REMEDIATION_REASONS.has(item.reason)) {
      throw new Error("acl_v2_classification_item_invalid");
    }
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
    throw new Error("acl_v2_classification_time_invalid");
  }
  return evidence;
}

function requireOneEligibleClassification(root, identity, now) {
  const eligible = [];
  for (const directory of listAttemptDirectories(root, "classifications")) {
    try {
      assertSecureDirectory(directory);
      const evidence = validateClassificationEvidence(
        readJsonSecure(join(directory, "classification.json")),
        { identity, now }
      );
      if (evidence.attemptId === basename(directory)
        && !secureFilePresence(join(directory, "consumed.json"))) {
        eligible.push(Object.freeze({ directory, evidence }));
      }
    } catch {
      // Expired, malformed, replayed, or cross-version evidence is ineligible.
    }
  }
  if (eligible.length !== 1) throw new Error("acl_v2_classification_not_unique");
  return eligible[0];
}

function createClassificationConsumption(candidate, timestamp) {
  writeJsonExclusive(join(candidate.directory, "consumed.json"), {
    schemaVersion: CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_VERSION,
    kind: "classification_consumption",
    attemptId: candidate.evidence.attemptId,
    consumedAt: timestamp.toISOString()
  });
}

function scopeOf(change) {
  if (change.retrievalAclAdded && change.appleToolPartitionAdded) return "both";
  if (change.retrievalAclAdded) return "retrieval";
  if (change.appleToolPartitionAdded) return "partition";
  throw new Error("acl_v2_empty_change");
}

function fixedFailure(error) {
  const message = error?.message || "";
  if (message === "acl_v2_authorization_set_invalid") return "AUTHORIZATION_SET_INVALID";
  if (message === "acl_v2_helper_timeout") return "ACL_HELPER_TIMEOUT";
  if (message === "acl_v2_change_failed") return "ACL_CHANGE_FAILED";
  if (message === "acl_v2_rollback_failed") return "ROLLBACK_FAILED";
  if (message === "acl_v2_state_mismatch") return "ACL_STATE_MISMATCH";
  if (message === "acl_v2_partial_grant") return "PARTIAL_GRANT";
  if (message === "acl_v2_post_grant_interaction_required") {
    return "POST_GRANT_INTERACTION_REQUIRED";
  }
  return "POST_GRANT_RETRIEVAL_FAILED";
}

export function createCloudflareUnattendedAclV2Adapter({
  spawnSyncImpl = spawnSync,
  helperPath = CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_HELPER,
  environment = process.env
} = {}) {
  const invoke = (operation, alias, scope) => {
    if (!["inspect", "grant", "revoke"].includes(operation)
      || !ITEM_ALIASES.includes(alias)
      || (operation === "revoke" && !["retrieval", "partition", "both"].includes(scope))
      || (operation !== "revoke" && scope !== undefined)) {
      throw new Error("acl_v2_operation_denied");
    }
    const args = [helperPath, operation, alias];
    if (scope) args.push(scope);
    const result = spawnSyncImpl("/usr/bin/swift", args, {
      env: {
        PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
        HOME: environment.HOME || homedir(),
        TMPDIR: environment.TMPDIR || "/tmp"
      },
      stdio: "ignore",
      timeout: 120_000
    }) || {};
    if (result?.error?.code === "ETIMEDOUT") throw new Error("acl_v2_helper_timeout");
    if (result.error || !Number.isInteger(result.status)) throw new Error("acl_v2_helper_failed");
    if (result.status === 21) throw new Error("acl_v2_authorization_set_invalid");
    if ([22, 23].includes(result.status)) throw new Error("acl_v2_change_failed");
    if (result.status === 24) throw new Error("acl_v2_rollback_failed");
    return result.status;
  };
  return Object.freeze({
    inspect(alias) {
      const status = invoke("inspect", alias);
      const states = {
        0: { retrievalAcl: "PRESENT", appleToolPartition: "PRESENT" },
        10: { retrievalAcl: "MISSING", appleToolPartition: "PRESENT" },
        11: { retrievalAcl: "PRESENT", appleToolPartition: "MISSING" },
        12: { retrievalAcl: "MISSING", appleToolPartition: "MISSING" }
      };
      if (!Object.hasOwn(states, status)) throw new Error("acl_v2_authorization_set_invalid");
      return Object.freeze(states[status]);
    },
    grant(alias) {
      const status = invoke("grant", alias);
      const changes = {
        0: { retrievalAclAdded: false, appleToolPartitionAdded: false },
        30: { retrievalAclAdded: true, appleToolPartitionAdded: false },
        31: { retrievalAclAdded: false, appleToolPartitionAdded: true },
        32: { retrievalAclAdded: true, appleToolPartitionAdded: true }
      };
      if (!Object.hasOwn(changes, status)) throw new Error("acl_v2_change_failed");
      return Object.freeze(changes[status]);
    },
    revoke(alias, change) {
      const scope = scopeOf(change);
      const expected = { retrieval: 40, partition: 41, both: 42 }[scope];
      if (invoke("revoke", alias, scope) !== expected) throw new Error("acl_v2_change_failed");
      return "REMOVED";
    }
  });
}

export function recordCloudflareUnattendedKeychainAclV2Classification({
  root = resolve(import.meta.dirname, "../.."),
  artifactRoot = CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_ARTIFACT_ROOT,
  now = new Date(),
  uuid = randomUUID,
  execFile = execFileSync,
  classify = classifyCloudflareUnattendedKeychain
} = {}) {
  const identity = repositoryIdentity(root, execFile);
  if (!identity.clean) throw new Error("repository_not_clean");
  const timestamp = canonicalNow(now);
  const attemptId = uuid();
  if (!UUID_PATTERN.test(attemptId)) throw new Error("acl_v2_attempt_id_invalid");
  const classification = classify();
  const evidence = Object.freeze({
    schemaVersion: CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_VERSION,
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

function recordState(alias, state, writePhase) {
  writePhase(`${alias}_RETRIEVAL_ACL_${state.retrievalAcl}`);
  writePhase(`${alias}_APPLE_TOOL_PARTITION_${state.appleToolPartition}`);
}

function rollbackChanges(changes, acl, writePhase) {
  let passed = true;
  for (const change of [...changes].reverse()) {
    try {
      if (acl.revoke(change.alias, change) !== "REMOVED") {
        throw new Error("acl_v2_change_failed");
      }
      if (change.retrievalAclAdded) writePhase(`${change.alias}_RETRIEVAL_ACL_REVOKED`);
      if (change.appleToolPartitionAdded) {
        writePhase(`${change.alias}_APPLE_TOOL_PARTITION_REVOKED`);
      }
    } catch {
      passed = false;
      if (change.retrievalAclAdded) writePhase(`${change.alias}_RETRIEVAL_ACL_FAILED`);
      if (change.appleToolPartitionAdded) {
        writePhase(`${change.alias}_APPLE_TOOL_PARTITION_FAILED`);
      }
    }
  }
  return passed;
}

export function remediateCloudflareUnattendedKeychainAclV2({
  root = resolve(import.meta.dirname, "../.."),
  artifactRoot = CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_ARTIFACT_ROOT,
  now = new Date(),
  uuid = randomUUID,
  execFile = execFileSync,
  confirmation,
  acl = createCloudflareUnattendedAclV2Adapter(),
  classify = classifyCloudflareUnattendedKeychain
} = {}) {
  if (!confirmation?.confirm(
    "repair-unattended-keychain-acl-v2",
    CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_REMEDIATION_PHRASE
  )) {
    throw new Error("founder_confirmation_rejected");
  }
  const identity = repositoryIdentity(root, execFile);
  if (!identity.clean) throw new Error("repository_not_clean");
  const timestamp = canonicalNow(now);
  const candidate = requireOneEligibleClassification(artifactRoot, identity, timestamp);
  createClassificationConsumption(candidate, timestamp);

  const attemptId = uuid();
  if (!UUID_PATTERN.test(attemptId)) throw new Error("acl_v2_attempt_id_invalid");
  const directory = createAttemptDirectory(artifactRoot, "remediations", attemptId);
  const writePhase = phaseWriter(directory);
  writeJsonExclusive(join(directory, "plan.json"), {
    schemaVersion: CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_VERSION,
    kind: "remediation_plan",
    attemptId,
    classificationAttemptId: candidate.evidence.attemptId,
    commit: identity.commit,
    tree: identity.tree,
    createdAt: timestamp.toISOString(),
    targets: ITEM_ALIASES,
    requiredComponents: COMPONENTS
  });
  writePhase("CLASSIFICATION_CONSUMED");

  const changes = [];
  let status = "FAIL";
  let reason = "POST_GRANT_RETRIEVAL_FAILED";
  let rollbackComplete = true;
  try {
    for (const alias of ITEM_ALIASES) {
      const prior = acl.inspect(alias);
      recordState(alias, prior, writePhase);
      if (prior.retrievalAcl === "PRESENT" && prior.appleToolPartition === "PRESENT") {
        throw new Error("acl_v2_state_mismatch");
      }
      const change = Object.freeze({ alias, ...acl.grant(alias) });
      if ((prior.retrievalAcl === "MISSING") !== change.retrievalAclAdded
        || (prior.appleToolPartition === "MISSING") !== change.appleToolPartitionAdded) {
        throw new Error("acl_v2_partial_grant");
      }
      changes.push(change);
      if (change.retrievalAclAdded) writePhase(`${alias}_RETRIEVAL_ACL_ADDED`);
      if (change.appleToolPartitionAdded) writePhase(`${alias}_APPLE_TOOL_PARTITION_ADDED`);
      const after = acl.inspect(alias);
      if (after.retrievalAcl !== "PRESENT" || after.appleToolPartition !== "PRESENT") {
        throw new Error("acl_v2_partial_grant");
      }
    }

    const verification = classify();
    for (const item of verification.items || []) {
      writePhase(`${item.alias}_POST_GRANT_${
        item.retrieval === "RETRIEVABLE" ? "RETRIEVABLE" : "NOT_RETRIEVABLE"
      }`);
    }
    if (verification.status !== "PASS") {
      if ((verification.items || []).some(item => item.reason === "INTERACTION_REQUIRED")) {
        throw new Error("acl_v2_post_grant_interaction_required");
      }
      throw new Error("acl_v2_post_grant_retrieval_failed");
    }
    writePhase("RETRIEVAL_VERIFIED");
    writePhase("REMEDIATION_PASS");
    status = "PASS";
    reason = "NONE";
  } catch (error) {
    reason = fixedFailure(error);
    writePhase(`FAILURE_${reason}`);
    const currentItemRollbackComplete = reason !== "ROLLBACK_FAILED";
    rollbackComplete = rollbackChanges(changes, acl, writePhase)
      && currentItemRollbackComplete;
    if (!rollbackComplete) reason = "ROLLBACK_FAILED";
    writePhase("REMEDIATION_FAIL");
  }

  writeJsonExclusive(join(directory, "summary.json"), {
    schemaVersion: CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_VERSION,
    kind: "remediation",
    attemptId,
    classificationAttemptId: candidate.evidence.attemptId,
    commit: identity.commit,
    tree: identity.tree,
    createdAt: timestamp.toISOString(),
    changes,
    rollbackComplete,
    status,
    reason
  });
  return Object.freeze({ status, rollbackComplete, reason });
}

function validChange(change, targets) {
  return change
    && targets.includes(change.alias)
    && typeof change.retrievalAclAdded === "boolean"
    && typeof change.appleToolPartitionAdded === "boolean"
    && (change.retrievalAclAdded || change.appleToolPartitionAdded);
}

function eligibleSuccessfulRemediations(root, identity) {
  const eligible = [];
  for (const directory of listAttemptDirectories(root, "remediations")) {
    try {
      assertSecureDirectory(directory);
      const plan = readJsonSecure(join(directory, "plan.json"));
      const summary = readJsonSecure(join(directory, "summary.json"));
      if (plan.schemaVersion !== CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_VERSION
        || plan.kind !== "remediation_plan"
        || plan.attemptId !== basename(directory)
        || plan.commit !== identity.commit
        || plan.tree !== identity.tree
        || !UUID_PATTERN.test(plan.attemptId || "")
        || !Array.isArray(plan.targets)
        || JSON.stringify(plan.targets) !== JSON.stringify(ITEM_ALIASES)
        || JSON.stringify(plan.requiredComponents) !== JSON.stringify(COMPONENTS)
        || summary.schemaVersion !== CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_VERSION
        || summary.kind !== "remediation"
        || summary.attemptId !== plan.attemptId
        || summary.classificationAttemptId !== plan.classificationAttemptId
        || summary.commit !== identity.commit
        || summary.tree !== identity.tree
        || summary.status !== "PASS"
        || summary.reason !== "NONE"
        || summary.rollbackComplete !== true
        || !Array.isArray(summary.changes)
        || summary.changes.length === 0
        || summary.changes.some(change => !validChange(change, plan.targets))
        || secureFilePresence(join(directory, "rollback-consumed.json"))) {
        continue;
      }
      eligible.push(Object.freeze({ directory, plan, changes: summary.changes }));
    } catch {
      // Incomplete, tampered, or cross-attempt evidence is ineligible.
    }
  }
  return eligible;
}

export function rollbackCloudflareUnattendedKeychainAclV2({
  root = resolve(import.meta.dirname, "../.."),
  artifactRoot = CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_ARTIFACT_ROOT,
  now = new Date(),
  execFile = execFileSync,
  confirmation,
  acl = createCloudflareUnattendedAclV2Adapter()
} = {}) {
  if (!confirmation?.confirm(
    "rollback-unattended-keychain-acl-v2",
    CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_ROLLBACK_PHRASE
  )) {
    throw new Error("founder_confirmation_rejected");
  }
  const identity = repositoryIdentity(root, execFile);
  if (!identity.clean) throw new Error("repository_not_clean");
  const candidates = eligibleSuccessfulRemediations(artifactRoot, identity);
  if (candidates.length !== 1) throw new Error("acl_v2_rollback_not_unique");
  const candidate = candidates[0];
  const timestamp = canonicalNow(now);
  writeJsonExclusive(join(candidate.directory, "rollback-consumed.json"), {
    schemaVersion: CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_VERSION,
    kind: "rollback_consumption",
    attemptId: candidate.plan.attemptId,
    consumedAt: timestamp.toISOString()
  });
  const writePhase = phaseWriter(candidate.directory);
  writePhase("ROLLBACK_STARTED");
  const passed = rollbackChanges(candidate.changes, acl, writePhase);
  writePhase(passed ? "ROLLBACK_PASS" : "ROLLBACK_FAIL");
  return Object.freeze({ status: passed ? "PASS" : "FAIL" });
}
