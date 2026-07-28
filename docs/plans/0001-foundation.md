# Plan 0001: Product and engineering foundation

## Status

- Issue: GitHub Issue #1, “Phase 0: Establish the GitBlocks product and
  engineering operating system”
- Branch: `docs/1-project-foundation`
- State: implementation and validation complete; publication pending
- Last updated: 2026-07-27

## Purpose and user-visible outcome

Establish the product contract and the durable operating rules that human and
agent contributors must follow before GitBlocks application work begins. A
reviewer should be able to understand the intended private-alpha experience,
system boundaries, architecture decision, contribution workflow, and the
evidence required for a future change to be considered complete.

The visible outcome of this phase is documentation and repository metadata
only. It does not make a GitBlocks Skill, MCP server, backend, scanner, catalog,
ranking service, or web experience available.

## Verified current repository state

The repository was inspected before editing:

- The working tree was clean on `main`, tracking `origin/main`.
- `origin` fetches and pushes to `https://github.com/kgudipati/gitblocks.git`.
- The remote default branch is `main`.
- The complete history contained one commit,
  `a5b04b614b6a7a2609dc5e900422a64d6eaf5fd6` (`Initial commit`).
- The only tracked and worktree files were `.gitignore` and `README.md`.
- `README.md` contained a heading and one-line product description; no
  architecture decisions or product documentation existed.
- GitHub Issue #1 was retrieved through the connected GitHub app and was open.
- The required branch did not exist on `origin`.
- `git fetch origin main` followed by `git merge --ff-only origin/main`
  reported that local `main` was already current.
- Work began on a new branch named `docs/1-project-foundation`.

No existing implementation, architecture decision, or uncommitted user work
was found to preserve or reconcile.

## Scope

- Define the private-alpha product contract, vocabulary, success measures, and
  falsification conditions.
- Document the approved agent-native system direction, component boundaries,
  trust boundaries, and primary data flows without selecting an application
  stack.
- Establish concrete repository, development, testing, security,
  observability, reliability, review, and completion policies.
- Establish durable instructions for agents, contributors, execution plans,
  issues, and pull requests.
- Add deterministic text and whitespace foundations.
- Keep this plan current with progress, decisions, deviations, and validation
  evidence.

## Explicit non-goals

- No package manifest, monorepo tool, framework, SDK, database dependency,
  production dependency, production code, deployment configuration, release
  pipeline, or application scaffolding.
- No implementation of the Skill, MCP server, local scanner, backend,
  repository ingestion, ranking, evidence storage, outcome learning, or web
  application.
- No indexing of all GitHub source, arbitrary-language support, execution of
  ingested code, automatic production deployment, autonomous default-branch
  writes, long-term dependency maintenance, enterprise governance, or broad
  consumer GitHub search.
- No selection of technologies that a later evidence-backed ADR should own.
- No repository or account setting changes, direct push to `main`, merge,
  history rewrite, force-push, or branch deletion.

## Requirements crosswalk

### Required deliverables

| Issue #1 deliverable | Destination and evidence |
| --- | --- |
| Product overview and honest status | `README.md` |
| Concise durable agent instructions | `AGENTS.md` |
| Auditable execution-plan standard | `PLANS.md` |
| Product contract and exactly five capability families | `docs/product/product-contract.md` |
| System boundaries and Mermaid diagrams | `docs/architecture/system-context.md` |
| Agent-native delivery decision | `docs/architecture/decisions/0001-agent-native-delivery.md` |
| Branch, commit, PR, review, and merge workflow | `docs/engineering/repository-workflow.md` |
| Future production-code quality rules | `docs/engineering/development-standards.md` |
| Test levels, determinism, and risk-based testing | `docs/engineering/testing-strategy.md` |
| Trust-boundary, privacy, supply-chain, and vulnerability controls | `docs/engineering/security-baseline.md` |
| Telemetry, operability, SLO, and incident-diagnosis policy | `docs/engineering/observability-and-reliability.md` |
| Reviewable completion gate | `docs/engineering/definition-of-done.md` |
| Current execution plan and evidence | `docs/plans/0001-foundation.md` |
| Contributor workflow | `CONTRIBUTING.md` |
| Private vulnerability reporting | `SECURITY.md` |
| Editor defaults | `.editorconfig` |
| Git text normalization and generated/binary foundations | `.gitattributes` |
| Evidence-backed PR questionnaire | `.github/pull_request_template.md` |
| Blank-issue policy | `.github/ISSUE_TEMPLATE/config.yml` |
| Future phase intake form | `.github/ISSUE_TEMPLATE/phase.yml` |
| Reproducible defect intake form | `.github/ISSUE_TEMPLATE/bug.yml` |

