import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { createRemoteJWKSet, jwtVerify } from "jose";

export const PUBLIC_CRM_FOUNDER_ACCESS_POLICY = Object.freeze({
  version: "route-iq-public-crm-founder-access-v1",
  batchId: "BATCH-20260719-004",
  owner: "Prometheus Infrastructure",
  contractPath: "workers/infrastructure/route-iq-public-crm-founder-access-v1.json",
  applicationName: "Route IQ Founder CRM",
  applicationDomain: "prometheusrouteiq.com/api/partner-intake/founder/*",
  authenticationUrl: "https://prometheusrouteiq.com/api/partner-intake/founder/requests",
  policyName: "Route IQ Founder CRM - Cruz Only",
  githubRepository: "PrometheusRouteIQ/prometheus-iq",
  githubEnvironment: "prometheus-public-worker-production",
  confirmationPhrase: "MAP CRUZ TO THE EXACT ROUTE IQ FOUNDER CRM ACCESS APPLICATION",
  setupVersion: "route-iq-public-crm-founder-access-setup.v1",
  setupMaximumBytes: 16 * 1024,
  setupMaximumAgeMs: 30 * 60 * 1000,
  tokenMaximumBytes: 16 * 1024,
  commandOutputMaximumBytes: 64 * 1024,
  cloudflaredCommand: "cloudflared",
  ghCommand: "gh",
  settingNames: Object.freeze([
    "ROUTE_IQ_REQUEST_CRM_ACCESS_TEAM_DOMAIN",
    "ROUTE_IQ_REQUEST_CRM_ACCESS_AUDIENCE",
    "ROUTE_IQ_REQUEST_CRM_FOUNDER_SUBJECT_SHA256"
  ])
});

export const PUBLIC_CRM_FOUNDER_ACCESS_FAILURE = Object.freeze({
  CONTRACT_INVALID: "CONTRACT_INVALID",
  SETUP_INVALID: "SETUP_INVALID",
  TTY_REQUIRED: "TTY_REQUIRED",
  AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
  PRINCIPAL_INVALID: "PRINCIPAL_INVALID",
  GITHUB_ENVIRONMENT_INVALID: "GITHUB_ENVIRONMENT_INVALID",
  SETTINGS_ALREADY_PRESENT: "SETTINGS_ALREADY_PRESENT",
  SETTINGS_WRITE_FAILED: "SETTINGS_WRITE_FAILED",
  SETTINGS_VERIFICATION_FAILED: "SETTINGS_VERIFICATION_FAILED"
});

const HEX_32 = /^[0-9a-f]{32}$/u;
const HEX_64 = /^[0-9a-f]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const TEAM_DOMAIN = /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export class PublicCrmFounderAccessError extends Error {
  constructor(code) {
    super(code);
    this.name = "PublicCrmFounderAccessError";
    this.code = code;
  }
}

function fail(code) {
  throw new PublicCrmFounderAccessError(code);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, keys) {
  return isPlainObject(value)
    && Object.keys(value).length === keys.length
    && keys.every(key => Object.hasOwn(value, key));
}

function canonicalDateTime(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.toISOString() !== value ? null : date;
}

function readJson(path, maximumBytes, failureCode) {
  const stats = lstatSync(path);
  if (!stats.isFile()
    || stats.isSymbolicLink()
    || stats.uid !== process.getuid()
    || (stats.mode & 0o777) !== 0o600
    || stats.size < 2
    || stats.size > maximumBytes) {
    fail(failureCode);
  }
  const bytes = readFileSync(path);
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(failureCode);
  } finally {
    bytes.fill(0);
  }
}

