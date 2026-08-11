# ADR 0012: Separate extraction planning, realized readiness, and full closure

- Status: Accepted as pre-live architecture authority; live collection requires
  separate explicit authorization
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

## Decision

### Narrow supersession and unchanged gates

The accepted successor is
`ranking-v1-deterministic-readiness-policy/3.0.0`. It replaces the unaccepted
v2 proposal and supersedes only the v1 ready-field definition and breadth
interpretation. It does not reopen:

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

`candidate-authority-partial-field-semantics/2.0.0` is the accepted
product-owned closed registry. Each definition binds one fact code to one field and extraction
rule, allowed provenance classes, allowed polarity, exact value grammar,
semantic meaning, permitted claims, prohibited claims, planned-capability
qualification, and a canonical definition digest. Every current fact is
affirmative-only.

`candidate-authority-partial-field-evidence/3.0.0` preserves the v2 trust
boundary while binding each record to the successor registry version/digest
and definition digest. Both construction and dossier
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
  proves only a repository self-build service declaration at that commit; and
- a normal exact-root `Dockerfile` blob, verified through the exact root tree
  and recomputed Git object identity, proves only that the repository publishes
  an unambiguous direct container build-stage declaration at that commit.

The successor plan has 13 planned-capable fields and six planned full-closure
fields. Realized readiness remains unmeasured before live collection.

### Bounded Git head resolution

The source proposal reuses ADR 0006 and the Phase 6 transport contract:

1. `GET /repos/{owner}/{repository}/git/ref/heads/{urlEncodedDefaultBranch}`;
2. require the exact ref and a commit object;
3. `GET /repos/{owner}/{repository}/git/commits/{exactCommitObjectId}`;
4. require exact SHA equality and retain the immutable head and root-tree SHA.

Both head-resolution responses are capped at 256 KiB, 10,000 JSON nodes, 10 seconds, three
attempts, and zero redirects. The rejected
`/repos/{owner}/{repository}/commits/{defaultBranch}` shape is prohibited.

Source policy `candidate-authority-source-policy/4.0.0` reuses one bounded,
non-recursive exact root-tree response for the optional exact paths
`compose.json` and `Dockerfile`. Contents metadata remains part of the narrow
Compose rule only. A root Dockerfile candidate is retrieved directly through
`/repositories/{repositoryId}/git/blobs/{dockerfileBlobSha}`; no Dockerfile
Contents probe or second tree request exists. The strict inert-text boundary
requires repository, commit, tree, path, normal mode/type, tree/blob SHA,
recomputed Git object identity, byte length, UTF-8, NUL, and 256 KiB bounds.
The conservative parser permits blank lines, comments/parser directives, and
global `ARG` declarations before a direct case-insensitive `FROM`; it does not
interpolate arguments, execute instructions, build images, or contact a
registry. Missing or unsupported source emits no fact and no negative claim.

The accepted ceiling is 1,810 GitHub plus 80 npm logical requests, 1,890 total;
worst-case attempt ceilings are 5,430, 240, and 5,670. The additional 150
GitHub requests are solely the worst-case conditional immutable Dockerfile
blob requests. These are bounds, not collection authorization.

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

Independent review accepts the readiness architecture at correction head
`99713ff00e9e1b226c7a573ac38c152969babf90` plus the ordinary source-hardening
descendant that contains this decision and binds the exact successor digests.
Policy v3, field plan v4, source policy v4, partial semantic registry v2,
partial-evidence v3, root v4, and the focused fixtures are accepted pre-live
architecture/source-rule authority. The planned-capable field count remains
13, the planned full-closure count remains six, and realized readiness remains
unmeasured.

This acceptance does not authorize provider calls. This correction performs
zero candidate-provider/network, credential, database, Docker, model,
source-authority, all-candidate projection, or coverage effects. A separate
future live authorization must first run the zero-effect preflight; only after
it passes may credential availability be inspected. The future collection is
one-shot, freezes one normalized authority, and never automatically reruns or
tunes a rule after readiness is observed.
