# Loopback MCP credential

The loopback-only GitBlocks MCP process requires `GITBLOCKS_MCP_TOKEN` to be
set to a non-empty bearer token. Startup fails closed when the variable is
unset or empty. The listener remains bound to `127.0.0.1`.

Inject the credential from the approved secret store into the environment that
runs both the server and its client. For an interactive `zsh` session, it can be
entered without placing the value in shell history:

```text
read -rs GITBLOCKS_MCP_TOKEN
export GITBLOCKS_MCP_TOKEN
```

`pnpm hosted:mcp` reads the expected token, and
`pnpm hosted:mcp:exercise -- --request <path>` sends that same value as a bearer
credential. Do not commit, print, log, or include the token in command-line
arguments.
