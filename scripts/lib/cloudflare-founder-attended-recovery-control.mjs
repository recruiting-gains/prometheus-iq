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
  readdirSync,
  writeFileSync
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import {
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_ACCOUNT_ID_SHA256,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONTROL_MAX_LIFETIME_MS,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_DIRECTIVE,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_DURATION,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_NAME
} from "./cloudflare-founder-attended-get-only-recovery-constants.mjs";
import { parseStrictJson } from "./strict-json.mjs";

export const CLOUDFLARE_FOUNDER_ATTENDED_DIAGNOSTIC_SCHEMA =
  "cloudflare-founder-attended-get-only-diagnostic-v1";
export const CLOUDFLARE_FOUNDER_ATTENDED_DIAGNOSTIC_CONSUMPTION_SCHEMA =
  "cloudflare-founder-attended-get-only-diagnostic-consumption-v1";
export const CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONTROL_SCHEMA =
  "cloudflare-founder-attended-successor-recovery-control-v1";
export const CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONSUMPTION_SCHEMA =
  "cloudflare-founder-attended-successor-recovery-consumption-v1";
export const CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_ARTIFACT_MAX_BYTES = 8 * 1024;
export const CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_DIRECTORY = resolve(
  homedir(),
  ".prometheus/infrastructure/cloudflare-founder-attended-get-only-recovery-v1"
);
export const CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONTROL_PATH = join(
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_DIRECTORY,
  "recovery-control.json"
);

const DIAGNOSTIC_KEYS = Object.freeze([
  "schemaVersion",
  "directive",
  "outcome",
  "requestMethod",
  "accountIdSha256",
  "serviceTokenName",
  "authorizedCommit",
  "authorizedTree",
  "observedAt",
  "expiresAt",
  "diagnosticNonce"
]);
const DIAGNOSTIC_CONSUMPTION_KEYS = Object.freeze([
  "schemaVersion",
  "diagnosticNonceSha256",
  "accountIdSha256",
  "authorizedCommit",
  "authorizedTree",
  "consumedAt"
]);
const RECOVERY_CONTROL_KEYS = Object.freeze([
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
  "oneShotAuthorizationNonce",
  "diagnosticNonceSha256"
]);
const RECOVERY_CONSUMPTION_KEYS = Object.freeze([
  "schemaVersion",
  "nonceSha256",
  "directive",
  "accountIdSha256",
  "authorizedCommit",
  "authorizedTree",
  "consumedAt",
  "consumptionClockValid"
]);

function artifactError() {
  return new Error("founder_attended_recovery_artifact_denied");
}

function sameKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
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

