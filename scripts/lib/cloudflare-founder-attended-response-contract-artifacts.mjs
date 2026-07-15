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
import { basename, dirname, join, resolve } from "node:path";

import {
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONTROL_MAX_LIFETIME_MS,
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTIVE,
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_PHASES,
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_DURATION,
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_NAME
} from "./cloudflare-founder-attended-response-contract-constants.mjs";
import { parseStrictJson } from "./strict-json.mjs";

export const CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTORY = resolve(
  homedir(),
  ".prometheus/infrastructure/cloudflare-founder-attended-response-contract-repair-v1"
);
export const CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_ATTEMPT_SCHEMA =
  "cloudflare-founder-attended-response-contract-attempt-v1";
export const CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIAGNOSTIC_SCHEMA =
  "cloudflare-founder-attended-response-contract-diagnostic-v2";
export const CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIAGNOSTIC_CONSUMPTION_SCHEMA =
  "cloudflare-founder-attended-response-contract-diagnostic-consumption-v1";
export const CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONTROL_SCHEMA =
  "cloudflare-founder-attended-response-contract-successor-control-v2";
export const CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONSUMPTION_SCHEMA =
  "cloudflare-founder-attended-response-contract-consumption-v2";
export const CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_PHASE_LINEAGE_SCHEMA =
  "cloudflare-founder-attended-response-contract-phase-lineage-v1";
export const CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_LOCAL_ARTIFACT_COLLISION =
  "LOCAL_ARTIFACT_COLLISION";

const MAX_ARTIFACT_BYTES = 8 * 1024;
const ATTEMPT_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const ATTEMPT_KEYS = Object.freeze([
  "schemaVersion", "directive", "attemptId", "createdAt"
]);
const DIAGNOSTIC_KEYS = Object.freeze([
  "schemaVersion", "attemptId", "directive", "outcome", "accountIdSha256", "serviceTokenName",
  "authorizedCommit", "authorizedTree", "observedAt", "expiresAt", "diagnosticNonce"
]);
const DIAGNOSTIC_CONSUMPTION_KEYS = Object.freeze([
  "schemaVersion", "attemptId", "diagnosticNonceSha256", "consumedAt"
]);
const CONTROL_KEYS = Object.freeze([
  "schemaVersion", "attemptId", "enabled", "directive", "accountIdSha256", "serviceTokenName",
  "duration", "authorizedCommit", "authorizedTree", "issuedAt", "expiresAt",
  "oneShotAuthorizationNonce", "diagnosticNonceSha256"
]);
const CONTROL_CONSUMPTION_KEYS = Object.freeze([
  "schemaVersion", "attemptId", "nonceSha256", "consumedAt"
]);
const PHASE_LINEAGE_KEYS = Object.freeze([
  "schemaVersion", "attemptId", "nonceSha256"
]);

function artifactError(code = "founder_attended_response_contract_artifact_denied") {
  return new Error(code);
}

export function classifyFounderAttendedResponseContractArtifactError(error) {
  return error?.message === CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_LOCAL_ARTIFACT_COLLISION
    ? CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_LOCAL_ARTIFACT_COLLISION
    : "ARTIFACT_DENIED";
}

