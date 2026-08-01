# `@gitblocks/repository-interview-operator`

This private application is the explicit offline composition root for one
candidate-owned repository-interview run. It imports only the public surfaces
of `@gitblocks/contracts`, `@gitblocks/interviews`, and
`@gitblocks/persistence`. No product package imports the app, interviews stays
persistence-independent, and persistence does not import interviews.

`runRepositoryInterviewOperatorV1` accepts an exact owned selection, reviewed
specification, exact dated model profile, digested operator policy, execution
mode, and injected persistence/provider/time/nonce/observer authorities. It
owns canonical selection iteration, artifact loading, conservative token/cost
preflight, concurrency one or two, run deadline/fail-fast behavior, immediate
zero-call reuse proof, content-free aggregation, and receipt construction.
Request creation, reuse, provider-output mapping, citation closure, durable
identity, and publication remain owned by `executeRepositoryInterviewV1`.

Each selected member receives one candidate control before candidate-started
telemetry or artifact loading. Its policy-exact timer is composed with the run
signal and propagated through artifact loading, reuse lookup, provider attempt
control and retry sleep, and publication. The operator rechecks that authority
between phases, disposes every timer and listener, and starts no replacement
work after a candidate or run deadline. An already-aborted parent is observed
immediately; neither an attempt nor the explicit fetch wrapper may start global
transport under an already-aborted signal. A durable result completed before
the boundary changed is retained exactly, while a deadline before durable
publication produces only a content-free operator result.

Selection, policy, and receipt are operator-local `1.0.0` authorities. Their
closed JSON Schema snapshots live in `schemas/` and are reproduced from
`src/schema-snapshots.ts`. `pnpm operator:interviews:schema:validate` is
read-only and rejects drift. Parsers copy only bounded plain data, reject
exotic/accessor/sparse/cyclic input without invoking getters, and deep-freeze
accepted values. Digests use domain-separated canonical JSON.

The policy snapshot mirrors every runtime field bound, including the
five-minute minimum candidate deadline, timeout maxima, 8,192 output-token
maximum, USD 120 stop ceiling in micro-USD, safe-integer accounting ceilings,
and bounded string grammars. Runtime-only cross-field and real-date rules
remain separately tested. Its current SHA-256 is
`6147c1a4e47680a6c5e6a760bbc27d4bdfea5e8b1a7dd93e67a080bb6ce7184e`.

## Explicit CLI

`pnpm operator:interviews` has no implicit selection or database. It requires:

```text
--acknowledge-ephemeral-non-production <database-name>
--selection-file <absolute-path>
--specification-directory <absolute-path>
--model-profile-file <absolute-path>
--operator-policy-file <absolute-path>
--database-host <host>
--database-port <port>
--database-name <name>
--database-user <user>
--database-ssl <disabled|require>
--database-password-env <UPPERCASE_VARIABLE_NAME>
--openai-token-env <UPPERCASE_VARIABLE_NAME>
--receipt-path <absolute-path>
[--dry-run]
[--force --force-reason <calibration|review-rejected|operator-recovery>]
[--verify-immediate-reuse]
```

The acknowledgement must equal the database name byte-for-byte before any
environment, database, clock, nonce, telemetry, provider, or filesystem-write
effect. A database URL and secret argv/config values are not accepted. The
operator never applies migrations; it verifies PostgreSQL 18.4 and the exact
four accepted migration checksums before artifact loading or execution.

Dry-run validates the complete explicit configuration, authority digests,
compatibility, receipt-path syntax, and worst-case budgets. It reads no secret,
constructs no database/provider, reads no clock/nonce, emits no telemetry,
writes no receipt, and emits one canonical content-free summary.

The OpenAI token port is lazy and reads its named value only when the accepted
provider adapter begins an operation. Ordinary and hosted verification use
fake providers/transports and never read a credential or contact OpenAI. The
two dated snapshots remain calibration candidates; the operator selects none.

## Receipts and telemetry

The receipt contains authority digests, migration inventory, controlled
execution policy, selection-ordered record IDs/digests, counts, current-run
usage/cost, controlled provider aggregates, reuse proof, telemetry counts, and
its domain-separated digest. It excludes prompts, artifacts, semantic strings,
citations, repository identity, provider bodies/errors/IDs, credentials,
database endpoints, SQL, ranking, and target-repository data. The process
writer uses a sibling `0600` temporary file, flushes it, establishes the final
path without replacement, flushes the directory, and cleans up on failure.

Telemetry uses only `operator-started`, `candidate-started`,
`candidate-reused`, `provider-completed`, `publication-completed`,
`candidate-completed`, `operator-stopped`, and `operator-completed`. Events are
owned/frozen and sequenced. Observer failures are discarded and counted.

The optional immediate-reuse proof counts invocation of its throwing provider
guard before the guard fails. A passing proof requires zero calls, attempts,
tokens, and cost; a missing reusable record therefore fails with the truthful
observed call count rather than claiming a zero-call proof.

Milestone 9 implements and tests this composition offline only and remains
pending renewed maintainer review. No credential
is configured, no provider/model request is authorized, and no non-test
database or live receipt has been used. Milestone 10 remains blocked. Before
Milestone 11 calibration, ADR 0007's ZDR or updated-provider-authority gate is
still mandatory.
