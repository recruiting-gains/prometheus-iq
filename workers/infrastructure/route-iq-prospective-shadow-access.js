import { createRemoteJWKSet, jwtVerify } from "jose";

import { supportedFieldSessionWorkspaces } from "../../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";
import {
  ROUTE_IQ_PROSPECTIVE_COHORT_CONFIG_CLOCK_SKEW_SECONDS,
  ROUTE_IQ_PROSPECTIVE_COHORT_CONFIG_MAX_LIFETIME_SECONDS,
  ROUTE_IQ_PROSPECTIVE_MAX_ACTIVE_REPRESENTATIVES,
  ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS,
  ROUTE_IQ_PROSPECTIVE_SHADOW_ENV,
  ROUTE_IQ_PROSPECTIVE_SUPPORTED_OPPORTUNITY_TYPES,
  assertExactKeys,
  canonicalIsoTimestamp,
  failRouteIqProspective,
  requireBoundedString,
  requireSha256,
  sha256Hex,
  utf8ByteLength
} from "./route-iq-prospective-shadow-contract.js";

export const routeIqProspectivePrincipalMapVersion = "route-iq-prospective-access-principal-map-v1";
export const routeIqProspectiveCohortConfigVersion = "route-iq-prospective-cohort-config-v2";

let cachedJwksUrl = null;
let cachedRemoteJwks = null;

function parseBoundedJson(value, path, maxBytes = 64 * 1024) {
  if (typeof value !== "string" || utf8ByteLength(value) > maxBytes) {
    failRouteIqProspective(`${path} is missing or invalid.`, "route_iq_prospective_access_config_invalid", 403, { path });
  }
  try {
    return JSON.parse(value);
  } catch {
    failRouteIqProspective(`${path} is missing or invalid.`, "route_iq_prospective_access_config_invalid", 403, { path });
  }
}

function validateGovernedScope(scope, path, allowedKeys) {
  assertExactKeys(scope, allowedKeys, path);
  const workspaceId = requireBoundedString(scope.workspaceId, `${path}.workspaceId`, {
    max: 64,
    pattern: /^[a-z0-9_]+$/u
  });
  const operatingProfileId = requireBoundedString(scope.operatingProfileId, `${path}.operatingProfileId`, {
    max: 64,
    pattern: /^[a-z0-9_]+$/u
  });
  const representativeId = requireBoundedString(scope.representativeId, `${path}.representativeId`, {
    max: 64,
    pattern: /^[a-z0-9_-]+$/u
  });
  const governedWorkspace = supportedFieldSessionWorkspaces[workspaceId];
  if (!governedWorkspace
    || governedWorkspace.operatingProfileId !== operatingProfileId
    || !governedWorkspace.representativeIds.includes(representativeId)) {
    failRouteIqProspective("Access identity maps outside governed server records.", "route_iq_prospective_access_scope_invalid", 403);
  }
  return { workspaceId, operatingProfileId, representativeId };
}

function validateTerritoryContext(value, path) {
  assertExactKeys(value, [
    "status",
    "territoryId",
    "sourceRecordSha256",
    "sourceContractVersion",
    "availableAt"
  ], path);
  if (value.status !== "known") {
    failRouteIqProspective("Territory context must be canonically known.", "route_iq_prospective_territory_config_invalid", 403, { path });
  }
  const territoryId = requireBoundedString(value.territoryId, `${path}.territoryId`, {
    min: 78,
    max: 78,
    pattern: /^riq_territory_[a-f0-9]{64}$/u
  });
  const sourceRecordSha256 = requireSha256(value.sourceRecordSha256, `${path}.sourceRecordSha256`);
  const sourceContractVersion = requireBoundedString(value.sourceContractVersion, `${path}.sourceContractVersion`, {
    min: 2,
    max: 96,
    pattern: /^[a-z0-9][a-z0-9._-]+$/u
  });
  const availableAt = canonicalIsoTimestamp(value.availableAt, `${path}.availableAt`, { status: 403 });
  return Object.freeze({
    status: "known",
    territoryId,
    sourceRecordSha256,
    sourceContractVersion,
    availableAt
  });
}

function activationNowMs(now) {
  const candidate = now === undefined
    ? new Date()
    : now instanceof Date
      ? now
      : new Date(now);
  if (Number.isNaN(candidate.getTime())) {
    failRouteIqProspective(
      "Cohort configuration verification time is invalid.",
      "route_iq_prospective_cohort_config_invalid",
      403
    );
  }
  return candidate.getTime();
}

function validateOpportunityTypes(value) {
  if (!Array.isArray(value)
    || value.length !== ROUTE_IQ_PROSPECTIVE_SUPPORTED_OPPORTUNITY_TYPES.length
    || value.some((entry, index) => entry !== ROUTE_IQ_PROSPECTIVE_SUPPORTED_OPPORTUNITY_TYPES[index])) {
    failRouteIqProspective(
      "Cohort configuration opportunity types are invalid.",
      "route_iq_prospective_cohort_opportunity_types_invalid",
      403
    );
  }
  return Object.freeze([...value]);
}

