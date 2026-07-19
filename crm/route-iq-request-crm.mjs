import { createHash } from "node:crypto";

export const routeIqRequestCrmVersion = "route-iq-request-crm-v1";
export const routeIqRequestCrmContract = "route_iq_request_crm.v1";
export const routeIqRequestCrmStoragePrefix = "crm-route-iq-requests-v1";

export const routeIqRequestCrmWorkspace = Object.freeze({
  workspaceId: "prometheus_route_iq",
  operatingProfileId: "route_iq_commercial",
  target: "route_iq_request"
});

export const routeIqRequestCrmAccessConfigurationNames = Object.freeze([
  "ROUTE_IQ_REQUEST_CRM_ACCESS_TEAM_DOMAIN",
  "ROUTE_IQ_REQUEST_CRM_ACCESS_AUDIENCE",
  "ROUTE_IQ_REQUEST_CRM_FOUNDER_SUBJECT_SHA256"
]);

export const routeIqRequestCrmHttpBoundary = Object.freeze({
  publicIntake: Object.freeze({
    path: "/api/partner-intake",
    methods: Object.freeze(["POST"]),
    cloudflareAccessRequired: false
  }),
  founderAccess: Object.freeze({
    applicationPath: "/api/partner-intake/founder/*",
    paths: Object.freeze([
      "/api/partner-intake/founder/requests",
      "/api/partner-intake/founder/requests/{receiptId}",
      "/api/partner-intake/founder/export"
    ]),
    methods: Object.freeze(["GET"]),
    cloudflareAccessRequired: true,
    immutableSubjectClaim: "sub",
    subjectVerification: "sha256_equals_configured_digest",
    displayNameAuthorizationAllowed: false,
    everyonePolicyAllowed: false,
    bypassPolicyAllowed: false
  })
});

export const routeIqRequestAcquisitionSources = Object.freeze([
  "route_iq_website",
  "founder_referral",
  "customer_referral",
  "organic",
  "event",
  "other_governed"
]);

export const routeIqRequestDesiredTimelines = Object.freeze([
  "immediately",
  "within_30_days",
  "within_90_days",
  "this_year",
  "exploring"
]);

export const routeIqRequestFounderAuthorization = Object.freeze({
  identityProvider: "prometheus_identity",
  immutablePrincipalId: "riq_principal_7250bf2f7db15371eea3173c4f25953cffd6adf5b29f093ce8f9f0977a70e3c4",
  canonicalIdentitySource: "data/route-iq-commercial-readiness-v1/route-iq-commercial-workspace-registry-v1.json",
  canonicalIdentityPath: "workspaces[workspaceId=fitness_connection].users[representativeId=cruz].authenticatedPrincipalId",
  workspaceId: routeIqRequestCrmWorkspace.workspaceId,
  anthony: Object.freeze({
    authorized: false,
    status: "pending_exact_authenticated_identity_mapping"
  })
});

const requestInputKeys = Object.freeze([
  "workspaceId",
  "operatingProfileId",
  "idempotencyKey",
  "businessName",
  "contactName",
  "businessEmail",
  "phone",
  "businessType",
  "numberOfLocations",
  "estimatedUsers",
  "territory",
  "primaryProblem",
  "desiredTimeline",
  "consent",
  "acquisitionSource"
]);

const opaqueIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9][0-9 ()-]{6,23}$/;

export class RouteIqRequestCrmError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.name = "RouteIqRequestCrmError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, message, status) {
  throw new RouteIqRequestCrmError(code, message, status);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function iso(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) fail("invalid_submission_timestamp", "CRM request timestamp is invalid.");
  return date.toISOString();
}

function digest(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function boundedText(value, field, min, max, { optional = false } = {}) {
  if (value === undefined || value === null) {
    if (optional) return "";
    fail("invalid_request_field", `${field} is required.`);
  }
  if (typeof value !== "string") fail("invalid_request_field", `${field} must be text.`);
  const normalized = value.trim().replace(/\r\n?/g, "\n");
  if (!normalized && optional) return "";
  if (normalized.length < min || normalized.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)) {
    fail("invalid_request_field", `${field} is invalid.`);
  }
  return normalized;
}

