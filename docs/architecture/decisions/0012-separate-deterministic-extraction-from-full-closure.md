# ADR 0012: Separate deterministic extraction from full closure

- Status: proposed; independent acceptance required before live collection
- Date: 2026-08-10
- Decision owners: GitBlocks maintainers
- Governing issue:
  [#32 — Phase 10: Establish codebase-conditioned OSS ranking](https://github.com/kgudipati/gitblocks/issues/32)
- Governing pull request:
  [#33](https://github.com/kgudipati/gitblocks/pull/33)
- Execution plan:
  [Phase 10 codebase-conditioned ranking](../../plans/0032-codebase-conditioned-ranking.md)
- Related decision: [ADR 0011](0011-codebase-conditioned-ranking.md)
- Pre-live falsification authority: M3A head
  `db999b3c3244aabd4920551d2260ea3bcd698c5e`, field-plan digest
  `ac643d102cb7e20a711b5c0a59508608e30ad7d0f1b7446d345237c53289607a`

## Context

Milestone 3A froze candidate source and extraction semantics before any live M3
collection, credential read, all-150 authority generation, or M3 coverage
measurement. Under
`ranking-v1-deterministic-readiness-policy/1.0.0`, a field counted as ready
only when its deterministic authority could make every applicable catalog
candidate known or legally deterministic-not-applicable. That audit correctly
found six full-closure fields, 6/18 readiness, and no complete field in either
capability/adoption or infrastructure/deployment. M3A therefore correctly
returned NO-GO and did not invent an unsafe extractor.

Independent review found that policy v1 over-constrained the original
field-source strategy: “At least 70–80% of fields used by the initial ranker
should come from deterministic extraction rather than LLM inference.” The
policy conflated two questions:

1. Does a field have a bounded, versioned, judgment-free deterministic
   extraction path that can establish meaningful facts?
2. Do deterministic sources close that field for every applicable candidate?

The second question is a materially stronger completeness measure. It remains
important, but it is not the stated field-source numerator. No product ranking
output, live M3 source authority, or all-150 M3 coverage existed when this
correction was selected, so the ADR 0011 pre-output change-control rule permits
an independently reviewed correction without outcome tuning.

## Decision

### Narrow supersession

This ADR supersedes only the `readyFieldDefinition` and breadth interpretation
of `ranking-v1-deterministic-readiness-policy/1.0.0`. It creates
`ranking-v1-deterministic-readiness-policy/2.0.0`.

It does not reopen or change:

- the 18 decision-bearing-field denominator;
- the minimum 13 fields or exact 72.222222%;
- Ranking V1 quality, safety, determinism, or performance gates;
- accepted cases, gold, scorer, review record, or gate record;
- Phase 9 retrieval;
- the ranking architecture, M3 → M4 order, or model-free V1 decision.

### Deterministic-extraction eligibility

A field counts toward the 13-field numerator only when all ten policy-v2
conditions hold: an explicit versioned rule consumes accepted bounded source
authority; generation is deterministic and judgment-free; the rule can emit a
meaningful non-unknown fact; claims are source-supported; negative or absence
claims require complete authority; incomplete authority stays partial or
unknown; not-applicable is both legal and proved; provenance and exact field
binding survive; identity-as-fit, popularity, evaluation classifications,
gold, and scorer outputs are prohibited inputs; and evidence reaches ordinary
`CandidateDossierV1` without prose interpretation.

An extractor that always returns unknown is ineligible. A qualifying field
does not need to close every applicable candidate before the extraction path
counts.

### Deterministic full closure

Full closure remains the stricter, separately reported measure: every
applicable catalog candidate is known or legally
deterministic-not-applicable under accepted freshness and completeness
semantics. It is not the 13/18 numerator. M3A's six planned full-closure fields
remain unchanged:

- `package-publication-version`;
- `runtime-package-format`;
- `package-repository-linkage`;
- `archived-state`;
- `maintenance-activity`;
- `security-policy-presence`.

### Partial deterministic evidence

The complete deterministic profile contract is not weakened. A field whose
source establishes only part of its semantics may leave its
`DeterministicProfileFieldRecord` unknown while a separate, field-bound
`candidate-authority-partial-field-evidence/1.0.0` record retains candidate,
field, rule, controlled fact, polarity, exact source/provenance,
source-completeness, field-completeness, unresolved remainder, cutoff,
freshness, and canonical digest.

The pure dossier bridge emits deterministic observation text from the
structured record, attaches the evidence reference to the existing material
unknown, and adds a field-specific partial limitation. Unmentioned concepts
remain unknown. A negative partial record is rejected unless source authority
is complete. The existing `CandidateDossierV1` remains the sole dossier and
recommendation evidence model.

Mutable provider provenance gains only the closed `partial` completeness
state. It retains the existing provider/source-class enums, source identity,
safe locator, authority and record digests, effective time, and mutable-source
limitation; no arbitrary JSON, credentials, raw bodies, or temporary URLs are
introduced.

### Breadth and per-cell reporting

Breadth requires at least one deterministic-extraction-eligible path in each
unchanged field group. It no longer requires the breadth field to have
all-candidate full closure.

M3 must report extraction-path eligibility and full closure separately. It
must also report exact cells as deterministic known, deterministic
not-applicable, deterministic partial/direct evidence, human-reviewed
structured, model-derived, unknown, or conflict. Human and model cells never
enter the deterministic numerator; unknown remains fail-closed and never
favorable.

### Corrected pre-live plan

The successor plan has 14 deterministic extraction paths and six planned
full-closure fields. Capability/adoption is represented by exact package
publication proving only `published-installable-package`.
Infrastructure/deployment is represented by a bounded exact-commit root
`compose.json` probe whose Contents, non-recursive root-tree entry, immutable
blob, strict JSON, and nonempty object-valued `services` map must agree. It
proves only `compose-service-declaration`; missing or unsupported content says
nothing about self-hosting absence, production suitability, or other
deployment modes.

The v2 source proposal extends the existing npm response with exact-version
`dependencies` and `peerDependencies` and adds three bounded GitHub operations
for the optional Compose JSON proof. The maximum proposal is 1,510 GitHub plus
80 npm logical requests, 1,590 total; at three attempts the ceilings are 4,530,
240, and 4,770. These ceilings are not collection authorization.

## Consequences

- The corrected plan meets 14/18 extraction paths and all four breadth groups
  without observing candidate coverage.
- Full-closure strength remains visible as six fields; the correction cannot
  disguise incomplete candidate cells.
- Positive partial facts become useful dossier evidence without falsifying a
  complete profile value or inferring absent concepts.
- Later M3 reporting is more detailed: two field-level measures plus exact
  per-cell origin counts are mandatory.
- Human-reviewed structured authority may later improve semantic completeness
  but cannot change deterministic extraction counts. Model-derived authority
  remains prohibited in V1.
- The source ceiling increases by 450 GitHub logical requests for an optional,
  exact-commit, non-recursive manifest proof.

## Rejected alternatives

- Keep policy v1 and lower 13/18 or remove breadth: rejected because the
  accepted numeric and breadth protections remain binding.
- Count a partial field as a complete deterministic profile value: rejected
  because it would turn unmentioned concepts into false closure.
- Use README, descriptions, topics, popularity, names, or evaluation mappings:
  rejected because they cannot provide the required deterministic semantics.
- Author human values in this correction: rejected because actual independent
  review authority does not exist and human cells do not count.
- Restore model interviews: rejected; the V1 model prohibition and separate
  trigger remain unchanged.

## Acceptance and effect boundary

This ADR, policy v2, field plan v2, source policy v2, partial-evidence contract,
and focused fixtures require independent acceptance before any live M3 action.
This correction performs zero provider/network, credential, database, Docker,
model, source-authority, all-candidate projection, and coverage effects. A
future acceptance does not itself authorize collection; live collection still
requires a separately authorized zero-effect preflight and credential check.
