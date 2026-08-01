# `@gitblocks/repository-interview-prelive`

This non-production tool owns the cross-package Phase 7 pre-live verification
and future materialization workflow. It may consume public ingestion receipt,
persistence, operator, interview, contract, and evaluation authorities. The
operator application remains independent of `@gitblocks/ingestion`.

The tool validates committed candidate plans and profiles without network or
secret access. Its materializer accepts only an exact complete fresh artifact
receipt and loads artifact sets by the receipt-provided IDs from the explicitly
configured ephemeral PostgreSQL database. It never constructs a provider,
reads a provider credential, applies migrations, or searches for a latest set.

`pnpm interviews:prelive:materialize` requires explicit long-form candidate
plan, raw receipt, individual PostgreSQL, acknowledgement, output ID, and two
absolute output paths. It accepts no database URL, password value, provider
token, model profile, operator policy, migration action, or network transport
other than the injected PostgreSQL boundary. Both outputs are sibling-temp,
flushed, mode `0600`, non-replacing atomic publications with one trailing
newline; final symlinks and overwrite are rejected and failed temporaries are
cleaned.

The ordinary validator and verifier never invoke that command with real input.
Synthetic tests prove receipt-ID-only loading, identity from the loaded set,
stable 6/30/150 materialization, exact authorization closure, network and
secret denial, and PostgreSQL 18.4 migration inventory without contacting a
model provider.
