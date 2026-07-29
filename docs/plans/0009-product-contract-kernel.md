# Phase 3 product contract kernel execution plan

## Status and authority

- Governing issue:
  [#9 — Phase 3: Establish the product domain and contract kernel](https://github.com/kgudipati/gitblocks/issues/9)
- Branch: `feat/9-product-contract-kernel`
- Owner: GitBlocks maintainers
- State: final authority-immutability correction is in progress on the
  published topic branch; implementation, complete validation, ordinary
  follow-up publication, PR-description reconciliation, and corrected hosted
  Verification remain pending; draft PR #10 remains open, draft, and unmerged
- Last updated: 2026-07-28
- Authority order:
  1. Issue #9.
  2. The checked-out repository and Git history.
  3. The [product contract](../product/product-contract.md).
  4. The [system context](../architecture/system-context.md) and accepted ADRs.
  5. `AGENTS.md`, `PLANS.md`, and the engineering handbook.
  6. The Phase 3 execution prompt.

Issue #9 owns scope, invariants, contract fields, tests, acceptance criteria,
and non-goals. This plan maps those requirements to implementation and
evidence; it does not narrow or replace them.

## Purpose and user-visible outcome

GitBlocks will gain its first production-owned code: a pure domain package and
a separate versioned contract package for fixed-candidate,
repository-conditioned OSS fit assessment. Later application, HTTP, MCP,
database, GitHub, scanner, model, and queue adapters will be able to consume one
owned vocabulary and contract boundary instead of inventing incompatible
shapes.

The completed slice will provide:

- owned domain values and pure cross-field invariants;
- six version `1.0.0` DTO contract families;
- runtime parsers from `unknown` with safe bounded diagnostics;
- deterministic language-neutral schema artifacts from the authoritative
  contract definitions;
- an offline mapping that proves all ten Phase 2 pilot cases, evidence sets,
  and proposed gold records are representable; and
- executable architecture and repository rules protecting dependency
  direction.

This phase does not discover candidates, assess recommendation quality, execute
candidate code, call a model, scan a repository, persist data, expose a
transport, or deploy anything.

## Verified current repository state

Verified on 2026-07-28 before editing:

- `git status --short --branch` reported clean `main...origin/main`.
- `origin` fetch and push URLs are
  `https://github.com/kgudipati/gitblocks.git`.
- `git fetch origin`, `git switch main`, and
  `git pull --ff-only origin main` completed without changing `main`.
- `HEAD` and `origin/main` both resolved to
  `27eb7d6585c30fd0f78f238543a764ca7b3c4f76`.
- The visible history starts with the merged Phase 2 squash commit
  `27eb7d6 test: establish OSS adoption evaluation pilot`.
- Connected GitHub evidence shows PR #8 merged into the expected commit, Issue
  #7 closed as completed, and Issue #9 open.
- `gh` is unavailable in the local shell. Connected GitHub access is the
  approved metadata alternative; local Git remains authoritative for checkout
  state.
- No `packages/` product package or contract kernel existed on `main`.
- The repository contained three workspace projects: the root plus private
  `@gitblocks/repository-checks` and `@gitblocks/evaluation-harness` tooling.
- `.node-version` and `.nvmrc` both pin Node `24.18.0`; the root manifest pins
  pnpm `11.17.0` and TypeScript `6.0.3`.
- The non-interactive shell initially did not load `nvm`, exposed no `node`,
  and found bundled pnpm `11.9.0`. No installation or policy bypass occurred.
  Sourcing the already-provisioned
  `/Users/karthikgudipati/.nvm/nvm.sh` made `nvm use` select the repository
  pins.
- Under Node `24.18.0` and pnpm `11.17.0`, the required baseline passed:
  `pnpm runtime:check`, frozen installation, `pnpm verify`,
  `pnpm eval:validate`, and `pnpm eval:fixtures`.
- Baseline tests: 18 files and 302 tests passed.
- Baseline architecture: 158 modules and 401 dependencies, with no violations.
- Evaluation validation reported 10 cases. Weak fixtures remained harness
  checks, not product or model baselines.
- The worktree remained clean after the baseline.

Applicable repository artifacts inspected before implementation:

- [Product contract](../product/product-contract.md)
- [System context](../architecture/system-context.md)
- [ADR 0001](../architecture/decisions/0001-agent-native-delivery.md)
- [ADR 0002](../architecture/decisions/0002-typescript-workspace-and-toolchain.md)
- [Development standards](../engineering/development-standards.md)
- [Testing strategy](../engineering/testing-strategy.md)
- [Security baseline](../engineering/security-baseline.md)
- [Observability and reliability policy](../engineering/observability-and-reliability.md)
- [Repository workflow](../engineering/repository-workflow.md)
- [Definition of done](../engineering/definition-of-done.md)
- [`AGENTS.md`](../../AGENTS.md), [`PLANS.md`](../../PLANS.md),
  [`CONTRIBUTING.md`](../../CONTRIBUTING.md), and [`README.md`](../../README.md)

## Scope and explicit non-goals

### In scope

- Create ADR 0003 and maintain this plan.
- Add exactly `packages/domain` and `packages/contracts`, both private.
- Define the Issue #9 vocabulary, pure invariants, structural schemas, safe
  parsers, DTO-to-domain mapping, package exports, and tests.
- Add only exact, evidence-reviewed dependencies required by the accepted
  schema mechanism; update `pnpm-lock.yaml` only through pnpm.
- Export all six version `1.0.0` language-neutral schemas deterministically.
- Extend `tools/evaluation-harness` with a bounded offline product-contract
  conformance operation over the existing ten cases.
- Add `pnpm contracts:validate` and integrate it once into the authoritative
  verification graph.
- Update architecture rules, repository invariants, root workspace/type/test
  configuration, and the documentation named by Issue #9.
- Publish ordinary commits to the required branch, open the exact draft PR,
  and inspect hosted CI and decoded Verification logs.

### Explicit non-goals

No API, HTTP server, GraphQL, RPC, MCP server, database, ORM, migration, cache,
queue, object store, scanner, crawler, ingestion worker, GitHub client,
registry/security-feed client, model provider, embedding/search/ranking
algorithm, application service, authentication implementation, Skill, plugin,
SDK generation, telemetry backend, deployment, container, infrastructure, or
placeholder application/package is authorized.

The change will not:

- perform open-world candidate discovery;
- fetch or execute candidate code;
- expose or accept raw source, secrets, prompts, provider payloads, or logs;
- modify evaluation scoring except for the narrow conformance entry point;
- duplicate the Phase 2 corpus;
- accept proposed gold or call it independently reviewed;
- run a live model, GitBlocks, or generic-agent baseline;
- publish an npm package;
- mark the draft PR ready or merge it; or
- modify or push `main`.

## Assumptions, risks, and unresolved decisions

### Verified facts

- The six product contract families and their minimum required content are
  fixed by Issue #9.
- The evaluation corpus contains ten fixed-candidate development cases, and
  its gold remains proposed and independently unaccepted.
- No deployed or persisted consumer constrains the initial unpublished V1
  layout.
- The existing evaluation types and schemas are evaluation-only and cannot
  become the product authority.

### Working assumptions

- Product parsers receive already-materialized JavaScript values. Future
  adapters will enforce byte, decompression, content-type, and JSON-text
  parsing limits before invoking this object-value boundary.
- No deployed, persisted, or public consumer exists while V1 is under Issue #9
  review. Any later consumer must negotiate a separately versioned shape
  rather than assuming the private workspace package version is the contract
  version.

### Known risks and controls

- Closed outer objects are insufficient if a generic metadata/value field can
  carry secrets or source. Control: use finite typed fact variants and reject
  arbitrary records.
- Exhaustive validator diagnostics could allocate excessively before results
  are sliced. Control: preflight the object graph, use an early bounded
  validation strategy where available, and test diagnostic-flood inputs.
- A response parsed without request context cannot prove it assesses the
  caller's supplied set. Control: enforce response-local uniqueness and add a
  request/response consistency validator used by conformance and future
  application boundaries.
- Candidate-conditioned reasons/evidence can be reassigned unless ownership is
  explicit. Control: evidence, claims, conflicts, inferences, and unknowns
  carry candidate identity where applicable, and domain validation checks
  those associations.
- Sorting every collection would destroy meaningful request or rank order.
  Control: canonicalize only catalogs and unordered reference sets; document
  each preserved order.
- Rapid schema-library releases can create compatibility churn. Control: exact
  pin, narrow imports, one ADR-owned mechanism, stable GitBlocks parser result,
  schema-output tests, and measurable revisit triggers.
- The root TypeScript configuration currently injects Node types. Control:
  product package configurations override `types` to an empty list so the pure
  domain cannot accidentally acquire Node APIs.

### Resolved decisions

- ADR 0003 selects unscoped `typebox@1.3.8` as the authoritative DTO,
  TypeScript-type, and JSON Schema source, with `ajv@8.20.0` as a private
  strict Draft 2020-12 structural validator.
- Schema artifacts are deterministic runtime exports with canonical
  serialization and exact digest tests, not committed generated JSON copies.
- Exact policy bounds and DTO layouts are fixed in the TypeBox source and
  exercised by minimum, composed-maximum, and rejection tests. Parser
  preflight is bounded to depth 32, 200,000 visited/scheduled nodes, 64
  properties per object, 2,000 array items, 4,096 UTF-16 code units per scalar
  string value or property name, and 64,000,000 aggregate value/name string
  code units before schema-specific bounds apply.
- Each response is self-consistent against its declared supplied candidate set.
  The public `validateFitAssessmentExchangeV1` function additionally parses
  both values and proves request linkage, exact candidate/evidence/unknown
  and candidate-limitation preservation, cutoff equality, requested-result
  limits, and hard-constraint identity.
- Evaluation conformance does not invent evidence-derived inferences from
  proposed narrative. It maps direct observations as evidence, preserves
  explicit unknowns, and uses the proposed dispositions/ranking only to test
  response representability.
- Repository fingerprints retain typed component/version and deployment facts
  plus one closed coded shape for coarse capability, structure, identity,
  data-policy, and operations facts. A separately negotiated controlled
  vocabulary owns code semantics. Evaluation context sentences are exact
  matching keys at the harness boundary only and cannot enter the product DTO
  as free text.

### Unresolved decisions

None remain for this execution. Independent review reconciliation, the complete
pinned-runtime validation matrix, publication metadata, and corrected hosted CI
evidence are complete. Independent final review and merge authorization remain
outside this execution.

## Applicable ADRs and contracts

- The [product contract](../product/product-contract.md) keeps its approved
  product semantics and owns the six families, vocabulary,
  data-locality/transmission boundary, responsible abstention,
  hard-constraint safety, and first-release non-goals. Its status/current-state
  prose is updated to acknowledge the locally implemented kernel without
  claiming later components exist.
- [ADR 0001](../architecture/decisions/0001-agent-native-delivery.md) remains
  accepted and unchanged. It requires local minimization, untrusted content as
  data, a future small goal-oriented MCP surface, and no implicit edit
  authority.
- [ADR 0002](../architecture/decisions/0002-typescript-workspace-and-toolchain.md)
  remains accepted and unchanged. It requires Node/pnpm/TypeScript pins,
  strict ESM, package public exports, pnpm-only lockfile generation, current
  verification, and supply-chain controls; it explicitly deferred the product
  schema choice now decided by ADR 0003.
- Accepted [ADR 0003](../architecture/decisions/0003-product-contract-kernel.md)
  decides the authoritative product mechanism and supersedes only ADR 0002's
  formerly open schema-mechanism decision.
- Evaluation JSON Schemas remain private evaluation contracts. They inform the
  harness-side mapping but are neither changed into nor consumed as product
  contracts.
- No persisted, HTTP, MCP, job, event, storage, or transport encoding contract
  exists or is created.

## Requirements crosswalk

### Ownership, design, and package deliverables

| Issue #9 requirement                                                                                                    | Destination                                                           | Milestone | Required evidence                                                                              |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| Maintain the issue-linked living execution plan before and during implementation                                        | This file                                                             | 1–6       | Required sections, dated progress/decision/failure entries, final reconciliation               |
| Research serious current schema approaches without selecting Ajv merely because it was already present                  | [ADR 0003](../architecture/decisions/0003-product-contract-kernel.md) | 1         | Primary-source/registry comparison for TypeBox, Zod, Valibot, and JSON-Schema-first approaches |
| Record structural/domain, DTO/domain, evaluation/product, storage/domain, and transport/domain boundaries               | ADR 0003, package READMEs, system context                             | 1–5       | Architecture review and link/repository checks                                                 |
| Add exactly two private production-owned packages                                                                       | `packages/domain`, `packages/contracts`                               | 2–4       | Workspace inventory and `pnpm repo:check`                                                      |
| Keep `@gitblocks/domain` pure with no runtime or outward workspace dependency                                           | `packages/domain`, dependency-cruiser, repository invariants          | 2–4       | Manifest review, architecture fixtures/check, source import audit                              |
| Keep `@gitblocks/contracts` dependent only on domain and the approved schema mechanism                                  | `packages/contracts`, dependency-cruiser, repository invariants       | 3–4       | Exact manifest graph, negative fixtures, architecture check                                    |
| Own the five capability families and all Issue #9 domain vocabulary without importing evaluation types                  | Domain model/public exports                                           | 2         | Vocabulary tests, TypeScript API review, prohibited-import checks                              |
| Prefer readonly values, branded identifiers, pure constructors/validators, explicit results, and deterministic ordering | Domain model, canonicalizers, validators                              | 2         | Focused domain tests, lint/typecheck, full diff review                                         |
| Expose a narrow public package surface instead of deep imports                                                          | Both package `exports` and `src/index.ts` files                       | 2–4       | Public-export tests, repository invariants, package build                                      |
| Preserve `tools/evaluation-harness -> packages/contracts -> packages/domain`                                            | Workspace manifests and architecture policy                           | 4         | Dependency-cruiser graph and negative architecture fixtures                                    |

### Exact version `1.0.0` contract inventory

| Contract family               | Required V1 fields and constraints                                                                                                                                                                                                                                                                                                                                                                                       | Destination                                                             | Evidence                                                                                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capability request            | `contractVersion`, `requestId`, `capabilityFamily`, bounded `summary`, non-empty `successConditions`, `hardConstraints` with stable `reasonCode`, `preferences`, and bounded `transmissionApproval` containing `approvalId`, `approvedAt`, fixed approver/scope, and unique approved categories                                                                                                                          | TypeBox capability-request root and domain mapper                       | Minimum/maximum forms; family, ID, approval, timestamp, hidden-field, source/prompt/token negatives                                                                                                                 |
| Repository fingerprint        | `contractVersion`, independently negotiated `factVocabularyVersion`, `fingerprintId`, bounded typed component/deployment plus closed coded `facts`, and bounded unique `withheldCategories`; coded facts use coarse categories, stable code/subject identifiers, explicit bounded value variants, and repository-local provenance with preserved epistemic status                                                        | TypeBox repository-fingerprint root and domain mapper                   | Ten pilot mappings plus six non-pilot fixtures; vocabulary/semantic negotiation, structured-fact correlation, direct/declared/derived preservation, minimization, secret/source/config/log/command-output negatives |
| Candidate dossier             | `contractVersion`, candidate `identity` with GitHub repository and optional npm package, `capabilityFamily`, nullable `versionScope`, bounded direct `observations`, candidate-owned coded `limitations`, and `unknowns`; observation provenance is a source-aware discriminated variant with exact revision/locator, chronology, freshness, and limitation semantics                                                    | TypeBox candidate-dossier root and domain mapper                        | Valid/invalid source matrix, ownership, exact revisions, aliases/branch references, chronology/freshness, limitation integrity, absent-value, 40-unknown, and bound tests                                           |
| Fit-assessment request        | `contractVersion`, `assessmentRequestId`, nested capability request and repository fingerprint values, 1–20 supplied `candidates`, `evidenceCutoff`, `requestedMaximumResults`, and `correlationId`; no discovery/search flag                                                                                                                                                                                            | TypeBox fit-assessment-request root and domain mapper                   | Candidate-count, family, cutoff, exact approval scope, requested-maximum, nested-version, unknown discovery-field tests                                                                                             |
| Fit-assessment response       | `contractVersion`, `assessmentId`, `assessmentRequestId`, `correlationId`, responsible `outcome`, exact `suppliedCandidateIds`, exactly one entry in `candidateAssessments` per supplied candidate, separate `evidence`, `inferences`, `candidateLimitations`, `materialClaims`, `materialUnknowns`, preserved `hardConstraintConflicts`, ranking structures, `evidenceCutoff`, `producedAt`, and `assessmentProcessing` | TypeBox fit-assessment-response root, domain result, exchange validator | Exact candidate/evidence/unknown/limitation preservation, reason traceability, disposition/outcome, partial ranking, temporal/processing semantics, and 20-candidate maximum tests                                  |
| Stable neutral error envelope | `contractVersion`, finite safe `code`, matching finite safe `message`, bounded value-free `issues` with finite `code` and semantic `path`, finite `retry`, and optional `correlationId`; no transport status/code                                                                                                                                                                                                        | TypeBox error-envelope root and semantic validator                      | Every safe path/category, code/message/retry correlation, and stack/input/provider/database/path/queue rejection tests                                                                                              |
| All six roots                 | Stable versioned `$id`, Draft 2020-12 `$schema`, closed nested shapes, bounded strings/arrays, no defaults, no coercion, no evaluation-only fields                                                                                                                                                                                                                                                                       | TypeBox source and schema catalog                                       | Exactly-six registry test, strict Ajv compilation, keyword/closure checks, canonical serialization digests                                                                                                          |

### Parser, invariant, and exploit-test guarantees

| Issue #9 requirement                                                                                                                                                             | Destination                                           | Milestone | Required evidence                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Each of the six named parsers accepts `unknown` and returns an explicit typed success/failure result                                                                             | Contract parser exports                               | 3         | Public API/typecheck tests; no unchecked final cast                                                                                                                     |
| Reject missing, wrong, future, prerelease, and nested wrong contract versions                                                                                                    | Structural validator and parser diagnostics           | 3         | Root and nested version regression table                                                                                                                                |
| Reject unknown fields on every untrusted object, with no coercion, default insertion, or property removal                                                                        | Closed TypeBox helper and private Ajv options         | 3         | Extra-hidden-field, coercion, absent-value, and schema inspection tests                                                                                                 |
| Do not mutate caller input                                                                                                                                                       | Structural validation and fresh DTO-to-domain mapping | 3         | Frozen/readonly and deliberate mutation-attempt tests                                                                                                                   |
| Run structural validation, then explicit mapping, then pure domain validation                                                                                                    | Contract parsers and domain validators                | 2–3       | Focused structural/domain failure cases and parser result assertions                                                                                                    |
| Bound object-value and string work before Ajv                                                                                                                                    | Iterative preflight                                   | 3         | Cycle, depth, composed node, object-property, array-breadth, per-string/aggregate-string, sparse/hidden array property, accessor, prototype, and diagnostic-flood tests |
| Return stable, deterministic, value-free diagnostics                                                                                                                             | Diagnostics module                                    | 3         | Maximum 20 issues, 256-character path, 160-character message, stable sort, no rejected key/value/validator-param echoes                                                 |
| Perform no I/O, dynamic import, schema loading, candidate execution, or interpretation of malicious text                                                                         | Product packages and architecture rules               | 2–4       | Source audit, architecture checks, inert malicious-text tests                                                                                                           |
| Normalize and bound IDs; reject duplicate IDs/facts and contradictory semantic facts                                                                                             | Domain identifiers and request/fingerprint validation | 2         | Malformed/duplicate catalogs, semantic structured-fact correlation, canonical ordering tests                                                                            |
| Assess every supplied candidate exactly once and preserve candidate ownership                                                                                                    | Result and exchange validation                        | 2–3       | Omitted/duplicate/unknown assessment, moved reason, moved evidence, request-link tests                                                                                  |
| Resolve every evidence, inference, claim, unknown, conflict, and candidate reference                                                                                             | Domain reference validators                           | 2         | Unresolved and cross-candidate reference tests                                                                                                                          |
| Keep evidence and inference separate; require inference evidence; prevent shared evidence/inference identity                                                                     | Domain result validation                              | 2         | Empty-inference and disguised-variant/identity-collision tests                                                                                                          |
| Require every material claim to reference evidence, inference, or both; do not turn an unknown into a favorable claim                                                            | Domain result validation                              | 2         | Traceability and unresolved-unknown tests                                                                                                                               |
| Require every recommended or viable disposition to expose a same-candidate favorable attributable claim                                                                          | Domain result validation                              | 2         | Zero-evidence positive-disposition and claim-direction regressions                                                                                                      |
| Preserve request evidence and candidate unknowns exactly across the exchange                                                                                                     | Exchange validator                                    | 2–3       | Missing, reassigned, or modified evidence/unknown regression tests                                                                                                      |
| Reject known hard conflicts unless the candidate is rejected; preserve matching constraint reason/evidence; exclude rejected/insufficient candidates from ranking                | Domain result/exchange validation                     | 2         | Viable/recommended/ranked conflict and preservation tests                                                                                                               |
| Enforce all three responsible outcome/disposition combinations                                                                                                                   | Domain result validation                              | 2         | Exhaustive valid/invalid outcome matrix                                                                                                                                 |
| Support ties, partial orders, and incomparable pairs while rejecting duplicates, cycles, and overlapping relation kinds                                                          | Ranking validator                                     | 2         | Tie/ordered/incomparable pair matrix, cycle and tie-propagation tests                                                                                                   |
| Bound ranking relations deterministically for 20 candidates                                                                                                                      | Response schema and ranking validator                 | 2–3       | Accepted maximum 190 ordered relations and 190 incomparable pairs; stable canonical diagnostics                                                                         |
| Enforce timestamp validity/order, evidence cutoff, request/response linkage, processing-state semantics independent of unknowns, approval coverage, and requested result maximum | Request, result, and exchange validators              | 2–3       | Calendar-invalid/future evidence, cutoff/production order, complete-with-unknown, partial-without-reason, approval-category, and requested-maximum tests                |
| Detect schema artifact drift without a second schema authority                                                                                                                   | Runtime schema catalog and canonical serializer       | 3         | Six exact digest tests and fresh-clone isolation                                                                                                                        |
| Reject evaluation-only gold/corpus fields at product boundaries                                                                                                                  | Closed product schemas                                | 3–4       | Product parser negatives for evaluation gold fields                                                                                                                     |
| Fail evaluation conformance when a source field or semantic mapping is lost                                                                                                      | Harness mapping/accounting                            | 4         | Field-disposition tables, exact context matching, intentional field-loss regression                                                                                     |
| Prevent product imports from `evals/`, gold, or `tools/`, and prevent product imports of adapters/providers/storage                                                              | Architecture and repository checks                    | 4         | Positive/negative fixtures plus production source inventory                                                                                                             |

The exploit suite explicitly covers wrong versions, hidden fields, coercion,
input mutation, duplicate IDs, unresolved references, inference without
evidence, evidence/inference disguise, unsafe hard-conflict dispositions and
ranking, invalid outcomes, candidate omission/duplication/reassignment,
ranking cycles and relation collisions, control and bidirectional characters,
oversized and aggregate-flood strings/arrays, deep/broad/diagnostic-flood
inputs, composed maximum legal responses, accessor and non-plain objects,
throwing proxies, secret/raw-source-like fields, source/revision mismatch and
mutable alias forms, inert malicious narrative, unsupported candidate reasons,
disappearing limitations, unknown suppression, unsupported positive
dispositions, unsafe error internals, schema drift, prohibited imports,
evaluation field loss, and accidental product acceptance of gold-only fields.

### Required exploit and regression crosswalk

| Required negative or abuse case                                                                                                                  | Boundary under test                                 | Required evidence                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Wrong root contract version and wrong nested capability/fingerprint/dossier version                                                              | Structural/version diagnostics                      | Parser version tables assert stable version classification                                                                  |
| Extra hidden field, including prompt/message/discovery and evaluation-gold fields                                                                | Every closed object and union branch                | Parser unknown-field regressions across all six roots                                                                       |
| String/number/boolean coercion attempt and missing value that a default might favor                                                              | Ajv structural stage                                | Non-coercion/non-default tests preserve the original input                                                                  |
| Caller input mutation                                                                                                                            | Parser and DTO-to-domain mapper                     | Before/after deep equality and frozen-input tests                                                                           |
| Duplicate stable IDs and contradictory duplicate facts                                                                                           | Domain catalogs and structured fact semantic keys   | Duplicate-ID, duplicate-fact, and contradictory-fact tests                                                                  |
| Unknown/unsupported coded fact, or raw source/configuration/environment/secret/log/command-output/arbitrary metadata carrier                     | Fingerprint structural and vocabulary validation    | Six non-pilot positives plus unknown-code, semantic-mismatch, closure, and non-echoing carrier negatives                    |
| Incoherent source/revision, mutable alias or branch reference, partial package version, locator mismatch, or invalid chronology                  | Evidence structural and domain validation           | Exhaustive source compatibility table, exact revisions, immutable locator, timestamp order, and safe diagnostic tests       |
| Unresolved candidate, evidence, inference, unknown, claim, and conflict references                                                               | Domain reference validation                         | Per-reference stable issue-code tests                                                                                       |
| Inference without evidence; evidence disguised as inference or inference sharing an evidence ID                                                  | Structural variants and domain semantics            | Empty-evidence and variant/identity-conflict tests                                                                          |
| Recommended or viable candidate with no favorable attributable claim                                                                             | Positive-disposition support                        | Zero-evidence recommendation rejection at domain and parser layers                                                          |
| Hard-conflicting candidate marked viable/recommended or included in any ranking form                                                             | Disposition, conflict preservation, and ranking     | Viable/recommended/ranked hard-conflict regressions                                                                         |
| Invalid responsible outcome/disposition combination                                                                                              | Result semantics                                    | Exhaustive outcome/disposition table                                                                                        |
| Candidate omitted, duplicated, or not supplied                                                                                                   | Response-local and exchange candidate sets          | Omission, duplicate, unknown, and different-request-set tests                                                               |
| Candidate reason moved to another candidate                                                                                                      | Candidate reason ownership                          | Cross-candidate reason reassignment test                                                                                    |
| Candidate reason has no candidate-owned evidence/inference, disclosed unknown, or matching evidenced hard conflict                               | Reason-local traceability                           | Unsupported reason/tradeoff and every-disposition regressions; hard-conflict reason/evidence preservation tests             |
| Candidate evidence moved, omitted, or changed while retaining its ID                                                                             | Evidence ownership and exact exchange preservation  | Reassignment, omission, and modified-observation tests                                                                      |
| Candidate unknown omitted or changed while retaining its ID                                                                                      | Exact exchange preservation                         | Omitted and modified statement/reference tests                                                                              |
| Candidate limitation omitted, moved, altered, contradicted, or duplicated under the same or a relabeled code                                     | Limitation catalogs and exact exchange preservation | Request/result ownership, canonical content, assessment reference, and viable-tradeoff tests                                |
| Complete processing suppresses an unknown, or partial-evidence processing omits a bounded reason code                                            | Processing-state and exchange validation            | Complete-with-unknown, complete-insufficient, partial-with/without-reason, and unknown-preservation tests                   |
| Ranking cycle, duplicate membership/relation, tied plus ordered, tied plus incomparable, ordered plus incomparable, and tie-propagation conflict | Partial-order validation                            | Focused ranking matrix and maximum 190-pair tests                                                                           |
| Control, C1, bidirectional, line-separator, and other unsafe display characters                                                                  | Bounded string patterns and safe diagnostics        | String-policy rejection tests without sentinel echo                                                                         |
| Oversized scalar, aggregate string work, schema array, object, sparse/extended array, array breadth, depth, total nodes, and diagnostic flood    | Schema bounds and iterative preflight               | Multi-megabyte scalar, aggregate flood, composed-maximum, limit-edge, and one-over tests; accessor getters remain uninvoked |
| Attempted secret-like, credential/userinfo/query-token, raw-source/config/manifest/log/database/untracked/command-output field                   | Fingerprint, URL, and all closed DTOs               | Prohibited-carrier parser tests with no rejected-value echo                                                                 |
| Arbitrary malicious narrative that fits an allowed text field                                                                                    | Inert-data boundary                                 | Accepted parse with byte-for-byte inert text and no execution                                                               |
| Already-executable throwing JavaScript `Proxy`                                                                                                   | Preflight/validator/mapping containment             | Trap invocation is acknowledged; parser returns exactly one bounded value-free issue with no trap text or stack             |
| Error envelope stack, rejected input, provider payload, database error, internal path, table name, or queue name                                 | Neutral error structural/semantic validation        | Unknown-field and finite code/message/retry/path rejection tests                                                            |
| Schema artifact drift or mutation of a returned artifact                                                                                         | Runtime schema registry/serializer                  | Exact digests, clone isolation, strict meta-schema compilation                                                              |
| Product source/test importing `evals/`, evaluation gold, `tools/`, or outward layers                                                             | Dependency-cruiser and repository invariants        | Positive/negative architecture fixtures and source inventory                                                                |
| Evaluation mapping loses a source field or accepts an unknown context sentence                                                                   | Harness field accounting and exact context map      | Intentional field-removal/unmapped-context regressions                                                                      |
| Product validation accepts evaluation-only rationale, scoring, lifecycle, or gold fields                                                         | Product schema closure                              | Gold-only field injection regressions                                                                                       |

### Integration, documentation, dependency, completion, and non-goal proof

| Issue #9 requirement                                                                                                                       | Destination                                  | Milestone | Required evidence                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| Map all ten existing cases without copying the corpus                                                                                      | Harness conformance module                   | 4         | Deterministic 10-case/40-candidate conformance result                                    |
| Map case to request/fingerprint, evidence to dossiers, and proposed gold to response representability only                                 | Harness mapper                               | 4         | Parser/exchange success for every bundle and field-accounting review                     |
| Retain proposed/not-reviewed provenance and keep gold blind to prediction workflows                                                        | Conformance report and evaluation docs       | 4–5       | Report assertions, import/CLI review, unchanged scorer behavior                          |
| Keep the independent evaluator/scorer and existing evaluation validation authoritative for evaluation correctness                          | Existing harness paths                       | 4         | `pnpm eval:validate`, `pnpm eval:fixtures`, legacy CLI isolation tests                   |
| Add one root `pnpm contracts:validate` command and wire it once into verification                                                          | Root package and harness CLI                 | 4         | CLI exit tests and verification graph review                                             |
| Update dependency-cruiser, repository invariants, root scripts/references, and Vitest without redundant product execution                  | Named root/tooling files                     | 4         | Architecture/repository tests and command graph review                                   |
| Update README, AGENTS, CONTRIBUTING, development standards, testing strategy, system context, evaluation docs, package docs, ADR, and plan | Named documentation                          | 1–5       | Format/link/repository checks and complete diff review                                   |
| Pin only justified dependencies and preserve every supply-chain policy                                                                     | Contracts manifest, pnpm lockfile, ADR 0003  | 1–3       | Exact graph review, pnpm-generated lockfile, frozen install, secret scan, registry audit |
| Prove exactly two product packages, domain zero runtime dependencies, and contracts only inward plus TypeBox/Ajv                           | Repository invariants and manual audit       | 5         | `pnpm repo:check`, architecture graph, manifest/source inventory                         |
| Prove six `1.0.0` roots, one-source type/schema authority, both validation stages, immutability, and value-free diagnostics                | Contract tests and manual API/schema review  | 3–5       | Focused suites plus exact validation matrix                                              |
| Prove all ten conformance mappings, gold remains proposed, scoring remains independent, and no live baseline ran                           | Harness tests/docs and manual review         | 4–6       | Conformance output, evaluation command results, diff/process record                      |
| Prove no API/MCP/database/ORM/migration/queue/cache/scanner/crawler/ingestion/GitHub/model/ranking/deployment implementation was added     | Repository inventory and architecture review | 5–6       | Full diff/source inventory and non-goal self-review                                      |
| Run every exact pinned-runtime local command, record failures/corrections, and prove frozen verification leaves tracked files unchanged    | Validation evidence below                    | 5         | Complete command table and before/after status/diff evidence                             |
| Publish only ordinary commits on the exact branch and open the exact draft PR with `Closes #9`                                             | Git/GitHub                                   | 6         | Branch/commit/push metadata and draft PR URL                                             |
| Inspect the actual hosted Verification job and decoded logs; correct only with follow-up commits                                           | Hosted CI                                    | 6         | Final run/job IDs, final head SHA, decoded-log result                                    |
| Keep the PR draft/unmerged, do not alter `main`, do not publish npm, and do not force-push                                                 | Git/GitHub and final review                  | 6         | Remote refs/PR state and publication audit                                               |

Acceptance criteria will be reconciled line by line before publication. A
criterion remains incomplete until both implementation and its specified
evidence exist.

## Product-contract vocabulary crosswalk

| Product-contract term  | Phase 3 owned representation                                                    | Evaluation translation                                                                            |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Authorization          | `authorization` capability family                                               | Existing evaluation family of the same meaning                                                    |
| Audit logging          | `audit-logging` capability family                                               | Existing evaluation family                                                                        |
| Background jobs        | `background-jobs` capability family                                             | Existing evaluation family                                                                        |
| Rate limiting          | `rate-limiting` capability family                                               | Existing evaluation family                                                                        |
| Webhooks               | `webhooks` capability family                                                    | Existing evaluation family                                                                        |
| Viable candidate       | `viable` disposition with no known hard conflict and enough evidence            | Evaluation `viable` disposition                                                                   |
| Recommendation         | `recommended` disposition plus response outcome and partial ranking             | Evaluation `recommended` disposition and rank groups                                              |
| Hard constraint        | Stable-ID non-negotiable condition with reason code                             | Case hard constraint and candidate-conditioned gold reason                                        |
| Evidence               | Dated attributable direct observation                                           | Bounded evidence observation                                                                      |
| Inference              | Conclusion with one or more evidence references                                 | Supported by the product contract; conformance does not convert proposed rationale into inference |
| Unknown                | Explicit material unresolved fact                                               | Candidate-conditioned required unknown                                                            |
| Repository fingerprint | Minimized approved facts and provenance                                         | Case repository profile, deliberately translated                                                  |
| Fit assessment         | Responsible outcome, per-candidate disposition, traceability, and partial order | Proposed gold mapped only for representability                                                    |

Adoption plans and adoption outcomes remain deferred. Evaluation-only scoring,
failure-mode, pair-control, review-lifecycle, and corpus-integrity fields will
not enter product DTOs.

## System-context dependency crosswalk

The implemented dependency direction will be:

```text
tools/evaluation-harness
        |
        v
packages/contracts
        |
        v
packages/domain
```

Future adapters remain planned:

```text
HTTP / MCP / GitHub / database / model / filesystem / queue adapters
        |
        v
application use cases
        |
        v
contracts and domain
```

Enforced prohibitions:

- `packages/domain` imports no workspace package, schema library, adapter, Node
  I/O API, environment, clock, or randomness.
- `packages/contracts` imports only `@gitblocks/domain` and the ADR-approved
  schema mechanism.
- No product package imports `tools/`, `evals/`, evaluation schemas, proposed
  gold, tests, frameworks, providers, persistence, or transports.
- No package imports another workspace package through a deep path.
- Tools may import the public `@gitblocks/contracts` surface for conformance;
  product code never imports tools.

## Architecture, data flow, and performance impact

The only new runtime data flow is pure in-memory validation:

```text
unknown DTO value
  -> bounded object-graph preflight
  -> structural contract validation
  -> DTO-to-domain mapping
  -> pure domain-invariant validation and canonicalization
  -> typed success or bounded safe issues
```

The evaluation path is offline:

```text
existing bounded corpus loader
  -> explicit harness-owned field mapping
  -> public product parsers / exchange validation
  -> deterministic conformance summary
```

No network, filesystem, environment, clock, randomness, model, queue, database,
or process capability enters either product package. Filesystem access remains
owned by the existing evaluation harness boundary.

Performance budgets for each object-value parser:

- reject a cycle, excess depth, excess node count, excess object property
  count, or excess collection before exhaustive schema diagnostics;
- visit at most 200,000 scheduled/visited values during preflight;
- reject any scalar value/property name beyond 4,096 UTF-16 code units or an
  input beyond 64,000,000 aggregate string code units before validator pattern
  work;
- return at most the named issue-count bound;
- cap every issue path and safe message;
- validate at most 20 supplied candidate dossiers per assessment request; and
- avoid algorithmic work beyond bounded traversal plus ranking cycle checks on
  the bounded candidate graph.

No latency SLO or load test is justified for a non-deployed pure library.
Stress tests will exercise the exact object and diagnostic bounds. Ranking
validation checks a supplied partial order; it does not calculate product rank
quality.

## Security, privacy, abuse, and supply-chain considerations

Assets are repository-local facts, transmitted minimized facts, candidate
evidence attribution, hard-constraint safety, explicit unknowns, and
value-safe diagnostics. Actors are future local producers, transport adapters,
application use cases, model-produced values, and the offline evaluation
mapper. Every input is untrusted; schema validity grants neither
authorization nor permission for an external effect.

Abuse cases include:

- hidden extra fields carrying prompts, tokens, source, provider payloads, or
  internal details;
- permissive coercion/defaults converting missing or unknown information into
  favorable facts;
- cyclic, deep, broad, or highly invalid objects exhausting validation;
- control characters affecting logs or protocol displays;
- malicious narrative text attempting to become instructions;
- unresolved or cross-candidate references laundering evidence or reasons;
- hard-conflicting candidates marked viable/recommended or inserted into
  rankings;
- contradictory partial-order relations or cycles;
- evaluation gold fields leaking into public product DTOs; and
- a dependency or lifecycle-script change weakening the supply-chain baseline.

Controls are closed typed variants plus controlled coded vocabularies, no
coercion/default insertion, preflight graph bounds, inert-text handling, stable
normalized identifiers, pure reference/invariant checks, value-free bounded
issues, negative and abuse tests, exact dependency pins, default-denied
lifecycle scripts, frozen install, secret scanning, registry audit,
architecture checks, and complete diff review.

Authentication, tenant authorization, retention, deletion, encryption,
webhook verification, transport byte limits, and audit logging are not
implemented because no corresponding adapter, storage, or production boundary
is created. Future boundaries must add those controls rather than treating a
successful product parse as authorization.

## Domain model inventory

The domain package owns readonly plain-object/discriminated-union values for:

- the five `CapabilityFamily` values;
- stable identifiers and stable reason codes;
- `SuccessCondition`, `HardConstraint`, and `Preference`;
- `CapabilityRequest`;
- minimized typed/coded `RepositoryFingerprint` facts, controlled vocabulary,
  and direct/declared/derived repository-local provenance;
- `CandidateIdentity`, `CandidateDossier`, and `CandidateLimitation`;
- direct `EvidenceObservation` and `EvidenceReference`;
- evidence-derived `Inference`;
- `MaterialUnknown`;
- `MaterialClaim`;
- `CandidateDisposition`;
- `HardConstraintConflict`;
- one `CandidateAssessment` per supplied candidate;
- `RankGroup`, `ExplicitRankRelation`, and `IncomparablePair`;
- `ResponsibleOutcome` and `assessmentProcessing`; and
- `FitAssessmentResult`.

Domain values avoid transport naming, persistence layout, mutable entities,
service locators, singleton registries, class hierarchies, and speculative
ports.

## Invariant inventory

Pure domain validation enforces and independently tests:

### Identity and references

- Stable IDs use one documented normalized bounded grammar.
- IDs are unique within their local catalog.
- Every supplied candidate is assessed exactly once.
- Evidence, inference, limitation, claim, unknown, conflict, and candidate
  references resolve.
- Candidate-conditioned reasons and evidence cannot migrate between
  candidates.
- The exchange preserves every supplied evidence observation and
  candidate-scoped unknown exactly, not merely its ID and owner.
- The exchange preserves every supplied candidate limitation exactly and every
  retained limitation remains referenced by its owning assessment.
- Duplicate or contradictory facts fail instead of being merged.
- Typed universal and coded facts use semantic correlation keys so two fact IDs
  cannot disguise the same or contradictory repository assertion.

### Evidence, inference, claims, and unknowns

- Direct evidence and inference are separate variants.
- Public evidence provenance uses a source-compatible discriminated variant,
  exact immutable revision/locator where applicable, and chronological
  publication/collection/validation/freshness values.
- Every inference references at least one evidence item.
- An inference cannot identify itself as evidence.
- Every material claim references evidence, inference, or both.
- Unknowns remain explicit and cannot become favorable claims by omission or
  default.
- Every candidate reason resolves to candidate-owned evidence or inference, an
  applicable disclosed unknown, or a matching evidenced hard conflict.
- Conformance never promotes proposed rationale notes into an inference.

### Hard constraints and responsible outcomes

- A known hard conflict requires `rejected`.
- A hard-conflicting candidate cannot be viable, recommended, or ranked.
- Rejected and insufficient-evidence candidates cannot be ranked.
- Hard-conflict reason and evidence references remain on that candidate.
- `recommend` requires a recommended or viable candidate.
- `no-viable-candidate` requires every candidate to be rejected.
- `insufficient-evidence` requires no recommended/viable candidate and at
  least one insufficient-evidence candidate; each insufficient candidate
  references an applicable disclosed material unknown.
- `assessmentProcessing.state: complete` means all supplied inputs and
  available evidence were processed, not that uncertainty vanished. It can
  coexist with material unknowns and `insufficient-evidence`.
- `partial-evidence` requires one or more bounded stable
  `incompleteReasonCodes`. Processing state cannot suppress a supplied unknown.

### Partial ranking

- Only recommended or viable candidates participate.
- Rank-group ties, explicit ordering, and explicit incomparability are valid.
- Duplicate membership and directed cycles are invalid.
- A pair cannot be both tied and ordered, tied and incomparable, or ordered and
  incomparable.
- Tie equivalence propagates through explicit ordering consistently.
- Across every ranking form, distinct ranked candidates cannot exceed the
  request's `requestedMaximumResults`.

### Request, approval, and time

- The request and response IDs, correlation ID, supplied candidate set, and
  evidence cutoff match across an exchange.
- Transmission approval covers the capability request, fingerprint, candidate
  dossiers, and bounded evidence whenever evidence is included.
- Calendar-valid UTC timestamps and evidence/publication/cutoff/production
  temporal ordering are enforced in the domain layer.
- Nested V1 values use exactly the same contract version and unavailable
  candidate release scope remains null rather than borrowing an evaluation
  schema version.

### Determinism

- Catalog-like values are canonicalized when input order has no meaning.
- Diagnostics have a deterministic code/path order.
- Domain behavior does not depend on object insertion or filesystem order.

## Contract inventory

All external contract families use explicit `contractVersion: "1.0.0"`:

1. capability request;
2. repository fingerprint;
3. candidate dossier;
4. fit-assessment request;
5. fit-assessment response; and
6. stable neutral error envelope.

Every untrusted object is closed. Strings, arrays, identifiers, paths, depth,
and diagnostic output use named policy bounds. The shapes have no generic
carrier for raw chat transcripts, hidden prompts, authentication tokens,
environment values, cookies, raw source/configuration/manifests, logs,
database content, untracked contents, command output, provider bodies, stack
traces, filesystem paths, or internal database/queue topology.

## Schema-library research

ADR 0003 compared current stable approaches from official documentation,
official repositories, and registry metadata. Serious candidates were:

- JSON-Schema-first definitions with statically derived TypeScript types;
- TypeBox definitions with a standards validator;
- Zod 4 definitions with built-in JSON Schema conversion; and
- another maintained TypeScript schema mechanism when it satisfies the
  interoperability requirements.

For each serious candidate, ADR 0003 records exact version, release date, license,
publisher/repository provenance, maintenance, Node 24 and TypeScript 6
compatibility, strict ESM, direct/transitive graph, peers, lifecycle scripts,
advisories, JSON Schema draft support, union behavior, closed/unknown-field
behavior, coercion/default semantics, error safety, deterministic export, and
MCP/HTTP/SDK limitations.

The accepted mechanism is unscoped `typebox@1.3.8` plus `ajv@8.20.0`.
TypeBox schema objects are the one source, `Type.Static` derives DTO types, and
the private Ajv2020 instance validates the same objects. Ajv was selected
explicitly for locally controlled strict/non-mutating options and mature
Draft 2020-12 behavior, not merely because evaluation tooling already uses it.

The accepted implementation provides one authoritative definition, static
types, runtime parsing from `unknown`, interoperable JSON Schema 2020-12,
closed shapes, no coercion/default insertion, stable bounded diagnostics,
deterministic artifacts, and strict ESM/TypeScript compatibility.
Hand-maintained parallel interfaces and schemas are prohibited.

## Dependency and supply-chain review

Approved exact contract dependencies are:

- `typebox@1.3.8` — the only newly resolved package; MIT, ESM-only, official
  TypeScript 6–7+ and Draft 2020-12 support, zero dependencies/peers/install
  lifecycle, trusted GitHub Actions npm publisher with registry signature and
  SLSA provenance.
- `ajv@8.20.0` — MIT strict Draft 2020-12 validator, already resolved for
  evaluation tooling, with four already-locked zero-dependency transitives and
  no install lifecycle.

Each selected direct dependency is:

- exact in a package manifest;
- added with pnpm under the pinned runtime;
- justified against owned-code and already-installed alternatives;
- checked against Node `24.18.0`, the minimum Node `24.12.0`, TypeScript
  `6.0.3`, and strict ESM;
- reviewed for license, exact publication date, official provenance,
  integrity/attestation metadata, maintenance, peers, direct and transitive
  footprint, lifecycle scripts, exotic sources, build requirements, and
  advisories; and
- compatible with existing release-age, no-downgrade, strict-peer,
  engine-strict, lifecycle-denial, and frozen-lockfile controls.

The resolved Ajv transitives are `fast-deep-equal@3.1.3` (MIT),
`fast-uri@3.1.4` (BSD-3-Clause), `json-schema-traverse@1.0.0` (MIT), and
`require-from-string@2.0.2` (MIT). The full publication, provenance, lifecycle,
footprint, and advisory review is in ADR 0003. Expected lifecycle allowlist
change remains none. Final frozen install and registry audit must confirm the
selected graph.

## Package dependency graph

Implemented package surfaces:

```text
@gitblocks/domain
  package exports -> owned values, constructors, invariant validators
  runtime dependencies -> none

@gitblocks/contracts
  package exports -> version, DTO types, six parsers, six schema exports
  workspace dependency -> @gitblocks/domain
  external dependencies -> ADR-approved mechanism only

@gitblocks/evaluation-harness
  existing validator/scorer remains independent
  new conformance path -> public @gitblocks/contracts export
```

The root TypeScript references, Vitest coverage/include patterns, build and
typecheck filters, dependency-cruiser entry points, and repository invariants
will be updated without duplicating execution in `verify`.

## Evaluation-conformance design

The existing corpus remains the single source:

```text
case
  -> capability request
  -> repository fingerprint

case candidates + evidence set
  -> candidate dossiers

proposed gold
  -> fit-assessment response
     representability only
```

The harness-owned mapper may read evaluation files because tools are outside
the product boundary. It:

- reuse the existing bounded corpus loader and referential validation;
- map all ten cases without copying them;
- enumerate and intentionally consume every decision-relevant source field;
- fail if an unrecognized source key or unmapped candidate/reference appears;
- preserve case/evidence/gold identity and proposed/not-reviewed provenance in
  the conformance report rather than product DTO fields;
- use product parsers only to validate representability, never to score
  product quality;
- leave the scorer and blind prediction workflow independent; and
- emit one deterministic bounded summary with no arbitrary evidence text.

Evaluation-only `schemaVersion`, corpus manifest, author/reviewer lifecycle,
controlled-pair/failure-mode tags, scoring truth, and source-research metadata
will be consumed deliberately but not copied into product schemas.

## Trust-boundary analysis

### Object-value parser boundary

The contract package accepts already-materialized JavaScript `unknown` values.
It does not own byte streams, JSON text parsing, files, network requests, or
content-type/transport encodings. Future adapters must impose byte and
decompression limits before parsing and then call these parsers.

Threats include type confusion, unknown hidden fields, coercion/default
smuggling, oversized/deep values, control characters, reference substitution,
diagnostic floods, malicious text, and secret/raw-source carrier fields.
Controls are closed bounded schemas, pre-validation depth/collection checks,
no coercion/defaults, pure mapping, domain reference checks, bounded
value-free issues, deterministic ordering, and no I/O/dynamic import/eval.

### Evaluation bridge boundary

Committed evaluation JSON is untrusted repository-derived data. The existing
bounded loader and schemas validate it before mapping. The mapper treats URLs
and evidence text as inert values and never fetches, executes, imports, shells,
or interpolates them into a command.

### Future transport boundary

HTTP/MCP authentication, tenant authorization, byte/content-type/decompression
and JSON-text limits, data-only object construction, transport error mapping,
and version negotiation remain future adapter responsibilities. Transport
status codes will not become domain or neutral-error truth. Already-executable
hostile proxies are outside the parser's inert-data guarantee.

## Privacy and prohibited-field analysis

The six closed DTOs use allowlisted minimized facts. There is no
generic metadata, context, headers, messages, configuration, source, payload,
or arbitrary-record escape hatch capable of bypassing minimization.

Allowed text is purpose-specific and bounded: a request summary, named
condition, observation summary, inference rationale, limitation, unknown
description, safe error message, or reason description. Tests will attempt
secret-like, raw-source-like, prompt-like, stack, path, provider, database, and
queue fields and require structural rejection. Arbitrary malicious text in an
allowed bounded narrative remains inert data and is never executed or echoed
by diagnostics.

No telemetry or persistence is added. The pure packages cannot execute as a
shared production path, so production instrumentation is not applicable in
this phase. Stable error/issue codes and optional bounded correlation
identifiers prepare future adapters without introducing logging.

## Versioning and compatibility policy

- Each family begins at exact version `1.0.0`.
- Parsers accept only the version they name; a wrong, missing, prerelease, or
  future version fails with a stable version issue.
- Before a public release, incompatible design corrections may change this
  unreleased `1.0.0` definition through Issue #9 review.
- After first public release, backward-compatible optional additions require a
  minor version and incompatible/removal/meaning changes require a major
  version under Semantic Versioning.
- New versions use separate definitions/parsers during a documented transition
  rather than silently widening the V1 parser.
- Unknown fields remain rejected, so producers and consumers require explicit
  coordinated version negotiation at future transport boundaries.
- No persisted or deployed consumer exists. Rollback is an ordinary branch/PR
  revert before publication; after consumers exist, forward recovery and
  mixed-version support must be planned per release.

## Implementation milestones

### Milestone 1 — Plan and ADR

- Create this plan before product code.
- Complete library and supply-chain research.
- Add ADR 0003 with the chosen one-source mechanism, structural/domain
  boundary, artifacts, diagnostics, versioning, rejected alternatives, and
  measurable revisit triggers.
- Validate Markdown and links before proceeding.

### Milestone 2 — Pure domain, test first

- Add the private domain package configuration and failing tests first.
- Implement vocabulary, normalized identifiers, canonicalization, reference
  integrity, evidence/inference/unknown separation, hard constraints,
  responsible outcomes, and partial-order rules.
- Run focused domain tests, typecheck, lint, and architecture checks.

### Milestone 3 — Six product contracts

- Add the private contracts package and exact approved dependency.
- Define V1 DTO schemas as the sole structural source, derive static types,
  export deterministic schemas, and implement six safe parsers.
- Map structurally validated DTOs to domain values and run domain validation.
- Add minimum, maximum, compatibility, mutation, coercion, unknown-field,
  prohibited-field, nesting, flood, diagnostic-safety, and schema-drift tests.
- Run focused contract tests, typecheck, build, and dependency review.

### Milestone 4 — Evaluation conformance and architecture

- Add the harness-owned mapping and CLI/root command.
- Validate all ten cases and add intentional-field-loss regression tests.
- Keep independent validation/scoring unchanged.
- Update dependency-cruiser, repository invariants and fixtures, root scripts,
  TypeScript references, and Vitest configuration.

### Milestone 5 — Documentation and complete local validation

- Update README, AGENTS, CONTRIBUTING, development standards, testing strategy,
  system context, evaluation docs, package docs, ADR, and this plan.
- Reconcile every Issue #9 requirement and non-goal.
- Run the exact validation matrix under the pinned runtime.
- Review full diff, worktree drift, dependency graph, prohibited imports and
  features, proposed-gold language, and security/privacy boundaries.

### Milestone 6 — Publication and hosted evidence

- Create intentional Conventional Commits without rewriting history.
- Push normally to `feat/9-product-contract-kernel`.
- Open a draft PR titled exactly
  `feat: establish product contract kernel` containing `Closes #9`.
- Inspect the actual hosted workflow run, Verification job, and decoded logs.
- Correct failures only with ordinary follow-up commits and rerun evidence.
- Leave the PR draft, unmerged, and awaiting independent review.

## Testing and validation strategy

Tests are deterministic, offline, and free of network, model, candidate
installation/execution, database, global Git configuration, arbitrary sleeps,
and secret sentinel output.

### Unit and contract matrix

- Valid minimum and maximum forms for all six families.
- Six synthetic non-pilot TypeScript/Next.js/PostgreSQL fingerprints covering
  mixed Node/Edge execution, a transactional outbox, a connection-pooling
  restriction, an idempotency-key mechanism, row-level security, and existing
  queue/scheduler/gateway capabilities without changing the root schema shape.
- Controlled fact-vocabulary version negotiation, unknown-code rejection,
  unsupported-semantic rejection, closed value variants, and rejection of raw
  source/configuration/environment/secret/log/command-output/metadata carriers.
- Table-driven valid and invalid evidence provenance for Git commits, tags,
  releases, exact package versions, security advisories, mutable
  documentation, and approved validation, including source compatibility,
  mutable aliases and branch references, immutable-locator matching, and
  chronology.
- Exact DTO-to-domain and canonical direct/declared/derived preservation.
- Reason-local candidate ownership and traceability for every disposition,
  including disclosed-unknown and hard-conflict support.
- Exact candidate-limitation preservation across the exchange, including
  ownership, statement, evidence, duplicate, contradiction, omission, and
  viable-tradeoff cases.
- Complete processing with explicit unknowns, partial-evidence reason codes,
  responsible insufficient-evidence after complete processing, and unknown
  suppression rejection.
- Throwing-Proxy handling that proves one bounded value-free rejection without
  claiming that reflective traps did not execute.
- Wrong/missing versions, wrong types, coercion, defaults, and unknown fields.
- Input immutability.
- Duplicate/malformed IDs and contradictory facts.
- Unresolved candidate/evidence/inference/unknown references.
- Inference without evidence and evidence/inference variant confusion.
- Claim traceability and explicit unknown preservation.
- Hard conflict/disposition/ranking contradictions.
- Every valid and invalid responsible-outcome combination.
- Candidate omission, duplication, reason reassignment, and evidence
  reassignment.
- Ties, partial order, incomparability, duplicate membership, cycles, and pair
  relation contradictions including tie propagation.
- Deterministic canonical output and deterministic schema serialization.
- Control characters, multi-megabyte and aggregate string floods, oversized
  arrays, deep input, composed maximum legal response, diagnostic flood,
  malicious inert text, and prohibited secret/source-like fields.
- Safe error envelope rejection of stacks, paths, provider/database/queue
  internals, and raw values.
- Stable bounded diagnostic codes, paths, count, and messages.
- Product public exports and no deep import requirement.
- Schema/type synchronization and artifact drift.
- Product-to-evaluation/tools import prohibition.
- All ten corpus mappings, field-loss detection, and rejection of
  evaluation-only gold fields by product parsers.

Property-style exhaustive tables will cover candidate outcome/disposition and
pair-relation combinations. Focused stress fixtures will prove explicit bounds;
this pure object-value phase does not claim byte-stream, transport load, or
decompression testing.

### Exact final validation commands

Working directory:
`/Users/karthikgudipati/Documents/Apps/gitblocks`.

Required environment: source the already-provisioned NVM script if the shell
has not loaded it, then use repository-pinned Node and pnpm.

```bash
source /Users/karthikgudipati/.nvm/nvm.sh
nvm use
node --version
pnpm --version
pnpm runtime:check
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm test:coverage
pnpm architecture:check
pnpm repo:check
pnpm eval:validate
pnpm eval:fixtures
pnpm contracts:validate
pnpm security:secrets
pnpm security:audit
pnpm verify
pnpm verify:ci
git diff --check
git status --short --branch
git diff --stat
git diff
```

Additional deterministic audits will prove package count/dependencies, six
versions/exports, one-source schemas and types, structural plus domain
validation, no mutation/value echoes, ten-case conformance, proposed-gold and
scoring independence, prohibited imports/features, and no tracked drift after
frozen install/verification.

## Observability and operations

Not applicable to runtime instrumentation: this change adds pure in-memory
domain/contract functions and an offline developer conformance command. It
adds no request, MCP, provider, job, ingestion, ranking, persistence, shared
service, or deployment path and therefore cannot emit production telemetry.

Operational preparation is limited to stable value-safe error/issue codes,
bounded optional correlation identifiers in the neutral error DTO, deterministic
CLI exit behavior for conformance, and documented ownership. Future adapters
must implement the observability policy at their actual production boundaries.

## Migration, compatibility, rollout, and recovery

There is no stored data, deployed producer/consumer, public npm artifact, or
runtime service to migrate. This phase creates the initial unpublished V1
contract and documents the compatibility rules future boundaries must follow.

Local rollout is atomic through one draft PR. Before the branch is published,
ordinary local commits or an unpublished rebase are recoverable. After push,
history is shared: corrections use new commits only. Rollback before merge is
closing the draft PR or reverting commits without touching `main`. After a
future public/deployed contract exists, separate versioned parsers and explicit
mixed-version rollout/forward recovery are required; silently widening V1 is
not allowed.

Schema artifacts are runtime exports from the authoritative TypeBox values.
The package-owned canonical serializer, exact digest tests, and documented
registry/serializer consumption path provide drift and recovery evidence
without committing generated JSON copies.

## Exact exit criteria

The plan may leave implementation status only when:

- ADR 0003 and dependency research are complete and internally consistent.
- Exactly the two authorized product packages exist.
- All Issue #9 vocabulary, invariants, six V1 contracts, parsers, schema
  exports, and diagnostics are implemented and tested.
- Structural and domain validation boundaries are explicit and both execute.
- All ten pilot mappings pass without duplicated corpus or lost
  decision-relevant fields.
- Product packages have no tool/evaluation/adapter/framework/provider
  dependency and the domain has no runtime dependency.
- Documentation, package exports, command graph, ADR, plan, and PR agree.
- Full local offline and registry-backed validation passes under the exact
  pinned runtime and leaves tracked files unchanged.
- Complete product, architecture, security, privacy, tests, compatibility,
  operations, and non-goal self-review finds no unresolved material issue.
- Independent-style review findings are reconciled, ordinary commits are
  pushed without force, the exact draft PR exists, hosted Verification passes
  at the final head, and decoded logs are inspected. The PR remains draft and
  unmerged for maintainer review.
- Proposed Phase 2 gold remains explicitly proposed/not reviewed, no live
  baseline ran, and `main` remains unchanged.

## Progress log

- 2026-07-28: Began the focused final authority-immutability correction on
  reviewed head `62ca7a519e07a3ceff02456cbe99686e22979fc1`. Confirmed a clean,
  aligned topic branch; unchanged local/remote `main` at
  `27eb7d6585c30fd0f78f238543a764ca7b3c4f76`; draft, open, unmerged PR
  #10; and successful hosted run `30420263788`, Verification job
  `90475439247`. An isolated-process red regression proved both exploit paths:
  top-level mutation appended an otherwise unknown fact definition and changed
  parsing from rejected to accepted (`before=false;after=true;length=28`);
  nested mutation appended a controlled value code and likewise changed parsing
  from rejected to accepted. The focused run failed 2 of 2 tests before the
  correction without contaminating shared module state.
- 2026-07-28: Replaced the public live vocabulary with a private version-to-
  deeply-frozen-registry mapping. Semantic validation now requires and selects
  the supplied vocabulary version. Public inspection returns a fresh deep
  snapshot; successful validation returns no internal definition reference.
  Repository-fact categories, presence states, and capability families use
  private frozen membership authority, and the public schema-name catalog is
  runtime frozen. Canonical vocabulary `1.0.0` serialization is bound to
  SHA-256
  `7f5823b8140bcc92f2e8b05ee811493effb0af3a644233f1eb3e070a6eaf56c8`.
- 2026-07-28: Completed the required local matrix under Node `24.18.0` and pnpm
  `11.17.0`. All 31 files/637 tests passed; coverage was 87.73% statements,
  77.39% branches, 93.67% functions, and 87.71% lines. Architecture passed for
  589 modules/1,896 dependencies, repository checks passed, evaluation remained
  10 cases, and conformance remained exactly 10 cases/40 supplied candidates
  with proposed/not-reviewed, representability-only provenance. Secret
  scanning, the no-known-vulnerability audit, `pnpm verify`, and
  `pnpm verify:ci` passed. Root schema inputs/digests, dependencies, lifecycle
  policy, and the lockfile are unchanged; publication and corrected hosted CI
  remain pending.
- 2026-07-28: Converted the eight independent-review findings into failing
  regressions before correcting production behavior. The initial
  `review-corrections` run had 15 failures and 9 passes across 24 tests; the
  initial source-aware `evidence-provenance` run had 24 failures and 19 passes
  across 43 tests. Failures covered the pilot-shaped fingerprint vocabulary,
  independent source/revision combinations, declaration renaming, unsupported
  reasons, disappearing limitations, completeness/unknown conflation, and the
  missing Proxy safety regression. Expected failing output was retained in this
  plan rather than weakening assertions.
- 2026-07-28: Replaced the pilot-shaped production fact union with one closed
  coded shape for coarse repository capability, structure, identity,
  data-policy, and operations facts, while retaining typed component/version
  and deployment facts. The domain-controlled vocabulary is independently
  negotiated, rejects unknown codes and unsupported semantics, and can add an
  ordinary code using existing value variants without changing any root
  contract shape. Six non-pilot fingerprints now prove mixed Node/Edge routes,
  transactional outbox, pooler restriction, idempotency keys, row-level
  security, and queue/scheduler/gateway representation.
- 2026-07-28: Replaced generic evidence source/revision fields with
  source-aware Git commit, tag, release, package-version, security-advisory,
  mutable-documentation, and approved-validation variants. Exact revision,
  locator, source compatibility, chronology, safe URL, and closed-output rules
  are enforced structurally and in the domain. Exploit review additionally
  found and closed partial package-version, branch/ref, embedded-alias, and
  empty hard-conflict-evidence bypasses while retaining concrete immutable
  `canary`/`next` prerelease versions. A final SemVer scan found that numeric
  prerelease identifiers with leading zeroes were accepted; both structural
  and domain patterns now reject `-01` and `alpha.01` while accepting `-0`,
  `alpha.0`, concrete prereleases, and build metadata.
- 2026-07-28: Preserved `direct`, `declared`, and `derived` fact status exactly
  through mapping and canonicalization; added source/status coherence rules;
  required local support for every candidate reason; retained supplied
  limitations in a candidate-owned response catalog plus assessment
  references; and replaced uncertainty-based `completeness` with independent
  `assessmentProcessing`. A consolidation review also found and corrected
  canonicalization that could erase invalid incomplete-reason codes from a
  `complete` domain value before validation. Further exploit review found that
  identical limitation prose could evade duplicate detection by changing its
  code and evidence references; duplicate identity is now candidate plus
  canonical statement, while evidence from every source is preserved on the
  one retained limitation. Insufficient-evidence candidates also must reference
  an applicable disclosed unknown, keeping the outcome epistemically grounded
  even after complete processing.
- 2026-07-28: Clarified the JavaScript object-value boundary in ADR 0003,
  package documentation, system context, and durable engineering guidance.
  Production adapters supply JSON-parsed or otherwise data-only values and own
  byte/content-type/decompression/JSON-text bounds. Preflight rejects
  accessors, exotic prototypes, cycles, and unsupported forms; arbitrary
  already-executable proxies remain outside the inert-data guarantee, and a
  throwing trap produces one safe bounded rejection without its text or stack.
- 2026-07-28: Updated the evaluation conformance bridge without changing the
  evaluation schemas, prediction validation, or scorer. Exact corpus sentences
  remain harness-side matching keys only; all ten cases and forty supplied
  candidates map to coded product facts, source-aware provenance, declared
  status, preserved limitations, and complete processing with independent
  unknowns. The bridge remains proposed/not-reviewed and
  representability-only; no non-pilot fixture entered the corpus or gold.
- 2026-07-28: Updated deterministic schema digests after reviewing the
  intentional closed-shape changes. Reviewed-head to corrected values are:
  candidate dossier
  `0f7444c2776d4fefb9c0a68b97c33b12b48753b4c50f5ef528926ee735bc6837`
  to `d16d0424ed45edcf61d8084cbd21ebbb396366522d1b1a425b6cf8405e0680af`;
  capability request unchanged at
  `3d1f213efdacd6ff550a66a74703b94abc56aead59cdcb08b7a2769b5a5a1ab9`;
  error envelope
  `1e4f2f837c0b084db8059d4867bfde9ab8af787d52ff19540b5d7a40ee0af15c`
  to `7a708cc440a7992cb164715dce6029befbe78970c3283d8a1bff9298c87603d0`;
  fit request
  `b256b7a29af2cbf1f9f28a566ab84c2a0d7b0fa001f5d4e88199557991c56bd5`
  to `c130a56044cbb043fac97e66db4c372d48990d672784b4abfde9ab9e78c9e504`;
  fit response
  `34712886b3d6adec2847077f15a8f9cf96e36167c1f846417d45981aca92c2bb`
  to `330b5b3940858428b1881701774bac785a7c93cf2d50e6dcb4ec37091a696a4d`;
  and repository fingerprint
  `c7d5c4315e62cd47bd7afdcce2a31145803e85c8c4426cdcdaac73649d3a517f`
  to `73f42c7a7cd20de24372ecddb7afa33925ca1f4d67cb1f9598cd9d56ea87477c`.
  All six roots remain unpublished version `1.0.0`; the independently
  negotiated initial fact vocabulary is also `1.0.0`.
- 2026-07-28: Completed the corrected pinned-runtime local matrix under Node
  24.18.0 and pnpm 11.17.0. Frozen installation, format, lint, typecheck, build,
  all 628 tests, coverage, architecture, repository invariants, evaluation
  validation/fixtures, product conformance, secret scanning, zero-advisory
  audit, `pnpm verify`, `pnpm verify:ci`, whitespace checks, status/stat review,
  and the complete tracked plus new-file diff review passed. Coverage is 88.17%
  statements, 77.86% branches, 94.60% functions, and 88.16% lines.
  Architecture cruised 588 modules and 1,891 dependencies without a violation.
  Conformance remains exactly 10 cases and 40 supplied candidates with
  proposed/not-reviewed, representability-only provenance. The tracked diff
  hash was
  `69ce1963ece28401777e7746530a51492714f584` before and after frozen
  installation and verification.
- 2026-07-28: Independent consolidation, contract, exploit, architecture, and
  evaluation reviews found no remaining material correction after the final
  alias, exact-SemVer, hard-conflict evidence, processing canonicalization,
  insufficient-evidence unknown, and limitation-identity fixes. Exactly two
  production packages remain; domain has no dependencies; contracts still
  depends only on domain, `typebox@1.3.8`, and `ajv@8.20.0`; manifests,
  lockfile, lifecycle policy, runtime pins, evaluation scoring, and prohibited
  product components are unchanged by this correction.
- 2026-07-28: Created ordinary follow-up commits
  `487577d6063bcc355527e1cfcba412574e5f8717`
  (`fix(contracts): correct product kernel review findings`) and
  `5c4884a41d187d50997900366d256191858b8b04`
  (`docs: record product kernel review corrections`) without amending,
  rebasing, squashing, or rewriting the three reviewed commits. Fetched the
  unchanged remote topic head, then pushed both commits normally and without
  force to `feat/9-product-contract-kernel`. Updated existing draft PR #10; no
  branch or PR was created.
- 2026-07-28: Hosted CI run
  [30420056706](https://github.com/kgudipati/gitblocks/actions/runs/30420056706)
  (CI run 21) completed successfully for corrected head
  `5c4884a41d187d50997900366d256191858b8b04`. The actual `Verification` job
  `90474826793` and its decoded logs were inspected. Ubuntu 24.04 selected Node
  24.18.0 and pnpm 11.17.0; the 326-entry lockfile passed supply-chain policy;
  frozen installation and PR metadata checks passed; `pnpm verify:ci` passed
  all 628 tests, 588-module/1,891-dependency architecture validation,
  repository checks, 10-case evaluation validation, 10-case/40-candidate
  proposed/not-reviewed representability-only conformance, secret scanning,
  and the no-known-vulnerability audit; the terminal `git diff --exit-code`
  worktree proof passed.
- 2026-07-28: Began the independent-review correction pass on existing draft PR
  #10. Verified a clean local/remote topic head at
  `1336a069397b2a8d10a7b73d4597cf6ab0bf1229`; verified local and remote `main`
  remain `27eb7d6585c30fd0f78f238543a764ca7b3c4f76`; confirmed PR #10 is open,
  draft, and unmerged; and inspected successful hosted run `30415345411`,
  Verification job `90460534105`, and its decoded logs. Correction design,
  failing regressions, implementation, complete local validation, ordinary
  follow-up commits, PR-description reconciliation, and new hosted evidence
  remain in progress.
- 2026-07-28: Loaded Issue #9 completely through connected GitHub access;
  confirmed it is open. Confirmed PR #8 merged and Issue #7 closed.
- 2026-07-28: Verified clean local/remote `main` at
  `27eb7d6585c30fd0f78f238543a764ca7b3c4f76`; no product package existed.
- 2026-07-28: Initial preflight attempt failed because the shell did not load
  `nvm`, had no `node` on `PATH`, and exposed pnpm `11.9.0`. No repository
  command was bypassed and no runtime was installed.
- 2026-07-28: Sourced the already-installed NVM script; `nvm use` selected Node
  `24.18.0` and pnpm `11.17.0`. Frozen install, `pnpm verify`,
  `pnpm eval:validate`, and `pnpm eval:fixtures` passed (302 tests; 10 cases;
  architecture clean).
- 2026-07-28: Read governing product, architecture, planning, development,
  testing, security, reliability, workflow, and completion policies.
- 2026-07-28: Created local branch `feat/9-product-contract-kernel`.
- 2026-07-28: Created this plan as the first tracked change. Schema research,
  package design, and implementation remain in progress.
- 2026-07-28: Completed primary-source and registry research. Accepted ADR 0003
  selecting `typebox@1.3.8` plus private `ajv@8.20.0`; the selected graph adds
  one resolved package and no lifecycle allowlist entry.
- 2026-07-28: Added the two authorized private package boundaries. The first
  dependency-install attempt correctly failed under the repository's frozen
  default because the new manifests were not yet represented in the lockfile.
  Re-ran the intentional lockfile-update operation with
  `pnpm install --no-frozen-lockfile`; pnpm revalidated all supply-chain
  policies and added only `typebox@1.3.8`.
- 2026-07-28: Implemented the pure domain vocabulary/invariants and the six
  TypeBox-authored V1 roots, safe parsers, domain mapping, schema registry,
  canonical serializer, diagnostics, and focused contract tests. Added the
  harness-owned ten-case conformance mapping, root command, architecture
  enforcement, repository invariants, and required documentation updates.
- 2026-07-28: Independent-style security review found that the first
  fingerprint design still exposed a generic fact code and free-text statement
  carrier. Replaced it with finite purpose-specific identity, credential,
  data, infrastructure, deployment, tenant, capability, and named-component
  variants. The harness now matches each context sentence intentionally at its
  trust boundary and emits only structured product facts; tests reject text,
  secret, source, configuration, log, and command-output carriers.
- 2026-07-28: Independent-style architecture review found that adding
  conformance to the legacy evaluation CLI coupled validation/scoring commands
  to product-contract module initialization. Split conformance into its own
  CLI/bin while leaving legacy commands and the independent scorer isolated;
  added a regression that loads every legacy command without resolving product
  contracts.
- 2026-07-28: Independent-style parser review found missing object-graph
  defenses for sparse/extended arrays, array/object accessors, and breadth
  queued before the node bound could stop traversal. Preflight now inspects own
  data descriptors without invoking accessors, rejects hidden/sparse/non-plain
  shapes, and applies array and scheduled-node bounds before queue growth.
- 2026-07-28: Independent-style contract review found that the finite neutral
  error path vocabulary did not cover every public semantic area. Expanded the
  safe finite path set, including assessment identity and completeness, and
  added exhaustive accepted-path coverage without allowing raw validator
  paths, keys, or values.
- 2026-07-28: Independent-style domain review found that request/response
  consistency proved only evidence/unknown IDs and ownership, not exact
  preservation. Exchange validation now rejects omitted or modified supplied
  evidence and candidate unknown content/references, in addition to
  reassignment.
- 2026-07-28: Independent-style evaluation review removed an accidental use of
  the evaluation case schema version as candidate release scope, leaves
  unavailable `versionScope` explicitly `null`, never converts proposed
  rationale into inference, and uses `partial-evidence` rather than overstating
  completeness.
- 2026-07-28: Independent-style bounds and determinism review aligned the
  candidate-dossier maximum of 40 unknowns with the response maximum of 800
  across 20 candidates, raised explicit ranking relation/incomparability bounds
  to the complete 190 pairs, canonicalized unordered pair/catalog forms, and
  enforces `requestedMaximumResults` across every ranking representation.
- 2026-07-28: Independent-style semantic review added full UTC calendar and
  temporal-order validation, nested contract-version classification,
  transmission-approval coverage for every included fact category, response
  completeness semantics, and semantic duplicate/contradiction keys that
  correlate structured repository facts rather than relying only on fact IDs.
- 2026-07-28: Final adversarial review composed every response catalog and
  reference collection at its declared maximum. The 157,019-node,
  approximately 2.8 MB value was structurally and semantically valid but
  exceeded the original 100,000-node preflight. Raised the named budget to
  200,000, retained all breadth/flood defenses, and added the complete
  maximum-form parser regression.
- 2026-07-28: The same review proved that a candidate with no supplied
  evidence could be marked recommended by omitting material claims. Domain
  validation now requires every recommended or viable assessment to expose a
  same-candidate favorable claim backed by evidence, inference, or both.
  Domain and public-parser zero-evidence recommendation regressions pass.
- 2026-07-28: Preflight string review found that one multi-megabyte scalar, or
  many individually bounded strings, could defer resource rejection until Ajv
  pattern/length work. Added a 4,096 UTF-16 code-unit scalar ceiling and a
  64,000,000 aggregate code-unit budget, each above all schema-valid maximum
  forms, with non-echoing scalar and aggregate-flood regressions.
- 2026-07-28: The last bounded-validation scan found that unknown property
  names were not yet charged to the string-work budgets. Preflight now charges
  array/object keys without copying them into diagnostics, and oversized plus
  aggregate property-name regressions close that bypass.
- 2026-07-28: The complete required local matrix passed under Node 24.18.0 and
  pnpm 11.17.0: frozen install, format, lint, typecheck, build, 522 tests,
  coverage, architecture, repository invariants, ten-case evaluation
  validation/fixtures, 10-case/40-candidate product conformance,
  secret scanning, zero-advisory audit, `pnpm verify`, `pnpm verify:ci`, and
  Git diff checks. Coverage is 90.12% statements, 81.43% branches, 95.44%
  functions, and 90.13% lines. Architecture cruised 584 modules and 1,879
  dependencies with no violations.
- 2026-07-28: Final independent security and acceptance audits found no
  remaining material Issue #9 blocker after the corrections. Review confirmed
  string/property-key budgets, favorable-disposition support, product import
  isolation, exact package count/direction, six parser/schema roots, bounded
  diagnostics, domain/exchange invariants, and proposed/not-reviewed
  conformance provenance.
- 2026-07-28: After staging the intended Phase 3 tree, a frozen install and
  `pnpm verify:ci` left the complete porcelain-v2 status byte-for-byte
  unchanged.
- 2026-07-28: Created ordinary commit
  `0090e6c0868d8841fecc051f4df76acbbb7fadfe`
  (`feat: establish product contract kernel`) and pushed the required branch
  without force. Opened draft PR
  [#10](https://github.com/kgudipati/gitblocks/pull/10) with exact title
  `feat: establish product contract kernel` and `Closes #9`; it remains draft
  and unmerged.
- 2026-07-28: Hosted CI run
  [30414832786](https://github.com/kgudipati/gitblocks/actions/runs/30414832786)
  (CI run 18) completed successfully for head
  `0090e6c0868d8841fecc051f4df76acbbb7fadfe`. The actual `Verification` job
  `90458949190` and its decoded logs were inspected. Ubuntu 24.04 selected Node
  24.18.0 and pnpm 11.17.0; the 326-entry lockfile passed supply-chain policy;
  frozen installation and PR branch/title checks passed; `pnpm verify:ci`
  passed 522 tests, 584-module/1,879-dependency architecture validation,
  10-case evaluation validation, 10-case/40-candidate proposed/not-reviewed
  conformance, secret scanning, and the no-known-vulnerability audit; the
  final `git diff --exit-code` worktree proof passed.
- 2026-07-28: Created and ordinarily pushed evidence-documentation commit
  `d5211cf4af53db5663808011cb23e91b345a0112`
  (`docs: record product contract validation`).
- 2026-07-28: Hosted CI run
  [30415034487](https://github.com/kgudipati/gitblocks/actions/runs/30415034487)
  (CI run 19) completed successfully for evidence-documentation head
  `d5211cf4af53db5663808011cb23e91b345a0112`. The actual `Verification` job
  `90459574407` and its decoded logs were inspected. They confirmed the pinned
  runtime, frozen installation and supply-chain policies, all 522 tests,
  architecture and repository invariants, evaluation and contract-conformance
  checks, secret scanning, no-known-vulnerability audit, and clean final diff.
- 2026-07-28: The draft PR description is the terminal hosted-status record
  for the current documentation-only plan correction. Recording that newest
  run in another commit would recursively create another unverified head; no
  product, contract, harness, or verification behavior changed after the
  successfully verified implementation head.

## Decision and deviation log

- 2026-07-28 — Use connected GitHub access for issue/PR metadata because `gh`
  is unavailable. This follows the explicit Issue #9 fallback and does not
  affect local Git authority.
- 2026-07-28 — Source the existing NVM installation explicitly in this shell.
  This activates, rather than bypasses, the repository runtime contract; no
  global or system software was installed.
- 2026-07-28 — ADR 0003 selects TypeBox as schema/type authority and Ajv2020 as
  an explicitly configured private validator; Ajv's evaluation-tool presence
  was supporting compatibility evidence, not the selection reason.
- 2026-07-28 — Export runtime JSON Schema artifacts from the authoritative
  TypeBox values. Canonical key-sorted serialization and committed digests
  detect drift without creating generated JSON as a second authority.
- 2026-07-28 — Model repository fingerprints with finite structured variants,
  not an arbitrary context code/value or narrative statement. Evaluation text
  remains an exact harness-side matching key and is never transported by the
  product fingerprint.
- 2026-07-28 — Keep proposed evaluation rationale out of product inferences.
  Direct observations map to evidence, explicit required unknowns remain
  unknowns, and proposed dispositions/rankings are used only for
  representability.
- 2026-07-28 — Make request/result consistency an explicit public exchange
  validator. Standalone response parsing owns response-local consistency;
  exchange validation owns actual request linkage, exact supplied
  evidence/unknown preservation, requested-result caps, cutoff equality, and
  constraint identity.
- 2026-07-28 — Keep product conformance in a separate harness CLI so the
  existing validation, fixture, prediction, and scoring entry points do not
  acquire product-contract initialization or gold-aware behavior.
- 2026-07-28 — Treat already-materialized arrays and objects as an adversarial
  trust boundary. Inspect descriptors without invoking getters, reject
  non-ordinary and hidden shapes, and bound breadth before scheduling work.
- 2026-07-28 — Validate RFC 3339-shaped UTC timestamps structurally and
  calendar/temporal meaning in the pure domain layer. Evaluation mapping derives
  deterministic conformance timestamps only from bounded case/evidence values.
- 2026-07-28 — Supersede the initial purpose-specific repository-fact union
  with a small closed coded fact shape plus a domain-controlled vocabulary.
  Component/version and deployment remain universal typed variants. Ordinary
  first-alpha vocabulary additions negotiate a vocabulary release without
  changing root object shape; unknown codes fail closed and semantics that need
  a new value kind require schema-shape evolution.
- 2026-07-28 — Keep every validation-authority collection private and runtime
  immutable. Repository-fact validation selects a deeply frozen registry by
  the supplied vocabulary version; public inspection returns fresh data-only
  deep snapshots. Deterministic serialization and a committed per-version
  SHA-256 digest make controlled vocabulary drift independently reviewable
  without placing fact codes into the root JSON Schema.
- 2026-07-28 — Use source-aware evidence variants rather than an independent
  source/revision pair. Package versions are exact SemVer values; tag and
  release revisions reject mutable aliases and branch references while
  retaining concrete immutable prerelease identifiers; mutable documentation
  and approved validation have dedicated safe representations.
- 2026-07-28 — Retain supplied candidate limitations in a response catalog with
  candidate-owned assessment references. Exact exchange preservation is
  clearer and more deterministic than attempting to infer an exact limitation
  mapping into arbitrary reason or claim prose.
- 2026-07-28 — Define `assessmentProcessing` only as processing coverage.
  Material uncertainty remains in the unknown catalog, so complete processing
  may responsibly retain unknowns or produce `insufficient-evidence`.
- 2026-07-28 — Keep all corrected root contracts at `1.0.0`. They remain
  unpublished, unmerged, and without a public or deployed consumer, so the
  corrected draft does not create a compatibility transition. The initial
  independently negotiated fact vocabulary is also `1.0.0`.
- 2026-07-28 — State the JavaScript boundary honestly: production adapters pass
  data-only values; already-executable hostile proxies are outside the inert
  guarantee. Parser containment guarantees bounded value-free failure when a
  trap throws, not non-execution of arbitrary proxy traps.

## Validation evidence

| Date       | Command or review                                                                   | Result                                                                                                                                                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-28 | Required Git state commands through `git branch --all`                              | Exit 0; clean aligned `main`, expected SHA                                                                                                                                                                                                        |
| 2026-07-28 | `gh issue view 9 --repo kgudipati/gitblocks`                                        | Unavailable: `gh` not installed                                                                                                                                                                                                                   |
| 2026-07-28 | Connected GitHub Issue #9, Issue #7, and PR #8 reads                                | Issue #9 open; Issue #7 closed; PR #8 merged                                                                                                                                                                                                      |
| 2026-07-28 | First unsourced-shell baseline attempt                                              | Failed before checks: `nvm`/`node` unavailable and pnpm 11.9.0 rejected by engine policy                                                                                                                                                          |
| 2026-07-28 | `nvm use`; runtime/version checks                                                   | Node 24.18.0; pnpm 11.17.0                                                                                                                                                                                                                        |
| 2026-07-28 | `pnpm runtime:check`                                                                | Exit 0                                                                                                                                                                                                                                            |
| 2026-07-28 | `pnpm install --frozen-lockfile`                                                    | Exit 0; already up to date                                                                                                                                                                                                                        |
| 2026-07-28 | `pnpm verify`                                                                       | Exit 0; 302 tests; no architecture/repository/evaluation/secret failures                                                                                                                                                                          |
| 2026-07-28 | `pnpm eval:validate`                                                                | Exit 0; 10 cases                                                                                                                                                                                                                                  |
| 2026-07-28 | `pnpm eval:fixtures`                                                                | Exit 0; five distinct deterministic fixture profiles                                                                                                                                                                                              |
| 2026-07-28 | First post-manifest `pnpm install`                                                  | Expected failure: frozen default rejected an intentionally stale lockfile                                                                                                                                                                         |
| 2026-07-28 | `pnpm install --no-frozen-lockfile`                                                 | Exit 0; supply-chain policy passed; one package added                                                                                                                                                                                             |
| 2026-07-28 | First contracts-package typecheck during parallel construction                      | Failed because the domain package entry point was not yet present; contracts compilation is deferred until the domain slice publishes its source                                                                                                  |
| 2026-07-28 | First ad hoc Ajv schema compilation from the workspace root                         | Failed because strict pnpm isolation does not expose the contracts package dependency at the root; reran from `packages/contracts`                                                                                                                |
| 2026-07-28 | Strict Ajv2020 compilation of all six root schemas from the owning package          | Exit 0; every root schema compiled with its stable versioned `$id`                                                                                                                                                                                |
| 2026-07-28 | First shared-Ajv compilation of all roots                                           | Failed on a duplicate nested fingerprint `$id` because request composition embedded reusable root metadata                                                                                                                                        |
| 2026-07-28 | Shared-Ajv compilation after separating reusable value schemas from versioned roots | Exit 0; one private strict validator instance compiles all six schemas without duplicate identifiers                                                                                                                                              |
| 2026-07-28 | First integrated `pnpm build:product`                                               | Domain built; contracts failed because the exchange mapper passed one object to the domain's two-argument API                                                                                                                                     |
| 2026-07-28 | Exchange-call correction                                                            | Passed the canonical request and result as the domain validator's two explicit arguments; subsequent product build passed, with final post-review matrix still pending                                                                            |
| 2026-07-28 | First integrated contracts ESLint pass                                              | Typecheck passed; lint found one non-null assertion and one unsafe standard-library prototype assignment                                                                                                                                          |
| 2026-07-28 | Contracts lint correction                                                           | Replaced the assertion with an explicit impossible-state guard and used typed `Reflect.getPrototypeOf`; subsequent lint passed, with final post-review matrix still pending                                                                       |
| 2026-07-28 | Corrected contracts typecheck and lint plus first Prettier check                    | Typecheck/lint passed; Prettier identified nine new contract files requiring mechanical formatting                                                                                                                                                |
| 2026-07-28 | First contracts parser suite                                                        | 15/25 passed; valid fingerprints exposed that the graph preflight incorrectly treated shared plain-object references as cycles                                                                                                                    |
| 2026-07-28 | Corrected graph preflight                                                           | Replaced global object de-duplication with iterative ancestor enter/leave tracking; true cycles still fail while harmless shared references pass; 25/25 parser tests passed                                                                       |
| 2026-07-28 | Harness-triggered root typecheck during test construction                           | Reached the new contracts tests and failed on intentional mutation of a readonly TypeBox-derived fixture                                                                                                                                          |
| 2026-07-28 | First response-invariant suite                                                      | 28/29 passed; the disguised-variant case received the stable early `required` issue rather than the later literal issue expected by the test                                                                                                      |
| 2026-07-28 | Contracts test corrections                                                          | Added a test-only recursive mutable view without weakening readonly production DTO types and asserted the actual bounded early structural issue; contracts typecheck and all 29 response tests pass                                               |
| 2026-07-28 | Harness-triggered root lint during test construction                                | Failed because the typed ESLint project service did not yet own the new contracts test files                                                                                                                                                      |
| 2026-07-28 | Contracts ESLint project correction                                                 | Added the package-local test project using the existing workspace convention; subsequent root lint passed, with final post-review matrix still pending                                                                                            |
| 2026-07-28 | First schema-artifact test typecheck                                                | Failed on the intentionally broad JSON-value export type passed to Ajv and a test mutation of a readonly artifact view                                                                                                                            |
| 2026-07-28 | Schema test type correction                                                         | Narrowed each root to an object before compiling a shallow test copy and used `Reflect.set` to verify runtime clone isolation without weakening the readonly public type                                                                          |
| 2026-07-28 | First focused schema-artifact run after intentional schema changes                  | Failed because expected digests still represented the prior serialization; reviewed the actual schema diff and updated every affected digest instead of weakening drift detection                                                                 |
| 2026-07-28 | First `pnpm repo:check` after adding the conformance CLI                            | Failed because the inventory consumes Git's staged production-path view and intentional new CLI/product paths were not staged; staged the intended paths and the check passed                                                                     |
| 2026-07-28 | Concurrent compile/test attempt during shared implementation                        | Failed transiently while one command rebuilt package output another command was resolving; stopped concurrent compilation and reran the affected checks serially without a code or policy bypass                                                  |
| 2026-07-28 | Focused domain, contract, and conformance regressions after review corrections      | Passed at the then-current local tree for corrected fingerprint, preflight, exchange, mapping, bounds, versions, approval, completeness, timestamps, and ranking; the final full matrix remains pending                                           |
| 2026-07-28 | Independent-style security and privacy review                                       | Found the generic free-text fingerprint carrier; replaced it with finite structured variants and exact harness-side mapping, with prohibited-carrier regressions                                                                                  |
| 2026-07-28 | Independent-style architecture and evaluation review                                | Found legacy CLI coupling and case-version leakage; split the conformance CLI, preserved scorer isolation, set unavailable candidate version scope to null, and kept rationale out of inferences                                                  |
| 2026-07-28 | Independent-style domain and contract review                                        | Found gaps in safe error paths, exact evidence/unknown preservation, preflight array/accessor bounds, completeness, requested maximum, timestamps, and maximum cardinalities; corrections added                                                   |
| 2026-07-28 | First build after adding string-work preflight                                      | Failed typecheck because a cached `typeof` variable did not narrow `unknown` for `.length`; used an explicit string cast after the branch check, then product build and all focused tests passed                                                  |
| 2026-07-28 | Composed-maximum and positive-disposition adversarial review                        | Found the 100,000-node valid-maximum mismatch and unsupported zero-evidence recommendation; raised the coherent resource budget and added favorable attributable-claim support with regressions                                                   |
| 2026-07-28 | Scalar and aggregate string-work adversarial review                                 | Found unbounded pre-Ajv string work; added 4,096 per-scalar and 64,000,000 aggregate UTF-16 code-unit limits plus multi-megabyte and aggregate-flood tests                                                                                        |
| 2026-07-28 | Property-name string-work adversarial review                                        | Found that unknown keys bypassed value-only string budgets; charged every array/object string key to the same bounds and added non-echoing oversized-key plus aggregate-key regressions                                                           |
| 2026-07-28 | Focused product build and domain/contract suites after final corrections            | Exit 0; 8 files and 188 tests passed                                                                                                                                                                                                              |
| 2026-07-28 | `pnpm contracts:validate`; architecture and repository checks                       | Exit 0; 10 cases/40 candidates, proposed/not-reviewed and representability-only; 584 modules/1,879 dependencies, no violations; repository checks passed                                                                                          |
| 2026-07-28 | Required full local validation matrix through `pnpm verify:ci`                      | Exit 0 under Node 24.18.0/pnpm 11.17.0; 28 files/522 tests; coverage 90.12% statements, 81.43% branches, 95.44% functions, 90.13% lines; security audit found no known vulnerabilities                                                            |
| 2026-07-28 | `git diff --check`, status, stat, and full diff review after validation             | Exit 0 for whitespace check; only the intended Phase 3 branch changes are present; final staging and unchanged-state proof remain pending                                                                                                         |
| 2026-07-28 | First post-validation dependency-list proof in a fresh shell                        | Failed before inspection because the shell again exposed pnpm 11.9.0; sourced the existing NVM environment and reran without installation or policy bypass                                                                                        |
| 2026-07-28 | Product dependency-list proof under the pinned runtime                              | Exit 0; domain has no package dependency, while contracts resolves only domain, `ajv@8.20.0`, `typebox@1.3.8`, and Ajv's four documented transitives                                                                                              |
| 2026-07-28 | Final independent security and Issue #9 acceptance audits                           | No remaining material blocker; 188 focused product tests and scoped diff checks passed, dependency and prohibited-import rules held, and all six contract/domain/conformance boundaries matched scope                                             |
| 2026-07-28 | Frozen install plus `pnpm verify:ci` staged-state drift proof                       | Exit 0; the complete porcelain-v2 staged/untracked status was identical before and after installation and verification, proving no tracked or untracked artifact drift                                                                            |
| 2026-07-28 | Ordinary implementation commit and first branch push                                | Commit `0090e6c0868d8841fecc051f4df76acbbb7fadfe`; pushed `feat/9-product-contract-kernel` with upstream tracking and no force/history rewrite                                                                                                    |
| 2026-07-28 | Draft PR creation                                                                   | Draft PR #10 opened at `https://github.com/kgudipati/gitblocks/pull/10` with exact required title and `Closes #9`; base `main` remained `27eb7d6585c30fd0f78f238543a764ca7b3c4f76`                                                                |
| 2026-07-28 | Hosted CI run 30414832786 / Verification job 90458949190 decoded-log inspection     | Success; exact runtime/package manager, lockfile policy, metadata checks, `pnpm verify:ci`, 522 tests, architecture, evaluation/conformance, secrets/audit, and final worktree-clean proof all passed                                             |
| 2026-07-28 | Evidence-documentation commit `d5211cf4af53db5663808011cb23e91b345a0112`            | Ordinary follow-up commit and push; no amend, rebase, force-push, or product-code change                                                                                                                                                          |
| 2026-07-28 | Hosted CI run 30415034487 / Verification job 90459574407 decoded-log inspection     | Success; final evidence-documentation head passed the same pinned runtime, frozen install, metadata, 522-test, architecture, evaluation/conformance, secrets/audit, and clean-diff checks                                                         |
| 2026-07-28 | First format check for terminal plan-status correction                              | Failed only on Markdown formatting in this plan; ran the repository-pinned Prettier writer and repeated the format and whitespace checks before committing                                                                                        |
| 2026-07-28 | Independent-review regression red phase                                             | Expected failures before correction: `review-corrections` 15 failed/9 passed of 24; `evidence-provenance` 24 failed/19 passed of 43; no assertion was weakened                                                                                    |
| 2026-07-28 | Corrected `pnpm test` and `pnpm test:coverage`                                      | Exit 0; 30 files/628 tests; 88.17% statements, 77.86% branches, 94.60% functions, and 88.16% lines                                                                                                                                                |
| 2026-07-28 | Corrected architecture, repository, evaluation, and contract checks                 | Exit 0; 588 modules/1,891 dependencies and no violations; repository checks passed; 10 evaluation cases; 10 cases/40 candidates with proposed/not-reviewed representability-only conformance                                                      |
| 2026-07-28 | Corrected security and complete aggregate validation                                | Exit 0; secret scanning and audit passed with no known vulnerabilities; both `pnpm verify` and `pnpm verify:ci` passed under Node 24.18.0/pnpm 11.17.0                                                                                            |
| 2026-07-28 | Corrected frozen-install/verification drift and final diff proof                    | Tracked diff hash `69ce1963ece28401777e7746530a51492714f584` was unchanged; `git diff --check`, status, stat, complete tracked diff, and all four new-file diffs were reviewed                                                                    |
| 2026-07-28 | Final independent correction review                                                 | No unresolved material finding; package/dependency direction, root versions, closed-object/no-mutation parser policy, source-aware provenance, epistemic preservation, traceability, limitations, processing, conformance, and non-goals all held |
| 2026-07-28 | Correction commits and ordinary branch push                                         | `487577d6063bcc355527e1cfcba412574e5f8717` and `5c4884a41d187d50997900366d256191858b8b04`; existing topic branch pushed normally without force, rebase, amend, squash, or history rewrite                                                         |
| 2026-07-28 | Hosted CI run 30420056706 / Verification job 90474826793 decoded-log inspection     | Success on corrected head; Ubuntu 24.04, Node 24.18.0, pnpm 11.17.0, 326-entry frozen lockfile policy, 628 tests, 588/1,891 clean architecture, repository/evaluation/conformance checks, secrets/audit, and terminal clean diff all passed       |

The corrected implementation and documentation head has complete hosted
Verification evidence. The draft PR description remains the terminal
hosted-status record after the final evidence-only plan commit to avoid an
unbounded self-referential commit chain.
