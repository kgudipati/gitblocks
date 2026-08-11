# Candidate authority readiness correction

Status: **pre-live GO proposed; independent rereview required**

M3A v1 correctly returned NO-GO under readiness policy v1. Independent review
then separated deterministic extraction from all-candidate closure. This
focused correction preserves that finding while separating planned capability
from realized post-collection readiness, closing partial facts to exact field
semantics, and restoring ADR 0006 bounded Git head resolution. No live M3
source value or coverage existed when these rules were selected.

The additive decision remains proposed
[ADR 0012](decisions/0012-separate-deterministic-extraction-from-full-closure.md).
The successor authorities are:

- readiness policy `ranking-v1-deterministic-readiness-policy/3.0.0`, digest
  `9460725d84404616b045d2039251a4df28a4bd8ca7c7863487cb88c091899c4c`;
- field plan `candidate-authority-field-plan/3.0.0`, digest
  `d054dd81f945aefa9707df5c77be96bfba8f26bb87474bde5bf9c950f9405e1b`;
- source policy `candidate-authority-source-policy/3.0.0`, digest
  `946862b5b9291023f11d3bb7d37bf3d99a84d40d8846a361dba87ebc0b8614bb`;
- partial semantic registry
  `candidate-authority-partial-field-semantics/1.0.0`, digest
  `effb398b80fb84a88b51bb8f0565e05b6e9c665cb11ed4eda41162ff350db016`;
- partial evidence `candidate-authority-partial-field-evidence/2.0.0`, contract
  digest
  `a4432de831ef9e471d271c82effeaf916c30b6614675237c400d9e8486d60351`.

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

| Field                             | Planned | Full-closure candidate | Exact deterministic treatment                                                            | Partial fact code                       | Breadth                   |
| --------------------------------- | ------: | ---------------------: | ---------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------- |
| adoption-unit-type                |     yes |                     no | Exact-version runtime entry point proves one importable package surface                  | `importable-runtime-package-surface`    | capability/adoption       |
| capability-variants-features      |      no |                     no | Human-reviewed structured only                                                           | —                                       | capability/adoption       |
| language-ecosystem                |     yes |                     no | Structured GitHub primary language maps to one controlled repository language            | `repository-primary-language`           | stack/package             |
| package-publication-version       |     yes |                    yes | Phase 8 exact package publication/version or legal repo-only N/A                         | —                                       | stack/package             |
| runtime-package-format            |     yes |                    yes | Phase 8 exact-version package format or legal repo-only N/A                              | —                                       | stack/package             |
| framework-compatibility           |     yes |                     no | Controlled peer dependency proves only a declared framework peer relation                | `declared-framework-peer-relation`      | stack/package             |
| datastore-requirements            |      no |                     no | Client dependency is not a requirement; remains unknown                                  | —                                       | stack/package             |
| package-repository-linkage        |     yes |                    yes | Phase 8 complete mapped linkage or legal repo-only N/A                                   | —                                       | stack/package             |
| required-infrastructure           |      no |                     no | Human-reviewed structured only                                                           | —                                       | infrastructure/deployment |
| optional-infrastructure           |      no |                     no | Human-reviewed structured only                                                           | —                                       | infrastructure/deployment |
| deployment-self-hosting           |     yes |                     no | Exact root self-build Compose service declaration at immutable commit                    | `repository-self-build-compose-service` | infrastructure/deployment |
| operational-complexity-primitives |      no |                     no | Human-reviewed structured only                                                           | —                                       | infrastructure/deployment |
| license-identity                  |     yes |                     no | Recognized non-`NOASSERTION` SPDX value                                                  | `recognized-license-spdx`               | policy/risk               |
| archived-state                    |     yes |                    yes | Phase 8 total archived Boolean at exact mutable snapshot                                 | —                                       | policy/risk               |
| maintenance-activity              |     yes |                    yes | Exact head plus pagination-closed 90-day activity window                                 | —                                       | policy/risk               |
| release-state-recency             |     yes |                     no | One structured non-draft release proves only that release; unclosed latest stays unknown | `published-release`                     | policy/risk               |
| security-advisory-state           |     yes |                     no | Exact package/version advisory proves only that advisory; zero requires closed query     | `applicable-security-advisory`          | policy/risk               |
| security-policy-presence          |     yes |                    yes | Complete community-profile Boolean or controlled absence                                 | —                                       | policy/risk               |

Capability/adoption is represented by `adoption-unit-type`;
infrastructure/deployment by `deployment-self-hosting`; stack/package by six
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
`peerDependencies`; it no longer retains runtime dependencies for datastore
or framework overclaims. Three exact-commit Compose operations retain only the
verified root file identity and self-build service names.

The maximum logical request budget is GitHub 1,660, npm 80, total 1,740. At
three attempts the ceilings are 4,980, 240, and 5,220. These are proposal
bounds, not authority to call a provider.

The future flow remains one bounded live collection → normalized committed
source authority → pure offline profile/partial-evidence/evidence/dossier
projection → realized/full-closure/cell-origin/breadth report. Determinism
replays the same committed source authority byte-identically; it does not
perform a second live collection.

The future root `candidate-authority-root/3.0.0` binds policy, plan, source
policy, partial registry, partial evidence contract, ordered 150 identities,
all authority digests, planned and realized breadth, the three field counts,
seven cell-origin counts, readiness decision, and canonical root digest.

## Effect boundary

The correction preflight reports zero candidate provider/network, credential,
database, Docker, model, filesystem-write, provider-collection,
source-authority, all-candidate projection, and coverage-calculation effects.
ADR 0012 and every v3/v2 successor authority require independent acceptance
before a separately authorized live preflight may inspect credential
availability or call a candidate provider.
