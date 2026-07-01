# Feature Request Workflow

## Purpose

Capture tester requests without allowing live beta feedback to become uncontrolled product churn.

## Intake

Use `templates/feature-request.md` and record the request in `registers/feature-requests.json`.

Required fields:

- Request ID.
- Reporter/tester ID.
- Date reported.
- Problem statement.
- Requested capability.
- Frequency.
- Impact.
- Workaround.
- Owning subsystem if accepted.
- Status.

## Evaluation Rules

Accept later when:

- Multiple testers report the same operational problem.
- The request supports the product rule: sell more, drive less, waste less time, learn what works, or make tomorrow's route smarter.
- The current workaround is too costly.
- The requirement is clear enough to test.

Reject or defer when:

- The request is only preference.
- The request would expose sensitive data.
- The request duplicates an existing feature.
- The request belongs to CRM, Infrastructure, Companion, or Integrations and lacks explicit approval.
- The beta can continue without it.

## During Active Pilot

Do not implement new features during a live pilot unless the pilot cannot continue without the feature. Record, classify, and review requests weekly.
