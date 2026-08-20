# GitBlocks product contract

## Status and authority

This document defines the approved product boundary for the first private
alpha. Current main contains pure domain and versioned contracts, a concrete
PostgreSQL adapter for shared public catalog/evidence state, bounded
public-source ingestion, a persistence-independent repository-interview
application and offline operator, deterministic query/profile foundations,
the pure six-channel `@gitblocks/retrieval` engine, Recovery R3's immutable
PostgreSQL serving snapshots plus offline accepted-catalog bootstrap, and
Recovery R4's in-process hosted discovery application, Recovery R5's
loopback-only MCP Streamable HTTP process, Recovery R6's hosted
codebase-conditioned OSS recommendation operation, Recovery R7's portable
Agent Skill plus bounded local repository scanner, Recovery R8's bounded
evidence-needed finalist resolution, and Recovery R9's commit-coherent
immutable artifact excerpts inside the existing recommendation operation. R6
adds request-scoped
fingerprint binding, finalist evidence reads, a narrow target-fit model port,
one bounded OpenAI Responses adapter, deterministic target-fact and fit-exchange
validation, and the singular `recommend_oss` product tool. R7 adds deterministic
manifest-first `RepositoryFingerprintV1` production, exact authoritative
fingerprint-reference digest parity, transmission preview and approval, honest
outcome presentation, and post-selection adoption procedure without changing
the hosted recommendation path. R8 preserves deterministic retrieval, selects
eligible finalists first and then fills remaining slots up to five from the
ordered evidence-needed lane, and validates explicit candidate-evidence-backed
hard-evaluation resolutions before accepting target-fit output. R9 reads only
exact artifact material matching the active serving catalog, cutoff, and single
active repository-head commit, then appends bounded direct excerpts only to the
request-scoped dossier. The evaluation
harness and repository checks remain development support. Repository
interviews, artifact generation for finalist assessment, and Phase 8 live
materialization proof machinery are not part of the serving path. Phase 10 is
frozen R&D on a separately preserved branch and is not implemented on main.

The checked-in R7 Skill and scanner implement the local procedure and compose
with the R6 hosted portion in a controlled development exercise: a real
temporary target fingerprint and approved-shaped request reach deterministic
retrieval, temporary PostgreSQL finalist evidence, one controlled target-fit
model call, deterministic validation, and at most three responsible options
through `recommend_oss`. No authenticated remote service, deployed PostgreSQL
database, or complete externally usable adoption journey exists yet. This
development exercise does not make GitBlocks publicly or remotely available.
Changes to this contract require an issue, an execution plan when substantial,
and architecture review.

## Product statement

GitBlocks is a planned agent-native open-source adoption layer. It will help a
developer's existing coding agent find, evaluate, plan, and learn from the
adoption of open-source software (OSS) using repository-specific evidence.

GitBlocks will own adoption intelligence, evidence, compatibility knowledge,
and the outcome-learning loop. The developer's coding agent will remain the
interactive execution runtime and will own local edits and validation.

## Hosted private-alpha architecture

The first private alpha has four explicit boundaries:

- **Local user boundary:** the developer's existing coding-agent host, a
  GitBlocks Skill, a bounded deterministic target-repository scanner, and a
  minimized `RepositoryFingerprintV1`. Target and dependency code is never
  executed by GitBlocks, and unnecessary target source stays local.
- **Remote GitBlocks boundary:** one hosted Node application initially,
  containing the MCP-facing/application composition, deterministic query
  normalization, deterministic candidate retrieval, target-conditioned
  finalist assessment, bounded LLM semantic reasoning after retrieval,
  deterministic hard-constraint/contract/evidence validation around model
  output, and at most three responsible recommendations.
- **Durable data boundary:** one PostgreSQL database is the serving-required
  system of record for shared candidate identity and catalog state,
  deterministic candidate profiles, retrieval metadata, evidence,
  limitations, unknowns, lifecycle and freshness, immutable repository
  artifacts/chunks/sets, and the coherent catalog
  snapshot currently served. Current persistence stores and loads one coherent
  immutable 150-candidate profile/metadata snapshot and R6 loads active
  evidence, limitations, and unknowns for no more than five finalists at one
  cutoff. Authenticated remote delivery remains later work.
