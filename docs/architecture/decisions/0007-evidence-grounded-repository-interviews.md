# ADR 0007: Evidence-grounded repository interviews

- Status: accepted
- Date: 2026-07-30
- Decision owners: GitBlocks maintainers
- Governing issue:
  [#17 — Phase 7: Establish evidence-grounded repository interviews](https://github.com/kgudipati/gitblocks/issues/17)
- Execution plan:
  [Phase 7 evidence-grounded repository interviews](../../plans/0017-evidence-grounded-repository-interviews.md)
- Related decisions:
  [ADR 0001](0001-agent-native-delivery.md),
  [ADR 0002](0002-typescript-workspace-and-toolchain.md),
  [ADR 0003](0003-product-contract-kernel.md),
  [ADR 0004](0004-postgresql-evidence-persistence.md),
  [ADR 0005](0005-public-repository-ingestion.md), and
  [ADR 0006](0006-immutable-repository-artifacts.md)

## Context

Phase 6 established exact, immutable, line-addressable public repository
artifacts. GitBlocks now needs bounded semantic synthesis that future ranking
can reuse without making a model the authority for source identity,
provenance, evidence, ranking, or recommendation.

The original Issue #17 flow was broader than the final maintainer decisions.
The latest issue comment excludes dossier content and identity from the
interview input, narrows the application and composition packages, authorizes
exactly three production contract roots, keeps review in evaluation, selects a
direct OpenAI adapter, fixes initial bounds and quality gates, and requires
calibration before choosing a model. This ADR records that amended boundary.

Milestone 1 added documentation and was accepted by maintainer review.
Milestone 2 added the accepted provider-output schema, immutable
specification, deterministic schema projections, offline validation, and
minimal package wiring. The next review accepted those exact snapshots and
authorized Milestone 3's three durable roots after a focused value-free
diagnostic cleanup. No review has authorized prompt rendering, provider,
persistence, operator, evaluation, or live behavior.

The next Milestone 3 review accepted the request and interview roots in
substance but required correction of model-execution provider identifiers,
final attempt/outcome closure, publication chronology, and real dated-snapshot
validation. The latest review accepted those corrections and schema digest
`f362632090107fc97b20708a24d5888f3d0e531f724887cc37dd5aa777a272b7`,
accepted Milestone 3 in full, and authorized only the persistence-independent
Milestone 4 renderer and mapping boundary. The latest review accepted
Milestone 4 and authorized Milestone 5 with the binding requirement that one
ephemeral rendered prompt object remain the exact provider/resolver context.
The next review accepted the Milestone 5 architecture but required
fail-closed exotic artifact-array ownership and provider response-effect
preflight before semantic mapping. The latest review accepted those
corrections and authorized only Milestone 6's forward migration 0004 and
concrete contract-grounded persistence operations. Milestone 6 review accepted migration 0004 and publication-side
transactions but required complete normalized-column reconciliation on every
read before renewed acceptance. The correction was accepted and Milestone 7
was authorized. Its first attempt correctly stopped because the original
per-family archived/moved stratum was impossible in the frozen catalog. The
binding amendment retains the exact cohort and makes lifecycle diversity a
cohort-level authority without catalog mutation or reclassification.
Maintainer review then accepted the cohort, calibration set, adversarial
membership, and lifecycle amendment but required complete durable inventory
closure, exact secondary scope, narrow order-independent adjudication,
policy-driven sampling/gate math, and complete gate-report provenance.

The next review accepted that semantic closure but found two remaining input
authority gaps: embedded run scopes were self-authenticating without their
durable exchanges, and the validated audit authority retained mutable caller
references. Its addendum also requires runtime authentication of the loaded
corpus so structural policy lookalikes cannot preserve stale digests. The final
Milestone 7 correction therefore brands only the fully validated owned/frozen
loader result, re-derives each completed scope from an exact durable exchange,
and owns and freezes the complete validated audit authority. Maintainer review
accepted Milestone 7 in full and authorized Milestone 8.

The first Milestone 8 pass correctly stopped without changing files after the
July 31, 2026 official OpenAI documentation recheck exposed a retention
conflict: omitting the prompt-cache retention field can allow effective
retention to depend on organization settings, including 24-hour retention.
The maintainer accepted that stop and amended this decision to require the
exact product-to-wire mapping `in-memory` to
`prompt_cache_retention: "in_memory"` for both authorized calibration
snapshots. Milestone 8 implements only the bounded direct protocol adapter and
offline fake-transport tests. The next review accepted that adapter boundary
in substance but required provider-envelope cancellation to retain HTTP
provenance and attempt/operation deadlines to remain authoritative after
asynchronous transport, parsing, and retry-sleep effects. Those narrow
corrections were accepted. The remaining review found that an abort during a
pending response read released the reader lock without actively cancelling the
stream. The bounded reader now cancels and releases once on abort, read
failure, invalid chunk, or streaming overflow while preserving the original
controlled outcome. Maintainer review accepted Milestone 8 in full and
authorized Milestone 9. The resulting
`apps/repository-interview-operator` is the sole composition root: it imports
only the three public workspace surfaces, verifies exact migration authority
without applying migrations, keeps credentials lazy, invokes only the accepted
interview application, and owns selection iteration, budget/deadline/fail-fast
controls, immediate reuse proof, content-free telemetry, and an immutable
local receipt. This is offline tested composition, not authority for a real
provider or non-test database. The subsequent Milestone 9 review accepted that
composition in substance and required three closure corrections before
Milestone 10: candidate deadlines must actively govern artifact load through
publication, the immediate-reuse guard must count its own invocation before
throwing, and the committed policy schema must express the actual runtime
bounds. The app now composes one candidate signal with the run signal, checks
it between every awaited phase, preserves only durable work completed before
the stop, and prevents already-aborted attempt or fetch startup. The policy
schema mirrors field-level runtime authority; cross-field and real-date rules
remain runtime validation concerns.

Maintainer review accepted those corrections and Milestone 9 in full,
including active candidate/run deadlines, candidate-scoped persistence,
provider, sleeper, and attempt authority, already-aborted startup denial,
truthful provider-call accounting, and immediate zero-call reuse. Hosted CI
run 83 is accepted.

The first Milestone 10 pass then correctly stopped because the committed
artifact manifest is declaration authority rather than a materialized-set
inventory. Phase 6 committed neither its raw receipt nor its ephemeral
database, and its completion document contains only aggregate evidence. A
historical set ID or identity digest therefore cannot be reconstructed and
must not be invented. The accepted amendment makes committed candidate plans
the offline membership authority and reserves selection materialization for a
fresh full-catalog receipt joined to receipt-named sets in the exact same
future ephemeral database.

## Decision

### Candidate-owned, request-independent intelligence

`RepositoryInterviewV1` is candidate-owned semantic intelligence generated
only from one exact immutable `RepositoryArtifactSetV1`.

It is independent of:

- capability requests;
- target repositories and fingerprints;
- hard constraints;
- developer preferences;
- ranking queries; and
- recommendation or selection tasks.

It never ranks, recommends, or chooses a candidate. Future ranking may join an
interview with deterministic dossier material, but each remains a separate
candidate-owned input with separate provenance.

This boundary makes one interview reusable across future target repositories
and prevents request-specific preferences from contaminating candidate-owned
semantic history.

### Artifact-set-owned semantic input and identity

The request, prompt identity, model-visible prompt, and durable interview
identity exclude:

- `CandidateDossierV1` observations;
- dossier limitations;
- dossier unknowns;
- dossier snapshot ID; and
- dossier digest.

The operator may load catalog or dossier state only to verify candidate
ownership and consistency before execution. That state cannot cross into
prompt assembly or interview identity.

Only the complete reconstructed artifacts in the exact artifact set are
semantic model input. The model receives each artifact exactly once. Chunks
remain lossless storage/reconstruction units and are not duplicated beside the
full artifacts.

### Model synthesis is not direct evidence

An immutable repository artifact is source material. A model-authored
documented-position claim is synthesis of a position explicitly stated in that
source; an inference is a conclusion with a stated reasoning step. Both remain
model output. The artifact span is direct source material, but the interview
claim is not relabeled as direct evidence.

This preserves the existing distinction among evidence, inference,
limitation, contradiction, and unknown. `RepositoryInterviewV1` is separate
from `CandidateDossierV1` and does not replace or extend dossier semantics.

### Provider output and durable contracts are separate boundaries

The provider may author only:

- documented-position claims;
- inferences and their rationales;
- limitations;
- contradictions;
- unknowns;
- temporary artifact aliases;
- one-based inclusive line ranges; and
- controlled confidence codes.

Provider output contains no trusted GitBlocks identity or provenance.

Trusted code derives or injects candidate, artifact-set and artifact IDs;
request, execution, interview and nested record IDs; provider/model
configuration; specification/schema/prompt digests; timestamps; identity and
record digests; persistence provenance; and publication eligibility.

The model never becomes an identity, provenance, acceptance, authorization,
ranking, or persistence authority. `RepositoryInterviewV1` has no production
review or acceptance field in Phase 7. A later reviewed or selected meaning
requires the deferred ranking-time selection decision.

### Production contract roots

Phase 7 defines exactly:

```text
RepositoryInterviewRequestV1
ModelExecutionV1
RepositoryInterviewV1
```

Repository-interview-specific claim, citation, limitation, contradiction, and
unknown shapes are nested under these roots. Existing dossier and fit
assessment nested records are not reused in a way that changes their ownership
or meaning.

Milestone 3 implements these roots as additive closed TypeBox schemas with
safe owned-data parsers and trusted constructors. Request identity is
artifact-set/specification/renderer/provider-output-schema/prompt owned.
Execution identity is a trusted nonce and normal/forced mode over a separately
reusable request/model-profile key. Interview identity binds mapped artifact
citations, ordered semantic identities, and exact request/execution
provenance. Wall-clock and terminal operation facts are record-only.

Provider request and response identifiers are nullable and restricted to
`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`; invalid values are not transformed or
echoed through diagnostics. A successful execution must close against a final
HTTP 200–299 response. Transport-terminal failure codes close against their
corresponding final transport outcome, while provider-envelope mappings remain
deferred to Milestone 8. Dated model-snapshot suffixes must be real proleptic
Gregorian dates. Cross-root validation requires interview publication at or
after execution completion; publication remains record-only.

Phase 7 will not create production roots or PostgreSQL roots for:

```text
RepositoryInterviewReviewV1
RepositoryInterviewSelectionEventV1
```

Human review and adjudication remain part of a separate evaluation authority.
Future ranking-time interview selection remains deferred.

### Application package and composition root

The application package will be:

```text
@gitblocks/interviews
```

It owns the repository-interview use case, persistence and provider ports,
deterministic prompt assembly, provider-output TypeBox schema and provider
projection, structured-output parsing, trusted alias mapping, citation and
semantic closure, durable mapping, and a narrow OpenAI adapter behind injected
transport.

It must not import `@gitblocks/persistence`, `@gitblocks/ingestion`,
evaluation tooling/data, or future ranking/retrieval packages. It remains
testable with fake ports and no network or PostgreSQL.

The composition root will be:

```text
apps/repository-interview-operator
```

It imports both `@gitblocks/interviews` and `@gitblocks/persistence`. It owns
process/environment/filesystem access, credentials, PostgreSQL wiring,
application-port implementations, live arguments, acknowledgement and cost
controls, receipts, and telemetry composition.

This follows the accepted inward dependency direction. It is not an
architecture exception. The existing workspace already includes `apps/*`.

Milestone 5 implements one narrow persistence-independent
`executeRepositoryInterviewV1` use case. Its closed input contains only the
exact artifact set and artifacts, loaded reviewed specification, exact model
profile, execution mode, and governed force reason. It renders internally,
creates the deterministic request and reuse authority, and injects all effects
through provider, record/reuse, clock, and nonce ports.

The rendered prompt is an ephemeral trusted value, not a caller or persistence
input. One non-reused operation retains one frozen prompt object and passes
that exact object instance to both the provider port and trusted output
resolver. It is never cloned, reconstructed, reloaded, or replaced between
those boundaries. The provider port receives only that object, the exact model
profile, and the loaded provider projection version, digest, and snapshot
text. The record port never receives prompt text, aliases, raw provider output,
or artifacts.

Normal reuse validates a complete request/execution/interview exchange selected
by request identity, model-profile digest, and reuse-key digest. Valid reuse
consumes no nonce, provider operation, clock read, or publication; poisoned
reuse fails closed without provider fallback. Forced execution skips lookup,
uses one injected nonce, preserves the reuse key, and appends a distinct
execution. Expected provider failures and invalid provider output publish only
the deterministic request plus a safe failed execution and null interview.
Successful resolution uses an injected publication clock, validates complete
cross-root closure, and publishes one immutable exchange.

The renderer treats the artifact array itself as untrusted input. Bounded
descriptor inspection must prove an ordinary array with zero through four
contiguous enumerable numeric data properties and no accessor, sparse,
non-enumerable, symbol, extra-property, nonstandard-prototype, or unsafe proxy
shape before any element access. It then copies descriptor values into a
frozen owned array for contract parsing. Shape or reflection failure returns a
value-free artifact-context result without invoking numeric getters. The
application independently catches any unexpected renderer exception before
record, provider, nonce, or clock effects.

A provider `response` effect is not semantic-output authority until the
accepted execution constructor proves a valid one-or-two-attempt history and a
final HTTP 2xx response. The application privately preflights the real usage,
then known-valid zero usage only when needed to distinguish genuine token
accounting failure from malformed attempt or terminal metadata. Genuine usage
failure becomes one published `invalid-usage` failed execution with null
usage, output digest, and interview before semantic resolution. Malformed
response metadata is a value-free provider-port failure with no resolver,
clock, or publication effect. A controlled failed effect must construct its
declared failed execution using the supplied nullable usage; invalid non-null
usage is never discarded and retried as null.

### Immutable specification and schema authority

Versioned interview material will live under:

```text
interviews/repository/specifications/1.0.0/
```

The first planned directory contains a closed specification manifest, static
instructions, ordered questions, a generated provider-neutral output schema,
a generated OpenAI strict projection, and a README describing reproduction.

The provider-output TypeBox definition in `@gitblocks/interviews` is the sole
executable schema source. Generated JSON schema snapshots may be committed
because a non-TypeScript provider boundary needs immutable exact bytes; they
must be reproducibly generated, canonicalized, digest checked, and never hand
maintained as competing authorities.

Specification version/digest, renderer version, prompt digest, output-schema
version/digest, provider-projection version/digest, and model-profile digest
remain distinct:

- semantic instructions, questions, topic/confidence meaning, provider-neutral
  schema semantics, or renderer meaning require a new semantic specification
  version;
- a provider-only rewrite preserving the authoritative accepted values uses a
  new provider-projection version/digest;
- one assembled artifact-set input receives a digest of the exact
  model-visible prompt bytes; and
- exact provider/model/request controls receive an immutable model-profile
  digest.

Once used live, a specification directory and model profile are immutable.
Prior execution reconstruction uses the exact artifact set plus these versioned
inputs and digests; duplicate raw prompt persistence is unnecessary.

### Deterministic prompt and untrusted-data isolation

Milestone 4 implements `repository-interview-renderer-v1` as two separate
strings. The future developer-role string contains the exact reviewed
instruction bytes followed by one frozen heading and the eight exact ordered
questions. The future user-role string is compact canonical JSON containing a
format kind, present artifacts, and unavailable selections.

Aliases `A1` through `A4` follow present-entry ordinal; `not-found` entries do
not consume aliases. Each present artifact exposes only alias, controlled kind,
line count, and one-based `{ number, text }` logical lines. LF, CRLF, and CR
share the Phase 6 contracts-owned splitter. Separators are omitted, every other
character is preserved, and empty plus terminal-empty lines remain
addressable. Each artifact line appears exactly once. Unavailable selections
expose only bounded ordinal/selector/kind/requirement/outcome metadata.

It does not see chunks in addition to artifacts, dossier content, candidate or
repository identity, capability/ranking context, trusted IDs, provider
provenance, credentials, or execution metadata.

Repository-authored content always occupies an escaped JSON data position,
separate from application-authored instructions. It does not alter the
rendered developer-role bytes or application policy. This structural boundary
does not claim that a model cannot behaviorally follow adversarial data;
Milestone 7 evaluation remains required. No tools or previous/conversation
state will be enabled by the future adapter.

Before rendering, public contract parsers and trusted closure checks require
one exact valid artifact set, zero through four valid artifacts, exact
candidate/numeric-repository/commit/path agreement, one-to-one present-entry
membership, correct logical-line counts, and the Phase 6 512 KiB aggregate
bound. Rendering additionally caps 40,000 logical lines, 65,536 instruction
bytes, 4,194,304 evidence bytes, and 4,259,840 combined bytes. Bounds fail
without truncation.

The prompt digest is lowercase SHA-256 over canonical JSON binding domain
`repository-interview-prompt`, digest version 1, renderer/specification
authority, and the exact instruction/evidence strings. The provider-output
digest is lowercase SHA-256 over canonical JSON binding domain
`repository-interview-provider-output`, digest version 1, provider-output
schema authority, and the exact parsed provider value. Exact Unicode and array
order remain significant.

### Citation semantics

The provider cites only alias, `startLine`, and `endLine`. Trusted mapping
resolves aliases to stable artifact IDs after generation.

Durable citations use artifact IDs plus one-based inclusive line intervals.
One citation stays within one artifact but may cross chunk boundaries because
chunks are reconstruction units. Multiple citations may jointly support one
semantic item. Prompts request the narrowest sufficient interval. Overbroad
but range-valid citations are human-audit findings; unknown aliases,
out-of-range/reversed intervals, or cross-set artifacts are validation
failures.

Milestone 4 returns one deterministic unique coordinate catalog plus
constructor-shaped claims, limitations, contradictions, and unknowns. Reuse of
one coordinate across semantic items produces one catalog entry while every
item retains its reference. The mapping creates no durable ID or timestamp.
Its fixed diagnostics preserve exact provider paths, cap issues at 20 and
paths at 256 characters, and contain no artifact, prompt, semantic, alias,
range, or repository values.

### Stable identities are trusted-code outputs

The provider generates no stable ID.

Trusted deterministic derivation will use kind/version domain separators,
canonical JSON, full SHA-256 identity digests, bounded stable ID prefixes, and
complete record digests. Identity digests exclude wall-clock and persistence
metadata; complete record digests include every persisted field except the
digest itself.

Model execution will have a reuse-key digest for unchanged
request/configuration. An explicitly forced rerun adds a trusted nonce to a new
execution identity and preserves both histories. A short-ID/full-digest
mismatch is a fatal collision, not idempotency.

### Immutable request, execution, and interview persistence

Migration 0004 persists `RepositoryInterviewRequestV1` as a first-class root,
not an execution subdocument. The request is the byte-deterministic reusable
authority for candidate/artifact-set, specification, renderer, provider-output
schema, and prompt identity and therefore has no operational timestamp.

Exactly eight append-only tables store request, execution, interview,
citation, claim, limitation, contradiction, and unknown records. Each keeps
bounded normalized identity, ownership, provenance, chronology, status, or
query columns plus the exact parsed contract value as canonical JSONB and full
identity/record digests. Attempts, usage, safe provider IDs, semantic text,
and contradiction positions remain inside their approved canonical contracts;
prompt/alias/artifact content, raw provider output/error/reasoning,
credentials, review, and selection data do not enter these tables.

Deferred PostgreSQL closure proves root-array/member equality, contiguous
ordinals, citation reference closure, exact `present` artifact-set membership,
inclusive line ranges within the stored artifact line count, and complete
request/execution/interview provenance. A successful execution owns exactly
one interview; a failed execution owns none. All eight tables reject
update/delete/truncate for owner and runtime connections. The runtime role has
only `SELECT` and `INSERT`; public has no schema, table, or function privilege,
and no RLS policy is introduced.

The concrete adapter exposes only atomic exchange publication, exact normal
reuse lookup, and closed historical loading by execution or interview ID.
Exact replay requires complete record and member equality. Short-ID/full-digest
collisions, record changes, partial history, and corrupt eligible history fail
closed without repair. Multiple executions may share one reuse key; forced
history is append-only and excluded from automatic normal reuse. A future
composition root, not either package, adapts these operations to the
application-owned record port.

Canonical JSONB and normalized columns are coequal read authority. The one
complete exchange loader reconciles execution storage candidate/artifact-set
context with its request and checks every typed semantic row's parent context,
ordinal, stable ID, controlled query fields, full digests, and canonical value
against the interview root. Publication reload, both historical lookup forms,
and normal reuse use this same path. Owner-level normalized drift or storage
damage therefore returns only `persistence.corrupt-record`; eligible corrupt
history is not skipped for a later execution.

### Complete scope and bounds

All Phase 6 artifacts in the exact set are reconstructed and included. No
artifact, line, question, semantic item, citation, or response item is silently
truncated.

Initial semantic bounds are:

```text
artifacts per candidate                 4
documented-position claims             24
inference claims                        8
total claims                           32
unique citations                       96
citations per semantic item             4
inclusive lines per citation           80
limitations                            12
contradictions                          6
unknowns                               16
provider output tokens              8,192
model concurrency default               1
model concurrency maximum               2
```

Every controlled topic is represented by a claim, limitation, contradiction,
or unknown. A context, byte, count, deadline, or cost overflow is an explicit
operational failure and publishes no interview.

### OpenAI adapter

The initial provider adapter uses injected direct `fetch` for:

```text
POST https://api.openai.com/v1/responses
```

It does not add the OpenAI SDK.

Credential, fetch, UTC/monotonic clock, sleeper, and per-attempt
cancellation/deadline control are injected; the package reads no environment,
file, global clock, timer, or default network transport.

The adapter sends one deterministically serialized request with the exact
dated snapshot, separate developer/user prompt strings, low/medium/high
reasoning from the profile, strict Structured Outputs through `text.format`,
the profile output-token bound, `store: false`, `background: false`,
`stream: false`, `tools: []`, `truncation: "disabled"`,
`service_tier: "default"`, and
`prompt_cache_retention: "in_memory"`. The last field is the sole mapping of
the accepted product value `promptCacheRetention = in-memory`; it is required
for both calibration candidates and cannot be supplied or overridden by a
caller, credential, environment, organization setting, transport, or response.
The adapter rejects `"24h"`, prompt-cache keys/options/breakpoints/TTL
controls, tools/search/code/MCP, background, conversation, previous response,
metadata, user identifiers, and trusted GitBlocks provenance.

Preflight checks the closed provider request, exact privately authenticated
prompt instance, parsed model profile, committed projection bytes/digest, and
10 MiB request bound before any injected effect. Responses are read through a
bounded stream, decoded strictly as UTF-8, and interpreted through allowlisted
status/output/usage/header fields. Attempts are capped at two, each at 120
seconds and the operation at 300 seconds; one deterministic retry is allowed
only for the reviewed network/deadline/408/409/429/5xx classes, with a bounded
30-second retry delay. Results are separately owned, deeply frozen where
structured data is retained, and contain no raw prompt, body, reasoning,
refusal, header, credential, or exception value.

Provider-envelope `cancelled` is a failed semantic outcome of a completed 2xx
response and therefore retains only the safe HTTP attempt provenance. External
controller or transport cancellation is a transport outcome and retains no
HTTP-derived provenance. The controller is checked after bounded body
settlement and again after protocol interpretation; a deadline or cancellation
at either finalization point discards late response data. Attempt completion
time is read after interpretation. After retry sleep, observed injected time
must leave the full 120-second second-attempt budget inside the 300-second
operation deadline; exactly 120 seconds is allowed and 119,999 milliseconds is
not.

Abnormal active-reader termination attempts one reason-free reader
cancellation and then releases the lock. Cancellation rejection and lock
release failure cannot replace a deadline, external cancellation, network, or
size classification. This resource cleanup is not provider provenance and is
not serialized; late body content is discarded. A fully consumed response is
released without cancellation, declared-size overflow cancels the unlocked
body, and streaming overflow cancels its reader exactly once.

`store: false` does not imply zero provider retention, and explicit
`"in_memory"` is request intent rather than proof that abuse-monitoring or
other organization-level retention is absent. Extended 24-hour retention is
not the GitBlocks profile. The adapter does not inspect or verify ZDR or
organization/project configuration. Before any real provider call in
Milestone 11, a separate pre-live gate must either verify ZDR for the exact
OpenAI organization/project or cite updated authoritative OpenAI documentation
or provider confirmation that resolves the July 31 conflict and proves the
explicit field's effective behavior for the exact snapshot.

### Strict-schema projection

OpenAI receives a deterministic projection rather than the unmodified
provider-neutral TypeBox schema.

The projection preserves supported enums, required fields, closed objects,
patterns/formats, numeric bounds, array bounds, and supported
definitions/references. It removes only explicitly allowlisted unsupported or
non-execution keywords such as `$schema`, `$id`, unsupported composition,
unsupported string-length constraints, and `uniqueItems` where provider
support lacks it. Unknown keywords fail generation rather than disappearing.

Local TypeBox parsing, byte/string/count limits, uniqueness, ordering, alias
resolution, citation closure, and semantic validation remain authoritative.
Strict provider output is defense in depth, not complete validation.

### Model eligibility and calibration

Only dated snapshots are eligible. Moving aliases are prohibited.

Initial calibration compares exactly:

```text
gpt-5.4-2026-03-05
gpt-5.4-mini-2026-03-17
```

Both use low reasoning on the same six candidates. Two blind reviewers compare
schema reliability, citation closure, support, unknown recall, basis
classification, injection resistance, outside-knowledge leakage, latency,
tokens, and cost. Neither snapshot is approved for Gate A until maintainers
accept the calibration and freeze one model-profile digest.

### Persistence and historical selection

Migration 0004 will append immutable model execution, interview, claim,
citation, limitation, contradiction, and unknown history. It will use
normalized ownership/closure/query fields plus canonical contract
reconstruction where useful.

Failed executions are represented without an interview. Valid interview
publication is atomic. Runtime roles receive minimum select/insert grants and
cannot update, delete, truncate, migrate, or change schema.

There is no mutable current-interview row. Historical loading and exact
input/configuration reuse are supported. Future ranking cannot infer review
acceptance from production history alone; a later ranking selection policy is
required.

### Offline pre-live and future materialization authority

Milestone 10 commits three content-free candidate plans: the exact six-member
calibration set, the exact 30-member evaluation cohort, and the complete
150-member public catalog. Plans bind the frozen catalog and artifact-manifest
authorities but contain no artifact-set, repository, commit, artifact, path,
URL, lifecycle, rationale, review, or materialization identity. The complete
plan is deterministically derived from the committed catalog during ordinary
read-only verification.

The two exact dated model profiles remain calibration candidates, not a model
selection or Gate A approval. Every pre-live CLI path authenticates the parsed
complete profile digest and canonical bytes against one of those two committed
authorities before policy compatibility, budgeting, clocks, secrets, database,
or provider effects. A content-free report and manifest bind the offline
authorities and reproduce byte-for-byte without rewriting them.

Readiness-policy `1.0.0` represents only staged calibration eligibility. Its
eight prerequisites are offline verification, fresh materialization,
retention, pricing, maintainer live authorization, ephemeral database,
provider credential, and audit-assignment readiness; each must be exactly
`satisfied`. `model-calibration` is the result gate and is not a prerequisite
to running calibration. `liveReady` means only that exact calibration is
eligible. Gate A and Gate B remain blocked in this version even when
calibration is eligible or the model-calibration result is satisfied.

Raw `public-artifact-receipt/1.0.0` semantics remain owned once by ingestion.
A non-production pre-live tool may depend on public ingestion, persistence,
operator, interview, contract, and evaluation surfaces. The operator app must
not depend on ingestion. Future materialization loads each set only by the
exact fresh receipt's `artifactSetId` from the same explicitly configured
database, parses and closes that loaded set, uses its recomputed
`identityDigest`, constructs the selection through the operator constructor,
and emits only an untracked selection plus content-free binding. Declaration
data, candidate-only lookup, historical state, or a database “latest” set can
never supply this authority.

The general receipt parser remains compatible with valid historical Phase 6
migration-`0003` receipts. The narrower complete pre-live parser requires the
receipt itself to record migration `0004`; this proof is validated before any
database password, database construction, set load, authorization validation,
output write, or provider possibility.

The materializer and non-dry operator verify PostgreSQL 18.4 and the exact
accepted 0001–0004 inventory but never apply migrations. All file and
cross-authority validation precedes database-password access; all database
closure precedes provider-token access or provider construction. A plan-only
dry-run may omit the materialization group and performs zero secret, database,
provider, clock, nonce, sleeper, timer, telemetry, or write effect. A real
pre-live authorization is never committed and can authorize only the exact
six-candidate calibration scope with both profile digests, at most 12 provider
calls, and at most USD 10 expressed as 10,000,000 micro-USD.

### Evaluation and human review

`repository-interviews-v1` is a new fixed-candidate evaluation authority and
does not reuse `pilot-v1` ranking gold. Its 30-candidate Gate A cohort contains
six candidates per capability family and deliberate documentation,
complexity, archive/move, negative-control, and unknown-producing variation.

The cohort has no exclusive primary stratum. Sorted, unique controlled
`selectionLabels` may express multiple pressures. Catalog status alone
authorizes negative-control, archived-lifecycle, and moved-repository labels.
The cohort contains five negative controls, three archived candidates, two
moved candidates, 12 rich-additional-documentation cases, and 18 README-only
cases. Rate limiting and webhooks intentionally require no lifecycle member;
all families still cover simple/helper, complex service/platform, and likely
material unknown pressure.

The evaluation authority binds exact catalog, artifact-manifest, production
schema, and interview-specification digests plus ordered byte digests for four
policy files, 30 candidate files, and 12 adversarial fixtures. Its
domain-separated corpus digest is
`82fefaa6428e2214caee4d88fd9c93b15782bf855cba1d8f69400028dd6a0dbf`.
It binds no model snapshot or model-profile digest. Twelve independently named
evaluation schemas remain outside the product contract catalog, including
separate durable audit-scope and narrow adjudication records.

Audit records are content-free. Every completed run result carries an audit
scope derived from one valid durable request/execution/interview exchange. It
binds those roots' complete record digests and the canonical ordered IDs of
every claim, limitation, contradiction, and unknown. A failed result carries
neither an interview nor a scope. Reviewers load exact cited spans from
immutable artifacts by trusted IDs. Review is not persisted as production
interview rows.

The six-candidate calibration has two blind reviewers. Gate A has one
independent primary reviewer for all 30 candidates, mandatory second review
for unclear critical claims, disputes, suspected prompt injection,
outside-knowledge claims, and a review-policy-driven deterministic 10% sample,
with a third adjudicator only for material disagreement. Each primary and both
calibration reviews cover the entire durable claim/limitation/contradiction
inventory. Secondary reviews cover only their mandatory and sampled subjects;
policy-only secondaries may carry an empty semantic set.

Audit documents contain opaque reviewer and durable item IDs plus controlled
verdicts; they contain no semantic text, citation text, source content, prompt,
model output, reviewer name, contact detail, or free-form note. Limitation and
unknown references close within the same durable interview. Adjudication uses
a separate record that names exactly two source reviews and replaces only
materially disputed subject, unknown, or individual policy-field keys; it
cannot replace a complete audit record or alter an undisputed value.

The secondary sample consumes the reviewed ratio, rounding, and scope fields;
the committed policy yields the deterministic SHA-256 ordered ceiling of 10%
of remaining material subjects across the complete Gate A cohort. Gate math
consumes the reviewed gate policy. Operational failures fail the gate outside
semantic denominators. Exact integer cross-products enforce semantic
thresholds, and empty unknown or basis denominators are invalid. The report
digest also binds the run, ordered audit scopes, audits, adjudications, model
profile, corpus, and all policy-file digests.

Evaluation authority is authenticated in memory as well as by digest. Only the
exact privately branded corpus returned by the complete loader may enter audit
validation. Each completed run result must have exactly one parsed successful
request/execution/interview exchange; failed results have none. Trusted code
derives the scope from that exchange, compares every provenance digest and
ordered item ID with the run evidence, and uses only the derived scope. The
final audit authority is a bounded deeply copied and deeply frozen plain-data
graph with no caller-owned run, audit, adjudication, exchange, corpus, or policy
reference.

### Quality and live gates

Gate A requires 100% schema/citation closure, zero cross-owner references, zero
unsupported/contradicted/partial critical claims, at most 5%
unsupported-plus-contradicted noncritical material claims, at most 15%
partially supported noncritical material claims with an explicit limitation,
at least 90% material-unknown recall, at least 90% basis correctness, and zero
injection, outside-knowledge, secret, source, provider-response, or prohibited
data leakage.

Provider, schema, citation, persistence, and policy failures are operational
failures outside the semantic denominator and fail the gate.

Gate B runs only after Gate A and explicit authorization. It covers all 150
candidates and immediately reruns without force to prove zero model calls and
exact reuse.

Hard spend stops are USD 10 for calibration, USD 40 for Gate A, and USD 120 for
Gate B. Crossing one requires new explicit maintainer authority before another
provider call.

## Consequences

### Benefits

- Semantic intelligence is reusable without target-specific contamination.
- Dossier and interview provenance stay independent and auditable.
- Model output cannot forge trusted identities or citations.
- Exact artifacts and line ranges make every semantic item reviewable.
- A persistence-independent use case remains unit-testable without network or
  PostgreSQL.
- Direct provider integration keeps the first dependency and error surface
  narrow.
- Immutable specifications, profiles, executions, and interviews preserve
  historical reconstruction and safe reuse.
- Human quality review remains independent from production records and future
  ranking policy.

### Costs and constraints

- GitBlocks owns deterministic prompt rendering, schema projection, protocol
  parsing, and provider drift monitoring.
- Full artifact scope may make some candidate/model profiles ineligible under
  context or cost limits; failure is explicit rather than truncated.
- Model nondeterminism requires a separate execution identity, calibration,
  human audit, and immutable history.
- Direct `fetch` gives less SDK convenience and requires careful protocol
  fixtures.
- Strict Structured Outputs still require comprehensive local validation.
- Content-free production telemetry limits protocol diagnosis; reviewed
  synthetic fixtures and safe provider/request IDs carry that burden.
- Future ranking needs a separately approved interview selection policy.

## Rejected alternatives

### Condition interviews on a fit request or target repository

Rejected because it destroys candidate-owned reuse, mixes ranking inputs, and
makes target preferences part of semantic repository history.

### Include dossier observations or identity in the prompt

Rejected because deterministic dossier material would be duplicated, could
bias semantic extraction, and would make interview identity depend on another
candidate representation. Ownership checks may use dossier/catalog state
outside the prompt only.

### Extend `CandidateDossierV1` with interview synthesis

Rejected because direct deterministic evidence and model synthesis have
different authority, provenance, versioning, and failure behavior.

### Create a second generic dossier

Rejected because its relationship to `CandidateDossierV1` would be ambiguous.
The narrow `RepositoryInterviewV1` name states source and purpose.

### Let the model emit stable IDs or provenance

Rejected because aliases and source text are untrusted. Identity, ownership,
configuration, and timestamps are trusted-code concerns.

### Send chunks and full artifacts

Rejected because it duplicates text, changes weighting, increases tokens, and
exposes storage mechanics. Chunks reconstruct exact artifacts only.

### Allow citations to use URLs, paths, or GitBlocks IDs

Rejected because those values expose provenance/identity authority to the
model and create mutable or forgeable references. Temporary aliases plus
trusted mapping are narrower.

### Use the OpenAI SDK first

Rejected because one fixed endpoint does not justify another production
dependency or broader provider type/default surface. A small injected adapter
better controls bytes, retries, errors, and test effects.

### Send the provider-neutral schema unchanged

Rejected because the product TypeBox subset and OpenAI strict subset are not
identical. A deterministic, reject-unknown projection preserves one semantic
authority without assuming unsupported keywords.

### Use moving model aliases

Rejected because executions and evaluations would not be reproducible.

### Enable tools or background mode

Rejected because extraction needs no external capability, and tools/state/
background enlarge prompt-injection, retention, timeout, and audit surfaces.

### Persist human review or a mutable current selection in migration 0004

Rejected because review is evaluation authority and ranking selection policy
is unresolved. A current pointer could silently overwrite or imply acceptance.

### Truncate artifacts to fit a model

Rejected because missing material could hide contradictions and unknowns while
appearing complete.

## Threats and mitigations

- **Indirect prompt injection:** repository content stays in a delimited
  untrusted-data role; no tools/state exist; adversarial fixtures and Gate A
  require zero violations.
- **Citation forgery:** the provider knows only aliases; trusted code validates
  alias membership and exact line ranges against the artifact set.
- **Identity/provenance forgery:** provider schema contains no trusted ID or
  provenance fields; local closed parsing rejects additions.
- **Outside knowledge:** instructions prohibit it, durable items require
  in-scope citations or explicit unknown semantics, and audit requires zero
  leakage.
- **Secret/privacy leakage:** only approved public artifacts are eligible;
  credentials never enter prompts; errors/telemetry/receipts are allowlisted.
- **Cost and denial of service:** bytes, counts, tokens, context, response size,
  time, concurrency, retry, run, and USD limits fail closed.
- **Provider retention misunderstanding:** the adapter explicitly sends
  `prompt_cache_retention: "in_memory"` and `store: false`, rejects 24-hour
  cache controls, and documents that neither value proves ZDR or absence of
  abuse-monitoring or organization-level retention. A pre-live gate must
  verify the exact organization/project or authoritative updated provider
  behavior before calibration.
- **History corruption:** forward migration, immutable rows, minimum grants,
  complete digests, atomic publication, and no current pointer.
- **Evaluation leakage:** production packages cannot import evaluation data;
  audit records are content-free and blind where required.

## Compatibility

The planned implementation is additive:

- existing nine contract roots and digests remain unchanged;
- `CandidateDossierV1`, fit-assessment contracts, and Phase 5 profile rules do
  not change;
- migrations 0001–0003 remain immutable;
- Phase 6 artifact identity, chunks, sets, and limits remain unchanged;
- `pnpm-workspace.yaml` already covers the planned app;
- no ranking/retrieval consumer is implied; and
- no production deployment or user-facing service is authorized.

Generated provider schemas are a documented exception to ADR 0003's earlier
“runtime exports only” present-state choice because Phase 7 has a concrete
immutable external provider/specification consumer. The TypeBox definition
remains sole authority, and deterministic generation/drift checks prevent a
second maintained schema.

## Recovery

- Before any live execution, specification/profile defects are corrected in
  place only while unpublished and unused. After live use, corrections receive
  additive versions.
- Failed requests and provider operations publish no interview. Failed
  execution metadata remains content-free and immutable when safely
  recordable.
- Failed publication rolls back the entire interview and nested rows.
- Unchanged retry/reuse returns exact historical records. Forced execution
  requires an explicit nonce and preserves both records.
- A migration defect rolls back transactionally before publication or receives
  a later forward migration after merge. Existing migration files and stored
  history are never edited as rollback.
- Application rollback stops new calls while preserving historical load and
  auditability.

## Deferred work

- Maintainer acceptance of Milestone 10's offline pre-live authority and
  synthetic/PostgreSQL evidence.
- Fresh full-catalog artifact collection and receipt in the exact future
  ephemeral database, followed by untracked selection materialization.
- Substantive retention and current pricing authority plus a separately
  approved, expiring calibration authorization.
- Final Gate A model-profile selection.
- Provider portability or another provider.
- Production review/selection contracts.
- Ranking-time accepted-interview selection and join policy.
- Retrieval, embeddings, ranking, MCP, Agent Skill, scanner, deployment,
  tenant/private data, queues, services, and production operations.

## Exit gates

Milestones 1–9 passed maintainer review. Milestone 10 implements only the
content-free offline pre-live authorities, future receipt-and-database
materializer, and synthetic/ephemeral-PostgreSQL verification. The committed
readiness state is `offline-verified-live-blocked`; neither dated profile is
selected, and Milestone 11 is not authorized by this implementation.

Calibration, Gate A, and Gate B each require the separate stop conditions and
explicit authorization recorded in Plan 0017. Passing an earlier gate never
implies authority for the next one.

## Official provider references

Provider facts in this decision were rechecked on July 31, 2026 only against
current official OpenAI documentation. That recheck produced the explicit
retention amendment recorded above rather than silently preserving the prior
omission:

- [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Data controls](https://developers.openai.com/api/docs/guides/your-data)
- [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)
- [GPT-5.4 snapshot and limits](https://developers.openai.com/api/docs/models/gpt-5.4)
- [GPT-5.4 mini snapshot and limits](https://developers.openai.com/api/docs/models/gpt-5.4-mini)

These external facts must be revalidated immediately before the separately
authorized pre-live gate. Neither calibration snapshot is selected by this
adapter implementation.
