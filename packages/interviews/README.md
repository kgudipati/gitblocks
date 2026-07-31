# `@gitblocks/interviews`

This private application package owns repository-interview behavior without
depending on ingestion, persistence, evaluation, retrieval, or ranking.

The package currently implements only:

- the authoritative semantic-only provider-output TypeBox schema;
- safe structural parsing and persistence-independent semantic validation;
- deterministic provider-neutral and OpenAI strict-schema generation;
- immutable specification loading, generation, and digest validation; and
- deterministic artifact-set closure, prompt rendering, provider-output
  digesting, alias/range resolution, and durable-constructor input mapping;
- one persistence-independent application use case with narrow provider,
  record/reuse, clock, and nonce ports;
- deterministic reuse and forced-execution orchestration with immutable
  request, execution, and interview construction;
- a bounded fixed-host OpenAI Responses adapter behind injected credential,
  fetch, clock, sleeper, and attempt-control authorities;
- bounded value-free mapping diagnostics; and
- offline focused tests and CLI validation.

The frozen topic vocabulary is imported from `@gitblocks/contracts`; the
provider-output TypeBox definition remains the sole provider DTO authority, so
the generated specification bytes do not change. The three durable
repository-interview roots, trusted constructors, parsers, identities, and
cross-root validation are owned by `@gitblocks/contracts`, not duplicated
here.

The renderer parses one exact `RepositoryArtifactSetV1` and zero through four
complete `RepositoryArtifactV1` values. Present entries receive `A1` through
`A4` in entry-ordinal order; `not-found` entries do not consume aliases.
Before any element access or iteration, the public renderer inspects the
artifact array through bounded property descriptors and copies only ordinary,
contiguous numeric data properties into a frozen owned array. Sparse arrays,
numeric accessors, non-enumerable entries, symbols, extra properties,
nonstandard prototypes, over-bound arrays, and throwing proxy reflection fail
as value-free `artifact-context-invalid` results without invoking an artifact
getter. The application additionally catches any unexpected renderer
exception as `prompt-render-failed` before an injected effect can run.
Artifact text is split with the contracts-owned LF/CRLF/CR logical-line
semantics and rendered exactly once as canonical JSON evidence. The separate
instruction string is the exact reviewed instruction bytes followed by the
eight exact ordered questions. Neither string injects candidate, repository,
artifact, artifact-set, path, URL, commit, provider, or execution identity.

The model-visible evidence object has exactly `kind`, `artifacts`, and
`unavailableSelections`. Present artifacts expose only alias, controlled kind,
line count, and one-based `{ number, text }` lines. Unavailable selections
expose only ordinal, selector, controlled kind, requirement, and `not-found`
outcome. Repository content remains inert JSON data in the future user-role
payload; structural separation is a necessary control, not a claim that
prompt injection is impossible.

Hard prompt limits are four artifacts, 524,288 artifact source bytes, 40,000
logical lines, 65,536 instruction bytes, 4,194,304 evidence bytes, and
4,259,840 combined bytes. Bounds fail closed without truncation.

The prompt digest is lowercase SHA-256 over canonical JSON containing the
`repository-interview-prompt` domain, digest version 1, renderer version,
specification version/digest, and the exact instruction/evidence strings. The
provider-output digest is lowercase SHA-256 over canonical JSON containing the
`repository-interview-provider-output` domain, digest version 1, schema
version/digest, and the exact parsed provider output. Array order and exact
Unicode remain significant. The frozen synthetic examples are:

```text
prompt          bdfa0ac1bd39782028a3e3f5598cf980ae5066aaef24068eee0c1a45059ff584
provider output e245c7db27f96709263f120760ff4394602ae70053bd4f0162a59dcf82b2789c
```

Resolution validates every alias against the exact rendered registry and every
inclusive interval against the artifact's actual logical-line count. It maps
coordinates to trusted artifact IDs, creates one deterministic top-level
coordinate catalog, and returns claims, limitations, contradictions, and
unknowns shaped for the existing durable constructor. It creates no durable
ID or timestamp.