- **Offline boundary:** bounded public-source ingestion and refresh collects
  approved GitHub, npm, and advisory data and publishes profile and retrieval
  metadata into PostgreSQL. R3 provides an explicit offline bootstrap from the
  currently accepted committed authorities. Connecting routine collectors to
  replacement-snapshot publication remains deferred. Ingestion is
  offline-required product infrastructure, not a user-request operation.

The retrieval engine's purity keeps deterministic product logic independent of
storage and transport. It does not make PostgreSQL optional: the hosted
composition loads durable shared catalog intelligence around the pure engine.

For target-conditioned fit, the approved reasoning order is:

```text
capability request
  -> deterministic normalization
  -> deterministic hard filtering and retrieval
  -> eligible-first, evidence-needed-fill finalist set (maximum five)
  -> bounded candidate evidence load
  -> exact-commit artifact load and deterministic request-scoped excerpts for evidence-needed finalists
  -> one LLM hard-resolution and target-fit assessment
  -> RecommendationAssessmentResponseV1
  -> deterministic exact-coverage, source-binding, hard-constraint, evidence, and target-fit validation
  -> up to three responsible options
```

The LLM performs neither open-world candidate discovery nor deterministic
retrieval. It cannot restore a deterministically excluded candidate,
manufacture missing evidence, or override a contract failure. For an
evidence-needed finalist it must resolve every disclosed unresolved hard
evaluation exactly once. Satisfied and conflict resolutions require
candidate-owned supplied evidence through referenced inferences; missing or
silent evidence remains unresolved. A conflict is rejected and unranked.
Unresolved remains explicitly unverified and is never scored as satisfied, but
a candidate with no conflict may proceed to the unchanged target-fit authority
and may be presented when its ordinary candidate-evidence and
repository-target-fit support is otherwise sufficient. Every presented option
structurally reports each original hard constraint as verified, unverified, or
conflicting; a partially verified option is distinguished from a fully verified
option, and an unverified prohibited constraint carries its own option-level
discriminator.

A user request runs only the hosted request path and may read PostgreSQL
directly where the use case requires it or use a process-local immutable search
view. R6 loads the retrieval snapshot only at startup. R9 performs bounded
active-dossier SELECTs plus at most one immutable artifact-material SELECT per
selected evidence-needed finalist and at most one target-fit model call per
assessed request. A request
must not run ingestion, provider collection, migrations, Docker, evaluation,
artifact generation, repository interviews, materialization proof machinery,
replay, or authority generation. The initial architecture does not require Redis, queues or worker
fleets, pgvector or another vector database, microservices, Kubernetes, a
continuous crawler, multi-tenancy or organizations, billing, enterprise
authentication/governance, or repository interviews in the serving path.
Future evidence may justify one of those choices; hypothetical usefulness does
not place it on the active product path.

## Target user and job to be done

The first user is a professional developer maintaining a TypeScript application
who already uses a coding agent and must add a common infrastructure capability
without making an expensive or unsafe dependency choice.

When that developer needs an OSS capability, they want their existing coding
agent to identify options with explicit per-constraint verification status,
reject known hard conflicts, explain repository-specific tradeoffs and
uncertainty, and prepare an actionable adoption plan so they can choose and
integrate a dependency with less research time and better evidence.

## Supported first ecosystem

The first evaluation corpus is intentionally bounded to:

- TypeScript;
- Node.js;
- Next.js;
- PostgreSQL;
- Prisma or Drizzle; and
- common server, container, and serverless deployment models.

Support means that private-alpha evaluation data and compatibility evidence
will be designed for this combination. It does not mean every combination,
version, deployment provider, or repository is guaranteed to receive a viable
recommendation. Other languages and ecosystems are out of scope for this
contract.

## First five capability families

The private alpha will evaluate exactly these five families:

1. **Authorization** — exposes fit questions across identity models, data
   access, request boundaries, policy representation, and database integration.
