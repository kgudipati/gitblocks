# Testing strategy

## Purpose and current status

Tests provide evidence about observable behavior and known risks; they do not
prove correctness. ADR 0002 selects Vitest with V8 coverage for the current
TypeScript repository, product kernel, and evaluation tooling, and `pnpm test`
plus `pnpm test:coverage` are enforced by the authoritative verification
graph. The repository's production-owned code is the pure domain and contract
kernel, the concrete PostgreSQL persistence adapter, and the operator-run
public ingestion/artifact adapter; each future product phase must extend this
strategy for its actual services and boundaries before that code lands.

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
exports. Synthetic non-corpus repositories prove that the controlled
repository-fact vocabulary represents routine supported-ecosystem facts
without changing the serialized shape. Valid and invalid evidence-source
tables cover exact revisions, mutable aliases, locator matching, source
compatibility, branch references, exact package versions including concrete
prereleases, and publication, collection, validation, and freshness chronology.
Mapping tests inspect the exact `direct`, `declared`, or `derived` domain value.

Persistence integration uses PostgreSQL 18 at the exact image digest recorded
by ADR 0004. `pnpm db:verify` provisions an ephemeral no-volume container by
default; an injected database requires an explicit ephemeral acknowledgment
and a `_test` database name. Hosted `Database and Audit` runs the same
integration suite against the pinned service and may not skip it. Together the
hosted jobs preserve every component of local `pnpm verify:ci`; SQLite, mocks,
and compatibility layers do not substitute for PostgreSQL semantics. Migration
tests cover clean/repeat apply, checksum drift, serialization, transactional
failure, qualification, and the supported major version. Isolation tests
connect as non-owner, non-superuser roles.

Response-invariant tests require traceability for every reason and exact
candidate ownership for its evidence and inference support. They prove that
supplied limitations cannot disappear, move candidates, change statements, or
change evidence references; complete processing can retain explicit unknowns;
and partial-evidence processing cannot omit its bounded reason codes.
Exploit-oriented parser tests include throwing JavaScript proxies and require
one bounded value-free rejection without leaking trap text or a stack trace.
Those tests do not claim that reflective inspection avoided invoking a hostile
trap; production adapters are responsible for supplying data-only values.

Important external boundaries are not considered verified by mocks alone. For
example, a mocked GitHub client can exercise application decisions, but a
realistic integration suite must verify the actual supported request,
pagination, conditional response, error, rate-limit, and webhook behavior
before release. Live-provider tests must use dedicated least-privilege test
accounts, deterministic cleanup, bounded spend, and explicit opt-in; they do
not run for untrusted pull requests with secrets.

The Phase 5 ordinary suite never calls a live provider. It validates the full
150-repository manifest structurally, uses reviewed synthetic provider
responses, and composes exact profiles through PostgreSQL 18.4. A live receipt
is operational evidence only when the explicit opt-in command completes;
fixtures are not current-source validation.

The Phase 6 ordinary suite also never calls a live provider. Synthetic fixtures
cover the reviewed artifact manifest, request-version compatibility,
repository hash-algorithm discovery, exact-ref README/path retrieval,
non-recursive tree verification, strict content validation, lossless chunk
properties, controlled failures, and content-free receipts. Unexpected real
network access fails the suite. Real PostgreSQL 18 integration through the
non-owner runtime role covers immutable artifact/set migration, grants,
closure, reconstruction, idempotency, concurrency, historical loading, and
first-materialization reuse without skipped tests. The full 150-candidate
artifact operation is a separately authorized live proof and is not simulated
by offline fixtures.

The Phase 7 ordinary suite performs no model-provider network request. It
separates deterministic schema, projection, prompt, identity, citation,
persistence, receipt, and security tests from nondeterministic model quality
evaluation. Real PostgreSQL 18 tests apply all four migrations and verify the
eight-table repository-interview history through the non-owner runtime role:
atomic publication, exact replay, concurrent idempotency/conflict behavior,
forced and normal histories, earliest eligible reuse, historical loading,
deferred root/member/citation/provenance closure, immutability, grants, and
corrupt-history rejection, without skips. Synthetic adversarial repository
text will attempt
instruction override, identity forgery, tool/secret requests, invalid aliases
and lines, ranking, JSON-field injection, outside knowledge, unknown
suppression, confidence inflation, and unsafe output. Real provider calibration
and the 30/150-candidate gates remain explicit acknowledged operations with
frozen model/specification profiles, spend limits, human review, and
content-free evidence.

