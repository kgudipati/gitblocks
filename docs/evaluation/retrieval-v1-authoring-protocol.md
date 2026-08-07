# Retrieval-v1 authoring and scoring protocol

## Authority and scope

`retrieval-v1` is an immutable, evaluation-only authority created before any
production retrieval implementation. Its corpus contract is
`retrieval-evaluation-corpus/1.0.0`, and its semantic digest is
`3638596a5c330c3516003beab908b0b5631c84f41d957f78ce2cc1379cc682de`.
It contains exactly 30 retrieval cases and 20 normalization/adversarial cases:
six and four, respectively, for each of authorization, audit logging,
background jobs, rate limiting, and webhooks.

The remaining exact evaluation versions are:

- query: `retrieval-evaluation-query/1.0.0`;
- case classification: `retrieval-case-classification/1.0.0`;
- normalization gold: `retrieval-normalization-gold/1.0.0`;
- clarification gold: `retrieval-clarification-gold/1.0.0`;
- hard-filter projection: `retrieval-hard-filter-projection/1.0.0`;
- relevance gold: `retrieval-relevance-gold/1.0.0`;
- no-result gold: `retrieval-no-result-gold/1.0.0`;
- equivalence authority: `retrieval-equivalence-authority/1.0.0`;
- prediction set: `retrieval-evaluation-prediction-set/1.0.0`;
- scorer: `retrieval-evaluation-scorer/1.0.0`; and
- score report: `retrieval-evaluation-score-report/1.0.0`.

These versions and the JSON Schemas under `schemas/evaluation/retrieval/` are
not product contracts and are not members of the `@gitblocks/contracts`
product-schema catalog. Product packages must not import retrieval corpus
types, schemas, cases, gold, fixtures, equivalence authority, or scorer code.
The evaluation harness consumes accepted contract parsers and DTOs from
`@gitblocks/contracts` and declares `@gitblocks/domain` directly for the
candidate-constraint evaluator and domain profile types. Contracts do not
re-export that evaluator on behalf of evaluation code.

Production candidate generation, hard filtering, retrieval, ranking,
reranking, vector search, recommendation, API/MCP, and profile materialization
remain unimplemented. Milestone 6 owns only evaluation-time deterministic
baselines and the committed content-free baseline report.

## Manifest and physical separation

The corpus has 213 JSON files: one manifest and exactly 212 manifest entries.
The manifest lists the separate case-classification audit authority, the
equivalence authority, all 50 blind queries, 50
normalization-gold files, 20 clarification-gold files, 30 hard-filter
projections, 30 relevance-gold files, and 30 no-result-gold files. Each entry
binds its exact path, document kind, case ID where applicable, and SHA-256 byte
hash. The manifest does not list itself; its documented canonical semantic
projection excludes only `corpusSemanticDigest`. README bytes are not semantic
corpus input.

The current JSON corpus is 495,003 bytes, and its largest JSON file is the
50,425-byte manifest. The boundary allows at most 256 KiB per corpus JSON file,
16 MiB for the complete corpus, 500 files before exact membership checks, depth
64, 50,000 JSON nodes per document, and 500 diagnostics. The exact accepted
profile authority has a separately fixed 4 MiB read cap. Reads require fixed
repository-contained regular files, reject symlinks, duplicate keys, traversal,
aliases, missing or unlisted JSON, and noncanonical membership.

Blind query documents contain only a version, stable case ID, case kind,
assigned family, and an exact `CapabilityQueryInputV1` parsed by the accepted
product parser. They contain no tags, classifications, expected outcome,
relevance grade, winner, recommendation, hard-filter expectation,
clarification answer, ranking hint, reviewer conclusion, URL, or target source.
Summary and success-condition prose are retained inertly; only structured term,
constraint, and candidate-reference records own deterministic meaning.

Case slot and diversity classifications live only in
`audit/case-classification.json`, version
`retrieval-case-classification/1.0.0`, under proposed/not-reviewed provenance.
The dedicated read-only `loadRetrievalBlindQuerySetV1` boundary validates only
manifest bindings and the 50 query documents and returns no gold,
classification, equivalence, or path that exposes those records. Every
Milestone 6 real-corpus baseline consumes only that blind loader; the full
corpus loader is reserved for corpus validation, scoring frozen prediction
sets, and content-free aggregation.

