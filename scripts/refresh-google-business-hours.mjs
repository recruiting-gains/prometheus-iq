import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_BUSINESS_HOURS_POLICY,
  assertBusinessHoursWorkspace,
  normalizeGoogleBusinessHours,
  preserveBusinessHoursAfterRefreshFailure,
  readBusinessHoursArtifact,
  recalculateBusinessHoursArtifact,
  validateBusinessHoursArtifact,
  writeBusinessHoursArtifactAtomic
} from "./lib/business-hours-governance.mjs";

const DATASET_ROOT = "data/qualified-prospects/google-qualified-businesses-v2";
const BUSINESS_HOURS_ROOT = path.join(DATASET_ROOT, "business-hours-v1");
const DEFAULT_SOURCE = path.join(DATASET_ROOT, "google-qualified-businesses-v2.json");
const DEFAULT_ACTIVE_POOL = path.join(DATASET_ROOT, "runtime-pool-segmentation-v1/active-pool.json");
const DEFAULT_EVIDENCE = path.join(BUSINESS_HOURS_ROOT, "founder-field-evidence.json");
const DEFAULT_OUTPUT = path.join(BUSINESS_HOURS_ROOT, "business-hours.json");
const DEFAULT_REPORT = path.join(BUSINESS_HOURS_ROOT, "business-hours-refresh-report.json");
const PLACES_DETAILS_ENDPOINT = "https://places.googleapis.com/v1/places";
const REPORTED_PLACE_ID = "ChIJiduac7LCQIYR-sGBtIAjKR0";

export const GOOGLE_BUSINESS_HOURS_FIELD_MASK = Object.freeze([
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "businessStatus",
  "timeZone",
  "regularOpeningHours",
  "currentOpeningHours"
]);

function readArg(name, fallback = "") {
  const match = process.argv.slice(2).find(argument => argument.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(value, null, 2) + "\n");
  fs.renameSync(temporaryPath, filePath);
}

function providerError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function resolveGoogleBusinessHoursApiKey(environment = process.env) {
  const apiKey = environment.GOOGLE_MAPS_API_KEY || environment.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw providerError(
      "business_hours_provider_binding_missing",
      "GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY is required for the offline business-hours refresh."
    );
  }
  return apiKey;
}

function retryableStatus(status) {
  return status === 429 || status >= 500;
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export async function fetchGoogleBusinessHoursPlace({ apiKey, placeId, fetchImpl = fetch, attempts = 3 }) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(`${PLACES_DETAILS_ENDPOINT}/${encodeURIComponent(placeId)}`, {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": GOOGLE_BUSINESS_HOURS_FIELD_MASK.join(",")
        }
      });
    } catch (error) {
      if (attempt < attempts) {
        await wait(250 * (2 ** (attempt - 1)));
        continue;
      }
      throw providerError("business_hours_provider_network_error", `Google Places hours request failed: ${error.message}`);
    }

    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    if (response.ok) return body;
    if (attempt < attempts && retryableStatus(response.status)) {
      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      await wait(Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 250 * (2 ** (attempt - 1)));
      continue;
    }
    throw providerError(
      `business_hours_provider_http_${response.status}`,
      `Google Places hours request failed with HTTP ${response.status}: ${body.error?.message || "provider error"}`
    );
  }
  throw providerError("business_hours_provider_exhausted", "Google Places hours request exhausted all attempts.");
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, runWorker));
  return results;
}

