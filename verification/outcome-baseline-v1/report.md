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
| recommend              |     3 |
| failed                 |     7 |

## Outcome counts by capability family

| Capability family | clarification-required | unsupported | insufficient-evidence | no-viable-candidate | recommend | failed |
| ----------------- | ---------------------: | ----------: | --------------------: | ------------------: | --------: | -----: |
| authorization     |                      0 |           0 |                     0 |                   0 |         2 |      1 |
| audit-logging     |                      0 |           0 |                     2 |                   0 |         0 |      1 |
| background-jobs   |                      0 |           0 |                     0 |                   0 |         0 |      3 |
| rate-limiting     |                      0 |           0 |                     2 |                   0 |         0 |      1 |
| webhooks          |                      0 |           0 |                     1 |                   0 |         1 |      1 |

## Non-recommend outcomes

| Fixture                                        | Outcome               | Producing stage                     | Reason                               |
| ---------------------------------------------- | --------------------- | ----------------------------------- | ------------------------------------ |
| authorization-next-selfhosted-drizzle          | failed                | deterministic assessment validation | invalid-target-fit-response          |
| audit-logging-next-vercel-drizzle              | failed                | deterministic assessment validation | invalid-target-fit-response          |
| audit-logging-express-container-prisma-redis   | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| audit-logging-next-selfhosted-drizzle          | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| background-jobs-next-vercel-drizzle            | failed                | deterministic assessment validation | invalid-target-fit-response          |
| background-jobs-express-container-prisma-redis | failed                | deterministic assessment validation | invalid-target-fit-response          |
| background-jobs-next-selfhosted-drizzle        | failed                | deterministic assessment validation | invalid-target-fit-response          |
| rate-limiting-next-vercel-drizzle              | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| rate-limiting-express-container-prisma-redis   | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| rate-limiting-next-selfhosted-drizzle          | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-next-vercel-drizzle                   | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| webhooks-next-selfhosted-drizzle               | failed                | deterministic assessment validation | invalid-target-fit-response          |

## Insufficient-evidence detail

| Fixture                                      | Unresolved hard evaluations per finalist | Artifact excerpt available per finalist |
| -------------------------------------------- | ---------------------------------------- | --------------------------------------- |
| audit-logging-express-container-prisma-redis | [2, 2, 2, 2, 2]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-next-selfhosted-drizzle        | [5, 5, 5, 5, 5]                          | [yes, yes, yes, yes, yes]               |
| rate-limiting-next-vercel-drizzle            | [2, 2, 2, 2, 2]                          | [yes, yes, yes, yes, yes]               |
| rate-limiting-express-container-prisma-redis | [1, 1, 1, 1, 1]                          | [yes, no, yes, no, yes]                 |
| webhooks-next-vercel-drizzle                 | [1, 1, 1, 1, 1]                          | [yes, yes, yes, yes, yes]               |

## Recommend detail

| Fixture                                      | Options returned | Eligible-lane options | Evidence-needed-lane options |
| -------------------------------------------- | ---------------: | --------------------: | ---------------------------: |
| authorization-next-vercel-drizzle            |                3 |                     0 |                            3 |
| authorization-express-container-prisma-redis |                3 |                     0 |                            3 |
| webhooks-express-container-prisma-redis      |                3 |                     0 |                            3 |

### Recommended option detail

