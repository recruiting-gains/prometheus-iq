import { createHash } from "node:crypto";

export const routeIqGymRequestVersion = "route-iq-gym-request.v1";
export const routeIqGymRequestFormId = "route_iq_gym_request";
export const routeIqGymRequestAcquisitionSource = "route_iq_website";
export const routeIqGymRequestAttributionFields = Object.freeze([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content"
]);
export const routeIqGymRequestCrmScope = Object.freeze({
  workspaceId: "prometheus_route_iq",
  operatingProfileId: "route_iq_commercial"
});
export const routeIqGymRequestInfrastructureAdapterContract = Object.freeze({
  module: "crm/route-iq-gym-intake.mjs",
  exportName: "adaptRouteIqGymRequestForCrm",
  signature: "adaptRouteIqGymRequestForCrm(publicPayload, { workspaceId, operatingProfileId }, { now })",
  inputVersion: routeIqGymRequestVersion,
  outputVersion: routeIqGymRequestVersion,
  derivesIdempotencyKey: true,
  persistsHoneypot: false,
  notificationEmailFields: Object.freeze(["receiptId", "submittedAt", "requestContractVersion"])
});

const publicPayloadKeys = Object.freeze([
  "version",
  "formId",
  "fullName",
  "gymName",
  "cityState",
  "outsideRepCount",
  "workEmail",
  "cell",
  "consent",
  "submittedAt",
  "acquisitionSource",
  "attribution",
  "websiteUrl"
]);
const internalInputKeys = Object.freeze([
  "contractVersion",
  "workspaceId",
  "operatingProfileId",
  "idempotencyKey",
  "formId",
  "fullName",
  "gymName",
  "cityState",
  "outsideRepCount",
  "workEmail",
  "cell",
  "consent",
  "submittedAt",
  "acquisitionSource",
  "attribution"
]);
const scopeKeys = Object.freeze(["workspaceId", "operatingProfileId"]);
const optionsKeys = Object.freeze(["now"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const phonePattern = /^\+?[0-9][0-9 ()-]{6,23}$/u;
const idempotencyPattern = /^route_iq_gym_request_[a-f0-9]{64}$/u;
const canonicalTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const hostileTextPattern = /(?:<|>|javascript\s*:|data\s*:\s*text\/html|\$\{|\{\{|\}\}|on[a-z]+\s*=)/iu;
const spreadsheetFormulaPattern = /^[=+\-@]/u;
const queryInjectionPattern = /(?:--|\/\*|\*\/|\bunion\s+select\b|;\s*(?:select|insert|update|delete|drop|alter|create)\b)/iu;
const secretLikePattern = /(?:-----BEGIN [A-Z ]+PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~-]+|\b(?:api[_ -]?key|access[_ -]?token|auth(?:orization)?|client[_ -]?secret|credential|password|private[_ -]?key|secret|session[_ -]?token)\b|(?:^|[^A-Za-z0-9])(?:sk[-_](?:live|test|proj|svcacct)[-_]|rk_live_|gh[pousr]_|glpat-|xox[baprs]-|npm_|pypi-|cfut_)[A-Za-z0-9_-]{8,}|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\bAIza[A-Za-z0-9_-]{20,}\b|eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})/iu;
const maxSubmissionAgeMs = 24 * 60 * 60 * 1000;
const maxFutureSkewMs = 5 * 60 * 1000;

export class RouteIqGymRequestContractError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.name = "RouteIqGymRequestContractError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, message, status) {
  throw new RouteIqGymRequestContractError(code, message, status);
}

function exactObject(value, keys, code, { requireAll = true } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(code, "Gym request contract shape is invalid.");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(code, "Gym request contract shape is invalid.");
  }
  const actual = Object.keys(value);
  if (actual.some(key => !keys.includes(key)) || (requireAll && keys.some(key => !actual.includes(key)))) {
    fail(code, "Gym request contract shape is invalid.");
  }
}

function text(value, field, min, max) {
  if (typeof value !== "string") fail("route_iq_request_gym_field_invalid", `${field} must be text.`);
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (normalized.length < min
    || normalized.length > max
    || /[\u0000-\u001F\u007F]/u.test(normalized)
    || hostileTextPattern.test(normalized)) {
    fail("route_iq_request_gym_field_invalid", `${field} is invalid.`);
  }
  return normalized;
}

function governedText(value, field, min, max) {
  const normalized = text(value, field, min, max);
  if (spreadsheetFormulaPattern.test(normalized) || queryInjectionPattern.test(normalized)) {
    fail("route_iq_request_gym_field_invalid", `${field} is invalid.`);
  }
  return normalized;
}

function canonicalTimestamp(value) {
  if (typeof value !== "string" || !canonicalTimestampPattern.test(value)) {
    fail("route_iq_request_gym_submission_time_invalid", "submittedAt must be a canonical UTC timestamp.");
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    fail("route_iq_request_gym_submission_time_invalid", "submittedAt must be a canonical UTC timestamp.");
  }
  return value;
}

function normalizedNow(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    fail("route_iq_request_gym_server_time_invalid", "Gym request server time is invalid.", 500);
  }
  return date;
}

function normalizeAttribution(value) {
  exactObject(value, routeIqGymRequestAttributionFields, "route_iq_request_gym_attribution_invalid", {
    requireAll: false
  });
  const normalized = {};
  for (const field of routeIqGymRequestAttributionFields) {
    if (!Object.hasOwn(value, field)) continue;
    if (typeof value[field] === "string" && value[field].trim() === "") continue;
    const candidate = governedText(value[field], field, 1, 120);
    if (secretLikePattern.test(candidate)) {
      fail("route_iq_request_gym_attribution_secret_rejected", "Gym request attribution is not safe to retain.");
    }
    normalized[field] = candidate;
  }
  return Object.freeze(normalized);
}

