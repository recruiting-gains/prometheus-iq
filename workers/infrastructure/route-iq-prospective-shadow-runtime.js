import { AEGIS_API_HEADERS } from "./aegis-security-controls.js";
import {
  projectCommittedRouteIqFieldSessionOutcomes,
  readRouteIqFieldSessionArchive
} from "../../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";
import {
  routeIqProspectiveCoordinatorContractVersion,
  routeIqProspectiveRuntimeContextContractVersion
} from "../../data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs";
import {
  buildRouteIqEvaluationAdmissionClaims,
  buildRouteIqEvaluationFromAdmittedOutcome,
  buildRouteIqScoreableOutcomeAdmissionClaims,
  deriveRouteIqScoreableOutcomeFromCommittedEvidence,
  isRouteIqEvaluationReadinessCountEligible
} from "../../intelligence/route-iq-committed-outcome-evaluation.mjs";
import {
  ROUTE_IQ_PROSPECTIVE_ACTION_ACKNOWLEDGMENT,
  ROUTE_IQ_PROSPECTIVE_ALLOCATOR_ACKNOWLEDGMENT,
  ROUTE_IQ_PROSPECTIVE_BOOTSTRAP_CONTRACT_VERSION,
  ROUTE_IQ_PROSPECTIVE_BOOTSTRAP_TTL_SECONDS,
  ROUTE_IQ_PROSPECTIVE_BROWSER_EVENT_CONTRACT_VERSION,
  ROUTE_IQ_PROSPECTIVE_BROWSER_EVENT_KINDS,
  ROUTE_IQ_PROSPECTIVE_GOVERNED_NOOP_ACKNOWLEDGMENT,
  ROUTE_IQ_PROSPECTIVE_HANDOFF_CONTRACT,
  ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING,
  ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS,
  ROUTE_IQ_PROSPECTIVE_SHADOW_PATH,
  ROUTE_IQ_PROSPECTIVE_SHADOW_PATH_PREFIX,
  ROUTE_IQ_PROSPECTIVE_SUPPORTED_OPPORTUNITY_TYPES,
  assertExactKeys,
  canonicalIsoTimestamp,
  failRouteIqProspective,
  sha256Hex
} from "./route-iq-prospective-shadow-contract.js";
import {
  getRouteIqProspectiveActivation,
  verifyRouteIqProspectiveAccess,
  verifyRouteIqProspectiveBootstrapAccess
} from "./route-iq-prospective-shadow-access.js";
import {
  assertRouteIqProspectiveAuthorityConfig,
  createRouteIqProspectiveAuthorityEnvelope
} from "./route-iq-prospective-shadow-authority.js";
import {
  verifyRouteIqProspectiveDataRetentionAdmission
} from "./route-iq-prospective-shadow-retention-admission.js";
import {
  linkRouteIqProspectiveServerAction,
  orchestrateRouteIqProspectiveNextStop,
  recordRouteIqProspectiveStageFailure
} from "./route-iq-prospective-shadow-orchestration.js";

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...AEGIS_API_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

export function isRouteIqProspectiveShadowPath(pathname) {
  return pathname === ROUTE_IQ_PROSPECTIVE_SHADOW_PATH
    || pathname.startsWith(ROUTE_IQ_PROSPECTIVE_SHADOW_PATH_PREFIX);
}

export function routeIqProspectiveShadowDisabledResponse() {
  return jsonResponse({
    ok: true,
    acknowledged: true,
    status: "disabled",
    collection: "OFF",
    recommendationInfluence: "OFF"
  }, 202);
}

