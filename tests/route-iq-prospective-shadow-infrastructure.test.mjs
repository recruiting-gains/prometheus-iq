import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { SignJWT, createLocalJWKSet, exportJWK } from "jose";

import worker, {
  ROUTE_IQ_FIELD_SESSION_HANDOFF_PATH,
  ROUTE_IQ_PROSPECTIVE_SHADOW_PATH,
  RouteIqProspectiveShadowCoordinator,
  handleRouteIqFieldSessionHandoff
} from "../workers/prometheus-iq-worker.js";
import {
  consumeRouteIqEndOfDayHandoff,
  deriveRouteIqCandidateIdFromGooglePlaceId,
  projectCommittedRouteIqFieldSessionOutcomes,
  readRouteIqFieldSessionArchive,
  routeIqChronologicalEvidenceProjectionVersion,
  routeIqEndOfDayHandoffContractId,
  routeIqFieldSessionOutcomeProjectionVersion,
  routeIqFieldSessionStoreBinding
} from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";
import {
  computeRouteIqCandidateManifestDigests,
  routeIqCandidateManifestSchemaVersion,
  routeIqCandidateProducerContractVersion,
  routeIqCandidateProducerEnvelopeVersion,
  routeIqCandidateSourceSchemaVersion,
  routeIqCandidateSourceVersion,
  routeIqEvaluationContextSchemaVersion,
  routeIqFieldSessionOutcomeProjectionContractVersion,
  routeIqProspectiveCollectionDefault,
  routeIqProspectiveCoordinatorContractVersion,
  routeIqProspectiveCoordinatorProjectionVersion,
  routeIqProspectiveCoordinatorSchemaVersion,
  routeIqProspectiveKvAuthority,
  routeIqProspectiveRecommendationInfluence,
  routeIqProspectiveRuntimeContextContractVersion
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs";
import {
  routeIqProspectiveRetentionBoundaryContractVersion,
  routeIqProspectiveRetentionPolicyVersion
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-retention-policy.mjs";
import {
  getRouteIqProspectiveActivation,
  routeIqProspectiveCohortConfigVersion,
  routeIqProspectivePrincipalMapVersion,
  validateRouteIqProspectiveCohortConfig
} from "../workers/infrastructure/route-iq-prospective-shadow-access.js";
import {
  createRouteIqProspectiveAuthorityEnvelope,
  createRouteIqProspectiveAuthorityVerifier
} from "../workers/infrastructure/route-iq-prospective-shadow-authority.js";
import {
  ROUTE_IQ_PROSPECTIVE_ACTION_ACKNOWLEDGMENT,
  ROUTE_IQ_PROSPECTIVE_ALLOCATOR_ACKNOWLEDGMENT,
  ROUTE_IQ_PROSPECTIVE_BOOTSTRAP_CONTRACT_VERSION,
  ROUTE_IQ_PROSPECTIVE_BROWSER_EVENT_CONTRACT_VERSION,
  ROUTE_IQ_PROSPECTIVE_GOVERNED_NOOP_ACKNOWLEDGMENT,
  ROUTE_IQ_PROSPECTIVE_HANDOFF_CONTRACT,
  ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS,
  ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING,
  ROUTE_IQ_PROSPECTIVE_SHADOW_CLASS,
  ROUTE_IQ_PROSPECTIVE_SHADOW_ENV,
  sha256Hex
} from "../workers/infrastructure/route-iq-prospective-shadow-contract.js";
import {
  auditRouteIqProspectiveActivationReadiness,
  routeIqProspectiveActivationReadinessVersion
} from "../workers/infrastructure/route-iq-prospective-shadow-readiness.js";
import {
  closeRouteIqProspectiveSessionFromHandoff,
  admitRouteIqProspectiveIntelligenceOutcomes,
  handleRouteIqProspectiveShadowRequest
} from "../workers/infrastructure/route-iq-prospective-shadow-runtime.js";
import {
  routeIqProspectiveDataRetentionAdmissionVersion,
  verifyRouteIqProspectiveDataRetentionAdmission
} from "../workers/infrastructure/route-iq-prospective-shadow-retention-admission.js";
import {
  CloudflareRouteIqProspectiveSqliteRepository
} from "../workers/infrastructure/route-iq-prospective-shadow-durable-object.js";
import {
  ROUTE_IQ_PROSPECTIVE_SOURCE_ARTIFACTS,
  linkRouteIqProspectiveServerAction,
  orchestrateRouteIqProspectiveNextStop
} from "../workers/infrastructure/route-iq-prospective-shadow-orchestration.js";
import {
  buildRouteIqEvaluationAdmissionClaims,
  buildRouteIqEvaluationFromAdmittedOutcome,
  buildRouteIqScoreableOutcomeAdmissionClaims,
  computeRouteIqCommittedOutcomeSha256,
  deriveRouteIqScoreableOutcomeFromCommittedEvidence
} from "../intelligence/route-iq-committed-outcome-evaluation.mjs";
import {
  verifyRouteIqProspectiveWorkerDispatchSource
} from "../scripts/lib/route-iq-prospective-shadow-worker-dispatch-verifier.mjs";
import {
  produceRouteIqNextStopCandidateManifest,
  shadowDecisionProspectiveDispositionSchemaVersion,
  shadowDecisionRankingBasisVersion
} from "../intelligence/shadow-decision-readiness-runtime.mjs";

const root = resolve(import.meta.dirname, "..");
const testNow = new Date("2026-07-13T20:00:00.000Z");
const testIssuer = new URL(`https://${["noncanonical-test", "cloudflareaccess", "com"].join(".")}`).origin;
const accessKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const accessAudience = randomBytes(24).toString("hex");

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function authorityEnv() {
  return {
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.authorityKey]: randomBytes(48).toString("base64url"),
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.authorityKeyVersion]: `noncanonical-test-${randomUUID()}`
  };
}

function scope(representativeId = "cruz") {
  return {
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId
  };
}

function cohortConfig(representativeId = "cruz", {
  now = testNow,
  state = "ACTIVE",
  supportedOpportunityTypes = ["next_stop"],
  scopes = [scope(representativeId)],
  issuedAt = now.toISOString(),
  expiresAt = new Date(now.getTime() + (60 * 60 * 1000)).toISOString(),
  version = routeIqProspectiveCohortConfigVersion
} = {}) {
  return JSON.stringify({
    version,
    state,
    issuedAt,
    expiresAt,
    supportedOpportunityTypes,
    scopes
  });
}

function readinessObservation({
  fixtureKind = "collection_off",
  endpointState = "disabled",
  endpointHttpStatus = 202,
  activeCohortCount = 0,
  overrides = {},
  usage = {}
} = {}) {
  return {
    fixtureKind,
    productionAccessUsed: false,
    endpointState,
    endpointHttpStatus,
    attemptedApplicationWrites: 0,
    activeCohortCount,
    durableObjectInstanceCount: 0,
    kvWriteCount: 0,
    prospectiveRecordCount: 0,
    conflictCount: 0,
    exclusionCount: 0,
    evaluationCount: 0,
    archiveDispositionConsumerExclusionVerified: true,
    recommendationInfluence: "OFF",
    usage: {
      browserBodyBytes: 0,
      candidateCount: 0,
      domainCommandBytes: 0,
      eventsPerDay: 0,
      opportunitiesPerSession: 0,
      pendingOutbox: 0,
      principals: 0,
      rowsReadPerRpc: 0,
      rowsWrittenPerRpc: 0,
      sourceArtifactBytes: 0,
      sourceArtifactTotalBytes: 0,
      sourceCount: 0,
      sqlStatementsPerRpc: 0,
      storageBytesPerCoordinator: 0,
      ...usage
    },
    ...overrides
  };
}

function territoryContext(representativeId = "cruz") {
  return {
    status: "known",
    territoryId: `riq_territory_${digest(`territory:${representativeId}`)}`,
    sourceRecordSha256: digest(`territory-source:${representativeId}`),
    sourceContractVersion: "route-iq-trusted-territory-context-v1",
    availableAt: "2026-07-12T18:00:00.000Z"
  };
}

function noncanonicalFieldSessionId(representativeId = "cruz") {
  return `route-iq-field-session-fitness-connection-fitness-${representativeId}-2026-07-13`;
}

function buildNoncanonicalAuthenticatedDataRetentionEnvelope({
  scope: evaluationScope,
  scoreableOutcome,
  outcomeReceipt,
  fieldSessionOutcomeProjection
}) {
  assert.equal(
    scoreableOutcome.sourceArchiveRawSha256,
    fieldSessionOutcomeProjection.sourceArchive.rawSha256
  );
  assert.equal(
    fieldSessionOutcomeProjection.sourceArchive.sourceArchiveSessionSha256,
    committedDigest(noncanonicalFieldSessionId(evaluationScope.representativeId))
  );
  const expiresAt = new Date(
    Date.parse(outcomeReceipt.authoritativeRecordTime) + (30 * 24 * 60 * 60 * 1000)
  ).toISOString();
  return {
    workspaceId: evaluationScope.workspaceId,
    operatingProfileId: evaluationScope.operatingProfileId,
    representativeId: evaluationScope.representativeId,
    collectionState: "on",
    recommendationInfluence: "off",
    recordOrigin: "prospective",
    policyVersion: routeIqProspectiveRetentionPolicyVersion,
    retentionBoundary: {
      contractVersion: routeIqProspectiveRetentionBoundaryContractVersion,
      authorizationState: "authorized_existing_field_session_boundary",
      source: "authenticated_data_retention_contract",
      expiresAt
    },
    evaluatedAt: outcomeReceipt.authoritativeRecordTime,
    deletionCapabilityStatus: "verified_not_activated",
    legalHoldState: "none",
    derivedProjectionExpiresAt: expiresAt,
    sourceSession: {
      coordinatorSessionId: outcomeReceipt.sessionId,
      fieldSessionId: noncanonicalFieldSessionId(evaluationScope.representativeId),
      rawSha256: fieldSessionOutcomeProjection.sourceArchive.rawSha256,
      consumptionEligibility: {
        eligible: true,
        state: "NOT_ADMINISTRATIVELY_EXCLUDED",
        reason: null,
        auditOnly: false,
        excludedDomains: []
      }
    }
  };
}

async function readNoncanonicalDataRetentionAdmission(input, env) {
  const issuedAt = testNow.toISOString();
  return createRouteIqProspectiveAuthorityEnvelope({
    purpose: "data_retention_admission",
    admissionVersion: routeIqProspectiveDataRetentionAdmissionVersion,
    admissionState: "RETENTION_ADMITTED",
    issuedAt,
    expiresAt: new Date(testNow.getTime() + 60_000).toISOString(),
    scope: { ...input.scope },
    sourceOutcomeEvidenceSha256: input.scoreableOutcome.sourceOutcomeEvidenceSha256,
    sourceArchiveRawSha256: input.scoreableOutcome.sourceArchiveRawSha256,
    retentionEnvelope: buildNoncanonicalAuthenticatedDataRetentionEnvelope(input)
  }, env, { channel: "producer" });
}

async function principalMap(subject, representativeId = "cruz") {
  return JSON.stringify({
    version: routeIqProspectivePrincipalMapVersion,
    principals: [{
      accessSubjectSha256: await sha256Hex(subject),
      ...scope(representativeId),
      registryVersion: "noncanonical-test-registry-v1",
      territoryContext: territoryContext(representativeId)
    }]
  });
}

const prospectiveCompatibilityFixtureVersion =
  "route-iq-prospective-collection-on-compatibility-fixture-v1";
const prospectiveCompatibilityAvailableAt = "2026-07-12T18:00:00.000Z";
const prospectiveCompatibilityCandidates = Object.freeze([
  Object.freeze({
    id: "synthetic-field-account-alpha",
    googlePlaceId: "ChIJRouteIqSyntheticAlpha001",
    repProfileId: "cruz",
    name: "Synthetic Field Account Alpha",
    address: "Noncanonical fixture location alpha",
    category: "Synthetic",
    qualityScore: 90,
    qualityReason: "Explicit isolated compatibility fixture",
    sourceType: "SYNTHETIC_NONCANONICAL",
    seedRouteOrder: 1
  }),
  Object.freeze({
    id: "synthetic-field-account-beta",
    googlePlaceId: "ChIJRouteIqSyntheticBeta002",
    repProfileId: "cruz",
    name: "Synthetic Field Account Beta",
    address: "Noncanonical fixture location beta",
    category: "Synthetic",
    qualityScore: 60,
    qualityReason: "Explicit isolated compatibility fixture",
    sourceType: "SYNTHETIC_NONCANONICAL",
    seedRouteOrder: 2
  })
]);

function prospectiveCompatibilityProvenance(kind) {
  return {
    fixtureKind: "noncanonical_collection_on_compatibility",
    fixtureVersion: prospectiveCompatibilityFixtureVersion,
    dataClassification: "SYNTHETIC_NONCANONICAL",
    approvalState: "APPROVED_SYNTHETIC_VALIDATION",
    productionEvidenceEligible: false,
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz",
    sourceKind: kind,
    availableAt: prospectiveCompatibilityAvailableAt
  };
}

function buildProspectiveCompatibilityFixture() {
  const runtimeRecords = prospectiveCompatibilityCandidates.map(candidate => ({ ...candidate }));
  const activeRecords = prospectiveCompatibilityCandidates.map(candidate => ({
    googlePlaceId: candidate.googlePlaceId,
    runtimeProfiles: [{
      repProfileId: candidate.repProfileId,
      qualityScore: candidate.qualityScore,
      seedRouteOrder: candidate.seedRouteOrder,
      qualityClass: "Synthetic validation only"
    }]
  }));
  const businessHoursRecords = prospectiveCompatibilityCandidates.map(candidate => ({
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    googlePlaceId: candidate.googlePlaceId,
    businessTimezone: "America/Chicago",
    sourceRetrievedAt: prospectiveCompatibilityAvailableAt,
    hoursVerifiedAt: prospectiveCompatibilityAvailableAt,
    hoursFreshnessStatus: "FRESH_SYNTHETIC_VALIDATION",
    hoursConfidence: "HIGH",
    currentOpenClosedEligibilityStatus: "OPEN_VERIFIED_SYNTHETIC",
    currentStatusReasonCode: "SYNTHETIC_COMPATIBILITY_WINDOW",
    currentStatusReason: "Noncanonical compatibility fixture only.",
    currentStatusEvaluatedAt: "2026-07-13T20:00:00.000Z"
  }));
  const bodies = {
    activePool: {
      provenance: prospectiveCompatibilityProvenance("activePool"),
      sourceDatasetVersion: "synthetic-route-iq-compatibility-v1",
      segmentationVersion: "synthetic-approved-segmentation-v1",
      pool: "active",
      count: activeRecords.length,
      records: activeRecords
    },
    fullPool: {
      provenance: prospectiveCompatibilityProvenance("fullPool"),
      dataset_version: "synthetic-route-iq-compatibility-v1",
      cruz: runtimeRecords,
      anthony: []
    },
    quarantinePool: {
      provenance: prospectiveCompatibilityProvenance("quarantinePool"),
      sourceDatasetVersion: "synthetic-route-iq-compatibility-v1",
      segmentationVersion: "synthetic-approved-segmentation-v1",
      pool: "quarantine",
      count: 0,
      records: []
    },
    businessHours: {
      provenance: prospectiveCompatibilityProvenance("businessHours"),
      schemaVersion: "prometheus-data-business-hours-v1",
      artifactVersion: "synthetic-business-hours-v1",
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      recordCount: businessHoursRecords.length,
      records: businessHoursRecords
    }
  };
  const rawByKind = Object.fromEntries(
    Object.entries(bodies).map(([kind, value]) => [kind, JSON.stringify(value, null, 2)])
  );
  return Object.freeze({
    bodies: Object.freeze(bodies),
    rawByKind: Object.freeze(rawByKind),
    runtimePools: bodies.fullPool,
    activePool: bodies.activePool,
    businessHours: bodies.businessHours
  });
}

const prospectiveCompatibilityFixture = buildProspectiveCompatibilityFixture();

function prospectiveCompatibilityAssets() {
  const rawByPath = new Map(Object.entries(ROUTE_IQ_PROSPECTIVE_SOURCE_ARTIFACTS)
    .map(([kind, path]) => [path, prospectiveCompatibilityFixture.rawByKind[kind]]));
  return {
    async fetch(request) {
      const pathname = new URL(request.url).pathname.replace(/^\/+/, "");
      const rawText = rawByPath.get(pathname);
      return rawText === undefined
        ? new Response("Not found", { status: 404 })
        : new Response(rawText, {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8" }
        });
    }
  };
}

function productionCandidateSourceArtifacts() {
  return Object.fromEntries(Object.entries(ROUTE_IQ_PROSPECTIVE_SOURCE_ARTIFACTS)
    .map(([kind, path]) => [kind, {
      path,
      rawText: readFileSync(join(root, path), "utf8")
    }]));
}

function parseProspectiveCompatibilitySources(sourceArtifacts) {
  assert.deepEqual(
    Object.keys(sourceArtifacts).sort(),
    Object.keys(ROUTE_IQ_PROSPECTIVE_SOURCE_ARTIFACTS).sort()
  );
  return Object.fromEntries(Object.entries(ROUTE_IQ_PROSPECTIVE_SOURCE_ARTIFACTS)
    .map(([kind, path]) => {
      const source = sourceArtifacts[kind];
      assert.equal(source.path, path);
      assert.equal(source.rawText, prospectiveCompatibilityFixture.rawByKind[kind]);
      const value = JSON.parse(source.rawText);
      assert.deepEqual(value.provenance, prospectiveCompatibilityProvenance(kind));
      return [kind, {
        path,
        rawText: source.rawText,
        value,
        sourceRecordSha256: digest(source.rawText),
        sourceRecordId: `riq_source_${digest(`${path}|${digest(source.rawText)}`)}`
      }];
    }));
}

