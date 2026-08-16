# GitBlocks execution plans

## Purpose

A GitBlocks execution plan is a version-controlled, reviewable record of how a
substantial change will reach a genuinely user-visible, exercisable, and
verifiable outcome. A plan whose outcome is internal-only requires explicit
recorded authorization from its governing issue. A plan is a living control
surface for scope, architecture, risk, progress, decisions, and evidence—not
disposable pre-work.

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
plan, explicitly linked from the governing issue or pull request; supporting
design documents are linked, not competing plans. Never select a plan merely
because it is the newest file in `docs/plans/`, and do not load unrelated
historical plans unless the task needs them as evidence.

For the current documentation-only branch,
[Issue #54](https://github.com/kgudipati/gitblocks/issues/54) is the active plan
authority and authorizes use of the lightweight vertical-slice template below.

## Product-first proportionality

The first question for a product-slice plan is: “Can the intended user-visible
outcome actually be exercised?” The plan names the current executable journey,
the observable user outcome this slice enables, fixes, or materially improves,
and the nearest realistic way to exercise it. Supporting infrastructure and
test evidence do not substitute for that outcome.

The outcome must be genuinely visible to and exercisable by the intended user.
An internal-only outcome is not user-visible merely because it supports later
product work; it requires explicit authorization recorded in the governing
issue and plan.

Infrastructure-only work requires a concrete current blocker and observed
evidence. Before a plan adds a long-lived service, database or table, worker,
queue, provider, authority or schema family, cache or index, evaluation corpus,
deployment component, generalized abstraction, or production dependency, it
must record:

1. the current blocker;
2. the observed evidence;
3. why existing implementation is insufficient;
4. the smallest solution; and
5. the alternatives explicitly deferred.

Unknown or unresolved is a legitimate product state; missing information by
itself is not an implementation requirement for another collection,
materialization, model, provider, persistence, or authority subsystem.

Planning depth follows actual risk. Ordinary product slices do not discuss
tenancy, SLOs, dashboards, backpressure, migrations, queues, or other
operational concerns unless they introduce or change them. Validation also
follows changed behavior: use focused checks during implementation and retain
full repository verification as a final regression and review gate where
appropriate. Proportionality narrows irrelevant ceremony; it never weakens an
applicable safety boundary or final gate.

## Lightweight vertical-slice template

Use this template for a bounded vertical slice that does not change a schema,
trust boundary, or persistence. The governing issue remains the scope and
authorization record.

```markdown
## Purpose

## User-visible outcome

## Scope

## Non-goals

## Contracts touched

## Security considerations

## Validation commands

## Exit gate
```

## Full template

Use the full template below for schema, trust-boundary, and persistence changes,
and whenever the governing issue or reviewer requires it.

### Required sections

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
side effects, versioned boundaries, and primary data flow. Identify only the
input, result, time, memory, cost, pagination, concurrency, timeout,
cancellation, retry, idempotency, and backpressure bounds that the slice
introduces or changes.

Use a diagram only when it clarifies three or more components or a
trust/sequence relationship. Mark future components and do not let diagrams
contradict prose.

### Security, privacy, abuse, and supply-chain considerations

Identify the applicable assets, actors, trust boundaries, untrusted inputs,
authentication, object/action authorization, tenant isolation,
prompt-injection paths,
destructive/external-write approvals, data classification/minimization,
redaction, retention/deletion, secret handling, webhook behavior, audit
evidence, dependencies, CI actions, build provenance, abuse cases, and residual
risk. Explicitly preserve the prohibition on executing ingested repository
code. Do not inventory unrelated hypothetical controls; state once why a
concern is outside the changed boundary.

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

For shared or production behavior introduced or changed by the slice, name the
applicable stable operations/errors, traces, metrics, logs, audit events,
redaction, cardinality bounds, dashboards, alerts, worker
attempt/retry/dead-letter signals, health/readiness, SLOs, runbooks, and
incident diagnosis. Do not design those concerns for a path the slice does not
introduce; one reasoned section-level not-applicable statement is sufficient.

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
