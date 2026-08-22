# Durable managed PostgreSQL bootstrap

## Scope and authority

Issue #96 authorizes this operator sequence for an already provisioned durable
PostgreSQL database. It does not provision a database, deploy the hosted
application, generate authority files, collect evidence, or run ingestion at
request time. The database must be PostgreSQL major 18 at or above the minimum
validated minor 18.4, and its name must not end in `_test`. The serving
bootstrap accepts 18.4 and newer 18.x minors and rejects older 18.x minors and
every other major.

The 18.4 floor records the oldest minor validated for this production path; no
serving behavior depends on a feature introduced by a particular 18.x minor.
Managed providers apply minor releases without customer consent, so an exact
minor precondition would turn routine provider maintenance into a publication
outage. The exact digest-pinned PostgreSQL 18.4 image remains the reproducible
local verification target; changing that image is a separate reviewed concern.

Run every command from the repository root with the pinned Node and pnpm
runtimes. Inject secrets through the shell or deployment secret store; do not
put a URL or password in command arguments, files, logs, or shell history.

## Configuration boundaries

`pnpm db:migrate` and `pnpm db:check` select exactly one of these boundaries:

| Boundary   | Variables                                                         | Authorization and database rule                                                |
| ---------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| production | `DATABASE_URL`, `GITBLOCKS_DB_PRODUCTION_ACK`                     | acknowledgement is exactly `managed-production`; database does not end `_test` |
| test only  | the five `GITBLOCKS_TEST_DB_*` fields and `GITBLOCKS_DB_TEST_ACK` | acknowledgement is exactly `ephemeral`; database ends `_test`; TLS is off      |

Any variable from both boundaries makes the command fail. A production
acknowledgement is therefore rejected beside test configuration, and a test
acknowledgement is rejected beside production configuration. The test reader
and its five-field, acknowledgement, suffix, and `ssl: false` behavior are
unchanged.

`DATABASE_URL` must be a `postgres://` or `postgresql://` URL containing an
operator username, password, host, optional port, and database path. The port
defaults to PostgreSQL's standard port when omitted. The URL's `sslmode` is
mapped to the pinned Postgres.js mode as follows:

| URL `sslmode` | Effective client mode |
| ------------- | --------------------- |
| absent        | `require`             |
| `disable`     | TLS disabled          |
| `allow`       | `allow`               |
| `prefer`      | `prefer`              |
| `require`     | `require`             |
| `verify-full` | `verify-full`         |

The production default therefore uses TLS. With the pinned driver, `require`,
`allow`, and `prefer` encrypt without certificate/hostname verification;
`verify-full` uses Node's trusted certificate authorities and hostname
verification. An unsupported or repeated `sslmode` is rejected as an invalid
`DATABASE_URL` setting. In particular, do not translate provider vocabulary
to `true`; preserve a supported `sslmode` in the URL. Errors name the missing
or invalid variable but never include the URL, password, or host.

## End-to-end sequence

### 1. Provision the managed database and operator

Provision the database through the provider before running repository
commands. Configure `DATABASE_URL` for a dedicated migration/operator identity
that can own objects in the database, create or inspect the two cluster roles,
and manage membership in `gitblocks_serving`. Configure
`GITBLOCKS_DB_PRODUCTION_ACK` with its exact production acknowledgement.

The provider must also deny DDL inherited through shared grants. The
serving-login verifier checks effective `CREATE` and `TEMPORARY` on the current
database plus `CREATE` on every non-system schema. PostgreSQL commonly grants
database `TEMPORARY` to `PUBLIC`; a database owner must revoke it from `PUBLIC`
for this database before the serving login can pass the no-DDL check. If
`PUBLIC` or another inherited role supplies any checked privilege, a database
owner or provider administrator must revoke that shared grant before the
serving login can verify. Do not transfer database or schema ownership to the
serving login.

### 2. Apply the checked migration inventory

With only `DATABASE_URL` and `GITBLOCKS_DB_PRODUCTION_ACK` configured for the
database command boundary, run:

```shell
pnpm db:migrate
```

The command applies the same seven checksummed forward migrations as the test
path. It creates `gitblocks_persistence` and `gitblocks_serving` as safe
`NOLOGIN` groups and does not change the 29-table schema contract.

