# Future independent baseline protocol

No generic-agent or GitBlocks performance baseline is run in Phase 2. The
committed weak fixtures are deterministic harness tests only. This protocol
defines how a later issue may produce a defensible independent baseline without
treating the authoring session as an evaluator.

## Preconditions

- Freeze an immutable corpus version, schemas, manifest hashes, scorer commit,
  and evidence cutoff.
- Obtain independent review of the proposed gold. Record reviewers,
  disagreements, resolutions, and accepted-gold provenance with a non-empty
  reviewer identifier, review timestamp, and bounded review reference; do not
  overwrite the authoring-session provenance.
- Pre-register the evaluated agent or system, model and exact version, prompt
  or procedure version, parameters, tool policy, run date, environment,
  prediction format, success gates, sample size, retry policy, and allowed
  variance.
- Separate corpus authors, gold reviewers, baseline operators, and prediction
  producers where practical. At minimum, the Phase 2 authoring session must not
  be represented as an independent operator or reviewer.

## Blind run

1. Give the prediction producer only the case inputs, bounded evidence, schemas,
   and prediction instructions. Deny access to gold, prior predictions, score
   reports, and fixture strategies.
2. Use a fresh session with no Phase 2 authoring context. Record any unavoidable
   contamination before the run.
3. Disable discovery and live retrieval. The producer evaluates only the fixed
   candidate set and committed evidence available at the frozen cutoff.
4. Capture the raw prediction files before scoring. Do not revise a prediction
   after seeing its score.
5. Run the deterministic schema/reference validator and scorer once under the
   registered policy. Invalid output is evidence, not a reason for an
   unregistered favorable retry.

## Reporting and review

Publish the complete safety gate, candidate metrics, ranking agreement,
responsible-outcome accuracy, stable-ID recalls, family and failure-mode
aggregations, invalid-output count, run metadata, and known contamination.
Human reviewers sample rationales for qualitative errors but do not silently
change deterministic metrics.

Never label the deterministic `first-candidate`, `all-viable`,
`always-abstain`, `omit-unknowns`, or `perfect` fixtures as a model baseline,
generic-agent performance, or GitBlocks performance. A later baseline remains
descriptive for its frozen system and corpus; it does not establish open-world
discovery quality.
