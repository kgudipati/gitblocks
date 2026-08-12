# Definition of done

## First question

**Can the intended user-visible outcome actually be exercised?**

For a product slice, the PR names the supported journey, the exercise
procedure, and the observed user-visible result. Passing component tests or
creating supporting infrastructure is not a substitute. For a documentation
or governance-only change, the PR instead demonstrates that the stated
reviewable governance outcome is complete and does not claim an executable
product capability.

## How to use this gate

A change is done only when every applicable item below has concrete evidence in
the pull request (PR) and every non-applicable item has a short reason. “Not
applicable” is not valid when the change introduces the corresponding behavior,
boundary, data, deployment, or operational risk.

Applicability follows the actual change. An ordinary product slice does not
inventory tenancy, queues, migrations, SLOs, dashboards, backpressure, or
similar concerns that it does not introduce or change; one reasoned
section-level not-applicable statement is sufficient.

The author completes this gate before requesting final review. Reviewers verify
the evidence rather than accepting a checked box. A green automated check does
not waive design, contract, security, or operational review.

## Outcome and scope

- [ ] The PR links the governing issue and delivers its stated user or
      engineering outcome.
- [ ] A product slice identifies the currently executable journey it enables,
      fixes, or materially improves and records evidence that the intended
      user-visible outcome can be exercised.
- [ ] A current version-controlled execution plan exists when required by
      [PLANS.md](../../PLANS.md), and its progress, decisions, deviations, and
      evidence reflect the final change. It is the plan explicitly linked from the
      governing issue or PR, not one inferred from file recency.
- [ ] The implementation matches the issue scope and explicit non-goals; the
      diff contains no unrelated refactoring, experiments, generated churn,
      dependencies, or scaffolding.
- [ ] Current behavior, approved direction, future work, and open decisions are
      distinguished in code, contracts, and documentation.
- [ ] Infrastructure-only work identifies a concrete current blocker and
      observed evidence, explains why existing implementation is insufficient,
      implements the smallest solution, and explicitly defers alternatives.
- [ ] The change is a coherent, independently reviewable and recoverable slice
      under the [repository workflow](repository-workflow.md).

## Design and changed-line review

- [ ] Every changed line and relevant surrounding context has been reviewed for
      product correctness, functionality, design, simplicity, naming, comments,
      documentation, and compatibility.
- [ ] The design applies YAGNI; every abstraction protects a real boundary,
      removes meaningful demonstrated duplication, or supports a demonstrated
      extension point.
- [ ] Modules are cohesive, public surfaces are narrow, dependency direction is
      explicit, and domain/application rules remain independent of HTTP, MCP,
      database, queue, GitHub, filesystem, model-provider, and framework adapters.
- [ ] Side effects, partial failure, bounds, timeouts, cancellation,
      idempotency, retries, backpressure, and concurrency are explicit where
      applicable.
- [ ] Names express domain meaning. Comments explain rationale, invariants,
      security implications, or non-obvious tradeoffs rather than narrating code.
- [ ] No debug path, commented-out code, magic policy value, silent error
      suppression, hidden global mutable state, orphan `TODO`, or `FIXME` remains.
      Any safe deferral uses `TODO(#<issue>): <specific action>`.
- [ ] The change complies with the
      [development standards](development-standards.md).

## Contracts, data, and compatibility

- [ ] Public and cross-process behavior, constraints, side effects, failure
      modes, ordering, idempotency, and versioning are documented.
- [ ] Contract shapes are centralized and versioned; adapters do not duplicate
      domain, persistence, API, MCP, event, job, evidence, fingerprint, or outcome
      contracts.
- [ ] All external, persisted, webhook, repository-derived, and
      model-generated data is validated at its trust boundary.
- [ ] The compatibility impact is classified. Contract tests cover current,
      invalid, and supported transition versions.
- [ ] Persisted-schema changes use reviewed migrations. Mixed-version behavior,
      backfill, rollback or forward recovery, data-loss risk, and operator steps
      are documented and tested.
- [ ] Rollout, feature exposure, and recovery preserve old and new consumers
      for the documented window; an incompatible public change follows the
      repository's versioning policy.

## Tests and quality checks

- [ ] Focused development checks were proportional to changed behavior; full
      repository verification remains the final regression/review gate where
      appropriate and was not removed or weakened.
- [ ] Tests were written before or alongside behavior. A reproducible bug fix
      began with a failing regression test.
