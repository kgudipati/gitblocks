# Outcome baseline v1

Reproduce from the repository root with `pnpm outcome:baseline:v1`.

This report contains no request prose, candidate display names, or model output text.

## Aggregate outcome counts

| Outcome                | Count |
| ---------------------- | ----: |
| clarification-required |     0 |
| unsupported            |     0 |
| insufficient-evidence  |    11 |
| no-viable-candidate    |     0 |
| recommend              |     0 |
| failed                 |     4 |

## Outcome counts by capability family

| Capability family | clarification-required | unsupported | insufficient-evidence | no-viable-candidate | recommend | failed |
| ----------------- | ---------------------: | ----------: | --------------------: | ------------------: | --------: | -----: |
| authorization     |                      0 |           0 |                     1 |                   0 |         0 |      2 |
| audit-logging     |                      0 |           0 |                     2 |                   0 |         0 |      1 |
| background-jobs   |                      0 |           0 |                     2 |                   0 |         0 |      1 |
| rate-limiting     |                      0 |           0 |                     3 |                   0 |         0 |      0 |
| webhooks          |                      0 |           0 |                     3 |                   0 |         0 |      0 |

## Non-recommend outcomes

| Fixture                                        | Outcome               | Producing stage                     | Reason                               |
| ---------------------------------------------- | --------------------- | ----------------------------------- | ------------------------------------ |
| authorization-next-vercel-drizzle              | failed                | deterministic assessment validation | invalid-target-fit-response          |
| authorization-express-container-prisma-redis   | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| authorization-next-selfhosted-drizzle          | failed                | deterministic assessment validation | invalid-target-fit-response          |
| audit-logging-next-vercel-drizzle              | failed                | deterministic assessment validation | invalid-target-fit-response          |
| audit-logging-express-container-prisma-redis   | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| audit-logging-next-selfhosted-drizzle          | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| background-jobs-next-vercel-drizzle            | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| background-jobs-express-container-prisma-redis | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| background-jobs-next-selfhosted-drizzle        | failed                | deterministic assessment validation | invalid-target-fit-response          |
| rate-limiting-next-vercel-drizzle              | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| rate-limiting-express-container-prisma-redis   | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| rate-limiting-next-selfhosted-drizzle          | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| webhooks-next-vercel-drizzle                   | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| webhooks-express-container-prisma-redis        | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| webhooks-next-selfhosted-drizzle               | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |

## Insufficient-evidence detail

| Fixture                                        | Unresolved hard evaluations per finalist | Artifact excerpt available per finalist |
| ---------------------------------------------- | ---------------------------------------- | --------------------------------------- |
| authorization-express-container-prisma-redis   | [1, 1, 1, 1, 1]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-express-container-prisma-redis   | [2, 2, 2, 2, 2]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-next-selfhosted-drizzle          | [5, 5, 5, 5, 5]                          | [yes, yes, yes, yes, yes]               |
| background-jobs-next-vercel-drizzle            | [3, 3, 3, 3, 3]                          | [yes, yes, yes, yes, yes]               |
| background-jobs-express-container-prisma-redis | [2, 2, 2, 2, 2]                          | [yes, yes, yes, yes, yes]               |
| rate-limiting-next-vercel-drizzle              | [2, 2, 2, 2, 2]                          | [yes, yes, yes, yes, yes]               |
| rate-limiting-express-container-prisma-redis   | [1, 1, 1, 1, 1]                          | [yes, no, yes, no, yes]                 |
| rate-limiting-next-selfhosted-drizzle          | [4, 4, 4, 4, 4]                          | [yes, yes, yes, yes, yes]               |
| webhooks-next-vercel-drizzle                   | [3, 3, 3, 3, 3]                          | [yes, yes, yes, yes, yes]               |
| webhooks-express-container-prisma-redis        | [2, 2, 2, 2, 2]                          | [yes, yes, yes, yes, yes]               |
| webhooks-next-selfhosted-drizzle               | [5, 5, 5, 5, 5]                          | [yes, yes, yes, yes, yes]               |

## Recommend detail

No recommend outcomes.

## Model calls

Total model calls made: 15.

Completed model calls: 15.

Deterministically valid responses: 11.

Median completed-call latency: 9388.4 ms.

Maximum completed-call latency: 16209.8 ms.

Median output tokens: 1963.0.

## Assessment diagnostics

Model responses captured for diagnostics: 15 of 15 fixtures.

Harness canonical validations passed: 11.

Diagnostic capture failures: 0.

