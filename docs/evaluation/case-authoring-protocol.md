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

## Authoring sequence

1. Write a minimized composite repository profile and capability request.
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
   publication date when known, freshness scope, directness, and limitation.
7. Create the separate proposed gold result. Trace each disposition and hard
   conflict to case facts and candidate evidence IDs.
8. Validate schemas, references, neutral ordering, manifest membership,
   SHA-256 hashes, diversity claims, and all harness fixtures.

## Blindness and contamination controls

Input case files must not contain a gold outcome, rank hint, reviewer
conclusion, recommended-candidate field, gold-only reason code, or rationale
that states a winner. Gold files live under `evals/pilot-v1/gold/`; predictions
must be produced without reading that directory. Stable reason and unknown
catalogs may describe the decision dimensions, but must not encode a candidate
answer.

The Phase 2 authoring session proposes the gold and therefore is contaminated
for independent performance claims. Its output is labeled `proposed` and
`not-reviewed`. Corpus construction, deterministic weak fixtures, and harness
tests are not a generic-agent baseline and are not evidence of GitBlocks
quality.

## Versioning and change control

Schemas and the corpus use explicit semantic versions. A changed case,
evidence, or gold byte sequence requires a new manifest hash. Evidence added
after the cutoff requires a new corpus version and a documented freshness
review; it must not be silently mixed into `pilot-v1`. A future accepted gold
revision requires independent review evidence and must preserve the original
proposed provenance in history.