function positiveInteger(value, field, max) {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    fail("invalid_request_field", `${field} must be a positive integer no greater than ${max}.`);
  }
  return value;
}

function enumValue(value, field, values) {
  if (!values.includes(value)) fail("invalid_request_field", `${field} is unsupported.`);
  return value;
}

function requireExactInputShape(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("invalid_request_body", "Route IQ request body must be an object.");
  }
  const unknown = Object.keys(input).filter(key => !requestInputKeys.includes(key));
  if (unknown.length) fail("unexpected_request_field", "Route IQ request contains unsupported fields.");
}

function requireWorkspace(workspaceId, operatingProfileId) {
  if (workspaceId !== routeIqRequestCrmWorkspace.workspaceId || operatingProfileId !== routeIqRequestCrmWorkspace.operatingProfileId) {
    fail("unknown_request_workspace", "Route IQ request workspace or operating profile is not authorized.", 403);
  }
}

export function normalizeRouteIqRequestInput(input = {}) {
  requireExactInputShape(input);
  requireWorkspace(input.workspaceId, input.operatingProfileId);

  const idempotencyKey = boundedText(input.idempotencyKey, "idempotencyKey", 16, 128);
  if (!opaqueIdPattern.test(idempotencyKey)) fail("invalid_idempotency_key", "idempotencyKey must be an opaque identifier.");

  const businessEmail = boundedText(input.businessEmail, "businessEmail", 3, 254).toLowerCase();
  if (!emailPattern.test(businessEmail)) fail("invalid_business_email", "businessEmail is invalid.");

  const phone = boundedText(input.phone, "phone", 7, 24, { optional: true });
  if (phone && !phonePattern.test(phone)) fail("invalid_phone", "phone is invalid.");
  if (input.consent !== true) fail("consent_required", "Explicit consent is required.");

  return Object.freeze({
    workspaceId: routeIqRequestCrmWorkspace.workspaceId,
    operatingProfileId: routeIqRequestCrmWorkspace.operatingProfileId,
    idempotencyKey,
    businessName: boundedText(input.businessName, "businessName", 2, 160),
    contactName: boundedText(input.contactName, "contactName", 2, 120),
    businessEmail,
    phone,
    businessType: boundedText(input.businessType, "businessType", 2, 100),
    numberOfLocations: positiveInteger(input.numberOfLocations, "numberOfLocations", 100000),
    estimatedUsers: positiveInteger(input.estimatedUsers, "estimatedUsers", 1000000),
    territory: boundedText(input.territory, "territory", 2, 240),
    primaryProblem: boundedText(input.primaryProblem, "primaryProblem", 10, 2000),
    desiredTimeline: enumValue(input.desiredTimeline, "desiredTimeline", routeIqRequestDesiredTimelines),
    consent: true,
    acquisitionSource: enumValue(input.acquisitionSource, "acquisitionSource", routeIqRequestAcquisitionSources)
  });
}

function contentFrom(normalized) {
  const { idempotencyKey: _idempotencyKey, ...content } = normalized;
  return content;
}

export function routeIqRequestCrmStorageKeys(normalizedInput) {
  const normalized = normalizeRouteIqRequestInput(normalizedInput);
  const contentHash = digest(stableJson(contentFrom(normalized)));
  const idempotencyHash = digest(normalized.idempotencyKey);
  const receiptId = `riq_receipt_${contentHash.slice(0, 24)}`;
  const root = `${routeIqRequestCrmStoragePrefix}/workspaces/${normalized.workspaceId}`;
  return Object.freeze({
    contentHash,
    idempotencyHash,
    receiptId,
    record: `${root}/requests/${receiptId}.json`,
    idempotency: `${root}/idempotency/${idempotencyHash}.json`,
    duplicate: `${root}/duplicates/${contentHash}.json`,
    monitoring: `${root}/monitoring/${receiptId}.json`
  });
}

