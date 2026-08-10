import { contractCanonicalDigest } from './artifact-identity.ts';
import {
  contractIssue,
  finalizeContractIssues,
  type ContractIssue,
  type ContractParseResult,
} from './diagnostics.ts';
import { cloneOwnedJson } from './owned-json.ts';
import { CONTRACT_VERSION } from './schema-builders.ts';
import {
  capabilityRetrievalExpansionSourceV1Validator,
  capabilityRetrievalExpansionV1Validator,
  structurallyValidate,
} from './structural-validation.ts';
import {
  CAPABILITY_RETRIEVAL_EXPANSION_VERSION,
  type CapabilityRetrievalExpansionEdgeV1,
  type CapabilityRetrievalExpansionSourceV1,
  type CapabilityRetrievalExpansionV1,
} from './capability-retrieval-expansion-schemas.ts';
import type { CapabilityTaxonomyV1 } from './capability-taxonomy-schemas.ts';

const TAXONOMY_ALIAS_RATIONALE =
  'Reviewed active taxonomy alias used only as a bounded soft retrieval term.';

export function parseCapabilityRetrievalExpansionSourceV1(
  value: unknown,
): ContractParseResult<
  CapabilityRetrievalExpansionSourceV1,
  CapabilityRetrievalExpansionSourceV1
> {
  const structural = structurallyValidate(
    value,
    capabilityRetrievalExpansionSourceV1Validator,
  );
  if (!structural.ok) return structural;
  const issues = validateSourceSemantics(structural.value);
  return issues.length === 0
    ? {
        ok: true,
        value: cloneOwnedJson(structural.value),
        domain: cloneOwnedJson(structural.value),
        issues: [],
      }
    : { ok: false, issues };
}

export function buildCapabilityRetrievalExpansionV1(
  suppliedSource: CapabilityRetrievalExpansionSourceV1,
  taxonomy: CapabilityTaxonomyV1,
): CapabilityRetrievalExpansionV1 {
  const parsed = parseCapabilityRetrievalExpansionSourceV1(suppliedSource);
  if (
    !parsed.ok ||
    parsed.value.taxonomyVersion !== taxonomy.taxonomyVersion ||
    parsed.value.taxonomySemanticDigest !== taxonomy.semanticDigest
  ) {
    throw new Error('Capability retrieval expansion source is invalid.');
  }
  const conceptIds = new Set(
    taxonomy.concepts.map(({ conceptId }) => conceptId),
  );
  const edges: CapabilityRetrievalExpansionEdgeV1[] = [];
  for (const alias of taxonomy.resolvedAliases) {
    if (
      alias.status !== 'active' ||
      alias.aliasKey === alias.conceptId ||
      !conceptIds.has(alias.conceptId)
    ) {
      continue;
    }
    edges.push(
      createEdge({
        sourceConceptId: alias.conceptId,
        targetTerm: alias.aliasKey,
        relationshipKind: 'taxonomy-alias',
        rationale: TAXONOMY_ALIAS_RATIONALE,
        sourceReference: {
          sourceKind: 'taxonomy-alias',
          sourceId: alias.aliasKey,
        },
      }),
    );
  }
  for (const rule of parsed.value.rules) {
    if (!conceptIds.has(rule.sourceConceptId)) {
      throw new Error('Capability retrieval expansion source is invalid.');
    }
    for (const targetTerm of rule.targetTerms) {
      edges.push(
        createEdge({
          sourceConceptId: rule.sourceConceptId,
          targetTerm,
          relationshipKind: rule.relationshipKind,
          rationale: rule.rationale,
          sourceReference: rule.sourceReference,
        }),
      );
    }
  }
  edges.sort(compareEdges);
  if (validateEdgeClosure(edges).length > 0) {
    throw new Error('Capability retrieval expansion source is invalid.');
  }
  const withoutDigest = {
    contractVersion: CONTRACT_VERSION,
    expansionVersion: CAPABILITY_RETRIEVAL_EXPANSION_VERSION,
    taxonomyVersion: parsed.value.taxonomyVersion,
    taxonomySemanticDigest: parsed.value.taxonomySemanticDigest,
    edges,
    releaseMetadata: { ...parsed.value.releaseMetadata },
  } satisfies Omit<CapabilityRetrievalExpansionV1, 'semanticDigest'>;
  return {
    ...withoutDigest,
    semanticDigest: capabilityRetrievalExpansionSemanticDigest(withoutDigest),
  };
}

export function parseCapabilityRetrievalExpansionV1(
  value: unknown,
): ContractParseResult<
  CapabilityRetrievalExpansionV1,
  CapabilityRetrievalExpansionV1
