# Outcome baseline v1

Reproduce from the repository root with `pnpm outcome:baseline:v1`.

This report contains no request prose, candidate names, or model output text.

## Aggregate outcome counts

| Outcome                | Count |
| ---------------------- | ----: |
| clarification-required |     0 |
| unsupported            |     0 |
| insufficient-evidence  |     9 |
| no-viable-candidate    |     0 |
| recommend              |     0 |
| failed                 |     6 |

## Outcome counts by capability family

| Capability family | clarification-required | unsupported | insufficient-evidence | no-viable-candidate | recommend | failed |
| ----------------- | ---------------------: | ----------: | --------------------: | ------------------: | --------: | -----: |
| authorization     |                      0 |           0 |                     2 |                   0 |         0 |      1 |
| audit-logging     |                      0 |           0 |                     3 |                   0 |         0 |      0 |
| background-jobs   |                      0 |           0 |                     1 |                   0 |         0 |      2 |
| rate-limiting     |                      0 |           0 |                     2 |                   0 |         0 |      1 |
| webhooks          |                      0 |           0 |                     1 |                   0 |         0 |      2 |

## Non-recommend outcomes

| Fixture                                        | Outcome               | Producing stage                     | Reason                               |
| ---------------------------------------------- | --------------------- | ----------------------------------- | ------------------------------------ |
| authorization-next-vercel-drizzle              | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| authorization-express-container-prisma-redis   | failed                | deterministic assessment validation | invalid-target-fit-response          |
| authorization-next-selfhosted-drizzle          | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| audit-logging-next-vercel-drizzle              | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| audit-logging-express-container-prisma-redis   | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| audit-logging-next-selfhosted-drizzle          | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| background-jobs-next-vercel-drizzle            | failed                | deterministic assessment validation | invalid-target-fit-response          |
| background-jobs-express-container-prisma-redis | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| background-jobs-next-selfhosted-drizzle        | failed                | deterministic assessment validation | invalid-target-fit-response          |
| rate-limiting-next-vercel-drizzle              | failed                | deterministic assessment validation | invalid-target-fit-response          |
| rate-limiting-express-container-prisma-redis   | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| rate-limiting-next-selfhosted-drizzle          | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| webhooks-next-vercel-drizzle                   | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| webhooks-express-container-prisma-redis        | failed                | deterministic assessment validation | invalid-target-fit-response          |
| webhooks-next-selfhosted-drizzle               | failed                | deterministic assessment validation | invalid-target-fit-response          |

## Insufficient-evidence detail

| Fixture                                        | Unresolved hard evaluations per finalist | Artifact excerpt available per finalist |
| ---------------------------------------------- | ---------------------------------------- | --------------------------------------- |
| authorization-next-vercel-drizzle              | [1, 1, 1, 1, 1]                          | [yes, yes, yes, yes, yes]               |
| authorization-next-selfhosted-drizzle          | [4, 4, 4, 4, 4]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-next-vercel-drizzle              | [3, 3, 3, 3, 3]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-express-container-prisma-redis   | [2, 2, 2, 2, 2]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-next-selfhosted-drizzle          | [5, 5, 5, 5, 5]                          | [yes, yes, yes, yes, yes]               |
| background-jobs-express-container-prisma-redis | [2, 2, 2, 2, 2]                          | [yes, yes, yes, no, yes]                |
| rate-limiting-express-container-prisma-redis   | [1, 1, 1, 1, 1]                          | [no, no, no, no, no]                    |
| rate-limiting-next-selfhosted-drizzle          | [4, 4, 4, 4, 4]                          | [yes, yes, yes, yes, yes]               |
| webhooks-next-vercel-drizzle                   | [3, 3, 3, 3, 3]                          | [yes, yes, yes, yes, yes]               |

## Recommend detail

No recommend outcomes.

## Model calls

Total model calls made: 15.
