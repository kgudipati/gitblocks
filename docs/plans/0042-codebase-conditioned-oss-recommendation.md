# Recovery R6 codebase-conditioned OSS recommendation

## Status and authority

- Issue: [#42 — Recovery R6: Add codebase-conditioned OSS recommendation](https://github.com/kgudipati/gitblocks/issues/42)
- Branch: `feat/42-codebase-conditioned-recommendation`
- Owner: GitBlocks maintainers
- State: R6 maintainer correction complete; draft PR update pending
- Last updated: 2026-08-12

Issue #42 is the slice authority. The product contract, accepted ADRs, and
repository engineering policies govern durable boundaries. This plan records
execution and evidence; it does not expand the issue. The frozen Phase 10 R&D
branch is superseded, preserved, and neither an input nor a target.

## Purpose and executable user-visible outcome

R5 exposes deterministic discovery over MCP but deliberately stops at a
shortlist. R6 adds the first GitBlocks-owned comparative judgment path over a
caller-supplied minimized repository fingerprint. The intended hosted exercise
is:

```text
OssRecommendationRequestV1
  -> request and fingerprint binding validation
  -> existing deterministic query normalization
  -> existing deterministic retrieval and hard filtering
  -> first <=5 eligible finalists
  -> active PostgreSQL CandidateDossierV1 material at one trusted cutoff
  -> one bounded target-fit model call
  -> TargetFitAssessmentResponseV1
  -> existing FitAssessment exchange validation plus repository-fact binding
  -> <=3 responsible options
  -> recommend_oss over loopback MCP
```

GitBlocks owns the comparative codebase-fit judgment. The caller's coding
agent supplies the structured request and fingerprint and later presents the
validated result; it does not choose, rerank, restore, or promote candidates.
R6 does not implement the local scanner, Skill, user approval, integration, or
local validation journey.

## Verified baseline and implementation facts

- The worktree was clean before work began. `HEAD`, `main`, and `origin/main`
  were verified at `9fd2da16caa9ba7139a1b1741aa00343d12bdbea`.
- PR [#41](https://github.com/kgudipati/gitblocks/pull/41) is merged at that
  commit and Issue [#40](https://github.com/kgudipati/gitblocks/issues/40) is
  closed.
- R5 loads one PostgreSQL serving snapshot at startup, builds one immutable
  retrieval engine, and exposes only deterministic `discover_oss` through
  loopback MCP.
- `FitAssessmentRequestV1`, `FitAssessmentResponseV1`, and their existing
  parsers/exchange validator already own fixed-candidate fit semantics,
  evidence ownership and preservation, candidate limitation and unknown
  preservation, hard-conflict behavior, responsible outcomes, and ranking
  invariants.
- The existing inference contract attributes an inference to candidate
  evidence but has no machine-validated reference to a supplied
  `RepositoryFingerprintV1.factId`. This is the concrete target-conditioned
  traceability blocker.
- The query-to-fit bridge is lossless: the query contract preserves request
  identity, summary, success-condition IDs/statements, exact constraint
  modalities/IDs/statements/reason codes, and normalization authority. Domain
  validation already rejects a required or prohibited constraint without a
  reason code.
- `selectActiveDossierMaterial(...)` already implements bounded cutoff reads,
  freshness, supersession/invalidation exclusion, canonical record-digest
  validation, limitation/unknown filtering, and final dossier validation.
- The concrete active-dossier loader needs only candidate identity, family
  membership, observations, supersessions, invalidations, limitations, and
  material unknowns. It does not query dossier snapshots, artifacts,
  interviews, or limitation/unknown relationship rows.
- Official OpenAI Responses documentation confirms strict Structured Outputs
  use `text.format` with `type: "json_schema"`, `strict: true`, and the supplied
  JSON Schema; objects must be closed and fields required. R6 explicitly sends
  `store: false`, `tools: []`, disables background/streaming, and handles
  incomplete/refusal/no-output as failure. The model is always explicit
  configuration, not a moving default.
- Runtime preflight passed on the repository's pinned Node and pnpm versions.
- Maintainer inspection of the complete generated target-fit schema found 21
  `uniqueItems`, 96 `minLength`, and 96 `maxLength` occurrences. Its complete
  schema-keyword set is `$id`, `$schema`, `type`, `properties`, `required`,
  `additionalProperties`, `const`, `pattern`, `items`, `minItems`, `maxItems`,
  `anyOf`, `uniqueItems`, `minLength`, and `maxLength`. Current official
  Structured Outputs documentation identifies no other actually-present
  keyword as unsupported for the selected non-fine-tuned Responses boundary.

## Scope and non-goals

In scope:

- additive `OssRecommendationRequestV1` and
  `TargetFitAssessmentResponseV1` contracts, parsers, canonical fingerprint
  digest, target-fact/exchange validation, schema catalog exports, and tests;
- deterministic construction of the existing `CapabilityRequestV1` and
  `FitAssessmentRequestV1` from validated query/normalization, request-scoped
  fingerprint, active finalist dossiers, one cutoff, maximum five finalists,
  and `requestedMaximumResults: 3`;
- one concrete active finalist dossier read and one forward least-privilege
  migration for the exact seven existing evidence tables it queries;
- one hosted recommendation operation, one narrow hosted fit-model port, one
  OpenAI Responses adapter, bounded failures/telemetry, and one model call;
- exactly one MCP product tool, `recommend_oss`, preserving R5 loopback,
  `/mcp`, Host validation, and Origin validation;
- contract, application, persistence, adapter, MCP, and official-client
  end-to-end tests with controlled model output; and
- one compact provider ADR plus current product/system/developer documentation.

Out of scope: scanner, Skill, local integration, remote binding, deployment,
OAuth or API-key MCP auth, users/organizations/tenancy, billing, target
fingerprint/source persistence, model history/prompts/routing/fallback/retry,
another provider, another ranking or score, public-source request-time reads,
new evidence collection or tables, dossier snapshot request authority,
artifacts/interviews, ingestion/materialization/evaluation, Phase 10, another
service/database, queue/worker/scheduler/cache/vector store, and candidate
execution.

## Contract and validation design

### Recommendation request

`OssRecommendationRequestV1` is one closed additive root:

```text
contractVersion
recommendationRequestId
capabilityQuery: CapabilityQueryInputV1
repositoryFingerprint: RepositoryFingerprintV1
transmissionApproval: existing transmission-approval schema
```

Its parser reuses both existing nested parsers, requires a non-null query
fingerprint reference, and requires exact `fingerprintId` plus deterministic
canonical content-digest equality. It also requires approval for all four
existing categories because a successful recommendation transmits bounded
evidence, candidate dossiers, the capability request, and the fingerprint. The
digest helper hashes the canonical
validated `RepositoryFingerprintV1` only. It does not create authority,
persistence, upload, snapshot, or lifecycle concepts.

### Target-fit traceability

`TargetFitAssessmentResponseV1` is one closed additive wrapper:

```text
contractVersion
fitAssessment: FitAssessmentResponseV1
inferenceRepositoryFactBindings[]:
  inferenceId
  repositoryFactIds[]
```

It does not duplicate or replace fit response, assessment, ranking, evidence,
claim, inference, limitation, unknown, or hard-conflict representations. The
target-fit validator first runs the existing fit response parser and
`validateFitAssessmentExchangeV1(...)`, then proves:

- binding inference IDs are unique and exist in the response;
- each binding has unique fact IDs and every fact exists in the supplied
  request fingerprint;
- no binding can refer to another target fact universe; and
- every `recommended` or `viable` candidate has a favorable material claim
  supported through at least one candidate-owned inference with candidate
  evidence and at least one binding to a supplied repository fact.

The existing exchange remains authoritative for exact candidate set, evidence,
limitations, supplied candidate unknowns, ownership, hard constraints, positive
candidate-evidence support, ranking, and the requested maximum. Application
validation additionally compares the response against the exact deterministic
eligible finalists; evidence-needed and excluded candidates never enter the
request and therefore cannot be restored.

### Query bridge

For a normalized query, construct `CapabilityRequestV1` deterministically:

- `requestId` is the existing query input ID; the recommendation request ID is
  retained as fit correlation ID;
- `capabilityFamily` is the normalized primary family;
- `summary` and success conditions are unchanged;
- required and prohibited draft constraints become hard constraints with the
  same IDs, reason codes, and statements;
- preferred draft constraints become preferences with the same IDs and
  statements; and
- the supplied transmission approval is unchanged.

The model context also carries the complete validated normalization result, so
facet, concept, source, rule, and modality information is not projected into a
lossy parallel form. No model interprets the query before deterministic
retrieval.

## Hosted application sequence and responsible outcomes

The application parses the full recommendation request, verifies fingerprint
binding, normalizes, and returns clarification-required or unsupported before
any evidence read or model call. It then constructs the existing retrieval
request and invokes the already-initialized engine.

Eligible and evidence-needed remain distinct authoritative lanes. The first
five deterministic eligible candidates are the only fit finalists. If there
are no eligible candidates and at least one evidence-needed candidate, return
`insufficient-evidence` without evidence reads or model. If both lanes are
empty, return `no-viable-candidate` without model. Evidence-needed candidates
never enter a dossier load or model candidate set.

The application captures one injected-clock cutoff, loads active dossiers only
for the finalists with that cutoff and normalized capability family, and
constructs the existing fit request with `requestedMaximumResults: 3` whenever
at least three finalists exist, or the exact smaller finalist count when only
one or two exist, as required by the existing V1 request validator. If all
finalist dossiers have no observations capable of grounding a positive
assessment, return `insufficient-evidence` without a model call. Otherwise it
sends one bounded fit request plus the exact normalization context to the
model port, treats the response as unknown data, validates it, and derives the
responsible option IDs only from the validated ranked candidate set. The full
target-fit response remains in a successful result for traceability.

Maximum model finalists: **5**. Maximum unique responsible options: **3**.
There is no numerical score and retrieval ordering is not relabeled as fit.

## Persistence and migration

Add `loadActiveCandidateDossier(...)` to the existing concrete PostgreSQL
adapter with only `candidateId`, expected capability family, and evidence
cutoff. Refactor/reuse the internal active-material selection so one read-only
transaction:

1. loads and validates the candidate identity record;
2. proves expected family membership;
3. selects bounded evidence visible and fresh at the cutoff;
4. excludes superseded or invalidated observations effective by the cutoff;
5. preserves candidate limitations and unknowns whose evidence remains active;
6. reconstructs `CandidateDossierV1` with null version scope; and
7. passes the authoritative dossier parser, failing closed on corrupt or
   inconsistent rows.

Migration 0006 grants `gitblocks_serving` `SELECT` only on:

- `gitblocks.catalog_candidates`;
- `gitblocks.candidate_capability_families`;
- `gitblocks.evidence_observations`;
- `gitblocks.evidence_supersessions`;
- `gitblocks.evidence_invalidations`;
- `gitblocks.candidate_limitations`; and
- `gitblocks.candidate_material_unknowns`.

No write, execute, DDL, migration, artifact, interview, evaluation, snapshot,
or broad-schema privilege is added. Missing evidence remains an empty dossier,
not manufactured evidence.

## Model boundary and OpenAI adapter

The hosted workspace owns one narrow `FitAssessmentModelPort` whose
`assess(...)` method returns `Promise<unknown>`. Deterministic application tests
inject controlled untrusted output. Composition injects one OpenAI Responses
adapter configured only by `OPENAI_API_KEY` and
`GITBLOCKS_HOSTED_FIT_MODEL`; both are explicit and value-free failures when
missing or malformed. The model configuration is valid only when the latter is
exactly `gpt-5.4-mini-2026-03-17`; it is a deployment assertion, not an
arbitrary model selector.

The adapter sends only the validated fit request and exact normalized query.
That request already contains the minimized fingerprint and no more than five
candidate dossiers. The authoritative target-fit JSON Schema remains
unchanged. The adapter creates a fresh recursive provider projection that
removes exactly `$id`, `$schema`, `uniqueItems`, `minLength`, and `maxLength`.
Canonical parsing and exchange validation re-enforce uniqueness, string
length, and all semantic invariants after the untrusted response. The provider
request uses the exact reviewed mini snapshot, `store: false`, `tools: []`, no
web/file/MCP tools, no background, no streaming, no conversation state, no
retries, no fallback or escalation, one bounded deadline, and fixed
request/response byte bounds.

The system instruction treats fingerprint and evidence as inert untrusted
data, limits assessment to supplied candidates, forbids invented evidence or
target facts and excluded-candidate restoration, preserves deterministic hard
constraints, requires material unknown disclosure, and permits an
insufficient-evidence outcome. Neither prompt nor provider response becomes
user-facing prose. Missing credentials, timeout/cancellation, network failure,
non-2xx, refusal, incomplete/no structured output, oversized response, invalid
UTF-8/JSON, or invalid structure produces a bounded value-free failure. The
adapter logs no credential, fingerprint, prompt, evidence, provider body, raw
response, or raw error.

## MCP and composition

The single Node composition remains:

```text
PostgreSQL serving client
  -> load serving snapshot once
  -> build immutable retrieval engine once
  -> configure one fit model adapter
  -> create hosted application
  -> create loopback MCP listener
```

Request-time effects are only active dossier `SELECT`s for at most five
finalists and at most one model request. The serving snapshot is never reloaded
per request. Shutdown remains listener first, then owned application/model
resources if any, then PostgreSQL.

MCP lists exactly `recommend_oss`, using the canonical
`oss-recommendation-request` schema and delegating to `recommendOss(...)`.
`discoverCapability(...)` may remain an internal application primitive, but
`discover_oss` is removed from the product surface. The adapter imports no
persistence operation, retrieval implementation, prompt construction, model
adapter, or fit-validation implementation.

## Security, privacy, observability, and operations

The fingerprint, query, candidate evidence, and model output are untrusted at
their respective boundaries. Raw target source, files, environment, secrets,
database contents outside finalist dossiers, excluded/evidence-needed
candidates, provider credentials, and evaluation gold are never transmitted.
The third-party provider remains a real disclosed transmission boundary, with
explicit caller approval and `store: false`; R6 creates no private target-data
store.

Production-path telemetry is structured, correlated by safe request identity,
bounded, and value-free. It records only stage/outcome, bounded counts, safe
failure class, and elapsed time where useful. It excludes request text,
fingerprint/evidence/prompt/response content, SQL, environment values,
credentials, stack traces, and raw exceptions. No deployment, SLO, dashboard,
queue, retry, or alerting system is added because R6 remains a loopback private
alpha composition.

## Implementation milestones

1. **Contracts and target grounding.** Add the request/wrapper schemas,
   digest/parser/exchange validation, lossless bridge tests, schema exports,
   and conformance coverage.
2. **Active evidence serving.** Add migration 0006, the concrete active
   dossier loader, exact least-privilege PostgreSQL tests, and cutoff/corruption
   tests.
3. **Recommendation application.** Add injected clock/dossier/model ports,
   responsible early outcomes, five-finalist construction, one model call,
   target-fit validation, and three-option projection.
4. **Provider and product surface.** Add the bounded OpenAI adapter/config,
   replace the MCP product tool with `recommend_oss`, and evolve the one Node
   composition without per-request snapshot reload.
5. **Exercise and documentation.** Complete real PostgreSQL plus controlled
   model plus official MCP client coverage, invalid-output rejection, ADR 0012,
   and current product/system/developer documentation.
6. **Final regression and publication.** Run the exact gates below, perform at
   most one authorized live provider acceptance, reconcile the plan, commit,
   push, and open the issue-linked draft PR.

## Testing and validation strategy

Focused development from repository root:

```text
pnpm runtime:check
pnpm --filter @gitblocks/contracts typecheck
pnpm exec vitest run packages/contracts/test --config vitest.config.ts
pnpm contracts:validate
pnpm --filter @gitblocks/persistence typecheck
pnpm exec vitest run packages/persistence/test --config vitest.config.ts
pnpm --filter @gitblocks/gitblocks-hosted typecheck
pnpm exec vitest run apps/gitblocks-hosted/test --config vitest.config.ts
pnpm architecture:check
pnpm repo:check
git diff --check
```

The pinned real PostgreSQL path is authoritative for migration, privilege,
active-evidence, and official-client end-to-end proof:

```text
pnpm db:verify
```

Final regression on the completed diff:

```text
pnpm contracts:validate
pnpm verify
pnpm verify:ci
git diff --check
git status --short
```

`pnpm verify:ci` supplies the required registry-backed audit after the full
local and database gates. R6 does not change evaluation contracts or mappings,
so `pnpm eval:validate`/`pnpm eval:fixtures` are exercised through the
authoritative repository verification but no new evaluation baseline is
created or claimed.

The end-to-end PostgreSQL test seeds a small representative evidence set with
existing persistence writes, uses a realistic valid fingerprint, invokes the
official MCP client against the loopback server with an injected controlled
model, and proves both a valid target-grounded recommendation and fail-closed
invented evidence/fact/candidate output. No live OpenAI call occurs in CI.

After deterministic/provider-boundary tests pass, run exactly one live
acceptance only if an authorized `OPENAI_API_KEY` is present and
`GITBLOCKS_HOSTED_FIT_MODEL` equals `gpt-5.4-mini-2026-03-17`. Use only
synthetic fingerprint facts, public evidence, and temporary PostgreSQL. Record
only model identifier, success/failure, deterministic-validation result,
counts, and safe elapsed/token facts. Otherwise record the unavailable
credential/configuration pair without blocking R6.

## Migration, compatibility, rollout, and recovery

Both product contracts are additive V1 roots and do not alter existing V1 fit
semantics. The MCP tool replacement is intentional before any remote/public
consumer exists. Migration 0006 is forward-only and privilege-only; rollback
is `REVOKE SELECT` on the seven named tables or code rollback. It creates no
data and does not change table shape. Existing offline writers and evidence
lifecycle remain authoritative.

Rollout remains local composition startup after migrations and a serving
snapshot exist. An empty evidence corpus returns responsible
`insufficient-evidence`; it does not block startup or trigger collection.
Provider failure safely fails the operation. No public compatibility,
availability, or deployment claim is made.

## Exact exit criteria

- A contract-valid request with exact fingerprint binding reaches
  `recommend_oss`; malformed or mismatched fingerprints fail before retrieval.
- Clarification and unsupported stop before evidence/model effects.
- Retrieval remains deterministic and authoritative; only the first five
  eligible candidates are loaded/sent and evidence-needed candidates cannot be
  promoted.
- One cutoff governs every active dossier and the fit request; serving reads
  are least privilege and request-time snapshot reload/write/collection is
  absent.
- Missing positive candidate evidence returns `insufficient-evidence` without
  a model call.
- At most one bounded provider request occurs. The output passes the existing
  fit parser/exchange plus exact preservation and target-fact validation or is
  rejected without repair.
- Positive fit has both candidate-owned evidence and at least one supplied
  repository fact. Hard conflicts cannot become viable/recommended.
- The validated responsible option set has at most three unique candidate
  IDs, with no numerical fit score.
- The official MCP client lists only `recommend_oss` and proves a valid
  target-grounded recommendation plus invalid-model-output rejection through
  real PostgreSQL.
- ADR 0012 and current-state documentation accurately preserve the R7
  scanner/Skill gap and the Phase 10 supersession.
- Focused gates, `pnpm contracts:validate`, `pnpm db:verify`, `pnpm verify`,
  `pnpm verify:ci`, diff/status review, issue/plan/PR evidence, and live
  acceptance or explicit credential absence are recorded.
- One intentional commit is pushed and one issue-linked draft PR is open.

## Progress log

- 2026-08-12: Verified clean R5 baseline, exact merged PR/closed issue,
  superseded Phase 10 documentation, runtime pin, governing product/system/
  engineering documents, applicable ADRs, existing fit/query/retrieval/
  persistence/hosted implementation, and current official OpenAI Responses
  Structured Outputs mechanics. Created Issue #42 and branch
  `feat/42-codebase-conditioned-recommendation`.
- 2026-08-12: Confirmed the target-fact traceability blocker, lossless
  query-to-fit bridge, seven-table active-dossier privilege set, five-finalist
  and three-option bounds, and issue-linked execution design.
- 2026-08-12: Implemented the additive recommendation request and target-fit
  wrapper contracts, canonical fingerprint digest, target-fact/exchange
  validation, and deterministic query bridge. Focused contract tests prove
  exact binding, target-grounded positive support, existing evidence exchange
  preservation, and authoritative schema exports.
- 2026-08-12: Added migration 0006 with exact seven-table serving grants and
  `loadActiveCandidateDossier(...)`. The pinned PostgreSQL suite proves
  non-owner reads, denied writes/artifact/interview/snapshot reads,
  supersession/invalidation cutoffs, limitation/unknown preservation, family
  membership, honest empty evidence, and corrupt-record rejection.
- 2026-08-12: Implemented the GitBlocks-owned recommendation application,
  injected cutoff/dossier/model ports, five-finalist eligible-lane boundary,
  responsible early outcomes, exact target-fit exchange validation, and
  three-option projection. Focused hosted tests pass the valid path, all early
  outcomes, evidence-needed separation, empty evidence, candidate/evidence/
  fact/hard-conflict rejection, and one-call maximum.
- 2026-08-12: Implemented the narrow OpenAI Responses adapter and explicit
  configuration with strict authoritative JSON Schema, `store: false`, no
  tools/background/streaming, two/four-MiB byte bounds, one 60-second deadline,
  and bounded provider failure classes. Loopback provider tests cover the
  authorization header, configured model, request controls, decode/refusal/
  non-2xx/oversize/deadline failures, and zero logging.
- 2026-08-12: Replaced the MCP product surface with exactly `recommend_oss`,
  evolved the one Node composition to reuse one retrieval snapshot while
  reading finalist evidence at request time, added the official-client
  controlled-model tests, ADR 0012, and current product/system/privacy docs.
- 2026-08-12: Maintainer compatibility review found the generated target-fit
  schema's 21 `uniqueItems`, 96 `minLength`, and 96 `maxLength` constraints.
  After an intentional stop and explicit authorization, narrowed the OpenAI
  adapter to one recursive five-key provider projection and pinned the sole R6
  model to `gpt-5.4-mini-2026-03-17`. The canonical contracts and validators
  remain unchanged and authoritative.

## Decision and deviation log

- 2026-08-12: Extend the existing fit response with one target-fact binding
  wrapper rather than changing `FitAssessmentResponseV1` or creating another
  ranking model. Existing fit/exchange validation remains authoritative;
  target grounding is an additive validation layer.
- 2026-08-12: Reconstruct active dossiers directly from existing evidence
  tables at the request cutoff. Dossier snapshots and limitation/unknown join
  tables are not serving inputs because the concrete loader does not query
  them.
- 2026-08-12: Keep `discoverCapability(...)` only as an internal reusable
  primitive if useful. The MCP product surface changes to exactly
  `recommend_oss`; no current remote consumer requires `discover_oss`.
- 2026-08-12: `CapabilityQueryInputV1` permits 32 total draft constraints while
  existing `CapabilityRequestV1` permits at most 20 hard constraints and 20
  preferences. The recommendation parser therefore rejects the unrepresentable
  case where either modality projection exceeds 20. Accepted requests retain
  every constraint exactly; no constraint is dropped, merged, or reinterpreted.
- 2026-08-12: The existing retrieval request schema already carries the full
  normalized query, including its optional fingerprint reference, but an R4
  semantic guard rejected every non-null reference. R6 removes only that stale
  no-fingerprint guard so the existing retrieval request can carry the exact
  R6 normalization identity. Retrieval does not interpret fingerprint facts;
  target conditioning remains exclusively in the later fit request/model and
  target-fact validator. No retrieval schema, algorithm, ranking, or version is
  changed.
- 2026-08-12: Existing `FitAssessmentRequestV1` validation requires
  `requestedMaximumResults <= candidates.length`. R6 therefore uses exactly
  three for the normal three-to-five-finalist path and the exact smaller count
  for a one- or two-finalist request. Changing the existing V1 invariant or
  padding the finalist set would be broader and less honest than preserving
  the fit kernel.
- 2026-08-12: A final loader-hardening attempt added insertion-time predicates
  to dossier reads. The pinned PostgreSQL suite rejected that change because
  the established evidence cutoff is evidence-world time (source publication,
  collection/validation, freshness, supersession, and invalidation), not a
  bitemporal database-history snapshot. The predicates and their test were
  removed; R6 reuses the existing cutoff semantics rather than silently
  changing evidence history.
- 2026-08-12: Select `gpt-5.4-mini-2026-03-17` as the sole initial
  private-alpha target-fit snapshot because this bounded five-finalist
  comparison does not justify frontier cost by default. Preserve the
  environment variable as an exact deployment assertion; reject aliases,
  arbitrary and fine-tuned models, and add no retry, fallback, routing, or
  escalation.
- 2026-08-12: The OpenAI strict-schema boundary uses one adapter-local,
  non-mutating recursive copy that removes only `$id`, `$schema`,
  `uniqueItems`, `minLength`, and `maxLength`. Provider shape assistance is not
  product truth; canonical GitBlocks parsing and exchange validation remain
  the post-response authority.

## Validation evidence

- `pnpm runtime:check` — passed before implementation.
- focused recommendation contract/schema tests — 43 tests passed across the
  new request, target-fit grounding, existing exchange preservation, strict
  Ajv schema compilation, digests, and legacy contract compatibility.
- `pnpm db:verify` — passed on PostgreSQL 18.4 with six migrations, 29 public
  product tables, zero RLS policies, 12 integration files and 70 tests without
  skips. The first two runs exposed additive-migration compatibility guards in
  the dormant interview operator; those guards were extended only to accept
  migration 0006, and the authoritative rerun passed.
- hosted recommendation/application/composition/MCP/provider focused suite —
  35 tests passed across five files with the official MCP client and loopback
  mocked Responses boundary.
- `pnpm verify` — passed after staging the new required example/ADR; 137 test
  files and 2,000 tests passed with formatting, build, lint, typecheck,
  architecture, repository, evaluation, contract, catalog, and secret gates.
- The final `pnpm db:verify` rerun passed after removal of the rejected
  insertion-time cutoff change: 12 integration files and 70 tests without
  skips, including the official-client valid recommendation and invalid-model
  rejection exercise.
- No authorized live provider acceptance was run because either
  `OPENAI_API_KEY` or explicit `GITBLOCKS_HOSTED_FIT_MODEL` configuration was
  absent. No credential value was read or recorded.
- `pnpm verify:ci` — passed: the full 137-file/2,000-test repository gate,
  architecture/repository/contract/catalog/evaluation/secret checks, the
  PostgreSQL 12-file/70-test gate, and the registry-backed audit with no known
  vulnerabilities.
- maintainer correction red-first provider/configuration run — 3 expected
  failures and 12 passes before implementation; after the local projection and
  exact-model pin, the same two-file run passed 15 tests.
- maintainer correction focused checks — OpenAI adapter 11 tests,
  recommendation contracts 9 tests, and hosted application 13 tests passed;
  hosted typecheck passed; architecture passed across 940 modules and 3,202
  dependencies with no violations.
- `pnpm format:check` initially identified the changed adapter test; the
  repository formatter corrected only that file. Final formatting is covered
  by the pending repository regression.
- The first maintainer-correction `pnpm verify:ci` attempt stopped at lint with
  five unsafe-accumulator findings in test-only recursive schema-inspection
  helpers. Explicit `unknown` accumulator typing resolved the findings;
  focused ESLint then passed. No production behavior changed in the fix.
- Live provider acceptance was deferred because the authorized credential plus
  exact `gpt-5.4-mini-2026-03-17` configuration pair was unavailable. No
  credential or model-variable value was printed or recorded.
- corrected maintainer regression `pnpm verify:ci` — passed after the recorded
  lint fix: 137 test files and 2,002 tests, formatting, build, lint, typecheck,
  architecture, repository, contract/catalog/evaluation/secret gates,
  PostgreSQL 12 files and 70 tests without skips, and registry audit with no
  known vulnerabilities.
- Maintainer correction diff/status review, commit, push, and PR evidence
  update remain pending.
