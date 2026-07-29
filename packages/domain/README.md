# `@gitblocks/domain`

Pure product vocabulary and business invariants for evidence-backed,
fixed-candidate OSS fit assessment.

The package has no runtime or development dependencies of its own. It performs
no I/O and has no access to clocks, randomness, environment variables,
transports, persistence, providers, evaluation records, or framework types.
Its public functions accept already-typed domain values, return explicit
results, and produce deterministic value-safe issues.

## Boundary

- External shapes and structural validation belong to
  `@gitblocks/contracts`.
- This package owns stable identifiers, candidate ownership, reference
  integrity, evidence/inference/unknown separation, hard-constraint safety,
  evidence-backed favorable support for recommended/viable dispositions,
  responsible outcomes, and supplied partial-ranking validation.
- Rank-group array order is meaningful from higher to lower. Members of one
  rank group are tied. Explicit relations and incomparable pairs supplement
  that ordered grouping.
- Catalog-like collections are returned in canonical identifier order. Rank
  group order is preserved, while members inside a tie group are
  canonicalized.

Every successful validator returns a fresh canonical value; callers' objects
and arrays are never mutated.
