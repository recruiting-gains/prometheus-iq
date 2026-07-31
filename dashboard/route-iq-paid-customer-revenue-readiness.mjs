export const routeIqPaidCustomerRevenueReadinessVersion =
  "route-iq-paid-customer-revenue-readiness-v1";

const safeTextPattern = /^[^\u0000-\u001F\u007F<>{}`$\\]{1,160}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const commercialStates = new Set([
  "LEAD",
  "QUALIFIED_PROSPECT",
  "COMMERCIAL_REVIEW",
  "PROPOSAL_PREPARED",
  "AGREEMENT_PENDING",
  "AGREEMENT_ACCEPTED",
  "ORDER_FORM_PENDING",
  "ORDER_FORM_ACCEPTED",
  "DRAFT_CUSTOMER_INTAKE_AUTHORIZED",
  "DRAFT_CUSTOMER_CREATED",
  "ONBOARDING_IN_PROGRESS",
  "ONBOARDING_VALIDATED",
  "LEGAL_FORMATION_BLOCKED",
  "BANKING_BLOCKED",
  "STRIPE_VERIFICATION_BLOCKED",
  "BILLING_APPROVAL_PENDING",
  "ACTIVATION_APPROVAL_PENDING",
  "READY_FOR_FIRST_PILOT_AUTHORIZATION",
  "ACTIVE",
  "SUSPENDED",
  "CANCELLED",
  "ARCHIVED"
]);
const onboardingStates = new Set([
  "NOT_STARTED",
  "DRAFT",
  "VALIDATION_FAILED",
  "VALIDATED",
  "READY_FOR_ACTIVATION",
  "ACTIVE",
  "SUSPENDED",
  "OFFBOARDED"
]);
const billingModes = new Set(["TEST", "LIVE"]);
const billingStates = new Set([
  "NOT_CONFIGURED",
  "PREREQUISITES_INCOMPLETE",
  "TEST_READY",
  "TEST_VERIFIED",
  "LIVE_APPROVAL_PENDING",
  "LIVE_ENABLED",
  "SUSPENDED"
]);
const activationStates = new Set(["BLOCKED", "APPROVAL_PENDING", "ACTIVE", "SUSPENDED"]);
const agreementStates = new Set(["NOT_STARTED", "DRAFT", "PENDING", "ACCEPTED", "BLOCKED"]);
const paymentStates = new Set(["INACTIVE", "TEST_ONLY", "PENDING", "CURRENT", "FAILED", "SUSPENDED"]);
const cancellationStates = new Set(["NOT_REQUESTED", "REQUESTED", "SCHEDULED", "COMPLETE"]);
const supportStates = new Set(["NOT_CONFIGURED", "DRAFT", "READY", "ACTIVE", "SUSPENDED"]);
const responsibleActors = new Set([
  "FOUNDER",
  "CUSTOMER_OWNER",
  "LEGAL_REVIEW",
  "BILLING_OPERATIONS",
  "CUSTOMER_SUCCESS",
  "PROMETHEUS_AI_OVERWATCH"
]);
const severityOrder = Object.freeze({ BLOCKING: 0, REQUIRED: 1, INFORMATIONAL: 2 });

export class RouteIqRevenueReadinessError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RouteIqRevenueReadinessError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new RouteIqRevenueReadinessError(code, message);
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function safeText(value, scope, maximum = 160) {
  if (typeof value !== "string"
    || value !== value.trim()
    || value.length > maximum
    || !safeTextPattern.test(value)) {
    fail("route_iq_revenue_readiness_text_invalid", `${scope} is not safe display text.`);
  }
  return value;
}

function safeOptionalText(value, scope, maximum = 160) {
  return value === null ? null : safeText(value, scope, maximum);
}

function validTimestamp(value) {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function enumValue(value, allowed, scope) {
  if (!allowed.has(value)) {
    fail("route_iq_revenue_readiness_state_invalid", `${scope} is not governed.`);
  }
  return value;
}

function nonnegativeInteger(value, scope, maximum = 100000) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    fail("route_iq_revenue_readiness_count_invalid", `${scope} is invalid.`);
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function assertFounderSession(session, now) {
  const instant = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(instant.getTime())
    || !exactKeys(session, [
      "authenticationAuthority",
      "authorizationState",
      "callerSupplied",
      "expiresAt",
      "founderMappingState",
      "role",
      "safety"
    ])
    || session.authorizationState !== "server_verified"
    || session.authenticationAuthority !== "cloudflare_access"
    || session.founderMappingState !== "IMMUTABLE_FOUNDER_MAPPING_VERIFIED"
    || session.role !== "FOUNDER"
    || session.callerSupplied !== false
    || !validTimestamp(session.expiresAt)
    || Date.parse(session.expiresAt) <= instant.getTime()
    || !exactKeys(session.safety, [
      "activeCohorts",
      "billingActivation",
      "customerActivation",
      "prospectiveCollection",
      "providerRefresh",
      "recommendationInfluence",
      "scheduler"
    ])
    || session.safety.prospectiveCollection !== "OFF"
    || session.safety.activeCohorts !== 0
    || session.safety.recommendationInfluence !== "OFF"
    || session.safety.providerRefresh !== "OFF"
    || session.safety.scheduler !== "OFF"
    || session.safety.billingActivation !== "OFF"
    || session.safety.customerActivation !== "OFF") {
    fail("route_iq_revenue_readiness_founder_session_invalid", "Founder revenue readiness is unavailable.");
  }
}

function projectBlockers(blockers) {
  if (!Array.isArray(blockers) || blockers.length > 30) {
    fail("route_iq_revenue_readiness_blockers_invalid", "Revenue blockers are invalid.");
  }
  const projected = blockers.map((blocker, index) => {
    if (!exactKeys(blocker, ["code", "message", "owner", "severity"])
      || !/^[A-Z][A-Z0-9_]{2,63}$/u.test(blocker.code || "")) {
      fail("route_iq_revenue_readiness_blocker_invalid", `Blocker ${index} is invalid.`);
    }
    return {
      code: blocker.code,
      severity: enumValue(blocker.severity, new Set(["BLOCKING", "REQUIRED", "INFORMATIONAL"]), `Blocker ${index} severity`),
      message: safeText(blocker.message, `Blocker ${index} message`),
      responsibleActor: enumValue(blocker.owner, responsibleActors, `Blocker ${index} owner`)
    };
  });
  if (new Set(projected.map(blocker => blocker.code)).size !== projected.length) {
    fail("route_iq_revenue_readiness_blockers_duplicate", "Revenue blockers contain duplicates.");
  }
  return projected.sort((left, right) =>
    severityOrder[left.severity] - severityOrder[right.severity]
      || left.code.localeCompare(right.code)
  );
}

function projectAuditHistory(history) {
  if (!Array.isArray(history) || history.length < 1 || history.length > 100) {
    fail("route_iq_revenue_readiness_audit_invalid", "Revenue audit history is incomplete.");
  }
  let previous = -Infinity;
  return history.map((event, index) => {
    if (!exactKeys(event, ["actorRole", "at", "evidenceDigest", "fromState", "summary", "toState"])
      || !validTimestamp(event.at)
      || Date.parse(event.at) < previous
      || !sha256Pattern.test(event.evidenceDigest || "")) {
      fail("route_iq_revenue_readiness_audit_invalid", `Audit event ${index} is invalid.`);
    }
    previous = Date.parse(event.at);
    return {
      at: event.at,
      actor: enumValue(event.actorRole, responsibleActors, `Audit event ${index} actor`),
      transition: `${enumValue(event.fromState, commercialStates, `Audit event ${index} prior state`)} → ${enumValue(event.toState, commercialStates, `Audit event ${index} resulting state`)}`,
      summary: safeText(event.summary, `Audit event ${index} summary`)
    };
  }).reverse();
}

function statusLabel(value) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^\w/u, letter => letter.toUpperCase());
}

export function createPaidCustomerRevenueReadinessViewModel(snapshot, {
  session,
  now = new Date()
} = {}) {
  assertFounderSession(session, now);
  const expectedKeys = [
    "activation",
    "agreement",
    "auditHistory",
    "billing",
    "blockers",
    "cancellation",
    "commercialState",
    "companyDisplayName",
    "contractVersion",
    "counts",
    "generatedAt",
    "nextAction",
    "onboardingState",
    "orderForm",
    "payment",
    "pricing",
    "responsibleActor",
    "support"
  ];
  if (!exactKeys(snapshot, expectedKeys)
    || snapshot.contractVersion !== routeIqPaidCustomerRevenueReadinessVersion
    || !validTimestamp(snapshot.generatedAt)
    || Date.parse(snapshot.generatedAt) > (now instanceof Date ? now.getTime() : Date.parse(now))) {
    fail("route_iq_revenue_readiness_snapshot_invalid", "Revenue readiness evidence is invalid.");
  }

  const commercialState = enumValue(snapshot.commercialState, commercialStates, "Commercial state");
  const onboardingState = enumValue(snapshot.onboardingState, onboardingStates, "Onboarding state");
  const billingMode = enumValue(snapshot.billing?.mode, billingModes, "Billing mode");
  const billingState = enumValue(snapshot.billing?.state, billingStates, "Billing state");
  const activationState = enumValue(snapshot.activation?.state, activationStates, "Activation state");
  const blockers = projectBlockers(snapshot.blockers);

  if (!exactKeys(snapshot.billing, ["mode", "state"])
    || !exactKeys(snapshot.activation, ["state"])
    || !exactKeys(snapshot.counts, ["locations", "managers", "representatives", "users"])
    || !exactKeys(snapshot.agreement, ["state", "version"])
    || !exactKeys(snapshot.orderForm, ["state", "version"])
    || !exactKeys(snapshot.pricing, ["state", "version"])
    || !exactKeys(snapshot.payment, ["state"])
    || !exactKeys(snapshot.cancellation, ["state"])
    || !exactKeys(snapshot.support, ["state"])) {
    fail("route_iq_revenue_readiness_contract_invalid", "Revenue readiness contract is incomplete.");
  }
  if (billingState === "LIVE_ENABLED"
    || activationState === "ACTIVE"
    || commercialState === "ACTIVE") {
    fail("route_iq_revenue_readiness_live_state_forbidden", "Live billing and customer activation remain unavailable.");
  }
  if (blockers.some(blocker => blocker.severity === "BLOCKING") === false) {
    fail("route_iq_revenue_readiness_blocking_evidence_required", "At least one active revenue blocker is required.");
  }

  const nextAction = safeText(snapshot.nextAction, "Required next action");
  const responsibleActor = enumValue(snapshot.responsibleActor, responsibleActors, "Responsible actor");
  const view = {
    contractVersion: routeIqPaidCustomerRevenueReadinessVersion,
    access: "FOUNDER_ONLY",
    authority: "SERVER_VERIFIED_READ_ONLY",
    advisoryOnly: true,
    mutationEffects: "NONE",
    title: "Paid-customer revenue readiness",
    company: safeText(snapshot.companyDisplayName, "Company display name"),
    generatedAt: snapshot.generatedAt,
    summary: {
      commercialState: statusLabel(commercialState),
      onboardingState: statusLabel(onboardingState),
      billing: `${billingMode === "TEST" ? "Test Mode" : "Live Mode"} · ${statusLabel(billingState)}`,
      activationState: statusLabel(activationState)
    },
    requiredNextStep: {
      action: nextAction,
      responsibleActor: statusLabel(responsibleActor)
    },
    counts: {
      users: nonnegativeInteger(snapshot.counts.users, "User count"),
      managers: nonnegativeInteger(snapshot.counts.managers, "Manager count"),
      representatives: nonnegativeInteger(snapshot.counts.representatives, "Representative count"),
      locations: nonnegativeInteger(snapshot.counts.locations, "Location count")
    },
    commercialTerms: {
      agreement: {
        state: statusLabel(enumValue(snapshot.agreement.state, agreementStates, "Agreement state")),
        version: safeOptionalText(snapshot.agreement.version, "Agreement version", 80)
      },
      orderForm: {
        state: statusLabel(enumValue(snapshot.orderForm.state, agreementStates, "Order form state")),
        version: safeOptionalText(snapshot.orderForm.version, "Order form version", 80)
      },
      pricing: {
        state: statusLabel(enumValue(snapshot.pricing.state, agreementStates, "Pricing state")),
        version: safeOptionalText(snapshot.pricing.version, "Pricing version", 80)
      }
    },
    operations: {
      payment: statusLabel(enumValue(snapshot.payment.state, paymentStates, "Payment state")),
      cancellation: statusLabel(enumValue(snapshot.cancellation.state, cancellationStates, "Cancellation state")),
      support: statusLabel(enumValue(snapshot.support.state, supportStates, "Support state"))
    },
    blockers,
    auditHistory: projectAuditHistory(snapshot.auditHistory),
    layout: {
      desktop: {
        viewport: "min-width: 768px",
        columns: 2,
        readingOrder: ["status", "next_action", "counts", "terms", "operations", "blockers", "audit"]
      },
      mobile: {
        viewport: "390x844",
        columns: 1,
        minimumInlineSize: 0,
        overflowWrap: "anywhere",
        readingOrder: ["status", "next_action", "counts", "terms", "operations", "blockers", "audit"]
      }
    }
  };
  return deepFreeze(view);
}

export function paidCustomerRevenueReadinessState(kind) {
  const states = {
    LOADING: {
      status: "LOADING",
      title: "Loading revenue readiness",
      message: "Checking governed commercial evidence.",
      retryAllowed: false
    },
    EMPTY: {
      status: "EMPTY",
      title: "No revenue-readiness record",
      message: "No paid-customer commercial record is selected.",
      retryAllowed: false
    },
    ERROR: {
      status: "ERROR",
      title: "Revenue readiness unavailable",
      message: "Governed commercial evidence could not be verified.",
      retryAllowed: false
    }
  };
  if (!Object.hasOwn(states, kind)) {
    fail("route_iq_revenue_readiness_view_state_invalid", "Revenue readiness view state is invalid.");
  }
  return deepFreeze({ ...states[kind], access: "FOUNDER_ONLY", mutationEffects: "NONE" });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function definitionList(values) {
  return Object.entries(values)
    .map(([label, value]) => `<div><dt>${escapeHtml(statusLabel(label))}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("");
}

