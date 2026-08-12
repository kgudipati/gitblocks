# Recovery R3 PostgreSQL retrieval serving

## Status and authority

- Governing issue: [#36 — Recovery R3: Serve retrieval catalog from PostgreSQL](https://github.com/kgudipati/gitblocks/issues/36)
- Branch: `feat/36-postgresql-retrieval-serving`
- Owner: GitBlocks maintainers
- State: complete; draft pull request published
- Last updated: 2026-08-11
- Baseline: clean `main`, `HEAD`, `main`, and `origin/main` all at
  `422b759f0f99950a4de5a34cc0570d8396453e88`

Issue #36 is the scope and acceptance authority. The
[product contract](../product/product-contract.md),
[system context](../architecture/system-context.md), ADRs
[0002](../architecture/decisions/0002-typescript-workspace-and-toolchain.md),
[0003](../architecture/decisions/0003-product-contract-kernel.md),
[0004](../architecture/decisions/0004-postgresql-evidence-persistence.md),
[0008](../architecture/decisions/0008-artifact-first-retrieval-foundation.md),
[0009](../architecture/decisions/0009-production-retrieval.md),
[0010](../architecture/decisions/0010-reviewed-retrieval-v2-authority.md), and
new [ADR 0011](../architecture/decisions/0011-postgresql-retrieval-serving.md)
govern architecture and compatibility. Repository engineering policy governs
implementation and validation. A conflict is resolved in that order and
recorded here before implementation expands.

## Purpose and user-visible outcome

The current executable Phase 9 retrieval engine accepts the committed
150-candidate profile and retrieval-metadata authorities. It cannot yet be
composed from the PostgreSQL state required by the hosted private-alpha
architecture. R3 makes this exact journey executable:

```text
fresh PostgreSQL
  -> migrations
  -> explicit offline bootstrap of accepted catalog/profile/metadata files
  -> one complete current serving snapshot
  -> SELECT-only serving login
  -> contract-validated profile and metadata authorities
  -> createCandidateRetrievalEngineV1(...)
  -> representative deterministic discovery result
```

The immediate beneficiary is the next hosted-composition developer: durable
shared catalog state can be loaded at startup or controlled refresh into the
existing immutable in-process retrieval engine. R3 does not implement a hosted
request server, MCP surface, target-conditioned fit, or deployment.

## Verified current repository state

- `git status --short --branch` reported clean `main...origin/main` before the
  branch was created. All four requested revision checks resolved to the R2
  baseline above.
- `pnpm runtime:check` exits 0 on the authoritative Node 24 preflight.
- Main contains migrations `0001` through `0004`; the generic migrator and
  database verifier currently expect four migrations and 25 public product
  tables.
- `gitblocks_persistence` is the existing `NOLOGIN` runtime group. It can write
  the public persistence model and read migration history; no SELECT-only
  serving group exists.
- `catalog/public-v1/candidate-profile-authority.json` is 2,051,396 bytes,
  contains 150 profiles, and binds semantic authority digest
  `fc85d7ea71c69cd5e56e5a73936ceba6263c4ea0ba8fc2d0802556d79cf9e879`.
- `catalog/public-v1/candidate-retrieval-metadata-authority.json` is 105,291
  bytes, contains the same 150 candidate IDs, and binds semantic authority
  digest
  `23c38be5e5b117c74832049ae58f455f4fd1731e167cf170038da516c44e5ef1`.
- Both authorities bind catalog `public-v1` digest
  `4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634`.
- `@gitblocks/contracts` already owns the only accepted parsers,
  canonicalizers, serializers, and digests for both authorities. The
  persistence adapter can consume those contracts without creating a new DTO.
- `@gitblocks/retrieval` already validates all injected authorities and builds
  the immutable six-channel engine. It has no persistence dependency and will
  remain unchanged.
- The existing catalog-only seed plan parses the committed public catalog and
  deterministically projects candidate identity and family membership. Its
  current standalone command is intentionally pinned to the pre-R3 migration
  boundary through an artifact-live helper; R3 bootstrap will reuse the plan
  and persistence operations without widening the dormant artifact proof path.
- Repository policy currently rejects every `0005` filename as a historical
  Phase 8 materialization safeguard. R3 narrows that prohibition to the
  prohibited profile-materialization migration rather than removing the
  safeguard.

Evidence commands: the requested four baseline Git commands, `git log -12
main`, `rg --files` over the affected packages and catalog, targeted `rg` over
migration/version assumptions, `jq` authority summaries, and `wc -c` authority
sizes.

## Current blocker and smallest solution

The blocker is observed, not hypothetical: the accepted profile and retrieval
metadata exist only as committed-file authorities, while the hosted
architecture requires PostgreSQL as the durable shared serving source. The
existing evidence, dossier, artifact, and interview tables cannot reconstruct
these distinct meanings and must not be overloaded.

The smallest solution is one forward migration with four serving tables, one
concrete publication/load module in the existing persistence adapter, and one
offline ingestion composition that reuses the committed authorities. The
retrieval engine remains an in-memory scan of 150 candidates. Search indexes,
services, caches, vectors, generic repositories, and framework layers are
explicitly deferred because no current measurement activates them.

## Scope and explicit non-goals

In scope:

- migration `0005` for an immutable serving snapshot root, per-candidate
  profile rows, per-candidate metadata rows, and one mutable current-snapshot
  selector;
- a `gitblocks_serving` `NOLOGIN` group with schema usage and SELECT only on
  those four tables;
- contract-validating, digest-checking, idempotent snapshot publication through
  `gitblocks_persistence`;
- current and exact historical snapshot loading through one concrete
  read-only loader entry point;
- an explicit offline bootstrap command that parses the accepted catalog,
  profile, and metadata files, seeds current public identity/families, then
  publishes/selects the coherent serving snapshot;
- PostgreSQL 18 integration tests for coherence, immutability, grants,
  corruption denial, history, and end-to-end retrieval equivalence;
- proportional ADR, package, catalog, product/system, testing, and operator
  documentation updates.

Out of scope: HTTP, MCP, hosted frameworks, deployment, LLM/model calls,
scanner or Skill work, target fingerprints or fit, ranking, evaluation gold or
new corpus work, provider collection, ingestion refresh redesign, artifact or
repository-interview activation, profile materialization proof, Redis, cache,
queue, worker, scheduler, vectors, full text, search service, ORM, another
database, microservices, tenancy, organizations, RLS, billing, crawler, or
Phase 10 reuse.

## Requirements crosswalk

| Issue requirement                            | Destination                                                                                                       | Evidence                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Minimal durable per-candidate representation | migration `0005`; persistence serving module                                                                      | schema checks; JSONB/record-digest integration tests                    |
| One coherent served snapshot                 | immutable root plus current selector and closure trigger                                                          | complete/incomplete/current/history tests                               |
| Offline bootstrap                            | ingestion bootstrap command and root script                                                                       | accepted-file 150-row integration; zero-network capability/source tests |
| Concrete read-only loader                    | persistence public entry point                                                                                    | current/historical/corrupt-state tests                                  |
| SELECT-only serving identity                 | migration role/grants and test login                                                                              | read success plus insert/update/delete/DDL denial                       |
| Existing retrieval equivalence               | existing accepted authorities and representative accepted blind inputs in the outward evaluation integration test | byte-identical committed/loaded product results                         |
| Exact executable outcome                     | documented fresh PostgreSQL exercise                                                                              | command transcript and observed deterministic result in plan/PR         |
| Preserve current 150 limit                   | migration count check and existing contract parsers                                                               | exact 150 records reconstructed; no contract version change             |

## Assumptions, risks, and unresolved decisions

Verified facts are listed above. Working assumptions are that the current
profile and metadata contract versions remain the only accepted serving
versions and that a startup/controlled-refresh caller supplies the already
accepted taxonomy and retrieval-expansion authorities alongside the loaded
database state.

The main risks are partial publication, stored JSONB corruption, a metadata to
profile identity mismatch, accidental serving-role write authority, migration
0005 breaking current catalog bootstrap, and a test that proves only loading
rather than retrieval equivalence. Database closure, existing parsers and
digests, exact catalog/profile/metadata cross-checks, explicit grants, and the
real PostgreSQL end-to-end test address them.

Decision: the current selector is a separate singleton table. Published
snapshot roots and candidate rows therefore stay immutable; selecting a newer
complete snapshot does not rewrite history.

Decision: snapshot identity is derived from the two accepted authority digests
and their shared catalog binding. The complete root record digest also binds
the operator-supplied publication timestamp. Exact replay with the same input
is idempotent; a different immutable record under the same semantic snapshot
identity conflicts.

Decision: root JSONB stores only authority headers with candidate arrays
removed. Candidate payloads remain one row each. This is a storage projection,
not another external DTO, and full authorities are reconstituted and parsed at
the load boundary.

Decision: the serving loader returns contract types plus the root-authenticated
expected metadata binding required structurally by retrieval. Persistence does
not import `@gitblocks/retrieval`; the future composition supplies taxonomy and
expansion separately and calls the existing engine.

No unresolved implementation choice currently changes scope. If the accepted
contracts cannot be reconstructed without a broader application or authority
family, work stops and Issue #36 is amended rather than adding that surface.

## Applicable ADRs and contracts

- ADR 0002: pnpm-only Node 24/TypeScript 6 workspace and authoritative
  verification remain unchanged.
- ADR 0003: existing TypeBox-derived profile and metadata types/parsers remain
  the sole DTO authority. No product contract version changes.
- ADR 0004: reuse PostgreSQL 18, Postgres.js, explicit clients, checked SQL,
  forward migrations, immutable conflict semantics, server timeouts, and
  value-free errors. Migration 0005 additively extends the concrete adapter.
- ADR 0008: activate only its deferred durable profile persistence need under a
  now-concrete production retrieval consumer; do not activate materialization.
- ADR 0009: preserve pure injected retrieval, its exact 150-candidate in-memory
  architecture, six channels, authority bindings, and lack of search indexes.
- ADR 0010: reviewed retrieval-v2 remains evaluation authority only; it is used
  by outward integration solely to select existing representative inputs.
- ADR 0011: records R3 snapshot, publication, role, loader, compatibility, and
  recovery decisions.
- `DeterministicCandidateProfileV1`,
  `DeterministicCandidateProfileAuthorityV1`, and
  `CandidateRetrievalMetadataAuthorityV1` are reused unchanged.

## Architecture, data flow, and performance impact

```text
offline bootstrap
  committed catalog/profile/metadata
    -> existing parsers and bindings
    -> idempotent catalog identity/family seed operations
    -> one atomic serving-publication PostgreSQL transaction
    -> immutable snapshot root + 150 profile + 150 metadata rows
    -> complete-snapshot closure
    -> current selector

startup / controlled refresh
  gitblocks_serving SELECT-only connection
    -> repeatable-read current snapshot load
    -> record/root digest and contract validation
    -> immutable authority values
    -> existing taxonomy + expansion + createCandidateRetrievalEngineV1

request
  normalize -> in-memory retrieve
```

Publication is bounded to exactly 150 profile and 150 metadata rows and one
transaction. Loading reads the same 301 immutable records plus one selector in
stable candidate order. There is no request-time database access in R3, no
pagination, retry, cache, background work, or concurrency setting beyond the
existing client/transaction bounds. Existing statement/lock timeout and
cancellation behavior applies. At roughly 2.2 MB of accepted JSON before JSONB
storage overhead, batching or a search index is not justified.

## Security, privacy, abuse, and supply chain

The new trust boundaries are committed inert JSON into the bootstrap and JSONB
back out of PostgreSQL. Existing parsers validate both crossings; failures are
value-free. Candidate/repository content remains inert data and is never
executed or treated as instructions. Bootstrap receives no provider, model,
network, repository-interview, candidate-code, Docker, or authority-generation
capability. It reads only fixed operator-supplied paths and injected database
configuration.

`gitblocks_serving` is `NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
NOREPLICATION NOBYPASSRLS`, owns no object, and receives only schema usage plus
SELECT on the four serving tables. The migration owner provisions deployment
logins separately; integration uses a non-owner, non-superuser login with only
that membership. Public shared catalog data requires no RLS or tenant system.
No production dependency or new package version is introduced. The ingestion
and outward evaluation test workspaces declare the already-pinned Postgres.js
test dependency, so the lockfile importer metadata changes without adding a
new registry package.

## Implementation milestones

### 1. Governing design and migration

- Add this plan and ADR 0011.
- Add migration 0005, migration inventory support, serving-role/table/function/
  trigger verification, and narrow the old Phase 8 filename prohibition.
- Add schema/grant/closure tests against real PostgreSQL 18.
- Completion evidence: an incomplete root cannot commit or become current and
  the serving login can SELECT but cannot write or perform DDL.

### 2. Publication, loader, and offline bootstrap

- Add persistence publication/load types and operations using existing
  contract parsers/digests and repeatable-read loading.
- Add offline ingestion composition and `serving:bootstrap` command using the
  existing public catalog seed plan plus the accepted profile/metadata files.
- Add unit/negative tests for argument/config validation, zero provider/model/
  network capability, exact replay, immutable conflict, missing/corrupt rows,
  history, and accepted 150-record reconstruction.
- Completion evidence: a fresh migrated database can be bootstrapped and loaded
  through `gitblocks_serving`.

### 3. Retrieval equivalence, documentation, and final proof

- Add one outward persistence integration using representative already
  accepted retrieval inputs; compare serialized product results from committed
  and PostgreSQL-loaded state.
- Update product/system/testing/package/catalog documentation with implemented
  behavior, the exact command, the V1 150 limit, compatibility, and recovery.
- Run the complete fresh-database exercise and all final gates; record exact
  outputs here and in the draft PR.
- Completion evidence: the Definition-of-Done journey is observed end to end
  and the final branch/PR contain no hosted/MCP/Phase 10 work.

## Testing and validation strategy

Focused development commands, from repository root:

```text
pnpm runtime:check
pnpm build:product
pnpm vitest run packages/persistence/test/unit.test.ts packages/ingestion/test/serving-catalog-bootstrap-cli.test.ts tools/repository-checks/test/repository-invariants.test.ts --config vitest.config.ts
pnpm db:test
```

The database suite must cover migration inventory and table constraints,
complete/incomplete publication, current selection, exact idempotency,
immutable conflict, historical loading, role read/write denial, missing/
inconsistent profile and metadata rows, accepted 150-record reconstruction,
and committed-versus-loaded retrieval equivalence. Unit/source-boundary tests
must prove bootstrap has no provider, model, network, artifact, interview, or
authority-generation capability. No live provider, model, interview,
materialization, or Phase 10 command will run.

Final commands, each once after focused checks are green:

```text
pnpm catalog:validate
pnpm ingestion:verify
pnpm contracts:validate
pnpm verify:ci
git diff --check
git status --short --branch
```

`pnpm verify:ci` is the final full regression: it includes `pnpm verify`, the
pinned PostgreSQL `pnpm db:verify`, and the registry-backed audit. Docker is
used only by that established database verification path. Expected result is
exit 0 with no skips. Any failure and resolution is recorded below rather than
replaced by the final pass.

The manual/executable check uses one fresh pinned PostgreSQL instance, applies
migrations, provisions separate writer and serving test logins, runs
`pnpm serving:bootstrap` with fixed accepted file paths and publication time,
loads through the serving login, constructs the engine with accepted taxonomy
and expansion, executes one representative discovery request, and records the
result digest/top candidate and equality with the committed path.

## Observability and operations

R3 adds no shared running service and no request path, so traces, metrics,
dashboards, alerts, health endpoints, SLOs, and telemetry export are not
applicable. Persistence operations retain stable value-free errors and emit no
logs, SQL, payloads, or connection details. The offline bootstrap emits one
bounded content-free summary with snapshot identity/status and record counts;
its caller/composition may instrument that explicit operation later. The
future hosted application owns serving-load startup telemetry before deployed
traffic.

## Migration, compatibility, rollout, and recovery

Migration 0005 is additive and forward-only. Existing 0001–0004 tables and
meanings are unchanged. Current generic migration/database verification moves
to five migrations; dormant Phase 6/8 proof contracts that deliberately bind
exact migration 0004 remain historical and are not widened or executed.

Rollout order is migration, writer-login membership, offline bootstrap, serving
login membership, read-only load verification, then future application use.
Old code ignores the new tables. New loading code fails closed until migration
0005 and a complete current snapshot exist. Code rollback leaves additive
tables and retained public data unused. Data correction publishes a new
immutable snapshot and selects it; published rows are never updated. A bad
current selection can be forward-recovered by selecting a previously verified
complete historical snapshot through the controlled publication operation.
No down migration or destructive cleanup is added.

## Exact exit criteria

- Issue #36, this plan, ADR 0011, compliant branch, commits, and draft PR are
  mutually linked and current.
- Migration 0005 and the four minimal tables enforce complete immutable
  snapshots and retain history.
- Exact accepted bootstrap is idempotent; conflicts and partial/corrupt state
  fail closed without selecting it.
- `gitblocks_serving` proves SELECT-only behavior through a non-owner login.
- The accepted 150 profiles and 150 metadata records reconstruct through the
  existing parsers.
- PostgreSQL-loaded and committed-authority paths produce byte-identical
  representative retrieval results.
- The full fresh PostgreSQL journey is exercised and documented.
- Focused and final validation commands above pass with no prohibited live
  effect, skipped PostgreSQL test, secret, unrelated change, or Phase 10 work.
- Complete diff, security, architecture, test, compatibility, documentation,
  and whitespace review finds no unresolved material issue.

## Progress log

- 2026-08-11: Verified clean/current R2 baseline at `422b759`; read governing
  R2 guidance, engineering policy, ADRs 0002/0003/0004/0008/0009/0010, and
  inspected current packages, migrations, authorities, tests, commands, and
  history. Runtime preflight passed.
- 2026-08-11: Created Issue #36 and branch
  `feat/36-postgresql-retrieval-serving`; recorded the initial plan and ADR
  before implementation.
- 2026-08-11: Added migration `0005` with one immutable serving root, two
  per-candidate JSONB record tables, a singleton current selector, deferred
  complete-set closure, historical retention, and `gitblocks_serving` SELECT
  grants. Updated generic migration verification to five migrations and 29
  public product tables while preserving exact migration-4 historical proof
  contracts.
- 2026-08-11: Added `publishServingCatalogSnapshot` and
  `loadServingCatalogSnapshot`. Publication validates both existing contracts,
  exact shared catalog/repository identities, immutable digests, and full
  150/150 closure before selection. Loading is read-only repeatable-read,
  reconstructs current or historical existing authorities, and fails closed
  on missing or inconsistent state.
- 2026-08-11: Added the explicit `pnpm serving:bootstrap` accepted-file
  operator, with discrete database credentials, current migration verification,
  no provider/model/network capability, bounded output, and exact replay.
- 2026-08-11: Added real PostgreSQL coverage for schema and role grants,
  complete/incomplete publication, idempotency, immutable conflicts, history,
  corrupt profile/metadata denial, accepted 150-record reconstruction, and the
  outward committed-versus-loaded retrieval equivalence exercise.
- 2026-08-11: Completed the real fresh-database exercise and all focused and
  authoritative regression gates. The issue-linked draft pull request contains
  the exact operator command, role boundary, snapshot/result digests, and
  representative result IDs.

## Decision and deviation log

- 2026-08-11: Selected per-candidate JSONB plus an immutable root and separate
  current selector. Rejected one giant authority blob, field normalization,
  evidence/dossier overloading, and mutable `is_current` on snapshot roots.
- 2026-08-11: Kept the existing exact-150 contract. Larger catalogs require a
  later versioned product change rather than an R3 schema generalization.
- 2026-08-11: Kept taxonomy and retrieval expansion as separately accepted
  injected authorities. R3 persists only the missing Phase 9 per-candidate
  profile/metadata state and the bindings needed to authenticate it.
- 2026-08-11: Preserved dormant artifact/materialization exact-0004 contracts;
  R3 narrows only the repository filename prohibition and does not claim those
  historical operations run on migration 0005.
- 2026-08-11: PostgreSQL default collation did not reproduce the contracts'
  ASCII byte ordering for candidate IDs. Serving candidate reads now specify
  `COLLATE "C"`; no contract or stored payload changed.
- 2026-08-11: Revoking public function execution correctly denied the writer's
  deferred trigger call. The zero-argument trigger function now uses the same
  narrowly scoped `SECURITY DEFINER` pattern already present in migration 0004,
  with empty search path; the assertion function remains non-definer and both
  functions remain revoked from public/runtime roles.
- 2026-08-11: The real documented pnpm invocation passes a leading `--` to the
  CLI. Argument parsing now accepts that pnpm separator as well as direct CLI
  invocation, covered by regression test.
- 2026-08-11: The repository-interview operator now accepts either its
  historical exact migration-4 inventory or the additive current migration-5
  inventory and emits the actual verified latest/count values. Historical
  receipt validation remains compatible with migration 4.
- 2026-08-11: The historical materialization helper authenticates migration 5
  as the only permitted additive suffix while keeping its migration-4 schema,
  receipt, and execution authority frozen. Repository-interview tests likewise
  assert migration 4 remains present in its exact fourth position instead of
  treating it as the repository's global latest migration.
- 2026-08-11: The historical profile-materialization byte guard now binds the
  pnpm-generated R3 lockfile, whose only changes declare the already-pinned
  Postgres.js test dependency in two existing workspace importers.

## Validation evidence

- 2026-08-11: requested baseline Git commands — exit 0; clean main; all
  revisions exactly `422b759f0f99950a4de5a34cc0570d8396453e88`.
- 2026-08-11: `pnpm runtime:check` — exit 0; pinned runtime preflight passed.
- 2026-08-11: `pnpm db:verify` initially failed because migration-4
  repository-interview inventory assertions were current-runtime assumptions;
  those were made additively migration-5 compatible. A later focused R3 run
  exposed locale ordering and trigger-function privilege failures; both are
  recorded above and covered by the final tests.
- 2026-08-11: `pnpm install --lockfile-only` failed under the repository's
  intentional frozen-lockfile policy after an importer edit; rerunning with
  `--no-frozen-lockfile` updated the lockfile through pnpm, and normal
  `pnpm install` then passed the supply-chain policy.
- 2026-08-11: focused bootstrap CLI test — 5 passed; type checks and
  architecture check passed.
- 2026-08-11: focused R3 PostgreSQL integrations — 2 files, 4 tests passed,
  including committed-versus-loaded result equality.
- 2026-08-11: focused migration-compatibility regression after final-suite
  discovery — 2 files, 114 tests passed.
- 2026-08-11: `pnpm repo:check` — passed. `pnpm architecture:check` — 892
  modules and 3,040 dependencies cruised with no violations.
- 2026-08-11: exact fresh-database exercise — migration 0005; real
  `pnpm serving:bootstrap` through separate non-owner writer login; load through
  a separate `gitblocks_serving`-only login; existing contract validation and
  engine construction; authorization retrieval examined 150 candidates. The
  snapshot was
  `serving-6fb3890c53261a7f68ab8b1db20c6d9da9169ecc0f2510dc`, root digest
  `0f7c5730dfe00de6098316b809ec4d7eef533677960280ddd7695befde7a90e5`,
  and result digest
  `e3a45900b53ff6850ccc7a77281d9229f399e97ce41c2ef6132a1045364030cd`.
  PostgreSQL and committed results were exactly equal; the ten eligible IDs
  were `auth-casbin-casbin`, `auth-casbin-casbin-js`,
  `auth-casbin-node-casbin`, `auth-warrant`, `auth-aserto-topaz`,
  `auth-authzed-spicedb`, `auth-cerbos-cerbos`, `auth-open-policy-agent`,
  `auth-openfga`, and `auth-ory-keto`.
- 2026-08-11: `pnpm catalog:validate` — passed with 150 candidates and the
  accepted catalog digest.
- 2026-08-11: the first `pnpm ingestion:verify` run rejected the expected
  lockfile-byte guard after the pnpm-generated importer additions. The guard
  was rebound to the reviewed lockfile; the complete rerun passed 34 files and
  338 tests plus ingestion type checking.
- 2026-08-11: `pnpm contracts:validate` — passed 10 product conformance cases
  with 40 supplied candidates.
- 2026-08-11: the first final `pnpm verify:ci` run exposed 14 ordinary-test
  assertions that still treated migration 4 as globally latest. The additive
  compatibility changes above made the focused 114-test regression pass. The
  complete `pnpm verify:ci` rerun passed: 131 ordinary files/1,955 tests;
  formatting, lint, builds, all type checks, architecture and repository
  checks, offline evaluation/contract authorities, and secret scan; PostgreSQL
  18.4 with 5 migrations, 29 public product tables, zero RLS policies, 10
  database files/66 tests without skips; and registry audit with no known
  vulnerabilities.
