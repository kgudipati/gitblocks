# ADR 0004: PostgreSQL public evidence persistence

- Status: accepted; revised public-first decision
- Date: 2026-07-29
- Decision owners: GitBlocks maintainers
- Governing issue:
  [#11 — Phase 4: Establish immutable public evidence and dossier persistence](https://github.com/kgudipati/gitblocks/issues/11)
- Execution plan:
  [Phase 4 immutable public evidence and dossier persistence](../../plans/0011-evidence-persistence.md)
- Related decisions:
  [ADR 0001](0001-agent-native-delivery.md),
  [ADR 0002](0002-typescript-workspace-and-toolchain.md),
  [ADR 0003](0003-product-contract-kernel.md)

## Context

GitBlocks' first product loop needs public OSS evidence before it needs an
enterprise data platform:

```text
public repository ingestion
        -> immutable public evidence and dossiers
        -> retrieval and ranking
        -> repository-conditioned recommendation
```

The first version of this ADR modeled public and tenant records together and
added RLS, expiry, purge, tenant deletion, and tombstones. Independent review
found that design was not on the critical path. This revision removes that
unpublished surface and retains the smallest durable adapter needed by public
ingestion and retrieval.

Phase 4 stores only shared public catalog records. Phase 5/6 has no named
organization-persistence consumer in the repository or issue roadmap, so no
organization identity or dossier-reference table is created. Authentication,
authorization, private evidence, organizations, users, retention, and
deletion policy require a future application-owned use case and a separate
decision.

## Decision

### Package and dependency direction

Keep one private strict-ESM package:

```text
tools/evaluation-harness
        |
        v
@gitblocks/persistence
        |
        v
@gitblocks/contracts
        |
        v
@gitblocks/domain
```

`@gitblocks/persistence` is a concrete adapter, not an application port. It may
depend only on contracts, domain, Postgres.js, and approved Node APIs.
Configuration and credentials are injected. It reads no environment variables,
owns no singleton, performs no import I/O, emits no logs, and never migrates
implicitly.

A future application package owns persistence ports and authorization. It must
not import this adapter; a composition root will wire both sides.

### PostgreSQL version policy

Support PostgreSQL major 18 only. Migration apply/verify rejects servers whose
`server_version_num` is outside major 18. Production serving publication has a
minimum validated minor of 18.4: it accepts 18.4 and newer 18.x releases while
rejecting older 18.x releases and every other major. The minor floor records
validation coverage, not a dependency on a feature introduced by a specific
18.x minor.

Local and hosted verification use the official image at the exact reviewed
minor and multi-architecture digest:

```text
postgres:18.4-bookworm@
sha256:1961f96e6029a02c3812d7cb329a3b03a3ac2bb067058dec17b0f5596aca9296
```

PostgreSQL's
[versioning policy](https://www.postgresql.org/support/versioning/) supports a
major for five years and recommends the current minor. PostgreSQL
[18.4](https://www.postgresql.org/about/news/postgresql-184-177-1611-1515-1422-and-1325-released-3292/)
was released 2026-05-14. Managed providers may apply minor releases without
customer consent, so production preconditions must not require one exact minor
and turn provider maintenance into an outage. A reviewed ordinary change may
advance the local verification image's minor and digest together. Another
major requires compatibility evidence and an ADR update.

The local path uses no persistent volume, selects a random host port, waits for
`pg_isready`, requires an explicitly named test database, and removes the
container. A missing container engine fails; database tests never skip.

### Driver and SQL policy

Use `postgres@3.4.9` (Postgres.js) as the only new external dependency. Runtime
data access uses checked-in, schema-qualified SQL tagged templates with
parameterized caller values. Callers cannot supply schemas, tables, columns,
operators, order expressions, roles, policies, migration paths, or SQL
fragments. Runtime code does not use `sql.unsafe`.

The migrator alone executes the exact bytes of a checked-in checksummed SQL
file through the driver's raw-SQL facility. Migration files are reviewed
repository code, never caller or database values.

Postgres.js errors and rows are untrusted adapter inputs. Public errors use
GitBlocks-owned value-free codes and omit connection strings, credentials,
SQL, parameters, payloads, source URLs, provider detail, and stacks.

### Migration mechanism and recovery

Use one repository-owned forward-only migration inventory:

```text
0001_evidence_persistence.sql
0002_runtime_migration_verification.sql
```

Apply:

1. opens an explicit transaction;
2. sets bounded statement and lock timeouts;
3. verifies PostgreSQL major 18;
4. acquires one fixed advisory transaction lock;
5. bootstraps the dedicated `gitblocks` schema and migration-history table;
6. computes SHA-256 over the exact committed migration bytes;
7. rejects checksum/name/version drift, gaps, and unknown history;
8. applies pending SQL and records history in the same transaction; and
9. commits or rolls back the migration and history atomically.

Repeat apply is a verified no-op and concurrent migrators serialize. There are
no down migrations. Schema version 1 was rewritten only while its Phase 4
history was unpublished. Once that history was shared, the Phase 5 live-path
correction added migration 0002 to grant the runtime role read-only migration
verification without changing migration 0001. Recovery is a compatible code
rollback, corrective forward migration, or authorized restore; no destructive
operation is implemented in this phase.

### Record model

Use a hybrid representation:

- normalized columns own stable identity, candidate ownership, source kind,
  evidence timestamps, lifecycle references, exact snapshot membership,
  uniqueness, and indexes; and
- canonical JSONB stores the exact closed product value needed for product
  reconstruction.

Every immutable root stores a SHA-256 `record_digest` over every immutable
field, including package-owned creation metadata. A product payload alone is
not the idempotency record.

The public product tables are:

- `catalog_candidates`;
- `candidate_capability_families`;
- `evidence_observations`;
- `candidate_limitations` and `candidate_limitation_evidence`;
- `candidate_material_unknowns` and `candidate_unknown_evidence`;
- `evidence_supersessions`;
- `evidence_invalidations`;
- `candidate_dossier_snapshots`; and
- ordered evidence, limitation, and unknown snapshot-member tables.

`schema_migrations` is migrator-owned history rather than a product table.
There are no tenant, organization, expiry, deletion, purge, tombstone, or RLS
objects.

### Candidate identity and capability membership

Candidate identity is immutable and includes candidate ID, display name,
GitHub owner/repository, optional npm package, canonical identity payload,
complete record digest, and creation time. Case-insensitive expression indexes
make repository and package identities deterministically unique.

Current capability membership is the only mutable catalog classification.
Replacement serializes on a candidate advisory transaction lock, inserts only
missing families, deletes only removed families, and leaves unchanged rows
untouched. Snapshot creation verifies current membership under the same lock.
A snapshot stores its family independently and has no foreign key to mutable
membership, so later additions or removals cannot break history.

### Immutable records and idempotency

Candidate identity, evidence, limitations, unknowns, lifecycle events,
snapshots, exact references, and exact snapshot membership are immutable.
Runtime roles have no update grant; database triggers reject owner updates.

Insertion uses database uniqueness plus `INSERT ... ON CONFLICT DO NOTHING`
inside an explicit transaction:

```text
same stable ID + identical complete immutable record
  -> idempotent success

same stable ID + changed ownership, timestamp, metadata,
payload, cutoff, family, or ordered membership
  -> persistence.conflict
```

This remains race-safe for concurrent identical and conflicting writers.

### Evidence-world timestamps

Each evidence observation normalizes these queryable columns:

- `published_at` for immutable public source variants;
- `collected_at` for public sources and mutable official documentation;
- `validated_at` for approved validation;
- `freshness_as_of` for every variant; and
- `created_at` as immutable storage insertion metadata.

`evidenceCutoff` is an evidence-world cutoff. An observation is eligible only
when every applicable publication, collection, validation, and freshness time
is no later than the cutoff. `created_at` cannot substitute for those fields.
Database checks keep normalized columns coherent with canonical JSONB and with
the product chronology.

### Lifecycle

Corrections append new evidence. Supersession and invalidation append immutable
events with stable IDs, candidate ownership, reason codes, effective time,
creation time, and complete record digests.

Composite foreign keys require every lifecycle reference to belong to the same
candidate. Self-supersession is rejected. A trigger acquires the same candidate
advisory lock and performs a recursive reachability check, preventing
supersession cycles under concurrent insertion. Active selection applies events
by their effective timestamp. Original observations never change.

### Exact snapshots

Snapshot creation is one transaction. It:

1. parses the complete dossier through the product contract;
2. verifies immutable candidate identity and current capability membership;
3. verifies every exact candidate-owned observation, limitation, unknown, and
   reference;
4. rejects duplicates, missing material, cross-candidate material, and
   evidence later than the cutoff;
5. computes the canonical dossier digest and complete snapshot-record digest;
6. inserts the root and exact ordered membership atomically.

The snapshot record digest covers snapshot ID, candidate, family, version
scope, contract version, evidence cutoff, dossier digest, ordered evidence,
limitation, and unknown IDs, and creation metadata.

Loading uses exact membership, never currently active material. It validates
every stored complete record digest, reconstructs `CandidateDossierV1`, checks
the dossier and snapshot digests, and reruns `parseCandidateDossierV1`.
Historical snapshots therefore survive new evidence, later lifecycle events,
and current membership changes.

### Active reference closure and bounds

`selectActiveDossierMaterial` returns one complete public material set for a
candidate and cutoff. It is not an evidence browser and has no pagination
cursor.

The operation:

- selects at most the contract limit of 100 observations using all applicable
  evidence-world timestamps;
- excludes evidence superseded or invalidated by the cutoff;
- selects at most 40 limitations and 40 unknowns;
- excludes a limitation or unknown when any exact evidence reference is not in
  the active observation set; and
- validates the resulting set through the product parser.

Thus every returned reference resolves inside the returned observations.
Crossing a contract bound returns the stable value-free
`persistence.result-limit` error instead of a partial dossier input.

### Transactions, cancellation, and runtime role

Writes use explicit transactions. Candidate capability replacement,
lifecycle insertion, and snapshot creation share a candidate-key advisory lock.
Immutable inserts rely on unique constraints and record-digest comparison.
Active material and snapshot loads use read-only repeatable-read transactions.

Operations accept an abort signal and bounded statement/lock timeout overrides.
Postgres.js cancellation is best effort, so each transaction also sets
PostgreSQL `statement_timeout` and `lock_timeout`. Cancellation and server
timeouts map to `persistence.deadline`; callers retry only idempotent
operations.

Migration ownership remains separate from runtime access. The migration creates
one `NOLOGIN`, non-superuser, non-`BYPASSRLS` group role:

```text
gitblocks_persistence
```

It receives schema usage and only the select/insert privileges required for
public immutable records plus insert/delete on mutable capability membership.
It also receives read-only access to migration history so a runtime composition
can verify the exact applied inventory without migration-owner credentials. It
cannot mutate migration history, create schema objects, disable triggers,
truncate, or update immutable records. Integration behavior runs through a
non-owner login granted this role. RLS is intentionally absent because every
Phase 4 record is public shared data and there is no authenticated service.

### Index policy

Indexes correspond to current operations:

- case-insensitive GitHub repository and optional npm identity uniqueness;
- candidate/freshness/evidence ordering for active selection;
- candidate/stable-ID ordering for active limitations and unknowns;
- lifecycle reference/effective-time lookup and supersession traversal; and
- candidate/family/cutoff snapshot history.

Primary and unique constraints index exact membership and snapshot loading.
There is no tenant-leading, expiry, purge, deletion, organization, or
speculative index.

### Local and hosted verification

Root commands remain:

```text
pnpm db:migrate
pnpm db:check
pnpm db:test
pnpm db:verify
```

`db:verify` provisions exact PostgreSQL 18.4, applies and checks the migration,
runs integration plus ten-case conformance with no skips, checks the public
schema/role/functions/triggers/indexes, and cleans up. Hosted `verify:ci`
includes this path. Ordinary offline `verify` remains database-independent and
does not claim PostgreSQL coverage.

## Options and dependency review

Research used official project documentation, official npm registry metadata,
PostgreSQL documentation, and the GitHub Advisory Database on 2026-07-28.
Exact-version advisory queries returned no matches for the compared packages;
the frozen graph and registry audit remain authoritative validation.

### Client and typed-query options

| Option                                                                                    | Exact metadata and compatibility                                                                                                                | Behavior and footprint                                                                                                                                                                   | Decision                                                                                                               |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [Postgres.js](https://github.com/porsager/postgres) `3.4.9`                               | Unlicense; published 2026-04-05 by `porsager`; Node `>=12`; native ESM plus CJS; bundled declarations; TypeScript 6 compiles in this repository | Explicit transactions/cancellation, tagged parameters, JSONB, 37 files / 299,744 bytes, zero dependencies/peers, no consumer install hook, registry signature, no provenance attestation | **Selected.** Smallest transparent driver surface. Cancellation remains best effort, so server deadlines are required. |
| [node-postgres](https://github.com/brianc/node-postgres) `pg@8.22.0` + `@types/pg@8.20.0` | MIT; published 2026-06-19 / 2026-03-20; Node `>=16`; CJS with ESM import compatibility; separate types; optional `pg-native` peer               | Explicit same-client transactions and parameters; six direct runtime dependencies plus type graph; cancellation needs more adapter code                                                  | Maintained low-level fallback, but a larger graph with no Phase 4 capability advantage.                                |
| [Kysely](https://github.com/kysely-org/kysely) `0.29.4` + driver                          | MIT; published 2026-07-17 with SLSA provenance; Node `>=22`; ESM; bundled declarations; TypeScript minimum 5.4                                  | Typed SQL AST, transactions and raw SQL; 610 files / 1,725,100 bytes plus driver; runtime validation and cancellation still driver-owned                                                 | Credible typed-query option, but creates a parallel database type model while migration/triggers remain explicit SQL.  |
| [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm) `0.45.2` + driver              | Apache-2.0; published 2026-03-27 with SLSA provenance; ESM/CJS; bundled declarations                                                            | 2,666 files / 10,420,427 bytes and 30 optional peers; custom constraints/functions still raw SQL                                                                                         | Rejected as disproportionate and a second schema authority.                                                            |

### Migration options

| Option                                                                | Exact metadata                                                                          | Behavior and footprint                                                                                                | Decision                                                                           |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Repository-owned SQL migrator                                         | Repository code; no package addition                                                    | Fixed inventory, exact-byte SHA-256, advisory lock, transaction, drift/gap/unknown checks, full SQL transparency      | **Selected.** Smallest exact implementation of the required policy.                |
| [node-pg-migrate](https://github.com/salsita/node-pg-migrate) `9.0.0` | MIT; published 2026-07-17 with SLSA provenance; Node `>=20.11`; ESM; peer `pg >=4.3 <9` | Transactional up/down and discovery CLI; 294 files / 560,783 bytes plus `glob`, `jiti`, `yargs`, `pg` and transitives | Credible but down/discovery oriented and still needs wrappers for fixed checksums. |
| [graphile-migrate](https://github.com/graphile/migrate) `1.4.1`       | MIT; published 2022-12-20; declarations; no Node engine or attestation                  | SQL-first hash/lock workflow; 84 files / 225,190 bytes and 11 older direct dependencies                               | Credible lineage, but stale and broad for one migration.                           |

The selected production delta remains exactly `postgres@3.4.9`, with
SHA-512 integrity
`sha512-GD3qdB0x1z9xgFI6cdRD6xu2Sp2WCOEoe3mtnyB5Ee0XrrL5Pe+e4CCnJrRMnL1zYtRDZmQQVbvOttLnKDLnaw==`.
It has zero dependencies, peers, native addons, build requirements, or consumer
install hooks. pnpm supply-chain controls are unchanged.

## Consequences

### Positive

- The persistence layer directly unblocks public ingestion, retrieval, and
  ranking without unused enterprise lifecycle machinery.
- Complete-record idempotency detects metadata changes that a payload-only
  digest misses.
- Evidence cutoff semantics are queryable and correct for all seven provenance
  variants.
- Active material is reference closed, while historical snapshots remain
  exact.
- One driver, one role, zero RLS policies, and no organization/tenant surface
  materially reduce review and maintenance cost.

### Limitations

- PostgreSQL 18 is the only supported major.
- GitBlocks owns the migration runner and explicit SQL.
- The active material result is bounded to one dossier's contract maxima and is
  not a general evidence browser.
- There is no application port, authentication, authorization, private
  evidence, organization workflow, catalog administration, ingestion,
  retrieval, ranking, transport, model, worker, deployment, or production
  credential.
- A future private-data consumer must design purpose, authorization, isolation,
  lifecycle, and operations from its actual use case; this ADR does not
  pre-authorize them.