The Milestone 8 provider-protocol suite remains entirely fake-transport based.
It proves fixed-host request bytes, the exact
`promptCacheRetention = in-memory` to
`prompt_cache_retention: "in_memory"` mapping, strict structured output,
bounded streaming reads, safe header parsing, retry/deadline behavior, status
and usage mappings, and owned value-free results. These tests prove adapter
protocol behavior only: they do not establish Zero Data Retention, model
quality, prompt-injection resistance, or suitability of either calibration
snapshot. Before any real calibration request, the pre-live gate must verify
ZDR for the exact organization/project or cite newer authoritative provider
evidence proving the effective retention behavior.

Milestone 10 adds read-only reproduction of three exact candidate plans, two
unselected dated profiles, the readiness policy, offline report, schema
snapshots, and manifest. Synthetic tests cover 6/30/150 execution at
concurrency one and two, complete first passes, canonical ordering, exact
zero-call reuse, bounded task creation, fail-fast/deadline/budget stops,
truthful attempts and calls, complete raw receipt parsing, authorization
closure, and network/secret/import-effect/sentinel denial. Synthetic prices
and retention digests are test inputs only.

Correction regressions prove that a digest-correct complete migration-`0003`
receipt remains accepted by the generic historical parser but is rejected by
the Phase 7 complete-receipt boundary before any external effect. The
readiness matrix covers calibration eligibility before and after its result,
every missing or `not-applicable` prerequisite, permanently blocked Gate A/B
stages in policy `1.0.0`, and rehashed forged derived states. Plan-only dry-run
accepts only the two exact committed complete profile authorities and rejects
profile-field drift with zero external effects.

The public root `pnpm typecheck` builds required product and tool workspace
outputs before internal typechecking. Repository-policy tests reject a missing
or reordered tool build in both standalone typecheck and `verify:core`.
Hosted CI partitions the same authority into six independent 20-minute worker
jobs and one five-minute aggregate gate. `Standalone Typecheck` runs the exact
standalone command after its own frozen install, so ignored local `dist/` state
cannot satisfy the proof. `Verification — Static and Authorities` validates
pull-request metadata and runs every non-test, non-database component of
`verify:core` in its accepted order. Three test workers build the workspaces
and use exact path filters over the tracked `vitest.config.ts`: core product
tests own the contracts, domain, persistence, and ingestion roots; interview
tests own the interviews and operator roots; and tooling tests own the
evaluation harness, pre-live, and repository-policy roots. Their union is the
ordinary 88-file, 1,503-test suite with no overlap.

The displayed `Verification` job is a pure required-check compatibility gate:
it checks out no worktree, installs nothing, and succeeds only when the static
worker and all three test workers report `success`. This is the sole narrow
exception to worker checkout, frozen-installation, and unchanged-worktree
requirements. `Database and Audit` alone receives database credentials and
provisions the pinned PostgreSQL service, then runs `pnpm db:verify` and
`pnpm security:audit`; the database command already owns its deterministic
build prerequisite. Every repository-code worker proves its worktree
unchanged. Workflow-policy tests reject missing gates or roots, overlapping
shards, worker dependency edges, invalid aggregate dependencies, database
authority outside the database job, unpinned actions, retries, ignored
failures, and tolerance directives. Local `pnpm verify`, `pnpm verify:core`,
and `pnpm verify:ci` remain canonical and unchanged.

The PostgreSQL 18.4 suite applies migrations through 0004 in the existing test
harness, then proves 6/30/150 selection materialization from one complete
synthetic receipt. Receipt `artifactSetId` is the sole lookup key; identity is
accepted only from the loaded parsed set; a newer same-candidate set is ignored;
missing or mismatched receipt-named sets fail. This test never contacts OpenAI,
never reads a provider credential, never skips, and does not make the
materializer or operator a migration owner.

