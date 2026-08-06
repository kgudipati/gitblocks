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

Milestone 3, including its result-invariant correction, was accepted at commit
a81aea020fde501c70bfffa85dad60113e4e71d1 after hosted CI run 30875378437 and
Verification job 91885676773 completed successfully. This ADR remains
accepted. Milestone 4 was accepted at
`66a4165c1239e7a46d72ccd6469d0856e815c410` under the documented hosted-CI
infrastructure exception, retaining corrections
`2983194504253ca76697a93abd744e3300522785` and
`2ddedf73f38fb25f625b5fd0793605d807f1ee93`. Milestone 5 was accepted through
correction commit `4f4c1e4522f7db85d2a0a422b5c78ac8665a4840`. Its independent
corpus/scorer architecture is accepted, while relevance and hard-filter audit
provenance remains proposed/not-reviewed; this establishes deterministic
development authority, not independently accepted retrieval truth. Milestone
6 was accepted at `ea27f11432513ec352ce43821eb95b8da0886182`. The maintainer
approved an explicit two-commit split: Milestone 7A implements only the offline
controlled operator and fake-effect proof; Milestone 7B owns any later live
execution and evidence. Milestone 7B remains unauthorized.

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

The accepted taxonomy and query DTO shapes remain version-bound. Milestone 4
now fixes the profile DTO shapes, bounds, projections, and digests described
below; later milestones may not silently widen them.

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

Milestone 4 adds exactly two product roots:
DeterministicCandidateProfileV1 and
DeterministicCandidateProfileAuthorityV1. Every profile contains the exact 27
ordered fields once. Catalog role/status, capability family, repository
identity, adoption unit, feature variants, and package identity mapping are
candidate-wide; all other fields are version/snapshot-specific. Known and
conflicting version-specific values require an exact non-null scope.

Values are structurally and semantically closed per field ID. A field record
retains field/scope/state, stable state reason and state rule, nullable value
extraction rule, exact scope, and bounded source references. Catalog,
structured-collection, artifact-set-entry, and acyclic derived references are
the complete source union. There is no arbitrary JSON, universal string,
narrative, provider-body, URL, or record-digest escape hatch. Repository
identity is bound to the owning candidate, while package-dependent
applicability and publication identity must agree with the known package
mapping.

The committed offline authority's only candidate-specific known-value source
is the closed parsed `catalog/public-v1/manifest.json`. It extracts catalog
status, primary/additional family, stable catalog candidate/display/GitHub
identity, and mapped or known-unmapped npm identity. Catalog status is never
provider lifecycle state. The taxonomy binds versions/digests and validates
controlled concepts but assigns none to candidates. Dossier prose, rationale,
selection sources, repository interviews, historical databases, completion
Markdown, artifact declarations, and aggregate prose are prohibited fact
sources. Artifact selection never proves materialization.

For 70 known-unmapped packages, publication/version, runtime/package format,
and package-repository linkage are not applicable. Those fields remain unknown
for the 80 mapped packages because no structured provider values are committed.
All other unpopulated fields retain distinct controlled unknown reasons. The
authority is mostly unknown by design; historical live proofs are not
reconstructed from prose.

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

The generated closure is 150 profiles, 27 fields, and 4,050 candidate-field
cells: 600 known, 210 not applicable, 3,240 unknown, and zero conflicts. Four
of 27 fields have current known-value extraction. Candidate-side launch
hard-filter readiness is 2/16 (12.5%); structured broad-retrieval readiness is
2/9 (22.2%). These percentages remain separate and do not pass the original
70–80% target.

### Candidate constraint epistemic state

Candidate constraint evaluation is tri-state:

- satisfied;
- conflict; and
- unresolved.

Unresolved is neither satisfied nor conflict. It does not pass viability and
cannot be recommended. A future retrieval contract may preserve it only in a
separately typed evidence-needed lane with exact unresolved constraints
disclosed, so broad recall is not silently converted into false certainty.

