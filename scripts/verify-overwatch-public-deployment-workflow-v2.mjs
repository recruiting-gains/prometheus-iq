#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { verifyPublicForwardRollbackArtifact } from "./lib/route-iq-public-forward-rollback.mjs";
import { verifyAutomaticCommitPushGovernance } from "./verify-overwatch-auto-push-governance.mjs";
import { verifyCrossSubsystemArtifactContracts } from "./verify-cross-subsystem-artifact-contracts.mjs";
import { verifyGithubActionsPublicWorkerWorkflowV2 } from "./verify-github-actions-public-worker-workflow-v2.mjs";
import { verifyRouteIqPublicDeploymentAssets } from "./verify-route-iq-public-deployment-assets.mjs";

const root = resolve(import.meta.dirname, "..");
const GOVERNANCE_PATH = "overwatch/governance/public-deployment-workflow-v2.json";
const FULL_SYSTEM_HARMONY_GOVERNANCE_PATH =
  "overwatch/governance/full-system-harmony-audit-v1.json";
const LIVE_CANONICAL_IDENTITY_GOVERNANCE_PATH =
  "overwatch/governance/live-canonical-identity-migration-v1.json";
const DASHBOARD_VISUAL_SUCCESSOR_GOVERNANCE_PATH =
  "overwatch/governance/route-iq-public-navigation-dashboard-visual-successor-v1.json";
const CURRENT_READINESS_SUCCESSORS_PATH =
  "overwatch/governance/route-iq-august-1-readiness-successors-v1.json";
const HISTORICAL_READINESS_GOVERNANCE_PATH =
  "overwatch/governance/route-iq-public-deployment-integrity-repair-readiness-v1.json";
const DOCUMENTATION_PATH = "overwatch/governance/public-deployment-workflow-v2.md";
const AUGUST1_READINESS_REPORT_PATH =
  "overwatch/governance/route-iq-august-1-launch-closeout-v1.json";
const OWNER_CONTRACT_PATH = "workers/infrastructure/github-actions-public-worker-deployment-v2.json";
const OWNER_COMMIT = "30c04aca19423f448b35218491d69ecc458367c7";
const OWNER_TREE = "a46088a5c223ba763db7a7eb99a8aec1a47b4c11";
const OWNER_PARENT = "07bf2eddc9707cb410ff6670efe9465ca68cd6b4";
const OWNER_IDENTITY = "Prometheus Infrastructure <infrastructure@prometheus.local>";
const PROVENANCE_REPAIR_COMMIT = "3743db6f883f44b6d1d1dd69bc1a9c79f6d8b6de";
const PROVENANCE_REPAIR_TREE = "7cc6670f1599f32a1d7283a353495866930784fd";
const PROVENANCE_REPAIR_PARENT = "ee80a44b8a28847d4a4acfc3fae8574697661edc";
const PROVENANCE_REPAIR_SUBJECT = "infrastructure: admit public deployment workflow v2 chain";
const AUTHORIZATION_BOUNDARY_REPAIR_COMMIT = "9c6440ba3c286b06a79435a8ec7bdf477cb4fd79";
const AUTHORIZATION_BOUNDARY_REPAIR_TREE = "9e09f7c9129b0eae1618cc0316da0f1a22d7c7c2";
const AUTHORIZATION_BOUNDARY_REPAIR_PARENT = "6db68f845e91c967e34f3b825e4cbc2372cef6d8";
const AUTHORIZATION_BOUNDARY_REPAIR_SUBJECT = "infrastructure: consume deployment authorization at spawn";
const WORKFLOW_V2_FIXTURE_REPAIR_COMMIT = "9e91ccbd71cd7298fcb74de5ca6a4ced20125113";
const WORKFLOW_V2_FIXTURE_REPAIR_TREE = "1691ed5ffb5bc139a66b60cbafd5b5c60ad12892";
const WORKFLOW_V2_FIXTURE_REPAIR_PARENT = "781a9472a4bd43a998826a3a130e547907f1f36a";
const WORKFLOW_V2_FIXTURE_REPAIR_SUBJECT = "infrastructure: derive Workflow v2 rollback fixture";
const WORKFLOW_V2_FIXTURE_HISTORICAL_SHA256 =
  "4181006b560cd2a192f08f94966d35ad076ee4da22e519217f86e90ae21cd35a";
const WORKFLOW_V2_FIXTURE_SUCCESSOR_SHA256 =
  "45a7b5c8120f7a7a3a885c3ac0d92aba29756b84f792bfed0d0c572ad56383e6";
const WORKFLOW_V2_FIXTURE_PATCH_SHA256 =
  "3270a7cf5bae0e59e9ed74b16b5a5612d46bee89c8b77dd6bcd440f58b6d6ba7";
const HISTORICAL_WORKFLOW_V2_FIXTURE_ROLLBACK_ARTIFACT_SHA256 =
  "88bee90a9ff1fafe064598c5db27b59ca78606dc8938fb0dcfeea96fa4eb5863";
const AUTHORIZATION_BOUNDARY_GOVERNANCE_COMMIT = "e2465d7a28c3222626cc8c60ed0690f8a425ee6f";
const AUTHORIZATION_BOUNDARY_GOVERNANCE_TREE = "25a215fda6751214d5c8a8b2d4474531aaf6536b";
const AUTHORIZATION_BOUNDARY_GOVERNANCE_PARENT = AUTHORIZATION_BOUNDARY_REPAIR_COMMIT;
const AUTHORIZATION_BOUNDARY_GOVERNANCE_SUBJECT = "overwatch: govern deployment authorization boundary repair";
const AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_COMMIT = "d2963aa66e304932729cf8154ab729f5d8b71113";
const AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_TREE = "b589078b7c9945eb2e12db2183788778e11e7c93";
const AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_PARENT = "4d7f5d140a7f856a18b99c1ab49a37d7555d3b5a";
const AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_SUBJECT = "infrastructure: admit deployment authorization boundary repair";
const OVERWATCH_IDENTITY = "Prometheus Overwatch <overwatch@prometheus.local>";
const DEPLOYMENT_ASSET_SHA256 = "5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15";
const CURRENT_DEPLOYMENT_ASSET_SHA256 =
  "48d3b6b44b49366f3387dfc3e37d8e34d83abf5ea8bb0606b0070851802ff6a1";
const CURRENT_ROLLBACK_CONTRACT_SHA256 =
  "b7be296f51db1b8e8a305a068ebc1b0aa7652813de7b5378b96ac292af8af012";
const CURRENT_ROLLBACK_ARTIFACT_SHA256 =
  "012552cf90827482c7f1309f50e492304d9094e1c53f0c7ee6b44a5e0c4e9fbe";
const CURRENT_INFRASTRUCTURE_CONTRACT_SHA256 =
  "0582bc185ccf6f5e0825de25ce5fef8c65240fb0ee3b68c22bc5ba14865350c5";
const WEBSITE_POSITIONING_DEPLOYMENT_ASSET_SHA256 =
  "ce5279cb7f1b904457bb83d5b844b3f7339a586544d0a36b4eb3e41c1715276e";
const WEBSITE_POSITIONING_ROLLBACK_CONTRACT_SHA256 =
  "df9a90e39076df62bb6c3ec521a9dd86afe8d65f0836645237dbc2d08c69302d";
const WEBSITE_POSITIONING_ROLLBACK_ARTIFACT_SHA256 =
  "37f215ffe57df61aaa741352111806b07ff1a97dabd07c36188080e62857e582";
const WEBSITE_POSITIONING_WORKFLOW_CONTRACT_SHA256 =
  "17ac6ac53220f77fe2d49339e7a93566c7c2419bb19c462200a2077f1df34ca7";
const LIVE_CANONICAL_IDENTITY_DEPLOYMENT_ASSET_SHA256 =
  "93526aca609a237fe26ba69f11d786549623b186fe7f106f3bf998e476dd22cf";
const LIVE_CANONICAL_IDENTITY_ROLLBACK_CONTRACT_SHA256 =
  "4477ddff8777d95e74023a09f2e9a7895060e1d290eeb5d9b2557ca620d827c7";
const LIVE_CANONICAL_IDENTITY_ROLLBACK_ARTIFACT_SHA256 =
  "e3330c71600364e4e22404d005902bdcf07e5ec12fe9aa098febd01e18a3b2c6";
const LIVE_CANONICAL_IDENTITY_PUBLIC_ASSET_COMMIT =
  "c4cb9150fb8ad218e34026a63fa577271860c270";
const LIVE_CANONICAL_IDENTITY_PUBLIC_ASSET_TREE =
  "e7870b29540e0fb2fa89dbf691804192e3cf9c1d";
const UNATTENDED_GOVERNANCE_ID = "cloudflare-unattended-deployment-access-governance-v1";
const ROUTE_IQ_3D_GOVERNANCE_ID = "route-iq-3d-visual-continuity-v1";
const PACKAGE_PATH = "package.json";
const HISTORICAL_PACKAGE_SHA256 = "a150ca1b1121c779415365551efdbff970e458915ba6491716ccbfdd0a111d0d";
const CROSS_INDUSTRY_PACKAGE_SUCCESSOR_COMMIT =
  "2db4121e231cc07b11370a53d42f754c8dbc4b81";
const CROSS_INDUSTRY_PACKAGE_SUCCESSOR_TREE =
  "45e068e2b41f116eb54352ee7333f2962fbddc65";
const CROSS_INDUSTRY_PACKAGE_SUCCESSOR_PARENT =
  "3205c9a634dc2fdea7faf00fdee5744c12b25e6f";
const CROSS_INDUSTRY_PACKAGE_SUCCESSOR_SHA256 =
  "2ddac044f9cd8fbcaceec1879db49c7a80e141fcac41da6d01d36d5de46677ab";
const PRIVATE_DASHBOARD_REPAIRS_PACKAGE_SUCCESSOR_COMMIT =
  "a44d5432dfc18a783b31732968956be5cddc3f7d";
const PRIVATE_DASHBOARD_REPAIRS_PACKAGE_SUCCESSOR_TREE =
  "1e2e5de6738a4bdea68dbab333b40a304986479e";
const PRIVATE_DASHBOARD_REPAIRS_PACKAGE_SUCCESSOR_PARENT =
  "56aaf2ec155e1f4054526473591af6b81cb2465b";
const PRIVATE_DASHBOARD_REPAIRS_PACKAGE_SUCCESSOR_SHA256 =
  "d56cb9d33de962fb7d636fbb5919e6f8c06a69c9c6c64b954d6f7641e1f27331";
const PAID_CUSTOMER_ONBOARDING_PACKAGE_SUCCESSOR_COMMIT =
  "959f5b689c75d2bc35381a22da36b7cb55129ef6";
const PAID_CUSTOMER_ONBOARDING_PACKAGE_SUCCESSOR_TREE =
  "c86cf8b59d16cfd158d4cdc68f289a1792bdf1c3";
const PAID_CUSTOMER_ONBOARDING_PACKAGE_SUCCESSOR_PARENT =
  "02a155ada86f76350e9d1ecc17060c5e6f7d8318";
const PAID_CUSTOMER_ONBOARDING_PACKAGE_SUCCESSOR_SHA256 =
  "1478d8113583c10752c8c6eddf8bb301ea666830821fae8bafb1327f00d2ae6f";
const CONTROLLED_REHEARSAL_PACKAGE_SUCCESSOR_COMMIT =
  "57966944fa97527417b9d277db201d874745e18b";
const CONTROLLED_REHEARSAL_PACKAGE_SUCCESSOR_TREE =
  "8bbb7e86fd30a3015fcbe4da9dc21f13889419ff";
const CONTROLLED_REHEARSAL_PACKAGE_SUCCESSOR_PARENT =
  "2c094403709415004c07269ea9bbd6e8c950bb68";
const CONTROLLED_REHEARSAL_PACKAGE_SUCCESSOR_SHA256 =
  "baf7641667d909ce5beedf3a7a657dccc1aaf76fe4cbc11392b7f63e468e6d6b";
const HISTORICAL_3D_PACKAGE_SHA256 = "f34246136a294d5a7180d76a452ff8c9c69bb7d1d35419c1115426b8ea4e0247";
const REGISTERED_PACKAGE_SHA256 =
  "8ddf429fc08acd45eca4f59638324f06a80acab9c949168325299e5b73199e2f";
const CURRENT_PACKAGE_SHA256 = "8a2d68b09248fc561ade94744b4fd5a6b11dfdd3b49e7fd4895ee8b1ee1e547a";
const FULL_SYSTEM_HARMONY_PACKAGE_SHA256 =
  "6a7434c52a2491f4820d18657aa2a2dcf92d02c3fdf910a365555aa096dd8e5d";