The same harness provisions an isolated fresh migration-`0004` database for
the catalog-only seed boundary. It parses the committed 150-candidate catalog,
proves exact candidate identity/`introducedAt` rows and complete family
assignment closure, verifies migration-3/5 denial before writes, performs an
exact idempotent replay with byte-for-byte unchanged seed state, rejects
identity drift without mutation, and proves zero seed-created evidence,
dossier, artifact, or interview rows. A final synthetic artifact publication
proves that the seeded rows satisfy the immutable artifact catalog-provenance
precondition. Import/source tests separately prohibit provider, profiler,
network, timer, file-write, and wider persistence capabilities.

Cancellation fixtures distinguish a provider-returned 2xx cancelled envelope
from external attempt-control cancellation. Deadline fixtures use transports
that ignore abort, controller outcomes that change during bounded parsing,
and retry sleepers that advance injected time farther than requested. They
require controller authority to discard late HTTP data, final timestamps to
follow response interpretation, and the post-sleep clock to preserve the full
120-second second-attempt budget at the exact 300-second boundary.

Ingestion regressions must prove the closed provider taxonomy rather than mock
all failures as absence. Fatal optional outcomes are rethrown and create no
snapshot. PostgreSQL recovery tests perform complete, temporary-failure, and
recovered refreshes for license, release, community, allowlisted file, and
advisory sources; they prove the historical snapshot remains loadable and no
transient limitation or unknown survives. Integration coverage also exercises
moved canonical location after initial persistence, manifest republication
with stable `introducedAt`, introduction-time conflict, and exact-commit
license branch races.

## Test matrix by responsibility

