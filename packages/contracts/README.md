# `@gitblocks/contracts`

Versioned, transport-neutral DTO schemas and safe object-value parsers for the
GitBlocks fit-assessment kernel.

## Boundary

TypeBox definitions are the single source for static TypeScript DTO types and
JSON Schema 2020-12. One private Ajv2020 instance validates those definitions
with coercion, defaults, property removal, format lookup, and caller-supplied
schemas disabled. Successful structural values are mapped into
`@gitblocks/domain`, whose pure validators enforce cross-field, reference,
candidate-ownership, source-aware provenance, epistemic, candidate-reason,
limitation-preservation, processing-state, hard-constraint, outcome, and
ranking invariants.

Each parser accepts `unknown` and returns either:

```ts
{ ok: true, value, domain, issues: [] }
```

or:

```ts
{ ok: false, issues: readonly ContractIssue[] }
```

The `value` is the validated V1 DTO. For fit-assessment kernel contracts,
`domain` is a fresh canonical domain value. Immutable artifact contracts have
no domain mapping: their `domain` result is the same validated inert DTO.
Parsers never mutate the input, perform I/O, dynamically import input, or
return rejected values in diagnostics.

The public V1 parsers are:

- `parseCapabilityRequestV1`
- `parseRepositoryFingerprintV1`
- `parseCandidateDossierV1`
- `parseFitAssessmentRequestV1`
- `parseFitAssessmentResponseV1`
- `parseErrorEnvelopeV1`
- `parseRepositoryArtifactV1`
- `parseRepositoryArtifactChunkV1`
- `parseRepositoryArtifactSetV1`

`validateFitAssessmentExchangeV1` additionally proves that one independently
valid request and response agree on candidate set, constraints, evidence,
unknowns, supplied candidate limitations, cutoff, request ID, and correlation
ID.

## Repository facts and evidence

Repository fingerprints set `factVocabularyVersion` independently from the
root `contractVersion`. Component/version and deployment facts remain typed
universal variants. Other first-ecosystem observations use one closed `coded`
shape containing a coarse category, bounded stable `code`, optional bounded
`subjectCode`, an explicit presence/classification/code-set/integer value
variant, and provenance. The domain-owned controlled vocabulary decides which
category/code/subject/value combinations have supported meaning.

Adding an ordinary registered fact that fits those variants changes the
negotiated fact vocabulary, not the DTO object shape. An unknown code or a
known code with unsupported semantics fails closed. The schema has no generic
record, arbitrary JSON value, raw source/configuration/environment carrier,
secret, log, command output, or scanner metadata escape hatch. Withheld
categories remain explicitly represented.

Consumers inspect a negotiated vocabulary through the domain package's
`getRepositoryFactVocabularySnapshot(version)` accessor, not a live exported
registry. Each call returns fresh deterministic data only; unsupported versions
fail explicitly, and consumer mutation cannot change parser acceptance.
`serializeRepositoryFactVocabulary(version)` supplies the digest-bound
canonical representation. Validation always selects private immutable
authority using the fingerprint's `factVocabularyVersion`.

Fact provenance uses `epistemicStatus: direct | declared | derived`, and mapping
preserves the supplied meaning exactly. Evidence observations use
source-aware discriminated variants for `git-commit`, `tag`, `release`,
`package-version`, `security-advisory`, `mutable-documentation`, and
`approved-validation`. Immutable variants require compatible source types,
exact non-mutable revisions, matching immutable locators, and coherent
publication/collection/freshness chronology. Package versions must be exact
semantic versions; partials, ranges, and dist-tags fail, while concrete
prereleases remain valid. Tag and release revisions reject branch references
and mutable aliases. Mutable documentation declares its mutability and
limitation without a false immutable locator. Approved validation uses only a
bounded validation reference, scope, and time; it cannot carry provider
results, validation output, or an arbitrary source body.

Every response candidate reason must resolve to candidate-owned evidence or
inference, a disclosed applicable material unknown, or a matching hard
conflict whose evidence is retained. `candidateLimitations` plus each
assessment's `limitationIds` preserve every supplied limitation through
exchange validation. `assessmentProcessing` describes coverage separately
from uncertainty: `complete` may coexist with material unknowns, while
`partial-evidence` requires bounded `incompleteReasonCodes`. Every
`insufficient-evidence` candidate references an applicable disclosed unknown.

## Schema artifacts and limits

`getContractSchemaV1(name)` returns a fresh canonically ordered JSON-compatible
schema value. `serializeContractSchemaV1(name)` returns its deterministic
newline-terminated representation. The public schema-name catalog is runtime
frozen and cannot be widened through consumer mutation. Every root has an
explicit `1.0.0` `$id`, uses Draft 2020-12, and is closed at every untrusted
object shape. The six accepted fit-assessment roots retain their exact schema
digests; the three repository-artifact roots are additive. A root shape change
after publication requires a separately versioned schema/parser and explicit
negotiation; controlled fact-vocabulary evolution is negotiated separately.

The object-value preflight bounds depth at 32, scheduled/visited values at
200,000, own properties at 64 per object, array width at 2,000, scalar strings
and property names at 4,096 UTF-16 code units, and aggregate value/name string
work at 64,000,000 code units. Artifact parsers use a separate bounded
preflight that admits an exact artifact body only up to 256 KiB while retaining
the original 4,096-code-unit scalar limit for unrelated roots. Schema-specific
bounds are narrower.
Diagnostics are capped at 20 issues, 256 path characters, and 160 safe message
characters. The package accepts already-materialized object values; transport
adapters remain responsible for byte, content-type, decompression, and
JSON-text parse limits. Production adapters must pass JSON-parsed or otherwise
data-only values.

Preflight rejects accessors, exotic prototypes, cycles, and unsupported object
forms. An arbitrary hostile in-process JavaScript `Proxy` is already executable
and may run a trap during reflective inspection; it is outside the inert-data
guarantee. A thrown trap becomes one bounded, value-free rejection without trap
text or a stack trace. The contract does not claim that the trap was never
invoked, and it does not add Node-specific proxy detection to imply a
cross-runtime guarantee.

V1 is exact and closed. A shape change requires a separately versioned schema
and parser rather than silently widening `1.0.0`.