Milestone 4 evaluates one parsed profile against one accepted normalized query
only. Exact supported mappings are primary family, architecture to adoption
unit, feature to capability variants, and required infrastructure. Optional
infrastructure support does not conflict with a prohibited dependency.
Unknown/conflict states and non-taxonomy declarations are unresolved;
not-applicable applies modality-specific conflict/satisfaction behavior.
Preferred evaluations never change aggregate hard state. The evaluator does
not accept candidate arrays or return filtering, retrieval, ranking, or
recommendation results.

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

Milestone 3 implements the accepted local sequence with additive
CapabilityQueryInputV1 and CapabilityQueryNormalizationResultV1 roots, both
closed to `local-pre-approval`. Only explicit structured capability terms,
constraints, and candidate references are normalized. Summary and success
condition prose are retained but never mined for vocabulary or modality.

Normalizer `1.0.0` trims and collapses ASCII spaces, lowercases ASCII A-Z,
collapses spaces and repeated hyphens to one hyphen, then requires the existing
stable-ID grammar. It does not remove punctuation, transliterate, use locale
conversion, stem, pluralize, prefix/substring/fuzzy match, or normalize Unicode
into ASCII. Required, preferred, and prohibited declarations retain every
source ID; unresolved and clarification-needed states remain separately typed
rather than becoming favorable constraints.

An optional injected candidate-reference authority is bounded to 200 exact
candidate, repository, and npm keys and binds its catalog version/digest only
when references use it. It is neither a contract root nor candidate catalog.
Repository-fingerprint references retain only identity and digest; no target
fact becomes an implicit constraint.

The complete canonical input has one digest. The result semantic digest binds
the input digest, taxonomy authority, normalizer version, optional candidate
authority, and all canonical outputs. The normalization ID is a stable prefix
plus the first 48 semantic-digest characters. A separate record digest is not
used because there is no record-only payload. Exact exchange validation
recomputes the complete result and rejects source, modality, authority,
outcome, ordering, or digest drift.

Milestone 3 result closure treats blocking unresolved records as authoritative:
`normalized` requires one primary family, no blocking unresolved term, no
clarification, and no contradiction. A supported primary capability mixed with
adjacent, generic-utility, or incidental-capability terminology requires exact
clarification; a wholly excluded primary request may terminate as
`unsupported`. The unresolved result ceiling is the derived 8 + 32 + 10 input
source maximum of 50. Candidate-ID lookup uses the exact `candidateId` and has
no separately declared candidate alias.

Standalone normalization-result parsing applies pure semantic validation
between structural validation and identity verification. It closes generated
IDs, canonical ordering, modality/provenance relationships, constraint shapes,
clarification coverage, candidate-catalog binding, and outcome coherence even
when an impossible object has been given a recomputed digest. Full exchange
validation separately proves ownership by the supplied input, taxonomy, and
optional candidate authority.

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

The separate `retrieval-v1` authority contains exactly:

- 30 retrieval cases, 6 per capability family; and
- 20 normalization, clarification, and adversarial cases, 4 per family.

Blind retrieval query records own only version, case identity/kind, assigned
family, and the accepted structured query input. They contain no tags or audit
classifications. Case slots and diversity classifications live in a separate
proposed audit authority; relevance grades 0–3, positive and valid no-result
cases, result-redundancy equivalence metadata, and provenance remain separate
gold-bearing authority.

The normalization/adversarial cases own exact terms and aliases, ambiguity,
conflicting modalities, unsupported categories, unclear self-hosting,
subjective terms, brand comparisons, Unicode/confusable inputs, and
clarification expectations.

Normalization gold, clarification gold, hard-filter expectations, relevance
judgments, equivalence metadata, and no-result expectations remain physically
and semantically separate. Ranking judgments are prohibited.

`loadRetrievalBlindQuerySetV1` validates and returns only manifest bindings and
the 50 blind query records. It exposes no gold, equivalence, or audit
classification metadata and is the only permitted Milestone 6 baseline input.
Full-corpus loading is restricted to validation, frozen-prediction scoring, and
content-free report aggregation.

Do not hand-author a 50 by 150 hard-filter label matrix. Expected membership is
generated deterministically from the normalized query, exact candidate-profile
authority, and versioned candidate-constraint rules. Bounded selected results
currently have proposed/not-reviewed audit samples; independent human review
must be recorded before any accepted-quality claim.

