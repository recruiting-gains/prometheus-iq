import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import {
  CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256,
  CLOUDFLARE_FOUNDER_ATTENDED_DIRECTIVE,
  CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_DURATION,
  CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_NAME
} from "./cloudflare-founder-attended-constants.mjs";
import { parseStrictJson } from "./strict-json.mjs";

export const CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_SCHEMA =
  "cloudflare-founder-attended-service-token-control-v1";
export const CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_MAX_BYTES = 8 * 1024;
export const CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_MAX_LIFETIME_MS = 30 * 60 * 1000;
export const CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_DIRECTORY = resolve(
  homedir(),
  ".prometheus/infrastructure/cloudflare-founder-attended-service-token-v1"
);
export const CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_PATH = join(
  CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_DIRECTORY,
  "control.json"
);

const CONTROL_KEYS = Object.freeze([
  "schemaVersion",
  "enabled",
  "directive",
  "accountIdSha256",
  "serviceTokenName",
  "duration",
  "authorizedCommit",
  "authorizedTree",
  "issuedAt",
  "expiresAt",
  "oneShotAuthorizationNonce"
]);

const FIXED_CONTROL_VALUES = Object.freeze({
  directive: CLOUDFLARE_FOUNDER_ATTENDED_DIRECTIVE,
  serviceTokenName: CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_NAME,
  duration: CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_DURATION
});

function sameKeys(value, expected) {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  return actual.length === required.length
    && actual.every((key, index) => key === required[index]);
}

function canonicalTimestamp(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
    ? parsed
    : null;
}

function currentUid() {
  return typeof process.getuid === "function" ? process.getuid() : null;
}

function inspectSecureDirectory(path, expectedUid) {
  const info = lstatSync(path);
  if (!info.isDirectory()
    || info.isSymbolicLink()
    || info.uid !== expectedUid
    || (info.mode & 0o777) !== 0o700) {
    throw new Error("founder_attended_control_directory_invalid");
  }
}

function ensureSecureDirectory(path, expectedUid) {
  try {
    mkdirSync(path, { recursive: true, mode: 0o700 });
  } catch {
    throw new Error("founder_attended_control_directory_invalid");
  }
  inspectSecureDirectory(path, expectedUid);
}

function inspectSecureControlFile(path, expectedUid) {
  inspectSecureDirectory(dirname(path), expectedUid);
  const info = lstatSync(path);
  const reasons = [];
  if (!info.isFile() || info.isSymbolicLink()) reasons.push("control_not_regular_file");
  if (info.uid !== expectedUid) reasons.push("control_wrong_owner");
  if ((info.mode & 0o777) !== 0o600) reasons.push("control_wrong_mode");
  if (info.nlink !== 1) reasons.push("control_link_count_invalid");
  if (info.size < 2 || info.size > CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_MAX_BYTES) {
    reasons.push("control_size_invalid");
  }
  return { info, reasons };
}

function readSecureControl(path, expectedUid) {
  const inspected = inspectSecureControlFile(path, expectedUid);
  if (inspected.reasons.length) return { control: null, reasons: inspected.reasons };
  const noFollow = constants.O_NOFOLLOW || 0;
  const fd = openSync(path, constants.O_RDONLY | noFollow);
  try {
    const opened = fstatSync(fd);
    if (!opened.isFile()
      || opened.uid !== expectedUid
      || (opened.mode & 0o777) !== 0o600
      || opened.nlink !== 1
      || opened.dev !== inspected.info.dev
      || opened.ino !== inspected.info.ino) {
      return { control: null, reasons: ["control_changed_during_open"] };
    }
    const raw = readFileSync(fd);
    if (!raw.length || raw.length > CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_MAX_BYTES) {
      return { control: null, reasons: ["control_size_invalid"] };
    }
    try {
      return {
        control: parseStrictJson(raw.toString("utf8")),
        reasons: []
      };
    } catch {
      return { control: null, reasons: ["control_json_invalid"] };
    } finally {
      raw.fill(0);
    }
  } finally {
    closeSync(fd);
  }
}

function receiptPath(controlPath, nonce) {
  const digest = createHash("sha256").update(nonce, "utf8").digest("hex");
  return join(`${controlPath}.consumed`, `${digest}.json`);
}

