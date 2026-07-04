import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));

const plan = readJson("crm/workspaces/smoothie-depot/candidate-pipeline-contracts.json");
const workspacePlan = readJson("intelligence/workspaces/smoothie-depot/workspace-intelligence-plan.json");
const doc = read("crm/workspaces/smoothie-depot/candidate-pipeline-planning.md");

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const requiredStages = [
  "Business Identified",
  "Owner Research Needed",
  "Contact Found",
  "Outreach Sent",
  "Interested",
  "Discovery Scheduled",
  "Discovery Complete",
  "Qualified Candidate",
  "JR Handoff",
  "FDD / Review",
  "Closed Won",
  "Not Qualified",
  "No Response"
];

const requiredCandidateFieldIds = [
  "candidate_name",
  "business_name",
  "business_category",
  "phone",
  "email",
  "website",
  "address",
  "source",
  "google_rating",
  "review_count",
  "owner_contact_status",
  "preferred_territory",
  "liquid_capital_self_reported",
  "net_worth_self_reported",
  "credit_range_self_reported",
  "number_of_locations_desired",
  "readiness_assessment_status",
  "jr_handoff_status",
  "protected_candidate_start_date",
  "protected_candidate_expiration_date",
  "commission_forecast",
  "next_follow_up_date",
  "notes"
];

const requiredContractKeys = [
  "candidate_record_contract",
  "business_prospect_record_contract",
  "jr_handoff_contract",
  "commission_tracking_contract",
  "protected_candidate_tracking_contract",
  "workspace_isolation_guardrail"
];

assert(plan.status === "planning_contracts_only", "CRM plan must remain planning contracts only.");
assert(plan.implementationType === "planning_contracts_only", "Implementation type must remain planning contracts only.");
assert(plan.runtimeImplementationApproved === false, "Runtime implementation must not be approved.");
assert(plan.runtimeRecordsCreated === false, "Runtime records must not be created.");
assert(plan.workspaceId === "smoothie_depot", "CRM plan must be scoped to Smoothie Depot.");
assert(plan.workspaceName === "Smoothie Depot", "CRM plan must name Smoothie Depot.");
assert(plan.operatingProfileId === "franchise_development", "CRM plan must use the Franchise Development profile.");
assert(plan.owningSubsystem === "Prometheus CRM", "CRM plan must be owned by Prometheus CRM.");
assert(plan.sourceContracts.workspaceIntelligencePlan === "intelligence/workspaces/smoothie-depot/workspace-intelligence-plan.json", "CRM plan must consume the existing Smoothie Depot workspace plan.");
assert(workspacePlan.workspaceId === plan.workspaceId, "CRM plan workspace must match the Intelligence workspace plan.");
assert(workspacePlan.operatingProfileId === plan.operatingProfileId, "CRM plan operating profile must match the Intelligence workspace plan.");
assert(workspacePlan.runtimeActivation.crmRuntimeChanged === false, "Source Intelligence plan must keep CRM runtime unchanged.");

for (const [flag, value] of Object.entries(plan.protectedSubsystems)) {
  assert(value === false, `Protected subsystem flag ${flag} must remain false.`);
}

assert(plan.workspaceIsolation.doNotTouchFitnessConnection === true, "Fitness Connection touch prohibition must be explicit.");
assert(plan.workspaceIsolation.doNotMixWithFitnessConnection === true, "Fitness Connection record mixing must be prohibited.");
assert(plan.workspaceIsolation.fitnessConnectionSeparationConfirmed === true, "Fitness Connection separation must be confirmed.");
assert(plan.workspaceIsolation.protectedWorkspaceIds.includes("fitness_connection"), "Fitness Connection workspace must be protected.");
assert(plan.workspaceIsolation.runtimeCandidateRecordsAllowed === false, "Runtime candidate records must not be allowed.");

assert(JSON.stringify(plan.pipeline.stages) === JSON.stringify(requiredStages), "Pipeline stages must match the requested Smoothie Depot sequence.");
assert(plan.pipeline.terminalStages.includes("Closed Won"), "Pipeline must include Closed Won as a terminal stage.");
assert(plan.pipeline.terminalStages.includes("Not Qualified"), "Pipeline must include Not Qualified as a terminal stage.");
assert(plan.pipeline.terminalStages.includes("No Response"), "Pipeline must include No Response as a terminal stage.");

for (const contractKey of requiredContractKeys) {
  assert(Boolean(plan.contracts?.[contractKey]), `CRM plan missing ${contractKey}.`);
  assert(plan.contracts[contractKey].runtimeMutationAuthorized === false || contractKey === "workspace_isolation_guardrail", `${contractKey} must not authorize runtime mutation.`);
}

const candidateFieldIds = new Set(plan.contracts.candidate_record_contract.requiredFields.map(field => field.id));
for (const fieldId of requiredCandidateFieldIds) {
  assert(candidateFieldIds.has(fieldId), `Candidate record contract missing required field ${fieldId}.`);
}

const guardrailValues = plan.contracts.workspace_isolation_guardrail.requiredValues;
assert(guardrailValues.workspace_id === "smoothie_depot", "Guardrail must require Smoothie Depot workspace ID.");
assert(guardrailValues.operating_profile_id === "franchise_development", "Guardrail must require Franchise Development profile.");
assert(guardrailValues.fitness_connection_separation_confirmed === true, "Guardrail must confirm Fitness Connection separation.");
assert(guardrailValues.route_intelligence_influence === false, "Guardrail must block Route Intelligence influence.");
assert(guardrailValues.active_pool_scoring_influence === false, "Guardrail must block Active Pool scoring influence.");
assert(guardrailValues.dashboard_runtime_influence === false, "Guardrail must block Dashboard runtime influence.");
assert(guardrailValues.runtime_mutation_authorized === false, "Guardrail must block runtime mutation.");

for (const phrase of [
  "planning contracts only",
  "Business Identified",
  "JR Handoff",
  "FDD / Review",
  "Closed Won",
  "Candidate Record Contract",
  "Business Prospect Record Contract",
  "JR Handoff Contract",
  "Commission Tracking Contract",
  "Protected Candidate Tracking Contract",
  "Workspace Isolation Guardrail"
]) {
  assert(doc.includes(phrase), `CRM planning doc missing phrase: ${phrase}`);
}

const summary = {
  status: failures.length ? "failed" : "passed",
  workspace: plan.workspaceName,
  workspaceId: plan.workspaceId,
  operatingProfile: plan.operatingProfileId,
  implementationType: plan.implementationType,
  pipelineStages: plan.pipeline.stages,
  contractsCreated: requiredContractKeys,
  isolation: {
    fitnessConnectionSeparationConfirmed: plan.workspaceIsolation.fitnessConnectionSeparationConfirmed,
    doNotTouchFitnessConnection: plan.workspaceIsolation.doNotTouchFitnessConnection,
    doNotMixWithFitnessConnection: plan.workspaceIsolation.doNotMixWithFitnessConnection,
    runtimeCandidateRecordsAllowed: plan.workspaceIsolation.runtimeCandidateRecordsAllowed
  },
  protectedSubsystems: plan.protectedSubsystems,
  failures
};

console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exitCode = 1;
