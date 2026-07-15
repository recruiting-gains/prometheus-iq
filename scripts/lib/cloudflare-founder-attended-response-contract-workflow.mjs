import { createHash } from "node:crypto";

import {
  appendFounderAttendedResponseContractPhase,
  classifyFounderAttendedResponseContractArtifactError,
  consumeFounderAttendedResponseContractSuccessorControl,
  createFounderAttendedResponseContractAbsenceEvidence,
  prepareFounderAttendedResponseContractSuccessorControl
} from "./cloudflare-founder-attended-response-contract-artifacts.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_ACCOUNT_ALLOWLIST,
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_API_ORIGIN,
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_API_PATH_TEMPLATE,
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONFIRMATIONS,
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CREATE_BODY,
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_RESPONSE_MAX_BYTES,
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_DURATION,
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_NAME
} from "./cloudflare-founder-attended-response-contract-constants.mjs";
import {
  classifyCloudflareFounderAttendedRecoveryError,
  cloudflareFounderAttendedRecoveryClassificationError,
  decodeFounderAttendedRecoveryAccountId,
  decodeFounderAttendedRecoveryApiToken,
  listFounderAttendedExactServiceTokenNameGetOnly,
  validFounderAttendedRecoveryRepositoryIdentity,
  validateFounderAttendedRecoveryAccountId
} from "./cloudflare-founder-attended-get-only-diagnostic.mjs";
import { parseStrictJson } from "./strict-json.mjs";

const CLIENT_ID_PATTERN = /^[0-9a-f]{32,64}\.access(?:\.[A-Za-z0-9.-]+)?$/u;
const CLIENT_SECRET_PATTERN = /^[A-Za-z0-9._~-]{16,4096}$/u;
const RESOURCE_ID_PATTERN = /^[A-Za-z0-9-]{16,128}$/u;
const RFC3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const DOCUMENTED_TIMESTAMP_FIELDS = Object.freeze([
  "created_at",
  "updated_at",
  "expires_at",
  "last_seen_at",
  "previous_client_secret_expires_at"
]);
const OWNERSHIP_TAG_PREFIX = "prometheus-founder-attended-response-contract-v1:";

function workflowError() {
  return cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
}

function requireComposition(options, { transport = false, random = false } = {}) {
  const valid = options
    && typeof options === "object"
    && options.confirmation
    && typeof options.confirmation.confirm === "function"
    && options.keychain
    && typeof options.keychain.hasItem === "function"
    && typeof options.keychain.readItem === "function"
    && typeof options.clock === "function"
    && typeof options.repositoryReader === "function"
    && Array.isArray(options.accountIdSha256Allowlist)
    && options.accountIdSha256Allowlist.length === 1
    && typeof options.artifactRoot === "string"
    && options.artifactRoot.length > 0
    && Number.isSafeInteger(options.expectedUid)
    && options.expectedUid >= 0
    && (!transport || (options.transport && typeof options.transport.request === "function"))
    && (!random || typeof options.randomBytesImpl === "function");
  if (!valid) throw workflowError();
  return options;
}

function requireConfirmation(confirmation, action) {
  let accepted = false;
  try {
    accepted = confirmation.confirm(
      action,
      CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONFIRMATIONS[action]
    ) === true;
  } catch {
    throw workflowError();
  }
  if (!accepted) throw workflowError();
}

function requireKeychainState(keychain, writable = false) {
  const requiredMethods = writable ? ["addItem", "deleteOwnedItem"] : [];
  if (requiredMethods.some(name => typeof keychain[name] !== "function")) throw workflowError();
  try {
    if (!keychain.hasItem("temporaryApiToken")
      || !keychain.hasItem("governedAccountId")
      || keychain.hasItem("smokeClientId")
      || keychain.hasItem("smokeClientSecret")) throw workflowError();
  } catch {
    throw workflowError();
  }
}

function liveState(clock, repositoryReader) {
  try {
    const now = clock();
    const repositoryIdentity = repositoryReader();
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())
      || !validFounderAttendedRecoveryRepositoryIdentity(repositoryIdentity)) throw workflowError();
    return Object.freeze({
      now: new Date(now.getTime()),
      repositoryIdentity: Object.freeze({ ...repositoryIdentity })
    });
  } catch {
    throw workflowError();
  }
}

