import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  createCloudflareKvFieldSessionStore,
  projectRouteIqChronologicalEvidence,
  routeIqFieldSessionStoreBinding
} from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";
import {
  RouteIqProspectiveConflictError,
  appendRouteIqProspectiveAction,
  appendRouteIqProspectiveCorrection,
  appendRouteIqProspectiveGovernedExclusion,
  appendRouteIqProspectiveOutcome,
  captureRouteIqProspectiveOpportunitySnapshot,
  computeRouteIqProspectiveSealReceiptSha256,
  createRouteIqProspectiveServerContext,
  normalizeRouteIqProspectiveOpportunitySnapshot,
  prospectiveLifecycleStorageKeys,
  readRouteIqProspectiveLifecycle,
  routeIqProspectiveActionSchemaVersion,
  routeIqProspectiveCaptureVersion,
  routeIqProspectiveCorrectionSchemaVersion,
  routeIqProspectiveLifecycleVersion,
  routeIqProspectiveOutcomeSchemaVersion,
  routeIqProspectiveSealReceiptVersion,
  routeIqProspectiveSnapshotSchemaVersion
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-shadow-evidence.mjs";
import {
  routeIqProspectiveCollectionDefault,
  routeIqProspectiveRecommendationInfluence
} from "../data/route-iq-field-sessions-v1/route-iq-prospective-shadow-coordinator.mjs";

const ARCHIVE_ROOT = "data/route-iq-field-sessions-v1/workspaces/fitness_connection/sessions/route-iq-field-session-fitness-connection-fitness-cruz-2026-07-11";
const ARCHIVE_PATHS = {
  raw: `${ARCHIVE_ROOT}/raw/prometheus-iq-cruz-daily-report-2026-07-11.json`,
  normalized: `${ARCHIVE_ROOT}/normalized/field-session.json`,
  calculated: `${ARCHIVE_ROOT}/normalized/calculated-metrics.json`,
  stressTestEvidence: `${ARCHIVE_ROOT}/evidence/stress-test-observations.json`,
  historyUpdates: `${ARCHIVE_ROOT}/normalized/history-updates.json`
};
const JULY_11_HASHES = {
  "data/route-iq-field-sessions-v1/source-evidence/july-11-2026-founder-stress-test-findings.json": "f66db5694698dcc75728a16a506c5bab66aac559b9913d991df6a6ce9cdcd9f9",
  [`${ARCHIVE_ROOT}/manifest.json`]: "e0bc2cc65e1c67fb39784c3a1fe87732875b64b6f5f2365df1924da5083265ba",
  [ARCHIVE_PATHS.raw]: "a62ec0643d61c8280e0e23dcd8616894a30a421dc9150281fb7cad334f5c0e6a",
  [ARCHIVE_PATHS.normalized]: "b162ba286debf97461e2f2e172377ed00b07c6c755cd152678e7a944dbccafc8",
  [ARCHIVE_PATHS.calculated]: "71171b79aa725e533113f5cc1d040b13f6fc5cb3b5b4cdee993e8d4b836de911",
  [ARCHIVE_PATHS.historyUpdates]: "0d3f2508b92290b04a1d7b1cc979ee298eea97c9dda84061dbe66e2bea5b5c09",
  [ARCHIVE_PATHS.stressTestEvidence]: "6030bd109659140b00c012fbf09e6a05d63c23f197a58daec8bc63dd2603179e"
};

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function clone(value) {
  return structuredClone(value);
}

function scope(suffix = "0001", overrides = {}) {
  return {
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz",
    fieldSessionId: `route-iq-field-session-prospective-${suffix}`,
    ...overrides
  };
}

function snapshot(suffix = "0001", overrides = {}) {
  const record = {
    schemaVersion: routeIqProspectiveSnapshotSchemaVersion,
    captureVersion: routeIqProspectiveCaptureVersion,
    sourceVersion: "route-iq-candidate-source-v1",
    opportunityId: `opportunity_${suffix.padStart(8, "0")}`,
    idempotencyKey: `snapshot_idempotency_${suffix.padStart(8, "0")}`,
    opportunityType: "next_stop",
    recordOrigin: "prospective",
    scope: scope(suffix),
    candidateSetComplete: true,
    candidates: [
      {
        candidateId: `candidate_beta_${suffix}`,
        sourceRecordIds: [`source_beta_${suffix}`],
        eligibility: {
          status: "eligible",
          reasonCodes: ["source_eligible", "hours_permitted"],
          evaluatedAt: "2026-07-13T12:59:57.000Z"
        }
      },
      {
        candidateId: `candidate_alpha_${suffix}`,
        sourceRecordIds: [`source_alpha_${suffix}`],
        eligibility: {
          status: "eligible",
          reasonCodes: ["territory_permitted"],
          evaluatedAt: "2026-07-13T12:59:56.000Z"
        }
      }
    ],
    sourceManifest: [
      { sourceRecordId: `source_beta_${suffix}`, availableAt: "2026-07-13T12:59:56.000Z" },
      { sourceRecordId: `source_alpha_${suffix}`, availableAt: "2026-07-13T12:59:55.000Z" }
    ],
    context: {
      territory: { territoryId: `territory_${suffix}` },
      time: { timezone: "America/Chicago", windowId: `window_${suffix}`, localDate: "2026-07-13" },
      permittedRepresentative: { representativeId: "cruz", registryVersion: "fitness-representative-registry-v1" }
    },
    client: { sequence: 10, observedAt: "2026-07-13T12:59:59.000Z", syncMode: "online" }
  };
  return Object.assign(record, overrides);
}

function trusted(at, { cutoff, receipt } = {}) {
  return createRouteIqProspectiveServerContext({
    authoritativeTimestamp: at,
    evidenceCutoff: cutoff ?? null,
    sealReceipt: receipt ?? null
  });
}

function harness() {
  const data = new Map();
  const writes = [];
  let failCommitBeforeWrite = false;
  const binding = {
    data,
    writes,
    failNextRecordCommit() {
      failCommitBeforeWrite = true;
    },
    async get(key) {
      return data.get(key)?.value ?? null;
    },
    async put(key, value, options = {}) {
      if (failCommitBeforeWrite && key.includes("/records/") && key.endsWith("/commit.json")) {
        failCommitBeforeWrite = false;
        throw new Error("simulated_commit_network_failure");
      }
      data.set(key, { value: String(value), options: clone(options) });
      writes.push({ key, value: String(value), options: clone(options) });
    },
    async list({ prefix = "" } = {}) {
      return {
        keys: [...data.keys()].filter(key => key.startsWith(prefix)).sort().map(name => ({ name })),
        list_complete: true
      };
    }
  };
  const adapter = () => createCloudflareKvFieldSessionStore({ [routeIqFieldSessionStoreBinding]: binding });
  return { data, writes, binding, adapter };
}

function sealReceipt(snapshotArtifact, sealedAt = "2026-07-13T13:00:01.000Z", overrides = {}) {
  const body = {
    receiptVersion: routeIqProspectiveSealReceiptVersion,
    producerSubsystem: "Prometheus Intelligence Engine",
    opportunityId: snapshotArtifact.opportunityId,
    snapshotArtifactId: snapshotArtifact.artifactId,
    snapshotRecordSha256: snapshotArtifact.recordSha256,
    candidateSetSha256: snapshotArtifact.candidateSetSha256,
    evidenceCutoff: snapshotArtifact.evidenceCutoff,
    projectionVersion: "route-iq-chronological-evidence-projection-v1",
    projectionSha256: "1".repeat(64),
    sealedAt,
    sealedShadowRecordSha256: "2".repeat(64),
    ...overrides
  };
  return { ...body, receiptSha256: computeRouteIqProspectiveSealReceiptSha256(body) };
}

function action(record, suffix = "0001", overrides = {}) {
  return {
    schemaVersion: routeIqProspectiveActionSchemaVersion,
    opportunityId: record.opportunityId,
    idempotencyKey: `action_idempotency_${suffix.padStart(8, "0")}`,
    actionId: `action_record_${suffix.padStart(8, "0")}`,
    actionType: "next_stop_selected",
    scope: clone(record.scope),
    recordOrigin: "prospective",
    selectedCandidateId: record.candidates[0].candidateId,
    decisionSource: null,
    client: { sequence: 11, observedAt: "2026-07-13T13:00:01.500Z", syncMode: "online" },
    ...overrides
  };
}

function outcome(record, actionRecord, suffix = "0001", overrides = {}) {
  return {
    schemaVersion: routeIqProspectiveOutcomeSchemaVersion,
    opportunityId: record.opportunityId,
    idempotencyKey: `outcome_idempotency_${suffix.padStart(8, "0")}`,
    outcomeId: `outcome_record_${suffix.padStart(8, "0")}`,
    actionId: actionRecord.actionId,
    scope: clone(record.scope),
    recordOrigin: "prospective",
    evaluatedCandidateId: actionRecord.selectedCandidateId,
    observedOutcome: { status: "observed", value: true },
    client: { sequence: 12, observedAt: "2026-07-13T13:00:02.500Z", syncMode: "online" },
    ...overrides
  };
}

async function accepted(h, suffix = "0001") {
  const input = snapshot(suffix);
  const result = await captureRouteIqProspectiveOpportunitySnapshot(input, {
    store: h.adapter(),
    serverContext: trusted("2026-07-13T13:00:00.000Z", { cutoff: "2026-07-13T13:00:00.000Z" })
  });
  return { input, result, receipt: sealReceipt(result.artifact) };
}

function committedArchive() {
  const texts = Object.fromEntries(Object.entries(ARCHIVE_PATHS).map(([name, path]) => [name, readFileSync(path, "utf8")]));
  const normalizedRecord = JSON.parse(texts.normalized);
  return {
    commit: {
      status: "committed",
      workspaceId: normalizedRecord.workspaceId,
      sessionId: normalizedRecord.sessionId,
      operatingProfileId: normalizedRecord.operatingProfileId,
      rawSha256: hash(texts.raw)
    },
    rawReportText: texts.raw,
    normalizedRecord,
    calculatedMetrics: JSON.parse(texts.calculated),
    stressTestEvidence: JSON.parse(texts.stressTestEvidence),
    historyUpdates: JSON.parse(texts.historyUpdates),
    sourceArtifacts: Object.fromEntries(Object.entries(texts).map(([name, text]) => [name, {
      key: ARCHIVE_PATHS[name], text, sha256: hash(text), byteLength: Buffer.byteLength(text)
    }]))
  };
}

test("schema, Data contract, archive bytes, and inactive production state are fixed", () => {
  const schema = JSON.parse(readFileSync("data/route-iq-field-sessions-v1/route-iq-prospective-opportunity-snapshot-v1.schema.json", "utf8"));
  const contract = JSON.parse(readFileSync("overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json", "utf8"));
  assert.equal(schema.$defs.captureRequest.additionalProperties, false);
  for (const prohibited of ["authoritativeTimestamp", "candidateSetSha256", "decisionSource", "rank", "probability", "readiness", "engineVersion", "notes", "email", "latitude"]) {
    assert.equal(Object.hasOwn(schema.$defs.captureRequest.properties, prohibited), false);
  }
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.status, "data_server_allocator_ready_runtime_inactive");
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.storage.authoritativeTechnology, "cloudflare_sqlite_backed_durable_object");
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.storage.runtimeAdapterImplemented, true);
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.storage.runtimeBindingIntroducedByData, false);
  assert.equal(routeIqProspectiveCollectionDefault, "off");
  assert.equal(routeIqProspectiveRecommendationInfluence, "off");
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.legacyKvStorage.binding, routeIqFieldSessionStoreBinding);
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.legacyKvStorage.authority, "non_authoritative_cache_only");
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.legacyKvStorage.controlsReadinessEvidence, false);
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.authorityBoundary.unkeyedDigestAcceptedAsAuthentication, false);
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.canonicalIdentity.canonicalSessionRecordSha256CompositeForeignKeyRequired, true);
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.transactionAndRecovery.logicalRequestDigestExcludesAuthoritativeRecordTime, true);
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.transactionAndRecovery.changedRetryConflictRecordTimeOwnedByCoordinator, true);
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.transactionAndRecovery.changedRetryConflictTimeDerivationCallerControlled, false);
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.chronology.backdatedOrEqualTimeOperationalEvidencePersisted, false);
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.chronology.sameOrBackdatedChangedRetryPreservedAsGovernanceConflict, true);
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.projection.asOfSequenceAndTimeMustResolveSameHistoryPrefix, true);
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.projection.minimumEvidenceState, "SHADOW_DECISION_SEALED");
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.retentionAndCollection.newPiiCollected, false);
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.retentionAndCollection.newRetentionPeriodIntroduced, false);
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.retentionAndCollection.existingRetentionPeriodExtended, false);
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.activation.productionCollectionActivated, false);
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.activation.infrastructureWiringComplete, false);
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.activation.dashboardCollectionComplete, false);
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.activation.intelligenceConsumerAuthorized, false);
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.retentionAndCollection.productionCollectionActivated, false);
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.retentionAndCollection.productionEvidenceRecords, 0);
  assert.equal(contract.prospectiveShadowEvidenceLifecycleContract.activation.recommendationInfluenceActivated, false);
  assert.equal(contract.expectedFieldSessionMetrics.prospectiveProductionRecords, 0);
  for (const [path, expected] of Object.entries(JULY_11_HASHES)) assert.equal(hash(readFileSync(path)), expected, path);
});

