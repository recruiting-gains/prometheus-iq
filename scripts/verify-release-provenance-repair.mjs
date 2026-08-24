import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";

import {
  verifyControlledOnboardingRehearsalSmokeContractSuccessor,
  verifyGymPreviewRouteQualityRuntimeSurfaceSuccessor
} from "../intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs";

const batchId = "BATCH-20260713-002";
const fullSystemHarmonyGovernancePath =
  "git:c7119fcee140ab8a130cdb888439277fdcbeb6b0:overwatch/governance/full-system-harmony-audit-v1.json";
const liveCanonicalIdentityGovernancePath =
  "overwatch/governance/live-canonical-identity-migration-v1.json";
const privateWorkflowGovernancePath =
  "overwatch/governance/github-actions-private-worker-deployment-v2.json";
const fieldSessionReportTypeGovernancePath =
  "overwatch/governance/field-session-report-type-contract-drift-repair-v1.json";
const retentionDeletionGovernancePath =
  "overwatch/governance/route-iq-retention-expiry-deletion-runtime-v1.json";
const governedLearningGovernancePath =
  "overwatch/governance/route-iq-governed-multi-session-learning-dashboard-advisory-bridge-v1.json";
const retentionDeletionRuntimeProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-retention-deletion-runtime-v1.json";
const retentionDeletionConsumerAdmissionProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-retention-deletion-consumer-admission-v1.json";
const retentionMaintenanceGovernancePath =
  "overwatch/governance/route-iq-dormant-retention-maintenance-deployment-readiness-v1.json";
const retentionMaintenanceConsumerAdmissionProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-retention-maintenance-consumer-admission-v1.json";
const prospectiveCalibrationGovernancePath =
  "overwatch/governance/route-iq-prospective-calibration-production-admission-future-window-readiness-v1.json";
const prospectiveCalibrationIntelligenceProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-prospective-calibration-production-admission-v1.json";
const gymPreviewRouteQualityIntelligenceProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-gym-preview-route-quality-runtime-surface-v1.json";
const representativeIntelligenceRuntimeSurfaceProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-representative-intelligence-runtime-surface-v1.json";
const dashboardVisualProtectedConsumerProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-dashboard-public-visual-protected-consumers-v1.json";
const dashboardVisualIdentityProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-dashboard-public-visual-identity-v1.json";
const dashboardVisualVerifierCompositionProvenancePath =
  "intelligence/provenance/protected-baseline-synchronization-dashboard-public-visual-verifier-composition-v1.json";
let gymPreviewRouteQualityValidationCache = null;
let representativeIntelligenceRuntimeSurfaceValidationCache = null;
let dashboardVisualOwnerTransitionCache = null;
const prospectiveCalibrationIntelligenceProvenanceSha256 =
  "cfeb03951b03e0e9184351749b4aabcc479e2c63229376e585fbd5f6d3b26f2d";
const legacyCommit = "049cf583b04900b2cbf38bbffc5f6293252365d0";
const intelligenceRepairCommit = "1bb7d09dff254503d56027a87efe0d526228f35a";
const dashboardRepairCommit = "a665b1b26db02716240b622d0b4d451d019c2896";
const dashboardProspectiveCommit = "6c7671cb3f9387fdac29961432412dfe70088b2e";
const dashboardCollectionOffCommit = "555dc6e87b1d2f884f1e18b3a06e1c62dfbd73dd";
const dashboardProductFocusCommit = "82d1e6f23ca3a75c0073c051531477913258a98f";
const currentDashboardSourceCommit = "99457bcda1abed536cc06585492d29f5ac500f05";
const currentDashboardValidationCommit = "f612e394b3af75e63cc07232d64bbd3dd1adb817";
const historicalDashboardContractCommit = "0ac5b54351e12fec954e479c1c56506c58dea6c8";
const protectedBaselineSuccessorCommit = "536d166e4a39a9caf4071e96f92a1598c00e7119";
const routeQualitySuccessorCommit = "73b477a0fdec725beb7fe6de795ec35fd457ef32";
const routeQualityDataCommit = "26b07905926662e3323e557d77c608db0cbc23ed";
const commercialRouteQualityDataCommit = "4f3acb7fd9f1f036e2d277a8323b52eb10ddce0f";
const commercialRouteQualitySuccessorCommit = "ecc9cbcc0222c627aeef952d2a651f4ba90cc42a";
const investorWebsiteRouteQualityDataCommit = "330752fb53c9466f6bc0339d771b2f2facbc2351";
const investorWebsiteRouteQualitySuccessorCommit = "88b3bbbf2c34d879881ced98620c15a602598c45";
const restored3dRouteQualityDataCommit = "85850c74564798889ba50cb15c7a7b0406a521fd";
const restored3dRouteQualitySuccessorCommit = "b065d069bdb3439a0541074d80862494e1d8a9bc";
const restored3dClaimsDataCommit = "cee8d681fd2272aca3425f10b433507819085424";
const currentAugust1IntelligenceSuccessorCommit =
  "3587c3d70526b95ae9083520ed42025c5522f764";
const currentAugust1IntelligenceSuccessorParent =
  "0ac5b54351e12fec954e479c1c56506c58dea6c8";
const currentAugust1IntelligenceSuccessorTree =
  "5ac08aecd5c1f720c03194027aef3def4083a142";
const currentCrossIndustryIntelligenceSuccessorCommit =
  "5215ad7f261590f5901dc84a3b8e59d9bde6ce8b";
const currentCrossIndustryIntelligenceSuccessorPath =
  "intelligence/provenance/protected-baseline-synchronization-cross-industry-dashboard-retention-successor-v1.json";
const currentCrossIndustryIntelligenceClaimsPath =
  "intelligence/contracts/route-iq-public-intelligence-claims-v1.json";
const currentCrossIndustryCoherenceCommit =
  "41adcee256f2b46970709542875e90a6dd711c19";
const currentCrossIndustryCoherencePaths = new Map([
  ["scripts/verify-shadow-decision-readiness.mjs", "0a6cd4730a223304f9008c375735a84ff4ea0517db83876c9b0bbc9d5106f1c2"],
  ["tests/shadow-decision-readiness.test.mjs", "ca0b685c8fc194317641f06ff0ea5a25a4be64a97ed17e6696f7c52de5f5c732"]
]);
const currentZipFounderAccessIntelligenceCommit =
  "4b7a18556e7e424f8c643c38f154ec6ed504a354";
const currentZipFounderAccessIntelligenceParent =
  "3dc4e39b2d08fd90337aea0b670ee211629dd19f";
const currentZipFounderAccessIntelligenceTree =
  "230199ba017e3f0c39d180d4642c7fff3d463c69";
const currentZipFounderAccessIntelligencePaths = [
  "intelligence/provenance/protected-baseline-synchronization-cross-industry-zip-founder-access-v1.json",
  "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
  "scripts/verify-discovery-mode-intelligence-v2.mjs",
  "scripts/verify-nearby-context-intelligence-v2.mjs",
  "scripts/verify-read-only-field-session-learning.mjs",
  "scripts/verify-shadow-decision-readiness.mjs",
  "tests/intelligence-architecture.test.mjs",
  "tests/read-only-field-session-learning.test.mjs",
  "tests/shadow-decision-readiness.test.mjs"
].sort();
const currentHardenedSmokeGuardIntelligenceSuccessorPath =
  "overwatch/governance/route-iq-release-provenance-intelligence-successor-v1.json";
const currentHardenedSmokeGuardIntelligenceSuccessorCommit =
  "0bda1d1fff7e8bee09c72e0248970b52dd013382";
const currentHardenedSmokeGuardIntelligenceSuccessorParent =
  "94c642d85a2870af4ec6c312a4e2aa3294b4aa68";
const currentHardenedSmokeGuardIntelligenceSuccessorTree =
  "53925227263d7fa3ebd8182550f6094c3fa84a90";
const currentHardenedSmokeGuardIntelligenceSuccessorPaths = [
  "intelligence/provenance/protected-baseline-synchronization-batch-20260714-006-unattended-runtime-guard-v1.json",
  "intelligence/provenance/protected-baseline-synchronization-cross-industry-zip-founder-access-v1.json",
  "scripts/verify-shadow-decision-readiness.mjs",
  "tests/shadow-decision-readiness.test.mjs"
].sort();
const currentPaidCustomerIntelligenceSuccessorCommit =
  "bf5c665035923f5f56fd923d0cb3df8610c2c33a";
const currentPaidCustomerIntelligenceSuccessorParent =
  "5955632a7229b5fd66d799f73dd717233077375c";
const currentPaidCustomerIntelligenceSuccessorTree =
  "9fa2bd9dbfbb0b84df89a6bba8de24fd7390e785";
const currentPaidCustomerIntelligenceSuccessorPaths = [
  "intelligence/provenance/protected-baseline-synchronization-cross-industry-zip-founder-access-v1.json",
  "tests/read-only-field-session-learning.test.mjs"
].sort();
const currentPrivateSmokeTimeoutIntelligenceSuccessorCommit =
  "039116040678a3cbae8016a34f17e30e674715f6";
const currentPrivateSmokeTimeoutIntelligenceSuccessorParent =
  "5df472ace229d95d4f0a000797ad36b34043b937";
const currentPrivateSmokeTimeoutIntelligenceSuccessorTree =
  "4fe6496f1948356385c7a128016f89f6aeadf38e";
const currentPrivateSmokeTimeoutIntelligenceSuccessorPaths = [
  "intelligence/provenance/protected-baseline-synchronization-batch-20260714-006-unattended-runtime-guard-v1.json",
  "intelligence/provenance/protected-baseline-synchronization-cross-industry-zip-founder-access-v1.json",
  "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
  "scripts/verify-shadow-decision-readiness.mjs",
  "tests/shadow-decision-readiness.test.mjs"
].sort();
const currentControlledRehearsalIntelligenceSuccessorCommit =
  "41679ab6742dc9fd8639bbc7cfe6a1dc2328d540";
const currentControlledRehearsalIntelligenceSuccessorParent =
  "ab544fd393f6dffa86a3fc603e72ef5d1883109c";
const currentControlledRehearsalIntelligenceSuccessorTree =
  "34b0f9922aa1dbcb7d391c0ab829f2efb2febfb1";
const currentControlledRehearsalIntelligenceSuccessorPaths = [
  "intelligence/provenance/protected-baseline-synchronization-controlled-onboarding-rehearsal-smoke-contract-v1.json",
  "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
  "scripts/verify-shadow-decision-readiness.mjs",
  "tests/route-iq-intelligence-controlled-rehearsal-smoke-contract-successor.test.mjs",
  "tests/shadow-decision-readiness.test.mjs"
].sort();
const currentControlledRehearsalIntelligenceSuccessorHashes = new Map([
  [
    "intelligence/provenance/protected-baseline-synchronization-controlled-onboarding-rehearsal-smoke-contract-v1.json",
    "1ec4308ce17d8ef1b6d697593ae3ddbf213f9794e9ec9b32ff681786e03037a3"
  ],
  [
    "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
    "1b85032b4889cef4e656e14072bab9d25dbc8157abbdd3730505aab98ef5533d"
  ],
  [
    "scripts/verify-shadow-decision-readiness.mjs",
    "24dfe030d71d081e625bec37ff4fbc535ce67cb3ef796aebd65c83ea8d817859"
  ],
  [
    "tests/route-iq-intelligence-controlled-rehearsal-smoke-contract-successor.test.mjs",
    "ebfe8ddb714c4ce56b36c691cd697bc6d8659a4eafa10a49bb143cb5cfbea700"
  ],
  [
    "tests/shadow-decision-readiness.test.mjs",
    "59cc3737e55222816115ef1608c7a43502894935f256a1bc4812d83dbc2c9cbb"
  ]
]);
export const currentRevenueReadinessIntelligenceSuccessor = Object.freeze({
  commit: "c025fd95a8f5141dc4c32af3ca83292711fb1df7",
  parent: "bc21696a653661ac0b90cd58e3f1744ade10ba70",
  tree: "06e35bc660be3b07da373c4242e1f1724002ec24",
  identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
  subject: "intelligence: accept revenue readiness provenance successor",
  evidence: Object.freeze([
    Object.freeze({
      path: "intelligence/provenance/protected-baseline-synchronization-paid-customer-revenue-readiness-worker-v1.json",
      sha256: "3f21d2b71b85510671a7d76c9043d4ff31421c0cfcc9ff937a16915a5c38b07a"
    }),
    Object.freeze({
      path: "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
      sha256: "705925ee8a523725a195a116b62febc49bc97184b0ad6eeace34df901fca0da0"
    }),
    Object.freeze({
      path: "tests/read-only-field-session-learning.test.mjs",
      sha256: "9e3d7e6a9ac089d56b7b761758547dca82fac166412bbb74e9f75ba2e257c72f"
    }),
    Object.freeze({
      path: "tests/route-iq-intelligence-controlled-rehearsal-smoke-contract-successor.test.mjs",
      sha256: "6f69166053117abe4c26a02c26f6492b6bea2649f07565083eb474f094153f53"
    })
  ])
});
const currentRevenueReadinessIntelligenceSuccessorHashes = new Map(
  currentRevenueReadinessIntelligenceSuccessor.evidence.map(item => [
    item.path,
    item.sha256
  ])
);
export const currentFullSystemHarmonyIntelligenceSuccessor = Object.freeze({
  commit: "2f8992476ca37276b0ee388fe2e33a2158f9d906",
  parent: "9c841ae7833ca51e2dc7a81243ed9fd34f5dcfdc",
  tree: "09e61f884b11a1fa66e772fdba1e320f843af8c0",
  identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
  subject: "intelligence: adopt full-system harmony successors",
  evidence: Object.freeze([
    Object.freeze({
      path: "intelligence/provenance/protected-baseline-synchronization-full-system-harmony-v1.json",
      sha256: "a7c9965e96c71c105276904d57ca2cf7264f47462ba9629429510e1ab7817446"
    }),
    Object.freeze({
      path: "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
      sha256: "dbf40b94b7a28aa6ec1a20b7a6148014f72f2057af005e23f4bef2c0c31adb34"
    }),
    Object.freeze({
      path: "tests/route-iq-intelligence-controlled-rehearsal-smoke-contract-successor.test.mjs",
      sha256: "f0e1795811b098067c5ac8245a040e3790cb7710492f2975fabeb4c0dd4b34e2"
    })
  ])
});
const currentFullSystemHarmonyIntelligenceSuccessorHashes = new Map(
  currentFullSystemHarmonyIntelligenceSuccessor.evidence.map(item => [
    item.path,
    item.sha256
  ])
);
export const currentLiveCanonicalIdentityIntelligenceSuccessor = Object.freeze({
  commit: "56f67124c1beba2f9289538d65e782cd808eacb2",
  parent: "dc0f6f96d9208a1041c60f609d1b5dabb294e956",
  tree: "841aaee1f02c3aa09dde1dc333c2db68cf296f9f",
  identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
  subject: "intelligence: adopt canonical identity protected successors",
  evidence: Object.freeze([
    Object.freeze({
      path: "intelligence/provenance/protected-baseline-synchronization-live-canonical-identity-v1.json",
      sha256: "cfb89774373db0928ad5e360ec642a4e49eef3d2d68583aecdab71f61114e562"
    }),
    Object.freeze({
      path: "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
      sha256: "5ee03775a417d214e075881815ef9886520bf9e083c2c912ff6d7a2a85617ea5"
    }),
    Object.freeze({
      path: "tests/read-only-field-session-learning.test.mjs",
      sha256: "9a7c35d96a326364e023c26fcd8eb1f9ef19be8e8074dcb81862c8cc05fabe66"
    }),
    Object.freeze({
      path: "tests/route-iq-intelligence-controlled-rehearsal-smoke-contract-successor.test.mjs",
      sha256: "8cd7c6caa9e5557cb50a36d1edd609cf83ce0962cf89651c8ed64e469e0bf944"
    })
  ])
});
const currentLiveCanonicalIdentityIntelligenceSuccessorHashes = new Map(
  currentLiveCanonicalIdentityIntelligenceSuccessor.evidence.map(item => [
    item.path,
    item.sha256
  ])
);
export const currentFieldSessionReportTypeIntelligenceSuccessor = Object.freeze({
  commit: "d9aae1a1da5779f3a59bc5e955a851fef4f5fe18",
  parent: "bbed83c62e6c8d2c73ce287161df282005f99187",
  tree: "38ce2be37f66f49202967a285a003755ebc21dcc",
  identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
  subject: "intelligence: compose field-session report contract repair",
  evidence: Object.freeze([
    Object.freeze({
      path: "intelligence/provenance/protected-baseline-synchronization-field-session-report-type-contract-v1.json",
      sha256: "77c88bc9a18d852c4b937303918be47a17b2423eba46c142cf5d2d4e9d5a0198"
    }),
    Object.freeze({
      path: "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs",
      sha256: "9ecd9ca37e8d42209aaf7b53cb0bcae06f431bee29059a81fd5b1333863118c1"
    }),
    Object.freeze({
      path: "tests/route-iq-intelligence-controlled-rehearsal-smoke-contract-successor.test.mjs",
      sha256: "04014936bb2bebbb1b17c22048449b325e8667c8809f9ba382e7532ee6a4ff4b"
    })
  ])
});
const currentFieldSessionReportTypeIntelligenceSuccessorHashes = new Map(
  currentFieldSessionReportTypeIntelligenceSuccessor.evidence.map(item => [
    item.path,
    item.sha256
  ])
);
export const currentFieldSessionReportTypeDriftRejectionSuccessor = Object.freeze({
  commit: "655224332c65ec28d5c45b1accd2eae3d12555c2",
  parent: "d9aae1a1da5779f3a59bc5e955a851fef4f5fe18",
  tree: "5eeb4224f913faafcd3114e713092a8d6e668ec0",
  identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
  subject: "intelligence: bind drift rejection to report successor",
  evidence: Object.freeze([
    Object.freeze({
      path: "tests/read-only-field-session-learning.test.mjs",
      sha256: "0fe879e56ff462e8b18b0fcee0515d082edbdfb16b1ae90fc3137a48d85fa41d"
    })
  ])
});
const currentFieldSessionReportTypeDriftRejectionSuccessorHashes = new Map(
  currentFieldSessionReportTypeDriftRejectionSuccessor.evidence.map(item => [
    item.path,
    item.sha256
  ])
);
const retentionDeletionIntelligenceVerifierPath =
  "intelligence/provenance/verify-cross-industry-zip-founder-access-v1.mjs";
const retentionDeletionControlledRehearsalTestPath =
  "tests/route-iq-intelligence-controlled-rehearsal-smoke-contract-successor.test.mjs";
const retentionDeletionShadowReadinessVerifierPath =
  "scripts/verify-shadow-decision-readiness.mjs";
const retentionDeletionReadOnlyLearningTestPath =
  "tests/read-only-field-session-learning.test.mjs";
const retentionDeletionShadowReadinessTestPath =
  "tests/shadow-decision-readiness.test.mjs";
