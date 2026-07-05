import test from "node:test";
import assert from "node:assert/strict";

import {
  SHARED_WORKSPACE_LEAD_INTAKE_COMPONENTS,
  SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT,
  assertSharedWorkspaceLeadIntakeContract,
  getSharedLeadIntakeWorkspaceContract,
  workspaceSubmissionKeyPrefix
} from "../integrations/shared-workspace-lead-intake-contract.js";
import {
  PARTNER_INTAKE_PATH,
  SHARED_LEAD_INTAKE_VERSION,
  WORKSPACES,
  createSharedLeadIntakeSubmission,
  resolveWorkspace
} from "../workers/infrastructure/shared-lead-intake-pipeline.js";
import {
  aegisRoutePolicy
} from "../workers/infrastructure/aegis-security-controls.js";

function kvStore() {
  const data = new Map();
  return {
    data,
    async put(key, value) {
      data.set(key, String(value));
    }
  };
}

function request() {
  return new Request("https://prometheusrouteiq.com/api/partner-intake", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}"
  });
}

function leadFor(workspaceId) {
  const workspace = getSharedLeadIntakeWorkspaceContract(workspaceId);
  return {
    workspaceId,
    formId: workspace.aliases.at(-1),
    companyName: `${workspace.workspaceName} Contract Test`,
    contactName: "Contract Validator",
    contactMethod: "validator@example.com",
    primaryGoal: "Validate the shared intake contract.",
    currentWorkflow: "Infrastructure validates, routes, persists, and prepares CRM handoff without owning CRM business logic.",
    openedAt: "2026-07-04T10:00:00.000Z",
    source: {
      provider: "website",
      formId: workspace.aliases.at(-1)
    }
  };
}

test("shared workspace lead intake contract registers every required component", () => {
  assert.equal(assertSharedWorkspaceLeadIntakeContract(), true);
  assert.deepEqual(SHARED_WORKSPACE_LEAD_INTAKE_COMPONENTS, [
    "partner_intake_endpoint",
    "workspace_router",
    "kv_persistence",
    "intake_submission_artifact",
    "crm_handoff_packet",
    "founder_notification_event",
    "failure_retry_event",
    "audit_metadata",
    "aegis_rate_limit_metadata",
    "workspace_fail_closed_behavior"
  ]);
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.endpoint.path, PARTNER_INTAKE_PATH);
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.kvPersistence.binding, "SHARED_LEAD_INTAKE_STORE");
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.crmHandoffPacket.contract, "shared_workspace_crm_lead_intake_packet.v1");
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.founderNotificationEvent.registeredEvenIfDeliveryPending, true);
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.aegisProtection.routePolicy, "lead_intake");
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.boundaries.dashboardReadsRawIntakeWithoutApproval, false);
});

test("canonical workspace routing contract matches current intake runtime registry", () => {
  for (const workspaceId of ["fitness_connection", "smoothie_depot"]) {
    const contractWorkspace = getSharedLeadIntakeWorkspaceContract(workspaceId);
    const runtimeWorkspace = WORKSPACES[workspaceId];

    assert.ok(contractWorkspace, `Missing contract workspace: ${workspaceId}`);
    assert.equal(contractWorkspace.workspaceId, runtimeWorkspace.workspaceId);
    assert.equal(contractWorkspace.operatingProfileId, runtimeWorkspace.operatingProfileId);
    assert.equal(contractWorkspace.crmWorkspacePath, runtimeWorkspace.crmWorkspacePath);
    assert.deepEqual([...contractWorkspace.aliases], [...runtimeWorkspace.aliases]);
    assert.equal(resolveWorkspace({ formId: contractWorkspace.aliases.at(-1) }).workspaceId, workspaceId);
  }

  assert.deepEqual(
    getSharedLeadIntakeWorkspaceContract("fitness_connection").protectedWorkspaceIds,
    ["smoothie_depot"]
  );
  assert.deepEqual(
    getSharedLeadIntakeWorkspaceContract("smoothie_depot").protectedWorkspaceIds,
    ["fitness_connection"]
  );
});

test("canonical KV paths and CRM handoff stay workspace isolated", async () => {
  for (const workspaceId of ["fitness_connection", "smoothie_depot"]) {
    const store = kvStore();
    const result = await createSharedLeadIntakeSubmission({
      input: leadFor(workspaceId),
      request: request(),
      env: { SHARED_LEAD_INTAKE_STORE: store },
      now: new Date("2026-07-04T10:01:00.000Z"),
      idFactory: () => `sub_contract_${workspaceId}`
    });

    const protectedWorkspaceId = getSharedLeadIntakeWorkspaceContract(workspaceId).protectedWorkspaceIds[0];
    const submissionKey = `${workspaceSubmissionKeyPrefix(workspaceId)}sub_contract_${workspaceId}`;
    const protectedKey = `${workspaceSubmissionKeyPrefix(protectedWorkspaceId)}sub_contract_${workspaceId}`;

    assert.equal(result.ok, true);
    assert.equal(result.record.version, SHARED_LEAD_INTAKE_VERSION);
    assert.equal(result.record.workspace.workspaceId, workspaceId);
    assert.equal(result.record.crmHandoff.ownerSubsystem, "Prometheus CRM");
    assert.equal(result.record.crmHandoff.mutationPerformed, false);
    assert.equal(result.record.crmHandoff.crmWorkspacePath, getSharedLeadIntakeWorkspaceContract(workspaceId).crmWorkspacePath);
    assert.ok(store.data.has(submissionKey), `Missing workspace-scoped KV key for ${workspaceId}`);
    assert.equal(store.data.has(protectedKey), false, `Cross-workspace KV contamination for ${workspaceId}`);
    assert.equal(result.record.founderNotification.status, "queued");
    assert.equal(result.record.founderNotification.futureHooks.dashboard, "prepared");
    assert.equal(result.record.founderNotification.futureHooks.companion, "prepared");
  }
});

test("unknown or missing workspace fails closed without persistence or CRM handoff", async () => {
  const store = kvStore();
  const result = await createSharedLeadIntakeSubmission({
    input: {
      ...leadFor("fitness_connection"),
      workspaceId: "unknown_workspace",
      formId: "unknown_workspace_form",
      source: {
        provider: "website",
        formId: "unknown_workspace_form"
      }
    },
    request: request(),
    env: { SHARED_LEAD_INTAKE_STORE: store },
    now: new Date("2026-07-04T10:02:00.000Z")
  });

  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.failClosedBehavior.unknownWorkspaceStatus, 400);
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.failClosedBehavior.unknownWorkspacePersistsRecord, false);
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.failClosedBehavior.unknownWorkspaceCreatesCrmHandoff, false);
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.workspaceRouter.unknownWorkspaceFailsClosed, true);
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.equal(store.data.size, 0);
});

test("Aegis route metadata remains registered for partner intake", () => {
  const policy = aegisRoutePolicy(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.endpoint.path);

  assert.equal(policy.id, SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.aegisProtection.routePolicy);
  assert.equal(policy.methods.includes("POST"), true);
  assert.equal(policy.methods.includes("OPTIONS"), true);
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.aegisProtection.cachePolicy, "no-store");
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.aegisProtection.permissiveCorsAllowed, false);
});
