import test from "node:test";
import assert from "node:assert/strict";
import {
  PARTNER_INTAKE_PATH,
  SHARED_LEAD_WORKSPACE_REGISTRY_VERSION,
  WORKSPACE_REGISTRY_ENV,
  createSharedLeadIntakeSubmission,
  handlePartnerIntakeRequest,
  resolveWorkspace,
  validateSubmission
} from "../workers/infrastructure/shared-lead-intake-pipeline.js";
import {
  aegisRoutePolicy
} from "../workers/infrastructure/aegis-security-controls.js";
import {
  ENTERPRISE_LEAD_INTAKE_VERSION
} from "../workers/infrastructure/shared-lead-intake-packet.js";

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

const workspaceRegistry = Object.freeze({
  schemaVersion: SHARED_LEAD_WORKSPACE_REGISTRY_VERSION,
  sourceRegistryVersion: "route-iq-cross-industry-workspaces-v2.1.0",
  workspaces: [
    {
      workspaceId: "fitness_connection",
      workspaceName: "Fitness Field Research",
      operatingProfileId: "fitness",
      operatingProfileLabel: "Fitness",
      crmWorkspacePath: "crm://workspace/fitness_connection/leads",
      aliases: [
        "fitness_connection",
        "fitness-connection",
        "fitness connection",
        "fitness_connection_partner_intake"
      ],
      active: true,
      intakeAuthorized: true
    },
    {
      workspaceId: "northstar_outside_sales_synthetic",
      workspaceName: "Northstar Outside Sales Synthetic",
      operatingProfileId: "general_outside_sales",
      operatingProfileLabel: "General outside sales",
      crmWorkspacePath: "crm://workspace/northstar_outside_sales_synthetic/leads",
      aliases: [
        "northstar_outside_sales_synthetic",
        "northstar-outside-sales-synthetic",
        "northstar outside sales synthetic",
        "northstar_partner_intake"
      ],
      active: true,
      intakeAuthorized: true
    }
  ]
});

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
  assert.equal(resolveWorkspace({ workspaceId: "fitness_connection" }, workspaceRegistry).workspaceId, "fitness_connection");
  assert.equal(resolveWorkspace({ workspace: "Fitness Connection" }, workspaceRegistry).workspaceId, "fitness_connection");
  assert.equal(
    resolveWorkspace({ formId: "northstar_partner_intake" }, workspaceRegistry).workspaceId,
    "northstar_outside_sales_synthetic"
  );
  assert.equal(
    resolveWorkspace({ partner: "Northstar Outside Sales Synthetic" }, workspaceRegistry).workspaceId,
    "northstar_outside_sales_synthetic"
  );
  assert.equal(resolveWorkspace({ workspaceId: "unknown_customer" }, workspaceRegistry), null);
});

test("shared lead intake packet contract is Infrastructure-owned", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => (
    readFile(new URL("../workers/infrastructure/shared-lead-intake-pipeline.js", import.meta.url), "utf8")
  ));

  assert.equal(ENTERPRISE_LEAD_INTAKE_VERSION, "prometheus-enterprise-lead-intake.v1");
  assert.match(source, /\.\/shared-lead-intake-packet\.js/);
  assert.doesNotMatch(source, /deploy\/prometheusrouteiq-website/);
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
    idFactory: () => "sub_test_fitness",
    workspaceRegistrySource: workspaceRegistry
  });

  assert.equal(result.ok, true);
  assert.equal(result.record.workspace.workspaceId, "fitness_connection");
  assert.equal(result.record.operatingProfile.id, "fitness");
  assert.equal(result.record.storage.status, "persisted");
  assert.equal(result.record.founderNotification.status, "sent");
  assert.equal(emailCalls.length, 1);
  assert.ok(store.data.has("shared-lead-intake/workspaces/fitness_connection/submissions/sub_test_fitness"));
  assert.equal(
    store.data.has("shared-lead-intake/workspaces/northstar_outside_sales_synthetic/submissions/sub_test_fitness"),
    false
  );
  assert.equal(result.record.crmHandoff.ownerSubsystem, "Prometheus CRM");
  assert.equal(result.record.crmHandoff.mutationPerformed, false);
});

test("shared lead intake routes synthetic outside sales through configuration and keeps Fitness data isolated", async () => {
  const store = kvStore();
  const result = await createSharedLeadIntakeSubmission({
    input: sampleLead({
      workspaceId: "northstar_outside_sales_synthetic",
      formId: "northstar_partner_intake",
      companyName: "Synthetic Outside Sales Company",
      primaryGoal: "Qualify a general outside-sales opportunity.",
      currentWorkflow: "A synthetic representative validates a prospect and prepares a governed CRM handoff.",
      contactMethod: "synthetic@example.com"
    }),
    request: request(),
    env: { SHARED_LEAD_INTAKE_STORE: store },
    now: new Date("2026-07-03T15:02:00.000Z"),
    idFactory: () => "sub_test_outside_sales",
    workspaceRegistrySource: workspaceRegistry
  });

  assert.equal(result.ok, true);
  assert.equal(result.record.workspace.workspaceId, "northstar_outside_sales_synthetic");
  assert.equal(result.record.operatingProfile.id, "general_outside_sales");
  assert.equal(result.record.crmHandoff.workspaceId, "northstar_outside_sales_synthetic");
  assert.equal(result.record.founderNotification.status, "queued");
  assert.equal(result.record.founderNotification.reason, "email_binding_not_configured");
  assert.ok(
    store.data.has(
      "shared-lead-intake/workspaces/northstar_outside_sales_synthetic/submissions/sub_test_outside_sales"
    )
  );
  assert.equal(
    store.data.has("shared-lead-intake/workspaces/fitness_connection/submissions/sub_test_outside_sales"),
    false
  );
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
    now: new Date("2026-07-03T15:03:00.000Z"),
    workspaceRegistrySource: workspaceRegistry
  });
  const spamWorkspace = resolveWorkspace(sampleLead(), workspaceRegistry);
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
    SHARED_LEAD_INTAKE_STORE: store,
    [WORKSPACE_REGISTRY_ENV]: JSON.stringify(workspaceRegistry)
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

test("missing or malformed governed workspace configuration fails before persistence", async () => {
  const store = kvStore();
  const missing = await createSharedLeadIntakeSubmission({
    input: sampleLead(),
    request: request(),
    env: { SHARED_LEAD_INTAKE_STORE: store }
  });
  const malformed = await createSharedLeadIntakeSubmission({
    input: sampleLead(),
    request: request(),
    env: {
      SHARED_LEAD_INTAKE_STORE: store,
      [WORKSPACE_REGISTRY_ENV]: JSON.stringify({
        ...workspaceRegistry,
        workspaces: []
      })
    }
  });
  assert.equal(missing.status, 503);
  assert.equal(malformed.status, 503);
  assert.equal(store.data.size, 0);
});

test("Aegis protects partner intake as lead intake", () => {
  const policy = aegisRoutePolicy(PARTNER_INTAKE_PATH);

  assert.equal(policy.id, "lead_intake");
  assert.equal(policy.methods.includes("POST"), true);
  assert.equal(policy.methods.includes("OPTIONS"), true);
});
