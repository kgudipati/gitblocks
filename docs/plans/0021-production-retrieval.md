# Phase 9 production candidate retrieval

## Status and authority

- Governing issue:
  [#21 — Phase 9: Establish production candidate retrieval](https://github.com/kgudipati/gitblocks/issues/21)
- Branch: `feat/21-production-retrieval`
- Owner: repository maintainer
- State: Milestone 1 governance and local validation are complete and proposed
  for independent review; Milestones 2–4 are blocked pending independent
  maintainer acceptance of Milestone 1.
- Last updated: 2026-08-07

Issue #21 is the requirements authority. Proposed
[ADR 0009](../architecture/decisions/0009-production-retrieval.md) owns the
durable production retrieval architecture after maintainer acceptance. This
plan owns execution order, review gates, stop conditions, file placement, and
validation evidence. Accepted ADRs, the product contract, repository
engineering standards, and the governing issue win over this plan if they
conflict.

This plan implements Project Phase 9, corresponding to Phase 11 — Retrieval
Engine in the original end-to-end strategy. It does not authorize Milestone 2
until an independent maintainer accepts the proposed architecture and every
pre-registered threshold in ADR 0009. No later milestone begins without
independent review of the preceding milestone.

## Purpose and user-visible outcome

The Phase 9 outcome is:

> Given one successfully normalized capability query and the current
> deterministic candidate-profile authority, GitBlocks can retrieve a
> bounded, diverse set of plausible OSS candidates with high recall while
> preserving hard constraints, explicit unresolved evidence, negative
> controls, and deterministic provenance.

Retrieval answers which candidates are plausible enough to deserve deeper
comparison. Phase 10 ranking will answer which retrieved candidate best fits a
particular target codebase. Phase 9 does not recommend a winner, assess
codebase-conditioned adoption fit, or plan integration.

Milestone 1 delivers only reviewed governance and architecture: one governing
issue, this plan, proposed ADR 0009, package and contract decisions, exact
retrieval semantics, and thresholds selected before production retrieval
exists. The later observable product outcome requires Milestones 2–4 and their
independent review gates.

## Verified current repository state

### Starting authority

The following checks were completed before mutation on 2026-08-07:

| Check                     | Evidence                                                                         |
| ------------------------- | -------------------------------------------------------------------------------- |
| worktree                  | `git status --short --branch` returned only `## main...origin/main`              |
| branch                    | local branch was `main`                                                          |
| local HEAD                | `f44ddcee4491e9f1f4680384b07e4e7a92f2bc18`                                       |
| local `main`              | `f44ddcee4491e9f1f4680384b07e4e7a92f2bc18`                                       |
| fetched `origin/main`     | `f44ddcee4491e9f1f4680384b07e4e7a92f2bc18` after `git fetch --prune origin main` |
| Node                      | `v24.18.0`                                                                       |
| pnpm                      | `11.17.0`                                                                        |
| runtime preflight         | `pnpm runtime:check` passed                                                      |
| Phase 8 PR                | PR #20 is merged; merge commit is the authorized SHA                             |
| Phase 8 issue             | Issue #19 is closed with state reason `completed`                                |
| competing retrieval issue | GitHub search found no other open issue owning production retrieval              |

Issue #21 was then created with title
`Phase 9: Establish production candidate retrieval`, and this branch was
created directly from the authorized `main` without unrelated history.

### Protected Phase 8 closure

Accepted ADR 0008 and Phase 8 closure evidence establish:

- the controlled capability taxonomy;
- deterministic capability-query normalization and clarification;
- deterministic candidate-profile representation and extraction rules;
- explicit unknown and conflict semantics;
- offline profile authority and coverage;
- the independent `retrieval-v1` corpus;
- deterministic retrieval metrics; and
- deterministic offline baselines.

Phase 8 did not establish production retrieval, production ranking, live final
profile coverage, ranking readiness, or the later ranker-field coverage gate.
Milestone 7B, materialization execute number five, Docker profile
materialization, and live 150-profile population remain deferred. This plan
does not reopen, repair, execute, or modify those paths or accepted Phase 8
artifacts merely to improve Phase 9 measurements.

### Reusable product/domain authority

The following code is production-owned and reusable:

- `CapabilityQueryNormalizationResultV1`, its safe parser, and complete
  exchange validation in `@gitblocks/contracts`;
- the pure query normalizer and controlled taxonomy authority in
  `@gitblocks/domain` and `@gitblocks/contracts`;
- `DeterministicCandidateProfileV1` and
  `DeterministicCandidateProfileAuthorityV1`, their parsers, schema exports,
  semantic digests, and the 27-field registry;
- `evaluateCandidateConstraints` in `@gitblocks/domain`, including the
  satisfied/conflict/unresolved aggregate hard state and exact mappings for
  primary family, architecture/adoption unit, feature/capability variants,
  and required infrastructure; and
- the parsed catalog role/status, candidate identity, repository identity, and
  package identity facts already represented in the deterministic authority.

The domain evaluator rejects non-normalized input and mismatched taxonomy
authority. Required and prohibited evaluations determine the aggregate hard
state; preferred evaluations cannot change it. Preserved declarations without
an exact mapping remain unresolved. Production retrieval will invoke this
authority rather than reproduce it.

### Evaluation-only authority

The following remains tooling-only and cannot be imported by a product
package:

- `tools/evaluation-harness/src/retrieval/hard-filter.ts`, which projects the
  product evaluator across the corpus and assigns evaluation lanes;
- every `retrieval-v1` case, audit classification, relevance judgment,
  no-result record, equivalence record, prediction schema, report schema, and
  fixture;
- family-only, exact-keyword, alias-expanded, weak, safety, and synthetic
  baseline implementations and outputs; and
- the independent scorer, metric implementations, loaders, reports, and gold.

The future harness may depend on `@gitblocks/retrieval`; the reverse dependency
is prohibited. The existing scorer remains the measurement authority.

### Current data authority and read shape

The committed deterministic authority is
`catalog/public-v1/candidate-profile-authority.json`:

- 150 profiles;
- 2,051,396 bytes as committed formatted JSON;
- authority digest
  `fc85d7ea71c69cd5e56e5a73936ceba6263c4ea0ba8fc2d0802556d79cf9e879`;
- catalog digest
  `4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634`;
- taxonomy digest
  `838fa85b2e6937866854b6f733fe7045cf49d5f811cb5e4a8d503bfbd76a61c9`;
- 600 known, 210 not-applicable, 3,240 unknown, and zero conflict cells; and
- 99 active, three archived, four moved, and 44 negative-control candidates in
  the bound catalog.

All 150 profiles have known catalog role/status, capability family, repository
identity, and package identity mapping. Eighty candidates have an npm mapping
and 70 are explicitly repository-only. The broad-retrieval coverage report is
2/9 and hard-filter readiness is 2/16; these figures are not a readiness claim.

The initial core will receive a prevalidated authority in memory, build at
most one immutable bounded search view, and scan at most 150 profiles per
query. It performs no I/O. Direct retrieval signals are limited to
catalog-role safety, family, repository/package identity, and known values in
profile fields already designated for broad retrieval. The complete profile
passes unchanged to the product-domain evaluator.

### Evaluation corpus and baselines

The `retrieval-v1` authority is bound by corpus digest
`3638596a5c330c3516003beab908b0b5631c84f41d957f78ce2cc1379cc682de`.
It contains:

- 30 retrieval cases, exactly six per capability family;
- 25 positive cases and five no-eligible-candidate cases;
- 20 normalization/adversarial cases, exactly four per family;
- 636 proposed relevance judgments;
- 30 no-result records;
- 120 generated hard-filter audit samples; and
- zero proposed real-corpus equivalence groups.

All current gold remains `proposed-not-reviewed`. The development baselines
are:

| Baseline       | Macro Recall@10 | Micro Recall@10 | Positive hit | MRR      | NDCG@10  |
| -------------- | --------------- | --------------- | ------------ | -------- | -------- |
| family-only    | 0.532295        | 0.477500        | 0.920000     | 0.790000 | 0.626085 |
| exact-keyword  | 0.510145        | 0.362500        | 0.800000     | 0.760000 | 0.622330 |
| alias-expanded | 0.612295        | 0.487500        | 1.000000     | 0.960000 | 0.769561 |

Alias-expanded per-family Recall@10 is 0.686274 authorization, 0.544203 audit
logging, 0.478897 background jobs, 0.526923 rate limiting, and 0.825175
webhooks. All three ordinary baselines have 1.000000 hard-filter accuracy,
1.000000 prohibited-constraint preservation, 1.000000 no-eligible-candidate
accuracy, zero top-10 safety violations, and zero duplicates.

With the current generated hard-filter projection and a ten-candidate result,
the theoretical macro Recall@10 ceiling is 0.656249 and micro ceiling is
0.522500. It is calculated per positive case as
`min(10, eligible-relevant-count) / eligible-relevant-count`, then aggregated
with the existing scorer's macro and micro definitions. The family ceilings
are 0.719608 authorization, 0.627536 audit logging, 0.486897 background jobs,
0.603846 rate limiting, and 0.843357 webhooks. These read-only development
ceilings explain the pre-registered quality thresholds; they are not algorithm
results or accepted relevance claims.

## Scope and explicit non-goals

### Phase 9 scope

Phase 9 may eventually change:

- proposed ADR 0009 and this execution plan;
- one narrow future `packages/retrieval` product package;
- additive V1 retrieval request/result schemas, types, parsers, deterministic
  JSON Schema exports, and contract validation;
- deterministic family, concept, identity, package, structured-profile, and
  approved bounded lexical retrieval channels;
- product-owned controlled expansion authority;
- deterministic fusion, provenance, deduplication, and diversity;
- a harness-side adapter that runs the production package against blind
  `retrieval-v1` cases;
- deterministic safety, performance, memory, and order-independence tests;
- a content-free evaluation-authority review record after independent review;
  and
- minimal architecture, product-status, and repository navigation updates.

Milestone 1 changes documentation and GitHub workflow state only. It creates
no TypeScript package, product contract, generated schema, migration, index,
fixture, gold record, scorer, or runtime operation.

### Non-goals

Neither Milestone 1 nor Phase 9 includes:

- production ranking, recommendation, target-codebase-conditioned fit, winner
  selection, or integration planning;
- a repository scanner or changes to `RepositoryFingerprintV1`;
- an HTTP or internal application service, MCP server, Agent Skill, plugin,
  authentication, billing, tenant/application service, or deployment;
- a continuous GitHub crawler or broad GitHub index;
- Phase 8 live materialization, execute number five, Docker profile
  materialization, or live 150-profile population;
- a model call, provider collection, repository interview, LLM expansion, LLM
  reranking, or required embedding generation;
- mandatory vector retrieval, pgvector, persistent search infrastructure,
  caching, or a dedicated search service;
- migration `0005`, a retrieval table, or speculative PostgreSQL index; or
- changing evaluation gold, fixtures, relevance judgments, equivalence data,
  or baseline output to pass a production gate.

## Requirements crosswalk

| Governing requirement                                        | Destination                           | Milestone and evidence                         |
| ------------------------------------------------------------ | ------------------------------------- | ---------------------------------------------- |
| one governing issue and exact four-milestone structure       | Issue #21 and this plan               | M1 issue inspection and links                  |
| retrieval/ranking boundary and conceptual flow               | ADR 0009, Phase boundary              | M1 independent architecture review             |
| product package ownership and dependencies                   | ADR 0009, Product package ownership   | M1 review; M2 workspace/package checks         |
| additive transport-neutral contracts                         | ADR 0009, Additive product contracts  | M1 review; M2 schema/parser/export tests       |
| reuse domain hard constraints                                | ADR 0009, Hard constraints and lanes  | M2 differential and abuse tests                |
| explicit conflict, unresolved, and negative-control behavior | ADR 0009, Hard constraints and lanes  | M2 zero-tolerance safety suite                 |
| deterministic retrieval channels                             | ADR 0009, V1 channels                 | M2 vertical slice; M3 benchmark ablations      |
| controlled expansion without constraint weakening            | ADR 0009, Controlled expansion        | M3 generated-authority and metamorphic tests   |
| deterministic diversity without fabricated equivalence       | ADR 0009, Deduplication and diversity | M3 identity/equivalence properties             |
| evaluation harness executes product, product stays blind     | ADR 0009, Evaluation integration      | M2 dependency checks and blind adapter tests   |
| pre-registered benchmark gates                               | ADR 0009 and this plan                | M1 independent threshold acceptance; M4 report |
| pre-registered performance and determinism budgets           | ADR 0009 and this plan                | M3 correction evidence; M4 fixed benchmark     |
| vectors and search infrastructure conditional                | ADR 0009, Conditional triggers        | M3/M4 trigger audit; separate ADR if activated |
| evaluation authority independently accepted                  | ADR 0009 and this plan                | content-free review record before M4 benchmark |
| Phase 8 boundary remains protected                           | this plan and status navigation       | diff review and no-effect validation           |
| documentation-only Milestone 1                               | changed-file audit                    | M1 validation and commit review                |

## Assumptions, risks, and unresolved decisions

### Verified facts

- The current profile authority fits in memory and contains 150 candidates.
- Current known fields support exact family and identity generation; most other
  structured fields remain unknown.
- The domain already owns tri-state single-candidate hard evaluation.
- The evaluation harness already owns independent lane projection and scoring.
- The strongest ordinary baseline is close to the fixed top-10 ceiling but
  remains below the proposed macro and two family gates.
- No accepted evidence currently requires vector or persistent search.

### Working assumptions

- A prevalidated in-memory view can meet the pre-registered 20 ms p95 at 150
  candidates.
- Exact family, concept, identity, structured matching, controlled expansion,
  and deterministic fusion can close the observed development recall gap.
- Separate eligible and evidence-needed product arrays can map losslessly into
  the existing evaluation prediction lane without changing the scorer.

Each assumption is tested in Milestones 2–4. Failure activates correction or a
pre-registered reconsideration path; it does not silently broaden scope.

### Risks and controls

| Risk                                                        | Control and latest resolution point                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| evaluation leakage makes the benchmark circular             | product dependency ban, blind harness adapter, and dependency tests in M2  |
| unknown hard evidence becomes eligible                      | domain-authoritative lane invariant and zero-tolerance tests in M2         |
| recall threshold is selected after observing implementation | exact M1 gate table and independent acceptance before M2                   |
| current gold is treated as accepted truth                   | separate independent review record required before M4 benchmark            |
| expansion weakens constraints                               | source-identity/modality preservation and metamorphic tests in M3          |
| duplicates consume the top ten                              | exact identity grouping and diversity tests in M3                          |
| inferred fork/equivalence groups fabricate facts            | grouping disabled without reviewed product authority                       |
| retrieval score becomes hidden ranking                      | contract vocabulary, no target input, and code review in every milestone   |
| speculative infrastructure expands Phase 9                  | numeric triggers and separate ADR requirement                              |
| current sparse profiles conceal missing authority           | known-only signals, explicit unknowns, and no Phase 8 artifact rewriting   |
| untrusted repository metadata acts as instructions          | inert bounded text normalization; no code execution, links, or model calls |

### Decisions awaiting review

No implementation-shape decision may remain open after Milestone 1 review.
The maintainer must explicitly accept or amend:

- the one-package ownership and dependency direction;
- the two product contract roots and two-lane bounds;
- channel placement between Milestones 2 and 3;
- expansion and diversity authority;
- every safety, retrieval-quality, performance, and infrastructure trigger;
  and
- the independent evaluation-authority review protocol.

ADR 0009 remains proposed until that review. Milestone 2 cannot begin while
any item is unresolved.

## Applicable ADRs and contracts

- [Product contract](../product/product-contract.md): keeps relevance separate
  from target-conditioned adoption fit and permits no manufactured certainty.
- [ADR 0001](../architecture/decisions/0001-agent-native-delivery.md): later
  transport remains agent-native; Phase 9 adds no Skill or MCP surface.
- [ADR 0002](../architecture/decisions/0002-typescript-workspace-and-toolchain.md):
  pnpm, Node 24.18.0, strict TypeScript, supply-chain controls, and repository
  verification remain authoritative.
- [ADR 0003](../architecture/decisions/0003-product-contract-kernel.md): TypeBox
  remains the product schema source; static types, safe parsing, deterministic
  JSON Schema, and product/evaluation separation are mandatory.
- [ADR 0004](../architecture/decisions/0004-postgresql-evidence-persistence.md):
  persistence is a concrete adapter, not a retrieval port; no speculative
  table, index, or migration is authorized.
- [ADR 0005](../architecture/decisions/0005-public-repository-ingestion.md):
  public metadata is bounded, injected, untrusted data and is never executed.
- [ADR 0006](../architecture/decisions/0006-immutable-repository-artifacts.md):
  historical artifact proof cannot be reconstructed as current lexical input.
- [ADR 0007](../architecture/decisions/0007-evidence-grounded-repository-interviews.md):
  interviews remain optional candidate-owned enrichment and are not a
  prerequisite or V1 retrieval input.
- [ADR 0008](../architecture/decisions/0008-artifact-first-retrieval-foundation.md):
  accepted normalization, profile, taxonomy, domain evaluation, and evaluation
  boundaries remain unchanged; Milestone 7B remains deferred.
- [ADR 0009](../architecture/decisions/0009-production-retrieval.md): proposed
  Phase 9 package, contract, lane, channel, acceptance, and infrastructure
  decisions. It creates no authority until accepted.

`CapabilityQueryNormalizationResultV1` and
`DeterministicCandidateProfileAuthorityV1` remain unchanged in Milestone 1.
`RepositoryFingerprintV1`, `CapabilityRequestV1`, fit-assessment contracts,
evaluation schemas, and every persisted schema remain untouched.

## Architecture, data-flow, and performance impact

### Future component graph

```text
tools/evaluation-harness
        ↓
@gitblocks/retrieval (future pure package)
        ↓
@gitblocks/contracts → @gitblocks/domain
```

The future retrieval function accepts parsed authorities and one parsed
request. It validates the normalized outcome and authority bindings, invokes
the domain constraint evaluator once per candidate, excludes hard conflicts
and negative controls, assigns satisfied and unresolved candidates to separate
lanes, executes bounded channels, fuses integer signals, merges exact
identities, diversifies, truncates, and returns a closed result with
provenance. It has no side effects.

### Direct field reads

The initial product layer directly reads:

- `catalog-role-status` for the negative-control safety gate only;
- `capability-family` for candidate generation;
- `repository-identity` and `package-identity-mapping` for exact identity;
- `adoption-unit-type`, `capability-variants-features`,
  `repository-discovery-metadata`, `language-ecosystem`,
  `required-infrastructure`, `optional-infrastructure`,
  `deployment-self-hosting`, and `operational-complexity-primitives` only when
  their values are known and designated for broad retrieval; and
- the profile as an opaque complete argument to the domain evaluator.

Other fields are neither converted to free text nor treated as signals. A later
version may expand the read set only through an accepted contract/ADR change
that names the authority and intended use.

### Bounds and access pattern

- input authority: exactly the currently bound 150 profiles for the acceptance
  benchmark;
- query input: one normalized result, at most 32 normalized constraints and
  the existing domain limits;
- candidate evaluation: no more than 150, once each;
- channels: no more than six, once each;
- expansion: one hop, no more than eight terms per source and 32 total;
- result: at most ten eligible plus ten evidence-needed candidates;
- concurrency: a pure call has no internal worker or shared mutable state;
- time: p95 at most 20 ms and maximum at most 50 ms after view construction;
- memory: search view at most 16 MiB; repeated-query retained growth at most
  2 MiB;
- retry/backpressure/cancellation: not applicable to a synchronous in-process
  pure core; a future host owns those concerns; and
- cost: no provider, network, database, model, or per-query external cost.

### Infrastructure revisit triggers

Persistent/search indexing is reconsidered only above 2,000 candidates or
after three corrected clean benchmark runs breach p95 20 ms, maximum 50 ms, or
16 MiB. Caching additionally requires at least 30% exact query-digest reuse in
representative production telemetry and a missed latency SLO. A dedicated
service requires an approved load model/SLO and failure of both in-process and
reviewed PostgreSQL alternatives in three representative runs.

Vector search requires all five ADR 0009 conditions: an accepted deterministic
gate miss, at least ten semantic misses across three families representing at
least 20% of misses, exhausted deterministic corrections, a blind spike with
at least 0.030000 absolute macro Recall@10 improvement or closure of every
failed family, unchanged safety/performance, and a superseding ADR. Pgvector
also requires the persistence/index trigger and migration review.

## Pre-registered acceptance gates

These values are fixed before production retrieval implementation and require
independent maintainer acceptance before Milestone 2.

### Safety

| Metric                                         | Phase 9 gate           |
| ---------------------------------------------- | ---------------------- |
| candidate hard-filter correctness              | 4,500/4,500 = 1.000000 |
| retrieval-case hard-filter correctness         | 30/30 = 1.000000       |
| top-10 hard conflicts                          | 0                      |
| top-10 lane errors                             | 0                      |
| top-10 negative controls                       | 0                      |
| negative controls in production lanes          | 0                      |
| prohibited preservation, micro                 | 15/15 = 1.000000       |
| prohibited preservation, macro                 | 10/10 = 1.000000       |
| no-eligible correctness, all cases             | 30/30 = 1.000000       |
| explicit no-eligible cases                     | 5/5 = 1.000000         |
| exact duplicate rate                           | 0.000000               |
| accepted controlled-equivalence duplicate rate | 0.000000               |

Hard conflicts, negative controls, or unresolved candidates in `eligible` are
correctness failures regardless of recall.

### Retrieval quality

| Metric                    | Phase 9 gate      |
| ------------------------- | ----------------- |
| macro Recall@10           | at least 0.625000 |
| positive-case hit rate    | 25/25 = 1.000000  |
| authorization Recall@10   | at least 0.647647 |
| audit-logging Recall@10   | at least 0.564783 |
| background-jobs Recall@10 | at least 0.438207 |
| rate-limiting Recall@10   | at least 0.543462 |
| webhooks Recall@10        | at least 0.759021 |
| category/family coverage  | 5/5 = 1.000000    |

Secondary ordering diagnostics are MRR at least 0.900000 and NDCG@10 at least
0.750000. They do not convert retrieval into ranking.

### Performance and determinism

After 100 warm-ups and over 1,000 round-robin queries on Node 24.18.0 with
prevalidated authorities and no I/O:

- p95 query latency at most 20 ms and maximum at most 50 ms;
- one-time immutable search-view build p95 at most 100 ms;
- search-view incremental heap at most 16 MiB;
- retained heap growth after 1,000 queries at most 2 MiB with explicit GC;
- at most 150 candidates evaluated once each;
- at most six channels executed once each;
- at most ten results per lane and 20 total;
- 100/100 byte-identical repeat serializations for every case;
- identical output for 20 fixed authority-order permutations; and
- identical output digests across ten fresh processes.

Raw samples, runtime/OS/CPU identity, authority digests, warm-up count, and
measurement method are retained as content-free verification evidence.

## Security, privacy, abuse, and supply-chain considerations

Candidate repositories, documentation, package metadata, topics, and text are
untrusted inert data. Retrieval never clones, installs, imports, renders, or
executes candidate code; follows repository-authored instructions; invokes a
model; or resolves unapproved links. Bounded lexical processing accepts only a
reviewed injected authority and uses explicit length/count/character limits.

The query contract already excludes secrets, environment values, command
output, transcripts, and raw source. The retrieval package does not receive
target repository content. It must not log raw query prose or metadata text.
Authority digests, stable candidate IDs, channel IDs, stable reason/error codes,
counts, duration, and lane counts are sufficient for future correlated
telemetry.

Abuse and negative tests cover oversized requests, malformed DTOs, binding
mismatch, non-normalized outcomes, duplicate authority identities, output
amplification, adversarial Unicode/order inputs, negative-control leakage,
conflict/evidence lane confusion, constraint-weakening expansion, score
overflow, and crafted metadata tokens. Every collection and result is bounded;
no input controls filesystem, network, SQL, module, command, or model behavior.

No dependency is added in Milestone 1. A later dependency requires an exact
version under workspace supply-chain policy, justification, lockfile update
through pnpm, audit, and review. The preferred V1 uses standard Node APIs and
existing workspace packages only.

## Implementation milestones

### Milestone 1 — Retrieval architecture and acceptance authority

Files and operations:

- create Issue #21;
- create this plan and proposed ADR 0009;
- update only minimal README/system-context navigation and status;
- pre-register exact safety, quality, performance, determinism, vector, and
  persistence triggers;
- record product/domain reuse and evaluation-only boundaries; and
- create no production contracts or implementation.

Completion evidence:

- exact documentation/workflow validation suite passes;
- one ordinary commit is pushed to `feat/21-production-retrieval`;
- an early draft PR references Issue #21 and states every protected boundary;
- hosted CI is observed without manual reruns of unrelated cancellations; and
- independent maintainer review accepts or amends ADR 0009 and the thresholds.

The PR remains draft. Milestone 2 stays blocked after this task even if local
and hosted validation pass; maintainer review is a separate authority.

### Milestone 2 — Deterministic production retrieval vertical slice

Only after Milestone 1 acceptance:

- begin with failing contract, lane-safety, and product/harness boundary tests;
- add the two product contract roots, safe parsers, deterministic schemas, and
  complete exchange validation;
- create `packages/retrieval` with only contracts/domain dependencies;
- implement normalized-outcome admission, authority binding, one domain hard
  evaluation per candidate, conflict/negative exclusion, and explicit eligible
  and evidence-needed lanes;
- implement family, controlled concept, repository/candidate identity, package
  identity, and known structured-profile channels;
- add minimal deterministic integer fusion, bounds, provenance, and exact
  identity deduplication;
- add the blind harness-side adapter while retaining the current scorer; and
- record unit, property, negative/abuse, contract, dependency, and initial
  performance evidence.

The adapter emits the product eligible lane when it is nonempty; only when the
eligible lane is empty does it emit the evidence-needed lane and the existing
no-eligible marker. It never sends product output, case identity, or gold back
into the product call.

No expansion authority, advanced fusion/diversity, ranking, model, API, MCP,
database, vector, or persistent index belongs in this milestone.

### Milestone 3 — Recall, fusion, and diversity

Only after Milestone 2 acceptance:

- author and review the separate versioned controlled expansion authority;
- add constraint-preservation and bounded one-hop expansion tests before use;
- implement deterministic channel normalization and fusion with ablations;
- complete exact repository/package grouping, deterministic representative
  selection, backfill, and only authority-backed fork/equivalence handling;
- enable bounded approved metadata lexical retrieval only if the required
  product authority exists;
- run blind benchmark and fixed performance error analysis;
- correct only failures traceable to accepted recall, diversity, or performance
  gates; and
- evaluate every infrastructure trigger without presuming activation.

Vectors, persistent indexes, pgvector, caching, and a search service remain out
of scope unless all corresponding pre-registered evidence exists and a new ADR
is independently accepted.

### Milestone 4 — Production proof and Phase closure

Only after Milestone 3 acceptance:

- obtain the independent content-free evaluation-authority acceptance record;
- freeze the production algorithm/channel/expansion/diversity bindings;
- run the production package through the existing blind harness and scorer;
- run every zero-tolerance safety gate, retrieval-quality gate, family floor,
  diagnostic guardrail, determinism property, architecture check, and fixed
  performance/memory budget;
- resolve only failures of those registered gates without weakening gold or
  thresholds after seeing results;
- complete ADR/plan evidence and honest product/status navigation; and
- receive independent maintainer acceptance of Phase closure.

Phase 9 completion does not make the PR ready, merge it, or authorize Phase 10
without the applicable repository workflow and user instruction.

## Testing and validation strategy

### Milestone 1 exact validation

From the repository root with Node 24.18.0 and pnpm 11.17.0, run exactly:

```bash
pnpm runtime:check
pnpm format:check
pnpm repo:check
pnpm security:secrets
pnpm security:audit
pnpm verify
git diff --check
git status --short --branch
```

Expected results are zero exits; the final status contains only the intended
documentation changes before commit and a clean tracking branch after push.
No model operation, provider collection, database migration, Docker profile
materialization, or live materialization command is permitted.

### Later product and contract validation

Milestones 2–4 add tests alongside behavior:

- unit tests for every channel, integer fusion rule, provenance record, bound,
  comparator, deduplication rule, and lane transition;
- TypeBox/static/parser/export/round-trip contract tests and generated-schema
  drift checks;
- differential tests proving every product lane agrees with the product-domain
  evaluator and never a copied rule table;
- property tests for input-order independence, repeatability, immutability,
  duplicate identity, score bounds, and constraint-preserving expansion;
- negative/abuse tests for malformed, oversized, conflict, unresolved,
  negative-control, adversarial text, binding-drift, and non-normalized input;
- harness integration tests proving gold is loaded only after production
  predictions freeze and product imports no evaluation path;
- hand-calculated scorer fixtures retained unchanged;
- blind aggregate and per-family retrieval evaluation using the existing
  scorer; and
- fixed Node 24.18.0 latency, allocation, bounded-work, order, and fresh-process
  benchmarks.

At minimum, later changes run the repository-required commands applicable to
their scope:

```bash
pnpm runtime:check
pnpm format:check
pnpm repo:check
pnpm contracts:validate
pnpm eval:validate
pnpm eval:fixtures
pnpm eval:retrieval:validate
pnpm eval:retrieval:fixtures
pnpm eval:retrieval:verify
pnpm security:secrets
pnpm security:audit
pnpm verify
git diff --check
git status --short --branch
```

Milestone 2 will add one fixed read-only command that generates production
predictions through `@gitblocks/retrieval` and scores them with the existing
scorer; its final name and exact invocation must be recorded in this plan in
the same reviewed contract change. It must not create a second scorer.

`pnpm db:verify` is not part of the planned path because Phase 9 creates no
persistence change. If an independently accepted trigger authorizes a
persistence or migration change, the issue, plan, ADR, pinned PostgreSQL path,
non-owner runtime integration tests, and `pnpm db:verify` become mandatory
before that work. No database test may skip.

## Observability and operations

Milestone 1 has no production path and therefore emits no runtime telemetry.
The future pure package returns bounded diagnostics/provenance and does not log
or trace. Stable planned operation/error concepts include retrieval request
validation, authority-view construction, candidate constraint evaluation,
channel execution, identity merge, diversity suppression, result truncation,
and result serialization; failures use stable redacted codes.

A later application host—not Phase 9—will own correlated traces, metrics, logs,
SLOs, alerts, retries, cancellation, authentication, and tenant controls. Its
telemetry may include operation ID, normalized-query digest, authority and
algorithm digests, channel IDs, candidates examined, per-lane counts,
exclusion counts, deduplication counts, duration, and controlled error code. It
must not include secrets, raw query prose, raw repository metadata, target
source, environment values, or unbounded candidate content.

There is no dashboard, alert, worker, queue, health endpoint, runbook, rollout,
or on-call path in Phase 9 because no shared service or deployment is created.
The verification report and deterministic diagnostics provide offline incident
evidence for the pure core.

## Migration, compatibility, rollout, and recovery

Milestone 1 is documentation-only and requires no migration, backfill, feature
flag, compatibility shim, deployment, or rollback. Its GitHub issue, branch,
commit, and draft PR are ordinary recoverable review artifacts.

Milestone 2's product contracts are additive V1 roots; existing roots and
evaluation schemas remain byte-for-byte compatible. The new package is not
wired to a transport or running application, so rollout is limited to
workspace consumers and the evaluation harness. A failure is recovered by a
forward correction on the unmerged branch; published/shared history is never
rebased or force-pushed.

There is no persisted retrieval state, migration `0005`, search index, cache,
or external side effect to roll back. Any future trigger-activated
infrastructure needs its own compatibility, rollout, recovery, and migration
decision before implementation. The deterministic algorithm, expansion, and
authority versions/digests make mixed-version results detectable rather than
silently compatible.

## Exact exit criteria

### Milestone 1 exit

- Issue #21 exists with the exact outcome and four milestones.
- The branch derives from the exact authorized `main` SHA.
- This plan and proposed ADR 0009 are internally consistent and linked.
- Package ownership, contract roots, lane semantics, channels, expansion,
  diversity, evaluation direction, numeric gates, performance budgets, and
  infrastructure triggers are explicit.
- README/system-context changes are minimal and truthful.
- No TypeScript, product contract, generated schema, gold, fixture, baseline,
  database, vector, ranking, API, MCP, Skill, or materialization change exists.
- The exact local validation suite passes and is recorded.
- One ordinary commit with message
  `docs(retrieval): establish production retrieval plan` is pushed normally.
- An early draft PR titled `feat: establish production candidate retrieval`
  references Issue #21, states every protected boundary, remains draft, and is
  not merged.
- Naturally triggered hosted CI is observed and its result recorded.
- Independent maintainer review remains the explicit gate before Milestone 2.

### Phase 9 exit

Phase 9 is complete only when:

> GitBlocks has one transport-neutral production retrieval implementation that
> converts a normalized capability request into a bounded, diverse,
> deterministic high-recall candidate set; preserves every hard constraint and
> negative control; explicitly represents unresolved evidence; exposes
> retrieval provenance; passes the independently accepted retrieval benchmark;
> and satisfies measured performance budgets at the current corpus size.

Additionally:

- all four milestones have independent acceptance in sequence;
- ADR 0009 is accepted and accurately reflects implementation;
- the evaluation-authority review record binds the exact final corpus and gold;
- every zero-tolerance and numeric gate passes without post-hoc corpus or
  threshold weakening;
- product dependencies contain no evaluation, ranking, transport, model, or
  infrastructure boundary violation;
- validation, compatibility, security, and performance evidence is complete;
  and
- unresolved material review findings are closed.

Vectors, persistent search, target-codebase ranking, and external APIs are not
required unless an explicit pre-registered measured failure activates them and
a separate reviewed decision authorizes the change.

## Progress log

- 2026-08-07: Reverified clean `main`, exact local/fetched SHA, runtime pins,
  PR #20 merge, Issue #19 completed closure, and absence of a competing open
  production retrieval issue. No contradiction was found.
- 2026-08-07: Inspected the governing rules, Phase 8 plan/ADR closure, product
  and system context, normalized query/profile/taxonomy/catalog authorities,
  domain evaluator, evaluation hard-filter projection, `retrieval-v1` corpus,
  baselines, benchmark report, and current product contracts.
- 2026-08-07: Created governing Issue #21 and branch
  `feat/21-production-retrieval` from the authorized SHA.
- 2026-08-07: Completed the Milestone 1 issue, proposed ADR, plan, threshold,
  and minimal navigation change. No production implementation or external
  runtime effect was authorized.
- 2026-08-07: The first `pnpm format:check` found only the two new Markdown
  files unformatted. Applied Prettier to those exact files; the subsequent
  check passed.
- 2026-08-07: The complete required local validation suite passed. Milestone 1
  is ready for publication as a draft and independent review; Milestone 2
  remains blocked.

## Decision and deviation log

- 2026-08-07 — Choose one pure `@gitblocks/retrieval` package over domain,
  persistence, ingestion, evaluation-tool, or application ownership. Reason:
  candidate-list generation/fusion/diversity is coherent product behavior and
  must consume, not duplicate, product invariants. Owner: maintainer review.
- 2026-08-07 — Choose two product contract roots with nested lane/provenance
  records. Reason: request and result are independent transport boundaries,
  while exporting every nested record as a root would create redundant public
  contracts. Owner: maintainer review.
- 2026-08-07 — Keep catalog negative controls outside both production lanes
  and expose no production override. Reason: safety controls are evaluation
  inputs, not plausible product candidates. Owner: maintainer review.
- 2026-08-07 — Set macro Recall@10 to 0.625000 rather than 0.70. Reason: the
  fixed ten-result corpus ceiling is 0.656249; 0.625000 is approximately 95.2%
  of that ceiling and exceeds the 0.612295 strongest development baseline.
  Owner: independent threshold review.
- 2026-08-07 — Use 90% of each family ceiling as the family floor. Reason:
  it prevents aggregate gains from hiding a weak family while respecting fixed
  result cardinality. Owner: independent threshold review.
- 2026-08-07 — Defer approved-metadata lexical retrieval until its exact input
  authority exists. Reason: Phase 6 completion evidence does not make
  historical artifact bodies part of the current profile authority. Owner:
  maintainer review.
- 2026-08-07 — Limit the initial package channel to exact package identity.
  Reason: the accepted profile authority has no known package keyword or
  description authority, and publication/version is not designated for broad
  retrieval. Owner: maintainer review.
- 2026-08-07 — Keep equivalence product-owned and disabled without reviewed
  facts. Reason: evaluation equivalence is gold and cannot become a product
  dependency; names/text cannot establish semantic equivalence. Owner:
  maintainer review.
- 2026-08-07 — Select in-memory deterministic retrieval and numeric revisit
  triggers. Reason: 150 profiles and a 2.05 MB formatted authority do not
  establish a current need for persistence, vectors, caching, or a service.
  Owner: independent architecture review.
- 2026-08-07 — No deviation from the governing issue or protected Phase 8
  boundary has been identified.

## Validation evidence

All required commands ran from the repository root on 2026-08-07 with Node
24.18.0 and pnpm 11.17.0.

### Resolved validation failure

The initial `pnpm format:check` exited 1 and named only:

- `docs/architecture/decisions/0009-production-retrieval.md`; and
- `docs/plans/0021-production-retrieval.md`.

`pnpm exec prettier --write` was applied to those exact files. No repository
source or unrelated document was formatted. The complete required sequence was
then run successfully and is rerun after this evidence record so the recorded
document itself is covered.

### Required command results

| Command                       | Result                                                                                                                                                                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm runtime:check`          | exit 0; pinned runtime preflight passed                                                                                                                                                                                                                                     |
| `pnpm format:check`           | exit 0; all matched files use Prettier style                                                                                                                                                                                                                                |
| `pnpm repo:check`             | exit 0; runtime and repository checks passed                                                                                                                                                                                                                                |
| `pnpm security:secrets`       | exit 0; Secretlint reported no finding                                                                                                                                                                                                                                      |
| `pnpm security:audit`         | exit 0; no known vulnerabilities found at `moderate` threshold                                                                                                                                                                                                              |
| `pnpm verify`                 | exit 0; 115 test files and 1,802 tests passed; 847 modules/2,810 dependencies had no architecture violation; repository, evaluation, retrieval, contract-conformance, taxonomy, 150-profile, 150-candidate catalog, interview, operator, pre-live, and secret checks passed |
| `git diff --check`            | exit 0; no whitespace error or diagnostic                                                                                                                                                                                                                                   |
| `git status --short --branch` | exact branch plus four intended documentation paths only                                                                                                                                                                                                                    |

The retrieval baseline verification reproduced report digest
`6a16353159fb2e30e424ee20fb2e4eeda640ae2248a50580fd162ab012ddf1ed`
with `reverseAuthorityOrderMatched: true`. Candidate-profile validation
reproduced 150 profiles, known=600, unknown=3,240, not-applicable=210,
conflict=0, and authority digest
`fc85d7ea71c69cd5e56e5a73936ceba6263c4ea0ba8fc2d0802556d79cf9e879`.
The pre-live check remained `offline-verified-live-blocked`, selected no model,
and performed no live operation.

### Diff and prohibited-scope review

The exact changed files are:

- `README.md`;
- `docs/architecture/decisions/0009-production-retrieval.md`;
- `docs/architecture/system-context.md`; and
- `docs/plans/0021-production-retrieval.md`.

Complete diff review found only the proposed ADR, governing plan, and minimal
status/navigation text. It found no TypeScript, product contract, generated
schema, evaluation case/gold/fixture/baseline, dependency, lockfile,
persistence, migration, provider, model, database, vector, ranking, API, MCP,
Skill, materialization, or Phase 8 implementation change. No model operation,
provider collection, database migration, Docker profile materialization, or
live materialization was run.

The commit SHA, normal push result, draft PR number/state, and naturally
triggered hosted CI results cannot be self-recorded inside the single commit;
they are retained in the draft PR and Milestone 1 delivery report. The ADR
remains proposed and Milestone 2 remains blocked after publication.
