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
now contains an exactly pinned TypeScript workspace, deterministic repository
verification tooling, a proposed ten-case evaluation pilot for
repository-conditioned adoption fit over fixed candidate sets, and the first
production-owned packages: a pure domain, versioned contracts, and a
PostgreSQL persistence adapter for durable catalog identities, immutable
evidence, reproducible dossier snapshots, row isolation, retention, and tenant
deletion. These packages do not implement a use case or service. The repository
still has no application scaffold, Agent Skill, scanner, MCP server,
operational backend, ingestion, discovery or product ranking engine,
deployment, production database, or product release. The pilot gold is
authored and proposed, not independently accepted.

The governing product scope is the
[product contract](docs/product/product-contract.md). Engineering work follows
the [engineering handbook](docs/engineering/repository-workflow.md) and the
[TypeScript workspace ADR](docs/architecture/decisions/0002-typescript-workspace-and-toolchain.md).
[ADR 0003](docs/architecture/decisions/0003-product-contract-kernel.md) owns the
product contract mechanism and package boundaries.
[ADR 0004](docs/architecture/decisions/0004-postgresql-evidence-persistence.md)
owns the PostgreSQL storage, migration, row-isolation, and retention decisions.

## Repository map

| Path                        | Purpose                                                                          |
| --------------------------- | -------------------------------------------------------------------------------- |
| `README.md`                 | Product orientation and honest project status                                    |
| `AGENTS.md`                 | Concise durable instructions for coding agents                                   |
| `PLANS.md`                  | Required structure and lifecycle for substantial execution plans                 |
| `CONTRIBUTING.md`           | Issue-to-merge contributor workflow                                              |
| `SECURITY.md`               | Private vulnerability-reporting and disclosure policy                            |
| `docs/product/`             | Product contract, vocabulary, evaluation scope, and success criteria             |
| `docs/architecture/`        | System context and architecture decisions                                        |
| `docs/engineering/`         | Repository, development, testing, security, reliability, and completion policies |
| `docs/evaluation/`          | Case authoring, deterministic scoring, and future baseline protocols             |
| `docs/plans/`               | Active and historical version-controlled execution plans                         |
| `packages/domain/`          | Pure product vocabulary, constructors, canonicalization, and invariants          |
| `packages/contracts/`       | Versioned DTO schemas, safe parsers, domain mapping, and schema exports          |
| `packages/persistence/`     | Injected PostgreSQL adapter, checked migrations, row isolation, and DB tests     |
| `evals/pilot-v1/`           | Ten blind inputs, bounded evidence sets, separate proposed gold, and manifest    |
| `schemas/evaluation/`       | Versioned JSON Schema 2020-12 evaluation contracts                               |
| `tools/evaluation-harness/` | Private bounded validator, deterministic scorer, CLI, and tests                  |
| `tools/repository-checks/`  | Bounded repository-policy CLI and tests                                          |
| `.github/`                  | Intake templates, read-only CI, and dependency update policy                     |

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

| Command                               | Purpose                                                     |
| ------------------------------------- | ----------------------------------------------------------- |
| `pnpm runtime:check`                  | Quietly validate the active Node process and repository pin |
| `pnpm format:check`                   | Check formatting without changing files                     |
| `pnpm lint`                           | Run typed ESLint with zero warnings                         |
| `pnpm typecheck`                      | Type-check product packages, tooling, and tests             |
| `pnpm build`                          | Emit the private product and tooling packages               |
| `pnpm test`                           | Run the protected deterministic Vitest suite                |
| `pnpm test:coverage`                  | Record the V8 coverage baseline                             |
| `pnpm architecture:check`             | Enforce dependency directions                               |
| `pnpm repo:check`                     | Validate workflows, Markdown, and repository invariants     |
| `pnpm eval:validate`                  | Validate the corpus, hashes, references, and diversity      |
| `pnpm eval:score --prediction <path>` | Score one prediction file or a complete directory           |
| `pnpm eval:fixtures`                  | Exercise deterministic weak fixture profiles                |
| `pnpm contracts:validate`             | Validate schemas and all ten corpus-to-product mappings     |
| `pnpm db:migrate`                     | Apply checked forward migrations to an acknowledged test DB |
| `pnpm db:check`                       | Verify migration history, roles, and forced row isolation   |
| `pnpm db:test`                        | Run PostgreSQL integration and conformance tests            |
| `pnpm db:verify`                      | Provision pinned PostgreSQL and run all database checks     |
| `pnpm security:secrets`               | Scan tracked development content for secrets                |
| `pnpm security:audit`                 | Run the online registry dependency audit                    |
| `pnpm verify`                         | Run one preflight plus authoritative offline verification   |
| `pnpm verify:ci`                      | Run `verify`, audit, and real PostgreSQL verification       |

Contract and evaluation commands are offline and do not execute candidate code
or call a model. Product schemas are deterministic JSON Schema 2020-12 runtime
exports derived from the same TypeBox definitions as their TypeScript DTO
types; they are not a second handwritten artifact. `pnpm db:verify` requires
Docker when no explicitly acknowledged ephemeral PostgreSQL test database is
injected; it uses the exact image recorded by ADR 0004, creates no persistent
volume, and cleans up the container. Ordinary `pnpm verify` remains
database-independent, while hosted `verify:ci` cannot skip PostgreSQL
verification. There is no development service or deployment command because
product services remain unimplemented.
