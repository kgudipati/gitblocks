# Public V1 catalog

`candidates.json` is reviewed curator input. `manifest.json` is its
deterministically sorted, validated, and digested release form. The generator
does not add rationale, sources, families, status, or allowlisted files.

Every source entry explicitly contains:

- `candidateId`, `displayName`, and stable GitHub `owner`/`repository`;
- optional `npmPackage`;
- primary and additional capability families;
- candidate-specific `rationale` and `selectionSources`;
- `expectedSourceTypes`, `status`, and `allowlistedFiles`; and
- stable `introducedAt`.

Selection sources must include a specific official GitHub README or
documentation path for the same repository. An npm package page may provide
additional classification support. A repository homepage alone is rejected.
Negative-control rationale must explain the adjacent capability rather than
claiming direct family coverage.

## Corrected catalog review

The independent-review pass examined all 150 entries for plausible stable
GitHub/npm identity, deliberate family and status, classification rationale,
specific official selection source, negative-control adjacency, and justified
file allowlist. It corrected `logform` from active to negative control because
the selected source describes record formatting rather than log production,
collection, or transport.

Bounded live diagnostics then established these curator corrections before the
reviewed runs:

- mark `casbin/casbin`, `casbin/casbin.js`, and `casbin/node-casbin` as moved
  while preserving those stable catalog identities and allowing their current
  Apache canonical locations to remain evidence;
- correct `ladjs/koa-roles` to `koajs/koa-roles`;
- correct `dodopayments/dodopayments-node` to
  `dodopayments/dodopayments-typescript`;
- replace the nonexistent `hookdeck/hookdeck` entry with the relevant
  `hookdeck/outpost` project;
- correct the Octokit repository/package aliases to
  `octokit/webhooks-methods.js` and `@octokit/webhooks-methods`;
- correct the PayPal repository alias to
  `paypal/PayPal-TypeScript-Server-SDK`; and
- remove the optional Clerk npm mapping because its current full packument
  exceeds the reviewed 16 MiB body bound; the official Clerk repository README
  remains sufficient negative-control classification evidence.

No primary-family assignment changed. The two reviewed full live runs completed
on 2026-07-29 with all 150 candidates producing snapshots. Their bounded
outcomes, provider counts, exact receipt digests, and single reviewed
between-run source change are recorded in
[`live-completion.md`](live-completion.md). This establishes provider-current
accuracy only for the collection times recorded there; it is not a continuing
freshness claim.

The review retained zero additional-family assignments. That is a deliberate
V1 conclusion: none was strong enough to add without broadening a repository's
primary project role into incidental functionality.

Final deterministic distribution:

| Dimension               | Count |
| ----------------------- | ----: |
| repositories            |   150 |
| authorization primary   |    30 |
| audit-logging primary   |    30 |
| background-jobs primary |    30 |
| rate-limiting primary   |    30 |
| webhooks primary        |    30 |
| npm-backed              |    80 |
| repository-only         |    70 |
| active                  |    99 |
| archived                |     3 |
| moved                   |     4 |
| negative control        |    44 |
| multi-family            |     0 |

The reviewed source policy has four deliberate combinations:

- non-negative npm-backed candidates request release, license, exact-commit
  `package.json`, npm packument, and reviewed advisories;
- non-negative repository-only candidates request release, tag, license, and
  community profile;
- npm-backed negative controls request npm and reviewed advisories to establish
  the adjacent package identity; and
- repository-only negative controls request only universal repository
  identity/head.

This gives 99 entries with no file and 51 with an exact-commit `package.json`
allowlist. Declaration counts are 150 repository, 106 release, 55 tag, 106
license, 55 community, 51 file, 80 npm, and 80 advisory. The highest
per-candidate logical request budget in this manifest is eight; the
schema/runtime hard maximum remains 12.

The generated manifest digest is
`4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634`.
The catalog release time is release metadata; each candidate's
`introducedAt` controls immutable candidate creation time.

Run `pnpm catalog:validate` after any source edit. A live run may establish a
bad alias, package mapping, moved location, provider incompatibility, or other
current-source correction. Such a finding must be corrected in
`candidates.json`, deterministically revalidated, and reviewed from a clean
ephemeral database; receipt values are never edited.

## Proposed Phase 6 artifact selections

`artifact-selections.json` is the review-focused curator source for additional
official documents. `artifact-manifest.json` is the closed, deterministically
generated `public-artifacts-v1` authority. It binds to the exact catalog
version and digest, adds one optional provider-discovered root README attempt
for every candidate, and contains the proposed explicit paths.

The current proposal contains 30 additional-path candidates: exactly 6 from
each primary capability family. Its 180 total selections comprise 150 optional
root READMEs and 30 required proposed paths. Artifact-kind counts are 150
`readme` and 30 `documentation`. Every additional rationale names the adoption
question the document helps answer. The cohort uses architecture, deployment,
configuration, integration, protocol, compatibility, operational-pattern, and
production-guidance documents rather than security, contribution, or changelog
files to satisfy the count.

The additional paths and rationales were approved as the live-proof inputs in
draft PR #16. Exact current paths and adoption relevance were checked with
bounded GitHub search/path metadata and limited leading excerpts only; no
candidate body is committed. The completed controlled proof is recorded in
[`artifact-completion.md`](artifact-completion.md).

The current generated artifact-manifest digest is
`17d2a47f8d992275c95d55434bfc24776fb8ac51fc626e7610502f687bf3d02c`.

Run `pnpm artifacts:validate` after either artifact file changes. The command
regenerates the authority in memory, validates catalog binding, selection IDs,
root coverage, safe paths, ordering, family coverage, and the manifest digest,
then compares it with the committed manifest.
