# ADR 0014: Contract the npm source to selected-version metadata

- Status: Proposed for independent exact-head acceptance; no provider effect authorized
- Date: 2026-08-11
- Issue: #32
- Pull request: #33

## Context

The authorization-v5 M3 successor experiment reached provider effects and is
consumed. Its safe diagnostic records `ingestion.body-too-large` at
`npm-package-metadata`; it published no source authority and performed no
replay or readiness measurement. Failure record
`candidate-authority-live-failure-record/2.0.0` preserves the complete safe
diagnostic without provider response values.

Operator v5 requested `GET /{package}` with `Accept: application/json` and a
2,097,152-byte response ceiling. npm's official
[package metadata contract](https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md)
defines that request as the full package document, including every Version
object, and explicitly notes that some full documents exceed 10 MB
uncompressed. The official
[Public Registry API](https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md)
separately defines `GET /{package}/{version}`, where `version` may be
`latest`, as a single Version endpoint. Therefore the full-packument source was
not contract-compatible with the accepted two-mebibyte safety envelope. This
diagnosis uses only the safe failure diagnostic, frozen repository authority,
and those official contracts. The failed body was not inspected or
reconstructed, and no package endpoint was queried.

## Decision

1. Authorization v5 is consumed with zero remaining collections. Operator v5
   and `npm-package-metadata` are immutable failure history and cannot be
   rerun.
2. The next independently reviewed experiment replaces that operation with
   `npm-selected-version-metadata`, requesting exactly
   `GET /{urlEncodedExactCatalogPackageName}/latest`. It does not request the
   full or abbreviated packument, npm search, or any tarball.
3. The mutable selector `latest`, exact returned `name`, and exact returned
   `version` are retained. A present `_id` must equal
   `<name>@<version>`. The catalog mapping and returned name must agree.
4. The response retains only the bounded optional properties required by
   accepted rules: `engines.node`, `exports`, `main`, `module`,
   `peerDependencies`, `type`, and repository declaration. README, scripts,
   unrelated dependency graphs, authors, maintainers, raw package JSON,
   response bodies, headers, and transport metadata are discarded.
5. The response and JSON-node ceilings remain 2,097,152 bytes and 100,000
   nodes. Raising the byte limit, adding a package-specific exception, or
   adapting to the failed package is rejected.
6. For this optional mapped npm source only, body-too-large, provider
   unavailable, rate limited, deadline exceeded, and unresolved/absent source
   states become qualified unknown. The body is discarded before semantic
   parsing. Unsafe redirect, malformed safely read required identity,
   catalog/package disagreement, unsafe transport behavior, and internal
   invariant failures remain fatal.
7. npm scope has exactly three states: catalog-unmapped,
   mapped-source-established, and mapped-source-unresolved-or-absent. Only the
   first makes npm and GitHub advisory acquisition not applicable. An
   unresolved mapped source suppresses the advisory request and emits qualified
   unknown `npm-version-scope-unavailable`.
8. The Version endpoint does not establish `publishedAt`. The complete
   `package-publication-version` profile remains unknown for mapped packages.
   A successful exact selected-version source may emit the narrow affirmative
   direct partial fact `registry-resolved-package-version`; catalog-unmapped
   remains legally not applicable.
9. npm-derived evidence uses structured provider snapshot provenance with
   provider `npm` and source class `package-metadata`. It never fabricates the
   domain `package-version` provenance or inserts the collection cutoff as a
   publication timestamp.
10. The readiness denominator remains 18, the minimum remains 13/18
    (72.222222%), and all four breadth groups remain required. Planned
    extraction capability remains 13. Planned full-closure candidates decrease
    from five to four: runtime-package-format, package-repository-linkage,
    archived-state, and maintenance-activity. Full closure is not the readiness
    numerator.

## Consequences

Provider contract v3, field plan v6, partial semantic registry v3, source
policy v8, replay v5, source authority v3, replay output v3, root v6, operator
v6, and authorization v6 form one additive successor lineage. Authorization
v6 remains inactive until a later independent reviewer supplies the exact
published correction head through the non-secret accepted-head gate. This ADR
and its publication authorize no credential read, cutoff creation, provider
request, live source generation, all-candidate projection, readiness
measurement, or M4 work.

## Rejected alternatives

- Raising the body ceiling is rejected because it weakens the frozen safety
  envelope without a contract-wide upper bound.
- Special-casing the failed candidate, package, candidate ordinal, or request
  count is rejected as evaluation contamination and provider-contract drift.
- The full packument is rejected because its size grows with package history.
- The abbreviated all-version packument is rejected because it still acquires
  an unnecessary all-version document.
- npm search is rejected because it changes identity semantics and adds an
  unrelated discovery source.
- Tarballs are rejected because candidate code/content acquisition and
  execution are outside M3.
- Fabricating `publishedAt` from the collection cutoff is rejected because a
  collection timestamp is not publication evidence.
