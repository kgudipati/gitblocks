# Testing strategy

## Purpose and current status

Tests provide evidence about observable behavior and known risks; they do not
prove correctness. ADR 0002 selects Vitest with V8 coverage for the current
TypeScript repository, product kernel, and evaluation tooling, and `pnpm test`
plus `pnpm test:coverage` are enforced by the authoritative verification
graph. The repository's only production-owned code is the pure domain and
contract kernel; each future product phase must extend this strategy for its
actual services and boundaries before that code lands.

Every implementation phase must list its test matrix and exact commands in its
execution plan before implementation. A reviewer blocks a change whose tests
do not match its behavior, contracts, boundaries, or security risk.

## Change-level rules

- Tests ship in the same change as new or changed behavior. A later “test
  cleanup” issue is not evidence for the current change.
- A reproducible bug fix begins with a failing regression test that demonstrates
  the observable defect. The test is then shown to pass with the fix. If the
  defect cannot be reproduced deterministically, the PR records attempts and
  adds the strongest feasible characterization or invariant test.
- Domain rules use test-first development by default: express examples, edge
  cases, and invalid states before or alongside the rule. A PR explains a
  deviation when an exploratory interface had to stabilize first.
- Refactoring preserves behavior under existing tests. If important behavior
  lacks tests, add characterization tests before changing structure.
- Security-sensitive behavior includes negative and abuse cases in the same
  change, including cross-tenant access, missing or excessive authorization,
  injection, replay, tampering, malformed sizes and encodings, secret
  redaction, approval bypass, and resource exhaustion as applicable.
- A test must fail for the intended reason when the protected behavior is
  broken. Reviewers inspect assertions and mutation or targeted fault checks
  may be used where risk warrants them.

## Test levels

| Level       | Required target                                                                                                                       | Boundary and evidence                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit        | Pure domain and application behavior, invariants, edge cases, error classification, ranking rules, and bounded algorithms             | No network, filesystem, clock, random source, model, queue, or database unless passed as a controlled owned dependency                                                               |
| Contract    | Every versioned API, MCP, event, job, persisted record, fingerprint, evidence, outcome, configuration, and error boundary             | Authoritative schema fixtures; valid, invalid, forward/backward compatibility, unknown-field, size, defaulting, and error cases                                                      |
| Integration | Database, queue, GitHub, MCP, storage, filesystem, model-provider, identity, telemetry exporter, and package/security-source adapters | Real service or faithful supported emulator/container where feasible; verifies authentication, serialization, timeouts, pagination, retries, idempotency, and provider error mapping |
| End to end  | A small set of critical user journeys across supported components                                                                     | Only journeys whose cross-component risk is not covered below; asserts user-visible result and important audit/telemetry behavior                                                    |

For the current kernel, domain tests cover pure constructors,
canonicalization, reference integrity, hard-constraint and responsible-outcome
rules, and partial-order ranking. Contract tests cover all six `1.0.0`
families, closed shapes, version rejection, non-coercion, non-mutation,
bounded/redacted diagnostics, domain mapping, and deterministic schema
exports.

Important external boundaries are not considered verified by mocks alone. For
example, a mocked GitHub client can exercise application decisions, but a
realistic integration suite must verify the actual supported request,
pagination, conditional response, error, rate-limit, and webhook behavior
before release. Live-provider tests must use dedicated least-privilege test
accounts, deterministic cleanup, bounded spend, and explicit opt-in; they do
not run for untrusted pull requests with secrets.

## Test matrix by responsibility

| Responsibility               | Minimum evidence                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product contract kernel      | Pure domain-invariant tests; valid and exploit-oriented parser cases; schema closure and deterministic-export checks; package dependency-boundary enforcement                 |
| Deterministic local scanner  | Golden and property tests for path handling, manifests, symlinks, encodings, bounds, secret redaction, and proof that scanned code is not executed                            |
| Skill procedure              | Contract scenarios for approval gates, data preview/minimization, prompt-injection resistance, unknown handling, and safe stop behavior                                       |
| MCP surface                  | Schema and compatibility tests, authentication/authorization, tenant isolation, cancellation, pagination, size bounds, stable errors, and tool-goal semantics                 |
| Catalog ingestion            | Source fixtures, provenance/freshness, webhook signature and replay checks, malformed content, rate bounds, idempotency, retries, poison items, and non-execution of source   |
| Retrieval and ranking        | Unit/golden evaluations for hard constraints, evidence attribution, inference/unknown separation, deterministic tie behavior, and quality baselines                           |
| Evidence and outcome storage | Integration tests for tenant isolation, retention/deletion, redaction, migrations, concurrency, and recovery                                                                  |
| Adoption workflow            | A small end-to-end corpus across the five selected capability families, including “no viable candidate” and withheld-data paths                                               |
| Fixed-candidate evaluation   | Schema valid/invalid forms, bounded and inert JSON, manifest hashes, reference integrity, hard-safety gate, deterministic metrics, blind inputs, weak fixtures, and CLI exits |

Each phase selects only applicable rows and records why omitted rows are
irrelevant.

## Determinism and isolation

- Fixtures are minimal, named for the behavior they demonstrate, and free of
  secrets, personal data, unstable network content, and unexplained snapshots.
