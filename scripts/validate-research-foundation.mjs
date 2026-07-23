import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const readJson = path => JSON.parse(readFileSync(path, "utf8"));
const readText = path => readFileSync(path, "utf8");

const walkFiles = directory =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });

const requiredCategories = [
  "AI",
  "Competition",
  "Funding",
  "Sales",
  "Industries",
  "Technology",
  "Customer Pain Points",
  "Enterprise",
  "Regulations",
  "Opportunities",
  "Risks"
];

const requiredIndustryLenses = [
  "Healthcare field sales",
  "Medical device sales",
  "Solar",
  "Roofing",
  "Pest control",
  "Security",
  "Telecom",
  "Commercial services",
  "Industrial sales",
  "Logistics"
];

const evidenceLabels = [
  "Observed",
  "Corroborated",
  "Owner-provided",
  "Unknown",
  "Inference"
];

const conclusionRequirements = [
  "evidenceBasis",
  "sourceReliability",
  "confidenceLevel",
  "verificationNeeded",
  "businessDecisionImpact"
];

const intelligenceLayers = [
  "Executive Summary",
  "Business Identity",
  "Ownership Leadership Public Operators Corporate Structure Timeline",
  "Business Evolution Expansion Growth Brand Development Historical Milestones",
  "Operational Intelligence",
  "Commercial Ecosystem Intelligence",
  "Competitive Intelligence",
  "Community Intelligence",
  "Digital Intelligence",
  "Reputation Intelligence",
  "Strategic Intelligence",
  "Executive Decision Support"
];

const taxonomy = readJson("research/taxonomy/research-taxonomy.json");
const sourceRegister = readJson("research/registers/source-register.json");
const backlog = readJson("research/registers/intelligence-backlog.json");
const briefingCatalog = readJson("research/registers/briefing-catalog.json");
const marketModel = readJson("research/registers/market-intelligence-model.json");
const gaiaModel = readJson("research/registers/gaia-evidence-engine.json");
const executiveStandard = readJson("research/registers/executive-intelligence-package-standard.json");
const marketScoring = readJson("research/reports/market-expansion-scoring-v1.json");
const benchmark = readJson("research/reports/executive-intelligence-benchmark-study-v1.json");
const founderBriefSchema = readJson("research/schemas/founder-intelligence-brief.schema.json");
const strategicBriefSchema = readJson("research/schemas/strategic-intelligence-brief.schema.json");
const marketSchema = readJson("research/schemas/market-intelligence-recommendation.schema.json");
const executiveSchema = readJson("research/schemas/executive-intelligence-package.schema.json");
const evidenceSchema = readJson("research/schemas/gaia-evidence-item.schema.json");
const fixture = readJson("research/fixtures/cross-industry-research-fixture-v1.json");

const architecture = readText("research/architecture.md");
const readme = readText("research/README.md");
const sourcePolicy = readText("research/source-policy.md");
const gaiaArchitecture = readText("research/gaia-research-orchestrator.md");
const executivePlatform = readText("research/executive-intelligence-platform.md");
const briefingSystem = readText("research/briefing-system.md");
const marketEngine = readText("research/market-intelligence-engine.md");
const benchmarkReport = readText("research/reports/executive-intelligence-benchmark-study-v1.md");
const marketReport = readText("research/reports/market-expansion-recommendation-v1.md");
const founderTemplate = readText("research/templates/founder-intelligence-brief.md");
const strategicTemplate = readText("research/templates/strategic-intelligence-brief.md");
const executiveTemplate = readText("research/templates/executive-intelligence-package.md");

for (const path of walkFiles("research").filter(path => path.endsWith(".json"))) {
  assert.doesNotThrow(() => readJson(path), `Invalid Research JSON: ${path}`);
}

for (const category of requiredCategories) {
  assert.ok(taxonomy.primaryCategories.includes(category), `Missing category: ${category}`);
  assert.ok(founderBriefSchema.properties.categoryCoverage.required.includes(category));
  assert.ok(founderTemplate.includes(`${category}:`));
}

for (const industry of requiredIndustryLenses) {
  assert.ok(taxonomy.industryLenses.includes(industry), `Missing industry lens: ${industry}`);
  assert.ok(architecture.includes(industry), `Architecture missing industry lens: ${industry}`);
}

for (const subsystem of taxonomy.prohibitedTargetsForDirectModification) {
  assert.ok(architecture.includes(subsystem), `Architecture missing boundary for ${subsystem}`);
  assert.ok(sourcePolicy.includes(subsystem), `Source policy missing boundary for ${subsystem}`);
}

assert.ok(architecture.includes("No live integrations."));
assert.ok(architecture.includes("No automated web scraping."));
assert.ok(sourcePolicy.includes("Unsupported scraped sources"));
assert.ok(readme.includes("customer-neutral"));
assert.match(readme, /synthetic, non-production/i);
assert.ok(readme.includes("cross-industry-research-fixture-v1.json"));