async function readBoundedJson(request) {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    failRouteIqProspective("Prospective event requires application/json.", "route_iq_prospective_content_type_invalid", 415);
  }
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength)
      || parsedLength < 0
      || parsedLength > ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS.browserBodyBytes) {
      failRouteIqProspective("Prospective event body is too large.", "route_iq_prospective_body_too_large", 413);
    }
  }
  if (!request.body) {
    failRouteIqProspective("Prospective event body is required.", "route_iq_prospective_body_missing", 400);
  }

  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS.browserBodyBytes) {
        await reader.cancel("Prospective event body is too large.");
        failRouteIqProspective("Prospective event body is too large.", "route_iq_prospective_body_too_large", 413);
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
    const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    assertExactKeys(body, ["eventKind", "informationalSequence", "informationalObservedAt"], "browserEvent");
    return body;
  } catch (error) {
    if (error?.code?.startsWith?.("route_iq_prospective_")) throw error;
    failRouteIqProspective("Prospective event body is invalid JSON.", "route_iq_prospective_body_invalid", 400);
  }
}

function validateBrowserEvent(body) {
  if (!ROUTE_IQ_PROSPECTIVE_BROWSER_EVENT_KINDS.includes(body.eventKind)) {
    failRouteIqProspective("Prospective event kind is invalid.", "route_iq_prospective_event_kind_invalid", 400);
  }
  if (body.informationalSequence !== undefined
    && (!Number.isSafeInteger(body.informationalSequence)
      || body.informationalSequence < 0
      || body.informationalSequence > 1_000_000_000)) {
    failRouteIqProspective("Prospective informational sequence is invalid.", "route_iq_prospective_sequence_invalid", 400);
  }
  if (body.informationalObservedAt !== undefined) {
    canonicalIsoTimestamp(body.informationalObservedAt, "browserEvent.informationalObservedAt");
  }
  return body;
}

function runtimeNow(noncanonicalTestHooks) {
  if (noncanonicalTestHooks?.enabled === true) {
    if (!(noncanonicalTestHooks.currentDate instanceof Date)
      || Number.isNaN(noncanonicalTestHooks.currentDate.getTime())) {
      failRouteIqProspective("Noncanonical runtime clock is invalid.", "route_iq_prospective_test_hook_invalid", 500);
    }
    return noncanonicalTestHooks.currentDate.toISOString();
  }
  return new Date().toISOString();
}

function assertRouteIqProspectiveBootstrapRuntime(env) {
  assertRouteIqProspectiveAuthorityConfig(env);
  const coordinator = env?.[ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING];
  if (!coordinator || typeof coordinator.getByName !== "function") {
    failRouteIqProspective(
      "Prospective coordinator binding is unavailable.",
      "route_iq_prospective_coordinator_binding_missing",
      503
    );
  }
  if (typeof env?.ASSETS?.fetch !== "function") {
    failRouteIqProspective(
      "Governed candidate source artifacts are unavailable.",
      "route_iq_prospective_source_binding_missing",
      503
    );
  }
}

function routeIqProspectiveBootstrapResponse({ scope, accessExpiresAt }, noncanonicalTestHooks) {
  const issuedAt = runtimeNow(noncanonicalTestHooks);
  const expiresAtMs = Math.min(
    Date.parse(issuedAt) + (ROUTE_IQ_PROSPECTIVE_BOOTSTRAP_TTL_SECONDS * 1000),
    Date.parse(accessExpiresAt)
  );
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.parse(issuedAt)) {
    failRouteIqProspective(
      "Prospective bootstrap authentication is no longer fresh.",
      "route_iq_prospective_bootstrap_auth_stale",
      403
    );
  }
  return jsonResponse({
    bootstrapContractVersion: ROUTE_IQ_PROSPECTIVE_BOOTSTRAP_CONTRACT_VERSION,
    ok: true,
    acknowledged: true,
    status: "enabled",
    collection: "ON",
    recommendationInfluence: "OFF",
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    representativeId: scope.representativeId,
    activeCohort: true,
    supportedOpportunityTypes: ROUTE_IQ_PROSPECTIVE_SUPPORTED_OPPORTUNITY_TYPES,
    eventContractVersion: ROUTE_IQ_PROSPECTIVE_BROWSER_EVENT_CONTRACT_VERSION,
    runtimeContextContractVersion: routeIqProspectiveRuntimeContextContractVersion,
    coordinatorContractVersion: routeIqProspectiveCoordinatorContractVersion,
    issuedAt,
    expiresAt: new Date(expiresAtMs).toISOString()
  });
}

