import { createHash } from "node:crypto";

export const workspaceLeadIntakeConsumerVersion = "workspace-lead-intake-crm-consumer-v1";
export const crmWorkspaceLeadPersistenceVersion = "crm-workspace-lead-persistence-v1";
export const crmWorkspaceLeadPersistencePrefix = "crm-workspace-leads";

export const supportedWorkspaceLeadIntakeWorkspaces = Object.freeze({
  fitness_connection: Object.freeze({
    workspaceId: "fitness_connection",
    workspaceName: "Fitness Connection",
    operatingProfileId: "fitness",
    target: "lead",
    researchClassification: "FOUNDER_FIELD_RESEARCH",
    runtimePersistenceAllowed: false
  })
});

function iso(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid CRM date: ${value}`);
  return date.toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableId(prefix, parts) {
  const digest = createHash("sha256")
    .update(parts.filter(part => part !== undefined && part !== null).map(String).join("|"), "utf8")
    .digest("hex")
    .slice(0, 16);
  return `${prefix}_${digest}`;
}

function splitContactMethod(contactMethod = "") {
  const value = String(contactMethod || "").trim();
  if (!value) return { email: "", phone: "" };
  if (value.includes("@")) return { email: value, phone: "" };
  return { email: "", phone: value };
}

function requireSupportedWorkspace(workspaceId) {
  const workspace = supportedWorkspaceLeadIntakeWorkspaces[workspaceId];
  if (!workspace) {
    throw new Error(`Unknown CRM workspace intake workspace: ${workspaceId || "missing"}.`);
  }
  return workspace;
}

function stateSafeNow() {
  return new Date().toISOString();
}

export function normalizeWorkspaceLeadIntakeInput(input = {}) {
  const record = input.crmHandoff ? input : null;
  const handoff = record?.crmHandoff || input;
  const packet = handoff?.packet || {};
  const lead = packet.lead || {};
  const crmIntegration = packet.crmIntegration || {};
  const workspaceId = handoff.workspaceId || lead.workspaceId || crmIntegration.workspaceId || record?.workspace?.workspaceId || "";
  const expectedWorkspace = requireSupportedWorkspace(workspaceId);
  const packetWorkspaceIds = [
    handoff.workspaceId,
    lead.workspaceId,
    crmIntegration.workspaceId,
    record?.workspace?.workspaceId
  ].filter(Boolean);

  for (const packetWorkspaceId of packetWorkspaceIds) {
    if (packetWorkspaceId !== expectedWorkspace.workspaceId) {
      throw new Error(`CRM workspace intake packet has cross-workspace contamination: ${packetWorkspaceId} cannot route to ${expectedWorkspace.workspaceId}.`);
    }
  }

  if (handoff.ownerSubsystem && handoff.ownerSubsystem !== "Prometheus CRM") {
    throw new Error(`CRM workspace intake handoff has unexpected owner subsystem: ${handoff.ownerSubsystem}.`);
  }
  if (handoff.contract && handoff.contract !== "shared_workspace_crm_lead_intake_packet.v1") {
    throw new Error(`CRM workspace intake handoff has unsupported contract: ${handoff.contract}.`);
  }
  if (handoff.mutationPerformed === true) {
    throw new Error("CRM workspace intake requires Infrastructure handoff packets with mutationPerformed false.");
  }

  const operatingProfileId = record?.operatingProfile?.id || crmIntegration.operatingProfileId || lead.operatingProfile?.crmProfileId || lead.operatingProfile?.profileId || "";
  if (operatingProfileId && operatingProfileId !== expectedWorkspace.operatingProfileId) {
    throw new Error(`CRM workspace intake operating profile mismatch for ${expectedWorkspace.workspaceId}: ${operatingProfileId}.`);
  }

  const submissionId = record?.submissionId || handoff.submissionId || lead.submissionId || "";
  if (!submissionId) throw new Error("CRM workspace intake requires submissionId.");
  if (!handoff.handoffId) throw new Error("CRM workspace intake requires handoffId.");
  if (!lead.companyName) throw new Error("CRM workspace intake requires lead.companyName.");
  if (!lead.requesterName) throw new Error("CRM workspace intake requires lead.requesterName.");

  return {
    record,
    handoff,
    packet,
    lead,
    crmIntegration,
    workspace: expectedWorkspace,
    workspaceId: expectedWorkspace.workspaceId,
    submissionId,
    handoffId: handoff.handoffId,
    submittedAt: record?.timestamp || handoff.preparedAt || lead.createdAt || stateSafeNow(),
    auditTrail: clone(record?.auditTrail || handoff.auditTrail || []),
    attribution: clone(packet.attribution || {}),
    attributionEvent: crmIntegration.attributionEvent ? clone(crmIntegration.attributionEvent) : null
  };
}

export function validateWorkspaceLeadIntakeHandoff(input = {}) {
  const normalized = normalizeWorkspaceLeadIntakeInput(input);
  return {
    workspaceId: normalized.workspaceId,
    workspaceName: normalized.workspace.workspaceName,
    operatingProfileId: normalized.workspace.operatingProfileId,
    submissionId: normalized.submissionId,
    handoffId: normalized.handoffId,
    target: normalized.workspace.target,
    runtimePersistenceAllowed: normalized.workspace.runtimePersistenceAllowed
  };
}

export function crmWorkspaceLeadStorageKeys(workspaceId, submissionId, leadId) {
  return {
    record: `${crmWorkspaceLeadPersistencePrefix}/workspaces/${workspaceId}/submissions/${submissionId}/lead.json`,
    leadIndex: `${crmWorkspaceLeadPersistencePrefix}/workspaces/${workspaceId}/leads/${leadId}.json`,
    submissionIndex: `${crmWorkspaceLeadPersistencePrefix}/submissions/${submissionId}.json`
  };
}

function requireCrmWorkspaceLeadStore(store) {
  if (!store
    || (typeof store.get !== "function" && typeof store.getItem !== "function")
    || typeof store.putIfAbsent !== "function"
    || (typeof store.put !== "function" && typeof store.setItem !== "function")) {
    throw new Error("CRM workspace lead persistence requires a readable CRM-owned durable store adapter with atomic putIfAbsent.");
  }
}

async function writeCrmWorkspaceLeadStoreIfAbsent(store, key, value, metadata) {
  const inserted = await store.putIfAbsent(key, JSON.stringify(value), { metadata });
  if (inserted !== true && inserted !== false) {
    throw new Error("CRM workspace lead atomic putIfAbsent returned an invalid result.");
  }
  return inserted;
}

function readableCrmWorkspaceLeadStore(store) {
  return Boolean(store && (typeof store.get === "function" || typeof store.getItem === "function"));
}

async function readCrmWorkspaceLeadStore(store, key) {
  if (!readableCrmWorkspaceLeadStore(store)) {
    throw new Error("CRM workspace lead persistence requires a readable durable store adapter.");
  }
  const value = typeof store.get === "function"
    ? await store.get(key)
    : await store.getItem(key);
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`CRM workspace lead durable record is invalid JSON at ${key}.`);
    }
  }
  return clone(value);
}

export async function readPersistedWorkspaceLeadBySubmission(store, input = {}) {
  const workspace = requireSupportedWorkspace(input.workspaceId);
  const submissionId = String(input.submissionId || "").trim();
  if (!submissionId) throw new Error("CRM workspace lead durable read requires submissionId.");

  const submissionIndexKey = `${crmWorkspaceLeadPersistencePrefix}/submissions/${submissionId}.json`;
  const index = await readCrmWorkspaceLeadStore(store, submissionIndexKey);
  if (!index) return null;
  if (index.workspaceId !== workspace.workspaceId || index.submissionId !== submissionId) {
    throw new Error("CRM workspace lead durable index has cross-workspace contamination.");
  }

  const expectedRecordPrefix = `${crmWorkspaceLeadPersistencePrefix}/workspaces/${workspace.workspaceId}/submissions/${submissionId}/`;
  if (typeof index.recordKey !== "string" || !index.recordKey.startsWith(expectedRecordPrefix)) {
    throw new Error("CRM workspace lead durable index points outside its workspace partition.");
  }

  const record = await readCrmWorkspaceLeadStore(store, index.recordKey);
  if (!record) throw new Error(`CRM workspace lead durable record is missing at ${index.recordKey}.`);
  if (record.workspace?.workspaceId !== workspace.workspaceId || record.metadata?.submissionId !== submissionId) {
    throw new Error("CRM workspace lead durable record has cross-workspace contamination.");
  }
  return record;
}

function durableLeadFieldsFromConsumption(normalized, consumed) {
  const target = consumed.lead || consumed.candidate;
  const contact = consumed.contact || {};
  const split = splitContactMethod(normalized.lead.contactMethod);
  const email = contact.email || target.email || split.email || "";
  const phone = contact.phone || target.phone || split.phone || "";
  const notes = [
    target.notes,
    normalized.lead.primaryGoal,
    normalized.lead.currentWorkflow,
    normalized.lead.message
  ].filter(Boolean).join("\n\n");

  return {
    target,
    leadId: target.id,
    company: target.businessName || normalized.lead.companyName,
    contactName: target.requesterName || target.candidateName || normalized.lead.requesterName,
    email,
    phone,
    source: normalized.record?.source || normalized.lead.source || target.source || "partner_intake",
    status: target.status || target.pipelineStage || "New Lead",
    notes
  };
}

function buildCrmWorkspaceLeadPersistenceRecord(state, normalized, consumed, options = {}) {
  const persistedAt = iso(options.persistedAt || options.consumedAt || state.clock);
  const fields = durableLeadFieldsFromConsumption(normalized, consumed);
  const storage = crmWorkspaceLeadStorageKeys(normalized.workspaceId, normalized.submissionId, fields.leadId);

  return {
    version: crmWorkspaceLeadPersistenceVersion,
    recordId: stableId("crm_workspace_lead_record", [normalized.workspaceId, normalized.submissionId, fields.leadId]),
    workspace: {
      workspaceId: normalized.workspaceId,
      workspaceName: normalized.workspace.workspaceName,
      operatingProfileId: normalized.workspace.operatingProfileId
    },
    leadId: fields.leadId,
    company: fields.company,
    contactName: fields.contactName,
    email: fields.email,
    phone: fields.phone,
    source: fields.source,
    submissionTimestamp: iso(normalized.submittedAt),
    status: fields.status,
    assignedWorkspace: {
      workspaceId: normalized.workspaceId,
      crmWorkspacePath: normalized.handoff.crmWorkspacePath || "",
      targetType: consumed.targetType
    },
    notes: fields.notes,
    metadata: {
      consumerVersion: workspaceLeadIntakeConsumerVersion,
      handoffContract: normalized.handoff.contract || "shared_workspace_crm_lead_intake_packet.v1",
      submissionId: normalized.submissionId,
      handoffId: normalized.handoffId,
      sourceMutationPerformed: normalized.handoff.mutationPerformed === true,
      operatingProfileId: normalized.workspace.operatingProfileId,
      requestType: normalized.lead.requestType || "",
      sourcePipelineStage: normalized.lead.pipelineStage || "",
      attribution: normalized.attribution,
      attributionEventId: consumed.attributionEvent?.id || "",
      auditTrail: normalized.auditTrail,
      crossWorkspaceRouting: false
    },
    storage: {
      status: "persisted",
      persistedAt,
      keys: storage
    }
  };
}

function assertCanonicalWorkspaceLeadRecord(record, state, normalized, projectedConsumption) {
  const persistedAt = record?.storage?.persistedAt;
  if (typeof persistedAt !== "string") {
    throw new Error("CRM workspace lead canonical durable record is malformed.");
  }
  const expected = buildCrmWorkspaceLeadPersistenceRecord(state, normalized, projectedConsumption, {
    persistedAt
  });
  if (JSON.stringify(record) !== JSON.stringify(expected)) {
    throw new Error("CRM workspace lead canonical durable record does not match the submitted handoff.");
  }
  return record;
}

async function repairWorkspaceLeadIndex(store, key, value, metadata) {
  await writeCrmWorkspaceLeadStoreIfAbsent(store, key, value, metadata);
  const existing = await readCrmWorkspaceLeadStore(store, key);
  if (JSON.stringify(existing) !== JSON.stringify(value)) {
    throw new Error(`CRM workspace lead durable index conflicts with canonical record at ${key}.`);
  }
}

export function createFitnessConnectionRuntimeLeadConsumption(normalized, options = {}) {
  if (normalized.workspaceId !== "fitness_connection") {
    throw new Error(`CRM production runtime projection is not approved for ${normalized.workspaceId}.`);
  }
  const contactMethod = splitContactMethod(normalized.lead.contactMethod);
  const contactId = stableId("contact", [normalized.workspaceId, normalized.submissionId, normalized.lead.companyName]);
  const leadId = stableId("lead", [contactId, normalized.workspaceId, normalized.submissionId]);
  return {
    ok: true,
    consumerVersion: workspaceLeadIntakeConsumerVersion,
    workspaceId: normalized.workspaceId,
    targetType: "fitness_connection_lead",
    contact: {
      id: contactId,
      businessName: normalized.lead.companyName,
      email: contactMethod.email,
      phone: contactMethod.phone
    },
    lead: {
      id: leadId,
      businessName: normalized.lead.companyName,
      requesterName: normalized.lead.requesterName,
      source: "shared_workspace_lead_intake",
      status: "New Lead",
      notes: []
    },
    attributionEvent: normalized.attributionEvent ? clone(normalized.attributionEvent) : null,
    audit: {
      workspaceId: normalized.workspaceId,
      submissionId: normalized.submissionId,
      handoffId: normalized.handoffId,
      consumedAt: iso(options.consumedAt || normalized.submittedAt)
    }
  };
}

export async function persistWorkspaceLeadIntakeHandoffCore(state, input = {}, options = {}) {
  const normalized = normalizeWorkspaceLeadIntakeInput(input);
  requireCrmWorkspaceLeadStore(options.store);
  if (!Array.isArray(state?.workspaceLeadPersistenceRecords)) {
    throw new Error("CRM workspace lead persistence requires workspaceLeadPersistenceRecords state.");
  }

  const projectedConsumption = createFitnessConnectionRuntimeLeadConsumption(normalized, options);
  const candidate = buildCrmWorkspaceLeadPersistenceRecord(state, normalized, projectedConsumption, options);
  const inserted = await writeCrmWorkspaceLeadStoreIfAbsent(
    options.store,
    candidate.storage.keys.record,
    candidate,
    {
      workspaceId: normalized.workspaceId,
      submissionId: normalized.submissionId,
      leadId: candidate.leadId,
      status: candidate.status,
      persistedAt: candidate.storage.persistedAt
    }
  );
  const durableRecord = assertCanonicalWorkspaceLeadRecord(
    await readCrmWorkspaceLeadStore(options.store, candidate.storage.keys.record),
    state,
    normalized,
    projectedConsumption
  );
  const consume = options.consumeWorkspaceLeadIntake || createFitnessConnectionRuntimeLeadConsumption;
  const consumed = inserted ? await consume(state, input, options, normalized) : null;
  const record = durableRecord;
  if (consumed) {
    assertCanonicalWorkspaceLeadRecord(record, state, normalized, consumed);
  }
  const metadata = {
    workspaceId: normalized.workspaceId,
    submissionId: normalized.submissionId,
    leadId: record.leadId,
    status: record.status,
    persistedAt: record.storage.persistedAt
  };

  await repairWorkspaceLeadIndex(options.store, record.storage.keys.leadIndex, {
    workspaceId: normalized.workspaceId,
    submissionId: normalized.submissionId,
    leadId: record.leadId,
    recordKey: record.storage.keys.record,
    persistedAt: record.storage.persistedAt
  }, metadata);
  await repairWorkspaceLeadIndex(options.store, record.storage.keys.submissionIndex, {
    workspaceId: normalized.workspaceId,
    submissionId: normalized.submissionId,
    leadId: record.leadId,
    recordKey: record.storage.keys.record,
    persistedAt: record.storage.persistedAt
  }, metadata);

  if (!state.workspaceLeadPersistenceRecords.some(existing => existing.recordId === record.recordId)) {
    state.workspaceLeadPersistenceRecords.push(record);
  }
  if (inserted && typeof options.recordActivity === "function") {
    await options.recordActivity({ state, normalized, consumed, record });
  }

  return {
    ok: true,
    duplicate: !inserted,
    consumerVersion: workspaceLeadIntakeConsumerVersion,
    persistenceVersion: crmWorkspaceLeadPersistenceVersion,
    workspaceId: normalized.workspaceId,
    ...(consumed ? { consumed } : {}),
    record,
    storage: record.storage
  };
}
