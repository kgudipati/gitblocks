# Phase 4 durable catalog and evidence persistence

## Status and authority

- Governing issue:
  [#11 — Phase 4: Establish durable catalog and evidence persistence](https://github.com/kgudipati/gitblocks/issues/11)
- Required branch: `feat/11-evidence-persistence`
- Owner: GitBlocks maintainers
- State: implementation published in draft PR #12; hosted verification passed
- Last updated: 2026-07-28
- Required draft PR title:
  `feat: establish catalog and evidence persistence`
- Authority order: Issue #11; actual repository and Git history; the
  [product contract](../product/product-contract.md); the
  [system context](../architecture/system-context.md) and accepted ADRs;
  `AGENTS.md`, `PLANS.md`, and the engineering handbook; then the execution
  prompt.

Issue #11 owns the complete deliverables, storage semantics, security
requirements, acceptance criteria, and non-goals. This plan provides
traceability and execution evidence; it does not narrow the issue. Material
discoveries update this plan and, when architectural, ADR 0004 before the
implementation is presented as complete.

## Purpose and user-visible outcome

GitBlocks currently has authoritative product vocabulary but no durable product
state. This phase adds the first PostgreSQL persistence adapter so a future
application layer can store and exactly reconstruct fixed-candidate evidence
inputs without inventing another candidate, evidence, limitation, unknown, or
dossier contract.

The observable engineering outcome is:

- one new private production package, `@gitblocks/persistence`;
- forward-only, checksum-verified PostgreSQL migrations;
- database-enforced public/tenant scope and row isolation;
- immutable catalog material and append-only evidence lifecycle events;
- reproducible candidate-dossier snapshots validated by the existing product
  parser;
- bounded purge and transactional tenant deletion; and
- real PostgreSQL integration verification locally and in hosted CI.

This is a PostgreSQL adapter, not an operational backend. No application use
case, catalog administration, ingestion, retrieval, ranking, API, MCP,
authentication, worker, model, queue, deployment, or production credential is
created.

## Verified current repository state

Verified on 2026-07-28 before editing:

- `git status --short --branch` reported clean
  `main...origin/main`.
- `origin` is `https://github.com/kgudipati/gitblocks.git` for fetch and push.
- `git fetch origin`, `git switch main`, and
  `git pull --ff-only origin main` completed without change.
- Local `HEAD` and `origin/main` both resolve to
  `e7ae0ba4270b3fb24f144cdb6053355c761b82e5`.
- The recent history begins with `e7ae0ba feat: establish product contract
kernel`.
- Connected GitHub inspection confirmed PR #10 is merged into that commit,
  Issue #9 is closed, and Issue #11 is open.
- `packages/domain` and `packages/contracts` are exactly the two existing
  product packages.
- Repository inspection found no database client, persistence package,
  versioned SQL migration system, PostgreSQL integration test path, or
  PostgreSQL CI service.
- `evals/pilot-v1/manifest.json` records
  `status: development-proposed`, `goldStatus: proposed`,
  `independentReviewStatus: not-reviewed`, and no independent reviewer.
- The authoritative current dependency direction is
  `tools/evaluation-harness -> @gitblocks/contracts -> @gitblocks/domain`.
- The active branch was then created exactly as
  `feat/11-evidence-persistence`.

The merged baseline ran using the already-installed nvm toolchain; no runtime
was installed or automatically changed:

| Command                                                | Result                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `source /Users/karthikgudipati/.nvm/nvm.sh && nvm use` | Node `24.18.0` selected                                                |
| `node --version`                                       | `v24.18.0`                                                             |
| `corepack pnpm --version`                              | `11.17.0`                                                              |
| `pnpm runtime:check`                                   | exit 0                                                                 |
| `pnpm install --frozen-lockfile`                       | exit 0; graph already current                                          |
| `pnpm verify`                                          | exit 0; 31 files / 637 tests                                           |
| `pnpm architecture:check` within `verify`              | 589 modules / 1,896 dependencies, no violations                        |
| `pnpm contracts:validate`                              | 10 cases / 40 candidates; proposed/not-reviewed; representability only |
| `pnpm eval:validate`                                   | 10 cases                                                               |
| `pnpm eval:fixtures`                                   | all fixed weak fixtures passed                                         |

The initial shell did not source nvm and exposed standalone pnpm `11.9.0`;
`pnpm runtime:check` correctly failed before repository scripts ran. The
correction was to source the existing local nvm installation and use Corepack's
integrity-bound package-manager pin. This is validation evidence, not a
repository failure or runtime installation.

## Scope and explicit non-goals

### In scope

- ADR 0004 and this living plan.
- Exactly one new product package: `packages/persistence`.
- Minimum justified exact PostgreSQL/migration dependencies, with lockfile
  changes generated only by pnpm.
- Versioned forward SQL migrations, history/checksum verification, and
  serialized migration execution.
- Tenant, catalog identity, optional npm identity, capability membership,
  evidence, limitations, unknowns, snapshots and exact membership,
  supersession, invalidation, expiry, purge, deletion, and minimal tombstones.
- Injected configuration, explicit client lifecycle, explicit migrations, safe
  errors, deadlines/cancellation, parameterized SQL, bounds, and transactions.
- Database-enforced row isolation tested through a non-owner,
  non-superuser runtime role.
- Real pinned PostgreSQL locally and in CI.
- Storage conformance for all ten proposed pilot dossiers and separate
  non-pilot fixtures.
- Architecture, repository policy, root commands/references, test config, CI,
  and the Issue #11 documentation set.

### Explicit non-goals

- Catalog administration or product-facing mutation workflows.
- GitHub, npm, advisory, documentation, or other external-source fetching.
- Ingestion, discovery, retrieval, search, ranking, or fit-assessment
  execution.
- An application package, persistence ports, HTTP, GraphQL, RPC, or MCP.
- Authentication, billing, queues, workers, schedules, models, embeddings,
  outcomes, deployment, or production credentials.
- Execution, installation, cloning, import, or build of candidate packages or
  repositories.
- Accepting proposed gold, running a live model/agent baseline, or changing
  evaluation scoring.

## Requirements crosswalk

| Issue #11 requirement                                                             | Destination                                      | Milestone | Required evidence                                             |
| --------------------------------------------------------------------------------- | ------------------------------------------------ | --------- | ------------------------------------------------------------- |
| PostgreSQL decision and full option/dependency review                             | ADR 0004; plan research log                      | 1         | Official docs/metadata, exact versions, resolved graph, audit |
| Exactly one new product package                                                   | `packages/persistence`                           | 2         | package inventory, manifests, architecture check              |
| Injected configuration; no import I/O, singleton, env read, or implicit migration | package client and import tests                  | 2         | unit/import tests and source review                           |
| Deterministic forward migrations, checksums, locking, repeat safety               | `packages/persistence/migrations`; migrator      | 2         | clean/repeat/drift/concurrent/failure integration tests       |
| Dedicated schema, roles, and explicit qualification                               | migration SQL                                    | 2         | catalog inspection and migration tests                        |
| Tenant/public coherence and PostgreSQL row isolation                              | checks, RLS functions/policies, grants           | 3         | non-owner runtime-role matrix                                 |
| Catalog identity and capability families                                          | candidate and membership tables/API              | 3         | uniqueness, ownership, round-trip tests                       |
| Immutable evidence, limitations, and unknowns                                     | tables, reference tables, append APIs            | 3         | same/different digest, update denial, concurrency, rollback   |
| All seven evidence provenance variants                                            | canonical payload mapping and normalized columns | 3         | variant round-trip table                                      |
| Supersession/invalidation and active-as-of                                        | lifecycle tables, cycle guard, selection API     | 4         | self/cycle/scope/candidate/as-of tests                        |
| Reproducible exact-membership dossier snapshots                                   | snapshot/membership tables and loader            | 4         | parser-valid reconstruction and historical-stability tests    |
| Mandatory bounded tenant retention                                                | expiry checks and insertion commands             | 5         | missing/invalid expiry rejection                              |
| Bounded purge and full tenant deletion                                            | purge/delete operations and tombstone            | 5         | deterministic batch, isolation, no reconstruction             |
| Safe errors, parameterization, bounds, deadlines/cancellation                     | client/query helpers and public API              | 3–5       | abuse/error/redaction/cancellation tests                      |
| Real PostgreSQL local and hosted verification                                     | DB orchestration and CI service/container        | 6         | local commands, hosted job/log evidence, no skips             |
| Ten pilot plus non-pilot representability                                         | evaluation-harness integration fixtures          | 6         | 10-case and non-pilot conformance output                      |
| Architecture/docs/repository commands                                             | listed repository/doc files                      | 6         | `architecture:check`, `repo:check`, full diff review          |
| Draft PR, ordinary commits/pushes, hosted correction loop                         | Git/GitHub                                       | 7         | commit SHAs, draft PR, run/job/log evidence                   |

## Product-contract and system-context crosswalk

| Authority                                                                  | Persistence consequence                                                                                                                 | Intentionally unchanged                                             |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Candidate dossier V1 is the authoritative external value                   | Store enough bounded canonical material and exact membership to reconstruct a `CandidateDossierV1`, then pass `parseCandidateDossierV1` | Contract schema and domain meaning                                  |
| Source-aware evidence variants                                             | Preserve each closed provenance variant exactly; do not replace it with generic metadata                                                | Provenance validation remains contracts/domain-owned                |
| Evidence, limitations, and unknowns are candidate-owned                    | Composite database references enforce candidate and storage-scope coherence                                                             | Business interpretation remains domain-owned                        |
| Product values are bounded and closed                                      | Persistence commands accept existing product values or closed bounded storage commands                                                  | No storage shape becomes a product DTO                              |
| Evidence store preserves provenance, freshness, and tenant/access metadata | Normalize ownership/lifecycle/index columns while retaining canonical JSONB for exact reconstruction                                    | No ingestion or retrieval/ranking behavior                          |
| Future application services own authorization/use cases                    | Adapter exposes concrete operations but no application-owned port                                                                       | No `packages/application`; no application dependency on persistence |
| Product packages never import evaluation records/gold/tools                | Harness may call persistence only for conformance                                                                                       | No reverse import and no gold in product paths                      |
| Stored external content is untrusted data                                  | Revalidate reconstructed values; parameterize SQL; never execute or follow stored text                                                  | No candidate-code execution capability                              |

## Applicable ADRs and contracts

- [ADR 0001](../architecture/decisions/0001-agent-native-delivery.md):
  preserves headless future delivery and the prohibition on executing
  candidate repositories. No delivery surface is implemented here.
- [ADR 0002](../architecture/decisions/0002-typescript-workspace-and-toolchain.md):
  retains Node 24.18.0, pnpm 11.17.0, TypeScript 6.0.3, strict ESM/NodeNext,
  exact pins, frozen pnpm-generated lockfile, default-denied dependency
  lifecycle scripts, Vitest, dependency-cruiser, secret scanning, and CI
  controls.
- [ADR 0003](../architecture/decisions/0003-product-contract-kernel.md):
  persistence records map to owned contract/domain values and cannot become
  domain truth. Candidate dossier V1 and source-aware evidence semantics remain
  unchanged.
- ADR 0004 is created by this phase and will decide the PostgreSQL, driver,
  migration, record, role/RLS, lifecycle, retention, and recovery policies.
- The product contract and system context are clarified only to mark this
  non-operational adapter implemented. Product vocabulary and planned service
  boundaries do not change.

## Architecture, package graph, and data flow

Current approved graph after this phase:

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

The harness-to-persistence edge exists only for offline storage conformance.
The package itself imports neither tools nor evaluation data. Future
composition remains:

```text
                    composition root
                    /              \
                   v                v
        application use cases   persistence adapter
                 |                    |
                 v                    v
          contracts/domain      contracts/domain
```

Primary write flow:

```text
validated product value or bounded storage command
  -> scope/deadline/batch validation
  -> explicit PostgreSQL transaction and tenant context
  -> parameterized insert with database ownership/uniqueness/RLS checks
  -> compare canonical digest on uniqueness conflict
  -> stable value-free success or error
```

Snapshot load flow:

```text
snapshot metadata + stored identity + exact member IDs
  -> load exact immutable members, not currently-active members
  -> reconstruct CandidateDossierV1
  -> verify canonical dossier digest
  -> parseCandidateDossierV1
  -> return contract-valid value or stable corruption error
```

## PostgreSQL threat model

### Assets

- Public catalog identity and attributable evidence.
- Tenant-approved validation/evidence, tenant snapshots, and tenant identity.
- Exact historical snapshot membership and canonical digests.
- Migration history/checksums and database role/isolation policy.
- Connection credentials supplied by future composition or test tooling.

### Actors and entry points

- Migration owner applying reviewed SQL.
- Public writer for future trusted catalog/ingestion composition.
- Non-owner, non-superuser tenant runtime role.
- Future application callers supplying validated commands.
- Test tooling supplying local ephemeral database configuration.
- Untrusted stored statements, URLs, stable IDs, reason codes, and provenance.

### Misuse cases and controls

| Misuse                                                   | Control                                                                                         | Evidence                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------- |
| Tenant A reads or references tenant B                    | PostgreSQL RLS plus composite scope/ownership foreign keys; fail-closed tenant context          | runtime-role cross-tenant tests         |
| Missing/malformed context exposes tenant rows            | safe current-tenant function returns no tenant; policies default deny                           | missing/malformed-context tests         |
| Tenant runtime writes public records                     | separate role/policy/grant contract                                                             | public-policy tests                     |
| SQL injection through IDs/text/URLs                      | fixed reviewed SQL and parameterized values; no caller identifiers                              | injection sentinel tests                |
| Stable ID overwrites immutable content                   | unique identity plus digest comparison and update-denial trigger                                | idempotency/conflict/update tests       |
| Concurrent writers corrupt identity                      | database uniqueness and transaction conflict handling                                           | identical/conflicting concurrency tests |
| Lifecycle cycle hides all evidence                       | self-reference check plus serialized cycle detection                                            | self/cycle tests                        |
| Historical snapshot drifts                               | exact immutable membership, stored identity, digest verification, product parse                 | historical-stability tests              |
| Expiry deletes material still needed by a live snapshot  | creation-time expiry coherence and deterministic purge ordering                                 | retention/reference tests               |
| Tenant deletion leaves reconstructable payload           | one transaction deletes tenant scope and inserts content-free tombstone                         | deletion/no-reconstruction tests        |
| Error leaks credential, SQL, payload, or provider detail | stable owned error taxonomy; discard driver detail                                              | sentinel leakage tests                  |
| Stored instructions cause execution                      | package has no evaluator, shell construction, URL fetch, dynamic import, or candidate execution | source/architecture review              |
| Migration history is edited or races                     | SHA-256 history plus advisory lock and transactional apply                                      | drift/concurrent migrator tests         |

Residual risks are adapter-only: future application authorization, production
credential issuance, backup deletion, encryption configuration, deployment,
and operational auditing remain unavailable and must be decided before remote
storage is enabled.

## Public and tenant scope matrix

The exact role names and SQL expressions remain open until ADR research is
complete, but the policy is fixed:

| Record/operation             | Public scope                  | Tenant scope                  | Missing context      | Public writer            | Tenant runtime                      |
| ---------------------------- | ----------------------------- | ----------------------------- | -------------------- | ------------------------ | ----------------------------------- |
| Tenant registry              | no public row                 | own identity only when needed | no tenant visibility | no tenant payload access | own row only                        |
| Catalog candidate/capability | readable                      | matching tenant only          | public rows only     | public read/write        | public read + own tenant read/write |
| Evidence/limitation/unknown  | readable                      | matching tenant only          | public rows only     | public read/write        | public read + own tenant read/write |
| Lifecycle event              | readable with public material | matching tenant only          | public only          | public read/write        | public read + own tenant write      |
| Dossier snapshot/membership  | readable if public            | matching tenant only          | public only          | public read/write        | public read + own tenant read/write |
| Tombstone                    | not product-readable          | owner/operations only         | none                 | none                     | none                                |

Every tenant-capable table carries explicit `scope` and nullable `tenant_id`
with a database check: public means no tenant; tenant means exactly one tenant.
RLS is enabled and forced where supported. Tests never claim isolation while
connected only as the table owner or superuser.

## Storage and database-invariant inventory

Working inventory, to be finalized in ADR 0004 and the migration:

- dedicated `gitblocks` schema and schema-qualified objects;
- migration history with immutable version/name/checksum/applied-at fields;
- migration advisory serialization;
- `tenants` and minimal `tenant_tombstones`;
- `catalog_candidates` with stable candidate ID, display name, GitHub
  owner/repository, optional npm package, scope/tenant, canonical digest,
  lifecycle timestamps, and expiry;
- `candidate_capability_families`;
- immutable `evidence_observations` with normalized ownership, topic,
  dimension, provenance kind, freshness/cutoff fields, canonical JSONB, digest,
  insertion time, and expiry;
- immutable `candidate_limitations` and `candidate_material_unknowns`;
- evidence-reference tables for limitations and unknowns;
- append-only `evidence_supersessions` and `evidence_invalidations`;
- immutable `candidate_dossier_snapshots` with stored identity, capability,
  version/contract, cutoff, canonical dossier digest, creation/expiry; and
- exact snapshot evidence/limitation/unknown membership tables.

Database enforcement will cover:

- public/tenant coherence and stable scope key;
- repository/package identity uniqueness within scope;
- candidate ownership on all material;
- reference integrity and duplicate prevention;
- cross-candidate, cross-scope, and cross-tenant rejection;
- stable IDs and canonical digest uniqueness;
- update denial for immutable rows;
- no lifecycle self-reference and no supersession cycle;
- timezone-aware timestamps and temporal coherence expressible locally;
- mandatory tenant expiry and public expiry policy; and
- indexes supporting stable active-as-of, snapshot membership, expiry purge,
  and tenant deletion paths.

## Retention and deletion matrix

Working decision pending ADR confirmation: tenant payload insertion requires an
explicit caller-supplied expiry. There is no implicit indefinite default.

| Storage class                                | Expiry                                                  | Purge                                                  | Tenant deletion         | Tombstone content                                   |
| -------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------ | ----------------------- | --------------------------------------------------- |
| Public catalog/evidence/lifecycle/snapshot   | no tenant expiry requirement; explicit public lifecycle | never removed by tenant purge                          | preserved               | none                                                |
| Tenant candidate identity/capability         | required                                                | bounded deterministic batch/cascade only within tenant | deleted transactionally | no identity payload                                 |
| Tenant evidence/limitation/unknown/lifecycle | required and coherent with owner/snapshot retention     | bounded; live snapshot references protected            | deleted transactionally | no statement, URL, provenance, or digest            |
| Tenant dossier snapshot/membership           | required and no later than retained members             | expired snapshots first                                | deleted transactionally | no dossier or membership                            |
| Tenant tombstone                             | minimal operational deletion fact only                  | separately documented retention                        | created during deletion | tenant opaque ID, deletion time, stable reason only |

No scheduler or worker is added. Backup and deployed derived-index deletion
remain future deployment obligations; the package must not claim they exist.

## Client, query, and migration research

Research completed on 2026-07-28 using official project documentation,
PostgreSQL documentation, official npm registry metadata, the GitHub Advisory
Database, and the resolved container registry manifest. ADR 0004 compares:

- maintained low-level drivers: `postgres@3.4.9` and `pg@8.22.0` with
  `@types/pg@8.20.0`;
- typed-query/mapping approaches: `kysely@0.29.4` and
  `drizzle-orm@0.45.2`; and
- migration approaches: `node-pg-migrate@9.0.0`,
  `graphile-migrate@1.4.1`, and an owned explicit-SQL migrator.

For each serious option ADR 0004 records exact version,
license, Node 24, TypeScript 6, ESM, release date, repository/publisher
provenance, lifecycle scripts, peers, direct/transitive footprint, advisories,
transactions, cancellation, migration behavior, SQL transparency, JSONB,
testability, and limitations. Rejected options will not be installed merely to
fill a research gap.

The selected database is PostgreSQL major 18, locally and in CI through
`postgres:18.4-bookworm` pinned to multi-architecture index digest
`sha256:1961f96e6029a02c3812d7cb329a3b03a3ac2bb067058dec17b0f5596aca9296`.
The selected driver is the strict-ESM, zero-dependency `postgres@3.4.9`.
Migrations are repository-owned, forward-only, checksummed SQL serialized by a
fixed PostgreSQL advisory transaction lock.

Exact-version queries against the GitHub Advisory Database returned zero
matching advisories for every compared package on 2026-07-28. This is research
evidence, not a substitute for the final pnpm audit of the resolved graph.

Selection constraints:

- framework-neutral and strict ESM;
- transparent parameterized SQL and explicit transactions;
- deadline/cancellation behavior that can be safely mapped;
- no code generation or implicit schema synchronization;
- no internal environment reads or singleton pool;
- deterministic forward SQL migrations with checksums and locking; and
- smallest justified exact dependency graph under existing pnpm controls.

## Dependency and supply-chain review

The accepted dependency decision adds exactly `postgres@3.4.9`:

- Unlicense, official `porsager/postgres` repository, published by maintainer
  `porsager` on 2026-04-05;
- Node `>=12`, native ESM plus a CJS export, bundled declarations, and
  TypeScript 6 compilation to be proven in this repository;
- 37 files / 299,744 unpacked bytes, zero dependencies, zero peers, no native
  addon, and no build requirement;
- SHA-512 registry integrity
  `sha512-GD3qdB0x1z9xgFI6cdRD6xu2Sp2WCOEoe3mtnyB5Ee0XrrL5Pe+e4CCnJrRMnL1zYtRDZmQQVbvOttLnKDLnaw==`;
- registry signature but no SLSA provenance attestation;
- source-development `prepare`/`prepublishOnly` scripts but no consumer
  `preinstall`, `install`, or `postinstall`; and
- no advisory match on the research date.

The repository-owned migrator adds no migration dependency. Postgres.js
replacement is localized behind package-owned client/query helpers and does not
affect the stored SQL record model.

Final lockfile review confirms:

- the exact manifest/lockfile delta was generated by pnpm and resolves
  `postgres@3.4.9`;
- license and official repository/publisher provenance;
- publication/release age and maintenance state;
- Node engine, TypeScript declarations, ESM entry behavior, and peer range;
- published lifecycle scripts and any `requiresBuild` marker;
- Postgres.js adds zero transitive dependencies; the complete persistence
  production graph is nine packages including the already-approved
  contracts/domain/Ajv/TypeBox graph;
- the resolved integrity matches the reviewed metadata; no exotic,
  prerelease, peer, native, or lifecycle build was added;
- exact-version Advisory Database research found no match and
  `pnpm security:audit` found no known vulnerability;
- `allowBuilds`, trust settings, and every existing supply-chain control remain
  unchanged; and
- replacement cost and limitations.

## Migration inventory and procedure

Committed inventory:

1. `0001_evidence_persistence.sql` — dedicated schema, roles/grants contract,
   scope/RLS helpers, tenants/tombstone, candidates/capabilities, immutable
   evidence/limitations/unknowns/reference tables, lifecycle, snapshots,
   membership, triggers/functions, constraints, indexes, and policies. Exact
   SHA-256:
   `0b6f55dfc97366443579f5ac439619f081bc6a5d3d366b50d3d848eb3f6b6165`.

The owned migrator:

1. validate configured migration metadata and supported PostgreSQL major;
2. begin an explicit transaction;
3. acquire one fixed advisory transaction lock;
4. bootstrap the schema-qualified history table if absent;
5. load committed SQL and compute SHA-256;
6. compare every historical row with the committed inventory;
7. fail safely on drift, gaps, unknown applied versions, or unsupported
   server;
8. apply each pending migration transactionally where PostgreSQL permits;
9. record version/name/checksum in the same transaction; and
10. release by commit/rollback.

Repeat apply is a no-op after checksum verification. Concurrent attempts
serialize. There are no destructive down migrations. Application-code rollback
may precede a corrective forward migration only while the old code remains
compatible. Irreversible data deletion requires restore or forward recovery,
not a claimed lossless down migration.

## Persistence API inventory

Names may be refined only for clarity; behavior remains:

- `createPersistenceClient`
- `closePersistenceClient`
- `applyMigrations`
- `verifyMigrations`
- `createTenant`
- `putCatalogCandidate`
- `setCandidateCapabilityFamilies`
- `appendEvidenceObservation`
- `appendCandidateLimitation`
- `appendCandidateUnknown`
- `recordEvidenceSupersession`
- `recordEvidenceInvalidation`
- `createCandidateDossierSnapshot`
- `loadCandidateDossierSnapshot`
- `selectActiveDossierMaterial`
- `purgeExpiredTenantData`
- `deleteTenantData`

All operations use fixed SQL text, explicit scope/context, injected
configuration or pool, explicit transactions for writes, stable bounds and
ordering, optional abort/deadline input, and value-free stable errors.

## Domain/contract mapping strategy

- Candidate dossier external shape remains owned by
  `@gitblocks/contracts`.
- Canonical payload digests use one package-owned deterministic JSON
  serialization over product DTOs/storage commands after product validation.
- Evidence JSONB retains the exact closed source variant; normalized columns
  exist only for ownership, lifecycle, integrity, query, and index needs.
- Limitation and unknown reference tables enforce database ownership while
  canonical payloads preserve exact product statements and codes.
- Snapshot creation validates the complete dossier through
  `parseCandidateDossierV1`, locks the candidate ownership row, reads exact
  immutable material in stable order, validates scope/candidate/expiry
  coherence, inserts metadata and memberships in one transaction, and verifies
  the supplied/computed digest.
- Snapshot loading uses the exact stored membership and stored historical
  identity, reconstructs a V1 dossier, checks the digest, and reruns the
  product parser. It never substitutes currently-active evidence.
- Storage conformance may map evaluation records in the private harness;
  `@gitblocks/persistence` never imports evaluation types, records, or gold.

## Transaction and concurrency cases

| Operation              | Transaction/concurrency policy                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Migration              | fixed advisory transaction lock; history/checksum verified under lock                                              |
| Immutable append       | single `INSERT ... ON CONFLICT DO NOTHING`; fetch/compare digest after conflict; never read-then-unprotected-write |
| Capability replacement | candidate row lock; validate bounded unique family set; replace atomically                                         |
| Supersession           | lock candidate ownership; cycle check and insert in one transaction                                                |
| Invalidation           | lock candidate ownership; append once with candidate/scope consistency                                             |
| Snapshot creation      | lock candidate ownership; read exact immutable material in stable order; validate and insert atomically            |
| Active-as-of           | one read-only transaction/snapshot with explicit cutoff and stable ID order                                        |
| Expiry purge           | one bounded batch selected deterministically with locks; delete snapshot dependents before unreferenced material   |
| Tenant deletion        | tenant lock; delete all tenant payload/cascades and create minimal tombstone in one transaction                    |
| Cancellation           | abort/deadline cancels query where driver supports it; transaction rolls back; safe error returned                 |

Tests use observable barriers or simultaneous promises, never arbitrary sleeps.

## Test-database strategy

ADR 0004 selects PostgreSQL 18.4 through the pinned official image digest. The
test policy is:

- one currently supported PostgreSQL major and an exact patch/container digest
  for CI and local integration;
- a local ephemeral container path with no persistent volume, random host port,
  health check, unique database/schema, and reliable cleanup;
- connection details supplied only by the local/CI test boundary;
- migration owner plus separate non-owner/non-superuser runtime login;
- no developer production database and no silent test skip;
- CI PostgreSQL verification is mandatory in `verify:ci`;
- ordinary offline `verify` may remain database-independent with the coverage
  difference documented; and
- root commands map to `db:migrate`, `db:check`, `db:test`, and `db:verify`.

If a container engine is unavailable locally, the database command must fail
with a bounded prerequisite message rather than report success or skip.

## Row-isolation test strategy

The integration suite will connect as a non-owner/non-superuser runtime role
and prove:

- tenant A reads/writes/references only tenant A;
- tenant B is invisible to tenant A even when IDs are known;
- public rows follow the explicit read policy;
- tenant runtime cannot write public rows;
- missing tenant context exposes public rows only;
- malformed context fails closed without unsafe detail;
- cross-tenant and cross-scope references are rejected by PostgreSQL;
- the table owner/superuser is not the identity used for isolation assertions;
  and
- deletion/purge for one tenant leaves public and the other tenant unchanged.

Catalog inspection will assert RLS enabled/forced and the expected policies on
every tenant-capable table.

## Performance and index rationale

No production latency claim is made. Review targets bounded predictable work:

- immutable identity lookups use scope-key/stable-ID unique indexes;
- active-as-of evidence uses scope/candidate/time plus lifecycle reference
  indexes;
- snapshot membership uses snapshot plus deterministic ordinal/ID keys;
- tenant purge uses tenant/expiry/stable-ID indexes;
- tenant deletion uses tenant-leading indexes on all tenant tables;
- public repository and package uniqueness use scope-aware unique indexes;
- page/batch inputs have named finite maxima; and
- no query returns an unbounded collection.

Integration tests use `EXPLAIN` only for index eligibility of the principal
active/as-of and expiry paths, not as a hardware-dependent timing benchmark.
Index additions require a named query/invariant; speculative indexes are
excluded.

## Implementation milestones

### Milestone 1 — Plan, research, and ADR

Status: complete.

- Complete this initial plan and Issue #11 crosswalk.
- Research official PostgreSQL/client/query/migration options and package
  metadata.
- Create ADR 0004 with selected versions, role/RLS, storage, lifecycle,
  retention, cancellation, CI, and recovery decisions.
- Validate documents and branch policy.

### Milestone 2 — Package skeleton and migrations test-first

Status: complete.

- Add package manifest/config/public surface with no import I/O.
- Add migration inventory and tests for clean/repeat/drift/concurrency/failure,
  schema qualification, version, and no implicit migration.
- Implement only enough migrator/client behavior to make those tests pass.

### Milestone 3 — Scope, catalog, and immutable material

Status: complete.

- Add failing integration tests for runtime-role isolation, catalog identity,
  all provenance variants, references, idempotency, conflicts, concurrency,
  update denial, rollback, injection, errors, and bounds.
- Implement candidates, capabilities, evidence, limitations, and unknowns.

### Milestone 4 — Lifecycle and snapshots

Status: complete.

- Add failing tests for supersession/invalidation self/cycle/scope rules,
  active-as-of cutoffs, exact snapshot membership, parser-valid reconstruction,
  atomicity, and historical stability.
- Implement lifecycle and snapshot operations.

### Milestone 5 — Retention and deletion

Status: complete.

- Add failing tests for mandatory expiry, coherence, bounded purge,
  non-expired/public preservation, full isolated deletion, minimal tombstones,
  and no reconstruction.
- Implement purge and tenant deletion.

### Milestone 6 — Conformance, architecture, docs, and full validation

Status: complete.

- Extend only private harness/tooling needed for ten-case plus non-pilot
  storage conformance.
- Update repository invariants, dependency-cruiser, scripts/references, Vitest,
  CI, README, AGENTS, CONTRIBUTING, engineering standards, system context,
  ADR, and this plan.
- Run the complete local PostgreSQL and repository matrix; record every failure
  and correction.

### Milestone 7 — Publication and hosted evidence

Status: complete. The implementation commit was pushed normally, the exact-title
draft PR was opened, and its PostgreSQL-enabled Verification job passed with
decoded logs inspected.

- Review complete diff and scope.
- Create intentional Conventional Commits.
- Push normally to `feat/11-evidence-persistence`.
- Open the exact-title draft PR with `Closes #11`.
- Inspect the PostgreSQL-enabled Verification run, jobs, steps, and decoded
  logs; correct failures only with ordinary follow-up commits.
- Leave the PR draft and unmerged.

## Testing and validation strategy

Required suites:

- unit/contract tests for bounds, canonical digest, safe error mapping, client
  configuration, import side effects, and no implicit migration;
- real-PostgreSQL integration tests for migrations, RLS, constraints,
  transactions, concurrency, lifecycle, snapshots, retention, deletion, and
  cancellation;
- security/abuse tests for injection, cross-tenant access, malformed context,
  payload/error leakage, oversized batches, dynamic identifiers, and
  prohibited imports/capabilities;
- all seven evidence provenance round trips;
- ten pilot dossier storage/reconstruction plus separate non-pilot fixtures;
- architecture/repository invariants for package count and dependency
  direction; and
- existing evaluation/scoring fixtures unchanged.

Exact final commands, from repository root under Node `24.18.0`, pnpm
`11.17.0`, and the ADR-selected PostgreSQL:

```bash
source /Users/karthikgudipati/.nvm/nvm.sh
nvm use
node --version
pnpm --version
pnpm runtime:check
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm test:coverage
pnpm architecture:check
pnpm repo:check
pnpm eval:validate
pnpm eval:fixtures
pnpm contracts:validate
pnpm db:migrate
pnpm db:check
pnpm db:test
pnpm db:verify
pnpm security:secrets
pnpm security:audit
pnpm verify
pnpm verify:ci
git diff --check
git status --short --branch
git diff --stat
git diff
```

The final validation also inspects package count/imports, migration server and
role identities, test skip count, all ten/non-pilot conformance, gold status,
candidate execution absence, prohibited component absence, and post-frozen
install/worktree cleanliness.

## Observability and operations

This package cannot receive production traffic and this phase adds no
deployment, telemetry backend, service, worker, scheduler, or shared
environment. Production-path traces/metrics/logs/audit export therefore cannot
be truthfully implemented here.

The adapter still exposes stable value-free error codes suitable for future
correlated instrumentation and performs no default logging. Correlation remains
caller-owned and is not accepted as a SQL or persistence payload. Tests prove
connection strings, SQL parameters, statements, source URLs, and payload text
are absent from public errors. A future composition ADR must add application
authorization/audit and deployed telemetry before this adapter handles
production data.

The local/CI database path owns health checking, bounded startup/cleanup, and
nonzero failure on missing prerequisites. No database health endpoint or
runbook is added because no service is deployed.

## Migration, compatibility, rollout, and recovery

This phase creates persisted schema version 1 from an empty database; there is
no production data or deployed old consumer to backfill.

- Migrations are forward-only, ordered, checksummed, explicit, and
  transactionally applied under an advisory lock.
- Historical SQL edits fail verification; corrections use a new forward
  migration.
- Mixed-version rule: code may run only when all known migration checksums
  match and no unknown applied migration exists; operations requiring pending
  schema fail safely until explicit migration.
- No package import, client creation, build, unit test, or offline verify
  applies migrations.
- A code rollback is allowed only to a version compatible with the applied
  schema. Otherwise restore an approved database backup or deploy a corrective
  forward migration.
- Purge and tenant deletion are intentionally irreversible for payloads.
  Recovery is restore from an authorized pre-deletion backup subject to the
  same deletion policy, not a down migration.
- There is no production rollout, credential, backup, or remote enablement in
  this phase.

## Exact exit criteria

Phase 4 is complete only when:

- every Issue #11 crosswalk row has an implemented artifact and exact evidence;
- ADR 0004 and this plan reflect final decisions and discoveries;
- exactly one new production package exists;
- all migrations and operations satisfy the stated database invariants;
- real PostgreSQL tests use a non-owner runtime role with no skips;
- all ten pilot dossiers and non-pilot fixtures store/reconstruct while gold
  remains proposed/not-reviewed and evaluation scoring is unchanged;
- full local validation, clean frozen install, architecture/security review,
  and hosted PostgreSQL CI pass on the published head;
- every failure and correction is recorded below;
- no prohibited product component, candidate execution, production credential,
  live baseline, gold acceptance, direct-main push, history rewrite, rebase,
  squash, amend-after-publication, or force-push occurred; and
- the exact-title PR exists as draft and remains unmerged.

## Progress log

- 2026-07-28: Verified local/remote `main` at
  `e7ae0ba4270b3fb24f144cdb6053355c761b82e5`, clean worktree, merged PR #10,
  closed Issue #9, open Issue #11, two product packages, no persistence/DB
  infrastructure, and proposed/not-reviewed gold.
- 2026-07-28: The first runtime attempt found no sourced nvm and standalone
  pnpm 11.9.0; runtime policy failed closed. Located and sourced the existing
  nvm installation without installing anything; confirmed Node 24.18.0 and
  Corepack pnpm 11.17.0.
- 2026-07-28: Completed the merged baseline: frozen install, 637 tests,
  architecture, repository, evaluation, fixture, contract conformance, and
  secret checks passed.
- 2026-07-28: Created `feat/11-evidence-persistence` from verified current
  `main`.
- 2026-07-28: Began planning, contract/storage mapping inspection, threat
  modeling, and official client/query/migration research.
- 2026-07-28: Completed official PostgreSQL, driver, typed-query, mapping, and
  migration research. Exact-version GitHub Advisory Database queries found no
  matches for the compared packages.
- 2026-07-28: Accepted ADR 0004: PostgreSQL 18 only, exact 18.4 container,
  `postgres@3.4.9`, repository-owned checksummed forward SQL, hybrid normalized
  plus canonical JSONB records, forced RLS, mandatory tenant expiry,
  append-only lifecycle, exact snapshots, and forward recovery.
- 2026-07-28: Added exactly one product package,
  `@gitblocks/persistence`, with injected client ownership, stable value-free
  errors, explicit transactions, one checked forward migration, the complete
  persistence API, no import I/O, and no implicit migrations.
- 2026-07-28: Added PostgreSQL 18.4 local/CI infrastructure, forced-RLS
  tenant-runtime and public-writer roles, immutable storage/lifecycle/snapshot
  integration tests, all-ten-case conformance, and separate non-pilot fixtures.
- 2026-07-28: Real-database iteration exposed and corrected SQL qualification,
  driver JSONB encoding, runtime lock privilege, immutable-child locking, and
  generated-column trigger timing defects before the integration suite passed.
- 2026-07-28: Updated dependency-cruiser fixtures, repository invariants, root
  commands/references, hosted CI, README, AGENTS, CONTRIBUTING, development,
  testing, security, reliability, and system-context documentation.
- 2026-07-28: Ordinary tests pass at 32 files / 650 tests; V8 coverage is
  78.45% statements, 71.48% branches, 84.34% functions, and 78.39% lines.
  The separate PostgreSQL graph passes 2 files / 15 tests with no skips.
- 2026-07-28: Created ordinary commit
  `1eb80e185d8423df3f4c07788d6ef9c9cbf97410`, pushed it normally to
  `feat/11-evidence-persistence`, and opened exact-title draft PR
  [#12](https://github.com/kgudipati/gitblocks/pull/12) with `Closes #11`.
- 2026-07-28: GitHub Actions run
  [30428692978](https://github.com/kgudipati/gitblocks/actions/runs/30428692978),
  Verification job `90500722393`, passed. Decoded logs confirmed the exact
  PostgreSQL digest, healthy service, frozen installation, PR metadata, 650
  ordinary tests, 15 database tests, one migration, 15 forced-RLS tables,
  ten-case/40-candidate proposed/not-reviewed conformance, dependency and
  repository checks, audit, no skipped integration tests, and unchanged
  worktree.

## Decision and deviation log

- 2026-07-28 — Preserve the contract DTO as reconstruction authority and treat
  storage scope/lifecycle fields as adapter records. Reason: ADR 0003 explicitly
  forbids storage representations from becoming domain truth.
- 2026-07-28 — Plan a hybrid normalized-plus-canonical-JSONB record model.
  Normalized columns enforce ownership, RLS, lifecycle, retention, references,
  and indexes; canonical closed payloads preserve exact product variants and
  deterministic reconstruction. ADR 0004 accepts this model.
- 2026-07-28 — Prefer mandatory caller-supplied tenant expiry over an implicit
  default because the package has no application policy owner and must not
  create accidental indefinite retention. ADR 0004 accepts this policy.
- 2026-07-28 — Keep one initial forward migration unless implementation
  discoveries require independently reviewable later corrections. Test-only
  migrations may exercise transactional failure but are not committed product
  migrations.
- 2026-07-28 — Select `postgres@3.4.9` over node-postgres, Kysely, and Drizzle.
  It provides transparent parameterized SQL, transactions, cancellation,
  native ESM, bundled types, and JSONB support with zero transitive
  dependencies. Server-side timeouts compensate for best-effort cancellation.
- 2026-07-28 — Own the migration runner instead of adding node-pg-migrate or
  graphile-migrate. The required fixed inventory, exact-byte SHA-256 drift
  detection, advisory transaction lock, and no-down policy are smaller and
  clearer as reviewed repository code.
- 2026-07-28 — Support PostgreSQL major 18 only and pin the local/CI server to
  official PostgreSQL 18.4 by multi-architecture digest. Minor updates are
  reviewed ordinary changes; another major requires explicit compatibility
  evidence.
- 2026-07-28 — Accept mandatory caller-supplied tenant expiry, forced RLS with
  separate tenant-runtime/public-writer group roles, hybrid normalized plus
  canonical JSONB records, and exact immutable snapshot membership as the
  final ADR policy.
- 2026-07-28 — Use the candidate ownership row as the runtime serialization
  lock for lifecycle and snapshot creation. Evidence children are immutable
  and cannot be independently deleted; this avoids granting `UPDATE` solely to
  make `FOR UPDATE`/`FOR SHARE` child locks possible. Exact members are still
  read in stable order and protected by composite references.
- No scope deviation has been approved.

## Validation evidence

| Date       | Command/review                                                                                                                                                                         | Result                                                                                                                                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-28 | required Git state/fetch/pull/history/revision/branch checks                                                                                                                           | clean; local and remote `main` match expected SHA                                                                                                                                                                                      |
| 2026-07-28 | connected Issue #11, Issue #9, and PR #10 inspection                                                                                                                                   | Issue #11 open/full scope read; Issue #9 closed; PR #10 merged                                                                                                                                                                         |
| 2026-07-28 | repository/package/database infrastructure inventory                                                                                                                                   | exactly two product packages; no persistence/DB/migrations/PG CI                                                                                                                                                                       |
| 2026-07-28 | initial unsourced `nvm use`, `node`, pnpm/runtime attempt                                                                                                                              | failed safely: nvm/node absent from PATH; pnpm 11.9.0 rejected                                                                                                                                                                         |
| 2026-07-28 | sourced existing nvm; Node/pnpm/runtime/frozen install                                                                                                                                 | Node 24.18.0; pnpm 11.17.0; exit 0                                                                                                                                                                                                     |
| 2026-07-28 | `pnpm verify`                                                                                                                                                                          | exit 0; 31 files / 637 tests; architecture 589/1,896                                                                                                                                                                                   |
| 2026-07-28 | `pnpm contracts:validate`                                                                                                                                                              | exit 0; 10 cases / 40 candidates; proposed/not-reviewed                                                                                                                                                                                |
| 2026-07-28 | `pnpm eval:validate`; `pnpm eval:fixtures`                                                                                                                                             | exit 0; 10 cases and all fixed fixtures                                                                                                                                                                                                |
| 2026-07-28 | initial migration smoke test                                                                                                                                                           | failed on invalid `pg_catalog.coalesce` qualification; corrected to PostgreSQL special-syntax `coalesce`                                                                                                                               |
| 2026-07-28 | first JSONB round trip                                                                                                                                                                 | failed because a string parameter encoded canonical JSON as a JSON string; corrected to the driver's explicit JSON helper                                                                                                              |
| 2026-07-28 | first capability replacement                                                                                                                                                           | failed because runtime `FOR UPDATE` lacked candidate update privilege; added the narrow RLS/grant while the immutable trigger continues to reject updates                                                                              |
| 2026-07-28 | first snapshot material locking                                                                                                                                                        | failed because `FOR SHARE` on immutable children required inappropriate update privilege; moved serialization to the candidate ownership lock                                                                                          |
| 2026-07-28 | first snapshot insert                                                                                                                                                                  | failed because a `BEFORE INSERT` trigger read a not-yet-computed generated scope key; derived the key from validated scope/tenant inputs                                                                                               |
| 2026-07-28 | first `pnpm architecture:check`                                                                                                                                                        | failed because dependency-cruiser normalizes two Node built-ins to `crypto` and `fs/promises`; corrected the exact Node API allowlist; rerun passed at 603/1,931                                                                       |
| 2026-07-28 | first dedicated integration invocation                                                                                                                                                 | failed with no matching tests under the offline root include; added separate no-skip `vitest.db.config.ts`                                                                                                                             |
| 2026-07-28 | first `pnpm lint`                                                                                                                                                                      | failed on script project discovery and strict driver/test value narrowing; added a scripts tsconfig and narrowed `unknown` values without disabling rules; rerun passed                                                                |
| 2026-07-28 | first `pnpm test`                                                                                                                                                                      | failed because temporary repository fixtures and one runtime assertion modeled Phase 3; upgraded them to Phase 4; rerun passed                                                                                                         |
| 2026-07-28 | first manual validation-container health loop                                                                                                                                          | failed because zsh reserves `status`; renamed the local variable and reprovisioned the disposable container                                                                                                                            |
| 2026-07-28 | `pnpm lint`; `pnpm typecheck`; `pnpm architecture:check`; `pnpm repo:check`                                                                                                            | exit 0; no rule weakening                                                                                                                                                                                                              |
| 2026-07-28 | `pnpm test`                                                                                                                                                                            | exit 0; 32 files / 650 tests                                                                                                                                                                                                           |
| 2026-07-28 | `pnpm test:coverage`                                                                                                                                                                   | exit 0; 78.45% statements, 71.48% branches, 84.34% functions, 78.39% lines                                                                                                                                                             |
| 2026-07-28 | `pnpm db:migrate`; `pnpm db:check`; `pnpm db:test`                                                                                                                                     | exit 0 against a fresh no-volume PostgreSQL 18.4 container; 1 migration; 15 forced-RLS tables; 2 files / 15 tests                                                                                                                      |
| 2026-07-28 | `pnpm db:verify`                                                                                                                                                                       | exit 0; self-provisioned exact-digest PostgreSQL 18.4; 1 migration; 15 forced-RLS tables; no skips; cleanup confirmed                                                                                                                  |
| 2026-07-28 | final Node/pnpm/frozen install plus format, lint, typecheck, build, test, coverage, architecture, repository, evaluation, fixtures, contracts, secrets, audit, and `pnpm verify` graph | exit 0 under Node 24.18.0 and pnpm 11.17.0                                                                                                                                                                                             |
| 2026-07-28 | final local `pnpm verify:ci`                                                                                                                                                           | exit 0; offline graph, exact-digest PostgreSQL graph, and registry audit all passed                                                                                                                                                    |
| 2026-07-28 | first `pnpm repo:branch` audit call                                                                                                                                                    | usage error because the branch value was omitted; reran with `-- feat/11-evidence-persistence`, then branch and exact PR-title checks passed                                                                                           |
| 2026-07-28 | final scope/static review                                                                                                                                                              | exactly three product packages (one new); domain/contracts direction unchanged; no product-to-tool/eval/prohibited import; gold/manifest/scoring unchanged; no skipped database tests; `main` and `origin/main` remain at expected SHA |
| 2026-07-28 | first decoded-log request while the hosted job was active                                                                                                                              | GitHub's temporary log blob returned not found; waited for completion and then fetched/decoded the complete job log successfully                                                                                                       |
| 2026-07-28 | GitHub Actions run `30428692978`, Verification job `90500722393`                                                                                                                       | success; every step passed, including exact PostgreSQL service, authoritative verification, final worktree check, and container cleanup                                                                                                |

No hosted failure required a code correction.
