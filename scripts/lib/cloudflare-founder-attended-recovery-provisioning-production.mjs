import { resolve } from "node:path";

import { readFounderAttendedRepositoryIdentity } from "./cloudflare-founder-attended-control.mjs";
import {
  classifyCloudflareFounderAttendedRecoveryError
} from "./cloudflare-founder-attended-get-only-diagnostic.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_ACCOUNT_ALLOWLIST
} from "./cloudflare-founder-attended-get-only-recovery-constants.mjs";
import { createFounderAttendedMacOsKeychain } from "./cloudflare-founder-attended-keychain.mjs";
import {
  createFounderAttendedCloudflareTransport
} from "./cloudflare-founder-attended-service-token.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_DIRECTORY,
  currentFounderAttendedRecoveryUid
} from "./cloudflare-founder-attended-recovery-control.mjs";
import {
  provisionFounderAttendedSuccessorRecoveryTestOnly
} from "./cloudflare-founder-attended-recovery-provisioning.mjs";
import { createControllingTtyConfirmation } from "./cloudflare-founder-attended-tty.mjs";

const root = resolve(import.meta.dirname, "../..");

export async function provisionFounderAttendedSuccessorRecovery() {
  return provisionFounderAttendedSuccessorRecoveryTestOnly({
    confirmation: createControllingTtyConfirmation(),
    keychain: createFounderAttendedMacOsKeychain(),
    transport: createFounderAttendedCloudflareTransport(),
    clock: () => new Date(),
    repositoryReader: () => readFounderAttendedRepositoryIdentity({ root }),
    accountIdSha256Allowlist: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_ACCOUNT_ALLOWLIST,
    artifactRoot: CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_DIRECTORY,
    expectedUid: currentFounderAttendedRecoveryUid()
  });
}

export async function runFounderAttendedSuccessorRecoveryProductionCli() {
  try {
    if (process.argv.slice(2).length !== 0) throw new Error("LIVE_STATE_FAILED");
    await provisionFounderAttendedSuccessorRecovery();
  } catch (error) {
    console.error(classifyCloudflareFounderAttendedRecoveryError(error));
    process.exitCode = 1;
  }
}
