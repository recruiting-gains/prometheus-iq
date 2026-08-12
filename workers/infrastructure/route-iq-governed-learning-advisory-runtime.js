import canonicalGovernedLearningArtifact from "../../intelligence/artifacts/route-iq-governed-multi-session-learning-v1/fitness_connection/cruz/governed-learning-artifact-v1.json" with { type: "json" };

import { AEGIS_API_HEADERS } from "./aegis-security-controls.js";

export const ROUTE_IQ_GOVERNED_LEARNING_ADVISORY_PATH =
  "/api/dashboard/route-iq/intelligence/governed-learning-advisory";
export const ROUTE_IQ_GOVERNED_LEARNING_ADVISORY_RUNTIME_VERSION =
  "route-iq-governed-learning-advisory-runtime-v1";
export const ROUTE_IQ_GOVERNED_LEARNING_ADVISORY_ENVELOPE_VERSION =
  "route-iq-governed-learning-dashboard-envelope-v1";

const SHA256 = /^[a-f0-9]{64}$/u;
const SAFE_FAILURE = Object.freeze({
  ok: false,
  code: "route_iq_governed_learning_unavailable"
});
const ADVISORY_KEYS = Object.freeze([
  "contractVersion",
  "truthVocabulary",
  "evidenceMaturity",
  "categoryTimeWindowPatterns",
  "businessVisitOutcomeRelationships",
  "outcomeObservations",
  "strongestThresholdSupportedPattern",
  "weakPatterns",
  "conflictingPatterns",
  "stalePatterns",
  "unavailableEvidence",
  "unknownEvidence",
  "confidence",
  "browserLocalEstimateBoundary",
  "dataQualityWarnings",
  "lastGovernedEvidenceAt",
  "additionalEvidenceNeeded",
  "versions",
  "provenance",
  "safety"
]);
const SAFETY_KEYS = Object.freeze([
  "founderOnly",
  "representativeReadable",
  "readOnly",
  "recommendationInfluence",
  "confidencePropagation",
  "routeOrderingChanged",
  "routeScoringChanged",
  "activePoolChanged",
  "adaptiveReplenishmentChanged",
  "businessHoursEligibilityChanged"
]);
const PROHIBITED_ANALYTICS_KEY = /candidate|ranking|ranked|probabilit|brier|\bece\b|shadow|recommendationScore|secret|stressTest/iu;
const PROHIBITED_PII_KEYS = new Set([
  "address",
  "contact",
  "contacts",
  "email",
  "gps",
  "gpsattached",
  "latitude",
  "longitude",
  "notes",
  "phone"
]);

function response(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...AEGIS_API_HEADERS,
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

function deny(status = 404, headers = {}) {
  return response(SAFE_FAILURE, status, headers);
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length
    && actual.every((key, index) => key === wanted[index]);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson(value))
  );
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hasProhibitedKey(value) {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => (
    PROHIBITED_ANALYTICS_KEY.test(key)
      || PROHIBITED_PII_KEYS.has(key.toLowerCase())
      || hasProhibitedKey(child)
  ));
}

function validFounderPrincipal(principal) {
  return principal?.identityContextSource === "server_verified_identity_mapping"
    && principal?.authenticationAuthority === "cloudflare_access"
    && principal?.authenticated === true
    && principal?.callerSupplied === false
    && principal?.role === "founder"
    && principal?.mappingId === "route-iq-founder-access-cruz-v1"
    && principal?.mappingStatus === "securely_mapped";
}

function validRequest(request) {
  const url = new URL(request.url);
  return url.pathname === ROUTE_IQ_GOVERNED_LEARNING_ADVISORY_PATH
    && url.search === ""
    && request.method === "GET"
    && request.body === null
    && !request.headers.has("transfer-encoding")
    && !request.headers.has("content-encoding")
    && ["0", null].includes(request.headers.get("content-length"));
}

function sanitizedAdvisory(source) {
  if (!exactKeys(source, [...ADVISORY_KEYS])) {
    throw new Error("route_iq_governed_learning_advisory_shape_invalid");
  }
  const copy = structuredClone(source);
  copy.safety = Object.fromEntries(SAFETY_KEYS.map(key => [key, source.safety?.[key]]));
  if (!exactKeys(copy.safety, [...SAFETY_KEYS]) || hasProhibitedKey(copy)) {
    throw new Error("route_iq_governed_learning_advisory_output_invalid");
  }
  return copy;
}

