# Plan 0023: Independently reviewed retrieval-v2 relevance authority

## Status and authority

- Governing issue: [#23 — Evaluation: establish independently reviewed
  retrieval-v2 relevance authority](https://github.com/kgudipati/gitblocks/issues/23)
- Related but unchanged Phase 9 authority:
  [#21](https://github.com/kgudipati/gitblocks/issues/21) and draft
  [PR #22](https://github.com/kgudipati/gitblocks/pull/22)
- Branch: `fix/retrieval-v2-reviewed-relevance`
- Required base: `f44ddcee4491e9f1f4680384b07e4e7a92f2bc18`
- State: in progress
- Last updated: 2026-08-08
- Decision authority: Issue #23 and the explicit maintainer reconciliation in
  this plan win over the proposed `retrieval-v1` relevance grades. ADR 0008
  continues to own evaluation architecture and forward correction; ADR 0009
  continues to own Phase 9 boundaries and remains unchanged on this branch.

The requested branch name is an explicit task requirement even though it does
not include Issue #23's decimal number as normally required by the repository
workflow. No repository policy is weakened to accommodate that external branch
name; the deviation is disclosed in validation and review evidence.

## Purpose and user-visible outcome

GitBlocks will retain the exact historical `retrieval-v1` authority while
adding an immutable `retrieval-v2` evaluation root whose relevance judgments
reflect a completed blind review and explicit maintainer reconciliation.
Unchanged evaluation-only baseline algorithms will be rerun against v2, and
new theoretical ceilings and Phase 9 quality gates will be derived from rules
fixed before any production retrieval is evaluated against v2.

Current state: `retrieval-v1` has 30 retrieval cases, 20 normalization cases,
636 proposed relevance judgments, and corpus digest
`3638596a5c330c3516003beab908b0b5631c84f41d957f78ce2cc1379cc682de`.
Its tree object at the required base is
`1ef5d85f702a73ae5065b03de184b19f8886e36a`. The first frozen Phase 9
six-channel benchmark remains historically bound to that authority.

Approved outcome: an additive v2 corpus, content-free review record, regenerated
content-free v2 baseline report, and content-free v2 gate authority. Later
production retrieval may consume those authorities only after this correction
is independently accepted and merged. No product-v2 quality result belongs to
this plan.

## Verified current repository state

- Local and origin `main` resolve to
  `f44ddcee4491e9f1f4680384b07e4e7a92f2bc18`.
- Phase 9 local/origin head remains
  `0e830d60ba97487e864633d91c09692fb6c081a1`; draft PR #22 is open and
  unmerged.
- The work uses a separate `/tmp` worktree created directly from required
  `main`; the Phase 9 checkout remains clean.
- Runtime pins are Node 24.18.0 and pnpm 11.17.0.
- The independent review artifact authenticates as 122,329 bytes with SHA-256
  `a2e137c05d88c6db71e28cfaad99aafa66b1d2b460d5fcee2ea6f958a1148e5c`.
- The source blind bundle SHA-256 is
  `d1517ef206081d4e03bbff4588b7954742e47deae627bec34a9544954a32ae29`.
- The mechanical comparison outputs authenticate as:
  `bf3093fc38d0a390cfb42e5e4853f9ae85c3bfd5df2171a6f650f687295649b2`,
  `92d7771ada7f055365a80b8c1965b0925dab612c88476a78311dc734353866b6`,
  and `72c87ff93424cfb0e35f4f2183902fec8842fbb1962bbdd090f9cd6249766ccb`.

## Scope and explicit non-goals

In scope:

- additive versioned evaluation schemas needed to represent reviewed v2
  relevance and v2-bound generated reports without changing v1 meanings;
- `evals/retrieval-v2/**`, with 212 manifest entries and exact 50-query and
  636-relevance-key closure;
- exactly 33 grade corrections in the five preferred cases;
- a content-free independent-review record;
- version-aware corpus/blind-loader/prediction/scoring/report tooling that
  keeps v1 commands and bytes valid;
- unchanged baseline algorithms run through the v2 blind boundary;
- theoretical ceiling and transferred quality-gate calculation before any
  Phase 9 product-v2 benchmark;
- focused tests, evaluation documentation, ADR evidence, and two commits.

Out of scope:

- any change under `evals/retrieval-v1/**` or to its historical report;
- production retrieval packages, request/result/algorithm versions, metadata
  lexical behavior, expansion authority, ranking, recommendation, API, MCP,
  Agent Skill, provider, model, database, vector, index, cache, or service work;
- running or projecting the Phase 9 six-channel algorithm against v2;
- changing query, normalization, clarification, hard-filter, no-result,
  equivalence, or scorer semantics;
- tuning baseline candidate generation or introducing a new baseline.

## Requirements crosswalk

| Requirement                                    | Destination                                                        | Evidence                                       |
| ---------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| preserve v1                                    | Git tree and regression tests                                      | exact tree object/diff and v1 verification     |
| additive v2 with 33 changes                    | `evals/retrieval-v2/**`                                            | manifest closure and exact reconciliation test |
| reviewed provenance without raw review content | `verification/retrieval-v2/independent-review.json` plus v2 schema | digest/content audit tests                     |
| unchanged baseline algorithms                  | existing baseline strategy files remain untouched                  | source diff and blind-boundary tests           |
| regenerate baselines                           | `verification/retrieval-v2/baseline-report.json`                   | generation/verification and report digests     |
| compute ceilings                               | v2 gate authority                                                  | hand-checkable count formula tests             |
| freeze transferred gates                       | `verification/retrieval-v2/quality-gates.json`                     | exact formula/digest tests                     |
| preserve Phase 9 blindness                     | no product checkout or product-v2 score path                       | command log, dependency tests, PR disclosure   |

## Assumptions, risks, and unresolved decisions

Verified facts:

- the review and comparison inputs are external, authenticated, and must not be
  committed;
- 33 proposed grade-0 preferred-case judgments are accepted for correction;
- eight named-comparison companion changes are rejected and stay grade 0;
- 321 same-binary-class differences retain v1's stricter calibration;
- the final required grade distribution is `97 / 79 / 398 / 62`.

Risks and controls:

- **History drift:** v1 is protected by tree-object, path-diff, and command
  verification tests.
- **Review provenance overclaim:** v2 introduces a narrow evaluation-only
  reviewed-relevance provenance shape bound to a content-free record rather
  than inventing a person or timestamp absent from the frozen artifact.
- **Gold leakage into prediction generation:** v2 reuses the dedicated blind
  query loader; tests make the corpus/gold directories unavailable to strategy
  code until prediction freeze.
- **Threshold selection after product observation:** the gate authority is
  generated only from reviewed v2 relevance, unchanged baselines, theoretical
  cardinality, and the frozen transfer constants; product prediction inputs
  are unavailable.
- **Schema compatibility:** v1 schema IDs and meanings remain unchanged; new
  serialized v2 boundaries receive additive versioned schemas.
- **Branch-policy mismatch:** retain the explicitly requested branch name and
  report any branch-only policy failure without changing policy.

No implementation decision may depend on how the Phase 9 product would score
against v2.

## Applicable ADRs and contracts

- [ADR 0008](../architecture/decisions/0008-artifact-first-retrieval-foundation.md)
  requires additive forward correction after an authority has been used,
  blind-first baseline prediction generation, immutable digests, and
  evaluation-only ownership.
- [ADR 0009](../architecture/decisions/0009-production-retrieval.md) requires
  rejected independent judgments to be corrected through a separate reviewed
  corpus-authoring change and prohibits changing gold to fit production output.
  It remains unchanged in this main-based branch.
- A new ADR records v2 review reconciliation, versioning, and the frozen gate
  transfer without importing Phase 9 results.
- Query `retrieval-evaluation-query/1.0.0`, normalization, clarification,
  hard-filter, no-result, equivalence, baseline strategy, and scorer versions
  retain their meanings. Corpus and relevance advance to 2.0.0. Prediction,
  score-report, and baseline-report wrappers advance only where their closed
  v1 schema cannot bind a v2 corpus.

## Architecture, data flow, and performance impact

```text
authenticated blind review + v1 relevance + fixed reconciliation
                            |
                            v
              content-free review record
                            |
                            v
        immutable retrieval-v2 corpus and manifest
                            |
              blind queries load first
                            v
        unchanged baseline candidate generation
                            |
             freeze prediction digests
                            v
          load reviewed v2 relevance and score
                            |
                            v
       content-free baseline and gate authorities
```

All paths are repository-contained, fixed, bounded, synchronous evaluation
tools. Corpus bounds remain 256 KiB per JSON document, 16 MiB total, 500 files,
64 depth, 50,000 nodes per document, and 500 diagnostics. Baseline result count
remains ten. No network, concurrency, retry, timeout, database, or production
operational concern is introduced.

## Security, privacy, abuse, and supply-chain considerations

The external review and comparison files are untrusted inputs authenticated by
exact SHA-256 before use. They remain outside the repository. The permanent
record contains only versions, digests, counts, matrices, decisions, and final
distribution: no candidate descriptions, repository prose, production score,
rank, Recall/MRR/NDCG, credential, reviewer personal data, or raw review body.
Evaluation content remains inert. No candidate code or repository-authored
content is executed. No dependency or lockfile change is planned.

## Implementation milestones

### Milestone A — reviewed corpus authority

1. Add failing tests for v1 immutability, additive v2 schema/version closure,
   exact 636-key reconciliation, accepted 33-key correction set, rejected
   comparison companions, final grade counts, and content-free review record.
2. Add the minimal version-aware evaluation types, schema registry, corpus and
   blind-loader boundaries.
3. Generate `evals/retrieval-v2/**` additively and validate exact semantic
   identity for every unchanged authority.
4. Commit as `test(eval): establish reviewed retrieval-v2 authority`.

### Milestone B — blind baselines, ceilings, and gates

1. Add failing tests for v2 blind baseline generation, unchanged strategy
   versions, theoretical ceiling math, transfer constants, target selection,
   deterministic rounding, and content-free reports.
2. Generate and verify the v2 baseline report without changing strategies.
3. Generate the v2 ceiling/gate authority before any product-v2 score.
4. Run full validation and commit as
   `test(eval): regenerate retrieval-v2 baselines and gates`.

### Publication

Push normally, open a draft PR to `main`, keep PR #22 untouched, observe
naturally triggered CI, and stop for independent review without merge.

## Testing and validation strategy

Focused tests cover exact version/schema closure, hostile/malformed review
records, incorrect accepted-change sets, v1/v2 key drift, grade-distribution
drift, query and non-relevance semantic identity, v2 manifest/hash/digest
drift, blind-loader isolation, prediction repeatability, unchanged strategy
versions, score/report bindings, controls, ceiling formula, threshold transfer,
rounding, gate-above-ceiling rejection, content audits, and writer path/symlink
protection.

Required commands from the isolated worktree:

```bash
pnpm runtime:check
pnpm format:check
pnpm build
pnpm typecheck:internal
pnpm lint:internal
pnpm repo:check
pnpm eval:retrieval:validate
pnpm eval:retrieval:fixtures
pnpm eval:retrieval:verify
pnpm eval:retrieval:v2:validate
pnpm eval:retrieval:v2:fixtures
pnpm eval:retrieval:v2:verify
pnpm architecture:check
pnpm security:secrets
pnpm security:audit
pnpm verify
git diff --check
git status --short --branch
```

No command may execute Phase 9 production retrieval against v2.

## Observability and operations

Not applicable to product telemetry: this is deterministic, offline,
repository-local evaluation tooling. Diagnostics remain bounded, stable,
content-free, and value-free where inputs fail. The PR and committed plan are
the audit trail.

## Migration, compatibility, rollout, and recovery

This is additive forward correction. `retrieval-v1` and
`verification/retrieval-v1` remain available and byte-identical. V2 uses a new
corpus ID/version and separate verification paths. No database or deployed
consumer migration exists. If validation fails before publication, discard or
correct only v2 files on the unpublished branch. After publication, use normal
forward commits; never amend, rebase, squash, or force-push. Phase 9 resumes
only after independent acceptance and merge.

## Exact exit criteria

- Issue #23 and draft PR document the correction and isolation.
- V1 tree identity equals `1ef5d85f702a73ae5065b03de184b19f8886e36a`.
- V2 has 30 retrieval, 20 normalization, 636 relevance judgments, exact keys,
  exactly 33 changed grades, and distribution `97 / 79 / 398 / 62`.
- Eight named-comparison companions remain grade 0; all other v1 grades remain.
- Review record, baseline report, and gate authority validate and are
  content-free.
- Baseline algorithms and scorer remain unchanged; v2 predictions/reports are
  deterministic and blind-first.
- New ceilings and gates follow the frozen formulas and do not exceed the
  theoretical ceiling.
- All required checks pass except any explicitly disclosed branch-name policy
  mismatch caused solely by the required branch name.
- No production retrieval-v2 score, Phase 9 mutation, or Milestone 4 work
  occurred.
- Two forward commits are pushed and a draft PR to `main` remains unmerged.

## Progress log

- [x] 2026-08-08 — Authenticated repository, PR #22, external review, blind
      bundle, and three comparison-output hashes; created Issue #23 and isolated
      main-based worktree.
- [ ] Establish reviewed v2 corpus authority and first commit.
- [ ] Regenerate v2 baselines, ceilings, and gates and create second commit.
- [ ] Complete validation, push, open draft PR, and observe CI.

## Decision and deviation log

- 2026-08-08 — Preserve v1 and use additive v2 because v1 already bound a
  historical production benchmark. Owner: maintainers via Issue #23.
- 2026-08-08 — Accept 33 preferred-case corrections, reject eight unnamed
  comparison companions, and retain 321 stricter same-binary calibration
  judgments. Owner: maintainer reconciliation.
- 2026-08-08 — Freeze family gates at 90% of v2 family ceilings and macro gate
  at the maximum of the frozen ceiling fraction and baseline margin before any
  product-v2 score. Owner: maintainer threshold authority.
- 2026-08-08 — Use the explicitly requested branch name despite the usual
  issue-number rule; do not weaken repository policy. Owner: task authority.

## Validation evidence

Pending implementation. Record every command, exit status, material count,
digest, failure, and resolution here before publication.
