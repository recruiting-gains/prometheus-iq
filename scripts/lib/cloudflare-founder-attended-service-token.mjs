import { createHash, timingSafeEqual } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { resolve } from "node:path";

import {
  CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_PATH,
  consumeFounderAttendedControl,
  createFounderAttendedControl,
  readFounderAttendedRepositoryIdentity
} from "./cloudflare-founder-attended-control.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256,
  CLOUDFLARE_FOUNDER_ATTENDED_API_ORIGIN,
  CLOUDFLARE_FOUNDER_ATTENDED_API_PATH_TEMPLATE,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_BODY,
  CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_DURATION,
  CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_NAME
} from "./cloudflare-founder-attended-constants.mjs";
import {
  createFounderAttendedMacOsKeychain,
  founderAttendedKeychainPresence
} from "./cloudflare-founder-attended-keychain.mjs";
import { parseStrictJson } from "./strict-json.mjs";

export {
  CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256,
  CLOUDFLARE_FOUNDER_ATTENDED_API_ORIGIN,
  CLOUDFLARE_FOUNDER_ATTENDED_API_PATH_TEMPLATE,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_BODY,
  CLOUDFLARE_FOUNDER_ATTENDED_DIRECTIVE,
  CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_DURATION,
  CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_NAME,
  CLOUDFLARE_FOUNDER_ATTENDED_TEMPORARY_TOKEN_MAX_TTL_HOURS,
  CLOUDFLARE_FOUNDER_ATTENDED_TEMPORARY_TOKEN_PERMISSION
} from "./cloudflare-founder-attended-constants.mjs";

export const CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256_ALLOWLIST = Object.freeze([
  CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256
]);
export const CLOUDFLARE_FOUNDER_ATTENDED_CONFIRMATIONS = Object.freeze({
  "provision-attended":
    "PROVISION ONE EXACT PROMETHEUS OVERWATCH READ-ONLY SMOKE SERVICE TOKEN FOR 720 HOURS",
  "cleanup-temp":
    "DELETE ONLY THE TEMPORARY CLOUDFLARE SERVICE-TOKENS-WRITE API TOKEN FROM KEYCHAIN"
});
export const CLOUDFLARE_FOUNDER_ATTENDED_MANUAL_REVIEW_ERROR =
  "founder_attended_manual_review_required";
export const CLOUDFLARE_FOUNDER_ATTENDED_COMPENSATED_ERROR =
  "founder_attended_remote_creation_compensated";

const RESPONSE_MAX_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const EXACT_DURATION_MS = 720 * 60 * 60 * 1000;
const ACCOUNT_ID_PATTERN = /^[0-9a-f]{32}$/u;
const API_TOKEN_PATTERN = /^[\x21-\x7e]{20,4096}$/u;
const CLIENT_ID_PATTERN = /^[0-9a-f]{32,64}\.access$/u;
const CLIENT_SECRET_PATTERN = /^[A-Za-z0-9._~-]{16,4096}$/u;
const RESOURCE_ID_PATTERN = /^[A-Za-z0-9-]{16,128}$/u;
const RFC3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;

function genericError(code) {
  return new Error(code);
}

function exactCreateBodyText() {
  return JSON.stringify(CLOUDFLARE_FOUNDER_ATTENDED_CREATE_BODY);
}

function decodeKeychainValue(buffer, pattern, failureCode) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw genericError(failureCode);
  const value = buffer.toString("utf8");
  const roundTrip = Buffer.from(value, "utf8");
  const valid = roundTrip.equals(buffer) && pattern.test(value);
  roundTrip.fill(0);
  buffer.fill(0);
  if (!valid) throw genericError(failureCode);
  return value;
}

