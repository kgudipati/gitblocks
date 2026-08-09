# Retrieval-v2 verification

This directory contains content-free verification authorities for the
independently reviewed `retrieval-v2` evaluation corpus. The independent-review
record binds authenticated external evidence by hash and records only aggregate
comparison and reconciliation facts. It contains no candidate evidence,
retrieval predictions, ranks, scores, or product-performance metrics.

Final validation paused for the isolated Issue #24 / PR #25 security repair.
Accepted security merge `82fb5dfbcfebf8229b08cd26f5da56ed61fb5361`
was incorporated without rewriting the first v2 authority commit; validation
then resumed without observing any production-v2 score.

Baseline and quality-gate authorities are generated only from blind v2 queries,
unchanged evaluation baselines, reviewed v2 relevance, and the transfer rules
fixed in Issue #23. The ceiling-saturation proof records exact per-case integer
capacity and alias-expanded hits; it contains no product prediction. The gate
record preserves the failed additive-margin attempt and the independently
accepted ceiling-relative-plus-baseline-floor correction. No Phase 9 production
retrieval result is used.
