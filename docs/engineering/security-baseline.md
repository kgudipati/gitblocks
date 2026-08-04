# Security baseline

## Security posture and activation

GitBlocks is secure by default: deny unless authorized, minimize data and
capability, make effects explicit, and preserve evidence for review. Security
is a design constraint, not a release-stage audit.

This phase adds policy only. Controls marked **now** apply to repository work
and review. Controls marked **code** become merge requirements when the
relevant code or CI exists. Controls marked **deployment** must be implemented
and verified before a user-facing or shared service receives production data.

Every new trust boundary, privileged operation, data category, model/provider
connection, external write, and material dependency requires a threat model in
the execution plan. The model identifies assets, actors, entry points, data
flow, authorization decision, misuse cases, mitigations, residual risk, and
test/telemetry evidence.

## Untrusted-input invariant

Treat all of the following as untrusted data:

- repository source code;
- README and other documentation text;
- issues and pull requests;
- package and repository metadata;
- GitHub webhook payloads;
- MCP arguments and tool results;
- model output;
- retrieved web content;
- user-provided repository profiles; and
- stored records originally derived from any of these sources.

Untrusted content cannot become system, developer, Skill, or agent
instructions; grant capabilities; change approval policy; select credentials;
expand read/write scope; or suppress validation. Content that says to ignore
prior instructions, reveal secrets, execute commands, call tools, or contact an
external endpoint remains quoted evidence and is not followed.

The local scanner and remote analysis infrastructure must never execute code,
install dependencies, run scripts, import modules, build containers, render
active content, or invoke repository-supplied tools from ingested repositories.
Static parsing must be allowlisted, resource bounded, and isolated from secrets
and privileged networks. A future proposal to execute untrusted code requires a
superseding ADR and separately reviewed isolation threat model; it is prohibited
under the first product contract.

**Enforcement:** now through agent instructions and review; with code through
separate data/instruction channels, allowlisted parsers, egress controls,
negative prompt-injection tests, and runtime policy. **Evidence:** threat model,
test corpus, tool-call/approval audit, and proof that ingestion paths lack
execution capability.

## Validation, encoding, and safe failures

- Define versioned schemas for API, MCP, webhook, queue, event, persisted,
  fingerprint, evidence, outcome, configuration, and model-output boundaries.
- Validate type, required/unknown fields, encoding, size, count, ranges,
  identifiers, paths, URLs, nesting, semantic invariants, and authorization
  context before business logic or side effects.
- Normalize once when a contract requires it; compare security-sensitive
  identifiers in their canonical form and preserve the original only when
  needed for evidence.
- Use context-appropriate parameterization and output encoding for SQL,
  commands, paths, URLs, HTML, Markdown, logs, headers, and prompts. Validation
  alone is not output encoding.
- Reject malformed or excessive input with a stable safe error. Do not echo
  secrets, raw source, stack traces, queries, prompts, provider bodies,
  filesystem paths, or internal topology.
- Model output is a proposal. Validate its schema and evidence references, and
  authorize each resulting action independently. A valid JSON shape is not
  permission.
- Apply pagination, deadlines, cancellation, concurrency and cost limits,
  decompression/recursion bounds, and backpressure before accepting production
  traffic.

**Enforcement:** code-stage schema/negative/abuse tests, static analysis, and
review; deployment-stage gateway and runtime limits. **Evidence:** schemas,
boundary tests, fuzz/property tests where risk warrants them, and redacted
error snapshots.

## Authentication, authorization, and tenant isolation

- Authenticate every remote caller and service workload using the narrowest
  supported credential and validate issuer, audience, signature, expiry, and
  revocation/rotation state as applicable.
- Authorize every operation and object at the application boundary. Possession
  of an MCP connection, model session, repository identifier, or opaque object
  identifier is not authorization.
- Default deny. Permissions identify actor, tenant, action, resource, and
  relevant context. Administrative, ingestion, ranking, support, and user
  capabilities are separated.
