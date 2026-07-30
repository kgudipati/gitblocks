# GitBlocks persistence package

Private strict-ESM PostgreSQL adapter for GitBlocks' shared public OSS catalog.
It persists immutable candidate identity, source-aware evidence, limitations,
material unknowns, lifecycle events, and exact candidate-dossier snapshots.
It also persists exact curator-approved repository artifacts, lossless chunks,
and normalized closed artifact-set entries.

The adapter exposes explicit client creation/closure, explicit checked forward
migrations, public catalog writes, exact historical snapshot loading, and one
complete active-material selection operation. Active selection uses every
applicable evidence-world timestamp and excludes a limitation or unknown when
any referenced evidence is superseded or invalidated at the cutoff.

Artifact persistence exposes one candidate-scoped write,
`publishRepositoryArtifactSet`, and the narrow historical reads
`loadRepositoryArtifact` and `loadRepositoryArtifactSet`. Publication validates
all contracts and reconstruction before opening one transaction, takes the
candidate advisory lock, uses conflict reloads for deterministic idempotency,
and relies on deferred database closure checks before commit. Existing records
retain their first materialization timestamps and provenance. First insertion
requires catalog provenance matching the durable candidate row and provider
provenance matching the incoming artifact set; catalog provenance also has a
database-level composite foreign key.

Configuration and credentials are injected. Imports perform no I/O; the
package owns no singleton, environment read, implicit migration, logging,
dynamic SQL identifier, organization model, tenant scope, expiry, purge,
deletion, tombstone, RLS policy, transport, provider, worker, model, or
deployment behavior.

Use `pnpm db:verify` for the exact PostgreSQL 18.4 no-volume verification path.
The non-owner runtime role may read, but cannot mutate, migration history so
runtime composition roots can verify the exact applied inventory.
ADR 0004 and `docs/plans/0011-evidence-persistence.md` own the schema,
concurrency, migration, security, and forward-recovery decisions.