function produceProspectiveCompatibilityCandidateManifest(input) {
  assert.deepEqual(Object.keys(input).sort(), [
    "canonicalOpportunity",
    "completedCandidateIds",
    "eligibilityEvaluatedAt",
    "evidenceCutoff",
    "sourceArtifacts",
    "targetSize"
  ]);
  assert.deepEqual(input.canonicalOpportunity.scope, scope());
  assert.equal(input.canonicalOpportunity.recordOrigin, "prospective");
  assert.equal(input.canonicalOpportunity.opportunityType, "next_stop");
  assert.equal(input.canonicalOpportunity.canonicalContext.territoryId, territoryContext().territoryId);
  assert.equal(input.targetSize, 15);
  assert.equal(Array.isArray(input.completedCandidateIds), true);
  const evaluatedAt = new Date(input.eligibilityEvaluatedAt);
  const evidenceCutoff = new Date(input.evidenceCutoff);
  assert.equal(Number.isNaN(evaluatedAt.getTime()), false);
  assert.equal(Number.isNaN(evidenceCutoff.getTime()), false);
  assert.equal(evaluatedAt.getTime() < evidenceCutoff.getTime(), true);

  const sources = parseProspectiveCompatibilitySources(input.sourceArtifacts);
  const territorySourceRecord = {
    sourceRecordId: `riq_source_${digest([
      input.canonicalOpportunity.canonicalContext.territoryId,
      input.canonicalOpportunity.territorySource.sourceRecordSha256,
      input.canonicalOpportunity.territorySource.sourceContractVersion
    ].join("|"))}`,
    sourceSchemaVersion: routeIqCandidateSourceSchemaVersion,
    sourceVersion: routeIqCandidateSourceVersion,
    sourceRecordSha256: input.canonicalOpportunity.territorySource.sourceRecordSha256,
    availableAt: input.canonicalOpportunity.territorySource.availableAt
  };
  const sourceManifest = [
    territorySourceRecord,
    ...Object.values(sources).map(source => ({
      sourceRecordId: source.sourceRecordId,
      sourceSchemaVersion: routeIqCandidateSourceSchemaVersion,
      sourceVersion: routeIqCandidateSourceVersion,
      sourceRecordSha256: source.sourceRecordSha256,
      availableAt: source.value.provenance.availableAt
    }))
  ].sort((left, right) => left.sourceRecordId.localeCompare(right.sourceRecordId));
  const sourceRecordIds = sourceManifest.map(source => source.sourceRecordId);
  const completed = new Set(input.completedCandidateIds);
  const selected = prospectiveCompatibilityCandidates
    .filter(candidate => !completed.has(
      deriveRouteIqCandidateIdFromGooglePlaceId(candidate.googlePlaceId)
    ))
    .slice(0, input.targetSize);
  if (!selected.length) {
    const exclusion = {
      schemaVersion: shadowDecisionProspectiveDispositionSchemaVersion,
      disposition: "EXCLUDED",
      opportunityId: input.canonicalOpportunity.opportunityId,
      reasonCodes: ["candidate_set_empty_after_governed_exclusions"],
      canonicalProductionEvidenceEligible: false,
      recommendationInfluence: "OFF"
    };
    return {
      ...exclusion,
      exclusionRecordSha256: digest(JSON.stringify(exclusion))
    };
  }
  const totalScore = selected.reduce((total, candidate) => total + candidate.qualityScore, 0);
  const candidates = selected.map((candidate, index) => ({
    candidateId: deriveRouteIqCandidateIdFromGooglePlaceId(candidate.googlePlaceId),
    sourceRecordIds,
    eligibility: {
      status: "eligible",
      reasonCodes: [
        "explicit_noncanonical_compatibility_fixture",
        "synthetic_approved_candidate",
        "territory_permitted"
      ].sort(),
      evaluatedAt: evaluatedAt.toISOString()
    },
    rankingContext: {
      producerSubsystem: "Prometheus Intelligence Engine",
      ordinal: index + 1,
      probability: candidate.qualityScore / totalScore,
      basisVersion: shadowDecisionRankingBasisVersion
    }
  }));
  const digestInput = {
    territoryId: input.canonicalOpportunity.canonicalContext.territoryId,
    evidenceCutoff: evidenceCutoff.toISOString(),
    envelopeVersion: routeIqCandidateProducerEnvelopeVersion,
    producerSubsystem: "Prometheus Intelligence Engine",
    producerContractVersion: routeIqCandidateProducerContractVersion,
    schemaVersion: routeIqCandidateManifestSchemaVersion,
    dataProjectionVersion: routeIqChronologicalEvidenceProjectionVersion,
    candidates,
    sourceManifest
  };
  const digests = computeRouteIqCandidateManifestDigests(digestInput);
  const producerClaims = {
    purpose: "candidate_manifest",
    ...input.canonicalOpportunity.scope,
    ...input.canonicalOpportunity.canonicalContext,
    ...digestInput,
    candidateCount: digests.candidateCount,
    sourceCount: digests.sourceCount,
    candidateManifestSha256: digests.candidateManifestSha256,
    sourceManifestSha256: digests.sourceManifestSha256,
    completeManifestSha256: digests.completeManifestSha256
  };
  return {
    schemaVersion: shadowDecisionProspectiveDispositionSchemaVersion,
    disposition: "MANIFEST_READY",
    opportunityId: input.canonicalOpportunity.opportunityId,
    producerClaims,
    operationExpectations: {
      expectedCandidateCount: digests.candidateCount,
      expectedSourceCount: digests.sourceCount,
      expectedCompleteManifestSha256: digests.completeManifestSha256
    },
    governedAudit: {
      fixtureKind: "noncanonical_collection_on_compatibility",
      fixtureVersion: prospectiveCompatibilityFixtureVersion,
      canonicalProductionEvidenceEligible: false,
      recommendationInfluence: "OFF"
    },
    canonicalProductionEvidenceEligible: false,
    recommendationInfluence: "OFF"
  };
}

async function accessFixture({
  mappedRepresentativeId = "cruz",
  cohortRepresentativeId = "cruz",
  expired = false,
  tokenAudience = accessAudience,
  closeImplementation = null,
  reconciliationImplementation = null,
  scoreableOutcomeAdmissionImplementation = null,
  evaluationAdmissionImplementation = null,
  committedProjectionReadImplementation = null,
  recoverProjectionImplementation = null,
  allocationAuthoritativeRecordTime = testNow.toISOString(),
  lifecycleDates = null
} = {}) {
  const subject = randomUUID();
  const publicJwk = await exportJWK(accessKeys.publicKey);
  publicJwk.alg = "RS256";
  publicJwk.kid = randomUUID();
  const keyResolver = createLocalJWKSet({ keys: [publicJwk] });
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: publicJwk.kid })
    .setIssuer(testIssuer)
    .setAudience(tokenAudience)
    .setSubject(subject)
    .setIssuedAt(Math.floor(testNow.getTime() / 1000) - 60)
    .setExpirationTime(Math.floor(testNow.getTime() / 1000) + (expired ? -1 : 3600))
    .sign(accessKeys.privateKey);
  const names = [];
  const calls = [];
  const commands = [];
  const opportunityId = `riq_opportunity_${digest("private-opportunity")}`;
  const canonicalContext = {
    territoryId: territoryContext(mappedRepresentativeId).territoryId,
    canonicalSessionRecordSha256: digest("private-session-record"),
    sessionEventSequence: 0,
    opportunityEventSequence: 0,
    triggerRecordSha256: digest("private-trigger-record"),
    canonicalEventBoundarySha256: digest("private-trigger-boundary")
  };
  let runtimeState = "TRIGGERED";
  const runtimeContext = () => {
    const body = {
      runtimeContextContractVersion: "route-iq-prospective-runtime-context-v1",
      authority: "sqlite_durable_object_coordinator",
      coordinatorId: `riq_coordinator_${digest("private-coordinator")}`,
      scope: scope(mappedRepresentativeId),
      opportunityId,
      opportunityType: "next_stop",
      state: runtimeState,
      canonicalContext,
      completedCandidateIds: [],
      territorySource: territoryContext(mappedRepresentativeId),
      candidateCompletenessStatus: runtimeState === "TRIGGERED"
        ? "pending_authenticated_intelligence_manifest"
        : "authenticated_intelligence_manifest_present",
      recommendationInfluence: "off",
      collectionDefault: "off"
    };
    return { ...body, runtimeContextReceiptSha256: digest(JSON.stringify(body)) };
  };
  const env = {
    ...authorityEnv(),
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.collection]: "ON",
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.cohortConfig]: cohortConfig(cohortRepresentativeId),
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.accessTeamDomain]: testIssuer,
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.accessAudience]: accessAudience,
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.principalMap]: await principalMap(subject, mappedRepresentativeId),
    ASSETS: prospectiveCompatibilityAssets(),
    [ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING]: {
      getByName(name) {
        calls.push("do_lookup");
        names.push(name);
        return {
          async allocateNextStopOpportunity(command) {
            calls.push("allocator_rpc");
            commands.push(command);
            assert.equal(command.event.eventKind, "next_stop_requested");
            return {
              status: "recorded",
              sessionId: `riq_session_${digest("private-session")}`,
              opportunityId,
              operationKind: "server_allocate_next_stop",
              authoritativeRecordTime: allocationAuthoritativeRecordTime,
              candidateCompletenessStatus: "pending_authenticated_intelligence_manifest",
              canonicalContext
            };
          },
          async readCanonicalRuntimeContext(command) {
            calls.push("runtime_context_rpc");
            commands.push(command);
            return runtimeContext();
          },
          async recordRuntimeStageExclusion(command) {
            calls.push("runtime_exclusion_rpc");
            commands.push(command);
            runtimeState = "EXCLUDED";
            return { status: "excluded", state: "EXCLUDED" };
          },
          async applyTrustedCandidateManifest(command) {
            calls.push("candidate_manifest_rpc");
            commands.push(command);
            const claims = command.input.producerEnvelope.claims;
            runtimeState = "SNAPSHOT_PENDING_SEAL";
            return {
              coordinatorContractVersion: "route-iq-prospective-coordinator-contract-v1",
              operationKind: "candidate_manifest",
              state: runtimeState,
              opportunityId,
              artifactId: `riq_snapshot_${digest("private-snapshot")}`,
              recordSha256: digest("private-snapshot-record"),
              authoritativeRecordTime: command.input.authorityEnvelope.claims.authoritativeRecordTime,
              candidateManifestSha256: claims.candidateManifestSha256,
              completeManifestSha256: claims.completeManifestSha256,
              recommendationInfluence: "off",
              collectionDefault: "off"
            };
          },
          async applyTrustedSnapshotSeal(command) {
            calls.push("snapshot_seal_rpc");
            commands.push(command);
            runtimeState = "SNAPSHOT_SEALED";
            return {
              coordinatorContractVersion: "route-iq-prospective-coordinator-contract-v1",
              operationKind: "snapshot_seal",
              state: runtimeState,
              opportunityId,
              artifactId: `riq_snapshot_seal_${digest("private-snapshot-seal")}`,
              recordSha256: digest("private-snapshot-seal-record"),
              authoritativeRecordTime: command.input.authorityEnvelope.claims.authoritativeRecordTime,
              keyedSealVerified: true,
              recommendationInfluence: "off",
              collectionDefault: "off"
            };
          },
          async applyTrustedShadowDecisionSeal(command) {
            calls.push("shadow_decision_seal_rpc");
            commands.push(command);
            runtimeState = "SHADOW_DECISION_SEALED";
            return {
              coordinatorContractVersion: "route-iq-prospective-coordinator-contract-v1",
              operationKind: "shadow_decision_seal",
              state: runtimeState,
              opportunityId,
              artifactId: `riq_seal_${digest("private-shadow-seal")}`,
              recordSha256: digest("private-shadow-seal-record"),
              authoritativeRecordTime: command.input.authorityEnvelope.claims.authoritativeRecordTime,
              recommendationInfluence: "off",
              collectionDefault: "off"
            };
          },
          async linkServerDerivedNextStopAction(command) {
            calls.push("server_action_rpc");
            commands.push(command);
            runtimeState = "ACTION_LINKED";
            return { status: "recorded", state: runtimeState };
          },
          async reconcileCommittedFieldSessionOutcomes(command) {
            calls.push("field_session_reconciliation_rpc");
            commands.push(command);
            if (reconciliationImplementation) return reconciliationImplementation(command);
            return {
              status: "reconciled",
              linked: [],
              exclusions: [],
              createdAt: testNow.toISOString()
            };
          },
          async admitIntelligenceScoreableOutcome(command) {
            calls.push("scoreable_outcome_admission_rpc");
            commands.push(command);
            if (scoreableOutcomeAdmissionImplementation) return scoreableOutcomeAdmissionImplementation(command);
            return {
              coordinatorContractVersion: routeIqProspectiveCoordinatorContractVersion,
              status: "recorded",
              coordinatorId: `riq_coordinator_${digest("private-coordinator")}`,
              sessionId: `riq_session_${digest("private-session")}`,
              opportunityId,
              operationKey: "scoreable-outcome:test",
              operationKind: "scoreable_outcome_admission",
              requestSha256: digest("private-scoreable-request"),
              artifactId: committedId("outcome", "private"),
              recordSha256: committedDigest("private-outcome-record"),
              recordSequence: 8,
              authoritativeRecordTime: committedOutcomeTimes.outcomeAdmitted,
              state: "OUTCOME_LINKED",
              recoveryOutboxPersisted: true,
              recommendationInfluence: routeIqProspectiveRecommendationInfluence,
              collectionDefault: routeIqProspectiveCollectionDefault,
              sourceOutcomeEvidenceSha256: command.input.authorityEnvelope.claims.sourceOutcomeEvidenceSha256,
              evaluationContextSha256: command.input.authorityEnvelope.claims.evaluationContextSha256,
              evaluatedCandidateId: committedId("candidate", "private"),
              calculatedByData: false
            };
          },
          async admitIntelligenceEvaluation(command) {
            calls.push("evaluation_admission_rpc");
            commands.push(command);
            if (evaluationAdmissionImplementation) return evaluationAdmissionImplementation(command);
            return {
              coordinatorContractVersion: routeIqProspectiveCoordinatorContractVersion,
              status: "recorded",
              coordinatorId: `riq_coordinator_${digest("private-coordinator")}`,
              sessionId: `riq_session_${digest("private-session")}`,
              opportunityId,
              operationKey: "evaluation:test",
              operationKind: "evaluation_admission",
              requestSha256: digest("private-evaluation-request"),
              artifactId: committedId("evaluation", "private"),
              recordSha256: committedDigest("private-evaluation-record"),
              recordSequence: 9,
              authoritativeRecordTime: "2026-07-13T20:10:00.000Z",
              state: "EVALUATED",
              recoveryOutboxPersisted: true,
              recommendationInfluence: routeIqProspectiveRecommendationInfluence,
              collectionDefault: routeIqProspectiveCollectionDefault,
              sourceOutcomeEvidenceSha256: command.input.authorityEnvelope.claims.sourceOutcomeEvidenceSha256,
              evaluationContextSha256: command.input.authorityEnvelope.claims.evaluationContextSha256,
              fullEvaluationPersisted: true
            };
          },
          async readCommittedProjectionForOutcomeArtifact(command) {
            calls.push("exact_outcome_projection_read_rpc");
            commands.push(command);
            if (committedProjectionReadImplementation) return committedProjectionReadImplementation(command);
            throw Object.assign(new Error("Noncanonical exact outcome projection read missing."), {
              code: "route_iq_exact_outcome_projection_source_missing",
              status: 409
            });
          },
          async recoverNextProjection(command) {
            calls.push("projection_recovery_rpc");
            commands.push(command);
            if (recoverProjectionImplementation) return recoverProjectionImplementation(command);
            return { recovered: false };
          },
          async noteGovernedRepresentativeSignal(command) {
            calls.push("governed_noop_rpc");
            commands.push(command);
            assert.match(command.event.eventKind, /^representative_(action|outcome)_observed$/u);
            return { status: "governed_noop" };
          },
          async closeCanonicalSession(command) {
            calls.push("close_rpc");
            commands.push(command);
            assert.equal(command.authorityEnvelope.claims.purpose, "close_session");
            if (closeImplementation) return closeImplementation(command);
            return {
              status: "closed",
              sessionId: `riq_session_${digest("private-session")}`,
              requestSha256: digest("private-close-receipt")
            };
          }
        };
      }
    }
  };
  const noncanonicalTestHooks = {
    enabled: true,
    currentDate: testNow,
    produceCandidateManifest: produceProspectiveCompatibilityCandidateManifest,
    readNoncanonicalDataRetentionAdmission(input) {
      return readNoncanonicalDataRetentionAdmission(input, env);
    },
    lifecycleNow() {
      calls.push("lifecycle_server_clock");
      if (!lifecycleDates?.length) return new Date(testNow);
      const index = Math.min(
        calls.filter(call => call === "lifecycle_server_clock").length - 1,
        lifecycleDates.length - 1
      );
      return new Date(lifecycleDates[index]);
    },
    async keyResolver(...args) {
      calls.push("access_signature");
      return keyResolver(...args);
    }
  };
  return { env, token, names, calls, commands, noncanonicalTestHooks };
}

function eventRequest(body, token = null, headers = {}) {
  return new Request(`https://private.invalid${ROUTE_IQ_PROSPECTIVE_SHADOW_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Cf-Access-Jwt-Assertion": token } : {}),
      ...headers
    },
    body: JSON.stringify(body)
  });
}

function bootstrapRequest(token = null, pathname = ROUTE_IQ_PROSPECTIVE_SHADOW_PATH) {
  return new Request(`https://private.invalid${pathname}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(token ? { "Cf-Access-Jwt-Assertion": token } : {})
    }
  });
}

function lifecycleRecordTimes(commands) {
  const runtimeContext = commands.find(command =>
    command.input?.authorityEnvelope?.claims?.purpose === "runtime_context_read");
  const manifest = commands.find(command =>
    command.input?.authorityEnvelope?.claims?.purpose === "candidate_manifest");
  const snapshot = commands.find(command =>
    command.input?.authorityEnvelope?.claims?.purpose === "snapshot_seal_record");
  const shadow = commands.find(command =>
    command.input?.authorityEnvelope?.claims?.purpose === "shadow_decision_seal_record");
  assert.ok(runtimeContext && manifest && snapshot && shadow, "complete lifecycle commands must exist");
  return [
    runtimeContext.input.authorityEnvelope.claims.authoritativeRecordTime,
    manifest.input.producerEnvelope.claims.candidates[0].eligibility.evaluatedAt,
    manifest.input.producerEnvelope.claims.evidenceCutoff,
    manifest.input.authorityEnvelope.claims.authoritativeRecordTime,
    snapshot.input.authorityEnvelope.claims.authoritativeRecordTime,
    shadow.input.authorityEnvelope.claims.authoritativeRecordTime
  ];
}

function canonicalHandoff(representativeId = "cruz") {
  return {
    handoffContractId: ROUTE_IQ_PROSPECTIVE_HANDOFF_CONTRACT,
    sessionId: `route-iq-field-session-fitness-connection-fitness-${representativeId}-2026-07-11`,
    rawSha256: digest(`canonical-handoff-${representativeId}`),
    normalizedRecord: {
      handoffContractId: ROUTE_IQ_PROSPECTIVE_HANDOFF_CONTRACT,
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      verifiedFields: { representative: { id: representativeId } }
    }
  };
}

const committedOutcomeTimes = Object.freeze({
  snapshotAccepted: "2026-07-13T20:01:00.000Z",
  snapshotSealed: "2026-07-13T20:02:00.000Z",
  shadowSealed: "2026-07-13T20:03:00.000Z",
  actionLinked: "2026-07-13T20:04:00.000Z",
  actionEvent: "2026-07-13T20:05:00.000Z",
  archiveCommitted: "2026-07-13T20:06:00.000Z",
  fieldEvidenceLinked: "2026-07-13T20:07:00.000Z",
  reconciled: "2026-07-13T20:08:00.000Z",
  outcomeAdmitted: "2026-07-13T20:09:00.000Z"
});

function committedDigest(value) {
  return computeRouteIqCommittedOutcomeSha256(value);
}

function committedId(kind, label) {
  return `riq_${kind}_${committedDigest(`${kind}:${label}`)}`;
}

function outcomeSignal(overrides = {}) {
  return {
    outcomeCode: null,
    outcomeCodeStatus: "unsupported",
    conversations: 0,
    leads: 0,
    appointments: 0,
    units: 0,
    laterUnits: 0,
    scoreableOutcome: null,
    scoreableOutcomeDerivedByData: false,
    ...overrides
  };
}

