# Meta / Instagram Business Setup

Date: 2026-06-30
Owner: Prometheus Social Media

## Official Documentation

- Meta Instagram Platform: https://developers.facebook.com/docs/instagram-platform/
- Instagram API with Facebook Login: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/
- Instagram insights API reference: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/reference/ig-user/insights
- Meta permissions reference: https://developers.facebook.com/docs/permissions/
- Meta Graph API versioning: https://developers.facebook.com/docs/graph-api/overview/versioning/

## Required External Setup

1. Confirm `@prometheus.iq` is an Instagram professional or business account.
2. Create or open the Prometheus Meta Developer app.
3. Add the Instagram API product required for account insights.
4. Connect the Instagram account to a Facebook Page if the selected API flow requires Facebook Login.
5. Configure OAuth redirect URLs for the backend-owned integration surface.
6. Request only read/analytics permissions for v1.
7. Complete App Review for production permissions if Meta requires it.
8. Store access tokens only in backend environment variables or Infrastructure-owned secret storage.
9. Verify backend health/status without printing token values, token suffixes, app secrets, or raw authorization headers.

## OAuth Callback URL

Reserve this production callback URL for the Meta app:

```text
https://prometheus-iq.prometheusrouteiq.workers.dev/api/oauth/meta/instagram/callback
```

This route is an Infrastructure/Integrations contract placeholder only in v1. This task does not implement live OAuth login, callback handling, token exchange, token refresh, or live provider verification.

## Initial Permissions

Start with read-only analytics permissions:

- `instagram_basic`
- `instagram_manage_insights`
- `pages_show_list`
- `pages_read_engagement`

Permission names and product requirements can change. Re-check Meta's official documentation before production OAuth setup or App Review submission.

## Backend Environment Variables

Use placeholders only in documentation:

```text
META_APP_ID=replace-in-backend-secret-store
META_APP_SECRET=replace-in-backend-secret-store
META_OAUTH_CALLBACK_URL=https://prometheus-iq.prometheusrouteiq.workers.dev/api/oauth/meta/instagram/callback
INSTAGRAM_BUSINESS_ACCOUNT_ID=replace-in-backend-secret-store
INSTAGRAM_ACCOUNT_HANDLE=@prometheus.iq
INSTAGRAM_ACCESS_TOKEN=replace-in-backend-secret-store
INSTAGRAM_GRANTED_SCOPES=instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement
INSTAGRAM_TOKEN_EXPIRES_AT=replace-with-iso-expiration-if-known
INSTAGRAM_CONNECTION_VERIFIED_AT=replace-after-backend-verification
META_GRAPH_API_VERSION=v21.0
```

These values must not be committed, logged, printed in health checks, pasted into Codex chat, or exposed to frontend JavaScript.

`META_INSTAGRAM_ACCESS_TOKEN` is supported as a backend-only fallback token variable, but `INSTAGRAM_ACCESS_TOKEN` is the preferred canonical variable for Instagram analytics v1.

## Runtime States

Infrastructure exposes safe placeholder states only:

- `not_configured`: required Meta app, callback, or Instagram account variables are missing.
- `configured`: reserved for setup surfaces that need to acknowledge configuration without token readiness.
- `permission_required`: token exists but required analytics permissions are missing.
- `token_missing`: Meta app/account setup exists, but no backend access token is configured.
- `token_expired`: token expiration metadata shows the token is expired.
- `verification_pending`: token and permissions are present, but backend verification has not been completed.
- `connected`: backend token, permissions, account ID, callback URL, and verification timestamp are present.
- `error`: runtime configuration is malformed, such as non-HTTPS callback URL or invalid date metadata.

Only `connected` may make live Meta Graph API calls. All other states must return safe mock/sample analytics or status metadata without contacting Meta.

## v1 API Use

The v1 provider adapter is read-only and may request:

- account username
- follower count
- media count
- reach
- profile views
- website clicks

It does not:

- publish posts
- send DMs
- reply to comments
- scrape
- automate browsers
- store passwords

## Verification Checklist

- `getInstagramBusinessProviderStatus()` reports `not_configured`, `token_missing`, `permission_required`, `token_expired`, or `verification_pending` until backend verification is complete.
- `fetchInstagramBusinessSnapshot()` returns mock/sample analytics for every non-`connected` runtime state.
- Only `connected` runtime state can call Meta Graph API.
- Provider errors are sanitized.
- No token appears in response payloads.
- No token appears in request URLs; backend requests use the `Authorization: Bearer` header.
- No frontend code imports or calls provider adapters directly.
- Infrastructure confirms production secrets and route protection before live provider use.