### 3. Create or rotate and verify the serving login

Configure these additional variables in the same process:

| Variable                           | Expected form                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| `GITBLOCKS_SERVING_LOGIN_ROLE`     | lowercase PostgreSQL role identifier; not either GitBlocks group or the operator |
| `GITBLOCKS_SERVING_LOGIN_PASSWORD` | injected secret text, 16–4096 characters, with no NUL                            |

Then run:

```shell
pnpm db:serving-login
```

The command serializes role changes, creates the login or rotates its password,
sets `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION
NOBYPASSRLS`, removes its other direct memberships, grants only
`gitblocks_serving` without admin option, and removes direct privileges on the
database and `gitblocks` objects. It then verifies effective membership,
attributes, ownership, DDL capability, and table privileges. The
fifteen serving tables must be selectable; every other GitBlocks table and
`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, and `TRIGGER` privilege
must be denied. Success is one JSON record containing booleans and counts, not
the login name, database connection fields, or either password.

Role creation and remediation are provider-authority dependent. A
non-superuser operator can succeed only when the provider gives it sufficient
`CREATEROLE`/role-administration authority and grant authority for
`gitblocks_serving`. It cannot demote a pre-existing superuser, remove a
membership administered only by another role, transfer objects owned by the
login, or cancel effective `CREATE` inherited from `PUBLIC` by revoking a grant
from the login itself. If the command reports that it cannot enforce or verify
the role, a provider administrator must manually:

1. create or alter the login with the exact safe attributes above;
2. transfer every database object it owns to the operator;
3. remove every membership other than `gitblocks_serving` and remove admin
   option from that membership;
4. revoke direct database, schema, table, sequence, and function privileges;
5. revoke inherited database/schema `CREATE` and database `TEMPORARY` at their
   granting roles, including `PUBLIC` when applicable; and
6. rerun `pnpm db:serving-login` with an operator authorized to inspect and
   enforce the final state.

### 4. Seed accepted identity and publish the serving snapshot

Do not run `pnpm catalog:seed`; its acknowledgement and scope remain explicitly
non-production. The supported `pnpm serving:bootstrap` operation performs the
accepted catalog identity/family writes and publishes the coherent profile and
retrieval-metadata snapshot after all seven migrations.

Configure its existing operator connection variables from the same managed
database/operator identity:

- `GITBLOCKS_SERVING_BOOTSTRAP_DB_HOST`: URL host text
- `GITBLOCKS_SERVING_BOOTSTRAP_DB_PORT`: integer port
- `GITBLOCKS_SERVING_BOOTSTRAP_DB_DATABASE`: database name
- `GITBLOCKS_SERVING_BOOTSTRAP_DB_USERNAME`: operator role name
- `GITBLOCKS_SERVING_BOOTSTRAP_DB_PASSWORD`: injected operator secret
- `GITBLOCKS_SERVING_BOOTSTRAP_DB_SSL`: exact `require` for managed TLS

Run the bootstrap with the committed accepted authority paths and an
operator-chosen canonical UTC publication timestamp:

```shell
pnpm serving:bootstrap -- \
  --catalog catalog/public-v1/manifest.json \
  --profiles catalog/public-v1/candidate-profile-authority.json \
  --metadata catalog/public-v1/candidate-retrieval-metadata-authority.json \
  --published-at <canonical-UTC-timestamp>
```

This is an offline operator step. It does not generate or refresh any authority
and it does not use the serving login.

### 5. Verify the durable database

Restore the production database command environment to only `DATABASE_URL` and
`GITBLOCKS_DB_PRODUCTION_ACK`, then run:

```shell
pnpm db:check
```

The check requires the same seven migrations, 29 product tables, safe
`gitblocks_persistence` and `gitblocks_serving` group attributes, zero RLS
policies, nine functions, 56 triggers, and fifteen required indexes as the test
path. It does not inspect or print the serving credential; rerun
`pnpm db:serving-login` whenever that credential or its grants are rotated.

After both checks pass, inject the serving role name and secret through the
hosted runtime's `GITBLOCKS_HOSTED_SERVING_DB_*` variables. Use `require` for
`GITBLOCKS_HOSTED_SERVING_DB_SSL` on the managed TLS connection. Application
startup remains read-only and never migrates, provisions roles, or bootstraps.
