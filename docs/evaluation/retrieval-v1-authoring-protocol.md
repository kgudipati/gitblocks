# Retrieval-v1 authoring and scoring protocol

## Authority and scope

`retrieval-v1` is an immutable, evaluation-only authority created before any
production retrieval implementation. Its corpus contract is
`retrieval-evaluation-corpus/1.0.0`, and its semantic digest is
`e133c0fa00b6063e7360ce5ebfdf27893f72ee5ca5e39fbe5d82c1e944831917`.
It contains exactly 30 retrieval cases and 20 normalization/adversarial cases:
six and four, respectively, for each of authorization, audit logging,
background jobs, rate limiting, and webhooks.

The remaining exact evaluation versions are:

- query: `retrieval-evaluation-query/1.0.0`;
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
The evaluation harness consumes only accepted public product exports.

Production candidate generation, hard filtering, retrieval, ranking,
reranking, vector search, recommendation, and baseline execution remain
unimplemented. Milestone 6 exclusively owns deterministic baselines and any
committed baseline report.

## Manifest and physical separation

The corpus has 212 JSON files: one manifest and exactly 211 manifest entries.
The manifest lists the equivalence authority, all 50 blind queries, 50
normalization-gold files, 20 clarification-gold files, 30 hard-filter
projections, 30 relevance-gold files, and 30 no-result-gold files. Each entry
binds its exact path, document kind, case ID where applicable, and SHA-256 byte
hash. The manifest does not list itself; its documented canonical semantic
projection excludes only `corpusSemanticDigest`. README bytes are not semantic
corpus input.

The current JSON corpus is 493,468 bytes, and its largest JSON file is the
50,222-byte manifest. The boundary allows at most 256 KiB per corpus JSON file,
16 MiB for the complete corpus, 500 files before exact membership checks, depth
64, 50,000 JSON nodes per document, and 500 diagnostics. The exact accepted
profile authority has a separately fixed 4 MiB read cap. Reads require fixed
repository-contained regular files, reject symlinks, duplicate keys, traversal,
aliases, missing or unlisted JSON, and noncanonical membership.

Blind query documents contain only a version, stable case ID, case kind,
assigned family, controlled tags, and an exact `CapabilityQueryInputV1` parsed
by the accepted product parser. They contain no expected outcome, relevance
grade, winner, recommendation, hard-filter expectation, clarification answer,
ranking hint, reviewer conclusion, URL, or target source. Summary and success
condition prose are retained inertly; only structured term, constraint, and
candidate-reference records own deterministic meaning.

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
uses actual generated entries and controlled roles/reasons to cover every
present state plus cross-family, negative-control, and material-edge behavior;
it never claims independent review.

Relevance is capability-query relevance only. Grades are 0 irrelevant or
false-positive, 1 adjacent/weak, 2 relevant, and 3 strong direct match. They do
not express viability, repository fit, maintenance, security, ranking,
preference, recommendation, or adoption quality. For each case the complete
judgment universe is mechanically every non-negative-control profile whose
known primary or additional family contains the case family. All members have
exactly one proposed judgment; candidates outside the universe have structural
gain zero. The current 636 judgments comprise 0 grade-0, 194 grade-1, 404
grade-2, and 38 grade-3 records. The absence of grade-0 records within this
family-derived universe does not turn outside-family or negative-control
candidates into relevant candidates.

Five proposed equivalence groups use four controlled relationship kinds:
ecosystem companion, ecosystem implementation variant, functional overlap,
and parent/focused companion. Membership is based only on explicit committed
catalog curation, includes no candidate twice, and is not a product profile
fact. Exactly five retrieval cases—one per family—expect
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
- Alias correctness: exact source-term-to-concept projection on tagged cases,
  with no unintended concept.
- Prohibited preservation: exact source constraint, prohibited modality, and
  controlled concept or preserved-declaration basis without omission or
  weakening.

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
`pnpm eval:retrieval:fixtures` runs only 20 hand-calculated synthetic scorer
fixtures. `pnpm eval:retrieval:score -- --prediction <repository-relative-json-path>`
validates and prints canonical content-free JSON without writing. All three are
offline and make no network, provider, model, database, candidate-repository,
artifact-body, target-source, package-registry, or Phase 7 access.