| Fixture                                      | Candidate ID            | Lane            | Evidence references                                                                                                                                                                                                                              | Material unknowns                                                                                                                          | Disposition |
| -------------------------------------------- | ----------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| authorization-next-vercel-drizzle            | auth-authzed-spicedb    | evidence-needed | [artifact-evidence-3a1f3c2d3ebcc0c1d5fa1f8cc85f6da09cc01ab4, artifact-evidence-8851397536430b57224b740d2b5646a5926f4e42]                                                                                                                         | [unk-766963769cb14aa59be7fc3a22f85254e550101c, unk-9f8de789b876fadc729e7e1cabefaac2a858d2db]                                               | recommended |
| authorization-next-vercel-drizzle            | auth-openfga            | evidence-needed | [artifact-evidence-d04c535d86c32d571bca781c624f1df44581bddd, artifact-evidence-6d6d373a6dfeca08bb7ce4e948038172b89c4fda, artifact-evidence-a198452efd38edb31ee124991c6f2c46afc1991b, artifact-evidence-47efec7932f9a23972e6cf8c22f46e12e4332520] | [unk-42602374f893ae88c563304c394df41db5a6ac9a, unk-cd115902beb20bb85cb06065fe44e3b3aceeef0f]                                               | viable      |
| authorization-next-vercel-drizzle            | auth-casbin-node-casbin | evidence-needed | [artifact-evidence-1043e012fa62346177938ea4b1f627ecff67b28e, artifact-evidence-37a5d83a039e2b54ce89d28ce0092a0c8362fea2, artifact-evidence-3a7c582175d3307927f9ce8d8af8dcac9e356e7f]                                                             | [unk-2d55a7fa4fbbd58b4817cc8749c5a5e3a7c91a06, unk-8538c6db70ce6362931c72431ccbfe42c9bf77f7, unk-a15707136190e56f81c748db2b60f9e00dc5000f] | viable      |
| authorization-express-container-prisma-redis | auth-openfga            | evidence-needed | [artifact-evidence-d04c535d86c32d571bca781c624f1df44581bddd, artifact-evidence-6d6d373a6dfeca08bb7ce4e948038172b89c4fda]                                                                                                                         | [unk-42602374f893ae88c563304c394df41db5a6ac9a, unk-cd115902beb20bb85cb06065fe44e3b3aceeef0f]                                               | viable      |
| authorization-express-container-prisma-redis | auth-casbin-node-casbin | evidence-needed | [artifact-evidence-1043e012fa62346177938ea4b1f627ecff67b28e, artifact-evidence-37a5d83a039e2b54ce89d28ce0092a0c8362fea2]                                                                                                                         | [unk-2d55a7fa4fbbd58b4817cc8749c5a5e3a7c91a06, unk-8538c6db70ce6362931c72431ccbfe42c9bf77f7, unk-a15707136190e56f81c748db2b60f9e00dc5000f] | viable      |
| authorization-express-container-prisma-redis | auth-casbin-casbin      | evidence-needed | [artifact-evidence-15de1d65cba130055ca4e3a3bcb541f99793cc97, artifact-evidence-c558152924def1d1797f369e610759da05fd34e9]                                                                                                                         | [unk-acb2a8b67b802d4a3290bb0e0c7e0b5c3361201e, unk-f473d94aba03390e6f9426489c7e9330e6c607eb]                                               | viable      |
| webhooks-express-container-prisma-redis      | webhook-svix            | evidence-needed | [artifact-evidence-4e97f0e405f925595fd96f7c2201c78a7014d5ff, artifact-evidence-d5e2cd094b67c01dd3c19b54e89f31d60751abda, artifact-evidence-721b0a360d115f71c971f67d87245154b15a0329]                                                             | [unk-0e1facb3b0e86d42fae0d27d5e84eec2051011b7, unk-29e401713ae6847d6d0f75e710483325781ca7df, unk-88ed064aeaaa32dffb33cb8f026a5f6889c0d854] | recommended |
| webhooks-express-container-prisma-redis      | webhook-hookdeck        | evidence-needed | [artifact-evidence-db42c135de5723f37c83fd7be6009c2d56379f24, artifact-evidence-5dbbf5b05e5529276ae2aeb7aee0b8f9051db4e6]                                                                                                                         | [unk-a56d59397aba80de755ae41b1f8e85e55a8043b3, unk-c8242a59d52d0b1120caf7cc1f9f066c45d58f4d]                                               | viable      |
| webhooks-express-container-prisma-redis      | webhook-convoy          | evidence-needed | [artifact-evidence-e95d565d576eb53ac7c800ee5bba36337f489ddb, artifact-evidence-7b9865928d453ccbb28dd08948052bd5f12ad372]                                                                                                                         | [unk-11ef41c15bd72c4304a1b60dbc40bb1c21b97a04, unk-1860e59277efd2c280ed9bc6f3d762d7afb619d3, unk-502ad60d7a9325db0bfaf8ebd107266c1078362f] | viable      |

## Model calls

Total model calls made: 15.

Completed model calls: 15.

Deterministically valid responses: 8.

Median completed-call latency: 14090.9 ms.

Maximum completed-call latency: 21145.7 ms.

Median output tokens: 2802.0.

## Assessment diagnostics

Model responses captured for diagnostics: 15 of 15 fixtures.

Harness canonical validations passed: 8.

Diagnostic capture failures: 0.

Unknown totals include supplied candidate unknowns plus model-declared assessment unknowns; limitation totals are the supplied candidate limitation catalog hydrated by validation.

### Domain issue categories

| Category                                   | Calls | Occurrences |
| ------------------------------------------ | ----: | ----------: |
| domain.constraint.disposition              |     1 |           1 |
| domain.constraint.preservation             |     4 |           4 |
| domain.exchange.constraint-reference       |     1 |           1 |
| domain.hard-resolution.inference-grounding |     1 |           7 |
| domain.outcome.disposition                 |     2 |           2 |
| domain.reference.catalog-coverage          |     4 |           5 |

