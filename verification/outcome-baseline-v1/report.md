# Outcome baseline v1

Reproduce from the repository root with `pnpm outcome:baseline:v1`.

This report contains no request prose, candidate display names, or model output text.

## Aggregate outcome counts

| Outcome                | Count |
| ---------------------- | ----: |
| clarification-required |     0 |
| unsupported            |     0 |
| insufficient-evidence  |     2 |
| no-viable-candidate    |     0 |
| recommend              |     1 |
| failed                 |    12 |

## Outcome counts by capability family

| Capability family | clarification-required | unsupported | insufficient-evidence | no-viable-candidate | recommend | failed |
| ----------------- | ---------------------: | ----------: | --------------------: | ------------------: | --------: | -----: |
| authorization     |                      0 |           0 |                     1 |                   0 |         0 |      2 |
| audit-logging     |                      0 |           0 |                     1 |                   0 |         0 |      2 |
| background-jobs   |                      0 |           0 |                     0 |                   0 |         0 |      3 |
| rate-limiting     |                      0 |           0 |                     0 |                   0 |         1 |      2 |
| webhooks          |                      0 |           0 |                     0 |                   0 |         0 |      3 |

## Non-recommend outcomes

| Fixture                                        | Outcome               | Producing stage                     | Reason                               |
| ---------------------------------------------- | --------------------- | ----------------------------------- | ------------------------------------ |
| authorization-next-vercel-drizzle              | failed                | deterministic assessment validation | invalid-target-fit-response          |
| authorization-express-container-prisma-redis   | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| authorization-next-selfhosted-drizzle          | failed                | deterministic assessment validation | invalid-target-fit-response          |
| audit-logging-next-vercel-drizzle              | failed                | deterministic assessment validation | invalid-target-fit-response          |
| audit-logging-express-container-prisma-redis   | failed                | deterministic assessment validation | invalid-target-fit-response          |
| audit-logging-next-selfhosted-drizzle          | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| background-jobs-next-vercel-drizzle            | failed                | deterministic assessment validation | invalid-target-fit-response          |
| background-jobs-express-container-prisma-redis | failed                | deterministic assessment validation | invalid-target-fit-response          |
| background-jobs-next-selfhosted-drizzle        | failed                | deterministic assessment validation | invalid-target-fit-response          |
| rate-limiting-next-vercel-drizzle              | failed                | deterministic assessment validation | invalid-target-fit-response          |
| rate-limiting-next-selfhosted-drizzle          | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-next-vercel-drizzle                   | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-express-container-prisma-redis        | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-next-selfhosted-drizzle               | failed                | deterministic assessment validation | invalid-target-fit-response          |

## Insufficient-evidence detail

| Fixture                                      | Unresolved hard evaluations per finalist | Artifact excerpt available per finalist |
| -------------------------------------------- | ---------------------------------------- | --------------------------------------- |
| authorization-express-container-prisma-redis | [1, 1, 1, 1, 1]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-next-selfhosted-drizzle        | [5, 5, 5, 5, 5]                          | [yes, yes, yes, yes, yes]               |

## Recommend detail

| Fixture                                      | Options returned | Eligible-lane options | Evidence-needed-lane options | Options with unverified constraints |
| -------------------------------------------- | ---------------: | --------------------: | ---------------------------: | ----------------------------------: |
| rate-limiting-express-container-prisma-redis |                3 |                     0 |                            3 |                                   0 |

### Recommended option detail

