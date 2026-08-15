import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const record = JSON.parse(readFileSync(
  new URL("../patents/route-iq/GYM_PREVIEW_ADVERTISING_CLAIMS_GOVERNANCE_V1.json", import.meta.url),
  "utf8"
));

test("Founder creative bytes remain exact and preview-only", () => {
  const expectedCreative = "29 MEMBERS IN 48 HOURS. $0 AD SPEND.";
  const creativeBytes = Buffer.from(record.founderCreative.text, "utf8");

  assert.equal(record.batchId, "BATCH-20260814-002");
  assert.deepEqual(record.sourceBaseline, {
    commit: "530808f3a730f76be8fc78e6bfa2f8b753741182",
    tree: "80801bdcab87aa8d7504b655d725dd46c25dfe34"
  });
  assert.equal(record.founderCreative.text, expectedCreative);
  assert.equal(record.founderCreative.bytesAltered, false);
  assert.equal(creativeBytes.byteLength, record.founderCreative.byteLength);
  assert.equal(
    createHash("sha256").update(creativeBytes).digest("hex"),
    record.founderCreative.sha256
  );
  assert.equal(record.advertisingClaim.classification, "PREVIEW_ONLY");
  assert.equal(record.advertisingClaim.previewUseAllowed, true);
  assert.equal(record.advertisingClaim.productionUseAllowed, false);
});

test("production stays blocked until every required advertising fact is proven", () => {
  const claim = record.advertisingClaim;
  const requirements = claim.productionEvidenceRequirements;

  assert.equal(claim.truthState, "INSUFFICIENT_EVIDENCE");
  assert.equal(claim.productionDisposition, "BLOCKED_PENDING_GOVERNED_EVIDENCE");
  assert.equal(claim.productionEligibilityRule, "EVERY_REQUIREMENT_PROVEN");
  assert.deepEqual(
    requirements.map(({ requirement }) => requirement),
    ["result", "time_period", "ad_spend_scope", "gym_context", "qualifications"]
  );
  assert.equal(requirements.every(({ status }) => status === "NOT_PROVEN"), true);
  assert.equal(requirements.every(({ status }) => status === "PROVEN"), false);
});

test("market-focus replacement is approved within inactive influence boundaries", () => {
  assert.deepEqual(record.positioningReplacement, {
    sourcePhrase: "production validation environment",
    approvedReplacement: "Gym sales is our first focused market.",
    disposition: "APPROVED",
    basis: {
      truthState: "INSUFFICIENT_EVIDENCE",
      collection: "OFF",
      recommendationInfluence: "OFF"
    },
    boundary: "The replacement describes market focus and does not assert production validation."
  });
});

test("existing filing governance supports the patent-pending designation without a new patent change", () => {
  const roadmap = readFileSync(new URL("../patents/PATENT_ROADMAP.md", import.meta.url), "utf8");
  const filingReport = readFileSync(
    new URL("../patents/route-iq/ROUTE_IQ_USPTO_PROVISIONAL_FILING_REPORT_V1.md", import.meta.url),
    "utf8"
  );

  assert.equal(record.patentDesignation.text, "U.S. PATENT PENDING");
  assert.equal(record.patentDesignation.disposition, "PRESERVE");
  assert.equal(record.patentDesignation.supportStatus, "SUPPORTED_BY_EXISTING_REPOSITORY_GOVERNANCE");
  assert.match(roadmap, /Route IQ is Patent Pending\./);
  assert.match(filingReport, /completed a manual USPTO Patent Center filing workflow for a U\.S\. provisional patent application/);
  assert.match(filingReport, /Application number \| 64\/107,865/);
  assert.equal(record.inventionDisposition.materiallyInventiveChangeDetected, false);
  assert.equal(record.inventionDisposition.newPatentChange, "NONE");
  assert.equal(record.inventionDisposition.inventionRegisterMutationRequired, false);
});

test("Claims ownership does not mutate creative, runtime state, or deployment", () => {
  assert.deepEqual(record.ownerBoundary, {
    founderCreativeImplementationChanged: false,
    productionBehaviorChanged: false,
    collectionChanged: false,
    recommendationInfluenceChanged: false,
    deploymentPerformed: false
  });
});
