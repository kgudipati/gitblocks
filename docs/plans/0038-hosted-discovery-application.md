# Recovery R4 hosted discovery application

## Status and authority

- Governing issue: [#38](https://github.com/kgudipati/gitblocks/issues/38)
- Branch: `feat/38-hosted-discovery-application`
- State: complete
- Last updated: 2026-08-12
- Authority order: Issue #38 and the product contract; ADRs 0004, 0008,
  0009, and 0011; repository engineering standards; this plan.

No new ADR is required. R2 already approves one hosted Node application around
PostgreSQL and pure retrieval, while ADRs 0009 and 0011 approve the exact
retrieval and startup-loader boundaries. R4 selects no framework, transport,
provider, database, or deployment technology.

## Purpose and executable outcome

Current main can reconstruct the accepted immutable retrieval engine from an
R3 PostgreSQL snapshot, but only development/evaluation callers complete that
composition. R4 adds one product-owned application API and one real startup
composition. A developer/operator can exercise:

```text
R3 PostgreSQL + SELECT-only serving login
  -> load current snapshot once
  -> parse checked-in taxonomy and retrieval expansion
  -> construct immutable retrieval engine
  -> create hosted discovery application
  -> discover CapabilityQueryInputV1
  -> normalization or clarification/unsupported
  -> bounded eligible/evidence-needed shortlist
  -> repeat without PostgreSQL
  -> close the persistence client
```

This remains local/in-process. Another machine cannot use GitBlocks until a
later MCP slice.

## Verified current repository state

- The initial worktree was clean. `main` and `origin/main` were both
  `7ab5a6bdb2156231e38050fae535df184107bb5f`; PR #37 was merged with that SHA
  and Issue #36 was closed. This branch starts at that exact commit.
- `@gitblocks/persistence` owns explicit injected clients and
  `loadServingCatalogSnapshot(...)`, which reconstructs and validates the
  accepted profile/metadata authorities in one read-only repeatable-read
  transaction. The `gitblocks_serving` role remains SELECT-only.
- `@gitblocks/retrieval` owns a pure immutable engine. Construction accepts the
  taxonomy, profile, expansion, metadata, and R3-returned metadata binding;
  `retrieve(...)` performs no I/O.
- `@gitblocks/contracts` already owns `CapabilityQueryInputV1`, normalization,
  candidate retrieval request/result contracts, bounds, digests, and safe
  issues. Phase 9 rejects non-null repository-fingerprint references.
- Accepted policy files are the checked-in taxonomy and retrieval-expansion
  manifests under `catalog/`; neither depends on the evaluation harness.
- Root pnpm commands, TypeScript references, Vitest roots, dependency-cruiser,
  repository inventory checks, and README/system-context inventories must be
  extended only for the one new workspace.

## Scope and non-goals

Scope is one `apps/gitblocks-hosted` workspace containing:

- an in-process `createHostedDiscoveryApplication(...)` constructor and one
  `discoverCapability(...)` operation;
- concrete startup composition using persistence, accepted static policy, and
  retrieval;
- six serving-database environment settings, ready state, idempotent graceful
  close, and bounded value-free lifecycle failures;
- one one-shot structured-request exercise using the same composition; and
- focused unit and PostgreSQL integration tests plus minimum repository/docs
  integration.

No HTTP, MCP, socket/stdin RPC, model/LLM, target fingerprint or fit,
recommendation, scanner, ingestion/provider/interview/evaluation runtime path,
migration, bootstrap, write, cache, queue, worker, scheduler, ORM, search
infrastructure, deployment, tenancy, billing, or Phase 10 work is in scope.

## Requirements crosswalk

| Requirement                                    | Destination                                                     | Evidence                                                                   |
| ---------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Product-owned normalize/retrieve use case      | application module                                              | focused behavior tests                                                     |
| Load PostgreSQL once and never at request time | composition owns loader; application owns only immutable engine | mocked load-count test and post-start privilege-revocation PostgreSQL test |
| Accepted static policy                         | fixed checked-in asset loader with existing parsers             | valid/invalid policy tests                                                 |
| Readiness and graceful close                   | composition lifecycle                                           | startup/close tests                                                        |
| Real exercise                                  | one-shot CLI over the same composition and operation            | PostgreSQL integration plus documented command/result                      |
| No prohibited runtime path                     | exact manifest and dependency-cruiser boundary                  | architecture/repository checks and source review                           |

## Architecture, contracts, and data flow

The application module depends inward on contracts, domain authority needed to
construct exact candidate-reference bindings, and retrieval. It has no
persistence, filesystem, process, or environment capability. The composition
module wires the concrete persistence adapter and fixed filesystem policy
assets inside the same workspace; there is no second package or generalized
port layer.

`discoverCapability(unknown)` reparses the existing input, rejects the Phase 9
repository-fingerprint case, normalizes with the existing implementation, and
returns the existing normalization result unchanged for clarification or
unsupported outcomes. A normalized result is wrapped in the existing retrieval
request with explicit lane limits of ten, sent to the already-created engine,
and returned with the existing retrieval result unchanged. The application
wrapper is an in-process use-case result, not a second recommendation or
ranking DTO.

Startup reads exactly six `GITBLOCKS_HOSTED_SERVING_DB_*` values, creates one
client, loads `{ selection: 'current' }`, loads/parses the two accepted files,
constructs the engine/application, and only then returns ready. Any failure
closes the client and propagates a bounded existing persistence failure or a
stable hosted-startup category. Close is idempotent and makes readiness false.

Bounds are inherited: 150 candidates, six channels, at most ten eligible and
ten evidence-needed records, fixed parser limits, fixed policy file paths, and
configured PostgreSQL connection/statement/lock timeouts. Discovery is
synchronous over immutable state and adds no retry, concurrency, cache, or
request-time database behavior.

## Risks and decisions

- **Risk — accidental request-time database access:** the application object
  never receives a persistence client; unit call counts and a real PostgreSQL
  privilege-revocation test make the boundary observable.
- **Risk — static-policy drift or invalid files:** both checked-in authorities
  pass their existing parsers and retrieval binding checks on every startup;
  startup fails closed.
- **Risk — duplicated response semantics:** clarification and unsupported
  return the existing normalization DTO, while retrieved returns the existing
  retrieval DTO. No recommendation response is added.
- **Risk — credential/request leakage:** configuration and input values are
  never included in errors or lifecycle output. The one-shot summary contains
  only snapshot/digest/counts, bounded candidate IDs, and determinism facts.
- **Decision — one-shot process:** without a real transport, a long-running
  process is artificial. R4 supplies startup plus one-shot exercise; R5 owns
  continuous MCP process lifecycle.

ADRs 0004, 0008, 0009, and 0011 remain accepted and unchanged. Product contract,
system context, testing/observability status, and repository map will be updated
from “planned” to the exact implemented R4 boundary.

## Security, privacy, and operations

Database credentials and environment values are untrusted configuration and
pass persistence validation; static JSON and discovery input pass existing
contract parsers. The serving login is not granted or asked for any new
privilege. Candidate data is inert and no repository code is read or executed.
No request bodies, evidence, environment dumps, passwords, SQL, or raw errors
are logged.

R4 has no shared deployment, inbound transport, authenticated caller,
provider, worker, telemetry backend, SLO, dashboard, alert, or runbook. Those
concerns are not applicable until their real boundary exists. The executable
reports only bounded one-shot startup/readiness/result/shutdown facts; tests
cover failure redaction and lifecycle. PostgreSQL schema and data compatibility
are unchanged, so there is no migration or backfill. Rollback is removal of the
new caller; the R3 database remains independently usable.

## Implementation milestones

1. Add the workspace, application constructor/result, discovery operation,
   accepted-policy parsing, and focused behavior tests.
2. Add concrete environment/startup/ready/close composition and one-shot
   exercise; test load-once, request-time isolation, startup failures, and
   closure.
3. Extend PostgreSQL integration to exercise the exact hosted composition with
   the serving identity, deny request-time reads after initialization, and
   retain missing/corrupt-state failures.
4. Apply minimum build/test/architecture/inventory/docs integration, execute
   the journey, run final gates once, self-review, and publish the draft PR.

## Testing and exact validation

Focused development commands from repository root:

```text
pnpm runtime:check
pnpm --filter @gitblocks/gitblocks-hosted build
pnpm exec vitest run apps/gitblocks-hosted/test --config vitest.config.ts
pnpm architecture:check
pnpm repo:check
```

The hosted tests must cover accepted retrieval, hard exclusion, separate
evidence-needed results, clarification, unsupported, fingerprint rejection,
determinism, invalid policy, load once, repeated no-database discovery,
startup cleanup, and shutdown. PostgreSQL integration under the existing
pinned non-skipping infrastructure must cover successful serving-only startup,
missing/corrupt current state, post-start SELECT revocation, the one-shot
exercise summary, and client closure.

Final regression runs once after focused checks and documentation are complete:

```text
pnpm verify:ci
git diff --check
git status --short
```

`pnpm verify:ci` supplies the authoritative ordinary regression, pinned
PostgreSQL integration, registry audit, secret scan, authorities, and
repository/architecture checks. No live GitHub/npm/advisory collection, model,
interview, materialization, or Phase 10 operation is authorized.

## Exact exit criteria

- The real PostgreSQL-serving → policy → engine → application → discovery path
  returns the expected bounded shortlist twice with one startup load.
- Missing/corrupt state and invalid policy fail closed; close reaches the
  persistence client; prohibited imports/effects are absent.
- Issue, plan, docs, tests, exact exercise evidence, and final validation are
  current; all changed lines receive scope/security/compatibility self-review.
- One conventional commit is pushed and a completed issue-linked draft PR is
  opened. R5 does not begin.

## Progress log

- 2026-08-12: verified clean baseline, exact main/origin SHA, merged PR #37,
  closed Issue #36, current R3 implementation, and required governance; created
  Issue #38 and the issue-linked branch; wrote this initial plan before code.
- 2026-08-12: implemented `apps/gitblocks-hosted` with the pure application
  constructor/discovery operation, concrete startup/static-policy composition,
  bounded configuration/failures, idempotent close, and one-shot exercise.
- 2026-08-12: added 13 focused tests plus real PostgreSQL coverage. The pinned
  database verifier passed all 11 database files/69 tests, including the R4
  one-shot, missing/corrupt state, post-start serving-SELECT revocation,
  deterministic replay, and connection closure.
- 2026-08-12: integrated the workspace with build/typecheck/Vitest/CI,
  dependency-cruiser, repository inventory, and current-state documentation;
  focused repository checks and architecture checks pass.

## Decision and deviation log

- 2026-08-12: use one workspace with module-level application/composition
  separation and a one-shot process. Existing R2/ADR authority is sufficient;
  no new ADR or transport is justified.
- 2026-08-12: keep PostgreSQL as a startup/lifecycle dependency only. The real
  integration test revokes all serving-table SELECT after readiness, proves a
  direct serving query fails with PostgreSQL `42501`, then proves two discovery
  calls remain successful and identical.

## Validation evidence

- `pnpm runtime:check`: passed on Node 24.18.0.
- `pnpm --filter @gitblocks/gitblocks-hosted build`: passed.
- `pnpm --filter @gitblocks/gitblocks-hosted lint`: passed.
- `pnpm --filter @gitblocks/gitblocks-hosted typecheck`: passed.
- `pnpm exec vitest run apps/gitblocks-hosted/test --config vitest.config.ts`:
  2 files/13 tests passed.
- `pnpm db:verify`: 11 files/69 tests passed against pinned PostgreSQL 18.4,
  five migrations, 29 product tables, zero RLS policies, and no skipped test.
- `pnpm architecture:check`: 904 modules/3,079 dependencies, zero violations.
- Focused repository governance: 2 files/85 tests passed; `pnpm repo:check`
  passed after the new paths entered the tracked inventory.
- Exact request: the checked-in authorization request has no draft constraints
  or fingerprint. The exercised shortlist digest is
  `4b1b67eda39c618ae67738e7776957c6ea45315d0893199c90e42f7bc39d9b00`;
  eligible IDs are `auth-casbin-casbin`, `auth-casbin-casbin-js`,
  `auth-casbin-node-casbin`, `auth-warrant`, `auth-aserto-topaz`,
  `auth-authzed-spicedb`, `auth-cerbos-cerbos`, `auth-open-policy-agent`,
  `auth-openfga`, and `auth-ory-keto`; evidence-needed is empty. The integration
  asserts one serving snapshot load and two byte-identical discovery results.
- Resolved development failures: the initial frozen install correctly rejected
  the new lockfile importer and `pnpm install --no-frozen-lockfile` regenerated
  it under repository supply-chain policy; the initial focused Vitest command
  found no app tests until the root include was added; an ad hoc database
  harness omitted migration ordering, so the supported `pnpm db:verify` path
  was used and passed. The first final regression then found only the existing
  materialization scope test's byte pins for the intentionally changed CI
  workflow and lockfile; both expectations were updated to the reviewed R4
  bytes.
- Final `pnpm verify:ci`: passed after the byte-pin compatibility correction;
  133 ordinary files/1,968 tests, 11 PostgreSQL files/69 tests with no skips,
  all build/lint/type/architecture/repository/contract/authority/secret gates,
  and the registry audit with no known vulnerabilities.
- Final `git diff --check`: passed. Publication review found no prohibited
  runtime dependency, request-time database capability, transport, provider,
  model, ingestion, evaluation, interview, migration, or persistence write.
