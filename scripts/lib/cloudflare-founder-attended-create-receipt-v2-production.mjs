import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

import { readFounderAttendedRepositoryIdentity } from "./cloudflare-founder-attended-control.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_DIRECTORY,
  currentFounderAttendedCreateReceiptV2Uid
} from "./cloudflare-founder-attended-create-receipt-v2-artifacts.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_ACCOUNT_ALLOWLIST,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_API_ORIGIN,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_CREATE_BODY,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_NAME
} from "./cloudflare-founder-attended-create-receipt-v2-constants.mjs";
import {
  provisionFounderAttendedCreateReceiptV2TestOnly
} from "./cloudflare-founder-attended-create-receipt-v2-workflow.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_MAX_PAGES,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_PER_PAGE
} from "./cloudflare-founder-attended-get-only-recovery-constants.mjs";
import { createFounderAttendedMacOsKeychain } from "./cloudflare-founder-attended-keychain.mjs";
import {
  prepareFounderAttendedResponseContractControlTestOnly
} from "./cloudflare-founder-attended-response-contract-workflow.mjs";
import {
  createFounderAttendedCloudflareTransport
} from "./cloudflare-founder-attended-service-token.mjs";
import { createControllingTtyConfirmation } from "./cloudflare-founder-attended-tty.mjs";

const root = resolve(import.meta.dirname, "../..");
const COLLECTION_PATH_PATTERN =
  /^\/client\/v4\/accounts\/[0-9a-f]{32}\/access\/service_tokens$/u;
const TOKEN_PATH_PATTERN =
  /^\/client\/v4\/accounts\/[0-9a-f]{32}\/access\/service_tokens\/[A-Za-z0-9_-]{16,128}$/u;
const AUTHORIZATION_PATTERN = /^Bearer [\x21-\x7e]{20,4096}$/u;

function productionError() {
  return new Error("founder_attended_create_receipt_v2_production_denied");
}

function exactQuery(url) {
  const keys = [...url.searchParams.keys()];
  const page = Number(url.searchParams.get("page"));
  return keys.join("\0") === "name\0page\0per_page"
    && url.searchParams.getAll("name").length === 1
    && url.searchParams.get("name")
      === CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_SERVICE_TOKEN_NAME
    && Number.isSafeInteger(page)
    && page >= 1
    && page <= CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_MAX_PAGES
    && url.searchParams.get("per_page")
      === String(CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_LIST_PER_PAGE);
}

function headersAreBounded(headers) {
  return headers
    && typeof headers === "object"
    && headers.Accept === "application/json"
    && headers.Connection === "close"
    && AUTHORIZATION_PATTERN.test(headers.Authorization || "");
}

function exactHeaderKeys(headers, expected) {
  const actual = Object.keys(headers).sort();
  const required = [...expected].sort();
  return actual.length === required.length
    && actual.every((key, index) => key === required[index]);
}

function assertSpecification(specification, attempts) {
  if (!specification
    || typeof specification !== "object"
    || !(specification.url instanceof URL)
    || specification.url.origin !== CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_API_ORIGIN
    || !headersAreBounded(specification.headers)) throw productionError();

  if (specification.method === "GET") {
    if (!COLLECTION_PATH_PATTERN.test(specification.url.pathname)
      || specification.body !== null
      || !exactQuery(specification.url)
      || !exactHeaderKeys(specification.headers, [
        "Accept", "Authorization", "Connection", "User-Agent"
      ])
      || ![
        "prometheus-founder-attended-get-only-recovery-v1",
        "prometheus-founder-attended-create-receipt-v2"
      ].includes(specification.headers["User-Agent"])) throw productionError();
    return;
  }

  if (specification.method === "POST") {
    attempts.posts += 1;
    const expectedBody = JSON.stringify(
      CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_CREATE_BODY
    );
    if (attempts.posts !== 1
      || !COLLECTION_PATH_PATTERN.test(specification.url.pathname)
      || specification.url.search !== ""
      || specification.body !== expectedBody
      || !exactHeaderKeys(specification.headers, [
        "Accept", "Authorization", "Connection", "Content-Length", "Content-Type", "User-Agent"
      ])
      || specification.headers["Content-Type"] !== "application/json"
      || specification.headers["Content-Length"]
        !== String(Buffer.byteLength(expectedBody, "utf8"))
      || specification.headers["User-Agent"]
        !== "prometheus-founder-attended-create-receipt-v2") throw productionError();
    return;
  }

  if (specification.method === "DELETE") {
    attempts.deletes += 1;
    if (attempts.deletes !== 1
      || !TOKEN_PATH_PATTERN.test(specification.url.pathname)
      || specification.url.search !== ""
      || specification.body !== null
      || !exactHeaderKeys(specification.headers, [
        "Accept", "Authorization", "Connection", "Content-Length", "Content-Type", "User-Agent"
      ])
      || specification.headers["Content-Type"] !== "application/json"
      || specification.headers["Content-Length"] !== "0"
      || specification.headers["User-Agent"]
        !== "prometheus-founder-attended-create-receipt-v2") throw productionError();
    return;
  }

  throw productionError();
}

export function createFounderAttendedCreateReceiptV2ProductionTransport({
  transport = createFounderAttendedCloudflareTransport()
} = {}) {
  if (!transport || typeof transport.request !== "function") throw productionError();
  const attempts = { posts: 0, deletes: 0 };
  return Object.freeze({
    request(specification) {
      assertSpecification(specification, attempts);
      return transport.request(specification);
    }
  });
}

function commonOptions() {
  return Object.freeze({
    confirmation: createControllingTtyConfirmation(),
    keychain: createFounderAttendedMacOsKeychain(),
    clock: () => new Date(),
    repositoryReader: () => readFounderAttendedRepositoryIdentity({ root }),
    accountIdSha256Allowlist:
      CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_ACCOUNT_ALLOWLIST,
    artifactRoot: CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_DIRECTORY,
    expectedUid: currentFounderAttendedCreateReceiptV2Uid()
  });
}

export function prepareFounderAttendedCreateReceiptV2Control() {
  return prepareFounderAttendedResponseContractControlTestOnly({
    ...commonOptions(),
    randomBytesImpl: randomBytes
  });
}

export async function provisionFounderAttendedCreateReceiptV2() {
  return provisionFounderAttendedCreateReceiptV2TestOnly({
    ...commonOptions(),
    transport: createFounderAttendedCreateReceiptV2ProductionTransport()
  });
}

function requireNoArguments() {
  if (process.argv.slice(2).length !== 0) throw productionError();
}

export function runFounderAttendedCreateReceiptV2PreparationCli() {
  try {
    requireNoArguments();
    prepareFounderAttendedCreateReceiptV2Control();
    console.log("SAFE_TO_PREPARE_RECOVERY");
  } catch {
    console.error("MANUAL_REVIEW");
    process.exitCode = 1;
  }
}

export async function runFounderAttendedCreateReceiptV2ProvisioningCli() {
  try {
    requireNoArguments();
    const result = await provisionFounderAttendedCreateReceiptV2();
    console.log(result.outcome);
    if (result.outcome !== "SUCCESS") process.exitCode = 1;
  } catch {
    console.error("MANUAL_REVIEW");
    process.exitCode = 1;
  }
}
