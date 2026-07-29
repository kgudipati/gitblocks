# GitBlocks persistence package

Private strict-ESM PostgreSQL adapter for GitBlocks' shared public OSS catalog.
It persists immutable candidate identity, source-aware evidence, limitations,
material unknowns, lifecycle events, and exact candidate-dossier snapshots.

The adapter exposes explicit client creation/closure, explicit checked forward
migrations, public catalog writes, exact historical snapshot loading, and one
complete active-material selection operation. Active selection uses every
applicable evidence-world timestamp and excludes a limitation or unknown when
any referenced evidence is superseded or invalidated at the cutoff.

Configuration and credentials are injected. Imports perform no I/O; the
package owns no singleton, environment read, implicit migration, logging,
dynamic SQL identifier, organization model, tenant scope, expiry, purge,
deletion, tombstone, RLS policy, transport, provider, worker, model, or
deployment behavior.

Use `pnpm db:verify` for the exact PostgreSQL 18.4 no-volume verification path.
ADR 0004 and `docs/plans/0011-evidence-persistence.md` own the schema,
concurrency, migration, security, and forward-recovery decisions.
