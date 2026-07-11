import {
  createEnterpriseLeadIntake
} from "../../deploy/prometheusrouteiq-website/enterprise-lead-intake.js";

const SHARED_LEAD_INTAKE_VERSION = "shared-workspace-lead-intake.v1";
const PARTNER_INTAKE_PATH = "/api/partner-intake";
const STORAGE_PREFIX = "shared-lead-intake";
const MAX_BODY_BYTES = 64 * 1024;

const WORKSPACES = Object.freeze({
  fitness_connection: Object.freeze({
    workspaceId: "fitness_connection",
    workspaceName: "Fitness Connection",
    operatingProfileId: "fitness",
    operatingProfileLabel: "Fitness",
    crmWorkspacePath: "crm://workspace/fitness_connection/leads",
    aliases: Object.freeze([
      "fitness_connection",
      "fitness-connection",
      "fitness connection",
      "fitness",
      "fc",
      "fitness_connection_partner_intake"
    ])
  }),
  smoothie_depot: Object.freeze({
    workspaceId: "smoothie_depot",
    workspaceName: "Smoothie Depot",
    operatingProfileId: "franchise_development",
    operatingProfileLabel: "Franchise Development",
    crmWorkspacePath: "crm://workspace/smoothie_depot/candidate_pipeline",
    aliases: Object.freeze([
      "smoothie_depot",
      "smoothie-depot",
      "smoothie depot",
      "smoothie",
      "sd",
      "smoothie_depot_partner_intake"
    ])
  })
});

