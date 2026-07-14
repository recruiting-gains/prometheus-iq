import {
  ROUTE_IQ_PROSPECTIVE_SHADOW_ENV,
  assertExactKeys,
  failRouteIqProspective,
  requireBoundedString,
  sha256Hex,
  stableJson,
  utf8ByteLength
} from "./route-iq-prospective-shadow-contract.js";

export const routeIqProspectiveAuthorityEnvelopeVersion = "route-iq-infrastructure-authority-envelope-v1";
export const routeIqProspectiveAuthorityAlgorithm = "HMAC-SHA-256";

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value) {
  if (typeof value !== "string" || value.length < 16 || value.length > 256 || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    failRouteIqProspective("Authority envelope signature is invalid.", "route_iq_prospective_authority_signature_invalid", 403);
  }
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    return Uint8Array.from(atob(base64), character => character.charCodeAt(0));
  } catch {
    failRouteIqProspective("Authority envelope signature is invalid.", "route_iq_prospective_authority_signature_invalid", 403);
  }
}

function readAuthorityConfig(env) {
  const secret = env?.[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.authorityKey];
  const keyVersion = env?.[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.authorityKeyVersion];
  if (typeof secret !== "string" || utf8ByteLength(secret) < 32 || utf8ByteLength(secret) > 4096) {
    failRouteIqProspective(
      "Route IQ prospective authority key is unavailable.",
      "route_iq_prospective_authority_key_missing",
      503
    );
  }
  requireBoundedString(keyVersion, "authorityKeyVersion", {
    min: 3,
    max: 64,
    pattern: /^[A-Za-z0-9][A-Za-z0-9._-]+$/u
  });
  return { secret, keyVersion };
}

async function keyIdForVersion(keyVersion) {
  return `riq_key_${await sha256Hex({
    purpose: "route_iq_prospective_authority_key_identifier",
    keyVersion
  })}`;
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function signedEnvelopeBody(envelope) {
  return {
    version: envelope.version,
    channel: envelope.channel,
    keyVersion: envelope.keyVersion,
    keyId: envelope.keyId,
    algorithm: envelope.algorithm,
    claims: envelope.claims
  };
}

function requireChannel(channel) {
  if (channel !== "infrastructure" && channel !== "producer") {
    failRouteIqProspective("Authority envelope channel is invalid.", "route_iq_prospective_authority_channel_invalid", 403);
  }
  return channel;
}

export async function createRouteIqProspectiveAuthorityEnvelope(claims, env, { channel = "infrastructure" } = {}) {
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) {
    failRouteIqProspective("Authority claims are required.", "route_iq_prospective_authority_claims_invalid", 500);
  }
  const { secret, keyVersion } = readAuthorityConfig(env);
  const envelope = {
    version: routeIqProspectiveAuthorityEnvelopeVersion,
    channel: requireChannel(channel),
    keyVersion,
    keyId: await keyIdForVersion(keyVersion),
    algorithm: routeIqProspectiveAuthorityAlgorithm,
    claims: structuredClone(claims)
  };
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(stableJson(signedEnvelopeBody(envelope)))
  );
  return Object.freeze({ ...envelope, signature: bytesToBase64Url(new Uint8Array(signature)) });
}

export function createRouteIqProspectiveAuthorityVerifier(env) {
  return Object.freeze({
    async verify(envelope, { purpose } = {}) {
      assertExactKeys(envelope, [
        "version",
        "channel",
        "keyVersion",
        "keyId",
        "algorithm",
        "claims",
        "signature"
      ], "authorityEnvelope");
      const { secret, keyVersion } = readAuthorityConfig(env);
      const channel = requireChannel(envelope.channel);
      const expectedKeyId = await keyIdForVersion(keyVersion);
      if (envelope.version !== routeIqProspectiveAuthorityEnvelopeVersion
        || envelope.algorithm !== routeIqProspectiveAuthorityAlgorithm
        || envelope.keyVersion !== keyVersion
        || envelope.keyId !== expectedKeyId
        || !envelope.claims
        || typeof envelope.claims !== "object"
        || Array.isArray(envelope.claims)
        || envelope.claims.purpose !== purpose) {
        failRouteIqProspective("Authority envelope verification failed.", "route_iq_prospective_authority_invalid", 403);
      }
      const key = await importHmacKey(secret);
      const authenticated = await crypto.subtle.verify(
        "HMAC",
        key,
        base64UrlToBytes(envelope.signature),
        new TextEncoder().encode(stableJson(signedEnvelopeBody(envelope)))
      );
      if (!authenticated) {
        failRouteIqProspective("Authority envelope verification failed.", "route_iq_prospective_authority_invalid", 403);
      }
      return Object.freeze({
        authenticated: true,
        verificationType: channel === "producer"
          ? "infrastructure_verified_producer_signature"
          : "infrastructure_keyed_attestation",
        keyId: expectedKeyId,
        algorithm: routeIqProspectiveAuthorityAlgorithm,
        claims: structuredClone(envelope.claims)
      });
    }
  });
}

export function assertRouteIqProspectiveAuthorityConfig(env) {
  const { keyVersion } = readAuthorityConfig(env);
  return Object.freeze({ ok: true, keyVersion });
}
