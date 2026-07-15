import { createHash, timingSafeEqual } from "node:crypto";
import { request as httpsRequest } from "node:https";

import {
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_ACCOUNT_ALLOWLIST,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_API_ORIGIN,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_API_PATH_TEMPLATE,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CLASSIFICATIONS,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_MAX_PAGES,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_PER_PAGE,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_REQUEST_TIMEOUT_MS,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_RESPONSE_MAX_BYTES,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_NAME
} from "./cloudflare-founder-attended-get-only-recovery-constants.mjs";
import { parseStrictJson } from "./strict-json.mjs";

const ACCOUNT_ID_PATTERN = /^[0-9a-f]{32}$/u;
const API_TOKEN_PATTERN = /^[\x21-\x7e]{20,4096}$/u;
const REPOSITORY_OBJECT_PATTERN = /^[0-9a-f]{40}$/u;
const GET_ONLY_METHOD = "GET";

export function cloudflareFounderAttendedRecoveryClassificationError(classification) {
  const selected = CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CLASSIFICATIONS.includes(classification)
    ? classification
    : "LIVE_STATE_FAILED";
  return new Error(selected);
}

export function classifyCloudflareFounderAttendedRecoveryError(error) {
  return CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CLASSIFICATIONS.includes(error?.message)
    ? error.message
    : "LIVE_STATE_FAILED";
}

function constantTimeAllowlistedAccountDigest(accountId, allowlist) {
  const actual = createHash("sha256").update(accountId, "utf8").digest();
  try {
    for (const allowed of allowlist) {
      if (!/^[0-9a-f]{64}$/u.test(allowed || "")) {
        throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
      }
      const expected = Buffer.from(allowed, "hex");
      try {
        if (timingSafeEqual(actual, expected)) return allowed;
      } finally {
        expected.fill(0);
      }
    }
  } finally {
    actual.fill(0);
  }
  throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
}

export function validateFounderAttendedRecoveryAccountId(
  accountId,
  allowlist = CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_ACCOUNT_ALLOWLIST
) {
  if (!ACCOUNT_ID_PATTERN.test(accountId || "")
    || !Array.isArray(allowlist)
    || allowlist.length !== 1) {
    throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
  }
  return constantTimeAllowlistedAccountDigest(accountId, allowlist);
}

export function decodeFounderAttendedRecoveryKeychainValue(buffer, pattern, classification) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw cloudflareFounderAttendedRecoveryClassificationError(classification);
  }
  const value = buffer.toString("utf8");
  const roundTrip = Buffer.from(value, "utf8");
  const valid = roundTrip.equals(buffer) && pattern.test(value);
  roundTrip.fill(0);
  buffer.fill(0);
  if (!valid) throw cloudflareFounderAttendedRecoveryClassificationError(classification);
  return value;
}

export function decodeFounderAttendedRecoveryAccountId(buffer) {
  return decodeFounderAttendedRecoveryKeychainValue(
    buffer,
    ACCOUNT_ID_PATTERN,
    "LIVE_STATE_FAILED"
  );
}

export function decodeFounderAttendedRecoveryApiToken(buffer) {
  return decodeFounderAttendedRecoveryKeychainValue(
    buffer,
    API_TOKEN_PATTERN,
    "LIVE_STATE_FAILED"
  );
}

function exactListUrl(accountId, page) {
  if (!Number.isSafeInteger(page)
    || page < 1
    || page > CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_MAX_PAGES) {
    throw cloudflareFounderAttendedRecoveryClassificationError("RESPONSE_CONTRACT_MISMATCH");
  }
  const url = new URL(CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_API_ORIGIN);
  url.pathname = CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_API_PATH_TEMPLATE.replace(
    "{account_id}",
    accountId
  );
  url.searchParams.set("name", CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_NAME);
  url.searchParams.set("page", String(page));
  url.searchParams.set(
    "per_page",
    String(CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_PER_PAGE)
  );
  return url;
}

