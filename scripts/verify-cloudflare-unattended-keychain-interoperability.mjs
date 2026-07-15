#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  scanTextForCloudflareSecrets
} from "./check-cloudflare-unattended-secret-presence.mjs";
import {
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS,
  CLOUDFLARE_UNATTENDED_KEYCHAIN_REASONS
} from "./lib/cloudflare-unattended-keychain.mjs";
import {
  CLOUDFLARE_UNATTENDED_KEYCHAIN_REMEDIATION_PHRASE,
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ROLLBACK_PHRASE
} from "./lib/cloudflare-unattended-keychain-interoperability.mjs";

const root = resolve(import.meta.dirname, "..");
const contractPath = "workers/infrastructure/cloudflare-unattended-keychain-interoperability-v1.json";
const implementationPaths = Object.freeze([
  "scripts/lib/cloudflare-unattended-keychain.mjs",
  "scripts/lib/cloudflare-unattended-keychain-interoperability.mjs",
  "scripts/helpers/cloudflare-unattended-keychain-acl.swift",
  "scripts/run-cloudflare-unattended-keychain-interoperability.mjs",
  "scripts/verify-cloudflare-unattended-keychain-interoperability.mjs",
  "tests/cloudflare-unattended-keychain-interoperability.test.mjs",
  "docs/cloudflare-unattended-keychain-interoperability-v1.md",
  contractPath
]);

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

const contract = JSON.parse(read(contractPath));
const classifier = read("scripts/lib/cloudflare-unattended-keychain.mjs");
const workflow = read("scripts/lib/cloudflare-unattended-keychain-interoperability.mjs");
const helper = read("scripts/helpers/cloudflare-unattended-keychain-acl.swift");
const command = read("scripts/run-cloudflare-unattended-keychain-interoperability.mjs");
const launcher = read("scripts/lib/cloudflare-unattended-launcher.mjs");
const documentation = read("docs/cloudflare-unattended-keychain-interoperability-v1.md");

assert.equal(contract.contractVersion, "cloudflare-unattended-keychain-interoperability-v1");
assert.equal(contract.batchId, "BATCH-20260715-008");
assert.equal(contract.implementationOwner, "Prometheus Infrastructure");
assert.equal(contract.verificationOwner, "Prometheus Overwatch");
assert.equal(contract.scope.cloudflareContactAllowed, false);
assert.equal(contract.scope.deploymentAllowed, false);
assert.equal(contract.scope.productionMutationAllowed, false);
assert.equal(contract.scope.accessPolicyMutationAllowed, false);
assert.equal(contract.scope.credentialValueMutationAllowed, false);
assert.equal(contract.scope.credentialValueOutputAllowed, false);
assert.equal(contract.scope.unattendedDeploymentControlState, "OFF_UNCONSUMED");
assert.equal(contract.scope.prospectiveCollectionState, "OFF");
assert.equal(contract.scope.activeCohorts, 0);
assert.equal(contract.scope.recommendationInfluenceState, "OFF");

assert.deepEqual(contract.governedItems, CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS.map(item => ({
  alias: item.alias,
  service: item.service,
  account: item.account
})));
assert.deepEqual(contract.noninteractiveClassifier.fixedReasons, CLOUDFLARE_UNATTENDED_KEYCHAIN_REASONS);
assert.equal(contract.noninteractiveClassifier.fixedExecutable, "/usr/bin/security");
assert.equal(contract.noninteractiveClassifier.arbitraryItemArgumentsAllowed, false);
assert.equal(contract.noninteractiveClassifier.boundedProcessMemoryOnly, true);
assert.equal(contract.noninteractiveClassifier.capturedValueImmediatelyDiscarded, true);
assert.equal(contract.noninteractiveClassifier.credentialValuesInOutput, false);
assert.equal(contract.noninteractiveClassifier.credentialMetadataInOutput, false);

