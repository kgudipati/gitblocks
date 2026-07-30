# `@gitblocks/interviews`

This private application package owns repository-interview behavior without
depending on ingestion, persistence, evaluation, retrieval, or ranking.

Milestone 2 implements only:

- the authoritative semantic-only provider-output TypeBox schema;
- safe structural parsing and persistence-independent semantic validation;
- deterministic provider-neutral and OpenAI strict-schema generation;
- immutable specification loading, generation, and digest validation; and
- offline focused tests and CLI validation.

It does not contain durable interview contracts, application or persistence
ports, artifact loading or prompt rendering, provider HTTP behavior, an
operator, database access, evaluation data, or live execution.

All package imports are side-effect-free. Filesystem access occurs only when a
caller explicitly loads, generates, or validates a specification. Ordinary
tests and specification validation deny live network access.
