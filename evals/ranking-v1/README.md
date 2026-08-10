# Ranking-v1 proposed evaluation authority

`ranking-v1` is the additive, offline, fixed-candidate evaluation authority for
Phase 10 Milestone 2. It asks whether a future deterministic ranker reaches a
responsible adoption-fit result for a supplied target repository. It does not
specify or implement the future production ranking algorithm.

The corpus is proposed authoring output. Its gold is **not independently
reviewed or accepted**, Milestone 2 is not accepted, and Milestone 3 remains
unauthorized. The 30 cases are deliberately balanced test authority, not a
claim of statistical representativeness.

## Authority layout

- `blind/cases.json` contains request, criterion-binding, target fingerprint,
  fixed candidate-set, and case-binding inputs.
- `evidence/candidate-evidence.json` contains bounded, evaluation-owned
  request-independent candidate/scenario facts. It contains no request
  criterion IDs, candidate-to-request mappings, or final closure answers. Each
  fact is labeled as either a committed pilot concept crosswalk or a
  scenario-synthetic fixture; neither is current production candidate
  authority.
- `handoff/phase9-lanes.json` retains exact eligible/evidence-needed lane state
  and every unresolved hard evaluation needed by the cases.
- `gold/outcomes.json` contains proposed outcomes, dispositions, partial orders,
  closure states, traceability, and criterion consequences.
- `audit/case-classifications.json` contains family and scenario labels that are
  unavailable to ordinary baseline strategies.
- `reviews/proposed-review-record.json` records Codex as author, no independent
  reviewer, and no accepted cases.
- `reviews/reviewer-rationale.json` contains evaluation-only case-by-case
  adjudication rationale and is inaccessible to ordinary baseline strategies.
- `baselines/specifications.json` freezes the human-readable deterministic rules
  and digests before scoring. `baselines/predictions/` contains complete frozen
  blind predictions.
- `reports/` contains aggregate/content-free baseline, composition, and
  performance-reference reports. It does not publish case winners, candidate
  recommendation lists, gold rationale, or evidence prose.
- `gates/proposed-review-inputs.json` packages evidence for later independent
  gate selection. Both the product-quality thresholds and the 13/18 versus
  14/18 readiness choice remain null.
- `fixtures/scorer-fixture-summary.json` binds synthetic scorer validation only.
- `composition/` keeps the retrieval-to-ranking diagnostic separate from the
  authoritative fixed-candidate track.
- `manifest.json` closes every JSON authority file by path and SHA-256.

`pilot-v1` remains immutable historical proposed authority. Retrieval-v1 and
retrieval-v2 relevance judgments are not ranking gold.

## Corpus shape

There are exactly 30 cases: six each for authorization, audit logging,
background jobs, rate limiting, and webhooks. Every family contains a
two-case controlled target pair, a hard-conflict/no-viable case, an
evidence-insufficient case, a popularity-over-fit audit case, and a tie or
explicit-incomparability case. Across the corpus there are five controlled
pairs, five no-viable cases, five insufficient-evidence cases, four tie pairs,
two incomparable pairs, 70 hard-conflict opportunities, and 35
evidence-needed transitions (15 satisfied, 10 conflict, and 10 unresolved).

The target pair keeps request intent, success conditions, hard constraints,
preferences, bindings, candidates, evidence, handoff state, and cutoff fixed.
Only declared target facts change. Candidate identities are real catalog
identities where practical, but all fact observations are explicitly bounded
evaluation fixtures with per-fact provenance and no production-freshness
claim. Success coverage, hard conflict, preference consequences, and
evidence-needed closure are derived from those facts plus bindings, target
facts, modality, and versioned evaluation rules; none is stored in blind
candidate evidence.

Corpus version `3.0.0` binds every material success criterion to the exact
candidate fact dimension whose vocabulary can prove it and rejects an
unreachable feature/value binding. Proposed gold is regenerated from those
bindings. Candidate `evidenceIds` are decision-minimal: they support the
assessment, reason, material comparison, conflict, closure, or uncertainty,
while the richer blind evidence authority remains available independently.
Reviewer rationale carries a validated criterion-to-fact-to-evidence crosswalk
for every success condition.

## Blind baseline protocol

Ordinary baseline generation reads only blind cases, candidate evidence,
Phase 9-style handoff state, and frozen specifications. It completes and
digests all predictions before any scoring path loads proposed gold. The
ordinary baselines are retrieval-order diagnostic, all-insufficient
responsible abstention, target-blind candidate features, and weak target-aware
exact compatibility. The hard-conflict-violating strategy is a negative
control. The synthetic oracle exists only inside hand-calculated scorer
fixtures and is excluded from gate-floor selection.

A popularity/health baseline is intentionally omitted because no safe,
already-committed bounded popularity authority suitable for this ranking
question exists, and M2 may not fetch new metrics.

## Commands

Read-only validation and reproduction:

```text
pnpm eval:ranking:validate
pnpm eval:ranking:fixtures
pnpm eval:ranking:baselines
pnpm eval:ranking:verify
pnpm contracts:validate
```

Explicit artifact writers are restricted to paths under `evals/ranking-v1`:

```text
pnpm eval:ranking:authority:generate
pnpm eval:ranking:fixtures:generate
pnpm eval:ranking:baselines:generate
pnpm eval:ranking:baselines:score
pnpm eval:ranking:composition:generate
pnpm eval:ranking:performance:generate
pnpm eval:ranking:gates:generate
pnpm eval:ranking:manifest:generate
```

The authoring writer is an explicit correction-only command whose separate
allowlist contains blind cases, proposed gold, author rationale/review record,
and baseline specifications. Ordinary artifact writers cannot change those
authorities.

The verify path checks manifest and corpus closure, criterion reachability and
lane closure,
scorer fixtures, forward/reversed baseline reproduction, candidate input
permutation invariance, complete tie/maximal-group overflow closure across all
ranking-reference surfaces, decision-minimal evidence ownership, rationale
crosswalk consistency, frozen reports,
composition reproduction, product-contract representability, proposed gate
state, product/evaluation separation, denied effects, authorized write paths,
and read-only filesystem behavior.

See
[the authoring protocol](../../docs/evaluation/ranking-v1-authoring-protocol.md)
and [Plan 0032](../../docs/plans/0032-codebase-conditioned-ranking.md).