function allowlistedOutcomeSignal(outcomeCode, overrides = {}) {
  return outcomeSignal({
    outcomeCode,
    outcomeCodeStatus: "verified_allowlisted",
    ...overrides
  });
}

function withCommittedHash(body, hashField) {
  return { ...body, [hashField]: committedDigest(body) };
}

function immutableEvaluationContextFixture({ opportunityId, candidateId, actionArtifactId, outcome }) {
  const evaluationContext = {
    schemaVersion: routeIqEvaluationContextSchemaVersion,
    opportunityId,
    acceptedSnapshotManifest: {
      artifactId: committedId("snapshot", candidateId),
      recordSha256: committedDigest(`snapshot-record:${candidateId}`),
      manifestRecordSha256: committedDigest(`manifest-record:${candidateId}`),
      acceptedAt: committedOutcomeTimes.snapshotAccepted
    },
    snapshotSeal: {
      artifactId: committedId("snapshot_seal", candidateId),
      recordSha256: committedDigest(`snapshot-seal-record:${candidateId}`),
      sealedAt: committedOutcomeTimes.snapshotSealed
    },
    manifest: {
      candidateManifestSha256: committedDigest(`candidate-manifest:${candidateId}`),
      completeManifestSha256: committedDigest(`complete-manifest:${candidateId}`),
      producerContractVersion: routeIqCandidateProducerContractVersion,
      candidateSchemaVersion: routeIqCandidateManifestSchemaVersion,
      dataProjectionVersion: routeIqChronologicalEvidenceProjectionVersion
    },
    candidate: {
      candidateId,
      acceptedRank: 1,
      probability: 0.625,
      rankingBasisVersion: "route-iq-governed-score-ranking-v1"
    },
    shadowDecision: {
      shadowDecisionRecordSha256: committedDigest(`shadow-decision-record:${candidateId}`),
      sealArtifactId: committedId("shadow_seal", candidateId),
      sealRecordSha256: committedDigest(`shadow-seal-record:${candidateId}`),
      sealedAt: committedOutcomeTimes.shadowSealed
    },
    action: {
      artifactId: actionArtifactId,
      recordSha256: committedDigest(`action-record:${candidateId}`),
      selectedCandidateId: candidateId,
      linkedAt: committedOutcomeTimes.actionLinked
    },
    sourceOutcome: {
      evidenceSha256: outcome.evidenceSha256,
      correctionState: outcome.outcomeEvidence.correctionState,
      correctionCount: outcome.outcomeEvidence.corrections.length,
      correctionRecordSha256s: outcome.outcomeEvidence.corrections.map(
        correction => correction.sourceCorrectionRecordSha256
      )
    },
    recommendationInfluence: routeIqProspectiveRecommendationInfluence,
    immutable: true
  };
  return {
    evaluationContextArtifactId: committedId("evaluation_context", candidateId),
    evaluationContextSha256: committedDigest(evaluationContext),
    evaluationContext
  };
}

function committedOutcomeEntry(visitLabel, finalSignal) {
  const sourceVisitRecordSha256 = committedDigest(`visit:${visitLabel}`);
  const candidateId = committedId("candidate", visitLabel);
  const opportunityId = committedId("opportunity", visitLabel);
  const actionArtifactId = committedId("action", visitLabel);
  const outcomeEvidenceArtifactId = committedId("field_outcome", visitLabel);
  const outcome = withCommittedHash({
    sourceVisitRecordSha256,
    candidateId,
    candidateIdentityStatus: "derived_from_exact_governed_google_place_identity",
    actionEventTime: committedOutcomeTimes.actionEvent,
    eventTimeAuthority: "dashboard_recorded_visit_time_in_committed_handoff",
    authoritativeRecordTime: committedOutcomeTimes.archiveCommitted,
    outcomeEvidence: {
      status: "verified_unscored_signals",
      originalOutcomeSignal: structuredClone(finalSignal),
      finalOutcomeSignal: structuredClone(finalSignal),
      corrections: [],
      correctionState: "uncorrected",
      conflictState: "none",
      scoreableOutcome: null,
      scoreableOutcomeDerivedByData: false
    },
    decisionSource: {
      sourceId: "unknown",
      confidence: 0,
      capturedAt: committedOutcomeTimes.actionEvent,
      temporalClassification: "post_action_supporting_information",
      preActionEvidence: false,
      sameShadowDecisionInput: false,
      scoreableOutcome: false
    },
    recommendationDecisionContext: null
  }, "evidenceSha256");
  const context = immutableEvaluationContextFixture({
    opportunityId,
    candidateId,
    actionArtifactId,
    outcome
  });
  return {
    sourceVisitRecordSha256,
    candidateId,
    opportunityId,
    actionArtifactId,
    outcomeEvidenceArtifactId,
    outcome,
    link: {
      sourceVisitRecordSha256,
      opportunityId,
      candidateId,
      evidenceSha256: outcome.evidenceSha256,
      actionArtifactId,
      outcomeEvidenceArtifactId,
      ...context
    }
  };
}

function committedOutcomeBatchFixture(definitions, representativeId = "cruz") {
  const entries = definitions.map(({ visitLabel, finalSignal }) =>
    committedOutcomeEntry(visitLabel, finalSignal)
  );
  const fieldSessionOutcomeProjection = withCommittedHash({
    schemaVersion: routeIqFieldSessionOutcomeProjectionVersion,
    authority: "prometheus_data_committed_field_session",
    recordOrigin: "prospective",
    scope: scope(representativeId),
    sourceArchive: {
      handoffContractId: ROUTE_IQ_PROSPECTIVE_HANDOFF_CONTRACT,
      sourceArchiveSessionSha256: committedDigest(noncanonicalFieldSessionId(representativeId)),
      rawSha256: committedDigest(`archive-raw:${representativeId}:batch`),
      normalizedSha256: committedDigest(`archive-normalized:${representativeId}:batch`),
      archiveCommittedAt: committedOutcomeTimes.archiveCommitted
    },
    outcomes: entries.map(entry => entry.outcome),
    privacy: {
      namesIncluded: false,
      addressesIncluded: false,
      contactsIncluded: false,
      notesIncluded: false,
      preciseLocationIncluded: false
    },
    recommendationInfluence: routeIqProspectiveRecommendationInfluence,
    scoreableOutcomeDerivedByData: false
  }, "projectionSha256");
  const reconciliationReceipt = {
    contractVersion: routeIqFieldSessionOutcomeProjectionContractVersion,
    reconciliationId: committedId("reconciliation", `${representativeId}:batch`),
    status: "reconciled",
    coordinatorId: committedId("coordinator", representativeId),
    sourceProjectionSha256: fieldSessionOutcomeProjection.projectionSha256,
    sourceArchiveRawSha256: fieldSessionOutcomeProjection.sourceArchive.rawSha256,
    sourceArchiveSessionSha256: fieldSessionOutcomeProjection.sourceArchive.sourceArchiveSessionSha256,
    linked: entries.map(entry => entry.link),
    exclusions: [],
    outcomeValuesInferredByData: false,
    recommendationInfluence: routeIqProspectiveRecommendationInfluence,
    createdAt: committedOutcomeTimes.reconciled
  };
  return {
    fieldSessionOutcomeProjection,
    reconciliationReceipt,
    links: reconciliationReceipt.linked
  };
}

function committedOutcomeFixture({
  representativeId = "cruz",
  visitLabel = "selected",
  finalSignal = allowlistedOutcomeSignal("lead", { leads: 1 })
} = {}) {
  const batch = committedOutcomeBatchFixture([{ visitLabel, finalSignal }], representativeId);
  return {
    ...batch,
    link: batch.links[0]
  };
}

function outcomeReceiptFixture(scoreableOutcome, overrides = {}) {
  return {
    coordinatorContractVersion: routeIqProspectiveCoordinatorContractVersion,
    status: "recorded",
    coordinatorId: committedId("coordinator", scoreableOutcome.scope.representativeId),
    sessionId: committedId("session", scoreableOutcome.scope.representativeId),
    opportunityId: scoreableOutcome.opportunityId,
    operationKey: `scoreable-outcome:${scoreableOutcome.sourceOutcomeEvidenceSha256}`,
    operationKind: "scoreable_outcome_admission",
    requestSha256: committedDigest(`scoreable-request:${scoreableOutcome.sourceOutcomeEvidenceSha256}`),
    artifactId: committedId("outcome", scoreableOutcome.sourceOutcomeEvidenceSha256),
    recordSha256: committedDigest(`outcome-record:${scoreableOutcome.sourceOutcomeEvidenceSha256}`),
    recordSequence: 8,
    authoritativeRecordTime: committedOutcomeTimes.outcomeAdmitted,
    state: "OUTCOME_LINKED",
    recoveryOutboxPersisted: true,
    recommendationInfluence: routeIqProspectiveRecommendationInfluence,
    collectionDefault: routeIqProspectiveCollectionDefault,
    sourceOutcomeEvidenceSha256: scoreableOutcome.sourceOutcomeEvidenceSha256,
    evaluationContextSha256: scoreableOutcome.evaluationContextSha256,
    evaluatedCandidateId: scoreableOutcome.candidateId,
    calculatedByData: false,
    ...overrides
  };
}

function committedProjectionRecordFixture(scoreableOutcome, outcomeReceipt) {
  const projection = {
    schemaVersion: routeIqProspectiveCoordinatorSchemaVersion,
    projectionVersion: routeIqProspectiveCoordinatorProjectionVersion,
    authority: "sqlite_durable_object_coordinator",
    coordinatorId: committedId("coordinator", scoreableOutcome.scope.representativeId),
    scope: structuredClone(scoreableOutcome.scope),
    canonicalSessionRecordSha256: committedDigest(`canonical-session:${scoreableOutcome.scope.representativeId}`),
    territoryId: territoryContext(scoreableOutcome.scope.representativeId).territoryId,
    opportunityId: scoreableOutcome.opportunityId,
    opportunityType: "next_stop",
    asOfRecordSequence: outcomeReceipt.recordSequence,
    asOfRecordTime: outcomeReceipt.authoritativeRecordTime,
    state: "OUTCOME_LINKED",
    readinessEvidenceEligible: true,
    evidence: [{
      sourceRecordId: outcomeReceipt.artifactId,
      evidenceKind: "prospective_opportunity_outcome",
      evidenceTimestamp: outcomeReceipt.authoritativeRecordTime,
      recordSequence: outcomeReceipt.recordSequence,
      recordSha256: outcomeReceipt.recordSha256,
      payload: {
        evaluatedCandidateId: scoreableOutcome.candidateId,
        actionArtifactId: scoreableOutcome.actionArtifactId,
        sourceOutcomeEvidenceSha256: scoreableOutcome.sourceOutcomeEvidenceSha256,
        evaluationContextSha256: scoreableOutcome.evaluationContextSha256,
        outcomeDerivationContractVersion: scoreableOutcome.outcomeDerivationContractVersion,
        observedOutcome: structuredClone(scoreableOutcome.observedOutcome),
        calculatedByData: false,
        unchosenCandidateOutcomeAssignmentAllowed: false
      },
      canonicalEvidenceEligible: true,
      recommendationInfluence: routeIqProspectiveRecommendationInfluence
    }],
    exclusions: [],
    sourceArtifacts: [{
      artifactId: scoreableOutcome.outcomeEvidenceArtifactId,
      artifactKind: "field_session_outcome_evidence",
      eventKind: "FIELD_SESSION_OUTCOME_EVIDENCE_LINKED",
      recordSequence: 7,
      authoritativeRecordTime: committedOutcomeTimes.fieldEvidenceLinked,
      recordSha256: committedDigest(`field-evidence-record:${scoreableOutcome.sourceOutcomeEvidenceSha256}`)
    }, {
      artifactId: outcomeReceipt.artifactId,
      artifactKind: "outcome",
      eventKind: "OUTCOME_LINKED",
      recordSequence: outcomeReceipt.recordSequence,
      authoritativeRecordTime: outcomeReceipt.authoritativeRecordTime,
      recordSha256: outcomeReceipt.recordSha256
    }],
    recommendationInfluence: routeIqProspectiveRecommendationInfluence,
    collectionDefault: routeIqProspectiveCollectionDefault,
    kvAuthority: routeIqProspectiveKvAuthority
  };
  const commitBody = {
    commitId: committedId("projection_commit", scoreableOutcome.sourceOutcomeEvidenceSha256),
    projectionId: committedId("projection", scoreableOutcome.sourceOutcomeEvidenceSha256),
    outboxId: committedId("projection_outbox", scoreableOutcome.sourceOutcomeEvidenceSha256),
    status: "committed",
    projectionSha256: committedDigest(projection),
    committedSequence: projection.asOfRecordSequence,
    committedAt: projection.asOfRecordTime,
    projectionCommitMarkerWrittenLast: true
  };
  return {
    projection,
    commit: {
      ...commitBody,
      commitSha256: committedDigest(commitBody)
    }
  };
}

const canonicalFieldSessionReport = (() => {
  const source = JSON.parse(readFileSync(join(
    root,
    "data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions",
    "route-iq-field-session-fitness-connection-fitness-cruz-2026-07-11/raw",
    "prometheus-iq-cruz-daily-report-2026-07-11.json"
  ), "utf8"));
  source.visits = source.visits.map(visit => ({
    ...visit,
    visitDecisionSource: {
      sourceId: "unknown",
      reason: null,
      evidence: [],
      confidence: 0,
      capturedAt: source.generatedAt
    },
    recommendationDecisionContext: {
      recommendationAvailable: null,
      recommendationId: null,
      decision: null
    }
  }));
  return JSON.stringify(source, null, 2);
})();

function fieldSessionStore() {
  const data = new Map();
  return {
    data,
    async get(key) {
      return data.get(key) ?? null;
    },
    async put(key, value) {
      data.set(key, String(value));
    },
    async list({ prefix = "" } = {}) {
      return {
        keys: [...data.keys()].filter(key => key.startsWith(prefix)).sort().map(name => ({ name })),
        list_complete: true,
        cacheStatus: null
      };
    }
  };
}

