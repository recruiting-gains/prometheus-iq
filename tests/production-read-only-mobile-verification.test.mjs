import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_MOBILE_VIEWPORT_META,
  MOBILE_VIEWPORT,
  REQUIRED_COUNT_CATEGORIES,
  REQUIRED_GUARD_CONFIGURATION,
  evaluateGuardConfiguration,
  evaluateGuardEvidence,
  evaluatePreNavigationViewport,
  evaluateProductionCounts,
  evaluateReadOnlyMobileVerification,
  evaluateSavedBrowserEvidence,
  runProductionReadOnlyMobileEvidenceEvaluation
} from "../scripts/verify-production-read-only-mobile.mjs";

function counts(overrides = {}) {
  return {
    sessions: 7,
    visits: 4,
    actions: 0,
    outcomes: 4,
    prospectiveRecords: 0,
    conflicts: 0,
    exclusions: 0,
    evaluations: 0,
    ...overrides
  };
}

function viewport(overrides = {}) {
  return {
    windowInnerWidth: MOBILE_VIEWPORT.width,
    windowInnerHeight: MOBILE_VIEWPORT.height,
    documentClientWidth: MOBILE_VIEWPORT.width,
    documentClientHeight: MOBILE_VIEWPORT.height,
    screenWidth: MOBILE_VIEWPORT.width,
    screenHeight: MOBILE_VIEWPORT.height,
    ...overrides
  };
}

function guardEvidence(overrides = {}) {
  return {
    attemptedApplicationWrites: 0,
    blockedApplicationWrites: 0,
    serviceWorkerAttempts: 1,
    blockedServiceWorkerRequests: 1,
    dialogAttempts: 0,
    controlActivationAttempts: 0,
    formSubmissionAttempts: 0,
    downloadAttempts: 0,
    popupAttempts: 0,
    bidirectionalChannelAttempts: 0,
    serviceWorkerRegistrationsAfter: 0,
    guardInstalledBeforeNavigation: true,
    networkBypassServiceWorkerEnabled: true,
    downloadDenyEnabled: true,
    guardAsyncErrors: [],
    ...overrides
  };
}

function pageEvidence(overrides = {}) {
  return {
    authenticated: true,
    rendered: true,
    routeIntelligenceVisible: true,
    directionsAvailable: true,
    logResultAvailable: true,
    routeQueueCount: 15,
    windowInnerWidth: MOBILE_VIEWPORT.width,
    windowInnerHeight: MOBILE_VIEWPORT.height,
    documentClientWidth: MOBILE_VIEWPORT.width,
    documentClientHeight: MOBILE_VIEWPORT.height,
    documentScrollWidth: MOBILE_VIEWPORT.width,
    bodyScrollWidth: MOBILE_VIEWPORT.width,
    serviceWorkerController: false,
    consoleErrors: 0,
    consoleWarnings: 0,
    runtimeExceptions: 0,
    browserLogErrors: 0,
    networkFailures: 0,
    ...overrides
  };
}

function savedBrowserEvidence(overrides = {}) {
  return {
    verifier: "production-read-only-mobile-verification-v1",
    mode: "browser-only",
    browserEvidence: {
      viewport: viewport(),
      guardConfiguration: {
        ...REQUIRED_GUARD_CONFIGURATION,
        allowedProductionMethods: [...REQUIRED_GUARD_CONFIGURATION.allowedProductionMethods]
      },
      guardEvidence: guardEvidence(),
      pageEvidence: pageEvidence(),
      newBrowserContextCreated: true,
      preflightViewportMetadataInstalled: true,
      productionNavigationAttempted: true,
      browserContextDisposed: true,
      verificationOrder: [
        "target_discovery_enabled",
        "new_browser_context_created",
        "about_blank_target_created",
        "preflight_viewport_metadata_installed",
        "viewport_applied",
        "viewport_confirmed",
        "default_deny_guard_installed",
        "production_navigation_attempted",
        "browser_context_disposed"
      ],
      ...overrides
    }
  };
}

test("viewport mismatch fails before production navigation is allowed", () => {
  const result = evaluatePreNavigationViewport(viewport({ windowInnerWidth: 391 }));
  assert.equal(result.status, "FAIL");
  assert.equal(result.navigationAllowed, false);
  assert.match(result.failures.join("\n"), /windowInnerWidth must equal 390/);
});

test("production count drift is rejected across every required category", () => {
  assert.deepEqual(REQUIRED_COUNT_CATEGORIES, [
    "sessions",
    "visits",
    "actions",
    "outcomes",
    "prospectiveRecords",
    "conflicts",
    "exclusions",
    "evaluations"
  ]);
  const result = evaluateProductionCounts(counts(), counts({ prospectiveRecords: 1 }));
  assert.equal(result.status, "FAIL");
  assert.equal(result.deepEqual, false);
  assert.match(result.failures.join("\n"), /Production counts changed/);
});

