# Outcome baseline v1

This measurement runs 15 `OssRecommendationRequestV1` fixtures through one
startup of the existing hosted composition. It does not seed, migrate, collect,
generate artifacts, or modify the serving snapshot.

Set the PostgreSQL variables recorded by
`docs/engineering/database-bootstrap.md` for the existing ephemeral `_test`
database:

- `GITBLOCKS_SERVING_BOOTSTRAP_DB_HOST`
- `GITBLOCKS_SERVING_BOOTSTRAP_DB_PORT`
- `GITBLOCKS_SERVING_BOOTSTRAP_DB_DATABASE`
- `GITBLOCKS_SERVING_BOOTSTRAP_DB_USERNAME`
- `GITBLOCKS_SERVING_BOOTSTRAP_DB_PASSWORD`
- `GITBLOCKS_SERVING_BOOTSTRAP_DB_SSL=false`

`OPENAI_API_KEY` must also be set. The harness uses the hosted composition's
current fixed fit model.

From the repository root, reproduce the report with:

```shell
pnpm outcome:baseline:v1
```

The command rescans each minimal target project, verifies that every committed
request contains the scanner's exact fingerprint and reference digest, runs the
fixtures sequentially, and replaces
`verification/outcome-baseline-v1/report.md` with content-free aggregate and
per-fixture measurements.

To retain the requested substance from rejected model responses for local
diagnosis, run with:

```shell
GITBLOCKS_OUTCOME_BASELINE_CAPTURE_REJECTED_MODEL_SUBSTANCE=1 pnpm outcome:baseline:v1
```

Each enabled run writes a separate mode-`0600` JSON file beneath the existing
gitignored `logs/outcome-baseline-v1/rejected-model-substance/` directory. The
capture is evaluation-only and is never added to the committed report or the
hosted application response and logging paths.

The committed request files can be regenerated deterministically after an
intentional fixture-definition change with:

```shell
pnpm build:product
node evals/outcome-baseline-v1/run.mjs --write-fixtures
```