- Tenant ownership is explicit in storage keys, cache keys, queue messages,
  evidence queries, telemetry access, and object-store paths. Every
  tenant-scoped read/write includes the tenant predicate; cross-tenant
  operations require a separately authorized administrative use case.
- Prevent confused-deputy behavior: a service validates that delegated
  authority covers the requested repository, outcome, provider, and external
  effect.
- Service identities and human roles follow least privilege, short credential
  lifetime, rotation, and auditable access. Production access is not shared
  through developer credentials.

**Enforcement:** architecture review before identity/storage selection;
code-stage unit, contract, and integration tests; deployment-stage policy,
credential rotation, and access review. **Evidence:** authorization matrix,
cross-tenant negative tests, access configuration, and audit events.

## Approval and external-effect boundaries

The developer's request authorizes only its stated scope. Destructive actions,
external writes, privileged operations, default-branch changes, publication,
deployment, credential changes, and operations with material or open-ended cost
require explicit approval immediately before the effect unless an approved
product contract defines a narrower preauthorization.

- Preview the exact target, action, data leaving the boundary, and material
  consequence.
- Validate and authorize again after model output and before execution.
- Use idempotency and a reviewable dry run where feasible.
- A refusal, timeout, or ambiguous response means no action.
- Never batch an approved safe read with an unapproved write.
- Record actor, tenant, operation, target identifier, policy decision, approval
  reference, result, and correlation identifier without sensitive payloads.
- The existing coding-agent host owns local edit and validation permissions.
  GitBlocks must not use remote recommendation as implicit permission to edit,
  commit, push, deploy, purchase, message, or delete.

**Enforcement:** code-stage application policy and negative tests;
deployment-stage audit and anomaly detection. **Evidence:** approval contract,
denial/expiry/replay tests, idempotency tests, and redacted audit record.

## Webhook verification

Before parsing or enqueueing a GitHub or provider webhook:

1. read only a configured maximum body size while preserving the exact signed
   bytes;
2. select the secret by trusted endpoint configuration, never an untrusted
   payload field;
3. verify the provider signature with the documented algorithm and
   constant-time comparison;
4. validate timestamp or delivery freshness when the provider supports it;
5. reject duplicate delivery identifiers within a defined replay window;
6. validate event type and version against an allowlist;
7. schema-validate the payload and authorize the referenced installation,
   tenant, and repository; and
8. enqueue an idempotent, bounded internal contract before acknowledging.

Secret rotation supports an explicit overlap window and never logs signatures
or bodies containing sensitive data. Invalid signatures, stale events,
duplicates, unknown types, wrong tenants, oversized bodies, and reordered
deliveries require negative tests. Retries must not repeat a non-idempotent
effect.

## Secrets and configuration

- Secrets belong in an approved secret manager or protected CI/runtime secret
  facility, never source, committed configuration, fixtures, snapshots,
  prompts, model context, command arguments where process listings expose them,
  issue/PR text, telemetry, or generated artifacts.
- `.env` values, credentials, cookies, access tokens, private keys, signing
  secrets, live customer data, and unapproved raw source must never be
  transmitted to a model or remote GitBlocks service.
- Provide non-secret example configuration using obvious inert values.
  Production must fail closed when a required secret or security setting is
  absent or malformed.
- Scope credentials to the minimum repository, operation, environment, and
  lifetime. Separate development, test, staging, and production credentials.
- Rotation and revocation behavior must be documented and tested before a
  secret-backed integration is production-ready.
- Run secret detection locally/CI when code and CI are introduced, and review
  the complete diff before push. A suspected committed secret is revoked first;
  history cleanup requires a separately authorized response plan.

**Evidence:** secret-scan result, configuration schema tests, least-privilege
permission inventory, rotation exercise, and absence of secret values in
telemetry/fixtures.

## Data protection and privacy

Before collecting a field, document its purpose, classification, source,
tenant, access roles, storage location, retention, deletion behavior, and
whether it reaches a model or third party. If no current purpose exists, do not
collect it.

