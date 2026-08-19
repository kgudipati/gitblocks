# Outcome baseline v1

Reproduce from the repository root with `pnpm outcome:baseline:v1`.

This report contains no request prose, candidate display names, or model output text.

## Aggregate outcome counts

| Outcome                | Count |
| ---------------------- | ----: |
| clarification-required |     0 |
| unsupported            |     0 |
| insufficient-evidence  |     7 |
| no-viable-candidate    |     0 |
| recommend              |     1 |
| failed                 |     7 |

## Outcome counts by capability family

| Capability family | clarification-required | unsupported | insufficient-evidence | no-viable-candidate | recommend | failed |
| ----------------- | ---------------------: | ----------: | --------------------: | ------------------: | --------: | -----: |
| authorization     |                      0 |           0 |                     1 |                   0 |         0 |      2 |
| audit-logging     |                      0 |           0 |                     3 |                   0 |         0 |      0 |
| background-jobs   |                      0 |           0 |                     2 |                   0 |         0 |      1 |
| rate-limiting     |                      0 |           0 |                     1 |                   0 |         0 |      2 |
| webhooks          |                      0 |           0 |                     0 |                   0 |         1 |      2 |

## Non-recommend outcomes

| Fixture                                        | Outcome               | Producing stage                     | Reason                               |
| ---------------------------------------------- | --------------------- | ----------------------------------- | ------------------------------------ |
| authorization-next-vercel-drizzle              | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| authorization-express-container-prisma-redis   | failed                | deterministic assessment validation | invalid-target-fit-response          |
| authorization-next-selfhosted-drizzle          | failed                | deterministic assessment validation | invalid-target-fit-response          |
| audit-logging-next-vercel-drizzle              | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| audit-logging-express-container-prisma-redis   | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| audit-logging-next-selfhosted-drizzle          | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| background-jobs-next-vercel-drizzle            | failed                | deterministic assessment validation | invalid-target-fit-response          |
| background-jobs-express-container-prisma-redis | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| background-jobs-next-selfhosted-drizzle        | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| rate-limiting-next-vercel-drizzle              | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| rate-limiting-express-container-prisma-redis   | failed                | deterministic assessment validation | invalid-target-fit-response          |
| rate-limiting-next-selfhosted-drizzle          | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-next-vercel-drizzle                   | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-next-selfhosted-drizzle               | failed                | deterministic assessment validation | invalid-target-fit-response          |

## Insufficient-evidence detail

| Fixture                                        | Unresolved hard evaluations per finalist | Artifact excerpt available per finalist |
| ---------------------------------------------- | ---------------------------------------- | --------------------------------------- |
| authorization-next-vercel-drizzle              | [1, 1, 1, 1, 1]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-next-vercel-drizzle              | [3, 3, 3, 3, 3]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-express-container-prisma-redis   | [2, 2, 2, 2, 2]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-next-selfhosted-drizzle          | [5, 5, 5, 5, 5]                          | [yes, yes, yes, yes, yes]               |
| background-jobs-express-container-prisma-redis | [2, 2, 2, 2, 2]                          | [yes, yes, yes, yes, yes]               |
| background-jobs-next-selfhosted-drizzle        | [5, 5, 5, 5, 5]                          | [yes, yes, yes, yes, yes]               |
| rate-limiting-next-vercel-drizzle              | [2, 2, 2, 2, 2]                          | [yes, yes, yes, yes, yes]               |

## Recommend detail

| Fixture                                 | Options returned | Eligible-lane options | Evidence-needed-lane options |
| --------------------------------------- | ---------------: | --------------------: | ---------------------------: |
| webhooks-express-container-prisma-redis |                3 |                     0 |                            3 |

### Recommended option detail

| Fixture                                 | Candidate ID     | Lane            | Evidence references                                                                                                                                                                  | Material unknowns                                                                                                                          | Disposition |
| --------------------------------------- | ---------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| webhooks-express-container-prisma-redis | webhook-svix     | evidence-needed | [artifact-evidence-4e97f0e405f925595fd96f7c2201c78a7014d5ff, artifact-evidence-d5e2cd094b67c01dd3c19b54e89f31d60751abda, artifact-evidence-721b0a360d115f71c971f67d87245154b15a0329] | [unk-0e1facb3b0e86d42fae0d27d5e84eec2051011b7, unk-29e401713ae6847d6d0f75e710483325781ca7df, unk-88ed064aeaaa32dffb33cb8f026a5f6889c0d854] | viable      |
| webhooks-express-container-prisma-redis | webhook-hookdeck | evidence-needed | [artifact-evidence-db42c135de5723f37c83fd7be6009c2d56379f24, artifact-evidence-5dbbf5b05e5529276ae2aeb7aee0b8f9051db4e6]                                                             | [unk-a56d59397aba80de755ae41b1f8e85e55a8043b3, unk-c8242a59d52d0b1120caf7cc1f9f066c45d58f4d]                                               | viable      |
| webhooks-express-container-prisma-redis | webhook-convoy   | evidence-needed | [artifact-evidence-e95d565d576eb53ac7c800ee5bba36337f489ddb, artifact-evidence-7b9865928d453ccbb28dd08948052bd5f12ad372]                                                             | [unk-11ef41c15bd72c4304a1b60dbc40bb1c21b97a04, unk-1860e59277efd2c280ed9bc6f3d762d7afb619d3, unk-502ad60d7a9325db0bfaf8ebd107266c1078362f] | viable      |

## Model calls

Total model calls made: 15.

Completed model calls: 15.

Deterministically valid responses: 8.

