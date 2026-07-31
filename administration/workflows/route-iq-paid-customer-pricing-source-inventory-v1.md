# Route IQ Pricing And Plan Source Inventory v1

## Governing Rule

The sole current commercial authority is:

`administration/contracts/route-iq-paid-customer-revenue-readiness-v1.json`

It is pinned as `route_iq_authoritative_commercial_model@1.0.0`. Its price, currency,
billing cadence, discount authority, payment terms, tax treatment, refund terms,
cancellation terms, support commitments, and production billing provider remain unset.
Every binding value is `FOUNDER DECISION REQUIRED`.

No website, Dashboard view, proposal, agreement template, order form, fixture, CRM
record, billing implementation, environment setting, historical package, verbal quote,
email, or provider object can override this model.

## Classification Vocabulary

- `AUTHORITATIVE`: the only governed source of binding commercial state.
- `DRAFT`: a nonbinding template or working document requiring completed decisions and approval.
- `HYPOTHESIS`: proposed pricing or packaging used for research or planning.
- `HISTORICAL`: retained operating or customer-specific material with no current authority.
- `TEST_ONLY`: fictional or simulated data that cannot authorize commercial activity.
- `TECHNICAL_COST_ONLY`: infrastructure/provider cost evidence, not customer pricing.
- `NOT_COMMERCIAL_AUTHORITY`: implementation, public copy, intake data, or governance that
  may describe state but cannot set a binding term.

## Exact Repository Inventory

