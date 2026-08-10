import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createCloudflareKvFieldSessionStore,
  routeIqFieldSessionStoreBinding
} from "../data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs";
import {
  routeIqRetentionMaintenanceCapabilityVersion
} from "../data/route-iq-field-sessions-v1/route-iq-retention-deletion-runtime.mjs";
import {
  RouteIqRetentionMaintenanceInfrastructureError,
  createRouteIqRetentionMaintenanceStore,
  routeIqRetentionLegalHoldLedgerBinding,
  routeIqRetentionMaintenanceAdmissionProducerBinding,
  routeIqRetentionMaintenanceRuntimeContractVersion,
  routeIqRetentionMaintenanceStoreBinding,
  validateRouteIqRetentionMaintenanceBindings
} from "../workers/infrastructure/route-iq-retention-maintenance-runtime.js";
import {
  RouteIqRetentionMaintenanceAdmissionError,
  requestRouteIqRetentionMaintenanceProductionAdmission,
  routeIqRetentionMaintenanceProductionAdmissionPurpose,
  routeIqRetentionMaintenanceProductionAdmissionVersion,
  verifyRouteIqRetentionMaintenanceProductionAdmission
} from "../workers/infrastructure/route-iq-retention-maintenance-production-admission.js";
import {
  buildRouteIqRetentionMaintenanceReleasePackage,
  dryRunRouteIqRetentionMaintenanceReleasePackage
} from "../workers/infrastructure/route-iq-retention-maintenance-release-package.mjs";
import {
  createRouteIqProspectiveAuthorityEnvelope
} from "../workers/infrastructure/route-iq-prospective-shadow-authority.js";

const AUTHORITY_ENV = Object.freeze({
  ROUTE_IQ_PROSPECTIVE_SHADOW_AUTHORITY_KEY: "route-iq-retention-maintenance-test-authority-key-material-v1",
  ROUTE_IQ_PROSPECTIVE_SHADOW_AUTHORITY_KEY_VERSION: "retention-maintenance-test-v1"
});
const ISSUED_AT = "2026-08-09T18:00:00.000Z";
const EXPIRES_AT = "2026-08-09T18:04:00.000Z";
const VERIFY_AT = "2026-08-09T18:01:00.000Z";