- Time and randomness are controlled through injected clocks and seeded or
  deterministic sources. Tests assert timestamps and retry schedules against
  those controls.
- Arbitrary sleeps are prohibited. Synchronize on an observable condition,
  controllable clock, event, barrier, or bounded poll with a diagnostic
  deadline.
- Test order must not matter. Each test owns and cleans its state; parallel
  execution must not cause shared-name, port, tenant, cache, or clock races.
- Locale, timezone, filesystem order, architecture, and environment variables
  are fixed where they affect behavior. A test must not pass only on a
  contributor's machine.
- Network access is denied by default for unit and contract tests. Integration
  tests declare each external dependency.
- Flaky tests are defects. Quarantine, when unavoidable, requires a linked
  issue, owner, expiration, isolated non-gating status, and preserved failure
  evidence; repeated retries must not hide failure.

## Assertions, doubles, and fixtures

Tests assert public outputs, state transitions, persisted effects, emitted
contracts, authorization decisions, and stable telemetry—not private method
calls, incidental query counts, or internal object shape unless those are
explicit performance or contract requirements.

Mocks, fakes, and stubs are used at boundaries GitBlocks owns. They represent
documented behavior, not guessed provider internals. Avoid deep mock chains and
tests that merely verify a mock was configured. Provider SDKs and protocols
need integration verification against a supported real service, official local
test facility, or recorded protocol fixture with a periodic live check.

Snapshots are permitted for stable, human-reviewed structured output when
semantic assertions would be less clear. Large opaque snapshots, automatic
snapshot acceptance, and snapshots containing volatile identifiers or
sensitive content are prohibited.

## Risk-driven techniques

Use additional techniques when their risk model justifies them:

- property-based tests for parsers, ranking invariants, idempotency, ordering,
  and contract round trips;
- fuzzing for untrusted schemas, paths, archives, webhook payloads, MCP
  arguments, model output, and content extraction;
- mutation testing for high-risk authorization, hard-constraint, redaction, and
  approval rules when ordinary tests may assert the wrong condition;
- load tests for catalog growth, ranking latency, concurrency, queue depth,
  provider limits, and metric cardinality;
- resilience tests for timeouts, cancellation, partial sources, duplicate and
  reordered events, transient failures, exhausted retries, backpressure,
  dead-letter behavior, and recovery; and
- security tests for tenant escape, prompt injection, command/path injection,
  SSRF, webhook forgery/replay, unsafe output, and secret leakage.

The plan defines the property, threat, workload, expected bound, pass
threshold, environment, and evidence. “Run a load test” without a workload and
threshold is not a test plan.

## Model-facing evaluation

Model output is untrusted and nondeterministic. Deterministic application code
must validate its schema, evidence references, authorization scope, and bounds
before use.

The Phase 2 pilot is a fixed-candidate evaluation, not discovery. Its committed
tests and weak fixtures are completely offline and do not call a model. Proposed
gold remains separate from inputs and is not independently accepted. Any future
model or generic-agent baseline must follow the
[independent baseline protocol](../evaluation/baseline-protocol.md).

- Separate deterministic contract/security tests from quality evaluations.
- `pnpm contracts:validate` checks intentional mapping of all ten cases into
  product requests, fingerprints, dossiers, and response representability. It
  is a conformance check, not a quality score, independent baseline, prediction
  workflow, or gold review.
- Pin the model/configuration for a recorded evaluation baseline; record model,
  prompt/procedure version, corpus version, parameters, and evaluation date.
- Use representative and adversarial examples, including indirect prompt
  injection in source, documentation, issues, package metadata, and web
  content.
- Measure hard-constraint violations, evidence traceability, disclosed
  unknowns, and stable product metrics from the
  [product contract](../product/product-contract.md#private-alpha-success-measures).
- A model grader cannot be the sole oracle for authorization, security,
  schema, numerical, or exact contractual correctness. Human review samples
  quality metrics and calibrates graders.
- Quality gates compare against an approved baseline and define allowed
  variance; rerunning until a favorable result is prohibited.

## Coverage policy

Coverage identifies unexecuted code and unexpected changes in exercised paths.
It is never proof that assertions, requirements, or threat cases are correct.

Before coverage becomes a merge gate, maintainers must:

1. measure a representative baseline by test level;
2. identify critical modules and branch/condition gaps;
3. propose thresholds and ratcheting behavior in an issue;
4. define generated, unreachable, and integration-code treatment; and
5. validate that the gate rewards meaningful tests rather than line execution.

After approval, CI enforces the baseline against regressions and may apply
higher thresholds to security-critical pure logic. A repository-wide percentage
does not waive required test cases.

## Test evidence and exceptions

The PR records every applicable command, exit result, environment, skipped
suite, and material output. For a failure, include the cause and resolution;
do not erase evidence by writing only the final pass. Test reports and logs must
not contain credentials, proprietary source, prompts with sensitive excerpts,
or unnecessary personal data.

An exception requires a linked issue, specific missing evidence, risk and user
impact, owner, expiration, and safe interim behavior. Missing tests for
reproducible critical security or data-loss behavior block merge.
