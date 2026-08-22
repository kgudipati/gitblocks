# Outcome baseline v1

Reproduce from the repository root with `pnpm outcome:baseline:v1`.

This report contains no request prose, candidate display names, or model output text.

## Aggregate outcome counts

| Outcome                | Count |
| ---------------------- | ----: |
| clarification-required |     0 |
| unsupported            |     0 |
| insufficient-evidence  |     1 |
| no-viable-candidate    |     0 |
| recommend              |     4 |
| failed                 |    10 |

## Outcome counts by capability family

| Capability family | clarification-required | unsupported | insufficient-evidence | no-viable-candidate | recommend | failed |
| ----------------- | ---------------------: | ----------: | --------------------: | ------------------: | --------: | -----: |
| authorization     |                      0 |           0 |                     0 |                   0 |         1 |      2 |
| audit-logging     |                      0 |           0 |                     0 |                   0 |         0 |      3 |
| background-jobs   |                      0 |           0 |                     1 |                   0 |         1 |      1 |
| rate-limiting     |                      0 |           0 |                     0 |                   0 |         2 |      1 |
| webhooks          |                      0 |           0 |                     0 |                   0 |         0 |      3 |

## Non-recommend outcomes

| Fixture                                      | Outcome               | Producing stage                     | Reason                               |
| -------------------------------------------- | --------------------- | ----------------------------------- | ------------------------------------ |
| authorization-express-container-prisma-redis | failed                | deterministic assessment validation | invalid-target-fit-response          |
| authorization-next-selfhosted-drizzle        | failed                | deterministic assessment validation | invalid-target-fit-response          |
| audit-logging-next-vercel-drizzle            | failed                | deterministic assessment validation | invalid-target-fit-response          |
| audit-logging-express-container-prisma-redis | failed                | deterministic assessment validation | invalid-target-fit-response          |
| audit-logging-next-selfhosted-drizzle        | failed                | deterministic assessment validation | invalid-target-fit-response          |
| background-jobs-next-vercel-drizzle          | failed                | deterministic assessment validation | invalid-target-fit-response          |
| background-jobs-next-selfhosted-drizzle      | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| rate-limiting-next-vercel-drizzle            | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-next-vercel-drizzle                 | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-express-container-prisma-redis      | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-next-selfhosted-drizzle             | failed                | deterministic assessment validation | invalid-target-fit-response          |

## Insufficient-evidence detail

| Fixture                                 | Unresolved hard evaluations per finalist | Artifact excerpt available per finalist |
| --------------------------------------- | ---------------------------------------- | --------------------------------------- |
| background-jobs-next-selfhosted-drizzle | [5, 5, 5, 5, 5]                          | [yes, yes, yes, yes, yes]               |

## Recommend detail

| Fixture                                        | Options returned | Eligible-lane options | Evidence-needed-lane options | Options with unverified constraints |
| ---------------------------------------------- | ---------------: | --------------------: | ---------------------------: | ----------------------------------: |
| authorization-next-vercel-drizzle              |                3 |                     0 |                            3 |                                   3 |
| background-jobs-express-container-prisma-redis |                3 |                     0 |                            3 |                                   1 |
| rate-limiting-express-container-prisma-redis   |                2 |                     0 |                            2 |                                   0 |
| rate-limiting-next-selfhosted-drizzle          |                3 |                     0 |                            3 |                                   0 |

### Recommended option detail

