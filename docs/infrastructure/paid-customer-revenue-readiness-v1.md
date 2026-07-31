# Paid-Customer Revenue Readiness v1

Prometheus Infrastructure owns the private runtime, immutable qualification
lane, deployment boundary, acceptance evidence, and forward rollback.

The internal route is an exact, Founder-only, read-only `GET`:

`/api/dashboard/route-iq/internal/paid-customer-revenue-readiness`

Cloudflare Access validates the immutable Founder mapping before the Revenue
Security authority binds the request to the fictional Orion company and
workspace. Rejected callers receive the same non-enumerating response.

The runtime executes only isolated in-memory rehearsals. Simulated payment
success, failure, replay, cancellation, and recovery evidence cannot enable
live billing or customer activation. Temporary records are cleared before the
response is returned. Stripe, CRM production records, the governed CRM receipt,
providers, invitations, collection, cohorts, scheduling, and recommendation
influence remain untouched.

The GitHub-hosted workflow is manual-only, builds the private release once,
independently reverifies the artifact, deploys only `prometheus-iq`, runs
authenticated desktop and exact 390x844 read-only acceptance, and independently
verifies bounded final evidence. Critical acceptance failure uses only the
paired forward-compatible rollback and preserves Durable Objects, bindings,
migrations, and suspended access.

No workflow was dispatched and no production system was contacted while this
Infrastructure batch was implemented.