| Fixture                                      | Candidate ID                    | Lane            | Verification   | Unverified constraints | Evidence references                                                                                                      | Material unknowns                                                                                                                          | Disposition |
| -------------------------------------------- | ------------------------------- | --------------- | -------------- | ---------------------: | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| rate-limiting-express-container-prisma-redis | rate-node-rate-limiter-flexible | evidence-needed | fully-verified |                      0 | [artifact-evidence-d9b1814493df46d026dba46c52faaa09fd475cbf, artifact-evidence-1d9adfe7b9658aa646d4f4fa3765d56f9fd0481f] | [unk-2035010a2e3a3c0a71f1f22a3777e36467908e02, unk-99493d5e13f3af0e2719524aafafe3e0368f118c, unk-a032f5e645a9e2a2168b4eb254e9f8897fd21ce1] | recommended |
| rate-limiting-express-container-prisma-redis | rate-express-rate-limit         | evidence-needed | fully-verified |                      0 | [artifact-evidence-8225fbdbff1a96c6fd1dfe53f996c16e53b0ec58, artifact-evidence-7f0fea9b28d7b7c49911ef9f599f00d0a3fb0f49] | [unk-3d0730e2ddf93e3e19f20577d5a6df110ce21c15, unk-70b920f4c31daf52dca790a9d2ee57d5e054c96c, unk-dec77c637d38d3a39f1e4956987e056e3396f2f4] | recommended |
| rate-limiting-express-container-prisma-redis | rate-fastify-rate-limit         | evidence-needed | fully-verified |                      0 | [artifact-evidence-5f3e183b5a6498a5891ed8368e61163754f003b6, artifact-evidence-0550fa0163cd72ff7a0bc94b7b98119054f64cef] | [unk-0921899a79a2427f2f10c448f1b4595167572a34, unk-3d6fffbed6a047cfcc6ceeab14d452cbb70b0e99, unk-d25669dacb89d8d8ba9303e03bda9e7a1e84bf63] | recommended |

## Model calls

Total model calls made: 15.

Completed model calls: 15.

Deterministically valid responses: 3.

Median completed-call latency: 12342.6 ms.

Maximum completed-call latency: 21378.2 ms.

Median output tokens: 2738.0.

## Assessment diagnostics

Model responses captured for diagnostics: 15 of 15 fixtures.

Harness canonical validations passed: 3.

Diagnostic capture failures: 0.

Unknown totals include supplied candidate unknowns plus model-declared assessment unknowns; limitation totals are the supplied candidate limitation catalog hydrated by validation.

### Domain issue categories

| Category                                             | Calls | Occurrences |
| ---------------------------------------------------- | ----: | ----------: |
| domain.constraint.disposition                        |     1 |           1 |
| domain.constraint.preservation                       |     4 |           4 |
| domain.constraint.ranking                            |     1 |           1 |
| domain.disposition.support                           |     2 |           2 |
| domain.hard-resolution.inference-grounding           |     2 |           6 |
| domain.outcome.disposition                           |     2 |           2 |
| domain.recommendation-assessment.surrogate-reference |     1 |           4 |
| domain.reference.candidate-ownership                 |     1 |           2 |
| domain.reference.candidate-set                       |     2 |           2 |
| domain.reference.catalog-coverage                    |     5 |           8 |

### Disposition totals

| Disposition           | Count |
| --------------------- | ----: |
| recommended           |     7 |
| viable                |    21 |
| rejected              |     9 |
| insufficient-evidence |    35 |

### Hard-resolution state totals

| State      | Count |
| ---------- | ----: |
| satisfied  |    48 |
| conflict   |     8 |
| unresolved |   164 |

### Declared catalog totals

| Catalog     | Count |
| ----------- | ----: |
| inferences  |   117 |
| claims      |    59 |
| unknowns    |   234 |
| limitations |     9 |
| conflicts   |     9 |

Fixtures with any satisfied hard resolution: 7.

Candidates with any satisfied hard resolution: 30.

Fixtures with a rejected disposition on a declared conflict: 5.

Candidates with a rejected disposition on a declared conflict: 8.

### Per-fixture diagnostic totals

