import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createAttributionEvent,
  SOCIAL_ATTRIBUTION_EVENT_TYPES,
  SOCIAL_ATTRIBUTION_TARGETS,
  SOCIAL_DATA_SOURCES
} from "../social-media/contracts/social-media-contract.js";
import {
  buildProfileConsumerContract,
  getOperatingProfile,
  loadOperatingProfileContracts,
  loadOperatingProfiles,
  normalizeIndustryOutcome
} from "../intelligence/operating-profile-engine.mjs";
import {
  normalizeWorkspaceLeadIntakeInput,
  persistWorkspaceLeadIntakeHandoffCore,
  workspaceLeadIntakeConsumerVersion
} from "./workspace-lead-persistence.mjs";

export {
  crmWorkspaceLeadPersistencePrefix,
  crmWorkspaceLeadPersistenceVersion,
  readPersistedWorkspaceLeadBySubmission,
  supportedWorkspaceLeadIntakeWorkspaces,
  validateWorkspaceLeadIntakeHandoff,
  workspaceLeadIntakeConsumerVersion
} from "./workspace-lead-persistence.mjs";

export const crmVersion = "beta-crm-contact-follow-up-queue-v1";
export const defaultCrmOperatingProfileId = "fitness";

export const smoothieDepotCandidatePipelineStages = [
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

export const leadStatuses = [
  "New Lead",
  "Contacted",
  "Follow-up Required",
  "Appointment Scheduled",
  "Proposal",
  "Customer",
  "Closed Lost"
];

export const followUpPriorities = ["urgent", "high", "medium", "low"];

export const routeVisitOutcomes = {
  not_available: {
    status: "Follow-up Required",
    followUpRequired: true,
    activity: "Visit logged: decision maker unavailable."
  },
  conversation: {
    status: "Contacted",
    followUpRequired: false,
    activity: "Visit logged: conversation completed."
  },
  follow_up_requested: {
    status: "Follow-up Required",
    followUpRequired: true,
    activity: "Visit logged: follow-up requested."
  },
  appointment_scheduled: {
    status: "Appointment Scheduled",
    followUpRequired: false,
    activity: "Visit logged: appointment scheduled."
  },
  proposal_requested: {
    status: "Proposal",
    followUpRequired: false,
    activity: "Visit logged: proposal requested."
  },
  became_customer: {
    status: "Customer",
    followUpRequired: false,
    activity: "Visit logged: customer won."
  },
  not_a_fit: {
    status: "Closed Lost",
    followUpRequired: false,
    activity: "Visit logged: closed lost."
  }
};

const repoRoot = resolve(import.meta.dirname, "..");
const defaultRuntimeActivePoolPath = "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json";
const founderId = "founder";
const anthonyRepId = "anthony";

function iso(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid CRM date: ${value}`);
  return date.toISOString();
}

function dateOnly(value) {
  return iso(value).slice(0, 10);
}

function stableId(prefix, parts) {
  const digest = createHash("sha256")
    .update(parts.filter(part => part !== undefined && part !== null).map(String).join("|"), "utf8")
    .digest("hex")
    .slice(0, 16);
  return `${prefix}_${digest}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function splitContactMethod(contactMethod = "") {
  const value = String(contactMethod || "").trim();
  if (!value) return { email: "", phone: "" };
  if (value.includes("@")) return { email: value, phone: "" };
  return { email: "", phone: value };
}

function ensureKnownLeadStatus(status) {
  if (!leadStatuses.includes(status)) throw new Error(`Unknown CRM lead status: ${status}`);
}

function ensureKnownPriority(priority) {
  if (!followUpPriorities.includes(priority)) throw new Error(`Unknown follow-up priority: ${priority}`);
}

function findById(items, id, label) {
  const item = items.find(candidate => candidate.id === id);
  if (!item) throw new Error(`Unknown ${label}: ${id}`);
  return item;
}

function addSalesActivity(state, input) {
  const occurredAt = iso(input.occurredAt || state.clock);
  const activity = {
    id: stableId("act", [input.leadId, input.contactId, input.type, occurredAt, input.summary]),
    leadId: input.leadId || "",
    contactId: input.contactId || "",
    actorId: input.actorId || founderId,
    type: input.type,
    occurredAt,
    summary: input.summary,
    metadata: input.metadata || {}
  };
  state.salesActivities.push(activity);
  if (input.contactId) {
    const contact = state.contacts.find(candidate => candidate.id === input.contactId);
    if (contact) contact.salesActivityHistory.push(activity);
  }
  return activity;
}

function addBetaActivity(state, input) {
  const occurredAt = iso(input.occurredAt || state.clock);
  const activity = {
    id: stableId("beta", [input.repId, input.leadId, input.contactId, input.type, occurredAt, input.summary]),
    repId: input.repId,
    testerName: input.repId === anthonyRepId ? "Anthony" : input.repId,
    type: input.type,
    leadId: input.leadId || "",
    contactId: input.contactId || "",
    occurredAt,
    summary: input.summary,
    founderVisible: true,
    metadata: input.metadata || {}
  };
  state.betaActivity.push(activity);
  return activity;
}

function emptyLeadAttribution() {
  return {
    leadSource: "",
    campaignId: "",
    campaignPlatform: "",
    provider: "",
    firstTouchAt: "",
    lastTouchAt: "",
    qualifiedStatus: "",
    manualNotes: "",
    websiteVisitorId: "",
    firstTouchEventId: "",
    lastTouchEventId: "",
    attributionEventId: ""
  };
}

function attributionTouch(input = {}) {
  if (input.currentTouch || input.firstTouch) {
    return {
      firstTouch: input.firstTouch || input.currentTouch,
      lastTouch: input.currentTouch || input.firstTouch,
      visitorId: input.visitorId || input.currentTouch?.visitorId || input.firstTouch?.visitorId || ""
    };
  }
  return {
    firstTouch: input,
    lastTouch: input,
    visitorId: input.visitorId || ""
  };
}

function normalizeWebsiteTouchEvent(event, label) {
  if (!event?.id) throw new Error(`CRM attribution requires a Website ${label} event id.`);
  if (event.target !== SOCIAL_ATTRIBUTION_TARGETS.WEBSITE_TRAFFIC) {
    throw new Error(`CRM attribution requires Website attribution target ${SOCIAL_ATTRIBUTION_TARGETS.WEBSITE_TRAFFIC}.`);
  }
  return event;
}

function leadSourceFromTouch(touch) {
  return touch.metadata?.utm_source || touch.metadata?.campaign_platform || touch.provider || "website";
}

function loadCrmOperatingProfile(profileId = defaultCrmOperatingProfileId, options = {}) {
  const registry = options.registry || loadOperatingProfiles();
  const contracts = options.contracts || loadOperatingProfileContracts();
  const profile = options.profile || getOperatingProfile(profileId || defaultCrmOperatingProfileId, registry);
  const contract = buildProfileConsumerContract(profile.profileId, "CRM", { registry, contracts, profile });
  return {
    contractVersion: contract.contractVersion,
    profileId: profile.profileId,
    profileLabel: profile.label,
    industry: profile.industry,
    status: contract.status,
    terminology: clone(profile.terminology || {}),
    crmStages: clone(contract.crmStages || profile.crmStages || []),
    outcomeVocabulary: clone(contract.outcomeVocabulary || profile.outcomeVocabulary || []),
    runtimeMutationAuthorized: contract.runtimeMutationAuthorized === true
  };
}

function crmOperatingProfileFor(state, profileId) {
  if (profileId) return loadCrmOperatingProfile(profileId);
  if (state.operatingProfile?.profileId) return loadCrmOperatingProfile(state.operatingProfile.profileId);
  return loadCrmOperatingProfile(defaultCrmOperatingProfileId);
}

function firstProfileStage(operatingProfile) {
  return operatingProfile.crmStages?.[0] || "Prospect";
}

function ensureKnownProfileStage(operatingProfile, stage) {
  if (!operatingProfile.crmStages.includes(stage)) {
    throw new Error(`Unknown CRM operating profile stage for ${operatingProfile.profileId}: ${stage}`);
  }
}

export function createCrmState(options = {}) {
  const now = iso(options.now || new Date());
  const operatingProfile = loadCrmOperatingProfile(options.operatingProfileId || defaultCrmOperatingProfileId);
  return {
    version: crmVersion,
    generatedAt: now,
    clock: now,
    operatingProfile,
    contacts: [],
    leads: [],
    followUps: [],
    tasks: [],
    salesActivities: [],
    betaActivity: [],
    attributionEvents: [],
    workspaceLeadIntakeHandoffs: [],
    workspaceCandidateHandoffs: [],
    workspaceBusinessProspects: [],
    workspaceLeadHandoffs: [],
    workspaceLeadPersistenceRecords: []
  };
}

function appendWorkspaceLeadIntakeAudit(state, normalized, result) {
  const consumedAt = iso(result.consumedAt || state.clock);
  const audit = {
    id: stableId("intake_audit", [normalized.workspaceId, normalized.submissionId, result.targetId, consumedAt]),
    consumerVersion: workspaceLeadIntakeConsumerVersion,
    workspaceId: normalized.workspaceId,
    submissionId: normalized.submissionId,
    handoffId: normalized.handoffId,
    targetType: result.targetType,
    targetId: result.targetId,
    consumedAt,
    sourceContract: normalized.handoff.contract || "shared_workspace_crm_lead_intake_packet.v1",
    sourceMutationPerformed: normalized.handoff.mutationPerformed === true,
    auditTrail: normalized.auditTrail,
    attribution: normalized.attribution,
    crmWorkspacePath: normalized.handoff.crmWorkspacePath || "",
    preservedOperatingProfileId: normalized.workspace.operatingProfileId,
    crossWorkspaceRouting: false
  };
  state.workspaceLeadIntakeHandoffs.push(audit);
  return audit;
}

function preserveWorkspaceLeadIntakeAttribution(state, normalized, targetLeadId, occurredAt) {
  const sourceEvent = normalized.attributionEvent;
  if (!sourceEvent?.id) return null;
  const attributionEvent = createAttributionEvent({
    ...sourceEvent,
    id: sourceEvent.id,
    type: sourceEvent.type || SOCIAL_ATTRIBUTION_EVENT_TYPES.CRM_LEAD_CREATED,
    target: sourceEvent.target || SOCIAL_ATTRIBUTION_TARGETS.CRM_LEAD,
    source: sourceEvent.source || SOCIAL_DATA_SOURCES.CRM_CONTRACT,
    occurredAt: sourceEvent.occurredAt || occurredAt,
    leadId: targetLeadId,
    metadata: {
      ...(sourceEvent.metadata || {}),
      original_lead_id: sourceEvent.leadId || "",
      workspace_id: normalized.workspaceId,
      submission_id: normalized.submissionId,
      handoff_id: normalized.handoffId,
      preserved_from: "shared_workspace_lead_intake"
    }
  });
  state.attributionEvents.push(attributionEvent);
  return attributionEvent;
}

function applyWorkspaceLeadAttribution(lead, attributionEvent, normalized) {
  const metadata = attributionEvent?.metadata || {};
  lead.attribution = {
    leadSource: metadata.lead_source || normalized.record?.source || normalized.lead.source || "",
    campaignId: attributionEvent?.campaignId || metadata.campaign_id || "",
    campaignPlatform: metadata.campaign_platform || attributionEvent?.provider || "",
    provider: attributionEvent?.provider || "",
    firstTouchAt: metadata.first_touch_at || attributionEvent?.occurredAt || "",
    lastTouchAt: metadata.last_touch_at || attributionEvent?.occurredAt || "",
    qualifiedStatus: metadata.qualified_status || lead.status || "",
    manualNotes: `Workspace intake submission ${normalized.submissionId}`,
    websiteVisitorId: attributionEvent?.visitorId || "",
    firstTouchEventId: metadata.website_first_touch_event_id || "",
    lastTouchEventId: metadata.website_last_touch_event_id || "",
    attributionEventId: attributionEvent?.id || ""
  };
}

function consumeFitnessConnectionLeadIntake(state, normalized, options = {}) {
  const now = iso(options.consumedAt || normalized.submittedAt || state.clock);
  const operatingProfile = loadCrmOperatingProfile("fitness");
  const contactMethod = splitContactMethod(normalized.lead.contactMethod);
  const contact = {
    id: stableId("contact", [normalized.workspaceId, normalized.submissionId, normalized.lead.companyName]),
    workspaceId: normalized.workspaceId,
    submissionId: normalized.submissionId,
    handoffId: normalized.handoffId,
    businessName: normalized.lead.companyName,
    displayName: normalized.lead.companyName,
    category: normalized.lead.requestLabel || "Fitness / Growth Lead",
    address: "",
    latitude: null,
    longitude: null,
    googlePlaceId: "",
    googleMapsUrl: "",
    source: "shared_workspace_lead_intake",
    sourceRuntimeRecordId: "",
    sourceDatasetVersion: "",
    sourcePool: "workspace_intake",
    sourceRepProfileId: "",
    ownerRepId: options.ownerRepId || founderId,
    prospectStatus: "New Lead",
    askFor: normalized.lead.requesterName,
    accessType: "workspace_intake",
    createdAt: now,
    updatedAt: now,
    founderVisible: true,
    contactMethod: normalized.lead.contactMethod || "",
    email: contactMethod.email,
    phone: contactMethod.phone,
    notes: [],
    visitHistory: [],
    salesActivityHistory: [],
    workspaceIntake: {
      version: workspaceLeadIntakeConsumerVersion,
      workspaceId: normalized.workspaceId,
      submissionId: normalized.submissionId,
      handoffId: normalized.handoffId,
      auditTrail: normalized.auditTrail
    },
    beta: {
      repId: options.ownerRepId || founderId,
      testerName: "Founder",
      source: "shared_workspace_lead_intake",
      founderVisible: true
    }
  };
  const lead = {
    id: stableId("lead", [contact.id, normalized.workspaceId, normalized.submissionId]),
    contactId: contact.id,
    workspaceId: normalized.workspaceId,
    submissionId: normalized.submissionId,
    handoffId: normalized.handoffId,
    businessName: contact.businessName,
    requesterName: normalized.lead.requesterName,
    requesterRole: normalized.lead.requesterRole || "",
    contactMethod: normalized.lead.contactMethod || "",
    companyWebsite: normalized.lead.companyWebsite || "",
    ownerRepId: contact.ownerRepId,
    source: "shared_workspace_lead_intake",
    sourceRuntimeRecordId: "",
    googlePlaceId: "",
    status: "New Lead",
    prospectStatus: "New Lead",
    operatingProfileId: operatingProfile.profileId,
    operatingProfileLabel: operatingProfile.profileLabel,
    profileTerminology: clone(operatingProfile.terminology),
    profileStage: firstProfileStage(operatingProfile),
    profileStageHistory: [{
      from: "",
      to: firstProfileStage(operatingProfile),
      actorId: options.actorId || founderId,
      occurredAt: now,
      profileId: operatingProfile.profileId,
      note: "Lead created from shared workspace lead intake handoff."
    }],
    profileOutcomeVocabulary: clone(operatingProfile.outcomeVocabulary),
    profileOutcomes: [],
    priority: options.priority || "medium",
    createdAt: now,
    updatedAt: now,
    founderVisible: true,
    dueAt: normalized.lead.dueAt ? iso(normalized.lead.dueAt) : "",
    attribution: emptyLeadAttribution(),
    notes: [],
    visitHistory: [],
    statusHistory: [{
      from: "",
      to: "New Lead",
      actorId: options.actorId || founderId,
      occurredAt: now,
      note: "Fitness Connection lead created from shared workspace lead intake."
    }],
    workspaceIntake: {
      version: workspaceLeadIntakeConsumerVersion,
      workspaceId: normalized.workspaceId,
      workspaceName: normalized.workspace.workspaceName,
      submissionId: normalized.submissionId,
      handoffId: normalized.handoffId,
      requestType: normalized.lead.requestType || "",
      requestLabel: normalized.lead.requestLabel || "",
      pipelineStage: normalized.lead.pipelineStage || "",
      primaryGoal: normalized.lead.primaryGoal || "",
      currentWorkflow: normalized.lead.currentWorkflow || "",
      auditTrail: normalized.auditTrail
    }
  };

  state.contacts.push(contact);
  state.leads.push(lead);
  const attributionEvent = preserveWorkspaceLeadIntakeAttribution(state, normalized, lead.id, now);
  applyWorkspaceLeadAttribution(lead, attributionEvent, normalized);
  const audit = appendWorkspaceLeadIntakeAudit(state, normalized, {
    targetType: "fitness_connection_lead",
    targetId: lead.id,
    consumedAt: now
  });
  state.workspaceLeadHandoffs.push({
    id: stableId("workspace_lead_handoff", [normalized.workspaceId, normalized.submissionId]),
    workspaceId: normalized.workspaceId,
    submissionId: normalized.submissionId,
    handoffId: normalized.handoffId,
    contactId: contact.id,
    leadId: lead.id,
    operatingProfileId: operatingProfile.profileId,
    pipeline: "fitness_growth_lead_pipeline",
    sourcePipelineStage: normalized.lead.pipelineStage || "",
    crmProfileStage: lead.profileStage,
    auditMetadata: audit,
    createdAt: now
  });
  addSalesActivity(state, {
    leadId: lead.id,
    contactId: contact.id,
    actorId: options.actorId || founderId,
    type: "workspace_lead_intake_consumed",
    occurredAt: now,
    summary: `Fitness Connection workspace intake created CRM lead handoff for ${contact.businessName}.`,
    metadata: {
      workspaceId: normalized.workspaceId,
      submissionId: normalized.submissionId,
      handoffId: normalized.handoffId
    }
  });
  return {
    ok: true,
    consumerVersion: workspaceLeadIntakeConsumerVersion,
    workspaceId: normalized.workspaceId,
    targetType: "fitness_connection_lead",
    contact,
    lead,
    attributionEvent,
    audit
  };
}

function consumeSmoothieDepotCandidateIntake(state, normalized, options = {}) {
  const now = iso(options.consumedAt || normalized.submittedAt || state.clock);
  const contactMethod = splitContactMethod(normalized.lead.contactMethod);
  const pipelineStage = contactMethod.email || contactMethod.phone ? "Contact Found" : "Business Identified";
  const candidateId = stableId("candidate", [normalized.workspaceId, normalized.submissionId, normalized.lead.companyName]);
  const businessProspectId = stableId("business_prospect", [normalized.workspaceId, normalized.submissionId, normalized.lead.companyName]);
  const attributionEvent = preserveWorkspaceLeadIntakeAttribution(state, normalized, candidateId, now);
  const candidate = {
    id: candidateId,
    workspaceId: normalized.workspaceId,
    workspaceName: normalized.workspace.workspaceName,
    submissionId: normalized.submissionId,
    handoffId: normalized.handoffId,
    operatingProfileId: "franchise_development",
    operatingProfileLabel: "Franchise Development",
    pipeline: "smoothie_depot_franchise_candidate_pipeline",
    pipelineStage,
    candidateName: normalized.lead.requesterName,
    businessName: normalized.lead.companyName,
    businessCategory: normalized.lead.requestLabel || "Franchise Development Candidate",
    phone: contactMethod.phone,
    email: contactMethod.email,
    website: normalized.lead.companyWebsite || "",
    address: "",
    source: normalized.record?.source || normalized.lead.source || "partner_intake",
    googleRating: null,
    reviewCount: null,
    ownerContactStatus: contactMethod.email || contactMethod.phone ? "contact_found" : "owner_research_needed",
    preferredTerritory: normalized.lead.territory || "",
    liquidCapitalSelfReported: "",
    netWorthSelfReported: "",
    creditRangeSelfReported: "",
    numberOfLocationsDesired: Number(normalized.lead.locationCount || 0) || null,
    readinessAssessmentStatus: "not_started",
    jrHandoffStatus: "not_ready",
    protectedCandidateStartDate: "",
    protectedCandidateExpirationDate: "",
    commissionForecast: null,
    nextFollowUpDate: normalized.lead.dueAt || "",
    notes: [
      normalized.lead.primaryGoal,
      normalized.lead.currentWorkflow,
      normalized.lead.message
    ].filter(Boolean).join("\n\n"),
    attribution: {
      eventId: attributionEvent?.id || "",
      provider: attributionEvent?.provider || "",
      campaignId: attributionEvent?.campaignId || "",
      leadSource: attributionEvent?.metadata?.lead_source || "",
      visitorId: attributionEvent?.visitorId || ""
    },
    auditMetadata: {
      consumerVersion: workspaceLeadIntakeConsumerVersion,
      sourceContract: normalized.handoff.contract || "shared_workspace_crm_lead_intake_packet.v1",
      submittedAt: normalized.submittedAt,
      consumedAt: now,
      auditTrail: normalized.auditTrail,
      mutationPerformedByInfrastructure: normalized.handoff.mutationPerformed === true
    },
    founderVisible: true,
    createdAt: now,
    updatedAt: now
  };
  const businessProspect = {
    id: businessProspectId,
    workspaceId: normalized.workspaceId,
    submissionId: normalized.submissionId,
    candidateId,
    businessName: candidate.businessName,
    businessCategory: candidate.businessCategory,
    website: candidate.website,
    address: candidate.address,
    source: candidate.source,
    googleRating: candidate.googleRating,
    reviewCount: candidate.reviewCount,
    ownershipResearchStatus: candidate.ownerContactStatus,
    territoryFitNotes: candidate.preferredTerritory,
    researchEvidenceRefs: [normalized.handoffId, normalized.submissionId],
    createdAt: now,
    updatedAt: now
  };

  state.workspaceCandidateHandoffs.push(candidate);
  state.workspaceBusinessProspects.push(businessProspect);
  const audit = appendWorkspaceLeadIntakeAudit(state, normalized, {
    targetType: "smoothie_depot_candidate_handoff",
    targetId: candidate.id,
    consumedAt: now
  });
  addSalesActivity(state, {
    actorId: options.actorId || founderId,
    type: "workspace_candidate_intake_consumed",
    occurredAt: now,
    summary: `Smoothie Depot workspace intake created candidate handoff for ${candidate.businessName}.`,
    metadata: {
      workspaceId: normalized.workspaceId,
      submissionId: normalized.submissionId,
      handoffId: normalized.handoffId,
      candidateId: candidate.id,
      pipelineStage
    }
  });
  return {
    ok: true,
    consumerVersion: workspaceLeadIntakeConsumerVersion,
    workspaceId: normalized.workspaceId,
    targetType: "smoothie_depot_candidate_handoff",
    candidate,
    businessProspect,
    attributionEvent,
    audit
  };
}

export function consumeWorkspaceLeadIntakeHandoff(state, input = {}, options = {}) {
  const normalized = normalizeWorkspaceLeadIntakeInput(input);
  const existing = state.workspaceLeadIntakeHandoffs.find(handoff => {
    return handoff.workspaceId === normalized.workspaceId && handoff.submissionId === normalized.submissionId;
  });
  if (existing) {
    return {
      ok: true,
      consumerVersion: workspaceLeadIntakeConsumerVersion,
      workspaceId: normalized.workspaceId,
      targetType: existing.targetType,
      duplicate: true,
      audit: existing
    };
  }

  if (normalized.workspace.target === "candidate") {
    return consumeSmoothieDepotCandidateIntake(state, normalized, options);
  }
  return consumeFitnessConnectionLeadIntake(state, normalized, options);
}

function consumedWorkspaceLeadIntakeFromAudit(state, audit) {
  if (!audit) return null;
  if (audit.targetType === "fitness_connection_lead") {
    const lead = state.leads.find(candidate => candidate.id === audit.targetId);
    const contact = lead ? state.contacts.find(candidate => candidate.id === lead.contactId) : null;
    if (!lead) return null;
    return {
      ok: true,
      consumerVersion: workspaceLeadIntakeConsumerVersion,
      workspaceId: audit.workspaceId,
      targetType: audit.targetType,
      duplicate: true,
      contact,
      lead,
      attributionEvent: state.attributionEvents.find(event => event.leadId === lead.id) || null,
      audit
    };
  }
  if (audit.targetType === "smoothie_depot_candidate_handoff") {
    const candidate = state.workspaceCandidateHandoffs.find(item => item.id === audit.targetId);
    if (!candidate) return null;
    return {
      ok: true,
      consumerVersion: workspaceLeadIntakeConsumerVersion,
      workspaceId: audit.workspaceId,
      targetType: audit.targetType,
      duplicate: true,
      candidate,
      businessProspect: state.workspaceBusinessProspects.find(item => item.candidateId === candidate.id) || null,
      attributionEvent: state.attributionEvents.find(event => event.leadId === candidate.id) || null,
      audit
    };
  }
  return null;
}

export async function persistWorkspaceLeadIntakeHandoff(state, input = {}, options = {}) {
  return persistWorkspaceLeadIntakeHandoffCore(state, input, {
    ...options,
    consumeWorkspaceLeadIntake: (_state, _input, coreOptions, normalized) => {
      const existingAudit = state.workspaceLeadIntakeHandoffs.find(handoff => {
        return handoff.workspaceId === normalized.workspaceId && handoff.submissionId === normalized.submissionId;
      });
      return consumedWorkspaceLeadIntakeFromAudit(state, existingAudit)
        || consumeWorkspaceLeadIntakeHandoff(state, input, coreOptions);
    },
    recordActivity: ({ normalized, consumed, record }) => {
      addSalesActivity(state, {
        leadId: consumed.lead?.id || "",
        contactId: consumed.contact?.id || "",
        actorId: options.actorId || founderId,
        type: "workspace_lead_intake_persisted",
        occurredAt: record.storage.persistedAt,
        summary: `Workspace lead intake persisted for ${record.company}.`,
        metadata: {
          workspaceId: normalized.workspaceId,
          submissionId: normalized.submissionId,
          leadId: record.leadId,
          recordKey: record.storage.keys.record
        }
      });
    }
  });
}

export function loadRuntimeActivePool(path = defaultRuntimeActivePoolPath) {
  return JSON.parse(readFileSync(resolve(repoRoot, path), "utf8"));
}

export function dashboardRuntimeRecordsFromActivePool(activePool, options = {}) {
  const repId = options.repId || "";
  const records = [];
  for (const record of activePool.records || []) {
    for (const profile of record.runtimeProfiles || []) {
      if (repId && profile.repProfileId !== repId) continue;
      records.push({
        id: String(profile.runtimeId),
        repProfileId: String(profile.repProfileId),
        name: String(record.businessName || ""),
        category: String(record.category || "Other"),
        window: String(record.window || "Midday"),
        distance: Number.isFinite(Number(record.estimatedDistanceMiles)) ? `${Number(record.estimatedDistanceMiles).toFixed(1)} mi` : "",
        priority: Number(profile.priority ?? record.priority ?? 0),
        address: String(record.address || ""),
        latitude: Number(record.latitude),
        longitude: Number(record.longitude),
        permission: String(record.permission || "Unknown"),
        accessType: String(record.accessType || ""),
        askFor: String(record.askFor || ""),
        googlePlaceId: String(record.googlePlaceId || ""),
        googleMapsUrl: String(record.googleMapsUrl || ""),
        sourceType: String(record.sourceType || ""),
        qualityClass: String(profile.qualityClass || record.qualityClass || ""),
        qualityScore: Number(profile.qualityScore ?? record.qualityScore ?? 0),
        seedRouteOrder: Number(profile.seedRouteOrder || 9999),
        sourcePool: String(activePool.pool || "active"),
        sourceDatasetVersion: String(activePool.sourceDatasetVersion || ""),
        activePoolRecord: clone(record)
      });
    }
  }
  return records;
}

export function createContactFromRuntimeRecord(state, runtimeRecord, options = {}) {
  if (!runtimeRecord?.id) throw new Error("CRM contact creation requires a dashboard runtime record id.");
  if (!runtimeRecord.googlePlaceId) throw new Error("CRM contact creation requires a Google Place ID.");

  const now = iso(options.createdAt || state.clock);
  const ownerRepId = options.ownerRepId || runtimeRecord.repProfileId || anthonyRepId;
  const existing = state.contacts.find(contact => contact.googlePlaceId === runtimeRecord.googlePlaceId);
  if (existing) return existing;

  const contact = {
    id: stableId("contact", [runtimeRecord.googlePlaceId]),
    businessName: runtimeRecord.name,
    displayName: runtimeRecord.name,
    category: runtimeRecord.category,
    address: runtimeRecord.address,
    latitude: runtimeRecord.latitude,
    longitude: runtimeRecord.longitude,
    googlePlaceId: runtimeRecord.googlePlaceId,
    googleMapsUrl: runtimeRecord.googleMapsUrl,
    source: "runtime_data",
    sourceRuntimeRecordId: runtimeRecord.id,
    sourceDatasetVersion: runtimeRecord.sourceDatasetVersion || "",
    sourcePool: runtimeRecord.sourcePool || "active",
    sourceRepProfileId: runtimeRecord.repProfileId,
    ownerRepId,
    prospectStatus: "New Lead",
    askFor: runtimeRecord.askFor || "",
    accessType: runtimeRecord.accessType || "",
    createdAt: now,
    updatedAt: now,
    founderVisible: true,
    notes: [],
    visitHistory: [],
    salesActivityHistory: [],
    beta: {
      repId: ownerRepId,
      testerName: ownerRepId === anthonyRepId ? "Anthony" : ownerRepId,
      source: "runtime_route_activity",
      founderVisible: true
    }
  };

  state.contacts.push(contact);
  addSalesActivity(state, {
    contactId: contact.id,
    actorId: options.actorId || ownerRepId,
    type: "contact_created",
    occurredAt: now,
    summary: `Contact created from runtime route activity for ${contact.businessName}.`,
    metadata: { runtimeRecordId: runtimeRecord.id, googlePlaceId: runtimeRecord.googlePlaceId }
  });
  addBetaActivity(state, {
    repId: ownerRepId,
    contactId: contact.id,
    occurredAt: now,
    type: "contact_created",
    summary: `${contact.businessName} became a CRM contact from route activity.`
  });
  return contact;
}

export function createLeadForContact(state, contactId, options = {}) {
  const contact = findById(state.contacts, contactId, "contact");
  const existing = state.leads.find(lead => lead.contactId === contactId && !["Customer", "Closed Lost"].includes(lead.status));
  if (existing) {
    if (options.attribution && !existing.attribution?.attributionEventId) {
      attachWebsiteAttributionToLead(state, existing.id, options.attribution, {
        occurredAt: options.createdAt || state.clock,
        manualNotes: options.attributionManualNotes || ""
      });
    }
    return existing;
  }

  const now = iso(options.createdAt || state.clock);
  const ownerRepId = options.ownerRepId || contact.ownerRepId || anthonyRepId;
  const operatingProfile = crmOperatingProfileFor(state, options.operatingProfileId);
  const lead = {
    id: stableId("lead", [contact.id, ownerRepId, now.slice(0, 10)]),
    contactId: contact.id,
    businessName: contact.businessName,
    ownerRepId,
    source: "route_activity",
    sourceRuntimeRecordId: contact.sourceRuntimeRecordId,
    googlePlaceId: contact.googlePlaceId,
    status: "New Lead",
    prospectStatus: "New Lead",
    operatingProfileId: operatingProfile.profileId,
    operatingProfileLabel: operatingProfile.profileLabel,
    profileTerminology: clone(operatingProfile.terminology),
    profileStage: firstProfileStage(operatingProfile),
    profileStageHistory: [{
      from: "",
      to: firstProfileStage(operatingProfile),
      actorId: options.actorId || ownerRepId,
      occurredAt: now,
      profileId: operatingProfile.profileId,
      note: "Lead created with CRM operating profile."
    }],
    profileOutcomeVocabulary: clone(operatingProfile.outcomeVocabulary),
    profileOutcomes: [],
    priority: options.priority || "medium",
    createdAt: now,
    updatedAt: now,
    founderVisible: true,
    dueAt: options.dueAt ? iso(options.dueAt) : "",
    attribution: emptyLeadAttribution(),
    notes: [],
    visitHistory: [],
    statusHistory: [{
      from: "",
      to: "New Lead",
      actorId: options.actorId || ownerRepId,
      occurredAt: now,
      note: "Lead created from CRM contact."
    }]
  };

  state.leads.push(lead);
  addSalesActivity(state, {
    leadId: lead.id,
    contactId: contact.id,
    actorId: options.actorId || ownerRepId,
    type: "lead_created",
    occurredAt: now,
    summary: `Lead opened for ${contact.businessName}.`
  });
  addBetaActivity(state, {
    repId: ownerRepId,
    leadId: lead.id,
    contactId: contact.id,
    occurredAt: now,
    type: "lead_created",
    summary: `${contact.businessName} entered Anthony beta CRM pipeline.`
  });
  if (options.attribution) {
    attachWebsiteAttributionToLead(state, lead.id, options.attribution, {
      occurredAt: now,
      manualNotes: options.attributionManualNotes || ""
    });
  }
  return lead;
}

export function createLeadFromRuntimeRecord(state, runtimeRecord, options = {}) {
  const contact = createContactFromRuntimeRecord(state, runtimeRecord, options);
  return createLeadForContact(state, contact.id, options);
}

export function buildCrmOperatingProfile(profileId = defaultCrmOperatingProfileId, options = {}) {
  return loadCrmOperatingProfile(profileId, options);
}

export function applyCrmOperatingProfileToLead(state, leadId, profileId = defaultCrmOperatingProfileId, options = {}) {
  const lead = findById(state.leads, leadId, "lead");
  const contact = findById(state.contacts, lead.contactId, "contact");
  const operatingProfile = loadCrmOperatingProfile(profileId);
  const appliedAt = iso(options.occurredAt || state.clock);
  const previousProfile = lead.operatingProfileId || "";
  const previousStage = lead.profileStage || "";
  const nextStage = firstProfileStage(operatingProfile);
  lead.profileStageHistory ||= [];

  lead.operatingProfileId = operatingProfile.profileId;
  lead.operatingProfileLabel = operatingProfile.profileLabel;
  lead.profileTerminology = clone(operatingProfile.terminology);
  lead.profileStage = nextStage;
  lead.profileOutcomeVocabulary = clone(operatingProfile.outcomeVocabulary);
  lead.profileStageHistory.push({
    from: previousStage,
    to: nextStage,
    actorId: options.actorId || lead.ownerRepId,
    occurredAt: appliedAt,
    profileId: operatingProfile.profileId,
    note: options.note || `Operating profile changed from ${previousProfile || "none"} to ${operatingProfile.profileId}.`
  });
  lead.updatedAt = appliedAt;
  contact.updatedAt = appliedAt;
  addSalesActivity(state, {
    leadId,
    contactId: contact.id,
    actorId: options.actorId || lead.ownerRepId,
    type: "crm_operating_profile_applied",
    occurredAt: appliedAt,
    summary: `${contact.businessName} CRM operating profile set to ${operatingProfile.profileLabel}.`,
    metadata: {
      previousProfile,
      profileId: operatingProfile.profileId,
      profileStage: nextStage
    }
  });
  return lead;
}

export function transitionLeadProfileStage(state, leadId, nextStage, options = {}) {
  const lead = findById(state.leads, leadId, "lead");
  const contact = findById(state.contacts, lead.contactId, "contact");
  const operatingProfile = crmOperatingProfileFor(state, lead.operatingProfileId);
  ensureKnownProfileStage(operatingProfile, nextStage);

  const now = iso(options.occurredAt || state.clock);
  const previous = lead.profileStage || firstProfileStage(operatingProfile);
  lead.profileStageHistory ||= [];
  lead.profileStage = nextStage;
  lead.prospectStatus = nextStage;
  lead.updatedAt = now;
  contact.prospectStatus = nextStage;
  contact.updatedAt = now;
  lead.profileStageHistory.push({
    from: previous,
    to: nextStage,
    actorId: options.actorId || lead.ownerRepId,
    occurredAt: now,
    profileId: operatingProfile.profileId,
    note: options.note || ""
  });
  addSalesActivity(state, {
    leadId,
    contactId: contact.id,
    actorId: options.actorId || lead.ownerRepId,
    type: "crm_profile_stage_changed",
    occurredAt: now,
    summary: `${contact.businessName} moved from ${previous} to ${nextStage} in the ${operatingProfile.profileLabel} CRM profile.`,
    metadata: {
      profileId: operatingProfile.profileId,
      from: previous,
      to: nextStage
    }
  });
  return lead;
}

export function recordProfileOutcomeForLead(state, input) {
  const lead = findById(state.leads, input.leadId, "lead");
  const contact = findById(state.contacts, lead.contactId, "contact");
  const profileId = input.operatingProfileId || lead.operatingProfileId || state.operatingProfile?.profileId || defaultCrmOperatingProfileId;
  const occurredAt = iso(input.occurredAt || state.clock);
  const normalized = normalizeIndustryOutcome({
    profileId,
    rawOutcome: input.rawOutcome,
    visit: {
      businessRef: input.businessRef || {
        source: "crm",
        id: contact.id,
        name: contact.businessName
      },
      repRef: input.repRef || {
        source: "crm",
        id: lead.ownerRepId
      },
      occurredAt
    },
    truthLevel: input.truthLevel || "crm_reported",
    reviewRequired: input.reviewRequired
  });
  const profileOutcome = {
    id: stableId("profile_outcome", [lead.id, profileId, input.rawOutcome, occurredAt]),
    leadId: input.leadId,
    contactId: contact.id,
    profileId,
    rawOutcome: input.rawOutcome,
    normalizedOutcome: normalized.normalizedOutcome,
    normalizedOutcomeLabel: normalized.normalizedOutcomeLabel,
    matchedTerm: normalized.matchedTerm,
    mappingSource: normalized.mappingSource,
    occurredAt,
    recommendationChanged: normalized.recommendationEligibility.canChangeRecommendation === true,
    productionLearningActive: normalized.evidence.productionLearningActive === true,
    reviewState: normalized.evidence.reviewState
  };
  lead.profileOutcomes ||= [];
  lead.profileOutcomes.push(profileOutcome);
  lead.lastProfileOutcome = profileOutcome;
  lead.updatedAt = occurredAt;
  contact.updatedAt = occurredAt;
  addSalesActivity(state, {
    leadId: input.leadId,
    contactId: contact.id,
    actorId: input.actorId || lead.ownerRepId,
    type: "crm_profile_outcome_recorded",
    occurredAt,
    summary: `${contact.businessName} recorded ${input.rawOutcome} as ${profileOutcome.normalizedOutcome} under ${profileId}.`,
    metadata: {
      profileId,
      rawOutcome: input.rawOutcome,
      normalizedOutcome: profileOutcome.normalizedOutcome,
      recommendationChanged: profileOutcome.recommendationChanged,
      productionLearningActive: profileOutcome.productionLearningActive
    }
  });
  return profileOutcome;
}

export function attachWebsiteAttributionToLead(state, leadId, websiteAttribution, options = {}) {
  const lead = findById(state.leads, leadId, "lead");
  const contact = findById(state.contacts, lead.contactId, "contact");
  const { firstTouch, lastTouch, visitorId } = attributionTouch(websiteAttribution);
  const normalizedFirstTouch = normalizeWebsiteTouchEvent(firstTouch, "first touch");
  const normalizedLastTouch = normalizeWebsiteTouchEvent(lastTouch, "last touch");
  const occurredAt = iso(options.occurredAt || normalizedLastTouch.occurredAt || state.clock);
  const leadSource = options.leadSource || leadSourceFromTouch(normalizedLastTouch);
  const campaignId = options.campaignId || normalizedLastTouch.campaignId || normalizedLastTouch.metadata?.campaign_id || "";
  const campaignPlatform = options.campaignPlatform || normalizedLastTouch.metadata?.campaign_platform || normalizedLastTouch.provider || leadSource || "";
  const attributionEvent = createAttributionEvent({
    id: stableId("crm_attr", [lead.id, normalizedFirstTouch.id, normalizedLastTouch.id, campaignId, occurredAt]),
    type: SOCIAL_ATTRIBUTION_EVENT_TYPES.CRM_LEAD_CREATED,
    target: SOCIAL_ATTRIBUTION_TARGETS.CRM_LEAD,
    source: SOCIAL_DATA_SOURCES.CRM_CONTRACT,
    provider: normalizedLastTouch.provider || normalizedFirstTouch.provider || null,
    campaignId: campaignId || null,
    occurredAt,
    visitorId: visitorId || normalizedLastTouch.visitorId || normalizedFirstTouch.visitorId || null,
    leadId: lead.id,
    confidence: Number(normalizedLastTouch.confidence ?? normalizedFirstTouch.confidence ?? 0),
    metadata: {
      lead_source: leadSource,
      campaign_platform: campaignPlatform,
      first_touch_at: normalizedFirstTouch.occurredAt,
      last_touch_at: normalizedLastTouch.occurredAt,
      qualified_status: lead.status,
      manual_notes: options.manualNotes || "",
      website_first_touch_event_id: normalizedFirstTouch.id,
      website_last_touch_event_id: normalizedLastTouch.id,
      website_attribution_version: normalizedLastTouch.metadata?.attribution_version || normalizedFirstTouch.metadata?.attribution_version || "",
      utm_source: normalizedLastTouch.metadata?.utm_source || "",
      utm_medium: normalizedLastTouch.metadata?.utm_medium || "",
      utm_campaign: normalizedLastTouch.metadata?.utm_campaign || "",
      utm_content: normalizedLastTouch.metadata?.utm_content || "",
      utm_term: normalizedLastTouch.metadata?.utm_term || "",
      landing_path: normalizedLastTouch.metadata?.landing_path || "",
      referrer: normalizedLastTouch.metadata?.referrer || ""
    }
  });

  lead.attribution = {
    leadSource,
    campaignId: campaignId || "",
    campaignPlatform,
    provider: attributionEvent.provider || "",
    firstTouchAt: normalizedFirstTouch.occurredAt,
    lastTouchAt: normalizedLastTouch.occurredAt,
    qualifiedStatus: lead.status,
    manualNotes: options.manualNotes || "",
    websiteVisitorId: attributionEvent.visitorId || "",
    firstTouchEventId: normalizedFirstTouch.id,
    lastTouchEventId: normalizedLastTouch.id,
    attributionEventId: attributionEvent.id
  };
  lead.updatedAt = occurredAt;
  contact.updatedAt = occurredAt;
  state.attributionEvents.push(attributionEvent);

  addSalesActivity(state, {
    leadId,
    contactId: contact.id,
    actorId: options.actorId || lead.ownerRepId,
    type: "lead_attribution_attached",
    occurredAt,
    summary: `Website/Social attribution attached to ${contact.businessName}.`,
    metadata: {
      attributionEventId: attributionEvent.id,
      leadSource,
      campaignId: campaignId || "",
      campaignPlatform
    }
  });

  return attributionEvent;
}

export function addContactNote(state, contactId, input) {
  const contact = findById(state.contacts, contactId, "contact");
  const now = iso(input.occurredAt || state.clock);
  const note = {
    id: stableId("note", [contactId, now, input.body]),
    actorId: input.actorId || contact.ownerRepId || founderId,
    body: input.body,
    occurredAt: now,
    founderVisible: input.founderVisible !== false
  };
  contact.notes.push(note);
  contact.updatedAt = now;
  addSalesActivity(state, {
    contactId,
    actorId: note.actorId,
    type: "note_added",
    occurredAt: now,
    summary: `Note added for ${contact.businessName}.`
  });
  return note;
}

export function transitionLead(state, leadId, nextStatus, options = {}) {
  ensureKnownLeadStatus(nextStatus);
  const lead = findById(state.leads, leadId, "lead");
  const contact = findById(state.contacts, lead.contactId, "contact");
  const currentIndex = leadStatuses.indexOf(lead.status);
  const nextIndex = leadStatuses.indexOf(nextStatus);
  if (nextIndex < currentIndex && !options.allowRegression) {
    throw new Error(`CRM lead cannot regress from ${lead.status} to ${nextStatus} without allowRegression.`);
  }

  const now = iso(options.occurredAt || state.clock);
  const previous = lead.status;
  lead.status = nextStatus;
  lead.prospectStatus = nextStatus;
  lead.updatedAt = now;
  contact.prospectStatus = nextStatus;
  contact.updatedAt = now;
  lead.statusHistory.push({
    from: previous,
    to: nextStatus,
    actorId: options.actorId || lead.ownerRepId,
    occurredAt: now,
    note: options.note || ""
  });
  addSalesActivity(state, {
    leadId,
    contactId: lead.contactId,
    actorId: options.actorId || lead.ownerRepId,
    type: "lead_status_changed",
    occurredAt: now,
    summary: `${contact.businessName} moved from ${previous} to ${nextStatus}.`,
    metadata: { from: previous, to: nextStatus }
  });
  addBetaActivity(state, {
    repId: lead.ownerRepId,
    leadId,
    contactId: lead.contactId,
    occurredAt: now,
    type: "lead_status_changed",
    summary: `${contact.businessName} pipeline status changed to ${nextStatus}.`
  });

  if (nextStatus === "Follow-up Required" && options.createFollowUp !== false) {
    createFollowUp(state, {
      leadId,
      assignedTo: options.assignedTo || lead.ownerRepId,
      dueAt: options.dueAt || now,
      priority: options.priority || lead.priority || "medium",
      reason: options.reason || "Lead moved to Follow-up Required.",
      createdAt: now
    });
  }
  return lead;
}

export function recordRouteVisit(state, input) {
  const lead = findById(state.leads, input.leadId, "lead");
  const contact = findById(state.contacts, lead.contactId, "contact");
  const outcome = routeVisitOutcomes[input.outcome];
  if (!outcome) throw new Error(`Unknown route visit outcome: ${input.outcome}`);

  const visitedAt = iso(input.visitedAt || state.clock);
  const visit = {
    id: stableId("visit", [lead.id, input.routeRecordId || lead.sourceRuntimeRecordId, input.outcome, visitedAt]),
    leadId: lead.id,
    contactId: contact.id,
    repId: input.repId || lead.ownerRepId,
    routeRecordId: input.routeRecordId || lead.sourceRuntimeRecordId,
    googlePlaceId: input.googlePlaceId || lead.googlePlaceId,
    outcome: input.outcome,
    outcomeLabel: outcome.status,
    notes: input.notes || "",
    visitedAt,
    founderVisible: true
  };

  contact.visitHistory.push(visit);
  lead.visitHistory.push(visit);
  contact.updatedAt = visitedAt;
  lead.updatedAt = visitedAt;

  addSalesActivity(state, {
    leadId: lead.id,
    contactId: contact.id,
    actorId: visit.repId,
    type: "route_visit_logged",
    occurredAt: visitedAt,
    summary: outcome.activity,
    metadata: { outcome: input.outcome, routeRecordId: visit.routeRecordId }
  });
  addBetaActivity(state, {
    repId: visit.repId,
    leadId: lead.id,
    contactId: contact.id,
    occurredAt: visitedAt,
    type: "route_visit_logged",
    summary: `${contact.businessName}: ${outcome.activity}`
  });

  transitionLead(state, lead.id, outcome.status, {
    actorId: visit.repId,
    occurredAt: visitedAt,
    createFollowUp: outcome.followUpRequired,
    assignedTo: input.followUpAssignedTo || visit.repId,
    dueAt: input.followUpDueAt || visitedAt,
    priority: input.followUpPriority || lead.priority || "medium",
    reason: input.followUpReason || outcome.activity
  });

  return visit;
}

export function createFollowUp(state, input) {
  ensureKnownPriority(input.priority || "medium");
  const lead = findById(state.leads, input.leadId, "lead");
  const contact = findById(state.contacts, lead.contactId, "contact");
  const dueAt = iso(input.dueAt);
  const createdAt = iso(input.createdAt || state.clock);
  const assignedTo = input.assignedTo || lead.ownerRepId;
  const queue = assignedTo === founderId ? "founder" : "rep";

  const followUp = {
    id: stableId("followup", [lead.id, assignedTo, dueAt, input.reason || ""]),
    leadId: lead.id,
    contactId: contact.id,
    assignedTo,
    queue,
    priority: input.priority || "medium",
    dueAt,
    reason: input.reason || "Follow-up required.",
    status: "pending",
    createdAt,
    completedAt: "",
    founderVisible: true
  };
  state.followUps.push(followUp);

  const task = createTask(state, {
    leadId: lead.id,
    contactId: contact.id,
    queue,
    assignedTo,
    type: "follow_up",
    title: `Follow up with ${contact.businessName}`,
    priority: followUp.priority,
    dueAt,
    createdAt,
    sourceFollowUpId: followUp.id
  });
  followUp.taskId = task.id;

  addSalesActivity(state, {
    leadId: lead.id,
    contactId: contact.id,
    actorId: assignedTo,
    type: "follow_up_created",
    occurredAt: createdAt,
    summary: `Follow-up queued for ${contact.businessName}.`,
    metadata: { dueAt, priority: followUp.priority, queue }
  });
  addBetaActivity(state, {
    repId: lead.ownerRepId,
    leadId: lead.id,
    contactId: contact.id,
    occurredAt: createdAt,
    type: "follow_up_created",
    summary: `${contact.businessName} follow-up queued for ${assignedTo}.`
  });
  return followUp;
}

export function createTask(state, input) {
  ensureKnownPriority(input.priority || "medium");
  const dueAt = iso(input.dueAt);
  const createdAt = iso(input.createdAt || state.clock);
  const task = {
    id: stableId("task", [input.leadId, input.assignedTo, input.type, dueAt, input.title]),
    queue: input.queue || (input.assignedTo === founderId ? "founder" : "rep"),
    assignedTo: input.assignedTo,
    leadId: input.leadId || "",
    contactId: input.contactId || "",
    type: input.type,
    title: input.title,
    priority: input.priority || "medium",
    dueAt,
    status: "open",
    createdAt,
    completedAt: "",
    founderVisible: true,
    sourceFollowUpId: input.sourceFollowUpId || ""
  };
  state.tasks.push(task);
  return task;
}

export function completeTask(state, taskId, options = {}) {
  const task = findById(state.tasks, taskId, "task");
  const completedAt = iso(options.completedAt || state.clock);
  task.status = "completed";
  task.completedAt = completedAt;

  if (task.sourceFollowUpId) {
    const followUp = state.followUps.find(candidate => candidate.id === task.sourceFollowUpId);
    if (followUp) {
      followUp.status = "completed";
      followUp.completedAt = completedAt;
    }
  }
  addSalesActivity(state, {
    leadId: task.leadId,
    contactId: task.contactId,
    actorId: options.actorId || task.assignedTo,
    type: "task_completed",
    occurredAt: completedAt,
    summary: `Task completed: ${task.title}.`
  });
  return task;
}

function priorityRank(priority) {
  return {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3
  }[priority] ?? 4;
}

export function compareQueueItems(left, right, asOf = new Date()) {
  const asOfTime = new Date(asOf).getTime();
  const leftOverdue = new Date(left.dueAt).getTime() < asOfTime;
  const rightOverdue = new Date(right.dueAt).getTime() < asOfTime;
  if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;
  const priorityDelta = priorityRank(left.priority) - priorityRank(right.priority);
  if (priorityDelta) return priorityDelta;
  const dueDelta = new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
  if (dueDelta) return dueDelta;
  return left.id.localeCompare(right.id);
}

export function buildFollowUpQueue(state, options = {}) {
  const asOf = options.asOf || state.clock;
  return state.followUps
    .filter(followUp => followUp.status === "pending")
    .filter(followUp => !options.assignedTo || followUp.assignedTo === options.assignedTo)
    .filter(followUp => !options.queue || followUp.queue === options.queue)
    .map(followUp => ({
      ...followUp,
      contact: state.contacts.find(contact => contact.id === followUp.contactId) || null,
      lead: state.leads.find(lead => lead.id === followUp.leadId) || null,
      overdue: new Date(followUp.dueAt).getTime() < new Date(asOf).getTime()
    }))
    .sort((left, right) => compareQueueItems(left, right, asOf));
}

export function buildTaskQueue(state, options = {}) {
  const asOf = options.asOf || state.clock;
  return state.tasks
    .filter(task => task.status === (options.status || "open"))
    .filter(task => !options.queue || task.queue === options.queue)
    .filter(task => !options.assignedTo || task.assignedTo === options.assignedTo)
    .map(task => ({
      ...task,
      overdue: new Date(task.dueAt).getTime() < new Date(asOf).getTime()
    }))
    .sort((left, right) => compareQueueItems(left, right, asOf));
}

export function buildCrmReports(state, options = {}) {
  const asOf = iso(options.asOf || state.clock);
  const today = dateOnly(asOf);
  const pendingFollowUps = buildFollowUpQueue(state, { asOf });
  const tasks = state.tasks;

  const contactPipelineCounts = leadStatuses.reduce((counts, status) => {
    counts[status] = state.leads.filter(lead => lead.status === status).length;
    return counts;
  }, {});
  const profilePipelineCounts = state.leads.reduce((counts, lead) => {
    const profileId = lead.operatingProfileId || state.operatingProfile?.profileId || defaultCrmOperatingProfileId;
    const stage = lead.profileStage || firstProfileStage(crmOperatingProfileFor(state, profileId));
    counts[profileId] ||= {};
    counts[profileId][stage] = (counts[profileId][stage] || 0) + 1;
    return counts;
  }, {});

  const taskCompletionStatus = {
    open: tasks.filter(task => task.status === "open").length,
    completed: tasks.filter(task => task.status === "completed").length,
    founderOpen: tasks.filter(task => task.status === "open" && task.queue === "founder").length,
    repOpen: tasks.filter(task => task.status === "open" && task.queue === "rep").length
  };

  return {
    generatedAt: asOf,
    todaysFollowUps: pendingFollowUps.filter(followUp => dateOnly(followUp.dueAt) === today),
    overdueFollowUps: pendingFollowUps.filter(followUp => new Date(followUp.dueAt).getTime() < new Date(`${today}T00:00:00.000Z`).getTime()),
    anthonyBetaActivity: state.betaActivity
      .filter(activity => activity.repId === anthonyRepId && activity.founderVisible)
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()),
    founderActivitySummary: {
      visibleContacts: state.contacts.filter(contact => contact.founderVisible).length,
      visibleLeads: state.leads.filter(lead => lead.founderVisible).length,
      visibleBetaActivities: state.betaActivity.filter(activity => activity.founderVisible).length,
      openFounderTasks: taskCompletionStatus.founderOpen,
      openRepTasks: taskCompletionStatus.repOpen,
      pendingFollowUps: pendingFollowUps.length
    },
    contactPipelineCounts,
    profilePipelineCounts,
    taskCompletionStatus
  };
}
