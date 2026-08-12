# GitBlocks persistence package

Private strict-ESM PostgreSQL adapter for GitBlocks' shared public OSS catalog.
It persists immutable candidate identity, source-aware evidence, limitations,
material unknowns, lifecycle events, and exact candidate-dossier snapshots.
It also persists exact curator-approved repository artifacts, lossless chunks,
normalized closed artifact-set entries, deterministic repository-interview
requests, model-execution history, and successful repository interviews with
their normalized semantic members. Migration `0005` additionally stores one
coherent immutable retrieval-serving root, 150 per-candidate profile payloads,
150 per-candidate retrieval-metadata payloads, and a separate current selector.

`publishServingCatalogSnapshot` validates the existing profile and metadata
contracts, their shared catalog/repository identities, all immutable record
digests, and exact database candidate provenance before selecting a complete
snapshot. Exact replay is idempotent; immutable identity conflicts fail closed.
`loadServingCatalogSnapshot` loads the current or named historical snapshot in
a repeatable-read, read-only transaction, reconstructs both existing authority
contracts, and returns the metadata binding required by
`createCandidateRetrievalEngineV1(...)`. Persistence does not import retrieval.

The `gitblocks_serving` group is `NOLOGIN`, non-superuser, and receives only
schema usage plus SELECT on the four serving tables. It has no write, DDL,
migration-history, broader catalog/evidence, or direct function-execution
privilege. A deployment owner creates a login and grants only that group.

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
and relies on deferred database closure checks before commit. First insertion
requires catalog provenance matching the durable candidate row and provider
provenance matching the incoming artifact set; catalog provenance also has a
database-level composite foreign key. A conflict with an unreferenced artifact
requires exact complete-record digest equality before first publication. Once
a published set references the artifact, an intrinsic-core match may reuse its
historical first-materialization timestamp and provenance across a legitimate
repository rename.

`loadRepositoryArtifact` requires the caller to name the set's supported
`exact-lines-v1` chunker version and filters the chunk query by both artifact ID
and chunker version. Artifact identity remains independent of chunker version.

Repository-interview persistence exposes exactly three operations:
`publishRepositoryInterviewExchange`, `findReusableRepositoryInterview`, and
`loadRepositoryInterviewExchange`. Publication reparses every contract before
opening its transaction, verifies the exact artifact-set identity, serializes
the request/execution authority with an advisory transaction lock, and appends
one atomic exchange. A failed execution stores only its immutable request and
safe execution record. A successful execution stores exactly one interview
and closed citation, claim, limitation, contradiction, and unknown rows.

Each of the three roots and five semantic member families retains its exact
parsed contract as canonical JSONB plus bounded normalized ownership/query
columns. Deferred checks prove root/member equality, contiguous ordinals,
request/execution/interview provenance, successful ownership, and citation
membership in a `present` artifact from the exact set with an inclusive
line-closed range. Prompt text, alias bindings, artifact bodies, raw provider
output/errors, and evaluation review are not persisted.

Historical reads treat both representations as authority. The execution's
normalized candidate and artifact-set context is reconciled with its loaded
request. Typed citation, claim, limitation, contradiction, and unknown rows
independently reconcile parent ownership, ordinal, stable ID, query fields,
digests, and canonical payload with the interview root. Any mismatch fails as
the bounded `persistence.corrupt-record` on publication reload, historical
load, and reuse; normalized drift is never ignored, repaired, or skipped.

Exact replay is idempotent only when stable IDs, full identity/record digests,
normalized columns, canonical payloads, and complete nested membership agree.
Collisions and partial history fail closed without repair. Reuse considers
only complete successful `normal` executions and selects the earliest
completion then lexical execution ID. Failed and `forced` executions remain
immutable history but are not automatic reuse candidates.

Configuration and credentials are injected. Imports perform no I/O; the
package owns no singleton, environment read, implicit migration, logging,
dynamic SQL identifier, organization model, tenant scope, expiry, purge,
deletion, tombstone, RLS policy, transport, provider, worker, model, or
deployment behavior.

Migration 0004 adds exactly eight product tables. All are append-only for both
owner and runtime connections; the non-owner runtime role receives only
`SELECT` and `INSERT`, and public receives no schema, table, or function
privilege. Use `pnpm db:verify` for the exact PostgreSQL 18.4 no-volume
verification path.
Migration `0005` is additive: the full schema has 29 public product tables and
five checked migrations. Published serving roots and candidate rows reject
update, delete, and truncate; the mutable singleton selector can point only to
a complete root. See ADR 0011 and Plan 0036 for rollout and forward recovery.
Milestone 6 and migration 0004 are accepted and byte-frozen. Evaluation audit
records and gate reports remain outside this adapter and outside production
tables.
The non-owner runtime role may read, but cannot mutate, migration history so
runtime composition roots can verify the exact applied inventory.
ADR 0004 and `docs/plans/0011-evidence-persistence.md` own the schema,
concurrency, migration, security, and forward-recovery decisions.