Unknown totals include supplied candidate unknowns plus model-declared assessment unknowns; limitation totals are the supplied candidate limitation catalog hydrated by validation.

### Domain issue categories

| Category                                   | Calls | Occurrences |
| ------------------------------------------ | ----: | ----------: |
| domain.disposition.support                 |     1 |           1 |
| domain.exchange.constraint-reference       |     1 |           1 |
| domain.hard-resolution.inference-grounding |     1 |           7 |
| domain.reference.candidate-set             |     1 |           1 |
| domain.reference.catalog-coverage          |     2 |           3 |
| domain.reference.duplicate-id              |     1 |           2 |

### Disposition totals

| Disposition           | Count |
| --------------------- | ----: |
| recommended           |     1 |
| viable                |     4 |
| rejected              |     1 |
| insufficient-evidence |    66 |

### Hard-resolution state totals

| State      | Count |
| ---------- | ----: |
| satisfied  |    19 |
| conflict   |     1 |
| unresolved |   188 |

### Declared catalog totals

| Catalog     | Count |
| ----------- | ----: |
| inferences  |    48 |
| claims      |     8 |
| unknowns    |   241 |
| limitations |     9 |
| conflicts   |     1 |

Fixtures with any satisfied hard resolution: 3.

Candidates with any satisfied hard resolution: 11.

Fixtures with a rejected disposition on a declared conflict: 1.

Candidates with a rejected disposition on a declared conflict: 1.

### Per-fixture diagnostic totals

| Fixture                                        | Response | Validation | Domain issues | Dispositions                                                 | Resolutions                            | Catalogs                                                         | Any satisfied | Rejected conflict |
| ---------------------------------------------- | -------- | ---------- | ------------: | ------------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------- | ------------- | ----------------- |
| authorization-next-vercel-drizzle              | captured | failed     |             1 | recommended=1, viable=4, rejected=0, insufficient-evidence=0 | satisfied=10, conflict=0, unresolved=0 | inferences=10, claims=5, unknowns=16, limitations=3, conflicts=0 | yes           | no                |
| authorization-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=5  | inferences=0, claims=0, unknowns=12, limitations=3, conflicts=0  | no            | no                |
| authorization-next-selfhosted-drizzle          | captured | failed     |             6 | recommended=0, viable=0, rejected=1, insufficient-evidence=1 | satisfied=2, conflict=1, unresolved=5  | inferences=8, claims=3, unknowns=12, limitations=3, conflicts=1  | yes           | yes               |
| audit-logging-next-vercel-drizzle              | captured | failed     |             7 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=7, conflict=0, unresolved=8  | inferences=6, claims=0, unknowns=16, limitations=0, conflicts=0  | yes           | no                |
| audit-logging-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10 | inferences=0, claims=0, unknowns=17, limitations=0, conflicts=0  | no            | no                |
| audit-logging-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25 | inferences=0, claims=0, unknowns=20, limitations=0, conflicts=0  | no            | no                |
| background-jobs-next-vercel-drizzle            | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=15 | inferences=5, claims=0, unknowns=18, limitations=0, conflicts=0  | no            | no                |
| background-jobs-express-container-prisma-redis | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10 | inferences=0, claims=0, unknowns=13, limitations=0, conflicts=0  | no            | no                |
| background-jobs-next-selfhosted-drizzle        | captured | failed     |             1 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25 | inferences=5, claims=0, unknowns=18, limitations=0, conflicts=0  | no            | no                |
| rate-limiting-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10 | inferences=0, claims=0, unknowns=16, limitations=0, conflicts=0  | no            | no                |
| rate-limiting-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=5  | inferences=0, claims=0, unknowns=17, limitations=0, conflicts=0  | no            | no                |
| rate-limiting-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=20 | inferences=0, claims=0, unknowns=18, limitations=0, conflicts=0  | no            | no                |
| webhooks-next-vercel-drizzle                   | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=15 | inferences=0, claims=0, unknowns=16, limitations=0, conflicts=0  | no            | no                |
| webhooks-express-container-prisma-redis        | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10 | inferences=9, claims=0, unknowns=16, limitations=0, conflicts=0  | no            | no                |
| webhooks-next-selfhosted-drizzle               | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25 | inferences=5, claims=0, unknowns=16, limitations=0, conflicts=0  | no            | no                |

## Failure categories

| Category                    | Calls | Occurrences |
| --------------------------- | ----: | ----------: |
| invalid-target-fit-response |     4 |           4 |
