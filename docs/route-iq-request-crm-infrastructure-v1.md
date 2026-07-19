# Route IQ Request CRM Infrastructure v1

Prometheus Infrastructure routes the public `POST /api/partner-intake` endpoint into the CRM-owned Route IQ request contract. The active public path is fixed to workspace `prometheus_route_iq` and operating profile `route_iq_commercial`; legacy Fitness Connection and Smoothie Depot intake routing is not used by this runtime path.

## Durability

`ROUTE_IQ_REQUEST_CRM_COORDINATOR` is a SQLite-backed Cloudflare Durable Object binding. `RouteIqRequestCrmCoordinator` uses a Durable Object storage transaction for atomic `putIfAbsent`. Workers KV is not treated as compare-and-set storage. Identical retries return the canonical receipt; conflicting reuse fails closed.

The source declaration is release-ready but not deployed by this batch. Deployment must apply the additive `route-iq-request-crm-sqlite-v1` migration to the public `prometheusrouteiq-website` Worker before the website request flow can persist production leads. The private `prometheus-iq` Worker intentionally retains only its existing prospective coordinator; the request endpoint fails closed there because no CRM binding is present.

## Founder access

Founder retrieval and export require a valid Cloudflare Access JWT. The runtime verifies issuer, audience, signature, expiry, and the SHA-256 of the immutable `sub` claim against a governed server setting. It never authorizes a display name. Cruz maps to the CRM contract's immutable Founder principal. Anthony remains denied until his exact authenticated identity is separately mapped.

Required deployment settings contain no credentials in source:

- `ROUTE_IQ_REQUEST_CRM_ACCESS_TEAM_DOMAIN`
- `ROUTE_IQ_REQUEST_CRM_ACCESS_AUDIENCE`
- `ROUTE_IQ_REQUEST_CRM_FOUNDER_SUBJECT_SHA256`

## Boundaries

The Founder notification contains a receipt and non-contact request summary only. Full contact information is available only through Founder-authorized retrieval. Prospective collection remains `OFF`, active cohorts remain `0`, and recommendation influence remains `OFF`. This path does not import or call the prospective shadow runtime.
