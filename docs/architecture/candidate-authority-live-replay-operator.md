# Candidate-authority live and replay operator

Status: **pre-effect successor frozen; independent exact-head review required**

This document freezes the complete Phase 10 Milestone 3 operator before any
live candidate value is available. It does not authorize this correction to
inspect a credential, call a provider, create a collection cutoff or source
authority, project all 150 candidates, measure readiness, or begin Milestone 4.

## Prior invocation disposition

The first invocation at
`a1c141e87c96187c8edb5779709fa5ef04089390` stopped at credential read because
the scoped credential was unavailable. This is a **pre-effect credential-gate
failure**, not a provider-collection failure. Credential availability was
false; the collection cutoff was absent; GitHub logical requests, npm logical
requests, candidate-provider calls, and consumed provider-effect collections
were zero. Source and staging authorities were absent. All-candidate
projections and coverage/readiness calculations were absent. No provider
receipt exists or is implied.

Authorization v1 remains immutable history. Additive successor
`candidate-authority-live-authorization/2.0.0` is
`catalog/public-v1/candidate-authority-live-authorization-v2.json`, digest
`9184ce87d1e74e10d2dcfa91f7b4302292d7f92fa5e1e5bb8378d97339074129`.
It binds the accepted pre-live head, prior operator head, v1 authorization and
digest, accepted policy authorities, prior disposition, exact request and
attempt ceilings, all fixed output/staging paths, and the sole credential name
`GITBLOCKS_CANDIDATE_AUTHORITY_GITHUB_TOKEN`. Zero provider-effect collections
were consumed, so exactly one remains. Automatic rerun, database, Docker,
model, and ranking effects remain false.

## Closed execution lineage

Future live preflight requires this exact Git ancestry:

```text
47397ce92ee500c011fe39820053ba22fd6b397b
  -> a1c141e87c96187c8edb5779709fa5ef04089390
    -> exactly one ordinary additive successor correction commit
```

The branch and origin head must match, the worktree and index must be clean,
and all output and owned staging paths must be absent. The successor head must
be independently reviewed before credential inspection. A later defect would
require another additive authorization and an explicitly evolved exact lineage;
published history is never amended, rebased, or force-pushed.

Live operator `candidate-authority-live-operator/2.0.0` reads the sole scoped
credential only after that preflight passes. A future fatal failure after a
provider request stops without automatic rerun. Successful source publication
ends provider eligibility permanently for this M3 authority.

## Source freeze and replay sequence

The only permitted future order is:

```text
one live collection
  -> read-only source validation
  -> exclusive atomic source publication
  -> commit only the source authority
  -> push the source-freeze commit
  -> pure replay generation and validation
  -> first realized-readiness measurement
  -> read-only readiness/root reproduction
```

Replay resolves the commit that first added the source path. That source-freeze
commit must be an ancestor of current `HEAD`, have the live collection
execution head as its direct parent, and change exactly the source-authority
path. The exact working bytes must equal `git show
<source-freeze-head>:<source-path>`. Current `HEAD` and origin must agree. An
untracked, merely staged, modified, or non-ancestor source cannot be replayed.

## Command separation

- `pnpm candidate-authority:replay:preflight` is read-only. It validates all
  accepted bindings, canonical committed source bytes, the isolated source
  freeze, clean Git state, and absence of all replay/readiness outputs. It does
  not calculate coverage.
- `pnpm candidate-authority:replay:generate` repeats preflight and writes only
  the five fixed replay authorities. It does not decide readiness.
- `pnpm candidate-authority:replay:validate` is read-only. It regenerates the
  five semantic authorities from the committed source and requires byte-exact
  equality.
- `pnpm candidate-authority:readiness:measure` is the sole first-realized
  measurement command. It requires byte-exact replay validation and absent
  readiness/root outputs, applies policy v3, and writes only those two outputs.
- `pnpm candidate-authority:readiness:validate` is read-only and reproduces the
  report and root byte-for-byte.

The replay CLI and filesystem effects have no environment input, provider
transport, network API, database adapter, Docker adapter, model adapter, or
evaluation import.

## Frozen authorities and bounds

