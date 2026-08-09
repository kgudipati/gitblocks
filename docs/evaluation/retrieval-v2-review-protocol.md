# Retrieval-v2 reviewed-authority protocol

## Scope

`retrieval-v2` is an additive correction to relevance authority only. It keeps
the exact 30 retrieval queries, 20 normalization/adversarial queries, and 636
`(caseId, candidateId)` relevance keys from immutable `retrieval-v1`.
Normalization, clarification, hard-filter, no-result, equivalence, and query
documents retain their exact v1 bytes. Relevance measures capability-query fit,
not maintenance, quality, adoption fit, recommendation, or ranking.

The external blind-review bundle and raw mechanical comparison outputs are not
repository authorities and are not committed. Their hashes, aggregate closure,
and reconciliation are bound by the content-free record at
`verification/retrieval-v2/independent-review.json`.

## Reconciliation

The accepted grade rubric is:

- 0: irrelevant or false-positive;
- 1: adjacent or weak relative to the complete query;
- 2: direct capability match without strong explicit evidence for the
  preferred detail; and
- 3: strong direct capability match with explicit evidence aligned to the
  preferred detail.

A preferred secondary feature changes relevance strength, not the capability
candidate universe. Named comparison queries remain restricted to their
explicitly resolved candidate references. These rules authorize exactly 33
grade-0 corrections in the five preferred cases and no other grade change.

The v2 validator independently loads immutable v1, closes all 636 keys, proves
the exact correction set and reason codes, verifies the final `97 / 79 / 398 /
62` distribution, and requires every non-relevance manifest entry to retain its
v1 byte hash. All v2 relevance records carry reviewed provenance bound to the
content-free review-record digest; non-relevance records retain their original
proposed provenance.

## Baselines, ceilings, and gates

Baseline prediction generation must load the v2 blind query set before any
gold. The family-only, exact-keyword, alias-expanded, always-abstain, and
constraint-violating implementations and versions remain unchanged. Only their
corpus-bound prediction/report wrappers advance where the closed v1 schemas
cannot identify v2.

Theoretical ceilings use the unchanged scorer aggregation. For each positive
retrieval case, the ceiling contribution is
`min(10, eligibleRelevantCount) / eligibleRelevantCount`; macro and family
ceilings average those contributions while the micro ceiling divides summed
top-ten capacity by summed eligible relevance.

Before any production retrieval is scored against v2, quality gates are frozen
as follows:

- each family Recall@10 floor is 90% of its v2 ceiling;
- ceiling-relative macro target is the v2 ceiling multiplied by
  `0.625000 / 0.656249`;
- baseline target is the strongest ordinary v2 baseline macro Recall@10;
- the macro floor is the larger raw target, rounded to six decimals only after
  selection.

The initial transfer interpretation added the historical absolute difference
`0.012705` to the new baseline. It produced the infeasible target `0.621304`,
above the v2 theoretical ceiling `0.608599`, and therefore failed closed before
any production-v2 score. Independent threshold review established that the
historical invariant was ceiling-relative ambition plus a baseline floor—not a
permanent additive margin.

The unchanged alias-expanded baseline saturates every one of the 25 positive
cases: its relevant top-ten count equals
`min(10, eligibleRelevantCount)` case by case. Its exact aggregate therefore
equals the theoretical ceiling before display rounding. The corrected transfer
selects the raw alias-expanded baseline value `0.60859904` over the raw
ceiling-relative target `0.5796188527399861`, publishing Macro Recall@10
`0.608599`. The family floors are authorization `0.603529`, audit logging
`0.493043`, background jobs `0.428276`, rate limiting `0.480001`, and webhooks
`0.733847`.

The positive hit-rate, MRR, NDCG@10, and all zero-tolerance safety gates remain
unchanged. If corpus structure ceases to be 25 positive and five no-eligible
retrieval cases, or any alias-expanded case fails exact saturation, generation
fails closed.

No Phase 9 product prediction, score, or hypothetical pass/fail result is an
input to this authority.
