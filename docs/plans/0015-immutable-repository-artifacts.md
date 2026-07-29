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
- Last updated: 2026-07-29

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

| Bound                             |                        Value |
| --------------------------------- | ---------------------------: |
| decoded artifact bytes            |                      256 KiB |
| selections per candidate          |                            4 |
| decoded candidate bytes           |                      512 KiB |
| decoded run bytes                 |                       64 MiB |
| logical lines per artifact        |                       10,000 |
| chunks per artifact               |                           64 |
| chunk bytes                       |                       16 KiB |
| logical lines per chunk           |                          200 |
| candidate concurrency             |                            2 |
| GitHub request concurrency        |                            1 |
| request timeout                   |                   10 seconds |
| candidate deadline                |                  120 seconds |
| batch deadline                    |                   60 minutes |
| path bytes/depth                  | 512 UTF-8 bytes / 8 segments |
| artifact JSON response            |                      512 KiB |
| ordinary GitHub metadata response |                        2 MiB |

Provider response limits include JSON/base64 overhead and remain distinct from
decoded limits. Phase 5's 64 KiB/file and 128 KiB/candidate limits do not
change.

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
- [ ] **Milestone 1 — Plan and ADR:** add this plan and ADR 0006; update the
      minimum product, architecture, security, and testing documents; validate,
      commit, push, and open a draft PR.
- [ ] **Milestone 2 — Manifest:** red tests, closed parser/digest/selection IDs,
      proposed reviewed paths, `artifacts:validate`, commit and PR review summary.
- [ ] **Milestone 3 — Contracts:** red tests, three roots, artifact preflight,
      parsers, IDs/digests, exports, mutation/compatibility tests, commit.
- [ ] **Milestone 4 — Persistence:** PostgreSQL failures first, migration 0003,
      tables/grants/closure/publication/loaders, runtime-role verification, commit.
- [ ] **Milestone 5 — Collection/chunking:** explicit API-version boundary,
      algorithm discovery, exact retrieval/tree checks, validation, hashing,
      chunking, limits, Phase 5 regressions, commit.
- [ ] **Milestone 6 — Operator/receipt:** separate commands, acknowledgement,
      isolation, limits/deadlines, telemetry, receipt/rerun support; no live run;
      commit.
- [ ] **Milestone 7 — Pre-live checkpoint:** full matrix, diff and hosted CI
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
candidate/artifact/chunk/set counts, kind/absence/failure counts, decoded
bytes, provider request/rate metadata, migration version, rerun comparison, and
its digest. It contains no source content.

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

## Validation evidence

Initial evidence is recorded under “Verified current repository state.” Each
milestone appends exact commands, results, failures, and resolutions here
before its next publication point.

No live provider collection has been run.
