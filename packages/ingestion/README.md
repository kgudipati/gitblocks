# `@gitblocks/ingestion`

Bounded, manifest-first ingestion of approved public GitHub repositories and
npm packages into the GitBlocks public evidence store.

The package never discovers candidates, clones repositories, downloads
tarballs, executes candidate code, or invokes a model. Network, clock,
deadline, observer, and persistence capabilities are explicit inputs. Importing
the package performs no I/O and reads no environment variables.

`catalog/public-v1/candidates.json` is the explicit curator source.
`catalog-cli.ts` only validates, sorts, digests, and writes the generated
manifest. Every entry supplies stable GitHub identity, stable `introducedAt`,
candidate-specific rationale and selection sources, source declarations,
status, capability families, and its own file allowlist.

Milestone 4 adds a separate offline projection from the parsed committed
`catalog/public-v1/manifest.json`. That manifest's typed status, family,
GitHub identity, and npm mapping fields are the only candidate-specific known
facts used. Rationale, selection sources, dossiers, observations, completion
Markdown, artifact selections, provider output, databases, and repository text
are never reparsed. The generated
`catalog/public-v1/candidate-profile-authority.json` contains all 150 profiles;
`verification/retrieval-v1/profile-coverage.json` is aggregate and
content-free.

`pnpm profiles:validate` regenerates both artifacts in memory, validates
catalog/taxonomy/profile semantics, ordering, digests, 150-candidate closure,
and arithmetic, then compares committed bytes without writing.
`pnpm profiles:generate` is the only write mode and may write only those two
fixed regular-file paths. Both commands reject symlinks/path escapes and use
reviewed 2 MiB catalog, 1 MiB taxonomy, 4 MiB profile-authority, and 256 KiB
coverage bounds. Imports remain effect-free; neither command uses environment
semantics, a clock, randomness, a network, a provider, a model, persistence, or
Phase 7 state.

The offline authority is mostly unknown by design: 600 of 4,050 cells are
known, 210 are not applicable because 70 candidates have no approved npm
mapping, 3,240 are unknown, and none conflict. This is an honest deterministic
foundation, not production readiness. Milestone 7A implements the controlled
materialization operator. Four permanent live executes have been consumed, but
none established accepted completion evidence; production retrieval remains
unimplemented and Milestone 7B remains incomplete.

The separately digested
`profile-materialization-provider-policy/1.0.0` permits nine exact operations
using only HTTPS GET to `api.github.com` and `registry.npmjs.org`. It binds
manual same-host redirects, two redirects, bounded bytes/JSON nodes, existing
retry/cancellation, deadlines, concurrency, retained properties, mutability,
absence/failure semantics, and the exact permitted profile consumers. The
committed catalog mechanically derives a maximum budget of 913 requests.
Repository tag and exact allowlisted-file collection are persistence-audit-only;
file bodies never enter source/profile/receipt/coverage output.
Its semantic digest is
`0945ebd862d0a1b5f622c4f10f60b2c0e713fb127cc5dea5668be5cc40c96ede`
and its committed byte digest is
`1590d72b97e4e2b51f010192df98ba1b247e7ce55d0032057ad43e9a8568713c`.
The closed operational schema byte digests are:

- provider policy:
  `deac5cee0d921aabeb013ceecfa0730f878d5bd6cc451cd6fb865cd4257f4458`;
- source authority:
  `8483a9564a668de709180b97868b115a49fe209fc54abe4b1614c88912d6c7ab`;
- persistence proof:
  `96974cfd824cc9e14ca1f2e61ffdf4bb8f14edbae5f1c268fb1d92d041f51b96`;
- coverage:
  `79a3147a6e78cd5adc7a19ac06916820c9091e943ee8161695b31eeea67936eb`;
- receipt:
  `53b546ad92e36499a344874d146bd2ffd9c8b0ef340f7a9524d05cb54054e955`.

`collectProfileMaterializationSources` is separate from the unchanged
`collectCandidateSources` API. It produces granular normalized records for the
closed, operational, untracked
`profile-materialization-source-authority/1.0.0`. Future authorities live only
below `verification/retrieval-v1/.profile-materialization-runs/<run-id>/` with
private modes, bounded canonical no-follow writes, and no run ID in semantic
identity. They must remain local and immutable until 7B review, final Milestone
7 acceptance, and explicit maintainer deletion approval.

