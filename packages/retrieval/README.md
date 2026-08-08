# `@gitblocks/retrieval`

This private product package owns deterministic candidate retrieval. It accepts
one validated normalized capability query plus exact taxonomy, profile, catalog,
and constraint-evaluator bindings; evaluates every bound profile once through
the domain-owned hard-constraint authority; excludes conflicts and catalog
negative controls; keeps unresolved candidates only in an explicit
`evidence-needed` lane; and returns bounded product-safe results and provenance.

The active engine implements five exact deterministic channels: capability family,
controlled taxonomy concept, resolved candidate/repository identity, resolved
package identity, and exact known structured-profile values. Fusion is
integer-only, identity deduplication is exact, and ASCII candidate ID is the
final tie-break.

`approved-metadata-lexical/1.0.0` is implemented only as an inactive offline
channel boundary. It consumes an injected, parsed
`CandidateRetrievalMetadataAuthorityV1`; it performs no provider I/O and is not
present in current production result channel bindings. Its global exact
lexical normalization and integer score are frozen before any real metadata
snapshot exists.
The package has no filesystem, network, database, provider, model, evaluation,
ranking, target-codebase, clock, random, or process-global dependency.

The score is retrieval plausibility only. It is not recommendation, project
quality, adoption fit, codebase-conditioned fit, or ranking.
