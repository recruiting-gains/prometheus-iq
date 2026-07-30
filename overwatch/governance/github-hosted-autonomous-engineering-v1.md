# GitHub-Hosted Autonomous Engineering Governance v1

Owner: Prometheus Overwatch

Status: source governed; hosted demonstration pending.

## Accepted source

Infrastructure owns the seven workflow, runtime, contract, test, verifier, and
documentation files introduced by commits
`f3657a5184b73612d65a92bfd9f66468e4e1f568` and
`4b11e8b724b506b5236ad80e72470bb0471a4df7`, with the secret-scan repair in
`7e04cbf028fc69597771320a5797390bdcf255a2` and the independent-review closure in
`df10a226cfa48d983e794b67d21250b185fd65f0`. Overwatch records their exact hashes
in the adjacent JSON governance record and owns only this governance, its
verifier, and tests.

`package.json` is neither modified nor admitted as a repair path. The hosted
full suite invokes the Infrastructure and Overwatch gates directly, preserving
all historical release-wiring evidence without a compatibility exception.

The candidate is a no-product-change successor of
`278deb57eef0558fbf2666ed6962cbbd73dad42d`. Private Workflow v2 continues to
require the byte-identical forward payload
`3bb6d677c4ad6b6811ba1efc1c643abd7728c584707a26dcef26c887f2718328`.
No public or private application source is changed by this project.

## Hosted release boundary

One exact Founder `workflow_dispatch` from `main` starts the complete hosted
chain. Every job gates the checked-out commit, tree, and `origin/main` before
repository code executes. The workflow performs one clean full suite, permits
one fresh-runner recovery only for classified dependency-install or
dependency-audit transport failure, builds once, freezes one artifact, and
independently downloads and verifies it. Production secrets first become
available only after qualification, artifact verification, controlled rollback,
and independent recovery verification all pass.

Production access is limited to the existing
`prometheus-private-worker-production` environment. The target is fixed to
`prometheus-iq`; `prometheusrouteiq-website` is read only and must retain its
exact version. The deployment process receives only the six governed
Cloudflare settings. The GitHub artifact token is step-scoped and is rejected
if inherited by the deployment child.

## Rollback and repair

Before deployment, a credential-free dry run and controlled in-memory critical
failure prove one forward attempt and one forward-compatible rollback. A fresh
runner independently verifies that evidence. A real critical acceptance
failure uses only the qualified rollback payload; native rollback and automatic
deployment retry remain prohibited.

Source and test defects fail closed. They cannot be edited by the workflow
because it has no repository-write or self-dispatch permission. This is the
security boundary, not a hidden laptop dependency on the successful path.
Owner-produced successors are limited to the exact Infrastructure and
Overwatch paths, six commits, sixteen files, 6,000 changed lines, 524,288 patch
bytes, 524,288 resulting file bytes, three Infrastructure repair generations,
210 aggregate job-timeout minutes, and zero workflow recursion. The dispatched
repair count must equal the verified Infrastructure commit count minus one, and
the final commit must be Overwatch-owned.

Commit author strings are provenance labels, not authentication. Authorization
comes from the exact Founder actor and triggering actor, `main`, the exact
commit and tree, the exact workflow context, and the bounded owner/path topology.

## Acceptance

Overwatch accepts the source only after the complete local exact-tree suite,
normal fast-forward push, GitHub-hosted qualification, independent artifact
download, private deployment, authenticated desktop and 390x844 mobile
acceptance, controlled rollback demonstration, independent recovery proof,
final replay of deployment, rollback, recovery, and production evidence, Worker
identity checks, and protected-state verification all pass.

Until then, the status remains `SOURCE_GOVERNED_DEMONSTRATION_PENDING`.