| Fixture                                        | Candidate ID                    | Lane            | Verification                     | Unverified constraints | Evidence references                                                                                                                                                                                                                              | Material unknowns                                                                                                                          | Disposition |
| ---------------------------------------------- | ------------------------------- | --------------- | -------------------------------- | ---------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| authorization-next-vercel-drizzle              | auth-casbin-node-casbin         | evidence-needed | unverified-prohibited-constraint |                      1 | [artifact-evidence-1043e012fa62346177938ea4b1f627ecff67b28e, artifact-evidence-37a5d83a039e2b54ce89d28ce0092a0c8362fea2, artifact-evidence-3a7c582175d3307927f9ce8d8af8dcac9e356e7f]                                                             | [unk-2d55a7fa4fbbd58b4817cc8749c5a5e3a7c91a06, unk-8538c6db70ce6362931c72431ccbfe42c9bf77f7, unk-a15707136190e56f81c748db2b60f9e00dc5000f] | viable      |
| authorization-next-vercel-drizzle              | auth-openfga                    | evidence-needed | unverified-prohibited-constraint |                      1 | [artifact-evidence-d04c535d86c32d571bca781c624f1df44581bddd, artifact-evidence-6d6d373a6dfeca08bb7ce4e948038172b89c4fda, artifact-evidence-a198452efd38edb31ee124991c6f2c46afc1991b, artifact-evidence-47efec7932f9a23972e6cf8c22f46e12e4332520] | [unk-42602374f893ae88c563304c394df41db5a6ac9a, unk-cd115902beb20bb85cb06065fe44e3b3aceeef0f]                                               | viable      |
| authorization-next-vercel-drizzle              | auth-authzed-spicedb            | evidence-needed | unverified-prohibited-constraint |                      1 | [artifact-evidence-3a1f3c2d3ebcc0c1d5fa1f8cc85f6da09cc01ab4, artifact-evidence-0c9115a3863dbbfe1b679afe4edcf19c16087ada, artifact-evidence-8851397536430b57224b740d2b5646a5926f4e42]                                                             | [unk-766963769cb14aa59be7fc3a22f85254e550101c, unk-9f8de789b876fadc729e7e1cabefaac2a858d2db]                                               | viable      |
| background-jobs-express-container-prisma-redis | jobs-agenda                     | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-56554adc9e54719c94ff48de3f5fa8ca9005b9ba, artifact-evidence-312be5ce4f6724e6dba8e0eef207b994af4a1e18, artifact-evidence-e35b1a3d47dce5e5a6c31eb5175f29f1befcd3c0, artifact-evidence-94e397c1e6fed20a15c05248e890fa296f1dd79c] | [unk-0f8136d8717b3287c0195c352a46721ff7f7cd07, unk-7700d72b80e5aaf508c036b9d85e22dba9fa5390, unk-7c270317506bc956f2a2daf3ccee17d9de2e13d4] | recommended |
| background-jobs-express-container-prisma-redis | jobs-rq                         | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-e94f2ecd5662420a9bee767afa09ea7a9365db23, artifact-evidence-3d669caa8c14f65cf4de8edbb94d2ab402d79c2c, artifact-evidence-43a17273a70e61df6f92d0452c3064762ba72a46]                                                             | [unk-25f30a40001317564a36ad58c8cda2273e5057a3, unk-33cc2dd7d751f669e03211140b442b257c279bdc, unk-8ce86174d4bc7e14b1c3c1abcf9f4f9a195bfdf4] | recommended |
| background-jobs-express-container-prisma-redis | jobs-bree                       | evidence-needed | partially-verified               |                      1 | [artifact-evidence-c981050c32de4e0bc08fff7f985b0e07ef4a4dfb, artifact-evidence-d9178273e14ce0c3bd96f0cb5ae72d865902f734]                                                                                                                         | [unk-5002e38b69ff11c75392653a5384284d95c8b345, unk-85bd3430c4f04125f65a10e6d1570ed478229460]                                               | viable      |
| rate-limiting-express-container-prisma-redis   | rate-node-rate-limiter-flexible | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-d9b1814493df46d026dba46c52faaa09fd475cbf, artifact-evidence-1d9adfe7b9658aa646d4f4fa3765d56f9fd0481f]                                                                                                                         | [unk-2035010a2e3a3c0a71f1f22a3777e36467908e02, unk-99493d5e13f3af0e2719524aafafe3e0368f118c, unk-a032f5e645a9e2a2168b4eb254e9f8897fd21ce1] | recommended |
| rate-limiting-express-container-prisma-redis   | rate-express-rate-limit         | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-8225fbdbff1a96c6fd1dfe53f996c16e53b0ec58, artifact-evidence-7f0fea9b28d7b7c49911ef9f599f00d0a3fb0f49]                                                                                                                         | [unk-3d0730e2ddf93e3e19f20577d5a6df110ce21c15, unk-70b920f4c31daf52dca790a9d2ee57d5e054c96c, unk-dec77c637d38d3a39f1e4956987e056e3396f2f4] | recommended |
| rate-limiting-next-selfhosted-drizzle          | rate-express-rate-limit         | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-8225fbdbff1a96c6fd1dfe53f996c16e53b0ec58, artifact-evidence-7f0fea9b28d7b7c49911ef9f599f00d0a3fb0f49, artifact-evidence-edec3e57ac3534601dbc154c0cf222312c8b8092, artifact-evidence-9972b016d0709294abf6cd2960a629ed55eb791d] | [unk-3d0730e2ddf93e3e19f20577d5a6df110ce21c15, unk-70b920f4c31daf52dca790a9d2ee57d5e054c96c, unk-dec77c637d38d3a39f1e4956987e056e3396f2f4] | viable      |
| rate-limiting-next-selfhosted-drizzle          | rate-node-rate-limiter-flexible | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-d9b1814493df46d026dba46c52faaa09fd475cbf, artifact-evidence-1d9adfe7b9658aa646d4f4fa3765d56f9fd0481f]                                                                                                                         | [unk-2035010a2e3a3c0a71f1f22a3777e36467908e02, unk-99493d5e13f3af0e2719524aafafe3e0368f118c, unk-a032f5e645a9e2a2168b4eb254e9f8897fd21ce1] | viable      |
| rate-limiting-next-selfhosted-drizzle          | rate-fastify-rate-limit         | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-5f3e183b5a6498a5891ed8368e61163754f003b6, artifact-evidence-0550fa0163cd72ff7a0bc94b7b98119054f64cef, artifact-evidence-f5f48ad91beaf7d2152f5bbcf116608d41890241]                                                             | [unk-0921899a79a2427f2f10c448f1b4595167572a34, unk-3d6fffbed6a047cfcc6ceeab14d452cbb70b0e99, unk-d25669dacb89d8d8ba9303e03bda9e7a1e84bf63] | viable      |

