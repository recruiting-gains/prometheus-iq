export const ENTERPRISE_LEAD_INTAKE_VERSION = "prometheus-enterprise-lead-intake.v1";
export const ENTERPRISE_LEAD_EVENT_KEY = "prometheus.website.enterpriseLeadIntake.events";
export const ENTERPRISE_LEAD_DUPLICATE_KEY = "prometheus.website.enterpriseLeadIntake.duplicates";
export const ENTERPRISE_LEAD_LAST_PACKET_KEY = "prometheus.website.enterpriseLeadIntake.lastPacket";
export const ENTERPRISE_LEAD_MAX_EVENTS = 25;

export const OPERATING_PROFILE_OPTIONS = Object.freeze([
  { profileId: "fitness", label: "Fitness", crmProfileId: "fitness" },
  { profileId: "roofing", label: "Roofing", crmProfileId: "roofing" },
  { profileId: "security", label: "Security", crmProfileId: "security" },
  { profileId: "medical", label: "Medical", crmProfileId: "medical" },
  { profileId: "insurance", label: "Insurance", crmProfileId: "insurance" },
  { profileId: "solar", label: "Solar", crmProfileId: "solar" },
  { profileId: "home_services", label: "Home Services", crmProfileId: "home_services" },
  { profileId: "general_outside_sales", label: "General Outside Sales", crmProfileId: "general_outside_sales" }
]);

export const REQUEST_TYPES = Object.freeze({
  private_demo: {
    label: "Private Demo",
    pipelineStage: "Discovery Requested",
    founderAction: "Schedule private demo"
  },
  beta_pilot: {
    label: "Beta Pilot",
    pipelineStage: "Beta Pilot Requested",
    founderAction: "Review beta pilot fit"
  },
  enterprise_pricing: {
    label: "Enterprise Pricing",
    pipelineStage: "Pricing Requested",
    founderAction: "Prepare enterprise pricing discovery"
  },
  discovery_call: {
    label: "Discovery Call",
    pipelineStage: "Discovery Call Requested",
    founderAction: "Schedule discovery call"
  }
});

const CRM_CONTRACT_SOURCE = "crm_contract";
const CRM_LEAD_CREATED = "crm_lead_created";
const CRM_LEAD_TARGET = "crm_lead";
const WEBSITE_TRAFFIC_TARGET = "website_traffic";

function nowIso(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeText(value, maxLength = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeLongText(value, maxLength = 1600) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, maxLength);
}

function numericValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function slug(value) {
  return normalizeText(value, 80).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
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

function storageGet(storage, key, fallback) {
  try {
    const value = storage?.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function storageSet(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Lead intake storage should never block the visitor flow.
  }
}

function firstAndLastTouch(attributionSession = {}) {
  const currentTouch = attributionSession.currentTouch || null;
  const firstTouch = attributionSession.firstTouch || currentTouch;
  return {
    firstTouch,
    lastTouch: currentTouch || firstTouch,
    visitorId: attributionSession.visitorId || currentTouch?.visitorId || firstTouch?.visitorId || null,
    sessionId: attributionSession.sessionId || currentTouch?.metadata?.session_id || null
  };
}

function normalizeRequestType(value) {
  const key = REQUEST_TYPES[value] ? value : "beta_pilot";
  return { key, ...REQUEST_TYPES[key] };
}

export function normalizeOperatingProfile(profileId, otherProfile = "") {
  const requestedId = slug(profileId);
  const configured = OPERATING_PROFILE_OPTIONS.find(profile => profile.profileId === requestedId);
  if (configured) {
    return {
      profileId: configured.profileId,
      profileLabel: configured.label,
      crmProfileId: configured.crmProfileId,
      requestedProfile: configured.label,
      futureProfileRequested: false
    };
  }

  const requestedProfile = normalizeText(otherProfile || profileId || "General Outside Sales", 120);
  return {
    profileId: requestedId || "general_outside_sales",
    profileLabel: requestedProfile,
    crmProfileId: "general_outside_sales",
    requestedProfile,
    futureProfileRequested: true
  };
}

export function validateEnterpriseLeadInput(formData = {}, options = {}) {
  const errors = [];
  const companyName = normalizeText(formData.companyName, 140);
  const contactName = normalizeText(formData.contactName, 140);
  const contactMethod = normalizeText(formData.contactMethod, 180);
  const primaryGoal = normalizeText(formData.primaryGoal, 180);
  const currentWorkflow = normalizeLongText(formData.currentWorkflow || formData.biggestChallenge, 1200);
  const requestType = normalizeRequestType(formData.requestType);
  const openedAt = options.openedAt ? new Date(options.openedAt).getTime() : 0;
  const submittedAt = options.submittedAt ? new Date(options.submittedAt).getTime() : Date.now();

  if (!companyName) errors.push("Company name is required.");
  if (!contactName) errors.push("Requester name is required.");
  if (!contactMethod || !/(@|[0-9]{7,})/.test(contactMethod.replace(/[\s().-]/g, ""))) {
    errors.push("A valid email or phone number is required.");
  }
  if (!formData.operatingProfileId) errors.push("Operating profile is required.");
  if (!formData.teamSize) errors.push("Team size is required.");
  if (!primaryGoal) errors.push("Primary goal is required.");
  if (!currentWorkflow) errors.push("Current sales workflow is required.");
  if (normalizeText(formData.websiteUrl, 120)) errors.push("Spam check failed.");
  if (openedAt && submittedAt - openedAt < 2500) errors.push("Please review the intake before submitting.");

  return {
    valid: errors.length === 0,
    errors,
    requestType
  };
}

export function createLeadFingerprint(formData = {}) {
  return stableHash([
    normalizeText(formData.companyName, 140).toLowerCase(),
    normalizeText(formData.contactMethod, 180).toLowerCase(),
    slug(formData.operatingProfileId || formData.otherOperatingProfile),
    normalizeText(formData.requestType, 80).toLowerCase()
  ].join("|"));
}

export function createEnterpriseLeadIntake({
  formData = {},
  attributionSession = {},
  duplicateStorage,
  now = new Date(),
  openedAt = null,
  commitDuplicate = true
} = {}) {
  const occurredAt = nowIso(now);
  const validation = validateEnterpriseLeadInput(formData, { openedAt, submittedAt: occurredAt });
  if (!validation.valid) {
    return {
      ok: false,
      errors: validation.errors
    };
  }

  const requestType = validation.requestType;
  const operatingProfile = normalizeOperatingProfile(formData.operatingProfileId, formData.otherOperatingProfile);
  const touches = firstAndLastTouch(attributionSession);
  const firstTouch = touches.firstTouch;
  const lastTouch = touches.lastTouch || firstTouch;
  const fingerprint = createLeadFingerprint(formData);
  const duplicateMap = storageGet(duplicateStorage, ENTERPRISE_LEAD_DUPLICATE_KEY, {});
  const duplicate = Boolean(duplicateMap[fingerprint]);
  const companyName = normalizeText(formData.companyName, 140);
  const contactName = normalizeText(formData.contactName, 140);
  const contactMethod = normalizeText(formData.contactMethod, 180);
  const leadId = `web_lead_${stableHash([companyName, contactMethod, operatingProfile.crmProfileId, occurredAt.slice(0, 10)].join("|"))}`;
  const campaignId = lastTouch?.campaignId || lastTouch?.metadata?.campaign_id || null;
  const leadSource = lastTouch?.metadata?.utm_source || lastTouch?.metadata?.campaign_platform || lastTouch?.provider || "website";
  const campaignPlatform = lastTouch?.metadata?.campaign_platform || lastTouch?.provider || leadSource;
  const teamSize = normalizeText(formData.teamSize, 80);
  const locationCount = Math.max(1, numericValue(formData.locationCount, 1));
  const fieldRepCount = Math.max(1, numericValue(formData.fieldRepCount, 1));
  const primaryGoal = normalizeText(formData.primaryGoal, 180);
  const currentWorkflow = normalizeLongText(formData.currentWorkflow || formData.biggestChallenge, 1200);

  const attributionEvent = {
    id: `crm_attr_${stableHash([leadId, firstTouch?.id, lastTouch?.id, occurredAt].join("|"))}`,
    type: CRM_LEAD_CREATED,
    target: CRM_LEAD_TARGET,
    source: CRM_CONTRACT_SOURCE,
    provider: lastTouch?.provider || firstTouch?.provider || null,
    campaignId,
    occurredAt,
    visitorId: touches.visitorId,
    leadId,
    value: 1,
    confidence: Number(lastTouch?.confidence ?? firstTouch?.confidence ?? 0.15),
    metadata: {
      intake_version: ENTERPRISE_LEAD_INTAKE_VERSION,
      lead_source: leadSource,
      campaign_platform: campaignPlatform,
      first_touch_at: firstTouch?.occurredAt || occurredAt,
      last_touch_at: lastTouch?.occurredAt || occurredAt,
      qualified_status: "New Lead",
      pipeline_stage: requestType.pipelineStage,
      operating_profile_id: operatingProfile.crmProfileId,
      requested_operating_profile: operatingProfile.requestedProfile,
      future_profile_requested: operatingProfile.futureProfileRequested,
      website_first_touch_event_id: firstTouch?.id || "",
      website_last_touch_event_id: lastTouch?.id || "",
      website_attribution_version: lastTouch?.metadata?.attribution_version || firstTouch?.metadata?.attribution_version || "",
      utm_source: lastTouch?.metadata?.utm_source || "",
      utm_medium: lastTouch?.metadata?.utm_medium || "",
      utm_campaign: lastTouch?.metadata?.utm_campaign || "",
      utm_content: lastTouch?.metadata?.utm_content || "",
      utm_term: lastTouch?.metadata?.utm_term || "",
      landing_path: lastTouch?.metadata?.landing_path || "",
      referrer: lastTouch?.metadata?.referrer || ""
    }
  };

  const packet = {
    ok: true,
    version: ENTERPRISE_LEAD_INTAKE_VERSION,
    createdAt: occurredAt,
    duplicate,
    security: {
      spamProtected: true,
      honeypotPassed: true,
      duplicateFingerprint: fingerprint,
      duplicateDetected: duplicate
    },
    lead: {
      id: leadId,
      source: "website_enterprise_intake",
      status: "New Lead",
      pipelineStage: requestType.pipelineStage,
      requestType: requestType.key,
      requestLabel: requestType.label,
      founderAction: requestType.founderAction,
      companyName,
      companyWebsite: normalizeText(formData.companyWebsite, 220),
      requesterName: contactName,
      requesterRole: normalizeText(formData.requesterRole, 140),
      contactMethod,
      operatingProfile,
      teamSize,
      fieldRepCount,
      locationCount,
      territory: normalizeText(formData.geographicTerritory, 220),
      primaryGoal,
      currentCrm: normalizeText(formData.currentCrm, 140),
      currentWorkflow,
      preferredCallWindow: normalizeText(formData.preferredCallWindow, 220),
      message: normalizeLongText(formData.additionalContext, 1200),
      founderVisible: true,
      dueAt: ""
    },
    founderSummary: {
      whoRequested: contactName,
      company: companyName,
      operatingProfile: operatingProfile.profileLabel,
      requestedOperatingProfile: operatingProfile.requestedProfile,
      teamSize,
      primaryGoal,
      pipelineStage: requestType.pipelineStage,
      requestType: requestType.label,
      founderAction: requestType.founderAction
    },
    crmIntegration: {
      path: "Lead -> Operating Profile -> CRM -> Pipeline",
      crmContract: "existing_crm_attribution_contract",
      leadStatus: "New Lead",
      pipelineStage: requestType.pipelineStage,
      operatingProfileId: operatingProfile.crmProfileId,
      attributionEvent
    },
    attribution: {
      website: {
        firstTouch,
        lastTouch,
        visitorId: touches.visitorId,
        sessionId: touches.sessionId
      },
      social: {
        provider: attributionEvent.provider,
        campaignId,
        leadSource,
        campaignPlatform
      }
    }
  };

  if (commitDuplicate && duplicateStorage) {
    duplicateMap[fingerprint] = {
      leadId,
      companyName,
      contactMethod,
      operatingProfileId: operatingProfile.crmProfileId,
      requestType: requestType.key,
      createdAt: occurredAt
    };
    storageSet(duplicateStorage, ENTERPRISE_LEAD_DUPLICATE_KEY, duplicateMap);
    const events = storageGet(duplicateStorage, ENTERPRISE_LEAD_EVENT_KEY, []);
    const nextEvents = Array.isArray(events) ? events : [];
    nextEvents.push(packet);
    storageSet(duplicateStorage, ENTERPRISE_LEAD_EVENT_KEY, nextEvents.slice(-ENTERPRISE_LEAD_MAX_EVENTS));
    storageSet(duplicateStorage, ENTERPRISE_LEAD_LAST_PACKET_KEY, packet);
  }

  return packet;
}

export function buildEnterpriseLeadMailto(packet, email = "prometheusrouteiq@gmail.com") {
  const lead = packet?.lead || {};
  const summary = packet?.founderSummary || {};
  const attribution = packet?.crmIntegration?.attributionEvent || {};
  const body = [
    "Prometheus IQ enterprise lead intake",
    "",
    `Request type: ${summary.requestType || lead.requestLabel || ""}`,
    `Founder action: ${summary.founderAction || lead.founderAction || ""}`,
    `Pipeline stage: ${summary.pipelineStage || lead.pipelineStage || ""}`,
    "",
    `Requester: ${summary.whoRequested || lead.requesterName || ""}`,
    `Company: ${summary.company || lead.companyName || ""}`,
    `Role: ${lead.requesterRole || ""}`,
    `Contact: ${lead.contactMethod || ""}`,
    `Website: ${lead.companyWebsite || ""}`,
    "",
    `Operating Profile: ${summary.operatingProfile || lead.operatingProfile?.profileLabel || ""}`,
    `Requested Profile: ${summary.requestedOperatingProfile || lead.operatingProfile?.requestedProfile || ""}`,
    `CRM Profile ID: ${lead.operatingProfile?.crmProfileId || ""}`,
    `Team size: ${summary.teamSize || lead.teamSize || ""}`,
    `Field reps: ${lead.fieldRepCount || ""}`,
    `Locations: ${lead.locationCount || ""}`,
    `Territory: ${lead.territory || ""}`,
    "",
    `Primary goal: ${summary.primaryGoal || lead.primaryGoal || ""}`,
    `Current CRM: ${lead.currentCrm || ""}`,
    "Current sales workflow:",
    lead.currentWorkflow || "",
    "",
    `Preferred call window: ${lead.preferredCallWindow || ""}`,
    `Additional context: ${lead.message || ""}`,
    "",
    "CRM / attribution",
    `Lead ID: ${lead.id || ""}`,
    `CRM path: ${packet?.crmIntegration?.path || ""}`,
    `Attribution event ID: ${attribution.id || ""}`,
    `Lead source: ${attribution.metadata?.lead_source || ""}`,
    `Campaign: ${attribution.campaignId || ""}`,
    `Visitor ID: ${attribution.visitorId || ""}`,
    "",
    `Duplicate detected: ${packet?.duplicate ? "yes" : "no"}`
  ].join("\n");

  return `mailto:${email}?subject=${encodeURIComponent(`Prometheus IQ ${summary.requestType || "Enterprise"} Request - ${summary.company || lead.companyName || ""}`)}&body=${encodeURIComponent(body)}`;
}
