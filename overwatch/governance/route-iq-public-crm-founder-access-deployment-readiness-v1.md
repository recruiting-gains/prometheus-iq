# Route IQ Public CRM Release Provenance Recovery v1

Batch `BATCH-20260719-005` reconstructs the unpushed public CRM release from clean `origin/main` at `f0bbad58e0b9ff2cf99b8e55a875f65ec14f35c7`. The failed local chain, index, worktree, commit metadata, and ownership evidence are preserved under `refs/archive-local/BATCH-20260719-005`. That namespace is local-only and must never be pushed, merged, deployed, or treated as release history.

The valid CRM commit `3bea33b463ac941ad9fc7d88a1776d6b5de5d9b5` and the three valid Infrastructure commits `2be88021bfc9107c200a2fef5fd065da875e52c6`, `d9c1b3322c5ad2fb12f3ae5dbfc7f42e807d61a8`, and `1791728ad6a6777e828220dac6a7e93b207f95bc` are preserved unchanged. The misattributed local commit `0aac4732670bde05596c1c8cde60c533172663f7` and neutralization commit `5a3339f465cbcd81b1c7eeca5c9d384afbcf4d1c` are excluded. Prometheus Infrastructure independently reconstructed the six-file rollback repair as `1490d4722867a5e203eb159ffbaf01c9645fb127`; every reconstructed blob is byte-identical to the archived corrected worktree.

Prometheus CRM owns the HTTP and identity contract. Prometheus Infrastructure owns the Access application design, runtime setting transport, public-only manual deployment workflow, guarded smoke profile, and forward rollback artifact. Prometheus Website and Prometheus Data required no implementation changes. Prometheus Overwatch owns this governance record and independent verification only. No subsystem implementation is attributed to Overwatch.

The rollback artifact now hashes deployable runtime scope instead of unrelated repository governance. Its governed SHA-256 is `4636e18bd3d99a803803a7ab78dcd2dbf634de8d9e34386c5c43f4df6fcb1ad1`; runtime, configuration, or selected public-asset drift still fails closed.

The public website and `POST /api/partner-intake` remain public. Cloudflare Access protects only `/api/partner-intake/founder/*`, and the Worker independently verifies the Access issuer, audience, signature, and SHA-256 digest of the immutable `sub` claim.

The exact live Access application and policy are recorded by safe identifiers in the JSON governance artifact. No email selector, identity-provider identifier, team domain, audience, JWT, raw subject, or secret value is stored here. `Everyone`, `Bypass`, display-name authorization, and service-token authorization are prohibited.

No production or credential access occurred during recovery. The previously recorded public Worker version is `a0296f92-4427-4cea-a3e2-9a5e05a4596c`, and the previously recorded private Worker version is `b8cba784-dfd3-4f8e-8356-816cccf6aecc`; this batch did not revalidate those values against Cloudflare. Prospective collection and recommendation influence remain off, with zero active cohorts.

The release remains on hold until Cruz completes one attended Access authentication and the three value-free runtime setting names are present in the protected `prometheus-public-worker-production` GitHub environment. Deployment remains separately Founder-authorized.
