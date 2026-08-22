# Outcome baseline v1

Reproduce from the repository root with `pnpm outcome:baseline:v1`.

This report contains no request prose, candidate display names, or model output text.

## Aggregate outcome counts

| Outcome                | Count |
| ---------------------- | ----: |
| clarification-required |     0 |
| unsupported            |     0 |
| insufficient-evidence  |     3 |
| no-viable-candidate    |     0 |
| recommend              |     3 |
| failed                 |     9 |

## Outcome counts by capability family

| Capability family | clarification-required | unsupported | insufficient-evidence | no-viable-candidate | recommend | failed |
| ----------------- | ---------------------: | ----------: | --------------------: | ------------------: | --------: | -----: |
| authorization     |                      0 |           0 |                     1 |                   0 |         0 |      2 |
| audit-logging     |                      0 |           0 |                     2 |                   0 |         0 |      1 |
| background-jobs   |                      0 |           0 |                     0 |                   0 |         1 |      2 |
| rate-limiting     |                      0 |           0 |                     0 |                   0 |         2 |      1 |
| webhooks          |                      0 |           0 |                     0 |                   0 |         0 |      3 |

## Non-recommend outcomes

| Fixture                                        | Outcome               | Producing stage                     | Reason                               |
| ---------------------------------------------- | --------------------- | ----------------------------------- | ------------------------------------ |
| authorization-next-vercel-drizzle              | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| authorization-express-container-prisma-redis   | failed                | deterministic assessment validation | invalid-target-fit-response          |
| authorization-next-selfhosted-drizzle          | failed                | deterministic assessment validation | invalid-target-fit-response          |
| audit-logging-next-vercel-drizzle              | failed                | deterministic assessment validation | invalid-target-fit-response          |
| audit-logging-express-container-prisma-redis   | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| audit-logging-next-selfhosted-drizzle          | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| background-jobs-express-container-prisma-redis | failed                | deterministic assessment validation | invalid-target-fit-response          |
| background-jobs-next-selfhosted-drizzle        | failed                | deterministic assessment validation | invalid-target-fit-response          |
| rate-limiting-next-selfhosted-drizzle          | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-next-vercel-drizzle                   | failed                | model invocation                    | fit-model-failed                     |
| webhooks-express-container-prisma-redis        | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-next-selfhosted-drizzle               | failed                | deterministic assessment validation | invalid-target-fit-response          |

## Insufficient-evidence detail

| Fixture                                      | Unresolved hard evaluations per finalist | Artifact excerpt available per finalist |
| -------------------------------------------- | ---------------------------------------- | --------------------------------------- |
| authorization-next-vercel-drizzle            | [1, 1, 1, 1, 1]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-express-container-prisma-redis | [2, 2, 2, 2, 2]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-next-selfhosted-drizzle        | [5, 5, 5, 5, 5]                          | [yes, yes, yes, yes, yes]               |

## Recommend detail

| Fixture                                      | Options returned | Eligible-lane options | Evidence-needed-lane options | Options with unverified constraints |
| -------------------------------------------- | ---------------: | --------------------: | ---------------------------: | ----------------------------------: |
| background-jobs-next-vercel-drizzle          |                2 |                     0 |                            2 |                                   2 |
| rate-limiting-next-vercel-drizzle            |                3 |                     0 |                            3 |                                   3 |
| rate-limiting-express-container-prisma-redis |                1 |                     0 |                            1 |                                   0 |

### Recommended option detail

