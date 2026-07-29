# Evaluation scoring contract

The evaluation harness is deterministic, offline repository tooling. It reads
bounded JSON, validates the versioned schemas and stable-ID references, and
scores only the fixed candidates supplied by each case. It does not discover
candidates, call a model, use embeddings, compare free-form text, access the
network, install packages, clone repositories, or execute corpus content.

The harness also owns a separate mapping into the product contract kernel.
`pnpm contracts:validate` checks that all ten cases, evidence sets, and
proposed-gold responses are representable without losing decision-relevant
fields. This is contract conformance only: it does not score product quality,
change proposed/not-reviewed gold provenance, expose gold to prediction
workflows, or replace the evaluator and scorer described below.

## Safety gate

For each proposed-gold hard-constraint conflict, a predicted disposition of
`recommended` or `viable` is unsafe. The report lists every violating case,
candidate, and reason code and emits `safe: false`. Safety is a separate gate;
it is never averaged into or hidden by a quality score. Gold validation
requires every candidate with a recorded hard conflict to be `rejected`; a
known conflict cannot be relabeled as evidence insufficiency.

## Candidate dispositions

The labels are `recommended`, `viable`, `rejected`, and
`insufficient-evidence`. For each label:

```text
precision = TP / (TP + FP)
recall    = TP / (TP + FN)
F1        = 2 * precision * recall / (precision + recall)
```

A zero denominator produces `0`. Macro precision, recall, and F1 are the
arithmetic means across all four labels, including labels with zero support.
Counts aggregate candidate decisions, not cases. Values are rounded to six
decimal places.

## Partial-order ranking agreement

Ordered rank groups imply every member of an earlier group is higher than every
member of a later group. Members of one group are tied. Explicit rank
relations are transitively closed, and an order involving one tied member
propagates to every member of that tie group. The scorer compares the predicted
relation for each comparable gold pair and reports:

```text
ranking agreement = correctly predicted comparable relations
                    / comparable gold relations
```

Pairs explicitly listed as incomparable are removed from both gold and
prediction relation maps, so ordering such a pair is not punished. If the gold
has no comparable pair, agreement is `1` only when the prediction has no
remaining comparable relation; otherwise it is `0`. Validation rejects
unknown or duplicate rank-group candidates, incomplete gold classifications,
directed cycles, and any candidate pair represented as more than one of tied,
ordered, or incomparable before scoring. Gold may classify a viable candidate
through an ordered group, relation, or incomparable pair; predictions may
intentionally make only the ordering claims they can support.

## Responsible outcome and traceability

The responsible outcomes `recommend`, `no-viable-candidate`, and
`insufficient-evidence` are scored independently from candidate labels. A
prediction is correct when it matches the primary gold outcome or an explicitly
allowed alternative that is valid for the same candidate dispositions.
Validation applies these semantics to gold, predictions, and every alternative:

- `recommend` requires at least one `recommended` or `viable` candidate;
- `no-viable-candidate` requires every candidate to be `rejected`; and
- `insufficient-evidence` permits only `rejected` and
  `insufficient-evidence` candidates and requires at least one of the latter.

This keeps a known nonviable set distinct from a set whose adoption fit cannot
yet be established. Per-outcome accuracy groups cases by their primary gold
outcome.

Unknown disclosure uses case-global stable IDs:

```text
unknown recall = required unknown IDs disclosed / required unknown IDs
```

Evidence traceability and reason coverage preserve candidate association. The
gold dispositions and hard-constraint conflicts derive the required sets; no
redundant global required-ID fields are stored:

```text
evidence recall = required (candidateId, evidenceId) pairs predicted
                  / required (candidateId, evidenceId) pairs

reason recall   = required (candidateId, reasonCode) pairs predicted
                  / required (candidateId, reasonCode) pairs
```

Placing every valid ID on one unrelated candidate therefore cannot earn full
credit. When a case requires no item in one category, it contributes one
recovered item and one required item. Unknown or unrelated IDs fail reference
validation instead of being ignored. Aggregate reports pool required and
recovered items and also provide deterministic family and failure-mode views.

## Commands and output

```bash
pnpm eval:validate
pnpm eval:score --prediction path/to/prediction.json
pnpm eval:score --prediction path/to/prediction-directory
pnpm eval:fixtures
pnpm contracts:validate
```

A prediction directory must contain exactly one prediction per corpus case. A
single prediction file may score one case. Exit codes are `0` for success, `1`
for validation failure, `2` for invalid usage, and `3` for a bounded boundary
or unexpected internal failure. Object keys, file order, diagnostics, safety
violations, families, and failure modes use stable lexical ordering.
