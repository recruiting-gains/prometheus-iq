import { createRemoteJWKSet, jwtVerify } from "jose";

import workspaceConfigurationRegistry from "../../administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json" with { type: "json" };
import {
  validateRouteIqWorkspaceConfigurationRegistry
} from "../../administration/contracts/route-iq-workspace-configuration-v2-validation.mjs";
import launchEnvelope from "../../data/route-iq-commercial-readiness-v1/route-iq-august-1-launch-envelope-v1.json" with { type: "json" };
import commercialWorkspaceRegistry from "../../data/route-iq-commercial-readiness-v1/route-iq-commercial-workspace-registry-v1.json" with { type: "json" };
import businessManifestRegistry from "../../data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json" with { type: "json" };
import fitnessConnectionBusinessHours from "../../data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json" with { type: "json" };
import {
  assertRouteIqAugust1LaunchResourceAccess,
  authorizeRouteIqAugust1LaunchPrincipal,
  routeIqAugust1LaunchMaximumCompanies,
  routeIqAugust1LaunchMaximumNamedUsers,
  validateRouteIqAugust1LaunchEnvelope
} from "../../data/route-iq-commercial-readiness-v1/route-iq-august-1-launch-envelope.mjs";
import { AEGIS_API_HEADERS } from "./aegis-security-controls.js";
import {
  ROUTE_IQ_MULTI_COMPANY_FAILURES,
  RouteIqMultiCompanyRuntimeAuthorizationError,
  projectRouteIqWorkspaceZipCoverage,
  requestedRouteIqWorkspaceId
} from "./route-iq-multi-company-runtime-authorization.js";

export const ROUTE_IQ_CUSTOMER_PWA_PATH = "/app";
export const ROUTE_IQ_CUSTOMER_PWA_TRAILING_SLASH_PATH = "/app/";
export const ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH = "/api/dashboard/route-iq/customer/session";
export const ROUTE_IQ_CUSTOMER_PWA_SESSION_MARKER = "__ROUTE_IQ_CUSTOMER_PWA_SESSION__";
export const ROUTE_IQ_CUSTOMER_PWA_SESSION_TEMPLATE_ID = "routeIqCustomerPwaSession";
export const ROUTE_IQ_CUSTOMER_PWA_SESSION_CONTRACT_VERSION = "route-iq-customer-pwa-session-v2";
export const ROUTE_IQ_CUSTOMER_PWA_ENV = Object.freeze({
  enabled: "ROUTE_IQ_CUSTOMER_PWA_LAUNCH_ENABLED",
  workerName: "ROUTE_IQ_CUSTOMER_PWA_WORKER_NAME",
  accessTeamDomain: "ROUTE_IQ_CUSTOMER_PWA_ACCESS_TEAM_DOMAIN",
  accessAudience: "ROUTE_IQ_CUSTOMER_PWA_ACCESS_AUDIENCE"
});
export const ROUTE_IQ_CUSTOMER_PWA_SESSION_KEYS = Object.freeze([
  "contractVersion",
  "authorizationState",
  "workspaceId",
  "workspaceLabel",
  "operatingProfileId",
  "userId",
  "representativeId",
  "displayName",
  "roleId",
  "capabilities",
  "runtimeAssets",
  "expiresAt",
  "safety"
]);
export const ROUTE_IQ_CUSTOMER_PWA_SESSION_RESPONSE_KEYS = Object.freeze(["ok", "session"]);
export const ROUTE_IQ_CUSTOMER_PWA_SESSION_CAPABILITY_KEYS = Object.freeze([
  "operateOwnRoute",
  "readWorkspaceOperations",
  "administerWorkspaceRoster",
  "founderIntelligence",
  "founderCrm"
]);
export const ROUTE_IQ_CUSTOMER_PWA_SESSION_RUNTIME_ASSET_KEYS = Object.freeze([
  "workspaceConfiguration",
  "businessManifestRegistry",
  "businessRoster",
  "businessHours"
]);
export const ROUTE_IQ_CUSTOMER_PWA_SESSION_SAFETY_KEYS = Object.freeze([
  "prospectiveCollection",
  "activeCohorts",
  "recommendationInfluence"
]);
export const ROUTE_IQ_CUSTOMER_PWA_ERROR_RESPONSE_KEYS = Object.freeze(["ok", "code", "message"]);
export const ROUTE_IQ_CUSTOMER_PWA_FAILURES = Object.freeze({
  inactive: "route_iq_customer_pwa_inactive",
  configurationInvalid: "route_iq_customer_pwa_configuration_invalid",
  launchInvalid: "route_iq_customer_pwa_launch_invalid",
  authenticationRequired: "route_iq_customer_pwa_authentication_required",
  algorithmInvalid: "route_iq_customer_pwa_auth_algorithm_invalid",
  audienceMismatch: "route_iq_customer_pwa_auth_audience_mismatch",
  claimMissing: "route_iq_customer_pwa_auth_claim_missing",
  issuerMismatch: "route_iq_customer_pwa_auth_issuer_mismatch",
  jwksInvalid: "route_iq_customer_pwa_auth_jwks_invalid",
  jwksTimeout: "route_iq_customer_pwa_auth_jwks_timeout",
  jwksUnavailable: "route_iq_customer_pwa_auth_jwks_unavailable",
  signatureInvalid: "route_iq_customer_pwa_auth_signature_invalid",
  signingKeyUnknown: "route_iq_customer_pwa_auth_signing_key_unknown",
  tokenExpired: "route_iq_customer_pwa_auth_token_expired",
  tokenMalformed: "route_iq_customer_pwa_auth_token_malformed",
  tokenPremature: "route_iq_customer_pwa_auth_token_premature",
  principalUnmapped: "route_iq_customer_pwa_principal_unmapped",
  roleUnauthorized: "route_iq_customer_pwa_role_unauthorized",
  scopeMismatch: "route_iq_customer_pwa_scope_mismatch",
  crossUserWriteDenied: "route_iq_customer_pwa_cross_user_write_denied",
  runtimeBindingInvalid: "route_iq_customer_pwa_runtime_binding_invalid",
  assetUnavailable: "route_iq_customer_pwa_asset_unavailable",
  routeNotFound: "route_iq_customer_pwa_route_not_found",
  methodNotAllowed: "route_iq_customer_pwa_method_not_allowed"
});

