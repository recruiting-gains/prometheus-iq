import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const requiredFiles = [
  "intelligence/README.md",
  "intelligence/adaptive-outside-sales-intelligence-engine.md",
  "intelligence/subsystem-contracts.md",
  "intelligence/future-subsystem-handoffs.md",
  "intelligence/contracts/adaptive-intelligence-contracts.json",
  "COMPANY_IDENTITY.md",
  "PRODUCT_VISION.md",
  "research/README.md",
  "sales/README.md",
  "crm/README.md",
  "docs/route-intelligence-v2-architecture.md",
  "docs/continuous-learning-framework.md",
  "scripts/verify-route-intelligence-quality-gate.mjs",
  "scripts/govern-runtime-pool-refresh.mjs"
];

for (const file of requiredFiles) {
  try {
    read(file);
  } catch (error) {
    assert(false, `Missing required intelligence architecture source: ${file}`);
  }
}

const architecture = read("intelligence/adaptive-outside-sales-intelligence-engine.md");
const contractsDoc = read("intelligence/subsystem-contracts.md");
const handoffs = read("intelligence/future-subsystem-handoffs.md");
const readme = read("intelligence/README.md");
const systemMap = read("PROMETHEUS_SYSTEM_MAP.md");
const contracts = readJson("intelligence/contracts/adaptive-intelligence-contracts.json");

const requiredArchitectureSections = [
  "Visit Outcome Learning",
  "Confidence Engine",
  "Recommendation Explanation Engine",
  "Industry Intelligence",
  "Territory Intelligence",
  "Rep Intelligence",
  "Organization Intelligence",
  "Continuous Learning Pipeline",
  "Opportunity Ranking",
  "Pattern Detection",
  "Recommendation Confidence",
  "Explainable AI",
  "Human Override",
  "Knowledge Graph",
  "Learning Contracts",
  "Determinism Requirements",
  "Explainability Requirements",
  "Enterprise Safety Requirements"
];

for (const section of requiredArchitectureSections) {
  assert(architecture.includes(section), `Architecture missing section or capability: ${section}`);
}

const requiredContracts = [
  "EvidenceEvent",
  "LearningSignal",
  "ConfidenceAssessment",
  "RecommendationExplanation",
  "PatternFinding",
  "HumanOverride",
  "KnowledgeGraphFact",
  "OpportunityRankingResult"
];

for (const contractName of requiredContracts) {
  assert(contractsDoc.includes(contractName), `Contracts doc missing ${contractName}`);
  assert(Boolean(contracts.contracts?.[contractName]), `Contract registry missing ${contractName}`);
  assert(Array.isArray(contracts.contracts?.[contractName]?.requiredFields), `Contract ${contractName} must declare requiredFields`);
}

const requiredHandoffs = ["Dashboard", "CRM", "Research", "Companion", "Data", "Sales"];
for (const subsystem of requiredHandoffs) {
  assert(handoffs.includes(`${subsystem} Handoff`), `Future handoff missing ${subsystem}`);
  assert(contracts.futureSubsystemHandoffs.includes(subsystem), `Contract registry missing ${subsystem} handoff`);
}

const requiredProhibitions = [
  "no_production_scoring_changes",
  "no_dashboard_runtime_changes",
  "no_active_pool_modifications",
  "no_data_governance_changes",
  "no_anthony_beta_changes",
  "no_crm_modifications"
];
for (const prohibition of requiredProhibitions) {
  assert(contracts.prohibitions.includes(prohibition), `Contract registry missing prohibition ${prohibition}`);
}

assert(contracts.status === "architecture_only", "Contract registry must remain architecture_only.");
assert(contracts.productionBehaviorChanged === false, "Architecture must not declare production behavior changes.");
assert(contracts.scoringChanged === false, "Architecture must not declare scoring changes.");
assert(contracts.dashboardRuntimeChanged === false, "Architecture must not declare Dashboard runtime changes.");
assert(contracts.activePoolChanged === false, "Architecture must not declare Active Pool changes.");
assert(contracts.dataGovernanceChanged === false, "Architecture must not declare Data governance changes.");
assert(contracts.capabilityDomains.length >= 15, "Contract registry must cover all 15 requested capability domains.");
assert(readme.includes("Duplicate Prevention"), "Intelligence README must include duplicate-prevention guidance.");
assert(systemMap.includes("Adaptive Outside Sales Intelligence Engine"), "System map must reference the Adaptive Outside Sales Intelligence Engine foundation.");
assert(systemMap.includes("Do not create a second learning engine"), "System map must preserve Intelligence duplicate-prevention language.");

if (failures.length) {
  console.error("Prometheus Intelligence architecture validation failed:");
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("Prometheus Intelligence architecture validated: adaptive outside-sales contracts, handoffs, duplicate prevention, and no-production-change flags.");
}