The second authority reconciles against the first. Equal normalized source
content with equal evidence reuses the complete first record. Equal content
with newly established evidence retains the current recovery record; missing
current evidence reuses durable prior IDs only when the complete current
candidate record set contains an unavailable source; different nonempty
evidence lists fail closed. Qualification derives from current unavailable
records, and evidence-only enrichment is not provider drift. Repository/head/release/tag/community/
npm/advisory records are mutable singleton selectors. License and file records
bind immutable exact-commit logical identities; head advancement therefore
produces ordinary selector drift and old/new snapshot identities rather than
an immutable conflict. Different established facts for one exact-snapshot
identity fail closed. `unavailable` establishes no immutable fact, so a value
or established absence may transition to/from controlled unavailability as
changed drift without rewriting either collection authority.

Each collection also retains
`profile-materialization-persistence-proof/1.0.0` in the same private run
directory. Complete legacy bundles are profiled and persisted through the
existing runtime-role-only path. Exact controlled observation topics bind the
resulting generated/reused evidence IDs without parsing prose. Optional-source
qualified candidates create no new evidence and retain an explicit
`qualified-not-persisted` disposition; unchanged records may retain exact
evidence IDs from an earlier durable collection. A selected release requires
the exact `release-current` evidence chosen by the shared legacy selector. An
allowlisted file requires the exact controlled path topic, candidate,
git-commit SHA, exact safe GitHub repository source URL, and immutable URL with
the same owner/repository plus exact encoded commit/path rather than a topic
prefix or filename suffix. The dedicated materialization collector supplies
that repository source identity without changing legacy public collection.
The future content-free receipt binds both proof digests and
aggregate dispositions; source reconciliation plus the second persistence
result, not provider drift alone, determines live idempotency.

Pure materialization reads only the accepted catalog, taxonomy, and source
authority and returns exactly 150 accepted profile DTOs plus
`profile-materialization-coverage/1.0.0`. It preserves the four catalog-derived
fields and may populate only repository discovery, package publication/version,
runtime package format, license, archived, fork/upstream, release recency,
advisory, security-policy, and package/repository-linkage fields. Conservative
rules leave unsupported language/module/SPDX/advisory/provider outcomes unknown
and never turn failed detection into a negative fact.

The only command surface is preflight, execute, and verify. Named arguments are
passed directly after the pnpm script alias without a standalone `--` separator.
Preflight is
read-only, emits no build output, and reads no credential; an explicit internal
source-resolution condition preserves the ordinary compiled package exports.
Execute owns all authorized effects in one
cleanup-protected boundary and cannot publish fixed evidence before exact
database/container/network disposal proof. The PostgreSQL 18 container mounts
tmpfs only at `/var/lib/postgresql`. Before health polling, three bounded,
plan-authenticated commands must agree: `HostConfig.Tmpfs` proves the exact
requested root and `rw,noexec,nosuid,nodev,size=1073741824` option set;
`/proc/self/mountinfo` proves one effective writable root tmpfs with the four
security flags and a `size=` super-option; and `.Mounts` rejects any volume,
bind, or conflicting storage attachment while accepting Docker Desktop's
observed empty array. Another engine may expose one compatible explicit root
tmpfs entry, but it is not required. Wrong/conflicting roots,
missing/duplicate/contradictory/extra options, malformed or oversized output,
and failed inspections all fail before database proof or migration.
Cleanup removes and proves absence
of the exact container before it can remove and prove the exact network; every
nonzero removal or unexpected inspection fails. Failed execute output contains
only a fixed stage and safe ingestion code, never raw exception or secret text.
Verify is read-only. None of these
commands is invoked by ordinary `pnpm verify` or hosted CI during Milestone 7A.
The first live execute failed before authority/evidence publication with its
prior-CLI stage unknowable. A second corrected execute failed at
`fresh-database-create` before provider access. Isolated probes traced that
boundary to an incorrect positive `.Mounts` assertion: the accepted `--tmpfs`
plan produced `.Mounts=[]`, exact `HostConfig.Tmpfs` configuration, and one
hardened effective root tmpfs in mountinfo, with no Docker volume object. A
third execute on the corrected storage boundary also failed without authority
or evidence; its wrapper lost the bounded stage/code, so the failure stage is
not inferred. A later staged diagnostic passed database creation and localized
the next reproducible boundary to `zero-state-proof`.

