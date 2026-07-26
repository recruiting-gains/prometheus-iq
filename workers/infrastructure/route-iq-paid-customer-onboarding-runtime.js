import {
  applyRouteIqPaidCustomerProvisioningPlan,
  createRouteIqPaidCustomerConfigurationPreview,
  createRouteIqPaidCustomerProvisioningPlan,
  offboardRouteIqPaidCustomerConfiguration,
  suspendRouteIqPaidCustomerConfiguration,
  validateRouteIqPaidCustomerOnboardingConfiguration
} from "../../administration/contracts/route-iq-paid-customer-onboarding-v1.mjs";
import {
  routeIqVerifiedBusinessAuditVersion,
  routeIqVerifiedBusinessEligibilityPolicyVersion,
  routeIqVerifiedBusinessEvidenceVersion,
  routeIqVerifiedBusinessNormalizedVersion,
  routeIqVerifiedBusinessStorageVersion
} from "../../data/route-iq-paid-customer-v1/route-iq-verified-business-evidence.mjs";
import {
  ROUTE_IQ_PAID_CUSTOMER_OPERATIONS
} from "../../security/route-iq-paid-customer-isolation-v1.mjs";
import { AEGIS_API_HEADERS } from "./aegis-security-controls.js";
import {
  authorizeRouteIqCustomerPwaRequest
} from "./route-iq-august-1-customer-pwa-runtime.js";
import {
  authorizeRouteIqPaidCustomerInfrastructureOperation
} from "./route-iq-paid-customer-server-authority.js";

export const ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_RUNTIME_VERSION =
  "route-iq-paid-customer-onboarding-runtime-v1";
export const ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_ROOT =
  "/api/dashboard/route-iq/paid-customer-onboarding";
export const ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS = Object.freeze({
  preview: `${ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_ROOT}/preview`,
  provisioningPlan: `${ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_ROOT}/provisioning-plan`,
  suspensionPreview: `${ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_ROOT}/suspension-preview`,
  offboardingPreview: `${ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_ROOT}/offboarding-preview`
});
export const ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_MAX_BODY_BYTES = 512 * 1024;
export const ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES = Object.freeze({
  routeNotFound: "route_iq_paid_customer_onboarding_route_not_found",
  methodNotAllowed: "route_iq_paid_customer_onboarding_method_not_allowed",
  requestInvalid: "route_iq_paid_customer_onboarding_request_invalid",
  bodyTooLarge: "route_iq_paid_customer_onboarding_body_too_large",
  mediaTypeInvalid: "route_iq_paid_customer_onboarding_media_type_invalid",
  authenticationRequired: "route_iq_paid_customer_onboarding_authentication_required",
  roleDenied: "route_iq_paid_customer_onboarding_role_denied",
  scopeDenied: "route_iq_paid_customer_onboarding_scope_denied",
  resourceUnavailable: "route_iq_resource_unavailable",
  configurationInvalid: "route_iq_paid_customer_onboarding_configuration_invalid",
  runtimeUnavailable: "route_iq_paid_customer_onboarding_runtime_unavailable"
});

const STRICT_ID = /^[a-z][a-z0-9_]{2,127}$/u;
const REASON_CODE = /^[a-z][a-z0-9_]{2,127}$/u;
const SAFE_ERROR_MESSAGE = "Route IQ paid-customer onboarding is unavailable.";
const REQUIRED_QUERY_PARAMETER = "workspaceId";
const ALLOWED_PATHS = new Set(Object.values(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS));
const SAFETY = Object.freeze({
  customerActivation: "OFF",
  collection: "OFF",
  activeCohorts: 0,
  recommendationInfluence: "OFF",
  providerRefresh: "OFF",
  scheduler: "OFF",
  usersProvisioned: false,
  crmMutationPerformed: false,
  productionMutationPerformed: false
});
const OWNER_DEPENDENCIES = Object.freeze({
  validateConfiguration: validateRouteIqPaidCustomerOnboardingConfiguration,
  createPreview: createRouteIqPaidCustomerConfigurationPreview,
  createProvisioningPlan: createRouteIqPaidCustomerProvisioningPlan,
  applyProvisioningPlan: applyRouteIqPaidCustomerProvisioningPlan,
  suspendConfiguration: suspendRouteIqPaidCustomerConfiguration,
  offboardConfiguration: offboardRouteIqPaidCustomerConfiguration
});