test("snapshot normalization is canonical, immutable, and Data hashes the complete candidate set", () => {
  const input = snapshot("1001");
  const context = trusted("2026-07-13T13:00:00.000Z", { cutoff: "2026-07-13T13:00:00.000Z" });
  const normalized = normalizeRouteIqProspectiveOpportunitySnapshot(input, context);
  const reordered = snapshot("1001");
  reordered.candidates.reverse();
  reordered.sourceManifest.reverse();
  reordered.candidates.find(item => item.candidateId.includes("beta")).eligibility.reasonCodes.reverse();
  const normalizedReordered = normalizeRouteIqProspectiveOpportunitySnapshot(reordered, context);
  assert.equal(normalized.requestSha256, normalizedReordered.requestSha256);
  assert.equal(normalized.candidateSetSha256, normalizedReordered.candidateSetSha256);
  assert.deepEqual(normalized.canonicalRequest.candidates.map(item => item.candidateId), [...normalized.canonicalRequest.candidates.map(item => item.candidateId)].sort());
  assert.equal(normalized.capturedAt, "2026-07-13T13:00:00.000Z");
  assert.equal(normalized.evidenceCutoff, normalized.capturedAt);
  assert.equal(Object.hasOwn(normalized.canonicalRequest, "candidateSetSha256"), false);
  assert.equal(Object.hasOwn(normalized.canonicalRequest, "authoritativeTimestamp"), false);
  assert.equal(Object.isFrozen(normalized.canonicalRequest.candidates[0].eligibility.reasonCodes), true);

  const futureEligibility = snapshot("1002");
  futureEligibility.candidates[0].eligibility.evaluatedAt = "2026-07-13T13:00:00.000Z";
  assert.throws(() => normalizeRouteIqProspectiveOpportunitySnapshot(futureEligibility, context), error => error.code === "route_iq_candidate_eligibility_not_strictly_before_cutoff");
});

