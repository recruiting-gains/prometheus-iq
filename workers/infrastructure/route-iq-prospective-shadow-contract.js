export const ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING = "ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR";
export const ROUTE_IQ_PROSPECTIVE_SHADOW_CLASS = "RouteIqProspectiveShadowCoordinator";
export const ROUTE_IQ_PROSPECTIVE_SHADOW_PATH = "/api/dashboard/route-iq/prospective/event";
export const ROUTE_IQ_PROSPECTIVE_SHADOW_PATH_PREFIX = "/api/dashboard/route-iq/prospective/";
export const ROUTE_IQ_PROSPECTIVE_HANDOFF_CONTRACT = "route-iq-end-of-day-data-handoff-v1";

export const ROUTE_IQ_PROSPECTIVE_SHADOW_ENV = Object.freeze({
  accessAudience: "ROUTE_IQ_PROSPECTIVE_SHADOW_ACCESS_AUDIENCE",
  accessTeamDomain: "ROUTE_IQ_PROSPECTIVE_SHADOW_ACCESS_TEAM_DOMAIN",
  authorityKey: "ROUTE_IQ_PROSPECTIVE_SHADOW_AUTHORITY_KEY",
  authorityKeyVersion: "ROUTE_IQ_PROSPECTIVE_SHADOW_AUTHORITY_KEY_VERSION",
  cohortConfig: "ROUTE_IQ_PROSPECTIVE_SHADOW_COHORT_CONFIG",
  collection: "ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION",
  principalMap: "ROUTE_IQ_PROSPECTIVE_SHADOW_PRINCIPAL_MAP"
});

export const ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS = Object.freeze({
  browserBodyBytes: 2 * 1024,
  candidateCount: 64,
  domainCommandBytes: 256 * 1024,
  eventsPerDay: 1024,
  opportunitiesPerSession: 128,
  pendingOutbox: 128,
  principals: 64,
  rowsReadPerRpc: 2048,
  rowsWrittenPerRpc: 256,
  sourceArtifactBytes: 4 * 1024 * 1024,
  sourceArtifactTotalBytes: 8 * 1024 * 1024,
  sourceCount: 128,
  sqlStatementsPerRpc: 256,
  storageBytesPerCoordinator: 32 * 1024 * 1024
});

export const ROUTE_IQ_PROSPECTIVE_BROWSER_EVENT_KINDS = Object.freeze([
  "next_stop_requested",
  "representative_action_observed",
  "representative_outcome_observed"
]);

export const ROUTE_IQ_PROSPECTIVE_ALLOCATOR_ACKNOWLEDGMENT = Object.freeze({
  ok: true,
  acknowledged: true,
  status: "accepted",
  collection: "ON",
  recommendationInfluence: "OFF"
});

export const ROUTE_IQ_PROSPECTIVE_ACTION_ACKNOWLEDGMENT = Object.freeze({
  ok: true,
  acknowledged: true,
  status: "accepted",
  collection: "ON",
  recommendationInfluence: "OFF"
});

export const ROUTE_IQ_PROSPECTIVE_GOVERNED_NOOP_ACKNOWLEDGMENT = Object.freeze({
  ok: true,
  acknowledged: true,
  status: "governed_noop",
  collection: "ON",
  recommendationInfluence: "OFF"
});

export class RouteIqProspectiveInfrastructureError extends Error {
  constructor(message, { code = "route_iq_prospective_infrastructure_error", status = 400, details = {} } = {}) {
    super(message);
    this.name = "RouteIqProspectiveInfrastructureError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function failRouteIqProspective(message, code, status = 400, details = {}) {
  throw new RouteIqProspectiveInfrastructureError(message, { code, status, details });
}

export function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function assertExactKeys(value, allowedKeys, path) {
  if (!isPlainObject(value)) {
    failRouteIqProspective(`${path} must be an object.`, "route_iq_prospective_shape_invalid", 400, { path });
  }
  const allowed = new Set(allowedKeys);
  const rejectedPaths = Object.keys(value)
    .filter(key => !allowed.has(key))
    .sort()
    .map(key => `${path}.${key}`);
  if (rejectedPaths.length) {
    failRouteIqProspective(
      `${path} contains caller-authoritative or unsupported fields.`,
      "route_iq_prospective_caller_authority_prohibited",
      400,
      { paths: rejectedPaths }
    );
  }
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function utf8ByteLength(value) {
  return new TextEncoder().encode(typeof value === "string" ? value : stableJson(value)).byteLength;
}

export function requireBoundedString(value, path, { min = 1, max = 256, pattern } = {}) {
  if (typeof value !== "string" || value.length < min || value.length > max || (pattern && !pattern.test(value))) {
    failRouteIqProspective(`${path} is invalid.`, "route_iq_prospective_config_invalid", 403, { path });
  }
  return value;
}

export function requireSha256(value, path) {
  return requireBoundedString(value, path, { min: 64, max: 64, pattern: /^[a-f0-9]{64}$/ });
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(typeof value === "string" ? value : stableJson(value));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function canonicalIsoTimestamp(value, path, { status = 400 } = {}) {
  if (typeof value !== "string" || value.length > 32) {
    failRouteIqProspective(`${path} must be a canonical timestamp.`, "route_iq_prospective_timestamp_invalid", status, { path });
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    failRouteIqProspective(`${path} must be a canonical timestamp.`, "route_iq_prospective_timestamp_invalid", status, { path });
  }
  return value;
}
