import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { realpathSync, statSync } from "node:fs";

import {
  KEYCHAIN_ITEMS
} from "../check-cloudflare-unattended-secret-presence.mjs";

export const CLOUDFLARE_UNATTENDED_KEYCHAIN_EXECUTABLE = "/usr/bin/security";
export const CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS = Object.freeze([
  Object.freeze({ alias: "DEPLOYMENT_API_TOKEN", ...KEYCHAIN_ITEMS[0] }),
  Object.freeze({ alias: "CLOUDFLARE_ACCOUNT_ID", ...KEYCHAIN_ITEMS[1] }),
  Object.freeze({ alias: "SMOKE_CLIENT_ID", ...KEYCHAIN_ITEMS[2] }),
  Object.freeze({ alias: "SMOKE_CLIENT_SECRET", ...KEYCHAIN_ITEMS[3] })
]);

export const CLOUDFLARE_UNATTENDED_KEYCHAIN_REASONS = Object.freeze([
  "NONE",
  "ITEM_ABSENT",
  "KEYCHAIN_LOCKED",
  "INCORRECT_SERVICE_IDENTITY",
  "INCORRECT_ACCOUNT_IDENTITY",
  "ACL_ACCESS_DENIED",
  "EXECUTION_IDENTITY_MISMATCH",
  "INTERACTION_REQUIRED",
  "UNKNOWN_FAILURE"
]);

const MAX_VALUE_BYTES = 64 * 1024;
const RETRIEVAL_TIMEOUT_MS = 5_000;
const STATUS = Object.freeze({
  itemNotFound: 44,
  interactionNotAllowed: 36,
  authorizationFailed: 51,
  keychainNotAvailable: 53,
  userCanceled: 128
});

function fixedEnvironment(source = process.env) {
  const environment = {
    PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
    HOME: typeof source.HOME === "string" ? source.HOME : homedir()
  };
  for (const name of ["TMPDIR", "LANG", "LC_ALL"]) {
    if (typeof source[name] === "string") environment[name] = source[name];
  }
  return environment;
}

function disposeResult(result) {
  if (Buffer.isBuffer(result?.stdout)) result.stdout.fill(0);
  if (Buffer.isBuffer(result?.stderr)) result.stderr.fill(0);
}

function statusOf(result) {
  return Number.isInteger(result?.status) ? result.status : null;
}

function runSecurity(spawnSyncImpl, args, environment, timeout = RETRIEVAL_TIMEOUT_MS) {
  return spawnSyncImpl(CLOUDFLARE_UNATTENDED_KEYCHAIN_EXECUTABLE, args, {
    encoding: null,
    env: fixedEnvironment(environment),
    maxBuffer: MAX_VALUE_BYTES,
    stdio: ["ignore", "pipe", "pipe"],
    timeout
  }) || {};
}

function probeMetadata(spawnSyncImpl, args, environment) {
  const result = runSecurity(spawnSyncImpl, args, environment);
  const exists = !result.error && statusOf(result) === 0;
  const status = statusOf(result);
  disposeResult(result);
  return Object.freeze({ exists, status });
}

function inspectExecutionIdentity({
  environment = process.env,
  getuid = process.getuid?.bind(process),
  geteuid = process.geteuid?.bind(process),
  getgid = process.getgid?.bind(process),
  getegid = process.getegid?.bind(process),
  home = homedir,
  realpath = realpathSync,
  stat = statSync
} = {}) {
  try {
    if (typeof getuid !== "function"
      || typeof geteuid !== "function"
      || typeof getgid !== "function"
      || typeof getegid !== "function"
      || getuid() !== geteuid()
      || getgid() !== getegid()
      || environment.HOME !== home()
      || realpath(CLOUDFLARE_UNATTENDED_KEYCHAIN_EXECUTABLE)
        !== CLOUDFLARE_UNATTENDED_KEYCHAIN_EXECUTABLE) {
      return "MISMATCH";
    }
    const executable = stat(CLOUDFLARE_UNATTENDED_KEYCHAIN_EXECUTABLE);
    if (!executable.isFile() || executable.uid !== 0 || (executable.mode & 0o111) === 0) {
      return "MISMATCH";
    }
    return "MATCHED";
  } catch {
    return "MISMATCH";
  }
}

function inspectKeychainLock(spawnSyncImpl, environment) {
  const result = runSecurity(
    spawnSyncImpl,
    ["show-keychain-info"],
    environment
  );
  const status = statusOf(result);
  const state = status === 0
    ? "UNLOCKED"
    : [STATUS.interactionNotAllowed, STATUS.authorizationFailed, STATUS.keychainNotAvailable].includes(status)
      ? "LOCKED"
      : "UNKNOWN";
  disposeResult(result);
  return state;
}

function classifyMissingIdentity(item, spawnSyncImpl, environment) {
  const service = probeMetadata(
    spawnSyncImpl,
    ["find-generic-password", "-s", item.service],
    environment
  );
  const account = probeMetadata(
    spawnSyncImpl,
    ["find-generic-password", "-a", item.account],
    environment
  );
  if (service.exists) return "INCORRECT_ACCOUNT_IDENTITY";
  if (account.exists) return "INCORRECT_SERVICE_IDENTITY";
  if (service.status === STATUS.itemNotFound && account.status === STATUS.itemNotFound) {
    return "ITEM_ABSENT";
  }
  return "UNKNOWN_FAILURE";
}