test("accepted snapshot commits last in the existing session keyspace and survives separate-adapter restart", async () => {
  const h = harness();
  const { input, result } = await accepted(h, "1101");
  const keys = prospectiveLifecycleStorageKeys(input.scope, input.opportunityId);
  assert.equal(result.status, "recorded");
  assert.equal(result.artifact.lifecycleVersion, routeIqProspectiveLifecycleVersion);
  assert.equal(result.artifact.candidateSetComplete, true);
  assert.equal(result.artifact.rankingCalculatedByData, false);
  assert.equal(result.artifact.readinessCalculatedByData, false);
  assert.equal(result.artifact.recommendationInfluence, "off");
  assert.equal(h.writes[0].key.startsWith(keys.recordsRoot), true);
  assert.equal(h.writes[0].key.endsWith("/artifact.json"), true);
  assert.equal(h.writes[0].options.metadata.appendOnly, true);
  assert.equal(h.writes.at(-1).key.endsWith("/commit.json"), true);
  assert.equal(h.writes.at(-1).options.metadata.committedLast, true);

  const restarted = await readRouteIqProspectiveLifecycle({ ...input.scope, opportunityId: input.opportunityId }, { store: h.adapter() });
  assert.equal(restarted.found, true);
  assert.equal(restarted.record.acceptedSnapshot.recordSha256, result.artifact.recordSha256);
  assert.equal(restarted.record.records.length, 1);
  assert.equal(restarted.record.collectionActivation, "inactive_until_infrastructure_and_dashboard_owner_wiring");
});

