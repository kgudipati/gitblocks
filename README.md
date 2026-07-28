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
now contains an exactly pinned TypeScript workspace and deterministic
repository verification tooling. It has no application scaffold, production
dependency, Agent Skill, scanner, MCP server, backend, database, ranking
engine, deployment, or product release.

The governing product scope is the
[product contract](docs/product/product-contract.md). Engineering work follows
the [engineering handbook](docs/engineering/repository-workflow.md) and the
[TypeScript workspace ADR](docs/architecture/decisions/0002-typescript-workspace-and-toolchain.md).

## Repository map

| Path                       | Purpose                                                                          |
| -------------------------- | -------------------------------------------------------------------------------- |
| `README.md`                | Product orientation and honest project status                                    |
| `AGENTS.md`                | Concise durable instructions for coding agents                                   |
| `PLANS.md`                 | Required structure and lifecycle for substantial execution plans                 |
| `CONTRIBUTING.md`          | Issue-to-merge contributor workflow                                              |
| `SECURITY.md`              | Private vulnerability-reporting and disclosure policy                            |
| `docs/product/`            | Product contract, vocabulary, evaluation scope, and success criteria             |
| `docs/architecture/`       | System context and architecture decisions                                        |
| `docs/engineering/`        | Repository, development, testing, security, reliability, and completion policies |
| `docs/plans/`              | Active and historical version-controlled execution plans                         |
| `tools/repository-checks/` | Bounded repository-policy CLI and tests                                          |
| `.github/`                 | Intake templates, read-only CI, and dependency update policy                     |

## Local development

Use Node.js `>=24.12.0 <25`; [`.node-version`](.node-version) selects the
current pin, Node 24.18.0. Corepack reads the exact pnpm 11.17.0 pin and
integrity digest from `package.json`.

```bash
corepack enable pnpm
pnpm --version
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm --version` must report `11.17.0`. Do not use npm or Yarn, hand-edit
`pnpm-lock.yaml`, or bypass the supply-chain settings in
`pnpm-workspace.yaml`.

| Command                   | Purpose                                                 |
| ------------------------- | ------------------------------------------------------- |
| `pnpm format:check`       | Check formatting without changing files                 |
| `pnpm lint`               | Run typed ESLint with zero warnings                     |
| `pnpm typecheck`          | Type-check source and tests without emitting            |
| `pnpm build`              | Emit the private repository-checks package              |
| `pnpm test`               | Run the deterministic Vitest suite                      |
| `pnpm test:coverage`      | Record the V8 coverage baseline                         |
| `pnpm architecture:check` | Enforce dependency directions                           |
| `pnpm repo:check`         | Validate workflows, Markdown, and repository invariants |
| `pnpm security:secrets`   | Scan tracked development content for secrets            |
| `pnpm security:audit`     | Run the online registry dependency audit                |
| `pnpm verify`             | Run the authoritative offline verification graph        |
| `pnpm verify:ci`          | Run `verify` plus the online dependency audit           |

There is no development service, application build, or deployment command
because product services remain unimplemented.
