import {
  buildCandidateManifestCoordinatorClaims,
  buildShadowDecisionSealCoordinatorClaims,
  buildSnapshotSealCoordinatorClaims,
  createImmutableAcceptedCandidateSnapshot,
  produceRouteIqNextStopCandidateManifest,
  produceShadowDecisionFromAcceptedSnapshot
} from "../../intelligence/shadow-decision-readiness-runtime.mjs";
import { defaultRouteQueueTarget } from "../../intelligence/continuous-adaptive-route-replenishment.mjs";
import {
  ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS,
  failRouteIqProspective,
  sha256Hex,
  utf8ByteLength
} from "./route-iq-prospective-shadow-contract.js";
import { createRouteIqProspectiveAuthorityEnvelope } from "./route-iq-prospective-shadow-authority.js";

export const ROUTE_IQ_PROSPECTIVE_SOURCE_ARTIFACTS = Object.freeze({
  activePool: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json",
  fullPool: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json",
  quarantinePool: "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json",
  businessHours: "data/qualified-prospects/google-qualified-businesses-v2/business-hours-v1/business-hours.json"
});

function canonicalAllocationTime(allocation) {
  const value = allocation?.authoritativeRecordTime;
  const parsed = Date.parse(value);
  if (typeof value !== "string"
    || !Number.isFinite(parsed)
    || new Date(parsed).toISOString() !== value) {
    failRouteIqProspective(
      "Canonical allocation time is unavailable.",
      "route_iq_prospective_allocation_receipt_invalid",
      500
    );
  }
  return parsed;
}

function sampleServerDate(noncanonicalTestHooks) {
  let sampled;
  if (noncanonicalTestHooks?.enabled === true
    && (typeof noncanonicalTestHooks.lifecycleNow === "function"
      || noncanonicalTestHooks.currentDate !== undefined)) {
    sampled = typeof noncanonicalTestHooks.lifecycleNow === "function"
      ? noncanonicalTestHooks.lifecycleNow()
      : noncanonicalTestHooks.currentDate;
  } else {
    sampled = new Date();
  }
  if (!(sampled instanceof Date) || Number.isNaN(sampled.getTime())) {
    failRouteIqProspective(
      "Lifecycle server clock is unavailable.",
      "route_iq_prospective_lifecycle_clock_invalid",
      500
    );
  }
  return sampled.getTime();
}

function createServerMonotonicSequencer(allocationReceipt, noncanonicalTestHooks) {
  const allocationTime = canonicalAllocationTime(allocationReceipt);
  let lastRecordTime = allocationTime;
  let sampledAllocationBoundary = false;
  return function nextServerRecordTime() {
    const sampledTime = sampleServerDate(noncanonicalTestHooks);
    if (!sampledAllocationBoundary) {
      if (allocationTime > sampledTime) {
        failRouteIqProspective(
          "Canonical allocation time is ahead of the server clock.",
          "route_iq_prospective_allocation_time_future",
          409
        );
      }
      sampledAllocationBoundary = true;
    }
    // Same-millisecond server samples advance only enough to preserve Data's strict chronology.
    const recordTime = Math.max(sampledTime, lastRecordTime + 1);
    lastRecordTime = recordTime;
    return new Date(recordTime).toISOString();
  };
}

async function readBoundedAssetText(response, path) {
  if (!response?.ok || !response.body) {
    failRouteIqProspective(
      "A governed candidate source artifact is unavailable.",
      "route_iq_prospective_source_artifact_unavailable",
      503,
      { path }
    );
  }
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength)
    && declaredLength > ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS.sourceArtifactBytes) {
    failRouteIqProspective(
      "A governed candidate source artifact exceeds its byte budget.",
      "route_iq_prospective_source_artifact_too_large",
      503,
      { path }
    );
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS.sourceArtifactBytes) {
        await reader.cancel("Route IQ prospective source artifact exceeds its byte budget.");
        failRouteIqProspective(
          "A governed candidate source artifact exceeds its byte budget.",
          "route_iq_prospective_source_artifact_too_large",
          503,
          { path }
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    failRouteIqProspective(
      "A governed candidate source artifact is not valid UTF-8.",
      "route_iq_prospective_source_artifact_invalid",
      503,
      { path }
    );
  }
}

async function loadSourceArtifacts(assetOrigin, env) {
  if (typeof env?.ASSETS?.fetch !== "function") {
    failRouteIqProspective(
      "Governed candidate source artifacts are unavailable.",
      "route_iq_prospective_source_binding_missing",
      503
    );
  }
  const entries = await Promise.all(Object.entries(ROUTE_IQ_PROSPECTIVE_SOURCE_ARTIFACTS)
    .map(async ([kind, path]) => {
      const url = new URL(`/${path}`, assetOrigin);
      const response = await env.ASSETS.fetch(new Request(url, {
        method: "GET",
        headers: { Accept: "application/json" }
      }));
      return [kind, { path, rawText: await readBoundedAssetText(response, path) }];
    }));
  const totalBytes = entries.reduce((total, [, source]) => total + utf8ByteLength(source.rawText), 0);
  if (totalBytes > ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS.sourceArtifactTotalBytes) {
    failRouteIqProspective(
      "Governed candidate sources exceed their aggregate byte budget.",
      "route_iq_prospective_source_artifacts_too_large",
      503
    );
  }
  return Object.fromEntries(entries);
}

