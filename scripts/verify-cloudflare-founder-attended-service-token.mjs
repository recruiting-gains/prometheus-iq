import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ATTENDED_KEYCHAIN_ITEMS,
  CLOUDFLARE_SECRET_KEYCHAIN_ITEM_REGISTRY,
  KEYCHAIN_ITEMS,
  LOCAL_SECRET_ARTIFACT_CANDIDATES
} from "./check-cloudflare-unattended-secret-presence.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_MAX_LIFETIME_MS,
  CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_PATH,
  defaultFounderAttendedControl
} from "./lib/cloudflare-founder-attended-control.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_HELPER,
  CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_ITEMS
} from "./lib/cloudflare-founder-attended-keychain.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256,
  CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256_ALLOWLIST,
  CLOUDFLARE_FOUNDER_ATTENDED_API_ORIGIN,
  CLOUDFLARE_FOUNDER_ATTENDED_API_PATH_TEMPLATE,
  CLOUDFLARE_FOUNDER_ATTENDED_CREATE_BODY,
  CLOUDFLARE_FOUNDER_ATTENDED_DIRECTIVE,
  CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_DURATION,
  CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_NAME,
  CLOUDFLARE_FOUNDER_ATTENDED_TEMPORARY_TOKEN_MAX_TTL_HOURS,
  CLOUDFLARE_FOUNDER_ATTENDED_TEMPORARY_TOKEN_PERMISSION
} from "./lib/cloudflare-founder-attended-service-token.mjs";
import {
  CLOUDFLARE_FOUNDER_ATTENDED_COMMANDS
} from "./lib/cloudflare-founder-attended-service-token-production.mjs";
import {
  createControllingTtyConfirmation
} from "./lib/cloudflare-founder-attended-tty.mjs";
import { CLOUDFLARE_UNATTENDED_LAUNCH_PROFILES } from "./lib/cloudflare-unattended-launcher.mjs";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");