test("identical replay returns original across new server time and concurrent adapters", async () => {
  const h = harness();
  const input = snapshot("1201");
  const first = await captureRouteIqProspectiveOpportunitySnapshot(input, {
    store: h.adapter(),
    serverContext: trusted("2026-07-13T13:00:00.000Z", { cutoff: "2026-07-13T13:00:00.000Z" })
  });
  const writes = h.writes.length;
  const replay = await captureRouteIqProspectiveOpportunitySnapshot(clone(input), {
    store: h.adapter(),
    serverContext: trusted("2026-07-13T14:00:00.000Z", { cutoff: "2026-07-13T14:00:00.000Z" })
  });
  assert.equal(replay.duplicate, true);
  assert.equal(replay.artifact.capturedAt, first.artifact.capturedAt);
  assert.equal(replay.artifact.recordSha256, first.artifact.recordSha256);
  assert.equal(h.writes.length, writes);

  const concurrentHarness = harness();
  const concurrentInput = snapshot("1202");
  const [one, two] = await Promise.all([
    captureRouteIqProspectiveOpportunitySnapshot(clone(concurrentInput), {
      store: concurrentHarness.adapter(),
      serverContext: trusted("2026-07-13T13:00:00.000Z", { cutoff: "2026-07-13T13:00:00.000Z" })
    }),
    captureRouteIqProspectiveOpportunitySnapshot(clone(concurrentInput), {
      store: concurrentHarness.adapter(),
      serverContext: trusted("2026-07-13T13:00:01.000Z", { cutoff: "2026-07-13T13:00:01.000Z" })
    })
  ]);
  assert.deepEqual([one.duplicate, two.duplicate].sort(), [false, true]);
  assert.equal(one.artifact.recordSha256, two.artifact.recordSha256);
  assert.equal(concurrentHarness.data.size, 2);

  const conflictingHarness = harness();
  const firstInput = snapshot("1203");
  const secondInput = clone(firstInput);
  secondInput.idempotencyKey = "snapshot_concurrent_other_1203";
  secondInput.candidates[0].eligibility.reasonCodes.push("concurrent_change");
  const settled = await Promise.allSettled([
    captureRouteIqProspectiveOpportunitySnapshot(firstInput, {
      store: conflictingHarness.adapter(),
      serverContext: trusted("2026-07-13T13:00:00.000Z", { cutoff: "2026-07-13T13:00:00.000Z" })
    }),
    captureRouteIqProspectiveOpportunitySnapshot(secondInput, {
      store: conflictingHarness.adapter(),
      serverContext: trusted("2026-07-13T13:00:01.000Z", { cutoff: "2026-07-13T13:00:01.000Z" })
    })
  ]);
  assert.deepEqual(settled.map(item => item.status).sort(), ["fulfilled", "rejected"]);
  assert.equal(settled.find(item => item.status === "rejected").reason instanceof RouteIqProspectiveConflictError, true);
  const conflictingRead = await readRouteIqProspectiveLifecycle({ ...firstInput.scope, opportunityId: firstInput.opportunityId }, { store: conflictingHarness.adapter() });
  assert.equal(conflictingRead.record.records.filter(item => item.artifactKind === "accepted_snapshot").length, 1);
  assert.equal(conflictingRead.record.conflicts.length, 1);
});

test("same idempotency key with different canonical content appends conflict without overwrite", async () => {
  const h = harness();
  const { input, result } = await accepted(h, "1301");
  const originalBytes = h.data.get(result.keys.artifact).value;
  const conflicting = clone(input);
  conflicting.candidates[0].eligibility.reasonCodes.push("new_source_reason");
  await assert.rejects(() => captureRouteIqProspectiveOpportunitySnapshot(conflicting, {
    store: h.adapter(),
    serverContext: trusted("2026-07-13T13:00:05.000Z", { cutoff: "2026-07-13T13:00:05.000Z" })
  }), error => {
    assert.equal(error instanceof RouteIqProspectiveConflictError, true);
    assert.equal(error.conflict.overwritePerformed, false);
    assert.equal(error.conflict.resolution, "original_preserved_incoming_rejected");
    return true;
  });
  assert.equal(h.data.get(result.keys.artifact).value, originalBytes);
  const read = await readRouteIqProspectiveLifecycle({ ...input.scope, opportunityId: input.opportunityId }, { store: h.adapter() });
  assert.equal(read.record.records.length, 1);
  assert.equal(read.record.conflicts.length, 1);
  assert.equal(read.record.acceptedSnapshot.recordSha256, result.artifact.recordSha256);
});

test("privacy allowlist rejects sensitive and client-authoritative fields without storing rejected values", async t => {
  const cases = [
    ["email", "private.person@example.com"],
    ["rawNotes", "private raw note"],
    ["audioRecording", "private audio bytes"],
    ["latitude", 29.7604],
    ["authoritativeTimestamp", "2040-01-01T00:00:00.000Z"],
    ["candidateSetSha256", "0".repeat(64)],
    ["readiness", "READY"],
    ["engineVersion", "client-engine-v1"],
    ["decisionSource", { sourceId: "route_iq_recommendation" }]
  ];
  for (const [index, [field, secret]] of cases.entries()) {
    await t.test(field, async () => {
      const h = harness();
      const input = snapshot(String(1400 + index));
      input[field] = secret;
      await assert.rejects(() => captureRouteIqProspectiveOpportunitySnapshot(input, {
        store: h.adapter(),
        serverContext: trusted("2026-07-13T13:00:00.000Z", { cutoff: "2026-07-13T13:00:00.000Z" })
      }), error => {
        assert.ok(error.exclusion);
        assert.equal(error.exclusion.canonicalEvidenceEligible, false);
        assert.equal(error.exclusion.mayBePromotedLater, false);
        return true;
      });
      const stored = [...h.data.values()].map(item => item.value).join("\n");
      if (typeof secret === "string" && secret.length < 64) assert.equal(stored.includes(secret), false);
      assert.equal(h.data.size, 2);
    });
  }
});

