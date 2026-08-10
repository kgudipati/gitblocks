# Ranking-v1 Milestone 2 authoring protocol

## Status

This document preserves the proposed Phase 10 Milestone 2 authoring protocol.
Codex authored the corpus and proposed gold. Authoring did not independently
accept the gold or select gates. Subsequent independent maintainer review
accepted the exact reviewed content through the additive authority described in
[ranking-v1-acceptance.md](ranking-v1-acceptance.md); the proposed artifacts
below remain unchanged as historical review inputs.

No provider collection, candidate-authority successor, production ranking
implementation, or production ranking output was created or observed during
M2 authoring or acceptance bookkeeping.

## Evaluation question and tracks

The authoritative fixed-candidate track begins with a bounded approved request,
criterion-binding authority, target fingerprint, fixed plausible candidate
set, candidate evidence, and Phase 9 lane/handoff state. A prediction supplies
one responsible outcome, a disposition for every supplied candidate, a bounded
partial-order presentation, evidence-needed closure, traceability references,
and criterion consequences. M2 contains only baselines; no product ranker
exists.

The separate composition diagnostic begins with five blind capability queries
and target fingerprints, runs the accepted Phase 9 retrieval implementation
under its accepted contracts, then applies an evaluation-only responsible
abstention strategy. Its report separates retrieval coverage, lane composition,
handoff correctness, conditional baseline behavior, and end-to-end usefulness.
A retrieval miss is never charged to the fixed-candidate score, and retrieval
order earns no fixed-candidate ranking credit.

## Separation and blindness

Blind cases, candidate evidence, Phase 9 handoff state, proposed gold, audit
classification, reviewer rationale, review state, baseline specifications,
predictions, reports, and future accepted gates are independent files. Gold
never appears in blind case files. Candidate evidence contains only
request-independent candidate/scenario facts with explicit crosswalk or
synthetic-fixture provenance: no success/preference/hard-constraint IDs,
candidate-to-request mappings, or final closure labels. Audit labels and author
rationale are loaded only by corpus validation/scoring, not by a baseline
strategy. Review records never enter a product or baseline input.

The blind loader has a fixed allowlist of four inputs. Strategy objects contain
no case ID, gold disposition/outcome, audit class, expected controlled-pair
direction, review status, or threshold. The target-blind strategy additionally
receives `target: null`. Generation produces complete prediction sets and
semantic digests before the scoring command loads gold. Forward and reversed
case order plus candidate permutations must reproduce the committed semantics
exactly.

Static architecture checks deny persistence, ingestion, environment-variable,
HTTP/network, OpenAI/model, child-process, and Docker access from ranking
evaluation source. Product-package source is scanned for ranking-v1 authority
dependencies. Writers resolve beneath `evals/ranking-v1`, reject symlinks and
path escape. Ordinary generation accepts only enumerated report, prediction,
fixture-summary, gate-input, and manifest destinations; the explicit correction
authoring command has a separate closed allowlist for blind cases, proposed
gold, author rationale/review state, and baseline specifications.

## Proposed corpus

The corrected corpus has version `3.0.0`, cutoff `2026-08-10`, and exactly 30
cases, six per supported family. Each family has the same six-position pattern:

1. controlled target A;
2. controlled target B;
3. hard-conflict/no-viable;
4. responsible insufficient evidence;
5. popularity-over-fit audit case; and
6. supported tie or explicit incomparability.

The controlled-pair invariant is structural: request, bindings, candidates,
candidate evidence, handoff state, and cutoff share authority IDs and digests;
only audit-declared target paths differ. Proposed gold changes the preferred
candidate across each pair. The corpus includes ties and incomparability rather
than forcing a total order.

Each family includes evidence-needed candidates whose proposed closure covers
satisfied, conflict, and unresolved. Corpus-wide transition counts are 15, 10,
and 10 respectively. Every unresolved Phase 9-style evaluation ID is preserved
without a final answer in blind handoff/evidence. The answer is derived from
the unresolved rule, candidate facts, target facts when required, and modality;
gold separately records the expected state. Missing records are safety errors.