function nowIso(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeText(value, maxLength = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeMultiline(value, maxLength = 1800) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

function slug(value) {
  return normalizeText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function stableHash(value) {
  let hash = 2166136261;
  const input = String(value || "");
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function workspaceRegistry() {
  return Object.values(WORKSPACES).map(workspace => ({
    workspaceId: workspace.workspaceId,
    workspaceName: workspace.workspaceName,
    operatingProfileId: workspace.operatingProfileId,
    crmWorkspacePath: workspace.crmWorkspacePath,
    aliases: [...workspace.aliases]
  }));
}

function resolveWorkspace(input = {}) {
  const candidates = [
    input.workspaceId,
    input.workspace_id,
    input.workspace,
    input.workspaceName,
    input.partner,
    input.partnerName,
    input.customer,
    input.customerName,
    input.formId,
    input.form_id,
    input.source?.workspaceId,
    input.source?.formId
  ].map(value => normalizeText(value).toLowerCase()).filter(Boolean);

  for (const candidate of candidates) {
    const candidateSlug = slug(candidate);
    const match = Object.values(WORKSPACES).find(workspace => {
      return workspace.aliases.some(alias => alias === candidate || slug(alias) === candidateSlug);
    });
    if (match) return match;
  }

  return null;
}

function sanitizeLeadInput(input = {}, workspace) {
  const contactMethod = normalizeText(
    input.contactMethod || input.email || input.phone || input.contact || input.requesterContact,
    180
  );
  const companyName = normalizeText(input.companyName || input.businessName || input.organizationName, 140);
  const contactName = normalizeText(input.contactName || input.requesterName || input.name, 140);
  const requestType = normalizeText(input.requestType || input.intent || "growth_partner", 80);
  const currentWorkflow = normalizeMultiline(
    input.currentWorkflow || input.biggestChallenge || input.notes || input.message || input.additionalContext,
    1200
  );
  const primaryGoal = normalizeText(input.primaryGoal || input.goal || input.intentSummary || requestType, 180);

  return {
    requestType,
    companyName,
    companyWebsite: normalizeText(input.companyWebsite || input.website || input.businessWebsite, 220),
    requesterRole: normalizeText(input.requesterRole || input.role || input.title, 140),
    operatingProfileId: workspace.operatingProfileId,
    otherOperatingProfile: workspace.operatingProfileLabel,
    teamSize: normalizeText(input.teamSize || input.employeeCount || input.locationCount || "Workspace intake", 80),
    fieldRepCount: normalizeText(input.fieldRepCount || input.repCount || "1", 80),
    locationCount: normalizeText(input.locationCount || input.locations || "1", 80),
    geographicTerritory: normalizeText(input.geographicTerritory || input.territory || input.market, 220),
    primaryGoal,
    currentCrm: normalizeText(input.currentCrm || input.crm || "", 140),
    currentWorkflow,
    contactName,
    contactMethod,
    preferredCallWindow: normalizeText(input.preferredCallWindow || input.callWindow || "", 220),
    additionalContext: normalizeMultiline(input.additionalContext || input.notes || input.message || "", 1200),
    websiteUrl: normalizeText(input.websiteUrl || input.honeypot || input.company_url_hidden || "", 200)
  };
}

function validateSubmission(input = {}, workspace, openedAt = null, submittedAt = new Date()) {
  const errors = [];
  const sanitized = sanitizeLeadInput(input, workspace);
  const contactDigits = sanitized.contactMethod.replace(/[\s().-]/g, "");

  if (!workspace) errors.push("Workspace is required.");
  if (!sanitized.companyName) errors.push("Company or business name is required.");
  if (!sanitized.contactName) errors.push("Contact name is required.");
  if (!sanitized.contactMethod || !/(@|[0-9]{7,})/.test(contactDigits)) {
    errors.push("A valid email or phone number is required.");
  }
  if (!sanitized.primaryGoal) errors.push("Primary goal is required.");
  if (!sanitized.currentWorkflow) errors.push("Workflow or context is required.");
  if (sanitized.websiteUrl) errors.push("Spam check failed.");

  const openedTime = openedAt ? new Date(openedAt).getTime() : 0;
  const submittedTime = new Date(submittedAt).getTime();
  if (openedTime && Number.isFinite(submittedTime) && submittedTime - openedTime < 2500) {
    errors.push("Please review the intake before submitting.");
  }

  return {
    ok: errors.length === 0,
    errors,
    sanitized
  };
}

function normalizeAttribution(input = {}, request) {
  const attribution = input.attribution || {};
  const source = input.source || {};
  const url = new URL(request.url);
  return {
    provider: normalizeText(attribution.provider || source.provider || input.provider || "website", 80),
    campaignId: normalizeText(attribution.campaignId || source.campaignId || input.campaignId, 120) || null,
    leadSource: normalizeText(attribution.leadSource || source.leadSource || input.leadSource || "partner_intake", 120),
    formId: normalizeText(input.formId || input.form_id || source.formId || "partner-intake", 120),
    landingPath: normalizeText(attribution.landingPath || source.landingPath || url.pathname, 220),
    referrer: normalizeText(attribution.referrer || request.headers.get("referer") || "", 500),
    utm: {
      source: normalizeText(attribution.utm_source || input.utm_source || "", 120),
      medium: normalizeText(attribution.utm_medium || input.utm_medium || "", 120),
      campaign: normalizeText(attribution.utm_campaign || input.utm_campaign || "", 120),
      content: normalizeText(attribution.utm_content || input.utm_content || "", 120),
      term: normalizeText(attribution.utm_term || input.utm_term || "", 120)
    }
  };
}

function attributionSessionFor(attribution, submittedAt) {
  const touchId = `touch_${stableHash([
    attribution.provider,
    attribution.campaignId,
    attribution.formId,
    submittedAt
  ].join("|"))}`;
  const touch = {
    id: touchId,
    provider: attribution.provider,
    campaignId: attribution.campaignId,
    occurredAt: submittedAt,
    confidence: 0.4,
    metadata: {
      attribution_version: SHARED_LEAD_INTAKE_VERSION,
      campaign_id: attribution.campaignId || "",
      campaign_platform: attribution.provider,
      lead_source: attribution.leadSource,
      form_id: attribution.formId,
      landing_path: attribution.landingPath,
      referrer: attribution.referrer,
      utm_source: attribution.utm.source,
      utm_medium: attribution.utm.medium,
      utm_campaign: attribution.utm.campaign,
      utm_content: attribution.utm.content,
      utm_term: attribution.utm.term
    }
  };
  return {
    visitorId: `visitor_${stableHash([attribution.provider, attribution.referrer, attribution.formId].join("|"))}`,
    sessionId: `session_${stableHash([attribution.formId, submittedAt].join("|"))}`,
    firstTouch: touch,
    currentTouch: touch
  };
}

function memoryStorage() {
  const data = new Map();
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value))
  };
}

function submissionIdFor(input, workspace, submittedAt, idFactory) {
  if (typeof idFactory === "function") return idFactory({ input, workspace, submittedAt });
  const random = crypto?.randomUUID?.() || stableHash(`${submittedAt}|${Math.random()}`);
  return `sub_${submittedAt.replace(/[-:.TZ]/g, "").slice(0, 14)}_${random.replace(/-/g, "").slice(0, 12)}`;
}

function buildAuditTrail({ submittedAt, workspace, source }) {
  return [
    {
      at: submittedAt,
      actor: "prometheus_infrastructure",
      event: "submission_received",
      source
    },
    {
      at: submittedAt,
      actor: "workspace_router",
      event: "workspace_routed",
      workspaceId: workspace.workspaceId
    },
    {
      at: submittedAt,
      actor: "validation",
      event: "validation_passed"
    },
    {
      at: submittedAt,
      actor: "spam_protection",
      event: "spam_checks_passed"
    }
  ];
}

function buildCrmHandoff({ workspace, packet, submissionId, submittedAt }) {
  return {
    status: "prepared",
    mutationPerformed: false,
    ownerSubsystem: "Prometheus CRM",
    contract: "shared_workspace_crm_lead_intake_packet.v1",
    workspaceId: workspace.workspaceId,
    crmWorkspacePath: workspace.crmWorkspacePath,
    handoffId: `crm_handoff_${stableHash([workspace.workspaceId, submissionId].join("|"))}`,
    preparedAt: submittedAt,
    packet: {
      lead: packet.lead,
      crmIntegration: packet.crmIntegration,
      attribution: packet.attribution
    }
  };
}

function emailTextFor(record) {
  return [
    "Prometheus shared workspace lead intake",
    "",
    `Submission ID: ${record.submissionId}`,
    `Workspace: ${record.workspace.workspaceName} (${record.workspace.workspaceId})`,
    `Status: ${record.status}`,
    "",
    `Company: ${record.crmHandoff.packet.lead.companyName}`,
    `Contact: ${record.crmHandoff.packet.lead.requesterName}`,
    `Contact method: ${record.crmHandoff.packet.lead.contactMethod}`,
    `Operating profile: ${record.operatingProfile.label} (${record.operatingProfile.id})`,
    `Pipeline stage: ${record.crmHandoff.packet.lead.pipelineStage}`,
    `Source: ${record.source}`,
    "",
    `Primary goal: ${record.crmHandoff.packet.lead.primaryGoal}`,
    "Context:",
    record.crmHandoff.packet.lead.currentWorkflow || "",
    "",
    `CRM handoff: ${record.crmHandoff.crmWorkspacePath}`,
    `Attribution event: ${record.crmHandoff.packet.crmIntegration.attributionEvent.id}`
  ].join("\n");
}

function publicNotificationStatus(notification) {
  return {
    status: notification.status,
    channel: notification.channel,
    queued: notification.queued,
    sentAt: notification.sentAt || null,
    reason: notification.reason || null
  };
}

async function notifyFounder({ env, record, now = new Date() }) {
  const notification = {
    channel: "email",
    status: "queued",
    queued: true,
    reason: "",
    attemptedAt: nowIso(now),
    sentAt: null,
    messageId: null,
    futureHooks: {
      dashboard: "prepared",
      companion: "prepared"
    }
  };

  if (!env?.FOUNDER_EMAIL?.send) {
    notification.reason = "email_binding_not_configured";
    return notification;
  }

  try {
    const result = await env.FOUNDER_EMAIL.send({
      to: env.FOUNDER_NOTIFICATION_TO || undefined,
      from: env.FOUNDER_NOTIFICATION_FROM || "intake@prometheusrouteiq.com",
      subject: `Prometheus lead: ${record.workspace.workspaceName} - ${record.crmHandoff.packet.lead.companyName}`,
      text: emailTextFor(record),
      headers: {
        "X-Prometheus-Submission-ID": record.submissionId,
        "X-Prometheus-Workspace-ID": record.workspace.workspaceId
      }
    });
    notification.status = "sent";
    notification.queued = false;
    notification.sentAt = nowIso(now);
    notification.messageId = result?.messageId || null;
    return notification;
  } catch (error) {
    notification.reason = `email_send_failed:${error?.code || "unknown"}`;
    return notification;
  }
}

async function persistRecord(store, record) {
  if (!store?.put) {
    return {
      ok: false,
      missingBinding: "SHARED_LEAD_INTAKE_STORE"
    };
  }

  const baseKey = `${STORAGE_PREFIX}/workspaces/${record.workspace.workspaceId}/submissions/${record.submissionId}`;
  const globalKey = `${STORAGE_PREFIX}/submissions/${record.submissionId}`;
  const auditKey = `${STORAGE_PREFIX}/audit/${record.workspace.workspaceId}/${record.submissionId}`;
  const notificationKey = `${STORAGE_PREFIX}/notifications/${record.workspace.workspaceId}/${record.submissionId}`;

  await store.put(baseKey, JSON.stringify(record), {
    metadata: {
      workspaceId: record.workspace.workspaceId,
      submissionId: record.submissionId,
      status: record.status,
      timestamp: record.timestamp
    }
  });
  await store.put(globalKey, JSON.stringify({
    workspaceId: record.workspace.workspaceId,
    submissionId: record.submissionId,
    key: baseKey,
    timestamp: record.timestamp,
    status: record.status
  }));
  await store.put(auditKey, JSON.stringify(record.auditTrail));
  await store.put(notificationKey, JSON.stringify(record.founderNotification));

  return {
    ok: true,
    keys: {
      submission: baseKey,
      global: globalKey,
      audit: auditKey,
      notification: notificationKey
    }
  };
}

async function parsePartnerIntakeBody(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return {
      ok: false,
      status: 413,
      errors: ["Submission body is too large."]
    };
  }

  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      return { ok: true, input: await request.json() };
    }
    if (contentType.includes("application/x-www-form-urlencoded")) {
      return { ok: true, input: Object.fromEntries(await request.formData()) };
    }
    return {
      ok: false,
      status: 415,
      errors: ["Unsupported content type. Use application/json or application/x-www-form-urlencoded."]
    };
  } catch {
    return {
      ok: false,
      status: 400,
      errors: ["Malformed intake submission."]
    };
  }
}

