# Plan 0139 — Model judgment / server assembly decomposition

## Authority and outcome

[Issue #139](https://github.com/kgudipati/gitblocks/issues/139) governs this
change. Replace the failure-prone flat model response obligation with the
frozen request-scoped decomposition: the model authors judgment and explicit
substance selections; the server alone assembles the canonical assessment.

## Frozen boundaries

- Keep finalist selection, five-finalist cap, evidence budgets, provider
  deadline, pinned model, retrieval, curation, V2 request/profile work, and
  infrastructure semantics unchanged.
- Generate required `f1..fN` candidate properties and candidate-specific
  `h1..hM` evaluation properties for each provider request.
- Scope evidence, limitation, and candidate-unknown enums to their owning
  candidate and repository-fact enums to the supplied fingerprint.
- Nest claims, their inferences, and assessment unknowns under the reason that
  endorses them.
- Assemble identifiers, catalogs, bindings, resolutions, exact source
  conflicts, effective dispositions, outcome, singleton rank groups, prefix
  capping, responsible options, and exact supplied-catalog hydration on the
  server.
- Never repair an omitted positive candidate or attach an unselected supplied
  limitation or unknown. Positive support requires an authored favorable claim
  with a candidate-evidence-grounded inference selecting a supplied target
  repository fact.

## Verification record

Record exact focused and repository-wide validation results here before
completion. The live provider gate must precede implementation and must use the
pinned production model with a strict request-generated schema containing
dynamic candidate and evaluation property names.

- 2026-08-22 — Live provider gate: HTTP 200 from
  `gpt-5.4-mini-2026-03-17`; required `f1`, `f2`, `h1`, and `h2` properties
  were returned exactly.
- 2026-08-22 — The complete production-generated five-candidate schema was
  accepted by the pinned provider; it returned exactly `f1..f5`, and the raw
  response passed deterministic decomposition assembly and the canonical
  exchange validator with outcome `recommend` and three capped options.
- 2026-08-22 — Focused hosted application and OpenAI adapter tests: 32/32
  passed before the added endorsement/conflict regressions.
- 2026-08-22 — Focused contract/domain tests: 94/94 passed after separating
  immutable supplied-catalog hydration from assessment-level consideration.
- 2026-08-22 — Final focused hosted/contract/domain regression selection:
  205/205 passed across 10 files.
- 2026-08-22 — `pnpm contracts:validate`: passed; eight product packages built
  and all 10 contract-conformance cases (40 supplied candidates) passed.
- 2026-08-22 — `pnpm verify`: formatting, product/tool builds, lint, all
  workspace typechecks, 2,259/2,259 tests across 147 files, architecture (964
  modules / 3,305 dependencies), repository checks, evaluation authorities,
  contract conformance, schema/authority CLIs, and secret scanning passed.

## Completion state

All planned implementation and validation gates are complete.
