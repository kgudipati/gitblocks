# Candidate authority M3A pre-live design

Status: **frozen for independent review; pre-live NO-GO**

This is the internal Milestone 3A source/rule freeze for Issue #32. It does not
create a project milestone, authorize a provider or credential effect, generate
an all-150 authority, measure candidate coverage, or authorize Milestone 4. The
accepted M3 → M4 sequence and Ranking V1 authorities remain unchanged.

The field plan is
`catalog/public-v1/candidate-authority-field-plan.json`, version
`candidate-authority-field-plan/1.0.0`, digest
`ac643d102cb7e20a711b5c0a59508608e30ad7d0f1b7446d345237c53289607a`.
The source policy is
`catalog/public-v1/candidate-authority-source-policy.json`, version
`candidate-authority-source-policy/1.0.0`, digest
`b0f22107190995b64f81851f8d88b8da6539643868ee93ba9977b262b0bc3699`.
Neither contains provider-derived candidate values.

## Frozen gate and decision

The denominator remains 18 fields. Readiness remains 13/18 (72.222222%) plus
one deterministic-ready field in each accepted breadth group. No denominator,
threshold, qualification, breadth membership, or favorable-unknown rule
changed.

Only six fields have a defensible deterministic closure plan:
`package-publication-version`, `runtime-package-format`,
`package-repository-linkage`, `archived-state`, `maintenance-activity`, and
`security-policy-presence`. Capability/adoption has no eligible field because
neither architecture type nor a complete feature set has a universal complete
machine authority. Infrastructure/deployment has no eligible field because
manifest/path presence can prove positives but absence cannot close required,
optional, deployment, or operational semantics. M3A is therefore **NO-GO**.

## Exact 18-field matrix

| Field                             | Posture                        | Rule/source and closure                                                                                              | Ready | Breadth                   |
| --------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ----: | ------------------------- |
| adoption-unit-type                | human-reviewed-structured-only | Reviewed taxonomy assignment; machine declarations are positive-only                                                 |    no | capability/adoption       |
| capability-variants-features      | human-reviewed-structured-only | Reviewed taxonomy assignment; prose/topics cannot close a feature set                                                |    no | capability/adoption       |
| language-ecosystem                | deterministic-partial-only     | Repository/package metadata establishes positives, not all ecosystems                                                |    no | stack/package             |
| package-publication-version       | deterministic-ready-candidate  | Phase 8 exact npm latest version; mapped failures unknown, catalog-unmapped legal N/A                                |   yes | stack/package             |
| runtime-package-format            | deterministic-ready-candidate  | Phase 8 exact npm version; optional property omission known, unsupported/failure unknown, catalog-unmapped legal N/A |   yes | stack/package             |
| framework-compatibility           | deterministic-partial-only     | Immutable dependencies establish positives, not complete compatibility                                               |    no | stack/package             |
| datastore-requirements            | deterministic-partial-only     | Manifests establish positives, not complete runtime requirements                                                     |    no | stack/package             |
| package-repository-linkage        | deterministic-ready-candidate  | Complete npm declaration maps matched/mismatched/undeclared; catalog-unmapped legal N/A                              |   yes | stack/package             |
| required-infrastructure           | human-reviewed-structured-only | Manifest/path absence cannot prove an empty complete set                                                             |    no | infrastructure/deployment |
| optional-infrastructure           | human-reviewed-structured-only | Optional integrations cannot be closed by omission                                                                   |    no | infrastructure/deployment |
| deployment-self-hosting           | human-reviewed-structured-only | Deployment-file presence is positive-only                                                                            |    no | infrastructure/deployment |
| operational-complexity-primitives | human-reviewed-structured-only | Paths/manifests cannot close process, scheduling, and storage semantics                                              |    no | infrastructure/deployment |
| license-identity                  | deterministic-partial-only     | Recognized SPDX closes positive; null/NOASSERTION/absence unknown                                                    |    no | policy/risk               |
| archived-state                    | deterministic-ready-candidate  | Complete repository Boolean closes true/false at snapshot                                                            |   yes | policy/risk               |
| maintenance-activity              | deterministic-ready-candidate  | Immutable head plus closed 90-day commit summary; complete empty is zero                                             |   yes | policy/risk               |
| release-state-recency             | deterministic-partial-only     | Additive bounded window; complete empty is nullable no-release, unresolved window unknown                            |    no | policy/risk               |
| security-advisory-state           | deterministic-partial-only     | Additive complete mapped-package rule; complete zero known, repo-only cannot use N/A                                 |    no | policy/risk               |
| security-policy-presence          | deterministic-ready-candidate  | Additive community-profile successor; total Boolean or accepted complete absence closes true/false                   |   yes | policy/risk               |