function requireStore(store, { list = false } = {}) {
  const required = list ? ["get", "list"] : ["get", "putIfAbsent", "put"];
  const missing = required.filter(method => typeof store?.[method] !== "function");
  if (missing.length) {
    fail("crm_store_capability_missing", `CRM durable store is missing required capabilities: ${missing.join(", ")}.`, 503);
  }
  return store;
}

async function readJson(store, key) {
  const value = await store.get(key);
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") return clone(value);
  try {
    return JSON.parse(value);
  } catch {
    fail("crm_store_record_invalid", "CRM durable record is invalid JSON.", 500);
  }
}

async function put(store, key, value, metadata = {}) {
  await store.put(key, JSON.stringify(value), { metadata });
}

async function putIfAbsent(store, key, value, metadata = {}) {
  return Boolean(await store.putIfAbsent(key, JSON.stringify(value), { metadata }));
}

function ensureIdempotencyClaim(claim, normalized, keys) {
  if (claim.workspaceId !== normalized.workspaceId || claim.idempotencyHash !== keys.idempotencyHash) {
    fail("idempotency_record_invalid", "CRM idempotency record is outside the authorized partition.", 500);
  }
  if (claim.contentHash !== keys.contentHash || claim.receiptId !== keys.receiptId) {
    fail("idempotency_conflict", "The idempotency key was already used for different request content.", 409);
  }
}

function canonicalRecord(normalized, keys, submittedAt) {
  return {
    version: routeIqRequestCrmVersion,
    contract: routeIqRequestCrmContract,
    receiptId: keys.receiptId,
    workspace: {
      workspaceId: normalized.workspaceId,
      operatingProfileId: normalized.operatingProfileId
    },
    request: {
      businessName: normalized.businessName,
      contactName: normalized.contactName,
      businessEmail: normalized.businessEmail,
      phone: normalized.phone || null,
      businessType: normalized.businessType,
      numberOfLocations: normalized.numberOfLocations,
      estimatedUsers: normalized.estimatedUsers,
      territory: normalized.territory,
      primaryProblem: normalized.primaryProblem,
      desiredTimeline: normalized.desiredTimeline,
      consent: {
        accepted: true,
        acceptedAt: submittedAt
      },
      acquisitionSource: normalized.acquisitionSource,
      submittedAt
    },
    integrity: {
      canonicalPayloadHash: keys.contentHash,
      hashAlgorithm: "sha256",
      idempotencyKeyStored: false
    },
    status: "accepted",
    monitoring: {
      storageStatus: "committed",
      validationStatus: "passed",
      notificationStatus: "pending_consumer_delivery",
      failureCode: null,
      acceptedAt: submittedAt
    }
  };
}

function validateStoredRecord(record, normalized, keys) {
  if (!record || record.version !== routeIqRequestCrmVersion || record.receiptId !== keys.receiptId) {
    fail("crm_store_record_invalid", "CRM request record does not match its receipt.", 500);
  }
  if (record.workspace?.workspaceId !== normalized.workspaceId || record.workspace?.operatingProfileId !== normalized.operatingProfileId) {
    fail("crm_store_record_invalid", "CRM request record crossed a workspace partition.", 500);
  }
  if (record.integrity?.canonicalPayloadHash !== keys.contentHash) {
    fail("crm_store_record_invalid", "CRM request content integrity failed.", 500);
  }
  return record;
}