2. **Audit logging** — tests append-only event design, privacy, retention,
   schema evolution, and operational evidence without requiring a full
   observability platform.
3. **Background jobs** — tests deployment constraints, durability,
   idempotency, retries, queues, and local development ergonomics.
4. **Rate limiting** — tests distributed state, serverless compatibility,
   latency, failure modes, abuse controls, and enforcement placement.
5. **Webhooks** — tests inbound and outbound contracts, signature handling,
   replay protection, retries, idempotency, and external integration evidence.

These families are common in the supported ecosystem, have discoverable OSS
options, and collectively exercise different adoption risks: domain modeling,
data retention, asynchronous work, distributed control, and adversarial
external input. They are narrow enough to build a useful evaluation corpus
while revealing whether codebase-conditioned ranking adds value.

Authentication is excluded initially because identity migration and hosted
provider choices would dominate a small alpha and obscure the distinction
between authentication and authorization. Feature flags, transactional email,
and file uploads are deferred because their early comparisons would be heavily
vendor- and pricing-driven. Observability is deferred because its breadth would
make comparable adoption outcomes difficult to define. Deferral is not a claim
that these capabilities are less important.

Adding or replacing a family requires an explicit product-contract change; a
candidate tagged with more than one family does not increase the count.

## Canonical discovery and adoption workflow

The approved workflow is:

1. **Frame the request locally.** The coding agent and developer state the
   desired capability, success conditions, explicit hard constraints, and which
   local facts may be shared. The Skill preserves these in a bounded
   pre-contract input without silently weakening required, preferred, or
   prohibited intent.
2. **Fingerprint locally.** A deterministic local scanner observes approved
   manifests, configuration shapes, structure, and dependency facts. It emits
   closed, bounded facts from a controlled, versioned vocabulary and does not
   execute target or dependency code.
3. **Review and minimize.** The Skill shows or summarizes the query and
   fingerprint, removes unnecessary source content and secrets, and obtains
   approval for the minimized data that will leave the local environment.
4. **Normalize and retrieve deterministically.** The hosted application
   normalizes the bounded request or fails closed with exact clarification
   reasons. Once the authoritative request is approved, it loads one coherent
   PostgreSQL catalog snapshot, eliminates known hard conflicts, and retrieves
   ordered eligible and evidence-needed lanes through the deterministic engine.
5. **Assess adoption fit.** The application loads bounded candidate evidence
   for the first five eligible finalists, filling unused slots from the ordered
   evidence-needed lane. Matching immutable README/documentation artifacts may
   contribute only deterministically selected, exact-line, request-scoped
   evidence after active repository-head commit coherence succeeds. A bounded
   LLM resolves every disclosed unresolved hard
   evaluation and reasons about target fit in one response. Deterministic code
   then validates exact resolution coverage, normalization/source binding,
   candidate-owned evidence, the unchanged target-fit exchange, and
   responsible-outcome rules. Missing text never establishes absence, and
   repository interviews are not required in this serving path. An unresolved
   evaluation remains unverified; it may not establish satisfaction, but it no
   longer forces abstention when the candidate has no conflict and otherwise
   has sufficient candidate and target-fit support.
6. **Explain up to three options.** The coding agent receives at most three
   responsible options with evidence references, preserved candidate
   limitations, tradeoffs, material unknowns, and reasons for exclusion or
   relative fit. Each option includes the developer's original hard-constraint
   statements, their required or prohibited modality, verified, unverified, or
   conflicting status, and grounding for verified constraints. A structural
   option-level discriminator distinguishes fully verified, partially verified,
   and unverified-prohibited-constraint options. Every reason is traceable to
   candidate-owned evidence or inference, a disclosed material unknown, or a
   matching hard-constraint conflict. Direct observations, supplied
   declarations, and derived conclusions remain visibly distinct.
7. **Choose and plan.** The developer approves a candidate. The coding agent
   produces a structured adoption plan covering changes, tests, migration,
   rollout, rollback or forward recovery, and open risks.
8. **Integrate locally.** Only after candidate selection and normal edit/install
   approval, the existing coding agent may edit the local repository and run
   its normal validation. The R7 Skill defines this procedure; GitBlocks is not
   an autonomous code-editing runtime.
