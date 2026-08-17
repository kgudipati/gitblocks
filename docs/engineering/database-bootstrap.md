# Local ephemeral database bootstrap

## Status and scope

This is the database bootstrap path exercised for issue #56. It is only for an
explicitly ephemeral, non-production PostgreSQL 18.4 database whose name ends
in `_test`. It does not describe or authorize a durable or production rollout.

The current working path is:

1. create a fresh `_test` database;
2. apply the complete checked migration inventory;
3. bootstrap the accepted catalog, profile, and retrieval-metadata authorities
   into one coherent serving snapshot;
4. run the database invariant check; and
5. compare the durable counts with the committed catalog authority.

The standalone `catalog:seed` command cannot currently sit between migrations
`0004` and `0005`. The exact failed invocation and the conflicting guards are
recorded below. The successful `serving:bootstrap` operation performs the
catalog candidate and capability-family writes before publishing the serving
snapshot.

No ingestion, provider collection, artifact collection, repository interview,
or hosted application process is part of this path.

## Prerequisites

- Run from the repository root with the repository-pinned Node 24.18.0 and pnpm
  11.17.0 runtimes.
- Dependencies must already be installed under the repository's lockfile and
  supply-chain controls.
- PostgreSQL must report version 18.4.
- The operator connection must be able to create the isolated database and the
  cluster roles declared by the checked migrations.
- Keep all credentials injected. Do not place a password, connection string,
  or endpoint value in this document or in shell history.

The exercised database name was `gitblocks_issue_56_test`.

## Environment used

The local connection fields below were derived in memory from the already
injected local `DATABASE_URL`; no connection string or credential was written
to disk or printed. Set the same named variables in the process that invokes
each pnpm command.

| Command                    | Variable                                  | Exercised value or source                     |
| -------------------------- | ----------------------------------------- | --------------------------------------------- |
| `db:migrate`, `db:check`   | `GITBLOCKS_DB_TEST_ACK`                   | `ephemeral`                                   |
| `db:migrate`, `db:check`   | `GITBLOCKS_TEST_DB_HOST`                  | injected local host                           |
| `db:migrate`, `db:check`   | `GITBLOCKS_TEST_DB_PORT`                  | injected local port                           |
| `db:migrate`, `db:check`   | `GITBLOCKS_TEST_DB_DATABASE`              | `gitblocks_issue_56_test`                     |
| `db:migrate`, `db:check`   | `GITBLOCKS_TEST_DB_OWNER`                 | injected local owner                          |
| `db:migrate`, `db:check`   | `GITBLOCKS_TEST_DB_PASSWORD`              | injected secret                               |
| standalone seed diagnostic | `GITBLOCKS_CATALOG_SEED_ACKNOWLEDGEMENT`  | `approved-non-production-public-catalog-seed` |
| standalone seed diagnostic | `GITBLOCKS_CATALOG_SEED_DB_SCOPE`         | `ephemeral-non-production`                    |
| standalone seed diagnostic | `GITBLOCKS_CATALOG_SEED_DB_HOST`          | injected local host                           |
| standalone seed diagnostic | `GITBLOCKS_CATALOG_SEED_DB_PORT`          | injected local port                           |
| standalone seed diagnostic | `GITBLOCKS_CATALOG_SEED_DB_DATABASE`      | `gitblocks_issue_56_test`                     |
| standalone seed diagnostic | `GITBLOCKS_CATALOG_SEED_DB_USERNAME`      | injected local owner                          |
| standalone seed diagnostic | `GITBLOCKS_CATALOG_SEED_DB_PASSWORD`      | injected secret                               |
| standalone seed diagnostic | `GITBLOCKS_CATALOG_SEED_DB_SSL`           | `false`                                       |
| `serving:bootstrap`        | `GITBLOCKS_SERVING_BOOTSTRAP_DB_HOST`     | injected local host                           |
| `serving:bootstrap`        | `GITBLOCKS_SERVING_BOOTSTRAP_DB_PORT`     | injected local port                           |
| `serving:bootstrap`        | `GITBLOCKS_SERVING_BOOTSTRAP_DB_DATABASE` | `gitblocks_issue_56_test`                     |
| `serving:bootstrap`        | `GITBLOCKS_SERVING_BOOTSTRAP_DB_USERNAME` | injected local owner                          |
| `serving:bootstrap`        | `GITBLOCKS_SERVING_BOOTSTRAP_DB_PASSWORD` | injected secret                               |
| `serving:bootstrap`        | `GITBLOCKS_SERVING_BOOTSTRAP_DB_SSL`      | `false`                                       |

## Commands actually exercised

### 1. Create the isolated database

The following command was run against the injected local administrative
connection. It emits and executes `CREATE DATABASE` only when the exact database
does not already exist.

```shell
psql "$DATABASE_URL" -X --no-psqlrc -v ON_ERROR_STOP=1 -Atc \
  "select pg_catalog.format('create database %I', 'gitblocks_issue_56_test') where not exists (select 1 from pg_catalog.pg_database where datname = 'gitblocks_issue_56_test')" \
  | psql "$DATABASE_URL" -X --no-psqlrc -v ON_ERROR_STOP=1
```

Observed output:

```text
CREATE DATABASE
```

The remaining commands received the environment variables listed above.

### 2. Apply the complete migration inventory

```shell
pnpm db:migrate
```

Observed terminal result:

```text
Database migrations applied (18.4 (Debian 18.4-1.pgdg13+1); 7 migration).
```

This creates the `gitblocks_persistence` and `gitblocks_serving` `NOLOGIN`
groups as part of the checked migrations. There is no separate serving-role
command in the repository.