async function ensureRecordAndIndexes(store, normalized, keys, submittedAt) {
  const proposed = canonicalRecord(normalized, keys, submittedAt);
  const recordCreated = await putIfAbsent(store, keys.record, proposed, {
    workspaceId: normalized.workspaceId,
    receiptId: keys.receiptId,
    recordType: "route_iq_request"
  });
  const record = validateStoredRecord(await readJson(store, keys.record), normalized, keys);

  const duplicateIndex = {
    version: routeIqRequestCrmVersion,
    workspaceId: normalized.workspaceId,
    contentHash: keys.contentHash,
    receiptId: keys.receiptId,
    recordKey: keys.record
  };
  await putIfAbsent(store, keys.duplicate, duplicateIndex, {
    workspaceId: normalized.workspaceId,
    receiptId: keys.receiptId,
    recordType: "route_iq_request_duplicate_index"
  });
  const storedDuplicate = await readJson(store, keys.duplicate);
  if (storedDuplicate?.contentHash !== keys.contentHash || storedDuplicate?.recordKey !== keys.record) {
    fail("duplicate_index_conflict", "CRM duplicate index conflicts with canonical request content.", 409);
  }

  await put(store, keys.monitoring, record.monitoring, {
    workspaceId: normalized.workspaceId,
    receiptId: keys.receiptId,
    recordType: "route_iq_request_monitoring"
  });
  return { record, recordCreated };
}

export async function persistRouteIqRequest(store, input = {}, options = {}) {
  requireStore(store);
  const normalized = normalizeRouteIqRequestInput(input);
  const keys = routeIqRequestCrmStorageKeys(normalized);
  const submittedAt = iso(options.now || new Date());
  const claim = {
    version: routeIqRequestCrmVersion,
    workspaceId: normalized.workspaceId,
    idempotencyHash: keys.idempotencyHash,
    contentHash: keys.contentHash,
    receiptId: keys.receiptId,
    recordKey: keys.record
  };

  const existingClaim = await readJson(store, keys.idempotency);
  if (existingClaim) {
    ensureIdempotencyClaim(existingClaim, normalized, keys);
    const { record } = await ensureRecordAndIndexes(store, normalized, keys, submittedAt);
    return { ok: true, duplicate: true, status: "already_accepted", receiptId: keys.receiptId, record };
  }

  const created = await putIfAbsent(store, keys.idempotency, claim, {
    workspaceId: normalized.workspaceId,
    receiptId: keys.receiptId,
    recordType: "route_iq_request_idempotency_claim"
  });
  const durableClaim = await readJson(store, keys.idempotency);
  if (!durableClaim) fail("idempotency_claim_missing", "CRM idempotency claim was not durably stored.", 503);
  ensureIdempotencyClaim(durableClaim, normalized, keys);

  const duplicateIndex = await readJson(store, keys.duplicate);
  if (duplicateIndex && (duplicateIndex.contentHash !== keys.contentHash || duplicateIndex.recordKey !== keys.record)) {
    fail("duplicate_index_conflict", "CRM duplicate index conflicts with canonical request content.", 409);
  }

  const { record, recordCreated } = await ensureRecordAndIndexes(store, normalized, keys, submittedAt);
  const duplicate = !created || Boolean(duplicateIndex) || !recordCreated;
  return { ok: true, duplicate, status: duplicate ? "already_accepted" : "accepted", receiptId: keys.receiptId, record };
}

export function publicRouteIqRequestReceipt(result = {}) {
  if (!result.ok || !result.record) fail("invalid_receipt_result", "CRM receipt requires an accepted request result.", 500);
  return {
    ok: true,
    version: routeIqRequestCrmVersion,
    receiptId: result.receiptId,
    status: result.status,
    duplicate: result.duplicate,
    submittedAt: result.record.request.submittedAt
  };
}

export function authorizeRouteIqRequestFounder(principal = {}) {
  const allowed = principal.authenticated === true
    && principal.identityProvider === routeIqRequestFounderAuthorization.identityProvider
    && principal.immutablePrincipalId === routeIqRequestFounderAuthorization.immutablePrincipalId
    && principal.workspaceId === routeIqRequestFounderAuthorization.workspaceId
    && principal.identityImmutable === true;
  if (!allowed) fail("founder_authorization_required", "Founder-only CRM access is not authorized for this immutable principal.", 403);
  return true;
}

function requireFounderScope(input = {}) {
  authorizeRouteIqRequestFounder(input.principal);
  requireWorkspace(input.workspaceId, input.operatingProfileId);
}

