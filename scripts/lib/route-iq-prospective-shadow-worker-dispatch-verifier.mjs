import assert from "node:assert/strict";

const governedHandleApiRequestSignature = /async function handleApiRequest\(request, env, executionContext, \{\s*dailySnapshotTestHooks,\s*governedLearningAdvisoryTestHooks,\s*paidCustomerOnboardingTestHooks,\s*paidCustomerDashboardPreviewTestHooks,\s*paidCustomerRevenueReadinessTestHooks\s*\} = \{\}\) \{/u;
const governedProspectiveDispatch = /if \(isRouteIqProspectiveShadowPath\(url\.pathname\)\) \{\s*return handleRouteIqProspectiveShadowRequest\(request, env, \{ executionContext \}\);\s*\}/u;
const governedHandleApiRequestCall = /withAegisHeaders\(\s*await handleApiRequest\(request, env, executionContext, \{\s*dailySnapshotTestHooks,\s*governedLearningAdvisoryTestHooks,\s*paidCustomerOnboardingTestHooks,\s*paidCustomerDashboardPreviewTestHooks,\s*paidCustomerRevenueReadinessTestHooks\s*\}\),\s*aegis\s*\)/u;

function matchCount(source, pattern) {
  return (source.match(new RegExp(pattern.source, `${pattern.flags}g`)) || []).length;
}

export function verifyRouteIqProspectiveWorkerDispatchSource(source) {
  assert.equal(typeof source, "string", "Worker source must be a string");
  assert.equal(
    (source.match(/async function handleApiRequest\(/gu) || []).length,
    1,
    "Worker must define exactly one handleApiRequest function"
  );
  assert.equal(
    matchCount(source, governedHandleApiRequestSignature),
    1,
    "handleApiRequest must use the exact governed API hook signature"
  );
  assert.equal(
    matchCount(source, governedProspectiveDispatch),
    1,
    "handleApiRequest must preserve the exact prospective-shadow execution-context dispatch"
  );
  assert.equal(
    (source.match(/await handleApiRequest\(request, env, executionContext,/gu) || []).length,
    1,
    "Worker must invoke handleApiRequest exactly once"
  );
  assert.equal(
    matchCount(source, governedHandleApiRequestCall),
    1,
    "Worker must forward the exact governed API hooks through the Aegis-wrapped API dispatch"
  );
}
