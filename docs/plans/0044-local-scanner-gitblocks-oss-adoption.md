# Recovery R7 local scanner and GitBlocks OSS adoption Skill

## Status and authority

- Governing issue: [#44 — Recovery R7: Add local scanner and GitBlocks OSS adoption Skill](https://github.com/kgudipati/gitblocks/issues/44)
- Branch: `feat/44-gitblocks-oss-adoption`
- Owner: GitBlocks maintainers
- State: implementation complete; draft PR open and unmerged
- Last updated: 2026-08-12
- Authority order: Issue #44 and the product contract govern scope; accepted
  ADRs govern durable boundaries; repository engineering policy governs
  implementation and validation; this plan records execution evidence.

Draft PR [#45 — feat: add local GitBlocks OSS adoption workflow](https://github.com/kgudipati/gitblocks/pull/45)
is open and intentionally unmerged. Recovery R8 is not authorized.

## Purpose and user-visible outcome

Current main implements the hosted recommendation brain but no user-machine
workflow. R7 makes this supported local development journey executable:

```text
developer capability intent
  -> GitBlocks Skill procedure
  -> bounded local scanner
  -> valid minimized RepositoryFingerprintV1
  -> explicit preview and approval
  -> valid OssRecommendationRequestV1
  -> existing recommend_oss MCP tool
  -> existing GitBlocks-owned responsible result
  -> user selection before local edits
```

The nearest realistic exercise uses a temporary TypeScript/Node target, the
bundled scanner, the authoritative contracts, the existing official MCP client
path, a controlled fit model, and temporary PostgreSQL evidence. The Skill also
defines post-selection adoption and target-project validation, but R7 does not
modify an unrelated real project.

## Verified current repository state

- Clean `main`, `HEAD`, `main`, and `origin/main` were all verified at
  `b9c84514bb32d444568c995e8f3cea60ef75811a` before branch creation.
- PR #43 is merged at that commit and Issue #42 is closed as completed.
- Phase 10 PR #33 is closed/unmerged; Issue #32 is closed/not-planned; local
  and remote `feat/32-codebase-conditioned-ranking` refs remain present.
- Issue #44 was created after confirming no issue with the same title existed.
- `pnpm runtime:check` passed before branch creation. The first
  `pnpm repo:branch` invocation omitted the required branch argument and exited
  2 with usage text; `pnpm repo:branch feat/44-gitblocks-oss-adoption` then
  passed.
- Current contracts already define `RepositoryFingerprintV1`,
  `CapabilityQueryInputV1`, `OssRecommendationRequestV1`, required approval
  categories, centralized parsing/domain validation, and
  `repositoryFingerprintDigestV1(...)`.
- The authoritative digest parses the fingerprint, sorts facts by `factId`,
  sorts coded code-set values and withheld categories, then hashes canonical
  JSON with SHA-256.
- The hosted application already validates the exact fingerprint reference,
  preserves required/preferred/prohibited intent, retrieves no more than five
  finalists, validates target-fit output, and returns no more than three
  responsible options.
- The MCP server already exposes exactly `recommend_oss` using the
  authoritative request schema. The official-client PostgreSQL integration
  test is the smallest existing realistic cross-layer harness.
- Current official OpenAI Codex guidance was refreshed on 2026-08-12. It
  confirms required `SKILL.md` name/description frontmatter, optional
  `scripts/`, repository discovery under `.agents/skills`, user discovery
  under `$HOME/.agents/skills`, symlink support, concise trigger descriptions,
  and plugin packaging for broader distribution. `agents/openai.yaml` remains
  optional and has no R7 blocker to solve.

Evidence inspected before this plan includes `AGENTS.md`, `PLANS.md`, the
product contract, system context, security baseline, testing strategy,
development standards, repository workflow, definition of done,
observability policy, ADRs 0001/0002/0003/0008/0011/0012, the issue, relevant
R6 history/plan, the listed contract/domain/runtime sources, current tests,
root scripts, and Vitest configuration.

## Scope and explicit non-goals

In scope:

- one portable Skill at `.agents/skills/gitblocks-oss-adoption/SKILL.md`;
- one dependency-free Node scanner at
  `.agents/skills/gitblocks-oss-adoption/scripts/fingerprint-codebase.mjs`;
- exact manifest-first allowlisted scanning and existing V1 fact production;
- the scanner's stdin-only `--reference` digest mode;
- scanner, digest-parity, static-safety, and Skill-structure tests in the
  existing hosted test workspace;
- one controlled scanner-to-existing-MCP PostgreSQL development exercise;
- README, product contract, system context, and this plan updates limited to
  implemented R7 reality and manual post-merge dogfood.

Explicit non-goals:

- no hosted recommendation, model, retrieval, evidence, PostgreSQL,
  persistence, migration, target-fit contract, MCP semantic, `/mcp`, loopback
  validation, deployment, or authentication change;
- no new MCP tool, scanner service/daemon/package/workspace, source crawler,
  arbitrary traversal, Git call, target persistence, source upload, model call,
  ranking, plugin/marketplace/installer, telemetry backend, or dependency;
- no candidate installation/execution before selection, no unrelated target
  application edit, no live provider/ingestion/materialization operation, no
  Phase 10 reuse, no R8 work.

If digest parity or the existing recommendation-request contract cannot accept
the valid minimized fingerprint, implementation stops and reports the exact
mismatch instead of changing R6.

## Requirements crosswalk

| Issue requirement                           | Destination                                 | Milestone | Evidence                                 |
| ------------------------------------------- | ------------------------------------------- | --------- | ---------------------------------------- |
| Portable focused Skill and trigger boundary | `SKILL.md`                                  | 2         | structural tests and line review         |
| Bounded inert scanner                       | `fingerprint-codebase.mjs`                  | 1         | behavior, abuse, and static source tests |
| Existing V1 facts and vocabulary only       | scanner plus contract/domain tests          | 1         | parser/domain validation                 |
| Exact fingerprint reference                 | scanner `--reference`                       | 1         | parity and ordering tests                |
| Preview and explicit approval               | `SKILL.md`                                  | 2         | structural tests and manual review       |
| Existing `recommend_oss` only               | `SKILL.md` and existing MCP                 | 2/3       | structural and official-client tests     |
| GitBlocks owns judgment                     | `SKILL.md`                                  | 2         | reranking/fallback boundary assertions   |
| User selection before edits                 | `SKILL.md`                                  | 2         | structural assertions                    |
| Controlled full composition                 | existing hosted PostgreSQL integration test | 3         | temporary fixture to <=3 options         |
| Local dogfood handoff                       | README                                      | 4         | exact ten-step procedure review          |
| Draft publication only                      | branch, plan, draft PR                      | 5         | Git/GitHub evidence                      |

## Assumptions, risks, and unresolved decisions

Verified facts:

- The existing root fingerprint and recommendation contracts can represent the
  requested R7 facts and approval categories.
- Node standard APIs are sufficient for bounded filesystem reads, SHA-256,
  path containment, JSON parsing, stdin, and deterministic output.
- The official MCP client and temporary PostgreSQL harness already exist.

Working assumptions:

- A 1 MiB `package.json` limit is sufficient for private-alpha manifests.
- A 256 KiB stdin limit is sufficient for the deliberately small scanner
  fingerprint in `--reference` mode.
- The existing hosted test workspace is the narrowest test owner because it
  already depends on contracts/domain and owns the official MCP integration;
  no product dependency direction changes.

Risks and controls:

- Untrusted manifests could attempt size/resource abuse: inspect type and size,
  read at most the bound plus one byte, reject oversize without truncation, and
  return value-free diagnostics.
- Symlink or race escape could widen reads: canonicalize the explicit root,
  lstat every allowlisted input, reject file symlinks, verify realpath
  containment, open the sole content file read-only/no-follow, and verify its
  opened regular-file stat.
- Scanner inference could manufacture absence or recommendation meaning: use
  only exact mappings, omit ambiguity, emit no negative capability facts, and
  keep GitBlocks comparative judgment remote.
- A copied digest algorithm could drift: keep the copy to canonical JSON plus
  SHA-256 and enforce parity with the authoritative helper over order
  permutations.
- Skill prose could authorize unsafe fallback or edits: deterministic
  structural checks plus changed-line review cover preview, approval, outcome,
  no-rerank, no-preselection-execution, selection, and edit boundaries.
- Manual Codex trigger behavior is not proven by deterministic structure alone:
  actual fresh-session dogfood is explicitly post-merge and remains a deferred
  gap, not a completion claim.

No material unresolved architecture decision remains. If implementation
invalidates an assumption, update Issue #44 and this plan before expanding
scope.

## Applicable ADRs and contracts

- [ADR 0001](../architecture/decisions/0001-agent-native-delivery.md): Skill
  owns procedure/minimization/approval; scanner owns deterministic local facts;
  hosted GitBlocks owns recommendation; host agent owns approved edits.
- [ADR 0002](../architecture/decisions/0002-typescript-workspace-and-toolchain.md):
  use Node 24 and pnpm; add no workspace or dependency; standalone MJS remains
  standard-library-only and repository validation stays authoritative.
- [ADR 0003](../architecture/decisions/0003-product-contract-kernel.md): emit the
  existing closed `RepositoryFingerprintV1`, use vocabulary `1.0.0`, preserve
  provenance semantics, and validate through the central parser/domain rules.
- [ADR 0008](../architecture/decisions/0008-artifact-first-retrieval-foundation.md):
  build the existing local-pre-approval query, preserve modality/source intent,
  and bind only the exact fingerprint ID/digest.
- [ADR 0011](../architecture/decisions/0011-postgresql-retrieval-serving.md) and
  [ADR 0012](../architecture/decisions/0012-openai-target-fit-provider.md): reuse
  the existing controlled hosted composition in development without changing
  storage, provider, model, or hosted semantics.
- `RepositoryFingerprintV1`, `CapabilityQueryInputV1`,
  `OssRecommendationRequestV1`, and the existing `recommend_oss` MCP schema
  remain authoritative and unchanged.

No ADR or versioned contract changes. Documentation changes current/future
status only.

## Architecture, data flow, and performance impact

The new scanner is a one-shot local sensor invoked by the Skill. It accepts one
explicit root, reads content only from `package.json`, performs type/existence
checks on the seven lock/config/workspace paths, emits one minimized
fingerprint, and exits. Reference mode reads one bounded stdin fingerprint,
does no scan, and emits its ID plus authoritative-parity digest.

```text
target root -> scanner -> RepositoryFingerprintV1
                         -> --reference -> fingerprint ID/digest
developer approval -> existing recommend_oss -> existing hosted result
```

Exact content-read allowlist: `package.json` only, maximum 1,048,576 bytes.
Exact existence-only allowlist: `tsconfig.json`, `pnpm-lock.yaml`,
`package-lock.json`, `yarn.lock`, `bun.lock`, `bun.lockb`, and
`pnpm-workspace.yaml`. There is no recursion, concurrency, retry, network,
clock loop, write, cache, or long-lived process. Maximum fingerprint facts are
bounded by fixed mappings and remain far below the V1 200-fact contract bound.

## Security, privacy, abuse, and supply-chain considerations

Assets are local repository confidentiality/integrity, approval intent, and
recommendation integrity. Actors are the developer, host coding agent,
untrusted target repository data, local scanner, existing loopback MCP process,
and existing hosted model boundary.

The new trust boundary accepts an explicit local path and inert manifest JSON.
Misuse cases include symlink escape, oversized/malformed JSON, special files,
secret/environment/log/source reads, command or network execution, target
writes, path disclosure, ambiguous inference, forged approval, and host-agent
reranking. Controls are the exact allowlists/bounds above, no-follow/type/
containment checks, no target effects, path-free output and value-free stderr,
complete preview, explicit approval, exact contract binding, and procedural
stop boundaries.

The Skill tells the agent that the existing configured model provider processes
only the minimized fingerprint and bounded finalist evidence. No raw source,
credentials, `.env`, logs, database contents, command output, or absolute path
is collected or transmitted. No new dependency or lockfile change occurs.
Residual risk is host compliance with an instruction-only Skill; structural
tests and post-merge manual dogfood are the proportional controls for R7.

## Implementation milestones

1. **Scanner and reference mode.** Add test-alongside standalone code for exact
   allowlists, facts, IDs, time, safe failures, static capabilities, and
   authoritative digest parity. Stop on a parity or contract mismatch.
2. **Portable Skill.** Add concise frontmatter and imperative workflow covering
   intent, request capture, scanner/reference, preview/approval, request build,
   exact tool call, all result states, no reranking, selection/edit boundaries,
   adoption, validation, and report.
3. **Controlled composition.** Extend the existing PostgreSQL/official-client
   integration exercise with a realistic temporary scanned target and the
   scanner-generated exact fingerprint reference.
4. **Reality documentation.** Update README, product contract, system context,
   and plan progress/evidence; document local symlink/copy dogfood and retain
   loopback/deployment limitations.
5. **Review and publication.** Run exact final gates once, perform complete
   diff/security/scope review, commit, push, open/update one draft PR, inspect
   natural Actions state without manual rerun, and stop.

## Testing and validation strategy

Focused deterministic scanner/Skill tests cover valid/minimal and mapped facts,
ambiguity omission, no absence inference, time/ID determinism, contract/domain
validation, exact allowlists/no-read behavior, malformed/oversized/symlink
denial, no path/stdout leakage, digest parity/order behavior, static forbidden
capabilities, and Skill structure. They use temporary fixtures and no live
network/model/provider.

The controlled database test uses the real existing PostgreSQL 18 path,
existing official MCP client, existing R6 application, injected controlled
model, and temporary public evidence. It proves composition only; it does not
change hosted behavior or call OpenAI.

Exact commands from the repository root:

```text
pnpm runtime:check
pnpm build:product
pnpm exec vitest run apps/gitblocks-hosted/test/gitblocks-oss-adoption.test.ts --config vitest.config.ts
pnpm exec vitest run apps/gitblocks-hosted/test/mcp.test.ts apps/gitblocks-hosted/test/application.test.ts --config vitest.config.ts
pnpm contracts:validate
pnpm db:verify
pnpm verify
git diff --check
git status --short --branch
```

`pnpm verify` is the single final offline regression run. `pnpm db:verify` is
the final real-PostgreSQL exercise. `pnpm verify:ci` is not planned locally
because R7 changes no dependency graph and the natural GitHub workflow owns
the registry-backed audit; if a dependency/lockfile change unexpectedly
appears, stop, update scope, and require it. No live OpenAI, ingestion,
interview, artifact, materialization, repository interview, or Phase 10 command
is authorized.

## Observability and operations

The scanner is a local one-shot user-machine process, not a deployed/shared
production path. It emits only bounded value-free diagnostics to stderr and
one contract value to stdout; no telemetry backend, logs, metrics, trace,
identifier persistence, dashboard, alert, SLO, readiness, or runbook is
introduced. The controlled test reuses existing hosted R6 bounded events.

## Migration, compatibility, rollout, and recovery

There is no database migration, persisted target data, schema-version change,
hosted rollout, or remote deployment. The Skill and scanner are additive
repo-hosted source. Local dogfood installation is a copy or symlink into
`$HOME/.agents/skills`; recovery is removing that local copy/symlink. A failed
scan or reference operation emits no partial JSON and performs no write. A
failed MCP call performs no local edit. Existing loopback hosted behavior
continues unchanged.

## Exact exit criteria

- The Skill/scanner/reference paths and all issue-mandated facts/boundaries are
  implemented and focused tests pass.
- Scanner output passes the authoritative fingerprint parser and domain
  validator; reference output exactly matches the authoritative digest.
- The controlled scanned-target to official `recommend_oss` MCP exercise
  returns a validated outcome with at most three responsible options.
- Complete preview/approval and user-selection/edit gates are explicit.
- Documentation distinguishes implemented local source from post-merge manual
  dogfood and future remote availability.
- Exact focused, contract, database, final repository, diff, status, scope,
  security, and secret reviews are recorded.
- No prohibited complexity or hosted semantic change appears in the diff.
- One normal commit is pushed and one draft PR linked to Issue #44 remains
  open, draft, and unmerged; R8 is not started.

## Progress log

- 2026-08-12: Verified the exact requested main/GitHub baseline, refreshed
  official Codex Skill guidance, created Issue #44, inspected governing
  policy/ADRs/contracts/runtime/tests/history, passed runtime preflight, created
  the issue-linked branch, corrected the initially incomplete branch-policy
  invocation, and wrote this plan before product implementation.
- 2026-08-12: Added the portable 213-line Skill and dependency-free scanner.
  The scanner implements the exact read allowlists, 1 MiB manifest bound,
  256 KiB reference-input bound, existing vocabulary mappings, deterministic
  IDs/timestamps, value-free diagnostics, and authoritative-parity reference
  digest without adding a workspace, dependency, DTO, or MCP tool.
- 2026-08-12: Added 21 focused scanner/reference/Skill tests covering the
  required behavior, abuse cases, parser/domain validity, digest ordering
  parity, and static effect boundary. Added a scanned temporary target to the
  existing official-client PostgreSQL integration exercise; the controlled
  result remains owned and validated by the unchanged R6 application.
- 2026-08-12: Updated only README, product contract, system context, Skill, and
  this plan for implemented R7 reality. README now records the exact ten-step
  post-merge Codex dogfood procedure and keeps remote usability explicitly
  deferred.
- 2026-08-12: Committed the reviewed implementation, pushed the issue-linked
  branch, and opened draft PR #45. Natural Actions run `31676622739` again
  produced failed jobs with zero steps under the known billing/spending-limit
  condition; it was not manually rerun and CI was not weakened.

## Decision and deviation log

- 2026-08-12: Use the existing hosted test workspace rather than a new
  workspace. It already owns the official MCP integration and declares the
  contract/domain dependencies needed for scanner validation.
- 2026-08-12: Do not add `agents/openai.yaml`. Current official guidance makes
  it optional; no portable MCP URL/auth dependency is established in R7.
- 2026-08-12: Treat the initial branch-check usage exit as recorded operator
  error, not a product failure; the corrected exact invocation passed before
  implementation.
- 2026-08-12: Reproduce only the authoritative canonical fingerprint material
  ordering and canonical-JSON SHA-256 behavior in scanner reference mode. The
  contracts helper remains authoritative, and parity tests cover fact,
  code-set, and withheld-category permutations.
- 2026-08-12: Keep the existing PostgreSQL integration test as one exercise and
  replace its fixed target fingerprint with the real R7 scanner output. This
  avoids a second expensive cross-layer harness while preserving its invented-
  target-fact rejection assertion.
- 2026-08-12: The final repository check observed that the Markdown
  capitalization rule treated required lowercase Agent Skill `name:` metadata
  as prose, despite its stated slug exemption. The existing inspection was
  insufficient because CommonMark exposes YAML frontmatter as ordinary text.
  Apply the smallest fix: mask only the first `name:` line in `SKILL.md`
  frontmatter during Markdown inspection and add a regression proving Skill
  descriptions remain checked. A general YAML-frontmatter subsystem is
  explicitly deferred.

## Validation evidence

- `git status --short --branch` on main — clean, tracking `origin/main`.
- `git rev-parse HEAD main origin/main` — all
  `b9c84514bb32d444568c995e8f3cea60ef75811a`.
- GitHub state inspection — PR #43 merged; Issue #42 completed; PR #33
  closed/unmerged; Issue #32 not planned; preserved Phase 10 branch present.
- `pnpm runtime:check` — exit 0 before branch creation.
- `pnpm repo:branch` without a branch value — exit 2, expected usage error from
  an incomplete invocation.
- `pnpm repo:branch feat/44-gitblocks-oss-adoption` — exit 0; branch name check
  passed.
- `pnpm build:product` — exit 0 after adding scanner, Skill, and focused tests.
- `pnpm --filter @gitblocks/gitblocks-hosted typecheck` — exit 0 with the
  scanner-driven PostgreSQL exercise.
- `pnpm lint:internal` — exit 0 after standalone scanner and test lint fixes.
- Focused scanner/reference/Skill command — 1 file and 21 tests passed.
- Focused hosted application/MCP command — 2 files and 19 tests passed.
- `pnpm contracts:validate` — exit 0; 10 cases, 40 supplied candidates,
  representability-only conformance passed.
- `pnpm db:verify` — exit 0 against pinned PostgreSQL 18.4; 12 files and 70
  tests passed without skips, including scanner -> parser/reference -> valid
  `OssRecommendationRequestV1` -> official MCP client -> unchanged
  `recommend_oss` -> controlled target-fit result with no more than three
  responsible options. Six migrations, 29 public product tables, and zero RLS
  policies were verified.
- First final `pnpm verify` attempt — 138 files and 2,022 tests passed and
  architecture passed; repository link inspection then failed because the new
  Skill was not yet tracked in the Git index. The intended R7 files were staged
  so link validation could resolve the new target.
- Second final `pnpm verify` attempt — 138 files and 2,022 tests passed and
  architecture passed; repository capitalization inspection then exposed the
  required Skill-name slug mismatch recorded above. No product test,
  typecheck, lint, or architecture failure occurred.
- Focused repository-invariant regression — 1 file and 53 tests passed,
  including the new Skill-name slug/description-capitalization boundary.
- First passing `pnpm verify` — exit 0; formatting, product/tool builds, lint, all
  workspace typechecks, 138 files and 2,023 tests, dependency architecture,
  repository policy, all evaluation/contract/taxonomy/profile/catalog/operator/
  pre-live authorities, and secret scanning passed.
- Post-hardening final `pnpm verify` — exit 0 after conservatively rejecting a
  non-semver-shaped `engines.node` value; the same complete gate passed with
  138 files and 2,024 tests.
- Natural GitHub Actions run `31676622739` for implementation commit
  `36cb72086a6fa21726a1d26066dac28eae31b2b7` — all observed jobs completed as
  failures with empty step arrays; this is the known zero-runner/zero-step
  billing/spending-limit condition. No manual rerun was requested.

The final plan-link commit, final branch-state inspection, and final-head
natural Actions observation remain pending.