export function readFounderAttendedRepositoryIdentity({
  root,
  execFile = execFileSync
} = {}) {
  const run = args => execFile("/usr/bin/git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
  try {
    return Object.freeze({
      commit: run(["rev-parse", "HEAD"]),
      tree: run(["rev-parse", "HEAD^{tree}"]),
      clean: run(["status", "--porcelain=v1", "--untracked-files=all"]) === ""
    });
  } catch {
    throw new Error("founder_attended_repository_identity_failed");
  }
}

export function defaultFounderAttendedControl() {
  return Object.freeze({
    schemaVersion: CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_SCHEMA,
    enabled: false,
    ...FIXED_CONTROL_VALUES,
    accountIdSha256: CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256,
    authorizedCommit: "",
    authorizedTree: "",
    issuedAt: "",
    expiresAt: "",
    oneShotAuthorizationNonce: ""
  });
}

export function validateFounderAttendedControl(control, {
  now = new Date(),
  expectedCommit,
  expectedTree,
  expectedAccountIdSha256 = CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256,
  consumed = false
} = {}) {
  const reasons = [];
  if (!control || typeof control !== "object" || Array.isArray(control)) {
    return Object.freeze({ valid: false, reasons: Object.freeze(["control_missing_or_invalid"]) });
  }
  if (!sameKeys(control, CONTROL_KEYS)) reasons.push("control_shape_invalid");
  if (control.schemaVersion !== CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_SCHEMA) {
    reasons.push("control_schema_invalid");
  }
  if (control.enabled !== true) reasons.push("control_off");
  for (const [key, value] of Object.entries(FIXED_CONTROL_VALUES)) {
    if (control[key] !== value) reasons.push(`control_${key}_invalid`);
  }
  if (!/^[0-9a-f]{64}$/u.test(control.accountIdSha256 || "")
    || control.accountIdSha256 !== expectedAccountIdSha256) {
    reasons.push("control_account_invalid");
  }
  if (!/^[0-9a-f]{40}$/u.test(control.authorizedCommit || "")
    || control.authorizedCommit !== expectedCommit) {
    reasons.push("control_commit_invalid");
  }
  if (!/^[0-9a-f]{40}$/u.test(control.authorizedTree || "")
    || control.authorizedTree !== expectedTree) {
    reasons.push("control_tree_invalid");
  }
  if (!/^[A-Za-z0-9_-]{43}$/u.test(control.oneShotAuthorizationNonce || "")) {
    reasons.push("control_nonce_invalid");
  }
  if (consumed) reasons.push("control_already_consumed");

  const issuedAt = canonicalTimestamp(control.issuedAt);
  const expiresAt = canonicalTimestamp(control.expiresAt);
  const nowMs = now instanceof Date ? now.getTime() : Number.NaN;
  if (issuedAt === null || expiresAt === null || !Number.isFinite(nowMs)) {
    reasons.push("control_time_invalid");
  } else {
    if (issuedAt > nowMs) reasons.push("control_not_yet_valid");
    if (expiresAt <= nowMs) reasons.push("control_expired");
    if (expiresAt <= issuedAt) reasons.push("control_time_order_invalid");
    if (expiresAt - issuedAt > CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_MAX_LIFETIME_MS
      || expiresAt - nowMs > CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_MAX_LIFETIME_MS
      || nowMs - issuedAt > CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_MAX_LIFETIME_MS) {
      reasons.push("control_window_too_long");
    }
  }
  return Object.freeze({
    valid: reasons.length === 0,
    reasons: Object.freeze([...new Set(reasons)])
  });
}

export function createFounderAttendedControl({
  controlPath = CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_PATH,
  now = new Date(),
  repositoryIdentity,
  accountIdSha256 = CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256,
  randomBytesImpl = randomBytes,
  expectedUid = currentUid()
} = {}) {
  if (!Number.isSafeInteger(expectedUid) || expectedUid < 0) {
    throw new Error("founder_attended_current_user_unavailable");
  }
  if (!repositoryIdentity?.clean
    || !/^[0-9a-f]{40}$/u.test(repositoryIdentity.commit || "")
    || !/^[0-9a-f]{40}$/u.test(repositoryIdentity.tree || "")
    || !/^[0-9a-f]{64}$/u.test(accountIdSha256 || "")
    || !(now instanceof Date)
    || !Number.isFinite(now.getTime())) {
    throw new Error("founder_attended_control_context_invalid");
  }
  ensureSecureDirectory(dirname(controlPath), expectedUid);
  if (existsSync(controlPath)) throw new Error("founder_attended_control_exists");

  const nonceBytes = randomBytesImpl(32);
  if (!Buffer.isBuffer(nonceBytes) || nonceBytes.length !== 32) {
    throw new Error("founder_attended_control_randomness_failed");
  }
  const control = Object.freeze({
    schemaVersion: CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_SCHEMA,
    enabled: true,
    ...FIXED_CONTROL_VALUES,
    accountIdSha256,
    authorizedCommit: repositoryIdentity.commit,
    authorizedTree: repositoryIdentity.tree,
    issuedAt: now.toISOString(),
    expiresAt: new Date(
      now.getTime() + CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_MAX_LIFETIME_MS
    ).toISOString(),
    oneShotAuthorizationNonce: nonceBytes.toString("base64url")
  });
  nonceBytes.fill(0);

  const noFollow = constants.O_NOFOLLOW || 0;
  let fd;
  try {
    fd = openSync(
      controlPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow,
      0o600
    );
    writeFileSync(fd, `${JSON.stringify(control, null, 2)}\n`, "utf8");
    fsyncSync(fd);
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error("founder_attended_control_exists");
    throw new Error("founder_attended_control_write_failed");
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  const directoryFd = openSync(dirname(controlPath), constants.O_RDONLY | (constants.O_DIRECTORY || 0));
  try {
    fsyncSync(directoryFd);
  } finally {
    closeSync(directoryFd);
  }
  return Object.freeze({ status: "control_created", expiresAt: control.expiresAt });
}

export function inspectFounderAttendedControl({
  controlPath = CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_PATH,
  now = new Date(),
  expectedCommit,
  expectedTree,
  expectedAccountIdSha256 = CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256,
  expectedUid = currentUid()
} = {}) {
  if (!Number.isSafeInteger(expectedUid) || expectedUid < 0) {
    return Object.freeze({ valid: false, reasons: Object.freeze(["current_user_unavailable"]) });
  }
  let loaded;
  try {
    loaded = readSecureControl(controlPath, expectedUid);
  } catch {
    return Object.freeze({ valid: false, reasons: Object.freeze(["control_missing_or_unreadable"]) });
  }
  if (loaded.reasons.length) {
    return Object.freeze({ valid: false, reasons: Object.freeze(loaded.reasons) });
  }
  const marker = receiptPath(
    controlPath,
    loaded.control?.oneShotAuthorizationNonce || "invalid"
  );
  const validation = validateFounderAttendedControl(loaded.control, {
    now,
    expectedCommit,
    expectedTree,
    expectedAccountIdSha256,
    consumed: existsSync(marker)
  });
  return Object.freeze({
    ...validation,
    control: validation.valid ? Object.freeze({ ...loaded.control }) : null,
    receiptPath: validation.valid ? marker : null
  });
}

export function consumeFounderAttendedControl(options = {}) {
  const expectedUid = options.expectedUid ?? currentUid();
  const inspected = inspectFounderAttendedControl({ ...options, expectedUid });
  if (!inspected.valid) throw new Error("founder_attended_control_denied");
  const consumedDirectory = `${options.controlPath || CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_PATH}.consumed`;
  ensureSecureDirectory(consumedDirectory, expectedUid);
  if (dirname(inspected.receiptPath) !== consumedDirectory) {
    throw new Error("founder_attended_control_consume_failed");
  }
  const noFollow = constants.O_NOFOLLOW || 0;
  let fd;
  try {
    fd = openSync(
      inspected.receiptPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow,
      0o600
    );
    const receipt = {
      schemaVersion: "cloudflare-founder-attended-service-token-consumption-v1",
      nonceSha256: createHash("sha256")
        .update(inspected.control.oneShotAuthorizationNonce, "utf8")
        .digest("hex"),
      directive: inspected.control.directive,
      accountIdSha256: inspected.control.accountIdSha256,
      authorizedCommit: inspected.control.authorizedCommit,
      authorizedTree: inspected.control.authorizedTree,
      consumedAt: (options.now || new Date()).toISOString()
    };
    writeFileSync(fd, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    fsyncSync(fd);
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error("founder_attended_control_denied");
    throw new Error("founder_attended_control_consume_failed");
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  const directoryFd = openSync(consumedDirectory, constants.O_RDONLY | (constants.O_DIRECTORY || 0));
  try {
    fsyncSync(directoryFd);
  } finally {
    closeSync(directoryFd);
  }
  return Object.freeze({ consumed: true });
}
