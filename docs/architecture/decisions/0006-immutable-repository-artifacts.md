# ADR 0006: Immutable repository artifacts

- Status: Accepted
- Date: 2026-07-29
- Decision owners: GitBlocks maintainers
- Governing issue:
  [#15](https://github.com/kgudipati/gitblocks/issues/15)
- Execution plan:
  [0015-immutable-repository-artifacts.md](../../plans/0015-immutable-repository-artifacts.md)

## Context

Phase 5 collects bounded repository metadata and exact-commit allowlisted file
content, but its profiler records file presence only. Exact file bytes are
discarded after profiling. Phase 7 needs reviewed, immutable, line-addressable
source material that can be loaded historically without re-fetching a mutable
repository head or trusting a model-generated citation.

Repository documentation is hostile public data. GitHub owner/name aliases and
HTML URLs are mutable, Contents responses alone can obscure symlinks and
submodules, repository object algorithms can evolve, UTF-8 and line endings can
be damaged by normalization, and separately appended artifact-set rows can
make partial collection appear complete.

The existing product direction remains:

```text
packages/ingestion -> packages/persistence -> packages/contracts -> packages/domain
```

Phase 6 extends that direction without a new production package, domain change,
`CandidateDossierV1` change, model dependency, generalized blob store, or
second evidence system.

## Decision

### Public source boundary

GitBlocks may centrally persist exact curator-approved public catalog
artifacts. This permission is narrow: user target-repository bodies and other
unapproved material remain local by default. Public artifact collection is an
explicit non-production operator operation and does not weaken the future
target-scanner transmission boundary.

### Selection authority

`catalog/public-v1/artifact-manifest.json` is the product-owned
`public-artifacts-v1` selection authority. It binds to `public-v1` and digest:

```text
4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634
```

The closed manifest contains exactly one entry per catalog candidate, exactly
one optional root README attempt per candidate, and at most three explicit
additional paths. At least 30 candidates and at least 6 candidates per family
have proposed additional paths. Each explicit path has a controlled kind,
required/optional classification, and bounded curator rationale.

Manifest ordering is deterministic. Candidates sort by candidate ID; root
README is first; explicit selections sort by path and selection ID. Selection
IDs derive from the canonical selection descriptor. The manifest digest covers
canonical JSON with only `manifestDigest` omitted. Neither selection IDs nor
the manifest digest includes a wall-clock timestamp.

The pre-live maintainer-review revision uses 30 capability-bearing official
repository documents, exactly 6 candidates per family. All 30 are controlled
`documentation` selections whose rationales name the adoption question they
answer; security policies, contribution guides, and changelogs are not used to
meet the cohort. Supported text extensions are `.md`, `.markdown`, `.mdown`,
`.mkd`, `.mdx`, `.mdoc` (Markdoc), `.rst`, `.adoc`, `.asciidoc`, and `.txt`,
plus the controlled extensionless document names. The generated proposal
digest is:

```text
17d2a47f8d992275c95d55434bfc24776fb8ac51fc626e7610502f687bf3d02c
```

Production validation does not import evaluation files, schemas, gold, or
scorers.

### Source artifact versus selection semantics

`RepositoryArtifactV1` represents one exact source file. Its identity excludes:

- selector and selection ID;
- artifact kind;
- required/optional classification;
- curator rationale and ordering;
- catalog or provider owner/name aliases;
- HTML/display/download URLs;
- manifest version/digest;
- collection timestamp; and
- chunker version.

Those curator semantics belong to ordered artifact-set entries. Changing a
classification or rationale does not duplicate an otherwise identical
artifact.

The artifact identity canonical input is:

```text
candidateId
provider: github
immutable GitHub repository numeric ID
Git object algorithm
exact commit object ID
exact repository-relative path
exact blob object ID
exact content SHA-256
```

This identity remains stable across a rename or transfer while those immutable
inputs remain unchanged.

Artifacts also retain first-materialization provenance: catalog owner/name,
provider-canonical owner/name, authoritative Git blob API URL,
non-authoritative display URL when present, media information, byte/line
counts, exact content, and `collectedAt`. These fields participate in the
complete record digest but not stable ID.

A first insertion is accepted only when its catalog owner/name exactly match
the durable `catalog_candidates` row and its provider owner/name exactly match
the incoming artifact set's provider-canonical owner/name. Publication loads
the catalog aliases under the candidate transaction lock; a composite foreign
key also prevents a direct insert from poisoning catalog provenance. These
checks apply to the incoming command.

Rename-safe provenance reuse applies only after an artifact has entered a
successfully published artifact set. An unreferenced preexisting artifact must
completely match the incoming contract record before it may participate in
first publication. After an artifact insert conflict, publication therefore
verifies the intrinsic identity and immutable core, then checks for a committed
artifact-set-entry reference inside the candidate-scoped transaction. An
unreferenced row must have the exact incoming complete record digest. A
referenced row may retain its original first-materialization provenance and
timestamp when its intrinsic core matches, allowing a later legitimate
repository rename to reuse the historical artifact. Neither path mutates the
stored artifact.

A later artifact set records the provider-canonical location observed for that
collection. It may reflect a move without duplicating the artifact. Temporary
`download_url` values are never persisted.

### Git object algorithm and URLs

The collector uses GitHub REST API version `2026-03-10` to query the repository
hash-algorithm endpoint before validating object IDs. Contracts represent the
algorithm explicitly. Phase 6 supports only `sha1`; another algorithm produces
the controlled `ingestion.unsupported-git-object-algorithm` outcome and prevents
set publication.

Commit and blob object-ID validation is algorithm-conditional. For `sha1`:

```text
SHA-1("blob " + decimal byte length + NUL + exact bytes)
```

must equal provider metadata. GitBlocks also computes SHA-256 over exact
content.

The authoritative blob API URL addresses the repository and exact blob object
through `api.github.com` and is stored separately from any display URL.
Structured repository ID, algorithm, object IDs, path, and content digest are
the identity authority; URLs are provenance locators.

A non-null display URL must equal the exact derived value:

```text
https://github.com/{encoded first provider owner}/{encoded first provider repository}/blob/{commit object ID}/{encoded path segments}
```

Each owner, repository, and path segment is percent-encoded independently.
Other HTTPS hosts, different aliases, mutable refs, query strings, fragments,
and temporary download URLs are rejected. The display URL remains
non-authoritative and excluded from stable identity.

The shared transport gains an explicit request-level GitHub API-version option.
Its default remains `2026-03-10`, preserving the Phase 5 header and behavior.
Artifact requests set the same version explicitly.

### Exact provider collection

The collector resolves repository numeric identity, object algorithm, and
exact default-branch commit before artifact reads. It resolves the default
branch through GitHub's bounded
[Git reference](https://docs.github.com/en/rest/git/refs?apiVersion=2026-03-10#get-a-reference)
and
[Git commit-object](https://docs.github.com/en/rest/git/commits?apiVersion=2026-03-10#get-a-commit-object)
endpoints:

```text
GET /repos/{owner}/{repository}/git/ref/heads/{defaultBranch}
GET /repos/{owner}/{repository}/git/commits/{exactCommitObjectId}
```

The reference must exactly equal `refs/heads/{defaultBranch}`, its object must
be a commit, and the returned Git commit object ID must equal the reference
object ID. The commit object supplies the root tree ID. The collector does not
use `GET /repos/{owner}/{repository}/commits/{ref}` because that repository
commit representation may include an unbounded-by-change-count `files` array.
The controlled live proof measured otherwise valid current responses of
683,796 and 395,519 bytes from that expansive endpoint; the equivalent Git
reference/commit-object response pairs were 330/2,809 and 368/2,484 bytes and
fit the existing 256 KiB metadata bound.

It obtains the root README with:

```text
GET /repos/{owner}/{repository}/readme?ref={exactCommitObjectId}
```

The provider-discovered path becomes the resolved path. Explicit selections use
the Contents API at the same commit.

Every final path is verified by walking at most eight segments through bounded,
non-recursive Git tree calls. Only:

```text
100644 blob
100755 blob
```

is accepted. Trees/directories (`040000`), symlinks (`120000`), submodules
(`160000`), missing segments, ambiguous duplicates, or disagreement between
tree and content metadata fail closed. Recursive tree retrieval is prohibited.

Only an exact-ref README/Contents 404 can create `not-found`, and only for an
optional selection. Authentication, authorization, rate or abuse limits,
timeout, cancellation, retry exhaustion, 5xx, malformed payload, unsupported
object type/algorithm, invalid content, bounds, or hash disagreement prevent
set publication.

### Exact content representation

Accepted content must:

- be strict base64 with declared/decoded size equality;
- reserve its computed decoded length from the shared run budget before
  `Buffer` decoding or text materialization;
- decode through a fatal UTF-8 decoder;
- contain no NUL;
- re-encode to the exact original bytes;
- match the provider Git blob object ID; and
- fit artifact, candidate, run, and line bounds.

No Unicode, whitespace, CRLF, LF, lone CR, Markdown, HTML, heading, fence, or
final-newline normalization occurs.

Per-artifact and per-candidate byte limits count unique accepted artifact
content. The aggregate operational run limit has deliberately different
semantics: it charges every provider body actually Base64-decoded, including
both the README/Contents body and the independently retrieved Git blob body.
Decoded bytes remain charged when later tree, hash, candidate, or persistence
validation fails. A synchronous shared reservation object performs an atomic
check-and-charge before decoding, so the two candidate workers cannot
oversubscribe the limit. A failed reservation decodes nothing and produces
only `ingestion.body-too-large`.

PostgreSQL `text` is the durable content representation. Migration verification
requires UTF-8 server encoding, and the database checks `octet_length` against
the byte count. `bytea` is rejected because it admits binary/invalid UTF-8;
JSONB is rejected for bodies because it duplicates content.

### Lossless chunking

`exact-lines-v1` is dependency-free and semantic-free.

It scans exact bytes into logical lines, treating CRLF as one terminator and LF
or lone CR as one terminator while preserving terminator bytes. Empty content
has one empty logical line. A final terminator creates a final empty logical
line for metadata without inventing bytes. `artifact.lineCount` includes that
terminal empty logical line. Chunks describe only byte-bearing intervals, so a
terminal zero-byte line never receives its own zero-byte chunk and no chunk
claims to contain bytes from it. The final byte-bearing chunk ends at
`artifact.lineCount - 1` when content ends in CRLF, LF, or lone CR. Empty
content is the deliberate exception: it remains one empty logical line
represented by one zero-byte chunk with line range 1 through 1.

The chunker greedily assigns whole logical lines up to 16 KiB and 200 logical
lines. A line exceeding 16 KiB is split at the last valid UTF-8 code-point
boundary; pieces retain the same line number. Markdown headings and fenced code
receive no special treatment.

Chunks use zero-based, half-open UTF-8 byte offsets and one-based inclusive line
ranges. They are contiguous, ordered, non-overlapping, and limited to 64. Before
publication, both adapter validation and deferred PostgreSQL closure validation
derive line ranges from exact content. A CRLF pair is never split across chunks.
The 200-line bound counts byte-bearing line intervals claimed by a chunk; the
terminal empty logical line is artifact metadata, not a claimed chunk line.
Before publication:

```text
Buffer.concat(chunks ordered by ordinal) === exact artifact bytes
```

must hold with all hashes, intervals, ordinals, and line metadata.

Chunk IDs include artifact ID, candidate ID, chunker version, ordinal, byte
interval, and content SHA-256. Line ranges are deterministic metadata derived
from those inputs and participate in the complete record digest without
duplicating a stable-ID input. Timestamps are excluded. Existing identical
chunks are reused.

### Artifact-set contract and identity

`RepositoryArtifactSetV1` represents one complete candidate selection at one
exact repository context. Its identity includes:

```text
candidateId
catalog version and digest
immutable provider repository ID
provider-canonical location observed for this set
Git object algorithm
exact commit object ID
artifact-manifest version and digest
collector version
chunker version
ordered selection/member outcomes
```

Each outcome contains selector, kind, requirement, rationale, selection ID,
ordinal, requested path, resolved path, presence/absence, and referenced
artifact ID. The only persisted absence is optional `not-found`.

The set ID excludes `publishedAt`. An existing identical set is reused with its
original publication time and complete record digest.

Artifact, chunk, and set IDs use distinct prefixes plus 48 hexadecimal
characters of SHA-256 and fit the existing 64-character stable-ID limit. Full
identity digests are also stored. Complete record digests include all persisted
fields except the digest itself.

### PostgreSQL representation

Forward migration `0003_immutable_repository_artifacts.sql` adds:

```text
repository_artifacts
repository_artifact_chunks
repository_artifact_sets
repository_artifact_set_entries
```

`repository_artifact_set_entries` is the single normalized authoritative
ordered selection representation. The set row stores scalar
identity/count/digest fields, not a competing outcome JSON array. Loaders
reconstruct the contract from entries in ordinal order and verify the digest.

Artifacts and chunks store exact content in `text` and intrinsic metadata in
scalar columns. Sets and entries store selection semantics in normalized scalar
columns. All tables use candidate ownership, foreign keys, bounded checks,
indexes for referencing columns, complete record digests,
first-materialization timestamps, and immutable update/delete protection.
Artifact catalog provenance has a database-enforced composite reference to the
candidate's durable catalog owner/name. Incoming provider provenance is
validated against the incoming set before insertion because requiring stored
historical aliases to equal every later set would break rename-stable reuse.

A deferred constraint trigger validates at commit:

- contiguous entry ordinals and declared counts;
- every selection represented exactly once;
- absence only for optional `not-found`;
- present artifact ownership and repository/commit context;
- contiguous chunk ordinals and byte intervals;
- declared artifact/chunk counts and bytes; and
- complete content reconstruction.

Artifact-level advisory locking serializes chunk insertion with set membership.
Once any published set entry references an artifact, new chunk identities for
that artifact are rejected; exact idempotent reinsertion of existing chunk IDs
still reaches conflict reload and verification. This prevents append-only
table grants from mutating a previously closed set.

The only public write is:

```text
publishRepositoryArtifactSet
```

Provider reads, validation, hashing, and chunking finish before one
candidate-advisory-locked read-committed transaction. Inserts use
`ON CONFLICT DO NOTHING` and conflict reload. Every artifact conflict requires
exact intrinsic identity and immutable-core equivalence. A row without a
published set-entry reference additionally requires exact complete-record
digest equality; a referenced row reuses its original timestamp and provenance.
Candidate failure rolls back the publication.

Public reads are:

```text
loadRepositoryArtifact({ artifactId, chunkerVersion: "exact-lines-v1" })
loadRepositoryArtifactSet
```

Artifact loading is explicitly chunker-scoped: the query filters by artifact
ID and requested chunker version and returns only that lossless sequence.
The V1 read contract accepts only `exact-lines-v1`; unsupported or omitted
runtime values fail before database I/O. Artifact identity remains independent
of chunker version, so a future additive chunker can coexist without
duplicating exact source artifacts.

Low-level append helpers remain internal. Runtime grants are limited to schema
usage and exact table `SELECT`/`INSERT`; update/delete/truncate/migration/schema
rights are not granted. Tests use the non-owner, non-superuser role.

### Operator and receipt

Artifact collection is a separate command family:

```text
pnpm artifacts:validate
pnpm artifacts:test
pnpm artifacts:verify
pnpm artifacts:live
pnpm artifacts:receipt
```

The live command requires explicit catalog/manifest/receipt paths, injected
GitHub read credentials, acknowledged ephemeral non-production PostgreSQL
configuration, candidate concurrency two, request concurrency one,
per-request/candidate/batch deadlines, and no implicit migration.

Receipts contain controlled IDs, versions/digests, counts, safe outcome codes,
`operationalDecodedBytes`, `materializedArtifactBytes`, provider request/rate
metadata, migration version, rerun comparison, and receipt digest.
`operationalDecodedBytes` includes successful and failed provider-body decodes;
`materializedArtifactBytes` includes only immutable artifacts in successfully
published sets. Candidate records preserve the same distinction. Receipts
contain no content, paths, display URLs, raw errors, provider bodies, headers,
credentials, SQL, or repository-authored values.

### Bounds

| Bound                               |  Hard limit |
| ----------------------------------- | ----------: |
| unique accepted bytes per artifact  |     256 KiB |
| selections per candidate            |           4 |
| unique accepted bytes per candidate |     512 KiB |
| operational decoded bytes per run   |      64 MiB |
| logical lines per artifact          |      10,000 |
| chunks per artifact                 |          64 |
| bytes per chunk                     |      16 KiB |
| logical lines per chunk             |         200 |
| candidate concurrency               |           2 |
| global GitHub request concurrency   |           1 |
| request timeout                     |  10 seconds |
| candidate deadline                  | 120 seconds |
| batch deadline                      |  60 minutes |
| path UTF-8 bytes                    |         512 |
| path segments                       |           8 |
| artifact JSON response              |     512 KiB |
| tree/blob JSON response             |     512 KiB |
| repository/ref/commit-object JSON   |     256 KiB |
| hash-algorithm JSON response        |      16 KiB |

These are artifact-specific. Phase 5 file and candidate limits are not widened.

## Consequences

### Positive

- Historical content becomes exact, immutable, and independently verifiable.
- Artifact identity survives repository moves and curator reclassification.
- Selection provenance remains explicit without contaminating source identity.
- Future citations can use stable IDs, line ranges, and UTF-8 byte intervals.
- Publication cannot expose an incomplete artifact set.
- Existing package direction, contracts, profile semantics, and dependencies
  remain compatible.
- No new production dependency or package is required.

### Costs and tradeoffs

- Exact public documentation consumes bounded PostgreSQL storage.
- Tree verification adds path-depth-bounded requests.
- Deferred closure and reconstruction add write-time database work.
- Unsupported object algorithms fail closed until an additive version.
- First-materialization provenance is historical; later aliases appear on
  later sets rather than rewriting artifacts.
- Additional paths require product review before the live operation.

## Rejected alternatives

- Mutable owner/name or HTML URL in artifact identity.
- Artifact kind or manifest digest in artifact identity.
- Contents `type` as sufficient ordinary-file proof.
- Recursive tree retrieval.
- `bytea` or duplicated JSONB content.
- Semantic Markdown chunking.
- Independent public append operations.
- Combining artifact collection with profile ingestion.
- Object storage or a generic blob API.
- Wall-clock manifest identity.

## Compatibility

This change is additive:

- no domain or `CandidateDossierV1` modification;
- no existing contract-root mutation;
- no migration 0001/0002 rewrite;
- no Phase 5 limit widening;
- no profile or receipt semantic change;
- no new package or production dependency; and
- no production dependency on evaluation.

Schema tests pin all six existing digests. Provider regressions pin the existing
Phase 5 API-version header, request sequence, profiles, and receipts.

## Security and privacy

Artifact content is hostile inert public data. It is never executed, rendered,
followed, interpreted as instruction, sent to a model, included in errors or
receipts, or committed as a fixture/evidence file. Tests use synthetic bodies
and fail on unexpected network access.

This ADR authorizes only curator-approved public catalog artifacts. It does not
authorize target-repository bodies, private repositories, secrets, or
unapproved local material.

## Rollout and recovery

The offline implementation lands behind an explicit operator command and
reviewed manifest. Migration 0003 applies transactionally with no backfill.
The first authorized live proof published 147 closed candidate sets before
three controlled candidate failures. The disqualified database was destroyed.
The bounded exact-commit correction and the root-README symlink policy conflict
require renewed maintainer review before another fresh live proof.

A failed migration rolls back. A failed candidate transaction creates no set.
Safe retry reuses exact immutable rows. A merged schema defect is corrected by
a later migration; a contract/chunker defect receives a new additive version.
Stored history is never edited as rollback.

## Deferred work

- Full reviewed live collection, immediate rerun, and compact completion
  evidence.
- A maintainer decision for a root README that GitHub discovers as a symlink:
  current authority both rejects mode `120000` and permits optional root-README
  absence only for exact-ref `404`, so the measured Dagster candidate cannot
  publish a closed set under the current rules.
- Phase 7 semantic repository interview and citation contracts.
- Additional Git object algorithms when a measured repository requires them.
- Retrieval/search/indexing, object storage, retention/deletion, tenancy/RLS,
  services, queues, and production operations.
