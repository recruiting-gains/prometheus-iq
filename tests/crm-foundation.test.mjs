import test from "node:test";
import assert from "node:assert/strict";
import {
  addContactNote,
  attachWebsiteAttributionToLead,
  buildCrmReports,
  buildFollowUpQueue,
  buildTaskQueue,
  completeTask,
  createCrmState,
  createFollowUp,
  createLeadFromRuntimeRecord,
  dashboardRuntimeRecordsFromActivePool,
  loadRuntimeActivePool,
  recordRouteVisit,
  transitionLead
} from "../crm/crm-foundation.mjs";
import { createWebsiteAttributionSession } from "../deploy/prometheusrouteiq-website/website-attribution.js";
import {
  SOCIAL_ATTRIBUTION_EVENT_TYPES,
  SOCIAL_ATTRIBUTION_TARGETS,
  SOCIAL_DATA_SOURCES
} from "../social-media/contracts/social-media-contract.js";

function memoryStorage() {
  const items = new Map();
  return {
    getItem: key => items.has(key) ? items.get(key) : null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: key => items.delete(key)
  };
}

function anthonyRuntimeRecord(index = 0) {
  const activePool = loadRuntimeActivePool();
  const records = dashboardRuntimeRecordsFromActivePool(activePool, { repId: "anthony" });
  assert.ok(records.length > index, "Anthony runtime records must exist");
  return records[index];
}

test("contact creation converts a dashboard runtime record into a CRM contact and lead", () => {
  const state = createCrmState({ now: "2026-06-30T09:00:00.000Z" });
  const runtimeRecord = anthonyRuntimeRecord();

  const lead = createLeadFromRuntimeRecord(state, runtimeRecord, {
    ownerRepId: "anthony",
    priority: "high"
  });

  assert.equal(state.contacts.length, 1);
  assert.equal(state.leads.length, 1);
  assert.equal(state.contacts[0].googlePlaceId, runtimeRecord.googlePlaceId);
  assert.equal(state.contacts[0].sourceRuntimeRecordId, runtimeRecord.id);
  assert.equal(state.contacts[0].founderVisible, true);
  assert.equal(lead.status, "New Lead");
  assert.equal(lead.ownerRepId, "anthony");
  assert.equal(state.betaActivity.some(activity => activity.repId === "anthony" && activity.founderVisible), true);
});

test("lead progression follows the CRM pipeline and records sales activity", () => {
  const state = createCrmState({ now: "2026-06-30T09:00:00.000Z" });
  const lead = createLeadFromRuntimeRecord(state, anthonyRuntimeRecord());

  transitionLead(state, lead.id, "Contacted", {
    actorId: "anthony",
    occurredAt: "2026-06-30T10:00:00.000Z",
    note: "Spoke with front desk."
  });
  transitionLead(state, lead.id, "Follow-up Required", {
    actorId: "anthony",
    occurredAt: "2026-06-30T10:15:00.000Z",
    dueAt: "2026-06-30T16:00:00.000Z",
    priority: "high",
    reason: "Manager asked for a later check-in."
  });
  transitionLead(state, lead.id, "Appointment Scheduled", {
    actorId: "anthony",
    occurredAt: "2026-06-30T17:00:00.000Z"
  });
  transitionLead(state, lead.id, "Proposal", {
    actorId: "founder",
    occurredAt: "2026-07-01T15:00:00.000Z"
  });
  transitionLead(state, lead.id, "Customer", {
    actorId: "founder",
    occurredAt: "2026-07-02T18:00:00.000Z"
  });

  assert.equal(lead.status, "Customer");
  assert.deepEqual(lead.statusHistory.map(item => item.to), [
    "New Lead",
    "Contacted",
    "Follow-up Required",
    "Appointment Scheduled",
    "Proposal",
    "Customer"
  ]);
  assert.equal(state.followUps.length, 1);
  assert.ok(state.salesActivities.some(activity => activity.type === "lead_status_changed" && activity.metadata.to === "Customer"));
});

test("follow-up generation creates matching follow-up and rep task from route visit outcome", () => {
  const state = createCrmState({ now: "2026-06-30T09:00:00.000Z" });
  const runtimeRecord = anthonyRuntimeRecord();
  const lead = createLeadFromRuntimeRecord(state, runtimeRecord, { priority: "medium" });

  const visit = recordRouteVisit(state, {
    leadId: lead.id,
    repId: "anthony",
    routeRecordId: runtimeRecord.id,
    googlePlaceId: runtimeRecord.googlePlaceId,
    outcome: "follow_up_requested",
    notes: "Owner was interested but asked for tomorrow.",
    visitedAt: "2026-06-30T11:30:00.000Z",
    followUpDueAt: "2026-07-01T14:00:00.000Z",
    followUpPriority: "high"
  });

  assert.equal(visit.outcome, "follow_up_requested");
  assert.equal(lead.status, "Follow-up Required");
  assert.equal(state.followUps.length, 1);
  assert.equal(state.followUps[0].assignedTo, "anthony");
  assert.equal(state.tasks.length, 1);
  assert.equal(state.tasks[0].type, "follow_up");
  assert.equal(state.tasks[0].queue, "rep");
  assert.equal(state.tasks[0].sourceFollowUpId, state.followUps[0].id);
});