test("scope contamination and unregistered representatives fail before cross-scope writes", async () => {
  for (const scopeOverride of [
    { workspaceId: "smoothie_depot" },
    { workspaceId: "unknown_workspace" },
    { operatingProfileId: "franchise_development" },
    { representativeId: "external_person" }
  ]) {
    const h = harness();
    const input = snapshot("1501", { scope: scope("1501", scopeOverride) });
    await assert.rejects(() => captureRouteIqProspectiveOpportunitySnapshot(input, {
      store: h.adapter(),
      serverContext: trusted("2026-07-13T13:00:00.000Z", { cutoff: "2026-07-13T13:00:00.000Z" })
    }));
    assert.equal(h.data.size, 0);
  }

  const h = harness();
  const crossField = snapshot("1502");
  crossField.scope.otherWorkspaceId = "smoothie_depot";
  await assert.rejects(() => captureRouteIqProspectiveOpportunitySnapshot(crossField, {
    store: h.adapter(),
    serverContext: trusted("2026-07-13T13:00:00.000Z", { cutoff: "2026-07-13T13:00:00.000Z" })
  }));
  assert.equal([...h.data.values()].some(item => item.value.includes("smoothie_depot")), false);
});

test("concurrent identical invalid submissions preserve one immutable governed exclusion", async () => {
  const h = harness();
  const input = snapshot("1551");
  input.rawNotes = "private concurrent note";
  const settled = await Promise.allSettled([
    captureRouteIqProspectiveOpportunitySnapshot(clone(input), {
      store: h.adapter(),
      serverContext: trusted("2026-07-13T13:00:00.000Z", { cutoff: "2026-07-13T13:00:00.000Z" })
    }),
    captureRouteIqProspectiveOpportunitySnapshot(clone(input), {
      store: h.adapter(),
      serverContext: trusted("2026-07-13T13:00:01.000Z", { cutoff: "2026-07-13T13:00:01.000Z" })
    })
  ]);
  assert.deepEqual(settled.map(item => item.status), ["rejected", "rejected"]);
  assert.equal(h.data.size, 2);
  assert.equal([...h.data.values()].some(item => item.value.includes("private concurrent note")), false);
  const read = await readRouteIqProspectiveLifecycle({ ...input.scope, opportunityId: input.opportunityId }, { store: h.adapter() });
  assert.equal(read.record.exclusions.length, 1);
  assert.equal(read.record.exclusions[0].appendOnly, true);
});

test("synthetic, test, demo, fixture, historical, and backfill origins are permanent noncanonical exclusions", async () => {
  for (const [index, origin] of ["synthetic", "test", "demo", "fixture", "historical", "backfill"].entries()) {
    const h = harness();
    const suffix = String(1600 + index);
    const input = snapshot(suffix, { recordOrigin: origin });
    await assert.rejects(() => captureRouteIqProspectiveOpportunitySnapshot(input, {
      store: h.adapter(),
      serverContext: trusted("2026-07-13T13:00:00.000Z", { cutoff: "2026-07-13T13:00:00.000Z" })
    }), error => error.exclusion?.reasonCodes.includes("noncanonical_record_origin"));
    const read = await readRouteIqProspectiveLifecycle({ ...input.scope, opportunityId: input.opportunityId }, { store: h.adapter() });
    assert.equal(read.record.acceptedSnapshot, null);
    assert.equal(read.record.exclusions[0].mayBePromotedLater, false);
    const promoted = clone(input);
    promoted.recordOrigin = "prospective";
    await assert.rejects(() => captureRouteIqProspectiveOpportunitySnapshot(promoted, {
      store: h.adapter(),
      serverContext: trusted("2026-07-13T13:01:00.000Z", { cutoff: "2026-07-13T13:01:00.000Z" })
    }), error => error.code === "route_iq_idempotency_permanently_excluded");
  }
});

test("partial persistence recovers after restart while poison bytes append exclusion and never overwrite", async () => {
  const recover = harness();
  const recoverInput = snapshot("1701");
  recover.binding.failNextRecordCommit();
  await assert.rejects(() => captureRouteIqProspectiveOpportunitySnapshot(recoverInput, {
    store: recover.adapter(),
    serverContext: trusted("2026-07-13T13:00:00.000Z", { cutoff: "2026-07-13T13:00:00.000Z" })
  }), /simulated_commit_network_failure/);
  assert.equal(recover.data.size, 1);
  const recovered = await captureRouteIqProspectiveOpportunitySnapshot(clone(recoverInput), {
    store: recover.adapter(),
    serverContext: trusted("2026-07-13T13:00:10.000Z", { cutoff: "2026-07-13T13:00:10.000Z" })
  });
  assert.equal(recovered.recoveredPartial, true);
  assert.equal(recovered.artifact.capturedAt, "2026-07-13T13:00:00.000Z");
  assert.equal(recover.data.size, 2);

  const poison = harness();
  const poisonInput = snapshot("1702");
  poison.binding.failNextRecordCommit();
  await assert.rejects(() => captureRouteIqProspectiveOpportunitySnapshot(poisonInput, {
    store: poison.adapter(),
    serverContext: trusted("2026-07-13T13:00:00.000Z", { cutoff: "2026-07-13T13:00:00.000Z" })
  }));
  const partialKey = [...poison.data.keys()][0];
  poison.data.get(partialKey).value = "{poison";
  await assert.rejects(() => captureRouteIqProspectiveOpportunitySnapshot(clone(poisonInput), {
    store: poison.adapter(),
    serverContext: trusted("2026-07-13T13:00:10.000Z", { cutoff: "2026-07-13T13:00:10.000Z" })
  }), error => {
    assert.equal(error.code, "route_iq_prospective_poison_record");
    assert.ok(error.exclusion);
    return true;
  });
  assert.equal(poison.data.get(partialKey).value, "{poison");
  const read = await readRouteIqProspectiveLifecycle({ ...poisonInput.scope, opportunityId: poisonInput.opportunityId }, { store: poison.adapter() });
  assert.equal(read.record.acceptedSnapshot, null);
  assert.equal(read.record.exclusions[0].reasonCodes.includes("poison_record"), true);
});

