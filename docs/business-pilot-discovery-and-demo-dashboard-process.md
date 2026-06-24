# Business Pilot Discovery And Demo Dashboard Process

## Purpose

This process explains how Prometheus IQ should evaluate a new business, collect the right discovery answers, and create a separate sample dashboard for that business without affecting the live app, founder data, Anthony's beta profile, or any other customer environment.

## Core Rule

Every business must have its own separate demo dashboard, pilot configuration, language, goals, and success metrics.

Do not mix one business's data, routes, terminology, users, or outcomes with another business.

## The 10 Discovery Questions

Use these questions before building a demo dashboard or pilot configuration:

1. What is the main thing your outside sales reps are trying to sell, collect, book, or generate?
2. What does a successful day look like for one rep?
3. What daily goal or quota does each rep need to hit?
4. What numbers do you currently track every day?
5. What words or lingo does your team use for leads, visits, sales, appointments, follow-ups, or completed results?
6. Where do your reps usually go to find customers right now?
7. What types of locations usually produce the best results?
8. What wastes the most time or gas for your reps during the day?
9. How do managers currently verify that reps actually went where they said they went?
10. After 14 days, what result would make you say, "Prometheus IQ helped our team"?

## Demo Dashboard Workflow

1. Ask the 10 discovery questions.
2. Identify the business's main objective.
3. Translate their terminology into Prometheus IQ labels.
4. Define the rep's daily goal.
5. Define what counts as a successful visit.
6. Define what locations are qualified targets.
7. Define what locations should be excluded or permission-based.
8. Create a separate demo dashboard sample for that business.
9. Review the demo with the business before any pilot.
10. Only after approval, create a separate pilot setup.

## Separation Requirements

Each business should have its own:

- Demo dashboard.
- Rep language.
- Daily goal.
- Success metrics.
- Qualified prospect categories.
- Excluded target rules.
- Pilot notes.
- User list.
- Export backups.
- Final pilot report.

## Do Not Mix

Do not mix:

- Cruz founder data with customer data.
- Anthony beta data with future business data.
- Fitness Connection pilot material with unrelated businesses.
- One company's routes with another company's routes.
- One company's users with another company's users.
- One company's dashboard labels with another company's dashboard labels.

## Current Example

The first standalone sample dashboard lives at:

`demos/company-dashboard-sample.html`

This is a generic sample only. It is not connected to the production app, Anthony's beta profile, or any real customer account.

## Future Website Use

When the public website is ready, the 10 discovery questions can become a pilot request intake form.

That form should collect enough information to help Prometheus create a custom demo dashboard, but it should not reveal proprietary Route Intelligence logic or internal scoring methods.

## Founder Rule

Prometheus IQ should feel custom to every business without rebuilding the entire product from scratch.

The foundation stays the same:

- Where to go.
- Verify the visit.
- Track what happened.
- Learn from results.
- Improve the next route.

The business layer changes:

- What they sell.
- What they call success.
- What their reps track.
- What their managers care about.
- What locations are worth visiting.
