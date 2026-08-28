# retrieval-v1

This immutable, offline evaluation-only corpus contains 30 retrieval cases and
20 normalization/adversarial cases, exactly six and four per capability family.
Its version is `retrieval-evaluation-corpus/1.0.0`, and its semantic digest is
`f92eac1a3963c4f52fb135189e82a0196dbccd559af32bc57a6a7e64226eb842`.

Blind query records contain no audit classifications or expected outcomes. Case
classifications live in a separate audit authority that is unavailable through
the blind loader. Normalization, clarification, hard-filter, relevance,
equivalence, and no-result gold are physically separate and proposed/not
independently reviewed. Mechanical regeneration preserves the manually proposed
relevance and equivalence bytes. Hard-filter matrices are regenerated from the
accepted 150-profile authority; they are not committed. Relevance measures
capability-query relevance, not viability, adoption fit, quality, ranking, or
recommendation. See the
[authoring and scoring protocol](../../docs/evaluation/retrieval-v1-authoring-protocol.md).
Milestone 6 owns all deterministic baselines and any baseline report.