async function coordinatorStubName(scope) {
  const digest = await sha256Hex({
    version: "route-iq-prospective-shadow-coordinator-route-v1",
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    representativeId: scope.representativeId
  });
  return `route-iq-prospective-shadow-v1-${digest}`;
}

async function createScopeEnvelope(scope, env, noncanonicalTestHooks) {
  return createRouteIqProspectiveAuthorityEnvelope({
    purpose: "coordinator_scope",
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    representativeId: scope.representativeId,
    registryVersion: scope.registryVersion,
    issuedAt: runtimeNow(noncanonicalTestHooks),
    territoryContext: scope.territoryContext
  }, env);
}

async function coordinatorStubForScope(scope, env) {
  const namespace = env?.[ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING];
  if (!namespace || typeof namespace.getByName !== "function") {
    failRouteIqProspective(
      "Prospective coordinator binding is unavailable.",
      "route_iq_prospective_coordinator_binding_missing",
      503
    );
  }
  return namespace.getByName(await coordinatorStubName(scope));
}

const ROUTE_IQ_PROSPECTIVE_RECOVERY_HARD_BOUND = ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS.pendingOutbox;

function recordMetric(outcome, status, eventKind = undefined) {
  console.log(JSON.stringify({
    message: "Route IQ prospective infrastructure request.",
    metric: "route_iq_prospective_shadow_request",
    outcome,
    status,
    ...(eventKind ? { eventKind } : {})
  }));
}

function safeErrorResponse(error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const code = typeof error?.code === "string" ? error.code : "route_iq_prospective_infrastructure_failed";
  const details = status < 500 && error?.details?.paths ? { paths: error.details.paths } : {};
  recordMetric("blocked", status);
  return jsonResponse({
    ok: false,
    acknowledged: false,
    code,
    message: status >= 500
      ? "Prospective event coordination is unavailable."
      : "Prospective event was rejected.",
    retryable: status === 429 || status >= 500,
    recommendationInfluence: "OFF",
    ...details
  }, status);
}

function backgroundErrorCode(error) {
  return typeof error?.code === "string" && /^route_iq_[a-z0-9_]+$/u.test(error.code)
    ? error.code
    : "route_iq_prospective_background_failed";
}

function scheduleBackgroundWork(executionContext, work, eventKind) {
  const caught = Promise.resolve()
    .then(() => work)
    .catch(error => {
      const status = Number.isInteger(error?.status) ? error.status : 500;
      console.error(JSON.stringify({
        message: "Route IQ prospective background lifecycle failed.",
        metric: "route_iq_prospective_background_failure",
        eventKind,
        code: backgroundErrorCode(error),
        status,
        retryable: status === 429 || status >= 500
      }));
      return { status: "failure_isolated" };
    });
  if (typeof executionContext?.waitUntil === "function") {
    try {
      executionContext.waitUntil(caught);
    } catch (error) {
      console.error(JSON.stringify({
        message: "Route IQ prospective background registration failed.",
        metric: "route_iq_prospective_background_failure",
        eventKind,
        code: backgroundErrorCode(error),
        status: 500,
        retryable: true
      }));
    }
  }
  return caught;
}