function runtimeClaims(scope, purpose, authoritativeRecordTime, details = {}) {
  return {
    purpose,
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    representativeId: scope.representativeId,
    authoritativeRecordTime,
    ...details
  };
}

async function readRuntimeContext(stub, scopeEnvelope, scope, env, authoritativeRecordTime) {
  const authorityEnvelope = await createRouteIqProspectiveAuthorityEnvelope(
    runtimeClaims(scope, "runtime_context_read", authoritativeRecordTime),
    env
  );
  return stub.readCanonicalRuntimeContext({
    scopeEnvelope,
    input: { authorityEnvelope }
  });
}

function canonicalOpportunity(context) {
  if (context?.territorySource?.status !== "known") {
    failRouteIqProspective(
      "Canonical territory context is unavailable.",
      "route_iq_prospective_territory_context_unavailable",
      409
    );
  }
  return {
    opportunityId: context.opportunityId,
    opportunityType: context.opportunityType,
    recordOrigin: "prospective",
    scope: context.scope,
    canonicalContext: {
      territoryId: context.canonicalContext.territoryId,
      canonicalSessionRecordSha256: context.canonicalContext.canonicalSessionRecordSha256,
      sessionEventSequence: context.canonicalContext.sessionEventSequence,
      opportunityEventSequence: context.canonicalContext.opportunityEventSequence,
      triggerRecordSha256: context.canonicalContext.triggerRecordSha256
    },
    territorySource: {
      sourceRecordSha256: context.territorySource.sourceRecordSha256,
      sourceContractVersion: context.territorySource.sourceContractVersion,
      availableAt: context.territorySource.availableAt
    }
  };
}

function failureReason(error) {
  const code = typeof error?.code === "string" ? error.code : "runtime_dependency_unavailable";
  const normalized = code.toLowerCase().replace(/[^a-z0-9_]+/gu, "_").replace(/^_+|_+$/gu, "").slice(0, 80);
  return normalized || "runtime_dependency_unavailable";
}

async function recordStageExclusion({
  stub,
  scopeEnvelope,
  scope,
  env,
  context,
  stage,
  reasonCodes,
  offendingDigest,
  authoritativeRecordTime
}) {
  const authorityEnvelope = await createRouteIqProspectiveAuthorityEnvelope(runtimeClaims(
    scope,
    "runtime_stage_exclusion",
    authoritativeRecordTime,
    {
      runtimeContextReceiptSha256: context.runtimeContextReceiptSha256,
      stage,
      reasonCodes,
      offendingDigest
    }
  ), env);
  return stub.recordRuntimeStageExclusion({
    scopeEnvelope,
    input: { authorityEnvelope }
  });
}

async function tryRecordFailure(input, error) {
  try {
    const context = await readRuntimeContext(
      input.stub,
      input.scopeEnvelope,
      input.scope,
      input.env,
      input.authoritativeRecordTime
    );
    const reasonCodes = [failureReason(error)];
    await recordStageExclusion({
      ...input,
      context,
      reasonCodes,
      offendingDigest: await sha256Hex({ stage: input.stage, reasonCodes })
    });
  } catch {
    // The original failure remains authoritative; exclusion is best-effort where Data state permits it.
  }
}

export async function recordRouteIqProspectiveStageFailure(input, error) {
  return tryRecordFailure(input, error);
}

function terminalReceipt(receipt) {
  return receipt?.status === "excluded" || receipt?.state === "EXCLUDED";
}

function candidateManifestProducer(noncanonicalTestHooks) {
  if (noncanonicalTestHooks?.enabled === true
    && typeof noncanonicalTestHooks.produceCandidateManifest === "function") {
    return noncanonicalTestHooks.produceCandidateManifest;
  }
  return produceRouteIqNextStopCandidateManifest;
}