| Class                  | Examples                                                                                | Baseline                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Prohibited remote data | Secrets, credentials, `.env` values, unapproved raw source, customer database contents  | Reject/redact before transmission; do not store                                                                               |
| Sensitive product data | Approved source excerpt, private repository identity, adoption outcome, user identifier | Explicit purpose and authorization, encryption in transit/at rest, tenant isolation, access audit, shortest defined retention |
| Operational metadata   | Stable error code, duration, counts, coarse runtime version                             | Minimize, bound cardinality, document retention, do not attach source or prompt content                                       |
| Public evidence        | Public release/package/advisory facts                                                   | Preserve source, collection time, license/usage constraints, freshness, and correction/deletion status                        |

Use identifiers instead of content in telemetry. Redaction happens before
logging, tracing, storage, or model calls and is tested against structured and
free-text fields. Backups, caches, derived indexes, evaluation corpora, and
outcome-learning data follow the same deletion and retention policy as their
source. Production collection of sensitive, private, or user-derived content
cannot begin until retention and deletion are implemented and a user can
understand what leaves the local boundary. Shared public catalog evidence uses
the immutable correction/invalidation lifecycle defined by ADR 0004.

## Public evidence persistence boundary

Phase 4 PostgreSQL records are a shared public catalog. The runtime uses one
non-owner, non-superuser group role with explicit schema/table/sequence
grants. There is no tenant context, tenant-private row, expiry, purge, tenant
deletion, tombstone, organization model, or row-level-security policy. Adding
any private or organization-scoped record requires a named application
consumer, authorization model, threat model, retention/deletion decision, and
architecture review.

Database ownership constraints preserve candidate and reference integrity.
Evidence, limitations, unknowns, lifecycle events, snapshots, and snapshot
membership are immutable. Lifecycle corrections append rather than overwrite.
Every applicable evidence timestamp must satisfy the requested evidence-world
cutoff, and active dossier material excludes a limitation or unknown when its
supporting evidence is no longer active. Tests exercise operations through a
non-owner role and verify that the schema contains no private-scope or RLS
surface.

Phase 5 public ingestion accepts only curator-owned GitHub/npm identities,
fixed HTTPS provider hosts, closed bounded JSON, and up to three explicitly
allowlisted files at an exact commit. The reusable core receives credentials
and database configuration by injection and emits value-free errors and
allowlisted telemetry. It does not retain raw responses, follow cross-host
redirects, clone repositories, fetch tarballs, or execute candidate content.
The operator requires an explicit approved non-production database
acknowledgement.

The stable curator GitHub identity and `introducedAt` are immutable persistence
input. A provider canonical move is permitted only for a manifest entry marked
`moved` and is stored as evidence, never as an identity rewrite. License
requests include the captured commit `ref`; returned path/name/SHA are bounded,
and the evidence URL is constructed from current canonical location, exact
commit, and exact path.

Phase 6 public artifact collection is separately declaration-driven by the
closed `public-artifacts-v1` manifest. It accepts only exact-commit ordinary Git
blobs after explicit repository hash-algorithm discovery, bounded
non-recursive tree verification, strict base64 and UTF-8 validation, NUL and
binary rejection, provider-object recomputation, and independent content
hashing. Artifact content is hostile inert data: it must not be rendered,
executed, followed as links, interpreted as instruction, logged, emitted to a
terminal, copied into receipts, or committed in fixtures or completion
evidence. The Phase 6 collector itself never sends content to a model. Only
curator-approved public catalog artifacts may be stored centrally;
target-repository bodies and unapproved material remain local by default.

