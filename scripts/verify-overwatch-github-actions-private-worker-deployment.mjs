import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  listTrackedFiles,
  scanTrackedRepository,
  verifyLocalSecretArtifacts
} from "./check-cloudflare-unattended-secret-presence.mjs";
import { fixedCloudflareUnattendedSmokePlan } from "./run-cloudflare-unattended-smoke.mjs";
import { verifyGithubActionsPrivateWorkerDeployment } from
  "./verify-github-actions-private-worker-deployment.mjs";
import { verifyGithubActionsPrivateWorkerWorkflowV2 } from
  "./verify-github-actions-private-worker-workflow-v2.mjs";

const root = resolve(import.meta.dirname, "..");
const governancePath =
  "overwatch/governance/github-actions-founder-triggered-private-worker-deployment-v1.json";
const governanceDocumentationPath =
  "overwatch/governance/github-actions-founder-triggered-private-worker-deployment-v1.md";
const governanceV2Path =
  "overwatch/governance/github-actions-private-worker-deployment-v2.json";
const governanceV2DocumentationPath =
  "overwatch/governance/github-actions-private-worker-deployment-v2.md";
const historicalReportPath =
  "overwatch/reports/BATCH-20260715-010-github-actions-founder-triggered-private-worker-deployment.json";
const compatibilityReportPath =
  "overwatch/reports/BATCH-20260715-011-github-private-repository-founder-deployment-authorization.json";
const registryPath = "overwatch/artifact-contracts/canonical-artifact-registry.json";
const workflowPath = ".github/workflows/deploy-prometheus-private-worker.yml";
const contractPath =
  "workers/infrastructure/github-actions-founder-triggered-private-worker-deployment-v1.json";
const contractV2Path =
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json";

const historicalOwnerCommit = "7f67855145104034b32551e25d2ebf407ce2369c";
const historicalOwnerRepairCommit = "335f75fa1d7e32160624e9ebe197d11a03e77b4e";
const historicalReleaseBase = "7c79e77dc52dd6aa5eb687ea9a24128800d9a28d";
const historicalReleaseBaseTree = "cc8d5455370f8171aa64d0f1be71f02c2d9ce2a7";
const historicalOwnerTree = "890df231e06aa92a7652b0862456bd0c4394cabe";
const historicalOwnerRepairTree = "b9965d026eeba4cb06ed6ecd9066646169ece071";
const compatibilityParent = "7a67cb648cbaa67599163ac418c2e23aa3f8b0e3";
const compatibilityOwnerCommit = "38e983b6d0a121d8aadf443938ab5985771eddac";
const compatibilityOwnerTree = "6bf0c7608e4f73788bc9428ee2d40f3f8df7e811";
const founderActor = "PrometheusRouteIQ";
const founderAuthorization =
  "I AUTHORIZE THIS EXACT PROMETHEUS PRIVATE WORKER DEPLOYMENT";
const v2OwnerCommit = "5c9621e29c4d613e997c8fee3c75d67c6fd0828c";
const v2OwnerParent = "8976c077eef91147368c9b5566b5310c04fd6630";
const v2OwnerTree = "a910015245eccb1f3af9b4ecba947c0ced0835fb";
const v2OwnerRepairCommit = "266fb19637fc11dc0c27e42bbfc7a1816cc7cdad";
const v2OwnerRepairTree = "09f50df144a4f4890c327306d051bbcf11bd362a";
const v2BootstrapRepairCommit = "a5ae6578bc0c030def8df5d4713d5ecbe5206212";
const v2BootstrapRepairParent = "2dda98c901889b9a115592d9f1f74b8d24deb56f";
const v2BootstrapRepairTree = "fba13a295f427eefad01b1f3c9b84c5a08eb7d37";
const v2RunnerWorkspaceRepairCommit = "254fea23e18fec27228e15e75986a1c6bb3dffd6";
const v2RunnerWorkspaceRepairParent = "f293d37ad8588755151dbf7fc83f1aa19118fd9b";
const v2RunnerWorkspaceRepairTree = "0770f3a6f6a1626f8510e1300b4fdbef936206c8";
const v2TrustedTempAliasRepairCommit = "6a764ad86ad4f99e0bd9ed835c8f1aba20f91a3b";
const v2TrustedTempAliasRepairParent = "d33792af0cb6d544ba5ae15990994089dbd7ccc1";
const v2TrustedTempAliasRepairTree = "a1ec42af2b0049cfc15020f37e921885f75ad0ce";
const v2WranglerScratchIsolationCommit = "947720badd46cb053c6e199b96b3739180b26690";
const v2WranglerScratchIsolationTree = "ccf08603d668bb7bc0bba76c76aefd5a4954852d";
const v2Node24CleanupRepairCommit = "1341e8edf6e96603437b7bff95768531e2f5446a";
const v2Node24CleanupRepairParent = "a887033b1840f8933f59b1bc6b783248bd56271c";
const v2Node24CleanupRepairTree = "c9c9330c8a9b3fc805e751698f85a75ee1817eb2";
const v2CanonicalSmokeRepairCommit = "dfa52c70cd48b33771d6c85de6483c499d9b038f";
const v2CanonicalSmokeRepairParent = "7855b0714f8fc178b5be6f8124ef02acad529312";
const v2CanonicalSmokeRepairTree = "8ab4c1047cc9aa51655e4313f677d955e8c7d636";
const v2PublicBundlePreservationCommit = "a4572b351473bf5c0183d748434d77de04d882f0";
const v2PublicBundlePreservationParent = "b09649990deb0410e7edae5ff7886707c31ee4a7";
const v2PublicBundlePreservationTree = "798c76cd3f2f53c7fe0ab6d707ef89660b46a2de";
const v2CanonicalClientIsolationCommit = "c7bbf6413430da2e55f94041bba70fcbdb4a95ba";
const v2CanonicalClientIsolationTree = "8a86830a3cb4ad489583f513ee7fe3cfb16e3bc0";
const v2PayloadContinuityCommit = "b64f6f05940bdf24ba57dfe488f567853e0c3d22";
const v2PayloadContinuityTree = "9748bbb49da416bc7f418c2b738788e4fdd4bea7";
const v2ReleasePropagationRepairCommit = "25ff53a7e61b50962144c5c689cc7a546875f724";
const v2ReleasePropagationRepairParent = "a83e069016622d968702c4db40c251ccbff744dd";
const v2ReleasePropagationRepairTree = "25f27adbd21a281d1294a68362b994403934095e";
const v2RollbackRootGuardRepairCommit = "6f7216afa09b72442f53a271a8b9fc749aa34d4b";
const v2RollbackRootGuardRepairParent = v2ReleasePropagationRepairCommit;
const v2RollbackRootGuardRepairTree = "414e500a735885f460cb25afc18b0387d43e8125";
const v2GuardConvergenceRepairCommit = "c217ad43e4dbae32690661463eb6cfa38a19e95c";
const v2GuardConvergenceRepairParent = "b27cc59ebf8e575187167bbcba915fe3d6a94074";
const v2GuardConvergenceRepairTree = "0a63711714871a62950eb96c4b1d80b94555f19f";
const v2ForwardPayloadPinCorrectionCommit = "b540084521c87ccad85b41b5e9d1714a497f73e0";
const v2ForwardPayloadPinCorrectionParent = v2GuardConvergenceRepairCommit;
const v2ForwardPayloadPinCorrectionTree = "964583be49a8859ace9b6c3e560338617c95744f";
const v2UnconditionalGuardRoutingCommit = "ceea5b6496f81341a49f605622d78daf084d9f6f";
const v2UnconditionalGuardRoutingParent = "f494d87783fea3e6425913a4c93ddafbe3f05f18";
const v2UnconditionalGuardRoutingTree = "4ae9572745cc260b347309a51f8e98a39720d1d4";
const v2PaidCustomerAcceptanceCommit = "3872b30d1f16acde85518ae857bae09336aaed3b";
const v2PaidCustomerAcceptanceParent = "77185e882f0be8e7928de42c9e478d866ed91571";
const v2PaidCustomerAcceptanceTree = "d1a12d7336e1739b33a0f83a8e33213939b0ea6c";
const v2BrowserAcceptanceRepairCommit = "ff01434aac512f46b6c582d013056fe5b466ce6e";
const v2BrowserAcceptanceRepairParent = "25f0f2dedbdec8aab184c9384bc5c9731e25ee40";
const v2BrowserAcceptanceRepairTree = "fd5088993a06935a92d3f8d4301a632355571d9f";
const v2SmokeSequencingRepairCommit = "d41f900930d1c6036a536ea4d64ba5beb1779195";
const v2SmokeSequencingRepairParent = "b2dff15cb69fcc21210ddc283ebbee90d3a70d5d";
const v2SmokeSequencingRepairTree = "525c78893aad8b461c829789c9ef71cb40b18c1b";
const v2ProbePropagationRepairCommit = "89bd37ad4a05b89ed624b0f18edcffdcb7e8129d";
const v2ProbePropagationRepairParent = "a14339d7a737d02f0b10763a215b56a69a6fb503";
const v2ProbePropagationRepairTree = "362785385b713d1be4a501b273357cb33a1eeca6";
const v2BrowserHealthDiagnosticsRepairCommit =
  "dba70aa70f863518d9afdb7343788b998ef567e1";
const v2BrowserHealthDiagnosticsRepairParent =
  "dc7038b31e726f3d9e48115534c9f269bb44906a";
const v2BrowserHealthDiagnosticsRepairTree =
  "306f4afd26b51fe5d0cc064bf8e0b3571923b97d";
const v2BrowserAcceptanceEvidenceRepairCommit =
  "f27544bfc21a1ae7ceae05a6421a6b9d02007366";
const v2BrowserAcceptanceEvidenceRepairParent =
  "9d2d05a3e5927fc727cec73896efd8ac95cb396d";
const v2BrowserAcceptanceEvidenceRepairTree =
  "631e108004fed45183e3e936e92ed33b5cf82f1b";
const v2ServiceWorkerGuardRepairCommit =
  "4d5b201dabf6e458633eec7500363fd28f4ac4e5";
const v2ServiceWorkerGuardRepairParent =
  "952e2ee7c016b255451d564af5d12dd2f42f1db5";
const v2ServiceWorkerGuardRepairTree =
  "ab7a82bd64232c275860a0d0540b4992538364b9";
const v2HttpPathDiagnosticsRepairCommit =
  "c08bd2a6a0bf162a5bf3b312e0c680eb0d6f68e3";
const v2HttpPathDiagnosticsRepairParent =
  "b3469efb9cf33cbea2ed13484f4eb89dc8846ae9";
const v2HttpPathDiagnosticsRepairTree =
  "e3d1bf576a098319293a6d0591cad16f7046f837";
const v2BrowserManagedIconRepairCommit =
  "25e9b5ae09fb6029006804da57a7f10ddcd64a1e";
const v2BrowserManagedIconRepairParent =
  "9dc7a62de102e5039710e29587c3fbcb24b1562d";
const v2BrowserManagedIconRepairTree =
  "bd3e0fd3c11eb0681cd3acbf6a837aae2aa00b00";
const v2BrowserManagedIconSecretScanRepairCommit =
  "09354a69109770c49f04aeef319246e636c8a196";
const v2BrowserManagedIconSecretScanRepairParent =
  "25e9b5ae09fb6029006804da57a7f10ddcd64a1e";
const v2BrowserManagedIconSecretScanRepairTree =
  "2420a0c803c3d0e5e52f54c13a16a5b85a83a973";
const v2BrowserSmokeMarkerPropagationRepairCommit =
  "0f26a2223c06c4c9a28cf199e5a2f183f0a6126e";
const v2BrowserSmokeMarkerPropagationRepairParent =
  "a2fa1ce774990d2f2a86f0a71bae7f5fab2b331d";
const v2BrowserSmokeMarkerPropagationRepairTree =
  "96878ef5f8e930765aa089876699fb36fcacee62";

const v2OwnerHashes = Object.freeze({
  ".github/workflows/deploy-prometheus-private-worker-v2.yml":
    "b9ed905636e7a8498d47f137821663382a39b14e4d0f854603f903cb6236efd0",
  ".github/workflows/qualify-prometheus-private-worker-v2.yml":
    "b542c1a254caaea2b73501accfa410ac31f1829c6f7e9b67a0d5f02c4b745f47",
  "scripts/lib/github-actions-private-worker-workflow-v2.mjs":
    "d4415be2f3da11380493076f3a062d9a2792aa46538151ec6630cc36953dcaf9",
  "scripts/run-github-actions-private-worker-artifact-metadata-v2.mjs":
    "597bfc5712db73d4fcc2a6714bab628ed7f77a6394fbcd7ce80eb11e9799c8d3",
  "scripts/run-github-actions-private-worker-deployment-v2.mjs":
    "16ff07f82fa313078e4abd27aa480c4e9f8e6ab6bc27380592f290485340e8ac",
  "scripts/run-github-actions-private-worker-qualification-v2.mjs":
    "501b56f464c7d91247cea21cfe4d6c48ab3a9d2e589c468fbfdc277ce984e466",
  "scripts/verify-github-actions-private-worker-workflow-v2.mjs":
    "dfd5a8e27e326f34a7361386de178925cd42723be550218843cb45004565fd72",
  "tests/github-actions-private-worker-workflow-v2.test.mjs":
    "8bba6f343c4996b3b8a8e506ffb778e9f788bbcf3f6bba6a3e21651fe28ec848",
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json":
    "d01d6011a0e675326a9405d9f09b4c96a28fee8928b082c41342c9c2baba8f8e"
});

const v2BootstrapRepairHashes = Object.freeze({
  ".github/workflows/deploy-prometheus-private-worker-v2.yml":
    "8288903bee7e628c84217d4a08a8c9f9035be65a0ed0f17f249454be4dd0a4e1",
  "scripts/lib/github-actions-private-worker-workflow-v2.mjs":
    "72834da031493c33821eced53d7d99017d01ee3bc07f216e18b0595223df6067",
  "scripts/run-cloudflare-unattended-smoke.mjs":
    "21fd114e389d5066ee309998546893017631004700a347bba922d9743e76152f",
  "scripts/run-github-actions-private-worker-deployment-v2.mjs":
    "af6c604899b13bc2b994d62a733436cc6424223626dbab0e80425ad2c89e3063",
  "scripts/verify-github-actions-private-worker-workflow-v2.mjs":
    "48a7595b95d422f8f3def9f6e603a0b67bf0acd08ababb54738c28c610e415f7",
  "tests/cloudflare-unattended-runtime-guard.test.mjs":
    "36522c07666df278ec2791246bbcfdf0a9fd5193051b5ba1fdcbe623120ae40b",
  "tests/github-actions-private-worker-workflow-v2.test.mjs":
    "fb945a51a5556aaf5b9e22c659c49429aec83465f10920b6e634b772f872ca4c",
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json":
    "87dfe2db6bb803b528ad73656ddd9fba31efd35a049d4e1bfe140c52edee6b22"
});

const v2RunnerWorkspaceRepairHashes = Object.freeze({
  "scripts/run-github-actions-private-worker-deployment-v2.mjs":
    "ed7572003565fa989bdb85ef63232585527b8ee1ea5e52aa537e18e0c9bbb25b",
  "scripts/verify-github-actions-private-worker-workflow-v2.mjs":
    "b0c5968daa1bef96139cb9b8797bd0ddae449ad3b4175a1a6ca73d8bdcad54c2",
  "tests/github-actions-private-worker-workflow-v2.test.mjs":
    "82f66577294d3a76196246e3695838634e20e55c2780cc72c138f561b98abaa8",
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json":
    "136ce3d70a081fd0366a54358891cd37b40277bb702a4d995635a3c19b6d6e1d"
});

const v2TrustedTempAliasRepairHashes = Object.freeze({
  "scripts/lib/github-actions-private-worker-workflow-v2.mjs":
    "59c0e63437430a06f5e7f027759c5ef7f2ccdf0400b8ddf980cad42ca3c3c82b",
  "scripts/verify-github-actions-private-worker-workflow-v2.mjs":
    "71868c3880e40c70036ad1e9ca45bb19c340adbe3965a7af09112d485c38832d",
  "tests/github-actions-private-worker-workflow-v2.test.mjs":
    "f09786afcb40234528e010f4f5c379399f6c9ddf50d0d234e9d3267d543a7574",
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json":
    "c9cc3f5ad81e11e55d71c45ea4d175f3d01f23abd49dc2301b37a124fe2c96ed"
});

const v2WranglerScratchIsolationHashes = Object.freeze({
  "scripts/lib/github-actions-private-worker-workflow-v2.mjs":
    "3f295df44fe155e5bd0ac70420a55506bfeee1b1529153304c8983f55bbb2270",
  "scripts/verify-github-actions-private-worker-workflow-v2.mjs":
    "0676b9b592021f028560b4fb465d8d13cc52155bad386b8b4bdf98134a4a1c68",
  "tests/github-actions-private-worker-workflow-v2.test.mjs":
    "4f594733088d7e138c53cd69988765fcfd1d4db6b7fadce5d152bbdc4c228659",
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json":
    "4b7f7faf9f4d59f60fecb17431bb43ae768e8b7cd80b3f9c75adf9b2bcb05c03"
});

const v2Node24CleanupRepairHashes = Object.freeze({
  "tests/github-actions-private-worker-workflow-v2.test.mjs":
    "4f18145316c10be2f425c153ba56a4785c8934fa0a80d0930c61830418f44d17"
});

const v2CanonicalSmokeRepairHashes = Object.freeze({
  "docs/cloudflare-unattended-deployment-access-v1.md":
    "31d9acf9a514ef54b328096d9aad78a818de9effc4808bf8750045171082a3be",
  "scripts/lib/github-actions-private-worker-workflow-v2.mjs":
    "c4efe6e554bd5ea328c7a0f7ae8d6b86bc78f8db3733877dced827a492cc503f",
  "scripts/verify-cloudflare-unattended-runtime-guard.mjs":
    "e27a05412ebaca64d3679932f708d98e2d21430181a307a99a9ad3af555afec3",
  "tests/cloudflare-unattended-runtime-guard.test.mjs":
    "fe6499c4caca8a1ab41efa245673aab020799973604b1e7db0593941659daaab",
  "workers/infrastructure/cloudflare-unattended-deployment-access-v1.json":
    "49a102aa45907b80f01ede2768d9f4ea723a5f4a560c8461c9d4df7e938c45db",
  "workers/infrastructure/cloudflare-unattended-smoke-contract.js":
    "dbc5c7ccc148223828a6a93588f5917d06d7cf8bbaafa4a3cc526f9079558b21",
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json":
    "f38e51dd84beb7b1f3e1ff43e4711f463793e6c48cad28a107bafa2236acd80b"
});

const v2PublicBundlePreservationHashes = Object.freeze({
  "docs/cloudflare-unattended-deployment-access-v1.md":
    "1981a79b729bfc6cc2cd50accc96586c229cf8d3be180a5c67bbb3e12d43c412",
  "scripts/verify-cloudflare-unattended-runtime-guard.mjs":
    "e275098cae892202543d74c3e6a608c4b6e5d703544d100aade72d22992d9436",
  "tests/cloudflare-unattended-runtime-guard.test.mjs":
    "4deb42ad51e5df9294847d9801be02bff16fb959b738f4d2b50f1dc9661a2d98",
  "workers/infrastructure/cloudflare-unattended-deployment-access-v1.json":
    "cc4497e14c02b72a2e787215eee72f609bab47740b39d56eaa1197143cae53a3",
  "workers/infrastructure/cloudflare-unattended-smoke-contract.js":
    "85d40e9af08357cd7418ae2de3b9a8fadb7bb7163a46a384b5ccf6dc90dddcb5"
});

const v2CanonicalClientIsolationHashes = Object.freeze({
  "scripts/run-cloudflare-unattended-smoke.mjs":
    "b8ff2859ffdc3eddf47346536a3e1e220fe39d0c8fd8c125e889d0860c60170b",
  "workers/infrastructure/cloudflare-unattended-smoke-contract.js":
    "2aeb32d7fd43fcb9acaea072919b462c9bba6da4ae270d03c032c0b81bf3d680"
});

const v2PayloadContinuityHashes = Object.freeze({
  "scripts/lib/github-actions-private-worker-workflow-v2.mjs":
    "3f295df44fe155e5bd0ac70420a55506bfeee1b1529153304c8983f55bbb2270",
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json":
    "4b7f7faf9f4d59f60fecb17431bb43ae768e8b7cd80b3f9c75adf9b2bcb05c03"
});