function normalizeScope(value) {
  exactObject(value, scopeKeys, "route_iq_request_gym_scope_invalid");
  if (value.workspaceId !== routeIqGymRequestCrmScope.workspaceId
    || value.operatingProfileId !== routeIqGymRequestCrmScope.operatingProfileId) {
    fail("route_iq_request_gym_scope_unauthorized", "Gym request workspace or operating profile is not authorized.", 403);
  }
  return routeIqGymRequestCrmScope;
}

function normalizeCommon(input) {
  if (input.contractVersion !== routeIqGymRequestVersion || input.formId !== routeIqGymRequestFormId) {
    fail("route_iq_request_gym_contract_invalid", "Gym request contract version or form is unsupported.");
  }
  if (input.acquisitionSource !== routeIqGymRequestAcquisitionSource) {
    fail("route_iq_request_gym_acquisition_source_invalid", "Gym request acquisition source is unsupported.");
  }
  if (input.consent !== true) fail("route_iq_request_gym_consent_required", "Explicit consent is required.");
  if (!Number.isSafeInteger(input.outsideRepCount) || input.outsideRepCount < 1 || input.outsideRepCount > 10) {
    fail("route_iq_request_gym_rep_count_invalid", "outsideRepCount must be an integer from 1 through 10.");
  }

  const workEmail = text(input.workEmail, "workEmail", 3, 254).toLowerCase();
  if (!emailPattern.test(workEmail)) fail("route_iq_request_gym_email_invalid", "workEmail is invalid.");
  const cell = text(input.cell, "cell", 7, 24);
  const cellDigits = cell.replace(/\D/gu, "");
  if (!phonePattern.test(cell) || cellDigits.length < 7 || cellDigits.length > 15) {
    fail("route_iq_request_gym_cell_invalid", "cell is invalid.");
  }

  return Object.freeze({
    contractVersion: routeIqGymRequestVersion,
    formId: routeIqGymRequestFormId,
    fullName: governedText(input.fullName, "fullName", 2, 120),
    gymName: governedText(input.gymName, "gymName", 2, 160),
    cityState: governedText(input.cityState, "cityState", 3, 160),
    outsideRepCount: input.outsideRepCount,
    workEmail,
    cell,
    consent: true,
    submittedAt: canonicalTimestamp(input.submittedAt),
    acquisitionSource: routeIqGymRequestAcquisitionSource,
    attribution: normalizeAttribution(input.attribution)
  });
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function normalizeRouteIqGymRequestCrmInput(input = {}) {
  exactObject(input, internalInputKeys, "route_iq_request_gym_internal_shape_invalid");
  const scope = normalizeScope({
    workspaceId: input.workspaceId,
    operatingProfileId: input.operatingProfileId
  });
  if (typeof input.idempotencyKey !== "string" || !idempotencyPattern.test(input.idempotencyKey)) {
    fail("route_iq_request_gym_idempotency_invalid", "Gym request idempotency identity is invalid.");
  }
  const common = normalizeCommon(input);
  return Object.freeze({
    contractVersion: routeIqGymRequestVersion,
    workspaceId: scope.workspaceId,
    operatingProfileId: scope.operatingProfileId,
    idempotencyKey: input.idempotencyKey,
    formId: common.formId,
    fullName: common.fullName,
    gymName: common.gymName,
    cityState: common.cityState,
    outsideRepCount: common.outsideRepCount,
    workEmail: common.workEmail,
    cell: common.cell,
    consent: true,
    submittedAt: common.submittedAt,
    acquisitionSource: common.acquisitionSource,
    attribution: common.attribution
  });
}

export function adaptRouteIqGymRequestForCrm(publicPayload = {}, scope = {}, options = {}) {
  exactObject(publicPayload, publicPayloadKeys, "route_iq_request_gym_public_shape_invalid");
  exactObject(options, optionsKeys, "route_iq_request_gym_options_invalid", { requireAll: false });
  const normalizedScope = normalizeScope(scope);
  if (publicPayload.version !== routeIqGymRequestVersion) {
    fail("route_iq_request_gym_contract_invalid", "Gym request contract version is unsupported.");
  }
  if (publicPayload.websiteUrl !== "") {
    fail("route_iq_request_gym_spam_rejected", "Gym request could not be accepted.", 400);
  }
  const common = normalizeCommon({
    ...publicPayload,
    contractVersion: publicPayload.version
  });
  const now = normalizedNow(options.now ?? new Date());
  const submittedAt = new Date(common.submittedAt);
  if (submittedAt.getTime() < now.getTime() - maxSubmissionAgeMs
    || submittedAt.getTime() > now.getTime() + maxFutureSkewMs) {
    fail("route_iq_request_gym_submission_time_invalid", "Gym request submission time is outside the accepted window.");
  }

  const content = {
    contractVersion: routeIqGymRequestVersion,
    workspaceId: normalizedScope.workspaceId,
    operatingProfileId: normalizedScope.operatingProfileId,
    formId: common.formId,
    fullName: common.fullName,
    gymName: common.gymName,
    cityState: common.cityState,
    outsideRepCount: common.outsideRepCount,
    workEmail: common.workEmail,
    cell: common.cell,
    consent: true,
    submittedAt: common.submittedAt,
    acquisitionSource: common.acquisitionSource,
    attribution: common.attribution
  };
  return normalizeRouteIqGymRequestCrmInput({
    ...content,
    idempotencyKey: `route_iq_gym_request_${digest(stableJson(content))}`
  });
}
