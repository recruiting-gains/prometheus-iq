import {
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_ACCOUNT_ALLOWLIST,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONFIRMATIONS,
  CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONTROL_MAX_LIFETIME_MS
} from "./cloudflare-founder-attended-get-only-recovery-constants.mjs";
import {
  classifyCloudflareFounderAttendedRecoveryError,
  cloudflareFounderAttendedRecoveryClassificationError,
  decodeFounderAttendedRecoveryAccountId,
  decodeFounderAttendedRecoveryApiToken,
  listFounderAttendedExactServiceTokenNameGetOnly,
  validFounderAttendedRecoveryRepositoryIdentity,
  validateFounderAttendedRecoveryAccountId
} from "./cloudflare-founder-attended-get-only-diagnostic.mjs";
import {
  createFounderAttendedSuccessfulDiagnosticEvidence
} from "./cloudflare-founder-attended-recovery-control.mjs";

function requireDiagnosticComposition(options) {
  const valid = options
    && typeof options === "object"
    && options.confirmation
    && typeof options.confirmation.confirm === "function"
    && options.keychain
    && typeof options.keychain.hasItem === "function"
    && typeof options.keychain.readItem === "function"
    && options.transport
    && typeof options.transport.request === "function"
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

function requireFounderDiagnosticConfirmation(confirmation) {
  let confirmed = false;
  try {
    confirmed = confirmation.confirm(
      "diagnose-get-only",
      CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONFIRMATIONS["diagnose-get-only"]
    ) === true;
  } catch {
    throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
  }
  if (!confirmed) throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
}

function requireDiagnosticKeychainState(keychain) {
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

function sampleDiagnosticLiveState(clock, repositoryReader) {
  try {
    const sampledAt = clock();
    const identity = repositoryReader();
    if (!(sampledAt instanceof Date)
      || !Number.isFinite(sampledAt.getTime())
      || !validFounderAttendedRecoveryRepositoryIdentity(identity)) {
      throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
    }
    return Object.freeze({
      sampledAt: new Date(sampledAt.getTime()),
      repositoryIdentity: Object.freeze({
        commit: identity.commit,
        tree: identity.tree,
        clean: true
      })
    });
  } catch {
    throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
  }
}

function revalidateDiagnosticLiveState({
  clock,
  repositoryReader,
  baseline,
  previousSampledAt
}) {
  const current = sampleDiagnosticLiveState(clock, repositoryReader);
  const elapsed = current.sampledAt.getTime() - baseline.sampledAt.getTime();
  if (current.sampledAt.getTime() < previousSampledAt.getTime()
    || elapsed < 0
    || elapsed > CLOUDFLARE_FOUNDER_ATTENDED_RECOVERY_CONTROL_MAX_LIFETIME_MS
    || current.repositoryIdentity.commit !== baseline.repositoryIdentity.commit
    || current.repositoryIdentity.tree !== baseline.repositoryIdentity.tree) {
    throw cloudflareFounderAttendedRecoveryClassificationError("LIVE_STATE_FAILED");
  }
  return current;
}

export async function diagnoseFounderAttendedServiceTokenGetOnlyTestOnly(options) {
  const {
    confirmation,
    keychain,
    transport,
    clock,
    repositoryReader,
    accountIdSha256Allowlist,
    artifactRoot,
    randomBytesImpl,
    expectedUid
  } = requireDiagnosticComposition(options);

  let accountId = null;
  let apiToken = null;
  try {
    requireFounderDiagnosticConfirmation(confirmation);
    requireDiagnosticKeychainState(keychain);
    accountId = decodeFounderAttendedRecoveryAccountId(keychain.readItem("governedAccountId"));
    const accountIdSha256 = validateFounderAttendedRecoveryAccountId(
      accountId,
      accountIdSha256Allowlist
    );
    apiToken = decodeFounderAttendedRecoveryApiToken(keychain.readItem("temporaryApiToken"));

    const baseline = sampleDiagnosticLiveState(clock, repositoryReader);
    let lastSample = baseline;
    const result = await listFounderAttendedExactServiceTokenNameGetOnly({
      transport,
      accountId,
      apiToken,
      accountIdSha256Allowlist,
      beforeRequest() {
        lastSample = revalidateDiagnosticLiveState({
          clock,
          repositoryReader,
          baseline,
          previousSampledAt: lastSample.sampledAt
        });
      }
    });
    lastSample = revalidateDiagnosticLiveState({
      clock,
      repositoryReader,
      baseline,
      previousSampledAt: lastSample.sampledAt
    });
    createFounderAttendedSuccessfulDiagnosticEvidence({
      artifactRoot,
      now: lastSample.sampledAt,
      repositoryIdentity: lastSample.repositoryIdentity,
      accountIdSha256,
      randomBytesImpl,
      expectedUid
    });
    return result;
  } catch (error) {
    throw cloudflareFounderAttendedRecoveryClassificationError(
      classifyCloudflareFounderAttendedRecoveryError(error)
    );
  } finally {
    accountId = null;
    apiToken = null;
  }
}
