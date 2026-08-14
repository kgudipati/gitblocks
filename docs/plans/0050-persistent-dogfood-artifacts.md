# Recovery R10 persistent dogfood artifact authorization

## Status and authority

- Issue: [#50 — Recovery R10: Authorize persistent private-alpha artifact collection](https://github.com/kgudipati/gitblocks/issues/50)
- Branch: `feat/50-persistent-dogfood-artifacts`
- Owner: GitBlocks maintainers
- State: implementation and local validation complete; publication pending
- Last updated: 2026-08-13

Issue #50 is the slice authority. Existing product contracts, accepted ADRs,
and repository engineering policy retain authority over durable boundaries.
This plan records the narrow R10 correction and its evidence without reviving
Phase 10 or changing the Phase 6, Phase 7, R8, or R9 plans.

## Purpose and user-visible outcome

The first real private-alpha baseline ingestion exposed an operator-safety
blocker: the live artifact CLI accepts only the truthful historical
`ephemeral-non-production` database scope, while the accepted local dogfood
database is intentionally persistent. Using the existing scope would make a
false operational assertion.

R10 makes the existing artifact operator exercisable for exactly two explicit
non-production database scopes. The historical ephemeral scope remains
unchanged. The new `persistent-private-alpha-dogfood` scope is admitted only
with its exact additional acknowledgement and exact local dogfood database
configuration, followed by the unchanged exact migration-0007 verification.
After those checks, the command reaches the existing artifact transport,
collector, collection, persistence, and receipt composition.

The nearest safe exercise is an offline process-level command-boundary test
with injected fake filesystem, database, transport, collector, collection, and
receipt effects. R10 implementation does not perform the later live artifact
collection or touch the persistent dogfood database.

## Verified current repository state

- Before branching, `main`, `HEAD`, and local `origin/main` were exactly
  `bd80f32b94b293e1a4145dc3de395c73c15a342b`; the worktree was clean.
- PR #49 is merged at that SHA and Issue #48 is closed. R9 requires exact
  migration 0007 for new live artifact collection.
- `packages/ingestion/scripts/artifacts-live-cli.ts` requires the exact global
  acknowledgement and then rejects every database scope other than
  `ephemeral-non-production`.
- The same CLI parses discrete host, port, database, username, password, and
  SSL settings; it accepts valid ports 1–65535 and SSL `false` or `require`.
- The CLI currently creates the persistence client before migration
  verification, then constructs `createTransport(...)` and
  `createRepositoryArtifactCollector(...)` only inside
  `withVerifiedArtifactLiveDatabaseMigrationV1(...)`.
- `assertArtifactLiveDatabaseMigrationVersionV1` accepts only the numeric value
  `7`; migration 6, migration 8, missing history, and malformed values fail
  closed before its authorized callback.
- `packages/ingestion/README.md` and ADR 0006 currently describe the live
  artifact database authority as ephemeral-only and therefore require a narrow
  current-state amendment.
- `ArtifactReceipt`, artifact collection, provider transport, collector,
  chunking, retrieval, and persistence require no change for this correction.
- The persistent database facts supplied by the R10 authority are accepted as
  the no-touch baseline; this implementation performs no database query to
  re-establish them and does not read the dogfood credential file.

Evidence: baseline Git commands, Issue #48 and PR #49 metadata, direct source
inspection of the CLI/authority/tests/README, and the accepted ADRs and
engineering standards listed below.

## Scope and explicit non-goals

In scope:

- one pure deterministic live artifact database-scope policy helper;
- exactly the existing `ephemeral-non-production` scope plus the new
  `persistent-private-alpha-dogfood` scope;
- the exact persistent acknowledgement
  `approved-private-alpha-persistent-dogfood-artifact-collection`;
- complete discrete database configuration validation and exact persistent
  binding to `127.0.0.1`, `gitblocks_dogfood_test`,
  `gitblocks_persistence_dogfood`, and SSL `false`, while retaining the existing
  port bound;
- command composition that establishes all operator authority and exact
  migration 0007 before transport/collector construction and later effects;
- focused unit, operator, ordering, and offline process-boundary tests;
- current ingestion operator documentation and the one incompatible current
  ADR 0006 statement; and
- this plan, one issue-linked branch, one commit/push, and one draft PR.

Explicit non-goals: live artifact or ingestion execution; persistent database
access or mutation; credential-file or PAT access; GitHub/npm/advisory/OpenAI
provider calls; migration or role changes; migration 0008; provider endpoint,
limit, timeout, redirect, retry, byte, concurrency, or receipt changes;
artifact manifest, retrieval, chunking, contracts, persistence, or R9 selector
changes; hosted recommendation, R8 validation, scanner, Skill, MCP, interview,
profile, dossier, fit, or real-project dogfood changes; new packages, services,
frameworks, generic environment scopes, production authorization, deployment,
or Phase 10.

## Requirements crosswalk

| Issue requirement                                     | Destination                              | Validation evidence                                       |
| ----------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------- |
| Preserve historical ephemeral scope                   | scope-policy helper and command          | unit and command tests without persistent acknowledgement |
| Add exact persistent scope/acknowledgement            | scope-policy helper                      | accept/reject table tests                                 |
| Bind exact local dogfood configuration                | scope-policy helper                      | host/database/username/SSL/incomplete negative matrix     |
| Preserve valid dynamic port                           | shared configuration validation          | lower/upper/invalid port tests; no source port constant   |
| Require exact migration 0007 for both scopes          | unchanged migration helper in command    | migration 6/8 rejection and 7 admission tests             |
| Authorize before provider/persistence/receipt effects | injected command boundary                | zero-effect rejection assertions and ordered event trace  |
| Reach existing collector composition offline          | command boundary plus subprocess fixture | process-level fake-effects test                           |
| Preserve product/provider/receipt behavior            | no changes to owned modules              | changed-file review and existing artifact regressions     |
| Document both scopes accurately                       | ingestion README and ADR 0006            | Markdown/current-state review                             |

## Assumptions, risks, and unresolved decisions

Verified facts are listed above. The design assumes the existing
`ArtifactReceipt` already records all source-material and migration identity
required by collection; database-scope authorization is operator policy and
does not belong in the receipt. If implementation disproves this, stop and
update Issue #50 rather than silently changing the receipt.

Primary risks are weakening the existing ephemeral meaning, admitting a
lookalike persistent database/role, reading a credential or constructing a
provider before full authority, leaking a password or rejected configuration,
accepting a future migration, or adding a test-only production escape hatch.
Mitigations are closed exact constants, value-free errors, one pure helper,
complete negative matrices, injected owned effects, source/order assertions,
and a subprocess that imports the same command boundary without modifying the
production environment contract.

There are no unresolved architecture decisions. The new scope is deliberately
not generalized into production, staging, shared-development, remote-database,
or arbitrary persistent support.

## Applicable ADRs and contracts

- [ADR 0002](../architecture/decisions/0002-typescript-workspace-and-toolchain.md):
  use the pinned Node/pnpm/strict ESM TypeScript/Vitest toolchain and normal
  final verification graph.
- [ADR 0004](../architecture/decisions/0004-postgresql-evidence-persistence.md):
  retain injected configuration, non-owner runtime access, explicit migration
  verification, value-free errors, and no implicit migration. No persistence
  code, role, or schema changes.
- [ADR 0005](../architecture/decisions/0005-public-repository-ingestion.md):
  retain explicit opt-in provider/database configuration, secret exclusion,
  offline ordinary tests, and the unchanged provider boundary.
- [ADR 0006](../architecture/decisions/0006-immutable-repository-artifacts.md):
  retain the artifact operator, collector, receipt, immutable material,
  provider, limits, and migration-7 semantics. Amend only its incompatible
  ephemeral-only current operator statement.
- `ArtifactReceipt`, `RepositoryArtifactV1`, `RepositoryArtifactSetV1`,
  artifact manifest, retrieval, dossier, fit, and recommendation contracts are
  unchanged.

## Architecture, data flow, and performance impact

```text
global acknowledgement
  -> exact database scope
  -> persistent acknowledgement when and only when persistent scope
  -> complete discrete database configuration
  -> exact persistent loopback/database/writer/SSL binding when applicable
  -> persistence client and exact migration-0007 verification
  -> existing transport
  -> existing artifact collector
  -> existing collection/publication/receipt path
```

The scripts boundary owns environment and filesystem I/O. A small pure policy
module owns the closed scope/configuration decision. An injected command
function owns sequencing and cleanup; the executable script supplies existing
real dependencies. Product packages and persistence do not gain environment
awareness.

No network, provider, persistence, artifact, timing, memory, byte, retry,
concurrency, pagination, cancellation, or cost bound changes. The policy adds
constant-time comparisons over six bounded configuration fields.

## Security, privacy, abuse, and supply-chain considerations

Assets are the operator's approval, the persistent public dogfood database,
its least-privilege writer identity, the GitHub token, database password, and
artifact persistence/receipt effects. The local operator supplies untrusted
environment strings and command arguments. The new authorization decision is
default-deny and exact-value based.

Missing, malformed, lookalike, remote, owner/serving/arbitrary-role, SSL, and
future-migration configurations fail before provider construction or later
effects. Errors and tests never render environment values, passwords, tokens,
paths containing credentials, connection URLs, or provider material. The
helper has no environment, filesystem, database, network, provider, clock, or
logging capability. The command test uses inert sentinel values and injected
fakes. No dependency, lockfile, CI action, credential, role, or supply-chain
surface changes.

The persistent dogfood database remains shared public catalog data under the
existing retention model. R10 authorizes no private repository data, target
source, deletion, tenant, or production operation. Ingested repository content
remains inert and never executes.

## Implementation milestones

### Milestone 1: red policy and ordering tests

- Add pure-helper tests for the unchanged ephemeral path, exact persistent
  acceptance, every required rejection, complete configuration, and value-free
  deterministic behavior.
- Add command-boundary tests proving every rejection occurs before transport,
  collector, provider, publication, and receipt effects and migration 6/8 fail
  before those effects.
- Record the intended missing-policy failures before implementation.

### Milestone 2: policy and command composition

- Add the smallest scope-policy module with exactly two accepted scope values.
- Refactor the live script into a thin executable over an injected command
  boundary without changing the artifact collection modules.
- Preserve the exact migration-7 helper and current real dependency settings.
- Pass focused unit, operator, typecheck, and ordering tests.

### Milestone 3: offline process boundary and documentation

- Add a subprocess fixture that supplies exact persistent authority and fake
  effects, proving the same command boundary reaches the existing transport,
  collector, and collection composition with no network or real database.
- Update the ingestion README and the incompatible ADR 0006 operator statement.
- Review the complete diff for receipt/provider/persistence/product drift.

### Milestone 4: final validation and publication

- Run `pnpm ingestion:verify` and `pnpm architecture:check` after focused
  checks are green.
- Run the normal final `pnpm verify` once.
- Record exact evidence, perform status/diff/secret/prohibited-effect review,
  commit, push, open one draft PR, inspect natural Actions once, and stop.

## Testing and validation strategy

All commands run from the repository root on the pinned local Node runtime.
Tests use deterministic injected fakes and a fresh subprocess only. They do not
use a database, network, provider, credential, clock, or real artifact body.

Focused development checks:

```text
pnpm runtime:check
pnpm exec vitest run packages/ingestion/test/artifact-live-scope-policy.test.ts packages/ingestion/test/artifact-live-command.test.ts packages/ingestion/test/artifact-operator.test.ts --config vitest.config.ts
pnpm --filter @gitblocks/ingestion typecheck
```

Affected-package and architecture gates:

```text
pnpm ingestion:verify
pnpm architecture:check
```

Final regression, run once only after the focused and affected gates are
green:

```text
pnpm verify
```

Publication review also runs `git diff --check`, `git status --short`, complete
changed-file/diff review, prohibited-path/scope review, and the repository's
local secret scan through final verification. `pnpm db:verify`, live commands,
and persistent database checks are not applicable because R10 changes no
persistence behavior or schema and explicitly prohibits any dogfood/database
operation. Natural GitHub Actions is inspected once after the draft PR; a
zero-runner billing failure is recorded without rerun or CI weakening.

## Observability and operations

R10 changes an operator startup authorization boundary, not a shared or
production execution path. It adds no telemetry exporter, event schema,
provider call, service, worker, deployment, health endpoint, SLO, dashboard,
alert, or runbook. Existing content-free artifact events and receipts remain
unchanged. Authorization failures remain fixed and value-free and occur before
the existing observable artifact operation begins.

## Migration, compatibility, rollout, and recovery

There is no database, persisted-schema, receipt, public product contract, or
provider compatibility change. The existing ephemeral scope remains accepted
with the exact same global acknowledgement and database configuration rules;
it does not require the new acknowledgement. The new persistent scope is
strictly additive and has no default or fallback. Both scopes require exact
migration 0007 for a new live collection.

Rollout is the R10 code/documentation publication only. A later live dogfood
artifact collection requires separate maintainer authorization. Code rollback
removes the additive persistent scope and restores the previous safe refusal;
no data rollback exists because R10 creates and mutates no data.

## Exact exit criteria

- Issue #50's two-scope, acknowledgement, exact binding, migration, ordering,
  offline process-boundary, documentation, and non-goal criteria pass.
- Every listed persistent configuration rejection has a focused regression
  that proves zero transport, collector, provider, publication, and receipt
  effects.
- The unchanged ephemeral path passes without the persistent acknowledgement.
- Exact migration 7 remains the sole live collection migration authority.
- ArtifactReceipt, provider behavior, collector, artifact pipeline,
  persistence, retrieval, hosted/R8/R9, scanner, Skill, MCP, and interviews are
  unchanged.
- Focused tests, ingestion typecheck, `pnpm ingestion:verify`,
  `pnpm architecture:check`, and one final `pnpm verify` pass.
- The credential file and persistent database were not accessed; no live
  command or provider request occurred.
- One normal commit is pushed and one draft PR is open, unmerged, with honest
  Actions state and a clean worktree.

## Progress log

- [x] 2026-08-13: Verified exact repository baseline, current R9 authority,
      concrete ephemeral-only blocker, exact migration-7 guard, tests, README,
      applicable ADRs, engineering standards, and prior issue/PR evidence.
- [x] 2026-08-13: Created Issue #50, linked this plan, and created branch
      `feat/50-persistent-dogfood-artifacts`.
- [x] 2026-08-13: Milestone 1 — added the policy and command ordering
      regressions and recorded their intended missing-module failures before
      implementation.
- [x] 2026-08-13: Milestone 2 — added the closed scope policy, extracted the
      injectable live command, retained the thin executable and exact
      migration-7 authority, and passed focused tests plus ingestion typecheck.
- [x] 2026-08-13: Milestone 3 — passed the separate-process fake-effects
      exercise and updated the ingestion README, root README, and the one
      incompatible ADR 0006 current-state statement.
- [ ] Milestone 4: local final validation and review are complete; commit,
      draft publication, and Actions inspection remain.

## Decision and deviation log

- 2026-08-13: Keep database scope as operator policy outside ArtifactReceipt.
  The receipt already records actual migration and collected material; scope
  authorization is not source-material identity.
- 2026-08-13: Use one closed R10-specific persistent scope rather than a
  generalized environment model. No production or remote scope is implied.
- 2026-08-13: Exercise the executable command boundary in a subprocess with
  injected fakes, avoiding a test-only environment escape hatch and avoiding
  any real database or provider.
- 2026-08-13: Amend ADR 0006 narrowly because its accepted operator statement
  was ephemeral-only. No new ADR, historical plan, or artifact contract change
  is needed.

## Validation evidence

- 2026-08-13: baseline — branch `main`, `HEAD`, and `origin/main` exact at
  `bd80f32b94b293e1a4145dc3de395c73c15a342b`; clean worktree before branching.
- 2026-08-13: workflow authority — Issue #50 open with this exact linked plan;
  branch `feat/50-persistent-dogfood-artifacts` created from the baseline.
- 2026-08-13: source inspection — live CLI and README accept only
  `ephemeral-non-production`; migration helper accepts only exact numeric 7;
  transport and collector construction are inside the verified-migration
  callback.
- 2026-08-13: red policy regression — focused Vitest failed because
  `artifact-live-scope-policy.ts` did not exist; the implemented suite now
  passes all exact scope, acknowledgement, binding, completeness, port, and
  no-effect cases.
- 2026-08-13: red command regression — focused Vitest failed because
  `artifact-live-command.ts` did not exist; the implemented command suite now
  proves authorization/effect ordering and the offline subprocess boundary.
- 2026-08-13: focused artifact operator — exact three-file command passes 60
  tests, including every persistent rejection before transport, collector,
  simulated provider request, simulated persistence publication, and receipt
  write; migration 6/8 reject before those effects; migration 7 reaches the
  existing composition.
- 2026-08-13: ingestion typecheck —
  `pnpm --filter @gitblocks/ingestion typecheck` initially found one strict
  record-narrowing error; explicit validated string extraction resolved it and
  the rerun passed.
- 2026-08-13: package-local lint probe —
  `pnpm --filter @gitblocks/ingestion lint` was unavailable because the package
  defines no lint script. The repository-owned lint gate remains in the final
  `pnpm verify`; focused typecheck and tests pass.
- 2026-08-13: targeted Prettier check identified six new/changed files; the
  exact pinned formatter corrected them. Final formatting verification remains
  in `pnpm verify`.
- 2026-08-13: affected ingestion gate — `pnpm ingestion:verify` passed catalog
  validation, all 36 ingestion test files / 395 tests, and ingestion typecheck.
- 2026-08-13: architecture — `pnpm architecture:check` passed across 948
  modules and 3,233 dependencies with no violations.
- 2026-08-13: first final-regression attempt — `pnpm verify` passed runtime,
  formatting, and product builds, then stopped at two lint-only test findings:
  one dynamic property deletion and one shorthand arrow returning `void` in
  `artifact-live-scope-policy.test.ts`. The test setup now uses filtered object
  construction and a block-bodied assertion callback; targeted ESLint and the
  27-case policy suite pass.
- 2026-08-13: corrected final regression — `pnpm verify` completed successfully
  with formatting, lint, product/tool builds, all workspace typechecks, the
  ordinary offline test suite, architecture, repository/evaluation/contract
  authorities, schema/authority validation, and secret scanning.
- 2026-08-13: final changed-line review — targeted Prettier and ESLint pass;
  the three focused artifact files pass 60 tests after synthetic-port cleanup;
  `git diff --check` passes. The diff contains no real dynamic port, credential
  file path, migration, receipt, provider-policy, product-package, retrieval,
  hosted, scanner, Skill, MCP, interview, or Phase 10 change.
- 2026-08-13: prohibited-effect review — no persistent database access, stored
  credential read, PAT use, live artifact/ingestion/bootstrap command, provider
  request, OpenAI call, or real-project dogfood occurred.
- Pending: commit, draft PR publication, and natural Actions inspection.
