import {
  controlledPaidCustomerRehearsalDefinition,
  createControlledPaidCustomerRehearsalDraft,
  validateControlledPaidCustomerRehearsalDraft
} from "../../administration/contracts/route-iq-controlled-paid-customer-onboarding-rehearsal-v1.mjs";
import {
  transitionRouteIqPaidCustomerOnboarding
} from "../../administration/contracts/route-iq-paid-customer-onboarding-v1.mjs";
import {
  createPaidCustomerIntelligenceScope,
  evaluatePaidCustomerRecommendationAdmission,
  paidCustomerIntelligenceOperations
} from "../../intelligence/route-iq-paid-customer-intelligence.mjs";
import {
  ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS,
  ROUTE_IQ_PAID_CUSTOMER_OPERATIONS,
  assertRouteIqPaidCustomerStorageScope,
  authorizeRouteIqPaidCustomerOperation,
  bindRouteIqPaidCustomerPrincipal,
  classifyRouteIqPaidCustomerSecurityFailure,
  projectRouteIqPaidCustomerAdministrationAuthority
} from "../../security/route-iq-paid-customer-isolation-v1.mjs";
import { AEGIS_API_HEADERS } from "./aegis-security-controls.js";
import {
  cloudflareUnattendedSmokeContractVersion
} from "./cloudflare-unattended-smoke-contract.js";

export const ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_RUNTIME_VERSION =
  "route-iq-controlled-paid-customer-onboarding-rehearsal-runtime-v1";
export const ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PATH =
  "/api/dashboard/route-iq/paid-customer-onboarding/internal/controlled-rehearsal";
export const ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES = Object.freeze({
  routeNotFound: "route_iq_controlled_paid_customer_rehearsal_route_not_found",
  methodNotAllowed: "route_iq_controlled_paid_customer_rehearsal_method_not_allowed",
  requestInvalid: "route_iq_controlled_paid_customer_rehearsal_request_invalid",
  authorizationRequired:
    "route_iq_controlled_paid_customer_rehearsal_service_principal_required",
  executionFailed: "route_iq_controlled_paid_customer_rehearsal_execution_failed"
});
export const ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PHASES = Object.freeze({
  draftCreated: "DRAFT_CREATED",
  validationFailurePreserved: "VALIDATION_FAILURE_PRESERVED",
  draftRecovered: "DRAFT_RECOVERED",
  validated: "VALIDATED",
  authorizationVerified: "AUTHORIZATION_VERIFIED",
  hoursVerified: "HOURS_VERIFIED",
  safetyVerified: "SAFETY_VERIFIED"
});

const SAFE_ERROR_MESSAGE = "Route IQ controlled onboarding rehearsal is unavailable.";
const SAFE_VALIDATION_FAILURE = "CONTROLLED_LOCATION_SCOPE_INVALID";
const EXPECTED_OWNER_FAILURE =
  "route_iq_controlled_rehearsal_location_scope_invalid";
const EXPECTED_ISSUER_BINDING = "controlled_rehearsal_issuer_binding";
const EXPECTED_AUDIENCE_BINDING = "controlled_rehearsal_audience_binding";
const TRUSTED_MEMORY_STORES = new WeakSet();

export class RouteIqControlledPaidCustomerRehearsalRuntimeError extends Error {
  constructor(code, status) {
    super(SAFE_ERROR_MESSAGE);
    this.name = "RouteIqControlledPaidCustomerRehearsalRuntimeError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, status = 503) {
  throw new RouteIqControlledPaidCustomerRehearsalRuntimeError(code, status);
}

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
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
  const safe = error instanceof RouteIqControlledPaidCustomerRehearsalRuntimeError
    ? error
    : new RouteIqControlledPaidCustomerRehearsalRuntimeError(
      ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.executionFailed,
      503
    );
  return jsonResponse({
    ok: false,
    status: "FAIL",
    code: safe.code,
    message: SAFE_ERROR_MESSAGE
  }, safe.status);
}

export function createControlledPaidCustomerRehearsalMemoryStore() {
  const records = new Map();
  const store = Object.freeze({
    insert(identity, value) {
      if (records.has(identity)) fail(
        ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.executionFailed
      );
      records.set(identity, clone(value));
    },
    replace(identity, value) {
      if (!records.has(identity)) fail(
        ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.executionFailed
      );
      records.set(identity, clone(value));
    },
    read(identity) {
      if (!records.has(identity)) fail(
        ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.executionFailed
      );
      return clone(records.get(identity));
    },
    remove(identity) {
      records.delete(identity);
    },
    clear() {
      records.clear();
    },
    recordCount() {
      return records.size;
    }
  });
  TRUSTED_MEMORY_STORES.add(store);
  return store;
}

