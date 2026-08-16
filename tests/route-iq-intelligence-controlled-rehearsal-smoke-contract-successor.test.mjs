import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  controlledOnboardingRehearsalSmokeContractProvenancePath,
  crossIndustryZipFounderAccessProvenancePath,
  fieldSessionReportTypeContractProtectedSuccessorProvenancePath,
  fullSystemHarmonyProtectedSuccessorProvenancePath,
  liveCanonicalIdentityProtectedSuccessorProvenancePath,
  paidCustomerRevenueReadinessWorkerProvenancePath,
  verifyControlledOnboardingRehearsalSmokeContractSuccessor,
  verifyCrossIndustryZipFounderAccessAdoption,
  verifyFieldSessionReportTypeContractProtectedSuccessor,
  verifyRetentionDeletionRuntimeProtectedSuccessor,
  verifyFullSystemHarmonyProtectedSuccessor,
  verifyLiveCanonicalIdentityProtectedSuccessor,
  verifyPaidCustomerRevenueReadinessWorkerSuccessor
} from "../intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs";

const readJson = path => JSON.parse(readFileSync(path, "utf8"));

test("controlled rehearsal smoke-contract successor preserves historical evidence", () => {
  const historical = readJson(crossIndustryZipFounderAccessProvenancePath);
  const successor = readJson(
    controlledOnboardingRehearsalSmokeContractProvenancePath
  );
  const historicalContract =
    historical.protectedBaselineSuccessors
      .find(entry => entry.path === "workers/prometheus-iq-worker.js")
      .guardSuccessor;

  assert.equal(
    historicalContract.contractSha256,
    "aeae1e71674179b318dc41669d18f2dedc6ca7762802868820f672d5e0097db3"
  );
  assert.equal(successor.predecessor.rewritten, false);
  assert.equal(successor.predecessor.remainsHistorical, true);
  assert.equal(
    successor.protectedSourceTransitions[0].previousSha256,
    historicalContract.contractSha256
  );
  assert.equal(
    successor.protectedSourceTransitions[0].currentSha256,
    "ea28197db687ded60c2b87da87874e8615ea76a3333d68eea7d1395887215eb4"
  );
});

test("controlled rehearsal smoke-contract successor is exact-owner verified", () => {
  const verified = verifyControlledOnboardingRehearsalSmokeContractSuccessor();
  const transition = verified.transitionByPath.get(
    "workers/infrastructure/cloudflare-unattended-smoke-contract.js"
  );
  assert.equal(
    transition.commit,
    "96c8210b94c3b0214dede252aba3d6d46121cd05"
  );
  assert.equal(
    transition.currentSha256,
    "ea28197db687ded60c2b87da87874e8615ea76a3333d68eea7d1395887215eb4"
  );
});

test("shadow-readiness adoption composes the historical and current contract", () => {
  const adoption = verifyCrossIndustryZipFounderAccessAdoption();
  assert.equal(
    adoption.rehearsalSuccessor.transitionByPath
      .get("workers/infrastructure/cloudflare-unattended-smoke-contract.js")
      .previousSha256,
    adoption.adoption.protectedBaselineSuccessors
      .find(entry => entry.path === "workers/prometheus-iq-worker.js")
      .guardSuccessor.contractSha256
  );
  assert.equal(
    adoption.rehearsalSuccessor.transitionByPath
      .get("workers/infrastructure/cloudflare-unattended-smoke-contract.js")
      .currentSha256,
    "ea28197db687ded60c2b87da87874e8615ea76a3333d68eea7d1395887215eb4"
  );
});

test("shadow-readiness adoption composes the exact gym-preview runtime surface", () => {
  const adoption = verifyCrossIndustryZipFounderAccessAdoption();
  const routeQuality = adoption.transitionByPath.get(
    "scripts/lib/route-intelligence-quality-gate.mjs"
  );
  const gymTransition = routeQuality.transitions.find(transition =>
    transition.previousSha256 ===
      "7a37c1d2bfc3c07e38a0e706756c64f69718c9a7d36bd0b1eebc5717a7621468"
    && transition.currentSha256 ===
      "7bda35b46eb577dd89c6cd2617c70cb3c7a0b656faff168543c13db35a01c0b4"
  );
  assert.ok(gymTransition);
  assert.equal(
    routeQuality.currentSha256,
    "4e021bcfcfdac2ab0eb942f137a0f97cd120dcde882b258f772abda3b2a13aa1"
  );
  assert.equal(
    adoption.rehearsalSuccessor.gymPreviewRouteQualityRuntimeSurfaceSuccessor
      .successor.behavior.currentRuntimeFileCount,
    34
  );
  assert.equal(
    adoption.rehearsalSuccessor.gymPreviewRouteQualityRuntimeSurfaceSuccessor
      .successor.behavior.routeScoringChanged,
    false
  );
  assert.equal(
    adoption.rehearsalSuccessor.representativeIntelligenceRuntimeSurfaceSuccessor
      .successor.behavior.currentRuntimeFileCount,
    35
  );
});