const CUSTOMER_PWA_WORKER_NAME = "prometheus-iq";
const MAX_ASSERTION_BYTES = 16 * 1024;
const MAX_APP_HTML_BYTES = 4 * 1024 * 1024;
const REQUIRED_ACCESS_CLAIMS = Object.freeze(["sub", "iat", "exp"]);
const FIXED_ERROR_MESSAGE = "Route IQ customer access is unavailable.";
const STRICT_ID = /^[a-z][a-z0-9_]{2,127}$/u;
const LOCAL_JSON_ASSET_PATH = /^\/(?:administration|data)\/[A-Za-z0-9._/-]+\.json$/u;
const WORKSPACE_CONFIGURATION_ASSET_PATH = "/administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json";
const BUSINESS_MANIFEST_REGISTRY_ASSET_PATH = "/data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json";
const PRODUCTION_BUSINESS_HOURS_BINDINGS = Object.freeze([
  Object.freeze({
    workspaceId: fitnessConnectionBusinessHours.workspaceId,
    operatingProfileId: fitnessConnectionBusinessHours.operatingProfileId,
    path: "/data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json",
    artifact: fitnessConnectionBusinessHours
  })
]);
const JSON_ESCAPE = Object.freeze({
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029"
});

let cachedJwksIssuer = null;
let cachedJwks = null;

export class RouteIqCustomerPwaRuntimeError extends Error {
  constructor(code, status = 403) {
    super(FIXED_ERROR_MESSAGE);
    this.name = "RouteIqCustomerPwaRuntimeError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, status = 403) {
  throw new RouteIqCustomerPwaRuntimeError(code, status);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

function validClientSessionShape(session) {
  return exactKeys(session, ROUTE_IQ_CUSTOMER_PWA_SESSION_KEYS)
    && exactKeys(session.capabilities, ROUTE_IQ_CUSTOMER_PWA_SESSION_CAPABILITY_KEYS)
    && exactKeys(session.runtimeAssets, ROUTE_IQ_CUSTOMER_PWA_SESSION_RUNTIME_ASSET_KEYS)
    && exactKeys(session.safety, ROUTE_IQ_CUSTOMER_PWA_SESSION_SAFETY_KEYS)
    && session.contractVersion === ROUTE_IQ_CUSTOMER_PWA_SESSION_CONTRACT_VERSION
    && session.authorizationState === "server_verified"
    && session.capabilities.founderIntelligence === false
    && session.capabilities.founderCrm === false
    && session.safety.prospectiveCollection === "OFF"
    && session.safety.activeCohorts === 0
    && session.safety.recommendationInfluence === "OFF";
}

function jsonResponse(body, status = 200, { head = false, headers = {} } = {}) {
  return new Response(head ? null : JSON.stringify(body), {
    status,
    headers: {
      ...AEGIS_API_HEADERS,
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

function canonicalTeamDomain(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.configurationInvalid, 503);
  }
  if (url.protocol !== "https:"
    || !/^[a-z0-9-]+\.cloudflareaccess\.com$/u.test(url.hostname)
    || (url.pathname !== "/" && url.pathname !== "")
    || url.search
    || url.hash
    || url.username
    || url.password
    || url.port) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.configurationInvalid, 503);
  }
  return url.origin;
}

function exactConfigString(value, maxLength) {
  if (typeof value !== "string"
    || value.length < 1
    || value.length > maxLength
    || /[\u0000-\u001F\u007F\s]/u.test(value)) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.configurationInvalid, 503);
  }
  return value;
}

