# Phase 5 curated public repository ingestion

## Status and authority

- Governing issue:
  [#13 — Phase 5: Ingest and profile a curated public OSS catalog](https://github.com/kgudipati/gitblocks/issues/13)
- Branch: `feat/13-public-repository-ingestion`
- Planned draft PR title: `feat: ingest curated public repository catalog`
- Owner: GitBlocks maintainers
- State:
  `both reviewed full live runs succeeded on the corrected catalog; their
bounded completion evidence is published, and final local and hosted
verification passed; the draft PR remains unmerged for independent final
review`
- Last updated: 2026-07-29
- Authority order: Issue #13; actual repository and Git history; product
  contract; accepted ADRs and system context; `AGENTS.md`, `PLANS.md`, and the
  engineering handbook; execution prompt.

Issue #13 owns the requirements, acceptance criteria, and non-goals. A material
contradiction between the issue and repository stops implementation for
maintainer direction rather than being resolved through an implicit scope
change.

## Purpose and user-visible outcome

Phase 5 creates the first real GitBlocks public OSS catalog and an
operator-controlled ingestion path:

```text
curated public-v1 manifest
  -> bounded GitHub, npm, and advisory collection
  -> deterministic public-profile-rules/1.0.0
  -> immutable Phase 4 evidence and exact dossiers
  -> compact secret-free ingestion receipt
```

The approved outcome is approximately 150 curated public repositories, with at
least 20 primary repositories in each of the five capability families. Every
retained candidate has a validated public identity, attributable evidence,
honest limitations and unknowns, refresh-safe lifecycle records, and one exact
snapshot for every declared candidate-family profile.

This phase proves collection and profiling. It does not expose a search,
ranking, fit-assessment, application, API, MCP, Skill, model, embedding, queue,
worker service, scheduler, continuous crawler, deployment, private-repository,
tenant, or organization capability.

## Verified current repository and GitHub state

Verified on 2026-07-29 before the first edit:

- clean local `main` matched `origin/main` at
  `2fedf201a844b4ecfaa1f6d6218ae84b69cf867c`;
- PR
  [#12](https://github.com/kgudipati/gitblocks/pull/12) is merged and Issue
  [#11](https://github.com/kgudipati/gitblocks/issues/11) is closed;
- Issue #13 is open with no comments that alter scope;
- exactly three production packages exist: `@gitblocks/domain`,
  `@gitblocks/contracts`, and `@gitblocks/persistence`;
- there is no ingestion package, catalog manifest, provider client, profiler,
  ranking path, API, MCP server, worker, model, or deployment;
- Phase 2 has ten cases, 40 supplied candidate occurrences, and proposed /
  not-reviewed gold;
- evaluation scoring and the baseline protocol are unchanged; and
- the exact required branch was created from the verified main head.

Commands and structured evidence:

```text
git status --short --branch
git remote -v
git fetch origin
git switch main
git pull --ff-only origin main
git rev-parse HEAD
git rev-parse origin/main
git log --oneline --decorate --graph -15
git branch --all
connected GitHub Issue #13, Issue #11, and PR #12 reads
repository package/path inventory
```

The clean baseline passed with Node `24.18.0`, pnpm `11.17.0`, PostgreSQL
`18.4`, 650 offline tests, and 12 database tests without skips:

```text
pnpm runtime:check
pnpm install --frozen-lockfile
pnpm verify
pnpm verify:ci
pnpm contracts:validate
pnpm db:verify
pnpm eval:validate
pnpm eval:fixtures
```

The first `nvm use` attempt failed because the Codex shell had not loaded the
already-installed NVM function. Sourcing
`/Users/karthikgudipati/.nvm/nvm.sh` corrected the shell path without installing
or changing a runtime.

## Scope and explicit non-goals

### In scope

- ADR 0005 and this living execution plan.
- Exactly one new production package: `packages/ingestion`.
- A curator-owned, versioned `catalog/public-v1` manifest.
- Strict manifest and receipt parsers with deterministic digests.
- Injected, bounded native-fetch transport and GitHub, npm, and advisory
  clients.
- Exact-commit allowlisted small-file collection.
- Deterministic, model-free profile rules and stable identifiers.
- Refresh planning, append-only lifecycle corrections, persistence
  orchestration, bounded batch operation, and safe telemetry events.
- Deterministic provider fixtures, real PostgreSQL integration, root
  verification, documentation, and repository architecture enforcement.
- An explicit opt-in live CLI, two full live runs when credentials and an
  approved non-production database are available, and a reviewed compact
  receipt.
- Ordinary commits, a normal push, a draft PR, and hosted Verification
  inspection.

### Explicit non-goals

- GitHub or npm discovery search, broad indexing, ranking, viability scoring,
  target-repository scanning, fit execution, MCP, Agent Skills, HTTP product
  transport, models, embeddings, queues, daemons, schedulers, continuous
  crawling, deployment, private repositories, tenant/organization data, or
  production credentials.
- Repository clone, tarball download, dependency installation, import, build,
  test, execution, recursive tree download, README corpus, source corpus,
  issue, pull-request, discussion, or contributor collection.
- Evaluation-gold acceptance, scoring changes, a live model baseline, or
  candidate execution.
- A second production package or a general application layer.

## Issue #13 requirements crosswalk

| Issue requirement                                       | Destination                            | Milestone and evidence                                    |
| ------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------- |
| 100–200 curated repositories, target near 150           | `catalog/public-v1/manifest.json`      | Manifest tests, `catalog:validate`, final count matrix    |
| At least 20 primary repositories per family             | Manifest validator and catalog         | Family-balance tests and completion report                |
| Stable identities, no repository/npm duplicates         | Manifest parser                        | Case-folded uniqueness and stable-ID negative tests       |
| Explicit rationale, sources, status, and file allowlist | Every manifest entry                   | Closed-field validation and changed-line review           |
| Exactly one new package                                 | `packages/ingestion`                   | Package inventory and repository invariant                |
| Bounded GitHub source collection                        | `src/providers/github.ts`              | Protocol fixtures, transport abuse tests, opt-in live run |
| Bounded npm metadata collection                         | `src/providers/npm.ts`                 | Packument fixtures, linkage and absent-field tests        |
| One maintained advisory source                          | `src/providers/advisory.ts`; ADR 0005  | Exact package/version advisory fixtures and live receipt  |
| Exact-commit allowlisted files                          | GitHub client and manifest path policy | Traversal/symlink/size/count/content-type tests           |
| Deterministic model-free profiles                       | `src/profile.ts`                       | Five-family, missing-field, popularity-inert tests        |
| Stable evidence/lifecycle/snapshot IDs                  | `src/identifiers.ts`                   | Canonical-input, unchanged/changed, collision tests       |
| Safe refresh and immutable history                      | `src/refresh.ts`                       | Release/license/archive/advisory lifecycle tests          |
| No partial candidate snapshot                           | persistence orchestration              | Failure-before-snapshot and real PostgreSQL tests         |
| Independent candidate partial failure                   | batch orchestrator                     | Controlled mixed-success test and receipt                 |
| Compact bounded receipt                                 | `src/receipt.ts`                       | Parser, redaction, digest, second-run comparison tests    |
| Deterministic CI with no provider network               | fixtures and injected transport        | Hidden-network guard and hosted CI                        |
| Real PostgreSQL 18.4                                    | ingestion persistence integration      | `ingestion:verify`, `db:verify`, no skips                 |
| Full live run and immediate idempotency rerun           | opt-in CLI                             | committed receipt or explicit credential/access blocker   |
| Architecture/docs/repository integration                | listed Phase 5 policy files            | repository, architecture, link, and diff checks           |
| Draft publication, CI correction                        | required branch and PR                 | ordinary commits/push, draft PR, decoded hosted logs      |

## Applicable ADRs, contracts, and Phase 4 API

- ADR 0001 preserves headless delivery and prohibits executing ingested code.
- ADR 0002 fixes Node 24.18.0, pnpm 11.17.0, strict ESM/TypeScript, exact
  dependencies, native platform preference, deterministic tests, and
  supply-chain controls.
- ADR 0003 makes `CandidateDossierV1` and `EvidenceObservationV1` the product
  shapes. Ingestion maps provider data into these contracts; provider bodies
  never become product DTOs.
- ADR 0004 provides public immutable PostgreSQL storage and exact snapshots.
  No Phase 5 persistence migration is currently justified.
- ADR 0005 will own curated public ingestion.
- The product contract fixes the five families, evidence/unknown/limitation
  semantics, popularity-versus-fit distinction, and non-execution boundary.
- System context currently describes ingestion as planned; Phase 5 will mark
  only the operator batch and package as implemented and non-deployed.

Phase 4 public API inventory:

```text
createPersistenceClient
closePersistenceClient
applyMigrations
verifyMigrations
putCatalogCandidate
setCandidateCapabilityFamilies
appendEvidenceObservation
appendCandidateLimitation
appendCandidateUnknown
recordEvidenceSupersession
recordEvidenceInvalidation
createCandidateDossierSnapshot
loadCandidateDossierSnapshot
selectActiveDossierMaterial
```

Phase 5 composes this concrete adapter directly because Issue #13 explicitly
defines the package dependency. It does not create an application port.

## Source-provider research and decisions

Research is restricted to official or primary provider documentation.

### GitHub

- Use REST API version `2026-03-10`, explicitly sent through
  `X-GitHub-Api-Version`, and `Accept: application/vnd.github+json`.
- The version is current and GitHub documents `2022-11-28` as supported only
  through 2028-03-10:
  [API versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions?apiVersion=2026-03-10).
- Use authenticated public reads with an injected fine-grained token or GitHub
  App token and no write permission. Authenticated user requests normally have
  a 5,000-request/hour primary limit:
  [rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).
- Selected endpoints:
  `GET /repos/{owner}/{repo}`,
  `GET /repos/{owner}/{repo}/commits/{ref}`,
  `GET /repos/{owner}/{repo}/releases`,
  `GET /repos/{owner}/{repo}/tags`,
  `GET /repos/{owner}/{repo}/license`,
  `GET /repos/{owner}/{repo}/community/profile`, and
  `GET /repos/{owner}/{repo}/contents/{path}?ref={commitSha}`.
- The contents endpoint accepts an exact commit in `ref` and distinguishes
  files, symlinks, and submodules:
  [repository contents](https://docs.github.com/en/rest/repos/contents?apiVersion=2026-03-10).
- GitHub's documented rate-limit behavior requires `Retry-After`,
  `X-RateLimit-Remaining`, and `X-RateLimit-Reset` handling and warns against
  continuing while limited:
  [REST best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api?apiVersion=2026-03-10).

### npm

- Use only `GET https://registry.npmjs.org/{encoded-package}` with
  `Accept: application/json`.
- The official registry documentation defines the full packument, including
  dist-tags, version publication times, repository linkage, license, and
  version metadata. It also states that publisher-provided fields historically
  received no validation:
  [npm package metadata](https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md).
- Do not use npm search, download tarballs, install packages, or retain README
  text. The parser extracts only the selected current-version closed fields and
  discards the raw document.

### Security advisories

Compared sources:

- GitHub Global Security Advisories provides GitHub-reviewed advisories, stable
  GHSA IDs, publication/update/withdrawal times, npm package ranges, exact
  `affects=package@version` filtering, and bounded cursor pagination through an
  official versioned GET endpoint:
  [global advisory endpoint](https://docs.github.com/en/rest/security-advisories/global-advisories?apiVersion=2026-03-10).
- OSV API 1.0 provides exact package/version queries, OSV IDs, published,
  modified, withdrawn, and affected-package data with a documented 32 MiB
  HTTP/1.1 response ceiling:
  [OSV API](https://google.github.io/osv.dev/api/) and
  [OSV schema](https://ossf.github.io/osv-schema/).

Select GitHub Global Security Advisories for `public-v1`: it reuses the
authenticated, versioned, read-only GitHub boundary, returns reviewed npm
advisories, and supports exact package/version filtering through a safe GET.
OSV remains a credible future alternative, but a second host and POST retry
semantics add no required Phase 5 coverage. A zero-result advisory query
creates an explicit coverage unknown; it never proves absence of
vulnerabilities.

### Native platform and dependency review

Use Node 24 native `fetch`, `AbortSignal.any`, `AbortSignal.timeout`, Web
Streams, `URL`, `TextDecoder`, `Buffer`, and `node:crypto`. Node 24 documents
stable global fetch and composed/timeout abort signals:
[Node 24 globals](https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html).

No external production dependency is proposed. Native APIs provide HTTPS
requests, manual redirect inspection, cancellation, streamed post-decompression
byte counting, and hashing. An SDK would enlarge provider types and supply
chain without improving the fixed-endpoint policy. The replacement cost of the
owned transport is bounded to the fixed policies below.

## Catalog selection methodology and balance

The catalog starts with all verified pilot repositories, then adds projects
whose official repository or package identity directly establishes one of the
five capabilities. Selection deliberately covers:

- TypeScript/JavaScript libraries and framework middleware;
- PostgreSQL, Redis, queue, policy, logging, webhook, and gateway integrations;
- self-hostable services and repository-only projects;
- mature and newer credible projects;
- package-backed and repository-only identities; and
- a small explicit set of archived, deprecated, moved, stale, or retained
  negative controls.

Stars are not an inclusion rule and are not collected as compatibility or
quality evidence. Every entry carries a bounded curator rationale and one or
more official selection-source URLs. Provider responses, not the curator
rationale, decide live identity and evidence.

Target matrix:

| Primary family   |  Target | Minimum |
| ---------------- | ------: | ------: |
| authorization    |      30 |      20 |
| audit-logging    |      30 |      20 |
| background-jobs  |      30 |      20 |
| rate-limiting    |      30 |      20 |
| webhooks         |      30 |      20 |
| **Unique total** | **150** | **100** |

Additional family memberships are allowed but do not change the primary count.
The final plan records the actual unique, primary, multi-family,
package/repository-only, and status counts.

## Manifest schema and invariants

`catalog/public-v1/candidates.json` is explicit curator input.
`catalog/public-v1/manifest.json` is its closed, deterministically generated
release form. The generator cannot manufacture per-candidate fields:

```text
catalogVersion
publishedAt
manifestDigest
candidates[]:
  candidateId
  displayName
  introducedAt
  github:
    owner
    repository
  npmPackage
  primaryCapabilityFamily
  additionalCapabilityFamilies[]
  rationale
  expectedSourceTypes[]
  selectionSources[]
  status
  allowlistedFiles[]
```

Rules:

- 100–200 candidates; canonical ordering by candidate ID.
- At least 20 primary candidates per family.
- Lowercase case-folded repository/package uniqueness.
- Stable IDs use lowercase ASCII letters, digits, and internal hyphens, at
  most 64 characters.
- Owner/repository and npm identities use bounded closed syntax.
- Additional families, expected source types, selection sources, and paths are
  unique and deterministically ordered.
- Status is exactly `active`, `archived`, `moved`, or `negative-control`.
- Rationale is 20–320 characters; selection URLs are bounded HTTPS GitHub or
  npm package URLs.
- Unknown fields fail.
- The SHA-256 manifest digest covers canonical JSON with the digest field
  omitted.

## Request, byte, pagination, concurrency, and time budgets

| Bound                                  |              Initial decision |
| -------------------------------------- | ----------------------------: |
| Candidate concurrency                  |                             3 |
| Requests within one candidate          |                        serial |
| universal GitHub requests/candidate    |                             2 |
| declared release/tag/license/community |              zero or one each |
| GitHub file requests/candidate         |                     maximum 3 |
| npm requests/mapped candidate          |                             1 |
| advisory pages/mapped candidate        |           maximum 2, 100/page |
| total provider requests/candidate      |                    maximum 12 |
| provider attempts                      | 1 initial + maximum 2 retries |
| per-request timeout                    |                    10 seconds |
| per-candidate deadline                 |                    90 seconds |
| full-run deadline                      |                    60 minutes |
| ordinary GitHub/advisory JSON body     |                         2 MiB |
| npm full packument body                |                        16 MiB |
| repository file decoded bytes          |                   64 KiB/file |
| repository file total                  |             128 KiB/candidate |
| JSON depth / object-array nodes        |                  32 / 100,000 |
| same-host redirects                    |                     maximum 2 |

All streamed byte limits apply to bytes delivered to the parser after fetch
content decoding. Requests send `Accept-Encoding: identity` as defense in
depth. A body exceeding its limit is cancelled before parsing.

Retries apply only to safe GET requests after network failure, 408, 429, 500,
502, 503, or 504. Backoff is exponential with deterministic per-request
jitter. GitHub and npm `Retry-After` take precedence; GitHub primary reset time
is the fallback when remaining is zero. If the required wait exceeds the
remaining deadline or 60 seconds, the operation returns a stable rate-limit
failure without an early retry.

Closed provider outcomes are established value, established absence,
retry-exhausted temporary unavailability, rate limited, caller cancellation,
deadline, authentication failure, authorization failure, identity mismatch,
malformed response, unsupported content type, body too large, unsafe redirect,
and internal invariant failure. Only an approved optional absence is normal
missing metadata; fatal outcomes are rethrown and temporary optional
unavailability is a no-snapshot partial receipt.

## Trust boundaries and allowed file paths

Fixed transport hosts are `api.github.com` and `registry.npmjs.org`, HTTPS
only. Provider clients construct paths only from already validated manifest
identities. Redirects are manual; only HTTPS redirects to the same approved
host are followed, and canonical repository moves are recorded instead of
silently rewriting curator identity.

Allowed files are exact manifest paths matching:

- root or specifically named workspace `package.json`;
- root `SECURITY.md`; or
- root `LICENSE`, `LICENSE.md`, or `LICENSE.txt`.

Paths are bounded ASCII relative paths, contain no empty, dot, dot-dot,
backslash, percent-encoded, or absolute segment, and must match the approved
closed patterns. Contents are fetched through the GitHub contents API at the
exact default-branch commit. Directories, symlinks, submodules, unsupported
encodings/content types, excess bytes/files, recursive trees, and arbitrary
download URLs fail closed. Retrieved text stays inert data and is never
executed or treated as an instruction.

## Deterministic profiling-rule inventory

Profile rules version: `public-profile-rules/1.0.0`.

Direct evidence is limited to facts represented honestly by structured sources:

- canonical public repository identity and manifest linkage;
- exact default-branch head;
- current selected release/tag state;
- GitHub and npm license declarations;
- archive/fork/move/deprecation state;
- npm package/repository linkage;
- exact selected npm version and publication time;
- declared Node engine and package type/export presence;
- repository push/release timestamps;
- applicable reviewed GHSA presence; and
- GitHub community-metadata security-policy presence.

Descriptions, topics, stars, forks, download counts, and popularity do not
produce compatibility, fit, viability, or quality evidence. Topics may be
retained in the normalized source bundle only to support identity review, not
profiling.

Limitations include archived or forked repository, moved and negative-control
catalog states, deprecated package, repository/package mismatch, known
applicable reviewed advisory, missing security policy, and incomplete bounded
source/advisory coverage.

Decision-relevant absent or inconclusive facts become bounded unknowns,
including undeclared runtime, ambiguous license/linkage, missing release state,
advisory coverage limits, unproven deployment compatibility, and absent
structured integration proof. V1 defines no supported-runtime target or stale
release threshold, so it does not misclassify declared ranges or age as a
drawback. A limitation never rejects or ranks a candidate.

## Deterministic identifiers and collision handling

Canonical JSON recursively sorts object keys and preserves already canonical
array order. SHA-256 inputs carry a type/version domain separator.

- Candidate IDs are curator-owned stable manifest values.
- Evidence inputs bind candidate, logical topic, source kind, and exact
  immutable revision or normalized source-record digest.
- Limitation and unknown inputs bind candidate, stable code/topic, exact
  ordered supporting evidence, and profile rules version.
- Supersession inputs bind candidate, old/new evidence IDs, reason, and
  semantics; invalidation inputs bind candidate, evidence ID, reason, and
  semantics.
- Snapshot inputs bind candidate, family, rules version, evidence cutoff, and
  exact ordered evidence/limitation/unknown IDs.

Persisted IDs use a short kind prefix plus the first 40 lowercase hexadecimal
SHA-256 characters (160 bits), fitting existing 64-character ID limits. The
full digest and canonical input remain in the in-memory collision registry for
the profile/run. A truncated-ID collision with a different full digest fails
as `ingestion.identifier-collision`; a cross-run collision becomes the Phase 4
complete-record conflict and fails safely.

Unchanged logical evidence reuses the exact prior persisted observation,
including its original collection time. New or changed normalized source
records use the current injected collection time. The evidence cutoff is the
maximum evidence-world time in the exact material, not the batch wall-clock
end. Candidate creation time comes from stable per-entry `introducedAt`;
`publishedAt` is catalog-release metadata only. A later manifest
digest/publication does not rewrite existing identity, a changed introduction
time conflicts, and a newly added candidate may use a later introduction. Thus
unchanged provider data reproduces complete immutable records and the same
snapshot ID rather than conflicting on refreshed audit timestamps.

## Refresh, lifecycle, and transaction semantics

For each fully collected candidate:

1. load prior active material when present;
2. profile normalized sources and reuse exact matching prior observations;
3. append new observations;
4. append deterministic supersessions for changed logical facts;
5. append invalidations only when a successfully collected authoritative
   source proves an old managed fact is no longer established;
6. never invalidate because a provider failed or timed out;
7. append current limitations and unknowns;
8. create each family snapshot only after every intended dossier has already
   passed the product parser; and
9. load the snapshot back for exact reconstruction.

GitHub identity/head are universal source invariants. Every manifest-declared
optional source must establish value or approved absence before profiling.
Required or fatal failure produces no snapshot. Optional temporary
unavailability produces a partial candidate receipt, no snapshot, and no
durable transient limitation/unknown. A successful zero-result advisory query
creates a coverage unknown, preserves prior history, and does not fabricate a
clean result.

Phase 4 keeps each immutable append and snapshot atomic. Phase 5 does not add a
schema transaction spanning candidates. An independent candidate failure never
rolls back completed candidates. Provider collection completes before the
first candidate write, so a transient collection failure cannot publish a
partial dossier; an unchanged rerun converges through complete-record
idempotency.

## Receipt schema

Receipt version: `public-ingestion-receipt/1.0.0`.

Closed bounded fields cover:

- catalog/rules/receipt versions and manifest digest;
- run ID, start/end, requested/completed repositories, and family profiles;
- GitHub/npm/advisory request counts;
- candidate, evidence, and snapshot created/idempotent counts;
- supersession, invalidation, limitation, and unknown counts;
- failures grouped by stable reason code;
- bounded GitHub rate-limit limit/remaining/reset summary;
- database migration version;
- optional second-run comparison; and
- deterministic SHA-256 receipt digest.

The receipt excludes credentials, headers, cookies, database values/URLs, raw
provider bodies, source/README text, stack traces, provider messages, and
unbounded errors. Failures are grouped by code rather than embedding candidate
content.

## Package dependency graph and public surface

```text
@gitblocks/ingestion
        -> @gitblocks/persistence
        -> @gitblocks/contracts
        -> @gitblocks/domain
```

No external production dependency is added. The planned public surface covers:

```text
parseCatalogManifest
createGitHubClient
createNpmClient
createAdvisoryClient
collectCandidateSourceBundle
profileCandidate
planCandidateRefresh
persistCandidateProfile
ingestManifest
parseIngestionReceipt
createIngestionReceipt
```

All reusable-core configuration, time, transport, database client, deadline,
and observer capabilities are injected. Core imports do no network/database
I/O, read no environment variable, create no global client, and schedule no
work. The operator CLI alone reads documented flags/environment and emits
bounded structured events plus a receipt.

## Security, privacy, abuse, and telemetry

Assets are public identity/evidence integrity, Phase 4 immutable history,
provider/database credentials, request budgets, and reviewable receipts.
Actors are the trusted operator, least-privilege provider identities,
non-owner PostgreSQL runtime, external public providers, and untrusted
repository/package/advisory publishers.

Controls include fixed hosts, HTTPS, manual redirect checks, strict closed
parsers, byte/depth/node/page/request/time/concurrency bounds, exact-commit
paths, safe value-free errors, no raw retention, no arbitrary URL, no
shell/provider-body logging, and no candidate execution capability. Candidate
instruction-like text stays unobserved or inert.

The operator path emits injected structured events with stable
`ingestion.process` operation and bounded result/provider/retry/rate-limit
fields. It does not use repository/package names, URLs, commits, raw errors, or
credentials as metric labels. The compact receipt is durable operational
evidence. There is no shared service, dashboard, alert, SLO, health endpoint,
or production deployment in this phase; those are inapplicable until a
deployed application owns the path.

## Test-first implementation milestones

### 1. Plan, ADR, and manifest contract

Status: complete.

- Complete source research and ADR 0005.
- Add manifest types/parser/digest and failing boundary/balance/path tests.
- Curate and validate the complete catalog.

### 2. Bounded transport and provider clients

Status: complete.

- Add injected transport with host, HTTPS, redirect, byte, JSON, deadline,
  retry, and rate-limit controls.
- Add GitHub, npm, and advisory normalized parsers and deterministic fixtures.
- Prove credentials and provider bodies never escape errors/events.

### 3. Profiling and refresh

Status: complete.

- Add stable ID derivation and collision detection.
- Add five-family deterministic profiles, limitations, unknowns, and prior
  observation reuse.
- Add supersession/invalidation planning and temporary-failure preservation.

### 4. Persistence and batch orchestration

Status: complete.

- Compose the Phase 4 API with complete-profile-before-snapshot behavior.
- Add bounded candidate concurrency and independent failure receipts.
- Prove real PostgreSQL round trip, exact load, unchanged rerun, changed
  lifecycle, concurrency convergence, and no partial snapshot.

### 5. Operator, repository integration, and deterministic validation

Status: complete.

- Add root commands, project references, Vitest/CI, architecture and repository
  rules, fixtures, README, AGENTS, CONTRIBUTING, system, testing, security,
  reliability, ADR, and plan updates.
- Run the complete local matrix and static prohibited-component review.

### 6. Live run and publication

Status: complete. Both reviewed live runs, bounded receipt review, ordinary
completion-evidence publication, and hosted Verification succeeded. The PR
remains draft and unmerged for independent final review.

- Run the full final manifest only with explicitly injected credentials,
  approved non-production PostgreSQL, and acknowledgement.
- Run the immediate idempotency pass and validate/commit the compact receipt.
- Create intentional Conventional Commits, push normally, open the exact draft
  PR with `Closes #13`, inspect decoded hosted logs, and fix only through
  ordinary follow-up commits.

### 7. Independent-review corrections

Status: complete, including correction publication, deterministic hosted
verification, both reviewed full live runs, and the reviewed real
between-run source transition.

- Make all curator decisions explicit in `candidates.json` and reject generic
  rationale or repository-homepage-only classification.
- Replace catch-all optional handling with the closed provider outcome
  taxonomy and declared-source request policy.
- Prevent transient collection from writing a snapshot or durable
  limitation/unknown.
- Preserve stable manifest identity through a moved provider canonical
  location.
- Use stable per-entry `introducedAt`, pin license collection to exact commit,
  and validate exact provenance.
- Prove fatal no-snapshot behavior and complete/temporary/recovered source
  cycles through PostgreSQL 18.4.

## Testing and deterministic-CI strategy

Ordinary tests use reviewed synthetic fixtures and an injected fake transport
or controlled loopback HTTP server. No ordinary test calls GitHub, npm, the
advisory endpoint, a model, or candidate code.

Required coverage:

- manifest count/balance/order/digest/identity/path/status/unknown-field cases;
- provider auth/host/HTTPS/redirect/content-type/size/JSON-depth/pagination/
  timeout/cancellation/retry/rate-limit/redaction cases;
- GitHub identity/head/release/tag/license/community/file/move/missing cases;
- npm identity/linkage/version/time/license/engine/type/exports/deprecation and
  absent-field cases;
- advisory ID/time/package/version/multiple/zero/failure/withdrawal cases;
- deterministic profiles for all five families and every limitation/unknown
  class;
- unchanged and changed refresh, temporary failure, and no popularity-derived
  compatibility;
- PostgreSQL exact snapshot, idempotency, lifecycle, concurrency, independent
  failure, and no-snapshot-on-required-source failure; and
- static non-execution, no arbitrary host/path/private repository, secret
  absence, and no product-to-evaluation import.

Live provider behavior is separate and opt-in. It is not represented as fixture
proof.

## Exact validation commands

Working directory:
`/Users/karthikgudipati/Documents/Apps/gitblocks`.

```bash
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
pnpm contracts:validate
pnpm db:migrate
pnpm db:check
pnpm db:test
pnpm db:verify
pnpm catalog:validate
pnpm ingestion:test
pnpm ingestion:verify
pnpm security:secrets
pnpm security:audit
pnpm verify
pnpm verify:ci
git diff --check
git status --short --branch
git diff --stat
git diff
```

Static review also proves one new production package, 100–200 unique
repositories, at least 20 primary entries per family, no duplicate GitHub/npm
identity, no prohibited component, no candidate execution, no raw cache or
credential, no live-provider CI dependency, real PostgreSQL without skips, ten
valid pilot cases, proposed/not-reviewed gold, and unchanged scoring.

## Live-run strategy and credential policy

The CLI requires:

- explicit `--manifest`;
- injected `GITBLOCKS_INGEST_GITHUB_TOKEN`;
- explicit PostgreSQL host, port, database, username, password, and SSL mode;
- explicit overall deadline/concurrency/request budgets or conservative
  defaults; and
- exact acknowledgement that the target is an approved non-production
  ingestion database.

Credentials never enter command arguments, receipts, fixtures, events, docs, or
Git. The token should be a least-privilege fine-grained token or GitHub App
token capable only of public metadata/contents reads. The database runtime must
be non-owner and non-superuser after explicit migration by the owner.

If credentials, provider budget, or network prevent a future required live
refresh, the plan and draft PR must record the exact limitation without
fixture substitution or repeated provider hammering.

## Compatibility, rollout, and recovery

No persisted-schema change is planned. Phase 5 writes only existing V1 product
contracts through Phase 4 operations. The new manifest, profile-rules, and
receipt versions are unpublished internal boundaries with exact-version
parsers.

The operator batch is opt-in and non-deployed. A failed run is recovered by an
ordinary rerun: immutable successful records remain, provider failures do not
delete history, changed source appends lifecycle, and exact IDs make unchanged
work idempotent. Database rollback is neither needed nor authorized; corrupt or
incompatible behavior requires a code correction or forward migration under a
new issue.

## Exact exit criteria

- Every Issue #13 crosswalk row has implementation and concrete evidence.
- ADR 0005 and this plan reflect final decisions, discoveries, failures, and
  validation.
- Exactly `@gitblocks/ingestion` is added as the fourth production package.
- The final manifest is within 100–200, near 150, and balanced.
- Bounded official GitHub/npm/advisory collection and deterministic profiles
  pass offline and real-PostgreSQL tests.
- No candidate code, tarball, recursive corpus, arbitrary host, secret, raw
  provider cache, or prohibited component exists.
- The full live manifest and immediate unchanged rerun succeed, or the phase is
  explicitly reported incomplete without fabrication.
- A validated compact live receipt is committed only after a real successful
  run.
- The complete local matrix and hosted Verification pass on the final
  published head.
- Gold remains proposed/not-reviewed, scoring is unchanged, and no live
  model/agent baseline runs.
- The PR is draft and unmerged; every push is ordinary and non-forced; `main`
  remains unchanged.

## Progress log

- 2026-07-29: Read Issue #13 and its zero-comment thread through connected
  GitHub access; confirmed PR #12 merged and Issue #11 closed.
- 2026-07-29: Verified clean local/remote main at `2fedf201`, exactly three
  production packages, no ingestion implementation, and proposed/not-reviewed
  gold.
- 2026-07-29: Corrected an unloaded NVM shell by sourcing the existing
  installation; no runtime was installed or changed.
- 2026-07-29: Baseline passed with Node 24.18.0, pnpm 11.17.0, 650 offline
  tests, 12 PostgreSQL 18.4 tests without skips, contracts, evaluation,
  architecture, repository, secret, and audit checks.
- 2026-07-29: Created required branch
  `feat/13-public-repository-ingestion`.
- 2026-07-29: Inventoried Phase 4 APIs and verified that no schema migration is
  currently needed.
- 2026-07-29: Researched official GitHub REST, npm registry, GitHub Advisory,
  OSV, and Node 24 documentation and selected the source/transport policies
  recorded above.
- 2026-07-29: Created this initial plan before implementation.
- 2026-07-29: Accepted ADR 0005 and added exactly
  `@gitblocks/ingestion` with no external production dependency.
- 2026-07-29: Curated and deterministically generated a 150-repository
  manifest: 30 primary entries per family, no duplicate GitHub/npm identity,
  81 package-backed / 69 repository-only, zero multi-family, and 103 active /
  three archived / one moved / 43 negative-control states.
- 2026-07-29: Implemented fixed-host bounded transport, closed provider
  mappers, exact-commit allowlisted files, model-free profiles, collision-aware
  IDs, refresh planning, Phase 4 composition, bounded batching, operator CLI,
  and a closed digested receipt.
- 2026-07-29: Added deterministic provider/manifest/profile/refresh/receipt
  tests and real PostgreSQL ingestion reconstruction, unchanged rerun, and
  changed-evidence lifecycle coverage.
- 2026-07-29: Completed the local validation matrix: 670 offline tests and 15
  PostgreSQL tests passed without skips; coverage, architecture, repository,
  contract, evaluation, secret, dependency-audit, catalog, ingestion, and
  frozen-install checks passed.
- 2026-07-29: Created implementation commit `b7326c9`, pushed it normally to
  the required branch, and opened draft PR #14 with the exact required title
  and `Closes #13`.
- 2026-07-29: Inspected all 1,547 lines of the decoded hosted Verification log
  for run `30445222539`, job `90553802670`. Every step passed on the
  implementation head, including frozen installation, 668 offline tests, 15
  PostgreSQL tests without skips, catalog/contracts/evaluation/architecture,
  dependency audit, and the clean-worktree proof; there were no warning/error
  annotations or nonzero exit markers.
- 2026-07-29: A final prompt-to-ADR-to-code trace review found that moved
  repository identity was documented but every canonical mismatch still
  failed. Added failing provider/profile regressions, then limited canonical
  mismatch acceptance to manifest entries explicitly marked `moved` and
  emitted moved/negative-control limitations.
- 2026-07-29: Inspected live-operation configuration without reading values.
  The GitHub token and all ingestion database variables are unset; Docker is
  not available as an operator target. Per Issue #13, no live run was
  fabricated or replaced with fixtures.
- 2026-07-29: Began the independent-review correction pass on reviewed head
  `3b49e164`. Reconfirmed Issue #13, draft PR #14, exact branch, clean shared
  history, and the no-rebase/no-force/no-new-PR constraints.
- 2026-07-29: Added focused regressions before correction. The reviewed head
  failed 11 assertions covering swallowed fatal optional outcomes,
  exact-commit license `ref`, declared-source execution, npm `Retry-After`,
  candidate-specific rationale, and homepage-only classification evidence.
- 2026-07-29: Replaced the shallow candidate source with 150 explicit curator
  entries. The review retained 30 primary entries per family, 81 npm-backed /
  69 repository-only, 102 active / three archived / one moved / 44 negative
  controls, and deliberately zero additional-family assignments. It made no
  candidate removal, replacement, alias, or primary-family correction before
  live provider verification. It corrected `logform` from active to negative
  control because it formats existing records rather than producing,
  collecting, or transporting logs. The four documented declared-source policies
  distinguish non-negative npm, non-negative repository-only, npm negative
  control, and repository-only negative control entries. Fifty-one
  non-negative npm candidates justify an exact-commit `package.json`; the
  other 99 request no file. The highest manifest logical request budget is
  eight.
- 2026-07-29: Recomputed the manifest digest as
  `371df1d677284466f7b29f3aaef0b15641e09cf3792a3badc64c45004161dfb7`.
- 2026-07-29: Implemented the closed provider outcome taxonomy,
  declaration-driven optional requests, no-snapshot transient partials, stable
  manifest identity across moves, per-candidate `introducedAt`, and
  exact-commit license provenance.
- 2026-07-29: Focused deterministic validation passed with 44 ingestion tests.
  PostgreSQL 18.4 verification passed with 23 database tests, including fatal
  no-snapshot cases, five complete/fail/recover source cycles, moved refresh,
  manifest republication, introduction conflict, and later candidate
  introduction.
- 2026-07-29: The complete required local matrix passed after the catalog
  review. It covered 695 offline tests, 44 focused ingestion tests, 23
  PostgreSQL 18.4 tests without skips, 625 architecture modules / 1,988
  dependencies, frozen installation, formatting, lint, typecheck, build,
  repository checks, evaluation and contract validation, secret scanning, and
  the registry-backed dependency audit. Coverage was 77.14% statements, 69.95%
  branches, 83.62% functions, and 76.98% lines.
- 2026-07-29: Rechecked live configuration without reading any value. No
  ingestion, GitHub CLI, `GH_TOKEN`, or `GITHUB_TOKEN` credential is available.
  A pinned no-volume local PostgreSQL 18.4 container is now an available
  approved database path, but no provider request or live receipt can be
  produced without existing GitHub authentication.
- 2026-07-29: Created ordinary follow-up commits `58d3312` (implementation,
  catalog, and tests) and `59a681d` (documentation), then pushed the existing
  branch by normal fast-forward without rewriting shared history.
- 2026-07-29: Hosted CI run `30471964637`, Verification job `90644174655`,
  succeeded on `59a681d`. All steps passed, including frozen installation,
  reproducibility, PR metadata, authoritative verification, PostgreSQL 18.4,
  the registry audit, and the clean-worktree proof. All 1,543 decoded log lines
  were reviewed; warning/error-looking PostgreSQL lines were the deliberate
  negative integration cases, not failed steps or annotations.
- 2026-07-29: Loaded the explicitly provided ignored `.env.local` into an
  ephemeral shell without printing or inspecting its value, verified only that
  the required GitHub variable was non-empty, and reran the pre-live baseline.
  Frozen install, catalog, ingestion, PostgreSQL, `verify`, and `verify:ci`
  passed before provider access.
- 2026-07-29: The first live attempt stopped before any provider request and
  wrote no receipt. The non-owner runtime login connected, but live CLI
  migration verification failed with SQLSTATE `42501` because the runtime
  group role could not read `gitblocks.schema_migrations`. The no-volume
  database and failed-attempt telemetry were removed.
- 2026-07-29: Added forward migration
  `0002_runtime_migration_verification.sql` and a PostgreSQL regression proving
  the non-owner runtime client can verify the exact two-migration inventory.
  Focused PostgreSQL 18.4 verification passed with 23 tests and no skips.
- 2026-07-29: The complete post-correction deterministic matrix passed:
  frozen installation, formatting, lint, typecheck, build, 695 offline tests,
  coverage, architecture, repository, evaluation, contracts, catalog, 44
  ingestion tests, 23 PostgreSQL tests, secret scanning, registry audit,
  `verify`, and `verify:ci`.
- 2026-07-29: Created and normally pushed follow-up commit `c794880` for
  runtime migration verification. Hosted run `30476762296`, Verification job
  `90660300464`, passed; all 1,550 decoded lines were inspected, including 695
  offline tests, 23 PostgreSQL tests with two migrations, the exact catalog
  digest, dependency audit, and clean-worktree proof.
- 2026-07-29: Restarted on a fresh pinned no-volume PostgreSQL 18.4 database.
  Migration apply/check and non-owner runtime verification passed. The full
  live run was stopped without a receipt after deterministic candidate
  failures exposed provider/catalog incompatibilities; the run was not
  retried blindly.
- 2026-07-29: Bounded diagnostics across every failed or not-yet-reached
  candidate established GitHub Contents CR/LF base64 wrapping, large npm JSON
  trees, exact release-locator constraints, optional HTTP homepage metadata,
  three Casbin moves, and five bad or unsupported catalog mappings. Focused
  correction checks then completed every affected candidate with zero failed
  or partial outcomes. The reviewed full runs remain pending on a clean
  database after deterministic publication.
- 2026-07-29: The complete live-discovery correction matrix passed: frozen
  installation, formatting, lint, typecheck, build, 700 offline tests,
  coverage, architecture, repository, evaluation, contracts, corrected
  catalog, 49 ingestion tests, 23 PostgreSQL tests with two migrations, secret
  scanning, registry audit, `verify`, and `verify:ci`. Coverage was 77.19%
  statements, 70.04% branches, 83.67% functions, and 77.03% lines.
- 2026-07-29: Created and normally pushed correction commit `4f1d1f7`.
  Hosted run `30479865114`, Verification job `90670816764`, passed on the
  correction head. All 1,544 decoded lines were inspected; 700 offline tests,
  49 ingestion tests, 23 PostgreSQL tests with two migrations, the exact
  corrected catalog digest, dependency audit, and clean-worktree proof passed.
- 2026-07-29: Provisioned a fresh dedicated PostgreSQL 18.4 test database from
  the exact ADR 0004 image digest. It used loopback-only exposure, container
  tmpfs with no bind mount or Docker volume, two verified migrations, and a
  non-owner/non-superuser runtime login. The same database remained alive
  across both reviewed full runs.
- 2026-07-29: The first full run requested and completed all 150 candidates
  with 150 complete snapshots, zero failures, and zero partials. It created
  1,244 evidence records through 769 GitHub and 80 npm requests. Its validated
  receipt digest is
  `b789167c49000f08fd7c1297e77ccca45a5ee112b193cfa2851d47ff6be63992`.
- 2026-07-29: The immediate second full run again completed 150 of 150 with
  zero failures and zero partials. It retained 149 identical snapshots and
  appended one exact `audit-signoz` repository-head observation because the
  provider default branch advanced from commit `5eb3b5e3` to `7eb3f7df`
  between runs. The run created one supersession and one new complete
  historical snapshot, with no invalidation or stale transient material. Its
  validated receipt digest is
  `9dc7659dd4aea3e5abd22bfa1e6c58377b742b61fc0e7eccd31c8ee6bc919097`.
- 2026-07-29: Reviewed both closed receipts for bounded size, exact digest,
  complete candidate and snapshot coverage, provider counts, rate-limit state,
  comparison integrity, and absence of credentials, headers, raw responses,
  caches, or unrestricted telemetry. The bounded completion report is
  `catalog/public-v1/live-completion.md`.
- 2026-07-29: The complete final local matrix passed on the bounded completion
  artifact: 700 offline tests, 49 ingestion tests, 23 PostgreSQL tests with two
  migrations, 77.19% / 70.04% / 83.67% / 77.03% coverage, and every required
  formatting, lint, typecheck, build, architecture, repository, evaluation,
  contract, catalog, secret, audit, `verify`, `verify:ci`, and diff check.
- 2026-07-29: Created and normally pushed completion-evidence commit
  `1cdfddc`. Hosted run `30482539446`, Verification job `90680010411`, passed.
  All 1,548 decoded lines were inspected; there were no annotations or failure
  markers, and all six error-looking PostgreSQL lines were deliberate negative
  integration cases.

## Decision and deviation log

- 2026-07-29 — Use current GitHub REST `2026-03-10`, not the older default.
  Both are supported, but the current explicit version provides the longest
  supported window and is the version documented by current endpoint examples.
- 2026-07-29 — Select GitHub reviewed global advisories rather than OSV for V1.
  Exact npm package/version GET filtering and one authenticated host reduce the
  boundary while preserving stable advisory identity and lifecycle times.
- 2026-07-29 — Add no provider SDK or other production dependency. Node 24
  platform APIs cover the fixed bounded transport.
- 2026-07-29 — Keep Phase 4 schema/API unchanged. Existing immutable writes,
  lifecycle operations, active selection, and snapshot operations represent
  the complete Phase 5 result.
- 2026-07-29 — Make advisory coverage intentionally partial and explicit.
  Zero results create a bounded coverage unknown. Temporary failure never
  proves safety, creates no profile, and never invalidates prior advisory
  history.
- 2026-07-29 — Reuse exact prior observations when the deterministic evidence
  ID is unchanged. This reconciles truthful first-collection time with Phase 4
  complete-record idempotency.

## Failures and corrections

| Check or approach                                             | Failure or risk                                                                                                                          | Correction                                                                                                                                           |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial mandated `nvm use`                                    | Codex shell did not auto-load NVM                                                                                                        | Source the existing NVM script explicitly; record the environment correction                                                                         |
| Treat every refresh collection time as a new immutable record | Unchanged sources would conflict on stable evidence IDs and change snapshot cutoffs                                                      | Reuse the exact prior observation when normalized source identity is unchanged                                                                       |
| Use an advisory zero-result as clean evidence                 | Provider coverage cannot prove absence                                                                                                   | Emit a bounded coverage unknown and no favorable evidence                                                                                            |
| First lockfile-only update under the repository frozen policy | pnpm correctly rejected the new workspace manifest as an outdated frozen lockfile                                                        | Run the authorized pnpm non-frozen lockfile update once, then restore and verify frozen installation                                                 |
| First architecture check after adding the package             | Approved Node built-ins resolved to their bare dependency-cruiser names                                                                  | Add only `crypto`, `stream/web`, and `util` to the ingestion Node-API allowlist; the graph then passed                                               |
| First ingestion PostgreSQL changed-refresh test               | Re-appending unchanged limitation/unknown IDs with a later command timestamp conflicted with Phase 4 complete-record idempotency         | Reuse active limitation/unknown records by stable ID and append only new material                                                                    |
| First final secret-scan command                               | Used the nonexistent shorthand `pnpm secrets:scan`                                                                                       | Run the repository's actual `pnpm security:secrets` command; it passed                                                                               |
| Final prompt/ADR/code trace after the first hosted pass       | ADR required moved canonical identity evidence, but the provider rejected every canonical mismatch                                       | Add failing moved/negative-control regressions; accept mismatch only for explicit `moved` entries and emit deterministic limitations                 |
| Independent review of optional-source handling                | Catch-all fallback swallowed cancellation, rate, auth, identity, malformed, size, content-type, redirect, and invariant outcomes         | Add the closed outcome taxonomy; only approved absence is missing, temporary unavailability is partial, and every fatal outcome propagates           |
| Independent review of transient dossiers                      | Temporary optional failure still created a snapshot and persisted empty-reference failure material                                       | Complete all declared collection before the first write; partial receipt has no snapshot or durable material; add five PostgreSQL recovery cycles    |
| Independent review of catalog curation                        | `candidates.json` was shallow and the generator manufactured generic decisions                                                           | Store every curator field explicitly, reject generic rationale/homepages, vary source/file policy, and recompute the digest                          |
| Independent review of identity/time/provenance                | Provider canonical move rewrote identity, publication time drove creation, and license used an unpinned branch request                   | Keep stable manifest identity, use `introducedAt`, pass license commit `ref`, validate file identity/SHA, and construct exact immutable URL          |
| Required live provider/database run                           | No ingestion token, GitHub CLI, `GH_TOKEN`, or `GITHUB_TOKEN` is available; a pinned no-volume local PostgreSQL 18.4 target is available | Stop before provider calls, keep the PR draft, record Phase 5 live completion as incomplete, and request no secret in Git or chat                    |
| Final generated-manifest format check                         | Regenerating after the 150-entry rationale review restored the generator's expanded JSON layout                                          | Run repository formatting, revalidate the same canonical digest, and restart the complete deterministic matrix                                       |
| First credentialed live database gate                         | The runtime login connected but could not read migration history, so live CLI verification failed with `42501` before provider access    | Add forward migration 0002 granting read-only history access, prove runtime verification through PostgreSQL, discard the database, and restart clean |
| First provider-backed full run                                | Provider data exposed wrapped base64, a 330,631-node npm packument, HTTP homepages, unrepresentable release tags, moves, and bad aliases | Stop without a receipt; add bounded mapper regressions, correct curator input, revalidate all affected candidates, and restart from a clean database |
| Clerk optional npm source                                     | Its current full packument is 25,207,671 decoded bytes, above the retained 16 MiB hard body bound                                        | Remove the optional npm mapping/source declarations; retain repository-specific negative-control evidence                                            |
| First live-correction lint pass                               | The many-dist-tags fixture inferred an unsafe tuple union                                                                                | Give the synthetic dist-tag entries explicit readonly string tuple types and restart the complete matrix                                             |

## Validation evidence

| Date       | Command or review                      | Result                                                                                                                                                                                                                    |
| ---------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-29 | Git/GitHub authority checks            | Clean synchronized expected main; PR #12 merged; Issue #11 closed; Issue #13 open                                                                                                                                         |
| 2026-07-29 | Runtime/frozen install baseline        | Node 24.18.0; pnpm 11.17.0; frozen install unchanged                                                                                                                                                                      |
| 2026-07-29 | `pnpm verify` / `pnpm verify:ci`       | 650 offline tests; architecture/repository/contracts/eval/secret/audit passed                                                                                                                                             |
| 2026-07-29 | `pnpm db:verify`                       | PostgreSQL 18.4; one migration; 13 public product tables; zero RLS; 12 tests, no skips                                                                                                                                    |
| 2026-07-29 | Provider primary-source review         | Endpoint, API version, authentication, rate-limit, npm packument, and advisory choices recorded                                                                                                                           |
| 2026-07-29 | `pnpm catalog:validate`                | 150 unique candidates; 30 authorization, 30 audit logging, 30 background jobs, 30 rate limiting, 30 webhooks; digest `d9d61d8b07f7e638ceaa102f4145388b59d1d537aac6203006d98c020b70697d`                                   |
| 2026-07-29 | Ingestion deterministic tests          | Manifest, fixed transport, rate limits, provider mapping, all-family profiles, limitations, refresh, and receipt tests passed                                                                                             |
| 2026-07-29 | Final offline/coverage suite           | 37 files / 670 tests; 76.93% statements, 69.46% branches, 83.50% functions, 76.76% lines                                                                                                                                  |
| 2026-07-29 | Updated `pnpm db:verify`               | PostgreSQL 18.4; one migration; 13 public tables; zero RLS; 15 DB tests including ingestion round trip, rerun, changed lifecycle, concurrency, and independent failure; no skips                                          |
| 2026-07-29 | `db:migrate` / `db:check` / `db:test`  | Individually passed against one explicitly provisioned ephemeral PostgreSQL 18.4 target; 15 tests, no skips                                                                                                               |
| 2026-07-29 | Ingestion architecture graph           | 625 modules / 1,988 dependencies; no violations                                                                                                                                                                           |
| 2026-07-29 | Final `pnpm verify`                    | Formatting, build, lint, typecheck, 670 tests, architecture, repository, evaluation, contracts, catalog, and secret scan passed                                                                                           |
| 2026-07-29 | Final `pnpm verify:ci`                 | Final `verify`, PostgreSQL verification, and registry-backed moderate dependency audit passed; no known vulnerabilities                                                                                                   |
| 2026-07-29 | Hosted CI run/job                      | Run `30445222539`, Verification job `90553802670`: success; all 1,547 decoded log lines inspected, 668 offline and 15 PostgreSQL tests, clean-worktree proof, no warnings/errors                                          |
| 2026-07-29 | Hosted evidence-head rerun             | Run `30445683262`, Verification job `90555328238`: success on commit `9231e96`; all 1,547 decoded lines inspected, no warning/error or nonzero-exit markers                                                               |
| 2026-07-29 | Live configuration gate                | Required GitHub and database variables unset; no provider request made and no receipt claimed                                                                                                                             |
| 2026-07-29 | Corrected `pnpm catalog:validate`      | 150 unique candidates; 30 per family; 102 active / 3 archived / 1 moved / 44 negative controls; digest `371df1d677284466f7b29f3aaef0b15641e09cf3792a3badc64c45004161dfb7`                                                 |
| 2026-07-29 | Corrected offline/coverage suite       | 37 files / 695 tests; 77.14% statements, 69.95% branches, 83.62% functions, 76.98% lines                                                                                                                                  |
| 2026-07-29 | Corrected ingestion suite              | 5 files / 44 tests, including fatal outcome propagation, declaration/request agreement, exact license provenance, and rationale rejection                                                                                 |
| 2026-07-29 | Corrected PostgreSQL matrix            | Individual migrate/check/test commands passed on one no-volume PostgreSQL 18.4 container; 1 migration, 13 tables, 0 RLS, 23 tests; independent `db:verify` passed without skips                                           |
| 2026-07-29 | Corrected local `verify` / `verify:ci` | Full deterministic verification and registry-backed moderate audit passed; 625 modules / 1,988 dependencies, no architecture violations, no known vulnerabilities                                                         |
| 2026-07-29 | Corrected live configuration gate      | GitHub CLI and all eligible token variables absent; local pinned ephemeral PostgreSQL is available; no provider request made and no receipt claimed                                                                       |
| 2026-07-29 | Corrected hosted Verification          | Run `30471964637`, job `90644174655`: success on `59a681d`; 695 offline and 23 PostgreSQL tests, exact catalog digest, audit, and clean-worktree proof; 1,543 log lines reviewed                                          |
| 2026-07-29 | Pre-live deterministic baseline        | Frozen install, catalog validation, 44 ingestion tests, 23 PostgreSQL tests, complete `verify`, and registry-backed `verify:ci` passed before credentialed provider access                                                |
| 2026-07-29 | First credentialed live attempt        | Stopped before provider access; no receipt; runtime migration-history read failed with `42501`; no-volume database and temporary telemetry removed                                                                        |
| 2026-07-29 | Runtime migration verification fix     | PostgreSQL 18.4 applied two forward migrations; 23 database tests passed without skips, including non-owner runtime verification of the exact applied inventory                                                           |
| 2026-07-29 | Post-live-discovery local matrix       | 695 offline tests; 77.14% statements / 69.95% branches / 83.62% functions / 76.98% lines; 44 ingestion and 23 PostgreSQL tests; all deterministic gates passed                                                            |
| 2026-07-29 | Migration-fix hosted Verification      | Run `30476762296`, job `90660300464`: success on `c794880`; 695 offline and 23 PostgreSQL tests with two migrations; all 1,550 decoded lines inspected                                                                    |
| 2026-07-29 | Bounded all-candidate live diagnostics | Every catalog entry reached provider mapping; all discovered failures were reproduced with safe metadata only, corrected, and focused-rechecked with zero failures/partials                                               |
| 2026-07-29 | Live-corrected `catalog:validate`      | 150 unique candidates; 30 per family; 99 active / 3 archived / 4 moved / 44 negative controls; 80 npm-backed / 70 repository-only; digest `4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634`              |
| 2026-07-29 | Live-correction deterministic matrix   | 700 offline and 49 ingestion tests; coverage 77.19% / 70.04% / 83.67% / 77.03%; 23 PostgreSQL tests with two migrations; all local deterministic and audit gates passed                                                   |
| 2026-07-29 | Live-correction hosted Verification    | Run `30479865114`, job `90670816764`: success on `4f1d1f7`; all 1,544 decoded lines inspected; exact corrected catalog, 700 offline tests, 23 PostgreSQL tests, audit, and clean worktree passed                          |
| 2026-07-29 | First reviewed full live run           | 150 requested/completed/snapshots; 0 failed/partial; 1,244 evidence created; 769 GitHub + 80 npm requests; receipt `b789167c49000f08fd7c1297e77ccca45a5ee112b193cfa2851d47ff6be63992`                                     |
| 2026-07-29 | Immediate reviewed idempotency run     | 150 requested/completed; 0 failed/partial; 149 identical snapshots; one legitimate SigNoz head change, one new evidence/supersession/snapshot; receipt `9dc7659dd4aea3e5abd22bfa1e6c58377b742b61fc0e7eccd31c8ee6bc919097` |
| 2026-07-29 | Final local completion matrix          | 700 offline and 49 ingestion tests; 77.19% / 70.04% / 83.67% / 77.03% coverage; 23 PostgreSQL tests with two migrations; every requested local validation command passed                                                  |
| 2026-07-29 | Completion hosted Verification         | Run `30482539446`, job `90680010411`: success on `1cdfddc`; all 1,548 decoded lines inspected; no annotations/failure markers; exact catalog, 700 tests, PostgreSQL, audit, and clean worktree passed                     |

The independent-review implementation, runtime migration fix, and
live-discovered catalog/provider corrections are published on the existing
draft branch with successful deterministic hosted evidence. Both reviewed full
live runs succeeded. Their compact completion report is published and passed
the complete local matrix and hosted Verification. PR #14 remains draft,
unmerged, and pending independent final review.
