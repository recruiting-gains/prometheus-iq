# Route IQ Forward-Compatible Rollback Candidate v1

Batch: `BATCH-20260714-001`

Owner: Prometheus Infrastructure

Status: prepared for a future Founder-authorized normal forward deployment; not deployed and not pushed by this subsystem.

## Purpose

Cloudflare applied the SQLite Durable Object migration `route-iq-prospective-shadow-sqlite-v1` to the private `prometheus-iq` Worker. The pre-migration Worker version cannot be restored with a native version rollback because it does not export the migrated class or carry that migration history. The safe rollback shape is therefore a new forward deployment that restores the application behavior from private Worker version `a376d0fa-bddc-498c-8f15-32eb025ee08c` while retaining the stateful compatibility surface.

Application behavior is sourced from immutable commit `796f59ce7ee91538211f3050dc0b3050889ee935`, tree `ab8c11e8ef3a68a419d23501675b40a279172e3a`. The builder extracts that exact Git tree instead of copying current Dashboard, Data, or Intelligence files. Its Worker source and private Dashboard asset are pinned to SHA-256 `d5987bdf417c5b339e2d78473dc009bfe9317573f799fca3817b198fed6bc43c` and `e654e325e7370e7d67a7c36a17307a673ef30199573f4a899cb3c3576ac934b3`.

## Compatibility Surface

The generated package preserves:

- private Worker target `prometheus-iq`;
- binding `ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR`;
- exported class `RouteIqProspectiveShadowCoordinator`;
- existing migration tag `route-iq-prospective-shadow-sqlite-v1` with `new_sqlite_classes`;
- protected secret references `ROUTE_IQ_PROSPECTIVE_SHADOW_AUTHORITY_KEY` and `ROUTE_IQ_PROSPECTIVE_SHADOW_AUTHORITY_KEY_VERSION`;
- all prior private Worker bindings, assets, Access boundary, Aegis controls, observability, and field-session workflow from version 52.

It does not declare `deleted_classes`, delete the namespace, rotate or remove secrets, or include the public Website Worker configuration.

The compatibility class performs no initialization, SQLite access, storage access, projection, sealing, evaluation, or recovery. Every retained RPC returns the same deterministic disabled receipt. The version-52 Worker entrypoint has no prospective endpoint and cannot resolve the binding, so expected Durable Object requests and writes are both zero.

## Collection and Influence

`ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION` is explicitly `OFF` in the candidate config. No cohort is configured. Recommendation influence remains `OFF`. The package has no representative-facing shadow output, notification, route-order change, automatic action, or operational influence.

## Reproducible Package

Prepare a package from committed Git objects:

```bash
node scripts/build-route-iq-forward-rollback-candidate.mjs --dry-run
```

The builder:

1. extracts the pinned version-52 Git tree;
2. preserves the exact prior Worker as `workers/prometheus-iq-previous-behavior.js`;
3. adds a thin Infrastructure wrapper exporting the prior default Worker and the inert compatibility class;
4. replaces all root Wrangler configs with the private candidate config;
5. confirms pinned source and asset hashes;
6. records candidate HEAD, tree, content digest, and boundaries in an ignored build manifest;
7. runs `wrangler deploy --dry-run --strict --keep-vars` only when `--dry-run` is requested.

The builder contains no upload, traffic, rollback, secret mutation, or production-data command.

## Future Deployment Guard

A future deployment requires separate Founder authorization naming the exact candidate commit, tree, environment, and generated package digest. Infrastructure must first confirm the remote private Worker version expected by that authorization, all existing binding names, both protected secret names, collection `OFF`, and an unchanged public Worker. Deployment must use a normal forward `wrangler deploy` with strict conflict checking and variable preservation. Native Cloudflare rollback is prohibited.

After any future deployment, verify the exact new version, 100% intended traffic, prior Dashboard behavior, Access/Aegis, field-session workflows, collection `OFF`, zero Durable Object calls/writes, no prospective records/evaluations, no representative shadow output, and an unchanged public Worker.

## Monitoring, Budget, and Cost

Worker observability stays enabled. The version-52 application has no route to the coordinator and the inert class never touches storage, so expected incremental Durable Object requests, rows, storage, and monthly cost are zero. Any nonzero coordinator request count after a future rollback deployment is an operational alert and must not be treated as evidence.

## Rollback Manifest

- Retained dark source: commit `3e64e6ad765607b7fd585fb9d88e4ec6b65a47a5`, tree `66eeeba915d080cfa0678c682c7b2951102e6282`, Worker version `43c614e8-ed24-413b-9901-27241e720094`.
- Restored behavior source: commit `796f59ce7ee91538211f3050dc0b3050889ee935`, tree `ab8c11e8ef3a68a419d23501675b40a279172e3a`, Worker version `a376d0fa-bddc-498c-8f15-32eb025ee08c`.
- Runtime rollback mechanism: a newly uploaded normal forward Worker version built from the verified package.
- Stateful handling: preserve migration, class, binding, namespace, secrets, and any existing data; never use a deleted-class migration.
- Source rollback: use new forward-revert commits for Infrastructure-owned candidate files; never reset, rebase, force-push, or rewrite history.
- Data handling: no automatic deletion, rewrite, projection, replay, or migration.
- Immediate disable: collection remains explicitly `OFF` before, during, and after any authorized forward deployment.

No Worker version was uploaded, no traffic changed, no production data was touched, and no deployment is authorized by this candidate.
