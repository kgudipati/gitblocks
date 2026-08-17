# Outcome baseline v1

Reproduce from the repository root with `pnpm outcome:baseline:v1`.

This report contains no request prose, candidate display names, or model output text.

## Aggregate outcome counts

| Outcome                | Count |
| ---------------------- | ----: |
| clarification-required |     0 |
| unsupported            |     0 |
| insufficient-evidence  |     6 |
| no-viable-candidate    |     0 |
| recommend              |     0 |
| failed                 |     9 |

## Outcome counts by capability family

| Capability family | clarification-required | unsupported | insufficient-evidence | no-viable-candidate | recommend | failed |
| ----------------- | ---------------------: | ----------: | --------------------: | ------------------: | --------: | -----: |
| authorization     |                      0 |           0 |                     2 |                   0 |         0 |      1 |
| audit-logging     |                      0 |           0 |                     2 |                   0 |         0 |      1 |
| background-jobs   |                      0 |           0 |                     1 |                   0 |         0 |      2 |
| rate-limiting     |                      0 |           0 |                     1 |                   0 |         0 |      2 |
| webhooks          |                      0 |           0 |                     0 |                   0 |         0 |      3 |

## Non-recommend outcomes

| Fixture                                        | Outcome               | Producing stage                     | Reason                               |
| ---------------------------------------------- | --------------------- | ----------------------------------- | ------------------------------------ |
| authorization-next-vercel-drizzle              | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| authorization-express-container-prisma-redis   | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| authorization-next-selfhosted-drizzle          | failed                | deterministic assessment validation | invalid-target-fit-response          |
| audit-logging-next-vercel-drizzle              | failed                | deterministic assessment validation | invalid-target-fit-response          |
| audit-logging-express-container-prisma-redis   | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| audit-logging-next-selfhosted-drizzle          | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| background-jobs-next-vercel-drizzle            | failed                | deterministic assessment validation | invalid-target-fit-response          |
| background-jobs-express-container-prisma-redis | failed                | deterministic assessment validation | invalid-target-fit-response          |
| background-jobs-next-selfhosted-drizzle        | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| rate-limiting-next-vercel-drizzle              | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| rate-limiting-express-container-prisma-redis   | failed                | deterministic assessment validation | invalid-target-fit-response          |
| rate-limiting-next-selfhosted-drizzle          | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-next-vercel-drizzle                   | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-express-container-prisma-redis        | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-next-selfhosted-drizzle               | failed                | deterministic assessment validation | invalid-target-fit-response          |

## Insufficient-evidence detail

| Fixture                                      | Unresolved hard evaluations per finalist | Artifact excerpt available per finalist |
| -------------------------------------------- | ---------------------------------------- | --------------------------------------- |
| authorization-next-vercel-drizzle            | [1, 1, 1, 1, 1]                          | [yes, yes, yes, yes, yes]               |
| authorization-express-container-prisma-redis | [1, 1, 1, 1, 1]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-express-container-prisma-redis | [2, 2, 2, 2, 2]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-next-selfhosted-drizzle        | [4, 4, 4, 4, 4]                          | [yes, yes, yes, yes, yes]               |
| background-jobs-next-selfhosted-drizzle      | [5, 5, 5, 5, 5]                          | [yes, yes, yes, yes, yes]               |
| rate-limiting-next-vercel-drizzle            | [2, 2, 2, 2, 2]                          | [yes, yes, yes, yes, yes]               |

## Recommend detail

No recommend outcomes.

## Model calls

Total model calls made: 15.

Completed model calls: 15.

Deterministically valid responses: 6.

Median completed-call latency: 13638.9 ms.

Maximum completed-call latency: 20109.1 ms.

Median output tokens: 2615.0.

## Assessment diagnostics

Model responses captured for diagnostics: 15 of 15 fixtures.

Harness canonical validations passed: 6.

Diagnostic capture failures: 0.

Unknown totals include supplied candidate unknowns plus model-declared assessment unknowns; limitation totals are the supplied candidate limitation catalog hydrated by validation.

### Domain issue categories

| Category                                   | Calls | Occurrences |
| ------------------------------------------ | ----: | ----------: |
| domain.exchange.constraint-reference       |     1 |           1 |
| domain.exchange.maximum-results            |     3 |           3 |
| domain.hard-resolution.inference-grounding |     1 |           5 |
| domain.outcome.disposition                 |     2 |           2 |
| domain.ranking.candidate                   |     2 |           4 |
| domain.reference.candidate-ownership       |     1 |           3 |
| domain.reference.catalog-coverage          |     5 |           5 |
| domain.reference.duplicate-id              |     1 |           5 |
| domain.reference.unknown-claim             |     1 |           5 |