## Model calls

Total model calls made: 15.

Completed model calls: 15.

Deterministically valid responses: 5.

Median completed-call latency: 12417.9 ms.

Maximum completed-call latency: 20308.7 ms.

Median output tokens: 2569.0.

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
| domain.hard-resolution.inference-grounding |     3 |          11 |
| domain.outcome.disposition                 |     1 |           1 |
| domain.reference.catalog-coverage          |     3 |           3 |

### Disposition totals

| Disposition           | Count |
| --------------------- | ----: |
| recommended           |    11 |
| viable                |    26 |
| rejected              |     6 |
| insufficient-evidence |    32 |

### Hard-resolution state totals

| State      | Count |
| ---------- | ----: |
| satisfied  |    65 |
| conflict   |     5 |
| unresolved |   140 |

### Declared catalog totals

| Catalog     | Count |
| ----------- | ----: |
| inferences  |   112 |
| claims      |    55 |
| unknowns    |   247 |
| limitations |     9 |
| conflicts   |     5 |

Fixtures with any satisfied hard resolution: 10.

Candidates with any satisfied hard resolution: 42.

Fixtures with a rejected disposition on a declared conflict: 2.

Candidates with a rejected disposition on a declared conflict: 5.

### Per-fixture diagnostic totals

| Fixture                                        | Response | Validation | Domain issues | Dispositions                                                 | Resolutions                            | Catalogs                                                         | Any satisfied | Rejected conflict |
| ---------------------------------------------- | -------- | ---------- | ------------: | ------------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------- | ------------- | ----------------- |
| authorization-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=5, rejected=0, insufficient-evidence=0 | satisfied=5, conflict=0, unresolved=5  | inferences=10, claims=5, unknowns=12, limitations=3, conflicts=0 | yes           | no                |
| authorization-express-container-prisma-redis   | captured | failed     |             2 | recommended=2, viable=1, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=2  | inferences=5, claims=5, unknowns=11, limitations=3, conflicts=0  | yes           | no                |
| authorization-next-selfhosted-drizzle          | captured | failed     |             1 | recommended=0, viable=3, rejected=1, insufficient-evidence=1 | satisfied=5, conflict=0, unresolved=15 | inferences=24, claims=5, unknowns=11, limitations=3, conflicts=0 | yes           | no                |
| audit-logging-next-vercel-drizzle              | captured | failed     |             8 | recommended=0, viable=5, rejected=0, insufficient-evidence=0 | satisfied=8, conflict=0, unresolved=7  | inferences=5, claims=5, unknowns=20, limitations=0, conflicts=0  | yes           | no                |
| audit-logging-express-container-prisma-redis   | captured | failed     |             1 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10 | inferences=5, claims=0, unknowns=25, limitations=0, conflicts=0  | no            | no                |
| audit-logging-next-selfhosted-drizzle          | captured | failed     |             1 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25 | inferences=5, claims=5, unknowns=18, limitations=0, conflicts=0  | no            | no                |
| background-jobs-next-vercel-drizzle            | captured | failed     |             1 | recommended=1, viable=2, rejected=0, insufficient-evidence=2 | satisfied=0, conflict=0, unresolved=15 | inferences=5, claims=2, unknowns=18, limitations=0, conflicts=0  | no            | no                |
| background-jobs-express-container-prisma-redis | captured | passed     |             0 | recommended=2, viable=2, rejected=0, insufficient-evidence=1 | satisfied=6, conflict=0, unresolved=4  | inferences=6, claims=6, unknowns=17, limitations=0, conflicts=0  | yes           | no                |
| background-jobs-next-selfhosted-drizzle        | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25 | inferences=0, claims=0, unknowns=13, limitations=0, conflicts=0  | no            | no                |
| rate-limiting-next-vercel-drizzle              | captured | failed     |             1 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=5  | inferences=3, claims=0, unknowns=18, limitations=0, conflicts=0  | no            | no                |
| rate-limiting-express-container-prisma-redis   | captured | passed     |             0 | recommended=2, viable=0, rejected=0, insufficient-evidence=3 | satisfied=2, conflict=0, unresolved=3  | inferences=2, claims=2, unknowns=15, limitations=0, conflicts=0  | yes           | no                |
| rate-limiting-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=3, rejected=0, insufficient-evidence=2 | satisfied=9, conflict=0, unresolved=6  | inferences=9, claims=6, unknowns=16, limitations=0, conflicts=0  | yes           | no                |
| webhooks-next-vercel-drizzle                   | captured | failed     |             1 | recommended=0, viable=2, rejected=3, insufficient-evidence=0 | satisfied=10, conflict=3, unresolved=2 | inferences=13, claims=5, unknowns=15, limitations=0, conflicts=3 | yes           | yes               |
| webhooks-express-container-prisma-redis        | captured | failed     |             1 | recommended=4, viable=0, rejected=0, insufficient-evidence=1 | satisfied=9, conflict=0, unresolved=1  | inferences=10, claims=4, unknowns=18, limitations=0, conflicts=0 | yes           | no                |
| webhooks-next-selfhosted-drizzle               | captured | failed     |             2 | recommended=0, viable=3, rejected=2, insufficient-evidence=0 | satisfied=8, conflict=2, unresolved=15 | inferences=10, claims=5, unknowns=20, limitations=0, conflicts=2 | yes           | yes               |

## Failure categories

| Category                    | Calls | Occurrences |
| --------------------------- | ----: | ----------: |
| invalid-target-fit-response |    10 |          10 |