| Responsibility               | Minimum evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product contract kernel      | Pure domain-invariant tests; non-corpus representability fixtures; source-aware provenance matrices; traceability and preservation invariants; valid and exploit-oriented parser cases; schema closure and deterministic-export checks; package dependency-boundary enforcement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| PostgreSQL persistence       | Unit tests for bounds and stable errors; real PostgreSQL migration, public identity uniqueness, complete-record idempotency, concurrency, evidence-world cutoff, lifecycle, active-reference closure, exact historical snapshots, cancellation, and conformance through a non-owner role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Deterministic local scanner  | Golden and property tests for path handling, manifests, symlinks, encodings, bounds, secret redaction, and proof that scanned code is not executed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Skill procedure              | Contract scenarios for approval gates, data preview/minimization, prompt-injection resistance, unknown handling, and safe stop behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| MCP surface                  | Schema and compatibility tests, authentication/authorization, tenant isolation, cancellation, pagination, size bounds, stable errors, and tool-goal semantics                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Catalog ingestion            | Explicit curated-source and closed manifest/receipt tests; shared catalog-to-persistence identity/family mapping; complete catalog-only seed planning and CLI authority; migration-3/5 zero-write denial; full 150-candidate PostgreSQL seed closure and idempotent replay; declared-source/request agreement; closed provider outcome taxonomy; host, redirect, auth, content, rate, cancellation, deadline and byte bounds; exact-commit license races; deterministic profile/refresh tests; real PostgreSQL transient recovery, move, introduction-time, idempotency/lifecycle reconstruction; source non-execution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Repository interviews        | Provider-output and durable-contract separation; exact schema projections; deterministic prompt/alias/line rendering; full-scope and no-truncation checks; citation/semantic closure; no trusted model IDs; fake-port application tests; fixed-host provider protocol, refusal/incomplete/error/usage/retry tests; immutable PostgreSQL history/reuse; offline operator selection/policy/budget/receipt/telemetry tests; fake-provider ephemeral PostgreSQL composition and immediate zero-call reuse; adversarial injection/leakage fixtures; independent human audit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Phase 8 retrieval foundation | `pnpm taxonomy:validate` and `pnpm profiles:validate` preserve exact authority/schema/digest closure; `pnpm eval:retrieval:validate` proves exact 30/20 balance, manifest/hash/membership, blind input, accepted-normalizer drift, generated 30-by-150 hard-filter projections, separate proposed gold, relevance/equivalence/no-result closure, and adversarial bounds; `pnpm eval:retrieval:fixtures` proves hand-calculated scorer math and zero denominators; `pnpm eval:retrieval:baselines` proves blind-first frozen prediction generation and content-free print output; `pnpm eval:retrieval:verify` repeats/reverses generation, validation, scoring, aggregation, schema/content/digest checks, committed-byte comparison, and no-write audit; focused tests reject identity/gold/rationale leakage, fuzzy/locale/clock/random/environment/network semantics, unsafe ordinary emission, imperfect controls, report content, arbitrary/symlinked writes, prediction commits, and production/Phase 7 scope; fake-process Milestone 7 tests require three bounded pre-health storage authorities: exact `HostConfig.Tmpfs` configuration for PostgreSQL 18's `/var/lib/postgresql` root and `rw,noexec,nosuid,nodev,size=1073741824`, a `.Mounts` negative audit that accepts the observed empty array while rejecting every volume, bind, and conflicting storage entry, and effective mountinfo proving exactly one writable root tmpfs with `noexec`, `nosuid`, `nodev`, and a `size=` super-option; malformed, oversized, duplicate, contradictory, missing, extra, or failed inspection variants fail closed; tests authenticate all three commands and bounds in the plan digest, prove cleanup after storage drift, and constrain failed execute output to fixed stage/safe-code pairs without raw error or secret text |
| Phase 10 ranking authority   | `pnpm eval:ranking:validate` proves the additive proposed ranking-v1 30-case/6-family manifest, physical authority separation, request-independent candidate facts, reviewer-rationale closure, exact controlled-pair maximal sets, fixed-candidate and positive-pair closure, criterion bindings, and derived Phase 9 evidence-needed closure; `pnpm eval:ranking:fixtures` proves 21 hand-calculated scorer fixtures and legal zero denominators; `pnpm eval:ranking:baselines` reproduces five complete blind prediction sets in forward/reverse order and their aggregate reports; `pnpm eval:ranking:verify` adds candidate permutation/tie-overflow semantics, composition, the 20-candidate/2,000-evidence/60-criterion performance reference, contract-conformance, product-blindness, denied-effect/write, and read-only checks. Proposed gold remains independently unreviewed, all final gates remain unselected, and production ranking/M3 authority stay prohibited.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Future private data storage  | Integration tests for authorization, tenant isolation, retention/deletion, redaction, migrations, concurrency, and recovery after a concrete private-data design exists                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Adoption workflow            | A small end-to-end corpus across the five selected capability families, including “no viable candidate” and withheld-data paths                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Fixed-candidate evaluation   | Schema valid/invalid forms, bounded and inert JSON, manifest hashes, reference integrity, hard-safety gate, deterministic metrics, blind inputs, weak fixtures, and CLI exits                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

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

Phase 7 repository-interview quality evaluation uses the separate
`repository-interviews-v1` authority, not `pilot-v1` ranking gold. Its future
human audit files are content-minimized controlled verdict records. The
offline harness derives cohort counts from catalog-backed candidate documents,
derives each completed interview's full durable semantic-ID inventory from a
validated product exchange, requires exact primary coverage, selects the
review-policy-driven cohort-wide 10% secondary sample deterministically, and
restricts secondaries to their exact assigned subjects. Material disagreements
use narrow subject/unknown/policy-field adjudication records rather than full
replacement audits. Gate math consumes the reviewed gate policy and compares
exact integer cross-products without rounding. Reports bind every run, scope,
audit, adjudication, model-profile, corpus, and policy input digest.
Operational failures fail separately and never enter semantic denominators;
empty unknown-recall or basis denominators are invalid. Synthetic
prompt-injection fixtures test deterministic boundaries but do not substitute
for later blinded behavioral review.

