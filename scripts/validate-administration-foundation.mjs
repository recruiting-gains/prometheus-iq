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
  'administration/workflows/private-beta-stabilization-intake.md',
  'administration/workflows/subsystem-routing.md',
  'administration/workflows/release-regression-tester-signoff.md',
  'administration/templates/beta-tester-onboarding-checklist.md',
  'administration/templates/bug-report.md',
  'administration/templates/feature-request.md',
  'administration/templates/release-note.md',
  'administration/templates/internal-procedure.md',
  'administration/templates/stabilization-issue.md',
  'administration/templates/test-session.md',
  'administration/templates/observation.md',
  'administration/schemas/register-contracts.md',
  'administration/verification/beta-stabilization-sprint-1/README.md',
  'administration/verification/beta-stabilization-sprint-1/anthony-verification-checklist.md',
  'administration/verification/beta-stabilization-sprint-1/device-verification-checklist.md',
  'administration/verification/beta-stabilization-sprint-1/session-verification-checklist.md',
  'administration/verification/beta-stabilization-sprint-1/beta-acceptance-criteria.md',
  'administration/verification/beta-stabilization-sprint-1/issue-verification-matrix.md',
  'administration/verification/beta-stabilization-sprint-1/saturday-field-test-guide.md',
  'administration/verification/beta-stabilization-sprint-1/sign-off-packet.md',
  'administration/command-center/beta-sprint-2/README.md',
  'administration/command-center/beta-sprint-2/issue-tracker.md',
  'administration/command-center/beta-sprint-2/evidence-log.md',
  'administration/command-center/beta-sprint-2/follow-up-decisions.md',
  'administration/workspaces/smoothie-depot/README.md',
  'administration/workspaces/smoothie-depot/founder-operating-manual-v1.md',
  'administration/workspaces/smoothie-depot/daily-operating-checklists-v1.md'
];

const requiredJson = [
  'administration/registers/beta-testers.json',
  'administration/registers/device-inventory.json',
  'administration/registers/permissions-matrix.json',
  'administration/registers/pilot-companies.json',
  'administration/registers/bug-intake.json',
  'administration/registers/feature-requests.json',
  'administration/registers/release-history.json',
  'administration/registers/documentation-index.json',
  'administration/registers/intake-classification.json',
  'administration/registers/test-session-history.json',
  'administration/registers/stabilization-issues.json',
  'administration/registers/beta-observations.json',
  'administration/registers/regression-verification.json',
  'administration/verification/beta-stabilization-sprint-1/issue-verification-matrix.json',
  'administration/verification/beta-stabilization-sprint-1/beta-stabilization-sprint-1-readiness.json',
  'administration/command-center/beta-sprint-2/issue-tracker.json',
  'administration/workspaces/smoothie-depot/workspace-isolation-verification.json'
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
    if (!anthony.profile?.companyId) {
      failures.push('Anthony tester record must include beta tester profile company context');
    }
    if (anthony.permissions?.ownerAdminControlsAllowed !== false) {
      failures.push('Anthony tester record must not allow owner/admin controls');
    }
  }
}

