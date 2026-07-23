# Route IQ Production Support Triage v1

Document ID: `route-iq-production-support-triage-v1`
Owner: Prometheus Administration
Status: production operating procedure
Applies to: bounded August 1 Route IQ production activation

## Purpose

This procedure receives, classifies, routes, and closes Route IQ production issues without turning customer feedback into uncontrolled product work. It is a production procedure, not a beta-support process.

Historical beta support files remain preserved but do not control production severity, response, access, or activation decisions.

## Required Decisions Before Activation

Founder must name:

- primary Prometheus support owner;
- backup support owner;
- customer-visible support channel;
- launch-day coverage window;
- ordinary support hours after launch day;
- Founder escalation method;
- the customer decision-maker and operational escalation contact for each activated company.

Each customer must acknowledge the support channel, support hours, permitted information, and emergency stop process. Until those decisions are recorded, customer activation is `NO-GO`.

The response targets below are internal launch targets, not a contractual service-level agreement. A customer-facing SLA requires separate Founder and customer approval.

## Safe Intake Record

Record only what is necessary:

```text
Issue ID:
Reported at:
Customer workspace ID:
Operating profile ID:
Opaque user ID:
Device and browser class:
Current app/Worker version:
Severity:
Observed behavior:
Expected behavior:
Reproduction steps:
Affected workflow:
Data integrity risk: Yes/No/Unknown
Cross-company risk: Yes/No/Unknown
Security risk: Yes/No/Unknown
Blocks field work: Yes/No
Owning subsystem:
Status:
Evidence location:
Founder decision required: Yes/No
```

Do not record passwords, one-time codes, tokens, cookies, authorization headers, raw JWTs, secret values, uncontrolled customer notes, precise-location trails, or unnecessary personal information. Screenshots must be reviewed for customer and authentication material before storage.

## Severity And Response Targets

### Critical

Examples:

- cross-company or cross-user data exposure;
- a representative reaches Founder-only CRM or intelligence;
- an unauthorized principal receives access;
- collection is not `OFF`, cohort count is not `0`, or recommendation influence is not `OFF`;
- Anthony is mapped or receives access;
- accepted records are lost, silently rewritten, or duplicated;
- the active Worker identity or traffic changes unexpectedly;
- all activated users cannot authenticate or use the core workflow;
- a credential, session, or protected identity value is exposed;
- company or named-user limits are exceeded.

Internal target: acknowledge within 15 minutes during the approved coverage window, notify the Founder immediately, stop new activations, preserve evidence, and begin the Infrastructure incident procedure. Do not improvise a production mutation.

### High

Examples:

- one or more approved users cannot authenticate after a fresh session;
- route startup, Directions, result capture, correction, End Route, End Day, export, or archive handoff is materially blocked;
- repeated PWA update or session-expiration failure affects field use;
- monitoring exceeds a High threshold;
- a notification or CRM state is inconsistent after durable persistence;
- a role or territory appears incorrect without proven exposure.

Internal target: acknowledge within 1 hour during approved support hours, route within 2 hours, and provide a containment or investigation plan within 4 hours.

### Medium

Examples:

- a workaround exists but workflow friction is meaningful;
- intermittent latency exceeds the warning threshold;
- copy, wording, layout, or device behavior creates repeatable confusion;
- evidence is incomplete but no integrity or isolation failure is shown.

Internal target: acknowledge within one business day and include in the next governed triage review.

### Low

Examples:

- cosmetic defects;
- nonblocking wording or spacing;
- feature requests with no production failure;
- one-off preference feedback.

Internal target: record and review in the normal product-planning cadence. Do not promise implementation.

Unknown security, identity, isolation, or data-integrity impact is treated as Critical until ruled out.

## Triage Sequence

1. Assign one issue ID and record the report once.
2. Confirm current customer workspace, operating profile, opaque user, device, and release identity.
3. Separate observed fact, customer report, inference, and unknown.
4. Classify severity using the rules above.
5. Stop new user activation for any Critical issue.
6. Route the issue to the owning subsystem.
7. Preserve logs and artifacts without exposing secrets or customer data.
8. Identify whether a production mutation or Founder decision is required.
9. Verify any repair through the normal owner, Overwatch, release, and deployment boundaries.
10. Record customer-visible status without unsupported promises.
11. Close only after regression evidence and affected-user verification are complete.

Never automatically retry an ambiguous write, notification, deployment, access mutation, data correction, or record submission.

## Owner Routing

| Issue class | Owning subsystem |
| --- | --- |
| Visible route, logging, role presentation, or field workflow | Prometheus Dashboard |
| PWA install, mobile browser, session, offline, update, or device behavior | Prometheus Mobile |
| Workspace, roster, retention, record integrity, archive, duplicate, or isolation data | Prometheus Data |
| Ranking, confidence, learning, advisory intelligence, or explanation | Prometheus Intelligence Engine |
| Authentication, Access, Worker, binding, migration, monitoring, deployment, or rollback | Prometheus Infrastructure |
| Public request receipt, durable lead, notification ordering, retrieval, or export | Prometheus CRM |
| Public website, legal page, metadata, or request-form presentation | Prometheus Website |
| Customer training, success measurements, or commercial expectation | Prometheus Sales / Customer Success |
| Intake, status, routing, support record, go/no-go, or closeout | Prometheus Administration |
| Ownership, provenance, acceptance gate, or release-policy conflict | Prometheus Overwatch |

Administration coordinates. It does not repair subsystem-owned implementation.

## Immediate Containment Rules

Without a separate standing incident authorization, support personnel may:

- stop onboarding and new activations;
- tell affected users to stop using a compromised workflow;
- record evidence and current identities;
- use read-only health, count, and status checks;
- ask the Founder for an exact decision.

Support personnel may not, without exact Founder authorization:

- deploy or roll back a Worker;
- change traffic, routes, bindings, migrations, secrets, variables, Access policies, or user mappings;
- repair, delete, rewrite, export, or backdate production data;
- resubmit an ambiguous customer action;
- send or retry a notification;
- activate collection, cohorts, recommendation influence, or Anthony;
- exceed the two-company or 40-user ceiling.

## Customer Communication Rules

- State what is known, what is unknown, the current containment, and the next update time.
- Do not call a report resolved until verification is recorded.
- Do not describe an observation as causal proof or recommendation superiority.
- Do not reveal another customer's existence, roster, territory, data, issue, or activity.
- Do not disclose internal security details, credentials, proprietary ranking logic, or Founder-only intelligence.
- Do not promise a feature, deployment, data correction, refund, SLA, or expansion without the authorized owner decision.

## Closure Gate

An issue closes only when:

- the owning subsystem returns verified evidence or the issue is explicitly deferred;
- current production identity is recorded when a deployment was involved;
- regression verification passes;
- affected-user verification passes or is marked not required with a reason;
- company and user counts remain within limits;
- collection is `OFF`, cohorts are `0`, and recommendation influence is `OFF`;
- no unrelated production mutation occurred;
- customer-facing status is updated through the approved support channel;
- the Founder decision is recorded for every Founder-gated action.

## Daily Launch Support Review

- Open Critical issues: ____
- Open High issues: ____
- New customer-impacting issues: ____
- Authentication failures requiring investigation: ____
- Isolation or data-integrity concerns: ____
- PWA/device issues: ____
- Current customer companies: ____ / 2
- Current named customer users: ____ / 40
- Collection: `OFF` / other
- Active cohorts: `0` / other
- Recommendation influence: `OFF` / other
- New activation allowed: Yes / No
- Founder decision required: Yes / No
- Review owner and time: ____________________
