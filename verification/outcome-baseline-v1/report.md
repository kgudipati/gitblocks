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
| recommend              |     2 |
| failed                 |    10 |

## Outcome counts by capability family

| Capability family | clarification-required | unsupported | insufficient-evidence | no-viable-candidate | recommend | failed |
| ----------------- | ---------------------: | ----------: | --------------------: | ------------------: | --------: | -----: |
| authorization     |                      0 |           0 |                     0 |                   0 |         0 |      3 |
| audit-logging     |                      0 |           0 |                     2 |                   0 |         0 |      1 |
| background-jobs   |                      0 |           0 |                     1 |                   0 |         1 |      1 |
| rate-limiting     |                      0 |           0 |                     0 |                   0 |         1 |      2 |
| webhooks          |                      0 |           0 |                     0 |                   0 |         0 |      3 |

## Non-recommend outcomes

| Fixture                                      | Outcome               | Producing stage                     | Reason                               |
| -------------------------------------------- | --------------------- | ----------------------------------- | ------------------------------------ |
| authorization-next-vercel-drizzle            | failed                | deterministic assessment validation | invalid-target-fit-response          |
| authorization-express-container-prisma-redis | failed                | deterministic assessment validation | invalid-target-fit-response          |
| authorization-next-selfhosted-drizzle        | failed                | deterministic assessment validation | invalid-target-fit-response          |
| audit-logging-next-vercel-drizzle            | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| audit-logging-express-container-prisma-redis | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| audit-logging-next-selfhosted-drizzle        | failed                | deterministic assessment validation | invalid-target-fit-response          |
| background-jobs-next-vercel-drizzle          | failed                | deterministic assessment validation | invalid-target-fit-response          |
| background-jobs-next-selfhosted-drizzle      | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| rate-limiting-next-vercel-drizzle            | failed                | deterministic assessment validation | invalid-target-fit-response          |
| rate-limiting-next-selfhosted-drizzle        | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-next-vercel-drizzle                 | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-express-container-prisma-redis      | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-next-selfhosted-drizzle             | failed                | deterministic assessment validation | invalid-target-fit-response          |

## Insufficient-evidence detail

| Fixture                                      | Unresolved hard evaluations per finalist | Artifact excerpt available per finalist |
| -------------------------------------------- | ---------------------------------------- | --------------------------------------- |
| audit-logging-next-vercel-drizzle            | [3, 3, 3, 3, 3]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-express-container-prisma-redis | [2, 2, 2, 2, 2]                          | [yes, yes, yes, yes, yes]               |
| background-jobs-next-selfhosted-drizzle      | [5, 5, 5, 5, 5]                          | [yes, yes, yes, yes, yes]               |

## Recommend detail

| Fixture                                        | Options returned | Eligible-lane options | Evidence-needed-lane options | Options with unverified constraints |
| ---------------------------------------------- | ---------------: | --------------------: | ---------------------------: | ----------------------------------: |
| background-jobs-express-container-prisma-redis |                3 |                     0 |                            3 |                                   1 |
| rate-limiting-express-container-prisma-redis   |                3 |                     0 |                            3 |                                   0 |

### Recommended option detail

