# Durable managed PostgreSQL bootstrap

## Scope and authority

Issue #96 authorizes the database and serving-login sequence for an already
provisioned durable PostgreSQL database. Issue #150 records the additional
evidence-readiness requirement and the current production-operator blocker. It
does not provision a database, deploy the hosted application, generate
authority files, or run ingestion at request time. The database must be
PostgreSQL major 18 at or above the minimum validated minor 18.4, and its name
must not end in `_test`. The serving bootstrap accepts 18.4 and newer 18.x
minors and rejects older 18.x minors and every other major.

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
  --profiles catalog/public-v1/candidate-profile-authority-v2.json \
  --metadata catalog/public-v1/candidate-retrieval-metadata-authority.json \
  --published-at <canonical-UTC-timestamp>
```

This is an offline operator step. It does not generate or refresh any authority
and it does not use the serving login. The committed V2 profile authority is
deterministically derived from the separately reviewed V2 curation authority,
which currently contains 51 reviewed assertions.

### 5. Populate evidence before starting the service

A published serving snapshot is necessary but not sufficient for a usable
service. Snapshot publication writes catalog, deterministic profile, and
retrieval-metadata records; it does not write `evidence_observations` or
`repository_artifacts`. When both tables are empty, finalist dossiers contain
no positive candidate evidence and every recommendation request correctly
returns `insufficient-evidence` before the target-fit model is called.

Do not start or restart the hosted service as recommendation-ready until the
two required live writer stages below have run through a production-authorized
operator and their receipts and durable row counts have been reviewed. The
SELECT-only serving login cannot run either writer.

#### Current blocker: no production-authorized writer command

The repository does not currently expose a command that is authorized to run
either writer against a managed production database:

- `pnpm ingest:live` requires
  `GITBLOCKS_INGEST_ACKNOWLEDGEMENT=approved-non-production-public-ingestion-with-public-sources-only`.
  That acknowledgement must not be asserted for a production target.
- `pnpm artifacts:live` accepts only `ephemeral-non-production` or
  `persistent-private-alpha-dogfood`. The latter additionally fixes the target
  to host `127.0.0.1`, database `gitblocks_dogfood_test`, username
  `gitblocks_persistence_dogfood`, and TLS disabled. A managed Neon target is
  rejected before a database client, provider transport, or receipt is
  created.

Consequently there is no safe command sequence that can populate production at
this revision. Issue #150 remains blocked on a reviewed production authority
boundary for both CLIs. Do not bypass the acknowledgements or weaken the scope
guards operationally. Once that boundary exists, preserve the following order
and semantics.

#### Authority generation is already satisfied or out of scope

The live authority generators are not database-population steps and must not be
inserted into the production sequence.

| Command                                     | Production-bootstrap status | Credentials and external access                                                                                                                                                                                                                                                                                                               | Writes and rerun behavior                                                                                                                                                                                                                                                                                             |
| ------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm retrieval:metadata:collect`           | Already satisfied           | Reads `GITBLOCKS_RETRIEVAL_METADATA_GITHUB_TOKEN`; makes 150 GitHub repository-metadata requests with at most 450 attempts; requires no database, Docker, npm access, model, or artifact bodies                                                                                                                                               | Exclusively creates `catalog/public-v1/candidate-retrieval-metadata-authority.json` through a sibling staging file. The committed authority already exists, so preflight rejects before credential or network access. It is one-shot, not resumable, and cleans up a staging file it owns after a failed publication. |
| `pnpm retrieval:metadata:validate`          | Optional read-only check    | No environment variable, credential, network, npm, database, or Docker access                                                                                                                                                                                                                                                                 | Validates the committed authority without writing. It is repeatable.                                                                                                                                                                                                                                                  |
| `pnpm profiles:materialization:preflight …` | Not required                | No environment variable, credential, network, npm, database, or Docker access                                                                                                                                                                                                                                                                 | Validates exactly 25 named argument/value pairs and fixed paths without writing. It is repeatable and does not validate the committed curated V2 profile authority.                                                                                                                                                   |
| `pnpm profiles:materialization:execute …`   | Not required; must not run  | Reads `GITBLOCKS_PROFILE_MATERIALIZATION_GITHUB_TOKEN`, `GITBLOCKS_PROFILE_MATERIALIZATION_DB_OWNER_URL`, `GITBLOCKS_PROFILE_MATERIALIZATION_DB_OWNER_PASSWORD`, `GITBLOCKS_PROFILE_MATERIALIZATION_DB_RUNTIME_URL`, and `GITBLOCKS_PROFILE_MATERIALIZATION_DB_RUNTIME_PASSWORD`; uses GitHub and unauthenticated npm reads plus local Docker | Creates, migrates, seeds, uses, disposes, and proves disposal of a fresh loopback-only PostgreSQL container; makes two full provider collections; writes run-local source authorities and persistence proofs plus three fixed V1 completion-proof files. It is a one-shot proof, not a resumable production writer.   |
| `pnpm profiles:materialization:verify`      | Not required                | No environment variable, credential, network, npm, database, or Docker access                                                                                                                                                                                                                                                                 | Read-only and repeatable when the three fixed V1 completion-proof files exist. Those files are not committed at this revision, so this command currently fails closed.                                                                                                                                                |
| `pnpm profiles:validate`                    | Optional read-only check    | No live-provider credential or database access; ordinary dependency execution must already be available                                                                                                                                                                                                                                       | Regenerates the curated V2 profile bytes in memory from the committed catalog, taxonomy, 51-assertion curation authority, and bounded curation material, then verifies exact byte equality with the committed V2 authority and coverage.                                                                              |

