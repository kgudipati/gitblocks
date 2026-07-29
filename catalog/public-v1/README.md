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
file allowlist. It made no candidate removal, replacement, alias, or primary
family correction. It corrected `logform` from active to negative control
because the selected source describes record formatting rather than log
production, collection, or transport. Provider-current accuracy remains
unclaimed until the required live run.

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
| npm-backed              |    81 |
| repository-only         |    69 |
| active                  |   102 |
| archived                |     3 |
| moved                   |     1 |
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
license, 55 community, 51 file, 81 npm, and 81 advisory. The highest
per-candidate logical request budget in this manifest is eight; the
schema/runtime hard maximum remains 12.

The generated manifest digest is
`371df1d677284466f7b29f3aaef0b15641e09cf3792a3badc64c45004161dfb7`.
The catalog release time is release metadata; each candidate's
`introducedAt` controls immutable candidate creation time.

Run `pnpm catalog:validate` after any source edit. A live run may establish a
bad alias, package mapping, moved location, provider incompatibility, or other
current-source correction. Such a finding must be corrected in
`candidates.json`, deterministically revalidated, and reviewed from a clean
ephemeral database; receipt values are never edited.
