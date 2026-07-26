import {
  createRouteIqPaidCustomerConfigurationPreview,
  validateRouteIqPaidCustomerOnboardingConfiguration
} from "../../administration/contracts/route-iq-paid-customer-onboarding-v1.mjs";
import {
  ROUTE_IQ_PAID_CUSTOMER_OPERATIONS
} from "../../security/route-iq-paid-customer-isolation-v1.mjs";
import {
  ROUTE_IQ_CUSTOMER_PWA_PATH,
  ROUTE_IQ_CUSTOMER_PWA_TRAILING_SLASH_PATH,
  authorizeRouteIqCustomerPwaRequest
} from "./route-iq-august-1-customer-pwa-runtime.js";
import {
  authorizeRouteIqPaidCustomerInfrastructureOperation
} from "./route-iq-paid-customer-server-authority.js";

export const ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_PATH =
  "/api/dashboard/route-iq/internal/paid-customer-configuration-preview";
export const ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_CONTRACT_VERSION =
  "route-iq-paid-customer-dashboard-preview-v1";
export const ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_RUNTIME_VERSION =
  "route-iq-paid-customer-dashboard-preview-runtime-v1";
export const ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES = Object.freeze({
  requestInvalid: "route_iq_paid_customer_dashboard_preview_request_invalid",
  methodNotAllowed: "route_iq_paid_customer_dashboard_preview_method_not_allowed",
  unavailable: "route_iq_paid_customer_configuration_unavailable"
});

const STRICT_ID = /^[a-z][a-z0-9_]{2,127}$/u;
const CONFIGURATION_VERSION = /^v[1-9][0-9]*\.[0-9]+\.[0-9]+$/u;
const SAFE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json; charset=utf-8",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff"
});
const PREVIEW_LIFECYCLE_STATES = new Set([
  "VALIDATED",
  "PREVIEW_READY",
  "AWAITING_APPROVAL"
]);
const FORMAT_BY_AGGREGATION = Object.freeze({
  COUNT: "COUNT",
  RATE: "RATE",
  CURRENCY: "CURRENCY",
  DURATION: "DURATION"
});

class RouteIqPaidCustomerDashboardPreviewError extends Error {
  constructor(code, status = 404) {
    super("Route IQ paid-customer configuration is unavailable.");
    this.name = "RouteIqPaidCustomerDashboardPreviewError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, status = 404) {
  throw new RouteIqPaidCustomerDashboardPreviewError(code, status);
}

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...SAFE_HEADERS,
      ...headers
    }
  });
}

function safeErrorResponse(error) {
  const safe = error instanceof RouteIqPaidCustomerDashboardPreviewError
    ? error
    : new RouteIqPaidCustomerDashboardPreviewError(
      ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.unavailable
    );
  return jsonResponse({
    ok: false,
    code: safe.code,
    message: "Route IQ paid-customer configuration is unavailable."
  }, safe.status);
}

function assertSafetyEnvironment(env) {
  const offSettings = [
    "ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION",
    "ROUTE_IQ_BUSINESS_AVAILABILITY_MODE",
    "ROUTE_IQ_PAID_CUSTOMER_ACTIVATION",
    "ROUTE_IQ_PAID_CUSTOMER_PROVIDER_REFRESH",
    "ROUTE_IQ_PAID_CUSTOMER_SCHEDULER",
    "ROUTE_IQ_RECOMMENDATION_INFLUENCE"
  ];
  if (offSettings.some(name => Object.hasOwn(env || {}, name) && env[name] !== "OFF")
    || (Object.hasOwn(env || {}, "ROUTE_IQ_ACTIVE_COHORTS")
      && String(env.ROUTE_IQ_ACTIVE_COHORTS) !== "0")) {
    fail(ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.unavailable, 503);
  }
}

function validateExactRequest(request) {
  let url;
  try {
    url = new URL(request.url);
  } catch {
    fail(ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.requestInvalid, 400);
  }
  if (url.pathname !== ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_PATH
    || url.search
    || url.hash
    || url.username
    || url.password
    || !["", "0"].includes(request.headers.get("content-length") || "")
    || !["", "identity"].includes((request.headers.get("content-encoding") || "").toLowerCase())) {
    fail(ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.requestInvalid, 400);
  }
  return url;
}

function serverObservedWorkspaceId(request, requestUrl) {
  const referrerValue = request.headers.get("referer");
  if (!referrerValue) return undefined;
  let referrer;
  try {
    referrer = new URL(referrerValue);
  } catch {
    fail(ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.unavailable);
  }
  if (referrer.origin !== requestUrl.origin
    || ![ROUTE_IQ_CUSTOMER_PWA_PATH, ROUTE_IQ_CUSTOMER_PWA_TRAILING_SLASH_PATH]
      .includes(referrer.pathname)) {
    fail(ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.unavailable);
  }
  const values = referrer.searchParams.getAll("workspaceId");
  if (values.length === 0) return undefined;
  if (values.length !== 1 || !STRICT_ID.test(values[0])) {
    fail(ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.unavailable);
  }
  return values[0];
}