### Disposition totals

| Disposition           | Count |
| --------------------- | ----: |
| recommended           |     1 |
| viable                |     8 |
| rejected              |     5 |
| insufficient-evidence |    61 |

### Hard-resolution state totals

| State      | Count |
| ---------- | ----: |
| satisfied  |    68 |
| conflict   |     1 |
| unresolved |   151 |

### Declared catalog totals

| Catalog     | Count |
| ----------- | ----: |
| inferences  |    74 |
| claims      |    61 |
| unknowns    |   246 |
| limitations |     9 |
| conflicts   |     1 |

Fixtures with any satisfied hard resolution: 8.

Candidates with any satisfied hard resolution: 39.

Fixtures with a rejected disposition on a declared conflict: 1.

Candidates with a rejected disposition on a declared conflict: 1.

### Per-fixture diagnostic totals

| Fixture                                        | Response | Validation | Domain issues | Dispositions                                                 | Resolutions                             | Catalogs                                                          | Any satisfied | Rejected conflict |
| ---------------------------------------------- | -------- | ---------- | ------------: | ------------------------------------------------------------ | --------------------------------------- | ----------------------------------------------------------------- | ------------- | ----------------- |
| authorization-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=5, conflict=0, unresolved=5   | inferences=5, claims=5, unknowns=16, limitations=3, conflicts=0   | yes           | no                |
| authorization-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=5   | inferences=0, claims=0, unknowns=12, limitations=3, conflicts=0   | no            | no                |
| authorization-next-selfhosted-drizzle          | captured | failed     |             5 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=5, conflict=0, unresolved=15  | inferences=10, claims=10, unknowns=14, limitations=3, conflicts=0 | yes           | no                |
| audit-logging-next-vercel-drizzle              | captured | failed     |             1 | recommended=0, viable=0, rejected=4, insufficient-evidence=1 | satisfied=12, conflict=0, unresolved=3  | inferences=13, claims=5, unknowns=19, limitations=0, conflicts=0  | yes           | no                |
| audit-logging-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10  | inferences=0, claims=0, unknowns=16, limitations=0, conflicts=0   | no            | no                |
| audit-logging-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=5, conflict=0, unresolved=20  | inferences=5, claims=5, unknowns=20, limitations=0, conflicts=0   | yes           | no                |
| background-jobs-next-vercel-drizzle            | captured | failed     |             1 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=15  | inferences=0, claims=0, unknowns=18, limitations=0, conflicts=0   | no            | no                |
| background-jobs-express-container-prisma-redis | captured | failed     |             4 | recommended=1, viable=2, rejected=0, insufficient-evidence=2 | satisfied=7, conflict=0, unresolved=3   | inferences=7, claims=8, unknowns=13, limitations=0, conflicts=0   | yes           | no                |
| background-jobs-next-selfhosted-drizzle        | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25  | inferences=0, claims=0, unknowns=18, limitations=0, conflicts=0   | no            | no                |
| rate-limiting-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10  | inferences=0, claims=0, unknowns=19, limitations=0, conflicts=0   | no            | no                |
| rate-limiting-express-container-prisma-redis   | captured | failed     |             7 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=5   | inferences=0, claims=0, unknowns=15, limitations=0, conflicts=0   | no            | no                |
| rate-limiting-next-selfhosted-drizzle          | captured | failed     |             1 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=20  | inferences=0, claims=0, unknowns=15, limitations=0, conflicts=0   | no            | no                |
| webhooks-next-vercel-drizzle                   | captured | failed     |            12 | recommended=0, viable=1, rejected=1, insufficient-evidence=3 | satisfied=11, conflict=1, unresolved=3  | inferences=12, claims=3, unknowns=18, limitations=0, conflicts=1  | yes           | yes               |
| webhooks-express-container-prisma-redis        | captured | failed     |             1 | recommended=0, viable=5, rejected=0, insufficient-evidence=0 | satisfied=10, conflict=0, unresolved=0  | inferences=10, claims=15, unknowns=13, limitations=0, conflicts=0 | yes           | no                |
| webhooks-next-selfhosted-drizzle               | captured | failed     |             1 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=13, conflict=0, unresolved=12 | inferences=12, claims=10, unknowns=20, limitations=0, conflicts=0 | yes           | no                |

## Failure categories

| Category                    | Calls | Occurrences |
| --------------------------- | ----: | ----------: |
| invalid-target-fit-response |     9 |           9 |