export const currentRetentionDeletionIntelligenceSuccessorChain = Object.freeze([
  Object.freeze({
    path: retentionDeletionIntelligenceVerifierPath,
    commit: "b359d8e701e13d2f9911dcd0cb917eecce8aa7ac",
    parent: "c8cba2467436f8c5326532a19afbf00cc7bfadef",
    tree: "579b793cfefb4063115a8d6b19dcf0e3df3582eb",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: compose retention deletion successor",
    previousSha256: "9ecd9ca37e8d42209aaf7b53cb0bcae06f431bee29059a81fd5b1333863118c1",
    sha256: "7f798b82e68699fb71413ae4d72e03ee864aa9e1a9a46573869a1559205823d8"
  }),
  Object.freeze({
    path: retentionDeletionIntelligenceVerifierPath,
    commit: "99f591162093ccb1f4ad5ac2eac59fc76bec4bc0",
    parent: "c9cc1d85315f0f577bb6e2b457965af3bb75ee9c",
    tree: "b4e8cda1d34f7e3fad199066335f94ac86108664",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: synchronize deletion consumer provenance",
    previousSha256: "7f798b82e68699fb71413ae4d72e03ee864aa9e1a9a46573869a1559205823d8",
    sha256: "d709cfea9765ee13cb43f86fe5084f6cdc3521fcb08d28f5deeed580189a2284"
  }),
  Object.freeze({
    path: retentionDeletionIntelligenceVerifierPath,
    commit: "605c52e3076504159ac22c84b36b3d441cc30b66",
    parent: "f37a1e16a73d89c57fb988c53c472a570fdbc15f",
    tree: "4c38870645d139999b647943e920873ef7cfc7f1",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: compose retention consumer provenance",
    previousSha256: "d709cfea9765ee13cb43f86fe5084f6cdc3521fcb08d28f5deeed580189a2284",
    sha256: "b45277e74f70c808bb1ea1e8b7dc1b8338ab085ba447c12a50d5b6421aed56b1"
  }),
  Object.freeze({
    path: retentionDeletionIntelligenceVerifierPath,
    commit: "39cb2b9c9dea7766b420ce8d1ad959c4b35a2d4b",
    parent: "61418a67b6df3e482b52a1fa6f7fc6757147dda0",
    tree: "0b4e8ef7cf7a29063f9c22896b5d8698dc96c0a4",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: finalize retention successor chain",
    previousSha256: "b45277e74f70c808bb1ea1e8b7dc1b8338ab085ba447c12a50d5b6421aed56b1",
    sha256: "7e1920f2c5c13ef6ff948241d0ad0100eb271867ee4fcedd62067234b1827fed"
  }),
  Object.freeze({
    path: retentionDeletionControlledRehearsalTestPath,
    commit: "b359d8e701e13d2f9911dcd0cb917eecce8aa7ac",
    parent: "c8cba2467436f8c5326532a19afbf00cc7bfadef",
    tree: "579b793cfefb4063115a8d6b19dcf0e3df3582eb",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: compose retention deletion successor",
    previousSha256: "04014936bb2bebbb1b17c22048449b325e8667c8809f9ba382e7532ee6a4ff4b",
    sha256: "9c8f7ae2f72beb4463fe53f0b710b7c54702e1dccb5607faf58dc1e66c48adec"
  }),
  Object.freeze({
    path: retentionDeletionControlledRehearsalTestPath,
    commit: "99f591162093ccb1f4ad5ac2eac59fc76bec4bc0",
    parent: "c9cc1d85315f0f577bb6e2b457965af3bb75ee9c",
    tree: "b4e8cda1d34f7e3fad199066335f94ac86108664",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: synchronize deletion consumer provenance",
    previousSha256: "9c8f7ae2f72beb4463fe53f0b710b7c54702e1dccb5607faf58dc1e66c48adec",
    sha256: "84f124dc1137926c86687ab61274392c16dae53dc11f723300c5982557fd4118"
  }),
  Object.freeze({
    path: retentionDeletionShadowReadinessVerifierPath,
    commit: "d2ed353722b8c99f786306d7bbb37f21349ec3a5",
    parent: "a20e2b8be677278a8e325492eed198c4f56d5536",
    tree: "ad140ba5e4e7b1b1131d33afc9ba0618fa059d12",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "fix(intelligence): admit dormant retention deletion state",
    previousSha256: "0ef3dff897cb9ed90dd90a81b55e09e7a8649153192c943fd595a8a1f144b12b",
    sha256: "b634c99b52aa355422cb9b37a63ce742293057303a06e548b4121c80cb522876"
  }),
  Object.freeze({
    path: retentionDeletionShadowReadinessVerifierPath,
    commit: "f37a1e16a73d89c57fb988c53c472a570fdbc15f",
    parent: "d2ed353722b8c99f786306d7bbb37f21349ec3a5",
    tree: "d734e6e235174d870d3c82c5c78e1edcdc1cc74b",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "fix(intelligence): compose retention data successor",
    previousSha256: "b634c99b52aa355422cb9b37a63ce742293057303a06e548b4121c80cb522876",
    sha256: "bda4488c6015751fe24ddd36dd5dec38a8106a0a2a061a56e3232785b325c911"
  }),
  Object.freeze({
    path: retentionDeletionReadOnlyLearningTestPath,
    commit: "d2ed353722b8c99f786306d7bbb37f21349ec3a5",
    parent: "a20e2b8be677278a8e325492eed198c4f56d5536",
    tree: "ad140ba5e4e7b1b1131d33afc9ba0618fa059d12",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "fix(intelligence): admit dormant retention deletion state",
    previousSha256: "0fe879e56ff462e8b18b0fcee0515d082edbdfb16b1ae90fc3137a48d85fa41d",
    sha256: "4ca183de17f9d870d2ca448b6cf6dadf7f5c58a56132ba38ffde38edce14e20b"
  }),
  Object.freeze({
    path: retentionDeletionReadOnlyLearningTestPath,
    commit: "61418a67b6df3e482b52a1fa6f7fc6757147dda0",
    parent: "605c52e3076504159ac22c84b36b3d441cc30b66",
    tree: "4ef07a81196fa1ff6aedcbd309cc34298610d575",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "test(intelligence): retain successor drift rejection",
    previousSha256: "4ca183de17f9d870d2ca448b6cf6dadf7f5c58a56132ba38ffde38edce14e20b",
    sha256: "733435dd04c9343642d01bf6fbbc1e8ab5e942bcb0580963614f768a53fb4c84"
  }),
  Object.freeze({
    path: retentionDeletionShadowReadinessTestPath,
    commit: "d2ed353722b8c99f786306d7bbb37f21349ec3a5",
    parent: "a20e2b8be677278a8e325492eed198c4f56d5536",
    tree: "ad140ba5e4e7b1b1131d33afc9ba0618fa059d12",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "fix(intelligence): admit dormant retention deletion state",
    previousSha256: "726510bdd55114d81ae0cc1290b884d851f6b1b5dc0b7107e0bd9f78e9e1b4b6",
    sha256: "90bf943f8296d8c7e5ab14e57b5a2f02801260ebf2968f5bbbd4ce8b42af9d88"
  })
]);
export const currentRetentionMaintenanceIntelligenceSuccessor = Object.freeze({
  path: retentionMaintenanceConsumerAdmissionProvenancePath,
  sha256: "71b1a7ce529784a93bc4454617be15a896cfde0e1af47731ba711c97372bf0a4",
  implementationCommit: "c2bdfa3035383293afeb7e4a16704cb121c01716",
  coherenceCommit: "0faca7bb91b3e4ddbe7c1996ca84cc9247cd205a"
});
export const currentGovernedLearningIntelligenceSuccessorChain = Object.freeze([
  Object.freeze({
    path: "intelligence/off-route-learning-intelligence.mjs",
    commit: "eff79c156b1820621cf80b4e4eb87c030d8c5024",
    parent: "ff06fb0723e0842c970fd344049b999ba774faa4",
    tree: "e1af5725d67610a984f676fd889a69a6c3dd9bf6",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: bridge governed multi-session advisory learning",
    commitPaths: Object.freeze([
      "intelligence/off-route-learning-intelligence.mjs",
      "intelligence/read-only-field-session-learning.mjs",
      "intelligence/route-iq-governed-multi-session-learning.mjs",
      "tests/route-iq-governed-multi-session-learning.test.mjs"
    ]),
    previousSha256: "cfb0ea2ab1ce69a9e614d402b60bd7cc21ee88df97914c4e558a070ff27403bd",
    sha256: "6a3b73a5e2c670b072f225e2f77468c201a7501006f76116d23a15499cf83355"
  }),
  Object.freeze({
    path: "intelligence/read-only-field-session-learning.mjs",
    commit: "eff79c156b1820621cf80b4e4eb87c030d8c5024",
    parent: "ff06fb0723e0842c970fd344049b999ba774faa4",
    tree: "e1af5725d67610a984f676fd889a69a6c3dd9bf6",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: bridge governed multi-session advisory learning",
    commitPaths: Object.freeze([
      "intelligence/off-route-learning-intelligence.mjs",
      "intelligence/read-only-field-session-learning.mjs",
      "intelligence/route-iq-governed-multi-session-learning.mjs",
      "tests/route-iq-governed-multi-session-learning.test.mjs"
    ]),
    previousSha256: "1eb8084ca8470533ac34b445bb7404865e00bf7f1ae02d01cc40b466c3e3e2ee",
    sha256: "348e8774e4a02edbfdb4859c60a2205ca227844026565e770b126e7526dfb61d"
  }),
  Object.freeze({
    path: retentionDeletionIntelligenceVerifierPath,
    commit: "0e3d720f09e65cea066c5181afdff44d96a4e8ca",
    parent: "da3f9ff739ecb883ac2bddb169aefb1b9632b525",
    tree: "c2063be72b464925d9fd3187b05a18bed1c9a314",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: compose governed learning successor chain",
    previousSha256: "ce1ab3876750043b251cb6029d0c0709159a8ff9c58c4266411883e6f9542e2c",
    sha256: "12ce609da8194f3071270eb6dd07fe0e6f50c772efd8cab82937a8af8e3bf512"
  }),
  Object.freeze({
    path: retentionDeletionIntelligenceVerifierPath,
    commit: "76946be76fea7dd9ec558739f63bd7310a766a66",
    parent: "0e3d720f09e65cea066c5181afdff44d96a4e8ca",
    tree: "0d410df5ce458c6c7409dc23b0447e4df03b9f80",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: adopt governed learning successor baseline",
    previousSha256: "12ce609da8194f3071270eb6dd07fe0e6f50c772efd8cab82937a8af8e3bf512",
    sha256: "a3825a1518873245d003af5e6df0ff4adfb782c729904cb54f537e6f0bebbacc"
  }),
  Object.freeze({
    path: retentionDeletionIntelligenceVerifierPath,
    commit: "7633c44d5e43ca64e32ece2da38f6e9925d34d4c",
    parent: "76946be76fea7dd9ec558739f63bd7310a766a66",
    tree: "e42c79a57beecec90c21edd7bef81a0184e281a6",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: order governed successor verification",
    previousSha256: "a3825a1518873245d003af5e6df0ff4adfb782c729904cb54f537e6f0bebbacc",
    sha256: "1bebf7b1d43a78dd647bda1722afd26c54f71e5bad9d6559e2ff6ab080256eb5"
  }),
  Object.freeze({
    path: retentionDeletionIntelligenceVerifierPath,
    commit: "f1b889bb45e357a757656d992e91d95580cc8880",
    parent: "7633c44d5e43ca64e32ece2da38f6e9925d34d4c",
    tree: "9e364871eb0be5385ccbebcc145b2100f9e9e6e9",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: deduplicate successor aggregation",
    previousSha256: "1bebf7b1d43a78dd647bda1722afd26c54f71e5bad9d6559e2ff6ab080256eb5",
    sha256: "26a52c0699474760913f403aadbacb4c8121c8c380932d4375b071d9f5bb38c0"
  }),
  Object.freeze({
    path: "intelligence/artifacts/route-iq-governed-multi-session-learning-v1/fitness_connection/cruz/governed-learning-artifact-v1.json",
    commit: "a2aefa5ed3a14ee2e6b37e433f8b01fb092b1392",
    parent: "e3d936381ec7164267b9a584b3f69db656bc8781",
    tree: "6ea30b53914690f34d6b34e882666a2461bfe843",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: guard governed outcome semantics",
    commitPaths: Object.freeze([
      "intelligence/artifacts/route-iq-governed-multi-session-learning-v1/fitness_connection/cruz/governed-learning-artifact-v1.json",
      "intelligence/operating-profile-engine.mjs",
      "intelligence/read-only-field-session-learning.mjs",
      "intelligence/route-iq-governed-multi-session-learning.mjs",
      "tests/operating-profile-engine.test.mjs",
      "tests/route-iq-governed-multi-session-learning.test.mjs"
    ]),
    previousSha256: "89e3619c3f9c9a5d71003761d3c861dbb9c59dddfac6e7991bba483e562fcd37",
    sha256: "cdebac56535d7603586c1feb1e3b238b84e5c4ca6ccc26ad5db2124ab4aa42aa"
  }),
  Object.freeze({
    path: "intelligence/operating-profile-engine.mjs",
    commit: "a2aefa5ed3a14ee2e6b37e433f8b01fb092b1392",
    parent: "e3d936381ec7164267b9a584b3f69db656bc8781",
    tree: "6ea30b53914690f34d6b34e882666a2461bfe843",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: guard governed outcome semantics",
    commitPaths: Object.freeze([
      "intelligence/artifacts/route-iq-governed-multi-session-learning-v1/fitness_connection/cruz/governed-learning-artifact-v1.json",
      "intelligence/operating-profile-engine.mjs",
      "intelligence/read-only-field-session-learning.mjs",
      "intelligence/route-iq-governed-multi-session-learning.mjs",
      "tests/operating-profile-engine.test.mjs",
      "tests/route-iq-governed-multi-session-learning.test.mjs"
    ]),
    previousSha256: "af19e5e798da35d85a2dfe4b59521916e4dac970eb5df485fae74f7e229b0353",
    sha256: "b4d273df916c1035c2fbeb2c55308df20f92460ee9970ba0ac98f978e9a85817"
  }),
  Object.freeze({
    path: "intelligence/read-only-field-session-learning.mjs",
    commit: "a2aefa5ed3a14ee2e6b37e433f8b01fb092b1392",
    parent: "e3d936381ec7164267b9a584b3f69db656bc8781",
    tree: "6ea30b53914690f34d6b34e882666a2461bfe843",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: guard governed outcome semantics",
    commitPaths: Object.freeze([
      "intelligence/artifacts/route-iq-governed-multi-session-learning-v1/fitness_connection/cruz/governed-learning-artifact-v1.json",
      "intelligence/operating-profile-engine.mjs",
      "intelligence/read-only-field-session-learning.mjs",
      "intelligence/route-iq-governed-multi-session-learning.mjs",
      "tests/operating-profile-engine.test.mjs",
      "tests/route-iq-governed-multi-session-learning.test.mjs"
    ]),
    previousSha256: "348e8774e4a02edbfdb4859c60a2205ca227844026565e770b126e7526dfb61d",
    sha256: "e109657982be0497e8c445bfc84fe3a485286a9185af7eaebf400bd31356e3de"
  }),
  Object.freeze({
    path: "intelligence/route-iq-governed-multi-session-learning.mjs",
    commit: "a2aefa5ed3a14ee2e6b37e433f8b01fb092b1392",
    parent: "e3d936381ec7164267b9a584b3f69db656bc8781",
    tree: "6ea30b53914690f34d6b34e882666a2461bfe843",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: guard governed outcome semantics",
    commitPaths: Object.freeze([
      "intelligence/artifacts/route-iq-governed-multi-session-learning-v1/fitness_connection/cruz/governed-learning-artifact-v1.json",
      "intelligence/operating-profile-engine.mjs",
      "intelligence/read-only-field-session-learning.mjs",
      "intelligence/route-iq-governed-multi-session-learning.mjs",
      "tests/operating-profile-engine.test.mjs",
      "tests/route-iq-governed-multi-session-learning.test.mjs"
    ]),
    previousSha256: "0ada2dff53ddb08f0160b2dda767b414e3c16b7bfe77c803ace1fd8333188923",
    sha256: "8f7c3a3142671fb1c11419d71900984c22062ca85667ac7d0032e8cefc930e6f"
  }),
  Object.freeze({
    path: "tests/operating-profile-engine.test.mjs",
    commit: "a2aefa5ed3a14ee2e6b37e433f8b01fb092b1392",
    parent: "e3d936381ec7164267b9a584b3f69db656bc8781",
    tree: "6ea30b53914690f34d6b34e882666a2461bfe843",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: guard governed outcome semantics",
    commitPaths: Object.freeze([
      "intelligence/artifacts/route-iq-governed-multi-session-learning-v1/fitness_connection/cruz/governed-learning-artifact-v1.json",
      "intelligence/operating-profile-engine.mjs",
      "intelligence/read-only-field-session-learning.mjs",
      "intelligence/route-iq-governed-multi-session-learning.mjs",
      "tests/operating-profile-engine.test.mjs",
      "tests/route-iq-governed-multi-session-learning.test.mjs"
    ]),
    previousSha256: "85f9c198f01f523a3eefdf9f211eb3e5b36a01fc3a8b54ead937568e98e05aac",
    sha256: "eb2800ffaf3c20778259e409a7a80112c21a3dfd7b6a03d760fc256bb367544a"
  }),
  Object.freeze({
    path: "tests/route-iq-governed-multi-session-learning.test.mjs",
    commit: "a2aefa5ed3a14ee2e6b37e433f8b01fb092b1392",
    parent: "e3d936381ec7164267b9a584b3f69db656bc8781",
    tree: "6ea30b53914690f34d6b34e882666a2461bfe843",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: guard governed outcome semantics",
    commitPaths: Object.freeze([
      "intelligence/artifacts/route-iq-governed-multi-session-learning-v1/fitness_connection/cruz/governed-learning-artifact-v1.json",
      "intelligence/operating-profile-engine.mjs",
      "intelligence/read-only-field-session-learning.mjs",
      "intelligence/route-iq-governed-multi-session-learning.mjs",
      "tests/operating-profile-engine.test.mjs",
      "tests/route-iq-governed-multi-session-learning.test.mjs"
    ]),
    previousSha256: "367b75dccca4fb6d6cf745119670fb99c3a9bb3a164cc88c2b2025718bda78b0",
    sha256: "e1ce62193a28c1c032766702f8c8ff5f3cc087ca475a460bd586b9bd2e0de3eb"
  })
]);
export const currentFullSystemHarmonyShadowReadinessSuccessor = Object.freeze({
  commit: "029ef1254aa41b6ba129424e9b3deaf3afe6a2f8",
  parent: "0e312cbef36af838dd9f8ba434f2370605f384d4",
  tree: "6658d930458909a4ba627f39c4f49d3f18c1de9f",
  identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
  subject: "intelligence: compose harmony scoring successor",
  evidence: Object.freeze([
    Object.freeze({
      path: "scripts/verify-shadow-decision-readiness.mjs",
      sha256: "856b7f43150cc4eba0a9fee6d2df2f4254f32026dd64d92829cd4df74f17e364"
    })
  ])
});
const currentFullSystemHarmonyShadowReadinessSuccessorHashes = new Map(
  currentFullSystemHarmonyShadowReadinessSuccessor.evidence.map(item => [
    item.path,
    item.sha256
  ])
);
export const currentLiveCanonicalIdentityShadowReadinessRepair = Object.freeze({
  commit: "0515e5993547e5e1b3a0b5897f12ac53060a8b35",
  parent: "cad76ff923278a84245c42749c8d3d1cceb78f4d",
  tree: "4bcc06a1c15e74e8a7673d21afa8659721ee264a",
  identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
  subject: "intelligence: compose canonical archive successor",
  evidence: Object.freeze([
    Object.freeze({
      path: "scripts/verify-shadow-decision-readiness.mjs",
      sha256: "0ef3dff897cb9ed90dd90a81b55e09e7a8649153192c943fd595a8a1f144b12b"
    }),
    Object.freeze({
      path: "tests/shadow-decision-readiness.test.mjs",
      sha256: "726510bdd55114d81ae0cc1290b884d851f6b1b5dc0b7107e0bd9f78e9e1b4b6"
    })
  ])
});
const currentLiveCanonicalIdentityShadowReadinessRepairHashes = new Map(
  currentLiveCanonicalIdentityShadowReadinessRepair.evidence.map(item => [
    item.path,
    item.sha256
  ])
);
export const currentLiveCanonicalIdentityProtectedConsumerCompositionRepair =
  Object.freeze({
    commit: "a6e85f05fe57a5bff8b2fc6bc168f541272ac0b8",
    parent: "c1d0cf056e6cd13689254a062636be783a1a66c7",
    tree: "efadb319180da76a28787843f7132252d7866625",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: compose canonical protected consumers",
    evidence: Object.freeze([
      Object.freeze({
        path: "intelligence/provenance/verify-paid-customer-revenue-readiness-protected-consumers-v1.mjs",
        sha256: "da7660a5e7e846f772ee9ef59d8bae502a2c43942a2eeec65639d4df9ba687cb"
      }),
      Object.freeze({
        path: "tests/intelligence-architecture.test.mjs",
        sha256: "dd7449ad92b8932b9d7dc0fe29d25f7f2e3a4b931726f1400d35156476e0a00c"
      })
    ])
  });
const currentLiveCanonicalIdentityProtectedConsumerCompositionRepairHashes =
  new Map(
    currentLiveCanonicalIdentityProtectedConsumerCompositionRepair.evidence
      .map(item => [item.path, item.sha256])
  );
export const currentLiveCanonicalIdentityOffRouteBaselineRepair = Object.freeze({
  commit: "db74fd379f0624f3abfaf1ddee1827c3fe4f1e60",
  parent: "daa461ebc3d359117e78f14bca2c6da92726524b",
  tree: "aefdf1f611c138827f731235fb1caa673a58a136",
  identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
  subject: "intelligence: compose canonical off-route baseline",
  evidence: Object.freeze([
    Object.freeze({
      path: "tests/off-route-learning-intelligence.test.mjs",
      sha256: "5c24ea2615105a3e9403450ee4e68747c8508257eec4ca844a070b8a6b9395e0"
    })
  ])
});
const currentLiveCanonicalIdentityOffRouteBaselineRepairHashes = new Map(
  currentLiveCanonicalIdentityOffRouteBaselineRepair.evidence.map(item => [
    item.path,
    item.sha256
  ])
);
export const currentProtectedDriftFixtureIntelligenceSuccessor = Object.freeze({
  commit: "ff63d927c121a0030a0cbb1f041a626ffe7968bc",
  parent: "f17802246b06dbd1aca0f56fb257de34d78ecb24",
  tree: "79601cf5e229578ebc44efc07908a9352d6d3575",
  identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
  subject: "intelligence: align protected drift rejection fixture",
  evidence: Object.freeze([
    Object.freeze({
      path: "tests/read-only-field-session-learning.test.mjs",
      sha256: "0966415b41fb51742fd8328efbec5dce6f0c1d137abb48c37726ed15824e8cdc"
    })
  ])
});
const currentProtectedDriftFixtureIntelligenceSuccessorHashes = new Map(
  currentProtectedDriftFixtureIntelligenceSuccessor.evidence.map(item => [
    item.path,
    item.sha256
  ])
);
const currentAugust1IntelligenceSuccessorPaths = [
  "intelligence/contracts/shadow-decision-readiness-contracts.json",
  "intelligence/provenance/protected-baseline-synchronization-route-iq-august-1-launch-closeout-v1.json",
  "scripts/verify-shadow-decision-readiness.mjs"
].sort();
const currentIntelligenceSuccessorCommits = [
  "cd0a504328b0870aa695731230e6c43dd4698e3c",
  "ed46fb0964187a207468cd89fbdc1fbbb8426748",
  "e0f14743867bf765f05225e0321f2596741b8c70",
  "21471fb1c5f32c18e4356434af71e0d63925d969"
];
const historicalCanonicalCommit = "ed46fb0964187a207468cd89fbdc1fbbb8426748";
const currentIntelligenceOwnerSuccessorCommit = "21471fb1c5f32c18e4356434af71e0d63925d969";
const mappingPath = "overwatch/artifact-contracts/provenance/route-iq-release-provenance-repair-v1.json";
const controlledRehearsalGovernancePath =
  "git:c7119fcee140ab8a130cdb888439277fdcbeb6b0:overwatch/governance/controlled-paid-customer-onboarding-rehearsal-v1.json";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";