| Fixture                                        | Response | Validation | Domain issues | Dispositions                                                 | Resolutions                             | Catalogs                                                         | Any satisfied | Rejected conflict |
| ---------------------------------------------- | -------- | ---------- | ------------: | ------------------------------------------------------------ | --------------------------------------- | ---------------------------------------------------------------- | ------------- | ----------------- |
| authorization-next-vercel-drizzle              | captured | failed     |             5 | recommended=1, viable=4, rejected=0, insufficient-evidence=0 | satisfied=5, conflict=0, unresolved=5   | inferences=7, claims=5, unknowns=12, limitations=3, conflicts=0  | yes           | no                |
| authorization-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=5   | inferences=5, claims=0, unknowns=11, limitations=3, conflicts=0  | no            | no                |
| authorization-next-selfhosted-drizzle          | captured | failed     |             3 | recommended=0, viable=0, rejected=0, insufficient-evidence=4 | satisfied=0, conflict=0, unresolved=20  | inferences=4, claims=0, unknowns=11, limitations=3, conflicts=0  | no            | no                |
| audit-logging-next-vercel-drizzle              | captured | failed     |             1 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=15  | inferences=5, claims=0, unknowns=18, limitations=0, conflicts=0  | no            | no                |
| audit-logging-express-container-prisma-redis   | captured | failed     |             1 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10  | inferences=5, claims=0, unknowns=17, limitations=0, conflicts=0  | no            | no                |
| audit-logging-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25  | inferences=5, claims=9, unknowns=20, limitations=0, conflicts=0  | no            | no                |
| background-jobs-next-vercel-drizzle            | captured | failed     |             7 | recommended=1, viable=1, rejected=2, insufficient-evidence=1 | satisfied=7, conflict=3, unresolved=5   | inferences=12, claims=4, unknowns=14, limitations=0, conflicts=2 | yes           | yes               |
| background-jobs-express-container-prisma-redis | captured | failed     |             3 | recommended=0, viable=3, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=10  | inferences=6, claims=0, unknowns=12, limitations=0, conflicts=0  | no            | no                |
| background-jobs-next-selfhosted-drizzle        | captured | failed     |             2 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25  | inferences=5, claims=5, unknowns=18, limitations=0, conflicts=0  | no            | no                |
| rate-limiting-next-vercel-drizzle              | captured | failed     |             2 | recommended=2, viable=0, rejected=2, insufficient-evidence=1 | satisfied=5, conflict=2, unresolved=3   | inferences=6, claims=6, unknowns=17, limitations=0, conflicts=2  | yes           | yes               |
| rate-limiting-express-container-prisma-redis   | captured | passed     |             0 | recommended=3, viable=0, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=2   | inferences=3, claims=3, unknowns=14, limitations=0, conflicts=0  | yes           | no                |
| rate-limiting-next-selfhosted-drizzle          | captured | failed     |             2 | recommended=0, viable=3, rejected=2, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=20  | inferences=8, claims=5, unknowns=14, limitations=0, conflicts=2  | no            | yes               |
| webhooks-next-vercel-drizzle                   | captured | failed     |             1 | recommended=0, viable=2, rejected=2, insufficient-evidence=1 | satisfied=9, conflict=2, unresolved=4   | inferences=11, claims=9, unknowns=18, limitations=0, conflicts=2 | yes           | yes               |
| webhooks-express-container-prisma-redis        | captured | failed     |             1 | recommended=0, viable=4, rejected=0, insufficient-evidence=1 | satisfied=9, conflict=0, unresolved=1   | inferences=10, claims=9, unknowns=18, limitations=0, conflicts=0 | yes           | no                |
| webhooks-next-selfhosted-drizzle               | captured | failed     |             4 | recommended=0, viable=4, rejected=1, insufficient-evidence=0 | satisfied=10, conflict=1, unresolved=14 | inferences=25, claims=4, unknowns=20, limitations=0, conflicts=1 | yes           | yes               |

## Failure categories

| Category                    | Calls | Occurrences |
| --------------------------- | ----: | ----------: |
| invalid-target-fit-response |    12 |          12 |