function readGovernedInputs(keychain, allowlist) {
  let accountId;
  let apiToken;
  try {
    accountId = decodeFounderAttendedRecoveryAccountId(keychain.readItem("governedAccountId"));
    const accountIdSha256 = validateFounderAttendedRecoveryAccountId(accountId, allowlist);
    apiToken = decodeFounderAttendedRecoveryApiToken(keychain.readItem("temporaryApiToken"));
    return Object.freeze({ accountId, accountIdSha256, apiToken });
  } catch {
    accountId = null;
    apiToken = null;
    throw workflowError();
  }
}

function collectionUrl(accountId) {
  const url = new URL(CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_API_ORIGIN);
  url.pathname = CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_API_PATH_TEMPLATE.replace(
    "{account_id}",
    accountId
  );
  return url;
}

function tokenUrl(accountId, tokenId) {
  if (!RESOURCE_ID_PATTERN.test(tokenId || "")) throw workflowError();
  const url = collectionUrl(accountId);
  url.pathname = `${url.pathname}/${tokenId}`;
  return url;
}

function headers(apiToken, body) {
  return Object.freeze({
    Accept: "application/json",
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(body || "", "utf8")),
    Connection: "close",
    "User-Agent": "prometheus-founder-attended-response-contract-repair-v1"
  });
}

function parseResponse(response) {
  if (!response || response.status !== 200) return null;
  const original = Buffer.isBuffer(response.body) ? response.body : null;
  const bytes = original
    ? Buffer.from(original)
    : Buffer.from(typeof response.body === "string" ? response.body : "", "utf8");
  try {
    if (!bytes.length || bytes.length > CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_RESPONSE_MAX_BYTES) {
      return null;
    }
    return parseStrictJson(bytes.toString("utf8"));
  } catch {
    return null;
  } finally {
    bytes.fill(0);
    if (original) original.fill(0);
  }
}

function validEnvelope(value) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && value.success === true
    && (!Object.hasOwn(value, "errors")
      || (Array.isArray(value.errors) && value.errors.length === 0))
    && (!Object.hasOwn(value, "messages") || Array.isArray(value.messages));
}

function validTimestamp(value) {
  if (!RFC3339_PATTERN.test(value || "")) return false;
  return Number.isFinite(Date.parse(value));
}

function documentedTimestampsValid(result) {
  return DOCUMENTED_TIMESTAMP_FIELDS.every(field => (
    !Object.hasOwn(result, field) || validTimestamp(result[field])
  ));
}

export function evaluateFounderAttendedCreateResponseTestOnly(response) {
  const envelope = parseResponse(response);
  const result = envelope?.result;
  const resultObject = result && typeof result === "object" && !Array.isArray(result);
  const compensationTokenId = validEnvelope(envelope)
    && resultObject
    && result.name === CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_NAME
    && RESOURCE_ID_PATTERN.test(result.id || "")
    ? result.id
    : null;
  const valid = validEnvelope(envelope)
    && resultObject
    && compensationTokenId !== null
    && result.duration === CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_DURATION
    && CLIENT_ID_PATTERN.test(result.client_id || "")
    && CLIENT_SECRET_PATTERN.test(result.client_secret || "")
    && documentedTimestampsValid(result);
  if (!valid) return Object.freeze({ valid: false, compensationTokenId, credentials: null });
  return Object.freeze({
    valid: true,
    compensationTokenId,
    credentials: Object.freeze({
      clientId: Buffer.from(result.client_id, "utf8"),
      clientSecret: Buffer.from(result.client_secret, "utf8")
    })
  });
}

export function evaluateFounderAttendedDeleteResponseTestOnly(response, expectedTokenId) {
  const envelope = parseResponse(response);
  const result = envelope?.result;
  if (!validEnvelope(envelope) || !result || typeof result !== "object" || Array.isArray(result)
    || !documentedTimestampsValid(result)
    || (Object.hasOwn(result, "id") && result.id !== expectedTokenId)
    || (Object.hasOwn(result, "name")
      && result.name !== CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_NAME)
    || (Object.hasOwn(result, "duration")
      && result.duration !== CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_SERVICE_TOKEN_DURATION)) {
    return false;
  }
  return true;
}

async function exactNameState({ transport, accountId, apiToken, accountIdSha256Allowlist }) {
  try {
    await listFounderAttendedExactServiceTokenNameGetOnly({
      transport,
      accountId,
      apiToken,
      accountIdSha256Allowlist
    });
    return "EXACT_NAME_ABSENT";
  } catch (error) {
    if (classifyCloudflareFounderAttendedRecoveryError(error) === "DUPLICATE_FOUND") {
      return "EXACT_NAME_PRESENT";
    }
    throw error;
  }
}