function digest(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sameKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function timestamp(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

function validIdentity(identity) {
  return identity?.clean === true
    && /^[0-9a-f]{40}$/u.test(identity.commit || "")
    && /^[0-9a-f]{40}$/u.test(identity.tree || "");
}

function validUid(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function currentFounderAttendedResponseContractUid() {
  return typeof process.getuid === "function" ? process.getuid() : null;
}

function inspectDirectory(path, expectedUid) {
  const info = lstatSync(path);
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== expectedUid
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

function createExclusiveDirectory(path, expectedUid) {
  try {
    mkdirSync(path, { mode: 0o700 });
    inspectDirectory(path, expectedUid);
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw artifactError(CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_LOCAL_ARTIFACT_COLLISION);
    }
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

function writeExclusive(path, value, expectedUid) {
  ensureDirectory(dirname(path), expectedUid);
  let fd;
  try {
    fd = openSync(
      path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW || 0),
      0o600
    );
    writeFileSync(fd, value, "utf8");
    fsyncSync(fd);
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw artifactError(CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_LOCAL_ARTIFACT_COLLISION);
    }
    throw artifactError();
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  fsyncDirectory(dirname(path));
}

function writeExclusiveJson(path, value, expectedUid) {
  writeExclusive(path, `${JSON.stringify(value, null, 2)}\n`, expectedUid);
}

function readSecureJson(path, expectedUid) {
  inspectDirectory(dirname(path), expectedUid);
  const before = lstatSync(path);
  if (!before.isFile() || before.isSymbolicLink() || before.uid !== expectedUid
    || (before.mode & 0o777) !== 0o600 || before.nlink !== 1
    || before.size < 2 || before.size > MAX_ARTIFACT_BYTES) throw artifactError();
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const opened = fstatSync(fd);
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.nlink !== 1) {
      throw artifactError();
    }
    const bytes = readFileSync(fd);
    try {
      return parseStrictJson(bytes.toString("utf8"));
    } finally {
      bytes.fill(0);
    }
  } catch {
    throw artifactError();
  } finally {
    closeSync(fd);
  }
}

function basePaths(root) {
  const base = resolve(root);
  return Object.freeze({
    root: base,
    attempts: join(base, "attempts")
  });
}

function attemptPaths(root, attemptId) {
  if (!ATTEMPT_ID_PATTERN.test(attemptId || "")) throw artifactError();
  const base = basePaths(root);
  const attemptRoot = join(base.attempts, attemptId);
  return Object.freeze({
    baseRoot: base.root,
    attemptsRoot: base.attempts,
    attemptRoot,
    lineage: join(attemptRoot, "attempt-lineage.json"),
    diagnostic: join(attemptRoot, "diagnostic-receipt.json"),
    diagnosticConsumption: join(attemptRoot, "diagnostic-consumption.json"),
    control: join(attemptRoot, "successor-control.json"),
    controlConsumption: join(attemptRoot, "successor-control-consumption.json"),
    phases: join(attemptRoot, "phase-evidence")
  });
}

function freshNonce(randomBytesImpl) {
  const bytes = randomBytesImpl(32);
  if (!Buffer.isBuffer(bytes) || bytes.length !== 32) throw artifactError();
  try {
    return bytes.toString("base64url");
  } finally {
    bytes.fill(0);
  }
}

function createAttemptIdentity({
  artifactRoot,
  now,
  randomBytesImpl,
  expectedUid
}) {
  const base = basePaths(artifactRoot);
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw artifactError();
  ensureDirectory(base.root, expectedUid);
  ensureDirectory(base.attempts, expectedUid);
  const attemptId = freshNonce(randomBytesImpl);
  const paths = attemptPaths(artifactRoot, attemptId);
  createExclusiveDirectory(paths.attemptRoot, expectedUid);
  writeExclusiveJson(paths.lineage, Object.freeze({
    schemaVersion: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_ATTEMPT_SCHEMA,
    directive: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTIVE,
    attemptId,
    createdAt: now.toISOString()
  }), expectedUid);
  return Object.freeze({ attemptId, paths });
}

function shapeLineage(value, attemptId) {
  if (!sameKeys(value, ATTEMPT_KEYS)
    || value.schemaVersion !== CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_ATTEMPT_SCHEMA
    || value.directive !== CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTIVE
    || value.attemptId !== attemptId
    || !ATTEMPT_ID_PATTERN.test(value.attemptId || "")) throw artifactError();
  const createdAt = timestamp(value.createdAt);
  if (createdAt === null) throw artifactError();
  return Object.freeze({ value, createdAt });
}

function shapeDiagnostic(value, attemptId) {
  if (!sameKeys(value, DIAGNOSTIC_KEYS)
    || value.schemaVersion !== CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIAGNOSTIC_SCHEMA
    || value.attemptId !== attemptId
    || value.directive !== CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTIVE
    || !["EXACT_NAME_ABSENT", "EXACT_NAME_PRESENT"].includes(value.outcome)
    || !/^[0-9a-f]{64}$/u.test(value.accountIdSha256 || "")
    || value.serviceTokenName !== CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_NAME
    || !/^[0-9a-f]{40}$/u.test(value.authorizedCommit || "")
    || !/^[0-9a-f]{40}$/u.test(value.authorizedTree || "")
    || !/^[A-Za-z0-9_-]{43}$/u.test(value.diagnosticNonce || "")) throw artifactError();
  const observedAt = timestamp(value.observedAt);
  const expiresAt = timestamp(value.expiresAt);
  if (observedAt === null || expiresAt === null || expiresAt <= observedAt
    || expiresAt - observedAt > CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONTROL_MAX_LIFETIME_MS) {
    throw artifactError();
  }
  return Object.freeze({ value, observedAt, expiresAt, nonceSha256: digest(value.diagnosticNonce) });
}

function shapeDiagnosticConsumption(value, attemptId) {
  if (!sameKeys(value, DIAGNOSTIC_CONSUMPTION_KEYS)
    || value.schemaVersion !== CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIAGNOSTIC_CONSUMPTION_SCHEMA
    || value.attemptId !== attemptId
    || !/^[0-9a-f]{64}$/u.test(value.diagnosticNonceSha256 || "")) throw artifactError();
  const consumedAt = timestamp(value.consumedAt);
  if (consumedAt === null) throw artifactError();
  return Object.freeze({ value, consumedAt });
}

function shapeControl(value, attemptId = value?.attemptId) {
  if (!sameKeys(value, CONTROL_KEYS)
    || value.schemaVersion !== CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONTROL_SCHEMA
    || value.attemptId !== attemptId
    || value.enabled !== true
    || value.directive !== CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTIVE
    || !/^[0-9a-f]{64}$/u.test(value.accountIdSha256 || "")
    || value.serviceTokenName !== CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_NAME
    || value.duration !== CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_DURATION
    || !/^[0-9a-f]{40}$/u.test(value.authorizedCommit || "")
    || !/^[0-9a-f]{40}$/u.test(value.authorizedTree || "")
    || !/^[A-Za-z0-9_-]{43}$/u.test(value.oneShotAuthorizationNonce || "")
    || !/^[0-9a-f]{64}$/u.test(value.diagnosticNonceSha256 || "")) throw artifactError();
  const issuedAt = timestamp(value.issuedAt);
  const expiresAt = timestamp(value.expiresAt);
  if (issuedAt === null || expiresAt === null || expiresAt <= issuedAt
    || expiresAt - issuedAt > CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONTROL_MAX_LIFETIME_MS) {
    throw artifactError();
  }
  return Object.freeze({ value, issuedAt, expiresAt });
}

function shapeControlConsumption(value, attemptId) {
  if (!sameKeys(value, CONTROL_CONSUMPTION_KEYS)
    || value.schemaVersion !== CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONSUMPTION_SCHEMA
    || value.attemptId !== attemptId
    || !/^[0-9a-f]{64}$/u.test(value.nonceSha256 || "")) throw artifactError();
  const consumedAt = timestamp(value.consumedAt);
  if (consumedAt === null) throw artifactError();
  return Object.freeze({ value, consumedAt });
}

function validateControlNow(shaped, now, repositoryIdentity) {
  const current = now instanceof Date ? now.getTime() : Number.NaN;
  if (!Number.isFinite(current) || !validIdentity(repositoryIdentity)
    || shaped.issuedAt > current || shaped.expiresAt <= current
    || shaped.value.authorizedCommit !== repositoryIdentity.commit
    || shaped.value.authorizedTree !== repositoryIdentity.tree) throw artifactError();
}

function listAttemptRecords(artifactRoot, expectedUid) {
  const base = basePaths(artifactRoot);
  if (!existsSync(base.attempts)) return [];
  inspectDirectory(base.root, expectedUid);
  inspectDirectory(base.attempts, expectedUid);
  return readdirSync(base.attempts, { withFileTypes: true }).map(entry => {
    if (!entry.isDirectory() || entry.isSymbolicLink() || !ATTEMPT_ID_PATTERN.test(entry.name)) {
      throw artifactError();
    }
    const paths = attemptPaths(artifactRoot, entry.name);
    inspectDirectory(paths.attemptRoot, expectedUid);
    const lineage = shapeLineage(readSecureJson(paths.lineage, expectedUid), entry.name);
    const diagnostic = existsSync(paths.diagnostic)
      ? shapeDiagnostic(readSecureJson(paths.diagnostic, expectedUid), entry.name)
      : null;
    const diagnosticConsumption = existsSync(paths.diagnosticConsumption)
      ? shapeDiagnosticConsumption(readSecureJson(paths.diagnosticConsumption, expectedUid), entry.name)
      : null;
    const control = existsSync(paths.control)
      ? shapeControl(readSecureJson(paths.control, expectedUid), entry.name)
      : null;
    const controlConsumption = existsSync(paths.controlConsumption)
      ? shapeControlConsumption(readSecureJson(paths.controlConsumption, expectedUid), entry.name)
      : null;

    if (diagnostic) {
      if (diagnostic.observedAt < lineage.createdAt) throw artifactError();
      if (diagnosticConsumption) {
        if (diagnosticConsumption.value.diagnosticNonceSha256 !== diagnostic.nonceSha256
          || diagnosticConsumption.consumedAt < diagnostic.observedAt) {
          throw artifactError();
        }
      }
      if (control) {
        if (control.value.diagnosticNonceSha256 !== diagnostic.nonceSha256
          || diagnostic.value.outcome !== "EXACT_NAME_ABSENT"
          || control.value.accountIdSha256 !== diagnostic.value.accountIdSha256
          || control.value.authorizedCommit !== diagnostic.value.authorizedCommit
          || control.value.authorizedTree !== diagnostic.value.authorizedTree
          || !diagnosticConsumption
          || diagnosticConsumption.consumedAt !== control.issuedAt
          || diagnostic.expiresAt < control.expiresAt) {
          throw artifactError();
        }
      }
    }
    if (controlConsumption) {
      if (!control
        || controlConsumption.value.nonceSha256 !== digest(control.value.oneShotAuthorizationNonce)
        || controlConsumption.consumedAt < control.issuedAt) {
        throw artifactError();
      }
    }
    return Object.freeze({
      attemptId: entry.name,
      paths,
      lineage,
      diagnostic,
      diagnosticConsumption,
      control,
      controlConsumption
    });
  });
}

function selectLatestAttempt(records, selectTime) {
  const candidates = records
    .map(record => Object.freeze({ record, time: selectTime(record) }))
    .filter(candidate => Number.isFinite(candidate.time));
  if (candidates.length === 0) throw artifactError();
  candidates.sort((left, right) => right.time - left.time);
  if (candidates.length > 1 && candidates[0].time === candidates[1].time) throw artifactError();
  return candidates[0].record;
}

function phaseLineagePath(directory) {
  return join(directory, "phase-lineage.json");
}

function ensurePhaseLineage(directory, control, expectedUid) {
  ensureDirectory(directory, expectedUid);
  const lineagePath = phaseLineagePath(directory);
  if (!existsSync(lineagePath)) {
    writeExclusiveJson(lineagePath, Object.freeze({
      schemaVersion: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_PHASE_LINEAGE_SCHEMA,
      attemptId: control.attemptId,
      nonceSha256: digest(control.oneShotAuthorizationNonce)
    }), expectedUid);
  }
  const lineage = readSecureJson(lineagePath, expectedUid);
  if (!sameKeys(lineage, PHASE_LINEAGE_KEYS)
    || lineage.schemaVersion !== CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_PHASE_LINEAGE_SCHEMA
    || lineage.attemptId !== control.attemptId
    || lineage.nonceSha256 !== digest(control.oneShotAuthorizationNonce)) {
    throw artifactError();
  }
}

export function createFounderAttendedResponseContractAbsenceEvidence({
  artifactRoot = CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTORY,
  now = new Date(),
  repositoryIdentity,
  accountIdSha256,
  outcome = "EXACT_NAME_ABSENT",
  randomBytesImpl = randomBytes,
  expectedUid = currentFounderAttendedResponseContractUid()
} = {}) {
  if (!validIdentity(repositoryIdentity)
    || !/^[0-9a-f]{64}$/u.test(accountIdSha256 || "")
    || !["EXACT_NAME_ABSENT", "EXACT_NAME_PRESENT"].includes(outcome)
    || !(now instanceof Date) || !Number.isFinite(now.getTime())) throw artifactError();
  const attempt = createAttemptIdentity({
    artifactRoot,
    now,
    randomBytesImpl,
    expectedUid
  });
  const diagnosticNonce = freshNonce(randomBytesImpl);
  writeExclusiveJson(attempt.paths.diagnostic, Object.freeze({
    schemaVersion: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIAGNOSTIC_SCHEMA,
    attemptId: attempt.attemptId,
    directive: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTIVE,
    outcome,
    accountIdSha256,
    serviceTokenName: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_NAME,
    authorizedCommit: repositoryIdentity.commit,
    authorizedTree: repositoryIdentity.tree,
    observedAt: now.toISOString(),
    expiresAt: new Date(
      now.getTime() + CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONTROL_MAX_LIFETIME_MS
    ).toISOString(),
    diagnosticNonce
  }), expectedUid);
  return Object.freeze({
    created: true,
    attemptId: attempt.attemptId,
    attemptRoot: attempt.paths.attemptRoot
  });
}

export function prepareFounderAttendedResponseContractSuccessorControl({
  artifactRoot = CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTORY,
  now = new Date(),
  repositoryIdentity,
  randomBytesImpl = randomBytes,
  expectedUid = currentFounderAttendedResponseContractUid()
} = {}) {
  if (!validIdentity(repositoryIdentity)
    || !(now instanceof Date) || !Number.isFinite(now.getTime())) throw artifactError();
  const selected = selectLatestAttempt(
    listAttemptRecords(artifactRoot, expectedUid).filter(record => {
      if (!record.diagnostic || record.diagnosticConsumption || record.control || record.controlConsumption) {
        return false;
      }
      return record.diagnostic.value.outcome === "EXACT_NAME_ABSENT"
        && record.diagnostic.expiresAt > now.getTime()
        && record.diagnostic.value.authorizedCommit === repositoryIdentity.commit
        && record.diagnostic.value.authorizedTree === repositoryIdentity.tree;
    }),
    record => record.diagnostic?.observedAt ?? Number.NaN
  );
  const controlNonce = freshNonce(randomBytesImpl);
  if (controlNonce === selected.diagnostic.value.diagnosticNonce) throw artifactError();
  writeExclusiveJson(selected.paths.diagnosticConsumption, Object.freeze({
    schemaVersion: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIAGNOSTIC_CONSUMPTION_SCHEMA,
    attemptId: selected.attemptId,
    diagnosticNonceSha256: selected.diagnostic.nonceSha256,
    consumedAt: now.toISOString()
  }), expectedUid);
  const expiresAt = Math.min(
    selected.diagnostic.expiresAt,
    now.getTime() + CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONTROL_MAX_LIFETIME_MS
  );
  writeExclusiveJson(selected.paths.control, Object.freeze({
    schemaVersion: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONTROL_SCHEMA,
    attemptId: selected.attemptId,
    enabled: true,
    directive: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTIVE,
    accountIdSha256: selected.diagnostic.value.accountIdSha256,
    serviceTokenName: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_NAME,
    duration: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_DURATION,
    authorizedCommit: repositoryIdentity.commit,
    authorizedTree: repositoryIdentity.tree,
    issuedAt: now.toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    oneShotAuthorizationNonce: controlNonce,
    diagnosticNonceSha256: selected.diagnostic.nonceSha256
  }), expectedUid);
  return Object.freeze({
    prepared: true,
    attemptId: selected.attemptId,
    attemptRoot: selected.paths.attemptRoot
  });
}

export function consumeFounderAttendedResponseContractSuccessorControl({
  artifactRoot = CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTORY,
  now = new Date(),
  repositoryIdentity,
  expectedUid = currentFounderAttendedResponseContractUid()
} = {}) {
  if (!validIdentity(repositoryIdentity)) throw artifactError();
  const selected = selectLatestAttempt(
    listAttemptRecords(artifactRoot, expectedUid).filter(record => (
      record.control
      && !record.controlConsumption
      && record.diagnostic
      && record.diagnosticConsumption
      && record.diagnostic.value.outcome === "EXACT_NAME_ABSENT"
    )),
    record => record.control?.issuedAt ?? Number.NaN
  );
  validateControlNow(selected.control, now, repositoryIdentity);
  writeExclusiveJson(selected.paths.controlConsumption, Object.freeze({
    schemaVersion: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONSUMPTION_SCHEMA,
    attemptId: selected.attemptId,
    nonceSha256: digest(selected.control.value.oneShotAuthorizationNonce),
    consumedAt: now instanceof Date && Number.isFinite(now.getTime()) ? now.toISOString() : null
  }), expectedUid);
  return Object.freeze({
    consumed: true,
    control: Object.freeze({ ...selected.control.value }),
    attemptId: selected.attemptId,
    attemptRoot: selected.paths.attemptRoot
  });
}

export function appendFounderAttendedResponseContractPhase({
  artifactRoot = CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTORY,
  control,
  phase,
  expectedUid = currentFounderAttendedResponseContractUid()
} = {}) {
  const shaped = shapeControl(control);
  if (!CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_PHASES.includes(phase)) throw artifactError();
  const attemptRoot = resolve(artifactRoot);
  if (basename(attemptRoot) !== shaped.value.attemptId
    || basename(dirname(attemptRoot)) !== "attempts") {
    throw artifactError();
  }
  const paths = attemptPaths(dirname(dirname(attemptRoot)), shaped.value.attemptId);
  if (attemptRoot !== paths.attemptRoot) throw artifactError();
  const lineage = shapeLineage(readSecureJson(paths.lineage, expectedUid), shaped.value.attemptId);
  if (lineage.value.attemptId !== shaped.value.attemptId) throw artifactError();
  const directory = join(paths.phases, digest(shaped.value.oneShotAuthorizationNonce));
  ensurePhaseLineage(directory, shaped.value, expectedUid);
  const entries = readdirSync(directory).filter(entry => entry !== "phase-lineage.json");
  if (entries.some(entry => !/^\d{4}\.phase$/u.test(entry))) throw artifactError();
  const sequence = entries.length + 1;
  if (sequence > 9999) throw artifactError();
  writeExclusive(
    join(directory, `${String(sequence).padStart(4, "0")}.phase`),
    `${phase}\n`,
    expectedUid
  );
}

export function readFounderAttendedResponseContractPhasesTestOnly({
  artifactRoot,
  control,
  expectedUid = currentFounderAttendedResponseContractUid()
}) {
  const shaped = shapeControl(control);
  const attemptRoot = resolve(artifactRoot);
  if (basename(attemptRoot) !== shaped.value.attemptId
    || basename(dirname(attemptRoot)) !== "attempts") {
    throw artifactError();
  }
  const paths = attemptPaths(dirname(dirname(attemptRoot)), shaped.value.attemptId);
  if (attemptRoot !== paths.attemptRoot) throw artifactError();
  const directory = join(paths.phases, digest(shaped.value.oneShotAuthorizationNonce));
  ensurePhaseLineage(directory, shaped.value, expectedUid);
  return Object.freeze(
    readdirSync(directory)
      .filter(entry => entry !== "phase-lineage.json")
      .sort()
      .map(entry => {
        if (!/^\d{4}\.phase$/u.test(entry)) throw artifactError();
        const value = readFileSync(join(directory, entry), "utf8").trim();
        if (!CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_PHASES.includes(value)) {
          throw artifactError();
        }
        return value;
      })
  );
}

export function readFounderAttendedResponseContractAttemptStateTestOnly({
  artifactRoot,
  expectedUid = currentFounderAttendedResponseContractUid()
}) {
  return Object.freeze(listAttemptRecords(artifactRoot, expectedUid).map(record => Object.freeze({
    attemptId: record.attemptId,
    attemptRoot: record.paths.attemptRoot,
    outcome: record.diagnostic?.value.outcome ?? null,
    diagnosticConsumed: record.diagnosticConsumption !== null,
    controlPresent: record.control !== null,
    controlConsumed: record.controlConsumption !== null
  })));
}
