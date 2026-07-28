# Phase 2 evaluation contracts and pilot corpus

## Status and authority

- Governing issue:
  [#7 — Phase 2: Establish evaluation contracts and pilot corpus](https://github.com/kgudipati/gitblocks/issues/7)
- Branch: `test/7-evaluation-pilot`
- Owner: GitBlocks maintainers; implementation authoring session is Codex
- State: implementation published; independent review corrections in progress
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
   decision objective, optional controlled-comparison pair ID, candidates,
   available evidence IDs, unknown/reason catalogs, author/cutoff dates,
   difficulty, and failure-mode tags.
2. `evidence.schema.json`: per-case bounded source observations, candidate/case
   subject, source type/URL, immutable revision/version locator,
   collection/publication time, observation, freshness scope, direct/local
   classification, and limitation.
3. `gold.schema.json`: proposed or future accepted outcome, every candidate
   disposition, rank groups plus incomparable pairs, hard conflicts, required
   case-global unknown IDs, allowed outcomes, review rationale, cutoff, and
   conditionally valid lifecycle provenance. Candidate evidence/reason
   obligations are derived from dispositions and conflicts rather than stored
   twice.
4. `prediction.schema.json`: case ID, outcome, every disposition, rank groups,
   reason/evidence references per candidate, disclosed unknowns, bounded
   rationale, and run metadata.
5. `score.schema.json`: visible safety gate, per-label/macro metrics, ranking,
   abstention, unknown/evidence/reason metrics, and aggregate/family/failure
   breakdowns.
6. `manifest.schema.json`: corpus/version/cutoff/status, sorted case entries,
   relative paths, SHA-256 hashes, family counts, declared diversity, and
   conditionally valid proposed/accepted provenance.

Schemas validate local shape. Pure referential validation owns cross-file and
graph rules that JSON Schema cannot clearly express: complete/disjoint
candidate sets, stable ID resolution, conflict consistency, rank membership,
duplicate/contradictory pair relations, cycle detection, controlled-comparison
invariants, pilot ecosystem scope, source-revision consistency, derived
diversity, cutoff equality, and prediction/gold outcome semantics. TypeScript
types are centralized in the harness for internal behavior but do not replace
the JSON Schemas as the persisted contract.

Compatibility policy: `1.x` schemas reject unknown fields and accept only the
exact `1.0.0` document version in this pilot. A future compatible schema
revision requires fixtures and an explicit migration policy; an incompatible
shape uses a new schema/corpus major. No deployed mixed-version consumer
exists. The independent-review corrections retain `1.0.0` because neither the
contract nor corpus has merged or been released; this is correction of the
initial pre-release contract, not migration of an accepted consumer.

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
tools/evaluation-harness/
  package.json
  src/weak-fixtures.ts
  src/<boundary-validation-scoring-cli modules>
  test/
docs/evaluation/
  case-authoring-protocol.md
  baseline-protocol.md
  scoring.md
```

The manifest protects schema-independent corpus membership and hashes all
case/evidence/gold files. Repository invariants protect directory contracts,
schemas, manifest, protocols, and harness entry points without enumerating all
ten case filenames forever. Weak prediction sets are generated from the
validated corpus by pure deterministic strategies rather than stored as a
second set of mutable corpus files.

## Case-authoring protocol

1. Define a minimized synthetic/composite repository profile and fixed
   capability request before candidate research.
2. State testable hard constraints separately from preferences and give all
   scored reason/unknown concepts stable neutral IDs.
3. Select 3–5 plausible OSS candidates for the fixed set. Candidate IDs are
   stable and stored in lexical order, never recommendation or popularity
   order.
4. Use primary sources at a single explicit evidence cutoff. Record concise
   paraphrases, timestamps, version/freshness scope, immutable commit/tag/
   release locators where available, and limitations; never copy source
   bodies.
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

Declared comparison pairs use explicit non-gold `comparisonPairId` metadata.
Each pair contains exactly two cases and holds capability family, decision
objective, user request, success conditions, and normalized candidate projects
constant. Repository profile, deployment, available infrastructure, ORM,
constraints, and preferences are the permitted conditioning variables. Corpus
validation rejects a pair unless conditions differ and the proposed
recommended candidate sets differ.

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
  collection timestamps, publication/release timestamps, version scope,
  directness, and limitations are retained.
- Each of the 40 current observations carries the full source commit SHA, a
  commit-pinned official GitHub blob/tree locator, and that commit's timestamp.
  Future package-registry evidence must use an exact package version, official
  release evidence must use an immutable tag/release, and mutable aliases such
  as `latest` are invalid. Mutable official documentation must record an
  available page/product version or explicitly disclose mutability in its
  limitation.
- License, runtime/framework compatibility, deployment, persistence,
  maintenance, security, database/ORM support, package status, and hosted
  service requirements are never supplied from memory.
- Each case has a single `2026-07-28` cutoff. Later evidence requires a new
  case/corpus version rather than silent mixing. Referential validation rejects
  collection or publication after the cutoff and publication after collection.
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
their rank groups and explicit relations.

```text
pairwise_agreement =
  matching gold/prediction relations / scorable gold relations
```

A missing or contradictory prediction relation scores as disagreement. When
gold has zero scorable relations, agreement is `1` only when prediction makes
no scorable claim, otherwise `0`. Predictions are not punished merely for
ordering a gold-incomparable pair. Validation rejects unknown or duplicate
rank-group candidates, incomplete gold classifications, directed cycles, and
every tied-plus-ordered, ordered-plus-incomparable, or
tied-plus-incomparable pair. Ties form equivalence classes, so an explicit
order involving one tied member propagates to all members before validation and
scoring. Gold may classify a viable candidate through an ordered group,
relation, or incomparable pair; predictions may intentionally make only the
ordering claims they can support.

### Abstention, unknowns, evidence, and reasons

Outcome correctness is exact membership in gold primary plus disposition-
compatible allowed outcomes. Validation applies the same semantics to gold,
predictions, and alternatives:

- `recommend` requires at least one `recommended` or `viable` disposition;
- `no-viable-candidate` requires every supplied candidate to be `rejected`;
  and
- `insufficient-evidence` forbids `recommended`/`viable`, requires at least one
  `insufficient-evidence`, and permits other candidates to be `rejected`.

Reports provide exact accuracy for all three outcomes separately; absent
classes use zero.

```text
unknown_recall  = disclosed required unknown IDs / required unknown IDs
evidence_recall =
  predicted required (candidateId, evidenceId) pairs
  / gold required (candidateId, evidenceId) pairs
reason_recall =
  predicted required (candidateId, reasonCode) pairs
  / gold required (candidateId, reasonCode) pairs
```

An empty required set yields `1` because there is no omitted obligation.
Unknown/unrelated IDs fail referential validation and never disappear from a
denominator. Gold dispositions and hard conflicts are the single source for
candidate evidence/reason obligations; the pre-review redundant global fields
were removed. Unknown disclosure remains case-global.

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
- publication age at review: Ajv 8.20.0 was 95 days old; every resolved
  transitive exceeded the repository's 24-hour minimum, with the newest,
  `fast-uri@3.1.4`, published nine days before review;
- supply-chain controls remain unchanged: exact direct pin, pnpm-generated
  lockfile, 24-hour minimum age, strict peers/engines, trust no-downgrade,
  default-denied builds, and no trust exception;
- selection rationale: Ajv validates the complete stable JSON Schema
  vocabulary, schemas against the meta-schema, strict unknown-key policy, and
  reference behavior. A custom partial validator would create an
  under-specified security boundary, duplicate a standard, and require far more
  negative tests.

`pnpm install --no-frozen-lockfile` resolved only four transitive packages and
updated the lockfile through pnpm:

| Package                      | Published  | License      | Consumer lifecycle | Integrity                                                                                         |
| ---------------------------- | ---------- | ------------ | ------------------ | ------------------------------------------------------------------------------------------------- |
| `fast-deep-equal@3.1.3`      | 2020-06-08 | MIT          | none               | `sha512-f3qQ9oQy9j2AhBe/H9VC91wLmKBCCU/gDOnKNAYG5hswO7BLKj09Hc5HYNz9cGI++xlpDCIgDaitVs03ATR84Q==` |
| `fast-uri@3.1.4`             | 2026-07-19 | BSD-3-Clause | none               | `sha512-8JnbkQ4juDyvYs4mgFGQqg4yCYtFDtUtmp2QIQq11ZZe5CFQ5wcqm1rqDgAh/QdMySuBnPzMUiJUNZG5N/AiQw==` |
| `json-schema-traverse@1.0.0` | 2020-12-13 | MIT          | none               | `sha512-NM8/P9n3XjXhIZn1lLhkFaACTOURQXjWhV4BA/RnOv8xvgqtqpAX9IO4mRQxSx1Rlo4tqzeqb0sOlruaOy3dug==` |
| `require-from-string@2.0.2`  | 2018-04-09 | MIT          | none               | `sha512-Xf0nWe6RseziFMu+Ap9biiUbmplq6S9/p+7w7YXP/JBHhrUDDUhwa+vANyubuqfZWTveU//DYVGsDG7RKL/vEw==` |

The published manifests contain only maintainer test/build/prepublish scripts
where present and no `preinstall`, `install`, or `postinstall` hooks. The graph
adds no peer dependencies and `require-from-string`'s declared Node floor is
compatible. `pnpm security:audit` and `pnpm verify:ci` report no known
vulnerabilities at the configured moderate threshold. This choice is
evaluation-tooling-only and does not select a future product API schema
library.

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

- at most 256 KiB per JSON file, 500 files per generic directory and 100 per
  corpus-owned directory, 10 pilot cases, 5 candidates per case, 256 IDs per
  case, 64 levels, 50,000 JSON nodes, 500 diagnostics, and 4 MiB serialized
  report;
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
- exact stable-ID pair recall is appropriate for candidate-conditioned
  evidence/reasons in this structural pilot; and
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

- exact case candidates and proposed dispositions: resolved by the ten-case
  primary-source review in Milestone 5;
- exact resolved Ajv transitives and advisory state: resolved above;
- measured coverage before correction: 87.83% statements, 80.04% branches,
  94.13% functions, and 87.83% lines; corrected coverage: 89.23% statements,
  82.22% branches, 95.98% functions, and 89.25% lines; and
- hosted CI run/job identifiers: resolved after publication.

## Implementation milestones

### Independent-review correction pass

PR #8 remains draft. The reviewed head `e27451a` passed hosted CI, but an
independent review found nine pre-merge correctness gaps that must be resolved
without changing the approved fixed-candidate boundary:

1. reauthor every pilot profile inside the approved Next.js/PostgreSQL
   ecosystem and enforce that scope at corpus validation;
2. replace loose `paired-*` tags with at least two controlled comparison pairs
   that hold the request, success conditions, candidate projects, family, and
   objective constant while repository conditions change the proposed winner;
3. enforce distinct disposition semantics for `recommend`,
   `no-viable-candidate`, and `insufficient-evidence`, including compatible
   alternative outcomes;
4. reject every tied/ordered/incomparable contradiction;
5. score reason and evidence obligations as candidate-associated stable-ID
   pairs and remove or exactly reconcile redundant gold truth;
6. represent both honest proposed gold and future independently accepted gold
   through conditional provenance rules while leaving this corpus proposed;
7. add bounded source revision/version provenance to every evidence
   observation and require source-type-appropriate metadata;
8. revisit all runtime-compatibility judgments, especially Next.js Edge claims,
   without treating broad Node/browser support as Edge proof; and
9. add exploit-oriented regression coverage for each identified failure mode.

The correction sequence is test-first: add targeted tests and record their
initial failures; update schemas, pure validation/scoring, corpus data and
hashes; refresh documentation and weak-fixture/coverage evidence; run the full
local matrix; publish only ordinary follow-up commits; update the existing
draft PR; then inspect the actual new hosted Verification job and decoded log.
Schema version `1.0.0` remains appropriate because the contract is unpublished
and unreleased; this pass corrects its pre-merge semantics rather than
migrating an accepted consumer.

### Milestone 1 — Contracts and dependency

- Add failing schema contract tests for every valid/invalid document shape.
- Add six draft 2020-12 schemas and the private harness package skeleton.
- Add `ajv@8.20.0` with pnpm only and complete the dependency review.
- Evidence: focused schema tests, frozen install, lock/lifecycle/integrity
  review.
- State: complete; frozen install and advisory audit pass.

### Milestone 2 — Bounded loading and integrity

- Begin with failures for oversized/deep/many JSON inputs, unsafe paths,
  symlink escape, duplicate IDs, unknown references, omission, contradiction,
  invalid ranks, cycles, cutoff mismatch, hash drift, and inert malicious
  strings.
- Implement the filesystem adapter and pure referential validation.
- Evidence: focused unit/integration tests and manifest validation.
- State: implemented.

### Milestone 3 — Pure scorer

- Begin with formula tests for safety, per-label/macro disposition metrics,
  zero denominators, partial-order pairs/ties/incomparability, abstention,
  unknown/evidence/reason recall, and aggregation.
- Implement deterministic single-case and corpus scoring plus stable
  serialization.
- Evidence: exact expected metric objects and repeatability tests.
- State: implemented.

### Milestone 4 — CLI and weak fixtures

- Add CLI behavior/exit/subdirectory tests.
- Add `first-candidate`, `all-viable`, `always-abstain`, `omit-unknowns`, and
  `perfect` prediction sets.
- Prove distinct, explainable report profiles and visible unsafe output.
- Evidence: `eval:score` and `eval:fixtures` integration tests.
- State: implemented.

### Milestone 5 — Ten-case pilot

- Research and author exactly two cases per family with 3–5 OSS candidates,
  separate evidence/proposed gold, required diversity, and a single cutoff.
- Generate the manifest hashes using the reviewed harness command.
- Evidence: automated composition validation and case-by-case manual review.
- State: implemented as proposed development data; independent review remains
  intentionally absent.

### Milestone 6 — Repository integration and documentation

- Update root scripts/verification, TypeScript/Vitest/dependency-cruiser,
  repository invariants/tests, README, AGENTS, CONTRIBUTING, testing strategy,
  authoring/scoring/baseline documentation, and this plan.
- Add architecture negatives for product-to-harness and production-to-gold.
- Evidence: repository/architecture/Markdown checks and complete crosswalk.
- State: complete; repository and architecture validations pass.

### Milestone 7 — Validation and publication

- Run every exact local command, record failures/corrections and coverage,
  review the complete diff and prohibited scope, commit intentionally, push
  normally, open the exact draft PR with `Closes #7`, inspect hosted CI, and
  correct failures only with ordinary follow-up commits.
- Evidence: commit SHAs, PR snapshot, final CI run/job/check, clean tracked
  worktree.
- State: branch and draft PR are published; reviewed head `e27451a` passed
  hosted run 14. Independent-review corrections and the complete local matrix
  pass; ordinary follow-up commits, existing-PR update, and final hosted CI
  inspection remain.

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
regenerates hashes; post-unblinding correction cannot be silent. The
independent-review pass changes the still-unreleased initial contract without
incrementing `1.0.0`; there is no accepted artifact or external consumer to
migrate. Accepted lifecycle states are representable, but moving this corpus
to them requires actual independent reviewer identity, time, and bounded review
reference.

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

Status `reauthored` means the authoring session re-evaluated the case inside the
approved Next.js/PostgreSQL ecosystem, inspected current primary sources,
bounded each observation to the 2026-07-28 cutoff, traced the proposed gold,
and ran automated corpus integrity checks. It does not mean the evidence or
gold was independently reviewed or accepted.

| Case ID                               | Family          | Candidates                                                     | Authoring review | Independent acceptance |
| ------------------------------------- | --------------- | -------------------------------------------------------------- | ---------------- | ---------------------- |
| `authorization-edge-drizzle`          | authorization   | Casbin, CASL, Cerbos, OpenFGA                                  | reauthored       | no                     |
| `authorization-relationship-prisma`   | authorization   | Casbin, CASL, Cerbos, OpenFGA                                  | reauthored       | no                     |
| `audit-logging-container-prisma`      | audit logging   | LogTape, pgAudit, Pino, Winston                                | reauthored       | no                     |
| `audit-logging-transactional-drizzle` | audit logging   | LogTape, pgAudit, Pino, Winston                                | reauthored       | no                     |
| `background-jobs-postgres-drizzle`    | background jobs | Bree, BullMQ, Graphile Worker, pg-boss                         | reauthored       | no                     |
| `background-jobs-redis-prisma`        | background jobs | Bree, BullMQ, Graphile Worker, pg-boss                         | reauthored       | no                     |
| `rate-limiting-container-drizzle`     | rate limiting   | Bottleneck, express-rate-limit, rate-limiter-flexible, Upstash | reauthored       | no                     |
| `rate-limiting-edge-prisma`           | rate limiting   | Bottleneck, express-rate-limit, rate-limiter-flexible, Upstash | reauthored       | no                     |
| `webhooks-mixed-ingress-prisma`       | webhooks        | Octokit Webhooks, Standard Webhooks, Stripe SDK, Svix          | reauthored       | no                     |
| `webhooks-self-hosted-egress-drizzle` | webhooks        | Convoy, Hook0, Standard Webhooks, Svix                         | reauthored       | no                     |

The corpus contains 40 candidate observations: 26 official-repository, 12
official-documentation, and two license observations. Source domains are
GitHub (28), LogTape (2), Pino (2), BullMQ (2), Graphile Worker (2), Upstash
(2), Casbin (1), and Standard Webhooks (1). Each case has exactly four
candidates in lexical ID order. All 40 observations also carry a full primary-
source commit SHA, matching commit-pinned blob/tree URL, and commit timestamp;
no mutable landing page is the sole reproducibility locator.

The final ecosystem distribution is 10 TypeScript/Next.js/PostgreSQL cases,
split five Prisma and five Drizzle. The two controlled comparison pairs are
`background-jobs-infrastructure` and `rate-limiting-topology`; each holds its
request, success conditions, decision objective, family, and four normalized
candidate projects constant while deployment/infrastructure/ORM/constraints
change the proposed winner.

| Pair                             | Invariant decision fields                                                                                                                                                                                                                                          | Conditioning change                                                                                  | Proposed recommended sets                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `background-jobs-infrastructure` | family `background-jobs`; objective `select-durable-job-queue-fit`; durable asynchronous work with scheduled retries request; identical multi-worker durability and retry/backoff success conditions; Bree, BullMQ, Graphile Worker, pg-boss                       | PostgreSQL/Drizzle/serverless producer/no Redis versus PostgreSQL/Prisma/long-running/existing Redis | Graphile Worker + pg-boss tie versus BullMQ    |
| `rate-limiting-topology`         | family `rate-limiting`; objective `select-rate-limiter-fit`; identical Next.js login/API throttling request; stable repository-derived keys plus quota/retry response success conditions; Bottleneck, express-rate-limit, rate-limiter-flexible, Upstash Ratelimit | one local replica/no external service versus global Edge isolates/existing HTTP Redis                | rate-limiter-flexible versus Upstash Ratelimit |

The independent-review correction changes four proposed, independently
unaccepted gold judgments from reviewed head `e27451a`:

1. `audit-logging-transactional-drizzle` removes the disposition-incompatible
   `no-viable-candidate` alternative.
2. `authorization-edge-drizzle` changes the outcome from `recommend` to
   `insufficient-evidence`; CASL and node-casbin both become
   `insufficient-evidence`, leave the ranking, lose the unsupported positive
   Edge-runtime reason, and require `edge-runtime-proof`.
3. `authorization-relationship-prisma` changes node-casbin from `viable` to
   `insufficient-evidence`, removes it from the ranking, and requires direct
   Node.js 24 compatibility proof. Pinned CASL evidence now explicitly records
   its documented Node.js 18+ support.
4. `background-jobs-postgres-drizzle` removes the transaction-only confound
   and changes pg-boss as sole recommendation plus Graphile Worker as viable to
   a tied recommendation for both PostgreSQL-backed queues. This makes the
   controlled pair turn on available queue infrastructure.

## Progress log

- 2026-07-28: Began the focused independent-review correction pass on clean,
  synchronized topic head `e27451a`; confirmed `main` remains `937f35b`, PR #8
  remains open/draft/unmerged, and hosted run 14 passed on the reviewed head.
- 2026-07-28: Re-read Issue #7, the product contract, accepted ADRs,
  engineering policy, the active plan, PR state, and current evaluation
  implementation. Recorded all nine review findings above before correction
  implementation.
- 2026-07-28: Added exploit-oriented regression tests first. The focused run
  failed 13 tests across outcome semantics, alternative outcomes, ranking
  contradictions, candidate-conditioned traceability, pilot ecosystem/pairs,
  and provenance/revision metadata, establishing the pre-correction defects.
- 2026-07-28: Corrected schema and pure referential contracts for responsible
  outcomes, all rank-pair contradictions, proposed/accepted provenance, and
  source-type-aware evidence revisions. Removed redundant global evidence and
  reason obligations from proposed gold.
- 2026-07-28: Changed evidence/reason scoring keys to stable
  `(candidateId, itemId)` pairs and retained case-global unknown disclosure.
  The focused evaluation suite now passes 140 tests, including wrong-candidate
  exploits and valid/invalid outcome combinations.
- 2026-07-28: Reauthored all ten profiles as synthetic
  TypeScript/Next.js/PostgreSQL repositories (five Prisma, five Drizzle);
  introduced the controlled `background-jobs-infrastructure` and
  `rate-limiting-topology` pairs; and machine-enforced exact scope, pair
  invariants, derived diversity, and corpus-wide lifecycle consistency.
- 2026-07-28: Re-reviewed every runtime judgment. In
  `authorization-edge-drizzle`, Casbin and CASL changed from viable/recommended
  to `insufficient-evidence`, positive Edge-compatibility reasons were removed,
  and `edge-runtime-proof` became a material unknown. Bottleneck and
  rate-limiter-flexible likewise retain no unsupported positive Edge claim;
  pinned Upstash evidence continues to support the proposed Edge recommendation.
- 2026-07-28: Applied the same runtime-proof standard to the non-Edge
  relationship case: node-casbin became `insufficient-evidence` because the
  bounded source does not prove Node.js 24, while CASL's pinned observation now
  records its documented Node.js 18+ support.
- 2026-07-28: Added full commit SHA, commit-pinned primary-source locator, and
  commit timestamp to all 40 observations, refreshed every manifest SHA-256
  hash, and passed the ten-case offline corpus validator.
- 2026-07-28: Hardened revision validation by source type, exact non-mutable
  revision locator, publication/collection cutoff, and chronology. Schema and
  referential matrices now exercise all seven source types.
- 2026-07-28: Removed the PostgreSQL-pair transaction confound, retained a
  responsible Graphile Worker/pg-boss tie, made the shared rate-limit request
  topology-neutral, and added matching repository facts. Pair comparison now
  canonicalizes unordered catalogs and JSON object keys, so reordering alone
  cannot masquerade as repository conditioning.
- 2026-07-28: Propagated ties as equivalence classes through explicit rank
  relations before contradiction checks and scoring. Direct, transitive, and
  tie-implied ordered/incomparable conflicts now fail.
- 2026-07-28: Completed the corrected local validation matrix under Node
  24.18.0/pnpm 11.17.0. Frozen install, format, lint, typecheck, build, 302
  tests, coverage, architecture, repository/corpus/fixture, secret, audit,
  `verify`, and `verify:ci` all pass.
- 2026-07-28: Committed the atomic schema, harness, tests, and reauthored
  corpus correction as ordinary follow-up commit `88ffa9b`; no published
  commit was amended or rewritten.
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
- 2026-07-28: Added six closed JSON Schema 2020-12 contracts at version
  `1.0.0`, the private `@gitblocks/evaluation-harness`, Ajv 8.20.0 and its
  pnpm-generated lock delta, bounded loaders, referential validation, pure
  scoring, stable serialization, CLI, and deterministic weak strategies.
- 2026-07-28: Authored and hash-pinned exactly ten proposed pilot cases, two
  per family with four lexical candidates each, from 40 bounded primary-source
  observations at one cutoff. Corpus validation and all five weak fixture
  reports pass.
- 2026-07-28: Integrated root commands, offline verification, TypeScript,
  Vitest, dependency-cruiser, repository invariants, and evaluation
  documentation. The final expanded graph passes 218 tests in 18 files;
  dependency-cruiser passes with 158 modules and 399 dependencies.
- 2026-07-28: Completed the exact local validation matrix. Frozen installation,
  formatting, lint, typecheck, build, coverage, repository/evaluation/security
  checks, `verify`, and `verify:ci` all pass; the audit reports no known
  vulnerabilities.
- 2026-07-28: Committed the plan as `a58faf6` and the implementation as
  `67d38bb`, pushed the exact branch without rewriting history, and opened
  draft PR #8 with the exact title and `Closes #7`.
- 2026-07-28: Inspected hosted CI run 13 and its full Verification job log for
  implementation head `67d38bb`. Every workflow step passed, including the
  final clean-worktree proof.

## Decision and deviation log

- 2026-07-28 — Use JSON Schema 2020-12. It is a current stable draft, directly
  meets the issue, and supports strict closed shapes. Draft-07 was rejected
  because using the requested current contract now avoids a later representational
  migration; multi-draft support is unnecessary.
- 2026-07-28 — Select Ajv 8.20.0 for the private harness after resolving and
  reviewing its four-package transitive graph. A custom validator was rejected
  as partial and riskier. This is not a future product schema-library decision.
- 2026-07-28 — Use exact ID recall and pairwise partial-order agreement without
  a convenience aggregate. This keeps the pilot deterministic, reviewable, and
  unable to hide unsafe output.
- 2026-07-28 — The shell-path runtime failure is an environment activation
  issue, not a repository contradiction. The existing supported runtime was
  activated; no preflight or supply-chain rule was bypassed.
- 2026-07-28 — Generate weak prediction sets deterministically from the
  validated corpus rather than committing redundant fixture JSON. This keeps
  the strategies inspectable, avoids hash drift in duplicate data, and still
  exercises the same prediction validator/scorer paths in tests and
  `eval:fixtures`.
- 2026-07-28 — Retain evaluation schema version `1.0.0` during review
  correction. The contract is not merged, released, accepted, or consumed
  outside this draft PR, so correcting the initial shape is more truthful than
  implying a migration.
- 2026-07-28 — Remove `requiredEvidenceIds` and `requiredReasonCodes` from gold.
  Candidate dispositions and hard conflicts already provide the authoritative
  association, and deriving scored pairs prevents drift between two sources of
  truth.
- 2026-07-28 — Treat broad Node/browser support as insufficient proof of
  Next.js Edge compatibility. The affected proposed dispositions abstain and
  disclose a runtime-proof unknown rather than infer compatibility.

## Failed checks and corrections

| Date       | Command/check                                                   | Failure                                                                                                                                                                           | Correction/evidence                                                                                                    |
| ---------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 2026-07-28 | `nvm use`; `node --version`; `pnpm --version`; preflight/verify | Login shell did not expose nvm/Node; fallback pnpm 11.9.0 failed the exact engine policy                                                                                          | Sourced the existing `/Users/karthikgudipati/.nvm/nvm.sh`; rerun selected Node 24.18.0/pnpm 11.17.0 and passed         |
| 2026-07-28 | initial focused schema tests                                    | Harness schema module did not exist, then Ajv strict mode rejected an under-specified test schema                                                                                 | Added the fixed schema registry and completed the test schema shape; valid/invalid contract tests passed               |
| 2026-07-28 | first `pnpm install` after manifest edit                        | Frozen lockfile correctly rejected the new Ajv manifest dependency                                                                                                                | Ran `pnpm install --no-frozen-lockfile` once through pnpm, reviewed the five-package delta, and retained frozen mode   |
| 2026-07-28 | focused scoring test                                            | Expected `2 / 3` did not match the documented six-place report rounding                                                                                                           | Corrected the assertion to the stable serialized value `0.666667`; scorer behavior was unchanged                       |
| 2026-07-28 | first integrated `pnpm test`                                    | Four existing temporary-repository tests lacked newly required evaluation paths/scripts                                                                                           | Extended the shared temp-repository fixture and added positive/negative invariant coverage; 213 tests passed           |
| 2026-07-28 | first two `pnpm lint` runs                                      | Harness test-project config, array-style policy, imports, and matcher safety produced 17 then 8 errors                                                                            | Added the harness test tsconfig and corrected the reported source/test issues; lint passes with zero warnings          |
| 2026-07-28 | corpus formatting/hash refresh                                  | macOS `shasum` failed with a `C.UTF-8` locale panic after formatting                                                                                                              | Used system `openssl dgst -sha256` for the manifest refresh; `eval:validate` confirms every hash                       |
| 2026-07-28 | `pnpm format:write`                                             | The repository's write script is named `pnpm format`, so the guessed alias did not exist                                                                                          | Ran `pnpm exec prettier --write .`; the exact final `pnpm format:check` passes                                         |
| 2026-07-28 | connected GitHub combined-status query                          | The GitHub App lacks permission for the legacy combined-status endpoint and returned HTTP 403                                                                                     | Used workflow-run, job, and decoded-log endpoints; run 13 and its Verification job completed successfully              |
| 2026-07-28 | focused correction regression run                               | 13 tests failed against the reviewed implementation: six responsible-outcome/ranking, three candidate-conditioned coverage, two ecosystem/pair, and two provenance/revision cases | Implemented the reviewed contracts and reauthored the corpus; focused evaluation tests pass                            |
| 2026-07-28 | first corrected schema run                                      | Ajv strict mode rejected a nested evidence conditional without an explicit object type                                                                                            | Added the missing nested `type: object`; schema compilation and tests pass                                             |
| 2026-07-28 | first revision-integrity rerun                                  | A test fixture used stale revision kind `commit` instead of the contract value `git-commit`                                                                                       | Corrected the fixture to the exact stable enum; focused tests and corpus validation pass                               |
| 2026-07-28 | correction harness typecheck                                    | Derived diversity returned ordinary booleans while the internal manifest type still declared literal `true`, producing 16 type errors                                             | Widened the internal derived diversity fields to boolean while the committed manifest schema continues to require true |
| 2026-07-28 | focused formatting gate                                         | The non-login shell again lacked Node, so Prettier could not start                                                                                                                | Activated the already-installed pinned nvm runtime; no tool was installed and the rerun passed                         |
| 2026-07-28 | focused corpus/CLI tests after final case edits                 | Eight tests failed because the manifest correctly detected changed case/evidence/gold bytes                                                                                       | Recomputed the affected SHA-256 values with `openssl`; all 30 hashes and corpus tests pass                             |
| 2026-07-28 | correction lint gate                                            | New pair/source-type tests and transitional type assertions produced 17 lint errors                                                                                               | Simplified pair checks, used typed mutable schema fixtures, and removed unnecessary assertions; lint passes cleanly    |

## Validation evidence

| Date       | Evidence                                                           | Result                                                                                             |
| ---------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 2026-07-28 | `git status --short --branch` before branching                     | clean `main...origin/main`                                                                         |
| 2026-07-28 | fetch/switch/fast-forward pull, log, rev-parse, branches           | local/remote synchronized at expected `937f35b`                                                    |
| 2026-07-28 | connected GitHub Issue #7 and PR #6/Issue #5 reads                 | Issue #7 open and complete; PR #6 merged; Issue #5 closed                                          |
| 2026-07-28 | `rg --files`                                                       | no evaluation schema/corpus/harness/baseline present                                               |
| 2026-07-28 | supported `nvm use`; versions; `pnpm runtime:check`; `pnpm verify` | Node 24.18.0, pnpm 11.17.0; 161 tests pass; architecture/repository/secrets pass                   |
| 2026-07-28 | `git switch -c test/7-evaluation-pilot`; `git rev-parse HEAD`      | required local branch created at `937f35b`                                                         |
| 2026-07-28 | `pnpm test`; `pnpm test:coverage`                                  | 218 tests pass across 18 files; 87.83% statements/lines, 80.04% branches, 94.13% functions         |
| 2026-07-28 | `pnpm lint`; `pnpm build`; `pnpm architecture:check`               | pass; architecture reports 158 modules/399 dependencies and no violations                          |
| 2026-07-28 | `pnpm eval:validate`; `pnpm eval:fixtures`                         | ten cases/hashes/composition pass; weak reports are deterministic and distinct                     |
| 2026-07-28 | runtime, frozen install, format, typecheck, repository, Secretlint | all pass under Node 24.18.0 and pnpm 11.17.0                                                       |
| 2026-07-28 | `pnpm security:audit`; `pnpm verify`; `pnpm verify:ci`             | pass; registry reports no known vulnerabilities at the moderate threshold                          |
| 2026-07-28 | focused correction tests                                           | 140 evaluation harness tests pass                                                                  |
| 2026-07-28 | corrected `pnpm eval:validate`; `pnpm eval:fixtures`               | ten Next.js/PostgreSQL cases and all hashes pass; corrected fixture profiles are distinct          |
| 2026-07-28 | corrected `pnpm test`; `pnpm test:coverage`                        | 302 tests pass across 18 files; 89.23% statements, 82.22% branches, 95.98% functions, 89.25% lines |
| 2026-07-28 | corrected architecture/repository/security gates                   | 158 modules/401 dependencies; no architecture violations; repository, Secretlint, and audit pass   |
| 2026-07-28 | corrected `pnpm verify`; `pnpm verify:ci`                          | both authoritative graphs pass; the audit reports no known vulnerabilities                         |

### Weak fixture evidence before independent-review corrections

| Strategy          | Safe | Unsafe | Macro F1 | Outcome | Ranking  | Unknown | Evidence | Reason |
| ----------------- | ---- | ------ | -------- | ------- | -------- | ------- | -------- | ------ |
| `first-candidate` | no   | 4      | 0.138298 | 0.8     | 0.210526 | 0       | 0        | 0      |
| `all-viable`      | no   | 17     | 0.1      | 0.8     | 0.157895 | 0       | 0        | 0      |
| `always-abstain`  | yes  | 0      | 0.055556 | 0.1     | 0.210526 | 1       | 0        | 0      |
| `omit-unknowns`   | yes  | 0      | 1        | 1       | 1        | 0       | 1        | 1      |
| `perfect`         | yes  | 0      | 1        | 1       | 1        | 1       | 1        | 1      |

These are weak deterministic harness profiles, not generic-agent or GitBlocks
performance baselines.

### Weak fixture evidence after independent-review corrections

| Strategy          | Safe | Unsafe | Macro F1 | Outcome | Ranking | Unknown | Evidence | Reason |
| ----------------- | ---- | ------ | -------- | ------- | ------- | ------- | -------- | ------ |
| `first-candidate` | no   | 4      | 0.138298 | 0.7     | 0.3125  | 0       | 0        | 0      |
| `all-viable`      | no   | 17     | 0.074468 | 0.7     | 0.1875  | 0       | 0        | 0      |
| `always-abstain`  | yes  | 0      | 0.083333 | 0.2     | 0.3125  | 1       | 0        | 0      |
| `omit-unknowns`   | yes  | 0      | 1        | 1       | 1       | 0       | 1        | 1      |
| `perfect`         | yes  | 0      | 1        | 1       | 1       | 1       | 1        | 1      |

The changed profiles are expected consequences of the corrected outcome,
disposition, controlled-pair ranking, and candidate-conditioned traceability
contracts. They remain weak deterministic harness fixtures, not a live
baseline.

### Hosted CI evidence

- Draft PR:
  [#8 — test: establish OSS adoption evaluation pilot](https://github.com/kgudipati/gitblocks/pull/8);
  exact title, branch, base `main`, `Closes #7`, and draft state confirmed.
- Implementation head: `67d38bb50b871a4f49b12e00a6f164b91acc6e81`.
- [CI run 13](https://github.com/kgudipati/gitblocks/actions/runs/30401321192),
  workflow run ID `30401321192`, completed `success`.
- [Verification job](https://github.com/kgudipati/gitblocks/actions/runs/30401321192/job/90416565315),
  job ID `90416565315`, completed `success`.
- Full decoded log inspected: Ubuntu 24.04, Node 24.18.0, pnpm 11.17.0;
  lockfile and all 325 entries passed supply-chain policy; PR branch/title
  passed; 218 tests passed; dependency-cruiser reported 158 modules and 399
  dependencies with no violations; repository checks, ten-case evaluation
  validation, all weak fixtures, Secretlint, and the audit passed; final
  `git diff --exit-code` proved CI left no tracked changes.
- No hosted failure or correction commit was required. This plan update is
  evidence-only; its final head will be monitored before completion. The PR
  remains draft.