test("paid-customer revenue readiness composes an exact Infrastructure Worker successor", () => {
  const historical = readJson(
    controlledOnboardingRehearsalSmokeContractProvenancePath
  );
  const successor = readJson(paidCustomerRevenueReadinessWorkerProvenancePath);
  const verified = verifyPaidCustomerRevenueReadinessWorkerSuccessor();
  const workerTransition = verified.transitionsByPath
    .get("workers/prometheus-iq-worker.js")[0];

  assert.equal(successor.predecessor.rewritten, false);
  assert.equal(successor.predecessor.remainsHistorical, true);
  assert.equal(
    workerTransition.previousSha256,
    historical.protectedSourceTransitions
      .find(entry => entry.path === "workers/prometheus-iq-worker.js")
      .currentSha256
  );
  assert.equal(
    workerTransition.currentSha256,
    "0ee3fb5426f5104fc70d97c0ce284d149fb5e13d2f521c04214bd361fa39ea61"
  );
  assert.equal(verified.successor.coherence.intelligenceRuntimeChanged, false);
  assert.equal(verified.successor.coherence.revenueReadinessSurfaceOnly, true);
  assert.equal(verified.successor.boundaries.prospectiveCollection, "OFF");
  assert.equal(verified.successor.boundaries.activeCohorts, 0);
  assert.equal(verified.successor.boundaries.recommendationInfluence, "OFF");
});

test("composed adoption carries ordered Worker successors without rewriting prior records", () => {
  const adoption = verifyCrossIndustryZipFounderAccessAdoption();
  const worker = adoption.transitionByPath.get("workers/prometheus-iq-worker.js");
  const rehearsalIndex = worker.transitions.findIndex(transition =>
    transition.currentSha256 ===
      "24015aeca7f2fde982c6e3fc4a468e19d29e8d3018ec600a2109cf341808a132"
  );
  assert.ok(rehearsalIndex >= 0);
  assert.equal(
    worker.transitions[rehearsalIndex + 1].previousSha256,
    worker.transitions[rehearsalIndex].currentSha256
  );
  assert.equal(worker.transitions[rehearsalIndex + 1].currentSha256,
    "0ee3fb5426f5104fc70d97c0ce284d149fb5e13d2f521c04214bd361fa39ea61");
  for (let index = 1; index < worker.transitions.length; index += 1) {
    assert.equal(worker.transitions[index].previousSha256,
      worker.transitions[index - 1].currentSha256);
  }
  assert.equal(worker.currentSha256, worker.transitions.at(-1).currentSha256);
  assert.equal(worker.currentSha256,
    "b5a5d26229d6d0808bb41a08fd2b252021df1d5cdfa9e44cda539819fc728b9a");
});

test("Full-System Harmony successor preserves revenue-readiness evidence", () => {
  const successor = readJson(fullSystemHarmonyProtectedSuccessorProvenancePath);
  const verified = verifyFullSystemHarmonyProtectedSuccessor();

  assert.equal(successor.predecessor.rewritten, false);
  assert.equal(successor.predecessor.remainsHistorical, true);
  assert.equal(verified.successorTransitionsByPath.size, 4);
  assert.equal(
    verified.transitionsByPath.get("index.html").at(-1).currentSha256,
    "336ca7a07fbf7ff9f27e77d674f9191d88253dd7db8ba5016e7f5da91884dad0"
  );
  assert.equal(
    verified.transitionsByPath.get("workers/prometheus-iq-worker.js").at(-1)
      .currentSha256,
    "95eeefa91c1d27f9a3dca1e60c377f8f860d0eb1125d6d915279f82187095051"
  );
});

test("Full-System Harmony source and deploy successors remain exact", () => {
  const verified = verifyFullSystemHarmonyProtectedSuccessor();
  const source = verified.successorTransitionsByPath.get("index.html")[0];
  const deploy = verified.successorTransitionsByPath
    .get("deploy/cloudflare-pages/index.html")[0];

  assert.equal(source.ownerSubsystem, "Prometheus Dashboard");
  assert.equal(deploy.ownerSubsystem, "Prometheus Infrastructure");
  assert.equal(source.currentSha256, deploy.currentSha256);
  assert.equal(verified.successor.coherence.intelligenceRuntimeChanged, true);
  assert.equal(verified.successor.coherence.recommendationInfluenceLockedOff, true);
  assert.equal(verified.successor.boundaries.prospectiveCollection, "OFF");
  assert.equal(verified.successor.boundaries.recommendationInfluence, "OFF");
});

