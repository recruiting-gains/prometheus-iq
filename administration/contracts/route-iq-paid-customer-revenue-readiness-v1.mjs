export const ROUTE_IQ_REVENUE_SCHEMA_VERSION = "route-iq-paid-customer-revenue-readiness-v1";
export const ROUTE_IQ_REVENUE_CONTRACT_VERSION = "1.0.0";
export const ROUTE_IQ_REVENUE_AUTHORITY = "prometheus_administration";
export const ROUTE_IQ_PROPOSED_ENTITY = "Prometheus Route Intelligence LLC";
export const ROUTE_IQ_PRODUCT_NAME = "Prometheus Route IQ";

export const ROUTE_IQ_REVENUE_STATES = Object.freeze([
  "DRAFT",
  "VALIDATION_FAILED",
  "VALIDATED",
  "AWAITING_COMMERCIAL_APPROVAL",
  "READY_FOR_ACTIVATION",
  "ACTIVE",
  "SUSPENDED",
  "CANCELLED"
]);

const TRANSITIONS = Object.freeze({
  DRAFT: new Set(["VALIDATION_FAILED", "VALIDATED"]),
  VALIDATION_FAILED: new Set(["DRAFT"]),
  VALIDATED: new Set(["AWAITING_COMMERCIAL_APPROVAL", "DRAFT"]),
  AWAITING_COMMERCIAL_APPROVAL: new Set(["READY_FOR_ACTIVATION", "DRAFT"]),
  READY_FOR_ACTIVATION: new Set(["ACTIVE", "SUSPENDED"]),
  ACTIVE: new Set(["SUSPENDED", "CANCELLED"]),
  SUSPENDED: new Set(["ACTIVE", "CANCELLED"]),
  CANCELLED: new Set()
});

export const ROUTE_IQ_ACTIVATION_EVIDENCE = Object.freeze([
  "founder_commercial_approval",
  "customer_order_form_acceptance",
  "legal_review_approval",
  "data_handling_approval",
  "support_owner_assignment",
  "customer_workspace_validation"
]);

export const ROUTE_IQ_LIVE_REVENUE_EVIDENCE = Object.freeze([
  "registered_legal_entity",
  "tax_identity_confirmed",
  "business_bank_account_confirmed",
  "founder_price_approval",
  "billing_provider_production_approval",
  "customer_payment_authorization",
  "executed_customer_agreement",
  "refund_cancellation_policy_approval"
]);