### 3. Record the standalone catalog-seed boundary

This exact command was run with its required acknowledgement, database-scope,
discrete database, and SSL variables:

```shell
pnpm catalog:seed -- --catalog catalog/public-v1/manifest.json
```

It failed before catalog writes:

```text
Catalog seed failed.
[ELIFECYCLE] Command failed with exit code 1.
```

This is not a successful bootstrap step and must not be bypassed. In the current
source, `verifyMigrations` accepts only the complete seven-migration inventory,
while this command subsequently accepts only migration `0004`. There is no
supported partial target for `pnpm db:migrate`. Consequently there is no valid
current invocation for the requested `0001`-`0004` seed point.

### 4. Publish and select the coherent serving snapshot

```shell
pnpm serving:bootstrap -- \
  --catalog catalog/public-v1/manifest.json \
  --profiles catalog/public-v1/candidate-profile-authority.json \
  --metadata catalog/public-v1/candidate-retrieval-metadata-authority.json \
  --published-at 2026-08-11T18:00:00.000Z
```

Observed result:

```json
{ "candidateCount": 150, "catalogDigest": "4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634", "catalogVersion": "public-v1", "databaseMigrationVersion": 7, "publicationStatus": "created", "publishedAt": "2026-08-11T18:00:00.000Z", "schemaVersion": "1.0.0", "snapshotId": "serving-6fb3890c53261a7f68ab8b1db20c6d9da9169ecc0f2510dc", "snapshotRecordDigest": "0f7c5730dfe00de6098316b809ec4d7eef533677960280ddd7695befde7a90e5", "status": "serving-catalog-bootstrap-complete" }
```

The operation validates all three committed authorities, writes the 150
candidate identity/family records idempotently, writes 150 profile records and
150 retrieval-metadata records, closes the immutable snapshot, and selects it
as current.

### 5. Check the database invariants

```shell
pnpm db:check
```

Observed terminal result:

```text
Database check passed (18.4 (Debian 18.4-1.pgdg13+1); 7 migration; 29 public product tables; 0 RLS policies).
```

### 6. Validate the committed catalog authority

```shell
pnpm catalog:validate
```

Observed terminal result:

```text
Public catalog valid (150 candidates; {"authorization":30,"audit-logging":30,"background-jobs":30,"rate-limiting":30,"webhooks":30}; 4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634).
```

## Database verification queries and evidence

The following statements were run through the authenticated connection to
`gitblocks_issue_56_test` after `db:check` passed:

```sql
select version, name, checksum
from gitblocks.schema_migrations
order by version;

select 'candidate_count' as metric, pg_catalog.count(*)::text as value
from gitblocks.catalog_candidates
union all
select 'family_assignment_count', pg_catalog.count(*)::text
from gitblocks.candidate_capability_families;

select
  capability_family,
  pg_catalog.count(distinct candidate_id)::integer as candidate_count
from gitblocks.candidate_capability_families
group by capability_family
order by capability_family;

select
  snapshot.snapshot_id,
  snapshot.candidate_count,
  pg_catalog.count(distinct profile.candidate_id)::integer as profile_count,
  pg_catalog.count(distinct metadata.candidate_id)::integer as metadata_count
from gitblocks.serving_catalog_current_snapshot as current
join gitblocks.serving_catalog_snapshots as snapshot
  on snapshot.snapshot_id = current.snapshot_id
left join gitblocks.serving_candidate_profile_records as profile
  on profile.snapshot_id = snapshot.snapshot_id
left join gitblocks.serving_candidate_retrieval_metadata_records as metadata
  on metadata.snapshot_id = snapshot.snapshot_id
group by snapshot.snapshot_id, snapshot.candidate_count;
```

Applied inventory:

| Version | Name                             | Checksum                                                           |
| ------: | -------------------------------- | ------------------------------------------------------------------ |
|       1 | `evidence-persistence`           | `569d7a6d6db70b1b04cadfa8798516ce4239b1179bb2f7cdd84b27641e33755f` |
|       2 | `runtime-migration-verification` | `b61cf8ad8673663c646b77e8f0ebed452898aab795aa64f52217e1271e1dc2ae` |
|       3 | `immutable-repository-artifacts` | `0ea1e4698e8eec6d33320df7af4758ae6b3b4fcbe3da387bb042d074b86228dc` |
|       4 | `repository-interviews`          | `2cd18e7d92373215b2a540cdf12e32a7e949bfb01866616e8a44ad326e45bca0` |
|       5 | `retrieval-serving`              | `40359c6dbeaf87ee88f8d46b910f851a74c3155243ca9fa67941620eb253e448` |
|       6 | `finalist-evidence-serving`      | `05575971fe03bea06bbd6736b15f68f98c137cf903816bbb8689e843481c70db` |
|       7 | `artifact-evidence-serving`      | `c5cb5fcc522b25335b1c927b62ad80133bdf99ffe0c065d759cd3059880c5903` |

Durable counts matched the authority:

| Metric                                      | Count |
| ------------------------------------------- | ----: |
| Catalog candidates                          |   150 |
| Capability-family assignments               |   150 |
| Authorization candidates                    |    30 |
| Audit-logging candidates                    |    30 |
| Background-jobs candidates                  |    30 |
| Rate-limiting candidates                    |    30 |
| Webhooks candidates                         |    30 |
| Current snapshot candidates                 |   150 |
| Current snapshot profile records            |   150 |
| Current snapshot retrieval-metadata records |   150 |

## Production status

Do not reuse this procedure against a durable database. The exact blockers and
required change categories are recorded in
`docs/engineering/production-bootstrap-gap.md`.