export async function handleRouteIqProspectiveShadowRequest(request, env, {
  executionContext,
  noncanonicalTestHooks
} = {}) {
  const activation = getRouteIqProspectiveActivation(env, {
    now: runtimeNow(noncanonicalTestHooks)
  });
  if (!activation.active) return routeIqProspectiveShadowDisabledResponse();

  try {
    const pathname = new URL(request.url).pathname;
    if (request.method === "GET" && pathname === ROUTE_IQ_PROSPECTIVE_SHADOW_PATH) {
      const access = await verifyRouteIqProspectiveBootstrapAccess(request, env, {
        cohortConfig: activation.cohortConfig,
        noncanonicalTestHooks
      });
      assertRouteIqProspectiveBootstrapRuntime(env);
      return routeIqProspectiveBootstrapResponse(access, noncanonicalTestHooks);
    }
    const scope = await verifyRouteIqProspectiveAccess(request, env, {
      cohortConfig: activation.cohortConfig,
      noncanonicalTestHooks
    });
    if (request.method !== "POST") {
      return jsonResponse({
        ok: false,
        acknowledged: false,
        code: "route_iq_prospective_method_not_allowed",
        recommendationInfluence: "OFF"
      }, 405, { Allow: "GET, POST" });
    }
    if (pathname !== ROUTE_IQ_PROSPECTIVE_SHADOW_PATH) {
      return jsonResponse({
        ok: false,
        acknowledged: false,
        code: "route_iq_prospective_path_not_found",
        recommendationInfluence: "OFF"
      }, 404);
    }

    const event = validateBrowserEvent(await readBoundedJson(request));
    const scopeEnvelope = await createScopeEnvelope(scope, env, noncanonicalTestHooks);
    const stub = await coordinatorStubForScope(scope, env);
    if (event.eventKind === "next_stop_requested") {
      const allocationReceipt = await stub.allocateNextStopOpportunity({ scopeEnvelope, event });
      scheduleBackgroundWork(executionContext, orchestrateRouteIqProspectiveNextStop({
        stub,
        scopeEnvelope,
        scope,
        allocationReceipt,
        assetOrigin: request.url,
        env,
        noncanonicalTestHooks
      }), event.eventKind);
      recordMetric("allocated", 202, event.eventKind);
      return jsonResponse(ROUTE_IQ_PROSPECTIVE_ALLOCATOR_ACKNOWLEDGMENT, 202);
    }
    if (event.eventKind === "representative_action_observed") {
      scheduleBackgroundWork(executionContext, linkRouteIqProspectiveServerAction({
        stub,
        scopeEnvelope,
        scope,
        eventKind: event.eventKind,
        authoritativeRecordTime: runtimeNow(noncanonicalTestHooks),
        env
      }), event.eventKind);
      recordMetric("action_scheduled", 202, event.eventKind);
      return jsonResponse(ROUTE_IQ_PROSPECTIVE_ACTION_ACKNOWLEDGMENT, 202);
    }
    await stub.noteGovernedRepresentativeSignal({ scopeEnvelope, event });
    recordMetric("governed_noop", 202, event.eventKind);
    return jsonResponse(ROUTE_IQ_PROSPECTIVE_GOVERNED_NOOP_ACKNOWLEDGMENT, 202);
  } catch (error) {
    return safeErrorResponse(error);
  }
}

function validateCanonicalHandoffResult(handoffResult) {
  const normalized = handoffResult?.normalizedRecord;
  if (handoffResult?.handoffContractId !== ROUTE_IQ_PROSPECTIVE_HANDOFF_CONTRACT
    || typeof handoffResult?.rawSha256 !== "string"
    || !/^[a-f0-9]{64}$/u.test(handoffResult.rawSha256)
    || normalized?.handoffContractId !== ROUTE_IQ_PROSPECTIVE_HANDOFF_CONTRACT
    || typeof normalized?.workspaceId !== "string"
    || typeof normalized?.operatingProfileId !== "string"
    || typeof normalized?.verifiedFields?.representative?.id !== "string") {
    failRouteIqProspective(
      "Canonical field-session handoff result is invalid.",
      "route_iq_prospective_handoff_result_invalid",
      500
    );
  }
  return {
    workspaceId: normalized.workspaceId,
    operatingProfileId: normalized.operatingProfileId,
    representativeId: normalized.verifiedFields.representative.id,
    sessionId: handoffResult.sessionId,
    endOfDayHandoffSha256: handoffResult.rawSha256
  };
}

