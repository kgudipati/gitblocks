# Phase 10 codebase-conditioned ranking

## Status and authority

- Governing issue:
  [#32 — Phase 10: Establish codebase-conditioned OSS ranking](https://github.com/kgudipati/gitblocks/issues/32)
- Branch: `feat/32-codebase-conditioned-ranking`
- Draft PR:
  [#33 — docs(ranking): establish Phase 10 governance](https://github.com/kgudipati/gitblocks/pull/33)
- Owner: repository maintainer
- State: Milestone 1 architecture is independently accepted at exact commit
  `6d43861ead6889f706c82b25fcd3d301acb6c4f3`. The maintainer accepted the
  documented hosted-infrastructure exception for natural run `31416900337`:
  all six repository-verification workers passed, while the compatibility
  aggregate did not execute because of GitHub's account billing/spending-limit
  condition. Publication of this bookkeeping record authorizes Milestone 2
  only. This M2 authoring commit proposes the complete ranking-v1 authority,
  scorer, frozen blind baselines, reports, and gate-review inputs. Independent
  M2 review is pending; no M2 gate is accepted and Milestones 3 through 6
  remain unauthorized.
- Required and verified base:
  `a6e03ef20a8cef2a39db8e66b91612245378f9db`
- Last updated: 2026-08-10

Issue #32 is the requirements authority. Accepted
[ADR 0011](../architecture/decisions/0011-codebase-conditioned-ranking.md)
owns the durable architecture. ADR 0010 is
already accepted retrieval-v2 history and is not available for reuse. This
plan owns execution order, independent review gates, exact validation,
publication, and progress evidence. Accepted ADRs, the product contract,
repository engineering policy, and the governing issue win if they conflict.

Milestone 1 was documentation and governance only. Its accepted architecture
commit does not contain ranking product code, ranking evaluation authority,
candidate collection, a provider/model call, a benchmark, or database
mutation. Publication of this bookkeeping descendant authorizes only the
bounded Milestone 2 authority below; it does not begin that work.

## Purpose and user-visible outcome

Project Phase 10 maps exactly to Phase 12 — Ranking Engine V1 in the original
end-to-end strategy. Phase 9 answers:

> Which OSS candidates are plausible enough to deserve deeper comparison?

Phase 10 will answer:

> Which retrieved candidate is a responsible adoption fit for this particular
> target repository, and what evidence justifies its disposition and its
> relationship to the other retrieved candidates?

The planned user-visible result is the existing fit-assessment response:
evidence-grounded candidate dispositions and reasons, responsible outcome,
material claims and unknowns, hard conflicts, ties, justified pairwise
relations, and incomparable pairs. V1 is deterministic, model-free, and does
not emit a universal repository score or numeric confidence.

The observable result of Milestone 1 is narrower: an open governing issue, one
issue-linked branch, this execution plan, accepted ADR 0011, bounded status
documentation, and a draft PR retaining the independently accepted
architecture and its publication evidence.

## Verified current repository state

Before any mutation on 2026-08-10:

- local `main`, `origin/main`, and live `refs/heads/main` all resolved to
  `a6e03ef20a8cef2a39db8e66b91612245378f9db`;
- the tracked/index/ordinary-untracked worktree was clean;
- Node was `v24.18.0` and pnpm was `11.17.0`;
- PR #22 was merged with merge commit
  `a6e03ef20a8cef2a39db8e66b91612245378f9db`;
- Issue #21 was closed with completed state reason;
- no Phase 10 governing issue, Phase 10/ranking branch, or
  `packages/ranking` existed;
- Phase 9 was independently accepted and merged;
- Phase 8 Milestone 7B remained deferred; and
- repository interviews remained optional enrichment.

The gate used `git symbolic-ref`, `git rev-parse`, `git ls-remote`, porcelain-v2
status, local and remote branch listings, `node --version`, `pnpm --version`,
filesystem inspection, the authenticated GitHub connector, and authenticated
`gh` read-only checks. The exact branch was then created from the verified SHA.

Repository inspection also established:

- `FitAssessmentRequestV1` and `FitAssessmentResponseV1` already own assessment
  semantics;
- the exchange validator limits candidates mentioned by rank groups, rank
  relations, and incomparable pairs to `requestedMaximumResults`, while the
  complete response may assess all supplied candidates;
- the current profile authority contains 150 profiles and 27 fields per
  profile: 600 known, 210 not-applicable, 3,240 unknown, and zero conflict
  cells;
- the four known fields are structural catalog/profile bindings;
- accepted Phase 8 materialization contracts and pure projection support ten
  structured fields but have not published committed known values;
- Phase 9 retrieval metadata is committed but its description, topics, and
  source-language facts do not establish target-conditioned adoption fit;
- no committed all-150 dossier/evidence authority exists;
- the only migrations are `0001` through `0004`; and
- no production ranking command or package exists.

### Published Milestone 1 state

Issue #32 is open. Branch `feat/32-codebase-conditioned-ranking` was created
from exact accepted base `a6e03ef20a8cef2a39db8e66b91612245378f9db`, was
pushed normally without rebase or force, and is the head branch of open draft
PR #33. The initial publication head before this independent-review correction
was `0b1ffc160be76a93b6a72c1fafa622d305a980ec`.

Natural pull-request CI run
[`31415154596`](https://github.com/kgudipati/gitblocks/actions/runs/31415154596)
completed successfully for that exact head at `2026-08-10T17:46:29Z`. All six
ordinary workers passed: `Standalone Typecheck`,
`Verification — Static and Authorities`,
`Verification — Core Product Tests`,
`Verification — Interview and Operator Tests`,
`Verification — Tooling Tests`, and `Database and Audit`. The aggregate
`Verification` job also passed. The run was inspected read-only and was not
rerun.

Natural correction-head run
[`31416900337`](https://github.com/kgudipati/gitblocks/actions/runs/31416900337)
completed for exact architecture commit
`6d43861ead6889f706c82b25fcd3d301acb6c4f3`. All six
repository-verification workers completed successfully:
`Verification — Core Product Tests`, `Verification — Tooling Tests`,
`Verification — Static and Authorities`, `Standalone Typecheck`,
`Verification — Interview and Operator Tests`, and `Database and Audit`.

The aggregate `Verification` job retained conclusion `failure`; it did not
execute its compatibility-gate work because GitHub reported that recent
account payments had failed or the spending limit needed to be increased. The
repository testing strategy establishes that this aggregate checks out no
repository, installs nothing, and performs no additional product or test
verification; it only requires the underlying ordinary verification-worker
conclusions. No rerun or dispatch occurred. The maintainer independently
accepted Milestone 1 at that exact architecture commit under the repository's
documented hosted-infrastructure-exception precedent. This record does not
relabel the aggregate as successful.

Milestone 1 is accepted. Publication of this bookkeeping descendant authorizes
Milestone 2 within its bounded scope below. The draft PR remains open,
unmerged, and not ready; Issue #32 remains open. Milestones 3 through 6 remain
unauthorized.

### Phase 10 GitHub Actions conservation policy

For Milestones 2 through 5, contributors must not request, rerun, dispatch, or
intentionally trigger GitHub Actions. They must not modify
`.github/workflows/ci.yml` merely to suppress CI and must not weaken repository
verification requirements. The canonical local verification commands and each
milestone's accepted local evidence remain authoritative.

Every published implementation commit intended not to trigger the existing
pull-request workflow must carry `[skip actions]` in its commit message and use
ordinary non-force history. The governing plan must retain exact local command
results, digests, counts, and clean-worktree evidence. Skipped or pending
hosted checks are not product-quality evidence and may not be reported as
passed. Independent acceptance remains required before the next milestone.

This is a Phase 10 implementation-period resource policy, not permanent CI
removal. Milestone 6 owns the final hosted-proof and merge posture. A future
hosted run requires explicit maintainer authorization. If hosted Actions remain
unavailable at closure, any final infrastructure exception requires separate
independent review and documentation.

### Authorized Milestone 2 boundary

After this bookkeeping record is published, Milestone 2 may add only the
additive `ranking-v1` evaluation authority; the proposed 30 cases, exactly six
per supported family unless independent evidence justifies a bounded
pre-freeze correction; additive scorer support; independent gold review and
adjudication; gold-blind baselines; separate fixed-candidate and
retrieval-to-ranking composition evaluation; exact quality, safety, and
performance/resource gates; and the frozen choice of either 13/18 or 14/18 as
the decision-bearing deterministic-readiness minimum.

Milestone 2 does not authorize `@gitblocks/ranking`, production ranking,
candidate-authority collection, Milestone 3 provider calls, candidate-evidence
publication, model/interview calls, a database migration,
vector/index/cache/search infrastructure, MCP/API/Skill work, production
ranking output, or production ranking benchmarking. Milestone 3 cannot begin
until Milestone 2 independently freezes and accepts its complete authority,
including the exact readiness minimum before any M3 effect, output, or coverage
observation.

## Scope and explicit non-goals

### Milestone 1 scope

Milestone 1 may change only:

- governing Issue #32 and draft PR metadata;
- this execution plan;
- proposed ADR 0011; and
- the minimum README, product-contract, and system-context status/boundary
  statements required to make Phase 10 governance discoverable and honest.

### Phase 10 planned scope

After each preceding milestone is independently accepted, Phase 10 may add:

- independently reviewed ranking-v1 evaluation authority and scorer support;
- only the accepted candidate facts/evidence needed by Ranking V1;
- an additive query-approval and ranking-execution envelope;
- one pure `@gitblocks/ranking` package; and
- deterministic request- and target-conditioned assessment/partial ordering.

### Explicit non-goals

Phase 10 does not implement a real local scanner, MCP, HTTP/internal service,
Agent Skill, plugin, authentication, billing, tenancy, integration planning,
code editing, adoption-outcome capture, broad GitHub indexing, catalog
expansion, vector/pgvector search, embeddings, dedicated search, model
reranking, interview regeneration, Phase 7 calibration, Phase 8 execute #5,
speculative persistence, universal repository scores, or numeric confidence.

Milestone 1 additionally excludes every TypeScript product/evaluation schema or
implementation, `packages/ranking`, ranking-v1 cases/gold, candidate authority,
provider/model/network collection, benchmark execution, migration, package
dependency, database mutation, and completion evidence for a later milestone.

## Requirements crosswalk

| Governing requirement                        | Decision or destination                       | Milestone/evidence                              |
| -------------------------------------------- | --------------------------------------------- | ----------------------------------------------- |
| phase outcome and retrieval boundary         | ADR 0011, phase boundary                      | M1 independent review                           |
| eligible/evidence-needed/excluded lanes      | ADR 0011, handoff and resolution closure      | M1 review; M4 contract tests; M5 behavior tests |
| retrieval-score non-use                      | ADR 0011 handoff and safety gates             | M1 review; M4/M5 negative tests                 |
| approved query transition                    | versioned binding in ADR 0011                 | M4 contract/mapping tests                       |
| controlled ranking-criterion binding         | additive bounded authority in ADR 0011        | M4 contract tests; M5 behavior tests            |
| fit evidence bridge                          | paired profile/evidence authority in ADR 0011 | M3 conformance; M5 traceability                 |
| two denominators and fact origins            | ADR 0011 denominator/readiness tables         | M1 review; M3 generated report                  |
| 70–80% decision readiness                    | pre-M3 temporal policy in ADR 0011            | M2 freeze; M3 measurement; M6 gate              |
| request-conditioned criteria                 | ADR 0011 comparison hierarchy                 | M5 pairwise/property tests                      |
| target facts and missing candidate authority | ADR 0011 target/authority sections            | M3/M5 evidence                                  |
| package/dependencies and envelope            | ADR 0011 ownership section                    | M4 architecture checks                          |
| maximum-result overflow                      | ADR 0011 maximum-results section              | M5 boundary/permutation tests                   |
| no numeric/model/infrastructure defaults     | ADR 0011 decisions and triggers               | every milestone review                          |
| ranking-v1 corpus and separate tracks        | ADR 0011 evaluation section                   | M2 authority; M6 measurements                   |
| gate/baseline/review protocol                | ADR 0011 acceptance sections                  | M2 frozen records                               |
| exact milestone sequence                     | ADR 0011 and this plan                        | prior-milestone acceptance records              |
| publication and hosted-CI adjudication       | published-state section and PR #33            | exact-head workers plus accepted M1 exception   |

## Assumptions, risks, and unresolved decisions

### Verified facts

- Phase 9 bounds returned candidates to 20.
- The evidence list is contract-bounded to 2,000 observations.
- Existing assessment semantics can represent the planned ranking result.
- Existing profile source semantics include evidence IDs for structured
  collection, but current committed profiles do not have all-150 fit evidence.
- Accepted pilot mappings are tooling-only, not product ranking rules.

### Locked decisions

- Ranking V1 is deterministic and model-free.
- `FitAssessmentRequestV1`/`FitAssessmentResponseV1` stay authoritative.
- The execution denominator is 22 fields; the decision denominator is 18.
- Retrieval score is provenance only.
- Pairwise partial ordering is request-conditioned and unweighted.
- No persistent ranking infrastructure is authorized.
- Pilot-v1 remains immutable historical/proposed authority.
- Ranking-v1 fixed-candidate and composition measurements remain separate.

### Risks and controls

| Risk                                                | Control and latest resolution point                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| structural fields inflate readiness                 | independently review both frozen denominators in M1; decision gate uses only 18 fields               |
| human/model judgment mislabeled deterministic       | source-origin report and extraction-rule proof in M3                                                 |
| profile values bypass evidence traceability         | field-to-observation bridge and dossier conformance required in M3/M5                                |
| query approval loses or hardens intent              | exact source-to-request binding and negative contract tests in M4                                    |
| free-form criterion prose becomes ranking semantics | exact criterion-binding closure; prose remains inert; unbound material success fails closed in M4/M5 |
| missing target/candidate evidence becomes favorable | unknown/insufficient fail-closed rules in M5                                                         |
| arbitrary top-three truncation                      | complete-group overflow rule and permutation tests in M5                                             |
| evaluation leakage or post-score gate setting       | gold-blind baselines and independently frozen M2 gates before output                                 |
| old database/dossier state assumed recoverable      | M3 committed authority must construct every dossier without it                                       |
| Phase 9 metadata is repurposed opportunistically    | new projection requires independent source/semantic review; no current consumed use                  |
| 30 cases overclaim generality                       | exact counts reported; no statistical-representativeness claim                                       |
| readiness threshold is chosen after M3 coverage     | exact 13/18 or 14/18 choice freezes in accepted M2 policy before any M3 effect/output                |

### Decisions deliberately left to later independent review

- M2 freezes the exact additive evaluation schema changes, case identities,
  review record, scorer changes, baseline outputs, numeric quality gates, and
  performance/resource budgets before production output. The same independent
  M2 acceptance must select and digest either 13/18 (72.222222%) or 14/18
  (77.777778%) as the exact readiness minimum before M3 begins; M3 coverage is
  unavailable to that choice.
- M3 freezes the exact candidate-authority contract names, accepted source
  cutoffs/completeness, and any human-reviewed structured facts needed for
  non-numeric fit claims, then measures coverage against the pre-frozen M2
  threshold.
- M4 freezes additive product schema details—including the final name/shape of
  the bounded ranking-criterion binding—and algorithm/policy identifiers
  without changing the architecture in ADR 0011.
- Controlled-vocabulary additions are allowed only when a concrete accepted
  request/target/candidate comparison requires them.

None of these open details permits a later milestone to begin before the prior
milestone is independently accepted.

## Applicable ADRs and contracts

- [ADR 0003](../architecture/decisions/0003-product-contract-kernel.md): domain
  and contract ownership remain canonical; no parallel DTOs or business rules
  in adapters.
- [ADR 0007](../architecture/decisions/0007-evidence-grounded-repository-interviews.md):
  interviews stay optional and cannot author evidence-reference arithmetic.
- [ADR 0008](../architecture/decisions/0008-artifact-first-retrieval-foundation.md):
  reuse the 27-field registry, explicit states, 150-profile authority,
  constraint evaluation, and accepted ten-field materialization machinery.
- [ADR 0009](../architecture/decisions/0009-production-retrieval.md): preserve
  Phase 9 result lanes, bounds, provenance, and retrieval semantics unchanged.
- [ADR 0010](../architecture/decisions/0010-reviewed-retrieval-v2-authority.md):
  retrieval-v2 remains Phase 9 evaluation authority and is not ranking gold.
- Accepted
  [ADR 0011](../architecture/decisions/0011-codebase-conditioned-ranking.md):
  owns the accepted Phase 10 architecture.
- `CapabilityQueryInputV1`, `CapabilityQueryNormalizationResultV1`,
  `CapabilityRequestV1`, `RepositoryFingerprintV1`, `CandidateDossierV1`,
  `FitAssessmentRequestV1`, `FitAssessmentResponseV1`, deterministic profile,
  candidate-constraint, and Phase 9 retrieval contracts are reused without
  changing their meanings.

The future approved-query binding, bounded ranking-criterion binding,
evidence-needed resolution records, candidate evidence authority, and ranking
execution envelope are additive. Milestone 1 adds none of their schemas.

## Architecture, data-flow, and performance impact

### Future data flow

```text
approved query normalization + transmission approval
  -> authoritative CapabilityRequestV1 binding
  -> approved controlled ranking-criterion bindings
authoritative RepositoryFingerprintV1
accepted Phase 9 retrieval request/result
  -> eligible + evidence-needed candidates only
committed deterministic profiles + fit-consumable candidate evidence
  -> bounded CandidateDossierV1 set
explicit evidence-needed resolutions
  -> thin ranking execution envelope
  -> future pure @gitblocks/ranking
  -> authoritative FitAssessmentResponseV1 + execution/result digest
```

Milestone 1 changes documentation only and has no runtime, storage, latency,
memory, concurrency, timeout, retry, pagination, cost, or deployment effect.

### Exact Phase 9 handoff and binding

The future envelope authenticates one exact Phase 9 request/result and supplies
exactly the union of its eligible and evidence-needed identities as dossiers.
Eligible candidates may become recommended, viable, rejected, or
insufficient-evidence after target-specific assessment. Excluded candidates
never enter the envelope or output. Retrieval score/order remains provenance
only and cannot change a claim, disposition, comparison, or presentation.

Every evidence-needed unresolved evaluation has one and only one closure
record. The versioned record binds its evaluation/candidate, retrieval
request/result and digest, copied evaluation digest, policy, outcome
(`satisfied`, `conflict`, or `unresolved`), evidence/approved-validation
references, cutoff, source authority, any absence-completeness/freshness basis,
rule, and canonical digest. Satisfied may proceed to ordinary fit assessment;
conflict forces rejection; unresolved forces insufficient evidence and cannot
enter ranking. Missing documents, provider zeroes, retrieval metadata/score,
popularity, and model inference cannot prove absence.

The approved-query binding verifies the exact query input/digest,
normalization, family, success conditions, required/prohibited constraint
preservation, preferred-to-preference mapping, non-invention, candidate
references, scoped approval, and fingerprint binding. Approval happens
upstream; ranking verifies it.

The future bounded `ranking-criterion-binding/1.0.0` authority—final schema name
subject to M4 review—then provides exactly one record for every request success
condition and preference. Each record binds its criterion kind/ID; source query,
normalization, request, and approved-query binding IDs/digests; controlled
facet; concept/rule identity when available; bounded target-fact,
candidate-field, and evidence dependencies; approved semantic-binding
rule/version; deterministic-normalization, explicit-structured-approval, or
unbound provenance; success-condition materiality; and canonical digest.

Controlled facet/concept/rule/dependency values are nullable or empty only for
an explicitly unbound record. Current normalization preserves success-condition
statements but does not create controlled semantics, so preservation alone
cannot claim deterministic-normalization provenance.

Ranking never derives those semantics from statement prose. A normalized
preferred constraint may carry its controlled modality/facet/concept/source
and rule identities through the approved-query transition into its preference
binding. Other preferences require explicit upstream structured approval or
remain unbound. No preference becomes hard.

A success condition receives favorable coverage only through an accepted
controlled binding plus proving candidate evidence. An unbound success
condition cannot improve ordering; when material, or when approved
non-materiality is absent, every candidate and the responsible outcome remain
insufficient-evidence. Approved non-material unbound conditions remain
disclosed without independently forcing insufficiency. An unbound preference
cannot affect ordering and is disclosed as unresolved without independently
forcing rejection or insufficiency. User or application approval remains
upstream; ranking validates exact set/digest/approval closure and invents
nothing.

The evidence bridge pairs future profiles with committed fit-consumable
observations. A known field plus a versioned compatibility rule and resolvable
evidence may create a material claim and candidate reason; a hard conflict must
cite that evidence through existing assessment semantics. A value without
resolvable accepted evidence cannot create an externally meaningful claim or
conflict.

### Package ownership and dependency direction

The future package direction is:

```text
tools/evaluation-harness -> @gitblocks/ranking
@gitblocks/ranking -> @gitblocks/contracts -> @gitblocks/domain
@gitblocks/ranking ------------------------> @gitblocks/domain
```

Ranking does not import retrieval implementation; it accepts parsed retrieval
contracts. It has no persistence, ingestion, interview, evaluation, provider,
filesystem, network, environment, random, or ambient-clock dependency.

### Exact denominator decision

`ranking-execution-denominator/1.0.0` contains:

1. `catalog-role-status`
2. `capability-family`
3. `repository-identity`
4. `adoption-unit-type`
5. `capability-variants-features`
6. `language-ecosystem`
7. `package-identity-mapping`
8. `package-publication-version`
9. `runtime-package-format`
10. `framework-compatibility`
11. `datastore-requirements`
12. `required-infrastructure`
13. `optional-infrastructure`
14. `deployment-self-hosting`
15. `license-identity`
16. `archived-state`
17. `maintenance-activity`
18. `release-state-recency`
19. `security-advisory-state`
20. `security-policy-presence`
21. `package-repository-linkage`
22. `operational-complexity-primitives`

The first three plus `package-identity-mapping` are structural-only. The
remaining 18 are `ranking-decision-denominator/1.0.0`:

1. `adoption-unit-type`
2. `capability-variants-features`
3. `language-ecosystem`
4. `package-publication-version`
5. `runtime-package-format`
6. `framework-compatibility`
7. `datastore-requirements`
8. `required-infrastructure`
9. `optional-infrastructure`
10. `deployment-self-hosting`
11. `license-identity`
12. `archived-state`
13. `maintenance-activity`
14. `release-state-recency`
15. `security-advisory-state`
16. `security-policy-presence`
17. `package-repository-linkage`
18. `operational-complexity-primitives`

`repository-discovery-metadata`, `fork-upstream-state`,
`documentation-presence`, `test-ci-presence`, and
`artifact-chunk-availability` are unused in V1. There are no profile-registry
explanation-only fields in V1. ADR 0011 records the hard, comparative, and
uncertainty behavior for each consumed field.

### Current coverage and readiness

| Coverage class                       | Execution 22 fields / 3,300 cells | Decision 18 fields / 2,700 cells |
| ------------------------------------ | --------------------------------: | -------------------------------: |
| representable fields                 |                         22 (100%) |                        18 (100%) |
| extraction-capable fields            |                       12 (54.55%) |                       8 (44.44%) |
| fields with committed known values   |                        4 (18.18%) |                           0 (0%) |
| committed known cells                |                      600 (18.18%) |                           0 (0%) |
| deterministic not-applicable closure |                       210 (6.36%) |                      210 (7.78%) |
| human-reviewed structured cells      |                                 0 |                                0 |
| model-derived cells                  |                                 0 |                                0 |
| unknown cells                        |                    2,490 (75.45%) |                   2,490 (92.22%) |
| conflict cells                       |                                 0 |                                0 |
| ready deterministic fields           |                        4 (18.18%) |                           0 (0%) |

Deterministically extracted means an explicit, versioned, reproducible rule
generates a value from accepted bounded source authority without human or model
judgment in the generation step. Human-reviewed structured values may be
accepted product authority but do not count in that numerator. Model-derived
values never count. A field is ready only when every applicable catalog cell is
committed known or deterministically not applicable under accepted
freshness/version semantics. Unknown is never favorable.

The 70–80% gate applies to the 18 decision-bearing fields. Current readiness is
0/18 (0%). The only exact integer thresholds inside the inclusive band are
13/18 (72.222222%) and 14/18 (77.777778%); this correction does not choose
between them. M2 independent acceptance must freeze exactly one count/percentage,
denominator version, qualification rule, and policy digest before M3 begins and
before any M3 provider collection, generation, or coverage output is performed
or observed. The chooser cannot inspect M3 coverage first. Pre-freeze M3 output
is inadmissible and blocks M3 pending independent disposition.

Synthetic/frozen vertical-slice work may follow prior milestone acceptance, but
production quality cannot be claimed, the final benchmark cannot run, and
Phase 10 cannot close until the pre-frozen readiness gate passes. A later
threshold/denominator revision requires independently reviewed ADR change
before production output and cannot reinterpret historical evidence.

### Candidate evidence and authority boundary

M3 must publish committed ordinary-runtime authority for all 150 candidates:
selected consumed profile facts; `EvidenceObservationV1`-compatible records;
field/evidence/source bindings; authority/profile/dossier digests; cutoffs,
freshness and completeness; limitations and unknowns; and a pure projection to
valid `CandidateDossierV1` inputs. It must not rely on historical PostgreSQL.

It reuses accepted Phase 8 collection/projection behavior for these consumed
fields: `package-publication-version`, `runtime-package-format`,
`license-identity`, `archived-state`, `release-state-recency`,
`security-advisory-state`, `security-policy-presence`, and
`package-repository-linkage`. It does not redesign those rules without an
independently reviewed defect. It does not run Phase 8 execute #5 or revive the
Docker/ephemeral-database proof.

No current Phase 9 metadata becomes a decision fact. A new independently
reviewed deterministic rule may use accepted metadata only if its semantics and
completeness prove the exact consumed field—not to raise coverage.

### Request-conditioned ranking policy

The comparison hierarchy is hard constraints, success conditions, explicit
preferences, target-stack/infrastructure fit, general risk/evidence, then
unsupported trade-offs. Hard conflict forces rejection; unresolved hard state
forces insufficient evidence. Success-condition coverage requires an accepted
controlled criterion binding and favorable evidence. An unbound material
success condition forces insufficiency. Preferences affect ordering only
through approved controlled preference bindings and supporting evidence; they
never harden.

Pairwise dominance requires no worse supported evidence at the same or higher
priority and at least one justified better claim. Unprioritized trade-offs stay
incomparable. Equal supported evidence forms a tie. Broad facets are claim
groupings, not weighted scores.

The target facts eligible for controlled comparisons are language/runtime,
framework, package manager, database, ORM, dependencies, deployment topology,
worker/process/replica capability, region, identity facts, data-policy facts,
operational/resource availability, repository structure/capability facts, and
withheld-category markers. Withheld or unexpressible facts yield unknown, not a
negative or positive assumption. Product vocabulary must evolve additively
before a new comparison; pilot mappings never leak into product code.

### Evaluation and gate-setting protocol

M2 proposes 30 ranking-v1 cases, exactly six per supported family, without a
statistical-representativeness claim. They cover strong/poor fit, hard
conflict, insufficient evidence, no viable candidate, ties, incomparable
pairs, popularity-over-fit, withheld target facts, same-request/same-candidate
controlled target pairs, and all three evidence-needed transitions.

At least one reviewer independent of case/gold authoring reviews every case,
evidence reference, claim, conflict, disposition, outcome, tie/incomparable
relation, and controlled pair without product output. A non-author maintainer
adjudicates material disagreement. Then the manifest, gold, review record,
scorer, and gold-blind baselines freeze.

The fixed-candidate track measures ranking from an authoritative fingerprint,
fixed plausible candidates, and bounded evidence. The composition track starts
with a blind query and accepted Phase 9 retrieval and measures system handoff.
Reports keep their errors separate.

Gold-blind baselines are retrieval-order diagnostic, target-blind features,
weak target-aware compatibility, all-insufficient control, hard-conflict safety
negative control, and scorer-only synthetic oracle. Popularity/health is
included only if accepted bounded authority makes it safe. After these freeze,
independent reviewers set overall/family thresholds from exact case counts,
error budgets, and baseline observations before product output. Reports include
exact counts beside aggregates for top-three viability, pairwise agreement,
dispositions, outcomes, evidence/reason traceability, unknown disclosure,
no-viable and insufficient decisions, target controls, and evidence-needed
transitions. Numeric confidence remains deferred.

That same M2 acceptance selects either 13/18 (72.222222%) or 14/18
(77.777778%) as the decision-bearing deterministic-readiness minimum using only
the frozen denominator/readiness definition and independently reviewed
architecture and evaluation—not M3 candidate coverage. M3 is effect- and
output-blocked until the accepted policy commit exists.

Zero-tolerance gates cover candidate/excluded leakage, unresolved-hard
promotion, known-hard-conflict viability/recommendation, unsupported claims or
broken references, retrieval/popularity/ID/order use, query-intent weakening or
invention, free-text criterion interpretation, missing/extra/invented criterion
bindings, favorable unbound coverage, silent material-unbound omission,
authority mismatch, and evaluation-to-product dependency. Repeated calls,
candidate permutations, and fresh processes must be exact and byte-identical
under explicit time and canonical serialization.

### Maximum-result behavior

All supplied candidates receive a bounded assessment. Ranked presentation uses
the longest complete leading rank-group prefix that fits
`requestedMaximumResults`. If the next group crosses the limit, it and all
lower groups are omitted. If the maximal group alone crosses the limit, no
member is arbitrarily selected; acceptable candidates remain viable and
unranked. Input order, ID, retrieval score, popularity, or hidden weights never
break the tie.

### Performance protocol

Future ranking work is bounded to at most 20 candidates, 2,000 evidence
observations, 190 unordered pairs, and fixed per-candidate output bounds. M2
sets numeric p95/maximum latency, retained-memory, output, and operation gates
from maximum legal gold-blind fixtures before product output. The protocol uses
warmups, at least 1,000 measurements, 100 exact repeats, 20 permutations, and
ten fresh processes. Phase 9 numbers are not copied.

### Conditional model, interview, and infrastructure decisions

There is no V1 model or interview. A model experiment requires a frozen,
case/facet-isolated semantic miss that survives complete structured authority
and a separately authorized controlled experiment with safety, traceability,
latency, and cost gates. An interview experiment additionally requires the miss
to be attributable to interpreting already accepted bounded repository
artifacts; GitBlocks, not the model, resolves evidence references. A quality
miss alone triggers neither.

No migration, score/ranking table, index, vector/pgvector, embedding, cache, or
search service is authorized. Persistence requires an unmet durable product or
audit need; cache requires measured repeated-work SLO failure and safe
invalidation; vectors require the isolated semantic trigger and a passing
controlled experiment; a search service requires loss of the bounded handoff
or failure of frozen in-memory resource gates. Each requires a separate issue
and accepted ADR.

## Security, privacy, abuse, and supply-chain considerations

Candidate repository artifacts, metadata, evidence, documentation, and issue
content remain inert untrusted data, never instructions. No candidate code is
cloned, installed, imported, rendered, or executed. Product validation occurs
at every external, persisted, repository-derived, and future model boundary.

Ranking receives only the minimized approved fingerprint categories and
explicit approval binding. It never receives secrets, `.env` values,
credentials, unnecessary raw source, or unapproved/withheld categories.
Withheld categories remain explicit unknowns. The pure package has no tenant,
authentication, network, storage, webhook, provider, destructive-write, or
prompt boundary.

Evidence is bounded, attributable, cutoff-bound, and redacted under existing
product semantics. Negative claims require accepted completeness. Candidate
IDs and evidence IDs are validated, not executed. Exact authority/digest
binding prevents substitution. No new dependency, CI action, secret, provider,
or supply-chain surface is added in M1.

Residual M1 risk is documentation ambiguity. The independent review must check
that no prose claims the absent ranking implementation, authority, evidence,
quality, or service exists.

## Implementation milestones

### Milestone 1 — Governance and accepted architecture

Files are limited to Issue/PR metadata, this plan, ADR 0011, README,
product contract, and system context. Verify exact base and absence gates;
freeze boundaries, denominators, evidence bridge, query binding, algorithm,
evaluation/gate protocols, triggers, and later sequence; run documentation and
repository validation; commit/push normally; open a draft PR; stop for
independent review.

Exit: independent review accepts Issue #32, the plan, ADR, intended diff,
final correction-head hosted evidence or an explicitly adjudicated
infrastructure exception, and validation. Acceptance changes ADR 0011 to
accepted and authorizes M2 only. It does not accept ranking behavior or
authority. This exit was accepted at exact architecture commit
`6d43861ead6889f706c82b25fcd3d301acb6c4f3` under the hosted exception recorded
above.

### Milestone 2 — Independently reviewed ranking-v1 authority and gates

After M1 acceptance, add an additive 30-case ranking-v1 manifest/corpus, scorer
support, gold-blind baselines, independent review record, and frozen numeric
quality/performance gates. Six cases per family are a proposed start, not a
statistical-representativeness claim. Include every case class fixed in ADR
0011 and report exact errors/counts.

Freeze fixed-candidate and composition tracks separately. No production ranking
output may be observed before authority, review, scorer, baselines, and gates
freeze. Independently select and digest exactly 13/18 (72.222222%) or 14/18
(77.777778%) as the deterministic-readiness minimum without M3 coverage. M3
remains effect- and output-blocked until this complete policy is accepted.
Independent M2 acceptance authorizes M3 only.

Authoring status: complete and proposed in this commit. The proposed authority
contains 30 cases (six per family), scorer version
`ranking-v1-scorer/1.0.0`, frozen blind baseline specifications/predictions,
separate fixed-candidate and composition reports, gold-blind resource-reference
evidence, and independent gate-review inputs. Gold status is
`proposed-not-independently-reviewed`; the review record is
`independent-review-pending` with Codex as author and no independent reviewer.
Quality thresholds, production performance budgets, and the 13/18 versus 14/18
readiness selection are deliberately unset. This paragraph records proposed
authoring only and does not satisfy the M2 exit or authorize M3.

### Milestone 3 — Candidate-authority successor

After M2 acceptance, collect/project only accepted consumed facts and publish
the all-150 profile/evidence/dossier authority described above. Reuse accepted
Phase 8 machinery. Validate origin, freshness, completeness, known/unknown/N/A
cells, evidence resolution, negative claims, and both denominator reports.

Measure the authority only against the M2-frozen readiness policy and
independently accept the authority and result. If readiness remains below that
threshold, M4/M5 may only use synthetic/frozen authority; final production
measurement and closure remain blocked. The M3 team/process may not revise the
threshold after seeing coverage. M3 acceptance authorizes M4 only.

### Milestone 4 — Pure ranking vertical slice and execution envelope

After M3 acceptance, add the pure package and additive approved-query,
criterion-binding, retrieval-handoff, evidence-resolution, and
execution-envelope contracts. Start with conformance/authentication,
criterion-ID closure, hard-state preservation, maximum-result bounds,
deterministic identity, and a vertical slice against accepted synthetic/frozen
authority. Add negative and architecture tests. Independent acceptance
authorizes M5 only.

### Milestone 5 — Deterministic target-conditioned ranking

After M4 acceptance, implement request-conditioned compatibility claims,
bound success-condition/preference semantics, unbound-criterion fail-closed
behavior, evidence-backed dispositions/reasons, responsible outcomes, ties,
dominance, incomparability, and overflow behavior. Add pairwise, permutation,
monotonicity, traceability, withheld-data, and abuse tests. Independent
acceptance authorizes M6 only.

### Milestone 6 — Frozen proof and closure

After M5 acceptance and readiness, freeze product behavior. Run fixed-candidate
ranking and retrieval-to-ranking composition measurements separately, then the
zero-tolerance safety, determinism, latency, memory, bounded-work, authority,
and architecture proofs. Do not tune after observing output. Independent review
must accept exact counts, metrics, limitations, and every exit condition before
Phase 10 closes.

No automatic LLM or interview milestone exists. Any experiment is a separately
authorized successor under ADR 0011's trigger.

## Testing and validation strategy

### Milestone 1 validation

Working directory:
`/Users/karthikgudipati/Documents/Apps/gitblocks`. Environment: pinned Node
24.18.0 and pnpm 11.17.0; no provider credentials or database.

```bash
pnpm runtime:check
pnpm format:check
pnpm repo:check
pnpm verify
pnpm security:secrets
pnpm security:audit
git diff --check
git status --short --branch
```

Also inspect `git diff --stat`, `git diff --name-status`, `git diff`, the Issue,
branch/base, and draft PR metadata. No production ranking, evaluation,
collection, provider, model, or database command may run. If a validation
command modifies a tracked file, stop and report it.

### Later test authority

- M2: evaluation schema/manifest/case/gold/review/baseline validation, scorer
  unit fixtures, negative controls, oracle-only scorer validation, and exact
  corpus counts.
- M3: extraction/projection unit tests, source-origin and completeness tests,
  authority digest drift, all-150 coverage, evidence/dossier conformance, and
  negative absence proof.
- M4: schema/parser/domain mapping round trips, exchange conformance,
  unauthorized/missing/extra candidate failures, criterion-ID set closure,
  source/digest/provenance/approval validation, resolution closure, exact
  digest tests, dependency checks, and maximum bounds.
- M5: table/property tests over hard states, bound/unbound success conditions,
  normalized and explicitly approved preferences, no prose interpretation,
  target changes, unknown/withheld facts, ties, cycles, incomparability,
  overflow, candidate permutations, and evidence traceability.
- M6: frozen fixed and composition measurements, exact repeats/permutations/
  processes, latency/memory/bounded-work proof, and full repository validation.

Product conformance proves representability/mapping, not quality or acceptance
of gold. Product code remains blind to evaluation authority. Numeric confidence
calibration remains deferred.

## Observability and operations

M1 has no runtime path and adds no operation, trace, metric, log, event,
dashboard, alert, worker, retry, health check, SLO, or runbook.

The future pure package returns structured, bounded diagnostics in its result
envelope but does not export telemetry. A future application host—not Ranking
V1—will own correlated redacted telemetry for stable operation/error concepts
such as authority mismatch, unresolved evaluation, evidence insufficiency,
constraint conflict, and output-bound rejection. M4 must define these concepts
without adding a shared service.

## Migration, compatibility, rollout, and recovery

M1 changes documentation only. There is no migration, stored data, backfill,
feature flag, deployment, mixed-version runtime, irreversible step, or rollback
need. The proposed ADR can be revised before acceptance through ordinary review.

Later product contracts are additive and must retain V1 assessment semantics.
Canonical version/digest checks reject incompatible envelopes rather than
guess. Candidate authority is committed/versioned and forward-corrected; no
accepted authority is overwritten. Ranking remains in-process and unexposed
until final acceptance. Recovery is a forward contract/authority version or
revert of an unpublished implementation, never rewriting accepted evaluation
or decision history.

No persistence migration is planned. A new one requires the separately
reviewed durable-product trigger in ADR 0011.

## Exact exit criteria

### Milestone 1 exit

- Issue #32 is open and links this plan and proposed ADR 0011.
- Branch `feat/32-codebase-conditioned-ranking` has exact base
  `a6e03ef20a8cef2a39db8e66b91612245378f9db` and is pushed without rebase or
  force.
- Only authorized governance/boundary files change.
- The issue, plan, and ADR lock every Milestone 1 required decision.
- The approved-query and bounded criterion-binding architecture prevents any
  free-text success-condition/preference interpretation and fails closed for
  material unbound success conditions.
- The exact readiness threshold remains unchosen in M1 but is required to
  freeze as 13/18 or 14/18 during M2 acceptance before any M3 effect/output.
- README/product/system status remains honest: governance exists, ranking does
  not.
- Every M1 validation command exits successfully without tracked mutation.
- A draft PR is open, remains draft, and does not claim later work.
- All six repository-verification workers passed for exact correction head
  `6d43861ead6889f706c82b25fcd3d301acb6c4f3`; the aggregate's non-execution and
  billing/spending-limit failure are retained as a documented, independently
  accepted hosted-infrastructure exception rather than a passed check.
- Independent review has no unresolved material product, architecture,
  security, evaluation, or scope finding.
- The maintainer explicitly accepts M1 before M2 begins.

### Phase 10 exit

- all six milestones are independently accepted in sequence;
- the exact decision-bearing readiness count/percentage and policy digest froze
  in accepted M2 authority before any M3 candidate-authority effect or output;
- the decision-bearing denominator/readiness policy passes or ADR 0011 was
  independently revised before product output without reinterpreting historical
  evidence;
- all-150 ordinary candidate evidence can construct valid dossiers;
- the pure package and additive contracts preserve existing assessment and
  Phase 9 semantics;
- ranking-v1 authority/gates froze before output and product stayed gold-blind;
- fixed and composition measurements are separately reported;
- every quality threshold and zero-tolerance safety/determinism/resource gate
  passes with exact counts;
- no prohibited model/infrastructure/non-goal entered the phase; and
- documentation, recovery posture, hosted/local checks, independent closure,
  merge, and Issue completion are satisfied.

## Progress log

- [x] 2026-08-10 — Authenticated exact main/remote SHA, clean worktree,
      runtimes, PR #22 merge, Issue #21 completion, Phase 9 acceptance, and absence
      of competing Phase 10 issue/branch/package.
- [x] 2026-08-10 — Opened Issue #32 and created
      `feat/32-codebase-conditioned-ranking` from the exact accepted SHA.
- [x] 2026-08-10 — Found accepted retrieval-v2 ADR 0010; preserved it and
      selected proposed ADR 0011 for ranking.
- [x] 2026-08-10 — Authored only the five authorized governance/boundary files
      and completed the first full local validation pass.
- [x] 2026-08-10 — Published initial governance normally at
      `0b1ffc160be76a93b6a72c1fafa622d305a980ec`, opened draft PR #33, and
      stopped at independent M1 review.
- [x] 2026-08-10 — Natural hosted CI run `31415154596` passed all six ordinary
      workers and the aggregate `Verification` job for the initial publication
      head; the run was not rerun.
- [x] 2026-08-10 — Independent review accepted the direction and identified
      three required governance corrections: controlled criterion bindings,
      pre-M3 threshold freeze, and synchronized publication/final-CI state.
- [x] 2026-08-10 — Corrected only Plan 0032 and proposed ADR 0011, synchronized
      Issue #32, and completed the first correction-specific local validation
      pass without tracked mutation or M2 work.
- [x] 2026-08-10 — Independent maintainer review accepted Milestone 1 at exact
      architecture commit `6d43861ead6889f706c82b25fcd3d301acb6c4f3`,
      including the criterion-binding and readiness-timing corrections and the
      documented hosted-infrastructure exception. Publication of the
      bookkeeping descendant authorizes M2; no M2 work began in that commit.
- [x] 2026-08-10 — Authored the additive proposed ranking-v1 30-case authority,
      proposed gold/review record, scorer and fixtures, frozen gold-blind
      baselines, separate composition diagnostic, resource reference, and
      unselected gate-review inputs. Local independent-review handoff is
      complete; M2 remains unaccepted.
- [ ] M2 independently accepted.
- [ ] M3 independently accepted.
- [ ] M4 independently accepted.
- [ ] M5 independently accepted.
- [ ] M6 independently accepted and Phase 10 closed.

## Decision and deviation log

- 2026-08-10 — Use two versioned denominators: 22 execution fields and 18
  decision-bearing fields. Reason: structural authentication is necessary but
  cannot inflate adoption-fit readiness. Owner: Issue #32/M1 review.
- 2026-08-10 — Measure deterministic readiness by full-field extraction and
  closure, separately reporting cell states and human/model origins. Reason:
  unknown/N/A/human review cannot be averaged into deterministic extraction.
- 2026-08-10 — Pair profiles with committed fit-consumable evidence rather than
  treating profile values as claims. Reason: preserve existing fit-assessment
  evidence traceability. Owner: proposed ADR 0011.
- 2026-08-10 — Verify an approved query-to-request binding inside ranking but
  keep user review/approval upstream. Reason: preserve intent and trust
  boundaries. Owner: proposed ADR 0011.
- 2026-08-10 — Add an exact bounded criterion-binding authority between the
  approved CapabilityRequest and ranking. Reason: current success conditions
  and preferences are statement-bearing and provide no deterministic authority
  for interpreting arbitrary prose. Unbound material success conditions fail
  closed; unbound preferences cannot affect order. Owner: M1 independent
  review correction.
- 2026-08-10 — Move the exact readiness threshold choice from M3 to M2
  independent acceptance. Reason: 13/18 versus 14/18 must freeze before any M3
  collection, generation, or coverage observation so the gate cannot be chosen
  to fit results. Owner: M1 independent review correction.
- 2026-08-10 — Use request-conditioned partial order and complete-group
  presentation truncation. Reason: avoid hidden weights and fabricated top
  three. Owner: proposed ADR 0011.
- 2026-08-10 — Do not reuse current Phase 9 metadata for a decision-bearing
  field. Reason: its source language and retrieval prose lack the required fit
  semantics/completeness. Owner: M1 architecture review.
- 2026-08-10 — Deviation from requested ADR number: use ADR 0011, not ADR 0010.
  Reason: ADR 0010 is accepted retrieval-v2 authority and immutable accepted
  history. Issue #32 was corrected before documentation publication. Owner:
  repository authority.
- 2026-08-10 — Accept Milestone 1 at exact architecture commit
  `6d43861ead6889f706c82b25fcd3d301acb6c4f3`. Reason: independent maintainer
  review accepted the architecture and both corrections. Owner: repository
  maintainer.
- 2026-08-10 — Accept hosted run `31416900337` under the documented
  infrastructure-exception precedent. All six repository-verification workers
  passed; the aggregate retained `failure` because GitHub did not execute its
  compatibility work under an account billing/spending-limit condition. The
  aggregate is not relabeled as passed, and no rerun occurred. Owner:
  repository maintainer.
- 2026-08-10 — Conserve GitHub Actions for M2–M5. Use canonical local evidence,
  ordinary non-force publication, and `[skip actions]` on intended published
  implementation commits; do not weaken workflow or review requirements.
  Milestone 6 retains final hosted-proof/exception responsibility. Owner:
  repository maintainer.
- 2026-08-10 — Correct M2 baseline hard-conflict reason preservation before
  final freeze. The first local authoring pass used a generic candidate reason
  while the accepted request constraint had a specific reason code. The gold
  and weak target-aware baseline now preserve the request reason exactly, and
  all predictions/reports/digests were regenerated before review. Owner: M2
  authoring.
- 2026-08-10 — Retain manifest-first fail-closed scoring. The first local score
  attempt correctly refused newly generated predictions that were not yet
  bound by the manifest; authoring refreshed the manifest before scoring and
  preserved that denial. A content-audit false positive against aggregate
  reason-code metric names was narrowed to forbid case/candidate content while
  retaining required aggregate traceability counts. Owner: M2 authoring.

## Validation evidence

Pre-mutation gate evidence is recorded in **Verified current repository
state**. On 2026-08-10, the first complete local validation produced:

| Command                 | Exit/result                                                                                                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm runtime:check`    | `0`; pinned runtime preflight passed                                                                                                                                                                           |
| `pnpm format:check`     | `0`; all matched files use Prettier style                                                                                                                                                                      |
| `pnpm repo:check`       | first run `1`: the link checker intentionally sees only tracked/indexed targets and reported the new untracked plan/ADR; after staging exactly the five intended files, rerun `0`, repository checks passed    |
| `pnpm verify`           | `0`; 130 test files and 1,949 tests passed, zero dependency violations across 886 modules/3,016 dependencies, and all repository/evaluation/contract/taxonomy/profile/catalog/interview/pre-live checks passed |
| `pnpm security:secrets` | `0`; secretlint passed                                                                                                                                                                                         |
| `pnpm security:audit`   | `0`; no known vulnerabilities found at moderate audit level                                                                                                                                                    |
| `git diff --check`      | `0`; no whitespace errors                                                                                                                                                                                      |

At initial publication, the index contained only `README.md`,
`docs/product/product-contract.md`, `docs/architecture/system-context.md`, this
plan, and proposed ADR 0011. The formatter changed only the two newly authored
Markdown files. No validation command changed tracked content. The exact final
command set was rerun after this evidence entry and before the initial commit,
and publication state was verified separately without editing
product/evaluation/data files.

No ranking benchmark, provider/model call, candidate collection, database
command, or later-milestone validation ran.

Natural hosted evidence for initial publication head
`0b1ffc160be76a93b6a72c1fafa622d305a980ec` is CI run
[`31415154596`](https://github.com/kgudipati/gitblocks/actions/runs/31415154596):
workflow conclusion `success`, six of six ordinary workers `success`, and
aggregate `Verification` `success`, completed `2026-08-10T17:46:29Z`. It is
historical M1 publication evidence, not a substitute for natural CI on the
final correction commit.

### Milestone 1 independent-review correction validation

Before correction, local and remote branch heads were exactly
`0b1ffc160be76a93b6a72c1fafa622d305a980ec`, the worktree was clean, the merge
base remained `a6e03ef20a8cef2a39db8e66b91612245378f9db`, Issue #32 was open,
and PR #33 was open/draft/unmerged against that exact base. The first
correction-specific local validation on 2026-08-10 produced:

| Command                 | Exit/result                                                                                                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm runtime:check`    | `0`; pinned runtime preflight passed                                                                                                                                                                           |
| `pnpm format:check`     | `0`; all matched files use Prettier style                                                                                                                                                                      |
| `pnpm repo:check`       | `0`; repository checks passed                                                                                                                                                                                  |
| `pnpm verify`           | `0`; 130 test files and 1,949 tests passed, zero dependency violations across 886 modules/3,016 dependencies, and all repository/evaluation/contract/taxonomy/profile/catalog/interview/pre-live checks passed |
| `pnpm security:secrets` | `0`; secretlint passed                                                                                                                                                                                         |
| `pnpm security:audit`   | `0`; no known vulnerabilities found at moderate audit level                                                                                                                                                    |
| `git diff --check`      | `0`; no whitespace errors                                                                                                                                                                                      |

The correction diff digest was byte-identical before and after validation and
contains only this plan and proposed ADR 0011. No command changed tracked
content. The exact matrix is rerun after this evidence entry and before the
correction commit. No TypeScript, schema, evaluation corpus/authority,
candidate authority, package, provider/model, benchmark, database, migration,
dependency, merge, or Milestone 2 action occurred.

### Milestone 1 acceptance-bookkeeping validation

On 2026-08-10, acceptance bookkeeping began from a clean local/remote shared
branch at exact accepted architecture commit
`6d43861ead6889f706c82b25fcd3d301acb6c4f3`; both merge-base checks remained
the accepted base `a6e03ef20a8cef2a39db8e66b91612245378f9db`.

The first formatting check identified only expected Markdown wrapping in this
new plan text. The formatter changed this plan only as an intentional edit;
ADR 0011 was already formatted. The complete final validation matrix was then
run against the final formatted content:

| Command                 | Exit/result                                                                                                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm runtime:check`    | `0`; pinned runtime preflight passed                                                                                                                                                                           |
| `pnpm format:check`     | `0`; all matched files use Prettier style                                                                                                                                                                      |
| `pnpm repo:check`       | `0`; repository checks passed                                                                                                                                                                                  |
| `pnpm verify`           | `0`; 130 test files and 1,949 tests passed, zero dependency violations across 886 modules/3,016 dependencies, and all repository/evaluation/contract/taxonomy/profile/catalog/interview/pre-live checks passed |
| `pnpm security:secrets` | `0`; secretlint passed                                                                                                                                                                                         |
| `pnpm security:audit`   | `0`; no known vulnerabilities found at moderate audit level                                                                                                                                                    |
| `git diff --check`      | `0`; no whitespace errors                                                                                                                                                                                      |

The verification diff digest before and after `pnpm verify` was
`d1185fd6db0d2f97af1fccbdc0d8ef92cea22108a0fd1aee4b0d0e1ebf92c69e`; the
command changed no tracked content. The complete matrix is rerun once more
after this evidence entry and before the bookkeeping commit. Only this plan
and ADR 0011 change. No GitHub Actions request, rerun, or dispatch and no
product, evaluation, candidate-authority, provider/model, benchmark, database,
migration, dependency, or Milestone 2 action occurred.

### Milestone 2 proposed-authority validation

M2 authoring began from clean local and origin heads at exact authorized SHA
`06e6bdf26c0f4898f79d013891eb211ae484bcf1`. The accepted Phase 9 base
`a6e03ef20a8cef2a39db8e66b91612245378f9db` remained an ancestor; PR #33 was
open/draft/unmerged, Issue #32 was open, Node was `v24.18.0`, pnpm was
`11.17.0`, ADR 0011 and M1 were accepted, only M2 was authorized, and no
ranking product package, production command, candidate-authority successor,
provider collection, or workflow change existed.

The focused authoring validation produced:

| Command                       | Exit/result                                                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm eval:ranking:validate`  | `0`; exact 30-case corpus, six per family, proposed gold, independent review pending                                                                              |
| `pnpm eval:ranking:fixtures`  | `0`; 15 hand-calculated fixtures and 34 assertions passed                                                                                                         |
| `pnpm eval:ranking:baselines` | `0`; all five complete prediction sets reproduced from blind input in forward and reversed case order; frozen aggregate scores matched                            |
| `pnpm eval:ranking:verify`    | `0`; corpus/contracts/fixtures/baselines/composition/reports/effects passed; four ranking test files and eight tests passed; 902 modules/3,084 dependencies clean |
| `pnpm contracts:validate`     | `0`; historical 10-case/40-candidate and additive ranking-v1 30-case/150-candidate assessment mappings passed as proposed/not-reviewed representability only      |

The first full repository matrix exposed one stale CLI-output expectation in
the existing contract-conformance test after the additive ranking summary was
added. Only that evaluation test expectation was corrected; the corpus,
predictions, scores, and product contracts did not change. The focused rerun
then passed five files and ten tests. The complete post-correction local matrix
produced:

| Command                 | Exit/result                                                                                                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm runtime:check`    | `0`; pinned runtime preflight passed                                                                                                                                                                           |
| `pnpm format:check`     | `0`; all matched files use Prettier style                                                                                                                                                                      |
| `pnpm repo:check`       | `0`; repository checks passed                                                                                                                                                                                  |
| `pnpm verify`           | `0`; 134 test files and 1,957 tests passed, zero dependency violations across 902 modules/3,084 dependencies, and all repository/evaluation/contract/taxonomy/profile/catalog/interview/pre-live checks passed |
| `pnpm security:secrets` | `0`; secretlint passed                                                                                                                                                                                         |
| `pnpm security:audit`   | `0`; no known vulnerabilities found at moderate audit level                                                                                                                                                    |
| `git diff --check`      | `0`; no whitespace errors                                                                                                                                                                                      |

The staged M2 diff after this matrix had SHA-256
`91f89250b4699de6c5f2123a126d499273fbe69fbdfa6c436998f60ad25f51b0` before
this validation-evidence entry. Adding this record intentionally changes only
the plan. The complete matrix is rerun against the final staged bytes before
publication, with the final before/after digest recorded in the authoring
report.

All M2 commands were offline. Effect-denial and architecture tests prove no
network/provider/model/database/Docker/candidate-code or unauthorized-write
path. No production ranking output or M3 authority/effect/output occurred.
Final product-quality thresholds, the production performance budget, and the
13/18 versus 14/18 readiness choice remain unselected for independent review.
