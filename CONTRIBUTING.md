# Contributing to GitBlocks

GitBlocks accepts focused, evidence-backed changes through GitHub Flow. The
project currently provides repository engineering tooling, a pure product
domain/contract kernel, and a concrete PostgreSQL persistence adapter, but no
product service or application implementation.

## Before starting

1. Read the [product contract](docs/product/product-contract.md), applicable
   [architecture decisions](docs/architecture/decisions/), and
   [engineering handbook](docs/engineering/).
2. Search existing issues and open or select one coherent outcome. Do not use a
   public issue for a vulnerability; follow [SECURITY.md](SECURITY.md).
3. Confirm the issue's scope, acceptance criteria, non-goals, and authority
   before editing. Inspect the actual repository and history.
4. For substantial work, create the issue-linked plan required by
   [PLANS.md](PLANS.md) and have it describe verifiable milestones, risks, and
   exact checks.

## Bootstrap and verification

Use Node.js `>=24.12.0 <25`. `.node-version` is the cross-tool and CI pin;
`.nvmrc` mirrors it for nvm. The preferred nvm flow is:

```bash
nvm install
nvm use
corepack enable pnpm
pnpm install --frozen-lockfile
pnpm verify
```

nvm is not mandatory. Another version manager is valid when the active process
matches the repository requirement. `pnpm verify` begins with
`pnpm runtime:check`, which validates the actual Node process, pin agreement,
and direct TypeScript capability before TypeScript-backed tooling starts.

The selected Node pin is 24.18.0 and `pnpm --version` must report `11.17.0`.
Before publication, also run the online audit graph:

```bash
pnpm verify:ci
```

`pnpm verify` is deterministic and requires no credentials or live provider.
`pnpm verify:ci` adds the registry-backed dependency audit and the real
PostgreSQL verification graph, and fails if either cannot be completed. Run
`pnpm db:verify` directly for persistence or migration work; it provisions the
pinned ephemeral database unless an acknowledged test database is injected.
Never aim these commands at a production database. Never hand-edit
`pnpm-lock.yaml` or weaken the runtime preflight or workspace supply-chain
policy to make installation pass.

## Issue to merge workflow

### 1. Issue

Use the phase form for a planned development outcome or the bug form for a
reproducible defect. One issue owns one coherent result. Link adjacent work
rather than expanding scope.

### 2. Plan

Write the plan before implementation when required. Keep it current as
repository evidence changes assumptions, architecture, security, milestones,
or validation. Product requirements stay in the issue or product contract;
the plan maps them to implementation and evidence. Use the plan explicitly
linked from the governing issue or PR; do not infer the active plan from file
recency.

### 3. Branch

Fast-forward local `main`, then create a short-lived branch:

```text
<type>/<issue-number>-<short-kebab-description>
```

Examples include `docs/1-project-foundation`,
`feat/24-repository-profiler`, and
`security/112-webhook-signature-validation`. See the complete
[branch policy](docs/engineering/repository-workflow.md#branches).

### 4. Draft pull request

Open an issue-linked draft PR early with a Conventional Commit title and the
repository template. The body must state scope and non-goals, implementation,
contract/architecture impact, exact test evidence, security/privacy review,
operations impact, migration/recovery, limitations, and follow-ups.

Keep the diff coherent and small enough for every line to be reviewed. Do not
combine formatting churn, speculative refactoring, experiments, or production
dependencies unrelated to the issue.

### 5. Implement and test

Follow the [development standards](docs/engineering/development-standards.md),
[testing strategy](docs/engineering/testing-strategy.md), and
[security baseline](docs/engineering/security-baseline.md).

Tests are written before or alongside behavior. Reproducible bug fixes begin
with a failing regression test. Domain rules receive unit tests, contracts
receive contract tests, external adapters receive realistic integration tests,
critical journeys receive a small number of end-to-end tests, and
security-sensitive paths receive negative and abuse tests.

Evaluation corpus changes also follow the
[case-authoring protocol](docs/evaluation/case-authoring-protocol.md). Keep
fixed-candidate inputs blind, proposed gold separate, evidence dated and
attributable, and manifest hashes current. Do not install or execute candidate
code. Run `pnpm eval:validate` and `pnpm eval:fixtures`; weak fixtures are
harness checks, not performance baselines. A real baseline must follow the
[independent baseline protocol](docs/evaluation/baseline-protocol.md).

Follow
[ADR 0002](docs/architecture/decisions/0002-typescript-workspace-and-toolchain.md)
for the active formatter, linter, strict compiler settings, dependency
boundaries, generated-code policy, and exact verification commands. A future
product framework or additional production dependency still requires explicit
issue and architecture authority. Product contract work must also follow
[ADR 0003](docs/architecture/decisions/0003-product-contract-kernel.md):
`tools/evaluation-harness` may depend on `packages/contracts`, contracts may
depend on the pure domain, and neither product package may import evaluation
records or tooling.

Persistence work must follow
[ADR 0004](docs/architecture/decisions/0004-postgresql-evidence-persistence.md).
The adapter depends inward on contracts and domain; future application-owned
ports must not import the concrete adapter. Migrations are deterministic,
checksummed, forward-only SQL and are never applied implicitly. PostgreSQL
integration tests use a non-owner runtime role and prove immutable public
insertion, evidence-world cutoffs, append-only lifecycle behavior, active
reference closure, and exact historical snapshot reconstruction. Phase 4 does
not implement tenant-private storage, expiry, purge, deletion, tombstones, or
RLS.

Run `pnpm contracts:validate` when changing a product contract, its runtime
JSON Schema export, or the evaluation-to-product mapping. This conformance
check proves that all ten pilot cases map without losing decision-relevant
fields and that proposed gold is representable; it neither scores quality nor
changes the gold's proposed/not-reviewed status.

### 6. Review and validation

Run every exact command in the plan and record the outcome in the plan and PR.
At minimum run `pnpm verify`, inspect status and the complete diff, run
`git diff --check`, verify links and required files, and search for secrets,
prohibited content, and untracked work. Persistence changes additionally
require `pnpm db:verify`. Run `pnpm verify:ci` before publication when registry
and PostgreSQL infrastructure are available. Hosted CI must exercise its
pinned PostgreSQL service without skipping. If a tool is unavailable, record
that and use the strongest deterministic existing alternative; do not install
an unpinned validator just to satisfy a checkbox.

Authors and reviewers apply the
[definition of done](docs/engineering/definition-of-done.md). Review covers
product behavior, design, simplicity, naming, comments, tests, security,
privacy, performance, observability, operability, compatibility, and
documentation—not only whether checks pass.

### 7. Merge

An unpublished local topic branch may be rebased onto current `main`. After a
branch is pushed or attached to a PR, treat it as shared history: do not rebase
or force-push it. Bring a shared branch current with a normal merge from `main`
or GitHub's merge-based branch-update operation, then rerun every required
check and update the recorded evidence.

After required review and final checks, squash merge through GitHub using the
approved Conventional Commit PR title, then delete the topic branch. Keep
`main` releasable. Never push directly to `main`, bypass required checks, or
merge unresolved material findings.

## Communication

Write issues, plans, commits, and reviews for a future contributor who lacks
private context. Cite evidence, label inference and unknowns, explain the reason
for a blocking finding, and move durable decisions into contracts, ADRs, or
handbook documentation.
