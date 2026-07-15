import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

import {
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_REASON_CODES
} from "./cloudflare-founder-attended-create-receipt-v2-constants.mjs";

export const CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_DIRECTORY = resolve(
  homedir(),
  ".prometheus/infrastructure/cloudflare-founder-attended-create-receipt-v2"
);
export const CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_LINEAGE_SCHEMA =
  "cloudflare-founder-attended-create-receipt-v2-lineage-v1";

const ATTEMPT_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const LINEAGE_KEYS = Object.freeze([
  "schemaVersion", "attemptId"
]);

function artifactError() {
  return new Error("founder_attended_create_receipt_v2_artifact_denied");
}

function validUid(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function currentFounderAttendedCreateReceiptV2Uid() {
  return typeof process.getuid === "function" ? process.getuid() : null;
}

function inspectDirectory(path, expectedUid) {
  const info = lstatSync(path);
  if (!info.isDirectory()
    || info.isSymbolicLink()
    || info.uid !== expectedUid
    || (info.mode & 0o777) !== 0o700) throw artifactError();
}

function ensureDirectory(path, expectedUid) {
  if (!validUid(expectedUid)) throw artifactError();
  try {
    mkdirSync(path, { recursive: true, mode: 0o700 });
    inspectDirectory(path, expectedUid);
  } catch {
    throw artifactError();
  }
}

function fsyncDirectory(path) {
  const fd = openSync(path, constants.O_RDONLY | (constants.O_DIRECTORY || 0));
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function evidenceDirectory(artifactRoot) {
  return join(resolve(artifactRoot), "create-receipt-classifications");
}

function lineagePath(artifactRoot) {
  return join(evidenceDirectory(artifactRoot), "attempt-lineage.json");
}

function ensureLineage(artifactRoot, attemptId, expectedUid) {
  if (!ATTEMPT_ID_PATTERN.test(attemptId || "")) throw artifactError();
  const attemptRoot = resolve(artifactRoot);
  if (basename(attemptRoot) !== attemptId) throw artifactError();
  const directory = evidenceDirectory(attemptRoot);
  ensureDirectory(directory, expectedUid);
  const path = lineagePath(attemptRoot);
  if (!lstatSync(dirname(path)).isDirectory()) throw artifactError();
  if (!Object.hasOwn(constants, "O_RDONLY")) {
    throw artifactError();
  }
  if (!exists(path)) {
    let fd;
    try {
      fd = openSync(
        path,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW || 0),
        0o600
      );
      writeFileSync(
        fd,
        `${JSON.stringify({
          schemaVersion: CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_LINEAGE_SCHEMA,
          attemptId
        }, null, 2)}\n`,
        "utf8"
      );
      fsyncSync(fd);
    } catch {
      throw artifactError();
    } finally {
      if (fd !== undefined) closeSync(fd);
    }
    fsyncDirectory(dirname(path));
  }
  const before = lstatSync(path);
  if (!before.isFile()
    || before.isSymbolicLink()
    || before.uid !== expectedUid
    || (before.mode & 0o777) !== 0o600
    || before.nlink !== 1) throw artifactError();
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const opened = fstatSync(fd);
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.nlink !== 1) {
      throw artifactError();
    }
    const value = JSON.parse(readFileSync(fd, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw artifactError();
    const keys = Object.keys(value).sort();
    const expected = [...LINEAGE_KEYS].sort();
    if (keys.length !== expected.length
      || !keys.every((key, index) => key === expected[index])
      || value.schemaVersion !== CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_LINEAGE_SCHEMA
      || value.attemptId !== attemptId) {
      throw artifactError();
    }
  } catch {
    throw artifactError();
  } finally {
    closeSync(fd);
  }
}

function exists(path) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

export function appendFounderAttendedCreateReceiptV2Reason({
  artifactRoot = CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_DIRECTORY,
  attemptId,
  reasonCode,
  expectedUid = currentFounderAttendedCreateReceiptV2Uid()
} = {}) {
  if (!CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_REASON_CODES.includes(reasonCode)) {
    throw artifactError();
  }
  ensureLineage(artifactRoot, attemptId, expectedUid);
  const directory = evidenceDirectory(artifactRoot);
  const entries = readdirSync(directory).filter(entry => entry !== "attempt-lineage.json");
  if (entries.some(entry => !/^\d{4}\.reason$/u.test(entry))) throw artifactError();
  const sequence = entries.length + 1;
  if (sequence > 9999) throw artifactError();
  const path = join(directory, `${String(sequence).padStart(4, "0")}.reason`);
  let fd;
  try {
    fd = openSync(
      path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW || 0),
      0o600
    );
    writeFileSync(fd, `${reasonCode}\n`, "utf8");
    fsyncSync(fd);
  } catch {
    throw artifactError();
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  fsyncDirectory(dirname(path));
  return Object.freeze({ appended: true });
}

export function readFounderAttendedCreateReceiptV2ReasonsTestOnly({
  artifactRoot,
  attemptId,
  expectedUid = currentFounderAttendedCreateReceiptV2Uid()
} = {}) {
  ensureLineage(artifactRoot, attemptId, expectedUid);
  const directory = evidenceDirectory(artifactRoot);
  return Object.freeze(readdirSync(directory).filter(entry => entry !== "attempt-lineage.json").sort().map(entry => {
    if (!/^\d{4}\.reason$/u.test(entry)) throw artifactError();
    const path = join(directory, entry);
    const before = lstatSync(path);
    if (!before.isFile()
      || before.isSymbolicLink()
      || before.uid !== expectedUid
      || (before.mode & 0o777) !== 0o600
      || before.nlink !== 1) throw artifactError();
    const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      const opened = fstatSync(fd);
      if (opened.dev !== before.dev || opened.ino !== before.ino) throw artifactError();
      const reasonCode = readFileSync(fd, "utf8").trim();
      if (!CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_REASON_CODES.includes(reasonCode)) {
        throw artifactError();
      }
      return reasonCode;
    } finally {
      closeSync(fd);
    }
  }));
}
