import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PaidCustomerCrmContractError,
  applyPaidCustomerCrmProvisioningPlan,
  authorizePaidCustomerCrmOperation,
  buildPaidCustomerCrmPreview,
  buildPaidCustomerCrmProvisioningPlan,
  createPaidCustomerCrmProvisioningState,
  normalizePaidCustomerCrmDisplayLabel,
  paidCustomerCrmContractVersion,
  paidCustomerCrmPermissions,
  projectRouteIqPaidCustomerOnboardingToCrmWorkflow,
  readPaidCustomerCrmScopedResource,
  snapshotPaidCustomerCrmMetric,
  transitionPaidCustomerCrmLifecycle,
  validatePaidCustomerCrmProvisioningPlan,
  validatePaidCustomerCrmWorkflowConfiguration,
  verifyPaidCustomerCrmAuditChain
} from "../crm/paid-customer-workflow-configuration-v1.mjs";

const root = resolve(import.meta.dirname, "..");
const administrationFixtures = JSON.parse(readFileSync(
  resolve(
    root,
    "administration/workspace-configurations/route-iq-paid-customer-synthetic-fixtures-v1.json"
  ),
  "utf8"
)).configurations;

function medicalConfiguration(overrides = {}) {
  return {
    contractVersion: paidCustomerCrmContractVersion,
    configurationVersion: "1.0.0",
    companyId: "company_synthetic_clinical_network",
    workspaceId: "workspace_synthetic_clinical_outreach",
    industryTemplateId: "industry_medical_business_development",
    lifecycleState: "validated",
    roles: [
      {
        roleId: "crm.role.manager",
        displayLabel: {
          singular: "Partnership Manager",
          plural: "Partnership Managers"
        },
        permissions: [
          "crm.preview.read",
          "crm.workflow.read",
          "crm.workflow.manage",
          "crm.audit.read",
          "crm.records.read",
          "crm.records.write",
          "crm.lifecycle.manage"
        ]
      },
      {
        roleId: "crm.role.representative",
        displayLabel: {
          singular: "Outreach Representative",
          plural: "Outreach Representatives"
        },
        permissions: [
          "crm.workflow.read",
          "crm.records.read",
          "crm.records.write"
        ]
      }
    ],
    stages: [
      {
        stageId: "crm.stage.identified",
        displayLabel: { singular: "Facility", plural: "Facilities" },
        order: 10,
        terminal: false
      },
      {
        stageId: "crm.stage.visited",
        displayLabel: { singular: "Facility Visit", plural: "Facility Visits" },
        order: 20,
        terminal: false
      },
      {
        stageId: "crm.stage.referral_ready",
        displayLabel: { singular: "Referral Ready", plural: "Referral Ready" },
        order: 30,
        terminal: false
      },
      {
        stageId: "crm.stage.partnership",
        displayLabel: { singular: "Partnership", plural: "Partnerships" },
        order: 40,
        terminal: true
      },
      {
        stageId: "crm.stage.closed",
        displayLabel: { singular: "Closed Opportunity", plural: "Closed Opportunities" },
        order: 50,
        terminal: true
      }
    ],
    workflows: [
      {
        workflowId: "crm.workflow.partnership_development",
        displayLabel: {
          singular: "Partnership Workflow",
          plural: "Partnership Workflows"
        },
        stageIds: [
          "crm.stage.identified",
          "crm.stage.visited",
          "crm.stage.referral_ready",
          "crm.stage.partnership",
          "crm.stage.closed"
        ],
        transitions: [
          {
            transitionId: "crm.transition.record_visit",
            fromStageId: "crm.stage.identified",
            toStageId: "crm.stage.visited"
          },
          {
            transitionId: "crm.transition.qualify_referral",
            fromStageId: "crm.stage.visited",
            toStageId: "crm.stage.referral_ready"
          },
          {
            transitionId: "crm.transition.confirm_partnership",
            fromStageId: "crm.stage.referral_ready",
            toStageId: "crm.stage.partnership"
          },
          {
            transitionId: "crm.transition.close_opportunity",
            fromStageId: "crm.stage.visited",
            toStageId: "crm.stage.closed"
          }
        ]
      }
    ],
    metrics: [
      {
        metricId: "crm.metric.qualified_referrals",
        semanticKey: "qualified_referral_created",
        displayLabel: {
          singular: "Qualified Referral",
          plural: "Qualified Referrals"
        },
        unit: "count",
        aggregation: "count"
      },
      {
        metricId: "crm.metric.facility_visits",
        semanticKey: "facility_visit_completed",
        displayLabel: {
          singular: "Facility Visit",
          plural: "Facility Visits"
        },
        unit: "count",
        aggregation: "count"
      }
    ],
    ...overrides
  };
}

