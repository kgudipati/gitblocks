# `@gitblocks/retrieval`

This private product package owns deterministic candidate retrieval. It accepts
one validated normalized capability query plus exact taxonomy, profile, catalog,
and constraint-evaluator bindings; evaluates every bound profile once through
the domain-owned hard-constraint authority; excludes conflicts and catalog
negative controls; keeps unresolved candidates only in an explicit
`evidence-needed` lane; and returns bounded product-safe results and provenance.

The active engine implements six exact deterministic channels: capability
family, controlled taxonomy concept, resolved candidate/repository identity,
resolved package identity, exact known structured-profile values, and approved
metadata lexical matching. Fusion is integer-only, identity deduplication is
exact, and ASCII candidate ID is the final tie-break.

`approved-metadata-lexical/1.0.0` consumes an injected, parsed
`CandidateRetrievalMetadataAuthorityV1` and matches bounded approved repository
topics, description, and primary-language metadata. It performs no provider
I/O and is present in the current production result channel bindings. Its
global exact lexical normalization and integer scoring remain deterministic.
The package has no filesystem, network, database, provider, model, evaluation,
ranking, target-codebase, clock, random, or process-global dependency.

Recovery R3 preserves that boundary. A startup or controlled-refresh
composition can call persistence's `loadServingCatalogSnapshot`, combine the
returned existing profile/metadata contracts with the accepted taxonomy and
retrieval-expansion authorities, and inject them into
`createCandidateRetrievalEngineV1`. Requests then normalize and retrieve only
against the immutable in-process engine; they do not bootstrap, migrate,
collect, materialize, or query PostgreSQL.

The score is retrieval plausibility only. It is not recommendation, project
quality, adoption fit, codebase-conditioned fit, or ranking.
