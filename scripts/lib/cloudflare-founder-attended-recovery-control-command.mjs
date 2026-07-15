import {
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONFIRMATIONS
} from "./cloudflare-founder-attended-get-only-recovery-constants.mjs";
import {
  classifyCloudflareFounderAttendedRecoveryError,
  cloudflareFounderAttendedRecoveryClassificationError,
  decodeFounderAttendedRecoveryAccountId,
  validFounderAttendedRecoveryRepositoryIdentity,
  validateFounderAttendedRecoveryAccountId
} from "./cloudflare-founder-attended-get-only-diagnostic.mjs";
import {
  prepareFounderAttendedSuccessorRecoveryControl
} from "./cloudflare-founder-attended-recovery-control.mjs";

function requirePreparationComposition(options) {
  const valid = options
    && typeof options === "object"
    && options.confirmation
    && typeof options.confirmation.confirm === "function"
    && options.keychain
    && typeof options.keychain.hasItem === "function"
    && typeof options.keychain.readItem === "function"
    && typeof options.clock === "function"
    && typeof options.repositoryReader === "function"
    && Array.isArray(options.accountIdSha256Allowlist)
    && options.accountIdSha256Allowlist.length === 1
    && typeof options.artifactRoot === "string"
    && options.artifactRoot.length > 0
    && typeof options.randomBytesImpl === "function"
    && Number.isSafeInteger(options.expectedUid)
    && options.expectedUid >= 0;
  if (!valid) throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
  return options;
}

function requireFounderPreparationConfirmation(confirmation) {
  let confirmed = false;
  try {
    confirmed = confirmation.confirm(
      "prepare-recovery",
      CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONFIRMATIONS["prepare-recovery"]
    ) === true;
  } catch {
    throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
  }
  if (!confirmed) throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
}

function requirePreparationKeychainState(keychain) {
  try {
    if (!keychain.hasItem("temporaryApiToken")
      || !keychain.hasItem("governedAccountId")
      || keychain.hasItem("smokeClientId")
      || keychain.hasItem("smokeClientSecret")) {
      throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
    }
  } catch {
    throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
  }
}

function samplePreparationState(clock, repositoryReader) {
  try {
    const now = clock();
    const repositoryIdentity = repositoryReader();
    if (!(now instanceof Date)
      || !Number.isFinite(now.getTime())
      || !validFounderAttendedRecoveryRepositoryIdentity(repositoryIdentity)) {
      throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
    }
    return Object.freeze({
      now: new Date(now.getTime()),
      repositoryIdentity: Object.freeze({
        commit: repositoryIdentity.commit,
        tree: repositoryIdentity.tree,
        clean: true
      })
    });
  } catch {
    throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
  }
}

export function prepareFounderAttendedRecoveryControlTestOnly(options) {
  const {
    confirmation,
    keychain,
    clock,
    repositoryReader,
    accountIdSha256Allowlist,
    artifactRoot,
    randomBytesImpl,
    expectedUid
  } = requirePreparationComposition(options);

  let accountId = null;
  try {
    requireFounderPreparationConfirmation(confirmation);
    requirePreparationKeychainState(keychain);
    accountId = decodeFounderAttendedRecoveryAccountId(keychain.readItem("governedAccountId"));
    const accountIdSha256 = validateFounderAttendedRecoveryAccountId(
      accountId,
      accountIdSha256Allowlist
    );
    const context = samplePreparationState(clock, repositoryReader);
    prepareFounderAttendedSuccessorRecoveryControl({
      artifactRoot,
      now: context.now,
      repositoryIdentity: context.repositoryIdentity,
      accountIdSha256,
      randomBytesImpl,
      expectedUid
    });
    return Object.freeze({ classification: "SAFE_TO_PREPARE_RECOVERY" });
  } catch (error) {
    throw cloudflareFounderAttendedRecoveryClassificationError(
      classifyCloudflareFounderAttendedRecoveryError(error)
    );
  } finally {
    accountId = null;
  }
}
