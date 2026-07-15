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
export const CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIAGNOSTIC_SCHEMA =
  "cloudflare-founder-attended-response-contract-diagnostic-v1";
export const CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONTROL_SCHEMA =
  "cloudflare-founder-attended-response-contract-successor-control-v1";
export const CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONSUMPTION_SCHEMA =
  "cloudflare-founder-attended-response-contract-consumption-v1";

const MAX_ARTIFACT_BYTES = 8 * 1024;
const DIAGNOSTIC_KEYS = Object.freeze([
  "schemaVersion", "directive", "outcome", "accountIdSha256", "serviceTokenName",
  "authorizedCommit", "authorizedTree", "observedAt", "expiresAt", "diagnosticNonce"
]);
const CONTROL_KEYS = Object.freeze([
  "schemaVersion", "enabled", "directive", "accountIdSha256", "serviceTokenName", "duration",
  "authorizedCommit", "authorizedTree", "issuedAt", "expiresAt", "oneShotAuthorizationNonce",
  "diagnosticNonceSha256"
]);

function artifactError() {
  return new Error("founder_attended_response_contract_artifact_denied");
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
  } catch {
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
    if (opened.dev !== before.dev || opened.ino !== before.ino) throw artifactError();
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

function paths(root) {
  const base = resolve(root);
  return Object.freeze({
    root: base,
    diagnostics: join(base, "diagnostics"),
    diagnosticConsumptions: join(base, "diagnostic-consumptions"),
    control: join(base, "successor-control.json"),
    controlConsumptions: join(base, "successor-control-consumptions"),
    phases: join(base, "phase-evidence")
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

function shapeDiagnostic(value) {
  if (!sameKeys(value, DIAGNOSTIC_KEYS)
    || value.schemaVersion !== CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIAGNOSTIC_SCHEMA
    || value.directive !== CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTIVE
    || value.outcome !== "EXACT_NAME_ABSENT"
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

function shapeControl(value) {
  if (!sameKeys(value, CONTROL_KEYS)
    || value.schemaVersion !== CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONTROL_SCHEMA
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

function validateControlNow(shaped, now, repositoryIdentity) {
  const current = now instanceof Date ? now.getTime() : Number.NaN;
  if (!Number.isFinite(current) || !validIdentity(repositoryIdentity)
    || shaped.issuedAt > current || shaped.expiresAt <= current
    || shaped.value.authorizedCommit !== repositoryIdentity.commit
    || shaped.value.authorizedTree !== repositoryIdentity.tree) throw artifactError();
}

export function createFounderAttendedResponseContractAbsenceEvidence({
  artifactRoot = CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTORY,
  now = new Date(),
  repositoryIdentity,
  accountIdSha256,
  randomBytesImpl = randomBytes,
  expectedUid = currentFounderAttendedResponseContractUid()
} = {}) {
  if (!validIdentity(repositoryIdentity)
    || !/^[0-9a-f]{64}$/u.test(accountIdSha256 || "")
    || !(now instanceof Date) || !Number.isFinite(now.getTime())) throw artifactError();
  const artifactPaths = paths(artifactRoot);
  ensureDirectory(artifactPaths.root, expectedUid);
  ensureDirectory(artifactPaths.diagnostics, expectedUid);
  if (readdirSync(artifactPaths.diagnostics).length !== 0) throw artifactError();
  const diagnosticNonce = freshNonce(randomBytesImpl);
  const evidence = Object.freeze({
    schemaVersion: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIAGNOSTIC_SCHEMA,
    directive: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTIVE,
    outcome: "EXACT_NAME_ABSENT",
    accountIdSha256,
    serviceTokenName: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_NAME,
    authorizedCommit: repositoryIdentity.commit,
    authorizedTree: repositoryIdentity.tree,
    observedAt: now.toISOString(),
    expiresAt: new Date(
      now.getTime() + CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONTROL_MAX_LIFETIME_MS
    ).toISOString(),
    diagnosticNonce
  });
  writeExclusiveJson(join(artifactPaths.diagnostics, `${digest(diagnosticNonce)}.json`), evidence, expectedUid);
  return Object.freeze({ created: true });
}

export function prepareFounderAttendedResponseContractSuccessorControl({
  artifactRoot = CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTORY,
  now = new Date(),
  repositoryIdentity,
  randomBytesImpl = randomBytes,
  expectedUid = currentFounderAttendedResponseContractUid()
} = {}) {
  const artifactPaths = paths(artifactRoot);
  if (existsSync(artifactPaths.control)) throw artifactError();
  inspectDirectory(artifactPaths.diagnostics, expectedUid);
  const entries = readdirSync(artifactPaths.diagnostics);
  if (entries.length !== 1 || !/^[0-9a-f]{64}\.json$/u.test(entries[0])) throw artifactError();
  const diagnostic = shapeDiagnostic(readSecureJson(join(artifactPaths.diagnostics, entries[0]), expectedUid));
  if (entries[0] !== `${diagnostic.nonceSha256}.json`
    || existsSync(join(artifactPaths.diagnosticConsumptions, entries[0]))) throw artifactError();
  validateControlNow({
    value: diagnostic.value,
    issuedAt: diagnostic.observedAt,
    expiresAt: diagnostic.expiresAt
  }, now, repositoryIdentity);

  const controlNonce = freshNonce(randomBytesImpl);
  if (controlNonce === diagnostic.value.diagnosticNonce) throw artifactError();
  writeExclusiveJson(join(artifactPaths.diagnosticConsumptions, entries[0]), Object.freeze({
    diagnosticNonceSha256: diagnostic.nonceSha256,
    consumedAt: now.toISOString()
  }), expectedUid);
  const expiresAt = Math.min(
    diagnostic.expiresAt,
    now.getTime() + CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONTROL_MAX_LIFETIME_MS
  );
  writeExclusiveJson(artifactPaths.control, Object.freeze({
    schemaVersion: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONTROL_SCHEMA,
    enabled: true,
    directive: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTIVE,
    accountIdSha256: diagnostic.value.accountIdSha256,
    serviceTokenName: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_NAME,
    duration: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_DURATION,
    authorizedCommit: repositoryIdentity.commit,
    authorizedTree: repositoryIdentity.tree,
    issuedAt: now.toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    oneShotAuthorizationNonce: controlNonce,
    diagnosticNonceSha256: diagnostic.nonceSha256
  }), expectedUid);
  return Object.freeze({ prepared: true });
}

export function consumeFounderAttendedResponseContractSuccessorControl({
  artifactRoot = CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTORY,
  now = new Date(),
  repositoryIdentity,
  expectedUid = currentFounderAttendedResponseContractUid()
} = {}) {
  const artifactPaths = paths(artifactRoot);
  const shaped = shapeControl(readSecureJson(artifactPaths.control, expectedUid));
  const diagnosticPath = join(artifactPaths.diagnostics, `${shaped.value.diagnosticNonceSha256}.json`);
  const diagnostic = shapeDiagnostic(readSecureJson(diagnosticPath, expectedUid));
  const diagnosticConsumption = readSecureJson(
    join(artifactPaths.diagnosticConsumptions, `${diagnostic.nonceSha256}.json`),
    expectedUid
  );
  const diagnosticConsumedAt = timestamp(diagnosticConsumption?.consumedAt);
  if (diagnostic.nonceSha256 !== shaped.value.diagnosticNonceSha256
    || !sameKeys(diagnosticConsumption, ["diagnosticNonceSha256", "consumedAt"])
    || diagnosticConsumption.diagnosticNonceSha256 !== diagnostic.nonceSha256
    || diagnosticConsumedAt === null
    || diagnosticConsumedAt !== shaped.issuedAt
    || diagnostic.value.authorizedCommit !== shaped.value.authorizedCommit
    || diagnostic.value.authorizedTree !== shaped.value.authorizedTree
    || diagnostic.expiresAt < shaped.expiresAt) throw artifactError();

  const nonceSha256 = digest(shaped.value.oneShotAuthorizationNonce);
  writeExclusiveJson(join(artifactPaths.controlConsumptions, `${nonceSha256}.json`), Object.freeze({
    schemaVersion: CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONSUMPTION_SCHEMA,
    nonceSha256,
    consumedAt: now instanceof Date && Number.isFinite(now.getTime()) ? now.toISOString() : null
  }), expectedUid);
  validateControlNow(shaped, now, repositoryIdentity);
  return Object.freeze({ consumed: true, control: Object.freeze({ ...shaped.value }) });
}

export function appendFounderAttendedResponseContractPhase({
  artifactRoot = CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DIRECTORY,
  control,
  phase,
  expectedUid = currentFounderAttendedResponseContractUid()
} = {}) {
  shapeControl(control);
  if (!CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_PHASES.includes(phase)) throw artifactError();
  const directory = join(paths(artifactRoot).phases, digest(control.oneShotAuthorizationNonce));
  ensureDirectory(directory, expectedUid);
  const entries = readdirSync(directory);
  if (entries.some(entry => !/^\d{4}\.phase$/u.test(entry))) throw artifactError();
  const sequence = entries.length + 1;
  if (sequence > 9999) throw artifactError();
  writeExclusive(join(directory, `${String(sequence).padStart(4, "0")}.phase`), `${phase}\n`, expectedUid);
}

export function readFounderAttendedResponseContractPhasesTestOnly({
  artifactRoot,
  control,
  expectedUid = currentFounderAttendedResponseContractUid()
}) {
  const directory = join(paths(artifactRoot).phases, digest(control.oneShotAuthorizationNonce));
  inspectDirectory(directory, expectedUid);
  return Object.freeze(readdirSync(directory).sort().map(entry => {
    if (!/^\d{4}\.phase$/u.test(entry)) throw artifactError();
    const value = readFileSync(join(directory, entry), "utf8").trim();
    if (!CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_PHASES.includes(value)) throw artifactError();
    return value;
  }));
}
