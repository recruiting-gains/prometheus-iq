# Field Learning Loop Future Subsystem Handoffs

This document prepares future handoffs. It does not authorize production integration.

## Dashboard Handoff

Prepared future responsibility:

- Produce completed-visit evidence after a Dashboard-owned implementation task.
- Preserve current Dashboard runtime behavior until that task is approved.
- Keep Anthony's current recommendation experience unchanged until explicit activation.
- Emit stable visit, route, candidate, rep, timestamp, and outcome references.

Not authorized:

- consuming learning signals in Dashboard recommendations
- changing route cards
- changing production recommendation ordering
- changing Active Pool usage

## CRM Handoff

Prepared future responsibility:

- Attach admitted field learning to CRM visit history, follow-up, lead, account, opportunity, and customer lifecycle records after CRM approval.
- Keep CRM as the system of record for account and customer state.
- Provide sale, follow-up, and lifecycle outcomes as evidence events only after implementation.

Not authorized:

- creating or mutating CRM records from this architecture package
- replacing CRM health scoring
- duplicating CRM account objects inside Intelligence

## Research Handoff

Prepared future responsibility:

- Provide sourced industry, market, competitor, and customer-context intelligence that can interpret field patterns.
- Preserve Research source attribution, source confidence, and citation policy.
- Feed anonymized learning questions back to Research only after approval.

Not authorized:

- scraping or ingesting Research outputs automatically
- creating external-source claims without attribution
- allowing Research to change production route recommendations directly

## Companion Handoff

Prepared future responsibility:

- Consume founder-safe learning summaries, review queues, and explanation snapshots after Companion approval.
- Help Cruz review trends, overrides, and learning blockers.
- Preserve Companion as founder-only operating context.

Not authorized:

- storing production learning state in Companion memory
- changing customer-facing recommendations
- exposing sensitive field evidence outside approved review surfaces

## Sales Handoff

Prepared future responsibility:

- Provide objection patterns, discovery themes, pilot success criteria, and customer-value hypotheses as future evidence sources.
- Use learning summaries to improve sales methodology after review.
- Keep Sales ownership focused on customer-facing narrative, process, and enablement.

Not authorized:

- changing scoring or opportunity ranking
- creating separate customer intelligence models
- duplicating CRM or Intelligence records

## Activation Requirement

Each handoff requires a separate subsystem task, tests, production-safety review, and Overwatch acceptance before any production consumer uses Field Learning Loop contracts.
