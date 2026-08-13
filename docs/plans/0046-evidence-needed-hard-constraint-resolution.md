# Recovery R8 evidence-needed hard-constraint resolution

## Status and authority

- Issue: [#46 — Recovery R8: Resolve evidence-needed hard constraints from finalist evidence](https://github.com/kgudipati/gitblocks/issues/46)
- Branch: `feat/46-evidence-needed-resolution`
- Owner: GitBlocks maintainers
- State: implementation and validation complete; publication pending
- Last updated: 2026-08-13

Issue #46 is the slice authority. The accepted product contracts, ADRs, and
repository engineering policies govern durable boundaries. This plan records
execution and evidence; it does not expand the issue. Historical R6/R7 plans
remain unchanged. The closed Phase 10 issue, unmerged PR, and preserved branch
are not implementation inputs.

## Purpose and executable user-visible outcome

The first realistic private-alpha capability preparation proved an executable
deadlock: the exact background-jobs query normalized successfully, but current
production retrieval returned zero eligible and 29 evidence-needed candidates.
Hosted R6 returned before loading their already-supported active dossiers, so
candidate-owned evidence could never resolve the deterministic uncertainty.

R8 changes only the hosted post-retrieval sequence:

```text
normalize
  -> unchanged deterministic retrieval
  -> eligible finalists first
  -> fill remaining <=5 slots from ordered evidence-needed finalists
  -> load active candidate dossiers
  -> one bounded recommendation assessment
  -> exact hard-evaluation resolution validation
  -> existing target-fit validation
  -> <=3 responsible options
```

The current dogfood database has zero evidence. Its intended R8-visible result
therefore remains `insufficient-evidence` with zero model calls until a later,
separately authorized targeted ingestion operation supplies evidence. A
controlled temporary-PostgreSQL exercise must prove that evidence-backed
satisfied, conflict, and unresolved records can reach responsible outcomes.

## Verified current repository state

- Before branching, `main`, `HEAD`, and local `origin/main` were all
  `5cfed8bc646566485379225b3ff80ec22625917d`; the worktree was clean.
- PR #45 and PR #43 are merged. Issue #44 and Issue #42 are closed completed.
  PR #33 is closed unmerged and Issue #32 is closed not-planned. Local branch
  `feat/32-codebase-conditioned-ranking` remains at its preserved historical
  head.
- Container `gitblocks-dogfood-postgres` runs PostgreSQL 18.4 with database
  `gitblocks_dogfood_test`, current serving snapshot
  `serving-6fb3890c53261a7f68ab8b1db20c6d9da9169ecc0f2510dc`, and 150 catalog,
  profile, and retrieval-metadata records. Evidence, limitations, material
  unknowns, lifecycle corrections, and dossier snapshots are all zero.
- `packages/retrieval` evaluates hard constraints only through
  `evaluateCandidateConstraints(...)` over deterministic profiles. Conflict is
  excluded, unresolved is evidence-needed, and satisfied is eligible.
- `@gitblocks/retrieval` has no persistence dependency and does not read
  `EvidenceObservationV1` or `CandidateDossierV1`.
- Every evidence-needed result already carries bounded
  `unresolvedHardEvaluations` records with evaluation/source/modality/facet/
  concept/profile/rule identity and unresolved match/state.
- Hosted R6 returns `deterministic-evidence-needed` before dossier loading when
  eligible is empty and otherwise constructs finalists only from eligible
  candidates.
- Existing `loadActiveCandidateDossier(...)` already provides bounded,
  candidate-owned, cutoff-valid public evidence for any selected candidate.
- Existing target-fit exchange validation owns candidate-set closure, supplied
  evidence/limitation/unknown preservation, evidence ownership, inference and
  claim ownership, hard-conflict references, disposition, ranking, maximum
  results, and repository-fact grounding.
- ADR 0012 pins one OpenAI Responses call to
  `gpt-5.4-mini-2026-03-17`, strict Structured Outputs, `store: false`, no
  tools, one deadline, no retry, and canonical post-response validation.
- `pnpm runtime:check` passed on Node 24.18.0 before implementation.

## Scope and explicit non-goals

In scope:

- one additive `RecommendationAssessmentResponseV1` model-response wrapper;
- one bounded `EvidenceNeededHardConstraintResolutionV1` record shape;
- exact contract parsing and exchange validation against normalization,
  selected retrieval finalists, fit request, and nested target-fit response;
- eligible-first deterministic finalist selection capped at five;
- active dossier loading for selected eligible and evidence-needed finalists;
- unchanged all-empty-evidence zero-model behavior;
- application-owned finalist lane/evaluation model context;
- the existing OpenAI adapter's strict schema and instruction update;
- existing hosted result shapes extended only with validated resolution arrays
  for model-assessed outcomes;
- focused contract, hosted, provider, MCP/PostgreSQL, and exact current-authority
  regression tests; and
- current product/system/hosted/contracts documentation plus this plan.

Explicit non-goals: retrieval implementation/contracts/scoring/channels,
candidate profiles/metadata, target-aware retrieval, Phase 10 ranking or gold,
ingestion/provider collection, a GitHub ingestion token, live OpenAI, model
selection/routing/fallback/repair, scanner or Skill changes, another MCP tool,
repository interviews, artifacts, profile regeneration, migrations/tables,
target or resolution persistence, service/queue/cache/worker/vector/embedding,
deployment/authentication/plugin packaging, and real-project dogfood.

## Requirements crosswalk

| Issue requirement                                                  | Destination                                                    | Evidence                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------ |
| Eligible-first <=5 finalist selection                              | Hosted application pure helper/use case                        | Selection unit tests and frozen-query regression |
| Zero eligible no longer short-circuits when evidence-needed exists | Hosted application                                             | Dossier-loader/model-call tests                  |
| Exact resolution coverage and ownership                            | Additive contracts validator                                   | Contract negative/abuse suite                    |
| Conflict/unresolved/satisfied safety                               | Additive validator over existing fit exchange                  | Contract and application controlled outcomes     |
| One bounded model input/output                                     | Application port and OpenAI adapter                            | Adapter request/schema/one-call tests            |
| Existing target-fit authority retained                             | Nested `TargetFitAssessmentResponseV1` plus existing validator | Existing and additive regression tests           |
| Official MCP exercise                                              | Existing `recommend_oss` composition                           | Temporary PostgreSQL official-client test        |
| Production dogfood regression                                      | Current accepted authorities and exact frozen query            | No-gold regression fixture                       |
| Persistent dogfood database unchanged                              | Read-only pre/post aggregate checks                            | Snapshot/evidence count evidence                 |
| Current docs and publication                                       | Named docs, one commit/push/draft PR                           | Diff, links, PR, Actions state                   |

## Assumptions, risks, and unresolved decisions

Verified facts are listed above. The working design assumes existing inference
and fit-exchange validators are sufficient evidence carriers and ownership
authorities; R8 adds only cross-binding, not duplicate evidence semantics.

Primary risks:

- a model could invent, omit, duplicate, or cross-bind an evaluation;
- absence of a Redis mention could be misclassified as satisfaction;
- conflict or unresolved candidates could be promoted or ranked;
- a resolution could cite another candidate's inference/evidence;
- normalization source IDs or hard-constraint reason codes could drift;
- an evidence-needed finalist could displace an eligible finalist;
- provider schema projection could diverge from the canonical contract; or
- tests could accidentally target the persistent dogfood database.

Mitigations are closed schemas, exact coverage and candidate/evaluation keys,
exact normalization-to-capability-request binding, same-candidate inference
and supplied-evidence validation, disposition/ranking/conflict checks, eligible-
first selection, existing canonical target-fit validation, injected model and
ephemeral PostgreSQL fixtures, and post-work dogfood aggregate verification.

No material design decision remains open before implementation. If existing
fit contracts cannot express the required conflict/unresolved dispositions or
the additive wrapper would require changing retrieval/persistence, stop and
update Issue #46 rather than broadening the slice.

## Applicable ADRs and contracts

- [ADR 0002](../architecture/decisions/0002-typescript-workspace-and-toolchain.md):
  use pinned Node/pnpm/TypeScript, direct TypeBox-derived contracts, Vitest,
  strict typechecking, architecture rules, and the repository verification
  graph.
- [ADR 0003](../architecture/decisions/0003-product-contract-kernel.md):
  define the additive closed response shape once, derive static type/parser/
  schema, and keep semantic validation centralized and value-free.
- [ADR 0004](../architecture/decisions/0004-postgresql-evidence-persistence.md):
  reuse active candidate-owned evidence and lifecycle/cutoff semantics without
  changing storage.
- [ADR 0009](../architecture/decisions/0009-production-retrieval.md): retrieval
  remains pure and authoritative for eligible/evidence-needed/excluded lanes;
  R8 does not reinterpret or modify its output.
- [ADR 0011](../architecture/decisions/0011-postgresql-retrieval-serving.md):
  retain the current immutable serving snapshot composition and separate
  request-time evidence reads.
- [ADR 0012](../architecture/decisions/0012-openai-target-fit-provider.md):
  retain the exact model, one-call boundary, strict provider projection,
  byte/deadline limits, no tools/retry/fallback, and canonical validation.
- `CandidateRetrievalRequestV1`, `CandidateRetrievalResultV1`,
  `FitAssessmentResponseV1`, and `TargetFitAssessmentResponseV1` remain
  unchanged.
- `RecommendationAssessmentResponseV1` is additive and request-scoped. It is
  not persisted and does not replace the nested target-fit response.

No new ADR is required because R8 implements the already accepted boundary:
deterministic retrieval, candidate evidence, then hosted target-fit judgment.

## Architecture, data flow, and performance impact

Finalists are selected without cross-lane score comparison:

```text
eligible = eligibleCandidates.slice(0, 5)
remaining = 5 - eligible.length
evidenceNeeded = evidenceNeededCandidates.slice(0, remaining)
finalists = [...eligible, ...evidenceNeeded]
```

Excluded candidates never appear. The application loads at most five dossiers
concurrently as before. If every selected dossier has zero observations, it
returns insufficient evidence with zero model calls. Otherwise it sends one
fit request plus at most five lane/evaluation summaries to the existing model
port and validates one additive response wrapper.

Bounds remain: 10 retrieval results per lane, five model finalists, three
responsible options, existing dossier/evidence/contract limits, one provider
call, current request/response byte limits, current 60-second deadline, no
retry, no new persistence, and no new concurrency. Validation is linear in the
already-bounded finalist evaluations, inferences, evidence, constraints, and
ranking records.

## Security, privacy, abuse, and supply chain

Assets are trustworthy hard-constraint semantics, candidate-owned public
evidence, minimized target facts, and responsible results. Actors are the
request originator, hosted application, injected/provider model, PostgreSQL
serving login, and thin MCP caller. Untrusted inputs are the capability query,
fingerprint, stored public evidence, retrieval-derived candidate identifiers,
and model response.

The model receives only selected finalist IDs, lane, and exact unresolved
evaluation records in addition to the existing bounded fit request and
normalization. It receives no excluded/truncated candidate, profile body,
evaluation gold, credential, SQL, environment, raw source, or provider data.
Satisfied/conflict states require same-candidate inferences already grounded in
supplied evidence; silence remains unresolved. Canonical code—not the model—
binds normalization IDs, constraint IDs, reason codes, disposition, conflicts,
ranking exclusion, and target facts. Invalid output fails with bounded errors
and no repair call.

No dependency, lockfile, CI action, provider, credential, persistence, or
supply-chain surface changes. Repository/candidate content remains inert and
never executes.

## Implementation milestones

1. **Red-first contract regression.** Add wrapper/record schema tests and exact
   coverage, source-binding, ownership, disposition, conflict, and ranking
   failures before implementation.
2. **Additive contract and validator.** Implement schema, parser, exports,
   schema-catalog registration, nested target-fit reuse, and deterministic
   exchange validation.
3. **Hosted finalist flow.** Add eligible-first selection, evidence-needed
   dossier loading, bounded finalist model context, result exposure, and all
   zero/no-evidence/selection tests.
4. **Provider and MCP exercise.** Update the strict response schema and system
   instruction, retain projection/model/one-call controls, and extend temporary
   PostgreSQL official-MCP coverage.
5. **Current-authority regression and docs.** Exercise the exact frozen query
   against accepted production authorities without evaluation gold, and update
   current product/system/hosted/contracts docs.
6. **Final regression and publication.** Run focused gates, architecture,
   contracts, PostgreSQL integration, `pnpm verify`, dogfood read-only safety,
   diff/security review, then commit, push, open one draft PR, inspect natural
   Actions once, and stop.

## Testing and validation strategy

Focused development commands from repository root:

```text
pnpm runtime:check
pnpm exec vitest run packages/contracts/test/oss-recommendation-contracts.test.ts --config vitest.config.ts
pnpm exec vitest run apps/gitblocks-hosted/test/application.test.ts --config vitest.config.ts
pnpm exec vitest run apps/gitblocks-hosted/test/openai-fit-model.test.ts --config vitest.config.ts
pnpm exec vitest run apps/gitblocks-hosted/test/mcp.test.ts --config vitest.config.ts
pnpm exec vitest run apps/gitblocks-hosted/test/hosted-recommendation.persistence-integration.ts --config vitest.db.config.ts
pnpm --filter @gitblocks/contracts typecheck
pnpm --filter @gitblocks/gitblocks-hosted typecheck
pnpm contracts:validate
pnpm architecture:check
```

The official controlled PostgreSQL/MCP exercise uses only the repository's
ephemeral PostgreSQL 18.4 lifecycle:

```text
pnpm db:verify
```

Final regression and review gates:

```text
pnpm verify
git diff --check
git status --short
```

`pnpm verify:ci` is not planned locally because R8 changes no dependency or
lockfile; the natural GitHub workflow owns the registry-backed audit. If its
jobs receive zero runner/zero steps under the known billing/spending-limit
condition, record that once without rerun or CI weakening.

Tests use controlled clocks, injected model output, current committed public
authorities, and temporary PostgreSQL only. No live network/provider call,
arbitrary sleep, historical ranking/retrieval gold, candidate execution, or
persistent dogfood write is permitted.

## Observability and operations

R8 changes the existing `hosted.recommendation` path but adds no service or
deployment. Existing correlated/redacted events already report stage, outcome,
finalist count, and responsible-option count; finalist count will truthfully
include selected evidence-needed finalists. Tests verify retrieved/evidence-
loaded/model/completed/failed event counts and no model call on empty evidence.
No new identifier, prompt, evidence, resolution, or candidate content enters
telemetry. Dashboard, alert, SLO, queue, worker, and runbook changes are not
applicable because R8 introduces none of those surfaces.

## Migration, compatibility, rollout, and recovery

No PostgreSQL migration or persisted-data change exists. The additive
`RecommendationAssessmentResponseV1` is used only at the model boundary; the
existing immutable fit and target-fit response contracts remain valid and
unchanged. The hosted product result adds a bounded resolution array only for
model-assessed outcomes; clarification/unsupported and pre-model insufficient/
no-viable paths retain their current shapes where applicable.

Rollout is ordinary hosted-code replacement. Existing five-eligible behavior
is preserved with an empty resolution array. Recovery is a code rollback to R7;
no stored resolution or data backfill exists. Invalid model output fails closed
without partial result, retry, or repair.

## Exact exit criteria

- The exact frozen query still proves zero eligible and evidence-needed exists,
  while R8 selects the current first five evidence-needed IDs for dossier load.
- All finalist-selection combinations, order, exclusion, and five-candidate
  limit pass.
- Exact resolution coverage, source binding, ownership, grounding,
  disposition, conflict, ranking, target fact, and candidate-set invariants
  pass positive and negative tests.
- All-empty evidence returns insufficient-evidence with zero model calls.
- Controlled satisfied, conflict, and unresolved candidates yield only allowed
  dispositions and at most three responsible options through official MCP.
- Model/provider remains the exact ADR 0012 one-call boundary and its adapter
  tests pass.
- Retrieval source/contracts, scanner/Skill, MCP tool inventory, migrations,
  persistence meanings, model ID, and Phase 10 remain unchanged.
- Focused checks, `pnpm contracts:validate`, `pnpm db:verify`, architecture,
  and one final `pnpm verify` pass and are recorded.
- Persistent dogfood pre/post snapshot and zero-evidence state match exactly.
- Complete diff, secrets/prohibited-content, changed-line, and Definition-of-
  Done reviews pass.
- One intentional commit is pushed and one issue-linked draft PR is open and
  unmerged; natural Actions state is recorded without rerun.

## Progress log

- 2026-08-13: Verified exact clean `main`/origin baseline, GitHub recovery and
  Phase 10 state, preserved historical branch, dogfood PostgreSQL snapshot and
  zero-evidence state, runtime pin, six root-cause facts, applicable ADRs,
  engineering standards, R6 implementation/history, and issue authority.
- 2026-08-13: Created Issue #46 and branch
  `feat/46-evidence-needed-resolution`; initial execution design recorded.
- 2026-08-13: Added the wrapper contract red-first; the focused Vitest run
  failed as expected because `parseRecommendationAssessmentResponseV1` did not
  yet exist. Implemented the closed additive schema, parser, schema-catalog
  root, and canonical exchange validator while retaining the nested target-fit
  contract unchanged.
- 2026-08-13: Implemented deterministic eligible-first finalist filling,
  evidence-needed dossier loading, the all-empty zero-model stop, bounded model
  finalist context, validated resolution output, and the new strict OpenAI
  response schema/instruction without changing model or provider controls.
- 2026-08-13: The current-authority frozen background-jobs regression passed:
  primary family `background-jobs`, normalized required `retries`, normalized
  prohibited `redis`, pre-retrieval 0 eligible/29 evidence-needed, returned 0
  eligible/10 evidence-needed, and selected
  `jobs-actionhero-node-resque`, `jobs-asynq`, `jobs-bree`, `jobs-bullmq`, and
  `jobs-node-cron` for dossier loading. Empty observations returned
  `insufficient-evidence` with zero model calls.
- 2026-08-13: Focused contract (25 tests), hosted application (14 tests),
  OpenAI adapter, and MCP suites passed. Contract conformance passed (10 cases,
  40 supplied candidates), architecture reported zero dependency violations,
  and ephemeral PostgreSQL verification passed on PostgreSQL 18.4 with all six
  migrations and 71 database tests without skips. The controlled official-MCP
  exercise covered satisfied, conflict, unresolved, and invalid promotion
  outcomes without a live provider.
- 2026-08-13: The first `pnpm verify` attempt stopped at `format:check` because
  this plan required Prettier. After that mechanical correction, the next
  attempt advanced to lint and reported 13 new-code style findings; focused
  lint/typecheck fixes cleared them before another full gate. A subsequent
  controlled-PostgreSQL assertion exposed that the exact dogfood finalists
  carry four hard evaluations each (normalized and preserved forms for both
  constraints), not two; the test expectation was corrected to the actual
  production context. The final focused `pnpm db:verify` then passed all 71
  tests without skips.
- 2026-08-13: The corrected authoritative `pnpm verify` completed successfully:
  formatting, product/tool builds, lint, all workspace typechecks, 138 test
  files and 2,041 tests, zero architecture violations, repository checks,
  evaluation/retrieval/interview fixtures and authorities, product contract
  conformance, taxonomy/expansion/profile/catalog validation, operator/pre-live
  schemas, and secret scanning all passed.

## Decision and deviation log

- 2026-08-13: Use one `RecommendationAssessmentResponseV1` wrapper containing
  the unchanged `TargetFitAssessmentResponseV1` and bounded
  `EvidenceNeededHardConstraintResolutionV1` records. This is the smallest
  model-boundary addition and does not create a general resolution framework.
- 2026-08-13: Keep resolution inference IDs in the wrapper but reuse the nested
  fit response's inference/evidence catalogs and existing exchange ownership
  validation; no second evidence carrier is introduced.
- 2026-08-13: Preserve current retrieval and cross-lane order exactly. R8 never
  compares scores between eligible and evidence-needed candidates.
- 2026-08-13: Require unresolved resolution records to carry an empty
  `inferenceIds` array. This is a conservative closed-model boundary: only
  positive or conflicting determinations may cite candidate-owned inferences;
  missing support cannot gain implied grounding.
- 2026-08-13: No new ADR is required. Implementation reused the accepted
  deterministic-retrieval → candidate-evidence → hosted-fit boundary and
  discovered no persistence, provider, deployment, or service decision beyond
  ADRs 0003, 0009, 0011, and 0012.

## Validation evidence

- `pnpm runtime:check` — passed before implementation on Node 24.18.0.
- Local/GitHub baseline inspection — matched expected main SHA, merged/closed
  recovery history, superseded Phase 10 state, and preserved branch.
- Read-only dogfood PostgreSQL inspection — PostgreSQL 18.4; expected current
  serving snapshot; 150 profiles/metadata; all six evidence/lifecycle/dossier
  aggregates zero.
- Root-cause source inspection — all six Issue #46 preconditions confirmed.
- Focused implementation, final regression, safety, diff, publication, and
  Actions evidence pending.