assert.equal(
  contract.founderAttendedRemediation.fixedConfirmationPhrase,
  CLOUDFLARE_UNATTENDED_KEYCHAIN_REMEDIATION_PHRASE
);
assert.equal(contract.founderAttendedRemediation.nativeControllingTtyRequired, true);
assert.equal(contract.founderAttendedRemediation.freshClassificationRequired, true);
assert.equal(contract.founderAttendedRemediation.classificationConsumedBeforeAclChange, true);
assert.equal(contract.founderAttendedRemediation.fixedTrustedExecutable, "/usr/bin/security");
assert.equal(contract.founderAttendedRemediation.decryptAclOnly, true);
assert.equal(contract.founderAttendedRemediation.wholeKeychainAclChangeAllowed, false);
assert.equal(contract.founderAttendedRemediation.arbitraryItemOrPathAllowed, false);
assert.equal(contract.founderAttendedRemediation.valuesReadOrRewrittenByAclHelper, false);
assert.equal(contract.founderAttendedRemediation.partialFailureRollback, true);
assert.equal(contract.founderAttendedRemediation.postChangeNoninteractiveVerificationRequired, true);

assert.equal(contract.evidence.directoryMode, "0700");
assert.equal(contract.evidence.fileMode, "0600");
assert.equal(contract.evidence.appendOnly, true);
assert.equal(contract.evidence.exclusiveCreate, true);
assert.equal(contract.evidence.symlinkAllowed, false);
assert.equal(contract.evidence.crossAttemptSubstitutionAllowed, false);
assert.equal(contract.evidence.containsCredentialValues, false);
assert.equal(contract.evidence.containsCredentialHashesPrefixesOrLengths, false);
assert.equal(contract.rollback.fixedConfirmationPhrase, CLOUDFLARE_UNATTENDED_KEYCHAIN_ROLLBACK_PHRASE);
assert.equal(contract.rollback.removesOnlyTrustAddedByThisRepair, true);
assert.equal(contract.rollback.credentialValueTouched, false);

assert.match(launcher, /from "\.\/cloudflare-unattended-keychain\.mjs"/u);
assert.doesNotMatch(launcher, /find-generic-password/u);
assert.match(classifier, /CLOUDFLARE_UNATTENDED_KEYCHAIN_EXECUTABLE = "\/usr\/bin\/security"/u);
assert.match(classifier, /result\.stdout\.fill\(0\)/u);
assert.match(classifier, /result\.stderr\.fill\(0\)/u);
assert.match(classifier, /maxBuffer: MAX_VALUE_BYTES/u);
assert.match(workflow, /classification_consumption/u);
assert.match(workflow, /kind: "remediation_plan"/u);
assert.match(workflow, /rollbackAliases\(added, acl, writePhase\)/u);
assert.match(command, /createControllingTtyConfirmation\(\)/u);
assert.match(helper, /SecKeychainFindGenericPassword/u);
assert.match(helper, /nil,\s*nil,\s*&reference/su);
assert.match(helper, /kSecACLAuthorizationDecrypt/u);
assert.match(helper, /trustedExecutable = "\/usr\/bin\/security"/u);
assert.doesNotMatch(helper, /SecKeychainItemModifyContent|SecItemUpdate|SecItemDelete|SecItemAdd/u);
assert.doesNotMatch(workflow, /node:https|fetch\(|wrangler|deploy|CF-Access-Client/u);
assert.doesNotMatch(command, /node:https|fetch\(|wrangler|deploy/u);

assert.match(documentation, /Unattended deployment control: `OFF` and unconsumed/u);
assert.match(documentation, /Prospective collection: `OFF`/u);
assert.match(documentation, /Recommendation influence: `OFF`/u);
assert.match(documentation, /never requests password data/u);
assert.match(documentation, /removes only `\/usr\/bin\/security` trust entries recorded as newly added/u);

for (const path of implementationPaths) {
  assert.deepEqual(scanTextForCloudflareSecrets(read(path), path), []);
}

const swift = spawnSync(
  "/usr/bin/swiftc",
  ["-typecheck", "scripts/helpers/cloudflare-unattended-keychain-acl.swift"],
  { cwd: root, stdio: ["ignore", "ignore", "ignore"] }
);
assert.equal(swift.status, 0);

process.stdout.write(`${JSON.stringify({
  contractVersion: contract.contractVersion,
  implementationOwner: contract.implementationOwner,
  fixedItemCount: contract.governedItems.length,
  sharedLauncherIdentity: true,
  secretScan: "passed",
  swiftTypecheck: "passed",
  cloudflareContacted: false,
  keychainValuesRead: false,
  deploymentPerformed: false,
  productionMutated: false,
  result: "passed"
}, null, 2)}\n`);
