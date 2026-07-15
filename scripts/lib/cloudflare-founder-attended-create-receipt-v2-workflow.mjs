import { createHash } from "node:crypto";

import {
  appendFounderAttendedCreateReceiptV2Reason
} from "./cloudflare-founder-attended-create-receipt-v2-artifacts.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_ACCOUNT_ALLOWLIST,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_API_ORIGIN,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_API_PATH_TEMPLATE,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_CONFIRMATIONS,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_CREATE_BODY,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_REASON_CODES,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_DURATION,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_NAME
} from "./cloudflare-founder-attended-create-receipt-v2-constants.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_MAX_PAGES,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_PER_PAGE
} from "./cloudflare-founder-attended-get-only-recovery-constants.mjs";
import {
  classifyCloudflareFounderAttendedRecoveryError,
  decodeFounderAttendedRecoveryAccountId,
  decodeFounderAttendedRecoveryApiToken,
  listFounderAttendedExactServiceTokenNameGetOnly,
  validFounderAttendedRecoveryRepositoryIdentity,
  validateFounderAttendedRecoveryAccountId
} from "./cloudflare-founder-attended-get-only-diagnostic.mjs";
import {
  appendFounderAttendedResponseContractPhase,
  consumeFounderAttendedResponseContractSuccessorControl
} from "./cloudflare-founder-attended-response-contract-artifacts.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONFIRMATIONS
} from "./cloudflare-founder-attended-response-contract-constants.mjs";
import {
  evaluateFounderAttendedDeleteResponseTestOnly
} from "./cloudflare-founder-attended-response-contract-workflow.mjs";
import { parseStrictJson } from "./strict-json.mjs";

const RESOURCE_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/u;
const CLIENT_ID_PATTERN =
  /^[0-9a-f]{32,64}\.access(?:\.(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)*[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)?$/u;
const CLIENT_SECRET_PATTERN = /^[A-Za-z0-9._~-]{16,4096}$/u;
const RFC3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const DOCUMENTED_TIMESTAMP_FIELDS = Object.freeze([
  "created_at",
  "updated_at",
  "expires_at",
  "last_seen_at",
  "previous_client_secret_expires_at"
]);
const OWNERSHIP_TAG_PREFIX = "prometheus-founder-attended-v1:";

function workflowError() {
  return new Error("founder_attended_create_receipt_v2_denied");
}

function fixedReasonCode(reasonCode) {
  if (!CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_REASON_CODES.includes(reasonCode)) {
    throw workflowError();
  }
  return reasonCode;
}

function requireComposition(options) {
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
    && options.artifactRoot !== ""
    && Number.isSafeInteger(options.expectedUid)
    && options.expectedUid >= 0;
  if (!valid) throw workflowError();
  return options;
}

function requireConfirmation(confirmation, action, confirmations) {
  let accepted = false;
  try {
    accepted = confirmation.confirm(action, confirmations[action]) === true;
  } catch {
    throw workflowError();
  }
  if (!accepted) throw workflowError();
}

function keychainReady(keychain) {
  try {
    return keychain.hasItem("temporaryApiToken")
      && keychain.hasItem("governedAccountId")
      && !keychain.hasItem("smokeClientId")
      && !keychain.hasItem("smokeClientSecret");
  } catch {
    return false;
  }
}

function readGovernedInputs(keychain, allowlist) {
  try {
    const accountId = decodeFounderAttendedRecoveryAccountId(
      keychain.readItem("governedAccountId")
    );
    validateFounderAttendedRecoveryAccountId(accountId, allowlist);
    const apiToken = decodeFounderAttendedRecoveryApiToken(
      keychain.readItem("temporaryApiToken")
    );
    return Object.freeze({ accountId, apiToken });
  } catch {
    throw workflowError();
  }
}

function liveState(clock, repositoryReader) {
  try {
    const now = clock();
    const repositoryIdentity = repositoryReader();
    if (!(now instanceof Date)
      || !Number.isFinite(now.getTime())
      || !validFounderAttendedRecoveryRepositoryIdentity(repositoryIdentity)) throw workflowError();
    return Object.freeze({
      now: new Date(now.getTime()),
      repositoryIdentity: Object.freeze({ ...repositoryIdentity })
    });
  } catch {
    throw workflowError();
  }
}

function collectionUrl(accountId) {
  const url = new URL(CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_API_ORIGIN);
  url.pathname = CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_API_PATH_TEMPLATE.replace(
    "{account_id}",
    accountId
  );
  return url;
}

function exactNameUrl(accountId, page) {
  if (!Number.isSafeInteger(page)
    || page < 1
    || page > CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_MAX_PAGES) throw workflowError();
  const url = collectionUrl(accountId);
  url.searchParams.set("name", CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_NAME);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_PER_PAGE));
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
    "User-Agent": "prometheus-founder-attended-create-receipt-v2"
  });
}

