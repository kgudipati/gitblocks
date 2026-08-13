# GitBlocks hosted OSS recommendation

`@gitblocks/gitblocks-hosted` is the product-owned hosted application boundary.
One Node composition loads the current immutable retrieval snapshot from
PostgreSQL once, constructs the existing deterministic retrieval engine, and
keeps the same database client for bounded finalist-evidence reads.

`recommendOss(...)` accepts `OssRecommendationRequestV1`, verifies the supplied
`RepositoryFingerprintV1` ID and content digest, normalizes the existing
capability query, retrieves and hard-filters deterministically, and passes only
the first five eligible finalists to evidence loading, filling any remaining
slots from the ordered evidence-needed lane without comparing scores across
lanes. Excluded candidates never enter fit assessment. Clarification,
unsupported, and no-result outcomes return before a model call.

For the resulting at-most-five finalists, the operation captures one trusted evidence cutoff,
loads active `CandidateDossierV1` evidence, limitations, and unknowns from the
existing PostgreSQL model. If every finalist dossier has zero observations, it
returns `insufficient-evidence` without a model call. Otherwise it makes at
most one target-fit model call. The additive
`RecommendationAssessmentResponseV1` wraps the unchanged
`TargetFitAssessmentResponseV1` and resolves every selected evidence-needed
hard evaluation exactly once as `satisfied`, `conflict`, or `unresolved`.
Canonical validation requires candidate-owned evidence grounding for
`satisfied` and `conflict`, rejects and un-ranks conflicts, and keeps any
unresolved candidate insufficient and unranked. Successful results contain at
most three responsible options and retain both the validated target-fit
assessment and hard-resolution records for traceability.

The MCP adapter exposes exactly one product tool, `recommend_oss`, using the
authoritative recommendation-request JSON Schema. It only transports the
application operation. The native listener remains fixed to `127.0.0.1` and
`/mcp`; R6 adds no public deployment or remote authentication.

## Configuration

The process requires the serving database settings:

- `GITBLOCKS_HOSTED_SERVING_DB_HOST`
- `GITBLOCKS_HOSTED_SERVING_DB_PORT`
- `GITBLOCKS_HOSTED_SERVING_DB_DATABASE`
- `GITBLOCKS_HOSTED_SERVING_DB_USERNAME`
- `GITBLOCKS_HOSTED_SERVING_DB_PASSWORD`
- `GITBLOCKS_HOSTED_SERVING_DB_SSL` (`disable` or `require`)

The OpenAI target-fit adapter additionally requires:

- `OPENAI_API_KEY`
- `GITBLOCKS_HOSTED_FIT_MODEL`, which must equal the reviewed private-alpha
  snapshot `gpt-5.4-mini-2026-03-17`

`GITBLOCKS_HOSTED_MCP_PORT` is optional and defaults to `3333`. The provider
request uses strict JSON Schema output, `store: false`, no tools, no background
mode, one deadline, and bounded request/response bytes. The minimized
fingerprint and bounded public candidate evidence are still transmitted to a
third-party processor. Raw target source is never sent or persisted.

The authoritative `TargetFitAssessmentResponseV1` schema remains unchanged.
The OpenAI adapter sends a fresh provider-compatible projection that removes
only `$id`, `$schema`, `uniqueItems`, `minLength`, and `maxLength`. Canonical
GitBlocks parsing and deterministic exchange validation re-enforce uniqueness,
string bounds, exact resolution coverage, normalization/source binding,
candidate/evidence ownership, and semantic invariants after every untrusted
provider response.
No model alias, fine-tuned model, retry, routing, fallback, or automatic
escalation is supported.

After migrations, the offline serving bootstrap, and offline public evidence
population, start the loopback process:

```text
pnpm hosted:mcp
```

Then use the official modern MCP client exercise in another terminal:

```text
pnpm hosted:mcp:exercise -- --request apps/gitblocks-hosted/examples/authorization-recommendation-request.json
```

`pnpm hosted:exercise -- --request <path>` runs the same composition directly
and invokes the configured provider once. Deterministic CI does not call the
live provider: it uses a controlled model and a loopback mocked Responses
boundary. Stop the MCP process with `SIGINT` or `SIGTERM`; shutdown closes the
listener before the PostgreSQL client.

Request handling never migrates or writes PostgreSQL, reloads the serving
snapshot, runs ingestion or public-source collection, activates artifacts or
repository interviews, executes candidate code, or invokes evaluation. The
checked-in R7 scanner and Skill remain separate local components; R8 changes
neither one.