const dashboardContractPath = "overwatch/artifact-contracts/workspaces/fitness-connection/dashboard-consumer-contract-v1.json";
const intelligenceEvidencePath = "intelligence/provenance/legacy-provenance-gap-049cf583-v1.json";
const protectedBaselineSuccessorPath =
  "intelligence/provenance/protected-baseline-synchronization-batch-20260714-002-v1.json";
const routeQualitySuccessorPath =
  "intelligence/provenance/protected-baseline-synchronization-batch-20260714-002-route-quality-successor-v1.json";
const commercialRouteQualitySuccessorPath =
  "intelligence/provenance/protected-baseline-synchronization-batch-20260718-002-data-route-quality-successor-v1.json";
const investorWebsiteRouteQualitySuccessorPath =
  "intelligence/provenance/protected-baseline-synchronization-batch-20260719-002-data-route-quality-successor-v1.json";
const restored3dRouteQualitySuccessorPath =
  "intelligence/provenance/protected-baseline-synchronization-batch-20260719-006-data-route-quality-successor-v1.json";
const publicClaimsEvidenceMatrixPath =
  "data/route-iq-commercial-readiness-v1/route-iq-public-claims-evidence-matrix-v1.json";
const batchOneReportPath = "overwatch/reports/BATCH-20260713-001-route-iq-shadow-decision-readiness.json";
const dashboardEvidencePath = "dashboard/decision-context-producer-validation-v1.md";
const expectedPreBatchCommits = [
  "2774d91456e4b1734eb1caa13deaa84de2248f8f",
  "fc8f9c6a8acf04a80e4d5f93485225dfefea9407",
  "232e192a9fa5a14641d411896d43a0495a46ae01",
  "13c0bbfb72b72e1b492369fdfe896fffbddefaa6",
  legacyCommit
];

const intelligenceContractPaths = [
  "intelligence/contracts/read-only-field-session-learning-contracts.json",
  "intelligence/contracts/off-route-learning-intelligence-contracts.json",
  "intelligence/contracts/discovery-mode-intelligence-v2-contracts.json",
  "intelligence/contracts/nearby-context-intelligence-v2-contracts.json"
];

const expectedLegacyPaths = [
  ...intelligenceContractPaths,
  dashboardContractPath
].sort();

const expectedIntelligenceRepairPaths = [
  "intelligence/README.md",
  "intelligence/contracts/discovery-mode-intelligence-v2-contracts.json",
  "intelligence/contracts/nearby-context-intelligence-v2-contracts.json",
  "intelligence/contracts/off-route-learning-intelligence-contracts.json",
  "intelligence/contracts/read-only-field-session-learning-contracts.json",
  "intelligence/contracts/shadow-decision-readiness-contracts.json",
  "intelligence/provenance/legacy-provenance-gap-049cf583-v1.json",
  "intelligence/provenance/reconstruct-legacy-protected-contracts-v1.mjs",
  "scripts/validate-intelligence-architecture.mjs",
  "tests/intelligence-architecture.test.mjs"
].sort();

const expectedProtectedBaselineSuccessorPaths = [
  "intelligence/contracts/discovery-mode-intelligence-v2-contracts.json",
  "intelligence/contracts/nearby-context-intelligence-v2-contracts.json",
  "intelligence/contracts/off-route-learning-intelligence-contracts.json",
  "intelligence/contracts/read-only-field-session-learning-contracts.json",
  "intelligence/contracts/shadow-decision-readiness-contracts.json",
  protectedBaselineSuccessorPath,
  "scripts/validate-intelligence-architecture.mjs",
  "tests/intelligence-architecture.test.mjs"
].sort();

const expectedRouteQualityDataPaths = [
  "data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/route-intelligence-golden-route-quality-report.json",
  "scripts/lib/route-intelligence-quality-gate.mjs",
  "tests/route-intelligence-quality-gate.test.mjs"
].sort();

const expectedInvestorWebsiteRouteQualitySuccessorPaths = [
  "intelligence/contracts/route-iq-public-intelligence-claims-v1.json",
  "intelligence/contracts/shadow-decision-readiness-contracts.json",
  investorWebsiteRouteQualitySuccessorPath,
  "scripts/verify-shadow-decision-readiness.mjs",
  "tests/route-iq-commercial-readiness-intelligence-data-route-quality-successor.test.mjs",
  "tests/shadow-decision-readiness.test.mjs"
].sort();

const expectedRestored3dRouteQualitySuccessorPaths = [
  "intelligence/contracts/route-iq-public-intelligence-claims-v1.json",
  "intelligence/contracts/shadow-decision-readiness-contracts.json",
  restored3dRouteQualitySuccessorPath,
  "scripts/verify-shadow-decision-readiness.mjs",
  "tests/route-iq-commercial-readiness-intelligence-data-route-quality-successor.test.mjs",
  "tests/shadow-decision-readiness.test.mjs"
].sort();

const expectedRouteQualitySuccessorPaths = [
  "intelligence/contracts/shadow-decision-readiness-contracts.json",
  routeQualitySuccessorPath,
  "scripts/validate-intelligence-architecture.mjs",
  "scripts/verify-shadow-decision-readiness.mjs",
  "tests/intelligence-architecture.test.mjs",
  "tests/shadow-decision-readiness.test.mjs"
].sort();

const expectedCurrentIntelligenceSuccessorPaths = new Map([
  [
    currentIntelligenceSuccessorCommits[0],
    [
      "intelligence/config/shadow-decision-readiness-v1.json",
      "intelligence/contracts/discovery-mode-intelligence-v2-contracts.json",
      "intelligence/contracts/nearby-context-intelligence-v2-contracts.json",
      "intelligence/contracts/off-route-learning-intelligence-contracts.json",
      "intelligence/contracts/read-only-field-session-learning-contracts.json",
      "intelligence/contracts/shadow-decision-readiness-contracts.json",
      "intelligence/provenance/legacy-provenance-gap-049cf583-v1.json",
      "intelligence/shadow-decision-readiness.md",
      "scripts/verify-shadow-decision-readiness.mjs",
      "tests/shadow-decision-readiness.test.mjs"
    ].sort()
  ],
  [
    currentIntelligenceSuccessorCommits[1],
    [
      "intelligence/contracts/shadow-decision-readiness-contracts.json",
      "intelligence/provenance/legacy-provenance-gap-049cf583-v1.json",
      "scripts/verify-shadow-decision-readiness.mjs",
      "tests/shadow-decision-readiness.test.mjs"
    ].sort()
  ],
  [
    currentIntelligenceSuccessorCommits[2],
    [
      "intelligence/contracts/off-route-learning-intelligence-contracts.json",
      "intelligence/contracts/read-only-field-session-learning-contracts.json",
      "intelligence/contracts/shadow-decision-readiness-contracts.json",
      "intelligence/off-route-learning-intelligence.mjs",
      "intelligence/read-only-field-session-learning.mjs",
      "scripts/verify-shadow-decision-readiness.mjs",
      "tests/off-route-learning-intelligence.test.mjs",
      "tests/read-only-field-session-learning.test.mjs",
      "tests/shadow-decision-readiness.test.mjs"
    ].sort()
  ],
  [
    currentIntelligenceSuccessorCommits[3],
    [
      "intelligence/README.md",
      "intelligence/provenance/legacy-provenance-gap-049cf583-v1.json",
      "intelligence/provenance/reconstruct-legacy-protected-contracts-v1.mjs",
      "intelligence/provenance/specifications/administrative-disposition-admission-v1.json",
      "tests/intelligence-architecture.test.mjs"
    ].sort()
  ]
]);

const exactGitReferencePattern = /^git:([0-9a-f]{40}):(.+)$/;
const read = path => {
  const historical = exactGitReferencePattern.exec(path);
  return historical
    ? gitBytes("show", `${historical[1]}:${historical[2]}`)
    : fs.readFileSync(path);
};
const readJson = path => JSON.parse(read(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortJson(value[key])]));
  }
  return value;
}

const semanticSha256 = value => sha256(JSON.stringify(sortJson(value)));

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function gitBytes(...args) {
  return execFileSync("git", args, { maxBuffer: 16 * 1024 * 1024 });
}

export const currentLeanPhase1ActiveArchitectureDecoupling = Object.freeze({
  path: "tests/intelligence-architecture.test.mjs",
  suite: "core",
  closure: Object.freeze({
    commit: "cd7834c0096ce204683907b06c447869ecd167f9",
    parent: "b01d1851def2ef771d8f7c5936df8f51f120010f",
    tree: "d01eb3822ae902122a8c819d607e0f9850f0da13",
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    subject: "intelligence: decouple active architecture verification"
  }),
  previousSha256: "b35f6bb9d978113170f987fd10cc273fbc176343ed330e079deb1cdad83c0223",
  decoupledSha256: "77bf9009b17173ba545367ead048984a1587d3c8ffbf07af79ea6789625e3034"
});

let leanPhase1ActiveArchitectureDecouplingValidated = false;
export function validateLeanPhase1ActiveArchitectureDecoupling(
  candidate = currentLeanPhase1ActiveArchitectureDecoupling
) {
  assert.deepEqual(
    candidate,
    currentLeanPhase1ActiveArchitectureDecoupling,
    "Lean Phase 1 active architecture decoupling drifted."
  );
  if (leanPhase1ActiveArchitectureDecouplingValidated) return candidate;
  const leanSuccessor =
    verifyControlledOnboardingRehearsalSmokeContractSuccessor()
      .leanPhase1ProtectedSuccessor;
  assert.deepEqual(leanSuccessor.successor.provenanceClosure, candidate.closure);
  assert.deepEqual(changedPaths(candidate.closure.commit), [candidate.path]);
  assert.deepEqual(git(
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    candidate.closure.commit
  ).split("\n"), [
    candidate.closure.commit,
    candidate.closure.parent,
    candidate.closure.tree,
    candidate.closure.identity,
    candidate.closure.identity,
    candidate.closure.subject
  ]);
  assert.equal(
    sha256(gitBytes("show", `${candidate.closure.parent}:${candidate.path}`)),
    candidate.previousSha256
  );
  assert.equal(
    sha256(gitBytes("show", `${candidate.closure.commit}:${candidate.path}`)),
    candidate.decoupledSha256
  );
  assert.notEqual(candidate.previousSha256, candidate.decoupledSha256);

  const assignments = Object.entries(readJson("tests/test-suites.v1.json").suites)
    .filter(([, files]) => files.includes(candidate.path))
    .map(([suite]) => suite);
  assert.deepEqual(assignments, [candidate.suite]);
  leanPhase1ActiveArchitectureDecouplingValidated = true;
  return candidate;
}

function isLeanPhase1ActiveArchitectureVerification(path) {
  if (path !== currentLeanPhase1ActiveArchitectureDecoupling.path) return false;
  validateLeanPhase1ActiveArchitectureDecoupling();
  return true;
}

function assertCurrentIntelligenceSource(path, expectedSha256, message) {
  const currentSha256 = sha256(read(path));
  assert.equal(
    currentSha256 === expectedSha256
      || isLeanPhase1ActiveArchitectureVerification(path),
    true,
    message
  );
}

let leanPhase1TransitionsByPath;
function currentLeanPhase1TransitionsByPath() {
  if (!leanPhase1TransitionsByPath) {
    const leanSuccessor =
      verifyControlledOnboardingRehearsalSmokeContractSuccessor()
        .leanPhase1ProtectedSuccessor;
    leanPhase1TransitionsByPath = new Map(
      [...leanSuccessor.transitionsByPath]
        .map(([path, transitions]) => [path, [...transitions]])
    );
    validateLeanPhase1ActiveArchitectureDecoupling();
  }
  return leanPhase1TransitionsByPath;
}

function changedPaths(commit) {
  const output = git("diff-tree", "--no-commit-id", "--name-only", "-r", commit);
  return output ? output.split("\n").sort() : [];
}

function verifyExactDashboardCommit({ commit, parent, tree, subject, paths }) {
  const fields = git(
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s", commit
  ).split("\n");
  assert.deepEqual(fields, [
    commit,
    parent,
    tree,
    "Prometheus Dashboard <dashboard@prometheus.local>",
    "Prometheus Dashboard <dashboard@prometheus.local>",
    subject
  ]);
  assert.deepEqual(changedPaths(commit), [...paths].sort());
  assert.doesNotThrow(() => git("merge-base", "--is-ancestor", commit, "HEAD"));
}

function verifyCurrentAugust1IntelligenceSuccessor() {
  const fields = git(
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    currentAugust1IntelligenceSuccessorCommit
  ).split("\n");
  assert.deepEqual(fields, [
    currentAugust1IntelligenceSuccessorCommit,
    currentAugust1IntelligenceSuccessorParent,
    currentAugust1IntelligenceSuccessorTree,
    "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    "Synchronize shadow-readiness runtime baselines"
  ]);
  assert.deepEqual(
    changedPaths(currentAugust1IntelligenceSuccessorCommit),
    currentAugust1IntelligenceSuccessorPaths
  );
  assert.doesNotThrow(() => git(
    "merge-base", "--is-ancestor", currentAugust1IntelligenceSuccessorCommit, "HEAD"
  ));
}

function isCurrentAugust1IntelligenceTransition(path, previousSha256, currentSha256) {
  if (!currentAugust1IntelligenceSuccessorPaths.includes(path)) return false;
  const previous = sha256(gitBytes(
    "show", `${currentAugust1IntelligenceSuccessorParent}:${path}`
  ));
  const accepted = sha256(gitBytes(
    "show", `${currentAugust1IntelligenceSuccessorCommit}:${path}`
  ));
  return previous === previousSha256
    && accepted === currentSha256
    && sha256(read(path)) === currentSha256;
}

function isCurrentCrossIndustryIntelligenceTransition(path, currentSha256) {
  const successor = readJson(currentCrossIndustryIntelligenceSuccessorPath);
  const transition = successor.intelligenceConsumerTransitions.find(
    record => record.path === path
  );
  if (transition) {
    return transition.currentSha256 === currentSha256
      && sha256(gitBytes(
        "show", `${currentCrossIndustryIntelligenceSuccessorCommit}:${path}`
      )) === currentSha256
      && sha256(read(path)) === currentSha256;
  }

  const coherenceSha256 = currentCrossIndustryCoherencePaths.get(path);
  return coherenceSha256 === currentSha256
    && sha256(gitBytes("show", `${currentCrossIndustryCoherenceCommit}:${path}`))
      === currentSha256
    && sha256(read(path)) === currentSha256;
}

function isCurrentZipFounderAccessIntelligenceTransition(path, currentSha256) {
  if (!currentZipFounderAccessIntelligencePaths.includes(path)) return false;
  const fields = git(
    "show",
    "-s",
    "--format=%H%n%T%n%P%n%an <%ae>%n%cn <%ce>%n%s",
    currentZipFounderAccessIntelligenceCommit
  ).split("\n");
  return JSON.stringify(fields) === JSON.stringify([
    currentZipFounderAccessIntelligenceCommit,
    currentZipFounderAccessIntelligenceTree,
    currentZipFounderAccessIntelligenceParent,
    "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    "intelligence: adopt ZIP and Founder dashboard baseline"
  ])
    && JSON.stringify(changedPaths(currentZipFounderAccessIntelligenceCommit))
      === JSON.stringify(currentZipFounderAccessIntelligencePaths)
    && sha256(gitBytes(
      "show", `${currentZipFounderAccessIntelligenceCommit}:${path}`
    )) === currentSha256
    && sha256(read(path)) === currentSha256;
}

function verifyCurrentPaidCustomerIntelligenceSuccessor() {
  const fields = git(
    "show",
    "-s",
    "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    currentPaidCustomerIntelligenceSuccessorCommit
  ).split("\n");
  assert.deepEqual(fields, [
    currentPaidCustomerIntelligenceSuccessorCommit,
    currentPaidCustomerIntelligenceSuccessorParent,
    currentPaidCustomerIntelligenceSuccessorTree,
    "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    "intelligence: adopt paid-customer protected baselines"
  ]);
  assert.deepEqual(
    changedPaths(currentPaidCustomerIntelligenceSuccessorCommit),
    currentPaidCustomerIntelligenceSuccessorPaths
  );
  assert.doesNotThrow(() => git(
    "merge-base",
    "--is-ancestor",
    currentPaidCustomerIntelligenceSuccessorCommit,
    "HEAD"
  ));
}

function isPaidCustomerIntelligenceTransition(
  path,
  previousSha256,
  currentSha256
) {
  if (!currentPaidCustomerIntelligenceSuccessorPaths.includes(path)) return false;
  return sha256(gitBytes(
    "show",
    `${currentPaidCustomerIntelligenceSuccessorParent}:${path}`
  )) === previousSha256
    && sha256(gitBytes(
      "show",
      `${currentPaidCustomerIntelligenceSuccessorCommit}:${path}`
    )) === currentSha256;
}

function isCurrentPaidCustomerIntelligenceTransition(
  path,
  previousSha256,
  currentSha256
) {
  return isPaidCustomerIntelligenceTransition(path, previousSha256, currentSha256)
    && sha256(read(path)) === currentSha256;
}

function verifyCurrentPrivateSmokeTimeoutIntelligenceSuccessor() {
  const fields = git(
    "show",
    "-s",
    "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    currentPrivateSmokeTimeoutIntelligenceSuccessorCommit
  ).split("\n");
  assert.deepEqual(fields, [
    currentPrivateSmokeTimeoutIntelligenceSuccessorCommit,
    currentPrivateSmokeTimeoutIntelligenceSuccessorParent,
    currentPrivateSmokeTimeoutIntelligenceSuccessorTree,
    "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    "Synchronize private smoke timeout provenance"
  ]);
  assert.deepEqual(
    changedPaths(currentPrivateSmokeTimeoutIntelligenceSuccessorCommit),
    currentPrivateSmokeTimeoutIntelligenceSuccessorPaths
  );
  assert.doesNotThrow(() => git(
    "merge-base",
    "--is-ancestor",
    currentPaidCustomerIntelligenceSuccessorCommit,
    currentPrivateSmokeTimeoutIntelligenceSuccessorCommit
  ));
  assert.doesNotThrow(() => git(
    "merge-base",
    "--is-ancestor",
    currentPrivateSmokeTimeoutIntelligenceSuccessorCommit,
    "HEAD"
  ));
}

function isPrivateSmokeTimeoutIntelligenceTransition(
  path,
  previousSha256,
  currentSha256
) {
  if (!currentPrivateSmokeTimeoutIntelligenceSuccessorPaths.includes(path)) return false;
  const predecessorSha256 = sha256(gitBytes(
    "show",
    `${currentPrivateSmokeTimeoutIntelligenceSuccessorParent}:${path}`
  ));
  const predecessorIsGoverned = predecessorSha256 === previousSha256
    || isPaidCustomerIntelligenceTransition(
      path,
      previousSha256,
      predecessorSha256
    );
  return predecessorIsGoverned
    && sha256(gitBytes(
      "show",
      `${currentPrivateSmokeTimeoutIntelligenceSuccessorCommit}:${path}`
    )) === currentSha256;
}

function isCurrentPrivateSmokeTimeoutIntelligenceTransition(
  path,
  previousSha256,
  currentSha256
) {
  return isPrivateSmokeTimeoutIntelligenceTransition(
    path,
    previousSha256,
    currentSha256
  ) && sha256(read(path)) === currentSha256;
}

function validateCurrentIntelligenceSuccessor(record, expected, label) {
  assert.deepEqual(record, expected, `${label} mapping drifted.`);
  assert.deepEqual(git(
    "show",
    "-s",
    "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    record.commit
  ).split("\n"), [
    record.commit,
    record.parent,
    record.tree,
    record.identity,
    record.identity,
    record.subject
  ], `${label} provenance drifted.`);
  assert.deepEqual(changedPaths(record.commit),
    record.evidence.map(item => item.path).sort(), `${label} path set drifted.`);
  const governance = readJson(fullSystemHarmonyGovernancePath);
  const ownerMatches = governance.ownerCommits.filter(item => (
    item.commit === record.commit && item.owner === record.identity
  ));
  assert.equal(ownerMatches.length, 1, `${label} owner evidence drifted.`);
  for (const item of record.evidence) {
    assert.equal(sha256(gitBytes("show", `${record.commit}:${item.path}`)),
      item.sha256, `${item.path} ${label} owner hash drifted.`);
  }
  return record;
}

export function validateFullSystemHarmonyIntelligenceSuccessor(
  record = currentFullSystemHarmonyIntelligenceSuccessor
) {
  return validateCurrentIntelligenceSuccessor(
    record,
    currentFullSystemHarmonyIntelligenceSuccessor,
    "Full-System Harmony Intelligence successor"
  );
}

export function validateLiveCanonicalIdentityIntelligenceSuccessor(
  record = currentLiveCanonicalIdentityIntelligenceSuccessor
) {
  assert.deepEqual(
    record,
    currentLiveCanonicalIdentityIntelligenceSuccessor,
    "Live canonical identity Intelligence successor mapping drifted."
  );
  assert.deepEqual(git(
    "show",
    "-s",
    "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    record.commit
  ).split("\n"), [
    record.commit,
    record.parent,
    record.tree,
    record.identity,
    record.identity,
    record.subject
  ], "Live canonical identity Intelligence successor provenance drifted.");
  assert.deepEqual(
    changedPaths(record.commit),
    record.evidence.map(item => item.path).sort(),
    "Live canonical identity Intelligence successor path set drifted."
  );
  const governance = readJson(privateWorkflowGovernancePath).ownership;
  assert.deepEqual(
    governance.intelligenceLiveCanonicalIdentitySuccessorCommit,
    {
      commit: record.commit,
      parent: record.parent,
      tree: record.tree,
      author: record.identity,
      committer: record.identity,
      subject: record.subject
    },
    "Live canonical identity Intelligence owner evidence drifted."
  );
  for (const item of record.evidence) {
    assert.equal(
      sha256(gitBytes("show", `${record.commit}:${item.path}`)),
      item.sha256,
      `${item.path} live canonical identity owner hash drifted.`
    );
  }
  return record;
}