function securityConfiguration(overrides = {}) {
  return {
    contractVersion: paidCustomerCrmContractVersion,
    configurationVersion: "1.0.0",
    companyId: "company_synthetic_security_services",
    workspaceId: "workspace_synthetic_security_assessments",
    industryTemplateId: "industry_security_services",
    lifecycleState: "validated",
    roles: [
      {
        roleId: "crm.role.manager",
        displayLabel: {
          singular: "Service Manager",
          plural: "Service Managers"
        },
        permissions: [
          "crm.preview.read",
          "crm.workflow.read",
          "crm.workflow.manage",
          "crm.audit.read",
          "crm.records.read",
          "crm.records.write",
          "crm.lifecycle.manage"
        ]
      },
      {
        roleId: "crm.role.representative",
        displayLabel: {
          singular: "Assessment Specialist",
          plural: "Assessment Specialists"
        },
        permissions: [
          "crm.workflow.read",
          "crm.records.read",
          "crm.records.write"
        ]
      }
    ],
    stages: [
      {
        stageId: "crm.stage.site_identified",
        displayLabel: { singular: "Site", plural: "Sites" },
        order: 10,
        terminal: false
      },
      {
        stageId: "crm.stage.assessment",
        displayLabel: { singular: "Assessment", plural: "Assessments" },
        order: 20,
        terminal: false
      },
      {
        stageId: "crm.stage.proposal",
        displayLabel: { singular: "Proposal", plural: "Proposals" },
        order: 30,
        terminal: false
      },
      {
        stageId: "crm.stage.contract",
        displayLabel: { singular: "Contract", plural: "Contracts" },
        order: 40,
        terminal: true
      },
      {
        stageId: "crm.stage.closed",
        displayLabel: { singular: "Closed Opportunity", plural: "Closed Opportunities" },
        order: 50,
        terminal: true
      }
    ],
    workflows: [
      {
        workflowId: "crm.workflow.security_sales",
        displayLabel: {
          singular: "Security Services Workflow",
          plural: "Security Services Workflows"
        },
        stageIds: [
          "crm.stage.site_identified",
          "crm.stage.assessment",
          "crm.stage.proposal",
          "crm.stage.contract",
          "crm.stage.closed"
        ],
        transitions: [
          {
            transitionId: "crm.transition.schedule_assessment",
            fromStageId: "crm.stage.site_identified",
            toStageId: "crm.stage.assessment"
          },
          {
            transitionId: "crm.transition.prepare_proposal",
            fromStageId: "crm.stage.assessment",
            toStageId: "crm.stage.proposal"
          },
          {
            transitionId: "crm.transition.sign_contract",
            fromStageId: "crm.stage.proposal",
            toStageId: "crm.stage.contract"
          },
          {
            transitionId: "crm.transition.close_opportunity",
            fromStageId: "crm.stage.proposal",
            toStageId: "crm.stage.closed"
          }
        ]
      }
    ],
    metrics: [
      {
        metricId: "crm.metric.security_assessments",
        semanticKey: "security_assessment_completed",
        displayLabel: {
          singular: "Security Assessment",
          plural: "Security Assessments"
        },
        unit: "count",
        aggregation: "count"
      },
      {
        metricId: "crm.metric.signed_contracts",
        semanticKey: "security_contract_signed",
        displayLabel: {
          singular: "Signed Contract",
          plural: "Signed Contracts"
        },
        unit: "count",
        aggregation: "count"
      }
    ],
    ...overrides
  };
}

function managerPrincipal(configuration = medicalConfiguration()) {
  return {
    authenticated: true,
    principalId: "principal_synthetic_manager",
    companyId: configuration.companyId,
    workspaceId: configuration.workspaceId,
    roleId: "crm.role.manager"
  };
}

function representativePrincipal(configuration = medicalConfiguration()) {
  return {
    authenticated: true,
    principalId: "principal_synthetic_representative",
    companyId: configuration.companyId,
    workspaceId: configuration.workspaceId,
    roleId: "crm.role.representative"
  };
}

function resource(configuration = medicalConfiguration()) {
  return {
    companyId: configuration.companyId,
    workspaceId: configuration.workspaceId,
    resourceType: "crm.workflow",
    resourceId: "crm.workflow.partnership_development"
  };
}

