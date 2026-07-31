# `@gitblocks/interviews`

This private application package owns repository-interview behavior without
depending on ingestion, persistence, evaluation, retrieval, or ranking.

The package currently implements only:

- the authoritative semantic-only provider-output TypeBox schema;
- safe structural parsing and persistence-independent semantic validation;
- deterministic provider-neutral and OpenAI strict-schema generation;
- immutable specification loading, generation, and digest validation; and
- offline focused tests and CLI validation.

The frozen topic vocabulary is imported from `@gitblocks/contracts`; the
provider-output TypeBox definition remains the sole provider DTO authority, so
the generated specification bytes do not change. The three durable
repository-interview roots, trusted constructors, parsers, identities, and
cross-root validation are owned by `@gitblocks/contracts`, not duplicated
here.

This package still does not contain application or persistence ports, artifact
loading or prompt rendering, alias-to-artifact mapping, provider HTTP
behavior, an operator, database access, evaluation data, or live execution.

All package imports are side-effect-free. Filesystem access occurs only when a
caller explicitly loads, generates, or validates a specification. Ordinary
tests and specification validation deny live network access.
