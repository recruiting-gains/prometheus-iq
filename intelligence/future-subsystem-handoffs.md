# Future Subsystem Handoffs

This document prepares future handoffs. It does not authorize implementation.

## Dashboard Handoff

Future task:

Add read-only Intelligence explanation panels after the Confidence Engine can produce stable `RecommendationExplanation` records.

Dashboard must not:

- change current scoring without Intelligence and Dashboard approval
- bypass Active Pool
- expose unsupported confidence claims
- display Research or CRM private data without approved contracts

Acceptance conditions:

- Golden Route Quality Gate passes.
- Dashboard workflow harness passes.
- Explanation records include evidence and uncertainty.
- Human override state is visible where relevant.

## CRM Handoff

Future task:

Allow CRM to produce account, opportunity, follow-up, and lifecycle evidence events for Intelligence ingestion.

CRM must not:

- choose routes
- score prospects
- duplicate Intelligence confidence logic
- write directly into Dashboard runtime state

Acceptance conditions:

- CRM event contract has tenant/account scope.
- CRM validation passes.
- Sensitive customer fields are classified.
- Intelligence consumes a read-only snapshot first.

## Research Handoff

Future task:

Allow Research briefs to produce industry intelligence events that can inform confidence limits and opportunity context.

Research must not:

- modify recommendations directly
- ingest unsupported sources
- omit citations
- convert hypotheses into verified facts

Acceptance conditions:

- Research source policy passes.
- Every intelligence item has source tier and citation.
- Intelligence treats Research as contextual evidence, not route proof.

## Companion Handoff

Future task:

Allow Companion to summarize Intelligence state for Cruz: what changed, what was learned, where confidence increased or decreased, and what review is needed.

Companion must not:

- alter scoring
- alter CRM records
- change Dashboard behavior
- present uncertain findings as facts

Acceptance conditions:

- Companion receives founder-safe summaries only.
- Knowledge graph facts preserve truth level.
- Human override and uncertainty are included.
- No private customer data is exposed without explicit approval.

## Data Handoff

Future task:

Extend Runtime Governance exports with refresh deltas useful for Intelligence quality audits.

Data must not:

- implement Intelligence scoring
- weaken Active/Reserve/Quarantine rules
- expose API keys
- rewrite learning contracts

Acceptance conditions:

- Runtime governance remains passing.
- Golden Route Quality Gate remains passing.
- Refresh deltas are read-only to Intelligence.

## Sales Handoff

Future task:

Allow Sales to define customer-value hypotheses and pilot success metrics that Intelligence can later compare against outcomes.

Sales must not:

- claim production Intelligence capabilities before implementation
- define scoring logic
- duplicate CRM customer records

Acceptance conditions:

- Sales artifacts distinguish customer-facing claims from internal hypotheses.
- Metrics map to CRM or Dashboard evidence contracts.
- Intelligence treats Sales input as hypothesis until validated.