function ownershipTag(control) {
  return `${OWNERSHIP_TAG_PREFIX}${createHash("sha256")
    .update(control.oneShotAuthorizationNonce, "utf8")
    .update("\0", "utf8")
    .update(control.authorizedTree, "utf8")
    .digest("hex")}`;
}

function rollbackPair(keychain, attempted, tag) {
  let complete = true;
  for (const key of [...attempted].reverse()) {
    try {
      keychain.deleteOwnedItem(key, tag);
    } catch {
      complete = false;
    }
  }
  try {
    if (keychain.hasItem("smokeClientId") || keychain.hasItem("smokeClientSecret")) complete = false;
  } catch {
    complete = false;
  }
  return complete;
}

function storePair(keychain, credentials, tag) {
  const attempted = [];
  try {
    attempted.push("smokeClientId");
    if (keychain.addItem("smokeClientId", credentials.clientId, tag)?.created !== true) {
      throw new Error("store_failed");
    }
    attempted.push("smokeClientSecret");
    if (keychain.addItem("smokeClientSecret", credentials.clientSecret, tag)?.created !== true) {
      throw new Error("store_failed");
    }
    if (!keychain.hasItem("smokeClientId") || !keychain.hasItem("smokeClientSecret")) {
      throw new Error("store_failed");
    }
    return true;
  } catch {
    rollbackPair(keychain, attempted, tag);
    return false;
  }
}

function phaseWriter(artifactRoot, control, expectedUid) {
  return phase => appendFounderAttendedResponseContractPhase({
    artifactRoot,
    control,
    phase,
    expectedUid
  });
}

async function compensate({
  transport,
  accountId,
  apiToken,
  accountIdSha256Allowlist,
  tokenId,
  phase
}) {
  phase("DELETE_ATTEMPTED");
  let response;
  try {
    response = await transport.request(Object.freeze({
      method: "DELETE",
      url: tokenUrl(accountId, tokenId),
      headers: headers(apiToken, null),
      body: null
    }));
  } catch {
    phase("DELETE_NOT_CONFIRMED");
    phase("MANUAL_REVIEW");
    return "MANUAL_REVIEW";
  }
  const validDelete = evaluateFounderAttendedDeleteResponseTestOnly(response, tokenId);
  let exactName;
  try {
    exactName = await exactNameState({
      transport,
      accountId,
      apiToken,
      accountIdSha256Allowlist
    });
    phase("GET_COMPLETED");
    phase(exactName);
  } catch {
    phase("DELETE_NOT_CONFIRMED");
    phase("MANUAL_REVIEW");
    return "MANUAL_REVIEW";
  }
  if (validDelete && exactName === "EXACT_NAME_ABSENT") {
    phase("DELETE_CONFIRMED");
    phase("COMPENSATED");
    return "COMPENSATED";
  }
  phase("DELETE_NOT_CONFIRMED");
  phase("MANUAL_REVIEW");
  return "MANUAL_REVIEW";
}

export async function diagnoseFounderAttendedResponseContractAbsenceTestOnly(options) {
  const composed = requireComposition(options, { transport: true, random: true });
  requireConfirmation(composed.confirmation, "diagnose-fresh-absence");
  requireKeychainState(composed.keychain);
  const governed = readGovernedInputs(composed.keychain, composed.accountIdSha256Allowlist);
  const state = liveState(composed.clock, composed.repositoryReader);
  const outcome = await exactNameState({
    transport: composed.transport,
    accountId: governed.accountId,
    apiToken: governed.apiToken,
    accountIdSha256Allowlist: composed.accountIdSha256Allowlist
  });
  try {
    createFounderAttendedResponseContractAbsenceEvidence({
      artifactRoot: composed.artifactRoot,
      now: state.now,
      repositoryIdentity: state.repositoryIdentity,
      accountIdSha256: governed.accountIdSha256,
      outcome,
      randomBytesImpl: composed.randomBytesImpl,
      expectedUid: composed.expectedUid
    });
  } catch (error) {
    if (classifyFounderAttendedResponseContractArtifactError(error) === "LOCAL_ARTIFACT_COLLISION") {
      return Object.freeze({ outcome: "LOCAL_ARTIFACT_COLLISION" });
    }
    throw error;
  }
  return Object.freeze({ outcome });
}

export function prepareFounderAttendedResponseContractControlTestOnly(options) {
  const composed = requireComposition(options, { random: true });
  requireConfirmation(composed.confirmation, "prepare-fresh-successor");
  requireKeychainState(composed.keychain);
  readGovernedInputs(composed.keychain, composed.accountIdSha256Allowlist);
  const state = liveState(composed.clock, composed.repositoryReader);
  return prepareFounderAttendedResponseContractSuccessorControl({
    artifactRoot: composed.artifactRoot,
    now: state.now,
    repositoryIdentity: state.repositoryIdentity,
    randomBytesImpl: composed.randomBytesImpl,
    expectedUid: composed.expectedUid
  });
}

