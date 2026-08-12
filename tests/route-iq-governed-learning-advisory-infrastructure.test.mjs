import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SignJWT, createLocalJWKSet, exportJWK } from "jose";

import canonicalArtifact from "../intelligence/artifacts/route-iq-governed-multi-session-learning-v1/fitness_connection/cruz/governed-learning-artifact-v1.json" with { type: "json" };
import {
  validateGovernedLearningAdvisoryEnvelope
} from "../dashboard/route-iq-dashboard-platform.mjs";
import {
  ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV,
  handlePrometheusIqWorkerRequest
} from "../workers/prometheus-iq-worker.js";
import {
  ROUTE_IQ_GOVERNED_LEARNING_ADVISORY_PATH,
  handleRouteIqGovernedLearningAdvisoryRequest,
  validateRouteIqGovernedLearningArtifact
} from "../workers/infrastructure/route-iq-governed-learning-advisory-runtime.js";

const now = new Date("2026-08-12T12:00:00.000Z");
const issuer = "https://prometheus-test.cloudflareaccess.com";
const audience = "route-iq-governed-learning-test-audience";
const founderSubject = "immutable-cloudflare-access-subject-cruz";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = await exportJWK(publicKey);
publicJwk.alg = "RS256";
publicJwk.use = "sig";
publicJwk.kid = "route-iq-governed-learning-test-key";
const keyResolver = createLocalJWKSet({ keys: [publicJwk] });

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function subjectSha256(subject) {
  return createHash("sha256").update(subject).digest("hex");
}

function enabledEnv() {
  return {
    [ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.enabled]: "ON",
    [ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.workerName]: "prometheus-iq",
    [ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.accessAudience]: audience,
    [ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.accessTeamDomain]: issuer,
    [ROUTE_IQ_FOUNDER_DAILY_SNAPSHOT_ENV.founderSubjectSha256]: subjectSha256(founderSubject)
  };
}

async function token(subject = founderSubject) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: publicJwk.kid })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt(Math.floor(now.getTime() / 1000) - 10)
    .setExpirationTime(Math.floor(now.getTime() / 1000) + 300)
    .sign(privateKey);
}

function request({ method = "GET", search = "", accessToken } = {}) {
  return new Request(
    `https://prometheus-iq.example${ROUTE_IQ_GOVERNED_LEARNING_ADVISORY_PATH}${search}`,
    {
      method,
      headers: accessToken ? { "Cf-Access-Jwt-Assertion": accessToken } : {}
    }
  );
}

function founderPrincipal(overrides = {}) {
  return {
    identityContextSource: "server_verified_identity_mapping",
    authenticationAuthority: "cloudflare_access",
    authenticated: true,
    callerSupplied: false,
    role: "founder",
    mappingId: "route-iq-founder-access-cruz-v1",
    immutablePrincipalId: "riq_principal_test",
    mappingStatus: "securely_mapped",
    ...overrides
  };
}

function workspace(overrides = {}) {
  return {
    workspaceId: "fitness_connection",
    operatingProfileId: "fitness",
    ...overrides
  };
}

function dashboardSession() {
  return {
    contractVersion: "route-iq-customer-pwa-session-v2",
    authorizationState: "server_verified",
    workspaceId: "fitness_connection",
    workspaceLabel: "Founder research",
    operatingProfileId: "fitness",
    principalRole: "founder",
    userId: "user_cruz_founder",
    representativeId: "representative_cruz_founder",
    displayName: "Founder",
    roleId: "fitness_founder_research_operator",
    capabilities: {
      operateOwnRoute: true,
      readWorkspaceOperations: true,
      administerWorkspaceRoster: false,
      founderIntelligence: true,
      founderCrm: false
    },
    runtimeAssets: {
      workspaceConfiguration: "/administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json",
      businessManifestRegistry: "/data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json",
      businessRoster: "/data/route-iq-commercial-readiness-v1/validation/fitness-approved-roster.json",
      businessHours: "/data/fixtures/fitness-business-hours.json"
    },
    expiresAt: "2026-08-12T13:00:00.000Z",
    safety: {
      prospectiveCollection: "OFF",
      activeCohorts: 0,
      recommendationInfluence: "OFF"
    }
  };
}