test("follow-up queue orders overdue and high-priority items before lower-risk work", () => {
  const state = createCrmState({ now: "2026-06-30T12:00:00.000Z" });
  const first = createLeadFromRuntimeRecord(state, anthonyRuntimeRecord(0));
  const second = createLeadFromRuntimeRecord(state, anthonyRuntimeRecord(1));
  const third = createLeadFromRuntimeRecord(state, anthonyRuntimeRecord(2));

  createFollowUp(state, {
    leadId: first.id,
    assignedTo: "anthony",
    dueAt: "2026-06-30T18:00:00.000Z",
    priority: "urgent",
    reason: "Same-day owner callback."
  });
  createFollowUp(state, {
    leadId: second.id,
    assignedTo: "anthony",
    dueAt: "2026-06-30T10:00:00.000Z",
    priority: "medium",
    reason: "Past-due morning callback."
  });
  createFollowUp(state, {
    leadId: third.id,
    assignedTo: "founder",
    dueAt: "2026-07-01T09:00:00.000Z",
    priority: "low",
    reason: "Founder review later."
  });

  const queue = buildFollowUpQueue(state, { asOf: "2026-06-30T12:00:00.000Z" });

  assert.equal(queue[0].leadId, second.id);
  assert.equal(queue[0].overdue, true);
  assert.equal(queue[1].leadId, first.id);
  assert.equal(queue[2].assignedTo, "founder");
});

test("task assignment supports founder and rep queues with completion status", () => {
  const state = createCrmState({ now: "2026-06-30T09:00:00.000Z" });
  const lead = createLeadFromRuntimeRecord(state, anthonyRuntimeRecord());
  const repFollowUp = createFollowUp(state, {
    leadId: lead.id,
    assignedTo: "anthony",
    dueAt: "2026-06-30T12:00:00.000Z",
    priority: "high",
    reason: "Rep needs to call back."
  });
  createFollowUp(state, {
    leadId: lead.id,
    assignedTo: "founder",
    dueAt: "2026-06-30T15:00:00.000Z",
    priority: "medium",
    reason: "Founder should review lead quality."
  });

  completeTask(state, repFollowUp.taskId, {
    actorId: "anthony",
    completedAt: "2026-06-30T12:20:00.000Z"
  });

  const founderTasks = buildTaskQueue(state, { queue: "founder", asOf: "2026-06-30T13:00:00.000Z" });
  const repTasks = buildTaskQueue(state, { queue: "rep", asOf: "2026-06-30T13:00:00.000Z" });
  const reports = buildCrmReports(state, { asOf: "2026-06-30T13:00:00.000Z" });

  assert.equal(founderTasks.length, 1);
  assert.equal(repTasks.length, 0);
  assert.equal(reports.taskCompletionStatus.completed, 1);
  assert.equal(reports.taskCompletionStatus.founderOpen, 1);
});

test("visit history integrity keeps contact and lead histories aligned", () => {
  const state = createCrmState({ now: "2026-06-30T09:00:00.000Z" });
  const runtimeRecord = anthonyRuntimeRecord();
  const lead = createLeadFromRuntimeRecord(state, runtimeRecord);
  const contact = state.contacts[0];

  addContactNote(state, contact.id, {
    actorId: "anthony",
    body: "Front desk said mornings are best.",
    occurredAt: "2026-06-30T10:45:00.000Z"
  });
  const visit = recordRouteVisit(state, {
    leadId: lead.id,
    repId: "anthony",
    routeRecordId: runtimeRecord.id,
    outcome: "appointment_scheduled",
    notes: "Manager booked a slot.",
    visitedAt: "2026-06-30T11:00:00.000Z"
  });

  assert.equal(contact.visitHistory.length, 1);
  assert.equal(lead.visitHistory.length, 1);
  assert.deepEqual(contact.visitHistory[0], lead.visitHistory[0]);
  assert.equal(contact.visitHistory[0].id, visit.id);
  assert.equal(contact.visitHistory[0].googlePlaceId, runtimeRecord.googlePlaceId);
  assert.equal(contact.notes.length, 1);
  assert.equal(lead.status, "Appointment Scheduled");
});

