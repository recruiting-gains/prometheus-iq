import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

import { readFounderAttendedRepositoryIdentity } from "./cloudflare-founder-attended-control.mjs";
import {
  diagnoseFounderAttendedServiceTokenGetOnlyTestOnly
} from "./cloudflare-founder-attended-get-only-diagnostic-command.mjs";
import {
  classifyCloudflareFounderAttendedRecoveryError,
  createFounderAttendedGetOnlyCloudflareTransport,
  createFounderAttendedReadOnlyKeychainFacade
} from "./cloudflare-founder-attended-get-only-diagnostic.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_ACCOUNT_ALLOWLIST
} from "./cloudflare-founder-attended-get-only-recovery-constants.mjs";
import { createFounderAttendedMacOsKeychain } from "./cloudflare-founder-attended-keychain.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_DIRECTORY,
  currentFounderAttendedRecoveryUid
} from "./cloudflare-founder-attended-recovery-control.mjs";
import { createControllingTtyConfirmation } from "./cloudflare-founder-attended-tty.mjs";

const root = resolve(import.meta.dirname, "../..");

export async function diagnoseFounderAttendedServiceTokenGetOnly() {
  return diagnoseFounderAttendedServiceTokenGetOnlyTestOnly({
    confirmation: createControllingTtyConfirmation(),
    keychain: createFounderAttendedReadOnlyKeychainFacade(
      createFounderAttendedMacOsKeychain()
    ),
    transport: createFounderAttendedGetOnlyCloudflareTransport(),
    clock: () => new Date(),
    repositoryReader: () => readFounderAttendedRepositoryIdentity({ root }),
    accountIdSha256Allowlist: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_ACCOUNT_ALLOWLIST,
    artifactRoot: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_DIRECTORY,
    randomBytesImpl: randomBytes,
    expectedUid: currentFounderAttendedRecoveryUid()
  });
}

export async function runFounderAttendedGetOnlyDiagnosticProductionCli() {
  try {
    if (process.argv.slice(2).length !== 0) throw new Error("LIVE_STATE_FAILED");
    const result = await diagnoseFounderAttendedServiceTokenGetOnly();
    for (const classification of result.classifications) console.log(classification);
  } catch (error) {
    console.error(classifyCloudflareFounderAttendedRecoveryError(error));
    process.exitCode = 1;
  }
}