function classifyRetrievalFailure(result, keychainLockState) {
  const status = statusOf(result);
  if (keychainLockState === "LOCKED") return "KEYCHAIN_LOCKED";
  if (result?.error?.code === "ETIMEDOUT"
    || status === STATUS.interactionNotAllowed
    || status === STATUS.userCanceled) {
    return "INTERACTION_REQUIRED";
  }
  if (status === STATUS.authorizationFailed) return "ACL_ACCESS_DENIED";
  if (status === STATUS.keychainNotAvailable) return "KEYCHAIN_LOCKED";
  return "UNKNOWN_FAILURE";
}

export function createMacOsKeychainAdapter({
  spawnSyncImpl = spawnSync,
  environment = process.env
} = {}) {
  return Object.freeze({
    hasItem(item) {
      const result = runSecurity(
        spawnSyncImpl,
        ["find-generic-password", "-s", item.service, "-a", item.account],
        environment
      );
      const present = !result.error && statusOf(result) === 0;
      disposeResult(result);
      return present;
    },

    readItem(item) {
      const result = runSecurity(
        spawnSyncImpl,
        ["find-generic-password", "-w", "-s", item.service, "-a", item.account],
        environment
      );
      const valid = !result.error
        && statusOf(result) === 0
        && Buffer.isBuffer(result.stdout)
        && result.stdout.length > 0
        && result.stdout.length <= MAX_VALUE_BYTES;
      if (!valid) {
        disposeResult(result);
        throw new Error(`keychain_item_unavailable:${item.account}`);
      }
      const value = result.stdout.toString("utf8").replace(/\r?\n$/u, "");
      disposeResult(result);
      if (!value) throw new Error(`keychain_item_unavailable:${item.account}`);
      return value;
    }
  });
}

export function classifyCloudflareUnattendedKeychain({
  spawnSyncImpl = spawnSync,
  environment = process.env,
  executionIdentity = inspectExecutionIdentity({ environment }),
  keychainLockState = inspectKeychainLock(spawnSyncImpl, environment)
} = {}) {
  const results = [];
  for (const item of CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS) {
    if (executionIdentity !== "MATCHED") {
      results.push(Object.freeze({
        alias: item.alias,
        presence: "UNKNOWN",
        retrieval: "NOT_RETRIEVABLE",
        reason: "EXECUTION_IDENTITY_MISMATCH"
      }));
      continue;
    }

    const exact = probeMetadata(
      spawnSyncImpl,
      ["find-generic-password", "-s", item.service, "-a", item.account],
      environment
    );
    if (!exact.exists) {
      const reason = keychainLockState === "LOCKED"
        ? "KEYCHAIN_LOCKED"
        : exact.status === STATUS.authorizationFailed
          ? "ACL_ACCESS_DENIED"
          : [STATUS.interactionNotAllowed, STATUS.userCanceled].includes(exact.status)
            ? "INTERACTION_REQUIRED"
            : exact.status === STATUS.itemNotFound
              ? classifyMissingIdentity(item, spawnSyncImpl, environment)
              : "UNKNOWN_FAILURE";
      results.push(Object.freeze({
        alias: item.alias,
        presence: reason === "ITEM_ABSENT" ? "ABSENT" : "UNKNOWN",
        retrieval: "NOT_RETRIEVABLE",
        reason
      }));
      continue;
    }

    const retrieval = runSecurity(
      spawnSyncImpl,
      ["find-generic-password", "-w", "-s", item.service, "-a", item.account],
      environment
    );
    const retrievable = !retrieval.error
      && statusOf(retrieval) === 0
      && Buffer.isBuffer(retrieval.stdout)
      && retrieval.stdout.length > 0
      && retrieval.stdout.length <= MAX_VALUE_BYTES;
    const reason = retrievable
      ? "NONE"
      : classifyRetrievalFailure(retrieval, keychainLockState);
    disposeResult(retrieval);
    results.push(Object.freeze({
      alias: item.alias,
      presence: "PRESENT",
      retrieval: retrievable ? "RETRIEVABLE" : "NOT_RETRIEVABLE",
      reason
    }));
  }
  return Object.freeze({
    executionIdentity,
    keychainLockState,
    items: Object.freeze(results),
    status: results.every(item => item.retrieval === "RETRIEVABLE") ? "PASS" : "FAIL"
  });
}

export function formatCloudflareUnattendedKeychainClassification(classification) {
  const lines = classification.items.map(item => (
    `${item.alias}: ${item.presence} ${item.retrieval} ${item.reason}`
  ));
  lines.push(`EXECUTION_IDENTITY: ${classification.executionIdentity}`);
  lines.push(`KEYCHAIN: ${classification.keychainLockState}`);
  lines.push(classification.status);
  return lines.join("\n");
}