`profiles:materialization:execute` belongs to an older V1 materialization proof.
It materializes a V1 authority in memory from two fresh provider collections,
but does not publish that authority file, does not read the V2 reviewed
curation authority, does not write `candidate-profile-authority-v2.json`, and
does not publish a serving snapshot. It therefore cannot regenerate,
overwrite, merge with, or conflict with the 51 reviewed V2 assertions already
selected in production. It is not safe or authorized to run as a production
operation, and running it cannot repair production evidence.

If it were separately authorized for its intended local proof, each of its two
collections would have the same 913-logical-request ceiling as ingestion (833
GitHub and 80 unauthenticated npm reads), for 1,826 logical requests and at
most 5,478 attempts across the execute. Those calls would still populate only
the disposable local proof database.

#### Required writer 1: public evidence ingestion

After a production authority boundary is implemented, run the production
equivalent of this existing non-production command first:

```shell
pnpm ingest:live -- \
  --manifest catalog/public-v1/manifest.json \
  --receipt <new-untracked-ingestion-receipt-path> \
  --concurrency 3 \
  --deadline-ms 3600000

pnpm ingest:receipt <new-untracked-ingestion-receipt-path>
```

`pnpm ingest:receipt` requires no environment variable, credential, network,
npm, or database access and performs no write. It is repeatable against a
retained receipt.

The writer requires these injected fields. They must name a persistence-capable
operator login, not the SELECT-only serving login:

| Variable                           | Requirement                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| `GITBLOCKS_INGEST_ACKNOWLEDGEMENT` | A new reviewed production value is required; the current value is non-production only |
| `GITBLOCKS_INGEST_GITHUB_TOKEN`    | Injected least-privilege token for authenticated public GitHub reads                  |
| `GITBLOCKS_INGEST_DB_HOST`         | Managed database host                                                                 |
| `GITBLOCKS_INGEST_DB_PORT`         | Integer port from 1 through 65535                                                     |
| `GITBLOCKS_INGEST_DB_DATABASE`     | Managed database name                                                                 |
| `GITBLOCKS_INGEST_DB_USERNAME`     | Persistence-capable operator role                                                     |
| `GITBLOCKS_INGEST_DB_PASSWORD`     | Injected operator secret                                                              |
| `GITBLOCKS_INGEST_DB_SSL`          | Exact `require` for the managed TLS connection                                        |

The current catalog permits at most 913 logical requests for a full run: 833
GitHub and 80 unauthenticated npm-registry reads. Each safe GET has one initial
attempt and at most two retries. Requests within one candidate are serial,
candidate concurrency is at most three, request timeout is 10 seconds,
candidate deadline is 90 seconds, and the full-run deadline is at most one
hour. The prior reviewed 150-candidate run made 769 GitHub and 80 npm requests,
849 total; provider pagination and early candidate failure can make the actual
count lower than the logical ceiling.

The command writes immutable catalog identity/family rows as needed,
`evidence_observations`, candidate limitations and material unknowns plus their
evidence bindings, evidence supersessions and invalidations, candidate dossier
snapshots, and snapshot membership rows. Each candidate is isolated from the
batch failure outcome. A candidate failure is recorded with a safe code, the
remaining workers continue, and the command still writes a receipt after the
batch. A `partial` optional-source outcome writes no snapshot for that
candidate.

Database writes use stable identities and conflict/digest checks. Repeating a
complete run is idempotent for unchanged provider facts and appends immutable
history when a source fact changes. After a process or candidate failure, use a
new receipt path and either rerun the full catalog or repeat `--candidate
<candidate-id>` for each failed candidate. `--compare-receipt <prior-path>`
adds a comparison to the new receipt; it does not skip candidates. Receipt
paths are exclusive-create and cannot be reused.

Issue #65 is a known exception: `webhook-mux-node` names
`muxinc/mux-node-sdk`, which GitHub resolves to `muxinc/mux-ts`. Because the
catalog status does not authorize that identity move, ingestion fails that
candidate with `ingestion.provider-identity` after its repository-metadata
request, writes no evidence or snapshot for it, and continues the other 149.
Do not weaken identity validation. Review the receipt as 149 usable candidates
plus that explicit exception until the catalog authority is separately
corrected or the candidate is retired.

#### Required writer 2: immutable repository artifacts

After evidence ingestion, run the production equivalent of this existing
non-production command:

