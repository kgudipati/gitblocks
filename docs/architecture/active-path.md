# Active `recommend_oss` request path

[Issue #54](https://github.com/kgudipati/gitblocks/issues/54) governs the
product request path, while [issue #94](https://github.com/kgudipati/gitblocks/issues/94)
governs its container-serving boundary. Startup-only composition,
static-policy loading, offline
ingestion, evaluation tooling, and dormant subsystems are intentionally omitted.

- `apps/gitblocks-hosted/src/mcp-http.ts` binds the configured listener host,
  validates Host and Origin against the configured public host, then validates
  the bearer credential and `/mcp` boundary before delegating parsed MCP
  traffic; its credential-free `/health` surface reports only readiness.
- `apps/gitblocks-hosted/src/mcp-server.ts` exposes only `recommend_oss`, applies
  the contract-generated tool input schema, calls the application operation,
  and returns bounded MCP success or failure content.
- `apps/gitblocks-hosted/src/application.ts` owns request validation,
  normalization, retrieval, finalist selection, evidence loading, model
  invocation, deterministic response validation, and the final bounded outcome.
- `packages/contracts/src/oss-recommendation-contracts.ts` validates the
  recommendation request and fingerprint binding, constructs the capability
  request, and validates the complete recommendation assessment exchange.
- `packages/contracts/src/capability-query-contracts.ts` validates the structured
  capability query and maps the domain normalizer's result back to the versioned
  contract.
- `packages/domain/src/capability-query-normalization.ts` applies the pure
  deterministic taxonomy and constraint-normalization rules.
- `packages/contracts/src/candidate-retrieval-contracts.ts` constructs and
  validates the bounded retrieval request and result exchanges.
- `packages/retrieval/src/retrieval-engine.ts` reuses the immutable in-process
  candidate view to hard-filter, score, deduplicate, and order eligible and
  evidence-needed lanes.
- `packages/retrieval/src/approved-metadata-lexical.ts` scores the approved
  bounded metadata channel against the normalized query.
- `packages/retrieval/src/retrieval-expansion.ts` applies the bounded one-hop
  retrieval expansion used by retrieval and artifact evidence selection.
- `packages/domain/src/candidate-constraint-evaluation.ts` classifies each
  candidate's deterministic hard constraints as satisfied, conflicting, or
  unresolved.
- `packages/persistence/src/operations.ts` loads each selected finalist's active
  evidence dossier at the request's trusted cutoff.
- `packages/persistence/src/artifact-operations.ts` loads exact catalog-, commit-,
  and cutoff-matched immutable artifact material for evidence-needed finalists.
- `apps/gitblocks-hosted/src/artifact-evidence-selector.ts` deterministically
  selects bounded exact artifact lines and appends them only to the request-scoped
  dossier.
- `packages/contracts/src/parsers.ts` validates candidate dossiers, the assembled
  fit request, the nested fit response, and the fit assessment exchange.
- `apps/gitblocks-hosted/src/openai-fit-model.ts` sends one bounded, tool-free,
  non-stored Responses request and returns parsed but still untrusted structured
  model output.
- `packages/domain/src/assessment-validation.ts` enforces candidate-owned
  evidence, inference, limitation, unknown, hard-conflict, ranking, and
  responsible-outcome invariants used by final exchange validation.

## Known documentation discrepancies

- `docs/architecture/system-context.md:338` places coherent serving-snapshot
  loading inside the request sequence. The implemented behavior loads that
  snapshot once during startup in `apps/gitblocks-hosted/src/composition.ts`;
  each request then reuses the immutable retrieval engine and reads PostgreSQL
  only for bounded finalist dossiers and exact matching finalist artifacts.
