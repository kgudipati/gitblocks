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

Selection, policy, receipt, candidate plan, selection materialization, and
pre-live authorization are operator-local `1.0.0` authorities. Their closed
JSON Schema snapshots live in `schemas/` and are reproduced from
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

Milestone 10 adds these schema digests:

- candidate plan:
  `f50d4b73c2fc04f0c13b7b1288a215ecc4a740fc2e97433478e3ffcdbe352387`;
- selection materialization:
  `1c2ef4968c9de9d8d0c34c74350fc418d2ce1407a2ead62bb58eb33b682d0fe2`;
- pre-live authorization:
  `e55b4d7a64fae07fa7f9f93ce4271993170c1ebf61d0246654227c4055cd4c76`.

## Explicit CLI

`pnpm operator:interviews` has no implicit selection or database. It requires:

```text
--acknowledge-ephemeral-non-production <database-name>
--candidate-plan-file <absolute-path>
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
[--verify-immediate-reuse]

Complete materialization group (optional only for dry-run):
--artifact-receipt-file <absolute-path>
--selection-file <absolute-path>
--selection-materialization-file <absolute-path>
--prelive-authorization-file <absolute-path>
```

The acknowledgement must equal the database name byte-for-byte before any
environment, database, clock, nonce, telemetry, provider, or filesystem-write
effect. A database URL and secret argv/config values are not accepted. The
operator never applies migrations; it verifies PostgreSQL 18.4 and the exact
four accepted migration checksums before artifact loading or execution.

Plan-only dry-run validates the candidate plan, specification, one profile,
policy, explicit database syntax, receipt-path syntax, and conservative
plan-count budgets while omitting the complete materialization group. It reads
no secret, constructs no database/provider, reads no clock/nonce, emits no
telemetry, writes no receipt, and reports `materializationChecked: false`,
`liveAuthorizationChecked: false`, and `liveReady: false`. Tests may supply the
complete synthetic group to a dry-run, which validates closure with the same
zero-effect boundary. The pre-live process wrapper first parses the product
contract and then requires exact complete-profile digest and canonical-byte
equality with one of the two committed profiles. A changed reasoning effort,
response bound, projection, retention/state control, or dated snapshot is
rejected before policy compatibility, budgeting, clocks, secrets, database,
provider, telemetry, or receipt effects.

Every non-dry invocation requires the complete group. The receipt must be the
exact successful fresh 150-candidate migration-`0004` receipt, the selection must be the exact
materialized selection, the binding must join that plan/receipt/selection, and
the authorization must approve only the exact six-member calibration scope.
All file and authorization closure, including expiration, completes before the
database password is read. Migration and exact selected-set reload closure
complete before the OpenAI token can be read or the provider constructed.
Forced mode, Gate A, Gate B, partial groups, and missing or mismatched
authorities fail before either secret.

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

Milestone 9 is accepted in full, including active candidate/run deadlines,
candidate-scoped effects, already-aborted startup denial, truthful provider
call accounting, and immediate zero-call reuse. Hosted CI run 83 is accepted.

Milestone 10's first stop is also accepted: the committed artifact manifest is
declaration authority, not a materialized-set inventory, and no historical
Phase 6 set ID or digest can be reconstructed or invented. Milestone 10 now
commits candidate plans only. A future fresh receipt and exact same ephemeral
database will produce an untracked selection and content-free binding through
the separate pre-live tool; this app still imports no ingestion package. No
credential is configured, no provider/model request is authorized, and no
non-test database, live receipt, materialized selection, or real authorization
has been used or committed. Readiness remains live-blocked. Retention and
pricing remain unresolved, and Milestone 11 is blocked.

Readiness-policy `1.0.0` derives calibration eligibility from the eight
external prerequisites and does not require the `model-calibration` result
gate. Its `liveReady` value means only exact calibration eligibility. Gate A
and Gate B remain blocked under this policy version regardless of calibration
eligibility or result; later-stage authorization requires future reviewed
authority.