Phase 7 implements a separate, explicitly acknowledged offline
repository-interview composition root under
[ADR 0007](../architecture/decisions/0007-evidence-grounded-repository-interviews.md).
It may send one complete exact approved public artifact set to one reviewed
provider only after deterministic reconstruction, ownership closure, byte and
token preflight, and cost authorization. Repository content remains delimited
untrusted data; the request enables no tools, search, code execution, MCP,
background state, conversation, or previous response. The model sees temporary
artifact aliases and machine line numbers, not candidate/repository identity,
GitBlocks IDs, dossier content, target facts, credentials, or ranking context.
Trusted code validates the closed provider output, resolves citations, derives
all identity/provenance, and publishes nothing after an operational or policy
failure. Errors, telemetry, receipts, and evaluation audit files remain
content-free. The bounded direct Responses adapter maps the accepted
`promptCacheRetention: in-memory` profile only to the explicit request field
`prompt_cache_retention: "in_memory"`; it rejects omission, `"24h"`, cache
keys, options, breakpoints, TTL controls, and caller/environment/credential
overrides. `store: false` and explicit in-memory request intent do not
represent Zero Data Retention or prove that abuse-monitoring or other
organization-level retention is absent. The adapter does not inspect or verify
ZDR. Before Milestone 11 can make any provider call, a separate pre-live gate
must either verify ZDR for the exact OpenAI organization/project or cite
updated authoritative OpenAI documentation or provider confirmation proving
the field's effective behavior for the exact dated snapshot.

The operator requires the database-name acknowledgement before any environment
read, connection, clock, nonce, telemetry, provider, or filesystem-write
effect. It accepts individual database fields rather than a URL, never accepts
passwords in argv/config/receipts, never applies migrations, and retrieves the
named OpenAI token lazily only when a provider operation begins. Selection,
policy, telemetry, diagnostics, and receipts remain content-free. Final receipt
creation is exclusive, mode `0600`, symlink-resistant, flushed, and
non-overwriting. Dry-run validates complete configuration and worst-case
budgets with zero secret, database, provider, time, telemetry, or write effects.
These controls do not authorize a real credential or provider request.

Milestone 10 adds a content-free pre-live layer without weakening that
boundary. Committed candidate plans contain membership only and never contain
artifact-set IDs, repository IDs, commits, artifact IDs, paths, URLs, or
selection identity. The raw artifact-receipt parser remains owned by ingestion.
The separate non-production materializer accepts only a complete fresh
150-candidate receipt, reads only its explicitly named synthetic database
password, loads sets only by receipt-provided IDs from that same acknowledged
ephemeral database, writes only an untracked selection and binding with mode
`0600`, and never reads a provider token or constructs a provider. It rejects
partial authority groups, symlink/nonexclusive output, migration drift, and
all cross-file mismatches before publishing output.

The committed readiness policy deliberately leaves fresh materialization,
retention, pricing, model calibration, maintainer live authorization,
ephemeral database, provider credential, and audit assignments unsatisfied.
Explicit `store: false` and `prompt_cache_retention: "in_memory"` remain request
intent, not ZDR evidence. Synthetic retention and pricing digests in tests are
not substantive approvals, and no real authorization is committed.

Migration 0004 persists only the approved request, execution, interview, and
normalized semantic-member contracts. It excludes prompts, alias registries,
artifact bodies, raw provider output, reasoning, refusal/error text,
credentials, review, and selection data. Deferred closure binds every durable
citation to one `present` artifact-set member and an inclusive range within its
recorded logical-line count. All eight tables are append-only for owner and
runtime connections; runtime receives only `SELECT` and `INSERT`, public
receives no schema, table, or function privilege, and no row-level security
policy is introduced. Record collisions, partial histories, and corrupt
eligible reuse records fail closed rather than being overwritten or repaired.

Only an explicitly approved optional 404 is normal absence. Temporary optional
unavailability creates a partial receipt but no dossier or durable transient
material. Caller cancellation, deadline, rate limit,
authentication/authorization, identity mismatch, malformed response,
unsupported content type, body limit, redirect violation, and invariant
failure remain stable fatal outcomes. None may be converted into favorable,
missing, or partial evidence.

## Auditability and security telemetry

Create structured audit events for authentication, authorization decisions,
administrative changes, approval-gated effects, webhook verification, data
export/deletion, secret/configuration changes, security exceptions, and
security-relevant model/tool rejections.