export function validatePublicCrmFounderAccessSetup(value, now = new Date()) {
  const keys = [
    "version",
    "applicationName",
    "applicationDomain",
    "policyName",
    "teamDomain",
    "audience",
    "founderEmail",
    "identityProviderId",
    "githubRepository",
    "githubEnvironment",
    "nonce",
    "createdAt",
    "expiresAt"
  ];
  if (!exactKeys(value, keys)) fail(PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.SETUP_INVALID);
  const createdAt = canonicalDateTime(value.createdAt);
  const expiresAt = canonicalDateTime(value.expiresAt);
  const current = now instanceof Date ? now : new Date(now);
  if (value.version !== PUBLIC_CRM_FOUNDER_ACCESS_POLICY.setupVersion
    || value.applicationName !== PUBLIC_CRM_FOUNDER_ACCESS_POLICY.applicationName
    || value.applicationDomain !== PUBLIC_CRM_FOUNDER_ACCESS_POLICY.applicationDomain
    || value.policyName !== PUBLIC_CRM_FOUNDER_ACCESS_POLICY.policyName
    || !TEAM_DOMAIN.test(value.teamDomain || "")
    || !HEX_64.test(value.audience || "")
    || typeof value.founderEmail !== "string"
    || value.founderEmail !== value.founderEmail.toLowerCase()
    || value.founderEmail.length > 320
    || !EMAIL.test(value.founderEmail)
    || !UUID.test(value.identityProviderId || "")
    || value.githubRepository !== PUBLIC_CRM_FOUNDER_ACCESS_POLICY.githubRepository
    || value.githubEnvironment !== PUBLIC_CRM_FOUNDER_ACCESS_POLICY.githubEnvironment
    || !HEX_32.test(value.nonce || "")
    || !createdAt
    || !expiresAt
    || Number.isNaN(current.getTime())
    || createdAt.getTime() > current.getTime()
    || expiresAt.getTime() <= current.getTime()
    || expiresAt.getTime() - createdAt.getTime() > PUBLIC_CRM_FOUNDER_ACCESS_POLICY.setupMaximumAgeMs) {
    fail(PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.SETUP_INVALID);
  }
  return Object.freeze({ ...value });
}

export function readPublicCrmFounderAccessSetup(path, now = new Date()) {
  if (typeof path !== "string" || !path.startsWith("/") || path.length > 4096) {
    fail(PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.SETUP_INVALID);
  }
  return validatePublicCrmFounderAccessSetup(
    readJson(path, PUBLIC_CRM_FOUNDER_ACCESS_POLICY.setupMaximumBytes, PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.SETUP_INVALID),
    now
  );
}

export function verifyPublicCrmFounderAccessContract(root) {
  let contract;
  try {
    contract = JSON.parse(readFileSync(resolve(root, PUBLIC_CRM_FOUNDER_ACCESS_POLICY.contractPath), "utf8"));
  } catch {
    fail(PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.CONTRACT_INVALID);
  }
  if (contract.version !== PUBLIC_CRM_FOUNDER_ACCESS_POLICY.version
    || contract.batchId !== PUBLIC_CRM_FOUNDER_ACCESS_POLICY.batchId
    || contract.owner !== PUBLIC_CRM_FOUNDER_ACCESS_POLICY.owner
    || contract.application?.name !== PUBLIC_CRM_FOUNDER_ACCESS_POLICY.applicationName
    || contract.application?.domain !== PUBLIC_CRM_FOUNDER_ACCESS_POLICY.applicationDomain
    || contract.application?.type !== "self_hosted"
    || contract.policy?.name !== PUBLIC_CRM_FOUNDER_ACCESS_POLICY.policyName
    || contract.policy?.decision !== "allow"
    || contract.policy?.bypassAllowed !== false
    || contract.policy?.everyoneAllowed !== false
    || contract.policy?.displayNameAllowed !== false
    || contract.policy?.serviceTokenAllowed !== false
    || contract.httpBoundary?.publicWebsiteProtected !== false
    || contract.httpBoundary?.publicIntake?.cloudflareAccessRequired !== false
    || contract.httpBoundary?.founderEndpoints?.cloudflareAccessRequired !== true
    || contract.principalCapture?.jwtSignatureVerificationRequired !== true
    || contract.principalCapture?.storedPrincipalValue !== "sha256_of_verified_sub_only"
    || contract.principalCapture?.rawJwtPersisted !== false
    || contract.principalCapture?.rawSubjectPersisted !== false
    || JSON.stringify(contract.workerSettings?.names) !== JSON.stringify(PUBLIC_CRM_FOUNDER_ACCESS_POLICY.settingNames)
    || contract.workerSettings?.appliedWithCandidateDeployment !== true
    || contract.workerSettings?.canModifyLiveVersionWithoutNewVersion !== false) {
    fail(PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.CONTRACT_INVALID);
  }
  return Object.freeze(contract);
}

