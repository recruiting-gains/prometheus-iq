# Cloudflare Unattended Deployment Access Governance v1

Batch: `BATCH-20260714-006`

Owner: Prometheus Overwatch

Status: runtime guard source verified; setup not configured; deployment blocked.

Prometheus Infrastructure owns the Worker guard, fixed smoke client, Keychain launcher, Founder control-file parser, supply-chain pin, and secret scanner. Overwatch owns only the independent governance, verification, reporting, protected baselines, and release decision around that implementation.

## Verified Source Boundary

- A Cloudflare Access service principal is recognized only through a signature-verified RS256 application JWT with the exact issuer, audience, empty `sub`, and configured service-token `common_name`.
- The request marker alone never authorizes access. A service-token-shaped request that is missing or malformed is denied rather than falling through to the ordinary Founder or representative path.
- The private Worker source runs before assets. The service principal is restricted to the exact production origin, fixed GET/HEAD paths, no query string, no body, no cookies, manual redirects, and a verified response marker.
- Ordinary human Access traffic remains on the existing application path.
- The launcher exposes four fixed profiles only. It uses the exact npm-locked Wrangler `4.110.0`, strips `NODE_OPTIONS` and unrelated environment values, separates deployment and smoke credentials, and suppresses child output.
- The Founder control file must be a current-user, single-link regular file at mode `0600` beneath a mode `0700` parent. It must exactly match the current commit, tree, private Worker, environment, Founder directive, canonical validity window, and one-shot nonce.
- A launch consumes the nonce with an exclusive durable marker before any child starts. Failure or interruption burns the authorization.
- Secret detection scans every regular file represented by the Git index, regardless of extension or size, and never reports matched values.

## Current Release Boundary

Source implementation is complete, but unattended deployment and authenticated smoke are not ready. The four Keychain items, exact Service Auth policy, four private-Worker guard settings, and a fresh one-shot Founder control file are absent. Missing or invalid setup fails closed.

This batch performed no Cloudflare login, Keychain value read, token creation, Access policy change, deployment, production request, production mutation, cohort activation, prospective collection, or recommendation activation. The public Worker and Dashboard assets remain protected and unchanged.

Automatic engineering push remains separate from production deployment. Deployment still requires a separate Founder authorization naming the exact commit, tree, private environment, release scope, and rollback plan. Current deployment recommendation: `DO_NOT_DEPLOY`.