```shell
pnpm artifacts:live -- \
  --catalog catalog/public-v1/manifest.json \
  --manifest catalog/public-v1/artifact-manifest.json \
  --receipt <new-untracked-artifact-receipt-path> \
  --concurrency 2 \
  --deadline-ms 3600000

pnpm artifacts:receipt <new-untracked-artifact-receipt-path>
```

`pnpm artifacts:receipt` requires no environment variable, credential,
network, npm, or database access and performs no write. It is repeatable
against a retained receipt.

The writer requires these injected fields:

| Variable                             | Requirement                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `GITBLOCKS_ARTIFACT_ACKNOWLEDGEMENT` | A new reviewed production value is required; the current value is non-production only             |
| `GITBLOCKS_ARTIFACT_DB_SCOPE`        | A new reviewed production scope is required; neither current scope authorizes a managed database  |
| `GITBLOCKS_ARTIFACT_PERSISTENT_ACK`  | Required only by the current fixed loopback dogfood scope; it is not a production acknowledgement |
| `GITBLOCKS_ARTIFACT_GITHUB_TOKEN`    | Injected least-privilege token for authenticated public GitHub reads                              |
| `GITBLOCKS_ARTIFACT_DB_HOST`         | Managed database host                                                                             |
| `GITBLOCKS_ARTIFACT_DB_PORT`         | Integer port from 1 through 65535                                                                 |
| `GITBLOCKS_ARTIFACT_DB_DATABASE`     | Managed database name                                                                             |
| `GITBLOCKS_ARTIFACT_DB_USERNAME`     | Persistence-capable operator role                                                                 |
| `GITBLOCKS_ARTIFACT_DB_PASSWORD`     | Injected operator secret                                                                          |
| `GITBLOCKS_ARTIFACT_DB_SSL`          | Exact `require` for the managed TLS connection                                                    |

Artifact collection uses GitHub only and never accesses npm. It serializes all
requests through one transport even though at most two candidates are active,
uses at most three attempts per safe GET, has a 10-second request timeout,
120-second candidate deadline, and one-hour run deadline. The manifest contains
180 artifact selections across 150 candidates. The prior reviewed full run
materialized 180 artifacts through 1,183 GitHub requests. Actual requests
depend on repository tree depth, redirects, optional absences, and early
failures; the current `webhook-mux-node` rename is expected to fail during
repository-context identity validation and save the remaining requests for
that candidate.

The command writes immutable `repository_artifacts`,
`repository_artifact_chunks`, `repository_artifact_sets`, and
`repository_artifact_set_entries`. Publication for one candidate is
transactional. A candidate failure records a safe code and the batch continues;
it does not roll back completed candidates. Stable content, chunk, and set
identities make unchanged reruns idempotent. Resume with a new exclusive receipt
path and either the full catalog or repeated `--candidate <candidate-id>`
arguments. `--compare-receipt <prior-path>` records comparison only and does
not skip candidates.

Both live writers share the bounded transport policy. Network failures and HTTP
408, 500, 502, 503, and 504 are retried. HTTP 429, or GitHub HTTP 403 with a
rate-limit signal, uses `Retry-After` first and GitHub reset time when remaining
is zero. A required wait of at most 60 seconds is slept subject to the candidate
and run deadlines. A wait over 60 seconds fails with
`ingestion.provider-rate-limited` and blocks later GitHub calls in that run;
ordinary retry delay is exponential with deterministic jitter. Receipts retain
only bounded request counts and the last valid GitHub primary-limit summary.

#### Evidence readiness check

Receipt parsing proves shape and digest integrity but does not require every
candidate to have succeeded. Review each receipt's requested/completed counts,
outcome counts, and safe failure totals. Then use the managed provider query
console or another already approved operator connection to run only this
read-only check without printing connection data:

```sql
select
  (select pg_catalog.count(*) from gitblocks.evidence_observations)
    as evidence_observation_count,
  (select pg_catalog.count(*) from gitblocks.repository_artifacts)
    as repository_artifact_count;
```

Both counts must be greater than zero before the service is considered
recommendation-ready. Counts are not pinned because provider facts and
immutable history can change. For reference, the recorded local database after
the issue-#65 exclusion held 1,238 observations and 177 artifacts; those local
counts are evidence of the sequence, not a production target or permission to
copy database contents.

Do not substitute `pnpm catalog:seed`,
`pnpm retrieval:metadata:collect`, `pnpm profiles:generate`, or
`pnpm profiles:materialization:execute` for either writer. They seed a
non-production catalog or generate/check repository authorities and proof
artifacts; none populates both production evidence stores. Never place any
ingestion, artifact collection, authority generation, migration, Docker, or
materialization command in application startup or the request path.

### 6. Verify the durable database

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

After serving-login verification, evidence readiness, and `db:check` all pass,
inject the serving role name and secret through the hosted runtime's
`GITBLOCKS_HOSTED_SERVING_DB_*` variables. Use `require` for
`GITBLOCKS_HOSTED_SERVING_DB_SSL` on the managed TLS connection. Application
startup remains read-only and never migrates, provisions roles, bootstraps, or
collects evidence.
