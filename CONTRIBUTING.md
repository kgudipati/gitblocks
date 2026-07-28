# Contributing to GitBlocks

GitBlocks accepts focused, evidence-backed changes through GitHub Flow. The
project is currently a documentation and engineering-foundation repository;
there are no application install, build, or test commands yet.

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

## Issue to merge workflow

### 1. Issue

Use the phase form for a planned development outcome or the bug form for a
reproducible defect. One issue owns one coherent result. Link adjacent work
rather than expanding scope.

### 2. Plan

Write the plan before implementation when required. Keep it current as
repository evidence changes assumptions, architecture, security, milestones,
or validation. Product requirements stay in the issue or product contract;
the plan maps them to implementation and evidence.

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

Do not add a production framework, dependency, or toolchain until an accepted
stack ADR defines the formatter, linter, strict compiler/type settings,
dependency boundaries, generated-code policy, and exact commands.

### 6. Review and validation

Run every exact command in the plan and record the outcome in the plan and PR.
At minimum inspect status and the complete diff, run `git diff --check`, verify
links and required files, and search for secrets, prohibited content, and
untracked work. If a tool is unavailable, record that and use the strongest
deterministic existing alternative; do not install an unpinned validator just
to satisfy a checkbox.

Authors and reviewers apply the
[definition of done](docs/engineering/definition-of-done.md). Review covers
product behavior, design, simplicity, naming, comments, tests, security,
privacy, performance, observability, operability, compatibility, and
documentation—not only whether checks pass.

### 7. Merge

After required review and final checks, squash merge through GitHub using the
approved Conventional Commit PR title, then delete the topic branch. Keep
`main` releasable. Never push directly to `main`, force-push shared history,
bypass required checks, or merge unresolved material findings.

## Communication

Write issues, plans, commits, and reviews for a future contributor who lacks
private context. Cite evidence, label inference and unknowns, explain the reason
for a blocking finding, and move durable decisions into contracts, ADRs, or
handbook documentation.