9. **Capture an outcome.** With the developer's knowledge, a minimized,
   structured record of the selection, integration result, deviations, and
   validation may improve future recommendations.

A useful response may be “no viable candidate” or “insufficient evidence.”
GitBlocks must not manufacture certainty merely to return a ranked list.

## Phase 8 deterministic retrieval foundation

Project Phase 8 combines the original strategy's deterministic repository
profiler and capability-taxonomy/query-understanding foundations with retrieval
evaluation contracts, corpus, metrics, and non-production baselines. It does
not implement the original strategy's production retrieval or production
ranking phases.

CapabilityQueryInputV1 is now a bounded local pre-contract input, not a second
adoption-request model. CapabilityQueryNormalizationResultV1 preserves each
constraint's source identity and required, preferred, or prohibited modality;
unresolved and clarification-needed states remain explicit separate records.
The deterministic normalizer consumes only structured terms and declarations,
not summary prose. Only after later user review and transmission approval may
a reviewed result contribute to new CapabilityRequestV1 authority. No current
helper performs that transition. Alias expansion and deterministic rules never
weaken a hard constraint.

DeterministicCandidateProfileV1 is candidate-owned, separately versioned,
structured deterministic authority with known, unknown, not-applicable, and
conflict value states plus extraction and bounded source provenance. The
additive DeterministicCandidateProfileAuthorityV1 root canonically binds all
150 catalog candidates to the exact catalog, taxonomy, denominator, and
profile-rules versions and semantic digests. It does not
replace or reinterpret CandidateDossierV1 evidence observations,
RepositoryFingerprintV1 minimized target-codebase facts, RepositoryInterviewV1
optional semantic enrichment, or FitAssessmentRequestV1. In particular,
CandidateDossierV1 observation prose is never reparsed into structured profile
facts, and repository interviews never populate deterministic profile
authority.

The exact denominator is `deterministic-profile-coverage/1.0.0` with 27
ordered fields. Each profile contains every field exactly once. Six fields are
candidate-wide—catalog role/status, capability family, repository identity,
adoption unit, feature variants, and package identity mapping—and the other 21
require a version or snapshot when known. Values are closed per field ID; no
arbitrary JSON, universal string value, narrative, or URL provenance escape
hatch exists.

The committed offline authority uses only typed fields from the parsed
`catalog/public-v1/manifest.json` for candidate-specific known values:
catalog status, primary/additional family, stable catalog GitHub identity, and
mapped or known-unmapped npm identity. The taxonomy validates controlled IDs
and binds the authority but assigns no candidate concepts. An unmapped package
makes publication, runtime/package format, and package-repository linkage not
applicable; the mapped cases remain unknown without committed structured
provider authority. All other fields remain controlled unknowns. The resulting
600 known, 210 not-applicable, 3,240 unknown, and zero conflict cells are an
honest foundation, not production readiness. Historical provider or artifact
proofs are not reconstructed from prose. Repository identity remains bound to
the profile's candidate, and package-dependent applicability and publication
identity must agree with the profile's known mapped/unmapped package value.

Candidate constraint evaluation for one profile and one accepted normalized
query is satisfied, conflict, or unresolved.
Unresolved is neither satisfied nor conflict: at deterministic retrieval such
a candidate is not eligible and remains in a separately typed evidence-needed
lane with the unresolved constraint disclosed. R8 may select that candidate
only after eligible finalists and may clear the retrieval uncertainty only
when bounded candidate-owned evidence resolves every disclosed evaluation as
satisfied. A conflict stays rejected and unranked. An unresolved evaluation
remains unverified and outside deterministic eligibility, but after finalist
selection it may be carried into a structurally partial responsible option when
the candidate has no conflict and unchanged target-fit rules otherwise support
it. Phase 8
evaluation authority remains independent of fixed-candidate ranking gold and
repository-interview audit data, and product packages must not import it.
The current exact mappings are primary family, architecture to adoption unit,
feature to capability variants, and required infrastructure only. Optional
infrastructure support does not become a prohibited dependency. Preserved
runtime, framework, datastore, license, maintenance, release, or security
declarations remain unresolved until an exact reviewed controlled mapping
exists. The evaluator does not generate, filter, retrieve, rank, or recommend
candidates.