| Exact source path | Repository surface | Classification | Reconciliation |
| --- | --- | --- | --- |
| `administration/contracts/route-iq-paid-customer-revenue-readiness-v1.json` | Commercial model | `AUTHORITATIVE` | Sole authority; all binding values remain `FOUNDER DECISION REQUIRED`. |
| `administration/contracts/route-iq-paid-customer-revenue-readiness-v1.mjs` | Model validator | `NOT_COMMERCIAL_AUTHORITY` | Enforces the authoritative model but cannot originate a price or term. |
| `administration/registers/route-iq-paid-customer-revenue-founder-decisions-v1.json` | Founder decisions | `NOT_COMMERCIAL_AUTHORITY` | Records unresolved decisions; it does not independently create binding terms. |
| `administration/templates/route-iq-customer-agreement-draft-v1.md` | Agreement template | `DRAFT` | Nonbinding until legal review and exact Founder approval. |
| `administration/templates/route-iq-order-form-draft-v1.md` | Order-form template | `DRAFT` | Contains placeholders only; cannot establish price, term, or customer obligation. |
| `administration/templates/route-iq-data-handling-draft-v1.md` | Data terms | `DRAFT` | Requires legal and Founder approval. |
| `administration/templates/route-iq-support-commitment-draft-v1.md` | Support terms | `DRAFT` | Proposed service boundaries only. |
| `administration/templates/route-iq-cancellation-plan-change-draft-v1.md` | Cancellation/plan terms | `DRAFT` | Binding values remain unresolved. |
| `administration/templates/route-iq-pilot-form-draft-v1.md` | Legacy pilot form | `HISTORICAL` | Retained provenance; not a paid-customer authority. |
| `docs/prometheus-pricing-strategy-playbook.md` | Fitness Connection pricing strategy | `HISTORICAL` | Conflicting proposals include $1,500-$5,000 setup, recommended $2,500 setup, $39/$49/$79 per user monthly, $3,430 monthly for 70 users, $23,080 over six months, and later renewal/range proposals. None is approved or current. |
| `docs/cloud-beta-cost-and-response-plan.md` | Early operating and pilot plan | `HYPOTHESIS` | Proposes a $250/30-day pilot and no setup fee; contradicts the historical Fitness Connection playbook and is not current authority. Its hosting/provider figures are planning estimates only. |
| `docs/competitor-pricing-revenue.md` | Market research | `HYPOTHESIS` | Competitor benchmarks and proposed Route IQ ranges ($19-$39/user, $99-$299/club, $49-$79/user) are research, not an offer. |
| `sales/enterprise-pilot-sales-package.md` | Sales proposal guidance | `HYPOTHESIS` | Proposes $500-$15,000 setup and $49-$99/user monthly ranges; conflicts with other hypotheses and cannot bind Prometheus. |
| `docs/fitness-connection-pitch-plan.md` | Fitness Connection proposal history | `HISTORICAL` | Monthly/per-club/per-rep ideas and a referenced third-party CRM cost are historical positioning, not Route IQ pricing authority. |
| `docs/investor-readiness-plan.md` | Investor planning | `HISTORICAL` | Paid-pilot/subscription and exclusivity concepts are not approved customer terms. |
| `PROMETHEUS OPERATING SYSTEM/03 Pricing & Revenue/README.md` | Historical operating index | `HISTORICAL` | Points to strategy materials; cannot approve them. |
| `PROMETHEUS EXECUTIVE PACKAGE/03 Pilot Proposal/README.md` | Historical executive package | `HISTORICAL` | Pricing-proposal placeholder only. |
| `PROMETHEUS EXECUTIVE PACKAGE/04 Pilot Approval Package/README.md` | Historical approval package | `HISTORICAL` | Pilot governance context, not commercial authority. |
| `SENDABLE LEADERSHIP PACKET/03 Pilot Approval Package/prometheus-iq-pilot-approval-package.md` | Historical sendable package | `HISTORICAL` | Retained provenance; no current paid-customer terms. |
| `legal/build_prometheus_pilot_agreement.py` | Legacy agreement generator | `HISTORICAL` | Uses fee placeholders and a $1,000 liability floor; neither is an approved Route IQ commercial term. |
| `legal/Prometheus_IQ_Pilot_Confidentiality_Agreement_DRAFT.docx` | Legacy agreement artifact | `HISTORICAL` | Draft binary retained for provenance; not a current agreement or pricing source. |
| `sales/route-iq-customer-onboarding-v1.md` | Onboarding process | `NOT_COMMERCIAL_AUTHORITY` | Describes governed onboarding and retention boundaries, not price or billing approval. |
| `administration/workspace-configurations/route-iq-controlled-paid-customer-onboarding-rehearsal-v1.json` | Onboarding rehearsal | `TEST_ONLY` | Fictional plan identifier, disabled billing, and null subscription; never a commercial offer. |
| `administration/workspace-configurations/route-iq-paid-customer-synthetic-fixtures-v1.json` | Onboarding fixtures | `TEST_ONLY` | Synthetic subscription capability only. |
| `crm/paid-customer-revenue-readiness-v1.mjs` | Billing rehearsal code | `TEST_ONLY` | Simulated plan/subscription state; cannot create a price, activate Live mode, or bind a customer. |
| `dashboard/route-iq-paid-customer-revenue-readiness.mjs` | Founder readiness view | `NOT_COMMERCIAL_AUTHORITY` | Read-only display of server state; cannot originate or approve terms. |
| `workers/infrastructure/route-iq-paid-customer-onboarding-runtime-v1.json` | Runtime configuration | `NOT_COMMERCIAL_AUTHORITY` | Runtime lifecycle contract only; no customer pricing authority. |
| `workers/infrastructure/route-iq-private-forward-rollback-candidate-v3.json` | Deployment cost metadata | `TECHNICAL_COST_ONLY` | Incremental infrastructure-cost estimate; not customer pricing. |
| `docs/route-iq-business-availability-infrastructure-v1.md` | Infrastructure cost analysis | `TECHNICAL_COST_ONLY` | Cloudflare/Durable Object cost estimates cannot become a Route IQ price. |
| `.github/workflows/controlled-paid-customer-onboarding-rehearsal-v1.yml` | Qualification environment/workflow | `TEST_ONLY` | Rehearsal and deployment controls contain no authority to set commercial terms. |
| `public-site-static/index.html` | Public website source | `NOT_COMMERCIAL_AUTHORITY` | No approved public price or plan; public copy cannot establish one. |
| `public-site-static/terms/index.html` | Public terms source | `NOT_COMMERCIAL_AUTHORITY` | General website terms are not an executed customer agreement or order form. |
| `deploy/prometheusrouteiq-website/index.html` | Generated public deployment asset | `NOT_COMMERCIAL_AUTHORITY` | Generated copy cannot supersede the authoritative model. |
| `deploy/prometheusrouteiq-website/terms/index.html` | Generated public terms asset | `NOT_COMMERCIAL_AUTHORITY` | Generated terms are not commercial authority. |
| `crm/crm-foundation.mjs` | Lead records and intake storage | `NOT_COMMERCIAL_AUTHORITY` | A lead's requested timeline or use case cannot set pricing or contract terms. |
| `docs/prometheus-llc-launch-plan.md` | Finance planning | `HISTORICAL` | Subscription-expense and finance planning do not approve customer pricing. |

## Contradiction Result

The repository intentionally preserves incompatible historical and hypothetical amounts:

- historical Fitness Connection recommendation: `$49/user/month` plus `$2,500` setup;
- historical Fitness Connection range: `$39-$79/user/month` and `$1,500-$5,000` setup;
- early pilot hypothesis: `$250` for 30 days with no setup fee;
- general sales hypotheses: `$49-$99/user/month` and `$500-$15,000` setup;
- market-research hypotheses: `$19-$79/user/month` or `$99-$299/month` per club;
- technical provider and infrastructure costs that are not customer prices.

These contradictions are evidence that none of those sources is binding. Historical files remain
unchanged for provenance. No amount may flow into an offer, order form, agreement, subscription,
invoice, public claim, Dashboard state, CRM record, Stripe object, or production environment until
the authoritative model records the exact Founder-approved decisions.

## Consistency Result

`LIVE_REVENUE_BLOCKED`

There is no approved price, currency, cadence, discount authority, payment term, tax treatment,
refund policy, cancellation policy, support commitment, or production billing provider. Public
surfaces contain no commercial authority. Any downstream source claiming an active price or plan
without exact model and decision-register pins must fail closed.