| Fixture                                        | Candidate ID                    | Lane            | Verification       | Unverified constraints | Evidence references                                                                                                                                                                                                                              | Material unknowns                                                                                                                          | Disposition |
| ---------------------------------------------- | ------------------------------- | --------------- | ------------------ | ---------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| background-jobs-express-container-prisma-redis | jobs-agenda                     | evidence-needed | fully-verified     |                      0 | [artifact-evidence-56554adc9e54719c94ff48de3f5fa8ca9005b9ba, artifact-evidence-312be5ce4f6724e6dba8e0eef207b994af4a1e18, artifact-evidence-e35b1a3d47dce5e5a6c31eb5175f29f1befcd3c0, artifact-evidence-94e397c1e6fed20a15c05248e890fa296f1dd79c] | [unk-0f8136d8717b3287c0195c352a46721ff7f7cd07, unk-7700d72b80e5aaf508c036b9d85e22dba9fa5390, unk-7c270317506bc956f2a2daf3ccee17d9de2e13d4] | recommended |
| background-jobs-express-container-prisma-redis | jobs-rq                         | evidence-needed | fully-verified     |                      0 | [artifact-evidence-e94f2ecd5662420a9bee767afa09ea7a9365db23, artifact-evidence-3d669caa8c14f65cf4de8edbb94d2ab402d79c2c, artifact-evidence-43a17273a70e61df6f92d0452c3064762ba72a46]                                                             | [unk-25f30a40001317564a36ad58c8cda2273e5057a3, unk-33cc2dd7d751f669e03211140b442b257c279bdc, unk-8ce86174d4bc7e14b1c3c1abcf9f4f9a195bfdf4] | recommended |
| background-jobs-express-container-prisma-redis | jobs-bree                       | evidence-needed | partially-verified |                      1 | [artifact-evidence-c981050c32de4e0bc08fff7f985b0e07ef4a4dfb, artifact-evidence-d9178273e14ce0c3bd96f0cb5ae72d865902f734]                                                                                                                         | [unk-5002e38b69ff11c75392653a5384284d95c8b345, unk-85bd3430c4f04125f65a10e6d1570ed478229460]                                               | viable      |
| rate-limiting-express-container-prisma-redis   | rate-express-rate-limit         | evidence-needed | fully-verified     |                      0 | [artifact-evidence-8225fbdbff1a96c6fd1dfe53f996c16e53b0ec58, artifact-evidence-7f0fea9b28d7b7c49911ef9f599f00d0a3fb0f49]                                                                                                                         | [unk-3d0730e2ddf93e3e19f20577d5a6df110ce21c15, unk-70b920f4c31daf52dca790a9d2ee57d5e054c96c, unk-dec77c637d38d3a39f1e4956987e056e3396f2f4] | viable      |
| rate-limiting-express-container-prisma-redis   | rate-node-rate-limiter-flexible | evidence-needed | fully-verified     |                      0 | [artifact-evidence-d9b1814493df46d026dba46c52faaa09fd475cbf, artifact-evidence-1d9adfe7b9658aa646d4f4fa3765d56f9fd0481f]                                                                                                                         | [unk-2035010a2e3a3c0a71f1f22a3777e36467908e02, unk-99493d5e13f3af0e2719524aafafe3e0368f118c, unk-a032f5e645a9e2a2168b4eb254e9f8897fd21ce1] | viable      |
| rate-limiting-express-container-prisma-redis   | rate-fastify-rate-limit         | evidence-needed | fully-verified     |                      0 | [artifact-evidence-5f3e183b5a6498a5891ed8368e61163754f003b6, artifact-evidence-0550fa0163cd72ff7a0bc94b7b98119054f64cef]                                                                                                                         | [unk-0921899a79a2427f2f10c448f1b4595167572a34, unk-3d6fffbed6a047cfcc6ceeab14d452cbb70b0e99, unk-d25669dacb89d8d8ba9303e03bda9e7a1e84bf63] | viable      |

## Model calls

Total model calls made: 15.

Completed model calls: 15.

Deterministically valid responses: 5.

Median completed-call latency: 11621.0 ms.

Maximum completed-call latency: 16851.9 ms.

Median output tokens: 2364.0.

## Assessment diagnostics

Model responses captured for diagnostics: 15 of 15 fixtures.

Harness canonical validations passed: 5.

Diagnostic capture failures: 0.

Unknown totals include supplied candidate unknowns plus model-declared assessment unknowns; limitation totals are the supplied candidate limitation catalog hydrated by validation.

### Domain issue categories

| Category                                   | Calls | Occurrences |
| ------------------------------------------ | ----: | ----------: |
| domain.constraint.preservation             |     2 |           2 |
| domain.disposition.support                 |     2 |           2 |
| domain.exchange.constraint-reference       |     1 |           1 |
| domain.hard-resolution.inference-grounding |     4 |          14 |
| domain.outcome.disposition                 |     2 |           2 |
| domain.reference.candidate-ownership       |     1 |           2 |
| domain.reference.candidate-set             |     1 |           1 |
| domain.reference.catalog-coverage          |     4 |           6 |

### Disposition totals

| Disposition           | Count |
| --------------------- | ----: |
| recommended           |    12 |
| viable                |    20 |
| rejected              |     8 |
| insufficient-evidence |    34 |

### Hard-resolution state totals

| State      | Count |
| ---------- | ----: |
| satisfied  |    63 |
| conflict   |    11 |
| unresolved |   136 |

### Declared catalog totals

| Catalog     | Count |
| ----------- | ----: |
| inferences  |    85 |
| claims      |    48 |
| unknowns    |   243 |
| limitations |     9 |
| conflicts   |    11 |

