# Durable production database bootstrap gap

## Status and boundary

Issue #56 exercised only the intentional local/ephemeral database path. The
repository did not then expose an authorized command sequence for a durable
managed PostgreSQL database. Issue #96 resolves blockers 1 and 7 below without
changing the other historical constraints. The executable production procedure
is now [`production-database-bootstrap.md`](production-database-bootstrap.md);
this file remains the blocker record that motivated it.

The local safety checks are intentional invariants. A production path would
need a separate, explicitly authorized boundary. It must not weaken, bypass, or
reinterpret the existing test and non-production guards.

## Blockers

### 1. Migration and check commands accept only explicit test configuration

**Issue #96 status: resolved.** `db:migrate` and `db:check` now select either
the unchanged test-only reader or a mutually exclusive production reader using
`DATABASE_URL` plus `GITBLOCKS_DB_PRODUCTION_ACK=managed-production`. Production
TLS defaults to `require`, URL `sslmode` is validated, and `_test` database
names are rejected.

- **Files:** `package.json:93-94`,
  `packages/persistence/scripts/db-cli.ts:7-22`, and
  `packages/persistence/scripts/database-support.ts:29-74`.
- **Guard or assumption:** `pnpm db:migrate` and `pnpm db:check` both call
  `readInjectedDatabaseConfig`. It requires all five
  `GITBLOCKS_TEST_DB_*` variables, requires
  `GITBLOCKS_DB_TEST_ACK=ephemeral`, requires the database name to end in
  `_test`, and fixes SSL to `false`. `DATABASE_URL` is not read.
- **Why it blocks production:** a durable production database must not assert
  that it is ephemeral or masquerade as a `_test` database, and a managed
  database may require TLS.
- **What would have to change:** a distinct production migration/check
  configuration and authorization boundary would have to exist. The current
  test-only reader and all of its guards must remain unchanged.

### 2. The migration command has no supported migration target

- **File:** `packages/persistence/src/migrations.ts:34-69,71-135`.
- **Guard or assumption:** the seven migrations are one fixed known inventory.
  `applyMigrations` always applies every pending entry in that inventory; the
  CLI exposes no target version or staged stop.
- **Why it blocks the requested staged sequence:** a fresh database cannot be
  advanced by the current command only through migration `0004` before running
  the standalone catalog seed.
- **What would have to change:** the production bootstrap contract would have
  to define an authorized ordering that is internally consistent with the
  catalog publication boundary. No such ordering is currently exposed.

### 3. The standalone catalog-seed migration checks are mutually unreachable

- **Files:** `packages/ingestion/scripts/catalog-seed-command.ts:65-132` and
  `packages/persistence/src/migrations.ts:138-178`.
- **Guard or assumption:** `catalog:seed` first calls the current
  `verifyMigrations`. That verifier rejects any applied inventory shorter than
  all seven migrations. After it returns, `catalog:seed` requires the latest
  verified migration to be exactly version `4`.
- **Why it blocks both local staging and production:** no database can
  simultaneously have the complete seven-migration inventory required by
  `verifyMigrations` and have migration `0004` as its latest migration. The
  guarded CLI therefore has no successful current state.
- **What would have to change:** the catalog-seed and migration-verification
  contracts would have to agree on one authorized database state. This step
  does not select or implement such a change.

### 4. The standalone catalog seed is explicitly non-production

- **File:** `packages/ingestion/scripts/catalog-seed-command.ts:25-27,148-163`.
- **Guard or assumption:** the command requires the exact acknowledgement
  `approved-non-production-public-catalog-seed` and exact scope
  `ephemeral-non-production`.
- **Why it blocks production:** setting those values for a durable database
  would make a false safety assertion and would violate the command's intended
  authority.
- **What would have to change:** a separate reviewed production authority for
  accepted-catalog publication would have to exist. The existing
  non-production acknowledgement and scope must remain exact.

### 5. The serving bootstrap does not replace the missing production migration authority

- **Files:**
  `packages/ingestion/scripts/serving-catalog-bootstrap-command.ts:72-127,175-228`.
- **Guard or assumption:** `serving:bootstrap` requires PostgreSQL major 18 at
  or above the minimum validated minor 18.4, exactly seven verified migrations
  ending in `artifact-evidence-serving`, and six discrete
  `GITBLOCKS_SERVING_BOOTSTRAP_DB_*` values. It publishes accepted catalog
  candidates/families and the coherent snapshot, but it does not apply
  migrations.
