# ADR 0011: Establish codebase-conditioned ranking

- Status: proposed
- Date: 2026-08-10
- Decision owners: GitBlocks maintainers
- Governing issue:
  [#32 — Phase 10: Establish codebase-conditioned OSS ranking](https://github.com/kgudipati/gitblocks/issues/32)
- Execution plan:
  [Phase 10 codebase-conditioned ranking](../../plans/0032-codebase-conditioned-ranking.md)
- Required base: `a6e03ef20a8cef2a39db8e66b91612245378f9db`
- Related decisions:
  [ADR 0003](0003-product-contract-kernel.md),
  [ADR 0007](0007-evidence-grounded-repository-interviews.md),
  [ADR 0008](0008-artifact-first-retrieval-foundation.md),
  [ADR 0009](0009-production-retrieval.md), and
  [ADR 0010](0010-reviewed-retrieval-v2-authority.md)

## Context

Phase 9 answers which OSS candidates are plausible enough to compare. Project
Phase 10 maps to Phase 12 — Ranking Engine V1 in the original end-to-end
strategy and must instead answer which retrieved candidate is a responsible
fit for this particular target repository and how the evidence justifies its
position relative to the other retrieved candidates.

The current repository already owns assessment semantics in
`FitAssessmentRequestV1` and `FitAssessmentResponseV1`. Those contracts
represent evidence, inferences, limitations, material unknowns, hard-constraint
conflicts, candidate dispositions, responsible outcomes, rank groups, rank
relations, and incomparable pairs. They deliberately do not require universal
repository scores or calibrated numeric confidence. Phase 10 will not create a
second recommendation model.

Phase 8 created a 27-field candidate-profile registry, a committed 150-profile
authority, explicit field states, and accepted effect-denied materialization
machinery for ten structured fields. The current committed authority has 600
known cells, 210 deterministic not-applicable cells, 3,240 unknown cells, and
no conflicts. Its 27-field registry is an audit denominator, not the set that a
ranking implementation must consume. In particular, structural identity
fields must not inflate adoption-fit readiness.

No committed all-150 `CandidateDossierV1` or fit-consumable evidence authority
exists. The historical Phase 7/8 database evidence and dossiers were ephemeral
and are unavailable by design. Repository interviews failed live calibration
and remain optional enrichment. Phase 9 succeeded without embeddings, vectors,
models, persistent search indexes, or a search service.

ADR number 0010 already belongs to the accepted retrieval-v2 decision. This
additive ranking decision therefore uses the next available number, 0011;
accepted history is not overwritten or duplicated.

## Decision

### Phase boundary and user-visible outcome

Phase 10 will establish a deterministic, model-free, transport-neutral Ranking
V1 that consumes an already-authoritative capability request, an
already-authoritative repository fingerprint, an exact bounded Phase 9 result,
and accepted candidate evidence. It produces the existing fit-assessment
response semantics: candidate-specific dispositions and reasons, responsible
outcome, material claims and unknowns, hard conflicts, and only the partial
order that the request, target facts, and evidence justify.

Ranking does not decide whether a project is broadly relevant enough to
compare. It does not reopen Phase 8 profile or Phase 9 retrieval quality to make
a ranking benchmark look better. It does not scan a target repository, collect
approval, retrieve candidates, plan an integration, edit code, measure adoption
outcomes, or deploy a service.

### Retrieval-to-ranking handoff

The future ranking execution envelope must authenticate one exact
`CandidateRetrievalRequestV1`/`CandidateRetrievalResultV1` exchange and retain
its policy, algorithm, authority, normalized-query, expansion, metadata,
catalog, and result bindings. The exact set of supplied candidate dossiers is
the union of the result's `eligibleCandidates` and `evidenceNeededCandidates`.
The envelope rejects missing, invented, duplicated, or extra candidate
identities.

- An `eligible` candidate may become `recommended`, `viable`, `rejected`, or
  `insufficient-evidence`. Eligibility establishes only that Phase 9 found no
  unresolved retrieval hard evaluation; deeper target-specific evidence can
  establish fit, conflict, or insufficiency.
- An `evidence-needed` candidate may reach any final disposition only through
  the explicit resolution closure below. It never inherits a positive
  assumption from retrieval.
- An excluded candidate never enters Phase 10. It cannot have a dossier,
  resolution, assessment, claim, reason, rank membership, rank relation, or
  incomparable relation in the response.
- `retrievalScore` and retrieval position remain authenticated provenance and
  diagnostics only. Neither contributes to a ranking criterion, material
  claim, disposition, tie break, or presentation order. Popularity cannot
  override target compatibility.

### Evidence-needed resolution closure

Every unresolved Phase 9 evaluation ID has exactly one resolution record,
bound to its candidate, retrieval result, ranking policy, evidence cutoff, and
evidence or validation references. Its outcome is exactly one of:

- `satisfied`: accepted evidence proves the hard evaluation satisfied;
- `conflict`: accepted evidence proves a hard conflict and forces rejection;
  or
- `unresolved`: the candidate remains `insufficient-evidence` and cannot be
  ranked, recommended, or marked viable.

A `satisfied` or `conflict` outcome may be grounded by exact immutable
evidence, an accepted deterministic snapshot or version-scoped authority whose
freshness and completeness semantics support the claim, or an approved
validation. Legitimate sources need not all be immutable.

Negative and absence claims require stronger closure: the cited authority must
define the complete relevant universe or closed set at the bound version and
cutoff, or an approved validation must test the absence directly. Silence,
missing documentation, popularity, retrieval score, model inference, and a
provider search zero without accepted completeness semantics cannot prove
absence. An unresolved outcome cannot be removed by omission.

The additive V1 resolution record contains exactly the resolution contract
version, unresolved evaluation ID, candidate ID, retrieval request/result IDs
and result digest, copied unresolved-evaluation digest, ranking policy version,
outcome, evidence references, approved-validation references, evidence cutoff,
source-authority bindings, completeness/freshness basis when absence is
asserted, resolution rule ID, and canonical resolution digest. `satisfied` and
`conflict` require at least one accepted evidence or validation reference;
`unresolved` retains the original unresolved evaluation and records why the
available authority cannot close it. The execution-envelope validator proves a
one-to-one set equality between unresolved evaluation IDs and resolution
records.

### Approved query to capability-request binding

User review and transmission approval remain upstream product/application
responsibilities and do not belong in `@gitblocks/ranking`. Phase 10 will add a
versioned `approved-query-capability-request-binding/1.0.0` record to its thin
execution envelope. Ranking receives and verifies the already-authoritative
state.

The record binds one `CapabilityQueryInputV1`, one normalized
`CapabilityQueryNormalizationResultV1`, one user-approved
`CapabilityRequestV1`, the applicable fingerprint identity/digest, and the
scoped transmission approval. Validation proves:

1. query-input ID and digest match the normalization input binding;
2. the normalization outcome is `normalized`;
3. the primary capability family is unchanged;
4. every success condition is preserved without invention;
5. required normalized and preserved constraints map to hard constraints
   without weakening or dropping their meaning;
6. prohibited normalized and preserved constraints map to hard constraints
   without weakening or dropping their meaning;
7. preferred constraints map only to approved preferences and are never
   upgraded to hard constraints;
8. no requirement or preference absent from the approved normalization is
   invented;
9. candidate-reference semantics and resolved identities remain consistent
   for comparisons or named candidates;
10. transmission approval exists, follows review, and scopes every transmitted
    category; and
11. the repository fingerprint ID and digest are preserved where the approved
    query state binds one.

The binding owns traceable source-to-request mappings. It does not change the
existing query, normalization, capability-request, or fit-assessment meanings.

### Ranking criterion binding

`CapabilityQuerySuccessConditionV1`, `CapabilityRequestV1` success conditions,
and `CapabilityRequestV1` preferences are statement-bearing records. The
current product contracts do not give Ranking V1 a deterministic semantic
interpretation for arbitrary statements. Ranking therefore never parses,
token-matches, or otherwise heuristically interprets success-condition or
preference prose.

Milestone 4 will review the final schema name and details for an additive,
bounded `ranking-criterion-binding/1.0.0` authority carried by the thin ranking
execution envelope. The authority has exactly one record for every
`CapabilityRequestV1` success-condition ID and preference ID and no extra
records. Each record binds:

- criterion-binding version and stable binding identity;
- exactly one success-condition ID, or one preference ID together with any
  normalized preferred-constraint source IDs;
- source query-input ID/digest, normalization ID/semantic digest,
  capability-request ID/digest, and approved query-to-request binding
  ID/digest;
- criterion kind: `success-condition` or `preference`;
- controlled facet, or `null` only when the record is unbound;
- controlled concept and normalization rule identities where available, or
  `null` only where the approved source supplies none;
- bounded target-fact dependencies where applicable;
- bounded candidate-profile-field and fit-consumable evidence-criterion
  dependencies where applicable;
- approved semantic-binding rule identity/version;
- provenance: `deterministic-normalization`,
  `explicit-structured-approval`, or `unbound`;
- upstream-approved recommendation materiality for a success condition, with
  absence of that approved classification failing closed as material; and
- canonical binding digest.

A normalized preferred constraint may retain its controlled modality, facet,
concept, canonical term, source constraint IDs, and normalization rule through
the approved query-to-request mapping into its preference criterion record. A
preferred preserved declaration without controlled semantics requires an
explicit upstream structured binding or remains unbound. A preference created
directly during approval likewise needs explicit structured binding or remains
unbound. None becomes a hard constraint.

The current normalizer preserves success-condition statements but does not
produce controlled success-condition semantics. Therefore current success
conditions cannot claim `deterministic-normalization` provenance merely because
their IDs/statements were preserved; they require explicit upstream structured
approval or remain unbound.

A success condition is favorably covered only when its record has accepted
controlled semantics and accepted candidate evidence proves those semantics.
An unbound success condition receives no favorable coverage and cannot improve
ordering. When it is recommendation-material—or when no approved non-material
classification exists—every candidate assessment remains
`insufficient-evidence` for the request and the responsible outcome is
`insufficient-evidence`; the condition is never ignored. An explicitly approved
non-material unbound condition remains disclosed but does not independently
force that outcome. An unbound preference cannot affect ordering and is
disclosed as an unresolved preference limitation/unknown; it does not become a
hard constraint or independently force rejection or insufficiency.

Explicit structured criterion creation/review and its transmission approval
remain upstream application responsibilities. `@gitblocks/ranking` verifies
source/digest closure, approval scope, exact criterion-ID set equality,
controlled dependencies, and binding provenance. It never invents a criterion,
collects approval, or assigns semantics from prose.

The authoritative request flow is therefore:

```text
CapabilityQueryInputV1
  -> CapabilityQueryNormalizationResultV1
  -> approved-query-capability-request binding
  -> unchanged authoritative CapabilityRequestV1
  -> approved ranking-criterion binding authority
  -> Ranking V1 verification and evidence evaluation
```

### Fit-assessment evidence bridge

Phase 10 chooses a committed, bounded candidate evidence authority paired with
the deterministic candidate-profile authority. The future candidate-authority
successor must publish fit-consumable `EvidenceObservationV1` records and exact
field-to-evidence bindings for every selected known or conflict value that may
affect a fit result. Existing structured-collection profile source references
and their evidence IDs are reused where compatible; profile schemas are not
duplicated merely to carry another citation shape.

The authoritative chain is:

```text
accepted DeterministicProfileField value
  + versioned request/target compatibility rule
  + resolved fit-consumable EvidenceObservationV1 references
    -> MaterialClaim
    -> CandidateReason
    -> HardConstraintConflict when applicable
```

Every externally meaningful material claim cites accepted product evidence.
Every candidate reason cites the supporting claim/evidence or explicitly
describes an inference, limitation, or unknown. Every hard-constraint conflict
cites the supporting evidence through the existing assessment semantics. A
profile value alone cannot ground a material claim or conflict when its source
does not resolve through the candidate evidence authority.

Unknown remains unknown and never contributes favorable direction. A profile
conflict is disclosed and ordinarily causes insufficiency unless accepted
evidence proves the request-level hard conflict. Model-authored citation
arithmetic is not evidence resolution.

### Versioned field denominators

The full 27-field registry remains the audit/planning authority. Ranking V1
freezes two narrower planning denominators before implementation.

`ranking-execution-denominator/1.0.0` contains 22 fields read for authority
authentication, identity closure, catalog/result consistency, execution safety,
or decision behavior. `ranking-decision-denominator/1.0.0` contains only the 18
fields whose values can change a disposition, hard-conflict result,
insufficient-evidence result, material-claim direction, comparative ordering,
or recommendation.

| Field ID                            | V1 classification                             | Decision use                                                                                          |
| ----------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `catalog-role-status`               | structural-only                               | Authenticate eligible catalog role and negative-control exclusion                                     |
| `capability-family`                 | structural-only                               | Authenticate request/result family consistency                                                        |
| `repository-identity`               | structural-only                               | Close catalog, retrieval, profile, evidence, and dossier identity                                     |
| `adoption-unit-type`                | decision-bearing hard/comparative             | Test requested library/service/hosted/self-hosted form and compare acceptable adoption forms          |
| `capability-variants-features`      | decision-bearing hard/comparative             | Test required/prohibited features and compare success-condition/preference coverage                   |
| `repository-discovery-metadata`     | unused in V1                                  | Retrieval-only metadata cannot establish adoption fit                                                 |
| `language-ecosystem`                | decision-bearing hard/comparative/uncertainty | Compare package ecosystem with target language/runtime and disclose absent compatibility evidence     |
| `package-identity-mapping`          | structural-only                               | Close package/repository identity without treating identity as quality                                |
| `package-publication-version`       | decision-bearing hard/uncertainty             | Test a request that requires a consumable package/version and disclose unknown publication state      |
| `runtime-package-format`            | decision-bearing hard/comparative/uncertainty | Test module/runtime compatibility and compare integration friction                                    |
| `framework-compatibility`           | decision-bearing hard/comparative/uncertainty | Test explicit framework constraints and supported target-framework fit                                |
| `datastore-requirements`            | decision-bearing hard/comparative             | Test database constraints and compare migration/data-model burden                                     |
| `required-infrastructure`           | decision-bearing hard/comparative             | Reject unavailable mandatory infrastructure and compare new required services                         |
| `optional-infrastructure`           | decision-bearing comparative                  | Compare evidence-backed optional dependencies against target availability/preferences                 |
| `deployment-self-hosting`           | decision-bearing hard/comparative             | Test deployment/topology/region constraints and compare supported operating modes                     |
| `license-identity`                  | decision-bearing hard/comparative             | Test license constraints and compare only request-approved license preferences                        |
| `archived-state`                    | decision-bearing hard/comparative/uncertainty | Reject when explicitly prohibited and support evidence-backed project-risk comparison                 |
| `fork-upstream-state`               | unused in V1                                  | No accepted request-conditioned comparison rule justifies using it                                    |
| `maintenance-activity`              | decision-bearing hard/comparative/uncertainty | Test explicit maintenance requirements and support evidence-backed risk comparison                    |
| `release-state-recency`             | decision-bearing hard/comparative/uncertainty | Test explicit release requirements and support evidence-backed freshness comparison                   |
| `security-advisory-state`           | decision-bearing hard/comparative/uncertainty | Test applicable known advisory conflicts and compare disclosed security risk                          |
| `security-policy-presence`          | decision-bearing hard/comparative/uncertainty | Test explicit policy requirements and otherwise support evidence confidence, not a security guarantee |
| `documentation-presence`            | unused in V1                                  | Presence alone is an unsafe proxy for integration fit                                                 |
| `test-ci-presence`                  | unused in V1                                  | Presence alone is an unsafe proxy for quality or compatibility                                        |
| `artifact-chunk-availability`       | unused in V1                                  | Artifact availability is evidence-operability metadata, not adoption fit                              |
| `package-repository-linkage`        | decision-bearing hard/uncertainty             | Test exact package/repository identity where required and fail closed on unresolved linkage           |
| `operational-complexity-primitives` | decision-bearing hard/comparative             | Test resource/worker/topology availability and compare integration/operational burden                 |

No registry field is explanation-only in V1. Explanations come from claims,
evidence, inferences, limitations, and unknowns; an unused proxy field is not
included merely to make prose richer.

#### Source-origin and deterministic-readiness definitions

- **Deterministically extracted** means an explicit, versioned, reproducible
  rule generates the value from accepted bounded source authority without
  human or model judgment in the generation step.
- **Human-reviewed structured** means a reviewer directly classifies or
  curates the value. It may become accepted product authority after review but
  does not enter the deterministic-extraction numerator unless a separate
  deterministic rule generates the value from accepted bounded source.
- **Model-derived** values never enter the deterministic-extraction numerator.

The readiness report separately records representable fields,
extraction-capable fields, fields with committed known values, known cells,
deterministic not-applicable closure, human-reviewed structured cells,
model-derived cells, unknown cells, and conflicts. Unknown is never favorable.

A field enters the readiness numerator only when an accepted deterministic
extraction rule exists and the committed authority has a known value or valid
deterministic not-applicable closure for every applicable candidate in the
measurement scope, with accepted freshness/version semantics. Partially closed
cells do not make an entire field ready.

#### Current baseline

The current 150-profile authority establishes this exact baseline:

| Measure                              | Execution denominator | Decision-bearing denominator |
| ------------------------------------ | --------------------: | ---------------------------: |
| fields                               |                    22 |                           18 |
| representable fields                 |          22/22 (100%) |                 18/18 (100%) |
| extraction-capable fields            |        12/22 (54.55%) |                8/18 (44.44%) |
| fields with committed known values   |         4/22 (18.18%) |                    0/18 (0%) |
| candidate-field cells                |                 3,300 |                        2,700 |
| committed known cells                |    600/3,300 (18.18%) |                 0/2,700 (0%) |
| deterministic not-applicable cells   |     210/3,300 (6.36%) |            210/2,700 (7.78%) |
| human-reviewed structured cells      |                     0 |                            0 |
| model-derived cells                  |                     0 |                            0 |
| unknown cells                        |  2,490/3,300 (75.45%) |         2,490/2,700 (92.22%) |
| conflict cells                       |                     0 |                            0 |
| currently ready deterministic fields |         4/22 (18.18%) |                    0/18 (0%) |

The four committed known structural fields are `catalog-role-status`,
`capability-family`, `repository-identity`, and `package-identity-mapping`.
The accepted Phase 8 materialization machinery makes ten structured fields
extraction-capable. Eight are decision-bearing:
`package-publication-version`, `runtime-package-format`, `license-identity`,
`archived-state`, `release-state-recency`, `security-advisory-state`,
`security-policy-presence`, and `package-repository-linkage`. Its other two
fields, `repository-discovery-metadata` and `fork-upstream-state`, are unused in
Ranking V1.

The original strategy's 70–80% expectation applies only to the accepted
decision-bearing denominator. The current committed authority is therefore at
0/18, or 0%, and is not ranking-ready. With an 18-field denominator, the exact
integer choices inside the inclusive 70–80% band are 13/18 (72.222222% at six
decimal places) and 14/18 (77.777778% at six decimal places). This ADR does not
select between them without independent evaluation authority.

Milestone 2 independent acceptance must freeze exactly one minimum ready-field
count and its corresponding percentage, the unchanged denominator version,
the field-readiness qualification rule, and a canonical policy digest. This
freeze occurs before Milestone 3 begins and before any M3 provider collection,
candidate-authority generation, or candidate-coverage output is performed or
observed. The people/process choosing the threshold may not inspect M3 coverage
first. Any pre-freeze M3 effect or output is inadmissible acceptance evidence
and blocks M3 pending independent disposition; it cannot be used to select the
more permissive threshold.

The pre-frozen readiness policy does not block a later pure vertical slice
tested against synthetic or frozen evaluation authority after prior milestone
acceptance. It does block a production-ranking quality claim, the final
production benchmark, and Phase 10 closure unless it passes. Any later
denominator or threshold revision requires an independently reviewed ADR change
before production ranking output is observed and creates forward authority; it
cannot silently reinterpret historical coverage evidence.

### Candidate-authority successor

Milestone 3 will own a separately reviewed successor for only accepted
decision-bearing V1 facts and the fit-consumable evidence needed to use them.
It must:

1. cover every candidate Phase 9 may return from the 150-candidate catalog;
2. reuse the accepted Phase 8 materialization contracts and pure projection for
   the eight consumed fields they already authorize, unless a demonstrated
   defect is reviewed first;
3. publish a committed deterministic-profile authority, bounded candidate
   evidence authority, source/version/freshness/completeness bindings,
   limitations, unknowns, field-to-evidence mappings, and deterministic
   digests;
4. allow an ordinary future request to construct a valid
   `CandidateDossierV1` for every returned candidate without a historical
   database;
5. publish only necessary consumed authority even when a provider response
   contains additional metadata; and
6. preserve exact accepted source data as inert, bounded, untrusted input.

It must not revive Phase 8 materialization execute #5, the old Docker Desktop
proof architecture, obsolete ephemeral PostgreSQL completion requirements, or
historical database recovery. The current Phase 9 metadata authority contains
useful retrieval descriptions/topics and source-language metadata but does not
safely establish an adoption ecosystem, framework compatibility, operational
requirements, or other decision-bearing fit fact. `primaryLanguage` is not
runtime compatibility, and descriptions/topics are neither complete nor fit
evidence. A future reviewed projection could deterministically populate the
unused `repository-discovery-metadata` field, but Phase 10 will not do so to
inflate coverage.

### Request-conditioned comparison hierarchy

Ranking V1 uses no universal repository score, additive weights, or numeric
confidence. It derives candidate claims from the approved request, target
facts, and accepted evidence, then compares candidates in this order:

1. hard constraints;
2. success-condition coverage;
3. explicit user preferences and normalized preferred constraints;
4. target-stack and infrastructure fit;
5. general risk and evidence facets; and
6. unsupported trade-offs.

Known hard conflicts force rejection. Unresolved hard evaluations force
insufficient evidence. A success condition is covered only by an accepted
controlled criterion binding and a favorable material claim with
fit-consumable evidence; unknown or unbound coverage does not count. A material
unbound success condition forces insufficiency. An explicit preference may
affect ordering only when its approved controlled binding and candidate
evidence establish a direction, and it never becomes a hard constraint.

Within the hierarchy, pairwise dominance requires one candidate to be no worse
on every supported criterion of the same or higher priority and better on at
least one supported criterion, without a conflicting higher-priority claim.
Request-declared priority or preference can resolve a comparison; hidden
weights cannot. Cross-criterion trade-offs that the request does not prioritize
remain incomparable. Equal supported claims form a rank-group tie. Pairwise
relations are transitively validated, and only justified partial ordering is
emitted.

The nine original strategy facets—capability fit, target-stack compatibility,
operational burden, project health, security posture, license compatibility,
integration effort, reversibility, and evidence confidence—remain descriptive
claim groupings, not global score columns. Capability fit is driven by hard
constraints and success conditions. Target-stack and operational/integration
fit use candidate facts against target facts. Health, security, license,
reversibility, and confidence contribute only where accepted evidence and
request relevance support a material direction. Unsupported facets remain
unknown and cannot be averaged away.

| Facet                      | V1 criterion support                                                                                 | Current authority posture                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| capability fit             | hard constraints, success conditions, `capability-variants-features`, `adoption-unit-type`           | structurally representable; decision facts/evidence missing                             |
| target-stack compatibility | language/runtime/framework/package/datastore/deployment facts against the fingerprint                | partially extraction-capable; no committed decision cells                               |
| operational burden         | required/optional infrastructure and operational-complexity primitives against available resources   | representable; structured candidate authority missing                                   |
| project health             | archived, maintenance, and release claims only when request-relevant and evidence-backed             | archived/release extraction-capable; committed evidence missing                         |
| security posture           | applicable advisory, policy, target data/identity constraints, limitations, and unknowns             | advisory/policy extraction-capable; no complete general security score                  |
| license compatibility      | license identity against an explicit hard constraint or preference                                   | extraction-capable; committed values/evidence missing                                   |
| integration effort         | package format, framework, datastore, infrastructure, deployment, and target dependency interactions | partially representable; no universal effort number                                     |
| reversibility              | evidence-backed hosting/data-migration/operational lock-in claims when material to the request       | partially representable through deployment/data/infrastructure facts; otherwise unknown |
| evidence confidence        | qualitative source, cutoff, freshness, completeness, limitation, inference, and unknown semantics    | supported by existing dossier/assessment semantics; no numeric confidence               |

### Target-codebase conditioning

Ranking receives an already-authoritative `RepositoryFingerprintV1`; Phase 10
does not implement the scanner. Versioned compatibility rules may consume:

- language, runtime, framework, package manager, database, ORM, and dependency
  facts for package/runtime/framework/data compatibility;
- deployment topology, worker capability, replica/process constraints, region,
  and available infrastructure for hosting and operational compatibility;
- repository structure and capability facts for integration touchpoints;
- identity-provider facts for authorization integration;
- data-policy facts for storage, egress, retention, and regional constraints;
- operational and resource-availability facts for required services, workers,
  and burden; and
- withheld-category markers, which yield unknown or insufficient evidence and
  never favorable fit.

Where existing controlled vocabularies cannot express a comparison, a later
milestone must evolve the product vocabulary additively before using that fact.
Pilot-v1 mapping tables remain evaluation-only and may not be imported or
copied into product ranking logic.

### Package and contract ownership

Milestone 4 may add one pure `@gitblocks/ranking` package. It may depend only on
`@gitblocks/contracts` and `@gitblocks/domain`. It will not depend on
`@gitblocks/retrieval`; the versioned retrieval contract is the handoff. Domain
keeps no outward workspace dependency. Contracts depend on domain. Evaluation
tooling may depend on ranking through an adapter; ranking never depends on
evaluation tooling, cases, gold, scorer code, persistence, ingestion,
interviews, or application adapters.

The package owns deterministic orchestration and comparison only. It does not
own HTTP, MCP, authentication, persistence, provider/model calls, local
scanning, approval UI, integration planning, code editing, telemetry export, or
deployment.

`FitAssessmentRequestV1` and `FitAssessmentResponseV1` remain authoritative and
unchanged. An additive thin ranking execution envelope will bind the approved
query transition, exact criterion-binding authority, exact retrieval exchange,
exact target fingerprint, supplied dossiers, profile and evidence authorities,
evidence-needed resolutions, evidence cutoff, assessment time, algorithm and
policy versions, and canonical input/output digests. Canonical identity is used
for authentication and byte stability, never comparative preference.

### Requested maximum results

The complete response assesses every supplied candidate, subject to the
existing request bounds. The ranked presentation mentions no more than
`requestedMaximumResults` candidates across rank groups, rank relations, and
incomparable pairs.

The engine emits the longest justified leading sequence of complete rank
groups whose total membership fits the limit. If the next group would cross the
limit, the engine omits that group and every lower group from the ranked
presentation. If the maximal/nondominated group itself is larger than the
limit, the presentation contains no arbitrary subset: those acceptable
candidates remain `viable` and unranked, with their assessments and unknowns
retained. Candidate ID, retrieval position/score, popularity, hidden weights,
or incidental input order can never manufacture a top three.

### Evaluation and acceptance authority

`pilot-v1` remains immutable historical proposed authority. Ranking V1 uses a
new additive `ranking-v1` manifest/corpus and may reuse existing fixed-candidate
schema meanings only where they are already sufficient. Any schema evolution
is additive. Product code remains blind to cases, gold, baseline outputs,
scorer internals, thresholds, and review records.

The proposed starting corpus is 30 cases, six per supported capability family.
It is not claimed statistically representative. Reports include exact
case/error counts beside aggregates. The corpus includes strong and poor fit,
hard conflicts, insufficient evidence, no viable candidate, explicit ties,
explicit incomparable pairs, popularity-over-fit cases, withheld target facts,
controlled same-request/same-candidate target pairs, and
evidence-needed-to-satisfied/conflict/unresolved transitions.

Two tracks remain separate:

1. fixed-candidate ranking uses an authoritative fingerprint, fixed plausible
   candidate set, and bounded evidence to measure ranking; and
2. retrieval-to-ranking composition starts with a blind capability query and
   accepted Phase 9 retrieval to measure handoff and end-to-end composition.

Retrieval misses are not charged to fixed-candidate ranking, and lucky
retrieval order does not earn ranking credit.

Before gold becomes acceptance authority, at least one reviewer who did not
author the cases or gold inspects every input, evidence reference, claim, hard
conflict, disposition, outcome, tie, incomparable pair, controlled-pair
relation, and stable identity without viewing production ranking output. Any
material disagreement is adjudicated by a maintainer who did not author the
disputed gold, and both disagreement and disposition are recorded. The
manifest, gold, review record, scorer, and gold-blind baselines then freeze.

Gold-blind baselines include retrieval order as a diagnostic, a target-blind
candidate-feature baseline, a weak target-aware compatibility baseline, an
all-insufficient safety control, a deliberate hard-conflict-violating negative
control, and a synthetic oracle only for scorer validation. A popularity or
health baseline is included only if safely representable from accepted bounded
authority; otherwise its omission is explicit.

After corpus, review, scorer, and baselines freeze—but before production output
is observed—independent reviewers set overall and family thresholds using
baseline results, corpus error budgets, and exact case counts. No arbitrary
percentage is selected in this ADR. Zero-tolerance safety gates are independent
of quality thresholds.

The same Milestone 2 independent acceptance also freezes the decision-bearing
deterministic-readiness minimum as either 13/18 (72.222222%) or 14/18
(77.777778%). It uses only the frozen denominator, readiness definition, and
independently reviewed ranking architecture/evaluation authority—not M3
candidate coverage. M3 has no authorized effect or output until that policy
commit is accepted.

Ranking metrics cover top-three viable-candidate rate, accepted pairwise
agreement, candidate dispositions, responsible outcomes, hard-conflict
violations, evidence and reason traceability/recall, material-unknown
disclosure, appropriate no-viable and insufficient-evidence decisions,
controlled-pair target conditioning, and every evidence-needed transition.
Numeric confidence calibration is deferred until a larger independently
reviewed calibration authority exists.

### Safety, determinism, and bounded work

Zero-tolerance acceptance gates require:

- zero candidate invention, excluded-candidate leakage, identity/authority
  mismatch, and out-of-scope candidate assessment;
- zero silent promotion of an unresolved hard evaluation;
- zero known hard-constraint recommendations or viability claims;
- zero unsupported material claims/conflicts and zero broken evidence/reason
  references;
- zero use of retrieval score, popularity, candidate ID, or input order as fit
  evidence or a tie break;
- zero weakening/dropping of approved hard constraints and zero invention or
  hardening of preferences;
- zero free-text interpretation, unapproved invention, missing/extra criterion
  binding, favorable unbound-criterion coverage, or silent omission of a
  material unbound success condition;
- exact evidence cutoff, request, fingerprint, retrieval, candidate authority,
  criterion authority, algorithm/policy, and result identity binding; and
- zero product dependency on evaluation cases, gold, scorers, or tools.

Determinism gates require byte-identical repeated calls, invariance under all
registered candidate-order permutations, identical fresh-process results, an
explicit caller-supplied assessment time, canonical serialization, and no
ambient clock/random/network/database/model dependency.

Ranking remains bounded by Phase 9's current maximum of 20 supplied candidates,
at most 2,000 evidence observations, at most 190 unordered candidate pairs,
bounded claim/reason/unknown output per candidate, and no work proportional to
the 150-candidate catalog during ranking. Milestone 2 sets p95, maximum latency,
retained-memory, output-size, and operation-count thresholds from maximum legal
gold-blind fixtures before production ranking output is observed. The protocol
uses warmups, at least 1,000 measured calls, 100 repeated-result rounds, 20
registered permutations, and ten fresh processes. Phase 9 latency values are
not copied.

### Conditional model, interview, and infrastructure triggers

Ranking V1 has no model or repository-interview path. A separately authorized
successor may run a controlled model experiment only when a frozen
deterministic system has a measured, case/facet-isolated quality failure; all
available structured authority is complete for that failure; the miss is
plausibly semantic rather than missing evidence; and a preregistered experiment
has safety, traceability, latency, and cost gates. A miss alone is insufficient.
Repository interviews have a separate trigger: a frozen deterministic miss is
isolated to semantic interpretation of already accepted bounded repository
artifacts, complete structured evidence cannot correct it, and a preregistered
replay experiment can compare interview enrichment against the deterministic
system on those exact cases under evidence, safety, traceability, latency, and
cost gates. If triggered, GitBlocks resolves deterministic evidence references
and the model does not author citation arithmetic. Neither trigger authorizes
an experiment without a separate governing issue and accepted plan/ADR.

No migration, ranking/score table, persistent index, vector/pgvector,
embedding, cache, or search service is authorized. Reconsideration requires a
separate issue and ADR after one of these measured triggers:

- persistence: a durable product/audit requirement cannot be met by the
  caller-owned result and existing evidence persistence;
- cache: repeated identical work violates the frozen latency/resource gate at
  measured traffic and safe invalidation is defined;
- vectors/embeddings: a diagnosed semantic comparison failure survives
  complete structured authority and a controlled model/vector experiment
  passes its gates; or
- search/index service: the bounded Phase 9 handoff no longer bounds ranking or
  in-memory ranking fails the preregistered resource gate.

### Milestone authority sequence

1. **Milestone 1 — Governance and accepted architecture.** Publish Issue #32,
   this plan and proposed ADR, and bounded status documentation. Independent
   acceptance is required before Milestone 2.
2. **Milestone 2 — Ranking evaluation authority.** Independently review and
   freeze ranking-v1 cases/gold, scorer additions, gold-blind baselines, numeric
   quality gates, performance/resource gates, and the exact 13/18 or 14/18
   deterministic-readiness minimum. Accept that policy before any Milestone 3
   effect or output.
3. **Milestone 3 — Candidate-authority successor.** Publish only accepted V1
   consumed facts and the fit-consumable evidence authority, then measure it
   only against the pre-frozen readiness policy. Independently accept
   coverage/readiness evidence before Milestone 4.
4. **Milestone 4 — Pure vertical slice.** Add the pure ranking package and
   additive execution envelope and criterion-binding contract, initially
   testable against synthetic/frozen authority. Independent acceptance is
   required before Milestone 5.
5. **Milestone 5 — Deterministic target-conditioned behavior.** Add
   verified bound preference/success-condition handling, fail-closed unbound
   behavior, dispositions, evidence-grounded claims, responsible outcomes, and
   partial ordering. Independent acceptance is required before Milestone 6.
6. **Milestone 6 — Frozen proof and closure.** Run the separately reported
   fixed-candidate and composition measurements and safety, determinism,
   performance, memory, readiness, and architecture proofs. Independent closure
   is required.

There is no automatic model or repository-interview milestone. The governance
branch authorizes only Milestone 1 documentation.

## Consequences

- Fit-assessment semantics remain stable while Phase 10 adds exact provenance
  and handoff bindings.
- Success conditions and preferences affect ranking only through approved
  controlled criterion bindings; arbitrary request prose remains inert.
- Adoption fit is target- and request-conditioned; retrieval relevance,
  popularity, and identity cannot silently become ranking signals.
- Partial orders expose ties and incomparability rather than false numeric
  precision.
- Candidate evidence, not profile values alone, must ground externally
  meaningful claims and conflicts.
- The accepted 27-field registry remains intact while readiness is measured
  honestly against 18 decision-bearing fields.
- Current candidate authority is not production-ranking-ready; Milestone 3 is
  real work, not recovery of a historical database.
- A pure implementation may be tested before final readiness, but Phase 10
  cannot claim production quality, run its final benchmark, or close until the
  readiness policy passes or this ADR is independently revised before output.
- No infrastructure, model, provider, database, evaluation corpus, or product
  implementation is created by Milestone 1.

## Rejected alternatives

- Reusing ADR number 0010: it would overwrite accepted retrieval-v2 history.
- Treating all 27 profile fields or all 22 execution fields as decision-bearing:
  structural fields would inflate readiness and unused proxies would distort
  architecture.
- Counting human-reviewed or model-derived values as deterministic extraction:
  reproducibility and source origin would be misstated.
- Emitting claims directly from profile values: this would break accepted
  fit-assessment evidence traceability.
- Letting ranking collect user approval: approval belongs upstream and would
  mix trust boundaries.
- Parsing success-condition or preference prose in Ranking V1: current
  statement-bearing contracts provide no deterministic semantic authority.
- Selecting the 13/18 versus 14/18 readiness minimum after observing M3
  coverage: this would make the closure gate outcome-conditioned.
- Additive weighted scores or numeric confidence: current authority cannot
  calibrate the precision or justify hidden trade-offs.
- Truncating a maximal set by retrieval order, popularity, or ID: this would
  fabricate a preference the evidence does not support.
- Mandatory interviews, LLM reranking, vectors, persistence, or a search
  service: no current requirement or accepted trigger justifies them.
