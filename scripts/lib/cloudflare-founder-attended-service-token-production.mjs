import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

import {
  CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_PATH,
  readFounderAttendedRepositoryIdentity
} from "./cloudflare-founder-attended-control.mjs";
import {
  createFounderAttendedMacOsKeychain,
  formatFounderAttendedKeychainPresence
} from "./cloudflare-founder-attended-keychain.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256_ALLOWLIST,
  CLOUDFLARE_FOUNDER_ATTENDED_COMPENSATED_ERROR,
  CLOUDFLARE_FOUNDER_ATTENDED_MANUAL_REVIEW_ERROR,
  cleanupFounderAttendedTemporaryTokenTestOnly,
  createFounderAttendedCloudflareTransport,
  inspectFounderAttendedPresenceTestOnly,
  provisionFounderAttendedServiceTokenTestOnly
} from "./cloudflare-founder-attended-service-token.mjs";
import { createControllingTtyConfirmation } from "./cloudflare-founder-attended-tty.mjs";

const root = resolve(import.meta.dirname, "../..");

export const CLOUDFLARE_FOUNDER_ATTENDED_COMMANDS = Object.freeze([
  "presence",
  "provision-attended",
  "cleanup-temp"
]);

function currentUid() {
  return typeof process.getuid === "function" ? process.getuid() : null;
}

export async function provisionFounderAttendedServiceToken() {
  return provisionFounderAttendedServiceTokenTestOnly({
    controlPath: CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_PATH,
    confirmation: createControllingTtyConfirmation(),
    keychain: createFounderAttendedMacOsKeychain(),
    transport: createFounderAttendedCloudflareTransport(),
    clock: () => new Date(),
    repositoryReader: () => readFounderAttendedRepositoryIdentity({ root }),
    accountIdSha256Allowlist: CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256_ALLOWLIST,
    randomBytesImpl: randomBytes,
    expectedUid: currentUid()
  });
}

export function inspectFounderAttendedPresence() {
  return inspectFounderAttendedPresenceTestOnly({
    keychain: createFounderAttendedMacOsKeychain()
  });
}

export function cleanupFounderAttendedTemporaryToken() {
  return cleanupFounderAttendedTemporaryTokenTestOnly({
    confirmation: createControllingTtyConfirmation(),
    keychain: createFounderAttendedMacOsKeychain()
  });
}

async function runProductionCommand() {
  const argv = process.argv.slice(2);
  if (argv.length !== 1 || !CLOUDFLARE_FOUNDER_ATTENDED_COMMANDS.includes(argv[0])) {
    throw new Error("founder_attended_command_invalid");
  }
  const [command] = argv;
  if (command === "presence") {
    console.log(formatFounderAttendedKeychainPresence(inspectFounderAttendedPresence()));
    return;
  }
  if (command === "provision-attended") {
    await provisionFounderAttendedServiceToken();
    console.log("Fixed 720-hour Access service token provisioned directly to Keychain.");
    return;
  }
  const result = cleanupFounderAttendedTemporaryToken();
  console.log("Temporary provisioning Keychain item removed.");
  console.log(result.nextRequiredAction);
}

export async function runFounderAttendedServiceTokenProductionCli() {
  try {
    await runProductionCommand();
  } catch (error) {
    if (error?.message === CLOUDFLARE_FOUNDER_ATTENDED_MANUAL_REVIEW_ERROR) {
      console.error("Founder-attended provisioning stopped. Manual review is required.");
    } else if (error?.message === CLOUDFLARE_FOUNDER_ATTENDED_COMPENSATED_ERROR) {
      console.error("Founder-attended provisioning failed closed after confirmed compensation.");
    } else {
      console.error("Founder-attended Cloudflare operation failed closed.");
    }
    process.exitCode = 1;
  }
}
