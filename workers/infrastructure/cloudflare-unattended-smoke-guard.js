import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";

import {
  CLOUDFLARE_UNATTENDED_SMOKE_ENV,
  CLOUDFLARE_UNATTENDED_SMOKE_MARKER,
  CLOUDFLARE_UNATTENDED_SMOKE_SERVER_VERIFICATION,
  CLOUDFLARE_UNATTENDED_SMOKE_VERSION,
  cloudflareUnattendedSmokeContractVersion,
  isCloudflareUnattendedSmokeRequestAllowed
} from "./cloudflare-unattended-smoke-contract.js";

const ACCESS_ASSERTION_HEADER = "Cf-Access-Jwt-Assertion";
const ACCESS_CLIENT_ID_HEADER = "CF-Access-Client-Id";
const ACCESS_CLIENT_SECRET_HEADER = "CF-Access-Client-Secret";
const MAX_ACCESS_TOKEN_BYTES = 16 * 1024;
const MAX_CONFIG_BYTES = 512;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

let cachedJwksUrl = null;
let cachedRemoteJwks = null;

function deniedResponse() {
  return new Response(null, {
    status: 403,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function boundedString(value, { pattern } = {}) {
  if (typeof value !== "string"
    || value.length < 1
    || value.length > MAX_CONFIG_BYTES
    || value.trim() !== value
    || (pattern && !pattern.test(value))) {
    throw new Error("unattended_smoke_configuration_invalid");
  }
  return value;
}

function normalizeTeamDomain(value) {
  const configured = boundedString(value);
  const url = new URL(configured);
  if (url.protocol !== "https:"
    || !/^[a-z0-9-]+\.cloudflareaccess\.com$/u.test(url.hostname)
    || (url.pathname !== "/" && url.pathname !== "")
    || url.search
    || url.hash
    || url.username
    || url.password
    || url.port) {
    throw new Error("unattended_smoke_configuration_invalid");
  }
  return url.origin;
}

function remoteJwksFor(issuer) {
  const url = `${issuer}/cdn-cgi/access/certs`;
  if (cachedJwksUrl !== url || !cachedRemoteJwks) {
    cachedJwksUrl = url;
    cachedRemoteJwks = createRemoteJWKSet(new URL(url), {
      timeoutDuration:
        CLOUDFLARE_UNATTENDED_SMOKE_SERVER_VERIFICATION.jwksTimeoutMilliseconds,
      cooldownDuration: 30000
    });
  }
  return cachedRemoteJwks;
}

function structurallyClaimsServicePrincipal(token) {
  if (typeof token !== "string" || token.length < 1 || token.length > MAX_ACCESS_TOKEN_BYTES) {
    return false;
  }
  try {
    const payload = decodeJwt(token);
    return payload.sub === "" || typeof payload.common_name === "string";
  } catch {
    return false;
  }
}

function isSmokeGuardCandidate(request) {
  if (request.headers.has(CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestHeader)
    || request.headers.has(ACCESS_CLIENT_ID_HEADER)
    || request.headers.has(ACCESS_CLIENT_SECRET_HEADER)) {
    return true;
  }
  return structurallyClaimsServicePrincipal(request.headers.get(ACCESS_ASSERTION_HEADER));
}

function servicePrincipalConfiguration(env) {
  if (env?.[CLOUDFLARE_UNATTENDED_SMOKE_ENV.enabled] !== "ON") {
    throw new Error("unattended_smoke_guard_off");
  }
  return Object.freeze({
    issuer: normalizeTeamDomain(env?.[CLOUDFLARE_UNATTENDED_SMOKE_ENV.teamDomain]),
    audience: boundedString(
      env?.[CLOUDFLARE_UNATTENDED_SMOKE_ENV.audience],
      { pattern: /^[A-Za-z0-9._:-]+$/u }
    ),
    serviceTokenClientId: boundedString(
      env?.[CLOUDFLARE_UNATTENDED_SMOKE_ENV.serviceTokenClientId],
      { pattern: /^[a-z0-9]{32,64}\.access$/u }
    )
  });
}

async function verifyServicePrincipalJwt(token, configuration, testHooks) {
  if (typeof token !== "string" || token.length < 1 || token.length > MAX_ACCESS_TOKEN_BYTES) {
    throw new Error("unattended_smoke_access_token_missing");
  }
  const useTestHooks = testHooks?.enabled === true;
  const keyResolver = useTestHooks ? testHooks.keyResolver : remoteJwksFor(configuration.issuer);
  const currentDate = useTestHooks ? testHooks.currentDate : undefined;
  if (useTestHooks && (!keyResolver || !(currentDate instanceof Date))) {
    throw new Error("unattended_smoke_test_hook_invalid");
  }

  const { payload } = await jwtVerify(token, keyResolver, {
    issuer: configuration.issuer,
    audience: configuration.audience,
    algorithms: ["RS256"],
    requiredClaims: ["sub", "common_name", "iat", "exp"],
    clockTolerance: 5,
    ...(currentDate ? { currentDate } : {})
  });
  const nowSeconds = Math.floor((currentDate || new Date()).getTime() / 1000);
  if (payload.type !== "app"
    || payload.sub !== ""
    || payload.common_name !== configuration.serviceTokenClientId
    || !Number.isSafeInteger(payload.iat)
    || !Number.isSafeInteger(payload.exp)
    || payload.iat > nowSeconds + 60
    || payload.exp <= nowSeconds) {
    throw new Error("unattended_smoke_access_token_invalid");
  }
  return Object.freeze({
    contractVersion: cloudflareUnattendedSmokeContractVersion,
    kind: "service_principal",
    verified: true
  });
}

export async function authorizeCloudflareUnattendedSmokeRequest(request, env, {
  noncanonicalTestHooks
} = {}) {
  if (!isSmokeGuardCandidate(request)) {
    return Object.freeze({ kind: "ordinary", verified: false, response: null });
  }
  try {
    if (request.headers.get(CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestHeader)
      !== CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestValue) {
      throw new Error("unattended_smoke_marker_invalid");
    }
    const url = new URL(request.url);
    if (!isCloudflareUnattendedSmokeRequestAllowed(request.method, url)) {
      throw new Error("unattended_smoke_request_denied");
    }
    const configuration = servicePrincipalConfiguration(env);
    return await verifyServicePrincipalJwt(
      request.headers.get(ACCESS_ASSERTION_HEADER),
      configuration,
      noncanonicalTestHooks
    );
  } catch {
    return Object.freeze({ kind: "denied", verified: false, response: deniedResponse() });
  }
}

export function markCloudflareUnattendedSmokeResponse(response, authorization, env) {
  if (authorization?.kind !== "service_principal" || authorization.verified !== true) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set(
    CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseHeader,
    CLOUDFLARE_UNATTENDED_SMOKE_MARKER.responseValue
  );
  const workerVersion = env?.[CLOUDFLARE_UNATTENDED_SMOKE_VERSION.binding]?.id;
  if (UUID.test(workerVersion || "")) {
    headers.set(CLOUDFLARE_UNATTENDED_SMOKE_VERSION.responseHeader, workerVersion);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export function sanitizeCloudflareUnattendedSmokeAssetRequest(request, authorization) {
  if (authorization?.kind !== "service_principal" || authorization.verified !== true) {
    return request;
  }
  const headers = new Headers(request.headers);
  for (const name of [
    ACCESS_ASSERTION_HEADER,
    ACCESS_CLIENT_ID_HEADER,
    ACCESS_CLIENT_SECRET_HEADER,
    CLOUDFLARE_UNATTENDED_SMOKE_MARKER.requestHeader
  ]) {
    headers.delete(name);
  }
  return new Request(request, { headers });
}
