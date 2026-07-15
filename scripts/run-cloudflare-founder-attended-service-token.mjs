import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CLOUDFLARE_FOUNDER_ATTENDED_COMPENSATED_ERROR,
  CLOUDFLARE_FOUNDER_ATTENDED_MANUAL_REVIEW_ERROR,
  cleanupFounderAttendedTemporaryToken,
  inspectFounderAttendedPresence,
  provisionFounderAttendedServiceToken
} from "./lib/cloudflare-founder-attended-service-token.mjs";
import { formatFounderAttendedKeychainPresence } from "./lib/cloudflare-founder-attended-keychain.mjs";
import { createControllingTtyConfirmation } from "./lib/cloudflare-founder-attended-tty.mjs";

export const CLOUDFLARE_FOUNDER_ATTENDED_COMMANDS = Object.freeze([
  "presence",
  "provision-attended",
  "cleanup-temp"
]);

const DEFAULT_OPERATIONS = Object.freeze({
  inspectPresence: inspectFounderAttendedPresence,
  provision: provisionFounderAttendedServiceToken,
  cleanup: cleanupFounderAttendedTemporaryToken
});

export async function runFounderAttendedServiceTokenCli({
  argv = [],
  confirmation = createControllingTtyConfirmation(),
  operations = DEFAULT_OPERATIONS,
  writeOutput = value => console.log(value)
} = {}) {
  if (argv.length !== 1 || !CLOUDFLARE_FOUNDER_ATTENDED_COMMANDS.includes(argv[0])) {
    throw new Error("founder_attended_command_invalid");
  }
  const [command] = argv;
  if (command === "presence") {
    writeOutput(formatFounderAttendedKeychainPresence(operations.inspectPresence()));
    return Object.freeze({ status: "presence_checked" });
  }
  if (command === "provision-attended") {
    const result = await operations.provision({ confirmation });
    writeOutput("Fixed 720-hour Access service token provisioned directly to Keychain.");
    return result;
  }
  const result = operations.cleanup({ confirmation });
  writeOutput("Temporary provisioning Keychain item removed.");
  writeOutput(result.nextRequiredAction);
  return result;
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runFounderAttendedServiceTokenCli({ argv: process.argv.slice(2) }).catch(error => {
    if (error?.message === CLOUDFLARE_FOUNDER_ATTENDED_MANUAL_REVIEW_ERROR) {
      console.error("Founder-attended provisioning stopped. Manual review is required.");
    } else if (error?.message === CLOUDFLARE_FOUNDER_ATTENDED_COMPENSATED_ERROR) {
      console.error("Founder-attended provisioning failed closed after confirmed compensation.");
    } else {
      console.error("Founder-attended Cloudflare operation failed closed.");
    }
    process.exitCode = 1;
  });
}
