# Prometheus IQ Dashboard Intelligence Engine v1

Date: 2026-06-25

## Existing Work Verification

1. Is this already built?

The Prometheus IQ dashboard already exists in `index.html`. It includes Rep Mode, Owner Mode, Today Scoreboard, Route Intelligence, Daily Route, Route Builder, place management, visit logging, GPS-aware visit records, import/export, and manager reporting.

2. Is it partially built?

Yes. Route Intelligence v4.1 is already partially built. Existing logic already supports route freshness, exploration versus exploitation, category diversity, access type, actionability tiers, multi-rep profile separation, Anthony first-route protection, and "Why this stop" explanations.

3. Where does it already exist?

- Main dashboard: `index.html`
- Prometheus OS / Companion intelligence systems: `prometheus-os/`
- Local route quality work: `data/qualified-prospects/` and `scripts/`
- Separate demo that must not replace the real dashboard: `demos/company-dashboard-sample.html`

4. Should it be reused?

Yes. The existing `index.html` dashboard is the correct dashboard. The intelligence improvements were added directly to that dashboard instead of creating a duplicate dashboard or redesigning the product.

5. Should it be improved?

Yes. The dashboard needed stronger context around existing numbers and clearer reasoning behind route recommendations, confidence, expected units, and next-best-action guidance.

6. What should not be duplicated?

Do not duplicate the dashboard, scorecards, route builder, Anthony profile, Owner Mode, Rep Mode, Prometheus OS, or demo dashboard. The demo dashboard remains separate and should not become the production app surface.

## Work Completed

Updated `index.html` only.

Added contextual intelligence to the existing Today Scoreboard:

- Units Today now shows whether output is above or below same-weekday pace when enough data exists.
- Need now shows estimated completion probability.
- Visits Today now shows available ranked route depth.
- Conversations now shows whether talk volume is ahead or behind expected pace.
- Leads now shows whether lead pace is healthy or behind.

Improved Route Intelligence:

- Confidence changed from simple labels to percentage-based route confidence.
- Confidence now explains the evidence behind the score.
- Expected output now estimates expected units using available place, category, or rep-level evidence.
- Best Next Move now explains why this stop, why now, who to ask for, access type, why not the next alternative, and expected visit length.
- Route risk now includes completion probability and stronger guidance when conversations or leads are weak.

Improved route cards:

- Each route card now includes confidence percentage.
- Each route card now includes expected units.
- Each route card now includes expected visit duration.
- Each route card now explains confidence evidence, expected ROI basis, and the best-next-move reason.

Improved Owner Mode insight:

- Owner Mode now shows GPS verification rate, lead totals, unit totals, and lead-to-unit conversion when viewing team reporting.
- Rep Mode still preserves independent profile language and does not imply impersonation.

## Intelligence Model

The dashboard now uses existing app evidence:

- Place visit history
- Lead history
- Unit history
- Category performance
- Rep baseline
- Same-weekday pace
- Route score
- Access type
- Actionability tier
- Freshness / recency
- Anthony first-route status
- Available route depth

No fake learning was added. The system estimates with available evidence and caps confidence when rep or category history is thin.

## What Was Not Changed

- No dashboard redesign.
- No duplicate dashboard.
- No new dashboard route.
- No Anthony production beta data modification.
- No public website behavior modification.
- No production deployment.
- No commit.
- No push.
- No Google API call added.
- No secrets added.

## Verification

Completed:

- Existing dashboard verified in `index.html`.
- Existing Route Intelligence functions reused.
- Inline JavaScript parse check passed.
- CSP hash recalculated and updated.
- CSP hash verification passed.
- No `.env` or key file was modified.
- No duplicate dashboard file was created.

Current verification command results:

- `inline script parses`
- `csp hash matches`

## Remaining Work

The next quality jump requires real Anthony beta outcomes:

- Anthony visits completed
- Conversations logged
- Leads logged
- Units logged
- GPS verified stops
- Missed / skipped recommendations
- Rep feedback on route quality

Until that data exists, expected units and confidence are evidence-based estimates, not proven learning.

## Highest ROI Next Task

Run the Friday Anthony beta using the improved dashboard, then compare:

- Recommended stops versus actual stops
- Conversation rate by category
- Lead rate by category
- Units by category
- Skipped recommendations
- Anthony trust level in the route

That field data is what turns the dashboard from smart scoring into real rep-specific intelligence.

