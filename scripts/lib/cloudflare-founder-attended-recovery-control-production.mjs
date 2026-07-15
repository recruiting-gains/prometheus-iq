import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

import { readFounderAttendedRepositoryIdentity } from "./cloudflare-founder-attended-control.mjs";
import {
  classifyCloudflareFounderAttendedRecoveryError,
  createFounderAttendedReadOnlyKeychainFacade
} from "./cloudflare-founder-attended-get-only-diagnostic.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_ACCOUNT_ALLOWLIST
} from "./cloudflare-founder-attended-get-only-recovery-constants.mjs";
import { createFounderAttendedMacOsKeychain } from "./cloudflare-founder-attended-keychain.mjs";
import {
  prepareFounderAttendedRecoveryControlTestOnly
} from "./cloudflare-founder-attended-recovery-control-command.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_DIRECTORY,
  currentFounderAttendedRecoveryUid
} from "./cloudflare-founder-attended-recovery-control.mjs";
import { createControllingTtyConfirmation } from "./cloudflare-founder-attended-tty.mjs";

const root = resolve(import.meta.dirname, "../..");

export function prepareFounderAttendedRecoveryControl() {
  return prepareFounderAttendedRecoveryControlTestOnly({
    confirmation: createControllingTtyConfirmation(),
    keychain: createFounderAttendedReadOnlyKeychainFacade(
      createFounderAttendedMacOsKeychain()
    ),
    clock: () => new Date(),
    repositoryReader: () => readFounderAttendedRepositoryIdentity({ root }),
    accountIdSha256Allowlist: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_ACCOUNT_ALLOWLIST,
    artifactRoot: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_DIRECTORY,
    randomBytesImpl: randomBytes,
    expectedUid: currentFounderAttendedRecoveryUid()
  });
}

export function runFounderAttendedRecoveryControlProductionCli() {
  try {
    if (process.argv.slice(2).length !== 0) throw new Error("LIVE_STATE_FAILED");
    const result = prepareFounderAttendedRecoveryControl();
    console.log(result.classification);
  } catch (error) {
    console.error(classifyCloudflareFounderAttendedRecoveryError(error));
    process.exitCode = 1;
  }
}