function getHeaders(apiToken) {
  return Object.freeze({
    Accept: "application/json",
    Authorization: `Bearer ${apiToken}`,
    Connection: "close",
    "User-Agent": "prometheus-founder-attended-create-receipt-v2"
  });
}

function parseResponseBody(response) {
  const original = Buffer.isBuffer(response?.body) ? response.body : null;
  const bytes = original
    ? Buffer.from(original)
    : Buffer.from(typeof response?.body === "string" ? response.body : "", "utf8");
  try {
    return parseStrictJson(bytes.toString("utf8"));
  } catch {
    return null;
  } finally {
    bytes.fill(0);
    if (original) original.fill(0);
  }
}

function validTimestamp(value) {
  return typeof value === "string"
    && RFC3339_PATTERN.test(value)
    && Number.isFinite(Date.parse(value));
}

function timestampsValid(result) {
  return DOCUMENTED_TIMESTAMP_FIELDS.every(field => (
    !Object.hasOwn(result, field) || validTimestamp(result[field])
  ));
}

function createEvaluation(reasonCode, {
  proofCandidateTokenId = null,
  credentials = null,
  accepted = false,
  httpStatusClass = "NON_2XX",
  httpStatusReasonCode = "CREATE_HTTP_STATUS_NON_2XX"
} = {}) {
  return Object.freeze({
    accepted,
    reasonCode: fixedReasonCode(reasonCode),
    proofCandidateTokenId,
    credentials,
    httpStatusClass,
    httpStatusReasonCode: fixedReasonCode(httpStatusReasonCode)
  });
}

function classifyCreateHttpStatus(status) {
  if (!Number.isSafeInteger(status) || status < 100 || status > 599) {
    return Object.freeze({
      successCompatible: false,
      httpStatusClass: "NON_2XX",
      httpStatusReasonCode: "CREATE_HTTP_STATUS_NON_2XX"
    });
  }
  if (status === 200) {
    return Object.freeze({
      successCompatible: true,
      httpStatusClass: "DOCUMENTED_200",
      httpStatusReasonCode: "CREATE_HTTP_STATUS_DOCUMENTED_200"
    });
  }
  if (status >= 200 && status < 300) {
    return Object.freeze({
      successCompatible: true,
      httpStatusClass: "ALTERNATE_2XX",
      httpStatusReasonCode: "CREATE_HTTP_STATUS_ALTERNATE_2XX"
    });
  }
  return Object.freeze({
    successCompatible: false,
    httpStatusClass: "NON_2XX",
    httpStatusReasonCode: "CREATE_HTTP_STATUS_NON_2XX"
  });
}