export function validateRouteIqProspectiveCohortConfig(value, { now } = {}) {
  const config = parseBoundedJson(value, "cohortConfig", 32 * 1024);
  assertExactKeys(config, [
    "version",
    "state",
    "issuedAt",
    "expiresAt",
    "supportedOpportunityTypes",
    "scopes"
  ], "cohortConfig");
  if (config.version !== routeIqProspectiveCohortConfigVersion
    || config.state !== "ACTIVE"
    || !Array.isArray(config.scopes)
    || config.scopes.length !== ROUTE_IQ_PROSPECTIVE_MAX_ACTIVE_REPRESENTATIVES
    || config.scopes.length > ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS.principals) {
    failRouteIqProspective("Cohort configuration is invalid.", "route_iq_prospective_cohort_config_invalid", 403);
  }
  const issuedAt = canonicalIsoTimestamp(config.issuedAt, "cohortConfig.issuedAt", { status: 403 });
  const expiresAt = canonicalIsoTimestamp(config.expiresAt, "cohortConfig.expiresAt", { status: 403 });
  const issuedAtMs = Date.parse(issuedAt);
  const expiresAtMs = Date.parse(expiresAt);
  const nowMs = activationNowMs(now);
  if (issuedAtMs > nowMs + (ROUTE_IQ_PROSPECTIVE_COHORT_CONFIG_CLOCK_SKEW_SECONDS * 1000)
    || expiresAtMs <= issuedAtMs
    || expiresAtMs - issuedAtMs > ROUTE_IQ_PROSPECTIVE_COHORT_CONFIG_MAX_LIFETIME_SECONDS * 1000) {
    failRouteIqProspective(
      "Cohort configuration validity window is invalid.",
      "route_iq_prospective_cohort_config_invalid",
      403
    );
  }
  if (expiresAtMs <= nowMs) {
    failRouteIqProspective(
      "Cohort configuration is stale.",
      "route_iq_prospective_cohort_config_stale",
      403
    );
  }
  const supportedOpportunityTypes = validateOpportunityTypes(config.supportedOpportunityTypes);
  const unique = new Set();
  const scopes = config.scopes.map((scope, index) => {
    const normalized = validateGovernedScope(scope, `cohortConfig.scopes[${index}]`, [
      "workspaceId",
      "operatingProfileId",
      "representativeId"
    ]);
    const key = `${normalized.workspaceId}\u0000${normalized.operatingProfileId}\u0000${normalized.representativeId}`;
    if (unique.has(key)) {
      failRouteIqProspective("Cohort configuration contains duplicate scope.", "route_iq_prospective_cohort_config_invalid", 403);
    }
    unique.add(key);
    return Object.freeze(normalized);
  });
  return Object.freeze({
    version: config.version,
    state: config.state,
    issuedAt,
    expiresAt,
    supportedOpportunityTypes,
    scopes: Object.freeze(scopes)
  });
}

export function getRouteIqProspectiveActivation(env, { now } = {}) {
  if (env?.[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.collection] !== "ON") {
    return Object.freeze({
      active: false,
      reason: "global_off",
      activeCohortCount: 0,
      cohortConfig: null
    });
  }
  try {
    const cohortConfig = validateRouteIqProspectiveCohortConfig(
      env?.[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.cohortConfig],
      { now }
    );
    return Object.freeze({
      active: true,
      reason: "global_on",
      activeCohortCount: cohortConfig.scopes.length,
      cohortConfig
    });
  } catch (error) {
    return Object.freeze({
      active: false,
      reason: error?.code === "route_iq_prospective_cohort_config_stale"
        ? "cohort_config_stale"
        : "cohort_config_off",
      activeCohortCount: 0,
      cohortConfig: null
    });
  }
}

function normalizeTeamDomain(value) {
  requireBoundedString(value, "accessTeamDomain", { max: 256 });
  let url;
  try {
    url = new URL(value);
  } catch {
    failRouteIqProspective("Cloudflare Access team domain is invalid.", "route_iq_prospective_access_config_invalid", 403);
  }
  if (url.protocol !== "https:"
    || !/^[a-z0-9-]+\.cloudflareaccess\.com$/u.test(url.hostname)
    || (url.pathname !== "/" && url.pathname !== "")
    || url.search
    || url.hash
    || url.username
    || url.password
    || url.port) {
    failRouteIqProspective("Cloudflare Access team domain is invalid.", "route_iq_prospective_access_config_invalid", 403);
  }
  return url.origin;
}

function remoteJwksFor(issuer) {
  const url = `${issuer}/cdn-cgi/access/certs`;
  if (cachedJwksUrl !== url || !cachedRemoteJwks) {
    cachedJwksUrl = url;
    cachedRemoteJwks = createRemoteJWKSet(new URL(url), {
      timeoutDuration: 5000,
      cooldownDuration: 30000
    });
  }
  return cachedRemoteJwks;
}

