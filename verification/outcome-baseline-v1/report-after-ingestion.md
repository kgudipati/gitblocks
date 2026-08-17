# Outcome baseline v1 after ingestion

Reproduce the outcome measurement from the repository root with
`pnpm outcome:baseline:v1` after the recorded ingestion and artifact collection.

This report contains no request prose, candidate names in outcome sections, or
model output text.

## 1. Artifact collection

- Candidates attempted: 149
- Candidates succeeded: 147
- Candidates skipped: 2
- Candidates excluded before artifact collection: 1 (`webhook-mux-node`)
- GitHub requests: 1,170
- npm requests: 0
- Receipt digest:
  `045ce68a0ce5dc0912354a6a109264c574c5847b3b53a1f6c5dfc6efc294a3f8`
- Receipt validation: valid
- Wall-clock duration: 5 minutes 12.158 seconds

| Candidate ID | Error code                     | Cause                                                                 |
| ------------ | ------------------------------ | --------------------------------------------------------------------- |
| jobs-hatchet | `ingestion.provider-not-found` | The required selected documentation path returned provider not-found. |
| jobs-kestra  | `ingestion.provider-response`  | Root README/tree metadata failed deterministic response validation.   |

The excluded candidate failed live ingestion because catalog repository
`muxinc/mux-node-sdk` resolves to canonical repository `muxinc/mux-ts`, a
repository rename with no owner transfer. Catalog authority was not modified.

## 2. Database state after collection

| Metric                                                             | Count |
| ------------------------------------------------------------------ | ----: |
| `repository_artifacts`                                             |   177 |
| `repository_artifact_chunks`                                       |   402 |
| `repository_artifact_sets`                                         |   148 |
| `repository_artifact_set_entries`                                  |   177 |
| `evidence_observations`                                            | 1,238 |
| Repository-head `git-commit` observations                          |   149 |
| Of 149 ingested candidates with exactly one repository-head commit |   149 |

## 3. Outcome baseline after ingestion

### Aggregate outcome counts

| Outcome                | Count |
| ---------------------- | ----: |
| clarification-required |     0 |
| unsupported            |     0 |
| insufficient-evidence  |     0 |
| no-viable-candidate    |     0 |
| recommend              |     0 |
| failed                 |    15 |

### Outcome counts by capability family

| Capability family | clarification-required | unsupported | insufficient-evidence | no-viable-candidate | recommend | failed |
| ----------------- | ---------------------: | ----------: | --------------------: | ------------------: | --------: | -----: |
| authorization     |                      0 |           0 |                     0 |                   0 |         0 |      3 |
| audit-logging     |                      0 |           0 |                     0 |                   0 |         0 |      3 |
| background-jobs   |                      0 |           0 |                     0 |                   0 |         0 |      3 |
| rate-limiting     |                      0 |           0 |                     0 |                   0 |         0 |      3 |
| webhooks          |                      0 |           0 |                     0 |                   0 |         0 |      3 |

### Non-recommend outcomes

| Fixture                                        | Outcome | Producing stage                     | Reason                      |
| ---------------------------------------------- | ------- | ----------------------------------- | --------------------------- |
| authorization-next-vercel-drizzle              | failed  | deterministic assessment validation | invalid-target-fit-response |
| authorization-express-container-prisma-redis   | failed  | model invocation                    | fit-model-failed            |
| authorization-next-selfhosted-drizzle          | failed  | model invocation                    | fit-model-failed            |
| audit-logging-next-vercel-drizzle              | failed  | model invocation                    | fit-model-failed            |
| audit-logging-express-container-prisma-redis   | failed  | model invocation                    | fit-model-failed            |
| audit-logging-next-selfhosted-drizzle          | failed  | model invocation                    | fit-model-failed            |
| background-jobs-next-vercel-drizzle            | failed  | model invocation                    | fit-model-failed            |
| background-jobs-express-container-prisma-redis | failed  | model invocation                    | fit-model-failed            |
| background-jobs-next-selfhosted-drizzle        | failed  | model invocation                    | fit-model-failed            |
| rate-limiting-next-vercel-drizzle              | failed  | model invocation                    | fit-model-failed            |
| rate-limiting-express-container-prisma-redis   | failed  | model invocation                    | fit-model-failed            |
| rate-limiting-next-selfhosted-drizzle          | failed  | model invocation                    | fit-model-failed            |
| webhooks-next-vercel-drizzle                   | failed  | deterministic assessment validation | invalid-target-fit-response |
| webhooks-express-container-prisma-redis        | failed  | model invocation                    | fit-model-failed            |
| webhooks-next-selfhosted-drizzle               | failed  | model invocation                    | fit-model-failed            |

### Insufficient-evidence detail

No insufficient-evidence outcomes remain.

### Recommend detail

No recommend outcomes. Therefore there are no option counts or
eligible-versus-evidence-needed lane counts to report.

### Model calls

Total model calls made: 15.

## 4. Before/after comparison

| Outcome                | Before ingestion | After ingestion |
| ---------------------- | ---------------: | --------------: |
| clarification-required |                0 |               0 |
| unsupported            |                0 |               0 |
| insufficient-evidence  |               15 |               0 |
| no-viable-candidate    |                0 |               0 |
| recommend              |                0 |               0 |
| failed                 |                0 |              15 |
| Total model calls      |                0 |              15 |

## 5. Verification

`pnpm verify` failed at the repository invariant check after formatting, builds,
lint, typechecks, 2,119 tests, and architecture passed. The check classified
three already-tracked baseline target package manifests as
`repository.prohibited-artifact`:

- `evals/outcome-baseline-v1/targets/express-container-prisma-redis/package.json`
- `evals/outcome-baseline-v1/targets/next-selfhosted-drizzle/package.json`
- `evals/outcome-baseline-v1/targets/next-vercel-drizzle/package.json`

Later verification gates did not run. No workaround or authority change was
attempted.

No product code, contract, catalog authority, profile authority, fixture, or
baseline harness file was modified. The original before-ingestion report remains
at `verification/outcome-baseline-v1/report.md`; this after-ingestion report is
the only tracked file added.