Normalization, clarification, hard-filter, relevance, no-result, and
equivalence authority remain physically separate. Every gold record has
proposed/not-reviewed provenance with null reviewer, review time, and review
reference. Corpus authoring and deterministic validation are contaminated and
do not constitute independent review or measured product quality.

## Cases and gold

Each family has six retrieval slots: exact family/concept, active alias,
narrower feature or adoption-unit intent, same-family candidate comparison,
hard architecture/infrastructure/deployment constraint, and valid no-eligible
or negative-control safety. The complete corpus has five each of exact-family,
active-alias, required, preferred, prohibited, infrastructure-exclusion,
self-hosting/deployment, evidence-needed, no-eligible, and negative-control
safety cases; five controlled same-family comparison slots plus one additional
same-family normalization comparison; and ten equivalence-safety cases.

Each family has four normalization/adversarial cases covering active alias,
intentional ambiguity, required/prohibited contradiction, and a rotating
adversarial condition. Across the corpus these include subjective lightweight,
unsupported adjacency, a Unicode/confusable lookup, same- and cross-family
brand comparison, unclear self-hosting, ambiguous/missing family, unknown
preferred and hard terms, prohibited preservation, and inert summary prose.
Contradiction cases exercise the public `normalizeCapabilityQueryV1` path.

All 50 normalization-gold files are closed projections of accepted normalizer
behavior. They retain only case ID; outcome; primary family; normalized concept
and source-term resolutions; normalized constraint source IDs, modalities,
facets, concepts or preserved declarations, bases, and rule IDs; unresolved
source IDs; clarification sets; notices; and proposed provenance. Corpus
validation runs the accepted normalizer and requires canonical byte-equivalent
projection. It does not implement a second normalization model.

Only the 20 normalization/adversarial cases have clarification gold. Exact
canonical set equality covers outcome, reason codes, source IDs, possible
concept IDs, and terminal unsupported status. Extra clarification is wrong.

For each retrieval case, the harness parses the exact committed 150-profile
authority and evaluates every profile using the accepted single-candidate
constraint evaluator. Product tri-state remains `satisfied`, `conflict`, or
`unresolved`. The evaluation-only lane is `eligible` only for a non-negative
candidate with satisfied hard state, `evidence-needed` only for a non-negative
candidate with unresolved hard state, and `excluded` for conflict or catalog
negative control. Unknown is never treated as satisfied, and evidence-needed
is not viable.

The committed hard-filter record contains only bindings, the complete
150-decision digest, state/lane counts, bounded audit samples, and proposed
provenance. The complete matrix is regenerated in memory. Each audit sample
uses a distinct actual generated entry and a controlled role/reason. The
validator proves eligible, evidence-needed, hard-conflict, cross-family, and
negative-control role semantics from generated state, profile family, and
catalog status. No generic material-edge role exists, and samples never claim
independent review.

Relevance is capability-query relevance only. Grades are 0 irrelevant or
false-positive, 1 adjacent/weak, 2 relevant, and 3 strong direct match. They do
not express viability, repository fit, maintenance, security, ranking,
preference, recommendation, or adoption quality. For each case the complete
judgment universe is mechanically every non-negative-control profile whose
known primary or additional family contains the case family. All members have
exactly one proposed judgment; candidates outside the universe have structural
gain zero. The current 636 judgments comprise 130 grade-0, 62 grade-1, 388
grade-2, and 56 grade-3 records. They were deliberately proposed candidate by
candidate from structured query fields, committed catalog identity,
family/status and curator rationale, exact candidate references, and accepted
taxonomy. No family/slot formula or fixed anchor remains. Narrower and
comparison queries have case-specific differentiation in every family. The
mechanical authoring command does not create or overwrite relevance files and
preserves their bytes.

Real-corpus equivalence means result-level redundancy only: actual fork,
mirror, superseding alias, duplicate catalog identity, or genuinely
interchangeable distribution variant. Generic functional overlap, ecosystem
companions, parent/focused companions, and composable transport/plugin/core
packages are not duplicates. The committed authority currently has zero
defensible groups; zero through 100 groups is valid, and synthetic fixtures
prove metric math. Mechanical authoring preserves the equivalence bytes.
Exactly five retrieval cases—one per family—expect
`no-eligible-candidate`; that result is derived from the hard-filter projection,
not relevance. Relevant unresolved candidates therefore remain possible in a
no-eligible case.

## Predictions and deterministic scoring

