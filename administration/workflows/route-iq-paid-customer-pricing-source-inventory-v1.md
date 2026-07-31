# Route IQ Pricing And Plan Source Inventory v1

## Authoritative Source

The sole current commercial model is
`administration/contracts/route-iq-paid-customer-revenue-readiness-v1.json`, pinned as
`route_iq_authoritative_commercial_model@1.0.0`.

## Inventory And Consistency Result

| Source class | Authority | Current result |
| --- | --- | --- |
| Authoritative commercial model | Administration | Present; price, currency, and cadence unset |
| Founder decision register | Administration | Present; all binding decisions unresolved |
| Public website copy | Website | Not authoritative for price or binding terms |
| CRM request records | CRM | Not authoritative for price or binding terms |
| Onboarding fixtures and rehearsals | Test evidence | Never commercial authority |
| Historical pilot or beta files | Historical evidence | Never commercial authority |
| Verbal, email, or ad hoc quote | None until governed | Must not activate billing |

Consistency result: `LIVE_REVENUE_BLOCKED`.

No approved price, currency, billing cadence, discount authority, tax treatment, payment term,
refund policy, or production billing provider is recorded. Every such value is
`FOUNDER DECISION REQUIRED`. Any downstream source claiming an active price or plan without the
exact model and decision-register versions must fail closed.
