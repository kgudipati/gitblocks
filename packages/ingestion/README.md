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

Repository identity and head are universal. `expectedSourceTypes` controls
optional release, tag, exact-commit license, community, allowlisted-file, npm,
and reviewed-advisory requests. The maximum logical budget remains 12 requests
per candidate, including two advisory pages.

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
