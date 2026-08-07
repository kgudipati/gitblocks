# `@gitblocks/retrieval`

This private product package owns deterministic candidate retrieval. It accepts
one validated normalized capability query plus exact taxonomy, profile, catalog,
and constraint-evaluator bindings; evaluates every bound profile once through
the domain-owned hard-constraint authority; excludes conflicts and catalog
negative controls; keeps unresolved candidates only in an explicit
`evidence-needed` lane; and returns bounded product-safe results and provenance.

Milestone 2 implements five exact deterministic channels: capability family,
controlled taxonomy concept, resolved candidate/repository identity, resolved
package identity, and exact known structured-profile values. Fusion is
integer-only, identity deduplication is exact, and ASCII candidate ID is the
final tie-break.
The package has no filesystem, network, database, provider, model, evaluation,
ranking, target-codebase, clock, random, or process-global dependency.

The score is retrieval plausibility only. It is not recommendation, project
quality, adoption fit, codebase-conditioned fit, or ranking.