function allowlistedAccountDigest(accountId, allowlist) {
  const digest = createHash("sha256").update(accountId, "utf8").digest();
  try {
    for (const allowed of allowlist) {
      if (!/^[0-9a-f]{64}$/u.test(allowed)) throw genericError("account_allowlist_invalid");
      const expected = Buffer.from(allowed, "hex");
      try {
        if (timingSafeEqual(digest, expected)) return allowed;
      } finally {
        expected.fill(0);
      }
    }
  } finally {
    digest.fill(0);
  }
  throw genericError("governed_account_mismatch");
}

export function validateGovernedCloudflareAccountId(
  accountId,
  allowlist = CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256_ALLOWLIST
) {
  if (!ACCOUNT_ID_PATTERN.test(accountId || "") || !Array.isArray(allowlist) || allowlist.length !== 1) {
    throw genericError("governed_account_mismatch");
  }
  return allowlistedAccountDigest(accountId, allowlist);
}

function fixedCollectionUrl(accountId) {
  const url = new URL(CLOUDFLARE_FOUNDER_ATTENDED_API_ORIGIN);
  url.pathname = CLOUDFLARE_FOUNDER_ATTENDED_API_PATH_TEMPLATE.replace("{account_id}", accountId);
  return url;
}

function fixedTokenUrl(accountId, tokenId) {
  if (!RESOURCE_ID_PATTERN.test(tokenId || "")) throw genericError("compensation_target_invalid");
  const url = fixedCollectionUrl(accountId);
  url.pathname = `${url.pathname}/${tokenId}`;
  return url;
}

function fixedHeaders(apiToken, body) {
  return Object.freeze({
    Accept: "application/json",
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(body || "", "utf8")),
    Connection: "close",
    "User-Agent": "prometheus-founder-attended-service-token-v1"
  });
}

export function createFounderAttendedCloudflareTransport({
  requestImpl = httpsRequest
} = {}) {
  return Object.freeze({
    request(specification) {
      return new Promise((resolveResponse, rejectResponse) => {
        let settled = false;
        const rejectGeneric = () => {
          if (settled) return;
          settled = true;
          rejectResponse(genericError("cloudflare_transport_failed"));
        };
        let request;
        try {
          request = requestImpl(specification.url, {
            method: specification.method,
            headers: specification.headers,
            agent: false,
            timeout: REQUEST_TIMEOUT_MS
          }, response => {
            const chunks = [];
            let byteCount = 0;
            const clearChunks = () => {
              for (const chunk of chunks) chunk.fill(0);
              chunks.length = 0;
            };
            response.on("data", chunk => {
              if (settled) return;
              const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
              byteCount += buffer.length;
              if (byteCount > RESPONSE_MAX_BYTES) {
                buffer.fill(0);
                clearChunks();
                response.destroy();
                rejectGeneric();
                return;
              }
              chunks.push(buffer);
            });
            response.on("error", () => {
              clearChunks();
              rejectGeneric();
            });
            response.on("aborted", () => {
              clearChunks();
              rejectGeneric();
            });
            response.on("end", () => {
              if (settled) return;
              settled = true;
              const body = Buffer.concat(chunks);
              clearChunks();
              resolveResponse(Object.freeze({
                status: Number(response.statusCode),
                body
              }));
            });
          });
        } catch {
          rejectGeneric();
          return;
        }
        request.on("timeout", () => {
          request.destroy();
          rejectGeneric();
        });
        request.on("error", rejectGeneric);
        if (specification.body !== null) request.end(specification.body, "utf8");
        else request.end();
      });
    }
  });
}

function strictResponseBody(response, failureCode) {
  if (!response || !Number.isInteger(response.status)) throw genericError(failureCode);
  const responseBuffer = Buffer.isBuffer(response.body) ? response.body : null;
  const body = responseBuffer
    ? Buffer.from(responseBuffer)
    : Buffer.from(typeof response.body === "string" ? response.body : "", "utf8");
  try {
    if (!body.length || body.length > RESPONSE_MAX_BYTES) throw genericError(failureCode);
    return parseStrictJson(body.toString("utf8"));
  } catch {
    throw genericError(failureCode);
  } finally {
    body.fill(0);
    if (responseBuffer) responseBuffer.fill(0);
  }
}

