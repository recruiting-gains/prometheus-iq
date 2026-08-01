import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  verifyOverwatchFullSystemHarmonyAudit
} from "../scripts/verify-overwatch-full-system-harmony-audit-v1.mjs";

const governance = JSON.parse(readFileSync(
  new URL("../overwatch/governance/full-system-harmony-audit-v1.json", import.meta.url),
  "utf8"
));
const report = JSON.parse(readFileSync(
  new URL(
    "../overwatch/reports/BATCH-20260731-002-full-system-harmony-audit-v1.json",
    import.meta.url
  ),
  "utf8"
));

test("Overwatch accepts only the exact owner chain and harmony boundary", () => {
  const result = verifyOverwatchFullSystemHarmonyAudit({ governance, report });
  assert.deepEqual(result, {
    status: "OVERWATCH_FULL_SYSTEM_HARMONY_AUDIT_V1_VERIFIED",
    ownerCommitCount: 24,
    subsystemCount: 20,
    contractCount: 19,
    decision: "CONDITIONAL_GO"
  });
});

test("P0 and P1 remain empty while external commercial prerequisites stay explicit", () => {
  assert.deepEqual(governance.defectLedger.p0, []);
  assert.deepEqual(governance.defectLedger.p1, []);
  assert.ok(governance.defectLedger.p2.length > 0);
  assert.ok(report.externalPrerequisites.includes("EIN"));
  assert.ok(report.externalPrerequisites.includes("Stripe account and Live Mode authorization"));
  assert.equal(report.releaseBoundary.liveBillingAllowed, false);
});

test("every material subsystem declares authority, containment, audit, and recovery", () => {
  assert.equal(governance.subsystems.length, 20);
  for (const subsystem of governance.subsystems) {
    assert.ok(subsystem.authority);
    assert.ok(subsystem.failure);
    assert.ok(subsystem.audit);
    assert.ok(subsystem.recovery);
    assert.ok(subsystem.tenantBoundary);
  }
});

test("all cross-subsystem contracts are explicit and passing", () => {
  assert.equal(governance.contractMatrix.length, 19);
  assert.equal(
    governance.contractMatrix.every(item => item.result.startsWith("PASS")),
    true
  );
  assert.ok(governance.contractMatrix.some(item =>
    item.from === "billing_state" && item.to === "activation_gate"
  ));
  assert.ok(governance.contractMatrix.some(item =>
    item.from === "rollback_artifact" && item.to === "restored_state"
  ));
});

test("protected state forbids production writes, live billing, and public mutation", () => {
  assert.equal(governance.protectedState.productionCustomerWrites, 0);
  assert.equal(governance.protectedState.productionCrmWrites, 0);
  assert.equal(governance.protectedState.productionReceiptMutations, 0);
  assert.equal(governance.protectedState.liveModeObjectsCreated, 0);
  assert.equal(governance.protectedState.charges, 0);
  assert.equal(governance.protectedState.publicWorkerMutationAllowed, false);
  assert.equal(governance.protectedState.secretExposure, false);
});