Audit records contain stable event/action/result codes, timestamp, actor/workload
identifier, tenant, target identifier, policy version, correlation identifier,
and reason category. They exclude credentials, tokens, raw source, prompts,
model output bodies, webhook bodies, exploit payloads, and unnecessary
personal data. Access to audit data is itself authorized and audited. Retention
and tamper resistance are defined before production.

Operational logs do not substitute for audit records. Alerting begins with
deployment and covers repeated auth failures, cross-tenant denials, signature
failures, approval bypass attempts, secret-detector findings, ingestion bounds,
and abnormal privileged access without using attacker-controlled values as
metric labels.

## Dependencies and software supply chain

At code/CI introduction:

- use one approved package manager and commit its lockfile;
- pin direct dependency ranges according to the stack ADR and review resolved
  transitive changes;
- justify each production dependency and review maintenance, provenance,
  license, advisories, install/build scripts, permissions, and replacement
  cost;
- disable or isolate dependency lifecycle scripts unless explicitly required
  and reviewed;
- pin GitHub Actions by immutable commit SHA and record the human-readable
  release in a comment or update record;
- grant workflow tokens and network access least privilege; do not expose
  secrets to untrusted PR code;
- run dependency, license, secret, static, and artifact scans selected by the
  stack/security plan; and
- define a patch/update cadence and emergency revocation path.

