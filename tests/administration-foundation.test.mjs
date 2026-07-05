import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('administration foundation validation gate passes', () => {
  const result = spawnSync(process.execPath, ['scripts/validate-administration-foundation.mjs'], {
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Administration foundation validation passed/);
});

test('beta tester registry keeps Anthony in rep-only beta permissions', () => {
  const registry = JSON.parse(readFileSync('administration/registers/beta-testers.json', 'utf8'));
  const anthony = registry.testers.find((tester) => tester.testerId === 'tester-anthony-001');

  assert.ok(anthony);
  assert.equal(anthony.status, 'active');
  assert.equal(anthony.permissions.roleId, 'rep_beta_tester');
  assert.equal(anthony.permissions.mustOpenInRepMode, true);
  assert.equal(anthony.permissions.ownerAdminControlsAllowed, false);
});

test('administration release history records this foundation without product deployment', () => {
  const history = JSON.parse(readFileSync('administration/registers/release-history.json', 'utf8'));
  const release = history.releases.find((item) => item.releaseId === 'release-administration-foundation-v1');

  assert.ok(release);
  assert.equal(release.type, 'administration_operations');
  assert.equal(release.deployment, 'not_applicable');
  assert.equal(release.appBuildMarker, 'not_applicable');
});

test('private beta intake classification covers all subsystem categories and severities', () => {
  const classification = JSON.parse(readFileSync('administration/registers/intake-classification.json', 'utf8'));

  assert.deepEqual(classification.issueCategories, [
    'Dashboard',
    'Data',
    'Intelligence Engine',
    'Infrastructure',
    'CRM',
    'Companion',
    'Mobile',
    'Website',
    'Social Media',
    'Research',
    'Sales',
    'Administration'
  ]);
  assert.deepEqual(classification.severityLevels, ['Critical', 'High', 'Medium', 'Low', 'Feature Request']);
});

test('stabilization issues preserve required issue contract fields', () => {
  const issues = JSON.parse(readFileSync('administration/registers/stabilization-issues.json', 'utf8')).issues;
  const requiredFields = [
    'issueId',
    'date',
    'testerId',
    'deviceId',
    'version',
    'description',
    'expectedBehavior',
    'actualBehavior',
    'subsystemOwner',
    'status',
    'regressionVerified',
    'resolvedVersion',
    'testerVerification'
  ];

  assert.ok(issues.length >= 5);
  for (const issue of issues) {
    for (const field of requiredFields) {
      assert.ok(field in issue, `${issue.issueId} missing ${field}`);
    }
  }
});

test('Beta Stabilization Sprint 1 findings are routed to owning engineering subsystems', () => {
  const issues = JSON.parse(readFileSync('administration/registers/stabilization-issues.json', 'utf8')).issues;
  const performance = issues.find((issue) => issue.issueId === 'issue-dashboard-startup-places-performance-2026-06-30');
  const routeQuality = issues.find((issue) => issue.issueId === 'issue-data-residential-barber-route-quality-2026-06-30');

  assert.equal(performance.category, 'Dashboard');
  assert.equal(performance.subsystemOwner, 'Prometheus Dashboard');
  assert.equal(performance.severity, 'High');
  assert.equal(routeQuality.category, 'Data');
  assert.equal(routeQuality.subsystemOwner, 'Prometheus Data');
  assert.equal(routeQuality.severity, 'Critical');
});

test('Anthony Saturday verification readiness packet exists but does not sign off', () => {
  const readiness = JSON.parse(
    readFileSync(
      'administration/verification/beta-stabilization-sprint-1/beta-stabilization-sprint-1-readiness.json',
      'utf8'
    )
  );

  assert.equal(readiness.packetId, 'packet-beta-stabilization-sprint-1-readiness-2026-07-04');
  assert.equal(readiness.status, 'prepared_not_signed_off');
  assert.equal(readiness.signOffAllowedBeforeFieldTest, false);
  assert.equal(readiness.testerSignOffStatus, 'pending');
  assert.ok(readiness.verificationAreas.includes('active_pool_corrections'));
});

test('Sprint 1 issue verification matrix keeps every verification pending', () => {
  const matrix = JSON.parse(
    readFileSync('administration/verification/beta-stabilization-sprint-1/issue-verification-matrix.json', 'utf8')
  );

  assert.equal(matrix.signOffStatus, 'pending');
  assert.equal(matrix.issues.length, 6);
  for (const issue of matrix.issues) {
    assert.equal(issue.passFail, 'pending', `${issue.issueId} should not be signed off before field test`);
    assert.ok(issue.originalIssue);
    assert.ok(issue.owningSubsystem);
    assert.ok(issue.commits.length >= 1);
    assert.ok(issue.expectedBehavior);
    assert.ok(issue.testerVerification);
  }
});

test('Sprint 2 command center links Sprint 1 packet and tracks required issues', () => {
  const tracker = JSON.parse(readFileSync('administration/command-center/beta-sprint-2/issue-tracker.json', 'utf8'));

  assert.equal(tracker.commandCenterId, 'command-center-beta-sprint-2');
  assert.equal(tracker.status, 'open');
  assert.equal(tracker.linkedSprint1PacketId, 'packet-beta-stabilization-sprint-1-readiness-2026-07-04');
  assert.equal(tracker.issues.length, 5);
  assert.deepEqual(
    tracker.issues.map((issue) => issue.issueId),
    [
      'issue-sprint2-slow-dashboard-loading-2026-07-02',
      'issue-sprint2-hamzas-barbershop-repeat-2026-07-02',
      'issue-sprint2-rep-radius-ring-visibility-2026-07-02',
      'issue-sprint2-route-size-greater-than-six-2026-07-02',
      'issue-sprint2-nearby-button-does-nothing-2026-07-02'
    ]
  );
});

test('Sprint 2 command center issue fields stay evidence-pending', () => {
  const tracker = JSON.parse(readFileSync('administration/command-center/beta-sprint-2/issue-tracker.json', 'utf8'));
  const requiredFields = ['issue', 'ownerSubsystem', 'severity', 'status', 'evidence', 'passFailResult', 'nextAction'];

  for (const issue of tracker.issues) {
    for (const field of requiredFields) {
      assert.ok(field in issue, `${issue.issueId} missing ${field}`);
    }
    assert.equal(issue.passFailResult, 'pending');
    assert.equal(issue.status, 'new');
  }
});

test('Sprint 2 command center issues are mirrored into unified stabilization intake', () => {
  const tracker = JSON.parse(readFileSync('administration/command-center/beta-sprint-2/issue-tracker.json', 'utf8'));
  const intake = JSON.parse(readFileSync('administration/registers/stabilization-issues.json', 'utf8')).issues;

  for (const commandIssue of tracker.issues) {
    const intakeIssue = intake.find((issue) => issue.issueId === commandIssue.issueId);
    assert.ok(intakeIssue, `${commandIssue.issueId} missing from stabilization intake`);
    assert.equal(intakeIssue.fieldFeedback.passFailResult, 'pending');
    assert.equal(intakeIssue.fieldFeedback.nextAction, commandIssue.nextAction);
  }
});

test('Smoothie Depot founder operating manual preserves workspace isolation', () => {
  const isolation = JSON.parse(
    readFileSync('administration/workspaces/smoothie-depot/workspace-isolation-verification.json', 'utf8')
  );

  assert.equal(isolation.workspaceId, 'smoothie_depot');
  assert.equal(isolation.operatingProfileId, 'franchise_development');
  assert.equal(isolation.newSubsystemCreated, false);
  assert.equal(isolation.workspaceIsolation.smoothieDepotOnly, true);
  assert.equal(isolation.workspaceIsolation.fitnessConnectionDataUsed, false);
  assert.equal(isolation.workspaceIsolation.routeSystemsUsed, false);
  assert.equal(isolation.workspaceIsolation.activePoolUsed, false);
  assert.equal(isolation.workspaceIsolation.unitTrackingUsed, false);
  assert.equal(isolation.workspaceIsolation.membershipTrackingUsed, false);
});

test('Smoothie Depot founder operating manual covers full daily workflow', () => {
  const manual = readFileSync('administration/workspaces/smoothie-depot/founder-operating-manual-v1.md', 'utf8');

  for (const section of [
    'Morning Startup',
    'Research Workflow',
    'Outreach Workflow',
    'Qualification Workflow',
    'JR Handoff Workflow',
    'Follow-Up Workflow',
    'End Of Day',
    'Daily Decision Rule'
  ]) {
    assert.match(manual, new RegExp(section));
  }
});

test('Smoothie Depot daily operating checklists cover required operating modes', () => {
  const checklists = readFileSync('administration/workspaces/smoothie-depot/daily-operating-checklists-v1.md', 'utf8');

  for (const checklist of [
    'Morning Checklist',
    'Research Checklist',
    'Call Checklist',
    'Discovery Checklist',
    'Qualification Checklist',
    'JR Handoff Checklist',
    'Follow-Up Checklist',
    'End-Of-Day Checklist'
  ]) {
    assert.match(checklists, new RegExp(checklist));
  }
});

test('Administration operating artifacts are registered in the canonical contract layer', () => {
  const contract = JSON.parse(
    readFileSync('overwatch/artifact-contracts/administration/administration-operating-artifact-contract-v1.json', 'utf8')
  );

  assert.equal(contract.owningSubsystem, 'Prometheus Administration');
  assert.equal(contract.workspaceRegistrations.smoothie_depot.status, 'registered');
  assert.equal(contract.artifactContracts.founderOperatingManuals.canonicalPaths.smoothieDepotFounderOperatingManual, 'administration/workspaces/smoothie-depot/founder-operating-manual-v1.md');
  assert.equal(contract.artifactContracts.releaseSignOffRegisters.canonicalPaths.releaseHistory, 'administration/registers/release-history.json');
  assert.equal(contract.artifactContracts.fieldFeedbackArtifacts.canonicalPaths.stabilizationIssues, 'administration/registers/stabilization-issues.json');
  assert.equal(contract.consumerRules.dashboard.mayDisplayOperatingManualsReadOnly, true);
  assert.equal(contract.consumerRules.crm.mayConsumeFieldFeedbackOnlyThroughContract, true);
  assert.equal(contract.consumerRules.intelligence.mayConsumeDecisionJournalAarOnlyThroughContract, true);
  assert.equal(contract.workspaceIsolationRules.noWorkspaceMayConsumeAnotherWorkspaceOperatingRecords, true);
});
