# ADR 0009: Production candidate retrieval

- Status: accepted
- Date: 2026-08-07
- Decision owners: GitBlocks maintainers
- Governing issue:
  [#21 — Phase 9: Establish production candidate retrieval](https://github.com/kgudipati/gitblocks/issues/21)
- Execution plan:
  [Phase 9 production candidate retrieval](../../plans/0021-production-retrieval.md)
- Related decisions:
  [ADR 0001](0001-agent-native-delivery.md),
  [ADR 0002](0002-typescript-workspace-and-toolchain.md),
  [ADR 0003](0003-product-contract-kernel.md),
  [ADR 0004](0004-postgresql-evidence-persistence.md),
  [ADR 0005](0005-public-repository-ingestion.md),
  [ADR 0006](0006-immutable-repository-artifacts.md),
  [ADR 0007](0007-evidence-grounded-repository-interviews.md), and
  [ADR 0008](0008-artifact-first-retrieval-foundation.md)

Independent maintainer rereview accepted this decision and every pre-registered
Milestone 1 gate at commit
`18dae5adf821f0c998c02d4829416d655b9da1a1`. The associated hosted aggregate
failure is accepted as a runner-infrastructure exception: three workers passed,
the remaining deterministic workers were terminated by the hosted-runner
shutdown, and the authoritative local `pnpm verify` passed 115 files and 1,802
tests without a failing assertion. This acceptance authorizes Milestone 2 only;
it does not accept production retrieval quality, the `proposed-not-reviewed`
evaluation gold, a Milestone 2 implementation, or Phase 9 completion.

Independent maintainer rereview accepted Milestone 2 at
`ce533e39588027048a522417782ada98afeb1489`, including its lane-local
exact-identity correction. The latest hosted aggregate failure is accepted as
a runner-infrastructure exception: the complete local authoritative suite
passed, while unchanged workers were terminated under severe hosted-runner
slowdown and the later explicit runner shutdown. This acceptance authorizes
Milestone 3 only; it does not accept the evaluation gold, establish final
production retrieval quality, authorize ranking or search infrastructure, or
complete Phase 9.

The accepted Milestone 2 blind production benchmark measures macro Recall@10
`0.612295`, 25/25 positive-case hits, MRR `0.960000`, and NDCG@10 `0.769561`,
with every zero-tolerance safety metric passing. The macro, audit-logging, and
rate-limiting recall gaps remain explicit Milestone 3 work. These measurements
do not alter the accepted gates, establish Phase 9 completion, or accept the
evaluation gold.

Independent Milestone 3 review accepts the expansion authority, one-hop and
query bounds, constraint preservation, request/result evolution, global
additive integer fusion, lane-local exact identity diversity, gold blindness,
and decisions against prohibited prose, vectors, and search infrastructure as
technically sound. It does not accept Milestone 3 completion. The development
benchmark remains below the macro, audit-logging, and rate-limiting gates, and
the conclusion that candidate-side deterministic authority was exhausted was
premature. The measured limitation is still sparse candidate-owned signal
authority rather than a semantic-recall failure; the conditional vector
trigger remains inactive and Milestone 4 remains blocked.

## Context

Phase 8 established deterministic query normalization, a controlled taxonomy,
an offline 150-candidate deterministic-profile authority, product-owned
single-candidate constraint evaluation, and an independent retrieval
evaluation corpus and scorer. It deliberately did not establish production
retrieval or ranking. Phase 8 is complete within that claim boundary;
Milestone 7B live deterministic population, materialization execute number
five, Docker profile materialization, and live 150-profile population remain
deferred and unauthorized.

The accepted checkout at the start of this decision is
`f44ddcee4491e9f1f4680384b07e4e7a92f2bc18`. The committed profile authority
contains exactly 150 candidates and is 2,051,396 bytes as formatted JSON. It
has 600 known, 210 not-applicable, 3,240 unknown, and zero conflict field
states. The only fields known for every candidate are catalog role/status,
capability family, repository identity, and package identity mapping. This is
sufficient for a bounded deterministic retrieval core, but it is not final
live coverage or ranking readiness.

The `retrieval-v1` evaluation authority has 30 retrieval cases—six per family,
25 positive and five no-eligible-candidate cases—and 20 normalization and
adversarial cases. Its relevance and audit provenance remains
`proposed-not-reviewed`. The current development baselines are measurement
evidence, not production-quality claims:

| Baseline       | Macro Recall@10 | Positive hit rate | MRR      | NDCG@10  |
| -------------- | --------------- | ----------------- | -------- | -------- |
| family-only    | 0.532295        | 0.920000          | 0.790000 | 0.626085 |
| exact-keyword  | 0.510145        | 0.800000          | 0.760000 | 0.622330 |
| alias-expanded | 0.612295        | 1.000000          | 0.960000 | 0.769561 |

The current fixed development corpus has a mathematical macro Recall@10
ceiling of 0.656249 when its generated hard-filter projection and at most ten
results are held constant. Thresholds therefore cannot responsibly demand a
value such as 0.70 without changing the task. This decision pre-registers a
demanding but reachable threshold relative to that ceiling and prohibits
changing corpus gold, fixtures, relevance judgments, or baseline output merely
to pass it.

## Decision

### Phase and semantic boundary

Project Phase 9 corresponds to Phase 11 — Retrieval Engine in the original
end-to-end strategy. It owns only the question:

> Which candidates are plausible enough to deserve deeper comparison?

Phase 10 production ranking owns the different question:

> Which retrieved candidate best fits this particular target codebase?

The production flow is fixed as:

```text
CapabilityQueryNormalizationResultV1
        ↓
require normalized outcome
        ↓
existing product-owned hard constraint evaluation
        ↓
exclude conflicts / ordinary negative controls
        ↓
broad retrieval channels
        ↓
normalize / combine candidate signals
        ↓
deduplicate / diversify
        ↓
bounded retrieval result
```

The result is candidate retrieval. It is not recommendation, an adoption-fit
assessment, codebase-conditioned fit, winner selection, integration planning,
or ranking. Request admission rejects a non-null repository fingerprint
reference preserved on the normalization result. Phase 9 neither reads a
target repository nor changes `RepositoryFingerprintV1` semantics.

### Product package ownership

Milestone 2 introduces exactly one narrow product package:

```text
packages/retrieval
@gitblocks/retrieval
```

Milestone 1 created no package or TypeScript implementation. The Milestone 2
package is a pure, injected, in-process retrieval core. Its allowed workspace
dependencies are `@gitblocks/contracts` and `@gitblocks/domain`; contracts
already depend on domain, and retrieval may also depend directly on domain to
invoke the existing constraint evaluator without duplicating it. The direction
is:

```text
@gitblocks/domain ← @gitblocks/contracts
         ↑                 ↑
         └──── @gitblocks/retrieval
```

The package does not own I/O, environment reads, singleton state, migrations,
transport, application use cases, or persistence ports. It must not depend on
evaluation tooling, retrieval gold, baseline fixtures, persistence, ingestion,
an API framework, MCP, an Agent Skill, a model provider, repository interviews,
or a ranking package.

The allowed evaluation direction is:

```text
tools/evaluation-harness
        ↓
@gitblocks/retrieval
        ↓
@gitblocks/contracts / @gitblocks/domain
```

`@gitblocks/retrieval` must never import evaluation schemas, cases, gold,
equivalence records, baselines, scorers, or harness utilities.

### Candidate retrieval discovery metadata authority

Milestone 3 adds one separate soft-signal product contract root:

```text
CandidateRetrievalMetadataAuthorityV1
candidate-retrieval-metadata-authority/1.0.0
```

It is not a deterministic profile, hard-filter authority, ranker, evaluation
authority, repository interview, or search index. The collection and
dependency direction is fixed:

```text
provider / ingestion tooling
        ↓
candidate retrieval metadata authority
        ↓ injected into
@gitblocks/retrieval

tools/evaluation-harness
        ↓
@gitblocks/retrieval
```

Retrieval never imports ingestion or performs provider I/O. The authority is
separate from `catalog/public-v1/candidate-profile-authority.json`; the Phase 8
profile digest and evaluation hard-filter bindings do not change. This avoids
silently turning retrieval-quality enrichment into hard-filter authority.

The future canonical artifact path is
`catalog/public-v1/candidate-retrieval-metadata-authority.json`. It contains
exactly the 150 `public-v1` candidate IDs and case-insensitive repository
identities once each, sorted by candidate ID. Each record retains canonical
GitHub owner/repository, nullable repository description, sorted unique
repository topics, nullable primary language, and a content digest. Description
is bounded at 500 code units, topics at 20 records and 100 code units each,
primary language at 100 code units, and the complete formatted artifact at
1,048,576 UTF-8 bytes. Control/bidi text is rejected at the authority boundary.

The root binds contract and authority versions, catalog version/digest, narrow
and source provider-policy versions/digests, exact source operation,
`collectedAt`, derived snapshot ID, sorted candidates, and a semantic digest.
The source-record digest covers retained identity and metadata. The root digest
covers all semantic provenance, `collectedAt`, and candidate records, excluding
only the derived snapshot ID and digest itself. GitHub repository metadata is a
mutable source; a successfully collected and digest-bound artifact is an
immutable snapshot, not a claim that its source is immutable.

Collection reuses the accepted Phase 8 `github-repository-metadata` request and
parser boundary. The narrow policy is
`candidate-retrieval-metadata-provider-policy/1.0.0`, digest
`7e12f31e079fe05dad33569408885085bc2dd5cd85036318a594a7e9bd8751ce`,
bound to Phase 8 provider policy digest
`0945ebd862d0a1b5f622c4f10f60b2c0e713fb127cc5dea5668be5cc40c96ede`.
Only HTTPS `GET api.github.com/repos/{owner}/{repository}` is allowed: 150
logical requests, at most 450 attempts, concurrency three, 2 MiB and 100,000
JSON-node response bounds, 10-second request timeout, two redirects, three
attempts, 90-second candidate deadline, and one-hour run deadline. The future
credential name is `GITBLOCKS_RETRIEVAL_METADATA_GITHUB_TOKEN`. Releases,
tags, license, community profile, commits, files, npm, advisories, artifacts,
database, Docker, and model operations are prohibited.

The future lexical consumer is pre-registered as
`approved-metadata-lexical/1.0.0` and remains inactive until an independently
reviewed real snapshot exists. Query terms may come only from normalized
capability concept IDs, active taxonomy aliases for those concepts, reviewed
one-hop expansion targets, and controlled normalized constraint canonical
terms. Candidate terms may come only from description, topics, and primary
language. ASCII lowercase alphanumeric tokenization creates exact one-to-four
token `-`-joined phrases with a 32-code-unit token limit. Matches are exact,
deduplicated normalized terms. Topics score 300, description phrases 100, and
primary language 100 only when query-authorized; a term uses its strongest
source once and the component cap is 900. The rule is global and fixed before
live collection.

The metadata consumer authenticates a supplied snapshot against a separately
injected caller-owned binding: authority and catalog identity, both provider
policy identities, source operation, and the complete candidate-to-canonical-
repository projection. Internal snapshot digests establish self-integrity but
cannot substitute for this external authority binding. Retrieval owns the
comparison contract and imports neither ingestion policy artifacts nor
evaluation tooling.

Future canonical publication uses the fixed sibling staging path
`catalog/public-v1/.candidate-retrieval-metadata-authority.json.staging`.
Complete validated bytes are created exclusively and synced there before a
same-directory hard link publishes them without replacement; the staging link
is then removed and the directory synced. Both final and staging paths must be
absent before credential or network access. A read-only
`pnpm retrieval:metadata:validate` command independently rechecks the fixed
snapshot against the catalog, both accepted policies, the source operation,
repository closure, record/root digests, snapshot ID, bounds, and canonical
ordering. The validator is intentionally outside ordinary verification until
a real snapshot is independently accepted.

The existing `repository-identity` field authorizes `displayName`; candidate
identity therefore projects it under the same general lexical identity rule.
The retrieval result, algorithm, and candidate-identity channel advance to
`1.2.0`; request `1.1.0` remains compatible. This completeness correction is
semantic, not benchmark-tuned.

### Additive product contracts

Milestone 2 adds exactly two transport-neutral product contract roots to
`@gitblocks/contracts`:

- `CandidateRetrievalRequestV1`; and
- `CandidateRetrievalResultV1`.

Nested candidate, evidence-needed, matched-field, channel-provenance,
component, diagnostic, and authority-binding schemas are defined once within
that contract family rather than exported as competing root DTOs. TypeBox is
the only schema source; public static types derive from it, unknown input uses
the safe parser, and deterministic JSON Schema export follows ADR 0003.
Evaluation schemas are not reused as product contracts.

The request carries one complete validated
`CapabilityQueryNormalizationResultV1`, exact catalog/taxonomy/profile/rules
bindings, and explicit eligible and evidence-needed limits from 1 through 10.
There is no implicit default. A request is rejected before candidate work when
the normalization outcome is not `normalized`, the primary family is absent,
the relevant authority bindings disagree, or any contract invariant fails.

The result has separate `eligibleCandidates` and
`evidenceNeededCandidates` arrays. Each is bounded by its request limit and by
an absolute V1 maximum of ten; no more than 20 candidates can be returned in
total. Every candidate record contains only bounded retrieval information:

- candidate ID and the explicit `eligible` or `evidence-needed` lane;
- matched controlled concepts and known deterministic-profile fields;
- bounded retrieval-channel provenance;
- integer deterministic retrieval score and component contributions used only
  to order plausible candidates;
- material unresolved hard-constraint evaluations for the evidence-needed
  lane; and
- authority, algorithm, channel, expansion, and diversity version/digest
  bindings sufficient to reproduce the result.

The result also includes a closed `preRetrievalLaneCounts` diagnostic with
exactly `eligible`, `evidence-needed`, and `excluded` non-negative integer
counts. It is calculated across the complete bound profile authority after
domain-owned hard-constraint evaluation and application of catalog
negative-control exclusion, but before retrieval-channel matching, fusion,
deduplication, diversity, or truncation. `eligible` counts satisfied
non-negative-control candidates; `evidence-needed` counts unresolved
non-negative-control candidates; and `excluded` counts conflicts and catalog
negative controls. The three counts sum to the number of profiles in the
bound authority.

These counts do not expand the bounded candidate arrays or expose the complete
per-candidate decisions. Other bounded diagnostics cover candidates examined,
hard states, negative controls excluded, channels run, deduplication, diversity
suppression, and truncation. Diagnostics are safe product output, not
evaluation scores or gold labels. The contract exposes no recommendation,
target-codebase fit, adoption-fit score, winner, integration advice, hidden
universal repository-quality score, or ranking concept.

Milestone 3 evolves the two existing contract families from `1.0.0` to
`1.1.0` and the deterministic retrieval algorithm from `1.0.0` to `1.1.0`.
This is a coordinated additive minor evolution on the unmerged, pre-public
Phase 9 branch: request and result authority bindings now require the active
expansion version and semantic digest; result diagnostics expose only bounded
expansion counts; and identity-channel provenance may expose bounded matched
expansion-edge IDs. It does not create another request or result root. The
`candidate-identity` and `package-identity` channels advance to `1.1.0` because
they consume expansion terms; family, taxonomy-concept, and structured-profile
channels remain `1.0.0`.

The Milestone 3 authority correction keeps request `1.1.0`, advances result
and deterministic algorithm to `1.2.0`, and advances candidate identity to
`1.2.0` for the accepted display-name identity projection. Package identity
remains `1.1.0`. The separate metadata authority is the one additional product
root described above; it is injected soft-signal authority and is not embedded
in the current request/result until a real snapshot is independently accepted.

### Hard constraints and retrieval lanes

`@gitblocks/domain` remains the only authority for evaluating one normalized
query against one deterministic profile. Production retrieval calls
`evaluateCandidateConstraints` once per considered candidate and consumes its
result. It does not copy the evaluation harness hard-filter projection or add
a second interpretation of constraint facets.

The lane rules are exact:

- `overallHardState = conflict`: exclude the candidate. It must never appear
  in either returned production lane or as an ordinary eligible candidate.
- `overallHardState = unresolved`: never silently treat the candidate as
  eligible. It may appear only in `evidence-needed`, with every material
  unresolved required or prohibited evaluation retained in bounded structured
  form.
- `overallHardState = satisfied`: the candidate may enter `eligible` only when
  it is not a catalog negative control.
- catalog negative controls: exclude them from both production lanes. There is
  no production request flag that enables them. The evaluation harness may
  continue to inject or inspect them only through explicitly marked
  evaluation/safety execution.
- preferred constraints never change a hard lane. They may supply a soft
  retrieval signal only after the hard state is established.

No soft signal can cross a lane or override a hard result. This includes
popularity, lexical match, taxonomy match, semantic similarity, repository
stars, package downloads, documentation similarity, a future vector score, or
any other channel. Hard-safety correctness is an invariant, not a score
weight.

### Authority read set and access pattern

The retrieval package consumes already parsed and validated taxonomy
and deterministic-profile authorities through explicit constructor or
function inputs. The pure query operation performs no filesystem, database,
network, provider, or model access.

The retrieval layer reads only these profile values directly:

| Purpose                               | Profile authority fields                                                                                                                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| negative-control safety gate          | `catalog-role-status`                                                                                                                                                                                                             |
| family generation                     | `capability-family`                                                                                                                                                                                                               |
| exact identity and package generation | `repository-identity`, `package-identity-mapping`                                                                                                                                                                                 |
| structured broad retrieval            | `adoption-unit-type`, `capability-variants-features`, `repository-discovery-metadata`, `language-ecosystem`, `required-infrastructure`, `optional-infrastructure`, `deployment-self-hosting`, `operational-complexity-primitives` |

Only `known` values may create a positive signal. `unknown`,
`not-applicable`, and `conflict` are never tokenized or interpreted as a
match. The complete profile is also passed unchanged to the domain constraint
evaluator; ownership of any hard-filter field read therefore stays in domain.
Package publication/version, runtime, framework, datastore, license,
repository state, maintenance, release, security, documentation, CI, artifact,
and package-linkage fields are not initial retrieval signals. They may only be
added by a reviewed version change that respects their profile-registry
intended use and the authority actually present.

At the current corpus, the engine may build one immutable in-memory search view
from all 150 profiles and scan at most 150 candidates once per query. Results
must not depend on the input profile ordering.

### V1 retrieval channels and milestone placement

The smallest useful deterministic production combination is:

1. `capability-family`: exact primary and additional controlled family match;
2. `taxonomy-concept`: exact normalized controlled concepts matched only to
   known controlled profile concept fields;
3. `candidate-identity`: exact normalized candidate ID and repository
   owner/name/full-name tokens, including resolved named-candidate references;
4. `package-identity`: exact normalized scoped/unscoped package identity and
   resolved package references;
5. `structured-profile`: exact matching over the known broad-retrieval fields
   listed above; and
6. `approved-metadata-lexical`: bounded lexical matching only over a future
   explicitly injected, versioned, repository-owned metadata authority.

Milestone 2 implements channels 1–5, minimal deterministic union/fusion,
provenance, bounds, and lane safety as one vertical slice. Milestone 3 retains
those five active channels. Channel 6 is implemented and tested offline but
remains inactive because no reviewed real metadata snapshot exists. The future
authority uses only description, topics, and primary language from the
accepted GitHub repository metadata response. Phase 6 artifact manifests bind
selections and receipts rather than retained artifact bodies, and catalog
rationale is curator selection context rather than candidate-owned retrieval
evidence. Historical completion, interview, catalog-rationale, evaluation
prose, popularity, package downloads, and arbitrary repository bodies are not
lexical inputs.

Package identity is the complete initial package channel. Broader package
metadata is deferred because the current profile authority has no approved
known keyword/description authority, and package publication/version is not a
broad-retrieval field in the accepted registry. Milestone 3 may add bounded
structured package metadata only if a reviewed product authority and intended
use exist and benchmark ablation shows that the signal closes an accepted
recall gap. It cannot be recovered from historical provider prose.

These channel scores order retrieval plausibility only. They do not estimate
repository-specific fit or general project quality.

### Controlled query expansion

The taxonomy authority remains the authority for canonical concept and alias
resolution. Broader retrieval expansion is the distinct product-owned,
versioned generated authority
`catalog/capability-retrieval-expansion/1.0.0`. It binds taxonomy `1.0.0` and
taxonomy semantic digest
`838fa85b2e6937866854b6f733fe7045cf49d5f811cb5e4a8d503bfbd76a61c9`.
Its human-reviewable source deterministically generates 144 directed edges
across 49 source concepts: 47 active taxonomy-alias edges and 97 proposed
related-identity-term edges pending Milestone 3 review. The generated semantic digest is
`1435521e117e2af18ec55bbf1f30e3f5d2f48fe07d54f0c657917ff027086f4a`.
Every edge carries its type, rationale, and taxonomy source reference.

Expansion is one hop, at most eight terms per source concept and 32 expanded
terms per query. Rules are deterministic and may add only soft candidate
generation terms. They may never remove, rewrite, weaken, or infer required or
prohibited constraints, deployment requirements, license requirements, or
user-confirmed exclusions. A constraint stays bound to its original source
identity and modality. Expansion requires no LLM and cannot call one.

Milestone 3 applies expansion only to exact, bounded candidate/repository and
package identity terms. It never free-text stringifies profiles or consumes
candidate descriptions. Original normalized concepts are retained, targets
are never recursively traversed, source and authority order use explicit ASCII
comparators, and deterministic truncation keeps the first 32 canonical edges.
The request and result bind the expansion version and digest.

### Deterministic fusion

Milestone 3 retains the Milestone 2 global integer components: primary family
`200`, additional family `25`, exact taxonomy concept `400` per concept capped
at `1,200`, exact candidate/repository reference `1,000`, exact package
reference `900`, and known structured-profile concept `300` capped at `900`.
Each distinct source concept matched through bounded identity expansion adds
`100` to its candidate-identity or package-identity component, with each such
channel capped at `2,000`. Candidate score is the integer sum of active channel
components. Ordering is descending score followed by ASCII candidate ID. The
rule is family- and candidate-independent and represents retrieval
plausibility only.

### Deduplication and diversity

V1 applies deterministic identity-based diversity after signal fusion and
before truncation:

- candidate IDs must be unique in the input authority and output;
- exact repository identity and exact package identity each form an identity
  group;
- all channel provenance for a repeated identity is merged into one candidate
  record;
- at most one candidate per exact identity group appears in each lane;
- the representative is the candidate with the larger integer retrieval
  score, then ASCII candidate ID as the final tie-breaker; and
- suppressed candidates are deterministically backfilled from the next
  distinct group until the lane limit or candidate pool is exhausted.

Forks are grouped only when a reviewed product authority contains an exact
known upstream identity that is approved for retrieval diversity. The current
profile authority has no such known data, so V1 does not infer fork lineage
from names, URLs, text, or repository history. Near-equivalence is disabled
until a separate product-owned reviewed equivalence authority exists. The
evaluation-only `retrieval-v1/equivalence.json`—currently with zero groups—is
never imported into product code. No semantic equivalence is fabricated.

### Evaluation integration and acceptance authority

Milestone 2 provides a harness-side adapter that executes the real production
package against blind `retrieval-v1` inputs and maps its two bounded product
lanes into the existing closed prediction schema. The existing Phase 8
ordinary-lane rule is based on the complete safe post-hard-filter candidate
pool, not retrieval success:

```text
const noEligibleCandidate =
  result.preRetrievalLaneCounts.eligible === 0

const ordinaryResults =
  noEligibleCandidate
    ? result.evidenceNeededCandidates
    : result.eligibleCandidates
```

If the pre-retrieval eligible count is nonzero but production retrieval returns
no eligible candidates, the adapter emits `noEligibleCandidate = false` and an
empty ordinary result list. Recall and hit-rate then record a retrieval failure.
Returned-array emptiness must never be reinterpreted as a no-eligible outcome.
When the pre-retrieval eligible count is zero, the adapter emits
`noEligibleCandidate = true` and maps the bounded production evidence-needed
lane into ordinary evaluation results.

`RetrievalCasePrediction.candidateDecisions` still contains one entry for every
candidate in the bound authority. The harness obtains those complete decisions
from its existing generated hard-filter projection, which delegates constraint
semantics to product-owned `evaluateCandidateConstraints`; it does not obtain
them from `CandidateRetrievalResultV1`. The production result remains bounded,
the production package does not import that evaluation-side projection, and no
hard-filter rule is copied into retrieval.

This preserves the scorer's existing prediction contract without changing the
scorer or Phase 8 schemas. The existing independent scorer remains the sole
metric authority; Phase 9 creates no second production-specific scorer.
Production code never receives case classifications, relevance, no-result
gold, equivalence gold, baseline outputs, or score reports.

The current `proposed-not-reviewed` gold cannot authorize Phase 9 closure.
Before the final Milestone 4 benchmark, an independent maintainer who is not
the retrieval implementer and did not author the relevant corpus records must
review:

- all 30 retrieval queries and all 636 relevance judgments;
- all 30 no-result records;
- all 120 generated hard-filter audit samples;
- the zero-group real-corpus equivalence claim; and
- the exact corpus, taxonomy, catalog, profile-authority, and equivalence
  digests used for acceptance.

Acceptance is recorded separately as a content-free evaluation-only review
record under `verification/retrieval-v1/`; it identifies reviewer, date,
review reference, bound digests, scope counts, and explicit verdict. It does
not mutate, relabel, or replace gold and is not a scorer. Any rejected judgment
is corrected through a separately reviewed corpus-authoring change before a
new acceptance record; it is never changed to accommodate production output.

### Pre-registered safety gates

The following are zero-tolerance Phase 9 completion gates against the exact
independently accepted `retrieval-v1` authority:

| Gate                                               | Required value                               |
| -------------------------------------------------- | -------------------------------------------- |
| candidate hard-filter correctness                  | 4,500 / 4,500 = 1.000000                     |
| retrieval-case hard-filter correctness             | 30 / 30 = 1.000000                           |
| top-10 hard-conflict violations                    | 0                                            |
| top-10 lane errors                                 | 0                                            |
| top-10 negative-control leaks                      | 0                                            |
| negative controls in either production result lane | 0                                            |
| prohibited-constraint preservation, micro          | 15 / 15 = 1.000000                           |
| prohibited-constraint preservation, macro          | 10 / 10 = 1.000000                           |
| no-eligible-candidate correctness, all cases       | 30 / 30 = 1.000000                           |
| explicit no-eligible cases classified correctly    | 5 / 5 = 1.000000                             |
| exact duplicate rate                               | 0.000000                                     |
| controlled-equivalence duplicate rate              | 0.000000 for every applicable accepted group |

The 4,500 / 4,500 gate validates the complete domain-authoritative generated
candidate-decision projection against the independently reviewed evaluation
authority. It is not, by itself, proof that production retrieval integrates
with that authority correctly. Milestone 2 separately proves exact agreement
between production pre-retrieval lane counts and the generated projection,
returned-lane membership, exclusions, and evaluation-adapter lane selection.

Every returned `eligible` record must bind a satisfied domain hard state and a
non-negative-control candidate. Every returned `evidence-needed` record must
bind an unresolved domain hard state, a non-negative-control candidate, and at
least one disclosed material unresolved required or prohibited evaluation.

### Pre-registered retrieval-quality gates

The accepted production prediction set must meet all of these values without
changing the corpus to fit the algorithm:

| Gate                      | Required value     |
| ------------------------- | ------------------ |
| macro Recall@10           | at least 0.625000  |
| positive-case hit rate    | 25 / 25 = 1.000000 |
| authorization Recall@10   | at least 0.647647  |
| audit-logging Recall@10   | at least 0.564783  |
| background-jobs Recall@10 | at least 0.438207  |
| rate-limiting Recall@10   | at least 0.543462  |
| webhooks Recall@10        | at least 0.759021  |
| family coverage           | 5 / 5 = 1.000000   |

The family floors are 90% of each fixed corpus's theoretical top-10 ceiling.
The macro threshold is approximately 95.2% of the fixed 0.656249 ceiling and
improves on the strongest development baseline without pretending that a
top-10 result can retrieve more than ten items.

MRR and NDCG@10 remain secondary retrieval-order diagnostics, not evidence of
production ranking. They must still remain at or above 0.900000 and 0.750000,
respectively, to prevent recall gains from making the bounded list materially
less useful. Any future change to a gate requires an independently reviewed
ADR/plan amendment made before observing the replacement algorithm.

### Performance and determinism budgets

The initial benchmark uses Node 24.18.0, the exact 150-profile authority, the
30 fixed normalized retrieval cases after independent authority acceptance, a
prevalidated in-memory authority, and no I/O. It records raw samples and
environment identity. After 100 warm-up queries, 1,000 round-robin measured
queries must satisfy:

| Budget                                            | Required value                                           |
| ------------------------------------------------- | -------------------------------------------------------- |
| query latency                                     | p95 no more than 20 ms; maximum no more than 50 ms       |
| one-time immutable search-view build              | p95 no more than 100 ms                                  |
| search-view incremental heap                      | no more than 16 MiB                                      |
| retained heap growth after 1,000 repeated queries | no more than 2 MiB with explicit GC measurement          |
| candidates constraint-evaluated                   | no more than 150 per query, each at most once            |
| retrieval channels executed                       | no more than six, each at most once per query            |
| returned eligible candidates                      | no more than 10                                          |
| returned evidence-needed candidates               | no more than 10                                          |
| returned candidates total                         | no more than 20                                          |
| repeated-run determinism                          | 100 / 100 byte-identical serializations per case         |
| authority-order determinism                       | identical output for 20 fixed profile-order permutations |
| fresh-process determinism                         | identical output digests across 10 fresh processes       |

The core must not mutate input authorities. All ordering uses explicit
comparators; integer component scores and ASCII candidate ID are the final
tie-break chain. Wall-clock time, randomness, locale-dependent collation,
network data, process environment, and iteration order are not result inputs.

### Conditional infrastructure triggers

The initial implementation is an in-memory deterministic core. There is no
migration `0005`, retrieval table, speculative index, vector dependency,
cache, or search service in Phase 9 unless a trigger below is satisfied and a
new reviewed decision authorizes it.

Persistent or PostgreSQL search indexes may be reconsidered only when either
the candidate authority exceeds 2,000 candidates or the fixed representative
benchmark exceeds the 20 ms p95, 50 ms maximum, or 16 MiB search-view budget in
three consecutive clean runs after algorithmic and allocation corrections.
The evidence must name the slow read pattern, compare the in-memory and
proposed index paths, and include query plans where PostgreSQL is proposed.

PostgreSQL full-text support may be considered only after an approved bounded
lexical authority exists and an ablation shows its scan causes the measured
latency breach. Caching may be considered only when representative production
telemetry shows at least 30% exact normalized-query-digest reuse within one
authority freshness window and the uncached path misses an accepted latency
SLO. A cache key must bind the query, taxonomy, profile, algorithm, expansion,
and channel digests and have explicit invalidation and memory bounds.

A dedicated search service may be considered only after an approved
application load model and SLO exist and both the in-process and reviewed
PostgreSQL alternatives fail that SLO in three representative runs. Service
operations, retries, tenancy, authentication, and deployment are separate
decisions.

Vector retrieval, embeddings, and pgvector are reconsidered only when all of
the following are true:

1. the independently accepted deterministic/lexical system misses macro
   Recall@10 0.625000 or at least one family floor;
2. blinded error analysis attributes at least ten missed eligible relevance
   judgments across at least three families, and at least 20% of all misses,
   to semantic mismatch rather than hard filtering, bad authority, or ordering;
3. controlled taxonomy, aliases, structured matching, approved lexical
   matching, expansion, fusion, and diversity corrections have been exhausted;
4. an offline blind spike improves macro Recall@10 by at least 0.030000 absolute
   or closes every failed family floor, with every zero-tolerance safety gate
   unchanged and the accepted performance budget met; and
5. a superseding ADR approves the embedding model/version, input authority,
   provenance, refresh, persistence, deletion, cost, privacy, and fallback.

Failure to meet these conditions is evidence against introducing vectors, not
a reason to weaken the trigger.

### Observability boundary

The pure package returns bounded structured diagnostics and provenance but
does not log, trace, or emit metrics itself. A later application host will map
them to redacted telemetry under the observability policy. Candidate IDs,
authority digests, channel IDs, counts, lane counts, duration, and stable error
codes are permitted; raw query prose, repository content, environment values,
secrets, and unbounded match text are not. Phase 9 adds no running production
path, dashboard, alert, or SLO endpoint.

### Milestone sequence and review gates

The four milestones are fixed:

1. retrieval architecture and acceptance authority;
2. deterministic production retrieval vertical slice;
3. recall, fusion, and diversity; and
4. production proof and Phase closure.

No later milestone begins without independent review of the preceding
milestone. Milestone 1 contains governance and architecture only. It creates
no production retrieval code or contracts.

## Consequences

### Positive

- Hard constraints remain a product-domain correctness boundary rather than a
  tunable retrieval feature.
- Unresolved evidence remains visible without being mislabeled as eligibility.
- One product contract can later serve HTTP or MCP without transport schema
  duplication.
- The independent harness measures real production retrieval while production
  remains blind to gold.
- The committed 150-candidate profile authority can start with a simple
  bounded in-memory implementation.
- Infrastructure and semantic search require measured evidence instead of
  becoming default scope.

### Costs and limitations

- Current profile coverage means several structured channels will initially
  produce few or no signals; unknowns must remain honest.
- Maintaining explicit rule, expansion, channel, and authority versions adds
  contract work.
- Zero-tolerance lane safety and order independence require property and abuse
  tests in addition to ordinary examples.
- The current evaluation gold must receive independent review before it can
  support a Phase 9 quality claim.
- Retrieval priority ordering is useful for a bounded list but cannot answer
  the Phase 10 ranking question.

## Rejected alternatives

### Put retrieval inside the evaluation harness

Rejected because product behavior would depend on gold-bearing tooling and
could not be consumed safely by later transports.

### Put retrieval in domain or persistence

Rejected because list-level generation, fusion, diversity, and bounds are a
coherent product capability above single-candidate invariants and are neither
pure domain vocabulary nor concrete database adaptation.

### Reuse evaluation schemas as product DTOs

Rejected because predictions and score records contain evaluation semantics,
not a stable transport-neutral product result.

### Treat unresolved as eligible

Rejected because it converts absence of evidence into satisfaction and breaks
the accepted Phase 8 tri-state authority.

### Add ranking or target fingerprints to retrieval

Rejected because it conflates candidate plausibility with target-specific
adoption fit and would pull Phase 10 into Phase 9.

### Require embeddings, PostgreSQL search, caching, or a search service

Rejected for V1 because the 150-candidate authority fits a bounded in-memory
scan and no accepted measurement demonstrates the added infrastructure solves
a current failure.

## Phase 9 completion condition

Phase 9 is complete only when GitBlocks has one transport-neutral production
retrieval implementation that converts a normalized capability request into a
bounded, diverse, deterministic high-recall candidate set; preserves every
hard constraint and negative control; explicitly represents unresolved
evidence; exposes retrieval provenance; passes the independently accepted
retrieval benchmark; and satisfies measured performance budgets at the current
corpus size.

Vectors, persistent search infrastructure, target-codebase ranking, and
external APIs are not required unless activated by an explicitly
pre-registered measured failure. Milestone 1 acceptance authorizes the
Milestone 2 vertical slice; each later milestone still requires independent
review of the preceding implementation.
