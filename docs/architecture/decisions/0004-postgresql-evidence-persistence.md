# ADR 0004: PostgreSQL catalog and evidence persistence

- Status: accepted
- Date: 2026-07-28
- Decision owners: GitBlocks maintainers
- Governing issue:
  [#11 — Phase 4: Establish durable catalog and evidence persistence](https://github.com/kgudipati/gitblocks/issues/11)
- Execution plan:
  [Phase 4 durable catalog and evidence persistence](../../plans/0011-evidence-persistence.md)
- Related decisions:
  [ADR 0001](0001-agent-native-delivery.md),
  [ADR 0002](0002-typescript-workspace-and-toolchain.md),
  [ADR 0003](0003-product-contract-kernel.md)
- Related contracts:
  [GitBlocks product contract](../../product/product-contract.md),
  [system context](../system-context.md)

## Context

Phase 3 established the authoritative product vocabulary. GitBlocks now needs
the first durable product state that later catalog administration, ingestion,
retrieval, ranking, application services, and MCP delivery can use. This phase
must persist and exactly reconstruct fixed-candidate evidence inputs without
implementing any of those later behaviors.

The durable boundary has unusually important security and reproducibility
requirements:

- public and tenant records share the same storage model but tenant isolation
  cannot rely on caller-supplied query filters;
- candidate identity, evidence, limitations, unknowns, and historical snapshot
  membership must remain coherent across scope and tenant;
- evidence corrections are append-only lifecycle events, not updates;
- a historical dossier must continue to resolve its exact original material
  after later supersession or invalidation;
- tenant content cannot be retained indefinitely by accident;
- deletion must not affect public or another tenant's records;
- migrations must detect historical edits and serialize concurrent execution;
  and
- stored repository-derived or source-derived text remains inert, untrusted
  data and can never become executable instructions.

This is a concrete PostgreSQL adapter. A future application package will own
persistence ports and use cases. That future package must depend on contracts
and domain, not on this concrete package.

## Decision

### Package and dependency boundary

Create one private strict-ESM package:

```text
@gitblocks/persistence
        |
        v
@gitblocks/contracts
        |
        v
@gitblocks/domain
```

`@gitblocks/persistence` may depend only on the two product-kernel packages,
the selected PostgreSQL driver, and Node APIs needed by the adapter. It cannot
import an application package, tools, evaluation records, evaluation schemas,
HTTP, MCP, GitHub, models, frameworks, queues, workers, or deployment code.

Configuration and credentials are injected. The package reads no environment
variables, owns no singleton, performs no I/O during module import, and never
applies migrations implicitly. Client creation, migration, verification, and
client closure are separate explicit operations.

The private evaluation harness may depend on the persistence package solely to
prove storage representability:

```text
tools/evaluation-harness
        |
        v
@gitblocks/persistence
```

That edge does not reverse into product code and does not make proposed gold a
product input.

### Supported PostgreSQL version

Support PostgreSQL major 18 only during this phase. The migrator and database
verification reject `server_version_num` below `180000` or at or above
`190000`.

Local and hosted integration verification use the official
`postgres:18.4-bookworm` multi-architecture image pinned by index digest:

```text
postgres:18.4-bookworm@
sha256:1961f96e6029a02c3812d7cb329a3b03a3ac2bb067058dec17b0f5596aca9296
```

PostgreSQL's
[versioning policy](https://www.postgresql.org/support/versioning/) supports a
major for five years, recommends running the current minor, and lists major 18
support through 2030-11-14. PostgreSQL
[18.4](https://www.postgresql.org/about/news/postgresql-184-177-1611-1515-1422-and-1325-released-3292/)
was released on 2026-05-14 with security and correctness fixes. A reviewed
ordinary change may advance the exact minor and container digest within major
18; CI and local development move together. Supporting another major requires
explicit compatibility tests and an ADR update.

No persistent volume is attached by default. Local test orchestration chooses
a random host port, waits for `pg_isready`, uses a dedicated test database,
and removes the container reliably. A missing container engine is an explicit
failure, never a skipped or passing database suite.

### Database driver

Use `postgres@3.4.9` (Postgres.js) as the only new external runtime dependency.
It is a low-level, framework-neutral PostgreSQL client with:

- native ESM and bundled TypeScript declarations;
- Node `>=12`, which includes the repository's pinned Node 24.18.0;
- safe tagged-template parameter binding;
- reserved-connection transactions through `sql.begin`;
- JSON/JSONB value support;
- an explicit `sql.end` lifecycle;
- lazy connection establishment; and
- explicit query cancellation through `query.cancel()`.

The adapter does not expose the driver or its error values. It wraps and
destroys driver errors, returning only GitBlocks-owned stable, value-free
errors. No connection string, password, SQL statement, parameter, payload,
source URL, stack trace, PostgreSQL detail, constraint name, or provider name
crosses the package boundary.

Postgres.js cancellation is documented as best effort and can race query
completion. Each operation therefore also uses a fixed, bounded transaction
deadline and sets PostgreSQL `statement_timeout` and `lock_timeout` locally
with parameterized `set_config`. An already-aborted signal performs no query.
An abort requests cancellation on the operation's query or reserved
connection, rolls back a write transaction, and maps either cancellation or a
server timeout to the same stable deadline error. Cancellation is not treated
as proof that a transaction committed or did not commit; callers retry only
idempotent operations.

### Query and SQL policy

Production data access uses checked-in, schema-qualified, statically authored
SQL tagged templates. Caller values are parameters. Callers cannot supply a
table, column, schema, operator, ordering expression, policy, function, role,
migration path, or SQL fragment. Postgres.js `sql.unsafe` is prohibited for
runtime data access.

The migrator alone may execute the complete bytes of a trusted, checked-in,
checksummed migration file through the driver's raw SQL facility. Migration
files are code under review, never a caller or database value. The migrator
accepts no dynamic migration directory or identifier from an untrusted caller.

Result rows are treated as untrusted persisted data. Package-owned record
parsers validate normalized columns and JSON-compatible payloads before
mapping. A reconstructed dossier must pass
`parseCandidateDossierV1`; database shape alone is not product validity.

### Migration mechanism

Use a small repository-owned forward-only migrator rather than a migration
framework. Committed migrations have a fixed version, fixed name, and
SHA-256 checksum over their exact bytes. The initial inventory is:

```text
0001_evidence_persistence.sql
```

For apply or verify, the migrator:

1. opens an explicit transaction;
2. verifies PostgreSQL major 18;
3. acquires one fixed `pg_advisory_xact_lock` before bootstrap;
4. creates the dedicated schema and migration-history table if absent;
5. reads the known committed inventory from the package, not a caller path;
6. compares every applied version, name, and checksum;
7. rejects unknown versions, gaps, name drift, or checksum drift;
8. applies each pending migration as trusted complete SQL;
9. records history in the same transaction; and
10. releases the advisory lock by commit or rollback.

Repeat application is a verified no-op. Concurrent migrators serialize.
Migration failure rolls back the migration and history row together.
Historical migration files are immutable after publication; a correction is a
new forward migration.

There are no down migrations. A code rollback is permitted only while the
older code is compatible with the already-applied schema. Otherwise recovery
uses a reviewed corrective forward migration or an authorized backup restore.
Purge and tenant deletion are intentionally irreversible payload operations
and cannot be represented as lossless rollback.

### Runtime and migration role contract

The migration connection is a database owner capable of creating the
`gitblocks` schema, extensions-free SQL objects, and group roles. It is not
used for runtime isolation tests or ordinary persistence operations.

The migration creates two `NOLOGIN`, `NOSUPERUSER`, `NOCREATEDB`,
`NOCREATEROLE`, `NOREPLICATION`, `NOBYPASSRLS` group roles:

```text
gitblocks_runtime
gitblocks_public_writer
```

A deployed composition would create login roles and grant exactly one
appropriate group role. Phase 4 test orchestration creates temporary login
roles:

- a non-owner, non-superuser login in `gitblocks_runtime`; and
- a non-owner, non-superuser login in `gitblocks_public_writer`.

The migration owner owns all objects. Runtime roles receive schema `USAGE` and
only the table/function privileges required by the adapter. They receive no
schema creation, role creation, migration-history mutation, policy mutation,
trigger disabling, `TRUNCATE`, or `BYPASSRLS` privilege.

### Public and tenant row isolation

Every tenant-capable table stores:

```text
scope       text        -- public | tenant
tenant_id   uuid null
scope_key   text generated always as
            (case when scope = 'public' then 'public'
                  else tenant_id::text end) stored
```

A check requires public rows to have no tenant and tenant rows to have exactly
one tenant. Composite keys and foreign keys include `scope_key` and candidate
identity, so a child cannot name material belonging to another candidate or
scope. Stable IDs may repeat in different scopes but are unique inside a
scope.

All tenant-capable tables have both `ENABLE ROW LEVEL SECURITY` and
`FORCE ROW LEVEL SECURITY`. PostgreSQL documents that enabled tables with no
applicable policy are default-deny, while owners and `BYPASSRLS` roles
otherwise bypass row security; forcing RLS closes the owner exception. It also
documents that referential-integrity checks bypass RLS, so composite ownership
constraints are paired with stable error mapping to avoid disclosing whether
another tenant's referenced ID exists.

Tenant context is transaction-local:

```text
select pg_catalog.set_config('gitblocks.tenant_id', $1, true)
```

The schema-owned `gitblocks.current_tenant_id()` helper reads that setting and
returns a UUID only when it is present and well formed. Missing or malformed
context returns null. It does not query another table, preventing a
policy-subquery race.

Policy behavior is:

| Role/context                                  | Read                                              | Insert/delete              |
| --------------------------------------------- | ------------------------------------------------- | -------------------------- |
| `gitblocks_runtime`, valid tenant             | public plus that tenant                           | that tenant only           |
| `gitblocks_runtime`, missing/malformed tenant | public only                                       | no scoped payload          |
| `gitblocks_public_writer`                     | public only                                       | public only                |
| owner/superuser                               | operational access, never isolation-test identity | migration/maintenance only |

Immutable content has no update grant and an update-denial trigger as
defense-in-depth. Tenant deletion uses tenant-scoped deletes/cascades inside a
transaction; public rows never satisfy tenant delete policies.

### Storage record model

Use a hybrid model:

- normalized columns own scope, tenant, candidate ownership, stable identity,
  timestamps, expiry, lifecycle relations, referential integrity, uniqueness,
  pagination, and indexes; and
- canonical JSONB stores the exact closed product value needed for lossless
  reconstruction.

Canonical JSONB is not arbitrary metadata. It is accepted only after existing
contract/domain validation or a package-owned closed command parser. A
lowercase SHA-256 canonical digest accompanies every immutable payload.

The schema contains:

- `schema_migrations`;
- `tenants`;
- `tenant_tombstones`;
- `catalog_candidates`, including normalized GitHub identity and optional npm
  package identity;
- `candidate_capability_families`;
- `evidence_observations`;
- `candidate_limitations` and `candidate_limitation_evidence`;
- `candidate_material_unknowns` and `candidate_unknown_evidence`;
- `evidence_supersessions`;
- `evidence_invalidations`;
- `candidate_dossier_snapshots`; and
- exact evidence, limitation, and unknown snapshot-membership tables.

Timestamps use `timestamptz`. Text and arrays have explicit product or
package-owned bounds. Scope, reason, family, topic, dimension, provenance kind,
and digest columns have controlled checks. Identity, candidate ownership,
uniqueness, references, self-reference, expiry chronology, and locally
expressible lifecycle relationships are database constraints.

### Immutable observations and idempotency

Evidence observations, limitations, unknowns, dossier snapshots, and their
canonical payloads are immutable.

For each immutable stable ID:

```text
same scope + same stable ID + same canonical digest
  -> idempotent success

same scope + same stable ID + different canonical digest
  -> stable conflict
```

Insertion uses a database unique key and
`INSERT ... ON CONFLICT DO NOTHING`. A conflict is followed, inside the same
transaction, by a digest comparison. No unprotected read-then-write decides
identity. Concurrent identical writers both succeed idempotently; concurrent
different writers produce one success and one stable conflict. Update grants
are absent and immutable-row triggers reject direct owner updates used in
integration tests.

Capability-family replacement is mutable catalog membership, not evidence. It
locks the candidate row, validates a bounded unique set, and replaces
membership atomically.

### Evidence lifecycle and active-as-of selection

Corrections append a new evidence observation. The original row remains
immutable. A supersession event names one older and one newer observation,
stable reason code, and effective timestamp. An invalidation event names one
observation, stable reason code, and effective timestamp.

Composite references enforce the same candidate and scope. Checks reject
self-supersession. Supersession creation locks the candidate ownership row,
then runs a recursive cycle check and inserts in one transaction. Immutable
child rows cannot be deleted independently, so the candidate lock provides the
serialization boundary without granting runtime `UPDATE` on evidence.
The append-only lifecycle tables also use stable-ID/digest idempotency.

`selectActiveDossierMaterial` requires an explicit cutoff and bounded result
limit. In one read-only transaction it returns candidate material created no
later than the cutoff and excludes evidence with an invalidation or
supersession effective no later than that cutoff. Ordering is stable ID order
with a stable-ID cursor. A later event has no effect on an earlier cutoff.

An active selection is a storage query, not ranking, retrieval, or fit
assessment.

### Reproducible dossier snapshots

Snapshot creation receives a complete candidate dossier value, explicit scope,
explicit evidence cutoff, and tenant expiry when applicable. It:

1. validates the dossier through the existing product parser;
2. canonicalizes and digests the exact dossier;
3. locks the candidate ownership row and reads the exact immutable references
   in stable order;
4. rejects missing, duplicate, cross-candidate, cross-scope, cross-tenant, or
   conflicting membership;
5. verifies all referenced tenant material outlives the snapshot;
6. inserts immutable snapshot metadata and exact membership atomically; and
7. uses stable-ID/digest semantics for retry idempotency.

The snapshot stores snapshot ID, candidate, scope/tenant, historical candidate
identity, capability family, version scope, contract version, evidence cutoff,
canonical dossier digest, creation time, expiry, and exact member IDs.

Loading joins the exact membership tables and immutable material. It never
substitutes currently active evidence. It reconstructs a
`CandidateDossierV1`, verifies the canonical digest, reruns
`parseCandidateDossierV1`, and returns only the validated product value. Later
evidence, supersession, or invalidation cannot change a historical snapshot.

### Retention, expiry, purge, deletion, and tombstones

All tenant payload insertion requires a caller-supplied `expiresAt`. There is
no implicit default and no indefinite tenant payload. The timestamp must be
later than creation. Candidate ownership rows must not expire before their
child material; a snapshot must expire no later than every exact member it
references. Public rows have null tenant and null expiry and are never affected
by tenant purge.

`purgeExpiredTenantData` requires a tenant context, cutoff, and batch limit from
1 through 500. In one transaction it locks and deletes at most that many
expired root records in deterministic expiry/stable-ID order. Expired
snapshots are removed before exact member material. Non-expired snapshots
protect referenced material through foreign keys. The result reports bounded
counts, not payloads. The package has no purge scheduler or worker.

`deleteTenantData` locks the tenant, inserts one minimal tombstone, and deletes
the tenant and all tenant payload through scoped cascades in one transaction.
It cannot delete a public or another tenant's record. After commit, snapshot
reconstruction for that tenant fails as not found.

The tombstone contains only:

```text
tenant_id
deleted_at
reason_code
```

It contains no candidate identity, evidence statement, URL, provenance,
dossier payload or digest, limitation, unknown, excerpt, credential, or other
tenant content. Tombstones are not product-readable. Their operational
retention and backup erasure policy remain deployment decisions; no production
deployment or backup exists in this phase.

### Transactions, concurrency, and bounds

Writes use explicit transactions and stable lock ordering. No transaction is
hidden at module import, client construction, or ordinary read.

- migrations use one fixed advisory transaction lock;
- immutable inserts use unique constraints and digest comparison;
- capability replacement locks its candidate;
- lifecycle append locks the candidate ownership row;
- snapshot creation locks the candidate ownership row and reads exact immutable
  membership in sorted ID order;
- active-as-of uses one consistent read-only transaction;
- purge uses `FOR UPDATE SKIP LOCKED` and deterministic bounded ordering; and
- tenant deletion locks the tenant and completes atomically.

Page and batch values are integers with explicit minimums and maxima. Dossier
member counts inherit the contract maxima. Active evidence pages are at most
100 and purge batches at most 500. Cursors are stable IDs, never caller SQL.

### Index and pagination policy

Every index supports a named invariant or bounded query:

- scope-key plus candidate/stable-ID unique indexes enforce immutable identity;
- scoped GitHub and optional npm identity indexes enforce catalog uniqueness;
- tenant-leading indexes support tenant deletion;
- candidate/family indexes support exact membership;
- candidate/creation/stable-ID and lifecycle-reference indexes support
  active-as-of;
- snapshot/member ordinal and ID indexes support exact deterministic loading;
  and
- tenant/expiry/stable-ID partial indexes support bounded purge.

Integration verification checks the principal active-as-of and purge query
plans for index eligibility. It makes no hardware-dependent latency claim.

### Local and hosted database verification

Root commands are:

```text
pnpm db:migrate
pnpm db:check
pnpm db:test
pnpm db:verify
```

`db:verify` provisions the pinned ephemeral PostgreSQL container, migrates,
checks schema/roles/policies/checksums, runs the full integration suite through
non-owner runtime roles, and cleans up. `verify:ci` includes `db:verify`; hosted
CI cannot silently skip it.

Ordinary offline `verify` remains database-independent and documents that it
does not prove PostgreSQL behavior. This avoids pretending a developer
production database is available while keeping the full hosted gate
mandatory.

### Compatibility with future application-owned ports

The package API accepts validated product values or package-owned bounded
commands and returns owned values or stable errors. It does not define future
application authorization, use-case, or port interfaces.

A future composition root will instantiate both an application implementation
and this adapter, then adapt application-owned ports to concrete persistence
operations. The application package cannot import
`@gitblocks/persistence`; wiring belongs outside both packages.

## Options considered and dependency review

Research used official project documentation, official npm registry package
metadata, PostgreSQL documentation, and the GitHub Advisory Database on
2026-07-28. Exact-version advisory queries returned zero matching advisories
for every option below. Absence of a database match is not a guarantee; frozen
installation and the repository-wide audit remain required.

### PostgreSQL client and query options

| Option                                                                                       | Exact metadata                                                                                                                                                                                              | Transactions, cancellation, JSONB, SQL transparency                                                                                                                      | Footprint and lifecycle                                                                                                                                                                                            | Decision and limitations                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Postgres.js](https://github.com/porsager/postgres) `3.4.9`                                  | Unlicense; published 2026-04-05 by npm publisher/maintainer `porsager`; Node `>=12`; native ESM plus CJS export; bundled declarations; official repository                                                  | Reserved-connection `sql.begin`; documented `query.cancel()` with completion race; parameters through SQL tags; JSON/JSONB values; raw SQL is explicit                   | 37 files, 299,744 unpacked bytes, zero dependencies and peers; registry signature, no provenance attestation; published source has `prepare`/`prepublishOnly` but no consumer `preinstall`/`install`/`postinstall` | **Selected.** Smallest complete graph and strongest ESM/TypeScript fit. Cancellation is best effort, so server deadlines are also mandatory. SQL result types are not runtime validation.                                                  |
| [node-postgres](https://github.com/brianc/node-postgres) `pg@8.22.0` plus `@types/pg@8.20.0` | MIT; `pg` published 2026-06-19 by `brianc`; types published 2026-03-20 by DefinitelyTyped; Node `>=16`; CJS implementation with ESM import compatibility; types separate; optional `pg-native >=3.0.1` peer | Explicit same-client `BEGIN`/`COMMIT`/`ROLLBACK`; parameterized values; driver-specific cancellation requires more adapter work; JSON/JSONB parsing; transparent SQL     | `pg`: 20 files/95,249 bytes plus 6 direct dependencies and their transitives; types: 9 files/19,419 bytes and overlapping dependencies; registry signatures, no attestations; no consumer lifecycle scripts        | Credible maintained low-level fallback, but a larger two-package/type graph and less cohesive ESM/cancellation surface add no Phase 4 capability over Postgres.js.                                                                         |
| [Kysely](https://github.com/kysely-org/kysely) `0.29.4` plus PostgreSQL driver               | MIT; published 2026-07-17 by GitHub Actions with SLSA provenance; Node `>=22`; ESM; built-in declarations; TypeScript minimum documented as 5.4                                                             | Explicit transaction API; compiles a typed AST to visible SQL; raw SQL escape; PostgreSQL behavior/cancellation/JSONB runtime representation still comes from the driver | 610 files/1,725,100 unpacked bytes, zero own dependencies, plus selected driver; no consumer install scripts                                                                                                       | Credible typed-query option, but it requires a parallel database interface model, does not runtime-validate rows, and high-risk RLS/function/migration SQL remains raw. The extra abstraction does not strengthen this phase's invariants. |
| [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm) `0.45.2` plus driver              | Apache-2.0; published 2026-03-27 by GitHub Actions with SLSA provenance; ESM/CJS; bundled declarations                                                                                                      | Typed query/schema model, transactions, raw SQL, JSONB support through PostgreSQL dialect; cancellation depends on driver                                                | 2,666 files/10,420,427 unpacked bytes; zero required dependencies but 30 optional peers spanning databases, frameworks, telemetry, and runtimes; no consumer install script                                        | Rejected. Its large generic surface and second schema authority are disproportionate, while custom RLS, triggers, functions, and forward checksums still require explicit SQL.                                                             |

Postgres.js and Kysely declarations will be compiled under the repository's
TypeScript 6.0.3 during validation; package metadata does not itself guarantee
every future TypeScript 6 minor. Only the selected package enters the lockfile.

### Migration options

| Option                                                                | Exact metadata                                                                                                                              | Migration behavior and SQL transparency                                                                                                                             | Footprint and lifecycle                                                                                                                                                 | Decision and limitations                                                                                                                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repository-owned SQL migrator                                         | Repository code under this ADR and Issue #11; no package/license addition                                                                   | Forward-only complete SQL, SHA-256 history, fixed advisory transaction lock, one transaction per apply, exact drift/unknown/gap checks; maximum SQL transparency    | Zero external packages or peers; uses selected driver and Node SHA-256/filesystem APIs; no package lifecycle                                                            | **Selected.** Precisely implements the required checksum, locking, no-down, fixed-inventory, and safe-error policy. The repository owns maintenance and must test every behavior.          |
| [node-pg-migrate](https://github.com/salsita/node-pg-migrate) `9.0.0` | MIT; published 2026-07-17 by GitHub Actions with SLSA provenance; Node `>=20.11`; ESM/declarations; peer `pg >=4.3 <9`, optional types peer | Transactional up/down migrations and raw/constructed SQL; CLI discovers migration files; ordinary history behavior is not the required exact-byte checksum contract | 294 files/560,783 bytes; direct dependencies `glob ~13`, `jiti ~2.7`, `yargs ~18`, plus `pg` peer and transitives; no consumer install script                           | Credible maintained migration tool, but down-oriented/discovery behavior and a CLI/parser graph would need wrappers to reproduce the issue's stricter fixed inventory and drift semantics. |
| [graphile-migrate](https://github.com/graphile/migrate) `1.4.1`       | MIT; published 2022-12-20 by `benjie`; current metadata modified 2026-04; declarations; no Node engine; no attestation                      | SQL-first current/committed migration workflow with hash tracking and PostgreSQL locks; development watch workflow is broader than fixed packaged migrations        | 84 files/225,190 bytes; 11 direct dependencies including `pg`, `chokidar`, `yargs@15`, JSON5, logging, and Node 14 types; published `prepack`, no consumer install hook | Credible SQL-first lineage but stale release and broad older dependency graph are unjustified for one forward migration.                                                                   |

### Supply-chain disposition

The selected production delta is exactly `postgres@3.4.9`. It has:

- exact SHA-512 registry integrity
  `sha512-GD3qdB0x1z9xgFI6cdRD6xu2Sp2WCOEoe3mtnyB5Ee0XrrL5Pe+e4CCnJrRMnL1zYtRDZmQQVbvOttLnKDLnaw==`;
- zero dependencies, zero peers, no native addon, and no build requirement;
- one npm registry signature but no SLSA provenance attestation;
- no exotic source, prerelease, git, URL, or floating version;
- no consumer install lifecycle hook; and
- no exact-version GitHub Advisory Database match on the research date.

The published package's `prepare` script is source-development metadata and is
not an npm consumer installation lifecycle hook. Existing pnpm
`strictDepBuilds`, minimum release age, integrity-bound package manager,
allowlist, and frozen-lockfile controls remain unchanged. No dependency build
allowance is added.

The final execution plan records the pnpm-generated lockfile delta, resolved
graph/license inventory, TypeScript 6 build result, package audit, and any
advisory correction. Replacement cost is localized behind client and query
helpers; stored SQL schema and product records do not expose Postgres.js types.

## Consequences

### Positive

- PostgreSQL itself enforces tenant visibility and candidate/scope references.
- Exact product material remains reconstructable without making JSONB a second
  product contract.
- Historical snapshots are stable while active-as-of selection can reflect
  later lifecycle events.
- One zero-transitive driver keeps the production dependency surface small.
- Migrations implement exactly the required forward/checksum/lock contract.
- Future application ports can wrap the adapter without importing it.

### Costs and limitations

- GitBlocks owns migration-runner maintenance and advanced SQL integration
  tests.
- PostgreSQL major 18 is the only supported server until compatibility work is
  explicit.
- Postgres.js cancellation is best effort; server-side timeouts remain the
  definitive bound.
- RLS does not replace application authorization, and PostgreSQL integrity
  checks can form covert channels if driver details escape. Stable error
  mapping and runtime-role tests are mandatory.
- Canonical JSONB duplicates selected normalized facts and requires drift
  checks on reconstruction.
- No production role provisioning, credentials, backup deletion, encryption,
  scheduler, monitoring backend, or deployment is created.
- Tombstone and backup retention need a deployment policy before real tenant
  data exists.

## Validation requirements

This decision is accepted only with the Issue #11 validation matrix, including:

- clean/repeat/drift/concurrent/failing migration tests;
- PostgreSQL 18 version and explicit-schema inspection;
- RLS enabled and forced on every tenant-capable table;
- tenant/public/missing/malformed context tests through non-owner,
  non-superuser logins;
- immutable same/different digest and concurrent insert tests;
- all seven evidence provenance variants;
- lifecycle cycle and active-as-of cutoff tests;
- exact parser-valid snapshots stable after new evidence, supersession, and
  invalidation;
- bounded purge, public preservation, isolated tenant deletion, safe
  tombstones, and no post-delete reconstruction;
- injection, error-redaction, deadline/cancellation, batch-bound, import, and
  prohibited-dependency tests;
- all ten proposed/not-reviewed pilot dossiers plus non-pilot storage
  fixtures;
- PostgreSQL-enabled hosted `verify:ci` with no database skip; and
- the complete repository verification and audit commands in the execution
  plan.
