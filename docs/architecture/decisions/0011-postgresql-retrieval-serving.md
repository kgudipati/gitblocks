# ADR 0011: PostgreSQL-backed retrieval serving snapshots

- Status: accepted for implementation under Issue #36
- Date: 2026-08-11
- Decision owners: GitBlocks maintainers
- Governing issue:
  [#36 — Recovery R3: Serve retrieval catalog from PostgreSQL](https://github.com/kgudipati/gitblocks/issues/36)
- Execution plan:
  [Recovery R3 PostgreSQL retrieval serving](../../plans/0036-postgresql-retrieval-serving.md)
- Related decisions:
  [ADR 0003](0003-product-contract-kernel.md),
  [ADR 0004](0004-postgresql-evidence-persistence.md),
  [ADR 0008](0008-artifact-first-retrieval-foundation.md), and
  [ADR 0009](0009-production-retrieval.md)

## Context

Recovery R2 makes PostgreSQL the required durable shared source for hosted
catalog serving. Phase 9 retrieval is already executable and deterministic,
but its exact 150 `DeterministicCandidateProfileV1` records and 150
`CandidateRetrievalMetadataAuthorityV1` records exist only inside two
committed-file authority roots. Existing PostgreSQL tables preserve public
candidate identity, evidence, limitations, unknowns, lifecycle, dossiers,
artifacts, and interview history, but those meanings cannot reconstruct the
two retrieval inputs.

This is a concrete blocker for the planned hosted composition: a developer
cannot load durable shared catalog intelligence from PostgreSQL and construct
the accepted retrieval engine. Overloading evidence/dossier tables, running
offline collection at request time, or adding a search service would either
corrupt existing semantics or solve a problem R3 does not have.

## Decision

### Persist one coherent served snapshot

Add forward migration `0005` with exactly four serving tables:

- `serving_catalog_snapshots`: one immutable root binding the shared catalog,
  the profile-authority header and semantic digest, the metadata-authority
  header/snapshot/semantic digest, exact candidate count, publication time,
  and complete record digest;
- `serving_candidate_profile_records`: one validated profile JSONB payload and
  existing semantic profile digest per snapshot/candidate;
- `serving_candidate_retrieval_metadata_records`: one validated metadata JSONB
  payload and existing source-record digest per snapshot/candidate; and
- `serving_catalog_current_snapshot`: one singleton mutable selector pointing
  to the complete snapshot served now.

The two header JSONB values are storage projections of existing contract roots
with their candidate arrays removed. They are not external contracts or
competing DTOs. Full existing authorities are reconstructed before use and
must pass the existing contract parsers and digest functions.

The current V1 candidate count remains exactly 150. This is a current product
contract limitation, not a generalized database scale policy. A larger catalog
requires a separate versioned product change.

### Publication and immutable identity

Publication is one explicit read-write transaction. It validates and owns both
contract authorities before database work, proves their catalog binding and
candidate/repository identity closure, inserts the root and all 300 candidate
records with conflict comparison, asks PostgreSQL to prove exact record-set
closure, and changes the current selector only after that proof succeeds.

The semantic snapshot ID derives deterministically from the two authority
semantic digests and shared catalog binding. The root record digest additionally
binds the exact operator-supplied publication timestamp and stored headers.
Therefore:

```text
same semantic snapshot ID + same complete immutable root/records
  -> idempotent success

same semantic snapshot ID + changed root, publication metadata, or row
  -> persistence.conflict
```

Published roots and candidate rows reject update and runtime deletion/truncate.
Historical roots remain readable after selection changes. The selector may
move only to a root whose exact 150 profile and 150 metadata candidate sets are
present and equal. An incomplete root cannot commit and cannot become current.

### Loader and retrieval boundary

Add one concrete persistence operation that loads either the current selection
or an exact historical snapshot in a read-only repeatable-read transaction. It
uses stable candidate ordering, enforces row/count/digest/header/root closure,
reconstructs both existing authorities, reruns their parsers, and returns
owned contract values plus the root-authenticated expected metadata binding.
Missing or inconsistent state returns only existing value-free persistence
errors and never a partial authority.

`@gitblocks/persistence` does not import `@gitblocks/retrieval`. The future
composition supplies the accepted taxonomy and retrieval expansion and passes
the loaded values to `createCandidateRetrievalEngineV1`. Request handling then
uses only the immutable engine:

```text
startup / controlled refresh: PostgreSQL -> validate -> immutable engine
request: normalize -> retrieve
```

No request invokes database migration, bootstrap, ingestion, provider/model
collection, artifact/interview/materialization machinery, evaluation, Docker,
or authority generation.

### Offline bootstrap

Add one explicit operator command that reads only the accepted committed public
catalog, candidate-profile authority, and retrieval-metadata authority through
their existing parsers. It reuses the current catalog seed plan to persist
candidate identity and capability families, then calls the serving publication
operation. It has no provider, model, network, artifact, interview, repository
execution, profile generation, or metadata generation capability.

### Serving database role

Migration `0005` creates one `NOLOGIN` group:

```text
gitblocks_serving
```

It is non-superuser, non-`BYPASSRLS`, cannot create databases or roles, owns no
object, and receives only `USAGE` on schema `gitblocks` plus `SELECT` on the
four serving tables. It receives no write, migration-history, function-execute,
DDL, evidence, artifact, interview, or broader catalog-table privilege. A
deployment owner separately provisions a login and grants only this group.

The existing `gitblocks_persistence` writer receives only the serving table
privileges required to publish and select snapshots. No tenant, organization,
RLS, or generalized authorization system is introduced because all serving
records are shared public catalog state.

### Migration, rollout, and recovery

Migration `0005` is additive and forward-only. Migrations `0001` through
`0004` and all existing table meanings remain byte-unchanged. The generic
current migration verification advances to five migrations. Older dormant
artifact/materialization proof contracts that deliberately authenticate exact
migration `0004` remain historical and are neither widened nor executed by R3.

Rollout is migration, writer-login access, offline bootstrap, serving-login
access, read-only load proof, then later application composition. Old code
ignores the additive tables. New code fails closed before a current complete
snapshot exists. Code rollback leaves the tables unused. Data correction and
rollback publish/select another verified immutable snapshot; no published
record is rewritten and no destructive down migration is added.

## Consequences

### Positive

- PostgreSQL becomes the executable durable shared source for the current
  Phase 9 retrieval intelligence.
- Existing product contracts, digests, taxonomy, expansion, and pure retrieval
  behavior remain authoritative.
- Per-candidate rows preserve bounded conflict diagnosis and historical replay
  without normalizing 27 profile fields or duplicating one giant root blob.
- Atomic closure and a separate selector prevent partial state from becoming
  active while retaining immutable history.
- The future hosted request identity can be strictly SELECT-only.

### Costs and limitations

- Publication and load each process exactly 300 candidate rows and about 2.2
  MB of accepted JSON at the current corpus size.
- PostgreSQL 18 remains the only supported major.
- The current contract remains fixed at exactly 150 candidates.
- Bootstrap is the only R3 publication path; routine offline refresh is not yet
  connected to snapshot publication.
- Taxonomy and retrieval expansion remain separately injected accepted
  authorities rather than becoming new database blobs.
- R3 still does not provide a hosted application, MCP request, deployment, or
  target-conditioned recommendation journey.

## Security and validation

Stored JSONB and committed files are untrusted at their boundaries and must
pass existing parsers. SQL uses fixed schema-qualified tagged templates and
caller values are parameters. Persistence errors remain bounded and value-free.
Candidate content is inert and never executed. Integration runs through real
PostgreSQL 18 with non-owner writer and serving logins, proves read/write
privileges, incomplete/corrupt-state denial, idempotency/conflict/history, and
the complete accepted PostgreSQL-to-retrieval journey without live network or
model effects.

## Rejected alternatives

### Store both complete authority files as two root blobs

Rejected because it duplicates every candidate in opaque roots, weakens
per-candidate immutable conflict handling, and makes closure/history inspection
coarser without reducing the required validation.

### Normalize every profile and metadata field

Rejected because the existing versioned contracts already own those shapes and
the current loader needs whole candidate records. Field normalization would
create a competing schema and unnecessary migrations.

### Reuse evidence, dossier, artifact, or interview tables

Rejected because those tables own different evidence and optional-synthesis
semantics and cannot represent deterministic profiles or retrieval metadata
without corruption.

### Put persistence inside retrieval or add a repository abstraction

Rejected because retrieval is deliberately pure and the concrete PostgreSQL
adapter already owns storage. A future composition can depend on both without
a generic port or framework.

### Add PostgreSQL search indexes, full text, vectors, or a cache

Rejected because ADR 0009's current 150-candidate in-memory implementation
passes its performance bounds and no registered infrastructure trigger fired.

### Make `is_current` mutable on snapshot roots

Rejected because selecting a newer snapshot would rewrite immutable historical
roots. A singleton pointer states operational selection without changing
published records.
