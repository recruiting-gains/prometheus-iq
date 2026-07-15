import { createHash } from "node:crypto";

import {
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_ACCOUNT_ALLOWLIST,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_API_ORIGIN,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_API_PATH_TEMPLATE,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONFIRMATIONS,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CREATE_BODY,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_RESPONSE_MAX_BYTES,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_DURATION,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_NAME
} from "./cloudflare-founder-attended-get-only-recovery-constants.mjs";
import {
  classifyCloudflareFounderAttendedRecoveryError,
  cloudflareFounderAttendedRecoveryClassificationError,
  decodeFounderAttendedRecoveryAccountId,
  decodeFounderAttendedRecoveryApiToken,
  listFounderAttendedExactServiceTokenNameGetOnly,
  validFounderAttendedRecoveryRepositoryIdentity,
  validateFounderAttendedRecoveryAccountId
} from "./cloudflare-founder-attended-get-only-diagnostic.mjs";
import {
  consumeFounderAttendedSuccessorRecoveryControl,
  validateFounderAttendedSuccessorRecoveryControl
} from "./cloudflare-founder-attended-recovery-control.mjs";
import { parseStrictJson } from "./strict-json.mjs";

export const CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_MANUAL_REVIEW = "MANUAL_REVIEW";
export const CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_COMPENSATED = "COMPENSATED";

const EXACT_DURATION_MS = 720 * 60 * 60 * 1000;
const CLIENT_ID_PATTERN = /^[0-9a-f]{32,64}\.access$/u;
const CLIENT_SECRET_PATTERN = /^[A-Za-z0-9._~-]{16,4096}$/u;
const RESOURCE_ID_PATTERN = /^[A-Za-z0-9-]{16,128}$/u;
const RFC3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const OWNERSHIP_TAG_PREFIX = "prometheus-founder-attended-v1:";

function recoveryOutcomeError(classification, recoveryOutcome) {
  const error = cloudflareFounderAttendedRecoveryClassificationError(classification);
  Object.defineProperty(error, "recoveryOutcome", {
    configurable: false,
    enumerable: false,
    value: recoveryOutcome,
    writable: false
  });
  return error;
}

function requireRecoveryComposition(options) {
  const valid = options
    && typeof options === "object"
    && options.confirmation
    && typeof options.confirmation.confirm === "function"
    && options.keychain
    && ["hasItem", "readItem", "addItem", "deleteOwnedItem"]
      .every(name => typeof options.keychain[name] === "function")
    && options.transport
    && typeof options.transport.request === "function"
    && typeof options.clock === "function"
    && typeof options.repositoryReader === "function"
    && Array.isArray(options.accountIdSha256Allowlist)
    && options.accountIdSha256Allowlist.length === 1
    && typeof options.artifactRoot === "string"
    && options.artifactRoot.length > 0
    && Number.isSafeInteger(options.expectedUid)
    && options.expectedUid >= 0;
  if (!valid) throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
  return options;
}

function requireRecoveryConfirmation(confirmation) {
  let confirmed = false;
  try {
    confirmed = confirmation.confirm(
      "recover-attended",
      CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONFIRMATIONS["recover-attended"]
    ) === true;
  } catch {
    throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
  }
  if (!confirmed) throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
}

function requireRecoveryKeychainState(keychain) {
  try {
    if (!keychain.hasItem("temporaryApiToken")
      || !keychain.hasItem("governedAccountId")
      || keychain.hasItem("smokeClientId")
      || keychain.hasItem("smokeClientSecret")) {
      throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
    }
  } catch {
    throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
  }
}

function sampleRecoveryLiveState(clock, repositoryReader) {
  try {
    const sampledAt = clock();
    const identity = repositoryReader();
    if (!(sampledAt instanceof Date)
      || !Number.isFinite(sampledAt.getTime())
      || !validFounderAttendedRecoveryRepositoryIdentity(identity)) {
      throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
    }
    return Object.freeze({
      sampledAt: new Date(sampledAt.getTime()),
      repositoryIdentity: Object.freeze({
        commit: identity.commit,
        tree: identity.tree,
        clean: true
      })
    });
  } catch {
    throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
  }
}

function revalidateRecoveryLiveState({
  clock,
  repositoryReader,
  previousSampledAt,
  control,
  accountIdSha256
}) {
  const current = sampleRecoveryLiveState(clock, repositoryReader);
  if (current.sampledAt.getTime() < previousSampledAt.getTime()
    || current.repositoryIdentity.commit !== control.authorizedCommit
    || current.repositoryIdentity.tree !== control.authorizedTree) {
    throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
  }
  const validation = validateFounderAttendedSuccessorRecoveryControl(control, {
    now: current.sampledAt,
    expectedCommit: current.repositoryIdentity.commit,
    expectedTree: current.repositoryIdentity.tree,
    expectedAccountIdSha256: accountIdSha256,
    consumed: false
  });
  if (!validation.valid) {
    throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
  }
  return current;
}

