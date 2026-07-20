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
import { verifyRouteIqPublicRepositoryIntegrityRepair } from "./verify-route-iq-public-repository-integrity-repair.mjs";

export const PUBLIC_INTEGRITY_READINESS_PATH =
  "overwatch/governance/route-iq-public-deployment-integrity-repair-readiness-v1.json";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const HISTORICAL_SUCCESSOR_PATH =
  "overwatch/governance/route-iq-revised-3d-release-readiness-successor-v1.json";
const INFRASTRUCTURE_CONTRACT_PATH =
  "workers/infrastructure/route-iq-public-repository-integrity-repair-v1.json";
const DEPLOYMENT_INFRASTRUCTURE_CONTRACT_PATH =
  "workers/infrastructure/github-actions-founder-triggered-public-worker-deployment-v1.json";
const ROLLBACK_CONTRACT_PATH = "workers/infrastructure/route-iq-public-forward-rollback-v1.json";
const HISTORICAL_SUCCESSOR_SHA256 = "aea011a5633a3d666f7bc402d6d7cfa38884833c1ce4ca3d6a6cdc84c4d27f75";
const INFRASTRUCTURE_CONTRACT_SHA256 = "dcf724bac263447b38b3db1b5356f9e6a94871dc299a15ca767b1ba8385dbc80";
const DEPLOYMENT_INFRASTRUCTURE_CONTRACT_SHA256 =
  "6db577e033e65969f412583a3f40459c59115fcb13eaf45fd5cfa9c9c8b99612";
const PRE_ASSET_ORDERING_INFRASTRUCTURE_CONTRACT_SHA256 =
  "408c38b30b1a8374d51521a197fd9c600b0bc69e93d8fba0e3f1a0f7bda94015";
const SAFE_NO_SECRET_ASSET_ORDERING_INFRASTRUCTURE_CONTRACT_SHA256 =
  "720458551a9383d7705b6a03f58e938072a61aae22ef3a55cb0c6eea867226b9";
const ROLLBACK_CONTRACT_SHA256 = "150d24acaeee5f1f6589bb92582fc701e7480cca22d5bd136ce0f27af4fc220b";
const DEPLOYMENT_ASSETS_SHA256 = "5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15";
const ROLLBACK_BUNDLE_SHA256 = "3c1991905657516653ee74ef0ac59f711b21f95df06bf490be5f370479ba7ff7";
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