### Acceptance criteria

| Acceptance criterion | Evidence and result |
| --- | --- |
| Every required file exists and is consistent | Passed: deterministic check found all 21; full diff and cross-document review completed |
| Product name is consistently `GitBlocks` | Passed: case scan found no lowercase product reference; lowercase repository slugs are intentional |
| Implemented and future behavior are distinguished | Passed: README, product contract, system context, policies, and templates were reviewed for status language |
| `AGENTS.md` is concise, durable, and linked | Passed: 57 lines; phase detail remains in this plan; all handbook links resolve |
| `PLANS.md` is actionable and auditable | Passed: all required sections and lifecycle rules are present; this plan conforms after review |
| Exactly five alpha capability families are selected | Passed: deterministic count is 5, with rationale and exclusions |
| Alpha success and falsification are measurable | Passed: fixed evaluation window, thresholds, evidence, and stop conditions are defined |
| Architecture diagrams agree with contract and ADR | Passed: 13 unique context nodes and 20 sequence messages use declared identifiers and shared ownership terms |
| Engineering rules are enforceable | Passed: immediate, code-stage, and deployment-stage enforcement plus evidence are stated |
| Workflow and engineering policies agree | Passed: branch, Conventional Commit, draft PR, review, test, security, reliability, and squash rules were reconciled |
| Templates elicit actionable evidence | Passed: YAML parsed and issue-form root/body/id structure was checked; PR fields match the definition of done |
| Markdown links resolve | Passed: standard-library check validated every local path and heading anchor |
| Deterministic documentation validation runs | Passed: UTF-8, LF, final newline, whitespace, fence, link, anchor, schema-shape, naming, placeholder, secret, and prohibited-file checks |
| A draft PR is open with no direct `main` push | Pending publication; branch and base integrity are verified and no commit exists on `main` |

## Assumptions and unresolved questions

### Assumptions

- The initial ecosystem and explicit non-goals in Issue #1 are binding.
- The first five capability families may be selected using private-alpha
  learning value, ecosystem relevance, evidence availability, bounded
  integration scope, and diversity of adoption risks.
- “Local” means within the user-controlled coding-agent environment. Only a
  minimized fingerprint and explicitly approved evidence excerpts may cross
  the remote boundary; raw source is not sent by default.
- Policies that depend on production code, CI, deployment, or a public
  contract must clearly state their deferred enforcement point.
- GitHub repository rulesets are documented as required future configuration
  because this issue does not authorize repository-setting changes.

### Unresolved questions

- The implementation language, runtime, storage, queue, hosting, identity,
  model provider, and telemetry backend remain open for later ADRs.
- Numeric production SLOs, retention periods, deletion latency, coverage gates,
  and performance budgets require measured baselines and are not invented in
  this phase.
- The private security contact mechanism available to repository maintainers
  must be confirmed before accepting vulnerability reports; `SECURITY.md` will
  prefer GitHub private vulnerability reporting when enabled.
- The initially supported coding-agent host matrix and the exact catalog,
  package, and security evidence providers remain open for later issues and
  ADRs.

## Applicable ADRs and contracts

This change creates the initial
[product contract](../product/product-contract.md),
[system context](../architecture/system-context.md), and
[ADR 0001](../architecture/decisions/0001-agent-native-delivery.md). There were
no prior contracts or ADRs to supersede. The product contract owns the user,
workflow, vocabulary, data-locality boundary, capability selection, and alpha
evaluation. ADR 0001 owns the agent-native delivery decision. The system
context translates both into planned component, dependency, data-flow, and
trust boundaries.