`executeRepositoryInterviewV1` accepts only an artifact set, complete
artifacts, reviewed specification, exact model profile, execution mode, and
force reason. It renders the prompt internally, freezes that ephemeral trusted
object, and passes the exact same object instance to both the injected provider
port and trusted output resolver. Neither callers nor ports may substitute a
prompt, aliases, trusted IDs, digests, nonce, timestamps, attempts, usage, or
provider output.

Normal execution looks up reuse by request identity, model-profile digest, and
reuse-key digest. A valid complete historical exchange is returned without a
nonce, provider operation, clock read, or publication. Poisoned or mismatched
reuse fails closed. Forced execution skips lookup, consumes one injected
lowercase-hex nonce, preserves the deterministic request/reuse authority, and
appends a distinct execution.

The provider port receives only the exact prompt object, exact model profile,
and the loaded OpenAI projection version, digest, and reviewed snapshot text.
Before provider-output resolution, a `response` effect must prove one or two
valid, ordered, non-overlapping attempts ending in an HTTP 2xx response and
valid token usage. Malformed attempt or terminal metadata is a value-free
`provider-port-failure` with no clock read or publication. When only token
accounting is invalid, the application publishes one `invalid-usage` failed
execution with null durable usage, output digest, and interview, without
resolving provider output. Controlled failed effects must directly construct
their declared failed execution; malformed non-null usage is not silently
replaced with null. Other expected provider failures become content-free
failed executions. Valid responses are resolved against the same prompt,
while structurally or semantically invalid output and alias/range failures
become `provider-output-invalid` without retaining raw output. The record port
receives only `{ request, execution, interview }`; failed execution uses a
null interview. Reuse bundles and idempotent publication records are parsed
and checked before return.

Application failures use fixed, bounded, value-free issues. The application
use case reads no clock, randomness, process state, environment, filesystem,
database, or network directly; every effect is injected. Test-owned fakes
cover provider response/failure/throw/mutation, record
reuse/publication/conflict/throw, deterministic clocks, and deterministic
nonces.

The OpenAI adapter implements only `POST https://api.openai.com/v1/responses`
with no SDK or global-fetch fallback. Preflight authenticates the exact
renderer object and committed strict projection, accepts only the two dated
calibration candidates, and validates the model profile before credentials or
other effects. The wire body has fixed property order and contains only the
developer instruction string, user evidence string, strict JSON Schema,
reasoning/output controls, `store: false`, disabled background/stream/tools/
truncation, default service tier, and the exact mapping
`promptCacheRetention: in-memory` to
`prompt_cache_retention: "in_memory"`. Caller, credential, transport,
environment, organization, project, or response data cannot override that
mapping; extended cache options, keys, breakpoints, and TTL fields are absent.

Requests are capped at 10,485,760 UTF-8 bytes. The adapter permits two
120-second attempts within a 300-second operation, one deterministic eligible
retry, and at most 30 seconds of provider-directed delay. It streams response
bodies within the profile limit, strictly decodes UTF-8, retains only
allowlisted parsed header values, validates token accounting, ignores reasoning
items, discards refusal/error text, and returns owned frozen port results.
Expected HTTP, provider-status, transport, cancellation, usage, refusal, and
response-shape outcomes use the existing controlled failure taxonomy; raw
bodies, headers, prompts, credentials, and exception text never enter results.

`store: false` is not Zero Data Retention. The explicit `"in_memory"` field is
GitBlocks request intent and is not proof that abuse-monitoring or other
organization-level retention is absent. The adapter neither inspects nor
verifies organization/project ZDR. Before any real provider call, the pre-live
gate must verify ZDR for the exact organization/project or cite updated
authoritative OpenAI documentation or provider confirmation proving the
field's effective behavior for the exact snapshot.

This package still does not contain artifact persistence loading, a concrete
PostgreSQL composition adapter, an operator, receipts, production telemetry,
or live execution. Neither calibration snapshot is selected, and ordinary
tests make no provider request.

All package imports are side-effect-free. Filesystem access occurs only when a
caller explicitly loads, generates, or validates a specification. Ordinary
tests and specification validation deny live network access.
