# Outcome baseline v1

Reproduce from the repository root with `pnpm outcome:baseline:v1`.

This report contains no request prose, candidate display names, or model output text.

## Aggregate outcome counts

| Outcome                | Count |
| ---------------------- | ----: |
| clarification-required |     0 |
| unsupported            |     0 |
| insufficient-evidence  |     5 |
| no-viable-candidate    |     0 |
| recommend              |     1 |
| failed                 |     9 |

## Outcome counts by capability family

| Capability family | clarification-required | unsupported | insufficient-evidence | no-viable-candidate | recommend | failed |
| ----------------- | ---------------------: | ----------: | --------------------: | ------------------: | --------: | -----: |
| authorization     |                      0 |           0 |                     2 |                   0 |         0 |      1 |
| audit-logging     |                      0 |           0 |                     1 |                   0 |         0 |      2 |
| background-jobs   |                      0 |           0 |                     1 |                   0 |         0 |      2 |
| rate-limiting     |                      0 |           0 |                     1 |                   0 |         0 |      2 |
| webhooks          |                      0 |           0 |                     0 |                   0 |         1 |      2 |

## Non-recommend outcomes

| Fixture                                        | Outcome               | Producing stage                     | Reason                               |
| ---------------------------------------------- | --------------------- | ----------------------------------- | ------------------------------------ |
| authorization-next-vercel-drizzle              | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| authorization-express-container-prisma-redis   | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| authorization-next-selfhosted-drizzle          | failed                | deterministic assessment validation | invalid-target-fit-response          |
| audit-logging-next-vercel-drizzle              | failed                | deterministic assessment validation | invalid-target-fit-response          |
| audit-logging-express-container-prisma-redis   | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| audit-logging-next-selfhosted-drizzle          | failed                | deterministic assessment validation | invalid-target-fit-response          |
| background-jobs-next-vercel-drizzle            | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| background-jobs-express-container-prisma-redis | failed                | deterministic assessment validation | invalid-target-fit-response          |
| background-jobs-next-selfhosted-drizzle        | failed                | deterministic assessment validation | invalid-target-fit-response          |
| rate-limiting-next-vercel-drizzle              | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| rate-limiting-express-container-prisma-redis   | failed                | deterministic assessment validation | invalid-target-fit-response          |
| rate-limiting-next-selfhosted-drizzle          | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-next-vercel-drizzle                   | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-next-selfhosted-drizzle               | failed                | deterministic assessment validation | invalid-target-fit-response          |

## Insufficient-evidence detail

| Fixture                                      | Unresolved hard evaluations per finalist | Artifact excerpt available per finalist |
| -------------------------------------------- | ---------------------------------------- | --------------------------------------- |
| authorization-next-vercel-drizzle            | [2, 2, 2, 2, 2]                          | [yes, yes, yes, yes, yes]               |
| authorization-express-container-prisma-redis | [1, 1, 1, 1, 1]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-express-container-prisma-redis | [2, 2, 2, 2, 2]                          | [yes, yes, yes, yes, yes]               |
| background-jobs-next-vercel-drizzle          | [3, 3, 3, 3, 3]                          | [yes, yes, yes, yes, yes]               |
| rate-limiting-next-vercel-drizzle            | [2, 2, 2, 2, 2]                          | [yes, yes, yes, yes, yes]               |

## Recommend detail

| Fixture                                 | Options returned | Eligible-lane options | Evidence-needed-lane options |
| --------------------------------------- | ---------------: | --------------------: | ---------------------------: |
| webhooks-express-container-prisma-redis |                3 |                     0 |                            3 |

### Recommended option detail