A prediction set is a closed discriminated union with exactly one canonical
case prediction for all 50 cases. Every prediction supplies the closed
normalization projection. Each retrieval prediction additionally supplies one
canonical decision for all 150 candidates, zero to ten unique ordered result
occurrences with claimed eligible/evidence-needed lanes, and one explicit
`noEligibleCandidate` boolean. Validation rejects unknown or duplicate cases,
candidates, results, sources, modalities, and concepts; noncanonical order;
incomplete closure; lane disagreement; score/rationale fields; URLs; and target
or artifact content. Duplicate-rate fixtures use a lower-level pure scorer
boundary rather than weakening this public contract.

Eligible retrieval gain requires proposed grade greater than zero, generated
hard state satisfied, and a non-negative-control candidate. The scorer defines:

- Recall@10: unique eligible relevant top-ten candidates divided by all
  eligible relevant candidates in the universe.
- MRR: reciprocal rank of the first unique eligible relevant candidate in the
  top ten.
- NDCG@10: DCG with gain `2^grade - 1`; later exact duplicates have zero gain,
  and IDCG sorts all eligible judgments by descending grade then candidate ID.
- Exact duplicate-result rate: exact occurrences after the first divided by
  all emitted occurrences.
- Equivalence duplicate rate: occurrences whose group appeared earlier divided
  by all emitted occurrences.
- Category coverage: per-family positive-case hit rate and family coverage,
  with exactly five families and no-result-only success excluded.
- Hard-filter correctness: three-way exact accuracy, per-state precision and
  recall, micro counts, and per-family accuracy across exactly 150 decisions
  per retrieval case.
- Top-ten safety: unique generated excluded candidates, with hard conflicts and
  negative controls separate; an evidence-needed result is allowed only in its
  exact lane.
- No-eligible accuracy: exact boolean equality with separate no-result gold;
  emitting evidence-needed does not make the boolean false.
- Clarification accuracy: exact outcome/reason/source/possible-concept equality
  for normalization/adversarial cases.
- Alias correctness: exact source-term-to-concept projection on cases selected
  by the separate audit classification authority, with no unintended concept.
- Prohibited preservation: exactly one predicted record for each prohibited
  source, with exact source-ID set, modality, facet, resolution basis, rule ID,
  concept ID, and canonical term. Extra or duplicate source claims,
  controlled/preserved-declaration substitution, omission, and weakening are
  incorrect.

Every metric serializes numerator, denominator, rounded value, and status.
When a denominator is zero, the value is `null`, status is
`not-applicable`, and the case is excluded from macro averaging. Zero never
becomes 0, 1, NaN, or Infinity. An all-null macro is itself null and
not-applicable. Numeric output uses deterministic six-decimal rounding.

The closed score report contains only authority bindings, counts, numeric
per-case/per-family/macro/micro metrics, safety counts, and a semantic digest.
Its canonical projection excludes only its own digest, so order or numeric
drift changes the report digest. No query prose, relevance reason, reviewer
identity, rationale, artifact text, provider output, or target source is
allowed. Milestone 5 commits no prediction or score report.

`pnpm eval:retrieval:validate` performs read-only corpus, schema, normalizer,
profile, projection, relevance, equivalence, no-result, and provenance closure.
`pnpm eval:retrieval:fixtures` runs only 26 hand-calculated synthetic scorer
fixtures. `pnpm eval:retrieval:score -- --prediction <repository-relative-json-path>`
validates and prints canonical closed score-report JSON without writing. All three are
offline and make no network, provider, model, database, candidate-repository,
artifact-body, target-source, package-registry, or Phase 7 access.

## Deterministic offline baselines and report

Milestone 5 was accepted through correction commit
`4f4c1e4522f7db85d2a0a422b5c78ac8665a4840`. Its independent corpus/scorer
architecture is accepted, but relevance and hard-filter audit provenance
remains proposed/not-reviewed. Baseline scores are development measurements
against that proposed authority, not independently reviewed truth or
production-retrieval quality evidence.

Exact evaluation-only versions are:

- runner: `retrieval-baseline-runner/1.0.0`;
- family-only: `retrieval-family-only-baseline/1.0.0`;
- exact-keyword: `retrieval-exact-keyword-baseline/1.0.0`;
- alias-expanded: `retrieval-alias-expanded-baseline/1.0.0`;
- always-abstain: `retrieval-always-abstain-control/1.0.0`;
- constraint-violating: `retrieval-constraint-violating-control/1.0.0`;
- fixture oracle: `retrieval-fixture-oracle-control/1.0.0`; and
- report: `retrieval-baseline-report/1.0.0`.

