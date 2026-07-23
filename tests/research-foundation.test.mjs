import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const readJson = path => JSON.parse(readFileSync(path, "utf8"));
const readText = path => readFileSync(path, "utf8");
const walkFiles = directory =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });

test("Research foundation preserves advisory and production boundaries", () => {
  const taxonomy = readJson("research/taxonomy/research-taxonomy.json");
  const architecture = readText("research/architecture.md");
  const policy = readText("research/source-policy.md");

  for (const subsystem of taxonomy.prohibitedTargetsForDirectModification) {
    assert.match(architecture, new RegExp(subsystem));
    assert.match(policy, new RegExp(subsystem));
  }

  assert.match(architecture, /No live integrations\./);
  assert.match(architecture, /No automated web scraping\./);
  assert.match(policy, /unsupported scraped sources/i);
  assert.match(policy, /Apollo is not a source of truth/);
  assert.match(policy, /Apollo-derived findings must be labeled as enrichment signals/);
});

test("Research remains horizontal across field-sales industries", () => {
  const taxonomy = readJson("research/taxonomy/research-taxonomy.json");
  const scoring = readJson("research/reports/market-expansion-scoring-v1.json");

  for (const industry of [
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
  ]) {
    assert.ok(taxonomy.industryLenses.includes(industry), `Missing industry lens: ${industry}`);
  }

  assert.ok(scoring.industriesEvaluated.length >= 10);
  assert.ok(new Set(scoring.industriesEvaluated.map(entry => entry.industry)).size >= 10);
  assert.equal(scoring.boundaryConfirmation.productionDeploymentRequired, false);
});

test("Executive Intelligence and Gaia contracts stay aligned", () => {
  const standard = readJson("research/registers/executive-intelligence-package-standard.json");
  const schema = readJson("research/schemas/executive-intelligence-package.schema.json");
  const gaia = readJson("research/registers/gaia-evidence-engine.json");
  const evidenceSchema = readJson("research/schemas/gaia-evidence-item.schema.json");
  const template = readText("research/templates/executive-intelligence-package.md");

  const labels = ["Observed", "Corroborated", "Owner-provided", "Unknown", "Inference"];
  const conclusionFields = [
    "evidenceBasis",
    "sourceReliability",
    "confidenceLevel",
    "verificationNeeded",
    "businessDecisionImpact"
  ];

  assert.equal(standard.productionRuntimeChange, false);
  assert.deepEqual(standard.evidenceLabels, labels);
  assert.deepEqual(standard.requiredConclusionFields, conclusionFields);
  assert.deepEqual(schema.properties.evidenceLabels.items.enum, labels);
  assert.deepEqual(schema.properties.conclusionRequirements.items.enum, conclusionFields);
  assert.equal(standard.intelligenceLayers.length, 12);
  assert.equal(schema.properties.layers.minItems, 12);
  assert.equal(schema.properties.layers.maxItems, 12);

  for (const [index, layer] of standard.intelligenceLayers.entries()) {
    assert.equal(layer.layer, index + 1);
    assert.match(template, new RegExp(`## Layer ${index + 1}:`));
  }

  assert.equal(gaia.providerAgnostic, true);
  assert.equal(gaia.externalProvidersNeverRecommend, true);
  assert.equal(gaia.gaiaProducesExecutiveRecommendations, true);
  assert.equal(gaia.productionRuntimeChange, false);
  assert.equal(gaia.evidenceQualityScoring.dimensions.reduce((sum, item) => sum + item.weight, 0), 100);
  for (const field of gaia.requiredEvidenceItemFields) {
    assert.ok(evidenceSchema.required.includes(field));
  }
});

test("Synthetic cross-industry fixture proves workspace isolation without runtime data", () => {
  const fixture = readJson("research/fixtures/cross-industry-research-fixture-v1.json");
  const standard = readJson("research/registers/executive-intelligence-package-standard.json");
  const gaia = readJson("research/registers/gaia-evidence-engine.json");

  assert.equal(fixture.classification, "synthetic_non_production_fixture");
  assert.equal(fixture.productionRuntimeChange, false);
  assert.equal(fixture.providerCallsPerformed, false);
  assert.equal(fixture.containsCustomerData, false);
  assert.equal(fixture.containsPersonalInformation, false);
  assert.equal(fixture.platformStandard, standard.standardId);
  assert.equal(fixture.evidenceEngineStandard, gaia.standardId);
  assert.equal(fixture.workspaces.length, 2);

  const workspaceIds = new Set();
  const industries = new Set();
  const evidenceIds = new Set();
  for (const workspace of fixture.workspaces) {
    assert.match(workspace.workspaceId, /^synthetic_/);
    assert.match(workspace.companyDisplayName, /^Synthetic /);
    assert.ok(!workspaceIds.has(workspace.workspaceId));
    workspaceIds.add(workspace.workspaceId);
    industries.add(workspace.industry);

    for (const evidence of workspace.evidenceItems) {
      assert.match(evidence.evidenceId, new RegExp(`^${workspace.workspaceId}_`));
      assert.ok(!evidenceIds.has(evidence.evidenceId));
      evidenceIds.add(evidence.evidenceId);
    }

    for (const field of fixture.conclusionRequirements) {
      assert.ok(workspace.majorConclusion[field]);
    }
  }

  assert.equal(workspaceIds.size, 2);
  assert.equal(industries.size, 2);
  assert.equal(fixture.isolationAssertions.crossWorkspaceEvidenceReferences, false);
  assert.equal(fixture.isolationAssertions.sharedCustomerRecords, false);
  assert.equal(fixture.isolationAssertions.runtimeFallbackAllowed, false);
  assert.equal(fixture.boundaryConfirmation.productionDataModified, false);
  assert.equal(fixture.boundaryConfirmation.intelligenceRuntimeModified, false);
});

test("Research current tree contains no retired customer identity variants", () => {
  const retiredTokens = [
    [115, 109, 111, 111, 116, 104, 105, 101, 100, 101, 112, 111, 116],
    [110, 117, 116, 114, 105, 116, 105, 111, 110, 100, 101, 112, 111, 116],
    [99, 114, 97, 110, 107, 121, 99, 97, 114, 114, 111, 116]
  ].map(codes => String.fromCharCode(...codes));
  const normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const path of walkFiles("research")) {
    const normalizedPath = normalize(path);
    const normalizedContents = normalize(readText(path));
    for (const token of retiredTokens) {
      assert.ok(!normalizedPath.includes(token), `Retired identity remains in path: ${path}`);
      assert.ok(!normalizedContents.includes(token), `Retired identity remains in file: ${path}`);
    }
  }
});

test("Research foundation validator passes as the owner gate", () => {
  const result = spawnSync(process.execPath, ["scripts/validate-research-foundation.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Research foundation validation passed\./);
});
