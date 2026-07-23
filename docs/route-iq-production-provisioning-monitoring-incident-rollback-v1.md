# Route IQ Production Provisioning, Monitoring, Incident, And Rollback v1

Document ID: `route-iq-production-provisioning-monitoring-incident-rollback-v1`
Owner: Prometheus Infrastructure
Status: production operations procedure; every production mutation remains Founder-authorized
Scope: bounded August 1 Route IQ activation

## Purpose

This runbook defines the Infrastructure-owned procedure for named-user access, launch-limit reconciliation, production monitoring, incident containment, and forward-compatible rollback. It does not grant access or authorize a production mutation by itself.

## Fixed Safety Boundary

- Customer companies: maximum `2`.
- Named customer users: maximum `40` across both companies.
- Prelaunch human acceptance: Cruz only.
- Anthony: unmapped with no access.
- PWA: one generic application.
- Prospective collection: `OFF`.
- Active prospective cohorts: `0`.
- Recommendation influence: `OFF`.
- Representative-facing shadow output: prohibited.
- Public and private Worker scopes: independently verified and independently mutable only with exact Founder authorization.

Any unknown state fails closed.

## Named-User Provisioning Procedure

### Required Inputs

Infrastructure accepts a provisioning handoff only when it contains:

- Founder authorization identifying the exact customer company and named user;
- customer decision-maker authorization for that user;
- stable customer workspace ID;
- operating profile ID;
- opaque internal user and representative IDs;
- immutable authenticated principal proven through the approved identity system;
- least-privileged role;
- territory and location scope;
- Administration activation status;
- canonical Data roster evidence;
- reconciled pre-add company and user counts;
- approved device and support path.

Display name, email alone, job title, customer request, or an existing browser session is not canonical identity.

### Admission Check

Before any access mutation:

1. Read current canonical company and named-user counts through approved read-only owner evidence.
2. Read current authenticated-principal mappings through the approved read-only Infrastructure path.
3. Count every approved-pending-access, onboarding, active, or paused retained identity.
4. Confirm the proposed company is one of no more than two exact approved customer companies.
5. Confirm the proposed user would keep the total at or below 40.
6. Confirm the principal appears once and maps to one company, one operating profile, and one role.
7. Confirm the workspace is active customer configuration, not synthetic, historical, or Founder research.
8. Confirm Anthony is absent.
9. Confirm collection `OFF`, cohorts `0`, and recommendation influence `OFF`.
10. Confirm the current public and private Worker identities match the exact authorized state.

Any count mismatch, duplicate, ambiguity, identity drift, safety-state drift, or Worker drift stops before mutation.

### Provision And Verify

Provisioning requires a separate exact Founder authorization. When authorized:

1. Add only the approved immutable principal to the approved access boundary.
2. Map only the approved workspace, operating profile, territory, and role.
3. Do not create a broad domain, Everyone, Bypass, display-name, or wildcard user authorization.
4. Verify authentication fails for an unapproved clean session.
5. Verify the approved principal reaches only its customer workspace.
6. Verify representative role has no Founder CRM, Founder intelligence, owner, or administrative capability.
7. Verify no cross-company or cross-user record is readable.
8. Verify the generic PWA opens the same approved runtime.
9. Reconcile counts again after the change.
10. Record only safe identifiers, result, time, and evidence reference.

Do not print or store tokens, cookies, JWTs, raw subjects, secret values, one-time codes, or unnecessary customer identity data.

## Removal And Pause

A pause stops new use only after Infrastructure verifies the exact access result. A removal is complete only when:

- Founder and customer authority are recorded;
- the exact principal is removed or disabled without affecting another user;
- a clean session is denied;
- retained production evidence remains intact;
- Administration closes the user's access status;
- post-removal counts reconcile.

Do not delete production records as part of identity removal. Do not reuse an old principal mapping for another person.

## Production Monitoring Checklist

Required sources:

- Cloudflare public and private Worker version and traffic state;
- Worker request, status, exception, and latency metrics;
- Cloudflare Access authentication and policy-denial events;
- approved application health GET/HEAD checks;
- Durable Object request, error, storage, and conflict metrics;
- canonical company, user, role, and workspace counts;
- collection, cohort, and recommendation-influence status;
- PWA build and service-worker identity;
- Administration production-support register.

If a required source is unavailable or cannot distinguish public from private scope, launch is `NO-GO`.

### Critical Thresholds

Any single occurrence is Critical:

- successful unauthorized, cross-company, cross-user, cross-role, Founder CRM, or Founder-intelligence access;
- collection not `OFF`, cohort count not `0`, or recommendation influence not `OFF`;
- any representative-facing shadow output;
- any prospective coordinator request, object creation, storage write, conflict, exclusion, or evaluation while collection is `OFF`;
- company count above two or named customer-user count above 40;
- Anthony mapped or authenticated;
- unexpected Worker version, target, route, binding, migration, namespace, or traffic change;
- lost, silently replaced, rewritten, or duplicate accepted record;
- credential or protected identity-material exposure;
- three consecutive governed health-check failures within five minutes;
- five or more Worker `5xx` responses within five minutes, regardless of total volume.