async function authenticatedHandoffCoordinator(request, env, activation, handoffResult, noncanonicalTestHooks) {
  const canonicalHandoff = validateCanonicalHandoffResult(handoffResult);
  const scope = await verifyRouteIqProspectiveAccess(request, env, {
    cohortConfig: activation.cohortConfig,
    noncanonicalTestHooks
  });
  if (scope.workspaceId !== canonicalHandoff.workspaceId
    || scope.operatingProfileId !== canonicalHandoff.operatingProfileId
    || scope.representativeId !== canonicalHandoff.representativeId) {
    failRouteIqProspective(
      "Authenticated scope does not own the canonical field-session handoff.",
      "route_iq_prospective_handoff_scope_mismatch",
      403
    );
  }
  const scopeEnvelope = await createScopeEnvelope(scope, env, noncanonicalTestHooks);
  const stub = await coordinatorStubForScope(scope, env);
  return { canonicalHandoff, scope, scopeEnvelope, stub };
}

function createMonotonicRuntimeSequencer(anchorIso, noncanonicalTestHooks) {
  canonicalIsoTimestamp(anchorIso, "reconciliationReceipt.createdAt", { status: 500 });
  let priorTime = Date.parse(anchorIso);
  return () => {
    const sampledTime = Date.parse(runtimeNow(noncanonicalTestHooks));
    const nextTime = Math.max(sampledTime, priorTime + 1);
    priorTime = nextTime;
    return new Date(nextTime).toISOString();
  };
}

async function createProducerAuthorityEnvelope(claims, env) {
  return createRouteIqProspectiveAuthorityEnvelope(claims, env, { channel: "producer" });
}

function redactedLinkFailure(error, linkIndex) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  return Object.freeze({
    status: "failed",
    linkIndex,
    code: backgroundErrorCode(error),
    retryable: status === 429 || status >= 500
  });
}

async function readExactCommittedProjectionWithRecovery({
  stub,
  scopeEnvelope,
  env,
  scope,
  sourceOutcomeEvidenceSha256,
  outcomeReceipt,
  nextAuthoritativeRecordTime
}) {
  const readOnce = async () => stub.readCommittedProjectionForOutcomeArtifact({
    scopeEnvelope,
    input: {
      authorityEnvelope: await createProducerAuthorityEnvelope({
        purpose: "committed_outcome_projection_read",
        workspaceId: scope.workspaceId,
        operatingProfileId: scope.operatingProfileId,
        representativeId: scope.representativeId,
        authoritativeRecordTime: nextAuthoritativeRecordTime(),
        sourceOutcomeEvidenceSha256,
        outcomeReceipt
      }, env)
    }
  });

  try {
    return await readOnce();
  } catch (error) {
    if (error?.code !== "route_iq_coordinator_projection_recovery_pending") throw error;
  }

  for (let attempt = 1; attempt <= ROUTE_IQ_PROSPECTIVE_RECOVERY_HARD_BOUND; attempt += 1) {
    const recovered = await stub.recoverNextProjection({ scopeEnvelope });
    if (recovered?.recovered !== true) {
      failRouteIqProspective(
        "Committed outcome projection recovery did not advance.",
        "route_iq_prospective_projection_recovery_exhausted",
        409,
        { attempt }
      );
    }
    try {
      return await readOnce();
    } catch (error) {
      if (error?.code !== "route_iq_coordinator_projection_recovery_pending") throw error;
    }
  }

  failRouteIqProspective(
    "Committed outcome projection recovery exceeded its hard bound.",
    "route_iq_prospective_projection_recovery_exhausted",
    409,
    { recoveryHardBound: ROUTE_IQ_PROSPECTIVE_RECOVERY_HARD_BOUND }
  );
}

