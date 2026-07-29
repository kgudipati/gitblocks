# ADR 0003: Product domain and contract kernel

- Status: accepted
- Date: 2026-07-28
- Decision owners: GitBlocks maintainers
- Governing issue:
  [#9 — Phase 3: Establish the product domain and contract kernel](https://github.com/kgudipati/gitblocks/issues/9)
- Execution plan:
  [Phase 3 product contract kernel](../../plans/0009-product-contract-kernel.md)
- Related decisions:
  [ADR 0001](0001-agent-native-delivery.md),
  [ADR 0002](0002-typescript-workspace-and-toolchain.md)
- Related contracts:
  [GitBlocks product contract](../../product/product-contract.md),
  [system context](../system-context.md)

## Context

GitBlocks needs one durable language for capability requests, minimized
repository fingerprints, supplied candidate dossiers, attributable evidence,
inferences, hard constraints, unknowns, candidate dispositions, partial
rankings, responsible outcomes, fit-assessment requests and responses, and
stable neutral errors.

The first production code must not couple those concepts to the Phase 2
evaluation schemas or to future HTTP, MCP, database, GitHub, scanner, queue,
model, framework, or storage choices. At the same time, future adapters need a
language-neutral schema representation, and current TypeScript code needs
static types and runtime validation of untrusted `unknown` values.

Maintaining a TypeScript interface, runtime validator, and JSON Schema by hand
would create three authorities. Using the evaluation JSON Schemas would import
scoring and corpus lifecycle concerns into the product. Selecting a framework
request type or storage record would reverse dependency direction.

ADR 0002 intentionally left the product schema mechanism open. Ajv `8.20.0`
currently validates only private evaluation records; its presence in the
lockfile is evidence about compatibility, not sufficient reason to make it a
product dependency.

## Decision

### Package and ownership boundary

Create exactly two private production-owned packages:

```text
@gitblocks/domain
@gitblocks/contracts
```

`@gitblocks/domain` owns readonly internal values, normalized identifiers, pure
constructors, canonicalization, and cross-field business invariants. It has no
runtime dependency and no Node, schema, tool, evaluation, filesystem, network,
environment, clock, randomness, framework, provider, transport, or persistence
capability.

`@gitblocks/contracts` owns versioned external DTO definitions, static DTO
types, structural validation, safe parser results, DTO-to-domain mapping,
contract-version checks, and language-neutral schema exports. It may depend
only on `@gitblocks/domain`, `typebox`, and `ajv`.

The concrete dependency direction is:

```text
tools/evaluation-harness
        |
        v
@gitblocks/contracts
        |
        v
@gitblocks/domain
```

Future dependency direction remains:

```text
HTTP / MCP / GitHub / database / queue / filesystem / model / framework adapters
        |
        v
application use cases
        |
        v
contracts and domain
```

The reverse directions are prohibited. Product packages cannot import tools,
evaluation records or schemas, adapters, frameworks, providers, or storage
representations.

### Authoritative contract mechanism

Use the unscoped package `typebox@1.3.8` as the sole source for each external
DTO's structure:

- a TypeBox value is itself a JSON Schema object;
- `Type.Static<typeof Schema>` derives the TypeScript DTO type; and
- the same schema object is compiled by the private runtime validator.

Do not install the older scoped `@sinclair/typebox` LTS package. TypeBox's
[official version matrix](https://github.com/sinclairzx81/typebox#versions)
states that unscoped TypeBox 1.x is the latest ESM-only line, supports
TypeScript 6.0 through 7+, and provides native JSON Schema 2020-12. Its
[official repository](https://github.com/sinclairzx81/typebox) documents that
the generated objects are JSON Schema and statically resolve through
`Type.Static`.

Use `ajv@8.20.0` through the `Ajv2020` ESM entry point as the structural
validator. Each package module owns a private validator instance configured
with:

```text
strict: true
allErrors: false
coerceTypes: false
useDefaults: false
removeAdditional: false
verbose: false
messages: false
validateFormats: false
```

Ajv's [Draft 2020-12 documentation](https://ajv.js.org/json-schema.html#draft-2020-12)
requires the 2020 entry point and documents full keyword support for that
draft. Its [options documentation](https://ajv.js.org/options.html) confirms
that coercion, default insertion, additional-property removal, verbose input
detail, and all-error collection are independently controllable.

The validator compiles only trusted, checked-in TypeBox schema objects during
module initialization. Parsers never load, compile, or dynamically import
caller-supplied schemas. Production adapters must supply JSON-parsed or
otherwise data-only values. The parser rejects accessors, exotic prototypes,
cycles, and unsupported object forms, but reflective JavaScript inspection
cannot guarantee that an arbitrary hostile in-process `Proxy` has no executable
traps. Such already-executable proxy objects are outside the inert-data
guarantee; a trap may run while the parser safely converts a thrown value into
one bounded, value-free rejection.

Ajv is an explicit product decision here, not accidental reuse of evaluation
tooling. TypeBox stays the schema/type authority; Ajv is a replaceable private
evaluator of that authority.

### Approved TypeBox subset

Product DTO definitions use a deliberately small JSON-compatible subset:

- objects, arrays, strings, finite literals, booleans, integers, null,
  optional properties, and unions;
- const-tagged union branches;
- stable `$id` values and the Draft 2020-12 `$schema` URI;
- explicit string/array/numeric bounds and patterns; and
- `additionalProperties: false` on every object at every untrusted boundary.

One owned closed-object helper applies `additionalProperties: false`; direct
open object construction is prohibited in contract definitions.

The contracts do not use:

- `Type.Any`, `Type.Unknown`, `Type.Unsafe`, `Type.Script`, transforms, codecs,
  custom kinds, custom formats, or caller-provided schemas;
- TypeBox `Value.Convert`, `Value.Default`, `Value.Clean`, `Value.Cast`,
  `Value.Create`, or decode/transform operations;
- schema `default` annotations;
- Ajv type coercion, default insertion, property removal, `$data`, custom
  keywords, asynchronous schema loading, or OpenAPI `discriminator`; or
- a generic arbitrary metadata/value record.

TypeBox's ordinary `Type.Object` is open unless
`additionalProperties: false` is supplied, so tests and schema inspection
enforce closure rather than relying on a library default. `Type.Union` emits
standard `anyOf`; each branch uses a stable literal tag where variant identity
matters.

### Structural validation and domain validation

The boundary is explicit:

```text
unknown value
  -> object-graph resource preflight
  -> TypeBox/Ajv structural validation
  -> TypeBox-derived DTO
  -> explicit DTO-to-domain mapping
  -> pure domain-invariant validation and canonicalization
  -> typed success or GitBlocks-owned issues
```

Structural validation owns:

- exact contract version literal;
- required and unknown fields;
- JSON-compatible primitive types;
- closed object and discriminated-union shape;
- string patterns and length bounds;
- numeric ranges;
- array size and element shape; and
- locally expressible uniqueness where JSON Schema can state it safely.

Domain validation owns:

- normalized and locally unique stable identifiers;
- reference resolution and candidate ownership;
- evidence, inference, claim, unknown, limitation, and epistemic semantics;
- source-aware evidence provenance, immutable-locator/revision coherence, and
  publication, collection, validation, and freshness chronology;
- attributable support for every candidate reason, independent of candidate
  disposition, plus favorable attributable-claim support for every recommended
  or viable disposition;
- exact preservation of supplied candidate limitations through the response
  catalog and candidate-owned assessment references;
- contradictory facts;
- hard-conflict disposition and ranking safety;
- responsible outcome/disposition combinations;
- assessment-processing state independently of material unknowns;
- exact candidate-assessment coverage;
- rank ties, partial order, incomparability, contradictions, tie propagation,
  and cycle detection; and
- canonical ordering where order is not meaningful.

Schema validity is neither authorization nor evidence correctness. A future
application boundary still authorizes actors and objects and compares a
response with its request. The response contains its declared supplied
candidate set for response-local exact-coverage validation; a separate pure
request/response consistency function proves that declaration matches the
actual request.

### External DTOs and internal domain values

External DTOs are versioned serialization values. Their identifiers are
bounded strings and their collections preserve contract-defined wire order.
They contain correlation, approval, provenance, and serialization fields
needed at an untrusted boundary.

Internal domain values use readonly structures and typed/opaque identifiers
where category errors matter. Constructors validate or create those
identifiers. Domain validation may canonicalize unordered catalogs and
reference sets without rewriting semantically meaningful rank-group or request
order.

Parsers return a discriminated result:

```text
{ ok: true, value: VersionedDto, domain: CanonicalDomainValue, issues: [] }
{ ok: false, issues: ContractIssue[] }
```

They do not return the input through a structural cast. DTO types and schema
objects remain exported for transport and SDK consumers. On success, `value`
is the structurally validated TypeBox-derived DTO and `domain` is a freshly
mapped, validated, and canonicalized owned domain value. The neutral error
envelope follows the same result shape; its `domain` member is a fresh
canonical copy of the validated DTO because it has no separate business-domain
representation.

### Durable repository-fact vocabulary

Repository fingerprints retain typed universal facts for component/version and
deployment observations. All other supported first-ecosystem facts use one
closed `coded` fact shape:

```text
kind: coded
category: repository-capability | repository-structure | identity |
          data-policy | operations
code: bounded stable code
subjectCode: bounded stable code or null
value: closed presence | classification | code-set | integer variant
provenance: origin plus epistemicStatus
```

The value variants are explicitly typed and bounded. Presence records a finite
state, classifications and code sets use stable codes, and integers carry
contract bounds. The shape cannot carry a generic record, arbitrary JSON,
source excerpts, raw configuration or environment values, secrets, logs,
command output, or scanner/provider payloads. Withheld-category disclosure
remains a separate bounded catalog rather than a disguised fact value.

The domain owns a controlled registry that defines the allowed category, code,
optional subject, value variant, and bounded value vocabulary for each fact
code. A structurally valid but unregistered code is an unknown fact code and
fails closed. A registered code used with the wrong category, subject, value
variant, or controlled value is an unsupported fact semantic and also fails
closed. Neither case is converted into an arbitrary metadata escape hatch.

Validation authority is private runtime state, not a public JavaScript
collection. Each supported vocabulary version maps to its own deeply frozen
registry, including every nested subject, policy, state, and controlled-code
array. Semantic validation selects that registry from the fingerprint's
supplied `factVocabularyVersion`; it never searches an implicitly mutable
"current" registry. Repository-fact categories, presence states, and
capability families likewise use private frozen membership authority.

Public vocabulary inspection uses
`getRepositoryFactVocabularySnapshot(version)`, which either returns a fresh,
deterministically ordered, data-only deep snapshot or explicitly reports an
unsupported version. Mutating a returned array, definition, or nested code
array cannot reach internal validation authority. Capability-family inspection
also returns a fresh array. No live authoritative collection is exported.
`serializeRepositoryFactVocabulary(version)` provides the deterministic
newline-terminated representation used by exact SHA-256 drift tests.

`factVocabularyVersion` negotiates that registry separately from the root
contract version. Adding an ordinary first-alpha fact whose meaning fits the
existing categories and typed value variants extends the controlled vocabulary
without changing the serialized object shape or root JSON Schema. Producers
must negotiate a vocabulary version that the consumer supports before using a
new code. A fact that cannot be represented truthfully by the existing closed
categories and value variants requires schema-shape evolution instead of
overloading a code or value.

### Evidence provenance and epistemic status

An evidence observation does not combine an unconstrained source type with an
independent revision. Its `source` is a closed discriminated variant:

- `git-commit` uses a compatible repository/documentation/license source type,
  a full lowercase 40-character commit SHA, an immutable locator containing
  that exact SHA, and non-null publication and collection times;
- `tag`, `release`, `package-version`, and `security-advisory` use compatible
  source types, exact non-mutable revision identifiers, immutable locators
  containing those identifiers, and publication and collection times;
- `mutable-documentation` has explicit mutable classification, a bounded
  `source-is-mutable` limitation, collection time, and freshness scope, with no
  false immutable locator;
- `approved-validation` uses a bounded validation reference, scope, and
  validation time rather than pretending that an approved internal result is a
  public URL or Git revision.

Mutable aliases such as `latest`, `current`, `stable`, `next`, `main`,
`master`, `head`, and `canary` are not revisions. Immutable evidence requires
an exact locator/revision match. Package versions are exact semantic versions,
so partial versions, ranges, and dist-tags fail while concrete prereleases such
as `2.0.0-canary.123` remain reproducible. Tag and release values reject branch
references and mutable alias forms while retaining concrete versioned
prerelease identifiers. Publication cannot follow collection, and collection
or validation cannot follow the declared freshness time or request cutoff.
Source URLs are bounded HTTPS locators without user information or query
values. No variant carries an arbitrary source body, provider result,
validation output, or raw evidence payload.

Repository-fact provenance records `epistemicStatus` as one of `direct`,
`declared`, or `derived`. A fact parsed directly from an approved manifest,
lockfile, configuration shape, or repository structure remains `direct`; a
supplied declaration remains `declared`; and a scanner conclusion combining
observations remains `derived`. Domain mapping and canonicalization preserve
the supplied status exactly, and domain validation rejects incoherent
origin/status combinations. In particular, a declaration is never silently
renamed to a derived conclusion.

### Candidate explanation, limitation, and processing integrity

Every candidate reason is a material explanatory statement. Each reason must
resolve to at least one support path: candidate-owned evidence,
candidate-owned inference, a disclosed material unknown applicable to the
candidate or assessment, or a matching candidate hard-constraint conflict
whose reason code and evidence are preserved. A favorable claim elsewhere does
not support unrelated prose. The rule applies equally to recommended, viable,
rejected, and insufficient-evidence candidates, and diagnostics never echo an
unsupported statement.

Responses carry a `candidateLimitations` catalog and each candidate assessment
uses `limitationIds` to retain candidate-owned limitations. Exchange validation
requires exact preservation of every supplied decision-relevant limitation,
including its owner, bounded statement, and candidate-owned evidence
references. Unknown, moved, altered, duplicate, or contradictory limitations
fail deterministically. Retaining a material limitation describes a tradeoff;
it does not by itself reject an otherwise viable candidate.

`assessmentProcessing` describes processing coverage, not epistemic certainty.
`complete` means every supplied input and all available evidence were
processed, and therefore has no incomplete-reason codes.
`partial-evidence` requires one or more stable bounded
`incompleteReasonCodes`. Material unknowns remain an independent catalog: a
complete assessment may disclose unknowns, and a responsible
`insufficient-evidence` outcome may follow after complete processing of every
available source. Every insufficient candidate references an applicable
disclosed material unknown, so the outcome remains grounded in epistemic state
rather than processing status. Processing state cannot suppress or silently
consume an unknown.

### Evaluation, storage, and transport distinctions

Evaluation contracts remain private, independently versioned test-instrument
contracts. Their case-pair controls, difficulty, failure-mode tags, scoring
truth, alternative outcomes, rationale notes, review lifecycle, manifest
hashes, and proposed gold do not enter product DTOs.

The evaluation harness owns the only gold-aware translation:

```text
case -> capability request + repository fingerprint
case candidates + evidence -> candidate dossiers
proposed gold -> response representability only
```

That translation validates all ten records and reports proposed/not-reviewed
provenance outside product DTOs. It does not score product quality, replace the
independent evaluator, expose gold to prediction producers, or make product
packages depend on the corpus.

Future persisted records are storage representations. They will require
migrations, tenant/access fields, retention, and mixed-version planning; they
must map to the owned values rather than become domain truth.

Future HTTP, MCP, event, and SDK forms are transport encodings. Adapters will
apply byte, decompression, authentication, authorization, deadline, and
transport-error rules, then invoke these parsers. HTTP status, JSON-RPC code,
and MCP error code do not enter the neutral product error envelope.

### Resource preflight and diagnostics

The contract package accepts an already-materialized JavaScript `unknown`, but
the supported production boundary is JSON-parsed or otherwise data-only.
Before Ajv traversal, an iterative preflight rejects:

- cycles;
- depth greater than the named contract bound;
- more than the named total object/array node bound;
- a scalar string or property name longer than the maximum schema-valid UTF-16
  representation;
- aggregate string value/name work beyond the named total UTF-16 code-unit
  bound;
- more than the named per-object property bound; and
- accessors, exotic prototypes, and other unsupported non-JSON object forms.

Transport/file byte, content-type, JSON-text, decompression, and parse limits
remain adapter responsibilities and are not falsely claimed here. A hostile
in-process `Proxy` is already executable JavaScript: standard reflective
inspection can invoke its traps, and cross-runtime JavaScript provides no
general inert-proxy detector. Proxy values are therefore outside the
inert-data guarantee. The structural and mapping boundary catches thrown values
and returns one bounded safe rejection without trap text or a stack trace, but
does not claim the trap was never invoked. Node-specific detection is not added
to manufacture a stronger cross-runtime guarantee.

GitBlocks owns every returned diagnostic. Validator error messages, schemas,
params, rejected keys, and rejected values never leave the package. The mapper
uses only the stable Ajv keyword and sanitized instance path to select an
allowlisted project code and constant safe message.

Diagnostics are:

- capped at 20 issues;
- sorted deterministically by safe path and stable code;
- limited to a 256-character path and 160-character message;
- free of stack traces, input values, unknown property names, source text,
  secrets, provider bodies, internal paths, and topology; and
- stable across adapters because transport-specific status is mapped later.

Structural validation stops early (`allErrors: false`); domain validation also
caps production. Tests cover unions and diagnostic floods because a validator
may still report more than one branch error for an `anyOf`.

### Schema artifacts

Schema artifacts are runtime exports, not committed generated JSON files:

- each of the six roots carries
  `$schema: "https://json-schema.org/draft/2020-12/schema"`;
- each has a stable absolute `$id` containing family and `1.0.0`;
- every nested object is closed;
- schemas contain no defaults or evaluation-only fields; and
- a package-owned canonical serializer recursively sorts object keys while
  preserving array order.

Tests assert each exact stable serialization through a committed expected
digest, schema identifiers, closure, allowed keywords, and Ajv meta-schema
compilation. This makes drift intentional without committing a second schema
authority. Future MCP/HTTP adapters and SDK generation import the public schema
registry or its canonical serializer. They do not recreate shapes.

### Versioning and compatibility

The first six contract families are exactly `1.0.0`, and the initial controlled
repository-fact vocabulary is `1.0.0`. V1 parsers accept only the supported
root literal, and fingerprint validation separately accepts only a negotiated
fact-vocabulary version. Missing, malformed, prerelease, later, or otherwise
unsupported versions fail with stable version issues.

Versioning distinguishes four cases:

1. **Schema-shape evolution** changes the accepted serialized object structure
   or meaning and requires a separately versioned root schema/parser with
   explicit producer/consumer negotiation.
2. **Controlled fact-vocabulary evolution** adds a registered fact code whose
   semantics fit the existing closed category, subject, and typed value
   variants. It changes the vocabulary version and registry, not the root
   object shape or schema digest.
3. **Unknown fact codes** are codes absent from the negotiated registry. They
   fail closed so an older consumer cannot guess their meaning.
4. **Unsupported fact semantics** use a known code with an incoherent category,
   subject, value variant, or controlled value, or require meaning the existing
   shape cannot state. Incoherent values fail; genuinely new semantics require
   schema-shape evolution rather than code reinterpretation.

Version negotiation therefore covers both root schema support and repository
fact-vocabulary support. A producer does not emit a newly registered code to a
consumer that negotiated only the earlier vocabulary, even though both
consumers can parse the same coded-fact object shape.

A controlled-vocabulary release requires a new vocabulary version, a new
private immutable registry entry, a reviewed expected serialization digest,
explicit negotiation support, and retention of prior registry definitions for
the documented compatibility window. Changing a fact definition, controlled
subject or value, registry membership, or semantic ordering changes that
version's digest. Once merged, the `1.0.0` registry is not silently edited.

Because V1 shapes are closed, even an optional field addition is not
operationally backward compatible with an exact V1 consumer. A changed shape
therefore receives a separately named/versioned schema and parser plus
explicit producer/consumer negotiation. After public release:

- a compatible clarification or implementation fix that does not change
  accepted serialized values is a patch;
- a new negotiated backward-compatible contract variant is at least a minor;
  and
- removal, reinterpretation, or incompatible shape change is a major.

Old parsers remain available for the documented transition window. Persisted
or deployed consumers require a separate rollout, rollback/forward-recovery,
and mixed-version plan. Before the first public/deployed consumer, Issue #9 may
correct the unpublished V1 design under review.

Contract version `1.0.0` is distinct from the private workspace package
version. Neither private package is published by this decision. The six
corrected roots remain `1.0.0` because the contracts are still unpublished,
unmerged, and have no public or deployed consumer; these corrections replace
the reviewed draft instead of creating a compatibility promise. After
publication, the normal compatibility rules above apply.

## Research and dependency review

Research used official project documentation, official repositories/releases,
npm registry metadata, the resolved pnpm graph, GitHub Advisory Database
queries, and the repository's pinned Node/TypeScript verification. Dates and
versions below were checked on 2026-07-28.

For each serious candidate, the record below names every comparison field
required by Issue #9. “Unknown” means the evidence collected for this decision
did not establish the fact; it is not a favorable assumption. Rejected
candidates were not installed or executed merely to fill a research gap.

### Serious candidates

| Approach                                        | Exact stable versions                            | Runtime/type/schema behavior                                                                                      | Decision                                                             |
| ----------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| TypeBox definitions plus Ajv2020                | `typebox@1.3.8`, `ajv@8.20.0`                    | JSON Schema objects are authoritative; `Type.Static` derives types; strict Ajv validates the same 2020-12 objects | Accepted                                                             |
| Zod 4 with native JSON Schema export            | `zod@4.4.3`                                      | Zod schema is runtime authority and `z.toJSONSchema` derives Draft 2020-12                                        | Rejected in favor of closer JSON Schema semantic parity              |
| Valibot with official exporter                  | `valibot@1.4.2`, `@valibot/to-json-schema@1.7.1` | Modular runtime schemas plus separate 2020-12 conversion                                                          | Rejected because conversion coverage/semantics are weaker            |
| JSON-Schema-first plus static inference and Ajv | `json-schema-to-ts@3.1.1`, `ajv@8.20.0`          | Literal schema is authoritative; `FromSchema` derives types; Ajv validates                                        | Rejected for incomplete 2020-12 typing and older TS support evidence |

Effect `3.22.0` and ArkType `2.2.3` were screened but not promoted to serious
finalists. Effect adds a substantially broader effect/runtime model and
transitive graph for a pure boundary. ArkType's current defaults preserve
undeclared keys, error structures include raw data, and its JIT and newer JSON
Schema surface add controls without improving this boundary.

### Selected packages

#### `typebox@1.3.8`

- Purpose: authoritative DTO/JSON Schema construction and static TypeScript
  inference.
- License: MIT.
- Published: 2026-07-24T10:02:35Z.
- Provenance: official
  [`sinclairzx81/typebox`](https://github.com/sinclairzx81/typebox) repository;
  npm trusted GitHub Actions publisher, registry signature, and SLSA
  provenance attestation.
- Compatibility: ESM only; official TypeBox 1.x matrix supports TypeScript
  6.0–7+ and native Draft 2020-12. The package declares no Node engine; the
  final build/tests verify Node 24.12+ policy and the exact Node 24.18.0 pin.
- Footprint: one package, 1,367 files, 1,466,160 unpacked bytes, zero runtime
  dependencies, zero peers.
- Lifecycle: the published manifest contains no
  `preinstall`/`install`/`postinstall`; no build allowlist change.
- Maintenance: latest stable release, published four days before review, from
  the actively maintained official project.
- Advisories: no exact-version GitHub Advisory Database result at review time;
  final `pnpm security:audit` remains authoritative repository evidence.
- Limitations: `Type.Object` must be closed explicitly; arbitrary schema
  options require an owned subset; the built-in validator has mutable global
  settings and incomplete edge-keyword coverage, so it is not the product
  parser.

#### `ajv@8.20.0`

- Purpose: private strict structural validation and Draft 2020-12
  meta-schema checking.
- License: MIT.
- Published: 2026-04-24T15:22:16Z; official
  [v8.20.0 release](https://github.com/ajv-validator/ajv/releases/tag/v8.20.0).
- Provenance: official
  [`ajv-validator/ajv`](https://github.com/ajv-validator/ajv) repository,
  registry signature. The exact package already runs in the evaluation harness
  under Node 24.18.0 and TypeScript 6.0.3.
- Compatibility: documented ESM entry point `ajv/dist/2020.js`; no declared
  Node engine or peer dependency. Repository build/type tests prove the exact
  supported runtime/compiler combination.
- Footprint: one direct package and four already-locked zero-dependency
  transitives; no new Ajv transitive resolution is introduced.
- Lifecycle: no published `preinstall`/`install`/`postinstall`; no build
  allowlist change.
- Maintenance: current stable official release.
- Advisories: no exact-version GitHub Advisory Database result at review time;
  final registry audit is required.
- Limitations: validation compiles trusted schemas to JavaScript; external
  schema loading and caller schemas are prohibited. Raw error objects may
  contain unsafe params, so they stay private and are never returned.

Resolved Ajv transitive review:

| Package                | Version | Published  | License      | Provenance and lifecycle                                                                 |
| ---------------------- | ------- | ---------- | ------------ | ---------------------------------------------------------------------------------------- |
| `fast-deep-equal`      | `3.1.3` | 2020-06-08 | MIT          | Official npm/GitHub package; registry integrity; no install lifecycle; zero dependencies |
| `fast-uri`             | `3.1.4` | 2026-07-19 | BSD-3-Clause | Official Fastify repository; registry integrity; no install lifecycle; zero dependencies |
| `json-schema-traverse` | `1.0.0` | 2020-12-13 | MIT          | Official npm/GitHub package; registry integrity; no install lifecycle; zero dependencies |
| `require-from-string`  | `2.0.2` | 2018-04-09 | MIT          | Official npm/GitHub package; registry integrity; no install lifecycle; zero dependencies |

All selected packages satisfy the 1,440-minute minimum release age. There are
no peer dependencies, exotic sources, prereleases, `requiresBuild` packages,
or lifecycle allowlist changes in the selected graph. `fast-uri@3.1.4` is the
newest resolved transitive and was nine days old at review. The lockfile is
updated only through pnpm.

#### Accepted approach behavior: TypeBox `1.3.8` plus Ajv `8.20.0`

- **Exact versions, dates, licenses, provenance, and maintenance:** the exact
  TypeBox and Ajv records above identify their publication timestamps, MIT
  licenses, official repositories, available registry provenance, and
  maintenance state. Both were current stable releases on the review date.
- **Node 24, TypeScript 6, and modules:** TypeBox 1.x officially supports
  TypeScript 6.0–7+ and is ESM-only. Ajv provides the documented ESM
  `ajv/dist/2020.js` entry point. Neither manifest declares a Node engine; the
  exact pair is therefore supported here by the repository build and tests on
  Node 24.18.0 and TypeScript 6.0.3, not by an inferred engine declaration.
- **Direct/transitive footprint, peers, and lifecycle:** two direct external
  packages, with TypeBox contributing no transitives and Ajv contributing the
  four exact, zero-dependency transitives in the table above. Neither direct
  package has a peer dependency or an install lifecycle script, and the
  selected graph has no `requiresBuild` package.
- **Advisories:** exact-version GitHub Advisory Database lookup found no result
  for either direct package at review time. Separate exact-version lookup
  results were not recorded for the four transitives; repository-wide
  `pnpm security:audit` is therefore the required full-graph,
  registry-backed check. This is point-in-time evidence, not a permanent
  assertion of safety.
- **JSON Schema draft and artifacts:** TypeBox 1.x emits native JSON Schema
  2020-12 objects, and Ajv's 2020 entry point validates that draft. Those same
  objects are the static-type and runtime-validation authority.
- **Discriminated unions:** the approved subset represents variants with
  const-tagged branches in standard `anyOf`. Ajv validates standard union
  semantics; OpenAPI's non-standard `discriminator` keyword is deliberately
  excluded.
- **Unknown fields:** every product object is built through the owned closed
  helper with `additionalProperties: false`. Ajv rejects rather than removes
  an undeclared property.
- **Coercion and defaults:** schemas carry no `default`, TypeBox conversion and
  defaulting APIs are prohibited, and Ajv has `coerceTypes`, `useDefaults`, and
  `removeAdditional` disabled.
- **Errors:** raw TypeBox/Ajv errors are private. GitBlocks maps only an
  allowlisted validator keyword and sanitized instance path into bounded,
  value-free project diagnostics.
- **Determinism:** the schema object is exported through an owned canonical
  key-sorting serializer, and exact digest tests detect output drift. Ajv does
  not author or rewrite the artifact.
- **Future MCP/HTTP/SDK limitations:** consumers must handle Draft 2020-12 and
  standard `anyOf`; they cannot rely on OpenAPI discriminator extensions or a
  browsable directory of committed generated schemas. Adapters must import
  the registry/serializer, preserve exact-version negotiation, and continue to
  apply transport byte and parse limits outside this package.

### Zod `4.4.3`

- **Exact version, release date, license, provenance, and maintenance:**
  `zod@4.4.3`, published 2026-05-04, MIT, from the official
  [`colinhacks/zod`](https://github.com/colinhacks/zod) repository with the
  recorded trusted npm publisher, registry signature, and provenance. It was
  the current stable Zod release observed on the review date.
- **Node 24, TypeScript 6, and modules:** the package exposes ESM and CommonJS,
  and official requirements describe modern TypeScript support. The collected
  evidence did not state an exact Node support range or explicitly guarantee
  TypeScript 6.0.3; exact Node 24/TypeScript 6 verification is therefore
  unknown because this rejected package was not installed.
- **Direct/transitive footprint, peers, and lifecycle:** one direct package,
  zero runtime dependencies, zero peers, and no
  `preinstall`/`install`/`postinstall` script. The recorded evidence did not
  capture file count or unpacked byte size.
- **Advisories:** an exact-version advisory result was not recorded for this
  rejected package. It would require a current GitHub Advisory Database and
  registry audit before selection.
- **JSON Schema draft and artifacts:** native
  [`z.toJSONSchema`](https://zod.dev/json-schema) targets Draft 2020-12 by
  default, supports registries and stable identifiers, and throws for
  unrepresentable constructs. The runtime Zod schema, rather than the emitted
  JSON Schema object, remains the primary authority.
- **Discriminated unions:** Zod supports runtime discriminated unions. The
  collected evidence established general union conversion but did not prove
  exact const-tagged emitted output for every product variant; that export
  parity is unknown without candidate-specific conformance tests.
- **Unknown fields:** `z.strictObject` rejects undeclared keys, while ordinary
  `z.object` strips them. A GitBlocks-owned subset would have to prohibit the
  ordinary form.
- **Coercion and defaults:** coercion, defaults, and transforms are opt-in, so
  an owned subset could prohibit them; the library does not make that policy
  intrinsic to all schemas.
- **Errors:** issue data can include rejected input and key metadata. Raw
  diagnostics would need complete disposal and replacement with bounded
  GitBlocks diagnostics.
- **Determinism:** stable schema IDs and registries are documented, but a
  byte-stable JSON Schema serialization guarantee was not found in the
  collected evidence. An owned canonical serializer and digest checks would
  still be required.
- **Future MCP/HTTP/SDK limitations and decision:** conversion has input/output
  modes and documented semantic differences for some Zod constructs.
  Transport and SDK generators would consume a projection rather than the
  runtime authority and would need a separately enforced strict subset. This
  weaker standards parity caused rejection.

### Valibot `1.4.2` plus exporter `1.7.1`

- **Exact versions, release dates, licenses, provenance, and maintenance:**
  `valibot@1.4.2` was published 2026-06-28 and
  `@valibot/to-json-schema@1.7.1` was published 2026-06-08. Both are MIT from
  the official
  [`open-circle/valibot`](https://github.com/open-circle/valibot) project with
  recorded trusted-publisher provenance, and both were current stable releases
  observed on the review date.
- **Node 24, TypeScript 6, and modules:** both packages expose ESM and CommonJS.
  Valibot's optional peer accepts TypeScript `>=5`, which includes 6.0.3 by
  range. The collected evidence did not state an exact Node support range or
  independently verify Node 24.18.0/TypeScript 6.0.3, so exact compatibility
  remains unknown for this rejected approach.
- **Direct/transitive footprint, peers, and lifecycle:** two direct packages
  and zero runtime transitives. The exporter peers on `valibot ^1.4.0`;
  Valibot has the optional TypeScript `>=5` peer. Neither package has an
  install lifecycle script. File counts and unpacked sizes were not recorded.
- **Advisories:** no exact-version advisory result was recorded for either
  rejected package. Current advisory and registry audits would be required
  before selection.
- **JSON Schema draft and artifacts:** the official
  [JSON Schema guide](https://valibot.dev/guides/json-schema/) says Valibot was
  not designed around JSON Schema and requires the separate exporter. Draft
  2020-12 must be selected explicitly because Draft 7 is the default.
- **Discriminated unions:** runtime variants exist, but the recorded guide
  documents that some variants and transforms cannot be represented with
  identical JSON Schema behavior. Exact const-tagged discriminator parity for
  all product variants is therefore not established.
- **Unknown fields:** `strictObject` rejects an unknown entry and intentionally
  reports only one. Other object constructors are not treated as safe by
  default for GitBlocks.
- **Coercion and defaults:** the collected evidence did not fully classify
  every coercion, transformation, fallback, and default API. A selected design
  would need an explicit allowlist and conformance proof; no favorable behavior
  is assumed.
- **Errors:** issue objects include raw input. They could not cross the product
  boundary and would require complete mapping to owned diagnostics.
- **Determinism:** no byte-stable exporter serialization guarantee was recorded.
  A canonical serializer and exact drift tests would still be necessary.
- **Future MCP/HTTP/SDK limitations and decision:** adapters and generators
  would consume output from a second package whose documented coverage does
  not preserve all runtime semantics. The two-package conversion boundary,
  weaker variant/string parity, and unsafe error surface caused rejection.

### JSON Schema plus `json-schema-to-ts@3.1.1`

- **Exact versions, release dates, licenses, provenance, and maintenance:**
  `json-schema-to-ts@3.1.1`, published 2024-08-29, and `ajv@8.20.0`, published
  2026-04-24, are MIT. The type library comes from the official
  [`ThomasAribart/json-schema-to-ts`](https://github.com/ThomasAribart/json-schema-to-ts)
  repository; Ajv provenance is recorded above. Registry
  publisher/signature/attestation detail for `json-schema-to-ts@3.1.1` was not
  captured. Its last stable release was nearly two years old at review;
  maintenance beyond that observable release state is unknown.
- **Node 24, TypeScript 6, and modules:** `json-schema-to-ts` declares Node
  `>=16` and ships ESM and CommonJS, so Node 24 is inside its declared engine
  range. Its documented compiler evidence is from the TypeScript 4 era;
  TypeScript 6.0.3 support was not established. Ajv's exact compatibility is
  recorded above.
- **Direct/transitive footprint, peers, and lifecycle:** two direct packages.
  `json-schema-to-ts` has no peers or install lifecycle and directly depends on
  `@babel/runtime` and `ts-algebra`; Ajv adds its four recorded transitives.
  Because the rejected approach was not resolved into this workspace, exact
  versions below the two type-library dependencies, total transitive count,
  file count, and unpacked size are unknown.
- **Advisories:** no exact-version advisory result was recorded for
  `json-schema-to-ts` or its unresolved graph. Ajv's point-in-time result is
  recorded above. A complete fresh graph audit would be mandatory before
  selection.
- **JSON Schema draft and artifacts:** checked-in literal JSON Schema would be
  authoritative and Ajv2020 would provide Draft 2020-12 runtime validation.
  Static inference has open Draft 2020-12 limitations for
  [tuples](https://github.com/ThomasAribart/json-schema-to-ts/issues/190) and
  [`$defs`](https://github.com/ThomasAribart/json-schema-to-ts/issues/218).
- **Discriminated unions:** literal standard `oneOf`/`anyOf` with const tags can
  express product variants, and Ajv can validate them. The collected evidence
  did not establish that `FromSchema` derives every required discriminated
  union correctly under TypeScript 6, so static parity is unknown.
- **Unknown fields:** literal schemas can require
  `additionalProperties: false`, and the same non-removing Ajv configuration
  would reject undeclared keys.
- **Coercion and defaults:** Ajv would retain the selected
  `coerceTypes: false`, `useDefaults: false`, and `removeAdditional: false`
  policy. An owned schema subset would prohibit `default` annotations from
  becoming runtime behavior.
- **Errors:** raw Ajv errors would remain private and use the same bounded
  GitBlocks mapping. `json-schema-to-ts` is compile-time only and has no parser
  diagnostic surface.
- **Determinism:** checked-in literal schemas provide reviewable source
  determinism, but canonical serialization and digest tests would still be
  required for byte-stable exports. No separate generator determinism claim is
  needed for the literal source.
- **Future MCP/HTTP/SDK limitations and decision:** standards-based consumers
  could read the literal schemas directly, which is attractive. However,
  incomplete Draft 2020-12 static inference and unproven TypeScript 6 union
  parity can make generated transport/SDK types disagree with runtime
  validation. That defeats the required one-source synchronization and caused
  rejection.

## Consequences

### Benefits

- One checked-in TypeBox definition drives DTO types, runtime validation, and
  exact JSON Schema artifacts.
- JSON Schema remains the validation semantics instead of a lossy documentation
  projection.
- Only one newly resolved package is added; Ajv and its graph are already
  locked and audited by evaluation tooling.
- The domain stays independent and testable without schema or Node APIs.
- Future transports and SDK generation receive standard closed Draft 2020-12
  artifacts with stable identifiers.
- Ordinary supported repository facts evolve through a controlled vocabulary
  without adding a DTO union branch for each scanner observation.
- Version-selected private deeply frozen authority and fresh public snapshots
  prevent consumer mutation from changing accepted vocabulary semantics.
- Evidence provenance, epistemic status, candidate reasons, supplied
  limitations, and processing state retain their decision-relevant meaning
  through mapping and exchange validation.
- Diagnostics, version behavior, and cross-field safety are owned by GitBlocks
  rather than exposed library objects.

### Costs and constraints

- Every object must use the closed helper; TypeBox's default is not safe for an
  untrusted boundary.
- Ajv adds an explicit runtime dependency to the contract package and compiles
  trusted schemas during module initialization.
- Two validation stages and explicit DTO mapping create code, but keep
  structural and business rules reviewable and independently testable.
- Exact-version closed consumers require explicit new parsers and negotiated
  transitions for shape additions.
- Fact producers and consumers must negotiate a controlled vocabulary version,
  and registry additions require a new immutable entry, digest, negotiation
  support, and semantic review even when schema shape is unchanged.
- Already-executable hostile proxies are not inert data; production adapters
  must provide JSON-parsed or otherwise data-only values.
- Runtime-exported artifacts require stable serialization tests rather than a
  browsable committed schema directory.

## Rejected alternatives

### Hand-maintained interfaces plus separately maintained JSON Schemas

Rejected because drift is inevitable and no artifact would be authoritative.

### TypeBox's built-in validator as the only dependency

Technically viable and smaller, but rejected for the product parser because
its corrective parsing, acceleration, and error cap are process-global mutable
settings and its published standards table has incomplete edge-keyword
coverage. A private Ajv instance provides local immutable policy. The second
direct dependency is justified despite minimization because it is already
resolved, adds no new transitive packages, and protects validation semantics.

### Ajv alone with handwritten TypeScript interfaces

Rejected because Ajv validates schemas but does not derive the owned static DTO
types; parallel interfaces would recreate drift.

### Validation only in HTTP or MCP handlers

Rejected because transport handlers do not exist and would create competing
behavior. Every future adapter must reuse the central parser.

### Evaluation JSON Schemas as product contracts

Rejected because they contain corpus/scoring concepts, use separately
maintained TypeScript types, and are independently versioned private
instruments.

### Framework request/response types as the authority

Rejected because it couples domain communication to an unselected adapter and
reverses dependency ownership.

### Unvalidated casts from `unknown`

Rejected because static assertions do not validate untrusted runtime values,
closed fields, bounds, versions, or invariants.

### Class-heavy domain modeling

Rejected because readonly values and pure functions enforce the current rules
without mutable entities, repositories, factories, registries, inheritance,
or service location.

### Storage representations as domain contracts

Rejected because storage is unselected and future tenant, retention, indexing,
and migration fields are not product meaning.

### Committed generated schema JSON

Rejected for now because TypeBox values already are the portable schema
artifacts. A second committed copy adds review volume and generator workflow
without a current non-TypeScript consumer. Canonical runtime serialization and
exact digest tests provide deterministic drift detection.

## Revisit triggers

Revisit through a superseding ADR if one of these measurable conditions occurs:

- GitBlocks supports a production language whose toolchain cannot consume JSON
  Schema 2020-12, or at least two non-TypeScript SDKs require a different
  generation source.
- A supported MCP/HTTP/SDK generator fails on an accepted schema feature in at
  least two contract families and no standards-preserving rewrite exists.
- The contract inventory reaches 30 root schemas and measured TypeScript
  checking of contract definitions exceeds 25% of the median verification
  critical path across 20 comparable runs.
- Structural validation exceeds 10 ms at p95 for maximum-size accepted objects
  across 10,000 controlled Node 24 runs, and a replacement improves it by at
  least 30% without weakening diagnostics or interoperability.
- A demonstrated TypeBox/Ajv semantic disagreement accepts or rejects a
  GitBlocks-approved schema value differently and cannot be fixed within the
  approved subset.
- TypeBox or Ajv drops Node 24/TypeScript 6/strict ESM support before GitBlocks
  changes its runtime/compiler policy.
- Runtime schema export cannot meet an actual reviewed consumer's deterministic
  artifact or publication requirement, justifying committed generation.
- A security advisory, provenance failure, or maintenance gap makes the
  selected dependency graph unacceptable and no supported patched release
  exists.

Preference, popularity, the presence of a new library, or incidental use by a
future framework is not a revisit trigger.