assert.ok(sourceRegister.sources.length >= 6);
const sourceIds = new Set();
for (const source of sourceRegister.sources) {
  assert.ok(source.id);
  assert.ok(!sourceIds.has(source.id), `Duplicate source id: ${source.id}`);
  sourceIds.add(source.id);
  assert.ok(source.title);
  assert.ok(source.publisher);
  assert.ok(source.sourceRef);
  assert.ok(["Tier 1", "Tier 2", "Tier 3"].includes(source.trustTier));
  assert.ok(Array.isArray(source.categories));
  assert.ok(source.limitations);
}

const enrichmentSource = sourceRegister.sources.find(source => source.id === "apollo-enrichment");
assert.ok(enrichmentSource);
assert.equal(enrichmentSource.trustTier, "Tier 3");
assert.equal(enrichmentSource.enrichmentOnly, true);
assert.equal(enrichmentSource.requiresCorroboration, true);
assert.ok(enrichmentSource.limitations.includes("not a source of truth"));

assert.ok(backlog.items.length >= 5);
for (const item of backlog.items) {
  assert.ok(requiredCategories.includes(item.category));
  assert.ok(Array.isArray(item.industryLens));
  assert.ok(item.question);
  assert.ok(item.recommendedCadence);
}

assert.ok(briefingCatalog.briefings.length >= 10);
for (const briefing of briefingCatalog.briefings) {
  assert.equal(briefing.productionIntegrationAllowed, false);
  assert.equal(briefing.unsupportedScrapingAllowed, false);
  assert.ok(briefingSystem.includes(briefing.name));
  assert.ok(strategicBriefSchema.properties.briefingType.enum.includes(briefing.id));
}
for (const heading of [
  "Summary",
  "Why It Matters",
  "Impact On Prometheus",
  "Opportunities",
  "Risks",
  "Recommended Founder Actions",
  "Source References"
]) {
  assert.ok(strategicTemplate.includes(heading));
}

assert.equal(marketModel.runtimeActive, false);
assert.equal(marketModel.productionSystemsModified, false);
assert.equal(marketModel.unsupportedScrapingAllowed, false);
assert.equal(marketModel.scoringDimensions.reduce((sum, item) => sum + item.weight, 0), 100);
for (const capability of marketModel.capabilities) {
  assert.ok(
    marketEngine.toLowerCase().replace(/[^a-z0-9]/g, "").includes(capability.replaceAll("_", "")),
    `Market engine missing ${capability}`
  );
}
for (const field of marketModel.requiredFounderReadyOutput) {
  assert.ok(marketSchema.required.includes(field));
}
for (const subsystem of ["Companion", "Dashboard", "CRM", "Mobile", "Intelligence runtime"]) {
  assert.ok(marketModel.protectedSubsystems.includes(subsystem));
}
assert.ok(marketScoring.industriesEvaluated.length >= 10);
assert.ok(marketScoring.sourceReferences.length >= 12);
assert.ok(marketReport.includes("Source References"));

assert.equal(executiveStandard.standardId, "executive_intelligence_platform_v1");
assert.equal(executiveStandard.status, "active_research_standard");
assert.equal(executiveStandard.productionRuntimeChange, false);
assert.deepEqual(executiveStandard.evidenceLabels, evidenceLabels);
assert.deepEqual(executiveStandard.requiredConclusionFields, conclusionRequirements);
assert.deepEqual(executiveStandard.intelligenceLayers.map(layer => layer.name), intelligenceLayers);
assert.equal(executiveStandard.audiencePerspective.defaultPerspective, "receiving_executive");
assert.equal(executiveStandard.audiencePerspective.packageExecutesEngagement, false);
assert.deepEqual(executiveSchema.properties.evidenceLabels.items.enum, evidenceLabels);
assert.deepEqual(executiveSchema.properties.conclusionRequirements.items.enum, conclusionRequirements);
assert.equal(executiveSchema.properties.layers.minItems, 12);
assert.equal(executiveSchema.properties.layers.maxItems, 12);
for (const [index, layer] of intelligenceLayers.entries()) {
  assert.equal(executiveStandard.intelligenceLayers[index].layer, index + 1);
  assert.ok(executiveTemplate.includes(`## Layer ${index + 1}:`));
  assert.ok(
    executivePlatform.toLowerCase().replace(/[^a-z0-9]/g, "").includes(layer.toLowerCase().replace(/[^a-z0-9]/g, ""))
  );
}