const ID = /^[a-z][a-z0-9_]{2,127}$/u;
const SEMVER = /^[1-9][0-9]*\.[0-9]+\.[0-9]+$/u;
const ISO_INSTANT =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\.[0-9]{3})?Z$/u;
const OPAQUE_SIGNATURE = /^[A-Za-z0-9_-]{43,512}$/u;
const RECEIPT_TYPES = Object.freeze({
  customerActivation: Object.freeze({
    receiptType: "CUSTOMER_ACTIVATION_AUTHORIZATION",
    authorityId: "project_external_customer_activation_authority"
  }),
  liveRevenue: Object.freeze({
    receiptType: "LIVE_REVENUE_AUTHORIZATION",
    authorityId: "project_external_live_revenue_authority"
  })
});
const EXTERNAL_AUTHORITY_REGISTRY = Object.freeze({});
const UNSAFE = /[<>{}`\\]|(?:\$\{)|(?:\{\{)|(?:javascript\s*:)|[\u0000-\u001f\u007f]/iu;
const REQUIRED_MODEL_KEYS = Object.freeze([
  "schemaVersion",
  "contractVersion",
  "authority",
  "modelId",
  "modelVersion",
  "company",
  "product",
  "plans",
  "intake",
  "activation",
  "liveRevenue",
  "provenance"
]);

export class RouteIqRevenueReadinessError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RouteIqRevenueReadinessError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new RouteIqRevenueReadinessError(code, message, details);
}

function assertObject(value, scope) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("route_iq_revenue_structure_invalid", `${scope} must be an object.`);
  }
}

function assertKeys(value, keys, scope) {
  assertObject(value, scope);
  const actual = Reflect.ownKeys(value);
  const allowed = new Set(keys);
  const unknown = actual.filter(key => typeof key !== "string" || !allowed.has(key));
  const missing = keys.filter(key => !Object.hasOwn(value, key));
  if (unknown.length || missing.length) {
    fail("route_iq_revenue_fields_invalid", `${scope} has invalid fields.`, {
      missingFieldCount: missing.length,
      unknownFieldCount: unknown.length
    });
  }
}

function assertId(value, scope) {
  if (typeof value !== "string" || !ID.test(value)) {
    fail("route_iq_revenue_identifier_invalid", `${scope} must be an opaque identifier.`);
  }
}

function assertVersion(value, scope) {
  if (typeof value !== "string" || !SEMVER.test(value)) {
    fail("route_iq_revenue_version_invalid", `${scope} must be a semantic version.`);
  }
}

function assertInstant(value, scope) {
  if (typeof value !== "string" || !ISO_INSTANT.test(value) || Number.isNaN(Date.parse(value))) {
    fail("route_iq_revenue_timestamp_invalid", `${scope} must be a canonical UTC timestamp.`);
  }
}

function assertSafeText(value, scope, max = 240) {
  if (
    typeof value !== "string"
    || value !== value.trim()
    || !value
    || value.length > max
    || UNSAFE.test(value)
  ) {
    fail("route_iq_revenue_text_unsafe", `${scope} must be bounded safe text.`);
  }
}

function assertUnique(values, scope) {
  if (new Set(values).size !== values.length) {
    fail("route_iq_revenue_duplicate_value", `${scope} must contain unique values.`);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function validateEvidenceRequirement(requirement, scope) {
  assertKeys(requirement, ["evidenceId", "required", "status"], scope);
  assertId(requirement.evidenceId, `${scope}.evidenceId`);
  if (requirement.required !== true) {
    fail("route_iq_revenue_required_evidence_optional", `${scope} must remain required.`);
  }
  if (requirement.status !== "FOUNDER DECISION REQUIRED") {
    fail("route_iq_revenue_evidence_premature", `${scope} cannot be pre-approved.`);
  }
}

export function validateRouteIqRevenueModel(input) {
  const model = clone(input);
  assertKeys(model, REQUIRED_MODEL_KEYS, "model");
  if (model.schemaVersion !== ROUTE_IQ_REVENUE_SCHEMA_VERSION) {
    fail("route_iq_revenue_schema_version_unsupported", "Schema version is not supported.");
  }
  if (model.contractVersion !== ROUTE_IQ_REVENUE_CONTRACT_VERSION) {
    fail("route_iq_revenue_contract_version_unsupported", "Contract version is not supported.");
  }
  if (model.authority !== ROUTE_IQ_REVENUE_AUTHORITY) {
    fail("route_iq_revenue_authority_invalid", "Administration authority is required.");
  }
  assertId(model.modelId, "model.modelId");
  assertVersion(model.modelVersion, "model.modelVersion");

  assertKeys(model.company, ["proposedName", "registrationStatus"], "model.company");
  if (
    model.company.proposedName !== ROUTE_IQ_PROPOSED_ENTITY
    || model.company.registrationStatus !== "PROPOSED_UNREGISTERED"
  ) {
    fail("route_iq_revenue_entity_status_invalid", "The proposed entity must remain unregistered.");
  }
  assertKeys(model.product, ["name", "activeProduct"], "model.product");
  if (model.product.name !== ROUTE_IQ_PRODUCT_NAME || model.product.activeProduct !== true) {
    fail("route_iq_revenue_product_invalid", "Prometheus Route IQ must be the active product.");
  }

  if (!Array.isArray(model.plans) || model.plans.length === 0) {
    fail("route_iq_revenue_plans_invalid", "At least one governed plan shell is required.");
  }
  model.plans.forEach((plan, index) => {
    const scope = `model.plans[${index}]`;
    assertKeys(plan, [
      "planId",
      "version",
      "displayName",
      "currency",
      "price",
      "billingCadence",
      "status"
    ], scope);
    assertId(plan.planId, `${scope}.planId`);
    assertVersion(plan.version, `${scope}.version`);
    assertSafeText(plan.displayName, `${scope}.displayName`, 80);
    if (
      plan.currency !== null
      || plan.price !== null
      || plan.billingCadence !== null
      || plan.status !== "FOUNDER DECISION REQUIRED"
    ) {
      fail("route_iq_revenue_price_invented", "Unapproved pricing terms must remain unset.");
    }
  });
  assertUnique(model.plans.map(plan => `${plan.planId}@${plan.version}`), "model.plans");

  assertKeys(model.intake, ["maximumState", "productionMutationAllowed"], "model.intake");
  if (model.intake.maximumState !== "DRAFT" || model.intake.productionMutationAllowed !== false) {
    fail("route_iq_revenue_intake_boundary_invalid", "Intake must remain Draft-only and non-mutating.");
  }

  for (const [key, expectedIds] of [
    ["activation", ROUTE_IQ_ACTIVATION_EVIDENCE],
    ["liveRevenue", ROUTE_IQ_LIVE_REVENUE_EVIDENCE]
  ]) {
    assertKeys(model[key], ["enabled", "requiredEvidence"], `model.${key}`);
    if (model[key].enabled !== false || !Array.isArray(model[key].requiredEvidence)) {
      fail("route_iq_revenue_gate_open", `${key} must remain disabled.`);
    }
    model[key].requiredEvidence.forEach((entry, index) =>
      validateEvidenceRequirement(entry, `model.${key}.requiredEvidence[${index}]`)
    );
    const ids = model[key].requiredEvidence.map(entry => entry.evidenceId);
    assertUnique(ids, `model.${key}.requiredEvidence`);
    if (
      expectedIds.length !== ids.length
      || expectedIds.some(id => !ids.includes(id))
    ) {
      fail("route_iq_revenue_evidence_set_invalid", `${key} evidence is incomplete.`);
    }
  }

  assertKeys(model.provenance, [
    "source",
    "versionPinned",
    "founderDecisionRegister"
  ], "model.provenance");
  assertSafeText(model.provenance.source, "model.provenance.source", 160);
  if (
    model.provenance.versionPinned !== `${model.modelId}@${model.modelVersion}`
    || model.provenance.founderDecisionRegister
      !== "route-iq-paid-customer-revenue-founder-decisions-v1"
  ) {
    fail("route_iq_revenue_provenance_invalid", "Commercial provenance must be exactly pinned.");
  }
  return deepFreeze(model);
}

export function transitionRouteIqRevenueLifecycle(current, nextState, authorization = {}) {
  if (!ROUTE_IQ_REVENUE_STATES.includes(current)) {
    fail("route_iq_revenue_state_invalid", "Current revenue lifecycle state is invalid.");
  }
  if (!ROUTE_IQ_REVENUE_STATES.includes(nextState) || !TRANSITIONS[current].has(nextState)) {
    fail("route_iq_revenue_transition_forbidden", "Revenue lifecycle transition is forbidden.");
  }
  if (nextState === "READY_FOR_ACTIVATION") {
    validateRouteIqExternalAuthorizationReceipt(
      authorization.customerActivationReceipt,
      RECEIPT_TYPES.customerActivation,
      authorization.scope
    );
  }
  if (nextState === "ACTIVE") {
    validateRouteIqExternalAuthorizationReceipt(
      authorization.customerActivationReceipt,
      RECEIPT_TYPES.customerActivation,
      authorization.scope
    );
    validateRouteIqExternalAuthorizationReceipt(
      authorization.liveRevenueReceipt,
      RECEIPT_TYPES.liveRevenue,
      authorization.scope
    );
  }
  return nextState;
}

function assertExternalScope(scope) {
  assertKeys(scope, [
    "companyId",
    "workspaceId",
    "authorizedActorId",
    "configurationRevision",
    "modelPin",
    "evaluatedAt"
  ], "authorization.scope");
  assertId(scope.companyId, "authorization.scope.companyId");
  assertId(scope.workspaceId, "authorization.scope.workspaceId");
  assertId(scope.authorizedActorId, "authorization.scope.authorizedActorId");
  if (scope.companyId === scope.workspaceId) {
    fail("route_iq_revenue_receipt_scope_invalid", "Company and workspace must be distinct.");
  }
  if (!Number.isInteger(scope.configurationRevision) || scope.configurationRevision < 1) {
    fail("route_iq_revenue_receipt_revision_invalid", "Configuration revision is invalid.");
  }
  assertSafeText(scope.modelPin, "authorization.scope.modelPin", 180);
  assertInstant(scope.evaluatedAt, "authorization.scope.evaluatedAt");
}

function validateRouteIqExternalAuthorizationReceipt(receipt, expectedType, scope) {
  if (receipt === undefined || receipt === null) {
    fail("route_iq_revenue_authorization_receipt_missing", "External authorization receipt is required.");
  }
  assertExternalScope(scope);
  assertKeys(receipt, [
    "receiptType",
    "receiptVersion",
    "authorityId",
    "authorizationId",
    "companyId",
    "workspaceId",
    "actorId",
    "actorRole",
    "configurationRevision",
    "modelPin",
    "decision",
    "issuedAt",
    "expiresAt",
    "signature"
  ], "authorization.receipt");
  if (
    receipt.receiptType !== expectedType.receiptType
    || receipt.receiptVersion !== "1.0.0"
    || receipt.authorityId !== expectedType.authorityId
    || receipt.decision !== "AUTHORIZED"
  ) {
    fail("route_iq_revenue_receipt_type_invalid", "Receipt authority or decision is invalid.");
  }
  assertId(receipt.authorizationId, "authorization.receipt.authorizationId");
  assertId(receipt.companyId, "authorization.receipt.companyId");
  assertId(receipt.workspaceId, "authorization.receipt.workspaceId");
  assertId(receipt.actorId, "authorization.receipt.actorId");
  if (receipt.actorRole !== "FOUNDER") {
    fail("route_iq_revenue_receipt_actor_invalid", "Receipt actor role is not authorized.");
  }
  if (receipt.actorId !== scope.authorizedActorId) {
    fail("route_iq_revenue_receipt_actor_invalid", "Receipt actor identity is not authorized.");
  }
  if (
    receipt.companyId !== scope.companyId
    || receipt.workspaceId !== scope.workspaceId
  ) {
    fail("route_iq_revenue_receipt_scope_mismatch", "Receipt tenant or workspace does not match.");
  }
  if (receipt.configurationRevision !== scope.configurationRevision) {
    fail("route_iq_revenue_receipt_revision_stale", "Receipt revision does not match.");
  }
  if (receipt.modelPin !== scope.modelPin) {
    fail("route_iq_revenue_receipt_model_mismatch", "Receipt model pin does not match.");
  }
  assertInstant(receipt.issuedAt, "authorization.receipt.issuedAt");
  assertInstant(receipt.expiresAt, "authorization.receipt.expiresAt");
  const evaluatedAt = Date.parse(scope.evaluatedAt);
  if (
    Date.parse(receipt.issuedAt) > evaluatedAt
    || Date.parse(receipt.expiresAt) <= evaluatedAt
  ) {
    fail("route_iq_revenue_receipt_time_invalid", "Receipt is premature or expired.");
  }
  if (typeof receipt.signature !== "string" || !OPAQUE_SIGNATURE.test(receipt.signature)) {
    fail("route_iq_revenue_receipt_signature_invalid", "Receipt signature encoding is invalid.");
  }

  const trustedAuthority = EXTERNAL_AUTHORITY_REGISTRY[receipt.authorityId];
  if (!trustedAuthority) {
    fail(
      "route_iq_revenue_external_authority_unavailable",
      "Project-external authorization authority is intentionally unavailable."
    );
  }
  if (trustedAuthority.verify(receipt) !== true) {
    fail("route_iq_revenue_receipt_signature_invalid", "Receipt signature is invalid.");
  }
  return deepFreeze({ valid: true, authorizationId: receipt.authorizationId });
}

function evaluateGate(requiredIds, evidence, code) {
  assertObject(evidence, "evidence");
  const missing = requiredIds.filter(id => evidence[id] !== "VERIFIED");
  if (missing.length) {
    fail(code, "Required evidence is incomplete.", { missingEvidenceCount: missing.length });
  }
  return deepFreeze({ pass: true, evidenceCount: requiredIds.length });
}

export function evaluateRouteIqActivationGate(evidence) {
  return evaluateGate(
    ROUTE_IQ_ACTIVATION_EVIDENCE,
    evidence,
    "route_iq_revenue_activation_blocked"
  );
}

export function evaluateRouteIqLiveRevenueGate(evidence) {
  return evaluateGate(
    ROUTE_IQ_LIVE_REVENUE_EVIDENCE,
    evidence,
    "route_iq_revenue_live_billing_blocked"
  );
}

export function createRouteIqDraftOnlyIntake({
  intakeId,
  modelId,
  modelVersion,
  companyDisplayName
}) {
  assertId(intakeId, "intake.intakeId");
  assertId(modelId, "intake.modelId");
  assertVersion(modelVersion, "intake.modelVersion");
  assertSafeText(companyDisplayName, "intake.companyDisplayName", 120);
  return deepFreeze({
    intakeId,
    modelPin: `${modelId}@${modelVersion}`,
    companyDisplayName,
    lifecycleState: "DRAFT",
    productionCustomerCreated: false,
    workspaceProvisioned: false,
    invitationsSent: false,
    billingAttempted: false,
    activationAttempted: false
  });
}
