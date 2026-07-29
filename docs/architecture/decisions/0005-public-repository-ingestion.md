# ADR 0005: Curated public repository ingestion

- Status: accepted
- Date: 2026-07-29
- Decision owners: GitBlocks maintainers
- Governing issue:
  [#13 — Phase 5: Ingest and profile a curated public OSS catalog](https://github.com/kgudipati/gitblocks/issues/13)
- Execution plan:
  [Phase 5 curated public repository ingestion](../../plans/0013-public-repository-ingestion.md)
- Related decisions:
  [ADR 0001](0001-agent-native-delivery.md),
  [ADR 0002](0002-typescript-workspace-and-toolchain.md),
  [ADR 0003](0003-product-contract-kernel.md),
  [ADR 0004](0004-postgresql-evidence-persistence.md)

## Context

GitBlocks has a pure domain/contract kernel and immutable public PostgreSQL
evidence storage, but it has no real public catalog or source ingestion path.
The next product risk is whether changing public repository and package data
can be collected safely, normalized without a model, refreshed without
overwriting history, and represented honestly through existing product
contracts.

Broad discovery would scale unknown source quality before this loop is proven.
Phase 5 instead needs one bounded operator-controlled path:

```text
curated manifest
  -> approved public providers
  -> normalized source bundles
  -> deterministic profiles
  -> immutable evidence and exact dossier snapshots
```

External repository, package, advisory, and file content is untrusted data.
It cannot become instructions and must never be cloned, installed, imported,
built, tested, executed, or sent to a model.

## Decision

### Curated-manifest-first strategy

Use a version-controlled `catalog/public-v1/manifest.json` as curator-owned
input. Do not implement GitHub-wide discovery or npm search.

The manifest contains exactly one stable candidate identity per canonical
GitHub repository and explicit primary/additional capability families. Provider
responses remain evidence authority; curator rationale never overrides a moved,
private, mismatched, archived, deprecated, or otherwise limited live identity.

The V1 repository bounds are:

- minimum 100 unique repositories;
- target 150;
- hard maximum 200; and
- minimum 20 primary repositories in each of authorization, audit logging,
  background jobs, rate limiting, and webhooks.

The target is 30 primary repositories per family. The catalog deliberately
mixes libraries, framework integrations, self-hostable services,
package-backed and repository-only projects, mature and newer projects, and a
small explicit set of negative controls. Stars, forks, download counts, and
other popularity values are not inclusion or compatibility rules.

Every entry carries a bounded curator rationale and official GitHub/npm
selection-source URLs. Canonical repository and npm identities are compared
case-insensitively, while stable candidate IDs remain exact lowercase values.
The manifest is closed, deterministically ordered, and SHA-256 digested over
canonical JSON with the digest field omitted.

### Package and dependency direction

Add exactly one private strict-ESM production package:

```text
@gitblocks/ingestion
        |
        v
@gitblocks/persistence
        |
        v
@gitblocks/contracts
        |
        v
@gitblocks/domain
```

The package contains the manifest parser, provider transport/clients,
normalized source bundles, deterministic profile and refresh rules, Phase 4
persistence composition, bounded batch orchestration, receipt parser, and
operator scripts.

It is an operational batch adapter, not an application layer. It owns no
discovery, ranking, fit execution, API/MCP transport, model, embedding, queue,
worker service, scheduler, daemon, deployment, tenant, organization, or private
repository behavior.

Reusable core configuration, fetch, clock, database client, deadline, and
observer capabilities are injected. Imports perform no network or database I/O,
read no environment variable, create no client/singleton, and schedule no work.
Only explicit operator scripts read documented flags and environment values.

### Native Node transport and dependencies

Use Node 24 native `fetch`, Web Streams, `URL`, `AbortSignal.any`,
`AbortSignal.timeout`, `TextDecoder`, `Buffer`, and `node:crypto`. Add no
external production dependency.

Node 24 documents stable global fetch and abort composition:
[Node 24 global APIs](https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html).
These APIs provide the required HTTPS requests, manual redirect observation,
cancellation, streamed decoded-byte counting, bounded text decoding, and
SHA-256 hashing.

An Octokit, npm-registry client, retry library, schema library, or general HTTP
client would be convenience rather than a missing correctness control. Each
would expand provider types, lifecycle policy, lockfile, audit, and
replacement cost while fixed-endpoint validation would still be owned here.
There is therefore no external dependency version, license, publisher,
publication date, peer, lifecycle, advisory, provenance, or transitive graph to
approve for this ADR.

The owned transport's replacement cost is limited to the fixed host, redirect,
body, content-type, JSON, retry, deadline, and safe-error policies below.

### Fixed providers, API versions, endpoints, and media types

#### GitHub repositories

Use only `https://api.github.com`, authenticated by an injected fine-grained
personal access token or GitHub App token with the minimum public repository
contents-read capability.

Every request sends:

```text
Accept: application/vnd.github+json
Authorization: Bearer <injected token>
X-GitHub-Api-Version: 2026-03-10
User-Agent: gitblocks-ingestion/1
Accept-Encoding: identity
```

GitHub documents `2026-03-10` as the current version and the older default
`2022-11-28` as supported through 2028-03-10:
[REST API versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions?apiVersion=2026-03-10).

Selected GET endpoints:

- `/repos/{owner}/{repo}` for canonical identity, public visibility, fork,
  archive, description, topics, homepage, default branch, timestamps, and
  declared license key;
- `/repos/{owner}/{repo}/commits/{defaultBranch}` for the exact head and commit
  time;
- `/repos/{owner}/{repo}/releases?per_page=5&page=1` for selected releases;
- `/repos/{owner}/{repo}/tags?per_page=5&page=1` for selected tags;
- `/repos/{owner}/{repo}/license` for license metadata;
- `/repos/{owner}/{repo}/community/profile` for selected community/security
  metadata; and
- `/repos/{owner}/{repo}/contents/{path}?ref={exactCommitSha}` for manifest
  allowlisted small files.

The GitHub contents endpoint accepts a commit in `ref`, reports file type, and
can otherwise resolve symlinks:
[repository contents](https://docs.github.com/en/rest/repos/contents?apiVersion=2026-03-10).
GitBlocks therefore requires an object response whose type is exactly `file`,
encoding is supported, reported SHA/content is bounded, and requested `ref` is
the already collected exact head commit. It never follows returned download
URLs.

#### npm

Use only:

```text
GET https://registry.npmjs.org/{encoded-package}
Accept: application/json
Accept-Encoding: identity
```

The official npm registry documentation defines this full package metadata
document (packument), including package identity, dist-tags, publication times,
repository linkage, license, and full selected-version metadata:
[npm package metadata](https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md).
The same documentation warns that publisher-provided fields historically were
not validated by npm.

The client parses only:

- exact package name;
- selected `latest` dist-tag and a bounded dist-tag summary;
- selected version and its publication time;
- repository linkage;
- license;
- Node engine declaration;
- `type` and bounded export-shape classification; and
- deprecation presence.

It discards author/maintainer/contributor personal data, README text, scripts,
dependency graphs, tarball URLs, attachments, and every unselected version
field after validation. It never requests a search endpoint or tarball and
never installs a package.

#### Security advisories

Select GitHub Global Security Advisories, using the same fixed GitHub host,
token, API version, media type, and rate-limit policy:

```text
GET /advisories
  ?type=reviewed
  &ecosystem=npm
  &affects={package}@{exactVersion}
  &sort=updated
  &direction=asc
  &per_page=100
```

GitHub documents stable GHSA identifiers, reviewed advisory filtering,
`affects=package@version`, publication/update/withdrawal times, and cursor
pagination:
[global security advisories](https://docs.github.com/en/rest/security-advisories/global-advisories?apiVersion=2026-03-10).

OSV API 1.0 was the serious alternative. It provides exact package/version
queries, stable OSV identifiers, published/modified/withdrawn times, affected
versions, and a documented 32 MiB HTTP/1.1 response ceiling:
[OSV API](https://google.github.io/osv.dev/api/) and
[OSV schema](https://ossf.github.io/osv-schema/).
It is not selected because its additional host and POST query/retry boundary do
not improve the required V1 result over GitHub's reviewed exact-version GET.

Only advisories returned by the exact reviewed query become evidence. A
zero-result response is not proof of no vulnerability and creates a material
coverage unknown. A provider failure also creates explicit partial coverage
without deleting or invalidating prior advisory evidence.

### Authentication and secret handling

The reusable package accepts token/config values directly and never reads an
environment variable. The live CLI requires an explicitly injected GitHub
credential and PostgreSQL configuration plus an exact acknowledgement that the
database is an approved non-production ingestion target.

Tokens, authorization headers, cookies, database passwords/URLs, provider
bodies, and raw files never appear in errors, logs, structured events,
receipts, fixtures, documentation, or committed artifacts. Public source reads
need no provider write permission. The PostgreSQL runtime remains the Phase 4
non-owner, non-superuser role; migrations remain a separate explicit owner
operation.

### Host, URL, redirect, and private-repository policy

Transport hosts are exactly:

```text
api.github.com
registry.npmjs.org
```

Requests must use HTTPS port 443, no user information, fragment, or
caller-provided arbitrary URL. Provider clients construct URLs only from
strictly validated manifest identity/path values.

Fetch uses `redirect: manual`. A redirect is followed only when:

- its absolute resolved URL remains HTTPS;
- its hostname remains the original approved host;
- its port remains empty/443;
- it contains no user information or fragment; and
- the chain stays within two hops.

Cross-host, downgrade, excess, missing-location, and malformed redirects fail
closed. A same-host canonical repository move is recorded and compared with the
manifest; it becomes moved identity evidence/limitation and never silently
rewrites curator input.

Repository responses must prove `private: false` and public visibility. A
private, internal, ambiguous, missing, or unauthorized identity fails the
candidate before persistence.

### Content type, body, JSON, file, and timeout bounds

| Resource                            |           Bound |
| ----------------------------------- | --------------: |
| GitHub repository/advisory JSON     |   2 MiB decoded |
| npm full packument JSON             |  16 MiB decoded |
| GitHub file API response            | 192 KiB decoded |
| decoded allowlisted file            |          64 KiB |
| decoded allowlisted total/candidate |         128 KiB |
| allowlisted files/candidate         |               3 |
| JSON depth                          |              32 |
| JSON object/array nodes             |         100,000 |
| object properties                   |          20,000 |
| scalar string                       |           1 MiB |
| redirects                           |               2 |
| request timeout                     |      10 seconds |
| candidate deadline                  |      90 seconds |
| full run deadline                   |      60 minutes |

JSON responses accept only `application/json`,
`application/*+json`, and the exact selected GitHub JSON media types with an
optional charset. File objects must carry GitHub JSON media type; decoded file
bytes are classified locally from the allowlisted path and are never active
rendered content.

The transport reads `Response.body` incrementally, counts bytes delivered
after fetch content decoding, cancels on the first byte over budget, then
decodes UTF-8 strictly and parses JSON. A post-parse iterative preflight
enforces the depth, node, property, string, finite-number, plain-object, and
array bounds before provider mapping.

### Request, pagination, concurrency, deadline, and retry policy

Per candidate:

- six base GitHub repository requests;
- zero to three allowlisted file requests;
- zero or one npm packument request;
- zero to two advisory pages, 100 results per page; and
- no more than 12 total provider requests.

Candidate concurrency defaults to three and is configurable only from one to
three. Requests inside one candidate are serial. GitHub recommends serial
requests to reduce secondary-rate-limit risk:
[REST best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api?apiVersion=2026-03-10).

Every request combines the caller, candidate, and ten-second attempt signals.
Work does not begin after an already-exceeded candidate or run deadline.
Response streams and timers are cleaned on success, failure, timeout, and
cancellation.

Only safe idempotent GET requests retry. There is one initial attempt and at
most two retries for network failure, 408, 429, 500, 502, 503, or 504. Other
4xx responses, content/validation failures, private identity, and unknown
failures do not retry.

Ordinary transient backoff is exponential from 250 ms with deterministic
per-request/per-attempt jitter and a 5-second maximum. For GitHub 403/429:

1. honor `Retry-After` exactly when valid;
2. otherwise, when `X-RateLimit-Remaining` is zero, wait until
   `X-RateLimit-Reset`; and
3. otherwise classify secondary limiting and require at least 60 seconds.

GitHub documents those rules and warns that continued requests while limited
may lead to banning:
[rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).
If the required delay exceeds 60 seconds or the remaining caller deadline, the
client does not retry early; it returns a stable rate-limit failure and the
batch stops starting new GitHub work.

Rate-limit limit/remaining/reset values are validated, bounded, and summarized
in the receipt. Provider messages and response bodies are never inspected to
construct public errors.

### Allowlisted repository-file policy

Structured provider APIs are preferred. A candidate may name up to three exact
paths:

- root `package.json`;
- a specifically named ASCII workspace path ending in `package.json`;
- root `SECURITY.md`; or
- root `LICENSE`, `LICENSE.md`, or `LICENSE.txt`.

The total stays within the three-file limit. Paths:

- are normalized forward-slash relative ASCII;
- are at most 128 characters with bounded segments;
- have no leading/trailing slash, empty segment, dot, dot-dot, backslash,
  percent, NUL/control, or encoded traversal;
- are deterministically ordered and unique; and
- match the closed allowlist above.

The package does not fetch READMEs, source files, arbitrary documentation,
recursive directories, Git trees, archives, releases assets, submodules,
symlinks, or download URLs. JSON file parsing is bounded by the same depth/node
policy. No retrieved text is treated as an instruction.

### Normalized source bundles and raw-response retention

Provider clients validate untrusted `unknown` values into small closed internal
records. These records include only facts required by the profile rules and
safe operational request/rate-limit counts. Provider response bodies, headers,
README/source text, author/maintainer/contributor data, and unselected npm
versions are not returned from clients or persisted.

There is no raw response cache in source, CI, local defaults, PostgreSQL, or
receipts. An operator who needs protocol diagnosis uses redacted bounded
status/reason telemetry and reviewed fixtures; enabling raw retention requires
a new security/retention decision.

### Deterministic profile rules

Use rules version:

```text
public-profile-rules/1.0.0
```

The profiler is a pure function of:

- one validated manifest candidate;
- one normalized source bundle;
- prior active Phase 4 material; and
- the versioned rule constants.

It creates only facts directly established by selected structured sources:

- canonical public repository identity;
- current exact head;
- release/tag state;
- repository/package linkage;
- repository/npm license declarations;
- archive, move, fork, and package deprecation state;
- selected npm version/publication, declared Node engine, and package-format
  classification;
- repository push/release timestamps;
- applicable reviewed advisory presence; and
- community-metadata security-policy presence.

The profiler does not infer compatibility or quality from stars, forks,
downloads, topics, generic descriptions, or marketing text. It does not create
a ranking, score, viability decision, or model call.

Missing decision-relevant facts become bounded unknowns. Directly established
drawbacks become limitations, including archive/deprecation, identity mismatch,
ambiguous license, declared unsupported runtime, applicable advisory, stale
release state, move, negative-control status, and missing security policy. A
limitation is descriptive and never automatically rejects or ranks a
candidate.

### Deterministic IDs and canonical inputs

Canonical JSON recursively sorts object keys, preserves already canonical
array order, and rejects non-JSON values before SHA-256.
Every ID input starts with a kind and format-version domain separator.

- Candidate IDs are exact curator-owned manifest values.
- Evidence IDs bind candidate, logical topic, source kind, profile rules, and
  exact immutable revision or normalized source-record digest.
- Limitation and unknown IDs bind candidate, code/topic, rules version, exact
  statement, and ordered supporting evidence IDs.
- Supersession IDs bind candidate, old/new evidence IDs, reason, and lifecycle
  semantics.
- Invalidation IDs bind candidate, evidence ID, reason, and lifecycle
  semantics.
- Snapshot IDs bind candidate, capability family, rules version, evidence
  cutoff, and exact ordered evidence/limitation/unknown IDs.

Persisted identifiers are `<kind>-<first 40 lowercase SHA-256 hex characters>`,
providing a 160-bit suffix within the existing 64-character product limit. The
full digest is retained only in a bounded in-memory collision registry during
derivation. The same short ID with a different full
digest fails as `ingestion.identifier-collision`. A cross-run collision reaches
Phase 4 complete-record conflict handling and fails safely.

The manifest and receipt retain full 256-bit SHA-256 digests.

### Collection time, evidence cutoff, and unchanged-source idempotency

Public evidence source variants include collection time, while Phase 4
idempotency compares the complete immutable record. Regenerating an unchanged
observation with a new collection timestamp under the same evidence ID would
therefore conflict.

The profiler first derives the evidence ID without wall-clock collection time.
When that ID exists in prior active material, it reuses the exact prior
observation, including original collection/freshness values. A new or changed
normalized record uses the current injected collection time and a new ID.

Candidate persistence creation time is the immutable catalog publication time.
Limitation, unknown, lifecycle, and snapshot creation times derive from the
exact profile evidence cutoff. The evidence cutoff is the maximum applicable
publication/collection/validation/freshness time in the exact material, not the
batch completion time.

Consequently:

```text
same manifest + unchanged normalized providers
  -> exact reused observations
  -> identical complete records
  -> identical evidence cutoff
  -> identical snapshot identity
```

### Refresh and lifecycle behavior

Profiles use stable logical topics. For each successfully collected
authoritative topic:

- same evidence ID: reuse the exact old record;
- new fact: append new evidence;
- changed fact: append new evidence and deterministic supersession;
- old fact no longer established by a complete authoritative source: append
  deterministic invalidation;
- provider temporary failure: preserve old history and create no invalidation;
- move/archive/deprecation: append the new directly established evidence and
  limitation;
- new/updated advisory: append or supersede advisory evidence;
- withdrawn advisory: append the withdrawal state and supersede the earlier
  advisory observation.

GitHub repository/head identity and npm metadata for a mapped package are
required candidate sources. If incomplete, no dossier snapshot is created.
Advisory coverage is an explicit partial-evidence policy: zero results or
temporary failure produces a bounded material unknown, never fabricated clean
evidence and never historical deletion.

### Candidate transaction and batch partial-failure boundaries

No persistence migration or new cross-package transaction API is added.
Phase 4 already guarantees complete-record idempotency, atomic immutable
appends, serialized candidate lifecycle, and atomic exact snapshot roots plus
membership.

For one candidate, Phase 5:

1. collects every required source before persistence;
2. validates every intended candidate-family dossier through the product
   contract before writing a snapshot;
3. loads prior active material;
4. writes candidate identity and complete current family membership;
5. appends new evidence and justified lifecycle records;
6. appends exact limitations/unknowns;
7. creates each exact snapshot only after all material is ready; and
8. immediately reloads every snapshot to prove reconstruction.

Successful immutable writes may remain when a later transient failure occurs;
their stable complete records make retry coherent. A snapshot is never
partially inserted. A failure between multiple family snapshots is recorded as
a stable partial candidate failure and an unchanged rerun converges.

Candidates are independent. The batch does not wrap the manifest in one
transaction and never rolls back completed candidates because another
candidate failed. Candidate concurrency is bounded; duplicate concurrent
ingestion converges through Phase 4 locks and complete-record checks.

### Receipt contract

Use closed receipt version:

```text
public-ingestion-receipt/1.0.0
```

It records catalog/rules versions, manifest digest, run ID/start/end,
requested/completed repositories, candidate-family profiles, provider request
counts, candidate/evidence/snapshot created/idempotent counts, lifecycle and
limitation/unknown counts, failures grouped by stable reason code, bounded
rate-limit summary, migration version, optional second-run comparison, and a
full deterministic SHA-256 digest over canonical JSON with the digest omitted.

Run ID binds receipt version, manifest digest, and injected start time.
Created/idempotent classification uses pre-write Phase 4 active/snapshot reads;
the persistence adapter remains unchanged.

Receipts exclude candidate/provider text, credentials, authorization headers,
cookies, database configuration/URLs, raw bodies/files, stack traces, and
unbounded messages. Only a compact validated receipt from a real reviewed live
run may be committed.

### Deterministic CI and live operation

Ordinary tests and hosted CI use reviewed synthetic fixtures plus an injected
fake transport or controlled loopback server. They do not call GitHub, npm,
advisory providers, a model, or candidate code. Real persistence integration
uses the exact PostgreSQL 18.4 path from ADR 0004 and never skips.

The live CLI is opt-in and requires explicit manifest, credential, PostgreSQL,
deadline/budget configuration, and non-production acknowledgement. Phase
completion requires one full final-manifest run and an immediate unchanged
rerun proving idempotency. If credentials, provider rate limits, network, or an
approved database are unavailable, fixtures are not substituted; the draft PR
and plan report Phase 5 incomplete.

### Telemetry and operational posture

The batch emits injected structured events under stable operation
`ingestion.process`. Allowed fields are bounded result/error/provider/retry/
rate-limit categories, duration/count buckets, run correlation, and capability
family. Repository/package names, URLs, commits, provider messages, raw errors,
source text, and credentials are prohibited metric/log fields.

The live CLI writes bounded structured operational events and a final receipt;
the reusable package emits no direct logs. There is no service, queue,
scheduler, deployment, dashboard, alert, health endpoint, or SLO in this phase.
A future shared production composition must add its own deployment telemetry,
access control, runbooks, and SLOs before receiving production traffic.

### Deferred components

The following remain deferred because collection/profiling correctness must be
proved first and Issue #13 prohibits them:

- repository discovery search and broad indexing;
- retrieval, codebase-conditioned ranking, fit assessment, and scoring;
- local scanner, MCP, Agent Skill, HTTP API, and application services;
- model, embedding, and vector infrastructure;
- queue, worker service, daemon, scheduler, webhook, and continuous crawling;
- deployment, production credentials, private repositories, tenant, and
  organization lifecycle.

## Consequences

### Benefits

- A reviewable curator input prevents discovery heuristics from becoming
  hidden product authority.
- Fixed hosts/endpoints and native platform APIs keep the source and supply
  chain boundary small.
- Normalized source bundles and no raw cache minimize untrusted content and
  personal data.
- Model-free rules preserve evidence, unknowns, and limitations without
  popularity-based certainty.
- Prior-record reuse reconciles truthful collection time with Phase 4
  complete-record idempotency.
- Append-only lifecycle and exact snapshots preserve historical evidence while
  allowing deterministic refresh.
- Fixture-only CI stays repeatable; live provider accuracy remains separately
  visible.

### Costs and limitations

- Catalog curation and source identity review are manual, bounded product work.
- Full npm packuments can be large, requiring a 16 MiB bound and selective
  extraction.
- GitHub's advisory database cannot prove absence of vulnerabilities; every
  zero-result profile retains that material unknown.
- Fixed endpoints and closed normalized fields omit semantic README/source
  evidence and therefore leave deployment/integration unknowns.
- The operator batch directly composes a concrete persistence adapter because
  Phase 5 has no application layer; a future application must define its own
  port and composition boundary.
- Multiple family snapshots are individually atomic rather than committed in
  one database transaction; a rare mid-sequence failure is explicit and
  converges on retry.
- No daemon or webhook keeps the catalog continuously fresh. Refresh is an
  explicit operator action.

## Rejected alternatives

### GitHub or npm search as the catalog authority

Rejected because semantic relevance and popularity do not prove adoption
evidence or balanced capability coverage. Search also creates unbounded
discovery, pagination, and ranking behavior outside Issue #13.

### Git clone, tarballs, recursive trees, or repository execution

Rejected because structured provider APIs and a few exact-commit files cover V1
facts. Broader retrieval expands prompt-injection, traversal, supply-chain,
storage, licensing, and execution risk without a current rule.

### Octokit or another provider SDK

Rejected because fixed GET endpoints need stricter host, body, JSON, redirect,
and response mapping than an SDK removes. Node 24 already supplies the
transport primitives.

### OSV as the V1 advisory client

Credible but rejected for V1 because GitHub reviewed advisories provide the
required stable identity/times and exact npm version filter on the already
approved host through an idempotent GET. OSV remains a future coverage option,
not a fallback that can silently change evidence semantics.

### Treat zero advisories as “no vulnerabilities”

Rejected because provider coverage and future publication make that claim
unsound. Absence remains an explicit unknown.

### Regenerate identical evidence with a new collection time

Rejected because Phase 4 digests the complete immutable record. Reusing the old
ID with new time conflicts; using a new ID invents a change and breaks
unchanged-source snapshot identity.

### Persist raw provider responses for replay

Rejected because bodies contain unbounded untrusted/personal text and create
retention, security, licensing, and review obligations. Small normalized
records plus reviewed fixtures are sufficient.

### New persistence migration or Phase 5 application package

Rejected because existing public candidate/evidence/lifecycle/snapshot
operations represent the required result, and Issue #13 authorizes exactly one
new production package with no general application layer.

### Queue, worker service, scheduler, or continuous crawler

Rejected because an explicit bounded batch can prove the ingestion loop
without delivery, poison-message, dead-letter, deployment, and continuous
provider-load obligations.

## Revisit triggers

Revisit through a superseding ADR when measurable evidence establishes one of:

- curator workload cannot keep a 100–200 repository catalog current and a
  bounded discovery proposal has independently reviewed precision/safety;
- two current required source facts cannot be represented without a new
  provider or bounded file type;
- GitHub API `2026-03-10`, npm registry metadata, or GitHub reviewed advisories
  become unsupported or materially incomplete;
- npm packuments exceed the bound for at least 5% of mapped final candidates
  and a smaller official endpoint can establish the same facts;
- advisory coverage review demonstrates a material false-negative gap that OSV
  or another official source reduces with explicit provenance semantics;
- native fetch cannot meet a documented security/reliability requirement and a
  reviewed exact dependency materially improves it;
- at least 20 comparable refresh runs show operator batching cannot meet the
  required freshness window without a queue/scheduler;
- a named application/retrieval consumer requires a port, transaction, browser,
  or deployed telemetry surface not represented here; or
- a product-contract change authorizes deterministic semantic documentation or
  source analysis beyond the current structured boundary.

Popularity, convenience, a new SDK, or a desire to broaden scope alone is not
a revisit trigger.
