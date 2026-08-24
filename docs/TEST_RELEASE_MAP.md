# Test And Release Map

This is the current routing authority for Prometheus repository verification. `tests/test-suites.v1.json` is the machine-readable classification. `scripts/run-test-suite.mjs` validates that every tracked `*.test.mjs` file belongs to exactly one suite before execution.

## Canonical Suites

| Suite | Owner | Purpose |
| --- | --- | --- |
| `test:core` | Product subsystem owners | Shared CRM, data, intelligence, administration, integrations, and cross-industry behavior used by live products. |
| `test:public` | Website / CRM / Infrastructure | Public website, gym landing page, intake, attribution, public Worker, public workflow, and public rollback boundaries. |
| `test:private` | Dashboard / Intelligence / Infrastructure | Authenticated workspace, roles, field sessions, private Worker, private workflow v2, and private rollback boundaries. |
| `test:security` | Security / Aegis | Access, tenant isolation, secrets, callback security, repository integrity, dependency/toolchain, and fail-closed controls. |
| `test:release` | Infrastructure / Overwatch | Exact identity, provenance, artifact, active workflow, production-readiness, and rollback contracts. |
| `test:historical` | Historical owners | Dormant-feature and historical evidence tests excluded from normal qualification. Run only for work that intentionally changes their preserved source or evidence. |

`npm test` runs the five active suites once each. It has no implicit `pretest`. Builds, lint, typecheck, Aegis, and other command-line verifiers are explicit workflow steps rather than nested suite side effects.

## Change Routes

| Change | Minimum local route | Hosted route | Artifact |
| --- | --- | --- | --- |
| Documentation/control plane | affected active suites, lint/typecheck if code changed, build only for runtime comparison | Early GitHub Handoff | qualification evidence only |
| Public source/config/assets | core + public + security + release, one public build | Qualify Prometheus Public Worker | immutable public release + forward rollback |
| Private source/config/assets | core + private + security + release, one private build | Qualify Prometheus Private Worker v2 | immutable private release + forward rollback |
| Shared public/private runtime | core + public + private + security + release, one build per artifact | both application qualifiers | two independent immutable artifacts |
| Security-only | security plus directly affected public/private suite | Security Gates; application qualifier only when runtime changes | evidence or affected application artifact |
| Historical/manual | `test:historical` with affected verifier | none unless the task separately changes active control/runtime | no production artifact |

An unexpected public or private normalized digest change in a control-plane batch is `RUNTIME_DRIFT`, not deployment authority.

## Retained Workflows

Exactly seven workflow files are active:

1. `security-gates.yml` - pull request and `main` security/integrity check.
2. `early-github-handoff-v1.yml` - exact commit/tree clean-runner qualification for control-plane work.
3. `qualify-prometheus-public-worker.yml` - exact public release build, verification, freeze, and upload.
4. `deploy-prometheus-public-worker.yml` - protected public deployment from a pinned artifact; no rebuild.
5. `qualify-prometheus-private-worker-v2.yml` - exact private release build, verification, freeze, and upload.
6. `deploy-prometheus-private-worker-v2.yml` - protected private deployment from a pinned artifact; no rebuild.
7. `inspect-prometheus-worker-production-identity.yml` - read-only production identity inspection.

Dependabot configuration is not an executable workflow. Routine compatible minor/patch updates are grouped; major upgrades remain individually reviewed; security updates remain distinct.

## Release Rules

- Git `main` is source authority, GitHub is qualification authority, and Cloudflare is runtime authority.
- Qualifiers accept only the exact synchronized `main` commit and tree, first attempt, expected actor, branch, and current Worker prerequisites.
- Public and private release lanes remain independent. A workflow may never target the other Worker.
- Deployment downloads the exact hosted-qualified artifact by run and artifact identity, verifies manifest/content/transport hashes, preserves bindings and migrations, and does not rebuild.
- Current and immediately prior rollback artifacts remain protected. Critical rollback is forward-compatible and application-specific.
- Security Gates owns active repository-integrity coverage; no standalone integrity workflow is required.
- A test may occur in only one active suite. A verifier may not launch that same test again.
- Production smoke checks are read-only unless a separate authorization explicitly permits a controlled write.
