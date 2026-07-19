# Route IQ Commercial Workspace Data v1

This Data-owned foundation defines configuration-driven Route IQ workspaces and a
governed, redacted evidence export for Codex analysis. It does not activate a
workspace, authorize production collection, change recommendation influence, or
replace any canonical evidence store.

Canonical assets:

- `route-iq-commercial-workspace-v1.schema.json` defines the strict workspace
  configuration contract.
- `route-iq-commercial-workspace-registry-v1.json` registers the active Founder
  research workspace, an inactive historical workspace, and one synthetic
  non-fitness validation workspace.
- `fitness-connection-evidence-preservation-v1.json` freezes repository evidence
  paths, byte sizes, and SHA-256 hashes without copying or rewriting evidence.
- `route-iq-commercial-workspace-registry.mjs` validates configuration and makes
  exact-principal, fail-closed authorization decisions.
- `governed-codex-evidence-bundle.mjs` creates deterministic, allowlist-only
  analysis bundles. Codex is an analysis consumer, never the production database.

Generate the governed Founder research bundle with one command:

```sh
node scripts/build-route-iq-governed-codex-evidence-bundle.mjs
```

The default output is `/tmp/route-iq-governed-codex-evidence-bundle.json` with
mode `0600`. Use `--output /absolute/path.json` to select another local path.
The builder emits only a non-sensitive receipt; it never prints evidence records.