function localJsonAssetPath(value, requiredPrefix) {
  if (typeof value !== "string"
    || !LOCAL_JSON_ASSET_PATH.test(value)
    || value.includes("..")
    || value.includes("//")
    || !value.startsWith(requiredPrefix)) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.runtimeBindingInvalid, 503);
  }
  return value;
}

function validateRuntimeWorkspaceRegistry(registry, { noncanonicalTest = false } = {}) {
  let validated = registry;
  if (!noncanonicalTest) {
    try {
      validated = validateRouteIqWorkspaceConfigurationRegistry(registry);
    } catch {
      fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.runtimeBindingInvalid, 503);
    }
  }
  if (validated?.schemaVersion !== "route-iq-workspace-configuration-v2"
    || validated?.authority !== "prometheus_administration"
    || validated?.safety?.collection !== "OFF"
    || validated?.safety?.activeCohorts !== 0
    || validated?.safety?.recommendationInfluence !== "OFF"
    || !Array.isArray(validated?.workspaces)) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.runtimeBindingInvalid, 503);
  }
  return validated;
}

function resolveExactRuntimeAssets(principal, bindings, { noncanonicalTest = false } = {}) {
  if (!principal?.authorized
    || !STRICT_ID.test(principal.workspaceId || "")
    || !STRICT_ID.test(principal.operatingProfileId || "")
    || !STRICT_ID.test(principal.userId || "")
    || !STRICT_ID.test(principal.representativeId || "")
    || !STRICT_ID.test(principal.roleId || "")
    || !bindings
    || typeof bindings !== "object") {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.runtimeBindingInvalid, 503);
  }

  const workspaceConfigurationPath = localJsonAssetPath(
    bindings.workspaceConfiguration?.path,
    "/administration/"
  );
  const manifestRegistryPath = localJsonAssetPath(
    bindings.businessManifestRegistry?.path,
    "/data/"
  );
  if (workspaceConfigurationPath !== WORKSPACE_CONFIGURATION_ASSET_PATH
    || manifestRegistryPath !== BUSINESS_MANIFEST_REGISTRY_ASSET_PATH) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.runtimeBindingInvalid, 503);
  }

  const registry = validateRuntimeWorkspaceRegistry(
    bindings.workspaceConfiguration?.registry,
    { noncanonicalTest }
  );
  const workspaceMatches = registry.workspaces.filter(
    workspace => workspace?.workspaceId === principal.workspaceId
  );
  if (workspaceMatches.length !== 1) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.runtimeBindingInvalid, 503);
  }
  const workspace = workspaceMatches[0];
  if (workspace.operatingProfile?.profileId !== principal.operatingProfileId
    || workspace.fallbackPolicy?.mode !== "FAIL_CLOSED"
    || workspace.fallbackPolicy?.demoCatalogAllowed !== false
    || workspace.fallbackPolicy?.embeddedBusinessCatalogAllowed !== false
    || workspace.fallbackPolicy?.crossWorkspaceFallbackAllowed !== false) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.runtimeBindingInvalid, 503);
  }

  const userMatches = (workspace.users || []).filter(user =>
    user?.userId === principal.userId
      && user?.representativeId === principal.representativeId
      && user?.roleId === principal.roleId
      && user?.active === true
  );
  const roleMatches = (workspace.roles || []).filter(role => role?.roleId === principal.roleId);
  if (userMatches.length !== 1 || roleMatches.length !== 1) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.roleUnauthorized);
  }

  const manifestRegistry = bindings.businessManifestRegistry?.registry;
  if (manifestRegistry?.schemaVersion !== "route-iq-workspace-business-artifact-manifest-v1"
    || manifestRegistry?.registryVersion !== "route-iq-workspace-business-artifact-manifest-registry-v1"
    || manifestRegistry?.fallbackPolicy !== "FAIL_CLOSED_NO_DEMO_OR_CROSS_WORKSPACE_FALLBACK"
    || !Array.isArray(manifestRegistry?.manifests)) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.runtimeBindingInvalid, 503);
  }
  const manifestMatches = manifestRegistry.manifests.filter(manifest =>
    manifest?.workspaceId === principal.workspaceId
      && manifest?.operatingProfileId === principal.operatingProfileId
  );
  if (manifestMatches.length !== 1) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.runtimeBindingInvalid, 503);
  }
  const manifest = manifestMatches[0];
  const sources = (workspace.opportunitySources || []).filter(source =>
    source?.workspaceId === principal.workspaceId
      && source?.profileId === principal.operatingProfileId
      && source?.manifestId === manifest.manifestId
      && source?.manifestRegistryPath === manifestRegistryPath.slice(1)
      && source?.artifactPath === manifest.artifactPath
  );
  if (sources.length !== 1
    || manifest.manifestVersion !== "route-iq-workspace-business-artifact-manifest-v1"
    || typeof manifest.artifactPath !== "string"
    || manifest.demoFallbackAllowed !== false
    || manifest.crossWorkspaceFallbackAllowed !== false
    || sources[0].classification !== manifest.classification
    || sources[0].manifestApprovalState !== manifest.approvalState
    || sources[0].productionUseAuthorized !== manifest.productionUseAuthorized) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.runtimeBindingInvalid, 503);
  }
  const businessRosterPath = localJsonAssetPath(`/${manifest.artifactPath}`, "/data/");

  const hoursMatches = (Array.isArray(bindings.businessHours) ? bindings.businessHours : []).filter(
    binding => binding?.workspaceId === principal.workspaceId
      && binding?.operatingProfileId === principal.operatingProfileId
  );
  if (hoursMatches.length !== 1) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.runtimeBindingInvalid, 503);
  }
  const hoursBinding = hoursMatches[0];
  const businessHoursPath = localJsonAssetPath(hoursBinding.path, "/data/");
  const hoursArtifact = hoursBinding.artifact;
  if (hoursArtifact?.schemaVersion !== "prometheus-data-business-hours-v1"
    || hoursArtifact.workspaceId !== principal.workspaceId
    || hoursArtifact.operatingProfileId !== principal.operatingProfileId
    || Number(hoursArtifact.freshnessPolicy?.providerRefreshIntervalHours) > 24
    || Number(hoursArtifact.freshnessPolicy?.freshnessThresholdHours) > 24
    || !Array.isArray(hoursArtifact.records)) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.runtimeBindingInvalid, 503);
  }

  let zipCoverage;
  try {
    zipCoverage = projectRouteIqWorkspaceZipCoverage({
      principal,
      workspaceRegistry: registry
    });
  } catch {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.runtimeBindingInvalid, 503);
  }

  return deepFreeze({
    runtimeAssets: {
      workspaceConfiguration: workspaceConfigurationPath,
      businessManifestRegistry: manifestRegistryPath,
      businessRoster: businessRosterPath,
      businessHours: businessHoursPath
    },
    runtimeAuthorization: {
      territoryIds: zipCoverage.territoryIds,
      zipCoverage
    }
  });
}

