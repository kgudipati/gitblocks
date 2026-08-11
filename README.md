# GitBlocks

GitBlocks is a planned agent-native open-source adoption layer that will help a
developer's existing coding agent find, compare, and plan the adoption of OSS
using target-codebase facts and attributable evidence.

## Problem and target user

Professional TypeScript developers regularly need infrastructure capabilities
such as authorization, background jobs, or webhooks. Generic search can find
popular projects, but it does not reliably answer whether a project fits a
specific repository's runtime, data model, deployment constraints, security
requirements, or adoption budget.

GitBlocks is intended for developers who already work through a coding agent
and want repository-conditioned decision support without replacing that agent
or sending their full codebase to a remote service.

## Planned user journey

1. The developer asks their existing coding agent for an OSS capability and
   states hard constraints.
2. A GitBlocks Agent Skill guides a deterministic local scan of approved
   repository facts without executing repository code.
3. The developer reviews the minimized fingerprint and any optional data that
   would cross the local boundary.
4. A remote MCP service discovers viable candidates and evaluates
   repository-specific adoption fit using sourced evidence.
5. The coding agent explains tradeoffs, inferences, unknowns, adoption effort,
   and risk.
6. The developer selects a candidate or accepts that no responsible candidate
   is known.
7. The coding agent creates an adoption plan and, in a later phase and only
   after approval, may edit and validate the repository locally.
8. An optional minimized outcome helps improve future recommendations.

This journey is an approved product direction, not currently available
functionality.

## System boundary

| Participant                         | Planned responsibility                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Developer                           | Defines the goal and constraints; approves data sharing, candidate selection, and effects                      |
| Existing coding agent               | Remains the interactive runtime; performs approved local edits and validation                                  |
| GitBlocks Agent Skill               | Owns the discovery procedure, safe orchestration, data minimization, evidence presentation, and plan structure |
| Local deterministic scanner         | Produces a versioned codebase fingerprint from approved reads; never executes ingested code                    |
| GitBlocks remote MCP and backend    | Own candidate discovery, catalog/evidence access, codebase-conditioned ranking, and minimized outcomes         |
| GitHub and package/security sources | Provide untrusted external evidence with provenance and freshness                                              |

See the [system context](docs/architecture/system-context.md) for planned
components, data flows, and trust boundaries.

## Current development status

GitBlocks is in its product and engineering foundation phase. This repository
contains an exactly pinned TypeScript workspace, deterministic repository
verification tooling, a proposed ten-case evaluation pilot for
repository-conditioned adoption fit over fixed candidate sets, and six
implemented non-operational product packages: pure domain, versioned
contracts, a PostgreSQL persistence adapter, bounded operator-run ingestion,
the repository-interview application, and `@gitblocks/retrieval`. The pure
retrieval package is transport-neutral, in-process, deterministic, bounded,
and evaluation-independent. It consumes an accepted normalized capability
query and candidate authorities and produces separate bounded eligible and
evidence-needed candidate lanes with provenance. Full tenant and organization
persistence is intentionally deferred.

