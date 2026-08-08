import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  verifyFullSystemHarmonyProtectedSuccessor,
  verifyLiveCanonicalIdentityProtectedSuccessor
} from "./verify-cross-industry-zip-founder-access-v1.mjs";

const root = resolve(import.meta.dirname, "../..");

export const paidCustomerRevenueReadinessProtectedConsumersPath =
  "intelligence/provenance/protected-consumer-synchronization-paid-customer-revenue-readiness-v1.json";

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function read(path) {
  return readFileSync(resolve(root, path));
}

function identity(ownerSubsystem) {
  if (ownerSubsystem === "Prometheus Dashboard") {
    return "Prometheus Dashboard <dashboard@prometheus.local>";
  }
  if (ownerSubsystem === "Prometheus Infrastructure") {
    return "Prometheus Infrastructure <infrastructure@prometheus.local>";
  }
  throw new Error(`Unsupported protected-consumer owner: ${ownerSubsystem}`);
}

function git(args, encoding = null) {
  return execFileSync("/usr/bin/git", args, {
    cwd: root,
    encoding,
    maxBuffer: 20 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"]
  });
}

export function verifyPaidCustomerRevenueReadinessProtectedConsumers({
  evidence: suppliedEvidence,
  currentSha256ByPath = {}
} = {}) {
  const evidence = suppliedEvidence || JSON.parse(read(paidCustomerRevenueReadinessProtectedConsumersPath));
  const composeCurrentSuccessor =
    suppliedEvidence === undefined && Object.keys(currentSha256ByPath).length === 0;
  assert.equal(
    evidence.version,
    "route-iq-intelligence-paid-customer-revenue-readiness-protected-consumers-v1"
  );
  assert.equal(evidence.status, "OWNER_REVIEWED_PROTECTED_CONSUMER_SUCCESSOR");
  assert.equal(evidence.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(sha256Bytes(read(evidence.predecessor.path)), evidence.predecessor.sha256);
  assert.equal(evidence.predecessor.remainsHistorical, true);
  assert.equal(evidence.predecessor.rewritten, false);
  assert.equal(evidence.protectedConsumers.length, 2);

  const consumerByPath = new Map();
  for (const consumer of evidence.protectedConsumers) {
    assert.ok(!consumerByPath.has(consumer.path), `Duplicate protected consumer: ${consumer.path}`);
    assert.equal(consumer.transitions[0].previousSha256, consumer.previousSha256);
    assert.equal(consumer.transitions.at(-1).currentSha256, consumer.currentSha256);
    for (let index = 0; index < consumer.transitions.length; index += 1) {
      const transition = consumer.transitions[index];
      if (index > 0) {
        assert.equal(transition.previousSha256, consumer.transitions[index - 1].currentSha256);
      }
      const expectedIdentity = identity(transition.ownerSubsystem);
      assert.deepEqual(
        git([
          "show", "-s", "--format=%H%n%T%n%an <%ae>%n%cn <%ce>%n%s", transition.commit
        ], "utf8").trim().split("\n"),
        [
          transition.commit,
          transition.tree,
          expectedIdentity,
          expectedIdentity,
          transition.subject
        ]
      );
      assert.equal(
        sha256Bytes(git(["show", `${transition.commit}^:${consumer.path}`])),
        transition.previousSha256
      );
      assert.equal(
        sha256Bytes(git(["show", `${transition.commit}:${consumer.path}`])),
        transition.currentSha256
      );
    }
    consumerByPath.set(consumer.path, consumer);
  }
  assert.deepEqual(
    [...consumerByPath.keys()].sort(),
    ["deploy/cloudflare-pages/index.html", "index.html"]
  );
  assert.equal(
    consumerByPath.get("index.html").currentSha256,
    consumerByPath.get("deploy/cloudflare-pages/index.html").currentSha256
  );
  assert.deepEqual(evidence.invariants, {
    historicalBaselineRewritten: false,
    sourceDeployParityRequired: true,
    intelligenceRuntimeChanged: false,
    routeOrderingChanged: false,
    routeScoringChanged: false,
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    representativeShadowOutputExposed: false
  });

  if (!composeCurrentSuccessor) {
    for (const consumer of consumerByPath.values()) {
      const currentSha256 = currentSha256ByPath[consumer.path] || sha256Bytes(read(consumer.path));
      assert.equal(currentSha256, consumer.currentSha256, `Protected consumer drifted: ${consumer.path}`);
    }
    return Object.freeze({ evidence, consumerByPath });
  }

  const fullSystemHarmonySuccessor = verifyFullSystemHarmonyProtectedSuccessor();
  const liveCanonicalIdentityProtectedSuccessor =
    verifyLiveCanonicalIdentityProtectedSuccessor();
  const composedConsumerByPath = new Map();
  for (const consumer of consumerByPath.values()) {
    const transitions =
      liveCanonicalIdentityProtectedSuccessor.transitionsByPath.get(consumer.path);
    assert.ok(transitions, `Missing current protected-consumer successor: ${consumer.path}`);
    assert.deepEqual(
      transitions.slice(0, consumer.transitions.length).map(({
        ownerSubsystem,
        commit,
        tree,
        subject,
        previousSha256,
        currentSha256
      }) => ({
        ownerSubsystem,
        commit,
        tree,
        subject,
        previousSha256,
        currentSha256
      })),
      consumer.transitions,
      `Historical protected-consumer transition changed: ${consumer.path}`
    );
    const currentSha256 = transitions.at(-1).currentSha256;
    assert.equal(
      sha256Bytes(read(consumer.path)),
      currentSha256,
      `Protected consumer drifted: ${consumer.path}`
    );
    composedConsumerByPath.set(consumer.path, Object.freeze({
      ...consumer,
      currentSha256,
      transitions: Object.freeze([...transitions])
    }));
  }
  return Object.freeze({
    evidence,
    consumerByPath: composedConsumerByPath,
    fullSystemHarmonySuccessor,
    liveCanonicalIdentityProtectedSuccessor
  });
}