export function getRouteIqCustomerPwaLaunchMode(env = {}) {
  const value = env?.[ROUTE_IQ_CUSTOMER_PWA_ENV.enabled];
  if (value === undefined || value === null || value === "" || value === "OFF") return "OFF";
  if (value === "ON") return "ON";
  fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.configurationInvalid, 503);
}

function jwksFor(issuer) {
  if (cachedJwksIssuer !== issuer || !cachedJwks) {
    cachedJwksIssuer = issuer;
    cachedJwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
      timeoutDuration: 5000,
      cooldownDuration: 30000
    });
  }
  return cachedJwks;
}

function classifyKeyResolutionFailure(error) {
  switch (error?.code) {
    case "ERR_JWKS_NO_MATCHING_KEY":
      return new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.signingKeyUnknown);
    case "ERR_JWKS_INVALID":
    case "ERR_JWKS_MULTIPLE_MATCHING_KEYS":
    case "ERR_JWK_INVALID":
      return new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.jwksInvalid, 503);
    case "ERR_JWKS_TIMEOUT":
      return new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.jwksTimeout, 503);
    default:
      return new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.jwksUnavailable, 503);
  }
}

async function resolveSigningKey(keyResolver, ...argumentsList) {
  try {
    return await keyResolver(...argumentsList);
  } catch (error) {
    throw classifyKeyResolutionFailure(error);
  }
}