Phase 8 uses a separately versioned retrieval/query authority rather than
reinterpreting pilot-v1 ranking gold, repository-interviews-v1 audit data, or
Phase 7 calibration candidates. Its initial corpus contains exactly 50 cases:
30 retrieval cases, exactly six per capability family, and 20 normalization,
clarification, and adversarial cases, exactly four per family. Normalization
gold, clarification gold, hard-filter expectations, graded relevance,
duplicate equivalence, and no-result expectations remain physically and
semantically separate. Blind query records contain no tags or audit
classifications; a separate classification authority is excluded from the
blind-only future baseline loader. Future ranking judgments are prohibited. Expected
hard-filter membership is generated from normalized queries, exact candidate
profiles, and versioned evaluation rules; it is not a hand-authored 50 by 150
matrix. Selected generated entries currently have bounded
proposed/not-reviewed audit samples; they do not claim independent human
review.

The authority defines Recall@10, MRR, NDCG@10, exact and equivalence-group
duplicate rates, category coverage, hard-filter correctness, top-10
hard-filter violations, no-eligible-candidate accuracy, clarification accuracy,
alias-expansion correctness, and prohibited-constraint preservation. A zero
denominator retains numerator 0 and denominator 0, has null value and
`not-applicable` status, and is excluded from macro means, never silently 0,
1, NaN, or Infinity. The 26 synthetic hand-calculated fixtures cover graded
gain, known rank, exact/equivalence duplicates, tri-state/lane safety,
negative controls, no-result, exact clarification/alias/prohibition including
source-set, facet, basis, rule, and representation forgeries, null
macros, stable rounding, ordering, and report digest. Milestone 6 adds three
ordinary deterministic baselines, weak/safety controls, a synthetic oracle,
and a drift-checked aggregate/per-family content-free verification report. It
tests byte-identical repeated and fresh-process output, reversed safe-authority
order, immutable inputs, exact ASCII ties, fixed-path writer denial, and a
read-only effect audit. Shared accepted-normalization metrics are explicitly
not independent baseline achievements, and no relative quality threshold or
winner is tested. Ordinary validation performs no provider or
model call and reads no Phase 7 database or repository-external evidence. A
final 150-candidate deterministic materialization proof remains separately
authorized and outside ordinary verification and hosted deterministic CI.

Phase 10 Milestone 2 adds a physically independent `ranking-v1` authority. Its
30 fixed-candidate cases are exactly balanced at six per capability family and
are not statistically representative. Blind requests, target fingerprints,
candidate sets, candidate evidence, Phase 9-style handoff state, proposed gold,
audit classes, review records, baseline specifications, frozen predictions,
aggregate reports, and future accepted gates are separate. Ordinary baseline
generation reads only the blind/evidence/handoff/specification subset and
finishes predictions before the scoring path loads gold. The target-blind
strategy receives neither target facts nor case identity. Forward and reversed
generation must match committed predictions exactly. Candidate evidence is
request-independent and per-fact labeled as a committed concept crosswalk or a
scenario-synthetic fixture; it carries no request criterion IDs or final
evidence-needed result. Tests derive coverage, conflicts, preference
consequences, and closure from the separate authorities and deny candidate-ID
fit branches, undocumented wildcard credit, tie splitting, and permutation
dependence.

Ranking-v1 scoring reports exact safety counts; per-disposition confusion,
precision, recall, and F1; responsible outcomes; ties, ordered relations, and
explicit incomparability; top-three usefulness; controlled-target changes;
three-state evidence-needed closure; traceability; and criterion-binding
behavior. Synthetic oracle fixtures validate scorer arithmetic only. Fixed
candidate ranking and retrieval-to-ranking composition remain separate, and
the latter runs the accepted Phase 9 implementation without changing its
authority. Evaluation source is offline and denies network/provider/model,
database, Docker, environment-secret, candidate-code, and unauthorized-write
effects. Contract conformance proves representability against the accepted
assessment contracts without adding product criterion-binding or ranking
schemas. Until independent review accepts the proposed gold and freezes exact
quality/performance gates plus either 13/18 or 14/18 readiness, Milestone 2 is
not accepted and Milestone 3 remains unauthorized.