| Fixture                                 | Candidate ID   | Lane            | Evidence references                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Material unknowns                                                                                                                          | Disposition |
| --------------------------------------- | -------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| webhooks-express-container-prisma-redis | webhook-svix   | evidence-needed | [artifact-evidence-4e97f0e405f925595fd96f7c2201c78a7014d5ff, artifact-evidence-d5e2cd094b67c01dd3c19b54e89f31d60751abda, ev-40f7f3a9aad23b56dbc916d0dea2a4aa7932c9bb, ev-85d64df09a6ec2dce77e907b90a4153617f9e401, ev-9237da6f72587f452ebb6098ac65121d3e963b56, ev-98fa0db5c969ba6d7d12086f179781967955b02a, ev-ab59e6eb768030cb736bfad29e6afe96383c1e3c, ev-b68aeb2016cfb51f950e36471c8b851ebf00ef66, ev-f9733c5903d9c63f000e5afd9a2601639db53ee6]                                                                                                                                                                                     | [unk-0e1facb3b0e86d42fae0d27d5e84eec2051011b7, unk-29e401713ae6847d6d0f75e710483325781ca7df, unk-88ed064aeaaa32dffb33cb8f026a5f6889c0d854] | recommended |
| webhooks-express-container-prisma-redis | webhook-adnanh | evidence-needed | [artifact-evidence-9f1184779a8966ef4f99d85ccd16cf71cdc4ec13, artifact-evidence-204191e0bf025ba7210d1d52af8d63b1bd4c2217, ev-18f9ac2787ee82ed2824752a45a7a9c6bd317067, ev-1ffe9100cee276a5c2ccd82f1da1d0aa7c4a27b5, ev-54bb56e73c9880417743675c9dfd134b8f0dd0d8, ev-5a2d38b75a602f9d809ac71f95d1b6fc63bc220e, ev-82984d49fa59c3c98c238bca0a356c6491aa8113, ev-91df696e7dbe15a61f03a414e518fcb4dead9c77, ev-9c1079f896ea3e80a93050cc4c2a85204df000fe, ev-c917826a0ccd22ea691329afdb9c16927016c90f, ev-e6b234386e388263a5b6fbb2690791b01572090a, ev-ebc6364760e58d938d8d6ae81a7a351362879f3a, ev-f9b2e3c8fe42fa85602c9d6a47e3175e6466a636] | [unk-5537a25a75980ae8b6cf91744c32b1e6fd3807b0, unk-9bab042fcdc928b2ed1f19129bf6c355d6693c62]                                               | recommended |
| webhooks-express-container-prisma-redis | webhook-convoy | evidence-needed | [artifact-evidence-e95d565d576eb53ac7c800ee5bba36337f489ddb, artifact-evidence-7b9865928d453ccbb28dd08948052bd5f12ad372, ev-246515d0a5d831f2351c0981d01bf7dc5560afc3, ev-28c78d2f986944dd7266d2f200b10a4f0edab26e, ev-31ec254136d7ae74b64e3f4ee2ac793535079345, ev-3ca9ffbe03a151a8d77f42f779c792e6a5f249d1, ev-3ec9df020ccb86607a117c4b7a38b98a87ba5110, ev-7a168afc5a74519b1cec5457ffb4db856c45375e, ev-abd894c92b0b813a2a9fcba49ff54d366ffc04fd, ev-b2821d230ae77aa1f5d627ea4a85e9bc0fb49440, ev-cce08257f2c11e6ed7d1a390bbba8cc4a90f7921, ev-e03879fbbfe3a4c2411100b702a77e1d76e4ae29]                                              | [unk-11ef41c15bd72c4304a1b60dbc40bb1c21b97a04, unk-1860e59277efd2c280ed9bc6f3d762d7afb619d3, unk-502ad60d7a9325db0bfaf8ebd107266c1078362f] | viable      |

## Model calls

Total model calls made: 15.

Completed model calls: 15.

Deterministically valid responses: 6.

Median completed-call latency: 11353.5 ms.

Maximum completed-call latency: 22392.3 ms.

Median output tokens: 2247.0.

## Assessment diagnostics

Model responses captured for diagnostics: 15 of 15 fixtures.

Harness canonical validations passed: 6.

Diagnostic capture failures: 0.

Unknown totals include supplied candidate unknowns plus model-declared assessment unknowns; limitation totals are the supplied candidate limitation catalog hydrated by validation.

### Domain issue categories

| Category                                    | Calls | Occurrences |
| ------------------------------------------- | ----: | ----------: |
| domain.constraint.preservation              |     3 |           3 |
| domain.hard-resolution.conflict-binding     |     1 |           1 |
| domain.hard-resolution.conflict-disposition |     1 |           1 |
| domain.hard-resolution.inference-grounding  |     2 |          13 |
| domain.outcome.disposition                  |     2 |           2 |
| domain.reference.catalog-coverage           |     4 |           4 |

### Disposition totals

| Disposition           | Count |
| --------------------- | ----: |
| recommended           |     5 |
| viable                |     8 |
| rejected              |     4 |
| insufficient-evidence |    58 |

### Hard-resolution state totals