function fieldSessionAssets() {
  return {
    async fetch(request) {
      const pathname = new URL(request.url).pathname.replace(/^\/+/, "");
      try {
        return new Response(readFileSync(join(root, "deploy/cloudflare-pages", pathname)), { status: 200 });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    }
  };
}

function fieldSessionRequest(token, completionAction = "end_route") {
  return new Request(`https://private.invalid${ROUTE_IQ_FIELD_SESSION_HANDOFF_PATH}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Cf-Access-Jwt-Assertion": token
    },
    body: JSON.stringify({
      completionAction,
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      finalExportConfirmed: true,
      sourceFinalizedAt: "2026-07-12T00:26:00.000Z",
      rawReportText: canonicalFieldSessionReport
    })
  });
}

function executionContextFixture() {
  const promises = [];
  return {
    promises,
    waitUntil(promise) {
      promises.push(Promise.resolve(promise));
    }
  };
}

function assertCanonicalFieldSessionAcknowledgment(response, body, expectedStatus) {
  assert.equal(response.status, expectedStatus);
  assert.equal(body.ok, true);
  assert.equal(body.acknowledged, true);
  assert.equal(body.acknowledgment.contractId, routeIqEndOfDayHandoffContractId);
  assert.equal(body.acknowledgment.status, expectedStatus === 200 ? "already_archived" : "archived");
  const serialized = JSON.stringify(body);
  for (const prohibited of [
    "prospective",
    "shadow",
    "candidate",
    "opportunity",
    "readiness",
    "recommendationInfluence"
  ]) {
    assert.equal(serialized.includes(prohibited), false, prohibited);
  }
}

async function submitFieldSession(fixture, store, executionContext, completionAction = "end_route") {
  const env = {
    ...fixture.env,
    [routeIqFieldSessionStoreBinding]: store,
    ASSETS: fieldSessionAssets()
  };
  const response = await handleRouteIqFieldSessionHandoff(
    fieldSessionRequest(fixture.token, completionAction),
    env,
    {
      executionContext,
      prospectiveTestHooks: fixture.noncanonicalTestHooks
    }
  );
  return { response, body: await response.json(), env };
}

test("private config preserves the prospective SQLite migration and public config remains unbound", () => {
  const privateConfig = readFileSync(join(root, "wrangler.jsonc"), "utf8");
  const publicConfig = readFileSync(join(root, "wrangler.prometheusrouteiq-website.jsonc"), "utf8");
  assert.match(privateConfig, new RegExp(`"name": "${ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING}"`));
  assert.match(privateConfig, new RegExp(`"class_name": "${ROUTE_IQ_PROSPECTIVE_SHADOW_CLASS}"`));
  assert.equal(
    (privateConfig.match(/"RouteIqProspectiveShadowCoordinator"/gu) || []).length,
    2,
    "prospective coordinator must remain declared exactly once as a binding and once in migration history"
  );
  assert.equal(publicConfig.includes(ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING), false);
  assert.equal(publicConfig.includes(ROUTE_IQ_PROSPECTIVE_SHADOW_CLASS), false);
  assert.equal(typeof RouteIqProspectiveShadowCoordinator, "function");

  const rpcNames = Object.getOwnPropertyNames(RouteIqProspectiveShadowCoordinator.prototype);
  for (const prohibited of ["fetch", "execute", "executeSchema", "get", "put", "list", "sql"]) {
    assert.equal(rpcNames.includes(prohibited), false, `DO must not expose generic ${prohibited} RPC`);
  }
  assert.ok(rpcNames.includes("allocateNextStopOpportunity"));
  assert.ok(rpcNames.includes("noteGovernedRepresentativeSignal"));
  assert.ok(rpcNames.includes("closeCanonicalSession"));
  for (const method of [
    "readCanonicalRuntimeContext",
    "recordRuntimeStageExclusion",
    "linkServerDerivedNextStopAction",
    "reconcileCommittedFieldSessionOutcomes",
    "admitIntelligenceScoreableOutcome",
    "admitIntelligenceEvaluation"
  ]) {
    assert.ok(rpcNames.includes(method), method);
  }
  assert.ok(rpcNames.includes("applyTrustedTrigger"));
  assert.ok(rpcNames.includes("readCommittedProjectionAsOf"));
  assert.ok(rpcNames.includes("readCommittedProjectionForOutcomeArtifact"));
});

test("OFF and invalid activation acknowledge without Access, Aegis, JWKS, DO, or storage", async () => {
  let storageCalls = 0;
  const inactiveEnv = {
    AEGIS_RATE_LIMITS: {
      async get() {
        storageCalls += 1;
        throw new Error("OFF path reached storage");
      },
      async put() {
        storageCalls += 1;
        throw new Error("OFF path reached storage");
      }
    },
    get [ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING]() {
      throw new Error("OFF path reached the Durable Object binding");
    }
  };
  const response = await worker.fetch(eventRequest({ eventKind: "next_stop_requested" }), inactiveEnv);
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    ok: true,
    acknowledged: true,
    status: "disabled",
    collection: "OFF",
    recommendationInfluence: "OFF"
  });
  assert.equal(storageCalls, 0);

  const disabledBootstrap = await worker.fetch(bootstrapRequest(), inactiveEnv);
  assert.equal(disabledBootstrap.status, 202);
  assert.deepEqual(await disabledBootstrap.json(), {
    ok: true,
    acknowledged: true,
    status: "disabled",
    collection: "OFF",
    recommendationInfluence: "OFF"
  });
  assert.equal(storageCalls, 0);

  const invalidActivation = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }),
    { [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.collection]: "on" }
  );
  assert.equal(invalidActivation.status, 202);

  const missingCohort = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }),
    { [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.collection]: "ON" }
  );
  assert.equal(missingCohort.status, 202);
});

test("one-representative cohort configuration is versioned, bounded, fresh, and opportunity-scoped", async () => {
  const valid = validateRouteIqProspectiveCohortConfig(cohortConfig(), { now: testNow });
  assert.equal(valid.version, "route-iq-prospective-cohort-config-v2");
  assert.equal(valid.state, "ACTIVE");
  assert.equal(valid.issuedAt, testNow.toISOString());
  assert.equal(valid.expiresAt, "2026-07-13T21:00:00.000Z");
  assert.deepEqual(valid.supportedOpportunityTypes, ["next_stop"]);
  assert.deepEqual(valid.scopes, [scope()]);

  const invalidConfigs = [
    cohortConfig("cruz", { state: "OFF" }),
    cohortConfig("cruz", { version: "route-iq-prospective-cohort-config-v1" }),
    cohortConfig("cruz", { supportedOpportunityTypes: ["nearby_context"] }),
    cohortConfig("cruz", { scopes: [scope("cruz"), scope("anthony")] }),
    cohortConfig("cruz", {
      issuedAt: "2026-07-13T20:01:00.000Z",
      expiresAt: "2026-07-13T21:01:00.000Z"
    }),
    cohortConfig("cruz", {
      issuedAt: "2026-07-12T19:59:59.000Z",
      expiresAt: "2026-07-13T20:00:01.000Z"
    }),
    cohortConfig("cruz", { expiresAt: "2026-07-13T20:00:00.000Z" }),
    cohortConfig("unknown")
  ];
  for (const config of invalidConfigs) {
    const activation = getRouteIqProspectiveActivation({
      [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.collection]: "ON",
      [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.cohortConfig]: config
    }, { now: testNow });
    assert.equal(activation.active, false);
    assert.equal(activation.activeCohortCount, 0);
  }

  const staleActivation = getRouteIqProspectiveActivation({
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.collection]: "ON",
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.cohortConfig]: cohortConfig("cruz", {
      issuedAt: "2026-07-13T18:00:00.000Z",
      expiresAt: "2026-07-13T19:00:00.000Z"
    })
  }, { now: testNow });
  assert.equal(staleActivation.active, false);
  assert.equal(staleActivation.reason, "cohort_config_stale");

  let coordinatorLookups = 0;
  const staleResponse = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }),
    {
      [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.collection]: "ON",
      [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.cohortConfig]: cohortConfig("cruz", {
        issuedAt: "2026-07-13T18:00:00.000Z",
        expiresAt: "2026-07-13T19:00:00.000Z"
      }),
      get [ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING]() {
        coordinatorLookups += 1;
        throw new Error("Stale cohort reached coordinator binding.");
      }
    },
    { noncanonicalTestHooks: { enabled: true, currentDate: testNow } }
  );
  assert.equal(staleResponse.status, 202);
  assert.equal(coordinatorLookups, 0);
});

test("source activation template is inert and cannot activate a cohort", () => {
  const template = JSON.parse(readFileSync(
    join(root, "workers/infrastructure/route-iq-prospective-shadow-activation-template-v1.json"),
    "utf8"
  ));
  assert.equal(template.templateState, "INERT_DEFAULT_OFF");
  assert.equal(template.collection, "OFF");
  assert.equal(template.recommendationInfluence, "OFF");
  assert.equal(template.activeCohortCount, 0);
  assert.equal(template.activationGuards.maximumActiveRepresentatives, 1);
  assert.equal(template.activationGuards.maximumConfigLifetimeHours, 24);
  assert.equal(template.activationGuards.productionUseOfThisTemplateIsProhibited, true);
  const activation = getRouteIqProspectiveActivation({
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.collection]: template.collection,
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.cohortConfig]: JSON.stringify(template.runtimeCohortConfigTemplate)
  }, { now: testNow });
  assert.equal(activation.active, false);
  assert.equal(activation.reason, "global_off");
});

test("local activation readiness audit proves OFF silence and one-scope hypothetical ON readiness", () => {
  const offAudit = auditRouteIqProspectiveActivationReadiness({
    env: {},
    observation: readinessObservation(),
    now: testNow
  });
  assert.equal(offAudit.auditVersion, routeIqProspectiveActivationReadinessVersion);
  assert.equal(offAudit.status, "PASS");
  assert.equal(offAudit.mode, "COLLECTION_OFF");
  assert.equal(offAudit.collection, "OFF");
  assert.equal(offAudit.activeCohortCount, 0);
  assert.equal(offAudit.activationAuthorized, false);
  assert.equal(offAudit.productionVerified, false);
  assert.equal(offAudit.verificationScope, "LOCAL_SOURCE_ONLY");
  assert.equal(offAudit.deployedEnvironmentStatus, "UNVERIFIED");
  assert.equal(offAudit.deployedCountsStatus, "UNVERIFIED");
  assert.equal(offAudit.deployedActiveCohortCount, null);
  assert.deepEqual(offAudit.blockers, []);

  const onEnv = {
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.collection]: "ON",
    [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.cohortConfig]: cohortConfig()
  };
  const onAudit = auditRouteIqProspectiveActivationReadiness({
    env: onEnv,
    observation: readinessObservation({
      fixtureKind: "hypothetical_on",
      endpointState: "enabled",
      endpointHttpStatus: 200,
      activeCohortCount: 1,
      usage: { principals: 1 }
    }),
    now: testNow
  });
  assert.equal(onAudit.status, "PASS");
  assert.equal(onAudit.mode, "HYPOTHETICAL_ON");
  assert.equal(onAudit.activeCohortCount, 1);
  assert.equal(onAudit.activationAuthorized, false);
  assert.equal(onAudit.productionVerified, false);
  assert.equal(onAudit.deployedEnvironmentStatus, "UNVERIFIED");
  assert.equal(onAudit.deployedCountsStatus, "UNVERIFIED");
  assert.equal(onAudit.recommendationInfluence, "OFF");
  assert.deepEqual(onAudit.blockers, []);
});

test("activation readiness audit reports writes, records, budgets, production access, and governance blockers", () => {
  const blockedOff = auditRouteIqProspectiveActivationReadiness({
    env: {},
    observation: readinessObservation({
      overrides: {
        productionAccessUsed: true,
        attemptedApplicationWrites: 1,
        durableObjectInstanceCount: 1,
        kvWriteCount: 1,
        prospectiveRecordCount: 1,
        conflictCount: 1,
        exclusionCount: 1,
        evaluationCount: 1,
        archiveDispositionConsumerExclusionVerified: false,
        recommendationInfluence: "ON"
      },
      usage: {
        eventsPerDay: 1,
        pendingOutbox: ROUTE_IQ_PROSPECTIVE_SHADOW_BUDGETS.pendingOutbox + 1
      }
    }),
    now: testNow
  });
  assert.equal(blockedOff.status, "BLOCKED");
  for (const blocker of [
    "production_access_prohibited",
    "attemptedApplicationWrites_nonzero_while_off",
    "durableObjectInstanceCount_nonzero_while_off",
    "kvWriteCount_nonzero_while_off",
    "prospectiveRecordCount_nonzero_while_off",
    "conflictCount_nonzero_while_off",
    "exclusionCount_nonzero_while_off",
    "evaluationCount_nonzero_while_off",
    "archive_disposition_consumer_exclusion_unverified",
    "recommendation_influence_not_off",
    "eventsPerDay_nonzero_while_off",
    "pendingOutbox_budget_exceeded"
  ]) {
    assert.equal(blockedOff.blockers.includes(blocker), true, blocker);
  }

  const staleAudit = auditRouteIqProspectiveActivationReadiness({
    env: {
      [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.collection]: "ON",
      [ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.cohortConfig]: cohortConfig("cruz", {
        issuedAt: "2026-07-13T18:00:00.000Z",
        expiresAt: "2026-07-13T19:00:00.000Z"
      })
    },
    observation: readinessObservation(),
    now: testNow
  });
  assert.equal(staleAudit.status, "BLOCKED");
  assert.equal(staleAudit.blockers.includes("activation_cohort_config_stale"), true);
});

test("Worker API dispatch preserves prospective routing with the governed paid-customer hook shape", () => {
  const source = readFileSync(join(root, "workers/prometheus-iq-worker.js"), "utf8");
  assert.doesNotThrow(() => verifyRouteIqProspectiveWorkerDispatchSource(source));
});

test("Worker API dispatch verifier rejects unauthorized governed-hook signature drift", () => {
  const source = readFileSync(join(root, "workers/prometheus-iq-worker.js"), "utf8");
  const signature = `async function handleApiRequest(request, env, executionContext, {
  dailySnapshotTestHooks,
  paidCustomerOnboardingTestHooks,
  paidCustomerDashboardPreviewTestHooks,
  paidCustomerRevenueReadinessTestHooks
} = {}) {`;
  const unauthorizedSignatures = [
    "async function handleApiRequest(request, env, executionContext, { dailySnapshotTestHooks } = {}) {",
    signature.replace("  paidCustomerOnboardingTestHooks,\n", ""),
    signature.replace("  paidCustomerDashboardPreviewTestHooks,\n", ""),
    signature.replace("  paidCustomerRevenueReadinessTestHooks\n", ""),
    signature.replace(
      "  paidCustomerDashboardPreviewTestHooks,\n  paidCustomerRevenueReadinessTestHooks",
      "  paidCustomerRevenueReadinessTestHooks,\n  paidCustomerDashboardPreviewTestHooks"
    ),
    signature.replace(
      "  paidCustomerRevenueReadinessTestHooks\n",
      "  paidCustomerRevenueReadinessTestHooks,\n  unauthorizedTestHooks\n"
    ),
    signature.replace("paidCustomerOnboardingTestHooks", "customerOnboardingTestHooks"),
    signature.replace("paidCustomerRevenueReadinessTestHooks", "customerRevenueReadinessTestHooks")
  ];
  assert.equal(source.includes(signature), true);
  for (const unauthorizedSignature of unauthorizedSignatures) {
    assert.throws(
      () => verifyRouteIqProspectiveWorkerDispatchSource(source.replace(signature, unauthorizedSignature)),
      /exact governed paid-customer hook signature/u
    );
  }
});

test("Worker API dispatch verifier rejects hook-forwarding and prospective-dispatch drift", () => {
  const source = readFileSync(join(root, "workers/prometheus-iq-worker.js"), "utf8");
  const mutations = [
    source.replace(
      "          paidCustomerDashboardPreviewTestHooks,\n          paidCustomerRevenueReadinessTestHooks",
      "          paidCustomerDashboardPreviewTestHooks"
    ),
    source.replace(
      "return handleRouteIqProspectiveShadowRequest(request, env, { executionContext });",
      "return handleRouteIqProspectiveShadowRequest(request, env);"
    )
  ];
  for (const mutation of mutations) {
    assert.notEqual(mutation, source);
    assert.throws(
      () => verifyRouteIqProspectiveWorkerDispatchSource(mutation),
      /exact (?:governed paid-customer hooks|prospective-shadow execution-context dispatch)/u
    );
  }
});

test("authenticated GET bootstrap is strict, short-lived, no-store, and storage-free", async () => {
  const fixture = await accessFixture();
  const response = await handleRouteIqProspectiveShadowRequest(
    bootstrapRequest(fixture.token),
    fixture.env,
    { noncanonicalTestHooks: fixture.noncanonicalTestHooks }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
  assert.deepEqual(await response.json(), {
    bootstrapContractVersion: ROUTE_IQ_PROSPECTIVE_BOOTSTRAP_CONTRACT_VERSION,
    ok: true,
    acknowledged: true,
    status: "enabled",
    collection: "ON",
    recommendationInfluence: "OFF",
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz",
    activeCohort: true,
    supportedOpportunityTypes: ["next_stop"],
    eventContractVersion: ROUTE_IQ_PROSPECTIVE_BROWSER_EVENT_CONTRACT_VERSION,
    runtimeContextContractVersion: routeIqProspectiveRuntimeContextContractVersion,
    coordinatorContractVersion: routeIqProspectiveCoordinatorContractVersion,
    issuedAt: "2026-07-13T20:00:00.000Z",
    expiresAt: "2026-07-13T20:01:00.000Z"
  });
  assert.deepEqual(fixture.calls, ["access_signature"]);
  assert.deepEqual(fixture.names, []);
  assert.deepEqual(fixture.commands, []);
});

test("active GET bypasses Aegis storage but still requires Access before any Durable Object lookup", async () => {
  const fixture = await accessFixture();
  fixture.env[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.cohortConfig] = cohortConfig("cruz", { now: new Date() });
  let aegisStorageCalls = 0;
  fixture.env.AEGIS_RATE_LIMITS = {
    async get() {
      aegisStorageCalls += 1;
      throw new Error("Bootstrap reached Aegis KV.");
    },
    async put() {
      aegisStorageCalls += 1;
      throw new Error("Bootstrap reached Aegis KV.");
    }
  };
  const response = await worker.fetch(bootstrapRequest(), fixture.env);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "route_iq_prospective_access_token_missing");
  assert.equal(aegisStorageCalls, 0);
  assert.equal(fixture.calls.includes("do_lookup"), false);
});

test("bootstrap fails closed for invalid path, expired Access, and unauthorized cohort", async () => {
  const invalidPathFixture = await accessFixture();
  const invalidPath = await handleRouteIqProspectiveShadowRequest(
    bootstrapRequest(invalidPathFixture.token, `${ROUTE_IQ_PROSPECTIVE_SHADOW_PATH}/unsupported`),
    invalidPathFixture.env,
    { noncanonicalTestHooks: invalidPathFixture.noncanonicalTestHooks }
  );
  assert.equal(invalidPath.status, 405);
  assert.equal(invalidPathFixture.calls.includes("do_lookup"), false);

  const expiredFixture = await accessFixture({ expired: true });
  const expired = await handleRouteIqProspectiveShadowRequest(
    bootstrapRequest(expiredFixture.token),
    expiredFixture.env,
    { noncanonicalTestHooks: expiredFixture.noncanonicalTestHooks }
  );
  assert.equal(expired.status, 403);
  assert.equal(expiredFixture.calls.includes("do_lookup"), false);

  const unauthorizedFixture = await accessFixture({ cohortRepresentativeId: "anthony" });
  const unauthorized = await handleRouteIqProspectiveShadowRequest(
    bootstrapRequest(unauthorizedFixture.token),
    unauthorizedFixture.env,
    { noncanonicalTestHooks: unauthorizedFixture.noncanonicalTestHooks }
  );
  assert.equal(unauthorized.status, 403);
  assert.equal(unauthorizedFixture.calls.includes("do_lookup"), false);

  for (const missing of ["authority", "coordinator", "assets"]) {
    const fixture = await accessFixture();
    if (missing === "authority") delete fixture.env[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.authorityKey];
    if (missing === "coordinator") delete fixture.env[ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING];
    if (missing === "assets") delete fixture.env.ASSETS;
    const response = await handleRouteIqProspectiveShadowRequest(
      bootstrapRequest(fixture.token),
      fixture.env,
      { noncanonicalTestHooks: fixture.noncanonicalTestHooks }
    );
    assert.equal(response.status, 503, missing);
    assert.equal(fixture.calls.includes("do_lookup"), false, missing);
    assert.deepEqual(fixture.commands, [], missing);
  }
});

test("pending production roster excludes while the isolated producer requires an explicit enabled hook", async () => {
  const activePool = JSON.parse(readFileSync(join(
    root,
    ROUTE_IQ_PROSPECTIVE_SOURCE_ARTIFACTS.activePool
  ), "utf8"));
  assert.equal(activePool.approvalState, "PENDING_FOUNDER_APPROVAL");
  assert.equal(activePool.approvedRecordCount, 0);
  assert.equal(activePool.count, 0);
  assert.deepEqual(activePool.records, []);

  const canonicalContext = {
    territoryId: territoryContext().territoryId,
    canonicalSessionRecordSha256: digest("pending-production-session"),
    sessionEventSequence: 0,
    opportunityEventSequence: 0,
    triggerRecordSha256: digest("pending-production-trigger")
  };
  const productionResult = produceRouteIqNextStopCandidateManifest({
    canonicalOpportunity: {
      opportunityId: `riq_opportunity_${digest("pending-production-opportunity")}`,
      opportunityType: "next_stop",
      recordOrigin: "prospective",
      scope: scope(),
      canonicalContext,
      territorySource: {
        sourceRecordSha256: territoryContext().sourceRecordSha256,
        sourceContractVersion: territoryContext().sourceContractVersion,
        availableAt: territoryContext().availableAt
      }
    },
    sourceArtifacts: productionCandidateSourceArtifacts(),
    completedCandidateIds: [],
    eligibilityEvaluatedAt: "2026-07-23T12:00:00.500Z",
    evidenceCutoff: "2026-07-23T12:00:01.000Z",
    targetSize: 15
  });
  assert.equal(productionResult.disposition, "EXCLUDED");
  assert.equal(productionResult.canonicalProductionEvidenceEligible, false);

  const fixture = await accessFixture();
  const scopeEnvelope = await createRouteIqProspectiveAuthorityEnvelope({
    purpose: "coordinator_scope",
    ...scope(),
    registryVersion: "noncanonical-test-registry-v1",
    issuedAt: testNow.toISOString(),
    territoryContext: territoryContext()
  }, fixture.env);
  const stub = fixture.env[ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING].getByName(
    "disabled-producer-hook-regression"
  );
  const allocationReceipt = await stub.allocateNextStopOpportunity({
    scopeEnvelope,
    event: { eventKind: "next_stop_requested" }
  });
  const ignoredHookResult = await orchestrateRouteIqProspectiveNextStop({
    stub,
    scopeEnvelope,
    scope: scope(),
    allocationReceipt,
    assetOrigin: "https://private.invalid/",
    env: fixture.env,
    noncanonicalTestHooks: {
      produceCandidateManifest() {
        throw new Error("disabled noncanonical producer hook executed");
      }
    }
  });
  assert.deepEqual(ignoredHookResult, { status: "excluded" });
  assert.equal(fixture.calls.includes("candidate_manifest_rpc"), false);
  assert.equal(fixture.calls.includes("runtime_exclusion_rpc"), true);
});

test("valid Access precedes scope-only allocation and returns only opaque acknowledgments", async () => {
  const fixture = await accessFixture();
  const allocationContext = executionContextFixture();
  const first = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested", informationalSequence: 9 }, fixture.token),
    fixture.env,
    {
      executionContext: allocationContext,
      noncanonicalTestHooks: fixture.noncanonicalTestHooks
    }
  );
  const firstBody = await first.json();
  assert.equal(first.status, 202);
  assert.deepEqual(firstBody, ROUTE_IQ_PROSPECTIVE_ALLOCATOR_ACKNOWLEDGMENT);
  assert.ok(fixture.calls.indexOf("access_signature") < fixture.calls.indexOf("do_lookup"));
  assert.equal(fixture.calls.includes("allocator_rpc"), true);
  assert.equal(allocationContext.promises.length, 1);
  assert.deepEqual(await allocationContext.promises[0], { status: "shadow_decision_sealed" });
  for (const call of ["runtime_context_rpc", "candidate_manifest_rpc", "snapshot_seal_rpc", "shadow_decision_seal_rpc"]) {
    assert.equal(fixture.calls.includes(call), true, call);
  }
  assert.equal(fixture.calls.filter(call => call === "lifecycle_server_clock").length, 6);

  const actionContext = executionContextFixture();
  const second = await handleRouteIqProspectiveShadowRequest(
    eventRequest({
      eventKind: "representative_action_observed",
      informationalObservedAt: "2026-07-13T19:59:59.000Z"
    }, fixture.token),
    fixture.env,
    {
      executionContext: actionContext,
      noncanonicalTestHooks: fixture.noncanonicalTestHooks
    }
  );
  assert.equal(second.status, 202);
  assert.deepEqual(await second.json(), ROUTE_IQ_PROSPECTIVE_ACTION_ACKNOWLEDGMENT);
  assert.equal(actionContext.promises.length, 1);
  assert.equal((await actionContext.promises[0]).state, "ACTION_LINKED");
  assert.equal(fixture.calls.includes("server_action_rpc"), true);
  const third = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "representative_outcome_observed" }, fixture.token),
    fixture.env,
    { noncanonicalTestHooks: fixture.noncanonicalTestHooks }
  );
  assert.equal(third.status, 202);
  assert.deepEqual(await third.json(), ROUTE_IQ_PROSPECTIVE_GOVERNED_NOOP_ACKNOWLEDGMENT);
  assert.equal(fixture.names.length, 3);
  assert.equal(fixture.names[0], fixture.names[1]);
  assert.equal(fixture.names[1], fixture.names[2]);

  const representativeResponse = JSON.stringify(firstBody);
  for (const prohibited of [
    "coordinatorId",
    "sessionId",
    "opportunityId",
    "candidateId",
    "ranking",
    "probability",
    "confidence",
    "eligibility",
    "readiness",
    "engine"
  ]) {
    assert.equal(representativeResponse.includes(prohibited), false);
  }
});

test("production lifecycle samples server Date at every stage and ignores stale allocation and client time", async () => {
  const fixture = await accessFixture();
  const stub = fixture.env[ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING].getByName("production-clock-regression");
  const scopeEnvelope = await createRouteIqProspectiveAuthorityEnvelope({
    purpose: "coordinator_scope",
    ...scope(),
    registryVersion: "noncanonical-test-registry-v1",
    issuedAt: new Date(Date.now() - 120_000).toISOString(),
    territoryContext: territoryContext()
  }, fixture.env);
  const allocationReceipt = await stub.allocateNextStopOpportunity({
    scopeEnvelope,
    event: {
      eventKind: "next_stop_requested",
      informationalObservedAt: "2099-01-01T00:00:00.000Z"
    }
  });
  allocationReceipt.authoritativeRecordTime = new Date(Date.now() - 60_000).toISOString();
  fixture.commands.length = 0;
  const before = Date.now();
  const result = await orchestrateRouteIqProspectiveNextStop({
    stub,
    scopeEnvelope,
    scope: scope(),
    allocationReceipt,
    assetOrigin: "https://private.invalid/",
    env: fixture.env,
    noncanonicalTestHooks: {
      enabled: true,
      produceCandidateManifest: produceProspectiveCompatibilityCandidateManifest
    }
  });
  const after = Date.now();
  assert.deepEqual(result, { status: "shadow_decision_sealed" });
  const times = lifecycleRecordTimes(fixture.commands);
  assert.equal(times.length, 6);
  assert.equal(times.every((value, index) => index === 0 || Date.parse(value) > Date.parse(times[index - 1])), true);
  assert.equal(Date.parse(times[0]) >= before, true);
  assert.equal(Date.parse(times.at(-1)) <= after + times.length, true);
  assert.equal(times.includes(allocationReceipt.authoritativeRecordTime), false);
  assert.equal(times.includes("2099-01-01T00:00:00.000Z"), false);
});

test("explicit noncanonical lifecycle clock is sampled per stage and future allocation fails before lifecycle RPC", async () => {
  const sampledDates = [
    "2026-07-13T20:00:10.000Z",
    "2026-07-13T20:00:10.000Z",
    "2026-07-13T20:00:10.000Z",
    "2026-07-13T20:00:11.000Z",
    "2026-07-13T20:00:11.000Z",
    "2026-07-13T20:00:12.000Z"
  ];
  const fixture = await accessFixture({
    allocationAuthoritativeRecordTime: "2026-07-13T19:00:00.000Z",
    lifecycleDates: sampledDates
  });
  const context = executionContextFixture();
  const response = await handleRouteIqProspectiveShadowRequest(
    eventRequest({
      eventKind: "next_stop_requested",
      informationalObservedAt: "2099-01-01T00:00:00.000Z"
    }, fixture.token),
    fixture.env,
    { executionContext: context, noncanonicalTestHooks: fixture.noncanonicalTestHooks }
  );
  assert.equal(response.status, 202);
  assert.deepEqual(await context.promises[0], { status: "shadow_decision_sealed" });
  assert.deepEqual(lifecycleRecordTimes(fixture.commands), [
    "2026-07-13T20:00:10.000Z",
    "2026-07-13T20:00:10.001Z",
    "2026-07-13T20:00:10.002Z",
    "2026-07-13T20:00:11.000Z",
    "2026-07-13T20:00:11.001Z",
    "2026-07-13T20:00:12.000Z"
  ]);
  assert.equal(fixture.calls.filter(call => call === "lifecycle_server_clock").length, 6);

  const futureFixture = await accessFixture({
    allocationAuthoritativeRecordTime: "2026-07-13T20:01:00.000Z",
    lifecycleDates: ["2026-07-13T20:00:00.000Z"]
  });
  const futureContext = executionContextFixture();
  const futureResponse = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }, futureFixture.token),
    futureFixture.env,
    { executionContext: futureContext, noncanonicalTestHooks: futureFixture.noncanonicalTestHooks }
  );
  assert.equal(futureResponse.status, 202);
  assert.deepEqual(await futureContext.promises[0], { status: "failure_isolated" });
  assert.equal(futureFixture.calls.includes("runtime_context_rpc"), false);
  assert.equal(futureFixture.calls.includes("candidate_manifest_rpc"), false);
  assert.equal(futureFixture.calls.includes("snapshot_seal_rpc"), false);
  assert.equal(futureFixture.calls.includes("shadow_decision_seal_rpc"), false);
});

test("canonical handoff closure is Access-mapped, digest-bound, and disabled without a DO call", async () => {
  const fixture = await accessFixture();
  const handoff = canonicalHandoff();
  const closed = await closeRouteIqProspectiveSessionFromHandoff(
    eventRequest({ eventKind: "next_stop_requested" }, fixture.token),
    fixture.env,
    {
      completionAction: "end_route",
      handoffResult: handoff,
      noncanonicalTestHooks: fixture.noncanonicalTestHooks
    }
  );
  assert.equal(closed.status, "closed");
  assert.ok(fixture.calls.indexOf("access_signature") < fixture.calls.indexOf("do_lookup"));
  assert.equal(fixture.calls.includes("close_rpc"), true);
  assert.deepEqual(fixture.commands.at(-1).authorityEnvelope.claims, {
    purpose: "close_session",
    ...scope(),
    closeReason: "end_route",
    handoffContractVersion: ROUTE_IQ_PROSPECTIVE_HANDOFF_CONTRACT,
    endOfDayHandoffSha256: handoff.rawSha256,
    authoritativeRecordTime: testNow.toISOString()
  });

  const mismatched = await accessFixture();
  await assert.rejects(
    closeRouteIqProspectiveSessionFromHandoff(
      eventRequest({ eventKind: "next_stop_requested" }, mismatched.token),
      mismatched.env,
      {
        completionAction: "end_day",
        handoffResult: canonicalHandoff("anthony"),
        noncanonicalTestHooks: mismatched.noncanonicalTestHooks
      }
    ),
    error => error.code === "route_iq_prospective_handoff_scope_mismatch"
  );
  assert.equal(mismatched.calls.includes("do_lookup"), false);

  const disabled = await closeRouteIqProspectiveSessionFromHandoff(
    eventRequest({ eventKind: "next_stop_requested" }),
    {
      get [ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING]() {
        throw new Error("disabled closure reached DO");
      }
    },
    { completionAction: "end_route", handoffResult: handoff }
  );
  assert.deepEqual(disabled, { status: "disabled" });
});

test("field-session success acknowledgment is unchanged while prospective close runs in waitUntil", async () => {
  const fixture = await accessFixture();
  const store = fieldSessionStore();
  const firstContext = executionContextFixture();
  const first = await submitFieldSession(fixture, store, firstContext);
  assertCanonicalFieldSessionAcknowledgment(first.response, first.body, 201);
  assert.equal(firstContext.promises.length, 1);
  await firstContext.promises[0];
  assert.equal(fixture.calls.includes("close_rpc"), true);

  const retryContext = executionContextFixture();
  const retry = await submitFieldSession(fixture, store, retryContext);
  assertCanonicalFieldSessionAcknowledgment(retry.response, retry.body, 200);
  assert.equal(retryContext.promises.length, 1);
  await retryContext.promises[0];
});

test("field-session acknowledgment isolates prospective timeout, rejection, missing binding, and missing key", async t => {
  await t.test("reconciliation rejection", async () => {
    const fixture = await accessFixture({
      reconciliationImplementation() {
        throw Object.assign(new Error("Noncanonical reconciliation rejection."), {
          code: "route_iq_prospective_reconciliation_rejected",
          status: 503
        });
      }
    });
    const context = executionContextFixture();
    const submission = await submitFieldSession(fixture, fieldSessionStore(), context);
    assertCanonicalFieldSessionAcknowledgment(submission.response, submission.body, 201);
    assert.equal((await context.promises[0]).status, "closed");
    assert.equal(fixture.calls.includes("field_session_reconciliation_rpc"), true);
    assert.equal(fixture.calls.includes("close_rpc"), true);
  });

  await t.test("timeout", async () => {
    let rejectClose;
    let markStarted;
    const started = new Promise(resolve => {
      markStarted = resolve;
    });
    const fixture = await accessFixture({
      closeImplementation() {
        markStarted();
        return new Promise((_, reject) => {
          rejectClose = reject;
        });
      }
    });
    const context = executionContextFixture();
    const submission = await submitFieldSession(fixture, fieldSessionStore(), context);
    assertCanonicalFieldSessionAcknowledgment(submission.response, submission.body, 201);
    assert.equal(context.promises.length, 1);
    await started;
    const timeout = Object.assign(new Error("Noncanonical close timeout."), {
      code: "route_iq_prospective_close_timeout",
      status: 504
    });
    rejectClose(timeout);
    assert.deepEqual(await context.promises[0], { status: "failure_isolated" });
  });

  await t.test("rejection", async () => {
    const fixture = await accessFixture({
      closeImplementation() {
        throw Object.assign(new Error("Noncanonical close rejection."), {
          code: "route_iq_prospective_close_rejected",
          status: 503
        });
      }
    });
    const context = executionContextFixture();
    const submission = await submitFieldSession(fixture, fieldSessionStore(), context);
    assertCanonicalFieldSessionAcknowledgment(submission.response, submission.body, 201);
    assert.deepEqual(await context.promises[0], { status: "failure_isolated" });
  });

  await t.test("missing binding", async () => {
    const fixture = await accessFixture();
    delete fixture.env[ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING];
    const context = executionContextFixture();
    const submission = await submitFieldSession(fixture, fieldSessionStore(), context);
    assertCanonicalFieldSessionAcknowledgment(submission.response, submission.body, 201);
    assert.deepEqual(await context.promises[0], { status: "failure_isolated" });
  });

  await t.test("missing key", async () => {
    const fixture = await accessFixture();
    delete fixture.env[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.authorityKey];
    const context = executionContextFixture();
    const submission = await submitFieldSession(fixture, fieldSessionStore(), context);
    assertCanonicalFieldSessionAcknowledgment(submission.response, submission.body, 201);
    assert.deepEqual(await context.promises[0], { status: "failure_isolated" });
    assert.equal(fixture.calls.includes("do_lookup"), false);
  });
});

test("committed outcome helper requires Data-signed retention admission and skips missing evaluations", async t => {
  await t.test("a signed local fixture reaches the Data/Intelligence boundary without authorizing evaluation", async () => {
    const fixture = committedOutcomeFixture();
    const expectedScoreableOutcome = deriveRouteIqScoreableOutcomeFromCommittedEvidence({
      fieldSessionOutcomeProjection: fixture.fieldSessionOutcomeProjection,
      reconciliationReceipt: fixture.reconciliationReceipt,
      sourceVisitRecordSha256: fixture.link.sourceVisitRecordSha256
    });
    let expectedOutcomeReceipt = null;
    const access = await accessFixture({
      scoreableOutcomeAdmissionImplementation(command) {
        expectedOutcomeReceipt = outcomeReceiptFixture(expectedScoreableOutcome, {
          authoritativeRecordTime: command.input.authorityEnvelope.claims.authoritativeRecordTime
        });
        const expectedClaims = buildRouteIqScoreableOutcomeAdmissionClaims({
          scope: scope(),
          scoreableOutcome: expectedScoreableOutcome,
          authoritativeRecordTime: command.input.authorityEnvelope.claims.authoritativeRecordTime
        });
        assert.deepEqual(command.input.authorityEnvelope.claims, expectedClaims);
        assert.equal(command.input.authorityEnvelope.channel, "producer");
        return expectedOutcomeReceipt;
      },
      committedProjectionReadImplementation(command) {
        assert.equal(command.input.authorityEnvelope.channel, "producer");
        assert.equal(
          command.input.authorityEnvelope.claims.sourceOutcomeEvidenceSha256,
          expectedScoreableOutcome.sourceOutcomeEvidenceSha256
        );
        assert.deepEqual(command.input.authorityEnvelope.claims.outcomeReceipt, expectedOutcomeReceipt);
        return {
          ok: true,
          found: true,
          record: committedProjectionRecordFixture(expectedScoreableOutcome, expectedOutcomeReceipt)
        };
      },
      evaluationAdmissionImplementation(command) {
        const committedProjection = committedProjectionRecordFixture(expectedScoreableOutcome, expectedOutcomeReceipt);
        const expectedEvaluation = buildRouteIqEvaluationFromAdmittedOutcome({
          reconciliationReceipt: fixture.reconciliationReceipt,
          committedProjection,
          scoreableOutcome: expectedScoreableOutcome,
          outcomeReceipt: expectedOutcomeReceipt,
          retentionEnvelope: buildNoncanonicalAuthenticatedDataRetentionEnvelope({
            scope: scope(),
            scoreableOutcome: expectedScoreableOutcome,
            outcomeReceipt: expectedOutcomeReceipt,
            fieldSessionOutcomeProjection: fixture.fieldSessionOutcomeProjection
          })
        });
        const expectedClaims = buildRouteIqEvaluationAdmissionClaims({
          scope: scope(),
          evaluation: expectedEvaluation,
          authoritativeRecordTime: command.input.authorityEnvelope.claims.authoritativeRecordTime
        });
        assert.deepEqual(command.input.authorityEnvelope.claims, expectedClaims);
        assert.equal(command.input.authorityEnvelope.channel, "producer");
        return {
          coordinatorContractVersion: routeIqProspectiveCoordinatorContractVersion,
          status: "recorded",
          coordinatorId: committedId("coordinator", "cruz"),
          sessionId: committedId("session", "cruz"),
          opportunityId: expectedScoreableOutcome.opportunityId,
          operationKey: `evaluation:${expectedScoreableOutcome.sourceOutcomeEvidenceSha256}`,
          operationKind: "evaluation_admission",
          requestSha256: committedDigest(`evaluation-request:${expectedScoreableOutcome.sourceOutcomeEvidenceSha256}`),
          artifactId: committedId("evaluation", expectedScoreableOutcome.sourceOutcomeEvidenceSha256),
          recordSha256: committedDigest(`evaluation-record:${expectedScoreableOutcome.sourceOutcomeEvidenceSha256}`),
          recordSequence: 9,
          authoritativeRecordTime: command.input.authorityEnvelope.claims.authoritativeRecordTime,
          state: "EVALUATED",
          recoveryOutboxPersisted: true,
          recommendationInfluence: routeIqProspectiveRecommendationInfluence,
          collectionDefault: routeIqProspectiveCollectionDefault,
          sourceOutcomeEvidenceSha256: expectedScoreableOutcome.sourceOutcomeEvidenceSha256,
          evaluationContextSha256: expectedScoreableOutcome.evaluationContextSha256,
          fullEvaluationPersisted: true
        };
      }
    });
    const scopeEnvelope = await createRouteIqProspectiveAuthorityEnvelope({
      purpose: "coordinator_scope",
      ...scope(),
      registryVersion: "noncanonical-test-registry-v1",
      issuedAt: testNow.toISOString(),
      territoryContext: territoryContext()
    }, access.env);
    const result = await admitRouteIqProspectiveIntelligenceOutcomes({
      stub: access.env[ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING].getByName("observed"),
      scopeEnvelope,
      scope: scope(),
      env: access.env,
      fieldSessionOutcomeProjection: fixture.fieldSessionOutcomeProjection,
      reconciliationReceipt: fixture.reconciliationReceipt,
      noncanonicalTestHooks: access.noncanonicalTestHooks
    });
    assert.equal(result.status, "processed_with_failures");
    assert.deepEqual(result.totals, {
      linkedCount: 1,
      admittedOutcomeCount: 1,
      admittedEvaluationCount: 0,
      skippedEvaluationCount: 0,
      failedLinkCount: 1
    });
    assert.equal(access.calls.includes("projection_recovery_rpc"), false);
    assert.equal(access.calls.includes("evaluation_admission_rpc"), false);
  });

  await t.test("missing scoreable outcome records no evaluation", async () => {
    const fixture = committedOutcomeFixture({
      visitLabel: "missing",
      finalSignal: allowlistedOutcomeSignal("conversation", { conversations: 1 })
    });
    const expectedScoreableOutcome = deriveRouteIqScoreableOutcomeFromCommittedEvidence({
      fieldSessionOutcomeProjection: fixture.fieldSessionOutcomeProjection,
      reconciliationReceipt: fixture.reconciliationReceipt,
      sourceVisitRecordSha256: fixture.link.sourceVisitRecordSha256
    });
    let expectedOutcomeReceipt = null;
    const access = await accessFixture({
      scoreableOutcomeAdmissionImplementation(command) {
        expectedOutcomeReceipt = outcomeReceiptFixture(expectedScoreableOutcome, {
          authoritativeRecordTime: command.input.authorityEnvelope.claims.authoritativeRecordTime
        });
        return expectedOutcomeReceipt;
      },
      committedProjectionReadImplementation() {
        return {
          ok: true,
          found: true,
          record: committedProjectionRecordFixture(expectedScoreableOutcome, expectedOutcomeReceipt)
        };
      },
      evaluationAdmissionImplementation() {
        throw new Error("missing outcomes must not admit evaluations");
      }
    });
    const result = await admitRouteIqProspectiveIntelligenceOutcomes({
      stub: access.env[ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING].getByName("missing"),
      scopeEnvelope: await createRouteIqProspectiveAuthorityEnvelope({
        purpose: "coordinator_scope",
        ...scope(),
        registryVersion: "noncanonical-test-registry-v1",
        issuedAt: testNow.toISOString(),
        territoryContext: territoryContext()
      }, access.env),
      scope: scope(),
      env: access.env,
      fieldSessionOutcomeProjection: fixture.fieldSessionOutcomeProjection,
      reconciliationReceipt: fixture.reconciliationReceipt,
      noncanonicalTestHooks: access.noncanonicalTestHooks
    });
    assert.equal(result.status, "processed");
    assert.deepEqual(result.totals, {
      linkedCount: 1,
      admittedOutcomeCount: 1,
      admittedEvaluationCount: 0,
      skippedEvaluationCount: 1,
      failedLinkCount: 0
    });
    assert.equal(access.calls.includes("evaluation_admission_rpc"), false);
  });

  await t.test("production path without authenticated Data retention input cannot admit a readiness evaluation", async () => {
    const fixture = committedOutcomeFixture({ visitLabel: "missing-retention" });
    const expectedScoreableOutcome = deriveRouteIqScoreableOutcomeFromCommittedEvidence({
      fieldSessionOutcomeProjection: fixture.fieldSessionOutcomeProjection,
      reconciliationReceipt: fixture.reconciliationReceipt,
      sourceVisitRecordSha256: fixture.link.sourceVisitRecordSha256
    });
    let expectedOutcomeReceipt = null;
    const access = await accessFixture({
      scoreableOutcomeAdmissionImplementation(command) {
        expectedOutcomeReceipt = outcomeReceiptFixture(expectedScoreableOutcome, {
          authoritativeRecordTime: command.input.authorityEnvelope.claims.authoritativeRecordTime
        });
        return expectedOutcomeReceipt;
      },
      committedProjectionReadImplementation() {
        return {
          ok: true,
          found: true,
          record: committedProjectionRecordFixture(expectedScoreableOutcome, expectedOutcomeReceipt)
        };
      },
      evaluationAdmissionImplementation() {
        throw new Error("missing authenticated retention input must not admit an evaluation");
      }
    });
    const result = await admitRouteIqProspectiveIntelligenceOutcomes({
      stub: access.env[ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING].getByName("missing-retention"),
      scopeEnvelope: await createRouteIqProspectiveAuthorityEnvelope({
        purpose: "coordinator_scope",
        ...scope(),
        registryVersion: "noncanonical-test-registry-v1",
        issuedAt: testNow.toISOString(),
        territoryContext: territoryContext()
      }, access.env),
      scope: scope(),
      env: access.env,
      fieldSessionOutcomeProjection: fixture.fieldSessionOutcomeProjection,
      reconciliationReceipt: fixture.reconciliationReceipt
    });
    assert.equal(result.status, "processed_with_failures");
    assert.deepEqual(result.totals, {
      linkedCount: 1,
      admittedOutcomeCount: 1,
      admittedEvaluationCount: 0,
      skippedEvaluationCount: 0,
      failedLinkCount: 1
    });
    assert.equal(
      result.processedLinks[0].code,
      "route_iq_prospective_retention_input_unavailable"
    );
    assert.equal(access.calls.includes("evaluation_admission_rpc"), false);
  });
});

test("committed outcome helper continues later links after poisoned failures and enforces the governed recovery bound", async t => {
  await t.test("poisoned first link does not block a later valid link", async () => {
    const batch = committedOutcomeBatchFixture([
      { visitLabel: "poisoned", finalSignal: allowlistedOutcomeSignal("lead", { leads: 1 }) },
      { visitLabel: "valid", finalSignal: allowlistedOutcomeSignal("lead", { leads: 1 }) }
    ]);
    const firstScoreable = deriveRouteIqScoreableOutcomeFromCommittedEvidence({
      fieldSessionOutcomeProjection: batch.fieldSessionOutcomeProjection,
      reconciliationReceipt: batch.reconciliationReceipt,
      sourceVisitRecordSha256: batch.links[0].sourceVisitRecordSha256
    });
    const secondScoreable = deriveRouteIqScoreableOutcomeFromCommittedEvidence({
      fieldSessionOutcomeProjection: batch.fieldSessionOutcomeProjection,
      reconciliationReceipt: batch.reconciliationReceipt,
      sourceVisitRecordSha256: batch.links[1].sourceVisitRecordSha256
    });
    let secondOutcomeReceipt = null;
    const access = await accessFixture({
      scoreableOutcomeAdmissionImplementation(command) {
        const evidenceSha = command.input.authorityEnvelope.claims.sourceOutcomeEvidenceSha256;
        if (evidenceSha === firstScoreable.sourceOutcomeEvidenceSha256) {
          throw Object.assign(new Error("poisoned first link"), {
            code: "route_iq_coordinator_conflict",
            status: 409
          });
        }
        secondOutcomeReceipt = outcomeReceiptFixture(secondScoreable, {
          authoritativeRecordTime: command.input.authorityEnvelope.claims.authoritativeRecordTime
        });
        return secondOutcomeReceipt;
      },
      committedProjectionReadImplementation(command) {
        assert.equal(
          command.input.authorityEnvelope.claims.sourceOutcomeEvidenceSha256,
          secondScoreable.sourceOutcomeEvidenceSha256
        );
        return {
          ok: true,
          found: true,
          record: committedProjectionRecordFixture(secondScoreable, secondOutcomeReceipt)
        };
      },
      evaluationAdmissionImplementation(command) {
        const expectedEvaluation = buildRouteIqEvaluationFromAdmittedOutcome({
          reconciliationReceipt: batch.reconciliationReceipt,
          committedProjection: committedProjectionRecordFixture(secondScoreable, secondOutcomeReceipt),
          scoreableOutcome: secondScoreable,
          outcomeReceipt: secondOutcomeReceipt,
          retentionEnvelope: buildNoncanonicalAuthenticatedDataRetentionEnvelope({
            scope: scope(),
            scoreableOutcome: secondScoreable,
            outcomeReceipt: secondOutcomeReceipt,
            fieldSessionOutcomeProjection: batch.fieldSessionOutcomeProjection
          })
        });
        assert.deepEqual(
          command.input.authorityEnvelope.claims,
          buildRouteIqEvaluationAdmissionClaims({
            scope: scope(),
            evaluation: expectedEvaluation,
            authoritativeRecordTime: command.input.authorityEnvelope.claims.authoritativeRecordTime
          })
        );
        return {
          state: "EVALUATED",
          sourceOutcomeEvidenceSha256: secondScoreable.sourceOutcomeEvidenceSha256
        };
      }
    });
    const result = await admitRouteIqProspectiveIntelligenceOutcomes({
      stub: access.env[ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING].getByName("poisoned-first"),
      scopeEnvelope: await createRouteIqProspectiveAuthorityEnvelope({
        purpose: "coordinator_scope",
        ...scope(),
        registryVersion: "noncanonical-test-registry-v1",
        issuedAt: testNow.toISOString(),
        territoryContext: territoryContext()
      }, access.env),
      scope: scope(),
      env: access.env,
      fieldSessionOutcomeProjection: batch.fieldSessionOutcomeProjection,
      reconciliationReceipt: batch.reconciliationReceipt,
      noncanonicalTestHooks: access.noncanonicalTestHooks
    });
    assert.equal(result.status, "processed_with_failures");
    assert.deepEqual(result.totals, {
      linkedCount: 2,
      admittedOutcomeCount: 1,
      admittedEvaluationCount: 0,
      skippedEvaluationCount: 0,
      failedLinkCount: 2
    });
    assert.deepEqual(result.processedLinks.map(entry => entry.status), ["failed", "failed"]);
  });

  await t.test("128 recoveries can reach the exact projection and exhaustion fails closed after the governed bound", async () => {
    const fixture = committedOutcomeFixture({ visitLabel: "recovery-bound" });
    const expectedScoreableOutcome = deriveRouteIqScoreableOutcomeFromCommittedEvidence({
      fieldSessionOutcomeProjection: fixture.fieldSessionOutcomeProjection,
      reconciliationReceipt: fixture.reconciliationReceipt,
      sourceVisitRecordSha256: fixture.link.sourceVisitRecordSha256
    });
    let recoveries = 0;
    let outcomeReceipt = null;
    const access = await accessFixture({
      scoreableOutcomeAdmissionImplementation(command) {
        outcomeReceipt = outcomeReceiptFixture(expectedScoreableOutcome, {
          authoritativeRecordTime: command.input.authorityEnvelope.claims.authoritativeRecordTime
        });
        return outcomeReceipt;
      },
      committedProjectionReadImplementation() {
        if (recoveries < 128) {
          throw Object.assign(new Error("pending exact projection"), {
            code: "route_iq_coordinator_projection_recovery_pending",
            status: 409
          });
        }
        return {
          ok: true,
          found: true,
          record: committedProjectionRecordFixture(expectedScoreableOutcome, outcomeReceipt)
        };
      },
      recoverProjectionImplementation() {
        recoveries += 1;
        return { recovered: true };
      },
      evaluationAdmissionImplementation() {
        return { state: "EVALUATED" };
      }
    });
    const success = await admitRouteIqProspectiveIntelligenceOutcomes({
      stub: access.env[ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING].getByName("recovery-128"),
      scopeEnvelope: await createRouteIqProspectiveAuthorityEnvelope({
        purpose: "coordinator_scope",
        ...scope(),
        registryVersion: "noncanonical-test-registry-v1",
        issuedAt: testNow.toISOString(),
        territoryContext: territoryContext()
      }, access.env),
      scope: scope(),
      env: access.env,
      fieldSessionOutcomeProjection: fixture.fieldSessionOutcomeProjection,
      reconciliationReceipt: fixture.reconciliationReceipt,
      noncanonicalTestHooks: access.noncanonicalTestHooks
    });
    assert.equal(success.status, "processed_with_failures");
    assert.equal(success.totals.failedLinkCount, 1);
    assert.equal(recoveries, 128);

    let exhaustedRecoveries = 0;
    const exhausted = await accessFixture({
      scoreableOutcomeAdmissionImplementation(command) {
        return outcomeReceiptFixture(expectedScoreableOutcome, {
          authoritativeRecordTime: command.input.authorityEnvelope.claims.authoritativeRecordTime
        });
      },
      committedProjectionReadImplementation() {
        throw Object.assign(new Error("still pending"), {
          code: "route_iq_coordinator_projection_recovery_pending",
          status: 409
        });
      },
      recoverProjectionImplementation() {
        exhaustedRecoveries += 1;
        return { recovered: true };
      }
    });
    const failed = await admitRouteIqProspectiveIntelligenceOutcomes({
      stub: exhausted.env[ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING].getByName("recovery-exhausted"),
      scopeEnvelope: await createRouteIqProspectiveAuthorityEnvelope({
        purpose: "coordinator_scope",
        ...scope(),
        registryVersion: "noncanonical-test-registry-v1",
        issuedAt: testNow.toISOString(),
        territoryContext: territoryContext()
      }, exhausted.env),
      scope: scope(),
      env: exhausted.env,
      fieldSessionOutcomeProjection: fixture.fieldSessionOutcomeProjection,
      reconciliationReceipt: fixture.reconciliationReceipt,
      noncanonicalTestHooks: exhausted.noncanonicalTestHooks
    });
    assert.equal(failed.status, "processed_with_failures");
    assert.equal(failed.totals.failedLinkCount, 1);
    assert.equal(failed.processedLinks[0].code, "route_iq_prospective_projection_recovery_exhausted");
    assert.equal(exhaustedRecoveries, 128);
  });

  await t.test("late retry reuses the exact outcome receipt and committed projection without new recovery", async () => {
    const fixture = committedOutcomeFixture({ visitLabel: "late-retry" });
    const expectedScoreableOutcome = deriveRouteIqScoreableOutcomeFromCommittedEvidence({
      fieldSessionOutcomeProjection: fixture.fieldSessionOutcomeProjection,
      reconciliationReceipt: fixture.reconciliationReceipt,
      sourceVisitRecordSha256: fixture.link.sourceVisitRecordSha256
    });
    const stableOutcomeReceipt = outcomeReceiptFixture(expectedScoreableOutcome, {
      authoritativeRecordTime: "2026-07-13T20:08:00.001Z"
    });
    let projectionReady = false;
    let recoveryCalls = 0;
    const access = await accessFixture({
      scoreableOutcomeAdmissionImplementation() {
        return stableOutcomeReceipt;
      },
      committedProjectionReadImplementation() {
        if (!projectionReady) {
          throw Object.assign(new Error("projection not committed yet"), {
            code: "route_iq_coordinator_projection_recovery_pending",
            status: 409
          });
        }
        return {
          ok: true,
          found: true,
          record: committedProjectionRecordFixture(expectedScoreableOutcome, stableOutcomeReceipt)
        };
      },
      recoverProjectionImplementation() {
        recoveryCalls += 1;
        return { recovered: false };
      },
      evaluationAdmissionImplementation() {
        return { state: "EVALUATED" };
      }
    });
    const scopeEnvelope = await createRouteIqProspectiveAuthorityEnvelope({
      purpose: "coordinator_scope",
      ...scope(),
      registryVersion: "noncanonical-test-registry-v1",
      issuedAt: testNow.toISOString(),
      territoryContext: territoryContext()
    }, access.env);
    const first = await admitRouteIqProspectiveIntelligenceOutcomes({
      stub: access.env[ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING].getByName("late-retry"),
      scopeEnvelope,
      scope: scope(),
      env: access.env,
      fieldSessionOutcomeProjection: fixture.fieldSessionOutcomeProjection,
      reconciliationReceipt: fixture.reconciliationReceipt,
      noncanonicalTestHooks: access.noncanonicalTestHooks
    });
    assert.equal(first.status, "processed_with_failures");
    assert.equal(first.totals.failedLinkCount, 1);
    assert.equal(recoveryCalls, 1);

    projectionReady = true;
    const beforeRetryRecoveries = recoveryCalls;
    const second = await admitRouteIqProspectiveIntelligenceOutcomes({
      stub: access.env[ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING].getByName("late-retry"),
      scopeEnvelope,
      scope: scope(),
      env: access.env,
      fieldSessionOutcomeProjection: fixture.fieldSessionOutcomeProjection,
      reconciliationReceipt: fixture.reconciliationReceipt,
      noncanonicalTestHooks: access.noncanonicalTestHooks
    });
    assert.equal(second.status, "processed_with_failures");
    assert.equal(second.totals.failedLinkCount, 1);
    assert.equal(recoveryCalls, beforeRetryRecoveries);
    assert.equal(second.processedLinks[0].code, "route_iq_evaluation_input_invalid");
  });
});

test("invalid Access, unmapped scope, missing key, and caller routing all fail before DO lookup", async () => {
  const invalidTokenFixture = await accessFixture();
  const tokenParts = invalidTokenFixture.token.split(".");
  tokenParts[2] = `${tokenParts[2][0] === "a" ? "b" : "a"}${tokenParts[2].slice(1)}`;
  const invalidToken = tokenParts.join(".");
  const invalidAccess = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }, invalidToken),
    invalidTokenFixture.env,
    { noncanonicalTestHooks: invalidTokenFixture.noncanonicalTestHooks }
  );
  assert.equal(invalidAccess.status, 403);
  assert.equal(invalidTokenFixture.calls.includes("do_lookup"), false);

  const missingTokenFixture = await accessFixture();
  const missingToken = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }),
    missingTokenFixture.env,
    { noncanonicalTestHooks: missingTokenFixture.noncanonicalTestHooks }
  );
  assert.equal(missingToken.status, 403);
  assert.equal(missingTokenFixture.calls.includes("do_lookup"), false);

  const expiredFixture = await accessFixture({ expired: true });
  const expired = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }, expiredFixture.token),
    expiredFixture.env,
    { noncanonicalTestHooks: expiredFixture.noncanonicalTestHooks }
  );
  assert.equal(expired.status, 403);
  assert.equal(expiredFixture.calls.includes("do_lookup"), false);

  const wrongAudienceFixture = await accessFixture({ tokenAudience: randomBytes(24).toString("hex") });
  const wrongAudience = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }, wrongAudienceFixture.token),
    wrongAudienceFixture.env,
    { noncanonicalTestHooks: wrongAudienceFixture.noncanonicalTestHooks }
  );
  assert.equal(wrongAudience.status, 403);
  assert.equal(wrongAudienceFixture.calls.includes("do_lookup"), false);

  const missingConfigFixture = await accessFixture();
  delete missingConfigFixture.env[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.accessAudience];
  const missingConfig = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }, missingConfigFixture.token),
    missingConfigFixture.env,
    { noncanonicalTestHooks: missingConfigFixture.noncanonicalTestHooks }
  );
  assert.equal(missingConfig.status, 403);
  assert.equal(missingConfigFixture.calls.includes("do_lookup"), false);

  const missingMapFixture = await accessFixture();
  delete missingMapFixture.env[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.principalMap];
  const missingMap = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }, missingMapFixture.token),
    missingMapFixture.env,
    { noncanonicalTestHooks: missingMapFixture.noncanonicalTestHooks }
  );
  assert.equal(missingMap.status, 403);
  assert.equal(missingMapFixture.calls.includes("do_lookup"), false);

  for (const mutation of ["missing", "invalid"]) {
    const territoryFixture = await accessFixture();
    const config = JSON.parse(territoryFixture.env[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.principalMap]);
    if (mutation === "missing") delete config.principals[0].territoryContext;
    else config.principals[0].territoryContext.availableAt = "not-a-time";
    territoryFixture.env[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.principalMap] = JSON.stringify(config);
    const response = await handleRouteIqProspectiveShadowRequest(
      eventRequest({ eventKind: "next_stop_requested" }, territoryFixture.token),
      territoryFixture.env,
      { noncanonicalTestHooks: territoryFixture.noncanonicalTestHooks }
    );
    assert.equal(response.status, mutation === "missing" ? 400 : 403, mutation);
    assert.equal(territoryFixture.calls.includes("do_lookup"), false, mutation);
  }

  const crossScopeFixture = await accessFixture({ cohortRepresentativeId: "anthony" });
  const crossScope = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }, crossScopeFixture.token),
    crossScopeFixture.env,
    { noncanonicalTestHooks: crossScopeFixture.noncanonicalTestHooks }
  );
  assert.equal(crossScope.status, 403);
  assert.equal(crossScopeFixture.calls.includes("do_lookup"), false);

  const missingKeyFixture = await accessFixture();
  delete missingKeyFixture.env[ROUTE_IQ_PROSPECTIVE_SHADOW_ENV.authorityKey];
  const missingKey = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }, missingKeyFixture.token),
    missingKeyFixture.env,
    { noncanonicalTestHooks: missingKeyFixture.noncanonicalTestHooks }
  );
  assert.equal(missingKey.status, 503);
  assert.equal(missingKeyFixture.calls.includes("do_lookup"), false);

  const callerRoutingFixture = await accessFixture();
  const callerRouting = await handleRouteIqProspectiveShadowRequest(
    eventRequest({
      eventKind: "next_stop_requested",
      workspaceId: "fitness_connection",
      sessionId: "caller-session",
      opportunityId: "caller-opportunity"
    }, callerRoutingFixture.token),
    callerRoutingFixture.env,
    { noncanonicalTestHooks: callerRoutingFixture.noncanonicalTestHooks }
  );
  const callerRoutingBody = await callerRouting.json();
  assert.equal(callerRouting.status, 400);
  assert.equal(callerRoutingBody.code, "route_iq_prospective_caller_authority_prohibited");
  assert.equal(callerRoutingFixture.calls.includes("do_lookup"), false);
});

test("browser body allowlist rejects authority, candidate, source, seal, and readiness fields", async () => {
  const fixture = await accessFixture();
  const prohibitedFields = [
    "workspaceId",
    "operatingProfileId",
    "representativeId",
    "sessionId",
    "opportunityId",
    "authoritativeTimestamp",
    "recordSha256",
    "eligibility",
    "provenance",
    "seal",
    "engineVersion",
    "readiness",
    "candidates",
    "sourceManifest",
    "retentionEnvelope",
    "retentionBoundary",
    "sourceSession"
  ];
  for (const field of prohibitedFields) {
    const response = await handleRouteIqProspectiveShadowRequest(
      eventRequest({ eventKind: "next_stop_requested", [field]: "caller-value" }, fixture.token),
      fixture.env,
      { noncanonicalTestHooks: fixture.noncanonicalTestHooks }
    );
    assert.equal(response.status, 400, field);
    assert.equal((await response.json()).code, "route_iq_prospective_caller_authority_prohibited", field);
  }
  assert.equal(fixture.calls.includes("do_lookup"), false);

  const oversized = await handleRouteIqProspectiveShadowRequest(
    eventRequest({ eventKind: "next_stop_requested" }, fixture.token, { "Content-Length": "2049" }),
    fixture.env,
    { noncanonicalTestHooks: fixture.noncanonicalTestHooks }
  );
  assert.equal(oversized.status, 413);
  assert.equal(fixture.calls.includes("do_lookup"), false);
});

test("HMAC authority envelopes require the protected key and reject tampering", async () => {
  const env = authorityEnv();
  const claims = {
    purpose: "coordinator_scope",
    ...scope(),
    registryVersion: "noncanonical-test-registry-v1",
    issuedAt: testNow.toISOString()
  };
  const envelope = await createRouteIqProspectiveAuthorityEnvelope(claims, env);
  const verified = await createRouteIqProspectiveAuthorityVerifier(env).verify(envelope, {
    purpose: "coordinator_scope"
  });
  assert.equal(verified.authenticated, true);
  assert.equal(verified.algorithm, "HMAC-SHA-256");
  assert.deepEqual(verified.claims, claims);

  const tampered = structuredClone(envelope);
  tampered.claims.representativeId = "anthony";
  await assert.rejects(
    createRouteIqProspectiveAuthorityVerifier(env).verify(tampered, { purpose: "coordinator_scope" }),
    error => error.code === "route_iq_prospective_authority_invalid"
  );
  await assert.rejects(
    createRouteIqProspectiveAuthorityEnvelope(claims, {}),
    error => error.code === "route_iq_prospective_authority_key_missing"
  );
});

test("Data retention admission requires a fresh producer signature and exact scope/evidence bindings", async () => {
  const env = authorityEnv();
  const fixture = committedOutcomeFixture();
  const scoreableOutcome = deriveRouteIqScoreableOutcomeFromCommittedEvidence({
    fieldSessionOutcomeProjection: fixture.fieldSessionOutcomeProjection,
    reconciliationReceipt: fixture.reconciliationReceipt,
    sourceVisitRecordSha256: fixture.link.sourceVisitRecordSha256
  });
  const claims = {
    purpose: "data_retention_admission",
    admissionVersion: routeIqProspectiveDataRetentionAdmissionVersion,
    admissionState: "RETENTION_ADMITTED",
    issuedAt: testNow.toISOString(),
    expiresAt: new Date(testNow.getTime() + 60_000).toISOString(),
    scope: scope(),
    sourceOutcomeEvidenceSha256: scoreableOutcome.sourceOutcomeEvidenceSha256,
    sourceArchiveRawSha256: scoreableOutcome.sourceArchiveRawSha256,
    retentionEnvelope: { dataOwned: "opaque-to-infrastructure" }
  };
  const envelope = await createRouteIqProspectiveAuthorityEnvelope(claims, env, { channel: "producer" });
  const verified = await verifyRouteIqProspectiveDataRetentionAdmission(envelope, {
    env,
    scope: scope(),
    scoreableOutcome,
    now: testNow
  });
  assert.equal(verified.verificationType, "infrastructure_verified_producer_signature");
  assert.deepEqual(verified.retentionEnvelope, claims.retentionEnvelope);

  const tampered = structuredClone(envelope);
  tampered.claims.sourceArchiveRawSha256 = digest("tampered-raw");
  await assert.rejects(
    verifyRouteIqProspectiveDataRetentionAdmission(tampered, {
      env,
      scope: scope(),
      scoreableOutcome,
      now: testNow
    }),
    error => error.code === "route_iq_prospective_authority_invalid"
  );
  const crossScope = await createRouteIqProspectiveAuthorityEnvelope({
    ...claims,
    scope: scope("anthony")
  }, env, { channel: "producer" });
  await assert.rejects(
    verifyRouteIqProspectiveDataRetentionAdmission(crossScope, {
      env,
      scope: scope(),
      scoreableOutcome,
      now: testNow
    }),
    error => error.code === "route_iq_prospective_data_retention_admission_invalid"
  );
  const stale = await createRouteIqProspectiveAuthorityEnvelope({
    ...claims,
    issuedAt: "2026-07-13T19:00:00.000Z",
    expiresAt: "2026-07-13T19:05:00.000Z"
  }, env, { channel: "producer" });
  await assert.rejects(
    verifyRouteIqProspectiveDataRetentionAdmission(stale, {
      env,
      scope: scope(),
      scoreableOutcome,
      now: testNow
    }),
    error => error.code === "route_iq_prospective_data_retention_admission_stale"
  );
  const held = await createRouteIqProspectiveAuthorityEnvelope({
    ...claims,
    admissionState: "RETENTION_HELD"
  }, env, { channel: "producer" });
  await assert.rejects(
    verifyRouteIqProspectiveDataRetentionAdmission(held, {
      env,
      scope: scope(),
      scoreableOutcome,
      now: testNow
    }),
    error => error.code === "route_iq_prospective_data_retention_admission_invalid"
  );
  const malformed = await createRouteIqProspectiveAuthorityEnvelope({
    ...claims,
    retentionEnvelope: null
  }, env, { channel: "producer" });
  await assert.rejects(
    verifyRouteIqProspectiveDataRetentionAdmission(malformed, {
      env,
      scope: scope(),
      scoreableOutcome,
      now: testNow
    }),
    error => error.code === "route_iq_prospective_data_retention_admission_invalid"
  );
});

test("SQLite preflight enforces conservative statement and binding limits before sql.exec", () => {
  let execCalls = 0;
  const storage = {
    sql: {
      databaseSize: 0,
      exec() {
        execCalls += 1;
        return {
          rowsRead: 0,
          rowsWritten: 0,
          next() {
            return { done: true, value: undefined };
          }
        };
      }
    },
    transactionSync(callback) {
      return callback();
    }
  };
  const repository = new CloudflareRouteIqProspectiveSqliteRepository(storage);

  const configuredStatementBytes = 96 * 1024;
  const documentedThresholdBytes = 100_000;
  const boundarySql = "SELECT " + "a".repeat(configuredStatementBytes - "SELECT ".length);
  assert.doesNotThrow(() => repository.executeSchema(boundarySql));
  assert.equal(execCalls, 1);

  assert.throws(
    () => repository.executeSchema(boundarySql + "a"),
    error => error?.code === "route_iq_prospective_sql_statement_too_large"
  );
  assert.equal(execCalls, 1);

  const documentedThresholdSql = "SELECT " + "b".repeat(documentedThresholdBytes - "SELECT ".length);
  assert.throws(
    () => repository.execute(documentedThresholdSql),
    error => error?.code === "route_iq_prospective_sql_statement_too_large"
  );
  assert.equal(execCalls, 1);

  assert.doesNotThrow(() => repository.execute("SELECT " + Array(96).fill("?").join(","), Array(96).fill(1)));
  assert.equal(execCalls, 2);

  assert.throws(
    () => repository.execute("SELECT " + Array(97).fill("?").join(","), Array(97).fill(1)),
    error => error?.code === "route_iq_prospective_sql_bindings_too_large"
  );
  assert.equal(execCalls, 2);
});

const miniflareHarnessScript = `
export { RouteIqProspectiveShadowCoordinator } from "./workers/infrastructure/route-iq-prospective-shadow-durable-object.js";

const methods = new Set([
  "allocateNextStopOpportunity",
  "noteGovernedRepresentativeSignal",
  "closeCanonicalSession",
  "readCanonicalRuntimeContext",
  "recordRuntimeStageExclusion",
  "linkServerDerivedNextStopAction",
  "reconcileCommittedFieldSessionOutcomes",
  "admitIntelligenceScoreableOutcome",
  "admitIntelligenceEvaluation",
  "applyTrustedTrigger",
  "applyTrustedCandidateManifest",
  "applyTrustedSnapshotSeal",
  "applyTrustedShadowDecisionSeal",
  "recoverNextProjection",
  "readCommittedProjectionAsOf",
  "readCommittedProjectionForOutcomeArtifact"
]);

export default {
  async fetch(request, env) {
    const body = await request.json();
    if (!methods.has(body.method)) return Response.json({ ok: false, message: "test method blocked" }, { status: 400 });
    const stub = env.ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR.getByName(body.instanceName);
    try {
      return Response.json({ ok: true, result: await stub[body.method](body.command) });
    } catch (error) {
      return Response.json({
        ok: false,
        name: error.name,
        message: error.message,
        code: error.code || null,
        status: error.status || null
      }, { status: 599 });
    }
  }
};
`;

function createMiniflare(bindings, persistencePath) {
  return new Miniflare(convertV4MiniflareOptions({
    modules: [
      {
        type: "ESModule",
        path: join(root, "route-iq-prospective-shadow-noncanonical-test-harness.mjs"),
        contents: miniflareHarnessScript
      },
      ...[
        "workers/infrastructure/route-iq-prospective-shadow-durable-object.js",
        "workers/infrastructure/route-iq-prospective-shadow-authority.js",
        "workers/infrastructure/route-iq-prospective-shadow-contract.js",
        "data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs",
        "data/route-iq-field-sessions-v1/route-iq-prospective-retention-policy.mjs",
        "data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs",
        "data/route-iq-field-sessions-v1/route-iq-retention-governance.mjs"
      ].map(path => ({ type: "ESModule", path: join(root, path) }))
    ],
    modulesRoot: root,
    compatibilityDate: "2026-07-13",
    compatibilityFlags: ["nodejs_compat"],
    durableObjects: {
      [ROUTE_IQ_PROSPECTIVE_SHADOW_BINDING]: {
        className: ROUTE_IQ_PROSPECTIVE_SHADOW_CLASS,
        useSQLite: true
      }
    },
    resourcePersistencePath: persistencePath,
    bindings
  }));
}

async function doRpc(miniflare, instanceName, method, command) {
  const response = await miniflare.dispatchFetch("https://noncanonical.invalid/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instanceName, method, command })
  });
  return { status: response.status, body: await response.json() };
}

async function scopeEnvelopeFor(env, representativeId = "cruz") {
  return createRouteIqProspectiveAuthorityEnvelope({
    purpose: "coordinator_scope",
    ...scope(representativeId),
    registryVersion: "noncanonical-test-registry-v1",
    issuedAt: testNow.toISOString(),
    territoryContext: territoryContext(representativeId)
  }, env);
}

function miniflareStub(miniflare, instanceName) {
  return new Proxy({}, {
    get(_target, method) {
      return async command => {
        const response = await doRpc(miniflare, instanceName, String(method), command);
        if (response.status === 200 && response.body.ok) return response.body.result;
        throw Object.assign(new Error(response.body.message || "Noncanonical Miniflare RPC failed."), {
          code: response.body.code || "route_iq_prospective_miniflare_rpc_failed",
          status: response.body.status || 500
        });
      };
    }
  });
}

function miniflareCompatibilityLifecycleHooks(allocationReceipt) {
  const allocationTime = Date.parse(allocationReceipt.authoritativeRecordTime);
  assert.equal(Number.isFinite(allocationTime), true);
  let sequence = 0;
  return {
    enabled: true,
    lifecycleNow() {
      sequence += 1;
      return new Date(allocationTime + sequence);
    },
    produceCandidateManifest: produceProspectiveCompatibilityCandidateManifest
  };
}

async function miniflareRuntimeContext(miniflare, instanceName, env, scopeEnvelope, at) {
  const authorityEnvelope = await createRouteIqProspectiveAuthorityEnvelope({
    purpose: "runtime_context_read",
    ...scope(),
    authoritativeRecordTime: at
  }, env);
  const response = await doRpc(miniflare, instanceName, "readCanonicalRuntimeContext", {
    scopeEnvelope,
    input: { authorityEnvelope }
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body.result;
}

test("real Miniflare seals the complete Intelligence lifecycle, links action, and persists restart state", async () => {
  const persistencePath = mkdtempSync(join(tmpdir(), "prometheus-route-iq-lifecycle-do-"));
  const authority = authorityEnv();
  const runtimeEnv = { ...authority, ASSETS: prospectiveCompatibilityAssets() };
  const instanceName = `noncanonical-lifecycle-${randomUUID()}`;
  const scopeEnvelope = await scopeEnvelopeFor(authority);
  const allocationCommand = {
    scopeEnvelope,
    event: {
      eventKind: "next_stop_requested",
      informationalSequence: 1,
      informationalObservedAt: testNow.toISOString()
    }
  };
  let miniflare = createMiniflare(authority, persistencePath);
  try {
    const [left, right] = await Promise.all([
      doRpc(miniflare, instanceName, "allocateNextStopOpportunity", allocationCommand),
      doRpc(miniflare, instanceName, "allocateNextStopOpportunity", {
        ...allocationCommand,
        event: { eventKind: "next_stop_requested", informationalSequence: 999 }
      })
    ]);
    assert.equal(left.status, 200, JSON.stringify(left.body));
    assert.deepEqual(right.body.result, left.body.result);
    const stub = miniflareStub(miniflare, instanceName);
    const sealed = await orchestrateRouteIqProspectiveNextStop({
      stub,
      scopeEnvelope,
      scope: scope(),
      allocationReceipt: left.body.result,
      assetOrigin: "https://private.invalid/",
      env: runtimeEnv,
      noncanonicalTestHooks: miniflareCompatibilityLifecycleHooks(left.body.result)
    });
    assert.deepEqual(sealed, { status: "shadow_decision_sealed" });
    const action = await linkRouteIqProspectiveServerAction({
      stub,
      scopeEnvelope,
      scope: scope(),
      eventKind: "representative_action_observed",
      authoritativeRecordTime: new Date(testNow.getTime() + 100).toISOString(),
      env: runtimeEnv
    });
    assert.equal(action.state, "ACTION_LINKED");
    assert.equal(action.browserCandidateIdentityAccepted, false);
    assert.match(action.selectedCandidateId, /^riq_candidate_[a-f0-9]{64}$/u);
  } finally {
    await miniflare.dispose();
  }

  miniflare = createMiniflare(authority, persistencePath);
  try {
    const context = await miniflareRuntimeContext(
      miniflare,
      instanceName,
      authority,
      scopeEnvelope,
      new Date(testNow.getTime() + 200).toISOString()
    );
    assert.equal(context.state, "ACTION_LINKED");
    assert.equal(context.completedCandidateIds.length, 1);
  } finally {
    await miniflare.dispose();
    rmSync(persistencePath, { recursive: true, force: true });
  }
});

test("real Miniflare records governed exclusions for action before seal and source failure", async t => {
  await t.test("action before seal", async () => {
    const persistencePath = mkdtempSync(join(tmpdir(), "prometheus-route-iq-premature-action-do-"));
    const authority = authorityEnv();
    const instanceName = `noncanonical-premature-action-${randomUUID()}`;
    const scopeEnvelope = await scopeEnvelopeFor(authority);
    const miniflare = createMiniflare(authority, persistencePath);
    try {
      const allocation = await doRpc(miniflare, instanceName, "allocateNextStopOpportunity", {
        scopeEnvelope,
        event: { eventKind: "next_stop_requested", informationalSequence: 1 }
      });
      assert.equal(allocation.status, 200, JSON.stringify(allocation.body));
      const result = await linkRouteIqProspectiveServerAction({
        stub: miniflareStub(miniflare, instanceName),
        scopeEnvelope,
        scope: scope(),
        eventKind: "representative_action_observed",
        authoritativeRecordTime: new Date(testNow.getTime() + 10).toISOString(),
        env: authority
      });
      assert.equal(result.status, "excluded");
      assert.deepEqual(result.reasonCodes, ["shadow_not_sealed_before_action"]);
    } finally {
      await miniflare.dispose();
      rmSync(persistencePath, { recursive: true, force: true });
    }
  });

  await t.test("source artifact failure", async () => {
    const persistencePath = mkdtempSync(join(tmpdir(), "prometheus-route-iq-source-failure-do-"));
    const authority = authorityEnv();
    const instanceName = `noncanonical-source-failure-${randomUUID()}`;
    const scopeEnvelope = await scopeEnvelopeFor(authority);
    const miniflare = createMiniflare(authority, persistencePath);
    try {
      const allocation = await doRpc(miniflare, instanceName, "allocateNextStopOpportunity", {
        scopeEnvelope,
        event: { eventKind: "next_stop_requested", informationalSequence: 1 }
      });
      await assert.rejects(() => orchestrateRouteIqProspectiveNextStop({
        stub: miniflareStub(miniflare, instanceName),
        scopeEnvelope,
        scope: scope(),
        allocationReceipt: allocation.body.result,
        assetOrigin: "https://private.invalid/",
        env: {
          ...authority,
          ASSETS: { async fetch() { return new Response("missing", { status: 404 }); } }
        },
        noncanonicalTestHooks: {
          enabled: true,
          currentDate: new Date(allocation.body.result.authoritativeRecordTime)
        }
      }), error => error.code === "route_iq_prospective_source_artifact_unavailable");
      const context = await miniflareRuntimeContext(
        miniflare,
        instanceName,
        authority,
        scopeEnvelope,
        new Date(testNow.getTime() + 20).toISOString()
      );
      assert.equal(context.state, "EXCLUDED");
    } finally {
      await miniflare.dispose();
      rmSync(persistencePath, { recursive: true, force: true });
    }
  });
});

test("real Miniflare reconciles an exact committed PII-free field-session projection", async () => {
  const persistencePath = mkdtempSync(join(tmpdir(), "prometheus-route-iq-reconciliation-do-"));
  const authority = authorityEnv();
  const runtimeEnv = { ...authority, ASSETS: prospectiveCompatibilityAssets() };
  const instanceName = `noncanonical-reconciliation-${randomUUID()}`;
  const scopeEnvelope = await scopeEnvelopeFor(authority);
  const miniflare = createMiniflare(authority, persistencePath);
  try {
    const allocation = await doRpc(miniflare, instanceName, "allocateNextStopOpportunity", {
      scopeEnvelope,
      event: { eventKind: "next_stop_requested", informationalSequence: 1 }
    });
    const stub = miniflareStub(miniflare, instanceName);
    await orchestrateRouteIqProspectiveNextStop({
      stub,
      scopeEnvelope,
      scope: scope(),
      allocationReceipt: allocation.body.result,
      assetOrigin: "https://private.invalid/",
      env: runtimeEnv,
      noncanonicalTestHooks: miniflareCompatibilityLifecycleHooks(allocation.body.result)
    });
    const action = await linkRouteIqProspectiveServerAction({
      stub,
      scopeEnvelope,
      scope: scope(),
      eventKind: "representative_action_observed",
      authoritativeRecordTime: new Date(testNow.getTime() + 100).toISOString(),
      env: runtimeEnv
    });
    const runtimePools = prospectiveCompatibilityFixture.runtimePools;
    const selected = runtimePools.cruz.find(record =>
      deriveRouteIqCandidateIdFromGooglePlaceId(record.googlePlaceId) === action.selectedCandidateId);
    assert.ok(selected, "rank-one action must resolve to the governed runtime pool");
    const visitAt = new Date(testNow.getTime() + 60_000).toISOString();
    const generatedAt = new Date(testNow.getTime() + 120_000).toISOString();
    const finalizedAt = new Date(testNow.getTime() + 180_000).toISOString();
    const rawReportText = JSON.stringify({
      app: "Prometheus IQ",
      reportType: "beta-daily-rep-report",
      generatedAt,
      date: "2026-07-13",
      rep: { id: "cruz", name: "Cruz" },
      totals: { visits: 1, conversations: 1, leads: 0, units: 0, laterUnits: 0 },
      visits: [{
        placeName: selected.name,
        placeId: selected.id,
        timestamp: visitAt,
        date: "2026-07-13",
        timeWindow: "Evening",
        outcome: "Conversation",
        conversations: 1,
        leads: 0,
        units: 0,
        laterUnits: 0,
        notes: "",
        gpsAttached: false,
        visitDecisionSource: {
          sourceId: "unknown",
          reason: null,
          evidence: [],
          confidence: 0,
          capturedAt: generatedAt
        },
        recommendationDecisionContext: {
          recommendationAvailable: null,
          recommendationId: null,
          decision: null
        }
      }]
    });
    const store = fieldSessionStore();
    const activePool = prospectiveCompatibilityFixture.activePool;
    const businessHours = prospectiveCompatibilityFixture.businessHours;
    const handoff = await consumeRouteIqEndOfDayHandoff({
      handoffContractId: routeIqEndOfDayHandoffContractId,
      producerSubsystem: "Prometheus Dashboard",
      completionAction: "end_route",
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      finalExportConfirmed: true,
      sourceFinalizedAt: finalizedAt,
      rawReportText
    }, {
      env: { [routeIqFieldSessionStoreBinding]: store },
      runtimePools,
      activePool,
      businessHours,
      ingestedAt: finalizedAt
    });
    const archived = await readRouteIqFieldSessionArchive({
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      sessionId: handoff.sessionId
    }, { env: { [routeIqFieldSessionStoreBinding]: store } });
    const projection = projectCommittedRouteIqFieldSessionOutcomes({
      ...scope(),
      archiveRecord: archived.record
    });
    assert.equal(JSON.stringify(projection).includes(selected.name), false);
    const closeAuthorityEnvelope = await createRouteIqProspectiveAuthorityEnvelope({
      purpose: "close_session",
      ...scope(),
      closeReason: "end_route",
      handoffContractVersion: ROUTE_IQ_PROSPECTIVE_HANDOFF_CONTRACT,
      endOfDayHandoffSha256: handoff.rawSha256,
      authoritativeRecordTime: new Date(testNow.getTime() + 210_000).toISOString()
    }, authority);
    const closed = await doRpc(miniflare, instanceName, "closeCanonicalSession", {
      scopeEnvelope,
      authorityEnvelope: closeAuthorityEnvelope
    });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    const authorityEnvelope = await createRouteIqProspectiveAuthorityEnvelope({
      purpose: "field_session_reconciliation",
      ...scope(),
      authoritativeRecordTime: new Date(testNow.getTime() + 240_000).toISOString(),
      projectionSha256: projection.projectionSha256,
      sourceArchiveRawSha256: projection.sourceArchive.rawSha256,
      sourceArchiveSessionSha256: projection.sourceArchive.sourceArchiveSessionSha256
    }, authority);
    const reconciled = await doRpc(miniflare, instanceName, "reconcileCommittedFieldSessionOutcomes", {
      scopeEnvelope,
      input: { authorityEnvelope, projection }
    });
    assert.equal(reconciled.status, 200, JSON.stringify(reconciled.body));
    assert.equal(reconciled.body.result.linked.length, 1);
    assert.deepEqual(reconciled.body.result.exclusions, []);
    assert.equal(reconciled.body.result.outcomeValuesInferredByData, false);
  } finally {
    await miniflare.dispose();
    rmSync(persistencePath, { recursive: true, force: true });
  }
});

test("real Miniflare restart processes two same-session reconciliation links against their own exact projections", async () => {
  const persistencePath = mkdtempSync(join(tmpdir(), "prometheus-route-iq-two-link-restart-do-"));
  const authority = authorityEnv();
  const runtimeEnv = { ...authority, ASSETS: prospectiveCompatibilityAssets() };
  const instanceName = `noncanonical-two-link-restart-${randomUUID()}`;
  let firstAllocation;
  let secondAllocation;
  let projection;
  let reconciliationReceipt;
  let miniflare = createMiniflare(authority, persistencePath);
  try {
    const scopeEnvelope = await scopeEnvelopeFor(authority);
    const stub = miniflareStub(miniflare, instanceName);
    firstAllocation = (await doRpc(miniflare, instanceName, "allocateNextStopOpportunity", {
      scopeEnvelope,
      event: { eventKind: "next_stop_requested", informationalSequence: 1 }
    })).body.result;
    await orchestrateRouteIqProspectiveNextStop({
      stub,
      scopeEnvelope,
      scope: scope(),
      allocationReceipt: firstAllocation,
      assetOrigin: "https://private.invalid/",
      env: runtimeEnv,
      noncanonicalTestHooks: miniflareCompatibilityLifecycleHooks(firstAllocation)
    });
    const firstAction = await linkRouteIqProspectiveServerAction({
      stub,
      scopeEnvelope,
      scope: scope(),
      eventKind: "representative_action_observed",
      authoritativeRecordTime: new Date(testNow.getTime() + 60_000).toISOString(),
      env: runtimeEnv
    });

    secondAllocation = (await doRpc(miniflare, instanceName, "allocateNextStopOpportunity", {
      scopeEnvelope,
      event: { eventKind: "next_stop_requested", informationalSequence: 2 }
    })).body.result;
    await orchestrateRouteIqProspectiveNextStop({
      stub,
      scopeEnvelope,
      scope: scope(),
      allocationReceipt: secondAllocation,
      assetOrigin: "https://private.invalid/",
      env: runtimeEnv,
      noncanonicalTestHooks: miniflareCompatibilityLifecycleHooks(secondAllocation)
    });
    const secondAction = await linkRouteIqProspectiveServerAction({
      stub,
      scopeEnvelope,
      scope: scope(),
      eventKind: "representative_action_observed",
      authoritativeRecordTime: new Date(testNow.getTime() + 120_000).toISOString(),
      env: runtimeEnv
    });

    const runtimePools = prospectiveCompatibilityFixture.runtimePools;
    const firstSelected = runtimePools.cruz.find(record =>
      deriveRouteIqCandidateIdFromGooglePlaceId(record.googlePlaceId) === firstAction.selectedCandidateId);
    const secondSelected = runtimePools.cruz.find(record =>
      deriveRouteIqCandidateIdFromGooglePlaceId(record.googlePlaceId) === secondAction.selectedCandidateId);
    assert.ok(firstSelected);
    assert.ok(secondSelected);
    assert.notEqual(firstAction.selectedCandidateId, secondAction.selectedCandidateId);

    const store = fieldSessionStore();
    const generatedAt = new Date(testNow.getTime() + 240_000).toISOString();
    const finalizedAt = new Date(testNow.getTime() + 300_000).toISOString();
    const rawReportText = JSON.stringify({
      app: "Prometheus IQ",
      reportType: "beta-daily-rep-report",
      generatedAt,
      date: "2026-07-13",
      rep: { id: "cruz", name: "Cruz" },
      totals: { visits: 2, conversations: 2, leads: 2, units: 0, laterUnits: 0 },
      visits: [
        {
          placeName: firstSelected.name,
          placeId: firstSelected.id,
          timestamp: new Date(testNow.getTime() + 180_000).toISOString(),
          date: "2026-07-13",
          timeWindow: "Evening",
          outcome: "Lead",
          conversations: 1,
          leads: 1,
          units: 0,
          laterUnits: 0,
          notes: "",
          gpsAttached: false,
          visitDecisionSource: {
            sourceId: "unknown",
            reason: null,
            evidence: [],
            confidence: 0,
            capturedAt: generatedAt
          },
          recommendationDecisionContext: {
            recommendationAvailable: null,
            recommendationId: null,
            decision: null
          }
        },
        {
          placeName: secondSelected.name,
          placeId: secondSelected.id,
          timestamp: new Date(testNow.getTime() + 210_000).toISOString(),
          date: "2026-07-13",
          timeWindow: "Evening",
          outcome: "Lead",
          conversations: 1,
          leads: 1,
          units: 0,
          laterUnits: 0,
          notes: "",
          gpsAttached: false,
          visitDecisionSource: {
            sourceId: "unknown",
            reason: null,
            evidence: [],
            confidence: 0,
            capturedAt: generatedAt
          },
          recommendationDecisionContext: {
            recommendationAvailable: null,
            recommendationId: null,
            decision: null
          }
        }
      ]
    });
    const activePool = prospectiveCompatibilityFixture.activePool;
    const businessHours = prospectiveCompatibilityFixture.businessHours;
    const handoff = await consumeRouteIqEndOfDayHandoff({
      handoffContractId: routeIqEndOfDayHandoffContractId,
      producerSubsystem: "Prometheus Dashboard",
      completionAction: "end_day",
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      finalExportConfirmed: true,
      sourceFinalizedAt: finalizedAt,
      rawReportText
    }, {
      env: { [routeIqFieldSessionStoreBinding]: store },
      runtimePools,
      activePool,
      businessHours,
      ingestedAt: finalizedAt
    });
    const archived = await readRouteIqFieldSessionArchive({
      workspaceId: "fitness_connection",
      operatingProfileId: "fitness",
      sessionId: handoff.sessionId
    }, { env: { [routeIqFieldSessionStoreBinding]: store } });
    projection = projectCommittedRouteIqFieldSessionOutcomes({
      ...scope(),
      archiveRecord: archived.record
    });
    const postArchiveBase = Date.parse(projection.sourceArchive.archiveCommittedAt);
    const closed = await doRpc(miniflare, instanceName, "closeCanonicalSession", {
      scopeEnvelope,
      authorityEnvelope: await createRouteIqProspectiveAuthorityEnvelope({
        purpose: "close_session",
        ...scope(),
        closeReason: "end_day",
        handoffContractVersion: ROUTE_IQ_PROSPECTIVE_HANDOFF_CONTRACT,
        endOfDayHandoffSha256: handoff.rawSha256,
        authoritativeRecordTime: new Date(postArchiveBase + 60_000).toISOString()
      }, authority)
    });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    const reconciled = await doRpc(miniflare, instanceName, "reconcileCommittedFieldSessionOutcomes", {
      scopeEnvelope,
      input: {
        authorityEnvelope: await createRouteIqProspectiveAuthorityEnvelope({
          purpose: "field_session_reconciliation",
          ...scope(),
          authoritativeRecordTime: new Date(postArchiveBase + 120_000).toISOString(),
          projectionSha256: projection.projectionSha256,
          sourceArchiveRawSha256: projection.sourceArchive.rawSha256,
          sourceArchiveSessionSha256: projection.sourceArchive.sourceArchiveSessionSha256
        }, authority),
        projection
      }
    });
    assert.equal(reconciled.status, 200, JSON.stringify(reconciled.body));
    reconciliationReceipt = reconciled.body.result;
    assert.equal(reconciliationReceipt.linked.length, 2);
    assert.ok(
      Date.parse(reconciliationReceipt.createdAt) >
        Date.parse(projection.sourceArchive.archiveCommittedAt),
      JSON.stringify({
        reconciledAt: reconciliationReceipt.createdAt,
        archiveCommittedAt: projection.sourceArchive.archiveCommittedAt
      })
    );
  } finally {
    await miniflare.dispose();
  }

  miniflare = createMiniflare(authority, persistencePath);
  try {
    const processed = await admitRouteIqProspectiveIntelligenceOutcomes({
      stub: miniflareStub(miniflare, instanceName),
      scopeEnvelope: await scopeEnvelopeFor(authority),
      scope: scope(),
      env: authority,
      fieldSessionOutcomeProjection: projection,
      reconciliationReceipt,
      noncanonicalTestHooks: {
        enabled: true,
        currentDate: testNow,
        readNoncanonicalDataRetentionAdmission(input) {
          return readNoncanonicalDataRetentionAdmission(input, authority);
        }
      }
    });
    assert.equal(processed.status, "processed_with_failures");
    assert.deepEqual(processed.totals, {
      linkedCount: 2,
      admittedOutcomeCount: 2,
      admittedEvaluationCount: 0,
      skippedEvaluationCount: 0,
      failedLinkCount: 2
    });
    assert.deepEqual(
      processed.processedLinks.map(link => link.code),
      ["route_iq_evaluation_input_invalid", "route_iq_evaluation_input_invalid"]
    );
  } finally {
    await miniflare.dispose();
    rmSync(persistencePath, { recursive: true, force: true });
  }
});

test("real Miniflare SQLite allocator converges, closes, isolates scope, and survives restart", async () => {
  const persistencePath = mkdtempSync(join(tmpdir(), "prometheus-route-iq-do-"));
  const env = authorityEnv();
  const instanceName = `noncanonical-scope-${randomUUID()}`;
  const originalScopeEnvelope = await scopeEnvelopeFor(env);
  const originalCommand = {
    scopeEnvelope: originalScopeEnvelope,
    event: {
      eventKind: "next_stop_requested",
      informationalSequence: 1,
      informationalObservedAt: "2026-07-13T20:00:00.000Z"
    }
  };
  let miniflare = createMiniflare(env, persistencePath);
  let originalReceipt;
  let reopenedReceipt;
  try {
    const [left, right] = await Promise.all([
      doRpc(miniflare, instanceName, "allocateNextStopOpportunity", originalCommand),
      doRpc(miniflare, instanceName, "allocateNextStopOpportunity", {
        scopeEnvelope: originalScopeEnvelope,
        event: {
          eventKind: "next_stop_requested",
          informationalSequence: 999,
          informationalObservedAt: "2026-07-13T20:02:00.000Z"
        }
      })
    ]);
    assert.equal(left.status, 200, JSON.stringify(left.body));
    assert.equal(right.status, 200, JSON.stringify(right.body));
    assert.deepEqual(left.body.result, right.body.result);
    assert.equal(left.body.result.serverDerivedCanonicalIdentity, true);
    assert.match(left.body.result.sessionId, /^riq_session_[a-f0-9]{64}$/u);
    assert.match(left.body.result.opportunityId, /^riq_opportunity_[a-f0-9]{64}$/u);
    originalReceipt = left.body.result;

    const governedNoop = await doRpc(miniflare, instanceName, "noteGovernedRepresentativeSignal", {
      scopeEnvelope: originalScopeEnvelope,
      event: { eventKind: "representative_action_observed", informationalSequence: 2 }
    });
    assert.equal(governedNoop.status, 200);
    assert.deepEqual(governedNoop.body.result, { status: "governed_noop" });

    const afterNoop = await doRpc(miniflare, instanceName, "allocateNextStopOpportunity", originalCommand);
    assert.deepEqual(afterNoop.body.result, originalReceipt);

    const crossScope = await doRpc(miniflare, instanceName, "allocateNextStopOpportunity", {
      scopeEnvelope: await scopeEnvelopeFor(env, "anthony"),
      event: { eventKind: "next_stop_requested", informationalSequence: 1 }
    });
    assert.equal(crossScope.status, 599);
    assert.match(crossScope.body.message, /scope does not own|scope/u);

    const genericRpc = await doRpc(miniflare, instanceName, "execute", { sql: "SELECT 1" });
    assert.equal(genericRpc.status, 400);

    const closeClaims = {
      purpose: "close_session",
      ...scope(),
      closeReason: "end_route",
      handoffContractVersion: ROUTE_IQ_PROSPECTIVE_HANDOFF_CONTRACT,
      endOfDayHandoffSha256: digest("miniflare-canonical-handoff"),
      authoritativeRecordTime: "2026-07-13T20:03:00.000Z"
    };
    const closed = await doRpc(miniflare, instanceName, "closeCanonicalSession", {
      scopeEnvelope: originalScopeEnvelope,
      authorityEnvelope: await createRouteIqProspectiveAuthorityEnvelope(closeClaims, env)
    });
    const closeRetry = await doRpc(miniflare, instanceName, "closeCanonicalSession", {
      scopeEnvelope: originalScopeEnvelope,
      authorityEnvelope: await createRouteIqProspectiveAuthorityEnvelope({
        ...closeClaims,
        authoritativeRecordTime: "2026-07-13T20:04:00.000Z"
      }, env)
    });
    assert.equal(closed.status, 200);
    assert.deepEqual(closeRetry.body.result, closed.body.result);
    assert.equal(closed.body.result.status, "closed");

    const reopened = await doRpc(miniflare, instanceName, "allocateNextStopOpportunity", {
      scopeEnvelope: originalScopeEnvelope,
      event: { eventKind: "next_stop_requested", informationalSequence: 3 }
    });
    assert.equal(reopened.status, 200);
    assert.notEqual(reopened.body.result.sessionId, originalReceipt.sessionId);
    assert.notEqual(reopened.body.result.opportunityId, originalReceipt.opportunityId);
    reopenedReceipt = reopened.body.result;
  } finally {
    await miniflare.dispose();
  }

  miniflare = createMiniflare(env, persistencePath);
  try {
    const afterRestart = await doRpc(miniflare, instanceName, "allocateNextStopOpportunity", {
      scopeEnvelope: originalScopeEnvelope,
      event: {
        eventKind: "next_stop_requested",
        informationalSequence: 500,
        informationalObservedAt: "2026-07-13T20:10:00.000Z"
      }
    });
    assert.equal(afterRestart.status, 200);
    assert.deepEqual(afterRestart.body.result, reopenedReceipt);
  } finally {
    await miniflare.dispose();
    rmSync(persistencePath, { recursive: true, force: true });
  }
});