function assertCode(fn, code) {
  assert.throws(fn, error => (
    error instanceof PaidCustomerCrmContractError
    && error.code === code
  ));
}

function fullyProvision(configuration = medicalConfiguration()) {
  const initial = createPaidCustomerCrmProvisioningState({
    companyId: configuration.companyId,
    workspaceId: configuration.workspaceId
  });
  const plan = buildPaidCustomerCrmProvisioningPlan(configuration, initial);
  const result = applyPaidCustomerCrmProvisioningPlan(initial, plan, {
    attemptId: "attempt_initial_projection"
  });
  assert.equal(result.ok, true);
  return { plan, result, state: result.state };
}

test("contract and unrelated-industry configurations validate without customer-specific branches", () => {
  const contract = JSON.parse(readFileSync(
    resolve(root, "crm/paid-customer-workflow-contract-v1.json"),
    "utf8"
  ));
  assert.equal(contract.contractVersion, paidCustomerCrmContractVersion);
  assert.equal(contract.owner, "Prometheus CRM");
  assert.equal(contract.executionBoundary.productionMutationAuthorized, false);
  assert.equal(contract.executionBoundary.notificationAuthorized, false);
  assert.equal(contract.scope.clientFilteringIsAuthorization, false);

  const medical = validatePaidCustomerCrmWorkflowConfiguration(medicalConfiguration());
  const security = validatePaidCustomerCrmWorkflowConfiguration(securityConfiguration());
  assert.notEqual(medical.companyId, security.companyId);
  assert.notEqual(medical.workspaceId, security.workspaceId);
  assert.notEqual(medical.industryTemplateId, security.industryTemplateId);
  assert.equal(medical.workflows[0].workflowId, "crm.workflow.partnership_development");
  assert.equal(security.workflows[0].workflowId, "crm.workflow.security_sales");
  assert.match(medical.configurationDigest, /^[a-f0-9]{64}$/u);
  assert.match(security.configurationDigest, /^[a-f0-9]{64}$/u);
});

test("display labels are normalized while markup, template, and query payloads fail closed", () => {
  assert.equal(
    normalizePaidCustomerCrmDisplayLabel("  Partnership   Manager  "),
    "Partnership Manager"
  );
  for (const malicious of [
    "<script>alert(1)</script>",
    "{{constructor.constructor}}",
    "${process.env.SECRET}",
    "Stages' OR '1'='1",
    "Label /* query */"
  ]) {
    assertCode(
      () => normalizePaidCustomerCrmDisplayLabel(malicious),
      "unsafe_display_label"
    );
  }

  const injected = medicalConfiguration();
  injected.stages[0].displayLabel.singular = "<img src=x onerror=alert(1)>";
  assertCode(
    () => validatePaidCustomerCrmWorkflowConfiguration(injected),
    "unsafe_display_label"
  );
});

test("schema validation rejects missing, unknown, duplicate, contradictory, and unsafe definitions", () => {
  const missing = medicalConfiguration();
  delete missing.workspaceId;
  assertCode(
    () => validatePaidCustomerCrmWorkflowConfiguration(missing),
    "missing_required_field"
  );

  assertCode(
    () => validatePaidCustomerCrmWorkflowConfiguration({
      ...medicalConfiguration(),
      implicitTargetingDefault: true
    }),
    "unknown_field"
  );

  const duplicate = medicalConfiguration();
  duplicate.stages[1].stageId = duplicate.stages[0].stageId;
  assertCode(
    () => validatePaidCustomerCrmWorkflowConfiguration(duplicate),
    "duplicate_definition"
  );

  const unknownStage = medicalConfiguration();
  unknownStage.workflows[0].stageIds[1] = "crm.stage.not_configured";
  assertCode(
    () => validatePaidCustomerCrmWorkflowConfiguration(unknownStage),
    "unknown_workflow_stage"
  );

  assertCode(
    () => validatePaidCustomerCrmWorkflowConfiguration({
      ...medicalConfiguration(),
      contractVersion: "route_iq_paid_customer_crm_workflow.v2"
    }),
    "unsupported_contract_version"
  );
});

