# ADR 0008: Artifact-first deterministic retrieval foundation

- Status: accepted
- Date: 2026-08-03
- Decision owners: GitBlocks maintainers
- Governing issue:
  [#19 — Phase 8: Establish artifact-first taxonomy, query normalization, and
  retrieval evaluation](https://github.com/kgudipati/gitblocks/issues/19)
- Execution plan:
  [Phase 8 artifact-first deterministic retrieval foundation](../../plans/0019-artifact-first-retrieval-foundation.md)
- Related decisions:
  [ADR 0001](0001-agent-native-delivery.md),
  [ADR 0002](0002-typescript-workspace-and-toolchain.md),
  [ADR 0003](0003-product-contract-kernel.md),
  [ADR 0004](0004-postgresql-evidence-persistence.md),
  [ADR 0005](0005-public-repository-ingestion.md),
  [ADR 0006](0006-immutable-repository-artifacts.md), and
  [ADR 0007](0007-evidence-grounded-repository-interviews.md)

Milestone 1 and this decision were accepted at commit
8679461bb7b4eb356ffec7c5e36f0e7ef5ea9eb8 after hosted CI run 30860512727
completed successfully.

## Context

Phases 5 and 6 established a curated 150-candidate catalog, deterministic
evidence profiling, exact immutable repository artifacts, and lossless
line-addressable chunks. Phase 7 retained its interview engine and fail-closed
evidence infrastructure, but live calibration failed and published no
repository interview.

The final Phase 7 decision removes successful interview generation from the
critical path:

> Interview engine retained; live calibration failed; repository interviews
> deferred; Phase 8 proceeds artifact-first.

The current catalog has five coarse capability-family identifiers, but no
controlled hierarchy of variants, features, infrastructure, deployment, or
compatibility concepts. CapabilityRequestV1 begins after a capability family
and structured request have already been established. It is not a local
pre-contract query-admission record.

CandidateDossierV1 retains attributable deterministic observations,
limitations, and unknowns. Most adoption facts remain observation prose rather
than closed candidate fields. RepositoryFingerprintV1 describes a minimized
target codebase and cannot be reused as candidate authority. Repository
interviews are model-generated synthesis and cannot populate deterministic
facts.

The investigation froze a 27-field planning denominator and found that
representability, implemented extraction, known values, hard-filter readiness,
and broad-retrieval readiness are materially different measurements. Counting
an unknown field as extracted would conceal the missing authority.

Retrieval quality must be evaluated before a production retrieval or ranking
service is implemented. Existing pilot-v1 gold evaluates fixed-candidate
repository-conditioned fit; repository-interviews-v1 evaluates interview
quality. Neither is retrieval/query gold.

## Decision

### Project Phase 8 boundary

The original strategy separates:

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

Production retrieval and production ranking remain later phases. Phase 8 adds
no API, MCP, scanner, deployment, recommendation path, vector search,
embedding, or reranker.

### Contract ownership and sequence

Use the provisional additive product-contract names:

- CapabilityQueryInputV1;
- CapabilityQueryNormalizationResultV1; and
- DeterministicCandidateProfileV1.

The local query sequence is:

```text
CapabilityQueryInputV1
  -> CapabilityQueryNormalizationResultV1
  -> user review and transmission approval
  -> CapabilityRequestV1
```

CapabilityQueryInputV1 is bounded local pre-contract input. It is not a second
adoption-request domain model. It may retain bounded original terminology,
explicit draft requirements, preferences and prohibitions, exact candidate or
brand references, and an optional minimized repository-fingerprint reference.
It retains no secret, raw source, configuration value, environment value,
command output, or transcript.

CapabilityRequestV1 remains post-normalization approved request authority.
RepositoryFingerprintV1 remains minimized target-codebase authority.
CandidateDossierV1 remains evidence observations, limitations, and unknowns.
RepositoryInterviewV1 remains optional, unselected semantic enrichment.
FitAssessmentRequestV1 remains a fixed-candidate fit-assessment request.

None of those existing roots is replaced, widened, or reinterpreted.

Normalization occurs locally before transmission approval. It preserves:

- required;
- preferred;
- prohibited;
- unknown; and
- clarification-needed.

Every normalized constraint retains its input source identity and deterministic
rule identity. Alias resolution or inference never weakens a hard constraint.

Exact DTO shapes, bounds, canonical projections, and concept IDs remain
implementation decisions for Milestones 2–4. Their semantic ownership and
sequence are accepted here; their code-level validity is not presumed by this
proposed documentation decision.

### Deterministic candidate profiles

DeterministicCandidateProfileV1 is candidate-owned structured deterministic
authority. Every profile value eventually retains:

- controlled field or taxonomy concept identity;
- value state;
- candidate ownership;
- candidate-wide or version-specific scope;
- extraction rule and version;
- source, evidence, or artifact references;
- freshness or immutable snapshot identity;
- deterministic identity and record digest behavior; and
- deterministic conflict and absence behavior.

The minimum value states are:

- known;
- unknown;
- not-applicable; and
- conflict.

A known value cannot be obtained by parsing a
CandidateDossierV1.observation statement. Repository-interview output cannot
populate deterministic profile authority.

Curator-owned classifications remain explicitly curator authority. They cannot
masquerade as provider-derived or artifact-derived facts. Known runtime,
framework, datastore, infrastructure, deployment, license, lifecycle, and
security facts cannot be hand-authored to increase coverage.

### Coverage authority

Retain the investigation's 27-field inventory as:

deterministic-profile-coverage/1.0.0

It is an audit and planning denominator, not automatically the exact serialized
shape of DeterministicCandidateProfileV1 and not yet the permanent initial
ranker denominator.

Coverage reports always separate:

- field representability;
- fields with implemented deterministic extraction rules;
- fields populated with known values;
- candidate-population coverage per field;
- family-level population coverage;
- hard-filter readiness;
- broad-retrieval readiness; and
- later ranking-only coverage.

Representing unknown does not count as deterministic extraction coverage.

The original 70–80% deterministic target remains a later launch/readiness gate
measured against fields actually consumed by the initial ranker. It cannot be
claimed by representing all 27 planning fields.

### Candidate constraint epistemic state

Candidate constraint evaluation is tri-state:

- satisfied;
- conflict; and
- unresolved.

Unresolved is neither satisfied nor conflict. It does not pass viability and
cannot be recommended. A future retrieval contract may preserve it only in a
separately typed evidence-needed lane with exact unresolved constraints
disclosed, so broad recall is not silently converted into false certainty.

### Controlled taxonomy

V1 canonical concept IDs and canonical lookup aliases are ASCII-only. Unicode
may appear only as bounded presentation labels.

Hard-constraint lookup does not use:

- fuzzy matching;
- transliteration;
- NFKC-based semantic merging; or
- confusable folding.

Mixed-script or confusable lookup terms become unknown or
clarification-needed.

Validation fails on alias collision, accidental ambiguity or term-class
overlap, missing parent, graph cycle, deprecated alias reuse, excessive depth,
or nondeterministic traversal.
Taxonomy versions and digests bind historical normalization.

Taxonomy `1.0.0` implements five closed concept kinds: family, architecture,
feature, infrastructure, and deployment. It uses a parent forest bounded to
eight levels, with cross-family applicability represented once through exact
family memberships. Authority is split into reviewed source and one generated,
canonically ordered manifest. Its semantic digest covers contract version,
taxonomy version, concepts, aliases, ambiguities, and exclusions; only the
digest field itself and explicit non-semantic release metadata are excluded.

Intentional ambiguity is a separate valid record class. One ASCII key names
two or more exact active possible concepts plus a stable clarification reason
and bounded context. It never resolves through declaration order. Resolved,
ambiguous, and excluded keys are disjoint. Milestone 2 exact lookup may return
ambiguous but does not implement the Milestone 3 query flow that turns it into
clarification-required.

Catalog negative controls are excluded from normal candidate generation and
ordinary retrieval baselines by default. They may appear only in explicitly
marked negative-control evaluation, hard-filter safety, false-positive, or
catalog-integrity cases.

Security-policy presence is a ranking/explanation facet by default. It becomes
a hard-filter facet only when the normalized user request explicitly requires
a published security policy. Failure to detect a policy does not prove absence
of a security process.

Lightweight is not an authoritative taxonomy concept or opaque
operational-complexity score. It requires clarification or user-confirmed
decomposition into explicit controlled preferences. No infrastructure or
deployment preference is inferred when the user did not state or confirm it.

### Independent retrieval evaluation

Create a separate retrieval-v1 authority containing exactly:

- 30 retrieval cases, 6 per capability family; and
- 20 normalization, clarification, and adversarial cases, 4 per family.

The retrieval cases own blind query inputs, hard constraints, relevance grades
0–3, positive and valid no-result cases, duplicate/fork/equivalence metadata,
and reviewer provenance.

The normalization/adversarial cases own exact terms and aliases, ambiguity,
conflicting modalities, unsupported categories, unclear self-hosting,
subjective terms, brand comparisons, Unicode/confusable inputs, and
clarification expectations.

Normalization gold, clarification gold, hard-filter expectations, relevance
judgments, equivalence metadata, and no-result expectations remain physically
and semantically separate. Ranking judgments are prohibited.

Do not hand-author a 50 by 150 hard-filter label matrix. Expected membership is
generated deterministically from the normalized query, exact candidate-profile
authority, and versioned candidate-constraint rules. Selected results receive
independent human audit.

The evaluation harness defines deterministic:

- Recall@10;
- MRR;
- NDCG@10;
- exact duplicate-result rate;
- equivalence-group duplicate rate;
- category coverage;
- hard-filter correctness;
- top-10 hard-filter violation count;
- no-viable-candidate accuracy;
- clarification accuracy;
- alias-expansion correctness; and
- prohibited-constraint preservation.

Zero denominators serialize as null or N/A and are excluded from macro means.
They never silently become 1.0.

### Offline baselines and evidence

Phase 8 may implement evaluation-only deterministic baselines. They are not a
production retrieval service and cannot be imported by product packages.

Generate and drift-check the content-free report:

verification/retrieval-v1/baseline-report.json

It may contain only:

- exact authority versions and digests;
- baseline versions;
- exact metric results;
- case counts and denominators;
- runtime/tool versions; and
- report digest.

It contains no artifact body, target source, unrestricted rationale, raw
reviewer note, provider response, model output, or credential.

### Persistence

No migration 0005 is authorized in Phase 8.

Existing evidence, dossier, artifact, and interview tables retain their current
meanings. They are not overloaded with profile authority. Production SQL
profile persistence and indexes are deferred until production retrieval proves
its read and index requirements.

A committed generated candidate-profile authority is sufficient for the
offline Phase 8 foundation.

### Provider and model boundary

Ordinary Phase 8 implementation, tests, CI, corpus validation, and baseline
verification are offline.

No OpenAI or other model call is authorized anywhere in Phase 8. No Phase 7
database, container, receipt, or repository-external evidence may be used.

The final materialization milestone is separately authorized. It may later
contact only the existing approved GitHub, npm, and advisory provider
boundaries after every offline milestone passes and a maintainer explicitly
authorizes the exact operation.

That future operation:

- uses a fresh dedicated ephemeral PostgreSQL database;
- never uses the Phase 7 container or database;
- makes no model call;
- retains structured source values rather than observation prose alone;
- generates or reproduces all 150 candidate profiles;
- emits content-free receipts and coverage evidence;
- preserves unknowns when approved sources do not establish values; and
- remains outside ordinary verification and hosted deterministic CI.

If materialization remains unauthorized or blocked, Phase 8 may claim only
completion of its offline profile, taxonomy, normalization, and evaluation
foundation. It cannot claim completed deterministic population or production
retrieval readiness.

### Dependency direction

Preserve:

```text
@gitblocks/domain
  <- @gitblocks/contracts
  <- @gitblocks/persistence
  <- @gitblocks/ingestion
```

Evaluation tooling may consume product packages. No product package may import:

- evals;
- evaluation schemas;
- evaluation harness code;
- gold; or
- baseline fixtures.

Do not create a new product package unless a later milestone proves existing
ownership incoherent.

## Consequences

### Positive

- Retrieval foundations work without repository interviews or model output.
- Query ambiguity and user approval occur before CapabilityRequestV1.
- Candidate facts have a dedicated deterministic authority without corrupting
  dossier, fingerprint, or interview meanings.
- Unknown and unresolved states remain visible instead of becoming favorable
  defaults.
- Evaluation precedes production retrieval implementation.
- Coverage cannot be inflated through unknown representation or a favorable
  average.
- Product and evaluation dependency direction remains enforceable.
- SQL design waits for demonstrated retrieval access patterns.

### Costs and limitations

- Initial known-value population may remain low until separately authorized
  deterministic materialization.
- Strict alias handling requests clarification more often than fuzzy matching.
- Some unresolved candidates remain outside the viable lane even when later
  evidence might satisfy the constraint.
- A committed profile authority needs deterministic generation and drift
  checks.
- Independent relevance and audit review is substantial work.
- Phase 8 cannot claim retrieval quality or launch readiness merely because
  its harness works.

## Compatibility

The decision is additive:

- existing product contract roots keep their meanings and versions;
- CandidateDossierV1 observation prose remains evidence, not normalized facts;
- RepositoryFingerprintV1 remains target authority;
- RepositoryInterviewV1 remains optional synthesis;
- FitAssessmentRequestV1 remains fixed-candidate;
- migrations 0001–0004 remain unchanged;
- existing catalog, evidence, artifact, and interview identity stays intact;
- pilot-v1 and repository-interviews-v1 remain separate;
- no new package, dependency, service, or deployment is authorized; and
- no production retrieval/ranking consumer is implied.

## Security and privacy

- Taxonomy is product authority and cannot be poisoned by repository text.
- Repository artifacts, catalog prose, query text, persisted records, and
  generated files remain untrusted inputs.
- ASCII-only lookup avoids locale, mixed-script, and confusable semantic
  merging in hard constraints.
- Inputs, concepts, graph traversal, constraints, results, JSON depth/nodes,
  and serialized bytes are bounded.
- Closed parsers reject unknown fields, accessors, exotic prototypes, cycles,
  sparse arrays, prototype-pollution keys, controls, and invalid Unicode.
- Query inputs never contain raw target source, secrets, environment/config
  values, or transcripts.
- Candidate facts preserve source authority and do not let curator statements
  impersonate provider observations.
- Evaluation gold and reviewer authority do not enter product packages.
- Errors and reports are deterministic and content-free or value-free.
- Ordinary validation has no provider, model, credential, or Phase 7 effect.
- The existing
  [security baseline](../../engineering/security-baseline.md) remains the sole
  security-policy document.

## Rejected alternatives

### Treat the 27 fields as the exact profile DTO

Rejected because the inventory is a coverage denominator. Serialization should
group values coherently and may evolve independently while preserving coverage
mapping.

### Count unknown as deterministic extraction

Rejected because it would turn representability into a favorable but false
coverage claim.

### Make the 70–80% target a Phase 8 representation gate

Rejected because the target applies to known deterministic fields actually
consumed by the future initial ranker.

### Normalize directly into CapabilityRequestV1

Rejected because that root already assumes a family, structured request
fields, and transmission approval. Local admission and clarification must
precede it.

### Reuse CandidateDossierV1 as a profile

Rejected because observation prose, limitations, and unknowns are evidence
authority, not closed directly filterable candidate facts.

### Reuse RepositoryFingerprintV1 for candidates

Rejected because it is minimized target-codebase authority.

### Use repository interviews as deterministic facts

Rejected because interviews are model-authored optional synthesis and live
calibration did not publish one.

### Fuzzy or Unicode-confusable hard-constraint matching

Rejected because it can silently change security-sensitive meaning.

### Use lightweight as a taxonomy value

Rejected because it hides multiple operational preferences behind a subjective
label.

### Hand-author all candidate facts

Rejected because that would disguise curator assertion as deterministic
extraction and inflate coverage.

### Hand-author the complete hard-filter matrix

Rejected because 7,500 labels would duplicate deterministic rules, drift from
profiles, and be difficult to review. Generated membership plus independent
sampling is narrower.

### Extend pilot-v1

Rejected because pilot-v1 evaluates fixed-candidate ranking/fit rather than
query normalization and retrieval.

### Add migration 0005 now

Rejected because Phase 8 has no production retrieval read/index requirements.

### Create a retrieval package or service

Rejected because production retrieval is a later phase and existing packages
can own the Phase 8 foundations coherently.

### Run profile collection during ordinary verification

Rejected because provider state is external and nondeterministic. The final
proof requires separate authorization and content-free evidence.

## Recovery and forward correction

- Before an authority is used, defects may be corrected in its unpublished
  branch revision.
- After use, taxonomy, profile, query, corpus, scorer, or baseline semantic
  corrections receive additive versions or new digests.
- Invalid query/profile/evaluation input publishes no normalized authority or
  report.
- Failed baseline generation leaves the prior committed report unchanged.
- A failed live materialization database is discarded completely.
- No migration rollback or history rewrite is involved.
- Published branch history is not rebased, amended, or force-pushed.

## Deferred work

- Exact query and profile DTO shapes and bounds.
- Production retrieval request/result contracts and application ports.
- Production profile persistence and indexes.
- Retrieval implementation and optimization.
- Production ranking and use of repository-conditioned fit.
- API, MCP, scanner, deployment, private data, and tenant boundaries.
- Any future interview redesign or selection policy.

## Review and exit

This ADR was accepted with Milestone 1. Acceptance authorizes the documented
Phase 8 architecture and only the next separately reviewed milestone; it does
not authorize every later implementation or the live proof.

Each milestone requires one ordinary commit and maintainer acceptance.
Published history is not amended, rebased, or force-pushed.

Phase 8 exits only when every issue acceptance criterion and the plan's exact
exit gates pass. If the separately authorized materialization does not run,
the completion statement must remain limited to the offline foundation.