Before distributing artifacts, add an SBOM and verifiable build provenance
roadmap aligned to [SLSA 1.2](https://slsa.dev/spec/v1.2/). Build artifacts must
come from an isolated, review-controlled pipeline; signing/provenance secrets
must not be accessible to build steps. Generated code and build outputs identify
their generator and inputs, and CI detects drift.

ADR 0002 activates exact dependency pins, a frozen lockfile, default-denied
lifecycle scripts, secret and dependency scans, and read-only CI for repository
tooling. No product artifact, deployment, release pipeline, signing key, or
production credential is introduced by Phase 1.

## Vulnerability handling

Follow [SECURITY.md](../../SECURITY.md) for private reporting. Do not place
secrets, exploit details, private-repository content, or unredacted logs in a
public issue.

While the repository remains private, authorized collaborators use the
existing private access or project-communication channel described in
`SECURITY.md`, with no sensitive detail in the initial message. Before the
repository becomes public or has a public release, maintainers must configure
and verify GitHub private vulnerability reporting after publication or a
dedicated security contact channel. That readiness check is an incomplete,
release-blocking control.

Maintainers must:

1. acknowledge through the private channel;
2. preserve the report with least-privilege access;
3. validate scope and severity without executing untrusted proof-of-concept
   code on a privileged workstation;
4. contain exposed credentials/data first;
5. create a private remediation and test plan;
6. fix the root cause with a regression or abuse test;
7. assess affected versions, tenants, data, and dependencies;
8. coordinate disclosure and release notes;
9. notify affected users when required; and
10. record lessons and preventive controls without publishing sensitive
    details prematurely.

Severity drives response priority, but an unavailable formal score does not
delay containment of credible secret exposure, remote execution, tenant
escape, authentication bypass, or destructive-action vulnerability.

## Phase 8 deterministic retrieval boundary

Phase 8 taxonomy and query-normalization inputs are untrusted bounded data.
Canonical taxonomy identifiers and lookup aliases are ASCII-only and exactly
version-bound; Unicode is retained only in bounded display labels. Fuzzy
matching, transliteration, confusable folding, and NFKC-based semantic merging
are prohibited for hard constraints. Mixed-script or confusable terms become
unknown or clarification-required. Alias collisions, deprecated-alias reuse,
missing parents, cycles, excessive graph depth, and nondeterministic traversal
fail closed.

Milestone 2 implements this taxonomy boundary as reviewed source plus a
canonically generated authority. Resolved aliases, intentional ambiguities,
and adjacent/excluded terms are disjoint record classes. An intentional
ambiguity with two or more active possible concepts is valid authority, not an
alias validation failure; exact lookup returns it as ambiguous and does not
choose a meaning. Raw-term canonicalization and the resulting
clarification-required flow remain Milestone 3 work.

The package-local authority command reads only the fixed versioned source and
manifest paths, enforces one-MiB regular-file bounds, rejects symlink and root
path escapes, returns bounded value-free errors, and writes only the manifest
under an explicit generation command. Ordinary validation performs no write
and reads no candidate artifact or provider data.

Local pre-contract query input may retain bounded original terminology,
explicit requirements, preferences and prohibitions, exact candidate or brand
references, and an optional minimized repository-fingerprint reference. It
must not retain secrets, raw source, configuration values, or transcripts.
Normalization preserves source and rule identity and never weakens a hard
constraint. Candidate facts come only from approved deterministic inputs with
explicit provenance and value state; dossier observation prose and repository
interviews cannot populate deterministic profile authority.

Retrieval/query evaluation is an outward consumer of product authority.
Product packages must not import its schemas, corpus, gold, scorers, fixtures,
or harness code. Ordinary Phase 8 implementation and validation are offline:
they make no provider or model call and use no Phase 7 container, database,
receipt, or repository-external evidence. Any final 150-candidate live
materialization requires separate authorization, a fresh dedicated ephemeral
PostgreSQL database, the existing approved public-source boundaries, no model
call, and content-free receipts and coverage evidence.

## Security exceptions

An exception must be a reviewed artifact linked from the PR and contain:

- the exact rule and affected assets;
- the threat, likelihood, impact, and compensating controls;
- the accountable owner;
- an expiration date;
- a remediation issue and verification plan; and
- approval from a maintainer and a security reviewer when one is designated.

Exceptions fail closed at expiration. “Legacy,” “temporary,” schedule pressure,
and test flakiness are not compensating controls. Prohibitions on secret
exposure, executing ingested code, silent cross-tenant access, or unapproved
destructive/default-branch writes cannot be waived through a routine PR.

Repository-interview evaluation is an outward consumer only. Product packages
must not import evaluation schemas, audit records, gate reports, harness code,
or corpus data. Committed audit authority contains opaque reviewer and durable
record identifiers plus controlled verdicts only—never names, email addresses,
notes, prompts, provider output, semantic statements, citations, repository
content, or credentials. Synthetic hostile fixture text is inert test data;
ordinary validation performs no provider, network, database, environment, or
credential effect.

## Standards mapping

This mapping supplies traceability, not certification and not a copy of the
external standards.

| GitBlocks control area                                                                               | NIST SSDF 1.1 practice group       | OWASP verification focus                                                                                                                                                                                                                                                                                                                                                                                         | Activation                                                  |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Requirements, threat models, review gates, roles, exceptions                                         | Prepare the Organization (PO)      | ASVS architecture, threat modeling, and secure development lifecycle; AISVS governance                                                                                                                                                                                                                                                                                                                           | Now; automation with code                                   |
| Protected source, least privilege, dependency review, lockfiles, pinned CI, provenance               | Protect the Software (PS)          | ASVS configuration and dependency controls; SLSA source/build integrity                                                                                                                                                                                                                                                                                                                                          | Source controls now; supply-chain automation with code/CI   |
| Secure design, validation, authorization, errors, tenant isolation, tests, prompt-injection boundary | Produce Well-Secured Software (PW) | [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/) authentication, authorization, validation, encoding, API/web service, data protection, and logging requirements; [OWASP AISVS 1.0](https://owasp.org/www-project-artificial-intelligence-security-verification-standard-aisvs-docs/) AI input, model-output, tool/action, data, privacy, and monitoring requirements | Design now; tests and runtime controls with code/deployment |
| Reporting, triage, remediation, regression tests, disclosure, lessons learned                        | Respond to Vulnerabilities (RV)    | ASVS control verification and regression evidence                                                                                                                                                                                                                                                                                                                                                                | Policy now; operational process before release              |

The governing NIST reference is
[SP 800-218, SSDF 1.1](https://csrc.nist.gov/pubs/sp/800/218/final).
Plans must select the specific requirements relevant to their changed boundary;
claiming general alignment does not replace testable controls.