test("preview is deterministic, scoped, non-activating, and side-effect free", () => {
  const configuration = medicalConfiguration();
  const before = structuredClone(configuration);
  const first = buildPaidCustomerCrmPreview(configuration);
  const second = buildPaidCustomerCrmPreview(configuration);
  assert.deepEqual(first, second);
  assert.deepEqual(configuration, before);
  assert.equal(first.scope.companyId, configuration.companyId);
  assert.equal(first.scope.workspaceId, configuration.workspaceId);
  assert.equal(first.lifecycleState, "preview_ready");
  assert.deepEqual(first.effects, {
    activating: false,
    productionMutationAuthorized: false,
    notificationAuthorized: false,
    customerRecordCreationAuthorized: false
  });
});

test("deterministic provisioning recovers from partial failure without duplicate definitions or records", () => {
  const configuration = medicalConfiguration();
  const initial = createPaidCustomerCrmProvisioningState({
    companyId: configuration.companyId,
    workspaceId: configuration.workspaceId
  });
  const firstPlan = buildPaidCustomerCrmProvisioningPlan(configuration, initial);
  const secondPlan = buildPaidCustomerCrmProvisioningPlan(configuration, initial);
  assert.deepEqual(firstPlan, secondPlan);

  const failed = applyPaidCustomerCrmProvisioningPlan(initial, firstPlan, {
    attemptId: "attempt_partial_failure",
    failureAtOperationId: firstPlan.operations[3].operationId
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.state.lifecycleState, "provisioning_failed");
  assert.equal(failed.recovery.instructionCode, "RETRY_SAME_PLAN_WITH_FRESH_ATTEMPT_ID");
  assert.equal(failed.recovery.productionMutationPerformed, false);
  assert.equal(failed.recovery.notificationPerformed, false);

  const recovered = applyPaidCustomerCrmProvisioningPlan(failed.state, firstPlan, {
    attemptId: "attempt_recovery"
  });
  assert.equal(recovered.ok, true);
  assert.equal(recovered.state.lifecycleState, "ready_for_activation");
  assert.equal(Object.keys(recovered.state.roles).length, configuration.roles.length);
  assert.equal(Object.keys(recovered.state.stages).length, configuration.stages.length);
  assert.equal(Object.keys(recovered.state.workflows).length, configuration.workflows.length);
  assert.equal(Object.keys(recovered.state.metrics).length, configuration.metrics.length);
  assert.equal(new Set(recovered.state.appliedOperationIds).size, firstPlan.operations.length);

  const replaySafe = applyPaidCustomerCrmProvisioningPlan(recovered.state, firstPlan, {
    attemptId: "attempt_idempotent_replay"
  });
  assert.equal(replaySafe.ok, true);
  assert.equal(replaySafe.appliedOperationCount, 0);
  assert.equal(replaySafe.skippedOperationCount, firstPlan.operations.length);
  assert.equal(Object.keys(replaySafe.state.roles).length, configuration.roles.length);
  assert.equal(Object.keys(replaySafe.state.stages).length, configuration.stages.length);
  assert.equal(replaySafe.state.controls.customerRecordMutationAttempts, 0);
  assert.equal(replaySafe.state.controls.productionMutationAttempts, 0);
  assert.equal(replaySafe.state.controls.notificationAttempts, 0);
  assert.equal(replaySafe.state.controls.activationAttempts, 0);
  assert.equal(verifyPaidCustomerCrmAuditChain(replaySafe.state.auditRecords), true);

  assertCode(
    () => applyPaidCustomerCrmProvisioningPlan(replaySafe.state, firstPlan, {
      attemptId: "attempt_idempotent_replay"
    }),
    "attempt_replay"
  );
});

test("serialized provisioning plans are fully revalidated before any projection changes", () => {
  const configuration = medicalConfiguration();
  const initial = createPaidCustomerCrmProvisioningState({
    companyId: configuration.companyId,
    workspaceId: configuration.workspaceId
  });
  const plan = buildPaidCustomerCrmProvisioningPlan(configuration, initial);
  assert.deepEqual(validatePaidCustomerCrmProvisioningPlan(plan), plan);

  const unsafeEffects = structuredClone(plan);
  unsafeEffects.effects.notificationAuthorized = true;
  assertCode(
    () => applyPaidCustomerCrmProvisioningPlan(initial, unsafeEffects, {
      attemptId: "attempt_reject_unsafe_effect"
    }),
    "unsafe_plan_effects"
  );

  const alteredDefinition = structuredClone(plan);
  alteredDefinition.operations[0].definition.displayLabel.singular = "<script>unsafe</script>";
  assertCode(
    () => applyPaidCustomerCrmProvisioningPlan(initial, alteredDefinition, {
      attemptId: "attempt_reject_altered_definition"
    }),
    "operation_definition_integrity_mismatch"
  );

  const alteredPlanId = structuredClone(plan);
  alteredPlanId.planId = "crm_plan_000000000000000000000000";
  assertCode(
    () => applyPaidCustomerCrmProvisioningPlan(initial, alteredPlanId, {
      attemptId: "attempt_reject_altered_plan"
    }),
    "plan_integrity_mismatch"
  );
  assert.deepEqual(initial, createPaidCustomerCrmProvisioningState({
    companyId: configuration.companyId,
    workspaceId: configuration.workspaceId
  }));
});

test("server-side scope and configured roles prevent cross-company, cross-workspace, and role escalation", () => {
  const medical = medicalConfiguration();
  const security = securityConfiguration();
  const { state } = fullyProvision(medical);

  const authorized = readPaidCustomerCrmScopedResource(
    state,
    representativePrincipal(medical),
    resource(medical)
  );
  assert.equal(authorized.authorization.authorized, true);
  assert.equal(authorized.authorization.companyId, medical.companyId);

  assertCode(
    () => authorizePaidCustomerCrmOperation(
      state,
      representativePrincipal(security),
      resource(medical),
      "crm.workflow.read"
    ),
    "cross_company_workspace_scope"
  );

  assertCode(
    () => authorizePaidCustomerCrmOperation(
      state,
      representativePrincipal(medical),
      {
        ...resource(medical),
        workspaceId: security.workspaceId
      },
      "crm.workflow.read"
    ),
    "cross_company_workspace_scope"
  );

  assertCode(
    () => authorizePaidCustomerCrmOperation(
      state,
      representativePrincipal(medical),
      resource(medical),
      "crm.workflow.manage"
    ),
    "role_not_authorized"
  );

  assertCode(
    () => authorizePaidCustomerCrmOperation(
      state,
      {
        ...representativePrincipal(medical),
        permissions: ["crm.workflow.manage"]
      },
      resource(medical),
      "crm.workflow.manage"
    ),
    "unknown_field"
  );
});

test("metric snapshots preserve historical meaning across safe label revisions", () => {
  const versionOne = medicalConfiguration();
  const firstSnapshot = snapshotPaidCustomerCrmMetric(
    versionOne,
    "crm.metric.qualified_referrals",
    {
      value: 4,
      recordedAt: "2026-07-26T12:00:00.000Z"
    }
  );
  const { state } = fullyProvision(versionOne);

  const versionTwo = medicalConfiguration({
    configurationVersion: "1.1.0"
  });
  versionTwo.metrics[0].displayLabel = {
    singular: "Qualified Introduction",
    plural: "Qualified Introductions"
  };
  const versionTwoPlan = buildPaidCustomerCrmProvisioningPlan(versionTwo, state);
  const revised = applyPaidCustomerCrmProvisioningPlan(state, versionTwoPlan, {
    attemptId: "attempt_metric_label_revision"
  });
  assert.equal(revised.ok, true);
  assert.equal(
    revised.state.metrics["crm.metric.qualified_referrals"].semanticKey,
    "qualified_referral_created"
  );
  assert.deepEqual(firstSnapshot.displayLabelSnapshot, {
    singular: "Qualified Referral",
    plural: "Qualified Referrals"
  });
  assert.equal(firstSnapshot.configurationVersion, "1.0.0");
  assert.equal(firstSnapshot.semanticKey, "qualified_referral_created");

  const semanticDrift = medicalConfiguration({
    configurationVersion: "1.2.0"
  });
  semanticDrift.metrics[0].semanticKey = "different_business_event";
  assertCode(
    () => buildPaidCustomerCrmProvisioningPlan(semanticDrift, revised.state),
    "metric_semantic_drift"
  );
});

test("suspension and offboarding retain configuration and audit while blocking writes and reactivation", () => {
  const configuration = medicalConfiguration();
  const { state } = fullyProvision(configuration);
  const originalDefinitions = {
    roles: structuredClone(state.roles),
    stages: structuredClone(state.stages),
    workflows: structuredClone(state.workflows),
    metrics: structuredClone(state.metrics)
  };
  const manager = managerPrincipal(configuration);

  const suspended = transitionPaidCustomerCrmLifecycle(
    state,
    manager,
    "suspended",
    { changeId: "lifecycle_suspend_synthetic_workspace" }
  );
  assert.equal(suspended.changed, true);
  assert.equal(suspended.state.lifecycleState, "suspended");
  assert.equal(suspended.state.controls.recordWritesAllowed, false);
  assertCode(
    () => authorizePaidCustomerCrmOperation(
      suspended.state,
      representativePrincipal(configuration),
      resource(configuration),
      "crm.records.write"
    ),
    "suspended_workspace_write_denied"
  );

  const offboarded = transitionPaidCustomerCrmLifecycle(
    suspended.state,
    manager,
    "offboarded",
    { changeId: "lifecycle_offboard_synthetic_workspace" }
  );
  assert.equal(offboarded.state.lifecycleState, "offboarded");
  assert.deepEqual(offboarded.state.roles, originalDefinitions.roles);
  assert.deepEqual(offboarded.state.stages, originalDefinitions.stages);
  assert.deepEqual(offboarded.state.workflows, originalDefinitions.workflows);
  assert.deepEqual(offboarded.state.metrics, originalDefinitions.metrics);
  assert.equal(offboarded.effects.configurationDeleted, false);
  assert.equal(offboarded.effects.auditDeleted, false);
  assert.equal(verifyPaidCustomerCrmAuditChain(offboarded.state.auditRecords), true);

  const auditAuthorization = authorizePaidCustomerCrmOperation(
    offboarded.state,
    manager,
    {
      ...resource(configuration),
      resourceType: "crm.audit",
      resourceId: "crm.audit.workspace"
    },
    "crm.audit.read"
  );
  assert.equal(auditAuthorization.authorized, true);
  assertCode(
    () => authorizePaidCustomerCrmOperation(
      offboarded.state,
      manager,
      resource(configuration),
      "crm.workflow.read"
    ),
    "offboarded_workspace_access_denied"
  );
  assertCode(
    () => transitionPaidCustomerCrmLifecycle(
      offboarded.state,
      manager,
      "active",
      { changeId: "lifecycle_reactivate_synthetic_workspace" }
    ),
    "activation_requires_separate_authorization"
  );

  const repeated = transitionPaidCustomerCrmLifecycle(
    offboarded.state,
    manager,
    "offboarded",
    { changeId: "lifecycle_repeat_offboard" }
  );
  assert.equal(repeated.changed, false);
  assert.deepEqual(repeated.state.auditRecords, offboarded.state.auditRecords);
});

test("append-only audit and outward results contain no labels, credentials, notifications, or record mutations", () => {
  const configuration = securityConfiguration();
  const { state, result } = fullyProvision(configuration);
  const auditText = JSON.stringify(state.auditRecords);
  assert.equal(verifyPaidCustomerCrmAuditChain(state.auditRecords), true);
  assert.doesNotMatch(auditText, /Security Assessment|Assessment Specialist|Service Manager/u);
  assert.doesNotMatch(auditText, /password|secret|token|cookie|email|phone/iu);
  assert.deepEqual(result.effects, {
    productionMutationPerformed: false,
    notificationPerformed: false,
    customerRecordMutationPerformed: false,
    activationPerformed: false
  });
  assert.deepEqual(state.controls, {
    productionMutationAttempts: 0,
    notificationAttempts: 0,
    customerRecordMutationAttempts: 0,
    activationAttempts: 0,
    recordWritesAllowed: false,
    retainedConfiguration: true
  });
});

test("final Administration fixtures project deterministically across unrelated industries", () => {
  assert.equal(administrationFixtures.length, 2);
  const sourceBefore = structuredClone(administrationFixtures);
  const projections = administrationFixtures.map(configuration => {
    const first = projectRouteIqPaidCustomerOnboardingToCrmWorkflow(configuration);
    const second = projectRouteIqPaidCustomerOnboardingToCrmWorkflow(configuration);
    assert.deepEqual(first, second);
    assert.equal(first.companyId, configuration.company.companyId);
    assert.equal(first.workspaceId, configuration.company.workspaceId);
    assert.equal(
      first.industryTemplateId,
      `industry_${configuration.operatingProfile.industryTemplateId}`
    );
    assert.equal(first.lifecycleState, "validated");
    assert.equal(first.configurationVersion, "1.1.0");
    assert.equal(first.roles.length, configuration.access.roles.length);
    assert.equal(
      first.stages.length,
      configuration.sales.processStages.length
        + configuration.sales.followUpStages.length
    );
    assert.equal(first.workflows.length, 1);
    assert.equal(first.metrics.length, configuration.terminology.metrics.length);

    const preview = buildPaidCustomerCrmPreview(first);
    const plan = buildPaidCustomerCrmProvisioningPlan(
      first,
      createPaidCustomerCrmProvisioningState({
        companyId: first.companyId,
        workspaceId: first.workspaceId
      })
    );
    assert.deepEqual(preview.effects, {
      activating: false,
      productionMutationAuthorized: false,
      notificationAuthorized: false,
      customerRecordCreationAuthorized: false
    });
    assert.deepEqual(plan.effects, {
      targetLifecycleState: "ready_for_activation",
      productionMutationAuthorized: false,
      notificationAuthorized: false,
      customerRecordMutationAuthorized: false,
      activationAuthorized: false
    });
    return first;
  });
  assert.notEqual(projections[0].companyId, projections[1].companyId);
  assert.notEqual(projections[0].workspaceId, projections[1].workspaceId);
  assert.notEqual(projections[0].industryTemplateId, projections[1].industryTemplateId);
  assert.deepEqual(administrationFixtures, sourceBefore);
});

test("Administration roles receive only governed CRM permissions without label-based escalation", () => {
  for (const configuration of administrationFixtures) {
    const projected = projectRouteIqPaidCustomerOnboardingToCrmWorkflow(configuration);
    const representative = projected.roles.find(role => (
      role.permissions.includes("crm.records.write")
    ));
    const manager = projected.roles.find(role => (
      role.permissions.includes("crm.workflow.manage")
    ));
    assert.ok(representative);
    assert.ok(manager);
    assert.equal(representative.permissions.includes("crm.workflow.manage"), false);
    assert.equal(representative.permissions.includes("crm.lifecycle.manage"), false);
    assert.equal(manager.permissions.includes("crm.records.write"), false);
    assert.equal(manager.permissions.includes("crm.lifecycle.manage"), false);
    assert.ok(projected.roles.every(role => (
      role.roleId.startsWith("crm.role.")
      && role.permissions.every(permission => paidCustomerCrmPermissions.includes(permission))
    )));
  }

  const unknownCapability = structuredClone(administrationFixtures[0]);
  unknownCapability.access.roles[0].permissions.push("export_all_customer_records");
  assertCode(
    () => projectRouteIqPaidCustomerOnboardingToCrmWorkflow(unknownCapability),
    "administration_permission_unmapped"
  );

  const capabilityNotEnabled = structuredClone(administrationFixtures[0]);
  capabilityNotEnabled.access.roles[0].permissions.push("record_unapproved_activity");
  assertCode(
    () => projectRouteIqPaidCustomerOnboardingToCrmWorkflow(capabilityNotEnabled),
    "administration_permission_not_enabled"
  );

  const contradictoryRole = structuredClone(administrationFixtures[0]);
  contradictoryRole.access.roles[0].permissions.push("view_company_dashboard");
  assertCode(
    () => projectRouteIqPaidCustomerOnboardingToCrmWorkflow(contradictoryRole),
    "administration_role_capabilities_contradictory"
  );
});

test("Administration process and follow-up references become one safe ordered workflow", () => {
  for (const configuration of administrationFixtures) {
    const projected = projectRouteIqPaidCustomerOnboardingToCrmWorkflow(configuration);
    const workflow = projected.workflows[0];
    const expectedStageIds = [
      ...configuration.crm.processStageIds.map(stageId => `crm.stage.process.${stageId}`),
      ...configuration.crm.followUpStageIds.map(
        stageId => `crm.stage.follow_up.${stageId}`
      )
    ];
    assert.deepEqual(workflow.stageIds, expectedStageIds);
    assert.deepEqual(
      projected.stages.map(stage => stage.order),
      projected.stages.map((_, index) => index + 1)
    );
    assert.ok(workflow.transitions.some(transition => (
      transition.transitionId.startsWith("crm.transition.outcome.")
    )));
  }

  const incomplete = structuredClone(administrationFixtures[0]);
  incomplete.crm.processStageIds.pop();
  assertCode(
    () => projectRouteIqPaidCustomerOnboardingToCrmWorkflow(incomplete),
    "administration_crm_stage_reference_incomplete"
  );

  const contradictoryOrder = structuredClone(administrationFixtures[1]);
  contradictoryOrder.crm.processStageIds.reverse();
  assertCode(
    () => projectRouteIqPaidCustomerOnboardingToCrmWorkflow(contradictoryOrder),
    "administration_crm_stage_order_contradictory"
  );
});

test("Administration metric projection preserves stable history semantics across label revisions", () => {
  const firstAdministration = structuredClone(administrationFixtures[0]);
  const first = projectRouteIqPaidCustomerOnboardingToCrmWorkflow(firstAdministration);
  const firstMetric = first.metrics[0];
  assert.equal(firstMetric.metricId, "crm.metric.completed_assessments");
  assert.equal(firstMetric.semanticKey, "history.completed_assessments.1_0_0");
  assert.equal(firstMetric.unit, "count");
  assert.equal(firstMetric.aggregation, "count");

  const initial = createPaidCustomerCrmProvisioningState({
    companyId: first.companyId,
    workspaceId: first.workspaceId
  });
  const firstApplied = applyPaidCustomerCrmProvisioningPlan(
    initial,
    buildPaidCustomerCrmProvisioningPlan(first, initial),
    { attemptId: "attempt_administration_revision_one" }
  );
  assert.equal(firstApplied.ok, true);

  const revisedAdministration = structuredClone(firstAdministration);
  revisedAdministration.configurationRevision = 2;
  revisedAdministration.provenance.configurationIdentity =
    `${revisedAdministration.configurationId}@2`;
  const visitTerm = revisedAdministration.terminology.terms.find(
    term => term.termId === "visit"
  );
  visitTerm.singular = "site assessment";
  visitTerm.plural = "site assessments";
  const revised = projectRouteIqPaidCustomerOnboardingToCrmWorkflow(
    revisedAdministration
  );
  assert.equal(revised.configurationVersion, "1.2.0");
  assert.equal(revised.metrics[0].semanticKey, firstMetric.semanticKey);
  const revisionPlan = buildPaidCustomerCrmProvisioningPlan(
    revised,
    firstApplied.state
  );
  assert.equal(revisionPlan.effects.productionMutationAuthorized, false);
  assert.equal(revisionPlan.effects.notificationAuthorized, false);

  const ambiguous = structuredClone(firstAdministration);
  ambiguous.terminology.metrics[0].aggregation = "SUM";
  assertCode(
    () => projectRouteIqPaidCustomerOnboardingToCrmWorkflow(ambiguous),
    "administration_metric_unit_ambiguous"
  );
});

test("Administration projection rejects unsafe lifecycle, scope, references, and labels", () => {
  for (const lifecycleState of [
    "DRAFT",
    "VALIDATION_FAILED",
    "PROVISIONING",
    "PROVISIONING_FAILED",
    "READY_FOR_ACTIVATION",
    "ACTIVE",
    "SUSPENDED",
    "OFFBOARDED"
  ]) {
    const configuration = structuredClone(administrationFixtures[0]);
    configuration.lifecycle.state = lifecycleState;
    configuration.lifecycle.failure = ["VALIDATION_FAILED", "PROVISIONING_FAILED"]
      .includes(lifecycleState)
      ? {
          code: "synthetic_projection_failure",
          recoveryAction: "Return to the governed draft configuration."
        }
      : null;
    if ([
      "PROVISIONING",
      "READY_FOR_ACTIVATION",
      "ACTIVE",
      "SUSPENDED",
      "OFFBOARDED"
    ].includes(lifecycleState)) {
      configuration.lifecycle.approvalReference = "synthetic_approval_reference";
    }
    if (lifecycleState === "ACTIVE") {
      configuration.safety.customerActivation = "ON";
      configuration.safety.activationAuthorizationRef = "synthetic_activation_reference";
    }
    assert.throws(
      () => projectRouteIqPaidCustomerOnboardingToCrmWorkflow(configuration)
    );
  }

  const crossWorkspace = structuredClone(administrationFixtures[0]);
  crossWorkspace.crm.crossWorkspaceRecordsAllowed = true;
  assert.throws(
    () => projectRouteIqPaidCustomerOnboardingToCrmWorkflow(crossWorkspace)
  );

  const unknownOutcome = structuredClone(administrationFixtures[0]);
  unknownOutcome.crm.outcomeMappings[0].outcomeId = "unknown_outcome_reference";
  assert.throws(
    () => projectRouteIqPaidCustomerOnboardingToCrmWorkflow(unknownOutcome)
  );

  const unsafeLabel = structuredClone(administrationFixtures[0]);
  unsafeLabel.access.roles[0].displayLabel = "<script>unsafe</script>";
  assert.throws(
    () => projectRouteIqPaidCustomerOnboardingToCrmWorkflow(unsafeLabel)
  );
});
