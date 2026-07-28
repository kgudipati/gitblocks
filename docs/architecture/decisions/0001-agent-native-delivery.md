# ADR 0001: Agent-native, headless delivery

- Status: accepted
- Date: 2026-07-27
- Decision owners: GitBlocks maintainers
- Related contract:
  [GitBlocks product contract](../../product/product-contract.md)
- Related context: [System context](../system-context.md)

## Context

Developers already use coding agents that can inspect a local repository, ask
for permission, edit files, and run repository-specific validation. GitBlocks'
distinct value is not another general coding surface; it is open-source
adoption intelligence grounded in compatibility evidence and the target
codebase.

A delivery design must preserve the developer's existing workflow, avoid
shipping proprietary ranking logic to clients, minimize disclosure of local
source, and keep local execution under the permissions and controls of the
developer's chosen coding-agent host. It must also prevent untrusted
repositories and retrieved content from turning into instructions.

No product runtime exists when this ADR is accepted. This decision sets
direction without selecting implementation technologies.

## Decision

1. **GitBlocks will be headless and agent-native first.** The initial experience
   will be delivered through an Agent Skill and a remote MCP server, not a
   standalone consumer search website.
2. **The Skill will own procedure and safe orchestration.** It will capture the
   job and hard constraints, invoke a deterministic local scanner, minimize and
   preview data crossing the remote boundary, preserve approval gates, present
   evidence and uncertainty, and structure the adoption plan and outcome.
3. **MCP will expose a small user-goal-oriented tool surface.** Tools will
   represent stable goals such as discovery, comparison, evidence retrieval,
   adoption planning, and outcome capture. They will not expose database,
   ranking, prompt, or worker internals as arbitrary primitives.
4. **Proprietary evidence and ranking logic will remain server-side.** Remote
   application services will own catalog access, evidence policy, viability
   rules, codebase-conditioned ranking, and the controlled learning loop.
5. **The developer's existing coding agent will perform local edits and
   validation.** GitBlocks will return evidence and a plan. Any later
   integration assistance will operate through the host agent's explicit
   permissions; GitBlocks will not silently write, deploy, or push.
6. **Local codebase fingerprinting will be the privacy-preserving default.** A
   deterministic scanner in the user-controlled environment will derive a
   minimized, versioned fingerprint without executing repository code. Raw
   source stays local unless a bounded excerpt is previewed and affirmatively
   approved for a stated purpose.
7. **Untrusted content will remain data.** Source, documentation, issues,
   package metadata, web content, MCP arguments, and model output cannot
   override the Skill procedure, authorization rules, system instructions, or
   approval boundaries.

The [system context](../system-context.md) defines the corresponding component,
dependency, data-flow, and trust boundaries.

## Consequences

### Benefits

- Developers keep one interactive coding workflow and its existing local
  permissions, repository context, edit tools, and validation capabilities.
- Raw source is not required for the normal remote discovery path.
- The Skill procedure can remain inspectable and lean while evidence,
  compatibility knowledge, and ranking improve server-side.
- A small goal-oriented MCP contract reduces coupling to internal service and
  storage choices.
- Recommendation evidence and adoption outcomes can improve independently of a
  particular coding-agent vendor.

### Costs and constraints

- Capability depends on coding-agent hosts that can run the Skill procedure and
  support the required MCP interactions.
- The local fingerprint contract becomes a compatibility boundary and requires
  versioning, fixtures, migration rules, and privacy review.
- Local minimization can reduce ranking confidence; unknowns must be disclosed
  instead of requesting broad source access by default.
- A remote service introduces authentication, authorization, tenancy,
  availability, rate limiting, retention, audit, and incident-response
  obligations.
- Cross-host behavior may vary. Contract and end-to-end tests must verify a
  deliberately small supported matrix.
- User-goal tools may require coordinated version evolution even when internal
  services change independently.

## Rejected alternatives

### Consumer GitHub search website first

Rejected because it would separate discovery from the target repository and
the agent that performs integration. It would favor general relevance over
adoption fit and duplicate an interaction surface before the core thesis is
validated. A focused administrative or evidence-review UI may be considered
later without changing the initial delivery decision.

### Full GitBlocks coding-agent runtime

Rejected because it duplicates editing, permission, and validation capabilities
already available in existing coding agents. It would expand security scope and
make adoption intelligence secondary to building another agent shell.

### Send the complete repository to the backend

Rejected as the default because it violates data minimization, increases
tenant-isolation and retention risk, and is unnecessary for many compatibility
facts. Narrow excerpts may be approved only when a material unknown cannot be
resolved from a minimized fingerprint.

### Ship ranking and the catalog entirely in the Skill

Rejected because it would expose proprietary logic, produce stale clients,
increase Skill size, and make evidence freshness and the outcome-learning loop
hard to govern. Deterministic local checks that do not reveal proprietary
ranking remain appropriate in the Skill or scanner.

### Broad low-level MCP primitives

Rejected because database-like or internal ranking controls would couple hosts
to implementation details, enlarge the authorization surface, and let
model-produced sequences bypass the product procedure.

### Execute candidate repositories in analysis workers

Rejected because untrusted execution is not required for the first product
thesis and would create disproportionate sandbox-escape, supply-chain, cost,
and data-exfiltration risk. This prohibition is also a first-release non-goal.

## Revisit triggers

Revisit this ADR through a superseding decision if:

- private-alpha results meet a falsification condition in the
  [product contract](../../product/product-contract.md#falsification-criteria);
- supported coding-agent hosts cannot provide consistent approval,
  fingerprint, MCP, or validation behavior;
- measured tasks require raw-source transfer often enough that the local
  fingerprint no longer provides a meaningful privacy advantage;
- the goal-oriented MCP surface cannot evolve compatibly across supported
  hosts;
- a non-agent interface becomes necessary for a validated primary user job
  rather than administration or evidence review;
- legal, privacy, security, or customer requirements prohibit the planned
  remote intelligence boundary; or
- verifiable local ranking can deliver equivalent freshness and quality
  without exposing protected logic or weakening the learning loop.

Convenience, implementation preference, or a new framework alone is not a
revisit trigger.