export async function validateRouteIqGovernedLearningArtifact(
  artifact = canonicalGovernedLearningArtifact,
  { workspace, now = new Date() } = {}
) {
  if (artifact?.schemaVersion !== "route-iq-governed-multi-session-learning-v1"
    || artifact?.status !== "SOURCE_COMPLETE_UNDEPLOYED"
    || artifact?.workspaceId !== "fitness_connection"
    || artifact?.customerId !== "fitness_connection_research"
    || artifact?.operatingProfileId !== "fitness"
    || artifact?.representativeId !== "cruz"
    || artifact?.evidenceClassification !== "FOUNDER_FIELD_RESEARCH"
    || workspace?.workspaceId !== artifact.workspaceId
    || workspace?.operatingProfileId !== artifact.operatingProfileId
    || !SHA256.test(artifact?.artifactSha256 || "")
    || artifact?.artifactId !== `riq_governed_learning_${artifact.artifactSha256}`
    || artifact?.eligibleSessionManifest?.manifestId
      !== `riq_eligible_sessions_${artifact?.eligibleSessionManifest?.manifestSha256}`
    || !SHA256.test(artifact?.eligibleSessionManifest?.manifestSha256 || "")
    || artifact?.eligibleSessionManifest?.customerId !== artifact.customerId
    || artifact?.eligibleSessionManifest?.workspaceId !== artifact.workspaceId
    || artifact?.eligibleSessionManifest?.operatingProfileId !== artifact.operatingProfileId
    || artifact?.eligibleSessionManifest?.representativeId !== artifact.representativeId
    || artifact?.eligibleSessionManifest?.totals?.sessions < 1
    || artifact?.eligibleSessionManifest?.totals?.visits < 1
    || artifact?.eligibleSessionManifest?.entries?.some(entry => (
      entry.workspaceId !== artifact.workspaceId
        || entry.customerId !== artifact.customerId
        || entry.operatingProfileId !== artifact.operatingProfileId
        || entry.representativeId !== artifact.representativeId
        || entry.retention?.legalHoldState !== "NONE"
        || entry.retention?.deletionState !== "NONE"
        || !Number.isFinite(Date.parse(entry.retention?.expiresAt))
        || Date.parse(entry.retention.expiresAt) <= now.getTime()
    ))
    || artifact?.dashboardAdvisory?.provenance?.workspaceId !== artifact.workspaceId
    || artifact?.dashboardAdvisory?.provenance?.customerId !== artifact.customerId
    || artifact?.dashboardAdvisory?.provenance?.operatingProfileId !== artifact.operatingProfileId
    || artifact?.dashboardAdvisory?.provenance?.representativeId !== artifact.representativeId
    || artifact?.dashboardAdvisory?.provenance?.manifestSha256
      !== artifact.eligibleSessionManifest.manifestSha256
    || artifact?.safety?.recommendationInfluence !== "OFF"
    || artifact?.safety?.confidencePropagation !== "OFF"
    || artifact?.safety?.routeOrderingChanged !== false
    || artifact?.safety?.routeScoringChanged !== false
    || artifact?.safety?.activePoolChanged !== false
    || artifact?.safety?.adaptiveReplenishmentChanged !== false
    || artifact?.safety?.businessHoursEligibilityChanged !== false
    || artifact?.safety?.sourceArchiveMutationPerformed !== false
    || artifact?.safety?.productionRuntimeActivated !== false) {
    throw new Error("route_iq_governed_learning_artifact_invalid");
  }
  const body = Object.fromEntries(
    Object.entries(artifact).filter(([key]) => !["artifactId", "artifactSha256"].includes(key))
  );
  if (await sha256(body) !== artifact.artifactSha256) {
    throw new Error("route_iq_governed_learning_artifact_hash_invalid");
  }
  const expiresAt = artifact.eligibleSessionManifest.entries
    .map(entry => entry.retention.expiresAt)
    .sort()[0];
  return Object.freeze({
    artifact: structuredClone(artifact),
    expiresAt,
    advisory: sanitizedAdvisory(artifact.dashboardAdvisory)
  });
}

export function isRouteIqGovernedLearningAdvisoryPath(pathname) {
  return pathname === ROUTE_IQ_GOVERNED_LEARNING_ADVISORY_PATH;
}

export async function handleRouteIqGovernedLearningAdvisoryRequest(
  request,
  { founderPrincipal, workspace, artifact = canonicalGovernedLearningArtifact, now = new Date() } = {}
) {
  if (!validFounderPrincipal(founderPrincipal)) return deny();
  if (new URL(request.url).pathname !== ROUTE_IQ_GOVERNED_LEARNING_ADVISORY_PATH) return deny();
  if (request.method !== "GET") return deny(405, { Allow: "GET" });
  if (!validRequest(request)) return deny();
  try {
    const validated = await validateRouteIqGovernedLearningArtifact(artifact, { workspace, now });
    return response({
      contractVersion: ROUTE_IQ_GOVERNED_LEARNING_ADVISORY_ENVELOPE_VERSION,
      authorizationState: "server_verified",
      principal: {
        identityContextSource: founderPrincipal.identityContextSource,
        authenticationAuthority: founderPrincipal.authenticationAuthority,
        authenticated: true,
        callerSupplied: false,
        role: "founder"
      },
      scope: {
        workspaceId: validated.artifact.workspaceId,
        operatingProfileId: validated.artifact.operatingProfileId,
        customerId: validated.artifact.customerId,
        representativeId: validated.artifact.representativeId,
        authority: "server_resolved"
      },
      artifact: {
        artifactId: validated.artifact.artifactId,
        artifactSha256: validated.artifact.artifactSha256,
        generatedAt: validated.artifact.generatedAt,
        status: validated.artifact.status,
        freshnessState: "CURRENT_WITHIN_RETENTION_BOUNDARY",
        expiresAt: validated.expiresAt
      },
      advisory: validated.advisory
    });
  } catch {
    return deny(503);
  }
}
