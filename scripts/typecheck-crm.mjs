import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildCrmReports,
  buildFollowUpQueue,
  createCrmState,
  createLeadFromRuntimeRecord,
  crmVersion,
  dashboardRuntimeRecordsFromActivePool,
  leadStatuses,
  loadRuntimeActivePool,
  recordRouteVisit
} from "../crm/crm-foundation.mjs";

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
assert.equal(enterpriseModel.implementationType, "architecture");
assert.equal(enterpriseModel.productionBetaSystemsModified, false);
assert.equal(Array.isArray(enterpriseModel.entities), true);
assert.equal(enterpriseModel.entities.some(entity => entity.id === "company_account"), true);

console.log("CRM typecheck passed: exported API and runtime adapter contracts are valid.");