function validateMemoryStore(store) {
  if (!TRUSTED_MEMORY_STORES.has(store)) {
    fail(ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.executionFailed);
  }
  return store;
}

function validateRequest(request) {
  let url;
  try {
    url = new URL(request.url);
  } catch {
    fail(ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.requestInvalid, 400);
  }
  if (url.pathname !== ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PATH) {
    fail(ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.routeNotFound, 404);
  }
  if (request.method !== "GET") {
    fail(ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.methodNotAllowed, 405);
  }
  const declaredLength = request.headers.get("content-length");
  if (url.search !== ""
    || url.hash !== ""
    || request.body !== null
    || request.headers.has("transfer-encoding")
    || request.headers.has("content-encoding")
    || (declaredLength !== null && declaredLength !== "0")) {
    fail(ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.requestInvalid, 400);
  }
}

function validateAuthorization(authorization) {
  if (authorization?.kind !== "service_principal"
    || authorization?.verified !== true
    || authorization?.contractVersion !== cloudflareUnattendedSmokeContractVersion) {
    fail(
      ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.authorizationRequired,
      403
    );
  }
}

async function checkpoint(testHooks, phase, memory) {
  if (testHooks?.enabled === true && typeof testHooks.afterPhase === "function") {
    await testHooks.afterPhase(Object.freeze({
      phase,
      recordCount: memory.recordCount()
    }));
  }
}

function transitionedAt(offsetMinutes) {
  const base = Date.parse(controlledPaidCustomerRehearsalDefinition.expected.evaluatedAt);
  return new Date(base + offsetMinutes * 60_000).toISOString();
}

function preserveControlledValidationFailure(draft) {
  const invalid = clone(draft);
  invalid.locations[0].territoryId = "outside_controlled_rehearsal_territory";
  try {
    validateControlledPaidCustomerRehearsalDraft(invalid);
  } catch (error) {
    if (error?.code === EXPECTED_OWNER_FAILURE) return SAFE_VALIDATION_FAILURE;
    fail(ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.executionFailed);
  }
  fail(ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.executionFailed);
}

function expectSecurityDenial(context, request, expectedClassification) {
  try {
    authorizeRouteIqPaidCustomerOperation(context, request);
  } catch (error) {
    if (classifyRouteIqPaidCustomerSecurityFailure(error) === expectedClassification) {
      return true;
    }
    fail(ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.executionFailed);
  }
  fail(ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.executionFailed);
}

function authenticatedClaims(principalId) {
  return Object.freeze({
    authenticated: true,
    principalId,
    issuerBindingId: EXPECTED_ISSUER_BINDING,
    audienceBindingId: EXPECTED_AUDIENCE_BINDING,
    issuedAt: transitionedAt(-1),
    expiresAt: transitionedAt(30)
  });
}

