import { createHash } from "node:crypto";

export const paidCustomerCrmContractVersion = "route_iq_paid_customer_crm_workflow.v1";
export const paidCustomerCrmStateVersion = "route_iq_paid_customer_crm_projection.v1";

export const paidCustomerCrmLifecycleStates = Object.freeze([
  "draft",
  "validation_failed",
  "validated",
  "preview_ready",
  "awaiting_approval",
  "provisioning",
  "provisioning_failed",
  "ready_for_activation",
  "active",
  "suspended",
  "offboarded"
]);

export const paidCustomerCrmPermissions = Object.freeze([
  "crm.preview.read",
  "crm.workflow.read",
  "crm.workflow.manage",
  "crm.audit.read",
  "crm.records.read",
  "crm.records.write",
  "crm.lifecycle.manage"
]);

const permissionSet = new Set(paidCustomerCrmPermissions);
const lifecycleStateSet = new Set(paidCustomerCrmLifecycleStates);
const previewableStates = new Set(["validated", "preview_ready", "awaiting_approval"]);
const provisionableStates = new Set([
  "draft",
  "validated",
  "preview_ready",
  "awaiting_approval",
  "provisioning_failed",
  "ready_for_activation"
]);
const writeOperations = new Set([
  "crm.workflow.manage",
  "crm.records.write"
]);
const metricUnits = new Set(["count", "currency", "percentage", "duration_minutes"]);
const metricAggregations = new Set(["count", "sum", "rate", "average"]);
const idPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const semverPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const labelPattern = /^[\p{L}\p{N}][\p{L}\p{N} .,&'()/+\-]*$/u;

const entityPrefixes = Object.freeze({
  roleId: "crm.role.",
  stageId: "crm.stage.",
  workflowId: "crm.workflow.",
  transitionId: "crm.transition.",
  metricId: "crm.metric."
});

const topLevelKeys = Object.freeze([
  "contractVersion",
  "configurationVersion",
  "companyId",
  "workspaceId",
  "industryTemplateId",
  "lifecycleState",
  "roles",
  "stages",
  "workflows",
  "metrics"
]);

export class PaidCustomerCrmContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PaidCustomerCrmContractError";
    this.code = code;
  }
}

function fail(code, field = "configuration") {
  throw new PaidCustomerCrmContractError(code, `Paid-customer CRM contract rejected ${field}.`);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, canonicalize(value[key])])
  );
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function digest(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function requireObject(value, field, requiredKeys, allowedKeys = requiredKeys) {
  if (!isPlainObject(value)) fail("invalid_object", field);
  for (const key of requiredKeys) {
    if (!Object.hasOwn(value, key)) fail("missing_required_field", `${field}.${key}`);
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) fail("unknown_field", `${field}.${key}`);
  }
  return value;
}

function requireArray(value, field, { min = 0, max = 100 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    fail("invalid_array", field);
  }
  return value;
}

function requireBoolean(value, field) {
  if (typeof value !== "boolean") fail("invalid_boolean", field);
  return value;
}

function normalizeId(value, field, prefix = "") {
  if (
    typeof value !== "string"
    || value.length < 3
    || value.length > 96
    || !idPattern.test(value)
    || (prefix && !value.startsWith(prefix))
  ) {
    fail("invalid_stable_id", field);
  }
  return value;
}

function normalizeScopeId(value, field, prefix) {
  const normalized = normalizeId(value, field);
  if (!normalized.startsWith(prefix)) fail("invalid_scope_id", field);
  return normalized;
}

function normalizeVersion(value, field) {
  if (typeof value !== "string" || !semverPattern.test(value)) {
    fail("invalid_contract_version", field);
  }
  return value;
}

