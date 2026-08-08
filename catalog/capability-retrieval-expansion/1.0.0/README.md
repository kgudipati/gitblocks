# Capability retrieval expansion 1.0.0

This directory owns the deterministic one-hop soft retrieval expansion bound
to capability taxonomy `1.0.0`. It does not normalize queries, alter hard
constraints, classify candidates, encode evaluation relevance, or rank
retrieved candidates.

- `source.json` is the human-reviewable semantic source. It enables accepted
  active taxonomy aliases and adds proposed bounded related identity terms
  with a taxonomy-concept rationale.
- `manifest.json` is the canonical generated authority injected into
  `@gitblocks/retrieval`.
- `pnpm retrieval:expansion:validate` regenerates the authority in memory,
  validates its closed shape and semantic digest, and compares exact bytes.
- `pnpm retrieval:expansion:generate` is the explicit maintainer command that
  writes only `manifest.json`.

Expansion is limited to eight edges per source concept and 32 applied edges per
query. Query-time expansion traverses source concepts once and never expands an
expansion target recursively. Required and prohibited constraints, deployment
and license requirements, source IDs, modalities, exclusions, and hard-lane
decisions are not inputs to expansion mutation and cannot be weakened by it.

The authority contains no evaluation case IDs, candidate-specific boosts,
relevance grades, no-result or equivalence gold, scorer or baseline output,
model output, or provider data. Terms may match only approved bounded
candidate-owned profile or exact repository/package identity values. Query-time
use performs no filesystem, network, model, provider, database, clock, locale,
or random operation.
