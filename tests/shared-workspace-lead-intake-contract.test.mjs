import test from "node:test";
import assert from "node:assert/strict";

import {
  SHARED_WORKSPACE_LEAD_INTAKE_COMPONENTS,
  SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT,
  assertSharedWorkspaceLeadIntakeContract,
  getSharedLeadIntakeWorkspaceContract,
  workspaceSubmissionKeyPrefix
} from "../integrations/shared-workspace-lead-intake-contract.js";

const syntheticWorkspaceRegistry = Object.freeze({
  synthetic_field_service: Object.freeze({
    workspaceId: "synthetic_field_service",
    workspaceName: "Synthetic Field Service",
    operatingProfileId: "general_outside_sales",
    operatingProfileLabel: "General Outside Sales",
    aliases: Object.freeze(["synthetic_field_service", "synthetic-field-service"]),
    protectedWorkspaceIds: Object.freeze(["synthetic_distribution"]),
    crmWorkspacePath: "crm://workspace/synthetic_field_service/leads",
    kvSubmissionPrefix: "shared-lead-intake/workspaces/synthetic_field_service/submissions/"
  }),
  synthetic_distribution: Object.freeze({
    workspaceId: "synthetic_distribution",
    workspaceName: "Synthetic Distribution",
    operatingProfileId: "general_outside_sales",
    operatingProfileLabel: "General Outside Sales",
    aliases: Object.freeze(["synthetic_distribution", "synthetic-distribution"]),
    protectedWorkspaceIds: Object.freeze(["synthetic_field_service"]),
    crmWorkspacePath: "crm://workspace/synthetic_distribution/leads",
    kvSubmissionPrefix: "shared-lead-intake/workspaces/synthetic_distribution/submissions/"
  })
});

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
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.endpoint.path, "/api/partner-intake");
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.kvPersistence.binding, "SHARED_LEAD_INTAKE_STORE");
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.crmHandoffPacket.contract, "shared_workspace_crm_lead_intake_packet.v1");
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.founderNotificationEvent.registeredEvenIfDeliveryPending, true);
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.aegisProtection.routePolicy, "lead_intake");
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.boundaries.dashboardReadsRawIntakeWithoutApproval, false);
});

test("production contract embeds no customer-specific workspace route", () => {
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.workspaceRouter.runtimeRegistryRequired, true);
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.workspaceRouter.embeddedCustomerWorkspaceRoutesAllowed, false);
  assert.deepEqual(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.workspaceRouter.workspaces, {});
  assert.equal(getSharedLeadIntakeWorkspaceContract("synthetic_field_service"), null);
});

test("governed workspace registries resolve without customer-specific branching", () => {
  for (const workspaceId of Object.keys(syntheticWorkspaceRegistry)) {
    const workspace = getSharedLeadIntakeWorkspaceContract(workspaceId, syntheticWorkspaceRegistry);
    assert.equal(workspace.workspaceId, workspaceId);
    assert.equal(
      workspaceSubmissionKeyPrefix(workspaceId, syntheticWorkspaceRegistry),
      `shared-lead-intake/workspaces/${workspaceId}/submissions/`
    );
  }
  assert.equal(getSharedLeadIntakeWorkspaceContract("unknown_workspace", syntheticWorkspaceRegistry), null);
  assert.equal(workspaceSubmissionKeyPrefix("unknown_workspace", syntheticWorkspaceRegistry), null);
});

test("synthetic workspace paths remain isolated", () => {
  for (const workspace of Object.values(syntheticWorkspaceRegistry)) {
    const protectedWorkspaceId = workspace.protectedWorkspaceIds[0];
    const submissionId = `sub_contract_${workspace.workspaceId}`;
    const ownKey = `${workspaceSubmissionKeyPrefix(workspace.workspaceId, syntheticWorkspaceRegistry)}${submissionId}`;
    const protectedKey = `${workspaceSubmissionKeyPrefix(protectedWorkspaceId, syntheticWorkspaceRegistry)}${submissionId}`;

    assert.notEqual(ownKey, protectedKey);
    assert.match(ownKey, new RegExp(`/workspaces/${workspace.workspaceId}/submissions/`, "u"));
    assert.doesNotMatch(ownKey, new RegExp(`/workspaces/${protectedWorkspaceId}/submissions/`, "u"));
  }
});

test("invalid registries and unknown workspaces fail closed", () => {
  assert.equal(getSharedLeadIntakeWorkspaceContract("synthetic_field_service", null), null);
  assert.equal(getSharedLeadIntakeWorkspaceContract("synthetic_field_service", []), null);
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.failClosedBehavior.unknownWorkspaceStatus, 400);
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.failClosedBehavior.unknownWorkspacePersistsRecord, false);
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.failClosedBehavior.unknownWorkspaceCreatesCrmHandoff, false);
  assert.equal(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.workspaceRouter.unknownWorkspaceFailsClosed, true);
});