async function resolveRouteIqEvaluationRetentionEnvelope({
  scope,
  scoreableOutcome,
  outcomeReceipt,
  fieldSessionOutcomeProjection,
  env,
  noncanonicalTestHooks
}) {
  if (noncanonicalTestHooks?.enabled !== true
    || typeof noncanonicalTestHooks.readNoncanonicalDataRetentionAdmission !== "function") {
    failRouteIqProspective(
      "Authenticated Data retention input is unavailable for prospective evaluation.",
      "route_iq_prospective_retention_input_unavailable",
      409
    );
  }

  let admissionEnvelope;
  try {
    admissionEnvelope = await noncanonicalTestHooks.readNoncanonicalDataRetentionAdmission({
      scope: { ...scope },
      scoreableOutcome,
      outcomeReceipt,
      fieldSessionOutcomeProjection
    });
  } catch {
    failRouteIqProspective(
      "Noncanonical authenticated Data retention input is invalid.",
      "route_iq_prospective_test_retention_input_invalid",
      500
    );
  }
  const verified = await verifyRouteIqProspectiveDataRetentionAdmission(admissionEnvelope, {
    env,
    scope,
    scoreableOutcome,
    now: noncanonicalTestHooks.currentDate
  });
  return verified.retentionEnvelope;
}

export async function admitRouteIqProspectiveIntelligenceOutcomes({
  stub,
  scopeEnvelope,
  scope,
  env,
  fieldSessionOutcomeProjection,
  reconciliationReceipt,
  noncanonicalTestHooks
}) {
  canonicalIsoTimestamp(reconciliationReceipt?.createdAt, "reconciliationReceipt.createdAt", { status: 500 });
  const nextAuthoritativeRecordTime = createMonotonicRuntimeSequencer(
    reconciliationReceipt.createdAt,
    noncanonicalTestHooks
  );
  const processedLinks = [];
  let admittedOutcomeCount = 0;
  let admittedEvaluationCount = 0;
  let skippedEvaluationCount = 0;
  let failedLinkCount = 0;
  for (const [linkIndex, link] of (reconciliationReceipt.linked || []).entries()) {
    try {
      const scoreableOutcome = deriveRouteIqScoreableOutcomeFromCommittedEvidence({
        fieldSessionOutcomeProjection,
        reconciliationReceipt,
        sourceVisitRecordSha256: link.sourceVisitRecordSha256
      });
      if (scoreableOutcome.sourceOutcomeEvidenceSha256 !== link.evidenceSha256) {
        failRouteIqProspective(
          "Committed outcome evidence binding changed before evaluation admission.",
          "route_iq_prospective_outcome_evidence_binding_invalid",
          409
        );
      }
      const scoreableOutcomeClaims = buildRouteIqScoreableOutcomeAdmissionClaims({
        scope,
        scoreableOutcome,
        authoritativeRecordTime: nextAuthoritativeRecordTime()
      });
      const outcomeReceipt = await stub.admitIntelligenceScoreableOutcome({
        scopeEnvelope,
        input: {
          authorityEnvelope: await createProducerAuthorityEnvelope(scoreableOutcomeClaims, env)
        }
      });
      admittedOutcomeCount += 1;
      const committedProjectionRead = await readExactCommittedProjectionWithRecovery({
        stub,
        scopeEnvelope,
        env,
        scope,
        sourceOutcomeEvidenceSha256: scoreableOutcome.sourceOutcomeEvidenceSha256,
        outcomeReceipt,
        nextAuthoritativeRecordTime
      });
      if (committedProjectionRead?.ok !== true || committedProjectionRead?.found !== true || !committedProjectionRead.record) {
        failRouteIqProspective(
          "Committed outcome projection is unavailable for evaluation.",
          "route_iq_prospective_committed_projection_missing",
          409
        );
      }
      const committedProjection = committedProjectionRead.record;
      let evaluation = null;
      let evaluationReceipt = null;
      let evaluationSkipped = false;
      if (scoreableOutcome.observedOutcome.status === "observed") {
        const retentionEnvelope = await resolveRouteIqEvaluationRetentionEnvelope({
          scope,
          scoreableOutcome,
          outcomeReceipt,
          fieldSessionOutcomeProjection,
          env,
          noncanonicalTestHooks
        });
        evaluation = buildRouteIqEvaluationFromAdmittedOutcome({
          reconciliationReceipt,
          committedProjection,
          scoreableOutcome,
          outcomeReceipt,
          retentionEnvelope
        });
        if (!isRouteIqEvaluationReadinessCountEligible(evaluation)) {
          failRouteIqProspective(
            "Committed outcome evaluation is not readiness-count eligible.",
            "route_iq_prospective_evaluation_readiness_ineligible",
            409
          );
        }
        const evaluationClaims = buildRouteIqEvaluationAdmissionClaims({
          scope,
          evaluation,
          authoritativeRecordTime: nextAuthoritativeRecordTime()
        });
        evaluationReceipt = await stub.admitIntelligenceEvaluation({
          scopeEnvelope,
          input: {
            authorityEnvelope: await createProducerAuthorityEnvelope(evaluationClaims, env)
          }
        });
        admittedEvaluationCount += 1;
      } else {
        evaluationSkipped = true;
        skippedEvaluationCount += 1;
      }
      processedLinks.push({
        status: "processed",
        linkIndex,
        sourceVisitRecordSha256: link.sourceVisitRecordSha256,
        sourceOutcomeEvidenceSha256: scoreableOutcome.sourceOutcomeEvidenceSha256,
        scoreableOutcome,
        outcomeReceipt,
        committedProjection,
        evaluation,
        evaluationReceipt,
        evaluationSkipped
      });
    } catch (error) {
      const failure = redactedLinkFailure(error, linkIndex);
      failedLinkCount += 1;
      processedLinks.push(failure);
      console.error(JSON.stringify({
        message: "Route IQ prospective committed outcome link failed.",
        metric: "route_iq_prospective_background_failure",
        eventKind: "field_session_handoff",
        phase: "committed_outcome_evaluation",
        ...failure
      }));
    }
  }
  return {
    status: failedLinkCount > 0 ? "processed_with_failures" : "processed",
    totals: {
      linkedCount: (reconciliationReceipt.linked || []).length,
      admittedOutcomeCount,
      admittedEvaluationCount,
      skippedEvaluationCount,
      failedLinkCount
    },
    processedLinks
  };
}

