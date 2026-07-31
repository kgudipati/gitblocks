# `@gitblocks/interviews`

This private application package owns repository-interview behavior without
depending on ingestion, persistence, evaluation, retrieval, or ranking.

The package currently implements only:

- the authoritative semantic-only provider-output TypeBox schema;
- safe structural parsing and persistence-independent semantic validation;
- deterministic provider-neutral and OpenAI strict-schema generation;
- immutable specification loading, generation, and digest validation; and
- deterministic artifact-set closure, prompt rendering, provider-output
  digesting, alias/range resolution, and durable-constructor input mapping;
- bounded value-free mapping diagnostics; and
- offline focused tests and CLI validation.

The frozen topic vocabulary is imported from `@gitblocks/contracts`; the
provider-output TypeBox definition remains the sole provider DTO authority, so
the generated specification bytes do not change. The three durable
repository-interview roots, trusted constructors, parsers, identities, and
cross-root validation are owned by `@gitblocks/contracts`, not duplicated
here.

The renderer parses one exact `RepositoryArtifactSetV1` and zero through four
complete `RepositoryArtifactV1` values. Present entries receive `A1` through
`A4` in entry-ordinal order; `not-found` entries do not consume aliases.
Artifact text is split with the contracts-owned LF/CRLF/CR logical-line
semantics and rendered exactly once as canonical JSON evidence. The separate
instruction string is the exact reviewed instruction bytes followed by the
eight exact ordered questions. Neither string injects candidate, repository,
artifact, artifact-set, path, URL, commit, provider, or execution identity.

The model-visible evidence object has exactly `kind`, `artifacts`, and
`unavailableSelections`. Present artifacts expose only alias, controlled kind,
line count, and one-based `{ number, text }` lines. Unavailable selections
expose only ordinal, selector, controlled kind, requirement, and `not-found`
outcome. Repository content remains inert JSON data in the future user-role
payload; structural separation is a necessary control, not a claim that
prompt injection is impossible.

Hard prompt limits are four artifacts, 524,288 artifact source bytes, 40,000
logical lines, 65,536 instruction bytes, 4,194,304 evidence bytes, and
4,259,840 combined bytes. Bounds fail closed without truncation.

The prompt digest is lowercase SHA-256 over canonical JSON containing the
`repository-interview-prompt` domain, digest version 1, renderer version,
specification version/digest, and the exact instruction/evidence strings. The
provider-output digest is lowercase SHA-256 over canonical JSON containing the
`repository-interview-provider-output` domain, digest version 1, schema
version/digest, and the exact parsed provider output. Array order and exact
Unicode remain significant. The frozen synthetic examples are:

```text
prompt          bdfa0ac1bd39782028a3e3f5598cf980ae5066aaef24068eee0c1a45059ff584
provider output e245c7db27f96709263f120760ff4394602ae70053bd4f0162a59dcf82b2789c
```

Resolution validates every alias against the exact rendered registry and every
inclusive interval against the artifact's actual logical-line count. It maps
coordinates to trusted artifact IDs, creates one deterministic top-level
coordinate catalog, and returns claims, limitations, contradictions, and
unknowns shaped for the existing durable constructor. It creates no durable
ID or timestamp.

This package still does not contain application or persistence ports, an
interview application use case, artifact persistence loading, provider HTTP
behavior, an operator, database access, evaluation data, or live execution.

All package imports are side-effect-free. Filesystem access occurs only when a
caller explicitly loads, generates, or validates a specification. Ordinary
tests and specification validation deny live network access.