export async function retrieveRouteIqRequest(store, input = {}) {
  requireStore(store, { list: true });
  requireFounderScope(input);
  const receiptId = boundedText(input.receiptId, "receiptId", 16, 80);
  if (!/^riq_receipt_[a-f0-9]{24}$/.test(receiptId)) fail("invalid_receipt_id", "receiptId is invalid.");
  const key = `${routeIqRequestCrmStoragePrefix}/workspaces/${input.workspaceId}/requests/${receiptId}.json`;
  const record = await readJson(store, key);
  if (!record) return null;
  if (record.workspace?.workspaceId !== input.workspaceId || record.receiptId !== receiptId) {
    fail("crm_store_record_invalid", "CRM request retrieval crossed a workspace partition.", 500);
  }
  return record;
}

export async function listRouteIqRequests(store, input = {}) {
  requireStore(store, { list: true });
  requireFounderScope(input);
  const prefix = `${routeIqRequestCrmStoragePrefix}/workspaces/${input.workspaceId}/requests/`;
  const listed = await store.list({ prefix });
  const keys = Array.isArray(listed) ? listed : listed?.keys;
  if (!Array.isArray(keys)) fail("crm_store_list_invalid", "CRM durable list response is invalid.", 500);
  const records = [];
  for (const item of keys) {
    const key = typeof item === "string" ? item : item?.name;
    if (typeof key !== "string" || !key.startsWith(prefix) || !key.endsWith(".json")) {
      fail("crm_store_list_invalid", "CRM durable list returned an invalid key.", 500);
    }
    const record = await readJson(store, key);
    if (!record || record.workspace?.workspaceId !== input.workspaceId) {
      fail("crm_store_record_invalid", "CRM request list crossed a workspace partition.", 500);
    }
    records.push(record);
  }
  return records.sort((a, b) => a.request.submittedAt.localeCompare(b.request.submittedAt) || a.receiptId.localeCompare(b.receiptId));
}

function csvCell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text.trimStart())) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function exportRouteIqRequests(store, input = {}) {
  const records = await listRouteIqRequests(store, input);
  const generatedAt = iso(input.generatedAt || new Date());
  if (input.format === "json") {
    return JSON.stringify({
      version: routeIqRequestCrmVersion,
      workspaceId: input.workspaceId,
      generatedAt,
      recordCount: records.length,
      records
    }, null, 2);
  }
  if (input.format !== "csv") fail("unsupported_export_format", "CRM export format must be json or csv.");

  const headers = [
    "receiptId", "submittedAt", "businessName", "contactName", "businessEmail", "phone",
    "businessType", "numberOfLocations", "estimatedUsers", "territory", "primaryProblem",
    "desiredTimeline", "consent", "acquisitionSource", "status"
  ];
  const rows = records.map(record => {
    const request = record.request;
    return [
      record.receiptId, request.submittedAt, request.businessName, request.contactName,
      request.businessEmail, request.phone, request.businessType, request.numberOfLocations,
      request.estimatedUsers, request.territory, request.primaryProblem, request.desiredTimeline,
      request.consent.accepted, request.acquisitionSource, record.status
    ].map(csvCell).join(",");
  });
  return [headers.map(csvCell).join(","), ...rows].join("\n");
}

export function routeIqRequestFailureMetadata(error, options = {}) {
  const code = error instanceof RouteIqRequestCrmError ? error.code : "crm_request_internal_failure";
  const status = error instanceof RouteIqRequestCrmError ? error.status : 500;
  const attemptId = typeof options.attemptId === "string" && opaqueIdPattern.test(options.attemptId)
    ? options.attemptId
    : "unavailable";
  return {
    version: routeIqRequestCrmVersion,
    workspaceId: routeIqRequestCrmWorkspace.workspaceId,
    operatingProfileId: routeIqRequestCrmWorkspace.operatingProfileId,
    attemptId,
    occurredAt: iso(options.now || new Date()),
    status: "failed",
    failureCode: code,
    httpStatus: status,
    containsRequestPii: false
  };
}