const v2ReleasePropagationRepairHashes = Object.freeze({
  "scripts/build-route-iq-private-forward-rollback-candidate-v3.mjs":
    "2e2a667a22ea9b49b63cfb5e4e164805ce0eac1009a779dfd6bdddcaa6fb1eb9",
  "scripts/lib/github-actions-private-worker-workflow-v2.mjs":
    "a70895204b267ccddce168ecd68e6fb905c8440b64313116248e209cae1b18e3",
  "scripts/run-cloudflare-unattended-smoke.mjs":
    "23b6bcbdc1dd1269f54e867c9be9c4fa5aa1435502fc4ce28f50c41704fcc7d1",
  "scripts/run-github-actions-private-worker-deployment-v2.mjs":
    "b4c6a5f1458db28adcac691a3df345afeb423bef387ee8d298e73962c9cc516b",
  "scripts/verify-github-actions-private-worker-workflow-v2.mjs":
    "967930d51af6f5b4f503e9420ea4c3e9efd3c1f9e65b6cad9572578b53533986",
  "tests/cloudflare-unattended-runtime-guard.test.mjs":
    "527729cbf7be101fc65a308035d5877dc036f2f477f66a835afa7a2785272a91",
  "tests/github-actions-private-worker-workflow-v2.test.mjs":
    "926a50e3baf4dde74aa26f1efafc95e11066bfa84cf4b1bc4c65503fd8bcc5b7",
  "tests/route-iq-private-forward-rollback-candidate-v3.test.mjs":
    "3fe6b9b2595cb5c41382e556bce8d49bb2a96432f5e0f70eed56811279258492",
  "workers/infrastructure/cloudflare-unattended-smoke-contract.js":
    "b2a175fefd963f52c9b9738b8cd00074dc72ba97d11460887cda2a49bda9247e",
  "workers/infrastructure/cloudflare-unattended-smoke-guard.js":
    "a67375594478bc4bed3b3f9341778da1f07252a5cc711a45d81e11cf71ac8f62",
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json":
    "7779119d36fe8b09a4afeb31be1ed88f9ee5ed991314e9a43e4ebb3732819c59",
  "workers/infrastructure/route-iq-private-forward-rollback-candidate-v3.json":
    "cce54655218526e554c35e11b0599caf559fcf014c2c57c1ade2a65e770b0d32",
  "workers/infrastructure/route-iq-private-forward-rollback-wrangler-v3.json":
    "6ddc92bb2fa764a8058fe2256574d3e319ae3724886908e43924ea962ab6bd06",
  "workers/prometheus-iq-worker.js":
    "cb94edb98f424de58d113722b743d16fa1512320d2fc5812f752b75b361985a6",
  "wrangler.jsonc":
    "b888732c12aa34d07f538d7ae112b6eb3f966c75d24839bac76d4e8ea6b9a835"
});

const v2RollbackRootGuardRepairHashes = Object.freeze({
  "scripts/build-route-iq-private-forward-rollback-candidate-v3.mjs":
    "5fc82e8972162b29540555d33f862121fcf00a2752b48a627871e0f313e8fe9c",
  "scripts/lib/github-actions-private-worker-workflow-v2.mjs":
    "05648d6914a8503ec7fef1a1961fc23be6dd70d01efde883b7118ae8d1833230",
  "tests/github-actions-private-worker-workflow-v2.test.mjs":
    "b0e35215365489f983f81429281b326bccf93bdb94610cdba1d6d6e3d99f00a4",
  "tests/route-iq-private-forward-rollback-candidate-v3.test.mjs":
    "38831bdfb713d75dfcf69178eff27a8a6237ec523950ec84ed4a5240c879de2a",
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json":
    "96c789ebbf18db6dd7b64d4ab71dd8a9bd81f4f3919f509af01708cd5478473c",
  "workers/infrastructure/route-iq-private-forward-rollback-candidate-v3.json":
    "40e2913bb23d6a585fd7cd6e9d7ee1de0b9741ba7cdb20b92398c90acff72611",
  "workers/infrastructure/route-iq-private-forward-rollback-wrangler-v3.json":
    "7ad3877abf9f9b94ef7100fc48cfd8c1dfaa3a5f1401e493ae362862c856d7d0"
});

const v2GuardConvergenceRepairHashes = Object.freeze({
  "docs/cloudflare-unattended-deployment-access-v1.md":
    "123d54252e2c1b23f6ca873e06c4eeef251e84e44a84fd22028998b54b4faa4a",
  "scripts/build-route-iq-private-forward-rollback-candidate-v3.mjs":
    "f046207cc7693b22d82995d1d135b02b47c6551c68335bb328b3b553c1f763b2",
  "scripts/lib/github-actions-private-worker-deployment.mjs":
    "0d02eb7d189ad170c8b6e7c7472b7e61a9bdc6ea6d53f4db98d79d13a41c3e5a",
  "scripts/lib/github-actions-private-worker-workflow-v2.mjs":
    "7604960c354a6faec57f945ca9c73be8cb6c3f0341bab111ccebe0c7635c8101",
  "scripts/run-cloudflare-unattended-smoke.mjs":
    "03f1b672b1f5335cd8cd79d4b16d0411bcde36c02bc5d6e21b58b110bf4211e1",
  "scripts/verify-cloudflare-unattended-runtime-guard.mjs":
    "5b5c3123186c112999823a5b8be85461faee8d8ccaf627ade7c9784497f407b4",
  "scripts/verify-github-actions-private-worker-workflow-v2.mjs":
    "56b8855db6be4406c366f70561fe5473cd69eeace8483512aa7393eb84297ed9",
  "tests/cloudflare-unattended-runtime-guard.test.mjs":
    "ad3391824e3eefe8a11f807f923c3833c4fc588acf5fbc7130b2eee12aa5f65a",
  "tests/github-actions-private-worker-deployment.test.mjs":
    "b5e735b02bdce3ac72d6e557704236cb366c068727792ef6b9d9617799586eb7",
  "tests/github-actions-private-worker-workflow-v2.test.mjs":
    "559f20b40451f791c5589acd9b71dc471b262615dde16037b23940245aef998b",
  "tests/route-iq-private-forward-rollback-candidate-v3.test.mjs":
    "c17531d64d3b12f72fcbac00b088cc1c847dec58e55dd9b602a4f09f45141b2c",
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json":
    "e849d2e9cdb800d0c123da7726d9077242a1bba4f8c15be3d55384725604ca7e",
  "workers/infrastructure/route-iq-private-forward-rollback-candidate-v3.json":
    "504960881c441720b8db6734ccefca7e1b38b953d355cb78fff92649cb54988c",
  "workers/infrastructure/route-iq-private-forward-rollback-wrangler-v3.json":
    "dbcb4a6991035968b8a46bb83f69a64d1a7ac99edb113b43f1907cd37e855760",
  "wrangler.jsonc":
    "09c6c9c9a2591540eed92342d1c4ce18504cf49653054c17f4bd343f3425b884"
});

const v2ForwardPayloadPinCorrectionHashes = Object.freeze({
  "scripts/lib/github-actions-private-worker-workflow-v2.mjs":
    "8a7e758a38e1fe3be390836cce305f58dc23be90d489d6ccf9a7aaafae8e4f2b",
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json":
    "3ac1629e195fe1451c2e5c8df656ea245d5ca12e2847860ceb74c76839c95ece"
});

const v2UnconditionalGuardRoutingHashes = Object.freeze({
  "docs/cloudflare-unattended-deployment-access-v1.md":
    "0b8ebfe210c53bbd2510ceecb6de95fa3e264c937ed23a5b2f37b48afececc4a",
  "scripts/build-route-iq-private-forward-rollback-candidate-v3.mjs":
    "3ce36dd738518630c8b00768f8685aee647458274165e50b0b5196cf0667c331",
  "scripts/lib/github-actions-private-worker-deployment.mjs":
    "e71bdff256e2d705a3848a8e2fbe1855508416628a18956429026c5bb0ab18ad",
  "scripts/lib/github-actions-private-worker-workflow-v2.mjs":
    "f8e306e3bc16116e23ff284ce3acb0b72e6d40b7c3de97b5709586e35f2555a5",
  "scripts/run-cloudflare-unattended-smoke.mjs":
    "5c37584178d5881b3faff357c28be7a3c7c1117e7c543d7642ccd3ab87015708",
  "scripts/verify-cloudflare-unattended-runtime-guard.mjs":
    "ea4934d6c99f1a6adfc6a2c0e8685b9f51951f35a95df6f1fce7fff5275c3c25",
  "scripts/verify-github-actions-private-worker-workflow-v2.mjs":
    "9eb04cfb598fbed394e4a18b8cd1e00762347a06514de147b7fde7428e5316ea",
  "tests/cloudflare-unattended-runtime-guard.test.mjs":
    "b48655fc9bc9b6b7f8f4b19cbc7dcce8ce3e442fffa3e10b5d804ec3ca1754dd",
  "tests/github-actions-private-worker-deployment.test.mjs":
    "8daa65bda64c925437c8d879860dbd8de6f440e40affe6030d2b2d6197e143fb",
  "tests/github-actions-private-worker-workflow-v2.test.mjs":
    "5cb72feff58106937704e7604a93b5bfd551e20efa6b844eb1370c8c0000da56",
  "tests/route-iq-private-forward-rollback-candidate-v3.test.mjs":
    "5fdcfba5d959b128d66da94202dfb4357e7ddd84d3bdd5aa727c39c9d17b5d8b",
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json":
    "ccb56b24652009b7a673fc56bda4b5d1b3bba89550a34db6c894fb715edda20b",
  "workers/infrastructure/route-iq-private-forward-rollback-candidate-v3.json":
    "51c5d93945c891b388bba2de57e5df7d382c9ef6bfd5b96680fe6c66621c10e1",
  "workers/infrastructure/route-iq-private-forward-rollback-wrangler-v3.json":
    "23b6c5c5d506ea88565c428b1adbe0e068de14250126b4e1f53d4d10fd0b827e",
  "wrangler.jsonc":
    "b888732c12aa34d07f538d7ae112b6eb3f966c75d24839bac76d4e8ea6b9a835"
});

const v2PaidCustomerAcceptanceHashes = Object.freeze({
  "_headers":
    "acb5b88a4b10b30a19e9baeecd4ce98e283ce6648b5a8e02338d95dedfd806c3",
  "deploy/cloudflare-pages/_headers":
    "acb5b88a4b10b30a19e9baeecd4ce98e283ce6648b5a8e02338d95dedfd806c3",
  "deploy/cloudflare-pages/index.html":
    "f15389cba2412dac883eeb19f355939983f15aca1d5ef6e38f333ad85d4f2fe4",
  "index.html":
    "f15389cba2412dac883eeb19f355939983f15aca1d5ef6e38f333ad85d4f2fe4",
  "scripts/lib/github-actions-private-worker-workflow-v2.mjs":
    "04fe1e62308d3fb8712052f3b6f8b1215b5d29e1c7bf85ae5607ecd7a8a3641f",
  "scripts/refresh-route-iq-private-dashboard-csp.mjs":
    "e9bfaf4bd0a236560413dc58d21615f7ef98bbe43854727ee9048fbda9dc3499",
  "scripts/run-github-actions-private-worker-deployment-v2.mjs":
    "dfd20bbfbb17f71dd0711167828c3ea1b22d5ffea2a323572d9d426ba970627d",
  "scripts/verify-dashboard-runtime-pool-consumption.mjs":
    "ab59013d46e02c361227269b280eeb3c0cbbba282d5ca11ea3ac8685d75ae78c",
  "scripts/verify-github-actions-private-worker-workflow-v2.mjs":
    "09c1f9971916dfbd539e195151d0267fb4df46992b77dc6762f31f2ec56f46b6",
  "scripts/verify-route-iq-private-paid-customer-production-browser-acceptance.mjs":
    "ed271e3ca5e04b8c696bcd200514bb103e7e6b8b05faa534da5d1af2ee3cd0eb",
  "tests/route-iq-paid-customer-infrastructure-browser-acceptance.test.mjs":
    "89f69b4598dbb656b2eec415bc474061ed15d5b841a7cbfe88da06ba14aac1cf",
  "tests/route-iq-paid-customer-infrastructure-csp.test.mjs":
    "c7fe39491bdfd217a44bcf388368738e762cddd3416bb3c44b44f293661df46a",
  "tests/route-iq-paid-customer-infrastructure-dashboard-preview.test.mjs":
    "15df723a9748d5389cf7a5ffdcc00fb2b9731bcc791c65049e36875a018283f5",
  "tests/route-iq-paid-customer-infrastructure.test.mjs":
    "d6fa41e57efb5c07554663a3e0990dca9c4f4eacf873247f3458b47de625deb8",
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json":
    "1fa01a2d9127cc276dc1d5ecef323ef897c06cb9de56623ce08f49ad1e09cdd6",
  "workers/infrastructure/route-iq-paid-customer-dashboard-preview-runtime.js":
    "93867482c6c084579839195cec88523a6e64371da584cc1a2f4ba3779cbbfb3c",
  "workers/infrastructure/route-iq-paid-customer-onboarding-forward-rollback-v1.json":
    "eb3666911fd0b6646e48a045229ee39b1b4756a1130e46a00ddc28ed550c3f19",
  "workers/infrastructure/route-iq-paid-customer-onboarding-runtime-v1.json":
    "d6244a1fa4de28fb31877cac6be1c4a889fd7bace3d2c4d8e1af812da520cc7d",
  "workers/infrastructure/route-iq-paid-customer-onboarding-runtime.js":
    "08520b40853759cbe6365e3b32bb3fe4cb1bfe1cbf404558b180ba02edb00ba8",
  "workers/infrastructure/route-iq-paid-customer-private-browser-acceptance-v1.json":
    "bb310130b0833ca40c49442dc1d1aecdf8ca752d72dd5ad69191a5f083e7a70b",
  "workers/infrastructure/route-iq-paid-customer-server-authority.js":
    "3785deadd067bfbbfb3c88465b75b114b5d60587214c5f3e4e962daa14eab0be",
  "workers/prometheus-iq-worker.js":
    "58d52967de329daa034751c1cf95ad1ae3da8a853c5cceeb950f0656ed51e2c8"
});

const v2BrowserAcceptanceRepairHashes = Object.freeze({
  "scripts/lib/github-actions-private-worker-workflow-v2.mjs":
    "0060230c51d522f60c9fe74416e0fac7485ddb4d2b0de0ebd2b27e1c78fb310b",
  "scripts/verify-route-iq-private-paid-customer-production-browser-acceptance.mjs":
    "7c2d1f88514f12328a6cf7e34bd4e722b5c8216cb5ad2e1bd4c661f7ec644840",
  "tests/github-actions-private-worker-workflow-v2.test.mjs":
    "4e65f661605cdccfd62062ef56e1ecc20d3f61516777dc7e865e08cbe795e028",
  "tests/route-iq-paid-customer-infrastructure-browser-acceptance.test.mjs":
    "ef4a30917c249b72b9542f86a0e2a5f0743a53bb3d351fc7a645a178bc75a3b2"
});

const v2SmokeSequencingRepairHashes = Object.freeze({
  "scripts/run-cloudflare-unattended-smoke.mjs":
    "0a9b6c06af714e4671a9bff1f279113de19addd150b032258cef4171bf72c0b4",
  "scripts/verify-github-actions-private-worker-workflow-v2.mjs":
    "81c1d4552be75907c642c1793c23f295e583e31e02f73469065b04c60a95b3b8",
  "tests/cloudflare-unattended-runtime-guard.test.mjs":
    "3a264aabc33655a852d95db5ee6b328554d4c1049433cd620ccaf19544c89314",
  "tests/github-actions-private-worker-workflow-v2.test.mjs":
    "7e015c3429802a918b306ca94f704e5cd3a8ef94972294f5fe4606010da4f022",
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json":
    "2cd10bd6a6e1c126073309dc6cf3a39d2d96b3716c2c5a3868b298b823b9d192"
});

const v2ProbePropagationRepairHashes = Object.freeze({
  "scripts/run-cloudflare-unattended-smoke.mjs":
    "b10c32c8b76188ee8b4ee2fc059ebb13f2760b74845c20ad1c2d3d99c54f9d97",
  "scripts/verify-github-actions-private-worker-workflow-v2.mjs":
    "0f41c326c0bc9d82975d0edff3bb4783aef60f90a8797d9a4a02e82169138ba3",
  "tests/cloudflare-unattended-runtime-guard.test.mjs":
    "dad08a93fb0c9a62f50a30dc4890e9afa53ed9495b6fdb3a1eab8810487ab462",
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json":
    "6c3de9e73983aa7dd15781c19449a4add62b3b063cd36276aa6ac90d1b8bf845"
});

const v2BrowserHealthDiagnosticsRepairHashes = Object.freeze({
  "scripts/verify-github-actions-private-worker-workflow-v2.mjs":
    "cae7e1eb5dbb72b10873bad0e0ededc709450ad48c5470ac77e1a4f4f0f816ba",
  "scripts/verify-route-iq-private-paid-customer-production-browser-acceptance.mjs":
    "3e883c6a3625a0784c77956940f1d699d1cd47f76803d3383e990c53c344c02b",
  "tests/github-actions-private-worker-workflow-v2.test.mjs":
    "e8be20975c181bdee2d71bff2944a0c27b2de0837c10cacef7378b4954bb4fc0",
  "tests/route-iq-paid-customer-infrastructure-browser-acceptance.test.mjs":
    "011922fe023b6df44568c87c8b414c981b92e67a229a38997ee0a772771c270e",
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json":
    "93e760cf82e389a9ced61ea9df7031924805600a76abc54da92fe7dc8c4bd470"
});

const v2BrowserAcceptanceEvidenceRepairHashes = Object.freeze({
  "scripts/lib/github-actions-private-worker-workflow-v2.mjs":
    "f93ce0fe38ea752b3785178aedcb27c1c5f16d7175238bdbed0bbaf8dd852fd6",
  "scripts/verify-github-actions-private-worker-workflow-v2.mjs":
    "354d5e3988dc077d369bced2f7354d1a1c093310f85a45adfb18beac710d46f9",
  "scripts/verify-route-iq-private-paid-customer-production-browser-acceptance.mjs":
    "a17ee007193be9ae932c6fe0896594a96855a3b7973b0effa7ce52cab44e2762",
  "tests/github-actions-private-worker-workflow-v2.test.mjs":
    "eca5a8e5d37c4e98a51b14777e191a1bb6dccf6571724fcdb3156ea7913c680d",
  "tests/route-iq-paid-customer-infrastructure-browser-acceptance.test.mjs":
    "3ce4a163bef9fb901ca5c8e76e76fdfcf762837bd6690c636877d83b07cf09c8",
  "workers/infrastructure/github-actions-private-worker-deployment-v2.json":
    "af6050b0f3d82f3df6ffc7f50b89a404fc26073db192ef757732b41423f9eab8",
  "workers/infrastructure/route-iq-paid-customer-private-browser-acceptance-v1.json":
    "99ff838b3430e1160cf40e06f38cd18c9caf65936e90a8792b4f0fac1356d843"
});

const v2ServiceWorkerGuardRepairHashes = Object.freeze({
  "scripts/verify-route-iq-private-paid-customer-production-browser-acceptance.mjs":
    "85cdf335cc0618d8bc34758799333817fa884ab0e952e42d8a8732047be963bb",
  "tests/route-iq-paid-customer-infrastructure-browser-acceptance.test.mjs":
    "318468b12e0c01106e6726f58db0b4447a3c5ea39e72024fbfdc49cb5ecf3060"
});

const v2HttpPathDiagnosticsRepairHashes = Object.freeze({
  "scripts/verify-route-iq-private-paid-customer-production-browser-acceptance.mjs":
    "4a77896bb238758e68e7f52f0e1406215eb8aadfac460d487fc1734805005d1c",
  "tests/github-actions-private-worker-workflow-v2.test.mjs":
    "c63a4c5f16e457641323ed4c44dea04a369b694fc02bf6e0593bbc8b4f70e83f",
  "tests/route-iq-paid-customer-infrastructure-browser-acceptance.test.mjs":
    "4437e9ad5bbee2814fd0b16b426c645e3f4592b89c57d57a552abb5dad60a6e2",
  "workers/infrastructure/route-iq-paid-customer-private-browser-acceptance-v1.json":
    "b7bcf24619d3c9568a3e12b39cbd7d59bf429a118ceb52891b15aa222563b483"
});