| Fixture                                      | Candidate ID                    | Lane            | Verification                     | Unverified constraints | Evidence references                                                                                                                                                                  | Material unknowns                                                                                                                                                                        | Disposition |
| -------------------------------------------- | ------------------------------- | --------------- | -------------------------------- | ---------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| background-jobs-next-vercel-drizzle          | jobs-graphile-worker            | evidence-needed | unverified-prohibited-constraint |                      3 | [ev-9e2f8e1356406b00504bd7544f9536282d5253a9, artifact-evidence-0d77f4567a3cce964d4a7fbb51c0d3c90eab4aa9, artifact-evidence-01393682d01840360b97b7172a7301a640d413d2]                | [unk-497a52f3e68301c67ddf4367aa906c3046bd538e, unk-75bf9d56c9bbaa7e40e08e15a77ab7851167c388, unk-763bb6beb7f0ccb41f04ef2cb8ebc5ed3f9edbe7, unk-e05da4e19a59a24627241990a15e7287d540d0c5] | viable      |
| background-jobs-next-vercel-drizzle          | jobs-bree                       | evidence-needed | unverified-prohibited-constraint |                      3 | [artifact-evidence-c981050c32de4e0bc08fff7f985b0e07ef4a4dfb, artifact-evidence-d9178273e14ce0c3bd96f0cb5ae72d865902f734, artifact-evidence-ea2c0738711d9471b749254bd0a1957013de9a3b] | [unk-5002e38b69ff11c75392653a5384284d95c8b345, unk-85bd3430c4f04125f65a10e6d1570ed478229460]                                                                                             | viable      |
| rate-limiting-next-vercel-drizzle            | rate-node-rate-limiter-flexible | evidence-needed | partially-verified               |                      1 | [ev-7ad2a98d02e2d3b3985452cfb0ba2cee08f891c2, artifact-evidence-d9b1814493df46d026dba46c52faaa09fd475cbf, artifact-evidence-1d9adfe7b9658aa646d4f4fa3765d56f9fd0481f]                | [unk-2035010a2e3a3c0a71f1f22a3777e36467908e02, unk-99493d5e13f3af0e2719524aafafe3e0368f118c, unk-a032f5e645a9e2a2168b4eb254e9f8897fd21ce1]                                               | recommended |
| rate-limiting-next-vercel-drizzle            | rate-express-rate-limit         | evidence-needed | partially-verified               |                      1 | [ev-8e72a255108bece4e257d4f773ea8b1d3beaffd3, artifact-evidence-8225fbdbff1a96c6fd1dfe53f996c16e53b0ec58, artifact-evidence-7f0fea9b28d7b7c49911ef9f599f00d0a3fb0f49]                | [unk-3d0730e2ddf93e3e19f20577d5a6df110ce21c15, unk-70b920f4c31daf52dca790a9d2ee57d5e054c96c, unk-dec77c637d38d3a39f1e4956987e056e3396f2f4]                                               | viable      |
| rate-limiting-next-vercel-drizzle            | rate-fastify-rate-limit         | evidence-needed | partially-verified               |                      1 | [ev-a58276612334cef70d447e4eef13b70d46a63cc4, artifact-evidence-5f3e183b5a6498a5891ed8368e61163754f003b6, artifact-evidence-0550fa0163cd72ff7a0bc94b7b98119054f64cef]                | [unk-0921899a79a2427f2f10c448f1b4595167572a34, unk-3d6fffbed6a047cfcc6ceeab14d452cbb70b0e99, unk-d25669dacb89d8d8ba9303e03bda9e7a1e84bf63]                                               | viable      |
| rate-limiting-express-container-prisma-redis | rate-node-rate-limiter-flexible | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-d9b1814493df46d026dba46c52faaa09fd475cbf, artifact-evidence-1d9adfe7b9658aa646d4f4fa3765d56f9fd0481f]                                                             | [unk-2035010a2e3a3c0a71f1f22a3777e36467908e02, unk-99493d5e13f3af0e2719524aafafe3e0368f118c, unk-a032f5e645a9e2a2168b4eb254e9f8897fd21ce1]                                               | recommended |

## Model calls

Total model calls made: 15.

Completed model calls: 14.

Deterministically valid responses: 6.

Median completed-call latency: 10814.2 ms.

Maximum completed-call latency: 19502.1 ms.

Median output tokens: 2421.5.

## Assessment diagnostics

Model responses captured for diagnostics: 14 of 15 fixtures.

Harness canonical validations passed: 6.

Diagnostic capture failures: 0.

Unknown totals include supplied candidate unknowns plus model-declared assessment unknowns; limitation totals are the supplied candidate limitation catalog hydrated by validation.

### Domain issue categories

| Category                                   | Calls | Occurrences |
| ------------------------------------------ | ----: | ----------: |
| domain.claim.unresolved-unknown            |     2 |           2 |
| domain.constraint.preservation             |     1 |           1 |
| domain.disposition.support                 |     4 |           4 |
| domain.disposition.uncertainty             |     1 |           2 |
| domain.hard-resolution.inference-grounding |     1 |           1 |
| domain.reference.candidate-ownership       |     2 |           7 |
| domain.reference.candidate-set             |     1 |           1 |
| domain.reference.catalog-coverage          |     3 |           3 |
| domain.reference.duplicate-id              |     1 |           1 |

### Disposition totals

| Disposition           | Count |
| --------------------- | ----: |
| recommended           |    12 |
| viable                |    20 |
| rejected              |     1 |
| insufficient-evidence |    36 |

### Hard-resolution state totals

| State      | Count |
| ---------- | ----: |
| satisfied  |    45 |
| conflict   |     3 |
| unresolved |   147 |

### Declared catalog totals

| Catalog     | Count |
| ----------- | ----: |
| inferences  |    87 |
| claims      |    47 |
| unknowns    |   251 |
| limitations |     9 |
| conflicts   |     3 |