`retrieval-v1` is evaluation-only authority, not a product contract root. Its
30 retrieval and 20 normalization/adversarial blind cases are exactly balanced
six/four per family. Blind records contain no tags or audit classifications;
those classifications live in a separate proposed audit authority, and the
blind-only loader is the sole permitted future baseline input. Normalization,
clarification, generated hard-filter,
proposed relevance, equivalence, and no-result gold are physically separate.
Product packages do not import those records, schemas, fixtures, or scorers.
Relevance means capability-query relevance only; it does not establish
viability, target compatibility, quality, ranking preference, or
recommendation. Unresolved candidates remain outside eligibility in a
separate evidence-needed lane. All new gold is proposed/not independently
reviewed, so the corpus and scorer establish evaluation authority—not
retrieval quality. Proposed relevance is candidate/query-specific from
committed curation, and real-corpus equivalence is limited to true result
redundancy; zero groups is valid. Milestone 5 was accepted through
`4f4c1e4522f7db85d2a0a422b5c78ac8665a4840` with that limitation intact.

Milestone 6 baselines are evaluation-only outward consumers. They generate and
freeze complete predictions from blind queries, accepted normalization, and a
safe structured profile projection before loading gold for scoring. Strategy
inputs omit case/source identities, assigned corpus family, prose, rationale,
artifacts, audit metadata, and gold. The committed baseline report contains
only bindings, opaque prediction/score digests, aggregate/per-family numeric
measurements and denominators, safety counts, control evidence, and its digest.
It makes no winner, recommendation, quality threshold, production-readiness,
or product-contract claim. At the Phase 8 checkpoint production retrieval was
unimplemented; subsequent Phase 9 implemented the pure retrieval package
without an operational service or target-conditioned fit path.

Milestone 7A adds no product contract root and changes none of the 27 field
definitions, profile DTOs, schema digests, or accepted offline authority. Its
provider policy, source authority, persistence proof, coverage comparison, and receipt are
versioned operational ingestion contracts under `schemas/operations`, not
product schemas. Pure materialization still emits the accepted deterministic
profile DTO and may populate only ten already-defined fields from exact
structured public-source values with repository-snapshot or package-version
scope. The offline authority remains the accepted product-facing authority
until a separately authorized Milestone 7B evidence commit is reviewed. This
operator is neither retrieval/ranking nor a production-readiness claim.

The operational source and persistence proofs do not create a product DTO or
durable profile table. They reuse existing ingestion evidence/dossier snapshot
semantics only to audit collection replay, retain their candidate-scoped files
outside version control, and expose only content-free aggregate bindings in a
future receipt. Existing product schema roots and table meanings remain
unchanged.

## Relevance is not adoption fit

**Repository relevance** asks whether a project appears to implement the
requested capability. It can be inferred from topics, descriptions, package
metadata, documentation, source structure, and community signals.

**Adoption fit** asks whether a relevant project is a responsible choice for a
specific target repository under its hard constraints. Fit includes runtime
and framework compatibility, deployment topology, existing data and identity
models, integration surface, migration and operational cost, maintenance,
security, licensing, and the quality and freshness of supporting evidence.

A popular or semantically relevant project may have poor adoption fit. Ranking
must not substitute popularity for compatibility.

## Canonical vocabulary

- **Viable candidate:** an OSS project that addresses the requested capability,
  has no known conflict with a stated hard constraint, and has enough current
  evidence to evaluate material adoption risks. Viable does not mean
  recommended, risk-free, or fully verified; any unresolved hard constraint is
  disclosed per constraint and never scored as satisfied.
- **Hard constraint:** a non-negotiable, testable condition that disqualifies a
  candidate when violated, such as license, runtime, database, deployment,
  residency, or maintenance constraints.
