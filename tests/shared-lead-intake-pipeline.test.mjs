import test from "node:test";
import assert from "node:assert/strict";
import {
  PARTNER_INTAKE_PATH,
  createSharedLeadIntakeSubmission,
  handlePartnerIntakeRequest,
  resolveWorkspace,
  validateSubmission
} from "../workers/infrastructure/shared-lead-intake-pipeline.js";
import {
  aegisRoutePolicy
} from "../workers/infrastructure/aegis-security-controls.js";

function kvStore() {
  const data = new Map();
  const metadata = new Map();
  return {
    data,
    metadata,
    async get(key) {
      return data.get(key) || null;
    },
    async put(key, value, options = {}) {
      data.set(key, String(value));
      metadata.set(key, options.metadata || {});
    }
  };
}

function request(path = PARTNER_INTAKE_PATH, init = {}) {
  return new Request(`https://prometheusrouteiq.com${path}`, {
    method: init.method || "POST",
    headers: {
      "content-type": "application/json",
      ...(init.headers || {})
    },
    body: init.body === undefined ? JSON.stringify(sampleLead()) : init.body
  });
}

function sampleLead(overrides = {}) {
  return {
    workspaceId: "fitness_connection",
    formId: "fitness_connection_partner_intake",
    requestType: "private_demo",
    companyName: "Fitness Connection Houston",
    contactName: "Sam Operator",
    contactMethod: "sam@example.com",
    primaryGoal: "Route stronger LSM leads to the correct gym team.",
    currentWorkflow: "Managers collect interest locally and then hand qualified leads into the workspace CRM.",
    teamSize: "12 field sellers",
    locationCount: "8",
    source: {
      provider: "website",
      formId: "fitness_connection_partner_intake"
    },
    attribution: {
      provider: "website",
      campaignId: "workspace-intake-test",
      utm_source: "partner-page"
    },
    openedAt: "2026-07-03T15:00:00.000Z",
    ...overrides
  };
}

test("workspace router resolves current isolated workspaces through explicit aliases", () => {
  assert.equal(resolveWorkspace({ workspaceId: "fitness_connection" }).workspaceId, "fitness_connection");
  assert.equal(resolveWorkspace({ workspace: "Fitness Connection" }).workspaceId, "fitness_connection");
  assert.equal(resolveWorkspace({ formId: "smoothie_depot_partner_intake" }).workspaceId, "smoothie_depot");
  assert.equal(resolveWorkspace({ partner: "Smoothie Depot" }).workspaceId, "smoothie_depot");
  assert.equal(resolveWorkspace({ workspaceId: "unknown_customer" }), null);
});

test("shared lead intake persists Fitness Connection submission without cross-workspace contamination", async () => {
  const store = kvStore();
  const emailCalls = [];
  const result = await createSharedLeadIntakeSubmission({
    input: sampleLead(),
    request: request(),
    env: {
      SHARED_LEAD_INTAKE_STORE: store,
      FOUNDER_EMAIL: {
        send: async message => {
          emailCalls.push(message);
          return { messageId: "email_fitness_1" };
        }
      },
      FOUNDER_NOTIFICATION_FROM: "intake@prometheusrouteiq.com",
      FOUNDER_NOTIFICATION_TO: "prometheusrouteiq@gmail.com"
    },
    now: new Date("2026-07-03T15:01:00.000Z"),
    idFactory: () => "sub_test_fitness"
  });

  assert.equal(result.ok, true);
  assert.equal(result.record.workspace.workspaceId, "fitness_connection");
  assert.equal(result.record.operatingProfile.id, "fitness");
  assert.equal(result.record.storage.status, "persisted");
  assert.equal(result.record.founderNotification.status, "sent");
  assert.equal(emailCalls.length, 1);
  assert.ok(store.data.has("shared-lead-intake/workspaces/fitness_connection/submissions/sub_test_fitness"));
  assert.equal(store.data.has("shared-lead-intake/workspaces/smoothie_depot/submissions/sub_test_fitness"), false);
  assert.equal(result.record.crmHandoff.ownerSubsystem, "Prometheus CRM");
  assert.equal(result.record.crmHandoff.mutationPerformed, false);
});

test("shared lead intake routes Smoothie Depot into its workspace and keeps Fitness data isolated", async () => {
  const store = kvStore();
  const result = await createSharedLeadIntakeSubmission({
    input: sampleLead({
      workspaceId: "smoothie_depot",
      formId: "smoothie_depot_partner_intake",
      companyName: "Smoothie Depot Candidate Group",
      primaryGoal: "Qualify a franchise-owner candidate for JR handoff.",
      currentWorkflow: "Cruz sources candidate interest, validates fit, and packages a CRM handoff for Smoothie Depot.",
      contactMethod: "candidate@example.com"
    }),
    request: request(),
    env: { SHARED_LEAD_INTAKE_STORE: store },
    now: new Date("2026-07-03T15:02:00.000Z"),
    idFactory: () => "sub_test_smoothie"
  });

  assert.equal(result.ok, true);
  assert.equal(result.record.workspace.workspaceId, "smoothie_depot");
  assert.equal(result.record.operatingProfile.id, "franchise_development");
  assert.equal(result.record.crmHandoff.workspaceId, "smoothie_depot");
  assert.equal(result.record.founderNotification.status, "queued");
  assert.equal(result.record.founderNotification.reason, "email_binding_not_configured");
  assert.ok(store.data.has("shared-lead-intake/workspaces/smoothie_depot/submissions/sub_test_smoothie"));
  assert.equal(store.data.has("shared-lead-intake/workspaces/fitness_connection/submissions/sub_test_smoothie"), false);
});

test("shared lead intake rejects unknown workspace and spam before persistence", async () => {
  const store = kvStore();
  const unknown = await createSharedLeadIntakeSubmission({
    input: sampleLead({
      workspaceId: "unregistered_workspace",
      formId: "unregistered_form",
      source: { provider: "website", formId: "unregistered_form" }
    }),
    request: request(),
    env: { SHARED_LEAD_INTAKE_STORE: store },
    now: new Date("2026-07-03T15:03:00.000Z")
  });
  const spamWorkspace = resolveWorkspace(sampleLead());
  const spamValidation = validateSubmission(sampleLead({ websiteUrl: "https://bot.example" }), spamWorkspace, "2026-07-03T15:00:00.000Z", "2026-07-03T15:03:00.000Z");

  assert.equal(unknown.ok, false);
  assert.equal(unknown.status, 400);
  assert.equal(store.data.size, 0);
  assert.equal(spamValidation.ok, false);
  assert.equal(spamValidation.errors.some(error => error.includes("Spam check failed")), true);
});

test("partner intake endpoint returns public success metadata only", async () => {
  const store = kvStore();
  const result = await handlePartnerIntakeRequest(request(undefined, {
    body: JSON.stringify(sampleLead({ workspaceId: "fitness_connection" }))
  }), {
    SHARED_LEAD_INTAKE_STORE: store
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.workspaceId, "fitness_connection");
  assert.equal(result.body.storage.status, "persisted");
  assert.equal(result.body.crmHandoff.ownerSubsystem, "Prometheus CRM");
  assert.equal(result.body.crmHandoff.mutationPerformed, false);
  assert.equal("contactMethod" in result.body, false);
  assert.equal("packet" in result.body.crmHandoff, false);
});

test("Aegis protects partner intake as lead intake", () => {
  const policy = aegisRoutePolicy(PARTNER_INTAKE_PATH);

  assert.equal(policy.id, "lead_intake");
  assert.equal(policy.methods.includes("POST"), true);
  assert.equal(policy.methods.includes("OPTIONS"), true);
});