test("valid action requires a matching prior seal and Decision Source remains post-action non-scoreable context", async () => {
  const h = harness();
  const { input, result, receipt } = await accepted(h, "1801");
  const actionInput = action(input, "1801", { decisionSource: { sourceId: "route_iq_recommendation" } });
  const actionResult = await appendRouteIqProspectiveAction(actionInput, {
    store: h.adapter(),
    serverContext: trusted("2026-07-13T13:00:02.000Z", { receipt })
  });
  assert.equal(actionResult.artifact.snapshotRecordSha256, result.artifact.recordSha256);
  assert.equal(actionResult.artifact.sealReceipt.receiptSha256, receipt.receiptSha256);
  assert.deepEqual(actionResult.artifact.decisionSource, {
    sourceId: "route_iq_recommendation",
    capturedAt: "2026-07-13T13:00:02.000Z",
    temporalClassification: "post_action_observation",
    provesSealing: false,
    scoreable: false,
    sampleSupport: false
  });
  for (const forbidden of ["rank", "probability", "readiness", "engineVersion"]) {
    assert.equal(Object.hasOwn(actionResult.artifact, forbidden), false);
  }
});

test("action chronology, receipt, offline sync, and invalid time cases become permanent exclusions", async t => {
  const cases = [
    {
      name: "before snapshot",
      at: "2026-07-13T12:59:59.000Z",
      receiptAt: "2026-07-13T13:00:01.000Z",
      expected: "action_not_strictly_after_snapshot"
    },
    {
      name: "equal snapshot",
      at: "2026-07-13T13:00:00.000Z",
      receiptAt: "2026-07-13T13:00:01.000Z",
      expected: "action_not_strictly_after_snapshot"
    },
    {
      name: "after snapshot before later seal",
      at: "2026-07-13T13:00:01.000Z",
      receiptAt: "2026-07-13T13:00:02.000Z",
      expected: "action_not_strictly_after_seal"
    },
    {
      name: "equal seal",
      at: "2026-07-13T13:00:01.000Z",
      receiptAt: "2026-07-13T13:00:01.000Z",
      expected: "action_not_strictly_after_seal"
    }
  ];
  for (const [index, item] of cases.entries()) {
    await t.test(item.name, async () => {
      const h = harness();
      const acceptedRecord = await accepted(h, String(1810 + index));
      const actionInput = action(acceptedRecord.input, String(1810 + index));
      await assert.rejects(() => appendRouteIqProspectiveAction(actionInput, {
        store: h.adapter(),
        serverContext: trusted(item.at, { receipt: sealReceipt(acceptedRecord.result.artifact, item.receiptAt) })
      }), error => error.exclusion?.reasonCodes.includes(item.expected));
    });
  }

  await t.test("missing receipt", async () => {
    const h = harness();
    const record = await accepted(h, "1820");
    await assert.rejects(() => appendRouteIqProspectiveAction(action(record.input, "1820"), {
      store: h.adapter(), serverContext: trusted("2026-07-13T13:00:02.000Z")
    }), error => error.exclusion?.reasonCodes.includes("seal_receipt_missing"));
  });

  await t.test("tampered receipt", async () => {
    const h = harness();
    const record = await accepted(h, "1821");
    const receipt = sealReceipt(record.result.artifact);
    receipt.candidateSetSha256 = "f".repeat(64);
    await assert.rejects(() => appendRouteIqProspectiveAction(action(record.input, "1821"), {
      store: h.adapter(), serverContext: trusted("2026-07-13T13:00:02.000Z", { receipt })
    }), error => error.exclusion?.reasonCodes.includes("seal_receipt_missing_or_tampered"));
  });

  for (const [index, syncMode] of ["offline", "late"].entries()) {
    await t.test(`${syncMode} sync`, async () => {
      const h = harness();
      const record = await accepted(h, String(1822 + index));
      const actionInput = action(record.input, String(1822 + index));
      actionInput.client.syncMode = syncMode;
      await assert.rejects(() => appendRouteIqProspectiveAction(actionInput, {
        store: h.adapter(),
        serverContext: trusted("2026-07-13T13:00:02.000Z", { receipt: record.receipt })
      }), error => error.exclusion?.reasonCodes.includes("offline_or_late_sync_unverifiable"));
    });
  }

  await t.test("invalid client time", async () => {
    const h = harness();
    const record = await accepted(h, "1824");
    const actionInput = action(record.input, "1824");
    actionInput.client.observedAt = "not-a-time";
    await assert.rejects(() => appendRouteIqProspectiveAction(actionInput, {
      store: h.adapter(), serverContext: trusted("2026-07-13T13:00:02.000Z", { receipt: record.receipt })
    }), error => error.exclusion?.reasonCodes.some(reason => reason.includes("timestamp_invalid")));
  });
});

test("action without accepted snapshot and client-supplied receipt fields fail closed as exclusions", async () => {
  const h = harness();
  const input = snapshot("1901");
  const actionInput = action(input, "1901");
  await assert.rejects(() => appendRouteIqProspectiveAction(actionInput, {
    store: h.adapter(), serverContext: trusted("2026-07-13T13:00:02.000Z")
  }), error => error.exclusion?.reasonCodes.includes("accepted_snapshot_missing"));

  const h2 = harness();
  const record = await accepted(h2, "1902");
  const forged = action(record.input, "1902");
  forged.sealReceipt = record.receipt;
  await assert.rejects(() => appendRouteIqProspectiveAction(forged, {
    store: h2.adapter(), serverContext: trusted("2026-07-13T13:00:02.000Z", { receipt: record.receipt })
  }), error => error.code === "route_iq_client_authority_field_prohibited" && Boolean(error.exclusion));
});