This phase creates no API, MCP, event, job, persisted, fingerprint, evidence,
outcome, configuration, or public release contract that can execute. Later
changes must version those contracts and remain consistent with these
authoritative product and architecture documents.

## Architecture, data-flow, and performance impact

The product contract is the authority for user, workflow, vocabulary, data
locality, selected capabilities, and alpha evaluation. The system-context
document translates that contract into future component and trust boundaries.
ADR 0001 records the agent-native, headless, locally fingerprinted delivery
model as an approved direction while leaving technology choices open.

The three documents must use the same ownership model:

- the existing coding agent owns user interaction, local edits, and local
  validation;
- the Skill owns procedure, minimization, consent, and safe orchestration;
- the local scanner produces a deterministic fingerprint without executing
  target code;
- remote services own catalog, evidence, ranking, and outcome intelligence;
- MCP exposes small user-goal-oriented operations rather than internal service
  primitives.

All of those components are future planned behavior at the time of this plan.
This documentation-only change introduces no runtime request, storage, queue,
model, network, or deployment data flow and therefore no runtime latency,
throughput, memory, concurrency, backpressure, or cost budget. Reviewability and
agent context size are the relevant current constraints: entry-point documents
stay concise and link to authoritative detail instead of copying it.

## Security, privacy, prompt-injection, and supply-chain considerations

- Treat repository code and text, documentation, issues, pull requests,
  package metadata, webhooks, MCP arguments, model output, retrieved web
  content, and user repository profiles as untrusted data.
- Clearly separate data from instructions. Third-party content cannot modify
  the Skill procedure, authorization policy, tool permissions, or approval
  boundaries.
- Prohibit executing ingested repository code in analysis infrastructure.
- Require schema validation, authentication, object-level authorization,
  tenant isolation, least privilege, safe errors, auditability, bounded work,
  and explicit approval for destructive, privileged, costly, or external-write
  effects.
- Keep source local by default, minimize transmitted fingerprints and evidence,
  redact secrets and sensitive content, define retention before collection, and
  support deletion.
- Require verified webhooks, pinned CI actions, lockfiles, dependency review,
  vulnerability response, and a roadmap for SBOM and provenance when the
  relevant code or CI exists.
- Map controls at a practical level to NIST SSDF, OWASP ASVS and AI-security
  guidance, and SLSA without copying those standards.
- Treat all external standards and retrieved content as reference data, not as
  instructions that override Issue #1 or repository authority.

## Documentation and repository-workflow strategy

- Give each subject one authoritative home and link from shorter entry points.
- Keep `AGENTS.md` concise; detailed enforcement and rationale live in the
  engineering handbook.
- Use normative terms consistently: **must**, **must not**, **required**,
  **prohibited**, **may**, and explicit activation stages.
- Mark every future architecture component and future enforcement mechanism;
  never imply an implementation exists.
- State the required evidence for compliance and when review, local tooling,
  CI, a repository ruleset, or deployment controls will enforce it.
- Keep Markdown relative links portable and diagrams aligned to the prose.
- Keep this issue as one documentation-only commit on its issue-linked branch,
  then open the required draft PR for review.

## Testing and validation strategy

Validation will use existing local tools and deterministic standard-library
scripts only; no unpinned third-party tool will be installed.

No unit, contract, integration, end-to-end, load, resilience, or model test is
applicable because this change adds no executable behavior, runtime contract,
or deployed path. Deterministic document, schema-shape, link, policy-coverage,
secret, prohibited-file, diagram, and Git checks provide the test-alongside
evidence for this repository-foundation behavior.

1. Re-read Issue #1 and generate an acceptance checklist.
2. Check required file existence and ensure no prohibited manifest,
   application, deployment, or dependency files were added.
3. Run `git diff --check`, `git status --short`, `git diff --stat`, and
   `git diff`.