No field is `not-responsibly-extractable-in-v1`; six complete-set fields are
`human-reviewed-structured-only`. Reviewed values may later be accepted as
structured authority, but the M2 policy excludes them from the deterministic
numerator.

## Eight inherited-field completeness audit

### package-publication-version

- Operation/properties: npm package metadata; exact `name`,
  `dist-tags.latest`, `versions[latest]`, and `time[latest]`.
- Scope/positive: resolved exact semantic version and publish time.
- Absence/unknown/N/A: mapped absence, mismatch, missing latest/time, or
  malformed metadata is unknown; 70 catalog repo-only candidates use the legal
  N/A field state.
- Representation/closure/decision: value does not encode package absence, but
  N/A is correctly used. Source closes mapped packages. Reuse unchanged.

### runtime-package-format

- Operation/properties: the same complete exact npm version; `engines.node`,
  `type`, and `exports` declaration.
- Semantics: supported values are known; missing optional properties are known
  null/`unspecified`; unsupported values and source failures are unknown;
  catalog-unmapped is correctly N/A.
- Representation/closure/decision: nullable/`unspecified` values represent
  legitimate property omission and the source closes mapped packages. Reuse.

### license-identity

- Operation/properties: GitHub license at default-branch head; SPDX and exact
  repository/head identity.
- Semantics: only recognized non-null, non-`NOASSERTION` SPDX is known. Null,
  `NOASSERTION`, endpoint absence, unsupported value, or temporary failure is
  unknown and never favorable.
- Representation/closure/decision: value has no legitimate no-license variant,
  so the source cannot close all candidates. Reuse the sound positive rule;
  partial-only, no absence successor.

### archived-state

- Operation/properties: GitHub repository metadata exact identity and
  `archived` Boolean.
- Semantics: true and false are complete at the mutable snapshot; identity
  failure is fatal and unavailability cannot become negative.
- Representation/closure/decision: Boolean closes all resolved public catalog
  repositories. Reuse unchanged with explicit snapshot freshness.

### release-state-recency

- Operation/properties: Phase 8 retained the first five releases with tag,
  publish time, draft, and prerelease.
- Semantics: newest retained non-draft exact tag is positive. A closed empty or
  only-excluded set is the known nullable no-release value. Full unresolved
  window, unsupported tag, or temporary failure is unknown.
- Representation/closure/decision: the type already supports three nulls, but
  Phase 8 returned unknown for complete empty. Add M3 rule 2.0.0 without
  changing history. Bounded pagination cannot close every repository, so
  partial-only.

### security-advisory-state

- Operation/properties: GitHub advisories for exact npm package/version, at
  most two 100-record pages; GHSA ID, severity, completeness, and limitation.
- Semantics: complete results establish exact count/severity; complete zero is
  `{count:0, highestSeverity:null}`. Partial pagination, mismatch, unsupported
  value, or temporary failure is unknown.
- Representation/closure/decision: Phase 8 incorrectly required at least one
  advisory even though zero is representable. Add M3 rule 2.0.0. Repo-only
  candidates cannot use N/A, so package authority cannot close all candidates;
  partial-only.

### security-policy-presence

- Operation/properties: GitHub community profile normalized
  `security_policy` Boolean.
- Semantics: successful true/false and the accepted provider policy's complete
  controlled absence establish presence/absence; temporary failure is unknown.
- Representation/closure/decision: Boolean represents absence, but Phase 8
  treated established absence as unknown. Add a future M3 successor mapping
  only complete absence to false. Source can theoretically close all repos.

### package-repository-linkage

- Operation/properties: complete npm package repository declaration plus
  catalog repository identity.
- Semantics: equality `matched`, disagreement `mismatched`, complete omission
  `undeclared`; incomplete/missing authority unknown; catalog-unmapped N/A.
- Representation/closure/decision: `undeclared` represents legitimate absence;
  Phase 8 uses it and N/A correctly. Reuse unchanged.