export function validatePublicIntegrityReadiness(governance) {
  assert.equal(governance?.governanceId, "route-iq-public-deployment-integrity-repair-readiness-v1");
  assert.equal(governance?.version, "1.9.0");
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
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierGenerallyAllowsDashboardSuccessors, false);
  assert.equal(governance?.infrastructureEvidence?.ownerVerifierRejectsMixedOwnershipAndMerges, true);

  assert.equal(governance?.releaseIdentities?.deploymentAssetsSha256, DEPLOYMENT_ASSETS_SHA256);
  assert.equal(governance?.releaseIdentities?.rollbackContractPath, ROLLBACK_CONTRACT_PATH);
  assert.equal(governance?.releaseIdentities?.rollbackContractSha256, ROLLBACK_CONTRACT_SHA256);
  assert.equal(governance?.releaseIdentities?.deterministicForwardRollbackBundleSha256, ROLLBACK_BUNDLE_SHA256);
  assert.equal(governance?.releaseIdentities?.websiteAndCrmImplementationChanged, false);
  assert.equal(governance?.releaseIdentities?.generatedDeploymentAssetsChanged, false);
  assert.equal(governance?.releaseIdentities?.newFounderVisualAcceptanceRequired, false);

  assert.deepEqual(governance?.predeploymentSmokeRepair, {
    batchId: "BATCH-20260720-001",
    directive: "Route IQ Combined Final Preflight + Public Deployment v1",
    classification: "READ_ONLY_SMOKE_VERIFIER_CONTRACT_REPAIR",
    authorizedCandidate: {
      commit: FOURTH_OVERWATCH_SUCCESSOR.commit,
      tree: FOURTH_OVERWATCH_SUCCESSOR.tree,
      deploymentAssetsSha256: DEPLOYMENT_ASSETS_SHA256,
      rollbackContractSha256: ROLLBACK_CONTRACT_SHA256,
      deterministicRollbackBundleSha256: ROLLBACK_BUNDLE_SHA256,
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
      deploymentSha256: DEPLOYMENT_INFRASTRUCTURE_CONTRACT_SHA256,
      repositoryIntegrityPath: INFRASTRUCTURE_CONTRACT_PATH,
      repositoryIntegritySha256: INFRASTRUCTURE_CONTRACT_SHA256
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

  assert.deepEqual(governance?.productionIdentities, {
    publicWorker: {
      name: "prometheusrouteiq-website",
      version: "a0296f92-4427-4cea-a3e2-9a5e05a4596c",
      trafficPercent: 100
    },
    privateWorker: {
      name: "prometheus-iq",
      version: "b8cba784-dfd3-4f8e-8356-816cccf6aecc",
      trafficPercent: 100
    },
    changedByBatch: false
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

function verifyOwnership(root, requireCommittedOverwatch) {
  assert.equal(git(root, "rev-parse", `${HISTORICAL_SUCCESSOR_COMMIT}^{tree}`), HISTORICAL_SUCCESSOR_TREE);
  assert.equal(git(root, "rev-list", "--min-parents=2", `${HISTORICAL_SUCCESSOR_COMMIT}..HEAD`), "");
  const commits = git(root, "rev-list", "--reverse", `${HISTORICAL_SUCCESSOR_COMMIT}..HEAD`)
    .split("\n")
    .filter(Boolean);
  const expectedCount = requireCommittedOverwatch ? 37 : 36;
  assert.equal(commits.length, expectedCount);
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

  if (requireCommittedOverwatch) {
    const record = commitRecord(root, commits[36]);
    assert.equal(record.author, "overwatch@prometheus.local");
    assert.equal(record.committer, "overwatch@prometheus.local");
    assert.equal(record.subject, CLOUDFLARE_DEPLOYMENT_READ_OVERWATCH_SUBJECT);
    assert.deepEqual(sorted(record.files), sorted(FINAL_OVERWATCH_SUCCESSOR_PATHS));
    assert.equal(
      git(root, "rev-parse", `${commits[36]}^`),
      INFRASTRUCTURE_COMMITS.at(-1).commit
    );
  }
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
  assert.equal(sha256(read(root, INFRASTRUCTURE_CONTRACT_PATH)), INFRASTRUCTURE_CONTRACT_SHA256);
  assert.equal(
    sha256(read(root, DEPLOYMENT_INFRASTRUCTURE_CONTRACT_PATH)),
    DEPLOYMENT_INFRASTRUCTURE_CONTRACT_SHA256
  );
  assert.equal(sha256(read(root, ROLLBACK_CONTRACT_PATH)), ROLLBACK_CONTRACT_SHA256);

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

  const ownerRepair = verifyRouteIqPublicRepositoryIntegrityRepair();
  assert.equal(ownerRepair.rollbackArtifactSha256, ROLLBACK_BUNDLE_SHA256);
  const deployment = verifyRouteIqPublicDeploymentAssets({ build });
  assert.equal(deployment.deploymentAssetsSha256, DEPLOYMENT_ASSETS_SHA256);
  const rollback = verifyPublicForwardRollbackArtifact(root);
  assert.equal(rollback.artifactSha256, ROLLBACK_BUNDLE_SHA256);
  assert.equal(rollback.candidateDeploymentAssetsSha256, DEPLOYMENT_ASSETS_SHA256);

  const commits = verifyOwnership(root, requireCommittedOverwatch);
  verifyConsumerResolution(root);
  if (requireClean) assert.equal(git(root, "status", "--porcelain"), "", "Working tree is not clean.");
  return Object.freeze({
    status: governance.status,
    batchId: governance.batchId,
    head: git(root, "rev-parse", "HEAD"),
    tree: git(root, "rev-parse", "HEAD^{tree}"),
    commits,
    deploymentAssetsSha256: DEPLOYMENT_ASSETS_SHA256,
    rollbackContractSha256: ROLLBACK_CONTRACT_SHA256,
    rollbackBundleSha256: ROLLBACK_BUNDLE_SHA256,
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