function classifyJwtFailure(error) {
  if (error?.code === "ERR_JWT_EXPIRED") {
    return new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.tokenExpired);
  }
  if (error?.code === "ERR_JWT_CLAIM_VALIDATION_FAILED") {
    if (error.reason === "missing" && REQUIRED_ACCESS_CLAIMS.includes(error.claim)) {
      return new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.claimMissing);
    }
    if (error.claim === "iss") return new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.issuerMismatch);
    if (error.claim === "aud") return new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.audienceMismatch);
    if (error.claim === "nbf" || error.claim === "iat") {
      return new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.tokenPremature);
    }
    return new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.tokenMalformed);
  }
  switch (error?.code) {
    case "ERR_JWS_SIGNATURE_VERIFICATION_FAILED":
      return new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.signatureInvalid);
    case "ERR_JOSE_ALG_NOT_ALLOWED":
    case "ERR_JOSE_NOT_SUPPORTED":
      return new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.algorithmInvalid);
    case "ERR_JWS_INVALID":
    case "ERR_JWT_INVALID":
    case "ERR_JWK_INVALID":
      return new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.tokenMalformed);
    default:
      return new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.tokenMalformed);
  }
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function launchInputs(testHooks) {
  if (testHooks?.enabled === true) {
    if (!(testHooks.currentDate instanceof Date)
      || typeof testHooks.keyResolver !== "function"
      || !testHooks.runtimeBindings
      || typeof testHooks.runtimeBindings !== "object") {
      fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.configurationInvalid, 503);
    }
    return {
      envelope: testHooks.envelope || launchEnvelope,
      registry: testHooks.registry || commercialWorkspaceRegistry,
      currentDate: testHooks.currentDate,
      keyResolver: testHooks.keyResolver,
      dataAuthorizePrincipal: typeof testHooks.dataAuthorizePrincipal === "function"
        ? testHooks.dataAuthorizePrincipal
        : authorizeRouteIqAugust1LaunchPrincipal,
      runtimeBindings: testHooks.runtimeBindings,
      noncanonicalTest: true
    };
  }
  return {
    envelope: launchEnvelope,
    registry: commercialWorkspaceRegistry,
    currentDate: undefined,
    keyResolver: undefined,
    dataAuthorizePrincipal: authorizeRouteIqAugust1LaunchPrincipal,
    runtimeBindings: {
      workspaceConfiguration: {
        path: WORKSPACE_CONFIGURATION_ASSET_PATH,
        registry: workspaceConfigurationRegistry
      },
      businessManifestRegistry: {
        path: BUSINESS_MANIFEST_REGISTRY_ASSET_PATH,
        registry: businessManifestRegistry
      },
      businessHours: PRODUCTION_BUSINESS_HOURS_BINDINGS
    },
    noncanonicalTest: false
  };
}

function mapLaunchFailure(error) {
  switch (error?.code) {
    case "route_iq_launch_inactive":
      return new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.inactive, 404);
    case "route_iq_launch_principal_unmapped":
    case "route_iq_launch_authentication_required":
      return new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.principalUnmapped);
    case "route_iq_launch_role_unauthorized":
      return new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.roleUnauthorized);
    case "route_iq_launch_cross_workspace_denied":
    case "route_iq_launch_requested_workspace_unauthorized":
    case "route_iq_launch_workspace_selection_unauthorized":
      return new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.scopeMismatch);
    case "route_iq_launch_cross_user_write_denied":
      return new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.crossUserWriteDenied);
    default:
      return new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.launchInvalid, 503);
  }
}

