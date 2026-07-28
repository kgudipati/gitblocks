# Issue 5: Node runtime preflight and CLI diagnostics

## Status and authority

- Governing issue:
  [#5 — Fix local Node runtime detection and CLI diagnostics](https://github.com/kgudipati/gitblocks/issues/5)
- Required branch: `fix/5-node-runtime-preflight`
- Owner: GitBlocks maintainers
- State: implementation, validation, publication, and hosted CI complete;
  independent final review and merge authorization pending
- Last updated: 2026-07-28
- Authority order: Issue #5; current `main`; ADR 0002; the engineering
  handbook and `AGENTS.md`; the implementation prompt

Issue #5 owns the observable failure, acceptance criteria, scope, and
non-goals. [ADR 0002](../architecture/decisions/0002-typescript-workspace-and-toolchain.md)
owns the supported Node range, exact pin, direct TypeScript model, package
manager, and verification architecture. This plan records execution and
evidence without weakening either source.

## Purpose and user-visible outcome

A contributor who starts GitBlocks tooling under an unsupported Node process
must receive one concise runtime-preflight error before Vitest or the
TypeScript-backed repository CLI starts. A supported Node process must pass
quietly, prove direct execution of a fixed inert TypeScript fixture, and
continue through the existing verification graph.

The hotfix also gives nvm users a mirrored `.nvmrc`, preserves `.node-version`
for CI and other managers, and makes unexpected CLI child-process failures show
bounded stdout and stderr instead of only an assertion mismatch.

## Verified current repository state

Verification on 2026-07-28 established:

- clean, fast-forward-current `main` at squash commit
  `3219848239cba980e20782a1580845fbbd901bb7`;
- open Issue #5 with no comments;
- no existing local or remote `fix/5-node-runtime-preflight` branch;
- the topic branch was created from that exact `main`;
- `.node-version` contains `24.18.0`, while `.nvmrc` is absent;
- the root engine contract is `>=24.12.0 <25`;
- pnpm policy uses `nodeVersion: 24.12.0`;
- root test and repository scripts execute Vitest or `.ts` source without an
  actual-process preflight;
- CLI integration assertions compare only `result.status`, so unexpected child
  stderr is hidden by the assertion report;
- nvm has Node 22.14.0 and 24.18.0 installed; its default is Node 22.14.0;
- after `nvm use 24.18.0`, Node reports `v24.18.0` and pnpm reports `11.17.0`;
  no runtime or package installation is required.

Verified reproduction:

```text
$ nvm use 22.14.0
$ node --version
v22.14.0
$ node tools/repository-checks/src/cli.ts branch build/3-typescript-toolchain
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"
```

The error occurs before the CLI can own diagnostics. Node 22.14.0 does not
support the repository's direct erasable-TypeScript execution path.

`.node-version` did not switch nvm because nvm reads `.nvmrc` when an explicit
`nvm use` or `nvm install` operation is invoked; `.node-version` is not nvm's
project-version file, and nvm does not auto-switch directories without separate
user shell automation. GitBlocks will document the explicit nvm flow and will
not install shell hooks.

pnpm's `nodeVersion: 24.12.0` is intentionally a dependency-resolution and
engine-compatibility input representing the minimum supported runtime. It does
not replace, activate, or preflight the Node executable running the current
shell.

## Scope and explicit non-goals

In scope:

- add `.nvmrc` mirroring `.node-version`;
- add a dependency-free JavaScript runtime preflight and one fixed inert
  TypeScript capability fixture;
- protect direct TypeScript-backed root commands and avoid redundant checks in
  the aggregate verification graph;
- improve bounded CLI subprocess assertion diagnostics;
- add deterministic version, file, capability, command-order, invariant, and
  diagnostic regression tests;
- update README, CONTRIBUTING, AGENTS, ADR 0002, repository invariants, and
  this plan where behavior becomes real;
- publish one draft PR and inspect hosted CI.

Non-goals:

- no Node, pnpm, TypeScript, dependency, action, or lockfile update;
- no runtime download, installation, global package, shell hook, or profile
  automation;
- no product service, framework, API, MCP, Skill, application, database,
  deployment, or placeholder package;
- no unrelated repository-check redesign or GitHub ruleset change;
- no history rewrite, direct `main` push, merge, or ready-for-review action.

## Requirements crosswalk

| Issue #5 requirement or acceptance criterion        | Destination                                             | Milestone and evidence                                                   |
| --------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| nvm-compatible pin mirrors cross-tool pin           | `.nvmrc`; invariant tests                               | M1; byte-normalized equality and repository check                        |
| dependency-free actual-process preflight            | `tools/runtime-preflight.mjs`                           | M2; version/file/exit/diagnostic unit and subprocess tests               |
| direct TypeScript capability proof                  | fixed inert `.ts` fixture and exact-source verification | M2; real Node 24 execution and simulated failure tests                   |
| unsupported runtime fails before TS-backed commands | root scripts                                            | M3; package-script contract tests and Node 22 manual demonstration       |
| no redundant aggregate preflight                    | `runtime:check`, `verify:core`, `verify`, `verify:ci`   | M3; script graph review and command output                               |
| actionable CLI child diagnostics                    | reusable test assertion helper and `cli.test.ts`        | M4; failing fixture includes bounded status/signal/stdout/stderr/runtime |
| durable documentation and policy                    | README, CONTRIBUTING, AGENTS, ADR 0002, invariants      | M5; Markdown/repository checks and diff review                           |
| existing and new checks pass                        | root verification graph                                 | M6; local matrix, coverage, clean-tree evidence                          |
| draft PR and hosted CI pass                         | GitHub PR and Actions                                   | M7; PR URL, run/job/log evidence                                         |
| no product or dependency change                     | complete diff and lockfile review                       | M6/M7; path, manifest, and lockfile comparison                           |

## Assumptions, risks, and unresolved decisions

Verified facts:

- Node 24.18.0 can execute the current erasable TypeScript CLI source.
- Node 22.14.0 fails before CLI code runs.
- both required Node versions are already installed locally through nvm.

Implementation decisions:

- `.node-version` remains the authoritative exact pin; `.nvmrc` is its
  mechanically checked mirror.
- the runtime policy is parsed directly as three decimal components rather than
  adding a semver dependency.
- the capability check may spawn only `process.execPath` with one fixed,
  repository-owned inert fixture whose exact content is verified before
  execution. It will not execute scanned or variable repository content.
- one stable preflight failure exit code covers unsupported runtime,
  missing/malformed/mismatched pins, and missing/incapable TypeScript support;
  an optional documented success flag may print confirmation.
- public TypeScript-backed root commands run the preflight directly. The
  aggregate graph uses an internal core command after one outer preflight.

Risks and controls:

- A malformed or symlinked pin could cause unsafe reads. Pin paths are fixed,
  regular files with a small byte bound and strict version syntax.
- A capability fixture could become executable arbitrary content. The preflight
  compares its bytes to a fixed inert source before spawning it and uses
  `spawnSync` with `shell: false`.
- Diagnostics could disclose child output or grow without bound. The preflight
  prints no child output, and the test assertion helper truncates each captured
  field independently.
- Shell command strings in package scripts are static reviewed repository
  configuration; no repository-derived value is interpolated into them.

No material implementation decision remains open.

## Applicable ADRs and contracts

- ADR 0002 is amended, not superseded. It will distinguish the cross-tool/CI
  exact pin, nvm mirror, actual-process preflight, dependency-engine minimum,
  and direct TypeScript capability proof.
- The product contract, system context, ADR 0001, public API, persistence,
  event, MCP, Skill, and deployment contracts remain unchanged because this is
  repository tooling only.
- Stable preflight exit behavior and safe diagnostic shape are new local
  tooling contracts documented in ADR 0002 and tests.

## Architecture, data flow, and performance impact

The preflight is a root tooling boundary, not part of the TypeScript package or
product architecture:

```text
root command
  -> runtime preflight (.mjs)
       -> fixed pin files
       -> process.versions.node
       -> exact inert .ts fixture via process.execPath
  -> existing Vitest or repository-check command
```

Inputs are the active Node version, two fixed version files of at most 64 bytes,
one fixed capability fixture of bounded size and exact content, and the
optional success flag. There is no network, retry, concurrency, pagination, or
mutable state. The capability subprocess runs once per directly invoked public
command and once per aggregate verification graph. Expected time is below one
second and memory is bounded by one Node child plus small fixed buffers.

## Security, privacy, abuse, and supply-chain considerations

The change adds no dependency, lockfile record, lifecycle allowance, CI action,
credential, network request, provider, or secret. The preflight uses Node
standard-library file and process APIs only.

Version strings and fixed repository files are untrusted inputs. They receive
strict syntax, type, size, regular-file, equality, and exact-content checks.
The implementation uses no shell, `eval`, `Function`, dynamic import, arbitrary
path, environment dump, automatic installation, or repository scan. Failure
messages include only bounded version/policy facts and an example nvm command.
The nvm example does not detect, invoke, or require nvm.

Authentication, authorization, tenant isolation, personal data, persistence,
retention, webhooks, prompt injection, and model-provider transfer are not
applicable: the command is local, deterministic repository tooling and handles
none of those assets.

## Implementation milestones

### M1: Pin mirror and failing policy tests

- Add `.nvmrc`.
- Add failing tests for accepted/rejected versions, malformed input,
  missing/mismatched pins, and required repository files.
- Evidence: targeted Vitest failures before implementation.

### M2: Dependency-free preflight and capability check

- Implement pure version/pin policy plus bounded filesystem/process adapters in
  `tools/runtime-preflight.mjs`.
- Add the fixed inert TypeScript capability fixture.
- Test real supported execution, simulated incapability, quiet success,
  actionable bounded failure, stable exit behavior, and no installation side
  effect.
- Evidence: focused tests pass; manual simulated unsupported message.

### M3: Protected command graph

- Add `runtime:check` and `verify:core`.
- Guard every required direct TypeScript-backed public script.
- Ensure `verify` and `verify:ci` run one aggregate preflight without
  suppression.
- Evidence: script contract tests and Node 22 subprocess demonstration fail
  before Vitest/CLI startup.

### M4: CLI child-process diagnostics

- Introduce one reusable bounded assertion helper.
- Apply it to every CLI test exit assertion.
- Add a controlled failing child fixture proving status, signal, stdout,
  stderr, executable path, Node version, and truncation.
- Evidence: focused CLI tests pass and mutation of expected status produces an
  actionable bounded message.

### M5: Durable policy and documentation

- Update repository invariants, reader fixtures, README, CONTRIBUTING, AGENTS,
  and ADR 0002.
- Record implementation decisions and failures here.
- Evidence: repository and Markdown checks pass.

### M6: Full local validation and reconciliation

- Run the exact validation matrix under Node 24.18.0.
- Reconcile every criterion, inspect dependency/lockfile/product paths, and
  prove verification leaves tracked files unchanged.
- Evidence: command table, coverage baseline, complete diff review.

### M7: Publication and hosted CI

- Commit intentionally, push normally, open the exact draft PR, update its
  description, wait for CI, and inspect the actual job logs.
- Evidence: commit SHA, PR URL/state, workflow run/job/log conclusions.

## Testing and validation strategy

All commands run from the repository root. Local validation explicitly
activates the already-installed Node 24.18.0:

```bash
source "$NVM_DIR/nvm.sh"
nvm use 24.18.0
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm test:coverage
pnpm architecture:check
pnpm repo:check
pnpm security:secrets
pnpm security:audit
pnpm verify
pnpm verify:ci
git diff --check
git status --short --branch
git diff --stat
git diff
```

Expected versions are Node `v24.18.0` and pnpm `11.17.0`. Every command must
exit zero, both frozen installs must leave the lockfile unchanged, online audit
failure must remain visible, and final status must contain only intended
uncommitted work before publication or be clean afterward.

Focused deterministic cases cover Node 22.14.0, 24.11.x, 24.12.0, 24.18.0,
25.x, malformed and oversized versions, missing/malformed/mismatched pin files,
real and simulated direct-TypeScript capability, unsupported ordering before a
guarded command, stable exit codes, quiet success, bounded diagnostics, and no
automatic installation. Tests use no runtime download, live network, arbitrary
sleep, global Git configuration, environment dump, or mutable shell profile.

Manual evidence uses an injected or isolated policy invocation for unsupported
messages. The already-installed Node 22 runtime may execute only the
dependency-free preflight to prove fail-fast behavior; it will not be
downloaded or installed by this change.

## Observability and operations

No shared or production path changes, so traces, metrics, dashboards, alerts,
SLOs, readiness, retries, queues, and runbooks are not applicable. The
diagnostic itself is the local operational signal: one stable exit category and
one redacted bounded line with actual version, supported range, pin, reason,
and remediation example.

## Migration, compatibility, rollout, and recovery

There is no persisted or public-product migration. Supported Node 24.12.x
through 24.x behavior remains compatible. Unsupported or incapable runtimes
change from late, misleading tool failures to an intentional early failure.

Rollout is the topic branch, draft PR, local validation, and hosted CI. Recovery
is a normal revert of the hotfix commit; `.node-version`, dependencies,
lockfile, product contracts, and product behavior are unchanged. No step is
irreversible.

## Exact exit criteria

- Every Issue #5 deliverable and acceptance criterion maps to passing evidence.
- `.nvmrc` and `.node-version` agree and work with explicit nvm commands.
- Unsupported, malformed, missing, mismatched, and incapable cases fail once
  with stable, bounded, actionable output before TypeScript-backed work.
- Supported Node 24.18.0 passes the real capability check and all existing/new
  verification.
- CLI child assertion failures expose bounded process diagnostics.
- Documentation, ADR, invariants, scripts, and tests agree.
- No dependency, lockfile, lifecycle allowlist, product code, or placeholder
  application change exists.
- The branch is committed and pushed normally; the exact draft PR is open,
  unmerged, and green in hosted CI.

## Progress log

- [x] 2026-07-28 — Verified clean current `main`, squash commit, issue state,
      branch availability, installed nvm runtimes, pnpm pin, and exact Node
      22.14.0 direct-TypeScript failure.
- [x] 2026-07-28 — Created the required topic branch and initial execution plan
      before tests, configuration, or implementation.
- [x] M1 — Pin mirror and failing policy tests.
- [x] M2 — Runtime preflight and direct-TypeScript capability check.
- [x] M3 — Protected root command graph.
- [x] M4 — Bounded CLI subprocess diagnostics.
- [x] M5 — Durable policy and documentation.
- [x] M6 — Full local validation and reconciliation.
- [x] 2026-07-28 — Published implementation commit
      `39f13827080b5d5e1e08e9edc9ef59285591a67c` with an ordinary push and
      opened draft PR
      [#6](https://github.com/kgudipati/gitblocks/pull/6) with the exact
      required title.
- [x] M7 — Draft PR publication and hosted CI.

## Decision and deviation log

- 2026-07-28 — Use `.node-version` as the authoritative exact pin and `.nvmrc`
  as an equality-checked nvm mirror. Reason: CI and other managers already
  consume `.node-version`; replacing it would reduce compatibility.
- 2026-07-28 — Use a dependency-free `.mjs` preflight with direct numeric
  version parsing. Reason: the guard must run on unsupported Node versions and
  the bounded range does not justify a semver dependency.
- 2026-07-28 — Prove native TypeScript support by spawning only a fixed,
  exact-content inert fixture with the current Node executable after the
  version and pin checks pass. Reason: this tests capability without executing
  arbitrary repository content or dynamic code.

No deviations from Issue #5 are currently known.

## Failures and corrections

- 2026-07-28 — Baseline direct CLI reproduction failed under Node 22.14.0 with
  `ERR_UNKNOWN_FILE_EXTENSION`, before GitBlocks CLI diagnostics could run.
  This is the defect being corrected, not an accepted validation result.
- 2026-07-28 — The focused test-first run failed as intended: the new runtime
  and child-assertion modules were absent, and five repository-invariant cases
  failed because pin agreement, command protection, and the root preflight path
  were not implemented. Correction: added the bounded JavaScript preflight,
  fixed inert fixture, reusable child assertion, protected scripts, reader, and
  invariant policy; the expanded focused slice then passed 65 tests.
- 2026-07-28 — The first quality pass found three formatting targets and 13
  lint findings involving control-character regexes, deprecated matcher usage,
  unsafe matcher inference, an inferrable fixture annotation, and an implicit
  `URL` global. Correction: used explicit code-point sanitization, one typed
  caught-error assertion, a meaningful TypeScript interface fixture, and a
  Node `URL` import, then applied pinned Prettier. A follow-up lint run requested
  an interface instead of a type alias; the fixture and exact expected source
  were corrected without disabling a rule.

## Validation evidence

| Command or review                                       | Date       | Observed result                                                                                                                  |
| ------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `git status --short --branch`                           | 2026-07-28 | Clean `main`, then clean new `fix/5-node-runtime-preflight` branch                                                               |
| `git fetch origin`; `git pull --ff-only origin main`    | 2026-07-28 | Local `main` already matched `origin/main`                                                                                       |
| `git rev-parse HEAD`; `git log --oneline --decorate -8` | 2026-07-28 | `main` at required squash commit `3219848239cba980e20782a1580845fbbd901bb7`                                                      |
| Issue #5 authenticated read                             | 2026-07-28 | Open; authoritative requirements read completely; no comments                                                                    |
| `nvm ls`; `nvm use 24.18.0`; version commands           | 2026-07-28 | Node 22.14.0 default and Node 24.18.0 installed; supported runtime reports Node `v24.18.0`, npm `11.16.0`, pnpm `11.17.0`        |
| Node 22.14.0 direct CLI reproduction                    | 2026-07-28 | Expected incident reproduced: `ERR_UNKNOWN_FILE_EXTENSION` for the `.ts` CLI entry before CLI code ran                           |
| Focused test-first Vitest run                           | 2026-07-28 | Expected failure: two missing implementation modules plus five failing repository-invariant cases                                |
| Corrected focused Vitest run                            | 2026-07-28 | Pass: runtime, CLI, and invariant slices; 3 files and 65 tests                                                                   |
| Node 22 preflight, `pnpm test`, and `pnpm repo:branch`  | 2026-07-28 | Exit `1` at preflight with actual/range/pin/remediation before Vitest or `.ts` CLI execution                                     |
| Node 24 preflight and success flag                      | 2026-07-28 | Quiet protected pass; explicit flag reports 24.18.0 after real inert TypeScript capability execution                             |
| Corrected format, lint, and typecheck                   | 2026-07-28 | Pass after recorded formatting/lint corrections; no rule disabled                                                                |
| Two `pnpm install --frozen-lockfile` runs               | 2026-07-28 | Pass in 158/157 ms; already up to date; lockfile blob remains `4afa910428e83e3494ed9abd25e79d1b8e94111e`                         |
| `pnpm format:check`; `pnpm lint`; `pnpm typecheck`      | 2026-07-28 | Pass under Node 24.18.0 with pinned tools and zero lint warnings                                                                 |
| `pnpm build`; `pnpm test`                               | 2026-07-28 | Pass: emitted private tooling package; 10 files and 159 tests                                                                    |
| `pnpm test:coverage`                                    | 2026-07-28 | Pass: 85.75% statements, 82.98% branches, 95.34% functions, 85.59% lines; no threshold                                           |
| `pnpm architecture:check`                               | 2026-07-28 | Pass: no violations across 135 modules and 329 dependencies                                                                      |
| `pnpm repo:check`; `pnpm security:secrets`              | 2026-07-28 | Pass: pin, preflight, command graph, repository/Markdown policy, and secret scan                                                 |
| `pnpm security:audit`                                   | 2026-07-28 | Pass: registry-backed audit completed; no known vulnerabilities                                                                  |
| `pnpm verify`; `pnpm verify:ci`                         | 2026-07-28 | Pass: one aggregate preflight, full offline graph, then visible online audit                                                     |
| Pin, lockfile, worktree, and complete diff review       | 2026-07-28 | Pins byte-identical; no dependency/lockfile/product path; verification created no unstaged tracked change; staged diff reviewed  |
| Ordinary commit and non-forced push                     | 2026-07-28 | Implementation commit `39f13827080b5d5e1e08e9edc9ef59285591a67c` published on `fix/5-node-runtime-preflight`                     |
| Draft PR #6                                             | 2026-07-28 | Open, draft, unmerged, exact required title and `Closes #5`: <https://github.com/kgudipati/gitblocks/pull/6>                     |
| Hosted CI run `30394069517`, job `90392571325`          | 2026-07-28 | Pass in 61 seconds: Node 24.18.0, pnpm 11.17.0, install/reproducibility, metadata, 159 tests, verification/audit, clean worktree |