function fixedCollectionUrl(accountId) {
  const url = new URL(CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_API_ORIGIN);
  url.pathname = CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_API_PATH_TEMPLATE.replace(
    "{account_id}",
    accountId
  );
  return url;
}

function fixedTokenUrl(accountId, tokenId) {
  if (!RESOURCE_ID_PATTERN.test(tokenId || "")) {
    throw cloudflareFounderAttendedRecoveryClassificationError("RESPONSE_CONTRACT_MISMATCH");
  }
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
    "User-Agent": "prometheus-founder-attended-get-only-recovery-v1"
  });
}

function strictResponseBody(response) {
  if (!response || !Number.isInteger(response.status)) {
    throw cloudflareFounderAttendedRecoveryClassificationError("RESPONSE_CONTRACT_MISMATCH");
  }
  const original = Buffer.isBuffer(response.body) ? response.body : null;
  const body = original
    ? Buffer.from(original)
    : Buffer.from(typeof response.body === "string" ? response.body : "", "utf8");
  try {
    if (!body.length || body.length > CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_RESPONSE_MAX_BYTES) {
      throw cloudflareFounderAttendedRecoveryClassificationError("RESPONSE_CONTRACT_MISMATCH");
    }
    return parseStrictJson(body.toString("utf8"));
  } catch (error) {
    if (error?.message === "RESPONSE_CONTRACT_MISMATCH") throw error;
    throw cloudflareFounderAttendedRecoveryClassificationError("RESPONSE_CONTRACT_MISMATCH");
  } finally {
    body.fill(0);
    if (original) original.fill(0);
  }
}

function validCloudflareEnvelope(value) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && value.success === true
    && Array.isArray(value.errors)
    && value.errors.length === 0
    && Array.isArray(value.messages);
}

