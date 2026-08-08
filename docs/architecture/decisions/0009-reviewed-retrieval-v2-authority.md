# ADR 0009: Establish independently reviewed retrieval-v2 authority

## Status

Accepted for implementation under Issue #23. Independent acceptance and merge
remain required before Phase 9 resumes.

## Context

The immutable `retrieval-v1` corpus was intentionally committed with proposed,
not independently reviewed relevance judgments. Its first frozen Phase 9
six-channel benchmark exposed that this limitation was material. A subsequent
blind review covered all 636 existing relevance-universe keys without seeing
grades, predictions, scores, ranks, metrics, thresholds, or gate results.

The blind review and the proposed authority agreed on the binary relevance of
595 judgments and disagreed on 41. All binary disagreements changed proposed
grade 0 to a positive blind-review grade: 33 appeared in preferred-feature
queries and eight in named-candidate comparisons. The blind reviewer also used
a materially broader grade-3 calibration. These observations require explicit
reconciliation; neither source is silently adopted in full.

## Decision

`retrieval-v1` remains byte-immutable and permanently identifies the historical
Phase 9 measurement. Forward correction creates the additive
`retrieval-evaluation-corpus/2.0.0` root with reviewed relevance version
`retrieval-relevance-gold/2.0.0`.

The reconciliation rules are fixed before any production retrieval system is
scored against v2:

1. A `preferred` constraint is soft. A genuine capability provider is not
   irrelevant solely because the preferred detail is unsupported.
2. Grades use strict capability-query calibration: 0 irrelevant, 1 adjacent or
   weak for the complete query, 2 directly relevant without strong explicit
   preferred-detail evidence, and 3 strongly direct with explicit aligned
   evidence.
3. Named comparisons remain narrow. Only the explicitly resolved candidate
   references own comparison intent; unnamed ecosystem companions remain grade 0.

Exactly 33 preferred-case judgments change. The eight named-comparison changes
are rejected, and the stricter proposed grades are retained for all 321
same-binary calibration disagreements. The other 603 proposed grades remain
unchanged. The reviewed distribution is therefore 97 grade-0, 79 grade-1, 398
grade-2, and 62 grade-3 judgments.

A content-free `retrieval-relevance-independent-review/1.0.0` record binds the
v1 corpus digest, blind-bundle hash, independent-review hash, three mechanical
comparison hashes, aggregate comparison facts, reconciliation rules, and final
distribution. It contains no candidate evidence or product performance.
Reviewed relevance provenance binds each v2 relevance document and judgment to
that record. All other query and evaluation meanings remain proposed and keep
their existing semantic versions.

Unchanged baseline algorithms are regenerated through a v2 blind-query
boundary. Theoretical Recall@10 ceilings use the unchanged scorer aggregation
and `min(10, eligibleRelevantCount) / eligibleRelevantCount` per positive case.
Family floors are 90% of the corresponding v2 family ceiling. The macro floor
is the larger of the ceiling-relative and strongest-baseline-relative targets
defined by Issue #23. These rules are committed before any production-v2
score exists.

## Consequences

- Phase 9 M3 remains blocked until this evaluation correction is independently
  accepted and merged.
- Production retrieval code, metadata scoring, expansion, and PR #22 are not
  changed or evaluated here.
- Historical v1 scores remain interpretable against their original digest.
- V2 queries, normalization, clarification, hard filters, no-result authority,
  equivalence authority, and scorer mathematics remain semantically identical
  to v1.
- Future relevance corrections require another additive authority version; no
  accepted corpus is overwritten.