export async function authorizeRouteIqCustomerPwaRequest(request, env = {}, { testHooks } = {}) {
  if (getRouteIqCustomerPwaLaunchMode(env) !== "ON") {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.inactive, 404);
  }
  if (env?.[ROUTE_IQ_CUSTOMER_PWA_ENV.workerName] !== CUSTOMER_PWA_WORKER_NAME) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.configurationInvalid, 503);
  }

  let requestedWorkspaceId;
  try {
    requestedWorkspaceId = requestedRouteIqWorkspaceId(request);
  } catch (error) {
    if (error instanceof RouteIqMultiCompanyRuntimeAuthorizationError
      && error.code === ROUTE_IQ_MULTI_COMPANY_FAILURES.selectionInvalid) {
      fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.scopeMismatch);
    }
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.launchInvalid, 503);
  }

  const inputs = launchInputs(testHooks);
  let launch;
  try {
    launch = validateRouteIqAugust1LaunchEnvelope(inputs.envelope, inputs.registry, {
      now: inputs.currentDate || new Date()
    });
  } catch (error) {
    throw mapLaunchFailure(error);
  }
  if (launch.state !== "ACTIVE") fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.inactive, 404);

  const issuer = canonicalTeamDomain(env?.[ROUTE_IQ_CUSTOMER_PWA_ENV.accessTeamDomain]);
  const audience = exactConfigString(env?.[ROUTE_IQ_CUSTOMER_PWA_ENV.accessAudience], 256);
  const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!assertion || new TextEncoder().encode(assertion).byteLength > MAX_ASSERTION_BYTES) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.authenticationRequired);
  }

  let payload;
  try {
    const currentDate = inputs.currentDate instanceof Date ? inputs.currentDate : undefined;
    const keyResolver = inputs.keyResolver || jwksFor(issuer);
    let protectedHeader;
    ({ payload, protectedHeader } = await jwtVerify(
      assertion,
      (...argumentsList) => resolveSigningKey(keyResolver, ...argumentsList),
      {
        issuer,
        audience,
        algorithms: ["RS256"],
        requiredClaims: REQUIRED_ACCESS_CLAIMS,
        clockTolerance: 5,
        ...(currentDate ? { currentDate } : {})
      }
    ));
    if (protectedHeader.alg !== "RS256"
      || typeof protectedHeader.kid !== "string"
      || protectedHeader.kid.length < 1
      || protectedHeader.kid.length > 256
      || /[\u0000-\u001F\u007F]/u.test(protectedHeader.kid)) {
      fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.algorithmInvalid);
    }
  } catch (error) {
    if (error instanceof RouteIqCustomerPwaRuntimeError) throw error;
    throw classifyJwtFailure(error);
  }

  const nowSeconds = Math.floor((inputs.currentDate instanceof Date ? inputs.currentDate : new Date()).getTime() / 1000);
  const exactAudience = payload.aud === audience
    || (Array.isArray(payload.aud) && payload.aud.length === 1 && payload.aud[0] === audience);
  if (payload.iss !== issuer) fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.issuerMismatch);
  if (!exactAudience) fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.audienceMismatch);
  if (typeof payload.sub !== "string"
    || payload.sub.length < 1
    || payload.sub.length > 512
    || /[\u0000-\u001F\u007F]/u.test(payload.sub)
    || !Number.isInteger(payload.iat)
    || !Number.isInteger(payload.exp)
    || (payload.nbf !== undefined && !Number.isInteger(payload.nbf))) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.tokenMalformed);
  }
  if (payload.exp <= nowSeconds) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.tokenExpired);
  }
  if (payload.iat > nowSeconds + 5) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.tokenPremature);
  }

  const authenticatedPrincipalId = `riq_principal_${await sha256(payload.sub)}`;
  let principal;
  try {
    principal = await inputs.dataAuthorizePrincipal({
      envelope: inputs.envelope,
      registry: inputs.registry,
      authenticatedPrincipalId,
      requestedWorkspaceId,
      now: inputs.currentDate || new Date()
    });
  } catch (error) {
    throw mapLaunchFailure(error);
  }
  if (requestedWorkspaceId !== undefined && principal?.workspaceId !== requestedWorkspaceId) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.scopeMismatch);
  }
  const runtimeContext = resolveExactRuntimeAssets(principal, inputs.runtimeBindings, {
    noncanonicalTest: inputs.noncanonicalTest
  });
  const runtimePrincipal = deepFreeze({
    ...clone(principal),
    territoryIds: clone(runtimeContext.runtimeAuthorization.territoryIds)
  });
  return deepFreeze({
    launch,
    principal: runtimePrincipal,
    runtimeAssets: runtimeContext.runtimeAssets,
    runtimeAuthorization: runtimeContext.runtimeAuthorization,
    accessExpiresAt: new Date(payload.exp * 1000).toISOString()
  });
}

