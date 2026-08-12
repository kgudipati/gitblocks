# ADR 0016: Ground derived package linkage with complete multi-source evidence

- Status: Proposed for independent exact-head acceptance; no provider effect authorized
- Date: 2026-08-11
- Issue: #32
- Pull request: #33
- Accepted routing predecessor: ADR 0015 at
  `2be3d5950cc69572b5b45fc641848fed112fc112`

## Context

The accepted package-repository-linkage rule compares a supported npm selected
version repository declaration or omission with two exact candidate repository
aliases: immutable catalog identity and the accepted Phase 9 provider-canonical
identity. The deterministic profile projector already uses both the npm and
GitHub repository-metadata source records.

The complete evidence bridge nevertheless accepted exactly one source per
known field and selected only npm metadata for package linkage. A dossier could
therefore expose `matched`, `mismatched`, or `undeclared` while omitting the
repository-identity source material to the comparison. That violates ADR 0011:
a profile value alone cannot ground a material claim or hard conflict when its
complete accepted source basis does not resolve through candidate evidence.

## Decision

Complete known-field evidence supports a bounded canonical set of one or two
ordinary source observations. The maximum is two. Every observation for a
field binds the same candidate, field ID, and exact field-value digest. Source
identity is unique; duplicate, missing, unexpected, or additional sources are
invalid.

Ordinary known fields retain exactly one observation. Known
`package-repository-linkage` requires exactly two:

1. npm `package-metadata` from `npm-selected-version-metadata`; and
2. GitHub `repository-metadata` from `github-repository-metadata`.

The requirement applies uniformly to `matched`, `mismatched`, and
`undeclared`. Catalog-unmapped not-applicable and unresolved or unsupported
repository metadata produce no complete linkage evidence.

The evidence authority and dossier carry two ordinary evidence observations
and two complete-field bindings. No composite provenance type is added. The
deterministic profile remains responsible for the linkage result; the
observations resolve the full material source basis for downstream claims and
future hard-conflict evaluation.

The Phase 9 route record's exact `sourceRecordDigest` becomes part of the
provider-route context and live repository-metadata source value, together with
the routing authority version, snapshot ID, and authority digest. Source and
replay validators compare it against the committed Phase 9 record for the same
candidate. Description, topics, and primary language remain prohibited routing
metadata for M3 facts.

## Consequences

Provider contract v5, source policy v10, replay v7, source/output authority v5,
root v8, operator v8, and inactive authorization v8 form an additive successor
lineage. Field plan v7 remains the accepted substantive plan. Authorization v7
never activated and is superseded before activation.

No provider operation, redirect, request, attempt, field capability, readiness
threshold, or breadth rule changes. Canonical routing and npm selected-version
semantics remain accepted and unchanged.

## Rejected alternatives

- Treating npm metadata alone as the comparison evidence is rejected because
  it cannot establish candidate repository identity closure.
- A synthetic composite provenance object is rejected because existing dossier
  contracts already represent multiple ordinary observations.
- Unlimited source fan-out is rejected; V1 complete fields are bounded to two
  canonical sources.
- Changing the public dossier source union is rejected because no new source
  kind is required.