export class RouteIqPaidCustomerOnboardingRuntimeError extends Error {
  constructor(code, status) {
    super(SAFE_ERROR_MESSAGE);
    this.name = "RouteIqPaidCustomerOnboardingRuntimeError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, status) {
  throw new RouteIqPaidCustomerOnboardingRuntimeError(code, status);
}

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  return actual.length === keys.length
    && actual.every((key, index) => key === keys[index]);
}

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...AEGIS_API_HEADERS,
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

function errorResponse(error) {
  const safe = error instanceof RouteIqPaidCustomerOnboardingRuntimeError
    ? error
    : new RouteIqPaidCustomerOnboardingRuntimeError(
      ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.runtimeUnavailable,
      503
    );
  return jsonResponse({
    ok: false,
    code: safe.code,
    message: SAFE_ERROR_MESSAGE
  }, safe.status);
}

function validateRequestUrl(request) {
  let url;
  try {
    url = new URL(request.url);
  } catch {
    fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.requestInvalid, 400);
  }
  if (!ALLOWED_PATHS.has(url.pathname)) {
    fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.routeNotFound, 404);
  }
  const keys = [...url.searchParams.keys()];
  const workspaceIds = url.searchParams.getAll(REQUIRED_QUERY_PARAMETER);
  if (keys.length !== 1
    || keys[0] !== REQUIRED_QUERY_PARAMETER
    || workspaceIds.length !== 1
    || !STRICT_ID.test(workspaceIds[0])) {
    fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.requestInvalid, 400);
  }
  return { url, requestedWorkspaceId: workspaceIds[0] };
}

async function readBoundedJson(request) {
  const contentType = (request.headers.get("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  const contentEncoding = (request.headers.get("content-encoding") || "identity")
    .trim()
    .toLowerCase();
  if (contentType !== "application/json" || contentEncoding !== "identity") {
    fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.mediaTypeInvalid, 415);
  }
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength)
    && declaredLength > ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_MAX_BODY_BYTES) {
    fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.bodyTooLarge, 413);
  }
  if (!request.body) {
    fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.requestInvalid, 400);
  }

  const reader = request.body.getReader();
  const chunks = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_MAX_BODY_BYTES) {
        await reader.cancel("Paid-customer onboarding request exceeded its bounded size.");
        fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.bodyTooLarge, 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (byteLength === 0) {
    fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.requestInvalid, 400);
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.requestInvalid, 400);
    }
    return value;
  } catch (error) {
    if (error instanceof RouteIqPaidCustomerOnboardingRuntimeError) throw error;
    fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.requestInvalid, 400);
  }
}

async function defaultAuthorizePrincipal(request, env) {
  try {
    return await authorizeRouteIqCustomerPwaRequest(request, env);
  } catch {
    fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.authenticationRequired, 401);
  }
}

function securityOperation(operation) {
  if (["CONFIGURATION_PREVIEW", "PROVISIONING_PLAN"].includes(operation)) {
    return ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.configurationPreview;
  }
  if (operation === "SUSPENSION_PREVIEW") {
    return ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.workspaceSuspend;
  }
  if (operation === "OFFBOARDING_PREVIEW") {
    return ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.workspaceOffboard;
  }
  fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.resourceUnavailable, 404);
}

function serverPrincipalFromAuthorization(authorization, requestedWorkspaceId, operation) {
  const companyId = authorization?.runtimeAuthorization?.zipCoverage?.companyId;
  const workspaceId = authorization?.principal?.workspaceId;
  if (workspaceId !== requestedWorkspaceId) {
    fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.resourceUnavailable, 404);
  }
  try {
    return authorizeRouteIqPaidCustomerInfrastructureOperation({
      authorization,
      operation: securityOperation(operation),
      requestedScope: { companyId, workspaceId }
    }).principal;
  } catch {
    fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.resourceUnavailable, 404);
  }
}

function assertConfigurationScope(configuration, principal) {
  const companyId = configuration?.company?.companyId;
  const workspaceId = configuration?.company?.workspaceId;
  if (!STRICT_ID.test(companyId || "") || !STRICT_ID.test(workspaceId || "")) {
    fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.configurationInvalid, 422);
  }
  if (companyId !== principal.companyId || workspaceId !== principal.workspaceId) {
    fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.resourceUnavailable, 404);
  }
}

