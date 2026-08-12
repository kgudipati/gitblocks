# GitBlocks hosted discovery application

`@gitblocks/gitblocks-hosted` is the first product-owned hosted application
boundary. Startup creates one injected PostgreSQL client, loads the current R3
serving snapshot through `loadServingCatalogSnapshot(...)`, parses the accepted
checked-in capability taxonomy and retrieval expansion, constructs the existing
immutable retrieval engine, and only then reports ready.

`createHostedDiscoveryApplication(...)` owns the in-process use case.
`discoverCapability(...)` accepts the existing `CapabilityQueryInputV1`,
preserves clarification and unsupported normalization results, and otherwise
returns the existing bounded eligible/evidence-needed retrieval shortlist. It
does not accept a repository fingerprint, recommend a candidate, or perform
target-conditioned fit.

The startup composition owns the PostgreSQL client only for lifecycle cleanup.
The application receives no database capability, so discovery after successful
startup performs no PostgreSQL read or write. Shutdown is idempotent and closes
the client.

The one-shot exercise reads exactly these environment variables:

- `GITBLOCKS_HOSTED_SERVING_DB_HOST`
- `GITBLOCKS_HOSTED_SERVING_DB_PORT`
- `GITBLOCKS_HOSTED_SERVING_DB_DATABASE`
- `GITBLOCKS_HOSTED_SERVING_DB_USERNAME`
- `GITBLOCKS_HOSTED_SERVING_DB_PASSWORD`
- `GITBLOCKS_HOSTED_SERVING_DB_SSL` (`disable` or `require`)

After an R3 database has been migrated and bootstrapped by its separate
operator path, run:

```text
pnpm hosted:exercise -- --request apps/gitblocks-hosted/examples/authorization-discovery-request.json
```

The command invokes the same composition and discovery operation twice, emits
one bounded JSON result summary, and closes the client. It never migrates,
bootstraps, writes PostgreSQL, invokes ingestion/providers/models/interviews or
evaluation, or starts a transport. MCP and continuous process ownership remain
future work.