> {
  const structural = structurallyValidate(
    value,
    capabilityRetrievalExpansionV1Validator,
  );
  if (!structural.ok) return structural;
  const issues = [
    ...validateEdgeClosure(structural.value.edges),
    ...(capabilityRetrievalExpansionSemanticDigest(structural.value) ===
    structural.value.semanticDigest
      ? []
      : [bindingIssue('/semanticDigest')]),
  ];
  return issues.length === 0
    ? {
        ok: true,
        value: cloneOwnedJson(structural.value),
        domain: cloneOwnedJson(structural.value),
        issues: [],
      }
    : { ok: false, issues: finalizeContractIssues(issues) };
}

export function capabilityRetrievalExpansionSemanticDigest(
  value:
    | Omit<CapabilityRetrievalExpansionV1, 'semanticDigest'>
    | CapabilityRetrievalExpansionV1,
): string {
  return contractCanonicalDigest({
    contractVersion: value.contractVersion,
    expansionVersion: value.expansionVersion,
    taxonomyVersion: value.taxonomyVersion,
    taxonomySemanticDigest: value.taxonomySemanticDigest,
    edges: value.edges,
  });
}

export function serializeCapabilityRetrievalExpansionV1(
  value: CapabilityRetrievalExpansionV1,
): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function validateSourceSemantics(
  source: CapabilityRetrievalExpansionSourceV1,
): readonly ContractIssue[] {
  const issues: ContractIssue[] = [];
  const sources = new Set<string>();
  for (const [index, rule] of source.rules.entries()) {
    if (
      sources.has(rule.sourceConceptId) ||
      rule.sourceReference.sourceId !== rule.sourceConceptId
    ) {
      issues.push(bindingIssue(`/rules/${String(index)}`));
    }
    sources.add(rule.sourceConceptId);
  }
  return finalizeContractIssues(issues);
}

function validateEdgeClosure(
  edges: readonly CapabilityRetrievalExpansionEdgeV1[],
): readonly ContractIssue[] {
  const issues: ContractIssue[] = [];
  const keys = new Set<string>();
  const counts = new Map<string, number>();
  for (const [index, edge] of edges.entries()) {
    const key = `${edge.sourceConceptId}\0${edge.targetTerm}`;
    if (
      keys.has(key) ||
      edge.edgeId !== createEdgeId(edge) ||
      (edge.sourceReference.sourceKind === 'taxonomy-concept-definition' &&
        edge.sourceReference.sourceId !== edge.sourceConceptId) ||
      (edge.sourceReference.sourceKind === 'taxonomy-alias' &&
        edge.sourceReference.sourceId !== edge.targetTerm)
    ) {
      issues.push(bindingIssue(`/edges/${String(index)}`));
    }
    keys.add(key);
    counts.set(
      edge.sourceConceptId,
      (counts.get(edge.sourceConceptId) ?? 0) + 1,
    );
    const previous = edges[index - 1];
    if (previous !== undefined && compareEdges(previous, edge) >= 0) {
      issues.push(bindingIssue('/edges'));
    }
  }
  if ([...counts.values()].some((count) => count > 8)) {
    issues.push(
      contractIssue(
        'contract.bounds',
        '/edges',
        'Contract value is outside the allowed bounds.',
      ),
    );
  }
  return finalizeContractIssues(issues);
}

function createEdge(
  input: Omit<CapabilityRetrievalExpansionEdgeV1, 'edgeId'>,
): CapabilityRetrievalExpansionEdgeV1 {
  return { ...input, edgeId: createEdgeId(input) };
}

function createEdgeId(
  input:
    | Omit<CapabilityRetrievalExpansionEdgeV1, 'edgeId'>
    | CapabilityRetrievalExpansionEdgeV1,
): string {
  const { edgeId: ignored, ...semantic } =
    input as CapabilityRetrievalExpansionEdgeV1;
  void ignored;
  return `expansion-edge-${contractCanonicalDigest(semantic).slice(0, 32)}`;
}

function compareEdges(
  left: CapabilityRetrievalExpansionEdgeV1,
  right: CapabilityRetrievalExpansionEdgeV1,
): number {
  return (
    compareAscii(left.sourceConceptId, right.sourceConceptId) ||
    compareAscii(left.targetTerm, right.targetTerm) ||
    compareAscii(left.relationshipKind, right.relationshipKind) ||
    compareAscii(left.edgeId, right.edgeId)
  );
}

function bindingIssue(path: string): ContractIssue {
  return contractIssue(
    'contract.literal',
    path,
    'Contract value does not match the required literal.',
  );
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
