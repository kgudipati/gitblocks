# Repository workflow

## Purpose and activation

GitBlocks uses [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow)
to keep `main` releasable and changes attributable, reviewable, and easy to
recover. The branch, issue, plan, commit, pull-request (PR), and review rules in
this document apply now. Automated checks and a GitHub ruleset become
enforcement mechanisms when separately introduced; until then, authors and
reviewers enforce the rules.

## One coherent outcome

One issue describes one coherent user or engineering outcome, its scope,
acceptance criteria, risks, and non-goals. A change must not bundle unrelated
cleanup, experiments, dependency updates, or scaffolding. If a phase is too
large for meaningful review or safe recovery, split it into independently
valuable vertical slices with linked issues.

Substantial or cross-cutting work requires a version-controlled execution plan
that follows [PLANS.md](../../PLANS.md). The plan is part of the change and must
record discoveries, decisions, progress, and exact validation evidence.

## Branches

Create a short-lived topic branch from current `main`:

```text
<type>/<issue-number>-<short-kebab-description>
```

Allowed types are `feat`, `fix`, `docs`, `refactor`, `test`, `perf`, `build`,
`ci`, `chore`, `security`, and `spike`.

Branch names must:

- contain lowercase ASCII letters, digits, and hyphens only, apart from the
  single required `/`;
- contain exactly one `/`;
- use the decimal GitHub issue number;
- describe the outcome with a specific hyphenated slug;
- contain no spaces, personal names, dates, or vague terms such as `changes`,
  `updates`, `misc`, or `work`; and
- normally remain under 60 characters. A longer name needs a reviewer-visible
  reason and must still be unambiguous.

Valid examples:

```text
docs/1-project-foundation
feat/24-repository-profiler
security/112-webhook-signature-validation
```

Invalid examples include `karthik/new-feature`, `feature/foo`,
`feat/24_changes`, `feat/2026-07-27-profiler`, and
`feat/24/repository-profiler`.

Branches must be based on a fast-forward-current `main`; they must not become
long-lived integration branches. GitBlocks has no `develop` branch. Introducing
one requires a future ADR demonstrating why short-lived branches and stacked
PRs cannot meet the need.

`spike` branches may produce measurements, disposable prototypes, and a
decision record. They must not merge experimental production code directly.
Validated behavior is reimplemented, tested, and reviewed through a normal
scoped branch.

## Commits and PR titles

Commits and PR titles follow
[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):

```text
<type>[optional scope][!]: <imperative description>
```

- Use one allowed branch type as the commit type except that `security` work
  uses the most accurate conventional type and explains security impact in the
  body.
- Keep the subject specific, lowercase after the colon, and free of a trailing
  period.
- Use `!` and a `BREAKING CHANGE:` footer for an intentionally incompatible
  public-contract change.
- Explain motivation, user impact, material alternatives, and issue references
  in the body or footer when the subject is insufficient.
- Do not use vague messages such as `fix stuff`, `updates`, or `phase 2`.

Examples:

```text
docs: establish GitBlocks product and engineering foundations
feat(profiler): detect Prisma and Drizzle versions
fix(webhooks): reject replayed delivery identifiers
```

Once a public API, event, persisted contract, Skill contract, or MCP contract
exists, releases follow
[Semantic Versioning 2.0.0](https://semver.org/). A contract's compatibility
policy and deprecation window must be documented before its first public
release; a commit label alone does not establish compatibility.

## Draft pull requests

Open an issue-linked draft PR early enough to expose direction and risk, but
only after the branch contains a reviewable description or first coherent
slice. The PR title follows Conventional Commits and the body uses the
repository template.

Every PR must:

- link the governing issue using a closing keyword when appropriate;
- state purpose, scope, explicit non-goals, user impact, and current status;
- identify contract, architecture, security/privacy, test, observability,
  migration, compatibility, rollout, and recovery impact;
- contain exact validation commands and outcomes, not only “CI passed”;
- disclose skipped checks, residual risks, and follow-up issues;
- remain small enough for every changed line and its context to be reviewed;
  and
- update its execution plan as implementation discoveries change the work.

Draft status is not permission to bypass scope, security, or secret-handling
rules. A draft becomes ready only after the
[definition of done](definition-of-done.md) is met or the PR explicitly
identifies which merge-blocking evidence is still pending.

## Review standard

Review is a design and code-health control, not a confirmation that automated
checks are green. Reviewers inspect every changed line and relevant surrounding
context for:

- product correctness and the stated user outcome;
- consistency with contracts, ADRs, dependency direction, and non-goals;
- functionality, failure modes, naming, comments, documentation, and
  compatibility;
- simplicity, meaningful abstractions, bounded work, performance, scalability,
  and resource use;
- test design and whether tests would detect the relevant failure;
- authentication, authorization, tenant isolation, injection, secrets,
  privacy, supply-chain, approval, and abuse risks;
- telemetry, diagnosis, reliability, migration, rollout, and recovery; and
- internal and external documentation-link accuracy.

A reviewer must request a smaller PR when size prevents a meaningful review.
Formatting-only churn and unrelated refactoring belong in separate changes
unless they are inseparable from the outcome. Review findings are resolved in
code or durable documentation; important rationale must not live only in a PR
conversation.

## Validation and merge

Before merge, the author rebases or updates from `main` without rewriting
shared history, runs the plan's exact local checks, records results in the PR,
and resolves review threads. Once CI exists, required checks must pass for the
final reviewed commit.

Merge into `main` by squash after required approvals and checks pass. The squash
message uses the approved Conventional Commit PR title. Delete the source
branch after merge. Never push directly to `main`, force-push a shared branch,
bypass required checks, self-approve where independent approval is required,
or merge with unresolved material findings.

An emergency exception must be authorized by a maintainer, limited to the
smallest risk-reducing change, retain audit history, and create a follow-up
issue for omitted evidence. “Urgent” does not authorize secret exposure,
history rewrite, or known unsafe behavior.

## Repository ruleset roadmap

This issue documents but does not configure repository settings. When GitHub
rulesets are introduced, the `main` ruleset must:

- require a PR before merge;
- require all designated status checks on the reviewed commit;
- require review and resolution of material conversations;
- allow squash merge and maintain linear history;
- block force pushes; and
- prohibit deletion of `main`.

Bypass access must be least privilege, auditable, and reserved for documented
emergency recovery. Ruleset configuration and evidence of enforcement require
a separate authorized issue.

## Compliance evidence

For every merged change, the issue, plan when required, branch name, commit
history, PR body, review record, check results, and squash commit together form
the workflow evidence. A reviewer blocks merge when any required artifact is
missing or contradictory.