Milestone 7A adds only offline and fake-effect coverage. Tests lock legacy
collector/profile/batch/receipt bytes and existing semantic suites, compile and
validate closed operational policy/source/coverage/receipt structures, prove
the mechanically derived 150-candidate request/source closure, strict language,
fork, community, license, runtime, and advisory parsing, and reproduce the pure
150-profile authority across input reversal, repeated calls, and a fresh
process. Receipt tests bind two collections and four A/B passes, provider drift,
semantic-versus-record digest behavior, run-ID tampering, failure
qualification, and content exclusion. Injected process/database/provider/
filesystem/signal boundaries prove validation-before-credential-read,
fresh-database planning, cancellation, cleanup, quarantine, disposal-before-
publication, and failure denial. These tests may run ordinarily; the preflight,
execute, and future fixed-evidence verifier commands themselves do not.

The post-health fresh-database boundary is tested independently from storage
startup. Its 0/0 host proof fixtures cover the fixed transient-code allowlist,
ten-attempt exhaustion, deterministic 250 ms sleeps, query and sleep
cancellation, per-attempt client teardown, nonretryable authentication,
arbitrary SQL, and nonempty-state failures, typed persistence-to-ingestion safe
conversion, and raw database-text denial. The isolated live correction gate may
exercise only accepted database creation, the 0/0 proof, and exact disposal; it
does not authorize migration, provider collection, or materialization execute.

Docker Desktop published-port regression tests additionally reject the former
`--internal` network plan, default/host/second-network widening, non-loopback
publication, and any unauthenticated `docker port` command mutation. Fake
process tests require exactly one loopback runtime mapping after health and
before host SQL, rejecting missing, wildcard, IPv6, wrong-port, multiline,
malformed, oversized, and nonzero results. One separately authorized isolated
gate may then exercise only database create, runtime port proof, the exact 0/0
host query, and disposal; provider, migration, catalog, and materialization CLI
effects remain prohibited.

The accepted isolated gate used the corrected non-internal bridge and passed
storage configuration, mount-conflict, runtime-tmpfs, internal-health, and
runtime loopback-publication checks before completing the host 0/0 query on its
first connection attempt. Exact disposal and independent container, network,
and volume absence also passed. This proof accepts the fresh-database boundary;
it is not a profile-materialization execution.

Execute 4 later passed that fresh-database and 0/0 boundary, then failed at the
coarse `migrate-schema-runtime-role-catalog-seed` stage before provider work.
Static review independently rejected the stage's `CREATE ROLE ... PASSWORD $1`
utility-command parameterization without inferring that it was execute 4's
exact failing statement. Runtime-role regressions exercise the real
Postgres.js transaction/tag/unsafe mock seam. They require transaction-local
bound role/password settings, fixed `%I`/`%L` PostgreSQL-side formatting,
exact least-privilege attributes and membership, password-safe SQL shape,
rollback, cancellation before schema inspection, value-free database failure,
and CLI redaction. The prior implementation produced 12 expected failures and
126 passes in the required four-file focused run; the corrected path passes all
138 focused tests.

Mocks do not establish the PostgreSQL utility grammar against a live server.
The runtime-role correction is therefore claimed only as deterministic offline
correctness: the required focused suite, complete normal suite, architecture,
and authoritative verification pass. The formerly planned real
`createProfileMaterializationSystemEffects` create/zero-state/complete
`prepareDatabase` correction gate was not completed. The live path remains
unproven, Milestone 7B is deferred, and no further Phase 8 materialization
diagnostic or execute 5 is authorized.

The Milestone 7A review-correction suites additionally prove runtime-login-only
catalog/profile persistence, exact observation-topic-to-evidence mapping,
150-entry first/second persistence-proof closure, qualified-not-persisted
behavior, source/persistence agreement, seeded-only denial, later-clock
unchanged-record reuse, mutable head drift, exact-commit immutable conflict,
and strict container-before-network cleanup including partial creation and
nonzero/final-absence failures. All persistence/process/provider effects remain
injected fakes; no database or network-backed test is authorized in 7A.

The final Milestone 7A correction directly exercises source-authority
reconciliation for exact-snapshot value/absence-to-unavailable transitions in
both directions while retaining established-fact contradiction denial and
head-advancement closure. Evidence tests remove a selected release's exact
`release-current` observation and challenge allowlisted-file mapping with
same-suffix paths, wrong commits, wrong paths, and prefix-only topics. They also
prove the shared release selector preserves legacy behavior, changed
observation prose is irrelevant, qualified transitions remain qualified, and
an earlier controlled failure remains in two-collection receipt accounting.

