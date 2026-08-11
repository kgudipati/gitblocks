# Candidate authority readiness correction

Status: **accepted pre-live architecture and source/rule authority; live
collection remains separately unauthorized**

M3A v1 correctly returned NO-GO under readiness policy v1. Independent review
then separated deterministic extraction from all-candidate closure. The v3
correction preserved that finding while separating planned capability
from realized post-collection readiness, closing partial facts to exact field
semantics, and restoring ADR 0006 bounded Git head resolution. The final source
hardening adds a second narrow immutable source for the existing
`deployment-self-hosting` path without adding a field or changing readiness
semantics. No live M3 source value or coverage existed when these rules were
selected.

The additive decision is accepted as pre-live architecture authority in
[ADR 0012](decisions/0012-separate-deterministic-extraction-from-full-closure.md).
The successor authorities are:

- readiness policy `ranking-v1-deterministic-readiness-policy/3.0.0`, digest
  `f0095da4e9932cf93ce5cde6fecea1a2480aeb7b055d4b5917420303d8575752`;
- field plan `candidate-authority-field-plan/4.0.0`, digest
  `84796407204bdb7f08efd053b71afc169312e22af2f104fca23d7e8581cb5997`;
- source policy `candidate-authority-source-policy/4.0.0`, digest
  `5b4fe3b3752679ed1302ce242ededf41b59ea54d01a7f020dad3027635208793`;
- partial semantic registry
  `candidate-authority-partial-field-semantics/2.0.0`, digest
  `baf99884171e6407dcfe173ff6ab80b5d30719d5cd1babd5aa310ef44ef9243e`;
- partial evidence `candidate-authority-partial-field-evidence/3.0.0`, contract
  digest
  `6020d9ec109e73242cf110aad468beca29b3aed79838f419c5e23d0f714b4e8e`.

The denominator remains 18 and the post-collection minimum remains 13/18 =
72.222222%. Thirteen fields are planned-capable, zero realized fields have been
measured, and six remain planned full-closure candidates.

## Three measures and failure behavior

Planned capability is a pre-live semantic property of a frozen bounded rule.
It permits one future test of the architecture. Realized readiness is measured
only from the committed all-150 authority and counts a frozen field only when
at least one meaningful deterministic non-N/A established value or
registry-valid partial fact exists. Full closure requires every applicable
candidate known or legally deterministic-N/A and remains separate.

Pre-live breadth uses planned paths. Final breadth uses realized fields. The
future one-shot run returns NO-GO when realized fields are below 13 or any
breadth group is empty. It does not tune rules, add fields, or rerun merely to
improve readiness.

## Exact field matrix

| Field                             | Planned | Full-closure candidate | Exact deterministic treatment                                                            | Partial fact code                                                                 | Breadth                   |
| --------------------------------- | ------: | ---------------------: | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------- |
| adoption-unit-type                |     yes |                     no | Exact-version runtime entry point proves one importable package surface                  | `importable-runtime-package-surface`                                              | capability/adoption       |
| capability-variants-features      |      no |                     no | Human-reviewed structured only                                                           | —                                                                                 | capability/adoption       |
| language-ecosystem                |     yes |                     no | Structured GitHub primary language maps to one controlled repository language            | `repository-primary-language`                                                     | stack/package             |
| package-publication-version       |     yes |                    yes | Phase 8 exact package publication/version or legal repo-only N/A                         | —                                                                                 | stack/package             |
| runtime-package-format            |     yes |                    yes | Phase 8 exact-version package format or legal repo-only N/A                              | —                                                                                 | stack/package             |
| framework-compatibility           |     yes |                     no | Controlled peer dependency proves only a declared framework peer relation                | `declared-framework-peer-relation`                                                | stack/package             |
| datastore-requirements            |      no |                     no | Client dependency is not a requirement; remains unknown                                  | —                                                                                 | stack/package             |
| package-repository-linkage        |     yes |                    yes | Phase 8 complete mapped linkage or legal repo-only N/A                                   | —                                                                                 | stack/package             |
| required-infrastructure           |      no |                     no | Human-reviewed structured only                                                           | —                                                                                 | infrastructure/deployment |
| optional-infrastructure           |      no |                     no | Human-reviewed structured only                                                           | —                                                                                 | infrastructure/deployment |
| deployment-self-hosting           |     yes |                     no | Exact root self-build Compose service or root Dockerfile build declaration at commit     | `repository-self-build-compose-service`; `repository-container-build-declaration` | infrastructure/deployment |
| operational-complexity-primitives |      no |                     no | Human-reviewed structured only                                                           | —                                                                                 | infrastructure/deployment |
| license-identity                  |     yes |                     no | Recognized non-`NOASSERTION` SPDX value                                                  | `recognized-license-spdx`                                                         | policy/risk               |
| archived-state                    |     yes |                    yes | Phase 8 total archived Boolean at exact mutable snapshot                                 | —                                                                                 | policy/risk               |
| maintenance-activity              |     yes |                    yes | Exact head plus pagination-closed 90-day activity window                                 | —                                                                                 | policy/risk               |
| release-state-recency             |     yes |                     no | One structured non-draft release proves only that release; unclosed latest stays unknown | `published-release`                                                               | policy/risk               |
| security-advisory-state           |     yes |                     no | Exact package/version advisory proves only that advisory; zero requires closed query     | `applicable-security-advisory`                                                    | policy/risk               |
| security-policy-presence          |     yes |                    yes | Complete community-profile Boolean or controlled absence                                 | —                                                                                 | policy/risk               |

