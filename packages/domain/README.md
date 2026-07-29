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
  integrity, evidence/inference/unknown/limitation separation, source-aware
  provenance and chronology, hard-constraint safety, traceability for every
  candidate reason, evidence-backed favorable support for recommended/viable
  dispositions, responsible outcomes, and supplied partial-ranking validation.
- Repository fingerprints retain typed component/version and deployment facts.
  Other supported facts use one closed `coded` shape with a coarse category,
  bounded `code`, optional bounded `subjectCode`, and an explicitly typed,
  bounded value variant. The domain-owned `1.0.0` fact-vocabulary registry
  validates category/code/subject/value coherence. Unknown codes and unsupported
  semantics fail closed; no arbitrary metadata or raw scanner payload is
  accepted.
- Fact provenance preserves `epistemicStatus` exactly: `direct` means parsed
  from an approved source, `declared` means supplied as a declaration, and
  `derived` means concluded from observations. Canonicalization never silently
  renames one status to another, and incoherent origin/status combinations
  fail validation.
- Evidence sources are discriminated as Git commits, tags, releases, package
  versions, security advisories, mutable documentation, or approved validation.
  Domain rules enforce source/revision compatibility, immutable locator
  matching, exact package versions, tag/release branch and alias rejection,
  mutable-source disclosure, and publication/collection/freshness chronology.
- Every candidate reason must resolve to candidate-owned evidence or inference,
  a disclosed applicable material unknown, or a matching hard conflict with
  preserved evidence. This rule applies to every disposition.
- Responses retain supplied limitations in a candidate-owned catalog referenced
  by each assessment. Exchange validation proves exact owner, statement, and
  evidence preservation and rejects omitted, moved, altered, duplicate, or
  contradictory limitations.
- `assessmentProcessing` is independent of uncertainty. A `complete`
  assessment may disclose material unknowns; `partial-evidence` requires stable
  bounded `incompleteReasonCodes`. Every `insufficient-evidence` candidate
  references an applicable disclosed unknown, and processing state never
  suppresses an unknown.
- Rank-group array order is meaningful from higher to lower. Members of one
  rank group are tied. Explicit relations and incomparable pairs supplement
  that ordered grouping.
- Catalog-like collections are returned in canonical identifier order. Rank
  group order is preserved, while members inside a tie group are
  canonicalized.

Every successful validator returns a fresh canonical value; callers' objects
and arrays are never mutated.