| State      | Count |
| ---------- | ----: |
| satisfied  |    58 |
| conflict   |     5 |
| unresolved |   157 |

### Declared catalog totals

| Catalog     | Count |
| ----------- | ----: |
| inferences  |    87 |
| claims      |    28 |
| unknowns    |   238 |
| limitations |     9 |
| conflicts   |     5 |

Fixtures with any satisfied hard resolution: 6.

Candidates with any satisfied hard resolution: 26.

Fixtures with a rejected disposition on a declared conflict: 3.

Candidates with a rejected disposition on a declared conflict: 4.

### Per-fixture diagnostic totals

| Fixture                                        | Response | Validation | Domain issues | Dispositions                                                 | Resolutions                            | Catalogs                                                         | Any satisfied | Rejected conflict |
| ---------------------------------------------- | -------- | ---------- | ------------: | ------------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------- | ------------- | ----------------- |
| authorization-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10 | inferences=0, claims=0, unknowns=13, limitations=3, conflicts=0  | no            | no                |
| authorization-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=5  | inferences=5, claims=0, unknowns=12, limitations=3, conflicts=0  | no            | no                |
| authorization-next-selfhosted-drizzle          | captured | failed     |             1 | recommended=1, viable=2, rejected=0, insufficient-evidence=2 | satisfied=20, conflict=0, unresolved=0 | inferences=20, claims=9, unknowns=11, limitations=3, conflicts=0 | yes           | no                |
| audit-logging-next-vercel-drizzle              | captured | failed     |            11 | recommended=0, viable=3, rejected=0, insufficient-evidence=2 | satisfied=11, conflict=0, unresolved=4 | inferences=9, claims=4, unknowns=20, limitations=0, conflicts=0  | yes           | no                |
| audit-logging-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10 | inferences=5, claims=0, unknowns=17, limitations=0, conflicts=0  | no            | no                |
| audit-logging-next-selfhosted-drizzle          | captured | failed     |             1 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25 | inferences=5, claims=0, unknowns=15, limitations=0, conflicts=0  | no            | no                |
| background-jobs-next-vercel-drizzle            | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=15 | inferences=0, claims=0, unknowns=18, limitations=0, conflicts=0  | no            | no                |
| background-jobs-express-container-prisma-redis | captured | failed     |             1 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10 | inferences=0, claims=0, unknowns=13, limitations=0, conflicts=0  | no            | no                |
| background-jobs-next-selfhosted-drizzle        | captured | failed     |             1 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25 | inferences=0, claims=0, unknowns=14, limitations=0, conflicts=0  | no            | no                |
| rate-limiting-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10 | inferences=5, claims=0, unknowns=17, limitations=0, conflicts=0  | no            | no                |
| rate-limiting-express-container-prisma-redis   | captured | failed     |             4 | recommended=2, viable=0, rejected=0, insufficient-evidence=3 | satisfied=2, conflict=1, unresolved=2  | inferences=5, claims=2, unknowns=17, limitations=0, conflicts=0  | yes           | no                |
| rate-limiting-next-selfhosted-drizzle          | captured | failed     |             1 | recommended=0, viable=0, rejected=1, insufficient-evidence=4 | satisfied=0, conflict=0, unresolved=20 | inferences=4, claims=0, unknowns=16, limitations=0, conflicts=1  | no            | yes               |
| webhooks-next-vercel-drizzle                   | captured | failed     |             2 | recommended=0, viable=0, rejected=2, insufficient-evidence=3 | satisfied=7, conflict=2, unresolved=6  | inferences=13, claims=4, unknowns=17, limitations=0, conflicts=2 | yes           | yes               |
| webhooks-express-container-prisma-redis        | captured | passed     |             0 | recommended=2, viable=3, rejected=0, insufficient-evidence=0 | satisfied=10, conflict=0, unresolved=0 | inferences=10, claims=7, unknowns=23, limitations=0, conflicts=0 | yes           | no                |
| webhooks-next-selfhosted-drizzle               | captured | failed     |             2 | recommended=0, viable=0, rejected=1, insufficient-evidence=4 | satisfied=8, conflict=2, unresolved=15 | inferences=6, claims=2, unknowns=15, limitations=0, conflicts=2  | yes           | yes               |

## Failure categories

| Category                    | Calls | Occurrences |
| --------------------------- | ----: | ----------: |
| invalid-target-fit-response |     9 |           9 |