export function createRouteIqCustomerPwaSession(authorization) {
  const { accessExpiresAt, launch, principal, runtimeAssets } = authorization || {};
  if (!launch || !principal?.authorized) fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.authenticationRequired);
  if (!Number.isInteger(launch.verifiedCapacity?.companies)
    || launch.verifiedCapacity.companies < 1
    || launch.verifiedCapacity.companies > routeIqAugust1LaunchMaximumCompanies
    || !Number.isInteger(launch.verifiedCapacity?.namedUsers)
    || launch.verifiedCapacity.namedUsers < 1
    || launch.verifiedCapacity.namedUsers > routeIqAugust1LaunchMaximumNamedUsers) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.launchInvalid, 503);
  }
  const accessExpiresAtMs = Date.parse(accessExpiresAt);
  const launchExpiresAtMs = Date.parse(principal.expiresAt);
  if (!Number.isFinite(accessExpiresAtMs) || !Number.isFinite(launchExpiresAtMs)) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.launchInvalid, 503);
  }
  const session = {
    contractVersion: ROUTE_IQ_CUSTOMER_PWA_SESSION_CONTRACT_VERSION,
    authorizationState: "server_verified",
    workspaceId: principal.workspaceId,
    workspaceLabel: principal.workspaceLabel,
    operatingProfileId: principal.operatingProfileId,
    userId: principal.userId,
    representativeId: principal.representativeId,
    displayName: principal.displayName,
    roleId: principal.roleId,
    capabilities: {
      ...clone(principal.capabilities),
      founderIntelligence: false,
      founderCrm: false
    },
    runtimeAssets: clone(runtimeAssets),
    expiresAt: new Date(Math.min(accessExpiresAtMs, launchExpiresAtMs)).toISOString(),
    safety: clone(principal.safety)
  };
  if (!validClientSessionShape(session)) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.launchInvalid, 503);
  }
  return deepFreeze(session);
}

export function serializeRouteIqCustomerPwaSession(session) {
  if (!validClientSessionShape(session)) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.launchInvalid, 503);
  }
  return JSON.stringify(session).replace(/[<>&\u2028\u2029]/gu, character => JSON_ESCAPE[character]);
}

export function injectRouteIqCustomerPwaSession(html, session) {
  const exactTemplate = `<template id="${ROUTE_IQ_CUSTOMER_PWA_SESSION_TEMPLATE_ID}">${ROUTE_IQ_CUSTOMER_PWA_SESSION_MARKER}</template>`;
  const markerCount = typeof html === "string"
    ? html.split(ROUTE_IQ_CUSTOMER_PWA_SESSION_MARKER).length - 1
    : 0;
  if (typeof html !== "string"
    || markerCount !== 1
    || !html.includes(exactTemplate)) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.assetUnavailable, 503);
  }
  return html.replace(
    ROUTE_IQ_CUSTOMER_PWA_SESSION_MARKER,
    serializeRouteIqCustomerPwaSession(session)
  );
}

function safeRuntimeError(error) {
  return error instanceof RouteIqCustomerPwaRuntimeError
    ? error
    : new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.launchInvalid, 503);
}

function canonicalCustomerPwaRedirect(request) {
  const source = new URL(request.url);
  const target = new URL(ROUTE_IQ_CUSTOMER_PWA_PATH, source.origin);
  target.search = source.search;
  return new Response(null, {
    status: 307,
    headers: {
      ...AEGIS_API_HEADERS,
      "Cache-Control": "private, no-store",
      Location: target.href,
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export function routeIqCustomerPwaErrorResponse(error, { head = false } = {}) {
  const safe = safeRuntimeError(error);
  const body = { ok: false, code: safe.code, message: FIXED_ERROR_MESSAGE };
  if (!exactKeys(body, ROUTE_IQ_CUSTOMER_PWA_ERROR_RESPONSE_KEYS)) {
    return jsonResponse({ ok: false }, 503, { head });
  }
  return jsonResponse(body, safe.status, { head });
}

async function readBoundedAssetText(response) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_APP_HTML_BYTES) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.assetUnavailable, 503);
  }
  if (!response.body) fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.assetUnavailable, 503);
  const reader = response.body.getReader();
  const chunks = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_APP_HTML_BYTES) {
        await reader.cancel("Route IQ customer PWA asset exceeded the bounded size.");
        fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.assetUnavailable, 503);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.assetUnavailable, 503);
  }
}