function normalizedIdentity(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function validateBusinessHoursFieldEvidence(evidencePayload, candidates, workspaceId) {
  if (!evidencePayload) return [];
  if (evidencePayload.workspaceId !== workspaceId) {
    throw providerError("business_hours_evidence_workspace_mismatch", "Business-hours field evidence workspace does not match the refresh workspace.");
  }
  const candidateByPlaceId = new Map(candidates.map(candidate => [candidate.google_place_id, candidate]));
  for (const evidence of evidencePayload.evidence || []) {
    if (evidence.workspaceId !== workspaceId) {
      throw providerError("business_hours_evidence_workspace_mismatch", `Field evidence ${evidence.evidenceId} crosses workspace boundaries.`);
    }
    const candidate = candidateByPlaceId.get(evidence.googlePlaceId);
    if (!candidate) {
      throw providerError("business_hours_evidence_place_id_unverified", `Field evidence ${evidence.evidenceId} does not reference a verified production Place ID.`);
    }
    if (normalizedIdentity(candidate.business_name) !== normalizedIdentity(evidence.businessName) ||
      normalizedIdentity(candidate.full_address) !== normalizedIdentity(evidence.address)) {
      throw providerError("business_hours_evidence_identity_mismatch", `Field evidence ${evidence.evidenceId} does not match the verified business identity.`);
    }
  }
  return evidencePayload.evidence || [];
}

function countBy(records, selector) {
  return records.reduce((counts, record) => {
    const key = selector(record) || "UNKNOWN";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function buildRefreshReport({ artifact, failures, sourcePath, outputPath, previousArtifact }) {
  const reportedRecord = artifact.records.find(record => record.googlePlaceId === REPORTED_PLACE_ID) || null;
  return {
    generatedAt: artifact.generatedAt,
    reportVersion: "business-hours-refresh-report-v1",
    status: failures.length ? "completed_with_provider_failures" : "passed",
    workspaceId: artifact.workspaceId,
    operatingProfileId: artifact.operatingProfileId,
    sourceDatasetVersion: artifact.sourceDatasetVersion,
    sourcePath,
    outputPath,
    enrichmentMethod: "offline-scheduled-google-places-details",
    providerAccess: "available",
    providerFieldMask: GOOGLE_BUSINESS_HOURS_FIELD_MASK,
    previousArtifactAvailable: Boolean(previousArtifact),
    routeEligibilityActivated: false,
    runtimeBehaviorChanged: false,
    scoringChanged: false,
    counts: {
      sourceCandidates: artifact.sourceCandidateCount,
      records: artifact.recordCount,
      refreshSucceeded: artifact.records.filter(record => record.lastSuccessfulRefreshAt === artifact.sourceRetrievedAt).length,
      refreshFailed: failures.length,
      regularHoursAvailable: artifact.records.filter(record => record.regularWeeklyBusinessHours !== null).length,
      currentHoursAvailable: artifact.records.filter(record => record.currentOpeningHoursWindow !== null).length,
      missingHours: artifact.records.filter(record => record.hoursFreshnessStatus === "MISSING").length,
      staleHours: artifact.records.filter(record => record.hoursFreshnessStatus === "STALE").length
    },
    statusCounts: countBy(artifact.records, record => record.currentOpenClosedEligibilityStatus),
    freshnessCounts: countBy(artifact.records, record => record.hoursFreshnessStatus),
    permanentOperationalStatusCounts: countBy(artifact.records, record => record.permanentOperationalStatus),
    failures,
    reportedBusiness: reportedRecord ? {
      googlePlaceId: reportedRecord.googlePlaceId,
      businessName: reportedRecord.businessName,
      address: reportedRecord.address,
      permanentOperationalStatus: reportedRecord.permanentOperationalStatus,
      currentOpenClosedEligibilityStatus: reportedRecord.currentOpenClosedEligibilityStatus,
      currentStatusReasonCode: reportedRecord.currentStatusReasonCode,
      businessTimezone: reportedRecord.businessTimezone,
      fieldEvidenceIds: reportedRecord.hoursProvenance.fieldEvidenceIds
    } : null,
    validation: {
      artifactFailures: validateBusinessHoursArtifact(artifact, artifact.workspaceId),
      missingValuesRemainNull: artifact.records.every(record => (
        record.regularWeeklyBusinessHours !== false &&
        record.currentOpeningHoursWindow !== false &&
        record.businessTimezone !== false
      )),
      activePoolAdmissionChanged: false,
      quarantineRulesChanged: false,
      routeScoringChanged: false,
      liveGoogleRuntimeCallAdded: false
    }
  };
}

export async function refreshBusinessHoursDataset({
  candidates,
  activePlaceIds = new Set(),
  fieldEvidence = [],
  previousArtifact = null,
  workspaceId = "fitness_connection",
  sourceDatasetVersion = "google-qualified-businesses-v2",
  sourcePath = DEFAULT_SOURCE,
  outputPath = DEFAULT_OUTPUT,
  apiKey,
  fetchPlace = fetchGoogleBusinessHoursPlace,
  retrievedAt = new Date(),
  evaluatedAt = retrievedAt,
  concurrency = 6,
  policy = DEFAULT_BUSINESS_HOURS_POLICY
}) {
  const workspace = assertBusinessHoursWorkspace(workspaceId);
  if (!apiKey) resolveGoogleBusinessHoursApiKey({});
  const retrieved = retrievedAt instanceof Date ? retrievedAt : new Date(retrievedAt);
  const evaluated = evaluatedAt instanceof Date ? evaluatedAt : new Date(evaluatedAt);
  if (Number.isNaN(retrieved.getTime()) || Number.isNaN(evaluated.getTime())) {
    throw providerError("business_hours_refresh_timestamp_invalid", "Business-hours refresh or evaluation timestamp is invalid.");
  }
  const previousByPlaceId = new Map((previousArtifact?.records || []).map(record => [record.googlePlaceId, record]));
  const evidenceByPlaceId = new Map();
  for (const evidence of fieldEvidence) {
    const values = evidenceByPlaceId.get(evidence.googlePlaceId) || [];
    values.push(evidence);
    evidenceByPlaceId.set(evidence.googlePlaceId, values);
  }
  const failures = [];
  const records = await mapWithConcurrency(candidates, Number(concurrency) || 1, async candidate => {
    try {
      const place = await fetchPlace({ apiKey, placeId: candidate.google_place_id });
      return normalizeGoogleBusinessHours({
        candidate: { ...candidate, source_dataset_version: sourceDatasetVersion },
        place,
        workspaceId,
        retrievedAt: retrieved,
        evaluatedAt: evaluated,
        activePlaceIds,
        fieldEvidence: evidenceByPlaceId.get(candidate.google_place_id) || [],
        fieldMask: GOOGLE_BUSINESS_HOURS_FIELD_MASK,
        policy
      });
    } catch (error) {
      failures.push({
        googlePlaceId: candidate.google_place_id,
        businessName: candidate.business_name,
        code: error.code || "business_hours_provider_error",
        message: String(error.message || "provider error").slice(0, 300)
      });
      return preserveBusinessHoursAfterRefreshFailure({
        candidate: { ...candidate, source_dataset_version: sourceDatasetVersion },
        previousRecord: previousByPlaceId.get(candidate.google_place_id) || null,
        workspaceId,
        failedAt: retrieved,
        evaluatedAt: evaluated,
        activePlaceIds,
        fieldEvidence: evidenceByPlaceId.get(candidate.google_place_id) || [],
        failure: error,
        policy
      });
    }
  });

  const artifact = {
    schemaVersion: "prometheus-data-business-hours-v1",
    artifactVersion: "business-hours-v1",
    projectionVersion: "route-iq-business-availability-v2",
    generatedAt: evaluated.toISOString(),
    statusEvaluatedAt: evaluated.toISOString(),
    sourceRetrievedAt: retrieved.toISOString(),
    workspaceId: workspace.workspaceId,
    operatingProfileId: workspace.operatingProfileId,
    protectedWorkspaceIds: [],
    sourceDatasetVersion,
    sourceArtifact: sourcePath,
    sourceCandidateCount: candidates.length,
    recordCount: records.length,
    refreshMode: "offline-scheduled-google-places-details",
    provider: "GOOGLE_PLACES_API_NEW",
    freshnessPolicy: {
      ...policy,
      freshnessThresholdHours: Math.min(24, Number(policy.freshnessThresholdHours || 24))
    },
    routeEligibilityActivated: false,
    runtimeBehaviorChanged: false,
    scoringChanged: false,
    records
  };
  const artifactFailures = validateBusinessHoursArtifact(artifact, workspaceId);
  if (artifactFailures.length) {
    throw providerError("business_hours_artifact_invalid", artifactFailures.join("\n"));
  }
  const report = buildRefreshReport({ artifact, failures, sourcePath, outputPath, previousArtifact });
  return { artifact, report, failures };
}

function loadRefreshInputs({ sourcePath, activePoolPath, evidencePath, workspaceId }) {
  const source = readJson(sourcePath);
  const activePool = readJson(activePoolPath);
  const candidates = source.production_candidates || [];
  const evidencePayload = fs.existsSync(evidencePath) ? readJson(evidencePath) : null;
  return {
    source,
    activePool,
    candidates,
    fieldEvidence: validateBusinessHoursFieldEvidence(evidencePayload, candidates, workspaceId)
  };
}

async function main() {
  const workspaceId = readArg("--workspace", "fitness_connection");
  const sourcePath = readArg("--source", DEFAULT_SOURCE);
  const activePoolPath = readArg("--active-pool", DEFAULT_ACTIVE_POOL);
  const evidencePath = readArg("--evidence", DEFAULT_EVIDENCE);
  const outputPath = readArg("--output", DEFAULT_OUTPUT);
  const reportPath = readArg("--report", DEFAULT_REPORT);
  const evaluatedAt = readArg("--at", "") || new Date().toISOString();
  const concurrency = Number(readArg("--concurrency", "6"));
  const writeAuthorized = hasFlag("--write");
  assertBusinessHoursWorkspace(workspaceId);

  if (hasFlag("--evaluate-only")) {
    const current = readJson(outputPath);
    const activePool = fs.existsSync(activePoolPath) ? readJson(activePoolPath) : { records: [] };
    const evaluated = recalculateBusinessHoursArtifact(current, evaluatedAt, {
      activePlaceIds: new Set((activePool.records || []).map(record => record.googlePlaceId))
    });
    if (writeAuthorized) writeBusinessHoursArtifactAtomic(outputPath, evaluated, workspaceId);
    console.log(JSON.stringify({
      status: "passed",
      mode: "offline-status-evaluation",
      writePerformed: writeAuthorized,
      workspaceId,
      recordCount: evaluated.recordCount,
      statusEvaluatedAt: evaluated.statusEvaluatedAt,
      outputPath
    }, null, 2));
    return;
  }

  const { source, activePool, candidates, fieldEvidence } = loadRefreshInputs({ sourcePath, activePoolPath, evidencePath, workspaceId });
  if (hasFlag("--dry-run") || !writeAuthorized) {
    console.log(JSON.stringify({
      status: "ready",
      mode: "dry-run",
      workspaceId,
      providerBindingRead: false,
      writePerformed: false,
      sourceDatasetVersion: source.dataset_version,
      sourceCandidateCount: candidates.length,
      activePoolCount: activePool.records?.length || 0,
      fieldEvidenceCount: fieldEvidence.length,
      outputPath,
      note: "Safe default performed no Keychain/environment lookup, provider call, or file write. Use --write for an explicitly authorized refresh."
    }, null, 2));
    return;
  }

  loadEnvFile(path.resolve(".env"));
  const apiKey = resolveGoogleBusinessHoursApiKey();
  const previousArtifact = fs.existsSync(outputPath) ? readBusinessHoursArtifact(outputPath, workspaceId) : null;
  const result = await refreshBusinessHoursDataset({
    candidates,
    activePlaceIds: new Set((activePool.records || []).map(record => record.googlePlaceId)),
    fieldEvidence,
    previousArtifact,
    workspaceId,
    sourceDatasetVersion: source.dataset_version,
    sourcePath,
    outputPath,
    apiKey,
    retrievedAt: evaluatedAt,
    evaluatedAt,
    concurrency
  });
  writeBusinessHoursArtifactAtomic(outputPath, result.artifact, workspaceId);
  writeJsonAtomic(reportPath, result.report);
  console.log(JSON.stringify({
    status: result.report.status,
    workspaceId,
    recordCount: result.artifact.recordCount,
    refreshFailures: result.failures.length,
    statusCounts: result.report.statusCounts,
    reportedBusiness: result.report.reportedBusiness,
    outputPath,
    reportPath
  }, null, 2));
  if (result.failures.length) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(`${error.code || "business_hours_refresh_failed"}: ${error.message}`);
    process.exitCode = 1;
  });
}