test("live canonical identity composes exact Data, Dashboard, and Infrastructure successors", () => {
  const successor = readJson(liveCanonicalIdentityProtectedSuccessorProvenancePath);
  const verified = verifyLiveCanonicalIdentityProtectedSuccessor();
  const source = verified.successorTransitionsByPath.get("index.html")[0];
  const deploy = verified.successorTransitionsByPath
    .get("deploy/cloudflare-pages/index.html")[0];
  const data = verified.successorTransitionsByPath
    .get("data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs")[0];

  assert.equal(successor.predecessor.rewritten, false);
  assert.equal(successor.predecessor.remainsHistorical, true);
  assert.equal(source.ownerSubsystem, "Prometheus Dashboard");
  assert.equal(deploy.ownerSubsystem, "Prometheus Infrastructure");
  assert.equal(data.ownerSubsystem, "Prometheus Data");
  assert.equal(source.previousSha256,
    "336ca7a07fbf7ff9f27e77d674f9191d88253dd7db8ba5016e7f5da91884dad0");
  assert.equal(source.currentSha256,
    "235be31ca523e7ba0d008de040fde8c32a4a8871c307eacb6a5273dd3646fa72");
  assert.equal(source.currentSha256, deploy.currentSha256);
  assert.equal(data.previousSha256,
    "631c48d6fb0193f2356113d70ace4a7dbd0bf85d16ef8bf3a5a737a9430ce80a");
  assert.equal(data.currentSha256,
    "4b682c744aa19fa53813dfac838a638810e55c3067033f1cf711e83df6ee73c3");
  assert.equal(verified.successor.coherence.identityPresentationOnly, true);
  assert.equal(verified.successor.coherence.dataRecordCompatibilityOnly, true);
  assert.equal(verified.successor.coherence.intelligenceRuntimeChanged, false);
  assert.equal(verified.successor.boundaries.prospectiveCollection, "OFF");
  assert.equal(verified.successor.boundaries.recommendationInfluence, "OFF");
});

test("field-session report-type successor composes exact Data and Dashboard owner repairs", () => {
  const successor = readJson(
    fieldSessionReportTypeContractProtectedSuccessorProvenancePath
  );
  const verified = verifyFieldSessionReportTypeContractProtectedSuccessor();
  const data = verified.successorTransitionsByPath
    .get("data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs")[0];
  const dataTest = verified.successorTransitionsByPath
    .get("tests/route-iq-field-session-archive.test.mjs")[0];
  const dashboardTest = verified.successorTransitionsByPath
    .get("tests/dashboard-route-iq-field-session-producer.test.mjs")[0];

  assert.equal(successor.predecessor.rewritten, false);
  assert.equal(successor.predecessor.remainsHistorical, true);
  assert.equal(data.ownerSubsystem, "Prometheus Data");
  assert.equal(dataTest.commit, data.commit);
  assert.equal(dashboardTest.ownerSubsystem, "Prometheus Dashboard");
  assert.equal(data.previousSha256,
    "4b682c744aa19fa53813dfac838a638810e55c3067033f1cf711e83df6ee73c3");
  assert.equal(data.currentSha256,
    "5b4bc3d49596b3b4fa3c348ece30344f852f92056b0ceb8db8007cacbdfe2d2a");
  assert.deepEqual(successor.reportTypeContract.exactAllowlist, [
    "route-iq-daily-representative-report-v1",
    "beta-daily-rep-report"
  ]);
  assert.equal(successor.archiveEvidencePreservation.length, 6);
  assert.equal(verified.successor.coherence.rawEvidenceRewritten, false);
  assert.equal(verified.successor.coherence.routeScoringChanged, false);
  assert.equal(verified.successor.boundaries.prospectiveCollection, "OFF");
  assert.equal(verified.successor.boundaries.recommendationInfluence, "OFF");
});

test("retention deletion successor advances the Data archive and Intelligence consumers", () => {
  const verified = verifyRetentionDeletionRuntimeProtectedSuccessor();
  const transition = verified.successorTransitionsByPath
    .get("data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs")[0];

  assert.equal(verified.successor.predecessor.rewritten, false);
  assert.equal(transition.ownerSubsystem, "Prometheus Data");
  assert.equal(transition.commit, "8845846632801ccf29e52a36139a43c1063fcc2e");
  assert.equal(transition.previousSha256,
    "5b4bc3d49596b3b4fa3c348ece30344f852f92056b0ceb8db8007cacbdfe2d2a");
  assert.equal(transition.currentSha256,
    "2d54c4525f1f240b0b7d46baf2899f537375397e6016c55bc770fd6d3686cc20");
  assert.equal(verified.successorTransitionsByPath.size, 8);
  assert.equal(verified.successor.coherence.archiveReportTypeContractChanged, false);
  assert.equal(verified.successor.coherence.rawEvidenceRewritten, false);
  assert.equal(verified.successor.boundaries.prospectiveCollection, "OFF");
  assert.equal(verified.successor.boundaries.recommendationInfluence, "OFF");
});
