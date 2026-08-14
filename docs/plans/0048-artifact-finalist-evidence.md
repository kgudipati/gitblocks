# Recovery R9 artifact-backed finalist evidence

## Status and authority

- Issue: [#48 — Recovery R9: Supply immutable artifact excerpts as finalist evidence](https://github.com/kgudipati/gitblocks/issues/48)
- Branch: `feat/48-artifact-finalist-evidence`
- Owner: GitBlocks maintainers
- State: implementation complete; final regression and publication pending
- Last updated: 2026-08-13

Issue #48 is the slice authority. Existing product contracts, accepted ADRs,
and repository engineering policy govern durable boundaries. This plan records
execution and evidence without expanding the issue. Historical Phase 6, Phase
7, R8, and superseded Phase 10 plans remain unchanged.

## Purpose and user-visible outcome

Private-alpha dogfood now reaches the correct R8 evidence-needed finalists but
ordinary ingestion cannot supply semantic README/documentation material for
their unresolved retry and Redis hard evaluations. R9 enables the existing
hosted `recommend_oss` journey to use a small deterministic set of exact,
line-addressed, immutable repository excerpts as candidate-owned direct
evidence.

The exercisable result is one controlled official-MCP recommendation over
ephemeral PostgreSQL where the frozen background-jobs query retains the same
five finalists, exact commit-coherent artifact excerpts enter only their
request-scoped dossiers, and the existing R8 model boundary and canonical
validation produce responsible satisfied, conflict, and unresolved outcomes.

R9 does not collect live evidence or artifacts, migrate persistent dogfood,
call OpenAI, or perform real-project dogfood. Those remain separately
authorized post-merge operations.

## Verified current repository state

- Before branching, `main`, `HEAD`, and local `origin/main` were all
  `c221985a8d95272bd6c92c5505f8df3dc5f92e7f`; the worktree was clean.
- PR #47 is merged, Issue #46 is closed completed, and R8 is present on main.
  The Phase 10 branch remains preserved at
  `15270c602872fc9d39736a1350487ada574fb5ff` and is explicitly superseded.
- Persistent `gitblocks_dogfood_test` maps to `127.0.0.1:51916`, runs
  PostgreSQL 18.4, has migrations 0001 through 0006 with
  `finalist-evidence-serving` latest, and serves snapshot
  `serving-6fb3890c53261a7f68ab8b1db20c6d9da9169ecc0f2510dc` with
  150/150/150 candidate/profile/retrieval-metadata records. Evidence,
  lifecycle, dossier, and all four artifact-table counts are zero.
- `packages/ingestion/src/profile.ts` records allowlisted-file presence at the
  exact head and states that content is not interpreted semantically. Other
  structured observations cover repository identity/head/state, releases,
  tags, license, security-policy presence, npm version/linkage/runtime shape,
  and advisories.
- `packages/ingestion/src/candidate-profile-projection.ts` keeps
  `capability-variants-features` and `required-infrastructure` unknown because
  they require reviewed curator classification. Ordinary `ingest:live` alone
  therefore cannot prove retry support or Redis requirements.
- R8 rejects silence and unrelated evidence as satisfaction and selects the
  exact five frozen evidence-needed finalists in deterministic order.
- Every finalist has at least one `root-readme`/`readme` selection in
  `catalog/public-v1/artifact-manifest.json`.
- The existing collector and `exact-lines-v1` chunker retain exact SHA-1
  commit/blob provenance, strict UTF-8 content, 256 KiB per artifact, 512 KiB
  per candidate, 16 KiB/200-line chunks, and at most 64 chunks per artifact.
- `CandidateDossierV1` contains observations, limitations, and unknowns;
  `FitAssessmentRequestV1` carries those dossiers. Hosted R8 loads no artifact
  material. Artifact persistence is separate.
- Migration 0003 grants the four artifact tables only to
  `gitblocks_persistence`; migration 0006 grants `gitblocks_serving` finalist
  evidence reads but not artifact reads.
- `assertArtifactLiveDatabaseMigrationVersionV1` requires exact migration 4,
  so the real artifact operator cannot target the accepted current schema.

## Scope and explicit non-goals

In scope:

- additive migration `0007_artifact_evidence_serving.sql`, adding only four
  exact artifact-table SELECT grants to the existing `gitblocks_serving` role;
- one bounded read-only persistence operation that authenticates an exact
  candidate/catalog/commit/cutoff artifact set and reconstructs existing
  artifact/set/chunk contracts;
- one pure deterministic selector driven only by finalist unresolved hard
  evaluations, normalized constraints, and the accepted retrieval-expansion
  authority;
- exact repository-head/artifact-commit coherence and request-scoped synthesis
  through the existing `git-commit` evidence source;
- one hosted application artifact-loader port wired in the composition root;
- exact migration-7 live artifact authority for new collection, preserving
  historical receipt parsing;
- unit, persistence/migration, hosted, provider-regression, and official MCP
  controlled integration tests; and
- affected current-state documentation plus this plan and a proportional ADR
  0006 amendment where its former no-model statement would become inaccurate.

Explicit non-goals: retrieval contracts, evaluation, algorithms, scoring,
channels, profiles, metadata, scanner, fingerprint, artifact collection,
ordinary evidence ingestion, live providers, OpenAI, a second model call,
repository interviews, prelive/calibration/review authority, new evidence
source variants, output contracts, artifact-excerpt persistence, new tables,
mutable artifact state, indexes, services, queues, workers, caches, vectors,
embeddings, crawlers, target persistence, a new MCP tool, deployment,
authentication, billing, plugin packaging, Phase 10, and real-project dogfood.

## Requirements crosswalk

| Issue requirement                       | Destination                                        | Validation evidence                                        |
| --------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| Exact immutable artifact read authority | migration 0007 and persistence loader              | role-denial and reconstruction integration tests           |
| Exact commit coherence                  | hosted pure augmentation boundary                  | absent/malformed/contradictory/mismatch unit tests         |
| Deterministic trusted terms             | selector over normalization and accepted expansion | canonical/original/expansion ordering tests                |
| Direct line-addressed excerpts          | selector evidence synthesis                        | Redis, retry/backoff, whitespace, UTF-8, URL/ID tests      |
| No absence inference                    | selector                                           | no-match tests produce zero observations                   |
| Request-scoped only                     | hosted dossier augmentation                        | persistence row-count and request preservation tests       |
| Preserve R8 validation                  | unchanged response/validator plus regression       | satisfied/conflict/unresolved/invalid-promotion tests      |
| One model call and thin MCP             | existing hosted composition                        | official MCP controlled integration and adapter regression |
| Migration-7 live guard                  | artifact live authority                            | migration 6 reject / 7 accept / historical receipt tests   |
| Persistent dogfood unchanged            | read-only pre/post inspection                      | exact snapshot and table-count comparison                  |

## Assumptions, risks, and unresolved decisions

Verified facts are recorded above. The design assumes existing repository
artifact contract parsers/digest helpers can authenticate the selected
material without a new DTO and the existing `git-commit` evidence variant can
represent an immutable line URL. If either proves false, stop and update Issue
#48 rather than adding a parallel contract.

Primary risks are cross-candidate or stale-commit evidence, line-range drift,
Unicode truncation, duplicate evidence identities, uncontrolled request size,
invented synonym authority, absence inference, prompt injection, widened
database grants, and weakening R8 grounding. Mitigations are exact candidate,
catalog, SHA-1 commit, cutoff, contract/digest and line checks; approved terms
only; deterministic caps; source text kept inert; request-scoped augmentation;
least-privilege role tests; and unchanged canonical output validation.

The selector reuses `expandRetrievalTermsV1(...)` inside the hosted application,
where the validated expansion authority already exists. Persistence and the
MCP adapter receive no retrieval knowledge, and no new synonym authority is
introduced.

## Applicable ADRs and contracts

- [ADR 0002](../architecture/decisions/0002-typescript-workspace-and-toolchain.md):
  use pinned Node 24.18.0, pnpm, strict ESM/TypeScript, Vitest, architecture,
  repository-policy, secret, and final verification gates.
- [ADR 0003](../architecture/decisions/0003-product-contract-kernel.md): retain
  the existing closed `CandidateDossierV1`, `FitAssessmentRequestV1`,
  `EvidenceObservationV1`, and `RecommendationAssessmentResponseV1` contracts
  and canonical preservation/grounding validation.
- [ADR 0004](../architecture/decisions/0004-postgresql-evidence-persistence.md):
  use injected clients, schema-qualified parameterized SQL, value-free errors,
  explicit read-only transactions, exact persisted validation, and no implicit
  migration.
- [ADR 0005](../architecture/decisions/0005-public-repository-ingestion.md):
  ordinary ingestion remains separate and supplies repository-head chronology;
  no provider collection occurs in this change.
- [ADR 0006](../architecture/decisions/0006-immutable-repository-artifacts.md):
  retain immutable source/set/chunk identity, strict UTF-8 and lossless line
  authority, collector separation, and bounds. Amend only the later authorized
  request-scoped model-use consequence; do not change artifact persistence.
- [ADR 0011](../architecture/decisions/0011-postgresql-retrieval-serving.md):
  retain immutable serving snapshot/catalog authority and least-privilege
  `gitblocks_serving`; R9 adds only exact artifact table reads.
- [ADR 0012](../architecture/decisions/0012-openai-target-fit-provider.md): keep
  the existing one-call, no-tools/no-retry, strict-output fit boundary and
  provider request-size controls.
- `CandidateRetrievalRequestV1`, `CandidateRetrievalResultV1`,
  `RepositoryFingerprintV1`, `RecommendationAssessmentResponseV1`, and all
  retrieval authority remain unchanged.

## Architecture, data flow, and performance impact

```text
deterministic retrieval finalists (unchanged)
  -> active dossier loader
  -> evidence-needed finalist only:
       exact repository-head commit
       + read-only exact artifact material loader
       + pure bounded excerpt selector
       -> request-scoped dossier observations
  -> existing FitAssessmentRequestV1
  -> existing one model call maximum
  -> existing R8 canonical validation
```

The hosted application owns both ports and the augmentation decision. The
composition root alone wires concrete persistence. Retrieval and the MCP
handler receive no database capability. Request-time work performs no public
network or database write.

Bounds are at most five finalists, only evidence-needed artifact loads, two
excerpts per unresolved evaluation, eight derived observations per candidate,
32 per recommendation, 100 total dossier observations, existing artifact
limits, and the existing provider byte ceiling. Matching is case-insensitive
over already-bounded validated chunk text with deterministic stable ordering.
There is no retry, pagination, new concurrency, cache, or background work.

## Security, privacy, abuse, and supply-chain considerations

Assets are immutable public artifact identity/content, candidate evidence
ownership, repository-head chronology, and responsible recommendation
semantics. Untrusted inputs are persisted artifact/set/chunk rows, public
source text, dossier evidence, normalized user query fields, and model output.
Artifact text remains inert data: it is never executed or allowed to alter
trusted term derivation, selection order, controls, schema, or validation.
Adversarial instruction text may be selected only as literal evidence and is
covered by the existing model instruction plus deterministic validation.

The serving login receives only SELECT on four named public immutable artifact
tables and no persistence-role membership, mutation, truncate, function, or
DDL authority. Errors and telemetry remain content-free and value-free. No
credential or environment file is read; no public/private target source,
secret, personal data, provider response, prompt, or raw model output is
logged or committed. No dependency or CI-action change is expected.

The durable artifact remains the retention/deletion authority; normalized
excerpts exist only in request memory and cross only the already-approved fit
provider boundary when a real composition is separately configured. R9 tests
use controlled synthetic public text and no provider.

## Implementation milestones

### Milestone 1: red tests and exact authority mapping

- Add selector tests for Redis, retries/backoff, no match, mismatch,
  contradictory heads, whitespace/Unicode bounds, deterministic ordering,
  adversarial text, and caps.
- Add persistence and migration red tests for exact set reconstruction,
  candidate/catalog/commit/cutoff mismatch, corrupt material, role grants, and
  mutation/DDL denial.
- Identify and reuse the exact existing retrieval-expansion accessor.
- Evidence: focused tests fail for missing R9 behavior while existing R8
  frozen-query regression remains green.

### Milestone 2: migration and persistence read

- Add migration 0007 with no schema objects beyond grants.
- Advance only current generic migration inventory/count/table-grant checks.
- Implement the narrow read-only artifact material operation and export it
  through persistence's public surface.
- Evidence: focused integration passes on ephemeral PostgreSQL 18.4 through
  migration 0007, including serving-role denials.

### Milestone 3: selector and request-scoped evidence

- Implement deterministic term derivation, exact-line extraction, stable IDs,
  immutable line URLs, whitespace normalization, and all caps.
- Use the existing `git-commit` source with repository-head `publishedAt` and
  artifact first-materialization `collectedAt`.
- Evidence: selector unit/abuse tests and contract parsing/preservation pass.

### Milestone 4: hosted composition and controlled journey

- Add the application-owned artifact loader port and evidence-needed-only
  augmentation after dossier loading and before the all-empty/model boundary.
- Wire concrete persistence in the composition root.
- Extend hosted unit and controlled official-MCP PostgreSQL integration with
  exact frozen finalists and satisfied/conflict/unresolved results.
- Keep OpenAI adapter request/response contract and one-call behavior
  unchanged.
- Evidence: real hosted composition and official MCP client pass without
  external provider/model calls.

### Milestone 5: operator guard, documentation, and final evidence

- Require exact migration 7 for new `artifacts:live` authorization while
  preserving historical receipt parsing/validation.
- Update affected current-state product/system/hosted/persistence/ingestion
  documentation and narrowly amend ADR 0006.
- Perform complete diff/security/architecture/compatibility review, final
  regression once, persistent dogfood read-only post-check, publication, and
  Actions inspection without rerun.

## Testing and validation strategy

Working directory for every command is the repository root. Runtime preflight
must report Node 24.18.0. Tests use controlled clocks, synthetic artifact text,
injected model behavior, the official MCP client, and ephemeral PostgreSQL
18.4 only. They make no public network or provider call.

Focused development commands:

```text
pnpm runtime:check
pnpm db:verify
pnpm exec vitest run apps/gitblocks-hosted/test/artifact-evidence-selector.test.ts
pnpm exec vitest run apps/gitblocks-hosted/test/application.test.ts apps/gitblocks-hosted/test/composition.test.ts apps/gitblocks-hosted/test/openai-fit-model.test.ts
pnpm exec vitest run packages/ingestion/test/artifact-live-authority.test.ts packages/ingestion/test/artifact-receipt.test.ts
pnpm --filter @gitblocks/persistence typecheck
pnpm --filter @gitblocks/gitblocks-hosted typecheck
pnpm --filter @gitblocks/ingestion typecheck
pnpm architecture:check
```

Database and contract gates:

```text
pnpm db:verify
pnpm contracts:validate
```

Final regression, run once after focused checks are green:

```text
pnpm verify
```

Publication review also runs `git diff --check`, `git status --short`, a full
changed-file/diff review, secret/prohibited-content review, and the plan's
read-only persistent database pre/post query. `pnpm verify:ci` is not required
locally unless the registry-backed audit is explicitly needed; the natural
GitHub Actions run is inspected once and never rerun for the known no-runner
billing condition.

## Observability and operations

The existing loopback-only hosted application remains the production path and
retains its bounded correlated recommendation stage/outcome/finalist/option
events. R9 adds no deployed service, worker, provider call, retry, health
surface, SLO, dashboard, alert, or telemetry backend. Artifact source text,
IDs, paths, URLs, commits, and excerpt bodies remain excluded from telemetry.
Existing value-free persistence failures map through the current hosted
failure boundary. No new telemetry schema is required.

## Migration, compatibility, rollout, and recovery

Migration 0007 is additive and forward-only: no tables, columns, indexes,
functions, triggers, or data changes. Existing code ignores the grant. New R9
code fails closed when migration 0007 is absent or exact matching artifact
material is unavailable. `CandidateDossierV1`, `FitAssessmentRequestV1`,
`RecommendationAssessmentResponseV1`, evidence source variants, retrieval,
and artifact contracts remain byte-compatible.

Rollout after separate authorization is: merge R9; migrate dogfood to 0007;
ordinary targeted ingestion for the five finalists; targeted artifact
collection for the same five; then hosted recommendation. R9 implementation
does none of those persistent/live steps. Code rollback leaves the additive
grant unused. A schema defect receives a corrective forward migration; no down
migration or destructive recovery is added. Artifact/head mismatch yields no
derived evidence rather than stale fallback.

## Exact exit criteria

- Issue #48's frozen query, exact finalist order, excerpt, absence, mismatch,
  adversarial, request-scope, role, operator, MCP, and R8-validation criteria
  all pass.
- Migration 0007 grants exactly four SELECT privileges and adds no tables or
  mutable state.
- Retrieval, scanner, interviews, MCP tools, output contracts, evidence source
  variants, and artifact persistence are unchanged.
- Documentation and ADR statements match implemented request-scoped behavior.
- Focused checks, architecture, contracts, `pnpm db:verify`, and one final
  `pnpm verify` pass with no skipped PostgreSQL tests.
- Persistent dogfood remains migration 0006 with the exact baseline snapshot
  and unchanged serving/evidence/lifecycle/dossier/artifact counts.
- One normal commit is pushed and one draft PR is open, unmerged, with exact
  evidence and honest Actions state.

## Progress log

- [x] 2026-08-13: Verified baseline repository, merged R8 authority, preserved
      Phase 10 state, persistent dogfood state, blocker facts, artifact foundation,
      and current grants/live guard before editing.
- [x] 2026-08-13: Created Issue #48 and branch
      `feat/48-artifact-finalist-evidence`; authored this initial plan.
- [x] 2026-08-13: Milestone 1 — recorded the missing-selector red test and
      mapped term authority to the existing one-hop retrieval expansion helper.
- [x] 2026-08-13: Milestone 2 — added migration 0007, the exact read-only
      candidate/catalog/commit/cutoff artifact loader, and serving-role grant and
      mutation/DDL denial coverage.
- [x] 2026-08-13: Milestone 3 — added deterministic exact-line selection,
      reproducible evidence IDs, immutable line URLs, whitespace disclosure,
      commit coherence, no-match behavior, and request/candidate/evaluation caps.
- [x] 2026-08-13: Milestone 4 — wired evidence-needed-only augmentation into
      hosted composition and passed the controlled official MCP/PostgreSQL journey
      with retry, Redis conflict, absence, and mismatched-commit fixtures.
- [ ] Milestone 5: operator guard, documentation, final regression, and
      persistent post-check are complete; publication remains.

## Decision and deviation log

- 2026-08-13: Reuse the existing `git-commit` evidence source and unchanged
  dossier/request/response contracts. The new evidence is a request-scoped
  projection of durable artifact material, not another persisted authority.
- 2026-08-13: Amend ADR 0006 narrowly because its existing statement that
  artifact content is never sent to a model would otherwise become false;
  immutable provenance and Phase 6 historical behavior remain unchanged.
- 2026-08-13: Keep the historical catalog-only seed at exact migration 0004 by
  separating it from `withVerifiedArtifactLiveDatabaseMigrationV1`; only the
  real live artifact collector advances to exact migration 0007.
- 2026-08-13: Treat migrations 0005–0007 as additive compatibility for the
  dormant interview/profile authorities while advancing current serving
  bootstrap and operator receipt inventory checks to migration 0007. This
  avoids rewriting historical receipts or Phase 6/7 authority.
- 2026-08-13: Select one complete logical source line per match and omit a line
  rather than truncating it when its whitespace-normalized statement would
  exceed 1,800 UTF-16 code units. This keeps the exact line range authoritative
  and stays comfortably within the 2,000-code-unit evidence contract.

## Validation evidence

- 2026-08-13: repository baseline — `main`, HEAD, and `origin/main` exact at
  `c221985a8d95272bd6c92c5505f8df3dc5f92e7f`; clean worktree; Node 24.18.0;
  pnpm 11.17.0.
- 2026-08-13: GitHub authority — PR #47 merged; Issue #46 closed completed;
  Issue #48 created open.
- 2026-08-13: persistent database read-only precheck — PostgreSQL 18.4,
  migrations 1–6, exact current serving snapshot and 150/150/150 counts;
  evidence/lifecycle/dossier/artifact tables all zero.
- 2026-08-13: source inspection — all issue stop-gate blocker and artifact
  foundation facts matched current main.
- 2026-08-13: red selector test — focused Vitest failed because
  `artifact-evidence-selector.ts` did not exist; after implementation, the six
  Redis/retry/absence/mismatch/adversarial/reproducibility tests pass.
- 2026-08-13: focused hosted validation — selector (eight cases), application,
  composition, and OpenAI adapter suites pass; hosted lint and typecheck pass.
- 2026-08-13: artifact operator validation — exact migration 7 accepted,
  migration 6 rejected before effects, historical receipt tests unchanged;
  ingestion focused suites pass (27 tests) and typecheck passes.
- 2026-08-13: architecture — `pnpm architecture:check` passes with 943 modules,
  3,217 dependencies, and no violations.
- 2026-08-13: database — `pnpm db:verify` passes on ephemeral PostgreSQL 18.4
  with seven migrations, 29 public product tables, zero RLS policies, and all
  73 integration tests without skips. The official MCP exercise observes
  artifact-excerpt counts `[2, 2, 0, 0, 0]` for the frozen finalists; the
  fourth fixture's mismatched commit and fifth fixture's no-material state
  produce no excerpt.
- 2026-08-13: ingestion and contracts — `pnpm ingestion:verify` passes 339
  tests plus catalog validation/typecheck; `pnpm contracts:validate` passes all
  ten conformance cases.
- 2026-08-13: final regression — the first `pnpm verify` attempt stopped at
  three lint-only redundant comparisons on TypeScript literal fields in the
  persistence loader. Command validation, SQL predicates, and persisted
  parsing already enforced those values; the comparisons were removed,
  repository-wide lint passed, and the authoritative rerun passed all 139 test
  files / 2,051 tests plus formatting, builds, typechecks, architecture,
  repository/evaluation/contract authorities, schemas, and secret scanning.
- 2026-08-13: persistent database read-only post-check —
  `gitblocks_dogfood_test` remains PostgreSQL 18.4 at six migrations with
  `finalist-evidence-serving` latest, the exact baseline snapshot, 150/150/150
  serving counts, and zero evidence/lifecycle/dossier/artifact rows. Migration
  0007 was not applied.
