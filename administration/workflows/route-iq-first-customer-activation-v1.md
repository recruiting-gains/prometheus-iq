# Prometheus Route IQ First-Customer Activation Runbook v1

This runbook governs the first real Prometheus Route IQ customer after the external legal, banking, pricing, contract, tax-configuration, and Stripe Live gates are complete. Prometheus.IQ operates as a sole proprietorship; LLC formation and EIN acquisition are not current activation prerequisites. Validation, billing readiness, and commercial acceptance never activate a customer by themselves.

## 1. Lead received

- Confirm the public request has one durable receipt and an acquisition source.
- Confirm Founder notification state and review the request through Founder-only CRM access.
- Do not create a customer workspace from an unverified or duplicate request.

## 2. Lead qualified

- Record the business problem, buyer, territory, expected users, locations, timeline, and support owner.
- Confirm that the prospect understands Route IQ is advisory and human-controlled.
- Keep customer activation, provider refresh, collection, cohorts, scheduling, and recommendation influence OFF.

## 3. Demonstration prepared

- Create an isolated synthetic demonstration tenant; never reuse production customer or Founder-research data.
- Configure terminology, operating profile, representative roles, locations, verified hours, and a small synthetic opportunity set.
- Verify manager and representative views, first advisory route, explanations, hours eligibility, and safe empty states.
- Remove the demonstration tenant through the governed cleanup path after the demonstration.

## 4. Customer approved

- Require Founder approval plus completed customer authorization, pricing, contract, retention disclosure, support plan, and legal/entity/banking gates.
- Require Stripe Live prerequisites only when paid activation is authorized. A test-mode billing state is not payment approval.

## 5. Tenant created

- Validate the versioned onboarding configuration and immutable company/workspace identities.
- Preview terminology, locations, territory, targets, exclusions, metrics, roles, and freshness rules.
- Provision idempotently. A retry must return the same resources and must not activate the tenant.

## 6. Users invited

- Invite only named, customer-authorized users after tenant approval.
- Bind every user to an immutable principal and one governed company/workspace role.
- Verify representatives cannot access Founder, billing, governance, or another tenant.

## 7. Initial data imported

- Import only authorized locations and opportunities through the governed adapter.
- Require identity, address, territory, category, operating status, hours, provenance, freshness, and duplicate resolution.
- Missing, stale, conflicting, closed, excluded, duplicated, or provider-failed records remain ineligible.

## 8. First route verified

- Generate an advisory-only route for one authorized representative.
- Verify every stop is in scope, freshly verified open, and supported by a visible explanation.
- Confirm collection remains OFF, cohorts remain 0, and recommendation influence remains OFF unless separately activated later.

## 9. Support and recovery

- Record visits and follow-ups with tenant-bound idempotency identities.
- On failure, stop the affected transition, preserve audit evidence, and retry only through the governed recovery path.
- Suspension removes operational access without deleting audit history. Forward rollback must never restore unauthorized access.

## External gates

The following wait for separate Founder decisions and evidence: business bank account, final pricing, customer contract and consent, tax and refund configuration, Stripe Live credentials, payment collection, real customer activation, real user invitations, provider activation, collection activation, cohorts, scheduling, and recommendation influence. LLC formation and EIN acquisition are not current launch blockers.