Critical response: stop new activation, preserve evidence, notify the Founder, and begin incident classification. No automatic deployment, retry, access change, data repair, or rollback is allowed.

### High Thresholds

- `5xx` responses are at least 5 percent over 15 minutes with at least 20 requests.
- p95 application response time exceeds 2.5 seconds for 15 minutes with at least 20 requests.
- three approved users report the same startup or core-workflow failure within 30 minutes.
- one valid mapped user receives three fresh-session authentication failures within 10 minutes.
- the PWA remains on an unexpected build after two close-and-reopen attempts.
- durable CRM persistence, receipt, export, or notification-order status is inconsistent without proven record loss.
- an expected monitor or log source is unavailable for more than 15 minutes during the launch coverage window.

High response: halt further activation, open a High support issue, investigate with read-only evidence, and provide the Founder a containment plan.

### Warning Thresholds

- p95 response time exceeds 1.5 seconds for 15 minutes with at least 20 requests.
- two users report the same nonblocking workflow or device issue in one day.
- Access denial rises above the user's documented fresh-session attempts without a successful recovery.
- one monitor or metric is delayed but another authoritative source still proves the safety state.

Warnings are recorded and reviewed. They do not authorize a production change.

### Launch Monitoring Cadence

- Immediately before activation.
- Immediately after each user activation group.
- At approximately 1 hour, 4 hours, and 24 hours.
- Daily through day 7.
- On every Critical or High support report.
- Before and after any separately authorized deployment, access change, or rollback.

## Incident Classification

Use Administration severity rules. Infrastructure leads technical containment for authentication, Worker, binding, migration, observability, PWA delivery, and rollback incidents.

Required incident record:

```text
Incident ID:
Detected at:
Severity:
Affected Worker or boundary:
Expected version and traffic:
Observed safe classification:
Affected company/user count:
Collection state:
Cohort count:
Recommendation influence state:
Evidence preserved:
New activation stopped: Yes/No
Founder notified:
Mutation required: Yes/No
Rollback eligible: Yes/No
Current status:
```

Never place secrets, raw authentication material, request bodies, customer records, or precise-location trails in the incident record.

## Incident Procedure

1. Stop new customer and user activation.
2. Record exact public and private Worker versions, traffic, and current safety state.
3. Preserve bounded logs and hashes without secret or customer-data exposure.
4. Determine whether the issue is public Worker, private Worker, identity, PWA delivery, Data, CRM, or customer-device scoped.
5. Confirm whether a production mutation has already occurred.
6. Reconcile company and user counts.
7. Route implementation diagnosis to the owning subsystem.
8. Continue read-only verification that does not worsen or obscure evidence.
9. Request exact Founder authorization for any access mutation, deployment, traffic change, production-data action, notification retry, or rollback.
10. Verify recovery against the exact affected scope and record the post-action identity.

Do not use blanket retries, native provider rollback, force-push, reset, deleted-class migrations, namespace deletion, data rewrite, or an unqualified build.

## Rollback Eligibility

Rollback is considered only when:

- a critical production failure is tied to a deployed release;
- safe containment without deployment is insufficient;
- the exact forward-compatible rollback artifact has been qualified for the current state;
- its commit, tree, bundle, manifest, configuration, and current Worker prerequisite match;
- it preserves all applied Durable Object migrations, classes, bindings, namespaces, secret references, and accepted records;
- the Founder authorizes that exact forward deployment.

Public and private Workers are independent. A public failure does not authorize private Worker mutation, and a private failure does not authorize public Worker mutation.

## Forward-Compatible Rollback Procedure

1. Keep collection `OFF`, cohorts `0`, and recommendation influence `OFF`.
2. Freeze the current incident evidence and production identities.
3. Select only the currently qualified forward rollback artifact for the affected Worker.
4. Verify it retains required class exports, migration history, binding names, namespaces, protected setting names, and existing records.
5. Verify the unaffected Worker must remain unchanged.
6. Obtain exact Founder authorization naming the target, current version, artifact, commit, tree, and rollback identities.
7. Perform one normal forward deployment attempt through the governed workflow.
8. Never use Cloudflare native rollback when stateful migration compatibility would be lost.
9. Run only the governed GET/HEAD smoke plan unless a separate write authorization exists.
10. Verify the new Worker identity and traffic, unaffected Worker identity, custom domains, authentication, PWA delivery, and safety state.
11. Continue 24-hour incident monitoring.

Rollback does not authorize record deletion, correction, replay, notification retry, user expansion, Anthony mapping, collection, cohorts, or recommendation influence.

## Founder Authorization Boundaries

Exact Founder authorization is required for:

- every production deployment or rollback deployment;
- every Access policy, protected setting, binding, migration, route, traffic, secret, or variable mutation;
- every named-user grant, pause, or removal unless a separate standing access authorization exists;
- every production-data correction, disposition, deletion, replay, or export;
- every notification or notification retry outside normal authorized product behavior;
- every scope expansion beyond the exact approved companies, users, roles, territories, or dates;
- any change to collection, cohorts, recommendation influence, Founder intelligence, or Anthony mapping.

Customer authorization is additionally required for its roster, territory, permitted data, device policy, support contact, retention shortening, and activation date. Customer authorization cannot replace Founder authorization for Prometheus-controlled production changes.