function exactGetHeaders(apiToken) {
  return Object.freeze({
    Accept: "application/json",
    Authorization: `Bearer ${apiToken}`,
    Connection: "close",
    "User-Agent": "prometheus-founder-attended-get-only-recovery-v1"
  });
}

function sameKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  return actual.length === required.length
    && actual.every((key, index) => key === required[index]);
}

function assertGetOnlySpecification(specification) {
  if (!specification
    || typeof specification !== "object"
    || specification.method !== GET_ONLY_METHOD
    || specification.body !== null
    || !(specification.url instanceof URL)
    || specification.url.origin !== CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_API_ORIGIN
    || !sameKeys(specification.headers, [
      "Accept",
      "Authorization",
      "Connection",
      "User-Agent"
    ])) {
    throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
  }

  const pathPattern = CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_API_PATH_TEMPLATE.replace(
    "{account_id}",
    "([0-9a-f]{32})"
  );
  const pathMatch = specification.url.pathname.match(new RegExp(`^${pathPattern}$`, "u"));
  const queryKeys = [...specification.url.searchParams.keys()];
  const page = Number(specification.url.searchParams.get("page"));
  if (!pathMatch
    || queryKeys.join("\0") !== "name\0page\0per_page"
    || specification.url.searchParams.getAll("name").length !== 1
    || specification.url.searchParams.get("name")
      !== CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_NAME
    || !Number.isSafeInteger(page)
    || page < 1
    || page > CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_MAX_PAGES
    || specification.url.searchParams.get("per_page")
      !== String(CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_PER_PAGE)
    || specification.headers.Accept !== "application/json"
    || !/^Bearer [\x21-\x7e]{20,4096}$/u.test(specification.headers.Authorization || "")
    || specification.headers.Connection !== "close"
    || specification.headers["User-Agent"]
      !== "prometheus-founder-attended-get-only-recovery-v1") {
    throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
  }
  validateFounderAttendedRecoveryAccountId(pathMatch[1]);
}

