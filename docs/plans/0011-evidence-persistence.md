# Phase 4 immutable public evidence and dossier persistence

## Status and authority

- Governing issue:
  [#11 — Phase 4: Establish immutable public evidence and dossier persistence](https://github.com/kgudipati/gitblocks/issues/11)
- Existing branch: `feat/11-evidence-persistence`
- Existing draft PR:
  [#12 — feat: establish public evidence persistence](https://github.com/kgudipati/gitblocks/pull/12)
- Owner: GitBlocks maintainers
- State:
  `public-first implementation, scope reduction, independent-review corrections, validation, and hosted PostgreSQL CI complete; independent final review and merge authorization pending`
- Last updated: 2026-07-29
- Authority order: Issue #11; repository and Git history; product contract;
  system context and accepted ADRs; `AGENTS.md`, `PLANS.md`, engineering
  handbook; execution prompt.

The revised issue and maintainer comment supersede the tenant-lifecycle
portions of this plan's first published version. This plan records the
correction in place; it does not preserve unpublished compatibility wrappers.

## Purpose and outcome

Phase 4 now builds the smallest durable state needed by the first GitBlocks
product loop:

```text
public repository ingestion
        -> immutable public evidence and dossiers
        -> retrieval and ranking
        -> repository-conditioned recommendation
```

The result is one concrete PostgreSQL adapter that stores shared public OSS
candidate identity, immutable source-aware evidence, limitations, material
unknowns, append-only lifecycle events, and exact reproducible public dossier
snapshots. It also selects one complete reference-valid material set at an
explicit evidence-world cutoff.

This remains non-operational. No application port/use case, catalog
administration, ingestion, discovery, retrieval, ranking, transport, MCP,
authentication, organization workflow, model, queue, worker, deployment, or
production credential is added.

## Verified current repository and GitHub state

Verified before the correction:

- clean local
  `feat/11-evidence-persistence...origin/feat/11-evidence-persistence`;
- local and remote topic heads both
  `b64a42e3f3fe2d5759d504c63e6e96f4733c612a`;
- local and remote `main` both
  `e7ae0ba4270b3fb24f144cdb6053355c761b82e5`;
- PR #12 is open, draft, unmerged, and titled
  `feat: establish public evidence persistence`;
- Issue #11 is open and defines immutable public evidence/dossiers;
- PR comment `5114455426` is the maintainer scope correction;
- the published implementation has exactly one new product package,
  `@gitblocks/persistence`, PostgreSQL 18.4, `postgres@3.4.9`, one migration,
  and green pre-correction CI;
- proposed gold remains `proposed` / `not-reviewed`;
- no Phase 5/6 issue or repository component names an organization-persistence
  consumer; and
- no ingestion, retrieval, ranking, application, API/MCP, model, queue, worker,
  or deployment exists.

Commands/evidence:

```text
git status --short --branch
git fetch origin
git rev-parse HEAD
git rev-parse origin/feat/11-evidence-persistence
git rev-parse main
git rev-parse origin/main
connected GitHub Issue #11 / PR #12 / PR comments
repository and issue inventory
```

No branch, PR, merge, ready transition, amend, rebase, squash, history rewrite,
or force-push is authorized.

## Scope and non-goals

### In scope

- Rewrite ADR 0004 and migration 0001 in place.
- Keep PostgreSQL major 18, exact 18.4 image digest, and
  `postgres@3.4.9`.
- Retain exactly one new private strict-ESM product package.
- Remove tenant scope and lifecycle code/schema/docs/tests.
- Persist public candidate identity and mutable current capability families.
- Persist immutable public evidence, limitations, unknowns, lifecycle events,
  and exact dossier snapshots with complete-record digests.
- Normalize all applicable evidence-world timestamps.
- Correct capability replacement, snapshot idempotency/history, lifecycle
  cycles, and active reference closure.
- Keep real PostgreSQL local/CI verification with no skips.
- Prove ten pilot cases and five non-pilot dossiers.
- Correct public-candidate identity inconsistency exposed by shared storage,
  without changing evaluation scoring or gold review status.

### Explicit non-goals

- Tenant-private candidates/evidence, tenant context, RLS matrices, expiry,
  retention, purge, deletion, tombstones, resurrection, or private overlays.
- Organization tables without a named Phase 5/6 consumer.
- Users, membership, roles, invitations, billing, enterprise governance.
- Application package or persistence ports.
- Catalog administration, ingestion, source fetching, search, retrieval,
  ranking, or fit execution.
- HTTP, API, MCP, authentication, model, embeddings, outcomes, queue, worker,
  scheduler, deployment, or production credentials.
- Candidate repository/package cloning, installation, import, build, or
  execution.
- Live model/agent baseline, scoring changes, or gold acceptance.

## Revised Issue #11 crosswalk

| Requirement                                          | Artifact                                | Evidence                                         |
| ---------------------------------------------------- | --------------------------------------- | ------------------------------------------------ |
| Public-first rationale and deferred tenant lifecycle | ADR 0004; plan; system/engineering docs | complete diff review                             |
| PostgreSQL 18 and exact 18.4 image                   | ADR; scripts; CI                        | version/catalog and hosted logs                  |
| One package and `postgres@3.4.9`                     | manifests/lockfile/package              | inventory, architecture, audit                   |
| Checked forward migration                            | migration; migrator                     | clean/repeat/drift/failure/concurrent tests      |
| Public candidate uniqueness                          | candidate table/operation               | ID/repository/package tests                      |
| Set-diff capability membership                       | operation; membership table             | row-version and history tests                    |
| Seven evidence variants and normalized time          | evidence table/operation                | round trip/catalog/cutoff tests                  |
| Complete immutable-record idempotency                | record digests/operations               | metadata/payload/ownership/concurrency conflicts |
| Lifecycle consistency and cycles                     | FKs/check/trigger/operations            | timing, self/cycle, retry tests                  |
| Exact historical snapshots                           | snapshot/member tables/loader           | exact load after lifecycle/membership change     |
| Snapshot retry conflict                              | snapshot record digest                  | changed cutoff/ordered membership tests          |
| Active reference closure                             | active selection                        | inactive-support exclusion test                  |
| No tenant/private surface                            | schema/API/static review                | zero RLS; prohibited-term/API checks             |
| Ten pilot + five non-pilot dossiers                  | private harness + integration fixtures  | 40 pilot and 5 non-pilot reconstructions         |
| Real PostgreSQL local/CI                             | scripts/config/workflow                 | `db:verify`, `verify:ci`, hosted job             |
| Draft PR updated in place                            | PR #12                                  | draft/open/unmerged metadata                     |

## Product-contract and system-context crosswalk

| Authority                                 | Persistence consequence                                        | Unchanged                                |
| ----------------------------------------- | -------------------------------------------------------------- | ---------------------------------------- |
| Candidate dossier V1                      | Exact members reconstruct and pass `parseCandidateDossierV1`   | Product DTO/domain meaning               |
| Seven closed provenance variants          | Preserve canonical source and normalize applicable times       | Source validation remains contract-owned |
| Candidate ownership                       | Composite database references prevent cross-candidate material | Business interpretation                  |
| Bounded contract catalogs                 | Active selection returns at most 100/40/40 complete values     | No ranking/retrieval behavior            |
| Public evidence is attributable/untrusted | Parameterize SQL, revalidate rows, never execute content       | No ingestion/source client               |
| Future application owns ports/auth        | Adapter exposes concrete public storage operations only        | No application package                   |
| Evaluation data stays private             | Harness may call adapter; product never imports tools/gold     | Proposed gold/scoring                    |

## Applicable ADRs and contracts

- ADR 0001: headless delivery and non-execution boundary remain unchanged.
- ADR 0002: Node 24.18.0, pnpm 11.17.0, TypeScript 6.0.3, strict ESM, exact
  pins, frozen pnpm lockfile, supply-chain controls, Vitest, and CI remain.
- ADR 0003: contract/domain values remain authoritative; storage is an
  adapter representation.
- ADR 0004 is revised to public-first PostgreSQL persistence and supersedes its
  unpublished tenant/RLS/retention decision.
- The product contract vocabulary, six contract families, scoring, and gold
  lifecycle do not change.

## Architecture and data flow

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

Write flow:

```text
validated product value + normalized creation metadata
  -> complete immutable-record digest
  -> explicit bounded transaction
  -> parameterized insert under database uniqueness/ownership
  -> exact digest comparison on conflict
  -> stable value-free result
```

Snapshot load:

```text
snapshot metadata + exact ordered membership
  -> validate candidate/material complete-record digests
  -> reconstruct CandidateDossierV1
  -> validate dossier + snapshot digests
  -> rerun product parser
```

Active selection:

```text
candidate + evidence-world cutoff
  -> all applicable source/freshness timestamps <= cutoff
  -> remove effective superseded/invalidated evidence
  -> remove limitation/unknown with inactive support
  -> product-validate one bounded reference-closed set
```

## Organization decision

Both `organizations` and `organization_dossier_refs` are omitted. The
repository and open Phase 4 authority name public ingestion, retrieval, and
ranking as the near-term consumers; none needs organization identity or pins.
Adding either table would be unused future-proofing. A future application/API
issue may add organization identity and shared-snapshot links only after it
owns a concrete authorization/workflow use case.

## Public persistence threat model

### Assets and actors

- Shared public candidate identity and source-aware evidence.
- Immutable limitation/unknown/lifecycle records.
- Exact historical snapshot membership and digests.
- Migration history/checksums and injected test credentials.
- Migration owner, least-privilege public persistence runtime, future trusted
  ingestion/retrieval composition, and untrusted stored source text.

### Misuse and controls

| Misuse                                            | Control                                                             | Evidence                         |
| ------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------- |
| SQL injection via IDs/statements/URLs             | fixed SQL, parameters, no runtime raw SQL/dynamic identifiers       | inert sentinel/static tests      |
| Same ID overwrites metadata/payload               | complete-record digest + unique constraint + update trigger         | retry/concurrency/conflict tests |
| Repository/package aliases duplicate identity     | case-insensitive unique indexes                                     | candidate uniqueness tests       |
| Capability replacement churns unchanged rows      | candidate serialization + set diff                                  | `xmin` preservation tests        |
| Lifecycle creates self/cycle/cross-candidate edge | checks/FKs/advisory trigger                                         | negative lifecycle tests         |
| Storage time admits future evidence               | normalized evidence-world predicates                                | all-variant/future-time tests    |
| Active material has broken references             | deterministic dependent exclusion                                   | closure test                     |
| Historical snapshot drifts                        | exact ordered membership and digest/parser checks                   | history tests                    |
| Error exposes secret/SQL/payload/source           | value-free owned error mapping; no logs                             | sentinel redaction tests         |
| Stored content becomes instructions/code          | no process, fetch, import, evaluator, shell, or candidate execution | source/architecture tests        |
| Migration edit/race                               | SHA-256 history + advisory migration lock                           | drift/concurrency tests          |

Residual risk is intentionally narrow: no authenticated service or private data
exists. Future private/organization data requires a new threat model and
authorization/isolation/lifecycle decision.

## Storage and database invariants

Product tables:

1. `catalog_candidates`
2. `candidate_capability_families`
3. `evidence_observations`
4. `candidate_limitations`
5. `candidate_limitation_evidence`
6. `candidate_material_unknowns`
7. `candidate_unknown_evidence`
8. `evidence_supersessions`
9. `evidence_invalidations`
10. `candidate_dossier_snapshots`
11. `snapshot_evidence_members`
12. `snapshot_limitation_members`
13. `snapshot_unknown_members`

Migrator-owned `schema_migrations` is separate.

Database enforcement includes:

- deterministic candidate/repository/package identity;
- candidate ownership for evidence and all references;
- exact limitation/unknown evidence reference order;
- normalized provenance timestamp shape/chronology;
- stable family/dimension/provenance/reason/digest checks;
- immutable update rejection;
- self/cycle lifecycle rejection;
- snapshot family independent of mutable membership;
- exact ordered snapshot membership; and
- timezone-aware finite timestamps.

There are zero RLS policies because all product records are shared public data.

## Evidence cutoff matrix

| Provenance            | Required columns no later than cutoff             |
| --------------------- | ------------------------------------------------- |
| Git commit            | `published_at`, `collected_at`, `freshness_as_of` |
| Tag                   | `published_at`, `collected_at`, `freshness_as_of` |
| Release               | `published_at`, `collected_at`, `freshness_as_of` |
| Package version       | `published_at`, `collected_at`, `freshness_as_of` |
| Security advisory     | `published_at`, `collected_at`, `freshness_as_of` |
| Mutable documentation | `collected_at`, `freshness_as_of`                 |
| Approved validation   | `validated_at`, `freshness_as_of`                 |

`created_at` is complete-record audit metadata, never a substitute.

## Migration inventory and recovery

1. `0001_evidence_persistence.sql` — public candidates, capability
   membership, immutable evidence/limitations/unknowns, lifecycle, exact
   snapshots, one runtime role, constraints, triggers, and indexes.

Final migration SHA-256:
`569d7a6d6db70b1b04cadfa8798516ce4239b1179bb2f7cdd84b27641e33755f`.

Apply and verify enforce PostgreSQL major 18, exact file checksum, ordered
history, no unknown/gap/name drift, transactional failure rollback, and a fixed
advisory migration lock. Repeat application is safe. No down migration exists.
Because the PR is unmerged with no production data, version 1 is rewritten in
place. After publication, corrections use new forward migrations.

## Persistence API inventory

- `createPersistenceClient`
- `closePersistenceClient`
- `applyMigrations`
- `verifyMigrations`
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

There is no `StorageScope`, tenant, expiry, purge, deletion, tombstone, or
organization operation/type/error.

## Transaction and concurrency inventory

| Operation        | Policy                                                                      |
| ---------------- | --------------------------------------------------------------------------- |
| Migration        | fixed advisory transaction lock; checksum/history under lock                |
| Immutable append | unique insert + digest compare in one transaction                           |
| Capability set   | candidate advisory lock; insert missing/delete removed                      |
| Supersession     | candidate lock in adapter and cycle trigger                                 |
| Invalidation     | candidate lock and composite ownership                                      |
| Snapshot create  | candidate lock; validate current family/exact material; atomic root/members |
| Snapshot load    | read-only repeatable read; exact members/digests/parser                     |
| Active material  | read-only repeatable read; bounded complete selection                       |
| Cancellation     | caller abort + server statement/lock timeout; rollback                      |

Tests use observable promises/locks, not arbitrary sleeps.

## Performance and index rationale

- Expression indexes enforce case-insensitive repository/package uniqueness.
- Candidate/freshness/evidence supports active selection.
- Candidate/creation/ID supports limitation and unknown selection.
- Lifecycle candidate/reference/effective indexes support active exclusion.
- A lifecycle traversal index supports cycle checks.
- Candidate/family/cutoff supports snapshot history.
- Primary/unique indexes support exact references and ordered snapshot loads.

No page API exists. The complete active result inherits contract maxima:
100 evidence, 40 limitations, and 40 unknowns. Exceeding a bound fails rather
than returning partial material.

## Test-database and role strategy

- Exact official PostgreSQL 18.4 digest.
- Ephemeral no-volume container with health check/random port/cleanup.
- Explicit `_test` database acknowledgment for injected configuration.
- Owner only for migrations, catalog inspection, and deterministic suite setup.
- Non-owner, non-superuser `gitblocks_persistence_test` login for every runtime
  operation integration and pilot-conformance call.
- No RLS claim; tests instead verify zero policies and public-only schema.
- `verify:ci` includes `db:verify`; no database test may skip.

## Scope-reduction inventory

Counts use authored migration objects, public `index.ts` bindings, and the
database Vitest graph:

| Surface                                  | Reviewed tenant design | Public-first design | Reduction |
| ---------------------------------------- | ---------------------: | ------------------: | --------: |
| Product tables                           |                     15 |                  13 |         2 |
| RLS policies                             |                     73 |                   0 |        73 |
| Schema functions                         |                      7 |                   2 |         5 |
| Triggers                                 |                     17 |                  13 |         4 |
| Explicit indexes                         |                     17 |                   9 |         8 |
| TypeScript public exports                |                     45 |                  37 |         8 |
| PostgreSQL integration/conformance tests |                     15 |                  12 |         3 |
| Migration lines                          |                  1,851 |                 773 |     1,078 |
| Key implementation/test lines            |                  5,119 |               3,804 |     1,315 |

The key-line comparison covers migration, operations, public types,
PostgreSQL integration, deterministic database-suite setup, and persistence
conformance. Final diff statistics are recorded after all documentation
stabilizes.

Deleted behavior includes tenants, tombstones, scope/tenant/expiry columns,
tenant context, tenant/public policy matrices, 73 RLS policies, retention
triggers/indexes, purge/delete functions, tenant/public writer roles,
scope/expiry/purge/delete TypeScript commands/results/errors, and tenant-only
tests/documentation.

## Implementation milestones

### 1. Authority and public-first design

Status: complete.

- Re-read revised Issue #11, PR #12, maintainer comment, governing docs.
- Verify branch/main/PR state.
- Decide no organization primitives due no named consumer.
- Update plan status and revise ADR.

### 2. Public schema/API correction

Status: complete.

- Rewrite migration 0001 and package types/operations.
- Implement complete-record digests and normalized evidence timestamps.
- Replace capability delete/reinsert with serialized set diff.
- Remove tenant lifecycle and RLS surface.

### 3. Semantic regressions and conformance

Status: complete.

- Replace tenant tests with public identity/idempotency/cutoff/lifecycle/
  closure/snapshot/concurrency tests.
- Preserve five non-pilot families.
- Refactor ten-case conformance to shared public candidates.
- Normalize two inconsistent webhook display names and update only the
  affected case hash; scoring and gold remain unchanged.

### 4. Documentation/repository policy

Status: complete.

- Rewrite ADR, plan, package/root README, system context, testing, security,
  reliability, contributor/agent guidance, and PR description.
- Review dependency/repository invariants and prohibited imports/components.

### 5. Full validation/publication/hosted evidence

Status: implementation and documentation published; hosted evidence complete.

- Run every required local command and static acceptance review.
- Record checksum/counts/coverage/failures.
- Create ordinary Conventional Commits and push existing branch normally.
- Update existing draft PR #12.
- Inspect complete hosted Verification logs and correct only with ordinary
  follow-up commits.

## Testing and exact validation

Required local environment: Node `24.18.0`, pnpm `11.17.0`, exact PostgreSQL
18.4 image.

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

Static acceptance review also proves package count/dependencies, no
tenant-private/expiry/purge/deletion/tombstone/RLS surface, exact migration
objects, one runtime role, ten pilot/five non-pilot reconstruction,
proposed/not-reviewed gold, unchanged scoring, no live baseline/candidate
execution/prohibited component, ordinary pushes, and unchanged `main`.

## Observability and operations

The adapter cannot receive production traffic and adds no service, worker,
scheduler, deployment, telemetry backend, or credentials. It emits no logs and
returns bounded stable value-free errors. A future composition must add
authorization, correlation, audit, telemetry, deployment, and runbooks before
handling production traffic. Local/CI tooling owns health checks, failure on
missing prerequisites, and container cleanup.

## Compatibility, rollout, and recovery

This is an unpublished schema version with no production data or consumer.
Rewriting migration 0001 is therefore the smallest correct recovery from the
overbuilt design. There is no backfill, mixed deployed version, or production
rollout. After merge, migration history becomes immutable. Code rollback is
allowed only when compatible with applied schema; otherwise use a corrective
forward migration or authorized restore.

## Exit criteria

- Every revised Issue #11 crosswalk row has implementation and evidence.
- ADR/plan/docs describe only public-first behavior.
- Exactly one new product package remains with approved dependencies.
- Migration/API contain no tenant/private/expiry/purge/deletion/tombstone/RLS
  surface.
- Complete-record, cutoff, membership, lifecycle, closure, and snapshot
  invariants pass on real PostgreSQL.
- All 40 dossiers in ten pilot cases and five non-pilot dossiers reconstruct.
- Gold stays proposed/not-reviewed; scoring stays unchanged; no live baseline.
- Full local and hosted PostgreSQL validation passes on final published head.
- PR #12 stays open, draft, and unmerged.
- No direct-main push, amend, rebase, squash, rewrite, or force-push occurs.

## Progress log

- 2026-07-29: Verified branch/remote head at `b64a42e3`, `main` unchanged at
  `e7ae0ba4`, and clean worktree.
- 2026-07-29: Read revised Issue #11, open/draft/unmerged PR #12, and maintainer
  correction comment.
- 2026-07-29: Found no Phase 5/6 organization consumer; omitted both optional
  organization tables.
- 2026-07-29: Rewrote migration/API/tests around shared public records and
  removed tenant lifecycle/RLS.
- 2026-07-29: TypeScript checkpoint passed after correcting stored-row typing
  and stale tenant unit tests.
- 2026-07-29: First real PostgreSQL run passed all 11 public integration tests
  and exposed duplicate public candidate display names in ten-case conformance.
- 2026-07-29: Normalized `standard-webhooks` and `svix` display names across
  webhook cases and updated the affected case hash; scoring/gold unchanged.
- 2026-07-29: A subsequent run exposed test-file order dependence on a login
  role. Deterministic suite setup now creates the test login before Vitest; all
  operation and pilot-conformance calls use that non-owner role.
- 2026-07-29: `pnpm db:verify` passed: PostgreSQL 18.4, one migration, 13
  public product tables, zero RLS policies, 12/12 DB tests, no skips, cleanup.
- 2026-07-29: Created ordinary implementation commit
  `6b1bc848f89c0e858bb0eef999045b82ae3a7e5d` without amend, rebase,
  squash, or history rewrite.
- 2026-07-29: Created ordinary documentation commit
  `dc7ecaea6acc36380e84fd7c9b0515b1cb41c422` and pushed both follow-up
  commits normally to the existing branch without force.
- 2026-07-29: Updated existing draft PR #12 in place. It remains open, draft,
  unmerged, and based on unchanged `main`.
- 2026-07-29: Hosted CI run
  [30436002996](https://github.com/kgudipati/gitblocks/actions/runs/30436002996),
  Verification job
  [90523773693](https://github.com/kgudipati/gitblocks/actions/runs/30436002996/job/90523773693),
  completed successfully on `da6c8599f6de9f98922b72f8d21a567fa512d4ec`.
  Full decoded logs contained 1,537 lines and no Actions error/warning
  annotations. Every step passed, including the exact PostgreSQL 18.4
  service, frozen-install/worktree proofs, 650 offline tests, 12/12 database
  tests without skips, proposed/not-reviewed conformance, secret scan, and
  registry audit. The service tail's bad-password entry is the intentional
  safe-error negative test.

## Decision and deviation log

- 2026-07-29 — Omit organization persistence. No named next-phase consumer
  exists; YAGNI is authoritative.
- 2026-07-29 — Use one public runtime role and zero RLS policies. All Phase 4
  records are public; RLS would imply a private scope that does not exist.
- 2026-07-29 — Digest complete immutable records rather than payloads. Creation
  metadata, ownership, cutoff, family, and ordered membership must conflict.
- 2026-07-29 — Exclude unsupported limitations/unknowns from active material.
  This is smaller than a separate stale collection and guarantees closure.
- 2026-07-29 — Return no active pagination. A dossier input must be complete;
  a future browser operation must be separately named/typed.
- 2026-07-29 — Keep snapshot family independent of mutable membership and
  serialize both set replacement and snapshot creation with candidate advisory
  locks.
- 2026-07-29 — Normalize inconsistent display names in one pilot case because
  shared public identity correctly rejects two immutable records for the same
  candidate. This is representability correction, not scoring/gold review.

## Failed checks and corrections

| Check                         | Failure                                                                                  | Correction                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Initial targeted formatter    | Prettier could not infer a parser for SQL                                                | Format supported TS/Markdown/JSON; SQL remains reviewed text                                   |
| First `pnpm typecheck`        | Stored identity row typed `unknown`; unit tests referenced removed tenant scope          | Validate stored unknown through product parser; rewrite unit tests for public metadata/cutoff  |
| First `pnpm db:verify`        | Public conformance conflicted on two candidate display names hidden by per-tenant copies | Normalize project-level names and update affected case hash                                    |
| Second `pnpm db:verify`       | Conformance file could run before test login creation                                    | Add deterministic suite setup; run both operation and conformance calls through non-owner role |
| First full-matrix `pnpm lint` | Provenance timestamp switch used an unprovable exhaustive `default`                      | Name all five immutable-publication provenance cases explicitly                                |
| Public cutoff regression run  | New storage-time assertion had not inserted its limitation/unknown fixtures              | Insert both immutable records with metadata later than the evidence-world cutoff               |
| Full-matrix `pnpm repo:check` | Package README heading used the lowercase package identifier as prose                    | Use a product-capitalized heading; package identity remains in package metadata and code       |
| Current `pnpm db:verify`      | Passed                                                                                   | 12/12 tests, 13 public tables, 0 RLS, no skips                                                 |

## Validation evidence

| Date       | Command/review                        | Result                                                                                                                                                                                           |
| ---------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-07-29 | Git/GitHub authority checks           | Expected branch/head/main; PR draft/open/unmerged; issue/comment confirmed                                                                                                                       |
| 2026-07-29 | runtime/frozen install/static/build   | Node 24.18.0; pnpm 11.17.0; frozen install unchanged; format, lint, typecheck, and build passed                                                                                                  |
| 2026-07-29 | `pnpm test` / `pnpm test:coverage`    | 32 files and 650 tests passed; 78.32% statements, 71.66% branches, 83.35% functions, 78.20% lines                                                                                                |
| 2026-07-29 | architecture/repository/contract/eval | 604 modules/1,931 dependencies with no violation; repository checks passed; 10 cases/40 candidates proposed/not-reviewed                                                                         |
| 2026-07-29 | `db:migrate` / `db:check` / `db:test` | PostgreSQL 18.4; one migration; 13 public tables; 0 RLS; 12/12 DB tests through deterministic non-owner setup                                                                                    |
| 2026-07-29 | `pnpm db:verify` / `pnpm verify:ci`   | Exact pinned no-volume image provisioned and cleaned; aggregate offline, PostgreSQL, secret, and registry audit checks passed                                                                    |
| 2026-07-29 | security checks                       | Secret scan passed; registry audit reported no known vulnerabilities                                                                                                                             |
| 2026-07-29 | schema/API reduction count            | 15→13 tables; 73→0 policies; 7→2 functions; 17→13 triggers; 17→9 explicit indexes; 45→37 exports                                                                                                 |
| 2026-07-29 | line/test reduction                   | key lines 5,119→3,804; migration 1,851→773; DB tests 15→12; 28 files have one setup file added, 27 modified, and none deleted                                                                    |
| 2026-07-29 | migration checksum                    | `569d7a6d6db70b1b04cadfa8798516ce4239b1179bb2f7cdd84b27641e33755f`                                                                                                                               |
| 2026-07-29 | local Git review                      | Topic/main heads unchanged; `git diff --check` passed; 27 modified files plus one deterministic DB setup file                                                                                    |
| 2026-07-29 | hosted Verification                   | Final head `da6c8599`; run 30436002996 / job 90523773693 passed; 650 offline tests; 12 DB tests without skips; 13 public tables; 0 RLS; proposed/not-reviewed gold; unchanged scoring and `main` |

Implementation, scope reduction, validation, and hosted PostgreSQL CI are
complete. Independent final review and explicit merge authorization remain
pending.