export function verifyCloudflareFounderAttendedServiceTokenArchitecture() {
  const contract = JSON.parse(read("workers/infrastructure/cloudflare-founder-attended-service-token-v1.json"));
  const packageJson = JSON.parse(read("package.json"));
  const helper = readFileSync(CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_HELPER, "utf8");
  const controlSource = read("scripts/lib/cloudflare-founder-attended-control.mjs");
  const keychainSource = read("scripts/lib/cloudflare-founder-attended-keychain.mjs");
  const serviceSource = read("scripts/lib/cloudflare-founder-attended-service-token.mjs");
  const productionSource = read("scripts/lib/cloudflare-founder-attended-service-token-production.mjs");
  const ttySource = read("scripts/lib/cloudflare-founder-attended-tty.mjs");
  const cliSource = read("scripts/run-cloudflare-founder-attended-service-token.mjs");
  const securitySource = read("scripts/security-check.mjs");
  const ownerTests = read("tests/cloudflare-founder-attended-service-token.test.mjs");
  const macOsPtyChild = read(
    "tests/fixtures/cloudflare-founder-attended-tty-macos-pty-child.mjs"
  );
  const macOsPtyHarness = read(
    "tests/fixtures/cloudflare-founder-attended-tty-macos-pty.expect"
  );
  const runbook = read("docs/cloudflare-founder-attended-service-token-provisioning-v1.md");

  assert.equal(contract.contractVersion, "cloudflare-founder-attended-service-token-v1");
  assert.equal(contract.batchId, "BATCH-20260714-007");
  assert.equal(contract.directive, CLOUDFLARE_FOUNDER_ATTENDED_DIRECTIVE);
  assert.equal(contract.owner, "Prometheus Infrastructure");
  assert.equal(contract.status, "IMPLEMENTED_SOURCE_NOT_EXECUTED");
  assert.equal(contract.cloudflareAccessPerformed, false);
  assert.equal(contract.keychainValuesAccessed, false);
  assert.equal(contract.credentialCreated, false);
  assert.equal(contract.productionMutationPerformed, false);
  assert.equal(contract.deploymentPerformed, false);

  assert.equal(contract.target.apiOrigin, CLOUDFLARE_FOUNDER_ATTENDED_API_ORIGIN);
  assert.equal(contract.target.collectionPathTemplate, CLOUDFLARE_FOUNDER_ATTENDED_API_PATH_TEMPLATE);
  assert.equal(
    contract.target.endpointTemplate,
    `${CLOUDFLARE_FOUNDER_ATTENDED_API_ORIGIN}${CLOUDFLARE_FOUNDER_ATTENDED_API_PATH_TEMPLATE}`
  );
  assert.equal(contract.target.accountIdSha256, CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256);
  assert.deepEqual(CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256_ALLOWLIST, [
    "2abc795ed0df284a522381c09dca33fc567105c74074140fd920c0dd45dcd536"
  ]);
  assert.equal(contract.target.digestComparedBeforeEndpointConstruction, true);
  assert.equal(contract.target.otherAccountsAllowed, false);

  assert.equal(contract.temporaryApiCredential.permission, CLOUDFLARE_FOUNDER_ATTENDED_TEMPORARY_TOKEN_PERMISSION);
  assert.equal(contract.temporaryApiCredential.maximumTtlHours, CLOUDFLARE_FOUNDER_ATTENDED_TEMPORARY_TOKEN_MAX_TTL_HOURS);
  assert.equal(contract.temporaryApiCredential.existingUnattendedDeploymentTokenReadable, false);
  assert.equal(contract.temporaryApiCredential.existingUnattendedDeploymentTokenModified, false);
  assert.deepEqual(CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_ITEMS.temporaryApiToken, {
    service: "com.prometheus.cloudflare.attended.service-token-provisioning",
    account: "CLOUDFLARE_ACCESS_SERVICE_TOKENS_WRITE_API_TOKEN"
  });
  assert.equal(
    Object.values(CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_ITEMS)
      .some(item => item.account === "CLOUDFLARE_API_TOKEN"),
    false
  );

  assert.equal(contract.serviceToken.name, CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_NAME);
  assert.equal(contract.serviceToken.duration, CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_DURATION);
  assert.deepEqual(contract.serviceToken.requestBody, CLOUDFLARE_FOUNDER_ATTENDED_CREATE_BODY);
  assert.equal(contract.serviceToken.createCountMaximum, 1);
  assert.equal(contract.serviceToken.automaticRetryAllowed, false);
  assert.equal(contract.serviceToken.redirectFollowAllowed, false);
  assert.equal(contract.serviceToken.fixedNameDuplicatePreflight.exactCollectionEndpoint, true);
  assert.equal(contract.serviceToken.fixedNameDuplicatePreflight.queryString, "");
  assert.equal(contract.responseHandling.strictJsonWithDuplicateKeyRejection, true);
  assert.equal(contract.responseHandling.responseBodyPersisted, false);

  assert.deepEqual(contract.destinationKeychain.accounts, [
    "CLOUDFLARE_ACCESS_CLIENT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_SECRET"
  ]);
  assert.equal(contract.destinationKeychain.writeMechanism, "Security.framework_helper_anonymous_stdin_pipe");
  assert.equal(contract.destinationKeychain.secretValuesInArguments, false);
  assert.equal(contract.destinationKeychain.secretValuesInEnvironment, false);
  assert.equal(contract.destinationKeychain.rollbackOwnershipAttribute, "kSecAttrComment");
  assert.equal(contract.destinationKeychain.rollbackOwnershipValueSecret, false);
  assert.equal(contract.destinationKeychain.rollbackDeletesOnlyInvocationOwnedItems, true);
  assert.equal(contract.destinationKeychain.preexistingOrReplacementItemDeletionAllowed, false);
  assert.equal(
    contract.destinationKeychain.processDeathAfterPartialWrite,
    "PRESENCE_BLOCKS_RETRY_AND_REQUIRES_FOUNDER_REVIEW"
  );
  assert.equal(contract.destinationKeychain.presenceVerification, "name_and_PRESENT_or_ABSENT_only");
  assert.equal(
    contract.destinationKeychain.unattendedReaderInteroperability.readerExecutable,
    "/usr/bin/security"
  );
  assert.equal(
    contract.destinationKeychain.unattendedReaderInteroperability
      .genericPasswordServiceAndAccountCompatibleInSource,
    true
  );
  assert.equal(
    contract.destinationKeychain.unattendedReaderInteroperability.realKeychainRuntimeVerified,
    false
  );
  assert.equal(
    contract.destinationKeychain.unattendedReaderInteroperability
      .noninteractiveAccessControlProvenInSource,
    false
  );
  assert.equal(
    contract.destinationKeychain.unattendedReaderInteroperability
      .broadTrustedApplicationAccessConfigured,
    false
  );
  assert.equal(
    contract.destinationKeychain.unattendedReaderInteroperability
      .mandatoryFounderAttendedIntegrationCheckBeforeReadiness,
    true
  );

  const defaultControl = defaultFounderAttendedControl();
  assert.equal(defaultControl.enabled, false);
  assert.equal(defaultControl.directive, CLOUDFLARE_FOUNDER_ATTENDED_DIRECTIVE);
  assert.equal(defaultControl.accountIdSha256, CLOUDFLARE_FOUNDER_ATTENDED_ACCOUNT_ID_SHA256);
  assert.equal(defaultControl.serviceTokenName, CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_NAME);
  assert.equal(defaultControl.duration, CLOUDFLARE_FOUNDER_ATTENDED_SERVICE_TOKEN_DURATION);
  assert.equal(contract.attendedControl.defaultState, "OFF");
  assert.equal(contract.attendedControl.maximumLifetimeMinutes, 30);
  assert.equal(CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_MAX_LIFETIME_MS, 30 * 60 * 1000);
  assert.match(CLOUDFLARE_FOUNDER_ATTENDED_CONTROL_PATH, /\.prometheus\/infrastructure\//u);
  assert.equal(contract.attendedControl.controllingTtyRequiredForRealProvisioning, true);
  assert.equal(contract.attendedControl.clockAndRepositoryReadersAreLiveFunctions, true);
  assert.equal(contract.attendedControl.firstLiveSampleAfterConfirmationAndKeychainReads, true);
  assert.equal(contract.attendedControl.freshValidationImmediatelyBeforeGet, true);
  assert.equal(contract.attendedControl.freshValidationImmediatelyBeforePost, true);
  assert.equal(contract.attendedControl.staleStructurallyValidAuthorizationConsumed, true);
  assert.equal(contract.attendedControl.nonceConsumedBeforeFirstNetworkCall, true);
  assert.equal(contract.attendedControl.atomicExclusiveConsumption, true);
  assert.equal(contract.attendedControl.persistentConsumptionReceipt, true);
  assert.equal(contract.attendedControl.replayAllowed, false);

  assert.equal(contract.compensation.method, "DELETE");
  assert.equal(contract.compensation.attemptsMaximum, 1);
  assert.equal(contract.compensation.automaticRetryAllowed, false);
  assert.equal(contract.compensation.ambiguousPostRetryAllowed, false);
  assert.equal(contract.compensation.ambiguousPostOrCompensationFailure, "MANUAL_REVIEW_REQUIRED");

  assert.deepEqual(CLOUDFLARE_FOUNDER_ATTENDED_COMMANDS, [
    "presence",
    "provision-attended",
    "cleanup-temp"
  ]);
  assert.deepEqual(contract.cli.fixedCommands, CLOUDFLARE_FOUNDER_ATTENDED_COMMANDS);
  assert.equal(contract.cli.arbitraryArgumentsAllowed, false);
  assert.equal(contract.cli.productionEntrypointImportsOnlyProductionWrapper, true);
  assert.equal(contract.cli.productionAdapterInjectionAllowed, false);
  assert.equal(contract.cli.testCoreRequiresEveryAdapterExplicitly, true);
  assert.equal(contract.cli.unattendedLauncherProfileAvailable, false);
  assert.equal(CLOUDFLARE_UNATTENDED_LAUNCH_PROFILES.includes("founder-attended-service-token"), false);

  assert.match(helper, /import Security/u);
  assert.match(helper, /FileHandle\.standardInput\.readDataToEndOfFile\(\)/u);
  assert.match(helper, /SecItemAdd/u);
  assert.match(helper, /kSecAttrComment/u);
  assert.doesNotMatch(helper, /kSecAttrAccessible|kSecUseDataProtectionKeychain/u);
  assert.doesNotMatch(helper, /SecAccessCreate|SecTrustedApplication|kSecAttrAccess\b/u);
  assert.doesNotMatch(helper, /print\(|NSLog|ProcessInfo\.processInfo\.environment/u);
  const helperMatrixGuard = helper.indexOf("guard let allowedItems = allowedItemsByOperation[operation]");
  const firstSecItemCall = Math.min(
    helper.indexOf("SecItemCopyMatching("),
    helper.indexOf("SecItemAdd("),
    helper.indexOf("SecItemDelete(")
  );
  assert.ok(helperMatrixGuard > 0 && firstSecItemCall > helperMatrixGuard);
  assert.match(helper, /"read": \[temporaryApiToken, governedAccountId\]/u);
  assert.match(helper, /"add": \[smokeClientId, smokeClientSecret\]/u);
  assert.match(helper, /"delete": \[temporaryApiToken, smokeClientId, smokeClientSecret\]/u);
  assert.match(keychainSource, /stdio: \["pipe", "pipe", "ignore"\]/u);
  assert.match(keychainSource, /input\.fill\(0\)/u);
  assert.match(keychainSource, /deleteOwnedItem\(key, ownershipTag\)/u);
  assert.doesNotMatch(keychainSource, /add-generic-password/u);
  assert.match(controlSource, /O_EXCL/u);
  assert.match(controlSource, /fsyncSync/u);
  assert.match(controlSource, /parseStrictJson/u);
  assert.match(serviceSource, /timingSafeEqual/u);
  assert.match(serviceSource, /method: "GET"/u);
  assert.match(serviceSource, /method: "POST"/u);
  assert.match(serviceSource, /method: "DELETE"/u);
  assert.match(serviceSource, /provisionFounderAttendedServiceTokenTestOnly/u);
  const provisioningSource = serviceSource.slice(
    serviceSource.indexOf("export async function provisionFounderAttendedServiceTokenTestOnly")
  );
  assert.equal((provisioningSource.match(/revalidateLiveState\(\{/gu) || []).length, 2);
  assert.match(serviceSource, /typeof options\.clock === "function"/u);
  assert.match(serviceSource, /typeof options\.repositoryReader === "function"/u);
  assert.doesNotMatch(serviceSource, /maxRetries|retryAfter|setTimeout\(/u);
  assert.doesNotMatch(serviceSource, /process\.env/u);
  assert.match(productionSource, /export async function provisionFounderAttendedServiceToken\(\)/u);
  assert.match(productionSource, /createControllingTtyConfirmation\(\)/u);
  assert.match(productionSource, /createFounderAttendedMacOsKeychain\(\)/u);
  assert.match(productionSource, /createFounderAttendedCloudflareTransport\(\)/u);
  assert.equal(createControllingTtyConfirmation.length, 0);
  assert.match(ttySource, /input\?\.isTTY !== true/u);
  assert.match(ttySource, /output\?\.isTTY !== true/u);
  assert.match(ttySource, /inputInfo\.isCharacterDevice\(\)/u);
  assert.match(ttySource, /outputInfo\.isCharacterDevice\(\)/u);
  assert.match(ttySource, /inputInfo\.rdev !== outputInfo\.rdev/u);
  assert.match(ttySource, /ttyInfo\.isCharacterDevice\(\)/u);
  assert.doesNotMatch(ttySource, /ttyInfo\.rdev/u);
  assert.match(ttySource, /constants\.O_RDWR \| noFollow \| noControllingTty/u);
  assert.match(ttySource, /operations\.writeSync\(fd,/u);
  assert.match(ttySource, /operations\.readSync\(fd,/u);
  assert.doesNotMatch(ttySource, /(?:read|write)Sync\((?:input|output)\.fd/u);
  assert.match(macOsPtyChild, /createControllingTtyConfirmation\(\)\.confirm\(/u);
  assert.match(macOsPtyChild, /ttyInfo\.rdev !== inputInfo\.rdev/u);
  assert.doesNotMatch(
    macOsPtyChild,
    /node:https|createFounderAttendedMacOsKeychain|createFounderAttendedCloudflareTransport/u
  );
  assert.match(macOsPtyHarness, /set timeout 5/u);
  assert.match(macOsPtyHarness, /\/bin\/kill -TERM/u);
  assert.match(macOsPtyHarness, /\/bin\/kill -KILL/u);
  assert.match(ownerTests, /const timeoutMs = 8_000/u);
  assert.match(ownerTests, /process\.kill\(-child\.pid, "SIGKILL"\)/u);
  assert.equal((cliSource.match(/^import[\s\S]*?;$/gmu) || []).length, 1);
  assert.match(cliSource, /cloudflare-founder-attended-service-token-production\.mjs/u);
  assert.doesNotMatch(cliSource, /confirmation|transport|keychain|operations|requestImpl/u);
  assert.doesNotMatch(cliSource, /console\.(?:log|error)\([^\n]*(?:error\.message|error\.stack)/u);

  assert.deepEqual(ATTENDED_KEYCHAIN_ITEMS, [{
    service: "com.prometheus.cloudflare.attended.service-token-provisioning",
    account: "CLOUDFLARE_ACCESS_SERVICE_TOKENS_WRITE_API_TOKEN"
  }]);
  assert.equal(CLOUDFLARE_SECRET_KEYCHAIN_ITEM_REGISTRY.includes(ATTENDED_KEYCHAIN_ITEMS[0]), true);
  assert.deepEqual(
    KEYCHAIN_ITEMS.filter(item => item.service === "com.prometheus.cloudflare.unattended.smoke"),
    [
      CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_ITEMS.smokeClientId,
      CLOUDFLARE_FOUNDER_ATTENDED_KEYCHAIN_ITEMS.smokeClientSecret
    ]
  );
  for (const artifact of [
    "cloudflare-founder-attended-service-token-control-v1.json",
    "cloudflare-attended-service-token-provisioning-token.txt",
    "cloudflare-service-token-response.json"
  ]) {
    assert.equal(LOCAL_SECRET_ARTIFACT_CANDIDATES.includes(artifact), true);
  }

  for (const command of [
    "infrastructure:cloudflare-founder-attended:check",
    "infrastructure:cloudflare-founder-attended:presence",
    "infrastructure:cloudflare-founder-attended:provision-attended",
    "infrastructure:cloudflare-founder-attended:cleanup-temp"
  ]) {
    assert.equal(typeof packageJson.scripts[command], "string");
  }
  for (const forbidden of ["authorize", "provision", "cleanup"]) {
    assert.equal(packageJson.scripts[`infrastructure:cloudflare-founder-attended:${forbidden}`], undefined);
  }
  assert.match(packageJson.scripts.test, /infrastructure:cloudflare-founder-attended:check/u);
  assert.match(securitySource, /verifyCloudflareFounderAttendedServiceTokenArchitecture/u);
  for (const command of ["presence", "provision-attended", "cleanup-temp"]) {
    assert.match(runbook, new RegExp(`infrastructure:cloudflare-founder-attended:${command}`, "u"));
  }
  assert.match(runbook, /Keychain deletion happens first; Cloudflare revocation is mandatory second\./u);
  assert.match(runbook, /stdin` and `stdout` character-device `rdev` values must match/u);
  assert.match(runbook, /`\/dev\/tty` `rdev` is intentionally not compared/u);
  assert.match(runbook, /BATCH-20260715-001/u);
  assert.match(runbook, /runtime interoperability is not claimed/u);
  assert.match(runbook, /readiness remains blocked/u);

  assert.equal(contract.testBoundary.realNetworkAllowed, false);
  assert.equal(contract.testBoundary.realKeychainAllowed, false);
  assert.equal(contract.testBoundary.injectedClockRequired, true);
  assert.equal(contract.testBoundary.injectedRepositoryReaderRequired, true);
  assert.equal(contract.testBoundary.productionWrapperInvocationAllowed, false);
  assert.equal(contract.runtimeBoundaries.cloudflareAccessPolicyMutationAllowed, false);
  assert.equal(contract.runtimeBoundaries.workerDeploymentAllowed, false);
  assert.equal(contract.runtimeBoundaries.publicWorkerMutationAllowed, false);
  assert.equal(contract.runtimeBoundaries.productionDataMutationAllowed, false);
  assert.equal(contract.runtimeBoundaries.collectionActivation, "OFF");
  assert.equal(contract.runtimeBoundaries.cohortActivation, "OFF");
  assert.equal(contract.runtimeBoundaries.recommendationInfluence, "OFF");
  assert.equal(contract.runtimeBoundaries.pushAuthorized, false);

  return Object.freeze({ status: "passed" });
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    verifyCloudflareFounderAttendedServiceTokenArchitecture();
    console.log("Cloudflare Founder-attended service-token Infrastructure check passed.");
  } catch {
    console.error("Cloudflare Founder-attended service-token Infrastructure check failed.");
    process.exitCode = 1;
  }
}