Fixtures with any satisfied hard resolution: 9.

Candidates with any satisfied hard resolution: 34.

Fixtures with a rejected disposition on a declared conflict: 1.

Candidates with a rejected disposition on a declared conflict: 1.

### Per-fixture diagnostic totals

| Fixture                                        | Response     | Validation | Domain issues | Dispositions                                                 | Resolutions                            | Catalogs                                                         | Any satisfied | Rejected conflict |
| ---------------------------------------------- | ------------ | ---------- | ------------: | ------------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------- | ------------- | ----------------- |
| authorization-next-vercel-drizzle              | captured     | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=5, conflict=0, unresolved=5  | inferences=5, claims=5, unknowns=16, limitations=3, conflicts=0  | yes           | no                |
| authorization-express-container-prisma-redis   | captured     | failed     |             1 | recommended=3, viable=0, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=2  | inferences=5, claims=0, unknowns=13, limitations=3, conflicts=0  | yes           | no                |
| authorization-next-selfhosted-drizzle          | captured     | failed     |             1 | recommended=0, viable=5, rejected=0, insufficient-evidence=0 | satisfied=5, conflict=0, unresolved=15 | inferences=5, claims=5, unknowns=16, limitations=3, conflicts=0  | yes           | no                |
| audit-logging-next-vercel-drizzle              | captured     | failed     |             1 | recommended=1, viable=3, rejected=0, insufficient-evidence=1 | satisfied=6, conflict=0, unresolved=9  | inferences=15, claims=5, unknowns=19, limitations=0, conflicts=0 | yes           | no                |
| audit-logging-express-container-prisma-redis   | captured     | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10 | inferences=5, claims=0, unknowns=17, limitations=0, conflicts=0  | no            | no                |
| audit-logging-next-selfhosted-drizzle          | captured     | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25 | inferences=5, claims=0, unknowns=18, limitations=0, conflicts=0  | no            | no                |
| background-jobs-next-vercel-drizzle            | captured     | passed     |             0 | recommended=0, viable=2, rejected=0, insufficient-evidence=3 | satisfied=0, conflict=0, unresolved=15 | inferences=4, claims=3, unknowns=13, limitations=0, conflicts=0  | no            | no                |
| background-jobs-express-container-prisma-redis | captured     | failed     |             4 | recommended=1, viable=2, rejected=0, insufficient-evidence=1 | satisfied=5, conflict=0, unresolved=5  | inferences=5, claims=2, unknowns=22, limitations=0, conflicts=0  | yes           | no                |
| background-jobs-next-selfhosted-drizzle        | captured     | failed     |             9 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25 | inferences=5, claims=5, unknowns=19, limitations=0, conflicts=0  | no            | no                |
| rate-limiting-next-vercel-drizzle              | captured     | passed     |             0 | recommended=1, viable=2, rejected=0, insufficient-evidence=2 | satisfied=0, conflict=0, unresolved=5  | inferences=4, claims=4, unknowns=14, limitations=0, conflicts=0  | no            | no                |
| rate-limiting-express-container-prisma-redis   | captured     | passed     |             0 | recommended=1, viable=0, rejected=0, insufficient-evidence=4 | satisfied=1, conflict=0, unresolved=4  | inferences=1, claims=1, unknowns=15, limitations=0, conflicts=0  | yes           | no                |
| rate-limiting-next-selfhosted-drizzle          | captured     | failed     |             4 | recommended=0, viable=2, rejected=0, insufficient-evidence=3 | satisfied=2, conflict=0, unresolved=13 | inferences=3, claims=2, unknowns=16, limitations=0, conflicts=0  | yes           | no                |
| webhooks-next-vercel-drizzle                   | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0  | inferences=0, claims=0, unknowns=15, limitations=0, conflicts=0  | no            | no                |
| webhooks-express-container-prisma-redis        | captured     | failed     |             1 | recommended=4, viable=1, rejected=0, insufficient-evidence=0 | satisfied=9, conflict=0, unresolved=1  | inferences=13, claims=9, unknowns=18, limitations=0, conflicts=0 | yes           | no                |
| webhooks-next-selfhosted-drizzle               | captured     | failed     |             1 | recommended=1, viable=3, rejected=1, insufficient-evidence=0 | satisfied=9, conflict=3, unresolved=13 | inferences=12, claims=6, unknowns=20, limitations=0, conflicts=3 | yes           | yes               |

## Failure categories

| Category                    | Calls | Occurrences |
| --------------------------- | ----: | ----------: |
| fit-model-failed            |     1 |           1 |
| invalid-target-fit-response |     8 |           8 |