function evaluateCreateResponse(response) {
  const status = classifyCreateHttpStatus(response?.status);
  if (!status.successCompatible) {
    if (Buffer.isBuffer(response?.body)) response.body.fill(0);
    return createEvaluation("CREATE_HTTP_STATUS_REJECTED", status);
  }
  const envelope = parseResponseBody(response);
  if (!envelope) return createEvaluation("CREATE_BODY_REJECTED", status);
  if (typeof envelope !== "object"
    || Array.isArray(envelope)
    || envelope.success !== true
    || (Object.hasOwn(envelope, "errors") && !Array.isArray(envelope.errors))
    || (Object.hasOwn(envelope, "messages") && !Array.isArray(envelope.messages))) {
    return createEvaluation("CREATE_ENVELOPE_REJECTED", status);
  }
  if (Array.isArray(envelope.errors) && envelope.errors.length !== 0) {
    return createEvaluation("CREATE_ERRORS_REPORTED", status);
  }
  const result = envelope.result;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return createEvaluation("CREATE_RESULT_REJECTED", status);
  }
  if (!Object.hasOwn(result, "id")) {
    return createEvaluation("CREATE_RESOURCE_ID_MISSING", status);
  }
  if (!RESOURCE_ID_PATTERN.test(result.id)) {
    return createEvaluation("CREATE_RESOURCE_ID_REJECTED", status);
  }
  const proofCandidateTokenId = result.id;
  if (Object.hasOwn(result, "name")
    && result.name !== CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_NAME) {
    return createEvaluation("CREATE_NAME_ECHO_MISMATCH", status);
  }
  if (Object.hasOwn(result, "duration")
    && result.duration !== CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_DURATION) {
    return createEvaluation("CREATE_DURATION_ECHO_MISMATCH", status);
  }
  if (!Object.hasOwn(result, "client_id") || result.client_id === "") {
    return createEvaluation("CREATE_CLIENT_ID_MISSING", { ...status, proofCandidateTokenId });
  }
  if (!CLIENT_ID_PATTERN.test(result.client_id)) {
    return createEvaluation("CREATE_CLIENT_ID_REJECTED", { ...status, proofCandidateTokenId });
  }
  if (!Object.hasOwn(result, "client_secret") || result.client_secret === "") {
    return createEvaluation("CREATE_CLIENT_SECRET_MISSING", { ...status, proofCandidateTokenId });
  }
  if (!CLIENT_SECRET_PATTERN.test(result.client_secret)) {
    return createEvaluation("CREATE_CLIENT_SECRET_REJECTED", { ...status, proofCandidateTokenId });
  }
  if (!timestampsValid(result)) {
    return createEvaluation("CREATE_TIMESTAMP_REJECTED", { ...status, proofCandidateTokenId });
  }
  return createEvaluation("CREATE_RESPONSE_ACCEPTED", {
    accepted: true,
    ...status,
    proofCandidateTokenId,
    credentials: Object.freeze({
      clientId: Buffer.from(result.client_id, "utf8"),
      clientSecret: Buffer.from(result.client_secret, "utf8")
    })
  });
}

export function classifyFounderAttendedCreateReceiptV2ResponseTestOnly(response) {
  const evaluation = evaluateCreateResponse(response);
  try {
    return Object.freeze({
      accepted: evaluation.accepted,
      reasonCode: evaluation.reasonCode,
      httpStatusClass: evaluation.httpStatusClass,
      compensationCandidate: evaluation.proofCandidateTokenId !== null,
      exactNameProofRequired: evaluation.proofCandidateTokenId !== null
    });
  } finally {
    evaluation.credentials?.clientId.fill(0);
    evaluation.credentials?.clientSecret.fill(0);
  }
}

function optionalInteger(source, key) {
  if (!Object.hasOwn(source, key)) return null;
  return Number.isSafeInteger(source[key]) && source[key] >= 0 ? source[key] : Number.NaN;
}

function parseExactNamePage(response, requestedPage, expectedTokenId) {
  if (!response || response.status !== 200) {
    if (Buffer.isBuffer(response?.body)) response.body.fill(0);
    throw workflowError();
  }
  const envelope = parseResponseBody(response);
  if (!envelope
    || typeof envelope !== "object"
    || Array.isArray(envelope)
    || envelope.success !== true
    || (Object.hasOwn(envelope, "errors")
      && (!Array.isArray(envelope.errors) || envelope.errors.length !== 0))
    || (Object.hasOwn(envelope, "messages") && !Array.isArray(envelope.messages))) {
    throw workflowError();
  }
  const result = Object.hasOwn(envelope, "result") ? envelope.result : [];
  if (!Array.isArray(result)
    || result.length > CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_PER_PAGE) throw workflowError();
  let expectedMatches = 0;
  for (const entry of result) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)
      || entry.name !== CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_NAME
      || !RESOURCE_ID_PATTERN.test(entry.id || "")
      || typeof entry.duration !== "string") {
      throw workflowError();
    }
    if (entry.id === expectedTokenId
      && entry.duration === CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_DURATION) {
      expectedMatches += 1;
    }
  }
  const info = Object.hasOwn(envelope, "result_info") ? envelope.result_info : null;
  if (info !== null && (!info || typeof info !== "object" || Array.isArray(info))) {
    throw workflowError();
  }
  const count = info === null ? null : optionalInteger(info, "count");
  const page = info === null ? null : optionalInteger(info, "page");
  const perPage = info === null ? null : optionalInteger(info, "per_page");
  const totalPages = info === null ? null : optionalInteger(info, "total_pages");
  if ([count, page, perPage, totalPages].some(Number.isNaN)
    || (count !== null && count !== result.length)
    || (page !== null && page !== requestedPage)
    || (perPage !== null && perPage !== CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_PER_PAGE)
    || (totalPages !== null
      && (totalPages > CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_MAX_PAGES
        || (totalPages === 0 && (requestedPage !== 1 || result.length !== 0))
        || (totalPages > 0 && requestedPage > totalPages)
        || (requestedPage < totalPages
          && result.length !== CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_PER_PAGE)
        || (totalPages > 1 && requestedPage === totalPages && result.length === 0)))) {
    throw workflowError();
  }
  return Object.freeze({
    count: result.length,
    exactNamePresent: result.length > 0,
    expectedMatches,
    totalPages
  });
}

