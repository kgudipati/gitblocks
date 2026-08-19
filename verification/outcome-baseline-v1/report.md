# Outcome baseline v1

Reproduce from the repository root with `pnpm outcome:baseline:v1`.

This report contains no request prose, candidate display names, or model output text.

## Aggregate outcome counts

| Outcome                | Count |
| ---------------------- | ----: |
| clarification-required |     0 |
| unsupported            |     0 |
| insufficient-evidence  |     8 |
| no-viable-candidate    |     0 |
| recommend              |     0 |
| failed                 |     7 |

## Outcome counts by capability family

| Capability family | clarification-required | unsupported | insufficient-evidence | no-viable-candidate | recommend | failed |
| ----------------- | ---------------------: | ----------: | --------------------: | ------------------: | --------: | -----: |
| authorization     |                      0 |           0 |                     3 |                   0 |         0 |      0 |
| audit-logging     |                      0 |           0 |                     2 |                   0 |         0 |      1 |
| background-jobs   |                      0 |           0 |                     2 |                   0 |         0 |      1 |
| rate-limiting     |                      0 |           0 |                     1 |                   0 |         0 |      2 |
| webhooks          |                      0 |           0 |                     0 |                   0 |         0 |      3 |

## Non-recommend outcomes

| Fixture                                        | Outcome               | Producing stage                     | Reason                               |
| ---------------------------------------------- | --------------------- | ----------------------------------- | ------------------------------------ |
| authorization-next-vercel-drizzle              | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| authorization-express-container-prisma-redis   | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| authorization-next-selfhosted-drizzle          | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| audit-logging-next-vercel-drizzle              | failed                | deterministic assessment validation | invalid-target-fit-response          |
| audit-logging-express-container-prisma-redis   | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| audit-logging-next-selfhosted-drizzle          | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| background-jobs-next-vercel-drizzle            | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| background-jobs-express-container-prisma-redis | failed                | deterministic assessment validation | invalid-target-fit-response          |
| background-jobs-next-selfhosted-drizzle        | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| rate-limiting-next-vercel-drizzle              | failed                | deterministic assessment validation | invalid-target-fit-response          |
| rate-limiting-express-container-prisma-redis   | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| rate-limiting-next-selfhosted-drizzle          | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-next-vercel-drizzle                   | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-express-container-prisma-redis        | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-next-selfhosted-drizzle               | failed                | deterministic assessment validation | invalid-target-fit-response          |

## Insufficient-evidence detail

| Fixture                                      | Unresolved hard evaluations per finalist | Artifact excerpt available per finalist |
| -------------------------------------------- | ---------------------------------------- | --------------------------------------- |
| authorization-next-vercel-drizzle            | [2, 2, 2, 2, 2]                          | [yes, yes, yes, yes, yes]               |
| authorization-express-container-prisma-redis | [1, 1, 1, 1, 1]                          | [yes, yes, yes, yes, yes]               |
| authorization-next-selfhosted-drizzle        | [4, 4, 4, 4, 4]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-express-container-prisma-redis | [2, 2, 2, 2, 2]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-next-selfhosted-drizzle        | [5, 5, 5, 5, 5]                          | [yes, yes, yes, yes, yes]               |
| background-jobs-next-vercel-drizzle          | [3, 3, 3, 3, 3]                          | [yes, yes, yes, yes, yes]               |
| background-jobs-next-selfhosted-drizzle      | [5, 5, 5, 5, 5]                          | [yes, yes, yes, yes, yes]               |
| rate-limiting-express-container-prisma-redis | [1, 1, 1, 1, 1]                          | [yes, no, yes, no, yes]                 |

## Recommend detail

No recommend outcomes.

## Model calls

Total model calls made: 15.

Completed model calls: 15.

Deterministically valid responses: 8.

Median completed-call latency: 13391.3 ms.

Maximum completed-call latency: 24867.9 ms.

Median output tokens: 2558.0.

## Assessment diagnostics

Model responses captured for diagnostics: 15 of 15 fixtures.

Harness canonical validations passed: 8.

Diagnostic capture failures: 0.

Unknown totals include supplied candidate unknowns plus model-declared assessment unknowns; limitation totals are the supplied candidate limitation catalog hydrated by validation.

### Domain issue categories

