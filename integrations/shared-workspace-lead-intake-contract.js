export const SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT_VERSION = "shared-workspace-lead-intake-artifact-contract.v1";

export const SHARED_WORKSPACE_LEAD_INTAKE_COMPONENTS = Object.freeze([
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

export const SHARED_WORKSPACE_LEAD_INTAKE_STATES = Object.freeze({
  RECEIVED: "received",
  PERSISTED: "persisted",
  QUEUED: "queued",
  SENT: "sent",
  FAILED: "failed",
  REJECTED: "rejected",
  RETRY_PENDING: "retry_pending"
});

export const SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT = Object.freeze({
  contractVersion: SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT_VERSION,
  ownerSubsystem: "Prometheus Infrastructure",
  canonicalPath: "integrations/shared-workspace-lead-intake-contract.js",
  runtimeEntrypoint: "workers/infrastructure/shared-lead-intake-pipeline.js",
  activeRouteIqRequestRuntime: Object.freeze({
    status: "active_source_not_deployed",
    endpoint: "/api/partner-intake",
    runtimeEntrypoint: "workers/infrastructure/route-iq-request-crm-runtime.js",
    crmContract: "crm/route-iq-request-crm-contract-v1.json",
    workspaceId: "prometheus_route_iq",
    operatingProfileId: "route_iq_commercial",
    durableBinding: "ROUTE_IQ_REQUEST_CRM_COORDINATOR",
    atomicStorage: "sqlite_backed_durable_object_transaction",
    publicWorkerOnly: true,
    founderRetrievalRequiresImmutablePrincipal: true,
    representativeRetrievalAllowed: false,
    fitnessConnectionCustomerIntakeActive: false,
    smoothieDepotCustomerIntakeActive: false
  }),
  legacyWorkspaceIntakeRuntime: Object.freeze({
    status: "historical_inactive",
    runtimeEntrypoint: "workers/infrastructure/shared-lead-intake-pipeline.js",
    productionRouteSelectedByWorker: false,
    historicalRecordsPreserved: true
  }),
  endpoint: Object.freeze({
    id: "partner_intake_endpoint",
    method: "POST",
    path: "/api/partner-intake",
    servedBy: "prometheusrouteiq-website Worker",
    allowedContentTypes: Object.freeze([
      "application/json",
      "application/x-www-form-urlencoded"
    ]),
    publicResponseMustExcludeRawLeadContactData: true,
    dashboardRawIntakeReadAllowed: false
  }),
  workspaceRouter: Object.freeze({
    id: "workspace_router",
    ownerSubsystem: "Prometheus Infrastructure",
    unknownWorkspaceFailsClosed: true,
    missingWorkspaceRouteFailsClosed: true,
    noCrossWorkspaceRouting: true,
    noProductionFixtureOrDemoIntakeData: true,
    workspaces: Object.freeze({
      fitness_connection: Object.freeze({
        workspaceId: "fitness_connection",
        workspaceName: "Fitness Connection",
        operatingProfileId: "fitness",
        operatingProfileLabel: "Fitness",
        aliases: Object.freeze([
          "fitness_connection",
          "fitness-connection",
          "fitness connection",
          "fitness",
          "fc",
          "fitness_connection_partner_intake"
        ]),
        protectedWorkspaceIds: Object.freeze(["smoothie_depot"]),
        crmWorkspacePath: "crm://workspace/fitness_connection/leads",
        kvSubmissionPrefix: "shared-lead-intake/workspaces/fitness_connection/submissions/"
      }),
      smoothie_depot: Object.freeze({
        workspaceId: "smoothie_depot",
        workspaceName: "Smoothie Depot",
        operatingProfileId: "franchise_development",
        operatingProfileLabel: "Franchise Development",
        aliases: Object.freeze([
          "smoothie_depot",
          "smoothie-depot",
          "smoothie depot",
          "smoothie",
          "sd",
          "smoothie_depot_partner_intake"
        ]),
        protectedWorkspaceIds: Object.freeze(["fitness_connection"]),
        crmWorkspacePath: "crm://workspace/smoothie_depot/candidate_pipeline",
        kvSubmissionPrefix: "shared-lead-intake/workspaces/smoothie_depot/submissions/"
      })
    })
  }),
  kvPersistence: Object.freeze({
    id: "kv_persistence",
    binding: "SHARED_LEAD_INTAKE_STORE",
    namespaceId: "5c78f078c68147f089f7b6423c99688c",
    storeType: "cloudflare_kv",
    writeOwner: "Prometheus Infrastructure",
    readAllowed: Object.freeze(["Prometheus Infrastructure", "Prometheus Overwatch"]),
    crmRawStoreReadAllowed: false,
    dashboardRawStoreReadAllowed: false,
    keyPatterns: Object.freeze({
      submission: "shared-lead-intake/workspaces/{workspaceId}/submissions/{submissionId}",
      globalIndex: "shared-lead-intake/submissions/{submissionId}",
      audit: "shared-lead-intake/audit/{workspaceId}/{submissionId}",
      notification: "shared-lead-intake/notifications/{workspaceId}/{submissionId}"
    }),
    persistBeforeNotification: true,
    failClosedIfBindingMissing: true
  }),
  intakeSubmissionArtifact: Object.freeze({
    id: "intake_submission_artifact",
    version: "shared-workspace-lead-intake.v1",
    requiredFields: Object.freeze([
      "submissionId",
      "timestamp",
      "workspace.workspaceId",
      "workspace.workspaceName",
      "operatingProfile.id",
      "operatingProfile.label",
      "attribution",
      "source",
      "status",
      "security",
      "crmHandoff",
      "auditTrail",
      "founderNotification",
      "storage"
    ]),
    statusValues: Object.freeze([
      SHARED_WORKSPACE_LEAD_INTAKE_STATES.RECEIVED,
      SHARED_WORKSPACE_LEAD_INTAKE_STATES.PERSISTED,
      SHARED_WORKSPACE_LEAD_INTAKE_STATES.REJECTED
    ]),
    noFrontendTokenOrSecretFields: true
  }),
  crmHandoffPacket: Object.freeze({
    id: "crm_handoff_packet",
    contract: "shared_workspace_crm_lead_intake_packet.v1",
    ownerSubsystem: "Prometheus CRM",
    producerSubsystem: "Prometheus Infrastructure",
    consumerEntryPoint: "consumeWorkspaceLeadIntakeHandoff",
    mutationPerformedByInfrastructure: false,
    crmBusinessLogicOwnedByInfrastructure: false,
    requiredFields: Object.freeze([
      "status",
      "mutationPerformed",
      "ownerSubsystem",
      "contract",
      "workspaceId",
      "crmWorkspacePath",
      "handoffId",
      "preparedAt",
      "packet.lead",
      "packet.crmIntegration",
      "packet.attribution"
    ]),
    unknownWorkspaceFailsClosed: true,
    crossWorkspaceContaminationFailsClosed: true
  }),
  founderNotificationEvent: Object.freeze({
    id: "founder_notification_event",
    channel: "email",
    binding: "FOUNDER_EMAIL",
    destinationDefault: "prometheusrouteiq@gmail.com",
    senderDefault: "intake@prometheusrouteiq.com",
    registeredEvenIfDeliveryPending: true,
    statuses: Object.freeze(["pending", "queued", "sent", "failed"]),
    futureHooks: Object.freeze({
      dashboard: "prepared",
      companion: "prepared"
    }),
    noSecretsOrTokensInMessage: true
  }),
  failureRetryEvent: Object.freeze({
    id: "failure_retry_event",
    retryableEvents: Object.freeze([
      "email_send_failed",
      "founder_notification_queued"
    ]),
    nonRetryableEvents: Object.freeze([
      "unknown_workspace",
      "missing_workspace_route",
      "validation_failed",
      "spam_check_failed",
      "unsupported_content_type",
      "malformed_submission",
      "body_too_large",
      "storage_binding_missing"
    ]),
    durableRecordRequiredBeforeRetry: true,
    failedUnknownWorkspaceMayNotPersist: true
  }),
  auditMetadata: Object.freeze({
    id: "audit_metadata",
    requiredEvents: Object.freeze([
      "submission_received",
      "workspace_routed",
      "validation_passed",
      "spam_checks_passed",
      "submission_record_prepared",
      "workspace_crm_handoff_prepared",
      "submission_persisted",
      "email_queued"
    ]),
    requiredActors: Object.freeze([
      "prometheus_infrastructure",
      "workspace_router",
      "validation",
      "spam_protection",
      "durable_storage",
      "crm_handoff",
      "founder_notification"
    ])
  }),
  aegisProtection: Object.freeze({
    id: "aegis_rate_limit_metadata",
    routePolicy: "lead_intake",
    requiredResponseHeaders: Object.freeze([
      "X-Aegis-Route-Policy",
      "Cache-Control",
      "Content-Security-Policy",
      "Strict-Transport-Security"
    ]),
    allowedMethods: Object.freeze(["POST", "OPTIONS"]),
    cachePolicy: "no-store",
    permissiveCorsAllowed: false
  }),
  failClosedBehavior: Object.freeze({
    id: "workspace_fail_closed_behavior",
    unknownWorkspaceStatus: 400,
    missingWorkspaceRouteStatus: 400,
    storageBindingMissingStatus: 503,
    validationFailureStatus: 422,
    unknownWorkspacePersistsRecord: false,
    unknownWorkspaceCreatesCrmHandoff: false,
    unknownWorkspaceSendsFounderNotification: false
  }),
  boundaries: Object.freeze({
    infrastructureValidatesAndRoutes: true,
    infrastructureOwnsCrmBusinessLogic: false,
    crmConsumesHandoffPackets: true,
    dashboardReadsRawIntakeWithoutApproval: false,
    companionNotificationHookPreparedOnly: true,
    noFixtureDemoIntakeDataInProduction: true
  })
});

export function listSharedWorkspaceLeadIntakeContracts() {
  return SHARED_WORKSPACE_LEAD_INTAKE_COMPONENTS.map(componentId => {
    const component = Object.values(SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT)
      .find(value => value && typeof value === "object" && value.id === componentId);
    return component || { id: componentId };
  });
}

export function getSharedLeadIntakeWorkspaceContract(workspaceId) {
  return SHARED_WORKSPACE_LEAD_INTAKE_CONTRACT.workspaceRouter.workspaces[workspaceId] || null;
}

export function workspaceSubmissionKeyPrefix(workspaceId) {
  return getSharedLeadIntakeWorkspaceContract(workspaceId)?.kvSubmissionPrefix || null;
}

export function assertSharedWorkspaceLeadIntakeContract() {
  const missing = SHARED_WORKSPACE_LEAD_INTAKE_COMPONENTS.filter(componentId => (
    !listSharedWorkspaceLeadIntakeContracts().some(component => component.id === componentId)
  ));
  if (missing.length > 0) {
    throw new Error(`Shared workspace lead intake contract missing component(s): ${missing.join(", ")}`);
  }
  return true;
}