- **Evidence:** a dated, attributable observation from a repository, release,
  package registry, advisory source, documentation page, local deterministic
  scan, or approved validation result. Public immutable evidence names an
  exact source-compatible revision and matching immutable locator; mutable
  official documentation discloses that limitation; approved validation uses
  a bounded validation reference, scope, and time without embedding provider
  output. Evidence records coherent publication or validation, collection, and
  freshness times.
- **Direct fact:** a fact observed directly from an approved manifest,
  lockfile, configuration shape, repository structure, or other authoritative
  data form without a reasoning step.
- **Declared fact:** a bounded assertion supplied by the developer or another
  approved declarative input. A declaration is not silently relabeled as a
  direct observation or derived conclusion.
- **Derived fact:** a scanner conclusion produced by applying a stated,
  deterministic rule to one or more observations. Its provenance remains
  distinct from direct and declared facts.
- **Inference:** a conclusion derived from one or more evidence items using a
  stated rationale. An inference is never presented as direct evidence.
- **Repository interview:** a planned candidate-owned semantic synthesis of
  documented positions, bounded inferences, limitations, contradictions, and
  unknowns from one exact immutable repository artifact set. It is independent
  of capability and ranking requests, cites exact artifact line intervals,
  never ranks or recommends, and is not itself direct evidence.
- **Unknown:** a decision-relevant fact that cannot be established from current
  evidence with sufficient confidence. Unknowns are preserved, not silently
  scored as favorable.
- **Candidate limitation:** a candidate-owned, bounded decision-relevant
  drawback or constraint whose statement and evidence references are retained
  from the supplied dossier into the assessment response. Retaining a
  limitation does not by itself reject the candidate.
- **Assessment processing state:** whether all supplied inputs and available
  evidence were processed. Complete processing can still disclose material
  unknowns or conclude `insufficient-evidence`; partial-evidence processing
  carries stable reason codes for what was incomplete.
- **Recommendation:** a ranked, repository-conditioned assessment of one or
  more viable candidates, including evidence, inferences, unknowns, tradeoffs,
  and reasons. It is decision support, not an autonomous selection.
- **Adoption plan:** a developer-reviewable sequence for integrating an
  approved candidate, including affected contracts and components, tests,
  security and operational work, migration, rollout, recovery, validation, and
  unresolved decisions.
- **Adoption outcome:** a structured record of what the developer chose, what
  was attempted, validation results, material plan deviations, completion or
  abandonment, and optional developer feedback. It must not include raw source,
  secrets, or unnecessary personal data.

## Data locality and transmission contract

### Stays local by default

- user target-repository source and documentation bodies, private repository
  material, and source outside a reviewed public-catalog selection;
- untracked files and local working changes;
- environment variables, credentials, tokens, cookies, and signing material;
- customer data, proprietary source excerpts, database contents, and logs;
- full configuration files that may contain sensitive values;
- the actual code edits, commands, test output, and validation performed by the
  coding agent; and
- target or dependency code execution.

The local scanner may derive facts from approved files, but it must not send
the underlying content merely because it was read.

Separately, curator-approved documents from the shared public candidate catalog
may be collected at an exact public Git commit and stored centrally as bounded,
immutable repository artifacts. That authority does not extend to a user's
target repository, private repositories, secrets, or arbitrary source
discovered outside the reviewed artifact-selection manifest. Public artifact
bodies remain hostile inert data: they are never executed, rendered, followed
as links, or treated as instructions. The active hosted fit operation may send
only deterministically selected exact-line excerpts for an evidence-needed
finalist after its artifact commit matches active repository-head evidence.
Those direct excerpts use the existing git-commit source variant, are not
persisted as duplicate evidence, and remain inert untrusted candidate data in
the one existing model request. A separately acknowledged Phase 7
repository-interview operation may later transmit one complete approved public
artifact set to a reviewed model provider under
[ADR 0007](../architecture/decisions/0007-evidence-grounded-repository-interviews.md).
That narrow authority does not include target-repository bodies, private
repositories, secrets, unapproved public material, or model tools.

### May be sent after minimization

- explicit capability request and hard constraints;
- dependency names and versions;
- runtime, framework, package-manager, database-library, and deployment-model
  identifiers;