const devices = jsonByPath.get('administration/registers/device-inventory.json');
if (devices && !Array.isArray(devices.devices)) {
  failures.push('device-inventory.json must include devices array');
} else if (devices) {
  const anthonyDevice = devices.devices.find((device) => device.deviceId === 'device-anthony-primary-phone');
  if (!anthonyDevice?.profile?.deviceType) {
    failures.push('Anthony device record must include a device profile');
  }
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
if (releases && !releases.releases?.some((release) => release.releaseId === 'release-private-beta-stabilization-intake-v1')) {
  failures.push('release-history.json must include release-private-beta-stabilization-intake-v1');
}

const documentation = jsonByPath.get('administration/registers/documentation-index.json');
if (documentation) {
  for (const document of documentation.documents ?? []) {
    if (!document.path || !existsSync(path.join(repoRoot, document.path))) {
      failures.push(`Documentation index points to missing file: ${document.path ?? '(missing path)'}`);
    }
  }
}

const expectedCategories = [
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
];
const expectedSeverities = ['Critical', 'High', 'Medium', 'Low', 'Feature Request'];
const expectedObservationTypes = [
  'positive_feedback',
  'workflow_observation',
  'route_quality_observation',
  'performance_observation'
];

const classification = jsonByPath.get('administration/registers/intake-classification.json');
if (classification) {
  for (const category of expectedCategories) {
    if (!classification.issueCategories?.includes(category)) {
      failures.push(`intake-classification.json is missing category: ${category}`);
    }
  }
  for (const severity of expectedSeverities) {
    if (!classification.severityLevels?.includes(severity)) {
      failures.push(`intake-classification.json is missing severity: ${severity}`);
    }
  }
  for (const type of expectedObservationTypes) {
    if (!classification.observationTypes?.includes(type)) {
      failures.push(`intake-classification.json is missing observation type: ${type}`);
    }
  }
}

const stabilizationIssues = jsonByPath.get('administration/registers/stabilization-issues.json');
if (stabilizationIssues) {
  if (!Array.isArray(stabilizationIssues.issues)) {
    failures.push('stabilization-issues.json must include issues array');
  }
  const requiredIssueFields = [
    'issueId',
    'date',
    'testerId',
    'deviceId',
    'version',
    'category',
    'severity',
    'description',
    'expectedBehavior',
    'actualBehavior',
    'subsystemOwner',
    'status',
    'regressionVerified',
    'resolvedVersion',
    'testerVerification'
  ];
  for (const issue of stabilizationIssues.issues ?? []) {
    for (const field of requiredIssueFields) {
      if (!(field in issue)) failures.push(`${issue.issueId ?? 'Unknown issue'} is missing ${field}`);
    }
    if (issue.issueId && !issue.issueId.startsWith('issue-')) {
      failures.push(`${issue.issueId} must use issue- prefix`);
    }
    if (!expectedCategories.includes(issue.category)) {
      failures.push(`${issue.issueId} has invalid category: ${issue.category}`);
    }
    if (!expectedSeverities.includes(issue.severity)) {
      failures.push(`${issue.issueId} has invalid severity: ${issue.severity}`);
    }
    if (!issue.regressionVerified?.status) {
      failures.push(`${issue.issueId} must include regressionVerified.status`);
    }
    if (!issue.testerVerification?.status) {
      failures.push(`${issue.issueId} must include testerVerification.status`);
    }
    if (issue.issueId?.startsWith('issue-sprint2-')) {
      for (const field of ['evidence', 'passFailResult', 'nextAction']) {
        if (!(field in (issue.fieldFeedback ?? {}))) failures.push(`${issue.issueId} fieldFeedback is missing ${field}`);
      }
      if (issue.fieldFeedback?.passFailResult !== 'pending') {
        failures.push(`${issue.issueId} pass/fail result must remain pending until evidence is recorded`);
      }
    }
  }
  const requiredSprintIssues = [
    'issue-dashboard-startup-places-performance-2026-06-30',
    'issue-data-residential-barber-route-quality-2026-06-30',
    'issue-dashboard-active-pool-corrections-2026-07-01',
    'issue-sprint2-slow-dashboard-loading-2026-07-02',
    'issue-sprint2-hamzas-barbershop-repeat-2026-07-02',
    'issue-sprint2-rep-radius-ring-visibility-2026-07-02',
    'issue-sprint2-route-size-greater-than-six-2026-07-02',
    'issue-sprint2-nearby-button-does-nothing-2026-07-02'
  ];
  for (const issueId of requiredSprintIssues) {
    if (!stabilizationIssues.issues?.some((issue) => issue.issueId === issueId)) {
      failures.push(`stabilization-issues.json must preserve Beta Stabilization Sprint 1 finding: ${issueId}`);
    }
  }
}

const observations = jsonByPath.get('administration/registers/beta-observations.json');
if (observations) {
  if (!Array.isArray(observations.observations)) {
    failures.push('beta-observations.json must include observations array');
  }
  for (const observation of observations.observations ?? []) {
    if (!observation.observationId?.startsWith('observation-')) {
      failures.push(`${observation.observationId ?? 'Unknown observation'} must use observation- prefix`);
    }
    if (!expectedObservationTypes.includes(observation.observationType)) {
      failures.push(`${observation.observationId} has invalid observationType: ${observation.observationType}`);
    }
  }
}

const sessions = jsonByPath.get('administration/registers/test-session-history.json');
if (sessions) {
  if (!Array.isArray(sessions.sessions)) {
    failures.push('test-session-history.json must include sessions array');
  }
  if (!sessions.sessions?.some((session) => session.sessionId === 'session-anthony-beta-stabilization-sprint-1')) {
    failures.push('test-session-history.json must include Anthony Beta Stabilization Sprint 1 session');
  }
  const saturdaySession = sessions.sessions?.find((session) => session.sessionId === 'session-anthony-saturday-field-test-2026-07-04');
  if (!saturdaySession) {
    failures.push('test-session-history.json must include Anthony Saturday field-test session');
  } else if (saturdaySession.status !== 'prepared_not_completed') {
    failures.push('Anthony Saturday field-test session must remain prepared_not_completed before field verification');
  }
  const sprint2Session = sessions.sessions?.find((session) => session.sessionId === 'session-anthony-beta-sprint-2-field-feedback');
  if (!sprint2Session) {
    failures.push('test-session-history.json must include Anthony Beta Sprint 2 field feedback session');
  } else if (sprint2Session.status !== 'open_pending_evidence') {
    failures.push('Anthony Beta Sprint 2 field feedback session must remain open_pending_evidence');
  }
}

const regression = jsonByPath.get('administration/registers/regression-verification.json');
if (regression) {
  if (!Array.isArray(regression.verifications)) {
    failures.push('regression-verification.json must include verifications array');
  }
  if (!regression.verifications?.some((verification) => verification.verificationId === 'verification-beta-stabilization-sprint-1')) {
    failures.push('regression-verification.json must include Beta Stabilization Sprint 1 verification record');
  }
  const saturdayVerification = regression.verifications?.find((verification) => verification.verificationId === 'verification-anthony-saturday-field-test-2026-07-04');
  if (!saturdayVerification) {
    failures.push('regression-verification.json must include Anthony Saturday field-test verification record');
  } else {
    if (saturdayVerification.regressionStatus !== 'prepared_pending_field_test') {
      failures.push('Anthony Saturday verification must remain prepared_pending_field_test before field verification');
    }
    if (saturdayVerification.testerSignOffStatus !== 'pending') {
      failures.push('Anthony Saturday tester sign-off must remain pending before field verification');
    }
  }
}

const readiness = jsonByPath.get('administration/verification/beta-stabilization-sprint-1/beta-stabilization-sprint-1-readiness.json');
if (readiness) {
  if (readiness.status !== 'prepared_not_signed_off') {
    failures.push('Saturday readiness packet must remain prepared_not_signed_off');
  }
  if (readiness.signOffAllowedBeforeFieldTest !== false) {
    failures.push('Saturday readiness packet must not allow sign-off before field test');
  }
  const requiredAreas = [
    'startup',
    'login',
    'rep_mode',
    'build_route',
    'nearby_opportunities',
    'places',
    'unit_logging',
    'route_quality',
    'performance',
    'end_of_day_summary',
    'active_pool_corrections'
  ];
  for (const area of requiredAreas) {
    if (!readiness.verificationAreas?.includes(area)) {
      failures.push(`Saturday readiness packet is missing verification area: ${area}`);
    }
  }
  for (const filePath of readiness.packetFiles ?? []) {
    if (!existsSync(path.join(repoRoot, filePath))) {
      failures.push(`Saturday readiness packet references missing file: ${filePath}`);
    }
  }
}

const issueMatrix = jsonByPath.get('administration/verification/beta-stabilization-sprint-1/issue-verification-matrix.json');
if (issueMatrix) {
  if (issueMatrix.signOffStatus !== 'pending') {
    failures.push('Issue verification matrix signOffStatus must remain pending before field verification');
  }
  const requiredMatrixIssues = [
    'issue-dashboard-rep-session-enforcement-2026-06-30',
    'issue-dashboard-mobile-pin-drop-scroll-2026-06-30',
    'issue-dashboard-nearby-runtime-2026-06-30',
    'issue-dashboard-startup-places-performance-2026-06-30',
    'issue-data-residential-barber-route-quality-2026-06-30',
    'issue-dashboard-active-pool-corrections-2026-07-01'
  ];
  for (const issueId of requiredMatrixIssues) {
    const issue = issueMatrix.issues?.find((item) => item.issueId === issueId);
    if (!issue) {
      failures.push(`Issue verification matrix is missing ${issueId}`);
      continue;
    }
    for (const field of ['originalIssue', 'owningSubsystem', 'commits', 'expectedBehavior', 'testerVerification', 'passFail', 'notes']) {
      if (!(field in issue)) failures.push(`Issue verification matrix ${issueId} is missing ${field}`);
    }
    if (issue.passFail !== 'pending') {
      failures.push(`Issue verification matrix ${issueId} must remain pending before field verification`);
    }
  }
}

const sprint2Tracker = jsonByPath.get('administration/command-center/beta-sprint-2/issue-tracker.json');
if (sprint2Tracker) {
  if (sprint2Tracker.commandCenterId !== 'command-center-beta-sprint-2') {
    failures.push('Sprint 2 command center must use command-center-beta-sprint-2 ID');
  }
  if (sprint2Tracker.linkedSprint1PacketId !== 'packet-beta-stabilization-sprint-1-readiness-2026-07-04') {
    failures.push('Sprint 2 command center must link to Sprint 1 sign-off packet');
  }
  if (sprint2Tracker.status !== 'open') {
    failures.push('Sprint 2 command center must remain open until evidence is resolved');
  }
  const requiredSprint2Issues = [
    'issue-sprint2-slow-dashboard-loading-2026-07-02',
    'issue-sprint2-hamzas-barbershop-repeat-2026-07-02',
    'issue-sprint2-rep-radius-ring-visibility-2026-07-02',
    'issue-sprint2-route-size-greater-than-six-2026-07-02',
    'issue-sprint2-nearby-button-does-nothing-2026-07-02'
  ];
  if ((sprint2Tracker.issues ?? []).length !== requiredSprint2Issues.length) {
    failures.push(`Sprint 2 command center must track exactly ${requiredSprint2Issues.length} issues`);
  }
  for (const issueId of requiredSprint2Issues) {
    const issue = sprint2Tracker.issues?.find((item) => item.issueId === issueId);
    if (!issue) {
      failures.push(`Sprint 2 command center is missing ${issueId}`);
      continue;
    }
    for (const field of ['issue', 'ownerSubsystem', 'severity', 'status', 'evidence', 'passFailResult', 'nextAction']) {
      if (!(field in issue)) failures.push(`Sprint 2 command center ${issueId} is missing ${field}`);
    }
    if (issue.passFailResult !== 'pending') {
      failures.push(`Sprint 2 command center ${issueId} pass/fail must remain pending until evidence is recorded`);
    }
  }
}

const smoothieManual = readRequired('administration/workspaces/smoothie-depot/founder-operating-manual-v1.md') ?? '';
const smoothieChecklists = readRequired('administration/workspaces/smoothie-depot/daily-operating-checklists-v1.md') ?? '';
const smoothieIsolation = jsonByPath.get('administration/workspaces/smoothie-depot/workspace-isolation-verification.json');
if (smoothieIsolation) {
  if (smoothieIsolation.workspaceId !== 'smoothie_depot') {
    failures.push('Smoothie Depot operating manual must use workspaceId smoothie_depot');
  }
  if (smoothieIsolation.operatingProfileId !== 'franchise_development') {
    failures.push('Smoothie Depot operating manual must use franchise_development operating profile');
  }
  if (smoothieIsolation.newSubsystemCreated !== false) {
    failures.push('Smoothie Depot operating manual must not create a new subsystem');
  }
  const isolation = smoothieIsolation.workspaceIsolation ?? {};
  for (const [flag, expected] of Object.entries({
    smoothieDepotOnly: true,
    fitnessConnectionDataUsed: false,
    routeSystemsUsed: false,
    activePoolUsed: false,
    unitTrackingUsed: false,
    membershipTrackingUsed: false,
    crossWorkspaceLearningUsed: false,
    crmRuntimeModified: false,
    dashboardRuntimeModified: false,
    intelligenceRuntimeModified: false,
    infrastructureModified: false
  })) {
    if (isolation[flag] !== expected) {
      failures.push(`Smoothie Depot isolation flag ${flag} must be ${expected}`);
    }
  }
  for (const filePath of smoothieIsolation.manualFiles ?? []) {
    if (!existsSync(path.join(repoRoot, filePath))) {
      failures.push(`Smoothie Depot manual references missing file: ${filePath}`);
    }
  }
}
for (const phrase of [
  'Morning Startup',
  'Research Workflow',
  'Outreach Workflow',
  'Qualification Workflow',
  'JR Handoff Workflow',
  'Follow-Up Workflow',
  'End Of Day',
  'Daily Decision Rule'
]) {
  if (!smoothieManual.includes(phrase)) {
    failures.push(`Smoothie Depot founder operating manual is missing section: ${phrase}`);
  }
}
for (const phrase of [
  'Morning Checklist',
  'Research Checklist',
  'Call Checklist',
  'Discovery Checklist',
  'Qualification Checklist',
  'JR Handoff Checklist',
  'Follow-Up Checklist',
  'End-Of-Day Checklist'
]) {
  if (!smoothieChecklists.includes(phrase)) {
    failures.push(`Smoothie Depot daily checklists are missing: ${phrase}`);
  }
}

const readme = readRequired('administration/README.md') ?? '';
for (const phrase of ['Dashboard', 'Companion', 'CRM', 'Infrastructure', 'Integrations']) {
  if (!readme.includes(phrase)) {
    failures.push(`Administration README must document boundary with ${phrase}`);
  }
}
for (const phrase of ['Private Beta Stabilization Intake', 'stabilization-issues.json', 'tester sign-off']) {
  if (!readme.includes(phrase)) {
    failures.push(`Administration README must document ${phrase}`);
  }
}

if (failures.length > 0) {
  console.error('Administration foundation validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Administration foundation validation passed.');
