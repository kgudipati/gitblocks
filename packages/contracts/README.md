# `@gitblocks/contracts`

Versioned, transport-neutral DTO schemas and safe object-value parsers for the
GitBlocks fit-assessment kernel.

## Boundary

TypeBox definitions are the single source for static TypeScript DTO types and
JSON Schema 2020-12. One private Ajv2020 instance validates those definitions
with coercion, defaults, property removal, format lookup, and caller-supplied
schemas disabled. Successful structural values are mapped into
`@gitblocks/domain`, whose pure validators enforce cross-field, reference,
candidate-ownership, hard-constraint, outcome, and ranking invariants.

Each parser accepts `unknown` and returns either:

```ts
{ ok: true, value, domain, issues: [] }
```

or:

```ts
{ ok: false, issues: readonly ContractIssue[] }
```

The `value` is the validated V1 DTO. The `domain` is a fresh canonical owned
value. Parsers never mutate the input, perform I/O, dynamically import input,
or return rejected values in diagnostics.

The public V1 parsers are:

- `parseCapabilityRequestV1`
- `parseRepositoryFingerprintV1`
- `parseCandidateDossierV1`
- `parseFitAssessmentRequestV1`
- `parseFitAssessmentResponseV1`
- `parseErrorEnvelopeV1`

`validateFitAssessmentExchangeV1` additionally proves that one independently
valid request and response agree on candidate set, constraints, evidence,
unknowns, cutoff, request ID, and correlation ID.

## Schema artifacts and limits

`getContractSchemaV1(name)` returns a fresh canonically ordered JSON-compatible
schema value. `serializeContractSchemaV1(name)` returns its deterministic
newline-terminated representation. Every root has an explicit `1.0.0` `$id`,
uses Draft 2020-12, and is closed at every untrusted object shape.

The object-value preflight bounds depth at 32, scheduled/visited values at
200,000, own properties at 64 per object, array width at 2,000, scalar strings
and property names at 4,096 UTF-16 code units, and aggregate value/name string
work at 64,000,000 code units. Schema-specific bounds are narrower.
Diagnostics are capped at 20 issues, 256 path characters, and 160 safe message
characters. The package accepts already-materialized object values; transport
adapters remain responsible for byte, content-type, decompression, and
JSON-text parse limits.

V1 is exact and closed. A shape change requires a separately versioned schema
and parser rather than silently widening `1.0.0`.