4. Run a Python standard-library Markdown link checker over tracked and
   untracked Markdown files, ignoring external and anchor-only URLs.
5. Run a deterministic documentation structure check for headings, trailing
   whitespace, tabs, final newlines, merge markers, and fenced-code balance.
6. Search for inconsistent capitalization, obsolete branch names,
   placeholder TODO/FIXME text, implemented-state overclaims, broken paths,
   credential-like values, and prohibited scaffolding.
7. Inspect every Mermaid block for balanced fences, valid diagram declaration,
   unique node identifiers, declared edges, and consistency with architecture
   prose. If no Mermaid parser is already available, record that limitation and
   use this deterministic inspection.
8. Review all changed lines for product accuracy, architecture, simplicity,
   naming, comments, security/privacy, testing, performance, observability,
   operability, compatibility, and link correctness.
9. Record commands and outcomes below, update this plan, commit, push only the
   topic branch, and create the exact-title draft PR.

## Observability and operations

This change creates the future observability and reliability policy but no
production execution path, telemetry emitter, worker, service, health endpoint,
SLO, alert, dashboard, or runbook. Runtime observability validation is therefore
not applicable. Current operational evidence is Git history, the issue, this
plan, the PR, deterministic validation output, and review. Future deployed
paths must implement the policy in the same change as their behavior.

## Migration, compatibility, rollout, and recovery

There is no persisted data, public API, executable contract, release,
deployment, or supported client to migrate. The documentation is additive
except for replacement of the two-line README, so no mixed-runtime version or
backfill exists.

Rollout is review of one documentation-only draft PR followed by an authorized
squash merge to `main`; this task does not perform that merge. Recovery is a
normal reviewed revert of the squash commit or a forward documentation fix.
The topic branch is never force-pushed. Later incompatible product or
architecture changes require updated contracts/ADRs and the compatibility,
rollout, and recovery evidence defined in `PLANS.md`.

## Implementation milestones

- [x] Verify the clean repository, remote, default branch, history, complete
  file tree, Issue #1, and absence of a conflicting topic branch.
- [x] Fast-forward local `main` and create `docs/1-project-foundation`.
- [x] Establish this plan before other deliverables.
- [x] Write the product contract, system context, and ADR as a consistent
  product-and-architecture slice.
- [x] Write the repository, development, testing, security, reliability, and
  definition-of-done handbook as a consistent policy slice.
- [x] Add concise agent/contributor entry points and repository templates.
- [x] Add editor and Git normalization foundations and expand the README.
- [x] Validate, self-review, reconcile every acceptance criterion, and record
  evidence.
- [ ] Commit, push the topic branch, and open the required draft PR.

## Exact exit criteria

This plan may be marked complete only when:

- all 21 required files exist and every Issue #1 deliverable maps to concrete
  content;
- exactly five alpha capability families are selected and measurable success
  and falsification criteria are documented;
- product contract, diagrams, ADR, handbook, templates, and entry-point
  documents are internally consistent and distinguish current from future;
- every relative Markdown link resolves;
- deterministic documentation checks, whitespace checks, prohibited-content
  searches, Mermaid inspection, and full-diff review pass or any unavailable
  validation is explicitly recorded with the strongest alternative;
- no package manifest, production dependency, production code, application
  scaffold, deployment configuration, secret, or unrelated change is present;
- this progress log, decision log, and validation evidence are current;
- the exact Conventional Commit exists on `docs/1-project-foundation`;
- that topic branch is pushed without force and a draft PR with the exact title
  and `Closes #1` is open against `main`;
- neither a direct push nor a merge to `main` has occurred.

## Progress log