export async function provisionFounderAttendedResponseContractSuccessorTestOnly(options) {
  const composed = requireComposition(options, { transport: true });
  requireConfirmation(composed.confirmation, "provision-fresh-successor");
  requireKeychainState(composed.keychain, true);
  const governed = readGovernedInputs(composed.keychain, composed.accountIdSha256Allowlist);
  const state = liveState(composed.clock, composed.repositoryReader);
  const consumed = consumeFounderAttendedResponseContractSuccessorControl({
    artifactRoot: composed.artifactRoot,
    now: state.now,
    repositoryIdentity: state.repositoryIdentity,
    expectedUid: composed.expectedUid
  });
  const phase = phaseWriter(consumed.attemptRoot, consumed.control, composed.expectedUid);

  let exactName;
  try {
    exactName = await exactNameState({
      transport: composed.transport,
      accountId: governed.accountId,
      apiToken: governed.apiToken,
      accountIdSha256Allowlist: composed.accountIdSha256Allowlist
    });
    phase("GET_COMPLETED");
    phase(exactName);
  } catch {
    phase("MANUAL_REVIEW");
    return Object.freeze({ outcome: "MANUAL_REVIEW", remoteCreateAttempts: 0 });
  }
  if (exactName !== "EXACT_NAME_ABSENT") {
    phase("MANUAL_REVIEW");
    return Object.freeze({ outcome: "MANUAL_REVIEW", remoteCreateAttempts: 0 });
  }

  const current = liveState(composed.clock, composed.repositoryReader);
  if (current.repositoryIdentity.commit !== consumed.control.authorizedCommit
    || current.repositoryIdentity.tree !== consumed.control.authorizedTree) {
    phase("MANUAL_REVIEW");
    return Object.freeze({ outcome: "MANUAL_REVIEW", remoteCreateAttempts: 0 });
  }

  const createBody = JSON.stringify(CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CREATE_BODY);
  phase("POST_ATTEMPTED");
  let createResponse;
  try {
    createResponse = await composed.transport.request(Object.freeze({
      method: "POST",
      url: collectionUrl(governed.accountId),
      headers: headers(governed.apiToken, createBody),
      body: createBody
    }));
  } catch {
    phase("CREATE_RESPONSE_INVALID");
    phase("KEYCHAIN_NOT_STORED");
    phase("MANUAL_REVIEW");
    return Object.freeze({ outcome: "MANUAL_REVIEW", remoteCreateAttempts: 1 });
  }

  const evaluation = evaluateFounderAttendedCreateResponseTestOnly(createResponse);
  if (!evaluation.valid) {
    phase("CREATE_RESPONSE_INVALID");
    phase("KEYCHAIN_NOT_STORED");
    const outcome = evaluation.compensationTokenId
      ? await compensate({
        transport: composed.transport,
        accountId: governed.accountId,
        apiToken: governed.apiToken,
        accountIdSha256Allowlist: composed.accountIdSha256Allowlist,
        tokenId: evaluation.compensationTokenId,
        phase
      })
      : "MANUAL_REVIEW";
    if (!evaluation.compensationTokenId) phase("MANUAL_REVIEW");
    return Object.freeze({ outcome, remoteCreateAttempts: 1 });
  }

  phase("CREATE_RESPONSE_VALID");
  let stored = false;
  try {
    stored = storePair(composed.keychain, evaluation.credentials, ownershipTag(consumed.control));
  } finally {
    evaluation.credentials.clientId.fill(0);
    evaluation.credentials.clientSecret.fill(0);
  }
  if (stored) {
    phase("KEYCHAIN_STORED");
    phase("SUCCESS");
    return Object.freeze({ outcome: "SUCCESS", remoteCreateAttempts: 1 });
  }

  phase("KEYCHAIN_NOT_STORED");
  const outcome = await compensate({
    transport: composed.transport,
    accountId: governed.accountId,
    apiToken: governed.apiToken,
    accountIdSha256Allowlist: composed.accountIdSha256Allowlist,
    tokenId: evaluation.compensationTokenId,
    phase
  });
  return Object.freeze({ outcome, remoteCreateAttempts: 1 });
}

export const CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_DEFAULT_ALLOWLIST =
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_ACCOUNT_ALLOWLIST;