async function closeAuthenticatedHandoff({
  completionAction,
  canonicalHandoff,
  scope,
  scopeEnvelope,
  stub,
  env,
  authoritativeRecordTime
}) {
  const authorityEnvelope = await createRouteIqProspectiveAuthorityEnvelope({
    purpose: "close_session",
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    representativeId: scope.representativeId,
    closeReason: completionAction,
    handoffContractVersion: ROUTE_IQ_PROSPECTIVE_HANDOFF_CONTRACT,
    endOfDayHandoffSha256: canonicalHandoff.endOfDayHandoffSha256,
    authoritativeRecordTime
  }, env);
  const result = await stub.closeCanonicalSession({ scopeEnvelope, authorityEnvelope });
  recordMetric("session_closed", 200);
  return result;
}

export async function closeRouteIqProspectiveSessionFromHandoff(request, env, {
  completionAction,
  handoffResult,
  noncanonicalTestHooks
} = {}) {
  const activation = getRouteIqProspectiveActivation(env, {
    now: runtimeNow(noncanonicalTestHooks)
  });
  if (!activation.active) return { status: "disabled" };
  if (!["end_route", "end_day"].includes(completionAction)) {
    failRouteIqProspective(
      "Prospective session close reason is invalid.",
      "route_iq_prospective_close_reason_invalid",
      400
    );
  }

  const authoritativeRecordTime = runtimeNow(noncanonicalTestHooks);
  const authenticated = await authenticatedHandoffCoordinator(
    request,
    env,
    activation,
    handoffResult,
    noncanonicalTestHooks
  );
  return closeAuthenticatedHandoff({
    completionAction,
    ...authenticated,
    env,
    authoritativeRecordTime
  });
}