These versions and the baseline-report schema remain evaluation-only and never
enter the product-contract schema catalog.

The binding two-phase sequence is:

```text
blind query loading
  -> accepted normalization
  -> safe candidate/profile projection
  -> baseline prediction generation
  -> prediction validation and immutable digest
  -> only then load full gold-bearing corpus
  -> deterministic scoring
  -> aggregate content-free report
```

The closed strategy query view contains only `caseKind`, raw structured terms,
raw structured constraints (`modality`, `facet`, `originalTerm`), normalized
primary family, normalized concept IDs, normalized constraints (`modality`,
`facet`, `resolutionBasis`, `conceptId`, `canonicalTerm`), and resolved
candidate IDs. It contains no case/query/source/reference/condition ID,
assigned corpus family, slot, path, summary/success prose, classification,
audit metadata, or gold. The orchestration layer retains source identities only
to run the accepted normalizer and project its exact prediction, and attaches
the case ID only after strategy output is complete.

The safe candidate view contains only candidate ID, primary/additional family,
structured catalog status, repository owner/name, mapped npm package or null,
and the generated hard state and lane. Those values come only from the parsed
candidate-profile authority and accepted candidate-constraint evaluator.
Catalog rationale, selection sources, documentation/artifact text, interview,
provider/model output, and reviewer notes are never loaded. Ordinary baselines
exclude negative controls and excluded lanes, preserve all 150 generated
decisions exactly, never call unresolved eligible, emit no duplicate, cap
results at ten, and use exact ASCII candidate-ID ties.

Family-only uses only the accepted normalized primary family and orders primary
then additional family matches. Exact-keyword creates exact ASCII keys from
structured input and exact accepted candidate references and matches only full
candidate-ID segments, repository/package identity, and primary/additional
family keys; substring, stemming, morphology, fuzzy/edit-distance, Unicode
folding, transliteration, and semantic matching are prohibited. Alias-expanded
adds only accepted normalized family/concepts/active-alias resolution and exact
resolved references; it never traverses or relearns taxonomy semantics. No
relative performance or minimum Recall/MRR/NDCG requirement applies.

Always-abstain preserves accepted normalization and all generated decisions,
emits no result, and predicts no eligible result for every retrieval case. The
constraint-violating safety control deterministically forges the first actual
negative control and first distinct non-negative hard conflict as
satisfied/eligible, emits both, and must trigger hard-filter, negative-control,
conflict, lane, and applicable no-result errors. The fixture oracle uses only
hand-calculated synthetic data, never loads `retrieval-v1` or the blind loader,
and never creates a real-corpus prediction set.

All five real prediction sets contain 50 canonical predictions and exact 150
decision closure per retrieval case, but no prediction set is committed. The
committed `verification/retrieval-v1/baseline-report.json` retains only exact
authority/tool versions and digests, case counts/denominators, baseline/control
and opaque prediction/score IDs/digests, aggregate and per-family numeric
metrics, family coverage, safety counts, synthetic-oracle summary, the shared
normalization indicator, and its semantic digest. It contains no per-case,
query, source, candidate, result, decision, relevance-reason, classification,
reviewer, rationale, URL, artifact/provider/model, timestamp/machine/runner,
winner/rank/composite/recommendation/threshold/readiness content.

Normalization, clarification, alias, and prohibited-modality metrics partly
measure the shared accepted public normalizer. The report marks them as a
shared component; they are not independent baseline achievements. Candidate
generation and result ordering remain separately visible.

`pnpm eval:retrieval:baselines` prints canonical report JSON and writes
nothing. `pnpm eval:retrieval:baselines:generate` accepts no output path and
writes canonical bounded bytes only to the fixed report path after rejecting
root/parent/report symlink aliases. `pnpm eval:retrieval:verify` is read-only:
it validates corpus and fixtures, repeats prediction generation and scoring,
checks reversed safe-authority order, validates report schema/digest/content,
compares committed bytes, and proves the report path was not changed. All are
offline and use no environment-derived semantics, clock, randomness, network,
database, provider/model, artifact body, or Phase 7 input. Milestone 7 remains
separately authorized: Milestone 7A adds only the dormant, effect-denied
profile-materialization implementation, while Milestone 7B live execution and
evidence remain unauthorized. Neither changes this baseline authority.
