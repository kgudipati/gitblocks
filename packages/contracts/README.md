# `@gitblocks/contracts`

Versioned, transport-neutral DTO schemas and safe object-value parsers for the
GitBlocks product kernel.

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
`domain` is a fresh canonical domain value. Immutable artifact and
repository-interview contracts have no domain mapping: their `domain` result
is the same validated inert DTO. Repository-interview parsers additionally
copy accepted input into fresh owned data before semantic use. Parsers never
mutate the input, perform I/O, dynamically import input, or return rejected
values in diagnostics.

The public V1 parsers are:

- `parseCapabilityQueryInputV1`
- `parseCapabilityQueryNormalizationResultV1`
- `parseCapabilityTaxonomySourceV1`
- `parseCapabilityTaxonomyV1`
- `parseCapabilityRequestV1`
- `parseRepositoryFingerprintV1`
- `parseCandidateDossierV1`
- `parseFitAssessmentRequestV1`
- `parseFitAssessmentResponseV1`
- `parseErrorEnvelopeV1`
- `parseRepositoryArtifactV1`
- `parseRepositoryArtifactChunkV1`
- `parseRepositoryArtifactSetV1`
- `parseRepositoryInterviewRequestV1`
- `parseModelExecutionV1`
- `parseRepositoryInterviewV1`
- `parseDeterministicCandidateProfileV1`
- `parseDeterministicCandidateProfileAuthorityV1`

`validateFitAssessmentExchangeV1` additionally proves that one independently
valid request and response agree on candidate set, constraints, evidence,
unknowns, supplied candidate limitations, cutoff, request ID, and correlation
ID.

`normalizeCapabilityQueryV1` performs the local pre-approval transition using
validated input, exact taxonomy authority, and an optional injected bounded
candidate-reference authority.
`validateCapabilityQueryNormalizationExchangeV1` recomputes the complete
deterministic result and rejects input, taxonomy, catalog, source, modality,
outcome, ordering, or digest drift. It does not create CapabilityRequestV1,
grant transmission approval, filter candidates, or perform retrieval.
Standalone result parsing first checks the closed schema, then pure semantic
outcome, provenance, candidate-binding, capacity, generated-ID, and canonical
ordering invariants, and only then verifies the semantic digest and
normalization ID. A correctly re-digested but impossible result therefore
fails without requiring the original input or authorities.

The complete canonical query input has one digest. The normalization semantic
digest binds it to taxonomy `1.0.0`, normalizer `1.0.0`, any used candidate
catalog version/digest, all results, and the preserved fingerprint reference.
`normalizationId` is derived from the first 48 semantic-digest hex characters;
there is no redundant record digest.

Input bounds are 1,000 summary code units, 1–8 explicit capability terms,
1–20 success conditions, 0–32 draft constraints, 0–10 exact candidate
references, 120 code units per lookup term, and 500 per statement. Result
bounds are 8 normalized capability concepts, 32 normalized constraints, 50
unresolved terms, 64 clarifications, 40 notices, and 64 normalization steps.
The unresolved maximum is derived from 8 capability terms, 32 constraints,
and 10 candidate references. The injected authority ceiling is 200 candidates,
and candidate-ID references index the exact candidate ID rather than an alias.

The additive JSON Schema digests are
`d48e018b71f8e6947f60f4d3559c48047daba8a335168b51f37bfb5199c81b9b`
for CapabilityQueryInputV1 and
`bdd7db9510937c0728f87b0d83f75dbd374555fa17c2b1e4a56399d9f9f2d06b`
for CapabilityQueryNormalizationResultV1.

The additive deterministic-profile roots are
`DeterministicCandidateProfileV1` and
`DeterministicCandidateProfileAuthorityV1`. Their JSON Schema digests are
`3bbfdf2050c13a3d70e9dc289db7c8768a6fdcba8605cf12191e08560387af61`
and `7a79a1671bf461127099e3ae2f75d29e949387987041bd3402f2614b747ed8cf`.
The field schemas are closed per field ID and preserve typed catalog,
structured-snapshot, artifact-entry, or derived-field provenance without URLs,
provider bodies, observations, or unrestricted metadata. Constructors
canonicalize before deriving semantic digests and `profile-` identities from
the first 48 digest hex characters. The authority has no redundant record
digest or non-semantic payload.

## Capability taxonomy authority

The additive `CapabilityTaxonomySourceV1` and `CapabilityTaxonomyV1` roots own
the reviewed source and generated authority shapes. The source parser accepts
unknown, performs closed structural validation, and delegates semantic
invariants to `@gitblocks/domain`. `buildCapabilityTaxonomyV1` canonically
orders every top-level and nested set, attaches `contractVersion`, and derives
the semantic digest. The generated parser additionally rejects order, digest,
or source-projection drift.