- **Why it blocks a complete production procedure:** it can populate an
  already prepared migration-`0007` database, but the repository has no
  production-authorized command that prepares and checks that database first.
- **What would have to change:** a production rollout authority would have to
  cover database preparation, accepted-authority publication, and verification
  as one explicit operational boundary.

### 6. Migrations require cluster-role creation authority

- **Files:** `packages/persistence/migrations/0001_evidence_persistence.sql`
  and `packages/persistence/migrations/0005_retrieval_serving.sql:1-36`.
- **Guard or assumption:** the migrations create the cluster-wide
  `gitblocks_persistence` and `gitblocks_serving` `NOLOGIN` roles when absent,
  and reject unsafe pre-existing role attributes.
- **Why it can block managed PostgreSQL:** the migration owner must be allowed
  to inspect and create roles. Some managed offerings reserve or restrict that
  authority, and cluster-wide role names can collide with pre-existing roles.
- **What would have to change:** production prerequisites and authority for the
  exact required roles would have to be established for the selected managed
  database. The role safety requirements themselves remain invariant.

### 7. There is no production serving-login provisioning command

**Issue #96 status: resolved, subject to provider role authority.**
`pnpm db:serving-login` creates or rotates the configured login, restricts it to
the `gitblocks_serving` membership, and returns a credential-free structured
verification of attributes, effective table privileges, ownership, and
DDL denial. The production runbook states the provider-administrator
steps required when the operator cannot manage roles, ownership, memberships,
or inherited `CREATE`/`TEMPORARY` grants.

- **File:** `packages/persistence/README.md:22-28`.
- **Guard or assumption:** migrations create only the `gitblocks_serving`
  `NOLOGIN` group. The package states that a deployment owner creates a login
  and grants only that group, but no repository command performs or verifies
  that production credential operation.
- **Why it blocks application startup in production:** the hosted application
  requires a login credential that has only serving privileges; the database
  bootstrap currently produces no such production identity.
- **What would have to change:** a separately authorized deployment-owned
  serving-login provisioning and verification boundary would have to exist.

### 8. The database check is coupled to an exact current schema and role inventory

- **File:** `packages/persistence/scripts/database-support.ts:165-270` and the
  remainder of `checkDatabase` in that file.
- **Guard or assumption:** `db:check` requires all seven checksummed migrations,
  exactly 29 product tables, no RLS policies, exact safe attributes for both
  `NOLOGIN` roles, and exact function, trigger, and required-index counts.
- **Why it can block managed PostgreSQL:** the check needs sufficient catalog
  visibility and the database must match the current schema and role inventory
  exactly. It cannot be used through the current test-only configuration
  boundary.
- **What would have to change:** the production check entry point would have to
  receive production-authorized connectivity while preserving the same schema,
  migration, role, and privilege invariants.

### 9. Database creation is outside the repository command surface

- **Files:** `package.json:69-96` and
  `packages/persistence/scripts/db-cli.ts:7-25`.
- **Guard or assumption:** there is no product command for creating a durable
  database, assigning its owner, configuring managed TLS, or coordinating a
  managed-provider maintenance boundary. The local exercise used an external
  administrative `CREATE DATABASE` operation.
- **Why it blocks a repeatable managed rollout:** managed database creation and
  owner establishment must precede migrations, but their authority and evidence
  are not defined here.
- **What would have to change:** production database provisioning prerequisites
  and ownership would have to be explicitly defined outside or alongside the
  repository bootstrap boundary before any migration command is authorized.

## Current conclusion

The current repository can create a coherent serving snapshot on an explicitly
ephemeral `_test` database by applying all seven migrations and then using
`serving:bootstrap`, which also writes the accepted catalog identity/family
rows. `db:check` verifies that result.

The local sequence must not be reused for production. Issue #96 supplies a
distinct durable migration/check boundary and serving identity command. The
standalone `catalog:seed` conflict remains unchanged; the production sequence
uses the existing post-migration `serving:bootstrap`, which writes accepted
catalog identity/families before publishing the coherent snapshot. Managed
database provisioning and provider-specific role authority remain operator
responsibilities outside repository commands.