- coarse repository capability, structure, identity, data-policy, and
  operational facts expressed through bounded stable codes and explicitly
  typed values;
- one-way identifiers or user-approved repository identifiers when needed for
  continuity;
- user-approved, bounded evidence excerpts required to resolve a material
  unknown; and
- minimized adoption outcomes and evidence references.

Every remotely accepted shape must be versioned and schema validated. Optional
source excerpts require a clear preview and affirmative approval. Collection,
retention, deletion, tenant isolation, and redaction controls must be defined
before private or user-derived remote storage is enabled. Shared public catalog
evidence uses attributable immutable records plus explicit supersession and
invalidation. Model output and retrieved content follow the same trust-boundary
rules as user input.

Repository fact shape and fact vocabulary evolve separately. Adding an
ordinary first-ecosystem code that uses an existing category, subject policy,
and explicit value variant updates the controlled vocabulary version and does
not require another serialized DTO form. Unknown codes and known codes with
unsupported semantics fail closed. Adding an arbitrary JSON carrier, free-form
scanner payload, source excerpt, configuration value, or a new structural value
kind is not a vocabulary extension and requires explicit contract review and,
when structural, schema-version negotiation.

## Private-alpha success measures

The first evaluation window is the first 30 completed discovery sessions across
at least 10 distinct consenting target repositories, with at least 4 sessions
in each selected capability family. A session is completed when the developer
records a decision or explicitly records that no responsible decision was
possible.

The alpha succeeds only if all of the following are met:

| Measure                      | Threshold                                                                                                                              | Evidence                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Hard-constraint safety       | 100% of recommendations have no reviewer-confirmed hard-constraint violation at decision time                                          | Constraint checklist and review outcome |
| Evidence traceability        | At least 95% of material factual claims have a resolvable source and collection date                                                   | Claim-to-evidence audit                 |
| Decision usefulness          | At least 70% of completed sessions result in a candidate shortlist or a reviewer-accepted “no viable candidate” conclusion             | Session outcome                         |
| Repository-conditioned value | At least 60% of developers rate the repository-specific comparison more useful than a generic search result, 4 or 5 on a 5-point scale | Post-session question                   |
| Planning quality             | At least 70% of accepted recommendations produce an adoption plan that a maintainer rates executable with no major missing work        | Plan review                             |
| Uncertainty calibration      | At least 90% of reviewer-identified material unknowns were disclosed before selection                                                  | Unknown audit                           |
| Privacy boundary             | Zero confirmed transmissions of secrets, unapproved raw source, or prohibited local data                                               | Security and audit review               |

Metrics are evaluated by capability family as well as in aggregate so one
well-performing family cannot hide a failing one. Results must include
abandoned sessions and “no candidate” outcomes.

## Falsification criteria

The private-alpha thesis is considered falsified, and expansion pauses, if any
of the following occurs in the evaluation window:

- two or more recommendations violate a stated hard constraint;
- any confirmed secret or unapproved raw-source transmission is attributable
  to the designed workflow;
- fewer than 40% of developers rate repository-conditioned comparison more
  useful than generic search;
- fewer than half of accepted recommendations yield an executable plan;
- more than 20% of material recommendation claims lack resolvable evidence;
- in three or more of the five families, maintainers find that generic
  documentation and search achieve equivalent decisions with no meaningful
  loss of time or quality; or
- outcome data cannot be collected with meaningful consent, minimization, and
  enough consistency to evaluate the learning loop.

A falsified threshold triggers analysis and a recorded decision to narrow,
redesign, or stop the relevant product direction. It must not be reclassified
as success by changing the denominator after results are known.

## First-release non-goals

The first release will not index all GitHub source, deploy to production
automatically, support arbitrary languages, execute untrusted OSS during
ingestion, write autonomously to a default branch, maintain dependencies
long-term, provide enterprise governance, or become a broad consumer GitHub
search website. It will not pre-build Redis, queues or worker fleets, vector
search infrastructure, microservices, Kubernetes, continuous crawling,
multi-tenancy or organization systems, billing, or repository interviews for
request-time serving without a concrete current blocker and observed evidence.