async function verifyAccessJwt(request, env, noncanonicalTestHooks) {
  const issuer = normalizeTeamDomain(env?.[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.accessTeamDomain]);
  const audience = requireBoundedString(
    env?.[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.accessAudience],
    "accessAudience",
    { max: 256, pattern: /^[A-Za-z0-9._:-]+$/u }
  );
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || token.length > 16 * 1024) {
    failRouteIqProspective("Cloudflare Access authentication is required.", "route_iq_prospective_access_token_missing", 403);
  }

  const useTestHooks = noncanonicalTestHooks?.enabled === true;
  const keyResolver = useTestHooks ? noncanonicalTestHooks.keyResolver : remoteJwksFor(issuer);
  const currentDate = useTestHooks ? noncanonicalTestHooks.currentDate : undefined;
  if (useTestHooks && (!keyResolver || !(currentDate instanceof Date))) {
    failRouteIqProspective("Noncanonical Access test hooks are invalid.", "route_iq_prospective_test_hook_invalid", 500);
  }

  try {
    const { payload } = await jwtVerify(token, keyResolver, {
      issuer,
      audience,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "iat", "exp"],
      clockTolerance: 5,
      ...(currentDate ? { currentDate } : {})
    });
    const nowSeconds = Math.floor((currentDate || new Date()).getTime() / 1000);
    if (typeof payload.sub !== "string"
      || payload.sub.length < 1
      || payload.sub.length > 512
      || !Number.isSafeInteger(payload.iat)
      || !Number.isSafeInteger(payload.exp)
      || payload.iat > nowSeconds + 60
      || payload.exp <= nowSeconds) {
      failRouteIqProspective("Cloudflare Access token claims are invalid.", "route_iq_prospective_access_token_invalid", 403);
    }
    return payload;
  } catch (error) {
    if (error?.code?.startsWith?.("route_iq_prospective_")) throw error;
    failRouteIqProspective("Cloudflare Access authentication failed.", "route_iq_prospective_access_token_invalid", 403);
  }
}

function parsePrincipalMap(value) {
  const config = parseBoundedJson(value, "principalMap");
  assertExactKeys(config, ["version", "principals"], "principalMap");
  if (config.version !== routeIqProspectivePrincipalMapVersion
    || !Array.isArray(config.principals)
    || config.principals.length < 1
    || config.principals.length > ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS.principals) {
    failRouteIqProspective("Principal map is invalid.", "route_iq_prospective_principal_map_invalid", 403);
  }
  const subjects = new Set();
  return config.principals.map((entry, index) => {
    const path = `principalMap.principals[${index}]`;
    const scope = validateGovernedScope(entry, path, [
      "accessSubjectSha256",
      "workspaceId",
      "operatingProfileId",
      "representativeId",
      "registryVersion",
      "territoryContext"
    ]);
    const accessSubjectSha256 = requireSha256(entry.accessSubjectSha256, `${path}.accessSubjectSha256`);
    const registryVersion = requireBoundedString(entry.registryVersion, `${path}.registryVersion`, {
      max: 96,
      pattern: /^[A-Za-z0-9][A-Za-z0-9._-]+$/u
    });
    const territoryContext = validateTerritoryContext(entry.territoryContext, `${path}.territoryContext`);
    if (subjects.has(accessSubjectSha256)) {
      failRouteIqProspective("Principal map contains a duplicate identity.", "route_iq_prospective_principal_map_invalid", 403);
    }
    subjects.add(accessSubjectSha256);
    return Object.freeze({ accessSubjectSha256, registryVersion, territoryContext, ...scope });
  });
}

function scopeInCohort(scope, cohortConfig) {
  return cohortConfig.scopes.some(candidate => candidate.workspaceId === scope.workspaceId
    && candidate.operatingProfileId === scope.operatingProfileId
    && candidate.representativeId === scope.representativeId);
}

async function verifyRouteIqProspectiveAccessContext(request, env, {
  cohortConfig,
  noncanonicalTestHooks
} = {}) {
  const payload = await verifyAccessJwt(request, env, noncanonicalTestHooks);
  const subjectSha256 = await sha256Hex(payload.sub);
  const mapping = parsePrincipalMap(env?.[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.principalMap])
    .find(entry => entry.accessSubjectSha256 === subjectSha256);
  if (!mapping) {
    failRouteIqProspective("Cloudflare Access principal is not mapped.", "route_iq_prospective_principal_unmapped", 403);
  }
  const scope = Object.freeze({
    workspaceId: mapping.workspaceId,
    operatingProfileId: mapping.operatingProfileId,
    representativeId: mapping.representativeId,
    registryVersion: mapping.registryVersion,
    territoryContext: mapping.territoryContext
  });
  if (!cohortConfig || !scopeInCohort(scope, cohortConfig)) {
    failRouteIqProspective("Mapped principal is outside the enabled cohort.", "route_iq_prospective_cohort_scope_blocked", 403);
  }
  return Object.freeze({
    scope,
    accessExpiresAt: new Date(payload.exp * 1000).toISOString()
  });
}

export async function verifyRouteIqProspectiveAccess(request, env, options = {}) {
  return (await verifyRouteIqProspectiveAccessContext(request, env, options)).scope;
}

export async function verifyRouteIqProspectiveBootstrapAccess(request, env, options = {}) {
  return verifyRouteIqProspectiveAccessContext(request, env, options);
}