function authorizeRehearsalPrincipals(configuration, principals) {
  const authority = projectRouteIqPaidCustomerAdministrationAuthority({
    configuration,
    expectedIssuerBindingId: EXPECTED_ISSUER_BINDING,
    expectedAudienceBindingId: EXPECTED_AUDIENCE_BINDING,
    principalBindings: principals.map(({ principalId, roleId }) => ({
      principalId,
      roleId
    }))
  });
  const requestedScope = {
    companyId: configuration.company.companyId,
    workspaceId: configuration.company.workspaceId
  };
  const now = new Date(controlledPaidCustomerRehearsalDefinition.expected.evaluatedAt);
  const contexts = principals.map(principal => ({
    principal,
    context: bindRouteIqPaidCustomerPrincipal({
      authenticatedClaims: authenticatedClaims(principal.principalId),
      requestedScope,
      authority,
      now
    })
  }));
  const manager = contexts.find(
    item => item.principal.principalKind === "OWNER_MANAGER"
  );
  const representatives = contexts.filter(
    item => item.principal.principalKind === "REPRESENTATIVE"
  );
  if (!manager || representatives.length !== 2) {
    fail(ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.executionFailed);
  }

  const managerDecision = authorizeRouteIqPaidCustomerOperation(manager.context, {
    ...requestedScope,
    operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.workspaceRecordsRead
  });
  assertRouteIqPaidCustomerStorageScope(managerDecision, requestedScope);

  const representativeDecision = authorizeRouteIqPaidCustomerOperation(
    representatives[0].context,
    {
      ...requestedScope,
      operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.ownRecordRead,
      resourceOwnerPrincipalId: representatives[0].principal.principalId
    }
  );
  assertRouteIqPaidCustomerStorageScope(representativeDecision, {
    ...requestedScope,
    principalId: representatives[0].principal.principalId
  });

  const representativeWorkspaceDenied = expectSecurityDenial(
    representatives[0].context,
    {
      ...requestedScope,
      operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.workspaceRecordsRead
    },
    ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.roleDenied
  );
  const representativePrivilegedDenied = expectSecurityDenial(
    representatives[0].context,
    {
      ...requestedScope,
      operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.configurationPreview
    },
    ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.roleDenied
  );
  const crossUserDenied = expectSecurityDenial(
    representatives[0].context,
    {
      ...requestedScope,
      operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.ownRecordRead,
      resourceOwnerPrincipalId: representatives[1].principal.principalId
    },
    ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.scopeDenied
  );
  const crossCompanyDenied = expectSecurityDenial(
    representatives[0].context,
    {
      companyId: "other_controlled_rehearsal_company",
      workspaceId: requestedScope.workspaceId,
      operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.businessRead
    },
    ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.scopeDenied
  );
  const crossWorkspaceDenied = expectSecurityDenial(
    representatives[0].context,
    {
      companyId: requestedScope.companyId,
      workspaceId: "other_controlled_rehearsal_workspace",
      operation: ROUTE_IQ_PAID_CUSTOMER_OPERATIONS.businessRead
    },
    ROUTE_IQ_PAID_CUSTOMER_FAILURE_CLASSIFICATIONS.scopeDenied
  );

  return Object.freeze({
    managerWorkspaceRead: managerDecision.authorized === true,
    representativeOwnRecordRead: representativeDecision.authorized === true,
    representativeWorkspaceDenied,
    representativePrivilegedDenied,
    crossUserDenied,
    crossCompanyDenied,
    crossWorkspaceDenied,
    representativeContext: representatives[0].context
  });
}

function evaluateOperatingHours(configuration, locations, representativeContext) {
  const paidCustomerScope = createPaidCustomerIntelligenceScope({
    onboardingConfiguration: configuration,
    principal: {
      authority: "server_authenticated_principal",
      authenticated: true,
      companyId: representativeContext.companyId,
      workspaceId: representativeContext.workspaceId,
      roleId: representativeContext.roleId
    },
    operation: paidCustomerIntelligenceOperations.recommendationAdmission
  });
  const decisions = locations.map(location =>
    evaluatePaidCustomerRecommendationAdmission({
      paidCustomerScope,
      businessEvidence: location.businessEvidence,
      evaluatedAt: controlledPaidCustomerRehearsalDefinition.expected.evaluatedAt
    }));
  const open = decisions.find(decision => decision.status === "ADMISSION_ELIGIBLE");
  const closed = decisions.find(
    decision => decision.reasonCode === "BUSINESS_NOT_OPEN_NOW"
  );
  if (!open
    || !closed
    || open.recommendationAdmissionEligible !== true
    || open.representativeRoutingEligible !== false
    || open.recommendationInfluence !== "OFF"
    || closed.recommendationAdmissionEligible !== false
    || closed.representativeRoutingEligible !== false
    || closed.recommendationInfluence !== "OFF") {
    fail(ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.executionFailed);
  }
  return Object.freeze({
    openLocation: "ADMISSION_ELIGIBLE_VALIDATION_ONLY",
    closedLocation: "BUSINESS_NOT_OPEN_NOW",
    representativeRouting: "BLOCKED",
    recommendationInfluence: "OFF"
  });
}

