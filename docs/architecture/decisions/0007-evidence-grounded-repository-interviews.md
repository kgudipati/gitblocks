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

Aliases `A1` through `A4` follow ordered artifact-set membership. The model
sees trusted static instructions and questions, complete reconstructed
artifacts exactly once, machine aliases, controlled artifact kinds, and
machine-generated explicit line numbers.

It does not see chunks in addition to artifacts, dossier content, candidate or
repository identity, capability/ranking context, trusted IDs, provider
provenance, credentials, or execution metadata.

Repository-authored content always occupies an untrusted-data position. It
cannot become a system or developer instruction, enable a tool, change output
policy, or expand scope. No tools or previous/conversation state are enabled.

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

Required controls are exact dated snapshot, `store: false`, strict Structured
Outputs, disabled truncation, no tools/search/code/MCP/background/
conversation/previous response, low reasoning during calibration, in-memory
prompt-cache retention only, response-byte and candidate/run deadlines, at
most one eligible retry, bounded retry-header handling, and injected fetch,
clock, sleeper, and nonce.

Errors and telemetry are value-free. `store: false` does not imply zero
provider retention; separate provider abuse-monitoring retention is disclosed.
Extended prompt-cache retention remains disabled.

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

### Evaluation and human review

`repository-interviews-v1` is a new fixed-candidate evaluation authority and
does not reuse `pilot-v1` ranking gold. Its 30-candidate Gate A cohort contains
six candidates per capability family and deliberate documentation,
complexity, archive/move, negative-control, and unknown-producing variation.

Audit records are content-free. Reviewers load exact cited spans from immutable
artifacts by trusted IDs. Review is not persisted as production interview
rows.

The six-candidate calibration has two blind reviewers. Gate A has one
independent primary reviewer for all 30 candidates, mandatory second review
for unclear critical claims, disputes, suspected prompt injection,
outside-knowledge claims, and a deterministic 10% sample, with a third
adjudicator only for material disagreement.

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
- **Provider retention misunderstanding:** the operator discloses that
  `store: false` is not zero retention and disables extended caching.
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

- Artifact-alias mapping and exact artifact membership/line closure.
- Exact migration 0004 SQL and adapter APIs.
- Exact 30-candidate cohort and six calibration candidates.
- Final Gate A model-profile selection.
- Provider portability or another provider.
- Production review/selection contracts.
- Ranking-time accepted-interview selection and join policy.
- Retrieval, embeddings, ranking, MCP, Agent Skill, scanner, deployment,
  tenant/private data, queues, services, and production operations.

## Exit gates

Milestones 1 and 2 passed maintainer review. Milestone 3 may implement only the
three durable roots, trusted identity/record helpers, safe parsers, shared
topic authority, and cross-root provenance validation while the draft PR
remains draft. Milestone 4 requires separate maintainer review of the
completed Milestone 3 schemas, digests, tests, and recorded discoveries.

Calibration, Gate A, and Gate B each require the separate stop conditions and
explicit authorization recorded in Plan 0017. Passing an earlier gate never
implies authority for the next one.

## Official provider references

Provider facts in this decision were checked only against current official
OpenAI documentation:

- [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Data controls](https://developers.openai.com/api/docs/guides/your-data)
- [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)
- [GPT-5.4 snapshot and limits](https://developers.openai.com/api/docs/models/gpt-5.4)
- [GPT-5.4 mini snapshot and limits](https://developers.openai.com/api/docs/models/gpt-5.4-mini)

These external facts must be revalidated before implementing the adapter and
again immediately before a live gate.