async function defaultAuthorizePrincipal(request, env, requestUrl, workspaceId) {
  const authorizationUrl = new URL(request.url);
  if (workspaceId) authorizationUrl.searchParams.set("workspaceId", workspaceId);
  const authorizationRequest = new Request(authorizationUrl, {
    method: "GET",
    headers: request.headers
  });
  return authorizeRouteIqCustomerPwaRequest(authorizationRequest, env);
}

async function defaultResolveSelectedConfiguration() {
  return null;
}

function titleFromId(value) {
  if (!STRICT_ID.test(value || "")) {
    fail(ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.unavailable);
  }
  return value
    .split("_")
    .map(part => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function term(configuration, termId) {
  const matches = configuration.terminology.terms.filter(candidate => candidate.termId === termId);
  if (matches.length !== 1) {
    fail(ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.unavailable);
  }
  return matches[0];
}

function metricProjection(configuration) {
  return configuration.dashboard.metricIds.map(metricId => {
    const matches = configuration.terminology.metrics.filter(metric => metric.metricId === metricId);
    if (matches.length !== 1 || !FORMAT_BY_AGGREGATION[matches[0].aggregation]) {
      fail(ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.unavailable);
    }
    const displayTerm = term(configuration, matches[0].displayTermId);
    return {
      metricId,
      label: displayTerm.plural,
      singularLabel: displayTerm.singular,
      pluralLabel: displayTerm.plural,
      format: FORMAT_BY_AGGREGATION[matches[0].aggregation],
      historyLabelPolicy: "EVENT_SNAPSHOT_IMMUTABLE"
    };
  });
}

function configurationPreviewEnvelope(configuration, configurationVersion, {
  now,
  accessExpiresAt
}) {
  const generatedAt = now.getTime();
  const expiresAt = Math.min(
    generatedAt + 5 * 60 * 1000,
    Date.parse(accessExpiresAt) - 1_000
  );
  if (expiresAt <= generatedAt) {
    fail(ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.unavailable);
  }
  const representative = term(configuration, "representative");
  const manager = term(configuration, "manager");
  const opportunity = term(configuration, "business");
  const visit = term(configuration, "visit");
  const outcome = term(configuration, "outcome");
  const followUp = term(configuration, "follow_up");
  const metrics = metricProjection(configuration);
  const metricIds = new Set(metrics.map(metric => metric.metricId));
  if (configuration.sales.goals.some(goal => !metricIds.has(goal.metricId))) {
    fail(ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.unavailable);
  }

  return {
    contractVersion: ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_CONTRACT_VERSION,
    authorizationState: "server_verified",
    previewMode: "READ_ONLY",
    activationEffect: "NONE",
    workspaceId: configuration.company.workspaceId,
    companyId: configuration.company.companyId,
    configurationVersion,
    lifecycleState: configuration.lifecycle.state,
    generatedAt: new Date(generatedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    preview: {
      company: {
        displayName: configuration.company.displayName,
        industryLabel: titleFromId(configuration.operatingProfile.industryTemplateId),
        operatingModelLabel: titleFromId(configuration.operatingProfile.operatingModelId)
      },
      terminology: {
        representativeSingular: representative.singular,
        representativePlural: representative.plural,
        managerSingular: manager.singular,
        managerPlural: manager.plural,
        opportunitySingular: opportunity.singular,
        opportunityPlural: opportunity.plural,
        visitSingular: visit.singular,
        visitPlural: visit.plural,
        outcomeSingular: outcome.singular,
        outcomePlural: outcome.plural,
        followUpSingular: followUp.singular,
        followUpPlural: followUp.plural
      },
      metrics,
      goals: configuration.sales.goals.map(goal => ({
        goalId: goal.goalId,
        label: `${titleFromId(goal.metricId)} goal`,
        metricId: goal.metricId,
        targetDisplay: `${goal.target} per ${goal.period.toLowerCase()}`
      })),
      outcomes: configuration.sales.outcomes.map(item => ({
        outcomeId: item.outcomeId,
        label: item.displayLabel,
        classification: item.classification
      })),
      followUpStages: configuration.sales.followUpStages.map(stage => ({
        stageId: stage.stageId,
        label: stage.displayLabel,
        order: stage.sequence
      })),
      territories: [{
        territoryId: configuration.territory.territoryId,
        displayName: configuration.territory.displayLabel,
        timeZone: configuration.territory.timeZone,
        zipCodes: [...configuration.territory.authorizedZipCodes]
      }],
      targeting: {
        includedCategories: configuration.targeting.includedCategoryIds.map(titleFromId),
        excludedCategories: configuration.targeting.excludedCategoryIds.map(titleFromId),
        excludedBusinessCount: configuration.targeting.excludedBusinessIds.length,
        ruleSummary: "Only configured categories inside the authorized territory may be considered."
      },
      verification: {
        verifiedIdentityRequired: configuration.verification.verifiedIdentityRequired,
        physicalAddressRequired: configuration.verification.physicalAddressRequired,
        authorizedTerritoryRequired: configuration.verification.authorizedTerritoryRequired,
        businessCategoryRequired: configuration.verification.businessCategoryRequired,
        currentOperatingStatusRequired: configuration.verification.currentOperatingStatusRequired,
        operatingHoursRequired: configuration.verification.operatingHoursRequired,
        freshnessCeilingHours: configuration.verification.freshnessCeilingHours,
        providerFailureRule: "FAIL_CLOSED"
      }
    }
  };
}

function validateSelection(selection, authority) {
  if (!selection
    || Object.keys(selection).sort().join(",")
      !== "configuration,configurationVersion,selectionAuthority"
    || selection.selectionAuthority !== "prometheus_administration"
    || !CONFIGURATION_VERSION.test(selection.configurationVersion || "")) {
    fail(ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.unavailable);
  }
  let configuration;
  try {
    configuration = validateRouteIqPaidCustomerOnboardingConfiguration(selection.configuration);
    createRouteIqPaidCustomerConfigurationPreview(configuration);
  } catch {
    fail(ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.unavailable);
  }
  if (!PREVIEW_LIFECYCLE_STATES.has(configuration.lifecycle.state)
    || configuration.company.companyId !== authority.decision.companyId
    || configuration.company.workspaceId !== authority.decision.workspaceId
    || configuration.safety.customerActivation !== "OFF"
    || configuration.safety.activationAuthorizationRef !== null
    || configuration.safety.collection !== "OFF"
    || configuration.safety.activeCohorts !== 0
    || configuration.safety.recommendationInfluence !== "OFF"
    || configuration.safety.providerRefresh !== "OFF"
    || configuration.safety.scheduler !== "OFF") {
    fail(ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.unavailable);
  }
  return configuration;
}

export function isRouteIqPaidCustomerDashboardPreviewPath(pathname) {
  return pathname === ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_PATH;
}

export async function handleRouteIqPaidCustomerDashboardPreviewRequest(
  request,
  env = {},
  {
    authorizePrincipal = defaultAuthorizePrincipal,
    resolveSelectedConfiguration = defaultResolveSelectedConfiguration,
    now = new Date()
  } = {}
) {
  try {
    const requestUrl = validateExactRequest(request);
    if (request.method !== "GET") {
      return jsonResponse({
        ok: false,
        code: ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.methodNotAllowed,
        message: "Route IQ paid-customer configuration is unavailable."
      }, 405, { Allow: "GET" });
    }
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
      fail(ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.unavailable);
    }
    assertSafetyEnvironment(env);
    const observedWorkspaceId = serverObservedWorkspaceId(request, requestUrl);

    let authorization;
    let authority;
    try {
      authorization = await authorizePrincipal(
        request,
        env,
        requestUrl,
        observedWorkspaceId
      );
      if (observedWorkspaceId
        && authorization?.principal?.workspaceId !== observedWorkspaceId) {
        fail(ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.unavailable);
      }
      const companyId = authorization?.runtimeAuthorization?.zipCoverage?.companyId;
      authority = authorizeRouteIqPaidCustomerInfrastructureOperation({
        authorization,
        operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.configurationPreview,
        requestedScope: {
          companyId,
          workspaceId: authorization?.principal?.workspaceId
        },
        now
      });
    } catch {
      fail(ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.unavailable);
    }

    const selection = await resolveSelectedConfiguration({
      companyId: authority.decision.companyId,
      workspaceId: authority.decision.workspaceId,
      storageScope: authority.decision.storageScope
    });
    if (selection === null || selection === undefined) {
      fail(ROUTE_IQ_PAID_CUSTOMER_DASHBOARD_PREVIEW_FAILURES.unavailable);
    }
    const configuration = validateSelection(selection, authority);
    return jsonResponse(configurationPreviewEnvelope(
      configuration,
      selection.configurationVersion,
      {
        now,
        accessExpiresAt: authorization.accessExpiresAt
      }
    ));
  } catch (error) {
    return safeErrorResponse(error);
  }
}