test("Infrastructure serves the exact Founder-only artifact as no-store advisory output", async () => {
  const response = await handleRouteIqGovernedLearningAdvisoryRequest(request(), {
    founderPrincipal: founderPrincipal(),
    workspace: workspace(),
    now
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  const body = await response.json();
  assert.equal(body.scope.workspaceId, "fitness_connection");
  assert.equal(body.scope.customerId, "fitness_connection_research");
  assert.equal(body.scope.representativeId, "cruz");
  assert.equal(body.scope.authority, "server_resolved");
  assert.equal(body.artifact.artifactSha256, canonicalArtifact.artifactSha256);
  assert.equal(body.advisory.confidence.propagation, "OFF");
  assert.equal(body.advisory.safety.recommendationInfluence, "OFF");
  assert.equal(/shadow|candidate|probabilit|brier|\bECE\b/iu.test(JSON.stringify(body)), false);
  assert.doesNotThrow(() => validateGovernedLearningAdvisoryEnvelope(body, {
    session: dashboardSession(),
    expectedCustomerId: "fitness_connection_research",
    now
  }));
});

test("Infrastructure validates the complete immutable artifact and retention boundary", async () => {
  const result = await validateRouteIqGovernedLearningArtifact(canonicalArtifact, {
    workspace: workspace(),
    now
  });
  assert.equal(result.artifact.artifactId, canonicalArtifact.artifactId);
  assert.equal(result.expiresAt, "2028-01-12T00:36:02.000Z");

  const tampered = clone(canonicalArtifact);
  tampered.dashboardAdvisory.evidenceMaturity.visitsAdmitted = 400;
  await assert.rejects(() => validateRouteIqGovernedLearningArtifact(tampered, {
    workspace: workspace(),
    now
  }), /artifact_hash_invalid/u);

  await assert.rejects(() => validateRouteIqGovernedLearningArtifact(canonicalArtifact, {
    workspace: workspace({ workspaceId: "northstar_outside_sales_synthetic" }),
    now
  }), /artifact_invalid/u);
});

test("Infrastructure rejects writes, query authority, malformed bodies, and non-Founder principals", async () => {
  const write = await handleRouteIqGovernedLearningAdvisoryRequest(request({ method: "POST" }), {
    founderPrincipal: founderPrincipal(),
    workspace: workspace(),
    now
  });
  assert.equal(write.status, 405);
  assert.equal(write.headers.get("Allow"), "GET");

  const query = await handleRouteIqGovernedLearningAdvisoryRequest(request({
    search: "?customer_id=fitness_connection_research&representative_id=cruz"
  }), {
    founderPrincipal: founderPrincipal(),
    workspace: workspace(),
    now
  });
  assert.equal(query.status, 404);

  for (const principal of [
    founderPrincipal({ role: "representative" }),
    founderPrincipal({ callerSupplied: true }),
    founderPrincipal({ mappingStatus: "unmapped" })
  ]) {
    const denied = await handleRouteIqGovernedLearningAdvisoryRequest(request(), {
      founderPrincipal: principal,
      workspace: workspace(),
      now
    });
    assert.equal(denied.status, 404);
  }
});

test("Private Worker integration reuses exact Cloudflare Access JWT and Aegis boundaries", async () => {
  const response = await handlePrometheusIqWorkerRequest(
    request({ accessToken: await token() }),
    enabledEnv(),
    { waitUntil() {} },
    {
      governedLearningAdvisoryTestHooks: {
        now,
        founderAuthentication: {
          enabled: true,
          currentDate: now,
          keyResolver
        }
      }
    }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Aegis-Route-Policy"), "public_api");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal((await response.json()).scope.customerId, "fitness_connection_research");

  const unmapped = await handlePrometheusIqWorkerRequest(
    request({ accessToken: await token("unmapped-principal") }),
    enabledEnv(),
    { waitUntil() {} },
    {
      governedLearningAdvisoryTestHooks: {
        now,
        founderAuthentication: {
          enabled: true,
          currentDate: now,
          keyResolver
        }
      }
    }
  );
  assert.equal(unmapped.status, 404);
  assert.deepEqual(await unmapped.json(), {
    ok: false,
    code: "route_iq_governed_learning_unavailable"
  });
});

test("Public Worker and ordinary archive ingestion do not import the advisory runtime", () => {
  const publicWorker = readFileSync(
    new URL("../workers/infrastructure/prometheusrouteiq-website-entry.mjs", import.meta.url),
    "utf8"
  );
  const archiveRuntime = readFileSync(
    new URL("../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(publicWorker, /governed-learning-advisory/u);
  assert.doesNotMatch(archiveRuntime, /governed-learning-advisory|delete-capable/u);
  assert.equal(canonicalArtifact.safety.productionRuntimeActivated, false);
  assert.equal(canonicalArtifact.safety.sourceArchiveMutationPerformed, false);
});
