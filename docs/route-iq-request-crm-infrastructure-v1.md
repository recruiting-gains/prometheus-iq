# Route IQ Request CRM Infrastructure v1

Prometheus Infrastructure routes the public `POST /api/partner-intake` endpoint into the CRM-owned Route IQ request contract. The active public path is fixed to workspace `prometheus_route_iq` and operating profile `route_iq_commercial`; legacy Fitness Connection and Smoothie Depot intake routing is not used by this runtime path.

## Durability

`ROUTE_IQ_REQUEST_CRM_COORDINATOR` is a SQLite-backed Cloudflare Durable Object binding. `RouteIqRequestCrmCoordinator` uses a Durable Object storage transaction for atomic `putIfAbsent`. Workers KV is not treated as compare-and-set storage. Identical retries return the canonical receipt; conflicting reuse fails closed.

The source declaration is release-ready but not deployed by this batch. Deployment must apply the additive `route-iq-request-crm-sqlite-v1` migration to the public `prometheusrouteiq-website` Worker before the website request flow can persist production leads. The private `prometheus-iq` Worker intentionally retains only its existing prospective coordinator; the request endpoint fails closed there because no CRM binding is present.

## Founder access

Founder retrieval and export require a valid Cloudflare Access JWT. The runtime verifies issuer, audience, signature, expiry, and the SHA-256 of the immutable `sub` claim against a governed server setting. It never authorizes a display name. Cruz maps to the CRM contract's immutable Founder principal. Anthony remains denied until his exact authenticated identity is separately mapped.

The validator follows Cloudflare's application-token contract: it reads only `Cf-Access-Jwt-Assertion`, resolves the account signing key from the exact team-domain JWKS endpoint, permits only `RS256`, requires `iss`, `aud`, `sub`, `iat`, and `exp`, validates `nbf` when present, and applies a five-second clock tolerance. The issuer and audience remain exact protected settings; no value is inferred from an unverified token.

JWT failures return one generic human message plus one fixed nonsecret code. The codes distinguish configuration, issuer, audience, signing-key, signature, expiration, premature-token, missing-claim, malformed-token, invalid-algorithm, and JWKS availability classes. The runtime never returns or logs a JWT, header, cookie, claim value, key, secret, hash input, issuer, audience, or subject. JWKS transport and malformed-JWKS failures are unavailable service conditions and remain fail closed.

The Infrastructure regression suite bundles the exact public `prometheusrouteiq-website` entry with Wrangler, starts that bundle in Miniflare, and intercepts every outbound request. It proves the real `createRemoteJWKSet` path fetches the exact team-domain cert endpoint, selects the RS256 key, and safely classifies unknown-key, network, and timeout failures without external network access. The private `prometheus-iq` configuration has no request-CRM binding or migration and is not a deployment target for this repair.

The production `route_iq_request_founder_auth_invalid` observation predates these classifications. Offline source and official-contract review proves that the cryptographic policy matches Cloudflare's documented RS256 application-token contract, but it cannot prove which protected live value or remote key-resolution phase caused that historical generic result. Do not guess or weaken validation. A separately authorized public Worker deployment is required before one authenticated Founder read can identify the fixed failure class. Any setting repair must then replace only the mismatched protected setting with the value re-derived from the exact existing Access application through the attended, non-outputting mapping process.

Required deployment settings contain no credentials in source:

- `ROUTE_IQ_REQUEST_CRM_ACCESS_TEAM_DOMAIN`
- `ROUTE_IQ_REQUEST_CRM_ACCESS_AUDIENCE`
- `ROUTE_IQ_REQUEST_CRM_FOUNDER_SUBJECT_SHA256`

These values are shape-validated at deployment, but secret presence and shape alone do not prove that the team domain and audience belong to the Access application currently protecting the Founder route. The attended mapping process is the authority for deriving that binding. No protected value is stored in this repository.

## Boundaries

The Founder notification contains a receipt and non-contact request summary only. Full contact information is available only through Founder-authorized retrieval. Prospective collection remains `OFF`, active cohorts remain `0`, and recommendation influence remains `OFF`. This path does not import or call the prospective shadow runtime.