function verifyTopology(draft, configuration) {
  const locationIds = new Set(draft.locations.map(location => location.locationId));
  const businessIds = new Set(draft.locations.map(location => location.businessId));
  const exactScope = draft.locations.every(location =>
    location.territoryId === configuration.territory.territoryId
    && configuration.territory.authorizedZipCodes.includes(location.address.zipCode)
    && configuration.targeting.includedCategoryIds.includes(location.categoryId));
  if (draft.locations.length !== 2
    || locationIds.size !== 2
    || businessIds.size !== 2
    || exactScope !== true) {
    fail(ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.executionFailed);
  }
  return Object.freeze({
    companyWorkspaceBinding: "EXACT",
    locationCount: draft.locations.length,
    managerCount: draft.principals.filter(
      principal => principal.principalKind === "OWNER_MANAGER"
    ).length,
    representativeCount: draft.principals.filter(
      principal => principal.principalKind === "REPRESENTATIVE"
    ).length
  });
}

function verifySafety(draft, configuration) {
  const billing = draft.billing;
  const productionExecution = draft.productionExecution;
  const principalsInactive = draft.principals.every(principal =>
    principal.invitationState === "NOT_SENT"
    && principal.activationState === "INACTIVE");
  const safe = billing.mode === "SIMULATED_ONLY"
    && billing.stripeMode === "DISABLED"
    && billing.stripeCustomerId === null
    && billing.subscriptionId === null
    && billing.paymentMethodId === null
    && billing.billingActivationState === "BLOCKED"
    && configuration.safety.customerActivation === "OFF"
    && configuration.safety.collection === "OFF"
    && configuration.safety.activeCohorts === 0
    && configuration.safety.recommendationInfluence === "OFF"
    && configuration.safety.providerRefresh === "OFF"
    && configuration.safety.scheduler === "OFF"
    && principalsInactive
    && productionExecution.inMemoryOnly === true
    && productionExecution.persistenceAllowed === false
    && productionExecution.productionCustomerMutationAllowed === false
    && productionExecution.crmMutationAllowed === false
    && productionExecution.invitationAllowed === false
    && productionExecution.providerCallAllowed === false
    && productionExecution.schedulerAllowed === false
    && productionExecution.recommendationInfluenceAllowed === false
    && productionExecution.liveBillingAllowed === false;
  if (!safe) {
    fail(ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.executionFailed);
  }
  return Object.freeze({
    billing: "BLOCKED",
    liveStripe: "DISABLED",
    customerActivation: "OFF",
    invitations: "NOT_SENT",
    providerRefresh: "OFF",
    scheduler: "OFF",
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    persistence: "NONE",
    productionBindingAccess: "NONE"
  });
}

