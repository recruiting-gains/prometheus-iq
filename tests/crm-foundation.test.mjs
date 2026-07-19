import test from "node:test";
import assert from "node:assert/strict";
import {
  addContactNote,
  attachWebsiteAttributionToLead,
  applyCrmOperatingProfileToLead,
  buildCrmReports,
  buildCrmOperatingProfile,
  buildFollowUpQueue,
  buildTaskQueue,
  completeTask,
  consumeWorkspaceLeadIntakeHandoff,
  crmWorkspaceLeadPersistencePrefix,
  createCrmState,
  createFollowUp,
  createLeadFromRuntimeRecord,
  dashboardRuntimeRecordsFromActivePool,
  loadRuntimeActivePool,
  recordProfileOutcomeForLead,
  recordRouteVisit,
  persistWorkspaceLeadIntakeHandoff,
  transitionLeadProfileStage,
  transitionLead
} from "../crm/crm-foundation.mjs";
import {
  SOCIAL_ATTRIBUTION_EVENT_TYPES,
  SOCIAL_ATTRIBUTION_TARGETS,
  SOCIAL_DATA_SOURCES,
  createAttributionEvent
} from "../social-media/contracts/social-media-contract.js";

const websiteAttributionVersion = "prometheus-website-attribution.v1";

function canonicalWebsiteAttributionSession({
  visitorId,
  sessionId,
  firstTouch,
  currentTouch = firstTouch
}) {
  assert.match(visitorId, /^web_visitor_[a-z0-9_]+$/);
  assert.match(sessionId, /^web_session_[a-z0-9_]+$/);

  const canonicalTouch = (touch, label) => {
    assert.match(touch.id, /^website_visit_[a-z0-9_]+$/, `${label} id must be canonical`);
    assert.match(touch.provider, /^(instagram|linkedin)$/);
    assert.match(touch.campaignId, /^[a-z0-9-]+$/);

    return createAttributionEvent({
      id: touch.id,
      type: SOCIAL_ATTRIBUTION_EVENT_TYPES.WEBSITE_VISIT,
      target: SOCIAL_ATTRIBUTION_TARGETS.WEBSITE_TRAFFIC,
      source: SOCIAL_DATA_SOURCES.WEBSITE_CONTRACT,
      provider: touch.provider,
      campaignId: touch.campaignId,
      occurredAt: touch.occurredAt,
      visitorId,
      confidence: 1,
      metadata: {
        attribution_version: websiteAttributionVersion,
        session_id: sessionId,
        utm_source: touch.provider,
        utm_medium: "social",
        utm_campaign: touch.campaignId,
        utm_content: touch.content || "",
        utm_term: "",
        campaign_id: "",
        campaign_platform: touch.provider,
        landing_path: touch.landingPath || "/",
        referrer: touch.referrer || ""
      }
    });
  };

  const normalizedFirstTouch = canonicalTouch(firstTouch, "first touch");
  const normalizedCurrentTouch = currentTouch === firstTouch
    ? normalizedFirstTouch
    : canonicalTouch(currentTouch, "current touch");

  return {
    version: websiteAttributionVersion,
    visitorId,
    sessionId,
    startedAt: normalizedFirstTouch.occurredAt,
    firstTouch: normalizedFirstTouch,
    currentTouch: normalizedCurrentTouch
  };
}

function memoryKvStore() {
  const items = new Map();
  return {
    items,
    async put(key, value, options = {}) {
      items.set(key, { value: String(value), options });
    },
    readJson(key) {
      const item = items.get(key);
      return item ? JSON.parse(item.value) : null;
    }
  };
}