The implemented evaluation lane projects accepted product tri-state without
changing it. Satisfied non-negative-control candidates are eligible;
unresolved non-negative-control candidates are evidence-needed; conflicts and
negative controls are excluded. Evidence-needed is not viable and unknown is
never satisfied. Relevance measures only capability-query relevance and stays
separate from hard eligibility, adoption fit, quality, ranking, preference,
and recommendation. Proposed judgments are candidate- and query-specific from
committed curation, are not regenerated by a family/slot formula, and remain
not independently reviewed. Real-corpus equivalence means true result-level
redundancy rather than functional overlap or ecosystem companionship; zero
groups is valid.

The evaluation harness defines deterministic:

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

Every metric retains numerator, denominator, value, and status. Zero
denominators serialize with null value and `not-applicable` status and are
excluded from macro means. They never silently become 0, 1, NaN, or Infinity;
an all-null macro remains null.

The corpus, schemas, proposed gold, predictions, and score reports are
evaluation-only. Product packages never import them. The harness consumes
contract parsers/DTOs from `@gitblocks/contracts` and declares
`@gitblocks/domain` directly for profile types and constraint evaluation; the
contracts package does not expand its product API for evaluation convenience.
Ordinary validation is
bounded, fixed-path, no-symlink, read-only, offline, and has no provider,
model, database, candidate-repository, artifact-body, target-source, or Phase 7
path. The exact corpus contracts, manifest closure, scoring definitions, and
semantic digest are recorded in the
[retrieval-v1 protocol](../../evaluation/retrieval-v1-authoring-protocol.md).

Honest contradiction-case authoring exposed a pure validation defect: the
accepted normalizer generated the intended required/prohibited contradiction
group, then `validateContradictionPairs` excluded the current canonical member
from its own modality search. The minimal correction validates the complete
same-facet, same-concept contradiction group and binds the conflict rule to
contradiction basis. It changes no generation, canonical output, schema,
normalizer version, taxonomy behavior, or digest projection; correctly
re-digested missing or split pairs remain rejected.

### Offline baselines and evidence

Milestone 6 implements evaluation-only deterministic family-only,
exact-keyword, and alias-expanded baselines; an always-abstain weak control; a
constraint-violating safety control; and a synthetic fixture oracle. They are
not a production retrieval service and cannot be imported by product packages.

The binding sequence is blind query loading, accepted normalization, safe
structured candidate/profile projection, baseline prediction generation,
prediction validation and immutable digest, and only then full gold-bearing
corpus loading, deterministic scoring, and content-free aggregation. Strategy
views contain only case kind, structured terms/constraints, accepted
normalization concepts/constraints/family, resolved candidate identities, and
safe structured candidate identity/family/status/hard-state/lane fields. Case
and source IDs, corpus-assigned family, prose, classifications, reviewer data,
catalog rationale/selection sources, artifacts, and gold are unavailable.

Generate and drift-check the content-free report:

verification/retrieval-v1/baseline-report.json

It may contain only:

- exact authority versions and digests;
- baseline/control versions and prediction/score semantic digests;
- exact metric results;
- case counts and denominators;
- runtime/tool versions; and
- report digest.

It contains no artifact body, target source, unrestricted rationale, raw
reviewer note, provider response, model output, or credential.

The report explicitly labels proposed/not-reviewed gold and all scores as
development measurements rather than production-quality evidence. It records
aggregate and per-family numeric metrics and safety counts, never per-case or
candidate content, a winner, rank, composite, recommendation, quality/launch
threshold, or production-readiness status. Shared accepted-normalization
metrics are disclosed as a common deterministic component. The explicit
writer owns only the fixed report path; ordinary verification is read-only and
compares canonical bytes and semantic digest with a no-write effect audit.

### Controlled profile-materialization operator

