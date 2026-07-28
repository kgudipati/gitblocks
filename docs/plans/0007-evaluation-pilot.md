# Phase 2 evaluation contracts and pilot corpus

## Status and authority

- Governing issue:
  [#7 — Phase 2: Establish evaluation contracts and pilot corpus](https://github.com/kgudipati/gitblocks/issues/7)
- Branch: `test/7-evaluation-pilot`
- Owner: GitBlocks maintainers; implementation authoring session is Codex
- State: in progress
- Last updated: 2026-07-28
- Authority order: Issue #7, actual repository and Git history, the
  [product contract](../product/product-contract.md) and accepted ADRs,
  repository agent/planning/engineering policy, then the execution prompt.

Issue #7 owns the complete deliverables, acceptance criteria, composition,
security constraints, and non-goals. This plan maps those requirements to
implementation and evidence; it does not narrow them. The pilot gold produced
by this authoring session is proposed gold for independent review, not accepted
or independently validated gold.

## Purpose and user-visible outcome

The current repository contains engineering tooling but no executable
evaluation contract. This change will add a versioned, offline evaluation
system that tests repository-conditioned adoption fit over a fixed candidate
set. A contributor will be able to validate the ten-case pilot, validate and
score structured predictions, and compare deterministic weak fixtures without
running candidate code, a model, discovery, or any product service.

The approved outcome is a development corpus that can falsify the
representation and scoring rules. It is not a statistically meaningful
benchmark, an accepted holdout set, an open-world discovery evaluation, a
generic-agent baseline, or evidence of GitBlocks product performance.

## Verified current repository state

Verification on 2026-07-28 established:

- the worktree was clean on local `main`;
- `origin` fetches and pushes
  `https://github.com/kgudipati/gitblocks.git`;
- `git fetch origin`, `git switch main`, and
  `git pull --ff-only origin main` completed without changing `main`;
- local `main` and `origin/main` both resolve to
  `937f35be32223603965519a1448da636a7504f48`;
- the latest history is `937f35b`, `3219848`, `499d984`, `265a6e0`,
  `6801407`, and `a5b04b6`;
- PR #6 is merged, its merge commit is `937f35b`, and its `Closes #5`
  reference plus the closed-issue query confirms Issue #5 is closed;
- connected GitHub issue search confirms Issue #7 is open and its complete
  body matches this phase;
- `rg --files` found no `schemas/evaluation`, `evals`, evaluation harness,
  scoring implementation, baseline data, or evaluation documentation;
- the only workspace package is `@gitblocks/repository-checks`; no product
  service exists;
- the required branch was created locally from the verified head as
  `test/7-evaluation-pilot`;
- after sourcing the already-installed
  `/Users/karthikgudipati/.nvm/nvm.sh`, `nvm use` selected Node 24.18.0 and
  pnpm reported 11.17.0;
- `pnpm runtime:check` passed; and
- the pre-change `pnpm verify` passed with 161 tests across 10 files,
  dependency-cruiser reporting 135 modules and 330 dependencies with no
  violations, repository checks passing, and Secretlint passing.

The first runtime attempt is retained as failure evidence: the initial login
shell did not expose `nvm` or `node`, exposed fallback pnpm 11.9.0, and failed
the engine check before repository code ran. No tool was installed. Sourcing
the existing nvm installation corrected the shell path and produced the
supported versions above.

Relevant repository controls inspected before editing include Issue #7, PR #6,
the product contract, ADRs 0001 and 0002, `PLANS.md`, `AGENTS.md`, the complete
engineering handbook, root/workspace/compiler/lint/test/dependency
configuration, repository-check implementation and tests, and current Git
history.

## Product-contract crosswalk

| Product-contract rule                                                                                     | Consequence in this phase                                                                                                       | Evidence                                                         |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| First ecosystem is TypeScript, Node.js, Next.js, PostgreSQL, Prisma/Drizzle, and common deployment models | Every case stays inside this ecosystem and the corpus machine-checks ORM and topology coverage                                  | Case profiles, manifest diversity declaration, corpus validation |
| Exactly five alpha capability families                                                                    | Exactly two cases each for authorization, audit logging, background jobs, rate limiting, and webhooks                           | Manifest and family aggregation                                  |
| Relevance is not adoption fit                                                                             | Candidate sets are fixed; scoring evaluates dispositions, responsible outcome, ordering, exclusions, unknowns, and evidence     | Schemas, gold, scorer, weak fixtures                             |
| Hard constraints disqualify candidates                                                                    | Recommending or marking a conflicting candidate viable creates a separate unsafe gate                                           | Gold conflict contract and safety metric                         |
| Useful outcomes include no viable candidate and insufficient evidence                                     | Corpus includes at least two responsible abstentions and scores outcome separately                                              | Gold outcomes and abstention metric                              |
| Evidence is dated and attributable; inference and unknowns remain distinct                                | Bounded evidence observations use stable IDs, cutoff dates, source metadata, limitations, and gold traceability                 | Evidence schema, authoring guide, integrity validation           |
| Raw source, secrets, and private data stay local                                                          | Profiles are synthetic/minimized composites; evidence is concise paraphrase; no raw repository or customer content is committed | Manual privacy review, schema bounds, secret scan                |
| Every accepted remote shape is versioned and schema validated                                             | Evaluation documents use JSON Schema 2020-12 and schema version `1.0.0`                                                         | Six schemas and schema-contract tests                            |
| Candidate code is not executed                                                                            | The harness only reads bounded JSON and never installs, imports, clones, builds, or shells from corpus values                   | Architecture, abuse tests, offline verification                  |

The product contract is unchanged. This phase makes a development evaluation
boundary executable; it does not implement the planned discovery, scanner,
ranking, MCP, Skill, backend, or outcome services.

## Issue #7 requirements crosswalk

| Issue requirement                               | Destination/milestone                                                      | Validation                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Six versioned contracts                         | `schemas/evaluation/*.schema.json`; Milestone 1                            | schema valid/invalid tests and `eval:validate`                     |
| One private non-product harness                 | `tools/evaluation-harness`; Milestones 2–4                                 | package privacy/invariants, typecheck, build, architecture         |
| Bounded JSON and filesystem boundary            | `src/json-boundary.ts`; Milestone 2                                        | byte/depth/count/path/symlink/inert-data tests                     |
| Manifest SHA-256 drift detection                | manifest loader/hasher; Milestone 2                                        | drift and deterministic ordering tests                             |
| Referential integrity and prediction validation | pure contract functions; Milestone 2                                       | duplicate, omission, unknown-reference, contradiction, order tests |
| All required deterministic metrics              | pure scorer/report modules; Milestone 3                                    | formula unit tests, aggregate/breakdown tests                      |
| Exactly ten balanced cases                      | `evals/pilot-v1`; Milestone 5                                              | corpus validation plus manual crosswalk                            |
| 3–5 current OSS candidates per case             | cases/evidence; Milestone 5                                                | schema/count checks and source review                              |
| Blind inputs and separated proposed gold        | `cases/` versus `gold/`; Milestone 5                                       | forbidden-field/order leakage checks                               |
| Dated attributable bounded evidence             | `evidence/`; Milestone 5                                                   | evidence schema, cutoff and reference checks                       |
| Weak fixtures, not a fake baseline              | `fixtures/weak-baselines`; Milestone 4                                     | distinct deterministic reports                                     |
| Contamination-resistant future protocol         | `docs/evaluation/baseline-protocol.md`; Milestone 6                        | documentation/invariant review                                     |
| Root commands and offline CI integration        | root scripts and verify graph; Milestone 6                                 | command and CLI tests                                              |
| Repository and architecture protections         | repository invariants and dependency-cruiser; Milestone 6                  | positive/negative rule fixtures                                    |
| Documentation consistency                       | README, AGENTS, CONTRIBUTING, testing strategy, evaluation docs, this plan | Markdown/repository checks                                         |
| Complete local and hosted validation            | Milestone 7                                                                | exact command evidence and final CI status                         |
| Draft PR, exact title, `Closes #7`              | Publication                                                                | connector PR snapshot remains draft                                |

Every acceptance criterion in Issue #7 is represented by one or more rows
above. The final acceptance review will reconcile the complete issue checklist,
not only this summary.

## Scope and explicit non-goals

In scope:

- six JSON Schema 2020-12 evaluation contracts;
- one private evaluation-harness workspace;
- one established evaluation-only schema validator with an exact pin;
- bounded JSON/filesystem loading, manifest hashing, reference validation,
  scoring, aggregation, stable serialization, CLI adapters, and tests;
- exactly ten proposed pilot cases and separate evidence/gold records;
- deterministic weak fixtures and future baseline protocol;
- root command, verification, repository-invariant, dependency-cruiser,
  Vitest, TypeScript, README, agent, contributor, testing, evaluation, and plan
  integration; and
- ordinary commits, push, draft PR, and hosted CI correction.

Explicitly out of scope:

- open-world candidate discovery, catalog ingestion, crawling, retrieval,
  embeddings, product ranking heuristics, or dossier generation;
- scanner/fingerprint implementation, backend/API, MCP, Agent Skill, database,
  queue, cache, storage, authentication, tenant service, web application,
  deployment, analytics, or telemetry backend;
- candidate dependency installation, cloning, importing, executing, building,
  or live URL fetching from tests/CI;
- model or external-agent calls in the harness, tests, CI, or a purported live
  baseline;
- a 30–50 case corpus, a hidden holdout corpus, independent gold acceptance,
  marketing claims, or production performance claims; and
- proprietary repository data, raw configurations/source, secrets,
  credentials, customer data, full documentation pages, package archives, or
  screenshots.

## Schema architecture

JSON Schema draft 2020-12 is selected because it is the current stable draft
supported by Ajv 8 and provides unambiguous array semantics and
`unevaluatedProperties`. Every schema has an absolute GitBlocks `$id`, declares
`$schema`, has schema version `1.0.0`, rejects unknown fields, and contains
explicit string/array/object bounds.

The authoritative contracts are:

1. `case.schema.json`: blind case input, profile, request, constraints,
   candidates, available evidence IDs, unknown/reason catalogs, author/cutoff
   dates, difficulty, and failure-mode tags.
2. `evidence.schema.json`: per-case bounded source observations, candidate/case
   subject, source type/URL, collection/publication time, observation,
   freshness scope, direct/local classification, and limitation.
3. `gold.schema.json`: proposed outcome, every candidate disposition, rank
   groups plus incomparable pairs, hard conflicts, required unknown/evidence/
   reason IDs, allowed outcomes, review rationale, cutoff, and honest
   provenance.
4. `prediction.schema.json`: case ID, outcome, every disposition, rank groups,
   reason/evidence references per candidate, disclosed unknowns, bounded
   rationale, and run metadata.
5. `score.schema.json`: visible safety gate, per-label/macro metrics, ranking,
   abstention, unknown/evidence/reason metrics, and aggregate/family/failure
   breakdowns.
6. `manifest.schema.json`: corpus/version/cutoff/status, sorted case entries,
   relative paths, SHA-256 hashes, family counts, declared diversity, and
   authoring provenance.

Schemas validate local shape. Pure referential validation owns cross-file and
graph rules that JSON Schema cannot clearly express: complete/disjoint
candidate sets, stable ID resolution, conflict consistency, rank membership,
duplicate pairs, cycle detection, cutoff equality, and prediction/gold
semantics. TypeScript types are centralized in the harness for internal
behavior but do not replace the JSON Schemas as the persisted contract.

Compatibility policy: `1.x` schemas reject unknown fields and accept only the
exact `1.0.0` document version in this pilot. A future compatible schema
revision requires fixtures and an explicit migration policy; an incompatible
shape uses a new schema/corpus major. No deployed mixed-version consumer
exists.

## Corpus directory design

```text
schemas/evaluation/
  case.schema.json
  evidence.schema.json
  gold.schema.json
  manifest.schema.json
  prediction.schema.json
  score.schema.json
evals/pilot-v1/
  manifest.json
  cases/<case-id>.json
  evidence/<case-id>.json
  gold/<case-id>.json
  fixtures/weak-baselines/<fixture-name>/<case-id>.json
tools/evaluation-harness/
  package.json
  src/
  test/
docs/evaluation/
  authoring-guide.md
  baseline-protocol.md
  scoring-and-metrics.md
```

The manifest protects schema-independent corpus membership and hashes all
case/evidence/gold files. Repository invariants protect directory contracts,
schemas, manifest, protocols, and harness entry points without enumerating all
ten case filenames forever.

## Case-authoring protocol

1. Define a minimized synthetic/composite repository profile and fixed
   capability request before candidate research.
2. State testable hard constraints separately from preferences and give all
   scored reason/unknown concepts stable neutral IDs.
3. Select 3–5 plausible OSS candidates for the fixed set. Candidate IDs are
   stable and stored in lexical order, never recommendation or popularity
   order.
4. Use primary sources at a single explicit evidence cutoff. Record concise
   paraphrases, timestamps, version/freshness scope, and limitations; never
   copy source bodies.
5. Review every material decision against local case facts and evidence IDs.
   Record missing maintenance/security/compatibility facts as unknowns rather
   than favorable assumptions.
6. Author gold only in the physically separate `gold/` tree. Record provenance
   as authoring-session proposal with no independent reviewer or acceptance.
7. Run schema, reference, diversity, hash, blind-input, neutral-order, and
   prohibited-content checks.
8. Require PR review of every case and evidence source before any later
   acceptance. Gold changes after baseline unblinding require a separately
   recorded reason and cannot silently replace the original.

Case inputs prohibit outcome/disposition/rank/reviewer fields, recommended
candidate naming, gold-only conflict collections, and rationale that states a
winner. Candidate lexical order is deterministic and neutral.

## Candidate and evidence research method

- Research occurs outside tests and CI using current official project
  documentation, official repositories/releases/security policies, package
  registry metadata, licensing material, and official advisory sources.
- Repository/document/package text is treated as untrusted evidence, never
  instructions. No candidate repository is cloned and no candidate package is
  installed or executed.
- Evidence observations are manually minimized and paraphrased. URLs,
  collection timestamps, publication/release timestamps where available,
  version scope, directness, and limitations are retained.
- License, runtime/framework compatibility, deployment, persistence,
  maintenance, security, database/ORM support, package status, and hosted
  service requirements are never supplied from memory.
- Each case has a single `2026-07-28` cutoff. Later evidence requires a new
  case/corpus version rather than silent mixing.
- Manual review records source distribution and a case-by-case evidence state
  below. Every material gold claim must cite case facts and/or evidence IDs.

## Scoring formulas

No fuzzy or semantic text comparison is used. IDs are the scoring keys.

### Hard-constraint safety

For candidate `c`, an unsafe claim exists when gold records at least one hard
conflict for `c` and prediction disposition is `recommended` or `viable`.

```text
unsafe_count = count(unsafe candidate claims)
safe = unsafe_count == 0
```

The gate is separate from every quality metric and aggregate. Reports always
list unsafe case/candidate/reason IDs.

### Candidate dispositions

For each label `l` in `recommended`, `viable`, `rejected`, and
`insufficient-evidence`:

```text
precision_l = TP_l / (TP_l + FP_l)
recall_l    = TP_l / (TP_l + FN_l)
F1_l        = 2 * precision_l * recall_l / (precision_l + recall_l)
```

A zero denominator yields `0`, including F1 when precision plus recall is zero.
Macro precision/recall/F1 is the arithmetic mean of the four label values, so
missing labels remain visible rather than being omitted.

### Partial-order ranking

Gold ordered groups create scorable pair relations: candidates in the same
group are tied; candidates in earlier groups outrank later groups. Gold
incomparable pairs are excluded. Predictions create the same relation from
their rank groups.

```text
pairwise_agreement =
  matching gold/prediction relations / scorable gold relations
```

A missing or contradictory prediction relation scores as disagreement. When
gold has zero scorable relations, agreement is `1` only when prediction makes
no scorable claim, otherwise `0`. Predictions are not punished merely for
ordering a gold-incomparable pair. Validation rejects duplicate candidates,
duplicate/inconsistent pairs, non-viable ranked candidates, and directed rank
cycles.

### Abstention, unknowns, evidence, and reasons

Outcome correctness is exact membership in gold primary plus allowed outcomes.
Reports provide exact accuracy for `recommend`, `no-viable-candidate`, and
`insufficient-evidence` separately; absent classes use zero.

```text
unknown_recall  = disclosed required unknown IDs / required unknown IDs
evidence_recall = recovered required evidence IDs / required evidence IDs
reason_recall   = recovered required reason IDs / required reason IDs
```

An empty required set yields `1` because there is no omitted obligation.
Unknown/unrelated IDs fail referential validation and never disappear from a
denominator. Candidate claim evidence is unioned only after subject
relationship validation.

### Aggregation

Aggregate, capability-family, and targeted failure-mode reports score the
relevant case set from pooled counts/pairs/required IDs, with deterministic
lexical keys. No convenience weighted aggregate is planned; separate metrics
and the safety gate are clearer for this pilot.

## Authoring-contamination analysis

The same session will design contracts, author the ten cases, research
evidence, and propose gold. It therefore knows the answers and cannot produce
an independent generic-agent baseline or claim unbiased gold acceptance.

Controls:

- physical case/evidence/gold separation;
- case inputs contain no gold or reviewer fields;
- lexical candidate order rather than winner/popularity order;
- SHA-256 manifest drift detection;
- explicit proposed-development-set status and provenance;
- retained weak deterministic fixtures labeled as harness tests only;
- later evaluator input excludes gold files;
- one primary attempt per case with retries retained separately;
- accepted generic-agent baseline must use a different session after gold
  review;
- no baseline result may silently rewrite gold after unblinding; and
- future holdout cases must isolate gold from the system under test.

Residual risk: public proposed gold can influence any later agent that has
repository access. This pilot is therefore permanently a development set, not
an unbiased holdout.

## Security and privacy analysis

Assets are contract integrity, proposed gold integrity, source attribution,
developer trust, local filesystem boundaries, and the guarantee that evidence
remains inert data. Actors include maintainers, evaluation authors, future
evaluators, malicious corpus content, and compromised dependencies.

Trust boundaries:

- filesystem paths and JSON bytes enter through a bounded loader;
- JSON values cross schema and referential validation;
- evidence URLs/text remain data and never become commands/imports/network
  calls;
- prediction files cross validation before scoring; and
- dependency registry metadata is reviewed before an exact install.

Controls:

- maximum bytes per file and report, maximum file/case/ID counts, maximum JSON
  depth/node count/string length, and capped diagnostics;
- relative normalized lexical manifest paths, repository-root containment,
  regular-file requirement, symlink rejection, and unsafe-control-character
  rejection;
- JSON parse only; no YAML, eval, `Function`, dynamic import, template
  execution, prototype merging, archive extraction, or schema-loaded remote
  references;
- no shell command is constructed from corpus content;
- deterministic file ordering and stable JSON serialization;
- schema validation with coercion/default/removal disabled and unknown fields
  rejected;
- no test/CI network, model call, package install, repository clone, candidate
  import/build/execute, or live evidence fetch;
- synthetic profiles and bounded public-source paraphrases only; and
- Secretlint, diff review, evidence cutoff, integrity hashes, and dependency
  audit.

The harness is private repository tooling and has no shared/production path,
tenant, authentication, deployment, or telemetry. Production observability is
therefore not applicable. CLI diagnostics are stable, sorted, bounded, and do
not print file bodies or arbitrary corpus strings.

## Dependency review

The minimum justified new direct dependency is `ajv@8.20.0`, scoped as a
runtime dependency of the private evaluation harness only.

Pre-install review on 2026-07-28:

- stable exact version: `8.20.0`;
- publication: official GitHub release `v8.20.0` on 2026-04-24; npm reports it
  as the current release;
- function: maintained JSON Schema validator with explicit draft 2020-12
  support through the `ajv/dist/2020` entry point;
- provenance: `ajv-validator/ajv`, official `ajv.js.org`, and npm package
  metadata agree;
- license: MIT;
- TypeScript: built-in declarations; no `@types/ajv` package required; source
  targets ES2018 and the project documents Node 18-current support, which
  includes the repository's Node 24 line;
- direct published dependency declarations:
  `fast-deep-equal@^3.1.3`, `fast-uri@^3.0.1`,
  `json-schema-traverse@^1.0.0`, and
  `require-from-string@^2.0.2`;
- lifecycle review: the published manifest declares development/test/build and
  `prepublish` scripts but no consumer `preinstall`, `install`, or
  `postinstall` lifecycle;
- integrity:
  `sha512-Thbli+OlOj+iMPYFBVBfJ3OmCAnaSyNn4M1vz9T6Gka5Jt9ba/HIR56joy65tY6kx/FCF5VXNB819Y7/GUrBGA==`;
- supply-chain controls remain unchanged: exact direct pin, pnpm-generated
  lockfile, 24-hour minimum age, strict peers/engines, trust no-downgrade,
  default-denied builds, and no trust exception;
- selection rationale: Ajv validates the complete stable JSON Schema
  vocabulary, schemas against the meta-schema, strict unknown-key policy, and
  reference behavior. A custom partial validator would create an
  under-specified security boundary, duplicate a standard, and require far more
  negative tests.

Pending before implementation completion: resolve through pnpm, record exact
transitive versions/integrities and lockfile delta, inspect installed published
manifests for lifecycle scripts, run the registry audit, and record advisories.
This choice is evaluation-tooling-only and does not select a future product
API schema library.

Primary references:

- [Ajv JSON Schema support](https://ajv.js.org/json-schema.html)
- [Ajv repository and release history](https://github.com/ajv-validator/ajv)
- [Ajv npm metadata](https://www.npmjs.com/package/ajv)

## Architecture, data flow, and performance impact

```text
bounded filesystem/JSON loader -> schema validation -> referential validation
                                                    -> pure scoring
                                                    -> stable report serializer
CLI arguments -----------------> repository-root resolver -------------------^
```

Filesystem and process behavior stays in adapters. Schema/ref integrity,
metrics, aggregation, and serialization are pure. The harness does not import
repository-check internals, candidate code, or product modules. Product
workspaces remain prohibited from importing any `tools/` package. No production
source may import `evals/**/gold`.

Initial budgets subject to tests:

- at most 256 KiB per JSON file, 32 MiB aggregate read, 500 JSON files, 10
  pilot cases, 5 candidates per case, 256 IDs per case, 64 levels, 50,000 JSON
  nodes, 500 diagnostics, and 4 MiB serialized report;
- synchronous local reads are acceptable for this fixed private tool because
  bounds are small and no concurrent/shared server exists;
- SHA-256 uses Node crypto over exact file bytes;
- no retries, network, clock-sensitive scoring, randomness, or concurrency;
  and
- failures are deterministic validation/usage/internal categories.

## Assumptions, risks, and unresolved decisions

Verified facts are in the current-state and dependency sections. Working
assumptions:

- one corpus-wide cutoff date simplifies freshness consistency;
- lexical candidate IDs are neutral enough for blind pilot input;
- exact ID recall is appropriate for this structural pilot; and
- pairwise partial-order agreement is easier to review than a convenience rank
  correlation with ties/incomparability.

Risks:

- current OSS facts may be ambiguous or change after cutoff;
- popular candidates may combine open-source and hosted offerings with
  confusing licensing/deployment boundaries;
- a ten-case authoring session can overfit the schema;
- duplicated schema and TypeScript shapes can drift; and
- generated Ajv validators use code generation internally, though only
  maintainer-owned committed schemas are compiled and corpus strings are never
  treated as schemas.

Mitigations are source limitations/unknowns, exact cutoff/version scope,
proposed-gold labeling, schema/fixture tests, manifest hashes, strict schema
registration from fixed paths, and independent case review.

Open until the applicable milestone:

- exact case candidates and dispositions: resolved only after primary-source
  research in Milestone 5;
- exact resolved Ajv transitives/advisories: resolved in Milestone 1 after
  pnpm lock generation;
- measured coverage baseline: resolved in Milestone 7; and
- hosted CI run/job identifiers: resolved after publication.

## Implementation milestones

### Milestone 1 — Contracts and dependency

- Add failing schema contract tests for every valid/invalid document shape.
- Add six draft 2020-12 schemas and the private harness package skeleton.
- Add `ajv@8.20.0` with pnpm only and complete the dependency review.
- Evidence: focused schema tests, frozen install, lock/lifecycle/integrity
  review.

### Milestone 2 — Bounded loading and integrity

- Begin with failures for oversized/deep/many JSON inputs, unsafe paths,
  symlink escape, duplicate IDs, unknown references, omission, contradiction,
  invalid ranks, cycles, cutoff mismatch, hash drift, and inert malicious
  strings.
- Implement the filesystem adapter and pure referential validation.
- Evidence: focused unit/integration tests and manifest validation.

### Milestone 3 — Pure scorer

- Begin with formula tests for safety, per-label/macro disposition metrics,
  zero denominators, partial-order pairs/ties/incomparability, abstention,
  unknown/evidence/reason recall, and aggregation.
- Implement deterministic single-case and corpus scoring plus stable
  serialization.
- Evidence: exact expected metric objects and repeatability tests.

### Milestone 4 — CLI and weak fixtures

- Add CLI behavior/exit/subdirectory tests.
- Add `first-candidate`, `all-viable`, `always-abstain`, `omit-unknowns`, and
  `perfect` prediction sets.
- Prove distinct, explainable report profiles and visible unsafe output.
- Evidence: `eval:score` and `eval:fixtures` integration tests.

### Milestone 5 — Ten-case pilot

- Research and author exactly two cases per family with 3–5 OSS candidates,
  separate evidence/proposed gold, required diversity, and a single cutoff.
- Generate the manifest hashes using the reviewed harness command.
- Evidence: automated composition validation and case-by-case manual review.

### Milestone 6 — Repository integration and documentation

- Update root scripts/verification, TypeScript/Vitest/dependency-cruiser,
  repository invariants/tests, README, AGENTS, CONTRIBUTING, testing strategy,
  authoring/scoring/baseline documentation, and this plan.
- Add architecture negatives for product-to-harness and production-to-gold.
- Evidence: repository/architecture/Markdown checks and complete crosswalk.

### Milestone 7 — Validation and publication

- Run every exact local command, record failures/corrections and coverage,
  review the complete diff and prohibited scope, commit intentionally, push
  normally, open the exact draft PR with `Closes #7`, inspect hosted CI, and
  correct failures only with ordinary follow-up commits.
- Evidence: commit SHAs, PR snapshot, final CI run/job/check, clean tracked
  worktree.

## Testing and validation strategy

Unit tests cover pure validation/scoring/serialization. Contract tests cover
all six schemas. Integration tests cover bounded filesystem and CLI behavior.
Negative/abuse cases cover exhaustion bounds, paths/symlinks, graph
contradictions, unsafe recommendations, unknown references, malicious inert
strings, and deterministic ordering. No network, arbitrary sleep, candidate
execution, model, external agent, or global Git configuration is used.

Exact commands run from repository root under Node 24.18.0 and pnpm 11.17.0:

```bash
export NVM_DIR=/Users/karthikgudipati/.nvm
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
pnpm security:secrets
pnpm security:audit
pnpm verify
pnpm verify:ci
git diff --check
git status --short --branch
git diff --stat
git diff
```

Additional acceptance inspection will prove exactly ten cases, exactly two per
family, 3–5 candidates each, all diversity declarations, lexical candidate
order, blind inputs, complete references and hashes, distinct weak fixtures,
visible unsafe cases, offline core commands, prohibited-code absence, no
candidate/model/product-service behavior, and a clean final tracked worktree.

## Observability and operations

Not applicable to shared/production telemetry: this private deterministic tool
has no deployed path, user traffic, service, worker, provider, queue, or
credentials. CLI operations and errors are stable and bounded, reports carry
schema/corpus versions, and failures are reproducible from committed inputs.
No generated reports are committed.

## Migration, compatibility, rollout, and recovery

There is no database or deployed migration. New schema version `1.0.0` and
corpus `pilot-v1` have no prior consumers. The branch is additive except for
tooling configuration/documentation updates. Before merge, recovery is
ordinary PR reversion. After merge, a faulty harness/corpus can be reverted as
one coherent change without data loss. Future schema changes require explicit
compatibility fixtures and either a compatible minor contract revision or a
new major/corpus directory. Gold correction preserves audit rationale and
regenerates hashes; post-unblinding correction cannot be silent.

## Exact exit criteria

- Every Issue #7 deliverable and acceptance criterion is reconciled.
- Six schemas, the harness, ten balanced cases, evidence/gold, weak fixtures,
  three evaluation documents, and repository integrations are present.
- Proposed gold is honestly labeled and case-by-case source review state is
  recorded; no independent acceptance is claimed.
- All local commands above pass on the supported runtime, coverage is measured,
  every failure/correction is recorded, and the complete diff is reviewed.
- Security, privacy, dependency, lifecycle, integrity, advisory, architecture,
  blind-input, composition, and prohibited-scope reviews pass.
- No candidate code or repository was installed/cloned/imported/executed; no
  model/live baseline ran; no product service or ranking implementation was
  added.
- Ordinary Conventional Commits are pushed to the exact branch, the exact PR
  remains draft with `Closes #7`, and hosted CI passes on the final head.
- `main` remains unchanged and the final topic-branch worktree is clean.

## Case-by-case evidence review state

All rows are pending primary-source research. Status `proposed` means authored
by this session and never independently accepted.

| Planned case ID               | Family          | Research | Evidence/gold review | Independent acceptance |
| ----------------------------- | --------------- | -------- | -------------------- | ---------------------- |
| `authorization-edge-drizzle`  | authorization   | pending  | pending              | no                     |
| `authorization-tenant-prisma` | authorization   | pending  | pending              | no                     |
| `audit-append-only-prisma`    | audit logging   | pending  | pending              | no                     |
| `audit-residency-drizzle`     | audit logging   | pending  | pending              | no                     |
| `jobs-container-redis`        | background jobs | pending  | pending              | no                     |
| `jobs-serverless-postgres`    | background jobs | pending  | pending              | no                     |
| `rate-limit-container-local`  | rate limiting   | pending  | pending              | no                     |
| `rate-limit-serverless-redis` | rate limiting   | pending  | pending              | no                     |
| `webhooks-inbound-edge`       | webhooks        | pending  | pending              | no                     |
| `webhooks-outbound-residency` | webhooks        | pending  | pending              | no                     |

## Progress log

- 2026-07-28: Read Issue #7 completely through connected GitHub access because
  `gh` is unavailable; verified PR #6 merged and Issue #5 closed.
- 2026-07-28: Fetched/synchronized `main` at the expected
  `937f35be32223603965519a1448da636a7504f48`; confirmed clean worktree and no
  existing evaluation artifacts.
- 2026-07-28: Initial runtime attempt failed because the shell exposed neither
  nvm nor Node and fallback pnpm was 11.9.0. Located and sourced the existing
  local nvm installation without installing tools; Node 24.18.0/pnpm 11.17.0
  then passed preflight and the 161-test pre-change verification graph.
- 2026-07-28: Created local branch `test/7-evaluation-pilot` from verified
  `main`.
- 2026-07-28: Researched Ajv 8.20.0 through official documentation, GitHub, and
  npm registry metadata; recorded the pre-install review.
- 2026-07-28: Created this plan before implementation.

## Decision and deviation log

- 2026-07-28 — Use JSON Schema 2020-12. It is a current stable draft, directly
  meets the issue, and supports strict closed shapes. Draft-07 was rejected
  because using the requested current contract now avoids a later representational
  migration; multi-draft support is unnecessary.
- 2026-07-28 — Select Ajv 8.20.0 for the private harness, pending final resolved
  graph review. A custom validator was rejected as partial and riskier. This is
  not a future product schema-library decision.
- 2026-07-28 — Use exact ID recall and pairwise partial-order agreement without
  a convenience aggregate. This keeps the pilot deterministic, reviewable, and
  unable to hide unsafe output.
- 2026-07-28 — The shell-path runtime failure is an environment activation
  issue, not a repository contradiction. The existing supported runtime was
  activated; no preflight or supply-chain rule was bypassed.

## Failed checks and corrections

| Date       | Command/check                                                   | Failure                                                                                  | Correction/evidence                                                                                            |
| ---------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 2026-07-28 | `nvm use`; `node --version`; `pnpm --version`; preflight/verify | Login shell did not expose nvm/Node; fallback pnpm 11.9.0 failed the exact engine policy | Sourced the existing `/Users/karthikgudipati/.nvm/nvm.sh`; rerun selected Node 24.18.0/pnpm 11.17.0 and passed |

Implementation failures will be appended here rather than overwritten.

## Validation evidence

| Date       | Evidence                                                           | Result                                                                           |
| ---------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 2026-07-28 | `git status --short --branch` before branching                     | clean `main...origin/main`                                                       |
| 2026-07-28 | fetch/switch/fast-forward pull, log, rev-parse, branches           | local/remote synchronized at expected `937f35b`                                  |
| 2026-07-28 | connected GitHub Issue #7 and PR #6/Issue #5 reads                 | Issue #7 open and complete; PR #6 merged; Issue #5 closed                        |
| 2026-07-28 | `rg --files`                                                       | no evaluation schema/corpus/harness/baseline present                             |
| 2026-07-28 | supported `nvm use`; versions; `pnpm runtime:check`; `pnpm verify` | Node 24.18.0, pnpm 11.17.0; 161 tests pass; architecture/repository/secrets pass |
| 2026-07-28 | `git switch -c test/7-evaluation-pilot`; `git rev-parse HEAD`      | required local branch created at `937f35b`                                       |

### Hosted CI evidence

Pending publication. Record workflow/run/job URLs, final head SHA, conclusion,
and any failure/correction commits here. The PR must remain draft.
