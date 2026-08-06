# Phase 8 artifact-first deterministic retrieval foundation

## Status and authority

- Governing issue:
  [#19 — Phase 8: Establish artifact-first taxonomy, query normalization, and
  retrieval evaluation](https://github.com/kgudipati/gitblocks/issues/19)
- Branch: feat/19-artifact-first-retrieval-foundation
- Owner: repository maintainer
- State: Milestones 1–6 are accepted. Milestone 4 product implementation was
  accepted at `66a4165c1239e7a46d72ccd6469d0856e815c410`; its retained CI-policy
  corrections are `2983194504253ca76697a93abd744e3300522785` and
  `2ddedf73f38fb25f625b5fd0793605d807f1ee93`. The maintainer accepted the
  milestone under the hosted-infrastructure exception documented below.
  Milestone 5 was accepted through correction commit
  `4f4c1e4522f7db85d2a0a422b5c78ac8665a4840`. Its independent corpus/scorer
  architecture is accepted, while relevance and hard-filter audit provenance
  remains proposed/not-reviewed. That acceptance establishes deterministic
  development authority, not independently accepted retrieval truth.
  Milestone 6 deterministic baselines and the content-free report were
  accepted at `ea27f11432513ec352ce43821eb95b8da0886182`. The maintainer
  explicitly split Milestone 7 into offline implementation-only Milestone 7A
  and separately authorized live/evidence Milestone 7B. Milestone 7A
  implementation is complete pending maintainer review; Milestone 7B and every
  live effect remain unauthorized.
- Last updated: 2026-08-06

Issue #19 is the requirements authority. ADR 0008 owns the durable architecture
decisions after acceptance. This plan owns execution order, likely file
placement, milestone review gates, stop conditions, and validation evidence.
The product contract, accepted ADRs, and repository engineering standards
remain authoritative for existing contract and package semantics.

The binding Phase 7 closure is:

> Interview engine retained; live calibration failed; repository interviews
> deferred; Phase 8 proceeds artifact-first.

Milestone 1 was accepted at commit
8679461bb7b4eb356ffec7c5e36f0e7ef5ea9eb8 after hosted CI run 30860512727
completed successfully. ADR 0008 is accepted. Milestone 2, including its
exact-alias correction, was accepted at commit
5af650662ddbee0ddba8fb3788fb0d199a04b934 after hosted CI run 30868267854 and
Verification job 91864676407 completed successfully. Milestone 3 may implement
only the local pre-contract query and normalization boundary; exact profile DTO
shapes remain a Milestone 4 decision.

Milestone 3, including its result-invariant review correction, was accepted at
commit a81aea020fde501c70bfffa85dad60113e4e71d1 after hosted CI run
30875378437 and Verification job 91885676773 completed successfully. ADR 0008
remains accepted. Milestone 4 is accepted under the documented hosted
infrastructure exception. Milestone 5 is accepted through
`4f4c1e4522f7db85d2a0a422b5c78ac8665a4840`. Milestone 6 is accepted at
`ea27f11432513ec352ce43821eb95b8da0886182`. Milestone 7A may implement only
the offline controlled operator and fake-effect proof; Milestone 7B remains
unauthorized.

## Purpose and user-visible outcome

Phase 8 establishes the deterministic foundations required to evaluate future
candidate retrieval before a production retrieval or ranking service exists.
The completed phase will provide:

- controlled capability taxonomy and aliases;
- local pre-contract query admission, normalization, and clarification;
- candidate-owned deterministic profile authority;
- honest deterministic profile coverage measurements;
- an independent retrieval/query evaluation authority;
- deterministic offline baselines and a content-free report; and
- only after separate authorization, a controlled deterministic
  150-candidate profile-materialization proof.

Phase 8 does not implement production retrieval, production ranking,
recommendation, vector search, embeddings, reranking, an API, MCP, scanner,
deployment, or another model path. It must work without any successful
repository interview.

## Project-phase reconciliation

The original end-to-end strategy separates:

1. deterministic repository profiling;
2. capability taxonomy and query understanding;
3. production retrieval;
4. production ranking.

Project Phase 8 combines only:

1. deterministic candidate-profile contracts, extraction rules, coverage, and
   later controlled materialization;
2. controlled taxonomy;
3. deterministic query admission, normalization, and clarification; and
4. retrieval evaluation contracts, corpus, metrics, and non-production
   baselines.

The original strategy's production retrieval and production ranking remain
later project phases. Future plans must not describe a Phase 8 baseline as a
production retrieval implementation.

## Verified current repository state

Milestone 1 began from:

- repository `kgudipati/gitblocks`;
- main at a0373b07d9b9ee9766bea61f221cedd418fbb162;
- local main, origin/main, and the remote main ref at that exact SHA;
- a clean tracked and ordinary-untracked worktree;
- Node v24.18.0 and pnpm 11.17.0;
- merged PR #18 with merge SHA
  a0373b07d9b9ee9766bea61f221cedd418fbb162;
- Issue #17 closed as not_planned;
- no previously open Phase 8 issue;
- no OPENAI_* credential variable; and
- the preserved Phase 7 container present and stopped.

The gate used local Git, git ls-remote, GitHub issue/PR reads, runtime commands,
environment-variable names, and Docker container-list metadata. The Phase 7
container was not started, inspected, attached to, copied from, or queried.

The current repository provides:

- 12 TypeBox-derived product contract roots;
- the five capability-family identifiers authorization, audit-logging,
  background-jobs, rate-limiting, and webhooks;
- 150 catalog candidates, exactly 30 per family;
- 80 catalog npm mappings and 70 repository-only candidates;
- 44 explicit negative controls;
- immutable artifact, artifact-set, and exact-line chunk contracts;
- content-free completion evidence for 180 first-run artifacts and 407 chunks;
- deterministic evidence observations, limitations, unknowns, and dossier
  reconstruction;
- repository-interview machinery whose live calibration did not publish an
  interview; and
- fixed-candidate ranking and repository-interview evaluation authorities that
  are not retrieval gold.

No current product contract is a deterministic candidate profile or
pre-contract capability query. No production discovery, retrieval, ranking, or
fit-execution service exists.

## Scope

### In scope

- additive controlled taxonomy authority and validation;
- CapabilityQueryInputV1 and CapabilityQueryNormalizationResultV1;
- deterministic admission, alias resolution, clarification, and contradiction
  rules;
- DeterministicCandidateProfileV1 and deterministic extraction projections;
- immutable generated candidate-profile authority from approved inputs;
- deterministic-profile-coverage/1.0.0 measurement;
- a new independent retrieval-v1 evaluation authority;
- deterministic scorers and offline baselines;
- content-free baseline completion evidence; and
- a separately authorized final deterministic materialization proof.

### Milestone 1 scope

Milestone 1 may create or update only:

- Issue #19 and draft PR metadata;
- this plan;
- ADR 0008;
- README current-status text;
- product-contract phase-boundary text;
- system-context phase-boundary text;
- the existing testing strategy; and
- docs/engineering/security-baseline.md.

It adds no TypeScript, JSON Schema, taxonomy JSON, candidate profile, profile
manifest, evaluation file, generated report, migration, dependency, package,
or root command.

## Explicit non-goals

- Production candidate generation or retrieval.
- Production hard-filter execution.
- Production ranking, reranking, recommendation, or fit assessment execution.
- Vector search, embeddings, pgvector, full-text-search infrastructure, or
  score tables.
- API, MCP, Agent Skill, web UI, target scanner, queue, scheduler, daemon,
  service deployment, or production database.
- Reopening Phase 7, changing its interview specification, another
  calibration, or making an interview a dependency.
- Any model call in Phase 8.
- Any ordinary provider call, candidate contact, or network-backed corpus
  operation.
- Access to Phase 7 database, container, receipts, or repository-external
  evidence.
- Parsing CandidateDossierV1 observation statements into facts.
- Reusing RepositoryFingerprintV1 as candidate authority.
- Reinterpreting pilot-v1 ranking gold, repository-interviews-v1, or Phase 7
  calibration candidates as retrieval gold.
- Migration 0005.
- A new product package without newly reviewed evidence that existing
  ownership is incoherent.

## Requirements crosswalk

| Requirement                        | Destination                                    | Milestone | Evidence                                         |
| ---------------------------------- | ---------------------------------------------- | --------: | ------------------------------------------------ |
| Phase-number reconciliation        | Issue, plan, ADR, README                       |         1 | Documentation review                             |
| Coverage denominator and reporting | Plan, ADR, future coverage authority           |      1, 4 | Version/digest and coverage tests                |
| Controlled taxonomy                | Domain/contracts and product authority         |         2 | Taxonomy validation and abuse tests              |
| Local pre-contract query sequence  | Domain/contracts                               |         3 | Contract, normalization, and clarification tests |
| Deterministic candidate profile    | Domain/contracts/ingestion                     |         4 | Extraction and authority drift tests             |
| Independent 50-case corpus         | Evaluation harness and evals/retrieval-v1      |         5 | Corpus validation and reviewer audit             |
| Deterministic metrics              | Evaluation harness                             |         5 | Hand-calculated scorer fixtures                  |
| Offline baselines                  | Evaluation harness                             |         6 | Reproducible content-free report                 |
| Final 150-candidate proof          | Existing ingestion boundary and fresh database |         7 | Separate authorization, receipts, coverage       |
| No production retrieval/ranking    | Issue, plan, ADR, architecture checks          |       All | Diff and dependency review                       |
| No model or Phase 7 dependency     | Plan, security policy, tests                   |       All | Offline checks and effect audit                  |

## Accepted architecture decisions

### Coverage denominator

The 27-field investigation inventory is retained as:

deterministic-profile-coverage/1.0.0

It is an audit and planning denominator. It is not automatically the serialized
field list of DeterministicCandidateProfileV1 and is not the permanent initial
ranker denominator.

The 27 audit fields are:

1. catalog role/status;
2. capability family;
3. repository identity;
4. repository/adoption unit type;
5. controlled capability variants/features;
6. repository discovery metadata;
7. language/ecosystem;
8. package identity/mapping;
9. package publication/version;
10. runtime/package format;
11. framework compatibility;
12. datastore requirements;
13. required infrastructure;
14. optional infrastructure;
15. deployment/self-hosting;
16. license identity;
17. archived state;
18. fork/upstream state;
19. maintenance activity;
20. release state/recency;
21. security advisory state;
22. security-policy presence;
23. documentation presence;
24. test/CI presence;
25. artifact/chunk availability;
26. package-repository linkage; and
27. operational-complexity primitives.

Every report separates:

- field representability;
- implemented deterministic extraction rules;
- fields populated with known values;
- candidate-population coverage per field;
- family-level population coverage;
- hard-filter readiness;
- broad-retrieval readiness; and
- later ranking-only coverage.

Unknown representation does not count as deterministic extraction or
known-value coverage. The 70–80% deterministic value remains a later
launch/readiness gate against the fields actually consumed by the initial
ranker.

### Candidate-profile authority

DeterministicCandidateProfileV1 is the provisional additive product-contract
name. It is candidate-owned structured deterministic authority.

It does not replace, reinterpret, or widen CandidateDossierV1,
RepositoryFingerprintV1, RepositoryInterviewV1, or FitAssessmentRequestV1.
CandidateDossierV1 remains evidence observations, limitations, and unknowns.
RepositoryFingerprintV1 remains minimized target-codebase authority.
Repository interviews remain optional unselected synthesis and cannot populate
deterministic profile authority.

Each future profile value retains:

- controlled field or taxonomy concept identity;
- value state;
- candidate ownership;
- candidate-wide or version-specific scope;
- extraction rule and version;
- source, evidence, or artifact references;
- freshness or immutable snapshot identity;
- deterministic digest behavior; and
- deterministic conflict and absence behavior.

The minimum states are known, unknown, not-applicable, and conflict. Known
values cannot be created by parsing CandidateDossierV1 observation text.

The exact DTO field organization, bounds, digest projection, and taxonomy
concept IDs remain Milestones 2–4 implementation decisions.

### Query-contract sequence

The future local sequence is:

```text
CapabilityQueryInputV1
  -> CapabilityQueryNormalizationResultV1
  -> user review and transmission approval
  -> CapabilityRequestV1
```

CapabilityQueryInputV1 is a bounded local pre-contract input, not a second
adoption-request domain model. It may retain bounded original terminology,
explicit draft requirements/preferences/prohibitions, exact brand or candidate
references, and an optional minimized RepositoryFingerprintV1 reference. It
retains no secret, source body, configuration value, environment value,
command output, or transcript.

CapabilityRequestV1 remains post-normalization approved authority. Its existing
meaning and transmission approval remain unchanged.

Normalization preserves required, preferred, prohibited, unknown, and
clarification-needed. Every normalized constraint retains its source identity
and rule identity. No alias expansion or inference may weaken a hard
constraint.

### Candidate constraint evaluation

Candidate constraint evaluation is tri-state:

- satisfied;
- conflict;
- unresolved.

Unresolved is neither satisfied nor conflict. An unresolved candidate does not
pass as viable and cannot be recommended. A later retrieval result may retain
it only in a separately typed evidence-needed lane with the unresolved
constraint disclosed.

### Taxonomy authority

V1 canonical IDs and canonical lookup aliases are ASCII-only. Unicode is
bounded presentation data only. Hard constraints do not use fuzzy matching,
transliteration, NFKC semantic merging, or confusable folding.

Mixed-script and confusable lookup input becomes unknown or
clarification-needed. Alias collision, accidental ambiguity, term-class
overlap, graph cycles, missing
parents, deprecated alias reuse, excessive depth, and nondeterministic
traversal fail validation.

Catalog negative controls are excluded from normal candidate generation and
ordinary baselines by default. Their use must be explicitly marked as a
negative-control, hard-filter safety, false-positive, or catalog-integrity
case.

Security-policy presence is a ranking/explanation facet by default. It becomes
a hard filter only when an explicit normalized user constraint requires a
published policy. Failure to detect a policy does not prove absence of a
security process.

Lightweight is neither a taxonomy concept nor an opaque score. It requires
clarification or confirmed decomposition into explicit controlled preferences,
such as no external service, no extra datastore, no Kubernetes, no always-on
worker, no separate control plane, bounded service count, or an in-process
library preference. No component is inferred without user statement or
confirmation.

### Evaluation authority

Create exactly 50 Phase 8 cases:

- 30 retrieval cases, exactly 6 per family; and
- 20 normalization, clarification, and adversarial cases, exactly 4 per
  family.

Retrieval cases own blind inputs, hard constraints, 0–3 relevance judgments,
positive and valid no-result cases, duplicate/fork/equivalence metadata, and
reviewer provenance.

Normalization/adversarial cases own exact terms and aliases, ambiguities,
conflicting modalities, unsupported categories, unclear self-hosting,
subjective terms, brand comparisons, Unicode/confusable input, and
clarification expectations.

Normalization gold, clarification gold, hard-filter expectations, relevance
judgments, equivalence groups, and no-result expectations remain physically
and semantically separate. Ranking judgments are prohibited.

Do not hand-author a 50 by 150 eligibility matrix. Expected hard-filter
membership is generated from the normalized query, exact candidate-profile
authority, and versioned constraint-evaluation rules. Selected generated
entries currently retain bounded proposed/not-reviewed audit samples;
independent review remains future work.

Metrics are deterministic:

- Recall@10;
- MRR;
- NDCG@10;
- exact duplicate-result rate;
- equivalence-group duplicate rate;
- category coverage;
- hard-filter correctness;
- top-10 hard-filter violation count;
- no-eligible-candidate accuracy;
- clarification accuracy;
- alias-expansion correctness; and
- prohibited-constraint preservation.

Zero denominators retain numerator/denominator, have null value and
`not-applicable` status, and are excluded from macro means. They never become
0, 1, NaN, or Infinity.

Milestone 6 generates and drift-checks:

verification/retrieval-v1/baseline-report.json

It contains only authority versions/digests, baseline versions, metrics, case
counts/denominators, runtime/tool versions, and a report digest. It contains no
artifact body, target source, unrestricted rationale, reviewer note, provider
response, model output, or credential.

### Persistence and materialization

No migration 0005 is authorized. Existing evidence, dossier, artifact, and
interview tables retain their meanings. SQL profile persistence and indexes
are deferred until production retrieval proves its access requirements.

A committed generated profile authority is allowed, but known values must come
from approved deterministic inputs. Runtime, framework, datastore,
infrastructure, deployment, license, lifecycle, and security facts cannot be
hand-authored to improve coverage. Curator authority is labeled and cannot
masquerade as provider authority.

Ordinary Phase 8 work is offline. No model call is authorized anywhere in
Phase 8. No Phase 7 database, container, receipt, or repository-external
evidence is an input.

Milestone 7A is offline implementation only. Milestone 7B is separately
authorized; only if later authorized may its single atomic command contact the
existing exact GitHub/npm host boundaries, create a fresh dedicated ephemeral
PostgreSQL database, retain structured source values, generate/reproduce all
150 profiles, and emit content-free receipts and coverage. It never uses Phase
7 state or a model and stays outside ordinary verification and hosted CI.

If Milestone 7B remains unauthorized or blocked, the phase may claim completion
of its offline foundation only, not deterministic population or production
retrieval readiness.

## Architecture and dependency direction

Preserve:

```text
@gitblocks/domain
  <- @gitblocks/contracts
  <- @gitblocks/persistence
  <- @gitblocks/ingestion
```

Evaluation tooling is an outward consumer of product packages. No product
package imports evals, evaluation schemas, the evaluation harness, gold, or
baseline fixtures.

No new production package is planned. Domain owns pure vocabulary and
invariants; contracts own closed DTO schemas and parsers; ingestion owns
approved deterministic source projection and later operator composition;
persistence remains unchanged; the evaluation harness owns corpus, gold,
scorers, baselines, and report validation.

Future production retrieval owns its own application read port and does not
import the concrete persistence adapter. Future ranking consumes retrieval
results without changing the Phase 8 evaluation authority.

## Security, privacy, abuse, and supply chain

Assets include query intent, target-fingerprint references, controlled
taxonomy, candidate profile facts, source references, evaluation gold, and
baseline reports.

Trust controls:

- taxonomy and aliases are product authority, never learned from repository
  text;
- repository artifacts and catalog prose remain inert data;
- external, persisted, repository-derived, and generated inputs are validated;
- candidate facts identify curator, provider, evidence, or artifact authority;
- conflicts are explicit rather than last-write-wins;
- hard constraints never use fuzzy or confusable lookup;
- queries, terms, constraints, objects, traversal, and output are bounded;
- prototype-pollution keys, accessors, exotic prototypes, cycles, sparse
  arrays, controls, and bidi controls fail closed;
- no arbitrary query URL becomes identity authority;
- target facts remain minimized and local until review/approval;
- errors, telemetry, receipts, and reports are value-free or content-free;
- evaluation gold never crosses into product packages;
- ordinary tests and CI have no provider/model/Phase 7 dependency; and
- no new dependency is planned.

The existing docs/engineering/security-baseline.md is the security authority.
No parallel security document is created.

## Observability and operations

Milestones 1–6 add no shared or production operation. Their diagnostics are
deterministic CLI outcomes and content-free validation reports.

Future reusable code must use stable operation/error names and bounded,
redacted telemetry when it becomes an operational path. The Milestone 7 proof,
if authorized, records content-free counts, authority versions/digests,
outcomes, durations, provider-request summaries, and coverage. It records no
artifact body, query text, candidate fact value, credential, provider body,
database content, or unrestricted local path.

No SLO, dashboard, alert, queue, retry service, or deployment is created in
Phase 8.

## Migration, compatibility, rollout, and recovery

- Existing contract roots remain semantically unchanged.
- Additive Phase 8 contract roots require normal version negotiation,
  TypeBox-derived types, safe parsers, and deterministic schema export.
- CandidateDossierV1, RepositoryFingerprintV1, RepositoryInterviewV1, and
  FitAssessmentRequestV1 retain their meanings.
- Migrations 0001–0004 remain unchanged; migration 0005 is prohibited.
- Existing pilot-v1 and repository-interviews-v1 authorities remain separate.
- Phase 8 is offline and not user-exposed; rollback removes the additive
  offline authority before publication or uses a later additive contract
  version after publication.
- Taxonomy versions, profile snapshots, corpus manifests, and baseline reports
  are immutable once used as authority. Corrections receive a new version or
  digest rather than history edits.
- A failed Milestone 7 database is discarded. No repair SQL or Phase 7 state is
  reused.

## Implementation milestones

### Milestone 1 — Phase authority and documentation

**Goal**

Create Issue #19, this plan, proposed ADR 0008, minimal phase-boundary
documentation, one documentation commit, a pushed topic branch, and an early
draft PR.

**Exact likely files**

- docs/plans/0019-artifact-first-retrieval-foundation.md
- docs/architecture/decisions/0008-artifact-first-retrieval-foundation.md
- README.md
- docs/product/product-contract.md
- docs/architecture/system-context.md
- docs/engineering/testing-strategy.md
- docs/engineering/security-baseline.md

**Red-first tests**

Documentation review must initially reject any draft that omits a binding
decision, conflates Project Phase 8 with production retrieval/ranking, changes
existing contract meanings, authorizes migration 0005, or makes Milestone 7
ordinary work. No behavior test is appropriate for a documentation-only slice.

**Compatibility**

No schema, package, persistence, command, or runtime change.

**Security**

No credential, provider, model, Phase 7 state, candidate content, or database
access. Use the existing security-baseline path.

**Validation**

```text
pnpm runtime:check
pnpm format:check
pnpm repo:check
pnpm build
pnpm architecture:check
pnpm contracts:validate
pnpm verify
pnpm verify:ci
git diff --check
```

Database verification, when run by verify:ci, must use only its disposable
pinned PostgreSQL path and never the Phase 7 container.

**Commit**

docs: define Phase 8 retrieval foundation

**Review gate**

Completed. ADR 0008 remained proposed through the documentation commit;
maintainer review accepted Milestone 1 and ADR 0008 before authorizing
Milestone 2.

**Stop conditions**

Stop for any starting-state mismatch, wrong issue number, unrelated worktree
change, documentation scope expansion, validation failure, non-draft PR, or
missing hosted CI result.

### Milestone 2 — Controlled taxonomy authority and validation

**Goal**

Implement the versioned controlled taxonomy, exact alias authority, bounded
graph semantics, deterministic digest, and security validation. Resolve exact
concept IDs during review.

**Exact likely files**

- packages/domain/src/capability-taxonomy.ts
- packages/domain/src/index.ts
- packages/domain/test/capability-taxonomy.test.ts
- packages/contracts/src/capability-taxonomy-schemas.ts
- packages/contracts/src/capability-taxonomy-contracts.ts
- packages/contracts/src/structural-validation.ts
- packages/contracts/src/schema-catalog.ts
- packages/contracts/src/index.ts
- packages/contracts/test/capability-taxonomy-contracts.test.ts
- packages/contracts/test/taxonomy-command.test.ts
- packages/contracts/scripts/taxonomy-command.ts
- packages/contracts/scripts/taxonomy-cli.ts
- packages/contracts/scripts/tsconfig.json
- catalog/capability-taxonomy/1.0.0/source.json
- catalog/capability-taxonomy/1.0.0/manifest.json
- catalog/capability-taxonomy/1.0.0/README.md
- package.json

**Red-first tests**

Duplicate IDs, alias collision, valid intentional ambiguity, accidental
ambiguity, non-ASCII canonical lookup,
mixed-script/confusable lookup, missing parent, cycle, excessive depth,
deprecated alias reuse, traversal-order variation, unknown concepts, and
digest drift.

**Compatibility**

Existing five family IDs and existing contract roots retain meaning and
digests. Taxonomy authority is additive.

**Security**

No artifact-derived aliases, fuzzy matching, transliteration, NFKC semantic
merging, network, or model.

**Validation**

```text
pnpm taxonomy:validate
pnpm contracts:validate
pnpm catalog:validate
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm architecture:check
pnpm repo:check
pnpm security:secrets
pnpm verify
pnpm verify:ci
git diff --check
git status --short --branch
```

**Commit**

feat(taxonomy): define capability taxonomy authority

**Review gate**

Maintainer accepts exact IDs, aliases, version/digest rules, and security
closure before Milestone 3.

**Stop conditions**

Any locale/order-dependent resolution, unresolved alias collision, need for a
new package, or implicit repository-text vocabulary expansion.

### Milestone 3 — Query input and deterministic normalization

**Goal**

Add CapabilityQueryInputV1, CapabilityQueryNormalizationResultV1, local
admission, exact alias resolution, clarification, modality preservation, and
stable identity/digests.

**Exact likely files**

- packages/domain/src/capability-query.ts
- packages/domain/src/capability-query-normalization.ts
- packages/domain/src/index.ts
- packages/domain/test/capability-query-normalization.test.ts
- packages/contracts/src/capability-query-schemas.ts
- packages/contracts/src/parsers.ts
- packages/contracts/src/structural-validation.ts
- packages/contracts/src/schema-catalog.ts
- packages/contracts/src/index.ts
- packages/contracts/test/capability-query-contracts.test.ts

**Red-first tests**

Missing/ambiguous capability, required/prohibited conflict, source-ID loss,
modality weakening, unsupported ecosystem, unclear self-hosting, subjective
lightweight, cross-family brand comparison, Unicode/confusable input, excess
input, and ordering/digest instability.

**Compatibility**

CapabilityRequestV1 remains post-normalization authority and is not made
optional or reinterpreted. RepositoryFingerprintV1 remains target authority.

**Security**

Local-only bounded input, no source body/secrets/configuration/transcript, no
model, no arbitrary URLs, and safe value-free errors.

**Validation**

```text
pnpm contracts:validate
pnpm test -- packages/domain/test/capability-query-normalization.test.ts packages/contracts/test/capability-query-contracts.test.ts
pnpm build
pnpm architecture:check
pnpm verify
```

**Commit**

feat(query): normalize capability queries deterministically

**Review gate**

Maintainer accepts the query/request sequence, exact modality/source closure,
clarification behavior, and safe bounds before Milestone 4.

**Stop conditions**

Any hard-constraint weakening, fuzzy/model requirement, target-data widening,
or second adoption-request model.

### Milestone 4 — Deterministic candidate profiles and coverage

**Goal**

Add DeterministicCandidateProfileV1, value states, extraction projections,
generated committed authority, deterministic constraint evaluation, and the
versioned coverage report.

**Exact likely files**

- packages/domain/src/deterministic-candidate-profile.ts
- packages/domain/src/candidate-constraint-evaluation.ts
- packages/domain/src/index.ts
- packages/domain/test/deterministic-candidate-profile.test.ts
- packages/contracts/src/deterministic-candidate-profile-schemas.ts
- packages/contracts/src/parsers.ts
- packages/contracts/src/structural-validation.ts
- packages/contracts/src/schema-catalog.ts
- packages/contracts/src/index.ts
- packages/contracts/test/deterministic-candidate-profile-contracts.test.ts
- packages/ingestion/src/candidate-profile-projection.ts
- packages/ingestion/src/candidate-profile-authority.ts
- packages/ingestion/scripts/candidate-profile-cli.ts
- packages/ingestion/test/candidate-profile-projection.test.ts
- catalog/public-v1/candidate-profile-authority.json
- verification/retrieval-v1/profile-coverage.json
- package.json

The implemented fixed artifacts are
`catalog/public-v1/candidate-profile-authority.json` and
`verification/retrieval-v1/profile-coverage.json`. The only product roots are
DeterministicCandidateProfileV1 and
DeterministicCandidateProfileAuthorityV1; coverage remains an ingestion-owned
content-free report rather than a product request/response root.

**Red-first tests**

Missing field state, candidate mismatch, observation-prose reparse, unknown
counted as extracted, unknown treated as satisfied, invalid not-applicable,
conflicting source values, source/candidate cross-reference, stale snapshot,
digest collision, curator/provider authority confusion, hand-authored known
facts, incomplete catalog closure, and family-coverage miscalculation.

The implemented suites additionally bind the exact 27-field registry/order and
scope partition, closed field-specific values, all four field states, bounded
source variants, conflict claim typing, version scope, hostile object forms,
canonicalization before identity, profile/authority digests, 150-candidate
closure, byte-identical generation, fixed-path/symlink/size defenses, exact
per-field/per-family arithmetic, catalog-only extraction, prose non-authority,
schema-digest compatibility, and conservative single-candidate constraint
evaluation.

**Compatibility**

CandidateDossierV1, RepositoryFingerprintV1, RepositoryInterviewV1, and
FitAssessmentRequestV1 remain unchanged. Persistence remains unchanged.

The accepted taxonomy version/digest and both query root schema digests remain
unchanged. CandidateDossierV1, RepositoryFingerprintV1, existing
`profileCandidate` behavior, persistence, migrations, packages, dependencies,
and evaluation files are unchanged.

**Security**

Known facts only from approved deterministic input; no provider/model/Phase 7
state; conflict and unknown fail closed; no candidate text execution.

**Validation**

```text
pnpm profiles:validate
pnpm catalog:validate
pnpm artifacts:validate
pnpm ingestion:verify
pnpm contracts:validate
pnpm build
pnpm architecture:check
pnpm verify
```

**Commit**

feat(profiles): establish deterministic candidate profiles

**Review gate**

Maintainer accepts exact DTO shape, source projections, authority path,
coverage calculation, and tri-state candidate evaluation before Milestone 5.

**Stop conditions**

A known value needs prose parsing, manual fact authoring, provider access,
Phase 7 state, migration 0005, or a new package.

### Milestone 5 — Retrieval/query corpus and scorers

**Goal**

Create the independent 50-case retrieval-v1 authority and deterministic metric
scorers with separate gold categories and human-audit provenance.

**Exact likely files**

- evals/retrieval-v1/README.md
- evals/retrieval-v1/manifest.json
- evals/retrieval-v1/queries/**
- evals/retrieval-v1/gold/normalization/**
- evals/retrieval-v1/gold/clarification/**
- evals/retrieval-v1/gold/hard-filters/**
- evals/retrieval-v1/gold/relevance/**
- evals/retrieval-v1/equivalence.json
- schemas/evaluation/retrieval/*.schema.json
- tools/evaluation-harness/src/retrieval/**
- tools/evaluation-harness/test/retrieval-*.test.ts
- package.json

**Red-first tests**

Wrong 30/20 split, wrong per-family counts, manifest drift, gold leakage,
ranking judgment, invalid relevance grade, invalid no-result case, missing
review provenance, hand-authored full matrix, equivalence collision, incorrect
zero-positive-denominator handling, and hand-calculated metric edge cases.

**Compatibility**

pilot-v1 and repository-interviews-v1 remain separate and unchanged. Product
packages import no evaluation authority.

**Security**

Corpus files are bounded inert JSON, blind inputs stay separate, reviewer notes
and artifact bodies are excluded, paths are safe, and validation is offline.

**Validation**

```text
pnpm eval:retrieval:validate
pnpm eval:retrieval:fixtures
pnpm eval:validate
pnpm eval:fixtures
pnpm eval:interviews:verify
pnpm contracts:validate
pnpm build
pnpm architecture:check
pnpm verify
```

**Commit**

test(retrieval): add retrieval evaluation authority

**Review gate**

Independent review accepts case balance, gold separation, relevance judgment,
generated filter expectations, audit samples, and metric math.

Accepted through correction commit
`4f4c1e4522f7db85d2a0a422b5c78ac8665a4840`. The independent corpus/scorer
architecture is accepted. Relevance and hard-filter audit provenance remains
proposed/not-reviewed, so the accepted result is deterministic development
authority rather than independently accepted retrieval truth.

**Stop conditions**

Gold contamination, product dependency on evaluation, zero-denominator gaming,
ranking judgments, unreviewed generated membership, or external data need.

### Milestone 6 — Offline baselines and completion report

**Goal**

Implement deterministic family-only, exact-keyword, alias-expanded,
always-abstain, constraint-violating negative, and fixture-oracle baselines;
generate the drift-checked content-free report.

**Exact likely files**

- tools/evaluation-harness/src/retrieval/baselines/**
- tools/evaluation-harness/src/retrieval/baseline-report.ts
- tools/evaluation-harness/src/retrieval/baseline-runner.ts
- tools/evaluation-harness/test/retrieval-baselines.test.ts
- tools/evaluation-harness/test/retrieval-baseline-report.test.ts
- verification/retrieval-v1/baseline-report.json
- package.json

**Red-first tests**

Unstable tie order, duplicate emission, negative-control leakage, hidden
network/model access, always-abstain metric gaming, undetected hard violation,
oracle imperfection, content leakage, and report-digest drift.

**Compatibility**

Baselines remain evaluation-only and are never exposed as production retrieval
or imported into product packages.

**Security**

Prediction generation completes through the blind loader, accepted normalizer,
safe structured candidate projection, strategy execution, closed prediction
validation, and immutable digest before the full gold-bearing corpus is loaded
for scoring. Strategy views exclude case/source identities, assigned corpus
family, prose, audit metadata, and gold. No raw artifact, target, reviewer,
provider, or model content enters the report; no network, database, provider,
model, or Phase 7 input exists.

**Validation**

```text
pnpm eval:retrieval:baselines
pnpm eval:retrieval:baselines:generate
pnpm eval:retrieval:verify
pnpm eval:validate
pnpm eval:fixtures
pnpm eval:interviews:verify
pnpm contracts:validate
pnpm build
pnpm architecture:check
pnpm verify
```

**Commit**

test(retrieval): establish deterministic baselines

**Review gate**

Maintainer accepts exact reproducible scores, content-free report, effect
audit, and offline foundation completion before considering Milestone 7.

**Stop conditions**

Nondeterminism, hidden external state, favorable rerun, report content leakage,
or production-service scope.

### Milestone 7A — Offline controlled materialization operator

**Goal**

Implement and fake-effect test the reviewed operator without Docker, a
database, credentials, provider requests, source-authority output, or live
completion evidence. This milestone is one implementation commit:

```text
feat(profiles): add controlled materialization operator
```

The operational authority is
`profile-materialization-provider-policy/1.0.0`. It permits nine controlled
GET operations over only `api.github.com` and `registry.npmjs.org`, manual
same-host redirects with a maximum of two, existing bounded transport and
retry/cancellation behavior, and a mechanically derived 913-request maximum
for the committed 150-candidate catalog. GitHub tag and allowlisted-file
operations remain persistence-audit-only; repository-file bodies never enter
profile authority, source authority, receipt, coverage, or completion output.
The policy semantic digest is
`0945ebd862d0a1b5f622c4f10f60b2c0e713fb127cc5dea5668be5cc40c96ede`.

The separate `collectProfileMaterializationSources` endpoint retains granular
outcomes, normalized structured values, primary language, exact fork parent,
source identity, immutable reference, and mutability. The existing
`collectCandidateSources`, public bundle/result types, profile projection,
batch ingestion, and public receipts remain unchanged.

`profile-materialization-source-authority/1.0.0` is ingestion-owned,
operational, untracked, closed to exactly 150 candidates and the mechanically
expected logical sources, and independent of the run ID. Future local
authorities live only below
`verification/retrieval-v1/.profile-materialization-runs/<run-id>/` with 0700
directory and 0600 file modes, canonical bounded exclusive no-follow writes,
and no symlink/path alias. They remain immutable and must be retained until
Milestone 7B is independently reviewed, Milestone 7 is accepted, and the
maintainer explicitly authorizes deletion.

The second collection reconciles against the validated first authority by
logical source identity. Content equality excludes only collection time,
evidence identifiers, and the record digest. When provider content is equal,
identical evidence lists reuse the complete first record byte-for-byte, an
empty-to-nonempty transition retains the complete current record as recovery
evidence enrichment, a nonempty-to-empty transition reuses the durable first
record only when the complete current candidate record set contains an
`unavailable` outcome, and different nonempty lists fail closed. Qualification
derives only from those current unavailable outcomes; evidence enrichment is
not provider drift. Repository/head/release/tag/community/npm-latest/
advisory selectors are mutable singletons. License and allowlisted-file
records are immutable exact-commit identities, so ordinary head advancement
withdraws the old snapshot identities and adds new ones while conflicting
established facts for the same commit fail closed. `unavailable` is a
controlled collection limitation, not an established immutable fact, so a
value or established absence may transition to/from unavailability as changed
drift while both authorities retain their exact outcomes. Fatal authority
records remain prohibited.

`profile-materialization-persistence-proof/1.0.0` closes each collection to
150 canonical candidate dispositions and binds the database schema, migration
inventory, catalog, and reconciled source authority. A complete legacy bundle
is profiled and persisted through the existing runtime-role-only
`loadPriorMaterial`, `profileCandidate`, and `persistCandidateProfile`
semantics. Controlled observation topics attach only generated/reused evidence
identifiers; observation prose is never parsed. Optional-source qualified
candidates remain `qualified-not-persisted` with no invented evidence or
snapshot; unchanged reconciled records may retain exact previously persisted
evidence IDs. Release evidence uses the same non-draft, bounded-tag,
non-moving-marker selection helper as `profileCandidate`. Allowlisted-file
evidence requires the exact controlled path topic, candidate, git-commit SHA,
safe exact GitHub repository source URL, and an immutable URL with that same
owner/repository plus the exact commit and canonical encoded path. The new
materialization collector projects only that repository source identity into
the legacy profile input while the legacy public collector remains unchanged.
Both private proof files follow the
source-authority retention and 0600 fixed-write policy.

Pure materialization consumes only the accepted catalog, taxonomy, and one
validated source authority. It preserves the four accepted catalog fields and
may change only repository discovery, package publication/version, runtime
package format, license, archived, fork/upstream, release recency, advisory,
security-policy, and package/repository-linkage fields. Every known/conflict
field has an exact repository-snapshot or package-version scope and only
`structured-collection` references. The other 13 non-catalog fields preserve
their accepted unknown/not-applicable semantics. No coverage target applies.

`profile-materialization-coverage/1.0.0` compares the accepted offline and
future live authorities without candidate content.
`profile-materialization-receipt/1.0.0` binds both source collections, both
persistence-proof digests and content-free aggregate persistence counts, all
four A/B materialization passes, provider drift, database/migration proof,
field and family counts, failures, and final coverage. Live idempotency derives
from reconciled source behavior and the second durable persistence results; a
seeded-only database cannot pass. Its semantic digest excludes only the
semantic/record digest fields and run-ID digest; its record digest excludes
only itself and therefore authenticates run isolation.

Expose exactly:

```text
pnpm profiles:materialization:preflight -- <all reviewed named arguments>
pnpm profiles:materialization:execute -- <all reviewed named arguments>
pnpm profiles:materialization:verify
```

Preflight is read-only, emits no compilation output, and never reads
credentials. The command uses an explicit internal source-resolution condition
without changing ordinary compiled package exports. Execute remains present but
unauthorized in 7A; it owns one try/finally sequence from zero-effect
validation through lazy credential reads, fresh database creation, zero-state
proof, four migrations/25-table proof, runtime role/catalog seed, two source
collections, two durable persistence proofs, four materialization passes,
quarantined evidence, exact cleanup, post-disposal proof, and only then
fixed-file publication. The runtime login owns all catalog seed, prior-material
loads, and profile persistence and every runtime client closes before cleanup.
Verify is read-only
and expects future 7B evidence, so it is not invoked by ordinary verification
while those files do not exist.

The database plan pins
`postgres:18.4-bookworm@sha256:1961f96e6029a02c3812d7cb329a3b03a3ac2bb067058dec17b0f5596aca9296`,
requires `m7-[a-z2-7]{26}`, derives isolated container/network/database and
owner/runtime-role identities, uses an internal network and tmpfs with only an
explicit `127.0.0.1:<port>` binding, and rejects preexisting exact identities.
It proves 0/0 initial migrations/product tables and then 4/25, zero RLS
policies, seven schema functions, 48 noninternal triggers, 15 required indexes,
and exact migration checksums. No volume or migration 0005 exists.
Cleanup inspects and removes only the exact container, proves it absent, then
inspects and removes only the exact network and proves it absent. Every
unexpected inspection or nonzero removal is fatal; container-removal failure
prevents network removal.

Only the five `GITBLOCKS_PROFILE_MATERIALIZATION_*` credential names frozen by
the reviewed contract are accepted. Values are lazy, never argv/default/.env
inputs, and never enter logs, errors, persistence, evidence, or digests.
Required repository/head/mapped-package identity, auth, safety, malformed,
overflow, immutable-conflict, catalog, database, cancellation, and deadline
failures abort. Optional temporary failures may qualify completion only when
all profiles close, affected values remain controlled unknown, A/B and
idempotency checks pass, and failure counts are explicit.

Ordinary tests cover pure schemas/projection, strict parsing, legacy
compatibility, authority/digest closure and reconciliation, persistence proof
and evidence-topic binding, receipt authentication, fake database plans,
ordered cleanup, orchestration cleanup/publication denial, and repository
scope. The live
execute command is prohibited from `verify`, `verify:core`, `verify:ci`, and
hosted workflows. No preflight/execute/evidence verification command runs in
ordinary verification.

**Review gate**

Accept the implementation commit and independently review its exact policy,
schema digests, fake-effect proof, and zero-live-effect audit before authorizing
Milestone 7B.

### Milestone 7B — Separately authorized live proof and evidence

Milestone 7B remains unauthorized. If later authorized, one acknowledged
`profiles:materialization:execute` invocation may collect two immutable local
source authorities, prove same-evidence reproduction and live idempotency,
dispose the fresh database resources, and publish only:

```text
verification/retrieval-v1/profile-materialization-receipt.json
verification/retrieval-v1/profile-materialization-coverage.json
catalog/public-v1/profile-materialization-completion.md
```

Those files may be committed only after exact read-only verification, content
audit, disposal proof, and maintainer review, in a separate commit:

```text
docs(profiles): record deterministic materialization evidence
```

No successful materialization, improved coverage, retrieval readiness, or
production-quality claim exists before that commit. A failed run publishes no
fixed evidence, uses no repair SQL, and leaves its isolated database to exact
bounded disposal. If 7B does not run, Phase 8 stops with an
offline-foundation-only claim.

## Testing and validation strategy

Each behavior milestone begins with failing or absent-boundary tests and lands
its tests in the same ordinary commit. Test categories include:

- closed contract shape and version negotiation;
- domain invariants and stable canonicalization;
- taxonomy graph and alias security;
- query ambiguity, contradiction, and modality preservation;
- candidate-profile source, scope, state, freshness, conflict, and digest;
- generated coverage calculation and no favorable aggregation;
- hostile objects, Unicode/confusables, controls, size/count/depth limits, and
  safe value-free errors;
- corpus hash/reference/gold separation;
- deterministic hand-calculated metrics;
- baseline repeatability and negative-safety proofs;
- architecture import denial; and
- explicit external-effect denial.

Ordinary validation is offline. No provider or model is substituted with a
hidden live fallback. PostgreSQL verification uses disposable pinned test
containers and minimum runtime roles. Milestone 7 live evidence cannot become
an ordinary test fixture or hosted-CI dependency.

## Exact Phase 8 exit criteria

Phase 8 completes only when:

- taxonomy and aliases are exact, versioned, deterministic, and
  security-validated;
- pre-contract queries normalize or fail closed with exact clarification
  reasons;
- CapabilityRequestV1, RepositoryFingerprintV1, CandidateDossierV1,
  RepositoryInterviewV1, and FitAssessmentRequestV1 retain their meanings;
- deterministic profiles preserve versioned extraction provenance and
  explicit unknown/conflict behavior;
- observation prose is never reparsed into candidate facts;
- hard constraints preserve source identity and modality;
- unresolved candidate constraints never masquerade as satisfied;
- retrieval evaluation remains separate from ranking and interview evaluation;
- every metric and zero-denominator behavior is deterministic;
- baselines and reports reproduce;
- product packages import no evaluation authority;
- ordinary validation uses no provider, model, or Phase 7 database;
- no production retrieval, ranking, vector, embedding, reranking, API, MCP,
  scanner, or deployment implementation exists;
- no migration or new package lands without newly reviewed evidence;
- all coverage dimensions are reported separately and honestly; and
- no 70–80% readiness claim exists without known-value deterministic coverage
  against the actual initial-ranker consumer denominator.

If Milestone 7B remains unauthorized or blocked, the completion statement must
say the offline foundation is complete and deterministic population/readiness
is not established.

## Open implementation decisions

Reserved for immediate Milestone 7B/live review:

- whether the exact local credential injection and selected loopback port are
  operationally ready for one acknowledged run;
- whether optional provider failures, if any, permit qualified evidence or
  require discarding the run;
- whether the independently reviewed first/second source-authority drift is
  acceptable before fixed evidence publication;
- the post-run independent source-retention and eventual deletion decision;
- whether the three fixed committed evidence files enter ordinary read-only
  verification only after the 7B evidence commit; and
- whether live evidence is accepted without implying coverage, retrieval,
  ranking, candidate-quality, or production-readiness thresholds.

Production retrieval/ranking contracts, application ports, profile SQL
persistence, and broader structured source authorities remain later-phase
decisions. These decisions may not weaken Issue #19 or ADR 0008.

## Progress log

### 2026-08-03 — Starting gate and issue

- Verified synchronized main at the required merge SHA.
- Verified clean worktree, Node/pnpm pins, PR #18, Issue #17, no open Phase 8
  issue, absent OPENAI_* variables, and stopped Phase 7 container metadata.
- Created Issue #19 with the exact required title.
- Created branch feat/19-artifact-first-retrieval-foundation from the required
  SHA.
- Began documentation-only Milestone 1.
- No product implementation, provider/model call, Phase 7 state access, or
  Milestone 2 work occurred.

### 2026-08-03 — Milestone 1 acceptance and Milestone 2 start

- Maintainer accepted Milestone 1 at commit
  8679461bb7b4eb356ffec7c5e36f0e7ef5ea9eb8 with successful hosted CI run 30860512727.
- Transitioned ADR 0008 to accepted.
- Reverified the exact branch/head/base, clean worktree, runtime pins, open
  Issue #19, draft PR #20, successful CI, empty review-thread set, absent
  OPENAI_* variables, and stopped Phase 7 container metadata before editing.
- Inspected every catalog rationale and artifact selection as inert curator
  classification input. No provider, candidate, model, database, or Phase 7
  evidence access occurred.
- Began Milestone 2 taxonomy authority and validation only. Milestone 3 did not
  begin.

### 2026-08-03 — Milestone 2 implementation complete

- Added taxonomy `1.0.0` as reviewed source plus generated product authority.
  After exact-alias review correction it contains 85 concepts, 132 active
  resolved aliases, 11 intentional ambiguities, 26 exclusions, no live
  deprecated aliases, and actual maximum hierarchy depth 2.
- Added pure domain invariants and exact canonical-key lookup, additive TypeBox
  source/authority roots, deterministic generation/digest behavior, bounded
  fixed-path CLI validation, and the protected root command.
- Preserved the 12 prior schema roots in their prior order and with their exact
  schema digests. The two taxonomy roots append additively.
- Added no package, dependency, migration, persistence behavior, ingestion
  behavior, candidate assignment, query parser, query normalizer, profile,
  evaluation authority, scorer, baseline, provider call, model call, or Phase 7
  access.
- Milestone 2 is awaiting maintainer review. Milestone 3 has not begun.

### 2026-08-03 — Milestone 2 exact-alias review correction

- Replaced the over-specific `job-queue`, `worker-queue`, and `hosted-service`
  resolutions with explicit intentional ambiguities and expanded `task-queue`
  to retain library, database-backed, and broker-backed adoption units.
- Bound `cron-scheduler` to recurring behavior rather than in-process
  deployment, replaced generic `log-router` resolution with exact
  `audit-log-router`, and classified generic `log-router` as adjacent.
- Recorded `authorisation` and `web-hook` as active spelling variants, retained
  synthetic deprecated-alias validation, and removed all live deprecated
  aliases without inventing replacements.
- Removed the authentication precondition from the authorization-family
  definition without otherwise changing the family.
- Regenerated taxonomy `1.0.0` through the existing reviewed command. The
  corrected semantic digest is
  `838fa85b2e6937866854b6f733fe7045cf49d5f811cb5e4a8d503bfbd76a61c9`.
- Milestone 2 remains awaiting maintainer acceptance. Milestone 3 has not
  begun.

### 2026-08-03 — Milestone 2 acceptance and Milestone 3 start

- Maintainer accepted Milestone 2 and its exact-alias correction at commit
  5af650662ddbee0ddba8fb3788fb0d199a04b934 with successful hosted CI run
  30868267854 and Verification job 91864676407.
- Reverified the exact branch, head, base, clean worktree, runtime pins, open
  Issue #19, draft mergeable PR #20, accepted taxonomy version/digest, empty
  review-thread set, absent OPENAI_* variables, and stopped Phase 7 container
  metadata before editing.
- Began Milestone 3 local query contracts and pure normalization only.
  Milestone 4 candidate profiles did not begin.

### 2026-08-03 — Milestone 3 implementation complete

- Added the closed local-pre-approval CapabilityQueryInputV1 and
  CapabilityQueryNormalizationResultV1 roots, safe parsers, complete input and
  result digests, deterministic result identity, and exact exchange
  validation.
- Added pure explicit-term canonicalization, taxonomy lookup, family outcome,
  modality/source preservation, ambiguity/exclusion/unknown/contradiction
  handling, and injected exact candidate-reference authority bounded to 200
  candidates.
- Preserved only repository-fingerprint ID/digest context. No fingerprint fact
  is read or converted into a constraint.
- Appended schema roots with input digest
  `d48e018b71f8e6947f60f4d3559c48047daba8a335168b51f37bfb5199c81b9b`
  and normalization-result digest
  `b864d88ddbe3ae7ba2ea09919c4152089445f9facb2eb08eeb3a17e30aaca721`.
  Every preexisting schema digest, including both taxonomy roots, remains
  exact.
- Added no CapabilityRequestV1 construction, candidate filtering, profile,
  persistence, ingestion, evaluation corpus, scorer, baseline, retrieval,
  ranking, package, dependency, migration, provider/model operation, or Phase
  7 access. Milestone 4 has not begun.

### 2026-08-03 — Milestone 3 result-invariant review correction

- Made blocking unresolved records authoritative for outcome selection and
  required source-matched clarification coverage for every non-unsupported
  blocking record. Mixed supported and adjacent, generic-utility, or
  incidental-capability terms now require clarification; wholly excluded
  primary requests remain unsupported.
- Derived the unresolved-result maximum as 8 capability terms + 32 constraints
  - 10 candidate references = 50. CapabilityQueryInputV1 retained schema digest
    `d48e018b71f8e6947f60f4d3559c48047daba8a335168b51f37bfb5199c81b9b`;
    CapabilityQueryNormalizationResultV1 changed to reviewed schema digest
    `bdd7db9510937c0728f87b0d83f75dbd374555fa17c2b1e4a56399d9f9f2d06b`.
- Removed the internal candidate-reference `candidateKey`; candidate-ID lookup
  now indexes `candidateId` exactly while repository and npm keys remain
  separate exact kinds.
- Added pure standalone-result semantic validation between structural parsing
  and digest/normalization-ID verification. Full exchange recomputation remains
  the separate ownership proof against input, taxonomy, and candidate authority.
- Taxonomy source, manifest, version, and semantic digest remain byte-identical.
  Milestone 3 remains awaiting maintainer acceptance and Milestone 4 has not
  begun.

### 2026-08-03 — Milestone 3 acceptance and Milestone 4 start

- Maintainer accepted Milestone 3 and its result-invariant review correction at
  commit a81aea020fde501c70bfffa85dad60113e4e71d1 with successful hosted CI run
  30875378437 and Verification job 91885676773.
- Reverified the exact branch, head, base, clean worktree, runtime pins, open
  Issue #19, open draft mergeable PR #20 based on `main`, accepted taxonomy and
  query schema digests, zero unresolved review threads, and absent OpenAI
  credential variables before editing. The Phase 7 container and database were
  not inspected or queried.
- Began Milestone 4 deterministic profiles and conservative single-candidate
  constraint evaluation only. ADR 0008 remains accepted. Milestone 5
  retrieval/query evaluation has not begun.

### 2026-08-03 — Milestone 4 implementation

- Added the immutable pure 27-field domain registry, closed field-specific
  values and `known | unknown | not-applicable | conflict` records, bounded
  catalog/structured/artifact/derived sources, canonicalization, semantic
  profile invariants, and conservative single-candidate constraint evaluation.
- Added only DeterministicCandidateProfileV1 and
  DeterministicCandidateProfileAuthorityV1 as additive product roots, with safe
  unknown-input parsers, domain mapping, deterministic JSON Schema export,
  semantic digests, and 48-hex profile identities. Coverage is not a product
  contract. The profile and authority schema digests are
  `3bbfdf2050c13a3d70e9dc289db7c8768a6fdcba8605cf12191e08560387af61`
  and `7a79a1671bf461127099e3ae2f75d29e949387987041bd3402f2614b747ed8cf`.
- Added the fixed-path offline projection, explicit generation command, and
  read-only ordinary validator. The generated authority contains exactly 150
  profiles at semantic digest
  `fc85d7ea71c69cd5e56e5a73936ceba6263c4ea0ba8fc2d0802556d79cf9e879`;
  the content-free coverage report digest is
  `b313d7f7afc3f9324042fff965f9e63c4e0a347be2f7363808cb6107e913fb17`.
- The first red run failed four focused surfaces because the registry, parsers,
  and projection did not exist. A later permutation test exposed digesting
  before canonical field ordering; the constructor now canonicalizes first and
  then derives the digest and profile ID. No provider, model, database,
  candidate repository, artifact body, external corpus, or Phase 7 operation
  occurred. Milestone 5 has not begun.
- Final semantic review reproduced two correctly re-digested cross-field
  forgeries: repository identity could name a different candidate, and mapped
  package identity could retain package-dependent not-applicable states. The
  profile validator now binds repository identity to its profile owner, binds
  package applicability to known mapped/unmapped identity, and requires a
  known publication package name to match the mapped package.

## Decision and deviation log

### 2026-08-03 — Seven milestones

The issue-prescribed seven-milestone sequence replaces the investigation's
earlier six-milestone suggestion. Query normalization precedes candidate
profiles, and final deterministic population is a distinct separately
authorized milestone.

### 2026-08-03 — Security documentation path

Phase 8 updates docs/engineering/security-baseline.md. The previously
investigated hypothetical security-and-privacy path is rejected because it
would duplicate existing authority.

### 2026-08-03 — No migration

Phase 8 records deterministic profile authority in additive contracts and
committed generated files. SQL persistence is deferred until production
retrieval supplies evidence for read/index requirements.

### 2026-08-03 — Local query identity and exact normalization

CapabilityQueryInputV1 and CapabilityQueryNormalizationResultV1 are additive
`1.0.0` local-pre-approval roots. Explicit lookup terms use normalizer `1.0.0`:
ASCII-space trimming/collapse, ASCII uppercase-to-lowercase conversion, and
space/hyphen collapse into the existing stable-ID grammar. Punctuation,
Unicode-to-ASCII conversion, locale rules, fuzzy matching, stemming, summary
mining, and implicit target-fingerprint inference are absent.

The complete canonical input has one digest. The result semantic digest binds
that input digest, taxonomy version/digest, normalizer version, optional exact
candidate-catalog version/digest, and every canonical result field. The stable
normalization ID is `normalization-` plus the first 48 semantic-digest hex
characters; no second record digest is added because there is no distinct
record-only projection. An exchange validator deterministically recomputes the
whole result and fails closed on any source, modality, outcome, authority,
ordering, or digest drift.

Candidate reference authority is an injected bounded domain value, not a new
contract root or committed catalog. It permits only exact candidate ID,
canonical owner/repository, and npm package keys for at most 200 candidates.
Repository fingerprint references preserve only the exact ID and digest and
cannot establish a family or constraint.

### 2026-08-03 — Standalone normalization-result closure

CapabilityQueryNormalizationResultV1 semantic validation is pure domain logic
invoked after closed structural parsing and before digest/normalization-ID
checks. It closes generated IDs, deterministic ordering, source/modalities,
constraint shapes, clarification coverage, candidate binding, and outcome
coherence. Correctly re-digesting an impossible result does not make it valid.

The 50-record unresolved ceiling is derived from every independently
unresolved input source rather than chosen separately. Candidate-ID references
use exact `candidateId`; the injected authority owns no candidate aliases.

### 2026-08-03 — Taxonomy authority and intentional ambiguity

Taxonomy `1.0.0` uses reviewed `source.json` and generated `manifest.json`
under `catalog/capability-taxonomy/1.0.0/`. The generated authority has five
closed concept kinds, an eight-level bounded parent forest, exact cross-family
applicability, disjoint resolved-alias, ambiguity, and exclusion records, and a
semantic digest that excludes only its digest field and explicit
`releaseMetadata`.

An intentional ambiguity is accepted controlled authority, not an invalid
alias. Exactly one ambiguity record owns a canonical ASCII key, two or more
distinct active possible concepts, one stable clarification reason, and
bounded context. Exact taxonomy lookup returns it as ambiguous and never
selects a concept. Turning that result into `clarification-required`, handling
raw user terms, and preserving query modalities belong exclusively to
Milestone 3.

### 2026-08-03 — Milestone 4 offline profile authority boundary

The exact profile/authority/rules/denominator versions are
`deterministic-candidate-profile/1.0.0`,
`deterministic-candidate-profile-authority/1.0.0`,
`deterministic-candidate-profile-rules/1.0.0`, and
`deterministic-profile-coverage/1.0.0`. The domain-owned immutable registry is
the only field/scope/value/use/facet mapping authority. Six fields are
candidate-wide and 21 are version/snapshot-specific.

The exact ordered registry and scope partition are:

1. `catalog-role-status` — candidate-wide
2. `capability-family` — candidate-wide
3. `repository-identity` — candidate-wide
4. `adoption-unit-type` — candidate-wide
5. `capability-variants-features` — candidate-wide
6. `repository-discovery-metadata` — version-specific
7. `language-ecosystem` — version-specific
8. `package-identity-mapping` — candidate-wide
9. `package-publication-version` — version-specific
10. `runtime-package-format` — version-specific
11. `framework-compatibility` — version-specific
12. `datastore-requirements` — version-specific
13. `required-infrastructure` — version-specific
14. `optional-infrastructure` — version-specific
15. `deployment-self-hosting` — version-specific
16. `license-identity` — version-specific
17. `archived-state` — version-specific
18. `fork-upstream-state` — version-specific
19. `maintenance-activity` — version-specific
20. `release-state-recency` — version-specific
21. `security-advisory-state` — version-specific
22. `security-policy-presence` — version-specific
23. `documentation-presence` — version-specific
24. `test-ci-presence` — version-specific
25. `artifact-chunk-availability` — version-specific
26. `package-repository-linkage` — version-specific
27. `operational-complexity-primitives` — version-specific

The committed offline projection uses only typed candidate-specific fields
from the closed parsed public catalog manifest. Four extraction rules populate
catalog role/status, capability family, stable catalog repository identity,
and package identity mapping. Known-unmapped package mapping is a known value
and proves not-applicability for exactly publication/version, runtime/package
format, and package-repository linkage. Every other missing value retains a
controlled source-specific unknown reason. No curator classification file was
added.

The generated closure is 150 profiles and 4,050 cells: 600 known, 210 not
applicable, 3,240 unknown, and zero conflicts. Four of 27 fields have current
known extraction. Launch hard-filter readiness is 2/16 (12.5%) and broad
retrieval readiness is separately 2/9 (22.2%); neither is averaged or presented
as passing the original 70–80% target.

Constraint evaluation remains pure and single-candidate. It supports primary
family, adoption-unit architecture, feature, and required-infrastructure
mappings. Unknown/conflict state and preserved non-taxonomy declarations are
unresolved; optional infrastructure is never treated as a prohibited
dependency. It returns no candidate list, filtering, retrieval, ranking, or
recommendation.

## Validation evidence

### 2026-08-03 — Milestone 1 local validation

- pnpm runtime:check: passed with Node 24.18.0.
- pnpm format:check: passed after formatting the new Plan, ADR, and the updated
  testing table.
- pnpm repo:check: passed after the two new linked documents were added to the
  index and the repository slug was marked as code.
- pnpm build followed by pnpm architecture:check: passed with 757 modules,
  2,412 dependencies, and zero dependency violations. Two earlier standalone
  architecture invocations ran before all required workspace outputs existed;
  the first reported 132 unresolved edges and the product-only retry reported
  one unresolved tool edge. No source change was made to resolve either;
  building both product and tool workspaces established the required command
  precondition.
- pnpm contracts:validate: passed with 10 representability cases and 40
  supplied candidates.
- pnpm verify: passed with 78 test files and 1,348 tests, plus all formatting,
  lint, type, architecture, repository, evaluation, catalog, schema, pre-live,
  and secret checks.
- pnpm verify:ci: passed; its disposable PostgreSQL 18.4 suite passed 8 test
  files and 62 tests, applied four migrations, verified 25 product tables with
  no skips, and the moderate dependency audit found no known vulnerabilities.
- git diff --check: passed before final review.

The sole Milestone 1 commit necessarily precedes draft-PR creation. Hosted CI
therefore remains PR-owned evidence and is recorded in the PR checks and final
Milestone 1 handoff rather than by adding a second milestone commit. No later
milestone may overwrite this local evidence; later results append dated
entries.

### 2026-08-03 — Milestone 2 local validation

- Red-first taxonomy domain tests initially failed all 11 cases because no
  taxonomy API existed. The completed suites pass 25 focused domain, contract,
  and command cases covering graph, term-class, ordering, digest, boundary,
  size, path, and diagnostic behavior.
- `pnpm runtime:check`, `pnpm format:check`, `pnpm taxonomy:validate`,
  `pnpm contracts:validate`, and `pnpm catalog:validate`: passed. Taxonomy
  validation reproduced the pre-review semantic digest
  `0339c200098cfecebc493e4216df00ef55730f22a87e77a039530a0571006b5d`;
  existing product conformance remained 10 cases/40 candidates and the catalog
  remained 150 candidates with digest
  `4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634`.
- `pnpm build`, `pnpm lint`, and `pnpm typecheck`: passed. Package-local script
  typechecking is active without a new dependency.
- `pnpm test`: passed 81 files and 1,373 tests.
- `pnpm test:coverage`: passed the same 81 files and 1,373 tests with 80.26%
  statements, 73.78% branches, 87.52% functions, and 80.64% lines.
- `pnpm architecture:check`: passed across 765 modules and 2,440 dependencies
  with zero violations. `pnpm repo:check` and `pnpm security:secrets` passed.
- `pnpm verify`: passed, including the new no-write taxonomy validator in the
  ordinary aggregate graph.
- `pnpm verify:ci`: passed. Its repository-owned disposable PostgreSQL 18.4
  verification passed 8 files and 62 tests, applied 4 migrations, verified 25
  public product tables without skips, and did not use Phase 7 state. The
  moderate dependency audit found no known vulnerabilities.
- `git diff --check` passed. Final status and complete staged-diff review remain
  publication gates immediately before the single milestone commit.

### 2026-08-03 — Milestone 2 exact-alias correction validation

- The focused live-authority regression failed red because `job-queue`
  resolved to `queue-worker-library`. After the reviewed source correction, 26
  focused domain, contract, and command tests passed, including synthetic
  deprecated-alias mechanics, source permutation, and source/manifest drift.
- `pnpm runtime:check`, `pnpm format:check`, `pnpm taxonomy:validate`,
  `pnpm contracts:validate`, and `pnpm catalog:validate` passed. Taxonomy
  validation reproduced corrected digest
  `838fa85b2e6937866854b6f733fe7045cf49d5f811cb5e4a8d503bfbd76a61c9`;
  product conformance remained 10 cases/40 candidates and the public catalog
  remained 150 candidates at its unchanged digest.
- `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm architecture:check`,
  `pnpm repo:check`, and `pnpm security:secrets` passed. Architecture remained
  765 modules and 2,441 dependencies with zero violations.
- `pnpm test` passed 81 files and 1,374 tests. `pnpm test:coverage` passed the
  same suite with 80.26% statements, 73.78% branches, 87.52% functions, and
  80.64% lines.
- All existing contract schema digests remained unchanged, including taxonomy
  authority schema
  `d8d4c875fc38696e6ead9dcc2821e04754135aa4af71f0fb85198a98187d3f70`
  and taxonomy source schema
  `357f34187ff26ea70c663f6009b07841b8045493ad54d2393713f7329a9e7933`.
- `pnpm verify` and `pnpm verify:ci` passed. Disposable PostgreSQL 18.4 applied
  4 migrations, verified 25 public product tables, and passed 8 files/62 tests
  without skips. The dependency audit found no known vulnerabilities. No
  provider, model, Phase 7, or Milestone 3 operation occurred.

### 2026-08-03 — Milestone 3 local validation

- Red-first domain tests failed 32 cases because the query APIs did not exist;
  red-first contract tests then failed 22 cases because the DTO, parser,
  identity, and exchange APIs did not exist. A final diff review also added two
  red cases proving that leading and trailing hyphens are rejected rather than
  silently discarded. The completed focused suites pass 74 tests: 35
  pure-domain and 39 contract/exchange cases.
- `pnpm runtime:check`, `pnpm format:check`, `pnpm taxonomy:validate`,
  `pnpm contracts:validate`, and `pnpm catalog:validate` passed. Taxonomy
  `1.0.0` retained semantic digest
  `838fa85b2e6937866854b6f733fe7045cf49d5f811cb5e4a8d503bfbd76a61c9`;
  product conformance remained 10 cases/40 supplied candidates; and the public
  catalog remained 150 candidates at its unchanged digest.
- `pnpm build`, `pnpm lint`, and `pnpm typecheck` passed. `pnpm test` passed 83
  files and 1,448 tests.
- The first two full coverage attempts exposed the existing 5-second timeout
  in the unrelated 150-interview scale test at 5.167 and 5.178 seconds. The
  exact isolated test passed. Removing repeated reads of the immutable taxonomy
  fixture from the new contract suite eliminated the added contention without
  changing the Phase 7 test or timeout. The authoritative rerun passed all 83
  files/1,448 tests with 80.59% statements, 73.96% branches, 87.71% functions,
  and 80.96% lines.
- `pnpm architecture:check` passed across 771 modules and 2,465 dependency
  edges with zero violations. `pnpm repo:check`, `pnpm security:secrets`, and
  `git diff --check` passed.
- `pnpm verify` and `pnpm verify:ci` passed. Disposable PostgreSQL 18.4 applied
  4 migrations, verified 25 public product tables, and passed 8 files/62 tests
  with zero skips. The moderate dependency audit found no known
  vulnerabilities. No provider, model, candidate, taxonomy-network, Phase 7,
  or Milestone 4 operation occurred.

### 2026-08-03 — Milestone 3 result-invariant correction validation

- The focused red run failed 7 of 83 tests: four mixed generic/incidental
  exclusions incorrectly normalized, an exact candidate ID failed to resolve
  when a divergent arbitrary authority key was present, the 50-record
  unresolved maximum exceeded the result schema, and correctly re-digested
  semantic forgeries passed the standalone parser. The completed focused
  domain, contract, and schema suites pass 99 tests. Complete diff review added
  a correctly re-digested,
  renumbered source-step permutation; standalone validation now rejects that
  noncanonical ordering independently of exchange recomputation.
- The initial complete-matrix formatting check found two new documentation
  files needing repository formatting. After that mechanical correction, the
  restarted matrix reached lint, which identified three unnecessary-condition
  or type-assertion findings in the new correction. The minimal style fixes did
  not change behavior; focused tests and lint passed before the authoritative
  matrix was restarted from `pnpm runtime:check`.
- `pnpm runtime:check`, `pnpm format:check`, `pnpm taxonomy:validate`,
  `pnpm contracts:validate`, and `pnpm catalog:validate` passed. Taxonomy
  `1.0.0` retained semantic digest
  `838fa85b2e6937866854b6f733fe7045cf49d5f811cb5e4a8d503bfbd76a61c9`;
  product conformance remained 10 cases/40 supplied candidates; and the public
  catalog remained 150 candidates at its unchanged digest.
- `pnpm build`, `pnpm lint`, and `pnpm typecheck` passed. `pnpm test` passed 83
  files and 1,464 tests. `pnpm test:coverage` passed the same suite with 80.02%
  statements, 73.14% branches, 86.84% functions, and 80.38% lines.
- `pnpm architecture:check` passed across 771 modules and 2,465 dependency
  edges with zero violations. `pnpm repo:check`, `pnpm security:secrets`, and
  `git diff --check` passed.
- `pnpm verify` and `pnpm verify:ci` passed. Disposable PostgreSQL 18.4 applied
  4 migrations, verified 25 public product tables, and passed 8 files/62 tests
  with zero skips. The moderate dependency audit found no known
  vulnerabilities. The accepted taxonomy source and manifest remained
  byte-identical; no provider, model, candidate, Phase 7, or Milestone 4
  operation occurred.

### 2026-08-03 — Milestone 4 local validation

- The first focused red run failed four surfaces because the field-registry,
  profile-parser, and projection APIs did not exist. The completed focused
  Milestone 4 suites passed 5 files and 36 tests. A later input-permutation
  case exposed profile digesting before canonical field ordering; the profile
  constructor now canonicalizes first, then derives the semantic digest and
  48-hex identity.
- Complete diff review added a correctly re-digested red case proving that
  unknown state reasons could previously be paired with the wrong state rule.
  The correction binds every state reason/rule pair and gives future
  structured, artifact-set, and derived known values distinct field-specific
  extraction rules and authority-coherent sources; derived dependencies now
  include conflict-claim sources in cycle detection.
- A final cross-field probe showed that correctly re-digested repository-owner
  and package-applicability forgeries were accepted before correction. The
  regression now rejects both and also closes package-publication identity to
  the exact mapped package without changing generated bytes or schema shape.
- The complete matrix found one formatter mismatch in the new evaluator and
  correctly rejected a formatter-modified generated coverage file. Both fixed
  generated artifacts are now excluded from formatter ownership and the
  generator restored byte-identical output. Repository policy also rejected
  inserting profile validation into the protected `ingestion:verify` graph;
  the read-only validator remains in ordinary top-level `verify` instead.
- Adding two large closed strict schemas increased measured parallel-suite and
  coverage-instrumentation runtimes. Targeted timeout allowances were added
  only to the affected strict-schema compilation, isolated import, exhaustive
  authority reparse, byte-identical generation, and existing 150-candidate
  scale checks. No assertion behavior or production timeout changed.
- `pnpm runtime:check`, `pnpm format:check`, `pnpm taxonomy:validate`,
  `pnpm profiles:validate`, `pnpm contracts:validate`,
  `pnpm catalog:validate`, `pnpm artifacts:validate`,
  `pnpm ingestion:verify`, `pnpm build`, `pnpm lint`, and `pnpm typecheck`
  passed. Ingestion verification passed 18 files/202 tests. The accepted
  taxonomy remained `1.0.0` at semantic digest
  `838fa85b2e6937866854b6f733fe7045cf49d5f811cb5e4a8d503bfbd76a61c9`;
  catalog closure remained 150 candidates at digest
  `4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634`.
- `pnpm test` passed 88 files and 1,500 tests. `pnpm test:coverage` passed the
  same suite with 79.94% statements, 71.98% branches, 86.76% functions, and
  80.32% lines.
- `pnpm architecture:check` passed across 782 modules and 2,504 dependency
  edges with zero violations. `pnpm repo:check` and
  `pnpm security:secrets` passed.
- `pnpm verify` passed. The earlier complete `pnpm verify:ci` pass used only the
  repository-owned disposable PostgreSQL 18.4 path: 8 files/62 tests passed
  without skips, 4 migrations applied, and 25 public product tables verified;
  the moderate dependency audit found no known vulnerabilities. A final
  post-review rerun repeated all ordinary verification successfully but could
  not provision its disposable database because the Docker daemon was
  unavailable. The dependency audit was repeated separately and remained
  clean. Docker Desktop was not started because doing so could violate the
  Phase 7 stop boundary; Phase 7 was not inspected, started, attached to,
  copied from, or queried. Hosted CI remains the final pinned-database rerun.
- Profile validation reproduced 150 profiles and 4,050 cells: 27/27
  represented fields, 4/27 extraction-capable fields, 600 known, 3,240
  unknown, 210 not applicable, and zero conflicts. Per-family closure was:
  authorization 120/639/51/0, audit-logging 120/660/30/0,
  background-jobs 120/651/39/0, rate-limiting 120/624/66/0, and webhooks
  120/666/24/0 for known/unknown/not-applicable/conflict. Candidate-side
  launch hard-filter readiness remained 2/16 (12.5%) and broad-retrieval
  readiness remained separately 2/9 (22.2%).
- The two additive schema digests are
  `3bbfdf2050c13a3d70e9dc289db7c8768a6fdcba8605cf12191e08560387af61`
  and `7a79a1671bf461127099e3ae2f75d29e949387987041bd3402f2614b747ed8cf`.
  The generated profile authority and content-free coverage report retained
  semantic digests
  `fc85d7ea71c69cd5e56e5a73936ceba6263c4ea0ba8fc2d0802556d79cf9e879`
  and `b313d7f7afc3f9324042fff965f9e63c4e0a347be2f7363808cb6107e913fb17`.
  Accepted taxonomy/query authorities, query schema digests, dossier and
  fingerprint semantics, and all preexisting contract schema digests remained
  unchanged. No persistence, migration, dependency, package, evaluation
  corpus/scorer, retrieval, ranking, provider, model, candidate-repository,
  artifact-body, external-corpus, or Phase 7 work occurred. Milestone 5 has
  not begun.

### 2026-08-04 — Milestone 4 hosted-CI review correction

- Milestone 4 product commit
  `66a4165c1239e7a46d72ccd6469d0856e815c410` passed substantive maintainer
  review. Workflow run 30927752409 job attempts 92054368305, 92056855786, and
  92059271629 were unchanged attempts of that commit.
- All three attempts started PostgreSQL successfully, installed with the frozen
  lockfile, passed clean-checkout standalone typecheck, proved reproducible
  installation, and passed pull-request metadata validation. Authoritative
  verification entered Vitest and continued reporting passing suites before
  the runner received a shutdown signal. No failed test assertion was
  reported; database verification and dependency audit were not reached; and
  the 20-minute workflow timeout was not reached. The immediate failure is
  therefore classified as an externally canceled hosted runner, without
  claiming a conclusive infrastructure root cause.
- The former monolithic `Verification` job unnecessarily repeated standalone
  typecheck/build work inside ordinary verification and kept PostgreSQL alive
  while unrelated installation, typecheck, repository-policy, and ordinary
  test work ran. The correction partitions the same collective authority into
  three independent Ubuntu 24.04 jobs, each bounded to 20 minutes:
  `Standalone Typecheck` runs frozen install and `pnpm typecheck`;
  `Verification` retains pull-request metadata policy and runs exactly
  `pnpm verify`; and `Database and Audit` alone provisions the pinned
  PostgreSQL 18.4 service and runs `pnpm db:verify` followed by
  `pnpm security:audit`. Every job proves an unchanged worktree.
- `pnpm db:verify` already owns its runtime preflight and deterministic build,
  so the database job adds no redundant build command. The jobs have no
  dependency edges, retain the existing read-only permissions, pinned actions,
  event boundaries, concurrency policy, and runner image, and add no retries,
  tolerance, caches, artifacts, reduced suites, or optional gates.
- This correction changes workflow policy, its repository regression coverage,
  and testing documentation only. No product implementation, generated
  profile authority, coverage report, contract, taxonomy, query authority,
  package script, lockfile, dependency, migration, persistence, ingestion,
  evaluation, provider/model, or Phase 7 behavior changes. Milestone 5 has not
  begun.
- The red-first tracked-workflow regression failed against the monolithic job
  before the split. The first accumulated validation exposed four
  `no-regex-spaces` findings in the new repository-invariant helper. The
  separately authorized mechanical correction replaced one exact two-space
  match with ` {2}` and three exact four-space matches with ` {4}`; it changed
  no accepted or rejected workflow text and required no lint suppression or
  additional test.
- Final local validation passed `pnpm runtime:check`, the focused zero-warning
  ESLint command, both required focused test invocations, `pnpm format:check`,
  `pnpm repo:check`, `pnpm security:secrets`, and `pnpm verify`. Each focused
  invocation and authoritative verification passed 88 files and 1,503 tests
  with no skips or todos. Architecture validation covered 782 modules and
  2,505 dependency edges with zero violations. Profile validation reproduced
  150 profiles and the unchanged authority and coverage digests; taxonomy,
  contract conformance, catalog, interview, schema, pre-live, and secret
  validation also passed. Local Docker and `pnpm verify:ci` were not used; the
  corrected hosted database job owns the fresh PostgreSQL and dependency-audit
  proof.

### 2026-08-04 — Milestone 4 final hosted-CI correction

- The first CI-only correction commit
  `2983194504253ca76697a93abd744e3300522785` successfully isolated standalone
  typechecking and database/audit work. In hosted run 30934627491, Standalone
  Typecheck job 92077512701 passed frozen installation, `pnpm typecheck`, and
  unchanged-worktree proof. Database and Audit job 92077512655 passed frozen
  installation, PostgreSQL verification, dependency audit,
  unchanged-worktree proof, and service shutdown.
- Verification job 92077512607 passed frozen installation and pull-request
  metadata validation, then completed formatting, product builds, lint, tool
  builds, and internal typechecking. Vitest entered normally and continued
  reporting passing suites; no failed assertion appeared. The runner received
  a shutdown signal before the suite completed, before the 20-minute timeout,
  so its final unchanged-worktree proof was skipped. This records the immediate
  externally canceled runner failure without claiming a conclusive GitHub
  infrastructure root cause.
- Local `pnpm verify`, `pnpm verify:core`, and `pnpm verify:ci` remain canonical
  and unchanged. Hosted ordinary verification is instead partitioned across
  one static/authority worker and three exact Vitest root shards. The static
  worker owns runtime preflight, formatting, product build, internal lint, tool
  build, internal typecheck, architecture, repository validation, general and
  interview evaluation validation and fixtures, contract conformance,
  taxonomy, profiles, catalog, interview specification, operator schemas,
  pre-live authority, secret scanning, and unchanged-worktree proof in the
  accepted sequence.
- Core Product Tests owns `packages/contracts/test`, `packages/domain/test`,
  `packages/persistence/test`, and `packages/ingestion/test`. Interview and
  Operator Tests owns `packages/interviews/test` and
  `apps/repository-interview-operator/test`. Tooling Tests owns
  `tools/evaluation-harness/test`, `tools/repository-interview-prelive/test`,
  and `tools/repository-checks/test`. The three assignments cover each of the
  nine ordinary test roots exactly once and retain the tracked
  `vitest.config.ts`.
- The exact displayed `Verification` name now belongs to a five-minute pure
  aggregate required check. It has no checkout, Node setup, package install,
  external action, database authority, or worktree; with `always()` it checks
  the four ordinary worker results explicitly and succeeds only when every
  result is `success`. Standalone Typecheck and Database and Audit remain
  independent required hosted evidence. All repository-code workers retain
  pinned setup, frozen installation, bounded execution, and final
  unchanged-worktree proof.
- This final correction changes only hosted workflow policy, its tests, and
  testing/plan documentation. The Milestone 4 product implementation,
  generated profile authority and coverage report, established contract and
  authority digests, package scripts, Vitest configuration, lockfile,
  dependencies, persistence, migrations, ingestion behavior, and evaluation
  implementation remain unchanged. Milestone 5 has not begun.
- Red-first workflow-policy validation against the first correction produced
  seven focused failures: the old three-job graph, retained monolithic
  `pnpm verify`, absent aggregate dependencies, missing static worker, and
  missing test shards. The final assertions were consolidated into the
  existing test-count envelope without reducing their coverage. Required
  focused invocations and canonical `pnpm verify` each pass 88 files and 1,503
  tests. The explicit shard results are 42 files/711 tests for core product,
  13/326 for interviews and operator, and 33/466 for tooling, totaling exactly
  88/1,503.
- Local runtime, zero-warning focused ESLint, build, formatting, repository
  policy, secret scan, diff, and all three shard checks pass. Architecture
  validation covers 782 modules and 2,505 dependency edges with zero
  violations. Profile validation reproduces 150 profiles, state counts
  600/3,240/210/0, profile-authority digest
  `fc85d7ea71c69cd5e56e5a73936ceba6263c4ea0ba8fc2d0802556d79cf9e879`,
  and coverage digest
  `b313d7f7afc3f9324042fff965f9e63c4e0a347be2f7363808cb6107e913fb17`.
  Local Docker and `pnpm verify:ci` were not used; Database and Audit retains
  the hosted PostgreSQL and registry-backed dependency-audit proof.

### 2026-08-04 — Milestone 4 acceptance and Milestone 5 start

- The maintainer accepted Milestone 4 product implementation at
  `66a4165c1239e7a46d72ccd6469d0856e815c410` and retained CI-policy
  corrections `2983194504253ca76697a93abd744e3300522785` and
  `2ddedf73f38fb25f625b5fd0793605d807f1ee93`.
- Complete local verification passed 88 files and 1,503 tests. Hosted
  Standalone Typecheck, Database and Audit, Interview and Operator Tests, and
  Tooling Tests workers passed. Repeated independent hosted workers were
  externally canceled without a failed test assertion, repository error,
  timeout, authority mismatch, or digest failure.
- The maintainer accepted Milestone 4 under a documented hosted-infrastructure
  exception. The existing required aggregate gate remains intact and
  fail-closed. Hosted CI is an operational follow-up rather than a Milestone 5
  start gate; no retry, tolerance, cancellation, timeout, shard, or graph
  redesign is authorized.
- The continuation gate reverified branch/head/base, local/remote head
  equality, Node 24.18.0, pnpm 11.17.0, draft mergeable PR #20 based on
  `main`, open Issue #19, zero review threads, all established authority
  digests, absent OpenAI credential variables, and the Phase 7 no-access
  boundary. The existing partial Milestone 5 red-first worktree was preserved.
- Milestone 5 began. Milestone 6 remains unstarted and unauthorized.

### 2026-08-04 — Contradiction-validator compatibility correction

- Honest authoring of required/prohibited adversarial cases triggered the stop
  condition because the public normalizer constructed its intended canonical
  clarification result and then rejected that result while parsing it. The
  generated content already contained one required and one prohibited
  constraint with `resolutionBasis: contradiction` and
  `ruleId: constraint-modality-conflict`.
- `validateContradictionPairs` incorrectly excluded the constraint being
  validated while independently searching its canonical group for both hard
  modalities. Because canonical normalization has one record per modality,
  each record could not find another record of its own modality.
- The separately authorized correction removes those self-exclusions and
  binds the conflict rule to contradiction basis. A group is valid when the
  complete same-facet, same-non-null-concept contradiction group contains at
  least one required and one prohibited member; a legitimate preferred member
  may coexist. Generation, merging, order, IDs, clarifications, outcomes,
  source IDs, modalities, rule IDs, schemas, versions, and digest projections
  did not change.
- Focused domain and contract regressions prove core/public normalization,
  standalone parsing, exchange validation, both hard modalities, preferred
  coexistence, lone/split/falsely marked groups, and correctly re-digested
  missing-pair forgeries. They pass 2 files and 91 tests. The exact three-file
  correction is commit
  `e0f8c2a6368d5765661ffb78dafdd0b7c51ca907`
  (`fix(query): validate contradiction pairs`).
- CapabilityQueryInputV1 and CapabilityQueryNormalizationResultV1 retain
  schema digests
  `d48e018b71f8e6947f60f4d3559c48047daba8a335168b51f37bfb5199c81b9b`
  and
  `bdd7db9510937c0728f87b0d83f75dbd374555fa17c2b1e4a56399d9f9f2d06b`;
  normalizer `1.0.0` and every established taxonomy, profile, authority,
  coverage, catalog, and product schema digest remain unchanged. This repairs
  validation of already intended output; it is not a normalization feature.

### 2026-08-04 — Milestone 5 implementation

- Added evaluation-only `retrieval-v1` contract
  `retrieval-evaluation-corpus/1.0.0` at semantic digest
  `3638596a5c330c3516003beab908b0b5631c84f41d957f78ce2cc1379cc682de`.
  Its 213 JSON files close through one nonrecursive manifest and 212 exact
  byte-hashed entries. The corpus contains 30 retrieval and 20
  normalization/adversarial cases, exactly six/four per family.
- Blind queries contain no tags or audit classifications. A separate
  `retrieval-case-classification/1.0.0` audit authority remains outside the
  blind-only future baseline loader and separate from 50 normalization, 20 clarification, 30
  generated hard-filter, 30 relevance, and 30 no-result gold files plus one
  equivalence authority. All gold remains proposed/not-reviewed. Relevance is
  capability-query relevance rather than viability, fit, ranking, quality, or
  recommendation.
- The harness reruns the accepted public normalizer for every case and the
  accepted single-candidate evaluator for every retrieval case/profile pair.
  It preserves tri-state product results, maps unresolved only to the separate
  evidence-needed lane, excludes negative controls, and regenerates the full
  30 by 150 decision projection in memory.
- Added a closed exact-closure prediction set, content-free score-report
  schema, deterministic metrics with explicit null/not-applicable zero
  denominators, and 26 hand-calculated synthetic scorer fixtures. No real
  corpus oracle, deterministic baseline, baseline report, production
  retrieval, candidate generator, ranking, provider, model, database,
  migration, external dependency, new package, ingestion behavior, or Phase 7
  work exists. The authorized direct domain workspace dependency changes only
  the evaluation-harness lockfile importer.
- Ordinary `pnpm verify` and the existing Static and Authorities worker add
  only retrieval authority validation and scorer fixtures. The hosted job
  graph, shards, concurrency, timeouts, runners, aggregate behavior, database
  isolation, actions, and permissions remain unchanged.
- Red-first boundary, corpus, projection, prediction, scoring, architecture,
  repository-policy, and workflow-policy coverage passes 13 focused files and
  153 tests. The complete workspace passes 98 files and 1,550 tests. Final
  coverage is 81.13% statements, 73.30% branches, 88.25% functions, and
  81.52% lines; retrieval scorer statement coverage is 98.35%.
- Material red-to-green corrections retained strict boundaries: canonical
  corpus JSON was excluded from Prettier rewriting so manifest byte hashes
  remain authoritative; the harness directly declares `@gitblocks/domain` and
  the contracts API no longer re-exports the evaluator for evaluation use;
  invalid retrieval CLI commands reject
  before loading corpus authority; and retrieval authority tests use the
  repository's existing 60-second bounded test limit under full-suite worker
  contention. A subsequent compile-only path narrowing failure was corrected
  with a non-optional local after the existing score-argument guard. No
  product evaluator, normalizer, product schema, or workflow timeout semantics
  changed; evaluation-only corpus and prohibited-preservation scorer semantics
  were corrected before acceptance.
- The complete required local matrix passes: runtime, formatting, retrieval
  validation/fixtures, pilot validation/fixtures, interview verification,
  taxonomy, profiles, contracts, catalog, artifacts, ingestion, build, lint,
  typecheck, tests, coverage, architecture, repository policy, secrets, and
  authoritative `pnpm verify`. Architecture covers 805 modules and 2,596
  dependency edges with zero violations. Focused contradiction regressions
  pass 2 files and 91 tests from the final staged state.
- Pilot-v1 and repository-interviews-v1 remain byte-identical. Taxonomy,
  query-schema, profile-schema, generated profile-authority, profile-coverage,
  and catalog semantic digests remain unchanged. Apart from the authorized
  evaluation-harness domain importer, no lock resolution changed; no
  persistence, migration, ingestion implementation, provider/model, database,
  candidate repository, external corpus, or Phase 7 state changed or was
  accessed.
- Review correction removed leaked query classifications, replaced formulaic
  relevance with 636 candidate/query-specific proposed judgments distributed
  130/62/388/56 across grades 0/1/2/3, narrowed real equivalence to true
  result redundancy (zero defensible committed groups), validated audit roles
  from generated authority, and strengthened prohibited preservation to exact
  one-record semantic equality. Mechanical regeneration preserves all 30
  relevance files and equivalence bytes.
- This Milestone 5 implementation record was subsequently accepted through
  correction commit `4f4c1e4522f7db85d2a0a422b5c78ac8665a4840`; the transition
  and retained proposed/not-reviewed limitation are recorded below.

### 2026-08-04 — Milestone 5 acceptance and Milestone 6 implementation

- Milestone 5 was accepted through review correction commit
  `4f4c1e4522f7db85d2a0a422b5c78ac8665a4840`. The independent 50-case
  corpus/scorer architecture is accepted. Relevance and hard-filter audit
  provenance remains proposed/not-reviewed, so this is deterministic
  development authority rather than independently accepted retrieval truth.
- Milestone 6 adds evaluation-only runner
  `retrieval-baseline-runner/1.0.0`; ordinary baselines
  `retrieval-family-only-baseline/1.0.0`,
  `retrieval-exact-keyword-baseline/1.0.0`, and
  `retrieval-alias-expanded-baseline/1.0.0`; weak control
  `retrieval-always-abstain-control/1.0.0`; safety control
  `retrieval-constraint-violating-control/1.0.0`; synthetic control
  `retrieval-fixture-oracle-control/1.0.0`; and report
  `retrieval-baseline-report/1.0.0`.
- The binding two-phase boundary loads only blind queries and safe structured
  taxonomy/profile authority during prediction generation. Strategies receive
  no case/source identity, assigned corpus family, prose, classifications,
  rationale, selection source, artifact, or gold. All five real-corpus
  prediction sets close, validate, digest, and freeze before the full corpus is
  loaded for deterministic scoring.
- Prediction-set semantic digests are family-only
  `fcb1aa2ad3f48835dc75e30f59ae1482ca273aab854eb71e579454a67db59210`,
  exact-keyword
  `06b588add9f27c0f30e6c32491a2341f64d6f66df1537f6b31d99555968e4ffe`,
  alias-expanded
  `47024301697d758d436d578939bfdd35b9424a3a343b7c6be9a05a9b4e04815e`,
  always-abstain
  `25b7b145e5b97c376174639a3fa370d6d91048452e3271bee322401dcd8639cb`,
  and constraint-violating
  `21a6807b426e7814b8f501ea88f5da8dec855e9e91e8383bfbdec87b79ff0d47`.
  Prediction sets are never committed.
- The content-free report at
  `verification/retrieval-v1/baseline-report.json` has semantic digest
  `6a16353159fb2e30e424ee20fb2e4eeda640ae2248a50580fd162ab012ddf1ed`.
  It contains aggregate/per-family numeric measurements and denominators,
  safety counts, bindings, versions, and opaque prediction/score digests only;
  it contains no case/query/source/candidate/result/decision/reason/reviewer,
  rationale, URL, artifact/provider/model content, timestamp, winner, rank,
  composite, recommendation, threshold, readiness claim, or per-case score.
- Ordinary baselines have zero hard-filter, negative-control, conflict, lane,
  and duplicate violations. Always-abstain emits zero results, retains null
  duplicate denominators, and scores 5/30 no-eligible accuracy. The unsafe
  control records 55 hard-filter errors and 54 conflict, 30 negative-control,
  and 60 lane violations. The synthetic oracle has exact perfect fixture
  metrics without loading `retrieval-v1` or creating a real prediction set.
- Shared normalization, clarification, alias, and prohibited-modality metrics
  use the accepted public normalizer and are disclosed as shared-component
  measurements, not independent baseline achievements. No baseline winner,
  relative-performance requirement, quality threshold, recommendation, or
  production-readiness conclusion is selected.
- `pnpm eval:retrieval:baselines` is print-only;
  `pnpm eval:retrieval:baselines:generate` writes only the fixed report path
  with canonical/symlink/bound checks; and `pnpm eval:retrieval:verify` is
  read-only, performs repeated/reversed-order generation and scoring, compares
  exact committed bytes/digest, and proves a no-write effect audit. Ordinary
  verification and only the existing Static and Authorities worker run the
  read-only verifier; the hosted graph and policies remain unchanged.
- Milestone 6 was accepted at
  `ea27f11432513ec352ce43821eb95b8da0886182`. Production
  retrieval, candidate generation, hard filtering, ranking/reranking,
  recommendation, vector/embedding search, API/MCP, persistence, migration,
  ingestion behavior, provider/model access, database work, and Phase 7 work
  remain absent. Milestone 7A is implementation-only; Milestone 7B and live
  execution remain unauthorized.

### 2026-08-05 — Milestone 7A offline implementation

- The maintainer approved the two-commit split: one offline implementation
  commit `feat(profiles): add controlled materialization operator`, followed
  only after separate live authorization by
  `docs(profiles): record deterministic materialization evidence`.
- Milestone 7A adds the independently digested nine-operation provider policy,
  separate granular collector, closed untracked source authority, pure
  150-profile projection, coverage comparison, replay receipt, fresh-database
  plan, atomic runner, three-command surface, and fake-effect/denial tests.
- Legacy ingestion contracts and results remain unchanged. Existing four
  migrations and 25 product tables suffice; no migration/table meaning,
  product schema, new package, dependency, provider host, workflow, or accepted
  authority changes.
- No live source authority, profile materialization, receipt, coverage, or
  completion file exists. No Docker, PostgreSQL, credential, provider, model,
  candidate repository, retrieval/ranking, or Phase 7 effect is authorized or
  used. Milestone 7B remains unauthorized.
- The focused offline gate passes 166 tests in 14 files; the complete suite
  passes 1,677 tests in 115 files. Final V8 coverage is 80.09% statements,
  73.36% branches, 87.59% functions, and 80.47% lines. `pnpm verify`,
  architecture, repository policy, and secret scanning pass without invoking
  any materialization command.

### 2026-08-05 — Milestone 7A persistence-idempotency review correction

- Review found that the initial 7A operator seeded and verified the fresh
  database but did not persist collected legacy profiles, attached empty
  evidence lists, equated provider drift with live idempotency, assigned
  incorrect identity semantics to the head/license/file sources, and removed
  container/network resources concurrently.
- The correction binds each collection to accepted runtime-role persistence,
  adds the private
  `profile-materialization-persistence-proof/1.0.0`, maps exact controlled
  observation topics to generated/reused evidence identifiers, reconciles the
  second source authority against the first, and derives live idempotency from
  both source drift and the second persistence dispositions.
- Unchanged records retain their first collection bytes and semantic identity;
  the head is a mutable singleton and license/file identities bind the exact
  head commit. Cleanup is strictly container-before-network with absence proof
  after each resource.
- The review correction remains offline and fake-effect only. It adds no live
  authority/evidence, migration, table, product schema, provider, dependency,
  workflow, retrieval/ranking scope, or Phase 7 effect. Milestone 7B remains
  unauthorized.

### 2026-08-06 — Milestone 7A final source-reconciliation correction

- Review found that reconciliation rejected temporary unavailability changes
  for immutable exact-snapshot license/file identities even though the drift
  comparator correctly treated unavailability as non-factual. It also found
  that release evidence did not require a selected release and repository-file
  evidence used a generic topic prefix plus filename suffix.
- Red-first execution produced nine failures across the source-authority and
  persistence-proof suites: direct value/absence-to-unavailable transitions,
  selected-release evidence removal, and repository-file suffix matching.
  Established-fact contradiction, head advancement, and unchanged-byte tests
  remained green.
- Reconciliation now rejects only differing established immutable facts;
  transitions involving controlled `unavailable` retain the current record as
  changed drift. Equal content still reuses the first record byte-for-byte, and
  both collection authorities still contribute to controlled-failure receipt
  counts.
- `profileCandidate` and persistence proof validation share the exact existing
  release selector and repository-file topic generator. A selected release
  requires matching `release-current` evidence. A file requires the exact
  candidate, controlled topic, commit SHA, and encoded immutable path; prose is
  never inspected.
- Final offline evidence: the required focused gate passes 68 tests in six
  files; ingestion passes 285 tests in 29 files; the complete suite and
  `pnpm verify` pass 1,690 tests in 115 files. V8 coverage is 80.11% statements,
  73.43% branches, 87.68% functions, and 80.49% lines. Architecture checks 847
  modules and 2,808 dependencies with zero violations. The initial complete
  suite exposed only the expected legacy `profile.ts` byte lock, which was
  updated to the reviewed helper-export digest before the clean rerun.
- Provider policy, operational schemas, product/evaluation authorities,
  package and lock files, migrations, persistence database code, workflow, and
  live evidence paths remain unchanged. No materialization command, Docker,
  PostgreSQL, credential, provider, model, retrieval/ranking, or Phase 7 effect
  occurred; Milestone 7B remains unauthorized.

### 2026-08-06 — Milestone 7A qualified-recovery correction

- Review found an asymmetric recovery defect: when a first optional-source
  failure left a candidate qualified/unpersisted and the second collection
  succeeded, provider-content equality caused reconciliation to reuse the
  empty-evidence first records and discard newly persisted evidence IDs.
- Red-first execution failed six of 45 tests across the source-authority,
  persistence-proof, and injected system-effects suites. The failures exposed
  repository and npm evidence loss, acceptance of different nonempty evidence
  lists, silent rescue of a complete current candidate with missing evidence,
  the recovered persistence-proof failure, and repository identity mismatch.
  Separate repository fixtures also failed for a wrong immutable repository
  and a source/immutable repository mismatch.
- Equal-provider-content reconciliation now applies the reviewed evidence
  matrix. It retains current nonempty recovery evidence, preserves prior
  durable evidence only for a currently qualified candidate, rejects different
  nonempty evidence identities and unqualified evidence loss, and derives
  qualification solely from current `unavailable` records. Availability drift
  behavior remains unchanged.
- The injected recovery journey exercises collection, persistence, evidence
  attachment, reconciliation, source authority, persistence proof,
  idempotency derivation, and receipt parsing. The recovered candidate creates
  its durable candidate/snapshot and retains all exact generated evidence;
  the earlier controlled failure keeps both live idempotency and receipt
  qualification at `qualified-optional-source-failures`. The reverse
  complete-to-qualified journey retains prior evidence on unchanged facts,
  keeps the current unavailable record, and performs no second persistence
  mutation for that candidate.
- Repository-file evidence now requires an exact safe GitHub repository source
  URL and an immutable URL with the same owner/repository, exact commit, and
  exact encoded path. Wrong owner/repository, source/immutable mismatch,
  query/fragment, percent ambiguity, suffix, path, commit, and topic-prefix
  substitutions fail without reading observation prose.
- Final offline evidence: the required focused gate passes 76 tests in six
  files; ingestion verification passes 293 tests in 29 files; the complete
  suite and authoritative `pnpm verify` pass 1,698 tests in 115 files. V8
  coverage is 80.13% statements, 73.49% branches, 87.67% functions, and 80.51%
  lines. Architecture checks 847 modules and 2,808 dependencies with zero
  violations. The provider policy, operational/product schemas, catalog,
  accepted profile/evaluation authorities, package/lock files, migrations,
  persistence database implementation, workflow, and live evidence paths are
  unchanged. No materialization command, Docker, PostgreSQL, provider,
  credential, model, retrieval/ranking, or Phase 7 effect occurred; Milestone
  7B remains unauthorized.