async function createSharedLeadIntakeSubmission({
  input = {},
  request,
  env = {},
  now = new Date(),
  idFactory
}) {
  const submittedAt = nowIso(now);
  const workspace = resolveWorkspace(input);
  if (!workspace) {
    return {
      ok: false,
      status: 400,
      errors: ["Unknown or missing workspace. Intake submissions must target a registered isolated workspace."],
      workspaceRegistry: workspaceRegistry()
    };
  }

  const openedAt = input.openedAt || input.formOpenedAt || input.loadedAt || null;
  const validation = validateSubmission(input, workspace, openedAt, submittedAt);
  if (!validation.ok) {
    return {
      ok: false,
      status: validation.errors.some(error => error.includes("Spam")) ? 400 : 422,
      errors: validation.errors,
      workspace: {
        workspaceId: workspace.workspaceId,
        workspaceName: workspace.workspaceName
      }
    };
  }

  const attribution = normalizeAttribution(input, request);
  const packet = createEnterpriseLeadIntake({
    formData: validation.sanitized,
    attributionSession: attributionSessionFor(attribution, submittedAt),
    duplicateStorage: memoryStorage(),
    now: new Date(submittedAt),
    openedAt,
    commitDuplicate: false
  });

  if (!packet.ok) {
    return {
      ok: false,
      status: 422,
      errors: packet.errors,
      workspace: {
        workspaceId: workspace.workspaceId,
        workspaceName: workspace.workspaceName
      }
    };
  }

  packet.lead.workspaceId = workspace.workspaceId;
  packet.lead.workspaceName = workspace.workspaceName;
  packet.lead.operatingProfile = {
    profileId: workspace.operatingProfileId,
    profileLabel: workspace.operatingProfileLabel,
    crmProfileId: workspace.operatingProfileId,
    requestedProfile: workspace.operatingProfileLabel,
    futureProfileRequested: false
  };
  packet.crmIntegration.operatingProfileId = workspace.operatingProfileId;
  packet.crmIntegration.workspaceId = workspace.workspaceId;

  const submissionId = submissionIdFor(input, workspace, submittedAt, idFactory);
  const source = attribution.leadSource || "partner_intake";
  const record = {
    ok: true,
    version: SHARED_LEAD_INTAKE_VERSION,
    submissionId,
    timestamp: submittedAt,
    workspace: {
      workspaceId: workspace.workspaceId,
      workspaceName: workspace.workspaceName
    },
    operatingProfile: {
      id: workspace.operatingProfileId,
      label: workspace.operatingProfileLabel
    },
    attribution,
    source,
    status: "received",
    security: {
      spamProtected: true,
      validationPassed: true,
      workspaceIsolation: "enforced",
      crossWorkspaceRouting: false
    },
    crmHandoff: buildCrmHandoff({ workspace, packet, submissionId, submittedAt }),
    auditTrail: buildAuditTrail({ submittedAt, workspace, source }),
    founderNotification: {
      channel: "email",
      status: "pending",
      queued: true,
      reason: "awaiting_durable_storage",
      attemptedAt: null,
      sentAt: null,
      messageId: null,
      futureHooks: {
        dashboard: "prepared",
        companion: "prepared"
      }
    }
  };

  record.auditTrail.push({
    at: submittedAt,
    actor: "durable_storage",
    event: "submission_record_prepared",
    workspaceId: workspace.workspaceId
  });
  record.auditTrail.push({
    at: submittedAt,
    actor: "crm_handoff",
    event: "workspace_crm_handoff_prepared",
    workspaceId: workspace.workspaceId,
    mutationPerformed: false
  });

  const firstPersisted = await persistRecord(env.SHARED_LEAD_INTAKE_STORE, record);
  if (!firstPersisted.ok) {
    return {
      ok: false,
      status: 503,
      errors: ["Shared lead intake durable storage is not configured."],
      missingBinding: firstPersisted.missingBinding
    };
  }
  record.storage = {
    status: "persisted",
    keys: firstPersisted.keys
  };
  record.auditTrail.push({
    at: nowIso(now),
    actor: "durable_storage",
    event: "submission_persisted",
    workspaceId: workspace.workspaceId
  });

  record.founderNotification = await notifyFounder({ env, record, now });
  record.auditTrail.push({
    at: nowIso(now),
    actor: "founder_notification",
    event: `email_${record.founderNotification.status}`,
    queued: record.founderNotification.queued,
    reason: record.founderNotification.reason || ""
  });

  await persistRecord(env.SHARED_LEAD_INTAKE_STORE, record);

  return {
    ok: true,
    status: 201,
    record
  };
}

