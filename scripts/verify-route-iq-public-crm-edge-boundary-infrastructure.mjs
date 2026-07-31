#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "..");

export const ROUTE_IQ_PUBLIC_EDGE_BOUNDARY_POLICY = Object.freeze({
  version: "route-iq-public-crm-edge-boundary-infrastructure-v1",
  directive: "Route IQ Public CRM Complete Edge Boundary Repair v1",
  owner: "Prometheus Infrastructure",
  publicWorker: "prometheusrouteiq-website",
  publicConfigPath: "wrangler.prometheusrouteiq-website.jsonc",
  publicConfigSha256: "5b8e16a1e49172f20ef617d09e6e655b5ee453600b486fe5d216ebe5453b56f0",
  historicalPublicConfigSha256: "a93267b924c9cca22c891df5d037483e2ecf453de19d115730756444d354f23f",
  publicPreservedSemanticSha256: "615270da72eb4bc233163edaf3078c25502727e564f844e5264b878e0280b345",
  historicalPublicPreservedSemanticSha256:
    "85cf18ce15c23320ef5a647cb3436bddd463a0f9b046a1edd01a852238964351",
  historicalPublicEntryPath: "workers/prometheus-iq-worker.js",
  publicEntryPath: "workers/infrastructure/prometheusrouteiq-website-entry.mjs",
  publicEntrySha256: "045c768163e043b1429d51dacf33f842966a323eb080d0e1cf45debfc7ccebf5",
  publicEntryExports: Object.freeze(["default", "RouteIqRequestCrmCoordinator"]),
  privateWorker: "prometheus-iq",
  privateConfigPath: "wrangler.jsonc",
  privateConfigSha256: "b888732c12aa34d07f538d7ae112b6eb3f966c75d24839bac76d4e8ea6b9a835",
  contractPath: "workers/infrastructure/route-iq-public-crm-edge-boundary-v1.json",
  documentationPath: "docs/route-iq-public-crm-edge-boundary-infrastructure-v1.md",
  preservedPublicTopLevelKeys: Object.freeze([
    "$schema",
    "name",
    "main",
    "compatibility_date",
    "compatibility_flags",
    "assets",
    "observability",
    "durable_objects",
    "migrations",
    "vars",
    "kv_namespaces",
    "send_email"
  ])
});

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label}_invalid`);
  }
}

export function validateRouteIqPublicCrmEdgeBoundary({
  publicConfigText,
  privateConfigText,
  contractText,
  publicEntryText
}) {
  const publicConfig = parseJson(publicConfigText, "public_config");
  const contract = parseJson(contractText, "edge_boundary_contract");
  const { workers_dev: workersDev, preview_urls: previewUrls, ...preservedPublicConfig } = publicConfig;
  const preservedKeys = Object.keys(preservedPublicConfig);
  const policy = ROUTE_IQ_PUBLIC_EDGE_BOUNDARY_POLICY;

  assert.equal(contract.version, policy.version);
  assert.equal(contract.directive, policy.directive);
  assert.equal(contract.owner, policy.owner);
  assert.equal(contract.implementationStatus, "SOURCE_CONTROLS_IMPLEMENTED_NOT_DEPLOYED");
  assert.deepEqual(contract.target, {
    publicWorker: policy.publicWorker,
    publicConfig: policy.publicConfigPath,
    privateWorker: policy.privateWorker,
    privateConfig: policy.privateConfigPath,
    publicWorkerOnly: true,
    privateWorkerMutationAllowed: false
  });
  assert.deepEqual(contract.edgeExposure, {
    workersDev: false,
    previewUrls: false,
    sourceDeclarationRequired: true,
    cloudflareMutationPerformed: false
  });

  assert.equal(publicConfig.name, policy.publicWorker);
  assert.equal(publicConfig.main, policy.publicEntryPath);
  assert.equal(workersDev, false);
  assert.equal(previewUrls, false);
  assert.equal(sha256(publicConfigText), policy.publicConfigSha256);
  assert.equal(sha256(canonicalJson(preservedPublicConfig)), policy.publicPreservedSemanticSha256);
  assert.equal(
    sha256(canonicalJson({
      ...preservedPublicConfig,
      main: policy.historicalPublicEntryPath
    })),
    policy.historicalPublicPreservedSemanticSha256
  );
  assert.equal(sha256(publicEntryText), policy.publicEntrySha256);
  assert.deepEqual(preservedKeys, [...policy.preservedPublicTopLevelKeys]);
  assert.equal(sha256(privateConfigText), policy.privateConfigSha256);
  assert.equal(Object.hasOwn(publicConfig, "routes"), false);
  assert.deepEqual(publicConfig.durable_objects?.bindings, [{
    name: "ROUTE_IQ_REQUEST_CRM_COORDINATOR",
    class_name: "RouteIqRequestCrmCoordinator"
  }]);
  assert.deepEqual(publicConfig.migrations, [{
    tag: "route-iq-request-crm-sqlite-v1",
    new_sqlite_classes: ["RouteIqRequestCrmCoordinator"]
  }]);

  assert.equal(contract.preservation.publicConfigSha256, policy.publicConfigSha256);
  assert.equal(
    contract.preservation.historicalPublicConfigSha256,
    policy.historicalPublicConfigSha256
  );
  assert.equal(
    contract.preservation.publicConfigSemanticSha256ExcludingEdgeFlags,
    policy.publicPreservedSemanticSha256
  );
  assert.equal(
    contract.preservation.historicalPublicConfigSemanticSha256ExcludingEdgeFlags,
    policy.historicalPublicPreservedSemanticSha256
  );
  assert.deepEqual(contract.preservation.intendedConfigSuccessor, {
    changedTopLevelKeys: ["main"],
    historicalMain: policy.historicalPublicEntryPath,
    currentMain: policy.publicEntryPath,
    currentMainSha256: policy.publicEntrySha256,
    currentMainExports: [...policy.publicEntryExports]
  });
  assert.equal(contract.preservation.privateConfigSha256, policy.privateConfigSha256);
  assert.deepEqual(contract.preservation.preservedPublicTopLevelKeys, [...policy.preservedPublicTopLevelKeys]);
  for (const field of [
    "bindingsPreserved",
    "migrationsPreserved",
    "variablesPreserved",
    "assetsPreserved",
    "apexAndWwwCustomDomainsPreserved",
    "accessAndWafBoundariesPreserved",
    "publicPrivateIsolationPreserved"
  ]) {
    assert.equal(contract.preservation[field], true);
  }
  assert.deepEqual(contract.boundaries, {
    deploymentPerformed: false,
    publicWorkerConfigurationApplied: false,
    privateWorkerChanged: false,
    cloudflareContacted: false,
    githubContacted: false,
    credentialsAccessed: false,
    productionDataMutationPerformed: false
  });

  return Object.freeze({
    status: "ROUTE_IQ_PUBLIC_CRM_EDGE_BOUNDARY_INFRASTRUCTURE_VERIFIED",
    publicWorker: policy.publicWorker,
    privateWorker: policy.privateWorker
  });
}

export function verifyRouteIqPublicCrmEdgeBoundaryInfrastructure(repositoryRoot = root) {
  const policy = ROUTE_IQ_PUBLIC_EDGE_BOUNDARY_POLICY;
  const requiredPaths = [
    policy.publicConfigPath,
    policy.publicEntryPath,
    policy.privateConfigPath,
    policy.contractPath,
    policy.documentationPath,
    "scripts/verify-route-iq-public-crm-edge-boundary-infrastructure.mjs",
    "tests/route-iq-public-crm-edge-boundary-infrastructure.test.mjs"
  ];
  for (const path of requiredPaths) {
    assert.equal(existsSync(resolve(repositoryRoot, path)), true, `${path} must exist`);
  }
  const result = validateRouteIqPublicCrmEdgeBoundary({
    publicConfigText: readFileSync(resolve(repositoryRoot, policy.publicConfigPath), "utf8"),
    privateConfigText: readFileSync(resolve(repositoryRoot, policy.privateConfigPath), "utf8"),
    contractText: readFileSync(resolve(repositoryRoot, policy.contractPath), "utf8"),
    publicEntryText: readFileSync(resolve(repositoryRoot, policy.publicEntryPath), "utf8")
  });
  const documentation = readFileSync(resolve(repositoryRoot, policy.documentationPath), "utf8");
  assert.match(documentation, /workers_dev`:\s*`false`/u);
  assert.match(documentation, /preview_urls`:\s*`false`/u);
  assert.match(documentation, /public `prometheusrouteiq-website` Worker only/u);
  assert.match(documentation, /No deployment or Cloudflare mutation occurred/u);
  return result;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.stdout.write(`${verifyRouteIqPublicCrmEdgeBoundaryInfrastructure().status}\n`);
  } catch {
    process.stdout.write("FAIL\n");
    process.exitCode = 1;
  }
}