- [ ] Unit tests cover pure behavior, invariants, edge cases, and stable errors.
- [ ] Contract tests cover every changed versioned boundary.
- [ ] Integration tests cover changed database, queue, GitHub, MCP, storage,
      filesystem, model-provider, identity, telemetry, or package/security-source
      adapters with realistic verification.
- [ ] Only critical cross-component journeys receive end-to-end coverage.
- [ ] Security-sensitive behavior includes negative and abuse tests.
- [ ] Fixtures are deterministic; time and randomness are controlled; tests use
      no arbitrary sleeps and assert observable behavior rather than private
      implementation.
- [ ] Risk-appropriate property, fuzz, load, resilience, model evaluation, or
      manual testing is present and has stated thresholds.
- [ ] Tests comply with the [testing strategy](testing-strategy.md), and any
      quarantine or omission has a linked owner and expiring issue.
- [ ] Formatting, linting, strict compiler/type checks, dependency-boundary
      checks, build, tests, documentation validation, and security checks pass once
      their stack tools exist.

## Security and privacy

- [ ] The plan and PR identify changed trust boundaries, assets, actors,
      untrusted inputs, misuse cases, and residual risks.
- [ ] Where introduced or changed, authentication, object/action authorization,
      tenant isolation,
      least-privilege identities, approval gates, webhook verification, safe
      errors, and auditability are implemented and tested where applicable.
- [ ] Repository and retrieved content remain untrusted data and cannot become
      instructions; analysis infrastructure cannot execute ingested code.
- [ ] No credential, token, `.env` value, private key, sensitive source,
      personal data, or exploit detail appears in source, fixtures, prompts, model
      context, logs, telemetry, issue/PR text, or artifacts.
- [ ] Data purpose, classification, minimization, redaction, access, retention,
      deletion, model/provider transfer, and backup/derived-data behavior are
      documented and tested before collection.
- [ ] Dependencies, lockfile changes, licenses, advisories, install scripts,
      pinned CI actions, workflow permissions, SBOM/provenance impact, and generated
      artifacts were reviewed where applicable.
- [ ] The change complies with the
      [security baseline](security-baseline.md); any exception records rule, risk,
      controls, owner, expiration, and remediation issue.

## Performance, observability, and operations

- [ ] Input/result/time/memory/concurrency/cost bounds and performance budgets
      are explicit and verified for affected operations.
- [ ] Production paths emit correlated structured traces, metrics, logs, and
      required audit events with stable operation/error names.
- [ ] Telemetry is allowlisted, redacted, bounded in cardinality, costed, and
      tested to exclude secrets, raw source, prompts, payload bodies, and
      unnecessary personal data.
- [ ] Changed provider calls expose timeouts, cancellation, attempts,
      saturation, and final result. Changed workers expose queue age, attempt,
      duration, retry, idempotency, terminal, and dead-letter state.
- [ ] Health/readiness, graceful startup/shutdown, dependency degradation,
      dashboards, alerts, SLOs, and runbooks are updated and tested where the
      deployment requires them.
- [ ] The change complies with the
      [observability and reliability policy](observability-and-reliability.md) and
      can be diagnosed without emergency instrumentation.

## Documentation, evidence, and handoff

- [ ] README, product contract, ADRs, system context, public references,
      operational runbooks, and contributor/agent guidance are updated wherever
      the final decision or behavior changed.
- [ ] Markdown links, diagrams, examples, commands, version names, and
      implemented-versus-future statements are accurate.
- [ ] The PR records each exact validation command, its outcome, environment
      constraints, failures resolved, skipped checks, and the strongest
      deterministic alternative for unavailable tooling.
- [ ] `git diff --check`, complete status/diff review, required-file checks,
      secret/prohibited-content review, and all plan-specific checks pass.
- [ ] Unresolved work is represented by linked issues with owner and priority
      where appropriate, not hidden in comments, review conversation, or plan
      prose.
- [ ] Required approvals and final checks apply to the final reviewed commit.
      An unpublished branch may be rebased; a pushed or PR-attached branch is
      updated only by merging `main` or GitHub's merge-based update, without rebase
      or force-push, and checks are rerun. Merge occurs by squash through GitHub;
      the `main` ruleset is enforced once configured. Nobody pushes directly or
      bypasses checks.

## Evidence rule

Acceptable evidence names the artifact or command and its observed result:

```text
git diff --check — exit 0; no whitespace errors
```

Statements such as “tested,” “looks good,” “N/A,” “CI is green,” or “follows
best practices” are not sufficient. When a check cannot run, record why, what
risk remains, and which deterministic review or test was performed instead.