assert.equal(gaiaModel.standardId, "gaia_research_orchestrator_foundation_v1");
assert.equal(gaiaModel.productionRuntimeChange, false);
assert.equal(gaiaModel.providerAgnostic, true);
assert.equal(gaiaModel.externalProvidersNeverRecommend, true);
assert.equal(gaiaModel.gaiaProducesExecutiveRecommendations, true);
assert.equal(gaiaModel.evidenceQualityScoring.dimensions.reduce((sum, item) => sum + item.weight, 0), 100);
for (const field of gaiaModel.requiredEvidenceItemFields) {
  assert.ok(evidenceSchema.required.includes(field));
}
for (const phrase of [
  "Gaia does not replace external GPTs",
  "Gaia orchestrates them",
  "External GPTs never produce executive recommendations",
  "Every evidence source is replaceable"
]) {
  assert.ok(gaiaArchitecture.includes(phrase));
  assert.ok(architecture.includes(phrase));
}

assert.equal(benchmark.status, "founder_ready_research_artifact");
assert.equal(benchmark.productionRuntimeChange, false);
assert.equal(benchmark.missionQuestion, "What makes executives trust recommendations?");
assert.ok(benchmark.sourceReferences.length >= 20);
assert.ok(benchmark.recommendedPackageStructure.length >= 20);
assert.match(benchmarkReport, /synthetic cross-industry Executive Intelligence Package/i);
for (const [field, expected] of Object.entries({
  researchArtifactOnly: true,
  publicSourcesOnly: true,
  proprietaryFormatsCopied: false,
  copyrightedDocumentsReproduced: false,
  dashboardModified: false,
  crmModified: false,
  websiteModified: false,
  infrastructureModified: false,
  companionModified: false,
  mobileModified: false,
  intelligenceRuntimeModified: false,
  productionDataModified: false
})) {
  assert.equal(benchmark.boundaryConfirmation[field], expected);
}

assert.equal(fixture.classification, "synthetic_non_production_fixture");
assert.equal(fixture.productionRuntimeChange, false);
assert.equal(fixture.providerCallsPerformed, false);
assert.equal(fixture.containsCustomerData, false);
assert.equal(fixture.containsPersonalInformation, false);
assert.equal(fixture.platformStandard, executiveStandard.standardId);
assert.equal(fixture.evidenceEngineStandard, gaiaModel.standardId);
assert.deepEqual(fixture.evidenceLabels, evidenceLabels);
assert.deepEqual(fixture.conclusionRequirements, conclusionRequirements);
assert.equal(fixture.workspaces.length, 2);
assert.equal(new Set(fixture.workspaces.map(workspace => workspace.workspaceId)).size, fixture.workspaces.length);
assert.equal(new Set(fixture.workspaces.map(workspace => workspace.industry)).size, fixture.workspaces.length);

const fixtureEvidenceIds = new Set();
for (const workspace of fixture.workspaces) {
  assert.ok(workspace.workspaceId.startsWith("synthetic_"));
  assert.ok(workspace.companyDisplayName.startsWith("Synthetic "));
  assert.ok(workspace.researchQuestion);
  assert.ok(workspace.evidenceItems.length >= 2);
  for (const evidence of workspace.evidenceItems) {
    assert.ok(evidence.evidenceId.startsWith(`${workspace.workspaceId}_`));
    assert.ok(!fixtureEvidenceIds.has(evidence.evidenceId));
    fixtureEvidenceIds.add(evidence.evidenceId);
    assert.ok(evidenceLabels.includes(evidence.label));
    assert.ok(["Tier 1", "Tier 2", "Tier 3"].includes(evidence.sourceTier));
  }
  assert.ok(evidenceLabels.includes(workspace.majorConclusion.label));
  for (const field of conclusionRequirements) {
    assert.ok(workspace.majorConclusion[field]);
  }
}

assert.deepEqual(fixture.isolationAssertions, {
  workspaceIdsUnique: true,
  evidenceIdsUnique: true,
  crossWorkspaceEvidenceReferences: false,
  sharedCustomerRecords: false,
  runtimeFallbackAllowed: false
});
for (const [field, expected] of Object.entries({
  researchArtifactOnly: true,
  dashboardModified: false,
  crmModified: false,
  websiteModified: false,
  infrastructureModified: false,
  companionModified: false,
  mobileModified: false,
  intelligenceRuntimeModified: false,
  productionDataModified: false
})) {
  assert.equal(fixture.boundaryConfirmation[field], expected);
}

const retiredTokens = [
  [115, 109, 111, 111, 116, 104, 105, 101, 100, 101, 112, 111, 116],
  [110, 117, 116, 114, 105, 116, 105, 111, 110, 100, 101, 112, 111, 116],
  [99, 114, 97, 110, 107, 121, 99, 97, 114, 114, 111, 116]
].map(codes => String.fromCharCode(...codes));

const normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g, "");
for (const path of walkFiles("research")) {
  assert.ok(statSync(path).isFile());
  const normalizedPath = normalize(path);
  const normalizedContents = normalize(readText(path));
  for (const token of retiredTokens) {
    assert.ok(!normalizedPath.includes(token), `Retired customer identifier remains in path: ${path}`);
    assert.ok(!normalizedContents.includes(token), `Retired customer identifier remains in file: ${path}`);
  }
}

console.log("Research foundation validation passed.");
