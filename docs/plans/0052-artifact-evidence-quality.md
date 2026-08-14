# Recovery R11 artifact evidence quality

## Status and authority

- Issue: [#52 — Recovery R11: Prevent artifact evidence slot scavenging](https://github.com/kgudipati/gitblocks/issues/52)
- Branch: `feat/52-artifact-evidence-quality`
- Owner: GitBlocks maintainers
- State: implementation and local validation complete; publication pending
- Last updated: 2026-08-14

Issue #52 is the slice authority. Existing product contracts, accepted ADRs,
and repository engineering policy govern durable boundaries. This plan records
the proportional implementation and evidence for R11 without expanding the
issue. R8, R9, and R10 are accepted history; Phase 10 remains superseded and
must not be revived.

## Purpose and user-visible outcome

The first real immutable-artifact dogfood proved the hosted R9 path reaches the
correct five finalists with exact commit-coherent excerpts, but it also exposed
a request-time selection defect. A later hard evaluation skips a strong source
line already supplied for an earlier evaluation without consuming its
two-match quota, so it continues into weaker material solely to obtain a new
evidence ID. Pure Markdown navigation and reference-definition plumbing can
also consume evidence slots.

R11 makes the existing hosted `recommend_oss` journey present the strongest
deterministic request-scoped artifact matches once per evidence identity while
allowing those matches to count for every applicable unresolved evaluation.
It also excludes the two demonstrated classes of obviously non-propositional
Markdown plumbing before term matching. The nearest exercisable outcome is the
controlled hosted application boundary with synthetic immutable artifact
material; no live recommendation or provider call is part of this slice.

## Verified current repository state

- Before branching, `main`, `HEAD`, and local `origin/main` were all
  `5cf9bcc191fe666690d85821e76be54b9e0fa4f5`; the worktree was clean.
- R8, R9, and R10 are merged. Issue #52 is the single governing R11 issue.
- `artifact-evidence-selector.ts` currently checks
  `suppliedEvidenceIds.has(evidence.evidenceId)` and continues before
  incrementing `selectedForEvaluation`, reproducing the reported slot
  scavenging mechanism.
- The selector caps remain two excerpts per evaluation, eight per candidate,
  32 globally, and 100 total observations per dossier. Match ordering is term,
  artifact-set ordinal, chunk ordinal, line, match offset, term, and stable
  source identity.
- `validateRecommendationAssessmentExchangeV1(...)` and
  `hardResolutionIssues(...)` require exact per-evaluation coverage and
  same-candidate grounded evidence for satisfied/conflict resolutions, but do
  not require distinct evidence or inference IDs across resolutions.
- The existing frozen hosted application regression proves zero eligible, 29
  evidence-needed before truncation, ten returned evidence-needed candidates,
  and the first five `jobs-actionhero-node-resque`, `jobs-asynq`, `jobs-bree`,
  `jobs-bullmq`, and `jobs-node-cron`.
- Runtime preflight passes with Node 24.18.0. An initial invocation used an
  extra argument separator and exited 2 with usage text; the corrected exact
  command passed and no repository state changed.
- No dogfood database, dogfood environment file, credential, provider,
  ingestion, artifact collector, OpenAI adapter, MCP process, scanner, Skill,
  or interview operation was accessed while establishing this plan.

Evidence: `git branch --show-current`, `git rev-parse HEAD`,
`git rev-parse origin/main`, `git status --short`, source and test inspection,
and `pnpm runtime:check --show-success`.

## Scope and explicit non-goals

In scope:

- move the per-evaluation selected-match increment before duplicate-evidence
  suppression while retaining one physical observation per evidence ID;
- add one small deterministic parser-free line-eligibility helper that rejects
  Markdown reference definitions and pure Markdown link/navigation/image/badge
  lines after an optional list marker;
- add focused synthetic selector regressions for mirrored and cross-evaluation
  evidence reuse, the two Markdown exclusions, linked prose, non-overfiltering,
  and the demonstrated dogfood shape;
- add an explicit existing-R8 validation proof for shared artifact evidence and
  inference grounding across separately required resolutions;
- retain the frozen hosted retrieval/finalist regression; and
- update only this issue-linked plan and current hosted wording if review finds
  its bounded-selection description materially inaccurate.

Explicit non-goals: persistent or ephemeral database access, migrations,
ingestion, artifact collection, live providers, GitHub catalog reads, npm,
advisories, OpenAI, MCP calls or server work, scanner, Skill, interviews,
real-project dogfood, retrieval/taxonomy/profile/fingerprint changes, term or
expansion authority, success-condition mining, fuzzy search, embeddings,
semantic ranking, a Markdown parser or AST, evidence identity/provenance or
construction changes, evidence persistence, contract implementation changes,
R8 validation changes, services, workers, queues, caches, dependencies, and
Phase 10.

## Requirements crosswalk

| Issue requirement                                    | Destination                      | Validation evidence                                                              |
| ---------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| Reused matches consume quota without duplication     | hosted artifact selector         | mirrored and cross-evaluation selector tests                                     |
| Reference definitions are ineligible                 | hosted artifact selector         | URL, angle-destination, and optional-title synthetic cases                       |
| Pure links/navigation/badges are ineligible          | hosted artifact selector         | TOC, direct-link, and badge-only synthetic cases                                 |
| Linked substantive prose remains eligible            | hosted artifact selector         | bullet-link and Redis prose tests                                                |
| Do not overfilter headings/tables/config/prose       | hosted selector tests            | single-line eligibility-through-selection cases                                  |
| Shared R8 grounding remains valid                    | contracts test only              | unchanged validator accepts two resolutions sharing one inference/evidence       |
| Retrieval/finalists remain unchanged                 | existing hosted application test | exact 0/29/10 and frozen first-five assertions                                   |
| Preserve contracts, identity, provenance, and bounds | source/diff review               | no contract source/retrieval diff; existing selector bounds and provenance tests |

## Assumptions, risks, and unresolved decisions

Verified facts are listed above. The implementation assumes a bounded
regular-expression recognizers can identify only the demonstrated Markdown plumbing
without a dependency or general Markdown interpretation. If synthetic cases
show that the helper must parse arbitrary Markdown grammar or rank semantic
quality, stop and update Issue #52 rather than broadening R11.

Primary risks are over-filtering content-bearing evidence, altering stable
match order, duplicating evidence, coupling identity to evaluation IDs, or
weakening exact R8 coverage. Mitigations are eligibility-before-term-matching,
minimal syntax recognizers, unchanged sort/evidence construction, quota
increment before the existing duplicate append guard, explicit negative and
preservation tests, and no change to contract implementation.

No material design decision remains open. Optional ordered-list marker support
is permitted only when it uses the same bounded pure-link rule and does not
affect content-bearing prose.

## Applicable ADRs and contracts

- [ADR 0002](../architecture/decisions/0002-typescript-workspace-and-toolchain.md):
  use Node 24.18.0, pnpm 11.17.0, strict ESM/TypeScript, Vitest, architecture,
  repository-policy, secret, and final verification gates. No dependency or
  lockfile change is authorized.
- [ADR 0003](../architecture/decisions/0003-product-contract-kernel.md): retain
  the closed evidence, dossier, fit-request, response, inference, and outcome
  contracts and canonical validation.
- [ADR 0006](../architecture/decisions/0006-immutable-repository-artifacts.md):
  retain exact immutable source/set/chunk identity, inert source text, line
  authority, request-scoped non-persisted excerpts, and no code execution.
- [ADR 0012](../architecture/decisions/0012-openai-target-fit-provider.md): the
  fit boundary remains unchanged and is not invoked in R11.
- `CandidateDossierV1`, `FitAssessmentRequestV1`,
  `RecommendationAssessmentResponseV1`, `TargetFitAssessmentResponseV1`, and
  `EvidenceNeededHardConstraintResolutionV1` are unchanged.
- Retrieval, normalization, repository fingerprint, and accepted expansion
  authorities remain unchanged.

## Architecture, data flow, and performance impact

The changed pure selector remains inside the hosted application:

```text
validated unresolved evaluation + exact immutable artifact lines
  -> existing approved-term derivation
  -> new narrow line syntax eligibility check
  -> existing deterministic matching and ordering
  -> count each matching line against the evaluation quota
  -> append only evidence IDs not already present
  -> unchanged request-scoped CandidateDossierV1
```

There is no new component, port, side effect, DTO, persistence operation,
network call, dependency, retry, concurrency, or cache. Each line is already
bounded to 1,800 UTF-16 code units before evidence construction, and both
anchored syntax predicates operate only inside that existing bound. The
existing two/eight/32/100 result bounds and artifact input bounds remain
unchanged.

## Security, privacy, abuse, and supply-chain considerations

Immutable public artifact text remains hostile inert data. The new helper may
classify only line syntax; source text cannot change approved terms, controls,
ordering, credentials, or instructions and is never executed. Tests use short
synthetic lines rather than copied public README bodies. The selector still
returns exact attributable evidence and no absence inference.

R11 adds no external effect, credential use, model/provider transfer,
persistence, private data, dependency, CI action, or supply-chain surface. No
source excerpt, path, URL, SHA, prompt, or credential is added to telemetry.

## Implementation milestones

### Milestone 1: red focused regressions

- Add synthetic selector tests for mirrored and cross-evaluation reuse,
  reference definitions, pure navigation/badges, linked prose,
  non-overfiltering, and the dogfood shape.
- Add the explicit shared-grounding R8 validation test without changing its
  implementation.
- Run the focused selector suite before the production edit and retain the
  expected failing evidence for the reproduced selector defects.

### Milestone 2: narrow selector correction

- Count every deterministic matching line before duplicate-ID suppression.
- Add the bounded reference-definition and pure-link eligibility helpers before
  term matching.
- Preserve approved terms, ordering, evidence construction, identities,
  provenance, bounds, and contract implementations.
- Run selector, hosted application, contracts, and hosted typecheck checks.

### Milestone 3: final review and publication

- Run contracts validation and architecture checks, inspect the complete diff,
  then run one normal final `pnpm verify`.
- Record exact evidence in this plan, commit normally, push once, open one draft
  PR, and inspect the natural Actions run once without rerunning it.

## Testing and validation strategy

All commands run from the repository root on Node 24.18.0 and use only
repository-contained synthetic/fake infrastructure. They make no network,
provider, model, credential, dogfood database, ingestion, or artifact-collection
call.

Focused development commands:

```text
pnpm runtime:check --show-success
pnpm exec vitest run apps/gitblocks-hosted/test/artifact-evidence-selector.test.ts
pnpm exec vitest run apps/gitblocks-hosted/test/application.test.ts
pnpm exec vitest run packages/contracts/test/oss-recommendation-contracts.test.ts
pnpm --filter @gitblocks/gitblocks-hosted typecheck
```

Contract and architecture gates:

```text
pnpm contracts:validate
pnpm architecture:check
```

Final authoritative regression, run once after focused checks are green:

```text
pnpm verify
```

Publication review also runs `git diff --check`, complete status/diff review,
prohibited-effect and changed-file review, and a secret scan through final
verification. Controlled MCP tests are not separately run because no transport
or application orchestration boundary changes; the hosted application
regression exercises the affected journey immediately around the selector.
Database verification is not applicable because R11 changes no persistence or
migration source and database access is explicitly prohibited.

## Observability and operations

The existing hosted recommendation events and stable failures remain
unchanged. R11 adds no operation, service, provider call, retry, deployment,
telemetry field, health surface, SLO, dashboard, alert, or runbook obligation.
Artifact text and provenance remain excluded from telemetry. Focused observable
tests and existing bounded counts are sufficient for this pure selection
correction.

## Migration, compatibility, rollout, and recovery

R11 changes only deterministic request-time selection semantics. It adds no
schema, stored data, public DTO, source variant, or wire-shape change; no
migration or backfill is needed. Existing consumers already permit one evidence
and inference to ground multiple separately required R8 resolutions.

Rollout is the ordinary code deployment after review and merge. Recovery is a
normal code rollback; no durable data requires reversal. The post-merge
read-only dogfood capture is separately authorized and determines the actual
production excerpt counts. R11 does not hardcode the maintainer's approximate
12-record expectation.

## Exact exit criteria

- Reused exact matches consume each applicable evaluation's quota and remain
  one physical evidence observation per ID.
- Reference definitions and pure link/navigation/badge-only lines are excluded,
  while linked substantive prose, headings, tables, configuration, and ordinary
  prose remain eligible.
- The per-evaluation maximum remains two; candidate/global/dossier limits remain
  eight/32/100; evidence identity and provenance remain unchanged.
- The unchanged R8 validator accepts shared evidence/inference grounding while
  separately requiring exact resolution coverage.
- The frozen retrieval counts and first-five finalists remain unchanged.
- Focused checks, contracts validation, architecture, and one final
  `pnpm verify` pass; complete diff and security review finds no scope drift.
- No dogfood database/credential/provider/model/ingestion/artifact/MCP/Skill/
  scanner/interview/Phase-10 effect occurs.
- One normal commit is pushed and one draft PR is open, unmerged, with honest
  Actions state and a clean worktree.

## Progress log

- [x] 2026-08-14: Verified exact clean main baseline, inspected current selector
      control flow, existing R8 sharing authority, frozen finalist regression,
      relevant ADRs/contracts/standards, and created Issue #52 plus the topic
      branch.
- [x] 2026-08-14: Milestone 1 — added the focused selector regressions and
      captured five intended failures before changing production source; the
      new R8 shared-grounding proof already passed the unchanged validator.
- [x] 2026-08-14: Milestone 2 — corrected quota accounting, added the narrow
      Markdown eligibility predicates, updated hosted current-state wording,
      and passed selector/application/contracts/typecheck, contract conformance,
      and architecture checks.
- [ ] 2026-08-14: Milestone 3 — final regression and complete diff/security
      review are complete; commit, push, draft PR, and Actions inspection remain.

## Decision and deviation log

- 2026-08-14: Keep evidence identity source-owned and quota evaluation-owned.
  A reused match consumes quota but does not append or re-key evidence.
- 2026-08-14: Use two anchored regular-expression recognizers over the existing
  1,800-code-unit line bound rather than a Markdown dependency, AST, semantic
  ranker, or general quality policy. Ambiguous or unsupported Markdown remains
  eligible rather than being over-filtered.
- 2026-08-14: Do not run database or controlled MCP integration because neither
  persistence nor transport changes; existing synthetic selector/application
  coverage is the strongest proportional boundary for R11.

## Validation evidence

- 2026-08-14: baseline — `main`, HEAD, and `origin/main` exact at
  `5cf9bcc191fe666690d85821e76be54b9e0fa4f5`; worktree clean before branching.
- 2026-08-14: runtime — `pnpm runtime:check -- --show-success` exited 2 because
  the extra separator was passed through to the dependency-free CLI; corrected
  `pnpm runtime:check --show-success` exited 0 and reported Node 24.18.0.
- 2026-08-14: GitHub authority — Issue #52 created open with this branch/path as
  its exact linked execution plan.
- 2026-08-14: red selector regression — the focused selector run failed five
  intended cases with 14 existing/new cases passing: mirrored slot scavenging,
  cross-evaluation scavenging, reference definitions, pure links/navigation,
  and the combined dogfood shape. No production source had changed for that
  run.
- 2026-08-14: existing R8 sharing authority — the new explicit artifact
  evidence/inference sharing proof passed with the unchanged validator; the
  contracts file reported 26/26 tests.
- 2026-08-14: corrected focused selector — 19/19 tests passed, including mirror
  reuse, cross-evaluation reuse, three reference-definition shapes, pure TOC,
  link and badge lines, linked prose, headings, tables, configuration, inline
  HTML, substantive bullets, caps, provenance, and the controlled dogfood
  shape.
- 2026-08-14: hosted application and contracts — application 15/15 and
  recommendation contract 26/26 tests passed; the application regression
  retained 0 eligible, 29 evidence-needed before truncation, 10 returned, and
  the exact frozen first five. Hosted TypeScript typecheck passed.
- 2026-08-14: contract conformance — `pnpm contracts:validate` exited 0 for all
  10 cases and 40 supplied candidates, representability-only.
- 2026-08-14: architecture — `pnpm architecture:check` exited 0 with 948
  modules, 3,233 dependencies, and no violations.
- 2026-08-14: changed-line review — focused ESLint, Prettier, and
  `git diff --check` passed. The complete diff contains only the hosted selector,
  selector tests, one contracts test, hosted current-state README wording, and
  this plan. Contract implementation, retrieval, persistence, migration,
  dependency, lockfile, provider, MCP, scanner, Skill, interview, and evaluation
  authority files are unchanged.
- 2026-08-14: final authoritative regression — the single `pnpm verify` run
  exited 0. Formatting, builds, lint, all workspace typechecks, 141 test files
  / 2,119 tests, architecture (948 modules / 3,233 dependencies), repository and
  evaluation authorities, product contract conformance, schema authorities,
  and Secretlint all passed. The ordinary deterministic graph made no database
  or live provider/model call.
