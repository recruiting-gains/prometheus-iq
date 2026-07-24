import {
  projectRouteIqWorkspaceZipCoverage
} from "./route-iq-multi-company-runtime-authorization.js";

export const ROUTE_IQ_ONBOARDING_RUNTIME_VERSION = "route-iq-72-hour-onboarding-runtime-v1";
export const ROUTE_IQ_ONBOARDING_RUNTIME_ASSET_KEYS = Object.freeze([
  "workspaceConfiguration",
  "businessManifestRegistry",
  "businessRoster",
  "businessHours"
]);

const DATA_PATH = /^\/data\/[A-Za-z0-9._/-]+\.json$/u;
const ADMIN_PATH = /^\/administration\/[A-Za-z0-9._/-]+\.json$/u;

function fail() {
  throw new Error("Route IQ onboarding runtime evidence is invalid.");
}

function canonicalTime(value) {
  if (typeof value !== "string") fail();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) fail();
  return parsed;
}

function validateRuntimeAssets(runtimeAssets) {
  if (!runtimeAssets
    || Object.keys(runtimeAssets).sort().join(",") !== [...ROUTE_IQ_ONBOARDING_RUNTIME_ASSET_KEYS].sort().join(",")) {
    fail();
  }
  for (const [key, path] of Object.entries(runtimeAssets)) {
    if (typeof path !== "string"
      || path.includes("..")
      || path.includes("//")
      || (key === "workspaceConfiguration" ? !ADMIN_PATH.test(path) : !DATA_PATH.test(path))) {
      fail();
    }
  }
  return structuredClone(runtimeAssets);
}

export function buildRouteIq72HourOnboardingRuntimeEvidence({
  workspaceConfigurationRegistry,
  principal,
  runtimeAssets,
  rehearsalStartedAt,
  automatedConfigurationStartedAt,
  automatedConfigurationCompletedAt,
  evidenceGeneratedAt
}) {
  const rehearsalStart = canonicalTime(rehearsalStartedAt);
  const automatedStart = canonicalTime(automatedConfigurationStartedAt);
  const automatedEnd = canonicalTime(automatedConfigurationCompletedAt);
  const generatedAt = canonicalTime(evidenceGeneratedAt);
  if (automatedStart < rehearsalStart || automatedEnd < automatedStart || generatedAt < automatedEnd) fail();
  const zipCoverage = projectRouteIqWorkspaceZipCoverage({
    principal,
    workspaceRegistry: workspaceConfigurationRegistry
  });
  const assets = validateRuntimeAssets(runtimeAssets);
  return Object.freeze({
    schemaVersion: ROUTE_IQ_ONBOARDING_RUNTIME_VERSION,
    ownerSubsystem: "Prometheus Infrastructure",
    status: "RUNTIME_GENERATED_EXTERNAL_AND_ATTENDED_STEPS_PENDING",
    workspaceId: principal.workspaceId,
    operatingProfileId: principal.operatingProfileId,
    configurationVersion: zipCoverage.configurationVersion,
    runtimeAssets: Object.freeze(assets),
    zipCoverage,
    elapsedEvidence: Object.freeze({
      rehearsalStartedAt,
      automatedConfigurationStartedAt,
      automatedConfigurationCompletedAt,
      evidenceGeneratedAt,
      automatedConfigurationSeconds: (automatedEnd - automatedStart) / 1000,
      elapsedSinceRehearsalStartSeconds: (generatedAt - rehearsalStart) / 1000,
      maximumTargetSeconds: 72 * 60 * 60
    }),
    completedRuntimeChecks: Object.freeze([
      "CONFIGURATION_VALIDATED",
      "EXACT_WORKSPACE_PROJECTED",
      "FOUR_RUNTIME_ASSETS_BOUND",
      "ZIP_COVERAGE_PROJECTED",
      "REPRESENTATIVE_SCOPE_BOUND",
      "OFF_SWITCHES_PRESERVED"
    ]),
    remainingBoundaries: Object.freeze({
      humanInput: Object.freeze([
        "NAMED_USER_IDENTITY_CONFIRMATION",
        "TRAINING_COMPLETION",
        "SUPPORT_OWNER_CONFIRMATION",
        "INCIDENT_OWNER_CONFIRMATION"
      ]),
      externalCredentials: Object.freeze(["AVAILABILITY_PROVIDER_CREDENTIALS"]),
      availabilityVerification: Object.freeze([
        "PRODUCTION_MANIFEST_APPROVAL",
        "DATA_PRODUCER_BINDING",
        "INITIAL_FRESH_AVAILABILITY_SNAPSHOT",
        "DAILY_SCHEDULER_ACTIVATION",
        "FRESHNESS_MONITORING_CONFIRMATION",
        "ACTIVE_RESERVE_POOL_TRANSITION_APPROVAL"
      ]),
      founderAttendedAcceptance: Object.freeze(["EXACT_390_X_844_MOBILE_ACCEPTANCE"])
    }),
    claimBoundary: Object.freeze({
      seventyTwoHourStandardProven: false,
      reason: "EXTERNAL_AND_FOUNDER_ATTENDED_STEPS_REMAIN"
    }),
    safety: Object.freeze({
      prospectiveCollection: "OFF",
      activeCohorts: 0,
      recommendationInfluence: "OFF",
      availabilityProviders: "OFF",
      dailyScheduler: "OFF",
      productionMutationPerformed: false
    })
  });
}
