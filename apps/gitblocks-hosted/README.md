# GitBlocks hosted discovery application and MCP adapter

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

Recovery R5 exposes that existing operation as exactly one MCP tool,
`discover_oss`. `createGitBlocksMcpServer(application)` adapts the canonical
`CapabilityQueryInputV1` JSON Schema and delegates every valid call directly to
`application.discoverCapability(...)`. The adapter returns the existing R4
result as authoritative structured content. It does not normalize, retrieve,
query PostgreSQL, inspect a caller repository, invoke a provider/model, or
construct another application.

The one-shot exercise and continuous MCP process read the same serving database
environment variables:

- `GITBLOCKS_HOSTED_SERVING_DB_HOST`
- `GITBLOCKS_HOSTED_SERVING_DB_PORT`
- `GITBLOCKS_HOSTED_SERVING_DB_DATABASE`
- `GITBLOCKS_HOSTED_SERVING_DB_USERNAME`
- `GITBLOCKS_HOSTED_SERVING_DB_PASSWORD`
- `GITBLOCKS_HOSTED_SERVING_DB_SSL` (`disable` or `require`)

The MCP process additionally accepts `GITBLOCKS_HOSTED_MCP_PORT`, which defaults
to `3333` and must be an integer from 1 through 65535. The host is not
configurable: R5 always binds `127.0.0.1` and serves MCP only at `/mcp`.

After an R3 database has been migrated and bootstrapped by its separate
operator path, run:

```text
pnpm hosted:exercise -- --request apps/gitblocks-hosted/examples/authorization-discovery-request.json
```

The command invokes the same composition and discovery operation twice, emits
one bounded JSON result summary, and closes the client.

To exercise the real MCP boundary, first start the continuous process after the
same R3 database has been prepared:

```text
pnpm hosted:mcp
```

After the readiness record reports `http://127.0.0.1:3333/mcp`, use a second
terminal with the same optional `GITBLOCKS_HOSTED_MCP_PORT` value:

```text
pnpm hosted:mcp:exercise -- --request apps/gitblocks-hosted/examples/authorization-discovery-request.json
```

The exercise uses the official `@modelcontextprotocol/client` modern
Streamable HTTP transport pinned to protocol `2026-07-28`, lists the one tool,
calls `discover_oss`, and reports shortlist semantic digest
`4b1b67eda39c618ae67738e7776957c6ea45315d0893199c90e42f7bc39d9b00`.
Stop the server with `SIGINT` or `SIGTERM`; it stops accepting requests, closes
the MCP handler, and then closes the R4 composition.

Neither command migrates, bootstraps, writes PostgreSQL, invokes
ingestion/providers/models/interviews, or invokes evaluation. R5 proves
loopback interoperability only. It has no temporary authentication mechanism
and is not an internet-facing or deployed service; standards-compliant remote
authorization and deployment remain R6 work.
