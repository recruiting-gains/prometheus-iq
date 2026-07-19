# Route IQ public CRM Founder Access v1

## Exact Access boundary

Create one Cloudflare Access self-hosted application with these exact nonsecret identifiers:

- Application: `Route IQ Founder CRM`
- Domain: `prometheusrouteiq.com/api/partner-intake/founder/*`
- Session duration: `1h`
- Policy: `Route IQ Founder CRM - Cruz Only`
- Decision: `Allow`

Use one exact Cruz email identity verified by one exact configured identity provider. The policy must not contain Bypass, Everyone, an email-domain wildcard, a display name, or a service token. The public website and `POST /api/partner-intake` remain public. Only the Founder GET endpoints beneath `/api/partner-intake/founder/*` are protected.

Cloudflare Access path specificity keeps the Founder application separate from the public application surface. The Worker independently validates the Access JWT signature, issuer, audience, expiry, and the SHA-256 of the immutable `sub` claim. A display name or email header alone never grants Worker access.

Official behavior references:

- <https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/>
- <https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/>
- <https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/>
- <https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/>

## Attended principal mapping

The live application and policy must be created and reviewed first. Then create a temporary owner-only `0600` JSON setup file outside the repository. It has exactly these fields:

```json
{
  "version": "route-iq-public-crm-founder-access-setup.v1",
  "applicationName": "Route IQ Founder CRM",
  "applicationDomain": "prometheusrouteiq.com/api/partner-intake/founder/*",
  "policyName": "Route IQ Founder CRM - Cruz Only",
  "teamDomain": "REDACTED_PROTECTED_VALUE",
  "audience": "REDACTED_PROTECTED_VALUE",
  "founderEmail": "REDACTED_EXACT_CRUZ_EMAIL",
  "identityProviderId": "REDACTED_EXACT_IDP_UUID",
  "githubRepository": "PrometheusRouteIQ/prometheus-iq",
  "githubEnvironment": "prometheus-public-worker-production",
  "nonce": "32_LOWERCASE_HEX_CHARACTERS",
  "createdAt": "CURRENT_CANONICAL_UTC_TIMESTAMP",
  "expiresAt": "CANONICAL_UTC_TIMESTAMP_WITHIN_30_MINUTES"
}
```

Run from a native controlling terminal:

```sh
node scripts/run-cloudflare-public-crm-founder-access.mjs configure-principal /absolute/path/to/the/0600/setup.json
```

Type the exact phrase shown by the command. The tool opens the exact application with `cloudflared`, verifies the signed token in memory, verifies the exact Founder email, hashes only the verified immutable `sub`, and writes the team domain, audience, and subject hash directly to the protected GitHub environment through `gh secret set` stdin. It prints only a fixed status. It never persists or displays the JWT or raw subject. On success it removes the temporary setup file.

The tool fails closed if any of the three setting names already exists. A partial GitHub write is a manual-review condition; do not rerun until the environment names are reconciled. Do not place protected values in command arguments, shell history, screenshots, chat, or repository files.

## Verification and rollback

Before public deployment, confirm by name only that the protected environment contains all five required deployment setting names and that its deployment branch rule is `main`. An unauthenticated GET and HEAD to the Founder path must receive a Cloudflare Access challenge, while public pages and the public request POST remain outside Access.

If the Founder mapping must be revoked, remove the exact Founder Allow policy or disable the Access application first, then remove the three environment setting names. A Worker deployment with missing or invalid Founder settings fails closed with no Founder CRM access. This rollback does not delete CRM records or alter the Durable Object.

This source batch creates no Access application, policy, principal mapping, GitHub setting, Worker version, or production record.
