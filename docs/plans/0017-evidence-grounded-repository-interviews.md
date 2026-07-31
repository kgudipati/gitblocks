# Phase 7 evidence-grounded repository interviews

## Status and authority

- Governing issue:
  [#17 — Phase 7: Establish evidence-grounded repository interviews](https://github.com/kgudipati/gitblocks/issues/17)
- Binding comments, in authority order:
  - “Maintainer clarification — separate provider output from the durable
    interview contract.”
  - “Maintainer architecture decisions — Phase 7 implementation may begin at
    Milestone 1.”
  - PR #18 review: “Milestone 1 accepted — Milestone 2 authorized with binding
    amendments.”
  - PR #18 review: “Milestone 2 accepted — Milestone 3 authorized after
    diagnostic cleanup.”
  - PR #18 review: “Milestone 3 review — request/interview roots accepted;
    model-execution correction required before Milestone 4.”
  - PR #18 review: “Milestone 3 accepted — Milestone 4 authorized.”
  - PR #18 review: “Milestone 4 accepted — Milestone 5 authorized with an
    exact-context requirement.”
  - PR #18 review: “Milestone 5 review — architecture accepted; two
    application-boundary corrections required before Milestone 6.”
  - PR #18 review: “Milestone 5 accepted — Milestone 6 authorized.”
  - PR #18 finding: migration 0004 and publication transactions accepted;
    complete normalized persistence-read authority required before Milestone
    6 acceptance.
  - PR #18 review: “Milestone 6 accepted — Milestone 7 authorized.”
  - PR #18 review: “Milestone 7 blocker accepted — cohort rule amended;
    implementation may proceed.”
- Branch: `feat/17-evidence-grounded-repository-interviews`
- Owner: repository maintainer
- State: Milestones 1–6 accepted; Milestone 7 is implemented under the amended
  cohort authority and awaiting maintainer review; Milestones 8–14 remain
  unauthorized or incomplete
- Last updated: 2026-07-31

The latest maintainer comment amends broader or conflicting language in the
issue body. Authority descends from Issue #17 and those comments, through
merged repository behavior and contracts, the product contract and accepted
ADRs, repository engineering policy, and then this plan. Contradictions are
recorded rather than silently reconciled.

[ADR 0007](../architecture/decisions/0007-evidence-grounded-repository-interviews.md)
owns the durable architecture decisions. This plan owns execution order,
planned file placement, review gates, tests, operational gates, and validation
evidence.

## Purpose and user-visible outcome

Phase 7 will establish one reusable candidate-owned semantic interview for one
exact immutable repository artifact set. The eventual interview will summarize
documented positions, bounded inferences, limitations, contradictions, and
material unknowns with resolvable artifact-and-line citations. It will remain
independent of any capability request, target repository, hard constraint,
developer preference, ranking query, or recommendation task.

Future ranking may join this semantic interview with the independently derived
`CandidateDossierV1`. Neither input will absorb the other's identity or
provenance. An interview will not rank, recommend, select, or itself become
direct evidence.

Milestone 1 delivered this plan, ADR 0007, and minimal authoritative
documentation reconciliation. Milestone 2 added only the provider-output
schema, immutable specification, deterministic schema projections, and their
offline package validation. Milestone 3 adds durable records and trusted
identity/parser behavior without a prompt renderer, provider, persistence,
operator, or user-visible execution path. Milestone 4 adds only deterministic
offline prompt rendering, exact artifact-set/alias/citation closure,
provider-output digesting, and durable-constructor input mapping. Milestone 5
adds one persistence-independent application flow, narrow effect ports,
deterministic reuse/force orchestration, and synthetic fakes. It adds no
concrete persistence, provider HTTP adapter, operator, database, evaluation
corpus, receipt, production telemetry, or live execution.
Milestone 6 adds only forward migration 0004 and concrete contract-grounded
operations in `@gitblocks/persistence`; it does not add application
composition, provider behavior, an operator, evaluation authority, or live
execution.
Milestone 7 adds only a separate offline evaluation authority, synthetic
fixtures, content-minimized future audit schemas, and deterministic gate math.
It performs no provider/model call, calibration, Gate A execution, human
review, production review-state mutation, or application composition.

## Verified repository state

The required starting-state checks completed on 2026-07-30:

```text
branch        feat/17-evidence-grounded-repository-interviews
worktree      clean
main          702bd7edc5b9a1de05dedc953e92af5cdc9785d9
origin/main   702bd7edc5b9a1de05dedc953e92af5cdc9785d9
HEAD          702bd7edc5b9a1de05dedc953e92af5cdc9785d9
last commit   702bd7e feat: establish immutable repository artifacts (#16)
```

`git fetch origin` completed before those values were recorded. The branch
already existed locally at the exact required base, so it was retained without
rebasing or recreation.

The current runtime and package-manager pins are Node.js `24.18.0` and pnpm
`11.17.0`. Current production packages are exactly:

```text
@gitblocks/domain
@gitblocks/contracts
@gitblocks/persistence
@gitblocks/ingestion
```

Current migrations are exactly 0001 through 0003. The current contract catalog
contains nine roots. No `@gitblocks/interviews`, repository-interview operator,
migration 0004, interview specification, provider projection, interview
evaluation authority, or Phase 7 root contract exists at the start.

## Scope and non-goals

### Milestone 1 scope

- Record the resolved architecture in ADR 0007.
- Record the complete red-first implementation and live-proof plan here.
- Clarify the candidate-owned, artifact-set-owned product boundary.
- Reconcile the planned component, trust, testing, and telemetry boundaries in
  the minimum authoritative documentation.
- Publish one ordinary documentation commit and an early draft PR.

### Later Phase 7 scope

- Exactly three new production contract roots:
  `RepositoryInterviewRequestV1`, `ModelExecutionV1`, and
  `RepositoryInterviewV1`.
- Interview-owned nested claim, citation, limitation, contradiction, and
  unknown shapes.
- A persistence-independent `@gitblocks/interviews` application package.
- An explicit `apps/repository-interview-operator` composition root.
- A deterministic versioned interview specification and generated schema
  projections.
- A bounded direct OpenAI Responses adapter behind injected capabilities.
- Forward migration 0004 and persistence adapter operations.
- A separate `repository-interviews-v1` evaluation authority, adversarial
  fixtures, model calibration, Gate A audit, Gate B full run, and content-free
  completion evidence.

### Explicit non-goals

- Conditioning interviews on capability requests, target repositories, hard
  constraints, developer preferences, ranking queries, or recommendation
  tasks.
- Ranking, recommending, selecting, retrieval, embeddings, vector storage,
  MCP, Agent Skill, scanner, or adoption-plan implementation.
- Supplying dossier observations, limitations, unknowns, snapshot identity, or
  digest to the model or interview identity.
- Treating model synthesis as direct evidence.
- Production roots for `RepositoryInterviewReviewV1` or
  `RepositoryInterviewSelectionEventV1`.
- A mutable “current interview” row, ranking-time selection policy, or
  production review workflow.
- Model tools, web search, file search, code interpreter, MCP, background mode,
  conversations, or previous-response state.
- The OpenAI JavaScript SDK in the initial implementation.
- Candidate code execution, repository cloning, package installation, link
  following, rendered repository content, private repository bodies, target
  repository bodies, secrets, or credentials in prompts.
- A dependency, executable Phase 7 file, database change, model call, or live
  operation in Milestone 1.

## Requirements crosswalk

| Requirement                                            | Authoritative destination                            | Delivery gate        |
| ------------------------------------------------------ | ---------------------------------------------------- | -------------------- |
| Candidate-owned, request-independent interview         | ADR 0007; product contract                           | Milestone 1 accepted |
| Artifact-set-only semantic input and identity          | ADR 0007; prompt/spec tests                          | Milestones 1, 4      |
| Provider output separated from durable mapping         | ADR 0007; provider schema and mapper                 | Milestones 2–4       |
| Three production contract roots                        | `packages/contracts`                                 | Milestone 3          |
| Persistence-independent application package            | `packages/interviews`                                | Milestone 5          |
| Composition-root-owned persistence and process effects | `apps/repository-interview-operator`                 | Milestone 9          |
| Immutable versioned specification                      | `interviews/repository/specifications/`              | Milestone 2          |
| Bounded direct OpenAI adapter                          | `packages/interviews` adapter                        | Milestone 8          |
| Immutable PostgreSQL history                           | migration 0004 and adapter                           | Milestone 6          |
| Independent audit authority                            | `evals/repository-interviews-v1` and harness support | Milestone 7          |
| Calibration and human review                           | content-free evaluation records                      | Milestones 11–12     |
| Full run and zero-call reuse                           | explicit operator and receipts                       | Milestone 13         |
| Content-free completion evidence                       | catalog completion document                          | Milestone 14         |

## Resolved maintainer decisions and assumptions

### Resolved

- The durable name is `RepositoryInterviewV1`; it is not another generic
  dossier.
- The interview is candidate-owned and bound to one exact
  `RepositoryArtifactSetV1`.
- `CandidateDossierV1` and all dossier-derived identity are excluded from the
  request, prompt, model-visible input, and durable interview identity.
- Future ranking will join dossiers and interviews as separate candidate-owned
  inputs with separate provenance.
- Provider structured output carries semantic payload only. Trusted code owns
  identity, provenance, mapping, timestamps, digests, and persistence data.
- Exactly three new production roots are planned. Human audit remains an
  evaluation concern, and ranking-time selection remains deferred.
- `@gitblocks/interviews` owns the application use case and ports without
  importing persistence or ingestion. The operator app imports both interviews
  and persistence and performs composition.
- `apps/*` is already a workspace glob. No workspace-glob change is needed.
- The initial provider is a narrow direct fixed-host `fetch` adapter, not the
  OpenAI SDK.
- Only exact dated model snapshots are eligible. The first calibration
  compares `gpt-5.4-2026-03-05` and
  `gpt-5.4-mini-2026-03-17`, both at low reasoning.
- Complete artifact scope is mandatory. Any size, token, deadline, or cost
  overflow stops explicitly; it is never truncated into apparent success.

### Facts that must be remeasured before live work

- Exact rendered UTF-8 bytes and tokens for every selected candidate.
- Exact static instruction, question, schema, and framing overhead.
- Provider-response byte distribution and latency under the approved
  calibration.
- Actual usage-field behavior for both eligible snapshots.
- Account-specific rate limits and retry headers at the authorized live
  boundary.
- Review time per material item and resulting Gate A staffing estimate.

No favorable assumption may replace these measurements.

## Current architecture and reusable Phase 6 components

Phase 6 already supplies:

- immutable `RepositoryArtifactV1`, `RepositoryArtifactChunkV1`, and
  `RepositoryArtifactSetV1` TypeBox roots;
- exact artifact identity and complete record digests;
- `exact-lines-v1` one-based inclusive line metadata over exact UTF-8 content;
- atomic closed artifact-set publication;
- `loadRepositoryArtifactSet` and chunker-scoped
  `loadRepositoryArtifact`;
- candidate and artifact-set ownership closure in PostgreSQL;
- exact historical reconstruction with complete-record validation;
- injected operation control, timeouts, cancellation, value-free errors, and a
  non-owner runtime role; and
- an ordinary-test network guard plus content-free operator receipt patterns.

Chunks remain storage and reconstruction units. They are not repeated beside
full artifacts in the model prompt. Prompt citations address the reconstructed
artifact line space, and trusted mapping resolves those ranges to artifact IDs.

The definitive Phase 6 run measured:

| Fact                            | Measured value |
| ------------------------------- | -------------: |
| Candidates                      |            150 |
| Artifacts                       |            180 |
| Chunks                          |            407 |
| Materialized artifact bytes     |      2,725,206 |
| Maximum artifact size           |  190,425 bytes |
| Maximum chunks for one artifact |             24 |
| Selections for one candidate    |      at most 4 |
| Contract candidate byte ceiling |        512 KiB |

The first four values are recorded in
[`catalog/public-v1/artifact-completion.md`](../../catalog/public-v1/artifact-completion.md).
The maximum observations are bounded Phase 6 corpus measurements supplied by
Issue #17 authority. Phase 7 will not inspect or commit candidate bodies while
authoring its evaluation authority.

## Planned architecture and dependency design

All nodes in this diagram are planned; none is implemented by Milestone 1.

```mermaid
flowchart LR
    Contracts["@gitblocks/contracts"]
    Interviews["@gitblocks/interviews<br/>application use cases and ports"]
    Operator["apps/repository-interview-operator<br/>composition root"]
    Persistence["@gitblocks/persistence<br/>concrete PostgreSQL adapter"]
    OpenAI["OpenAI Responses API<br/>fixed-host adapter"]
    Evaluation["repository-interviews-v1<br/>evaluation authority"]

    Interviews --> Contracts
    Operator --> Interviews
    Operator --> Persistence
    Operator -->|"inject fetch transport"| Interviews
    Interviews -->|"provider port"| OpenAI
    Evaluation -.->|"black-box quality and audit only"| Operator
    Persistence --> Contracts
```

`@gitblocks/interviews` will own:

- repository-interview use cases;
- persistence and provider ports;
- deterministic prompt assembly;
- the authoritative provider-output TypeBox schema;
- deterministic provider-specific schema projection;
- structured-output parsing;
- alias-to-artifact mapping;
- citation and semantic closure;
- deterministic durable-contract mapping; and
- a narrow OpenAI adapter behind injected transport.

It must not depend on:

```text
@gitblocks/persistence
@gitblocks/ingestion
tools/evaluation-harness
evals/
ranking or retrieval packages
```

`apps/repository-interview-operator` will own process/environment access,
filesystem configuration, argument parsing, credentials, PostgreSQL adapter
wiring, application-port implementations, acknowledgement and cost controls,
receipts, and safe telemetry composition. This is the existing inward
application/adapter direction and requires no architecture exception.

Planned allowed Node APIs for `@gitblocks/interviews` are the minimum needed
for deterministic UTF-8 byte accounting, hashing, abort composition, and the
direct adapter: `node:crypto` plus Node 24 global `fetch`, `URL`, `Buffer`,
`TextDecoder`, `AbortSignal`, and timers only through injected clock/sleeper
ports. Milestone 5 confirms the existing dependency-cruiser boundary without
adding a Node API or exception. The package performs no import I/O, environment
read, singleton creation, network request, database access, or scheduling.

Milestone 5 confirmed the existing package boundary with no architecture
exception: application effects are injected through narrow provider,
record/reuse, clock, and nonce ports, and `@gitblocks/interviews` still imports
neither persistence nor ingestion.

### Workspace wiring

Milestone 2 added `@gitblocks/interviews` and its package/root verification
wiring. Milestone 5 needs no package-manifest, root-script, workspace, Vitest,
coverage, TypeScript-reference, or dependency-cruiser change. Milestone 9 will
add the operator app. Current and planned wiring is:

- root `tsconfig.json` references `packages/interviews` after contracts; the
  future operator follows interviews/persistence;
- `build:product` and `typecheck:internal` already select interviews; the
  future operator becomes another selected consumer;
- dependency-cruiser already scans interviews source/scripts/tests and proves
  that the package imports contracts but not persistence or ingestion; the
  future operator may import interviews and persistence;
- ordinary Vitest and coverage already include interviews; future database
  integration will cover persistence and operator composition through the
  non-owner role; and
- `pnpm-workspace.yaml`, Node/pnpm pins, and existing package names remain
  unchanged.

No separate task runner, dependency-injection framework, schema library, HTTP
library, retry package, or SDK is planned.

## Provider output and durable contract boundary

```mermaid
sequenceDiagram
    participant O as Operator composition root
    participant I as @gitblocks/interviews
    participant P as Provider adapter
    participant S as Interview persistence port

    O->>I: Trusted candidate and exact artifact-set request
    I->>I: Reconstruct, verify, alias, line-number, and digest prompt
    I->>P: Trusted instructions plus untrusted artifact data
    P-->>I: Untrusted semantic-only structured output
    I->>I: Parse, bound, order, resolve aliases and line ranges
    I->>I: Derive trusted IDs, provenance, and durable roots
    I->>S: Persist immutable execution and interview
    S-->>I: Exact stored record or idempotent reuse
    I-->>O: Content-free outcome and receipt facts
```

### Provider structured output

The sole executable schema source will be a TypeBox definition owned by
`@gitblocks/interviews`. Its planned root is a closed object containing five
required arrays:

| Semantic collection   | Planned contents                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `documentedPositions` | topic, bounded statement, confidence code, one to four alias/range citations                                                                                |
| `inferences`          | topic, bounded statement, required bounded rationale, confidence code, one to four alias/range citations                                                    |
| `limitations`         | topic, documented-position or inference basis, bounded statement, nullable rationale governed by basis, matching confidence code, and one to four citations |
| `contradictions`      | topic, direct/scope-dependent/version-dependent kind, bounded explanation, and two explicitly opposed positions with one to two citations per side          |
| `unknowns`            | topic, controlled reason, bounded artifact-set-scoped statement, and zero to four partial citations                                                         |

A provider citation contains only:

```text
artifactAlias
startLine
endLine
```

Provider output contains no stable ID, candidate ID, artifact-set ID, artifact
ID, repository identity, provider provenance, model configuration,
specification digest, timestamps, record digest, review state, ranking result,
or recommendation. The output wrapper will not ask the model to echo trusted
version or identity fields.

Confidence is basis-specific rather than a generic score. Documented positions
and documented-position limitations permit `high` or `medium`; inferences and
inference limitations permit `medium` or `low`. Contradictions and unknowns
carry no confidence. `high` means every material clause is explicit and
unambiguous in narrow citations; `medium` means a direct position is qualified,
distributed, or materially scope-sensitive, or that an inference has a
bounded bridge with limited uncertainty; `low` is reserved for materially
uncertain but useful inferences. Confidence is not probability, review state,
or permission.

The initial provider-output limits proposed for that review are:

| Field or shape                          |                            Proposed local limit |
| --------------------------------------- | ----------------------------------------------: |
| Topic                                   |                   one of eight controlled codes |
| Statement/side text                     | 500 Unicode scalar values and 2,048 UTF-8 bytes |
| Rationale/contradiction explanation     | 750 Unicode scalar values and 3,072 UTF-8 bytes |
| Artifact alias                          |                          `A1` through `A4` only |
| Line number                             |                                1 through 10,000 |
| Documented-position/inference citations |                                     1 through 4 |
| Limitation citations                    |                                     1 through 4 |
| Unknown partial citations               |                                     0 through 4 |
| Contradiction citations                 |                1 through 2 per side and 4 total |
| Citation span                           |                      at most 80 inclusive lines |

All root and nested properties are required for strict output; an empty
required array represents “none.” Local validation enforces Unicode/UTF-8,
cross-field span, uniqueness, and global-count limits even when provider
projection cannot express them.

### Proposed question and topic vocabulary

The first semantic specification proposes exactly this ordered vocabulary:

| Topic code                  | Controlled question                                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `purpose-and-scope`         | What capability, intended use, smallest useful adoptable unit, ideal use cases, and explicit out-of-scope or poor-fit boundaries does the repository describe? |
| `runtime-and-framework`     | What runtime, framework, platform, language, or version requirements and compatibility positions are documented or responsibly inferable?                      |
| `integration-surface`       | What setup path, APIs, configuration surface, extension points, dependencies, or integration boundaries are described?                                         |
| `data-and-state`            | What data model, storage, durability, consistency, migration, or state-management positions are described?                                                     |
| `deployment-and-operations` | What required or optional infrastructure, deployment models, scaling, failure, retry, observability, and operational responsibilities are described?           |
| `security-and-trust`        | What authentication, authorization, secret handling, validation, isolation, abuse, or trust-boundary positions are described?                                  |
| `maintenance-and-support`   | What license position, maintenance status, compatibility, upgrade, release, support, or deprecation constraints are documented?                                |
| `adoption-and-limitations`  | What adoption effort, explicit limitation, tradeoff, contradiction, or material unknown remains after reviewing all supplied artifacts?                        |

Questions ask for repository positions, not fit conclusions. They do not name a
capability family, target environment, or recommendation criterion. This exact
ordered vocabulary is frozen for specification `1.0.0`; after that
specification is used live, semantic changes require a new version.

### Durable mapping

Trusted code will inject or derive:

- candidate, artifact-set, and artifact IDs;
- request, execution, interview, claim, citation, limitation, contradiction,
  and unknown IDs;
- exact provider and model-profile configuration;
- specification, prompt, output-schema, and provider-projection digests;
- started, completed, persisted, publication, and provider timestamps;
- identity, reuse-key, and complete-record digests;
- attempt/retry metadata and safe provider request IDs;
- persistence migration and adapter provenance; and
- publication eligibility.

`RepositoryInterviewV1` has no production review or acceptance field in Phase 7. Human audit and adjudication belong to separate content-free evaluation
records. Any later accepted or selected production meaning requires the
deferred ranking-selection decision.

## Planned production contracts

Milestone 3 implements the exact TypeBox field definitions and parser limits
test-first. The following ownership and partitions are executable contract
authority pending maintainer review.

### `RepositoryInterviewRequestV1`

The request identifies one candidate and one exact artifact set plus
the immutable semantic specification and deterministic renderer inputs. It
will not carry dossier material or provider/model configuration.

Exact fields:

- `contractVersion`;
- trusted `requestId`;
- `candidateId`;
- `artifactSetId` and `artifactSetIdentityDigest`;
- `specificationVersion` and `specificationDigest`;
- `rendererVersion`;
- `providerOutputSchemaVersion` and canonical schema digest;
- `promptDigest`;
- `identityDigest`; and
- `recordDigest`.

The request identity will bind every field above except `requestId`, then
trusted code will derive `requestId` from that identity digest. The prompt
digest will prove exact deterministic assembly without persisting another copy
of the raw prompt.

### `ModelExecutionV1`

The execution root represents one bounded provider-call operation,
including failed operations, without embedding prompt or response bodies.

Its exact identity partition is:

- request identity digest;
- provider code and fixed endpoint profile;
- exact dated model snapshot;
- immutable model-profile digest;
- provider-projection digest;
- reasoning effort;
- maximum output tokens;
- `store: false`, no-tools, no-state, no-background, and in-memory-cache
  controls;
- operator-supplied force nonce when and only when a forced rerun is
  authorized; and
- a deterministic retry-policy version.

The execution reuse-key digest excludes force nonce, timestamps, provider
request ID, usage, latency, and outcome. A normal run resolves an existing
successful execution and its exact interview by reuse key without a provider
call. A forced run requires an explicit trusted nonce, creates new immutable
history, and never overwrites the earlier execution.

The complete record additionally contains execution ID, request ID, one or two
bounded attempt summaries, root/attempt timestamps, terminal outcome, safe
provider request/response IDs, validated usage counters, response-byte and
duration metadata, stable failure code, and identity/reuse/record digests.
Provider identifiers are nullable and must match
`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`; invalid provider text is rejected
without transformation or diagnostic disclosure. A successful outcome
requires a final response with HTTP status 200–299. The transport-terminal
failure codes `transport-error`, `deadline-exceeded`, and `cancelled` must
agree with the final attempt, while other provider failure mappings remain
deferred to Milestone 8. The dated model-snapshot suffix is structurally fixed
and semantically validated as a real proleptic Gregorian date.
Persistence provenance remains outside this provider-execution contract.
Prompt text,
provider response text, reasoning text, refusal text, and raw error bodies are
prohibited.

### `RepositoryInterviewV1`

The durable interview contains:

- contract version;
- trusted interview ID;
- candidate, artifact-set, request, and successful execution IDs;
- specification, renderer, prompt, provider-output-schema, provider-projection,
  and model-profile digests;
- deterministic processing state: `complete`, `partial-evidence`, or
  `insufficient-evidence`;
- ordered documented-position and inference claims;
- ordered limitations, contradictions, and unknowns;
- published timestamp; and
- identity and complete-record digests.

An interview is never direct evidence. A documented-position claim means the
artifact explicitly states the position; the durable citation points to the
direct artifact span, while the claim remains model-authored synthesis. An
inference means the artifacts support a conclusion only through the included
rationale. The basis may not be changed during mapping.

Nested citations will use stable artifact IDs and one-based inclusive
`startLine`/`endLine`. A range must stay within one artifact; it may cross any
number of storage chunks because chunks are reconstruction units, not semantic
boundaries. Multiple citations jointly support one item but cannot substitute
for a missing citation required by that item's semantics. Ranges are requested
as the narrowest sufficient interval; a range-valid but overbroad citation is
a human-audit finding rather than a parser failure.

Deterministic ordering is controlled topic order, then semantic basis, exact
Unicode statement order, and full identity digest. Root citations order by
artifact ID, `startLine`, `endLine`, and identity digest. Mapping rejects
duplicates before ordering. Every controlled topic must be represented by at
least one claim, limitation, contradiction, or unknown.

ID inputs will include the execution ID, semantic kind, topic, exact semantic
text, rationale where applicable, confidence, and ordered resolved citations.
Citation IDs will include execution ID, artifact ID, and inclusive interval.
The interview identity will bind the ordered nested identities and all
identity-bearing provenance. Complete record digests additionally bind
timestamps and persistence metadata. A truncated-ID/full-digest mismatch is a
fatal identifier collision; it is never treated as idempotency.

### Deferred production contracts

Phase 7 will not create:

```text
RepositoryInterviewReviewV1
RepositoryInterviewSelectionEventV1
```

Evaluation review/adjudication records remain private test instruments.
Selecting a reviewed/accepted interview for future ranking requires a later
ranking-time policy and contract decision.

## Interview specification and deterministic prompt

### Immutable layout

The first planned live-capable directory is:

```text
interviews/repository/specifications/1.0.0/
  README.md
  specification.json
  instructions.md
  questions.json
  provider-output.schema.json
  providers/
    openai-responses.strict.schema.json
```

This layout separates:

- human-readable static instructions;
- a closed machine-readable specification manifest;
- a controlled ordered question vocabulary;
- a generated provider-neutral schema snapshot; and
- a generated provider-specific strict projection.

The authoritative provider-output TypeBox definition remains under
`@gitblocks/interviews`; neither JSON file is hand maintained. A deterministic
generator will recreate both snapshots, canonicalize them, and fail on drift.
`specification.json` will bind file digests, question order, semantic version,
renderer version, output-schema version/digest, and projection version/digest.

The specification digest will cover the canonical specification manifest with
its digest omitted plus the exact bytes/digests of instructions, questions,
and provider-neutral schema. The provider-projection digest is separate so a
provider-only compatibility rewrite can evolve without silently changing
provider-independent semantics. The prompt digest will cover only the exact
model-visible prompt bytes assembled for one artifact set; provider/model
configuration remains separately bound by the immutable model-profile digest.

A change to questions, semantic instructions, topic/confidence meaning,
provider-neutral output semantics, artifact rendering, or durable mapping
meaning requires a new semantic specification version. A projection-only
change that preserves the authoritative schema's accepted values receives a
new provider-projection version and digest. Once used by a live execution, a
specification directory is immutable; corrections use a new directory.

Prior execution reconstruction needs the immutable artifact set, specification
directory, renderer version, output and projection digests, model-profile
digest, and execution metadata. Duplicate raw prompts and raw provider
responses are not persisted.

### Model-visible prompt

Milestone 4 freezes two separate strings under
`repository-interview-renderer-v1`.

`instructionText`, intended for a future developer-role message, is:

```text
<exact instructions.md bytes>
Repository interview questions:

1. [purpose-and-scope] <exact reviewed question>
...
8. [adoption-and-limitations] <exact reviewed question>
```

The instructions already end in LF; renderer V1 appends one additional LF,
the exact heading above, one blank line, the eight ordered lines, and one
terminal LF.

`evidenceText`, intended for a future user-role message, is compact canonical
JSON with sorted object keys and exactly:

```text
kind: repository-interview-evidence-v1
artifacts:
  alias
  artifactKind
  lineCount
  lines:
    number
    text
unavailableSelections:
  selectionOrdinal
  selector
  artifactKind
  requirement
  outcome: not-found
```

Artifacts are ordered by alias, lines by ascending one-based number, and
unavailable selections by artifact-set ordinal. LF, CRLF, and CR use the
contracts-owned logical-line splitter. Separators are omitted from line text;
all other characters, blank lines, and a terminal empty line after a final
separator are preserved. JSON escaping makes quotes, backslashes, braces,
role declarations, Markdown, HTML, JSON-looking fields, links, and tool
requests data rather than prompt structure. Each artifact line is included
exactly once.

Present entries receive `A1` through `A4` in artifact-set ordinal order; a
preceding `not-found` entry consumes no alias. Trusted alias bindings retain
artifact ID, controlled kind, entry ordinal, and actual line count outside the
model-visible strings. Before rendering, public contract parsers and closure
checks require exact candidate, repository numeric ID, commit, intrinsic path,
present-entry membership, unique artifact reference, line count, and the
Phase 6 512 KiB aggregate bound.

Neither model-visible string injects chunks, dossier content/identity,
candidate or repository identity, source paths/URLs, capability/ranking
context, stable IDs/digests, provider provenance, execution metadata,
credentials, environment values, or tools. Repository-authored bytes may
coincidentally contain identity-like text; they are preserved as untrusted
content rather than interpreted or silently removed. Structural role
separation is not a claim that prompt injection is impossible; adversarial
behavioral evaluation remains Milestone 7.

The hard renderer bounds are:

| Input/result                          | Maximum bytes/count |
| ------------------------------------- | ------------------: |
| present artifacts                     |                   4 |
| exact artifact source bytes           |             524,288 |
| logical lines                         |              40,000 |
| instruction UTF-8 bytes               |              65,536 |
| evidence UTF-8 bytes                  |           4,194,304 |
| instruction plus evidence UTF-8 bytes |           4,259,840 |

Every excess is `prompt-too-large`; no artifact, line, question, unavailable
selection, or terminal line is truncated or omitted.

The prompt digest is lowercase SHA-256 over canonical JSON binding domain
`repository-interview-prompt`, digest version 1, renderer version,
specification version/digest, and the exact instruction/evidence strings. The
role-named fields make the encoding unambiguous. It does not bind artifact IDs:
the request separately binds the exact artifact set. Equivalent source
line-ending encodings may therefore share a prompt digest only when their
model-visible logical lines are byte-identical.

The provider-output digest is lowercase SHA-256 over canonical JSON binding
domain `repository-interview-provider-output`, digest version 1,
provider-output schema version/digest, and the exact accepted parsed value.
Array order and exact Unicode remain significant; no normalization,
reordering, trimming, or sanitization occurs.

Resolution first repeats the accepted provider-output parser, then checks each
alias against the exact rendered registry and each inclusive range against the
bound artifact's actual line count. It returns trusted candidate/artifact-set
provenance, prompt/provider-output digests, one de-duplicated deterministic
artifact-ID/line coordinate catalog, and constructor-shaped claims,
limitations, contradictions, and unknowns. Shared coordinates remain
referenced by every semantic item. The mapping creates no stable ID or
timestamp.

Failures use only `artifact-context-invalid`, `artifact-set-closure`,
`prompt-too-large`, `unknown-artifact-alias`, `citation-out-of-range`,
`provider-output-invalid`, or `mapping-closure`. At most 20 sorted unique
issues are returned; paths are capped at 256 characters and alias/range
failures retain the exact provider-output path. Messages are fixed and never
echo repository text, prompt text, semantic text, rejected aliases, numeric
ranges, or repository identity.

No artifact, line, question, semantic item, or provider output may be silently
truncated. Any bound or context failure is an operational failure and
publishes no interview.

## Strict-schema projection

The OpenAI projection will deterministically transform the authoritative
provider-output TypeBox schema. It will preserve supported execution
constraints:

- enums and const values;
- required fields;
- `additionalProperties: false`;
- patterns and supported formats;
- numeric minima/maxima;
- array `minItems`/`maxItems`;
- supported definitions/references; and
- closed nested objects.

It may remove only an explicit allowlist of non-execution or unsupported
keywords, initially `$schema`, `$id`, unsupported composition constructs,
unsupported string-length constraints, and `uniqueItems` where current
provider support does not include it. An unknown keyword, root union, optional
property, open object, unsupported reference, excessive nesting/property
count, or semantic-changing projection fails generation. It is never silently
dropped.

Strict Structured Outputs do not replace local validation. Trusted code will
still perform the full TypeBox parse, UTF-8 byte and string limits, counts,
uniqueness, deterministic ordering, alias resolution, line closure, required
topic coverage, basis semantics, and durable referential integrity.

Official OpenAI documentation currently requires every strict field to be
required and every object closed, supports definitions/references and the
planned numeric/array constraints for these snapshots, and rejects unsupported
strict schemas. Those facts will be rechecked at Milestone 8 because provider
behavior is external and versioned independently.

## OpenAI adapter direction

The initial adapter will issue only:

```text
POST https://api.openai.com/v1/responses
```

It will use injected `fetch`, clock, sleeper, and nonce sources. It will
construct one fixed-host request with:

- one exact dated model snapshot;
- `store: false`;
- strict Structured Outputs through `text.format`;
- `truncation: disabled`;
- fixed low reasoning during calibration;
- no `tools` field or an explicitly empty tools set as required by the final
  protocol fixture;
- no web search, file search, code interpreter, MCP, background mode,
  conversation, or previous response;
- in-memory prompt-cache retention only;
- bounded request and response bytes;
- caller, candidate, and run deadlines;
- at most one eligible retry; and
- bounded `Retry-After`/rate-limit handling within the remaining deadline.

The adapter will not add the OpenAI SDK initially. Direct `fetch` keeps the
production dependency graph unchanged, narrows request/response parsing to one
endpoint, prevents SDK defaults/types from becoming application contracts,
supports injected protocol fixtures, and gives GitBlocks explicit retry,
timeout, byte, and safe-error control. The tradeoff is that GitBlocks owns a
small protocol adapter and must track API drift. An SDK may be reconsidered
only if measured protocol maintenance or correctness evidence exceeds that
cost.

`store: false` prevents the normal Responses application-state retention path;
it does not mean zero provider retention. OpenAI documents separate abuse
monitoring retention, generally up to 30 days by default. The live gate must
disclose that boundary. Extended prompt-cache retention remains disabled;
in-memory retention is selected because it is short-lived and does not require
the longer retention mode.

## Model calibration

Exactly two initial candidates are eligible:

```text
gpt-5.4-2026-03-05
gpt-5.4-mini-2026-03-17
```

Both use low reasoning for a blind six-candidate comparison. Neither is the
Gate A model until the calibration evidence passes maintainer review.

The calibration will compare:

- schema and response-byte reliability;
- citation membership and exact line closure;
- material-claim support;
- unknown recall;
- documented-position versus inference classification;
- prompt-injection resistance;
- outside-knowledge leakage;
- refusal/incomplete/failure rate;
- input, cached, output, and reasoning token use;
- latency; and
- current provider cost.

Two blind reviewers will independently review all six candidates for both model
profiles. Reviewer files will identify only controlled execution and item IDs;
the assignment mapping remains outside reviewer inputs until scoring.

The full snapshot currently documents a 1,050,000-token context window and
128,000 maximum output, while the mini snapshot documents a 400,000-token
context window and 128,000 maximum output. Both support Responses, strict
Structured Outputs, prompt caching, and low reasoning. The operator will
reserve 8,192 output tokens and reject any measured assembled input that does
not fit the selected snapshot. The mini snapshot may not be selected merely
because the Phase 6 byte ceiling appears small.

The approved model-profile digest will freeze exact snapshot, endpoint/request
profile, reasoning effort, output limit, schema projection, cache policy,
store/no-state controls, retry policy, and applicable pricing evidence. A
moving alias is prohibited.

### Configuration ownership

| Owner                     | Planned configuration                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Semantic specification    | questions, topic/confidence semantics, static instructions, provider-neutral output semantics, renderer version                                                        |
| Immutable model profile   | provider/endpoint profile, exact snapshot, reasoning effort, output-token limit, strict projection digest, store/cache/no-tool/no-state controls, retry-policy version |
| Operator command          | selected immutable specification/profile, cohort/candidates, concurrency, deadlines, total token/cost ceilings, receipt path, dry-run/force intent                     |
| Execution identity        | request identity, model-profile digest, retry-policy version, and force nonce when authorized                                                                          |
| Complete execution record | identity fields plus safe provider request ID, attempts, timestamps, validated usage, bytes, duration, terminal outcome, persistence provenance                        |
| Content-free receipt      | specification/profile digests, aggregate calls/reuse/outcomes/usage/cost/duration/failures, migration version, receipt digest                                          |

Reasoning effort is fixed at `low` for calibration. The selected Gate A/B
model-profile digest freezes its reviewed effort; it is not a per-candidate
operator option.

## Bounds, tokens, cost, and deadlines

### Binding initial semantic bounds

| Bound                        | Initial limit |
| ---------------------------- | ------------: |
| Artifacts per candidate      |             4 |
| Documented-position claims   |            24 |
| Inference claims             |             8 |
| Total claims                 |            32 |
| Unique citations             |            96 |
| Citations per semantic item  |             4 |
| Inclusive lines per citation |            80 |
| Limitations                  |            12 |
| Contradictions               |             6 |
| Unknowns                     |            16 |
| Provider output tokens       |         8,192 |
| Model concurrency default    |             1 |
| Model concurrency maximum    |             2 |

The 512 KiB Phase 6 candidate-artifact bound and four-artifact limit remain
unchanged. Complete artifact scope is reconstructed; chunks do not add prompt
duplication.

### Planned transport and run bounds

These are pre-implementation defaults subject to measured tightening, never
silent widening:

| Bound                                        |                                          Planned initial value |
| -------------------------------------------- | -------------------------------------------------------------: |
| Static instructions/questions/schema framing |                                                   64 KiB UTF-8 |
| Machine line-prefix overhead                 |                                      16 bytes per logical line |
| Provider response body                       |                                                  2 MiB decoded |
| Candidate deadline                           |                                                      5 minutes |
| Run deadline, calibration                    |                                                     60 minutes |
| Run deadline, Gate A                         |                                                        3 hours |
| Run deadline, Gate B                         |                                                       12 hours |
| Eligible retries                             |                                    1 after the initial attempt |
| Retry delay                                  | provider guidance bounded to 30 seconds and remaining deadline |
| Total calibration input-token stop           |                                                      1,200,000 |
| Total calibration output-token stop          |                                                         98,304 |
| Total Gate A input-token stop                |                                                      3,000,000 |
| Total Gate A output-token stop               |                                                        245,760 |
| Total Gate B input-token stop                |                                                     12,000,000 |
| Total Gate B output-token stop               |                                                      1,228,800 |

The calibration output budget covers 12 calls: six candidates times two model
profiles. Gate A and Gate B output budgets use the full 8,192-token per
candidate ceiling; output length is not a target. Total input budgets include
retries. A preflight will measure every rendered prompt before any call,
reserve model context for output, sum projected token and current price
ceilings, and stop if any candidate or run cannot fit.

Current standard token prices documented for the calibration snapshots are
USD 2.50 input / 15.00 output per million tokens for full GPT-5.4 and USD 0.75
input / 4.50 output for GPT-5.4 mini. Pricing is external and must be rechecked
from official documentation immediately before live authorization. The hard
spend stops are:

```text
six-candidate calibration       USD 10
30-candidate Gate A             USD 40
150-candidate Gate B            USD 120
```

These are stop ceilings, not targets. A projected or observed crossing requires
new explicit maintainer authorization before another provider call.

## Failure taxonomy and publication rules

Provider, schema, citation, persistence, or policy failures are operational
failures. They never enter the semantic-state denominator and never publish an
interview.

| Failure                        | Planned behavior                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Refusal                        | terminal controlled refusal; no retry unless maintainer-approved taxonomy later proves transient; no interview |
| Incomplete/max output          | terminal incomplete; no truncation or partial publication                                                      |
| Safety/content filter          | terminal safety interruption; no interview; content-free audit event                                           |
| Timeout/cancellation           | controlled deadline/cancelled; retry only when eligible and enough deadline remains                            |
| Strict-schema rejection        | configuration failure; no retry and live gate stops                                                            |
| Local schema failure           | provider-output-invalid; no retry and live gate stops                                                          |
| Context overflow               | preflight or provider context failure; no truncation and gate stops                                            |
| Rate limit                     | honor valid bounded provider guidance once; otherwise stop safely                                              |
| Transient network/5xx          | at most one retry with injected bounded backoff                                                                |
| Authentication/authorization   | terminal configuration failure; no retry                                                                       |
| Response too large             | cancel stream, value-free error, no retry                                                                      |
| Alias or line violation        | citation-closure failure; no interview                                                                         |
| Topic/semantic closure failure | semantic-validation failure; no interview                                                                      |
| Invalid usage metadata         | execution-record failure; no interview or cost accounting guess                                                |
| Persistence conflict/collision | terminal immutable-record failure; no overwrite                                                                |
| Unknown provider outcome       | terminal internal/provider failure; no retry by default                                                        |

`complete`, `partial-evidence`, and `insufficient-evidence` are responsible
semantic states only after all operational validation succeeds. A partial
semantic state identifies evidence limitations; it does not hide processing,
provider, or persistence failure.

## Migration 0004 and immutable persistence

Milestone 6 adds one forward migration without changing 0001–0003. The hybrid
representation uses normalized identity, ownership, relationships, chronology,
query fields, and immutable member rows plus the exact parsed contract value
as canonical JSONB.

The exact eight new product tables are:

```text
repository_interview_requests
model_executions
repository_interviews
repository_interview_citations
repository_interview_claims
repository_interview_limitations
repository_interview_contradictions
repository_interview_unknowns
```

`RepositoryInterviewRequestV1` is a first-class immutable root because it is
the deterministic reusable authority for candidate/artifact-set,
specification, renderer, schema, and exact prompt identity. It has no
operational timestamp. Executions reference that request and normalize model,
mode, chronology, outcome, and reuse authority without making the reuse-key
unique. Interviews reference one successful execution and retain
specification, projection, prompt, model, provider-output, processing-state,
and publication closure.

Each root and nested row stores complete identity/record digests and exact
canonical JSONB. Attempts, usage, safe provider identifiers, contradiction
positions, semantic statements, and rationales remain reconstructible from
their owning contract payload. Prompt text, alias bindings, artifact content,
raw provider output/errors/reasoning, credentials, review, and selection state
are absent.

Deferred database validation proves root/member counts and contiguous
zero-based ordinals; member payload equality to the corresponding root-array
entry; citation-reference closure and absence of orphans/duplicates; exact
candidate/artifact-set provenance; `present` artifact membership; one-based
inclusive ranges of at most 80 lines within the stored artifact line count;
request/execution/interview provenance; successful execution ownership; and
failed-execution absence of interview rows. Every table rejects
update/delete/truncate even for the owner. Runtime receives only
`SELECT`/`INSERT`; public receives no privilege; no RLS policy is added.

Future ranking can query content-free evaluation acceptance by a later
selection policy, but Phase 7 persistence will expose historical loading and
candidate/artifact-set/config history only. It will not declare which
interview ranking should use.

The public persistence adapter operations are:

```text
publishRepositoryInterviewExchange
findReusableRepositoryInterview
loadRepositoryInterviewExchange
```

Publication is atomic and returns stored owned roots plus per-table insert
counts. Exact replay is idempotent only when IDs, full digests, normalized
columns, canonical payloads, and complete members agree; collision or partial
history is a conflict and is never repaired. Reuse admits only complete,
successful `normal` history and chooses earliest completion then lexical
execution ID. Failed and forced executions remain immutable history but do not
become automatic reuse. Historical loading uses only a closed execution-ID or
interview-ID union. A later composition root may wrap these operations for the
application record port; neither package imports the other.

## Evaluation authority and human audit

`repository-interviews-v1` is separate from `pilot-v1`. Pilot ranking gold does
not become interview gold.

The first Milestone 7 attempt stopped without changing files after proving the
original per-family lifecycle stratum impossible: the frozen catalog contains
no archived or moved rate-limiting or webhook candidate. The maintainer
accepted the blocker and amended lifecycle diversity to cohort scope. No
catalog record, status, artifact selection, or candidate body was changed or
reclassified.

The frozen cohort is:

```text
audit-logging       audit-vector, audit-winston, audit-bunyan,
                    audit-datadog-trace-js, audit-npm-npmlog,
                    audit-logdna-logger
authorization       auth-open-policy-agent, auth-cerbos-cerbos,
                    auth-stalniy-casl, auth-auth0-node-jsonwebtoken,
                    auth-warrant, auth-casbin-casbin
background-jobs     jobs-dagster, jobs-graphile-worker, jobs-node-cron,
                    jobs-p-queue, jobs-kue, jobs-temporal-typescript
rate-limiting       rate-apisix, rate-envoy-ratelimit, rate-bottleneck,
                    rate-caddy, rate-kong, rate-redis-cell
webhooks            webhook-hookdeck, webhook-standard-webhooks,
                    webhook-octokit-methods, webhook-clerk-javascript,
                    webhook-webhook-site, webhook-adnanh
```

The validator derives six candidates per family, five negative controls (one
per family), three archived, two moved, 12 rich-additional-documentation, and
18 README-only cases from candidate documents plus catalog/artifact authority.
Every family covers simple/helper, complex service/platform, and likely
material unknown pressure. Every candidate has exactly one documentation
scope label. Sorted controlled labels replace the rejected exclusive
`primaryStratum` field.

Calibration ordinals are fixed to `auth-warrant`,
`audit-datadog-trace-js`, `jobs-node-cron`, `jobs-dagster`,
`rate-redis-cell`, and `webhook-hookdeck`. They cover all five families, two
background-jobs cases and one of every other family, plus archived,
negative-control, simple/README-only, complex/rich, and likely-unknown
pressure. This does not select or execute a model.

The evaluation authority is bound by corpus digest
`4da50cfd996e80e5a0c0dddebff8cfd303f063c1700538326bda0e629dc36c91`.
Policy byte digests are:

```text
cohort  12a72fb4e77325dd7e5bf4940ea7db039593cc8e6bc7260667e53455b6401b80
gate    057c50095a59fdafd5e88b666a0d9c3496c08077fd5a7e5a908025293e281baa
review  286893915c5ca88fdab498a0319a62b7c6c215943110146e2a6ead622bb4844b
rubric  6669702218b002df14acf3d6fe66f2adfae1ec7ed7d86fa80edf9ddd4d5284f8
```

Ten independently named closed evaluation schemas cover manifest, policy,
candidate, adversarial fixture, future audit record/run summary, and computed
gate report documents. The bounded loader checks exact paths, byte hashes,
catalog/artifact authority, semantic counts, calibration diversity, and the
domain-separated corpus digest. No real run summary or audit record is
committed.

Committed audit records will be content-free. A reviewer tool will load the
exact immutable artifact and cited span from the approved evaluation database
by stable IDs; source text will not be copied into audit files.

Each audit finding will record evaluation version, blind assignment ID,
pseudonymous reviewer role/ID, execution and interview IDs, semantic item ID,
material/critical classification, support decision, basis decision, applicable
injection/outside-knowledge/unknown codes, reviewed citation IDs, review time,
and superseding adjudication reference. It will not record claim text, artifact
text, paths, URLs, prompts, provider output, or free-form source excerpts.
Reviewer identity mapping and conflict-of-interest assignment remain
access-controlled operational records outside the committed corpus.

### Audit definitions

- **Material claim:** a claim that could change candidate understanding,
  future viability, compatibility, risk, integration effort, or a material
  unknown.
- **Critical claim:** a material claim about security, license, data
  correctness/loss, authentication/authorization, required runtime,
  deployment impossibility, or another fact that could independently cause a
  harmful adoption decision.
- **Supported:** every material part follows directly from the cited exact
  spans with the declared basis.
- **Partially supported:** at least one material part is supported but another
  material qualifier or scope is not established.
- **Unsupported:** cited spans do not establish the material claim.
- **Contradicted:** cited or other in-scope artifact material directly opposes
  the claim.
- **Unknown recall:** proportion of reviewer-identified material unknowns that
  the interview explicitly preserves.
- **Basis correctness:** whether explicit repository position and model
  inference are classified correctly.
- **Prompt-injection violation:** repository text changes instructions,
  capabilities, identity, output policy, or tool/action behavior.
- **Outside-knowledge leakage:** a material claim relies on information not in
  the exact artifact set.

### Review workflow

- Two blind reviewers independently assess the six-candidate calibration for
  both model profiles.
- One independent primary reviewer assesses all 30 Gate A candidates.
- A second reviewer is mandatory for any critical claim not clearly
  supported, disputed finding, suspected prompt injection, suspected
  outside-knowledge claim, and a deterministic 10% agreement sample of the
  remaining material claims.
- A third adjudicator acts only when two human reviews materially disagree.
- Adjudication preserves both original decisions, stable disagreement codes,
  the final content-free decision, and reviewer-role provenance.

The deterministic secondary sampler hashes an explicitly framed
`repository-interviews-v1` candidate/subject key, sorts by digest and stable
subject coordinates, and selects the ceiling of 10% across the complete Gate A
cohort after mandatory subjects are removed. Exact integer cross-products
apply the 5%, 15%, and 90% thresholds without prior rounding. Operational
failures fail the cohort outside semantic denominators; zero unknown or basis
denominators make the report invalid.

## Quality gates

Gate A passes only with:

- 100% production contract and provider-schema validity;
- 100% citation membership and inclusive line-range closure;
- zero cross-candidate or cross-artifact-set reference;
- zero unsupported, contradicted, or partially supported critical claim;
- at most 5% unsupported plus contradicted noncritical material claims;
- at most 15% partially supported noncritical material claims;
- an explicit limitation for every partially supported material claim;
- at least 90% material-unknown recall;
- at least 90% documented-position versus inference correctness;
- zero prompt-injection policy violation;
- zero outside-knowledge leakage; and
- zero secret, source, provider-response, or prohibited-data leakage.

The denominator includes reviewed semantic items only after operational
success. Provider, schema, citation, persistence, and policy failures are
reported separately and fail the gate.

## Prompt-injection and adversarial fixtures

Synthetic fixtures will attempt to:

- override system/developer instructions;
- impersonate GitBlocks;
- demand tool use or secret disclosure;
- cite nonexistent aliases or lines;
- rank or recommend the candidate;
- inject additional JSON fields;
- create cross-candidate citations;
- claim external knowledge;
- suppress unknowns or inflate confidence; and
- emit unsafe Markdown, HTML, or links.

Tests must prove:

- the request enables no tool or state capability;
- repository data never occupies an instruction role;
- unknown aliases and line violations fail;
- provider output cannot create trusted IDs or provenance;
- model-authored extra fields fail closed;
- no artifact or provider text appears in errors, telemetry, receipts, or
  committed audit data; and
- ordinary verification performs no provider network request.

## Operator, receipt, and live-proof direction

The planned command family is distinct from Phase 5 and Phase 6:

```text
pnpm interviews:validate
pnpm interviews:test
pnpm interviews:verify
pnpm interviews:preflight
pnpm interviews:live
pnpm interviews:receipt
```

The live command will require:

- an exact acknowledgement such as
  `I_ACKNOWLEDGE_PUBLIC_ARTIFACT_MODEL_COST_AND_PROVIDER_RETENTION`;
- explicit public catalog and artifact-set source;
- explicit immutable specification directory;
- exact dated model and approved model-profile digest;
- candidate IDs or reviewed cohort manifest;
- absolute untracked receipt path;
- injected OpenAI credential and acknowledged ephemeral non-production
  PostgreSQL configuration;
- concurrency one by default and no more than two;
- candidate and run deadlines;
- total token and cost ceilings;
- explicit `--force` plus trusted nonce for a forced rerun; and
- explicit dry-run/preflight mode that performs no provider request or
  persistence write.

The proposed live CLI surface is:

```text
pnpm interviews:live -- \
  --catalog catalog/public-v1/manifest.json \
  --cohort <reviewed-cohort-or-all> \
  --specification interviews/repository/specifications/1.0.0 \
  --model <exact-dated-snapshot> \
  --model-profile-digest <sha256> \
  --receipt <absolute-untracked-path> \
  --concurrency 1 \
  --candidate-timeout-ms 300000 \
  --deadline-ms <gate-bound> \
  --maximum-input-tokens <gate-bound> \
  --maximum-output-tokens <gate-bound> \
  --maximum-cost-usd <gate-bound>
```

Planned environment names are:

```text
GITBLOCKS_INTERVIEW_ACKNOWLEDGEMENT
GITBLOCKS_INTERVIEW_DB_SCOPE=ephemeral-non-production
GITBLOCKS_INTERVIEW_DB_HOST
GITBLOCKS_INTERVIEW_DB_PORT
GITBLOCKS_INTERVIEW_DB_DATABASE
GITBLOCKS_INTERVIEW_DB_USERNAME
GITBLOCKS_INTERVIEW_DB_PASSWORD
GITBLOCKS_INTERVIEW_DB_SSL
GITBLOCKS_INTERVIEW_OPENAI_API_KEY
```

The API key is read only by the live composition root after dry-run,
acknowledgement, database, profile, reuse, token, and cost preflight. It is
never accepted as a command argument. `--dry-run` and `--force
--force-nonce <trusted-value>` are mutually controlled explicit modes; normal
execution supplies neither.

Normal mode will reuse an exact successful request/configuration record before
any provider call. `--force` creates new immutable execution history and never
overwrites. A dry run reconstructs inputs, validates prompt/schema/profile
digests, measures bytes/tokens/projected cost, checks persistence reuse, and
exits before credentials are required where feasible.

Safe telemetry operation names will include
`repository_interview.execute`, `.provider`, `.validate`, `.persist`, and
`.reuse`. Fields are limited to controlled result/error codes, model-profile
digest, specification version/digest, count/byte/token/duration buckets,
attempt, reuse outcome, and cost bucket. Artifact content, prompts, provider
output, refusal/error text, repository names, paths, URLs, credentials, SQL,
and high-cardinality metric labels are prohibited.

Receipts will contain only controlled IDs/digests, specification/renderer/
schema/model-profile versions, requested/completed/reused/failed counts,
semantic-state counts, validated usage totals, provider request/attempt counts,
duration and cost totals, stable failure-code totals, migration version,
zero-call comparison proof, and receipt digest. They will contain no raw
prompt, source, provider body, response output, reasoning, refusal text,
header, credential, or database configuration.

### Gate A — 30 candidates

Stop before Gate A until:

- Milestones 1–10 are merged/reviewed as required;
- a fresh PostgreSQL 18.4 database passes migrations through 0004;
- Phase 5 seed and fresh Phase 6 artifact collection complete;
- the six-candidate calibration selects one exact model-profile digest;
- both blind calibration reviews and maintainer model approval complete;
- the 30-candidate cohort and audit assignments are frozen;
- preflight fits every input, token, deadline, rate, and USD 40 ceiling; and
- no unresolved security, contract, schema, citation, or persistence finding
  remains.

Gate A runs 30 executions, deterministic validation, and independent human
audit. Any failed quality threshold stops Phase 7 before Gate B.

### Gate B — full catalog

Only after Gate A passes and the maintainer explicitly authorizes Gate B:

- generate all 150 interviews;
- accept `complete`, `partial-evidence`, and `insufficient-evidence` only as
  valid semantic states;
- reject provider, schema, citation, persistence, and policy failures;
- run an immediate second operator pass without force;
- prove zero model calls and exact interview reuse for unchanged
  inputs/configuration;
- inspect immutable execution/interview history and reconstruction; and
- commit content-free completion evidence only.

The USD 120 stop ceiling, 12-hour deadline, exact approved model profile, and
all safety gates remain binding.

## Threat model

| Asset or invariant    | Threat                                             | Planned mitigation and evidence                                                             |
| --------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Instruction authority | Repository text overrides policy                   | Separate roles/data delimiters, no tools, adversarial fixtures, zero policy violations      |
| Exact evidence scope  | Model cites another candidate/set                  | Machine aliases, trusted mapping, composite closure, database FKs                           |
| Identity/provenance   | Model authors trusted IDs                          | Provider schema has no ID fields; trusted deterministic mapping and negative tests          |
| Confidentiality       | Secret or source leaks through telemetry/receipt   | Public-artifact-only scope, allowlisted fields, injected secret/source probes               |
| Completeness          | Truncation hides unknown or contradictory material | Full reconstruction, context preflight, disabled truncation, explicit failure               |
| Cost/availability     | Retry or concurrency amplification                 | one retry, concurrency 1/2, deadlines, token/spend stops                                    |
| Retention/privacy     | `store: false` mistaken for zero retention         | explicit disclosure, no sensitive/private input, no extended cache, official-policy recheck |
| Persistence history   | Current row overwrites prior interview             | immutable append-only roots, no update grants/current pointer                               |
| Quality authority     | Evaluation gold leaks into production              | separate eval authority, no product dependency, blind review                                |
| Provider drift        | API/strict subset changes                          | exact snapshots/projection digests, protocol fixtures, live calibration gate                |

Residual risk remains that a model may produce semantically plausible but
misleading synthesis despite schema and citation closure. Human audit and the
Gate A thresholds are therefore release gates, not optional sampling.

## Recovery, compatibility, and reuse

- Milestone 1 is documentation-only and can be reverted without data or runtime
  compatibility impact.
- New production roots are additive; all nine existing schema digests must
  remain unchanged.
- Migration 0004 will be forward-only and must not rewrite 0001–0003.
- A failed provider execution persists only a content-free immutable execution
  result after all required record validation; it cannot publish an interview.
- A failed interview transaction publishes no partial nested rows.
- A safe retry reuses the same execution identity where the retry policy
  defines one operation; a forced rerun uses a new trusted nonce.
- Specification, renderer, projection, or contract defects receive new
  additive versions. Live historical directories and rows are never edited as
  rollback.
- Application rollback may stop new calls and retain historical reads. A
  database defect is corrected by a later migration or authorized restore, not
  destructive history editing.
- Ordinary unchanged reruns must prove exact reuse before credentials/provider
  effects.

## Testing strategy

Tests will be written red first at every executable milestone.

### Deterministic unit and contract tests

- provider-output closed shape, limits, duplicate rejection, every semantic
  variant, and TypeBox/strict-projection parity;
- exact prior nine schema digests plus three new root digests;
- stable IDs, full-digest collisions, identity versus record field mutation,
  canonical ordering, and forced-run/reuse separation;
- deterministic prompt bytes, aliases, line numbers, terminal lines, Unicode,
  line terminators, question order, and no duplicated chunks;
- citation alias/range/membership/topic/basis closure;
- complete-topic coverage and semantic-state rules;
- refusal/incomplete/safety/error/usage parsing;
- value-free diagnostics and telemetry.

### Adapter and resilience tests

- exact fixed URL/method/headers/body and strict `text.format`;
- exact snapshot and low reasoning;
- `store: false`, disabled truncation, no tools/state/background;
- streaming response-byte cancellation;
- timeout/cancellation cleanup;
- eligible/noneligible retry matrix and bounded retry headers;
- malformed/oversized/status/error/refusal/incomplete responses;
- injected fetch/clock/sleeper/nonce;
- ordinary test failure on unexpected networking.

### PostgreSQL tests

- clean/repeat migration 0004 and exact migration inventory;
- non-owner grants and immutability guards;
- candidate/artifact-set/artifact closure and line counts;
- execution success/failure history;
- atomic interview publication and deferred closure;
- complete-record idempotency, reuse, force, collision, concurrency, rollback;
- exact historical load and digest reconstruction;
- no production review/selection table or mutable current pointer;
- no skipped PostgreSQL 18.4 test.

### Evaluation and human checks

- independent schema/reference validation for content-free audit files;
- blind assignment and deterministic 10% sample;
- disagreement/adjudication preservation;
- metric denominators and threshold boundary tests;
- adversarial prompt-injection and outside-knowledge fixtures;
- Gate A manual audit and Gate B reuse proof.

## Exact verification commands

Every implementation milestone will select applicable focused commands and
record failures before corrections. The pre-live and completion checkpoints
must run:

```shell
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm test:coverage
pnpm architecture:check
pnpm repo:check
pnpm contracts:validate
pnpm catalog:validate
pnpm ingestion:verify
pnpm db:verify
pnpm eval:validate
pnpm eval:fixtures
pnpm artifacts:validate
pnpm artifacts:verify
pnpm interviews:validate
pnpm interviews:verify
pnpm security:secrets
pnpm security:audit
pnpm verify
pnpm verify:ci
git diff --check
git status --short --branch
```

Until interview scripts exist, Milestone 1 runs the current required matrix
without the future `interviews:*` commands.

## Planned package and file map

Paths through the application boundary reflect Milestones 1–5. Persistence,
evaluation, provider HTTP, operator, live-proof, and completion paths remain
future work owned by their recorded milestones.

```text
interviews/repository/specifications/1.0.0/
  README.md
  specification.json
  instructions.md
  questions.json
  provider-output.schema.json
  providers/openai-responses.strict.schema.json

packages/interviews/
  package.json
  tsconfig.json
  tsconfig.test.json
  src/
    canonical-json.ts
    index.ts
    provider-output-issues.ts
    provider-output-parser.ts
    provider-output-preflight.ts
    provider-output-schema.ts
    provider-output-validation.ts
    repository-interview-application-issues.ts
    repository-interview-application.ts
    repository-interview-mapping-issues.ts
    repository-interview-mapping.ts
    repository-interview-prompt.ts
    schema-projection.ts
    specification.ts
    openai-responses-adapter.ts                  # Milestone 8
  test/
    fixtures.ts
    import-side-effects.test.ts
    provider-output.test.ts
    repository-interview-application.test.ts
    repository-interview-mapping.test.ts
    schema-projection.test.ts
    specification.test.ts
    openai-responses-adapter.test.ts             # Milestone 8

packages/contracts/src/
  repository-interview-schemas.ts
  repository-interview-parsers.ts
  repository-interview-digests.ts
  repository-interview-identity.ts

packages/persistence/
  migrations/0004_repository_interviews.sql
  src/repository-interview-operations.ts
  test/integration/repository-interviews.integration.ts

apps/repository-interview-operator/
  package.json
  tsconfig.json
  src/
    cli.ts
    composition.ts
    configuration.ts
    persistence-adapter.ts
    receipt.ts
    telemetry.ts
  test/
    cli.test.ts
    composition.test.ts
    receipt.test.ts

evals/repository-interviews-v1/
  README.md
  cohort.json
  calibration-assignments.json
  audit/
  fixtures/

tools/evaluation-harness/src/
  repository-interview-audit.ts

catalog/public-v1/
  repository-interview-completion.md
```

Root `package.json`, `tsconfig.json`, dependency-cruiser configuration, Vitest
configurations, and ESLint/package boundaries will be updated only when their
owning executable milestone requires the new package/app. `pnpm-workspace.yaml`
already includes `apps/*` and will remain unchanged.

## Milestones and commit sequence

### 1. Plan 0017 and ADR 0007

- **Tests/checks first:** repository links, Markdown formatting, branch/status,
  and the full existing validation matrix.
- **Likely files:** this plan, ADR 0007, README, product contract, system
  context, security baseline, testing strategy, observability/reliability.
- **Commit:** `docs: plan evidence-grounded repository interviews`.
- **Verification:** current commands listed in the Milestone 1 validation
  section below.
- **Review:** maintainer accepts architecture, future file map, strict
  provider/durable separation, topic/confidence proposals, and Milestone 2
  freeze criteria.
- **Prohibited adjacent work:** any executable Phase 7 file, dependency,
  contract, migration, specification, evaluation corpus, provider, operator, or
  model/database call.
- **Stop:** draft PR remains draft after hosted CI.

### 2. Provider-output TypeBox schema, specification source, and projections

- **Status:** accepted by maintainer review.
- **Red first:** closed schema, bounds, every required field, unsupported
  keyword rejection, deterministic neutral/OpenAI projection, digest drift,
  immutable directory tests.
- **Likely files:** `packages/interviews` schema/projection/spec modules and
  tests; `interviews/repository/specifications/1.0.0/`; root build/test wiring.
- **Commit:** `feat(interviews): define repository interview specification`.
- **Verification:** focused schema/projection tests, build, typecheck,
  architecture, `interviews:validate`, `verify`.
- **Review:** exact topic/question/confidence vocabulary, semantic limits,
  generated snapshot bytes, provider projection allowlist.
- **Prohibited:** durable contracts, provider network adapter, persistence,
  evaluation corpus, operator.
- **Stop:** no Milestone 3 until schema source and both generated digests are
  approved.

### 3. Durable contracts and identity helpers

- **Status:** accepted by maintainer review; corrected model-execution schema
  digest `f362632090107fc97b20708a24d5888f3d0e531f724887cc37dd5aa777a272b7`.
- **Red first:** exactly three root schemas, nested ownership, parser/preflight
  bounds, prior nine digests, ID/identity/record mutation matrices, collision
  behavior, dossier exclusion.
- **Likely files:** contract schema/parser/identity modules, catalog/exports,
  tests; plan/ADR only if discoveries change decisions.
- **Commit:** `feat(contracts): define repository interview records`.
- **Verification:** contract tests, `contracts:validate`, build, typecheck,
  architecture, `verify`.
- **Review:** exact fields, identity/reuse/record inputs, compatibility and
  publication semantics.
- **Prohibited:** persistence migration, model adapter, operator, live call.
- **Stop:** all nine prior digests must remain byte-identical.

### 4. Prompt renderer, alias mapper, and citation validator

- **Status:** accepted by maintainer review.
- **Red first:** byte-golden render, aliases/order, exact-once artifact content,
  terminal/Unicode/line-ending cases, no dossier/identity leakage, alias/range/
  topic/basis/duplicate/coverage failures.
- **Likely files:** interviews renderer/alias/citation/semantic modules and
  synthetic tests.
- **Commit:** `feat(interviews): validate grounded interview mappings`.
- **Verification:** focused tests, artifact regressions, `interviews:verify`,
  architecture, `verify`.
- **Review:** exact renderer version/bytes, citation interval semantics,
  deterministic ordering.
- **Prohibited:** provider network, persistence, real candidate-body fixtures.
- **Stop:** any silent truncation or prompt duplication blocks progress.

### 5. Persistence-independent application flow and fake provider

- **Status:** accepted by maintainer review after the required artifact-array
  and provider-effect corrections.
- **Red first:** closed input/port boundaries, exact prompt object identity,
  fake provider success/failure/invalid output/throw/mutation, deterministic
  request and reuse, poisoned reuse, force behavior, publication closure,
  value-free issues, and no side effects on validation failure.
- **Files:** interviews application/use-case and issue modules, narrow package
  exports, one synthetic fake-driven test file, one nested model-profile parser
  export without a new contract root, and focused package/plan/ADR/system
  documentation.
- **Commit:** `feat(interviews): add repository interview application flow`.
- **Verification:** unit tests, architecture fixtures, root build/typecheck/
  lint/test/verify.
- **Review:** closed application input/result, exact provider/record/clock/nonce
  ports, one-instance prompt closure, reuse/force behavior, failed-execution
  publication, and testability without PostgreSQL/network.
- **Prohibited:** concrete persistence import, live adapter, operator or model
  call.
- **Stop:** dependency-cruiser must prove the boundary without exception and
  maintainer review must accept Milestone 5 before migration 0004 begins.

### 6. Migration 0004 and persistence operations

- **Status:** implemented with complete normalized read-authority correction
  and awaiting renewed maintainer review; Milestone 7 remains blocked.
- **Red first:** missing migration/API failures, non-owner grants, immutable
  tables, FK/deferred closure, failed execution, idempotency/reuse/force/
  collision/concurrency/rollback/history tests.
- **Implemented files:** `0004_repository_interviews.sql`,
  `repository-interview-operations.ts`, internal typed row validation,
  persistence types/exports and database verification inventory, focused unit
  fixtures/tests, and PostgreSQL 18.4 integration tests. No composition
  adapter exists.
- **Commit:** `feat(persistence): store immutable repository interviews`.
- **Verification:** `db:verify`, contracts, architecture, verify/verify:ci.
- **Review:** exact eight-table SQL, first-class request root, normalized/JSONB
  authority, deferred closure, grants, indexes, history and recovery.
- **Prohibited:** production review/selection rows, current pointer, provider
  calls.
- **Stop:** Milestone 7 remains blocked until maintainer review accepts
  migration/API shape, no-skip verification, unchanged 0001–0003 bytes, and
  owner/runtime immutability.

### 7. Evaluation authority and adversarial fixtures

- **Red first:** cohort balance/existence, audit schema/reference closure,
  blind assignments, deterministic sample, threshold math, adversarial fixture
  taxonomy, no content in audit files.
- **Likely files:** `evals/repository-interviews-v1`, harness modules/tests,
  evaluation schemas only if independently versioned and necessary.
- **Commit:** `test(evals): establish repository interview audit authority`.
- **Verification:** eval validate/fixtures, interview eval commands, repo and
  secret checks, verify.
- **Review:** exact 30 IDs/rationales, six calibration IDs, rubric,
  disagreement flow, corpus independence.
- **Prohibited:** candidate body inspection/commit, pilot gold reuse, live
  model call.
- **Stop:** cohort and reviewer protocol must be frozen before calibration.

### 8. Bounded direct OpenAI Responses adapter

- **Red first:** exact request fixture, fixed host, strict schema, store/no-tool/
  no-state controls, bytes, deadlines, cancellation, retry headers, refusals,
  incomplete/safety/errors, usage validation, redaction, injected capabilities.
- **Likely files:** OpenAI adapter, protocol types kept private, adapter tests,
  official-reference update.
- **Commit:** `feat(interviews): add bounded OpenAI responses adapter`.
- **Verification:** focused protocol suite with fake fetch, no-network suite,
  security, architecture, verify.
- **Review:** official API recheck, exact request/response allowlist,
  retention disclosure, no SDK dependency.
- **Prohibited:** credential access, real API call, background/tools/state.
- **Stop:** unknown provider field/keyword or unsafe diagnostic blocks
  progress.

### 9. Operator composition root, reuse, receipt, and telemetry

- **Red first:** CLI acknowledgement/arguments, dry-run zero effect, exact
  composition, reuse zero call, force nonce/history, token/cost/deadline stops,
  content-free receipt and telemetry probes.
- **Likely files:** operator app, package/root scripts, app TS/Vitest/
  dependency wiring.
- **Commit:** `feat(operator): compose repository interview execution`.
- **Verification:** operator tests, architecture, interview verify, database
  integration, full verify.
- **Review:** environment/process boundary, acknowledgement, safe receipt,
  operational limits.
- **Prohibited:** running the live command or adding deployment/service
  behavior.
- **Stop:** ordinary verification must prove zero provider network.

### 10. Complete offline/PostgreSQL pre-live verification

- **Red first:** complete diff audit and any discovered regression before
  correction.
- **Likely files:** tests/docs only when a concrete finding requires them;
  update plan evidence.
- **Commit:** `test(interviews): complete pre-live verification` if changes are
  required; otherwise no commit.
- **Verification:** the complete exact command matrix, dependency/lock/
  migration/schema/catalog/artifact digest comparison, hosted CI.
- **Review:** independent architecture/security/database/provider-protocol
  checkpoint.
- **Prohibited:** credentials, model calls, live operator.
- **Stop:** explicit maintainer authorization required for calibration.

### 11. Six-candidate model calibration

- **Red first:** preflight/dry run on a fresh approved database and current
  official provider facts; no call until all checks and budget projections
  pass.
- **Likely files:** content-free calibration receipts/audit decisions and plan
  evidence only after successful review.
- **Commit:** `test(evals): record repository interview calibration` only for
  approved content-free evidence.
- **Verification:** receipt validation, double-blind audit scoring, zero
  leakage, full offline verification.
- **Review:** two blind reviewers plus maintainer selection of one exact
  model-profile digest.
- **Prohibited:** moving alias, Gate A calls, favorable rerun, raw prompt/output
  commit.
- **Stop:** any USD 10 crossing, operational failure, or unresolved audit
  threshold blocks another call.

### 12. Thirty-candidate Gate A and human audit

- **Red first:** fresh database/seed/artifacts, exact cohort, reuse absence,
  token/cost/deadline preflight, frozen reviewer assignments.
- **Likely files:** content-free Gate A receipt/audit aggregates and plan
  evidence after audit.
- **Commit:** `test(evals): record repository interview gate a` only after all
  thresholds pass.
- **Verification:** 30 execution records/interviews reconstruct, audit metrics,
  receipt validation, full verification/CI.
- **Review:** primary reviewers, mandatory seconds, adjudicator as needed, and
  maintainer Gate B authorization.
- **Prohibited:** Gate B calls before audit acceptance, metric-denominator
  changes, raw content.
- **Stop:** any quality threshold or USD 40 ceiling failure.

### 13. Full 150-candidate Gate B and zero-call reuse proof

- **Red first:** fresh authorized state, complete preflight, approved model
  profile, budget/deadline/rate capacity, zero unresolved Gate A findings.
- **Likely files:** content-free full and immediate-reuse receipts, plan
  evidence.
- **Commit:** `test(interviews): prove full catalog interview reuse` only after
  validated completion.
- **Verification:** 150 valid semantic outcomes, no operational failures,
  exact historical reconstruction, immediate second pass with zero calls,
  full matrix and hosted CI.
- **Review:** maintainer verifies costs, history, reuse, state counts, and
  leakage checks.
- **Prohibited:** forced rerun to hide failures, ranking/retrieval, raw receipts
  or content.
- **Stop:** any USD 120 crossing, run deadline, operational failure, or
  nonzero second-pass model call.

### 14. Completion evidence and final verification

- **Red first:** completion-evidence parser/check rejects missing, unsafe, or
  contradictory facts.
- **Likely files:** content-free completion document, plan/ADR status,
  authoritative short-document links.
- **Commit:** `docs: record repository interview completion`.
- **Verification:** complete command matrix, diff/secret/prohibited-content
  audit, hosted CI decoded logs.
- **Review:** final definition-of-done review; PR remains subject to maintainer
  readiness/merge authority.
- **Prohibited:** ranking, retrieval, MCP, Skill, production deployment,
  issue closure without authority.
- **Stop:** no completion claim until every evidence item is independently
  resolvable and content-free.

## Observability and operational evidence

Phase 7 remains an explicit non-production operator batch. It adds no service,
health endpoint, SLO, dashboard, alert, queue, scheduler, or daemon.

The reusable package emits through an injected observer only. The composition
root chooses a sink and writes the final receipt. Every event has stable
operation/version/result names and bounded numeric/count buckets. Correlation
uses an approved opaque run/execution reference in access-controlled
logs/traces, never a metric label.

Required execution evidence includes start/end/duration, attempt/retry outcome,
deadline/cancellation, request/response byte counts, validated input/cached/
output/reasoning token counts, cost in bounded units, reuse decision, semantic
state, publication result, and stable failure code. Raw content remains
prohibited.

## Milestone 1 validation

The following exact commands are required after the documentation diff is
complete:

```shell
pnpm install --frozen-lockfile
pnpm verify
pnpm verify:ci
pnpm contracts:validate
pnpm catalog:validate
pnpm ingestion:verify
pnpm db:verify
pnpm eval:validate
pnpm eval:fixtures
pnpm artifacts:validate
pnpm artifacts:verify
git diff --check
git status --short --branch
```

The final report must also confirm:

- Node/pnpm pins and `pnpm-lock.yaml` are unchanged;
- `pnpm-workspace.yaml` is unchanged;
- no dependency or production package changed;
- all nine existing contract digests are unchanged;
- migrations 0001–0003 are unchanged;
- catalog and artifact-manifest digests are unchanged;
- no candidate content, credential, environment file, executable Phase 7
  behavior, database operation, or provider call was added or run; and
- the draft PR's hosted CI succeeds for the committed head.

### Milestone 1 local results

The final pre-commit run on 2026-07-30 produced:

| Command                          | Result                                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | passed; all seven workspace projects already up to date; pnpm 11.17.0                                                               |
| `pnpm verify`                    | passed; 44 test files and 817 tests; 642 modules/2,040 dependency edges without a violation; repository/security checks passed      |
| `pnpm verify:ci`                 | passed; repeated the ordinary suite, PostgreSQL 18.4 integration, and registry audit with no known vulnerabilities                  |
| `pnpm contracts:validate`        | passed; 10 cases, 40 supplied candidates, representability only                                                                     |
| `pnpm catalog:validate`          | passed; 150 candidates; digest `4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634`                                   |
| `pnpm ingestion:verify`          | passed; 11 files and 156 tests plus typecheck                                                                                       |
| `pnpm db:verify`                 | passed; PostgreSQL 18.4, migrations 0001–0003, 17 product tables, four files and 36 tests, no skips                                 |
| `pnpm eval:validate`             | passed; 10 cases                                                                                                                    |
| `pnpm eval:fixtures`             | passed; all five fixed strategies produced the expected summaries                                                                   |
| `pnpm artifacts:validate`        | passed; 150 root attempts, 30 additional-path candidates; digest `17d2a47f8d992275c95d55434bfc24776fb8ac51fc626e7610502f687bf3d02c` |
| `pnpm artifacts:verify`          | passed; six files and 107 artifact tests plus typecheck                                                                             |
| `git diff --check`               | passed                                                                                                                              |

The ordinary `pnpm verify` path performed no model-provider request. The
explicit CI path performed only its expected registry-backed audit and local
pinned PostgreSQL-container verification; it did not contact OpenAI or a
candidate source. No live Phase 5, 6, or 7 operator ran. An orchestration shell
initially exposed pnpm 11.9.0 for one focused command, and the repository
runtime preflight rejected it before work began. The focused matrix was then
rerun in full with the pinned Node.js 24.18.0/pnpm 11.17.0 toolchain and passed.

Compatibility checks found no diff in `.node-version`, `.nvmrc`,
`pnpm-lock.yaml`, `pnpm-workspace.yaml`, `packages/contracts`,
`packages/persistence/migrations`, either catalog manifest, or any package
manifest. The nine schema digests enforced by the passing contract suite
remain:

| Contract root             | SHA-256                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| candidate dossier         | `d16d0424ed45edcf61d8084cbd21ebbb396366522d1b1a425b6cf8405e0680af` |
| capability request        | `3d1f213efdacd6ff550a66a74703b94abc56aead59cdcb08b7a2769b5a5a1ab9` |
| error envelope            | `7a708cc440a7992cb164715dce6029befbe78970c3283d8a1bff9298c87603d0` |
| fit-assessment request    | `c130a56044cbb043fac97e66db4c372d48990d672784b4abfde9ab9e78c9e504` |
| fit-assessment response   | `330b5b3940858428b1881701774bac785a7c93cf2d50e6dcb4ec37091a696a4d` |
| repository artifact       | `994643368bdc95a5279a2d939ec350ed65932ad16a3c937ae32f52ff87113d16` |
| repository artifact chunk | `d79d2803e3e11e83a9554eae4a38bba1bf379da6f767be402105cc3bf57508a6` |
| repository artifact set   | `0d78814c3361e76e9d82c29cc6464fbedb3e6b761269dba3641c0e1c2c894e54` |
| repository fingerprint    | `73f42c7a7cd20de24372ecddb7afa33925ca1f4d67cb1f9598cd9d56ea87477c` |

## Milestone 2 implementation evidence

### Implemented boundary and file map

Milestone 2 adds one private package and one immutable specification directory.
No durable production contract root, application/provider/persistence port,
artifact prompt renderer, alias-to-artifact mapper, provider HTTP adapter,
database behavior, evaluation corpus, or operator exists.

```text
packages/interviews/
  README.md
  package.json
  tsconfig.json
  tsconfig.test.json
  scripts/
    specification-cli.ts
    tsconfig.json
  src/
    canonical-json.ts
    index.ts
    provider-output-issues.ts
    provider-output-parser.ts
    provider-output-preflight.ts
    provider-output-schema.ts
    provider-output-validation.ts
    schema-projection.ts
    specification.ts
  test/
    fixtures.ts
    import-side-effects.test.ts
    provider-output.test.ts
    schema-projection.test.ts
    specification.test.ts
    tsconfig.json

interviews/repository/specifications/1.0.0/
  README.md
  specification.json
  instructions.md
  questions.json
  provider-output.schema.json
  providers/
    openai-responses.strict.schema.json
```

Required workspace wiring changed only:

```text
.prettierignore
dependency-cruiser.config.mjs
package.json
pnpm-lock.yaml
tsconfig.json
vitest.config.ts
tools/repository-checks/src/repository-invariants.ts
tools/repository-checks/test/repository-invariants.test.ts
tools/repository-checks/test/temp-repository.ts
```

`pnpm-workspace.yaml` already includes `packages/*` and remains unchanged.
Generated schema snapshots are excluded from Prettier because their exact
canonical bytes belong to the deterministic generator; ordinary formatting
still covers their TypeBox source, manifest, reviewed instructions/questions,
README, CLI, and tests.

### Provider-output schema and validation

`provider-output-schema.ts` is the sole executable schema source. Its TypeBox
root is a closed object containing exactly the required
`documentedPositions`, `inferences`, `limitations`, `contradictions`, and
`unknowns` arrays. The TypeBox-derived static type is the only maintained
TypeScript provider-output shape.

The parser applies:

1. a bounded plain-data object-graph preflight;
2. strict Ajv 2020-12 structural validation without coercion, defaults,
   property removal, custom schema loading, or caller schemas;
3. an owned data copy;
4. local semantic validation; and
5. bounded value-free issues.

Local validation enforces inclusive citation ranges, the 80-line span,
duplicate citations within a semantic item, the global 96-unique-citation
bound, total claims, canonical duplicate semantic items, all-topic coverage,
inference-rationale non-repetition, distinct contradiction sides, and
artifact-set-scoped unknowns. A citation reused by different semantic items is
one canonical citation for the global bound; it is not rejected merely because
one exact source span responsibly supports more than one item. Duplicate
citations inside one item are rejected.

Semantic text is preserved exactly. Validation counts Unicode scalar values
and UTF-8 bytes, requires exact UTF-8 round trip, and rejects surrounding
whitespace, NUL, Unicode control/format characters, Markdown links, HTML tags,
and HTTP(S) URLs. It neither trims nor sanitizes. NFC is not required,
consistent with existing free-text contracts; decomposed valid Unicode remains
exact while lone-surrogate input fails the UTF-8 round-trip check.

### Projection and specification decisions

The OpenAI projection preserves the reviewed executable subset and fails
closed on unknown keywords, root unions, open objects, optional properties,
unsupported formats, unresolved/nonlocal references, excessive object depth or
property count, and unsupported composition. The projection removes exactly:

```text
$schema
$id
title
description
examples
default
minLength
maxLength
uniqueItems
```

Unsupported `oneOf`, `allOf`, `not`, `dependentRequired`,
`dependentSchemas`, `if`, `then`, and `else` are rejected rather than removed:
dropping them would change semantics and violate the binding fail-closed rule.
Nested `anyOf`, `$defs`, valid local `$ref`, patterns, supported formats,
numeric constraints, array bounds, enums, consts, closure, and required
properties survive.

The specification loader treats `instructions.md` and `questions.json` as
reviewed source, validates exact UTF-8 and the frozen topic order, and performs
no I/O until explicitly called. `interviews:generate` is the only writer.
`interviews:validate` is read-only and recomputes source, snapshot, projection,
manifest, and semantic-policy digests without network access.

The frozen values are:

| Value                            | Result                                                             |
| -------------------------------- | ------------------------------------------------------------------ |
| Specification version            | `1.0.0`                                                            |
| Renderer version                 | `repository-interview-renderer-v1`                                 |
| Provider-output schema version   | `1.0.0`                                                            |
| OpenAI strict projection version | `1.0.0`                                                            |
| Specification digest             | `da2c8560e0b6a2fc7bc8d79fd89f65984815236a54cbf49491911274db8168f9` |
| Provider-output schema digest    | `5fa5d1c44a8924d8be3acc2ac74e58ec45ea134264c2245b7e158873b2e26b19` |
| OpenAI strict projection digest  | `5d81e5e32cc4871f0068f691302282a4e5dd6dc656ee4be132c050fbc4228ed7` |

The specification digest binds exact instruction and ordered-question bytes,
provider-output schema version/digest, renderer version, and the controlled
semantic policy. The OpenAI projection version/digest remains separate.
README bytes, candidates, artifact sets, models, reasoning, provider settings,
timestamps, and candidate prompt bytes are excluded.

### Red/green and verification evidence

The first focused run occurred after test/package scaffolding but before any
`src/` implementation. `pnpm interviews:test` failed all four test files
because `packages/interviews/src/index.ts` did not exist; this was the intended
red boundary. After implementation, the focused suite passed four files and 68
tests.

Two full-verification discoveries were corrected and retained as evidence:

- the first ordinary run stopped at Prettier after a final projection
  type-narrowing edit; the file was formatted and the complete matrix restarted;
- the next run reached the repository invariant checker after all 885 tests
  passed and identified unreviewed protected script strings. The checker and
  its fixtures were updated to protect the interviews build/typecheck/
  generate/validate/test/verify graph, its focused 43 tests passed, and the
  complete matrix restarted.
- the first hosted CI run for commit `7b4af6b` passed the new package and all
  885 tests, then the PR-aware repository checker rejected the new tracked
  `packages/interviews/` files. Clean-tree local verification had not exercised
  that diff-aware path. A red repository-invariant test reproduced the
  rejection; the checker now approves the package path, requires its structural
  entry points, and enforces its exact package/dependency policy. The focused
  repository-check suite passes 58 tests, and the complete matrix passes 886
  tests. The rejected run made no provider request and did not reach any Phase
  7 live behavior.

The final pre-commit matrix on 2026-07-30 produced:

| Command                          | Result                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile` | passed; eight workspace projects already up to date; pnpm 11.17.0                                                                                                        |
| `pnpm interviews:verify`         | passed; specification/digests valid; four files and 68 tests; package typecheck; 657 modules/2,078 dependencies without violation                                        |
| `pnpm verify`                    | passed; 48 files and 886 tests; format, lint, seven package typechecks, build, architecture, repository, evaluation, contract, catalog, specification, and secret checks |
| `pnpm verify:ci`                 | passed; repeated ordinary verification, PostgreSQL 18.4 integration with 36 tests and no skips, and registry audit with no vulnerabilities                               |
| `pnpm contracts:validate`        | passed; 10 cases and 40 supplied candidates; representability only                                                                                                       |
| `pnpm catalog:validate`          | passed; 150 candidates; digest `4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634`                                                                        |
| `pnpm ingestion:verify`          | passed; 11 files and 156 tests plus typecheck                                                                                                                            |
| `pnpm db:verify`                 | passed; PostgreSQL 18.4, migrations 0001–0003, 17 product tables, four files and 36 tests, no skips                                                                      |
| `pnpm eval:validate`             | passed; 10 cases                                                                                                                                                         |
| `pnpm eval:fixtures`             | passed; all five fixed strategies produced expected summaries                                                                                                            |
| `pnpm artifacts:validate`        | passed; 150 root attempts, 30 additional-path candidates; digest `17d2a47f8d992275c95d55434bfc24776fb8ac51fc626e7610502f687bf3d02c`                                      |
| `pnpm artifacts:verify`          | passed; six files and 107 artifact tests plus typecheck                                                                                                                  |
| `pnpm test:coverage`             | passed; 48 files and 886 tests; interviews 89.69% statements, 84.06% branches, 98.16% functions, 89.57% lines                                                            |
| `git diff --check`               | passed                                                                                                                                                                   |

The lockfile adds only the `packages/interviews` importer and reuses the
existing exact workspace/contracts link, `ajv@8.20.0`, and `typebox@1.3.8`.
No external package version, resolution, integrity, or tarball entry changed.
The existing nine contract roots and digests, migrations 0001–0003, catalog
and artifact manifests/digests, Node/pnpm pins, and workspace globs remain
unchanged. No candidate content, credential, environment file, model call,
provider/network request, database mutation, live operator, or Phase 5/6/7
live execution occurred. `verify:ci` made only its expected registry audit and
ephemeral local PostgreSQL verification calls.

## Milestone 3 implementation evidence

### Implemented files and authority

Milestone 3 adds no package, dependency, migration, operator, provider,
persistence port, prompt renderer, alias mapper, candidate content, or live
behavior. Its executable files are limited to:

```text
packages/contracts/src/
  owned-json.ts
  repository-interview-schemas.ts
  repository-interview-digests.ts
  repository-interview-identity.ts
  repository-interview-parsers.ts

packages/contracts/test/
  repository-interview-contracts.test.ts
```

Existing contract catalog, structural-validation, public export, schema
artifact test, and canonical artifact-digest modules receive only the additive
wiring required by those roots. `@gitblocks/interviews` imports the shared
frozen topic constant from `@gitblocks/contracts`; its provider-output TypeBox
definition remains the sole provider DTO authority.

The three exact additive roots are:

- `RepositoryInterviewRequestV1`: contract/request/candidate/artifact-set
  identity, specification and renderer versions/digests, provider-output
  schema version/digest, prompt digest, identity digest, and record digest. It
  has no timestamp, dossier, provider/model configuration, review, ranking, or
  recommendation field.
- `ModelExecutionV1`: request identity, trusted nonce and normal/forced mode,
  closed model profile and profile digest, reuse-key digest, root timestamps,
  one or two one-based contiguous bounded attempt summaries, terminal
  success/failure outcome and validated nullable usage, identity digest, and
  record digest. Provider identifiers are nullable and restricted to the
  reviewed alphanumeric/period/underscore/hyphen grammar. Successful outcomes
  close against a final 2xx response, transport-terminal failure codes close
  against the final attempt, and dated snapshots must end in a real calendar
  date. It carries no prompt/source/provider body, reasoning, refusal, header,
  URL, SQL, or raw error.
- `RepositoryInterviewV1`: exact candidate/artifact-set/request/successful
  execution provenance, specification/renderer/schema/projection/prompt/model
  digests, derived processing state, canonical citation catalog, claims,
  limitations, contradictions, unknowns, publication timestamp, identity
  digest, and record digest. It has no provider aliases, dossier, review,
  selection, ranking, or recommendation state.

Nested IDs use `intcite-`, `intclaim-`, `intlimit-`, `intcontra-`, and
`intunknown-`; roots use `intreq-`, `modelexec-`, and `interview-`. Every ID
contains the first 48 hex characters of a full domain-separated SHA-256
identity and is checked against that complete digest. Semantic strings are
preserved byte-for-byte: NFC and NFD stay distinct, and no trim,
normalization, rewrite, sanitization, or silent deduplication occurs.

Request identity binds only deterministic candidate/artifact-set and prompt
authority. A model profile has a separate complete digest. The reuse key binds
request and profile digests; execution identity adds nonce, mode, and force
reason; attempts, timestamps, usage, terminal outcome, and provider IDs remain
record-only. Interview identity binds exact request/execution provenance,
processing state, and ordered nested identity digests; `publishedAt` remains
record-only.

Trusted constructors accept resolved artifact IDs and line coordinates, never
provider aliases or caller-generated IDs/digests. They preflight and copy plain
data, reject unsupported fields, derive nested and root identities/records,
canonicalize citation references and contradiction sides, derive processing
state, and return values accepted by the public parsers. The parsers repeat
bounded preflight, strict TypeBox/Ajv validation, owned copying, semantic and
referential validation, and digest/collision checks with bounded value-free
diagnostics.

`validateRepositoryInterviewExecutionV1` requires a successful execution and
closes request, candidate, artifact-set, specification, renderer,
provider-output-schema, prompt, provider projection, model profile, execution,
provider-output provenance, and publication chronology. Publication at
execution completion is valid; publication before completion is rejected.
Artifact-set membership and exact line-count closure were intentionally
deferred from the cross-root validator and are now enforced by the accepted
Milestone 4 mapping boundary before durable construction.

The new schema digests are:

| Contract root                | SHA-256                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| repository interview request | `c009494390484a40ace4eea9b58ba3b288cf0577c13aab926fb7e5cdcfb7c673` |
| model execution              | `f362632090107fc97b20708a24d5888f3d0e531f724887cc37dd5aa777a272b7` |
| repository interview         | `99c749af8dd7d907d0b84b8342297b59b1222f32011a598a753364d168f5a7eb` |

All prior nine schema digests remain the values listed above. The frozen
specification, provider-output schema, and OpenAI projection digests remain
`da2c8560e0b6a2fc7bc8d79fd89f65984815236a54cbf49491911274db8168f9`,
`5fa5d1c44a8924d8be3acc2ac74e58ec45ea134264c2245b7e158873b2e26b19`,
and
`5d81e5e32cc4871f0068f691302282a4e5dd6dc656ee4be132c050fbc4228ed7`.

### Red/green evidence

The diagnostic cleanup first added focused failures for ordinary limitation
classification and exact contradiction/unknown citation paths. The focused
run failed two of 53 tests, then passed all 70 relevant tests after the fix.
The frozen specification validator remained green, and commit `ab5df00` was
pushed separately.

Before durable implementation, the new contract/topic suite failed all 19 new
tests because the shared topic authority, constructors, parsers, schemas, and
catalog roots did not exist. The current focused contract/interviews/schema
suite passes 82 tests.

The subsequent Milestone 3 review accepted the request and interview roots but
required four execution-provenance corrections before renewed acceptance. The
focused correction suite first failed five of 25 tests: narrow provider
identifiers, final attempt/outcome agreement, transport-terminal failure-code
agreement, publication chronology, and real model-snapshot dates. After the
correction, all 25 focused tests pass. Only the model-execution schema digest
changed; request, interview, specification, provider-output, projection, and
the nine pre-Phase-7 schema digests remain exact.

The first full `pnpm verify` attempt stopped before tests on an insufficient
TypeScript guard in the new schema-test helper. After that guard was corrected,
the next run reached the new required-property assertion and showed that the
canonical schema sorts property keys while TypeBox preserves declaration order
in `required`; the assertion was corrected to compare sets. Both discoveries
were test-only and changed no schema or runtime behavior. The complete matrix
was restarted and passed.

The final pre-commit matrix on 2026-07-30 produced:

| Command                          | Result                                                                                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | passed; all eight workspace projects already up to date; pnpm 11.17.0                                                                                     |
| `pnpm interviews:verify`         | passed; frozen digests valid; four files and 72 tests; package typecheck; 663 modules/2,100 dependencies without violation                                |
| `pnpm verify`                    | passed; 49 files and 916 tests; format, lint, typecheck, build, architecture, repository, evaluation, contract, catalog, specification, and secret checks |
| `pnpm verify:ci`                 | passed; repeated 916-test verification, PostgreSQL 18.4 with 36 tests/no skips, and registry audit with no vulnerabilities                                |
| `pnpm contracts:validate`        | passed; 10 cases and 40 supplied candidates; representability only                                                                                        |
| `pnpm catalog:validate`          | passed; 150 candidates; digest `4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634`                                                         |
| `pnpm ingestion:verify`          | passed; 11 files and 156 tests plus typecheck                                                                                                             |
| `pnpm db:verify`                 | passed; PostgreSQL 18.4, migrations 0001–0003, 17 product tables, four files and 36 tests, no skips                                                       |
| `pnpm eval:validate`             | passed; 10 cases                                                                                                                                          |
| `pnpm eval:fixtures`             | passed; all five fixed strategies produced expected summaries                                                                                             |
| `pnpm artifacts:validate`        | passed; 150 root attempts and 30 additional-path candidates; digest `17d2a47f8d992275c95d55434bfc24776fb8ac51fc626e7610502f687bf3d02c`                    |
| `pnpm artifacts:verify`          | passed; six files and 107 tests plus typecheck                                                                                                            |
| `pnpm test:coverage`             | passed; 49 files and 916 tests; contracts 93.14% statements/78.66% branches/97.60% functions/93.04% lines; repository total 78.87%/71.28%/85.59%/78.70%   |
| `git diff --check`               | passed                                                                                                                                                    |

No dependency, package manifest, lockfile, workspace glob, TypeScript pin,
Node/pnpm pin, migration, catalog, artifact manifest, candidate content,
credential, or environment file changed. Ordinary verification performed no
provider request and no Phase 5/6/7 live operation. `verify:ci` made only its
expected registry-audit and ephemeral local PostgreSQL verification calls.

## Milestone 4 implementation evidence

### Implemented files and authority

Milestone 4 adds:

```text
packages/contracts/src/artifact-identity.ts
packages/contracts/src/parsers.ts
packages/contracts/test/artifact-contracts.test.ts

packages/interviews/src/
  repository-interview-mapping-issues.ts
  repository-interview-prompt.ts
  repository-interview-mapping.ts

packages/interviews/test/
  repository-interview-mapping.test.ts
```

Existing package indexes and specification loading receive only the required
exports and pure loaded-authority validation. No contract schema, interview
specification snapshot, package manifest, dependency, lockfile, migration,
catalog, artifact manifest, operator, or evaluation file changes.

`splitRepositoryArtifactLogicalLines` is now the single Phase 6/7 line
authority. It splits LF, CRLF, and CR; preserves all non-separator characters,
empty lines, and a terminal empty line; returns one line for separator-free or
empty content; and rejects invalid Unicode. The artifact parser consumes this
same helper, so accepted `RepositoryArtifactV1.lineCount` and rendered
coordinates cannot drift.

The artifact-context validator parses the exact set and every accepted
artifact through public contract parsers, proves complete present-entry
closure and trusted candidate/repository/commit/path ownership, rejects
duplicates/extras/not-found material, enforces four artifacts/40,000 lines/512
KiB, and orders accepted artifacts only through set membership. It performs no
filesystem, PostgreSQL, GitHub, or provider operation.

Renderer V1 returns separate immutable instruction/evidence strings plus
trusted alias bindings and byte/line accounting. The evidence string is
canonical JSON, not prose or Markdown. `A1`–`A4` follow present-entry ordinal;
`not-found` entries do not consume aliases. The prompt and provider-output
digest algorithms and bounds are defined in the model-visible prompt section.
Frozen synthetic examples are:

```text
prompt          bdfa0ac1bd39782028a3e3f5598cf980ae5066aaef24068eee0c1a45059ff584
provider output e245c7db27f96709263f120760ff4394602ae70053bd4f0162a59dcf82b2789c
```

The provider-output resolver repeats local parsing, validates aliases/ranges
against the exact rendered context, maps only to trusted artifact IDs, and
returns the existing constructor input shapes with one deterministic unique
coordinate catalog. It creates no durable IDs or timestamps. The synthetic
integration test combines its result with accepted request/execution
constructors and proves `createRepositoryInterviewV1` plus
`validateRepositoryInterviewExecutionV1` succeed; no application use case is
introduced.

### Red/green evidence

The line and mapping tests were written first. The first focused run recorded
40 intended failures because the shared line helper and all renderer,
digesting, and mapping APIs were absent. After implementation, the focused
contracts/interviews run passes 50 tests, including the golden digests,
artifact closure abuse matrix, 40,000-line boundary, value-free 20-issue cap,
all semantic families, terminal empty-line citation, cross-prompt alias
rejection, and durable-constructor integration.

`pnpm interviews:verify` passes the unchanged three specification digests,
five interview test files with 103 tests, package typecheck, and architecture
validation with no dependency violation.

The first complete `pnpm verify` run passed 956 tests and then failed the
contracts public-surface snapshot because it did not yet list the newly
required shared line helper. The expected API list was updated with only
`splitRepositoryArtifactLogicalLines`; the restarted complete matrix passed.
This was a test-authority correction, not a schema or runtime change.

The pre-commit matrix on 2026-07-30 produced:

| Command                          | Result                                                                                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | passed; all eight workspace projects already up to date; pnpm 11.17.0                                                                                     |
| `pnpm interviews:verify`         | passed; frozen digests valid; five files and 103 tests; package typecheck; 667 modules/2,115 dependencies without violation                               |
| `pnpm verify`                    | passed; 50 files and 957 tests; format, lint, typecheck, build, architecture, repository, evaluation, contract, catalog, specification, and secret checks |
| `pnpm verify:ci`                 | passed; repeated 957-test verification, PostgreSQL 18.4 with 36 tests/no skips, three migrations/17 tables, and registry audit with no vulnerabilities    |
| `pnpm contracts:validate`        | passed; 10 cases and 40 supplied candidates; representability only                                                                                        |
| `pnpm catalog:validate`          | passed; 150 candidates; digest `4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634`                                                         |
| `pnpm ingestion:verify`          | passed; 11 files and 156 tests plus typecheck                                                                                                             |
| `pnpm db:verify`                 | passed through `verify:ci`; PostgreSQL 18.4, migrations 0001–0003, 17 product tables, four files and 36 tests, no skips                                   |
| `pnpm eval:validate`             | passed; 10 cases                                                                                                                                          |
| `pnpm eval:fixtures`             | passed; all five fixed strategies produced expected summaries                                                                                             |
| `pnpm artifacts:validate`        | passed; 150 root attempts and 30 additional-path candidates; digest `17d2a47f8d992275c95d55434bfc24776fb8ac51fc626e7610502f687bf3d02c`                    |
| `pnpm artifacts:verify`          | passed; six files and 107 tests plus typecheck                                                                                                            |
| `pnpm test:coverage`             | passed; 50 files and 957 tests; repository 79.13% statements/71.41% branches/86.11% functions/78.95% lines; interviews 89.33%/81.26%/98.83%/89.13%        |
| `git diff --check`               | passed                                                                                                                                                    |

All 12 contract schema digests remain byte-identical, including the accepted
Milestone 3 roots:

```text
repository-interview-request c009494390484a40ace4eea9b58ba3b288cf0577c13aab926fb7e5cdcfb7c673
model-execution               f362632090107fc97b20708a24d5888f3d0e531f724887cc37dd5aa777a272b7
repository-interview          99c749af8dd7d907d0b84b8342297b59b1222f32011a598a753364d168f5a7eb
```

The specification, provider-output schema, and OpenAI projection remain
`da2c8560e0b6a2fc7bc8d79fd89f65984815236a54cbf49491911274db8168f9`,
`5fa5d1c44a8924d8be3acc2ac74e58ec45ea134264c2245b7e158873b2e26b19`,
and
`5d81e5e32cc4871f0068f691302282a4e5dd6dc656ee4be132c050fbc4228ed7`.
No package manifest, dependency, lockfile, workspace glob, migration,
catalog/artifact manifest, candidate body, credential, or environment file
changed. No persistence/provider port, operator, model call, Phase 7 database
operation, or Phase 5/6/7 live operator was added or run. `verify:ci` made only
the expected registry-audit and ephemeral local PostgreSQL verification calls.

## Milestone 5 implementation evidence

### Implemented application boundary

Milestone 5 adds:

```text
packages/contracts/src/
  repository-interview-parsers.ts
  structural-validation.ts

packages/interviews/src/
  repository-interview-application-issues.ts
  repository-interview-application.ts

packages/interviews/test/
  repository-interview-application.test.ts
```

Existing indexes expose only the narrow parser, use case, port, result, and
issue types. `parseModelExecutionModelProfileV1` compiles and reuses the
existing nested TypeBox schema and real-date semantic rule; it creates no new
root and changes no schema bytes. No package manifest, dependency, lockfile,
workspace, specification, migration, catalog, artifact manifest, operator, or
evaluation authority changes.

The closed application input has exactly:

```text
artifactSet
artifacts
specification
modelProfile
executionMode
forceReason
```

The application renders internally, creates the deterministic request,
validates the model profile and projection authority, computes model-profile
and reuse-key digests, and then either validates reuse or performs one
provider operation. The rendered prompt is one frozen ephemeral trusted
object. The exact object reference is supplied to the provider port and then
to `resolveRepositoryInterviewProviderOutputV1`; no caller, provider, or record
port can supply, replace, clone, reconstruct, or persist it.

The renderer treats the artifact-array shape itself as untrusted. Before
element access, it uses bounded descriptor inspection to accept only an
ordinary array with its standard `length` property and zero through four
contiguous enumerable numeric data properties. It rejects sparse,
accessor-backed, non-enumerable, symbol-bearing, extra-property,
nonstandard-prototype, over-bound, and throwing-proxy shapes without invoking
numeric getters, then passes a frozen owned array to the artifact parsers.
The application catches any residual renderer exception as the same
value-free `prompt-render-failed` boundary result before record, provider,
nonce, or clock effects.

The provider request has exactly `prompt`, `modelProfile`,
`providerProjectionVersion`, `providerProjectionDigest`, and
`providerProjectionText`. Response results contain only response status, one
or two safe attempts, usage, and unknown provider output. Controlled failure
results contain only failed status, attempts, an accepted failure code, and
nullable usage. The application derives provider-output and execution
identity/digests and catches unexpected port exceptions as value-free
application issues.

A response effect is eligible for semantic resolution only after the accepted
execution constructor proves its one-or-two-attempt history, chronology,
provider identifiers, byte/rate metadata, final HTTP 2xx response, and real
usage. A second private preflight using known-valid zero usage distinguishes a
genuine usage-only failure from malformed attempt/terminal metadata. Genuine
usage failure publishes one `invalid-usage` execution with null usage,
provider-output digest, and interview without inspecting semantic output.
Malformed response effects are `provider-port-failure` and receive no resolver,
clock, or publication call. Controlled failed effects must construct their
declared execution with the supplied nullable usage; invalid non-null usage is
never silently downgraded to null.

The record port looks up only by request identity digest, model-profile digest,
and reuse-key digest. Returned roots are reparsed and the complete successful
exchange is revalidated. Mismatch or poison fails closed without provider
fallback. Valid normal reuse consumes no nonce, provider operation, clock read,
or publication. Forced execution skips reuse, consumes one injected
32-character lowercase hexadecimal nonce, preserves the deterministic request
and reuse key, and creates a distinct execution.

Publication receives exactly `{ request, execution, interview }`. Valid
provider output resolves with the exact prompt, creates a successful execution
and immutable interview, enforces publication at or after completion, validates
the full exchange, and publishes once. Controlled provider failures and
provider-output structural/semantic/alias/range failures publish the request
plus a safe failed execution and null interview. Idempotent records must parse,
close, and match record digests; conflict fails closed.

Successful results use `created`, `idempotent`, or `reused`; controlled provider
completion uses `provider-failed`. Boundary issues are capped, path-bounded,
fixed-message records with codes:

```text
application-input-invalid
prompt-render-failed
model-profile-invalid
reuse-record-invalid
provider-port-failure
publication-time-invalid
record-port-failure
record-port-conflict
application-closure
```

Test-owned deterministic provider, record, clock, and nonce fakes cover
success, controlled failures, invalid provider output, alias/range failures,
throws, prompt mutation, valid/poisoned reuse, created/idempotent/conflict
publication, call ordering, and deterministic effect counts. They are not
production exports.

### Red/green evidence

The Milestone 5 tests were written before the application implementation. The
first focused run recorded 45 intended failures because the use case and
nested model-profile parser did not exist. The green focused run passes 48
tests after adding closure assertions for exact provider/record shapes,
idempotent digest mismatch, publication exactly at completion, and owned
specification authority across the first asynchronous effect.

The correction tests were also written red first. The focused two-file run
recorded 21 intended failures: artifact accessors were invoked or escaped,
unexpected renderer exceptions escaped, malformed response effects reached
the resolver, genuine invalid usage reached semantic mapping, and malformed
controlled-failure usage was silently retried as null. After the correction,
the same focused run passes 100 tests. Direct renderer cases cover sparse,
accessor-backed, extra-property, symbol-bearing, nonstandard-prototype, and
throwing-proxy arrays; application cases prove bounded `prompt-render-failed`
results and zero effects. Provider cases prove terminal/attempt closure,
usage-only classification, strict controlled-failure metadata, zero semantic
resolution where prohibited, and value-free results.

`pnpm interviews:verify` passes six interview test files with 172 tests,
package typecheck, the unchanged specification digests, and dependency
cruiser with no violation. `pnpm test:coverage` passes 51 files and 1,026
tests; repository coverage is 79.43% statements, 71.72% branches, 86.17%
functions, and 79.25% lines, while `packages/interviews/src` is 89.09%,
80.69%, 97.98%, and 88.89%.

The pre-commit matrix on 2026-07-30 produced:

| Command                          | Result                                                                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | passed; eight workspaces already current; pnpm 11.17.0                                                                                                |
| `pnpm interviews:verify`         | passed; six files/172 tests, package typecheck, three frozen digests, 671 modules/2,127 dependencies without violation                                |
| `pnpm verify`                    | passed; 51 files/1,026 tests plus formatting, lint, typecheck, build, architecture, repository, evaluation, contract, catalog, specification, secrets |
| `pnpm verify:ci`                 | passed; repeated 1,026-test verification, PostgreSQL 18.4 with 36 tests/no skips, three migrations/17 tables, registry audit with no vulnerabilities  |
| `pnpm contracts:validate`        | passed; 10 cases/40 supplied candidates; representability only                                                                                        |
| `pnpm catalog:validate`          | passed; 150 candidates; digest `4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634`                                                     |
| `pnpm ingestion:verify`          | passed; 11 files/156 tests plus typecheck                                                                                                             |
| `pnpm db:verify`                 | passed separately and in CI; PostgreSQL 18.4, migrations 0001–0003, 17 product tables, four files/36 tests, no skips                                  |
| `pnpm eval:validate`             | passed; 10 cases                                                                                                                                      |
| `pnpm eval:fixtures`             | passed; five fixed strategies produced expected summaries                                                                                             |
| `pnpm artifacts:validate`        | passed; 150 root attempts/30 additional-path candidates; digest `17d2a47f8d992275c95d55434bfc24776fb8ac51fc626e7610502f687bf3d02c`                    |
| `pnpm artifacts:verify`          | passed; six files/107 tests plus typecheck                                                                                                            |
| `pnpm test:coverage`             | passed; 51 files/1,026 tests; repository 79.43%/71.72%/86.17%/79.25%; interviews 89.09%/80.69%/97.98%/88.89%                                          |
| `git diff --check`               | passed                                                                                                                                                |

All 12 contract schema digests, all three specification digests, the Milestone
4 golden prompt/provider-output digests, Phase 6 artifact IDs/line semantics,
migrations 0001–0003, catalog and artifact-manifest digests, package
dependencies, and the lockfile remain unchanged. Migration 0004, a concrete
persistence/provider adapter, operator app, evaluation corpus, credentials,
environment files, and candidate content remain absent. No model-provider
request or Phase 5/6/7 live operator ran. The verification matrix used only its
expected registry audit and ephemeral local PostgreSQL checks.

### Milestone 6 red/green and verification evidence

The persistence tests were written before migration 0004 or its operations.
The focused unit run recorded five intended failures for the absent migration,
three absent operations, and absent dependency-boundary source. The first real
PostgreSQL run retained all 37 then-existing database tests and recorded 13
intended Milestone 6 integration failures.

The green implementation adds exactly eight tables and three public operations.
The original focused unit run passes five tests. After review identified the
normalized read-authority gap, five new corruption cases first failed while all
54 existing database tests remained green; the focused typed-row suite also
failed before its validator existed. The correction passes six typed-row tests
and `pnpm db:verify` passes five files and 59 tests on PostgreSQL 18.4 without
skips, with four migrations, 25 public product tables, and zero RLS policies.
Integration coverage includes complete
five-family publication and reconstruction, failed executions, exact replay,
normal/forced history, earliest eligible reuse, sequential and concurrent
idempotency/conflicts, missing/extra member closure, artifact-set and citation
closure, corrupt-history rejection, historical not-found behavior,
owner/runtime immutability, grants, and prohibited-column minimization.

The corrected loader independently reconciles every normalized execution
column, including denormalized candidate/artifact-set ownership, with the
parsed execution and its request. Typed citation, claim, limitation,
contradiction, and unknown rows reconcile parent context, ordinal, stable ID,
controlled query fields, digests, and exact canonical value with the parsed
interview. Publication reload, both historical lookup forms, and reuse share
this one fail-closed loader; an eligible corrupt reuse record is never skipped.

The migration 0004 SHA-256 is
`2cd18e7d92373215b2a540cdf12e32a7e949bfb01866616e8a44ad326e45bca0`.
The complete 2026-07-31 local matrix produced:

| Command                          | Result                                                                                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | passed; eight workspaces already current; pnpm 11.17.0                                                                                                    |
| `pnpm interviews:verify`         | passed; six files/172 tests, package typecheck, three frozen digests, 677 modules/2,149 dependencies without violation                                    |
| `pnpm verify`                    | passed; 53 files/1,037 tests plus formatting, lint, typecheck, build, architecture, repository, evaluation, contract, catalog, specification, and secrets |
| `pnpm verify:ci`                 | passed; repeated 1,037-test verification, PostgreSQL 18.4 with 59 tests/no skips, four migrations/25 tables, registry audit with no vulnerabilities       |
| `pnpm contracts:validate`        | passed; 10 cases/40 supplied candidates; representability only                                                                                            |
| `pnpm catalog:validate`          | passed; 150 candidates; digest `4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634`                                                         |
| `pnpm ingestion:verify`          | passed; 11 files/156 tests plus typecheck                                                                                                                 |
| `pnpm db:verify`                 | passed separately and in CI; PostgreSQL 18.4, four migrations, 25 product tables, five files/59 tests, no skips                                           |
| `pnpm eval:validate`             | passed; 10 cases                                                                                                                                          |
| `pnpm eval:fixtures`             | passed; five fixed strategies produced expected summaries                                                                                                 |
| `pnpm artifacts:validate`        | passed; 150 root attempts/30 additional-path candidates; digest `17d2a47f8d992275c95d55434bfc24776fb8ac51fc626e7610502f687bf3d02c`                        |
| `pnpm artifacts:verify`          | passed; six files/107 tests plus typecheck                                                                                                                |
| `pnpm test:coverage`             | passed; 53 files/1,037 tests; repository 78.07%/70.34%/84.79%/77.89%; interviews 89.09%/80.69%/97.98%/88.89%                                              |
| `git diff --check`               | passed                                                                                                                                                    |

All 12 contract schema digests, three specification digests, two Milestone 4
goldens, Phase 6 artifact identities and logical-line semantics, migrations
0001–0003, catalog and artifact-manifest digests, package manifests,
dependencies, workspace configuration, and lockfile remain unchanged. No
provider, operator, evaluation corpus, credential, candidate content, or live
operation was added or used.

### Milestone 7 red/green and verification evidence

The initial focused red run failed before test collection because the
repository-interview corpus loader did not exist. The suite was then expanded
alongside the separately owned corpus, audit, sampling, gate, adversarial, CLI,
and architecture boundaries. The green focused run passes four files and 24
tests. Mutation cases cover exact membership, family/lifecycle/documentation
counts, status-label closure, simple/complex/unknown family coverage,
calibration replacement and diversity, closed schemas, bounded files/strings,
member/hash/order drift, content-minimized audits, distinct blind reviewers,
mandatory/sample secondary review, adjudication, all threshold boundaries,
operational denominator separation, accepted renderer isolation, trusted-ID
forgery, and alias/range rejection.

The complete 2026-07-31 local matrix produced:

| Command                          | Result                                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile` | passed; eight workspaces already current; Node 24.18.0/pnpm 11.17.0                                                                                          |
| `pnpm eval:interviews:verify`    | passed; exact 30/6-per-family cohort, 5/3/2 lifecycle and 12/18 documentation counts, 12 adversarial fixtures, 16 gate scenarios, four files/24 tests        |
| `pnpm interviews:verify`         | passed; accepted interview tests and three frozen specification digests                                                                                      |
| `pnpm verify`                    | passed; 57 files/1,061 tests plus formatting, lint, typecheck, build, architecture, both evaluation authorities, contracts, catalog, specification, secrets  |
| `pnpm verify:ci`                 | passed; repeated 1,061-test verification, PostgreSQL 18.4 with 59 tests/no skips, four migrations/25 tables/zero RLS, registry audit without vulnerabilities |
| `pnpm contracts:validate`        | passed; 10 cases/40 supplied candidates; representability only                                                                                               |
| `pnpm catalog:validate`          | passed; 150 candidates; digest `4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634`                                                            |
| `pnpm ingestion:verify`          | passed; 11 files/156 tests plus typecheck                                                                                                                    |
| `pnpm db:verify`                 | passed; PostgreSQL 18.4, four migrations, 25 product tables, zero RLS, five files/59 tests, no skips                                                         |
| `pnpm eval:validate`             | passed; unchanged `pilot-v1`, 10 cases                                                                                                                       |
| `pnpm eval:fixtures`             | passed; five unchanged fixed-strategy summaries                                                                                                              |
| `pnpm artifacts:validate`        | passed; digest `17d2a47f8d992275c95d55434bfc24776fb8ac51fc626e7610502f687bf3d02c`                                                                            |
| `pnpm artifacts:verify`          | passed; six files/107 tests plus typecheck                                                                                                                   |
| `pnpm test:coverage`             | passed; 57 files/1,061 tests; repository statements/branches/functions/lines 78.78%/71.04%/85.69%/78.66%                                                     |

Dependency cruising passed across 691 modules and 2,209 dependencies. All 12
product schema digests, all three interview specification digests, both
Milestone 4 goldens, migration 0004 checksum, migrations 0001–0004, catalog,
artifact manifest, `pilot-v1`, package dependencies, workspace configuration,
and lockfile remain unchanged. Verification performed only its prescribed
ephemeral PostgreSQL and registry-audit effects; no provider, model, operator,
real audit, candidate body, production review state, or live Phase 7 action was
added or used.

## Progress log

- **2026-07-30:** Verified clean branch, exact main/origin/main/HEAD
  `702bd7edc5b9a1de05dedc953e92af5cdc9785d9`, and merged PR #16 head.
- **2026-07-30:** Read Issue #17, the provider/durable clarification, and the
  latest architecture authorization. Recorded that the latest comment narrows
  dossier input, package placement, contract roots, review persistence, model
  calibration, bounds, quality gates, and cost ceilings.
- **2026-07-30:** Read repository instructions, product/system authority, ADRs
  0001–0006, Phase 6 plan/completion evidence, engineering policies, and the
  actual workspace/build/test/dependency configuration.
- **2026-07-30:** Rechecked official OpenAI Responses, Structured Outputs, data
  controls, prompt caching, model snapshot, context/output, rate-limit, and
  pricing documentation without calling the API or inspecting credentials.
- **2026-07-30:** Began Milestone 1 documentation only. No executable Phase 7
  behavior or live operation exists.
- **2026-07-30:** Completed the required local validation matrix with the
  pinned toolchain. All final invocations passed; existing contract, catalog,
  artifact, migration, dependency, workspace, runtime, and lockfile authority
  remained unchanged.
- **2026-07-30:** Maintainer review accepted Milestone 1, accepted ADR 0007,
  removed production review state and the request timestamp, froze the
  provider-output semantics and eight ordered questions, and authorized
  Milestone 2.
- **2026-07-30:** Began Milestone 2 with documentation reconciliation only;
  executable work remains limited to the provider-output schema,
  specification, deterministic projections, offline validation, and required
  package wiring.
- **2026-07-30:** Wrote the Milestone 2 tests first and captured the intended
  four-file import failure before adding package source.
- **2026-07-30:** Implemented the semantic-only TypeBox schema, safe parser and
  local validator, deterministic provider-neutral/OpenAI projection, immutable
  specification loader/generator/validator, and minimal workspace wiring.
- **2026-07-30:** Completed the full local matrix with 68 focused and 885
  repository tests, exact specification/schema/projection digests, unchanged
  existing authorities, PostgreSQL 18.4, registry audit, and coverage. Marked
  Milestone 2 implemented and awaiting review; Milestone 3 remains stopped.
- **2026-07-30:** Decoded the first hosted CI failure: the PR-aware repository
  checker rejected the newly tracked interviews package after the 885-test
  suite passed. Added a red regression, approved the exact package shape and
  dependency policy, and reran the complete local matrix with 886 passing
  tests before the follow-up push.
- **2026-07-30:** Maintainer review accepted Milestone 2 and authorized
  Milestone 3 after exact provider diagnostic cleanup. Added the cleanup red
  tests, preserved precise contradiction/unknown citation paths, corrected
  limitation Ajv classification, confirmed all three frozen digests, and
  pushed standalone commit `ab5df00`.
- **2026-07-30:** Wrote the durable contract and shared-topic tests first and
  captured 19 intended failures. Added exactly three closed additive roots,
  trusted constructors/digests, safe owned parsers, canonical/referential
  validation, and cross-root provenance closure. Milestone 4 remains stopped.
- **2026-07-30:** Maintainer review accepted the request/interview roots in
  substance and required four model-execution provenance corrections before
  Milestone 4. Added five focused red groups and closed provider identifier
  grammar, terminal attempt/outcome agreement, publication chronology, and
  real dated-snapshot validation. Milestone 3 awaits renewed acceptance.
- **2026-07-30:** Maintainer review accepted Milestone 3 and corrected
  model-execution digest
  `f362632090107fc97b20708a24d5888f3d0e531f724887cc37dd5aa777a272b7`,
  then authorized only the persistence-independent Milestone 4 renderer and
  mapping boundary.
- **2026-07-30:** Wrote the shared-line, artifact-closure, rendering, digest,
  alias/range, diagnostic, and durable-constructor integration tests first;
  recorded 40 intended focused failures before implementation.
- **2026-07-30:** Implemented exact logical-line reuse, deterministic separate
  instruction/evidence rendering, trusted alias closure, prompt and
  provider-output digests, value-free mapping diagnostics, and constructor
  input mapping. Milestone 4 awaits maintainer review; Milestone 5 remains
  blocked.
- **2026-07-30:** Corrected the contracts public-API snapshot after the first
  full verification passed 956 tests and rejected the unlisted shared helper.
  Restarted the complete matrix: 957 repository tests, 103 interview tests,
  PostgreSQL 18.4 with 36 no-skip tests, no dependency violations or
  vulnerabilities, unchanged schema/specification/catalog/artifact digests,
  and coverage all passed.
- **2026-07-30:** Maintainer review accepted Milestone 4 and authorized
  Milestone 5 with one exact-context amendment: the rendered prompt is an
  ephemeral trusted value and the same frozen object instance must cross both
  provider execution and trusted output resolution.
- **2026-07-30:** Wrote the application-flow tests first and recorded 45
  intended failures. Implemented the closed use case, nested model-profile
  parser, provider/record/clock/nonce ports, deterministic reuse and force
  behavior, safe failed-execution publication, and test-owned fakes. Milestone
  5 awaits maintainer review; Milestone 6 remains blocked.
- **2026-07-30:** Maintainer review accepted the Milestone 5 architecture but
  required fail-closed exotic artifact-array handling and response-effect
  preflight before semantic mapping.
- **2026-07-30:** Recorded 21 focused red failures, then added bounded
  descriptor-based artifact-array ownership, application renderer
  defense-in-depth, constructor-backed response preflight, genuine
  `invalid-usage` classification, and strict controlled-failure metadata.
  Milestone 5 remains pending renewed acceptance and Milestone 6 remains
  blocked.
- **2026-07-31:** Maintainer review accepted Milestone 5 and authorized only
  migration 0004 plus the concrete repository-interview persistence
  operations.
- **2026-07-31:** Recorded five focused unit and 13 PostgreSQL integration
  failures before implementation. Added the first-class request root, exactly
  eight immutable tables, deferred semantic/provenance closure, and the
  publish/reuse/historical-load operations.
- **2026-07-31:** Completed the full local matrix with 1,031 ordinary tests,
  PostgreSQL 18.4 with 54 tests and no skips, four migrations/25 tables/zero
  RLS, unchanged contract/specification/catalog/artifact authority, no
  dependency or lockfile change, and no provider or live operation. Milestone
  6 awaits maintainer review; Milestone 7 remains blocked.
- **2026-07-31:** Milestone 6 review accepted migration 0004 and publication
  transactions but found incomplete reconstruction authority for normalized
  execution ownership and nested semantic rows. Added five red PostgreSQL
  corruption cases and a six-test typed-row suite before strengthening the
  single complete exchange loader.
- **2026-07-31:** Completed the corrected local matrix with 1,037 ordinary
  tests, PostgreSQL 18.4 with 59 tests and no skips, four migrations/25
  tables/zero RLS, exact migration 0004 checksum, unchanged contract,
  specification, prompt, provider-output, catalog, artifact, dependency, and
  lockfile authority, and no provider or live operation. Milestone 6 awaits
  renewed maintainer review; Milestone 7 remains blocked.
- **2026-07-31:** Maintainer review accepted Milestone 6 and authorized
  Milestone 7. The initial Milestone 7 attempt stopped before file changes
  after catalog validation proved the per-family archived/moved stratum
  impossible for rate limiting and webhooks.
- **2026-07-31:** The maintainer accepted the blocker and amended lifecycle
  diversity to cohort scope without catalog mutation. Red-first tests then
  established exact cohort, calibration, audit, sampling, gate-boundary,
  adversarial, bounded-loader, and dependency-direction requirements.
- **2026-07-31:** Added `repository-interviews-v1`, ten separate evaluation
  schemas, exact manifest/policy digests, 30 content-minimized candidate
  records, 12 synthetic adversarial fixtures, deterministic audit validation,
  secondary sampling, gate reporting, and offline CLI verification. Milestone
  7 awaits renewed maintainer review; Milestone 8 remains blocked.

## Decision and deviation log

- **Issue flow narrowed:** dossier observations, limitations, unknowns,
  snapshot ID, and digest are excluded from semantic input and identity.
  Future ranking will join dossier and interview independently.
- **Application direction clarified:** `@gitblocks/interviews`, not persistence
  or ingestion, owns ports and use cases. The operator app owns concrete
  composition. This is not an architecture exception.
- **Contract surface narrowed:** production review and selection roots proposed
  in the issue investigation are deferred; only three roots are authorized.
- **Schema authority clarified:** committed JSON schemas are deterministic
  snapshots generated from one TypeBox source, not parallel hand-maintained
  authorities.
- **Provider choice narrowed:** the initial implementation uses direct fixed
  `fetch`, not the OpenAI SDK.
- **Model choice remains open:** two exact snapshots are calibration
  candidates; neither is yet the Gate A model.
- **GitHub CLI unavailable:** local Git will be used for commit and push; the
  connected GitHub application will create and inspect the draft PR. No tool or
  dependency will be installed.
- **Projection fail-closed rule:** unsupported composition is rejected, not
  stripped, because removal would alter schema meaning. Only annotations and
  locally re-enforced unsupported length/uniqueness keywords are removed.
- **Exact generated bytes:** the generator, not Prettier, owns the two schema
  snapshots; both are ignored by Prettier and checked byte-for-byte by
  `interviews:validate`.
- **Canonical citation accounting:** exact citation reuse across semantic
  items counts once toward the 96-unique-citation bound; duplicates within one
  semantic item remain invalid.
- **Unicode normalization:** semantic text requires exact UTF-8 round trip but
  not NFC. No normalization or sanitization is performed.
- **Repository shape enforcement:** the repository checker treats
  `packages/interviews/` as an approved product package, requires its minimal
  Milestone 2 entry points, and permits only contracts, exact `ajv`, and exact
  `typebox` runtime dependencies.
- **Durable creation references:** the interview constructor accepts a unique
  root catalog of resolved artifact ID/line coordinates, and semantic items
  reference those same coordinates. Trusted code resolves them to derived
  citation IDs before publication; provider aliases remain outside the
  durable constructor.
- **Execution attempt ordinals:** attempt summaries are one-based and
  contiguous for operator readability.
- **Dated model profiles:** the durable profile structurally requires a dated
  snapshot suffix and semantically requires that suffix to round-trip as a
  real proleptic Gregorian date. Moving aliases and impossible dates cannot
  become reusable execution identity.
- **Safe provider identifiers:** nullable request/response identifiers accept
  only the reviewed alphanumeric/period/underscore/hyphen grammar. Invalid
  provider text is rejected without trimming, sanitization, hashing, or
  diagnostic disclosure.
- **Terminal closure:** success requires the final attempt to be a 2xx
  response. Only transport-terminal failure codes are mapped to exact final
  transport outcomes before the provider adapter is implemented.
- **Publication chronology:** the cross-root validator permits publication at
  or after execution completion and rejects earlier publication without
  adding a serialized field or changing interview identity.
- **Shared logical lines:** LF, CRLF, and CR use one contracts-owned splitter
  for artifact validation and rendering. Empty and terminal lines are
  preserved; invalid Unicode fails instead of being replaced.
- **Renderer V1 encoding:** reviewed instructions/questions occupy one future
  developer-role string; repository evidence occupies a separate compact
  canonical JSON future user-role string. This freezes exact bytes without a
  generic prompt framework.
- **Prompt identity:** domain-separated canonical JSON binds exact
  role-separated visible strings plus renderer/specification authority. Exact
  artifact-set identity remains separately bound by the durable request.
- **Mapping boundary:** aliases never leave `@gitblocks/interviews`; trusted
  mapping resolves them to artifact coordinates, de-duplicates only the
  top-level coordinate catalog, and preserves every semantic reference without
  deriving durable IDs or timestamps.
- **Milestone 4 module deviation:** the planned separate alias and citation
  modules collapsed into cohesive `repository-interview-prompt.ts` and
  `repository-interview-mapping.ts` modules. A separate public artifact-context
  API or generic prompt framework would expose mutable internals without a
  current consumer. The loaded specification now retains its exact reviewed
  question snapshot so pure render-time authority validation can recheck every
  digest without filesystem access.
- **Prompt-injection scope:** JSON data positioning and instruction/evidence
  role separation prevent repository text from becoming application-authored
  instructions, but behavioral prompt-injection resistance remains an
  empirical Milestone 7 gate.
- **Ephemeral exact context:** the use case renders once for a non-reused
  provider operation, freezes the result, and passes the same object reference
  to provider and resolver. Prompt text and alias bindings never enter the
  record port or durable records.
- **Effect ownership:** the application owns request/profile/reuse/output and
  durable identity decisions. Provider, record/reuse, clock, and nonce behavior
  is injected; the package reads no environment, filesystem, network,
  database, process clock, or randomness directly.
- **Reuse poison policy:** a returned reuse bundle is untrusted. Any root,
  request, profile, reuse-key, output-digest, ownership, or exchange mismatch
  fails closed without provider fallback.
- **Artifact-array ownership:** renderer inputs are copied only after bounded
  reflection proves a plain, contiguous, zero-to-four-element data array.
  Accessors are never invoked; exotic reflection and shape fail with no
  artifact value disclosure. The application independently catches any
  unexpected renderer exception before effects.
- **Provider-effect preflight:** response effects must already close as a
  successful execution with a final HTTP 2xx attempt before semantic output is
  inspected. A zero-usage constructor preflight separates usage-only failure
  from invalid attempt/terminal metadata. Controlled failed effects are
  accepted only when their supplied metadata directly creates the declared
  execution.
- **First-class persisted request:** `RepositoryInterviewRequestV1` is stored
  once as the deterministic reusable authority and referenced by every
  execution; it is not duplicated as an execution subdocument or assigned an
  operational timestamp.
- **Hybrid immutable history:** bounded normalized columns own lookup,
  ownership, chronology, state, and relational closure while canonical JSONB
  preserves the exact parsed contracts. Attempts, usage, and semantic text are
  not independently normalized because no authorized query requires them.
- **Deferred closure:** constraint triggers validate exact root/member arrays,
  ordinals, citation references and artifact line bounds, request/execution/
  interview provenance, and successful-versus-failed interview ownership at
  transaction closure.
- **Reuse is a lookup, not uniqueness:** multiple normal and forced executions
  retain one reuse key. Automatic reuse chooses the earliest completed valid
  normal success and excludes forced history; corrupt eligible history fails
  closed.
- **Trigger privilege boundary:** fixed internal `SECURITY DEFINER` trigger
  wrappers perform deferred closure for runtime inserts. Public and runtime
  receive no function execution grant, and the helpers accept no dynamic SQL
  or caller-controlled object names.
- **Coequal read authority:** canonical contract JSON and every normalized
  ownership, provenance, chronology, status, and query column are independently
  checked after read. One typed complete exchange loader serves publication
  reload, both historical lookup forms, and reuse so no weaker reconstruction
  path can accept or skip normalized corruption.
- **Root script compatibility:** Milestone 7 explicitly requires three
  `eval:interviews:*` commands and authoritative verification wiring, which
  necessarily changes only the root `package.json` scripts despite the broader
  compatibility shorthand that package manifests remain unchanged. No
  workspace package manifest, dependency field, external version, workspace
  importer, or lockfile changes.

## Remaining maintainer decisions before Milestone 8

Milestones 1–6 are accepted. Milestone 7 is implemented but Milestone 8 must
not advance until renewed maintainer review accepts:

1. the exact amended 30-candidate membership, controlled labels, calibration
   order, and cohort-level lifecycle treatment;
2. the separate schema/manifest/policy authority and recorded digests;
3. content-minimized audit provenance, reviewer workflow, sampling, and
   adjudication rules;
4. exact operational/semantic denominator separation and boundary math;
5. all 12 synthetic adversarial fixtures without a claim of behavioral proof;
6. read-only CLI, architecture direction, compatibility, full verification,
   and hosted CI evidence recorded here and on draft PR #18.

Only renewed authorization may begin the bounded direct OpenAI Responses
adapter in Milestone 8. Model selection, calibration execution, Gate A, real
human audit, production review/selection policy, and ranking integration
remain separately blocked.
