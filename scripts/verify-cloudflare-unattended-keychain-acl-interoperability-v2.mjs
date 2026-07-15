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
import {
  verifyCloudflareUnattendedKeychainAclV2Provenance
} from "./verify-cloudflare-unattended-keychain-acl-interoperability-v2-provenance.mjs";

const root = resolve(import.meta.dirname, "..");
const contractPath =
  "workers/infrastructure/cloudflare-unattended-keychain-acl-interoperability-v2.json";
const provenanceContractPath =
  "workers/infrastructure/cloudflare-unattended-keychain-acl-interoperability-v2-provenance-v1.json";
const implementationPaths = Object.freeze([
  "scripts/helpers/cloudflare-unattended-keychain-acl-v2.swift",
  "scripts/helpers/cloudflare-unattended-keychain-acl-v2-native-fixture.swift",
  "scripts/lib/cloudflare-unattended-keychain-acl-interoperability-v2.mjs",
  "scripts/run-cloudflare-unattended-keychain-acl-interoperability-v2.mjs",
  "scripts/verify-cloudflare-unattended-keychain-acl-v2-native.mjs",
  "scripts/verify-cloudflare-unattended-keychain-acl-interoperability-v2-provenance.mjs",
  "scripts/verify-cloudflare-unattended-keychain-acl-interoperability-v2.mjs",
  "tests/cloudflare-unattended-keychain-acl-interoperability-v2.test.mjs",
  "tests/cloudflare-unattended-keychain-acl-interoperability-v2-provenance.test.mjs",
  "docs/cloudflare-unattended-keychain-acl-interoperability-v2.md",
  contractPath,
  provenanceContractPath
]);

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