export function normalizePaidCustomerCrmDisplayLabel(value, field = "displayLabel") {
  if (typeof value !== "string") fail("invalid_display_label", field);
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (
    normalized.length < 1
    || normalized.length > 72
    || !labelPattern.test(normalized)
    || /(?:<|>|`|\\|\$\{|\{\{|\}\}|--|\/\*|\*\/)/u.test(normalized)
  ) {
    fail("unsafe_display_label", field);
  }
  return normalized;
}

function normalizeLabels(value, field) {
  requireObject(value, field, ["singular", "plural"]);
  return {
    singular: normalizePaidCustomerCrmDisplayLabel(value.singular, `${field}.singular`),
    plural: normalizePaidCustomerCrmDisplayLabel(value.plural, `${field}.plural`)
  };
}

function unique(items, field, selector = item => item) {
  const values = items.map(selector);
  if (new Set(values).size !== values.length) fail("duplicate_definition", field);
}

function normalizeRole(value, index) {
  const field = `roles[${index}]`;
  requireObject(value, field, ["roleId", "displayLabel", "permissions"]);
  const permissions = requireArray(value.permissions, `${field}.permissions`, { min: 1, max: 7 })
    .map((permission, permissionIndex) => {
      if (typeof permission !== "string" || !permissionSet.has(permission)) {
        fail("unknown_permission", `${field}.permissions[${permissionIndex}]`);
      }
      return permission;
    })
    .sort();
  unique(permissions, `${field}.permissions`);
  return {
    roleId: normalizeId(value.roleId, `${field}.roleId`, entityPrefixes.roleId),
    displayLabel: normalizeLabels(value.displayLabel, `${field}.displayLabel`),
    permissions
  };
}

function normalizeStage(value, index) {
  const field = `stages[${index}]`;
  requireObject(value, field, ["stageId", "displayLabel", "order", "terminal"]);
  if (!Number.isSafeInteger(value.order) || value.order < 0 || value.order > 999) {
    fail("invalid_stage_order", `${field}.order`);
  }
  return {
    stageId: normalizeId(value.stageId, `${field}.stageId`, entityPrefixes.stageId),
    displayLabel: normalizeLabels(value.displayLabel, `${field}.displayLabel`),
    order: value.order,
    terminal: requireBoolean(value.terminal, `${field}.terminal`)
  };
}

function normalizeTransition(value, field, stageIds) {
  requireObject(value, field, ["transitionId", "fromStageId", "toStageId"]);
  const transition = {
    transitionId: normalizeId(value.transitionId, `${field}.transitionId`, entityPrefixes.transitionId),
    fromStageId: normalizeId(value.fromStageId, `${field}.fromStageId`, entityPrefixes.stageId),
    toStageId: normalizeId(value.toStageId, `${field}.toStageId`, entityPrefixes.stageId)
  };
  if (
    transition.fromStageId === transition.toStageId
    || !stageIds.has(transition.fromStageId)
    || !stageIds.has(transition.toStageId)
  ) {
    fail("invalid_stage_transition", field);
  }
  return transition;
}

function normalizeWorkflow(value, index, allStageIds) {
  const field = `workflows[${index}]`;
  requireObject(value, field, ["workflowId", "displayLabel", "stageIds", "transitions"]);
  const stageIds = requireArray(value.stageIds, `${field}.stageIds`, { min: 2, max: 50 })
    .map((stageId, stageIndex) => normalizeId(
      stageId,
      `${field}.stageIds[${stageIndex}]`,
      entityPrefixes.stageId
    ));
  unique(stageIds, `${field}.stageIds`);
  if (stageIds.some(stageId => !allStageIds.has(stageId))) {
    fail("unknown_workflow_stage", `${field}.stageIds`);
  }
  const workflowStageIds = new Set(stageIds);
  const transitions = requireArray(value.transitions, `${field}.transitions`, { min: 1, max: 100 })
    .map((transition, transitionIndex) => normalizeTransition(
      transition,
      `${field}.transitions[${transitionIndex}]`,
      workflowStageIds
    ))
    .sort((left, right) => left.transitionId.localeCompare(right.transitionId));
  unique(transitions, `${field}.transitions`, transition => transition.transitionId);
  return {
    workflowId: normalizeId(value.workflowId, `${field}.workflowId`, entityPrefixes.workflowId),
    displayLabel: normalizeLabels(value.displayLabel, `${field}.displayLabel`),
    stageIds,
    transitions
  };
}

function normalizeMetric(value, index) {
  const field = `metrics[${index}]`;
  requireObject(
    value,
    field,
    ["metricId", "semanticKey", "displayLabel", "unit", "aggregation"]
  );
  const metricId = normalizeId(value.metricId, `${field}.metricId`, entityPrefixes.metricId);
  const semanticKey = normalizeId(value.semanticKey, `${field}.semanticKey`);
  if (typeof value.unit !== "string" || !metricUnits.has(value.unit)) {
    fail("invalid_metric_unit", `${field}.unit`);
  }
  if (typeof value.aggregation !== "string" || !metricAggregations.has(value.aggregation)) {
    fail("invalid_metric_aggregation", `${field}.aggregation`);
  }
  return {
    metricId,
    semanticKey,
    displayLabel: normalizeLabels(value.displayLabel, `${field}.displayLabel`),
    unit: value.unit,
    aggregation: value.aggregation
  };
}

function compareSemver(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

export function validatePaidCustomerCrmWorkflowConfiguration(input) {
  requireObject(input, "configuration", topLevelKeys, topLevelKeys);
  if (input.contractVersion !== paidCustomerCrmContractVersion) {
    fail("unsupported_contract_version", "contractVersion");
  }
  const lifecycleState = String(input.lifecycleState || "");
  if (!lifecycleStateSet.has(lifecycleState)) fail("invalid_lifecycle_state", "lifecycleState");

  const roles = requireArray(input.roles, "roles", { min: 1, max: 20 })
    .map(normalizeRole)
    .sort((left, right) => left.roleId.localeCompare(right.roleId));
  unique(roles, "roles", role => role.roleId);
  if (!roles.some(role => role.permissions.includes("crm.workflow.manage"))) {
    fail("missing_workflow_manager", "roles");
  }

  const stages = requireArray(input.stages, "stages", { min: 2, max: 50 })
    .map(normalizeStage)
    .sort((left, right) => left.order - right.order || left.stageId.localeCompare(right.stageId));
  unique(stages, "stages", stage => stage.stageId);
  unique(stages, "stages.order", stage => stage.order);
  if (!stages.some(stage => stage.terminal)) fail("missing_terminal_stage", "stages");

  const allStageIds = new Set(stages.map(stage => stage.stageId));
  const workflows = requireArray(input.workflows, "workflows", { min: 1, max: 20 })
    .map((workflow, index) => normalizeWorkflow(workflow, index, allStageIds))
    .sort((left, right) => left.workflowId.localeCompare(right.workflowId));
  unique(workflows, "workflows", workflow => workflow.workflowId);

  const metrics = requireArray(input.metrics, "metrics", { min: 1, max: 50 })
    .map(normalizeMetric)
    .sort((left, right) => left.metricId.localeCompare(right.metricId));
  unique(metrics, "metrics", metric => metric.metricId);
  unique(metrics, "metrics.semanticKey", metric => metric.semanticKey);

  const normalized = {
    contractVersion: paidCustomerCrmContractVersion,
    configurationVersion: normalizeVersion(input.configurationVersion, "configurationVersion"),
    companyId: normalizeScopeId(input.companyId, "companyId", "company_"),
    workspaceId: normalizeScopeId(input.workspaceId, "workspaceId", "workspace_"),
    industryTemplateId: normalizeScopeId(
      input.industryTemplateId,
      "industryTemplateId",
      "industry_"
    ),
    lifecycleState,
    roles,
    stages,
    workflows,
    metrics
  };
  return {
    ...normalized,
    configurationDigest: digest(normalized)
  };
}

function requireMatchingScope(expected, actual, field = "scope") {
  if (
    expected.companyId !== actual.companyId
    || expected.workspaceId !== actual.workspaceId
  ) {
    fail("cross_company_workspace_scope", field);
  }
}

export function buildPaidCustomerCrmPreview(input) {
  const configuration = validatePaidCustomerCrmWorkflowConfiguration(input);
  if (!previewableStates.has(configuration.lifecycleState)) {
    fail("configuration_not_previewable", "lifecycleState");
  }
  return {
    contractVersion: paidCustomerCrmContractVersion,
    previewId: `crm_preview_${digest(configuration).slice(0, 24)}`,
    scope: {
      companyId: configuration.companyId,
      workspaceId: configuration.workspaceId
    },
    configurationVersion: configuration.configurationVersion,
    configurationDigest: configuration.configurationDigest,
    industryTemplateId: configuration.industryTemplateId,
    lifecycleState: "preview_ready",
    roles: clone(configuration.roles),
    stages: clone(configuration.stages),
    workflows: clone(configuration.workflows),
    metrics: clone(configuration.metrics),
    effects: {
      activating: false,
      productionMutationAuthorized: false,
      notificationAuthorized: false,
      customerRecordCreationAuthorized: false
    }
  };
}

function validateStateScope(input) {
  requireObject(input, "scope", ["companyId", "workspaceId"]);
  return {
    companyId: normalizeScopeId(input.companyId, "scope.companyId", "company_"),
    workspaceId: normalizeScopeId(input.workspaceId, "scope.workspaceId", "workspace_")
  };
}

export function createPaidCustomerCrmProvisioningState(scope) {
  const normalizedScope = validateStateScope(scope);
  return {
    stateVersion: paidCustomerCrmStateVersion,
    companyId: normalizedScope.companyId,
    workspaceId: normalizedScope.workspaceId,
    lifecycleState: "draft",
    configurationVersion: null,
    configurationDigest: null,
    roles: {},
    stages: {},
    workflows: {},
    metrics: {},
    appliedOperationIds: [],
    consumedAttemptIds: [],
    auditRecords: [],
    controls: {
      productionMutationAttempts: 0,
      notificationAttempts: 0,
      customerRecordMutationAttempts: 0,
      activationAttempts: 0,
      recordWritesAllowed: false,
      retainedConfiguration: true
    }
  };
}

function validateProvisioningState(state) {
  if (!isPlainObject(state) || state.stateVersion !== paidCustomerCrmStateVersion) {
    fail("invalid_projection_state", "state");
  }
  validateStateScope({ companyId: state.companyId, workspaceId: state.workspaceId });
  for (const field of [
    "roles",
    "stages",
    "workflows",
    "metrics",
    "controls"
  ]) {
    if (!isPlainObject(state[field])) fail("invalid_projection_state", `state.${field}`);
  }
  for (const field of ["appliedOperationIds", "consumedAttemptIds", "auditRecords"]) {
    if (!Array.isArray(state[field])) fail("invalid_projection_state", `state.${field}`);
  }
  if (!lifecycleStateSet.has(state.lifecycleState)) {
    fail("invalid_projection_state", "state.lifecycleState");
  }
  unique(state.appliedOperationIds, "state.appliedOperationIds");
  unique(state.consumedAttemptIds, "state.consumedAttemptIds");
  verifyPaidCustomerCrmAuditChain(state.auditRecords);
  return state;
}

function entityOperations(configuration, kind, idField, definitions) {
  return definitions.map(definition => {
    const entityId = definition[idField];
    const definitionDigest = digest(definition);
    return {
      operationId: `crm_op_${digest({
        companyId: configuration.companyId,
        workspaceId: configuration.workspaceId,
        configurationVersion: configuration.configurationVersion,
        kind,
        entityId,
        definitionDigest
      }).slice(0, 24)}`,
      kind,
      entityId,
      definitionDigest,
      definition: clone(definition)
    };
  });
}

function assertConfigurationProgression(configuration, state) {
  if (!state.configurationVersion) return;
  const comparison = compareSemver(
    configuration.configurationVersion,
    state.configurationVersion
  );
  if (comparison < 0) fail("configuration_version_regression", "configurationVersion");
  if (
    comparison === 0
    && state.configurationDigest
    && state.configurationDigest !== configuration.configurationDigest
  ) {
    fail("configuration_version_conflict", "configurationVersion");
  }
  for (const metric of configuration.metrics) {
    const existing = state.metrics[metric.metricId];
    if (existing && existing.semanticKey !== metric.semanticKey) {
      fail("metric_semantic_drift", "metrics.semanticKey");
    }
  }
}

export function buildPaidCustomerCrmProvisioningPlan(input, existingState = null) {
  const configuration = validatePaidCustomerCrmWorkflowConfiguration(input);
  if (!previewableStates.has(configuration.lifecycleState)) {
    fail("configuration_not_provisionable", "lifecycleState");
  }
  if (existingState) {
    validateProvisioningState(existingState);
    requireMatchingScope(configuration, existingState, "state");
    if (["suspended", "offboarded"].includes(existingState.lifecycleState)) {
      fail("lifecycle_blocks_provisioning", "state.lifecycleState");
    }
    assertConfigurationProgression(configuration, existingState);
  }

  const operations = [
    ...entityOperations(configuration, "ensure_role", "roleId", configuration.roles),
    ...entityOperations(configuration, "ensure_stage", "stageId", configuration.stages),
    ...entityOperations(configuration, "ensure_workflow", "workflowId", configuration.workflows),
    ...entityOperations(configuration, "ensure_metric", "metricId", configuration.metrics)
  ];
  const planCore = {
    contractVersion: paidCustomerCrmContractVersion,
    scope: {
      companyId: configuration.companyId,
      workspaceId: configuration.workspaceId
    },
    configurationVersion: configuration.configurationVersion,
    configurationDigest: configuration.configurationDigest,
    industryTemplateId: configuration.industryTemplateId,
    sourceLifecycleState: configuration.lifecycleState,
    operations,
    effects: {
      targetLifecycleState: "ready_for_activation",
      productionMutationAuthorized: false,
      notificationAuthorized: false,
      customerRecordMutationAuthorized: false,
      activationAuthorized: false
    }
  };
  return {
    ...planCore,
    planId: `crm_plan_${digest(planCore).slice(0, 24)}`
  };
}

function planConfigurationFromOperations(plan) {
  const definitionsByKind = {
    ensure_role: [],
    ensure_stage: [],
    ensure_workflow: [],
    ensure_metric: []
  };
  requireArray(plan.operations, "plan.operations", { min: 5, max: 140 });
  unique(plan.operations, "plan.operations", operation => operation?.operationId);
  plan.operations.forEach((operation, index) => {
    const field = `plan.operations[${index}]`;
    requireObject(operation, field, [
      "operationId",
      "kind",
      "entityId",
      "definitionDigest",
      "definition"
    ]);
    if (!Object.hasOwn(definitionsByKind, operation.kind)) {
      fail("unknown_provisioning_operation", `${field}.kind`);
    }
    normalizeId(operation.operationId, `${field}.operationId`);
    if (!operation.operationId.startsWith("crm_op_")) {
      fail("invalid_operation_id", `${field}.operationId`);
    }
    normalizeId(operation.entityId, `${field}.entityId`);
    if (
      typeof operation.definitionDigest !== "string"
      || !/^[a-f0-9]{64}$/u.test(operation.definitionDigest)
      || digest(operation.definition) !== operation.definitionDigest
    ) {
      fail("operation_definition_integrity_mismatch", field);
    }
    definitionsByKind[operation.kind].push(operation.definition);
  });
  return {
    contractVersion: plan.contractVersion,
    configurationVersion: plan.configurationVersion,
    companyId: plan.scope.companyId,
    workspaceId: plan.scope.workspaceId,
    industryTemplateId: plan.industryTemplateId,
    lifecycleState: plan.sourceLifecycleState,
    roles: definitionsByKind.ensure_role,
    stages: definitionsByKind.ensure_stage,
    workflows: definitionsByKind.ensure_workflow,
    metrics: definitionsByKind.ensure_metric
  };
}

export function validatePaidCustomerCrmProvisioningPlan(planInput) {
  const plan = clone(planInput);
  requireObject(plan, "plan", [
    "contractVersion",
    "scope",
    "configurationVersion",
    "configurationDigest",
    "industryTemplateId",
    "sourceLifecycleState",
    "operations",
    "effects",
    "planId"
  ]);
  if (plan.contractVersion !== paidCustomerCrmContractVersion) {
    fail("unsupported_contract_version", "plan.contractVersion");
  }
  validateStateScope(plan.scope);
  normalizeVersion(plan.configurationVersion, "plan.configurationVersion");
  normalizeScopeId(plan.industryTemplateId, "plan.industryTemplateId", "industry_");
  if (!previewableStates.has(plan.sourceLifecycleState)) {
    fail("configuration_not_provisionable", "plan.sourceLifecycleState");
  }
  if (
    typeof plan.configurationDigest !== "string"
    || !/^[a-f0-9]{64}$/u.test(plan.configurationDigest)
  ) {
    fail("configuration_integrity_mismatch", "plan.configurationDigest");
  }
  requireObject(plan.effects, "plan.effects", [
    "targetLifecycleState",
    "productionMutationAuthorized",
    "notificationAuthorized",
    "customerRecordMutationAuthorized",
    "activationAuthorized"
  ]);
  const expectedEffects = {
    targetLifecycleState: "ready_for_activation",
    productionMutationAuthorized: false,
    notificationAuthorized: false,
    customerRecordMutationAuthorized: false,
    activationAuthorized: false
  };
  if (canonicalJson(plan.effects) !== canonicalJson(expectedEffects)) {
    fail("unsafe_plan_effects", "plan.effects");
  }

  const configuration = validatePaidCustomerCrmWorkflowConfiguration(
    planConfigurationFromOperations(plan)
  );
  if (configuration.configurationDigest !== plan.configurationDigest) {
    fail("configuration_integrity_mismatch", "plan.configurationDigest");
  }
  const expectedOperations = [
    ...entityOperations(configuration, "ensure_role", "roleId", configuration.roles),
    ...entityOperations(configuration, "ensure_stage", "stageId", configuration.stages),
    ...entityOperations(configuration, "ensure_workflow", "workflowId", configuration.workflows),
    ...entityOperations(configuration, "ensure_metric", "metricId", configuration.metrics)
  ];
  if (canonicalJson(expectedOperations) !== canonicalJson(plan.operations)) {
    fail("operation_integrity_mismatch", "plan.operations");
  }
  const { planId, ...planCore } = plan;
  const expectedPlanId = `crm_plan_${digest(planCore).slice(0, 24)}`;
  if (planId !== expectedPlanId) fail("plan_integrity_mismatch", "plan.planId");
  return plan;
}

function appendAudit(state, event) {
  const previousDigest = state.auditRecords.at(-1)?.recordDigest || "GENESIS";
  const core = {
    auditVersion: "route_iq_paid_customer_crm_audit.v1",
    sequence: state.auditRecords.length + 1,
    companyId: state.companyId,
    workspaceId: state.workspaceId,
    eventType: event.eventType,
    attemptId: event.attemptId || "",
    planId: event.planId || "",
    subjectType: event.subjectType || "",
    subjectId: event.subjectId || "",
    resultCode: event.resultCode,
    previousDigest
  };
  const record = {
    ...core,
    recordDigest: digest(core)
  };
  state.auditRecords.push(record);
  return record;
}

export function verifyPaidCustomerCrmAuditChain(records) {
  requireArray(records, "auditRecords", { max: 10000 });
  let previousDigest = "GENESIS";
  records.forEach((record, index) => {
    requireObject(record, `auditRecords[${index}]`, [
      "auditVersion",
      "sequence",
      "companyId",
      "workspaceId",
      "eventType",
      "attemptId",
      "planId",
      "subjectType",
      "subjectId",
      "resultCode",
      "previousDigest",
      "recordDigest"
    ]);
    const { recordDigest, ...core } = record;
    if (
      record.sequence !== index + 1
      || record.previousDigest !== previousDigest
      || digest(core) !== recordDigest
    ) {
      fail("audit_chain_invalid", `auditRecords[${index}]`);
    }
    previousDigest = recordDigest;
  });
  return true;
}

function normalizeAttemptId(value) {
  const attemptId = normalizeId(value, "attemptId");
  if (!attemptId.startsWith("attempt_")) fail("invalid_attempt_id", "attemptId");
  return attemptId;
}

function projectionMapForKind(state, kind) {
  return {
    ensure_role: state.roles,
    ensure_stage: state.stages,
    ensure_workflow: state.workflows,
    ensure_metric: state.metrics
  }[kind];
}

function applyProjectionOperation(state, operation, configurationVersion) {
  const target = projectionMapForKind(state, operation.kind);
  if (!target) fail("unknown_provisioning_operation", "plan.operations");
  const existing = target[operation.entityId];
  if (
    operation.kind === "ensure_metric"
    && existing
    && existing.semanticKey !== operation.definition.semanticKey
  ) {
    fail("metric_semantic_drift", "plan.operations");
  }
  target[operation.entityId] = {
    ...clone(operation.definition),
    configurationVersion,
    definitionDigest: operation.definitionDigest
  };
}

function failedProvisioningResult(state, plan, attemptId, operation, applied, skipped) {
  state.lifecycleState = "provisioning_failed";
  appendAudit(state, {
    eventType: "provisioning_failed",
    attemptId,
    planId: plan.planId,
    subjectType: "operation",
    subjectId: operation.operationId,
    resultCode: "SAFE_RETRY_REQUIRED"
  });
  verifyPaidCustomerCrmAuditChain(state.auditRecords);
  return {
    ok: false,
    state,
    planId: plan.planId,
    attemptId,
    appliedOperationCount: applied,
    skippedOperationCount: skipped,
    recovery: {
      retrySafe: true,
      instructionCode: "RETRY_SAME_PLAN_WITH_FRESH_ATTEMPT_ID",
      productionMutationPerformed: false,
      notificationPerformed: false,
      customerRecordMutationPerformed: false
    }
  };
}

export function applyPaidCustomerCrmProvisioningPlan(stateInput, planInput, options = {}) {
  validateProvisioningState(stateInput);
  const state = clone(stateInput);
  const plan = validatePaidCustomerCrmProvisioningPlan(planInput);
  requireMatchingScope(state, plan.scope, "plan.scope");
  if (!provisionableStates.has(state.lifecycleState)) {
    fail("lifecycle_blocks_provisioning", "state.lifecycleState");
  }
  if (state.configurationVersion) {
    const comparison = compareSemver(plan.configurationVersion, state.configurationVersion);
    if (comparison < 0) fail("configuration_version_regression", "plan.configurationVersion");
    if (
      comparison === 0
      && state.configurationDigest
      && state.configurationDigest !== plan.configurationDigest
    ) {
      fail("configuration_version_conflict", "plan.configurationVersion");
    }
  }

  const attemptId = normalizeAttemptId(options.attemptId);
  if (state.consumedAttemptIds.includes(attemptId)) fail("attempt_replay", "attemptId");
  state.consumedAttemptIds.push(attemptId);
  state.lifecycleState = "provisioning";
  appendAudit(state, {
    eventType: "provisioning_started",
    attemptId,
    planId: plan.planId,
    subjectType: "plan",
    subjectId: plan.planId,
    resultCode: "STARTED"
  });

  const failureAtOperationId = options.failureAtOperationId || "";
  if (failureAtOperationId && !plan.operations.some(operation => operation.operationId === failureAtOperationId)) {
    fail("unknown_failure_fixture", "failureAtOperationId");
  }

  let applied = 0;
  let skipped = 0;
  for (const operation of plan.operations) {
    if (state.appliedOperationIds.includes(operation.operationId)) {
      skipped += 1;
      continue;
    }
    if (operation.operationId === failureAtOperationId) {
      return failedProvisioningResult(state, plan, attemptId, operation, applied, skipped);
    }
    applyProjectionOperation(state, operation, plan.configurationVersion);
    state.appliedOperationIds.push(operation.operationId);
    applied += 1;
    appendAudit(state, {
      eventType: "configuration_projection_applied",
      attemptId,
      planId: plan.planId,
      subjectType: operation.kind,
      subjectId: operation.entityId,
      resultCode: "APPLIED"
    });
  }

  state.configurationVersion = plan.configurationVersion;
  state.configurationDigest = plan.configurationDigest;
  state.lifecycleState = "ready_for_activation";
  state.controls.recordWritesAllowed = false;
  appendAudit(state, {
    eventType: "provisioning_completed",
    attemptId,
    planId: plan.planId,
    subjectType: "plan",
    subjectId: plan.planId,
    resultCode: "READY_FOR_ACTIVATION"
  });
  verifyPaidCustomerCrmAuditChain(state.auditRecords);
  return {
    ok: true,
    state,
    planId: plan.planId,
    attemptId,
    appliedOperationCount: applied,
    skippedOperationCount: skipped,
    effects: {
      productionMutationPerformed: false,
      notificationPerformed: false,
      customerRecordMutationPerformed: false,
      activationPerformed: false
    }
  };
}

function validatePrincipal(principal) {
  requireObject(principal, "principal", [
    "authenticated",
    "principalId",
    "companyId",
    "workspaceId",
    "roleId"
  ]);
  if (principal.authenticated !== true) fail("principal_not_authenticated", "principal");
  return {
    authenticated: true,
    principalId: normalizeId(principal.principalId, "principal.principalId"),
    companyId: normalizeScopeId(principal.companyId, "principal.companyId", "company_"),
    workspaceId: normalizeScopeId(principal.workspaceId, "principal.workspaceId", "workspace_"),
    roleId: normalizeId(principal.roleId, "principal.roleId", entityPrefixes.roleId)
  };
}

function validateResource(resource) {
  requireObject(resource, "resource", [
    "companyId",
    "workspaceId",
    "resourceType",
    "resourceId"
  ]);
  return {
    companyId: normalizeScopeId(resource.companyId, "resource.companyId", "company_"),
    workspaceId: normalizeScopeId(resource.workspaceId, "resource.workspaceId", "workspace_"),
    resourceType: normalizeId(resource.resourceType, "resource.resourceType"),
    resourceId: normalizeId(resource.resourceId, "resource.resourceId")
  };
}

export function authorizePaidCustomerCrmOperation(stateInput, principalInput, resourceInput, operation) {
  const state = validateProvisioningState(stateInput);
  const principal = validatePrincipal(principalInput);
  const resource = validateResource(resourceInput);
  if (!permissionSet.has(operation)) fail("unknown_permission", "operation");
  requireMatchingScope(state, principal, "principal");
  requireMatchingScope(state, resource, "resource");
  const role = state.roles[principal.roleId];
  if (!role || !role.permissions.includes(operation)) fail("role_not_authorized", "principal.roleId");
  if (state.lifecycleState === "offboarded" && operation !== "crm.audit.read") {
    fail("offboarded_workspace_access_denied", "state.lifecycleState");
  }
  if (state.lifecycleState === "suspended" && writeOperations.has(operation)) {
    fail("suspended_workspace_write_denied", "state.lifecycleState");
  }
  return {
    authorized: true,
    principalId: principal.principalId,
    companyId: state.companyId,
    workspaceId: state.workspaceId,
    roleId: role.roleId,
    operation,
    resourceType: resource.resourceType,
    resourceId: resource.resourceId
  };
}

export function readPaidCustomerCrmScopedResource(
  state,
  principal,
  resource,
  operation = "crm.workflow.read"
) {
  const authorization = authorizePaidCustomerCrmOperation(
    state,
    principal,
    resource,
    operation
  );
  return {
    authorization,
    resource: clone(resource)
  };
}

export function snapshotPaidCustomerCrmMetric(configurationInput, metricId, input) {
  const configuration = validatePaidCustomerCrmWorkflowConfiguration(configurationInput);
  const normalizedMetricId = normalizeId(metricId, "metricId", entityPrefixes.metricId);
  const metric = configuration.metrics.find(candidate => candidate.metricId === normalizedMetricId);
  if (!metric) fail("unknown_metric", "metricId");
  requireObject(input, "metricSnapshot", ["value", "recordedAt"]);
  if (typeof input.value !== "number" || !Number.isFinite(input.value)) {
    fail("invalid_metric_value", "metricSnapshot.value");
  }
  const recordedAt = new Date(input.recordedAt);
  if (Number.isNaN(recordedAt.getTime())) fail("invalid_timestamp", "metricSnapshot.recordedAt");
  return {
    snapshotVersion: "route_iq_paid_customer_crm_metric_snapshot.v1",
    companyId: configuration.companyId,
    workspaceId: configuration.workspaceId,
    configurationVersion: configuration.configurationVersion,
    metricId: metric.metricId,
    semanticKey: metric.semanticKey,
    displayLabelSnapshot: clone(metric.displayLabel),
    unit: metric.unit,
    aggregation: metric.aggregation,
    value: input.value,
    recordedAt: recordedAt.toISOString()
  };
}

const lifecycleTransitions = Object.freeze({
  ready_for_activation: new Set(["suspended"]),
  active: new Set(["suspended"]),
  suspended: new Set(["offboarded"])
});

export function transitionPaidCustomerCrmLifecycle(
  stateInput,
  principalInput,
  targetLifecycleState,
  options = {}
) {
  const state = validateProvisioningState(stateInput);
  if (!lifecycleStateSet.has(targetLifecycleState)) {
    fail("invalid_lifecycle_state", "targetLifecycleState");
  }
  if (targetLifecycleState === "active") {
    fail("activation_requires_separate_authorization", "targetLifecycleState");
  }
  const principal = validatePrincipal(principalInput);
  requireMatchingScope(state, principal, "principal");
  const lifecycleRole = state.roles[principal.roleId];
  if (!lifecycleRole?.permissions.includes("crm.lifecycle.manage")) {
    fail("role_not_authorized", "principal.roleId");
  }
  if (state.lifecycleState === targetLifecycleState) {
    return {
      changed: false,
      state: clone(state),
      effects: {
        productionMutationPerformed: false,
        notificationPerformed: false,
        customerRecordMutationPerformed: false
      }
    };
  }
  const changeId = normalizeId(options.changeId, "changeId");
  if (!changeId.startsWith("lifecycle_")) fail("invalid_change_id", "changeId");
  const resource = {
    companyId: state.companyId,
    workspaceId: state.workspaceId,
    resourceType: "crm.lifecycle",
    resourceId: "crm.lifecycle.workspace"
  };
  validateResource(resource);
  if (!lifecycleTransitions[state.lifecycleState]?.has(targetLifecycleState)) {
    fail("unsafe_lifecycle_transition", "targetLifecycleState");
  }
  const next = clone(state);
  next.lifecycleState = targetLifecycleState;
  next.controls.recordWritesAllowed = false;
  appendAudit(next, {
    eventType: targetLifecycleState === "suspended"
      ? "workspace_suspended"
      : "workspace_offboarded",
    attemptId: changeId,
    subjectType: "workspace_lifecycle",
    subjectId: "crm.lifecycle.workspace",
    resultCode: targetLifecycleState === "suspended"
      ? "SUSPENDED_NO_WRITES"
      : "OFFBOARDED_CONFIGURATION_RETAINED"
  });
  verifyPaidCustomerCrmAuditChain(next.auditRecords);
  return {
    changed: true,
    state: next,
    effects: {
      productionMutationPerformed: false,
      notificationPerformed: false,
      customerRecordMutationPerformed: false,
      configurationDeleted: false,
      auditDeleted: false
    }
  };
}
