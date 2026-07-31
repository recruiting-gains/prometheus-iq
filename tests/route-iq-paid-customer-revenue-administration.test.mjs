import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ROUTE_IQ_ACTIVATION_EVIDENCE,
  ROUTE_IQ_LIVE_REVENUE_EVIDENCE,
  ROUTE_IQ_PROPOSED_ENTITY,
  ROUTE_IQ_PRODUCT_NAME,
  RouteIqRevenueReadinessError,
  createRouteIqDraftOnlyIntake,
  evaluateRouteIqActivationGate,
  evaluateRouteIqLiveRevenueGate,
  transitionRouteIqRevenueLifecycle,
  validateRouteIqRevenueModel
} from "../administration/contracts/route-iq-paid-customer-revenue-readiness-v1.mjs";

const MODEL_PATH =
  "administration/contracts/route-iq-paid-customer-revenue-readiness-v1.json";
const modelSource = readFileSync(MODEL_PATH, "utf8");
const rawModel = JSON.parse(modelSource);
const pricingInventory = readFileSync(
  "administration/workflows/route-iq-paid-customer-pricing-source-inventory-v1.md",
  "utf8"
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectCode(code, action) {
  assert.throws(action, error => {
    assert.ok(error instanceof RouteIqRevenueReadinessError);
    assert.equal(error.code, code);
    return true;
  });
}

function verified(ids) {
  return Object.fromEntries(ids.map(id => [id, "VERIFIED"]));
}

const authorizationScope = Object.freeze({
  companyId: "synthetic_harbor_company",
  workspaceId: "synthetic_harbor_workspace",
  authorizedActorId: "authorized_founder_actor",
  configurationRevision: 7,
  modelPin: "route_iq_authoritative_commercial_model@1.0.0",
  evaluatedAt: "2026-07-31T18:00:00.000Z"
});

function forgedReceipt(receiptType = "CUSTOMER_ACTIVATION_AUTHORIZATION") {
  const activation = receiptType === "CUSTOMER_ACTIVATION_AUTHORIZATION";
  return {
    receiptType,
    receiptVersion: "1.0.0",
    authorityId: activation
      ? "project_external_customer_activation_authority"
      : "project_external_live_revenue_authority",
    authorizationId: activation
      ? "forged_customer_activation_authorization"
      : "forged_live_revenue_authorization",
    companyId: authorizationScope.companyId,
    workspaceId: authorizationScope.workspaceId,
    actorId: authorizationScope.authorizedActorId,
    actorRole: "FOUNDER",
    configurationRevision: authorizationScope.configurationRevision,
    modelPin: authorizationScope.modelPin,
    decision: "AUTHORIZED",
    issuedAt: "2026-07-31T17:00:00.000Z",
    expiresAt: "2026-07-31T19:00:00.000Z",
    signature: "a".repeat(43)
  };
}

test("authoritative commercial model is exact-version pinned and immutable", () => {
  const model = validateRouteIqRevenueModel(rawModel);
  assert.equal(model.provenance.versionPinned, `${model.modelId}@${model.modelVersion}`);
  assert.equal(model.company.proposedName, ROUTE_IQ_PROPOSED_ENTITY);
  assert.equal(model.product.name, ROUTE_IQ_PRODUCT_NAME);
  assert.ok(Object.isFrozen(model));
  assert.ok(Object.isFrozen(model.plans[0]));
});

test("unsupported schema, contract, and model versions fail closed", () => {
  for (const [field, value] of [
    ["schemaVersion", "route-iq-paid-customer-revenue-readiness-v2"],
    ["contractVersion", "2.0.0"],
    ["modelVersion", "draft"]
  ]) {
    const changed = clone(rawModel);
    changed[field] = value;
    expectCode(
      field === "schemaVersion"
        ? "route_iq_revenue_schema_version_unsupported"
        : field === "contractVersion"
          ? "route_iq_revenue_contract_version_unsupported"
          : "route_iq_revenue_version_invalid",
      () => validateRouteIqRevenueModel(changed)
    );
  }
});

test("pricing and binding commercial terms cannot be invented", () => {
  for (const [field, value] of [
    ["price", 99],
    ["currency", "USD"],
    ["billingCadence", "MONTHLY"],
    ["status", "APPROVED"]
  ]) {
    const changed = clone(rawModel);
    changed.plans[0][field] = value;
    expectCode("route_iq_revenue_price_invented", () =>
      validateRouteIqRevenueModel(changed)
    );
  }
});

test("pricing inventory recognizes exactly one authoritative commercial source", () => {
  const authoritativeRows = pricingInventory
    .split("\n")
    .filter(line => line.startsWith("| `") && line.includes("`AUTHORITATIVE`"));
  assert.deepEqual(authoritativeRows, [
    "| `administration/contracts/route-iq-paid-customer-revenue-readiness-v1.json` | Commercial model | `AUTHORITATIVE` | Sole authority; all binding values remain `FOUNDER DECISION REQUIRED`. |"
  ]);
  assert.match(pricingInventory, /Every binding value is `FOUNDER DECISION REQUIRED`/);
  assert.match(pricingInventory, /`LIVE_REVENUE_BLOCKED`/);
});

test("conflicting historical and proposed pricing paths are explicitly non-authoritative", () => {
  const expectedClassifications = new Map([
    ["docs/prometheus-pricing-strategy-playbook.md", "HISTORICAL"],
    ["docs/cloud-beta-cost-and-response-plan.md", "HYPOTHESIS"],
    ["docs/competitor-pricing-revenue.md", "HYPOTHESIS"],
    ["sales/enterprise-pilot-sales-package.md", "HYPOTHESIS"],
    ["docs/fitness-connection-pitch-plan.md", "HISTORICAL"],
    ["legal/build_prometheus_pilot_agreement.py", "HISTORICAL"],
    [
      "administration/workspace-configurations/route-iq-controlled-paid-customer-onboarding-rehearsal-v1.json",
      "TEST_ONLY"
    ],
    ["crm/paid-customer-revenue-readiness-v1.mjs", "TEST_ONLY"],
    [
      "docs/route-iq-business-availability-infrastructure-v1.md",
      "TECHNICAL_COST_ONLY"
    ]
  ]);
  for (const [path, classification] of expectedClassifications) {
    assert.match(
      pricingInventory,
      new RegExp(
        `\\| \\\`${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\\` .* \\\`${classification}\\\``
      )
    );
  }
  for (const amount of [
    "$49/user/month",
    "$2,500",
    "$39-$79/user/month",
    "$1,500-$5,000",
    "$250"
  ]) {
    assert.ok(pricingInventory.includes(amount), `missing conflicting amount ${amount}`);
  }
});

test("public website and generated deployment copy have no accidental pricing authority", () => {
  for (const path of [
    "public-site-static/index.html",
    "public-site-static/terms/index.html",
    "deploy/prometheusrouteiq-website/index.html",
    "deploy/prometheusrouteiq-website/terms/index.html"
  ]) {
    assert.match(
      pricingInventory,
      new RegExp(
        `\\| \\\`${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\\` .* \\\`NOT_COMMERCIAL_AUTHORITY\\\``
      )
    );
  }
  assert.doesNotMatch(
    pricingInventory,
    /\| `(?:public-site-static|deploy\/prometheusrouteiq-website)\/[^`]+` [^|]*\| `AUTHORITATIVE`/
  );
});

test("intake is Draft-only and causes zero production actions", () => {
  const intake = createRouteIqDraftOnlyIntake({
    intakeId: "synthetic_revenue_intake",
    modelId: rawModel.modelId,
    modelVersion: rawModel.modelVersion,
    companyDisplayName: "Synthetic Harbor Safety"
  });
  assert.equal(intake.lifecycleState, "DRAFT");
  for (const field of [
    "productionCustomerCreated",
    "workspaceProvisioned",
    "invitationsSent",
    "billingAttempted",
    "activationAttempted"
  ]) {
    assert.equal(intake[field], false);
  }
});

test("hostile intake labels and malformed identities fail closed", () => {
  expectCode("route_iq_revenue_text_unsafe", () =>
    createRouteIqDraftOnlyIntake({
      intakeId: "synthetic_revenue_intake",
      modelId: rawModel.modelId,
      modelVersion: rawModel.modelVersion,
      companyDisplayName: "<script>charge()</script>"
    })
  );
  expectCode("route_iq_revenue_identifier_invalid", () =>
    createRouteIqDraftOnlyIntake({
      intakeId: "REAL CUSTOMER #1",
      modelId: rawModel.modelId,
      modelVersion: rawModel.modelVersion,
      companyDisplayName: "Synthetic Harbor Safety"
    })
  );
});

test("revenue lifecycle permits only explicit transitions", () => {
  assert.equal(transitionRouteIqRevenueLifecycle("DRAFT", "VALIDATION_FAILED"), "VALIDATION_FAILED");
  assert.equal(transitionRouteIqRevenueLifecycle("VALIDATION_FAILED", "DRAFT"), "DRAFT");
  assert.equal(transitionRouteIqRevenueLifecycle("DRAFT", "VALIDATED"), "VALIDATED");
  assert.equal(
    transitionRouteIqRevenueLifecycle("VALIDATED", "AWAITING_COMMERCIAL_APPROVAL"),
    "AWAITING_COMMERCIAL_APPROVAL"
  );
  expectCode("route_iq_revenue_transition_forbidden", () =>
    transitionRouteIqRevenueLifecycle("DRAFT", "ACTIVE")
  );
  expectCode("route_iq_revenue_transition_forbidden", () =>
    transitionRouteIqRevenueLifecycle("CANCELLED", "ACTIVE")
  );
});

test("activation requires every role and approval evidence item", () => {
  const complete = verified(ROUTE_IQ_ACTIVATION_EVIDENCE);
  assert.equal(evaluateRouteIqActivationGate(complete).pass, true);
  delete complete.legal_review_approval;
  expectCode("route_iq_revenue_activation_blocked", () =>
    evaluateRouteIqActivationGate(complete)
  );
  expectCode("route_iq_revenue_authorization_receipt_missing", () =>
    transitionRouteIqRevenueLifecycle(
      "AWAITING_COMMERCIAL_APPROVAL",
      "READY_FOR_ACTIVATION",
      complete
    )
  );
});

test("live revenue remains blocked without every commercial prerequisite", () => {
  const activation = verified(ROUTE_IQ_ACTIVATION_EVIDENCE);
  const revenue = verified(ROUTE_IQ_LIVE_REVENUE_EVIDENCE);
  assert.equal(evaluateRouteIqLiveRevenueGate(revenue).pass, true);
  delete revenue.registered_legal_entity;
  expectCode("route_iq_revenue_live_billing_blocked", () =>
    evaluateRouteIqLiveRevenueGate(revenue)
  );
  expectCode("route_iq_revenue_authorization_receipt_missing", () =>
    transitionRouteIqRevenueLifecycle("READY_FOR_ACTIVATION", "ACTIVE", {
      ...activation,
      ...revenue
    })
  );
});

test("plain VERIFIED maps can describe evidence but can never authorize a transition", () => {
  const forgedEvidence = {
    ...verified(ROUTE_IQ_ACTIVATION_EVIDENCE),
    ...verified(ROUTE_IQ_LIVE_REVENUE_EVIDENCE)
  };
  expectCode("route_iq_revenue_authorization_receipt_missing", () =>
    transitionRouteIqRevenueLifecycle(
      "AWAITING_COMMERCIAL_APPROVAL",
      "READY_FOR_ACTIVATION",
      forgedEvidence
    )
  );
  expectCode("route_iq_revenue_authorization_receipt_missing", () =>
    transitionRouteIqRevenueLifecycle("READY_FOR_ACTIVATION", "ACTIVE", forgedEvidence)
  );
});

test("client state edits cannot manufacture a lifecycle transition", () => {
  expectCode("route_iq_revenue_state_invalid", () =>
    transitionRouteIqRevenueLifecycle(
      { state: "READY_FOR_ACTIVATION", editedByClient: true },
      "ACTIVE",
      {}
    )
  );
});

test("forged external receipts are rejected because trusted authorities are unavailable", () => {
  expectCode("route_iq_revenue_external_authority_unavailable", () =>
    transitionRouteIqRevenueLifecycle(
      "AWAITING_COMMERCIAL_APPROVAL",
      "READY_FOR_ACTIVATION",
      {
        scope: authorizationScope,
        customerActivationReceipt: forgedReceipt()
      }
    )
  );
});

test("receipt tenant workspace actor role and revision substitutions fail closed", () => {
  const cases = [
    ["companyId", "foreign_company", "route_iq_revenue_receipt_scope_mismatch"],
    ["workspaceId", "foreign_workspace", "route_iq_revenue_receipt_scope_mismatch"],
    ["actorId", "foreign_founder_actor", "route_iq_revenue_receipt_actor_invalid"],
    ["actorRole", "REPRESENTATIVE", "route_iq_revenue_receipt_actor_invalid"],
    ["configurationRevision", 6, "route_iq_revenue_receipt_revision_stale"]
  ];
  for (const [field, value, code] of cases) {
    const receipt = forgedReceipt();
    receipt[field] = value;
    expectCode(code, () =>
      transitionRouteIqRevenueLifecycle(
        "AWAITING_COMMERCIAL_APPROVAL",
        "READY_FOR_ACTIVATION",
        { scope: authorizationScope, customerActivationReceipt: receipt }
      )
    );
  }
});

test("ACTIVE remains unreachable even with complete evidence and two well-shaped forged receipts", () => {
  const authorization = {
    scope: authorizationScope,
    customerActivationReceipt: forgedReceipt(),
    liveRevenueReceipt: forgedReceipt("LIVE_REVENUE_AUTHORIZATION"),
    ...verified(ROUTE_IQ_ACTIVATION_EVIDENCE),
    ...verified(ROUTE_IQ_LIVE_REVENUE_EVIDENCE)
  };
  expectCode("route_iq_revenue_external_authority_unavailable", () =>
    transitionRouteIqRevenueLifecycle("READY_FOR_ACTIVATION", "ACTIVE", authorization)
  );
});

test("evidence requirements cannot be removed, optional, or pre-approved", () => {
  const missing = clone(rawModel);
  missing.liveRevenue.requiredEvidence.pop();
  expectCode("route_iq_revenue_evidence_set_invalid", () =>
    validateRouteIqRevenueModel(missing)
  );

  const optional = clone(rawModel);
  optional.activation.requiredEvidence[0].required = false;
  expectCode("route_iq_revenue_required_evidence_optional", () =>
    validateRouteIqRevenueModel(optional)
  );

  const premature = clone(rawModel);
  premature.liveRevenue.requiredEvidence[0].status = "VERIFIED";
  expectCode("route_iq_revenue_evidence_premature", () =>
    validateRouteIqRevenueModel(premature)
  );
});

test("Founder decision register contains no binding values", () => {
  const register = JSON.parse(readFileSync(
    "administration/registers/route-iq-paid-customer-revenue-founder-decisions-v1.json",
    "utf8"
  ));
  assert.equal(register.bindingDecisionsRecorded, false);
  assert.ok(register.decisions.length >= 10);
  for (const decision of register.decisions) {
    assert.equal(decision.status, "FOUNDER DECISION REQUIRED");
    assert.equal(decision.value, null);
  }
});

test("legal templates remain structured drafts and cannot be mistaken for approved terms", () => {
  const paths = [
    "route-iq-customer-agreement-draft-v1.md",
    "route-iq-order-form-draft-v1.md",
    "route-iq-pilot-form-draft-v1.md",
    "route-iq-data-handling-draft-v1.md",
    "route-iq-support-commitment-draft-v1.md",
    "route-iq-cancellation-plan-change-draft-v1.md"
  ];
  for (const name of paths) {
    const source = readFileSync(`administration/templates/${name}`, "utf8");
    assert.match(source, /DRAFT-LEGAL-REVIEW-REQUIRED/u);
    assert.match(source, /FOUNDER DECISION REQUIRED|LEGAL REVIEW REQUIRED/u);
    assert.doesNotMatch(source, /\$\s*[0-9]|(?:USD|dollars?)\s*[0-9]/iu);
  }
});

test("new revenue-readiness assets contain no real customer or personal identity", () => {
  const paths = [
    MODEL_PATH,
    "administration/registers/route-iq-paid-customer-revenue-founder-decisions-v1.json",
    "administration/workflows/route-iq-paid-customer-revenue-lifecycle-v1.md",
    "administration/workflows/route-iq-paid-customer-draft-intake-v1.md",
    "administration/workflows/route-iq-paid-customer-legal-review-gaps-v1.md",
    "administration/templates/route-iq-customer-communications-v1.md"
  ];
  const combined = paths.map(path => readFileSync(path, "utf8")).join("\n");
  assert.doesNotMatch(combined, /Fitness Connection|Anthony|Cruz Garza/iu);
  assert.match(
    pricingInventory,
    /\| `docs\/prometheus-pricing-strategy-playbook\.md` .* `HISTORICAL`/
  );
  assert.match(
    pricingInventory,
    /\| `docs\/fitness-connection-pitch-plan\.md` .* `HISTORICAL`/
  );
  assert.doesNotMatch(pricingInventory, /Anthony|Cruz Garza/iu);
});

test("Founder runbooks separate operations, support, failure, and data responsibility", () => {
  const runbooks = [
    "administration/workflows/route-iq-founder-revenue-operations-v1.md",
    "administration/workflows/route-iq-founder-customer-support-v1.md",
    "administration/workflows/route-iq-founder-revenue-failure-recovery-v1.md",
    "administration/workflows/route-iq-founder-cancellation-data-responsibility-v1.md"
  ].map(path => readFileSync(path, "utf8"));
  assert.match(runbooks[0], /commercial-model and decision-register versions/u);
  assert.match(runbooks[1], /customer report never authorizes production mutation/u);
  assert.match(runbooks[2], /Never automatically retry an ambiguous charge/u);
  assert.match(runbooks[3], /Require Data-owner execution/u);
});