const contract = JSON.parse(read(contractPath));
const provenanceContract = JSON.parse(read(provenanceContractPath));
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
assert.equal(contract.status, "FOUNDER_REVIEW_REQUIRED_NATIVE_REPRODUCIBILITY_BLOCKED");
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
assert.equal(contract.rootCause.securityToolCodeIdentifier, "com.apple.security");
assert.equal(contract.rootCause.provenSecurityToolPartition, "apple-tool:");
assert.equal(contract.rootCause.otherAppleSignedPartition, "apple:");
assert.equal(
  contract.rootCause.securityToolPartitionIdentitySource,
  "Security/securityd/src/clientid.cpp"
);
assert.equal(contract.rootCause.partitionMembershipSource, "Security/securityd/src/acls.cpp");
assert.equal(contract.rootCause.partitionMatchOperation, "CFArrayContainsValue");
assert.equal(contract.rootCause.combinedAppleSelectorOnlyPassAccepted, false);
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
assert.equal(contract.nativeFixture.createdThroughSecItemAdd, true);
assert.equal(contract.nativeFixture.initialAccessAssignedAtSecItemAdd, true);
assert.equal(contract.nativeFixture.usesIsolatedTemporaryLegacyKeychain, true);
assert.equal(contract.nativeFixture.temporaryKeychainCreatedWith, "SecKeychainCreate");
assert.equal(contract.nativeFixture.temporaryKeychainDeletedWith, "SecKeychainDelete");
assert.equal(contract.nativeFixture.temporaryKeychainFilesystemAbsenceVerified, true);
assert.equal(contract.nativeFixture.temporaryKeychainSidecarAbsenceVerified, true);
assert.equal(contract.nativeFixture.temporaryKeychainDeletionWaitMaximumMilliseconds, 1000);
assert.equal(contract.nativeFixture.mutatesUserSearchListOrDefaultKeychain, false);
assert.equal(contract.nativeFixture.userKeychainSelectionNativePathsUnchangedBeforeAfter, true);
assert.equal(
  contract.nativeFixture.userKeychainSelectionSnapshotImplementation,
  "SecKeychainCopyDomainSearchList+SecKeychainCopyDomainDefault"
);
assert.equal(contract.nativeFixture.userKeychainSelectionPathsNormalizedWith, "SecKeychainGetPath");
assert.equal(contract.nativeFixture.usesSecItemAddReturnReference, true);
assert.deepEqual(contract.nativeFixture.initialAdministrativeTrustedApplications, [
  "SYNTHETIC_FIXTURE",
  "NATIVE_E2E_HELPER"
]);
assert.equal(
  contract.nativeFixture.initialAdministrativeAuthorization,
  "kSecACLAuthorizationChangeACL"
);
assert.equal(contract.nativeFixture.childProcessTimeoutMilliseconds, 5000);
assert.equal(contract.nativeFixture.userInteractionSuppressionUsed, false);
assert.equal(contract.nativeFixture.initialSecurityTrust, "NONE");
assert.equal(
  contract.nativeFixture.initialNegativeEvidence,
  "STRUCTURAL_ACL_ABSENCE_WITH_IMMUTABLE_REAL_ITEM_INTERACTION_REQUIRED_EVIDENCE"
);
assert.equal(contract.nativeFixture.compileTimeTestOnlyAlias, "NATIVE_E2E_SYNTHETIC");
assert.equal(
  contract.nativeFixture.decryptOnlyWithoutExportClearMustBeValidatedBeforePromotion,
  true
);
assert.deepEqual(contract.nativeFixture.selectorMatrixPartitionSets, [
  ["apple-tool:"],
  ["apple:"],
  ["apple-tool:", "apple:"]
]);
assert.deepEqual(contract.nativeFixture.selectorMatrixRequiredStandalonePass, ["apple-tool:"]);
assert.equal(contract.nativeFixture.appleOnlyPassAccepted, false);
assert.equal(contract.nativeFixture.selectorCombinationOnlyPassAccepted, false);
assert.equal(contract.nativeFixture.authorizationMatrixFixedPartitionSelector, "apple-tool:");
assert.deepEqual(contract.nativeFixture.authorizationMatrixAuthorizationSets, [
  ["kSecACLAuthorizationDecrypt"],
  ["kSecACLAuthorizationExportClear"],
  ["kSecACLAuthorizationDecrypt", "kSecACLAuthorizationExportClear"]
]);
assert.equal(contract.nativeFixture.matrixTrustedExecutable, "/usr/bin/security");
assert.equal(contract.nativeFixture.matrixAllowsNilOrBroadTrustedApplicationList, false);
assert.equal(contract.nativeFixture.matrixCaseTimeoutMilliseconds, 5000);
assert.equal(contract.nativeFixture.matrixTimeoutIsPass, false);
assert.deepEqual(contract.nativeFixture.matrixOrderingsRequiredForAcceptance, [
  "FORWARD",
  "REVERSE"
]);
assert.equal(contract.nativeFixture.minimumIndependentLifecyclePassesRequired, 20);
assert.equal(
  contract.nativeFixture.productionAuthorizationMayChangeWithoutReproducibleMatrixProof,
  false
);
assert.equal(contract.nativeFixture.securityReadUsesPositionalTemporaryKeychain, true);
assert.equal(contract.nativeFixture.securityReadStdinClosed, true);
assert.equal(contract.nativeFixture.helperUsesCompileTimeTemporaryKeychainOnly, true);
assert.equal(contract.nativeFixture.helperRevokeRestoresInitialAclSnapshot, true);
assert.equal(contract.nativeFixture.postRevokeNegativeEvidence, "STRUCTURAL_ACL_SNAPSHOT_RESTORATION");
assert.equal(contract.nativeFixture.timeoutPhaseMarkers, true);
assert.equal(contract.nativeFixture.timeoutIsFailure, true);
assert.deepEqual(contract.nativeFixture.nativeFixtureFixedFailureStates, [
  "KEYCHAIN_CREATE_FAILED",
  "SYNTHETIC_ACCESS_OR_KEYCHAIN_UNLOCK_FAILED",
  "ITEM_REFERENCE_INVALID",
  "INITIAL_ACL_MISMATCH",
  "HELPER_INSPECT_FAILED_OR_TIMEOUT",
  "HELPER_GRANT_FAILED_OR_TIMEOUT",
  "GRANT_ACL_MISMATCH",
  "POSITIVE_READ_LAUNCH_FAILED",
  "HELPER_REVOKE_FAILED_OR_TIMEOUT",
  "POST_REVOKE_INSPECT_FAILED_OR_TIMEOUT",
  "ACL_SNAPSHOT_RESTORE_FAILED",
  "AUTHORIZATION_COMPONENT_RESTORE_FAILED",
  "POSITIVE_READ_TIMEOUT",
  "POSITIVE_READ_COMMAND_FAILED",
  "POSITIVE_READ_OUTPUT_MISMATCH",
  "ITEM_CREATE_INTERACTION_DISALLOWED",
  "ITEM_CREATE_AUTH_FAILED",
  "ITEM_CREATE_KEYCHAIN_UNAVAILABLE",
  "ITEM_CREATE_UNSUPPORTED_OR_INVALID_PARAMETERS",
  "ITEM_CREATE_UNCLASSIFIED_FAILURE",
  "USER_KEYCHAIN_SELECTION_BEFORE_SNAPSHOT_FAILED",
  "USER_KEYCHAIN_SELECTION_AFTER_SNAPSHOT_FAILED",
  "USER_KEYCHAIN_SELECTION_CHANGED"
]);
assert.equal(contract.nativeFixture.rawOsStatusOutputAllowed, false);
assert.deepEqual(contract.nativeFixture.nativeCleanupFailureStates, [
  "KEYCHAIN_DELETE_FAILED",
  "KEYCHAIN_PATH_REMAINS_AFTER_BOUNDED_WAIT",
  "KEYCHAIN_PATH_REMAINS_POST_PROCESS"
]);
assert.equal(contract.nativeFixture.primaryFixtureFailurePrecedesOuterCleanupFailure, true);
assert.equal(contract.nativeFixture.capturedSyntheticBuffersWiped, true);
assert.equal(contract.provenanceRepair.predecessorCommit, "348978de14a09651565c84c0b445b8371c496131");
assert.equal(contract.provenanceRepair.classification, "LOCAL_PROVENANCE_METADATA_GAP");
assert.equal(contract.provenanceRepair.pinnedOriginalFiles, 9);
assert.equal(contract.provenanceRepair.rewritesPredecessor, false);
assert.equal(
  provenanceContract.contractVersion,
  "cloudflare-unattended-keychain-acl-interoperability-v2-provenance-v1"
);

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
assert.match(helper, /#if KEYCHAIN_ACL_V2_NATIVE_E2E/u);
assert.match(helper, /allowed\["NATIVE_E2E_SYNTHETIC"\]/u);
assert.match(helper, /let nativeE2EKeychainPath: String/u);
assert.match(helper, /SecKeychainOpen\(path, &keychain\)/u);
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
assert.match(nativeFixture, /syntheticOnlyExecutable = CommandLine\.arguments\.first/u);
assert.match(nativeFixture, /SecItemAdd/u);
assert.match(nativeFixture, /kSecUseKeychain as String: keychain/u);
assert.match(nativeFixture, /SecKeychainCreate/u);
assert.match(nativeFixture, /SecKeychainDelete/u);
assert.match(nativeFixture, /keychainPathsAbsentNow/u);
assert.match(nativeFixture, /keychainPathsDisappearWithinBound/u);
assert.match(nativeFixture, /kSecReturnRef/u);
assert.match(nativeFixture, /kSecAttrAccess as String: access/u);
assert.match(nativeFixture, /itemCreateFailureExitCode/u);
assert.doesNotMatch(nativeFixture, /SecKeychainSetUserInteractionAllowed/u);
assert.match(nativeFixture, /SecKeychainCopyDomainSearchList/u);
assert.match(nativeFixture, /SecKeychainCopyDomainDefault/u);
assert.match(nativeFixture, /SecKeychainGetPath/u);
assert.match(nativeFixture, /\[syntheticOnlyApplication, helperApplication\] as CFArray/u);
assert.match(nativeFixture, /kSecACLAuthorizationChangeACL/u);
assert.match(nativeFixture, /verifyInitialAdministrativeACL/u);
assert.match(nativeFixture, /waitForBoundedExit/u);
assert.doesNotMatch(nativeFixture, /SecKeychainItemSetAccess/u);
assert.match(nativeFixture, /POSITIVE_READ_STARTED/u);
assert.match(nativeFixture, /RESTORE_VALIDATED/u);
assert.match(nativeFixture, /MATRIX_APPLE_TOOL_ONLY/u);
assert.match(nativeFixture, /MATRIX_APPLE_ONLY/u);
assert.match(nativeFixture, /MATRIX_APPLE_TOOL_PLUS_APPLE/u);
assert.match(nativeFixture, /MATRIX_DECRYPT_ONLY/u);
assert.match(nativeFixture, /MATRIX_EXPORT_CLEAR_ONLY/u);
assert.match(nativeFixture, /MATRIX_DECRYPT_PLUS_EXPORT_CLEAR/u);
assert.match(nativeFixture, /kSecACLAuthorizationExportClear/u);
assert.match(nativeFixture, /runSilent\(helperPath, \["grant", helperAlias\], expectedStatus: 32\)/u);
assert.match(nativeFixture, /runSilent\(helperPath, \["revoke", helperAlias, "both"\], expectedStatus: 42\)/u);
assert.match(nativeFixture, /rights == Set\(\[decrypt\]\)/u);
assert.match(nativeFixture, /snapshot\(persistedItem\) == initialSnapshot/u);
assert.doesNotMatch(nativeFixture, /CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID/u);
assert.doesNotMatch(nativeFixture, /SecKeychainItemCopyContent|SecItemCopyMatching/u);
assert.doesNotMatch(nativeFixture, /\/usr\/bin\/true/u);
assert.doesNotMatch(nativeFixture, /print\(|FileHandle\.standardOutput/u);
assert.match(nativeVerifier, /fixture\.keychain-db/u);
assert.match(nativeVerifier, /keychainPaths\.filter\(existsSync\)/u);
assert.match(nativeVerifier, /if \(primaryError\) throw primaryError/u);
assert.match(nativeVerifier, /native_fixture_timeout_after_\$\{timeoutPhase\(phasePath\)\}/u);
assert.match(nativeVerifier, /PHASE_MARKER_WRITE_FAILED/u);
assert.match(nativeVerifier, /KEYCHAIN_ACL_V2_NATIVE_E2E/u);
assert.match(nativeVerifier, /ITEM_CREATE_INTERACTION_DISALLOWED/u);
assert.match(nativeVerifier, /USER_KEYCHAIN_SELECTION_CHANGED/u);
assert.match(nativeVerifier, /HELPER_GRANT_FAILED_OR_TIMEOUT/u);
assert.match(nativeVerifier, /SUSPICIOUS_COMBINATION_ONLY/u);
assert.match(nativeVerifier, /SUSPICIOUS_APPLE_ONLY_PASS/u);
assert.match(nativeVerifier, /verifyNativeKeychainAclV2MatrixReverse/u);
assert.match(nativeVerifier, /verifyNativeKeychainAclV2AuthorizationMatrixReverse/u);
assert.doesNotMatch(nativeVerifier, /add-generic-password|-T|list-keychains|default-keychain/u);

assert.match(documentation, /selector identity for `\/usr\/bin\/security` is exactly `apple-tool:`/u);
assert.match(documentation, /containing only `Decrypt`/u);
assert.match(documentation, /combination-only success is rejected/u);
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
const provenance = verifyCloudflareUnattendedKeychainAclV2Provenance();

process.stdout.write(`${JSON.stringify({
  contractVersion: contract.contractVersion,
  implementationOwner: contract.implementationOwner,
  fixedItemCount: contract.governedAliases.length,
  retrievalAuthorization: "Decrypt",
  partitionAuthorization: "apple-tool:",
  nativeFixture: native.status,
  provenance: provenance.result,
  secretScan: "passed",
  cloudflareContacted: false,
  governedKeychainValuesRead: false,
  governedKeychainAclsChanged: false,
  deploymentPerformed: false,
  productionMutated: false,
  result: "passed"
}, null, 2)}\n`);