function assertSafetyEnvironment(env) {
  const exactOffWhenPresent = [
    "ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION",
    "ROUTE_IQ_BUSINESS_AVAILABILITY_MODE",
    "ROUTE_IQ_PAID_CUSTOMER_ACTIVATION",
    "ROUTE_IQ_PAID_CUSTOMER_PROVIDER_REFRESH",
    "ROUTE_IQ_PAID_CUSTOMER_SCHEDULER",
    "ROUTE_IQ_RECOMMENDATION_INFLUENCE"
  ];
  if (exactOffWhenPresent.some(name => (
    Object.hasOwn(env || {}, name) && env[name] !== "OFF"
  ))) {
    fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.runtimeUnavailable, 503);
  }
  if (Object.hasOwn(env || {}, "ROUTE_IQ_ACTIVE_COHORTS")
    && String(env.ROUTE_IQ_ACTIVE_COHORTS) !== "0") {
    fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.runtimeUnavailable, 503);
  }
}

function verifiedBusinessHandoff(configuration) {
  return deepFreeze({
    contractVersion: "route-iq-paid-customer-verified-business-handoff-v1",
    ownerSubsystem: "Prometheus Infrastructure",
    receivingSubsystem: "Prometheus Data",
    evidenceContractVersion: routeIqVerifiedBusinessEvidenceVersion,
    normalizedEvidenceVersion: routeIqVerifiedBusinessNormalizedVersion,
    eligibilityPolicyVersion: routeIqVerifiedBusinessEligibilityPolicyVersion,
    storageRecordVersion: routeIqVerifiedBusinessStorageVersion,
    auditRecordVersion: routeIqVerifiedBusinessAuditVersion,
    scope: {
      companyId: configuration.company.companyId,
      workspaceId: configuration.company.workspaceId,
      immutable: true
    },
    territory: {
      territoryId: configuration.territory.territoryId,
      authorizedZipCodes: [...configuration.territory.authorizedZipCodes]
    },
    customerRules: {
      includedCategoryIds: [...configuration.targeting.includedCategoryIds],
      excludedCategoryIds: [...configuration.targeting.excludedCategoryIds],
      excludedBusinessIds: [...configuration.targeting.excludedBusinessIds]
    },
    freshnessCeilingHours: configuration.verification.freshnessCeilingHours,
    evidenceQualityRequired: configuration.verification.evidenceQualityRequired,
    admissionState: "FAIL_CLOSED_PENDING_DATA_AND_INTELLIGENCE_VALIDATION",
    businessActivationPerformed: false,
    providerRefresh: "OFF",
    scheduler: "OFF",
    productionMutationPerformed: false
  });
}

function auditProjection(eventType, principal, configurationIdentity) {
  return deepFreeze({
    eventType,
    companyId: principal.companyId,
    workspaceId: principal.workspaceId,
    configurationIdentity,
    actorAuthority: principal.authority,
    actorRole: principal.role,
    auditPersistenceRequiredBeforeMutation: true,
    auditPersistencePerformed: false
  });
}

function provisioningResult(configuration, dependencies) {
  const plan = dependencies.createProvisioningPlan(configuration);
  const once = dependencies.applyProvisioningPlan(plan);
  const twice = dependencies.applyProvisioningPlan(plan, once);
  if (JSON.stringify(once) !== JSON.stringify(twice)) {
    fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.runtimeUnavailable, 503);
  }
  const receipt = twice.receipts?.[plan.idempotencyKey];
  if (!receipt
    || receipt.companyId !== plan.companyId
    || receipt.workspaceId !== plan.workspaceId
    || receipt.activationPerformed !== false) {
    fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.runtimeUnavailable, 503);
  }
  return deepFreeze({
    plan,
    receipt: {
      receiptVersion: "route-iq-paid-customer-provisioning-preview-receipt-v1",
      idempotencyKey: plan.idempotencyKey,
      companyId: receipt.companyId,
      workspaceId: receipt.workspaceId,
      configurationIdentity: receipt.configurationIdentity,
      configurationFingerprint: receipt.configurationFingerprint,
      resourceCount: receipt.resourceCount,
      activationPerformed: false,
      persistencePerformed: false
    }
  });
}

function projectedLifecycleResult(result) {
  const configuration = result.configuration;
  return deepFreeze({
    configurationIdentity:
      `${configuration.configurationId}@${configuration.configurationRevision}`,
    companyId: configuration.company.companyId,
    workspaceId: configuration.company.workspaceId,
    lifecycleState: configuration.lifecycle.state,
    lifecycleRevision: configuration.lifecycle.revision,
    customerActivation: configuration.safety.customerActivation,
    auditEvent: clone(result.auditEvent),
    persistencePerformed: false
  });
}