export async function reconcileAndCloseRouteIqProspectiveSessionFromHandoff(request, env, {
  completionAction,
  handoffResult,
  noncanonicalTestHooks
} = {}) {
  const activation = getRouteIqProspectiveActivation(env, {
    now: runtimeNow(noncanonicalTestHooks)
  });
  if (!activation.active) return { status: "disabled" };
  if (!["end_route", "end_day"].includes(completionAction)) {
    failRouteIqProspective(
      "Prospective session close reason is invalid.",
      "route_iq_prospective_close_reason_invalid",
      400
    );
  }
  const authenticated = await authenticatedHandoffCoordinator(
    request,
    env,
    activation,
    handoffResult,
    noncanonicalTestHooks
  );
  const reconciliationTime = runtimeNow(noncanonicalTestHooks);
  let projection = null;
  try {
    const archived = await readRouteIqFieldSessionArchive({
      workspaceId: authenticated.scope.workspaceId,
      operatingProfileId: authenticated.scope.operatingProfileId,
      sessionId: authenticated.canonicalHandoff.sessionId
    }, { env });
    if (!archived.found || archived.record?.commit?.rawSha256 !== authenticated.canonicalHandoff.endOfDayHandoffSha256) {
      failRouteIqProspective(
        "Committed field-session archive is unavailable for prospective reconciliation.",
        "route_iq_prospective_handoff_archive_missing",
        409
      );
    }
    projection = projectCommittedRouteIqFieldSessionOutcomes({
      workspaceId: authenticated.scope.workspaceId,
      operatingProfileId: authenticated.scope.operatingProfileId,
      representativeId: authenticated.scope.representativeId,
      archiveRecord: archived.record
    });
  } catch (error) {
    await recordRouteIqProspectiveStageFailure({
      stub: authenticated.stub,
      scopeEnvelope: authenticated.scopeEnvelope,
      scope: authenticated.scope,
      env,
      stage: "outcome_reconciliation",
      authoritativeRecordTime: reconciliationTime
    }, error);
    const status = Number.isInteger(error?.status) ? error.status : 500;
    console.error(JSON.stringify({
      message: "Route IQ prospective field-session reconciliation failed.",
      metric: "route_iq_prospective_background_failure",
      eventKind: "field_session_handoff",
      code: backgroundErrorCode(error),
      status,
      retryable: status === 429 || status >= 500
    }));
  }
  const closeResult = await closeAuthenticatedHandoff({
    completionAction,
    ...authenticated,
    env,
    authoritativeRecordTime: runtimeNow(noncanonicalTestHooks)
  });
  if (!projection) return closeResult;
  try {
    const authorityEnvelope = await createRouteIqProspectiveAuthorityEnvelope({
      purpose: "field_session_reconciliation",
      workspaceId: authenticated.scope.workspaceId,
      operatingProfileId: authenticated.scope.operatingProfileId,
      representativeId: authenticated.scope.representativeId,
      authoritativeRecordTime: runtimeNow(noncanonicalTestHooks),
      projectionSha256: projection.projectionSha256,
      sourceArchiveRawSha256: projection.sourceArchive.rawSha256,
      sourceArchiveSessionSha256: projection.sourceArchive.sourceArchiveSessionSha256
    }, env);
    const reconciliationReceipt = await authenticated.stub.reconcileCommittedFieldSessionOutcomes({
      scopeEnvelope: authenticated.scopeEnvelope,
      input: { authorityEnvelope, projection }
    });
    recordMetric("field_session_reconciled", 200);
    await admitRouteIqProspectiveIntelligenceOutcomes({
      stub: authenticated.stub,
      scopeEnvelope: authenticated.scopeEnvelope,
      scope: authenticated.scope,
      env,
      fieldSessionOutcomeProjection: projection,
      reconciliationReceipt,
      noncanonicalTestHooks
    });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    console.error(JSON.stringify({
      message: "Route IQ prospective field-session reconciliation or evaluation failed after canonical close.",
      metric: "route_iq_prospective_background_failure",
      eventKind: "field_session_handoff",
      code: backgroundErrorCode(error),
      status,
      retryable: status === 429 || status >= 500
    }));
  }
  return closeResult;
}

export {
  ROUTE_IQ_PROSPECTIVE_SHADOW_PATH,
  ROUTE_IQ_PROSPECTIVE_SHADOW_PATH_PREFIX,
  getRouteIqProspectiveActivation
};
