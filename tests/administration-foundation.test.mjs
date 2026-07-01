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
