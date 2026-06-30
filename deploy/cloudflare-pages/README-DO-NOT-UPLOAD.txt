This folder is the prepared Prometheus IQ Cloudflare Pages build.

Static-only upload items:

- index.html
- sw.js
- manifest.webmanifest
- _headers
- icons/

Production Worker deployment now uses the root Wrangler config:

npx wrangler deploy --keep-vars

The Worker entry point is workers/prometheus-iq-worker.js and serves this folder through the ASSETS binding while running /api/* routes through the Worker first. Do not upload this folder manually when releasing the Meta Instagram OAuth callback route.

Do not upload this README file. Do not upload the project docs, legal, evidence, or backups folders.
