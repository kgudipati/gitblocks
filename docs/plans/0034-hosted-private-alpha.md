# Recovery R2 hosted private-alpha architecture

## Status and authority

- Governing issue:
  [#34 — Recovery R2: Lock the product-first hosted private-alpha architecture](https://github.com/kgudipati/gitblocks/issues/34)
- Branch: `docs/34-hosted-private-alpha`
- Draft pull request:
  [#35 — docs: lock product-first hosted private-alpha architecture](https://github.com/kgudipati/gitblocks/pull/35)
- Owner: GitBlocks maintainers
- State: complete; draft PR published
- Last updated: 2026-08-11
- Authority order: Issue #34 and the maintainer's R2 direction govern this
  documentation correction; accepted ADRs continue to govern the boundaries
  they already own. This plan does not authorize implementation.

## Purpose and user-visible outcome

R2 will make the shortest approved hosted private-alpha product path explicit
and make durable development policy start with an exercisable user outcome.
Contributors will be able to distinguish serving-required, offline-required,
development-support, optional/dormant, and frozen R&D components without
interpreting historical phase effort as current product priority.

The current repository still has no local Skill/scanner, hosted application,
MCP surface, deployed PostgreSQL database, target-fit composition, or complete
user journey. R2 records the approved direction only. It does not make that
journey executable.

## Verified current repository state

- Before branching, `git status --short --branch` reported clean
  `main...origin/main`.
- `git rev-parse HEAD`, `git rev-parse main`, and
  `git rev-parse origin/main` all returned
  `a6e03ef20a8cef2a39db8e66b91612245378f9db`.
- Main contains the accepted Phase 9 pure production retrieval package. The
  contract binding in
  `packages/contracts/src/candidate-retrieval-schemas.ts` declares six active
  channels, while `packages/retrieval/README.md` incorrectly describes five
  and calls `approved-metadata-lexical/1.0.0` inactive.
- PR #33 is open and draft on preserved branch
  `feat/32-codebase-conditioned-ranking`; Issue #32 is open. Neither is merged
  into main.
- The accepted product contract and system context describe a planned
  agent-native local/remote boundary, but their current status and planned
  topology predate the R2 hosted-alpha recovery decision.

Evidence came from the baseline Git commands, `git log --oneline main`, the
public retrieval contract and engine, the governing documentation, accepted
ADRs 0001, 0004, 0005, 0008, and 0009, Issue #32, and PR #33. No repository
script, provider, database, Docker, migration, test, or build ran during
discovery.

## Scope and explicit non-goals

R2 may change only durable guidance, planning policy, the product contract,
system context, testing policy, Definition of Done, retrieval package
documentation, and this plan. It will:

- record the local Skill/scanner/minimized-fingerprint boundary;
- record one hosted Node application composed with one PostgreSQL database;
- place deterministic normalization and retrieval before bounded LLM target-fit
  reasoning and deterministic response validation;
- separate request-time serving from offline ingestion and refresh;
- record the current component lifecycle without moving or deleting code;
- record product-first, evidence-gated infrastructure and proportional
  planning/validation rules;
- correct the retrieval README's six-channel description; and
- formally supersede Issue #32 and close PR #33 without merge while preserving
  their branch and commits.

R2 will not change product TypeScript, contracts or schemas, persistence,
migrations, backend services, scanner, MCP, model integration, ingestion, CI,
dependencies, catalog data, evaluation data, provider configuration, or any
Phase 10 branch content. It will not delete or move a component, weaken full
verification, create an ADR, or begin R3.

## Requirements crosswalk

| R2 requirement                                          | Destination                                                   | Milestone | Evidence                                              |
| ------------------------------------------------------- | ------------------------------------------------------------- | --------- | ----------------------------------------------------- |
| Hosted-alpha product and LLM boundary                   | Product contract and system context                           | 2         | Changed-line and cross-document review                |
| PostgreSQL serving-required; ingestion offline-required | Product contract and system context                           | 2         | Architecture diagram and lifecycle table review       |
| Request-time exclusions and initial non-requirements    | Product contract and system context                           | 2         | Explicit boundary review                              |
| Product-first durable rules                             | `AGENTS.md`, `PLANS.md`, testing strategy, Definition of Done | 2         | Policy crosswalk and wording review                   |
| Current component lifecycle                             | System context                                                | 2         | Classification table review                           |
| Six active retrieval channels                           | Retrieval README                                              | 2         | Contract/engine-to-README comparison                  |
| Supersede frozen Phase 10                               | Issue #32, PR #33, R2 documentation                           | 1–2       | Closed-not-planned issue and closed-unmerged PR state |
| Publish one draft R2 PR and stop                        | GitHub                                                        | 1–3       | Draft PR URL and final status                         |

## Assumptions, risks, and unresolved decisions

Verified facts are limited to current main and existing GitHub state. The
hosted application, local product boundary, durable profile/metadata serving
path, and target-fit LLM composition are approved direction rather than
implemented behavior.

The primary risk is documentation claiming that planned nodes exist or
accidentally overriding accepted safety and persistence boundaries. R2 will
label planned behavior explicitly and preserve hard constraints, unknowns,
evidence/inference distinctions, provenance, local data minimization, and
non-execution of repository code. Another risk is letting proportional
validation language weaken final regression review; the policy will retain
full `pnpm verify` as the authoritative final gate where appropriate.

No implementation technology or R3 sequencing decision is open in R2. A new
ADR would be required only if this documentation contradicted an accepted ADR;
current review finds clarification sufficient.

## Applicable ADRs and contracts

- [ADR 0001](../architecture/decisions/0001-agent-native-delivery.md) remains
  accepted: the Skill/MCP delivery, local minimization, server-side
  intelligence, and coding-agent execution boundary are unchanged.
- [ADR 0004](../architecture/decisions/0004-postgresql-evidence-persistence.md)
  remains accepted: PostgreSQL is the concrete shared public-data adapter,
  with explicit migration and injected composition boundaries. R2 clarifies
  its serving necessity without changing its tables or operations.
- [ADR 0005](../architecture/decisions/0005-public-repository-ingestion.md)
  remains accepted: ingestion is bounded, operator-run, public-source, and
  outside request-time serving.
- [ADR 0008](../architecture/decisions/0008-artifact-first-retrieval-foundation.md)
  remains accepted: deterministic profiles, query normalization, explicit
  unknowns, and the deferred materialization proof boundary are preserved.
- [ADR 0009](../architecture/decisions/0009-production-retrieval.md) remains
  accepted: pure six-channel retrieval is composed inside the future hosted
  application; its purity does not make durable serving data optional.
- [Product contract](../product/product-contract.md) remains the product
  authority and will be clarified without changing a schema or public DTO.

R2 creates, supersedes, and changes no ADR or executable contract.

## Architecture, data-flow, and performance impact

R2 records this planned flow:

```text
local coding agent + Skill + bounded scanner
  -> minimized RepositoryFingerprintV1
  -> one hosted Node application
  -> deterministic normalization and retrieval over PostgreSQL-backed catalog data
  -> bounded finalist evidence and LLM target-fit reasoning
  -> deterministic contract, hard-constraint, and evidence validation
  -> up to three responsible options
  -> coding agent performs approved local integration and validation

offline public-source ingestion and refresh -> PostgreSQL
```

No running component, side effect, performance characteristic, public shape,
or dependency graph changes in R2. Input, time, memory, concurrency, retry,
backpressure, and cost budgets remain future implementation-plan obligations
only when a slice actually introduces the relevant behavior.

## Security, privacy, abuse, and supply-chain considerations

R2 preserves local target-data minimization, explicit transmission approval,
closed target facts, untrusted repository/provider/model data, no target or
candidate code execution, deterministic hard-constraint authority, explicit
unknowns, and attributable evidence. The bounded LLM may reason only after
deterministic retrieval over a small finalist set and cannot perform open-world
discovery or override hard constraints. Trusted code validates its
`FitAssessmentResponseV1`-shaped output.

No secret, private source, provider call, external data collection, model call,
dependency, runtime permission, or supply-chain surface is added.

## Implementation milestones

### Milestone 1 — Establish governance and supersession

- [x] Verify clean main and exact baseline refs.
- [x] Create Issue #34 and `docs/34-hosted-private-alpha`.
- [x] Add the initial issue-linked plan.
- [x] Publish the initial plan commit and draft PR.
- [x] Close PR #33 without merge and close Issue #32 as superseded/not planned,
      preserving the Phase 10 branch and commits.

### Milestone 2 — Correct the durable documentation

- [x] Update the approved architecture and LLM/request-time boundaries.
- [x] Update product-first planning, implementation, validation, and done rules.
- [x] Record component lifecycle and frozen R&D treatment without deletion.
- [x] Correct the six-channel retrieval README.
- [x] Review every changed line for current-versus-planned accuracy and
      cross-document consistency.

### Milestone 3 — Validate, publish, and stop

- [x] Run focused documentation/repository checks while editing.
- [x] Run the exact final validation commands and record results.
- [x] Push the final documentation and update the draft PR evidence.
- [x] Stop without implementation or R3 work.

## Testing and validation strategy

No executable behavior changes, so no unit, contract, integration, database,
provider, model, load, resilience, or end-to-end test is added or run. Focused
formatting and repository-policy checks will validate the documentation while
editing. From the repository root, final validation will run in this order:

```text
pnpm runtime:check
pnpm format:check
pnpm repo:check
git diff --check
pnpm verify
```

Expected result is exit 0 for every command with no worktree mutation.
`verify:ci`, database verification, providers/live collection, retrieval
benchmarks, and interview/pre-live operations are explicitly excluded.

## Observability and operations

Not applicable to this documentation-only correction: no shared runtime,
operation, error, trace, metric, log, audit event, health check, alert, SLO, or
runbook is introduced or changed. R2 records which future nodes will exist but
does not pre-design their operational machinery.

## Migration, compatibility, rollout, and recovery

There is no schema, data, public-contract, deployment, or mixed-version change.
The branch is recoverable by reverting its documentation commits before merge.
Phase 10 recovery consists only of retaining its branch and commit history;
selective reuse is allowed later only when real product dogfooding demonstrates
the need.

## Exact exit criteria

- Issue #34, this plan, and one draft R2 PR link one another.
- The authorized documents consistently record the approved hosted-alpha,
  LLM, persistence, ingestion, request-time, lifecycle, and product-first
  boundaries while distinguishing planned from implemented behavior.
- The retrieval README matches the six-channel public binding and engine.
- PR #33 is closed unmerged and Issue #32 is closed not planned; the preserved
  Phase 10 branch and commits are not modified or deleted.
- The diff touches no prohibited file and contains no implementation, ADR,
  component move/deletion, CI weakening, or R3 work.
- Focused and final validation evidence is exact and passing.
- The R2 PR remains draft and work stops after publication.

## Progress log

- 2026-08-11: Verified clean main and matching expected HEAD/main/origin-main
  at `a6e03ef20a8cef2a39db8e66b91612245378f9db`; read governing policies,
  applicable ADRs, current documentation, retrieval bindings, Issue #32, and
  PR #33; created Issue #34 and the issue-linked branch; began Milestone 1.
- 2026-08-11: Published initial plan commit `6e8fbf4`, opened draft PR #35,
  added supersession notes, closed PR #33 without merge, and closed Issue #32
  as not planned. Verified the preserved remote Phase 10 branch still resolved
  to `15270c602872fc9d39736a1350487ada574fb5ff`.
- 2026-08-11: Updated the seven authorized durable documents, reconciled the
  hosted/local/offline/LLM boundaries and component lifecycle, corrected the
  six-channel README, reviewed current-versus-planned claims, and completed
  Milestone 2.
- 2026-08-11: Published documentation commit `ce8404f`; ran every required
  final command successfully; completed product, architecture, security,
  compatibility, scope, prohibited-file, and changed-line self-review. Began
  final evidence publication.
- 2026-08-11: Prepared the final plan-evidence publication and completed all
  R2 milestones. The published evidence commit receives the exact required
  final-state rerun, recorded in draft PR #35; R2 stops afterward.

## Decision and deviation log

- 2026-08-11 — No new ADR: R2 clarifies the accepted agent-native,
  PostgreSQL, ingestion, deterministic profile/normalization, and retrieval
  decisions without superseding their executable contracts or adapter
  boundaries. Owner: GitBlocks maintainers.
- 2026-08-11 — A concise plan is required because the durable correction spans
  multiple governing documents and formal GitHub supersession. Owner:
  GitBlocks maintainers.
- 2026-08-11 — The initial hosted topology is one Node deployable plus one
  serving-required PostgreSQL database. Offline ingestion publishes the shared
  catalog state; request-time composition reads it around the pure retrieval
  engine. Speculative distributed infrastructure remains deferred. Owner:
  GitBlocks maintainers.
- 2026-08-11 — Phase 10 is frozen R&D, not discarded work. Its branch and
  commits remain intact, and selective reuse requires dogfooding evidence.
  Owner: GitBlocks maintainers.
- Deviations: none.

## Validation evidence

- 2026-08-11 — Focused plan `prettier --check` against
  `docs/plans/0034-hosted-private-alpha.md` — exit 1; the newly authored plan
  had formatting drift. No later command in that shell invocation ran.
- 2026-08-11 — Focused plan `prettier --write` against the same path — exit 0;
  formatted only the new plan to resolve that failure.
- 2026-08-11 — The first focused-check rerun also exited 1 after the newly
  added evidence text reintroduced Markdown formatting drift. A second
  single-file `prettier --write` invocation exited 0; no repository check had
  run yet.
- 2026-08-11 — Focused initial-plan rerun: single-file `prettier --check` exit
  0; `pnpm repo:check` exit 0 with `Repository checks passed`; whitespace
  diff check exit 0 with no output.
- 2026-08-11 — Focused seven-document `prettier --check` — exit 1;
  `docs/architecture/system-context.md` and
  `docs/engineering/testing-strategy.md` had formatting drift after editing.
- 2026-08-11 — Focused seven-document `prettier --write` — exit 0; formatted
  only those two changed documentation files. Immediate seven-document
  `prettier --check` and `git diff --check` both exited 0.
- 2026-08-11 — `pnpm repo:check` — exit 0 after the complete Milestone 2
  documentation diff; `Repository checks passed.` The paired whitespace diff
  check exited 0 with no output.
- 2026-08-11 — `pnpm runtime:check` — exit 0; Node runtime preflight completed
  with no diagnostic output.
- 2026-08-11 — `pnpm format:check` — exit 0; all matched files used Prettier
  code style.
- 2026-08-11 — `pnpm repo:check` — exit 0; runtime preflight and repository
  checks passed.
- 2026-08-11 — `git diff --check` — exit 0; no whitespace errors.
- 2026-08-11 — `pnpm verify` — exit 0; 130 test files and 1,949 tests passed;
  dependency-cruiser reported no violations across 886 modules and 3,016
  dependencies; repository, evaluation-authority, contract-conformance,
  catalog/profile, interview-schema/pre-live validation, and secret checks
  completed successfully.
- 2026-08-11 — Final self-review before evidence publication — the complete
  branch diff changes only the seven authorized durable documents and this
  plan. It adds no executable behavior, schema, migration, dependency, CI,
  catalog/evaluation data, provider configuration, ADR, component movement or
  deletion, Phase 10 branch content, secret, or R3 work. Planned nodes are
  labeled as planned; current six-channel retrieval and missing hosted/local
  composition are stated accurately. Security/privacy invariants and full
  final verification remain intact.

The evidence-bookkeeping commit will receive one exact final-state rerun of the
required command sequence; that result will also be recorded in draft PR #35.