| Category                                             | Calls | Occurrences |
| ---------------------------------------------------- | ----: | ----------: |
| domain.constraint.disposition                        |     1 |           1 |
| domain.constraint.preservation                       |     2 |           2 |
| domain.hard-resolution.inference-grounding           |     1 |           7 |
| domain.outcome.disposition                           |     1 |           1 |
| domain.recommendation-assessment.surrogate-reference |     2 |           2 |
| domain.reference.catalog-coverage                    |     2 |           2 |
| domain.target-fit.repository-fact-reference          |     1 |           1 |

### Disposition totals

| Disposition           | Count |
| --------------------- | ----: |
| recommended           |     3 |
| viable                |     5 |
| rejected              |     4 |
| insufficient-evidence |    63 |

### Hard-resolution state totals

| State      | Count |
| ---------- | ----: |
| satisfied  |    34 |
| conflict   |     6 |
| unresolved |   180 |

### Declared catalog totals

| Catalog     | Count |
| ----------- | ----: |
| inferences  |    95 |
| claims      |    40 |
| unknowns    |   264 |
| limitations |     9 |
| conflicts   |     5 |

Fixtures with any satisfied hard resolution: 4.

Candidates with any satisfied hard resolution: 18.

Fixtures with a rejected disposition on a declared conflict: 2.

Candidates with a rejected disposition on a declared conflict: 4.

### Per-fixture diagnostic totals

| Fixture                                        | Response | Validation | Domain issues | Dispositions                                                 | Resolutions                             | Catalogs                                                          | Any satisfied | Rejected conflict |
| ---------------------------------------------- | -------- | ---------- | ------------: | ------------------------------------------------------------ | --------------------------------------- | ----------------------------------------------------------------- | ------------- | ----------------- |
| authorization-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10  | inferences=10, claims=10, unknowns=13, limitations=3, conflicts=0 | no            | no                |
| authorization-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=5   | inferences=5, claims=0, unknowns=12, limitations=3, conflicts=0   | no            | no                |
| authorization-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=20  | inferences=10, claims=0, unknowns=16, limitations=3, conflicts=0  | no            | no                |
| audit-logging-next-vercel-drizzle              | captured | failed     |             7 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=7, conflict=0, unresolved=8   | inferences=5, claims=5, unknowns=20, limitations=0, conflicts=0   | yes           | no                |
| audit-logging-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10  | inferences=5, claims=0, unknowns=17, limitations=0, conflicts=0   | no            | no                |
| audit-logging-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25  | inferences=5, claims=0, unknowns=20, limitations=0, conflicts=0   | no            | no                |
| background-jobs-next-vercel-drizzle            | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=15  | inferences=0, claims=0, unknowns=18, limitations=0, conflicts=0   | no            | no                |
| background-jobs-express-container-prisma-redis | captured | failed     |             1 | recommended=3, viable=0, rejected=1, insufficient-evidence=1 | satisfied=7, conflict=2, unresolved=1   | inferences=8, claims=5, unknowns=23, limitations=0, conflicts=1   | yes           | yes               |
| background-jobs-next-selfhosted-drizzle        | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25  | inferences=0, claims=0, unknowns=18, limitations=0, conflicts=0   | no            | no                |
| rate-limiting-next-vercel-drizzle              | captured | failed     |             4 | recommended=0, viable=0, rejected=3, insufficient-evidence=2 | satisfied=0, conflict=4, unresolved=6   | inferences=4, claims=0, unknowns=19, limitations=0, conflicts=4   | no            | yes               |
| rate-limiting-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=5   | inferences=3, claims=0, unknowns=17, limitations=0, conflicts=0   | no            | no                |
| rate-limiting-next-selfhosted-drizzle          | captured | failed     |             1 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=20  | inferences=5, claims=0, unknowns=16, limitations=0, conflicts=0   | no            | no                |
| webhooks-next-vercel-drizzle                   | captured | failed     |             1 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=15  | inferences=5, claims=5, unknowns=16, limitations=0, conflicts=0   | no            | no                |
| webhooks-express-container-prisma-redis        | captured | failed     |             1 | recommended=0, viable=5, rejected=0, insufficient-evidence=0 | satisfied=10, conflict=0, unresolved=0  | inferences=15, claims=5, unknowns=14, limitations=0, conflicts=0  | yes           | no                |
| webhooks-next-selfhosted-drizzle               | captured | failed     |             1 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=10, conflict=0, unresolved=15 | inferences=15, claims=10, unknowns=25, limitations=0, conflicts=0 | yes           | no                |

## Failure categories

| Category                    | Calls | Occurrences |
| --------------------------- | ----: | ----------: |
| invalid-target-fit-response |     7 |           7 |
