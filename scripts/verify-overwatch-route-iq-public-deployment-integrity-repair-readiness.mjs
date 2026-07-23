#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPublicForwardRollbackArtifact } from "./lib/route-iq-public-forward-rollback.mjs";
import { verifyOverwatchRevised3dReleaseReadinessSuccessor } from "./verify-overwatch-route-iq-revised-3d-release-readiness-successor.mjs";
import { verifyRouteIqPublicDeploymentAssets } from "./verify-route-iq-public-deployment-assets.mjs";
import {
  INFRASTRUCTURE_OWNER_BOUNDARY,
  verifyInfrastructureOwnerBoundary
} from "./verify-route-iq-public-repository-integrity-repair.mjs";

export const PUBLIC_INTEGRITY_READINESS_PATH =
  "overwatch/governance/route-iq-public-deployment-integrity-repair-readiness-v1.json";
const AUGUST1_READINESS_REPORT_PATH =
  "overwatch/governance/route-iq-august-1-launch-closeout-v1.json";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const HISTORICAL_SUCCESSOR_PATH =
  "overwatch/governance/route-iq-revised-3d-release-readiness-successor-v1.json";
const INFRASTRUCTURE_CONTRACT_PATH =
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json";
const DEPLOYMENT_INFRASTRUCTURE_CONTRACT_PATH =
  "workers/infrastructure/github-actions-founder-triggered-public-worker-deployment-v1.json";
const ROLLBACK_CONTRACT_PATH = "workers/infrastructure/route-iq-public-forward-rollback-v1.json";
const HISTORICAL_SUCCESSOR_SHA256 = "aea011a5633a3d666f7bc402d6d7cfa38884833c1ce4ca3d6a6cdc84c4d27f75";
const INFRASTRUCTURE_CONTRACT_SHA256 = "76c56b86ff9c8a16ae585d3e3dd30a213e199dc937c678cd7aaeefb26e6924fc";
const PRE_WORKFLOW_V2_FIXTURE_REPAIR_INFRASTRUCTURE_CONTRACT_SHA256 =
  "6bdfc39aad8907eb5ee1214c00a57f378bfd19e91c43d06504c5107ba345d22e";
const PRE_FOUNDER_JWT_REPAIR_INFRASTRUCTURE_CONTRACT_SHA256 =
  "6785485920b689a781d19aeefd329e235b78367c905fa3c007f312ffe6802a1e";
const PRE_AUTHORIZATION_BOUNDARY_INFRASTRUCTURE_CONTRACT_SHA256 =
  "3a36629b5aed90238e8b8257dbb3ec9820d74f4f3c40fce94248e349afd22b4e";
const PRE_WORKFLOW_V2_ADMISSION_INFRASTRUCTURE_CONTRACT_SHA256 =
  "09ffc8c9d631b0002bc84ae372924f3e75a677e65b85806d50d0c48c21f56b27";
const PRE_CRM_ADMISSION_INFRASTRUCTURE_CONTRACT_SHA256 =
  "6a2ad13f9bcb6010862559a1ed5ebf851e9c571cd8c3218cc580b3fb8bc092b5";
const PUBLIC_WORKER_STARTUP_INFRASTRUCTURE_CONTRACT_SHA256 =
  "d74d6105a91eb1b5b81c7158c1e5a53bd137bd444c2bd6389e7e97e610165fc0";
const CLOUDFLARE_READ_INFRASTRUCTURE_CONTRACT_SHA256 =
  "dcf724bac263447b38b3db1b5356f9e6a94871dc299a15ca767b1ba8385dbc80";
const DEPLOYMENT_INFRASTRUCTURE_CONTRACT_SHA256 =
  "66875cbc292f9d0fcf9f2fd0cd29625e4b2d8ecb5854b931da876cd3ca770912";
const WRANGLER_DIAGNOSTIC_INFRASTRUCTURE_CONTRACT_SHA256 =
  "859ab8fb8d9188d762f4ab66ff901a75c1d9ccde052bec732d8cd3c1d79c44b5";
const WRANGLER_DIAGNOSTIC_DEPLOYMENT_CONTRACT_SHA256 =
  "dab4aea1760e84434a62b485561ad47b444bafc2bc8cf27c8b4054deef046e61";
const CLOUDFLARE_READ_DEPLOYMENT_INFRASTRUCTURE_CONTRACT_SHA256 =
  "6db577e033e65969f412583a3f40459c59115fcb13eaf45fd5cfa9c9c8b99612";
const PRE_ASSET_ORDERING_INFRASTRUCTURE_CONTRACT_SHA256 =
  "408c38b30b1a8374d51521a197fd9c600b0bc69e93d8fba0e3f1a0f7bda94015";
const SAFE_NO_SECRET_ASSET_ORDERING_INFRASTRUCTURE_CONTRACT_SHA256 =
  "720458551a9383d7705b6a03f58e938072a61aae22ef3a55cb0c6eea867226b9";
const ROLLBACK_CONTRACT_SHA256 = "26e1eab16fa5aed2295d025d6146e01744f1ef37ad8f8eb05afb2ab921d7916f";
const DEPLOYMENT_ASSETS_SHA256 = "5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15";
const ROLLBACK_BUNDLE_SHA256 = "88bee90a9ff1fafe064598c5db27b59ca78606dc8938fb0dcfeea96fa4eb5863";
const CURRENT_INFRASTRUCTURE_CONTRACT_SHA256 =
  "0582bc185ccf6f5e0825de25ce5fef8c65240fb0ee3b68c22bc5ba14865350c5";
const CURRENT_ROLLBACK_CONTRACT_SHA256 =
  "b7be296f51db1b8e8a305a068ebc1b0aa7652813de7b5378b96ac292af8af012";
const CURRENT_DEPLOYMENT_ASSETS_SHA256 =
  "48d3b6b44b49366f3387dfc3e37d8e34d83abf5ea8bb0606b0070851802ff6a1";
const CURRENT_ROLLBACK_BUNDLE_SHA256 =
  "012552cf90827482c7f1309f50e492304d9094e1c53f0c7ee6b44a5e0c4e9fbe";
const PRE_FOUNDER_JWT_REPAIR_ROLLBACK_CONTRACT_SHA256 =
  "a1baf16aeb970c5b9c434e333781e98c968692b80be07004295333c5741bf1e2";
const PRE_FOUNDER_JWT_REPAIR_ROLLBACK_BUNDLE_SHA256 =
  "b0eae685ddefb99680bd60f074b58ae7514c467f6ce95d069e35dc450db2d76a";
const HISTORICAL_ROLLBACK_CONTRACT_SHA256 =
  "150d24acaeee5f1f6589bb92582fc701e7480cca22d5bd136ce0f27af4fc220b";
const HISTORICAL_ROLLBACK_BUNDLE_SHA256 =
  "3c1991905657516653ee74ef0ac59f711b21f95df06bf490be5f370479ba7ff7";
