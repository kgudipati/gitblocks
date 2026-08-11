# ADR 0012: Separate extraction planning, realized readiness, and full closure

- Status: proposed; independent acceptance required before live collection
- Date: 2026-08-10
- Decision owners: GitBlocks maintainers
- Governing issue:
  [#32 — Phase 10: Establish codebase-conditioned OSS ranking](https://github.com/kgudipati/gitblocks/issues/32)
- Governing pull request:
  [#33](https://github.com/kgudipati/gitblocks/pull/33)
- Execution plan:
  [Phase 10 codebase-conditioned ranking](../../plans/0032-codebase-conditioned-ranking.md)
- Related decisions: [ADR 0006](0006-immutable-repository-artifacts.md),
  [ADR 0011](0011-codebase-conditioned-ranking.md)
- Pre-live falsification authority: M3A head
  `db999b3c3244aabd4920551d2260ea3bcd698c5e`, field-plan digest
  `ac643d102cb7e20a711b5c0a59508608e30ad7d0f1b7446d345237c53289607a`

## Context

M3A froze source and extraction semantics before any live M3 collection,
credential read, all-150 authority generation, or coverage measurement. Under
historical `ranking-v1-deterministic-readiness-policy/1.0.0`, a field counted
only when deterministic sources could close every applicable catalog
candidate. The audit correctly found six such fields, 6/18 readiness, and no
full-closure field in capability/adoption or infrastructure/deployment. It
correctly returned NO-GO without inventing an unsafe extractor.

Independent review found that v1 conflated deterministic extraction capability
with deterministic all-candidate closure. The initial ADR 0012 proposal
correctly separated those ideas, but its policy v2 still let a pre-live plan
satisfy the final 13/18 gate even if the future frozen rule produced no useful
fact in the catalog. Its partial fact codes were not closed to exact field
semantics, several credited adjacent metadata, and its default-head operation
used the expansive repository-commit representation rejected by ADR 0006.

No live source authority, provider value, all-150 projection, M3 coverage, or
ranking output existed when either correction was designed. The ADR 0011
pre-output change-control rule therefore permits independent review without
outcome tuning.

## Proposed decision

### Narrow supersession and unchanged gates

The successor proposal is
`ranking-v1-deterministic-readiness-policy/3.0.0`. It replaces the unaccepted
v2 proposal. If independently accepted, it supersedes only the v1 ready-field
definition and breadth interpretation. It does not reopen:

- the 18 decision-bearing-field denominator;
- the minimum 13 fields or exact 72.222222%;
- Ranking V1 quality, safety, determinism, or performance gates;
- accepted cases, gold, scorer, review record, or gate record;
- Phase 9 retrieval, ranking architecture, M3 → M4 order, or model-free V1.

### Three separate field measures

Planned deterministic extraction capability is pre-live architecture
feasibility. A field qualifies only when a frozen, versioned, judgment-free
rule consumes bounded accepted source authority; can emit a meaningful
field-semantic fact; retains exact provenance, field, and rule binding; emits
only supported positives or registered completeness-backed negatives; leaves
incomplete authority unknown or partial; and reaches `CandidateDossierV1`
without prose interpretation. An always-unknown rule is not planned-capable.

Realized deterministic extraction readiness is the post-collection 13/18
numerator. The field must have been planned-capable before collection, use that
exact frozen rule and source authority, and produce at least one meaningful
deterministic non-not-applicable established value or registry-valid partial
fact in the committed 150-candidate authority. N/A-only and zero-output rules
do not qualify. Human-reviewed and model-derived cells contribute nothing.

Deterministic full closure remains the stricter separate measure: every
applicable candidate is deterministically known or legally
deterministic-not-applicable under accepted freshness and completeness
semantics. It is not the 13/18 numerator. The six M3A planned full-closure
candidates remain `package-publication-version`, `runtime-package-format`,
`package-repository-linkage`, `archived-state`, `maintenance-activity`, and
`security-policy-presence`.

Pre-live breadth requires one planned-capable path in each unchanged group.
Final M3 breadth requires one realized-ready field in each group. After the
one future live collection, fewer than 13 realized-ready fields or an empty
realized breadth group yields NO-GO. Rules are not tuned, fields are not added,
and collection is not rerun merely to improve the result. A new extractor
requires independent architecture review before another live effect.

### Closed partial-field semantics

`candidate-authority-partial-field-semantics/1.0.0` is the product-owned closed
registry. Each definition binds one fact code to one field and extraction
rule, allowed provenance classes, allowed polarity, exact value grammar,
semantic meaning, permitted claims, prohibited claims, planned-capability
qualification, and a canonical definition digest. Every current fact is
affirmative-only.

`candidate-authority-partial-field-evidence/2.0.0` binds each record to the
registry version/digest and definition digest. Both construction and dossier
projection validate field, rule, provenance, polarity, syntax, completeness,
stable identity, and canonical digest. Unregistered and unmentioned concepts
remain unknown. Partial facts do not become complete deterministic profile
values, and `CandidateDossierV1` remains the sole dossier model.

The corrected semantic rules are deliberately narrow:

- exact `exports`, `main`, or `module` proves an importable runtime package
  surface, not the complete adoption architecture;
- GitHub primary language maps through the existing controlled language
  mapping to one repository language fact, not a complete language set;
- a controlled peer dependency proves a declared framework peer relation, not
  general compatibility;
- runtime datastore client dependencies prove no datastore requirement and do
  not qualify the field;
- a recognized non-`NOASSERTION` SPDX value, one observed release, and one
  exact-package advisory establish only their registered affirmative facts;
- an exact verified root `compose.json` service whose build context is `.`
  proves only a repository self-build service declaration at that commit.

The successor plan has 13 planned-capable fields and six planned full-closure
fields. Realized readiness remains unmeasured before live collection.

### Bounded Git head resolution

The source proposal reuses ADR 0006 and the Phase 6 transport contract:

1. `GET /repos/{owner}/{repository}/git/ref/heads/{urlEncodedDefaultBranch}`;
2. require the exact ref and a commit object;
3. `GET /repos/{owner}/{repository}/git/commits/{exactCommitObjectId}`;
4. require exact SHA equality and retain the immutable head and root-tree SHA.

Both responses are capped at 256 KiB, 10,000 JSON nodes, 10 seconds, three
attempts, and zero redirects. The rejected
`/repos/{owner}/{repository}/commits/{defaultBranch}` shape is prohibited.
The proposal ceiling is 1,660 GitHub plus 80 npm logical requests, 1,740 total;
worst-case attempt ceilings are 4,980, 240, and 5,220. These are bounds, not
collection authorization.

## Consequences

- Pre-live GO means only that the frozen architecture is scientifically worth
  testing; it is not evidence that final M3 readiness passed.
- The future report separately publishes planned-capable, realized-ready, and
  full-closure fields; exact per-cell origins; and realized breadth groups.
- Deterministic known, deterministic N/A, deterministic partial direct
  evidence, human-reviewed, model-derived, unknown, and conflict cells remain
  separate. Unknown stays fail-closed and never favorable.
- One live collection is frozen once and replayed offline; determinism never
  compares two drifting live collections.

## Rejected alternatives

- Preserve 14 paths by crediting npm ecosystem, runtime dependencies, or a
  generic Compose services map: rejected as adjacent metadata or overstated
  semantics.
- Let planned capability itself satisfy final readiness: rejected because a
  zero-output extractor would make the gate vacuous.
- Count N/A-only, human-reviewed, or model-derived cells: rejected because none
  demonstrates realized deterministic fit facts.
- Lower 13/18 or remove breadth: rejected; both protections remain binding.
- Use README, descriptions, topics, popularity, candidate names, or evaluation
  mappings: rejected as incomplete or contaminating authority.

## Acceptance and effect boundary

ADR 0012 remains proposed. Policy v3, field plan v3, source policy v3, the
partial semantic registry, partial-evidence v2 contract, root v3, and focused
fixtures require independent acceptance before any live M3 action. This
correction performs zero candidate-provider/network, credential, database,
Docker, model, source-authority, all-candidate projection, or coverage effects.
Acceptance would still require a separately authorized zero-effect preflight
before credential availability inspection or provider collection.
