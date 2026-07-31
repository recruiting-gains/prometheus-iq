const CONTRACT_VERSION = "route_iq_intelligence_paid_customer_revenue_readiness_v1";

const PROTECTED_SURFACES = Object.freeze([
  "recommendations",
  "activePool",
  "reservePool",
  "quarantinePool",
  "cohorts",
  "collection",
  "providerRefresh",
  "scheduling",
  "activeCustomerRouting"
]);

const COMMERCIAL_DOMAINS = Object.freeze([
  "commercial",
  "billing",
  "payment",
  "proposal",
  "agreement",
  "orderForm",
  "onboarding",
  "cancellation"
]);

const COMMERCIAL_STATES = Object.freeze([
  "DRAFT",
  "VALIDATION_FAILED",
  "VALIDATED",
  "SIMULATED_PAYMENT_SUCCEEDED",
  "SIMULATED_PAYMENT_FAILED",
  "PROPOSED",
  "AGREEMENT_DRAFTED",
  "ORDER_FORM_DRAFTED",
  "CANCELLATION_REQUESTED",
  "CANCELLED",
  "BILLING_EVENT_REPLAYED",
  "ACTIVE"
]);

const SAFE_IDENTIFIER = /^[a-z][a-z0-9_]{2,95}$/;

function fail(message, code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function requireExactKeys(value, expected, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("Revenue provenance must be an object.", code);
  }
  const actual = Object.keys(value).sort();
  const exact = [...expected].sort();
  if (actual.length !== exact.length || actual.some((key, index) => key !== exact[index])) {
    fail("Revenue provenance has an invalid shape.", code);
  }
}

function requireSafeIdentifier(value, code) {
  if (typeof value !== "string" || !SAFE_IDENTIFIER.test(value)) {
    fail("Revenue provenance contains an invalid identifier.", code);
  }
}

function zeroMutationLedger() {
  return Object.freeze(Object.fromEntries(PROTECTED_SURFACES.map(surface => [surface, 0])));
}

export const routeIqIntelligencePaidCustomerRevenueReadinessContract =
  Object.freeze({
    version: CONTRACT_VERSION,
    owner: "Prometheus Intelligence Engine",
    mode: "VERIFICATION_ONLY",
    commercialDomains: COMMERCIAL_DOMAINS,
    acceptedStates: COMMERCIAL_STATES,
    recommendationInfluence: "OFF",
    protectedSurfaces: PROTECTED_SURFACES,
    customerActivationAuthorized: false,
    representativeRoutingAuthorized: false,
    mutationAuthorized: false
  });

export function verifyPaidCustomerRevenueIntelligenceIsolation(provenance) {
  requireExactKeys(
    provenance,
    [
      "schemaVersion",
      "fictional",
      "companyId",
      "workspaceId",
      "domain",
      "state",
      "eventId",
      "sequence",
      "simulated",
      "activationAuthorized"
    ],
    "REVENUE_PROVENANCE_INVALID"
  );

  if (provenance.schemaVersion !== CONTRACT_VERSION) {
    fail("Revenue provenance version is not accepted.", "REVENUE_PROVENANCE_VERSION_REJECTED");
  }
  if (provenance.fictional !== true || provenance.simulated !== true) {
    fail("Only fictional simulated revenue provenance is accepted.", "LIVE_REVENUE_PROVENANCE_REJECTED");
  }
  requireSafeIdentifier(provenance.companyId, "REVENUE_COMPANY_SCOPE_REJECTED");
  requireSafeIdentifier(provenance.workspaceId, "REVENUE_WORKSPACE_SCOPE_REJECTED");
  requireSafeIdentifier(provenance.eventId, "REVENUE_EVENT_ID_REJECTED");
  if (!COMMERCIAL_DOMAINS.includes(provenance.domain)) {
    fail("Revenue provenance domain is not accepted.", "REVENUE_DOMAIN_REJECTED");
  }
  if (!COMMERCIAL_STATES.includes(provenance.state)) {
    fail("Revenue provenance state is not accepted.", "REVENUE_STATE_REJECTED");
  }
  if (!Number.isSafeInteger(provenance.sequence) || provenance.sequence < 0) {
    fail("Revenue provenance sequence is invalid.", "REVENUE_SEQUENCE_REJECTED");
  }

  const forgedActivation =
    provenance.activationAuthorized !== false || provenance.state === "ACTIVE";

  return Object.freeze({
    version: CONTRACT_VERSION,
    status: forgedActivation
      ? "FORGED_ACTIVATION_REJECTED"
      : "COMMERCIAL_EVENT_ISOLATED",
    reasonCode: forgedActivation
      ? "COMMERCIAL_STATE_CANNOT_AUTHORIZE_ACTIVATION"
      : "COMMERCIAL_STATE_HAS_ZERO_INTELLIGENCE_INFLUENCE",
    companyId: provenance.companyId,
    workspaceId: provenance.workspaceId,
    eventId: provenance.eventId,
    sequence: provenance.sequence,
    domain: provenance.domain,
    state: provenance.state,
    recommendationInfluence: "OFF",
    representativeRoutingEligible: false,
    customerActivationAuthorized: false,
    intelligenceMutationCount: 0,
    mutations: zeroMutationLedger()
  });
}

export function verifyPaidCustomerRevenueEventSeries(events) {
  if (!Array.isArray(events) || events.length === 0 || events.length > 64) {
    fail("Revenue event series is invalid.", "REVENUE_EVENT_SERIES_REJECTED");
  }

  const seen = new Set();
  let priorSequence = -1;
  const results = events.map(event => {
    const result = verifyPaidCustomerRevenueIntelligenceIsolation(event);
    const replayed = seen.has(result.eventId) || result.sequence <= priorSequence;
    seen.add(result.eventId);
    priorSequence = Math.max(priorSequence, result.sequence);
    return Object.freeze({
      ...result,
      status: replayed ? "REPLAYED_EVENT_ISOLATED" : result.status,
      reasonCode: replayed
        ? "REPLAY_CANNOT_CHANGE_INTELLIGENCE"
        : result.reasonCode
    });
  });

  return Object.freeze({
    version: CONTRACT_VERSION,
    status: "EVENT_SERIES_ISOLATED",
    recommendationInfluence: "OFF",
    intelligenceMutationCount: 0,
    events: Object.freeze(results)
  });
}