test("outcomes require strict action chronology and unchanged candidate context", async () => {
  const h = harness();
  const record = await accepted(h, "2001");
  const actionInput = action(record.input, "2001");
  const actionResult = await appendRouteIqProspectiveAction(actionInput, {
    store: h.adapter(), serverContext: trusted("2026-07-13T13:00:02.000Z", { receipt: record.receipt })
  });

  await assert.rejects(() => appendRouteIqProspectiveOutcome(outcome(record.input, actionInput, "2002"), {
    store: h.adapter(), serverContext: trusted("2026-07-13T13:00:02.000Z")
  }), error => error.exclusion?.reasonCodes.includes("outcome_not_strictly_after_action"));

  const changed = outcome(record.input, actionInput, "2003", { evaluatedCandidateId: record.input.candidates[1].candidateId });
  await assert.rejects(() => appendRouteIqProspectiveOutcome(changed, {
    store: h.adapter(), serverContext: trusted("2026-07-13T13:00:03.000Z")
  }), error => error.exclusion?.reasonCodes.includes("candidate_context_missing_or_changed"));

  const validInput = outcome(record.input, actionInput, "2004");
  const valid = await appendRouteIqProspectiveOutcome(validInput, {
    store: h.adapter(), serverContext: trusted("2026-07-13T13:00:03.000Z")
  });
  assert.equal(valid.artifact.actionId, actionResult.artifact.artifactId);
  assert.deepEqual(valid.artifact.observedOutcome, { status: "observed", value: true });

  const secondRoot = outcome(record.input, actionInput, "2005", { observedOutcome: { status: "missing", value: null } });
  await assert.rejects(() => appendRouteIqProspectiveOutcome(secondRoot, {
    store: h.adapter(), serverContext: trusted("2026-07-13T13:00:04.000Z")
  }), error => error.exclusion?.reasonCodes.includes("second_root_outcome"));

  const missingHarness = harness();
  const missingRecord = await accepted(missingHarness, "2006");
  const missingAction = action(missingRecord.input, "2006");
  await appendRouteIqProspectiveAction(missingAction, {
    store: missingHarness.adapter(),
    serverContext: trusted("2026-07-13T13:00:02.000Z", { receipt: missingRecord.receipt })
  });
  const missingInput = outcome(missingRecord.input, missingAction, "2006", { observedOutcome: { status: "missing", value: null } });
  const missing = await appendRouteIqProspectiveOutcome(missingInput, {
    store: missingHarness.adapter(), serverContext: trusted("2026-07-13T13:00:03.000Z")
  });
  assert.deepEqual(missing.artifact.observedOutcome, { status: "missing", value: null });
});

test("outcome before any action is excluded and cannot be promoted with the same identity", async () => {
  const h = harness();
  const record = await accepted(h, "2101");
  const actionInput = action(record.input, "2101");
  const outcomeInput = outcome(record.input, actionInput, "2101");
  await assert.rejects(() => appendRouteIqProspectiveOutcome(outcomeInput, {
    store: h.adapter(), serverContext: trusted("2026-07-13T13:00:01.000Z")
  }), error => error.exclusion?.reasonCodes.includes("action_or_candidate_context_missing"));
  await appendRouteIqProspectiveAction(actionInput, {
    store: h.adapter(), serverContext: trusted("2026-07-13T13:00:02.000Z", { receipt: record.receipt })
  });
  await assert.rejects(() => appendRouteIqProspectiveOutcome(outcomeInput, {
    store: h.adapter(), serverContext: trusted("2026-07-13T13:00:03.000Z")
  }), error => error.code === "route_iq_idempotency_permanently_excluded");
});

test("corrections append to outcomes, preserve history, and cannot repair missing or excluded evidence", async () => {
  const h = harness();
  const record = await accepted(h, "2201");
  const actionInput = action(record.input, "2201");
  await appendRouteIqProspectiveAction(actionInput, {
    store: h.adapter(), serverContext: trusted("2026-07-13T13:00:02.000Z", { receipt: record.receipt })
  });
  const outcomeInput = outcome(record.input, actionInput, "2201");
  const outcomeResult = await appendRouteIqProspectiveOutcome(outcomeInput, {
    store: h.adapter(), serverContext: trusted("2026-07-13T13:00:03.000Z")
  });
  const correctionInput = {
    schemaVersion: routeIqProspectiveCorrectionSchemaVersion,
    opportunityId: record.input.opportunityId,
    idempotencyKey: "correction_idempotency_2201",
    correctionId: "correction_record_00002201",
    targetRecordId: outcomeResult.artifact.artifactId,
    targetKind: "outcome",
    scope: clone(record.input.scope),
    recordOrigin: "prospective",
    reasonCode: "verified_outcome_correction",
    replacement: {
      evaluatedCandidateId: outcomeResult.artifact.evaluatedCandidateId,
      observedOutcome: { status: "observed", value: false }
    },
    client: { sequence: 13, observedAt: "2026-07-13T13:00:03.500Z", syncMode: "online" }
  };
  const correction = await appendRouteIqProspectiveCorrection(correctionInput, {
    store: h.adapter(), serverContext: trusted("2026-07-13T13:00:04.000Z")
  });
  assert.equal(correction.artifact.priorRecordPreserved, true);
  assert.equal(correction.artifact.targetRecordId, outcomeResult.artifact.artifactId);
  const read = await readRouteIqProspectiveLifecycle({ ...record.input.scope, opportunityId: record.input.opportunityId }, { store: h.adapter() });
  assert.deepEqual(read.record.records.map(item => item.artifactKind), ["accepted_snapshot", "action", "outcome", "correction"]);
  assert.deepEqual(read.record.records.find(item => item.artifactKind === "outcome").observedOutcome, { status: "observed", value: true });

  const nextCorrection = clone(correctionInput);
  nextCorrection.idempotencyKey = "correction_idempotency_2204";
  nextCorrection.correctionId = "correction_record_00002204";
  nextCorrection.targetKind = "correction";
  nextCorrection.targetRecordId = correction.artifact.artifactId;
  nextCorrection.replacement.observedOutcome.value = true;
  const appendedCorrection = await appendRouteIqProspectiveCorrection(nextCorrection, {
    store: h.adapter(), serverContext: trusted("2026-07-13T13:00:05.000Z")
  });
  assert.equal(appendedCorrection.artifact.targetKind, "correction");
  assert.equal(appendedCorrection.artifact.targetRecordId, correction.artifact.artifactId);

  const fork = clone(correctionInput);
  fork.idempotencyKey = "correction_idempotency_2203";
  fork.correctionId = "correction_record_00002203";
  await assert.rejects(() => appendRouteIqProspectiveCorrection(fork, {
    store: h.adapter(), serverContext: trusted("2026-07-13T13:00:06.000Z")
  }), error => error.exclusion?.reasonCodes.includes("correction_chain_fork"));

  const missingTarget = clone(correctionInput);
  missingTarget.idempotencyKey = "correction_idempotency_2202";
  missingTarget.correctionId = "correction_record_00002202";
  missingTarget.targetRecordId = "outcome_record_missing_2202";
  await assert.rejects(() => appendRouteIqProspectiveCorrection(missingTarget, {
    store: h.adapter(), serverContext: trusted("2026-07-13T13:00:07.000Z")
  }), error => error.exclusion?.reasonCodes.includes("correction_target_missing_or_excluded"));
});

