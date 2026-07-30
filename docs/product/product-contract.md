# GitBlocks product contract

## Status and authority

This document defines the approved product boundary for the first private
alpha. GitBlocks remains in an engineering-foundation phase. The repository
now contains private production-owned packages for the pure domain, versioned
fixed-candidate contracts, and an injected PostgreSQL adapter for immutable
public evidence, dossiers, and exact repository artifacts, plus a bounded
public-source ingestion adapter. No repository-interview application, API, MCP
service, scanner, discovery service, model integration, deployed database,
deployment, or end-to-end adoption workflow is implemented or available yet.
Changes to this contract require an issue, an execution plan when substantial,
and architecture review.

## Product statement

GitBlocks is a planned agent-native open-source adoption layer. It will help a
developer's existing coding agent find, evaluate, plan, and learn from the
adoption of open-source software (OSS) using repository-specific evidence.

GitBlocks will own adoption intelligence, evidence, compatibility knowledge,
and the outcome-learning loop. The developer's coding agent will remain the
interactive execution runtime and will own local edits and validation.

## Target user and job to be done

The first user is a professional developer maintaining a TypeScript application
who already uses a coding agent and must add a common infrastructure capability
without making an expensive or unsafe dependency choice.

When that developer needs an OSS capability, they want their existing coding
agent to identify options that satisfy hard constraints, explain
repository-specific tradeoffs and uncertainty, and prepare an actionable
adoption plan so they can choose and integrate a dependency with less research
time and better evidence.

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

The planned workflow is:

1. **Frame the request.** The coding agent and developer state the desired
   capability, success conditions, explicit hard constraints, and which local
   facts may be shared.
2. **Fingerprint locally.** A deterministic local scanner observes approved
   manifests, configuration shapes, structure, and dependency facts. It emits
   closed, bounded facts from a controlled, versioned vocabulary and does not
   execute target or dependency code.
3. **Review and minimize.** The Skill shows or summarizes the fingerprint,
   removes unnecessary source content and secrets, and obtains approval for
   any optional evidence that would leave the local environment.
4. **Discover viable candidates.** Remote services retrieve candidates from a
   curated catalog and eliminate those that conflict with known hard
   constraints.
5. **Assess adoption fit.** Ranking combines repository facts with sourced
   compatibility, maintenance, security, licensing, and integration evidence.
   Planned candidate-owned repository interviews may contribute separately
   from deterministic candidate dossiers; neither is conditioned on the target
   request before this ranking step.
6. **Explain the result.** The coding agent receives candidates with evidence
   references, preserved candidate limitations, tradeoffs, material unknowns,
   and the reasons for exclusion or ranking. Every reason is traceable to
   candidate-owned evidence or inference, a disclosed material unknown, or a
   matching hard-constraint conflict. Direct observations, supplied
   declarations, and derived conclusions remain visibly distinct.
7. **Choose and plan.** The developer approves a candidate. The coding agent
   produces a structured adoption plan covering changes, tests, migration,
   rollout, rollback or forward recovery, and open risks.
8. **Integrate locally.** In a later product phase, and only with user
   approval, the existing coding agent may edit the local repository and run
   its normal validation. GitBlocks will not be an autonomous code-editing
   runtime.
9. **Capture an outcome.** With the developer's knowledge, a minimized,
   structured record of the selection, integration result, deviations, and
   validation may improve future recommendations.

A useful response may be “no viable candidate” or “insufficient evidence.”
GitBlocks must not manufacture certainty merely to return a ranked list.

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
  recommended or risk-free.
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
as links, or treated as instructions. A separately acknowledged Phase 7
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
search website.
