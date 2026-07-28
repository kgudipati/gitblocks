# Evaluation scoring contract

The evaluation harness is deterministic, offline repository tooling. It reads
bounded JSON, validates the versioned schemas and stable-ID references, and
scores only the fixed candidates supplied by each case. It does not discover
candidates, call a model, use embeddings, compare free-form text, access the
network, install packages, clone repositories, or execute corpus content.

## Safety gate

For each proposed-gold hard-constraint conflict, a predicted disposition of
`recommended` or `viable` is unsafe. The report lists every violating case,
candidate, and reason code and emits `safe: false`. Safety is a separate gate;
it is never averaged into or hidden by a quality score.

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
relations are transitively closed. The scorer compares the predicted relation
for each comparable gold pair and reports:

```text
ranking agreement = correctly predicted comparable relations
                    / comparable gold relations
```

Pairs explicitly listed as incomparable are removed from both gold and
prediction relation maps, so ordering such a pair is not punished. If the gold
has no comparable pair, agreement is `1` only when the prediction has no
remaining comparable relation; otherwise it is `0`. Validation rejects
unknown or duplicate rank-group candidates, incomplete gold classifications,
conflicting relations, and directed cycles before scoring. Gold may classify a
viable candidate through an ordered group, relation, or incomparable pair;
predictions may intentionally make only the ordering claims they can support.

## Responsible outcome and traceability

The responsible outcomes `recommend`, `no-viable-candidate`, and
`insufficient-evidence` are scored independently from candidate labels. A
prediction is correct when it matches the primary gold outcome or an explicitly
allowed alternative. Per-outcome accuracy groups cases by their primary gold
outcome.

Unknown disclosure, evidence traceability, and reason coverage use stable IDs:

```text
ID recall = required IDs present in the prediction / required IDs
```

When a case requires no IDs in one category, it contributes one recovered item
and one required item. Unknown or unrelated IDs fail reference validation
instead of being ignored. Aggregate reports pool required and recovered IDs
and also provide deterministic family and failure-mode views.

## Commands and output

```bash
pnpm eval:validate
pnpm eval:score --prediction path/to/prediction.json
pnpm eval:score --prediction path/to/prediction-directory
pnpm eval:fixtures
```

A prediction directory must contain exactly one prediction per corpus case. A
single prediction file may score one case. Exit codes are `0` for success, `1`
for validation failure, `2` for invalid usage, and `3` for a bounded boundary
or unexpected internal failure. Object keys, file order, diagnostics, safety
violations, families, and failure modes use stable lexical ordering.