The qualified-recovery correction adds an injected two-collection journey in
both directions. A first qualified/unpersisted candidate that later succeeds
must create durable candidate/snapshot material and retain every generated
evidence identifier through reconciliation, proof parsing, idempotency
derivation, and receipt parsing; the earlier failure remains qualified and
cannot be called unchanged. The reverse complete-to-qualified journey retains
prior durable evidence only on unchanged facts, keeps the current unavailable
record, and claims no second mutation. Unit denials cover different nonempty
evidence lists, unqualified evidence loss, and evidence-only drift.
Repository-file mapping additionally rejects owner/repository mismatch, unsafe
source or immutable URLs, wrong commits/paths/topics, and percent-encoding
ambiguity.

Taxonomy validation is active from Milestone 2. Its no-write command rebuilds
the expected generated authority in memory and compares exact committed bytes.
Tests cover closed TypeBox roots, existing schema-digest preservation, graph
and deprecation closure, term-class collisions, ASCII-only exact lookup,
source permutations, locale independence, digest projection, fixed-path and
symlink rejection, bounded value-free diagnostics, and the semantic boundary
between each family and its adjacent negative-control terminology.

Deterministic profile validation is active from Milestone 4. Red-first suites
bind the exact immutable 27-field registry and scope partition; every closed
field/value/state/source variant; candidate ownership; version scope;
canonicalization-before-digest; hostile prototypes, accessors, cycles, and
sparse arrays; profile/authority ordering and digest drift; and fixed-path
generation defenses. Re-digested negative cases bind repository identity to
the profile owner and package-dependent applicability/publication identity to
the known package mapping. Projection tests prove that only four catalog extraction
rules are implemented, all 150 candidates close exactly, the three
package-dependent fields derive not-applicable solely from 70 known-unmapped
packages, and edits to rationale/prose-only inputs cannot change a profile.
Coverage tests close every per-field and per-family row and separately assert
2/16 candidate-side hard-filter readiness and 2/9 broad-retrieval readiness.
Evaluation tests keep unknown/conflict unresolved, apply not-applicable by
modality, ignore optional infrastructure for prohibited-dependency semantics,
and preserve non-taxonomy declarations without parsing their text.

Repository-interview audit tests authenticate both committed evaluation
authority and runtime provenance. They use only a loader-branded, deeply owned
and frozen corpus; supply one synthetic durable product exchange for each
completed run result; derive audit scopes internally; and prove that cloned
corpora, fabricated scopes, cross-result exchanges, exotic object graphs, and
post-validation mutations fail closed or cannot change report bytes. Alternate
policy arithmetic is tested through schema-validated pure policy inputs rather
than mutation of committed corpus authority.

The direct Responses adapter's synthetic stream tests prove active-reader
cleanup independently of durable attempt semantics. Pending reads are aborted
under deterministic deadline and external-cancellation control; cleanup
rejection, independent read rejection, invalid chunks, abort/read races, and
late enqueue attempts remain value-free and settle once. Tests count exactly
one reader cancellation for every abnormal active-read exit, require the lock
to be released, preserve retry classification, and separately prove that a
fully consumed response is not cancelled and both declared and streaming size
bounds retain their established cleanup paths. No real provider transport is
used.

Repository-interview operator tests use injected candidate controls and fake
time to prove active candidate/run deadlines from before artifact loading
through publication, already-aborted parent handling, retry-sleeper cleanup,
no post-deadline provider startup, concurrency-two fail-fast behavior, and
selection-ordered receipts. The ephemeral PostgreSQL suite additionally proves
that the exact candidate signal reaches real artifact loading and publication,
and that deterministic cancellation after a real artifact load creates no
partial history or provider call. Operator-policy schema conformance tests
exercise every field-level minimum, maximum, safe-integer ceiling, and string
grammar against the runtime parser; cross-field rules remain explicit runtime
tests.

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
