import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const crmVersion = "beta-crm-contact-follow-up-queue-v1";

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

export function createCrmState(options = {}) {
  const now = iso(options.now || new Date());
  return {
    version: crmVersion,
    generatedAt: now,
    clock: now,
    contacts: [],
    leads: [],
    followUps: [],
    tasks: [],
    salesActivities: [],
    betaActivity: []
  };
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
  if (existing) return existing;

  const now = iso(options.createdAt || state.clock);
  const ownerRepId = options.ownerRepId || contact.ownerRepId || anthonyRepId;
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
    priority: options.priority || "medium",
    createdAt: now,
    updatedAt: now,
    founderVisible: true,
    dueAt: options.dueAt ? iso(options.dueAt) : "",
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
  return lead;
}

export function createLeadFromRuntimeRecord(state, runtimeRecord, options = {}) {
  const contact = createContactFromRuntimeRecord(state, runtimeRecord, options);
  return createLeadForContact(state, contact.id, options);
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
    taskCompletionStatus
  };
}
