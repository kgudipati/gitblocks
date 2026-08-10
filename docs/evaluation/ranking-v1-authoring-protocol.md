# Ranking-v1 Milestone 2 authoring protocol

## Status

This document describes the proposed Phase 10 Milestone 2 evaluation authority.
Codex authored the corpus and proposed gold. Independent review is pending, so
neither the gold, Milestone 2, a product-quality threshold, a performance
budget, nor a deterministic-readiness choice is accepted.

Milestone 3 remains unauthorized. No provider collection, candidate-authority
successor, production ranking implementation, or production ranking output was
created or observed during M2 authoring.

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
classification, review state, baseline specifications, predictions, reports,
and future accepted gates are independent files. Gold never appears in blind
case files. Audit labels are loaded only by corpus validation/scoring, not by a
baseline strategy. Review records never enter a product or baseline input.

The blind loader has a fixed allowlist of four inputs. Strategy objects contain
no case ID, gold disposition/outcome, audit class, expected controlled-pair
direction, review status, or threshold. The target-blind strategy additionally
receives `target: null`. Generation produces complete prediction sets and
semantic digests before the scoring command loads gold. Forward and reversed
case order must reproduce the committed predictions exactly.

Static architecture checks deny persistence, ingestion, environment-variable,
HTTP/network, OpenAI/model, child-process, and Docker access from ranking
evaluation source. Product-package source is scanned for ranking-v1 authority
dependencies. Writers resolve beneath `evals/ranking-v1`, reject symlinks and
path escape, and accept only enumerated report/prediction/manifest destinations.

## Proposed corpus

The corpus has version `1.0.0`, cutoff `2026-08-10`, and exactly 30 cases, six
per supported family. Each family has the same six-position pattern:

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
satisfied, conflict, and unresolved. Corpus-wide transition counts are 20, 10,
and 15 respectively. Every unresolved Phase 9-style evaluation ID is preserved
and must receive an explicit prediction; missing records are safety errors.

Criterion coverage includes single and multiple bound success conditions,
material unbound fail-closed behavior, approved non-material unbound behavior,
missing materiality fail-closed behavior, normalized bound preferences,
explicit structured preferences, unbound preference non-effect, and denial of
preference hardening. This authority does not add the future product criterion
schema.

## Gold and review

Proposed gold supplies every candidate disposition, reason codes, required
unknowns, hard conflicts, rank groups, declared higher/lower relations,
incomparable pairs, evidence-needed resolutions, success coverage, and
criterion-binding consequences. References must close against the fixed
candidate and bounded evidence authorities. Hard-conflict candidates cannot be
positive or ranked; positive candidates require candidate-conditioned support;
insufficient candidates disclose material uncertainty.

The gold authority status is `proposed-not-independently-reviewed`. Every case
provenance is `proposed/not-reviewed`, with null reviewer, review time, and
review reference. The review record is `independent-review-pending`, identifies
Codex only as author, has no independent reviewer, and accepts no cases.

## Scorer

Scorer version `ranking-v1-scorer/1.0.0` reports exact counts with every
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
- controlled-pair direction with correct, incorrect, and unchanged counts;
- exact satisfied/conflict/unresolved closure and illegal promotion;
- candidate-conditioned evidence/reason/unknown/hard-conflict recall without
  rewarding unsupported extras; and
- exact bound-success, material/non-material unbound, bound/unbound preference,
  and no-hardening criterion behavior.

Legal zero denominators are reported as null/not applicable. Fifteen synthetic,
hand-calculated fixtures make 34 assertions across the perfect, zero
denominator, safety, disposition, outcome, tie, incomparability, relation,
controlled-pair, three-state closure, missing resolution, material-unbound,
unbound-preference, preference-hardening, and invented-candidate cases. These
fixtures validate the scorer only and are never a product comparator.

## Frozen baselines

Each specification records permitted/prohibited inputs, deterministic rules,
tie behavior, evidence-needed handling, maximum-result behavior, version, and
digest before proposed gold is scored:

- retrieval-order diagnostic uses only authenticated handoff ordering/lane
  data, preserves evidence-needed uncertainty, and is not fit intelligence;
- all-insufficient responsible abstention makes no unsupported positive claim;
- target-blind candidate features uses only candidate structured/evidence
  features and has no target or case-ID side channel;
- weak target-aware exact compatibility adds only preregistered equality checks
  for runtime, framework, Redis, worker/deployment shape, identity, resources,
  and data policy—no learned weight or gold-dependent tuning; and
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

## Gate evidence, not gate selection

The proposed gate input binds corpus, gold, review, predictions, scores,
scorer, and performance-reference digests. It reports cases and exact errors
for overall and per-family baselines, scorer ceilings, five controlled pairs,
55 hard-conflict opportunities, five no-viable cases, five insufficient cases,
three tie pairs, two incomparable pairs, and 45 evidence-needed transitions.

The strongest non-oracle selection is deterministic and based on, in order:
zero safety violations, outcome correctness, macro disposition F1, partial
order agreement, and stable baseline ID. The result is evidence for an
independent reviewer; `finalThresholds` remains null and
`finalThresholdsSelected` remains false.

The readiness denominator remains 18 decision-bearing fields and current
readiness remains 0/18. Independent M2 acceptance must choose exactly one:

- 13/18 (72.222222%) tolerates five unavailable decision-bearing fields while
  still requiring a substantial deterministic majority; or
- 14/18 (77.777778%) tolerates four and reduces unsupported-fit risk at the
  cost of a stricter pre-production evidence bar.

Neither value uses or may be revised from M3 coverage. The selected value and
policy digest must freeze before any M3 provider effect, authority generation,
coverage output, or observation. Authoring selects neither.

## Resource reference

The performance report is not a production ranking benchmark. It measures a
maximum-legal, gold-blind fixture with 20 candidates, 240 evidence records, 40
criteria, and 190 unordered pairs. After 200 warmups it records 2,000 samples
for parse/validation, traversal, pair enumeration, canonicalization, and other
bounded evaluation-data operations, plus p50/p95/max latency, process/runtime,
retained-memory reference, input/output sizes, and explicit operation counts.

Independent review should derive any future production budget from repeated
reference measurements on declared hardware/runtime, add a documented fixed
and proportional margin, verify the maximum legal envelope, and freeze both
latency and retained-memory budgets before production measurement. Authoring
does not select a final budget.

## Review checklist

Independent review must adjudicate all proposed gold and disputes, freeze
exact quality and safety gates, choose and digest 13/18 or 14/18, decide a
performance margin/budget protocol, confirm corpus/baseline/scorer blindness
and digests, and explicitly accept M2 before M3 can begin. Until then, M2 is not
accepted and all M3 effects and outputs remain prohibited.