const v2BrowserManagedIconRepairHashes = Object.freeze({
  "scripts/verify-route-iq-private-paid-customer-production-browser-acceptance.mjs":
    "adb18bafb36e898a9b8b2d0b8a743152af014918723ef7265ffb52115835cb94",
  "tests/route-iq-paid-customer-infrastructure-browser-acceptance.test.mjs":
    "e917d2dce5170bef1de0d72469721998080011e65ddbcc93410a4ffbb61833c8",
  "workers/infrastructure/route-iq-paid-customer-private-browser-acceptance-v1.json":
    "4aec5c75a5cd919259fc80ed53d1242490720841b93c0e8da28a278480ff4ed9"
});

const v2BrowserManagedIconSecretScanRepairHashes = Object.freeze({
  "scripts/verify-route-iq-private-paid-customer-production-browser-acceptance.mjs":
    "1facbb76ab68103887db17bcc377df4351d643dd0aeced5c72b5b728a012c3aa",
  "tests/route-iq-paid-customer-infrastructure-browser-acceptance.test.mjs":
    "f4d9a20f952b088fa726f3d0d25e321448ad30dc13bb39b75285500b62237ee0"
});

const v2BrowserSmokeMarkerPropagationRepairHashes = Object.freeze({
  "scripts/verify-route-iq-private-paid-customer-production-browser-acceptance.mjs":
    "69825fcdb68536d27396176e04a9f0ea22a125f2ca8b6b3333c9373a3c838c4d",
  "tests/route-iq-paid-customer-infrastructure-browser-acceptance.test.mjs":
    "300e1a8569725ab1dc092ff4631e1069b3822f6d513365da78a0c16f42a7335d",
  "workers/infrastructure/route-iq-paid-customer-private-browser-acceptance-v1.json":
    "8eb2b3fc853383e0c323721e959eafba0547a296965921093396ebf3f50d9a76"
});

const historicalOwnerHashes = Object.freeze({
  ".github/workflows/deploy-prometheus-private-worker.yml":
    "f2e672729d9bee7a4a173627e51a622b944d3b545e4ed1f4851414b5e31897e9",
  "docs/github-actions-founder-triggered-private-worker-deployment-v1.md":
    "953a40927a416b7076bdbce700048ed886b2e7b8b60d85a8770227143aba511d",
  "scripts/lib/github-actions-private-worker-deployment.mjs":
    "eb105f0e9d96937b2faa9fe3250d150e1fa21c65f4469fd900d0944f822237d9",
  "scripts/run-github-actions-private-worker-deployment.mjs":
    "4c3fac8b30031e44b9b5e5b0ee12b1f9928098f3cc539f29f83af17fd714284e",
  "scripts/verify-github-actions-private-worker-deployment.mjs":
    "07abb337aacd83cbd0d9f14ad7494da74b7978f9b80293829e342d87979bca62",
  "tests/github-actions-private-worker-deployment.test.mjs":
    "07ddb19cb186420c4849f9750db80e20c40be65f0dd92824a84c09c32b909e24",
  "workers/infrastructure/github-actions-founder-triggered-private-worker-deployment-v1.json":
    "f5488db21c5a9c8eee10c44f80a8a05e2d5fd47ca10a47db3d243dc9a934e5ce"
});

const compatibilityOwnerHashes = Object.freeze({
  ".github/workflows/deploy-prometheus-private-worker.yml":
    "0b9a8afd7d34b5d28aeec563e35ece4b5516cf154e5e01aa70e740183745b46a",
  "docs/github-actions-founder-triggered-private-worker-deployment-v1.md":
    "77f5dd3b94393ae8ee7b8bb0c3c762ed7aa3c98c92acb1c0c85a3e94006a8b53",
  "scripts/lib/github-actions-private-worker-deployment.mjs":
    "e71bdff256e2d705a3848a8e2fbe1855508416628a18956429026c5bb0ab18ad",
  "scripts/run-github-actions-private-worker-deployment.mjs":
    "4c3fac8b30031e44b9b5e5b0ee12b1f9928098f3cc539f29f83af17fd714284e",
  "scripts/verify-github-actions-private-worker-deployment.mjs":
    "aa910f195cd836866b7ccb07290880bc762f3461b65a91234d275d72502fee63",
  "tests/github-actions-private-worker-deployment.test.mjs":
    "8daa65bda64c925437c8d879860dbd8de6f440e40affe6030d2b2d6197e143fb",
  "workers/infrastructure/github-actions-founder-triggered-private-worker-deployment-v1.json":
    "95d8d50e7ac4c9abacbac879d49bbaa3799988bb886d8ad92a98c6fe415efd6c"
});

const compatibilityChangedPaths = Object.freeze([
  ".github/workflows/deploy-prometheus-private-worker.yml",
  "docs/github-actions-founder-triggered-private-worker-deployment-v1.md",
  "scripts/lib/github-actions-private-worker-deployment.mjs",
  "scripts/verify-github-actions-private-worker-deployment.mjs",
  "tests/github-actions-private-worker-deployment.test.mjs",
  "workers/infrastructure/github-actions-founder-triggered-private-worker-deployment-v1.json"
]);

const protectedOverwatchVerifierSuccessors = Object.freeze([
  {
    path: "scripts/verify-overwatch-cloudflare-unattended-access.mjs",
    previousSha256: "6365219622cd6aebb4db6bfee5d8c76a5250fef7b3f735a5f1974bd0d94d635b",
    successorSha256: "bdec71cc16497e842264419e81c13dfd865c94c1a200138912208ad6e01f9e30",
    owner: "Prometheus Overwatch",
    reason: "Carry the original unattended-access package evidence through the Founder-triggered private Worker deployment release successor."
  },
  {
    path: "scripts/verify-overwatch-cloudflare-founder-attended-service-token.mjs",
    previousSha256: "2790795f724fe7d5c251cac45605e922372c4cec2f6b924e9dd11d218ad189f0",
    successorSha256: "147000b8f5cf5962f6e65a1378f6051bff8ca62212d4a0187d3eb013a14494ed",
    owner: "Prometheus Overwatch",
    reason: "Extend the protected package successor chain through the Founder-triggered private Worker deployment release wiring."
  },
  {
    path: "scripts/verify-overwatch-cloudflare-founder-attended-tty-compatibility.mjs",
    previousSha256: "e7b0c8f9072ed353ffbc912ddc6476c4db33e6d18b097e257627e1b3d030083c",
    successorSha256: "05ec07c66ea10ee5fa7200829e6e981e73c1a43e56276239e8f0e15784c76e12",
    owner: "Prometheus Overwatch",
    reason: "Extend the protected package successor chain through the Founder-triggered private Worker deployment release wiring."
  },
  {
    path: "scripts/verify-overwatch-cloudflare-founder-attended-get-only-recovery.mjs",
    previousSha256: "886a51d70c9ac5df6b30741a740f7f23b0f7a51220a52e596d93802d04f8aa1e",
    successorSha256: "e6312d6d89d4d51e8adcd5a87cfcabad46d2d7396842ea76b19521c55201c0de",
    owner: "Prometheus Overwatch",
    reason: "Extend the protected package successor chain through the Founder-triggered private Worker deployment release wiring."
  },
  {
    path: "scripts/verify-overwatch-cloudflare-founder-attended-response-contract-repair.mjs",
    previousSha256: "5b7593db044d5386d77975b81efe5691e514182fd147e5173abc49d7b8371aad",
    successorSha256: "57c46419ca3abeb4918acecac922043b4396acb660dc3d36ee05f19c5fc4269a",
    owner: "Prometheus Overwatch",
    reason: "Accept the cryptographically mapped GitHub deployment verifier successor without weakening prior response-contract checks."
  },
  {
    path: "scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs",
    previousSha256: "707644d0e0f89a02df6fa74ec3c1ad40f27272828b0dd9961c3d934ad5554518",
    successorSha256: "c7b01976f1d8564d8ec99657ff4d6df0a17c6418018afb1704bed2d8dc4ade81",
    owner: "Prometheus Overwatch",
    reason: "Accept the cryptographically mapped GitHub deployment verifier successor without weakening prior create-receipt checks."
  },
  {
    path: "scripts/verify-overwatch-cloudflare-unattended-keychain-interoperability.mjs",
    previousSha256: "ea9e5a53a4f6277087a01f3c5b2e688e33540a451248fc20f8a412cfc44dac51",
    successorSha256: "112531804f528d573065d5f6530bb845c8eed9d19ad0c198c4e80844903a94c0",
    owner: "Prometheus Overwatch",
    reason: "Recognize the two Infrastructure-owned deployment commits and exclude their files from the prior Overwatch ownership audit."
  }
]);
const protectedVerificationAssetSuccessors = Object.freeze([
  {
    path: "tests/cross-subsystem-artifact-contracts.test.mjs",
    previousSha256: "1c6a985c1d1c4933c7ee6df2d104164a5fc3645507111490ecbfea3ba41872a9",
    successorSha256: "688a21de1aecd5ef6b538200d2c828ba4e96027807c0fbb9b9adc7272b2c9e06",
    owner: "Prometheus Overwatch",
    reason: "Register the new canonical Overwatch governance artifact in the existing registry contract test."
  }
]);

const expectedOverwatchPaths = Object.freeze([
  governancePath,
  governanceDocumentationPath,
  governanceV2Path,
  governanceV2DocumentationPath,
  registryPath,
  compatibilityReportPath,
  "scripts/verify-overwatch-cloudflare-unattended-keychain-interoperability.mjs",
  "scripts/verify-overwatch-github-actions-private-worker-deployment.mjs",
  "tests/overwatch-github-actions-private-worker-deployment.test.mjs"
]);

const infrastructureIdentity =
  "Prometheus Infrastructure <infrastructure@prometheus.local>";
const overwatchIdentity = "Prometheus Overwatch <overwatch@prometheus.local>";
const infrastructureOwnedPaths = new Set([
  ...Object.keys(historicalOwnerHashes),
  ...Object.keys(compatibilityOwnerHashes),
  ...Object.keys(v2OwnerHashes),
  ...Object.keys(v2BootstrapRepairHashes),
  ...Object.keys(v2RunnerWorkspaceRepairHashes),
  ...Object.keys(v2TrustedTempAliasRepairHashes),
  ...Object.keys(v2WranglerScratchIsolationHashes),
  ...Object.keys(v2Node24CleanupRepairHashes),
  ...Object.keys(v2CanonicalSmokeRepairHashes),
  ...Object.keys(v2PublicBundlePreservationHashes),
  ...Object.keys(v2CanonicalClientIsolationHashes),
  ...Object.keys(v2PayloadContinuityHashes),
  ...Object.keys(v2ReleasePropagationRepairHashes),
  ...Object.keys(v2BrowserHealthDiagnosticsRepairHashes)
]);
const overwatchOwnedPaths = new Set([
  ...expectedOverwatchPaths,
  ...protectedOverwatchVerifierSuccessors.map(item => item.path),
  ...protectedVerificationAssetSuccessors.map(item => item.path)
]);

function protectedPathOwner(path) {
  if (infrastructureOwnedPaths.has(path)) return infrastructureIdentity;
  if (overwatchOwnedPaths.has(path)) return overwatchIdentity;
  if (/^overwatch\/(?:governance|reports)\/.*github-actions-founder-triggered/u.test(path)
    || /^scripts\/verify-overwatch-github-actions-private-worker/u.test(path)
    || /^tests\/overwatch-github-actions-private-worker/u.test(path)) {
    return overwatchIdentity;
  }
  if (/^(?:\.github\/workflows|docs|scripts|tests|workers\/infrastructure)\/.*github-actions-(?:founder-triggered-)?private-worker/u
    .test(path)) {
    return infrastructureIdentity;
  }
  return null;
}

export function evaluateGithubActionsPrivateWorkerSuccessorOwnership(commits) {
  const failures = [];
  for (const commit of commits) {
    const protectedOwners = new Set(
      commit.paths.map(protectedPathOwner).filter(Boolean)
    );
    if (protectedOwners.size === 0) continue;
    if (protectedOwners.size !== 1) {
      failures.push(`Cross-owner protected successor detected: ${commit.commit}`);
      continue;
    }
    const expectedIdentity = [...protectedOwners][0];
    if (commit.author !== expectedIdentity || commit.committer !== expectedIdentity) {
      failures.push(`Protected successor ownership drifted: ${commit.commit}`);
    }
  }
  return Object.freeze({
    ok: failures.length === 0,
    failures: Object.freeze(failures)
  });
}

const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const equal = (left, right) => isDeepStrictEqual(left, right);
const git = args => execFileSync("/usr/bin/git", args, {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"]
}).trim();

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex === -1 || endIndex === -1) return "";
  return source.slice(startIndex, endIndex);
}

function evidenceMap(hashes) {
  return Object.entries(hashes).map(([path, hash]) => ({ path, sha256: hash }));
}