test("CRM reports expose today's follow-ups, overdue follow-ups, Anthony activity, and pipeline counts", () => {
  const state = createCrmState({ now: "2026-06-30T09:00:00.000Z" });
  const todayLead = createLeadFromRuntimeRecord(state, anthonyRuntimeRecord(0));
  const overdueLead = createLeadFromRuntimeRecord(state, anthonyRuntimeRecord(1));

  createFollowUp(state, {
    leadId: todayLead.id,
    assignedTo: "anthony",
    dueAt: "2026-06-30T16:00:00.000Z",
    priority: "high",
    reason: "Today callback."
  });
  createFollowUp(state, {
    leadId: overdueLead.id,
    assignedTo: "founder",
    dueAt: "2026-06-29T17:00:00.000Z",
    priority: "urgent",
    reason: "Founder missed review."
  });
  transitionLead(state, todayLead.id, "Contacted", {
    actorId: "anthony",
    occurredAt: "2026-06-30T10:00:00.000Z"
  });

  const reports = buildCrmReports(state, { asOf: "2026-06-30T12:00:00.000Z" });

  assert.equal(reports.todaysFollowUps.length, 1);
  assert.equal(reports.overdueFollowUps.length, 1);
  assert.ok(reports.anthonyBetaActivity.length >= 3);
  assert.equal(reports.founderActivitySummary.visibleContacts, 2);
  assert.equal(reports.founderActivitySummary.pendingFollowUps, 2);
  assert.equal(reports.contactPipelineCounts.Contacted, 1);
  assert.equal(reports.contactPipelineCounts["New Lead"], 1);
});

test("CRM attaches Website/Social attribution output to lead records", () => {
  const state = createCrmState({ now: "2026-07-01T09:00:00.000Z" });
  const lead = createLeadFromRuntimeRecord(state, anthonyRuntimeRecord());
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  const websiteSession = createWebsiteAttributionSession({
    locationHref: "https://prometheusrouteiq.com/?utm_source=instagram&utm_medium=social&utm_campaign=beta-route-iq-awareness-v1&utm_content=route-proof",
    referrer: "https://l.instagram.com/",
    localStorage,
    sessionStorage,
    now: "2026-07-01T08:30:00.000Z"
  });

  const event = attachWebsiteAttributionToLead(state, lead.id, websiteSession, {
    occurredAt: "2026-07-01T09:05:00.000Z",
    manualNotes: "Website request pilot attribution."
  });

  assert.equal(lead.attribution.leadSource, "instagram");
  assert.equal(lead.attribution.campaignId, "beta-route-iq-awareness-v1");
  assert.equal(lead.attribution.campaignPlatform, "instagram");
  assert.equal(lead.attribution.firstTouchAt, "2026-07-01T08:30:00.000Z");
  assert.equal(lead.attribution.lastTouchAt, "2026-07-01T08:30:00.000Z");
  assert.equal(lead.attribution.qualifiedStatus, "New Lead");
  assert.equal(lead.attribution.manualNotes, "Website request pilot attribution.");
  assert.equal(event.type, SOCIAL_ATTRIBUTION_EVENT_TYPES.CRM_LEAD_CREATED);
  assert.equal(event.target, SOCIAL_ATTRIBUTION_TARGETS.CRM_LEAD);
  assert.equal(event.source, SOCIAL_DATA_SOURCES.CRM_CONTRACT);
  assert.equal(event.leadId, lead.id);
  assert.equal(event.metadata.utm_source, "instagram");
  assert.equal(event.metadata.landing_path, "/");
  assert.equal(state.attributionEvents.length, 1);
  assert.ok(state.salesActivities.some(activity => activity.type === "lead_attribution_attached"));
});

test("CRM preserves first-touch and last-touch attribution from Website sessions", () => {
  const state = createCrmState({ now: "2026-07-01T09:00:00.000Z" });
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  createWebsiteAttributionSession({
    locationHref: "https://prometheusrouteiq.com/?utm_source=instagram&utm_medium=social&utm_campaign=first-campaign",
    localStorage,
    sessionStorage,
    now: "2026-07-01T08:00:00.000Z"
  });
  const secondSession = createWebsiteAttributionSession({
    locationHref: "https://prometheusrouteiq.com/pilot?utm_source=linkedin&utm_medium=social&utm_campaign=second-campaign",
    localStorage,
    sessionStorage,
    now: "2026-07-01T09:00:00.000Z"
  });

  const lead = createLeadFromRuntimeRecord(state, anthonyRuntimeRecord(1), {
    attribution: secondSession,
    attributionManualNotes: "Lead created after second campaign touch."
  });

  assert.equal(lead.attribution.leadSource, "linkedin");
  assert.equal(lead.attribution.campaignId, "second-campaign");
  assert.equal(lead.attribution.firstTouchAt, "2026-07-01T08:00:00.000Z");
  assert.equal(lead.attribution.lastTouchAt, "2026-07-01T09:00:00.000Z");
  assert.equal(lead.attribution.firstTouchEventId, secondSession.firstTouch.id);
  assert.equal(lead.attribution.lastTouchEventId, secondSession.currentTouch.id);
  assert.equal(state.attributionEvents[0].metadata.manual_notes, "Lead created after second campaign touch.");
});

test("CRM rejects non-Website attribution targets instead of creating a parallel attribution model", () => {
  const state = createCrmState({ now: "2026-07-01T09:00:00.000Z" });
  const lead = createLeadFromRuntimeRecord(state, anthonyRuntimeRecord());

  assert.throws(() => attachWebsiteAttributionToLead(state, lead.id, {
    id: "not_website",
    type: "crm_lead_created",
    target: "crm_lead",
    source: "crm_contract",
    occurredAt: "2026-07-01T09:00:00.000Z",
    metadata: {}
  }), /requires Website attribution target website_traffic/);
});