The semantic digest excludes only `semanticDigest` itself and the explicitly
non-semantic `releaseMetadata`; it includes contract version, taxonomy version,
concepts, resolved aliases, ambiguities, and exclusions. Package-local scripts
own bounded fixed-path filesystem access. Contract and domain imports remain
free of filesystem, environment, network, database, model, provider, clock,
locale, and randomness effects.

`validateRepositoryInterviewExecutionV1` proves that one independently valid
request, successful model execution, and durable interview agree on candidate
and artifact-set ownership; request, execution, specification, renderer,
provider-output schema/projection, prompt, model-profile, and provider-output
provenance; and complete identities. It intentionally does not prove artifact
membership or exact artifact line closure; `@gitblocks/interviews` now proves
those conditions before supplying durable constructor inputs.

`splitRepositoryArtifactLogicalLines` is the shared Phase 6/7 logical-line
authority. It treats LF, CRLF, and CR as separators; returns line text without
the separator; preserves blank lines and the terminal empty line after a final
separator; returns `['']` for empty content; and rejects invalid Unicode
without trimming, normalization, replacement, or rewriting. Artifact parsing
uses the helper when validating `RepositoryArtifactV1.lineCount`, and the
repository-interview renderer uses the same helper for one-based citation
coordinates.

## Durable repository-interview records

The three additive `1.0.0` roots are
`RepositoryInterviewRequestV1`, `ModelExecutionV1`, and
`RepositoryInterviewV1`. The frozen ordered
`REPOSITORY_INTERVIEW_TOPICS` vocabulary is shared with the interviews
provider-output schema, but provider DTOs remain owned exclusively by
`@gitblocks/interviews`.

Trusted creation helpers accept no caller-authored IDs or digests. They reject
non-plain or unsupported shapes, copy inputs, preserve semantic strings
byte-for-byte without Unicode normalization, canonicalize ordering, and derive
full SHA-256 identities, 48-hex shortened IDs, and complete record digests.
The prefixes are `intreq-`, `modelexec-`, `interview-`, `intcite-`,
`intclaim-`, `intlimit-`, `intcontra-`, and `intunknown-`.

The request has no timestamp or model/provider setting. An execution separates
its request/profile reuse key, trusted nonce/mode identity, and terminal
record. It stores only bounded attempt, usage, outcome, and safe provider-ID
metadata—never prompts, source, responses, reasoning, refusals, headers, URLs,
or raw errors. Nullable provider identifiers must match
`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$` and are never transformed when invalid.
Success requires the final attempt to be an HTTP 200–299 response; the
transport-terminal failure codes close against the corresponding final
transport outcome. Model snapshots retain their dated suffix and additionally
must end in a real proleptic Gregorian date. An interview stores mapped
artifact IDs and inclusive line intervals, model-authored claims, limitations,
contradictions, and unknowns; it has no dossier, review, ranking,
recommendation, or current-selection field.

Cross-root execution validation additionally requires
`interview.publishedAt >= execution.completedAt`. Publication time remains
record-only and does not participate in interview identity.

Interview processing state is derived: zero directly grounded topics is
`insufficient-evidence`; all eight topics directly grounded by documented
claims or documented limitations with no contradictions or unknowns is
`complete`; every other valid state is `partial-evidence`. Parsers enforce
canonical ordering, topic coverage, semantic text policy, nested identity and
record integrity, citation resolution, duplicate rejection, and no orphan
citations.

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
`approved-validation`, plus the additive `structured-provider-snapshot` for
closed GitHub/npm snapshot facts. Immutable variants require compatible source types,
exact non-mutable revisions, matching immutable locators, and coherent
publication/collection/freshness chronology. Package versions must be exact
semantic versions; partials, ranges, and dist-tags fail, while concrete
prereleases remain valid. Tag and release revisions reject branch references
and mutable aliases. Mutable documentation declares its mutability and
limitation without a false immutable locator. Approved validation uses only a
bounded validation reference, scope, and time; it cannot carry provider
results, validation output, or an arbitrary source body. Structured snapshots
bind a controlled provider/source class, canonical identity, authority/record
digests, effective and collection times, completeness, and the mandatory
mutable limitation. They cannot carry raw responses, credentials, headers,
temporary URLs, or arbitrary JSON.
The structured snapshot exists only in the additive candidate-authority
observation branch used by candidate dossiers and fit assessments. The
historical `EvidenceObservationV1` DTO remains byte-identical for Phase 8 and
the current persistence schema.

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
object shape. The six accepted fit-assessment roots, three repository-artifact
roots, three repository-interview roots, and two capability-taxonomy roots
retain their exact schema digests. The capability-query input/normalization
result and two deterministic-profile roots append additively. A root shape
change after publication requires a separately versioned schema/parser and
explicit negotiation; controlled fact-vocabulary evolution is negotiated
separately.

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