async function serveCustomerPwaApp(request, env, session) {
  if (!env?.ASSETS?.fetch) fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.assetUnavailable, 503);
  const indexUrl = new URL("/index.html", request.url);
  const assetRequest = new Request(indexUrl, {
    method: "GET",
    headers: { Accept: "text/html" }
  });
  let assetResponse;
  try {
    assetResponse = await env.ASSETS.fetch(assetRequest);
  } catch {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.assetUnavailable, 503);
  }
  if (!assetResponse?.ok) fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.assetUnavailable, 503);
  if (!(assetResponse.headers.get("content-type") || "").toLowerCase().includes("text/html")) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.assetUnavailable, 503);
  }
  const html = await readBoundedAssetText(assetResponse);
  const injected = injectRouteIqCustomerPwaSession(html, session);
  const headers = new Headers(assetResponse.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.delete("Content-Encoding");
  headers.delete("Content-Length");
  return new Response(request.method === "HEAD" ? null : injected, {
    status: 200,
    headers
  });
}

export function isRouteIqCustomerPwaAppNamespace(pathname) {
  return pathname === ROUTE_IQ_CUSTOMER_PWA_PATH || pathname.startsWith(`${ROUTE_IQ_CUSTOMER_PWA_PATH}/`);
}

export function isRouteIqCustomerPwaSessionPath(pathname) {
  return pathname === ROUTE_IQ_CUSTOMER_PWA_SESSION_PATH;
}

export async function handleRouteIqCustomerPwaRequest(request, env = {}, { testHooks } = {}) {
  const url = new URL(request.url);
  const isCanonicalApp = url.pathname === ROUTE_IQ_CUSTOMER_PWA_PATH;
  const isTrailingSlashApp = url.pathname === ROUTE_IQ_CUSTOMER_PWA_TRAILING_SLASH_PATH;
  const isApp = isCanonicalApp || isTrailingSlashApp;
  const isSession = isRouteIqCustomerPwaSessionPath(url.pathname);
  if (!isApp && !isSession) {
    return routeIqCustomerPwaErrorResponse(
      new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.routeNotFound, 404),
      { head: request.method === "HEAD" }
    );
  }
  if (!["GET", "HEAD"].includes(request.method)) {
    return routeIqCustomerPwaErrorResponse(
      new RouteIqCustomerPwaRuntimeError(ROUTE_IQ_CUSTOMER_PWA_FAILURES.methodNotAllowed, 405),
      { head: request.method === "HEAD" }
    );
  }
  try {
    const authorization = await authorizeRouteIqCustomerPwaRequest(request, env, { testHooks });
    const session = createRouteIqCustomerPwaSession(authorization);
    if (isTrailingSlashApp) return canonicalCustomerPwaRedirect(request);
    if (isSession) {
      const body = { ok: true, session };
      if (!exactKeys(body, ROUTE_IQ_CUSTOMER_PWA_SESSION_RESPONSE_KEYS)) {
        fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.launchInvalid, 503);
      }
      return jsonResponse(body, 200, { head: request.method === "HEAD" });
    }
    return await serveCustomerPwaApp(request, env, session);
  } catch (error) {
    return routeIqCustomerPwaErrorResponse(error, { head: request.method === "HEAD" });
  }
}

export function assertRouteIqCustomerPwaFieldSessionScope(authorization, body) {
  const principal = authorization?.principal;
  if (!principal?.authorized) fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.authenticationRequired);
  if (!body || typeof body !== "object"
    || body.workspaceId !== principal.workspaceId
    || body.operatingProfileId !== principal.operatingProfileId) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.scopeMismatch);
  }
  let report;
  try {
    report = JSON.parse(body.rawReportText);
  } catch {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.scopeMismatch);
  }
  const representativeId = report?.rep?.id;
  if (typeof representativeId !== "string" || !representativeId) {
    fail(ROUTE_IQ_CUSTOMER_PWA_FAILURES.scopeMismatch);
  }
  try {
    assertRouteIqAugust1LaunchResourceAccess(principal, {
      workspaceId: body.workspaceId,
      representativeId,
      operation: "write_route"
    });
  } catch (error) {
    throw mapLaunchFailure(error);
  }
  return true;
}