export async function executeControlledPaidCustomerOnboardingRehearsal({
  memory = createControlledPaidCustomerRehearsalMemoryStore(),
  testHooks
} = {}) {
  validateMemoryStore(memory);
  let evidence;
  let executionFailure;
  try {
    if (memory.recordCount() !== 0) {
      fail(ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.executionFailed);
    }
    const draft = validateControlledPaidCustomerRehearsalDraft(
      createControlledPaidCustomerRehearsalDraft()
    );
    const identity = draft.rehearsalId;
    memory.insert(identity, {
      lifecycleState: "DRAFT",
      onboardingConfiguration: draft.onboardingConfiguration,
      locations: draft.locations,
      principals: draft.principals,
      billing: draft.billing,
      audit: ["DRAFT_CREATED"]
    });
    await checkpoint(
      testHooks,
      ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PHASES.draftCreated,
      memory
    );

    const validationFailure = preserveControlledValidationFailure(draft);
    const failedConfiguration = transitionRouteIqPaidCustomerOnboarding(
      draft.onboardingConfiguration,
      "VALIDATION_FAILED",
      {
        transitionedAt: transitionedAt(1),
        failure: {
          code: "controlled_location_scope_invalid",
          recoveryAction: "Restore canonical fictional location scope and validate again."
        }
      }
    );
    const failedRecord = memory.read(identity);
    memory.replace(identity, {
      ...failedRecord,
      lifecycleState: "VALIDATION_FAILED",
      onboardingConfiguration: failedConfiguration,
      audit: [...failedRecord.audit, validationFailure]
    });
    const preservedRecord = memory.read(identity);
    if (preservedRecord.lifecycleState !== "VALIDATION_FAILED"
      || preservedRecord.audit.at(-1) !== SAFE_VALIDATION_FAILURE) {
      fail(ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.executionFailed);
    }
    await checkpoint(
      testHooks,
      ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PHASES.validationFailurePreserved,
      memory
    );

    const recoveredConfiguration = transitionRouteIqPaidCustomerOnboarding(
      failedConfiguration,
      "DRAFT",
      { transitionedAt: transitionedAt(2) }
    );
    memory.replace(identity, {
      ...preservedRecord,
      lifecycleState: "DRAFT",
      onboardingConfiguration: draft.onboardingConfiguration,
      audit: [
        ...preservedRecord.audit,
        {
          event: "DRAFT_RECOVERED",
          lifecycleConfiguration: recoveredConfiguration
        }
      ]
    });
    await checkpoint(
      testHooks,
      ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PHASES.draftRecovered,
      memory
    );

    const validatedConfiguration = transitionRouteIqPaidCustomerOnboarding(
      draft.onboardingConfiguration,
      "VALIDATED",
      { transitionedAt: transitionedAt(3) }
    );
    const recoveredRecord = memory.read(identity);
    memory.replace(identity, {
      ...recoveredRecord,
      lifecycleState: "VALIDATED",
      onboardingConfiguration: validatedConfiguration,
      audit: [...recoveredRecord.audit, "VALIDATED"]
    });
    await checkpoint(
      testHooks,
      ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PHASES.validated,
      memory
    );

    const topology = verifyTopology(draft, validatedConfiguration);
    const authorization = authorizeRehearsalPrincipals(
      validatedConfiguration,
      draft.principals
    );
    await checkpoint(
      testHooks,
      ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PHASES.authorizationVerified,
      memory
    );
    const operatingHours = evaluateOperatingHours(
      validatedConfiguration,
      draft.locations,
      authorization.representativeContext
    );
    await checkpoint(
      testHooks,
      ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PHASES.hoursVerified,
      memory
    );
    const safety = verifySafety(draft, validatedConfiguration);
    await checkpoint(
      testHooks,
      ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PHASES.safetyVerified,
      memory
    );

    evidence = {
      lifecycle: {
        draft: "CREATED",
        controlledValidation: "FAILED_AS_EXPECTED",
        validationFailure,
        failureEvidence: "PRESERVED",
        recovery: "DRAFT_RESTORED",
        finalState: "VALIDATED",
        activated: false
      },
      topology,
      authorization: {
        managerWorkspaceRead:
          authorization.managerWorkspaceRead ? "AUTHORIZED" : "DENIED",
        representativeOwnRecordRead:
          authorization.representativeOwnRecordRead ? "AUTHORIZED" : "DENIED",
        representativeWorkspaceRead:
          authorization.representativeWorkspaceDenied ? "DENIED" : "AUTHORIZED",
        representativePrivilegedAccess:
          authorization.representativePrivilegedDenied ? "DENIED" : "AUTHORIZED",
        crossUserAccess: authorization.crossUserDenied ? "DENIED" : "AUTHORIZED",
        crossCompanyAccess:
          authorization.crossCompanyDenied ? "DENIED" : "AUTHORIZED",
        crossWorkspaceAccess:
          authorization.crossWorkspaceDenied ? "DENIED" : "AUTHORIZED"
      },
      operatingHours,
      safety
    };
  } catch {
    executionFailure = new RouteIqControlledPaidCustomerRehearsalRuntimeError(
      ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.executionFailed,
      503
    );
  } finally {
    memory.clear();
  }
  if (executionFailure) throw executionFailure;
  if (memory.recordCount() !== 0) {
    fail(ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.executionFailed);
  }
  return deepFreeze({
    ...evidence,
    safeEmptyState: "PRESERVED",
    cleanup: {
      status: "REMOVED",
      remainingRecords: memory.recordCount()
    }
  });
}

export function isControlledPaidCustomerOnboardingRehearsalPath(pathname) {
  return pathname === ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_PATH;
}

export async function handleControlledPaidCustomerOnboardingRehearsalRequest(
  request,
  smokeAuthorization,
  { testHooks } = {}
) {
  try {
    validateRequest(request);
    validateAuthorization(smokeAuthorization);
    const evidence = await executeControlledPaidCustomerOnboardingRehearsal({
      testHooks
    });
    return jsonResponse({
      ok: true,
      contractVersion:
        ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_RUNTIME_VERSION,
      status: "PASS",
      evidence
    });
  } catch (error) {
    const response = errorResponse(error);
    if (error?.code
      === ROUTE_IQ_CONTROLLED_PAID_CUSTOMER_REHEARSAL_FAILURES.methodNotAllowed) {
      const headers = new Headers(response.headers);
      headers.set("Allow", "GET");
      return new Response(response.body, {
        status: response.status,
        headers
      });
    }
    return response;
  }
}
