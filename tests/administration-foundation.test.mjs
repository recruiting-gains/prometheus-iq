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