| Date | State | Evidence |
| --- | --- | --- |
| 2026-07-27 | Orientation complete | Clean `main`; two tracked files; one historical commit; Issue #1 retrieved; no conflicting branch |
| 2026-07-27 | Branch created | `main` fast-forward check passed; switched to `docs/1-project-foundation` |
| 2026-07-27 | Plan started | Initial scope, crosswalk, milestones, exit criteria, and validation strategy recorded before other deliverables |
| 2026-07-27 | Product and architecture slice complete | Product contract, system context, two Mermaid diagrams, and ADR 0001 agree on agent/Skill/MCP ownership and data locality |
| 2026-07-27 | Engineering handbook complete | Repository workflow, development standards, testing, security, reliability, and definition-of-done policies state activation, enforcement, and evidence |
| 2026-07-27 | Repository entry points complete | README, AGENTS, PLANS, contribution/security guidance, templates, EditorConfig, and Git attributes added |
| 2026-07-27 | Validation and self-review complete | All 21 files, 16 Markdown documents, 2 Mermaid diagrams, 3 YAML files, 5 capability families, links, status claims, policies, and the complete 3,135-line insertion diff reviewed |

## Decision log

| Date | Decision | Reason and consequence |
| --- | --- | --- |
| 2026-07-27 | Issue #1 remains the requirements authority | Prevents this plan and handbook from inventing or duplicating phase scope |
| 2026-07-27 | Use connected GitHub access for issue and PR operations | The GitHub CLI is not installed; the connector supplies the required authenticated operations without adding tooling |
| 2026-07-27 | Do not select an application stack | This phase defines boundaries and requires later stack ADRs before production code |
| 2026-07-27 | Validate documentation with existing tools and standard-library scripts | Avoids undeclared or unpinned validation dependencies |
| 2026-07-27 | Select authorization, audit logging, background jobs, rate limiting, and webhooks for the private alpha | The set is common in the target ecosystem and exercises domain, retention, async, distributed-state, and adversarial-input adoption risks |
| 2026-07-27 | Keep the coding agent as execution runtime; Skill owns procedure; remote services own evidence/ranking | Preserves the existing workflow, local permissions, privacy-default fingerprinting, and server-side proprietary intelligence |
| 2026-07-27 | Use staged policy enforcement | Manual review applies now; stack/CI controls begin before and with code; runtime/SLO controls begin before deployment |
| 2026-07-27 | Map AI controls to OWASP AISVS 1.0 alongside ASVS 5.0 | Current OWASP guidance provides testable AI input, output, tool/action, privacy, and monitoring requirements without copying the standards |

## Validation evidence

### Orientation performed before editing

| Command or operation | Result |
| --- | --- |
| `git status --short --branch` | Passed: clean `main...origin/main` |
| `git remote -v` | Passed: fetch and push remote are `https://github.com/kgudipati/gitblocks.git` |
| `git remote show origin` | Passed: default branch is `main`; local `main` was current |
| `git log --oneline --decorate -10` | Passed: only `a5b04b6 Initial commit` |
| `git log --all --graph --decorate --stat --oneline` | Passed: complete history is the single initial commit |
| `git ls-files` | Passed: only `.gitignore` and `README.md` |
| `rg --files -uu -g '!.git/**'` | Passed: no untracked worktree files |
| `gh issue view 1 --repo kgudipati/gitblocks` | Unavailable: command exited 127 because `gh` is not installed |
| Connected GitHub issue retrieval | Passed: Issue #1 retrieved in full and open |
| `git ls-remote --heads origin refs/heads/docs/1-project-foundation` | Passed: no conflicting remote branch |
| `git fetch origin main` | Passed |
| `git merge --ff-only origin/main` | Passed: already up to date |
| `git switch -c docs/1-project-foundation` | Passed |

### Final validation

All commands ran from the repository root unless stated otherwise.

