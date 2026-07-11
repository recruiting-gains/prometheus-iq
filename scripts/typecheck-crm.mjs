import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildCrmReports,
  buildFollowUpQueue,
  createCrmState,
  createLeadFromRuntimeRecord,
  crmVersion,
  persistWorkspaceLeadIntakeHandoff,
  dashboardRuntimeRecordsFromActivePool,
  leadStatuses,
  loadRuntimeActivePool,
  recordRouteVisit,
  attachWebsiteAttributionToLead,
  buildCrmOperatingProfile,
  recordProfileOutcomeForLead,
  transitionLeadProfileStage
} from "../crm/crm-foundation.mjs";
import {
  createCloudflareKvCrmWorkspaceLeadStore,
  crmWorkspaceLeadStoreBinding,
  crmWorkspaceLeadStoreTechnology,
  validateCloudflareKvCrmWorkspaceLeadStoreBinding
} from "../crm/cloudflare-kv-workspace-lead-store.mjs";
import {
  persistWorkspaceLeadIntakeWithProductionStore,
  productionCrmWorkspaceLeadBindingStatus,
  readWorkspaceLeadIntakeFromProductionStore
} from "../crm/workspace-lead-production-runtime.mjs";
import {
  readPersistedWorkspaceLeadBySubmission,
  supportedWorkspaceLeadIntakeWorkspaces,
  validateWorkspaceLeadIntakeHandoff
} from "../crm/workspace-lead-persistence.mjs";

const root = resolve(import.meta.dirname, "..");
const enterpriseModel = JSON.parse(readFileSync(resolve(root, "crm/enterprise-lifecycle-model.json"), "utf8"));
const activePool = loadRuntimeActivePool();
const runtimeRecords = dashboardRuntimeRecordsFromActivePool(activePool, { repId: "anthony" });
const state = createCrmState({ now: "2026-06-30T09:00:00.000Z" });
const lead = createLeadFromRuntimeRecord(state, runtimeRecords[0], {
  ownerRepId: "anthony",
  priority: "high"
});

recordRouteVisit(state, {
  leadId: lead.id,
  repId: "anthony",
  routeRecordId: runtimeRecords[0].id,
  outcome: "follow_up_requested",
  visitedAt: "2026-06-30T10:00:00.000Z",
  followUpDueAt: "2026-06-30T15:00:00.000Z",
  followUpPriority: "high"
});
attachWebsiteAttributionToLead(state, lead.id, {
  id: "website_visit_typecheck",
  type: "website_visit",
  target: "website_traffic",
  source: "website_contract",
  provider: "instagram",
  campaignId: "typecheck-campaign",
  occurredAt: "2026-06-30T08:30:00.000Z",
  visitorId: "web_visitor_typecheck",
  confidence: 1,
  metadata: {
    utm_source: "instagram",
    campaign_platform: "instagram",
    landing_path: "/"
  }
}, {
  occurredAt: "2026-06-30T09:30:00.000Z"
});
transitionLeadProfileStage(state, lead.id, "Manager Reached", {
  occurredAt: "2026-06-30T10:00:00.000Z"
});
recordProfileOutcomeForLead(state, {
  leadId: lead.id,
  rawOutcome: "membership",
  occurredAt: "2026-06-30T10:15:00.000Z"
});

const reports = buildCrmReports(state, { asOf: "2026-06-30T12:00:00.000Z" });
const queue = buildFollowUpQueue(state, { asOf: "2026-06-30T12:00:00.000Z" });

assert.equal(typeof crmVersion, "string");
assert.ok(leadStatuses.includes("Follow-up Required"));
assert.equal(Array.isArray(runtimeRecords), true);
assert.equal(typeof runtimeRecords[0].id, "string");
assert.equal(typeof runtimeRecords[0].googlePlaceId, "string");
assert.equal(typeof state.contacts[0].id, "string");
assert.equal(typeof state.leads[0].status, "string");
assert.equal(typeof queue[0].dueAt, "string");
assert.equal(typeof reports.founderActivitySummary.visibleContacts, "number");
assert.equal(reports.anthonyBetaActivity.every(activity => activity.founderVisible), true);
assert.equal(state.attributionEvents[0].target, "crm_lead");
assert.equal(state.leads[0].attribution.campaignId, "typecheck-campaign");
assert.equal(state.operatingProfile.profileId, "fitness");
assert.equal(buildCrmOperatingProfile("roofing").crmStages.includes("Inspection Scheduled"), true);
assert.equal(state.leads[0].profileStage, "Manager Reached");
assert.equal(state.leads[0].profileOutcomes[0].normalizedOutcome, "sale");
assert.equal(enterpriseModel.implementationType, "architecture");
assert.equal(enterpriseModel.productionBetaSystemsModified, false);
assert.equal(Array.isArray(enterpriseModel.entities), true);
assert.equal(enterpriseModel.entities.some(entity => entity.id === "company_account"), true);
assert.equal(typeof persistWorkspaceLeadIntakeHandoff, "function");
assert.equal(typeof persistWorkspaceLeadIntakeWithProductionStore, "function");
assert.equal(typeof readWorkspaceLeadIntakeFromProductionStore, "function");
assert.equal(typeof readPersistedWorkspaceLeadBySubmission, "function");
assert.equal(typeof validateWorkspaceLeadIntakeHandoff, "function");
assert.equal(crmWorkspaceLeadStoreBinding, "CRM_WORKSPACE_LEAD_STORE");
assert.equal(crmWorkspaceLeadStoreTechnology, "cloudflare_workers_kv");
assert.equal(supportedWorkspaceLeadIntakeWorkspaces.fitness_connection.runtimePersistenceAllowed, true);
assert.equal(supportedWorkspaceLeadIntakeWorkspaces.smoothie_depot.runtimePersistenceAllowed, false);

const kvBinding = {
  async get() { return null; },
  async put() {}
};
assert.equal(validateCloudflareKvCrmWorkspaceLeadStoreBinding({ CRM_WORKSPACE_LEAD_STORE: kvBinding }).ok, true);
assert.equal(createCloudflareKvCrmWorkspaceLeadStore({ CRM_WORKSPACE_LEAD_STORE: kvBinding }).bindingName, crmWorkspaceLeadStoreBinding);
assert.deepEqual(productionCrmWorkspaceLeadBindingStatus({ CRM_WORKSPACE_LEAD_STORE: kvBinding }), {
  bindingName: crmWorkspaceLeadStoreBinding,
  storageTechnology: crmWorkspaceLeadStoreTechnology,
  readable: true,
  writable: true
});

console.log("CRM typecheck passed: exported API and runtime adapter contracts are valid.");
