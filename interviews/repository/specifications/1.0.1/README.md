# Repository interview specification 1.0.1

This immutable directory is the one allowed Phase 7 specification revision.
It is an additive instruction-only correction triggered by the closed
diagnostics `provider-output-topic-coverage` and
`provider-output-citation-range`.

The provider-output schema, OpenAI strict projection, renderer, controlled
topics, exact ordered questions, and local validation behavior remain
unchanged. Specification `1.0.0` remains immutable historical authority.

`pnpm interviews:generate` writes only this current additive directory.
`pnpm interviews:validate` validates both exact supported immutable
directories and fails if either drifts. Neither command performs a network
request.

This revision selects no model and claims no calibration result. The directory
becomes immutable after its first live use.
