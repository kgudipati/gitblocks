# Recovery R5 hosted discovery MCP

## Status and authority

- Issue: [#40 — Recovery R5: Expose hosted discovery through MCP](https://github.com/kgudipati/gitblocks/issues/40)
- Branch: `feat/40-hosted-discovery-mcp`
- Owner: GitBlocks maintainers
- State: complete; draft PR publication pending
- Last updated: 2026-08-12

Issue #40 is the slice authority. The product contract, accepted ADRs, and
repository engineering policies govern durable boundaries. This plan records
execution and evidence; it does not expand the issue. No Phase 10 artifact is
an input or target.

## Purpose and user-visible outcome

R4 can execute hosted discovery after loading one PostgreSQL serving snapshot,
but an agent cannot reach that operation through a standard transport. R5 adds
one loopback-only MCP endpoint so an official MCP client can list exactly one
tool, call `discover_oss`, and receive the unchanged R4 application result.

The supported exercise is:

```text
R3 PostgreSQL state
  -> startHostedDiscoveryComposition(...)
  -> one initialized R4 application
  -> 127.0.0.1:<port>/mcp
  -> official StreamableHTTPClientTransport, protocol 2026-07-28
  -> tools/list: discover_oss
  -> tools/call: HostedDiscoveryApplicationV1.discoverCapability(...)
  -> semantic digest 4b1b67eda39c618ae67738e7776957c6ea45315d0893199c90e42f7bc39d9b00
```

R5 proves local interoperability. It does not make GitBlocks publicly or
remotely usable; authenticated remote private-alpha deployment is R6.

## Verified current repository state

- The worktree was clean before work began. `HEAD`, `main`, and `origin/main`
  were verified at `982a1942163bc6a9a0289acb844f2f0bf0807b98` after fetching
  `origin/main`.
- PR [#39](https://github.com/kgudipati/gitblocks/pull/39) is merged at that
  commit and Issue [#38](https://github.com/kgudipati/gitblocks/issues/38) is
  closed.
- R4 owns `apps/gitblocks-hosted`: startup loads one current serving snapshot,
  constructs one immutable retrieval engine/application, and exposes
  `discoverCapability(...)` with no request-time database capability.
- `CapabilityQueryInputV1` is already authoritative through
  `getContractSchemaV1('capability-query-input')` and
  `parseCapabilityQueryInputV1(...)`.
- Existing commands include `pnpm hosted:exercise`, `pnpm db:verify`,
  `pnpm verify`, and `pnpm verify:ci`. Runtime preflight passed on Node
  `24.18.0` with pnpm `11.17.0`.
- Official registry metadata on 2026-08-12 reports stable exact versions
  `@modelcontextprotocol/server@2.0.0`,
  `@modelcontextprotocol/node@2.0.0`, and
  `@modelcontextprotocol/client@2.0.0`, all published 2026-07-27, MIT,
  Node `>=20`, and from the official TypeScript SDK repository.
- The official v2 documentation identifies `createMcpHandler(...)` as the
  modern `2026-07-28` HTTP entry. It builds a fresh protocol server per request,
  defaults to stateless 2025-era compatibility, and requires no application
  session store. The official native Node recipe uses `toNodeHandler(...)`,
  localhost Host/Origin validation, and `node:http` bound to `127.0.0.1`.
- The frozen Phase 10 R&D branch remains superseded and is neither inspected
  nor changed.

## Scope and explicit non-goals

In scope:

- one MCP server factory in the existing hosted workspace;
- one `discover_oss` tool using the existing capability-query schema and R4
  application operation;
- official `createMcpHandler(...)`, Node adaptation, and client transport;
- native loopback HTTP lifecycle at `/mcp`;
- one bounded port setting and existing R4 database configuration;
- focused behavior/lifecycle tests, official-client HTTP interoperability, one
  real PostgreSQL-to-MCP integration, and a documented developer exercise;
- the minimal product/system/engineering metadata updates needed to describe
  implemented R5 behavior.

Out of scope: remote authentication or deployment, public binding, TLS, API
keys, OAuth implementation, users/tenancy, sessions, resumability, SSE
registries, resources, prompts, tasks, sampling, roots, subscriptions, logging
APIs, health/admin/debug/metrics endpoints, other HTTP APIs, databases or
migrations, ingestion/provider/model/interview operations, target repository
reads, target fit, ranking, recommendations, Skills, another workspace/service,
custom protocol framing, an evaluation corpus, and Phase 10.

## Requirements crosswalk

| Requirement                                   | Destination                                            | Evidence                                                                 |
| --------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| One `discover_oss` tool                       | hosted MCP factory                                     | official client `tools/list` exact assertion                             |
| Existing input authority                      | `getContractSchemaV1(...)` plus SDK raw-schema adapter | listed schema deep-equals contract export; application parser still runs |
| Preserve all R4 semantic outcomes             | tool-result projection only                            | retrieved, clarification-required, and unsupported tests                 |
| Bound failures                                | tool handler catch/mapping                             | application failure and thrown sentinel leakage tests                    |
| Stateless modern HTTP with safe compatibility | `createMcpHandler(...)` default                        | modern-era official-client test and SDK-owned legacy behavior            |
| Reuse initialized state                       | handler closes over R4 application                     | call counts plus post-start PostgreSQL permission revocation             |
| Continuous loopback process                   | native HTTP/process lifecycle                          | ordering, bind-address, route, and shutdown tests                        |
| Real acceptance journey                       | PostgreSQL integration and developer command           | exact authorization digest and shortlist                                 |

## Assumptions, risks, and unresolved decisions

- Verified fact: the SDK owns MCP JSON-RPC, protocol-version, header,
  Streamable HTTP, modern/legacy compatibility, and per-request server
  behavior. GitBlocks will not recreate them.
- Verified fact: the official Node adapter declares a Hono peer while exposing
  the documented native-HTTP `toNodeHandler(...)` API. Dependency installation
  is the first implementation gate. If repository policy requires GitBlocks to
  adopt or configure a web framework, rather than merely consume the official
  adapter's implementation dependency, R5 stops and reports that concrete SDK
  blocker.
- Risk: malformed or hostile HTTP traffic reaches a local listener. Mitigation:
  bind only `127.0.0.1`, expose only `/mcp`, use the official localhost
  Host/Origin guards and SDK parsing, and return value-free failures.
- Risk: transport code may duplicate business logic or regain database access.
  Mitigation: the server factory accepts only the R4 application interface;
  dependency checks and integration tests prove the boundary.
- Risk: listener startup or shutdown may invert ownership. Mitigation: start
  R4 and verify readiness before listen; stop listening before closing R4;
  make close idempotent and test failures.
- No material architecture decision remains open. An ADR is added only if a
  durable decision outside existing product, ADR 0001, or toolchain ownership
  emerges.

## Applicable ADRs and contracts

- The product contract remains authoritative for data locality, shortlist
  semantics, and the no-target-fit/no-recommendation boundary. It is updated
  only to describe the now-implemented loopback MCP slice.
- [ADR 0001](../architecture/decisions/0001-agent-native-delivery.md) already
  approves small user-goal-oriented MCP delivery; R5 implements its first tool.
- [ADR 0002](../architecture/decisions/0002-typescript-workspace-and-toolchain.md)
  owns Node/pnpm/toolchain and exact dependency policy; no framework or new
  workspace is selected.
- [ADR 0003](../architecture/decisions/0003-product-contract-kernel.md) requires
  MCP adapters to reuse exported product schemas/parsers and keep transport
  errors outside product contracts.
- [ADR 0009](../architecture/decisions/0009-production-retrieval.md) owns the
  shortlist lanes/provenance and prohibition on fit/recommendation claims.
- [ADR 0011](../architecture/decisions/0011-postgresql-retrieval-serving.md)
  owns load-once PostgreSQL serving and request-time immutable retrieval.
- No product DTO or persisted schema changes. The MCP result is an adapter
  projection of `HostedDiscoveryResultV1`.

## Architecture, data flow, and performance impact

```text
native Node HTTP / official MCP SDK
  -> createGitBlocksMcpServer(application)
  -> application.discoverCapability(arguments)
  -> existing normalization and immutable retrieval

process startup only:
PostgreSQL -> startHostedDiscoveryComposition(...) -> one application
```

The MCP server factory imports contracts for the exported schema and the R4
application type, but no persistence, retrieval construction, ingestion,
provider, model, filesystem policy, or evaluation code. `createMcpHandler`
may create protocol-server instances per HTTP request; they all close over the
same already-initialized application. Existing input/result limits and
deterministic behavior remain unchanged. The new HTTP process accepts one
request-oriented endpoint; it adds no queue, retry, cache, pagination, or
concurrency policy beyond the SDK and native server behavior required for this
loopback proof.

## Security, privacy, abuse, and supply chain

MCP arguments are untrusted and receive SDK schema validation followed by the
authoritative R4 parser. No request body, database value, environment value,
SQL, stack, raw error, source, or credential is logged or returned. Loopback,
fixed path, localhost Host/Origin validation, no configurable host, and no
temporary authentication constrain R5 to local interoperability. The listener
cannot be a shared/public service; R6 must add standard remote authorization
before any public binding or deployment.

Only official MCP packages at exact reviewed versions may be added. pnpm owns
the lockfile; release-age, trust, lifecycle, peer, integrity, secret, and audit
controls remain active. No candidate or ingested repository code is installed,
imported, or executed.

## Implementation milestones

1. **Dependency and transport gate.** Add only the exact official SDK packages
   allowed by repository policy; inspect their installed public types and stop
   if native HTTP requires application-owned framework/session/auth
   infrastructure.
2. **Thin MCP vertical slice.** Add the server/handler factory, one tool,
   contract-schema adaptation, structured result mapping, bounded failures, and
   official-client HTTP tests.
3. **Loopback lifecycle.** Add fixed loopback `/mcp`, bounded port parsing,
   startup/readiness/listen ordering, idempotent listener-first shutdown, CLI,
   and negative lifecycle/security tests.
4. **Real journey and documentation.** Extend the PostgreSQL integration
   through the MCP endpoint/client, add the developer exercise, update current
   state documentation, and reconcile all acceptance evidence.

## Testing and validation strategy

Focused development from repository root:

```text
pnpm runtime:check
pnpm --filter @gitblocks/gitblocks-hosted typecheck
pnpm exec vitest run apps/gitblocks-hosted/test --config vitest.config.ts
pnpm architecture:check
pnpm repo:check
git diff --check
```

The hosted tests cover exact tool listing/schema, one-call delegation,
structured semantic preservation, all three valid outcomes, safe failures,
sentinel redaction, no adapter database/provider/model/ingestion path, repeated
application reuse, modern `2026-07-28` official-client transport, fixed
loopback/path/Host/Origin behavior, startup ordering, and listener-first
shutdown. Dynamic port `0` is test-only.

Real PostgreSQL proof uses the pinned `pnpm db:verify` path and a non-owner,
non-superuser serving identity. It starts R4 once, revokes serving-table
`SELECT`, then performs repeated official MCP client calls and observes the
exact semantic digest. No live provider, model, interview, GitHub/npm/advisory
collection, materialization, or Phase 10 operation is run.

Final regression, once on the completed diff:

```text
pnpm verify:ci
git diff --check
git status --short
```

## Observability and operations

R5 is a local loopback exercise and cannot receive shared or production
traffic. The CLI emits only bounded structured readiness, failure-code, and
shutdown facts; payloads, query text, candidate data, database configuration,
credentials, SQL, and raw exceptions are excluded and tested. A telemetry
backend, SLO, dashboard, alert, health endpoint, and production runbook are not
introduced because no deployment or remote service exists. R6 must select the
remote authorization, deployment, and production telemetry path before public
traffic.

## Migration, compatibility, rollout, and recovery

There is no database, product DTO, or persisted MCP result migration. The SDK
serves protocol `2026-07-28` and retains its safe default stateless 2025-era
compatibility without GitBlocks session state. Rollout is local startup after
an R3 snapshot exists. Recovery is process shutdown or code rollback; the
immutable PostgreSQL snapshot is unchanged. No public compatibility promise or
remote caller exists yet.

## Exact exit criteria

- The documented PostgreSQL -> R4 -> loopback MCP -> official client journey
  lists only `discover_oss`, calls it, and returns digest
  `4b1b67eda39c618ae67738e7776957c6ea45315d0893199c90e42f7bc39d9b00`.
- One initialized application is reused; post-start tool calls perform no
  serving query and no provider/model/ingestion/interview operation.
- Clarification, unsupported, and retrieved remain valid structured outcomes;
  failures are bounded and redacted.
- Startup/listen and listener-first shutdown ordering are proven; binding is
  fixed to `127.0.0.1`; no auth or deployment claim exists.
- Focused checks, PostgreSQL integration, `pnpm verify:ci`, diff/status review,
  and issue/plan/PR evidence are complete.
- One conventional commit is pushed and one issue-linked draft PR is open.

## Progress log

- 2026-08-12: Verified clean R4 baseline, merged PR #39, closed Issue #38,
  runtime/toolchain, governing documents/ADRs, R4 implementation, official MCP
  `2026-07-28` behavior, and stable SDK `2.0.0` packages. Created Issue #40 and
  branch `feat/40-hosted-discovery-mcp`.
- 2026-08-12: Completed the dependency/transport gate. The three official SDK
  packages installed at exact `2.0.0`; the Node package's Hono peer is optional,
  frozen installation passes, and the documented `toNodeHandler(...)` path
  builds and executes without adding Hono or another framework.
- 2026-08-12: Implemented `createGitBlocksMcpServer(...)`, schema-derived
  `discover_oss`, bounded structured-result/error mapping,
  `createGitBlocksMcpHandler(...)`, fixed `127.0.0.1` `/mcp` serving, continuous
  startup/shutdown composition, process/client commands, dependency enforcement,
  and current-state/developer documentation.
- 2026-08-12: Focused official-client tests negotiated the modern
  `2026-07-28` era, listed one tool with the canonical input schema, and returned
  exact R4 digest
  `4b1b67eda39c618ae67738e7776957c6ea45315d0893199c90e42f7bc39d9b00`.
  Final repository and PostgreSQL regression are in progress.

## Decision and deviation log

- 2026-08-12: Select official `createMcpHandler(...)` with its default
  stateless legacy compatibility, native Node HTTP adaptation, and official
  client pinned to modern `2026-07-28` for acceptance. No custom session,
  framing, negotiation, or compatibility code. Owner: maintainers.
- 2026-08-12: Initial `pnpm repo:branch` invocation omitted the CLI value and
  exited 2; rerun as `pnpm repo:branch -- feat/40-hosted-discovery-mcp` passed.
  No product or repository state was changed by the failed usage call.
- 2026-08-12: The first focused MCP digest assertion used a request with new
  request identifiers and correctly produced a different deterministic digest.
  The test was corrected to use R4's accepted authorization exercise input; it
  now proves the governing digest instead of weakening or regenerating it.
- 2026-08-12: A pre-staging `pnpm repo:check` reported the two new required MCP
  CLI paths as missing because repository inspection reads Git's tracked index.
  The files exist in the working tree; the authoritative check is rerun after
  the completed diff is staged.
- 2026-08-12: The first final `pnpm verify:ci` reached lint and rejected a
  TypeScript architecture fixture outside the configured project. The fixture
  was converted to the repository's established `.mjs` fixture form and the
  same MCP dependency rule was extended to cover both production `.ts` and
  fixture `.mjs`; the rule's negative test remains mandatory.
- 2026-08-12: The corrected final regression reached the complete unit suite
  and found the expected lockfile-integrity guard still pinned to the pre-R5
  bytes. Updated only that accepted SHA-256 to the pnpm-generated R5 lockfile;
  no materialization command, fixture, authority, workflow, or migration was
  changed or executed.

## Validation evidence

- `node tools/runtime-preflight.mjs --show-success` — passed with Node
  `24.18.0`.
- `pnpm repo:branch -- feat/40-hosted-discovery-mcp` — passed.
- `pnpm view` for official server/node/client packages — stable exact version
  `2.0.0`, published 2026-07-27, MIT, official repository, Node `>=20`.
- `pnpm install --frozen-lockfile` — passed with all three exact SDK packages
  and repository supply-chain policies.
- hosted workspace typecheck/build/lint — passed.
- focused hosted MCP tests — 9 tests passed over native loopback HTTP and the
  official client; clarification, unsupported, retrieved, R4 fingerprint
  rejection, error redaction, loopback guards, reuse, and lifecycle are covered.
- `pnpm architecture:check` — passed after adding a negative fixture for the
  MCP-to-persistence prohibition.
- `pnpm db:verify` — passed on pinned PostgreSQL 18.4: 11 integration files and
  70 tests, including the real R3 snapshot -> R4 startup -> loopback MCP ->
  official modern client journey. After startup, direct serving-role `SELECT`
  was revoked and denied while two tool calls returned the same exact R4 digest;
  shutdown left zero serving sessions.
- final `pnpm verify:ci` — passed: 135 unit test files/1,979 tests, architecture,
  repository policy, contracts/evaluation/authority checks, secret scan, 11
  PostgreSQL files/70 tests without skips, and registry audit with no known
  vulnerabilities.
- `git diff --cached --check` and final worktree/status review — passed before
  publication. Failed checks above retain cause and resolution.