export function validateFieldSessionReportTypeIntelligenceSuccessor(
  record = currentFieldSessionReportTypeIntelligenceSuccessor
) {
  assert.deepEqual(
    record,
    currentFieldSessionReportTypeIntelligenceSuccessor,
    "Field-session report-type Intelligence successor mapping drifted."
  );
  assert.deepEqual(git(
    "show",
    "-s",
    "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    record.commit
  ).split("\n"), [
    record.commit,
    record.parent,
    record.tree,
    record.identity,
    record.identity,
    record.subject
  ], "Field-session report-type Intelligence successor provenance drifted.");
  assert.deepEqual(
    changedPaths(record.commit),
    record.evidence.map(item => item.path).sort(),
    "Field-session report-type Intelligence successor path set drifted."
  );
  const governance = readJson(fieldSessionReportTypeGovernancePath);
  const ownerMatches = governance.ownerCommits.filter(item => (
    item.commit === record.commit
    && item.parent === record.parent
    && item.tree === record.tree
    && item.identity === record.identity
    && item.subject === record.subject
    && JSON.stringify([...item.paths].sort()) ===
      JSON.stringify(record.evidence.map(evidence => evidence.path).sort())
  ));
  assert.equal(ownerMatches.length, 1,
    "Field-session report-type Intelligence owner evidence drifted.");
  for (const item of record.evidence) {
    assert.equal(
      sha256(gitBytes("show", `${record.commit}:${item.path}`)),
      item.sha256,
      `${item.path} field-session report-type owner hash drifted.`
    );
  }
  return record;
}

export function validateFieldSessionReportTypeDriftRejectionSuccessor(
  record = currentFieldSessionReportTypeDriftRejectionSuccessor
) {
  assert.deepEqual(
    record,
    currentFieldSessionReportTypeDriftRejectionSuccessor,
    "Field-session report-type drift-rejection successor mapping drifted."
  );
  assert.deepEqual(git(
    "show",
    "-s",
    "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    record.commit
  ).split("\n"), [
    record.commit,
    record.parent,
    record.tree,
    record.identity,
    record.identity,
    record.subject
  ], "Field-session report-type drift-rejection provenance drifted.");
  assert.deepEqual(
    changedPaths(record.commit),
    record.evidence.map(item => item.path).sort(),
    "Field-session report-type drift-rejection path set drifted."
  );
  const governance = readJson(fieldSessionReportTypeGovernancePath);
  const ownerMatches = governance.ownerCommits.filter(item => (
    item.commit === record.commit
    && item.parent === record.parent
    && item.tree === record.tree
    && item.identity === record.identity
    && item.subject === record.subject
    && JSON.stringify([...item.paths].sort()) ===
      JSON.stringify(record.evidence.map(evidence => evidence.path).sort())
  ));
  assert.equal(ownerMatches.length, 1,
    "Field-session report-type drift-rejection owner evidence drifted.");
  for (const item of record.evidence) {
    assert.equal(
      sha256(gitBytes("show", `${record.commit}:${item.path}`)),
      item.sha256,
      `${item.path} field-session report-type drift-rejection hash drifted.`
    );
  }
  return record;
}

export function validateProtectedDriftFixtureIntelligenceSuccessor(
  record = currentProtectedDriftFixtureIntelligenceSuccessor
) {
  return validateCurrentIntelligenceSuccessor(
    record,
    currentProtectedDriftFixtureIntelligenceSuccessor,
    "Protected-drift fixture Intelligence successor"
  );
}

export function validateFullSystemHarmonyShadowReadinessSuccessor(
  record = currentFullSystemHarmonyShadowReadinessSuccessor
) {
  return validateCurrentIntelligenceSuccessor(
    record,
    currentFullSystemHarmonyShadowReadinessSuccessor,
    "Full-System Harmony shadow-readiness successor"
  );
}

export function validateLiveCanonicalIdentityShadowReadinessRepair(
  record = currentLiveCanonicalIdentityShadowReadinessRepair
) {
  assert.deepEqual(
    record,
    currentLiveCanonicalIdentityShadowReadinessRepair,
    "Live canonical identity shadow-readiness repair mapping drifted."
  );
  assert.deepEqual(git(
    "show",
    "-s",
    "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    record.commit
  ).split("\n"), [
    record.commit,
    record.parent,
    record.tree,
    record.identity,
    record.identity,
    record.subject
  ], "Live canonical identity shadow-readiness repair provenance drifted.");
  assert.deepEqual(
    changedPaths(record.commit),
    record.evidence.map(item => item.path).sort(),
    "Live canonical identity shadow-readiness repair path set drifted."
  );
  const governance = readJson(liveCanonicalIdentityGovernancePath);
  const ownerMatches = governance.protectedConsumerSuccessors.filter(item => (
    item.commit === record.commit
    && item.tree === record.tree
    && item.owner === record.identity
  ));
  assert.equal(ownerMatches.length, 1,
    "Live canonical identity shadow-readiness owner evidence drifted.");
  for (const item of record.evidence) {
    assert.equal(
      sha256(gitBytes("show", `${record.commit}:${item.path}`)),
      item.sha256,
      `${item.path} live canonical shadow-readiness owner hash drifted.`
    );
  }
  return record;
}

export function validateLiveCanonicalIdentityProtectedConsumerCompositionRepair(
  record = currentLiveCanonicalIdentityProtectedConsumerCompositionRepair
) {
  assert.deepEqual(
    record,
    currentLiveCanonicalIdentityProtectedConsumerCompositionRepair,
    "Live canonical identity protected-consumer repair mapping drifted."
  );
  assert.deepEqual(git(
    "show",
    "-s",
    "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    record.commit
  ).split("\n"), [
    record.commit,
    record.parent,
    record.tree,
    record.identity,
    record.identity,
    record.subject
  ], "Live canonical identity protected-consumer repair provenance drifted.");
  assert.deepEqual(
    changedPaths(record.commit),
    record.evidence.map(item => item.path).sort(),
    "Live canonical identity protected-consumer repair path set drifted."
  );
  const governance = readJson(liveCanonicalIdentityGovernancePath);
  const ownerMatches = governance.protectedConsumerSuccessors.filter(item => (
    item.commit === record.commit
    && item.tree === record.tree
    && item.owner === record.identity
  ));
  assert.equal(ownerMatches.length, 1,
    "Live canonical identity protected-consumer owner evidence drifted.");
  for (const item of record.evidence) {
    assert.equal(
      sha256(gitBytes("show", `${record.commit}:${item.path}`)),
      item.sha256,
      `${item.path} live canonical protected-consumer owner hash drifted.`
    );
  }
  return record;
}

export function validateLiveCanonicalIdentityOffRouteBaselineRepair(
  record = currentLiveCanonicalIdentityOffRouteBaselineRepair
) {
  assert.deepEqual(
    record,
    currentLiveCanonicalIdentityOffRouteBaselineRepair,
    "Live canonical identity off-route baseline repair mapping drifted."
  );
  assert.deepEqual(git(
    "show",
    "-s",
    "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    record.commit
  ).split("\n"), [
    record.commit,
    record.parent,
    record.tree,
    record.identity,
    record.identity,
    record.subject
  ], "Live canonical identity off-route baseline repair provenance drifted.");
  assert.deepEqual(
    changedPaths(record.commit),
    record.evidence.map(item => item.path).sort(),
    "Live canonical identity off-route baseline repair path set drifted."
  );
  const governance = readJson(liveCanonicalIdentityGovernancePath);
  const ownerMatches = governance.protectedConsumerSuccessors.filter(item => (
    item.commit === record.commit
    && item.tree === record.tree
    && item.owner === record.identity
  ));
  assert.equal(ownerMatches.length, 1,
    "Live canonical identity off-route baseline owner evidence drifted.");
  for (const item of record.evidence) {
    assert.equal(
      sha256(gitBytes("show", `${record.commit}:${item.path}`)),
      item.sha256,
      `${item.path} live canonical off-route baseline owner hash drifted.`
    );
  }
  return record;
}

export function validateGovernedLearningIntelligenceSuccessorChain(
  records = currentGovernedLearningIntelligenceSuccessorChain
) {
  assert.deepEqual(
    records,
    currentGovernedLearningIntelligenceSuccessorChain,
    "Governed-learning Intelligence successor chain drifted."
  );
  const governance = readJson(governedLearningGovernancePath);
  const ownerCommits = new Set(governance.ownerCommits
    .filter(record => record.owner ===
      "Prometheus Intelligence Engine <intelligence@prometheus.local>")
    .map(record => record.commit));
  const transitionsByPath = new Map();

  for (const record of records) {
    const pathTransitions = transitionsByPath.get(record.path) || [];
    const previousTransition = pathTransitions.at(-1);
    if (previousTransition) {
      assert.equal(record.previousSha256, previousTransition.sha256,
        "Governed-learning Intelligence predecessor chain drifted.");
    }
    assert.deepEqual(git(
      "show",
      "-s",
      "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
      record.commit
    ).split("\n"), [
      record.commit,
      record.parent,
      record.tree,
      record.identity,
      record.identity,
      record.subject
    ], "Governed-learning Intelligence owner provenance drifted.");
    assert.deepEqual(
      changedPaths(record.commit),
      [...(record.commitPaths || [record.path])].sort()
    );
    assert.equal(ownerCommits.has(record.commit), true,
      "Governed-learning Intelligence owner commit is absent from governance.");
    assert.doesNotThrow(() => git(
      "merge-base",
      "--is-ancestor",
      record.commit,
      "HEAD"
    ));
    assert.equal(
      sha256(gitBytes("show", `${record.parent}:${record.path}`)),
      record.previousSha256,
      "Governed-learning Intelligence predecessor bytes drifted."
    );
    assert.equal(
      sha256(gitBytes("show", `${record.commit}:${record.path}`)),
      record.sha256,
      "Governed-learning Intelligence successor bytes drifted."
    );
    pathTransitions.push(record);
    transitionsByPath.set(record.path, pathTransitions);
  }

  const prospectiveSuccessor =
    validateProspectiveCalibrationIntelligenceSuccessorChain();
  for (const [path, transitions] of transitionsByPath) {
    const prospectiveTransitions =
      prospectiveSuccessor.transitionsByPath.get(path);
    const gymTransitions =
      prospectiveSuccessor.gymTransitionsByPath.get(path);
    const visualTransitions =
      prospectiveSuccessor.visualTransitionsByPath.get(path);
    const representativeTransitions =
      prospectiveSuccessor.representativeTransitionsByPath.get(path);
    const leanTransitions = prospectiveSuccessor.leanTransitionsByPath.get(path);
    const preVisualSha256 = gymTransitions
      ? gymTransitions.at(-1).currentSha256
      : prospectiveTransitions
        ? prospectiveTransitions.at(-1).sha256
        : transitions.at(-1).sha256;
    if (visualTransitions) {
      assert.equal(visualTransitions[0].previousSha256, preVisualSha256,
        `Dashboard visual predecessor drifted: ${path}`);
    }
    const preRepresentativeSha256 = visualTransitions
      ? visualTransitions.at(-1).currentSha256
      : preVisualSha256;
    if (representativeTransitions) {
      assert.equal(
        representativeTransitions[0].previousSha256,
        preRepresentativeSha256,
        `Representative runtime predecessor drifted: ${path}`
      );
    }
    const preLeanSha256 = representativeTransitions
      ? representativeTransitions.at(-1).currentSha256
      : preRepresentativeSha256;
    if (leanTransitions) {
      assert.equal(leanTransitions[0].previousSha256, preLeanSha256,
        `Lean Phase 1 predecessor drifted: ${path}`);
    }
    const expectedCurrentSha256 = leanTransitions
      ? leanTransitions.at(-1).currentSha256
      : preLeanSha256;
    assertCurrentIntelligenceSource(
      path,
      expectedCurrentSha256,
      `Current governed-learning Intelligence successor drifted: ${path}`
    );
  }
  const verifierTransitions = transitionsByPath.get(
    retentionDeletionIntelligenceVerifierPath
  );
  return Object.freeze({
    terminalCommit: verifierTransitions.at(-1).commit,
    terminalSha256: verifierTransitions.at(-1).sha256,
    transitionCount: records.length,
    protectedPathCount: transitionsByPath.size,
    transitionsByPath,
    prospectiveTransitionsByPath: prospectiveSuccessor.transitionsByPath,
    gymTransitionsByPath: prospectiveSuccessor.gymTransitionsByPath,
    visualTransitionsByPath: prospectiveSuccessor.visualTransitionsByPath,
    representativeTransitionsByPath:
      prospectiveSuccessor.representativeTransitionsByPath,
    leanTransitionsByPath: prospectiveSuccessor.leanTransitionsByPath
  });
}

