# Development standards

## Purpose and enforcement stages

These rules define the acceptance bar for future production code. They do not
authorize production code in the current engineering-foundation phase;
repository verification tooling is not a product implementation.

| Stage               | Meaning                                                                   | Enforcement                                                                                                              |
| ------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Now                 | Documentation, contracts, plans, metadata, and repository tooling         | ADR 0002, `pnpm verify`, CI, author self-review, and PR review against this handbook                                     |
| Before product code | Before the first product implementation for a language or framework lands | An accepted ADR extends the current toolchain with product-specific framework, contract, boundary, and runtime decisions |
| With code           | Whenever production or test code exists                                   | Automated formatter, lint, type, test, dependency-boundary, and security checks plus line-by-line review                 |
| With deployment     | Whenever a path runs in a shared or production environment                | Runtime bounds, telemetry, access control, operational tests, SLOs, and incident controls                                |

Required evidence is the relevant ADR and contract diff, tests, tool output, PR
validation record, and reviewer confirmation. A future tool may strengthen a
rule but does not replace reviewer judgment.

## Design priorities

Use this order when priorities conflict:

1. correctness and safety;
2. clear behavior and explicit contracts;
3. the simplest design that meets current requirements;
4. maintainability and operability;
5. measured performance and scalability.

Convenience, novelty, or terseness never justifies incorrect behavior,
unbounded work, hidden side effects, or a weakened trust boundary.

| Rule                                                                                                                                            | Why                                                                                | Activation and evidence                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Implement only current issue and contract requirements; apply YAGNI                                                                             | Speculative capability creates unused surfaces and migration obligations           | Applies now; plan scope, diff, and review show no unrequested behavior       |
| Prefer straightforward control flow and data structures over clever compression                                                                 | Reviewers must be able to verify invariants and failures                           | Applies with code; reviewer can explain behavior and tests cover branches    |
| Add an abstraction only when it protects a real boundary, removes meaningful demonstrated duplication, or serves a demonstrated extension point | Layers created “for flexibility” obscure dependency direction and failure behavior | Applies with code; PR names the boundary, duplication, or existing consumers |
| Do not mandate a repository, service, interface, or class for every concept                                                                     | Small cohesive modules are often safer than ceremonial layering                    | Applies with code; module structure is proportional to actual change         |
| Keep each change independently coherent and avoid unrelated cleanup                                                                             | Small changes improve review quality and recovery                                  | Applies now under the [repository workflow](repository-workflow.md)          |

## Modules and dependency direction

Modules must be cohesive: their contents change for the same reason, their
public surface is narrower than their implementation, and callers do not reach
through them to provider internals.

The allowed dependency direction is:

```text
HTTP, MCP, database, queue, GitHub, filesystem, model-provider, and framework adapters
                                      |
                                      v
                         application use cases
                                      |
                                      v
                              domain rules
```

- Domain and application rules must not import transport, framework,
  persistence, queue, GitHub, filesystem, or model-provider adapters.
- Application ports describe capabilities owned by the use case. Provider
  adapters implement those ports; provider SDK types do not leak into domain
  or public contracts.
- An adapter validates and translates at its boundary. It does not recreate
  business decisions or silently apply different defaults.
- Cross-module dependencies must use the declared public surface. Tests and
  scripts do not bypass ownership through deep imports.
- Cycles across domain, application, and adapter boundaries are prohibited.
- A single deployable may contain all layers. This direction does not require
  microservices, dependency-injection frameworks, or one interface per class.

The stack ADR must select an automated dependency-boundary check before code
lands. Until then, import review and architecture tests where supported provide
evidence.

## Contracts and validation

A public or cross-process contract includes API, MCP, event, job, persisted
schema, fingerprint, evidence, outcome, configuration, and stable error shapes.
Owned contracts are centralized and versioned so every layer uses the same
behavior and compatibility boundary.

- Define each owned contract once in a versioned authoritative module or schema.
  Encoders and adapters reuse or generate from it; they must not maintain
  competing handwritten shapes.
- Validate data when it crosses every trust boundary, even when an upstream
  system claims validation. Repository content, model output, MCP arguments,
  webhooks, stored records, queue messages, environment configuration, and
  provider responses are untrusted.
- Validation must reject unknown or malformed security-sensitive fields when
  permissive parsing would hide intent. Size, count, range, path, encoding, and
  semantic constraints are part of validation, not only field types.
- A contract documents behavior, invariants, constraints, version negotiation,
  defaulting, side effects, idempotency, ordering, compatibility, and failure
  modes. Examples supplement but do not replace normative behavior.
- Contract changes classify compatibility, update contract and negative tests,
  and describe rollout plus rollback or forward recovery. Persisted changes use
  migrations; deployed producers and consumers must tolerate the planned
  transition window.
- Semantic Versioning applies once a public contract exists, as defined in the
  [repository workflow](repository-workflow.md).

Evidence consists of the authoritative schema, contract tests, compatibility
assessment, generated-artifact drift check when applicable, and documentation.

## Side effects and dependencies

Side effects must be visible at the use-case boundary and occur only after
validation and authorization. A name such as `evaluateCandidate` must not
silently write a repository, bill a provider, or send a message.