function publicSubmissionResponse(record) {
  return {
    ok: true,
    version: record.version,
    submissionId: record.submissionId,
    timestamp: record.timestamp,
    workspaceId: record.workspace.workspaceId,
    workspaceName: record.workspace.workspaceName,
    operatingProfile: record.operatingProfile,
    source: record.source,
    status: record.status,
    storage: {
      status: record.storage.status,
      submissionKey: record.storage.keys.submission,
      auditKey: record.storage.keys.audit
    },
    crmHandoff: {
      status: record.crmHandoff.status,
      ownerSubsystem: record.crmHandoff.ownerSubsystem,
      contract: record.crmHandoff.contract,
      mutationPerformed: record.crmHandoff.mutationPerformed,
      workspaceId: record.crmHandoff.workspaceId
    },
    founderNotification: publicNotificationStatus(record.founderNotification),
    futureHooks: record.founderNotification.futureHooks,
    auditTrail: record.auditTrail.map(entry => ({
      at: entry.at,
      actor: entry.actor,
      event: entry.event,
      workspaceId: entry.workspaceId || undefined
    }))
  };
}

async function handlePartnerIntakeRequest(request, env) {
  if (request.method !== "POST") {
    return {
      body: {
        ok: false,
        message: "Method not allowed.",
        allowedMethods: ["POST", "OPTIONS"]
      },
      status: 405,
      headers: { Allow: "POST, OPTIONS" }
    };
  }

  const parsed = await parsePartnerIntakeBody(request);
  if (!parsed.ok) {
    return {
      body: {
        ok: false,
        errors: parsed.errors
      },
      status: parsed.status
    };
  }

  const result = await createSharedLeadIntakeSubmission({
    input: parsed.input,
    request,
    env
  });
  if (!result.ok) {
    return {
      body: {
        ok: false,
        errors: result.errors,
        missingBinding: result.missingBinding,
        workspace: result.workspace,
        workspaceRegistry: result.workspaceRegistry
      },
      status: result.status
    };
  }

  return {
    body: publicSubmissionResponse(result.record),
    status: result.status,
    record: result.record
  };
}

export {
  PARTNER_INTAKE_PATH,
  SHARED_LEAD_INTAKE_VERSION,
  WORKSPACES,
  createSharedLeadIntakeSubmission,
  handlePartnerIntakeRequest,
  publicSubmissionResponse,
  resolveWorkspace,
  validateSubmission,
  workspaceRegistry
};