test("late retries with a changed idempotency key cannot create second action or outcome roots", async () => {
  const h = harness();
  const record = await accepted(h, "2301");
  const actionInput = action(record.input, "2301");
  await appendRouteIqProspectiveAction(actionInput, {
    store: h.adapter(), serverContext: trusted("2026-07-13T13:00:02.000Z", { receipt: record.receipt })
  });
  const lateAction = clone(actionInput);
  lateAction.idempotencyKey = "action_late_retry_key_2301";
  await assert.rejects(() => appendRouteIqProspectiveAction(lateAction, {
    store: h.adapter(), serverContext: trusted("2026-07-13T13:00:03.000Z", { receipt: record.receipt })
  }), error => error.exclusion?.reasonCodes.includes("late_retry_identity_mismatch"));
  const secondAction = clone(actionInput);
  secondAction.idempotencyKey = "action_second_root_key_2301";
  secondAction.actionId = "action_record_second_2301";
  await assert.rejects(() => appendRouteIqProspectiveAction(secondAction, {
    store: h.adapter(), serverContext: trusted("2026-07-13T13:00:03.500Z", { receipt: record.receipt })
  }), error => error.exclusion?.reasonCodes.includes("second_root_action"));

  const outcomeInput = outcome(record.input, actionInput, "2301");
  await appendRouteIqProspectiveOutcome(outcomeInput, {
    store: h.adapter(), serverContext: trusted("2026-07-13T13:00:04.000Z")
  });
  const lateOutcome = clone(outcomeInput);
  lateOutcome.idempotencyKey = "outcome_late_retry_key_2301";
  await assert.rejects(() => appendRouteIqProspectiveOutcome(lateOutcome, {
    store: h.adapter(), serverContext: trusted("2026-07-13T13:00:05.000Z")
  }), error => error.exclusion?.reasonCodes.includes("late_retry_identity_mismatch"));
});

test("stored artifact and commit tamper fail readback without mutation", async () => {
  const artifactTamper = harness();
  const first = await accepted(artifactTamper, "2401");
  const originalWrites = artifactTamper.writes.length;
  artifactTamper.data.get(first.result.keys.artifact).value += " ";
  await assert.rejects(() => readRouteIqProspectiveLifecycle({ ...first.input.scope, opportunityId: first.input.opportunityId }, { store: artifactTamper.adapter() }), error => error.code === "route_iq_prospective_artifact_bytes_tampered");
  assert.equal(artifactTamper.writes.length, originalWrites);

  const commitTamper = harness();
  const second = await accepted(commitTamper, "2402");
  const parsed = JSON.parse(commitTamper.data.get(second.result.keys.commit).value);
  parsed.status = "pending";
  commitTamper.data.get(second.result.keys.commit).value = JSON.stringify(parsed, null, 2) + "\n";
  await assert.rejects(() => readRouteIqProspectiveLifecycle({ ...second.input.scope, opportunityId: second.input.opportunityId }, { store: commitTamper.adapter() }), error => error.code === "route_iq_prospective_commit_tampered");
});

test("Workers KV prospective lifecycle is cache-only and cannot enter chronological readiness evidence", async () => {
  const h = harness();
  const record = await accepted(h, "2501");
  const lifecycle = (await readRouteIqProspectiveLifecycle({ ...record.input.scope, opportunityId: record.input.opportunityId }, { store: h.adapter() })).record;
  assert.throws(() => projectRouteIqChronologicalEvidence({
    archiveRecord: committedArchive(),
    prospectiveLifecycleRecord: lifecycle,
    decisionTimestamp: "2026-07-13T14:00:00.000Z",
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz"
  }), error => error.code === "field_session_prospective_kv_authority_superseded");
});

test("KV cache scope contamination cannot bypass superseded authority", async () => {
  const h = harness();
  const record = await accepted(h, "2601");
  const lifecycle = clone((await readRouteIqProspectiveLifecycle({ ...record.input.scope, opportunityId: record.input.opportunityId }, { store: h.adapter() })).record);
  lifecycle.scope.representativeId = "anthony";
  assert.throws(() => projectRouteIqChronologicalEvidence({
    archiveRecord: committedArchive(),
    prospectiveLifecycleRecord: lifecycle,
    decisionTimestamp: "2026-07-13T14:00:00.000Z",
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    representativeId: "cruz"
  }), error => error.code === "field_session_prospective_kv_authority_superseded");
});
