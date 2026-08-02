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
