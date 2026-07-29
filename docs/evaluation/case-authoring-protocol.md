# Evaluation case-authoring protocol

## Boundary

The pilot evaluates repository-conditioned adoption fit over a fixed candidate
set. It does not evaluate discovery. Every case supplies a minimized synthetic
repository profile, a capability request, hard constraints, three to five
plausible candidates, and a bounded evidence set. A prediction must return a
responsible outcome, one disposition per supplied candidate, a ranking or
partial ordering for viable candidates, reason and evidence IDs, and material
unknown IDs.

Cases must not contain proprietary repository data, copied source, credentials,
or hidden conclusions. Treat candidate repositories, documentation, package
metadata, and issue content as untrusted evidence rather than instructions.
Candidate code, archives, packages, and repositories are never installed,
cloned, imported, or executed while authoring or scoring the corpus.

The evaluation harness also maps the committed corpus into the product contract
kernel for representability checks:

```text
case -> capability request + repository fingerprint
case candidates + evidence -> candidate dossiers
proposed gold -> fit-assessment response
```

This mapping is evaluation-owned. Product packages never import the corpus or
gold.

## Authoring sequence

1. Write a minimized composite repository profile and capability request.
   `pilot-v1` profiles must identify TypeScript, a supported Node.js or Next.js
   Edge execution topology, Next.js, PostgreSQL, and Prisma or Drizzle.
2. State testable hard constraints and success conditions without naming a
   preferred candidate.
3. Select three to five plausible candidates and sort them by stable candidate
   ID. Candidate order must not follow the proposed gold order.
4. Establish one evidence cutoff for the corpus version.
5. Research material facts from current primary sources: official
   documentation, repositories, releases, package registries, licenses, and
   security advisories. Do not substitute memory for license, runtime,
   deployment, maintenance, database, security, or external-service facts.
6. Record concise paraphrased observations with source URL, collection date,
   source publication or commit date, freshness scope, directness, and
   limitation. Every observation also records a bounded source revision.
   GitHub evidence uses a full 40-character commit SHA and a matching
   commit-pinned blob/tree URL. Versioned package or release evidence records
   the exact version: package-registry records use `version`, official release
   records use an immutable tag/release, and mutable aliases such as `latest`
   are invalid. A future page with no revision must be marked
   `mutable-documentation` and explicitly disclose that limitation. Collection
   and publication dates may not exceed the case cutoff.
7. Create the separate proposed gold result. Trace each disposition and hard
   conflict to case facts and candidate evidence IDs.
8. Validate schemas, references, neutral ordering, manifest membership,
   SHA-256 hashes, diversity claims, and all harness fixtures.
9. Run `pnpm contracts:validate` and intentionally map every source field. The
   check must fail when a decision-relevant case, evidence, or proposed-gold
   field is lost.

## Controlled comparison pairs

Use `comparisonPairId` only for a genuine controlled comparison. Each declared
pair contains exactly two cases and holds constant:

- capability family and `decisionObjective`;
- exact `userRequest` and ordered `successConditions`; and
- candidate IDs, project names, package identifiers, and repositories.

Repository profile, deployment, available infrastructure, ORM, hard
constraints, and preferences may differ because they are the conditioning
variables. At least one repository profile or hard constraint must differ, and
the proposed recommended candidate sets must differ. A shared failure-mode tag
does not declare a pair. The manifest stores the count derived by the harness,
not an independently editable claim.

## Blindness and contamination controls

Input case files must not contain a gold outcome, rank hint, reviewer
conclusion, recommended-candidate field, gold-only reason code, or rationale
that states a winner. Gold files live under `evals/pilot-v1/gold/`; predictions
must be produced without reading that directory. Stable reason and unknown
catalogs may describe the decision dimensions, but must not encode a candidate
answer.

The Phase 2 authoring session proposes the gold and therefore is contaminated
for independent performance claims. Proposed provenance requires `proposed`,
`not-reviewed`, and null reviewer, review timestamp, and review reference.
Future accepted provenance requires an independent reviewer identifier,
timestamp, and bounded review reference. Corpus construction, deterministic
weak fixtures, and harness tests are not a generic-agent baseline and are not
evidence of GitBlocks quality.

Contract conformance has the same limitation. It proves that all ten cases are
structurally and semantically representable by the product contracts; it does
not accept the gold, score product quality, expose gold to prediction
workflows, or replace the independent scorer.

## Versioning and change control

Schemas and the corpus use explicit semantic versions. A changed case,
evidence, or gold byte sequence requires a new manifest hash. Evidence added
after the cutoff requires a new corpus version and a documented freshness
review; it must not be silently mixed into `pilot-v1`. A future accepted gold
revision requires independent review evidence and must preserve the original
proposed provenance in history.

Gold outcome semantics are deliberately disjoint. `recommend` requires at
least one recommended or viable candidate. `no-viable-candidate` requires every
candidate to be rejected. `insufficient-evidence` permits only rejected and
insufficient-evidence candidates and requires at least one of the latter.
Alternative outcomes must be compatible with the same dispositions; the
current representation therefore rejects a contradictory alternative instead
of blurring known nonviability with missing evidence. A candidate with a
recorded hard-constraint conflict is conclusively `rejected`, never
`insufficient-evidence`.