function operationForPath(pathname) {
  if (pathname === ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.preview) {
    return "CONFIGURATION_PREVIEW";
  }
  if (pathname === ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.provisioningPlan) {
    return "PROVISIONING_PLAN";
  }
  if (pathname === ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.suspensionPreview) {
    return "SUSPENSION_PREVIEW";
  }
  if (pathname === ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_PATHS.offboardingPreview) {
    return "OFFBOARDING_PREVIEW";
  }
  fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.routeNotFound, 404);
}

function executeOperation({ pathname, body, dependencies }) {
  const operation = operationForPath(pathname);
  if (operation === "CONFIGURATION_PREVIEW") {
    if (!exactKeys(body, ["configuration"])) {
      fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.requestInvalid, 400);
    }
    const configuration = dependencies.validateConfiguration(body.configuration);
    return { operation, configuration, result: dependencies.createPreview(configuration) };
  }
  if (operation === "PROVISIONING_PLAN") {
    if (!exactKeys(body, ["configuration"])) {
      fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.requestInvalid, 400);
    }
    const configuration = dependencies.validateConfiguration(body.configuration);
    return { operation, configuration, result: provisioningResult(configuration, dependencies) };
  }
  if (!exactKeys(body, ["configuration", "reasonCode", "transitionedAt"])
    || !REASON_CODE.test(body.reasonCode || "")) {
    fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.requestInvalid, 400);
  }
  const configuration = dependencies.validateConfiguration(body.configuration);
  if (operation === "SUSPENSION_PREVIEW") {
    return {
      operation,
      configuration,
      result: projectedLifecycleResult(dependencies.suspendConfiguration(configuration, {
        transitionedAt: body.transitionedAt,
        reasonCode: body.reasonCode
      }))
    };
  }
  return {
    operation,
    configuration,
    result: projectedLifecycleResult(dependencies.offboardConfiguration(configuration, {
      transitionedAt: body.transitionedAt,
      reasonCode: body.reasonCode
    }))
  };
}

function mapOwnerFailure(error) {
  if (error instanceof RouteIqPaidCustomerOnboardingRuntimeError) return error;
  return new RouteIqPaidCustomerOnboardingRuntimeError(
    ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.configurationInvalid,
    422
  );
}

export function isRouteIqPaidCustomerOnboardingPath(pathname) {
  return ALLOWED_PATHS.has(pathname);
}

export async function handleRouteIqPaidCustomerOnboardingRequest(
  request,
  env = {},
  {
    authorizePrincipal = defaultAuthorizePrincipal,
    dependencies = OWNER_DEPENDENCIES
  } = {}
) {
  try {
    const { url, requestedWorkspaceId } = validateRequestUrl(request);
    if (request.method !== "POST") {
      return jsonResponse({
        ok: false,
        code: ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.methodNotAllowed,
        message: SAFE_ERROR_MESSAGE
      }, 405, { Allow: "POST" });
    }
    assertSafetyEnvironment(env);
    const operation = operationForPath(url.pathname);

    let serverPrincipal;
    try {
      serverPrincipal = serverPrincipalFromAuthorization(
        await authorizePrincipal(request, env),
        requestedWorkspaceId,
        operation
      );
    } catch (error) {
      if (error instanceof RouteIqPaidCustomerOnboardingRuntimeError) throw error;
      fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.authenticationRequired, 401);
    }

    const body = await readBoundedJson(request);
    assertConfigurationScope(body.configuration, serverPrincipal);

    let execution;
    try {
      execution = executeOperation({
        pathname: url.pathname,
        body,
        dependencies
      });
    } catch (error) {
      throw mapOwnerFailure(error);
    }
    if (execution.configuration.company.companyId !== serverPrincipal.companyId
      || execution.configuration.company.workspaceId !== serverPrincipal.workspaceId) {
      fail(ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_FAILURES.resourceUnavailable, 404);
    }
    const configurationIdentity =
      `${execution.configuration.configurationId}@${execution.configuration.configurationRevision}`;
    return jsonResponse({
      ok: true,
      contractVersion: ROUTE_IQ_PAID_CUSTOMER_ONBOARDING_RUNTIME_VERSION,
      operation: execution.operation,
      scope: {
        companyId: serverPrincipal.companyId,
        workspaceId: serverPrincipal.workspaceId
      },
      result: execution.result,
      verifiedBusinessHandoff: verifiedBusinessHandoff(execution.configuration),
      audit: auditProjection(
        `${execution.operation}_GENERATED`,
        serverPrincipal,
        configurationIdentity
      ),
      safety: SAFETY
    });
  } catch (error) {
    return errorResponse(error);
  }
}
