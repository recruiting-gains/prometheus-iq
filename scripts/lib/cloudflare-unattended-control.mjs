import { createHash } from "node:crypto";
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

export const cloudflareUnattendedControlSchemaVersion =
  "cloudflare-unattended-deployment-control-v1";
export const CLOUDFLARE_UNATTENDED_CONTROL_MAX_BYTES = 8 * 1024;
export const CLOUDFLARE_UNATTENDED_CONTROL_MAX_LIFETIME_MS = 30 * 60 * 1000;
export const CLOUDFLARE_UNATTENDED_CONTROL_PATH = resolve(
  homedir(),
  ".prometheus/overwatch/cloudflare-unattended-deployment-control-v1.json"
);

const CONTROL_KEYS = Object.freeze([
  "schemaVersion",
  "enabled",
  "targetWorker",
  "environment",
  "authorizedCommit",
  "authorizedTree",
  "founderDirectiveId",
  "issuedAt",
  "expiresAt",
  "oneShotAuthorizationNonce"
]);

function sameKeys(value, expected) {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  return actual.length === required.length
    && actual.every((key, index) => key === required[index]);
}

function canonicalTime(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
    ? parsed
    : null;
}

export function defaultCloudflareUnattendedControl() {
  return Object.freeze({
    schemaVersion: cloudflareUnattendedControlSchemaVersion,
    enabled: false,
    targetWorker: "prometheus-iq",
    environment: "production_private",
    authorizedCommit: "",
    authorizedTree: "",
    founderDirectiveId: "",
    issuedAt: "",
    expiresAt: "",
    oneShotAuthorizationNonce: ""
  });
}

export function validateFounderControl(control, {
  now = new Date(),
  consumedNonces = new Set(),
  expectedCommit,
  expectedTree,
  expectedDirectiveId
} = {}) {
  const reasons = [];
  if (!control || typeof control !== "object" || Array.isArray(control)) {
    return Object.freeze({ valid: false, reasons: Object.freeze(["control_missing_or_invalid"]) });
  }
  if (!sameKeys(control, CONTROL_KEYS)) reasons.push("control_shape_invalid");
  for (const field of CONTROL_KEYS) {
    if (!Object.hasOwn(control, field)) reasons.push(`missing_${field}`);
  }
  if (control.schemaVersion !== cloudflareUnattendedControlSchemaVersion) reasons.push("invalid_schema");
  if (control.enabled !== true) reasons.push("control_off");
  if (control.targetWorker !== "prometheus-iq") reasons.push("wrong_target");
  if (control.environment !== "production_private") reasons.push("wrong_environment");
  if (!/^[0-9a-f]{40}$/u.test(control.authorizedCommit || "")) reasons.push("invalid_commit");
  if (!/^[0-9a-f]{40}$/u.test(control.authorizedTree || "")) reasons.push("invalid_tree");
  if (expectedCommit && control.authorizedCommit !== expectedCommit) reasons.push("commit_mismatch");
  if (expectedTree && control.authorizedTree !== expectedTree) reasons.push("tree_mismatch");
  if (!/^FOUNDER-[A-Z0-9][A-Z0-9._:-]{5,127}$/u.test(control.founderDirectiveId || "")) {
    reasons.push("invalid_founder_directive");
  }
  if (expectedDirectiveId && control.founderDirectiveId !== expectedDirectiveId) {
    reasons.push("directive_mismatch");
  }
  if (!/^[A-Za-z0-9_-]{24,128}$/u.test(control.oneShotAuthorizationNonce || "")) {
    reasons.push("invalid_nonce");
  }
  if (consumedNonces.has(control.oneShotAuthorizationNonce)) reasons.push("nonce_already_consumed");

  const issuedAt = canonicalTime(control.issuedAt);
  const expiresAt = canonicalTime(control.expiresAt);
  const nowMs = now instanceof Date ? now.getTime() : Number.NaN;
  if (issuedAt === null || expiresAt === null || !Number.isFinite(nowMs)) {
    reasons.push("invalid_time");
  } else {
    if (issuedAt > nowMs) reasons.push("not_yet_valid");
    if (expiresAt <= nowMs) reasons.push("expired");
    if (expiresAt <= issuedAt) reasons.push("invalid_time_order");
    if (expiresAt - issuedAt > CLOUDFLARE_UNATTENDED_CONTROL_MAX_LIFETIME_MS) {
      reasons.push("authorization_window_too_long");
    }
    if (expiresAt - nowMs > CLOUDFLARE_UNATTENDED_CONTROL_MAX_LIFETIME_MS) {
      reasons.push("expiration_too_far_in_future");
    }
    if (nowMs - issuedAt > CLOUDFLARE_UNATTENDED_CONTROL_MAX_LIFETIME_MS) {
      reasons.push("issued_too_long_ago");
    }
  }
  return Object.freeze({
    valid: reasons.length === 0,
    reasons: Object.freeze([...new Set(reasons)])
  });
}

function consumedMarkerPath(controlPath, nonce) {
  const digest = createHash("sha256").update(nonce, "utf8").digest("hex");
  return join(`${controlPath}.consumed`, `${digest}.json`);
}