| Output             | Version                                                       | Fixed path                                                         | Maximum serialized bytes |
| ------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------ | -----------------------: |
| profiles           | `candidate-authority-deterministic-profile-authority/1.0.0`   | `catalog/public-v1/candidate-authority-profiles-v1.json`           |               67,108,864 |
| partial evidence   | `candidate-authority-partial-field-evidence-authority/1.0.0`  | `catalog/public-v1/candidate-authority-partial-evidence-v1.json`   |              402,653,184 |
| fit evidence       | `candidate-authority-fit-consumable-evidence-authority/1.0.0` | `catalog/public-v1/candidate-authority-evidence-v1.json`           |              536,870,912 |
| dossiers           | `candidate-authority-dossier-authority/1.0.0`                 | `catalog/public-v1/candidate-authority-dossiers-v1.json`           |              536,870,912 |
| dossier projection | `candidate-authority-dossier-projection/1.0.0`                | `catalog/public-v1/candidate-authority-dossier-projection-v1.json` |               67,108,864 |
| readiness report   | `candidate-authority-realized-readiness-report/1.0.0`         | `catalog/public-v1/candidate-authority-readiness-report-v1.json`   |                4,194,304 |
| root               | `candidate-authority-root/4.0.0`                              | `catalog/public-v1/candidate-authority-root-v4.json`               |                4,194,304 |

Each output has one fixed sibling staging path recorded in authorization v2.
Exclusive no-follow writes stage complete synced bytes, publish with no-replace
hard links, and remove only owned staging/partial publication on failure.

The partial-record maximum is structurally frozen at 313 per candidate and
46,950 overall: 200 advisories, five releases, four recognized framework
peers, 100 Compose services, and one each for adoption, language, license, and
Dockerfile. Serialized bounds additionally cover 150 candidates, 27 profile
fields, bounded source strings and identifiers, dossier observations,
unknowns, limitations, projections, and canonical digests. They were selected
without observing live output size.

## Pure replay semantics

Replay algorithm `candidate-authority-pure-replay/1.0.0` consumes only the
committed source authority plus the accepted catalog, taxonomy, readiness
policy, field plan, source policy, partial registry, and partial evidence
contract. It reuses the ordinary deterministic-profile, partial-evidence, and
`CandidateDossierV1` contracts.

Complete fields use only the already frozen rules for package publication,
runtime package format, package/repository linkage, recognized license,
archived state, maintenance activity, complete release state, complete
advisory state, and security-policy presence. Unsupported, unavailable,
incomplete, or unmentioned semantics remain unknown; legal catalog-unmapped
package fields retain N/A.

Every partial fact revalidates its candidate owner, exact field, registry
version/digest, definition digest, extraction rule, affirmative polarity,
provenance kind, controlled value grammar, source completeness, source
authority/record digests, freshness, and unresolved remainder. The only
registered semantics are adoption surface, primary language, framework peer,
recognized SPDX, published release, applicable advisory, root Compose
self-build service, and exact-root Dockerfile build declaration.

For every candidate, replay produces complete observations, registered partial
observations, material unknowns and limitations, and one contract-valid
candidate-owned dossier with unique evidence IDs. The complete live replay
requires exactly 150 catalog identities and exactly 150 dossiers; no database
is consulted. Mutable structured sources share one candidate limitation with
all affected evidence references so the ordinary dossier contract remains
non-duplicative.

Candidate processing order is restored to the committed ordered identity list.
Partial facts, bindings, observations, unknowns, limitations, and projections
use stable identifier/digest ordering. Canonical JSON recursively sorts object
keys. Forward and reverse processing schedules, repeated replay, and legal
source-record permutations therefore reproduce byte-identical semantic
authorities and digests.

## Realized readiness and root

For each of the accepted 18 decision fields, the report records planned
capability, realized readiness, deterministic full closure, deterministic
known cells, deterministic N/A cells, validated deterministic partial-direct
cells, human-reviewed cells, model-derived cells, unknown cells, and conflict
cells.

A pre-frozen planned-capable field realizes only when:

```text
deterministic-known + validated deterministic-partial-direct-evidence > 0
```

N/A alone, zero output, human review, model output, unknown, and conflict do
not qualify. Full closure remains separately defined by deterministic known
plus deterministic N/A equaling all 150 candidates. The final decision is GO
only when at least 13 of 18 fields realize and every accepted breadth group has
at least one realized field. No result-driven tuning is permitted.

Root `candidate-authority-root/4.0.0` binds ADR 0012 and the accepted pre-live
head, live authorization v2 and collection execution head, catalog, taxonomy,
readiness policy, field plan, source policy, partial registry/evidence
contract, cutoff, ordered candidate identities, every replay/report digest,
planned/realized/full-closure counts, planned and realized breadth, all seven
cell-origin totals, decision, and its canonical digest.

No replay module may import Ranking V1 cases, gold, review rationale, baseline
predictions, scorer output, or another evaluation authority. Readiness reads
only accepted product policy/denominator authority. Candidate source values
remain inert data and are never cloned, installed, imported, or executed.
