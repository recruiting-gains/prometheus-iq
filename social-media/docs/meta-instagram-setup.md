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
INSTAGRAM_ACCESS_TOKEN=replace-in-backend-secret-store
INSTAGRAM_BUSINESS_ACCOUNT_ID=replace-in-backend-secret-store
INSTAGRAM_ACCOUNT_HANDLE=@prometheus.iq
META_GRAPH_API_VERSION=v21.0
```

These values must not be committed, logged, printed in health checks, pasted into Codex chat, or exposed to frontend JavaScript.

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

- `getInstagramBusinessProviderStatus()` reports `mock_sample` when credentials are absent.
- `fetchInstagramBusinessSnapshot()` returns mock/sample analytics when credentials are absent.
- Provider errors are sanitized.
- No token appears in response payloads.
- No frontend code imports or calls provider adapters directly.
- Infrastructure confirms production secrets and route protection before live provider use.
