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
foundation, not production readiness. Milestone 7A now implements the
controlled materialization operator without running it; production retrieval
remains unimplemented and Milestone 7B live execution remains unauthorized.

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
`f8346dae699196bd35570089e0b73bb56b8664265981dca76f4bec2b1e1899e9`.
The closed operational schema byte digests are:

- provider policy:
  `39be981d31acc0e8437087edb13ebb3e441e654a9ce6b3692eb1d657aa345dc1`;
- source authority:
  `af4fa351c882fbb34c6379f1ee06522dc5367a1ee5eadc6db2ee90b5992acff1`;
- coverage:
  `79a3147a6e78cd5adc7a19ac06916820c9091e943ee8161695b31eeea67936eb`;
- receipt:
  `c91fbea628bbf890e88b12a5c682f4ce64733e0750c788ebd9174899d5e4a8a2`.

`collectProfileMaterializationSources` is separate from the unchanged
`collectCandidateSources` API. It produces granular normalized records for the
closed, operational, untracked
`profile-materialization-source-authority/1.0.0`. Future authorities live only
below `verification/retrieval-v1/.profile-materialization-runs/<run-id>/` with
private modes, bounded canonical no-follow writes, and no run ID in semantic
identity. They must remain local and immutable until 7B review, final Milestone
7 acceptance, and explicit maintainer deletion approval.

Pure materialization reads only the accepted catalog, taxonomy, and source
authority and returns exactly 150 accepted profile DTOs plus
`profile-materialization-coverage/1.0.0`. It preserves the four catalog-derived
fields and may populate only repository discovery, package publication/version,
runtime package format, license, archived, fork/upstream, release recency,
advisory, security-policy, and package/repository-linkage fields. Conservative
rules leave unsupported language/module/SPDX/advisory/provider outcomes unknown
and never turn failed detection into a negative fact.

The only command surface is preflight, execute, and verify. Preflight is
read-only, emits no build output, and reads no credential; an explicit internal
source-resolution condition preserves the ordinary compiled package exports.
Execute owns all future effects in one
cleanup-protected boundary and cannot publish fixed evidence before exact
database/container/network disposal proof. Verify is read-only. None of these
commands is invoked by ordinary `pnpm verify` or hosted CI during Milestone 7A;
execute remains unauthorized.

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