export async function orchestrateRouteIqProspectiveNextStop({
  stub,
  scopeEnvelope,
  scope,
  allocationReceipt,
  assetOrigin,
  env,
  noncanonicalTestHooks
}) {
  const nextServerRecordTime = createServerMonotonicSequencer(
    allocationReceipt,
    noncanonicalTestHooks
  );
  let stage = "runtime_orchestration";
  try {
    const readAt = nextServerRecordTime();
    let context = await readRuntimeContext(stub, scopeEnvelope, scope, env, readAt);
    const opportunity = canonicalOpportunity(context);
    stage = "candidate_manifest";
    const sourceArtifacts = await loadSourceArtifacts(assetOrigin, env);
    const manifestResult = candidateManifestProducer(noncanonicalTestHooks)({
      canonicalOpportunity: opportunity,
      sourceArtifacts,
      completedCandidateIds: context.completedCandidateIds,
      eligibilityEvaluatedAt: nextServerRecordTime(),
      evidenceCutoff: nextServerRecordTime(),
      targetSize: defaultRouteQueueTarget
    });
    if (manifestResult.disposition !== "MANIFEST_READY") {
      await recordStageExclusion({
        stub,
        scopeEnvelope,
        scope,
        env,
        context,
        stage,
        reasonCodes: manifestResult.reasonCodes,
        offendingDigest: manifestResult.exclusionRecordSha256,
        authoritativeRecordTime: nextServerRecordTime()
      });
      return { status: "excluded" };
    }

    const manifestClaims = buildCandidateManifestCoordinatorClaims({
      canonicalOpportunity: opportunity,
      manifestResult,
      authoritativeRecordTime: nextServerRecordTime()
    });
    const candidateManifestReceipt = await stub.applyTrustedCandidateManifest({
      scopeEnvelope,
      input: {
        authorityEnvelope: await createRouteIqProspectiveAuthorityEnvelope(manifestClaims.operationClaims, env),
        producerEnvelope: await createRouteIqProspectiveAuthorityEnvelope(manifestClaims.producerClaims, env, { channel: "producer" })
      }
    });
    if (terminalReceipt(candidateManifestReceipt)) return { status: "excluded" };

    stage = "snapshot_seal";
    const snapshotClaims = buildSnapshotSealCoordinatorClaims({
      canonicalOpportunity: opportunity,
      manifestResult,
      candidateManifestReceipt,
      sealedAt: nextServerRecordTime()
    });
    const snapshotSealReceipt = await stub.applyTrustedSnapshotSeal({
      scopeEnvelope,
      input: {
        authorityEnvelope: await createRouteIqProspectiveAuthorityEnvelope(snapshotClaims.operationClaims, env),
        sealEnvelope: await createRouteIqProspectiveAuthorityEnvelope(snapshotClaims.sealClaims, env)
      }
    });
    if (terminalReceipt(snapshotSealReceipt)) return { status: "excluded" };

    stage = "shadow_decision";
    const acceptedSnapshot = createImmutableAcceptedCandidateSnapshot({
      canonicalOpportunity: opportunity,
      manifestResult,
      candidateManifestReceipt,
      snapshotSealReceipt
    });
    const shadowDecision = produceShadowDecisionFromAcceptedSnapshot(acceptedSnapshot);
    const shadowClaims = buildShadowDecisionSealCoordinatorClaims({
      canonicalOpportunity: opportunity,
      acceptedSnapshot,
      shadowDecision,
      snapshotSealReceipt,
      sealedAt: nextServerRecordTime()
    });
    const shadowDecisionSealReceipt = await stub.applyTrustedShadowDecisionSeal({
      scopeEnvelope,
      input: {
        authorityEnvelope: await createRouteIqProspectiveAuthorityEnvelope(shadowClaims.operationClaims, env),
        sealEnvelope: await createRouteIqProspectiveAuthorityEnvelope(shadowClaims.sealClaims, env)
      }
    });
    if (terminalReceipt(shadowDecisionSealReceipt)) return { status: "excluded" };
    return { status: "shadow_decision_sealed" };
  } catch (error) {
    let failureRecordTime;
    try {
      failureRecordTime = nextServerRecordTime();
    } catch {
      throw error;
    }
    await tryRecordFailure({
      stub,
      scopeEnvelope,
      scope,
      env,
      stage,
      authoritativeRecordTime: failureRecordTime
    }, error);
    throw error;
  }
}

export async function linkRouteIqProspectiveServerAction({
  stub,
  scopeEnvelope,
  scope,
  eventKind,
  authoritativeRecordTime,
  env
}) {
  let context;
  try {
    context = await readRuntimeContext(stub, scopeEnvelope, scope, env, authoritativeRecordTime);
    const authorityEnvelope = await createRouteIqProspectiveAuthorityEnvelope(runtimeClaims(
      scope,
      "server_action_signal",
      authoritativeRecordTime,
      {
        runtimeContextReceiptSha256: context.runtimeContextReceiptSha256,
        eventKind
      }
    ), env);
    return await stub.linkServerDerivedNextStopAction({
      scopeEnvelope,
      input: { authorityEnvelope }
    });
  } catch (error) {
    if (context) {
      await tryRecordFailure({
        stub,
        scopeEnvelope,
        scope,
        env,
        stage: "action",
        authoritativeRecordTime
      }, error);
    }
    throw error;
  }
}
