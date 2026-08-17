# Outcome baseline v1

Reproduce from the repository root with `pnpm outcome:baseline:v1`.

This report contains no request prose, candidate names, or model output text.

## Aggregate outcome counts

| Outcome                | Count |
| ---------------------- | ----: |
| clarification-required |     0 |
| unsupported            |     0 |
| insufficient-evidence  |    15 |
| no-viable-candidate    |     0 |
| recommend              |     0 |
| failed                 |     0 |

## Outcome counts by capability family

| Capability family | clarification-required | unsupported | insufficient-evidence | no-viable-candidate | recommend | failed |
| ----------------- | ---------------------: | ----------: | --------------------: | ------------------: | --------: | -----: |
| authorization     |                      0 |           0 |                     3 |                   0 |         0 |      0 |
| audit-logging     |                      0 |           0 |                     3 |                   0 |         0 |      0 |
| background-jobs   |                      0 |           0 |                     3 |                   0 |         0 |      0 |
| rate-limiting     |                      0 |           0 |                     3 |                   0 |         0 |      0 |
| webhooks          |                      0 |           0 |                     3 |                   0 |         0 |      0 |

## Non-recommend outcomes

| Fixture                                        | Outcome               | Producing stage             | Reason                         |
| ---------------------------------------------- | --------------------- | --------------------------- | ------------------------------ |
| authorization-next-vercel-drizzle              | insufficient-evidence | artifact evidence selection | no-positive-candidate-evidence |
| authorization-express-container-prisma-redis   | insufficient-evidence | artifact evidence selection | no-positive-candidate-evidence |
| authorization-next-selfhosted-drizzle          | insufficient-evidence | artifact evidence selection | no-positive-candidate-evidence |
| audit-logging-next-vercel-drizzle              | insufficient-evidence | artifact evidence selection | no-positive-candidate-evidence |
| audit-logging-express-container-prisma-redis   | insufficient-evidence | artifact evidence selection | no-positive-candidate-evidence |
| audit-logging-next-selfhosted-drizzle          | insufficient-evidence | artifact evidence selection | no-positive-candidate-evidence |
| background-jobs-next-vercel-drizzle            | insufficient-evidence | artifact evidence selection | no-positive-candidate-evidence |
| background-jobs-express-container-prisma-redis | insufficient-evidence | artifact evidence selection | no-positive-candidate-evidence |
| background-jobs-next-selfhosted-drizzle        | insufficient-evidence | artifact evidence selection | no-positive-candidate-evidence |
| rate-limiting-next-vercel-drizzle              | insufficient-evidence | artifact evidence selection | no-positive-candidate-evidence |
| rate-limiting-express-container-prisma-redis   | insufficient-evidence | artifact evidence selection | no-positive-candidate-evidence |
| rate-limiting-next-selfhosted-drizzle          | insufficient-evidence | artifact evidence selection | no-positive-candidate-evidence |
| webhooks-next-vercel-drizzle                   | insufficient-evidence | artifact evidence selection | no-positive-candidate-evidence |
| webhooks-express-container-prisma-redis        | insufficient-evidence | artifact evidence selection | no-positive-candidate-evidence |
| webhooks-next-selfhosted-drizzle               | insufficient-evidence | artifact evidence selection | no-positive-candidate-evidence |

## Insufficient-evidence detail

| Fixture                                        | Unresolved hard evaluations per finalist | Artifact excerpt available per finalist |
| ---------------------------------------------- | ---------------------------------------- | --------------------------------------- |
| authorization-next-vercel-drizzle              | [4, 4, 4, 4, 4]                          | [no, no, no, no, no]                    |
| authorization-express-container-prisma-redis   | [2, 2, 2, 2, 2]                          | [no, no, no, no, no]                    |
| authorization-next-selfhosted-drizzle          | [8, 8, 8, 8, 8]                          | [no, no, no, no, no]                    |
| audit-logging-next-vercel-drizzle              | [6, 6, 6, 6, 6]                          | [no, no, no, no, no]                    |
| audit-logging-express-container-prisma-redis   | [4, 4, 4, 4, 4]                          | [no, no, no, no, no]                    |
| audit-logging-next-selfhosted-drizzle          | [10, 10, 10, 10, 10]                     | [no, no, no, no, no]                    |
| background-jobs-next-vercel-drizzle            | [6, 6, 6, 6, 6]                          | [no, no, no, no, no]                    |
| background-jobs-express-container-prisma-redis | [4, 4, 4, 4, 4]                          | [no, no, no, no, no]                    |
| background-jobs-next-selfhosted-drizzle        | [10, 10, 10, 10, 10]                     | [no, no, no, no, no]                    |
| rate-limiting-next-vercel-drizzle              | [4, 4, 4, 4, 4]                          | [no, no, no, no, no]                    |
| rate-limiting-express-container-prisma-redis   | [2, 2, 2, 2, 2]                          | [no, no, no, no, no]                    |
| rate-limiting-next-selfhosted-drizzle          | [8, 8, 8, 8, 8]                          | [no, no, no, no, no]                    |
| webhooks-next-vercel-drizzle                   | [6, 6, 6, 6, 6]                          | [no, no, no, no, no]                    |
| webhooks-express-container-prisma-redis        | [4, 4, 4, 4, 4]                          | [no, no, no, no, no]                    |
| webhooks-next-selfhosted-drizzle               | [10, 10, 10, 10, 10]                     | [no, no, no, no, no]                    |

## Recommend detail

No recommend outcomes.

## Model calls

Total model calls made: 0.