Capability/adoption is represented by `adoption-unit-type`;
infrastructure/deployment by `deployment-self-hosting`; stack/package by five
paths; and policy/risk by six paths. This is a planned breadth result only.

## Closed partial facts

Each registry definition fixes fact code → field → rule → provenance →
affirmative polarity → value grammar. Construction and dossier projection both
reject cross-field or cross-rule use, unsupported provenance, malformed
values, every current negative, stable-ID/digest forgery, and partial evidence
over a profile field that is not unresolved. The exact permitted claims and
prohibited overclaims are committed with each canonical definition digest.

Complete fields continue through known profile → field-bound evidence →
`CandidateDossierV1`. Partial fields retain an unknown complete profile plus a
registered affirmative fact, exact source/provenance, unresolved remainder,
evidence-referenced material unknown, and field limitation. Unmentioned facts
never imply absence.

## Source policy and replay

The Git head sequence is the accepted bounded ADR 0006 sequence: exact default
branch Git ref followed by exact Git commit object. Each response is limited to
256 KiB, 10,000 nodes, 10 seconds, three attempts, and zero redirects. The
expansive `/commits/{defaultBranch}` representation is prohibited.

The npm operation retains exact-version `exports`, `main`, `module`, and
`peerDependencies`; it does not retain runtime dependencies for datastore or
framework overclaims. The exact-path `compose.json` probe remains an optional
positive source and is not described as Docker Compose's normal default path.
The already fetched root tree may also identify one exact root `Dockerfile`.
Only then may the collector retrieve its immutable Git blob, verify the tree
entry/blob/object identities and strict bounded text, and run the conservative
non-executing `FROM`-prefix parser. A missing or unsupported Dockerfile produces
unknown, never a negative deployment claim.

The maximum logical request budget is GitHub 1,810, npm 80, total 1,890. At
three attempts the ceilings are 5,430, 240, and 5,670. These are worst-case
bounds, not authority to call a provider. The additional 150 GitHub requests
are conditional immutable blob reads; there is no second tree fetch or
Contents probe.

The future flow remains one bounded live collection → normalized committed
source authority → pure offline profile/partial-evidence/evidence/dossier
projection → realized/full-closure/cell-origin/breadth report. Determinism
replays the same committed source authority byte-identically; it does not
perform a second live collection.

The future root `candidate-authority-root/4.0.0` binds policy, plan, source
policy, partial registry, partial evidence contract, ordered 150 identities,
all authority digests, planned and realized breadth, the three field counts,
seven cell-origin counts, readiness decision, and canonical root digest.

## Effect boundary

The correction preflight reports zero candidate provider/network, credential,
database, Docker, model, filesystem-write, provider-collection,
source-authority, all-candidate projection, and coverage-calculation effects.
ADR 0012 and the v3/v4/v2/v3 successor authorities are accepted for pre-live
architecture and source/rule use only. A separate explicit live-collection
authorization is required before a successful zero-effect preflight may be
followed by credential availability inspection or a candidate-provider call.

The final focused verifier passes eight files and 112 tests, both relevant
typechecks, contract conformance, and architecture analysis with zero
violations across 922 modules and 3,163 dependencies. The repository-wide
suite passes 143 test files, 355 suites, and 2,025 tests. Secret scanning and
the registry-backed audit pass with no known vulnerabilities. The first full
source-hardening pass exposed six static typing/style findings; their
mechanical correction changed no authority rule, digest, count, or budget.
