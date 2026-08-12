# ADR 0015: Bind candidate provider routing to accepted Phase 9 canonical repository identities

- Status: Proposed for independent exact-head acceptance; no provider effect authorized
- Date: 2026-08-11
- Issue: #32
- Pull request: #33

## Context

The authorization-v6 experiment reached provider effects and is consumed. Its
safe diagnostic records `ingestion.redirect` at
`github-repository-metadata`; it retains neither the Location header nor the
redirect target. No response body, credential, or candidate fact was retained
or reconstructed.

Phase 9 independently published
`candidate-retrieval-metadata-authority/1.1.0`, snapshot
`retrieval-metadata-snapshot-23c38be5e5b117c74832049ae58f455f`, before the
v6 failure. Its existing contract parser validates all 150 catalog identities,
provider-canonical identities, identity states, source-record digests, bounds,
snapshot ID, and authority digest. That accepted authority is admissible for
structural provider routing without reconstructing any v6 provider value.

## Decision

GitBlocks distinguishes immutable catalog identity from provider-routing
identity.

Catalog identity remains the candidate ID plus the catalog GitHub owner and
repository. The public manifest, candidate catalog, Ranking V1 inputs, and
candidate IDs remain unchanged.

Every repository-scoped GitHub request uses the exact provider-canonical owner
and repository from the accepted Phase 9 authority. Before any request, the
route must bind the same candidate ID and exact catalog owner/repository as the
catalog. The frozen identity state is either `unchanged` or `redirected`.
Repository metadata must return the accepted provider-canonical identity
case-insensitively, including coherent `full_name`, `owner.login`, and `name`,
or collection fails with provider identity disagreement. Live values never
silently update the route.

The transport retains `maximumRedirects = 0`. A redirect from an already
accepted canonical route remains fatal, is not followed, and its Location is
not inspected. Such a redirect indicates routing-snapshot drift requiring a
separate identity-authority disposition; M3 does not rediscover identity.

The routing authority is consumed only for candidate ownership and GitHub
request routing. Its description, topics, and primary language do not populate
M3 profiles, facts, evidence, dossiers, or readiness. Current language,
archival, maintenance, release, license, security, and deployment values still
come from the future live successor collection.

For package-repository linkage, only two accepted aliases exist: the catalog
identity and the Phase 9 provider-canonical identity. A supported npm
repository declaration matching either alias is `matched`; one matching
neither is `mismatched`; supported omission is `undeclared`; unsupported input
remains unknown.

GitHub structured-provider and immutable Git evidence URLs use the
live-validated provider-canonical identity. Candidate ownership and dossier
identity remain the immutable candidate ID and catalog identity.

## Consequences

Provider contract v4, field plan v7, source policy v9, replay v6, source and
output authority v4, root v7, operator v7, and inactive authorization v7 form
one additive successor lineage. No identity-probe or redirect-following request
is added; the logical and attempt ceilings remain unchanged. Authorization v7
requires a new independently accepted exact correction head before any
credential read or provider effect.

## Rejected alternatives

- Following redirects is rejected because Phase 9 already froze canonical
  identity and M3 must detect rather than silently absorb later drift.
- Mutating catalog identities is rejected because repository routing does not
  redefine product/candidate identity.
- Special-casing any candidate or repository is rejected because routing is
  generic over the complete accepted 150-record authority.
- Using Phase 9 descriptions, topics, or languages as live M3 evidence is
  rejected because the authority is structural routing input only.
