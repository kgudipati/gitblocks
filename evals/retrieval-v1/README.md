# retrieval-v1

This immutable, offline evaluation-only corpus contains 30 retrieval cases and
20 normalization/adversarial cases, exactly six and four per capability family.
Its version is `retrieval-evaluation-corpus/1.0.0`, and its semantic digest is
`e133c0fa00b6063e7360ce5ebfdf27893f72ee5ca5e39fbe5d82c1e944831917`.

Query inputs are blind. Normalization, clarification, hard-filter, relevance,
equivalence, and no-result gold are physically separate and proposed/not
independently reviewed. Hard-filter matrices are regenerated from the accepted
150-profile authority; they are not committed. Relevance measures
capability-query relevance, not viability, adoption fit, quality, ranking, or
recommendation. See the
[authoring and scoring protocol](../../docs/evaluation/retrieval-v1-authoring-protocol.md).
Milestone 6 owns all deterministic baselines and any baseline report.
