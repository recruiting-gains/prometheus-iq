#!/usr/bin/env node

import {
  formatCloudflareUnattendedKeychainClassification
} from "./lib/cloudflare-unattended-keychain.mjs";
import {
  recordCloudflareUnattendedKeychainClassification,
  remediateCloudflareUnattendedKeychain,
  rollbackCloudflareUnattendedKeychainRemediation
} from "./lib/cloudflare-unattended-keychain-interoperability.mjs";
import {
  createControllingTtyConfirmation
} from "./lib/cloudflare-founder-attended-tty.mjs";

function run(argv = process.argv.slice(2)) {
  if (argv.length !== 1 || !["classify", "remediate", "rollback"].includes(argv[0])) {
    throw new Error("interoperability_operation_invalid");
  }
  if (argv[0] === "classify") {
    const result = recordCloudflareUnattendedKeychainClassification();
    process.stdout.write(`${formatCloudflareUnattendedKeychainClassification(result)}\n`);
    return result.status === "PASS" ? 0 : 1;
  }
  if (argv[0] === "remediate") {
    const result = remediateCloudflareUnattendedKeychain({
      confirmation: createControllingTtyConfirmation()
    });
    process.stdout.write(`${result.status}\n`);
    return result.status === "PASS" ? 0 : 1;
  }
  const result = rollbackCloudflareUnattendedKeychainRemediation({
    confirmation: createControllingTtyConfirmation()
  });
  process.stdout.write(`${result.status}\n`);
  return result.status === "PASS" ? 0 : 1;
}

try {
  process.exitCode = run();
} catch {
  process.stdout.write("FAIL\n");
  process.exitCode = 1;
}