function compactJwtBuffer(bytes) {
  if (!Buffer.isBuffer(bytes)
    || bytes.length < 32
    || bytes.length > PUBLIC_CRM_FOUNDER_ACCESS_POLICY.tokenMaximumBytes) {
    fail(PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.AUTHENTICATION_FAILED);
  }
  let start = 0;
  let end = bytes.length;
  while (start < end && [0x09, 0x0a, 0x0d, 0x20].includes(bytes[start])) start += 1;
  while (end > start && [0x09, 0x0a, 0x0d, 0x20].includes(bytes[end - 1])) end -= 1;
  const token = Buffer.from(bytes.subarray(start, end));
  let dots = 0;
  for (const byte of token) {
    if (byte === 0x2e) dots += 1;
    else if (!((byte >= 0x30 && byte <= 0x39)
      || (byte >= 0x41 && byte <= 0x5a)
      || (byte >= 0x61 && byte <= 0x7a)
      || byte === 0x2d
      || byte === 0x5f)) {
      token.fill(0);
      fail(PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.AUTHENTICATION_FAILED);
    }
  }
  if (dots !== 2) {
    token.fill(0);
    fail(PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.AUTHENTICATION_FAILED);
  }
  return token;
}

export async function derivePublicCrmFounderSettings({
  token,
  setup,
  keyResolver,
  currentDate
}) {
  const verifiedSetup = validatePublicCrmFounderAccessSetup(setup, currentDate || new Date());
  const tokenBytes = compactJwtBuffer(token);
  try {
    const resolver = keyResolver || createRemoteJWKSet(new URL(`${verifiedSetup.teamDomain}/cdn-cgi/access/certs`), {
      timeoutDuration: 5000,
      cooldownDuration: 30000
    });
    const { payload } = await jwtVerify(tokenBytes, resolver, {
      issuer: verifiedSetup.teamDomain,
      audience: verifiedSetup.audience,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "email", "iat", "exp"],
      clockTolerance: 5,
      ...(currentDate ? { currentDate } : {})
    });
    if (typeof payload.sub !== "string"
      || payload.sub.length < 1
      || payload.sub.length > 512
      || typeof payload.email !== "string"
      || payload.email.toLowerCase() !== verifiedSetup.founderEmail) {
      fail(PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.PRINCIPAL_INVALID);
    }
    return Object.freeze({
      teamDomain: verifiedSetup.teamDomain,
      audience: verifiedSetup.audience,
      subjectSha256: createHash("sha256").update(payload.sub, "utf8").digest("hex")
    });
  } catch (error) {
    if (error instanceof PublicCrmFounderAccessError) throw error;
    fail(PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.PRINCIPAL_INVALID);
  } finally {
    tokenBytes.fill(0);
  }
}

function boundedCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    input: options.input,
    encoding: null,
    stdio: [options.input ? "pipe" : "ignore", "pipe", "pipe"],
    maxBuffer: PUBLIC_CRM_FOUNDER_ACCESS_POLICY.commandOutputMaximumBytes,
    timeout: 120_000,
    env: options.env || {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NO_COLOR: "1"
    }
  });
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.alloc(0);
  const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.alloc(0);
  if (result.status !== 0 || result.error || result.signal) {
    stdout.fill(0);
    stderr.fill(0);
    fail(options.failureCode || PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.AUTHENTICATION_FAILED);
  }
  stderr.fill(0);
  return stdout;
}

export function acquirePublicCrmFounderAccessToken(spawnCommand = boundedCommand) {
  const ephemeralHome = mkdtempSync(join(tmpdir(), "route-iq-public-crm-access-"));
  try {
    chmodSync(ephemeralHome, 0o700);
    return spawnCommand(
      PUBLIC_CRM_FOUNDER_ACCESS_POLICY.cloudflaredCommand,
      ["access", "token", "--app", PUBLIC_CRM_FOUNDER_ACCESS_POLICY.authenticationUrl],
      {
        failureCode: PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.AUTHENTICATION_FAILED,
        env: {
          PATH: process.env.PATH,
          HOME: ephemeralHome,
          XDG_CONFIG_HOME: ephemeralHome,
          NO_COLOR: "1"
        }
      }
    );
  } finally {
    rmSync(ephemeralHome, { recursive: true, force: true });
  }
}

