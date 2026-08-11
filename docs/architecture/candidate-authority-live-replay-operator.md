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

Authorizations v1 and v2 remain immutable history. Additive successor
`candidate-authority-live-authorization/3.0.0` is
`catalog/public-v1/candidate-authority-live-authorization-v3.json`, digest
`3d39801eeabef0e09be54875216a99ff3e864296f0f682c3029010fa9fbe793f`.
It binds the accepted pre-live, prior live-operator, and prior replay-operator
heads; authorization v2 and digest; source policy v5; replay algorithm v2;
the accepted readiness, field-plan, and partial authorities; the prior
disposition; exact unchanged request and attempt ceilings; all fixed
output/staging paths; and the sole credential name
`GITBLOCKS_CANDIDATE_AUTHORITY_GITHUB_TOKEN`. Zero provider-effect collections
were consumed, so exactly one remains. Automatic rerun, database, Docker,
model, and ranking effects remain false.

## Closed execution lineage

Future live preflight requires this exact Git ancestry:

```text
47397ce92ee500c011fe39820053ba22fd6b397b
  -> a1c141e87c96187c8edb5779709fa5ef04089390
    -> 4152fb744086bb13ad581b461044a0e2670df1f4
      -> exactly one ordinary additive provenance-correction commit
```

The branch and origin head must match, the worktree and index must be clean,
and all output and owned staging paths must be absent. The successor head must
be independently reviewed before credential inspection. A later defect would
require another additive authorization and an explicitly evolved exact lineage;
published history is never amended, rebased, or force-pushed.