const HISTORICAL_SUCCESSOR_COMMIT = "d5174c50ee7b02f930b5fa1f50723ce9db3e447d";
const HISTORICAL_SUCCESSOR_TREE = "f86156dc10fb90cedc00274d3654e89edfff562a";
const INFRASTRUCTURE_COMMITS = Object.freeze([
  Object.freeze({
    commit: "a2bcfedcd996e4d6d22adc26d20bd77a39e763e7",
    tree: "8b5202428cfdb6a3586bdc90f39cce4d3ea02e97",
    parent: HISTORICAL_SUCCESSOR_COMMIT,
    subject: "infrastructure: repair public repository integrity diagnostics",
    files: Object.freeze([
      ".github/workflows/deploy-prometheus-public-worker.yml",
      ".github/workflows/verify-prometheus-public-repository-integrity.yml",
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/lib/github-actions-public-worker-deployment.mjs",
      "scripts/lib/route-iq-public-forward-rollback.mjs",
      "scripts/run-github-actions-public-worker-deployment.mjs",
      "scripts/run-public-worker-repository-integrity-diagnostic.mjs",
      "scripts/verify-github-actions-public-worker-deployment.mjs",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "a2779239fc8f2d79d4b8781966d32cc23d4acbbd",
    tree: "025d3d01cae56753f9d0c5e63af5ea369a52b4ff",
    parent: "a2bcfedcd996e4d6d22adc26d20bd77a39e763e7",
    subject: "infrastructure: pin safe integrity diagnostic runtime",
    files: Object.freeze([
      ".github/workflows/verify-prometheus-public-repository-integrity.yml",
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "a23ac70a74f753486cc6ceda8eddeedfa187f5c5",
    tree: "b2b1d3058cc2002bf2f1432b8d6cd05c6a84d7a1",
    parent: "96af76e8094beafc2de455ebb5d80755c0160a2e",
    subject: "infrastructure: constrain repository integrity owner boundary",
    files: Object.freeze([
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "1363548cb72285cdd759b1dbed73fa6a8a3d1c2a",
    tree: "5cef523d23b28088bcf7b05561a4bac3784e364b",
    parent: "8d312bf747a289c675eb37adf582b43c860c635e",
    subject: "infrastructure: repair public integrity verifier portability",
    files: Object.freeze([
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/lib/route-iq-public-forward-rollback.mjs",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "a377c39f2e4c8f7f68a8f5908f133f9c24c7ac54",
    tree: "73337f6bfb2e29e62df0a98a10e928df578e14fa",
    parent: "bb1509d42cd03c19b9db0f9011579b6a041ffd9c",
    subject: "infrastructure: admit Dashboard verification successor",
    files: Object.freeze([
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "c05c92930f33ca2f50362c1ad3c35efc95a645f0",
    tree: "1e75df8788becfd8b1bfd3fa1d1505a7492e2b01",
    parent: "37f3c963174b6a26cf9685fe0919ccc3bbfd65c2",
    subject: "infrastructure: accept strict public intake Allow set",
    files: Object.freeze([
      "scripts/run-cloudflare-public-worker-smoke.mjs",
      "scripts/verify-github-actions-public-worker-deployment.mjs",
      "tests/github-actions-public-worker-deployment.test.mjs"
    ])
  }),
  Object.freeze({
    commit: "6476c381c8e9512eaea4a90e0f6019138cfe1766",
    tree: "16918f0b77ae5ac7d1697b8f324d77e90b0ae50f",
    parent: "c05c92930f33ca2f50362c1ad3c35efc95a645f0",
    subject: "infrastructure: validate intake Allow by probe method",
    files: Object.freeze([
      "scripts/run-cloudflare-public-worker-smoke.mjs",
      "scripts/verify-github-actions-public-worker-deployment.mjs",
      "tests/github-actions-public-worker-deployment.test.mjs"
    ])
  }),
  Object.freeze({
    commit: "c0c35e83901aad5b8f4108a2a6b09b6210cb5243",
    tree: "10ed7ef01d3118c5cd13ad57a767d234c7d0f365",
    parent: "6476c381c8e9512eaea4a90e0f6019138cfe1766",
    subject: "infrastructure: admit public intake smoke successors",
    files: Object.freeze([
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "2595702c5c30ec269aee2694a81ea223fb2903e6",
    tree: "926a4421088fab0071eaba943bae544be2877178",
    parent: "1e4e9be843fe418ae8920ccb109b4259fda5455c",
    subject: "infrastructure: generate public assets before verification",
    files: Object.freeze([
      ".github/workflows/deploy-prometheus-public-worker.yml",
      "docs/github-actions-founder-triggered-public-worker-deployment-v1.md",
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/lib/github-actions-public-worker-deployment.mjs",
      "scripts/verify-github-actions-public-worker-deployment.mjs",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/github-actions-public-worker-deployment.test.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      "workers/infrastructure/github-actions-founder-triggered-public-worker-deployment-v1.json",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "13d221509c95515bb9a3dcc44326bf3393fff89e",
    tree: "9bf6128afaa0e08976b32ec04c30b116208565ed",
    parent: "577b9217185be2324824c5c4eeeaf6cd89300477",
    subject: "infrastructure: adopt Dashboard runtime harness repair",
    files: Object.freeze([
      ".github/workflows/verify-prometheus-public-repository-integrity.yml",
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "7b8ff3fdf0c9a75a6dc68ec7c47a039ec974d0d2",
    tree: "3c016deef6db8a33c86cdcd5b3eb905e443255a0",
    parent: "5d5ffe858d7e132778c96746eabd4a99afe9d1f4",
    subject: "infrastructure: order clean-runner public asset generation",
    files: Object.freeze([
      ".github/workflows/verify-prometheus-public-repository-integrity.yml",
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "e896cabe19fc696834659ed1cbe05f027c434553",
    tree: "d70f2f892755e1d9f86dd08be3d559344b5fcc66",
    parent: "5c920ad7c56289791d12c756d4b9627bf18b4632",
    subject: "infrastructure: classify Cloudflare deployment read failures",
    files: Object.freeze([
      "scripts/lib/github-actions-public-worker-deployment.mjs",
      "scripts/verify-github-actions-public-worker-deployment.mjs",
      "tests/github-actions-public-worker-deployment.test.mjs",
      DEPLOYMENT_INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "f09b8c1ee6e4c0be14c41f672601e2e5854014eb",
    tree: "f62ebac98952b9cc1156a81e9bf0cec2e0563dcb",
    parent: "e896cabe19fc696834659ed1cbe05f027c434553",
    subject: "infrastructure: extend bounded Cloudflare state deadline",
    files: Object.freeze([
      "scripts/lib/github-actions-public-worker-deployment.mjs",
      "scripts/verify-github-actions-public-worker-deployment.mjs",
      "tests/github-actions-public-worker-deployment.test.mjs",
      DEPLOYMENT_INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "d8da4f23a9df80f91e8f95bf80b7075e8d2532dc",
    tree: "e609307abc4fa4a14fcf47a2b2ad5f7b070fe315",
    parent: "f09b8c1ee6e4c0be14c41f672601e2e5854014eb",
    subject: "infrastructure: admit Cloudflare deployment read repairs",
    files: Object.freeze([
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "ba4d25df97e12852982e1bbdc2b1e89ef5265da1",
    tree: "31abba310779208a7f940321adfe8916a8dd31ca",
    parent: "9a2c27da613f1222039c5a8ae583ce9f70d98056",
    subject: "infrastructure: classify Wrangler deployment failures",
    files: Object.freeze([
      "scripts/lib/github-actions-public-worker-deployment.mjs",
      "scripts/verify-github-actions-public-worker-deployment.mjs",
      "tests/github-actions-public-worker-deployment.test.mjs",
      DEPLOYMENT_INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "1cbb6aa1cadde1b4896990b3bb50d857d994071c",
    tree: "b7ee0b4df72249c5df06a81f58c70d4a805ab281",
    parent: "ba4d25df97e12852982e1bbdc2b1e89ef5265da1",
    subject: "infrastructure: admit Wrangler deployment diagnostic repair",
    files: Object.freeze([
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "94061fea1c238ca854bde9d17a860e1375af9c52",
    tree: "4a5718a96851a5eaa4e6b3fda7fa5ed6932e4ea5",
    parent: "f0593640bae9cb9517d954415ca4980226a51073",
    subject: "infrastructure: gate public Worker module startup",
    files: Object.freeze([
      ".github/workflows/deploy-prometheus-public-worker.yml",
      "docs/github-actions-founder-triggered-public-worker-deployment-v1.md",
      "scripts/lib/github-actions-public-worker-deployment.mjs",
      "scripts/lib/route-iq-public-forward-rollback.mjs",
      "scripts/run-public-worker-workerd-startup-preflight.mjs",
      "scripts/verify-github-actions-public-worker-deployment.mjs",
      "tests/github-actions-public-worker-deployment.test.mjs",
      DEPLOYMENT_INFRASTRUCTURE_CONTRACT_PATH,
      "workers/infrastructure/prometheusrouteiq-website-entry.mjs",
      ROLLBACK_CONTRACT_PATH,
      "wrangler.prometheusrouteiq-website.jsonc"
    ])
  }),
  Object.freeze({
    commit: "ce5f66f777fcfd6f59fe2b33eebb05bc836742dc",
    tree: "d080d0e7bf39a17cb7a21fe79e1b8c63b0787c25",
    parent: "94061fea1c238ca854bde9d17a860e1375af9c52",
    subject: "infrastructure: align rollback bundle with public adapter",
    files: Object.freeze([
      "scripts/lib/github-actions-public-worker-deployment.mjs",
      "scripts/lib/route-iq-public-forward-rollback.mjs",
      "scripts/verify-github-actions-public-worker-deployment.mjs",
      ROLLBACK_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "c375c02652823a5a5c19a0f166d420da15ca3330",
    tree: "cf7d9fec6d610497290e9a8cc7842f3418cc0e4b",
    parent: "ce5f66f777fcfd6f59fe2b33eebb05bc836742dc",
    subject: "infrastructure: admit public Worker startup repair chain",
    files: Object.freeze([
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "8aac9d66fa5b5d6ff191354e68a364aa142ede95",
    tree: "90dac84f6cbc891e7c3f3156aa4eaaf7c73f9ce2",
    parent: "4970dfad5ae5598551d4f1cf20bbb7e18a9a084f",
    subject: "infrastructure: align edge boundary with public entry",
    files: Object.freeze([
      "docs/route-iq-public-crm-edge-boundary-infrastructure-v1.md",
      "scripts/verify-route-iq-public-crm-edge-boundary-infrastructure.mjs",
      "tests/route-iq-public-crm-edge-boundary-infrastructure.test.mjs",
      "workers/infrastructure/route-iq-public-crm-edge-boundary-v1.json"
    ])
  }),
  Object.freeze({
    commit: "d1e1aab1163ff3206cbdcd366b65db6f9b186982",
    tree: "d533ea8bbd62a8ffdf8a46ccb86b95971819ca3f",
    parent: "8aac9d66fa5b5d6ff191354e68a364aa142ede95",
    subject: "infrastructure: admit public config entry consumer repair",
    files: Object.freeze([
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "3cf1dc03e3b9dabd02e35c81888feb2e34e0cd0a",
    tree: "11d365e61cacf66d079a0b82c8db3d7646153cd3",
    parent: "ab480ba101bc314946879af5cdb7997bd8085b4d",
    subject: "infrastructure: admit CRM public Worker adapter repair",
    files: Object.freeze([
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "30c04aca19423f448b35218491d69ecc458367c7",
    tree: "a46088a5c223ba763db7a7eb99a8aec1a47b4c11",
    parent: "07bf2eddc9707cb410ff6670efe9465ca68cd6b4",
    subject: "infrastructure: qualify immutable public releases",
    files: Object.freeze([
      ".github/workflows/deploy-prometheus-public-worker.yml",
      ".github/workflows/qualify-prometheus-public-worker.yml",
      "docs/github-actions-public-worker-deployment-v2.md",
      "scripts/lib/cloudflare-public-worker-smoke-v2.mjs",
      "scripts/lib/github-actions-public-worker-deployment.mjs",
      "scripts/lib/github-actions-public-worker-workflow-v2.mjs",
      "scripts/lib/route-iq-public-forward-rollback.mjs",
      "scripts/run-cloudflare-public-worker-smoke.mjs",
      "scripts/run-github-actions-public-worker-deployment-v2.mjs",
      "scripts/run-github-actions-public-worker-qualification.mjs",
      "scripts/verify-github-actions-public-worker-deployment.mjs",
      "scripts/verify-github-actions-public-worker-workflow-v2.mjs",
      "tests/github-actions-public-worker-deployment.test.mjs",
      "tests/github-actions-public-worker-workflow-v2.test.mjs",
      "workers/infrastructure/github-actions-public-worker-deployment-v2.json"
    ])
  }),
  Object.freeze({
    commit: "3743db6f883f44b6d1d1dd69bc1a9c79f6d8b6de",
    tree: "7cc6670f1599f32a1d7283a353495866930784fd",
    parent: "ee80a44b8a28847d4a4acfc3fae8574697661edc",
    subject: "infrastructure: admit public deployment workflow v2 chain",
    files: Object.freeze([
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "d2963aa66e304932729cf8154ab729f5d8b71113",
    tree: "b589078b7c9945eb2e12db2183788778e11e7c93",
    parent: "4d7f5d140a7f856a18b99c1ab49a37d7555d3b5a",
    subject: "infrastructure: admit deployment authorization boundary repair",
    files: Object.freeze([
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  })
]);
const FIRST_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "96af76e8094beafc2de455ebb5d80755c0160a2e",
  tree: "464118922a37710452ec85009df24007e9a4ffdf",
  parent: "a2779239fc8f2d79d4b8781966d32cc23d4acbbd",
  subject: "overwatch: record public integrity repair readiness"
});
const FIRST_OVERWATCH_SUCCESSOR_PATHS = Object.freeze([
  PUBLIC_INTEGRITY_READINESS_PATH,
  "scripts/verify-overwatch-route-iq-3d-visual-continuity.mjs",
  "scripts/verify-overwatch-route-iq-public-crm-founder-access-deployment-readiness.mjs",
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "scripts/verify-overwatch-route-iq-revised-3d-release-readiness-successor.mjs",
  "tests/overwatch-route-iq-3d-visual-continuity.test.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const SECOND_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "8d312bf747a289c675eb37adf582b43c860c635e",
  tree: "36f163193fdb91cf241ddb0ff03bce200c7506c6",
  parent: "a23ac70a74f753486cc6ceda8eddeedfa187f5c5",
  subject: "overwatch: close public integrity repair provenance"
});
const SECOND_OVERWATCH_SUCCESSOR_PATHS = Object.freeze([
  PUBLIC_INTEGRITY_READINESS_PATH,
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const THIRD_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "03ed86e25bda0a67e55757969966f4bc61c4b63e",
  tree: "f4447bf0a001aa2659c90b36838897b0780c9aec",
  parent: "1363548cb72285cdd759b1dbed73fa6a8a3d1c2a",
  subject: "overwatch: record public integrity portability successor"
});
const FOURTH_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "37f3c963174b6a26cf9685fe0919ccc3bbfd65c2",
  tree: "aa63fad16a927354f66378e47c96ea88611894a4",
  parent: "a377c39f2e4c8f7f68a8f5908f133f9c24c7ac54",
  subject: "overwatch: close public integrity verification provenance"
});
const FIFTH_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "027366403b8f0ad40b4c51ca8679703ecf2341c3",
  tree: "d37446a031638cd145c9bf87943fa9b3660c7d0c",
  parent: "c0c35e83901aad5b8f4108a2a6b09b6210cb5243",
  subject: "overwatch: record public predeployment smoke repair"
});
const SIXTH_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "1e4e9be843fe418ae8920ccb109b4259fda5455c",
  tree: "e0d86821386d2f3d348eb88ae25f85f367878280",
  parent: FIFTH_OVERWATCH_SUCCESSOR.commit,
  subject: "overwatch: repair public predeployment test pin"
});
const SEVENTH_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "bb0fe15841027a63ccbebfeeac21e5ead4d5e76c",
  tree: "abf7736785ec2640e94ed767a40b83b21cf87de5",
  parent: "2595702c5c30ec269aee2694a81ea223fb2903e6",
  subject: "overwatch: close public clean-runner provenance"
});
const EIGHTH_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "5f33e24e1e61f4866f49f96669c9c54e80cbb099",
  tree: "5b3e7b77f74500c0047d0ce61c9449a20d87d754",
  parent: "f26d35aaf612f4b89194d75fa721ce5cd3068b85",
  subject: "overwatch: close Keychain CI portability provenance"
});
const DASHBOARD_VERIFICATION_SUCCESSOR = Object.freeze({
  commit: "bb1509d42cd03c19b9db0f9011579b6a041ffd9c",
  tree: "2bd8186faafd7c922c17da9401c6dddbc64163bb",
  parent: THIRD_OVERWATCH_SUCCESSOR.commit,
  subject: "dashboard: stabilize Eventbrite expansion verification",
  files: Object.freeze([
    "scripts/verify-dashboard-runtime-workflows.mjs",
    "tests/dashboard-route-iq-product-focus.test.mjs"
  ])
});
const KEYCHAIN_CI_SUCCESSORS = Object.freeze([
  Object.freeze({
    commit: "af2d85d80a1abf332e202a1d24ca0c290d9d6a6b",
    tree: "955431d084ed6e529490e71e6432c8007217db36",
    parent: "bb0fe15841027a63ccbebfeeac21e5ead4d5e76c",
    subject: "Make Keychain owner verifier portable in CI",
    ownerEmail: "infrastructure@prometheus.local",
    files: Object.freeze([
      "scripts/verify-cloudflare-unattended-keychain-interoperability.mjs",
      "tests/cloudflare-unattended-keychain-interoperability.test.mjs"
    ])
  }),
  Object.freeze({
    commit: "06a6464035d3b8d46f308c77955a80a62ddfa957",
    tree: "23ec45072e108c932fedd29481aca78de5b71773",
    parent: "af2d85d80a1abf332e202a1d24ca0c290d9d6a6b",
    subject: "Record Keychain CI portability successor",
    ownerEmail: "overwatch@prometheus.local",
    files: Object.freeze([
      "overwatch/governance/cloudflare-unattended-keychain-interoperability-v1.json",
      "overwatch/reports/BATCH-20260715-008-cloudflare-unattended-keychain-interoperability.json",
      "scripts/verify-overwatch-cloudflare-unattended-keychain-interoperability.mjs",
      "tests/overwatch-cloudflare-unattended-keychain-interoperability.test.mjs"
    ])
  }),
  Object.freeze({
    commit: "89f6e5c0e40d759289793fb6a6f1767a6888d6c4",
    tree: "75a58d332c1a29d872fe87f44c814c8ad785cb9c",
    parent: "06a6464035d3b8d46f308c77955a80a62ddfa957",
    subject: "infrastructure: admit Keychain CI portability successor",
    ownerEmail: "infrastructure@prometheus.local",
    files: Object.freeze([
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  }),
  Object.freeze({
    commit: "f26d35aaf612f4b89194d75fa721ce5cd3068b85",
    tree: "b1d4e42822d571cfee8cae0962d84a2d9ab0f64f",
    parent: "89f6e5c0e40d759289793fb6a6f1767a6888d6c4",
    subject: "infrastructure: pin Keychain Overwatch mapping",
    ownerEmail: "infrastructure@prometheus.local",
    files: Object.freeze([
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  })
]);
const KEYCHAIN_HISTORICAL_FIXTURE_SUCCESSORS = Object.freeze([
  Object.freeze({
    commit: "a69dd6ac8785f0906d1ad91e9ca156f5250dc22e",
    tree: "459845ad3a1494ffad84471c56fe5cc152c8b11d",
    parent: EIGHTH_OVERWATCH_SUCCESSOR.commit,
    subject: "infrastructure: distinguish historical Keychain fixture successor",
    ownerEmail: "infrastructure@prometheus.local",
    files: Object.freeze([
      "scripts/verify-cloudflare-founder-attended-response-contract-repair.mjs",
      "tests/cloudflare-founder-attended-owner-verifier-ownership.test.mjs"
    ])
  }),
  Object.freeze({
    commit: "0165ffc56a18408be5c2e970223944fa1dd02593",
    tree: "e8d3d8a9031eebfa8a9ebf46666bfd6b961b9c83",
    parent: "a69dd6ac8785f0906d1ad91e9ca156f5250dc22e",
    subject: "infrastructure: report current owner verifier coverage",
    ownerEmail: "infrastructure@prometheus.local",
    files: Object.freeze([
      "scripts/verify-cloudflare-founder-attended-response-contract-repair.mjs"
    ])
  }),
  Object.freeze({
    commit: "41d9f1fa9273482261500708d7299a1997f6ec69",
    tree: "647e652e2fd152b8220cfc6e632c039dd33ea277",
    parent: "0165ffc56a18408be5c2e970223944fa1dd02593",
    subject: "overwatch: govern historical Keychain fixture repairs",
    ownerEmail: "overwatch@prometheus.local",
    files: Object.freeze([
      "overwatch/governance/cloudflare-unattended-keychain-interoperability-v1.json",
      "scripts/verify-overwatch-cloudflare-founder-attended-fresh-attempt-evidence-rotation.mjs",
      "scripts/verify-overwatch-cloudflare-unattended-keychain-interoperability.mjs",
      "tests/overwatch-cloudflare-unattended-keychain-interoperability.test.mjs"
    ])
  }),
  Object.freeze({
    commit: "12d229fb18549e42dba90b075efe70753ee22f0e",
    tree: "c23c4aaaf5a2b9f27d584f1b0a5149c73fe1fb6e",
    parent: "41d9f1fa9273482261500708d7299a1997f6ec69",
    subject: "infrastructure: admit historical Keychain fixture successors",
    ownerEmail: "infrastructure@prometheus.local",
    files: Object.freeze([
      "docs/route-iq-public-repository-integrity-repair-v1.md",
      "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
      "tests/public-repository-integrity-repair.test.mjs",
      INFRASTRUCTURE_CONTRACT_PATH
    ])
  })
]);
const FINAL_OVERWATCH_SUCCESSOR_PATHS = Object.freeze([
  PUBLIC_INTEGRITY_READINESS_PATH,
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const DASHBOARD_RUNTIME_HARNESS_SUCCESSORS = Object.freeze([
  Object.freeze({
    commit: "38339cdf24f2ccdf54f2eb204278eb80d9ad1972",
    tree: "ace6df9882d8033c5ffc08770b60a35653434e7e",
    parent: "3a2bd37f779e070b868256178bc40dbede8605c8",
    subject: "dashboard: stabilize runtime harness startup",
    files: Object.freeze([
      "scripts/verify-dashboard-runtime-workflows.mjs",
      "tests/dashboard-route-iq-product-focus.test.mjs"
    ])
  }),
  Object.freeze({
    commit: "577b9217185be2324824c5c4eeeaf6cd89300477",
    tree: "37c857d916b336b87e7f4f878d74332cc62cf329",
    parent: "38339cdf24f2ccdf54f2eb204278eb80d9ad1972",
    subject: "Harden Dashboard Chrome harness lifecycle",
    files: Object.freeze([
      "scripts/verify-dashboard-runtime-workflows.mjs",
      "tests/dashboard-route-iq-product-focus.test.mjs"
    ])
  })
]);
const HISTORICAL_KEYCHAIN_CLOSURE_SUCCESSOR = Object.freeze({
  commit: "3a2bd37f779e070b868256178bc40dbede8605c8",
  tree: "e848b3454a296487e32891ca23e12d6a0f6d3d82",
  parent: KEYCHAIN_HISTORICAL_FIXTURE_SUCCESSORS.at(-1).commit,
  subject: "overwatch: close historical Keychain fixture provenance",
  files: FINAL_OVERWATCH_SUCCESSOR_PATHS
});
const DASHBOARD_RUNTIME_HARNESS_OVERWATCH_SUBJECT =
  "overwatch: close Dashboard harness CI provenance";
const DASHBOARD_RUNTIME_HARNESS_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "5d5ffe858d7e132778c96746eabd4a99afe9d1f4",
  tree: "e0164513b6a807796558c2d7bf6c059184839659",
  parent: "13d221509c95515bb9a3dcc44326bf3393fff89e",
  subject: DASHBOARD_RUNTIME_HARNESS_OVERWATCH_SUBJECT,
  files: FINAL_OVERWATCH_SUCCESSOR_PATHS
});
const SAFE_NO_SECRET_ASSET_ORDERING_OVERWATCH_SUBJECT =
  "overwatch: close clean-runner asset ordering provenance";
const SAFE_NO_SECRET_ASSET_ORDERING_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "5c920ad7c56289791d12c756d4b9627bf18b4632",
  tree: "5db5225a8f09d5e2295a89d4a7f2a3fa1305ff8b",
  parent: "7b8ff3fdf0c9a75a6dc68ec7c47a039ec974d0d2",
  subject: SAFE_NO_SECRET_ASSET_ORDERING_OVERWATCH_SUBJECT,
  files: FINAL_OVERWATCH_SUCCESSOR_PATHS
});
const CLOUDFLARE_DEPLOYMENT_READ_OVERWATCH_SUBJECT =
  "overwatch: close Cloudflare deployment read provenance";
const CLOUDFLARE_DEPLOYMENT_READ_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "9a2c27da613f1222039c5a8ae583ce9f70d98056",
  tree: "f28390609db59464e6c520d3201d281d044bb770",
  parent: "d8da4f23a9df80f91e8f95bf80b7075e8d2532dc",
  subject: CLOUDFLARE_DEPLOYMENT_READ_OVERWATCH_SUBJECT,
  files: FINAL_OVERWATCH_SUCCESSOR_PATHS
});
const WRANGLER_DEPLOYMENT_FAILURE_OVERWATCH_SUBJECT =
  "overwatch: close Wrangler deployment failure provenance";
const WRANGLER_DEPLOYMENT_FAILURE_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "4f28734a34b7dac10275ed2f9fc64345f7f5c815",
  tree: "23366f969f0e51c2fd4a769c097625fe6b8a30b0",
  parent: "1cbb6aa1cadde1b4896990b3bb50d857d994071c",
  subject: WRANGLER_DEPLOYMENT_FAILURE_OVERWATCH_SUBJECT,
  files: FINAL_OVERWATCH_SUCCESSOR_PATHS
});
const WRANGLER_DIAGNOSTIC_VERIFICATION_OVERWATCH_SUBJECT =
  "overwatch: close Wrangler diagnostic verification";
const WRANGLER_DIAGNOSTIC_VERIFICATION_OVERWATCH_PATHS = Object.freeze([
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const WRANGLER_DIAGNOSTIC_VERIFICATION_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "162b09a715381e2894a9a1469b8f1fc2cc47e5e8",
  tree: "7dc0620888dc38c879d70596bc730a4552a9fb59",
  parent: WRANGLER_DEPLOYMENT_FAILURE_OVERWATCH_SUCCESSOR.commit,
  subject: WRANGLER_DIAGNOSTIC_VERIFICATION_OVERWATCH_SUBJECT,
  files: WRANGLER_DIAGNOSTIC_VERIFICATION_OVERWATCH_PATHS
});
const WRANGLER_DIAGNOSTIC_FINAL_OVERWATCH_SUBJECT =
  "overwatch: finalize Wrangler diagnostic verification";
const WRANGLER_DIAGNOSTIC_FINAL_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "c0842d5ec44f4797e395e5f9fcb2b2ad720cfe40",
  tree: "87fc124fe0f1b4fe69d3cf94bbe942c2b3a4ea46",
  parent: WRANGLER_DIAGNOSTIC_VERIFICATION_OVERWATCH_SUCCESSOR.commit,
  subject: WRANGLER_DIAGNOSTIC_FINAL_OVERWATCH_SUBJECT,
  files: WRANGLER_DIAGNOSTIC_VERIFICATION_OVERWATCH_PATHS
});
const PUBLIC_WORKER_STARTUP_INTELLIGENCE_REPAIR = Object.freeze({
  commit: "f0593640bae9cb9517d954415ca4980226a51073",
  tree: "dd4cf6180eabcf0298ed84d5d07f1de00cadafc4",
  parent: WRANGLER_DIAGNOSTIC_FINAL_OVERWATCH_SUCCESSOR.commit,
  subject: "intelligence: make retention policy loading Worker-safe",
  files: Object.freeze([
    "intelligence/route-iq-prospective-retention-admission.mjs",
    "tests/route-iq-prospective-retention-intelligence.test.mjs"
  ])
});
const PUBLIC_WORKER_STARTUP_OVERWATCH_SUBJECT =
  "overwatch: close public Worker startup repair provenance";
const PUBLIC_WORKER_STARTUP_OVERWATCH_PATHS = Object.freeze([
  ...FINAL_OVERWATCH_SUCCESSOR_PATHS,
  "scripts/verify-overwatch-route-iq-3d-visual-continuity.mjs",
  "scripts/verify-overwatch-route-iq-revised-3d-release-readiness-successor.mjs"
]);
const PUBLIC_WORKER_STARTUP_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "4970dfad5ae5598551d4f1cf20bbb7e18a9a084f",
  tree: "b2785e271fc0741fa7a14cc849aa0db18bed141d",
  parent: INFRASTRUCTURE_COMMITS[18].commit,
  subject: PUBLIC_WORKER_STARTUP_OVERWATCH_SUBJECT,
  files: PUBLIC_WORKER_STARTUP_OVERWATCH_PATHS
});
const PUBLIC_CONFIG_CONSUMER_OVERWATCH_SUBJECT =
  "overwatch: close public config consumer repair provenance";
const PUBLIC_CONFIG_CONSUMER_OVERWATCH_PATHS = Object.freeze([
  "overwatch/governance/route-iq-commercial-readiness-v1.json",
  PUBLIC_INTEGRITY_READINESS_PATH,
  "scripts/verify-overwatch-route-iq-3d-visual-continuity.mjs",
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const PUBLIC_CONFIG_CONSUMER_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "e2a79a3b2808dd229b117275c2ea0791b55c67ea",
  tree: "3837a9c792b821f02e0eef8279e9e3711199e57c",
  parent: INFRASTRUCTURE_COMMITS[20].commit,
  subject: PUBLIC_CONFIG_CONSUMER_OVERWATCH_SUBJECT,
  files: PUBLIC_CONFIG_CONSUMER_OVERWATCH_PATHS
});
const INTELLIGENCE_3D_BOUNDARY_OVERWATCH_SUBJECT =
  "overwatch: admit Intelligence startup repair to 3D boundary";
const INTELLIGENCE_3D_BOUNDARY_OVERWATCH_PATHS = Object.freeze([
  PUBLIC_INTEGRITY_READINESS_PATH,
  "scripts/verify-overwatch-route-iq-3d-visual-continuity.mjs",
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const INTELLIGENCE_3D_BOUNDARY_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "9ec13294dd894f9a8aa449cea39be7f8c5f5cc2b",
  tree: "9d4dc9bec25e4e38e97f79c8fb7b4fbf1a6fcd1c",
  parent: PUBLIC_CONFIG_CONSUMER_OVERWATCH_SUCCESSOR.commit,
  subject: INTELLIGENCE_3D_BOUNDARY_OVERWATCH_SUBJECT,
  files: INTELLIGENCE_3D_BOUNDARY_OVERWATCH_PATHS
});
const CURRENT_ROLLBACK_TEST_OVERWATCH_SUBJECT =
  "overwatch: align 3D rollback test with current bundle";
const CURRENT_ROLLBACK_TEST_OVERWATCH_PATHS = Object.freeze([
  PUBLIC_INTEGRITY_READINESS_PATH,
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "tests/overwatch-route-iq-3d-visual-continuity.test.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const CURRENT_ROLLBACK_TEST_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "329db670b928b6d955ad0d851d9f73584bffcbb1",
  tree: "e8ecfeb738e71f1ac34d87ae8b26dac57c797aa5",
  parent: INTELLIGENCE_3D_BOUNDARY_OVERWATCH_SUCCESSOR.commit,
  subject: CURRENT_ROLLBACK_TEST_OVERWATCH_SUBJECT,
  files: CURRENT_ROLLBACK_TEST_OVERWATCH_PATHS
});
const INTELLIGENCE_RETENTION_BOUNDARY_OVERWATCH_SUBJECT =
  "overwatch: admit Intelligence startup repair to retention boundary";
const INTELLIGENCE_RETENTION_BOUNDARY_OVERWATCH_PATHS = Object.freeze([
  PUBLIC_INTEGRITY_READINESS_PATH,
  "overwatch/governance/route-iq-prospective-evidence-retention-v1.json",
  "scripts/verify-overwatch-route-iq-prospective-evidence-retention.mjs",
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "tests/overwatch-route-iq-prospective-evidence-retention.test.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const INTELLIGENCE_RETENTION_BOUNDARY_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "1eb66ceb578e72d0ceff0e68d9c8b4037e299f85",
  tree: "8a68bbaba65402bceb48ed92248c89971342abf9",
  parent: CURRENT_ROLLBACK_TEST_OVERWATCH_SUCCESSOR.commit,
  subject: INTELLIGENCE_RETENTION_BOUNDARY_OVERWATCH_SUBJECT,
  files: INTELLIGENCE_RETENTION_BOUNDARY_OVERWATCH_PATHS
});
const PAUSED_ACCESS_ALIGNMENT_OVERWATCH_SUBJECT =
  "overwatch: align paused access successor evidence";
const PAUSED_ACCESS_ALIGNMENT_OVERWATCH_PATHS = Object.freeze([
  PUBLIC_INTEGRITY_READINESS_PATH,
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "tests/overwatch-cloudflare-unattended-access.test.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const PAUSED_ACCESS_ALIGNMENT_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "d562f62acf749685e099d4d7f572a4e06d69bc7b",
  tree: "27750be8a32834deed50a68a30c95027928318ea",
  parent: INTELLIGENCE_RETENTION_BOUNDARY_OVERWATCH_SUCCESSOR.commit,
  subject: PAUSED_ACCESS_ALIGNMENT_OVERWATCH_SUBJECT,
  files: PAUSED_ACCESS_ALIGNMENT_OVERWATCH_PATHS
});
const CRM_PUBLIC_ADAPTER_REPAIR = Object.freeze({
  commit: "ab480ba101bc314946879af5cdb7997bd8085b4d",
  tree: "97a4ef6a0925db41fc03b9b9d092aa32aa2051e3",
  parent: PAUSED_ACCESS_ALIGNMENT_OVERWATCH_SUCCESSOR.commit,
  subject: "crm: accept governed public Worker adapter",
  files: Object.freeze([
    "crm/production-worker-entrypoint-contract.mjs",
    "scripts/validate-crm-production-store.mjs",
    "tests/crm-cloudflare-kv-workspace-lead-store.test.mjs"
  ])
});
const CRM_PUBLIC_ADAPTER_OVERWATCH_SUBJECT =
  "overwatch: admit CRM public Worker adapter repair";
const CRM_PUBLIC_ADAPTER_OVERWATCH_PATHS = Object.freeze([
  PUBLIC_INTEGRITY_READINESS_PATH,
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const CRM_PUBLIC_ADAPTER_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "07bf2eddc9707cb410ff6670efe9465ca68cd6b4",
  tree: "e1546b4500803bb03898c6ffb18377ffd08e599e",
  parent: INFRASTRUCTURE_COMMITS[21].commit,
  subject: CRM_PUBLIC_ADAPTER_OVERWATCH_SUBJECT,
  files: CRM_PUBLIC_ADAPTER_OVERWATCH_PATHS
});
const WORKFLOW_V2_OVERWATCH_GOVERNANCE = Object.freeze({
  commit: "ee80a44b8a28847d4a4acfc3fae8574697661edc",
  tree: "a17607eee5ff0d77f3cdfb603bc913e9f982a78a",
  parent: INFRASTRUCTURE_COMMITS[22].commit,
  subject: "overwatch: govern public deployment workflow v2",
  files: Object.freeze([
    "overwatch/artifact-contracts/canonical-artifact-registry.json",
    "overwatch/governance/public-deployment-workflow-v2.json",
    "overwatch/governance/public-deployment-workflow-v2.md",
    "overwatch/governance/verified-engineering-batch-auto-push-v1.json",
    "overwatch/governance/verified-engineering-batch-auto-push-v1.md",
    "package.json",
    "scripts/verify-overwatch-auto-push-governance.mjs",
    "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
    "tests/cross-subsystem-artifact-contracts.test.mjs",
    "tests/overwatch-auto-push-governance.test.mjs",
    "tests/overwatch-public-deployment-workflow-v2.test.mjs"
  ])
});
const WORKFLOW_V2_OVERWATCH_PROVENANCE_PIN = Object.freeze({
  commit: "c3da99ebc1744d0e540719a78531ec983b18ebdb",
  tree: "6947d0079d9167642defa3d50c5f05c3fa821347",
  parent: INFRASTRUCTURE_COMMITS[23].commit,
  subject: "overwatch: pin workflow v2 provenance repair",
  files: Object.freeze([
    "overwatch/governance/public-deployment-workflow-v2.json",
    "overwatch/governance/public-deployment-workflow-v2.md",
    "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
    "tests/overwatch-public-deployment-workflow-v2.test.mjs"
  ])
});
const WORKFLOW_V2_READINESS_CLOSURE_SUBJECT =
  "overwatch: close workflow v2 historical readiness";
const WORKFLOW_V2_READINESS_CLOSURE_PATHS = Object.freeze([
  PUBLIC_INTEGRITY_READINESS_PATH,
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const WORKFLOW_V2_READINESS_CLOSURE = Object.freeze({
  commit: "19d27686408db1eaf3f33a2ed15c36827441f3ec",
  tree: "e7c1c5c62a3d96865c0951dd7e03020970ef1acf",
  parent: WORKFLOW_V2_OVERWATCH_PROVENANCE_PIN.commit,
  subject: WORKFLOW_V2_READINESS_CLOSURE_SUBJECT,
  files: WORKFLOW_V2_READINESS_CLOSURE_PATHS
});
const WORKFLOW_V2_FINAL_READINESS_SUBJECT =
  "overwatch: finalize workflow v2 historical readiness";
const WORKFLOW_V2_FINAL_READINESS_CLOSURE = Object.freeze({
  commit: "0d828948968b8cedf3b1961c5320c74c03a8e18c",
  tree: "f2e075ae7b594bb67957d8ad67b5e16491f97122",
  parent: WORKFLOW_V2_READINESS_CLOSURE.commit,
  subject: WORKFLOW_V2_FINAL_READINESS_SUBJECT,
  files: WORKFLOW_V2_READINESS_CLOSURE_PATHS
});
const WORKFLOW_V2_RELEASE_WIRING_SUBJECT =
  "overwatch: admit workflow v2 release wiring successor";
const WORKFLOW_V2_RELEASE_WIRING_PATHS = Object.freeze([
  PUBLIC_INTEGRITY_READINESS_PATH,
  "overwatch/governance/public-deployment-workflow-v2.json",
  "scripts/verify-overwatch-cloudflare-unattended-access.mjs",
  "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "tests/overwatch-public-deployment-workflow-v2.test.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const WORKFLOW_V2_RELEASE_WIRING_CLOSURE = Object.freeze({
  commit: "5b5b59509206578336b9671582669b600d0c74d4",
  tree: "2f85affdbbb55550ea99fbc8c28413cab0f9a00e",
  parent: WORKFLOW_V2_FINAL_READINESS_CLOSURE.commit,
  subject: WORKFLOW_V2_RELEASE_WIRING_SUBJECT,
  files: WORKFLOW_V2_RELEASE_WIRING_PATHS
});
const WORKFLOW_V2_OVERWATCH_TAIL_PATHS = Object.freeze([
  PUBLIC_INTEGRITY_READINESS_PATH,
  "overwatch/governance/public-deployment-workflow-v2.json",
  "scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-get-only-recovery.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-response-contract-repair.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-service-token.mjs",
  "scripts/verify-overwatch-cloudflare-founder-attended-tty-compatibility.mjs",
  "scripts/verify-overwatch-cloudflare-unattended-access.mjs",
  "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
  "scripts/verify-overwatch-route-iq-3d-visual-continuity.mjs",
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "scripts/verify-overwatch-route-iq-revised-3d-release-readiness-successor.mjs",
  "tests/overwatch-public-deployment-workflow-v2.test.mjs",
  "tests/overwatch-route-iq-3d-visual-continuity.test.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const WORKFLOW_V2_AUTHORIZATION_BOUNDARY_SUCCESSORS = Object.freeze([
  Object.freeze({
    commit: "9c6440ba3c286b06a79435a8ec7bdf477cb4fd79",
    tree: "9e09f7c9129b0eae1618cc0316da0f1a22d7c7c2",
    parent: "6db68f845e91c967e34f3b825e4cbc2372cef6d8",
    subject: "infrastructure: consume deployment authorization at spawn",
    ownerEmail: "infrastructure@prometheus.local",
    files: Object.freeze([
      "docs/github-actions-public-worker-deployment-v2.md",
      "scripts/lib/github-actions-public-worker-deployment.mjs",
      "scripts/lib/github-actions-public-worker-workflow-v2.mjs",
      "scripts/run-github-actions-public-worker-deployment-v2.mjs",
      "scripts/verify-github-actions-public-worker-deployment.mjs",
      "scripts/verify-github-actions-public-worker-workflow-v2.mjs",
      "tests/github-actions-public-worker-workflow-v2.test.mjs",
      "workers/infrastructure/github-actions-public-worker-deployment-v2.json"
    ])
  }),
  Object.freeze({
    commit: "e2465d7a28c3222626cc8c60ed0690f8a425ee6f",
    tree: "25a215fda6751214d5c8a8b2d4474531aaf6536b",
    parent: "9c6440ba3c286b06a79435a8ec7bdf477cb4fd79",
    subject: "overwatch: govern deployment authorization boundary repair",
    ownerEmail: "overwatch@prometheus.local",
    files: Object.freeze([
      "overwatch/governance/public-deployment-workflow-v2.json",
      "overwatch/governance/public-deployment-workflow-v2.md",
      "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
      "tests/overwatch-public-deployment-workflow-v2.test.mjs"
    ])
  }),
  Object.freeze({
    commit: "4d7f5d140a7f856a18b99c1ab49a37d7555d3b5a",
    tree: "a8ccbaced4a0780286864af590dcd30cce8ac245",
    parent: "e2465d7a28c3222626cc8c60ed0690f8a425ee6f",
    subject: "overwatch: admit authorization boundary governance successor",
    ownerEmail: "overwatch@prometheus.local",
    files: Object.freeze([
      "overwatch/governance/public-deployment-workflow-v2.json",
      "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
      "tests/overwatch-public-deployment-workflow-v2.test.mjs"
    ])
  }),
  Object.freeze({
    commit: "d2963aa66e304932729cf8154ab729f5d8b71113",
    tree: "b589078b7c9945eb2e12db2183788778e11e7c93",
    parent: "4d7f5d140a7f856a18b99c1ab49a37d7555d3b5a",
    subject: "infrastructure: admit deployment authorization boundary repair",
    ownerEmail: "infrastructure@prometheus.local",
    files: INFRASTRUCTURE_COMMITS.at(-1).files
  })
]);
const FOUNDER_JWT_VALIDATION_REPAIR = Object.freeze({
  commit: "b7ab413a298d62806f7274d5ef63e6cb63bddf2c",
  tree: "275c88e592f285578aa2dd6a0d64c151f84c3abf",
  parent: "76eb41c5c49965c79b1b7a13de19e0d1b1020b62",
  subject: "infrastructure: classify Founder Access JWT failures",
  ownerEmail: "infrastructure@prometheus.local",
  files: Object.freeze([
    "docs/route-iq-request-crm-infrastructure-v1.md",
    "scripts/verify-cloudflare-public-crm-founder-access.mjs",
    "scripts/verify-route-iq-request-crm-infrastructure.mjs",
    "tests/route-iq-request-crm-infrastructure.test.mjs",
    "workers/infrastructure/route-iq-public-forward-rollback-v1.json",
    "workers/infrastructure/route-iq-request-crm-runtime-v1.json",
    "workers/infrastructure/route-iq-request-crm-runtime.js"
  ])
});
const CANONICAL_ROLLBACK_IDENTITY_SUCCESSOR = Object.freeze({
  commit: "f09df1273b7b9ce4ea43bdfc065e929aa3405bf3",
  tree: "8705e3cb903bdc7e94d5e439be8ca79e17645008",
  parent: FOUNDER_JWT_VALIDATION_REPAIR.commit,
  subject: "infrastructure: advance canonical rollback identity",
  ownerEmail: "infrastructure@prometheus.local",
  files: Object.freeze([
    "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
    "tests/public-repository-integrity-repair.test.mjs",
    "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
  ])
});
const WORKFLOW_V2_FIXTURE_REPAIR_SUCCESSOR = Object.freeze({
  commit: "9e91ccbd71cd7298fcb74de5ca6a4ced20125113",
  tree: "1691ed5ffb5bc139a66b60cbafd5b5c60ad12892",
  parent: "781a9472a4bd43a998826a3a130e547907f1f36a",
  subject: "infrastructure: derive Workflow v2 rollback fixture",
  ownerEmail: "infrastructure@prometheus.local",
  files: Object.freeze([
    "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
    "tests/github-actions-public-worker-workflow-v2.test.mjs",
    "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
  ])
});
const WEBSITE_SUCCESSOR_FILES = Object.freeze([
  "deploy/prometheusrouteiq-website/assets/IntelligenceScene-CqK-yX9Z.js",
  "deploy/prometheusrouteiq-website/assets/IntelligenceScene-DUlz-ixy.js",
  "deploy/prometheusrouteiq-website/assets/landing-D-Z5MAu6.js",
  "deploy/prometheusrouteiq-website/assets/landing-Dfjv-fGW.js",
  "deploy/prometheusrouteiq-website/index.html"
]);
const ROLLBACK_SUCCESSOR_FILES = Object.freeze([
  Object.freeze({
    path: "scripts/verify-github-actions-public-worker-workflow-v2.mjs",
    sha256: "31e6db547928fce5e159b0d8eebebd7d56ea66ad423d5f2311331dd5e246af4c"
  }),
  Object.freeze({
    path: "tests/github-actions-public-worker-deployment.test.mjs",
    sha256: "d880b9b2f326fe01d9f8d7164e76d7910f3cb2bf10f1f9badbcc82434539d326"
  }),
  Object.freeze({
    path: "tests/github-actions-public-worker-workflow-v2.test.mjs",
    sha256: "8c00799bdec6a8973bdfd467afe21f97ec8e7f7c270a80e7a1c40978e6c042fa"
  }),
  Object.freeze({
    path: ROLLBACK_CONTRACT_PATH,
    sha256: CURRENT_ROLLBACK_CONTRACT_SHA256
  }),
  Object.freeze({
    path: INFRASTRUCTURE_CONTRACT_PATH,
    sha256: "5ecd49cb7f8306e2fed6fc18629f9ce490316cba6c1db4c9d0d6c39d09ca1d74"
  })
]);
const PROVENANCE_ADMISSION_FILES = Object.freeze([
  Object.freeze({
    path: "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
    sha256: "85e0a267ac8272903bb01556bbcc46503ae565e18f4841bc6bacdffa3a9226c3"
  }),
  Object.freeze({
    path: "tests/public-repository-integrity-repair.test.mjs",
    sha256: "37416524fabb451e3dd05b63b24324a9b35e013f091270af446099aa333ee377"
  }),
  Object.freeze({
    path: INFRASTRUCTURE_CONTRACT_PATH,
    sha256: CURRENT_INFRASTRUCTURE_CONTRACT_SHA256
  })
]);
const INITIAL_OVERWATCH_SUCCESSOR_FILES = Object.freeze([
  "overwatch/governance/public-deployment-workflow-v2.json",
  "overwatch/governance/public-deployment-workflow-v2.md",
  PUBLIC_INTEGRITY_READINESS_PATH,
  "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
  "scripts/verify-overwatch-route-iq-3d-visual-continuity.mjs",
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "scripts/verify-overwatch-route-iq-revised-3d-release-readiness-successor.mjs",
  "scripts/verify-overwatch-route-iq-yc-investor-website-focus.mjs",
  "tests/overwatch-public-deployment-workflow-v2.test.mjs",
  "tests/overwatch-route-iq-3d-visual-continuity.test.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const MANIFEST_REPAIR_SUCCESSOR_FILES = Object.freeze([
  PUBLIC_INTEGRITY_READINESS_PATH,
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs"
]);
const PROVENANCE_CLOSURE_SUCCESSOR_FILES = Object.freeze([
  "overwatch/governance/public-deployment-workflow-v2.json",
  PUBLIC_INTEGRITY_READINESS_PATH,
  "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "tests/overwatch-public-deployment-workflow-v2.test.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const WORKFLOW_PIN_REFRESH_SUCCESSOR_FILES = Object.freeze([
  "overwatch/governance/public-deployment-workflow-v2.json",
  "overwatch/governance/public-deployment-workflow-v2.md",
  PUBLIC_INTEGRITY_READINESS_PATH,
  "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "tests/overwatch-public-deployment-workflow-v2.test.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const CURRENT_OVERWATCH_SUCCESSOR_FILES = Object.freeze([
  "overwatch/governance/public-deployment-workflow-v2.json",
  "overwatch/governance/public-deployment-workflow-v2.md",
  PUBLIC_INTEGRITY_READINESS_PATH,
  AUGUST1_READINESS_REPORT_PATH,
  "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "tests/overwatch-public-deployment-workflow-v2.test.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const WEBSITE_SUCCESSOR = Object.freeze({
  commit: "710ad8a1428dd7621c5363a16fffaae828cc3421",
  tree: "7e7f5cf2ec0fe0a2bfeae41c577279faab4c111b",
  parent: "dd048c8c00804073034a89a6a4dd48f616302a75",
  subject: "website: regenerate public deployment assets",
  owner: "Prometheus Website",
  author: "Prometheus Website <website@prometheus.local>",
  committer: "Prometheus Website <website@prometheus.local>",
  files: WEBSITE_SUCCESSOR_FILES,
  deploymentAssetsSha256: CURRENT_DEPLOYMENT_ASSETS_SHA256
});
const ROLLBACK_SUCCESSOR = Object.freeze({
  commit: "18fbe9906064bad8a0ae8e6fc224e2af0bf1a594",
  tree: "8f58a2fb6e438d57556cb4f1860d4497782f61b2",
  parent: WEBSITE_SUCCESSOR.commit,
  subject: "infrastructure: advance August 1 public rollback candidate",
  owner: "Prometheus Infrastructure",
  author: "Prometheus Infrastructure <infrastructure@prometheus.local>",
  committer: "Prometheus Infrastructure <infrastructure@prometheus.local>",
  files: ROLLBACK_SUCCESSOR_FILES
});
const PROVENANCE_ADMISSION = Object.freeze({
  commit: "a558df528f0c472d28afb1c3b3041a067ca86c4b",
  tree: "7e4e8b94d61f57bbd3dcf3c50ebe3e4efff54608",
  parent: ROLLBACK_SUCCESSOR.commit,
  subject: "infrastructure: admit August 1 launch closeout successors",
  owner: "Prometheus Infrastructure",
  author: "Prometheus Infrastructure <infrastructure@prometheus.local>",
  committer: "Prometheus Infrastructure <infrastructure@prometheus.local>",
  files: PROVENANCE_ADMISSION_FILES
});
const INITIAL_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "5c20b551820c21b02a0c25c9d38c93474457fd23",
  tree: "f0e388d52dfbe0fa9576a86551e20ef501f8c5cf",
  parent: PROVENANCE_ADMISSION.commit,
  subject: "overwatch: admit August 1 public release successors",
  author: "Prometheus Overwatch <overwatch@prometheus.local>",
  committer: "Prometheus Overwatch <overwatch@prometheus.local>",
  files: INITIAL_OVERWATCH_SUCCESSOR_FILES
});
const MANIFEST_REPAIR_SUCCESSOR = Object.freeze({
  commit: "59fab7bc5f307336fba52d15bc73181cb1a20b04",
  tree: "659a243b314a1dfbd811ba395f3c87485e50ccd6",
  parent: INITIAL_OVERWATCH_SUCCESSOR.commit,
  subject: "overwatch: complete August 1 successor manifest",
  author: "Prometheus Overwatch <overwatch@prometheus.local>",
  committer: "Prometheus Overwatch <overwatch@prometheus.local>",
  files: MANIFEST_REPAIR_SUCCESSOR_FILES
});
const PROVENANCE_CLOSURE_SUCCESSOR = Object.freeze({
  commit: "899e4bbad0a74d2cf9514eda5ba5875b69aa6636",
  tree: "5fb40124e155e07f89f05c607dc5f2cd346684c0",
  parent: MANIFEST_REPAIR_SUCCESSOR.commit,
  subject: "overwatch: close August 1 successor provenance",
  author: "Prometheus Overwatch <overwatch@prometheus.local>",
  committer: "Prometheus Overwatch <overwatch@prometheus.local>",
  files: PROVENANCE_CLOSURE_SUCCESSOR_FILES
});
const WORKFLOW_PIN_REFRESH_SUCCESSOR = Object.freeze({
  commit: "bc5c03392580470c3549c8e3fe510458e5cdc196",
  tree: "4b15decd6b6ec6cc42bea1ab4770609a35b74768",
  parent: PROVENANCE_CLOSURE_SUCCESSOR.commit,
  subject: "overwatch: refresh August 1 workflow pins",
  author: "Prometheus Overwatch <overwatch@prometheus.local>",
  committer: "Prometheus Overwatch <overwatch@prometheus.local>",
  files: WORKFLOW_PIN_REFRESH_SUCCESSOR_FILES
});
const QUALIFICATION_SUCCESSORS = Object.freeze([
  Object.freeze({
    commit: "f464a6bc19e8d2e52cab258dd2cbdd7511a18a21",
    tree: "231142c33106b7d936ed575696b3814fa99618ff",
    parent: WORKFLOW_PIN_REFRESH_SUCCESSOR.commit,
    subject: "overwatch: align August 1 package successor",
    author: "Prometheus Overwatch <overwatch@prometheus.local>",
    committer: "Prometheus Overwatch <overwatch@prometheus.local>",
    files: WORKFLOW_PIN_REFRESH_SUCCESSOR_FILES
  }),
  Object.freeze({
    commit: "4fb815a7e03f745685a36e24e847dbc1f109a7df",
    tree: "81aa187479948de9cd624d29f14557eea2909b79",
    parent: "f464a6bc19e8d2e52cab258dd2cbdd7511a18a21",
    subject: "Admit August 1 successors in paused access gates",
    author: "Prometheus Overwatch <overwatch@prometheus.local>",
    committer: "Prometheus Overwatch <overwatch@prometheus.local>",
    files: Object.freeze([
      "scripts/verify-overwatch-cloudflare-founder-attended-service-token.mjs",
      "scripts/verify-overwatch-cloudflare-unattended-access.mjs",
      "tests/overwatch-cloudflare-founder-attended-service-token.test.mjs",
      "tests/overwatch-cloudflare-unattended-access.test.mjs"
    ])
  }),
  Object.freeze({
    commit: "1a1e130b9ffe63948ceaf7fc7d5cfff647431e3e",
    tree: "c0dcdd559630b95120d7e0dd76bcc2e8b3616721",
    parent: "4fb815a7e03f745685a36e24e847dbc1f109a7df",
    subject: "Reconcile attended response verifier successors",
    author: "Prometheus Overwatch <overwatch@prometheus.local>",
    committer: "Prometheus Overwatch <overwatch@prometheus.local>",
    files: Object.freeze([
      "scripts/verify-overwatch-cloudflare-founder-attended-response-contract-repair.mjs",
      "tests/overwatch-cloudflare-founder-attended-response-contract-repair.test.mjs"
    ])
  }),
  Object.freeze({
    commit: "e295f94c09d98c6ec45cf797ca51c12e62fac7be",
    tree: "6d3e777a9cf5ab89e0a6bb4d1265815d9102ccd7",
    parent: "1a1e130b9ffe63948ceaf7fc7d5cfff647431e3e",
    subject: "Reconcile create receipt verifier successors",
    author: "Prometheus Overwatch <overwatch@prometheus.local>",
    committer: "Prometheus Overwatch <overwatch@prometheus.local>",
    files: Object.freeze([
      "scripts/verify-overwatch-cloudflare-founder-attended-create-receipt-v2.mjs",
      "tests/overwatch-cloudflare-founder-attended-create-receipt-v2.test.mjs"
    ])
  }),
  Object.freeze({
    commit: "c58c44b0314598a5848599fc855c383b884fba60",
    tree: "49e274b6be76bf97a15573913b71ba0c7adc9cac",
    parent: "e295f94c09d98c6ec45cf797ca51c12e62fac7be",
    subject: "Align workspace verifier with customer scope",
    author: "Prometheus Dashboard <dashboard@prometheus.local>",
    committer: "Prometheus Dashboard <dashboard@prometheus.local>",
    files: Object.freeze(["scripts/verify-dashboard-workspace-switcher.mjs"])
  }),
  Object.freeze({
    commit: "affd4548054ca5f2c73521820d3bd3b82afa7545",
    tree: "5f5694b67525c8352a41be6149dc02c0e828bfc2",
    parent: "c58c44b0314598a5848599fc855c383b884fba60",
    subject: "Admit governed learning baseline successors",
    author: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    committer: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    files: Object.freeze([
      "scripts/verify-read-only-field-session-learning.mjs",
      "tests/read-only-field-session-learning.test.mjs"
    ])
  }),
  Object.freeze({
    commit: "325c50c4c33f18dea07f16d6214a4decdcc46c29",
    tree: "dc36977f793fc31d9716127cf167c734c186d4f8",
    parent: "affd4548054ca5f2c73521820d3bd3b82afa7545",
    subject: "Share governed learning successor verification",
    author: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    committer: "Prometheus Intelligence Engine <intelligence@prometheus.local>",
    files: Object.freeze([
      "scripts/verify-off-route-learning-intelligence.mjs",
      "scripts/verify-read-only-field-session-learning.mjs",
      "tests/off-route-learning-intelligence.test.mjs"
    ])
  }),
  Object.freeze({
    commit: "e34259fa62a3530b0a24e9dbae3a015593c08a22",
    tree: "0968335f8545b5ff306d6f14c724be008a506b7f",
    parent: "325c50c4c33f18dea07f16d6214a4decdcc46c29",
    subject: "Reconcile current release provenance successors",
    author: "Prometheus Overwatch <overwatch@prometheus.local>",
    committer: "Prometheus Overwatch <overwatch@prometheus.local>",
    files: Object.freeze([
      "scripts/verify-release-provenance-repair.mjs",
      "tests/release-provenance-repair.test.mjs"
    ])
  }),
  Object.freeze({
    commit: "95f367e03160bfeae98b722d99b6ca67d4424d72",
    tree: "7810b49f5eab1a1cefcc2811b65fad1c0a4b5b7e",
    parent: "e34259fa62a3530b0a24e9dbae3a015593c08a22",
    subject: "overwatch: finalize August 1 launch readiness",
    author: "Prometheus Overwatch <overwatch@prometheus.local>",
    committer: "Prometheus Overwatch <overwatch@prometheus.local>",
    files: Object.freeze([
      AUGUST1_READINESS_REPORT_PATH,
      "overwatch/governance/route-iq-august-1-readiness-matrix-v1.json",
      "scripts/verify-overwatch-route-iq-august-1-launch-readiness.mjs",
      "tests/overwatch-route-iq-august-1-launch-readiness.test.mjs"
    ])
  }),
  Object.freeze({
    commit: "0cffd6afb7b660e61049baff330bf3b231077a89",
    tree: "46866ff57ceb022cc4a3212771c63fd1b9f275ba",
    parent: "95f367e03160bfeae98b722d99b6ca67d4424d72",
    subject: "overwatch: close August 1 qualification chain",
    author: "Prometheus Overwatch <overwatch@prometheus.local>",
    committer: "Prometheus Overwatch <overwatch@prometheus.local>",
    files: CURRENT_OVERWATCH_SUCCESSOR_FILES
  }),
  Object.freeze({
    commit: "5aa41020ab857c9910b526acf138c1f7348c402f",
    tree: "fb2b2cd20624d9b62c43a50de49867f6355a72c5",
    parent: "0cffd6afb7b660e61049baff330bf3b231077a89",
    subject: "overwatch: align August 1 tail boundary",
    author: "Prometheus Overwatch <overwatch@prometheus.local>",
    committer: "Prometheus Overwatch <overwatch@prometheus.local>",
    files: CURRENT_OVERWATCH_SUCCESSOR_FILES
  }),
  Object.freeze({
    commit: "943baa9c48a85f8b0a57d5a371ff64d486926f8d",
    tree: "bfea848e1c2127a7c29813919a404cf6085c8b1f",
    parent: "5aa41020ab857c9910b526acf138c1f7348c402f",
    subject: "overwatch: finalize August 1 exact tail",
    author: "Prometheus Overwatch <overwatch@prometheus.local>",
    committer: "Prometheus Overwatch <overwatch@prometheus.local>",
    files: CURRENT_OVERWATCH_SUCCESSOR_FILES
  })
]);
const OVERWATCH_SUCCESSOR = Object.freeze({
  classification: "DYNAMIC_EXACT_HEAD_SUCCESSOR",
  parent: QUALIFICATION_SUCCESSORS.at(-1).commit,
  subject: "overwatch: refresh August 1 verifier fixture",
  author: "Prometheus Overwatch <overwatch@prometheus.local>",
  committer: "Prometheus Overwatch <overwatch@prometheus.local>",
  files: CURRENT_OVERWATCH_SUCCESSOR_FILES
});
const HISTORICAL_PRESERVATION_TERMINAL_COMMIT =
  "d3bda9d86a388462dd5cab0fa789081eee59b541";
const CURRENT_INFRASTRUCTURE_OWNER_BOUNDARY = Object.freeze({
  ...INFRASTRUCTURE_OWNER_BOUNDARY,
  august1LaunchCloseoutSuccessors: Object.freeze([
    ...INFRASTRUCTURE_OWNER_BOUNDARY.august1LaunchCloseoutSuccessors,
    Object.freeze({
      commit: PROVENANCE_ADMISSION.commit,
      tree: PROVENANCE_ADMISSION.tree,
      parent: PROVENANCE_ADMISSION.parent,
      authorName: "Prometheus Infrastructure",
      authorEmail: "infrastructure@prometheus.local",
      committerName: "Prometheus Infrastructure",
      committerEmail: "infrastructure@prometheus.local",
      subject: PROVENANCE_ADMISSION.subject,
      files: Object.freeze(PROVENANCE_ADMISSION_FILES.map(item => item.path))
    }),
    Object.freeze({
      commit: INITIAL_OVERWATCH_SUCCESSOR.commit,
      tree: INITIAL_OVERWATCH_SUCCESSOR.tree,
      parent: INITIAL_OVERWATCH_SUCCESSOR.parent,
      authorName: "Prometheus Overwatch",
      authorEmail: "overwatch@prometheus.local",
      committerName: "Prometheus Overwatch",
      committerEmail: "overwatch@prometheus.local",
      subject: INITIAL_OVERWATCH_SUCCESSOR.subject,
      files: INITIAL_OVERWATCH_SUCCESSOR.files
    }),
    Object.freeze({
      commit: MANIFEST_REPAIR_SUCCESSOR.commit,
      tree: MANIFEST_REPAIR_SUCCESSOR.tree,
      parent: MANIFEST_REPAIR_SUCCESSOR.parent,
      authorName: "Prometheus Overwatch",
      authorEmail: "overwatch@prometheus.local",
      committerName: "Prometheus Overwatch",
      committerEmail: "overwatch@prometheus.local",
      subject: MANIFEST_REPAIR_SUCCESSOR.subject,
      files: MANIFEST_REPAIR_SUCCESSOR.files
    }),
    Object.freeze({
      commit: PROVENANCE_CLOSURE_SUCCESSOR.commit,
      tree: PROVENANCE_CLOSURE_SUCCESSOR.tree,
      parent: PROVENANCE_CLOSURE_SUCCESSOR.parent,
      authorName: "Prometheus Overwatch",
      authorEmail: "overwatch@prometheus.local",
      committerName: "Prometheus Overwatch",
      committerEmail: "overwatch@prometheus.local",
      subject: PROVENANCE_CLOSURE_SUCCESSOR.subject,
      files: PROVENANCE_CLOSURE_SUCCESSOR.files
    }),
    Object.freeze({
      commit: WORKFLOW_PIN_REFRESH_SUCCESSOR.commit,
      tree: WORKFLOW_PIN_REFRESH_SUCCESSOR.tree,
      parent: WORKFLOW_PIN_REFRESH_SUCCESSOR.parent,
      authorName: "Prometheus Overwatch",
      authorEmail: "overwatch@prometheus.local",
      committerName: "Prometheus Overwatch",
      committerEmail: "overwatch@prometheus.local",
      subject: WORKFLOW_PIN_REFRESH_SUCCESSOR.subject,
      files: WORKFLOW_PIN_REFRESH_SUCCESSOR.files
    }),
    ...QUALIFICATION_SUCCESSORS.map(successor => Object.freeze({
      commit: successor.commit,
      tree: successor.tree,
      parent: successor.parent,
      authorName: successor.author.replace(/ <[^>]+>$/u, ""),
      authorEmail: successor.author.match(/<([^>]+)>$/u)[1],
      committerName: successor.committer.replace(/ <[^>]+>$/u, ""),
      committerEmail: successor.committer.match(/<([^>]+)>$/u)[1],
      subject: successor.subject,
      files: successor.files
    }))
  ]),
  august1LaunchCloseoutAdmissionSuccessor: Object.freeze({
    parent: OVERWATCH_SUCCESSOR.parent,
    authorName: "Prometheus Overwatch",
    authorEmail: "overwatch@prometheus.local",
    committerName: "Prometheus Overwatch",
    committerEmail: "overwatch@prometheus.local",
    subject: OVERWATCH_SUCCESSOR.subject,
    files: CURRENT_OVERWATCH_SUCCESSOR_FILES
  })
});
const HISTORICAL_CLASSIFICATION = Object.freeze([
  "DEPLOYMENT_ATTEMPT_CONSUMED",
  "HISTORICAL_READINESS_EVIDENCE",
  "NOT_REUSABLE_FOR_DEPLOYMENT",
  "SUPERSEDED_BY_INTEGRITY_REPAIR"
]);

const read = (root, path) => readFileSync(resolve(root, path));
const readJson = (root, path) => JSON.parse(read(root, path).toString("utf8"));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const sorted = values => [...values].sort((left, right) => left.localeCompare(right));
const readAtCommit = (root, commit, path) => execFileSync(
  "git",
  ["show", `${commit}:${path}`],
  { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] }
);

function git(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0"
    },
    maxBuffer: 8 * 1024 * 1024,
    timeout: 30_000
  }).trim();
}

function commitRecord(root, commit) {
  const [author, committer, subject] = git(root, "show", "-s", "--format=%ae%n%ce%n%s", commit).split("\n");
  const files = git(root, "diff-tree", "--no-commit-id", "--name-only", "-r", commit)
    .split("\n")
    .filter(Boolean);
  return { author, committer, subject, files };
}

function exactCommitRecord(root, commit) {
  const [author, committer, subject] = git(
    root,
    "show",
    "-s",
    "--format=%an <%ae>%n%cn <%ce>%n%s",
    commit
  ).split("\n");
  return {
    author,
    committer,
    subject,
    files: commitRecord(root, commit).files
  };
}

export function validatePublicIntegrityReadiness(governance) {
  assert.equal(governance?.governanceId, "route-iq-public-deployment-integrity-repair-readiness-v1");
  assert.equal(governance?.version, "1.11.0");
  assert.equal(governance?.batchId, "BATCH-20260719-008");
  assert.equal(governance?.ownerSubsystem, "Prometheus Overwatch");
  assert.equal(governance?.status, "CANDIDATE_READY_FOR_SAFE_NON_DEPLOYMENT_CI");

  const historical = governance?.historicalReadiness;
  assert.equal(historical?.path, HISTORICAL_SUCCESSOR_PATH);
  assert.equal(historical?.sha256, HISTORICAL_SUCCESSOR_SHA256);
  assert.equal(historical?.commit, HISTORICAL_SUCCESSOR_COMMIT);
  assert.equal(historical?.tree, HISTORICAL_SUCCESSOR_TREE);
  assert.deepEqual(sorted(historical?.classification || []), HISTORICAL_CLASSIFICATION);
  assert.equal(historical?.founderVisualAcceptancePreserved, true);
  assert.equal(historical?.rewritten, false);

  assert.equal(governance?.failedRun?.runId, 29714512987);
  assert.equal(governance?.failedRun?.verificationJobId, 88264893824);
  assert.equal(governance?.failedRun?.deploymentJobId, 88264927103);
  assert.equal(governance?.failedRun?.reportedClassification, "REPOSITORY_INTEGRITY_FAILED");
  assert.equal(governance?.failedRun?.actualFailureStage, "ROLLBACK_ARTIFACT_VERIFICATION_BEFORE_GIT_FSCK");
  assert.equal(governance?.failedRun?.suppressedDiagnostic, "ROLLBACK_HASH_MISMATCH");
  assert.equal(governance?.failedRun?.previouslySuppressedGitFsckDiagnostic, "NONE_FSCK_NOT_REACHED");
  assert.equal(governance?.failedRun?.gitFsckExecuted, false);
  assert.equal(governance?.failedRun?.deploymentJobSkipped, true);
  assert.equal(governance?.failedRun?.protectedEnvironmentAccessed, false);
  assert.equal(governance?.failedRun?.cloudflareContacted, false);
  assert.equal(governance?.failedRun?.artifactsProduced, 0);

  assert.equal(governance?.rootCause?.classification, "CHECKOUT_DEPENDENT_ROLLBACK_IDENTITY_AND_WRAPPER_MISCLASSIFICATION");
  assert.equal(governance?.rootCause?.generatedBundleEmbeddedCheckoutDependentPaths, true);
  assert.equal(governance?.rootCause?.rollbackFailureMisclassifiedAsRepositoryIntegrity, true);
  for (const field of [
    "reachableRepositoryCorruptionReproduced",
    "invalidFetchedRefReproduced",
    "shallowOrPartialCheckoutReproduced",
    "speculationUsed"
  ]) assert.equal(governance?.rootCause?.[field], false);

  assert.deepEqual(governance?.dashboardVerificationRepair, {
    classification: "TEST_ONLY_WALL_CLOCK_DEPENDENCY_REMOVED",
    commit: DASHBOARD_VERIFICATION_SUCCESSOR.commit,
    tree: DASHBOARD_VERIFICATION_SUCCESSOR.tree,
    parent: DASHBOARD_VERIFICATION_SUCCESSOR.parent,
    subject: DASHBOARD_VERIFICATION_SUCCESSOR.subject,
    owner: "Prometheus Dashboard",
    files: [...DASHBOARD_VERIFICATION_SUCCESSOR.files],
    browserWorkflowChecksPassed: 184,
    focusedTestsPassed: 8,
    productRuntimeModified: false,
    generatedDeploymentAssetsModified: false,
    generallyAuthorizesDashboardSuccessors: false
  });

  assert.deepEqual(governance?.infrastructureOwnerRepairs, INFRASTRUCTURE_COMMITS.map(record => ({
    commit: record.commit,
    tree: record.tree,
    parent: record.parent,
    subject: record.subject,
    owner: "Prometheus Infrastructure",
    files: [...record.files]
  })));
  assert.equal(governance?.infrastructureEvidence?.contractPath, INFRASTRUCTURE_CONTRACT_PATH);
  assert.equal(governance?.infrastructureEvidence?.contractSha256, INFRASTRUCTURE_CONTRACT_SHA256);
  assert.equal(
    governance?.infrastructureEvidence?.previousContractSha256,
    PRE_AUTHORIZATION_BOUNDARY_INFRASTRUCTURE_CONTRACT_SHA256
  );
  assert.equal(
    governance?.infrastructureEvidence?.preWorkflowV2ContractSha256,
    PRE_WORKFLOW_V2_ADMISSION_INFRASTRUCTURE_CONTRACT_SHA256
  );
  assert.equal(
    governance?.infrastructureEvidence?.preFounderJwtRepairContractSha256,
    PRE_FOUNDER_JWT_REPAIR_INFRASTRUCTURE_CONTRACT_SHA256
  );
  assert.equal(
    governance?.infrastructureEvidence?.preWorkflowV2FixtureRepairContractSha256,
    PRE_WORKFLOW_V2_FIXTURE_REPAIR_INFRASTRUCTURE_CONTRACT_SHA256
  );
  assert.equal(
    governance?.infrastructureEvidence?.contractSuccessorCommit,
    WORKFLOW_V2_FIXTURE_REPAIR_SUCCESSOR.commit
  );
  assert.equal(
    governance?.infrastructureEvidence?.contractSuccessorOwner,
    "Prometheus Infrastructure"
  );
  assert.equal(
    governance?.infrastructureEvidence?.deploymentContractPath,
    DEPLOYMENT_INFRASTRUCTURE_CONTRACT_PATH
  );
  assert.equal(
    governance?.infrastructureEvidence?.deploymentContractSha256,
    DEPLOYMENT_INFRASTRUCTURE_CONTRACT_SHA256
  );
  assert.deepEqual(governance?.infrastructureEvidence?.strictGitArguments, [
    "fsck", "--full", "--strict", "--no-dangling", "--no-progress"
  ]);
  assert.equal(governance?.infrastructureEvidence?.boundedDiagnosticBytes, 131072);
  for (const field of [
    "fullHistoryRequired",
    "shallowPartialAndPromisorRejected",
    "missingCorruptMalformedAndInvalidRefFailuresRemainFatal",
    "repositoryIntegrityRunsBeforeRollbackAndCredentials",
    "pinnedNodeRunsBeforeRepositoryScripts",
    "sourceMapSourcesResolvedAgainstValidatedRoot",
    "sourceMapRealpathContainmentRequired"
  ]) assert.equal(governance?.infrastructureEvidence?.[field], true);
  assert.equal(governance?.infrastructureEvidence?.genericOwnerVerifierFailureAllowed, false);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierAllowsOnlyGovernedSuccessorSequence, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsDashboardVerificationSuccessor, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsInfrastructureAdmissionSuccessor, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsPublicIntakeSmokeSuccessors, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsPublicIntakeSmokeProvenanceAdmission, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsCleanRunnerAssetGenerationSuccessor, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsKeychainCiPortabilitySuccessors, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsDashboardRuntimeHarnessSuccessors, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsDashboardRuntimeHarnessAdoptionSuccessor, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsSafeNoSecretAssetOrderingRepairSuccessor, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsSafeNoSecretFullSuiteWorkflow, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsCloudflareDeploymentReadRepairSuccessors, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsCloudflareDeploymentReadProvenanceAdmission, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsWranglerFailureDiagnosticSuccessor, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsWranglerFailureProvenanceAdmission, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsPublicWorkerStartupRepairSuccessors, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsPublicWorkerStartupProvenanceAdmission, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsPublicConfigConsumerRepairSuccessor, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsPublicConfigConsumerProvenanceAdmission, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsPublicDeploymentWorkflowV2Successors, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsDeploymentAuthorizationBoundarySuccessors, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsFounderJwtValidationRepair, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsCanonicalRollbackIdentitySuccessor, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierPinsWorkflowV2FixtureRepairSuccessor, true);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierGenerallyAllowsDashboardSuccessors, false);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierRejectsMixedOwnershipAndMerges, true);
  assert.deepEqual(governance?.workflowV2ReadinessClosure, {
    commit: WORKFLOW_V2_READINESS_CLOSURE.commit,
    tree: WORKFLOW_V2_READINESS_CLOSURE.tree,
    parent: WORKFLOW_V2_READINESS_CLOSURE.parent,
    subject: WORKFLOW_V2_READINESS_CLOSURE.subject,
    owner: "Prometheus Overwatch",
    files: [...WORKFLOW_V2_READINESS_CLOSURE.files],
    finalSuccessorSubject: WORKFLOW_V2_FINAL_READINESS_SUBJECT,
    finalSuccessor: {
      commit: WORKFLOW_V2_FINAL_READINESS_CLOSURE.commit,
      tree: WORKFLOW_V2_FINAL_READINESS_CLOSURE.tree,
      parent: WORKFLOW_V2_FINAL_READINESS_CLOSURE.parent,
      subject: WORKFLOW_V2_FINAL_READINESS_CLOSURE.subject,
      files: [...WORKFLOW_V2_FINAL_READINESS_CLOSURE.files]
    },
    releaseWiringSuccessorSubject: WORKFLOW_V2_RELEASE_WIRING_SUBJECT,
    releaseWiringSuccessor: {
      commit: WORKFLOW_V2_RELEASE_WIRING_CLOSURE.commit,
      tree: WORKFLOW_V2_RELEASE_WIRING_CLOSURE.tree,
      parent: WORKFLOW_V2_RELEASE_WIRING_CLOSURE.parent,
      subject: WORKFLOW_V2_RELEASE_WIRING_CLOSURE.subject,
      files: [...WORKFLOW_V2_RELEASE_WIRING_CLOSURE.files]
    },
    authorizationBoundarySuccessors: WORKFLOW_V2_AUTHORIZATION_BOUNDARY_SUCCESSORS.map(record => ({
      commit: record.commit,
      tree: record.tree,
      parent: record.parent,
      subject: record.subject,
      ownerEmail: record.ownerEmail,
      files: [...record.files]
    })),
    governedOverwatchTail: {
      linearHistoryRequired: true,
      mergesAllowed: false,
      authorAndCommitter: "overwatch@prometheus.local",
      subjectPrefix: "overwatch:",
      ownershipAppliesTo: "COMMITS_MODIFYING_GOVERNED_PATH",
      unrelatedSubsystemCommitsAllowed: true,
      allowedPaths: [...WORKFLOW_V2_OVERWATCH_TAIL_PATHS],
      subsystemImplementationAllowed: false
    },
    sourceOrProductionBehaviorChanged: false
  });

  assert.equal(governance?.releaseIdentities?.deploymentAssetsSha256, DEPLOYMENT_ASSETS_SHA256);
  assert.equal(governance?.releaseIdentities?.rollbackContractPath, ROLLBACK_CONTRACT_PATH);
  assert.equal(governance?.releaseIdentities?.rollbackContractSha256, ROLLBACK_CONTRACT_SHA256);
  assert.equal(governance?.releaseIdentities?.deterministicForwardRollbackBundleSha256, ROLLBACK_BUNDLE_SHA256);
  assert.equal(governance?.releaseIdentities?.websiteAndCrmImplementationChanged, false);
  assert.equal(governance?.releaseIdentities?.infrastructureAuthenticationRuntimeChanged, true);
  assert.equal(governance?.releaseIdentities?.generatedDeploymentAssetsChanged, false);
  assert.equal(governance?.releaseIdentities?.newFounderVisualAcceptanceRequired, false);

  assert.deepEqual(governance?.founderJwtValidationRepairClosure, {
    batchId: "BATCH-20260721-011A",
    directive: "Route IQ Founder JWT Validation Repair",
    status: "REPAIR_QUALIFIED_FOUNDER_AUTHORIZATION_REQUIRED",
    confirmedProductionEvidence: {
      accessAuthenticationCompleted: true,
      workerErrorCode: "route_iq_request_founder_auth_invalid",
      failedBeforeFounderSubjectComparison: true,
      historicalFailureDimension: "UNPROVABLE_FROM_PRE_REPAIR_GENERIC_CLASSIFICATION",
      jwtOrClaimValueRetained: false
    },
    rootCause: {
      classification: "VALIDATION_FAILURE_DIMENSIONS_COLLAPSED_TO_GENERIC_CODE",
      exactHistoricalValidationFailureKnown: false,
      retroactiveCauseClaimAllowed: false,
      runtimeDeploymentTarget: "prometheusrouteiq-website",
      privateWorkerOwnsFounderCrmRuntime: false
    },
    ownerRepairs: [FOUNDER_JWT_VALIDATION_REPAIR, CANONICAL_ROLLBACK_IDENTITY_SUCCESSOR]
      .map(record => ({
        commit: record.commit,
        tree: record.tree,
        parent: record.parent,
        subject: record.subject,
        owner: "Prometheus Infrastructure",
        files: [...record.files]
      })),
    validationBoundary: {
      exactIssuerRequired: true,
      exactAudienceRequired: true,
      algorithms: ["RS256"],
      signatureRequired: true,
      requiredClaims: ["iss", "aud", "sub", "iat", "exp"],
      notBeforeValidatedWhenPresent: true,
      clockToleranceSeconds: 5,
      immutableFounderSubjectSha256Required: true,
      authenticationBypassAdded: false
    },
    verification: {
      infrastructureJwtAndCrmTestsPassed: 16,
      founderAccessBoundaryTestsPassed: 10,
      repositoryIntegrityOwnerTestsPassed: 35,
      bundledPublicWorkerMiniflareJwksPassed: true,
      remoteJwksFetchAndKeySelectionExercised: true,
      externalNetworkUsed: false,
      fixedNonsecretFailureCodesOnly: true,
      secretOrClaimValueDisclosureDetected: false
    },
    releaseIdentities: {
      deploymentAssetsSha256: DEPLOYMENT_ASSETS_SHA256,
      rollbackContractSha256: ROLLBACK_CONTRACT_SHA256,
      deterministicRollbackBundleSha256: ROLLBACK_BUNDLE_SHA256,
      infrastructureContractSha256: PRE_WORKFLOW_V2_FIXTURE_REPAIR_INFRASTRUCTURE_CONTRACT_SHA256,
      authenticationRuntimeSha256: "7726770982fe39bb4030a24b8117dfb2cac69954c4279a8876282e4b8e1adac8",
      authenticationContractSha256: "7103fba8dacc1fd966b44d6d02d175e46c8842cd802b6d1791952958724d9849"
    },
    productionBoundary: {
      deploymentPerformed: false,
      settingsChanged: false,
      settingsChangeJustified: false,
      publicWorkerForwardDeploymentRequired: true,
      authenticatedReadOnlyFounderGetRequiredAfterDeployment: true,
      privateWorkerChangeAllowed: false,
      crmWriteAllowed: false
    },
    safety: {
      leadCreated: false,
      crmRecordCreatedOrModified: false,
      notificationSent: false,
      anthonyMapped: false,
      prospectiveCollection: "OFF",
      activeCohorts: 0,
      recommendationInfluence: "OFF"
    }
  });

  assert.deepEqual(governance?.workflowV2FixtureRepairClosure, {
    batchId: "BATCH-20260721-011C",
    status: "SUCCESSOR_RECONSTRUCTED_PENDING_QUALIFICATION",
    ownerCommit: WORKFLOW_V2_FIXTURE_REPAIR_SUCCESSOR.commit,
    ownerTree: WORKFLOW_V2_FIXTURE_REPAIR_SUCCESSOR.tree,
    parent: WORKFLOW_V2_FIXTURE_REPAIR_SUCCESSOR.parent,
    subject: WORKFLOW_V2_FIXTURE_REPAIR_SUCCESSOR.subject,
    owner: "Prometheus Infrastructure",
    files: [...WORKFLOW_V2_FIXTURE_REPAIR_SUCCESSOR.files],
    historicalFixtureSha256:
      "4181006b560cd2a192f08f94966d35ad076ee4da22e519217f86e90ae21cd35a",
    successorFixtureSha256:
      "45a7b5c8120f7a7a3a885c3ac0d92aba29756b84f792bfed0d0c572ad56383e6",
    previousInfrastructureContractSha256:
      PRE_WORKFLOW_V2_FIXTURE_REPAIR_INFRASTRUCTURE_CONTRACT_SHA256,
    currentInfrastructureContractSha256: INFRASTRUCTURE_CONTRACT_SHA256,
    rollbackArtifactSha256: ROLLBACK_BUNDLE_SHA256,
    jwtValidationRuntimeChanged: false,
    websiteOrCrmRuntimeChanged: false,
    productionTouched: false
  });

  assert.deepEqual(governance?.predeploymentSmokeRepair, {
    batchId: "BATCH-20260720-001",
    directive: "Route IQ Combined Final Preflight + Public Deployment v1",
    classification: "READ_ONLY_SMOKE_VERIFIER_CONTRACT_REPAIR",
    authorizedCandidate: {
      commit: FOURTH_OVERWATCH_SUCCESSOR.commit,
      tree: FOURTH_OVERWATCH_SUCCESSOR.tree,
      deploymentAssetsSha256: DEPLOYMENT_ASSETS_SHA256,
      rollbackContractSha256: HISTORICAL_ROLLBACK_CONTRACT_SHA256,
      deterministicRollbackBundleSha256: HISTORICAL_ROLLBACK_BUNDLE_SHA256,
      infrastructureContractSha256: "4eb1333e4013519fb62b2c1efb5fea6bad2399f2ddfdaa52ecec922d8f5fede6"
    },
    rootCause: "METHOD_AWARE_VALID_ALLOW_SETS_WERE_REJECTED_BY_A_LITERAL_SINGLE_VALUE_CHECK",
    liveObservation: {
      target: "prometheusrouteiq-website",
      path: "/api/partner-intake",
      requests: [
        { method: "GET", status: 405, allow: ["POST", "OPTIONS"] },
        { method: "HEAD", status: 405, allow: ["GET", "POST"] }
      ],
      methodsRestrictedTo: ["GET", "HEAD"],
      responseBodiesRetained: false,
      writeAttempted: false,
      productionMutation: false
    },
    ownerCommits: INFRASTRUCTURE_COMMITS.slice(5, 8).map(record => ({
      commit: record.commit,
      tree: record.tree,
      parent: record.parent,
      subject: record.subject,
      owner: "Prometheus Infrastructure",
      files: [...record.files]
    })),
    verification: {
      strictMethodAwareAllowSet: true,
      unknownMethodsRejected: true,
      lowercaseMethodsRejected: true,
      duplicateMethodsRejected: true,
      missingPostRejected: true,
      extraMethodsRejected: true,
      liveGetHeadSmokePassed: true
    },
    scope: {
      websiteImplementationChanged: false,
      crmImplementationChanged: false,
      generatedDeploymentAssetsChanged: false,
      rollbackContractChanged: false,
      deterministicRollbackBundleChanged: false,
      publicWorkerChanged: false,
      privateWorkerChanged: false
    },
    authorizationBoundary: {
      originalExactAuthorizationReusable: false,
      authorizationTransfersToSuccessorHead: false,
      workflowDispatched: false,
      deploymentPerformed: false,
      freshExactFounderAuthorizationRequired: true
    },
    overwatchVerificationRepair: {
      classification: "TEST_ONLY_STALE_LAST_INFRASTRUCTURE_INDEX",
      predecessorCommit: FIFTH_OVERWATCH_SUCCESSOR.commit,
      predecessorTree: FIFTH_OVERWATCH_SUCCESSOR.tree,
      predecessorParent: FIFTH_OVERWATCH_SUCCESSOR.parent,
      predecessorSubject: FIFTH_OVERWATCH_SUCCESSOR.subject,
      failedAssertionExpectedCommit: INFRASTRUCTURE_COMMITS[4].commit,
      failedAssertionActualCommit: INFRASTRUCTURE_COMMITS[7].commit,
      dashboardAdmissionStillPinned: true,
      smokeAdmissionNowPinned: true,
      productRuntimeModified: false,
      generatedDeploymentAssetsModified: false,
      productionModified: false
    }
  });

  assert.deepEqual(governance?.predeploymentClosure, {
    batchId: "BATCH-20260720-003",
    directive: "Autonomous Predeployment Closure",
    failedDeploymentRun: {
      runId: 29723618108,
      verificationJobId: 88291684567,
      failureClassification: "DIST_PUBLIC_READ_BEFORE_DETERMINISTIC_BUILD_ON_CLEAN_RUNNER",
      deploymentJobSkipped: true,
      protectedEnvironmentAccessed: false,
      cloudflareContacted: false,
      productionMutation: false
    },
    rejectedLocalCommit: {
      commit: "c7f8f80f0c64444efc1354f050dc304a9fd25ae1",
      tree: INFRASTRUCTURE_COMMITS[8].tree,
      author: "Prometheus Overwatch <overwatch@prometheus.local>",
      committer: "Prometheus Overwatch <overwatch@prometheus.local>",
      classification: "REJECTED_MIXED_OWNERSHIP_LOCAL_ONLY",
      archivalRef: "refs/archive-local/BATCH-20260720-003/rejected-overwatch-identity",
      pushAllowed: false,
      mergeAllowed: false,
      deploymentAllowed: false
    },
    ownerRepair: {
      commit: INFRASTRUCTURE_COMMITS[8].commit,
      tree: INFRASTRUCTURE_COMMITS[8].tree,
      parent: INFRASTRUCTURE_COMMITS[8].parent,
      owner: "Prometheus Infrastructure",
      authorEmail: "infrastructure@prometheus.local",
      committerEmail: "infrastructure@prometheus.local",
      subject: INFRASTRUCTURE_COMMITS[8].subject,
      binaryDiffEquivalentToRejectedCommit: true,
      websiteImplementationChanged: false,
      crmImplementationChanged: false,
      deploymentAssetsChanged: false,
      rollbackArtifactChanged: false,
      productionChanged: false
    },
    safeCiNextRunRequired: true,
    freshExactFounderDeploymentAuthorizationRequired: true
  });

  assert.deepEqual(governance?.keychainCiPortabilityClosure, {
    failedDeploymentRun: {
      runId: 29758138044,
      verificationJobId: 88405719162,
      deploymentJobId: 88405978303,
      failureClassification: "MACOS_SWIFTC_INVOKED_ON_LINUX_CLEAN_RUNNER",
      deploymentJobSkipped: true,
      protectedEnvironmentAccessed: false,
      cloudflareContacted: false,
      productionMutation: false
    },
    successors: KEYCHAIN_CI_SUCCESSORS.map(record => ({
      commit: record.commit,
      tree: record.tree,
      parent: record.parent,
      subject: record.subject,
      owner: record.ownerEmail === "overwatch@prometheus.local"
        ? "Prometheus Overwatch"
        : "Prometheus Infrastructure",
      files: [...record.files]
    })),
    infrastructureContractSha256: PRE_ASSET_ORDERING_INFRASTRUCTURE_CONTRACT_SHA256,
    macosSwiftTypecheckPreserved: true,
    linuxSwiftTypecheckNotApplicable: true,
    websiteImplementationChanged: false,
    crmImplementationChanged: false,
    deploymentAssetsChanged: false,
    rollbackContractChanged: false,
    productionChanged: false
  });

  assert.deepEqual(governance?.historicalKeychainFixtureClosure, {
    successors: KEYCHAIN_HISTORICAL_FIXTURE_SUCCESSORS.map(record => ({
      commit: record.commit,
      tree: record.tree,
      parent: record.parent,
      subject: record.subject,
      owner: record.ownerEmail === "overwatch@prometheus.local"
        ? "Prometheus Overwatch"
        : "Prometheus Infrastructure",
      files: [...record.files]
    })),
    historicalFixtureCommitPreserved: true,
    currentPortabilitySuccessorPreserved: true,
    ownerVerifierOwnershipTests: 6,
    websiteImplementationChanged: false,
    crmImplementationChanged: false,
    deploymentAssetsChanged: false,
    rollbackContractChanged: false,
    productionChanged: false
  });

  assert.deepEqual(governance?.dashboardRuntimeHarnessClosure, {
    batchId: "BATCH-20260720-005",
    directive: "Autonomous Predeployment Closure: Dashboard Runtime Harness",
    failedDeploymentRun: {
      runId: 29764135072,
      verificationJobId: 88425920616,
      deploymentJobId: 88426400617,
      head: "3a2bd37f779e070b868256178bc40dbede8605c8",
      tree: "e848b3454a296487e32891ca23e12d6a0f6d3d82",
      runner: "ubuntu-24.04",
      failure: "HARNESS_INFRASTRUCTURE_FETCH_FAILED",
      deploymentJobSkipped: true,
      protectedEnvironmentAccessed: false,
      cloudflareContacted: false,
      productionMutation: false
    },
    rootCauses: [
      "MACOS_ONLY_DEFAULT_CHROME_PATH_ON_UBUNTU",
      "ASYNCHRONOUS_SPAWN_FAILURE_MASKED_AS_GENERIC_FETCH_FAILURE",
      "UNRESERVED_RANDOM_CDP_PORT",
      "CLEANUP_REGISTERED_AFTER_READINESS",
      "READINESS_BUDGET_TOO_SHORT_UNDER_CPU_CONTENTION",
      "CDP_PAGE_TARGETS_NOT_CLOSED_BETWEEN_SCENARIOS"
    ],
    dashboardOwnerCommits: DASHBOARD_RUNTIME_HARNESS_SUCCESSORS.map(record => ({
      commit: record.commit,
      tree: record.tree,
      parent: record.parent,
      subject: record.subject,
      owner: "Prometheus Dashboard",
      files: [...record.files]
    })),
    infrastructureAdoption: {
      commit: INFRASTRUCTURE_COMMITS[9].commit,
      tree: INFRASTRUCTURE_COMMITS[9].tree,
      parent: INFRASTRUCTURE_COMMITS[9].parent,
      subject: INFRASTRUCTURE_COMMITS[9].subject,
      owner: "Prometheus Infrastructure",
      contractSha256: PRE_ASSET_ORDERING_INFRASTRUCTURE_CONTRACT_SHA256,
      safeWorkflowSha256: "f93f8e9e86b67f347714b2cf1bc36877d5572d73d2b36674bd7d6ee4a42df06f"
    },
    verification: {
      focusedTestsPassed: 18,
      browserWorkflowChecksPassed: 185,
      consecutiveRealChromeRunsPassed: 3,
      concurrentRealChromeLaunchesPassed: 4,
      startupInterruptCleanupPassed: true,
      placesPerformanceThresholdMs: 8000,
      performanceThresholdWeakened: false,
      safeWorkflowRunsFullRepositorySuite: true,
      safeWorkflowUsesProtectedEnvironment: false,
      safeWorkflowUsesSecrets: false,
      safeWorkflowCanDeploy: false,
      safeWorkflowCanWriteCrm: false
    },
    scope: {
      websiteImplementationChanged: false,
      crmImplementationChanged: false,
      deploymentAssetsChanged: false,
      rollbackContractChanged: false,
      rollbackBundleChanged: false,
      publicWorkerChanged: false,
      privateWorkerChanged: false
    }
  });

  assert.deepEqual(governance?.safeNoSecretAssetOrderingClosure, {
    batchId: "BATCH-20260720-006",
    directive: "Autonomous Predeployment Closure: Safe No-Secret Asset Ordering",
    failedSafeRun: {
      runId: 29776569151,
      jobId: 88467261279,
      head: DASHBOARD_RUNTIME_HARNESS_OVERWATCH_SUCCESSOR.commit,
      tree: DASHBOARD_RUNTIME_HARNESS_OVERWATCH_SUCCESSOR.tree,
      runner: "ubuntu-24.04",
      nodeVersion: "24.18.0",
      failure: "DIST_PUBLIC_READ_BEFORE_BUILD_IN_SAFE_NO_SECRET_WORKFLOW",
      deploymentCapability: false,
      protectedEnvironmentAccessed: false,
      secretsAccessed: false,
      cloudflareContacted: false,
      productionMutation: false
    },
    infrastructureRepair: {
      commit: INFRASTRUCTURE_COMMITS[10].commit,
      tree: INFRASTRUCTURE_COMMITS[10].tree,
      parent: INFRASTRUCTURE_COMMITS[10].parent,
      subject: INFRASTRUCTURE_COMMITS[10].subject,
      owner: "Prometheus Infrastructure",
      files: [...INFRASTRUCTURE_COMMITS[10].files],
      contractSha256: SAFE_NO_SECRET_ASSET_ORDERING_INFRASTRUCTURE_CONTRACT_SHA256,
      safeWorkflowSha256: "025bbc2fa4802a737d85d40d1ab3c38334c9458fa29b19a78f9b151da8bcb4b9"
    },
    verification: {
      deterministicBuildAfterNpmCi: true,
      deterministicBuildBeforeNpmTest: true,
      topLevelBuildSteps: 1,
      fullRepositorySuitePreserved: true,
      strictAssetParityPreserved: true,
      blanketRetryAdded: false,
      continueOnErrorAdded: false,
      failureHidden: false
    },
    scope: {
      websiteImplementationChanged: false,
      crmImplementationChanged: false,
      dashboardImplementationChanged: false,
      deploymentAssetsChanged: false,
      rollbackContractChanged: false,
      rollbackBundleChanged: false,
      publicWorkerChanged: false,
      privateWorkerChanged: false
    }
  });

  assert.deepEqual(governance?.cloudflareDeploymentReadClosure, {
    batchId: "BATCH-20260720-007",
    directive: "Autonomous Predeployment Closure: Cloudflare Deployment State Reads",
    failedDeploymentRun: {
      runId: 29780926642,
      verificationJobId: 88481727021,
      deploymentJobId: 88482773817,
      head: "5c920ad7c56289791d12c756d4b9627bf18b4632",
      tree: "5db5225a8f09d5e2295a89d4a7f2a3fa1305ff8b",
      observedElapsedMs: 15016,
      observedOutput: "DEPLOY_FAILED",
      preDeploymentSmokePassed: true,
      dryRunReached: false,
      uploadReached: false,
      publicVersionCreated: false,
      publicVersionUnchanged: true,
      privateVersionUnchanged: true,
      rollbackRequired: false,
      productionMutation: false
    },
    rootCause: "RESPONSE_BODY_READ_ABORT_ESCAPED_TRANSPORT_CLASSIFIER_AT_INSUFFICIENT_DEADLINE",
    infrastructureOwnerCommits: INFRASTRUCTURE_COMMITS.slice(11, 14).map(record => ({
      commit: record.commit,
      tree: record.tree,
      parent: record.parent,
      subject: record.subject,
      owner: "Prometheus Infrastructure"
    })),
    verification: {
      productionRequestTimeoutMs: 30000,
      testRequestTimeoutMaximumMs: 1000,
      maximumSerializedStateReads: 12,
      maximumSerializedReadBudgetMs: 360000,
      automaticRetries: 0,
      deploymentAttempts: 1,
      safePhaseClassifications: [
        "PUBLIC_DEPLOYMENTS",
        "PUBLIC_SETTINGS",
        "PRIVATE_DEPLOYMENTS",
        "PRIVATE_SETTINGS"
      ],
      secretOutputAllowed: false,
      unclassifiedBodyReadFailureAllowed: false
    },
    contracts: {
      deploymentPath: DEPLOYMENT_INFRASTRUCTURE_CONTRACT_PATH,
      deploymentSha256: CLOUDFLARE_READ_DEPLOYMENT_INFRASTRUCTURE_CONTRACT_SHA256,
      repositoryIntegrityPath: INFRASTRUCTURE_CONTRACT_PATH,
      repositoryIntegritySha256: CLOUDFLARE_READ_INFRASTRUCTURE_CONTRACT_SHA256
    },
    scope: {
      websiteImplementationChanged: false,
      crmImplementationChanged: false,
      deploymentAssetsChanged: false,
      rollbackContractChanged: false,
      rollbackBundleChanged: false,
      publicWorkerChanged: false,
      privateWorkerChanged: false
    }
  });

  assert.deepEqual(governance?.wranglerDeploymentFailureClosure, {
    batchId: "BATCH-20260720-008",
    directive: "Autonomous Predeployment Closure: Wrangler Deployment Failure Diagnostics",
    consumedDeploymentRun: {
      authorizationBatchId: "BATCH-20260720-007",
      runId: 29786701514,
      runNumber: 6,
      verificationJobId: 88499671929,
      deploymentJobId: 88500521088,
      head: CLOUDFLARE_DEPLOYMENT_READ_OVERWATCH_SUCCESSOR.commit,
      tree: CLOUDFLARE_DEPLOYMENT_READ_OVERWATCH_SUCCESSOR.tree,
      verificationPassed: true,
      preDeploymentSmokePassed: true,
      dryRunPassed: true,
      deployChildInvoked: true,
      deployChildExitedNonzero: true,
      observedOutput: "DEPLOY_FAILED",
      matchingSuccessfulCloudflareMutationAuditEntries: 0,
      publicVersionUnchanged: true,
      privateVersionUnchanged: true,
      rollbackRequired: false,
      productionMutationProven: false,
      authorizationReusable: false
    },
    evidenceReconciliation: {
      currentRunFailureDimension: "UNCLASSIFIABLE_FROM_PRE_REPAIR_WRAPPER",
      retroactiveReasonAssignmentAllowed: false,
      priorAssetAuditBatchId: "BATCH-20260720-006",
      priorAssetAuditRunId: 29780926642,
      priorAssetAuditLocalMinute: "2026-07-20 16:43 CDT",
      priorSuccessfulAssetUploadSessionEntries: 1,
      priorSuccessfulUploadAssetsEntries: 3,
      priorAssetAuditAttributedToCurrentRun: false
    },
    infrastructureRepair: {
      commit: INFRASTRUCTURE_COMMITS[14].commit,
      tree: INFRASTRUCTURE_COMMITS[14].tree,
      parent: INFRASTRUCTURE_COMMITS[14].parent,
      subject: INFRASTRUCTURE_COMMITS[14].subject,
      owner: "Prometheus Infrastructure",
      files: [...INFRASTRUCTURE_COMMITS[14].files],
      deploymentContractSha256: WRANGLER_DIAGNOSTIC_DEPLOYMENT_CONTRACT_SHA256
    },
    infrastructureProvenanceAdmission: {
      commit: INFRASTRUCTURE_COMMITS[15].commit,
      tree: INFRASTRUCTURE_COMMITS[15].tree,
      parent: INFRASTRUCTURE_COMMITS[15].parent,
      subject: INFRASTRUCTURE_COMMITS[15].subject,
      owner: "Prometheus Infrastructure",
      files: [...INFRASTRUCTURE_COMMITS[15].files],
      repositoryIntegrityContractSha256: WRANGLER_DIAGNOSTIC_INFRASTRUCTURE_CONTRACT_SHA256,
      exactSuccessorOnly: true,
      genericInfrastructureSuccessorsAllowed: false
    },
    verification: {
      fixedOutputFields: ["WRANGLER_PHASE", "WRANGLER_FAILURE_REASON"],
      phases: ["DRY_RUN", "DEPLOY"],
      rawChildOutputAllowed: false,
      outputStringMaterializationAllowed: false,
      capturedOutputZeroized: true,
      oneChildInvocationPerMode: true,
      wrapperRetries: 0,
      timeoutKillsChild: true,
      overflowKillsChild: true,
      ambiguousOutputFailsClosed: true,
      secretDisclosureAllowed: false
    },
    scope: {
      websiteImplementationChanged: false,
      crmImplementationChanged: false,
      deploymentAssetsChanged: false,
      rollbackContractChanged: false,
      rollbackBundleChanged: false,
      deploymentWorkflowChanged: false,
      publicWorkerChanged: false,
      privateWorkerChanged: false
    },
    releaseBoundary: {
      deploymentPerformed: false,
      deploymentAuthorizationReusable: false,
      freshExactFounderAuthorizationRequired: true,
      safeNoSecretCiRequired: true
    }
  });

  assert.deepEqual(governance?.publicWorkerStartupFailureClosure, {
    batchId: "BATCH-20260720-009",
    directive: "Autonomous Predeployment Closure: Public Worker Workerd Startup",
    consumedDeploymentRun: {
      authorizationBatchId: "BATCH-20260720-008",
      runId: 29795006056,
      runNumber: 7,
      verificationJobId: 88524441880,
      deploymentJobId: 88525105691,
      head: WRANGLER_DIAGNOSTIC_FINAL_OVERWATCH_SUCCESSOR.commit,
      tree: WRANGLER_DIAGNOSTIC_FINAL_OVERWATCH_SUCCESSOR.tree,
      verificationPassed: true,
      deployStepReached: true,
      wranglerDeployAttempted: true,
      reportedCloudflareCode: 10021,
      publicVersionCreated: false,
      publicCrmNamespaceCreated: false,
      publicVersionUnchanged: true,
      privateVersionUnchanged: true,
      rollbackRequired: false,
      productionMutation: false,
      authorizationReusable: false
    },
    correctedClassification: {
      predecessor: "MIGRATION_BINDING_CONFIG_REJECTED",
      actual: "WORKER_RUNTIME_STARTUP_REJECTED",
      genericCloudflareCodeTreatedAsSpecificCause: false,
      rootCauseSequence: [
        "WORKER_RUNTIME_FILESYSTEM_IMPORT_AT_MODULE_STARTUP",
        "INVALID_PUBLIC_EXPORT_SURFACE"
      ]
    },
    ownerRepairs: [
      {
        commit: PUBLIC_WORKER_STARTUP_INTELLIGENCE_REPAIR.commit,
        tree: PUBLIC_WORKER_STARTUP_INTELLIGENCE_REPAIR.tree,
        parent: PUBLIC_WORKER_STARTUP_INTELLIGENCE_REPAIR.parent,
        subject: PUBLIC_WORKER_STARTUP_INTELLIGENCE_REPAIR.subject,
        owner: "Prometheus Intelligence",
        files: [...PUBLIC_WORKER_STARTUP_INTELLIGENCE_REPAIR.files]
      },
      ...INFRASTRUCTURE_COMMITS.slice(16, 19).map(record => ({
        commit: record.commit,
        tree: record.tree,
        parent: record.parent,
        subject: record.subject,
        owner: "Prometheus Infrastructure",
        files: [...record.files]
      }))
    ],
    verification: {
      publicEntryAdapter: "workers/infrastructure/prometheusrouteiq-website-entry.mjs",
      publicEntryExports: ["default", "RouteIqRequestCrmCoordinator"],
      workerdPreflightBeforeCloudflare: true,
      workerdPreflightMethod: "HEAD",
      workerdPreflightExpectedStatus: 200,
      secretValuesRequired: false,
      automaticRetries: 0,
      cloudflareRequestsDuringRepair: false,
      focusedDeploymentTestsPassed: 25,
      focusedIntelligenceTestsPassed: 5,
      repositoryIntegrityOwnerTestsPassed: 30,
      wrongOwnerRejected: true,
      reorderedChainRejected: true,
      widenedAdmissionRejected: true,
      extraSuccessorRejected: true
    },
    contracts: {
      deploymentPath: DEPLOYMENT_INFRASTRUCTURE_CONTRACT_PATH,
      deploymentSha256: DEPLOYMENT_INFRASTRUCTURE_CONTRACT_SHA256,
      repositoryIntegrityPath: INFRASTRUCTURE_CONTRACT_PATH,
      repositoryIntegritySha256: PUBLIC_WORKER_STARTUP_INFRASTRUCTURE_CONTRACT_SHA256,
      rollbackPath: ROLLBACK_CONTRACT_PATH,
      rollbackSha256: PRE_FOUNDER_JWT_REPAIR_ROLLBACK_CONTRACT_SHA256,
      deterministicRollbackBundleSha256: PRE_FOUNDER_JWT_REPAIR_ROLLBACK_BUNDLE_SHA256,
      deploymentAssetsSha256: DEPLOYMENT_ASSETS_SHA256
    },
    scope: {
      websiteImplementationChanged: false,
      crmImplementationChanged: false,
      deploymentAssetsChanged: false,
      publicWorkerRuntimeChanged: true,
      publicWorkerProductionChanged: false,
      privateWorkerChanged: false
    },
    releaseBoundary: {
      deploymentPerformed: false,
      deploymentAuthorizationReusable: false,
      freshExactFounderAuthorizationRequired: true,
      safeNoSecretCiRequired: true
    }
  });

  assert.deepEqual(governance?.publicConfigConsumerRepairClosure, {
    batchId: "BATCH-20260720-010",
    directive: "Autonomous Predeployment Closure: Public Config Consumer Alignment",
    triggeringVerification: {
      head: PUBLIC_WORKER_STARTUP_OVERWATCH_SUCCESSOR.commit,
      tree: PUBLIC_WORKER_STARTUP_OVERWATCH_SUCCESSOR.tree,
      command: "npm test",
      failingGate: "overwatch:route-iq-3d-visual-continuity:check",
      classification: "STALE_PUBLIC_CONFIG_CONSUMER_PIN",
      failureHidden: false,
      suiteWeakened: false
    },
    ownerRepairs: INFRASTRUCTURE_COMMITS.slice(19, 21).map(record => ({
      commit: record.commit,
      tree: record.tree,
      parent: record.parent,
      subject: record.subject,
      owner: "Prometheus Infrastructure",
      files: [...record.files]
    })),
    verification: {
      publicConfigSha256: "5b8e16a1e49172f20ef617d09e6e655b5ee453600b486fe5d216ebe5453b56f0",
      publicEntryAdapterSha256: "045c768163e043b1429d51dacf33f842966a323eb080d0e1cf45debfc7ccebf5",
      onlyAdmittedSemanticChange: "main",
      workersDevOff: true,
      previewUrlsOff: true,
      apexAndWwwPreserved: true,
      accessAndWafBoundariesPreserved: true,
      crmClassBindingAndMigrationPreserved: true,
      publicPrivateIsolationPreserved: true,
      focusedEdgeTestsPassed: 7,
      repositoryIntegrityOwnerTestsPassed: 31,
      cloudflareContacted: false,
      deploymentPerformed: false
    },
    overwatchConsumerAdmission: {
      classification: "EXACT_INTELLIGENCE_STARTUP_PATH_ADMISSION",
      ownerRepairCommit: PUBLIC_WORKER_STARTUP_INTELLIGENCE_REPAIR.commit,
      allowedPath: "intelligence/route-iq-prospective-retention-admission.mjs",
      otherIntelligencePathsAllowed: false,
      historicalVisualBaselineRewritten: false
    },
    overwatchTestAlignment: {
      classification: "CURRENT_ROLLBACK_BUNDLE_EXPECTATION_ALIGNMENT",
      historicalRollbackEvidencePreserved: true,
      currentDeterministicRollbackBundleSha256: PRE_FOUNDER_JWT_REPAIR_ROLLBACK_BUNDLE_SHA256,
      testWeakened: false
    },
    retentionConsumerAdmission: {
      classification: "EXACT_INTELLIGENCE_RETENTION_RUNTIME_SUCCESSOR",
      ownerRepairCommit: PUBLIC_WORKER_STARTUP_INTELLIGENCE_REPAIR.commit,
      previousRuntimeSha256: "eea1a1f1e9a6fde8fdc8c9fe1e5606a240bbe97ac533ece88342cf7555787780",
      currentRuntimeSha256: "9d2ef3b3ff4a440432ab31af041aa3c19e55c384ac788c2a4e0c7db7452bfcda",
      retentionDecisionChanged: false,
      policyHashChanged: false,
      otherIntelligenceSuccessorsAllowed: false
    },
    pausedUnattendedAccessAlignment: {
      classification: "EXACT_INFRASTRUCTURE_PUBLIC_ADAPTER_SUCCESSOR_COUNT_ALIGNMENT",
      ownerRepairCommit: "94061fea1c238ca854bde9d17a860e1375af9c52",
      previousSubsystemSuccessorCount: 11,
      currentSubsystemSuccessorCount: 12,
      unattendedAccessResumed: false,
      credentialOrRuntimeBehaviorChanged: false,
      testWeakened: false
    },
    contracts: {
      edgeBoundaryPath: "workers/infrastructure/route-iq-public-crm-edge-boundary-v1.json",
      edgeBoundarySha256: "8308c4a69d52667d192e943d9ef45d9875ca3bcb835561f3765ec7b56253e53d",
      repositoryIntegrityPath: INFRASTRUCTURE_CONTRACT_PATH,
      repositoryIntegritySha256: PRE_FOUNDER_JWT_REPAIR_INFRASTRUCTURE_CONTRACT_SHA256,
      previousRepositoryIntegritySha256: PRE_AUTHORIZATION_BOUNDARY_INFRASTRUCTURE_CONTRACT_SHA256,
      preWorkflowV2RepositoryIntegritySha256: PRE_WORKFLOW_V2_ADMISSION_INFRASTRUCTURE_CONTRACT_SHA256,
      deterministicRollbackBundleSha256: PRE_FOUNDER_JWT_REPAIR_ROLLBACK_BUNDLE_SHA256
    },
    scope: {
      websiteImplementationChanged: false,
      crmImplementationChanged: false,
      deploymentAssetsChanged: false,
      publicWorkerProductionChanged: false,
      privateWorkerChanged: false
    },
    releaseBoundary: {
      deploymentPerformed: false,
      deploymentAuthorizationReusable: false,
      freshExactFounderAuthorizationRequired: true,
      safeNoSecretCiRequired: true
    }
  });

  assert.deepEqual(governance?.productionIdentities, {
    publicWorker: {
      name: "prometheusrouteiq-website",
      version: "28c6ffbc-86dc-4037-aaff-5c74f5fe990e",
      trafficPercent: 100
    },
    privateWorker: {
      name: "prometheus-iq",
      version: "b8cba784-dfd3-4f8e-8356-816cccf6aecc",
      trafficPercent: 100
    },
    changedByBatch: false
  });
  assert.deepEqual(governance?.crmPublicAdapterRepairClosure, {
    classification: "EXACT_CRM_ADAPTER_REPAIR_AND_INFRASTRUCTURE_PROVENANCE_ADMISSION",
    crmOwnerRepair: {
      commit: CRM_PUBLIC_ADAPTER_REPAIR.commit,
      tree: CRM_PUBLIC_ADAPTER_REPAIR.tree,
      parent: CRM_PUBLIC_ADAPTER_REPAIR.parent,
      subject: CRM_PUBLIC_ADAPTER_REPAIR.subject,
      owner: "Prometheus CRM",
      files: [...CRM_PUBLIC_ADAPTER_REPAIR.files],
      crmBehaviorChanged: false,
      crmSchemaChanged: false
    },
    infrastructureProvenanceAdmission: {
      commit: INFRASTRUCTURE_COMMITS[21].commit,
      tree: INFRASTRUCTURE_COMMITS[21].tree,
      contractSha256: PRE_WORKFLOW_V2_ADMISSION_INFRASTRUCTURE_CONTRACT_SHA256,
      crmCommitSubstitutionAllowed: false,
      mixedOwnershipAllowed: false
    },
    deploymentAssetsChanged: false,
    rollbackArtifactsChanged: false,
    productionChanged: false
  });
  assert.equal(governance?.safeNonDeploymentCi?.workflow, ".github/workflows/verify-prometheus-public-repository-integrity.yml");
  assert.equal(governance?.safeNonDeploymentCi?.trigger, "workflow_dispatch");
  assert.equal(governance?.safeNonDeploymentCi?.dispatchAuthorizedAfterVerifiedFastForwardPush, true);
  assert.equal(governance?.safeNonDeploymentCi?.resultRecordedExternally, true);
  assert.equal(governance?.safeNonDeploymentCi?.mustPassBeforeFreshDeploymentReview, true);
  assert.equal(governance?.safeNonDeploymentCi?.fullRepositorySuiteRequired, true);
  assert.equal(governance?.safeNonDeploymentCi?.dashboardRuntimeHarnessRequired, true);
  assert.equal(
    governance?.safeNonDeploymentCi?.workflowSha256,
    "025bbc2fa4802a737d85d40d1ab3c38334c9458fa29b19a78f9b151da8bcb4b9"
  );
  for (const field of [
    "protectedEnvironmentUsed",
    "secretsAllowed",
    "cloudflareAccessAllowed",
    "deploymentCapability",
    "crmWriteCapability"
  ]) assert.equal(governance?.safeNonDeploymentCi?.[field], false);
  assert.equal(governance?.safeNonDeploymentCi?.nextRunRequired, true);
  assert.deepEqual(governance?.safeNonDeploymentCi?.latestRun, {
    runId: 29776569151,
    jobId: 88467261279,
    head: DASHBOARD_RUNTIME_HARNESS_OVERWATCH_SUCCESSOR.commit,
    tree: DASHBOARD_RUNTIME_HARNESS_OVERWATCH_SUCCESSOR.tree,
    repositoryIntegrity: "PASS",
    dependencyInstall: "PASS",
    fullRepositorySuite: "FAIL",
    ownerVerifier: "NOT_REACHED",
    classification: "DIST_PUBLIC_READ_BEFORE_BUILD_IN_SAFE_NO_SECRET_WORKFLOW",
    exactCause: "SAFE_WORKFLOW_BUILD_RAN_AFTER_FIRST_GENERATED_ASSET_CONSUMER",
    consumed: true,
    deploymentCapability: false,
    protectedEnvironmentUsed: false,
    secretsAccessed: false,
    cloudflareContacted: false,
    productionMutation: false
  });

  assert.deepEqual(governance?.august1LaunchCloseoutSuccessor, {
    classification: "CONTROLLING_CURRENT_OWNER_SUCCESSOR",
    historicalReadinessPreserved: true,
    historicalReleaseIdentitiesRemainNoncurrent: true,
    websiteSuccessor: {
      ...WEBSITE_SUCCESSOR,
      files: [...WEBSITE_SUCCESSOR.files]
    },
    rollbackSuccessor: {
      ...ROLLBACK_SUCCESSOR,
      files: ROLLBACK_SUCCESSOR.files.map(item => ({ ...item }))
    },
    provenanceAdmission: {
      ...PROVENANCE_ADMISSION,
      files: PROVENANCE_ADMISSION.files.map(item => ({ ...item }))
    },
    overwatchPredecessors: [
      {
        ...INITIAL_OVERWATCH_SUCCESSOR,
        files: [...INITIAL_OVERWATCH_SUCCESSOR.files]
      },
      {
        ...MANIFEST_REPAIR_SUCCESSOR,
        files: [...MANIFEST_REPAIR_SUCCESSOR.files]
      },
      {
        ...PROVENANCE_CLOSURE_SUCCESSOR,
        files: [...PROVENANCE_CLOSURE_SUCCESSOR.files]
      },
      {
        ...WORKFLOW_PIN_REFRESH_SUCCESSOR,
        files: [...WORKFLOW_PIN_REFRESH_SUCCESSOR.files]
      }
    ],
    qualificationPredecessors: QUALIFICATION_SUCCESSORS.map(successor => ({
      ...successor,
      files: [...successor.files]
    })),
    overwatchSuccessor: {
      ...OVERWATCH_SUCCESSOR,
      files: [...OVERWATCH_SUCCESSOR.files]
    },
    currentReleaseIdentities: {
      deploymentAssetsSha256: CURRENT_DEPLOYMENT_ASSETS_SHA256,
      rollbackContractSha256: CURRENT_ROLLBACK_CONTRACT_SHA256,
      deterministicRollbackBundleSha256: CURRENT_ROLLBACK_BUNDLE_SHA256,
      infrastructureIntegrityContractSha256: CURRENT_INFRASTRUCTURE_CONTRACT_SHA256
    },
    productionTouched: false,
    deploymentAuthorized: false
  });

  assert.equal(governance?.safetyState?.prospectiveCollection, "OFF");
  assert.equal(governance?.safetyState?.activeCohorts, 0);
  assert.equal(governance?.safetyState?.recommendationInfluence, "OFF");
  for (const field of [
    "anthonyMapped",
    "deploymentPerformed",
    "productionDataChanged",
    "crmRequestSubmitted",
    "notificationSent"
  ]) assert.equal(governance?.safetyState?.[field], false);

  assert.equal(governance?.releaseBoundary?.deploymentAuthorized, false);
  assert.equal(governance?.releaseBoundary?.deploymentWorkflowDispatchAuthorized, false);
  assert.equal(governance?.releaseBoundary?.failedDeploymentAuthorizationReusable, false);
  assert.equal(governance?.releaseBoundary?.safeIntegrityWorkflowDispatchAuthorized, true);
  assert.equal(governance?.releaseBoundary?.cloudflareMutationAuthorized, false);
  assert.equal(governance?.releaseBoundary?.secretAccessAuthorized, false);
  assert.equal(governance?.releaseBoundary?.normalFastForwardPushAllowedAfterExactHeadPass, true);
  assert.equal(governance?.releaseBoundary?.archivalRefsPushAllowed, false);
  assert.equal(governance?.releaseBoundary?.freshFounderDeploymentReviewRequired, true);
  assert.equal(governance?.releaseBoundary?.combinedDeploymentAuthorizationReusable, false);
  assert.equal(governance?.releaseBoundary?.freshExactCandidateAuthorizationRequired, true);
  return governance;
}

function verifyExactCommit(root, expected) {
  assert.equal(git(root, "rev-parse", `${expected.commit}^{tree}`), expected.tree);
  assert.equal(git(root, "rev-parse", `${expected.commit}^`), expected.parent);
  const actual = exactCommitRecord(root, expected.commit);
  assert.equal(actual.author, expected.author);
  assert.equal(actual.committer, expected.committer);
  assert.equal(actual.subject, expected.subject);
  const expectedPaths = expected.files.map(item => typeof item === "string" ? item : item.path);
  assert.deepEqual(sorted(actual.files), sorted(expectedPaths));
  for (const evidence of expected.files.filter(item => typeof item !== "string")) {
    assert.equal(
      sha256(readAtCommit(root, expected.commit, evidence.path)),
      evidence.sha256,
      `Owner evidence drifted at ${expected.commit}: ${evidence.path}`
    );
  }
}

function verifyCurrentOwnerSuccessor(root, requireCommittedOverwatch) {
  for (const expected of [
    WEBSITE_SUCCESSOR,
    ROLLBACK_SUCCESSOR,
    PROVENANCE_ADMISSION,
    INITIAL_OVERWATCH_SUCCESSOR,
    MANIFEST_REPAIR_SUCCESSOR,
    PROVENANCE_CLOSURE_SUCCESSOR,
    WORKFLOW_PIN_REFRESH_SUCCESSOR,
    ...QUALIFICATION_SUCCESSORS
  ]) {
    verifyExactCommit(root, expected);
  }
  const ownerBoundary = verifyInfrastructureOwnerBoundary(
    root,
    CURRENT_INFRASTRUCTURE_OWNER_BOUNDARY
  );
  assert.equal(
    ownerBoundary.august1LaunchCloseoutSuccessorsSeen,
    CURRENT_INFRASTRUCTURE_OWNER_BOUNDARY.august1LaunchCloseoutSuccessors.length
  );

  const head = git(root, "rev-parse", "HEAD");
  if (requireCommittedOverwatch) {
    assert.equal(ownerBoundary.august1LaunchCloseoutAdmissionSeen, true);
    assert.notEqual(head, OVERWATCH_SUCCESSOR.parent, "Governed Overwatch successor is missing.");
    assert.equal(git(root, "rev-parse", `${head}^`), OVERWATCH_SUCCESSOR.parent);
    const actual = exactCommitRecord(root, head);
    assert.equal(actual.author, OVERWATCH_SUCCESSOR.author);
    assert.equal(actual.committer, OVERWATCH_SUCCESSOR.committer);
    assert.equal(actual.subject, OVERWATCH_SUCCESSOR.subject);
    assert.deepEqual(sorted(actual.files), sorted(OVERWATCH_SUCCESSOR.files));
  } else {
    assert.ok(
      head === OVERWATCH_SUCCESSOR.parent || ownerBoundary.august1LaunchCloseoutAdmissionSeen,
      "Current owner evidence does not resolve through the exact Overwatch successor."
    );
  }
}

function verifyOwnership(root, requireCommittedOverwatch) {
  assert.equal(git(root, "rev-parse", `${HISTORICAL_SUCCESSOR_COMMIT}^{tree}`), HISTORICAL_SUCCESSOR_TREE);
  assert.equal(git(root, "rev-list", "--min-parents=2", `${HISTORICAL_SUCCESSOR_COMMIT}..HEAD`), "");
  const commits = git(root, "rev-list", "--reverse", `${HISTORICAL_SUCCESSOR_COMMIT}..HEAD`)
    .split("\n")
    .filter(Boolean);
  assert.ok(commits.length >= 64);
  assert.deepEqual(commits.slice(0, 26), [
    INFRASTRUCTURE_COMMITS[0].commit,
    INFRASTRUCTURE_COMMITS[1].commit,
    FIRST_OVERWATCH_SUCCESSOR.commit,
    INFRASTRUCTURE_COMMITS[2].commit,
    SECOND_OVERWATCH_SUCCESSOR.commit,
    INFRASTRUCTURE_COMMITS[3].commit,
    THIRD_OVERWATCH_SUCCESSOR.commit,
    DASHBOARD_VERIFICATION_SUCCESSOR.commit,
    INFRASTRUCTURE_COMMITS[4].commit,
    FOURTH_OVERWATCH_SUCCESSOR.commit,
    INFRASTRUCTURE_COMMITS[5].commit,
    INFRASTRUCTURE_COMMITS[6].commit,
    INFRASTRUCTURE_COMMITS[7].commit,
    FIFTH_OVERWATCH_SUCCESSOR.commit,
    SIXTH_OVERWATCH_SUCCESSOR.commit,
    INFRASTRUCTURE_COMMITS[8].commit,
    SEVENTH_OVERWATCH_SUCCESSOR.commit,
    ...KEYCHAIN_CI_SUCCESSORS.map(record => record.commit),
    EIGHTH_OVERWATCH_SUCCESSOR.commit,
    ...KEYCHAIN_HISTORICAL_FIXTURE_SUCCESSORS.map(record => record.commit)
  ]);
  assert.deepEqual(commits.slice(26, 33), [
    HISTORICAL_KEYCHAIN_CLOSURE_SUCCESSOR.commit,
    ...DASHBOARD_RUNTIME_HARNESS_SUCCESSORS.map(record => record.commit),
    INFRASTRUCTURE_COMMITS[9].commit,
    DASHBOARD_RUNTIME_HARNESS_OVERWATCH_SUCCESSOR.commit,
    INFRASTRUCTURE_COMMITS[10].commit,
    SAFE_NO_SECRET_ASSET_ORDERING_OVERWATCH_SUCCESSOR.commit
  ]);
  assert.deepEqual(commits.slice(33, 36), INFRASTRUCTURE_COMMITS.slice(11, 14)
    .map(record => record.commit));
  assert.equal(commits[36], CLOUDFLARE_DEPLOYMENT_READ_OVERWATCH_SUCCESSOR.commit);
  assert.equal(commits[37], INFRASTRUCTURE_COMMITS[14].commit);
  assert.equal(commits[38], INFRASTRUCTURE_COMMITS[15].commit);
  assert.equal(commits[39], WRANGLER_DEPLOYMENT_FAILURE_OVERWATCH_SUCCESSOR.commit);
  assert.equal(commits[40], WRANGLER_DIAGNOSTIC_VERIFICATION_OVERWATCH_SUCCESSOR.commit);
  assert.equal(commits[41], WRANGLER_DIAGNOSTIC_FINAL_OVERWATCH_SUCCESSOR.commit);
  assert.equal(commits[42], PUBLIC_WORKER_STARTUP_INTELLIGENCE_REPAIR.commit);
  assert.deepEqual(commits.slice(43, 46), INFRASTRUCTURE_COMMITS.slice(16, 19)
    .map(record => record.commit));
  assert.equal(commits[46], PUBLIC_WORKER_STARTUP_OVERWATCH_SUCCESSOR.commit);
  assert.deepEqual(commits.slice(47, 49), INFRASTRUCTURE_COMMITS.slice(19, 21)
    .map(record => record.commit));
  assert.equal(commits[49], PUBLIC_CONFIG_CONSUMER_OVERWATCH_SUCCESSOR.commit);
  assert.equal(commits[50], INTELLIGENCE_3D_BOUNDARY_OVERWATCH_SUCCESSOR.commit);
  assert.equal(commits[51], CURRENT_ROLLBACK_TEST_OVERWATCH_SUCCESSOR.commit);
  assert.equal(commits[52], INTELLIGENCE_RETENTION_BOUNDARY_OVERWATCH_SUCCESSOR.commit);
  assert.equal(commits[53], PAUSED_ACCESS_ALIGNMENT_OVERWATCH_SUCCESSOR.commit);
  assert.equal(commits[54], CRM_PUBLIC_ADAPTER_REPAIR.commit);
  assert.equal(commits[55], INFRASTRUCTURE_COMMITS[21].commit);
  assert.equal(commits[56], CRM_PUBLIC_ADAPTER_OVERWATCH_SUCCESSOR.commit);
  assert.equal(commits[57], INFRASTRUCTURE_COMMITS[22].commit);
  assert.equal(commits[58], WORKFLOW_V2_OVERWATCH_GOVERNANCE.commit);
  assert.equal(commits[59], INFRASTRUCTURE_COMMITS[23].commit);
  assert.equal(commits[60], WORKFLOW_V2_OVERWATCH_PROVENANCE_PIN.commit);
  assert.equal(commits[61], WORKFLOW_V2_READINESS_CLOSURE.commit);
  assert.equal(commits[62], WORKFLOW_V2_FINAL_READINESS_CLOSURE.commit);
  assert.equal(commits[63], WORKFLOW_V2_RELEASE_WIRING_CLOSURE.commit);

  for (const expected of INFRASTRUCTURE_COMMITS) {
    assert.equal(git(root, "rev-parse", `${expected.commit}^{tree}`), expected.tree);
    const record = commitRecord(root, expected.commit);
    assert.equal(record.author, "infrastructure@prometheus.local");
    assert.equal(record.committer, "infrastructure@prometheus.local");
    assert.equal(record.subject, expected.subject);
    assert.deepEqual(record.files, [...expected.files]);
    assert.equal(git(root, "rev-parse", `${expected.commit}^`), expected.parent);
  }

  assert.equal(git(root, "rev-parse", `${FIRST_OVERWATCH_SUCCESSOR.commit}^{tree}`), FIRST_OVERWATCH_SUCCESSOR.tree);
  assert.equal(git(root, "rev-parse", `${FIRST_OVERWATCH_SUCCESSOR.commit}^`), FIRST_OVERWATCH_SUCCESSOR.parent);
  const firstOverwatch = commitRecord(root, FIRST_OVERWATCH_SUCCESSOR.commit);
  assert.equal(firstOverwatch.author, "overwatch@prometheus.local");
  assert.equal(firstOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(firstOverwatch.subject, FIRST_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(sorted(firstOverwatch.files), sorted(FIRST_OVERWATCH_SUCCESSOR_PATHS));

  assert.equal(git(root, "rev-parse", `${SECOND_OVERWATCH_SUCCESSOR.commit}^{tree}`), SECOND_OVERWATCH_SUCCESSOR.tree);
  assert.equal(git(root, "rev-parse", `${SECOND_OVERWATCH_SUCCESSOR.commit}^`), SECOND_OVERWATCH_SUCCESSOR.parent);
  const secondOverwatch = commitRecord(root, SECOND_OVERWATCH_SUCCESSOR.commit);
  assert.equal(secondOverwatch.author, "overwatch@prometheus.local");
  assert.equal(secondOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(secondOverwatch.subject, SECOND_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(sorted(secondOverwatch.files), sorted(SECOND_OVERWATCH_SUCCESSOR_PATHS));

  assert.equal(git(root, "rev-parse", `${THIRD_OVERWATCH_SUCCESSOR.commit}^{tree}`), THIRD_OVERWATCH_SUCCESSOR.tree);
  assert.equal(git(root, "rev-parse", `${THIRD_OVERWATCH_SUCCESSOR.commit}^`), THIRD_OVERWATCH_SUCCESSOR.parent);
  const thirdOverwatch = commitRecord(root, THIRD_OVERWATCH_SUCCESSOR.commit);
  assert.equal(thirdOverwatch.author, "overwatch@prometheus.local");
  assert.equal(thirdOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(thirdOverwatch.subject, THIRD_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(sorted(thirdOverwatch.files), sorted(FINAL_OVERWATCH_SUCCESSOR_PATHS));

  assert.equal(
    git(root, "rev-parse", `${DASHBOARD_VERIFICATION_SUCCESSOR.commit}^{tree}`),
    DASHBOARD_VERIFICATION_SUCCESSOR.tree
  );
  assert.equal(
    git(root, "rev-parse", `${DASHBOARD_VERIFICATION_SUCCESSOR.commit}^`),
    DASHBOARD_VERIFICATION_SUCCESSOR.parent
  );
  const dashboard = commitRecord(root, DASHBOARD_VERIFICATION_SUCCESSOR.commit);
  assert.equal(dashboard.author, "dashboard@prometheus.local");
  assert.equal(dashboard.committer, "dashboard@prometheus.local");
  assert.equal(dashboard.subject, DASHBOARD_VERIFICATION_SUCCESSOR.subject);
  assert.deepEqual(sorted(dashboard.files), sorted(DASHBOARD_VERIFICATION_SUCCESSOR.files));

  assert.equal(git(root, "rev-parse", `${FOURTH_OVERWATCH_SUCCESSOR.commit}^{tree}`), FOURTH_OVERWATCH_SUCCESSOR.tree);
  assert.equal(git(root, "rev-parse", `${FOURTH_OVERWATCH_SUCCESSOR.commit}^`), FOURTH_OVERWATCH_SUCCESSOR.parent);
  const fourthOverwatch = commitRecord(root, FOURTH_OVERWATCH_SUCCESSOR.commit);
  assert.equal(fourthOverwatch.author, "overwatch@prometheus.local");
  assert.equal(fourthOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(fourthOverwatch.subject, FOURTH_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(sorted(fourthOverwatch.files), sorted(FINAL_OVERWATCH_SUCCESSOR_PATHS));

  assert.equal(git(root, "rev-parse", `${FIFTH_OVERWATCH_SUCCESSOR.commit}^{tree}`), FIFTH_OVERWATCH_SUCCESSOR.tree);
  assert.equal(git(root, "rev-parse", `${FIFTH_OVERWATCH_SUCCESSOR.commit}^`), FIFTH_OVERWATCH_SUCCESSOR.parent);
  const fifthOverwatch = commitRecord(root, FIFTH_OVERWATCH_SUCCESSOR.commit);
  assert.equal(fifthOverwatch.author, "overwatch@prometheus.local");
  assert.equal(fifthOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(fifthOverwatch.subject, FIFTH_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(sorted(fifthOverwatch.files), sorted(FINAL_OVERWATCH_SUCCESSOR_PATHS));

  assert.equal(git(root, "rev-parse", `${SIXTH_OVERWATCH_SUCCESSOR.commit}^{tree}`), SIXTH_OVERWATCH_SUCCESSOR.tree);
  assert.equal(git(root, "rev-parse", `${SIXTH_OVERWATCH_SUCCESSOR.commit}^`), SIXTH_OVERWATCH_SUCCESSOR.parent);
  const sixthOverwatch = commitRecord(root, SIXTH_OVERWATCH_SUCCESSOR.commit);
  assert.equal(sixthOverwatch.author, "overwatch@prometheus.local");
  assert.equal(sixthOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(sixthOverwatch.subject, SIXTH_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(sorted(sixthOverwatch.files), sorted(FINAL_OVERWATCH_SUCCESSOR_PATHS));

  assert.equal(git(root, "rev-parse", `${SEVENTH_OVERWATCH_SUCCESSOR.commit}^{tree}`), SEVENTH_OVERWATCH_SUCCESSOR.tree);
  assert.equal(git(root, "rev-parse", `${SEVENTH_OVERWATCH_SUCCESSOR.commit}^`), SEVENTH_OVERWATCH_SUCCESSOR.parent);
  const seventhOverwatch = commitRecord(root, SEVENTH_OVERWATCH_SUCCESSOR.commit);
  assert.equal(seventhOverwatch.author, "overwatch@prometheus.local");
  assert.equal(seventhOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(seventhOverwatch.subject, SEVENTH_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(sorted(seventhOverwatch.files), sorted(FINAL_OVERWATCH_SUCCESSOR_PATHS));

  for (const expected of KEYCHAIN_CI_SUCCESSORS) {
    assert.equal(git(root, "rev-parse", `${expected.commit}^{tree}`), expected.tree);
    assert.equal(git(root, "rev-parse", `${expected.commit}^`), expected.parent);
    const record = commitRecord(root, expected.commit);
    assert.equal(record.author, expected.ownerEmail);
    assert.equal(record.committer, expected.ownerEmail);
    assert.equal(record.subject, expected.subject);
    assert.deepEqual(sorted(record.files), sorted(expected.files));
  }

  assert.equal(git(root, "rev-parse", `${EIGHTH_OVERWATCH_SUCCESSOR.commit}^{tree}`), EIGHTH_OVERWATCH_SUCCESSOR.tree);
  assert.equal(git(root, "rev-parse", `${EIGHTH_OVERWATCH_SUCCESSOR.commit}^`), EIGHTH_OVERWATCH_SUCCESSOR.parent);
  const eighthOverwatch = commitRecord(root, EIGHTH_OVERWATCH_SUCCESSOR.commit);
  assert.equal(eighthOverwatch.author, "overwatch@prometheus.local");
  assert.equal(eighthOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(eighthOverwatch.subject, EIGHTH_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(sorted(eighthOverwatch.files), sorted(FINAL_OVERWATCH_SUCCESSOR_PATHS));

  for (const expected of KEYCHAIN_HISTORICAL_FIXTURE_SUCCESSORS) {
    assert.equal(git(root, "rev-parse", `${expected.commit}^{tree}`), expected.tree);
    assert.equal(git(root, "rev-parse", `${expected.commit}^`), expected.parent);
    const record = commitRecord(root, expected.commit);
    assert.equal(record.author, expected.ownerEmail);
    assert.equal(record.committer, expected.ownerEmail);
    assert.equal(record.subject, expected.subject);
    assert.deepEqual(sorted(record.files), sorted(expected.files));
  }

  assert.equal(
    git(root, "rev-parse", `${HISTORICAL_KEYCHAIN_CLOSURE_SUCCESSOR.commit}^{tree}`),
    HISTORICAL_KEYCHAIN_CLOSURE_SUCCESSOR.tree
  );
  assert.equal(
    git(root, "rev-parse", `${HISTORICAL_KEYCHAIN_CLOSURE_SUCCESSOR.commit}^`),
    HISTORICAL_KEYCHAIN_CLOSURE_SUCCESSOR.parent
  );
  const historicalKeychainClosure = commitRecord(root, HISTORICAL_KEYCHAIN_CLOSURE_SUCCESSOR.commit);
  assert.equal(historicalKeychainClosure.author, "overwatch@prometheus.local");
  assert.equal(historicalKeychainClosure.committer, "overwatch@prometheus.local");
  assert.equal(historicalKeychainClosure.subject, HISTORICAL_KEYCHAIN_CLOSURE_SUCCESSOR.subject);
  assert.deepEqual(
    sorted(historicalKeychainClosure.files),
    sorted(HISTORICAL_KEYCHAIN_CLOSURE_SUCCESSOR.files)
  );

  for (const expected of DASHBOARD_RUNTIME_HARNESS_SUCCESSORS) {
    assert.equal(git(root, "rev-parse", `${expected.commit}^{tree}`), expected.tree);
    assert.equal(git(root, "rev-parse", `${expected.commit}^`), expected.parent);
    const record = commitRecord(root, expected.commit);
    assert.equal(record.author, "dashboard@prometheus.local");
    assert.equal(record.committer, "dashboard@prometheus.local");
    assert.equal(record.subject, expected.subject);
    assert.deepEqual(sorted(record.files), sorted(expected.files));
  }

  const dashboardRuntimeOverwatch = commitRecord(
    root,
    DASHBOARD_RUNTIME_HARNESS_OVERWATCH_SUCCESSOR.commit
  );
  assert.equal(dashboardRuntimeOverwatch.author, "overwatch@prometheus.local");
  assert.equal(dashboardRuntimeOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(
    dashboardRuntimeOverwatch.subject,
    DASHBOARD_RUNTIME_HARNESS_OVERWATCH_SUCCESSOR.subject
  );
  assert.deepEqual(
    sorted(dashboardRuntimeOverwatch.files),
    sorted(DASHBOARD_RUNTIME_HARNESS_OVERWATCH_SUCCESSOR.files)
  );
  assert.equal(
    git(root, "rev-parse", `${DASHBOARD_RUNTIME_HARNESS_OVERWATCH_SUCCESSOR.commit}^{tree}`),
    DASHBOARD_RUNTIME_HARNESS_OVERWATCH_SUCCESSOR.tree
  );
  assert.equal(
    git(root, "rev-parse", `${DASHBOARD_RUNTIME_HARNESS_OVERWATCH_SUCCESSOR.commit}^`),
    DASHBOARD_RUNTIME_HARNESS_OVERWATCH_SUCCESSOR.parent
  );

  const safeAssetOrderingOverwatch = commitRecord(
    root,
    SAFE_NO_SECRET_ASSET_ORDERING_OVERWATCH_SUCCESSOR.commit
  );
  assert.equal(safeAssetOrderingOverwatch.author, "overwatch@prometheus.local");
  assert.equal(safeAssetOrderingOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(
    safeAssetOrderingOverwatch.subject,
    SAFE_NO_SECRET_ASSET_ORDERING_OVERWATCH_SUCCESSOR.subject
  );
  assert.deepEqual(
    sorted(safeAssetOrderingOverwatch.files),
    sorted(SAFE_NO_SECRET_ASSET_ORDERING_OVERWATCH_SUCCESSOR.files)
  );
  assert.equal(
    git(root, "rev-parse", `${SAFE_NO_SECRET_ASSET_ORDERING_OVERWATCH_SUCCESSOR.commit}^{tree}`),
    SAFE_NO_SECRET_ASSET_ORDERING_OVERWATCH_SUCCESSOR.tree
  );
  assert.equal(
    git(root, "rev-parse", `${SAFE_NO_SECRET_ASSET_ORDERING_OVERWATCH_SUCCESSOR.commit}^`),
    SAFE_NO_SECRET_ASSET_ORDERING_OVERWATCH_SUCCESSOR.parent
  );

  const cloudflareReadOverwatch = commitRecord(
    root,
    CLOUDFLARE_DEPLOYMENT_READ_OVERWATCH_SUCCESSOR.commit
  );
  assert.equal(cloudflareReadOverwatch.author, "overwatch@prometheus.local");
  assert.equal(cloudflareReadOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(cloudflareReadOverwatch.subject, CLOUDFLARE_DEPLOYMENT_READ_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(
    sorted(cloudflareReadOverwatch.files),
    sorted(CLOUDFLARE_DEPLOYMENT_READ_OVERWATCH_SUCCESSOR.files)
  );
  assert.equal(
    git(root, "rev-parse", `${CLOUDFLARE_DEPLOYMENT_READ_OVERWATCH_SUCCESSOR.commit}^{tree}`),
    CLOUDFLARE_DEPLOYMENT_READ_OVERWATCH_SUCCESSOR.tree
  );
  assert.equal(
    git(root, "rev-parse", `${CLOUDFLARE_DEPLOYMENT_READ_OVERWATCH_SUCCESSOR.commit}^`),
    CLOUDFLARE_DEPLOYMENT_READ_OVERWATCH_SUCCESSOR.parent
  );

  const wranglerFailureOverwatch = commitRecord(
    root,
    WRANGLER_DEPLOYMENT_FAILURE_OVERWATCH_SUCCESSOR.commit
  );
  assert.equal(wranglerFailureOverwatch.author, "overwatch@prometheus.local");
  assert.equal(wranglerFailureOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(wranglerFailureOverwatch.subject, WRANGLER_DEPLOYMENT_FAILURE_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(
    sorted(wranglerFailureOverwatch.files),
    sorted(WRANGLER_DEPLOYMENT_FAILURE_OVERWATCH_SUCCESSOR.files)
  );
  assert.equal(
    git(root, "rev-parse", `${WRANGLER_DEPLOYMENT_FAILURE_OVERWATCH_SUCCESSOR.commit}^{tree}`),
    WRANGLER_DEPLOYMENT_FAILURE_OVERWATCH_SUCCESSOR.tree
  );
  assert.equal(
    git(root, "rev-parse", `${WRANGLER_DEPLOYMENT_FAILURE_OVERWATCH_SUCCESSOR.commit}^`),
    WRANGLER_DEPLOYMENT_FAILURE_OVERWATCH_SUCCESSOR.parent
  );

  const wranglerDiagnosticOverwatch = commitRecord(
    root,
    WRANGLER_DIAGNOSTIC_VERIFICATION_OVERWATCH_SUCCESSOR.commit
  );
  assert.equal(wranglerDiagnosticOverwatch.author, "overwatch@prometheus.local");
  assert.equal(wranglerDiagnosticOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(
    wranglerDiagnosticOverwatch.subject,
    WRANGLER_DIAGNOSTIC_VERIFICATION_OVERWATCH_SUCCESSOR.subject
  );
  assert.deepEqual(
    sorted(wranglerDiagnosticOverwatch.files),
    sorted(WRANGLER_DIAGNOSTIC_VERIFICATION_OVERWATCH_SUCCESSOR.files)
  );
  assert.equal(
    git(root, "rev-parse", `${WRANGLER_DIAGNOSTIC_VERIFICATION_OVERWATCH_SUCCESSOR.commit}^{tree}`),
    WRANGLER_DIAGNOSTIC_VERIFICATION_OVERWATCH_SUCCESSOR.tree
  );
  assert.equal(
    git(root, "rev-parse", `${WRANGLER_DIAGNOSTIC_VERIFICATION_OVERWATCH_SUCCESSOR.commit}^`),
    WRANGLER_DIAGNOSTIC_VERIFICATION_OVERWATCH_SUCCESSOR.parent
  );

  const wranglerDiagnosticFinal = commitRecord(
    root,
    WRANGLER_DIAGNOSTIC_FINAL_OVERWATCH_SUCCESSOR.commit
  );
  assert.equal(wranglerDiagnosticFinal.author, "overwatch@prometheus.local");
  assert.equal(wranglerDiagnosticFinal.committer, "overwatch@prometheus.local");
  assert.equal(wranglerDiagnosticFinal.subject, WRANGLER_DIAGNOSTIC_FINAL_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(
    sorted(wranglerDiagnosticFinal.files),
    sorted(WRANGLER_DIAGNOSTIC_FINAL_OVERWATCH_SUCCESSOR.files)
  );
  assert.equal(
    git(root, "rev-parse", `${WRANGLER_DIAGNOSTIC_FINAL_OVERWATCH_SUCCESSOR.commit}^{tree}`),
    WRANGLER_DIAGNOSTIC_FINAL_OVERWATCH_SUCCESSOR.tree
  );
  assert.equal(
    git(root, "rev-parse", `${WRANGLER_DIAGNOSTIC_FINAL_OVERWATCH_SUCCESSOR.commit}^`),
    WRANGLER_DIAGNOSTIC_FINAL_OVERWATCH_SUCCESSOR.parent
  );

  const intelligenceRepair = commitRecord(root, PUBLIC_WORKER_STARTUP_INTELLIGENCE_REPAIR.commit);
  assert.equal(intelligenceRepair.author, "intelligence@prometheus.local");
  assert.equal(intelligenceRepair.committer, "intelligence@prometheus.local");
  assert.equal(intelligenceRepair.subject, PUBLIC_WORKER_STARTUP_INTELLIGENCE_REPAIR.subject);
  assert.deepEqual(sorted(intelligenceRepair.files), sorted(PUBLIC_WORKER_STARTUP_INTELLIGENCE_REPAIR.files));
  assert.equal(
    git(root, "rev-parse", `${PUBLIC_WORKER_STARTUP_INTELLIGENCE_REPAIR.commit}^{tree}`),
    PUBLIC_WORKER_STARTUP_INTELLIGENCE_REPAIR.tree
  );
  assert.equal(
    git(root, "rev-parse", `${PUBLIC_WORKER_STARTUP_INTELLIGENCE_REPAIR.commit}^`),
    PUBLIC_WORKER_STARTUP_INTELLIGENCE_REPAIR.parent
  );

  const startupOverwatch = commitRecord(root, PUBLIC_WORKER_STARTUP_OVERWATCH_SUCCESSOR.commit);
  assert.equal(startupOverwatch.author, "overwatch@prometheus.local");
  assert.equal(startupOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(startupOverwatch.subject, PUBLIC_WORKER_STARTUP_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(sorted(startupOverwatch.files), sorted(PUBLIC_WORKER_STARTUP_OVERWATCH_SUCCESSOR.files));
  assert.equal(
    git(root, "rev-parse", `${PUBLIC_WORKER_STARTUP_OVERWATCH_SUCCESSOR.commit}^{tree}`),
    PUBLIC_WORKER_STARTUP_OVERWATCH_SUCCESSOR.tree
  );
  assert.equal(
    git(root, "rev-parse", `${PUBLIC_WORKER_STARTUP_OVERWATCH_SUCCESSOR.commit}^`),
    PUBLIC_WORKER_STARTUP_OVERWATCH_SUCCESSOR.parent
  );

  const configConsumerOverwatch = commitRecord(root, PUBLIC_CONFIG_CONSUMER_OVERWATCH_SUCCESSOR.commit);
  assert.equal(configConsumerOverwatch.author, "overwatch@prometheus.local");
  assert.equal(configConsumerOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(configConsumerOverwatch.subject, PUBLIC_CONFIG_CONSUMER_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(
    sorted(configConsumerOverwatch.files),
    sorted(PUBLIC_CONFIG_CONSUMER_OVERWATCH_SUCCESSOR.files)
  );
  assert.equal(
    git(root, "rev-parse", `${PUBLIC_CONFIG_CONSUMER_OVERWATCH_SUCCESSOR.commit}^{tree}`),
    PUBLIC_CONFIG_CONSUMER_OVERWATCH_SUCCESSOR.tree
  );
  assert.equal(
    git(root, "rev-parse", `${PUBLIC_CONFIG_CONSUMER_OVERWATCH_SUCCESSOR.commit}^`),
    PUBLIC_CONFIG_CONSUMER_OVERWATCH_SUCCESSOR.parent
  );

  const intelligenceBoundaryOverwatch = commitRecord(
    root,
    INTELLIGENCE_3D_BOUNDARY_OVERWATCH_SUCCESSOR.commit
  );
  assert.equal(intelligenceBoundaryOverwatch.author, "overwatch@prometheus.local");
  assert.equal(intelligenceBoundaryOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(
    intelligenceBoundaryOverwatch.subject,
    INTELLIGENCE_3D_BOUNDARY_OVERWATCH_SUCCESSOR.subject
  );
  assert.deepEqual(
    sorted(intelligenceBoundaryOverwatch.files),
    sorted(INTELLIGENCE_3D_BOUNDARY_OVERWATCH_SUCCESSOR.files)
  );
  assert.equal(
    git(root, "rev-parse", `${INTELLIGENCE_3D_BOUNDARY_OVERWATCH_SUCCESSOR.commit}^{tree}`),
    INTELLIGENCE_3D_BOUNDARY_OVERWATCH_SUCCESSOR.tree
  );
  assert.equal(
    git(root, "rev-parse", `${INTELLIGENCE_3D_BOUNDARY_OVERWATCH_SUCCESSOR.commit}^`),
    INTELLIGENCE_3D_BOUNDARY_OVERWATCH_SUCCESSOR.parent
  );

  const rollbackTestOverwatch = commitRecord(root, CURRENT_ROLLBACK_TEST_OVERWATCH_SUCCESSOR.commit);
  assert.equal(rollbackTestOverwatch.author, "overwatch@prometheus.local");
  assert.equal(rollbackTestOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(rollbackTestOverwatch.subject, CURRENT_ROLLBACK_TEST_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(
    sorted(rollbackTestOverwatch.files),
    sorted(CURRENT_ROLLBACK_TEST_OVERWATCH_SUCCESSOR.files)
  );
  assert.equal(
    git(root, "rev-parse", `${CURRENT_ROLLBACK_TEST_OVERWATCH_SUCCESSOR.commit}^{tree}`),
    CURRENT_ROLLBACK_TEST_OVERWATCH_SUCCESSOR.tree
  );
  assert.equal(
    git(root, "rev-parse", `${CURRENT_ROLLBACK_TEST_OVERWATCH_SUCCESSOR.commit}^`),
    CURRENT_ROLLBACK_TEST_OVERWATCH_SUCCESSOR.parent
  );

  const retentionOverwatch = commitRecord(root, INTELLIGENCE_RETENTION_BOUNDARY_OVERWATCH_SUCCESSOR.commit);
  assert.equal(retentionOverwatch.author, "overwatch@prometheus.local");
  assert.equal(retentionOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(retentionOverwatch.subject, INTELLIGENCE_RETENTION_BOUNDARY_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(
    sorted(retentionOverwatch.files),
    sorted(INTELLIGENCE_RETENTION_BOUNDARY_OVERWATCH_SUCCESSOR.files)
  );
  assert.equal(
    git(root, "rev-parse", `${INTELLIGENCE_RETENTION_BOUNDARY_OVERWATCH_SUCCESSOR.commit}^{tree}`),
    INTELLIGENCE_RETENTION_BOUNDARY_OVERWATCH_SUCCESSOR.tree
  );
  assert.equal(
    git(root, "rev-parse", `${INTELLIGENCE_RETENTION_BOUNDARY_OVERWATCH_SUCCESSOR.commit}^`),
    INTELLIGENCE_RETENTION_BOUNDARY_OVERWATCH_SUCCESSOR.parent
  );

  const pausedAccessOverwatch = commitRecord(root, PAUSED_ACCESS_ALIGNMENT_OVERWATCH_SUCCESSOR.commit);
  assert.equal(pausedAccessOverwatch.author, "overwatch@prometheus.local");
  assert.equal(pausedAccessOverwatch.committer, "overwatch@prometheus.local");
  assert.equal(pausedAccessOverwatch.subject, PAUSED_ACCESS_ALIGNMENT_OVERWATCH_SUCCESSOR.subject);
  assert.deepEqual(
    sorted(pausedAccessOverwatch.files),
    sorted(PAUSED_ACCESS_ALIGNMENT_OVERWATCH_SUCCESSOR.files)
  );
  assert.equal(
    git(root, "rev-parse", `${PAUSED_ACCESS_ALIGNMENT_OVERWATCH_SUCCESSOR.commit}^{tree}`),
    PAUSED_ACCESS_ALIGNMENT_OVERWATCH_SUCCESSOR.tree
  );
  assert.equal(
    git(root, "rev-parse", `${PAUSED_ACCESS_ALIGNMENT_OVERWATCH_SUCCESSOR.commit}^`),
    PAUSED_ACCESS_ALIGNMENT_OVERWATCH_SUCCESSOR.parent
  );

  const crmRepair = commitRecord(root, CRM_PUBLIC_ADAPTER_REPAIR.commit);
  assert.equal(crmRepair.author, "crm@prometheus.local");
  assert.equal(crmRepair.committer, "crm@prometheus.local");
  assert.equal(crmRepair.subject, CRM_PUBLIC_ADAPTER_REPAIR.subject);
  assert.deepEqual(sorted(crmRepair.files), sorted(CRM_PUBLIC_ADAPTER_REPAIR.files));
  assert.equal(
    git(root, "rev-parse", `${CRM_PUBLIC_ADAPTER_REPAIR.commit}^{tree}`),
    CRM_PUBLIC_ADAPTER_REPAIR.tree
  );
  assert.equal(
    git(root, "rev-parse", `${CRM_PUBLIC_ADAPTER_REPAIR.commit}^`),
    CRM_PUBLIC_ADAPTER_REPAIR.parent
  );

  if (requireCommittedOverwatch) {
    const record = commitRecord(root, commits[56]);
    assert.equal(record.author, "overwatch@prometheus.local");
    assert.equal(record.committer, "overwatch@prometheus.local");
    assert.equal(record.subject, CRM_PUBLIC_ADAPTER_OVERWATCH_SUBJECT);
    assert.deepEqual(sorted(record.files), sorted(CRM_PUBLIC_ADAPTER_OVERWATCH_PATHS));
    assert.equal(
      git(root, "rev-parse", `${commits[56]}^`),
      INFRASTRUCTURE_COMMITS[21].commit
    );
  }

  for (const expected of [
    WORKFLOW_V2_OVERWATCH_GOVERNANCE,
    WORKFLOW_V2_OVERWATCH_PROVENANCE_PIN,
    WORKFLOW_V2_READINESS_CLOSURE,
    WORKFLOW_V2_FINAL_READINESS_CLOSURE,
    WORKFLOW_V2_RELEASE_WIRING_CLOSURE
  ]) {
    const record = commitRecord(root, expected.commit);
    assert.equal(record.author, "overwatch@prometheus.local");
    assert.equal(record.committer, "overwatch@prometheus.local");
    assert.equal(record.subject, expected.subject);
    assert.deepEqual(sorted(record.files), sorted(expected.files));
    assert.equal(git(root, "rev-parse", `${expected.commit}^{tree}`), expected.tree);
    assert.equal(git(root, "rev-parse", `${expected.commit}^`), expected.parent);
  }

  const historicalTail = commits.slice(64, 80);
  assert.equal(
    commits[79],
    HISTORICAL_PRESERVATION_TERMINAL_COMMIT,
    "Historical Workflow v2 preservation terminal drifted."
  );
  let previous = WORKFLOW_V2_RELEASE_WIRING_CLOSURE.commit;
  let authorizationBoundarySuccessorIndex = 0;
  let founderJwtValidationRepairSeen = false;
  let canonicalRollbackIdentitySuccessorSeen = false;
  let workflowV2FixtureRepairSuccessorSeen = false;
  for (const commit of historicalTail) {
    const record = commitRecord(root, commit);
    const expectedBoundarySuccessor =
      WORKFLOW_V2_AUTHORIZATION_BOUNDARY_SUCCESSORS[authorizationBoundarySuccessorIndex];
    if (expectedBoundarySuccessor && commit === expectedBoundarySuccessor.commit) {
      assert.equal(record.author, expectedBoundarySuccessor.ownerEmail);
      assert.equal(record.committer, expectedBoundarySuccessor.ownerEmail);
      assert.equal(record.subject, expectedBoundarySuccessor.subject);
      assert.deepEqual(sorted(record.files), sorted(expectedBoundarySuccessor.files));
      assert.equal(git(root, "rev-parse", `${commit}^{tree}`), expectedBoundarySuccessor.tree);
      assert.equal(git(root, "rev-parse", `${commit}^`), previous);
      assert.equal(expectedBoundarySuccessor.parent, previous);
      authorizationBoundarySuccessorIndex += 1;
      previous = commit;
      continue;
    }
    if (commit === FOUNDER_JWT_VALIDATION_REPAIR.commit) {
      assert.equal(founderJwtValidationRepairSeen, false);
      assert.equal(record.author, FOUNDER_JWT_VALIDATION_REPAIR.ownerEmail);
      assert.equal(record.committer, FOUNDER_JWT_VALIDATION_REPAIR.ownerEmail);
      assert.equal(record.subject, FOUNDER_JWT_VALIDATION_REPAIR.subject);
      assert.deepEqual(sorted(record.files), sorted(FOUNDER_JWT_VALIDATION_REPAIR.files));
      assert.equal(git(root, "rev-parse", `${commit}^{tree}`), FOUNDER_JWT_VALIDATION_REPAIR.tree);
      assert.equal(git(root, "rev-parse", `${commit}^`), previous);
      assert.equal(FOUNDER_JWT_VALIDATION_REPAIR.parent, previous);
      founderJwtValidationRepairSeen = true;
      previous = commit;
      continue;
    }
    if (commit === CANONICAL_ROLLBACK_IDENTITY_SUCCESSOR.commit) {
      assert.equal(founderJwtValidationRepairSeen, true);
      assert.equal(canonicalRollbackIdentitySuccessorSeen, false);
      assert.equal(record.author, CANONICAL_ROLLBACK_IDENTITY_SUCCESSOR.ownerEmail);
      assert.equal(record.committer, CANONICAL_ROLLBACK_IDENTITY_SUCCESSOR.ownerEmail);
      assert.equal(record.subject, CANONICAL_ROLLBACK_IDENTITY_SUCCESSOR.subject);
      assert.deepEqual(sorted(record.files), sorted(CANONICAL_ROLLBACK_IDENTITY_SUCCESSOR.files));
      assert.equal(
        git(root, "rev-parse", `${commit}^{tree}`),
        CANONICAL_ROLLBACK_IDENTITY_SUCCESSOR.tree
      );
      assert.equal(git(root, "rev-parse", `${commit}^`), previous);
      assert.equal(CANONICAL_ROLLBACK_IDENTITY_SUCCESSOR.parent, previous);
      canonicalRollbackIdentitySuccessorSeen = true;
      previous = commit;
      continue;
    }
    if (commit === WORKFLOW_V2_FIXTURE_REPAIR_SUCCESSOR.commit) {
      assert.equal(canonicalRollbackIdentitySuccessorSeen, true);
      assert.equal(workflowV2FixtureRepairSuccessorSeen, false);
      assert.equal(record.author, WORKFLOW_V2_FIXTURE_REPAIR_SUCCESSOR.ownerEmail);
      assert.equal(record.committer, WORKFLOW_V2_FIXTURE_REPAIR_SUCCESSOR.ownerEmail);
      assert.equal(record.subject, WORKFLOW_V2_FIXTURE_REPAIR_SUCCESSOR.subject);
      assert.deepEqual(sorted(record.files), sorted(WORKFLOW_V2_FIXTURE_REPAIR_SUCCESSOR.files));
      assert.equal(
        git(root, "rev-parse", `${commit}^{tree}`),
        WORKFLOW_V2_FIXTURE_REPAIR_SUCCESSOR.tree
      );
      assert.equal(git(root, "rev-parse", `${commit}^`), previous);
      assert.equal(WORKFLOW_V2_FIXTURE_REPAIR_SUCCESSOR.parent, previous);
      workflowV2FixtureRepairSuccessorSeen = true;
      previous = commit;
      continue;
    }
    assert.equal(record.author, "overwatch@prometheus.local");
    assert.equal(record.committer, "overwatch@prometheus.local");
    assert.match(record.subject, /^overwatch:/u);
    assert.ok(record.files.length > 0);
    assert.equal(record.files.every(path => WORKFLOW_V2_OVERWATCH_TAIL_PATHS.includes(path)), true);
    assert.equal(git(root, "rev-parse", `${commit}^`), previous);
    previous = commit;
  }
  assert.equal(
    authorizationBoundarySuccessorIndex,
    WORKFLOW_V2_AUTHORIZATION_BOUNDARY_SUCCESSORS.length,
    "Deployment authorization boundary successor chain is incomplete."
  );
  assert.equal(founderJwtValidationRepairSeen, true, "Founder JWT validation repair is missing.");
  assert.equal(
    canonicalRollbackIdentitySuccessorSeen,
    true,
    "Canonical rollback identity successor is missing."
  );
  assert.equal(
    workflowV2FixtureRepairSuccessorSeen,
    true,
    "Workflow v2 fixture repair successor is missing."
  );
  assert.equal(previous, HISTORICAL_PRESERVATION_TERMINAL_COMMIT);
  verifyCurrentOwnerSuccessor(root, requireCommittedOverwatch);
  return commits;
}

function verifyConsumerResolution(root) {
  for (const path of [
    "scripts/verify-overwatch-route-iq-3d-visual-continuity.mjs",
    "scripts/verify-overwatch-route-iq-public-crm-founder-access-deployment-readiness.mjs"
  ]) {
    assert.match(
      read(root, path).toString("utf8"),
      /verifyOverwatchPublicDeploymentIntegrityRepairReadiness/u,
      `Current readiness consumer does not resolve the integrity successor: ${path}`
    );
  }
}

export function verifyOverwatchPublicDeploymentIntegrityRepairReadiness({
  root = ROOT,
  build = false,
  requireClean = true,
  requireCommittedOverwatch = true
} = {}) {
  const governance = validatePublicIntegrityReadiness(readJson(root, PUBLIC_INTEGRITY_READINESS_PATH));
  assert.equal(sha256(read(root, HISTORICAL_SUCCESSOR_PATH)), HISTORICAL_SUCCESSOR_SHA256);
  assert.equal(
    sha256(read(root, INFRASTRUCTURE_CONTRACT_PATH)),
    CURRENT_INFRASTRUCTURE_CONTRACT_SHA256
  );
  assert.equal(
    sha256(read(root, DEPLOYMENT_INFRASTRUCTURE_CONTRACT_PATH)),
    DEPLOYMENT_INFRASTRUCTURE_CONTRACT_SHA256
  );
  assert.equal(sha256(read(root, ROLLBACK_CONTRACT_PATH)), CURRENT_ROLLBACK_CONTRACT_SHA256);

  const historical = verifyOverwatchRevised3dReleaseReadinessSuccessor({
    root,
    build: false,
    requireClean: false,
    requireFounderAcceptance: true,
    requireCommittedSuccessor: true
  });
  assert.equal(historical.historicalSuccessorCommit, HISTORICAL_SUCCESSOR_COMMIT);
  assert.equal(historical.historicalSuccessorTree, HISTORICAL_SUCCESSOR_TREE);
  assert.equal(historical.founderVisualAcceptance, "ACCEPTED");

  const deployment = verifyRouteIqPublicDeploymentAssets({ build });
  assert.equal(deployment.deploymentAssetsSha256, CURRENT_DEPLOYMENT_ASSETS_SHA256);
  assert.equal(deployment.candidateWebsiteCommit, WEBSITE_SUCCESSOR.commit);
  assert.equal(deployment.candidateWebsiteTree, WEBSITE_SUCCESSOR.tree);
  const rollback = verifyPublicForwardRollbackArtifact(root);
  assert.equal(rollback.artifactSha256, CURRENT_ROLLBACK_BUNDLE_SHA256);
  assert.equal(rollback.candidateDeploymentAssetsSha256, CURRENT_DEPLOYMENT_ASSETS_SHA256);
  assert.equal(rollback.candidateWebsiteCommit, WEBSITE_SUCCESSOR.commit);
  assert.equal(rollback.candidateWebsiteTree, WEBSITE_SUCCESSOR.tree);

  const commits = verifyOwnership(root, requireCommittedOverwatch);
  verifyConsumerResolution(root);
  if (requireClean) assert.equal(git(root, "status", "--porcelain"), "", "Working tree is not clean.");
  return Object.freeze({
    status: governance.status,
    batchId: governance.batchId,
    head: git(root, "rev-parse", "HEAD"),
    tree: git(root, "rev-parse", "HEAD^{tree}"),
    commits,
    deploymentAssetsSha256: CURRENT_DEPLOYMENT_ASSETS_SHA256,
    rollbackContractSha256: CURRENT_ROLLBACK_CONTRACT_SHA256,
    rollbackBundleSha256: CURRENT_ROLLBACK_BUNDLE_SHA256,
    infrastructureContractSha256: CURRENT_INFRASTRUCTURE_CONTRACT_SHA256,
    historicalDeploymentAssetsSha256: DEPLOYMENT_ASSETS_SHA256,
    historicalRollbackContractSha256: ROLLBACK_CONTRACT_SHA256,
    historicalRollbackBundleSha256: ROLLBACK_BUNDLE_SHA256,
    founderJwtRepairStatus: governance.founderJwtValidationRepairClosure.status,
    founderVisualAcceptance: historical.founderVisualAcceptance,
    predeploymentBatchId: governance.predeploymentSmokeRepair.batchId,
    authorizedCandidateCommit: governance.predeploymentSmokeRepair.authorizedCandidate.commit,
    authorizedCandidateTree: governance.predeploymentSmokeRepair.authorizedCandidate.tree,
    freshExactFounderAuthorizationRequired: true,
    safeCiPending: true,
    deploymentAuthorized: false
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyOverwatchPublicDeploymentIntegrityRepairReadiness();
  process.stdout.write(`${result.status} ${result.rollbackBundleSha256}\n`);
}