Fixtures with any satisfied hard resolution: 12.

Candidates with any satisfied hard resolution: 47.

Fixtures with a rejected disposition on a declared conflict: 3.

Candidates with a rejected disposition on a declared conflict: 8.

### Per-fixture diagnostic totals

| Fixture                                        | Response | Validation | Domain issues | Dispositions                                                 | Resolutions                            | Catalogs                                                         | Any satisfied | Rejected conflict |
| ---------------------------------------------- | -------- | ---------- | ------------: | ------------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------- | ------------- | ----------------- |
| authorization-next-vercel-drizzle              | captured | failed     |             1 | recommended=0, viable=5, rejected=0, insufficient-evidence=0 | satisfied=4, conflict=0, unresolved=6  | inferences=4, claims=4, unknowns=16, limitations=3, conflicts=0  | yes           | no                |
| authorization-express-container-prisma-redis   | captured | failed     |             3 | recommended=3, viable=0, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=2  | inferences=5, claims=5, unknowns=12, limitations=3, conflicts=0  | yes           | no                |
| authorization-next-selfhosted-drizzle          | captured | failed     |             4 | recommended=1, viable=3, rejected=0, insufficient-evidence=0 | satisfied=5, conflict=0, unresolved=15 | inferences=5, claims=4, unknowns=11, limitations=3, conflicts=0  | yes           | no                |
| audit-logging-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=15 | inferences=5, claims=5, unknowns=18, limitations=0, conflicts=0  | no            | no                |
| audit-logging-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10 | inferences=5, claims=5, unknowns=17, limitations=0, conflicts=0  | no            | no                |
| audit-logging-next-selfhosted-drizzle          | captured | failed     |             6 | recommended=1, viable=0, rejected=0, insufficient-evidence=4 | satisfied=6, conflict=0, unresolved=19 | inferences=5, claims=1, unknowns=15, limitations=0, conflicts=0  | yes           | no                |
| background-jobs-next-vercel-drizzle            | captured | failed     |             1 | recommended=1, viable=0, rejected=3, insufficient-evidence=1 | satisfied=7, conflict=5, unresolved=3  | inferences=12, claims=4, unknowns=14, limitations=0, conflicts=5 | yes           | yes               |
| background-jobs-express-container-prisma-redis | captured | passed     |             0 | recommended=2, viable=2, rejected=0, insufficient-evidence=1 | satisfied=6, conflict=0, unresolved=4  | inferences=6, claims=6, unknowns=13, limitations=0, conflicts=0  | yes           | no                |
| background-jobs-next-selfhosted-drizzle        | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25 | inferences=5, claims=0, unknowns=19, limitations=0, conflicts=0  | no            | no                |
| rate-limiting-next-vercel-drizzle              | captured | failed     |             3 | recommended=1, viable=2, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=2  | inferences=4, claims=3, unknowns=15, limitations=0, conflicts=0  | yes           | no                |
| rate-limiting-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=3, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=2  | inferences=3, claims=3, unknowns=15, limitations=0, conflicts=0  | yes           | no                |
| rate-limiting-next-selfhosted-drizzle          | captured | failed     |             2 | recommended=0, viable=3, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=12 | inferences=3, claims=3, unknowns=18, limitations=0, conflicts=0  | yes           | no                |
| webhooks-next-vercel-drizzle                   | captured | failed     |             5 | recommended=0, viable=0, rejected=3, insufficient-evidence=2 | satisfied=7, conflict=3, unresolved=5  | inferences=6, claims=0, unknowns=25, limitations=0, conflicts=3  | yes           | yes               |
| webhooks-express-container-prisma-redis        | captured | failed     |             2 | recommended=3, viable=2, rejected=0, insufficient-evidence=0 | satisfied=9, conflict=0, unresolved=1  | inferences=10, claims=5, unknowns=15, limitations=0, conflicts=0 | yes           | no                |
| webhooks-next-selfhosted-drizzle               | captured | failed     |             3 | recommended=0, viable=0, rejected=2, insufficient-evidence=3 | satisfied=7, conflict=3, unresolved=15 | inferences=7, claims=0, unknowns=20, limitations=0, conflicts=3  | yes           | yes               |

## Failure categories

| Category                    | Calls | Occurrences |
| --------------------------- | ----: | ----------: |
| invalid-target-fit-response |    10 |          10 |