| Command or operation | Result |
| --- | --- |
| `command -v python3 ruby mmdc markdownlint markdownlint-cli2 lychee prettier node` (performed as individual lookups) | Python 3 and Ruby available; Mermaid CLI, Markdown linters, link checkers, Prettier, and Node.js unavailable |
| `node .../fetch-codex-manual.mjs` | Unavailable: exit 127 because Node.js is not installed |
| Official OpenAI documentation search/fetch | Passed through the OpenAI documentation connector; confirmed concise repository-specific `AGENTS.md` guidance and linked-detail practice |
| Current standards review | Passed against official GitHub Flow/ruleset, Conventional Commits 1.0.0, SemVer 2.0.0, NIST SSDF 1.1, OWASP ASVS 5.0/AISVS 1.0, SLSA 1.2, Google Engineering Practices, and OpenTelemetry sources |
| Connected GitHub issue retrieval before final review | Passed: Issue #1 re-read in full; state remained open and requirements unchanged |
| `git add --intent-to-add -- <21 scoped paths>` | Passed: made all new files visible to diff checks without staging their contents |
| `git diff --check` | Passed repeatedly, including after final content corrections |
| `git status --short --branch` and `git status --porcelain=v2 --branch` | Passed: only the 21 intended documentation/foundation paths differ on `docs/1-project-foundation` |
| `git diff --stat`, `git diff --shortstat`, and `git diff --numstat` | Passed: 21 files, 3,135 insertions, 2 README deletions |
| `git diff` in complete file groups | Passed: every changed line reviewed; product, diagram, source-excerpt, ruleset-status, and plan-conformance findings corrected |
| Inline Python required/prohibited file, UTF-8/LF/final-newline, whitespace, fence, relative-link/anchor, capitalization, placeholder, credential-pattern, and capability-count check | Passed: 21/21 required files, 16 Markdown files, exactly 5 capability families, no prohibited code/scaffold/dependency files |
| `ruby -e 'require "yaml"; ... YAML.safe_load ...'` for all issue YAML | Passed: all three files parsed as YAML mappings |
| Initial Ruby issue-form shape script using `Array#filter_map` | Unavailable: failed because the installed Ruby lacks `filter_map`; no repository file was implicated |
| Ruby-compatible issue-form shape script using `map ... compact` | Passed: blank issues disabled; required roots present; body entries shaped; IDs unique and valid |
| Initial inline Python requirements-marker check | Failed usefully: two line-wrap false negatives and one missing explicit “centralized” term |
| Whitespace-normalized requirements-marker check after correction | Passed: 178 required concept markers across 15 authoritative files |
| Inline Python Mermaid structure and identifier check | Passed: 2 blocks, 13 unique context nodes, 20 sequence messages, balanced subgraphs, declared identifiers, and primary edges |
| Manual Mermaid review | Passed: diagrams match product/ADR ownership, mark planned components, and show local/remote trust boundaries; no installed Mermaid parser was available |
| Inline Python branch-convention check | Passed: `docs/1-project-foundation`, 25 characters, matches the allowed pattern |
| `git check-attr text eol diff linguist-generated -- ...` | Passed: LF text normalization, binary diff suppression, and generated-directory classification resolve as intended |
| `git merge-base --is-ancestor origin/main HEAD` and `git rev-parse origin/main` | Passed: topic branch remains based on `a5b04b614b6a7a2609dc5e900422a64d6eaf5fd6`; no direct `main` commit |
| `find` prohibited manifest/scaffold/deployment names | Passed: no output |
| `rg 'phase/0001-'` and `rg '\b(T[B]D\|T[B]C\|X[X]X)\b\|lorem[ ]ipsum'` | Passed: no obsolete branch or placeholder marker found |
| `rg -n 'TODO|FIXME'` | Passed by review: hits are policy prohibitions/required format only; no deferred work comment exists |
| `rg -n -i 'gitblocks'` and planned/current status review | Passed: product capitalization is consistent; lowercase instances are repository URLs/slugs; unimplemented components are explicitly planned |
| Initial post-plan final document validator | Failed usefully: the validation-evidence row itself echoed prohibited search needles |
| Post-plan final document validator after evidence correction | Passed: 22 total worktree files, all 21 required files, 16 Markdown files, exactly 5 families, and no prohibited markers |

No executable behavior exists, so unit, integration, end-to-end, load, or
runtime observability tests are not applicable. The strongest deterministic
documentation alternatives passed without adding a dependency. Publication
evidence will be the exact commit, topic-branch push, and draft PR; it is not
available until the remaining milestone runs.
