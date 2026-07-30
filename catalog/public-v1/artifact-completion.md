# Phase 6 public artifact completion

This content-free evidence records the controlled live proof for
[Issue #15](https://github.com/kgudipati/gitblocks/issues/15) on draft PR #16.
The proof started from authorized branch head
`75386f9c761979e7bf1a8d638234b2be099eb17e`.

## Runtime and authority

| Property                      | Verified value                                                     |
| ----------------------------- | ------------------------------------------------------------------ |
| Node.js                       | `24.18.0`                                                          |
| pnpm                          | `11.17.0`                                                          |
| PostgreSQL                    | `18.4`                                                             |
| Applied migrations            | 3, through `0003_immutable_repository_artifacts.sql`               |
| Product tables / RLS policies | 17 / 0                                                             |
| Catalog version               | `public-v1`                                                        |
| Catalog digest                | `4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634` |
| Artifact manifest version     | `public-artifacts-v1`                                              |
| Artifact manifest digest      | `17d2a47f8d992275c95d55434bfc24776fb8ac51fc626e7610502f687bf3d02c` |
| Collector / chunker           | `repository-artifacts-v1` / `exact-lines-v1`                       |

The database was a new localhost-only ephemeral test database. Migrations used
the owner login. Phase 5 seeding and both artifact runs used a non-owner,
non-superuser login inheriting only `gitblocks_persistence`; it had no database
or role creation, replication, RLS-bypass, or superuser privilege.

## Receipt proof

| Bounded fact                                 |                                               Definitive first run |                                               Immediate comparison |
| -------------------------------------------- | -----------------------------------------------------------------: | -----------------------------------------------------------------: |
| Receipt digest                               | `f39bef34fd626cbd52a95ba494cc1915ee25d001eec0916879bb02c0cc37df21` | `eef96fa9e9b35020247068004876918830f470cc90cd1ecdef9132ca8f7d167e` |
| Raw receipt file SHA-256                     | `1bd27d986e461c442dfc7e3d97db254676aeec7a1d6497057565e47b5901cba5` | `d69afaa4e56b79edd2813d548f1e06749d8284757ebbfd82a3dc9a3c556d68b0` |
| Requested / completed / failed candidates    |                                                      150 / 150 / 0 |                                                      150 / 150 / 0 |
| Created / idempotent candidates              |                                                            150 / 0 |                                                            5 / 145 |
| Artifacts / chunks in the run                |                                                          180 / 407 |                                                          180 / 407 |
| Optional absence outcomes                    |                                                                  0 |                                                                  0 |
| Operational decoded bytes                    |                                                          5,450,444 |                                                          5,450,444 |
| Materialized artifact bytes                  |                                                          2,725,206 |                                                          2,725,206 |
| GitHub requests                              |                                                              1,183 |                                                              1,183 |
| Safe failure-code totals                     |                                                               none |                                                               none |
| Inserted artifacts / chunks / sets / entries |                                              180 / 407 / 150 / 180 |                                                      6 / 9 / 5 / 6 |

Across both runs, the operator decoded 10,900,888 bytes and made 2,366
serialized GitHub requests. The second receipt reports 145 identical artifact
sets, 145 identical materializations, 145 zero-new-row candidates, and 26 new
rows.

## Database closure and history

| Durable total                    | After first run | After comparison |
| -------------------------------- | --------------: | ---------------: |
| Repository artifacts             |             180 |              186 |
| Artifact chunks                  |             407 |              416 |
| Artifact sets                    |             150 |              155 |
| Artifact-set entries             |             180 |              186 |
| Present entries                  |             180 |              186 |
| Optional `not-found` entries     |               0 |                0 |
| Stored historical artifact bytes |       2,725,206 |        2,806,601 |

All 150 candidates had a closed set after the first run. Aggregate checks found
zero orphan artifacts, orphan chunks, cross-candidate references, incomplete
entry ordinals, incomplete chunk intervals, or reconstruction failures.
Historical verification after the comparison reconstructed all 186 artifacts
exactly.

The comparison appended immutable history for five repositories whose default
branches advanced between runs:

| Candidate          | First-run commit                           | Comparison commit                          |
| ------------------ | ------------------------------------------ | ------------------------------------------ |
| `jobs-airflow`     | `4f6186db09f40e026b68a0af77a6c2fd8e8f1343` | `84ac434aaa19d520f1c19f4321a3443f4b8f5737` |
| `jobs-kestra`      | `747f64209deb79dac4a79026da7a32241acd48b5` | `9be6a4118f495ef33fd9ca047baa262c25390e2a` |
| `jobs-n8n`         | `43831ebb3f67395a2b0d92f6af777d1236ddd3ba` | `c963e9bf3d62d2f8ff2864c47a17e6bebb2c5dfe` |
| `jobs-trigger-dev` | `6e5f0f0fe74fceb2f8462e7fd354790572d5f03c` | `86b948b47a14bb18f3fd7451926fe2a985ed29f9` |
| `rate-gravitee`    | `484a42492ea7d7662b234ea81f754817f322a6e4` | `8f07419375c9d093ebc758db36f2a27f27935554` |

Bounded Git commit-object traversal proved every comparison commit descends
from its first-run commit. A post-run ref check found `jobs-n8n` had advanced
again to `66763730d13adb1b1050ef0e9d4ebd48fd3f1bba`, whose direct parent is the
comparison commit. The other four comparison commits still matched their
current default-branch refs at verification time.

The original 180 artifact IDs, `collectedAt` values, and record digests retained
the same content-free aggregate fingerprint before and after the comparison:
`c8d4ace36b9eef160d0cf12337507893f702bc103e917164849b9011f72c35f5`.
The original 150 artifact-set IDs, `publishedAt` values, and record digests
likewise retained fingerprint
`b047c475315a466b19498b8f9cb1da2dcb8598a5309676cead91b036d542aa82`.

## Safety statement

Raw receipts remain untracked outside the repository. No artifact or chunk
body, symlink body, credential, provider payload, database state, unrestricted
telemetry, or temporary local path is committed. Candidate content was not
rendered, executed, sent to a model, or included in this evidence. Phase 7 did
not begin.
