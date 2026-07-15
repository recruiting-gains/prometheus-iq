#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  scanTextForCloudflareSecrets
} from "./check-cloudflare-unattended-secret-presence.mjs";
import {
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS
} from "./lib/cloudflare-unattended-keychain.mjs";
import {
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_ARTIFACT_ROOT,
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_FAILURES,
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_REMEDIATION_PHRASE,
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_ROLLBACK_PHRASE
} from "./lib/cloudflare-unattended-keychain-acl-interoperability-v2.mjs";
import {
  verifyNativeKeychainAclV2
} from "./verify-cloudflare-unattended-keychain-acl-v2-native.mjs";

const root = resolve(import.meta.dirname, "..");
const contractPath =
  "workers/infrastructure/cloudflare-unattended-keychain-acl-interoperability-v2.json";
const implementationPaths = Object.freeze([
  "scripts/helpers/cloudflare-unattended-keychain-acl-v2.swift",
  "scripts/helpers/cloudflare-unattended-keychain-acl-v2-native-fixture.swift",
  "scripts/lib/cloudflare-unattended-keychain-acl-interoperability-v2.mjs",
  "scripts/run-cloudflare-unattended-keychain-acl-interoperability-v2.mjs",
  "scripts/verify-cloudflare-unattended-keychain-acl-v2-native.mjs",
  "scripts/verify-cloudflare-unattended-keychain-acl-interoperability-v2.mjs",
  "tests/cloudflare-unattended-keychain-acl-interoperability-v2.test.mjs",
  "docs/cloudflare-unattended-keychain-acl-interoperability-v2.md",
  contractPath
]);

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

const contract = JSON.parse(read(contractPath));
const helper = read("scripts/helpers/cloudflare-unattended-keychain-acl-v2.swift");
const nativeFixture = read(
  "scripts/helpers/cloudflare-unattended-keychain-acl-v2-native-fixture.swift"
);
const workflow = read(
  "scripts/lib/cloudflare-unattended-keychain-acl-interoperability-v2.mjs"
);
const command = read("scripts/run-cloudflare-unattended-keychain-acl-interoperability-v2.mjs");
const nativeVerifier = read("scripts/verify-cloudflare-unattended-keychain-acl-v2-native.mjs");
const documentation = read("docs/cloudflare-unattended-keychain-acl-interoperability-v2.md");

assert.equal(contract.contractVersion, "cloudflare-unattended-keychain-acl-interoperability-v2");
assert.equal(contract.batchId, "BATCH-20260715-009");
assert.equal(contract.implementationOwner, "Prometheus Infrastructure");
assert.equal(contract.verificationOwner, "Prometheus Overwatch");
assert.equal(contract.predecessor.artifactsImmutable, true);
assert.equal(contract.predecessor.reuseAllowed, false);
assert.equal(contract.scope.cloudflareContactAllowed, false);
assert.equal(contract.scope.governedKeychainValueAccessAllowedDuringEngineering, false);
assert.equal(contract.scope.governedKeychainAclMutationAllowedDuringEngineering, false);
assert.equal(contract.scope.deploymentAllowed, false);
assert.equal(contract.scope.productionMutationAllowed, false);
assert.equal(contract.scope.unattendedDeploymentControlState, "OFF_UNCONSUMED");
assert.equal(contract.scope.prospectiveCollectionState, "OFF");
assert.equal(contract.scope.activeCohorts, 0);
assert.equal(contract.scope.recommendationInfluenceState, "OFF");

assert.deepEqual(
  contract.governedAliases,
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ITEMS.map(item => item.alias)
);
assert.deepEqual(contract.rootCause.independentAuthorizationTags, [
  "kSecACLAuthorizationDecrypt",
  "kSecACLAuthorizationPartitionID"
]);
assert.equal(contract.rootCause.provenSecurityToolPartition, "apple-tool:");
assert.equal(contract.rootCause.broaderPartitionSelectorsAllowed, false);
assert.equal(contract.authorizationRepair.fixedTrustedExecutable, "/usr/bin/security");
assert.deepEqual(contract.authorizationRepair.retrievalAclAuthorizations, [
  "kSecACLAuthorizationDecrypt"
]);
assert.equal(contract.authorizationRepair.requiredPartitionSelector, "apple-tool:");
assert.equal(contract.authorizationRepair.wholeKeychainPolicyChangeAllowed, false);
assert.equal(contract.authorizationRepair.arbitraryExecutableAllowed, false);
assert.equal(contract.authorizationRepair.nilOrBroadSecretAclAllowed, false);
assert.equal(contract.authorizationRepair.duplicateAclAllowed, false);
assert.equal(contract.authorizationRepair.valuesReadOrChangedByAclHelper, false);
assert.equal(contract.authorizationRepair.currentItemRestoreRequiredOnVerificationFailure, true);
assert.equal(contract.authorizationRepair.reverseRollbackRequiredOnPartialFailure, true);
assert.equal(contract.authorizationRepair.allFourNoninteractiveReadsRequiredForPass, true);

