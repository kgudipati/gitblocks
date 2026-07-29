# GitBlocks persistence

`@gitblocks/persistence` is the concrete PostgreSQL adapter for durable catalog,
evidence, lifecycle, and exact candidate-dossier snapshot records.

The package is deliberately not an operational backend. It reads no
environment variables, creates no singleton, performs no import-time I/O, and
never applies migrations implicitly. A caller injects connection
configuration, explicitly applies or verifies migrations, and explicitly
closes each client.

The public package surface accepts existing product-contract values or
package-owned bounded commands. It exposes stable value-free errors and never
exports the database driver. A future application layer will own persistence
ports; it must not import this concrete package.

Database behavior, the PostgreSQL 18 policy, role model, row-level isolation,
retention, and forward-recovery procedure are governed by
[ADR 0004](../../docs/architecture/decisions/0004-postgresql-evidence-persistence.md).