Milestone 7A adds an operational ingestion boundary without changing any
product contract or legacy public-ingestion result. The separately digested
`profile-materialization-provider-policy/1.0.0` closes the operation set to
repository metadata, default-branch head, release, tag, license, community
profile, exact allowlisted file, npm package, and GitHub advisory. Only HTTPS
GET requests to `api.github.com` and `registry.npmjs.org` are permitted.
Redirects remain manual, same-host, and bounded to two; transport, retries,
deadlines, response bytes, JSON nodes, concurrency, mutability, retained
properties, and permitted profile consumers are explicit per operation. Tag
and file operations are persistence-audit-only, and file bodies are excluded
from every profile/evidence authority.

The new collector produces a closed
`profile-materialization-source-authority/1.0.0`; it does not widen
`collectCandidateSources` or its DTOs and receipts. Source records bind logical
identity, record digest, mutability, controlled outcome, immutable reference,
collection fact, normalized structured value, controlled code, and exact
legacy evidence identifiers when such observations exist. They exclude raw
bodies, headers, credentials, arbitrary errors, database/operator/Phase 7
identity, and model output. Run isolation never contributes to source semantic
identity.

The head and other latest/listing/query selectors are mutable singleton
identities. License and allowlisted-file sources are immutable identities bound
to the exact head commit (and file path). The second collection reconciles
against the first: semantically unchanged records reuse the original complete
record byte-for-byte and mutable changes become explicit drift. For one
immutable exact-snapshot identity, different established values or transitions
between an established value and established absence fail closed. Temporary
`unavailable` outcomes establish no provider fact and may transition to or from
an established outcome as explicit changed drift without rewriting either
collection authority.

Each collection also produces the retained operational
`profile-materialization-persistence-proof/1.0.0`. Complete legacy bundles use
the existing runtime-role `loadPriorMaterial`, `profileCandidate`, and
`persistCandidateProfile` semantics; controlled topic mapping binds exact
generated/reused evidence identifiers without inspecting observation prose.
Optional-source-qualified bundles remain explicitly unpersisted. Reconciled
unchanged records may retain exact evidence identifiers from an earlier
durable pass, but no qualified pass invents new evidence. Release mapping uses
the exact legacy release-selection helper; allowlisted-file mapping requires
the exact controlled topic, candidate, commit, and encoded immutable path.
Receipt live idempotency requires the reconciled source comparison and matching
second persistence dispositions, so catalog seed alone cannot pass.

Pure materialization consumes only the accepted catalog/taxonomy and one
validated source authority, performs no I/O, and closes exactly 150 profiles.
It preserves accepted catalog-role, capability-family, repository-identity,
and package-mapping fields. Only ten reviewed structured fields may change:
repository discovery, package publication/version, runtime package format,
license, archived state, fork/upstream, release recency, advisory state,
security-policy presence, and package/repository linkage. Known/conflict values
bind deterministic repository-snapshot or package-version scopes and
`structured-collection` references. No README/dossier prose, topic inference,
npm-only SPDX claim, zero-advisory absence, or failed-provider negative fact is
accepted.

The exact command surface is `profiles:materialization:preflight`,
`profiles:materialization:execute`, and `profiles:materialization:verify`.
Preflight is zero-effect, uses the explicit internal source export instead of a
writing build step, and reads no credential. Execute is one atomic
try/finally boundary; fixed evidence cannot publish before exact resource
disposal and post-disposal proof. Verify is read-only. Execute and future
evidence verification remain outside ordinary verification and hosted CI.

The fresh database plan pins the existing PostgreSQL 18.4 bookworm image
digest, derives all identities from an explicit `m7-[a-z2-7]{26}` run ID,
uses a tmpfs-only container on an isolated internal network with explicit
loopback port binding, and rejects existing resources. Existing four migrations
and table meanings suffice; no migration 0005 or durable profile table is
introduced. All catalog seed, prior-material reads, and profile persistence use
the verified derived runtime login; owner access remains limited to bootstrap,
migration, schema proof, and runtime-role creation. Disposal strictly removes
and proves absence of the exact container before inspecting/removing/proving
the exact network. Source authorities and persistence proofs remain untracked
local operational evidence
until independent 7B review, Milestone 7 acceptance, and explicit maintainer
deletion authorization.

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
