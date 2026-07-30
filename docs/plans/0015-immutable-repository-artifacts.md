# Phase 6 immutable repository artifacts

## Status and authority

- Governing issue:
  [#15 — Phase 6: Establish immutable repository artifacts](https://github.com/kgudipati/gitblocks/issues/15)
- Binding comments:
  [maintainer decisions and implementation authorization](https://github.com/kgudipati/gitblocks/issues/15#issuecomment-5124406154)
  and
  [additional compatibility guard](https://github.com/kgudipati/gitblocks/issues/15#issuecomment-5124411687)
- Branch: `feat/15-immutable-repository-artifacts`
- Owner: repository maintainer
- State: offline and PostgreSQL-tested checkpoint in progress; full live
  collection blocked on maintainer review
- Last updated: 2026-07-30

Authority descends from Issue #15 and its maintainer comments, through actual
merged behavior and history, accepted ADRs and the product contract, repository
operating instructions, and then this plan. ADR 0006 records the durable
architecture. A contradiction is recorded rather than silently reconciled.

## Purpose and user-visible outcome

Phase 6 establishes a product-owned immutable source layer for reviewed public
catalog documentation. Given the committed `public-v1` catalog and a separately
reviewed `public-artifacts-v1` manifest, the operator can collect bounded
exact-commit GitHub text files, prove their Git object identity, persist exact
UTF-8 content and deterministic lossless chunks, publish one closed
artifact-set snapshot per complete candidate selection, and load the same bytes
later without re-fetching a mutable repository head.

This checkpoint delivers offline contracts, selection authority, provider
adapter, chunker, PostgreSQL migration and adapter, operator commands, safe
receipt, tests, and documentation. It does not contain a full 150-candidate
artifact collection or final completion evidence. The live operation remains
blocked until the maintainer reviews the complete PR diff, proposed additional
paths and rationales, and final offline contract and architecture shapes.

Phase 7 may later reference immutable artifact and chunk IDs plus line
intervals. Phase 6 does not define semantic claims, model prompts, interviews,
retrieval, ranking, or changes to `CandidateDossierV1`.

## Verified current repository state

The required starting sequence completed normally:

```text
initial branch       feat/13-public-repository-ingestion
initial worktree     clean
local main before    2fedf201a844b4ecfaa1f6d6218ae84b69cf867c
origin/main          3f45f03b259c9c3cb0e735ed617350e125e24959
fast-forwarded main  3f45f03b259c9c3cb0e735ed617350e125e24959
Phase 6 branch       feat/15-immutable-repository-artifacts
```

The branch was created from fast-forwarded `main`, not the Phase 5 topic
branch. The Phase 5 topic tree happened to match `origin/main`, but its ancestry
was not used.

Pinned runtime:

```text
Node.js  v24.18.0
pnpm     11.17.0
```

`pnpm install --frozen-lockfile` reported all seven workspace projects already
up to date and changed neither the worktree nor lockfile.

Baseline validation on 2026-07-29:

| Command                             | Result                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `pnpm verify`                       | passed; 37 test files, 700 tests; 625 modules and 1,988 dependencies with no architecture violation              |
| `pnpm verify:ci`                    | passed; registry audit clear; PostgreSQL verification included                                                   |
| `pnpm contracts:validate`           | passed; 10 cases, 40 supplied candidates, representability only                                                  |
| `pnpm catalog:validate`             | passed; 150 candidates, 30 per family, digest `4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634` |
| `pnpm ingestion:verify`             | passed; 5 files, 49 tests plus typecheck                                                                         |
| `pnpm db:verify`                    | passed; PostgreSQL 18.4, 2 migrations, 13 product tables, 3 files and 23 tests, no skips                         |
| `pnpm eval:validate`                | passed; 10 cases                                                                                                 |
| `pnpm eval:fixtures`                | passed                                                                                                           |
| final `git status --short --branch` | clean Phase 6 branch                                                                                             |

Current production packages are exactly `@gitblocks/domain`,
`@gitblocks/contracts`, `@gitblocks/persistence`, and
`@gitblocks/ingestion`. Phase 6 extends the latter three and leaves domain
unchanged. Migrations 0001 and 0002 are merged and immutable.

The six existing contract roots and digests are:

| Contract root           | SHA-256                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| candidate dossier       | `d16d0424ed45edcf61d8084cbd21ebbb396366522d1b1a425b6cf8405e0680af` |
| capability request      | `3d1f213efdacd6ff550a66a74703b94abc56aead59cdcb08b7a2769b5a5a1ab9` |
| error envelope          | `7a708cc440a7992cb164715dce6029befbe78970c3283d8a1bff9298c87603d0` |
| fit-assessment request  | `c130a56044cbb043fac97e66db4c372d48990d672784b4abfde9ab9e78c9e504` |
| fit-assessment response | `330b5b3940858428b1881701774bac785a7c93cf2d50e6dcb4ec37091a696a4d` |
| repository fingerprint  | `73f42c7a7cd20de24372ecddb7afa33925ca1f4d67cb1f9598cd9d56ea87477c` |

The current GitHub transport already sends API version `2026-03-10`. Phase 6
will make the request-level choice explicit while preserving the existing
default and proving Phase 5 request, profile, and receipt behavior unchanged.

`RepositoryFileSource.text` currently exists only in a transient provider
bundle. The profiler does not consume it, persistence never receives it, and no
exact file body, line count, byte count, or recoverable blob identity survives.

## Scope and explicit non-goals

### In scope

- This living plan and ADR 0006.
- Product-contract clarification for approved public artifacts.
- A closed `public-artifacts-v1` manifest bound to the current public catalog.
- One optional root README attempt for all 150 candidates.
- Proposed additional official paths for at least 30 candidates and at least 6
  candidates per family.
- Additive artifact, chunk, and set contracts with safe parsers,
  deterministic schema exports, stable IDs, identity digests, and complete
  record digests.
- Artifact-specific preflight limits without widening unrelated contracts.
- Explicit Git object algorithm discovery and `sha1` verification.
- Exact-ref README/path retrieval and bounded non-recursive tree verification.
- Strict base64, UTF-8, NUL, size, blob-object, and byte/line validation.
- Dependency-free `exact-lines-v1` lossless chunking.
- Forward migration `0003_immutable_repository_artifacts.sql`.
- One atomic public write: `publishRepositoryArtifactSet`.
- Narrow historical artifact and set loaders.
- A separate acknowledged artifact operator and compact content-free receipt.
- Offline, hidden-network, and real PostgreSQL 18.4 verification.
- Draft PR publication and hosted CI inspection.

### Explicit non-goals

- The blocked full live run or its immediate rerun.
- Final Phase 6 completion evidence.
- Models, prompts, semantics, retrieval, ranking, or repository interviews.
- Changes to `CandidateDossierV1`, domain behavior, Phase 5 profile rules,
  evidence semantics, evaluation gold, or scorer implementation.
- New production packages or dependencies.
- Object storage, generic blob APIs, search, embeddings, queues, schedulers,
  services, RLS, tenancy, retention/deletion, or production deployment.
- Cloning, tarballs, recursive trees, package installation, code execution,
  rendered Markdown/HTML, link following, or candidate-authored instructions.

## Requirements crosswalk

| Issue requirement                         | Destination                               | Milestone and evidence                       |
| ----------------------------------------- | ----------------------------------------- | -------------------------------------------- |
| Durable architecture and recovery         | ADR 0006; this plan                       | Milestone 1 review                           |
| Reviewed selection authority              | artifact manifest and parser              | Milestone 2 tests and `artifacts:validate`   |
| 150 README attempts and additional cohort | artifact manifest                         | Count/family/kind/requirement summary        |
| Additive contracts                        | `packages/contracts`                      | Milestone 3 schema/parser/digest tests       |
| Exact Git identity and bytes              | artifact provider                         | Milestone 5 protocol and hostile-input tests |
| Lossless chunks                           | artifact chunker                          | Milestone 5 property/boundary tests          |
| Immutable PostgreSQL storage              | migration 0003 and adapter                | Milestone 4 non-owner suite                  |
| Atomic closed publication                 | `publishRepositoryArtifactSet`            | Closure/concurrency tests                    |
| Separate safe operator                    | artifact scripts                          | Milestone 6 receipt/orchestration tests      |
| No Phase 5 regression                     | existing and new fixtures                 | Focused and full verification                |
| No unexpected provider network            | injected transport and guard              | Ordinary/hosted suites                       |
| Live proof                                | deferred pending maintainer authorization | Explicitly incomplete                        |

## Assumptions, risks, and resolved decisions

### Verified facts

- GitHub API version `2026-03-10` exposes repository hash-algorithm discovery.
- GitHub README and Contents APIs accept an exact Git ref.
- Contents responses alone cannot prove an ordinary file because symlink and
  submodule behavior is ambiguous.
- PostgreSQL 18 UTF-8 `text` preserves accepted text when exact UTF-8
  round-trip validation is enforced.
- Persistence already uses conflict-reload idempotency, candidate locks,
  explicit timeouts, and a non-owner role.

### Binding decisions

- Curator-approved public catalog artifacts may be stored centrally and
  immutably. Target-repository bodies and unapproved material remain local.
- Artifact identity excludes mutable aliases, display URLs, curator
  classification, requirement, rationale, selector, ordering, and timestamps.
- Artifact identity includes candidate ID, immutable GitHub repository numeric
  ID, Git object algorithm, commit object ID, path, blob object ID, and content
  SHA-256.
- Catalog and provider-canonical locators are first-materialization
  provenance. Later sets may record a newer canonical locator without
  duplicating the artifact.
- First insertion requires exact catalog aliases from `catalog_candidates`,
  exact incoming provider aliases from the artifact set, and an exact derived
  immutable-commit GitHub display URL when non-null.
- Rename-safe provenance reuse applies only after an artifact has entered a
  successfully published artifact set. An unreferenced preexisting artifact
  must completely match the incoming contract record before it may participate
  in first publication. A later rename reuses the original stored provenance
  only for an artifact already referenced by a published set, while the later
  set records the new alias.
- Selection semantics live only in ordered set entries.
- Root README is optional; only exact-ref 404 establishes `not-found`.
- Phase 6 supports `sha1` and fails closed on other object algorithms.
- Exact content uses PostgreSQL UTF-8 `text`; normalization is prohibited.
- `exact-lines-v1` gives Markdown no semantic treatment.
- One normalized ordered entry table is authoritative for set selections.
- Artifact-set existence means reference-closed completion.
- The only public write is `publishRepositoryArtifactSet`.

### Risks and mitigations

| Risk                                | Mitigation                                                         |
| ----------------------------------- | ------------------------------------------------------------------ |
| Prompt injection stored for Phase 7 | Inert storage; never execute, render, prompt, log, or follow links |
| Escape/control leakage              | Value-free errors/receipts and synthetic tests                     |
| Mutable alias mistaken for identity | Numeric repository ID plus exact object/path/hash identity         |
| Unsupported object algorithm        | Explicit discovery, closed enum, controlled failure                |
| Symlink/submodule ambiguity         | Non-recursive tree-mode verification at each path segment          |
| Byte normalization                  | Fatal UTF-8 decode, re-encode, byte offsets, reconstruction        |
| Database amplification              | Approved artifact/candidate/run/chunk limits                       |
| Partial set looks complete          | One transaction, normalized entries, deferred closure check        |
| Timestamp conflict on rerun         | Reuse stored first-materialization record                          |
| Phase 5 behavior drift              | Explicit API-version and receipt/profile regressions               |
| Candidate bodies committed          | Synthetic fixtures, repository checks, diff review                 |

## Applicable ADRs and contracts

- ADR 0001 preserves headless delivery and no ingested-code execution.
- ADR 0002 fixes Node/pnpm, strict TypeScript/ESM, native APIs and supply-chain
  controls.
- ADR 0003 owns domain/contract direction and one schema source.
- ADR 0004 owns the PostgreSQL adapter, checked forward migrations,
  idempotency, exact snapshots, explicit transactions, and minimum grants.
- ADR 0005 owns the curated catalog, fixed providers, injected configuration,
  deterministic profile/refresh, safe errors, and operator receipt.
- ADR 0006 owns artifact selection, identity, collection, chunking,
  persistence, operation, and recovery.
- Existing six `1.0.0` roots remain unchanged.
- New roots are `RepositoryArtifactV1`, `RepositoryArtifactChunkV1`, and
  `RepositoryArtifactSetV1`.
- `CandidateDossierV1` remains unchanged.

## Architecture, data flow, and performance

```text
public-v1 catalog + public-artifacts-v1 manifest
  -> validate closed selection authority
  -> resolve repository ID, hash algorithm, exact commit
  -> retrieve exact-ref README and paths
  -> verify selected paths through bounded non-recursive trees
  -> validate UTF-8 and Git blob object ID
  -> immutable artifact DTOs
  -> exact-lines-v1 chunks and reconstruction
  -> publishRepositoryArtifactSet transaction
  -> immutable artifacts + chunks + normalized closed set entries
  -> compact content-free receipt
```

| Bound                            |                        Value |
| -------------------------------- | ---------------------------: |
| unique accepted artifact bytes   |                      256 KiB |
| selections per candidate         |                            4 |
| unique accepted candidate bytes  |                      512 KiB |
| operational decoded run bytes    |                       64 MiB |
| logical lines per artifact       |                       10,000 |
| chunks per artifact              |                           64 |
| chunk bytes                      |                       16 KiB |
| logical lines per chunk          |                          200 |
| candidate concurrency            |                            2 |
| GitHub request concurrency       |                            1 |
| request timeout                  |                   10 seconds |
| candidate deadline               |                  120 seconds |
| batch deadline                   |                   60 minutes |
| path bytes/depth                 | 512 UTF-8 bytes / 8 segments |
| artifact/blob/tree JSON response |                      512 KiB |
| repository/commit metadata JSON  |                      256 KiB |
| hash-algorithm metadata JSON     |                       16 KiB |

Provider response limits include JSON/base64 overhead and remain distinct from
decoded limits. Phase 5's 64 KiB/file and 128 KiB/candidate limits do not
change.

Artifact/candidate bytes count unique accepted artifact content. Operational
run bytes count every actual Base64 decode, including the Contents/README body
and independently retrieved blob body, even when the candidate later fails.
One process-wide synchronous reservation budget is shared by both workers and
charged before decoding; a failed reservation is atomic and value-free.

## Security, privacy, abuse, and supply chain

Repository content is hostile public data. The collector validates fixed-host
responses but never grants them instructional authority. It does not execute,
render, summarize, prompt, follow links, resolve includes, recurse trees,
clone, download archives, or install candidate packages.

Only curator-approved public candidate artifacts enter central storage. User
target repository bodies, secrets, configuration, and unapproved material
remain outside this operation. Content is excluded from errors, telemetry,
logs, receipts, fixtures, other snapshots, and committed evidence. Paths and
display URLs are absent from receipts by default. Tests use synthetic content
and fail if they unexpectedly reach a network.

No new dependency is planned. Node native fetch, AbortSignal, TextDecoder,
Buffer, URL, and cryptography cover the operation.

## Implementation milestones

- [x] **Baseline:** fast-forward main, create the correct branch, run the full
      pinned clean baseline, and record results.
- [x] **Milestone 1 — Plan and ADR:** add this plan and ADR 0006; update the
      minimum product, architecture, security, and testing documents; validate,
      commit, push, and open a draft PR.
- [x] **Milestone 2 — Manifest:** red tests, closed parser/digest/selection IDs,
      proposed reviewed paths, `artifacts:validate`, commit and PR review summary.
- [x] **Milestone 3 — Contracts:** red tests, three roots, artifact preflight,
      parsers, IDs/digests, exports, mutation/compatibility tests, commit.
- [x] **Milestone 4 — Persistence:** PostgreSQL failures first, migration 0003,
      tables/grants/closure/publication/loaders, runtime-role verification, commit.
- [x] **Milestone 5 — Collection/chunking:** explicit API-version boundary,
      algorithm discovery, exact retrieval/tree checks, validation, hashing,
      chunking, limits, Phase 5 regressions, commit.
- [x] **Milestone 6 — Operator/receipt:** separate commands, acknowledgement,
      isolation, limits/deadlines, telemetry, receipt/rerun support; no live run;
      commit.
- [x] **Milestone 7 — Pre-live checkpoint:** full matrix, diff and hosted CI
      inspection, plan/PR update, and stop for authorization.
- [ ] **Deferred live completion:** reviewed full run/rerun and compact
      completion evidence after explicit authorization.

## Testing and validation strategy

Contract tests cover closure, bounds, stable IDs, canonical ordering, Unicode,
every digest field, rename stability, reclassification, algorithm-dependent
object IDs, and prior-root digests.

Manifest tests cover catalog closure, README coverage, duplicates, safe paths,
bytes/depth, extensions, kinds, requirements, rationales, deterministic
ordering/digest, family coverage, and independence from evaluation.

Chunk properties cover empty/final-newline content, LF/CRLF/lone CR,
multibyte Unicode, long lines, exact boundaries, overflow, gaps, overlaps,
ordering, and exact byte reconstruction.

Provider tests cover exact refs, discovered README path, moves and numeric IDs,
algorithm discovery, ordinary/executable blobs, trees/symlinks/submodules,
redirects, exact 404 absence, every non-absence failure, content/hash checks,
concurrency, cancellation, and Phase 5 compatibility.

PostgreSQL tests use the non-owner role and cover migrations, grants,
immutability, exact round trips, closure failures, idempotency, collision,
concurrency, rollback, history, timestamp reuse, and move-stable artifacts with
set-specific current locators. No database test may skip.

Final offline commands:

```shell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm test:coverage
pnpm architecture:check
pnpm repo:check
pnpm contracts:validate
pnpm catalog:validate
pnpm ingestion:verify
pnpm artifacts:validate
pnpm artifacts:test
pnpm artifacts:verify
pnpm db:verify
pnpm eval:validate
pnpm eval:fixtures
pnpm security:secrets
pnpm security:audit
pnpm verify
pnpm verify:ci
git diff --check
git status --short --branch
```

`pnpm artifacts:live` and `pnpm artifacts:receipt` are intentionally excluded
from this checkpoint.

## Observability and operations

This is an explicit non-production operator batch, not a service. It adds no
health endpoint, SLO, alert, dashboard, queue, scheduler, or daemon.

Telemetry uses bounded stable artifact batch, candidate, selection, provider
request, and publication events. Attributes contain controlled IDs, counts,
attempts, durations, status classes, and safe error codes only. Content, paths,
display URLs, raw errors, SQL, credentials, headers, and provider bodies are
prohibited.

The receipt records catalog/manifest/collector/chunker versions and digests,
candidate/artifact/chunk/set counts, kind/absence/failure counts, operational
decoded bytes, successfully materialized artifact bytes, provider request/rate
metadata, migration version, rerun comparison, and its digest. It contains no
source content.

## Migration, compatibility, rollout, and recovery

Migration 0003 is a transactional forward migration. It does not modify
migrations 0001/0002 and requires no backfill. Existing rows and Phase 5
operations remain compatible.

Artifact collection is additive and opt-in. Network work and validation finish
before one candidate-scoped transaction. A failed candidate publishes no set.
An unchanged retry reuses stored artifact, chunks, set, timestamps, and
provenance. Changed immutable identity creates new rows and preserves history.

Migration failure rolls back. Operation failure rolls back the candidate
transaction. A merged schema defect is corrected by migration 0004; a contract
or chunker defect uses a new additive version. Stored records are never
rewritten as recovery.

## Exact exit criteria

The pre-live checkpoint requires:

- all offline milestones committed and pushed ordinarily;
- the draft PR remains draft and links Issue #15;
- 150 README attempts and the required clearly marked proposed path cohort;
- contract roots, migration, operations, operator and receipt match authority;
- prior schema digests and Phase 5 behavior unchanged;
- full offline/PostgreSQL verification with no skipped database test;
- hosted checks and decoded logs inspected;
- full diff, dependency graph, migration/table inventory, lockfile and
  content-exclusion review recorded;
- a clean worktree;
- no live artifact operation or final completion evidence; and
- remaining live approvals explicitly listed.

Phase 6 itself is not complete at this checkpoint.

## Progress log

- **2026-07-29:** Re-read Issue #15 and both binding comments. Confirmed that
  artifact identity must be alias-stable and selection-neutral, hash-algorithm
  discovery is required, and Phase 5 API behavior must remain unchanged.
- **2026-07-29:** Fast-forwarded local `main` from `2fedf201` to required
  `3f45f03b` and created `feat/15-immutable-repository-artifacts`.
- **2026-07-29:** Completed the pinned baseline. All offline, focused,
  PostgreSQL 18.4, evaluation, catalog, ingestion, contract and audit checks
  passed; worktree and lockfile remained unchanged.
- **2026-07-29:** Began Milestone 1 documentation. No product code or live
  provider operation had been performed.
- **2026-07-29:** Milestone 1 passed formatting, repository links/invariants,
  contract conformance, the 700-test offline suite, and architecture checks.
  Commit `005bf4d` was pushed and draft PR #16 opened.
- **2026-07-29:** Wrote artifact-manifest tests first; all 20 failed before the
  manifest files and implementation existed. Added the closed source/manifest
  parsers, deterministic IDs/digest, catalog/coverage/path validation,
  generator command, and a proposed 30-candidate additional-path cohort. The
  focused suite then passed all 20 tests. Manifest digest:
  `2ba28512832f149a3f4068d789004c07f3d6773ec2cc32859555aac1be3fdc43`.
- **2026-07-29:** Wrote the artifact-contract suite before the additive roots
  and observed all six initial tests fail. Added the exact-file, exact-chunk,
  and closed-set TypeBox roots, artifact-specific preflight, safe parsers,
  canonical identity/record digests, and deterministic IDs. The architecture
  verifier rejected an initial Node `crypto` import from contracts; the final
  implementation keeps the package outward-dependency-free with deterministic
  local UTF-8, SHA-256, and SHA-1 primitives covered against Node reference
  values. The eight contract tests and all 728 repository tests pass.
- **2026-07-29:** Added PostgreSQL assertions before migration 0003 and observed
  five integration failures (missing migration/tables/API/grants). Added four
  normalized artifact tables, deferred closed-set validation, immutable-row and
  no-truncate triggers, minimum grants, candidate-locked atomic publication,
  conflict reloads, first-materialization reuse, and historical loaders.
  Direct database tests reject missing/reordered entries, missing chunks,
  cross-candidate references, and owner mutation. PostgreSQL 18.4 verification
  now passes 27 tests without skips.
- **2026-07-29:** Added the collection/chunking tests before implementation and
  observed 30 focused failures. Added explicit request-level GitHub API
  versioning, one shared request gate, repository numeric/hash/commit
  resolution, exact-ref README and Contents reads, non-recursive tree walking,
  immutable numeric-repository blob reads, strict canonical Base64/UTF-8/NUL
  and hash checks, and `exact-lines-v1`. A process-wide test setup now rejects
  unexpected real networking in ordinary and PostgreSQL suites. The focused
  suite passes 46 tests, ingestion passes 104 tests, and the repository passes
  763 tests with no Phase 5 fixture or receipt change.
- **2026-07-29:** Added three receipt and two operator-surface tests first and
  observed all five fail before the receipt/parser and command family existed.
  Added the separate candidate-isolated artifact batch, two-worker candidate
  bound, 64 MiB run bound, candidate/batch deadlines, compact closed receipt,
  materialization digest, zero-row immediate-rerun comparison, controlled
  artifact telemetry, and explicitly acknowledged non-production CLI. A real
  PostgreSQL composition test proves one candidate failure does not roll back
  another candidate and proves an immediate rerun inserts zero rows while
  retaining both set and first-materialization identity.
- **2026-07-29:** The pre-live full-diff audit found that direct `INSERT`
  privilege could append a new chunk after an artifact was already referenced
  by a closed set. A PostgreSQL regression reproduced the gap: one test failed
  because the append succeeded. Migration 0003 now serializes chunk insertion
  and set membership on an artifact advisory lock, permits only exact
  idempotent existing chunk IDs after publication, rejects new chunk IDs, and
  rejects zero-byte chunks except the sole chunk of an empty artifact. The
  regression and all 29 database tests pass. Migration 0003 remains unmerged;
  migrations 0001 and 0002 were not changed.
- **2026-07-30:** Maintainer pre-live review identified five material
  corrections and kept the live run blocked. Aggregate-byte red tests produced
  nine focused failures before implementation. The collector now reserves both
  Contents/README and independent blob decoded lengths from one process-wide
  atomic budget before Base64 decoding. Failed candidates retain their charged
  operational bytes, concurrent workers cannot oversubscribe, and receipts
  distinguish operational decoded bytes from successfully materialized bytes.
  The focused artifact suite and the PostgreSQL 18.4 non-owner suite pass
  without skips.
- **2026-07-30:** Provenance red tests showed that arbitrary HTTPS display
  URLs, mismatched catalog aliases, mismatched incoming provider aliases, and a
  direct poisoned catalog-provenance insert were accepted. Artifact parsing now
  requires the exact derived immutable-commit GitHub display URL. Atomic
  publication loads the durable catalog owner/name, validates both catalog and
  incoming provider provenance, and migration 0003 adds a composite catalog
  provenance foreign key. Contract tests pass 9/9 and PostgreSQL verification
  passes 30/30 without skips; concurrent poisoning cannot win, while a later
  repository rename reuses the original artifact and provenance.
- **2026-07-30:** Replaced the quota-driven additional-document cohort after
  two red manifest assertions rejected the old kinds/rationales and unsupported
  Markdoc path. Bounded GitHub code/path search and targeted leading excerpts
  verified exact current paths and adoption relevance without cloning,
  recursive tree reads, package installation, candidate execution, content
  persistence, or the artifact operator. The revised cohort has 30
  capability-bearing `documentation` paths, exactly 6 candidates per family;
  every rationale names its adoption question. Markdoc `.mdoc` is now a
  controlled text extension. The 21 manifest tests pass and the generated
  digest is
  `17d2a47f8d992275c95d55434bfc24776fb8ac51fc626e7610502f687bf3d02c`.
- **2026-07-30:** Terminal-line tests exposed two implicit-boundary gaps: a
  long line could split a CRLF pair at exactly 16 KiB, and persistence accepted
  a chunk that claimed the byte-free terminal empty line. `exact-lines-v1` now
  keeps CRLF together, documents the byte-bearing-line rule, and both adapter
  and deferred database closure validation derive chunk line ranges from exact
  content. Direct cases cover LF, lone CR, CRLF, 199 and 200 terminated lines,
  empty content, and no-final-newline content.
- **2026-07-30:** Chunk-loading red tests showed that the public read accepted
  no chunker version, loaded every sequence for an artifact, and left the
  artifact operator unable to prove set-context selection. The command now
  requires the sole V1 value `exact-lines-v1`, rejects missing or unsupported
  runtime values before database I/O, filters SQL by artifact ID plus chunker
  version, and receives the persisted set's declared version from the operator.
  Artifact-only conflict reloads remain independent of chunks and artifact
  identity remains independent of chunker version.
- **2026-07-30:** The second pre-live review found that direct runtime insertion
  could leave an intrinsically correct but provider-provenance-poisoned
  artifact unreferenced, after which the proper publisher's intrinsic-only
  conflict reload could silently adopt it. Five PostgreSQL regressions were
  added first; four failed before the correction because poisoned and
  intrinsic-conflict rows were not rejected, while exact unreferenced reuse
  already succeeded. Conflict reload now checks for a committed
  `repository_artifact_set_entries` reference inside the existing candidate
  transaction. An unreferenced row must match the incoming complete record
  digest; a referenced row retains rename-safe intrinsic-core comparison.
  PostgreSQL 18.4 verification passes 4 files / 36 tests without skips. No
  stable identity, schema contract, migration, manifest, or stored row was
  changed.
- **2026-07-30:** The first authoritative post-review `pnpm verify` run
  correctly rejected an incomplete locked contract export expectation for the
  new exact display-URL helper (43 suites passed and one failed). The public
  helper was intentional and already used by both parsing and collection, so
  its narrow export is now explicitly covered. The restarted complete matrix
  passes.

## Decision and deviation log

- **Artifact identity:** mutable aliases and curator semantics are excluded.
  This supersedes the investigation report's tentative move/classification
  identity recommendation.
- **Manifest chronology:** no wall-clock field participates in manifest
  identity; Git history supplies chronology.
- **Selection authority:** normalized ordered set entries are authoritative;
  the set digest is reconstructed from them rather than stored as a competing
  outcomes document.
- **Phase 5 API compatibility:** Phase 5 already uses `2026-03-10`; Phase 6
  introduces an explicit request-level field with the same default and
  regression tests.
- **GitHub CLI:** `gh` is unavailable. Local Git will provide commits/pushes and
  the connected GitHub app will provide issue/PR/check metadata. No tool is
  installed.
- **Contract cryptography boundary:** Node `crypto` is forbidden by the
  accepted contracts-outward dependency rule. Artifact digest and supported
  SHA-1 Git-object verification therefore use dependency-free deterministic
  primitives inside contracts; provider transport remains in ingestion.
- **Chunk identity derivation:** line intervals are deterministic metadata
  derived from exact bytes and `exact-lines-v1`; they participate in complete
  chunk record digests but are not redundant stable-ID inputs. The chunk ID
  inputs are artifact/candidate IDs, chunker version, ordinal, byte interval,
  and chunk content SHA-256.

## Validation evidence

Initial evidence is recorded under “Verified current repository state.” Each
milestone appends exact commands, results, failures, and resolutions here
before its next publication point.

No live provider collection has been run.

Milestone 1 evidence:

```text
pnpm format:check        passed
pnpm repo:check          passed
pnpm contracts:validate passed
pnpm verify              passed; 37 files / 700 tests
```

Milestone 2 focused evidence:

```text
artifact manifest red run  1 file / 20 failures before implementation
pnpm artifacts:validate    passed; 150 roots, 30 additional candidates,
                           6 per family, digest 2ba28512832f...
artifact manifest tests    passed; 1 file / 20 tests
```

Milestone 3 evidence:

```text
artifact contract red run  1 file / 6 failures before implementation
artifact contract tests    passed; 1 file / 8 tests
pnpm architecture:check    passed; 629 modules / 2,001 dependencies
pnpm verify                passed; 39 files / 728 tests
pnpm contracts:validate    passed; 10 cases / 40 supplied candidates

new schema digests:
repository-artifact        994643368bdc95a5279a2d939ec350ed65932ad16a3c937ae32f52ff87113d16
repository-artifact-chunk  d79d2803e3e11e83a9554eae4a38bba1bf379da6f767be402105cc3bf57508a6
repository-artifact-set    0d78814c3361e76e9d82c29cc6464fbedb3e6b761269dba3641c0e1c2c894e54

all six prior schema digests remained byte-for-byte unchanged
```

Milestone 4 evidence:

```text
PostgreSQL red run         3 files / 5 failures before migration and API
pnpm verify               passed; 39 files / 728 offline tests
pnpm db:verify            passed; PostgreSQL 18.4
database integration      passed; 3 files / 27 tests / no skips
migration inventory       3 (0001, 0002, 0003)
product table inventory   17 total; 4 new artifact tables
runtime grants            SELECT + INSERT only on all 4 artifact tables
RLS policies              0
```

Milestone 5 evidence:

```text
collection/chunk red run  3 files / 30 failures before implementation
focused provider/chunker  passed; 3 files / 46 tests
pnpm ingestion:verify     passed; 8 files / 104 tests
pnpm architecture:check  passed; 635 modules / 2,020 dependencies
pnpm verify               passed; 41 files / 763 tests
unexpected networking     prohibited by ordinary and database test setup
Phase 5 API default       unchanged at 2026-03-10; explicit override tested
live artifact operation   not run
```

Maintainer pre-live correction focused evidence:

```text
chunker-scoped red run    2 files / 3 failures before implementation
chunker-scoped focused    passed; 2 files / 12 tests
pnpm artifacts:verify     passed; 6 files / 76 tests
pnpm db:verify            passed; PostgreSQL 18.4 / 4 files / 31 tests / no skips
pnpm typecheck            passed
```

Pre-live audit and offline checkpoint evidence:

```text
pnpm verify               passed; 43 files / 768 tests
pnpm verify:ci            passed; registry audit clear; PostgreSQL required
pnpm contracts:validate   passed; 10 cases / 40 supplied candidates
pnpm catalog:validate     passed; 150 candidates / 30 per family
pnpm ingestion:verify     passed; 10 files / 109 tests
pnpm db:verify            passed; PostgreSQL 18.4 / 4 files / 29 tests / no skips
pnpm eval:validate        passed; 10 cases / 40 supplied candidates
pnpm eval:fixtures        passed; strong, weak, partial, and rejected fixtures
pnpm artifacts:validate   passed; manifest digest 2ba28512832f...
pnpm artifacts:verify     passed; 5 files / 60 tests
pnpm test:coverage        passed; 43 files / 768 tests; 75.55% statements,
                           68.38% branches, 82.26% functions, 75.33% lines
git diff --check          passed
production dependencies  unchanged; 114 production packages / 7 workspaces
pnpm-lock.yaml            unchanged from 3f45f03b...
full branch diff          reviewed; no candidate body, receipt, or completion
                           evidence is committed
worktree                  clean after every published implementation commit
live artifact operation   not run
```

Hosted CI run `30504095071` was started for implementation head
`917bc8dc9399bd97948c846d52a98d650dd3a925` and completed successfully.
Its setup, pinned pnpm, frozen install, reproducibility, pull-request metadata,
authoritative verification, PostgreSQL 18.4 verification, registry audit, and
clean-worktree steps all passed. Decoded logs report 43 files / 768 offline
tests, 4 files / 29 PostgreSQL tests without skips, 640 architecture modules /
2,035 dependencies without violations, and no known dependency
vulnerabilities. PostgreSQL `ERROR` lines are the expected rejection paths
asserted by negative tests; the job has no failed step or unexplained finding.

Milestone 6 evidence:

```text
artifact receipt red run  1 file / 3 failures before implementation
operator surface red run  1 file / 2 failures before implementation
pnpm artifacts:verify     passed; 5 files / 60 tests
pnpm verify               passed; 43 files / 768 tests
pnpm architecture:check  passed; 640 modules / 2,035 dependencies
pnpm db:verify            passed; PostgreSQL 18.4
database integration      passed; 4 files / 29 tests / no skips
schema functions/triggers  4 / 25
operator command family   artifacts:validate/test/verify/live/receipt
candidate concurrency     maximum 2
global request concurrency maximum 1 in the shared collector
live artifact operation   not run
```

Maintainer review correction checkpoint:

```text
runtime                    Node 24.18.0 / pnpm 11.17.0
pnpm install --frozen-lockfile
                           passed; already up to date
pnpm verify                passed; 44 files / 786 tests
pnpm verify:ci             passed; PostgreSQL required; registry audit clear
pnpm contracts:validate    passed; 10 cases / 40 supplied candidates
pnpm catalog:validate      passed; 150 candidates / 30 per family
pnpm ingestion:verify      passed; 11 files / 125 tests
pnpm db:verify             passed; PostgreSQL 18.4 / 4 files / 31 tests / no skips
pnpm eval:validate         passed; 10 cases
pnpm eval:fixtures         passed; all fixture profiles
pnpm artifacts:validate   passed; 150 roots / 30 additional candidates;
                           manifest digest 17d2a47f8d99...
pnpm artifacts:verify     passed; 6 files / 76 tests
pnpm test:coverage        passed; 44 files / 786 tests; 76.23% statements,
                           68.88% branches, 83.22% functions, 76.03% lines
pnpm architecture:check   passed within verification; 642 modules /
                           2,040 dependencies; no violations
git diff --check          passed
production dependencies  unchanged; 13 direct/link production packages /
                           7 workspaces; no added dependency
pnpm-lock.yaml            unchanged from 3f45f03b...
migration inventory       3; 17 public product tables; 0 RLS policies
full branch diff          56 files; 12,817 insertions / 74 deletions reviewed
candidate-content safety  synthetic bodies only; no candidate body, receipt,
                           or completion evidence committed
worktree                  clean after validation
live artifact operation   not run
```

Hosted CI run `30508072393` completed successfully for correction
implementation head `3905061bb9f89dbff1d0aac7add201ee2c8e3a51` (job
`90762081032`). Every job step passed, including pinned pnpm, frozen install,
reproducibility, pull-request metadata, authoritative verification,
PostgreSQL 18.4 verification, registry audit, and clean-worktree proof. Decoded
logs report 44 files / 786 offline tests, 4 files / 31 PostgreSQL tests without
skips, 642 architecture modules / 2,040 dependencies without violations, and
no known dependency vulnerabilities. PostgreSQL error lines are expected
negative-test rejection paths; the workflow contains no `##[error]` entry.

Second pre-live review correction checkpoint:

```text
runtime                    Node 24.18.0 / pnpm 11.17.0
provenance red run         4 failures among the 5 new PostgreSQL regressions;
                           exact unreferenced preinsert already succeeded
pnpm install --frozen-lockfile
                           passed; already up to date
pnpm verify                passed; 44 files / 786 tests
pnpm verify:ci             passed; PostgreSQL required; registry audit clear
pnpm contracts:validate    passed; 10 cases / 40 supplied candidates
pnpm catalog:validate      passed; 150 candidates / 30 per family
pnpm ingestion:verify      passed; 11 files / 125 tests
pnpm db:verify             passed; PostgreSQL 18.4 / 4 files / 36 tests / no skips
pnpm eval:validate         passed; 10 cases
pnpm eval:fixtures         passed; all fixture profiles
pnpm artifacts:validate   passed; 150 roots / 30 additional candidates;
                           manifest digest 17d2a47f8d99...
pnpm artifacts:verify     passed; 6 files / 76 tests
pnpm test:coverage        passed; 44 files / 786 tests; 76.13% statements,
                           68.72% branches, 83.22% functions, 75.93% lines
pnpm architecture:check   passed within verification; 642 modules /
                           2,040 dependencies; no violations
git diff --check          passed
production dependencies  unchanged; 13 direct/link production packages /
                           7 workspaces; no added dependency
pnpm-lock.yaml            unchanged from reviewed head and branch point
migration 0003             unchanged from reviewed head; migrations 0001 and
                           0002 unchanged from main
schema contracts/digests  unchanged from reviewed head
manifest files/digest     unchanged from reviewed head
candidate-content safety  synthetic bodies only; no candidate body, receipt,
                           or completion evidence committed
live artifact operation   not run
```