- Inject or pass time, randomness, network, filesystem, model, queue, and
  persistence capabilities where deterministic tests or policy control require
  them.
- Configuration is explicit, validated at startup or request scope as
  appropriate, and safe by default. Do not branch on undocumented environment
  state.
- Hidden global mutable state is prohibited. Process-wide immutable
  configuration and intentionally scoped caches are allowed only with clear
  initialization, ownership, invalidation, bounds, and test reset behavior.
- External writes, destructive actions, privileged operations, and costly
  model or infrastructure calls require an explicit application operation and
  the approval rules in the
  [security baseline](security-baseline.md#approval-and-external-effect-boundaries).
- Transaction or unit-of-work boundaries are explicit. Partial success and
  compensating or forward-recovery behavior are documented.

Tests demonstrate that effects do not occur on failed validation,
authorization, cancellation, duplicate requests, or dry-run paths.

## Bounded and reliable operations

No operation may grow without an explicit bound in input size, result count,
memory, concurrency, cost, attempts, or time.

Where applicable, code must provide:

- pagination with a stable order and documented page limits;
- end-to-end deadlines and per-provider timeouts;
- cancellation propagated through calls and workers;
- idempotency keys or naturally idempotent semantics for retryable writes;
- bounded retries only for classified transient failures;
- exponential backoff with jitter and a maximum delay;
- concurrency limits, queue limits, backpressure, and overload behavior;
- streaming or batching when the measured data size warrants it; and
- resource cleanup on success, error, timeout, and cancellation.

Do not retry authentication, authorization, validation, deterministic
application, or unknown write failures by default. Do not retry beyond the
caller's deadline. A queue must define duplicate-delivery and poison-message
behavior before use.

The plan names relevant budgets; unit, integration, load, and resilience tests
verify them according to risk. Production telemetry shows duration, attempts,
result, saturation, and rejected work without high-cardinality or sensitive
values.

## Errors and failure handling

- Public boundaries return typed, stable, documented error categories with
  machine-readable codes and safe user-facing messages.
- Internal errors preserve causal context, operation, and correlation
  identifiers while redacting credentials, source, model prompts, personal
  data, and provider internals.
- Catch-all suppression, empty catches, success after an ignored failure, and
  logging without resolving or propagating an error are prohibited.
- Recoverable degradation must be explicit in the result contract. An unknown,
  stale evidence item, partial page, or skipped candidate is not silent
  success.
- Map provider errors once at the adapter boundary. Domain and application code
  must not switch on provider-specific strings or status values.
- Cleanup errors are handled deliberately and must not replace the primary
  failure without preserving it.
- Panic, process exit, or equivalent fatal behavior is limited to unrecoverable
  initialization and invariant violations, not routine untrusted input.

Tests cover each public error category, redaction, causal preservation where
observable, degradation semantics, and failures during cleanup or retry.

## Naming, constants, and comments

- Names describe domain meaning, unit, direction, ownership, or predicate
  truth. Avoid unexplained abbreviations, generic names such as `data`,
  `handler`, or `manager`, and names that conceal effects.
- Replace magic values with a named domain constant or validated configuration
  when the value has policy meaning. A literal obvious only within a tiny local
  expression need not become a global constant.
- Comments explain rationale, invariants, security implications, external
  constraints, or non-obvious tradeoffs. They do not narrate readable syntax or
  compensate for confusing code.
- Commented-out code is prohibited; version control preserves history.
- Orphan `TODO` and all `FIXME` comments are prohibited. A necessary tracked
  deferral uses exactly `TODO(#<issue>): <specific action>` and is permitted
  only when the linked issue exists, the current behavior is safe, and the
  deferral is not required for the current acceptance criteria.
- Public contracts and public symbols document behavior, constraints, side
  effects, concurrency or ordering guarantees, and failure modes. Internal
  symbols need documentation when their contract is not evident from code and
  tests.

Formatter and linter output enforce mechanical style after the stack ADR.
Reviewers enforce semantic naming, comment usefulness, and documentation
accuracy.

## Generated code and dependencies

Before production code lands, the stack ADR must define:

- the formatter and version;
- linter rules and version;
- compiler or type-checker strictness;
- import and dependency-boundary enforcement;
- test commands and supported runtime versions;
- whether generated code is committed, how it is reproduced, and how drift is
  detected; and
- the package manager, lockfile, dependency update, and vulnerability-check
  policy.

Generated files must carry an origin and regeneration instruction and must not
be hand edited. A generator and its inputs are reviewed; generated volume is
not a reason to omit security or licensing review. Production dependencies
require a demonstrated need, license and maintenance review, pinned resolution
through the approved lockfile, and minimal permission/surface. A convenience
library is not justified when the owned implementation is smaller and safer.

## Review evidence

A conforming code change provides:

- an issue and current plan where required;
- applicable ADR and contract updates;
- formatter, linter, strict type/compiler, dependency, build, test, and
  security command results;
- tests at the levels required by the
  [testing strategy](testing-strategy.md);
- explicit performance and reliability budgets for affected operations;
- security/privacy and telemetry review;
- migration, compatibility, rollout, and recovery evidence; and
- a completed [definition of done](definition-of-done.md).
