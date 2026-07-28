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

| Participant | Planned responsibility |
| --- | --- |
| Developer | Defines the goal and constraints; approves data sharing, candidate selection, and effects |
| Existing coding agent | Remains the interactive runtime; performs approved local edits and validation |
| GitBlocks Agent Skill | Owns the discovery procedure, safe orchestration, data minimization, evidence presentation, and plan structure |
| Local deterministic scanner | Produces a versioned codebase fingerprint from approved reads; never executes ingested code |
| GitBlocks remote MCP and backend | Own candidate discovery, catalog/evidence access, codebase-conditioned ranking, and minimized outcomes |
| GitHub and package/security sources | Provide untrusted external evidence with provenance and freshness |

See the [system context](docs/architecture/system-context.md) for planned
components, data flows, and trust boundaries.

## Current development status

GitBlocks is in its product and engineering foundation phase. This repository
currently contains documentation and repository workflow metadata only. It has
no application scaffold, package manifest, production dependency, Agent Skill,
scanner, MCP server, backend, database, ranking engine, deployment, or release.

The governing product scope is the
[product contract](docs/product/product-contract.md). Engineering work follows
the [engineering handbook](docs/engineering/repository-workflow.md) and the
[active foundation plan](docs/plans/0001-foundation.md).

## Repository map

| Path | Purpose |
| --- | --- |
| `README.md` | Product orientation and honest project status |
| `AGENTS.md` | Concise durable instructions for coding agents |
| `PLANS.md` | Required structure and lifecycle for substantial execution plans |
| `CONTRIBUTING.md` | Issue-to-merge contributor workflow |
| `SECURITY.md` | Private vulnerability-reporting and disclosure policy |
| `docs/product/` | Product contract, vocabulary, evaluation scope, and success criteria |
| `docs/architecture/` | System context and architecture decisions |
| `docs/engineering/` | Repository, development, testing, security, reliability, and completion policies |
| `docs/plans/` | Active and historical version-controlled execution plans |
| `.github/` | Pull-request and issue intake templates |

## Local development

There are no local install, build, lint, type-check, test, or run commands yet.
Do not infer commands or create a package manifest to fill this gap. A future
stack ADR must select the toolchain and replace these placeholders before
production code lands.

| Intended command | Current state |
| --- | --- |
| Install dependencies | Not implemented; no package manager or dependencies selected |
| Run a development service | Not implemented; no service exists |
| Format, lint, or type-check | Not implemented; the future stack ADR must define exact tools and versions |
| Run tests | Not implemented; no test runner or production behavior exists |
| Build or deploy | Not implemented and outside the foundation phase |

Documentation-only changes use the exact validation commands recorded in their
execution plan.