Median completed-call latency: 11011.2 ms.

Maximum completed-call latency: 25517.7 ms.

Median output tokens: 2119.0.

## Assessment diagnostics

Model responses captured for diagnostics: 15 of 15 fixtures.

Harness canonical validations passed: 8.

Diagnostic capture failures: 0.

Unknown totals include supplied candidate unknowns plus model-declared assessment unknowns; limitation totals are the supplied candidate limitation catalog hydrated by validation.

### Domain issue categories

| Category                                   | Calls | Occurrences |
| ------------------------------------------ | ----: | ----------: |
| domain.constraint.preservation             |     1 |           1 |
| domain.disposition.support                 |     2 |           2 |
| domain.hard-resolution.inference-grounding |     2 |          22 |
| domain.reason.traceability                 |     1 |           4 |
| domain.reference.candidate-ownership       |     1 |           2 |
| domain.reference.candidate-set             |     1 |           1 |
| domain.reference.catalog-coverage          |     3 |           6 |

### Disposition totals

| Disposition           | Count |
| --------------------- | ----: |
| recommended           |     7 |
| viable                |    14 |
| rejected              |     1 |
| insufficient-evidence |    51 |

### Hard-resolution state totals

| State      | Count |
| ---------- | ----: |
| satisfied  |    75 |
| conflict   |     5 |
| unresolved |   140 |

### Declared catalog totals

| Catalog     | Count |
| ----------- | ----: |
| inferences  |   102 |
| claims      |    41 |
| unknowns    |   226 |
| limitations |     9 |
| conflicts   |     5 |

Fixtures with any satisfied hard resolution: 8.

Candidates with any satisfied hard resolution: 37.

Fixtures with a rejected disposition on a declared conflict: 1.

Candidates with a rejected disposition on a declared conflict: 1.

### Per-fixture diagnostic totals

| Fixture                                        | Response | Validation | Domain issues | Dispositions                                                 | Resolutions                             | Catalogs                                                          | Any satisfied | Rejected conflict |
| ---------------------------------------------- | -------- | ---------- | ------------: | ------------------------------------------------------------ | --------------------------------------- | ----------------------------------------------------------------- | ------------- | ----------------- |
| authorization-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=5, conflict=0, unresolved=5   | inferences=5, claims=0, unknowns=11, limitations=3, conflicts=0   | yes           | no                |
| authorization-express-container-prisma-redis   | captured | failed     |             1 | recommended=2, viable=3, rejected=0, insufficient-evidence=0 | satisfied=5, conflict=0, unresolved=0   | inferences=5, claims=5, unknowns=11, limitations=3, conflicts=0   | yes           | no                |
| authorization-next-selfhosted-drizzle          | captured | failed     |            20 | recommended=0, viable=5, rejected=0, insufficient-evidence=0 | satisfied=20, conflict=0, unresolved=0  | inferences=5, claims=5, unknowns=16, limitations=3, conflicts=0   | yes           | no                |
| audit-logging-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=15  | inferences=0, claims=0, unknowns=25, limitations=0, conflicts=0   | no            | no                |
| audit-logging-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10  | inferences=5, claims=0, unknowns=16, limitations=0, conflicts=0   | no            | no                |
| audit-logging-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25  | inferences=0, claims=0, unknowns=15, limitations=0, conflicts=0   | no            | no                |
| background-jobs-next-vercel-drizzle            | captured | failed     |             8 | recommended=1, viable=1, rejected=0, insufficient-evidence=1 | satisfied=10, conflict=5, unresolved=0  | inferences=15, claims=4, unknowns=13, limitations=0, conflicts=4  | yes           | no                |
| background-jobs-express-container-prisma-redis | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10  | inferences=0, claims=0, unknowns=12, limitations=0, conflicts=0   | no            | no                |
| background-jobs-next-selfhosted-drizzle        | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25  | inferences=0, claims=0, unknowns=14, limitations=0, conflicts=0   | no            | no                |
| rate-limiting-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10  | inferences=5, claims=0, unknowns=16, limitations=0, conflicts=0   | no            | no                |
| rate-limiting-express-container-prisma-redis   | captured | failed     |             2 | recommended=3, viable=0, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=2   | inferences=8, claims=3, unknowns=15, limitations=0, conflicts=0   | yes           | no                |
| rate-limiting-next-selfhosted-drizzle          | captured | failed     |             1 | recommended=0, viable=0, rejected=1, insufficient-evidence=4 | satisfied=0, conflict=0, unresolved=20  | inferences=4, claims=4, unknowns=16, limitations=0, conflicts=1   | no            | yes               |
| webhooks-next-vercel-drizzle                   | captured | failed     |             5 | recommended=1, viable=0, rejected=0, insufficient-evidence=4 | satisfied=12, conflict=0, unresolved=3  | inferences=15, claims=5, unknowns=15, limitations=0, conflicts=0  | yes           | no                |
| webhooks-express-container-prisma-redis        | captured | passed     |             0 | recommended=0, viable=5, rejected=0, insufficient-evidence=0 | satisfied=10, conflict=0, unresolved=0  | inferences=10, claims=5, unknowns=13, limitations=0, conflicts=0  | yes           | no                |
| webhooks-next-selfhosted-drizzle               | captured | failed     |             1 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=10, conflict=0, unresolved=15 | inferences=25, claims=10, unknowns=18, limitations=0, conflicts=0 | yes           | no                |

## Failure categories

| Category                    | Calls | Occurrences |
| --------------------------- | ----: | ----------: |
| invalid-target-fit-response |     7 |           7 |