The fresh 0/0 migration/product-table proof now permits at most ten one-second
host connection attempts separated by fixed 250 ms sleeps. Only seven fixed
transport codes are retryable; authentication, SQL/protocol, nonempty-state,
cancellation, and unknown failures fail immediately. The caller signal cancels
the pending query and sleep, every attempt closes its client, and exhausted
host readiness is exposed only as `zero-state-proof` with
`ingestion.persistence`. All four executes remain permanent, none was retried,
Milestone 7B remains incomplete, and execute number five is not authorized.

The first isolated exercise of that correction passed internal health but
exhausted all ten connection-class attempts. A bounded Docker Desktop port
diagnostic then found the requested HostConfig binding but no runtime
NetworkSettings mapping on the dedicated `--internal` topology. The fresh
database now uses an exactly named, labeled, non-internal user-defined bridge;
it remains separate from the default bridge and publishes only
`127.0.0.1:<fresh-port>:5432`. After health, a plan-digested `docker port`
command must prove exactly that loopback mapping before host SQL may begin.

This bridge is not described as egress-isolated. The ephemeral database holds
only transient public-materialization state, receives no provider credential,
uses a digest-pinned image and hardened tmpfs with no volume/bind, and is
disposed before fixed evidence publication. The bounded zero-state policy and
safe error mapping above remain unchanged. Execute number five is not
authorized.

The isolated acceptance gate for this correction passed on diagnostic run-ID
digest
`c5511e5a26eded10fe9e66da6a2734d150d38b26eeeaada414edfe70889fce58`.
The dedicated bridge was non-internal; storage configuration, mount conflict,
runtime tmpfs, internal health, and exact loopback publication all passed; and
the 0/0 host proof completed on its first connection attempt. Disposal and
post-disposal container, network, and volume absence passed. No migration,
catalog seed, provider collection, public materialization preflight, or
materialization execute occurred.

Permanent execute number four then passed database creation and the zero-state
proof with zero migrations and zero product tables before failing at the
coarse `migrate-schema-runtime-role-catalog-seed` stage with
`ingestion.internal-invariant`. It made zero provider requests, created no
retained run directory, and published no fixed evidence. Static review found an
independently invalid utility-DDL boundary inside that stage: `CREATE ROLE ...
PASSWORD $1` was sent through `unsafe`. The coarse stage does not prove that
this exact statement caused the execute failure.

Runtime-role provisioning now binds the role and password through
transaction-local `pg_catalog.set_config` calls, then uses a fixed PL/pgSQL
`DO` body whose dynamic commands quote the identifier with
`pg_catalog.format('%I', ...)` and the password literal with
`pg_catalog.format('%L', ...)`. The password never enters Node-created utility
SQL or a failure line. The login retains exactly the required restricted role
attributes and exactly one direct `gitblocks_persistence` membership. Both
statements retain the caller cancellation boundary, and transaction failure
cannot expose a partially accepted prepare result. The correction is validated
as deterministic offline correctness only. Its formerly planned isolated real
system-effects `createDatabase`, `proveEmptyDatabase`, and complete
`prepareDatabase` gate was not completed, so the corrected live path remains
unproven. Milestone 7B is deferred; no further Phase 8 materialization
diagnostic, provider request, source collection, receipt, fixed evidence, or
execute number five is authorized.

Phase 6 adds a separate `public-artifacts-v1` selection authority without
changing Phase 5 file allowlists. `artifact-selections.json` contains the
review-focused proposed additional paths and rationales;
`artifact-manifest.json` binds them to the exact catalog and adds one optional
root README attempt per candidate. `artifact-manifest-cli.ts` validates the
closed shapes, deterministic selection IDs, safe paths, coverage, ordering, and
digest. It imports no evaluation records or gold.

Artifact collection is a separate operator path. `pnpm artifacts:verify`
exercises its deterministic offline boundary. `pnpm artifacts:live` requires
an injected GitHub token and PostgreSQL connection, explicit catalog,
artifact-manifest, and receipt paths, the
`approved-non-production-public-artifact-collection` acknowledgement, and an
`ephemeral-non-production` database-scope declaration. The command never
migrates implicitly. Its receipt is bounded and content-free, and
`pnpm artifacts:receipt` validates or compares receipts without contacting a
provider.

