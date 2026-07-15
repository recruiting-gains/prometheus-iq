import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

import { readFounderAttendedRepositoryIdentity } from "./lib/cloudflare-founder-attended-control.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_DIRECTORY,
  currentFounderAttendedCreateReceiptV2Uid
} from "./lib/cloudflare-founder-attended-create-receipt-v2-artifacts.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_ACCOUNT_ALLOWLIST
} from "./lib/cloudflare-founder-attended-create-receipt-v2-constants.mjs";
import {
  createFounderAttendedGetOnlyCloudflareTransport
} from "./lib/cloudflare-founder-attended-get-only-diagnostic.mjs";
import { createFounderAttendedMacOsKeychain } from "./lib/cloudflare-founder-attended-keychain.mjs";
import {
  diagnoseFounderAttendedResponseContractAbsenceTestOnly
} from "./lib/cloudflare-founder-attended-response-contract-workflow.mjs";
import { createControllingTtyConfirmation } from "./lib/cloudflare-founder-attended-tty.mjs";

const root = resolve(import.meta.dirname, "..");

async function run() {
  if (process.argv.slice(2).length !== 0) throw new Error("argument_denied");
  const result = await diagnoseFounderAttendedResponseContractAbsenceTestOnly({
    confirmation: createControllingTtyConfirmation(),
    keychain: createFounderAttendedMacOsKeychain(),
    transport: createFounderAttendedGetOnlyCloudflareTransport(),
    clock: () => new Date(),
    repositoryReader: () => readFounderAttendedRepositoryIdentity({ root }),
    accountIdSha256Allowlist:
      CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_ACCOUNT_ALLOWLIST,
    artifactRoot: CLOUDFLARE_FOUNDER_ATTENDED_CREATE_RECEIPT_V2_DIRECTORY,
    randomBytesImpl: randomBytes,
    expectedUid: currentFounderAttendedCreateReceiptV2Uid()
  });
  console.log(result.outcome);
}

try {
  await run();
} catch {
  console.error("MANUAL_REVIEW");
  process.exitCode = 1;
}
