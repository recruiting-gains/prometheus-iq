import test from "node:test";
import assert from "node:assert/strict";
import {
  SOCIAL_ATTRIBUTION_EVENT_TYPES,
  SOCIAL_ATTRIBUTION_TARGETS,
  SOCIAL_DATA_SOURCES,
  createAttributionEvent
} from "../social-media/contracts/social-media-contract.js";
import {
  createWebsiteAttributionSession
} from "../deploy/prometheusrouteiq-website/website-attribution.js";
import {
  createEnterpriseLeadIntake,
  buildEnterpriseLeadMailto,
  normalizeOperatingProfile
} from "../deploy/prometheusrouteiq-website/enterprise-lead-intake.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
    clear: () => data.clear()
  };
}

function sampleForm(overrides = {}) {
  return {
    requestType: "private_demo",
    companyName: "Acme Field Sales",
    companyWebsite: "https://example.com",
    requesterRole: "VP Sales",
    operatingProfileId: "roofing",
    teamSize: "21-50 field sellers",
    fieldRepCount: "32",
    locationCount: "4",
    geographicTerritory: "Houston and DFW",
    primaryGoal: "Better Routing",
    currentCrm: "HubSpot",
    currentWorkflow: "Reps choose routes manually, then enter clean leads after the day ends.",
    contactName: "Taylor Founder",
    contactMethod: "taylor@example.com",
    preferredCallWindow: "Tuesday morning CT",
    additionalContext: "Need manager visibility without surveillance.",
    websiteUrl: "",
    ...overrides
  };
}

function sampleAttribution() {
  const localStorage = memoryStorage();
  return createWebsiteAttributionSession({
    locationHref: "https://prometheusrouteiq.com/?utm_source=instagram&utm_medium=social&utm_campaign=enterprise-intake-v1&utm_content=founder-story",
    referrer: "https://l.instagram.com/",
    localStorage,
    sessionStorage: memoryStorage(),
    now: new Date("2026-07-02T15:00:00.000Z")
  });
}

test("enterprise intake creates a founder-ready CRM lead packet with Website/Social attribution", () => {
  const packet = createEnterpriseLeadIntake({
    formData: sampleForm(),
    attributionSession: sampleAttribution(),
    duplicateStorage: memoryStorage(),
    now: new Date("2026-07-02T15:05:00.000Z"),
    openedAt: "2026-07-02T15:04:50.000Z"
  });
  const event = createAttributionEvent(packet.crmIntegration.attributionEvent);

  assert.equal(packet.ok, true);
  assert.equal(packet.lead.status, "New Lead");
  assert.equal(packet.lead.pipelineStage, "Discovery Requested");
  assert.equal(packet.lead.operatingProfile.crmProfileId, "roofing");
  assert.equal(packet.founderSummary.whoRequested, "Taylor Founder");
  assert.equal(packet.founderSummary.company, "Acme Field Sales");
  assert.equal(packet.founderSummary.teamSize, "21-50 field sellers");
  assert.equal(packet.crmIntegration.path, "Lead -> Operating Profile -> CRM -> Pipeline");
  assert.equal(event.type, SOCIAL_ATTRIBUTION_EVENT_TYPES.CRM_LEAD_CREATED);
  assert.equal(event.target, SOCIAL_ATTRIBUTION_TARGETS.CRM_LEAD);
  assert.equal(event.source, SOCIAL_DATA_SOURCES.CRM_CONTRACT);
  assert.equal(event.metadata.utm_source, "instagram");
  assert.equal(event.metadata.operating_profile_id, "roofing");
});

test("enterprise intake supports future operating profiles through general outside sales CRM fallback", () => {
  const profile = normalizeOperatingProfile("commercial_cleaning", "Commercial Cleaning");
  const packet = createEnterpriseLeadIntake({
    formData: sampleForm({
      requestType: "enterprise_pricing",
      operatingProfileId: "commercial_cleaning",
      otherOperatingProfile: "Commercial Cleaning"
    }),
    attributionSession: sampleAttribution(),
    duplicateStorage: memoryStorage(),
    now: new Date("2026-07-02T15:05:00.000Z"),
    openedAt: "2026-07-02T15:04:50.000Z"
  });

  assert.equal(profile.futureProfileRequested, true);
  assert.equal(profile.crmProfileId, "general_outside_sales");
  assert.equal(packet.lead.pipelineStage, "Pricing Requested");
  assert.equal(packet.lead.operatingProfile.requestedProfile, "Commercial Cleaning");
  assert.equal(packet.lead.operatingProfile.crmProfileId, "general_outside_sales");
});

test("enterprise intake detects local duplicates without blocking founder handoff", () => {
  const storage = memoryStorage();
  const first = createEnterpriseLeadIntake({
    formData: sampleForm(),
    attributionSession: sampleAttribution(),
    duplicateStorage: storage,
    now: new Date("2026-07-02T15:05:00.000Z"),
    openedAt: "2026-07-02T15:04:50.000Z"
  });
  const second = createEnterpriseLeadIntake({
    formData: sampleForm(),
    attributionSession: sampleAttribution(),
    duplicateStorage: storage,
    now: new Date("2026-07-02T15:06:00.000Z"),
    openedAt: "2026-07-02T15:05:50.000Z"
  });

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.ok, true);
});

test("enterprise intake rejects honeypot spam and incomplete workflow context", () => {
  const spam = createEnterpriseLeadIntake({
    formData: sampleForm({ websiteUrl: "https://bot.example", currentWorkflow: "" }),
    attributionSession: sampleAttribution(),
    duplicateStorage: memoryStorage(),
    now: new Date("2026-07-02T15:05:00.000Z"),
    openedAt: "2026-07-02T15:04:50.000Z"
  });

  assert.equal(spam.ok, false);
  assert.equal(spam.errors.some(error => error.includes("Spam check failed")), true);
  assert.equal(spam.errors.some(error => error.includes("Current sales workflow")), true);
});

test("enterprise intake mailto includes founder-critical fields without exposing credentials", () => {
  const packet = createEnterpriseLeadIntake({
    formData: sampleForm(),
    attributionSession: sampleAttribution(),
    duplicateStorage: memoryStorage(),
    now: new Date("2026-07-02T15:05:00.000Z"),
    openedAt: "2026-07-02T15:04:50.000Z"
  });
  const mailto = decodeURIComponent(buildEnterpriseLeadMailto(packet));

  assert.equal(mailto.includes("Pipeline stage: Discovery Requested"), true);
  assert.equal(mailto.includes("Operating Profile: Roofing"), true);
  assert.equal(mailto.includes("Lead source: instagram"), true);
  assert.equal(/token|secret|password/i.test(mailto), false);
});