Live operator `candidate-authority-live-operator/3.0.0` reads the sole scoped
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
commit must be an ancestor of current `HEAD`, have the future independently
accepted provenance-correction execution head as its direct parent, and change
exactly the source-authority path. The exact working bytes must equal `git show
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

Each output has one fixed sibling staging path recorded in authorization v3.
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

Replay algorithm `candidate-authority-pure-replay/2.0.0` consumes only the
committed source authority plus the accepted catalog, taxonomy, readiness
policy, field plan, source policy, partial registry, and partial evidence
contract. It reuses the ordinary deterministic-profile, partial-evidence, and
`CandidateDossierV1` contracts.

Source policy `candidate-authority-source-policy/5.0.0`, digest
`f1fb17132e42769385e0c4b8e9bb555dd31cdb1fccec3bc93f9c173f6bab725b`,
changes only `github-license` retention. The unchanged request
`GET /repos/{owner}/{repository}/license?ref={headSha}` now retains normalized
SPDX identity, exact provider path, provider Git blob SHA, canonical repository
identity, and exact head SHA. It retains no license body, raw response,
download or temporary URL, or authorization header. Repository-relative paths
are bounded to 1,024 UTF-8 bytes and reject control characters, absolute/URI
forms, backslashes, empty or dot/traversal segments, and query/fragment
characters. Git object identities are exact lowercase 40-hex SHAs.

License evidence uses the canonical retained owner/repository, exact head SHA,
and safely segment-encoded exact provider path. No filename is inferred. An
unsafe or mismatched provider response fails closed before source publication;
404, null, and `NOASSERTION` remain unknown and produce no favorable license
fact or invented path. The recognized-SPDX field/rule/registry semantics are
unchanged.

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
head, live authorization v3 and collection execution head, catalog, taxonomy,
readiness policy, field plan, source policy, partial registry/evidence
contract, cutoff, ordered candidate identities, every replay/report digest,
planned/realized/full-closure counts, planned and realized breadth, all seven
cell-origin totals, decision, and its canonical digest.

No replay module may import Ranking V1 cases, gold, review rationale, baseline
predictions, scorer output, or another evaluation authority. Readiness reads
only accepted product policy/denominator authority. Candidate source values
remain inert data and are never cloned, installed, imported, or executed.

## Consumed v3 attempt and inactive successor architecture

The provider-effect collection at execution head
`2cfe0682617fb303ebbb2deb7dd7bd34a383c912` is consumed. Its safe terminal
result was `ingestion.provider-response`; no source receipt, source authority,
projection, or readiness report was persisted. The exact cutoff, candidate,
operation, request counts, attempts, and retries were not emitted and remain
unavailable. The immutable facts are recorded by
`candidate-authority-live-failure-record/1.0.0`; ADR 0013 distinguishes those
observations from later static implementation diagnosis. This outcome leaves
M3 incomplete and inconclusive, not readiness NO-GO.

The additive successor uses field plan v5, source policy v6, provider contract
v1, live operator v4, replay algorithm v3, and authorization proposal v4.
Authorization v3 has zero remaining collections. Authorization v4 is inactive
until an independent reviewer accepts and records the exact published
postmortem-correction head, so the historical live CLI fails before credential
access or cutoff creation.

Community profile and Compose Contents are not successor operations. Security
policy presence uses only exact-commit positive Git-tree evidence at
`SECURITY.md`, `.github/SECURITY.md`, or `docs/SECURITY.md`; local absence stays
unknown because account-level default policy is unresolved. Provider advisory
`medium` normalizes to product `moderate`, while provider `unknown` retains the
advisory identity with unresolved severity and cannot establish a complete
maximum. Reviewed, non-withdrawn advisories are queried with exact npm
package/version binding.

Valid optional tree truncation, the stricter local tree-entry limit, unsupported
optional immutable content, draft releases with null publication data, safe but
unsupported release tokens, and unsupported npm optional properties fail
closed to the dependent field. Identity/hash/size disagreement, malformed
provider structure, authentication/authorization failure, unsafe redirect,
global transport bounds, required-source unavailability, and internal
invariants remain fatal.

Operator v4 combines the caller signal with an internal first-fatal signal.
Five workers stop assigning new candidates, abort in-flight siblings, await all
settlement, preserve the causal first fatal, and then emit only the bounded safe
diagnostic envelope and final request/attempt counters. Token material,
headers, response bodies, arbitrary provider values, and secret-bearing URLs
are excluded. Pure replay v3 retains the source-only freeze and effect-denial
gates and updates only the registered security/advisory projections. The 18
field denominator, 13-field threshold, 72.222222%, and four breadth groups are
unchanged; planned capability remains 13 and planned full closure becomes five.

## Final successor activation freeze

Independent review accepted ADR 0013's postmortem decisions at
`acca908a98b09e2263252f3bcd861b7c4f9a27ee` without activating a provider
effect. The executable successor is additive: provider contract v2, source
policy v7, live operator v5, authorization v5, and replay algorithm v4.
Proposed authorization v4/operator v4/replay v3 remain inactive historical
artifacts and are never repurposed.

Only the explicit `candidate-authority:successor:*` commands may face future
candidate providers. Preflight and collect require
`--accepted-head <40-hex-sha>`. The supplied SHA must equal local HEAD and the
origin branch, and that HEAD must be exactly one ordinary additive commit with
direct parent `acca908a98b09e2263252f3bcd861b7c4f9a27ee`. The value is an
independent acknowledgement, not a source-controlled self-reference. A
preflight mismatch stops before credential access or cutoff creation.

The production effects adapter has no injected-test or inert fallback. It
uses global `fetch`, fixed accepted hosts, zero redirects, at most three
attempts, bounded bodies and JSON nodes, exact attempt counters, caller plus
first-fatal cancellation, and the real successor collector. It exclusively
owns the v2 source staging/final paths, uses no-replace atomic publication, and
cleans only owned staging. After cutoff creation, provider,
serialization/validation, staging, publication, and cleanup failures receive
distinct safe stages and settled counters; credentials, headers, bodies, and
arbitrary provider values are excluded.

The successor source parser requires 150 ordered catalog identities, the 13
operation rows, final authority bindings, a bounded effect receipt, canonical
candidate and authority digests, canonical bytes, and no raw
credential/header/body fields. Valid non-normal `compose.json` or `Dockerfile`
tree entries are qualified unknown and trigger no blob request. Immutable
identity/hash/size disagreement after an accepted normal blob remains fatal.

The explicit successor replay commands consume only committed source-authority
v2 and produce profile, partial evidence, fit evidence, dossier, and dossier
projection authorities v2, then separately readiness report v2 and root v5.
Replay rejects an untracked source, a non-isolated source commit, a freeze whose
direct parent is not the independently accepted execution head, changed source
bytes, a non-ancestor freeze, or local/origin inequality. The full synthetic
pipeline fixture proves repeat, reverse-candidate, and legal source-record
permutation equality while exercising npm unsupported states, advisory
medium/unknown semantics, local security positive/unknown semantics, release
supported/unsupported states, and deployment positive/unknown states.
Synthetic fixtures are contract evidence only and supply no real-catalog
coverage or readiness evidence.