const ACTIVE_PACKAGE_SHA256 = "3c7c9a50ffed874d711085ec95c04eb525f2caee88975eca20385f243aafda87";
export const fullSystemHarmonyPackageSuccessor = Object.freeze({
  commit: "ecde11c54e2af76fb2f754dfdadabe516109532a",
  tree: "7136078840cf498156e588fd4c14ee10b2e335e6",
  parent: "4b81819c861ca7326b4749c06e69654eab8f3166",
  identity: "Prometheus Overwatch <overwatch@prometheus.local>",
  subject: "overwatch: qualify full-system harmony audit",
  path: PACKAGE_PATH,
  previousSha256: CURRENT_PACKAGE_SHA256,
  currentSha256: FULL_SYSTEM_HARMONY_PACKAGE_SHA256
});
export const liveCanonicalIdentityPackageSuccessor = Object.freeze({
  commit: "e9971e6d5efc20ed9d0d2190949276cd38d1f50c",
  tree: "903deca544eb0b21dcaa16a18e044cc3f3890e2e",
  parent: "c7dc84a39de41bc5d87c6f4bd47533a82b8f6f3f",
  identity: OVERWATCH_IDENTITY,
  subject: "overwatch: govern live canonical identity migration",
  path: PACKAGE_PATH,
  previousSha256: FULL_SYSTEM_HARMONY_PACKAGE_SHA256,
  currentSha256: ACTIVE_PACKAGE_SHA256
});
const REVENUE_READINESS_PACKAGE_SUCCESSOR_COMMIT =
  "6b9820a5acf67e7d403d112a71fea4dd37abcf5d";
const REVENUE_READINESS_PACKAGE_SUCCESSOR_PARENT =
  "de1b6c75648b2df90b71e8fd460f05a61dfda3f9";
const REVENUE_READINESS_PACKAGE_SUCCESSOR_TREE =
  "6c4d80a3de26551afde29077dc5612897a417cae";
