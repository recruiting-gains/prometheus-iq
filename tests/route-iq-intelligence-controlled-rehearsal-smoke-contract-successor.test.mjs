import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  controlledOnboardingRehearsalSmokeContractProvenancePath,
  crossIndustryZipFounderAccessProvenancePath,
  verifyControlledOnboardingRehearsalSmokeContractSuccessor,
  verifyCrossIndustryZipFounderAccessAdoption
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