function validUid(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function currentFounderAttendedRecoveryUid() {
  return typeof process.getuid === "function" ? process.getuid() : null;
}

function inspectSecureDirectory(path, expectedUid) {
  const info = lstatSync(path);
  if (!info.isDirectory()
    || info.isSymbolicLink()
    || info.uid !== expectedUid
    || (info.mode & 0o777) !== 0o700) {
    throw artifactError();
  }
}

function ensureSecureDirectory(path, expectedUid) {
  if (!validUid(expectedUid)) throw artifactError();
  try {
    mkdirSync(path, { recursive: true, mode: 0o700 });
    inspectSecureDirectory(path, expectedUid);
  } catch {
    throw artifactError();
  }
}

function inspectSecureFile(path, expectedUid) {
  inspectSecureDirectory(dirname(path), expectedUid);
  const info = lstatSync(path);
  if (!info.isFile()
    || info.isSymbolicLink()
    || info.uid !== expectedUid
    || (info.mode & 0o777) !== 0o600
    || info.nlink !== 1
    || info.size < 2
    || info.size > CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_ARTIFACT_MAX_BYTES) {
    throw artifactError();
  }
  return info;
}

function fsyncDirectory(path) {
  const fd = openSync(path, constants.O_RDONLY | (constants.O_DIRECTORY || 0));
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function writeImmutableJson(path, value, expectedUid) {
  ensureSecureDirectory(dirname(path), expectedUid);
  const noFollow = constants.O_NOFOLLOW || 0;
  let fd;
  try {
    fd = openSync(
      path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow,
      0o600
    );
    writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fsyncSync(fd);
  } catch {
    throw artifactError();
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  fsyncDirectory(dirname(path));
}

function readImmutableJson(path, expectedUid) {
  const inspected = inspectSecureFile(path, expectedUid);
  const noFollow = constants.O_NOFOLLOW || 0;
  const fd = openSync(path, constants.O_RDONLY | noFollow);
  try {
    const opened = fstatSync(fd);
    if (!opened.isFile()
      || opened.uid !== expectedUid
      || (opened.mode & 0o777) !== 0o600
      || opened.nlink !== 1
      || opened.dev !== inspected.dev
      || opened.ino !== inspected.ino) {
      throw artifactError();
    }
    const raw = readFileSync(fd);
    try {
      if (!raw.length
        || raw.length > CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_ARTIFACT_MAX_BYTES) {
        throw artifactError();
      }
      return parseStrictJson(raw.toString("utf8"));
    } catch {
      throw artifactError();
    } finally {
      raw.fill(0);
    }
  } finally {
    closeSync(fd);
  }
}

function artifactPaths(root) {
  const artifactRoot = resolve(root);
  return Object.freeze({
    root: artifactRoot,
    diagnostics: join(artifactRoot, "diagnostics"),
    diagnosticConsumptions: join(artifactRoot, "diagnostic-consumptions"),
    control: join(artifactRoot, "recovery-control.json"),
    recoveryConsumptions: join(artifactRoot, "recovery-control-consumptions")
  });
}

function digestText(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function validRepositoryIdentity(identity) {
  return identity
    && identity.clean === true
    && /^[0-9a-f]{40}$/u.test(identity.commit || "")
    && /^[0-9a-f]{40}$/u.test(identity.tree || "");
}

function validAccountDigest(value) {
  return /^[0-9a-f]{64}$/u.test(value || "");
}

function diagnosticShape(value, fileDigest) {
  if (!sameKeys(value, DIAGNOSTIC_KEYS)
    || value.schemaVersion !== CLOUDFLARE_FOUNDER_ATTENDED_DIAGNOSTIC_SCHEMA
    || value.directive !== CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_DIRECTIVE
    || value.outcome !== "EXACT_NAME_ABSENT"
    || value.requestMethod !== "GET"
    || !validAccountDigest(value.accountIdSha256)
    || value.serviceTokenName !== CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_NAME
    || !/^[0-9a-f]{40}$/u.test(value.authorizedCommit || "")
    || !/^[0-9a-f]{40}$/u.test(value.authorizedTree || "")
    || !/^[A-Za-z0-9_-]{43}$/u.test(value.diagnosticNonce || "")
    || digestText(value.diagnosticNonce || "") !== fileDigest) {
    throw artifactError();
  }
  const observedAt = canonicalTimestamp(value.observedAt);
  const expiresAt = canonicalTimestamp(value.expiresAt);
  if (observedAt === null
    || expiresAt === null
    || expiresAt <= observedAt
    || expiresAt - observedAt > CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONTROL_MAX_LIFETIME_MS) {
    throw artifactError();
  }
  return Object.freeze({ value, observedAt, expiresAt, fileDigest });
}

function validateDiagnosticConsumption(value, diagnostic) {
  const consumedAt = canonicalTimestamp(value?.consumedAt);
  if (!sameKeys(value, DIAGNOSTIC_CONSUMPTION_KEYS)
    || value.schemaVersion !== CLOUDFLARE_FOUNDER_ATTENDED_DIAGNOSTIC_CONSUMPTION_SCHEMA
    || value.diagnosticNonceSha256 !== diagnostic.fileDigest
    || value.accountIdSha256 !== diagnostic.value.accountIdSha256
    || value.authorizedCommit !== diagnostic.value.authorizedCommit
    || value.authorizedTree !== diagnostic.value.authorizedTree
    || consumedAt === null) {
    throw artifactError();
  }
  return consumedAt;
}

function loadDiagnosticEvidence(paths, expectedUid) {
  if (!existsSync(paths.diagnostics)) return [];
  inspectSecureDirectory(paths.diagnostics, expectedUid);
  const entries = readdirSync(paths.diagnostics, { withFileTypes: true });
  return entries.map(entry => {
    const match = entry.name.match(/^([0-9a-f]{64})\.json$/u);
    if (!entry.isFile() || entry.isSymbolicLink() || !match) throw artifactError();
    return diagnosticShape(
      readImmutableJson(join(paths.diagnostics, entry.name), expectedUid),
      match[1]
    );
  });
}

function diagnosticConsumed(paths, diagnostic, expectedUid) {
  const path = join(paths.diagnosticConsumptions, `${diagnostic.fileDigest}.json`);
  if (!existsSync(path)) return false;
  validateDiagnosticConsumption(readImmutableJson(path, expectedUid), diagnostic);
  return true;
}

function eligibleDiagnosticEvidence({
  paths,
  now,
  repositoryIdentity,
  accountIdSha256,
  expectedUid
}) {
  const nowMs = now instanceof Date ? now.getTime() : Number.NaN;
  if (!Number.isFinite(nowMs)
    || !validRepositoryIdentity(repositoryIdentity)
    || !validAccountDigest(accountIdSha256)) {
    throw artifactError();
  }
  return loadDiagnosticEvidence(paths, expectedUid).filter(diagnostic => {
    if (diagnostic.observedAt > nowMs) throw artifactError();
    return diagnostic.expiresAt > nowMs
      && diagnostic.value.authorizedCommit === repositoryIdentity.commit
      && diagnostic.value.authorizedTree === repositoryIdentity.tree
      && diagnostic.value.accountIdSha256 === accountIdSha256
      && !diagnosticConsumed(paths, diagnostic, expectedUid);
  });
}

function randomNonce(randomBytesImpl) {
  const bytes = randomBytesImpl(32);
  if (!Buffer.isBuffer(bytes) || bytes.length !== 32) throw artifactError();
  try {
    return bytes.toString("base64url");
  } finally {
    bytes.fill(0);
  }
}

export function createFounderAttendedSuccessfulDiagnosticEvidence({
  artifactRoot = CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_DIRECTORY,
  now = new Date(),
  repositoryIdentity,
  accountIdSha256 = CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_ACCOUNT_ID_SHA256,
  randomBytesImpl = randomBytes,
  expectedUid = currentFounderAttendedRecoveryUid()
} = {}) {
  const paths = artifactPaths(artifactRoot);
  ensureSecureDirectory(paths.root, expectedUid);
  const eligible = eligibleDiagnosticEvidence({
    paths,
    now,
    repositoryIdentity,
    accountIdSha256,
    expectedUid
  });
  if (eligible.length !== 0) throw artifactError();

  const diagnosticNonce = randomNonce(randomBytesImpl);
  const observedAt = now.getTime();
  const receipt = Object.freeze({
    schemaVersion: CLOUDFLARE_FOUNDER_ATTENDED_DIAGNOSTIC_SCHEMA,
    directive: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_DIRECTIVE,
    outcome: "EXACT_NAME_ABSENT",
    requestMethod: "GET",
    accountIdSha256,
    serviceTokenName: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_NAME,
    authorizedCommit: repositoryIdentity.commit,
    authorizedTree: repositoryIdentity.tree,
    observedAt: now.toISOString(),
    expiresAt: new Date(
      observedAt + CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONTROL_MAX_LIFETIME_MS
    ).toISOString(),
    diagnosticNonce
  });
  const path = join(paths.diagnostics, `${digestText(diagnosticNonce)}.json`);
  writeImmutableJson(path, receipt, expectedUid);
  return Object.freeze({ created: true });
}

function validateRecoveryControlShape(control) {
  if (!sameKeys(control, RECOVERY_CONTROL_KEYS)
    || control.schemaVersion !== CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONTROL_SCHEMA
    || control.enabled !== true
    || control.directive !== CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_DIRECTIVE
    || !validAccountDigest(control.accountIdSha256)
    || control.serviceTokenName !== CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_NAME
    || control.duration !== CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_DURATION
    || !/^[0-9a-f]{40}$/u.test(control.authorizedCommit || "")
    || !/^[0-9a-f]{40}$/u.test(control.authorizedTree || "")
    || !/^[A-Za-z0-9_-]{43}$/u.test(control.oneShotAuthorizationNonce || "")
    || !/^[0-9a-f]{64}$/u.test(control.diagnosticNonceSha256 || "")) {
    throw artifactError();
  }
  const issuedAt = canonicalTimestamp(control.issuedAt);
  const expiresAt = canonicalTimestamp(control.expiresAt);
  if (issuedAt === null
    || expiresAt === null
    || expiresAt <= issuedAt
    || expiresAt - issuedAt > CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONTROL_MAX_LIFETIME_MS) {
    throw artifactError();
  }
  return Object.freeze({ control, issuedAt, expiresAt });
}

function validateRecoveryControlLineage(paths, shaped, expectedUid) {
  const { control } = shaped;
  const diagnostic = diagnosticShape(
    readImmutableJson(
      join(paths.diagnostics, `${control.diagnosticNonceSha256}.json`),
      expectedUid
    ),
    control.diagnosticNonceSha256
  );
  const consumedAt = validateDiagnosticConsumption(
    readImmutableJson(
      join(paths.diagnosticConsumptions, `${control.diagnosticNonceSha256}.json`),
      expectedUid
    ),
    diagnostic
  );
  if (diagnostic.value.accountIdSha256 !== control.accountIdSha256
    || diagnostic.value.authorizedCommit !== control.authorizedCommit
    || diagnostic.value.authorizedTree !== control.authorizedTree
    || diagnostic.observedAt > shaped.issuedAt
    || diagnostic.expiresAt < shaped.expiresAt
    || consumedAt !== shaped.issuedAt) {
    throw artifactError();
  }
}

export function prepareFounderAttendedSuccessorRecoveryControl({
  artifactRoot = CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_DIRECTORY,
  now = new Date(),
  repositoryIdentity,
  accountIdSha256 = CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_ACCOUNT_ID_SHA256,
  randomBytesImpl = randomBytes,
  expectedUid = currentFounderAttendedRecoveryUid()
} = {}) {
  const paths = artifactPaths(artifactRoot);
  ensureSecureDirectory(paths.root, expectedUid);
  if (existsSync(paths.control)) throw artifactError();
  const eligible = eligibleDiagnosticEvidence({
    paths,
    now,
    repositoryIdentity,
    accountIdSha256,
    expectedUid
  });
  if (eligible.length !== 1) throw artifactError();
  const [diagnostic] = eligible;
  const oneShotAuthorizationNonce = randomNonce(randomBytesImpl);
  if (oneShotAuthorizationNonce === diagnostic.value.diagnosticNonce) throw artifactError();

  const diagnosticConsumption = Object.freeze({
    schemaVersion: CLOUDFLARE_FOUNDER_ATTENDED_DIAGNOSTIC_CONSUMPTION_SCHEMA,
    diagnosticNonceSha256: diagnostic.fileDigest,
    accountIdSha256,
    authorizedCommit: repositoryIdentity.commit,
    authorizedTree: repositoryIdentity.tree,
    consumedAt: now.toISOString()
  });
  writeImmutableJson(
    join(paths.diagnosticConsumptions, `${diagnostic.fileDigest}.json`),
    diagnosticConsumption,
    expectedUid
  );

  const expiresAt = Math.min(
    now.getTime() + CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONTROL_MAX_LIFETIME_MS,
    diagnostic.expiresAt
  );
  const control = Object.freeze({
    schemaVersion: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONTROL_SCHEMA,
    enabled: true,
    directive: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_DIRECTIVE,
    accountIdSha256,
    serviceTokenName: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_NAME,
    duration: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_DURATION,
    authorizedCommit: repositoryIdentity.commit,
    authorizedTree: repositoryIdentity.tree,
    issuedAt: now.toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    oneShotAuthorizationNonce,
    diagnosticNonceSha256: diagnostic.fileDigest
  });
  writeImmutableJson(paths.control, control, expectedUid);
  return Object.freeze({ prepared: true });
}

export function validateFounderAttendedSuccessorRecoveryControl(control, {
  now = new Date(),
  expectedCommit,
  expectedTree,
  expectedAccountIdSha256 = CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_ACCOUNT_ID_SHA256,
  consumed = false
} = {}) {
  const reasons = [];
  let shaped;
  try {
    shaped = validateRecoveryControlShape(control);
  } catch {
    return Object.freeze({ valid: false, reasons: Object.freeze(["recovery_control_invalid"]) });
  }
  const nowMs = now instanceof Date ? now.getTime() : Number.NaN;
  if (!Number.isFinite(nowMs)) reasons.push("recovery_control_clock_invalid");
  else {
    if (shaped.issuedAt > nowMs) reasons.push("recovery_control_not_yet_valid");
    if (shaped.expiresAt <= nowMs) reasons.push("recovery_control_expired");
    if (nowMs - shaped.issuedAt > CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONTROL_MAX_LIFETIME_MS
      || shaped.expiresAt - nowMs > CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONTROL_MAX_LIFETIME_MS) {
      reasons.push("recovery_control_window_invalid");
    }
  }
  if (control.authorizedCommit !== expectedCommit) reasons.push("recovery_control_commit_invalid");
  if (control.authorizedTree !== expectedTree) reasons.push("recovery_control_tree_invalid");
  if (control.accountIdSha256 !== expectedAccountIdSha256) {
    reasons.push("recovery_control_account_invalid");
  }
  if (consumed) reasons.push("recovery_control_consumed");
  return Object.freeze({
    valid: reasons.length === 0,
    reasons: Object.freeze(reasons)
  });
}

function recoveryConsumptionPath(paths, control) {
  return join(
    paths.recoveryConsumptions,
    `${digestText(control.oneShotAuthorizationNonce)}.json`
  );
}

export function inspectFounderAttendedSuccessorRecoveryControl({
  artifactRoot = CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_DIRECTORY,
  now = new Date(),
  expectedCommit,
  expectedTree,
  expectedAccountIdSha256 = CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_ACCOUNT_ID_SHA256,
  expectedUid = currentFounderAttendedRecoveryUid()
} = {}) {
  const paths = artifactPaths(artifactRoot);
  try {
    const control = readImmutableJson(paths.control, expectedUid);
    const shaped = validateRecoveryControlShape(control);
    validateRecoveryControlLineage(paths, shaped, expectedUid);
    const validation = validateFounderAttendedSuccessorRecoveryControl(control, {
      now,
      expectedCommit,
      expectedTree,
      expectedAccountIdSha256,
      consumed: existsSync(recoveryConsumptionPath(paths, control))
    });
    return Object.freeze({
      ...validation,
      control: validation.valid ? Object.freeze({ ...control }) : null
    });
  } catch {
    return Object.freeze({ valid: false, reasons: Object.freeze(["recovery_control_unavailable"]), control: null });
  }
}

export function consumeFounderAttendedSuccessorRecoveryControl({
  artifactRoot = CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_DIRECTORY,
  now = new Date(),
  expectedCommit,
  expectedTree,
  expectedAccountIdSha256 = CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_ACCOUNT_ID_SHA256,
  expectedUid = currentFounderAttendedRecoveryUid()
} = {}) {
  const paths = artifactPaths(artifactRoot);
  const control = readImmutableJson(paths.control, expectedUid);
  const shaped = validateRecoveryControlShape(control);
  validateRecoveryControlLineage(paths, shaped, expectedUid);
  const consumedAt = now instanceof Date && Number.isFinite(now.getTime())
    ? now.toISOString()
    : null;
  const receipt = Object.freeze({
    schemaVersion: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONSUMPTION_SCHEMA,
    nonceSha256: digestText(control.oneShotAuthorizationNonce),
    directive: control.directive,
    accountIdSha256: control.accountIdSha256,
    authorizedCommit: control.authorizedCommit,
    authorizedTree: control.authorizedTree,
    consumedAt,
    consumptionClockValid: consumedAt !== null
  });
  writeImmutableJson(recoveryConsumptionPath(paths, control), receipt, expectedUid);
  const validation = validateFounderAttendedSuccessorRecoveryControl(control, {
    now,
    expectedCommit,
    expectedTree,
    expectedAccountIdSha256,
    consumed: false
  });
  if (!validation.valid) throw artifactError();
  return Object.freeze({ consumed: true, control: Object.freeze({ ...control }) });
}
