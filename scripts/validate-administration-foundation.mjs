import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const requiredMarkdown = [
  'administration/README.md',
  'administration/architecture.md',
  'administration/operating-model.md',
  'administration/workflows/beta-tester-lifecycle.md',
  'administration/workflows/bug-intake-workflow.md',
  'administration/workflows/feature-request-workflow.md',
  'administration/workflows/release-notes-version-history.md',
  'administration/workflows/pilot-company-management.md',
  'administration/workflows/founder-admin-dashboard-requirements.md',
  'administration/templates/beta-tester-onboarding-checklist.md',
  'administration/templates/bug-report.md',
  'administration/templates/feature-request.md',
  'administration/templates/release-note.md',
  'administration/templates/internal-procedure.md',
  'administration/schemas/register-contracts.md'
];

const requiredJson = [
  'administration/registers/beta-testers.json',
  'administration/registers/device-inventory.json',
  'administration/registers/permissions-matrix.json',
  'administration/registers/pilot-companies.json',
  'administration/registers/bug-intake.json',
  'administration/registers/feature-requests.json',
  'administration/registers/release-history.json',
  'administration/registers/documentation-index.json'
];

const failures = [];

function readRequired(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing required file: ${relativePath}`);
    return null;
  }
  return readFileSync(absolutePath, 'utf8');
}

function readJson(relativePath) {
  const contents = readRequired(relativePath);
  if (contents === null) return null;
  try {
    const parsed = JSON.parse(contents);
    if (!parsed.schemaVersion) failures.push(`${relativePath} is missing schemaVersion`);
    if (!parsed.description) failures.push(`${relativePath} is missing description`);
    return parsed;
  } catch (error) {
    failures.push(`${relativePath} is not valid JSON: ${error.message}`);
    return null;
  }
}

for (const filePath of requiredMarkdown) {
  const contents = readRequired(filePath);
  if (contents !== null && contents.trim().length < 40) {
    failures.push(`${filePath} is too small to be useful`);
  }
}

const jsonByPath = new Map(requiredJson.map((filePath) => [filePath, readJson(filePath)]));

const betaTesters = jsonByPath.get('administration/registers/beta-testers.json');
if (betaTesters) {
  if (!Array.isArray(betaTesters.testers) || betaTesters.testers.length === 0) {
    failures.push('beta-testers.json must include at least one tester');
  }
  const anthony = betaTesters.testers?.find((tester) => tester.testerId === 'tester-anthony-001');
  if (!anthony) {
    failures.push('beta-testers.json must track Anthony as the first production field tester');
  } else {
    for (const key of ['status', 'agreement', 'onboarding', 'permissions', 'devices']) {
      if (!anthony[key]) failures.push(`Anthony tester record is missing ${key}`);
    }
    if (anthony.permissions?.ownerAdminControlsAllowed !== false) {
      failures.push('Anthony tester record must not allow owner/admin controls');
    }
  }
}

const devices = jsonByPath.get('administration/registers/device-inventory.json');
if (devices && !Array.isArray(devices.devices)) {
  failures.push('device-inventory.json must include devices array');
}

const permissions = jsonByPath.get('administration/registers/permissions-matrix.json');
if (permissions) {
  const repRole = permissions.roles?.find((role) => role.roleId === 'rep_beta_tester');
  if (!repRole) {
    failures.push('permissions-matrix.json must include rep_beta_tester role');
  } else if (repRole.canUseOwnerControls !== false || repRole.canModifyInfrastructure !== false) {
    failures.push('rep_beta_tester role must not allow owner controls or infrastructure changes');
  }
}

const releases = jsonByPath.get('administration/registers/release-history.json');
if (releases && !releases.releases?.some((release) => release.releaseId === 'release-administration-foundation-v1')) {
  failures.push('release-history.json must include release-administration-foundation-v1');
}

const documentation = jsonByPath.get('administration/registers/documentation-index.json');
if (documentation) {
  for (const document of documentation.documents ?? []) {
    if (!document.path || !existsSync(path.join(repoRoot, document.path))) {
      failures.push(`Documentation index points to missing file: ${document.path ?? '(missing path)'}`);
    }
  }
}

const readme = readRequired('administration/README.md') ?? '';
for (const phrase of ['Dashboard', 'Companion', 'CRM', 'Infrastructure', 'Integrations']) {
  if (!readme.includes(phrase)) {
    failures.push(`Administration README must document boundary with ${phrase}`);
  }
}

if (failures.length > 0) {
  console.error('Administration foundation validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Administration foundation validation passed.');