async function proveExactCreatedResource({ transport, accountId, apiToken, expectedTokenId }) {
  let page = 1;
  let exactNamePresent = false;
  let totalEntries = 0;
  let expectedMatches = 0;
  let declaredTotalPages = null;
  try {
    while (page <= CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_MAX_PAGES) {
      const response = await transport.request(Object.freeze({
        method: "GET",
        url: exactNameUrl(accountId, page),
        headers: getHeaders(apiToken),
        body: null
      }));
      const parsed = parseExactNamePage(response, page, expectedTokenId);
      exactNamePresent ||= parsed.exactNamePresent;
      totalEntries += parsed.count;
      expectedMatches += parsed.expectedMatches;
      if (parsed.totalPages !== null) {
        if (declaredTotalPages !== null && declaredTotalPages !== parsed.totalPages) {
          throw workflowError();
        }
        declaredTotalPages = parsed.totalPages;
      }
      const fullPage = parsed.count === CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_PER_PAGE;
      const hasNext = fullPage
        && declaredTotalPages !== null
        && page < declaredTotalPages;
      if (!hasNext) {
        if (fullPage && declaredTotalPages === null) throw workflowError();
        return Object.freeze({
          completed: true,
          exactNamePresent,
          proven: totalEntries === 1 && expectedMatches === 1
        });
      }
      page += 1;
    }
  } catch {
    return Object.freeze({ completed: false, exactNamePresent: false, proven: false });
  }
  return Object.freeze({ completed: false, exactNamePresent: false, proven: false });
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
      throw workflowError();
    }
    attempted.push("smokeClientSecret");
    if (keychain.addItem("smokeClientSecret", credentials.clientSecret, tag)?.created !== true) {
      throw workflowError();
    }
    if (!keychain.hasItem("smokeClientId") || !keychain.hasItem("smokeClientSecret")) {
      throw workflowError();
    }
    return Object.freeze({ stored: true, rollbackComplete: true });
  } catch {
    return Object.freeze({
      stored: false,
      rollbackComplete: rollbackPair(keychain, attempted, tag)
    });
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

function reasonWriter(artifactRoot, attemptId, expectedUid) {
  return reasonCode => appendFounderAttendedCreateReceiptV2Reason({
    artifactRoot,
    attemptId,
    reasonCode,
    expectedUid
  });
}

async function exactNameAbsent({ transport, accountId, apiToken, accountIdSha256Allowlist }) {
  try {
    await listFounderAttendedExactServiceTokenNameGetOnly({
      transport,
      accountId,
      apiToken,
      accountIdSha256Allowlist
    });
    return Object.freeze({ completed: true, absent: true });
  } catch (error) {
    if (classifyCloudflareFounderAttendedRecoveryError(error) === "DUPLICATE_FOUND") {
      return Object.freeze({ completed: true, absent: false });
    }
    return Object.freeze({ completed: false, absent: false });
  }
}

async function compensateCreatedResource({
  composed,
  governed,
  tokenId,
  phase,
  reason,
  localRollbackComplete
}) {
  try {
    requireConfirmation(
      composed.confirmation,
      "compensate-v2-created-resource",
      CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_CONFIRMATIONS
    );
  } catch {
    reason("COMPENSATION_AUTHORIZATION_DENIED");
    phase("MANUAL_REVIEW");
    return Object.freeze({ outcome: "MANUAL_REVIEW", remoteDeleteAttempts: 0 });
  }
  phase("DELETE_ATTEMPTED");
  let response;
  try {
    response = await composed.transport.request(Object.freeze({
      method: "DELETE",
      url: tokenUrl(governed.accountId, tokenId),
      headers: headers(governed.apiToken, null),
      body: null
    }));
  } catch {
    reason("COMPENSATION_TRANSPORT_AMBIGUOUS");
    phase("DELETE_NOT_CONFIRMED");
    phase("MANUAL_REVIEW");
    return Object.freeze({ outcome: "MANUAL_REVIEW", remoteDeleteAttempts: 1 });
  }
  if (!evaluateFounderAttendedDeleteResponseTestOnly(response, tokenId)) {
    reason("COMPENSATION_RESPONSE_REJECTED");
    phase("DELETE_NOT_CONFIRMED");
    phase("MANUAL_REVIEW");
    return Object.freeze({ outcome: "MANUAL_REVIEW", remoteDeleteAttempts: 1 });
  }
  const absence = await exactNameAbsent({
    transport: composed.transport,
    accountId: governed.accountId,
    apiToken: governed.apiToken,
    accountIdSha256Allowlist: composed.accountIdSha256Allowlist
  });
  if (absence.completed) {
    phase("GET_COMPLETED");
    phase(absence.absent ? "EXACT_NAME_ABSENT" : "EXACT_NAME_PRESENT");
  }
  if (!absence.completed || !absence.absent) {
    reason("COMPENSATION_ABSENCE_UNPROVEN");
    phase("DELETE_NOT_CONFIRMED");
    phase("MANUAL_REVIEW");
    return Object.freeze({ outcome: "MANUAL_REVIEW", remoteDeleteAttempts: 1 });
  }
  reason("COMPENSATION_CONFIRMED");
  phase("DELETE_CONFIRMED");
  if (!localRollbackComplete) {
    reason("KEYCHAIN_ROLLBACK_REJECTED");
    phase("MANUAL_REVIEW");
    return Object.freeze({ outcome: "MANUAL_REVIEW", remoteDeleteAttempts: 1 });
  }
  phase("COMPENSATED");
  return Object.freeze({ outcome: "COMPENSATED", remoteDeleteAttempts: 1 });
}

export async function provisionFounderAttendedCreateReceiptV2TestOnly(options) {
  const composed = requireComposition(options);
  requireConfirmation(
    composed.confirmation,
    "provision-fresh-successor",
    CLOUDFLARE_FOUNDER_ATTENDED_RESPONSE_CONTRACT_CONFIRMATIONS
  );
  if (!keychainReady(composed.keychain)) throw workflowError();
  const governed = readGovernedInputs(
    composed.keychain,
    composed.accountIdSha256Allowlist
  );
  const state = liveState(composed.clock, composed.repositoryReader);
  const consumed = consumeFounderAttendedResponseContractSuccessorControl({
    artifactRoot: composed.artifactRoot,
    now: state.now,
    repositoryIdentity: state.repositoryIdentity,
    expectedUid: composed.expectedUid
  });
  const phase = phaseWriter(consumed.attemptRoot, consumed.control, composed.expectedUid);
  const reason = reasonWriter(consumed.attemptRoot, consumed.attemptId, composed.expectedUid);

  const preflight = await exactNameAbsent({
    transport: composed.transport,
    accountId: governed.accountId,
    apiToken: governed.apiToken,
    accountIdSha256Allowlist: composed.accountIdSha256Allowlist
  });
  if (!preflight.completed) {
    reason("PREFLIGHT_REJECTED");
    phase("MANUAL_REVIEW");
    return Object.freeze({
      outcome: "MANUAL_REVIEW",
      reasonCode: "PREFLIGHT_REJECTED",
      remoteCreateAttempts: 0,
      remoteDeleteAttempts: 0
    });
  }
  phase("GET_COMPLETED");
  phase(preflight.absent ? "EXACT_NAME_ABSENT" : "EXACT_NAME_PRESENT");
  if (!preflight.absent) {
    reason("DUPLICATE_NAME_REJECTED");
    phase("MANUAL_REVIEW");
    return Object.freeze({
      outcome: "MANUAL_REVIEW",
      reasonCode: "DUPLICATE_NAME_REJECTED",
      remoteCreateAttempts: 0,
      remoteDeleteAttempts: 0
    });
  }

  const current = liveState(composed.clock, composed.repositoryReader);
  if (current.repositoryIdentity.commit !== consumed.control.authorizedCommit
    || current.repositoryIdentity.tree !== consumed.control.authorizedTree) {
    reason("PREFLIGHT_REJECTED");
    phase("MANUAL_REVIEW");
    return Object.freeze({
      outcome: "MANUAL_REVIEW",
      reasonCode: "PREFLIGHT_REJECTED",
      remoteCreateAttempts: 0,
      remoteDeleteAttempts: 0
    });
  }

  const createBody = JSON.stringify(CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_CREATE_BODY);
  phase("POST_ATTEMPTED");
  let response;
  try {
    response = await composed.transport.request(Object.freeze({
      method: "POST",
      url: collectionUrl(governed.accountId),
      headers: headers(governed.apiToken, createBody),
      body: createBody
    }));
  } catch {
    reason("CREATE_TRANSPORT_AMBIGUOUS");
    phase("CREATE_RESPONSE_INVALID");
    phase("KEYCHAIN_NOT_STORED");
    phase("MANUAL_REVIEW");
    return Object.freeze({
      outcome: "MANUAL_REVIEW",
      reasonCode: "CREATE_TRANSPORT_AMBIGUOUS",
      remoteCreateAttempts: 1,
      remoteDeleteAttempts: 0
    });
  }

  const evaluation = evaluateCreateResponse(response);
  reason(evaluation.httpStatusReasonCode);
  if (!evaluation.accepted) reason(evaluation.reasonCode);
  if (evaluation.proofCandidateTokenId === null) {
    phase("CREATE_RESPONSE_INVALID");
    phase("KEYCHAIN_NOT_STORED");
    phase("MANUAL_REVIEW");
    return Object.freeze({
      outcome: "MANUAL_REVIEW",
      reasonCode: evaluation.reasonCode,
      remoteCreateAttempts: 1,
      remoteDeleteAttempts: 0
    });
  }

  const proof = await proveExactCreatedResource({
    transport: composed.transport,
    accountId: governed.accountId,
    apiToken: governed.apiToken,
    expectedTokenId: evaluation.proofCandidateTokenId
  });
  if (proof.completed) {
    phase("GET_COMPLETED");
    phase(proof.exactNamePresent ? "EXACT_NAME_PRESENT" : "EXACT_NAME_ABSENT");
  }
  if (!proof.proven) {
    evaluation.credentials?.clientId.fill(0);
    evaluation.credentials?.clientSecret.fill(0);
    reason("CREATE_EXACT_NAME_PROOF_REJECTED");
    phase("CREATE_RESPONSE_INVALID");
    phase("KEYCHAIN_NOT_STORED");
    phase("MANUAL_REVIEW");
    return Object.freeze({
      outcome: "MANUAL_REVIEW",
      reasonCode: "CREATE_EXACT_NAME_PROOF_REJECTED",
      remoteCreateAttempts: 1,
      remoteDeleteAttempts: 0
    });
  }

  if (!evaluation.accepted) {
    phase("CREATE_RESPONSE_INVALID");
    phase("KEYCHAIN_NOT_STORED");
    const compensation = await compensateCreatedResource({
      composed,
      governed,
      tokenId: evaluation.proofCandidateTokenId,
      phase,
      reason,
      localRollbackComplete: true
    });
    return Object.freeze({
      outcome: compensation.outcome,
      reasonCode: evaluation.reasonCode,
      remoteCreateAttempts: 1,
      remoteDeleteAttempts: compensation.remoteDeleteAttempts
    });
  }

  reason("CREATE_RESPONSE_ACCEPTED");
  phase("CREATE_RESPONSE_VALID");
  let storage;
  try {
    storage = storePair(
      composed.keychain,
      evaluation.credentials,
      ownershipTag(consumed.control)
    );
  } finally {
    evaluation.credentials.clientId.fill(0);
    evaluation.credentials.clientSecret.fill(0);
  }
  if (storage.stored) {
    phase("KEYCHAIN_STORED");
    phase("SUCCESS");
    return Object.freeze({
      outcome: "SUCCESS",
      reasonCode: "CREATE_RESPONSE_ACCEPTED",
      remoteCreateAttempts: 1,
      remoteDeleteAttempts: 0
    });
  }

  reason("KEYCHAIN_STORAGE_REJECTED");
  phase("KEYCHAIN_NOT_STORED");
  const compensation = await compensateCreatedResource({
    composed,
    governed,
    tokenId: evaluation.proofCandidateTokenId,
    phase,
    reason,
    localRollbackComplete: storage.rollbackComplete
  });
  return Object.freeze({
    outcome: compensation.outcome,
    reasonCode: "KEYCHAIN_STORAGE_REJECTED",
    remoteCreateAttempts: 1,
    remoteDeleteAttempts: compensation.remoteDeleteAttempts
  });
}

export const CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_DEFAULT_ALLOWLIST =
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_ACCOUNT_ALLOWLIST;
