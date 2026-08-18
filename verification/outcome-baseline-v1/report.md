# Outcome baseline v1

Reproduce from the repository root with `pnpm outcome:baseline:v1`.

This report contains no request prose, candidate display names, or model output text.

## Aggregate outcome counts

| Outcome                | Count |
| ---------------------- | ----: |
| clarification-required |     0 |
| unsupported            |     0 |
| insufficient-evidence  |     0 |
| no-viable-candidate    |     0 |
| recommend              |     0 |
| failed                 |    15 |

## Outcome counts by capability family

| Capability family | clarification-required | unsupported | insufficient-evidence | no-viable-candidate | recommend | failed |
| ----------------- | ---------------------: | ----------: | --------------------: | ------------------: | --------: | -----: |
| authorization     |                      0 |           0 |                     0 |                   0 |         0 |      3 |
| audit-logging     |                      0 |           0 |                     0 |                   0 |         0 |      3 |
| background-jobs   |                      0 |           0 |                     0 |                   0 |         0 |      3 |
| rate-limiting     |                      0 |           0 |                     0 |                   0 |         0 |      3 |
| webhooks          |                      0 |           0 |                     0 |                   0 |         0 |      3 |

## Non-recommend outcomes

| Fixture                                        | Outcome | Producing stage  | Reason           |
| ---------------------------------------------- | ------- | ---------------- | ---------------- |
| authorization-next-vercel-drizzle              | failed  | model invocation | fit-model-failed |
| authorization-express-container-prisma-redis   | failed  | model invocation | fit-model-failed |
| authorization-next-selfhosted-drizzle          | failed  | model invocation | fit-model-failed |
| audit-logging-next-vercel-drizzle              | failed  | model invocation | fit-model-failed |
| audit-logging-express-container-prisma-redis   | failed  | model invocation | fit-model-failed |
| audit-logging-next-selfhosted-drizzle          | failed  | model invocation | fit-model-failed |
| background-jobs-next-vercel-drizzle            | failed  | model invocation | fit-model-failed |
| background-jobs-express-container-prisma-redis | failed  | model invocation | fit-model-failed |
| background-jobs-next-selfhosted-drizzle        | failed  | model invocation | fit-model-failed |
| rate-limiting-next-vercel-drizzle              | failed  | model invocation | fit-model-failed |
| rate-limiting-express-container-prisma-redis   | failed  | model invocation | fit-model-failed |
| rate-limiting-next-selfhosted-drizzle          | failed  | model invocation | fit-model-failed |
| webhooks-next-vercel-drizzle                   | failed  | model invocation | fit-model-failed |
| webhooks-express-container-prisma-redis        | failed  | model invocation | fit-model-failed |
| webhooks-next-selfhosted-drizzle               | failed  | model invocation | fit-model-failed |

## Insufficient-evidence detail

No insufficient-evidence outcomes.

## Recommend detail

No recommend outcomes.

## Model calls

Total model calls made: 15.

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
| unknowns    |   201 |
| limitations |     9 |
| conflicts   |     0 |

Fixtures with any satisfied hard resolution: 0.

Candidates with any satisfied hard resolution: 0.

Fixtures with a rejected disposition on a declared conflict: 0.

Candidates with a rejected disposition on a declared conflict: 0.

### Per-fixture diagnostic totals

| Fixture                                        | Response     | Validation | Domain issues | Dispositions                                                 | Resolutions                           | Catalogs                                                        | Any satisfied | Rejected conflict |
| ---------------------------------------------- | ------------ | ---------- | ------------: | ------------------------------------------------------------ | ------------------------------------- | --------------------------------------------------------------- | ------------- | ----------------- |
| authorization-next-vercel-drizzle              | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=11, limitations=3, conflicts=0 | no            | no                |
| authorization-express-container-prisma-redis   | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=11, limitations=3, conflicts=0 | no            | no                |
| authorization-next-selfhosted-drizzle          | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=11, limitations=3, conflicts=0 | no            | no                |
| audit-logging-next-vercel-drizzle              | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=15, limitations=0, conflicts=0 | no            | no                |
| audit-logging-express-container-prisma-redis   | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=15, limitations=0, conflicts=0 | no            | no                |
| audit-logging-next-selfhosted-drizzle          | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=15, limitations=0, conflicts=0 | no            | no                |
| background-jobs-next-vercel-drizzle            | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=13, limitations=0, conflicts=0 | no            | no                |
| background-jobs-express-container-prisma-redis | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=12, limitations=0, conflicts=0 | no            | no                |
| background-jobs-next-selfhosted-drizzle        | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=13, limitations=0, conflicts=0 | no            | no                |
| rate-limiting-next-vercel-drizzle              | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=14, limitations=0, conflicts=0 | no            | no                |
| rate-limiting-express-container-prisma-redis   | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=14, limitations=0, conflicts=0 | no            | no                |
| rate-limiting-next-selfhosted-drizzle          | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=14, limitations=0, conflicts=0 | no            | no                |
| webhooks-next-vercel-drizzle                   | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=15, limitations=0, conflicts=0 | no            | no                |
| webhooks-express-container-prisma-redis        | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=13, limitations=0, conflicts=0 | no            | no                |
| webhooks-next-selfhosted-drizzle               | not-produced | not-run    |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=0 | satisfied=0, conflict=0, unresolved=0 | inferences=0, claims=0, unknowns=15, limitations=0, conflicts=0 | no            | no                |

## Failure categories

| Category         | Calls | Occurrences |
| ---------------- | ----: | ----------: |
| fit-model-failed |    15 |          15 |
