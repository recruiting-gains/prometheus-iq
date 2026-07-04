import {
  buildNormalizedOutcomeModel,
  buildProfileConsumerContract,
  loadOperatingProfileContracts,
  loadOperatingProfiles,
  normalizeIndustryOutcome,
  validateOperatingProfileRegistry
} from "../intelligence/operating-profile-engine.mjs";

const registry = loadOperatingProfiles();
const contracts = loadOperatingProfileContracts();
const failures = validateOperatingProfileRegistry(registry, contracts);
const consumers = ["Dashboard", "CRM", "Companion", "Mobile", "Website", "Research", "Sales", "SocialMedia"];
const samples = [
  ["general_outside_sales", "contract"],
  ["fitness", "membership"],
  ["roofing", "inspection"],
  ["security", "site survey"],
  ["medical", "appointment"],
  ["insurance", "policy"],
  ["solar", "proposal"],
  ["home_services", "job booked"],
  ["franchise_development", "JR handoff"]
];

const normalizedSamples = samples.map(([profileId, rawOutcome]) => {
  const normalized = normalizeIndustryOutcome({
    profileId,
    rawOutcome,
    visit: {
      businessRef: { source: "fixture", name: `${profileId} fixture` },
      repRef: { source: "fixture", name: "Field Rep" },
      occurredAt: "2026-07-02T12:00:00.000Z"
    }
  });
  const model = buildNormalizedOutcomeModel(normalized);
  if (model.sequence.Recommendation.canChangeRecommendation !== false) {
    failures.push(`${profileId} normalized model can change production recommendations`);
  }
  return {
    profileId,
    rawOutcome,
    normalizedOutcome: normalized.normalizedOutcome,
    canChangeRecommendation: model.sequence.Recommendation.canChangeRecommendation
  };
});

const consumerContracts = [];
for (const profile of registry.profiles) {
  for (const consumer of consumers) {
    const payload = buildProfileConsumerContract(profile.profileId, consumer, { registry, contracts });
    consumerContracts.push(`${consumer}:${profile.profileId}`);
    if (payload.status !== "architecture_only") failures.push(`${consumer}:${profile.profileId} is not architecture_only`);
    if (payload.runtimeConsumptionAuthorized === true) failures.push(`${consumer}:${profile.profileId} authorizes runtime consumption`);
    if (payload.runtimeMutationAuthorized === true) failures.push(`${consumer}:${profile.profileId} authorizes runtime mutation`);
    if (payload.mobileBetaChanged === true) failures.push(`${consumer}:${profile.profileId} changes Mobile beta`);
    if (payload.websiteChanged === true) failures.push(`${consumer}:${profile.profileId} changes Website`);
  }
}

const summary = {
  status: failures.length ? "failed" : "passed",
  version: registry.version,
  profileCount: registry.profiles.length,
  profiles: registry.profiles.map(profile => profile.profileId),
  consumerContractCount: consumerContracts.length,
  normalizedOutcomeModel: registry.normalizedOutcomeModel.sequence,
  normalizedSamples,
  productionSafety: {
    productionLearningActive: registry.productionLearningActive,
    productionRecommendationChanged: registry.productionRecommendationChanged,
    dashboardRuntimeChanged: registry.dashboardRuntimeChanged,
    mobileBetaChanged: registry.mobileBetaChanged,
    scoringChanged: registry.scoringChanged,
    activePoolChanged: registry.activePoolChanged,
    crmRuntimeChanged: registry.crmRuntimeChanged,
    websiteChanged: registry.websiteChanged,
    companionRuntimeChanged: registry.companionRuntimeChanged,
    infrastructureChanged: registry.infrastructureChanged
  },
  failures
};

console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exitCode = 1;