The repository also contains a curated 150-repository public catalog, plus
exact immutable public repository artifacts and lossless line-addressable
chunks for all 150 candidates. Phase 7 now includes repository-interview
contracts, application,
immutable PostgreSQL history, evaluation authority, a bounded direct Responses
adapter, an explicit offline operator composition root, and a content-free
Milestone 10 pre-live authority with exact 6/30/150 candidate plans, two
unselected dated profiles, a live-blocked readiness policy, and synthetic
materialization proofs. Live calibration failed, neither profile was selected,
and repository interviews are deferred as optional future enrichment. The
repository still has no live provider configuration, materialized live
selection, real pre-live authorization, approved retention or pricing
authority, selected model or Gate A result, Agent Skill, scanner, MCP server,
shared retrieval service, production ranking, target-codebase-conditioned fit,
adoption recommendation, continuous crawler, deployment, production database,
or product release. Phase 7 is governed by
[Plan 0017](docs/plans/0017-evidence-grounded-repository-interviews.md) and
[ADR 0007](docs/architecture/decisions/0007-evidence-grounded-repository-interviews.md).
The strict Phase 7 materialization boundary requires a fresh complete receipt
that records migration `0004`; historical migration-`0003` receipts remain
generically parseable but cannot authorize pre-live materialization. Every
fresh migration-`0004` artifact database must first receive the exact committed
catalog provenance through the separately acknowledged catalog-only seed
boundary. That boundary writes only catalog identities and capability-family
assignments; it performs no provider collection, profiling, evidence, dossier,
artifact, or interview work. No real preparation database has been provisioned
or seeded by this correction, and fresh preparation remains pending renewed
review. Every pre-live dry-run authenticates one of the two exact committed complete model
profiles. Readiness-policy `1.0.0` can make only six-candidate calibration
eligible; Gate A and Gate B remain blocked.
The first full live catalog ingestion and its immediate refresh completed
against a dedicated ephemeral PostgreSQL 18.4 test database; the bounded
reviewed outcomes are recorded in
[`catalog/public-v1/live-completion.md`](catalog/public-v1/live-completion.md).
This is collection evidence, not a deployed or continuously fresh service. The
pilot gold is authored and proposed, not independently accepted.

The governing product scope is the
[product contract](docs/product/product-contract.md). Engineering work follows
the [engineering handbook](docs/engineering/repository-workflow.md) and the
[TypeScript workspace ADR](docs/architecture/decisions/0002-typescript-workspace-and-toolchain.md).
[ADR 0003](docs/architecture/decisions/0003-product-contract-kernel.md) owns the
product contract mechanism and package boundaries.
[ADR 0004](docs/architecture/decisions/0004-postgresql-evidence-persistence.md)
owns the PostgreSQL public-evidence storage and migration decisions.
[ADR 0005](docs/architecture/decisions/0005-public-repository-ingestion.md)
owns the curated catalog, provider, profiling, refresh, and receipt decisions.
[ADR 0006](docs/architecture/decisions/0006-immutable-repository-artifacts.md)
owns immutable public artifacts, lossless chunks, closed artifact sets, and
their operator.
[ADR 0007](docs/architecture/decisions/0007-evidence-grounded-repository-interviews.md)
owns the candidate-owned semantic interview, provider/application, evaluation,
persistence, and offline operator boundaries. Its retained engine does not make
repository interviews a prerequisite for retrieval or ranking.
[Plan 0019](docs/plans/0019-artifact-first-retrieval-foundation.md) and accepted
[ADR 0008](docs/architecture/decisions/0008-artifact-first-retrieval-foundation.md)
govern the Phase 8 artifact-first deterministic profile, controlled taxonomy,
pre-contract query-normalization, and retrieval-evaluation foundation. Phase 8
now includes the exact 27-field deterministic profile registry, two additive
profile contract roots, an offline generated 150-candidate authority, an
aggregate coverage report, and conservative single-candidate constraint
evaluation. It also contains the separate immutable `retrieval-v1` authority:
30 retrieval and 20 normalization/adversarial blind cases, physically separate
case-classification audit metadata and proposed gold, a blind-only
baseline loader, generated 150-candidate hard-filter projections, closed
prediction/report schemas, deterministic scorer fixtures, three offline
ordinary baselines, weak/safety controls, a synthetic oracle, and one
reproducible aggregate/per-family content-free baseline report. The profile and
evaluation authorities are not production-readiness or retrieval-quality
claims; relevance and hard-filter audit provenance remains
proposed/not-reviewed. Baseline predictions freeze before gold-bearing corpus
loading, and shared-normalization metrics are not independent achievements.
Phase 8 does not implement production retrieval or ranking. Milestone 6 is
accepted at `ea27f11432513ec352ce43821eb95b8da0886182`. Milestone 7A contains
only the effect-denied controlled profile-materialization implementation and
fake-effect tests. Its corrected design binds both future collections to the
existing runtime-role evidence/snapshot persistence, reconciles unchanged
source records byte-for-byte, and disposes the exact container before its
network. Milestone 7B, Docker/database/provider execution, and live completion
evidence remain separately authorized.

