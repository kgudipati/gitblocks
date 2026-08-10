import type {
  CapabilityRetrievalExpansionEdgeV1,
  CapabilityRetrievalExpansionV1,
} from '@gitblocks/contracts';

export const MAX_RETRIEVAL_EXPANSION_EDGES_PER_QUERY = 32;

export interface RetrievalTermExpansionV1 {
  readonly originalConceptIds: readonly string[];
  readonly expandedTerms: readonly string[];
  readonly edgesApplied: readonly CapabilityRetrievalExpansionEdgeV1[];
  readonly edgesTruncated: number;
}

/**
 * Expands only the supplied normalized concepts. Targets are never traversed,
 * even when one is also a source in the authority, which makes the one-hop
 * boundary explicit and independent of authority ordering.
 */
export function expandRetrievalTermsV1(
  suppliedConceptIds: readonly string[],
  authority: CapabilityRetrievalExpansionV1,
): RetrievalTermExpansionV1 {
  const originalConceptIds = uniqueSorted(suppliedConceptIds);
  const sourceSet = new Set(originalConceptIds);
  const applicableEdges = authority.edges
    .filter(({ sourceConceptId }) => sourceSet.has(sourceConceptId))
    .sort(compareEdges);
  const edgesApplied = applicableEdges.slice(
    0,
    MAX_RETRIEVAL_EXPANSION_EDGES_PER_QUERY,
  );
  return {
    originalConceptIds,
    expandedTerms: uniqueSorted(
      edgesApplied.map(({ targetTerm }) => targetTerm),
    ),
    edgesApplied,
    edgesTruncated: Math.max(0, applicableEdges.length - edgesApplied.length),
  };
}

function compareEdges(
  left: CapabilityRetrievalExpansionEdgeV1,
  right: CapabilityRetrievalExpansionEdgeV1,
): number {
  return (
    compareAscii(left.sourceConceptId, right.sourceConceptId) ||
    compareAscii(left.targetTerm, right.targetTerm) ||
    compareAscii(left.edgeId, right.edgeId)
  );
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareAscii);
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
