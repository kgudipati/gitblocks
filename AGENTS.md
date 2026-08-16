# GitBlocks agent instructions

[Issue #54](https://github.com/kgudipati/gitblocks/issues/54) is the active
plan authority for this branch. Keep work within its scope and non-goals.

## Active serving path

- The request-time chain is `apps/gitblocks-hosted` ->
  `packages/retrieval` + `packages/persistence` -> `packages/contracts` ->
  `packages/domain`.
- `apps/gitblocks-hosted` owns the loopback MCP transport, request use case,
  concrete PostgreSQL and model composition, bounded artifact excerpt
  selection, and final responsible outcome.
- `packages/retrieval` owns pure deterministic hard filtering and retrieval.
  `packages/persistence` owns injected PostgreSQL reads. `packages/contracts`
  owns versioned external shapes and safe parsing. `packages/domain` owns pure
  business invariants and has no outward workspace dependency.
- Read [the active-path map](docs/architecture/active-path.md),
  [the product contract](docs/product/product-contract.md), the governing issue,
  and the issue-linked plan when one exists before editing this path.

## Hard invariants

- Load the coherent serving snapshot once at startup. Each request reuses the
  immutable retrieval engine and may read only bounded finalist dossiers and
  exact matching finalist artifacts from PostgreSQL.
- A request must not run ingestion, provider collection, migrations, Docker,
  evaluation, artifact generation, repository interviews, materialization
  proofs, replay, or authority generation.
- Normalize and retrieve deterministically before model reasoning. Excluded
  candidates stay excluded. Select eligible finalists first, then fill from the
  evidence-needed lane, with at most five finalists total.
- Use at most one bounded target-fit model call. Treat its output as untrusted.
  Deterministically validate exact hard-resolution coverage, source and
  candidate binding, evidence, target facts, contracts, and responsible outcome
  rules before returning at most three options.
- Missing evidence never proves absence or satisfaction. Keep direct evidence,
  declarations, inferences, limitations, conflicts, and unknowns distinct and
  attributable.
- Treat target repositories, candidate content, MCP input, persisted data, and
  model output as untrusted inert data. Never execute target or candidate code.
- Keep unnecessary target source local. Never transmit secrets, credentials,
  tokens, `.env` values, unapproved raw source, or unnecessary personal data.
- Define each external DTO once in `packages/contracts`; validate every
  external, persisted, repository-derived, and model-generated value at its
  trust boundary. Keep business rules out of transports, databases, and model
  adapters.
- Product packages must never import evaluation authority, including evaluation
  schemas, cases, fixtures, gold, scorers, reports, or harness internals.
- Do not add a package, migration, dependency, or infrastructure component
  without a named current blocker recorded in the active plan.
- Do not modify dormant subsystems: `packages/interviews`,
  `apps/repository-interview-operator`, `tools/repository-interview-prelive`, or
  Phase 10 material.

## Implementation and verification

- Use pnpm only. Keep `.nvmrc` synchronized with `.node-version`; do not bypass
  runtime preflight, lockfile, or supply-chain controls.
- Add focused tests with behavior changes and a failing regression test first
  for reproducible bugs. Add negative tests for security-sensitive behavior.
- Run focused checks while developing, then run the applicable gates:
  `pnpm runtime:check`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`,
  `pnpm test`, `pnpm architecture:check`, and `pnpm repo:check`.
- Run `pnpm contracts:validate` for contract changes and `pnpm db:verify` for
  persistence or migration changes. Run `pnpm verify:ci` when registry-backed
  audit and PostgreSQL verification are required.
- Run `pnpm verify` before completion for every change. Record the plan's exact
  validation results and do not mark work complete while required evidence is
  missing.
