# Outcome baseline v1

Reproduce from the repository root with `pnpm outcome:baseline:v1`.

This report contains no request prose, candidate display names, or model output text.

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
| authorization-next-vercel-drizzle              | [2, 2, 2, 2, 2]                          | [no, no, no, no, no]                    |
| authorization-express-container-prisma-redis   | [1, 1, 1, 1, 1]                          | [no, no, no, no, no]                    |
| authorization-next-selfhosted-drizzle          | [4, 4, 4, 4, 4]                          | [no, no, no, no, no]                    |
| audit-logging-next-vercel-drizzle              | [3, 3, 3, 3, 3]                          | [no, no, no, no, no]                    |
| audit-logging-express-container-prisma-redis   | [2, 2, 2, 2, 2]                          | [no, no, no, no, no]                    |
| audit-logging-next-selfhosted-drizzle          | [5, 5, 5, 5, 5]                          | [no, no, no, no, no]                    |
| background-jobs-next-vercel-drizzle            | [3, 3, 3, 3, 3]                          | [no, no, no, no, no]                    |
| background-jobs-express-container-prisma-redis | [2, 2, 2, 2, 2]                          | [no, no, no, no, no]                    |
| background-jobs-next-selfhosted-drizzle        | [5, 5, 5, 5, 5]                          | [no, no, no, no, no]                    |
| rate-limiting-next-vercel-drizzle              | [2, 2, 2, 2, 2]                          | [no, no, no, no, no]                    |
| rate-limiting-express-container-prisma-redis   | [1, 1, 1, 1, 1]                          | [no, no, no, no, no]                    |
| rate-limiting-next-selfhosted-drizzle          | [4, 4, 4, 4, 4]                          | [no, no, no, no, no]                    |
| webhooks-next-vercel-drizzle                   | [3, 3, 3, 3, 3]                          | [no, no, no, no, no]                    |
| webhooks-express-container-prisma-redis        | [2, 2, 2, 2, 2]                          | [no, no, no, no, no]                    |
| webhooks-next-selfhosted-drizzle               | [5, 5, 5, 5, 5]                          | [no, no, no, no, no]                    |

## Recommend detail

No recommend outcomes.

## Model calls

Total model calls made: 0.

Completed model calls: 0.

Deterministically valid responses: 0.

Median completed-call latency: not recorded.

Maximum completed-call latency: not recorded.

Median output tokens: not recorded.

## Assessment diagnostics

Model responses captured for diagnostics: 0 of 15 fixtures.

Harness canonical validations passed: 0.

Diagnostic capture failures: 0.

Unknown totals include supplied candidate unknowns plus model-declared assessment unknowns; limitation totals are the supplied candidate limitation catalog hydrated by validation.

### Domain issue categories

No domain validation issues.

### Disposition totals

| Disposition           | Count |
| --------------------- | ----: |
| recommended           |     0 |
| viable                |     0 |
| rejected              |     0 |
| insufficient-evidence |     0 |

### Hard-resolution state totals

| State      | Count |
| ---------- | ----: |
| satisfied  |     0 |
| conflict   |     0 |
| unresolved |     0 |

### Declared catalog totals

| Catalog     | Count |
| ----------- | ----: |
| inferences  |     0 |
| claims      |     0 |
| unknowns    |     0 |
| limitations |     0 |
| conflicts   |     0 |

Fixtures with any satisfied hard resolution: 0.

Candidates with any satisfied hard resolution: 0.

Fixtures with a rejected disposition on a declared conflict: 0.

Candidates with a rejected disposition on a declared conflict: 0.

### Per-fixture diagnostic totals

| Fixture                                        | Response     | Validation | Domain issues | Dispositions                                                 | Resolutions                           | Catalogs                                                       | Any satisfied | Rejected conflict |
| ---------------------------------------------- | ------------ | ---------- | ------------: | ------------------------------------------------------------ | ------------------------------------- | -------------------------------------------------------------- | ------------- | ----------------- |
| authorization-next-vercel-drizzle              | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=0, limitations=0, conflicts=0 | no            | no                |
| authorization-express-container-prisma-redis   | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=0, limitations=0, conflicts=0 | no            | no                |
| authorization-next-selfhosted-drizzle          | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=0, limitations=0, conflicts=0 | no            | no                |
| audit-logging-next-vercel-drizzle              | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=0, limitations=0, conflicts=0 | no            | no                |
| audit-logging-express-container-prisma-redis   | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=0, limitations=0, conflicts=0 | no            | no                |
| audit-logging-next-selfhosted-drizzle          | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=0, limitations=0, conflicts=0 | no            | no                |
| background-jobs-next-vercel-drizzle            | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=0, limitations=0, conflicts=0 | no            | no                |
| background-jobs-express-container-prisma-redis | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=0, limitations=0, conflicts=0 | no            | no                |
| background-jobs-next-selfhosted-drizzle        | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=0, limitations=0, conflicts=0 | no            | no                |
| rate-limiting-next-vercel-drizzle              | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=0, limitations=0, conflicts=0 | no            | no                |
| rate-limiting-express-container-prisma-redis   | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=0, limitations=0, conflicts=0 | no            | no                |
| rate-limiting-next-selfhosted-drizzle          | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=0, limitations=0, conflicts=0 | no            | no                |
| webhooks-next-vercel-drizzle                   | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=0, limitations=0, conflicts=0 | no            | no                |
| webhooks-express-container-prisma-redis        | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=0, limitations=0, conflicts=0 | no            | no                |
| webhooks-next-selfhosted-drizzle               | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=0, limitations=0, conflicts=0 | no            | no                |

## Failure categories

No failed calls.