The original Phase 6 live proof ran against migration `0003`, and its valid
historical receipts remain accepted by the generic receipt parser. A new live
artifact collection for Phase 7 preparation requires the exact verified
0001–0004 migration inventory; the live operator rejects migration `0003`,
missing migrations, and migrations newer than `0004` before constructing its
GitHub transport or collector. The verified exact value `4` is recorded in the
new receipt through the existing collection boundary.

A fresh migration-`0004` database does not contain durable catalog provenance.
After the second preparation stop exposed that missing composition boundary,
`pnpm catalog:seed -- --catalog <explicit-path>` was added as a separate
catalog-only operator. It parses and authenticates the exact committed
`public-v1` catalog, verifies that the database is exactly at migration `0004`,
builds the complete frozen seed plan before its first write, then uses only
`putCatalogCandidate` and `setCandidateCapabilityFamilies` in canonical
candidate order. Normal profiling and seeding share the same pure candidate
identity and capability-family mapping authority.

The seed command requires
`approved-non-production-public-catalog-seed` and
`ephemeral-non-production` plus explicit discrete PostgreSQL environment
configuration. It has no GitHub/OpenAI credential, provider, profiler,
transport, timeout, file-write, evidence, limitation, unknown, dossier,
artifact, or interview path. It does not apply migrations. Its stdout is only
the canonical content-free completion summary. On any write failure it emits
no success summary, stops immediately, and the ephemeral database is
ineligible and must be discarded. The correction exercised only the prescribed
PostgreSQL test harness; no real preparation database or seed was run.

The artifact operator consumes the closed public catalog:

```shell
pnpm artifacts:live -- \
  --catalog catalog/public-v1/manifest.json \
  --manifest catalog/public-v1/artifact-manifest.json \
  --receipt <absolute-untracked-receipt-path> \
  --concurrency 2 \
  --deadline-ms 3600000
```

Symlinks remain unsupported generally. The provider-discovered root README
selector may resolve exactly one safely bounded repository-internal symlink to
a normal blob at the same exact commit. The artifact is identified by the
normalized target path and target blob; the symlink itself is not persisted as
an artifact. Explicit path selections remain regular-file-only.

One process-wide decoded-byte budget is shared by both candidate workers and
charged before every Base64 decode. It includes both Contents/README and
independent Git blob bodies, including decodes from candidates that later fail.
Receipts report that operational total separately from bytes in successfully
materialized immutable artifacts.

For a safely resolved root README symlink, the operational total charges the
README endpoint's resolved content, the symlink target-path blob, and the
independently retrieved target blob. Materialized artifact bytes count only the
accepted target once. The symlink path is decoded only as strict bounded
repository-path data, never as artifact content.

Repository identity and head are universal. `expectedSourceTypes` controls
optional release, tag, exact-commit license, community, allowlisted-file, npm,
and reviewed-advisory requests. The maximum logical budget remains 12 requests
per candidate, including two advisory pages.

GitHub Contents base64 accepts provider line wrapping only as CR/LF and removes
that wrapping before strict validation and decoding. Full npm packuments retain
the 16 MiB body limit and use a 400,000-node package-specific parse budget
inside the transport's 500,000-node hard maximum. Optional repository homepage
metadata is retained only when it is a credential-free HTTPS URL; a valid
non-HTTPS homepage is treated as absent, while malformed metadata remains
fatal. Release evidence selects only immutable tags representable by the
product contract and percent-encodes the exact tag path segment.

Provider outcomes are closed and value-free. Only approved optional absence
becomes a normal missing value. Temporary optional unavailability returns a
partial candidate receipt without profiling or persistence. Cancellation,
deadline, rate limit, authentication/authorization, identity, malformed
response, content type, size, redirect, and invariant failures remain fatal
and create no snapshot.

The persisted candidate identity and creation time come from the manifest's
stable GitHub identity and `introducedAt`. A moved entry may resolve to a new
provider canonical location; that location is evidence and a limitation, not
an identity rewrite. License requests pass the captured commit as `ref`, and
license evidence URLs bind current canonical owner/repository, that exact
commit, and the detected path.

See [ADR 0005](../../docs/architecture/decisions/0005-public-repository-ingestion.md)
and the
[Phase 5 execution plan](../../docs/plans/0013-public-repository-ingestion.md)
for source policy, bounds, refresh semantics, and operator procedures.
Artifact selection and collection are governed separately by
[ADR 0006](../../docs/architecture/decisions/0006-immutable-repository-artifacts.md)
and the
[Phase 6 execution plan](../../docs/plans/0015-immutable-repository-artifacts.md).