[Plan 0021](docs/plans/0021-production-retrieval.md) and accepted
[ADR 0009](docs/architecture/decisions/0009-production-retrieval.md) govern the
independently accepted Project Phase 9 implementation, corresponding to the
original strategy's Phase 11 retrieval engine. Independently reviewed
`retrieval-v2` is the governing evaluation authority, and the final quality,
safety, determinism, architecture, security, performance, and memory gates all
passed. Phase 9 implements retrieval only. Production ranking,
target-codebase-conditioned fit, adoption recommendation, scanner, API/MCP,
Agent Skill, persistent or vector search, shared retrieval service, and
deployment remain unimplemented.

[Plan 0032](docs/plans/0032-codebase-conditioned-ranking.md), governing
[Issue #32](https://github.com/kgudipati/gitblocks/issues/32), and accepted
[ADR 0011](docs/architecture/decisions/0011-codebase-conditioned-ranking.md)
establish the Project Phase 10 ranking boundary, corresponding to the
original strategy's Phase 12 ranking engine. Phase 10 will rank only the
bounded Phase 9 result for a particular authoritative target fingerprint,
preserve the existing fit-assessment semantics, and use deterministic
evidence-grounded partial ordering rather than retrieval score, popularity,
universal repository scores, or numeric confidence. Accepted
[ADR 0012](docs/architecture/decisions/0012-separate-deterministic-extraction-from-full-closure.md)
adds only the pre-live candidate-authority source/rule architecture. Realized
readiness is unmeasured; no live candidate authority, ranking package, service,
model, or ranking infrastructure exists, and live collection remains
separately unauthorized.

## Repository map

| Path                                     | Purpose                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `README.md`                              | Product orientation and honest project status                                    |
| `AGENTS.md`                              | Concise durable instructions for coding agents                                   |
| `PLANS.md`                               | Required structure and lifecycle for substantial execution plans                 |
| `CONTRIBUTING.md`                        | Issue-to-merge contributor workflow                                              |
| `SECURITY.md`                            | Private vulnerability-reporting and disclosure policy                            |
| `docs/product/`                          | Product contract, vocabulary, evaluation scope, and success criteria             |
| `docs/architecture/`                     | System context and architecture decisions                                        |
| `docs/engineering/`                      | Repository, development, testing, security, reliability, and completion policies |
| `docs/evaluation/`                       | Case authoring, deterministic scoring, and future baseline protocols             |
| `docs/plans/`                            | Active and historical version-controlled execution plans                         |
| `packages/domain/`                       | Pure product vocabulary, constructors, canonicalization, and invariants          |
| `packages/contracts/`                    | Versioned DTO schemas, safe parsers, domain mapping, and schema exports          |
| `packages/persistence/`                  | Injected PostgreSQL adapter, checked public-evidence migrations, and DB tests    |
| `packages/ingestion/`                    | Bounded public providers, deterministic profiles/refresh, operator, and tests    |
| `packages/interviews/`                   | Interview schema, prompt/mapping, application, and provider core                 |
| `packages/retrieval/`                    | Pure bounded deterministic candidate retrieval with separate result lanes        |
| `apps/repository-interview-operator/`    | Explicit offline composition, policy, receipt, and process ports                 |
| `tools/repository-interview-prelive/`    | Content-free pre-live validation and future receipt/database materialization     |
| `verification/repository-interviews-v1/` | Exact offline plans, profiles, readiness, report, and manifest authority         |
| `catalog/public-v1/`                     | Curator-owned repository source and deterministically digested public manifest   |
| `catalog/capability-taxonomy/1.0.0/`     | Reviewed taxonomy source and generated versioned capability authority            |
| `verification/retrieval-v1/`             | Content-free deterministic profile coverage and baseline reports                 |
| `evals/pilot-v1/`                        | Ten blind inputs, bounded evidence sets, separate proposed gold, and manifest    |
| `evals/retrieval-v1/`                    | Fifty blind retrieval/query cases with physically separate proposed gold         |
| `schemas/evaluation/`                    | Versioned JSON Schema 2020-12 evaluation contracts                               |
| `tools/evaluation-harness/`              | Private bounded validator, deterministic scorer, CLI, and tests                  |
| `tools/repository-checks/`               | Bounded repository-policy CLI and tests                                          |
| `.github/`                               | Intake templates, read-only CI, and dependency update policy                     |

## Local development

Use Node.js `>=24.12.0 <25`; [`.node-version`](.node-version) is the
cross-tool and CI pin, and [`.nvmrc`](.nvmrc) mirrors it for nvm. Both select
Node 24.18.0. With nvm, use:

```bash
nvm install
nvm use
corepack enable pnpm
pnpm install --frozen-lockfile
pnpm verify
```

nvm is optional. Another version manager is acceptable when the active Node
process satisfies the supported range. `pnpm verify` starts with the
dependency-free runtime preflight, which checks the actual process, both pin
files, and direct TypeScript execution before other verification. Run
`node tools/runtime-preflight.mjs --show-success` when an explicit success
message is useful.

Corepack reads the exact pnpm 11.17.0 pin and integrity digest from
`package.json`; `pnpm --version` must report `11.17.0`. Do not use npm or Yarn,
hand-edit `pnpm-lock.yaml`, or bypass the runtime or supply-chain settings.

| Command                                        | Purpose                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `pnpm runtime:check`                           | Quietly validate the active Node process and repository pin         |
| `pnpm format:check`                            | Check formatting without changing files                             |
| `pnpm lint`                                    | Run typed ESLint with zero warnings                                 |
| `pnpm typecheck`                               | Build required product/tool outputs, then type-check all workspaces |
| `pnpm build`                                   | Emit the private product and tooling packages                       |
| `pnpm test`                                    | Run the protected deterministic Vitest suite                        |
| `pnpm test:coverage`                           | Record the V8 coverage baseline                                     |
| `pnpm architecture:check`                      | Enforce dependency directions                                       |
| `pnpm repo:check`                              | Validate workflows, Markdown, and repository invariants             |
| `pnpm eval:validate`                           | Validate the corpus, hashes, references, and diversity              |
| `pnpm eval:score --prediction <path>`          | Score one prediction file or a complete directory                   |
| `pnpm eval:fixtures`                           | Exercise deterministic weak fixture profiles                        |
| `pnpm eval:retrieval:validate`                 | Validate retrieval-v1 authority and generated hard-filter closure   |
| `pnpm eval:retrieval:fixtures`                 | Run hand-calculated retrieval scorer fixtures                       |
| `pnpm eval:retrieval:baselines`                | Print the deterministic content-free baseline report without writes |
| `pnpm eval:retrieval:baselines:generate`       | Explicitly write only the fixed baseline report path                |
| `pnpm eval:retrieval:verify`                   | Read-only reproduce and drift-check baselines and report            |
| `pnpm eval:retrieval:score -- …`               | Validate and score one repository-relative prediction set           |
| `pnpm contracts:validate`                      | Validate schemas and all ten corpus-to-product mappings             |
| `pnpm taxonomy:validate`                       | Validate taxonomy source, invariants, ordering, digest, and drift   |
| `pnpm taxonomy:generate`                       | Explicitly regenerate the reviewed taxonomy authority               |
| `pnpm profiles:validate`                       | Validate offline profiles, coverage, digests, closure, and drift    |
| `pnpm profiles:generate`                       | Explicitly regenerate the two fixed profile artifacts               |
| `pnpm profiles:materialization:preflight -- …` | Read-only validate every future controlled live argument            |
| `pnpm profiles:materialization:execute -- …`   | Separately authorized atomic live proof; do not run in 7A           |
| `pnpm profiles:materialization:verify`         | Read-only validate future fixed 7B evidence                         |
| `pnpm db:migrate`                              | Apply checked forward migrations to an acknowledged test DB         |
| `pnpm db:check`                                | Verify migration history, public schema, roles, and indexes         |
| `pnpm db:test`                                 | Run PostgreSQL integration and conformance tests                    |
| `pnpm db:verify`                               | Provision pinned PostgreSQL and run all database checks             |
| `pnpm catalog:validate`                        | Validate catalog bounds, balance, identity, paths, and digest       |
| `pnpm catalog:seed -- --catalog …`             | Seed exact catalog provenance into an acknowledged ephemeral DB     |
| `pnpm artifacts:validate`                      | Validate public artifact selections, coverage, and digest           |
| `pnpm artifacts:test`                          | Run deterministic artifact manifest, collector, and receipt tests   |
| `pnpm artifacts:verify`                        | Run complete offline artifact verification                          |
| `pnpm artifacts:live`                          | Run the separately acknowledged public-artifact operator            |
| `pnpm artifacts:receipt`                       | Validate and compare content-free artifact receipts                 |
| `pnpm ingestion:test`                          | Run deterministic ingestion adapter and profile tests               |
| `pnpm ingestion:verify`                        | Run catalog and ingestion offline verification                      |
| `pnpm operator:interviews`                     | Require complete explicit acknowledged operator configuration       |
| `pnpm operator:interviews:verify`              | Verify operator schemas, tests, architecture, and test PostgreSQL   |
| `pnpm interviews:prelive:validate`             | Reproduce committed pre-live authorities read-only                  |
| `pnpm interviews:prelive:verify`               | Run offline, denial, scale, operator, evaluation, and DB proofs     |
| `pnpm interviews:prelive:materialize`          | Future explicit fresh-receipt/same-database materialization         |
| `pnpm security:secrets`                        | Scan tracked development content for secrets                        |
| `pnpm security:audit`                          | Run the online registry dependency audit                            |
| `pnpm verify`                                  | Run one preflight plus authoritative offline verification           |
| `pnpm verify:ci`                               | Run `verify`, audit, and real PostgreSQL verification               |

Contract and evaluation commands are offline and do not execute candidate code
or call a model. Product schemas are deterministic JSON Schema 2020-12 runtime
exports derived from the same TypeBox definitions as their TypeScript DTO
types; they are not a second handwritten artifact. `pnpm db:verify` requires
Docker when no explicitly acknowledged ephemeral PostgreSQL test database is
injected; it uses the exact image recorded by ADR 0004, creates no persistent
volume, and cleans up the container. Ordinary `pnpm verify` remains
database-independent, while hosted `verify:ci` cannot skip PostgreSQL
verification. There is no development service or deployment command because
product services remain unimplemented. `pnpm ingest:live` is a separate
credential-injected operator command requiring explicit manifest, receipt,
database configuration, and non-production acknowledgement.
`pnpm artifacts:live` is a distinct credential-injected operator command with
its own stronger acknowledgement, explicit catalog and artifact-manifest
paths, ephemeral non-production database scope, and content-free receipt. It
remains an explicitly authorized non-production operation. The Phase 6
controlled live proof is recorded in
[`artifact-completion.md`](catalog/public-v1/artifact-completion.md); production
deployment is not authorized.
`pnpm catalog:seed` is the separate no-provider preparation boundary that must
run after exact migration-0004 verification and before `pnpm artifacts:live`
against a fresh artifact database. It requires an explicit catalog path,
ephemeral non-production acknowledgement, and discrete PostgreSQL settings.
It never applies migrations or reads GitHub/OpenAI credentials. A failed seed
makes that ephemeral database ineligible for preparation and it must be
discarded rather than repaired in place.
