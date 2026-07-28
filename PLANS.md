# GitBlocks execution plans

## Purpose

A GitBlocks execution plan is a version-controlled, reviewable record of how a
substantial change will reach a verifiable user or engineering outcome. It is a
living control surface for scope, architecture, risk, progress, decisions, and
evidence—not disposable pre-work.

A plan must be understandable by a contributor with the repository and linked
issue but without private conversation history.

## When a plan is required

Create a plan for a change that is cross-cutting, multi-milestone, security- or
privacy-sensitive, migrates data or a public contract, adds a trust boundary or
deployment, selects a technology, spans multiple reviewable slices, or is
explicitly required by its issue.

A narrowly scoped documentation or maintenance change may omit a separate plan
only when the issue and PR already contain equivalent scope, risk, validation,
and recovery detail. The reviewer may require a plan whenever execution or
verification is otherwise ambiguous.

Store plans as:

```text
docs/plans/<zero-padded-issue-number>-<short-kebab-description>.md
```

For example, Issue #24 uses
`docs/plans/0024-repository-profiler.md`. One active issue has one authoritative
plan; supporting design documents are linked, not competing plans.

## Required sections

Every substantial plan contains all sections below. Use “not applicable” only
with a reason tied to the current change.

### Status and authority

Record the issue, branch, owner when known, state, and last-updated date. State
which issue, contract, ADR, or repository artifact wins if requirements
conflict. Link rather than duplicating detailed issue text.

### Purpose and user-visible outcome

Describe the observable result and who benefits. Distinguish the current state,
the approved result of this plan, later planned behavior, and open decisions.

### Verified current repository state

Inspect before proposing. Record the current branch, worktree state, relevant
history, existing implementation and tests, configuration, contracts, active
ADRs, and available commands. Include the commands or artifacts that support
the claims. Do not assume a phase description matches the checkout.

### Scope and explicit non-goals

List the behavior, components, documents, migrations, and operations the plan
may change. List adjacent work it must not absorb. A later discovery expands
scope only through an updated issue/plan decision, not silently.

### Requirements crosswalk

Map every issue deliverable and acceptance criterion to its destination,
implementation milestone, and validation evidence. Keep the issue as authority;
the crosswalk provides traceability rather than restating its full prose.

### Assumptions, risks, and unresolved decisions

Separate verified facts, working assumptions, known risks, and decisions that
remain open. For each decision that can change implementation materially, name
the owner or evidence needed and the latest milestone at which it can remain
open.

### Applicable ADRs and contracts

Link and summarize the consequence of each applicable product contract, ADR,
public/persisted/event/MCP contract, and policy. State whether the plan creates,
changes, supersedes, or leaves each one untouched.

### Architecture, data-flow, and performance impact

Describe changed components, ownership, dependency direction, entry points,
side effects, versioned boundaries, and primary data flow. Identify input,
result, time, memory, cost, pagination, concurrency, timeout, cancellation,
retry, idempotency, and backpressure bounds where applicable.

Use a diagram only when it clarifies three or more components or a
trust/sequence relationship. Mark future components and do not let diagrams
contradict prose.

### Security, privacy, abuse, and supply-chain considerations

Identify assets, actors, trust boundaries, untrusted inputs, authentication,
object/action authorization, tenant isolation, prompt-injection paths,
destructive/external-write approvals, data classification/minimization,
redaction, retention/deletion, secret handling, webhook behavior, audit
evidence, dependencies, CI actions, build provenance, abuse cases, and residual
risk. Explicitly preserve the prohibition on executing ingested repository
code.

### Implementation milestones

Divide work into independently verifiable coherent slices. Each milestone names
the files/contracts affected, user-visible or architectural result, test-first
or test-alongside work, validation, and completion evidence. Do not use
percentages or vague tasks such as “implement backend.”

### Testing and validation strategy

Define the unit, contract, integration, end-to-end, negative/abuse, property,
fuzz, load, resilience, and model-evaluation coverage warranted by risk. State
fixtures, controlled time/randomness, realistic external verification, and the
failing regression test for a reproducible bug.

List exact commands with working directory, required environment, expected
exit/result, and any unavailable-tool alternative. Include formatting, lint,
strict type/compiler, build, tests, security, migrations, documentation,
links, generated drift, and diff/whitespace checks as applicable.

### Observability and operations

Name stable operations/errors, traces, metrics, logs, audit events, redaction,
cardinality bounds, dashboards, alerts, worker attempt/retry/dead-letter
signals, health/readiness, SLOs, runbooks, and incident diagnosis affected by
the change. State why this is not applicable for a path that cannot run in a
shared or production environment.

### Migration, compatibility, rollout, and recovery

Describe public/persisted contract compatibility, mixed-version behavior,
backfill, rollout slices, feature exposure, verification, rollback, and
forward recovery. Identify irreversible steps and approvals. “No migration”
must be justified when contracts or stored data change.

### Exact exit criteria

Define observable conditions required before completion: delivered scope,
passing evidence, compatibility and recovery state, documentation/ADR updates,
resolved review, no prohibited content, and required publication state. Exit
criteria do not say only “acceptance criteria pass.”

### Progress log

Append dated entries as milestones begin or complete, including evidence and
blockers. Update checkboxes and status in the same change as the work; do not
reconstruct the log only at the end.

### Decision and deviation log

Record material implementation decisions, rejected options, discoveries that
alter the plan, scope/validation deviations, reason, owner, date, and affected
artifacts. A decision that changes durable architecture updates or creates an
ADR.

### Validation evidence

Record every command or manual review, date, exit/result, material output,
failure resolved, and skipped/unavailable validation with the strongest
deterministic alternative. Include complete diff and acceptance/security
self-review. Do not replace exact evidence with “all checks passed.”

## Plan lifecycle

1. Verify the repository and issue before editing.
2. Write the initial plan before implementation.
3. Review scope, trust boundaries, contracts, milestones, and exact checks.
4. Update the plan while implementing whenever evidence changes an assumption,
   decision, milestone, risk, or command.
5. Record failed checks and their resolution, not only the final pass.
6. Reconcile every issue criterion and perform independent-style product,
   architecture, security, test, operations, and compatibility review.
7. Mark complete only after exit criteria and validation evidence are true.

A plan may not claim completion because implementation “looks done,” its token
or time budget is ending, or a PR exists. Unresolved work becomes a linked issue
with owner and impact; it is not hidden in an orphan `TODO`, review comment, or
discarded plan note.
