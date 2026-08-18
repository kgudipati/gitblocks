# Hosted runtime environment

Issue #94 governs the container runtime boundary. Supply configuration through
the process environment or the container runtime's secret/configuration
injection. Do not bake credentials into the image, put them in command-line
arguments, or print them.

## Variables

| Variable                               | Requirement | Expected form                                                                                   |
| -------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `GITBLOCKS_HOSTED_SERVING_DB_HOST`     | required    | non-empty host text                                                                             |
| `GITBLOCKS_HOSTED_SERVING_DB_PORT`     | required    | integer from 1 through 65535                                                                    |
| `GITBLOCKS_HOSTED_SERVING_DB_DATABASE` | required    | non-empty database name                                                                         |
| `GITBLOCKS_HOSTED_SERVING_DB_USERNAME` | required    | non-empty role name                                                                             |
| `GITBLOCKS_HOSTED_SERVING_DB_PASSWORD` | required    | non-empty secret text                                                                           |
| `GITBLOCKS_HOSTED_SERVING_DB_SSL`      | required    | exact enum: `disable` or `require`                                                              |
| `GITBLOCKS_MCP_TOKEN`                  | required    | non-empty bearer-token text                                                                     |
| `OPENAI_API_KEY`                       | required    | 1–512 ASCII letters, digits, periods, underscores, or hyphens                                   |
| `GITBLOCKS_HOSTED_FIT_MODEL`           | required    | exact reviewed model identifier `gpt-5.4-mini-2026-03-17`                                       |
| `GITBLOCKS_HOSTED_MCP_HOST`            | optional    | bind hostname or IP address without scheme, path, or port; defaults to `127.0.0.1`              |
| `GITBLOCKS_HOSTED_MCP_PUBLIC_HOST`     | optional    | public hostname or IP address without scheme, path, or port; defaults to the resolved bind host |
| `GITBLOCKS_HOSTED_MCP_PORT`            | optional    | integer from 1 through 65535; defaults to `3333`                                                |

The hosted serving SSL variable deliberately uses `disable` or `require`.
`GITBLOCKS_SERVING_BOOTSTRAP_DB_SSL` uses `false` or `require`, while the
production migration/check boundary reads `sslmode` from `DATABASE_URL`. These
vocabularies are not interchangeable; use the exact form documented for the
command being run.

Startup validates the complete environment before composition. A failure is one
bounded JSON record with every problem, for example this shape:

```json
{
  "operation": "hosted-mcp.start",
  "status": "failed",
  "code": "hosted.invalid-configuration",
  "problems": [
    {
      "variable": "GITBLOCKS_HOSTED_SERVING_DB_HOST",
      "expected": "non-empty text"
    }
  ]
}
```

Only variable names and expected forms enter the error. Supplied values are not
copied into the error object, message, or process diagnostic.

## Bind and authority validation

`GITBLOCKS_HOSTED_MCP_HOST` controls only the listener bind address. When it is
unset, the listener binds `127.0.0.1`.

`GITBLOCKS_HOSTED_MCP_PUBLIC_HOST` controls Host and Origin validation. When it
is unset, it resolves to the bind host, preserving the prior behavior for both
loopback and non-loopback binds. If the resolved public host is `localhost`,
`127.0.0.1`, or `::1`, the MCP SDK's loopback guards accept `Host` and present
`Origin` hostnames of `localhost`, `127.0.0.1`, or `[::1]`; another hostname
receives `403`. For any other resolved public host, only that hostname is
accepted. Header ports are ignored in every case. A request without `Origin`
passes the Origin guard; a present Origin must have an accepted hostname.

The MCP bearer-token check remains unchanged after Host/Origin and path
validation. An authority-valid request to `/mcp` without the expected bearer
token receives the same bounded `401` response.

For example, a platform container can listen on every IPv4 interface while its
public authority remains the platform hostname. This non-secret portion of its
runtime environment is:

```text
GITBLOCKS_HOSTED_MCP_HOST=0.0.0.0
GITBLOCKS_HOSTED_MCP_PUBLIC_HOST=example-app.fly.dev
```

The listener binds `0.0.0.0`, while `Host: example-app.fly.dev` and an optional
Origin with hostname `example-app.fly.dev` pass authority validation. A
different Host or present Origin hostname receives `403`.

`GET /health` needs no bearer token but remains behind the Host and Origin
guards. It returns `503` with `{"status":"not-ready"}` while the immutable
serving snapshot is loading, and `200` with `{"status":"ready"}` only after
snapshot and policy validation. It reports no configuration, candidate data,
snapshot identity, counts, digests, or version information.

## Container commands

Build from the repository root:

```shell
docker build --tag gitblocks-hosted:issue-94 .
```

Run with the variables above supplied by an environment file. The environment
file is operator-owned, is not copied into the image, and must set the bind and
public hosts for the platform as described above:

```shell
docker run --rm --name gitblocks-hosted \
  --env-file /path/to/operator-owned-hosted.env \
  --publish 3333:3333 \
  gitblocks-hosted:issue-94
```

For the worked platform example, the bounded health probe is:

```shell
curl --fail --header 'Host: example-app.fly.dev' http://127.0.0.1:3333/health
```

On `SIGTERM` or `SIGINT`, the process stops accepting connections, gives
in-flight HTTP requests at most ten seconds to drain, forcibly closes remaining
connections, closes the MCP handler and PostgreSQL client, and exits zero after
a successful shutdown.