function validCloudflareEnvelope(value) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && value.success === true
    && Array.isArray(value.errors)
    && value.errors.length === 0
    && Array.isArray(value.messages)
    && value.messages.length === 0;
}

function assertNoRemoteDuplicate(response) {
  if (!response || response.status !== 200) throw genericError("remote_duplicate_preflight_failed");
  const envelope = strictResponseBody(response, "remote_duplicate_preflight_failed");
  const info = envelope?.result_info;
  if (!validCloudflareEnvelope(envelope)
    || !Array.isArray(envelope.result)
    || !info
    || typeof info !== "object"
    || Array.isArray(info)
    || info.page !== 1
    || !Number.isInteger(info.per_page)
    || info.per_page < 1
    || info.per_page < envelope.result.length
    || info.count !== envelope.result.length
    || info.total_count !== envelope.result.length
    || info.total_pages !== 1) {
    throw genericError("remote_duplicate_preflight_failed");
  }
  for (const entry of envelope.result) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || typeof entry.name !== "string") {
      throw genericError("remote_duplicate_preflight_failed");
    }
    if (entry.name === CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_NAME) {
      throw genericError("remote_duplicate_present");
    }
  }
}

function parseTimestamp(value) {
  if (!RFC3339_PATTERN.test(value || "")) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function evaluateCreatedServiceToken(response) {
  let envelope;
  try {
    envelope = strictResponseBody(response, "service_token_creation_response_invalid");
  } catch {
    return Object.freeze({ valid: false, tokenId: null, credentials: null });
  }
  const result = envelope?.result;
  const envelopeValid = validCloudflareEnvelope(envelope);
  const resultObject = result && typeof result === "object" && !Array.isArray(result);
  const tokenId = envelopeValid
    && resultObject
    && result.name === CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_NAME
    && RESOURCE_ID_PATTERN.test(result.id || "")
    ? result.id
    : null;
  const createdAt = resultObject ? parseTimestamp(result.created_at) : null;
  const expiresAt = resultObject ? parseTimestamp(result.expires_at) : null;
  if (response.status !== 200
    || !envelopeValid
    || !resultObject
    || tokenId === null
    || result.duration !== CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_DURATION
    || !CLIENT_ID_PATTERN.test(result.client_id || "")
    || !CLIENT_SECRET_PATTERN.test(result.client_secret || "")
    || createdAt === null
    || expiresAt === null
    || expiresAt - createdAt !== EXACT_DURATION_MS) {
    return Object.freeze({ valid: false, tokenId, credentials: null });
  }
  return Object.freeze({
    valid: true,
    tokenId,
    credentials: Object.freeze({
      clientId: Buffer.from(result.client_id, "utf8"),
      clientSecret: Buffer.from(result.client_secret, "utf8")
    })
  });
}

function validCompensationResponse(response, tokenId) {
  if (!response || response.status !== 200) return false;
  let envelope;
  try {
    envelope = strictResponseBody(response, "service_token_compensation_failed");
  } catch {
    return false;
  }
  return validCloudflareEnvelope(envelope)
    && envelope.result
    && typeof envelope.result === "object"
    && !Array.isArray(envelope.result)
    && envelope.result.id === tokenId;
}

async function bestEffortCompensatingDelete({ transport, accountId, apiToken, tokenId }) {
  if (!RESOURCE_ID_PATTERN.test(tokenId || "")) return false;
  try {
    const response = await transport.request(Object.freeze({
      method: "DELETE",
      url: fixedTokenUrl(accountId, tokenId),
      headers: fixedHeaders(apiToken, null),
      body: null
    }));
    return validCompensationResponse(response, tokenId);
  } catch {
    return false;
  }
}

function requireFounderConfirmation(confirmation, action) {
  if (!confirmation || typeof confirmation.confirm !== "function") {
    throw genericError("founder_attendance_required");
  }
  let confirmed = false;
  try {
    confirmed = confirmation.confirm(action, CLOUDFLARE_FOUNDER_ATTENDED_CONFIRMATIONS[action]) === true;
  } catch {
    throw genericError("founder_attendance_required");
  }
  if (!confirmed) throw genericError("founder_confirmation_denied");
}

function requireLocalProvisioningState(keychain) {
  const required = ["temporaryApiToken", "governedAccountId"];
  const forbidden = ["smokeClientId", "smokeClientSecret"];
  try {
    if (required.some(key => !keychain.hasItem(key))) throw genericError("required_keychain_item_absent");
    if (forbidden.some(key => keychain.hasItem(key))) throw genericError("existing_smoke_credential_present");
  } catch (error) {
    if (["required_keychain_item_absent", "existing_smoke_credential_present"].includes(error?.message)) {
      throw error;
    }
    throw genericError("keychain_presence_preflight_failed");
  }
}

function rollbackSmokePair(keychain) {
  let failed = false;
  for (const key of ["smokeClientSecret", "smokeClientId"]) {
    try {
      if (keychain.hasItem(key)) keychain.deleteItem(key);
    } catch {
      failed = true;
    }
  }
  try {
    if (keychain.hasItem("smokeClientId") || keychain.hasItem("smokeClientSecret")) failed = true;
  } catch {
    failed = true;
  }
  if (failed) throw genericError("smoke_keychain_rollback_failed");
}

function storeSmokePair(keychain, credentials) {
  try {
    keychain.addItem("smokeClientId", credentials.clientId);
    keychain.addItem("smokeClientSecret", credentials.clientSecret);
    if (!keychain.hasItem("smokeClientId") || !keychain.hasItem("smokeClientSecret")) {
      throw genericError("smoke_keychain_storage_failed");
    }
  } catch {
    rollbackSmokePair(keychain);
    throw genericError("smoke_keychain_storage_failed");
  }
}

function prepareAndConsumeControl({
  controlPath,
  now,
  repositoryIdentity,
  accountIdSha256,
  randomBytesImpl,
  expectedUid
}) {
  try {
    createFounderAttendedControl({
      controlPath,
      now,
      repositoryIdentity,
      accountIdSha256,
      randomBytesImpl,
      expectedUid
    });
  } catch (error) {
    if (error?.message !== "founder_attended_control_exists") {
      throw genericError("founder_attended_control_denied");
    }
  }
  try {
    consumeFounderAttendedControl({
      controlPath,
      now,
      expectedCommit: repositoryIdentity.commit,
      expectedTree: repositoryIdentity.tree,
      expectedAccountIdSha256: accountIdSha256,
      expectedUid
    });
  } catch {
    throw genericError("founder_attended_control_denied");
  }
}

export async function provisionFounderAttendedServiceToken({
  root = resolve(import.meta.dirname, "../.."),
  controlPath = CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_PATH,
  now = new Date(),
  confirmation,
  keychain = createFounderAttendedMacOsKeychain(),
  transport = createFounderAttendedCloudflareTransport(),
  repositoryIdentity = readFounderAttendedRepositoryIdentity({ root }),
  accountIdSha256Allowlist = CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256_ALLOWLIST,
  randomBytesImpl,
  expectedUid
} = {}) {
  requireFounderConfirmation(confirmation, "provision-attended");
  if (!repositoryIdentity?.clean) throw genericError("founder_attended_repository_not_clean");
  requireLocalProvisioningState(keychain);

  let accountId;
  let apiToken;
  try {
    accountId = decodeKeychainValue(
      keychain.readItem("governedAccountId"),
      ACCOUNT_ID_PATTERN,
      "governed_account_unavailable"
    );
    const accountIdSha256 = validateGovernedCloudflareAccountId(accountId, accountIdSha256Allowlist);
    apiToken = decodeKeychainValue(
      keychain.readItem("temporaryApiToken"),
      API_TOKEN_PATTERN,
      "temporary_api_token_unavailable"
    );

    prepareAndConsumeControl({
      controlPath,
      now,
      repositoryIdentity,
      accountIdSha256,
      randomBytesImpl,
      expectedUid
    });

    let listResponse;
    try {
      listResponse = await transport.request(Object.freeze({
        method: "GET",
        url: fixedCollectionUrl(accountId),
        headers: fixedHeaders(apiToken, null),
        body: null
      }));
    } catch {
      throw genericError("remote_duplicate_preflight_failed");
    }
    assertNoRemoteDuplicate(listResponse);

    const createBody = exactCreateBodyText();
    let createResponse;
    try {
      createResponse = await transport.request(Object.freeze({
        method: "POST",
        url: fixedCollectionUrl(accountId),
        headers: fixedHeaders(apiToken, createBody),
        body: createBody
      }));
    } catch {
      throw genericError(CLOUDFLARE_FOUNDER_ATTENDED_MANUAL_REVIEW_ERROR);
    }

    const evaluation = evaluateCreatedServiceToken(createResponse);
    if (!evaluation.valid) {
      const compensated = evaluation.tokenId
        ? await bestEffortCompensatingDelete({
          transport,
          accountId,
          apiToken,
          tokenId: evaluation.tokenId
        })
        : false;
      throw genericError(compensated
        ? CLOUDFLARE_FOUNDER_ATTENDED_COMPENSATED_ERROR
        : CLOUDFLARE_FOUNDER_ATTENDED_MANUAL_REVIEW_ERROR);
    }

    let storageFailure = null;
    try {
      storeSmokePair(keychain, evaluation.credentials);
    } catch (error) {
      storageFailure = error?.message || "smoke_keychain_storage_failed";
    } finally {
      evaluation.credentials.clientId.fill(0);
      evaluation.credentials.clientSecret.fill(0);
    }
    if (storageFailure !== null) {
      const compensated = await bestEffortCompensatingDelete({
        transport,
        accountId,
        apiToken,
        tokenId: evaluation.tokenId
      });
      if (compensated && storageFailure === "smoke_keychain_storage_failed") {
        throw genericError(CLOUDFLARE_FOUNDER_ATTENDED_COMPENSATED_ERROR);
      }
      throw genericError(CLOUDFLARE_FOUNDER_ATTENDED_MANUAL_REVIEW_ERROR);
    }

    return Object.freeze({
      status: "provisioned",
      serviceTokenName: CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_NAME,
      duration: CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_DURATION,
      controlConsumed: true,
      remoteCreateAttempts: 1,
      smokeKeychainPairPresent: true,
      manualReviewRequired: false
    });
  } finally {
    accountId = null;
    apiToken = null;
  }
}

export function cleanupFounderAttendedTemporaryToken({
  confirmation,
  keychain = createFounderAttendedMacOsKeychain()
} = {}) {
  requireFounderConfirmation(confirmation, "cleanup-temp");
  try {
    if (!keychain.hasItem("temporaryApiToken")) {
      throw genericError("temporary_api_token_cleanup_failed");
    }
    keychain.deleteItem("temporaryApiToken");
    if (keychain.hasItem("temporaryApiToken")) {
      throw genericError("temporary_api_token_cleanup_failed");
    }
  } catch {
    throw genericError("temporary_api_token_cleanup_failed");
  }
  return Object.freeze({
    status: "temporary_keychain_item_removed",
    nextRequiredAction: "Founder must now revoke the temporary Cloudflare API token."
  });
}

export function inspectFounderAttendedPresence({
  keychain = createFounderAttendedMacOsKeychain()
} = {}) {
  return founderAttendedKeychainPresence(keychain);
}