### Disposition totals

| Disposition           | Count |
| --------------------- | ----: |
| recommended           |     3 |
| viable                |    15 |
| rejected              |     4 |
| insufficient-evidence |    53 |

### Hard-resolution state totals

| State      | Count |
| ---------- | ----: |
| satisfied  |    61 |
| conflict   |     7 |
| unresolved |   152 |

### Declared catalog totals

| Catalog     | Count |
| ----------- | ----: |
| inferences  |   100 |
| claims      |    46 |
| unknowns    |   253 |
| limitations |     9 |
| conflicts   |     8 |

Fixtures with any satisfied hard resolution: 8.

Candidates with any satisfied hard resolution: 38.

Fixtures with a rejected disposition on a declared conflict: 3.

Candidates with a rejected disposition on a declared conflict: 4.

### Per-fixture diagnostic totals

| Fixture                                        | Response | Validation | Domain issues | Dispositions                                                 | Resolutions                            | Catalogs                                                          | Any satisfied | Rejected conflict |
| ---------------------------------------------- | -------- | ---------- | ------------: | ------------------------------------------------------------ | -------------------------------------- | ----------------------------------------------------------------- | ------------- | ----------------- |
| authorization-next-vercel-drizzle              | captured | passed     |             0 | recommended=1, viable=4, rejected=0, insufficient-evidence=0 | satisfied=10, conflict=0, unresolved=0 | inferences=10, claims=6, unknowns=16, limitations=3, conflicts=0  | yes           | no                |
| authorization-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=5, rejected=0, insufficient-evidence=0 | satisfied=5, conflict=0, unresolved=0  | inferences=5, claims=5, unknowns=16, limitations=3, conflicts=0   | yes           | no                |
| authorization-next-selfhosted-drizzle          | captured | failed     |             3 | recommended=0, viable=0, rejected=2, insufficient-evidence=3 | satisfied=5, conflict=3, unresolved=12 | inferences=8, claims=5, unknowns=16, limitations=3, conflicts=3   | yes           | yes               |
| audit-logging-next-vercel-drizzle              | captured | failed     |             7 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=7, conflict=0, unresolved=8  | inferences=5, claims=6, unknowns=24, limitations=0, conflicts=0   | yes           | no                |
| audit-logging-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10 | inferences=0, claims=0, unknowns=17, limitations=0, conflicts=0   | no            | no                |
| audit-logging-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25 | inferences=10, claims=0, unknowns=18, limitations=0, conflicts=0  | no            | no                |
| background-jobs-next-vercel-drizzle            | captured | failed     |             1 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=15 | inferences=5, claims=0, unknowns=14, limitations=0, conflicts=0   | no            | no                |
| background-jobs-express-container-prisma-redis | captured | failed     |             1 | recommended=1, viable=2, rejected=1, insufficient-evidence=1 | satisfied=7, conflict=1, unresolved=2  | inferences=7, claims=4, unknowns=15, limitations=0, conflicts=1   | yes           | yes               |
| background-jobs-next-selfhosted-drizzle        | captured | failed     |             1 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25 | inferences=5, claims=0, unknowns=18, limitations=0, conflicts=0   | no            | no                |
| rate-limiting-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10 | inferences=5, claims=0, unknowns=16, limitations=0, conflicts=0   | no            | no                |
| rate-limiting-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=5  | inferences=5, claims=0, unknowns=15, limitations=0, conflicts=0   | no            | no                |
| rate-limiting-next-selfhosted-drizzle          | captured | failed     |             3 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=20 | inferences=5, claims=0, unknowns=18, limitations=0, conflicts=1   | no            | no                |
| webhooks-next-vercel-drizzle                   | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=10, conflict=0, unresolved=5 | inferences=10, claims=10, unknowns=20, limitations=0, conflicts=0 | yes           | no                |
| webhooks-express-container-prisma-redis        | captured | passed     |             0 | recommended=1, viable=4, rejected=0, insufficient-evidence=0 | satisfied=10, conflict=0, unresolved=0 | inferences=15, claims=5, unknowns=14, limitations=0, conflicts=0  | yes           | no                |
| webhooks-next-selfhosted-drizzle               | captured | failed     |             4 | recommended=0, viable=0, rejected=1, insufficient-evidence=4 | satisfied=7, conflict=3, unresolved=15 | inferences=5, claims=5, unknowns=16, limitations=0, conflicts=3   | yes           | yes               |

## Failure categories

| Category                    | Calls | Occurrences |
| --------------------------- | ----: | ----------: |
| invalid-target-fit-response |     7 |           7 |