function parseTimestamp(value) {
  if (!RFC3339_PATTERN.test(value || "")) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function evaluateRecoveryCreationResponse(response) {
  let envelope;
  try {
    envelope = strictResponseBody(response);
  } catch {
    return Object.freeze({ valid: false, tokenId: null, credentials: null });
  }
  const result = envelope?.result;
  const resultObject = result && typeof result === "object" && !Array.isArray(result);
  const tokenId = response.status === 200
    && validCloudflareEnvelope(envelope)
    && resultObject
    && result.name === CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_NAME
    && RESOURCE_ID_PATTERN.test(result.id || "")
    ? result.id
    : null;
  const createdAt = resultObject ? parseTimestamp(result.created_at) : null;
  const expiresAt = resultObject ? parseTimestamp(result.expires_at) : null;
  if (tokenId === null
    || result.duration !== CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_DURATION
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
  try {
    const envelope = strictResponseBody(response);
    return validCloudflareEnvelope(envelope)
      && envelope.result
      && typeof envelope.result === "object"
      && !Array.isArray(envelope.result)
      && envelope.result.id === tokenId;
  } catch {
    return false;
  }
}

async function compensateRecoveryCreation({ transport, accountId, apiToken, tokenId }) {
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

function recoveryOwnershipTag(control) {
  return `${OWNERSHIP_TAG_PREFIX}${createHash("sha256")
    .update(control.oneShotAuthorizationNonce, "utf8")
    .update("\0", "utf8")
    .update(control.authorizedTree, "utf8")
    .digest("hex")}`;
}

function rollbackRecoveryPair(keychain, attemptedKeys, ownershipTag) {
  let failed = false;
  for (const key of [...new Set(attemptedKeys)].reverse()) {
    try {
      keychain.deleteOwnedItem(key, ownershipTag);
    } catch {
      failed = true;
    }
  }
  try {
    if (keychain.hasItem("smokeClientId") || keychain.hasItem("smokeClientSecret")) failed = true;
  } catch {
    failed = true;
  }
  if (failed) throw recoveryOutcomeError("LIVE_STATE_FAILED", CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_MANUAL_REVIEW);
}

function storeRecoveryPair(keychain, credentials, ownershipTag) {
  const attemptedKeys = [];
  try {
    attemptedKeys.push("smokeClientId");
    if (keychain.addItem("smokeClientId", credentials.clientId, ownershipTag)?.created !== true) {
      throw new Error("storage_failed");
    }
    attemptedKeys.push("smokeClientSecret");
    if (keychain.addItem("smokeClientSecret", credentials.clientSecret, ownershipTag)?.created !== true) {
      throw new Error("storage_failed");
    }
    if (!keychain.hasItem("smokeClientId") || !keychain.hasItem("smokeClientSecret")) {
      throw new Error("storage_failed");
    }
  } catch {
    rollbackRecoveryPair(keychain, attemptedKeys, ownershipTag);
    throw recoveryOutcomeError("LIVE_STATE_FAILED", CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_MANUAL_REVIEW);
  }
}

export async function provisionFounderAttendedSuccessorRecoveryTestOnly(options) {
  const {
    confirmation,
    keychain,
    transport,
    clock,
    repositoryReader,
    accountIdSha256Allowlist,
    artifactRoot,
    expectedUid
  } = requireRecoveryComposition(options);

  let accountId = null;
  let apiToken = null;
  try {
    requireRecoveryConfirmation(confirmation);
    requireRecoveryKeychainState(keychain);
    accountId = decodeFounderAttendedRecoveryAccountId(keychain.readItem("governedAccountId"));
    const accountIdSha256 = validateFounderAttendedRecoveryAccountId(
      accountId,
      accountIdSha256Allowlist
    );
    apiToken = decodeFounderAttendedRecoveryApiToken(keychain.readItem("temporaryApiToken"));

    const baseline = sampleRecoveryLiveState(clock, repositoryReader);
    const consumed = consumeFounderAttendedSuccessorRecoveryControl({
      artifactRoot,
      now: baseline.sampledAt,
      expectedCommit: baseline.repositoryIdentity.commit,
      expectedTree: baseline.repositoryIdentity.tree,
      expectedAccountIdSha256: accountIdSha256,
      expectedUid
    });
    const control = consumed.control;
    let lastSample = revalidateRecoveryLiveState({
      clock,
      repositoryReader,
      previousSampledAt: baseline.sampledAt,
      control,
      accountIdSha256
    });

    await listFounderAttendedExactServiceTokenNameGetOnly({
      transport,
      accountId,
      apiToken,
      accountIdSha256Allowlist,
      beforeRequest() {
        lastSample = revalidateRecoveryLiveState({
          clock,
          repositoryReader,
          previousSampledAt: lastSample.sampledAt,
          control,
          accountIdSha256
        });
      }
    });

    revalidateRecoveryLiveState({
      clock,
      repositoryReader,
      previousSampledAt: lastSample.sampledAt,
      control,
      accountIdSha256
    });

    const createBody = JSON.stringify(CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CREATE_BODY);
    let createResponse;
    try {
      createResponse = await transport.request(Object.freeze({
        method: "POST",
        url: fixedCollectionUrl(accountId),
        headers: fixedHeaders(apiToken, createBody),
        body: createBody
      }));
    } catch {
      throw recoveryOutcomeError(
        "NETWORK_FAILED",
        CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_MANUAL_REVIEW
      );
    }

    const evaluation = evaluateRecoveryCreationResponse(createResponse);
    if (!evaluation.valid) {
      const compensated = evaluation.tokenId
        ? await compensateRecoveryCreation({ transport, accountId, apiToken, tokenId: evaluation.tokenId })
        : false;
      throw recoveryOutcomeError(
        "RESPONSE_CONTRACT_MISMATCH",
        compensated
          ? CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_COMPENSATED
          : CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_MANUAL_REVIEW
      );
    }

    let storageError = null;
    try {
      storeRecoveryPair(keychain, evaluation.credentials, recoveryOwnershipTag(control));
    } catch (error) {
      storageError = error;
    } finally {
      evaluation.credentials.clientId.fill(0);
      evaluation.credentials.clientSecret.fill(0);
    }
    if (storageError) {
      const compensated = await compensateRecoveryCreation({
        transport,
        accountId,
        apiToken,
        tokenId: evaluation.tokenId
      });
      throw recoveryOutcomeError(
        "LIVE_STATE_FAILED",
        compensated
          ? CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_COMPENSATED
          : CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_MANUAL_REVIEW
      );
    }

    return Object.freeze({
      status: "provisioned",
      recoveryOutcome: "SUCCESS",
      remoteCreateAttempts: 1,
      controlConsumed: true,
      temporaryTokenPreserved: true
    });
  } catch (error) {
    if (error?.recoveryOutcome) throw error;
    throw cloudflareFounderAttendedRecoveryClassificationError(
      classifyCloudflareFounderAttendedRecoveryError(error)
    );
  } finally {
    accountId = null;
    apiToken = null;
  }
}