export function createFounderAttendedGetOnlyCloudflareTransport({
  requestImpl = httpsRequest
} = {}) {
  return Object.freeze({
    request(specification) {
      assertGetOnlySpecification(specification);
      return new Promise((resolveResponse, rejectResponse) => {
        let settled = false;
        const rejectGeneric = () => {
          if (settled) return;
          settled = true;
          rejectResponse(cloudflareFounderAttendedRecoveryClassificationError("NETWORK_FAILED"));
        };
        let request;
        try {
          request = requestImpl(specification.url, {
            method: GET_ONLY_METHOD,
            headers: specification.headers,
            agent: false,
            timeout: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_REQUEST_TIMEOUT_MS
          }, response => {
            const chunks = [];
            let byteCount = 0;
            const clearChunks = () => {
              for (const chunk of chunks) chunk.fill(0);
              chunks.length = 0;
            };
            response.on("data", chunk => {
              if (settled) return;
              const buffer = Buffer.isBuffer(chunk) ? Buffer.from(chunk) : Buffer.from(chunk);
              byteCount += buffer.length;
              if (byteCount > CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_RESPONSE_MAX_BYTES) {
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
        request.end();
      });
    }
  });
}

function strictResponseEnvelope(response) {
  if (!response || !Number.isInteger(response.status)) {
    throw cloudflareFounderAttendedRecoveryClassificationError("RESPONSE_CONTRACT_MISMATCH");
  }
  if ([401, 403].includes(response.status)) {
    if (Buffer.isBuffer(response.body)) response.body.fill(0);
    throw cloudflareFounderAttendedRecoveryClassificationError("AUTHORIZATION_DENIED");
  }
  if (response.status !== 200) {
    if (Buffer.isBuffer(response.body)) response.body.fill(0);
    throw cloudflareFounderAttendedRecoveryClassificationError("RESPONSE_CONTRACT_MISMATCH");
  }
  const original = Buffer.isBuffer(response.body) ? response.body : null;
  const body = original
    ? Buffer.from(original)
    : Buffer.from(typeof response.body === "string" ? response.body : "", "utf8");
  try {
    if (!body.length
      || body.length > CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_RESPONSE_MAX_BYTES) {
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

function optionalNonnegativeInteger(value, key, source) {
  if (!Object.hasOwn(source, key)) return null;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw cloudflareFounderAttendedRecoveryClassificationError("RESPONSE_CONTRACT_MISMATCH");
  }
  return value;
}

function rejectResponseContractMismatch() {
  throw cloudflareFounderAttendedRecoveryClassificationError("RESPONSE_CONTRACT_MISMATCH");
}

function validateKnownPagination({
  count,
  cumulativeCount,
  requestedPage,
  totalCount,
  totalPages
}) {
  if (totalCount !== null) {
    // Cloudflare documents total_count as the inventory size without search
    // parameters. It bounds filtered results but is not their expected count.
    if (totalCount < cumulativeCount) rejectResponseContractMismatch();
  }

  if (totalPages === null) return;
  if (totalPages > CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_MAX_PAGES
    || (totalPages === 0 && (requestedPage !== 1 || count !== 0))
    || (totalPages > 0 && requestedPage > totalPages)
    || (requestedPage < totalPages
      && count !== CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_PER_PAGE)
    || (totalPages > 1 && requestedPage === totalPages && count === 0)) {
    rejectResponseContractMismatch();
  }
}

function parseResultPage(response, requestedPage) {
  const envelope = strictResponseEnvelope(response);
  if (!envelope
    || typeof envelope !== "object"
    || Array.isArray(envelope)
    || envelope.success !== true
    || !Array.isArray(envelope.errors)
    || envelope.errors.length !== 0
    || !Array.isArray(envelope.messages)) {
    throw cloudflareFounderAttendedRecoveryClassificationError("RESPONSE_CONTRACT_MISMATCH");
  }

  const result = Object.hasOwn(envelope, "result") ? envelope.result : [];
  if (!Array.isArray(result)
    || result.length > CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_PER_PAGE) {
    throw cloudflareFounderAttendedRecoveryClassificationError("RESPONSE_CONTRACT_MISMATCH");
  }
  for (const entry of result) {
    if (!entry
      || typeof entry !== "object"
      || Array.isArray(entry)
      || typeof entry.name !== "string") {
      throw cloudflareFounderAttendedRecoveryClassificationError("RESPONSE_CONTRACT_MISMATCH");
    }
    if (entry.name === CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_SERVICE_TOKEN_NAME) {
      throw cloudflareFounderAttendedRecoveryClassificationError("DUPLICATE_FOUND");
    }
  }

  if (!Object.hasOwn(envelope, "result_info")) {
    return Object.freeze({
      count: result.length,
      totalCount: null,
      totalPages: null
    });
  }
  const info = envelope.result_info;
  if (!info || typeof info !== "object" || Array.isArray(info)) {
    throw cloudflareFounderAttendedRecoveryClassificationError("RESPONSE_CONTRACT_MISMATCH");
  }
  const count = optionalNonnegativeInteger(info.count, "count", info);
  const totalCount = optionalNonnegativeInteger(info.total_count, "total_count", info);
  const page = optionalNonnegativeInteger(info.page, "page", info);
  const perPage = optionalNonnegativeInteger(info.per_page, "per_page", info);
  const totalPages = optionalNonnegativeInteger(info.total_pages, "total_pages", info);
  if ((count !== null && count !== result.length)
    || (page !== null && page !== requestedPage)
    || (perPage !== null
      && perPage !== CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_PER_PAGE)) {
    rejectResponseContractMismatch();
  }
  return Object.freeze({
    count: result.length,
    totalCount,
    totalPages
  });
}

function fixedGetSpecification(accountId, apiToken, page) {
  return Object.freeze({
    method: GET_ONLY_METHOD,
    url: exactListUrl(accountId, page),
    headers: exactGetHeaders(apiToken),
    body: null
  });
}

export async function listFounderAttendedExactServiceTokenNameGetOnly({
  transport,
  accountId,
  apiToken,
  accountIdSha256Allowlist = CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_ACCOUNT_ALLOWLIST,
  beforeRequest = () => {}
}) {
  if (!transport || typeof transport.request !== "function" || typeof beforeRequest !== "function") {
    throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
  }
  validateFounderAttendedRecoveryAccountId(accountId, accountIdSha256Allowlist);
  if (!API_TOKEN_PATTERN.test(apiToken || "")) {
    throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
  }

  let page = 1;
  let totalEntries = 0;
  let declaredTotalCount = null;
  let declaredTotalPages = null;
  while (page <= CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_MAX_PAGES) {
    await beforeRequest(page);
    let response;
    try {
      response = await transport.request(fixedGetSpecification(accountId, apiToken, page));
    } catch (error) {
      const classification = CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CLASSIFICATIONS.includes(
        error?.message
      )
        ? error.message
        : "NETWORK_FAILED";
      throw cloudflareFounderAttendedRecoveryClassificationError(
        ["AUTHORIZATION_DENIED", "LIVE_STATE_FAILED"].includes(classification)
          ? classification
          : "NETWORK_FAILED"
      );
    }
    const parsed = parseResultPage(response, page);
    totalEntries += parsed.count;
    if (parsed.totalCount !== null) {
      if (declaredTotalCount !== null && declaredTotalCount !== parsed.totalCount) {
        rejectResponseContractMismatch();
      }
      declaredTotalCount = parsed.totalCount;
    }
    if (parsed.totalPages !== null) {
      if (declaredTotalPages !== null && declaredTotalPages !== parsed.totalPages) {
        rejectResponseContractMismatch();
      }
      declaredTotalPages = parsed.totalPages;
    }

    validateKnownPagination({
      count: parsed.count,
      cumulativeCount: totalEntries,
      requestedPage: page,
      totalCount: declaredTotalCount,
      totalPages: declaredTotalPages
    });
    const currentPageIsFull = parsed.count
      === CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_PER_PAGE;
    const hasNext = currentPageIsFull && (
      (declaredTotalPages !== null && page < declaredTotalPages)
      || (declaredTotalPages === null
        && declaredTotalCount !== null
        && totalEntries < declaredTotalCount)
    );
    if (!hasNext) {
      if (currentPageIsFull
        && declaredTotalCount === null
        && declaredTotalPages === null) {
        rejectResponseContractMismatch();
      }
      const classifications = totalEntries === 0
        ? ["VALID_EMPTY_RESULT", "SAFE_TO_PREPARE_RECOVERY"]
        : ["SAFE_TO_PREPARE_RECOVERY"];
      return Object.freeze({
        classifications: Object.freeze(classifications),
        exactNameAbsent: true,
        validEmptyResult: totalEntries === 0
      });
    }
    if (page === CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_MAX_PAGES) {
      rejectResponseContractMismatch();
    }
    page += 1;
  }
  throw cloudflareFounderAttendedRecoveryClassificationError("RESPONSE_CONTRACT_MISMATCH");
}

export function validFounderAttendedRecoveryRepositoryIdentity(identity) {
  return identity
    && identity.clean === true
    && REPOSITORY_OBJECT_PATTERN.test(identity.commit || "")
    && REPOSITORY_OBJECT_PATTERN.test(identity.tree || "");
}

export function createFounderAttendedReadOnlyKeychainFacade(keychain) {
  if (!keychain
    || typeof keychain.hasItem !== "function"
    || typeof keychain.readItem !== "function") {
    throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
  }
  return Object.freeze({
    hasItem: key => keychain.hasItem(key),
    readItem: key => keychain.readItem(key)
  });
}
