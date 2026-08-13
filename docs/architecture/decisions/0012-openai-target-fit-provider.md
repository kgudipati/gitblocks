# ADR 0012: OpenAI Responses API for initial target-fit assessment

- Status: accepted for implementation under Issue #42
- Date: 2026-08-12
- Decision owners: GitBlocks maintainers
- Governing issue:
  [#42 — Recovery R6: Add codebase-conditioned OSS recommendation](https://github.com/kgudipati/gitblocks/issues/42)
- Execution plan:
  [Recovery R6 codebase-conditioned OSS recommendation](../../plans/0042-codebase-conditioned-oss-recommendation.md)
- Related decisions:
  [ADR 0003](0003-product-contract-kernel.md),
  [ADR 0004](0004-postgresql-evidence-persistence.md),
  [ADR 0009](0009-production-retrieval.md), and
  [ADR 0011](0011-postgresql-retrieval-serving.md)

## Context

Recovery R6 adds one hosted external effect after deterministic retrieval and
bounded finalist-evidence loading: codebase-conditioned target-fit analysis.
The existing fit kernel remains authoritative, while deterministic tests need
to inject controlled untrusted output. The initial private alpha therefore
needs one concrete provider behind a narrow application-owned port, not a
general provider or routing framework.

## Decision

Use the OpenAI Responses API as the initial private-alpha target-fit provider.
The hosted application defines a narrow `FitAssessmentModelPort`; one local
adapter implements it with the documented Responses API
[JSON Schema Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

Each recommendation makes at most one bounded provider request with:

- an explicitly configured model that supports Structured Outputs;
- the authoritative target-fit response JSON Schema in strict mode;
- `store: false`;
- no tools, web search, file search, MCP tools, background mode, streaming,
  routing, fallback model, or retry orchestration; and
- only the validated query context, normalized query, minimized request-scoped
  repository fingerprint, and at most five eligible finalist dossiers.

The model output is untrusted. Existing fit-exchange validation plus the R6
repository-fact binding validates candidate/evidence ownership, preserved
evidence, limitations and unknowns, hard constraints, positive support,
target grounding, candidate-set closure, ranking, and the result bound before
the application derives any responsible option. Provider output never becomes
user-facing prose directly.

`OPENAI_API_KEY` supplies the credential and
`GITBLOCKS_HOSTED_FIT_MODEL` supplies the explicit model. `store: false`
disables provider response storage but does not make provider processing a
local operation: the minimized fingerprint and bounded public candidate
evidence cross a real third-party processing boundary. Raw source, files,
secrets, prompts, evidence bodies, fingerprints, provider responses, and raw
provider errors are never logged.

## Consequences

The initial provider is concrete and reviewable, deterministic CI uses an
injected controlled model or loopback mock, and provider failure remains a
bounded application failure. A later provider can replace the adapter without
changing fit semantics, target-fit contracts, retrieval authority, PostgreSQL
evidence, or the hosted application operation. R6 adds no provider framework,
conversation history, prompt database, fallback, evaluation platform, or
dependency on the dormant repository-interview runtime.
