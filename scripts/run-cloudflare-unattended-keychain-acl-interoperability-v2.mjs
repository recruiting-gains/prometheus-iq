#!/usr/bin/env node

import {
  formatCloudflareUnattendedKeychainClassification
} from "./lib/cloudflare-unattended-keychain.mjs";
import {
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_REMEDIATION_PHRASE,
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_ROLLBACK_PHRASE,
  recordCloudflareUnattendedKeychainAclV2Classification,
  remediateCloudflareUnattendedKeychainAclV2,
  rollbackCloudflareUnattendedKeychainAclV2
} from "./lib/cloudflare-unattended-keychain-acl-interoperability-v2.mjs";
import {
  createControllingTtyConfirmation
} from "./lib/cloudflare-founder-attended-tty.mjs";

function run(argv = process.argv.slice(2)) {
  if (argv.length !== 1 || !["classify", "remediate", "rollback"].includes(argv[0])) {
    throw new Error("acl_v2_operation_invalid");
  }
  if (argv[0] === "classify") {
    const result = recordCloudflareUnattendedKeychainAclV2Classification();
    process.stdout.write(`${formatCloudflareUnattendedKeychainClassification(result)}\n`);
    return result.status === "PASS" ? 0 : 1;
  }
  const confirmation = createControllingTtyConfirmation();
  if (argv[0] === "remediate") {
    const result = remediateCloudflareUnattendedKeychainAclV2({ confirmation });
    process.stdout.write(`${result.status}\n`);
    return result.status === "PASS" ? 0 : 1;
  }
  const result = rollbackCloudflareUnattendedKeychainAclV2({ confirmation });
  process.stdout.write(`${result.status}\n`);
  return result.status === "PASS" ? 0 : 1;
}

try {
  process.exitCode = run();
} catch {
  process.stdout.write("FAIL\n");
  process.exitCode = 1;
}

export {
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_REMEDIATION_PHRASE,
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_ROLLBACK_PHRASE,
  run
};