export function evaluateGithubActionsPrivateWorkerWorkflow(workflow) {
  const failures = [];
  const require = (condition, message) => {
    if (!condition) failures.push(message);
  };
  const trigger = section(workflow, "on:\n", "permissions:\n");
  const permissions = section(workflow, "permissions:\n", "concurrency:\n");
  const verification = section(workflow, "  verification:\n", "  deploy:\n");
  const deployIndex = workflow.indexOf("  deploy:\n");
  const deploy = deployIndex === -1 ? "" : workflow.slice(deployIndex);

  require(/^name: Deploy Prometheus Private Worker$/mu.test(workflow),
    "Workflow name drifted.");
  require(equal(
    [...trigger.matchAll(/^  ([a-z_]+):$/gmu)].map(match => match[1]),
    ["workflow_dispatch"]
  ), "Workflow is not manual dispatch only.");
  require(!/(?:push|pull_request|pull_request_target|schedule|workflow_call|workflow_run|repository_dispatch):/u
    .test(trigger), "An automatic or delegated trigger is present.");
  const inputNames = [...trigger.matchAll(/^      ([a-z_]+):$/gmu)]
    .map(match => match[1]);
  require(equal(inputNames, [
    "approved_commit",
    "approved_tree",
    "batch_id",
    "current_production_version",
    "founder_authorization"
  ]), "Founder input set drifted.");
  require(count(trigger, /^        required: true$/gmu) === 5
    && count(trigger, /^        type: string$/gmu) === 5,
  "Founder inputs are not five required strings.");
  require(trigger.includes(`description: Type exactly ${founderAuthorization}`),
    "Exact Founder authorization instruction drifted.");
  require(permissions.trim() === "permissions:\n  contents: read",
    "GitHub permissions are not read-only.");
  require(/concurrency:\n  group: deploy-prometheus-private-worker\n  cancel-in-progress: false/u
    .test(workflow), "Deployment concurrency boundary drifted.");

  for (const predicate of [
    "github.event_name == 'workflow_dispatch'",
    "github.repository == 'PrometheusRouteIQ/prometheus-iq'",
    "github.actor == 'PrometheusRouteIQ'",
    "github.triggering_actor == 'PrometheusRouteIQ'",
    "github.ref == 'refs/heads/main'",
    "github.ref_name == 'main'",
    "github.ref_type == 'branch'",
    "github.workflow == 'Deploy Prometheus Private Worker'",
    "github.workflow_ref == 'PrometheusRouteIQ/prometheus-iq/.github/workflows/deploy-prometheus-private-worker.yml@refs/heads/main'",
    "github.run_attempt == 1",
    `inputs.founder_authorization == '${founderAuthorization}'`
  ]) require(verification.includes(predicate), `Secret-free preflight is missing ${predicate}.`);

  require(!/\$\{\{\s*secrets\./u.test(verification)
    && !/environment:/u.test(verification),
  "Secret-free preflight receives environment authority.");
  require(count(workflow,
    /^          PROMETHEUS_FOUNDER_AUTHORIZATION: \$\{\{ inputs\.founder_authorization \}\}$/gmu) === 4
    && count(workflow,
      /^          PROMETHEUS_DISPATCH_INPUTS_JSON: \$\{\{ toJSON\(github\.event\.inputs\) \}\}$/gmu) === 4,
  "Founder authorization is not revalidated at every controller boundary.");
  require(/needs: verification/u.test(deploy)
    && /if: \$\{\{ needs\.verification\.result == 'success' \}\}/u.test(deploy),
  "Environment-backed deployment does not require successful preflight.");
  require(/environment:\n      name: prometheus-private-worker-production/u.test(deploy),
    "Protected deployment environment drifted.");

  const actions = [...workflow.matchAll(/^\s*uses:\s*(\S+)$/gmu)]
    .map(match => match[1]);
  require(equal(actions, [
    "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
    "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
    "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
    "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020"
  ]), "Pinned action set drifted.");
  require(count(workflow, /^          repository: PrometheusRouteIQ\/prometheus-iq$/gmu) === 2
    && count(workflow, /^          ref: main$/gmu) === 2
    && count(workflow, /^          fetch-depth: 0$/gmu) === 2
    && count(workflow, /^          persist-credentials: false$/gmu) === 2,
  "Checkout identity or credential boundary drifted.");
  require(!/^\s+(?:cache|cache-dependency-path|package-manager-cache):/mu.test(workflow)
    && !/actions\/(?:cache|upload-artifact|download-artifact)@/u.test(workflow),
  "Workflow may persist dependencies or artifacts.");

  for (const command of [
    "npm ci",
    "npm test",
    "npm run lint",
    "npm run typecheck",
    "npm run security:check",
    "node scripts/check-cloudflare-unattended-secret-presence.mjs --source=environment",
    "npm run security:aegis:verify",
    "node scripts/verify-cross-subsystem-artifact-contracts.mjs",
    "node scripts/verify-github-actions-private-worker-deployment.mjs",
    "node --test tests/github-actions-private-worker-deployment.test.mjs",
    "npm run build",
    "git diff --exit-code",
    "git diff --cached --exit-code",
    "git status --porcelain=v1 --untracked-files=all",
    "git fsck --full --strict"
  ]) require(verification.includes(command), `Verification job is missing ${command}.`);

  require(count(deploy,
    /run: node scripts\/run-github-actions-private-worker-deployment\.mjs verify/gmu) === 2,
  "Deploy job exact-version checks drifted.");
  require(count(deploy,
    /run: timeout 120s node scripts\/run-cloudflare-unattended-smoke\.mjs --execute-fixed-profile/gmu) === 2,
  "Guarded pre/post smoke boundary drifted.");
  require(count(deploy,
    /run: node scripts\/run-github-actions-private-worker-deployment\.mjs deploy/gmu) === 1,
  "Deployment attempt count drifted.");
  require(!/prometheusrouteiq-website/u.test(workflow)
    && !/wrangler(?:\.js)?\s+deploy/u.test(workflow),
  "Workflow exposes a public target or direct Wrangler path.");

  const secrets = [...workflow.matchAll(/\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/gu)]
    .map(match => match[1]);
  require(equal(secrets, [
    "CLOUDFLARE_ACCESS_CLIENT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_SECRET",
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_SECRET"
  ]), "Protected environment value references drifted.");

  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

export function evaluateGithubActionsPrivateWorkerDeploymentGovernance({
  governance,
  report,
  contract
}) {
  const failures = [];
  const require = (condition, message) => {
    if (!condition) failures.push(message);
  };
  const successor = governance.compatibilitySuccessor;

  require(governance.governanceId ===
    "github-actions-founder-triggered-private-worker-deployment-governance-v1"
    && governance.version === "1.1.0"
    && governance.batchId === "BATCH-20260715-010"
    && governance.owningSubsystem === "Prometheus Overwatch",
  "Canonical governance identity drifted.");
  require(governance.dispatchAudit.implementationOwner === "Prometheus Infrastructure"
    && governance.dispatchAudit.verificationOwner === "Prometheus Overwatch"
    && governance.dispatchAudit.implementationOwnershipRespected === true
    && governance.dispatchAudit.overwatchModifiedInfrastructureImplementation === false,
  "Historical dispatch ownership boundary drifted.");
  require(equal(governance.dispatchAudit.implementationCommits, [
    {
      commit: historicalOwnerCommit,
      parent: historicalReleaseBase,
      tree: historicalOwnerTree,
      subject: "infrastructure: add Founder-triggered private worker deployment"
    },
    {
      commit: historicalOwnerRepairCommit,
      parent: historicalOwnerCommit,
      tree: historicalOwnerRepairTree,
      subject: "infrastructure: repair private worker deployment invariants"
    }
  ]), "Historical implementation chain drifted.");
  require(governance.startingStateAudit.reportedLocalHead ===
    "48345d5e40d5f70ec1d1dfb4bf5eed4d337f7d23"
    && governance.startingStateAudit.reportedOriginMain === historicalReleaseBase
    && governance.startingStateAudit.reportedUncommittedDiagnosticFiles === 6
    && governance.startingStateAudit.blockedChainCommitsAhead === 7
    && governance.startingStateAudit.blockedChainCommitsBehind === 0
    && governance.startingStateAudit.diagnosticDisposition.owner ===
      "Prometheus Infrastructure"
    && governance.startingStateAudit.diagnosticDisposition.localOnly === true
    && governance.startingStateAudit.diagnosticDisposition.includedInRelease === false
    && governance.startingStateAudit.unverifiedDiagnosticWorkPushed === false
    && equal(governance.startingStateAudit.reconciledReleaseBase, {
      commit: historicalReleaseBase,
      tree: historicalReleaseBaseTree,
      branch: "main"
    }),
  "Historical starting-state audit drifted.");
  require(equal(governance.ownerEvidence, evidenceMap(historicalOwnerHashes)),
    "Historical BATCH-010 owner evidence drifted.");
  require(equal(governance.protectedPredecessorSuccessors, [{
    predecessorGovernanceId: "cloudflare-unattended-deployment-access-governance-v1",
    path: "package.json",
    historicalSha256: "a150ca1b1121c779415365551efdbff970e458915ba6491716ccbfdd0a111d0d",
    successorSha256: "4495e53724179fc0520beae1dc4b865fda003e1f2ec7472bc9d5aa4f88b50a2e",
    successorOwner: "Prometheus Overwatch",
    reason: "Carry the original unattended-access package baseline through the manual GitHub deployment release-gate successor."
  }]) && equal(governance.protectedReleaseWiringTransitions, [{
    path: "package.json",
    previousSha256: "20ef38b1eb8a04119362e72338329ddfa0c3d2b2272a4b9526a65d8a5c01061d",
    successorSha256: "4495e53724179fc0520beae1dc4b865fda003e1f2ec7472bc9d5aa4f88b50a2e",
    owner: "Prometheus Overwatch",
    reason: "Register the Infrastructure owner gate and independent Overwatch GitHub private Worker deployment gate in the complete repository suite."
  }]), "Historical package successor mapping drifted.");
  require(equal(governance.protectedOverwatchVerifierSuccessors,
    protectedOverwatchVerifierSuccessors)
    && equal(governance.protectedVerificationAssetSuccessors,
      protectedVerificationAssetSuccessors),
  "Historical protected verifier successor mapping drifted.");
  require(successor?.batchId === "BATCH-20260715-011"
    && successor.directive ===
      "GitHub Private-Repository Founder Deployment Authorization Compatibility v1"
    && successor.implementationOwner === "Prometheus Infrastructure"
    && successor.verificationOwner === "Prometheus Overwatch"
    && successor.implementationOwnershipRespected === true
    && successor.overwatchModifiedInfrastructureImplementation === false,
  "Compatibility dispatch ownership drifted.");
  require(equal(successor?.implementationCommit, {
    commit: compatibilityOwnerCommit,
    parent: compatibilityParent,
    tree: compatibilityOwnerTree,
    subject: "infrastructure: require Founder-authenticated deployment dispatch"
  }), "Compatibility owner commit mapping drifted.");
  require(equal(successor?.changedPaths, compatibilityChangedPaths)
    && equal(successor?.ownerEvidence, evidenceMap(compatibilityOwnerHashes)),
  "Compatibility owner evidence drifted.");
  require(successor?.authorizationModel?.privateRepositoryRequiredReviewerAvailable === false
    && successor.authorizationModel.actor === founderActor
    && successor.authorizationModel.triggeringActor === founderActor
    && successor.authorizationModel.workflowBranch === "main"
    && successor.authorizationModel.firstRunAttemptOnly === true
    && successor.authorizationModel.rerunAllowed === false
    && successor.authorizationModel.exactAuthorizationPhrase === founderAuthorization
    && successor.authorizationModel.founderDispatchIsExplicitApproval === true
    && successor.authorizationModel.environmentMainOnlyDeploymentRuleRequired === true
    && successor.authorizationModel.secretFreePreflightRequired === true
    && successor.authorizationModel.deploymentJobRequiresSuccessfulPreflight === true,
  "Founder authorization governance drifted.");
  require(Object.values(successor?.externalActions ?? {}).every(value => value === false),
    "Compatibility batch claims an unauthorized external action.");

  require(equal(governance.workflowBoundary.requiredInputs, [
    "approved_commit",
    "approved_tree",
    "batch_id",
    "current_production_version",
    "founder_authorization"
  ]) && governance.workflowBoundary.onlyTrigger === "workflow_dispatch"
    && governance.workflowBoundary.branch === "main"
    && governance.workflowBoundary.privateWorker === "prometheus-iq"
    && governance.workflowBoundary.publicWorker === "prometheusrouteiq-website"
    && governance.workflowBoundary.publicWorkerDeploymentAllowed === false
    && governance.workflowBoundary.repository === "PrometheusRouteIQ/prometheus-iq"
    && governance.workflowBoundary.protectedEnvironment ===
      "prometheus-private-worker-production"
    && governance.workflowBoundary.environmentRequiredReviewer === false
    && governance.workflowBoundary.environmentMainOnlyDeploymentRuleRequired === true
    && governance.workflowBoundary.founderActor === founderActor
    && governance.workflowBoundary.founderTriggeringActor === founderActor
    && governance.workflowBoundary.firstRunAttemptOnly === true
    && governance.workflowBoundary.exactFounderAuthorizationPhrase === founderAuthorization
    && governance.workflowBoundary.concurrencyGroup ===
      "deploy-prometheus-private-worker"
    && governance.workflowBoundary.cancelInProgress === false
    && equal(governance.workflowBoundary.githubPermissions, { contents: "read" }),
  "Current workflow governance drifted.");
  require(governance.supplyChainBoundary.checkoutCommit ===
    "34e114876b0b11c390a56381ad16ebd13914f8d5"
    && governance.supplyChainBoundary.setupNodeCommit ===
      "49933ea5288caeca8642d1e84afbd3f7d6820020"
    && governance.supplyChainBoundary.wranglerVersion === "4.110.0"
    && governance.supplyChainBoundary.dependencyCacheInputsOmitted === true
    && governance.supplyChainBoundary.checkoutCredentialsPersisted === false
    && governance.supplyChainBoundary.artifactsOrCachesUploaded === false,
  "Supply-chain boundary drifted.");
  require(governance.secretBoundary.verificationJobReceivesSecrets === false
    && governance.secretBoundary.founderAndInputPreflightReceivesSecrets === false
    && governance.secretBoundary.deploymentJobRequiresSuccessfulPreflight === true
    && governance.secretBoundary.valuesInGitChatWorkflowLogsArtifactsScreenshotsOrReportsAllowed === false,
  "Secret boundary drifted.");
  require(equal(governance.secretBoundary.protectedEnvironmentValueNames, [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_ID",
    "CLOUDFLARE_ACCESS_CLIENT_SECRET"
  ]) && governance.secretBoundary.founderEntersValuesDirectlyInGitHub === true
    && governance.secretBoundary.deploymentCredentialsScopedToOneDeploymentStep === true
    && governance.secretBoundary.smokeCredentialsScopedToTwoFixedSmokeSteps === true,
  "Protected value scope drifted.");
  for (const field of [
    "exactCommitTreeBatchAndCurrentVersionRequired",
    "currentOriginMainMustEqualApprovedCommit",
    "cleanRepositoryAndIndexRequired",
    "gitIntegrityRequired",
    "cloudflareCurrentVersionMustMatch",
    "singleVersionAtOneHundredPercentRequired",
    "preMutationConcurrencyRecheckRequired",
    "dryRunRequired",
    "oneWranglerDeploymentAttemptMaximum",
    "keepVarsRequired",
    "strictConflictProtectionRequired",
    "publicDeploymentIdAndVersionMustRemainUnchanged",
    "fixedGuardedSmokeBeforeAndAfter"
  ]) require(governance.deploymentSafety[field] === true,
    `Deployment safety drifted: ${field}.`);
  require(governance.deploymentSafety.privateConfigFixed === "wrangler.jsonc"
    && equal(governance.deploymentSafety.smokeMethods, ["GET", "HEAD"])
    && governance.deploymentSafety.smokeWriteAttemptsAllowed === 0,
  "Fixed deployment or smoke boundary drifted.");
  require(governance.runtimeBoundary.prospectiveCollection === "OFF"
    && governance.runtimeBoundary.activeCohorts === 0
    && governance.runtimeBoundary.recommendationInfluence === "OFF"
    && governance.runtimeBoundary.deploymentPerformedByBatch === false
    && governance.runtimeBoundary.productionMutationPerformedByBatch === false
    && governance.runtimeBoundary.cloudflareRequestPerformedByBatch === false
    && governance.runtimeBoundary.accessPolicyMutationPerformedByBatch === false
    && governance.runtimeBoundary.keychainValueReadPerformedByBatch === false
    && governance.runtimeBoundary.secretEntryPerformedByBatch === false,
  "Runtime boundary drifted.");
  require(governance.manualSetupBoundary.requiredReviewerProtectionAvailable === false
    && governance.manualSetupBoundary.environmentMainOnlyDeploymentRuleRequired === true
    && governance.manualSetupBoundary.founderDispatchIdentityIsApprovalSignal === true
    && governance.manualSetupBoundary.deploymentReadyNow === false
    && governance.manualSetupBoundary.workflowSourceReady === true
    && governance.manualSetupBoundary.protectedEnvironmentConfiguredByBatch === false
    && governance.manualSetupBoundary.environmentSecretsConfiguredByBatch === false
    && governance.manualSetupBoundary.serviceAuthPolicyConfiguredByBatch === false
    && governance.manualSetupBoundary.guardRuntimeConfiguredByBatch === false,
  "Private-repository setup boundary drifted.");
  require(governance.rollback.nativeCloudflareRollbackAllowed === false
    && governance.rollback.historyRewriteAllowed === false
    && governance.rollback.isolatedExerciseRequiredBeforePush === true
    && governance.releaseBoundary.pushMayTriggerDeployment === false
    && governance.releaseBoundary.deploymentAuthorizedByThisBatch === false,
  "Release boundary drifted.");

  require(report.batchId === "BATCH-20260715-011"
    && report.dispatchAudit.implementationOwner === "Prometheus Infrastructure"
    && report.dispatchAudit.verificationOwner === "Prometheus Overwatch"
    && report.dispatchAudit.implementationCommit === compatibilityOwnerCommit
    && report.dispatchAudit.implementationOwnershipRespected === true
    && report.completed.workflowDispatchOnly === true
    && report.completed.founderActorExact === founderActor
    && report.completed.founderTriggeringActorExact === founderActor
    && report.completed.firstRunAttemptOnly === true
    && report.completed.rerunAllowed === false
    && report.completed.secretFreePreflightRequired === true
    && report.completed.environmentJobRequiresSuccessfulPreflight === true
    && report.githubPlanCompatibility.requiredReviewerProtectionAvailable === false
    && report.runtimeBoundaries.deployment === "NOT_PERFORMED_NOT_AUTHORIZED_BY_THIS_BATCH"
    && report.runtimeBoundaries.prospectiveCollection === "OFF"
    && report.runtimeBoundaries.activeCohorts === 0
    && report.runtimeBoundaries.recommendationInfluence === "OFF"
    && report.release.pushMayTriggerDeployment === false,
  "Compatibility batch report drifted.");

  require(contract.batchId === "BATCH-20260715-011"
    && contract.owner === "Prometheus Infrastructure"
    && contract.implementationStatus ===
      "PRIVATE_REPOSITORY_COMPATIBILITY_IMPLEMENTED_NOT_EXECUTED"
    && contract.deploymentPerformed === false
    && contract.productionMutationPerformed === false
    && contract.founderAuthorization.actor === founderActor
    && contract.founderAuthorization.triggeringActor === founderActor
    && contract.founderAuthorization.workflowBranch === "main"
    && contract.founderAuthorization.firstRunAttemptOnly === true
    && contract.founderAuthorization.rerunAllowed === false
    && contract.founderAuthorization.exactPhrase === founderAuthorization
    && contract.founderAuthorization.validationOccursWithoutSecrets === true
    && contract.founderAuthorization.environmentJobRequiresSuccessfulPreflight === true
    && equal(contract.founderInputs.names, governance.workflowBoundary.requiredInputs)
    && contract.runtimeBoundaries.collection === "OFF"
    && contract.runtimeBoundaries.activeCohortCount === 0
    && contract.runtimeBoundaries.recommendationInfluence === "OFF",
  "Infrastructure compatibility contract drifted.");

  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

export function evaluateGithubActionsPrivateWorkerV2Governance({
  governance,
  contract
}) {
  const failures = [];
  const require = (condition, message) => {
    if (!condition) failures.push(message);
  };
  require(governance?.governanceId ===
    "github-actions-private-worker-deployment-governance-v2",
  "Private Workflow v2 governance identity drifted.");
  require(governance?.version === "1.12.0"
    && governance?.status ===
    "SOURCE_GOVERNED_REQUALIFICATION_PENDING_NOT_DEPLOYED"
    && governance?.owningSubsystem === "Prometheus Overwatch",
  "Private Workflow v2 governance status or owner drifted.");
  require(governance?.ownership?.implementationOwner === "Prometheus Infrastructure"
    && governance?.ownership?.verificationOwner === "Prometheus Overwatch"
    && governance?.ownership?.implementationOwnershipRespected === true
    && governance?.ownership?.overwatchModifiedInfrastructureImplementation === false,
  "Private Workflow v2 ownership boundary drifted.");
  require(governance?.ownership?.implementationCommit?.commit === v2OwnerCommit
    && governance?.ownership?.implementationCommit?.parent === v2OwnerParent
    && governance?.ownership?.implementationCommit?.tree === v2OwnerTree
    && governance?.ownership?.implementationRepairCommit?.commit === v2OwnerRepairCommit
    && governance?.ownership?.implementationRepairCommit?.parent === v2OwnerCommit
    && governance?.ownership?.implementationRepairCommit?.tree === v2OwnerRepairTree
    && governance?.ownership?.implementationBootstrapRepairCommit?.commit ===
      v2BootstrapRepairCommit
    && governance?.ownership?.implementationBootstrapRepairCommit?.parent ===
      v2BootstrapRepairParent
    && governance?.ownership?.implementationBootstrapRepairCommit?.tree ===
      v2BootstrapRepairTree
    && governance?.ownership?.implementationBootstrapRepairCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationBootstrapRepairCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationRunnerWorkspaceRepairCommit?.commit ===
      v2RunnerWorkspaceRepairCommit
    && governance?.ownership?.implementationRunnerWorkspaceRepairCommit?.parent ===
      v2RunnerWorkspaceRepairParent
    && governance?.ownership?.implementationRunnerWorkspaceRepairCommit?.tree ===
      v2RunnerWorkspaceRepairTree
    && governance?.ownership?.implementationRunnerWorkspaceRepairCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationRunnerWorkspaceRepairCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationTrustedTempAliasRepairCommit?.commit ===
      v2TrustedTempAliasRepairCommit
    && governance?.ownership?.implementationTrustedTempAliasRepairCommit?.parent ===
      v2TrustedTempAliasRepairParent
    && governance?.ownership?.implementationTrustedTempAliasRepairCommit?.tree ===
      v2TrustedTempAliasRepairTree
    && governance?.ownership?.implementationTrustedTempAliasRepairCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationTrustedTempAliasRepairCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationWranglerScratchIsolationCommit?.commit ===
      v2WranglerScratchIsolationCommit
    && governance?.ownership?.implementationWranglerScratchIsolationCommit?.parent ===
      v2TrustedTempAliasRepairCommit
    && governance?.ownership?.implementationWranglerScratchIsolationCommit?.tree ===
      v2WranglerScratchIsolationTree
    && governance?.ownership?.implementationWranglerScratchIsolationCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationWranglerScratchIsolationCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationNode24CleanupRepairCommit?.commit ===
      v2Node24CleanupRepairCommit
    && governance?.ownership?.implementationNode24CleanupRepairCommit?.parent ===
      v2Node24CleanupRepairParent
    && governance?.ownership?.implementationNode24CleanupRepairCommit?.tree ===
      v2Node24CleanupRepairTree
    && governance?.ownership?.implementationNode24CleanupRepairCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationNode24CleanupRepairCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationCanonicalSmokeRepairCommit?.commit ===
      v2CanonicalSmokeRepairCommit
    && governance?.ownership?.implementationCanonicalSmokeRepairCommit?.parent ===
      v2CanonicalSmokeRepairParent
    && governance?.ownership?.implementationCanonicalSmokeRepairCommit?.tree ===
      v2CanonicalSmokeRepairTree
    && governance?.ownership?.implementationCanonicalSmokeRepairCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationCanonicalSmokeRepairCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationPublicBundlePreservationCommit?.commit ===
      v2PublicBundlePreservationCommit
    && governance?.ownership?.implementationPublicBundlePreservationCommit?.parent ===
      v2PublicBundlePreservationParent
    && governance?.ownership?.implementationPublicBundlePreservationCommit?.tree ===
      v2PublicBundlePreservationTree
    && governance?.ownership?.implementationPublicBundlePreservationCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationPublicBundlePreservationCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationCanonicalClientIsolationCommit?.commit ===
      v2CanonicalClientIsolationCommit
    && governance?.ownership?.implementationCanonicalClientIsolationCommit?.parent ===
      v2PublicBundlePreservationCommit
    && governance?.ownership?.implementationCanonicalClientIsolationCommit?.tree ===
      v2CanonicalClientIsolationTree
    && governance?.ownership?.implementationCanonicalClientIsolationCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationCanonicalClientIsolationCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationPayloadContinuityCommit?.commit ===
      v2PayloadContinuityCommit
    && governance?.ownership?.implementationPayloadContinuityCommit?.parent ===
      v2CanonicalClientIsolationCommit
    && governance?.ownership?.implementationPayloadContinuityCommit?.tree ===
      v2PayloadContinuityTree
    && governance?.ownership?.implementationPayloadContinuityCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationPayloadContinuityCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationReleasePropagationRepairCommit?.commit ===
      v2ReleasePropagationRepairCommit
    && governance?.ownership?.implementationReleasePropagationRepairCommit?.parent ===
      v2ReleasePropagationRepairParent
    && governance?.ownership?.implementationReleasePropagationRepairCommit?.tree ===
      v2ReleasePropagationRepairTree
    && governance?.ownership?.implementationReleasePropagationRepairCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationReleasePropagationRepairCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationRollbackRootGuardRepairCommit?.commit ===
      v2RollbackRootGuardRepairCommit
    && governance?.ownership?.implementationRollbackRootGuardRepairCommit?.parent ===
      v2RollbackRootGuardRepairParent
    && governance?.ownership?.implementationRollbackRootGuardRepairCommit?.tree ===
      v2RollbackRootGuardRepairTree
    && governance?.ownership?.implementationRollbackRootGuardRepairCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationRollbackRootGuardRepairCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationGuardConvergenceRepairCommit?.commit ===
      v2GuardConvergenceRepairCommit
    && governance?.ownership?.implementationGuardConvergenceRepairCommit?.parent ===
      v2GuardConvergenceRepairParent
    && governance?.ownership?.implementationGuardConvergenceRepairCommit?.tree ===
      v2GuardConvergenceRepairTree
    && governance?.ownership?.implementationGuardConvergenceRepairCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationGuardConvergenceRepairCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationForwardPayloadPinCorrectionCommit?.commit ===
      v2ForwardPayloadPinCorrectionCommit
    && governance?.ownership?.implementationForwardPayloadPinCorrectionCommit?.parent ===
      v2ForwardPayloadPinCorrectionParent
    && governance?.ownership?.implementationForwardPayloadPinCorrectionCommit?.tree ===
      v2ForwardPayloadPinCorrectionTree
    && governance?.ownership?.implementationForwardPayloadPinCorrectionCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationForwardPayloadPinCorrectionCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationUnconditionalGuardRoutingCommit?.commit ===
      v2UnconditionalGuardRoutingCommit
    && governance?.ownership?.implementationUnconditionalGuardRoutingCommit?.parent ===
      v2UnconditionalGuardRoutingParent
    && governance?.ownership?.implementationUnconditionalGuardRoutingCommit?.tree ===
      v2UnconditionalGuardRoutingTree
    && governance?.ownership?.implementationUnconditionalGuardRoutingCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationUnconditionalGuardRoutingCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationPaidCustomerAcceptanceCommit?.commit ===
      v2PaidCustomerAcceptanceCommit
    && governance?.ownership?.implementationPaidCustomerAcceptanceCommit?.parent ===
      v2PaidCustomerAcceptanceParent
    && governance?.ownership?.implementationPaidCustomerAcceptanceCommit?.tree ===
      v2PaidCustomerAcceptanceTree
    && governance?.ownership?.implementationPaidCustomerAcceptanceCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationPaidCustomerAcceptanceCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationBrowserAcceptanceRepairCommit?.commit ===
      v2BrowserAcceptanceRepairCommit
    && governance?.ownership?.implementationBrowserAcceptanceRepairCommit?.parent ===
      v2BrowserAcceptanceRepairParent
    && governance?.ownership?.implementationBrowserAcceptanceRepairCommit?.tree ===
      v2BrowserAcceptanceRepairTree
    && governance?.ownership?.implementationBrowserAcceptanceRepairCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationBrowserAcceptanceRepairCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationSmokeSequencingRepairCommit?.commit ===
      v2SmokeSequencingRepairCommit
    && governance?.ownership?.implementationSmokeSequencingRepairCommit?.parent ===
      v2SmokeSequencingRepairParent
    && governance?.ownership?.implementationSmokeSequencingRepairCommit?.tree ===
      v2SmokeSequencingRepairTree
    && governance?.ownership?.implementationSmokeSequencingRepairCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationSmokeSequencingRepairCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationProbePropagationRepairCommit?.commit ===
      v2ProbePropagationRepairCommit
    && governance?.ownership?.implementationProbePropagationRepairCommit?.parent ===
      v2ProbePropagationRepairParent
    && governance?.ownership?.implementationProbePropagationRepairCommit?.tree ===
      v2ProbePropagationRepairTree
    && governance?.ownership?.implementationProbePropagationRepairCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationProbePropagationRepairCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationHttpPathDiagnosticsRepairCommit?.commit ===
      v2HttpPathDiagnosticsRepairCommit
    && governance?.ownership?.implementationHttpPathDiagnosticsRepairCommit?.parent ===
      v2HttpPathDiagnosticsRepairParent
    && governance?.ownership?.implementationHttpPathDiagnosticsRepairCommit?.tree ===
      v2HttpPathDiagnosticsRepairTree
    && governance?.ownership?.implementationHttpPathDiagnosticsRepairCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationHttpPathDiagnosticsRepairCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationBrowserManagedIconRepairCommit?.commit ===
      v2BrowserManagedIconRepairCommit
    && governance?.ownership?.implementationBrowserManagedIconRepairCommit?.parent ===
      v2BrowserManagedIconRepairParent
    && governance?.ownership?.implementationBrowserManagedIconRepairCommit?.tree ===
      v2BrowserManagedIconRepairTree
    && governance?.ownership?.implementationBrowserManagedIconRepairCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationBrowserManagedIconRepairCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationBrowserManagedIconSecretScanRepairCommit?.commit ===
      v2BrowserManagedIconSecretScanRepairCommit
    && governance?.ownership?.implementationBrowserManagedIconSecretScanRepairCommit?.parent ===
      v2BrowserManagedIconSecretScanRepairParent
    && governance?.ownership?.implementationBrowserManagedIconSecretScanRepairCommit?.tree ===
      v2BrowserManagedIconSecretScanRepairTree
    && governance?.ownership?.implementationBrowserManagedIconSecretScanRepairCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationBrowserManagedIconSecretScanRepairCommit?.committer ===
      infrastructureIdentity
    && governance?.ownership?.implementationBrowserSmokeMarkerPropagationRepairCommit?.commit ===
      v2BrowserSmokeMarkerPropagationRepairCommit
    && governance?.ownership?.implementationBrowserSmokeMarkerPropagationRepairCommit?.parent ===
      v2BrowserSmokeMarkerPropagationRepairParent
    && governance?.ownership?.implementationBrowserSmokeMarkerPropagationRepairCommit?.tree ===
      v2BrowserSmokeMarkerPropagationRepairTree
    && governance?.ownership?.implementationBrowserSmokeMarkerPropagationRepairCommit?.author ===
      infrastructureIdentity
    && governance?.ownership?.implementationBrowserSmokeMarkerPropagationRepairCommit?.committer ===
      infrastructureIdentity,
  "Private Workflow v2 owner provenance drifted.");
  require(equal(governance?.ownership?.implementationPaths, Object.keys(v2OwnerHashes)),
    "Private Workflow v2 owner path set drifted.");
  require(equal(governance?.ownership?.bootstrapRepairPaths,
    Object.keys(v2BootstrapRepairHashes)),
  "Private Workflow v2 bootstrap repair path set drifted.");
  require(equal(governance?.ownership?.bootstrapRepairEvidence,
    Object.entries(v2BootstrapRepairHashes).map(([path, sha256Value]) => ({
      path,
      sha256: sha256Value
    }))),
  "Private Workflow v2 bootstrap repair evidence drifted.");
  require(equal(governance?.ownership?.runnerWorkspaceRepairPaths,
    Object.keys(v2RunnerWorkspaceRepairHashes)),
  "Private Workflow v2 runner-workspace repair path set drifted.");
  require(equal(governance?.ownership?.runnerWorkspaceRepairEvidence,
    Object.entries(v2RunnerWorkspaceRepairHashes).map(([path, sha256Value]) => ({
      path,
      sha256: sha256Value
    }))),
  "Private Workflow v2 runner-workspace repair evidence drifted.");
  require(equal(governance?.ownership?.trustedTempAliasRepairPaths,
    Object.keys(v2TrustedTempAliasRepairHashes)),
  "Private Workflow v2 trusted-temp-alias repair path set drifted.");
  require(equal(governance?.ownership?.trustedTempAliasRepairEvidence,
    Object.entries(v2TrustedTempAliasRepairHashes).map(([path, sha256Value]) => ({
      path,
      sha256: sha256Value
    }))),
  "Private Workflow v2 trusted-temp-alias repair evidence drifted.");
  require(equal(governance?.ownership?.wranglerScratchIsolationPaths,
    Object.keys(v2WranglerScratchIsolationHashes)),
  "Private Workflow v2 Wrangler-scratch isolation path set drifted.");
  require(equal(governance?.ownership?.wranglerScratchIsolationEvidence,
    Object.entries(v2WranglerScratchIsolationHashes).map(([path, sha256Value]) => ({
      path,
      sha256: sha256Value
    }))),
  "Private Workflow v2 Wrangler-scratch isolation evidence drifted.");
  require(equal(governance?.ownership?.node24CleanupRepairPaths,
    Object.keys(v2Node24CleanupRepairHashes)),
  "Private Workflow v2 Node 24 cleanup repair path set drifted.");
  require(equal(governance?.ownership?.node24CleanupRepairEvidence,
    Object.entries(v2Node24CleanupRepairHashes).map(([path, sha256Value]) => ({
      path,
      sha256: sha256Value
    }))),
  "Private Workflow v2 Node 24 cleanup repair evidence drifted.");
  require(equal(governance?.ownership?.canonicalSmokeRepairPaths,
    Object.keys(v2CanonicalSmokeRepairHashes)),
  "Private Workflow v2 canonical-smoke repair path set drifted.");
  require(equal(governance?.ownership?.canonicalSmokeRepairEvidence,
    Object.entries(v2CanonicalSmokeRepairHashes).map(([path, sha256Value]) => ({
      path,
      sha256: sha256Value
    }))),
  "Private Workflow v2 canonical-smoke repair evidence drifted.");
  require(equal(governance?.ownership?.publicBundlePreservationPaths,
    Object.keys(v2PublicBundlePreservationHashes)),
  "Private Workflow v2 public-bundle preservation path set drifted.");
  require(equal(governance?.ownership?.publicBundlePreservationEvidence,
    evidenceMap(v2PublicBundlePreservationHashes)),
  "Private Workflow v2 public-bundle preservation evidence drifted.");
  require(equal(governance?.ownership?.canonicalClientIsolationPaths,
    Object.keys(v2CanonicalClientIsolationHashes)),
  "Private Workflow v2 canonical-client isolation path set drifted.");
  require(equal(governance?.ownership?.canonicalClientIsolationEvidence,
    evidenceMap(v2CanonicalClientIsolationHashes)),
  "Private Workflow v2 canonical-client isolation evidence drifted.");
  require(equal(governance?.ownership?.payloadContinuityPaths,
    Object.keys(v2PayloadContinuityHashes)),
  "Private Workflow v2 payload-continuity path set drifted.");
  require(equal(governance?.ownership?.payloadContinuityEvidence,
    evidenceMap(v2PayloadContinuityHashes)),
  "Private Workflow v2 payload-continuity evidence drifted.");
  require(equal(governance?.ownership?.releasePropagationRepairPaths,
    Object.keys(v2ReleasePropagationRepairHashes)),
  "Private Workflow v2 release-propagation repair path set drifted.");
  require(equal(governance?.ownership?.releasePropagationRepairEvidence,
    evidenceMap(v2ReleasePropagationRepairHashes)),
  "Private Workflow v2 release-propagation repair evidence drifted.");
  require(equal(governance?.ownership?.rollbackRootGuardRepairPaths,
    Object.keys(v2RollbackRootGuardRepairHashes)),
  "Private Workflow v2 rollback-root guard repair path set drifted.");
  require(equal(governance?.ownership?.rollbackRootGuardRepairEvidence,
    evidenceMap(v2RollbackRootGuardRepairHashes)),
  "Private Workflow v2 rollback-root guard repair evidence drifted.");
  require(equal(governance?.ownership?.guardConvergenceRepairPaths,
    Object.keys(v2GuardConvergenceRepairHashes)),
  "Private Workflow v2 guard-convergence repair path set drifted.");
  require(equal(governance?.ownership?.guardConvergenceRepairEvidence,
    evidenceMap(v2GuardConvergenceRepairHashes)),
  "Private Workflow v2 guard-convergence repair evidence drifted.");
  require(equal(governance?.ownership?.forwardPayloadPinCorrectionPaths,
    Object.keys(v2ForwardPayloadPinCorrectionHashes)),
  "Private Workflow v2 forward-payload pin correction path set drifted.");
  require(equal(governance?.ownership?.forwardPayloadPinCorrectionEvidence,
    evidenceMap(v2ForwardPayloadPinCorrectionHashes)),
  "Private Workflow v2 forward-payload pin correction evidence drifted.");
  require(equal(governance?.ownership?.unconditionalGuardRoutingPaths,
    Object.keys(v2UnconditionalGuardRoutingHashes)),
  "Private Workflow v2 unconditional-guard routing path set drifted.");
  require(equal(governance?.ownership?.unconditionalGuardRoutingEvidence,
    evidenceMap(v2UnconditionalGuardRoutingHashes)),
  "Private Workflow v2 unconditional-guard routing evidence drifted.");
  require(equal(governance?.ownership?.paidCustomerAcceptancePaths,
    Object.keys(v2PaidCustomerAcceptanceHashes)),
  "Private Workflow v2 paid-customer acceptance path set drifted.");
  require(equal(governance?.ownership?.paidCustomerAcceptanceEvidence,
    evidenceMap(v2PaidCustomerAcceptanceHashes)),
  "Private Workflow v2 paid-customer acceptance evidence drifted.");
  require(equal(governance?.ownership?.browserAcceptanceRepairPaths,
    Object.keys(v2BrowserAcceptanceRepairHashes)),
  "Private Workflow v2 browser-acceptance repair path set drifted.");
  require(equal(governance?.ownership?.browserAcceptanceRepairEvidence,
    evidenceMap(v2BrowserAcceptanceRepairHashes)),
  "Private Workflow v2 browser-acceptance repair evidence drifted.");
  require(equal(governance?.ownership?.smokeSequencingRepairPaths,
    Object.keys(v2SmokeSequencingRepairHashes)),
  "Private Workflow v2 smoke-sequencing repair path set drifted.");
  require(equal(governance?.ownership?.smokeSequencingRepairEvidence,
    evidenceMap(v2SmokeSequencingRepairHashes)),
  "Private Workflow v2 smoke-sequencing repair evidence drifted.");
  require(equal(governance?.ownership?.probePropagationRepairPaths,
    Object.keys(v2ProbePropagationRepairHashes)),
  "Private Workflow v2 probe-propagation repair path set drifted.");
  require(equal(governance?.ownership?.probePropagationRepairEvidence,
    evidenceMap(v2ProbePropagationRepairHashes)),
  "Private Workflow v2 probe-propagation repair evidence drifted.");
  require(equal(governance?.ownership?.browserHealthDiagnosticsRepairPaths,
    Object.keys(v2BrowserHealthDiagnosticsRepairHashes)),
  "Private Workflow v2 browser-health diagnostics repair path set drifted.");
  require(equal(governance?.ownership?.browserHealthDiagnosticsRepairEvidence,
    evidenceMap(v2BrowserHealthDiagnosticsRepairHashes)),
  "Private Workflow v2 browser-health diagnostics repair evidence drifted.");
  require(equal(governance?.ownership?.browserAcceptanceEvidenceRepairPaths,
    Object.keys(v2BrowserAcceptanceEvidenceRepairHashes)),
  "Private Workflow v2 browser-acceptance evidence repair path set drifted.");
  require(equal(governance?.ownership?.browserAcceptanceEvidenceRepairEvidence,
    evidenceMap(v2BrowserAcceptanceEvidenceRepairHashes)),
  "Private Workflow v2 browser-acceptance evidence repair evidence drifted.");
  require(equal(governance?.ownership?.serviceWorkerGuardRepairPaths,
    Object.keys(v2ServiceWorkerGuardRepairHashes)),
  "Private Workflow v2 service-worker guard repair path set drifted.");
  require(equal(governance?.ownership?.serviceWorkerGuardRepairEvidence,
    evidenceMap(v2ServiceWorkerGuardRepairHashes)),
  "Private Workflow v2 service-worker guard repair evidence drifted.");
  require(equal(governance?.ownership?.httpPathDiagnosticsRepairPaths,
    Object.keys(v2HttpPathDiagnosticsRepairHashes)),
  "Private Workflow v2 HTTP-path diagnostics repair path set drifted.");
  require(equal(governance?.ownership?.httpPathDiagnosticsRepairEvidence,
    evidenceMap(v2HttpPathDiagnosticsRepairHashes)),
  "Private Workflow v2 HTTP-path diagnostics repair evidence drifted.");
  require(equal(governance?.ownership?.browserManagedIconRepairPaths,
    Object.keys(v2BrowserManagedIconRepairHashes)),
  "Private Workflow v2 browser-managed icon repair path set drifted.");
  require(equal(governance?.ownership?.browserManagedIconRepairEvidence,
    evidenceMap(v2BrowserManagedIconRepairHashes)),
  "Private Workflow v2 browser-managed icon repair evidence drifted.");
  require(equal(governance?.ownership?.browserManagedIconSecretScanRepairPaths,
    Object.keys(v2BrowserManagedIconSecretScanRepairHashes)),
  "Private Workflow v2 browser-managed icon secret-scan repair path set drifted.");
  require(equal(governance?.ownership?.browserManagedIconSecretScanRepairEvidence,
    evidenceMap(v2BrowserManagedIconSecretScanRepairHashes)),
  "Private Workflow v2 browser-managed icon secret-scan repair evidence drifted.");
  require(equal(governance?.ownership?.browserSmokeMarkerPropagationRepairPaths,
    Object.keys(v2BrowserSmokeMarkerPropagationRepairHashes)),
  "Private Workflow v2 browser smoke-marker repair path set drifted.");
  require(equal(governance?.ownership?.browserSmokeMarkerPropagationRepairEvidence,
    evidenceMap(v2BrowserSmokeMarkerPropagationRepairHashes)),
  "Private Workflow v2 browser smoke-marker repair evidence drifted.");
  require(governance?.rootCause?.legacyQualificationArtifactDeployable === false
    && governance?.rootCause?.legacyWorkflowRebuildsCurrentMain === true
    && governance?.rootCause?.legacyWorkflowConsumesExactQualifiedPayload === false
    && governance?.rootCause?.firstDeploymentWorkflowRun === "30187966068"
    && governance?.rootCause?.firstDeploymentReachedProductionMutation === false
    && governance?.rootCause?.firstDeploymentRollbackRequired === false
    && typeof governance?.rootCause?.bootstrapDeadlock === "string"
    && typeof governance?.rootCause?.bootstrapRepair === "string"
    && governance?.rootCause?.secondDeploymentWorkflowRun === "30189780921"
    && governance?.rootCause?.secondDeploymentFailure ===
      "RUNTIME_GUARD_WORKSPACE_INVALID"
    && governance?.rootCause?.secondDeploymentReachedProductionMutation === false
    && governance?.rootCause?.secondDeploymentRollbackRequired === false
    && governance?.rootCause?.thirdDeploymentWorkflowRun === "30191466442"
    && governance?.rootCause?.thirdDeploymentFailure ===
      "RUNTIME_GUARD_WORKSPACE_INVALID"
    && governance?.rootCause?.thirdDeploymentDryRunWranglerSpawned === true
    && governance?.rootCause?.thirdDeploymentDryRunCompleted === true
    && governance?.rootCause?.thirdDeploymentForwardWranglerSpawned === false
    && governance?.rootCause?.thirdDeploymentReachedProductionMutation === false
    && governance?.rootCause?.thirdDeploymentRollbackRequired === false
    && governance?.rootCause?.rejectedStaleCause?.includes(
      "did not explain run 30191466442"
    )
    && governance?.rootCause?.runnerWorkspaceCause?.includes(
      "Wrangler 4.110.0 dry-run created project-local .wrangler"
    )
    && !governance?.rootCause?.runnerWorkspaceCause?.includes(
      "before the Wrangler process could start"
    )
    && governance?.rootCause?.trustedTempAliasRepair?.includes(
      "caller-supplied aliases remain rejected"
    )
    && governance?.rootCause?.wranglerScratchIsolationRepair?.includes("--outdir")
    && governance?.rootCause?.fourthQualificationWorkflowRun === "30193359749"
    && governance?.rootCause?.fourthQualificationReachedArtifactBuild === false
    && governance?.rootCause?.fourthQualificationReachedProductionMutation === false
    && governance?.rootCause?.node24CleanupCause?.includes("ERR_FS_EISDIR")
    && governance?.rootCause?.node24CleanupRepair?.includes("unlinkSync")
    && equal(governance?.rootCause?.canonicalSmokeFailedRuns, [
      "30197730489",
      "30199390518",
      "30199552708",
      "30199655532"
    ])
    && governance?.rootCause?.canonicalSmokeFailedRunsReachedProductionMutation ===
      false
    && governance?.rootCause?.canonicalSmokeCause?.includes(
      "307 canonicalization redirect from /index.html to /"
    )
    && governance?.rootCause?.canonicalSmokeRepair?.includes(
      "every redirect remains fail-closed"
    )
    && governance?.rootCause?.sharedPublicRollbackDriftCause?.includes(
      "shared runtime guard changed the generated public Worker bundle"
    )
    && governance?.rootCause?.sharedPublicRollbackPreservationRepair?.includes(
      "isolated canonical-path filtering inside the non-Worker smoke client"
    )
    && governance?.rootCause?.publicRollbackBundleSha256 ===
      "f8fceee62838c182a4e093d4d8bc57c71bf5ec8dbe71707db76c63ecd7a4b1eb"
    && governance?.rootCause?.publicRollbackBundleChanged === false
    && governance?.rootCause?.propagationFailureDeploymentRun === "30205110247"
    && governance?.rootCause?.propagationFailureReachedProductionMutation === true
    && governance?.rootCause?.propagationFailureClassification ===
      "SMOKE_FAILURE|DIMENSION=GUARD_MARKER_MISSING"
    && governance?.rootCause?.propagationFailureRollbackVerified === true
    && governance?.rootCause?.propagationFailureCause?.includes(
      "first immediate postdeployment root request"
    )
    && governance?.rootCause?.propagationRepair?.includes(
      "exact Cloudflare Worker version ID"
    )
    && governance?.rootCause?.propagationRepair?.includes(
      "body cancellation share one bounded deadline"
    )
    && governance?.rootCause?.rollbackRootGuardGap?.includes(
      "rollback originally routed only /api/*"
    )
    && governance?.rootCause?.rollbackRootGuardRepair?.includes(
      "canonical / and the existing /api/* namespace"
    )
    && governance?.rootCause?.secondPropagationFailureDeploymentRun === "30210281673"
    && governance?.rootCause?.secondPropagationFailureReachedProductionMutation === true
    && governance?.rootCause?.secondPropagationFailureClassification ===
      "SMOKE_FAILURE|DIMENSION=GUARD_MARKER_MISSING"
    && governance?.rootCause?.secondPropagationFailureRollbackVerified === true
    && governance?.rootCause?.guardConvergenceGap?.includes(
      "readiness fence proved only the canonical root"
    )
    && governance?.rootCause?.guardConvergenceRepair?.includes(
      "entire fixed GET/HEAD plan"
    )
    && governance?.rootCause?.guardConvergenceRepair?.includes(
      "never retries unsafe response classes"
    )
    && governance?.rootCause?.forwardPayloadPinCorrection?.includes(
      "materialized dependency tree"
    )
    && governance?.rootCause?.thirdPropagationFailureDeploymentRun === "30213341082"
    && governance?.rootCause?.thirdPropagationFailureReachedProductionMutation === true
    && governance?.rootCause?.thirdPropagationFailureClassification ===
      "SMOKE_FAILURE|DIMENSION=GUARD_PROPAGATION_TIMEOUT|PROBE=RUNTIME_POOLS_GET"
    && governance?.rootCause?.thirdPropagationFailureRollbackVerified === true
    && governance?.rootCause?.unconditionalGuardRoutingGap?.includes(
      "selective route-pattern array"
    )
    && governance?.rootCause?.prematureConvergenceDeadlineGap?.includes(
      "roughly 16.5 seconds"
    )
    && governance?.rootCause?.unconditionalGuardRoutingRepair?.includes(
      "boolean true unconditional Worker-first mode"
    )
    && governance?.rootCause?.unconditionalGuardRoutingRepair?.includes(
      "monotonic 46.5-second deadline"
    )
    && governance?.rootCause?.concurrentSmokeFailureDeploymentRun === "30482733457"
    && governance?.rootCause?.concurrentSmokeFailureReachedProductionMutation === true
    && governance?.rootCause?.concurrentSmokeFailureClassification ===
      "SMOKE_FAILURE|DIMENSION=NETWORK_FAILED|PROBE=ROOT_GET"
    && governance?.rootCause?.concurrentSmokeFailureRollbackVerified === true
    && governance?.rootCause?.concurrentSmokeFailureCause?.includes(
      "15-request GET/HEAD plan concurrently"
    )
    && governance?.rootCause?.smokeSequencingRepair?.includes(
      "canonical GET /"
    )
    && governance?.rootCause?.smokeSequencingRepair?.includes(
      "exactly once in deterministic sequence"
    )
    && governance?.rootCause?.probePropagationFailureDeploymentRun === "30487336591"
    && governance?.rootCause?.probePropagationFailureReachedProductionMutation === true
    && governance?.rootCause?.probePropagationFailureClassification ===
      "SMOKE_FAILURE|DIMENSION=RELEASE_IDENTITY_MISMATCH|PROBE=ROOT_GET"
    && governance?.rootCause?.probePropagationFailureRollbackVerified === true
    && governance?.rootCause?.probePropagationFailureCause?.includes(
      "immediately following fixed-plan root request"
    )
    && governance?.rootCause?.probePropagationRepair?.includes(
      "one shared monotonic 46.5-second deadline"
    )
    && governance?.rootCause?.browserHealthFailureDeploymentRun === "30492810689"
    && governance?.rootCause?.browserHealthFailureReachedProductionMutation === true
    && governance?.rootCause?.browserHealthFailureClassification ===
      "PRIVATE_WORKER_V2_FORWARD_ROLLBACK_VERIFIED|CAUSE=QUALIFICATION_FAILED|DIMENSION=HEALTH"
    && governance?.rootCause?.browserHealthFailureRollbackVerified === true
    && governance?.rootCause?.browserHealthDiagnosticGap?.includes(
      "collapsed eight viewport-specific health causes"
    )
    && governance?.rootCause?.browserHealthDiagnosticRepair?.includes(
      "fixed viewport-and-cause classification"
    )
    && governance?.rootCause?.browserManagedIconFailureDeploymentRun === "30512589660"
    && governance?.rootCause?.browserManagedIconFailureReachedProductionMutation === true
    && governance?.rootCause?.browserManagedIconFailureClassification?.includes(
      "DESKTOP_HTTP_OTHER_4XX_ICON"
    )
    && governance?.rootCause?.browserManagedIconFailureClassification?.includes(
      "MOBILE_HTTP_OTHER_4XX_ICON"
    )
    && governance?.rootCause?.browserManagedIconFailureRollbackVerified === true
    && governance?.rootCause?.browserManagedIconCause?.includes(
      "authenticated fixed smoke plan successfully fetched the exact production icon"
    )
    && governance?.rootCause?.browserManagedIconRepair?.includes(
      "verified real response bytes"
    )
    && governance?.rootCause?.browserSmokeMarkerFailureDeploymentRun === "30514529814"
    && governance?.rootCause?.browserSmokeMarkerFailureReachedProductionMutation === true
    && governance?.rootCause?.browserSmokeMarkerFailureClassification?.includes(
      "DESKTOP_HTTP_SCRIPT_4XX_OTHER"
    )
    && governance?.rootCause?.browserSmokeMarkerFailureRollbackVerified === true
    && governance?.rootCause?.browserSmokeMarkerCause?.includes(
      "omitted the server-required marker"
    )
    && governance?.rootCause?.browserSmokeMarkerRepair?.includes(
      "Every authenticated same-origin browser read request"
    ),
  "Private Workflow v2 root-cause record drifted.");
  require(governance?.workflowBoundary?.onlyTrigger === "workflow_dispatch"
    && governance?.workflowBoundary?.branch === "main"
    && governance?.workflowBoundary?.founderActor === founderActor
    && governance?.workflowBoundary?.founderTriggeringActor === founderActor
    && governance?.workflowBoundary?.firstRunAttemptOnly === true
    && governance?.workflowBoundary?.privateWorker === "prometheus-iq"
    && governance?.workflowBoundary?.publicWorker === "prometheusrouteiq-website"
    && governance?.workflowBoundary?.publicWorkerMutationAllowed === false
    && governance?.workflowBoundary?.rebuildDuringDeploymentAllowed === false
    && governance?.workflowBoundary?.artifactSubstitutionAllowed === false
    && governance?.workflowBoundary?.forwardDeploymentAttempts === 1
    && governance?.workflowBoundary?.automaticRetryAllowed === false
    && governance?.workflowBoundary?.forwardRollbackAttemptsAfterCriticalFailure === 1
    && governance?.workflowBoundary?.nativeRollbackAllowed === false,
  "Private Workflow v2 execution boundary drifted.");
  require(governance?.continuity?.qualifiedForwardPayloadSha256 ===
    "25d49f283bc07c212bf0c1a5f53fae17602bb149ba8870a9ad3519b6295a9707"
    && governance?.continuity?.previousQualifiedForwardPayloadSha256 ===
      "81bb2e724ce7433c591f7241c043b69ea329a5ecd15fe0045ed58bb37d77cb7c"
    && governance?.continuity?.qualifiedRollbackBundleSha256 ===
      "0350e6281b228321509c59fadc1fe612f6400b6d025c27dddd01ea980daddb79",
  "Private Workflow v2 continuity identities drifted.");
  require(governance?.artifactBoundary?.actualForwardPayloadIncluded === true
    && governance?.artifactBoundary?.forwardCompatibleRollbackIncluded === true
    && governance?.artifactBoundary?.wranglerMode === "no-bundle"
    && governance?.artifactBoundary?.wranglerVersion === "4.110.0"
    && governance?.artifactBoundary?.wranglerScratchIsolatedFromGuardedRoots === true
    && governance?.artifactBoundary?.phaseSpecificOutdirRequired === true
    && governance?.artifactBoundary?.guardedPayloadByteIdentityPreserved === true
    && governance?.artifactBoundary?.keepVars === true
    && governance?.artifactBoundary?.strict === true
    && governance?.artifactBoundary?.workerNameOverrideAllowed === false,
  "Private Workflow v2 artifact boundary drifted.");
  require(governance?.qualificationEvidence?.localRealWrangler?.required === true
    && governance?.qualificationEvidence?.localRealWrangler?.status === "PASS"
    && governance?.qualificationEvidence?.localRealWrangler?.ownerReportedNodeVersion ===
      "24.4.1"
    && governance?.qualificationEvidence?.localRealWrangler
      ?.independentVerifierExecutesWithCurrentNode === true
    && governance?.qualificationEvidence?.localRealWrangler?.wranglerVersion === "4.110.0"
    && governance?.qualificationEvidence?.localRealWrangler?.realProcessSpawned === true
    && governance?.qualificationEvidence?.localRealWrangler?.mode === "dry-run"
    && governance?.qualificationEvidence?.localRealWrangler?.cloudflareRequests === 0
    && governance?.qualificationEvidence?.localRealWrangler?.secretValuesRequired === false
    && governance?.qualificationEvidence?.localRealWrangler
      ?.phaseSpecificScratchVerified === true
    && governance?.qualificationEvidence?.localRealWrangler
      ?.guardedRootsUnchangedAfterDryRun === true
    && governance?.qualificationEvidence?.localRealWrangler
      ?.postDryRunRuntimeVerificationPassed === true
    && governance?.qualificationEvidence?.cleanGithubRunner
      ?.requiredBeforeQualificationAcceptance === true
    && governance?.qualificationEvidence?.cleanGithubRunner?.status === "PENDING"
    && governance?.qualificationEvidence?.cleanGithubRunner?.runner === "ubuntu-24.04"
    && governance?.qualificationEvidence?.cleanGithubRunner?.nodeMajor === 24
    && governance?.qualificationEvidence?.cleanGithubRunner?.realWranglerDryRunRequired === true
    && governance?.qualificationEvidence?.cleanGithubRunner
      ?.noSecretQualificationRequired === true
    && governance?.qualificationEvidence?.cleanGithubRunner?.acceptedRun === null
    && governance?.qualificationEvidence?.cleanGithubRunner?.failedRun === "30193359749"
    && governance?.qualificationEvidence?.cleanGithubRunner?.failedRunClassification ===
      "NODE_24_TEST_FIXTURE_SYMLINK_CLEANUP"
    && governance?.qualificationEvidence?.cleanGithubRunner
      ?.failedRunReachedArtifactBuild === false
    && governance?.qualificationEvidence?.cleanGithubRunner
      ?.failedRunReachedProductionMutation === false
    && governance?.qualificationEvidence?.cleanGithubRunner
      ?.qualificationMayPassWithoutEvidence === false,
  "Private Workflow v2 real-Wrangler qualification evidence drifted.");
  require(equal(governance?.smokeBoundary?.methods, ["GET", "HEAD"])
    && governance?.smokeBoundary?.authenticated === true
    && governance?.smokeBoundary?.attemptedApplicationWrites === 0
    && governance?.smokeBoundary?.redirectsFollowed === false
    && governance?.smokeBoundary?.canonicalHtmlPath === "/"
    && governance?.smokeBoundary?.noncanonicalHtmlAliasesAllowed === false
    && governance?.smokeBoundary?.runtimeGuardHistoricalReadOnlyAliasPreserved === true
    && governance?.smokeBoundary?.exactWorkerVersionReleaseIdentityRequired === true
    && governance?.smokeBoundary?.versionMetadataBinding === "CF_VERSION_METADATA"
    && governance?.smokeBoundary?.versionResponseHeader ===
      "X-Prometheus-Private-Worker-Version"
    && governance?.smokeBoundary?.fullSmokeVersionIdentityRequired === true
    && governance?.smokeBoundary?.rollbackRootVersionIdentityRequired === true
    && governance?.smokeBoundary?.rollbackRootComposedGuardTestRequired === true
    && governance?.smokeBoundary?.fullFixedPlanConvergenceRequired === true
    && governance?.smokeBoundary?.fullFixedPlanSafePropagationRetryPerProbe === true
    && governance?.smokeBoundary?.fullFixedPlanSharedPropagationDeadline === true
    && governance?.smokeBoundary?.fixedNonsecretProbeClassificationRequired === true
    && governance?.smokeBoundary?.forwardAndRollbackWorkerFirstUnconditional === true
    && governance?.smokeBoundary?.selectiveWorkerFirstArraysAccepted === false
    && governance?.smokeBoundary?.monotonicElapsedDeadline === true
    && governance?.smokeBoundary?.attemptLimitControlsAcceptance === false
    && governance?.smokeBoundary?.requestAndResponseLifecycleDeadlineEnforced === true
    && governance?.smokeBoundary?.propagationMaximumWaitMilliseconds === 46500
    && governance?.smokeBoundary?.unsafeResponseRetryAllowed === false,
  "Private Workflow v2 smoke boundary drifted.");
  require(governance?.runtimeBoundary?.prospectiveCollection === "OFF"
    && governance?.runtimeBoundary?.activeCohorts === 0
    && governance?.runtimeBoundary?.recommendationInfluence === "OFF"
    && governance?.runtimeBoundary?.availabilityMode === "OFF"
    && governance?.runtimeBoundary?.customerPwaLaunch === "OFF"
    && governance?.runtimeBoundary?.anthonyMapped === false
    && governance?.runtimeBoundary?.publicWorkerMutationAllowed === false
    && governance?.runtimeBoundary?.crmMutationAllowed === false,
  "Private Workflow v2 runtime boundary drifted.");
  require(governance?.protectedEnvironment?.name ===
    "prometheus-private-worker-production"
    && governance?.protectedEnvironment?.mainOnly === true
    && equal(governance?.protectedEnvironment?.requiredSecretNames, [
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_ACCESS_CLIENT_ID",
      "CLOUDFLARE_ACCESS_CLIENT_SECRET",
      "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_TEAM_DOMAIN",
      "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_AUDIENCE"
    ])
    && equal(governance?.protectedEnvironment?.readOnlyNameAudit, {
      CLOUDFLARE_API_TOKEN: "PRESENT",
      CLOUDFLARE_ACCOUNT_ID: "PRESENT",
      CLOUDFLARE_ACCESS_CLIENT_ID: "PRESENT",
      CLOUDFLARE_ACCESS_CLIENT_SECRET: "PRESENT",
      PROMETHEUS_UNATTENDED_SMOKE_ACCESS_TEAM_DOMAIN: "PRESENT",
      PROMETHEUS_UNATTENDED_SMOKE_ACCESS_AUDIENCE: "PRESENT"
    })
    && governance?.protectedEnvironment?.secretValuesAccessed === false
    && governance?.protectedEnvironment
      ?.externalCredentialValuesHandledEphemerallyByAuthenticatedInterface === true
    && governance?.protectedEnvironment
      ?.externalCredentialValuesPrintedLoggedCommittedOrReported === false
    && governance?.protectedEnvironment?.accessApplicationId ===
      "ff70fcc7-13a0-4582-9f33-a6d5186f6bc7"
    && governance?.protectedEnvironment?.accessServiceAuthPolicyId ===
      "14fc787c-beb8-4abc-9923-8eaa9ae7d3d3"
    && governance?.protectedEnvironment?.unrelatedAccessPoliciesOrCredentialsModified ===
      false
    && governance?.protectedEnvironment?.missingNamesFailBeforeCloudflareRequest === true
    && governance?.protectedEnvironment?.deploymentReady === true,
  "Private Workflow v2 protected-environment boundary drifted.");
  require(governance?.releaseBoundary?.qualificationAuthorizedByStandingDirective === true
    && governance?.releaseBoundary?.deploymentPerformedByThisGovernanceCommit === false
    && governance?.releaseBoundary?.productionContactPerformedByThisGovernanceCommit === false
    && governance?.releaseBoundary?.qualificationPerformedByThisGovernanceCommit === false
    && governance?.releaseBoundary?.externalCredentialAndAccessConfigurationPerformed ===
      true
    && governance?.releaseBoundary?.failedDeploymentRunReachedProductionMutation === true
    && governance?.releaseBoundary?.failedDeploymentRunRollbackVerified === true
    && governance?.releaseBoundary?.runnerWorkspaceFailureReachedProductionMutation ===
      false
    && governance?.releaseBoundary?.wranglerScratchFailureReachedProductionMutation ===
      false
    && governance?.releaseBoundary?.publicRollbackBundleChanged === false
    && governance?.releaseBoundary?.cleanRunnerRequalificationRequired === true
    && governance?.releaseBoundary?.pushMayTriggerDeployment === false,
  "Private Workflow v2 release boundary drifted.");
  require(contract?.contractVersion === "github-actions-private-worker-deployment-v2"
    && contract?.owner === "Prometheus Infrastructure"
    && contract?.status === "IMPLEMENTED_NOT_QUALIFIED_NOT_DEPLOYED"
    && contract?.target?.privateWorker === "prometheus-iq"
    && contract?.target?.publicWorkerMutationAllowed === false
    && contract?.qualification?.cloudflareRequestsAllowed === false
    && contract?.qualification?.secretAccessAllowed === false
    && contract?.deployment?.rebuildAllowed === false
    && contract?.deployment?.artifactSubstitutionAllowed === false
    && contract?.deployment?.forwardDeploymentAttempts === 1
    && contract?.deployment?.automaticRetryAllowed === false
    && equal(contract?.protectedEnvironment?.requiredSecretNames, [
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_ACCESS_CLIENT_ID",
      "CLOUDFLARE_ACCESS_CLIENT_SECRET",
      "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_TEAM_DOMAIN",
      "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_AUDIENCE"
    ])
    && contract?.configurationPreservation?.bindingTransition
      ?.everyPreexistingBindingRequired === true
    && contract?.configurationPreservation?.bindingTransition
      ?.qualifiedConfiguredAdditionsAllowed === true
    && contract?.configurationPreservation?.bindingTransition
      ?.unexpectedAdditionsAllowed === false
    && contract?.configurationPreservation?.bindingTransition?.deletionsAllowed === false
    && contract?.configurationPreservation?.bindingTransition?.typeChangesAllowed === false
    && contract?.smoke?.bootstrap?.currentPrivateVersionWithoutGuard ===
      "9ffb32d3-313a-4209-ad1d-0a6702ba8a83"
    && contract?.smoke?.bootstrap?.accessServiceTokenRequired === true
    && contract?.smoke?.bootstrap?.guardResponseMarkerMayBeOmittedOnlyForPinnedCurrentVersion
      === true
    && contract?.smoke?.postDeployment?.exactGuardResponseMarkerRequired === true
    && contract?.smoke?.postDeployment?.latestFailedRun === "30487336591"
    && contract?.smoke?.postDeployment?.latestFailureClassification ===
      "SMOKE_FAILURE|DIMENSION=RELEASE_IDENTITY_MISMATCH|PROBE=ROOT_GET"
    && contract?.smoke?.postDeployment?.latestFailureForwardRollbackVerified === true
    && contract?.smoke?.postDeployment?.propagationFence?.scope ===
      "canonical_root_get_then_each_fixed_probe"
    && contract?.smoke?.postDeployment?.propagationFence?.readinessProbe === "GET /"
    && contract?.smoke?.postDeployment?.propagationFence
      ?.fixedNonsecretProbeClassification === true
    && contract?.smoke?.postDeployment?.propagationFence
      ?.finalExactRootProbeIsReadiness === true
    && contract?.smoke?.postDeployment?.propagationFence
      ?.fullFixedSmokeRunsAfterReadiness === true
    && contract?.smoke?.postDeployment?.propagationFence
      ?.fullFixedSmokeExecution === "sequential_bounded_propagation_per_probe"
    && contract?.smoke?.postDeployment?.propagationFence
      ?.fullFixedSmokeSharedDeadline === true
    && contract?.smoke?.postDeployment?.propagationFence
      ?.concurrentRequestsPerAttempt === false
    && contract?.smoke?.postDeployment?.propagationFence
      ?.unconditionalWorkerFirst === true
    && contract?.smoke?.postDeployment?.propagationFence
      ?.monotonicElapsedDeadline === true
    && contract?.smoke?.postDeployment?.propagationFence
      ?.attemptLimitControlsAcceptance === false
    && contract?.continuity?.qualifiedForwardPayloadSha256 ===
      "25d49f283bc07c212bf0c1a5f53fae17602bb149ba8870a9ad3519b6295a9707"
    && contract?.continuity?.qualifiedRollbackBundleSha256 ===
      "0350e6281b228321509c59fadc1fe612f6400b6d025c27dddd01ea980daddb79"
    && contract?.browserAcceptance?.contract ===
      "workers/infrastructure/route-iq-paid-customer-private-browser-acceptance-v1.json"
    && contract?.browserAcceptance?.runner ===
      "scripts/verify-route-iq-private-paid-customer-production-browser-acceptance.mjs"
    && equal(contract?.browserAcceptance?.viewports, ["1440x900", "390x844"])
    && equal(contract?.browserAcceptance?.allowedMethods, ["GET", "HEAD", "OPTIONS"])
    && contract?.browserAcceptance?.writeAttemptsRequired === 0
    && contract?.browserAcceptance?.serviceWorkerPersistenceAllowed === false
    && contract?.browserAcceptance?.configuredOrSafeEmptyStateRequired === true
    && contract?.browserAcceptance?.exactPrivateWorkerVersionRequired === true
    && contract?.browserAcceptance?.publicWorkerIdentityFencedBeforeAndAfter === true
    && contract?.browserAcceptance?.credentialValuesInOutputAllowed === false
    && equal(contract?.browserAcceptance?.healthFailureClassification?.closedVocabulary, [
      "DESKTOP_CONSOLE_ERROR",
      "DESKTOP_RUNTIME_EXCEPTION",
      "DESKTOP_NETWORK_FAILURE",
      "DESKTOP_NETWORK_HTTP_FAILURE",
      "DESKTOP_EXTERNAL_REQUEST",
      "MOBILE_CONSOLE_ERROR",
      "MOBILE_RUNTIME_EXCEPTION",
      "MOBILE_NETWORK_FAILURE",
      "MOBILE_NETWORK_HTTP_FAILURE",
      "MOBILE_EXTERNAL_REQUEST"
    ])
    && contract?.browserAcceptance?.healthFailureClassification?.viewportEncoded === true
    && contract?.browserAcceptance?.healthFailureClassification
      ?.allMatchingDimensionsReported === true
    && contract?.browserAcceptance?.healthFailureClassification
      ?.safeDiagnosticCategoriesReported === true
    && contract?.browserAcceptance?.healthFailureClassification
      ?.guardedServiceWorkerNetworkLogRequiresExactCorrelatedBlock === true
    && contract?.browserAcceptance?.healthFailureClassification
      ?.arbitraryMessagesAllowed === false
    && contract?.browserAcceptance?.healthFailureClassification
      ?.sensitiveValuesAllowed === false
    && equal(contract?.runtimeGuardInjection?.plainTextSettings, [
      "PROMETHEUS_UNATTENDED_SMOKE_GUARD",
      "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_TEAM_DOMAIN",
      "PROMETHEUS_UNATTENDED_SMOKE_ACCESS_AUDIENCE",
      "PROMETHEUS_UNATTENDED_SMOKE_SERVICE_TOKEN_CLIENT_ID"
    ])
    && contract?.runtimeGuardInjection?.temporaryDirectoryMode === "0700"
    && contract?.runtimeGuardInjection?.temporaryConfigMode === "0600"
    && contract?.runtimeGuardInjection?.cleanupRequiredInFinally === true
    && contract?.runtimeGuardInjection?.wranglerScratch?.directoryMode === "0700"
    && contract?.runtimeGuardInjection?.wranglerScratch?.outdirsDistinct === true
    && contract?.runtimeGuardInjection?.wranglerScratch?.outdirsUserControlled === false
    && contract?.runtimeGuardInjection?.wranglerScratch
      ?.outdirFlagRequiredForEveryPhase === true
    && contract?.runtimeGuardInjection?.wranglerScratch
      ?.guardedRootMutationAllowed === false
    && contract?.runtimeGuardInjection?.wranglerScratch
      ?.dotWranglerAllowlistedInGuardedRoots === false
    && contract?.smoke?.writeMethodsAllowed === false
    && contract?.smoke?.attemptedApplicationWritesRequired === 0
    && contract?.smoke?.redirectsAllowed === false
    && contract?.releaseBoundary?.deploymentAuthorized === false
    && contract?.releaseBoundary?.productionContactAuthorized === false,
  "Private Workflow v2 Infrastructure contract drifted.");
  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

function verifyOwnerHistory(governance) {
  for (const commit of [historicalOwnerCommit, historicalOwnerRepairCommit]) {
    execFileSync("/usr/bin/git", ["merge-base", "--is-ancestor", commit, "HEAD"], {
      cwd: root,
      stdio: "ignore"
    });
  }
  const historicalOwnerMetadata = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    historicalOwnerCommit
  ]).split("\n");
  if (!equal(historicalOwnerMetadata, [
    historicalOwnerCommit,
    historicalReleaseBase,
    historicalOwnerTree,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "infrastructure: add Founder-triggered private worker deployment"
  ])) throw new Error("Historical Infrastructure owner provenance drifted.");
  const historicalRepairMetadata = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    historicalOwnerRepairCommit
  ]).split("\n");
  if (!equal(historicalRepairMetadata, [
    historicalOwnerRepairCommit,
    historicalOwnerCommit,
    historicalOwnerRepairTree,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "infrastructure: repair private worker deployment invariants"
  ])) throw new Error("Historical Infrastructure repair provenance drifted.");
  const metadata = git([
    "show", "-s", "--format=%H%n%T%n%P%n%an <%ae>%n%cn <%ce>%n%s",
    compatibilityOwnerCommit
  ]).split("\n");
  if (!equal(metadata, [
    compatibilityOwnerCommit,
    compatibilityOwnerTree,
    compatibilityParent,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "infrastructure: require Founder-authenticated deployment dispatch"
  ])) throw new Error("Infrastructure compatibility commit provenance drifted.");
  const changed = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", compatibilityOwnerCommit
  ]).split("\n").filter(Boolean);
  if (!equal(changed, compatibilityChangedPaths)) {
    throw new Error("Infrastructure compatibility file set drifted.");
  }
  if (changed.some(path => path.startsWith("overwatch/") || path === "package.json")) {
    throw new Error("Infrastructure crossed the Overwatch ownership boundary.");
  }

  for (const [path, expected] of Object.entries(historicalOwnerHashes)) {
    const historical = execFileSync("/usr/bin/git", [
      "show", `${historicalOwnerRepairCommit}:${path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
    if (sha256(historical) !== expected) {
      throw new Error(`Historical owner evidence drifted: ${path}`);
    }
  }
  const currentEvidence = new Map(
    governance.compatibilitySuccessor.ownerEvidence.map(item => [item.path, item.sha256])
  );
  for (const [path, expected] of Object.entries(compatibilityOwnerHashes)) {
    if (sha256(readFileSync(resolve(root, path))) !== expected
      || currentEvidence.get(path) !== expected) {
      throw new Error(`Compatibility owner evidence drifted: ${path}`);
    }
  }
}

function verifyV2OwnerAndGovernance() {
  const governance = readJson(governanceV2Path);
  const contract = readJson(contractV2Path);
  const evaluation = evaluateGithubActionsPrivateWorkerV2Governance({
    governance,
    contract
  });
  if (!evaluation.ok) throw new Error(evaluation.failures.join("\n"));

  const metadata = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    v2OwnerCommit
  ]).split("\n");
  if (!equal(metadata, [
    v2OwnerCommit,
    v2OwnerParent,
    v2OwnerTree,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Add immutable private Worker deployment workflow v2"
  ])) throw new Error("Private Workflow v2 Infrastructure provenance drifted.");

  const repairMetadata = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    v2OwnerRepairCommit
  ]).split("\n");
  if (!equal(repairMetadata, [
    v2OwnerRepairCommit,
    v2OwnerCommit,
    v2OwnerRepairTree,
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Prometheus Infrastructure <infrastructure@prometheus.local>",
    "Repair private workflow secret-scan fixture"
  ])) throw new Error("Private Workflow v2 Infrastructure repair provenance drifted.");
  const repairPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", v2OwnerRepairCommit
  ]).split("\n").filter(Boolean);
  if (!equal(repairPaths, ["tests/github-actions-private-worker-workflow-v2.test.mjs"])) {
    throw new Error("Private Workflow v2 Infrastructure repair path set drifted.");
  }

  const changed = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", v2OwnerCommit
  ]).split("\n").filter(Boolean);
  if (!equal(changed, Object.keys(v2OwnerHashes))) {
    throw new Error("Private Workflow v2 Infrastructure path set drifted.");
  }
  if (changed.some(path => path.startsWith("overwatch/") || path === "package.json")) {
    throw new Error("Private Workflow v2 Infrastructure crossed the Overwatch boundary.");
  }

  const historicalRecorded = new Map(
    governance.ownership.ownerEvidence.map(item => [item.path, item.sha256])
  );
  for (const [path, expected] of Object.entries(v2OwnerHashes)) {
    const historical = execFileSync("/usr/bin/git", [
      "show", `${v2OwnerRepairCommit}:${path}`
    ], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (sha256(historical) !== expected
      || historicalRecorded.get(path) !== expected) {
      throw new Error(`Private Workflow v2 owner evidence drifted: ${path}`);
    }
  }

  const bootstrapMetadata = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    v2BootstrapRepairCommit
  ]).split("\n");
  if (!equal(bootstrapMetadata, [
    v2BootstrapRepairCommit,
    v2BootstrapRepairParent,
    v2BootstrapRepairTree,
    infrastructureIdentity,
    infrastructureIdentity,
    "infrastructure: repair private deployment bootstrap guard"
  ])) throw new Error("Private Workflow v2 bootstrap repair provenance drifted.");

  const bootstrapPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", v2BootstrapRepairCommit
  ]).split("\n").filter(Boolean);
  if (!equal(bootstrapPaths, Object.keys(v2BootstrapRepairHashes))) {
    throw new Error("Private Workflow v2 bootstrap repair path set drifted.");
  }
  if (bootstrapPaths.some(path => path.startsWith("overwatch/")
    || path === "package.json")) {
    throw new Error("Private Workflow v2 bootstrap repair crossed the Overwatch boundary.");
  }

  const bootstrapRecorded = new Map(
    governance.ownership.bootstrapRepairEvidence
      .map(item => [item.path, item.sha256])
  );
  for (const [path, expected] of Object.entries(v2BootstrapRepairHashes)) {
    const committed = execFileSync("/usr/bin/git", [
      "show", `${v2BootstrapRepairCommit}:${path}`
    ], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (sha256(committed) !== expected
      || bootstrapRecorded.get(path) !== expected) {
      throw new Error(`Private Workflow v2 bootstrap evidence drifted: ${path}`);
    }
  }

  const runnerWorkspaceMetadata = git([
    "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
    v2RunnerWorkspaceRepairCommit
  ]).split("\n");
  if (!equal(runnerWorkspaceMetadata, [
    v2RunnerWorkspaceRepairCommit,
    v2RunnerWorkspaceRepairParent,
    v2RunnerWorkspaceRepairTree,
    infrastructureIdentity,
    infrastructureIdentity,
    "Repair private runner runtime workspace"
  ])) throw new Error("Private Workflow v2 runner-workspace repair provenance drifted.");

  const runnerWorkspacePaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r",
    v2RunnerWorkspaceRepairCommit
  ]).split("\n").filter(Boolean);
  if (!equal(runnerWorkspacePaths, Object.keys(v2RunnerWorkspaceRepairHashes))) {
    throw new Error("Private Workflow v2 runner-workspace repair path set drifted.");
  }
  if (runnerWorkspacePaths.some(path => path.startsWith("overwatch/")
    || path === "package.json")) {
    throw new Error(
      "Private Workflow v2 runner-workspace repair crossed the Overwatch boundary."
    );
  }

  const runnerWorkspaceRecorded = new Map(
    governance.ownership.runnerWorkspaceRepairEvidence
      .map(item => [item.path, item.sha256])
  );
  for (const [path, expected] of Object.entries(v2RunnerWorkspaceRepairHashes)) {
    const committed = execFileSync("/usr/bin/git", [
      "show", `${v2RunnerWorkspaceRepairCommit}:${path}`
    ], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (sha256(committed) !== expected
      || runnerWorkspaceRecorded.get(path) !== expected) {
      throw new Error(`Private Workflow v2 runner-workspace evidence drifted: ${path}`);
    }
  }

  for (const successor of [
    {
      label: "trusted-temp-alias",
      commit: v2TrustedTempAliasRepairCommit,
      parent: v2TrustedTempAliasRepairParent,
      tree: v2TrustedTempAliasRepairTree,
      subject: "Repair private runner temp alias handling",
      hashes: v2TrustedTempAliasRepairHashes,
      recorded: governance.ownership.trustedTempAliasRepairEvidence
    },
    {
      label: "Wrangler-scratch isolation",
      commit: v2WranglerScratchIsolationCommit,
      parent: v2TrustedTempAliasRepairCommit,
      tree: v2WranglerScratchIsolationTree,
      subject: "Isolate private Wrangler runtime scratch",
      hashes: v2WranglerScratchIsolationHashes,
      recorded: governance.ownership.wranglerScratchIsolationEvidence
    },
    {
      label: "Node-24 cleanup",
      commit: v2Node24CleanupRepairCommit,
      parent: v2Node24CleanupRepairParent,
      tree: v2Node24CleanupRepairTree,
      subject: "Repair private Workflow v2 Node 24 cleanup",
      hashes: v2Node24CleanupRepairHashes,
      recorded: governance.ownership.node24CleanupRepairEvidence
    },
    {
      label: "canonical smoke",
      commit: v2CanonicalSmokeRepairCommit,
      parent: v2CanonicalSmokeRepairParent,
      tree: v2CanonicalSmokeRepairTree,
      subject: "Repair private smoke canonical asset path",
      hashes: v2CanonicalSmokeRepairHashes,
      recorded: governance.ownership.canonicalSmokeRepairEvidence
    },
    {
      label: "public-bundle preservation",
      commit: v2PublicBundlePreservationCommit,
      parent: v2PublicBundlePreservationParent,
      tree: v2PublicBundlePreservationTree,
      subject: "Preserve public bundle in canonical smoke repair",
      hashes: v2PublicBundlePreservationHashes,
      recorded: governance.ownership.publicBundlePreservationEvidence
    },
    {
      label: "canonical-client isolation",
      commit: v2CanonicalClientIsolationCommit,
      parent: v2PublicBundlePreservationCommit,
      tree: v2CanonicalClientIsolationTree,
      subject: "Isolate canonical smoke client plan",
      hashes: v2CanonicalClientIsolationHashes,
      recorded: governance.ownership.canonicalClientIsolationEvidence
    },
    {
      label: "payload continuity",
      commit: v2PayloadContinuityCommit,
      parent: v2CanonicalClientIsolationCommit,
      tree: v2PayloadContinuityTree,
      subject: "Restore private payload continuity after smoke isolation",
      hashes: v2PayloadContinuityHashes,
      recorded: governance.ownership.payloadContinuityEvidence
    },
    {
      label: "release propagation",
      commit: v2ReleasePropagationRepairCommit,
      parent: v2ReleasePropagationRepairParent,
      tree: v2ReleasePropagationRepairTree,
      subject: "Harden private release propagation verification",
      hashes: v2ReleasePropagationRepairHashes,
      recorded: governance.ownership.releasePropagationRepairEvidence
    },
    {
      label: "rollback-root guard",
      commit: v2RollbackRootGuardRepairCommit,
      parent: v2RollbackRootGuardRepairParent,
      tree: v2RollbackRootGuardRepairTree,
      subject: "Route rollback root through smoke guard",
      hashes: v2RollbackRootGuardRepairHashes,
      recorded: governance.ownership.rollbackRootGuardRepairEvidence
    },
    {
      label: "guard convergence",
      commit: v2GuardConvergenceRepairCommit,
      parent: v2GuardConvergenceRepairParent,
      tree: v2GuardConvergenceRepairTree,
      subject: "Harden private Worker guard convergence",
      hashes: v2GuardConvergenceRepairHashes,
      recorded: governance.ownership.guardConvergenceRepairEvidence
    },
    {
      label: "forward-payload pin correction",
      commit: v2ForwardPayloadPinCorrectionCommit,
      parent: v2ForwardPayloadPinCorrectionParent,
      tree: v2ForwardPayloadPinCorrectionTree,
      subject: "Correct private forward payload identity",
      hashes: v2ForwardPayloadPinCorrectionHashes,
      recorded: governance.ownership.forwardPayloadPinCorrectionEvidence
    },
    {
      label: "unconditional guard routing",
      commit: v2UnconditionalGuardRoutingCommit,
      parent: v2UnconditionalGuardRoutingParent,
      tree: v2UnconditionalGuardRoutingTree,
      subject: "Enforce unconditional private Worker guard routing",
      hashes: v2UnconditionalGuardRoutingHashes,
      recorded: governance.ownership.unconditionalGuardRoutingEvidence
    },
    {
      label: "paid-customer browser acceptance",
      commit: v2PaidCustomerAcceptanceCommit,
      parent: v2PaidCustomerAcceptanceParent,
      tree: v2PaidCustomerAcceptanceTree,
      subject: "infrastructure: bridge paid-customer preview and acceptance",
      hashes: v2PaidCustomerAcceptanceHashes,
      recorded: governance.ownership.paidCustomerAcceptanceEvidence
    },
    {
      label: "browser-acceptance registration evidence",
      commit: v2BrowserAcceptanceRepairCommit,
      parent: v2BrowserAcceptanceRepairParent,
      tree: v2BrowserAcceptanceRepairTree,
      subject: "Repair private browser acceptance registration evidence",
      hashes: v2BrowserAcceptanceRepairHashes,
      recorded: governance.ownership.browserAcceptanceRepairEvidence
    },
    {
      label: "postdeployment smoke sequencing",
      commit: v2SmokeSequencingRepairCommit,
      parent: v2SmokeSequencingRepairParent,
      tree: v2SmokeSequencingRepairTree,
      subject: "Repair private postdeployment smoke sequencing",
      hashes: v2SmokeSequencingRepairHashes,
      recorded: governance.ownership.smokeSequencingRepairEvidence
    },
    {
      label: "postdeployment per-probe propagation",
      commit: v2ProbePropagationRepairCommit,
      parent: v2ProbePropagationRepairParent,
      tree: v2ProbePropagationRepairTree,
      subject: "Bound private smoke propagation per probe",
      hashes: v2ProbePropagationRepairHashes,
      recorded: governance.ownership.probePropagationRepairEvidence
    },
    {
      label: "browser-health diagnostics",
      commit: v2BrowserHealthDiagnosticsRepairCommit,
      parent: v2BrowserHealthDiagnosticsRepairParent,
      tree: v2BrowserHealthDiagnosticsRepairTree,
      subject: "Classify private browser health failures",
      hashes: v2BrowserHealthDiagnosticsRepairHashes,
      recorded: governance.ownership.browserHealthDiagnosticsRepairEvidence
    },
    {
      label: "browser-acceptance evidence repair",
      commit: v2BrowserAcceptanceEvidenceRepairCommit,
      parent: v2BrowserAcceptanceEvidenceRepairParent,
      tree: v2BrowserAcceptanceEvidenceRepairTree,
      subject: "Repair private browser acceptance evidence",
      hashes: v2BrowserAcceptanceEvidenceRepairHashes,
      recorded: governance.ownership.browserAcceptanceEvidenceRepairEvidence
    },
    {
      label: "service-worker guard repair",
      commit: v2ServiceWorkerGuardRepairCommit,
      parent: v2ServiceWorkerGuardRepairParent,
      tree: v2ServiceWorkerGuardRepairTree,
      subject: "Guard exact service worker acceptance request",
      hashes: v2ServiceWorkerGuardRepairHashes,
      recorded: governance.ownership.serviceWorkerGuardRepairEvidence
    },
    {
      label: "HTTP-path diagnostics repair",
      commit: v2HttpPathDiagnosticsRepairCommit,
      parent: v2HttpPathDiagnosticsRepairParent,
      tree: v2HttpPathDiagnosticsRepairTree,
      subject: "Classify private browser acceptance paths",
      hashes: v2HttpPathDiagnosticsRepairHashes,
      recorded: governance.ownership.httpPathDiagnosticsRepairEvidence
    },
    {
      label: "browser-managed icon repair",
      commit: v2BrowserManagedIconRepairCommit,
      parent: v2BrowserManagedIconRepairParent,
      tree: v2BrowserManagedIconRepairTree,
      subject: "Bridge browser-managed icon securely",
      hashes: v2BrowserManagedIconRepairHashes,
      recorded: governance.ownership.browserManagedIconRepairEvidence
    },
    {
      label: "browser-managed icon secret-scan repair",
      commit: v2BrowserManagedIconSecretScanRepairCommit,
      parent: v2BrowserManagedIconSecretScanRepairParent,
      tree: v2BrowserManagedIconSecretScanRepairTree,
      subject: "Use dynamic Access headers",
      hashes: v2BrowserManagedIconSecretScanRepairHashes,
      recorded: governance.ownership.browserManagedIconSecretScanRepairEvidence
    },
    {
      label: "browser smoke-marker propagation repair",
      commit: v2BrowserSmokeMarkerPropagationRepairCommit,
      parent: v2BrowserSmokeMarkerPropagationRepairParent,
      tree: v2BrowserSmokeMarkerPropagationRepairTree,
      subject: "Repair private browser smoke marker propagation",
      hashes: v2BrowserSmokeMarkerPropagationRepairHashes,
      recorded: governance.ownership.browserSmokeMarkerPropagationRepairEvidence
    }
  ]) {
    const metadata = git([
      "show", "-s", "--format=%H%n%P%n%T%n%an <%ae>%n%cn <%ce>%n%s",
      successor.commit
    ]).split("\n");
    if (!equal(metadata, [
      successor.commit,
      successor.parent,
      successor.tree,
      infrastructureIdentity,
      infrastructureIdentity,
      successor.subject
    ])) {
      throw new Error(`Private Workflow v2 ${successor.label} provenance drifted.`);
    }
    const paths = git([
      "diff-tree", "--no-commit-id", "--name-only", "-r", successor.commit
    ]).split("\n").filter(Boolean);
    if (!equal(paths, Object.keys(successor.hashes))) {
      throw new Error(`Private Workflow v2 ${successor.label} path set drifted.`);
    }
    if (paths.some(path => path.startsWith("overwatch/") || path === "package.json")) {
      throw new Error(
        `Private Workflow v2 ${successor.label} crossed the Overwatch boundary.`
      );
    }
    const recorded = new Map(successor.recorded.map(item => [item.path, item.sha256]));
    for (const [path, expected] of Object.entries(successor.hashes)) {
      const committed = execFileSync("/usr/bin/git", [
        "show", `${successor.commit}:${path}`
      ], {
        cwd: root,
        encoding: null,
        stdio: ["ignore", "pipe", "ignore"]
      });
      if (sha256(committed) !== expected || recorded.get(path) !== expected) {
        throw new Error(
          `Private Workflow v2 ${successor.label} evidence drifted: ${path}`
        );
      }
    }
  }

  const currentInfrastructureHashes = {
    ...v2BootstrapRepairHashes,
    ...v2RunnerWorkspaceRepairHashes,
    ...v2WranglerScratchIsolationHashes,
    ...v2Node24CleanupRepairHashes,
    ...v2CanonicalSmokeRepairHashes,
    ...v2PublicBundlePreservationHashes,
    ...v2CanonicalClientIsolationHashes,
    ...v2PayloadContinuityHashes,
    ...v2ReleasePropagationRepairHashes,
    ...v2RollbackRootGuardRepairHashes,
    ...v2GuardConvergenceRepairHashes,
    ...v2ForwardPayloadPinCorrectionHashes,
    ...v2UnconditionalGuardRoutingHashes,
    ...v2PaidCustomerAcceptanceHashes,
    ...v2BrowserAcceptanceRepairHashes,
    ...v2SmokeSequencingRepairHashes,
    ...v2ProbePropagationRepairHashes,
    ...v2BrowserHealthDiagnosticsRepairHashes,
    ...v2BrowserAcceptanceEvidenceRepairHashes,
    ...v2ServiceWorkerGuardRepairHashes,
    ...v2HttpPathDiagnosticsRepairHashes,
    ...v2BrowserManagedIconRepairHashes,
    ...v2BrowserManagedIconSecretScanRepairHashes,
    ...v2BrowserSmokeMarkerPropagationRepairHashes
  };
  for (const [path, expected] of Object.entries(currentInfrastructureHashes)) {
    if (sha256(readFileSync(resolve(root, path))) !== expected) {
      throw new Error(`Private Workflow v2 current owner evidence drifted: ${path}`);
    }
  }

  const result = verifyGithubActionsPrivateWorkerWorkflowV2();
  if (result.status !== "GITHUB_ACTIONS_PRIVATE_WORKER_WORKFLOW_V2_VERIFIED"
    || result.owner !== "Prometheus Infrastructure"
    || result.deploymentAuthorized !== false
    || result.productionRequestsPerformed !== 0) {
    throw new Error("Private Workflow v2 Infrastructure verifier failed.");
  }

  execFileSync(process.execPath, [
    "--test",
    "--test-name-pattern",
    "qualified artifact contains actual no-bundle forward payload",
    "tests/github-actions-private-worker-workflow-v2.test.mjs"
  ], {
    cwd: root,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      CI: "true",
      NO_COLOR: "1",
      WRANGLER_SEND_METRICS: "false",
      CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function statusPaths() {
  return execFileSync("/usr/bin/git", [
    "status", "--porcelain=v1", "--untracked-files=all"
  ], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trimEnd()
    .split("\n").filter(Boolean).map(line => line.slice(3));
}

function verifyOverwatchOwnership() {
  const head = git(["rev-parse", "HEAD"]);
  if (head === compatibilityOwnerCommit) {
    if (!equal([...statusPaths()].sort(), [...expectedOverwatchPaths].sort())) {
      throw new Error("Uncommitted Overwatch compatibility set drifted.");
    }
    return;
  }
  const commits = git(["rev-list", "--reverse", `${compatibilityOwnerCommit}..HEAD`])
    .split("\n").filter(Boolean);
  if (commits.length < 1) {
    throw new Error("Overwatch compatibility successor is missing.");
  }
  const successorOwnership = evaluateGithubActionsPrivateWorkerSuccessorOwnership(
    commits.map(commit => {
      const [author, committer] = git([
        "show", "-s", "--format=%an <%ae>%n%cn <%ce>", commit
      ]).split("\n");
      return {
        commit,
        author,
        committer,
        paths: git(["diff-tree", "--no-commit-id", "--name-only", "-r", commit])
          .split("\n").filter(Boolean)
      };
    })
  );
  if (!successorOwnership.ok) {
    throw new Error(successorOwnership.failures.join("\n"));
  }
  const paths = [...new Set([
    ...git(["diff", "--name-only", compatibilityOwnerCommit, "HEAD"])
      .split("\n").filter(Boolean),
    ...statusPaths()
  ])];
  const overwatchPaths = paths.filter(path => expectedOverwatchPaths.includes(path));
  if (!equal([...overwatchPaths].sort(), [...expectedOverwatchPaths].sort())) {
    throw new Error("Overwatch compatibility file set drifted.");
  }
  if (overwatchPaths.some(path => Object.hasOwn(compatibilityOwnerHashes, path)
    || path.startsWith("workers/infrastructure/")
    || path.startsWith("scripts/lib/github-actions-private-worker"))) {
    throw new Error("Overwatch modified Infrastructure implementation.");
  }
}

function verifyRegistryAndReleaseWiring() {
  const registry = readJson(registryPath);
  const artifact = registry.governanceArtifacts.find(item => item.artifactId ===
    "github-actions-founder-triggered-private-worker-deployment-governance-v1");
  const artifactV2 = registry.governanceArtifacts.find(item => item.artifactId ===
    "github-actions-private-worker-deployment-governance-v2");
  if (!artifact
    || artifact.ownerSubsystem !== "Prometheus Overwatch"
    || artifact.path !== governancePath
    || artifact.documentationPath !== governanceDocumentationPath
    || artifact.productionConsumer !== false
    || artifact.failClosedIfMissing !== true) {
    throw new Error("Canonical GitHub deployment governance registration drifted.");
  }
  if (!artifactV2
    || artifactV2.ownerSubsystem !== "Prometheus Overwatch"
    || artifactV2.path !== governanceV2Path
    || artifactV2.documentationPath !== governanceV2DocumentationPath
    || artifactV2.productionConsumer !== false
    || artifactV2.failClosedIfMissing !== true
    || !equal(artifactV2.acceptedInfrastructureSuccessor, {
      trustedTempAliasCommit: v2TrustedTempAliasRepairCommit,
      trustedTempAliasTree: v2TrustedTempAliasRepairTree,
      wranglerScratchIsolationCommit: v2WranglerScratchIsolationCommit,
      wranglerScratchIsolationTree: v2WranglerScratchIsolationTree,
      node24CleanupCommit: v2Node24CleanupRepairCommit,
      node24CleanupTree: v2Node24CleanupRepairTree,
      canonicalSmokeRepairCommit: v2CanonicalSmokeRepairCommit,
      canonicalSmokeRepairTree: v2CanonicalSmokeRepairTree,
      publicBundlePreservationCommit: v2PublicBundlePreservationCommit,
      publicBundlePreservationTree: v2PublicBundlePreservationTree,
      canonicalClientIsolationCommit: v2CanonicalClientIsolationCommit,
      canonicalClientIsolationTree: v2CanonicalClientIsolationTree,
      payloadContinuityCommit: v2PayloadContinuityCommit,
      payloadContinuityTree: v2PayloadContinuityTree,
      releasePropagationRepairCommit: v2ReleasePropagationRepairCommit,
      releasePropagationRepairTree: v2ReleasePropagationRepairTree,
      rollbackRootGuardRepairCommit: v2RollbackRootGuardRepairCommit,
      rollbackRootGuardRepairTree: v2RollbackRootGuardRepairTree,
      paidCustomerAcceptanceCommit: v2PaidCustomerAcceptanceCommit,
      paidCustomerAcceptanceTree: v2PaidCustomerAcceptanceTree,
      browserAcceptanceRepairCommit: v2BrowserAcceptanceRepairCommit,
      browserAcceptanceRepairTree: v2BrowserAcceptanceRepairTree,
      smokeSequencingRepairCommit: v2SmokeSequencingRepairCommit,
      smokeSequencingRepairTree: v2SmokeSequencingRepairTree,
      probePropagationRepairCommit: v2ProbePropagationRepairCommit,
      probePropagationRepairTree: v2ProbePropagationRepairTree,
      browserHealthDiagnosticsRepairCommit: v2BrowserHealthDiagnosticsRepairCommit,
      browserHealthDiagnosticsRepairTree: v2BrowserHealthDiagnosticsRepairTree
    })
    || artifactV2.cleanRunnerRealWranglerEvidenceRequired !== true
    || !equal(artifactV2.writeAllowed, ["Prometheus Overwatch"])) {
    throw new Error("Canonical private Workflow v2 governance registration drifted.");
  }
  const scripts = readJson("package.json").scripts;
  if (scripts["infrastructure:github-private-worker-deployment:check"] !==
    "node scripts/verify-github-actions-private-worker-deployment.mjs && node --test tests/github-actions-private-worker-deployment.test.mjs"
    || scripts["overwatch:github-private-worker-deployment:check"] !==
      "node scripts/verify-overwatch-github-actions-private-worker-deployment.mjs && node --test tests/overwatch-github-actions-private-worker-deployment.test.mjs"
    || !scripts.test.includes("npm run infrastructure:github-private-worker-deployment:check")
    || !scripts.test.includes("npm run overwatch:github-private-worker-deployment:check")
    || !scripts["test:overwatch"].includes(
      "tests/overwatch-github-actions-private-worker-deployment.test.mjs")) {
    throw new Error("Package release wiring drifted.");
  }
}

function verifyProtectedHistoricalSuccessors() {
  for (const transition of [
    ...protectedOverwatchVerifierSuccessors,
    ...protectedVerificationAssetSuccessors
  ]) {
    const previous = execFileSync("/usr/bin/git", [
      "show", `${historicalOwnerRepairCommit}:${transition.path}`
    ], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    const acceptedSuccessor = execFileSync("/usr/bin/git", [
      "show", `${compatibilityParent}:${transition.path}`
    ], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (sha256(previous) !== transition.previousSha256
      || sha256(acceptedSuccessor) !== transition.successorSha256
      || transition.owner !== "Prometheus Overwatch") {
      throw new Error(`Protected historical successor drifted: ${transition.path}`);
    }
  }
}

export function verifyOverwatchGithubActionsPrivateWorkerDeployment() {
  const governance = readJson(governancePath);
  const historicalReport = readJson(historicalReportPath);
  const report = readJson(compatibilityReportPath);
  const contract = readJson(contractPath);
  const evaluation = evaluateGithubActionsPrivateWorkerDeploymentGovernance({
    governance,
    report,
    contract
  });
  if (!evaluation.ok) throw new Error(evaluation.failures.join("\n"));
  if (historicalReport.batchId !== "BATCH-20260715-010"
    || historicalReport.status !==
      "ENGINEERING_SOURCE_PASS_SETUP_REQUIRED_NOT_DEPLOYED"
    || historicalReport.owners.implementation !== "Prometheus Infrastructure"
    || historicalReport.owners.verification !== "Prometheus Overwatch"
    || !equal(historicalReport.owners.implementationCommits, [
      historicalOwnerCommit,
      historicalOwnerRepairCommit
    ])
    || historicalReport.owners.ownershipRespected !== true
    || historicalReport.startingState.blockedLocalHead !==
      "48345d5e40d5f70ec1d1dfb4bf5eed4d337f7d23"
    || historicalReport.startingState.releaseBase !== historicalReleaseBase
    || historicalReport.startingState.sixDiagnosticFilesPreservedByInfrastructure !== true
    || historicalReport.startingState.blockedChainIncludedInRelease !== false
    || historicalReport.independentFindingsAndRepairs.length !== 2
    || !historicalReport.independentFindingsAndRepairs.every(item =>
      item.status === "CLOSED")
    || historicalReport.boundaries.deployment !==
      "NOT_PERFORMED_NOT_AUTHORIZED_BY_THIS_BATCH"
    || historicalReport.boundaries.accessPolicyMutation !== false
    || historicalReport.boundaries.githubEnvironmentMutation !== false
    || historicalReport.boundaries.githubSecretEntry !== false
    || historicalReport.boundaries.keychainValueRead !== false
    || historicalReport.boundaries.prospectiveCollection !== "OFF"
    || historicalReport.boundaries.activeCohorts !== 0
    || historicalReport.boundaries.recommendationInfluence !== "OFF"
    || historicalReport.setupReadiness.workflowSourceReady !== true
    || historicalReport.setupReadiness.firstDeploymentReady !== false
    || historicalReport.release.deploymentStatus !== "NOT_AUTHORIZED") {
    throw new Error("Historical BATCH-010 report drifted.");
  }
  const workflowEvaluation = evaluateGithubActionsPrivateWorkerWorkflow(read(workflowPath));
  if (!workflowEvaluation.ok) throw new Error(workflowEvaluation.failures.join("\n"));

  verifyOwnerHistory(governance);
  verifyOverwatchOwnership();
  verifyRegistryAndReleaseWiring();
  verifyProtectedHistoricalSuccessors();
  verifyV2OwnerAndGovernance();
  const ownerResult = verifyGithubActionsPrivateWorkerDeployment();
  if (ownerResult.status !== "passed"
    || ownerResult.batchId !== "BATCH-20260715-011"
    || ownerResult.owner !== "Prometheus Infrastructure"
    || ownerResult.privateWorker !== "prometheus-iq"
    || ownerResult.publicWorkerDeploymentAllowed !== false
    || ownerResult.networkRequestsPerformed !== 0
    || ownerResult.productionMutationPerformed !== false) {
    throw new Error("Infrastructure owner verifier failed.");
  }

  const smokePlan = fixedCloudflareUnattendedSmokePlan();
  if (smokePlan.length === 0 || smokePlan.some(request => (
    !["GET", "HEAD"].includes(request.method)
    || request.redirect !== "manual"
    || request.credentials !== "omit"
    || request.body !== false
  ))) throw new Error("Fixed smoke plan is not default-deny read-only.");

  const scanPaths = [...new Set([...listTrackedFiles(root), ...expectedOverwatchPaths])];
  if (scanTrackedRepository({
    root,
    trackedFiles: scanPaths,
    readFile: path => readFileSync(resolve(root, path))
  }).length !== 0) throw new Error("Tracked secret scan failed.");
  if (verifyLocalSecretArtifacts({ root }).length !== 0) {
    throw new Error("Local secret artifact boundary failed.");
  }

  return Object.freeze({
    status: "passed",
    batchId: "BATCH-20260715-011",
    implementationOwner: "Prometheus Infrastructure",
    verificationOwner: "Prometheus Overwatch",
    implementationCommit: compatibilityOwnerCommit,
    founderActor,
    founderTriggeringActor: founderActor,
    workflowBranch: "main",
    workflowTrigger: "workflow_dispatch",
    rerunAllowed: false,
    privateWorker: "prometheus-iq",
    publicWorkerDeploymentAllowed: false,
    protectedEnvironment: "prometheus-private-worker-production",
    smokeMethods: ["GET", "HEAD"],
    writeAttemptsAllowed: 0,
    deploymentPerformed: false,
    productionMutationPerformed: false,
    prospectiveCollection: "OFF",
    activeCohorts: 0,
    recommendationInfluence: "OFF",
    firstDeploymentReady: false,
    immutableWorkflowV2SourceGoverned: true,
    immutableWorkflowV2QualificationPending: true,
    immutableWorkflowV2DeploymentReady: true,
    immutableWorkflowV2BootstrapRepairCommit: v2BootstrapRepairCommit,
    immutableWorkflowV2RunnerWorkspaceRepairCommit: v2RunnerWorkspaceRepairCommit,
    immutableWorkflowV2TrustedTempAliasRepairCommit: v2TrustedTempAliasRepairCommit,
    immutableWorkflowV2WranglerScratchIsolationCommit:
      v2WranglerScratchIsolationCommit,
    immutableWorkflowV2Node24CleanupRepairCommit: v2Node24CleanupRepairCommit,
    immutableWorkflowV2CanonicalSmokeRepairCommit: v2CanonicalSmokeRepairCommit,
    immutableWorkflowV2PublicBundlePreservationCommit:
      v2PublicBundlePreservationCommit,
    immutableWorkflowV2CanonicalClientIsolationCommit:
      v2CanonicalClientIsolationCommit,
    immutableWorkflowV2PayloadContinuityCommit: v2PayloadContinuityCommit,
    immutableWorkflowV2ReleasePropagationRepairCommit:
      v2ReleasePropagationRepairCommit,
    immutableWorkflowV2RollbackRootGuardRepairCommit:
      v2RollbackRootGuardRepairCommit,
    immutableWorkflowV2GuardConvergenceRepairCommit:
      v2GuardConvergenceRepairCommit,
    immutableWorkflowV2ForwardPayloadPinCorrectionCommit:
      v2ForwardPayloadPinCorrectionCommit,
    immutableWorkflowV2UnconditionalGuardRoutingCommit:
      v2UnconditionalGuardRoutingCommit,
    immutableWorkflowV2PaidCustomerAcceptanceCommit:
      v2PaidCustomerAcceptanceCommit,
    immutableWorkflowV2BrowserAcceptanceRepairCommit:
      v2BrowserAcceptanceRepairCommit,
    immutableWorkflowV2SmokeSequencingRepairCommit:
      v2SmokeSequencingRepairCommit,
    immutableWorkflowV2ProbePropagationRepairCommit:
      v2ProbePropagationRepairCommit,
    immutableWorkflowV2BrowserHealthDiagnosticsRepairCommit:
      v2BrowserHealthDiagnosticsRepairCommit,
    immutableWorkflowV2BrowserAcceptanceEvidenceRepairCommit:
      v2BrowserAcceptanceEvidenceRepairCommit,
    immutableWorkflowV2ServiceWorkerGuardRepairCommit:
      v2ServiceWorkerGuardRepairCommit,
    immutableWorkflowV2HttpPathDiagnosticsRepairCommit:
      v2HttpPathDiagnosticsRepairCommit,
    immutableWorkflowV2BrowserManagedIconRepairCommit:
      v2BrowserManagedIconRepairCommit,
    immutableWorkflowV2BrowserManagedIconSecretScanRepairCommit:
      v2BrowserManagedIconSecretScanRepairCommit,
    immutableWorkflowV2BrowserSmokeMarkerPropagationRepairCommit:
      v2BrowserSmokeMarkerPropagationRepairCommit,
    localRealWranglerDryRunPassed: true,
    cleanRunnerRealWranglerEvidencePending: true,
    protectedEnvironmentRequiredNamesPresent: true,
    failedDeploymentRunReachedProductionMutation: true,
    failedDeploymentRunRollbackVerified: true,
    runnerWorkspaceFailureReachedProductionMutation: false,
    wranglerScratchFailureReachedProductionMutation: false
  });
}

if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(
    verifyOverwatchGithubActionsPrivateWorkerDeployment(),
    null,
    2
  ));
}
