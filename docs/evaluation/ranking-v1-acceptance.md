# Ranking-v1 Milestone 2 acceptance

Phase 10 Milestone 2 is independently accepted at reviewed content head
`700e84b6c50b326d3c6d2913634a221d4643756e`. The accepted scenario corpus
remains version `3.0.0`; the additive accepted composite manifest is version
`ranking-v1-manifest/4.0.0` with canonical digest
`53e0117e0fa8f8633b76fdf0ac73def2a002ffa41ae446adad7d31f9ce4f4874`.
The review record separately preserves the pre-acceptance reviewed-manifest
digest `458b7d521ec56cbb3c0593336f46ad12581f190412527948ea47f61e1e27787b`.

The historical gold remains authored/proposed content. Its authority becomes
accepted through
`evals/ranking-v1/reviews/accepted-review-record.json`, which records Codex as
author and the review role as `independent-maintainer-review` without inventing
a reviewer identity. The record binds all 30 cases, zero disputes, reviewed
gold digest
`48644422e325ecf385ae8fe3ef71a936549eab6ae0f1f75b98feaadc8640b081`,
and reviewed core-authority digest
`061e4774c1ab5f9a3793aaa46dfd917597f0378fb882c80f30b15a6431fb225e`.
It also binds every reviewed JSON file by exact SHA-256. The accepted review
record digest is
`18ba16b1266423fc18d3c8ffc2b39c2d399453ed0f24bc5e89c9d4f967a42cef`.

Ranking-v1 is an independently reviewed deterministic scenario/conformance
authority for Ranking V1. It is not production candidate authority, a claim
that scenario fixtures are current facts about named OSS projects, a
statistical estimate of open-world ranking accuracy, or proof of superiority
over unaided expert or general-agent research. Scenario-synthetic and pilot-
crosswalk evidence remains evaluation authority only.

## Accepted fixed-candidate gates

`evals/ranking-v1/gates/accepted-gates.json` is the canonical gate authority;
its digest is
`b44de7aaf3fc997c10c31739862836f6f1a05fe1f80b1a19bc53c4dec7084460`.
Every safety count must be zero: known hard-conflicts recommended, viable, or
ranked; candidate invention; candidate-set mismatch; excluded leakage;
unresolved evidence-needed positive promotion; missing closure; preference
hardening; favorable unbound-success use; and unbound-preference order effect.
Ranking references must remain inside both the supplied candidate set and the
complete-group maximum-results boundary.

Exact conformance requires:

- responsible outcomes 30/30 overall, 6/6 per family, with recommend 20/20,
  no-viable 5/5, and insufficient-evidence 5/5;
- all 120 candidate dispositions, with zero off-diagonal confusion and 1.0
  precision/recall/F1 for every applicable disposition;
- controlled target pairs 5/5 exact, with no wrong maximal set, wrong
  direction, or unchanged result;
- partial order 22/22: ordered 16/16, ties 4/4, incomparable 2/2, and no false
  ordering of an incomparable pair;
- top-three usefulness 20/20;
- evidence-needed closure 35/35: satisfied 15/15, conflict 10/10, unresolved
  10/10, and no illegal promotion;
- criterion behavior 208/208 bound-success coverage, 20/20 material-unbound
  fail-closed, 12/12 approved non-material unbound, 25/25 bound-preference
  comparison consequence, 5/5 unbound-preference counterfactual non-effect,
  and 30/30 no preference hardening; and
- traceability 225/225 required decision evidence, 120/120 reasons, 30/30
  material unknowns, 70/70 hard conflicts, and zero unsupported extra
  associations.

The strongest non-oracle reference floor remains weak target-aware exact
compatibility version `3.0.0`. Its reviewed output has 30/30 responsible
outcomes, 20/20 top-three usefulness, and zero safety violations, but only 2/5
controlled pairs and 6/22 partial-order relations. It is a floor, not an
acceptance ceiling.

The five-case composition authority is accepted only as a retrieval-to-ranking
handoff diagnostic. Its temporary insufficient-evidence outcomes reflect the
intentional absence of M3 production candidate authority and are not production
quality targets. Fixed-candidate ranking-v1 remains the ranking-quality gate.

## Deterministic readiness

The accepted denominator is `ranking-decision-denominator/1.0.0`, size 18.
Minimum readiness is 13/18, exactly 72.222222%. A field counts only when a
versioned reproducible deterministic extraction rule produces it from accepted
bounded source authority without human/model judgment, with known or
deterministic-not-applicable closure for every applicable catalog candidate.
Human-reviewed, model-derived, and unknown values do not count; unknown is
never favorable.

The ready set must include at least one field from each of capability/adoption,
stack/package, infrastructure/deployment, and policy/risk. The exact field lists
and canonical readiness-policy digest are frozen in the gate authority. Any
reinterpretation requires independent ADR review before production ranking
output exists. The readiness-policy digest is
`6330d6d882a6a0620fc80e335a20f2d1fee2280318586cbe9c2c36900a1f2e04`.

## Performance and determinism

The maximum accepted envelope is 20 candidates, 2,000 evidence observations,
60 criteria, and 190 unordered pairs. The existing version 2.0 performance
reference remains evaluation-data evidence and is not relabeled a production
benchmark.

Pure production Ranking V1 budgets are parse/validation p95 at most 50 ms,
candidate/evidence traversal p95 at most 25 ms, pair enumeration p95 at most
10 ms, canonicalization p95 at most 75 ms, combined bounded work p95 at most
100 ms, combined maximum at most 250 ms, and retained heap growth at most
16 MiB. Measurement must record exact runtime, hardware, and process context.

Later production proof requires 100 repeated identical executions, 20 fixed
input-order permutations, and 10 fresh-process executions. Canonical results
must be identical and independent of ambient randomness, clock, environment,
network, filesystem mutation, database, and model/provider effects. Candidate
ID may canonicalize an already-derived relation but may not decide fit;
retrieval order and score may not decide fit.

## Authorization boundary

Publication completes M2 and authorizes M3 only for the ADR 0011 candidate-
authority successor: ordinary-runtime authority for all 150 catalog candidates,
accepted consumed facts/evidence, compatible deterministic Phase 8 reuse,
fit-consumable evidence/dossiers, and measurement against this frozen policy.
It does not authorize the production ranking package, ranking output, M4/M5,
models/interviews, vectors, product interfaces, database resurrection, or Phase
8 execute #5. No M3 work began in the acceptance operation.