Criterion coverage includes single and multiple bound success conditions,
material unbound fail-closed behavior, approved non-material unbound behavior,
missing materiality fail-closed behavior, normalized bound preferences,
explicit structured preferences, unbound preference non-effect, and denial of
preference hardening. This authority does not add the future product criterion
schema.

Every bound material success criterion names one request-independent candidate
fact dimension, and at least one fixed candidate must carry a known value at
that dimension capable of satisfying the declared comparison rule. Ranking-v1
contains no deliberate zero-coverage exception. The author rationale repeats
the exact binding, expected values, candidate observation ID, observed values,
and proposed coverage state; validation rejects a crosswalk that names a
different fact path.

Every proposed positive candidate pair is deliberately tied, ordered, or
explicitly incomparable. Pairs containing only rejected or insufficient
candidates are intentionally non-presented and do not create an adoption-fit
relation. The separate `reviews/reviewer-rationale.json` authority gives all 30
cases concrete request, target, coverage, conflict, insufficiency, preference,
maximal-set, partial-order, and controlled-pair reasoning for independent
adjudication.

## Gold and review

Proposed gold supplies every candidate disposition, reason codes, required
unknowns, hard conflicts, rank groups, declared higher/lower relations,
incomparable pairs, evidence-needed resolutions, success coverage, and
criterion-binding consequences. References must close against the fixed
candidate and bounded evidence authorities. Hard-conflict candidates cannot be
positive or ranked; positive candidates require candidate-conditioned support;
insufficient candidates disclose material uncertainty.

`RankingGoldCandidate.evidenceIds` contains only decision-relevant candidate
observations: evidence for a reason, material success result, hard conflict,
evidence-needed closure, causally applied preference, target-fit comparison, or
material unknown. It is not an input-evidence preservation list. Validation
requires candidate ownership and reproduces the exact minimal set from the
frozen evaluation rules; unrelated available observations remain only in the
separate blind evidence authority.

The gold authority status is `proposed-not-independently-reviewed`. Every case
provenance is `proposed/not-reviewed`, with null reviewer, review time, and
review reference. The review record is `independent-review-pending`, identifies
Codex only as author, has no independent reviewer, and accepts no cases.

## Scorer

Scorer version `ranking-v1-scorer/2.0.0` reports exact counts with every
aggregate. Its surfaces are:

- zero-tolerance safety counts for hard-conflict promotion/ranking, candidate
  invention or set mismatch, excluded leakage, unresolved promotion, missing
  closure, preference hardening, material-unbound favorable counting, and
  unbound-preference ordering;
- per-label precision, recall, F1, and confusion counts for recommended,
  viable, rejected, and insufficient-evidence;
- exact responsible-outcome accuracy/confusion for recommend, no viable, and
  insufficient evidence;
- agreement over ties, declared and transitively implied order relations, and
  explicit incomparable pairs without manufacturing a winner;
- top-three usefulness, kept separate from pairwise agreement;
- controlled-pair exact maximal-set correctness in both halves, separately
  reporting wrong maximal sets, wrong direction, and unchanged predictions;
- exact satisfied/conflict/unresolved closure and illegal promotion;
- candidate-conditioned evidence/reason/unknown/hard-conflict recall without
  rewarding unsupported extras; and
- exact bound-success, material/non-material unbound, bound preference
  comparison consequences, structural unbound-preference counterfactual
  non-effect, and no-hardening criterion behavior.

Candidate invention is counted across assessments, presentation, groups,
relations, incomparable pairs, conflicts, resolutions, coverage, and preference
pair references; exact assessment-set mismatch remains separate. Legal zero
denominators are reported as null/not applicable. Twenty-one synthetic,
hand-calculated fixtures make 47 assertions across the perfect, zero
denominator, safety, disposition, outcome, tie, incomparability, relation,
controlled-pair exact/superset, three-state closure, missing resolution,
material-unbound, bound/unbound preference, preference-hardening, and every
reference-only invented-candidate surface. These fixtures validate the scorer
only and are never a product comparator.

## Frozen baselines

Each specification records permitted/prohibited inputs, deterministic rules,
tie behavior, evidence-needed handling, maximum-result behavior, version, and
digest before proposed gold is scored:

- retrieval-order diagnostic uses only authenticated handoff ordering/lane
  data, preserves evidence-needed uncertainty, and is not fit intelligence;
- all-insufficient responsible abstention makes no unsupported positive claim;
- target-blind candidate features derives hard, closure, coverage, preference,
  and partial comparison only from request-independent candidate facts and has
  no target or case-ID side channel;
- weak target-aware exact compatibility derives the same reported states but
  compares viable candidates only with preregistered runtime, framework, and
  deployment compatibility vectors. Exact support is 2, explicit evidenced
  universal support is 1, and mismatch, unknown, or undocumented `*` is 0.
  Pareto trade-offs remain incomparable; no scalar fit weights exist; and
- hard-conflict-violating negative control deliberately promotes known
  conflicts to prove that safety counters fail.

The synthetic oracle is confined to scorer fixtures. It is not an ordinary
baseline and is excluded from the product floor. A popularity baseline is
omitted because authoring had no suitable safe, committed bounded authority and
was prohibited from collecting one.

The canonical aggregate results and exact digests are in
`evals/ranking-v1/reports/baseline-report.json`. The report contains no case
winners, recommendation lists, rationale, evidence prose, or sensitive source
content.

The two feature baselines are version `3.0.0`. For the target-aware baseline,
success and preference vectors affect disposition/coverage reporting but not
ordering; equal runtime/framework/deployment compatibility vectors are tied,
and independent target-vector trade-offs are incomparable. For both feature
baselines, a complete layer that would cross the maximum is omitted together
with every relation or incomparable pair that references an omitted candidate.
If the maximal layer itself exceeds the maximum, presentation, rank groups,
rank relations, and incomparable pairs are all empty; candidate assessments
remain intact.

## Gate evidence, not gate selection

The proposed gate input binds corpus, gold, review, predictions, scores,
scorer, and performance-reference digests. It reports cases and exact errors
for overall and per-family baselines, scorer ceilings, five controlled pairs,
70 hard-conflict opportunities, five no-viable cases, five insufficient cases,
four tie pairs, two incomparable pairs, and 35 evidence-needed transitions.

The strongest non-oracle selection is deterministic and based on, in order:
outcome correctness, macro disposition F1, partial-order agreement, top-three
usefulness, and stable baseline ID. Exact safety counts remain separate and
cannot be hidden by that quality ordering. The result is evidence for an
independent reviewer; `finalThresholds` remains null and
`finalThresholdsSelected` remains false.

The authoring-time denominator was 18 decision-bearing fields and readiness was
0/18. The two pre-decision choices were:

- 13/18 (72.222222%) tolerates five unavailable decision-bearing fields while
  still requiring a substantial deterministic majority; or
- 14/18 (77.777778%) tolerates four and reduces unsupported-fit risk at the
  cost of a stricter pre-production evidence bar.

Neither value used M3 coverage. Authoring selected neither; the additive
accepted gate authority freezes 13/18 before any M3 provider effect, authority
generation, coverage output, or observation.

## Resource reference

The performance report is not a production ranking benchmark. It measures a
maximum-legal, gold-blind fixture with 20 candidates, 2,000 evidence records,
the contract maximum of 60 criteria (20 success, 20 hard, and 20 preference),
and 190 unordered pairs. The fixture uses representative target, binding,
candidate-fact, provenance, completeness, and unknown structures. After 200
warmups it records 2,000 samples
for parse/validation, traversal, pair enumeration, canonicalization, and other
bounded evaluation-data operations, plus p50/p95/max latency, process/runtime,
retained-memory reference, input/output sizes, and explicit operation counts.

Independent review should derive any future production budget from repeated
reference measurements on declared hardware/runtime, add a documented fixed
and proportional margin, verify the maximum legal envelope, and freeze both
latency and retained-memory budgets before production measurement. Authoring
does not select a final budget.

## Review checklist

Independent review adjudicated all proposed gold with zero disputes, froze the
exact quality, safety, readiness, performance, and determinism gates, confirmed
the corpus/baseline/scorer bindings, and accepted M2. The accepted decisions and
authorization boundary are recorded in
[ranking-v1-acceptance.md](ranking-v1-acceptance.md).