function parseNameOnlyList(bytes) {
  try {
    const value = JSON.parse(bytes.toString("utf8"));
    if (!Array.isArray(value)
      || value.length > 100
      || value.some(entry => !exactKeys(entry, ["name"])
        || typeof entry.name !== "string"
        || !/^[A-Z][A-Z0-9_]{0,127}$/u.test(entry.name))) {
      fail(PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.GITHUB_ENVIRONMENT_INVALID);
    }
    return new Set(value.map(entry => entry.name));
  } catch (error) {
    if (error instanceof PublicCrmFounderAccessError) throw error;
    fail(PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.GITHUB_ENVIRONMENT_INVALID);
  } finally {
    bytes.fill(0);
  }
}

export function listPublicCrmFounderEnvironmentSettings(spawnCommand = boundedCommand) {
  return parseNameOnlyList(spawnCommand(
    PUBLIC_CRM_FOUNDER_ACCESS_POLICY.ghCommand,
    [
      "secret",
      "list",
      "--repo",
      PUBLIC_CRM_FOUNDER_ACCESS_POLICY.githubRepository,
      "--env",
      PUBLIC_CRM_FOUNDER_ACCESS_POLICY.githubEnvironment,
      "--json",
      "name"
    ],
    { failureCode: PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.GITHUB_ENVIRONMENT_INVALID }
  ));
}

export function storePublicCrmFounderEnvironmentSettings(settings, spawnCommand = boundedCommand) {
  if (!settings
    || !TEAM_DOMAIN.test(settings.teamDomain || "")
    || !HEX_64.test(settings.audience || "")
    || !HEX_64.test(settings.subjectSha256 || "")) {
    fail(PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.SETUP_INVALID);
  }
  const before = listPublicCrmFounderEnvironmentSettings(spawnCommand);
  if (PUBLIC_CRM_FOUNDER_ACCESS_POLICY.settingNames.some(name => before.has(name))) {
    fail(PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.SETTINGS_ALREADY_PRESENT);
  }
  const values = [settings.teamDomain, settings.audience, settings.subjectSha256];
  for (let index = 0; index < PUBLIC_CRM_FOUNDER_ACCESS_POLICY.settingNames.length; index += 1) {
    const value = Buffer.from(values[index], "utf8");
    try {
      const output = spawnCommand(
        PUBLIC_CRM_FOUNDER_ACCESS_POLICY.ghCommand,
        [
          "secret",
          "set",
          PUBLIC_CRM_FOUNDER_ACCESS_POLICY.settingNames[index],
          "--repo",
          PUBLIC_CRM_FOUNDER_ACCESS_POLICY.githubRepository,
          "--env",
          PUBLIC_CRM_FOUNDER_ACCESS_POLICY.githubEnvironment
        ],
        { input: value, failureCode: PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.SETTINGS_WRITE_FAILED }
      );
      output.fill(0);
    } finally {
      value.fill(0);
    }
  }
  const after = listPublicCrmFounderEnvironmentSettings(spawnCommand);
  if (!PUBLIC_CRM_FOUNDER_ACCESS_POLICY.settingNames.every(name => after.has(name))) {
    fail(PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.SETTINGS_VERIFICATION_FAILED);
  }
  return Object.freeze({ status: "PUBLIC_CRM_FOUNDER_SETTINGS_CONFIGURED" });
}

export async function configurePublicCrmFounderPrincipal({
  root,
  setupPath,
  confirm,
  spawnCommand = boundedCommand,
  keyResolver,
  currentDate = new Date()
}) {
  verifyPublicCrmFounderAccessContract(root);
  if (typeof confirm !== "function"
    || confirm(
      "configure-public-crm-founder-principal",
      PUBLIC_CRM_FOUNDER_ACCESS_POLICY.confirmationPhrase
    ) !== true) {
    fail(PUBLIC_CRM_FOUNDER_ACCESS_FAILURE.TTY_REQUIRED);
  }
  const setup = readPublicCrmFounderAccessSetup(setupPath, currentDate);
  const token = acquirePublicCrmFounderAccessToken(spawnCommand);
  try {
    const settings = await derivePublicCrmFounderSettings({ token, setup, keyResolver, currentDate });
    const result = storePublicCrmFounderEnvironmentSettings(settings, spawnCommand);
    rmSync(setupPath, { force: false });
    return result;
  } finally {
    token.fill(0);
  }
}