export function renderPaidCustomerRevenueReadiness(view) {
  if (!view
    || view.contractVersion !== routeIqPaidCustomerRevenueReadinessVersion
    || view.access !== "FOUNDER_ONLY"
    || view.authority !== "SERVER_VERIFIED_READ_ONLY"
    || view.advisoryOnly !== true
    || view.mutationEffects !== "NONE") {
    fail("route_iq_revenue_readiness_view_invalid", "Revenue readiness view is invalid.");
  }
  const blockers = view.blockers.length
    ? view.blockers.map(blocker =>
        `<li data-severity="${escapeHtml(blocker.severity)}"><b>${escapeHtml(blocker.message)}</b><span>${escapeHtml(blocker.responsibleActor)}</span></li>`
      ).join("")
    : "<li>No active blockers.</li>";
  const audit = view.auditHistory.map(event =>
    `<li><time datetime="${escapeHtml(event.at)}">${escapeHtml(event.at)}</time><b>${escapeHtml(event.transition)}</b><span>${escapeHtml(event.summary)} · ${escapeHtml(event.actor)}</span></li>`
  ).join("");

  return `<section class="route-iq-revenue-readiness" aria-labelledby="routeIqRevenueReadinessTitle" data-access="founder-only" data-mode="read-only">
  <style>
    .route-iq-revenue-readiness{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;max-width:1120px}
    .route-iq-revenue-readiness>*{min-width:0}
    .route-iq-revenue-readiness header,.route-iq-revenue-readiness .wide{grid-column:1/-1}
    .route-iq-revenue-readiness dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .route-iq-revenue-readiness dd,.route-iq-revenue-readiness li{overflow-wrap:anywhere}
    @media (max-width:767px){.route-iq-revenue-readiness{grid-template-columns:1fr}.route-iq-revenue-readiness dl{grid-template-columns:1fr}}
  </style>
  <header><p>Founder only · Read-only advisory</p><h2 id="routeIqRevenueReadinessTitle">${escapeHtml(view.title)}</h2><p>${escapeHtml(view.company)}</p></header>
  <article aria-labelledby="revenueStatusTitle"><h3 id="revenueStatusTitle">Current status</h3><dl>${definitionList(view.summary)}</dl></article>
  <article aria-labelledby="revenueNextTitle"><h3 id="revenueNextTitle">Required next action</h3><p>${escapeHtml(view.requiredNextStep.action)}</p><p>Responsible: ${escapeHtml(view.requiredNextStep.responsibleActor)}</p></article>
  <article aria-labelledby="revenueCountsTitle"><h3 id="revenueCountsTitle">Account scope</h3><dl>${definitionList(view.counts)}</dl></article>
  <article aria-labelledby="revenueTermsTitle"><h3 id="revenueTermsTitle">Commercial terms</h3><dl>${definitionList({
    agreement: `${view.commercialTerms.agreement.state} · ${view.commercialTerms.agreement.version ?? "No version"}`,
    order_form: `${view.commercialTerms.orderForm.state} · ${view.commercialTerms.orderForm.version ?? "No version"}`,
    pricing: `${view.commercialTerms.pricing.state} · ${view.commercialTerms.pricing.version ?? "No version"}`
  })}</dl></article>
  <article aria-labelledby="revenueOperationsTitle"><h3 id="revenueOperationsTitle">Operations</h3><dl>${definitionList(view.operations)}</dl></article>
  <article aria-labelledby="revenueBlockersTitle"><h3 id="revenueBlockersTitle">Blockers</h3><ul>${blockers}</ul></article>
  <article class="wide" aria-labelledby="revenueAuditTitle"><h3 id="revenueAuditTitle">Audit history</h3><ol>${audit}</ol></article>
</section>`;
}