Historical Phase 8 authorities and rules remain unchanged. Demonstrated
defects receive additive future M3 successor rules only.

## Bounded provider plan

Every operation uses a fixed approved host, GET, 2 MiB/100,000-node response
bounds, 15-second timeout, three attempts, and zero redirects. Authentication,
if separately authorized later, is injected and never retained. M3A reads no
credential.

| Operation                   | Logical ceiling | Retained authority                          | Failure/absence                                               |
| --------------------------- | --------------: | ------------------------------------------- | ------------------------------------------------------------- |
| GitHub repository metadata  |             150 | identity, archived, default branch          | identity/unavailability fatal                                 |
| GitHub default-branch head  |             150 | SHA and commit dates only                   | identity/unavailability fatal                                 |
| GitHub closed 90-day window |             150 | head/window/count/pagination closure        | complete empty zero; transient/unclosed unknown               |
| GitHub license              |             150 | SPDX/head/identity                          | complete non-detection remains license unknown                |
| GitHub community profile    |             150 | security-policy Boolean                     | accepted absence false; transient unknown                     |
| GitHub five-release window  |             150 | tag/time/draft/prerelease                   | closed empty no-release; unresolved/transient unknown         |
| GitHub advisories           |             160 | package/version, ID, severity, completeness | complete zero zero; partial/transient unknown; mismatch fatal |
| npm package metadata        |              80 | exact retained package properties           | mapped identity/absence/unavailability fatal                  |

Budgets: GitHub 1,060, npm 80, total 1,140 logical requests; at three attempts,
GitHub 3,180, npm 240, total 3,420. These ceilings are not authorization.

Authentication/authorization failure, identity mismatch, unsafe redirect,
malformed payload, body/node bound violation, and required-source failure are
fatal. A transient optional failure becomes qualified unknown only where
registered. Zero/404 is absence only under pre-registered completeness.
Fatal eventual runs stop without automatic rerun; rerun requires independent
diagnosis and authorization.

Mutable authority retains collection/effective times, canonical source
identity, authority/record digests, completeness, and `source-is-mutable`.
Immutable evidence binds exact commit, release, package version, or advisory.
Replay uses committed cutoff, never ambient time.

## Provenance, evidence bridge, root, and replay

The prior provenance union could not honestly identify mutable structured
provider facts. M3A adds closed `structured-provider-snapshot` provenance with
controlled GitHub/npm provider and source-class enums, safe locator, canonical
identity, authority/record digests, collection/effective time, completeness,
and mandatory mutable limitation. It is not documentation and contains no raw
body, credential, header, temporary URL, or arbitrary JSON.
It is exposed through an additive candidate-authority observation branch on
the existing dossier/fit-assessment semantics; legacy `EvidenceObservationV1`
remains unchanged. The PostgreSQL adapter rejects this branch before database
I/O because M3A authorizes no migration and committed-file replay needs none.

The pure `projectCandidateAuthorityDossier` verifies each known field's value
digest and frozen provenance/topic/dimension, creates stable evidence and
field→evidence bindings, preserves freshness/limitations, and parses ordinary
`CandidateDossierV1`. Unknown/conflict fields create bounded material unknowns
without evidence or negative claims. Legal N/A creates neither. Evidence is
candidate-local and uniquely identified; input permutation reproduces the same
canonical dossier.

The eventual `candidate-authority-root/1.0.0` binds catalog/taxonomy,
profile-denominator/rules, ranking denominator/readiness digest, field
plan/source policy, cutoff, 150 ordered identities, source/profile/evidence/
dossier/projection/coverage digests, qualification counts, and canonical root
digest. It requires one parsed dossier per identity, family closure,
candidate-local unique evidence, and no database identity.

The only permitted future flow is one bounded live collection → normalized
source authority → commit/freeze → pure offline profiles → evidence → dossiers
→ coverage/readiness. Determinism replays the same committed source authority;
two drifting live calls are not determinism evidence.

`pnpm candidate-authority:preflight` reads only committed plan/policy and
reports zero network, credential, database, Docker, model, write, collection,
source-generation, all-candidate projection, and coverage effects. It does not
inspect credentials.

The NO-GO can change only after independent architecture review supplies at
least seven more scientifically complete fields, including one in each missing
breadth group, without changing the frozen gate. Review must precede every
credential/provider effect and all-150 projection. Until then live collection
is prohibited.