assert.match(CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_ARTIFACT_ROOT, /interoperability-v2$/u);
assert.doesNotMatch(CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_ARTIFACT_ROOT, /interoperability-v1$/u);
assert.equal(contract.evidence.directoryMode, "0700");
assert.equal(contract.evidence.fileMode, "0600");
assert.equal(contract.evidence.exclusiveCreate, true);
assert.equal(contract.evidence.symlinkAllowed, false);
assert.equal(contract.evidence.repositoryCommitAndTreeBound, true);
assert.equal(contract.evidence.crossAttemptSubstitutionAllowed, false);
assert.equal(contract.evidence.containsCredentialMaterial, false);
assert.equal(
  contract.founderAttendedRemediation.fixedConfirmationPhrase,
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_REMEDIATION_PHRASE
);
assert.equal(
  contract.founderAttendedRemediation.rollbackPhrase,
  CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_ROLLBACK_PHRASE
);

assert.deepEqual(CLOUDFLARE_UNATTENDED_KEYCHAIN_ACL_V2_FAILURES, [
  "NONE",
  "AUTHORIZATION_SET_INVALID",
  "ACL_HELPER_TIMEOUT",
  "ACL_CHANGE_FAILED",
  "ACL_STATE_MISMATCH",
  "PARTIAL_GRANT",
  "POST_GRANT_INTERACTION_REQUIRED",
  "POST_GRANT_RETRIEVAL_FAILED",
  "ROLLBACK_FAILED"
]);
assert.match(helper, /trustedExecutable = "\/usr\/bin\/security"/u);
assert.match(helper, /requiredPartition = "apple-tool:"/u);
assert.match(helper, /let requiredRights = Set\(\[decrypt\]\)/u);
assert.match(helper, /\[kSecACLAuthorizationDecrypt\] as CFArray/u);
assert.match(helper, /kSecACLAuthorizationPartitionID/u);
assert.match(helper, /rights == requiredRights/u);
assert.match(helper, /applications\.count == 1/u);
assert.match(helper, /restoreGrant/u);
assert.match(helper, /restoreRevocation/u);
assert.doesNotMatch(helper, /kSecACLAuthorizationExportClear/u);
assert.doesNotMatch(helper, /"apple:"|"teamid:"|"cdhash:"|"unsigned:"/u);
assert.doesNotMatch(helper, /SecItemAdd|SecItemDelete|SecItemUpdate|ModifyContent/u);
assert.doesNotMatch(helper, /print\(|FileHandle\.standardOutput/u);

assert.match(workflow, /classification_consumption/u);
assert.match(workflow, /repositoryIdentity/u);
assert.match(workflow, /O_NOFOLLOW/u);
assert.match(workflow, /rollbackChanges\(changes, acl, writePhase\)/u);
assert.match(workflow, /POST_GRANT_INTERACTION_REQUIRED/u);
assert.doesNotMatch(workflow, /node:https|fetch\(|wrangler|deploy|CF-Access-Client/u);
assert.match(command, /createControllingTtyConfirmation\(\)/u);
assert.doesNotMatch(command, /node:https|fetch\(|wrangler|deploy/u);

assert.match(nativeFixture, /SYNTHETIC_NONPRODUCTION_ITEM/u);
assert.match(nativeFixture, /requiredPartition = "apple-tool:"/u);
assert.match(nativeFixture, /nil,\s*nil,\s*&item/su);
assert.doesNotMatch(nativeFixture, /CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID/u);
assert.doesNotMatch(nativeFixture, /SecKeychainItemCopyContent|SecItemCopyMatching/u);
assert.match(nativeVerifier, /delete-generic-password/u);
assert.match(nativeVerifier, /postflight\.status === 44/u);
assert.match(nativeVerifier, /retrieve\.stdout\.toString\("utf8"\)\.trimEnd\(\)/u);
assert.match(nativeVerifier, /wipe\(retrieve\)/u);

assert.match(documentation, /minimum repair is therefore an exact trusted-application ACL/u);
assert.match(documentation, /containing only `Decrypt`/u);
assert.match(documentation, /extended only by `apple-tool:`/u);
assert.match(documentation, /never reads, reuses, renames, deletes, or writes that namespace/u);
assert.match(documentation, /Unattended deployment control: `OFF` and unconsumed/u);
assert.match(documentation, /Recommendation influence: `OFF`/u);

for (const path of implementationPaths) {
  assert.deepEqual(scanTextForCloudflareSecrets(read(path), path), []);
}

for (const path of [
  "scripts/helpers/cloudflare-unattended-keychain-acl-v2.swift",
  "scripts/helpers/cloudflare-unattended-keychain-acl-v2-native-fixture.swift"
]) {
  const swift = spawnSync("/usr/bin/swiftc", ["-typecheck", path], {
    cwd: root,
    stdio: ["ignore", "ignore", "ignore"]
  });
  assert.equal(swift.status, 0);
}

const native = verifyNativeKeychainAclV2();
assert.ok(["PASS", "SKIPPED_NON_MACOS"].includes(native.status));

process.stdout.write(`${JSON.stringify({
  contractVersion: contract.contractVersion,
  implementationOwner: contract.implementationOwner,
  fixedItemCount: contract.governedAliases.length,
  retrievalAuthorization: "Decrypt",
  partitionAuthorization: "apple-tool:",
  nativeFixture: native.status,
  secretScan: "passed",
  cloudflareContacted: false,
  governedKeychainValuesRead: false,
  governedKeychainAclsChanged: false,
  deploymentPerformed: false,
  productionMutated: false,
  result: "passed"
}, null, 2)}\n`);