const WORKFLOW_V2_TAIL_ANCHOR = "5b5b59509206578336b9671582669b600d0c74d4";
const WORKFLOW_V2_TAIL_PARENT = "0d828948968b8cedf3b1961c5320c74c03a8e18c";
const WORKFLOW_V2_TAIL_PATHS = Object.freeze([
  HISTORICAL_READINESS_GOVERNANCE_PATH,
  GOVERNANCE_PATH,
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
  "tests/overwatch-cloudflare-unattended-access.test.mjs",
  "tests/overwatch-public-deployment-workflow-v2.test.mjs",
  "tests/overwatch-route-iq-3d-visual-continuity.test.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const AUTHORIZATION_BOUNDARY_REPAIR_PATHS = Object.freeze([
  "docs/github-actions-public-worker-deployment-v2.md",
  "scripts/lib/github-actions-public-worker-deployment.mjs",
  "scripts/lib/github-actions-public-worker-workflow-v2.mjs",
  "scripts/run-github-actions-public-worker-deployment-v2.mjs",
  "scripts/verify-github-actions-public-worker-deployment.mjs",
  "scripts/verify-github-actions-public-worker-workflow-v2.mjs",
  "tests/github-actions-public-worker-workflow-v2.test.mjs",
  "workers/infrastructure/github-actions-public-worker-deployment-v2.json"
]);
const WORKFLOW_V2_FIXTURE_REPAIR_PATHS = Object.freeze([
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/github-actions-public-worker-workflow-v2.test.mjs",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);
const AUTHORIZATION_BOUNDARY_GOVERNANCE_PATHS = Object.freeze([
  GOVERNANCE_PATH,
  DOCUMENTATION_PATH,
  "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
  "tests/overwatch-public-deployment-workflow-v2.test.mjs"
]);
const AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_PATHS = Object.freeze([
  "docs/route-iq-public-repository-integrity-repair-v1.md",
  "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
  "tests/public-repository-integrity-repair.test.mjs",
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json"
]);
const AUGUST1_WEBSITE_SUCCESSOR_FILES = Object.freeze([
  "deploy/prometheusrouteiq-website/assets/IntelligenceScene-CqK-yX9Z.js",
  "deploy/prometheusrouteiq-website/assets/IntelligenceScene-DUlz-ixy.js",
  "deploy/prometheusrouteiq-website/assets/landing-D-Z5MAu6.js",
  "deploy/prometheusrouteiq-website/assets/landing-Dfjv-fGW.js",
  "deploy/prometheusrouteiq-website/index.html"
]);
const AUGUST1_ROLLBACK_SUCCESSOR_FILES = Object.freeze([
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
    path: "workers/infrastructure/route-iq-public-forward-rollback-v1.json",
    sha256: CURRENT_ROLLBACK_CONTRACT_SHA256
  }),
  Object.freeze({
    path: "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json",
    sha256: "5ecd49cb7f8306e2fed6fc18629f9ce490316cba6c1db4c9d0d6c39d09ca1d74"
  })
]);
const AUGUST1_PROVENANCE_ADMISSION_FILES = Object.freeze([
  Object.freeze({
    path: "scripts/verify-route-iq-public-repository-integrity-repair.mjs",
    sha256: "85e0a267ac8272903bb01556bbcc46503ae565e18f4841bc6bacdffa3a9226c3"
  }),
  Object.freeze({
    path: "tests/public-repository-integrity-repair.test.mjs",
    sha256: "37416524fabb451e3dd05b63b24324a9b35e013f091270af446099aa333ee377"
  }),
  Object.freeze({
    path: "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json",
    sha256: CURRENT_INFRASTRUCTURE_CONTRACT_SHA256
  })
]);
const AUGUST1_INITIAL_OVERWATCH_SUCCESSOR_FILES = Object.freeze([
  GOVERNANCE_PATH,
  DOCUMENTATION_PATH,
  HISTORICAL_READINESS_GOVERNANCE_PATH,
  "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
  "scripts/verify-overwatch-route-iq-3d-visual-continuity.mjs",
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "scripts/verify-overwatch-route-iq-revised-3d-release-readiness-successor.mjs",
  "scripts/verify-overwatch-route-iq-yc-investor-website-focus.mjs",
  "tests/overwatch-public-deployment-workflow-v2.test.mjs",
  "tests/overwatch-route-iq-3d-visual-continuity.test.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const AUGUST1_MANIFEST_REPAIR_SUCCESSOR_FILES = Object.freeze([
  HISTORICAL_READINESS_GOVERNANCE_PATH,
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs"
]);
const AUGUST1_PROVENANCE_CLOSURE_SUCCESSOR_FILES = Object.freeze([
  GOVERNANCE_PATH,
  HISTORICAL_READINESS_GOVERNANCE_PATH,
  "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "tests/overwatch-public-deployment-workflow-v2.test.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const AUGUST1_WORKFLOW_PIN_REFRESH_SUCCESSOR_FILES = Object.freeze([
  GOVERNANCE_PATH,
  DOCUMENTATION_PATH,
  HISTORICAL_READINESS_GOVERNANCE_PATH,
  "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "tests/overwatch-public-deployment-workflow-v2.test.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const AUGUST1_CURRENT_OVERWATCH_SUCCESSOR_FILES = Object.freeze([
  GOVERNANCE_PATH,
  DOCUMENTATION_PATH,
  HISTORICAL_READINESS_GOVERNANCE_PATH,
  AUGUST1_READINESS_REPORT_PATH,
  "scripts/verify-overwatch-public-deployment-workflow-v2.mjs",
  "scripts/verify-overwatch-route-iq-public-deployment-integrity-repair-readiness.mjs",
  "tests/overwatch-public-deployment-workflow-v2.test.mjs",
  "tests/overwatch-route-iq-public-crm-founder-access-deployment-readiness.test.mjs"
]);
const AUGUST1_WEBSITE_SUCCESSOR = Object.freeze({
  commit: "710ad8a1428dd7621c5363a16fffaae828cc3421",
  tree: "7e7f5cf2ec0fe0a2bfeae41c577279faab4c111b",
  parent: "dd048c8c00804073034a89a6a4dd48f616302a75",
  subject: "website: regenerate public deployment assets",
  owner: "Prometheus Website",
  author: "Prometheus Website <website@prometheus.local>",
  committer: "Prometheus Website <website@prometheus.local>",
  files: AUGUST1_WEBSITE_SUCCESSOR_FILES
});
const AUGUST1_ROLLBACK_SUCCESSOR = Object.freeze({
  commit: "18fbe9906064bad8a0ae8e6fc224e2af0bf1a594",
  tree: "8f58a2fb6e438d57556cb4f1860d4497782f61b2",
  parent: AUGUST1_WEBSITE_SUCCESSOR.commit,
  subject: "infrastructure: advance August 1 public rollback candidate",
  owner: "Prometheus Infrastructure",
  author: OWNER_IDENTITY,
  committer: OWNER_IDENTITY,
  files: AUGUST1_ROLLBACK_SUCCESSOR_FILES
});
const AUGUST1_PROVENANCE_ADMISSION = Object.freeze({
  commit: "a558df528f0c472d28afb1c3b3041a067ca86c4b",
  tree: "7e4e8b94d61f57bbd3dcf3c50ebe3e4efff54608",
  parent: AUGUST1_ROLLBACK_SUCCESSOR.commit,
  subject: "infrastructure: admit August 1 launch closeout successors",
  owner: "Prometheus Infrastructure",
  author: OWNER_IDENTITY,
  committer: OWNER_IDENTITY,
  files: AUGUST1_PROVENANCE_ADMISSION_FILES
});
const AUGUST1_INITIAL_OVERWATCH_SUCCESSOR = Object.freeze({
  commit: "5c20b551820c21b02a0c25c9d38c93474457fd23",
  tree: "f0e388d52dfbe0fa9576a86551e20ef501f8c5cf",
  parent: AUGUST1_PROVENANCE_ADMISSION.commit,
  subject: "overwatch: admit August 1 public release successors",
  author: OVERWATCH_IDENTITY,
  committer: OVERWATCH_IDENTITY,
  files: AUGUST1_INITIAL_OVERWATCH_SUCCESSOR_FILES
});
const AUGUST1_MANIFEST_REPAIR_SUCCESSOR = Object.freeze({
  commit: "59fab7bc5f307336fba52d15bc73181cb1a20b04",
  tree: "659a243b314a1dfbd811ba395f3c87485e50ccd6",
  parent: AUGUST1_INITIAL_OVERWATCH_SUCCESSOR.commit,
  subject: "overwatch: complete August 1 successor manifest",
  author: OVERWATCH_IDENTITY,
  committer: OVERWATCH_IDENTITY,
  files: AUGUST1_MANIFEST_REPAIR_SUCCESSOR_FILES
});
const AUGUST1_PROVENANCE_CLOSURE_SUCCESSOR = Object.freeze({
  commit: "899e4bbad0a74d2cf9514eda5ba5875b69aa6636",
  tree: "5fb40124e155e07f89f05c607dc5f2cd346684c0",
  parent: AUGUST1_MANIFEST_REPAIR_SUCCESSOR.commit,
  subject: "overwatch: close August 1 successor provenance",
  author: OVERWATCH_IDENTITY,
  committer: OVERWATCH_IDENTITY,
  files: AUGUST1_PROVENANCE_CLOSURE_SUCCESSOR_FILES
});
const AUGUST1_WORKFLOW_PIN_REFRESH_SUCCESSOR = Object.freeze({
  commit: "bc5c03392580470c3549c8e3fe510458e5cdc196",
  tree: "4b15decd6b6ec6cc42bea1ab4770609a35b74768",
  parent: AUGUST1_PROVENANCE_CLOSURE_SUCCESSOR.commit,
  subject: "overwatch: refresh August 1 workflow pins",
  author: OVERWATCH_IDENTITY,
  committer: OVERWATCH_IDENTITY,
  files: AUGUST1_WORKFLOW_PIN_REFRESH_SUCCESSOR_FILES
});
const AUGUST1_QUALIFICATION_SUCCESSORS = Object.freeze([
  Object.freeze({
    commit: "f464a6bc19e8d2e52cab258dd2cbdd7511a18a21",
    tree: "231142c33106b7d936ed575696b3814fa99618ff",
    parent: AUGUST1_WORKFLOW_PIN_REFRESH_SUCCESSOR.commit,
    subject: "overwatch: align August 1 package successor",
    author: OVERWATCH_IDENTITY,
    committer: OVERWATCH_IDENTITY,
    files: AUGUST1_WORKFLOW_PIN_REFRESH_SUCCESSOR_FILES
  }),
  Object.freeze({
    commit: "4fb815a7e03f745685a36e24e847dbc1f109a7df",
    tree: "81aa187479948de9cd624d29f14557eea2909b79",
    parent: "f464a6bc19e8d2e52cab258dd2cbdd7511a18a21",
    subject: "Admit August 1 successors in paused access gates",
    author: OVERWATCH_IDENTITY,
    committer: OVERWATCH_IDENTITY,
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
    author: OVERWATCH_IDENTITY,
    committer: OVERWATCH_IDENTITY,
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
    author: OVERWATCH_IDENTITY,
    committer: OVERWATCH_IDENTITY,
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
    author: OVERWATCH_IDENTITY,
    committer: OVERWATCH_IDENTITY,
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
    author: OVERWATCH_IDENTITY,
    committer: OVERWATCH_IDENTITY,
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
    author: OVERWATCH_IDENTITY,
    committer: OVERWATCH_IDENTITY,
    files: AUGUST1_CURRENT_OVERWATCH_SUCCESSOR_FILES
  }),
  Object.freeze({
    commit: "5aa41020ab857c9910b526acf138c1f7348c402f",
    tree: "fb2b2cd20624d9b62c43a50de49867f6355a72c5",
    parent: "0cffd6afb7b660e61049baff330bf3b231077a89",
    subject: "overwatch: align August 1 tail boundary",
    author: OVERWATCH_IDENTITY,
    committer: OVERWATCH_IDENTITY,
    files: AUGUST1_CURRENT_OVERWATCH_SUCCESSOR_FILES
  }),
  Object.freeze({
    commit: "943baa9c48a85f8b0a57d5a371ff64d486926f8d",
    tree: "bfea848e1c2127a7c29813919a404cf6085c8b1f",
    parent: "5aa41020ab857c9910b526acf138c1f7348c402f",
    subject: "overwatch: finalize August 1 exact tail",
    author: OVERWATCH_IDENTITY,
    committer: OVERWATCH_IDENTITY,
    files: AUGUST1_CURRENT_OVERWATCH_SUCCESSOR_FILES
  })
]);
const AUGUST1_OVERWATCH_SUCCESSOR = Object.freeze({
  classification: "DYNAMIC_EXACT_HEAD_SUCCESSOR",
  parent: AUGUST1_QUALIFICATION_SUCCESSORS.at(-1).commit,
  subject: "overwatch: refresh August 1 verifier fixture",
  author: OVERWATCH_IDENTITY,
  committer: OVERWATCH_IDENTITY,
  files: AUGUST1_CURRENT_OVERWATCH_SUCCESSOR_FILES
});
const AUGUST1_OVERWATCH_SUCCESSOR_COMMIT =
  "b32e18c5ed4a07edd41ea824ca4f934789192f5d";
const AUGUST1_OVERWATCH_SUCCESSOR_TREE =
  "4e3b186cec2fe4fc1f290ac1b67f6c92c7777220";
const CURRENT_AUGUST1_PIN_REFRESH = Object.freeze({
  commit: "7e9074db15ef8a5182a18e1d6aa25b662d9bad57",
  tree: "9af3c1702eb928ee299f47e0a560e95580c0e2eb",
  parent: "a42bfa175bb162475f49bfccca58b98ddbec61b1",
  subject: "overwatch: accept governed Dashboard harness successor",
  author: OVERWATCH_IDENTITY,
  committer: OVERWATCH_IDENTITY,
  files: Object.freeze([
    {
      path: AUGUST1_READINESS_REPORT_PATH,
      sha256: "f1fb9add1cde6c8bcf5a70c7365e02ece6ff9f7801707dff869e3b09c1ee4cb1"
    },
    {
      path: "scripts/verify-overwatch-route-iq-august-1-launch-readiness.mjs",
      sha256: "fd909a16a69d5286c1ead7710823bbd5c0bca5dbe62b64f37a11594452ea1759"
    },
    {
      path: "tests/overwatch-route-iq-august-1-launch-readiness.test.mjs",
      sha256: "1f44fda6b957e2f86b24eba1aab174c892fde986ecdbc764a2e97d53e6987725"
    }
  ])
});
const AUGUST1_LAUNCH_CLOSEOUT_SUCCESSOR = Object.freeze({
  classification: "CONTROLLING_CURRENT_OWNER_SUCCESSOR",
  historicalWorkflowEvidencePreserved: true,
  historicalHashesAreCurrent: false,
  websiteSuccessor: Object.freeze({
    ...AUGUST1_WEBSITE_SUCCESSOR,
    files: AUGUST1_WEBSITE_SUCCESSOR_FILES
  }),
  rollbackSuccessor: Object.freeze({
    ...AUGUST1_ROLLBACK_SUCCESSOR,
    files: AUGUST1_ROLLBACK_SUCCESSOR_FILES
  }),
  provenanceAdmission: Object.freeze({
    ...AUGUST1_PROVENANCE_ADMISSION,
    files: AUGUST1_PROVENANCE_ADMISSION_FILES
  }),
  overwatchPredecessors: Object.freeze([
    AUGUST1_INITIAL_OVERWATCH_SUCCESSOR,
    AUGUST1_MANIFEST_REPAIR_SUCCESSOR,
    AUGUST1_PROVENANCE_CLOSURE_SUCCESSOR,
    AUGUST1_WORKFLOW_PIN_REFRESH_SUCCESSOR
  ]),
  qualificationPredecessors: AUGUST1_QUALIFICATION_SUCCESSORS,
  overwatchSuccessor: AUGUST1_OVERWATCH_SUCCESSOR,
  currentReleaseIdentities: Object.freeze({
    deploymentAssetSha256: CURRENT_DEPLOYMENT_ASSET_SHA256,
    rollbackContractSha256: CURRENT_ROLLBACK_CONTRACT_SHA256,
    rollbackArtifactSha256: CURRENT_ROLLBACK_ARTIFACT_SHA256,
    infrastructureIntegrityContractSha256: CURRENT_INFRASTRUCTURE_CONTRACT_SHA256
  }),
  deploymentPerformed: false,
  productionMutationPerformed: false
});
const ROUTE_IQ_WEBSITE_POSITIONING_SUCCESSOR = Object.freeze({
  batchId: "BATCH-20260723-006",
  directive: "OVERWATCH DIRECTIVE - RESTORE ROUTE IQ WEBSITE POSITIONING",
  classification: "CONTROLLING_PUBLIC_RELEASE_SUCCESSOR",
  historicalAugust1EvidencePreserved: true,
  historicalAugust1HashesAreCurrent: false,
  websiteSource: Object.freeze({
    commit: "b83bcaf064ee7b57b28116ffb5e64cbf270605a0",
    tree: "8aab7fc3b918c50e85a78c5f5b6270846d3941e4",
    parent: "3bd4b1a120672f1ecbaf3b4b245106aee095f023",
    subject: "website: restore Route IQ customer positioning",
    author: "Prometheus Website <website@prometheus.local>",
    committer: "Prometheus Website <website@prometheus.local>",
    files: Object.freeze([
      "landing.html",
      "src/main.jsx",
      "src/styles.css",
      "tests/website-route-iq-3d-visual-continuity.test.mjs",
      "tests/website-route-iq-product-focus.test.mjs"
    ])
  }),
  dataProvenanceSuccessors: Object.freeze([
    Object.freeze({
      commit: "db70e304b77164c31fa0f95c25050fb61ea393c1",
      tree: "74f118516067c6c52b71c5d683ae111dec4e0511",
      parent: "b83bcaf064ee7b57b28116ffb5e64cbf270605a0",
      subject: "data: reconcile public claims workspace provenance",
      author: "Prometheus Data <data@prometheus.local>",
      committer: "Prometheus Data <data@prometheus.local>",
      files: Object.freeze([
        "data/route-iq-commercial-readiness-v1/route-iq-public-claims-evidence-matrix-v1.json"
      ])
    }),
    Object.freeze({
      commit: "c7e6a90ffc93bb7ae270365a198c740a4dc47126",
      tree: "df1b0bcbe6d69db54e40c952e6839d6a8700fd48",
      parent: "db70e304b77164c31fa0f95c25050fb61ea393c1",
      subject: "data: reconcile Route IQ claims provenance successor",
      author: "Prometheus Data <data@prometheus.local>",
      committer: "Prometheus Data <data@prometheus.local>",
      files: Object.freeze([
        "data/route-iq-commercial-readiness-v1/route-iq-public-claims-evidence-matrix-v1.json"
      ])
    }),
    Object.freeze({
      commit: "e1e7279e925acae69f7e32608475b98eff2c6023",
      tree: "62aafe56be5198e2ab65720b26a5d4fe1681ded3",
      parent: "c7e6a90ffc93bb7ae270365a198c740a4dc47126",
      subject: "data: reconcile Intelligence claims provenance successor",
      author: "Prometheus Data <data@prometheus.local>",
      committer: "Prometheus Data <data@prometheus.local>",
      files: Object.freeze([
        "data/route-iq-commercial-readiness-v1/route-iq-public-claims-evidence-matrix-v1.json"
      ])
    }),
    Object.freeze({
      commit: "6e62887506e39f9dc936766ea7da4d70f688c0e4",
      tree: "7134b123df4456cb1c8f3cc250a6c331f3ebf40b",
      parent: "e1e7279e925acae69f7e32608475b98eff2c6023",
      subject: "data: refresh Intelligence claims successor fixture",
      author: "Prometheus Data <data@prometheus.local>",
      committer: "Prometheus Data <data@prometheus.local>",
      files: Object.freeze(["tests/route-iq-public-claims-data.test.mjs"])
    })
  ]),
  websiteAssets: Object.freeze({
    commit: "72f3f5733f35a4ab56ae528f3a3616b455bd9ee6",
    tree: "6fa5e855c0ae14e97186b219073c1aa0ae5d9381",
    parent: "6e62887506e39f9dc936766ea7da4d70f688c0e4",
    subject: "website: regenerate public deployment assets",
    author: "Prometheus Website <website@prometheus.local>",
    committer: "Prometheus Website <website@prometheus.local>",
    files: Object.freeze([
      "deploy/prometheusrouteiq-website/assets/IntelligenceScene-C_J7bBXb.js",
      "deploy/prometheusrouteiq-website/assets/IntelligenceScene-DUlz-ixy.js",
      "deploy/prometheusrouteiq-website/assets/landing-DL0VmnXB.js",
      "deploy/prometheusrouteiq-website/assets/landing-Dfjv-fGW.js",
      "deploy/prometheusrouteiq-website/assets/landing-SxUmzID1.css",
      "deploy/prometheusrouteiq-website/assets/landing-y4RbxV9s.css",
      "deploy/prometheusrouteiq-website/index.html"
    ])
  }),
  infrastructure: Object.freeze({
    commit: "a370836879b160e88c0e7e821003e66759cc97c4",
    tree: "86abecdcbce0ed7ec5bbe77114affaad2f9fd1be",
    parent: "72f3f5733f35a4ab56ae528f3a3616b455bd9ee6",
    subject: "infrastructure: advance website positioning rollback package",
    author: OWNER_IDENTITY,
    committer: OWNER_IDENTITY,
    files: Object.freeze([
      Object.freeze({
        path: "tests/github-actions-public-worker-deployment.test.mjs",
        sha256: "3638984564da4e580170a87f9f728c0724edd3c4b5b7f667c6ce38b98eb9d38c"
      }),
      Object.freeze({
        path: "tests/github-actions-public-worker-workflow-v2.test.mjs",
        sha256: "03c35afd5c6c8d627b1dfa77b292bb0e947a78427bdaa673f535df19e6aa51b9"
      }),
      Object.freeze({
        path: "workers/infrastructure/route-iq-public-forward-rollback-v1.json",
        sha256: WEBSITE_POSITIONING_ROLLBACK_CONTRACT_SHA256
      })
    ])
  }),
  currentReleaseIdentities: Object.freeze({
    deploymentAssetSha256: WEBSITE_POSITIONING_DEPLOYMENT_ASSET_SHA256,
    rollbackContractSha256: WEBSITE_POSITIONING_ROLLBACK_CONTRACT_SHA256,
    rollbackArtifactSha256: WEBSITE_POSITIONING_ROLLBACK_ARTIFACT_SHA256,
    workflowContractSha256: WEBSITE_POSITIONING_WORKFLOW_CONTRACT_SHA256
  }),
  deploymentPerformed: false,
  productionMutationPerformed: false
});

const read = path => readFileSync(resolve(root, path), "utf8");
const readJson = path => JSON.parse(read(path));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const readAtCommit = (commit, path) => execFileSync(
  "/usr/bin/git",
  ["show", `${commit}:${path}`],
  { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] }
);
const git = args => execFileSync("/usr/bin/git", args, {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"]
}).trim();

function exactTrigger(workflow) {
  const start = workflow.indexOf("on:\n");
  const end = workflow.indexOf("permissions:\n", start);
  if (start < 0 || end <= start) return [];
  return [...workflow.slice(start, end).matchAll(/^  ([a-z_]+):$/gmu)].map(match => match[1]);
}

export function evaluatePublicDeploymentWorkflowV2Governance({
  governance,
  ownerContract,
  qualification,
  deployment,
  documentation
}) {
  const failures = [];
  const require = (condition, message) => {
    if (!condition) failures.push(message);
  };

  require(governance.governanceId === "public-deployment-workflow-v2-governance-v1", "Governance ID drifted.");
  require(governance.owningSubsystem === "Prometheus Overwatch", "Governance ownership drifted.");
  require(governance.batchId === "BATCH-20260720-010", "Batch ID drifted.");
  require(governance.dispatchAudit?.implementationOwner === "Prometheus Infrastructure", "Implementation owner drifted.");
  require(governance.dispatchAudit?.verificationOwner === "Prometheus Overwatch", "Verification owner drifted.");
  require(governance.dispatchAudit?.ownershipRespected === true, "Ownership is not accepted.");
  require(governance.implementationProvenance?.ownerCommit === OWNER_COMMIT, "Owner commit drifted.");
  require(governance.implementationProvenance?.ownerTree === OWNER_TREE, "Owner tree drifted.");
  require(governance.implementationProvenance?.parent === OWNER_PARENT, "Owner parent drifted.");
  require(governance.implementationProvenance?.author === OWNER_IDENTITY, "Owner author drifted.");
  require(governance.implementationProvenance?.committer === OWNER_IDENTITY, "Owner committer drifted.");
  require(governance.implementationProvenance?.legacyProvenanceGap === false, "Unexpected provenance gap.");
  require(governance.provenanceRepair?.ownerCommit === PROVENANCE_REPAIR_COMMIT, "Provenance repair commit drifted.");
  require(governance.provenanceRepair?.ownerTree === PROVENANCE_REPAIR_TREE, "Provenance repair tree drifted.");
  require(governance.provenanceRepair?.parent === PROVENANCE_REPAIR_PARENT, "Provenance repair parent drifted.");
  require(governance.provenanceRepair?.subject === PROVENANCE_REPAIR_SUBJECT, "Provenance repair subject drifted.");
  require(governance.provenanceRepair?.author === OWNER_IDENTITY, "Provenance repair author drifted.");
  require(governance.provenanceRepair?.committer === OWNER_IDENTITY, "Provenance repair committer drifted.");
  require(governance.authorizationBoundaryRepair?.ownerCommit === AUTHORIZATION_BOUNDARY_REPAIR_COMMIT, "Authorization-boundary repair commit drifted.");
  require(governance.authorizationBoundaryRepair?.ownerTree === AUTHORIZATION_BOUNDARY_REPAIR_TREE, "Authorization-boundary repair tree drifted.");
  require(governance.authorizationBoundaryRepair?.parent === AUTHORIZATION_BOUNDARY_REPAIR_PARENT, "Authorization-boundary repair parent drifted.");
  require(governance.authorizationBoundaryRepair?.subject === AUTHORIZATION_BOUNDARY_REPAIR_SUBJECT, "Authorization-boundary repair subject drifted.");
  require(governance.authorizationBoundaryRepair?.author === OWNER_IDENTITY, "Authorization-boundary repair author drifted.");
  require(governance.authorizationBoundaryRepair?.committer === OWNER_IDENTITY, "Authorization-boundary repair committer drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.ownerCommit === WORKFLOW_V2_FIXTURE_REPAIR_COMMIT, "Workflow v2 fixture repair commit drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.ownerTree === WORKFLOW_V2_FIXTURE_REPAIR_TREE, "Workflow v2 fixture repair tree drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.parent === WORKFLOW_V2_FIXTURE_REPAIR_PARENT, "Workflow v2 fixture repair parent drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.subject === WORKFLOW_V2_FIXTURE_REPAIR_SUBJECT, "Workflow v2 fixture repair subject drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.author === OWNER_IDENTITY, "Workflow v2 fixture repair author drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.committer === OWNER_IDENTITY, "Workflow v2 fixture repair committer drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.classification === "INFRASTRUCTURE_TEST_FIXTURE_AND_OWNER_PROVENANCE_ONLY", "Workflow v2 fixture repair classification drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.historicalTestSha256 === WORKFLOW_V2_FIXTURE_HISTORICAL_SHA256, "Workflow v2 historical fixture hash drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.successorTestSha256 === WORKFLOW_V2_FIXTURE_SUCCESSOR_SHA256, "Workflow v2 successor fixture hash drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.patchSha256 === WORKFLOW_V2_FIXTURE_PATCH_SHA256, "Workflow v2 fixture patch hash drifted.");
  require(governance.workflowV2FixtureRepairSuccessor?.rollbackArtifactSha256 === HISTORICAL_WORKFLOW_V2_FIXTURE_ROLLBACK_ARTIFACT_SHA256, "Workflow v2 fixture rollback identity drifted.");
  require(governance.authorizationBoundaryGovernance?.ownerCommit === AUTHORIZATION_BOUNDARY_GOVERNANCE_COMMIT, "Authorization-boundary governance commit drifted.");
  require(governance.authorizationBoundaryGovernance?.ownerTree === AUTHORIZATION_BOUNDARY_GOVERNANCE_TREE, "Authorization-boundary governance tree drifted.");
  require(governance.authorizationBoundaryGovernance?.parent === AUTHORIZATION_BOUNDARY_GOVERNANCE_PARENT, "Authorization-boundary governance parent drifted.");
  require(governance.authorizationBoundaryGovernance?.subject === AUTHORIZATION_BOUNDARY_GOVERNANCE_SUBJECT, "Authorization-boundary governance subject drifted.");
  require(governance.authorizationBoundaryGovernance?.author === OVERWATCH_IDENTITY, "Authorization-boundary governance author drifted.");
  require(governance.authorizationBoundaryGovernance?.committer === OVERWATCH_IDENTITY, "Authorization-boundary governance committer drifted.");
  require(governance.authorizationBoundaryGovernance?.classification === "OVERWATCH_GOVERNANCE_VERIFICATION_AND_DOCUMENTATION_ONLY", "Authorization-boundary governance classification drifted.");
  require(governance.authorizationBoundaryProvenanceAdmission?.ownerCommit === AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_COMMIT, "Authorization-boundary provenance-admission commit drifted.");
  require(governance.authorizationBoundaryProvenanceAdmission?.ownerTree === AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_TREE, "Authorization-boundary provenance-admission tree drifted.");
  require(governance.authorizationBoundaryProvenanceAdmission?.parent === AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_PARENT, "Authorization-boundary provenance-admission parent drifted.");
  require(governance.authorizationBoundaryProvenanceAdmission?.subject === AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_SUBJECT, "Authorization-boundary provenance-admission subject drifted.");
  require(governance.authorizationBoundaryProvenanceAdmission?.author === OWNER_IDENTITY, "Authorization-boundary provenance-admission author drifted.");
  require(governance.authorizationBoundaryProvenanceAdmission?.committer === OWNER_IDENTITY, "Authorization-boundary provenance-admission committer drifted.");
  require(governance.authorizationBoundaryProvenanceAdmission?.classification === "INFRASTRUCTURE_OWNER_VERIFIER_PROVENANCE_ADMISSION_ONLY", "Authorization-boundary provenance-admission classification drifted.");
  require(
    isDeepStrictEqual(governance.august1LaunchCloseoutSuccessor, AUGUST1_LAUNCH_CLOSEOUT_SUCCESSOR),
    "August 1 launch closeout successor drifted."
  );
  require(
    isDeepStrictEqual(
      governance.routeIqWebsitePositioningSuccessor,
      ROUTE_IQ_WEBSITE_POSITIONING_SUCCESSOR
    ),
    "Route IQ website positioning successor drifted."
  );
  require(governance.architecture?.qualificationContactsCloudflare === false, "Qualification can contact Cloudflare.");
  require(governance.architecture?.qualificationAccessesProtectedSecrets === false, "Qualification can access secrets.");
  require(governance.architecture?.qualificationBuildsArtifactExactlyOnce === true, "Qualification build count drifted.");
  require(governance.architecture?.deploymentConsumesQualifiedArtifact === true, "Deployment does not consume qualification.");
  require(governance.architecture?.deploymentRebuildAllowed === false, "Deployment rebuild is allowed.");
  require(governance.architecture?.targetWorker === "prometheusrouteiq-website", "Public target drifted.");
  require(governance.architecture?.privateWorkerMutationAllowed === false, "Private Worker mutation is allowed.");
  require(governance.architecture?.authorizationConsumedAt === "after_forward_wrangler_process_spawn_confirmed", "Authorization boundary drifted.");
  require(governance.architecture?.preBoundaryFailureConsumesAuthorization === false, "Pre-boundary failure consumes authorization.");
  require(governance.architecture?.forwardDeploymentAttempts === 1, "Deployment attempt ceiling drifted.");
  require(governance.architecture?.automaticRetryAllowed === false, "Automatic deployment retry is allowed.");
  require(governance.candidateStability?.sourceChangeInvalidatesCandidate === true, "Source change does not invalidate candidate.");
  require(governance.candidateStability?.preBoundaryExternalFailureInvalidatesUnchangedCandidate === false, "External pre-boundary failure invalidates candidate.");
  require(governance.candidateStability?.materiallyChangedCandidateMayReuseAuthorization === false, "Changed candidate can reuse authorization.");
  require(governance.runtimeBoundaries?.deploymentPerformedByBatch === false, "Batch reports a deployment.");
  require(governance.runtimeBoundaries?.cloudflareContactedByBatch === false, "Batch reports Cloudflare contact.");
  require(governance.runtimeBoundaries?.productionDataMutatedByBatch === false, "Batch reports production mutation.");
  require(governance.runtimeBoundaries?.collection === "OFF", "Collection is not OFF.");
  require(governance.runtimeBoundaries?.activeCohortCount === 0, "Active cohorts are not zero.");
  require(governance.runtimeBoundaries?.recommendationInfluence === "OFF", "Recommendation influence is not OFF.");
  require(governance.runtimeBoundaries?.anthonyMapped === false, "Anthony is mapped.");
  require(governance.productContinuity?.deploymentAssetSha256 === DEPLOYMENT_ASSET_SHA256, "Deployment asset identity drifted.");
  require(governance.productContinuity?.approvedWebsiteSourceChanged === false, "Website source changed.");
  require(governance.productContinuity?.crmBehaviorChanged === false, "CRM behavior changed.");
  require(JSON.stringify(governance.protectedPredecessorSuccessors) === JSON.stringify([
    {
      predecessorGovernanceId: UNATTENDED_GOVERNANCE_ID,
      path: PACKAGE_PATH,
      historicalSha256: HISTORICAL_PACKAGE_SHA256,
      successorSha256: REGISTERED_PACKAGE_SHA256,
      owner: "Prometheus Overwatch",
      ownerCommit: "610383c4e845789859946122283e8014dae35600",
      classification: "OVERWATCH_AUGUST_1_RELEASE_GATE_REGISTRATION_ONLY"
    },
    {
      predecessorGovernanceId: ROUTE_IQ_3D_GOVERNANCE_ID,
      path: PACKAGE_PATH,
      historicalSha256: HISTORICAL_3D_PACKAGE_SHA256,
      successorSha256: REGISTERED_PACKAGE_SHA256,
      owner: "Prometheus Overwatch",
      ownerCommit: "610383c4e845789859946122283e8014dae35600",
      classification: "OVERWATCH_AUGUST_1_RELEASE_GATE_REGISTRATION_ONLY"
    }
  ]), "Protected predecessor successor mapping drifted.");

  require(ownerContract.owner === "Prometheus Infrastructure", "Infrastructure contract ownership drifted.");
  require(ownerContract.status === "SOURCE_IMPLEMENTED_NOT_QUALIFIED_NOT_DEPLOYED", "Infrastructure status drifted.");
  require(ownerContract.qualification?.cloudflareRequestAllowed === false, "Owner qualification can contact Cloudflare.");
  require(ownerContract.qualification?.secretAccessAllowed === false, "Owner qualification can access secrets.");
  require(ownerContract.qualification?.publicArtifactBuilds === 1, "Owner artifact build count drifted.");
  require(ownerContract.deployment?.rebuildAllowed === false, "Owner deployment rebuild is allowed.");
  require(ownerContract.deployment?.forwardDeploymentAttempts === 1, "Owner deployment attempt ceiling drifted.");
  require(ownerContract.authorization?.consumedAt === "forward_wrangler_process_spawn_confirmed", "Owner authorization boundary drifted.");
  require(ownerContract.authorization?.preAuthorizationCloudflareReadOnlyRequestsAllowed === true, "Owner prerequisite reads are not governed.");
  require(ownerContract.authorization?.preAuthorizationCloudflareMutationRequestsAllowed === false, "Owner pre-authorization mutation is allowed.");
  require(ownerContract.authorization?.preBoundaryFailureRecordsDeploymentBegan === false, "Owner pre-boundary semantics drifted.");
  require(ownerContract.authorization?.changedCandidateRequiresNewQualificationAndAuthorization === true, "Owner candidate invalidation drifted.");
  require(ownerContract.runtimeBoundaries?.productionMutationPerformed === false, "Owner contract reports production mutation.");

  require(JSON.stringify(exactTrigger(qualification)) === JSON.stringify(["workflow_dispatch"]), "Qualification trigger drifted.");
  require(JSON.stringify(exactTrigger(deployment)) === JSON.stringify(["workflow_dispatch"]), "Deployment trigger drifted.");
  require(!/secrets\.[A-Z0-9_]+/u.test(qualification), "Qualification references a protected secret.");
  require(!/wrangler(?:\.js)?\s+deploy|run-github-actions-public-worker-deployment-v2/u.test(qualification), "Qualification contains a deployment route.");
  require((qualification.match(/run: npm run build/gmu) || []).length === 1, "Qualification source build count drifted.");
  require((qualification.match(/run: node scripts\/run-github-actions-public-worker-qualification\.mjs build/gmu) || []).length === 1, "Qualification artifact build count drifted.");
  require(!/npm run build|npm test|vite build/u.test(deployment), "Deployment can rebuild or rerun qualification.");
  require((deployment.match(/run: node scripts\/run-github-actions-public-worker-deployment-v2\.mjs deploy/gmu) || []).length === 1, "Deployment command count drifted.");
  require(!/--name\s+prometheus-iq|wrangler(?:\.js)?\s+deploy/u.test(deployment), "Deployment exposes an alternate target.");
  require(documentation.includes("does not request or grant deployment authorization"), "No-deployment boundary is undocumented.");

  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

export function hasGovernedPublicDeploymentWorkflowV2PackageSuccessor({
  governance = readJson(GOVERNANCE_PATH),
  predecessorGovernanceId,
  historicalSha256,
  successorSha256
}) {
  const matches = governance.protectedPredecessorSuccessors?.filter(item => (
    item.predecessorGovernanceId === predecessorGovernanceId
    && item.path === PACKAGE_PATH
    && item.historicalSha256 === historicalSha256
    && item.owner === "Prometheus Overwatch"
    && item.ownerCommit === "610383c4e845789859946122283e8014dae35600"
    && item.classification === "OVERWATCH_AUGUST_1_RELEASE_GATE_REGISTRATION_ONLY"
  )) ?? [];
  if (matches.length !== 1) return false;
  if (matches[0].successorSha256 === successorSha256) return true;
  const currentPackageSha256 = sha256(read(PACKAGE_PATH));
  if (successorSha256 === currentPackageSha256
    && currentPackageSha256 !== ACTIVE_PACKAGE_SHA256) {
    return hasGovernedPublicDeploymentWorkflowV2PackageSuccessor({
      governance,
      predecessorGovernanceId,
      historicalSha256,
      successorSha256: ACTIVE_PACKAGE_SHA256
    }) && validateCurrentCanonicalPackageSuccessor().currentSha256 === successorSha256;
  }
  if (successorSha256 === ACTIVE_PACKAGE_SHA256) {
    const liveCanonicalIdentityGovernance = readJson(
      LIVE_CANONICAL_IDENTITY_GOVERNANCE_PATH
    );
    return hasGovernedPublicDeploymentWorkflowV2PackageSuccessor({
      governance,
      predecessorGovernanceId,
      historicalSha256,
      successorSha256: FULL_SYSTEM_HARMONY_PACKAGE_SHA256
    }) && validateLiveCanonicalIdentityPackageSuccessor(
      liveCanonicalIdentityPackageSuccessor,
      liveCanonicalIdentityGovernance
    ).currentSha256 === successorSha256;
  }
  if (successorSha256 === FULL_SYSTEM_HARMONY_PACKAGE_SHA256) {
    const harmonyGovernance = readJson(FULL_SYSTEM_HARMONY_GOVERNANCE_PATH);
    return hasGovernedPublicDeploymentWorkflowV2PackageSuccessor({
      governance,
      predecessorGovernanceId,
      historicalSha256,
      successorSha256: CURRENT_PACKAGE_SHA256
    }) && validateFullSystemHarmonyPackageSuccessor(
      fullSystemHarmonyPackageSuccessor,
      harmonyGovernance
    ).currentSha256 === successorSha256;
  }
  if (successorSha256 === CURRENT_PACKAGE_SHA256) {
    const fields = git([
      "show",
      "-s",
      "--format=%H%n%T%n%P%n%an <%ae>%n%cn <%ce>%n%s",
      REVENUE_READINESS_PACKAGE_SUCCESSOR_COMMIT
    ]).split("\n");
    const predecessorPackage = execFileSync("/usr/bin/git", [
      "show",
      `${REVENUE_READINESS_PACKAGE_SUCCESSOR_PARENT}:${PACKAGE_PATH}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
    const successorPackage = execFileSync("/usr/bin/git", [
      "show",
      `${REVENUE_READINESS_PACKAGE_SUCCESSOR_COMMIT}:${PACKAGE_PATH}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
    return isDeepStrictEqual(fields, [
      REVENUE_READINESS_PACKAGE_SUCCESSOR_COMMIT,
      REVENUE_READINESS_PACKAGE_SUCCESSOR_TREE,
      REVENUE_READINESS_PACKAGE_SUCCESSOR_PARENT,
      OVERWATCH_IDENTITY,
      OVERWATCH_IDENTITY,
      "overwatch: govern paid-customer revenue readiness"
    ])
      && sha256(predecessorPackage) ===
        CONTROLLED_REHEARSAL_PACKAGE_SUCCESSOR_SHA256
      && sha256(successorPackage) === CURRENT_PACKAGE_SHA256;
  }
  if (![CROSS_INDUSTRY_PACKAGE_SUCCESSOR_SHA256,
    PRIVATE_DASHBOARD_REPAIRS_PACKAGE_SUCCESSOR_SHA256,
    PAID_CUSTOMER_ONBOARDING_PACKAGE_SUCCESSOR_SHA256,
    CONTROLLED_REHEARSAL_PACKAGE_SUCCESSOR_SHA256].includes(successorSha256)) return false;

  const fields = git([
    "show",
    "-s",
    "--format=%H%n%T%n%P%n%an <%ae>%n%cn <%ce>%n%s",
    CROSS_INDUSTRY_PACKAGE_SUCCESSOR_COMMIT
  ]).split("\n");
  const predecessorPackage = execFileSync("/usr/bin/git", [
    "show",
    `${CROSS_INDUSTRY_PACKAGE_SUCCESSOR_PARENT}:${PACKAGE_PATH}`
  ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
  const successorPackage = execFileSync("/usr/bin/git", [
    "show",
    `${CROSS_INDUSTRY_PACKAGE_SUCCESSOR_COMMIT}:${PACKAGE_PATH}`
  ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });

  const crossIndustrySuccessorValid = isDeepStrictEqual(fields, [
    CROSS_INDUSTRY_PACKAGE_SUCCESSOR_COMMIT,
    CROSS_INDUSTRY_PACKAGE_SUCCESSOR_TREE,
    CROSS_INDUSTRY_PACKAGE_SUCCESSOR_PARENT,
    OVERWATCH_IDENTITY,
    OVERWATCH_IDENTITY,
    "overwatch: qualify cross-industry dashboard regression repair"
  ])
    && sha256(predecessorPackage) === matches[0].successorSha256
    && sha256(successorPackage) === CROSS_INDUSTRY_PACKAGE_SUCCESSOR_SHA256;
  if (!crossIndustrySuccessorValid
    || successorSha256 === CROSS_INDUSTRY_PACKAGE_SUCCESSOR_SHA256) {
    return crossIndustrySuccessorValid;
  }

  const privateDashboardFields = git([
    "show",
    "-s",
    "--format=%H%n%T%n%P%n%an <%ae>%n%cn <%ce>%n%s",
    PRIVATE_DASHBOARD_REPAIRS_PACKAGE_SUCCESSOR_COMMIT
  ]).split("\n");
  const privateDashboardPredecessorPackage = execFileSync("/usr/bin/git", [
    "show",
    `${PRIVATE_DASHBOARD_REPAIRS_PACKAGE_SUCCESSOR_PARENT}:${PACKAGE_PATH}`
  ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
  const privateDashboardSuccessorPackage = execFileSync("/usr/bin/git", [
    "show",
    `${PRIVATE_DASHBOARD_REPAIRS_PACKAGE_SUCCESSOR_COMMIT}:${PACKAGE_PATH}`
  ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });

  const privateDashboardSuccessorValid = isDeepStrictEqual(privateDashboardFields, [
    PRIVATE_DASHBOARD_REPAIRS_PACKAGE_SUCCESSOR_COMMIT,
    PRIVATE_DASHBOARD_REPAIRS_PACKAGE_SUCCESSOR_TREE,
    PRIVATE_DASHBOARD_REPAIRS_PACKAGE_SUCCESSOR_PARENT,
    OVERWATCH_IDENTITY,
    OVERWATCH_IDENTITY,
    "overwatch: qualify private dashboard founder repairs"
  ])
    && sha256(privateDashboardPredecessorPackage) === CROSS_INDUSTRY_PACKAGE_SUCCESSOR_SHA256
    && sha256(privateDashboardSuccessorPackage)
      === PRIVATE_DASHBOARD_REPAIRS_PACKAGE_SUCCESSOR_SHA256;
  if (!privateDashboardSuccessorValid
    || successorSha256 === PRIVATE_DASHBOARD_REPAIRS_PACKAGE_SUCCESSOR_SHA256) {
    return privateDashboardSuccessorValid;
  }

  const paidCustomerFields = git([
    "show",
    "-s",
    "--format=%H%n%T%n%P%n%an <%ae>%n%cn <%ce>%n%s",
    PAID_CUSTOMER_ONBOARDING_PACKAGE_SUCCESSOR_COMMIT
  ]).split("\n");
  const paidCustomerPredecessorPackage = execFileSync("/usr/bin/git", [
    "show",
    `${PAID_CUSTOMER_ONBOARDING_PACKAGE_SUCCESSOR_PARENT}:${PACKAGE_PATH}`
  ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
  const paidCustomerSuccessorPackage = execFileSync("/usr/bin/git", [
    "show",
    `${PAID_CUSTOMER_ONBOARDING_PACKAGE_SUCCESSOR_COMMIT}:${PACKAGE_PATH}`
  ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });

  const paidCustomerSuccessorValid = isDeepStrictEqual(paidCustomerFields, [
    PAID_CUSTOMER_ONBOARDING_PACKAGE_SUCCESSOR_COMMIT,
    PAID_CUSTOMER_ONBOARDING_PACKAGE_SUCCESSOR_TREE,
    PAID_CUSTOMER_ONBOARDING_PACKAGE_SUCCESSOR_PARENT,
    OVERWATCH_IDENTITY,
    OVERWATCH_IDENTITY,
    "overwatch: govern paid-customer onboarding foundation"
  ])
    && sha256(paidCustomerPredecessorPackage)
      === PRIVATE_DASHBOARD_REPAIRS_PACKAGE_SUCCESSOR_SHA256
    && sha256(paidCustomerSuccessorPackage)
      === PAID_CUSTOMER_ONBOARDING_PACKAGE_SUCCESSOR_SHA256;
  if (!paidCustomerSuccessorValid
    || successorSha256 === PAID_CUSTOMER_ONBOARDING_PACKAGE_SUCCESSOR_SHA256) {
    return paidCustomerSuccessorValid;
  }

  const controlledRehearsalFields = git([
    "show",
    "-s",
    "--format=%H%n%T%n%P%n%an <%ae>%n%cn <%ce>%n%s",
    CONTROLLED_REHEARSAL_PACKAGE_SUCCESSOR_COMMIT
  ]).split("\n");
  const controlledRehearsalPredecessorPackage = execFileSync("/usr/bin/git", [
    "show",
    `${CONTROLLED_REHEARSAL_PACKAGE_SUCCESSOR_PARENT}:${PACKAGE_PATH}`
  ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
  const controlledRehearsalSuccessorPackage = execFileSync("/usr/bin/git", [
    "show",
    `${CONTROLLED_REHEARSAL_PACKAGE_SUCCESSOR_COMMIT}:${PACKAGE_PATH}`
  ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });

  return isDeepStrictEqual(controlledRehearsalFields, [
    CONTROLLED_REHEARSAL_PACKAGE_SUCCESSOR_COMMIT,
    CONTROLLED_REHEARSAL_PACKAGE_SUCCESSOR_TREE,
    CONTROLLED_REHEARSAL_PACKAGE_SUCCESSOR_PARENT,
    OVERWATCH_IDENTITY,
    OVERWATCH_IDENTITY,
    "overwatch: govern controlled onboarding rehearsal"
  ])
    && sha256(controlledRehearsalPredecessorPackage)
      === PAID_CUSTOMER_ONBOARDING_PACKAGE_SUCCESSOR_SHA256
    && sha256(controlledRehearsalSuccessorPackage)
      === CONTROLLED_REHEARSAL_PACKAGE_SUCCESSOR_SHA256
    && git(["log", "-1", "--format=%H", "--", PACKAGE_PATH])
      === CONTROLLED_REHEARSAL_PACKAGE_SUCCESSOR_COMMIT;
}

export function validateFullSystemHarmonyPackageSuccessor(
  record = fullSystemHarmonyPackageSuccessor,
  governance = readJson(FULL_SYSTEM_HARMONY_GOVERNANCE_PATH)
) {
  assert.deepEqual(record, fullSystemHarmonyPackageSuccessor,
    "Full-System Harmony package successor drifted");
  assert.deepEqual(git([
    "show", "-s", "--format=%H%n%T%n%P%n%an <%ae>%n%cn <%ce>%n%s",
    record.commit
  ]).split("\n"), [
    record.commit,
    record.tree,
    record.parent,
    record.identity,
    record.identity,
    record.subject
  ], "Full-System Harmony package successor provenance drifted");
  const predecessorPackage = execFileSync("/usr/bin/git", [
    "show", `${record.parent}:${record.path}`
  ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
  const successorPackage = execFileSync("/usr/bin/git", [
    "show", `${record.commit}:${record.path}`
  ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
  assert.equal(sha256(predecessorPackage), record.previousSha256,
    "Full-System Harmony package predecessor drifted");
  assert.equal(sha256(successorPackage), record.currentSha256,
    "Full-System Harmony package successor content drifted");
  const ownerMatches = governance.ownerCommits?.filter(item => (
    item.commit === record.commit && item.owner === record.identity
  )) ?? [];
  assert.equal(ownerMatches.length, 1,
    "Full-System Harmony package owner evidence drifted");
  return record;
}

export function validateLiveCanonicalIdentityPackageSuccessor(
  record = liveCanonicalIdentityPackageSuccessor,
  governance = readJson(LIVE_CANONICAL_IDENTITY_GOVERNANCE_PATH)
) {
  assert.deepEqual(record, liveCanonicalIdentityPackageSuccessor,
    "Live canonical identity package successor drifted");
  assert.deepEqual(git([
    "show", "-s", "--format=%H%n%T%n%P%n%an <%ae>%n%cn <%ce>%n%s",
    record.commit
  ]).split("\n"), [
    record.commit,
    record.tree,
    record.parent,
    record.identity,
    record.identity,
    record.subject
  ], "Live canonical identity package successor provenance drifted");
  const predecessorPackage = execFileSync("/usr/bin/git", [
    "show", `${record.parent}:${record.path}`
  ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
  const successorPackage = execFileSync("/usr/bin/git", [
    "show", `${record.commit}:${record.path}`
  ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
  assert.equal(sha256(predecessorPackage), record.previousSha256,
    "Live canonical identity package predecessor drifted");
  assert.equal(sha256(successorPackage), record.currentSha256,
    "Live canonical identity package successor content drifted");
  const governed = governance.releasePreparation?.packageReleaseWiringSuccessor;
  assert.equal(governed?.classification, "LIVE_CANONICAL_IDENTITY_PACKAGE_SUCCESSOR",
    "Live canonical identity package classification drifted");
  assert.equal(governed?.ownerCommit, record.commit,
    "Live canonical identity package owner commit drifted");
  assert.equal(governed?.ownerParent, record.parent,
    "Live canonical identity package owner parent drifted");
  assert.equal(governed?.ownerTree, record.tree,
    "Live canonical identity package owner tree drifted");
  assert.equal(governed?.previousSha256, record.previousSha256,
    "Live canonical identity package predecessor hash drifted");
  assert.equal(governed?.currentSha256, record.currentSha256,
    "Live canonical identity package current hash drifted");
  assert.equal(governed?.ownerSubsystem, "Prometheus Overwatch",
    "Live canonical identity package owner subsystem drifted");
  return record;
}

export function validateCurrentCanonicalPackageSuccessor(
  readinessGovernance = readJson(CURRENT_READINESS_SUCCESSORS_PATH),
  liveGovernance = readJson(LIVE_CANONICAL_IDENTITY_GOVERNANCE_PATH)
) {
  const live = validateLiveCanonicalIdentityPackageSuccessor(
    liveCanonicalIdentityPackageSuccessor,
    liveGovernance
  );
  assert.equal(readinessGovernance.governanceId,
    "route-iq-august-1-readiness-successors-v1",
  "Current package successor governance identity drifted");
  assert.equal(readinessGovernance.ownerSubsystem, "Prometheus Overwatch",
    "Current package successor owner drifted");
  assert.equal(readinessGovernance.historicalCloseoutEvidenceRewritten, false,
    "Current package successor rewrote historical evidence");
  const transitions = readinessGovernance.overwatchCurrentEvidence?.filter(
    item => item.path === PACKAGE_PATH
  ) ?? [];
  assert.ok(transitions.length >= 2, "Current package successor chain is incomplete");
  for (const transition of transitions) {
    assert.match(transition.previousSha256, /^[a-f0-9]{64}$/u,
      "Current package predecessor hash drifted");
    assert.match(transition.successorSha256, /^[a-f0-9]{64}$/u,
      "Current package successor hash drifted");
    assert.notEqual(transition.previousSha256, transition.successorSha256,
      "Current package successor is a no-op");
  }
  const byPrevious = new Map(transitions.map(item => [item.previousSha256, item]));
  const successorHashes = new Set(transitions.map(item => item.successorSha256));
  assert.equal(byPrevious.size, transitions.length,
    "Current package successor chain branches");
  assert.equal(successorHashes.size, transitions.length,
    "Current package successor chain merges");
  const starts = [...byPrevious.keys()].filter(hash => !successorHashes.has(hash));
  const ends = [...successorHashes].filter(hash => !byPrevious.has(hash));
  assert.deepEqual(starts, [FULL_SYSTEM_HARMONY_PACKAGE_SHA256],
    "Current package successor chain start drifted");
  const currentSha256 = sha256(read(PACKAGE_PATH));
  assert.deepEqual(ends, [currentSha256],
    "Current package successor chain end drifted");
  let current = starts[0];
  const visited = new Set();
  while (byPrevious.has(current)) {
    assert.equal(visited.has(current), false, "Current package successor chain cycles");
    visited.add(current);
    current = byPrevious.get(current).successorSha256;
  }
  assert.equal(current, currentSha256, "Current package successor chain terminates incorrectly");
  assert.equal(visited.size, transitions.length,
    "Current package successor chain is disconnected");
  assert.equal(transitions.some(item =>
    item.previousSha256 === FULL_SYSTEM_HARMONY_PACKAGE_SHA256
      && item.successorSha256 === live.currentSha256), true,
  "Live canonical package successor is absent from the current chain");
  return Object.freeze({
    previousSha256: live.currentSha256,
    currentSha256,
    transitionCount: transitions.length
  });
}

export function isGovernedPublicDeploymentWorkflowV2VerifierCommit({
  path,
  author,
  committer,
  subject,
  files
}) {
  if (!WORKFLOW_V2_TAIL_PATHS.includes(path) || !Array.isArray(files)) return false;
  if (!files.includes(path)) return true;
  const isOverwatchOwnedPath = file => WORKFLOW_V2_TAIL_PATHS.includes(file)
    || file.startsWith("overwatch/")
    || /^scripts\/verify-overwatch-[a-z0-9-]+\.mjs$/u.test(file)
    || /^tests\/overwatch-[a-z0-9-]+\.test\.mjs$/u.test(file);
  return author === "overwatch@prometheus.local"
    && committer === "overwatch@prometheus.local"
    && subject.startsWith("overwatch:")
    && files.length > 0
    && files.every(isOverwatchOwnedPath);
}

export function hasGovernedPublicDeploymentWorkflowV2VerifierSuccessor({
  path,
  historicalSha256,
  successorSha256
}) {
  try {
    if (!WORKFLOW_V2_TAIL_PATHS.includes(path)
      || !/^[0-9a-f]{64}$/u.test(historicalSha256)
      || !/^[0-9a-f]{64}$/u.test(successorSha256)) return false;

    const historicalGovernance = readJson(HISTORICAL_READINESS_GOVERNANCE_PATH);
    const governedTail = historicalGovernance.workflowV2ReadinessClosure?.governedOverwatchTail;
    if (governedTail?.linearHistoryRequired !== true
      || governedTail?.mergesAllowed !== false
      || governedTail?.authorAndCommitter !== "overwatch@prometheus.local"
      || governedTail?.subjectPrefix !== "overwatch:"
      || governedTail?.ownershipAppliesTo !== "COMMITS_MODIFYING_GOVERNED_PATH"
      || governedTail?.unrelatedSubsystemCommitsAllowed !== true
      || governedTail?.subsystemImplementationAllowed !== false
      || JSON.stringify(governedTail?.allowedPaths) !== JSON.stringify(WORKFLOW_V2_TAIL_PATHS)) {
  return false;
}

    const historical = execFileSync("/usr/bin/git", [
      "show", `${WORKFLOW_V2_TAIL_PARENT}:${path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
    const committedCurrent = execFileSync("/usr/bin/git", ["show", `HEAD:${path}`], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (sha256(historical) !== historicalSha256
      || sha256(committedCurrent) !== successorSha256
      || sha256(readFileSync(resolve(root, path))) !== successorSha256) return false;

    const commits = git([
      "rev-list", "--reverse", "--ancestry-path", `${WORKFLOW_V2_TAIL_PARENT}..HEAD`
    ]).split("\n").filter(Boolean);
    if (commits[0] !== WORKFLOW_V2_TAIL_ANCHOR) return false;

    let previous = WORKFLOW_V2_TAIL_PARENT;
    let pathChanged = false;
    let authorizationBoundaryRepairSeen = false;
    let authorizationBoundaryGovernanceSeen = false;
    let authorizationBoundaryProvenanceAdmissionSeen = false;
    let august1OwnerSuccessorsSeen = 0;
    let august1QualificationSuccessorsSeen = 0;
    let august1OverwatchSuccessorSeen = false;
    for (const commit of commits) {
      const [author, committer, parents, subject, tree] = git([
        "show", "-s", "--format=%ae%n%ce%n%P%n%s%n%T", commit
      ]).split("\n");
      const files = git(["diff-tree", "--no-commit-id", "--name-only", "-r", commit])
        .split("\n").filter(Boolean);

      if (commit === AUTHORIZATION_BOUNDARY_REPAIR_COMMIT) {
        if (authorizationBoundaryRepairSeen
          || previous !== AUTHORIZATION_BOUNDARY_REPAIR_PARENT
          || author !== "infrastructure@prometheus.local"
          || committer !== "infrastructure@prometheus.local"
          || parents !== previous
          || subject !== AUTHORIZATION_BOUNDARY_REPAIR_SUBJECT
          || tree !== AUTHORIZATION_BOUNDARY_REPAIR_TREE
          || JSON.stringify([...files].sort()) !== JSON.stringify([...AUTHORIZATION_BOUNDARY_REPAIR_PATHS].sort())) {
          return false;
        }
        authorizationBoundaryRepairSeen = true;
        previous = commit;
        continue;
      }

      if (commit === AUTHORIZATION_BOUNDARY_GOVERNANCE_COMMIT) {
        if (!authorizationBoundaryRepairSeen
          || authorizationBoundaryGovernanceSeen
          || previous !== AUTHORIZATION_BOUNDARY_GOVERNANCE_PARENT
          || author !== "overwatch@prometheus.local"
          || committer !== "overwatch@prometheus.local"
          || parents !== previous
          || subject !== AUTHORIZATION_BOUNDARY_GOVERNANCE_SUBJECT
          || tree !== AUTHORIZATION_BOUNDARY_GOVERNANCE_TREE
          || JSON.stringify([...files].sort()) !== JSON.stringify([...AUTHORIZATION_BOUNDARY_GOVERNANCE_PATHS].sort())) {
          return false;
        }
        authorizationBoundaryGovernanceSeen = true;
        if (files.includes(path)) pathChanged = true;
        previous = commit;
        continue;
      }

      if (commit === AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_COMMIT) {
        if (!authorizationBoundaryRepairSeen
          || !authorizationBoundaryGovernanceSeen
          || authorizationBoundaryProvenanceAdmissionSeen
          || previous !== AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_PARENT
          || author !== "infrastructure@prometheus.local"
          || committer !== "infrastructure@prometheus.local"
          || parents !== previous
          || subject !== AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_SUBJECT
          || tree !== AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_TREE
          || JSON.stringify([...files].sort()) !== JSON.stringify([...AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_PATHS].sort())) {
          return false;
        }
        authorizationBoundaryProvenanceAdmissionSeen = true;
        previous = commit;
        continue;
      }

      const expectedAugust1Owner = [
        AUGUST1_WEBSITE_SUCCESSOR,
        AUGUST1_ROLLBACK_SUCCESSOR,
        AUGUST1_PROVENANCE_ADMISSION
      ][august1OwnerSuccessorsSeen];
      if (expectedAugust1Owner && commit === expectedAugust1Owner.commit) {
        const expectedFiles = expectedAugust1Owner.files
          .map(item => typeof item === "string" ? item : item.path);
        const expectedAuthor = expectedAugust1Owner.author.match(/<([^>]+)>$/u)?.[1];
        const expectedCommitter = expectedAugust1Owner.committer.match(/<([^>]+)>$/u)?.[1];
        if (previous !== expectedAugust1Owner.parent
          || parents !== previous
          || author !== expectedAuthor
          || committer !== expectedCommitter
          || subject !== expectedAugust1Owner.subject
          || tree !== expectedAugust1Owner.tree
          || JSON.stringify([...files].sort()) !== JSON.stringify([...expectedFiles].sort())) {
          return false;
        }
        if (files.includes(path)) pathChanged = true;
        august1OwnerSuccessorsSeen += 1;
        previous = commit;
        continue;
      }

      const expectedQualification =
        AUGUST1_QUALIFICATION_SUCCESSORS[august1QualificationSuccessorsSeen];
      if (expectedQualification && commit === expectedQualification.commit) {
        const expectedFiles = expectedQualification.files
          .map(item => typeof item === "string" ? item : item.path);
        const expectedAuthor = expectedQualification.author.match(/<([^>]+)>$/u)?.[1];
        const expectedCommitter = expectedQualification.committer.match(/<([^>]+)>$/u)?.[1];
        if (previous !== expectedQualification.parent
          || parents !== previous
          || author !== expectedAuthor
          || committer !== expectedCommitter
          || subject !== expectedQualification.subject
          || tree !== expectedQualification.tree
          || JSON.stringify([...files].sort()) !== JSON.stringify([...expectedFiles].sort())) {
          return false;
        }
        if (files.includes(path)) pathChanged = true;
        august1QualificationSuccessorsSeen += 1;
        previous = commit;
        continue;
      }

      if (previous === AUGUST1_OVERWATCH_SUCCESSOR.parent) {
        if (commit !== AUGUST1_OVERWATCH_SUCCESSOR_COMMIT
          || parents !== AUGUST1_OVERWATCH_SUCCESSOR.parent
          || author !== "overwatch@prometheus.local"
          || committer !== "overwatch@prometheus.local"
          || subject !== AUGUST1_OVERWATCH_SUCCESSOR.subject
          || tree !== AUGUST1_OVERWATCH_SUCCESSOR_TREE
          || JSON.stringify([...files].sort())
            !== JSON.stringify([...AUGUST1_OVERWATCH_SUCCESSOR.files].sort())) {
          return false;
        }
        if (files.includes(path)) pathChanged = true;
        august1OverwatchSuccessorSeen = true;
        previous = commit;
        continue;
      }

      if (parents !== previous) return false;
      if (!isGovernedPublicDeploymentWorkflowV2VerifierCommit({
        path,
        author,
        committer,
        subject,
        files
      })) return false;
      if (files.includes(path)) {
        pathChanged = true;
      }
      previous = commit;
    }
    return previous === git(["rev-parse", "HEAD"])
      && pathChanged
      && authorizationBoundaryRepairSeen
      && authorizationBoundaryGovernanceSeen
      && authorizationBoundaryProvenanceAdmissionSeen
      && august1OwnerSuccessorsSeen === 3
      && august1QualificationSuccessorsSeen === AUGUST1_QUALIFICATION_SUCCESSORS.length
      && august1OverwatchSuccessorSeen;
  } catch {
    return false;
  }
}

function commitIdentity(commit) {
  const fields = git(["show", "-s", "--format=%an <%ae>%n%cn <%ce>%n%P%n%T", commit]).split("\n");
  return { author: fields[0], committer: fields[1], parents: fields[2].split(" "), tree: fields[3] };
}

function commitPaths(commit) {
  return git(["diff-tree", "--no-commit-id", "--name-only", "-r", commit])
    .split("\n")
    .filter(Boolean);
}

function verifyExactCommit(expected) {
  const identity = commitIdentity(expected.commit);
  assert.equal(identity.author, expected.author);
  assert.equal(identity.committer, expected.committer);
  assert.deepEqual(identity.parents, [expected.parent]);
  assert.equal(identity.tree, expected.tree);
  assert.equal(git(["show", "-s", "--format=%s", expected.commit]), expected.subject);
  const expectedPaths = expected.files.map(item => typeof item === "string" ? item : item.path);
  assert.deepEqual(commitPaths(expected.commit).sort(), [...expectedPaths].sort());
  for (const evidence of expected.files.filter(item => typeof item !== "string")) {
    assert.equal(
      sha256(readAtCommit(expected.commit, evidence.path)),
      evidence.sha256,
      `August 1 owner evidence drifted: ${evidence.path}`
    );
  }
}

function verifyAugust1LaunchCloseoutSuccessor(governance) {
  assert.deepEqual(governance.august1LaunchCloseoutSuccessor, AUGUST1_LAUNCH_CLOSEOUT_SUCCESSOR);
  for (const expected of [
    AUGUST1_WEBSITE_SUCCESSOR,
    AUGUST1_ROLLBACK_SUCCESSOR,
    AUGUST1_PROVENANCE_ADMISSION,
    AUGUST1_INITIAL_OVERWATCH_SUCCESSOR,
    AUGUST1_MANIFEST_REPAIR_SUCCESSOR,
    AUGUST1_PROVENANCE_CLOSURE_SUCCESSOR,
    AUGUST1_WORKFLOW_PIN_REFRESH_SUCCESSOR,
    ...AUGUST1_QUALIFICATION_SUCCESSORS
  ]) verifyExactCommit(expected);

  verifyExactCommit(CURRENT_AUGUST1_PIN_REFRESH);
}

function verifyRouteIqWebsitePositioningSuccessor(governance) {
  assert.deepEqual(
    governance.routeIqWebsitePositioningSuccessor,
    ROUTE_IQ_WEBSITE_POSITIONING_SUCCESSOR
  );
  verifyExactCommit(ROUTE_IQ_WEBSITE_POSITIONING_SUCCESSOR.websiteSource);
  for (const successor of ROUTE_IQ_WEBSITE_POSITIONING_SUCCESSOR.dataProvenanceSuccessors) {
    verifyExactCommit(successor);
  }
  verifyExactCommit(ROUTE_IQ_WEBSITE_POSITIONING_SUCCESSOR.websiteAssets);
  verifyExactCommit(ROUTE_IQ_WEBSITE_POSITIONING_SUCCESSOR.infrastructure);
}

function verifyDashboardVisualReleaseSuccessor() {
  const successor = readJson(DASHBOARD_VISUAL_SUCCESSOR_GOVERNANCE_PATH);
  assert.equal(
    successor.version,
    "route-iq-overwatch-public-navigation-dashboard-visual-successor-v1"
  );
  assert.equal(successor.batchId, "BATCH-20260815-001");
  assert.equal(successor.status, "INDEPENDENTLY_VERIFIED_SOURCE_SUCCESSOR");
  assert.equal(successor.ownerSubsystem, "Prometheus Overwatch");
  for (const predecessor of successor.predecessors) {
    assert.equal(sha256(read(predecessor.path)), predecessor.sha256);
    assert.equal(predecessor.remainsHistorical, true);
    assert.equal(predecessor.rewritten, false);
  }
  for (const implementation of successor.implementationCommits) {
    const identity = commitIdentity(implementation.commit);
    assert.equal(identity.author, implementation.identity);
    assert.equal(identity.committer, implementation.identity);
    assert.deepEqual(identity.parents, [implementation.parent]);
    assert.equal(identity.tree, implementation.tree);
    assert.equal(
      git(["show", "-s", "--format=%s", implementation.commit]),
      implementation.subject
    );
    assert.deepEqual(
      commitPaths(implementation.commit).sort(),
      [...implementation.changedFiles].sort()
    );
    assert.doesNotThrow(() => git([
      "merge-base", "--is-ancestor", implementation.commit, "HEAD"
    ]));
  }
  assert.equal(
    sha256(read(successor.intelligenceProvenance.path)),
    successor.intelligenceProvenance.sha256
  );
  for (const contract of Object.values(successor.currentContracts)) {
    assert.equal(sha256(read(contract.path)), contract.sha256);
  }
  assert.equal(
    git(["show", "-s", "--format=%T", successor.releaseIdentities.websiteCommit]),
    successor.releaseIdentities.websiteTree
  );
  assert.equal(successor.releaseBoundary.productionDeploymentAuthorized, false);
  assert.equal(successor.releaseBoundary.productionStorageAccessAllowed, false);
  assert.equal(successor.protectedState.collection, "OFF");
  assert.equal(successor.protectedState.activeCohorts, 0);
  assert.equal(successor.protectedState.recommendationInfluence, "OFF");
  assert.equal(successor.protectedState.productionDeployments, 0);
  assert.equal(successor.protectedState.productionDataMutations, 0);
  return successor;
}

export function verifyOverwatchPublicDeploymentWorkflowV2() {
  const governance = readJson(GOVERNANCE_PATH);
  const ownerContract = readJson(OWNER_CONTRACT_PATH);
  const qualification = read(".github/workflows/qualify-prometheus-public-worker.yml");
  const deployment = read(".github/workflows/deploy-prometheus-public-worker.yml");
  const documentation = read(DOCUMENTATION_PATH);
  const result = evaluatePublicDeploymentWorkflowV2Governance({
    governance,
    ownerContract,
    qualification,
    deployment,
    documentation
  });
  assert.equal(result.ok, true, result.failures.join("\n"));
  verifyAugust1LaunchCloseoutSuccessor(governance);
  verifyRouteIqWebsitePositioningSuccessor(governance);

  const identity = commitIdentity(OWNER_COMMIT);
  assert.equal(identity.author, OWNER_IDENTITY);
  assert.equal(identity.committer, OWNER_IDENTITY);
  assert.deepEqual(identity.parents, [OWNER_PARENT]);
  assert.equal(identity.tree, OWNER_TREE);
  assert.doesNotThrow(() => git(["merge-base", "--is-ancestor", OWNER_COMMIT, "HEAD"]));

  const committedPaths = git(["diff-tree", "--no-commit-id", "--name-only", "-r", OWNER_COMMIT])
    .split("\n").filter(Boolean).sort();
  const governedPaths = governance.implementationProvenance.files.map(item => item.path).sort();
  assert.deepEqual(committedPaths, governedPaths);
  for (const evidence of governance.implementationProvenance.files) {
    const committedEvidence = execFileSync("/usr/bin/git", [
      "show", `${OWNER_COMMIT}:${evidence.path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
    assert.equal(sha256(committedEvidence), evidence.sha256, `Historical owner evidence drifted: ${evidence.path}`);
  }
  assert.equal(committedPaths.some(path => /^(?:src\/|crm\/|data\/|intelligence\/|index\.html|deploy\/prometheusrouteiq-website\/)/u.test(path)), false);

  const boundaryRepairIdentity = commitIdentity(AUTHORIZATION_BOUNDARY_REPAIR_COMMIT);
  assert.equal(boundaryRepairIdentity.author, OWNER_IDENTITY);
  assert.equal(boundaryRepairIdentity.committer, OWNER_IDENTITY);
  assert.deepEqual(boundaryRepairIdentity.parents, [AUTHORIZATION_BOUNDARY_REPAIR_PARENT]);
  assert.equal(boundaryRepairIdentity.tree, AUTHORIZATION_BOUNDARY_REPAIR_TREE);
  assert.equal(
    git(["show", "-s", "--format=%s", AUTHORIZATION_BOUNDARY_REPAIR_COMMIT]),
    AUTHORIZATION_BOUNDARY_REPAIR_SUBJECT
  );
  assert.doesNotThrow(() => git(["merge-base", "--is-ancestor", AUTHORIZATION_BOUNDARY_REPAIR_COMMIT, "HEAD"]));

  const boundaryRepairPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", AUTHORIZATION_BOUNDARY_REPAIR_COMMIT
  ]).split("\n").filter(Boolean).sort();
  const governedBoundaryRepairPaths = governance.authorizationBoundaryRepair.files
    .map(item => item.path).sort();
  assert.deepEqual(boundaryRepairPaths, governedBoundaryRepairPaths);
  assert.deepEqual(boundaryRepairPaths, [...AUTHORIZATION_BOUNDARY_REPAIR_PATHS].sort());
  for (const evidence of governance.authorizationBoundaryRepair.files) {
    assert.equal(
      sha256(readAtCommit(AUTHORIZATION_BOUNDARY_REPAIR_COMMIT, evidence.path)),
      evidence.sha256,
      `Historical authorization-boundary repair evidence drifted: ${evidence.path}`
    );
  }
  assert.equal(boundaryRepairPaths.every(path => /^(?:docs\/|scripts\/|tests\/|workers\/infrastructure\/)/u.test(path)), true);

  const fixtureRepairIdentity = commitIdentity(WORKFLOW_V2_FIXTURE_REPAIR_COMMIT);
  assert.equal(fixtureRepairIdentity.author, OWNER_IDENTITY);
  assert.equal(fixtureRepairIdentity.committer, OWNER_IDENTITY);
  assert.deepEqual(fixtureRepairIdentity.parents, [WORKFLOW_V2_FIXTURE_REPAIR_PARENT]);
  assert.equal(fixtureRepairIdentity.tree, WORKFLOW_V2_FIXTURE_REPAIR_TREE);
  assert.equal(
    git(["show", "-s", "--format=%s", WORKFLOW_V2_FIXTURE_REPAIR_COMMIT]),
    WORKFLOW_V2_FIXTURE_REPAIR_SUBJECT
  );
  assert.doesNotThrow(() => git(["merge-base", "--is-ancestor", WORKFLOW_V2_FIXTURE_REPAIR_COMMIT, "HEAD"]));
  const fixtureRepairPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", WORKFLOW_V2_FIXTURE_REPAIR_COMMIT
  ]).split("\n").filter(Boolean).sort();
  assert.deepEqual(fixtureRepairPaths, [...WORKFLOW_V2_FIXTURE_REPAIR_PATHS].sort());
  assert.deepEqual(
    governance.workflowV2FixtureRepairSuccessor.files.map(item => item.path).sort(),
    [...WORKFLOW_V2_FIXTURE_REPAIR_PATHS].sort()
  );
  for (const evidence of governance.workflowV2FixtureRepairSuccessor.files) {
    const committedEvidence = execFileSync("/usr/bin/git", [
      "show", `${WORKFLOW_V2_FIXTURE_REPAIR_COMMIT}:${evidence.path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
    assert.equal(sha256(committedEvidence), evidence.sha256, `Workflow v2 fixture repair evidence drifted: ${evidence.path}`);
  }

  const boundaryGovernanceIdentity = commitIdentity(AUTHORIZATION_BOUNDARY_GOVERNANCE_COMMIT);
  assert.equal(boundaryGovernanceIdentity.author, OVERWATCH_IDENTITY);
  assert.equal(boundaryGovernanceIdentity.committer, OVERWATCH_IDENTITY);
  assert.deepEqual(boundaryGovernanceIdentity.parents, [AUTHORIZATION_BOUNDARY_GOVERNANCE_PARENT]);
  assert.equal(boundaryGovernanceIdentity.tree, AUTHORIZATION_BOUNDARY_GOVERNANCE_TREE);
  assert.equal(
    git(["show", "-s", "--format=%s", AUTHORIZATION_BOUNDARY_GOVERNANCE_COMMIT]),
    AUTHORIZATION_BOUNDARY_GOVERNANCE_SUBJECT
  );
  assert.doesNotThrow(() => git(["merge-base", "--is-ancestor", AUTHORIZATION_BOUNDARY_GOVERNANCE_COMMIT, "HEAD"]));

  const boundaryGovernancePaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", AUTHORIZATION_BOUNDARY_GOVERNANCE_COMMIT
  ]).split("\n").filter(Boolean).sort();
  const governedBoundaryGovernancePaths = governance.authorizationBoundaryGovernance.files
    .map(item => item.path).sort();
  assert.deepEqual(boundaryGovernancePaths, governedBoundaryGovernancePaths);
  assert.deepEqual(boundaryGovernancePaths, [...AUTHORIZATION_BOUNDARY_GOVERNANCE_PATHS].sort());
  for (const evidence of governance.authorizationBoundaryGovernance.files) {
    const committedEvidence = execFileSync("/usr/bin/git", [
      "show", `${AUTHORIZATION_BOUNDARY_GOVERNANCE_COMMIT}:${evidence.path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
    assert.equal(sha256(committedEvidence), evidence.sha256, `Authorization-boundary governance evidence drifted: ${evidence.path}`);
  }

  const boundaryProvenanceAdmissionIdentity = commitIdentity(AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_COMMIT);
  assert.equal(boundaryProvenanceAdmissionIdentity.author, OWNER_IDENTITY);
  assert.equal(boundaryProvenanceAdmissionIdentity.committer, OWNER_IDENTITY);
  assert.deepEqual(boundaryProvenanceAdmissionIdentity.parents, [AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_PARENT]);
  assert.equal(boundaryProvenanceAdmissionIdentity.tree, AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_TREE);
  assert.equal(
    git(["show", "-s", "--format=%s", AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_COMMIT]),
    AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_SUBJECT
  );
  assert.doesNotThrow(() => git(["merge-base", "--is-ancestor", AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_COMMIT, "HEAD"]));

  const boundaryProvenanceAdmissionPaths = git([
    "diff-tree", "--no-commit-id", "--name-only", "-r", AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_COMMIT
  ]).split("\n").filter(Boolean).sort();
  const governedBoundaryProvenanceAdmissionPaths = governance.authorizationBoundaryProvenanceAdmission.files
    .map(item => item.path).sort();
  assert.deepEqual(boundaryProvenanceAdmissionPaths, governedBoundaryProvenanceAdmissionPaths);
  assert.deepEqual(boundaryProvenanceAdmissionPaths, [...AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_PATHS].sort());
  for (const evidence of governance.authorizationBoundaryProvenanceAdmission.files) {
    const committedEvidence = execFileSync("/usr/bin/git", [
      "show", `${AUTHORIZATION_BOUNDARY_PROVENANCE_ADMISSION_COMMIT}:${evidence.path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
    assert.equal(sha256(committedEvidence), evidence.sha256, `Authorization-boundary provenance-admission evidence drifted: ${evidence.path}`);
  }
  assert.equal(
    boundaryProvenanceAdmissionPaths.every(path => /^(?:docs\/|scripts\/verify-|tests\/|workers\/infrastructure\/)/u.test(path)),
    true
  );

  const repairIdentity = commitIdentity(PROVENANCE_REPAIR_COMMIT);
  assert.equal(repairIdentity.author, OWNER_IDENTITY);
  assert.equal(repairIdentity.committer, OWNER_IDENTITY);
  assert.deepEqual(repairIdentity.parents, [PROVENANCE_REPAIR_PARENT]);
  assert.equal(repairIdentity.tree, PROVENANCE_REPAIR_TREE);
  assert.equal(git(["show", "-s", "--format=%s", PROVENANCE_REPAIR_COMMIT]), PROVENANCE_REPAIR_SUBJECT);
  assert.doesNotThrow(() => git(["merge-base", "--is-ancestor", PROVENANCE_REPAIR_COMMIT, "HEAD"]));

  const repairPaths = git(["diff-tree", "--no-commit-id", "--name-only", "-r", PROVENANCE_REPAIR_COMMIT])
    .split("\n").filter(Boolean).sort();
  const governedRepairPaths = governance.provenanceRepair.files.map(item => item.path).sort();
  assert.deepEqual(repairPaths, governedRepairPaths);
  for (const evidence of governance.provenanceRepair.files) {
    const committedEvidence = execFileSync("/usr/bin/git", [
      "show", `${PROVENANCE_REPAIR_COMMIT}:${evidence.path}`
    ], { cwd: root, encoding: null, stdio: ["ignore", "pipe", "ignore"] });
    assert.equal(sha256(committedEvidence), evidence.sha256, `Historical provenance repair evidence drifted: ${evidence.path}`);
  }
  assert.equal(repairPaths.every(path => /^(?:docs\/|scripts\/verify-|tests\/|workers\/infrastructure\/)/u.test(path)), true);
  assert.equal(
    validateCurrentCanonicalPackageSuccessor().currentSha256,
    sha256(read(PACKAGE_PATH))
  );

  for (const path of [GOVERNANCE_PATH, DOCUMENTATION_PATH]) {
    assert.equal(git(["log", "-1", "--format=%an <%ae>", "--", path]), OVERWATCH_IDENTITY);
  }

  const registry = verifyCrossSubsystemArtifactContracts().registry;
  const entry = registry.governanceArtifacts.find(item => item.artifactId === governance.governanceId);
  assert.equal(entry?.path, GOVERNANCE_PATH);
  assert.equal(entry?.documentationPath, DOCUMENTATION_PATH);
  assert.deepEqual(entry?.writeAllowed, ["Prometheus Overwatch"]);

  verifyAutomaticCommitPushGovernance();
  verifyGithubActionsPublicWorkerWorkflowV2();
  const liveCanonicalIdentity = readJson(LIVE_CANONICAL_IDENTITY_GOVERNANCE_PATH);
  assert.equal(
    liveCanonicalIdentity.releasePreparation?.publicWorkflowsChanged,
    false
  );
  assert.equal(
    liveCanonicalIdentity.releasePreparation?.publicDeploymentAssetsSha256,
    LIVE_CANONICAL_IDENTITY_DEPLOYMENT_ASSET_SHA256
  );
  assert.equal(
    liveCanonicalIdentity.releasePreparation?.publicRollback?.contractSha256,
    LIVE_CANONICAL_IDENTITY_ROLLBACK_CONTRACT_SHA256
  );
  assert.equal(
    liveCanonicalIdentity.releasePreparation?.publicRollback?.artifactSha256,
    LIVE_CANONICAL_IDENTITY_ROLLBACK_ARTIFACT_SHA256
  );
  const dashboardVisualSuccessor = verifyDashboardVisualReleaseSuccessor();
  const assets = verifyRouteIqPublicDeploymentAssets({ build: false });
  assert.equal(
    assets.deploymentAssetsSha256,
    dashboardVisualSuccessor.releaseIdentities.deploymentAssetSha256
  );
  assert.equal(
    assets.candidateWebsiteCommit,
    dashboardVisualSuccessor.releaseIdentities.websiteCommit
  );
  assert.equal(
    assets.candidateWebsiteTree,
    dashboardVisualSuccessor.releaseIdentities.websiteTree
  );
  const rollback = verifyPublicForwardRollbackArtifact(root);
  assert.equal(
    rollback.artifactSha256,
    dashboardVisualSuccessor.releaseIdentities.rollbackBundleSha256
  );
  assert.equal(
    rollback.candidateDeploymentAssetsSha256,
    dashboardVisualSuccessor.releaseIdentities.deploymentAssetSha256
  );
  return Object.freeze({ status: "OVERWATCH_PUBLIC_DEPLOYMENT_WORKFLOW_V2_VERIFIED" });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${verifyOverwatchPublicDeploymentWorkflowV2().status}\n`);
}