export function validateProspectiveCalibrationIntelligenceSuccessorChain(
  candidateRecords = null
) {
  const governance = readJson(prospectiveCalibrationGovernancePath);
  const provenanceBytes = read(prospectiveCalibrationIntelligenceProvenancePath);
  const provenance = JSON.parse(provenanceBytes);
  assert.equal(
    sha256(provenanceBytes),
    prospectiveCalibrationIntelligenceProvenanceSha256,
    "Prospective-calibration Intelligence provenance drifted."
  );
  assert.deepEqual(
    governance.criticalPins.find(
      item => item.path === prospectiveCalibrationIntelligenceProvenancePath
    ),
    {
      path: prospectiveCalibrationIntelligenceProvenancePath,
      sha256: prospectiveCalibrationIntelligenceProvenanceSha256
    }
  );
  assert.equal(provenance.batchId, "BATCH-20260814-001");
  assert.equal(provenance.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(provenance.truthState.governedLearning, "INSUFFICIENT_EVIDENCE");
  assert.equal(provenance.truthState.shadowEligibleDecisions, 0);
  assert.equal(provenance.protectedState.collection, "OFF");
  assert.equal(provenance.protectedState.activeCohorts, 0);
  assert.equal(provenance.protectedState.recommendationInfluence, "OFF");

  const identity = "Prometheus Intelligence Engine <intelligence@prometheus.local>";
  const ownerCommits = new Set([
    ...governance.functionalOwnerCommits.map(record => record.commit),
    ...governance.qualificationRepairCommits.map(record => record.commit),
    ...governance.provenanceAndCompatibilityCommits
  ]);
  const canonicalRecords = [
    ...provenance.protectedSourceTransitions.filter(
      transition => transition.ownerSubsystem === "Prometheus Intelligence Engine"
    ),
    ...provenance.coherenceSourceTransitions
  ].map(transition => Object.freeze({
    path: transition.path,
    commit: transition.commit,
    parent: git("show", "-s", "--format=%P", transition.commit),
    tree: transition.tree,
    identity,
    subject: transition.subject,
    previousSha256: transition.previousSha256,
    sha256: transition.currentSha256
  }));
  const records = candidateRecords || canonicalRecords;
  assert.deepEqual(
    records,
    canonicalRecords,
    "Prospective-calibration Intelligence successor chain drifted."
  );

  const transitionsByPath = new Map();
  for (const record of records) {
    assert.equal(ownerCommits.has(record.commit), true,
      "Prospective-calibration Intelligence owner commit is absent from governance.");
    assert.deepEqual(git(
      "show",
      "-s",
      "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
      record.commit
    ).split("\n"), [
      record.commit,
      record.parent,
      record.tree,
      record.identity,
      record.identity,
      record.subject
    ], "Prospective-calibration Intelligence owner provenance drifted.");
    assert.equal(changedPaths(record.commit).includes(record.path), true,
      "Prospective-calibration transition is absent from its owner commit.");
    assert.doesNotThrow(() => git(
      "merge-base",
      "--is-ancestor",
      record.commit,
      "HEAD"
    ));
    assert.equal(
      sha256(gitBytes("show", `${record.parent}:${record.path}`)),
      record.previousSha256,
      "Prospective-calibration Intelligence predecessor bytes drifted."
    );
    assert.equal(
      sha256(gitBytes("show", `${record.commit}:${record.path}`)),
      record.sha256,
      "Prospective-calibration Intelligence successor bytes drifted."
    );
    const pathTransitions = transitionsByPath.get(record.path) || [];
    const previousTransition = pathTransitions.at(-1);
    if (previousTransition) {
      assert.equal(record.previousSha256, previousTransition.sha256,
        "Prospective-calibration Intelligence predecessor chain drifted.");
    }
    pathTransitions.push(record);
    transitionsByPath.set(record.path, pathTransitions);
  }

  const newSourceArtifacts = provenance.newSourceArtifacts.filter(
    artifact => artifact.ownerSubsystem === "Prometheus Intelligence Engine"
  );
  const gymSuccessor =
    validateGymPreviewRouteQualityIntelligenceSuccessorChain();
  const visualSuccessor = validateDashboardVisualProtectedConsumerSuccessor();
  const representativeSuccessor =
    validateRepresentativeIntelligenceRuntimeSurfaceSuccessor();
  const leanTransitionsByPath = currentLeanPhase1TransitionsByPath();
  for (const artifact of newSourceArtifacts) {
    assert.equal(ownerCommits.has(artifact.commit), true,
      "Prospective-calibration new-source owner commit is absent from governance.");
    assert.equal(changedPaths(artifact.commit).includes(artifact.path), true,
      "Prospective-calibration new source is absent from its owner commit.");
    assert.equal(
      sha256(gitBytes("show", `${artifact.commit}:${artifact.path}`)),
      artifact.sha256,
      "Prospective-calibration new-source owner bytes drifted."
    );
    const gymTransitions = gymSuccessor.transitionsByPath.get(artifact.path);
    const visualTransitions = visualSuccessor.transitionsByPath.get(artifact.path);
    const representativeTransitions =
      representativeSuccessor.transitionsByPath.get(artifact.path);
    const leanTransitions = leanTransitionsByPath.get(artifact.path);
    const preVisualSha256 = gymTransitions
      ? gymTransitions.at(-1).currentSha256
      : artifact.sha256;
    if (gymTransitions) {
      assert.equal(gymTransitions[0].previousSha256, artifact.sha256,
        `Gym-preview predecessor drifted: ${artifact.path}`);
    }
    if (visualTransitions) {
      assert.equal(visualTransitions[0].previousSha256, preVisualSha256,
        `Dashboard visual predecessor drifted: ${artifact.path}`);
    }
    const preRepresentativeSha256 = visualTransitions
      ? visualTransitions.at(-1).currentSha256
      : preVisualSha256;
    if (representativeTransitions) {
      assert.equal(
        representativeTransitions[0].previousSha256,
        preRepresentativeSha256,
        `Representative runtime predecessor drifted: ${artifact.path}`
      );
    }
    const preLeanSha256 = representativeTransitions
      ? representativeTransitions.at(-1).currentSha256
      : preRepresentativeSha256;
    if (leanTransitions) {
      assert.equal(leanTransitions[0].previousSha256, preLeanSha256,
        `Lean Phase 1 predecessor drifted: ${artifact.path}`);
    }
    const expectedCurrentSha256 = leanTransitions
      ? leanTransitions.at(-1).currentSha256
      : preLeanSha256;
    assertCurrentIntelligenceSource(
      artifact.path,
      expectedCurrentSha256,
      `Current prospective-calibration source drifted: ${artifact.path}`
    );
  }
  for (const [path, transitions] of transitionsByPath) {
    const gymTransitions = gymSuccessor.transitionsByPath.get(path);
    const visualTransitions = visualSuccessor.transitionsByPath.get(path);
    const representativeTransitions =
      representativeSuccessor.transitionsByPath.get(path);
    const leanTransitions = leanTransitionsByPath.get(path);
    const preVisualSha256 = gymTransitions
      ? gymTransitions.at(-1).currentSha256
      : transitions.at(-1).sha256;
    if (gymTransitions) {
      assert.equal(
        gymTransitions[0].previousSha256,
        transitions.at(-1).sha256,
        `Gym-preview predecessor drifted: ${path}`
      );
    }
    if (visualTransitions) {
      assert.equal(
        visualTransitions[0].previousSha256,
        preVisualSha256,
        `Dashboard visual predecessor drifted: ${path}`
      );
    }
    const preRepresentativeSha256 = visualTransitions
      ? visualTransitions.at(-1).currentSha256
      : preVisualSha256;
    if (representativeTransitions) {
      assert.equal(
        representativeTransitions[0].previousSha256,
        preRepresentativeSha256,
        `Representative runtime predecessor drifted: ${path}`
      );
    }
    const preLeanSha256 = representativeTransitions
      ? representativeTransitions.at(-1).currentSha256
      : preRepresentativeSha256;
    if (leanTransitions) {
      assert.equal(leanTransitions[0].previousSha256, preLeanSha256,
        `Lean Phase 1 predecessor drifted: ${path}`);
    }
    const expectedCurrentSha256 = leanTransitions
      ? leanTransitions.at(-1).currentSha256
      : preLeanSha256;
    assertCurrentIntelligenceSource(
      path,
      expectedCurrentSha256,
      `Current prospective-calibration Intelligence successor drifted: ${path}`
    );
  }
  const verifierTransition = transitionsByPath.get(
    retentionDeletionIntelligenceVerifierPath
  ).at(-1);
  return Object.freeze({
    terminalCommit: verifierTransition.commit,
    terminalSha256: verifierTransition.sha256,
    transitionCount: records.length,
    protectedPathCount: transitionsByPath.size,
    newSourceArtifactCount: newSourceArtifacts.length,
    records,
    transitionsByPath,
    gymTransitionsByPath: gymSuccessor.transitionsByPath,
    visualTransitionsByPath: visualSuccessor.transitionsByPath,
    representativeTransitionsByPath: representativeSuccessor.transitionsByPath,
    leanTransitionsByPath
  });
}

export function validateGymPreviewRouteQualityIntelligenceSuccessorChain(
  candidateTransitions = null
) {
  const canonicalTransitions = readJson(
    gymPreviewRouteQualityIntelligenceProvenancePath
  ).protectedSourceTransitions;
  const transitions = candidateTransitions || canonicalTransitions;
  assert.deepEqual(
    transitions,
    canonicalTransitions,
    "Gym-preview route-quality Intelligence successor chain drifted."
  );
  const currentFingerprint = sha256(Buffer.from(JSON.stringify({
    provenance: sha256(read(gymPreviewRouteQualityIntelligenceProvenancePath)),
    protectedSources: [...new Set(canonicalTransitions.map(({ path }) => path))]
      .sort()
      .map(path => ({ path, sha256: sha256(read(path)) }))
  })));
  if (!candidateTransitions
    && gymPreviewRouteQualityValidationCache?.fingerprint === currentFingerprint) {
    return gymPreviewRouteQualityValidationCache.result;
  }
  const verified = verifyGymPreviewRouteQualityRuntimeSurfaceSuccessor();
  assert.equal(verified.successor.batchId, "BATCH-20260814-002");
  assert.equal(verified.successor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.deepEqual(verified.successor.protectedState, {
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    confidencePropagation: "OFF",
    providers: "OFF",
    scheduler: "OFF",
    shadowDecisionVisible: false,
    productionStorageAccess: 0,
    cloudflareContacts: 0,
    deployments: 0,
    productionMutationPerformed: false
  });
  const canonicalCommits = new Set(
    canonicalTransitions.map(transition => transition.commit)
  );
  const historicalTransitionsByPath = new Map();
  for (const [path, pathTransitions] of verified.transitionsByPath) {
    const historicalTransitions = pathTransitions.filter(
      transition => canonicalCommits.has(transition.commit)
    );
    if (historicalTransitions.length > 0) {
      historicalTransitionsByPath.set(path, historicalTransitions);
    }
  }
  const verifierTransitions = historicalTransitionsByPath.get(
    retentionDeletionIntelligenceVerifierPath
  );
  const result = Object.freeze({
    terminalCommit: verifierTransitions.at(-1).commit,
    terminalSha256: verifierTransitions.at(-1).currentSha256,
    transitionCount: transitions.length,
    protectedPathCount: historicalTransitionsByPath.size,
    records: transitions,
    transitionsByPath: historicalTransitionsByPath
  });
  if (!candidateTransitions) {
    gymPreviewRouteQualityValidationCache = Object.freeze({
      fingerprint: currentFingerprint,
      result
    });
  }
  return result;
}

export function validateRepresentativeIntelligenceRuntimeSurfaceSuccessor() {
  if (representativeIntelligenceRuntimeSurfaceValidationCache) {
    return representativeIntelligenceRuntimeSurfaceValidationCache;
  }
  const canonicalSuccessor = readJson(
    representativeIntelligenceRuntimeSurfaceProvenancePath
  );
  const verified = verifyControlledOnboardingRehearsalSmokeContractSuccessor()
    .representativeIntelligenceRuntimeSurfaceSuccessor;
  assert.deepEqual(verified.successor, canonicalSuccessor);
  assert.equal(
    canonicalSuccessor.version,
    "route-iq-intelligence-representative-runtime-surface-successor-v1"
  );
  assert.equal(canonicalSuccessor.batchId, "BATCH-20260815-002");
  assert.equal(canonicalSuccessor.status, "OWNER_IMPLEMENTED_PROTECTED_SUCCESSOR");
  assert.equal(canonicalSuccessor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(canonicalSuccessor.behavior.previousRuntimeFileCount, 34);
  assert.equal(canonicalSuccessor.behavior.currentRuntimeFileCount, 35);
  assert.equal(canonicalSuccessor.behavior.routeOrderingChanged, false);
  assert.equal(canonicalSuccessor.behavior.routeScoringChanged, false);
  assert.equal(canonicalSuccessor.behavior.businessHoursEligibilityChanged, false);
  assert.equal(canonicalSuccessor.behavior.recommendationBehaviorChanged, false);
  assert.equal(canonicalSuccessor.protectedState.collection, "OFF");
  assert.equal(canonicalSuccessor.protectedState.activeCohorts, 0);
  assert.equal(canonicalSuccessor.protectedState.recommendationInfluence, "OFF");
  assert.equal(canonicalSuccessor.protectedState.productionStorageAccess, 0);
  assert.equal(canonicalSuccessor.protectedState.deployments, 0);
  assert.equal(canonicalSuccessor.protectedState.productionMutationPerformed, false);
  representativeIntelligenceRuntimeSurfaceValidationCache = Object.freeze({
    successor: canonicalSuccessor,
    transitionsByPath: verified.transitionsByPath
  });
  return representativeIntelligenceRuntimeSurfaceValidationCache;
}

function validateDashboardVisualOwnerTransitions() {
  if (dashboardVisualOwnerTransitionCache) {
    return dashboardVisualOwnerTransitionCache;
  }
  const records = [
    {
      path: dashboardVisualIdentityProvenancePath,
      version: "route-iq-intelligence-dashboard-public-visual-identity-successor-v1"
    },
    {
      path: dashboardVisualVerifierCompositionProvenancePath,
      version:
        "route-iq-intelligence-dashboard-public-visual-verifier-composition-successor-v1"
    }
  ];
  const transitionsByPath = new Map();
  for (const descriptor of records) {
    const record = readJson(descriptor.path);
    assert.equal(record.version, descriptor.version);
    assert.equal(record.batchId, "BATCH-20260815-001");
    assert.equal(record.status, "OWNER_REVIEWED_PROTECTED_COHERENCE_SUCCESSOR");
    assert.equal(record.ownerSubsystem, "Prometheus Intelligence Engine");
    const predecessors = record.predecessors || [record.predecessor];
    for (const predecessor of predecessors) {
      assert.equal(sha256(read(predecessor.path)), predecessor.sha256);
      assert.equal(predecessor.remainsHistorical, true);
      assert.equal(predecessor.rewritten, false);
    }
    const implementations = record.implementationCommits || record.implementations;
    for (const implementation of implementations) {
      assert.deepEqual(git(
        "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
        implementation.commit
      ).split("\n"), [
        implementation.commit,
        implementation.parent,
        implementation.tree,
        implementation.identity,
        implementation.identity,
        implementation.subject
      ]);
      if (implementation.changedPaths) {
        assert.deepEqual(changedPaths(implementation.commit),
          [...implementation.changedPaths].sort());
      }
      assert.doesNotThrow(() => git(
        "merge-base", "--is-ancestor", implementation.commit, "HEAD"
      ));
    }
    for (const transition of record.protectedSourceTransitions) {
      const implementation = implementations.find(
        (entry) => entry.commit === transition.commit
      );
      assert.ok(implementation,
        `Dashboard visual owner commit is absent: ${transition.commit}`);
      assert.equal(transition.tree, implementation.tree);
      assert.equal(transition.subject, implementation.subject);
      assert.equal(
        sha256(gitBytes("show", `${implementation.parent}:${transition.path}`)),
        transition.previousSha256
      );
      assert.equal(
        sha256(gitBytes("show", `${implementation.commit}:${transition.path}`)),
        transition.currentSha256
      );
      const priorTransitions = transitionsByPath.get(transition.path) || [];
      if (priorTransitions.length > 0) {
        assert.equal(
          transition.previousSha256,
          priorTransitions.at(-1).currentSha256,
          `Dashboard visual owner chain drifted: ${transition.path}`
        );
      }
      transitionsByPath.set(transition.path, [...priorTransitions, transition]);
    }
    assert.equal(record.protectedState.collection, "OFF");
    assert.equal(record.protectedState.activeCohorts, 0);
    assert.equal(record.protectedState.recommendationInfluence, "OFF");
    assert.equal(record.protectedState.productionStorageAccess, 0);
    assert.equal(record.protectedState.deployments, 0);
    assert.equal(record.protectedState.productionMutationPerformed, false);
  }
  dashboardVisualOwnerTransitionCache = Object.freeze({
    records,
    transitionsByPath
  });
  return dashboardVisualOwnerTransitionCache;
}

export function validateDashboardVisualProtectedConsumerSuccessor(
  candidateSuccessor = null
) {
  const canonicalSuccessor = readJson(dashboardVisualProtectedConsumerProvenancePath);
  const successor = candidateSuccessor || canonicalSuccessor;
  assert.deepEqual(successor, canonicalSuccessor,
    "Dashboard visual protected-consumer successor drifted.");
  assert.equal(successor.version,
    "route-iq-intelligence-dashboard-public-visual-protected-consumer-successor-v1");
  assert.equal(successor.batchId, "BATCH-20260815-001");
  assert.equal(successor.status, "OWNER_REVIEWED_PROTECTED_CONSUMER_SUCCESSOR");
  assert.equal(successor.ownerSubsystem, "Prometheus Intelligence Engine");
  for (const predecessor of successor.predecessors) {
    assert.equal(sha256(read(predecessor.path)), predecessor.sha256);
    assert.equal(predecessor.remainsHistorical, true);
    assert.equal(predecessor.rewritten, false);
  }
  const implementation = successor.implementation;
  assert.deepEqual(git(
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    implementation.commit
  ).split("\n"), [
    implementation.commit,
    implementation.parent,
    implementation.tree,
    implementation.identity,
    implementation.identity,
    implementation.subject
  ]);
  assert.deepEqual(changedPaths(implementation.commit),
    [...implementation.changedPaths].sort());
  assert.doesNotThrow(() => git(
    "merge-base", "--is-ancestor", implementation.commit, "HEAD"
  ));
  const ownerTransitions = validateDashboardVisualOwnerTransitions();
  const transitionsByPath = new Map(
    [...ownerTransitions.transitionsByPath].map(([path, transitions]) => [
      path,
      [...transitions]
    ])
  );
  for (const transition of successor.protectedSourceTransitions) {
    assert.equal(implementation.changedPaths.includes(transition.path), true);
    assert.equal(
      sha256(gitBytes("show", `${implementation.parent}:${transition.path}`)),
      transition.previousSha256
    );
    assert.equal(
      sha256(gitBytes("show", `${implementation.commit}:${transition.path}`)),
      transition.currentSha256
    );
    const priorTransitions = transitionsByPath.get(transition.path) || [];
    if (priorTransitions.length > 0) {
      assert.equal(
        transition.previousSha256,
        priorTransitions.at(-1).currentSha256,
        `Dashboard visual protected-consumer chain drifted: ${transition.path}`
      );
    }
    transitionsByPath.set(transition.path, [...priorTransitions, transition]);
  }
  assert.equal(successor.protectedSourceTransitions.length, 2);
  assert.deepEqual(successor.behavior, {
    dashboardVisualSuccessorComposed: true,
    historicalEvidenceRewritten: false,
    intelligenceRuntimeChanged: false,
    routeOrderingChanged: false,
    routeScoringChanged: false,
    recommendationBehaviorChanged: false
  });
  assert.deepEqual(successor.protectedState, {
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    confidencePropagation: "OFF",
    providers: "OFF",
    scheduler: "OFF",
    productionStorageAccess: 0,
    deployments: 0,
    productionMutationPerformed: false
  });
  return Object.freeze({ successor, transitionsByPath });
}

export function validateRetentionDeletionIntelligenceSuccessorChain(
  records = currentRetentionDeletionIntelligenceSuccessorChain,
  maintenanceRecord = currentRetentionMaintenanceIntelligenceSuccessor
) {
  assert.deepEqual(
    records,
    currentRetentionDeletionIntelligenceSuccessorChain,
    "Retention-deletion Intelligence successor chain drifted."
  );
  assert.deepEqual(
    maintenanceRecord,
    currentRetentionMaintenanceIntelligenceSuccessor,
    "Retention-maintenance Intelligence successor record drifted."
  );
  const governance = readJson(retentionDeletionGovernancePath);
  const maintenanceGovernance = readJson(retentionMaintenanceGovernancePath);
  const runtimeProvenance = readJson(retentionDeletionRuntimeProvenancePath);
  const consumerProvenance = readJson(
    retentionDeletionConsumerAdmissionProvenancePath
  );
  const maintenanceProvenance = readJson(maintenanceRecord.path);
  const ownerCommits = new Set([
    ...governance.ownership.commits["Prometheus Intelligence Engine"],
    ...maintenanceGovernance.ownership.commits
      .filter(record => record.subsystem === "Prometheus Intelligence Engine")
      .map(record => record.commit)
  ]);
  assert.deepEqual(
    governance.qualificationRepair.liveCanonicalIdentity.protectedSuccessor,
    {
      path: retentionDeletionRuntimeProvenancePath,
      sha256: sha256(read(retentionDeletionRuntimeProvenancePath))
    }
  );
  assert.deepEqual(governance.intelligenceBoundary.consumerAdmissionProvenance, {
    path: retentionDeletionConsumerAdmissionProvenancePath,
    sha256: sha256(read(retentionDeletionConsumerAdmissionProvenancePath))
  });
  assert.deepEqual(maintenanceGovernance.intelligenceSuccessor, {
    path: maintenanceRecord.path,
    sha256: maintenanceRecord.sha256,
    consumerBehaviorChanged: false,
    recommendationBehaviorChanged: false
  });
  assert.equal(sha256(read(maintenanceRecord.path)), maintenanceRecord.sha256,
    "Retention-maintenance Intelligence successor bytes drifted.");
  assert.equal(
    maintenanceProvenance.implementation.commit,
    maintenanceRecord.implementationCommit,
    "Retention-maintenance Intelligence implementation commit drifted."
  );
  assert.equal(
    maintenanceProvenance.coherenceImplementation.commit,
    maintenanceRecord.coherenceCommit,
    "Retention-maintenance Intelligence coherence commit drifted."
  );
  assert.equal(maintenanceProvenance.composition.consumerExclusionSemanticsChanged, false);
  assert.equal(maintenanceProvenance.composition.recommendationBehaviorChanged, false);
  assert.equal(maintenanceProvenance.composition.deploymentAuthorityGranted, false);
  assert.equal(maintenanceProvenance.composition.deletionAuthorityGranted, false);
  assert.equal(maintenanceProvenance.boundaries.collection, "OFF");
  assert.equal(maintenanceProvenance.boundaries.activeCohorts, 0);
  assert.equal(maintenanceProvenance.boundaries.recommendationInfluence, "OFF");

  const provenanceTransitions = [
    ...runtimeProvenance.protectedSourceTransitions.filter(
      transition => transition.ownerSubsystem === "Prometheus Intelligence Engine"
    ),
    ...consumerProvenance.protectedSourceTransitions,
    consumerProvenance.coherenceSourceTransition,
    consumerProvenance.negativeFixtureSourceTransition,
    ...maintenanceProvenance.protectedSourceTransitions,
    maintenanceProvenance.coherenceSourceTransition
  ].map(transition => Object.freeze({
    ...transition,
    parent: git("show", "-s", "--format=%P", transition.commit),
    identity: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    sha256: transition.currentSha256
  }));
  const uniqueTransitions = new Map();
  for (const record of [...records, ...provenanceTransitions]) {
    const key = `${record.path}:${record.commit}`;
    const existing = uniqueTransitions.get(key);
    if (existing) {
      assert.equal(record.tree, existing.tree);
      assert.equal(record.subject, existing.subject);
      assert.equal(record.previousSha256, existing.previousSha256);
      assert.equal(record.sha256, existing.sha256);
      continue;
    }
    uniqueTransitions.set(key, record);
  }
  const transitionsByPath = new Map();

  for (const record of uniqueTransitions.values()) {
    const pathTransitions = transitionsByPath.get(record.path) || [];
    const previousTransition = pathTransitions.at(-1);
    if (previousTransition) {
      assert.equal(record.previousSha256, previousTransition.sha256,
        "Retention-deletion Intelligence predecessor chain drifted.");
    }
    assert.deepEqual(git(
      "show",
      "-s",
      "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
      record.commit
    ).split("\n"), [
      record.commit,
      record.parent,
      record.tree,
      record.identity,
      record.identity,
      record.subject
    ], "Retention-deletion Intelligence owner provenance drifted.");
    assert.doesNotThrow(() => git(
      "merge-base",
      "--is-ancestor",
      record.commit,
      "HEAD"
    ));
    assert.equal(ownerCommits.has(record.commit), true,
      "Retention-deletion Intelligence owner commit is absent from governance.");
    assert.equal(
      sha256(gitBytes(
        "show",
        `${record.parent}:${record.path}`
      )),
      record.previousSha256,
      "Retention-deletion Intelligence predecessor bytes drifted."
    );
    assert.equal(
      sha256(gitBytes(
        "show",
        `${record.commit}:${record.path}`
      )),
      record.sha256,
      "Retention-deletion Intelligence successor bytes drifted."
    );
    pathTransitions.push(record);
    transitionsByPath.set(record.path, pathTransitions);
  }

  const historicalVerifierTransition = records
    .filter(record => record.path === retentionDeletionIntelligenceVerifierPath)
    .at(-1);
  assert.deepEqual(governance.qualificationRepair.liveCanonicalIdentity.verifier, {
    path: retentionDeletionIntelligenceVerifierPath,
    sha256: historicalVerifierTransition.sha256
  });
  const verifierTransition = transitionsByPath.get(
    retentionDeletionIntelligenceVerifierPath
  ).at(-1);
  const governedLearningSuccessor =
    validateGovernedLearningIntelligenceSuccessorChain();
  for (const [path, transitions] of transitionsByPath) {
    const governedTransitions = governedLearningSuccessor.transitionsByPath.get(path);
    const prospectiveTransitions =
      governedLearningSuccessor.prospectiveTransitionsByPath.get(path);
    const gymTransitions =
      governedLearningSuccessor.gymTransitionsByPath.get(path);
    const visualTransitions =
      governedLearningSuccessor.visualTransitionsByPath.get(path);
    const representativeTransitions =
      governedLearningSuccessor.representativeTransitionsByPath.get(path);
    const leanTransitions =
      governedLearningSuccessor.leanTransitionsByPath.get(path);
    const preVisualSha256 = gymTransitions
      ? gymTransitions.at(-1).currentSha256
      : prospectiveTransitions
        ? prospectiveTransitions.at(-1).sha256
        : governedTransitions
          ? governedTransitions.at(-1).sha256
          : transitions.at(-1).sha256;
    const preRepresentativeSha256 = visualTransitions
      ? visualTransitions.at(-1).currentSha256
      : preVisualSha256;
    if (representativeTransitions) {
      assert.equal(
        representativeTransitions[0].previousSha256,
        preRepresentativeSha256,
        `Representative runtime predecessor drifted: ${path}`
      );
    }
    const preLeanSha256 = representativeTransitions
      ? representativeTransitions.at(-1).currentSha256
      : preRepresentativeSha256;
    if (leanTransitions) {
      assert.equal(
        leanTransitions[0].previousSha256,
        preLeanSha256,
        `Lean Phase 1 predecessor drifted: ${path}`
      );
    }
    const expectedCurrentSha256 = leanTransitions
      ? leanTransitions.at(-1).currentSha256
      : preLeanSha256;
    assertCurrentIntelligenceSource(
      path,
      expectedCurrentSha256,
      `Current retention-deletion Intelligence successor drifted: ${path}`
    );
  }
  return Object.freeze({
    terminalCommit: verifierTransition.commit,
    terminalVerifierSha256: verifierTransition.sha256,
    transitionCount: uniqueTransitions.size,
    protectedPathCount: transitionsByPath.size,
    transitionsByPath
  });
}

function composeCurrentIntelligenceSha256(path, previousSha256) {
  let expectedSha256 = previousSha256;
  for (const [record, hashes, label] of [
    [
      currentFullSystemHarmonyIntelligenceSuccessor,
      currentFullSystemHarmonyIntelligenceSuccessorHashes,
      "Full-System Harmony"
    ],
    [
      currentFullSystemHarmonyShadowReadinessSuccessor,
      currentFullSystemHarmonyShadowReadinessSuccessorHashes,
      "Full-System Harmony shadow-readiness"
    ],
    [
      currentProtectedDriftFixtureIntelligenceSuccessor,
      currentProtectedDriftFixtureIntelligenceSuccessorHashes,
      "protected-drift fixture"
    ],
    [
      currentLiveCanonicalIdentityIntelligenceSuccessor,
      currentLiveCanonicalIdentityIntelligenceSuccessorHashes,
      "live canonical identity"
    ],
    [
      currentLiveCanonicalIdentityShadowReadinessRepair,
      currentLiveCanonicalIdentityShadowReadinessRepairHashes,
      "live canonical identity shadow-readiness"
    ],
    [
      currentLiveCanonicalIdentityProtectedConsumerCompositionRepair,
      currentLiveCanonicalIdentityProtectedConsumerCompositionRepairHashes,
      "live canonical identity protected-consumer composition"
    ],
    [
      currentLiveCanonicalIdentityOffRouteBaselineRepair,
      currentLiveCanonicalIdentityOffRouteBaselineRepairHashes,
      "live canonical identity off-route baseline"
    ],
    [
      currentFieldSessionReportTypeIntelligenceSuccessor,
      currentFieldSessionReportTypeIntelligenceSuccessorHashes,
      "field-session report type"
    ],
    [
      currentFieldSessionReportTypeDriftRejectionSuccessor,
      currentFieldSessionReportTypeDriftRejectionSuccessorHashes,
      "field-session report type drift rejection"
    ]
  ]) {
    const successorSha256 = hashes.get(path);
    if (!successorSha256) continue;
    assert.equal(
      sha256(gitBytes("show", `${record.parent}:${path}`)),
      expectedSha256,
      `${path} ${label} predecessor drifted.`
    );
    expectedSha256 = successorSha256;
  }
  const retentionSuccessor = validateRetentionDeletionIntelligenceSuccessorChain();
  const retentionTransitions = retentionSuccessor.transitionsByPath.get(path);
  if (retentionTransitions) {
    assert.equal(
      expectedSha256,
      retentionTransitions[0].previousSha256,
      "Retention-deletion Intelligence composition predecessor drifted."
    );
    expectedSha256 = retentionTransitions.at(-1).sha256;
  }
  const governedLearningSuccessor =
    validateGovernedLearningIntelligenceSuccessorChain();
  const governedLearningTransitions =
    governedLearningSuccessor.transitionsByPath.get(path);
  if (governedLearningTransitions) {
    assert.equal(
      expectedSha256,
      governedLearningTransitions[0].previousSha256,
      "Governed-learning Intelligence composition predecessor drifted."
    );
    expectedSha256 = governedLearningTransitions.at(-1).sha256;
  }
  const prospectiveTransitions =
    governedLearningSuccessor.prospectiveTransitionsByPath.get(path);
  if (prospectiveTransitions) {
    assert.equal(
      expectedSha256,
      prospectiveTransitions[0].previousSha256,
      "Prospective-calibration Intelligence composition predecessor drifted."
    );
    expectedSha256 = prospectiveTransitions.at(-1).sha256;
  }
  const gymTransitions =
    governedLearningSuccessor.gymTransitionsByPath.get(path);
  if (gymTransitions) {
    assert.equal(
      expectedSha256,
      gymTransitions[0].previousSha256,
      "Gym-preview route-quality Intelligence composition predecessor drifted."
    );
    expectedSha256 = gymTransitions.at(-1).currentSha256;
  }
  const visualTransitions =
    governedLearningSuccessor.visualTransitionsByPath.get(path);
  if (visualTransitions) {
    assert.equal(
      expectedSha256,
      visualTransitions[0].previousSha256,
      "Dashboard visual Intelligence composition predecessor drifted."
    );
    expectedSha256 = visualTransitions.at(-1).currentSha256;
  }
  const representativeTransitions =
    governedLearningSuccessor.representativeTransitionsByPath.get(path);
  if (representativeTransitions) {
    assert.equal(
      expectedSha256,
      representativeTransitions[0].previousSha256,
      "Representative runtime Intelligence composition predecessor drifted."
    );
    expectedSha256 = representativeTransitions.at(-1).currentSha256;
  }
  const leanTransitions =
    governedLearningSuccessor.leanTransitionsByPath.get(path);
  if (leanTransitions) {
    assert.equal(
      expectedSha256,
      leanTransitions[0].previousSha256,
      "Lean Phase 1 Intelligence composition predecessor drifted."
    );
    expectedSha256 = leanTransitions.at(-1).currentSha256;
  }
  return expectedSha256;
}

function isComposedCurrentIntelligenceTransition(
  path,
  previousSha256,
  currentSha256
) {
  try {
    return composeCurrentIntelligenceSha256(path, previousSha256)
      === currentSha256;
  } catch {
    return false;
  }
}

function isCurrentLeanPhase1IntelligenceTransition(path, currentSha256) {
  const transitions = currentLeanPhase1TransitionsByPath().get(path);
  return Boolean(
    transitions
      && transitions.at(-1).currentSha256 === currentSha256
      && sha256(read(path)) === currentSha256
  );
}

function isCurrentProspectiveCalibrationIntelligenceTransition(
  path,
  currentSha256
) {
  const successor = validateProspectiveCalibrationIntelligenceSuccessorChain();
  const transitions = successor.transitionsByPath.get(path);
  return Boolean(transitions)
    && transitions.at(-1).sha256 === currentSha256;
}

function isCurrentRetentionDeletionIntelligenceTransition(
  hardenedSmokeGuardTransitions,
  path,
  previousSha256,
  currentSha256
) {
  const retentionSuccessor = validateRetentionDeletionIntelligenceSuccessorChain();
  const retentionTransitions = retentionSuccessor.transitionsByPath.get(path);
  if (!retentionTransitions) return false;
  const predecessorSha256 = retentionTransitions[0].previousSha256;
  const historicalAnchorIsGoverned = previousSha256 === sha256(gitBytes(
    "show",
    `${restored3dRouteQualitySuccessorCommit}:${path}`
  )) && git(
    "merge-base",
    "--is-ancestor",
    restored3dRouteQualitySuccessorCommit,
    retentionTransitions[0].commit
  ) === "";
  const predecessorIsGoverned = historicalAnchorIsGoverned
    || previousSha256 === predecessorSha256
    || isCurrentAugust1IntelligenceTransition(
      path,
      previousSha256,
      predecessorSha256
    )
    || isCurrentCrossIndustryIntelligenceTransition(path, predecessorSha256)
    || isCurrentZipFounderAccessIntelligenceTransition(path, predecessorSha256)
    || isCurrentHardenedSmokeGuardIntelligenceTransition(
      hardenedSmokeGuardTransitions,
      path,
      predecessorSha256
    )
    || isCurrentLeanPhase1IntelligenceTransition(path, currentSha256)
    || isComposedCurrentIntelligenceTransition(
      path,
      previousSha256,
      predecessorSha256
    );
  return predecessorIsGoverned
    && currentSha256 === retentionTransitions.at(-1).sha256;
}

export function validateRevenueReadinessIntelligenceSuccessor(record) {
  validateFullSystemHarmonyIntelligenceSuccessor();
  validateLiveCanonicalIdentityIntelligenceSuccessor();
  validateFieldSessionReportTypeIntelligenceSuccessor();
  validateFieldSessionReportTypeDriftRejectionSuccessor();
  validateFullSystemHarmonyShadowReadinessSuccessor();
  validateLiveCanonicalIdentityShadowReadinessRepair();
  validateLiveCanonicalIdentityProtectedConsumerCompositionRepair();
  validateLiveCanonicalIdentityOffRouteBaselineRepair();
  validateProtectedDriftFixtureIntelligenceSuccessor();
  assert.deepEqual(record, currentRevenueReadinessIntelligenceSuccessor,
    "Revenue-readiness Intelligence successor mapping drifted.");
  assert.deepEqual(git(
    "show",
    "-s",
    "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    record.commit
  ).split("\n"), [
    record.commit,
    record.parent,
    record.tree,
    record.identity,
    record.identity,
    record.subject
  ]);
  assert.deepEqual(changedPaths(record.commit),
    record.evidence.map(item => item.path).sort());
  assert.doesNotThrow(() => git(
    "merge-base",
    "--is-ancestor",
    record.commit,
    "HEAD"
  ));
  for (const item of record.evidence) {
    assert.equal(sha256(gitBytes("show", `${record.commit}:${item.path}`)),
      item.sha256, `${item.path} revenue-readiness owner hash drifted.`);
    assert.equal(
      sha256(read(item.path)),
      composeCurrentIntelligenceSha256(item.path, item.sha256),
      `${item.path} current revenue-readiness successor drifted.`);
  }
  return record;
}

function verifyCurrentControlledRehearsalIntelligenceSuccessor() {
  const fields = git(
    "show",
    "-s",
    "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    currentControlledRehearsalIntelligenceSuccessorCommit
  ).split("\n");
  assert.deepEqual(fields, [
    currentControlledRehearsalIntelligenceSuccessorCommit,
    currentControlledRehearsalIntelligenceSuccessorParent,
    currentControlledRehearsalIntelligenceSuccessorTree,
    "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    "intelligence: adopt controlled rehearsal smoke contract"
  ]);
  assert.deepEqual(
    changedPaths(currentControlledRehearsalIntelligenceSuccessorCommit),
    currentControlledRehearsalIntelligenceSuccessorPaths
  );
  assert.doesNotThrow(() => git(
    "merge-base",
    "--is-ancestor",
    currentControlledRehearsalIntelligenceSuccessorCommit,
    "HEAD"
  ));

  const governance = readJson(controlledRehearsalGovernancePath);
  const record = governance.ownership.ownerCommits.find(
    owner => owner.commit === currentControlledRehearsalIntelligenceSuccessorCommit
  );
  assert.ok(record, "Controlled-rehearsal Intelligence owner evidence is missing.");
  assert.equal(record.parent, currentControlledRehearsalIntelligenceSuccessorParent);
  assert.equal(record.tree, currentControlledRehearsalIntelligenceSuccessorTree);
  assert.equal(
    record.identity,
    "Prometheus Intelligence Engine <intelligence@prometheus.local>"
  );
  assert.equal(record.subject, "intelligence: adopt controlled rehearsal smoke contract");
  const evidence = new Map(record.evidence.map(item => [item.path, item.sha256]));
  assert.deepEqual([...evidence.keys()].sort(),
    currentControlledRehearsalIntelligenceSuccessorPaths);
  for (const [path, expected] of currentControlledRehearsalIntelligenceSuccessorHashes) {
    assert.equal(
      sha256(gitBytes(
        "show",
        `${currentControlledRehearsalIntelligenceSuccessorCommit}:${path}`
      )),
      expected,
      `${path} controlled-rehearsal Intelligence owner hash drifted.`
    );
    assert.equal(evidence.get(path), expected,
      `${path} controlled-rehearsal Intelligence evidence drifted.`);
    const revenueSuccessor = currentRevenueReadinessIntelligenceSuccessorHashes.get(path);
    if (revenueSuccessor) {
      assert.equal(sha256(gitBytes(
        "show",
        `${currentRevenueReadinessIntelligenceSuccessor.parent}:${path}`
      )), expected, `${path} revenue-readiness predecessor drifted.`);
    }
    assert.equal(
      sha256(read(path)),
      composeCurrentIntelligenceSha256(path, revenueSuccessor || expected),
      `${path} current controlled-rehearsal Intelligence successor drifted.`);
  }
}

function isCurrentControlledRehearsalIntelligenceTransition(
  path,
  previousSha256,
  currentSha256
) {
  const expected = currentControlledRehearsalIntelligenceSuccessorHashes.get(path);
  const revenueSuccessor = currentRevenueReadinessIntelligenceSuccessorHashes.get(path);
  const acceptedCurrent = composeCurrentIntelligenceSha256(
    path,
    revenueSuccessor || expected
  );
  if (!expected || acceptedCurrent !== currentSha256) return false;
  const predecessorSha256 = sha256(gitBytes(
    "show",
    `${currentControlledRehearsalIntelligenceSuccessorParent}:${path}`
  ));
  const predecessorIsGoverned = predecessorSha256 === previousSha256
    || isPrivateSmokeTimeoutIntelligenceTransition(
      path,
      previousSha256,
      predecessorSha256
    );
  const controlledCommitIsGoverned = predecessorIsGoverned && sha256(gitBytes(
      "show",
      `${currentControlledRehearsalIntelligenceSuccessorCommit}:${path}`
    )) === expected;
  if (!controlledCommitIsGoverned) return false;
  if (revenueSuccessor && !(sha256(gitBytes(
      "show",
      `${currentRevenueReadinessIntelligenceSuccessor.parent}:${path}`
    )) === expected
      && sha256(gitBytes(
        "show",
        `${currentRevenueReadinessIntelligenceSuccessor.commit}:${path}`
      )) === revenueSuccessor)) return false;
  return sha256(read(path)) === acceptedCurrent;
}

function verifyCurrentHardenedSmokeGuardIntelligenceSuccessor() {
  const governance = readJson(currentHardenedSmokeGuardIntelligenceSuccessorPath);
  assert.equal(
    governance.governanceId,
    "route-iq-release-provenance-intelligence-successor-v1"
  );
  assert.equal(governance.version, "1.0.0");
  assert.equal(governance.status, "OVERWATCH_ACCEPTED_OWNER_SUCCESSOR");
  assert.equal(governance.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(governance.historicalEvidence.releaseProvenanceMapping.remainsHistorical, true);
  assert.equal(governance.historicalEvidence.releaseProvenanceMapping.rewritten, false);
  assert.equal(
    governance.historicalEvidence.zipFounderAccessSuccessor.commit,
    currentZipFounderAccessIntelligenceCommit
  );
  assert.equal(
    governance.historicalEvidence.zipFounderAccessSuccessor.tree,
    currentZipFounderAccessIntelligenceTree
  );
  assert.equal(governance.historicalEvidence.zipFounderAccessSuccessor.remainsHistorical, true);
  assert.equal(governance.historicalEvidence.zipFounderAccessSuccessor.rewritten, false);

  const successor = governance.intelligenceOwnerSuccessor;
  assert.deepEqual(
    git(
      "show",
      "-s",
      "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
      currentHardenedSmokeGuardIntelligenceSuccessorCommit
    ).split("\n"),
    [
      currentHardenedSmokeGuardIntelligenceSuccessorCommit,
      currentHardenedSmokeGuardIntelligenceSuccessorParent,
      currentHardenedSmokeGuardIntelligenceSuccessorTree,
      "Prometheus Intelligence Engine <intelligence@prometheus.local>",
      "Prometheus Intelligence Engine <intelligence@prometheus.local>",
      "intelligence: synchronize hardened smoke guard provenance"
    ]
  );
  assert.equal(successor.commit, currentHardenedSmokeGuardIntelligenceSuccessorCommit);
  assert.equal(successor.parent, currentHardenedSmokeGuardIntelligenceSuccessorParent);
  assert.equal(successor.tree, currentHardenedSmokeGuardIntelligenceSuccessorTree);
  assert.equal(successor.author, "Prometheus Intelligence Engine <intelligence@prometheus.local>");
  assert.equal(successor.committer, "Prometheus Intelligence Engine <intelligence@prometheus.local>");
  assert.equal(successor.subject, "intelligence: synchronize hardened smoke guard provenance");
  assert.deepEqual(successor.changedPaths.slice().sort(), currentHardenedSmokeGuardIntelligenceSuccessorPaths);
  assert.deepEqual(
    changedPaths(currentHardenedSmokeGuardIntelligenceSuccessorCommit),
    currentHardenedSmokeGuardIntelligenceSuccessorPaths
  );
  assert.doesNotThrow(() => git(
    "merge-base",
    "--is-ancestor",
    currentZipFounderAccessIntelligenceCommit,
    currentHardenedSmokeGuardIntelligenceSuccessorCommit
  ));
  assert.doesNotThrow(() => git(
    "merge-base",
    "--is-ancestor",
    currentHardenedSmokeGuardIntelligenceSuccessorCommit,
    "HEAD"
  ));

  const transitions = new Map(
    successor.transitions.map(transition => [transition.path, transition])
  );
  assert.deepEqual(
    [...transitions.keys()].sort(),
    currentHardenedSmokeGuardIntelligenceSuccessorPaths
  );
  for (const path of currentHardenedSmokeGuardIntelligenceSuccessorPaths) {
    const transition = transitions.get(path);
    assert.equal(
      transition.previousSha256,
      sha256(gitBytes(
        "show",
        `${currentHardenedSmokeGuardIntelligenceSuccessorParent}:${path}`
      )),
      `${path} hardened smoke-guard predecessor hash drifted.`
    );
    assert.equal(
      transition.currentSha256,
      sha256(gitBytes(
        "show",
        `${currentHardenedSmokeGuardIntelligenceSuccessorCommit}:${path}`
      )),
      `${path} hardened smoke-guard owner-successor hash drifted.`
    );
    const currentSha256 = sha256(read(path));
    assert.equal(
      transition.currentSha256 === currentSha256
        || isCurrentPaidCustomerIntelligenceTransition(
          path,
          transition.currentSha256,
          currentSha256
        )
        || isCurrentPrivateSmokeTimeoutIntelligenceTransition(
          path,
          transition.currentSha256,
          currentSha256
        )
        || isCurrentControlledRehearsalIntelligenceTransition(
          path,
          transition.currentSha256,
          currentSha256
        ),
      true,
      `${path} current hardened smoke-guard successor drifted.`
    );
  }

  assert.deepEqual(governance.reviewedBoundaries, {
    intelligenceImplementationChangedByOverwatch: false,
    intelligenceProvenanceChangedByOverwatch: false,
    runtimeChangedByOverwatch: false,
    websiteChangedByOverwatch: false,
    deploymentPayloadChangedByOverwatch: false,
    historicalEvidenceRewritten: false,
    collection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF"
  });
  return transitions;
}

function isCurrentHardenedSmokeGuardIntelligenceTransition(
  transitions,
  path,
  currentSha256
) {
  const transition = transitions.get(path);
  if (!transition) return false;
  return (
    transition.currentSha256 === currentSha256
    && sha256(read(path)) === currentSha256
  ) || isCurrentPrivateSmokeTimeoutIntelligenceTransition(
    path,
    transition.currentSha256,
    currentSha256
  ) || isCurrentControlledRehearsalIntelligenceTransition(
    path,
    transition.currentSha256,
    currentSha256
  );
}

export function verifyReleaseProvenanceRepair() {
  const mapping = readJson(mappingPath);
  const registry = readJson(registryPath);
  const dashboardContract = readJson(dashboardContractPath);
  const historicalDashboardContract = JSON.parse(
    gitBytes("show", `${historicalDashboardContractCommit}:${dashboardContractPath}`)
  );
  const intelligenceEvidence = readJson(intelligenceEvidencePath);
  const protectedBaselineSuccessor = readJson(protectedBaselineSuccessorPath);
  const routeQualitySuccessor = readJson(routeQualitySuccessorPath);
  const commercialRouteQualitySuccessor = readJson(commercialRouteQualitySuccessorPath);
  const investorWebsiteRouteQualitySuccessor = readJson(investorWebsiteRouteQualitySuccessorPath);
  const restored3dRouteQualitySuccessor = readJson(restored3dRouteQualitySuccessorPath);
  const batchOneReport = readJson(batchOneReportPath);
  const dashboardEvidence = read(dashboardEvidencePath).toString("utf8");

  assert.equal(mapping.contractId, "route-iq-release-provenance-repair-v1");
  assert.equal(mapping.version, "1.2.0");
  assert.equal(mapping.batchId, batchId);
  assert.equal(mapping.status, "active_governance_only");
  assert.equal(mapping.owningSubsystem, "Prometheus Overwatch");
  assert.equal(mapping.workspaceId, "fitness_connection");
  assert.equal(mapping.operatingProfileId, "fitness");
  verifyCurrentAugust1IntelligenceSuccessor();
  verifyCurrentPaidCustomerIntelligenceSuccessor();
  verifyCurrentPrivateSmokeTimeoutIntelligenceSuccessor();
  verifyCurrentControlledRehearsalIntelligenceSuccessor();
  validateRevenueReadinessIntelligenceSuccessor(
    currentRevenueReadinessIntelligenceSuccessor
  );
  const hardenedSmokeGuardIntelligenceTransitions =
    verifyCurrentHardenedSmokeGuardIntelligenceSuccessor();

  const gap = mapping.legacyProvenanceGap;
  assert.equal(gap.commit, legacyCommit);
  assert.equal(gap.classification, "LEGACY_PROVENANCE_GAP");
  assert.equal(gap.historyPreserved, true);
  assert.equal(gap.retroactiveOwnershipClaimed, false);
  assert.equal(gap.mixedOwnershipDisclosed, true);
  assert.equal(gap.intelligenceOwnerRepairCommit, intelligenceRepairCommit);
  assert.equal(gap.historicalCanonicalCommit, historicalCanonicalCommit);
  assert.deepEqual(gap.currentIntelligenceSuccessorCommits, currentIntelligenceSuccessorCommits);
  assert.deepEqual(changedPaths(legacyCommit), expectedLegacyPaths);
  assert.deepEqual(changedPaths(intelligenceRepairCommit), expectedIntelligenceRepairPaths);
  assert.equal(git("merge-base", "--is-ancestor", legacyCommit, intelligenceRepairCommit), "");
  for (const commit of currentIntelligenceSuccessorCommits) {
    assert.deepEqual(changedPaths(commit), expectedCurrentIntelligenceSuccessorPaths.get(commit));
    assert.equal(git("merge-base", "--is-ancestor", intelligenceRepairCommit, commit), "");
  }
  assert.deepEqual(changedPaths(protectedBaselineSuccessorCommit), expectedProtectedBaselineSuccessorPaths);
  assert.equal(git("merge-base", "--is-ancestor", currentIntelligenceOwnerSuccessorCommit, protectedBaselineSuccessorCommit), "");
  assert.deepEqual(changedPaths(routeQualityDataCommit), expectedRouteQualityDataPaths);
  assert.deepEqual(changedPaths(routeQualitySuccessorCommit), expectedRouteQualitySuccessorPaths);
  assert.equal(git("merge-base", "--is-ancestor", protectedBaselineSuccessorCommit, routeQualityDataCommit), "");
  assert.equal(git("merge-base", "--is-ancestor", routeQualityDataCommit, routeQualitySuccessorCommit), "");
  assert.deepEqual(changedPaths(commercialRouteQualityDataCommit), expectedRouteQualityDataPaths);
  assert.deepEqual(changedPaths(commercialRouteQualitySuccessorCommit), [
    "intelligence/contracts/shadow-decision-readiness-contracts.json",
    commercialRouteQualitySuccessorPath,
    "scripts/verify-shadow-decision-readiness.mjs",
    "tests/route-iq-commercial-readiness-intelligence-data-route-quality-successor.test.mjs",
    "tests/shadow-decision-readiness.test.mjs"
  ].sort());
  assert.equal(git("merge-base", "--is-ancestor", routeQualitySuccessorCommit, commercialRouteQualityDataCommit), "");
  assert.equal(git("merge-base", "--is-ancestor", commercialRouteQualityDataCommit, commercialRouteQualitySuccessorCommit), "");

  assert.equal(intelligenceEvidence.status, "LEGACY_PROVENANCE_GAP");
  assert.equal(intelligenceEvidence.legacyCommit, legacyCommit);
  assert.match(intelligenceEvidence.ownershipStatement, /does not claim retroactive Intelligence ownership/);
  assert.deepEqual(
    intelligenceEvidence.contracts.map(contract => contract.path).sort(),
    intelligenceContractPaths.slice().sort()
  );

  for (const record of gap.intelligenceOwnedFiles) {
    assert.ok(intelligenceContractPaths.includes(record.path), `Unexpected Intelligence path: ${record.path}`);
    const ownerEvidence = intelligenceEvidence.contracts.find(contract => contract.path === record.path);
    assert.ok(ownerEvidence, `Missing owner evidence for ${record.path}`);

    const legacyBytes = gitBytes("show", `${legacyCommit}:${record.path}`);
    const historicalCanonicalBytes = gitBytes("show", `${historicalCanonicalCommit}:${record.path}`);
    const historicalCanonicalJson = JSON.parse(historicalCanonicalBytes);
    assert.equal(sha256(legacyBytes), record.legacyRawSha256, `${record.path} legacy hash drifted.`);
    assert.equal(sha256(historicalCanonicalBytes), record.canonicalAfterRepairRawSha256, `${record.path} historical repair hash drifted.`);
    assert.equal(ownerEvidence.legacyCommitRawSha256, record.legacyRawSha256);
    assert.equal(semanticSha256(historicalCanonicalJson), record.canonicalAfterRepairSemanticSha256);
    const ownerSuccessorBytes = gitBytes("show", `${currentIntelligenceOwnerSuccessorCommit}:${record.path}`);
    const ownerSuccessorJson = JSON.parse(ownerSuccessorBytes);
    assert.equal(sha256(ownerSuccessorBytes), record.currentCanonicalRawSha256);
    assert.equal(semanticSha256(ownerSuccessorJson), record.currentCanonicalSemanticSha256);
    assert.equal(ownerEvidence.reconstructedRawSha256, record.currentCanonicalRawSha256);
    assert.equal(ownerEvidence.canonicalAfterRepairRawSha256, record.currentCanonicalRawSha256);
    assert.equal(ownerEvidence.reconstructedSemanticSha256, record.currentCanonicalSemanticSha256);
    assert.equal(ownerEvidence.canonicalAfterRepairSemanticSha256, ownerEvidence.reconstructedSemanticSha256);
    assert.equal(ownerEvidence.byteIdenticalAfterRepair, true);
    assert.equal(ownerEvidence.semanticIdenticalAfterRepair, true);
  }

  const shadowEvidence = intelligenceEvidence.additionalProtectedConsumerScan.find(
    record => record.path === "intelligence/contracts/shadow-decision-readiness-contracts.json"
  );
  assert.ok(shadowEvidence, "Shadow-readiness protected consumer must be independently reconstructed.");
  const historicalShadowBytes = gitBytes("show", `${historicalCanonicalCommit}:${shadowEvidence.path}`);
  assert.equal(sha256(historicalShadowBytes), shadowEvidence.reconstructionBaseRawSha256);
  const ownerSuccessorShadowBytes = gitBytes("show", `${currentIntelligenceOwnerSuccessorCommit}:${shadowEvidence.path}`);
  assert.equal(sha256(ownerSuccessorShadowBytes), shadowEvidence.reconstructedRawSha256);
  assert.equal(semanticSha256(JSON.parse(ownerSuccessorShadowBytes)), shadowEvidence.reconstructedSemanticSha256);
  assert.equal(shadowEvidence.byteIdenticalAfterRepair, true);
  assert.equal(shadowEvidence.semanticIdenticalAfterRepair, true);

  assert.equal(dashboardContract.contractVersion, "2.0.0");
  assert.equal(dashboardContract.owningSubsystem, "Prometheus Overwatch");
  assert.equal(dashboardContract.admissionRules.crossWorkspaceFallbackAllowed, false);
  assert.equal(dashboardContract.admissionRules.demoCatalogAllowed, false);
  assert.equal(dashboardContract.safety.collection, "OFF");
  assert.equal(dashboardContract.safety.activeCohorts, 0);
  assert.equal(dashboardContract.safety.recommendationInfluence, "OFF");
  const dashboardAlignment =
    historicalDashboardContract.repViewContract.placesAccess.alignmentEvidence;
  verifyExactDashboardCommit({
    commit: currentDashboardSourceCommit,
    parent: "54804800533e705efe7add510e5e4bb72a3ba7dc",
    tree: "ca9c01b40d763ceb707ba88118c905a8056e7407",
    subject: "Add bounded Route IQ customer PWA",
    paths: [
      "_headers",
      "deploy/cloudflare-pages/_headers",
      "deploy/cloudflare-pages/index.html",
      "deploy/cloudflare-pages/manifest-founder.webmanifest",
      "deploy/cloudflare-pages/manifest.webmanifest",
      "deploy/cloudflare-pages/sw.js",
      "index.html",
      "manifest-founder.webmanifest",
      "manifest.webmanifest",
      "scripts/verify-dashboard-runtime-workflows.mjs",
      "sw.js",
      "tests/dashboard-route-iq-customer-pwa.test.mjs",
      "tests/dashboard-route-iq-field-session-producer.test.mjs",
      "tests/dashboard-route-iq-product-focus.test.mjs"
    ]
  });
  verifyExactDashboardCommit({
    commit: currentDashboardValidationCommit,
    parent: "d913a3c8c50379272503c93a8df12e75e048842d",
    tree: "d0d5fb3ce8c7b9416c3695645b0ad0fb0715d650",
    subject: "Harden governed profile mismatch harness",
    paths: [
      "scripts/verify-dashboard-runtime-workflows.mjs",
      "tests/dashboard-route-iq-customer-pwa.test.mjs"
    ]
  });
  assert.equal(gap.overwatchOwnedFile.path, dashboardContractPath);
  assert.equal(gap.overwatchOwnedFile.canonicalOwner, "Prometheus Overwatch");
  assert.equal(gap.overwatchOwnedFile.dashboardOwnerRevalidationCommit, dashboardProspectiveCommit);
  assert.equal(gap.overwatchOwnedFile.prospectiveShadowSeamCommit, dashboardProspectiveCommit);
  assert.equal(dashboardAlignment.dashboardCommit, currentDashboardValidationCommit);
  assert.equal(dashboardAlignment.dashboardOwnerRevalidationCommit, currentDashboardValidationCommit);
  assert.equal(dashboardAlignment.prospectiveShadowSeamCommit, dashboardProspectiveCommit);
  assert.equal(dashboardAlignment.prospectiveCollectionOffSuppressionCommit, dashboardCollectionOffCommit);
  assert.equal(dashboardAlignment.routeIqProductFocusCommit, dashboardProductFocusCommit);
  assert.equal(dashboardAlignment.decisionContextFeatureOriginCommit, "2774d91456e4b1734eb1caa13deaa84de2248f8f");
  assert.equal(
    sha256(read("index.html")),
    sha256(read("deploy/cloudflare-pages/index.html"))
  );
  assert.equal(
    sha256(gitBytes("show", `${currentDashboardSourceCommit}:index.html`)),
    dashboardAlignment.dashboardSourceSha256
  );
  assert.match(dashboardEvidence, /Status: FOUNDER_BEHAVIOR_APPROVAL_REQUIRED/);
  assert.match(dashboardEvidence, /post-action evidence/);
  assert.match(dashboardEvidence, /does not provide the full candidate context/);
  assert.match(dashboardEvidence, /adds no name, email, phone, manager, GPS, note/);
  assert.match(dashboardEvidence, /No shadow state or Founder readiness result is rendered to representatives/);

  const fitnessWorkspace = registry.workspaces.find(workspace => workspace.workspaceId === "fitness_connection");
  const registration = fitnessWorkspace?.canonicalArtifacts.find(
    artifact => artifact.artifactId === "fitness_connection_release_provenance_repair_mapping"
  );
  assert.ok(registration, "Release provenance mapping must be registered.");
  assert.equal(registration.path, mappingPath);
  assert.equal(registration.ownerSubsystem, "Prometheus Overwatch");
  assert.deepEqual(registration.writeAllowed, ["Prometheus Overwatch"]);
  assert.deepEqual(registration.readAllowed, [
    "Prometheus Infrastructure",
    "Prometheus Overwatch"
  ]);
  assert.equal(registration.productionConsumer, false);

  const correction = batchOneReport.releaseScopeCorrection;
  assert.equal(correction.ownerRepairTree, "c2fdbe479b92c436b076e954dfa48c0065a673ff");
  assert.equal(correction.batchFinalHead, "18ed83effdca1219729e4e71f452eeea8c3b273b");
  assert.equal(correction.batchFinalTree, "87cb850a77333dbd0e368e2bba4aad5ac3c4a56f");
  assert.equal(correction.ownerRepairTreeEqualsBatchFinalTree, false);
  assert.equal(correction.exactFinalHeadVerificationEstablishedByBatch1, false);
  assert.equal(correction.priorPushRecommendationSuperseded, true);

  assert.equal(mapping.methodology.requiredEvaluationOutcomes, "97 eligible, linked, scoreable evaluation outcomes after exclusions");
  assert.equal(mapping.methodology.requiredSampleAloneCanReachFounderReview, false);
  assert.equal(mapping.methodology.calibrationBins, 5);
  assert.equal(mapping.methodology.minimumSupportedObservationsAcrossFivePopulatedBins, 100);
  assert.equal(mapping.methodology.sparseOrEmptyBinsMayBypassEvidenceCoverage, false);
  assert.equal(mapping.methodology.chronologicalTrainingEvaluationSeparationRequired, true);
  assert.equal(mapping.methodology.calibrationStabilitySegmentSafetyAndBaselineRequired, true);
  assert.equal(mapping.methodology.causalUpliftOrRecommendationSuperiorityClaimAllowed, false);

  assert.deepEqual(mapping.preBatchOwnerValidation.map(record => record.commit), expectedPreBatchCommits);
  assert.equal(mapping.preBatchOwnerValidation[0].owner, "Prometheus Dashboard");
  assert.equal(mapping.preBatchOwnerValidation[0].status, "OWNER_REVALIDATED_FOUNDER_BEHAVIOR_APPROVAL_REQUIRED");
  for (const record of mapping.preBatchOwnerValidation.slice(1, 4)) {
    assert.equal(record.owner, "Prometheus Data");
    assert.equal(record.status, "OWNER_REVALIDATED_CONTRACT_MISMATCH_CLOSED");
  }
  assert.equal(mapping.preBatchOwnerValidation[4].owner, "MIXED_LEGACY_PROVENANCE_GAP");
  assert.equal(mapping.preBatchOwnerValidation[4].status, "LEGACY_GAP_DISCLOSED_AND_OWNER_RECONSTRUCTED");
  assert.equal(mapping.ownerRepairChain.dashboardCommit, dashboardRepairCommit);
  assert.equal(mapping.ownerRepairChain.currentDashboardSuccessorCommit, dashboardProspectiveCommit);
  assert.deepEqual(mapping.ownerRepairChain.currentIntelligenceSuccessorCommits, currentIntelligenceSuccessorCommits);

  const currentIntelligenceSuccessor = mapping.currentIntelligenceOwnerSuccessor;
  assert.equal(currentIntelligenceSuccessor.batchId, "BATCH-20260714-001");
  assert.equal(currentIntelligenceSuccessor.commit, currentIntelligenceOwnerSuccessorCommit);
  assert.equal(currentIntelligenceSuccessor.tree, git("rev-parse", `${currentIntelligenceOwnerSuccessorCommit}^{tree}`));
  assert.equal(currentIntelligenceSuccessor.canonicalOwner, "Prometheus Intelligence Engine");
  assert.equal(currentIntelligenceSuccessor.predecessorCommit, "e0f14743867bf765f05225e0321f2596741b8c70");
  assert.equal(currentIntelligenceSuccessor.legacyProvenanceArtifactsModified, true);
  assert.equal(currentIntelligenceSuccessor.legacyProvenanceGapPreserved, true);
  assert.equal(
    currentIntelligenceSuccessor.semanticSpecificationPath,
    "intelligence/provenance/specifications/administrative-disposition-admission-v1.json",
  );
  assert.equal(
    sha256(read(currentIntelligenceSuccessor.semanticSpecificationPath)),
    currentIntelligenceSuccessor.semanticSpecificationSha256,
  );
  assert.equal(currentIntelligenceSuccessor.targetHashesStoredInSemanticSpecification, false);
  assert.equal(currentIntelligenceSuccessor.recommendationInfluence, "OFF");
  for (const consumer of currentIntelligenceSuccessor.protectedConsumers) {
    assert.equal(
      sha256(gitBytes("show", `${currentIntelligenceOwnerSuccessorCommit}:${consumer.path}`)),
      consumer.sha256,
      `${consumer.path} historical owner-successor hash drifted.`
    );
  }

  assert.equal(protectedBaselineSuccessor.version, "route-iq-intelligence-protected-baseline-synchronization-v1");
  assert.equal(protectedBaselineSuccessor.batchId, "BATCH-20260714-002");
  assert.equal(protectedBaselineSuccessor.status, "OWNER_VALIDATED_SUCCESSOR");
  assert.equal(protectedBaselineSuccessor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(protectedBaselineSuccessor.historicalCheckpoint.path, intelligenceEvidencePath);
  assert.equal(protectedBaselineSuccessor.historicalCheckpoint.sha256, sha256(read(intelligenceEvidencePath)));
  assert.equal(protectedBaselineSuccessor.historicalCheckpoint.remainsHistorical, true);
  assert.equal(protectedBaselineSuccessor.historicalCheckpoint.rewritten, false);
  assert.deepEqual(
    protectedBaselineSuccessor.integratedOwnerCommits.map(record => record.commit),
    ["0027244ba069b741f283ab6871cf882d46f2c935", dashboardCollectionOffCommit]
  );

  for (const transition of protectedBaselineSuccessor.protectedSourceTransitions) {
    assert.equal(
      sha256(gitBytes("show", `${protectedBaselineSuccessorCommit}^:${transition.path}`)),
      transition.currentSha256,
      `${transition.path} was not frozen before the Intelligence successor commit.`
    );
  }

  const synchronizedConsumerPaths = protectedBaselineSuccessor.synchronizedConsumers.map(record => record.path).sort();
  assert.deepEqual(synchronizedConsumerPaths, [
    ...intelligenceContractPaths,
    "intelligence/contracts/shadow-decision-readiness-contracts.json"
  ].sort());
  for (const consumer of protectedBaselineSuccessor.synchronizedConsumers) {
    assert.equal(
      sha256(gitBytes("show", `${protectedBaselineSuccessorCommit}^:${consumer.path}`)),
      consumer.previousSha256,
      `${consumer.path} previous protected baseline drifted.`
    );
    assert.equal(
      sha256(gitBytes("show", `${protectedBaselineSuccessorCommit}:${consumer.path}`)),
      consumer.currentSha256,
      `${consumer.path} first owner successor commit drifted.`
    );
  }
  assert.equal(protectedBaselineSuccessor.advisoryArtifacts.regenerationRequired, false);
  for (const [field, expected] of Object.entries({
    collectionDefaultState: "OFF",
    recommendationInfluence: "OFF",
    representativeShadowOutputExposed: false,
    routeOrderingChanged: false,
    candidateVisibilityChanged: false,
    routeScoringChanged: false,
    notificationBehaviorChanged: false,
    automaticActionIntroduced: false,
    validCollectionOnFixturePreservesPreActionNextStopSeal: true,
    candidateCompletenessServerOwned: true,
    identityAndTimestampsServerOwned: true,
    exactlyOnceIdempotentAppendOnlyEvidencePreserved: true,
    zeroLiveGooglePreserved: true
  })) {
    assert.equal(protectedBaselineSuccessor.boundaryValidation[field], expected, `${field} successor boundary drifted.`);
  }

  assert.equal(routeQualitySuccessor.version, "route-iq-intelligence-route-quality-protected-baseline-successor-v1");
  assert.equal(routeQualitySuccessor.batchId, "BATCH-20260714-002");
  assert.equal(routeQualitySuccessor.status, "OWNER_VALIDATED_SUCCESSOR");
  assert.equal(routeQualitySuccessor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(routeQualitySuccessor.predecessor.path, protectedBaselineSuccessorPath);
  assert.equal(routeQualitySuccessor.predecessor.commit, protectedBaselineSuccessorCommit);
  assert.equal(
    routeQualitySuccessor.predecessor.sha256,
    sha256(gitBytes("show", `${protectedBaselineSuccessorCommit}:${protectedBaselineSuccessorPath}`))
  );
  assert.equal(routeQualitySuccessor.predecessor.remainsHistorical, true);
  assert.equal(routeQualitySuccessor.predecessor.rewritten, false);

  const dataTransition = routeQualitySuccessor.dataOwnerTransition;
  assert.equal(dataTransition.commit, routeQualityDataCommit);
  assert.equal(dataTransition.tree, git("rev-parse", `${routeQualityDataCommit}^{tree}`));
  assert.equal(dataTransition.ownerSubsystem, "Prometheus Data");
  assert.deepEqual(dataTransition.dashboardFetchEvidence, {
    previousSourceFetches: 8,
    previousDeployFetches: 8,
    currentSourceFetches: 9,
    currentDeployFetches: 9
  });
  for (const transition of [dataTransition.routeQualityGate, dataTransition.canonicalRouteQualityReport]) {
    assert.equal(
      sha256(gitBytes("show", `${routeQualityDataCommit}^:${transition.path}`)),
      transition.previousSha256,
      `${transition.path} previous Data hash drifted.`
    );
    assert.equal(
      sha256(gitBytes("show", `${routeQualityDataCommit}:${transition.path}`)),
      transition.currentSha256,
      `${transition.path} Data owner commit hash drifted.`
    );
  }

  const affectedReferences = routeQualitySuccessor.protectedReferenceAudit.affectedIntelligenceReferences;
  assert.equal(affectedReferences.length, 1);
  const routeQualityReference = affectedReferences[0];
  assert.equal(routeQualityReference.consumerPath, "intelligence/contracts/shadow-decision-readiness-contracts.json");
  assert.equal(routeQualityReference.protectedSourcePath, dataTransition.routeQualityGate.path);
  assert.equal(
    sha256(gitBytes("show", `${routeQualitySuccessorCommit}^:${routeQualityReference.consumerPath}`)),
    routeQualityReference.previousConsumerSha256
  );
  assert.equal(
    sha256(gitBytes("show", `${routeQualitySuccessorCommit}:${routeQualityReference.consumerPath}`)),
    routeQualityReference.currentConsumerSha256
  );
  assert.equal(routeQualityReference.previousProtectedSha256, dataTransition.routeQualityGate.previousSha256);
  assert.equal(routeQualityReference.currentProtectedSha256, dataTransition.routeQualityGate.currentSha256);
  assert.equal(routeQualitySuccessor.protectedReferenceAudit.canonicalReportPinnedByIntelligence, false);
  assert.deepEqual(routeQualitySuccessor.protectedReferenceAudit.canonicalReportReferenceMatches, []);
  assert.equal(routeQualitySuccessor.protectedReferenceAudit.allAffectedReferencesAccountedFor, true);
  assert.equal(routeQualitySuccessor.advisoryArtifacts.regenerationRequired, false);
  for (const [field, expected] of Object.entries({
    collectionDefaultState: "OFF",
    recommendationInfluence: "OFF",
    readinessState: "INSUFFICIENT_EVIDENCE",
    representativeShadowOutputExposed: false,
    routeOrderingChanged: false,
    candidateVisibilityChanged: false,
    routeScoringChanged: false,
    routeGenerationChanged: false,
    dashboardBehaviorChanged: false,
    dataBehaviorChangedByIntelligence: false,
    infrastructureBehaviorChangedByIntelligence: false,
    zeroLiveGooglePreserved: true
  })) {
    assert.equal(routeQualitySuccessor.boundaryValidation[field], expected, `${field} route-quality successor boundary drifted.`);
  }

  assert.equal(
    commercialRouteQualitySuccessor.version,
    "route-iq-intelligence-data-route-quality-protected-baseline-successor-v1"
  );
  assert.equal(commercialRouteQualitySuccessor.batchId, "BATCH-20260718-002");
  assert.equal(commercialRouteQualitySuccessor.status, "OWNER_REVIEWED_AND_SYNCHRONIZED");
  assert.equal(commercialRouteQualitySuccessor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(commercialRouteQualitySuccessor.predecessor.path, routeQualitySuccessorPath);
  assert.equal(commercialRouteQualitySuccessor.predecessor.remainsHistorical, true);
  assert.equal(commercialRouteQualitySuccessor.predecessor.rewritten, false);

  const commercialDataTransition = commercialRouteQualitySuccessor.dataOwnerTransition;
  assert.equal(commercialDataTransition.commit, commercialRouteQualityDataCommit);
  assert.equal(commercialDataTransition.tree, git("rev-parse", `${commercialRouteQualityDataCommit}^{tree}`));
  assert.equal(commercialDataTransition.ownerSubsystem, "Prometheus Data");
  assert.deepEqual(commercialDataTransition.changedPaths.slice().sort(), expectedRouteQualityDataPaths);
  for (const [historicalTransition, currentTransition] of [
    [dataTransition.routeQualityGate, commercialDataTransition.routeQualityGate],
    [dataTransition.canonicalRouteQualityReport, commercialDataTransition.canonicalRouteQualityReport]
  ]) {
    assert.equal(currentTransition.path, historicalTransition.path);
    assert.equal(currentTransition.previousSha256, historicalTransition.currentSha256);
    assert.equal(
      sha256(gitBytes("show", `${commercialRouteQualityDataCommit}:${currentTransition.path}`)),
      currentTransition.currentSha256,
      `${currentTransition.path} commercial Data owner hash drifted.`
    );
  }

  const commercialReference = commercialRouteQualitySuccessor.protectedReferenceAudit.affectedIntelligenceReferences[0];
  assert.equal(commercialReference.consumerPath, "intelligence/contracts/shadow-decision-readiness-contracts.json");
  assert.equal(commercialReference.protectedSourcePath, commercialDataTransition.routeQualityGate.path);
  assert.equal(commercialReference.previousProtectedSha256, dataTransition.routeQualityGate.currentSha256);
  assert.equal(commercialReference.currentProtectedSha256, commercialDataTransition.routeQualityGate.currentSha256);
  assert.equal(
    sha256(gitBytes("show", `${commercialRouteQualitySuccessorCommit}:${commercialReference.consumerPath}`)),
    commercialReference.currentConsumerSha256
  );
  assert.equal(commercialRouteQualitySuccessor.protectedReferenceAudit.allAffectedReferencesAccountedFor, true);
  assert.equal(commercialRouteQualitySuccessor.reviewedInvariants.runtimeBehaviorChanged, false);
  assert.equal(commercialRouteQualitySuccessor.reviewedInvariants.routeOrderingChanged, false);
  assert.equal(commercialRouteQualitySuccessor.reviewedInvariants.routeScoringChanged, false);
  assert.equal(commercialRouteQualitySuccessor.boundaries.recommendationInfluence, "OFF");
  assert.equal(commercialRouteQualitySuccessor.boundaries.readinessState, "INSUFFICIENT_EVIDENCE");
  assert.equal(commercialRouteQualitySuccessor.boundaries.representativeShadowOutputExposed, false);

  assert.equal(
    investorWebsiteRouteQualitySuccessor.version,
    "route-iq-intelligence-data-route-quality-protected-baseline-successor-v1"
  );
  assert.equal(investorWebsiteRouteQualitySuccessor.batchId, "BATCH-20260719-002");
  assert.equal(investorWebsiteRouteQualitySuccessor.status, "OWNER_REVIEWED_AND_SYNCHRONIZED");
  assert.equal(investorWebsiteRouteQualitySuccessor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(investorWebsiteRouteQualitySuccessor.predecessor.path, commercialRouteQualitySuccessorPath);
  assert.equal(
    investorWebsiteRouteQualitySuccessor.predecessor.sha256,
    sha256(read(commercialRouteQualitySuccessorPath))
  );
  assert.equal(investorWebsiteRouteQualitySuccessor.predecessor.remainsHistorical, true);
  assert.equal(investorWebsiteRouteQualitySuccessor.predecessor.rewritten, false);

  const investorWebsiteDataTransition = investorWebsiteRouteQualitySuccessor.dataOwnerTransition;
  assert.equal(investorWebsiteDataTransition.commit, investorWebsiteRouteQualityDataCommit);
  assert.equal(
    investorWebsiteDataTransition.tree,
    git("rev-parse", `${investorWebsiteRouteQualityDataCommit}^{tree}`)
  );
  assert.equal(investorWebsiteDataTransition.ownerSubsystem, "Prometheus Data");
  assert.deepEqual(
    investorWebsiteDataTransition.changedPaths.slice().sort(),
    expectedRouteQualityDataPaths
  );
  for (const [historicalTransition, currentTransition] of [
    [commercialDataTransition.routeQualityGate, investorWebsiteDataTransition.routeQualityGate],
    [commercialDataTransition.canonicalRouteQualityReport, investorWebsiteDataTransition.canonicalRouteQualityReport]
  ]) {
    assert.equal(currentTransition.path, historicalTransition.path);
    assert.equal(currentTransition.previousSha256, historicalTransition.currentSha256);
    assert.equal(
      sha256(gitBytes("show", `${investorWebsiteRouteQualityDataCommit}:${currentTransition.path}`)),
      currentTransition.currentSha256,
      `${currentTransition.path} investor Website Data owner hash drifted.`
    );
  }
  assert.equal(
    sha256(gitBytes("show", `${investorWebsiteRouteQualityDataCommit}:${investorWebsiteDataTransition.routeQualityRegression.path}`)),
    investorWebsiteDataTransition.routeQualityRegression.currentSha256
  );

  assert.deepEqual(
    changedPaths(investorWebsiteRouteQualitySuccessorCommit),
    expectedInvestorWebsiteRouteQualitySuccessorPaths
  );
  assert.equal(
    git("rev-parse", `${investorWebsiteRouteQualitySuccessorCommit}^{tree}`),
    "de525c85f2d8b02ba6c5c3ad4148668d2702230f"
  );
  assert.equal(
    investorWebsiteRouteQualitySuccessor.protectedReferenceAudit.allAffectedIntelligenceReferencesAccountedFor,
    true
  );
  for (const reference of investorWebsiteRouteQualitySuccessor.protectedReferenceAudit.affectedIntelligenceReferences) {
    assert.equal(
      sha256(gitBytes("show", `${investorWebsiteRouteQualitySuccessorCommit}:${reference.consumerPath}`)),
      reference.currentConsumerSha256
    );
  }
  for (const mirror of investorWebsiteRouteQualitySuccessor.protectedReferenceAudit.ownerVerificationMirrors) {
    assert.equal(
      sha256(gitBytes("show", `${investorWebsiteRouteQualitySuccessorCommit}:${mirror.path}`)),
      mirror.currentSha256
    );
  }
  assert.equal(investorWebsiteRouteQualitySuccessor.reviewedInvariants.runtimeBehaviorChanged, false);
  assert.equal(investorWebsiteRouteQualitySuccessor.reviewedInvariants.routeOrderingChanged, false);
  assert.equal(investorWebsiteRouteQualitySuccessor.reviewedInvariants.routeScoringChanged, false);
  assert.equal(investorWebsiteRouteQualitySuccessor.boundaries.recommendationInfluence, "OFF");
  assert.equal(investorWebsiteRouteQualitySuccessor.boundaries.readinessState, "INSUFFICIENT_EVIDENCE");
  assert.equal(investorWebsiteRouteQualitySuccessor.boundaries.representativeShadowOutputExposed, false);

  assert.equal(restored3dRouteQualitySuccessor.batchId, "BATCH-20260719-006");
  assert.equal(restored3dRouteQualitySuccessor.status, "OWNER_REVIEWED_AND_SYNCHRONIZED");
  assert.equal(restored3dRouteQualitySuccessor.ownerSubsystem, "Prometheus Intelligence Engine");
  assert.equal(restored3dRouteQualitySuccessor.predecessor.path, investorWebsiteRouteQualitySuccessorPath);
  assert.equal(
    restored3dRouteQualitySuccessor.predecessor.sha256,
    sha256(read(investorWebsiteRouteQualitySuccessorPath))
  );
  assert.equal(restored3dRouteQualitySuccessor.predecessor.remainsHistorical, true);
  assert.equal(restored3dRouteQualitySuccessor.predecessor.rewritten, false);

  const restoredDataTransition = restored3dRouteQualitySuccessor.dataOwnerTransition;
  assert.equal(restoredDataTransition.commit, restored3dRouteQualityDataCommit);
  assert.equal(restoredDataTransition.ownerSubsystem, "Prometheus Data");
  assert.equal(
    restoredDataTransition.tree,
    git("rev-parse", `${restored3dRouteQualityDataCommit}^{tree}`)
  );
  assert.deepEqual(restoredDataTransition.changedPaths.slice().sort(), expectedRouteQualityDataPaths);
  for (const transition of [
    restoredDataTransition.routeQualityGate,
    restoredDataTransition.canonicalRouteQualityReport,
    restoredDataTransition.routeQualityRegression
  ]) {
    assert.equal(
      sha256(gitBytes("show", `${restored3dRouteQualityDataCommit}:${transition.path}`)),
      transition.currentSha256,
      `${transition.path} restored 3D Data owner hash drifted.`
    );
  }
  assert.deepEqual(
    changedPaths(restored3dRouteQualitySuccessorCommit),
    expectedRestored3dRouteQualitySuccessorPaths
  );
  assert.equal(
    restored3dRouteQualitySuccessor.dataOwnerTransition.commit,
    restored3dRouteQualityDataCommit
  );
  for (const reference of restored3dRouteQualitySuccessor.protectedReferenceAudit.affectedIntelligenceReferences) {
    assert.equal(
      sha256(gitBytes("show", `${restored3dRouteQualitySuccessorCommit}:${reference.consumerPath}`)),
      reference.currentConsumerSha256
    );
    const currentConsumerSha256 = sha256(read(reference.consumerPath));
    assert.equal(
      currentConsumerSha256 === reference.currentConsumerSha256
        || isCurrentAugust1IntelligenceTransition(
          reference.consumerPath,
          reference.currentConsumerSha256,
          currentConsumerSha256
        )
        || isCurrentCrossIndustryIntelligenceTransition(
          reference.consumerPath,
          currentConsumerSha256
        )
        || isCurrentZipFounderAccessIntelligenceTransition(
          reference.consumerPath,
          currentConsumerSha256
        )
        || isCurrentHardenedSmokeGuardIntelligenceTransition(
          hardenedSmokeGuardIntelligenceTransitions,
          reference.consumerPath,
          currentConsumerSha256
        )
        || isCurrentProspectiveCalibrationIntelligenceTransition(
          reference.consumerPath,
          currentConsumerSha256
        )
        || isCurrentLeanPhase1IntelligenceTransition(
          reference.consumerPath,
          currentConsumerSha256
        )
        || isLeanPhase1ActiveArchitectureVerification(reference.consumerPath)
        || isComposedCurrentIntelligenceTransition(
          reference.consumerPath,
          reference.currentConsumerSha256,
          currentConsumerSha256
        )
        || isCurrentRetentionDeletionIntelligenceTransition(
          hardenedSmokeGuardIntelligenceTransitions,
          reference.consumerPath,
          reference.currentConsumerSha256,
          currentConsumerSha256
        ),
      true,
      `${reference.consumerPath} current Intelligence successor drifted.`
    );
  }
  for (const mirror of restored3dRouteQualitySuccessor.protectedReferenceAudit.ownerVerificationMirrors) {
    const currentMirrorSha256 = sha256(read(mirror.path));
    assert.equal(
      currentMirrorSha256 === mirror.currentSha256
        || isCurrentAugust1IntelligenceTransition(
          mirror.path,
          mirror.currentSha256,
          currentMirrorSha256
        )
        || isCurrentCrossIndustryIntelligenceTransition(
          mirror.path,
          currentMirrorSha256
        )
        || isCurrentZipFounderAccessIntelligenceTransition(
          mirror.path,
          currentMirrorSha256
        )
        || isCurrentHardenedSmokeGuardIntelligenceTransition(
          hardenedSmokeGuardIntelligenceTransitions,
          mirror.path,
          currentMirrorSha256
        )
        || isCurrentProspectiveCalibrationIntelligenceTransition(
          mirror.path,
          currentMirrorSha256
        )
        || isCurrentLeanPhase1IntelligenceTransition(
          mirror.path,
          currentMirrorSha256
        )
        || isLeanPhase1ActiveArchitectureVerification(mirror.path)
        || isComposedCurrentIntelligenceTransition(
          mirror.path,
          mirror.currentSha256,
          currentMirrorSha256
        )
        || isCurrentRetentionDeletionIntelligenceTransition(
          hardenedSmokeGuardIntelligenceTransitions,
          mirror.path,
          mirror.currentSha256,
          currentMirrorSha256
        ),
      true,
      `${mirror.path} current Intelligence successor drifted.`
    );
  }
  assert.equal(restored3dRouteQualitySuccessor.reviewedInvariants.runtimeBehaviorChanged, false);
  assert.equal(restored3dRouteQualitySuccessor.reviewedInvariants.routeOrderingChanged, false);
  assert.equal(restored3dRouteQualitySuccessor.reviewedInvariants.routeScoringChanged, false);
  assert.equal(restored3dRouteQualitySuccessor.boundaries.recommendationInfluence, "OFF");
  assert.equal(restored3dRouteQualitySuccessor.boundaries.readinessState, "INSUFFICIENT_EVIDENCE");
  assert.equal(restored3dRouteQualitySuccessor.boundaries.representativeShadowOutputExposed, false);

  assert.deepEqual(changedPaths(restored3dClaimsDataCommit), [
    publicClaimsEvidenceMatrixPath,
    "tests/route-iq-public-claims-data.test.mjs"
  ].sort());
  const publicClaimsEvidenceMatrix = readJson(publicClaimsEvidenceMatrixPath);
  const intelligenceCorroboration = publicClaimsEvidenceMatrix.crossOwnerCorroborationSources.find(
    source => source.ownerSubsystem === "Prometheus Intelligence Engine"
  );
  const leanClaimsTransition = currentLeanPhase1TransitionsByPath()
    .get(currentCrossIndustryIntelligenceClaimsPath)
    ?.find(transition => (
      transition.commit === intelligenceCorroboration.ownerCommit
      && transition.tree === intelligenceCorroboration.ownerTree
      && transition.currentSha256 === intelligenceCorroboration.sha256
    ));
  assert.equal(
    intelligenceCorroboration.ownerCommit === restored3dRouteQualitySuccessorCommit
      || intelligenceCorroboration.ownerCommit === currentCrossIndustryIntelligenceSuccessorCommit
      || Boolean(leanClaimsTransition),
    true
  );
  if (leanClaimsTransition) {
    assert.equal(intelligenceCorroboration.path, currentCrossIndustryIntelligenceClaimsPath);
    assert.deepEqual(changedPaths(leanClaimsTransition.commit), [
      currentCrossIndustryIntelligenceClaimsPath
    ]);
  }
  if (intelligenceCorroboration.ownerCommit === currentCrossIndustryIntelligenceSuccessorCommit) {
    assert.equal(intelligenceCorroboration.path, currentCrossIndustryIntelligenceClaimsPath);
    assert.deepEqual(
      git(
        "show",
        "-s",
        "--format=%an <%ae>%n%cn <%ce>",
        currentCrossIndustryIntelligenceSuccessorCommit
      ).split("\n"),
      [
        "Prometheus Intelligence Engine <intelligence@prometheus.local>",
        "Prometheus Intelligence Engine <intelligence@prometheus.local>"
      ]
    );
    assert.equal(
      changedPaths(currentCrossIndustryIntelligenceSuccessorCommit)
        .includes(currentCrossIndustryIntelligenceClaimsPath),
      true
    );
    assert.doesNotThrow(() => git(
      "merge-base",
      "--is-ancestor",
      currentCrossIndustryIntelligenceSuccessorCommit,
      "HEAD"
    ));
  }
  assert.equal(
    intelligenceCorroboration.ownerTree,
    git("rev-parse", `${intelligenceCorroboration.ownerCommit}^{tree}`)
  );
  assert.equal(
    intelligenceCorroboration.sha256,
    sha256(gitBytes(
      "show",
      `${intelligenceCorroboration.ownerCommit}:${intelligenceCorroboration.path}`
    ))
  );

  const dataValidation = mapping.dataOwnerValidation;
  assert.equal(dataValidation.contractMismatchClosed, true);
  assert.equal(
    sha256(gitBytes("show", `${dataValidation.currentOwnerSuccessorCommit}:${dataValidation.dataArchiveRuntimePath}`)),
    dataValidation.dataArchiveRuntimeSha256
  );
  assert.equal(
    sha256(gitBytes("show", `${dataValidation.currentOwnerSuccessorCommit}:${dataValidation.dataRuntimeContractPath}`)),
    dataValidation.dataRuntimeContractSha256
  );
  assert.equal(sha256(read(dataValidation.historicalRawArchivePath)), dataValidation.historicalRawArchiveSha256);
  assert.equal(sha256(read(dataValidation.historicalNormalizedArchivePath)), dataValidation.historicalNormalizedArchiveSha256);
  assert.equal(dataValidation.knownAndContemporaneousUnknownClassification, "action_time_observation");
  assert.equal(dataValidation.legacyFallbackClassification, "late_report_finalization_unknown");
  assert.equal(dataValidation.lateFallbackMaySatisfyOriginalShadowOpportunity, false);
  assert.equal(dataValidation.historicalArchiveRewritten, false);
  assert.equal(dataValidation.retryAndReplayRemainIdempotent, true);
  assert.equal(dataValidation.workspaceIsolationPreserved, true);
  assert.equal(dataValidation.currentOwnerSuccessorCommit, "f50d10f14f993b4e6ff42887e76c10721852cc43");

  const dashboardValidation = mapping.dashboardOwnerValidation;
  assert.equal(dashboardValidation.evidencePath, dashboardEvidencePath);
  assert.equal(dashboardValidation.representativeBehaviorApproval, "FOUNDER_BEHAVIOR_APPROVAL_REQUIRED");
  assert.equal(dashboardValidation.decisionSourceOptional, true);
  assert.equal(dashboardValidation.captureTiming, "visit_submission_post_action");
  assert.equal(dashboardValidation.preActionFrozenCandidateContextProduced, false);
  assert.equal(dashboardValidation.fullShadowCandidateContextPreserved, false);
  assert.equal(dashboardValidation.personallyIdentifiableInformationCollectionExpanded, false);
  assert.equal(dashboardValidation.shadowOutputsVisibleToRepresentatives, false);
  assert.equal(dashboardValidation.recommendationInfluence, "OFF");

  for (const flag of [
    "newSubsystemIntroduced",
    "parallelProductionEventArchitectureIntroduced",
    "newModelOrVendorDependencyIntroduced",
    "personallyIdentifiableInformationCollectionExpanded",
    "shadowOutputRepresentativeVisibility",
    "routeOrderingInfluenceIntroduced",
    "notificationInfluenceIntroduced",
    "automaticActionInfluenceIntroduced",
    "productionConsumerIntroduced",
    "prospectiveShadowEvidenceCollectionStarted",
    "historicalArchiveRewritten"
  ]) {
    assert.equal(mapping.architectureConfirmation[flag], false, `${flag} must remain false.`);
  }
  assert.equal(mapping.architectureConfirmation.recommendationInfluence, "OFF");
  assert.equal(mapping.releaseBoundary.pushPerformed, false);
  assert.equal(mapping.releaseBoundary.deploymentPerformed, false);
  assert.equal(mapping.releaseBoundary.founderBehaviorApprovalRequired, true);

  return {
    status: "PASS",
    batchId,
    legacyCommit,
    intelligenceContractsReconstructed: intelligenceContractPaths.length,
    protectedConsumersVerified: intelligenceContractPaths.length + 1,
    dashboardBehaviorApproval: "FOUNDER_BEHAVIOR_APPROVAL_REQUIRED",
    recommendationInfluence: "OFF",
    productionConsumerIntroduced: false,
    currentIntelligenceOwnerSuccessor: currentIntelligenceOwnerSuccessorCommit,
    protectedBaselineSuccessor: protectedBaselineSuccessorCommit,
    routeQualitySuccessor: routeQualitySuccessorCommit,
    commercialRouteQualitySuccessor: commercialRouteQualitySuccessorCommit,
    currentDashboardSourceCommit,
    currentDashboardValidationCommit,
    currentAugust1IntelligenceSuccessorCommit,
    currentPaidCustomerIntelligenceSuccessorCommit,
    currentPrivateSmokeTimeoutIntelligenceSuccessorCommit,
    currentControlledRehearsalIntelligenceSuccessorCommit,
    currentRevenueReadinessIntelligenceSuccessorCommit:
      currentRevenueReadinessIntelligenceSuccessor.commit,
    currentFullSystemHarmonyIntelligenceSuccessorCommit:
      currentFullSystemHarmonyIntelligenceSuccessor.commit,
    currentLiveCanonicalIdentityIntelligenceSuccessorCommit:
      currentLiveCanonicalIdentityIntelligenceSuccessor.commit,
    currentFieldSessionReportTypeIntelligenceSuccessorCommit:
      currentFieldSessionReportTypeIntelligenceSuccessor.commit,
    currentFieldSessionReportTypeDriftRejectionSuccessorCommit:
      currentFieldSessionReportTypeDriftRejectionSuccessor.commit,
    currentFullSystemHarmonyShadowReadinessSuccessorCommit:
      currentFullSystemHarmonyShadowReadinessSuccessor.commit,
    currentLiveCanonicalIdentityShadowReadinessRepairCommit:
      currentLiveCanonicalIdentityShadowReadinessRepair.commit,
    currentLiveCanonicalIdentityProtectedConsumerCompositionRepairCommit:
      currentLiveCanonicalIdentityProtectedConsumerCompositionRepair.commit,
    currentLiveCanonicalIdentityOffRouteBaselineRepairCommit:
      currentLiveCanonicalIdentityOffRouteBaselineRepair.commit,
    currentRetentionDeletionIntelligenceSuccessorCommit:
      currentRetentionMaintenanceIntelligenceSuccessor.coherenceCommit,
    currentGovernedLearningIntelligenceSuccessorCommit:
      currentGovernedLearningIntelligenceSuccessorChain.at(-1).commit,
    currentProtectedDriftFixtureIntelligenceSuccessorCommit:
      currentProtectedDriftFixtureIntelligenceSuccessor.commit
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log(JSON.stringify(verifyReleaseProvenanceRepair(), null, 2));
}
