# Repository interview evaluation authority v1

This directory is the content-minimized, evaluation-only authority for Phase
7 repository interviews. It is separate from `pilot-v1`: it contains no
target-repository request, ranking gold, candidate source body, prompt, model
response, semantic statement, cited text, or reviewer note.

The manifest binds the frozen `public-v1` catalog and Phase 6 artifact
manifest, all three repository-interview production schemas, and the accepted
repository-interview specification/schema projections. It deliberately does
not bind a model or model-profile digest. Member byte hashes and a
domain-separated corpus digest cover the four policy files, 12 closed
evaluation schemas, 30 candidate documents, and 12 synthetic adversarial
fixtures. This README is excluded.

## Cohort authority

The amended cohort has six candidates in each capability family, one catalog
negative control in each family, three archived candidates, two moved
candidates, 12 rich-additional-documentation cases, and 18 README-only cases.
Lifecycle diversity is cohort-level: rate limiting and webhooks correctly have
no archived or moved member. Every family has at least one simple/helper,
complex service/platform, and likely-material-unknown label.

Candidate documents use only closed controlled selection metadata. They have
no exclusive primary stratum. `selectionLabels` is sorted and may express
multiple reviewed selection pressures without reclassifying catalog status.

Calibration order is fixed as:

1. `auth-warrant`
2. `audit-datadog-trace-js`
3. `jobs-node-cron`
4. `jobs-dagster`
5. `rate-redis-cell`
6. `webhook-hookdeck`

The zero-based ordinals in the files are 0 through 5. This is cohort authority
only; no model is selected or executed.

## Human audit and gates

Audit and run documents are future inputs validated by the separate schemas;
none are committed here. Every completed run result carries a content-free
audit scope derived from one valid request/execution/interview exchange. That
scope binds the three record digests and the complete ordered claim,
limitation, contradiction, and unknown ID inventory. Failed results carry no
interview or scope.

Opaque reviewer IDs, durable semantic-item IDs, and controlled verdicts allow
exact scoring without storing reviewer identity, source content, claim text,
or notes. Each Gate A primary, and both blind calibration reviews, must cover
every durable claim, limitation, and contradiction exactly once. Limitation
and disclosed-unknown references must close within the same interview.

Gate A requires one primary per candidate, mandatory secondaries, and a
review-policy-driven cohort-wide SHA-256 ordered ceiling sample of 10% of
remaining material subjects. A secondary record covers exactly its assigned
durable subjects and cannot enlarge the semantic denominator. A policy-only
secondary may have no semantic subjects. Material disagreements use the
separate narrow adjudication schema: exactly two source reviews and only the
disputed subject, unknown, or individual policy-field resolutions.

Operational failures fail the cohort but never dilute semantic denominators.
The deterministic scorer consumes the reviewed gate policy, compares integer
cross-products without rounding, rejects empty unknown or basis denominators,
and binds the run, durable scope set, audit set, adjudication set, model
profile, corpus, and all four policy authorities into the complete
content-free report digest.

## Commands

`pnpm eval:interviews:validate` is read-only and fails on schema, membership,
catalog, hash, policy, corpus-digest, or generated-authority drift.
`pnpm eval:interviews:fixtures` runs only synthetic gate-boundary scenarios.
`pnpm eval:interviews:verify` runs both plus focused tests, type checking, and
architecture checks. `eval:interviews:generate` is explicit and is never run
by import, build, test, install, or ordinary validation.

The fixtures define threats for later behavioral calibration and human audit.
Their deterministic rendering and mapping checks do not prove model resistance
to prompt injection.