test("attempted application writes and dialogs fail read-only evidence", () => {
  const result = evaluateGuardEvidence(guardEvidence({
    attemptedApplicationWrites: 1,
    blockedApplicationWrites: 1,
    dialogAttempts: 1
  }));
  assert.equal(result.status, "FAIL");
  assert.match(result.failures.join("\n"), /attemptedApplicationWrites must be zero/);
  assert.match(result.failures.join("\n"), /dialogAttempts must be zero/);
});

test("an exact guarded mobile verification passes", () => {
  const baseline = counts();
  const result = evaluateReadOnlyMobileVerification({
    viewport: viewport(),
    guardConfiguration: {
      ...REQUIRED_GUARD_CONFIGURATION,
      allowedProductionMethods: [...REQUIRED_GUARD_CONFIGURATION.allowedProductionMethods]
    },
    baselineCounts: baseline,
    afterCounts: { ...baseline },
    guardEvidence: guardEvidence(),
    pageEvidence: pageEvidence(),
    newBrowserContextCreated: true,
    preflightViewportMetadataInstalled: true,
    productionNavigationAttempted: true,
    browserContextDisposed: true,
    verificationOrder: [
      "target_discovery_enabled",
      "preflight_viewport_metadata_installed",
      "viewport_confirmed",
      "production_navigation_attempted"
    ]
  });
  assert.equal(result.status, "PASS");
  assert.deepEqual(result.failures, []);
  assert.equal(result.viewport.navigationAllowed, true);
  assert.equal(result.counts.deepEqual, true);
});

test("canonical viewport metadata must precede viewport confirmation and production navigation", () => {
  assert.equal(CANONICAL_MOBILE_VIEWPORT_META, "width=device-width, initial-scale=1, viewport-fit=cover");
  const snapshot = counts();
  const missing = evaluateSavedBrowserEvidence(
    savedBrowserEvidence({ preflightViewportMetadataInstalled: false }),
    snapshot,
    { ...snapshot }
  );
  assert.equal(missing.status, "FAIL");
  assert.match(missing.failures.join("\n"), /metadata was not installed/);

  const late = evaluateSavedBrowserEvidence(
    savedBrowserEvidence({
      verificationOrder: [
        "target_discovery_enabled",
        "viewport_confirmed",
        "preflight_viewport_metadata_installed",
        "production_navigation_attempted"
      ]
    }),
    snapshot,
    { ...snapshot }
  );
  assert.equal(late.status, "FAIL");
  assert.match(late.failures.join("\n"), /must be installed before viewport confirmation/);
});

test("two-phase evidence evaluation rejects independently supplied post-run drift", () => {
  const baseline = counts();
  const result = evaluateSavedBrowserEvidence(
    savedBrowserEvidence(),
    baseline,
    counts({ actions: 1 })
  );
  assert.equal(result.status, "FAIL");
  assert.equal(result.counts.deepEqual, false);
  assert.match(result.failures.join("\n"), /Production counts changed/);
});

test("two-phase evidence evaluation accepts independently supplied matching snapshots", () => {
  const baseline = counts();
  const after = JSON.parse(JSON.stringify(baseline));
  const result = evaluateSavedBrowserEvidence(savedBrowserEvidence(), baseline, after);
  assert.equal(result.status, "PASS");
  assert.equal(result.counts.deepEqual, true);
  assert.notEqual(baseline, after);
});

test("evaluate-evidence mode requires no browser or CDP endpoint", () => {
  const snapshot = counts();
  const report = runProductionReadOnlyMobileEvidenceEvaluation({
    browserEvidence: JSON.stringify(savedBrowserEvidence()),
    baselineCounts: JSON.stringify(snapshot),
    afterCounts: JSON.stringify({ ...snapshot })
  });
  assert.equal(report.status, "PASS");
  assert.equal(report.mode, "evaluate-evidence");
  assert.equal(report.browserOpened, false);
});

test("the verifier requires the complete default-deny guard configuration", () => {
  const required = {
    ...REQUIRED_GUARD_CONFIGURATION,
    allowedProductionMethods: [...REQUIRED_GUARD_CONFIGURATION.allowedProductionMethods]
  };
  assert.equal(evaluateGuardConfiguration(required).status, "PASS");

  for (const field of [
    "newBrowserContext",
    "targetDiscoveryBeforeNavigation",
    "canonicalPreflightViewportBeforeConfirmation",
    "viewportAppliedBeforeProductionNavigation",
    "viewportConfirmedBeforeProductionNavigation",
    "defaultDenyProductionWrites",
    "bypassServiceWorkers",
    "blockServiceWorkerRegistration",
    "blockServiceWorkerFetch",
    "blockFormSubmissions",
    "denyDownloads",
    "blockPopups",
    "blockDialogs",
    "blockProductionClicks",
    "doNotReadCredentialsOrCookies"
  ]) {
    const result = evaluateGuardConfiguration({ ...required, [field]: false });
    assert.equal(result.status, "FAIL", field);
  }

  assert.equal(evaluateGuardConfiguration({ ...required, allowedProductionMethods: ["GET", "POST"] }).status, "FAIL");
});
