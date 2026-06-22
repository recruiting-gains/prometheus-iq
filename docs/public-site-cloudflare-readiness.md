# Prometheus Public Website Readiness

## Verified

- The public website builds independently from the private Prometheus IQ app.
- The Cloudflare upload entry file is `dist-public/index.html`.
- The upload contains only the public HTML, bundled JavaScript, public brand image, logo, and `_headers` security rules.
- Desktop and phone layouts render without horizontal overflow.
- The Three.js canvas renders and changes over time.
- The original orange field route and the second teal intelligence layer move with scroll.
- The founder manifesto is readable on desktop and phone.
- Email and Instagram calls to action use the approved Prometheus accounts.
- No field backups, private app data, GPS records, source maps, API keys, or secrets are included.

## Before Deployment

1. Review the wording and founder manifesto one final time.
2. Build with `npm run build`.
3. Upload only `deploy/Prometheus_Public_Website_Cloudflare.zip` to the separate public Cloudflare Pages project.
4. Test the generated public URL on a phone not logged into the private Prometheus IQ application.
5. Add the final public URL to the Instagram bio after verification.

## Later

- Add final Open Graph sharing metadata after the permanent public URL is known.
- Connect a custom domain when the business is ready to purchase one.
- Keep the private Prometheus IQ Worker protected by Cloudflare Access.
