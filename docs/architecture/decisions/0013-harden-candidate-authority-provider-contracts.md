# ADR 0013: Harden candidate-authority provider contracts after the consumed M3 attempt

- Status: Proposed for independent postmortem acceptance
- Date: 2026-08-11
- Issue: #32
- Pull request: #33

## Context

The first provider-effect Milestone 3 collection authorized by candidate-authority-live-authorization/3.0.0 reached candidate-provider effects and failed fatally with the safe code `ingestion.provider-response`. That collection is consumed. It persisted neither a source receipt nor a candidate source authority, and no all-candidate projection or readiness measurement followed.

The execution did not emit its in-process cutoff, candidate identifier, operation identifier, logical-request counts, attempt counts, or retry counts. Those values are unavailable and may not be reconstructed from implementation guesses. Static review after the stopped execution identified provider-contract and cancellation defects without using candidate values or coverage.

## Decision

1. The consumed v3 collection is immutable failure history recorded by `candidate-authority-live-failure-record/1.0.0`. Authorization v3 has zero remaining collections and its operator must not be rerun.
2. The failed execution produced no candidate source authority and therefore no Milestone 3 readiness evidence. Milestone 3 is incomplete and inconclusive; this is not a readiness NO-GO.
3. No candidate value or coverage from the failed execution is available or admissible for source-rule, extraction, threshold, or breadth tuning.
4. A future provider effect, if independently accepted, is a new successor experiment under authorization v4 and operator v4. It is not an automatic or semantic retry of authorization v3.
5. The successor source contract removes community profile and Compose Contents, uses immutable local Git-tree positive evidence for repository security policies, normalizes provider advisory vocabulary separately from product vocabulary, treats supported optional-source limitations as qualified unknown, and preserves fatal identity, integrity, authentication, authorization, redirect, transport-bound, required-source, and internal-invariant failures.
6. The successor operator combines caller cancellation with an internal first-fatal signal, stops assigning work, aborts in-flight siblings, waits for settlement, preserves the causal first fatal, and only then emits bounded safe counters.
7. The readiness denominator remains 18, the minimum remains 13/18 (72.222222%), and all four breadth groups remain required. Human/model values, N/A-only fields, zero output, unknown, and conflict remain excluded. Planned deterministic extraction capability remains 13; planned deterministic full-closure candidates decrease from six to five because local security-policy absence cannot close account-level defaults. Full closure is not the readiness numerator.

## Consequences

The field plan evolves additively to v5, the source policy to v6, the pure replay algorithm to v3, and the live operator to v4. The five planned full-closure candidates are package-publication-version, runtime-package-format, package-repository-linkage, archived-state, and maintenance-activity.

Authorization v4 remains inactive until an independent reviewer accepts the exact postmortem-correction head. Before that acceptance, no credential read, cutoff creation, or provider call is permitted. A later accepted execution must still freeze the source authority in a source-only commit before replay or readiness measurement.

## Rejected alternatives

- Rerunning authorization v3 is rejected because its only provider-effect collection is consumed.
- Treating this failure as a readiness NO-GO is rejected because no readiness authority exists.
- Inferring the failed candidate, operation, cutoff, or counts is rejected because those facts were not emitted.
- Recovering negative security-policy closure from repository-local absence is rejected because account-level default community-health policy remains unresolved.
- Lowering the 13/18 threshold or breadth gate is rejected because provider-contract correction does not authorize readiness-policy change.
