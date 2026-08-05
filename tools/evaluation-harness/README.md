# GitBlocks evaluation harness

The harness owns offline, bounded evaluation validation and deterministic
scoring. `pilot-v1` remains the target-repository ranking authority. The
separate `repository-interviews-v1` modules validate candidate-owned interview
audit authority and never reinterpret pilot gold.

`retrieval-v1` is a third independent evaluation authority. It owns 30 blind
retrieval and 20 blind normalization/adversarial cases, exactly six/four per
capability family; physically separate proposed normalization,
clarification, generated hard-filter, relevance, equivalence, and no-result
gold; exact manifest byte hashes; and a semantic digest. The harness invokes
the accepted public normalizer and single-candidate evaluator rather than
duplicating their semantics or importing ingestion implementation.

Retrieval scoring validates complete 50-case predictions and exact
150-candidate decisions for each retrieval case. It reports Recall@10, MRR,
NDCG@10, exact/equivalence duplicates, family coverage, tri-state hard-filter
accuracy, top-ten safety, no-eligible accuracy, exact clarification and alias
accuracy, and prohibited-modality preservation. Every metric retains
numerator/denominator/value/status; zero denominators are null and
not-applicable. Twenty synthetic hand-calculated fixtures prove the math and
stable report digest without running an oracle over the real corpus. Milestone
6 owns all baselines and any committed baseline report.

Repository-interview evaluation support includes an independently named JSON
Schema registry, bounded corpus loader, exact catalog/artifact authority
closure, durable content-free audit-scope construction from validated product
exchanges, exact primary/secondary subject coverage, same-interview reference
closure, narrow disagreement adjudication, policy-driven deterministic
secondary sampling, pure policy-driven gate scoring, and synthetic
adversarial/boundary fixtures. It does not call a provider, grade with a
model, write production persistence, create production review state, or select
an interview for ranking.

The repository-interview corpus is a loader-authenticated runtime authority,
not merely a structurally valid object. The loader owns and freezes the value
before applying a private brand; cloning or changing a policy while retaining
its old digest cannot authorize it. Completed audit validation also requires
one in-memory durable exchange per completed run result, derives each audit
scope through the public product parsers and complete-exchange validator, and
compares that authority with the run's content-free embedded scope.

The schemas under `schemas/evaluation/repository-interviews/` are evaluation
schemas, not product contracts. Production packages are forbidden from
importing the harness, evaluation schemas, or `evals/` data. The harness may
exercise public contracts and interview utilities only in the inward,
evaluation-consumer direction.

Ordinary validation is read-only and uses the existing 256 KiB file, bounded
JSON depth/node, safe path, and no-symlink boundary. Retrieval additionally
caps its entire corpus at 16 MiB and requires exact 211-entry/212-JSON
membership. CLI output contains only
corpus identities/counts/digests and fixture scenario names/results; it never
prints candidate rationale, hostile fixture text, semantic content, reviewer
values, prompts, or provider data.

In-memory audit ownership separately caps retained input at depth 64, 100,000
nodes, 50,000 elements per array, 1,024 keys per object, and 8 MiB of aggregate
UTF-8 string and key bytes. It accepts only finite JSON-like scalars, ordinary
plain objects, and contiguous ordinary arrays; accessors, symbols, cycles,
sparse or extended arrays, exotic prototypes, and throwing reflection traps
fail before schema or semantic validation.

Gate reports accept only an audit authority returned by the complete
validator. That authority is a bounded deeply owned and deeply frozen graph;
it retains no caller run, audit, adjudication, exchange, corpus, or policy
reference. Its domain-separated provenance binds the run summary, ordered
durable inventory scopes, audit records, adjudications, selected model-profile
digest, corpus digest, and exact cohort/review/rubric/gate policy file digests.
Caller ordering of scope, audit, and adjudication collections cannot change
their set digests.