function binding({ deleteCapable = false } = {}) {
  const data = new Map();
  const value = {
    get(key) {
      return Promise.resolve(data.get(key) ?? null);
    },
    put(key, entry) {
      data.set(key, String(entry));
      return Promise.resolve();
    },
    list() {
      return Promise.resolve({
        keys: [...data.keys()].map(name => ({ name })),
        list_complete: true
      });
    }
  };
  if (deleteCapable) {
    value.delete = key => {
      data.delete(key);
      return Promise.resolve();
    };
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function releasePackage() {
  return buildRouteIqRetentionMaintenanceReleasePackage({ sourceRef: "WORKTREE" });
}

function admissionExpected(packageResult = releasePackage()) {
  return {
    environment: "production_private",
    release: {
      commit: "a".repeat(40),
      tree: "b".repeat(40),
      privateWorker: "prometheus-iq",
      privateWorkerVersion: "11111111-2222-4333-8444-555555555555"
    },
    bindings: {
      ordinaryArchive: {
        name: routeIqFieldSessionStoreBinding,
        capabilityIdentitySha256: "1".repeat(64),
        storageLineageSha256: "5".repeat(64),
        deleteCapabilityExposed: false
      },
      maintenance: {
        name: routeIqRetentionMaintenanceStoreBinding,
        capabilityIdentitySha256: "2".repeat(64),
        storageLineageSha256: "5".repeat(64),
        deleteCapabilityExposed: true
      },
      legalHoldLedger: {
        name: routeIqRetentionLegalHoldLedgerBinding,
        capabilityIdentitySha256: "3".repeat(64)
      },
      admissionProducer: {
        name: routeIqRetentionMaintenanceAdmissionProducerBinding,
        capabilityIdentitySha256: "4".repeat(64)
      }
    },
    legalHold: {
      state: "AUTHORITATIVE_PRODUCTION_AVAILABLE",
      environment: "production_private",
      verifiedAt: ISSUED_AT,
      availabilityEvidenceSha256: "6".repeat(64),
      fixtureStateAccepted: false
    },
    protectedState: {
      collection: "OFF",
      activeCohorts: 0,
      recommendationInfluence: "OFF",
      providers: "OFF",
      scheduler: "OFF"
    },
    runtimeBoundary: {
      publicRouteConfigured: false,
      dashboardControlConfigured: false,
      genericAdministrationControlConfigured: false,
      cronConfigured: false,
      alarmConfigured: false,
      queueConsumerConfigured: false,
      automaticDeletionConfigured: false
    },
    artifactHashes: {
      releaseArtifactSha256: packageResult.identities.artifactSha256,
      releaseManifestSha256: packageResult.identities.manifestSha256,
      releaseConfigurationSha256: packageResult.identities.configurationSha256,
      releaseContentSha256: packageResult.identities.contentSha256,
      maintenanceRuntimeSha256: packageResult.identities.maintenanceRuntimeSha256,
      retentionPolicySha256: packageResult.identities.retentionPolicySha256,
      deletionRuntimeSha256: packageResult.identities.deletionRuntimeSha256,
      forwardRollbackSha256: packageResult.identities.forwardRollbackSha256
    },
    authorization: {
      deploymentAuthorityGranted: false,
      deletionAuthorityGranted: false,
      dryRunAuthorityReusable: false
    }
  };
}

function admissionClaims(expected, overrides = {}) {
  return {
    purpose: routeIqRetentionMaintenanceProductionAdmissionPurpose,
    admissionVersion: routeIqRetentionMaintenanceProductionAdmissionVersion,
    admissionReference: "7".repeat(64),
    issuedAt: ISSUED_AT,
    expiresAt: EXPIRES_AT,
    ...structuredClone(expected),
    ...structuredClone(overrides)
  };
}

async function signedAdmission(claims) {
  return createRouteIqProspectiveAuthorityEnvelope(claims, AUTHORITY_ENV, {
    channel: "producer"
  });
}

function replayGuard() {
  const seen = new Map();
  return {
    async consume({ admissionReference, evidenceSha256, expiresAt }) {
      if (seen.has(admissionReference)) return false;
      seen.set(admissionReference, { evidenceSha256, expiresAt });
      return true;
    }
  };
}

test("ordinary archive ingestion remains valid without a delete-capable maintenance binding", () => {
  const ordinary = binding();
  const store = createCloudflareKvFieldSessionStore({
    [routeIqFieldSessionStoreBinding]: ordinary
  });
  assert.equal(typeof store.get, "function");
  assert.equal(typeof store.put, "function");
  assert.equal(typeof store.list, "function");
  assert.equal(typeof store.delete, "undefined");
});

test("maintenance capability requires an exact separate delete-capable binding", async () => {
  const ordinary = binding();
  const maintenance = binding({ deleteCapable: true });
  const env = {
    [routeIqFieldSessionStoreBinding]: ordinary,
    [routeIqRetentionMaintenanceStoreBinding]: maintenance
  };
  const validation = validateRouteIqRetentionMaintenanceBindings(env);
  assert.equal(validation.ok, true);
  assert.equal(validation.contractVersion, routeIqRetentionMaintenanceRuntimeContractVersion);
  assert.equal(validation.schedulerConfigured, false);
  assert.equal(validation.routeConfigured, false);
  assert.equal(validation.productionDeploymentAuthorized, false);
  assert.equal(validation.ordinaryDeleteCapabilityExposed, false);
  assert.equal(validation.maintenanceDeleteCapabilityExposed, true);
  const store = createRouteIqRetentionMaintenanceStore(env);
  assert.equal(store.retentionMaintenanceCapability, routeIqRetentionMaintenanceCapabilityVersion);
  await store.put("fixture", "value");
  assert.equal(await store.get("fixture"), "value");
  await store.delete("fixture");
  assert.equal(await store.get("fixture"), null);
});

test("same-binding, missing-delete, and missing-maintenance configurations fail closed", () => {
  const ordinary = binding();
  for (const env of [
    { [routeIqFieldSessionStoreBinding]: ordinary },
    {
      [routeIqFieldSessionStoreBinding]: ordinary,
      [routeIqRetentionMaintenanceStoreBinding]: ordinary
    },
    {
      [routeIqFieldSessionStoreBinding]: ordinary,
      [routeIqRetentionMaintenanceStoreBinding]: binding()
    }
  ]) {
    assert.throws(
      () => createRouteIqRetentionMaintenanceStore(env),
      error => error instanceof RouteIqRetentionMaintenanceInfrastructureError
    );
  }
});

test("the dormant Infrastructure boundary exposes no route, scheduler, alarm, queue, or deployment mutation", () => {
  const source = readFileSync("workers/infrastructure/route-iq-retention-maintenance-runtime.js", "utf8");
  const contract = JSON.parse(readFileSync(
    "workers/infrastructure/route-iq-retention-maintenance-runtime-v1.json",
    "utf8"
  ));
  assert.doesNotMatch(source, /\bfetch\s*\(|\bscheduled\s*\(|\balarm\s*\(|\bqueue\s*\(/);
  assert.equal(contract.status, "source_complete_dormant_deployment_package_prepared_not_deployed");
  assert.equal(contract.maintenanceBinding.mustBeSeparateFromOrdinaryArchiveBinding, true);
  assert.equal(contract.activation.workerRouteConfigured, false);
  assert.equal(contract.activation.schedulerConfigured, false);
  assert.equal(contract.activation.productionBindingConfigured, false);
  assert.equal(contract.activation.productionDeploymentAuthorized, false);
  assert.equal(contract.activation.productionDeletionAuthorized, false);
  assert.equal(contract.surfaceExclusion.publicRouteConfigured, false);
  assert.equal(contract.surfaceExclusion.dashboardControlConfigured, false);
  assert.equal(contract.surfaceExclusion.genericAdministrationControlConfigured, false);
  assert.equal(contract.surfaceExclusion.automaticDeletionConfigured, false);
  assert.equal(contract.admissionProducerBinding.deletionAuthorityAvailable, false);
  assert.equal(contract.legalHoldLedgerBinding.defaultsToUnavailable, true);
  assert.deepEqual(contract.protectedState, {
    collection: "off",
    activeCohorts: 0,
    recommendationInfluence: "off",
    providers: "off",
    scheduler: "off"
  });
});

test("the forward-revert package is source-only and preserves historical evidence", () => {
  const contract = JSON.parse(readFileSync(
    "workers/infrastructure/route-iq-retention-maintenance-forward-revert-v1.json",
    "utf8"
  ));
  assert.equal(contract.contractVersion, "route-iq-retention-maintenance-forward-revert-v1");
  assert.equal(contract.owningSubsystem, "Prometheus Infrastructure");
  assert.equal(contract.forwardOnly, true);
  assert.equal(contract.historyRewriteAllowed, false);
  assert.equal(contract.deploymentPerformed, false);
  assert.equal(contract.productionRollbackRequired, false);
  assert.equal(contract.productionStorageMutationPerformed, false);
  assert.equal(contract.historicalEvidence.sessionSubtreeGitObject, "07485b3c4a14d56779e8b321e6c3410b970db2de");
  assert.equal(contract.historicalEvidence.sourceEvidenceSubtreeGitObject, "1f05b8a7b22ee28592959fd1ef8276861897cef2");
  assert.equal(contract.protectedState.collection, "OFF");
  assert.equal(contract.protectedState.activeCohorts, 0);
  assert.equal(contract.protectedState.recommendationInfluence, "OFF");
});

test("the dormant release package is deterministic and its dry run has zero production contact", () => {
  const first = releasePackage();
  const second = releasePackage();
  assert.deepEqual(first.identities, second.identities);
  assert.equal(first.manifest.cloudflareContactCount, 0);
  assert.equal(first.manifest.productionMutationCount, 0);
  assert.equal(first.manifest.deploymentAuthorized, false);
  assert.equal(first.manifest.deletionAuthorized, false);
  assert.equal(first.configuration.target.publicWorkerIncluded, false);
  assert.deepEqual(first.configuration.triggers, {
    scheduler: false,
    cron: false,
    alarm: false,
    queueConsumer: false,
    automaticDeletion: false
  });
  assert.deepEqual(first.configuration.exposure, {
    publicRoute: false,
    dashboardRoute: false,
    genericAdministrationRoute: false,
    representativeControl: false,
    customerControl: false
  });

  const dryRun = dryRunRouteIqRetentionMaintenanceReleasePackage({ sourceRef: "WORKTREE" });
  assert.equal(dryRun.ok, true);
  assert.equal(dryRun.cloudflareContactCount, 0);
  assert.equal(dryRun.productionMutationCount, 0);
  assert.equal(dryRun.deploymentAuthorized, false);
  assert.equal(dryRun.deletionAuthorized, false);
});

test("the deterministic release artifact can be materialized without Cloudflare or production access", () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "route-iq-retention-release-test-"));
  const outputDirectory = join(temporaryRoot, "artifact");
  try {
    const result = buildRouteIqRetentionMaintenanceReleasePackage({
      sourceRef: "WORKTREE",
      outputDirectory
    });
    const artifact = readFileSync(
      join(outputDirectory, "route-iq-retention-maintenance-artifact-v1.json"),
      "utf8"
    );
    const manifest = JSON.parse(readFileSync(
      join(outputDirectory, "route-iq-retention-maintenance-manifest-v1.json"),
      "utf8"
    ));
    assert.equal(JSON.parse(artifact).artifactSha256, result.identities.artifactSha256);
    assert.equal(manifest.manifestSha256, result.identities.manifestSha256);
    assert.equal(manifest.cloudflareContactCount, 0);
    assert.equal(manifest.productionMutationCount, 0);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("exact signed production admission binds release, Worker, binding lineage, legal hold, OFF states, and hashes", async () => {
  const expected = admissionExpected();
  const envelope = await signedAdmission(admissionClaims(expected));
  const producer = {
    async produceRetentionMaintenanceAdmission(request) {
      assert.equal(request.deploymentAuthorityRequested, false);
      assert.equal(request.deletionAuthorityRequested, false);
      assert.deepEqual(request.expected, expected);
      return envelope;
    }
  };
  const env = {
    ...AUTHORITY_ENV,
    [routeIqFieldSessionStoreBinding]: binding(),
    [routeIqRetentionMaintenanceStoreBinding]: binding({ deleteCapable: true }),
    [routeIqRetentionLegalHoldLedgerBinding]: {},
    [routeIqRetentionMaintenanceAdmissionProducerBinding]: producer
  };
  const result = await requestRouteIqRetentionMaintenanceProductionAdmission({
    env,
    expected,
    now: VERIFY_AT,
    replayGuard: replayGuard()
  });
  assert.equal(result.admitted, true);
  assert.equal(result.environment, "production_private");
  assert.equal(result.release.commit, expected.release.commit);
  assert.equal(result.release.tree, expected.release.tree);
  assert.equal(result.release.privateWorkerVersion, expected.release.privateWorkerVersion);
  assert.equal(result.deploymentAuthorityGranted, false);
  assert.equal(result.deletionAuthorityGranted, false);
});

test("unsigned, stale, replayed, and cross-environment admission evidence fails closed", async () => {
  const expected = admissionExpected();
  const claims = admissionClaims(expected);
  const envelope = await signedAdmission(claims);
  const guard = replayGuard();
  await verifyRouteIqRetentionMaintenanceProductionAdmission(envelope, {
    env: AUTHORITY_ENV,
    expected,
    now: VERIFY_AT,
    replayGuard: guard
  });
  await assert.rejects(
    verifyRouteIqRetentionMaintenanceProductionAdmission(envelope, {
      env: AUTHORITY_ENV,
      expected,
      now: VERIFY_AT,
      replayGuard: guard
    }),
    error => error instanceof RouteIqRetentionMaintenanceAdmissionError
      && error.code === "route_iq_retention_maintenance_admission_replayed"
  );

  const unsigned = { ...envelope, signature: `${envelope.signature.slice(0, -1)}x` };
  await assert.rejects(
    verifyRouteIqRetentionMaintenanceProductionAdmission(unsigned, {
      env: AUTHORITY_ENV,
      expected,
      now: VERIFY_AT,
      replayGuard: replayGuard()
    }),
    error => error.code === "route_iq_retention_maintenance_admission_signature_invalid"
  );

  const stale = await signedAdmission(admissionClaims(expected, {
    issuedAt: "2026-08-09T17:00:00.000Z",
    expiresAt: "2026-08-09T17:04:00.000Z",
    legalHold: {
      ...expected.legalHold,
      verifiedAt: "2026-08-09T17:00:00.000Z"
    }
  }));
  await assert.rejects(
    verifyRouteIqRetentionMaintenanceProductionAdmission(stale, {
      env: AUTHORITY_ENV,
      expected,
      now: VERIFY_AT,
      replayGuard: replayGuard()
    }),
    error => error.code === "route_iq_retention_maintenance_admission_stale"
  );

  const crossEnvironment = await signedAdmission(admissionClaims(expected, {
    environment: "staging_private",
    legalHold: { ...expected.legalHold, environment: "staging_private" }
  }));
  await assert.rejects(
    verifyRouteIqRetentionMaintenanceProductionAdmission(crossEnvironment, {
      env: AUTHORITY_ENV,
      expected,
      now: VERIFY_AT,
      replayGuard: replayGuard()
    }),
    error => error instanceof RouteIqRetentionMaintenanceAdmissionError
  );
});

test("legal-hold, binding, artifact, and authority drift fails closed without consuming deletion authority", async () => {
  const expected = admissionExpected();
  const cases = [
    {
      legalHold: { ...expected.legalHold, state: "UNAVAILABLE" }
    },
    {
      bindings: {
        ...expected.bindings,
        maintenance: {
          ...expected.bindings.maintenance,
          capabilityIdentitySha256: expected.bindings.ordinaryArchive.capabilityIdentitySha256
        }
      }
    },
    {
      artifactHashes: {
        ...expected.artifactHashes,
        deletionRuntimeSha256: "9".repeat(64)
      }
    },
    {
      authorization: {
        ...expected.authorization,
        deletionAuthorityGranted: true
      }
    }
  ];
  for (const overrides of cases) {
    const envelope = await signedAdmission(admissionClaims(expected, overrides));
    await assert.rejects(
      verifyRouteIqRetentionMaintenanceProductionAdmission(envelope, {
        env: AUTHORITY_ENV,
        expected,
        now: VERIFY_AT,
        replayGuard: replayGuard()
      }),
      error => error instanceof RouteIqRetentionMaintenanceAdmissionError
    );
  }
});

test("the production admission producer is mandatory, isolated, and cannot be substituted by a storage binding", async () => {
  const expected = admissionExpected();
  const shared = binding({ deleteCapable: true });
  for (const env of [
    AUTHORITY_ENV,
    {
      ...AUTHORITY_ENV,
      [routeIqFieldSessionStoreBinding]: shared,
      [routeIqRetentionMaintenanceStoreBinding]: binding({ deleteCapable: true }),
      [routeIqRetentionLegalHoldLedgerBinding]: {},
      [routeIqRetentionMaintenanceAdmissionProducerBinding]: shared
    }
  ]) {
    await assert.rejects(
      requestRouteIqRetentionMaintenanceProductionAdmission({
        env,
        expected,
        now: VERIFY_AT,
        replayGuard: replayGuard()
      }),
      error => error instanceof RouteIqRetentionMaintenanceAdmissionError
    );
  }
});

test("release and rollback contracts contain no route, trigger, production identity, or secret value", () => {
  const releaseSource = readFileSync(
    "workers/infrastructure/route-iq-retention-maintenance-release-package.mjs",
    "utf8"
  );
  const admissionSource = readFileSync(
    "workers/infrastructure/route-iq-retention-maintenance-production-admission.js",
    "utf8"
  );
  const releaseContract = JSON.parse(readFileSync(
    "workers/infrastructure/route-iq-retention-maintenance-release-package-v1.json",
    "utf8"
  ));
  const rollbackBytes = readFileSync(
    "workers/infrastructure/route-iq-retention-maintenance-forward-revert-v1.json"
  );
  assert.doesNotMatch(admissionSource, /\bfetch\s*\(|\bscheduled\s*\(|\balarm\s*\(|\bqueue\s*\(/u);
  assert.doesNotMatch(releaseSource, /https?:\/\/|CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID/u);
  assert.equal(releaseContract.exposure.publicRoute, false);
  assert.equal(releaseContract.exposure.dashboardRoute, false);
  assert.equal(releaseContract.automaticExecution.scheduler, false);
  assert.equal(releaseContract.automaticExecution.cron, false);
  assert.equal(releaseContract.automaticExecution.alarm, false);
  assert.equal(releaseContract.automaticExecution.queueConsumer, false);
  assert.equal(releaseContract.automaticExecution.automaticDeletion, false);
  assert.equal(releaseContract.dryRun.cloudflareContactCount, 0);
  assert.equal(releaseContract.dryRun.productionMutationCount, 0);
  assert.match(sha256(rollbackBytes), /^[a-f0-9]{64}$/u);
});