function inspectSecureFile(path, expectedUid) {
  const parent = lstatSync(dirname(path));
  const reasons = [];
  if (!parent.isDirectory() || parent.isSymbolicLink()) reasons.push("control_parent_invalid");
  if (parent.uid !== expectedUid) reasons.push("control_parent_wrong_owner");
  if ((parent.mode & 0o777) !== 0o700) reasons.push("control_parent_wrong_mode");
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink()) reasons.push("control_not_regular_file");
  if (info.uid !== expectedUid) reasons.push("control_wrong_owner");
  if ((info.mode & 0o777) !== 0o600) reasons.push("control_wrong_mode");
  if (info.nlink !== 1) reasons.push("control_link_count_invalid");
  if (info.size < 2 || info.size > CLOUDFLARE_UNATTENDED_CONTROL_MAX_BYTES) {
    reasons.push("control_size_invalid");
  }
  return { info, reasons };
}

function readSecureControlFile(path, expectedUid) {
  const inspected = inspectSecureFile(path, expectedUid);
  if (inspected.reasons.length) {
    return { control: null, reasons: inspected.reasons };
  }
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
    const raw = readFileSync(fd, "utf8");
    if (Buffer.byteLength(raw, "utf8") > CLOUDFLARE_UNATTENDED_CONTROL_MAX_BYTES) {
      return { control: null, reasons: ["control_size_invalid"] };
    }
    try {
      const keyMatches = [...raw.matchAll(/"((?:\\.|[^"\\])+)"\s*:/gu)];
      const decodedKeys = keyMatches.map(match => JSON.parse(`"${match[1]}"`));
      if (decodedKeys.length !== CONTROL_KEYS.length
        || new Set(decodedKeys).size !== CONTROL_KEYS.length) {
        return { control: null, reasons: ["control_duplicate_or_nested_key"] };
      }
      return { control: JSON.parse(raw), reasons: [] };
    } catch {
      return { control: null, reasons: ["control_json_invalid"] };
    }
  } finally {
    closeSync(fd);
  }
}

export function inspectFounderControlFile({
  controlPath = CLOUDFLARE_UNATTENDED_CONTROL_PATH,
  now = new Date(),
  expectedCommit,
  expectedTree,
  expectedDirectiveId,
  expectedUid = typeof process.getuid === "function" ? process.getuid() : null
} = {}) {
  if (!Number.isSafeInteger(expectedUid) || expectedUid < 0) {
    return Object.freeze({ valid: false, reasons: Object.freeze(["current_user_unavailable"]) });
  }
  let loaded;
  try {
    loaded = readSecureControlFile(controlPath, expectedUid);
  } catch {
    return Object.freeze({ valid: false, reasons: Object.freeze(["control_missing_or_unreadable"]) });
  }
  if (loaded.reasons.length) {
    return Object.freeze({ valid: false, reasons: Object.freeze(loaded.reasons) });
  }
  const markerPath = consumedMarkerPath(controlPath, loaded.control?.oneShotAuthorizationNonce || "invalid");
  const validation = validateFounderControl(loaded.control, {
    now,
    expectedCommit,
    expectedTree,
    expectedDirectiveId,
    consumedNonces: existsSync(markerPath)
      ? new Set([loaded.control?.oneShotAuthorizationNonce])
      : new Set()
  });
  return Object.freeze({
    ...validation,
    control: validation.valid ? Object.freeze({ ...loaded.control }) : null,
    markerPath: validation.valid ? markerPath : null
  });
}

function ensureConsumedDirectory(controlPath, expectedUid) {
  const directory = `${controlPath}.consumed`;
  try {
    mkdirSync(directory, { mode: 0o700 });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  const info = lstatSync(directory);
  if (!info.isDirectory()
    || info.isSymbolicLink()
    || info.uid !== expectedUid
    || (info.mode & 0o777) !== 0o700) {
    throw new Error("control_consumed_directory_invalid");
  }
  if (dirname(directory) !== dirname(controlPath)) {
    throw new Error("control_consumed_directory_invalid");
  }
  return directory;
}

export function consumeFounderControlFile(options = {}) {
  const expectedUid = options.expectedUid
    ?? (typeof process.getuid === "function" ? process.getuid() : null);
  const inspected = inspectFounderControlFile({ ...options, expectedUid });
  if (!inspected.valid) {
    throw new Error(`founder_control_denied:${inspected.reasons.join(",")}`);
  }
  ensureConsumedDirectory(options.controlPath || CLOUDFLARE_UNATTENDED_CONTROL_PATH, expectedUid);
  const noFollow = constants.O_NOFOLLOW || 0;
  let fd;
  let markerCreated = false;
  try {
    fd = openSync(
      inspected.markerPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow,
      0o600
    );
    markerCreated = true;
    const marker = {
      schemaVersion: "cloudflare-unattended-deployment-control-consumption-v1",
      nonceSha256: createHash("sha256")
        .update(inspected.control.oneShotAuthorizationNonce, "utf8")
        .digest("hex"),
      authorizedCommit: inspected.control.authorizedCommit,
      authorizedTree: inspected.control.authorizedTree,
      founderDirectiveId: inspected.control.founderDirectiveId,
      consumedAt: (options.now || new Date()).toISOString()
    };
    writeFileSync(fd, `${JSON.stringify(marker, null, 2)}\n`, "utf8");
    fsyncSync(fd);
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error("founder_control_denied:nonce_already_consumed");
    throw error;
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (markerCreated) {
      const directoryFd = openSync(
        dirname(inspected.markerPath),
        constants.O_RDONLY | (constants.O_DIRECTORY || 0) | noFollow
      );
      try {
        fsyncSync(directoryFd);
      } finally {
        closeSync(directoryFd);
      }
    }
  }
  return Object.freeze({
    control: inspected.control,
    markerPath: inspected.markerPath,
    consumed: true
  });
}
