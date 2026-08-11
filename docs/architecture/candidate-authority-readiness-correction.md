# Candidate authority readiness correction

Status: **pre-live GO pending independent acceptance**

This document is the successor to the frozen
[M3A pre-live design](candidate-authority-m3a-prelive.md). M3A v1 correctly
returned NO-GO under readiness policy v1. Independent review then identified
that policy v1 equated deterministic extraction with full all-candidate
closure, which was stronger than the original field-source objective. No live
M3 authority, candidate coverage, provider value, credential, or ranking
output existed when the correction was selected.

The additive decision is
[ADR 0012](decisions/0012-separate-deterministic-extraction-from-full-closure.md).
The proposed authorities are:

- readiness policy `ranking-v1-deterministic-readiness-policy/2.0.0`, digest
  `db8536cd44cc11a8c86458f0d998dbf0daa98487bd3d936a0ba6e4b5385dbf5f`;
- field plan `candidate-authority-field-plan/2.0.0`, digest
  `249d7f33be5039c2418b71ecf02fbaf73d01da0a03f2779fae9091e32536adae`;
- source policy `candidate-authority-source-policy/2.0.0`, digest
  `99ef0fd9631eede0548e3f1a3ae32a1f17be0f9ecb95ef9b29e3a831bf053e50`.

The denominator remains 18. The minimum remains 13/18 = 72.222222%. The
corrected field-source numerator is 14; planned deterministic full closure
remains six.

## Exact field matrix

| Field                             | V2 posture                  | Eligible | Full closure | Exact deterministic fact or treatment                                               | Unresolved remainder                                                       | Breadth                   |
| --------------------------------- | --------------------------- | -------: | -----------: | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------- |
| adoption-unit-type                | deterministic partial path  |      yes |           no | Exact mapped npm publication → `published-installable-package`                      | Other adoption forms and the complete adoption set                         | capability/adoption       |
| capability-variants-features      | human-reviewed structured   |       no |           no | No deterministic rule                                                               | Complete feature vocabulary                                                | capability/adoption       |
| language-ecosystem                | deterministic partial path  |      yes |           no | Exact npm publication → `npm-package-ecosystem`                                     | Implementation and consumer ecosystems                                     | stack/package             |
| package-publication-version       | deterministic complete path |      yes |          yes | Phase 8 exact npm publication/version                                               | None under complete mapped authority or legal catalog-unmapped N/A         | stack/package             |
| runtime-package-format            | deterministic complete path |      yes |          yes | Phase 8 exact npm version format properties                                         | None under complete mapped authority or legal catalog-unmapped N/A         | stack/package             |
| framework-compatibility           | deterministic partial path  |      yes |           no | Exact runtime/peer dependency allowlist → controlled framework and declared range   | Undeclared compatibility and semantic compatibility beyond the declaration | stack/package             |
| datastore-requirements            | deterministic partial path  |      yes |           no | Exact runtime dependency allowlist → controlled datastore client and declared range | Other requirements and whether each declaration is operationally mandatory | stack/package             |
| package-repository-linkage        | deterministic complete path |      yes |          yes | Phase 8 matched/mismatched/complete-undeclared linkage                              | None under complete mapped authority or legal catalog-unmapped N/A         | stack/package             |
| required-infrastructure           | human-reviewed structured   |       no |           no | No deterministic rule                                                               | Complete required-infrastructure set                                       | infrastructure/deployment |
| optional-infrastructure           | human-reviewed structured   |       no |           no | No deterministic rule                                                               | Complete optional-infrastructure set                                       | infrastructure/deployment |
| deployment-self-hosting           | deterministic partial path  |      yes |           no | Exact verified root Compose JSON services map → `compose-service-declaration`       | Self-hosting completeness, suitability, and every other deployment mode    | infrastructure/deployment |
| operational-complexity-primitives | human-reviewed structured   |       no |           no | No deterministic rule                                                               | Process roles, scheduled execution, and persistent storage                 | infrastructure/deployment |
| license-identity                  | deterministic partial path  |      yes |           no | Recognized non-`NOASSERTION` SPDX                                                   | Identity when GitHub cannot recognize a license                            | policy/risk               |
| archived-state                    | deterministic complete path |      yes |          yes | Phase 8 total archived Boolean at mutable snapshot                                  | None after exact identity/Boolean closure                                  | policy/risk               |
| maintenance-activity              | deterministic complete path |      yes |          yes | Exact head plus pagination-closed 90-day count, including zero                      | None after head/window closure                                             | policy/risk               |
| release-state-recency             | deterministic partial path  |      yes |           no | Exact selected non-draft release tag/time; closed empty alone proves no release     | Older/unseen releases when the bounded window is not closed                | policy/risk               |
| security-advisory-state           | deterministic partial path  |      yes |           no | Observed exact-package/version advisory ID/severity; closed query alone proves zero | Unseen advisories and repository-only advisory scope                       | policy/risk               |
| security-policy-presence          | deterministic complete path |      yes |          yes | Complete community-profile Boolean or accepted controlled absence                   | None after normalized closure                                              | policy/risk               |

The capability/adoption breadth path is `adoption-unit-type`. The
infrastructure/deployment path is `deployment-self-hosting`. Stack/package has
six eligible paths; policy/risk has six. All breadth groups therefore pass at
the extraction-path level. No field was selected from observed coverage.

## Positive and negative semantics

The eight partial paths are nontrivial because each can emit an affirmative,
field-bound fact from a controlled structured value:

- package publication proves a published installable package adoption fact;
- npm publication proves a package ecosystem fact;
- exact `dependencies`/`peerDependencies` names and ranges prove controlled
  framework declarations;
- exact runtime dependency names and ranges prove controlled datastore-client
  declarations;
- a recognized SPDX value proves license identity;
- a selected structured release proves that release's tag/time/state;
- an exact matching advisory record proves that advisory ID/severity;
- a verified, parsed, nonempty Compose services map proves a service
  declaration at the exact commit.

Package-mapping absence does not disprove package adoption. Missing
dependencies do not disprove compatibility or requirements. GitHub
`NOASSERTION`, null, or license-path absence does not prove a favorable
license. A release or advisory zero is negative evidence only after source
closure. Missing or unsupported `compose.json` does not disprove self-hosting,
and a present services map does not establish a complete deployment model.

## Partial-field authority and dossier bridge

`candidate-authority-partial-field-evidence/1.0.0` binds the candidate and
field to a versioned rule, controlled fact code/value, polarity, ordinary
evidence provenance, source-authority and source-record digests, originating
evidence IDs, source and field completeness, unresolved remainder, cutoff,
as-of time, stable ID, and canonical digest.

For a complete field, the existing pure bridge remains:

```text
known deterministic profile value
  -> exact field/value/source binding
  -> deterministic EvidenceObservationV1-compatible observation
  -> CandidateDossierV1
```

For a partial field, the profile stays unknown when the complete value contract
cannot be satisfied:

```text
unknown complete profile field
  + field-bound deterministic partial fact
  + exact source/provenance and unresolved remainder
  -> deterministic dossier observation
  + evidence-referenced material unknown
  + field-specific partial limitation
  -> CandidateDossierV1
```

The projector rejects partial negative evidence from an incomplete source,
source/provenance disagreement, rule disagreement, cross-candidate evidence,
duplicate IDs, a missing unresolved remainder, or a partial record over a
profile field that is not still unknown. Observation prose is a fixed
serialization of structured fields. Input permutation produces the same
canonical dossier. CandidateDossierV1 is unchanged as the semantic model.

Mutable `structured-provider-snapshot` provenance adds the closed
`completenessState: "partial"` value. It remains a bounded public GitHub/npm
snapshot with safe source identity/locator, authority and record digests,
cutoff/effective time, and the mandatory `source-is-mutable` limitation.

## Source policy and request ceiling

The eight v1 operations remain bounded at fixed hosts, GET, zero redirects,
15-second timeout, three attempts, 2 MiB, and 100,000 JSON nodes. The npm
operation additionally retains exact-version `dependencies` and
`peerDependencies`; this adds no request. Three additive GitHub operations
verify the one optional root `compose.json` path at the exact head:

| Additive operation | Endpoint shape                                                    | Logical ceiling | Retained properties                                               |
| ------------------ | ----------------------------------------------------------------- | --------------: | ----------------------------------------------------------------- |
| content            | `/repos/{owner}/{repository}/contents/compose.json?ref={headSha}` |             150 | path, SHA, size, encoding, bounded base64 content                 |
| root tree          | `/repositories/{repositoryId}/git/trees/{rootTreeSha}`            |             150 | root SHA and exact path/mode/type/blob SHA; non-recursive only    |
| immutable blob     | `/repositories/{repositoryId}/git/blobs/{composeBlobSha}`         |             150 | SHA, size, encoding, bounded parsed service names, content digest |

The decoded content cap is 256 KiB. Strict UTF-8 JSON is inert data and must
fit the 100,000-node/depth-32 parse limits. Contents, tree, and blob identities
must agree. Only a normal `100644` or `100755` root blob is accepted. No
recursive tree, archive, clone, install, image pull, script, command, or
candidate code executes.

The theoretical budgets are GitHub 1,510, npm 80, total 1,590 logical
requests. At three attempts they are GitHub 4,530, npm 240, total 4,770. These
are proposal ceilings, not authority to call a provider.

Provider authentication/authorization failure, identity mismatch, unsafe
redirect, malformed provider payload, bounds violation, required-source
failure, or tree/content/blob disagreement is fatal. Pre-registered optional
transient failure, unclosed pagination, unsupported structured value, or
optional manifest absence/invalidity yields qualified field unknown. A zero or
404 establishes source absence only where endpoint semantics prove it and
never expands into a field negative. A fatal run stops; no automatic rerun is
authorized.

## Root, reporting, replay, and effect boundary

The future `candidate-authority-root/2.0.0` retains the v1 catalog, taxonomy,
profile, ranking denominator, cutoff, 150 ordered identities, source/profile/
evidence/dossier/projection/report digests, and canonical root bindings. It
additionally binds readiness policy v2 and reports two exact field counts plus
the seven exact cell-origin counts:

- deterministic known;
- deterministic not-applicable;
- deterministic partial/direct evidence;
- human-reviewed structured;
- model-derived;
- unknown;
- conflict.

No average may hide those categories. Human/model cells do not count as
deterministic and unknown is never favorable.

The only future reproducibility flow remains one bounded live collection →
normalized source authority → commit/freeze → pure offline profiles and
partial evidence → evidence → dossiers → separate readiness/full-closure/
cell-origin report. Determinism replays the same committed source authority;
it does not compare two drifting live collections.

The correction preflight reports zero network, candidate-provider, credential,
database, Docker, model, filesystem-write, source-generation, all-candidate
projection, and coverage-calculation effects. Independent acceptance of ADR
0012 and all three v2 authorities is required before a separate live
authorization may inspect a credential or call a provider.
