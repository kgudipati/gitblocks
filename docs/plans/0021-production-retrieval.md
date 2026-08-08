# Phase 9 production candidate retrieval

## Status and authority

- Governing issue:
  [#21 — Phase 9: Establish production candidate retrieval](https://github.com/kgudipati/gitblocks/issues/21)
- Branch: `feat/21-production-retrieval`
- Owner: repository maintainer
- State: Milestone 1 was independently accepted at
  `18dae5adf821f0c998c02d4829416d655b9da1a1` after rereview of the corrected
  evaluation-lane semantics. Milestone 2 was independently accepted at
  `ce533e39588027048a522417782ada98afeb1489` after rereview of the lane-local
  exact-identity correction. Independent review found the Milestone 3
  expansion, fusion, and diversity implementation technically sound, but did
  not accept Milestone 3 completion: its development benchmark still misses
  three retrieval gates, and the accepted Phase 8 GitHub repository boundary
  provides a narrower candidate-owned metadata path. Milestone 4 remains
  blocked.
- Last updated: 2026-08-07

Issue #21 is the requirements authority. Accepted
[ADR 0009](../architecture/decisions/0009-production-retrieval.md) owns the
durable production retrieval architecture. This plan owns execution order,
review gates, stop conditions, file placement, and validation evidence.
Accepted ADRs, the product contract, repository
engineering standards, and the governing issue win over this plan if they
conflict.

This plan implements Project Phase 9, corresponding to Phase 11 — Retrieval
Engine in the original end-to-end strategy. Independent maintainer rereview
accepted the architecture and every pre-registered threshold in ADR 0009 at
`18dae5adf821f0c998c02d4829416d655b9da1a1`, authorizing Milestone 2. No later
milestone begins without independent review of the preceding milestone.
Milestone 2 implementation evidence below is accepted only within its stated
vertical-slice boundary. It does not accept `retrieval-v1` gold, prove final
retrieval quality, complete Phase 9, or authorize ranking, vectors, or search
infrastructure.

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

Milestone 1 delivered only reviewed governance and architecture: one governing
issue, this plan, accepted ADR 0009, package and contract decisions, exact
retrieval semantics, and thresholds selected before production retrieval
existed. Milestone 2 supplies the accepted first measurable production
vertical slice. Milestone 3 adds bounded controlled expansion and deterministic
fusion, but its development result has not crossed every quality gate. The
final observable product outcome still requires resolution of that evidence,
Milestone 3 acceptance, and Milestone 4 proof.

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

The harness depends on `@gitblocks/retrieval`; the reverse dependency
is prohibited. The existing generated hard-filter projection remains the
source of the complete `RetrievalCasePrediction.candidateDecisions` array
because it delegates constraint semantics to product-owned
`evaluateCandidateConstraints`. The bounded product retrieval result does not
return all candidate decisions. The existing scorer remains the measurement
authority.

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
- one narrow `packages/retrieval` product package;
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
| no-eligible state uses the complete pre-retrieval lane count | ADR 0009, Evaluation integration      | M2 differential and adapter tests              |
| complete candidate decisions stay evaluation-side            | ADR 0009, Evaluation integration      | M2 prediction-contract and dependency tests    |
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
- Separate eligible and evidence-needed product arrays plus exact
  `preRetrievalLaneCounts` can map losslessly into the existing evaluation
  prediction lane without changing the scorer; complete candidate decisions
  remain supplied by the existing evaluation-side generated projection.

Each assumption is tested in Milestones 2–4. Failure activates correction or a
pre-registered reconsideration path; it does not silently broaden scope.

Milestone 3 falsified the second working assumption for the current committed
candidate authority. All 205 starting eligible misses already had a family
signal, while taxonomy-concept, package-identity, and structured-profile had no
real-corpus activation and all eight approved structured fields were unknown
for all 150 profiles. Bounded identity expansion recovered one additional
relevant candidate, but no general deterministic rule can distinguish the
remaining same-family ties without an approved candidate-owned signal
authority. This finding does not activate vectors because no miss was
attributed to semantic mismatch.

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

### Accepted Milestone 1 decisions

Independent maintainer rereview accepted all of the following at
`18dae5adf821f0c998c02d4829416d655b9da1a1`:

- the one-package ownership and dependency direction;
- the two product contract roots and two-lane bounds;
- channel placement between Milestones 2 and 3;
- expansion and diversity authority;
- every safety, retrieval-quality, performance, and infrastructure trigger;
  and
- the independent evaluation-authority review protocol.

This acceptance authorizes only the Milestone 2 vertical slice. It does not
accept production retrieval quality, evaluation gold, Milestone 2 behavior, or
Phase 9 completion.

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
- [ADR 0009](../architecture/decisions/0009-production-retrieval.md): accepted
  Phase 9 package, contract, lane, channel, acceptance, and infrastructure
  decisions. It creates no authority until accepted.

`CapabilityQueryNormalizationResultV1` and
`DeterministicCandidateProfileAuthorityV1` remain unchanged in Milestone 1.
`RepositoryFingerprintV1`, `CapabilityRequestV1`, fit-assessment contracts,
evaluation schemas, and every persisted schema remain untouched.

## Architecture, data-flow, and performance impact

### Milestone 2 component graph

```text
tools/evaluation-harness
        ↓
@gitblocks/retrieval (pure package)
        ↓
@gitblocks/contracts → @gitblocks/domain
```

The production retrieval function accepts parsed authorities and one parsed
request. It validates the normalized outcome and authority bindings, invokes
the domain constraint evaluator once per candidate, excludes hard conflicts
and negative controls, assigns satisfied and unresolved candidates to separate
lanes, executes bounded channels, fuses integer signals, merges exact
identities, diversifies, truncates, and returns a closed result with provenance.
Before channel matching, it records `preRetrievalLaneCounts` with exactly
`eligible`, `evidence-needed`, and `excluded` counts across the complete bound
authority. The counts reflect domain hard evaluation plus catalog
negative-control exclusion and therefore precede retrieval success, fusion,
diversity, and result bounds. It has no side effects.

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

The 4,500/4,500 candidate hard-filter gate validates the complete
domain-authoritative generated candidate-decision projection against the
independently reviewed evaluation authority. It does not alone prove that the
production retrieval package or its harness adapter agrees with that
projection; the Milestone 2 differential assertions below provide that separate
integration proof.

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

The PR remains draft. This historical Milestone 1 exit required maintainer
review as a separate authority; that review is now recorded above.

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

The adapter derives the no-eligible state and selects the ordinary
result lane exactly as follows:

```text
const noEligibleCandidate =
  result.preRetrievalLaneCounts.eligible === 0

const ordinaryResults =
  noEligibleCandidate
    ? result.evidenceNeededCandidates
    : result.eligibleCandidates
```

It constructs the complete existing
`RetrievalCasePrediction.candidateDecisions` array from the evaluation-side
generated hard-filter projection, not from the bounded product result. If the
eligible pool is nonzero and production retrieval returns zero eligible
results, it emits `noEligibleCandidate = false` and an empty ordinary result
list so recall and hit-rate record the retrieval failure. It never sends
product output, case identity, or gold back into the product call.

#### Milestone 2 production/evaluation differential assertions

Milestone 2 must add tests that prove all of the following before its own
independent review:

1. Production `preRetrievalLaneCounts` exactly match the existing generated
   hard-filter projection lane counts for the same normalized query and profile
   authority.
2. Every returned `eligible` candidate has generated
   `hardState = satisfied` and `lane = eligible`.
3. Every returned `evidence-needed` candidate has generated
   `hardState = unresolved` and `lane = evidence-needed`.
4. No generated excluded candidate or catalog negative control appears in
   either production result lane.
5. No production result lane claim can disagree with domain authority.
6. Evaluation prediction `noEligibleCandidate` is derived exclusively from
   `preRetrievalLaneCounts.eligible === 0`.
7. When the pre-retrieval eligible pool is nonzero but production retrieval
   returns zero eligible candidates, the adapter emits
   `noEligibleCandidate = false` and an empty ordinary result list so recall and
   hit-rate record a retrieval failure.
8. When the pre-retrieval eligible pool is zero, the adapter emits the bounded
   production evidence-needed results and `noEligibleCandidate = true`.
9. Production code remains blind to case classifications, relevance gold,
   no-result gold, equivalence gold, scorer output, and baseline output.

No expansion authority, advanced fusion/diversity, ranking, model, API, MCP,
database, vector, or persistent index belongs in this milestone.

#### Milestone 2 implementation evidence — independently accepted

The implemented product direction is:

```text
tools/evaluation-harness
        ↓
@gitblocks/retrieval
        ├──→ @gitblocks/contracts ──→ @gitblocks/domain
        └──→ @gitblocks/domain
```

`@gitblocks/retrieval` has exactly the two shown workspace dependencies. It is
a synchronous, injected, in-process package with no filesystem, network,
database, environment, model, provider, persistence, ingestion, interview,
transport, MCP, Skill, ranking, or process-global mutable-state dependency.
The architecture and repository-policy suites enforce that boundary.

The two additive root contracts are now registered and digest-pinned: request
schema `60cb601e5603c31a657d776e14b6de3751d40948db5c6893dbe8d7f1b347463c`
and result schema
`dcc53cbaf91384b861217748fe60fee1e0be289a611db90236e3c95503283ba3`.

- `CandidateRetrievalRequestV1` contains its contract/request versions and
  semantic ID; one complete `CapabilityQueryNormalizationResultV1`; closed
  taxonomy, profile-authority, catalog, profile-rule, and
  `candidate-constraint-evaluation/1.0.0` bindings; and explicit eligible and
  evidence-needed limits, each from 1 through 10.
- `CandidateRetrievalResultV1` contains its contract/result versions and
  semantic ID/digest; request and normalization bindings; the same closed
  authority bindings; `deterministic-candidate-retrieval/1.0.0`; the five exact
  channel bindings; the two request limits; complete pre-retrieval lane counts;
  separate arrays of at most ten candidates; and bounded diagnostics. Each
  candidate contains only its ID, lane, integer retrieval score, controlled
  concept/profile-field matches, bounded component provenance, and material
  unresolved hard evaluations where applicable. It contains no full candidate
  decision projection or ranking field.

Admission parses and owns both injected authorities, requires their taxonomy
bindings to agree, validates the complete request and semantic IDs, requires a
normalized outcome and primary family, rejects non-null target repository
fingerprint state, checks taxonomy/profile/catalog/rule bindings, rejects
unknown controlled concepts and unresolved candidate references, requires the
four identity/safety profile fields to be known, and rejects invalid or
duplicate candidate authority. The admitted profile authority remains
canonically ordered under its existing Phase 8 invariant; the retrieval
algorithm sorts its internal view and is result-identical across 20 fixed
post-admission view permutations.

Every admitted candidate is passed exactly once to product-owned
`evaluateCandidateConstraints`. Conflict and catalog negative-control records
increment `excluded` and cannot reach a channel. Unresolved records can enter
only `evidence-needed`, with material required/prohibited unresolved
evaluations disclosed. Satisfied non-negative-control records can enter only
`eligible`. The three counts are complete before channel execution and sum to
150 on the bound authority; returned-array emptiness cannot change them.

The vertical slice implements exactly these five versioned integer channels:

| Channel            | Component rule                                                                  |
| ------------------ | ------------------------------------------------------------------------------- |
| capability-family  | exact primary `200`; each exact applicable additional-family overlap `25`       |
| taxonomy-concept   | exact known controlled concept `400` each, capped at `1,200`                    |
| candidate-identity | exact resolved candidate/repository identity `1,000`                            |
| package-identity   | exact resolved current package identity `900`                                   |
| structured-profile | exact known non-prohibited controlled constraint concept `300`, capped at `900` |

Components sum using integers only. Channel provenance follows the fixed
channel order; candidates sort by descending retrieval score and final ASCII
candidate ID. There is no popularity, quality, target, floating-point, locale,
clock, or random input. Exact repository and package identities form
deterministic transitive groups independently within each hard lane; the
highest score and then ASCII candidate ID selects the representative, and
later distinct candidates backfill that same lane. An identity present once in
each lane is not a duplicate and neither representative can suppress the
other. Forks, semantic near-equivalence, evaluation equivalence, expansion,
lexical metadata, and advanced fusion remain unimplemented.

The fixed read-only production command is:

```bash
pnpm eval:retrieval:production
```

It builds the product package, loads blind query inputs first, freezes and
schema-validates real product predictions, obtains the complete 150-candidate
decision array from the existing evaluation-side generated projection, then
loads gold and invokes the existing scorer. It writes no report, gold, model,
provider, or fixture output. The adapter derives `noEligibleCandidate` only
from `preRetrievalLaneCounts.eligible === 0` and selects evidence-needed results
only for that zero-pool state.

All nine pre-registered differential assertions pass across 30/30 retrieval
cases: lane counts, eligible membership, evidence-needed membership, excluded
and negative-control non-leakage, domain/product lane agreement,
count-derived no-eligible mapping, the nonzero-pool empty-result miss, the
zero-pool evidence-needed mapping, and production blindness to every gold and
scorer field. Complete candidate decisions remain evaluation-side.

The first blind production measurement is:

| Metric                              | Milestone 2 result  |
| ----------------------------------- | ------------------- |
| macro Recall@10                     | `0.612295`          |
| positive-case hit rate              | `25/25`             |
| authorization Recall@10             | `0.686274`          |
| audit-logging Recall@10             | `0.544203`          |
| background-jobs Recall@10           | `0.478897`          |
| rate-limiting Recall@10             | `0.526923`          |
| webhooks Recall@10                  | `0.825175`          |
| MRR                                 | `0.960000`          |
| NDCG@10                             | `0.769561`          |
| hard-filter correctness             | `4,500/4,500`       |
| prohibited preservation             | `15/15`             |
| no-eligible correctness             | `30/30`             |
| top-10 conflict/lane/negative leaks | `0/0/0`             |
| exact/equivalence duplicate rate    | `0.000000/0.000000` |

The macro, audit-logging, and rate-limiting values remain below their final
pre-registered gates and are reserved for Milestone 3. No threshold, corpus,
gold, fixture, baseline, or scorer was changed in response.

The initial 30-query Node 24.18.0 measurement examined and constraint-evaluated
exactly 150 candidates at most once per request, ran five channels, returned at
most ten total candidates on the current corpus, and reproduced byte-identical
results on the immediate repeat. It measured p95 `12.497 ms`, maximum
`16.334 ms`, one cold engine/search-view build at `182.262 ms`, and a
post-GC search-view heap delta of `392,528` bytes. Query latency and heap are
inside the final budgets in this initial sample. The single cold build is not
the pre-registered 100-build p95 proof and exceeds the final 100 ms target as
an individual observation; full warm-up, 1,000-query retained-memory, and
fresh-process evidence remains M3/M4 work. This is correction evidence, not
permission for an index, cache, vector, database, or service.

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

#### Milestone 3 implementation evidence — pending independent review

The accepted M2 prediction was reproduced before mutation with prediction
digest `3bba6372d211e88ba6f62fe3d948312c4f1daf7184ba639248337323dc559e1a`
and score digest
`7babb9b08467bfa91c35ce277ad776f2450806d21cf2418e46dd8c80b1c4d265`.
Predictions were frozen before the development corpus was opened for error
analysis. Among 400 eligible relevant judgments, M2 returned 195. All 205
misses had a capability-family signal but fell below the bounded top ten:

| Starting miss cause                        | Count |
| ------------------------------------------ | ----: |
| hard-excluded                              |     0 |
| evidence-needed within scored recall cases |     0 |
| eligible with no retrieval signal          |     0 |
| generated but ordered below top 10         |   205 |
| same-lane identity suppression             |     0 |
| another deterministic cause                |     0 |

The below-top-10 misses were 25 authorization, 46 audit-logging, 73
background-jobs, 50 rate-limiting, and 11 webhooks judgments. Separately, 56
relevant records in the five zero-eligible-pool cases were correctly assigned
to evidence-needed and are not Recall@10 misses.

Initial channel analysis found:

| M2 channel         | Cases with a component | Candidate-case components | Top-10 effect                                     |
| ------------------ | ---------------------: | ------------------------: | ------------------------------------------------- |
| capability-family  |                     30 |                       636 | removing it changed all 30 top-10 sets            |
| taxonomy-concept   |                      0 |                         0 | none                                              |
| candidate-identity |                      5 |                         9 | changed order in five cases and membership in two |
| package-identity   |                      0 |                         0 | none                                              |
| structured-profile |                      0 |                         0 | none                                              |

No candidate activates an additional family, every one of the eight approved
structured retrieval fields is unknown for all 150 profiles, and the current
authority has no exact repository/package identity group. The observed gap is
therefore sparse candidate-owned differentiation within already generated
same-family pools. It is not caused by query normalization, hard filtering,
identity diversity, or a genuine semantic mismatch.

Milestone 3 introduces the human-reviewable and generated authority under
`catalog/capability-retrieval-expansion/1.0.0`. It binds taxonomy `1.0.0` and
semantic digest
`838fa85b2e6937866854b6f733fe7045cf49d5f811cb5e4a8d503bfbd76a61c9`.
The generated authority has semantic digest
`1435521e117e2af18ec55bbf1f30e3f5d2f48fe07d54f0c657917ff027086f4a`,
144 directed edges over 49 source concepts, 47 active taxonomy-alias edges,
and 97 proposed related-identity-term edges pending Milestone 3 review.
Query-time expansion is exactly
one hop, keeps every original concept, permits at most eight canonical edges
per source and 32 per query, and deterministically truncates by source concept,
target term, then edge ID. Required and prohibited records remain byte- and
semantically identical; prohibited concepts cannot create a soft expansion
component; and expansion cannot alter a hard state or lane.

Only five of the 20 proposed custom rule sources activate in the current 30
blind retrieval inputs; 15 do not. This input-only coverage check, the absence
of case/candidate fields, and a general `norm-*` / `ret-*` identifier guard
provide direct evidence that the authority is not a case lookup table.

The two existing product contract roots advance from `1.0.0` to `1.1.0`, and
`deterministic-candidate-retrieval` advances from `1.0.0` to `1.1.0`. This is a
coordinated additive minor evolution on the unmerged pre-public branch, not a
new root concept. Requests and results now bind the expansion authority and
digest; results expose bounded expansion diagnostics and matched edge IDs.
`candidate-identity` and `package-identity` advance to `1.1.0`; the other three
channel bindings remain `1.0.0`.

Expansion matches only bounded exact candidate ID, repository owner/name, and
package identity terms. The global integer fusion rule retains the M2
components and adds 100 points per distinct matched expansion source concept
to the candidate-identity or package-identity component, each capped at 2,000.
All active components are summed, followed by the unchanged descending integer
score and ASCII candidate-ID comparator. The rule contains no case-, family-,
or candidate-specific weight.

Repository inspection found no approved immutable repository/package lexical
authority: retained artifact manifests bind selections and receipts but not
bodies; current profiles have no known topics/descriptions/keywords; and
catalog rationale is curator selection context. Lexical retrieval therefore
remains disabled. Catalog rationale, completion/interview prose, and evaluation
text were not used. No product-owned reviewed fork or near-equivalence
authority exists, so both groupings remain disabled and evaluation equivalence
remains tooling-only. The accepted lane-local exact identity algorithm is
unchanged.

Meaningful development ablations were:

| Configuration                                           | Macro Recall@10 | Authorization | Audit    | Background | Rate     | Webhooks | MRR      | NDCG@10  | Decision                                                  |
| ------------------------------------------------------- | --------------- | ------------- | -------- | ---------- | -------- | -------- | -------- | -------- | --------------------------------------------------------- |
| accepted M2                                             | 0.612295        | 0.686274      | 0.544203 | 0.478897   | 0.526923 | 0.825175 | 0.960000 | 0.769561 | frozen starting point                                     |
| global fusion-weight changes without new signal         | 0.612295        | 0.686274      | 0.544203 | 0.478897   | 0.526923 | 0.825175 | 0.960000 | 0.769561 | no tied same-family ordering effect                       |
| broad family-identity expansion experiment              | 0.611991        | —             | —        | —          | —        | 0.806993 | 0.916667 | —        | rejected; broad common terms reduced precision and recall |
| bounded concept-to-exact-identity expansion plus fusion | 0.615628        | 0.702941      | 0.544203 | 0.478897   | 0.526923 | 0.825175 | 0.953333 | 0.792925 | retained as the smallest general improvement              |
| approved metadata lexical                               | not run         | —             | —        | —          | —        | —        | —        | —        | no approved candidate-owned lexical authority exists      |

The rejected broad experiment was removed; its partial metrics are retained
only to explain the decision and were not used to tune a family-specific rule.
Weighted reciprocal-rank fusion is not justified because four of five channels
provide no independent rank on the real corpus. The final global additive rule
recovers one authorization judgment and leaves every other family unchanged.

The final M3 development benchmark is:

| Gate/diagnostic                               | M3 value         | Required      | State |
| --------------------------------------------- | ---------------- | ------------- | ----- |
| macro Recall@10                               | `0.615628`       | `>= 0.625000` | fail  |
| positive-case hit rate                        | `25 / 25`        | `25 / 25`     | pass  |
| authorization Recall@10                       | `0.702941`       | `>= 0.647647` | pass  |
| audit-logging Recall@10                       | `0.544203`       | `>= 0.564783` | fail  |
| background-jobs Recall@10                     | `0.478897`       | `>= 0.438207` | pass  |
| rate-limiting Recall@10                       | `0.526923`       | `>= 0.543462` | fail  |
| webhooks Recall@10                            | `0.825175`       | `>= 0.759021` | pass  |
| MRR                                           | `0.953333`       | `>= 0.900000` | pass  |
| NDCG@10                                       | `0.792925`       | `>= 0.750000` | pass  |
| hard-filter correctness                       | `4500/4500`      | exact         | pass  |
| prohibited preservation, micro / macro        | `15/15`, `10/10` | exact         | pass  |
| no-eligible correctness                       | `30/30`          | exact         | pass  |
| conflict / lane / negative-control            | `0 / 0 / 0`      | zero          | pass  |
| exact / controlled-equivalence duplicate rate | `0 / 0`          | zero          | pass  |

The final prediction digest is
`0280c50b9d6f8d95b9b5f3cc30506b0979e3bf2470158c584d8c47396783f0d1`;
the score digest is
`747c5d8ab8de9a94d089c1513bc6d976174ce5e8fbff0486acbe2bcdcfbad5b0`.
Expansion applied 92 edges from 40 source-concept occurrences over all 30
cases with zero truncation; 142 matched edge occurrences were observed in 15
cases. Exact identity groups and removals remain zero.

The M3 performance protocol used 100 warm-ups and 1,000 round-robin queries.
It measured p95 `10.684 ms`, maximum `26.587 ms`, search-view heap delta
`544,472` bytes, retained heap growth `1,011,784` bytes with explicit GC, 150
candidates evaluated once, five channels, and at most ten returned candidates.
Repeated calls and five cold-engine results were byte-identical. Five complete
authority-admitting engine constructions measured p95/max `161.068 ms`; a
separate 100-construction measurement of the already validated 150-candidate
search view—the accepted budgeted operation—measured p95 `0.351 ms` and maximum
`2.734 ms`. M4 must preserve that distinction and freeze its final protocol.

The vector trigger is inactive. Condition 1 is true because three quality
gates fail. Condition 2 is false: zero misses across zero families were
attributed to semantic mismatch, so neither the ten-judgment/three-family nor
20% threshold is met. Available deterministic signals were exhausted, but no
approved lexical authority exists; no vector spike or superseding ADR was
therefore permitted under conditions 4–5. Infrastructure triggers are also
inactive: the authority has 150 candidates, query latency and search-view
memory pass, and no three-run corrected breach or usage evidence exists for an
index, cache, persistence, or service.

Milestone 3 is not accepted and cannot authorize Milestone 4 while the
development gates remain unmet. Independent review accepted the existing M3
expansion/fusion implementation but required the bounded discovery-metadata
authority correction below. Evaluation gold remains `proposed-not-reviewed`;
no final production-quality claim is made.

#### Milestone 3 authority correction — prepared offline

Phase 6 historical artifact bodies are not committed, so README or arbitrary
document lexical retrieval remains unavailable and no Phase 6 live collection
was reopened. Inspection of ADR 0008 and the Phase 8 materializer identified a
narrower legitimate source: the existing `github-repository-metadata`
operation already obtains `GET /repos/{owner}/{repository}` through the
reviewed GitHub request boundary and its bounded parser establishes canonical
owner/repository, nullable description, topics, and nullable primary language.

This correction introduces one product contract root,
`CandidateRetrievalMetadataAuthorityV1`, version
`candidate-retrieval-metadata-authority/1.0.0`. Its future canonical snapshot
path is
`catalog/public-v1/candidate-retrieval-metadata-authority.json`; that file does
not yet exist. Each of exactly 150 sorted records binds candidate ID, canonical
GitHub owner/repository, nullable description, sorted unique topics, nullable
primary language, and a source-record semantic digest. The root binds contract
and authority version, exact catalog version/digest, narrow and source provider
policy versions/digests, source operation, collection timestamp, derived
snapshot ID, candidates, and authority semantic digest. The mutable GitHub
source is not described as immutable; one collected, digest-bound authority is
an immutable snapshot.

Bounds are fixed before live data: description at most 500 code units; at most
20 topics of at most 100 code units each; primary language at most 100 code
units; exactly 150 unique candidate and case-insensitive repository identities
closing exactly over `public-v1`; and a 1,048,576-byte formatted authority
limit. Unsafe control/bidi text fails authority validation. Source-record
digests cover identity and retained metadata. The root semantic digest covers
all semantic provenance, `collectedAt`, and sorted records, excludes only the
derived snapshot ID and digest itself, and supplies the first 32 hexadecimal
characters of the snapshot ID.

Collection uses policy
`candidate-retrieval-metadata-provider-policy/1.0.0`, digest
`7e12f31e079fe05dad33569408885085bc2dd5cd85036318a594a7e9bd8751ce`,
which binds the accepted Phase 8 provider-policy digest
`0945ebd862d0a1b5f622c4f10f60b2c0e713fb127cc5dea5668be5cc40c96ede`.
Its only operation is `github-repository-metadata`: HTTPS `GET` to
`api.github.com` at `/repos/{owner}/{repository}`. The existing request helper,
response parser, identity verification, public-repository check, transport,
retry classification, and safe error behavior are reused; the Phase 8 source
graph and provider set are unchanged.

The independently reviewable future envelope is exactly:

| Property                            | Frozen value                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| command                             | `pnpm retrieval:metadata:collect`                                                                                        |
| output                              | `catalog/public-v1/candidate-retrieval-metadata-authority.json`                                                          |
| catalog                             | `public-v1`; `4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634`                                          |
| expected records / logical requests | `150 / 150`                                                                                                              |
| worst-case attempts                 | `450` (`150 × 3`)                                                                                                        |
| credential                          | `GITBLOCKS_RETRIEVAL_METADATA_GITHUB_TOKEN`                                                                              |
| host / endpoint                     | `api.github.com`; `/repos/{owner}/{repository}`                                                                          |
| concurrency                         | `3`                                                                                                                      |
| response / JSON bounds              | `2,097,152` bytes; `100,000` nodes                                                                                       |
| timeout / redirect / retry          | `10,000 ms`; at most `2`; at most `3` attempts using the accepted deterministic classification                           |
| deadlines                           | `90,000 ms` per candidate; `3,600,000 ms` per run                                                                        |
| retained provider fields            | canonical owner/repository, description, topics, primary language                                                        |
| prohibited operations               | releases, tags, license, community profile, allowlisted files, npm, advisories, commits, artifact bodies, link following |
| runtime dependencies                | no database, Docker, model, npm provider, or artifact body                                                               |

`pnpm retrieval:metadata:preflight` is the read-only, zero-network command. It
reads only the fixed catalog and two provider-policy files, proves exact
closure and envelope values, requires the future output to be absent, and
reports zero network calls, credential reads, and writes. The separate
`collect` mode is implemented for later authorization but was not executed.
No real credential was read and no authority snapshot was fabricated.

The future sixth channel is pre-registered as
`approved-metadata-lexical/1.0.0` but remains absent from the five active
production bindings. Query terms are limited to normalized capability concept
IDs, active taxonomy aliases for those concepts, accepted M3 one-hop expansion
terms, and canonical terms from controlled normalized constraints. Candidate
terms come only from description, topics, and primary language. ASCII
lowercasing, alphanumeric tokenization, one-to-four-token `-`-joined phrase
n-grams, a 32-code-unit token maximum, exact equality, and unique normalized
matches are global. Exact topic/phrase matches score 300, exact description
phrase matches score 100, and exact primary-language matches score 100 only
when that term is query-authorized; each term scores once at its strongest
source and the component cap is 900. No family-, case-, or candidate-specific
rule exists.

The repository-identity profile field already authorizes `displayName`, but
the accepted candidate-identity search view omitted it. The general identity
projection now includes display name and advances the result, algorithm, and
candidate-identity channel to `1.2.0`; the request remains `1.1.0`. A standalone
ablation found no Recall@10, family, hit-rate, or MRR change: macro remains
`0.615628`, the five families remain `0.702941 / 0.544203 / 0.478897 /
0.526923 / 0.825175`, hit rate remains `25/25`, and MRR remains `0.953333`.
NDCG@10 changes from `0.792925` to `0.792904`. The correction is retained
because it completes already accepted identity semantics, not because of its
metric effect. The current prediction digest is
`73b5d97190d97bbef15bcbad157d9a60e65153e6ee74a2fe2d4b7cebab14afb8`
and the score digest is
`6a383a501303fcf4b939e2dd7fa5de130a01a933de196cc0c552c4cfe1d74c8d`.

No live provider collection, credential inspection, profile mutation,
evaluation-authority mutation, database, Docker, model, vector, index, cache,
search service, ranking, API, MCP, or Skill work occurred. Milestone 7B remains
deferred, Milestone 3 remains open, and Milestone 4 remains blocked.

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

Milestone 2 adds the fixed read-only `pnpm eval:retrieval:production` command.
It generates production predictions through `@gitblocks/retrieval` and scores
them with the existing scorer; it creates no second scorer.

`pnpm db:verify` is not part of the planned path because Phase 9 creates no
persistence change. If an independently accepted trigger authorizes a
persistence or migration change, the issue, plan, ADR, pinned PostgreSQL path,
non-owner runtime integration tests, and `pnpm db:verify` become mandatory
before that work. No database test may skip.

## Observability and operations

Milestone 1 had no production path and emitted no runtime telemetry. The
Milestone 2 pure package returns bounded diagnostics/provenance and does not
log or trace. Stable operation/error concepts include retrieval request
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
- 2026-08-07: Independent review retained the architecture and every numeric
  gate but required correction of no-eligible semantics and the related
  complete-candidate-decision boundary. The ADR and plan now derive
  `noEligibleCandidate` only from the complete pre-retrieval eligible-pool
  count, keep full decisions in the evaluation-side projection, and
  pre-register nine Milestone 2 differential assertions. The correction
  requires independent rereview; Milestone 2 remains blocked.
- 2026-08-07: Independent rereview accepted ADR 0009, all pre-registered gates,
  and the corrected evaluation-lane boundary at
  `18dae5adf821f0c998c02d4829416d655b9da1a1`. The Milestone 1 correction's
  hosted aggregate failure is accepted as a runner-infrastructure exception:
  Standalone Typecheck, Interview/Operator Tests, and Database/Audit passed;
  the other deterministic workers were terminated by hosted-runner shutdown,
  including exit 143 during retrieval validation; and authoritative local
  `pnpm verify` passed 115 files and 1,802 tests with no deterministic failing
  assertion. Milestone 2 is authorized, while evaluation gold remains
  `proposed-not-reviewed` and Milestones 3–4 remain blocked.
- 2026-08-07: Implemented the Milestone 2 vertical slice: two additive product
  contract roots, pure `@gitblocks/retrieval`, five exact deterministic
  channels, one hard evaluation per candidate, complete pre-retrieval lane
  counts, exact identity deduplication, bounded provenance, and the blind
  production evaluation adapter. All nine differential assertions and focused
  package/contract/adapter tests pass. The first production run records macro
  Recall@10 `0.612295`, 25/25 positive hits, zero safety violations, p95 query
  latency `12.497 ms`, and the remaining macro/audit/rate recall gaps without
  tuning. Milestone 2 remains pending independent review and Milestone 3 has
  not begun.
- 2026-08-07: Independent Milestone 2 review accepted the implementation except
  for one exact-identity defect: the union-find pass ran across both hard lanes
  and allowed a higher-scoring candidate to suppress a different-lane record
  with the same repository or package identity. Four red-first assertions
  failed against that behavior. The corrected implementation partitions scored
  candidates by hard lane, performs the unchanged transitive identity grouping
  and representative selection separately within each partition, and sums the
  lane-local diagnostics. The focused retrieval file now passes 24/24 tests,
  including both score directions, both identity kinds, both within-lane
  representative paths, transitivity, backfill, and permutation-stable
  diagnostics. Milestone 2 remains pending independent acceptance.
- 2026-08-07: Independent rereview accepted Milestone 2 at
  `ce533e39588027048a522417782ada98afeb1489`, including the lane-local
  exact-identity correction. The latest hosted aggregate failure is accepted as
  infrastructure evidence: the unchanged Tooling shard slowed materially
  before an historical audit test failed, other workers were terminated by the
  later explicit runner shutdown, and the complete authoritative local suite
  passed. This acceptance authorizes Milestone 3 only. Evaluation gold remains
  `proposed-not-reviewed`, Phase 9 remains incomplete, and Milestone 4 remains
  blocked.
- 2026-08-07: Reproduced the accepted Milestone 2 production prediction and
  score digests before M3 mutation, then froze predictions before opening gold.
  Across 400 eligible relevant judgments, 195 were returned and all 205 misses
  were generated by `capability-family` but ordered below top 10. Misses due to
  hard exclusion, evidence-needed assignment, absent signal, identity
  deduplication, or another cause were all zero. Across all relevant judgments,
  the only additional 56 absences were correctly segregated evidence-needed
  candidates in the five zero-eligible-pool cases.
- 2026-08-07: M3 channel contribution analysis found `capability-family`
  active in 30/30 cases and 636 candidate-case pairs; `candidate-identity`
  active in five cases and nine candidate-case pairs; and zero real-corpus
  activation for taxonomy-concept, package-identity, or structured-profile.
  Family ablation changed all 30 top-10 sets; candidate-identity ablation
  changed ordering in five cases and membership in two. Every one of the eight
  approved structured retrieval fields is unknown for all 150 profiles, no
  additional-family match activates, and the authority has no exact identity
  groups. The remaining gap is therefore tied ordering under sparse
  candidate-owned authority, not hard filtering, deduplication, or a genuine
  semantic-retrieval miss.
- 2026-08-07: Implemented the bounded expansion authority and additive global
  identity fusion. The retained algorithm improves macro Recall@10 from
  `0.612295` to `0.615628` and authorization from `0.686274` to `0.702941`,
  with 25/25 hits, MRR `0.953333`, NDCG@10 `0.792925`, and every safety and
  duplicate gate exact. Audit logging and rate limiting remain unchanged, so
  the macro and those two family floors still fail. This result is pending
  independent review and does not authorize M4.
- 2026-08-07: The M3 performance protocol passed query, search-view memory,
  retained-heap, bounded-work, and repeatability budgets. Five full
  authority-admitting engine constructions measured p95 `161.068 ms`, while
  100 already-validated search-view constructions measured p95 `0.351 ms`;
  the latter is the operation named by the accepted build budget. The vector
  trigger remains inactive because zero misses were semantic, and every
  persistence/index/cache/service trigger remains inactive.

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
- 2026-08-07 — Derive evaluation `noEligibleCandidate` exclusively from
  `preRetrievalLaneCounts.eligible === 0` and retain complete candidate
  decisions in the existing evaluation-side projection. Reason: bounded result
  emptiness is a retrieval failure when safe eligible candidates exist, while
  the projection already delegates hard semantics to product domain authority.
  Owner: independent correction review.
- 2026-08-07 — Keep production authority admission canonical while proving
  algorithm order independence over 20 fixed post-admission search-view
  permutations. Reason: the Phase 8 profile authority already requires sorted
  profiles and a matching semantic digest; retrieval must not weaken that
  authority invariant. Owner: Milestone 2 implementation review.
- 2026-08-07 — Keep the cold engine-build observation as explicit performance
  evidence rather than adding infrastructure. Reason: one `182.262 ms` cold
  measurement is not the final 100-build p95 protocol, while query p95/max and
  heap already fit their initial budgets. Owner: Milestone 2 implementation
  review.
- 2026-08-07 — Preserve `deterministic-candidate-retrieval/1.0.0` while fixing
  exact-identity deduplication. Reason: the branch is unpublished and unmerged,
  ADR 0009 already defines deduplication as lane-local, the result contract and
  accepted serialized values do not change, and the correction makes the V1
  implementation conform to that existing semantic promise. The current
  authority has no exact identity duplicate groups, so its prediction/result
  digests remain unchanged. Owner: Milestone 2 correction review.
- 2026-08-07 — Advance the two retrieval contract families and algorithm to
  `1.1.0`, and the candidate/package identity channels to `1.1.0`. Reason: the
  expansion authority binding and edge provenance are additive but materially
  affect reproducibility and identity-channel semantics; silently changing a
  frozen `1.0.0` would be incorrect. The branch is unmerged and has no deployed
  consumer. Owner: Milestone 3 implementation review.
- 2026-08-07 — Establish
  `capability-retrieval-expansion/1.0.0` as a taxonomy-bound one-hop authority
  with eight edges per source and 32 per query. Reason: controlled aliases and
  related exact identity terms are the smallest candidate-owned broadening
  available without lexical text or a model. Owner: Milestone 3 implementation
  review.
- 2026-08-07 — Keep approved-metadata lexical retrieval disabled. Reason: the
  repository retains no committed artifact body, and catalog rationale,
  interviews, completion prose, and evaluation text are not valid substitutes.
  The accepted repository-metadata endpoint is handled separately as the
  narrower discovery authority above. Owner: Milestone 3 correction review.
- 2026-08-07 — Retain global additive integer fusion and exact lane-local
  identity diversity; keep fork and near-equivalence grouping disabled.
  Reason: ablation does not justify a more complex rank-fusion mechanism, and
  no reviewed product authority proves fork or equivalence relationships.
  Owner: Milestone 3 implementation review.
- 2026-08-07 — Do not activate the vector or infrastructure paths after M3.
  Reason: zero misses were attributed to semantic mismatch, the corpus is only
  150 candidates, and query/memory budgets pass. The remaining recall gap is
  sparse candidate authority, which neither a vector nor an index can
  legitimately manufacture. Owner: Milestone 3 implementation review.
- 2026-08-07 — Establish one separate soft
  `CandidateRetrievalMetadataAuthorityV1` rather than mutate the Phase 8
  profile authority. Reason: retrieval-quality enrichment must not silently
  change accepted hard-filter bindings; the new snapshot is provider-derived,
  digest-bound, injected, and retrieval-only. Owner: Milestone 3 correction
  review.
- 2026-08-07 — Reuse the Phase 8 repository-metadata request/parser boundary
  and prohibit every other provider operation. Reason: it is the smallest
  reviewed candidate-owned source and avoids a second parser or transport
  stack. Owner: Milestone 3 correction review.
- 2026-08-07 — Add repository `displayName` to the general candidate-identity
  projection and retain it independent of its neutral Recall@10 ablation.
  Reason: it is an accepted repository-identity field, not curator rationale
  or recommendation semantics. Owner: Milestone 3 correction review.
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

### Correction validation evidence

The correction's first required sequence passed `pnpm runtime:check` and then
stopped at `pnpm format:check`, which named only this plan. The repository
formatter was applied to the two authorized correction documents; ADR 0009 was
already formatted and remained byte-identical in that formatter invocation.
The complete sequence then passed and is rerun once more after this evidence
entry so the record itself is covered:

- `pnpm runtime:check`: exit 0;
- `pnpm format:check`: exit 0;
- `pnpm repo:check`: exit 0;
- `pnpm security:secrets`: exit 0 with no finding;
- `pnpm security:audit`: exit 0 with no known vulnerability at the `moderate`
  threshold;
- `pnpm verify`: exit 0 with 115 test files and 1,802 tests passed and no
  architecture violation across 847 modules and 2,810 dependencies;
- `git diff --check`: exit 0; and
- `git status --short --branch`: the exact tracking branch plus only ADR 0009
  and this plan modified.

The deterministic retrieval report digest remained
`6a16353159fb2e30e424ee20fb2e4eeda640ae2248a50580fd162ab012ddf1ed`,
authority-order output matched, and pre-live status remained
`offline-verified-live-blocked` with no model selected. No provider collection,
database operation, migration, materialization, or model operation ran.

### Milestone 1 diff and prohibited-scope review

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
they are retained in the draft PR and Milestone 1 delivery report. Subsequent
independent rereview accepted Milestone 1 at the correction commit, as recorded
in the current status and progress log above.

### Milestone 2 validation evidence — independently accepted

The complete Milestone 2 validation sequence was rerun after the implementation
and this evidence record. Its authoritative results are:

| Command                                                                                        | Result                                                                                                       |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pnpm runtime:check`                                                                           | exit 0; Node 24.18.0 and pnpm 11.17.0 pins passed                                                            |
| `pnpm format:check`                                                                            | exit 0; all matched files use repository formatting                                                          |
| `pnpm repo:check`                                                                              | exit 0; runtime and repository policy checks passed                                                          |
| `pnpm contracts:validate`                                                                      | exit 0; 10 product-conformance cases and 40 candidate mappings passed                                        |
| `pnpm eval:validate` / `pnpm eval:fixtures`                                                    | exit 0; existing evaluation authority and hand-calculated fixtures passed unchanged                          |
| `pnpm eval:retrieval:validate` / `pnpm eval:retrieval:fixtures` / `pnpm eval:retrieval:verify` | exit 0; retrieval-v1 and existing scorer/baseline authority passed unchanged                                 |
| `pnpm eval:retrieval:production`                                                               | exit 0; real production predictions, all nine differentials, safety scoring, quality metrics, and timing ran |
| focused contract/retrieval/adapter Vitest command                                              | exit 0; 3 files and 39 tests passed                                                                          |
| `pnpm architecture:check`                                                                      | exit 0; 857 modules and 2,855 dependencies had no violation                                                  |
| `pnpm security:secrets`                                                                        | exit 0; Secretlint reported no finding                                                                       |
| `pnpm security:audit`                                                                          | exit 0; no known vulnerability at the `moderate` threshold                                                   |
| `pnpm verify`                                                                                  | exit 0; 118 test files and 1,843 tests passed, plus every configured authority and architecture check        |
| `git diff --check`                                                                             | exit 0; no whitespace error or diagnostic                                                                    |
| `git status --short --branch`                                                                  | exact tracking branch plus only the intended Milestone 2 worktree changes                                    |

The focused command was:

```bash
pnpm exec vitest run \
  packages/contracts/test/candidate-retrieval-contracts.test.ts \
  packages/retrieval/test/retrieval-engine.test.ts \
  tools/evaluation-harness/test/retrieval-production-adapter.test.ts
```

The standalone production-validation run reproduced prediction digest
`3bba6372d211e88ba6f62fe3d948312c4f1daf7184ba639248337323dc559e1a`
and score digest
`7babb9b08467bfa91c35ce277ad776f2450806d21cf2418e46dd8c80b1c4d265`.
It again examined and constraint-evaluated at most 150 candidates, ran five
channels, returned at most ten candidates, and produced byte-identical repeat
results. This run measured p95 query latency `11.024 ms`, maximum query latency
`16.419 ms`, cold engine/search-view construction `165.947 ms`, and post-GC
search-view heap delta `394,024` bytes. Exact repository/package identity group
counts and removals were all zero for the current authority.

The final authoritative `pnpm verify` sample measured p95 query latency
`12.659 ms`, maximum query latency `17.864 ms`, cold engine/search-view
construction `155.567 ms`, and post-GC search-view heap delta `459,680` bytes;
the deterministic prediction and score digests remained unchanged.

An initial full-suite run exposed no product assertion failure. It found three
stale exact repository-policy expectations for the intentionally added CI
command, lockfile/workflow scope pins, and renamed blind-input helper, plus
test-hook timeouts under the local default of 14 concurrent workers while
several suites parsed the 150-profile authority. The exact expectations were
updated without weakening policy, and Vitest concurrency was bounded at eight.
The subsequent raw suite and authoritative `pnpm verify` passed all 1,843 tests.

A later pre-final `pnpm verify` stopped during the product build after result
provenance was closed from arbitrary stable IDs to the domain-owned profile
field-ID union: the retrieval sorting helper widened that union back to
`string[]`. The helper now preserves its generic string subtype, and the
immediate `pnpm build:product` rerun passed. The next pre-final run stopped at
the lint rule requiring `T[]` notation in one synthetic test helper; that type
notation was corrected without changing behavior. No runtime assertion,
authority, metric, or dependency rule failed.

The naturally triggered hosted run `31218374163` subsequently found one
resource-sensitive validation failure rather than a retrieval or interview
assertion failure. The Interview and Operator worker passed 325 tests, but the
existing interview import-boundary test exceeded its explicit 30-second limit
at `32.027 s` while the branch's eight Vitest workers contended on a four-vCPU
hosted runner. The worker-cap change already introduced by this milestone was
corrected from eight to four; no interview test, timeout, or product behavior
was changed. The exact failed shard then passed locally with 13 files and 326
tests in `11.07 s`. Because the milestone commit was already published, this
configuration correction must use an ordinary follow-up commit rather than
rewriting shared history.

The authoritative post-correction `pnpm verify` rerun exited 0 with all 118
test files and 1,843 tests passing and with no dependency violation across 857
modules and 2,855 dependencies. Its production sample preserved both semantic
digests and all recorded quality/safety results while measuring p95 query
latency `12.036 ms`, maximum query latency `18.824 ms`, cold engine/search-view
construction `159.238 ms`, and post-GC search-view heap delta `459,704` bytes.

The registry-backed audit then began reporting `GHSA-2v37-7h3g-55p8` against
transitive `nanoid 3.3.16` in the unchanged Vitest/Vite development toolchain.
The accepted `postcss` range admits the patched `3.3.17`; a root pnpm override
now pins that exact version across every transitive path, and pnpm regenerated
only the corresponding lockfile resolution. No direct or product dependency
changed. The Phase 8 scope guard's exact lockfile digest was advanced to
`e34dcbb858b8522d66cf5577efa7e21fc4aa6a407d8e3998dff8113d8ac626af`
without changing any other protected byte authority.

The final post-override `pnpm verify` rerun exited 0 with the same 118 files,
1,843 tests, architecture counts, prediction/score digests, quality metrics,
and zero-violation safety results. Its production sample measured p95 query
latency `13.351 ms`, maximum query latency `17.950 ms`, cold
engine/search-view construction `171.244 ms`, and post-GC search-view heap
delta `388,936` bytes. A frozen pnpm install, the four-test protected scope
guard, and the registry-backed audit also passed on the exact final lockfile.

The exact Milestone 2 changed-file set relative to the accepted Milestone 1
commit is:

```text
.github/workflows/ci.yml
dependency-cruiser.config.mjs
docs/architecture/decisions/0009-production-retrieval.md
docs/plans/0021-production-retrieval.md
package.json
packages/contracts/src/candidate-retrieval-contracts.ts
packages/contracts/src/candidate-retrieval-schemas.ts
packages/contracts/src/index.ts
packages/contracts/src/schema-catalog.ts
packages/contracts/src/structural-validation.ts
packages/contracts/test/candidate-retrieval-contracts.test.ts
packages/contracts/test/repository-interview-contracts.test.ts
packages/contracts/test/schema-artifacts.test.ts
packages/domain/src/candidate-constraint-evaluation.ts
packages/domain/src/index.ts
packages/ingestion/test/profile-materialization-scope.test.ts
packages/retrieval/README.md
packages/retrieval/package.json
packages/retrieval/src/index.ts
packages/retrieval/src/retrieval-engine.ts
packages/retrieval/test/retrieval-engine.test.ts
packages/retrieval/test/tsconfig.json
packages/retrieval/tsconfig.json
packages/retrieval/tsconfig.test.json
pnpm-lock.yaml
pnpm-workspace.yaml
tools/evaluation-harness/package.json
tools/evaluation-harness/src/retrieval/baseline-generation.ts
tools/evaluation-harness/src/retrieval/cli.ts
tools/evaluation-harness/src/retrieval/production-generation.ts
tools/evaluation-harness/src/retrieval/production-runner.ts
tools/evaluation-harness/src/retrieval/safe-authority.ts
tools/evaluation-harness/test/retrieval-baseline-boundary.test.ts
tools/evaluation-harness/test/retrieval-baseline-cli.test.ts
tools/evaluation-harness/test/retrieval-production-adapter.test.ts
tools/evaluation-harness/tsconfig.json
tools/evaluation-harness/tsconfig.test.json
tools/repository-checks/architecture-fixtures/allowed-product-direction/packages/retrieval/index.mjs
tools/repository-checks/architecture-fixtures/allowed-product-direction/packages/retrieval/src/index.mjs
tools/repository-checks/architecture-fixtures/allowed-product-direction/tools/evaluation-harness/src/index.mjs
tools/repository-checks/architecture-fixtures/retrieval-disallowed-package/packages/persistence/src/index.mjs
tools/repository-checks/architecture-fixtures/retrieval-disallowed-package/packages/retrieval/src/index.mjs
tools/repository-checks/src/repository-invariants.ts
tools/repository-checks/test/architecture-rules.test.ts
tools/repository-checks/test/repository-invariants.test.ts
tools/repository-checks/test/temp-repository.ts
tools/repository-checks/test/workflow-policy.test.ts
tsconfig.json
vitest.config.ts
```

Complete diff review found no evaluation case, relevance, no-result,
equivalence, gold, scorer, baseline output, migration, database, materialization,
provider, model, expansion, vector, persistent index, cache, search service,
ranking, target-codebase, API, MCP, or Skill change. The production package has
no corresponding dependency or runtime access. Milestone 7B remains deferred.

### Milestone 2 lane-local deduplication correction — independently accepted

The red-first focused retrieval run exited 1 with 4 intended failures and 20
passes. The failures demonstrated that the prior global union-find pass removed
the lower-scoring member when eligible and evidence-needed candidates shared an
exact repository or package identity. After partitioning by lane before exact
identity grouping, the same focused command exited 0 with 24/24 tests passing:

```bash
pnpm exec vitest run packages/retrieval/test/retrieval-engine.test.ts
```

The correction retains the within-lane transitive union of exact repository and
package identities, descending integer score, final ASCII candidate-ID
tie-break, and deterministic backfill. Aggregate
`exactRepositoryIdentityGroups`, `exactPackageIdentityGroups`, and
`exactIdentityDuplicatesRemoved` now sum the independently computed eligible
and evidence-needed diagnostics. An identity occurring once in each lane adds
zero groups and zero removals. `preRetrievalLaneCounts` remain calculated before
channels, fusion, deduplication, and truncation and are untouched by this
change.

The first post-correction `pnpm eval:retrieval:production` run preserved
prediction digest
`3bba6372d211e88ba6f62fe3d948312c4f1daf7184ba639248337323dc559e1a`
and score digest
`7babb9b08467bfa91c35ce277ad776f2450806d21cf2418e46dd8c80b1c4d265`.
It reproduced macro Recall@10 `0.612295`, 25/25 positive hits, family recall
`0.686274` authorization, `0.544203` audit logging, `0.478897` background
jobs, `0.526923` rate limiting, and `0.825175` webhooks, MRR `0.960000`, and
NDCG@10 `0.769561`. Hard-filter decisions remained 4,500/4,500, prohibited
preservation 15/15, no-eligible correctness 30/30, and conflict, lane, and
negative-control violations zero. Product repository groups, package groups,
and removals remained 0/0/0; evaluation exact/equivalence duplicate rates
remained 0.000000/0.000000.

That representative run evaluated 150 candidates once, executed five channels,
and remained byte-repeatable. It measured p95 `11.993 ms`, maximum `17.489 ms`,
one cold engine/search-view build `161.045 ms`, and post-GC search-view heap
delta `397,256` bytes. This is a no-obvious-regression sanity sample, not the
later fixed cold-build protocol and not evidence for infrastructure work.

The complete correction validation sequence then passed without a repository
or authority failure:

- `pnpm runtime:check`, `pnpm format:check`, and `pnpm repo:check`: exit 0;
- `pnpm contracts:validate`: exit 0 with 10 conformance cases and 40 supplied
  candidates;
- `pnpm eval:validate`, `pnpm eval:fixtures`,
  `pnpm eval:retrieval:validate`, `pnpm eval:retrieval:fixtures`, and
  `pnpm eval:retrieval:verify`: exit 0 with the unchanged corpus, scorer
  fixtures, baseline report digest, and reversed-authority-order proof;
- `pnpm eval:retrieval:production`: exit 0 with all 30 differential cases,
  unchanged prediction/score digests, and unchanged quality and safety values;
- `pnpm architecture:check`: exit 0 across 857 modules and 2,855 dependencies;
- `pnpm security:secrets`: exit 0 with no finding;
- `pnpm security:audit`: exit 0 with no known vulnerability at the `moderate`
  threshold; and
- `pnpm verify`: exit 0 with 118 test files and 1,851 tests passing plus every
  configured authority, product build, type, lint, architecture, repository,
  evaluation, retrieval, contract, catalog, profile, interview, operator,
  pre-live, and secret check.

The standalone production command in that sequence measured p95 `11.232 ms`,
maximum `18.697 ms`, cold build `163.086 ms`, and post-GC search-view heap
delta `392,904` bytes. The production sample within authoritative
`pnpm verify` measured p95 `12.209 ms`, maximum `17.852 ms`, cold build
`153.286 ms`, and heap delta `460,224` bytes. Both samples evaluated 150
candidates once, ran five channels, returned at most ten candidates, and were
byte-repeatable. No contract, algorithm binding, gold, scorer, baseline,
threshold, CI worker setting, dependency, or lockfile changed.

### Milestone 3 validation evidence — pending independent review

The focused M3 command passed 10 files and 167 tests covering the expansion
authority and generator, request/result contracts, deterministic schema
artifacts, one-hop expansion, fusion and lane-local retrieval behavior, the
production adapter/differentials, gold blindness, repository invariants, and
CI policy:

```bash
pnpm exec vitest run \
  packages/contracts/test/capability-retrieval-expansion-contracts.test.ts \
  packages/contracts/test/retrieval-expansion-command.test.ts \
  packages/contracts/test/candidate-retrieval-contracts.test.ts \
  packages/contracts/test/schema-artifacts.test.ts \
  packages/retrieval/test/retrieval-expansion.test.ts \
  packages/retrieval/test/retrieval-engine.test.ts \
  tools/evaluation-harness/test/retrieval-production-adapter.test.ts \
  tools/evaluation-harness/test/retrieval-architecture.test.ts \
  tools/repository-checks/test/repository-invariants.test.ts \
  tools/repository-checks/test/workflow-policy.test.ts \
  --config vitest.config.ts
```

Standalone validation passed:

| Command                                                                                        | Result                                                                                                       |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pnpm runtime:check`                                                                           | exit 0; Node 24.18.0 and pnpm 11.17.0 pins passed                                                            |
| `pnpm format:check`                                                                            | exit 0; all matched files use repository formatting                                                          |
| `pnpm repo:check`                                                                              | exit 0; repository policy and authority paths passed                                                         |
| `pnpm retrieval:expansion:validate`                                                            | exit 0; 144 edges, 49 sources, and semantic digest reproduced                                                |
| `pnpm contracts:validate`                                                                      | exit 0; 10 product-conformance cases and 40 candidate mappings passed                                        |
| `pnpm eval:validate` / `pnpm eval:fixtures`                                                    | exit 0; existing evaluation authority and hand-calculated fixtures passed unchanged                          |
| `pnpm eval:retrieval:validate` / `pnpm eval:retrieval:fixtures` / `pnpm eval:retrieval:verify` | exit 0; unchanged corpus, scorer fixtures, baseline report, and reverse-authority proof passed               |
| `pnpm eval:retrieval:production`                                                               | exit 0; all 30 differentials, quality/safety metrics, expansion diagnostics, and M3 performance protocol ran |
| `pnpm architecture:check`                                                                      | exit 0; 865 modules and 2,889 dependencies had no violation                                                  |
| `pnpm security:secrets`                                                                        | exit 0; Secretlint reported no finding                                                                       |
| `pnpm security:audit`                                                                          | exit 0; no known vulnerability at the `moderate` threshold                                                   |
| `git diff --check`                                                                             | exit 0; no whitespace error or diagnostic                                                                    |

Five fresh processes independently generated prediction digest
`0280c50b9d6f8d95b9b5f3cc30506b0979e3bf2470158c584d8c47396783f0d1`.
The retrieval engine test also proved byte-identical results across 20 fixed
admitted search-view permutations and expansion tests proved query/authority
order independence. No result uses clock, random, locale, environment,
network, filesystem, model, or iteration order as a scoring input.

The first authoritative `pnpm verify` attempt stopped at four static lint
findings: exact literal types made three checks redundant and one test used the
repository-disallowed `Array<T>` notation. The checks remained enforced by the
closed parsers; the redundant comparisons and notation were corrected. The
second attempt stopped at one stale negative-test literal caught by TypeScript;
the invalid value now crosses the unknown parser boundary. The third attempt
ran all tests and found only two stale exact scope guards for the intended new
schema roots and CI authority-validation step. Those guards were advanced
without changing another protected digest. Focused reruns passed after each
correction; no retrieval behavior, gold, scorer, threshold, timeout, or worker
count changed.

The final authoritative `pnpm verify` exited 0 with 121 test files and 1,869
tests passing. It also passed every product/tool build and typecheck, lint,
repository check, authority validator, evaluation and scorer fixture,
architecture check across 865 modules and 2,889 dependencies, contract
conformance, profile/catalog/interview/operator/pre-live check, and Secretlint.
Its embedded M3 production run reproduced the final prediction and score
digests and all quality/safety values while measuring query p95 `10.467 ms`,
maximum `13.074 ms`, five complete engine constructions at p95/max
`173.338 ms`, search-view heap delta `547,384` bytes, and retained heap growth
`1,014,072` bytes.

The evidence-inclusive authoritative rerun also exited 0 with the same 121
files, 1,869 tests, architecture counts, digests, metrics, and safety results.
Its production sample measured query p95 `10.532 ms`, maximum `14.876 ms`,
complete-engine construction p95/max `167.352 ms`, search-view heap delta
`614,424` bytes, and retained heap growth `1,006,160` bytes.

The exact M3 changed-file set relative to accepted Milestone 2 is:

```text
.github/workflows/ci.yml
catalog/capability-retrieval-expansion/1.0.0/README.md
catalog/capability-retrieval-expansion/1.0.0/manifest.json
catalog/capability-retrieval-expansion/1.0.0/source.json
docs/architecture/decisions/0009-production-retrieval.md
docs/plans/0021-production-retrieval.md
package.json
packages/contracts/scripts/retrieval-expansion-cli.ts
packages/contracts/scripts/retrieval-expansion-command.ts
packages/contracts/src/candidate-retrieval-contracts.ts
packages/contracts/src/candidate-retrieval-schemas.ts
packages/contracts/src/capability-retrieval-expansion-contracts.ts
packages/contracts/src/capability-retrieval-expansion-schemas.ts
packages/contracts/src/index.ts
packages/contracts/src/schema-catalog.ts
packages/contracts/src/structural-validation.ts
packages/contracts/test/candidate-retrieval-contracts.test.ts
packages/contracts/test/capability-retrieval-expansion-contracts.test.ts
packages/contracts/test/repository-interview-contracts.test.ts
packages/contracts/test/retrieval-expansion-command.test.ts
packages/contracts/test/schema-artifacts.test.ts
packages/ingestion/test/profile-materialization-scope.test.ts
packages/retrieval/src/index.ts
packages/retrieval/src/retrieval-engine.ts
packages/retrieval/src/retrieval-expansion.ts
packages/retrieval/test/retrieval-engine.test.ts
packages/retrieval/test/retrieval-expansion.test.ts
tools/evaluation-harness/src/retrieval/production-generation.ts
tools/evaluation-harness/src/retrieval/production-runner.ts
tools/evaluation-harness/src/retrieval/safe-authority.ts
tools/evaluation-harness/test/retrieval-architecture.test.ts
tools/repository-checks/src/repository-invariants.ts
tools/repository-checks/test/repository-invariants.test.ts
tools/repository-checks/test/temp-repository.ts
tools/repository-checks/test/workflow-policy.test.ts
```

Complete diff review found no evaluation case, relevance, no-result,
equivalence, gold, scorer, baseline output, profile authority, Phase 8
materialization, dependency, lockfile, migration, database, provider, model,
vector, index, cache, search service, ranking, target-codebase, API, MCP, or
Skill change. Milestone 7B remains deferred.

### Milestone 3 discovery-authority correction validation

Before mutation, local and fetched
`origin/feat/21-production-retrieval` were both
`c9ea7de9153d6e9d9ca68fb8599da8c5a7317169`; local and fetched `main` were
both the accepted Phase 8 boundary
`f44ddcee4491e9f1f4680384b07e4e7a92f2bc18`. The only pre-existing worktree
item was unrelated untracked `Gitblocks.docx`, which remained untouched and is
excluded from this change.

The correction-focused command passed 8 files and 78 tests covering the new
authority contract/digests/bounds, schema export, narrow policy and fake
transport over all 150 candidates, preflight/execute effect separation,
existing repository parser regression, lexical normalization/scoring/abuse,
display-name projection, and product/evaluation dependency direction.
`pnpm ingestion:verify` separately passed 30 files and 305 tests and reproduced
the exact catalog digest.

The first authoritative attempt stopped at static lint findings in new code;
the trust-boundary literal checks, void-return style, and null refinement were
corrected without changing behavior. The next attempt reached all 1,887 tests
and found one malformed new prohibited-term test fixture. Replacing it with
the repository's accepted normalized hard-constraint form then exposed an
incorrect zero-total assertion: legitimate authorization description evidence
still scores while the prohibited RBAC term must not. The corrected assertion
proves exactly that boundary. No product authority, metric, threshold, scorer,
gold, or production rule changed in either correction.

The final authoritative `pnpm verify` exited 0 with 124 test files and 1,887
tests passing. It passed formatting, all product and tool builds, lint, all
workspace typechecks, repository checks, every evaluation/retrieval fixture and
validator, contract conformance, taxonomy/expansion/profile/catalog checks,
interview/operator/pre-live validation, architecture, and Secretlint.
Architecture covered 874 modules and 2,926 dependencies with no violation.

The embedded production run retained five active channels and reproduced
prediction digest
`73b5d97190d97bbef15bcbad157d9a60e65153e6ee74a2fe2d4b7cebab14afb8`
and score digest
`6a383a501303fcf4b939e2dd7fa5de130a01a933de196cc0c552c4cfe1d74c8d`.
Macro Recall@10 is `0.615628`; family values are authorization `0.702941`,
audit-logging `0.544203`, background-jobs `0.478897`, rate-limiting `0.526923`,
and webhooks `0.825175`; hit rate is `25/25`, MRR is `0.953333`, and NDCG@10
is `0.792904`. Hard-filter correctness is `4500/4500`, prohibited preservation
is `15/15` micro and `10/10` macro, no-eligible correctness is `30/30`, and all
conflict/lane/negative-control and exact/equivalence duplicate violations are
zero. Query p95/max were `10.536 / 12.621 ms`, full cold-engine p95/max was
`170.219 ms`, search-view heap delta was `551,144` bytes, and retained heap
growth was `1,010,216` bytes.

All required standalone commands passed: runtime, format, repository,
contracts, expansion, evaluation validation/fixtures, retrieval
validation/fixtures/read-only verification, production, architecture,
Secretlint, and the registry-backed audit. The audit reported no known
vulnerability at the moderate threshold. The metadata preflight passed with
`effectAudit` network calls `0`, credential reads `0`, and writes `0`.
`pnpm db:verify` was deliberately not run because this correction explicitly
prohibits database and Docker use; the task-specific minimum validation list
does not include it. No live provider or collection command ran.

The evidence-inclusive rerun also exited 0 with the same 124 files, 1,887
tests, architecture counts, authority/prediction/score digests, quality, and
safety results. Its non-gating timing sample measured query p95/max
`10.729 / 12.988 ms`, full cold-engine p95/max `173.542 ms`, search-view heap
delta `546,720` bytes, and retained heap growth `1,008,864` bytes.