function canonicalWorkspaceIntakeRecord(input = {}) {
  const workspaceId = input.workspaceId || "fitness_connection";
  const workspaces = {
    fitness_connection: {
      workspaceName: "Fitness Connection",
      operatingProfileId: "fitness",
      operatingProfileLabel: "Fitness",
      crmWorkspacePath: "crm://workspace/fitness_connection/leads"
    },
    smoothie_depot: {
      workspaceName: "Smoothie Depot",
      operatingProfileId: "franchise_development",
      operatingProfileLabel: "Franchise Development",
      crmWorkspacePath: "crm://workspace/smoothie_depot/candidate_pipeline"
    }
  };
  const workspace = workspaces[workspaceId];
  assert.ok(workspace, `Unsupported canonical workspace fixture: ${workspaceId}`);

  const now = input.now || "2026-07-04T14:00:00.000Z";
  const submissionId = `sub_test_${workspaceId}`;
  const campaignId = input.campaignId || "workspace-intake-test";
  const leadSource = input.leadSource || "partner_intake";
  const companyName = input.companyName || "Workspace Candidate Co";
  const requesterName = input.contactName || "Jordan Candidate";
  const contactMethod = input.contactMethod || "jordan@example.com";
  const handoffId = `crm_handoff_test_${workspaceId}`;
  const attributionEvent = createAttributionEvent({
    id: `crm_attr_test_${workspaceId}`,
    type: SOCIAL_ATTRIBUTION_EVENT_TYPES.CRM_LEAD_CREATED,
    target: SOCIAL_ATTRIBUTION_TARGETS.CRM_LEAD,
    source: SOCIAL_DATA_SOURCES.CRM_CONTRACT,
    provider: "website",
    campaignId,
    occurredAt: now,
    visitorId: `web_visitor_test_${workspaceId}`,
    confidence: 1,
    metadata: {
      lead_source: leadSource,
      campaign_platform: "website",
      first_touch_at: now,
      last_touch_at: now,
      qualified_status: "New Lead",
      website_first_touch_event_id: `website_visit_test_${workspaceId}`,
      website_last_touch_event_id: `website_visit_test_${workspaceId}`,
      website_attribution_version: websiteAttributionVersion,
      utm_source: input.utmSource || "website",
      utm_medium: "test",
      utm_campaign: campaignId,
      landing_path: "/partner-intake"
    }
  });

  const attribution = {
    provider: "website",
    campaignId,
    leadSource,
    landingPath: "/partner-intake",
    utm: {
      source: input.utmSource || "website",
      medium: "test",
      campaign: campaignId,
      content: "",
      term: ""
    }
  };
  const lead = {
    id: `web_lead_test_${workspaceId}`,
    source: "website_enterprise_intake",
    status: "New Lead",
    pipelineStage: "Website Request",
    requestType: input.requestType || "growth_partner",
    requestLabel: "Growth Partner",
    companyName,
    companyWebsite: input.companyWebsite || "https://example.com",
    requesterName,
    requesterRole: "Business owner",
    contactMethod,
    operatingProfile: {
      profileId: workspace.operatingProfileId,
      profileLabel: workspace.operatingProfileLabel,
      crmProfileId: workspace.operatingProfileId,
      requestedProfile: workspace.operatingProfileLabel,
      futureProfileRequested: false
    },
    teamSize: "2",
    fieldRepCount: "1",
    locationCount: input.locationCount || "2",
    territory: input.geographicTerritory || "Houston",
    primaryGoal: input.primaryGoal || "Explore Prometheus workspace lead intake.",
    currentWorkflow: input.currentWorkflow || "Submitted through shared workspace partner intake.",
    message: "",
    founderVisible: true,
    dueAt: "",
    workspaceId,
    workspaceName: workspace.workspaceName
  };
  const crmIntegration = {
    path: "Lead -> Operating Profile -> CRM -> Pipeline",
    crmContract: "existing_crm_attribution_contract",
    leadStatus: "New Lead",
    pipelineStage: lead.pipelineStage,
    operatingProfileId: workspace.operatingProfileId,
    workspaceId,
    attributionEvent
  };

  return {
    ok: true,
    version: "shared-workspace-lead-intake.v1",
    submissionId,
    timestamp: now,
    workspace: {
      workspaceId,
      workspaceName: workspace.workspaceName
    },
    operatingProfile: {
      id: workspace.operatingProfileId,
      label: workspace.operatingProfileLabel
    },
    attribution,
    source: leadSource,
    status: "received",
    security: {
      spamProtected: true,
      validationPassed: true,
      workspaceIsolation: "enforced",
      crossWorkspaceRouting: false
    },
    crmHandoff: {
      status: "prepared",
      mutationPerformed: false,
      ownerSubsystem: "Prometheus CRM",
      contract: "shared_workspace_crm_lead_intake_packet.v1",
      workspaceId,
      crmWorkspacePath: workspace.crmWorkspacePath,
      handoffId,
      preparedAt: now,
      packet: {
        lead,
        crmIntegration,
        attribution
      }
    },
    auditTrail: [
      { at: now, actor: "prometheus_infrastructure", event: "submission_received", source: leadSource },
      { at: now, actor: "workspace_router", event: "workspace_routed", workspaceId },
      { at: now, actor: "validation", event: "validation_passed" },
      { at: now, actor: "spam_protection", event: "spam_checks_passed" },
      { at: now, actor: "durable_storage", event: "submission_record_prepared", workspaceId },
      { at: now, actor: "crm_handoff", event: "workspace_crm_handoff_prepared", workspaceId, mutationPerformed: false }
    ]
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
  const websiteSession = canonicalWebsiteAttributionSession({
    visitorId: "web_visitor_crm_attribution",
    sessionId: "web_session_crm_attribution",
    firstTouch: {
      id: "website_visit_crm_attribution",
      provider: "instagram",
      campaignId: "beta-route-iq-awareness-v1",
      occurredAt: "2026-07-01T08:30:00.000Z",
      content: "route-proof",
      landingPath: "/",
      referrer: "https://l.instagram.com/"
    }
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
  const secondSession = canonicalWebsiteAttributionSession({
    visitorId: "web_visitor_crm_multi_touch",
    sessionId: "web_session_crm_multi_touch",
    firstTouch: {
      id: "website_visit_crm_first_touch",
      provider: "instagram",
      campaignId: "first-campaign",
      occurredAt: "2026-07-01T08:00:00.000Z",
      landingPath: "/"
    },
    currentTouch: {
      id: "website_visit_crm_last_touch",
      provider: "linkedin",
      campaignId: "second-campaign",
      occurredAt: "2026-07-01T09:00:00.000Z",
      landingPath: "/pilot"
    }
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

test("CRM preserves Fitness as the default operating profile", () => {
  const state = createCrmState({ now: "2026-07-02T09:00:00.000Z" });
  const lead = createLeadFromRuntimeRecord(state, anthonyRuntimeRecord());

  assert.equal(state.operatingProfile.profileId, "fitness");
  assert.equal(state.operatingProfile.profileLabel, "Fitness");
  assert.equal(lead.operatingProfileId, "fitness");
  assert.equal(lead.profileTerminology.customer, "member");
  assert.equal(lead.profileTerminology.target, "gym prospect");
  assert.equal(lead.profileStage, "Gym Prospect");
  assert.equal(lead.status, "New Lead");
  assert.deepEqual(buildCrmOperatingProfile().crmStages, [
    "Gym Prospect",
    "Visited",
    "Manager Reached",
    "Trial/Tour",
    "Membership Sold",
    "Not Fit"
  ]);
});

test("CRM consumes Intelligence Operating Profile contracts for required example profiles", () => {
  const cases = [
    {
      profileId: "fitness",
      expectedStage: "Manager Reached",
      rawOutcome: "membership",
      normalizedOutcome: "sale",
      targetTerm: "gym prospect"
    },
    {
      profileId: "roofing",
      expectedStage: "Inspection Scheduled",
      rawOutcome: "inspection",
      normalizedOutcome: "inspection",
      targetTerm: "property lead"
    },
    {
      profileId: "security",
      expectedStage: "Survey Scheduled",
      rawOutcome: "site survey",
      normalizedOutcome: "inspection",
      targetTerm: "security prospect"
    },
    {
      profileId: "medical",
      expectedStage: "Provider Reached",
      rawOutcome: "referral",
      normalizedOutcome: "referral",
      targetTerm: "provider prospect"
    },
    {
      profileId: "general_outside_sales",
      expectedStage: "Qualified",
      rawOutcome: "contract",
      normalizedOutcome: "contract",
      targetTerm: "prospect"
    }
  ];

  cases.forEach((item, index) => {
    const state = createCrmState({
      now: "2026-07-02T09:00:00.000Z",
      operatingProfileId: item.profileId
    });
    const lead = createLeadFromRuntimeRecord(state, anthonyRuntimeRecord(index), {
      operatingProfileId: item.profileId
    });
    const operatingProfile = buildCrmOperatingProfile(item.profileId);

    assert.equal(operatingProfile.profileId, item.profileId);
    assert.equal(operatingProfile.runtimeMutationAuthorized, false);
    assert.equal(lead.profileTerminology.target, item.targetTerm);
    assert.equal(lead.profileStage, operatingProfile.crmStages[0]);

    transitionLeadProfileStage(state, lead.id, item.expectedStage, {
      occurredAt: "2026-07-02T10:00:00.000Z"
    });
    const outcome = recordProfileOutcomeForLead(state, {
      leadId: lead.id,
      rawOutcome: item.rawOutcome,
      occurredAt: "2026-07-02T10:30:00.000Z"
    });
    const reports = buildCrmReports(state, { asOf: "2026-07-02T11:00:00.000Z" });

    assert.equal(lead.profileStage, item.expectedStage);
    assert.equal(outcome.normalizedOutcome, item.normalizedOutcome);
    assert.equal(outcome.recommendationChanged, false);
    assert.equal(outcome.productionLearningActive, false);
    assert.equal(reports.profilePipelineCounts[item.profileId][item.expectedStage], 1);
  });
});

test("CRM can apply a new operating profile to an existing lead without duplicate lead creation", () => {
  const state = createCrmState({ now: "2026-07-02T09:00:00.000Z" });
  const lead = createLeadFromRuntimeRecord(state, anthonyRuntimeRecord());

  applyCrmOperatingProfileToLead(state, lead.id, "roofing", {
    occurredAt: "2026-07-02T09:15:00.000Z"
  });

  assert.equal(state.leads.length, 1);
  assert.equal(lead.operatingProfileId, "roofing");
  assert.equal(lead.profileTerminology.target, "property lead");
  assert.equal(lead.profileStage, "Property Lead");
  assert.equal(lead.profileStageHistory.at(-1).profileId, "roofing");
});

test("CRM rejects stages outside the active operating profile", () => {
  const state = createCrmState({
    now: "2026-07-02T09:00:00.000Z",
    operatingProfileId: "medical"
  });
  const lead = createLeadFromRuntimeRecord(state, anthonyRuntimeRecord(), {
    operatingProfileId: "medical"
  });

  assert.throws(() => transitionLeadProfileStage(state, lead.id, "Inspection Scheduled"), /Unknown CRM operating profile stage for medical/);
});

test("Smoothie Depot workspace intake creates CRM candidate handoff", async () => {
  const state = createCrmState({ now: "2026-07-04T14:10:00.000Z" });
  const record = canonicalWorkspaceIntakeRecord({
    workspaceId: "smoothie_depot",
    companyName: "Houston Juice Group",
    contactName: "Sam Franchise",
    contactMethod: "sam@example.com",
    campaignId: "smoothie-depot-founder-sourcing",
    leadSource: "partner_intake",
    locationCount: "3"
  });

  const result = consumeWorkspaceLeadIntakeHandoff(state, record);

  assert.equal(result.ok, true);
  assert.equal(result.workspaceId, "smoothie_depot");
  assert.equal(result.targetType, "smoothie_depot_candidate_handoff");
  assert.equal(result.candidate.workspaceId, "smoothie_depot");
  assert.equal(result.candidate.submissionId, record.submissionId);
  assert.equal(result.candidate.handoffId, record.crmHandoff.handoffId);
  assert.equal(result.candidate.operatingProfileId, "franchise_development");
  assert.equal(result.candidate.pipeline, "smoothie_depot_franchise_candidate_pipeline");
  assert.equal(result.candidate.pipelineStage, "Contact Found");
  assert.equal(result.candidate.candidateName, "Sam Franchise");
  assert.equal(result.candidate.businessName, "Houston Juice Group");
  assert.equal(result.candidate.email, "sam@example.com");
  assert.equal(result.candidate.numberOfLocationsDesired, 3);
  assert.equal(result.candidate.attribution.campaignId, "smoothie-depot-founder-sourcing");
  assert.equal(result.audit.auditTrail.some(entry => entry.event === "workspace_crm_handoff_prepared"), true);
  assert.equal(state.workspaceCandidateHandoffs.length, 1);
  assert.equal(state.workspaceBusinessProspects.length, 1);
  assert.equal(state.contacts.length, 0);
  assert.equal(state.leads.length, 0);
});

test("Fitness Connection workspace intake creates CRM lead handoff", async () => {
  const state = createCrmState({ now: "2026-07-04T14:20:00.000Z" });
  const record = canonicalWorkspaceIntakeRecord({
    workspaceId: "fitness_connection",
    companyName: "Pearland Training Club",
    contactName: "Morgan Manager",
    contactMethod: "8325551212",
    campaignId: "fitness-connection-growth",
    leadSource: "partner_intake"
  });

  const result = consumeWorkspaceLeadIntakeHandoff(state, record);

  assert.equal(result.ok, true);
  assert.equal(result.workspaceId, "fitness_connection");
  assert.equal(result.targetType, "fitness_connection_lead");
  assert.equal(result.contact.workspaceId, "fitness_connection");
  assert.equal(result.lead.workspaceId, "fitness_connection");
  assert.equal(result.lead.submissionId, record.submissionId);
  assert.equal(result.lead.handoffId, record.crmHandoff.handoffId);
  assert.equal(result.lead.operatingProfileId, "fitness");
  assert.equal(result.lead.profileStage, "Gym Prospect");
  assert.equal(result.lead.status, "New Lead");
  assert.equal(result.lead.businessName, "Pearland Training Club");
  assert.equal(result.contact.phone, "8325551212");
  assert.equal(result.lead.attribution.campaignId, "fitness-connection-growth");
  assert.equal(result.audit.auditTrail.some(entry => entry.event === "workspace_crm_handoff_prepared"), true);
  assert.equal(state.contacts.length, 1);
  assert.equal(state.leads.length, 1);
  assert.equal(state.workspaceLeadHandoffs.length, 1);
  assert.equal(state.workspaceCandidateHandoffs.length, 0);
});

test("Workspace intake unknown workspace fails closed without CRM mutation", () => {
  const state = createCrmState({ now: "2026-07-04T14:30:00.000Z" });

  assert.throws(() => consumeWorkspaceLeadIntakeHandoff(state, {
    status: "prepared",
    mutationPerformed: false,
    ownerSubsystem: "Prometheus CRM",
    contract: "shared_workspace_crm_lead_intake_packet.v1",
    workspaceId: "unknown_workspace",
    handoffId: "crm_handoff_unknown",
    preparedAt: "2026-07-04T14:30:00.000Z",
    packet: {
      lead: {
        workspaceId: "unknown_workspace",
        companyName: "Unknown Co",
        requesterName: "Unknown Person",
        contactMethod: "unknown@example.com"
      },
      crmIntegration: {
        workspaceId: "unknown_workspace",
        operatingProfileId: "general_outside_sales"
      },
      attribution: {}
    },
    submissionId: "sub_unknown"
  }), /Unknown CRM workspace intake workspace: unknown_workspace/);

  assert.equal(state.contacts.length, 0);
  assert.equal(state.leads.length, 0);
  assert.equal(state.workspaceCandidateHandoffs.length, 0);
  assert.equal(state.workspaceLeadIntakeHandoffs.length, 0);
});

test("Workspace intake rejects cross-workspace contamination", async () => {
  const state = createCrmState({ now: "2026-07-04T14:40:00.000Z" });
  const record = canonicalWorkspaceIntakeRecord({
    workspaceId: "fitness_connection",
    companyName: "Cross Workspace Gym",
    contactName: "Casey Contact"
  });
  const contaminated = {
    ...record,
    crmHandoff: {
      ...record.crmHandoff,
      packet: {
        ...record.crmHandoff.packet,
        lead: {
          ...record.crmHandoff.packet.lead,
          workspaceId: "smoothie_depot"
        }
      }
    }
  };

  assert.throws(() => consumeWorkspaceLeadIntakeHandoff(state, contaminated), /cross-workspace contamination/);
  assert.equal(state.contacts.length, 0);
  assert.equal(state.leads.length, 0);
  assert.equal(state.workspaceCandidateHandoffs.length, 0);
  assert.equal(state.workspaceLeadIntakeHandoffs.length, 0);
});

test("CRM persists Fitness Connection workspace lead records durably", async () => {
  const state = createCrmState({ now: "2026-07-04T15:00:00.000Z" });
  const store = memoryKvStore();
  const record = canonicalWorkspaceIntakeRecord({
    workspaceId: "fitness_connection",
    companyName: "League City Strength",
    contactName: "Taylor Owner",
    contactMethod: "taylor@example.com",
    campaignId: "fitness-durable-intake"
  });

  const result = await persistWorkspaceLeadIntakeHandoff(state, record, {
    store,
    persistedAt: "2026-07-04T15:05:00.000Z"
  });

  assert.equal(result.ok, true);
  assert.equal(result.record.workspace.workspaceId, "fitness_connection");
  assert.equal(result.record.leadId, result.consumed.lead.id);
  assert.equal(result.record.company, "League City Strength");
  assert.equal(result.record.contactName, "Taylor Owner");
  assert.equal(result.record.email, "taylor@example.com");
  assert.equal(result.record.phone, "");
  assert.equal(result.record.source, "partner_intake");
  assert.equal(result.record.submissionTimestamp, record.timestamp);
  assert.equal(result.record.status, "New Lead");
  assert.equal(result.record.assignedWorkspace.workspaceId, "fitness_connection");
  assert.equal(result.record.notes.includes("Submitted through shared workspace partner intake."), true);
  assert.equal(result.record.metadata.submissionId, record.submissionId);
  assert.equal(result.record.metadata.handoffId, record.crmHandoff.handoffId);
  assert.equal(result.record.metadata.operatingProfileId, "fitness");
  assert.equal(result.record.metadata.auditTrail.some(entry => entry.event === "workspace_crm_handoff_prepared"), true);
  assert.equal(result.record.storage.keys.record, `${crmWorkspaceLeadPersistencePrefix}/workspaces/fitness_connection/submissions/${record.submissionId}/lead.json`);
  assert.deepEqual(store.readJson(result.record.storage.keys.record), result.record);
  assert.equal(store.items.has(`${crmWorkspaceLeadPersistencePrefix}/workspaces/smoothie_depot/submissions/${record.submissionId}/lead.json`), false);
  assert.equal(state.workspaceLeadPersistenceRecords.length, 1);
});

test("CRM durable persistence blocks Smoothie Depot candidate records under current governance", async () => {
  const state = createCrmState({ now: "2026-07-04T15:10:00.000Z" });
  const store = memoryKvStore();
  const record = canonicalWorkspaceIntakeRecord({
    workspaceId: "smoothie_depot",
    companyName: "Cypress Smoothie Operators",
    contactName: "Riley Candidate",
    contactMethod: "7135550101",
    campaignId: "smoothie-durable-intake",
    locationCount: "4"
  });

  await assert.rejects(() => persistWorkspaceLeadIntakeHandoff(state, record, {
    store,
    persistedAt: "2026-07-04T15:15:00.000Z"
  }), error => {
    assert.equal(error.code, "crm_workspace_runtime_governance_blocked");
    assert.equal(error.status, 409);
    return true;
  });

  assert.equal(store.items.size, 0);
  assert.equal(state.workspaceCandidateHandoffs.length, 0);
  assert.equal(state.workspaceLeadPersistenceRecords.length, 0);
});

test("CRM workspace lead persistence fails closed for unknown workspace without writes", async () => {
  const state = createCrmState({ now: "2026-07-04T15:20:00.000Z" });
  const store = memoryKvStore();

  await assert.rejects(() => persistWorkspaceLeadIntakeHandoff(state, {
    status: "prepared",
    mutationPerformed: false,
    ownerSubsystem: "Prometheus CRM",
    contract: "shared_workspace_crm_lead_intake_packet.v1",
    workspaceId: "unknown_workspace",
    handoffId: "crm_handoff_unknown_persist",
    submissionId: "sub_unknown_persist",
    preparedAt: "2026-07-04T15:20:00.000Z",
    packet: {
      lead: {
        workspaceId: "unknown_workspace",
        companyName: "Unknown Persistent Co",
        requesterName: "Unknown Person",
        contactMethod: "unknown@example.com"
      },
      crmIntegration: {
        workspaceId: "unknown_workspace",
        operatingProfileId: "general_outside_sales"
      },
      attribution: {}
    }
  }, { store }), /Unknown CRM workspace intake workspace: unknown_workspace/);

  assert.equal(store.items.size, 0);
  assert.equal(state.workspaceLeadPersistenceRecords.length, 0);
  assert.equal(state.contacts.length, 0);
  assert.equal(state.leads.length, 0);
});

test("CRM workspace lead persistence is idempotent per workspace submission", async () => {
  const state = createCrmState({ now: "2026-07-04T15:30:00.000Z" });
  const store = memoryKvStore();
  const record = canonicalWorkspaceIntakeRecord({
    workspaceId: "fitness_connection",
    companyName: "Idempotent Fitness Lead",
    contactName: "Devon Lead"
  });

  const first = await persistWorkspaceLeadIntakeHandoff(state, record, {
    store,
    persistedAt: "2026-07-04T15:31:00.000Z"
  });
  const second = await persistWorkspaceLeadIntakeHandoff(state, record, {
    store,
    persistedAt: "2026-07-04T15:32:00.000Z"
  });

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.record.recordId, first.record.recordId);
  assert.equal(state.workspaceLeadPersistenceRecords.length, 1);
  assert.equal(state.contacts.length, 1);
  assert.equal(state.leads.length, 1);
});
