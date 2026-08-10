import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  buildCapabilityRetrievalExpansionV1,
  capabilityRetrievalExpansionSemanticDigest,
  parseCapabilityRetrievalExpansionV1,
  parseCapabilityTaxonomyV1,
  type CapabilityRetrievalExpansionSourceV1,
  type CapabilityRetrievalExpansionV1,
  type CapabilityTaxonomyV1,
} from '@gitblocks/contracts';

import { expandRetrievalTermsV1 } from '../src/index.ts';

const taxonomyPath = fileURLToPath(
  new URL(
    '../../../catalog/capability-taxonomy/1.0.0/manifest.json',
    import.meta.url,
  ),
);

let taxonomy: CapabilityTaxonomyV1;
let authority: CapabilityRetrievalExpansionV1;

beforeAll(async () => {
  const parsed = parseCapabilityTaxonomyV1(
    JSON.parse(await readFile(taxonomyPath, 'utf8')) as unknown,
  );
  if (!parsed.ok) throw new Error('Taxonomy fixture is invalid.');
  taxonomy = parsed.value;
  authority = buildCapabilityRetrievalExpansionV1(source(), taxonomy);
});

describe('controlled retrieval expansion', () => {
  it('builds one canonical digest-bound authority independent of source order', () => {
    const reversed = source();
    reversed.rules.reverse();
    reversed.rules.forEach((rule) => rule.targetTerms.reverse());
    const rebuilt = buildCapabilityRetrievalExpansionV1(reversed, taxonomy);

    expect(rebuilt).toEqual(authority);
    expect(parseCapabilityRetrievalExpansionV1(rebuilt).ok).toBe(true);
    expect(capabilityRetrievalExpansionSemanticDigest(rebuilt)).toBe(
      rebuilt.semanticDigest,
    );
  });

  it('expands one hop without recursively traversing a target source', () => {
    const expanded = expandRetrievalTermsV1(['delayed-jobs'], authority);

    expect(expanded.originalConceptIds).toEqual(['delayed-jobs']);
    expect(expanded.expandedTerms).toContain('retries');
    expect(expanded.expandedTerms).not.toContain('backoff');
  });

  it('preserves original concepts and is independent of input order', () => {
    const forward = expandRetrievalTermsV1(
      ['delayed-jobs', 'token-bucket'],
      authority,
    );
    const reverse = expandRetrievalTermsV1(
      ['token-bucket', 'delayed-jobs'],
      authority,
    );

    expect(reverse).toEqual(forward);
    expect(forward.originalConceptIds).toEqual([
      'delayed-jobs',
      'token-bucket',
    ]);
    expect(
      expandRetrievalTermsV1(forward.originalConceptIds, {
        ...authority,
        edges: [...authority.edges].reverse(),
      }),
    ).toEqual(forward);
  });

  it('enforces eight targets per source and truncates query output at 32', () => {
    expect(() =>
      buildCapabilityRetrievalExpansionV1(
        {
          ...source(),
          rules: [
            {
              sourceConceptId: 'delayed-jobs',
              relationshipKind: 'related-identity-term',
              targetTerms: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'],
              rationale: 'Exceeds the final alias-inclusive source bound.',
              sourceReference: {
                sourceKind: 'taxonomy-concept-definition',
                sourceId: 'delayed-jobs',
              },
            },
          ],
        },
        taxonomy,
      ),
    ).toThrow('Capability retrieval expansion source is invalid.');

    const manySources = authority.edges
      .map(({ sourceConceptId }) => sourceConceptId)
      .filter((value, index, values) => values.indexOf(value) === index);
    const expanded = expandRetrievalTermsV1(manySources, authority);
    const applicableEdges = authority.edges.filter(({ sourceConceptId }) =>
      new Set(manySources).has(sourceConceptId),
    ).length;
    expect(expanded.expandedTerms.length).toBeLessThanOrEqual(32);
    expect(expanded.edgesApplied).toHaveLength(32);
    expect(expanded.edgesTruncated).toBe(applicableEdges - 32);
  });

  it('rejects a taxonomy binding mismatch', () => {
    expect(() =>
      buildCapabilityRetrievalExpansionV1(
        {
          ...source(),
          taxonomySemanticDigest: '0'.repeat(64),
        },
        taxonomy,
      ),
    ).toThrow('Capability retrieval expansion source is invalid.');
  });
});

function source(): CapabilityRetrievalExpansionSourceV1 & {
  rules: (CapabilityRetrievalExpansionSourceV1['rules'][number] & {
    targetTerms: string[];
  })[];
} {
  return {
    expansionVersion: 'capability-retrieval-expansion/1.0.0',
    taxonomyVersion: '1.0.0',
    taxonomySemanticDigest:
      '838fa85b2e6937866854b6f733fe7045cf49d5f811cb5e4a8d503bfbd76a61c9',
    includeActiveTaxonomyAliases: true,
    rules: [
      {
        sourceConceptId: 'delayed-jobs',
        relationshipKind: 'related-identity-term',
        targetTerms: ['cron', 'retries', 'schedule'],
        rationale: 'Scheduled-work identity terms broaden delayed-job recall.',
        sourceReference: {
          sourceKind: 'taxonomy-concept-definition',
          sourceId: 'delayed-jobs',
        },
      },
      {
        sourceConceptId: 'retries',
        relationshipKind: 'related-identity-term',
        targetTerms: ['backoff'],
        rationale: 'A second source proves expansion remains one hop.',
        sourceReference: {
          sourceKind: 'taxonomy-concept-definition',
          sourceId: 'retries',
        },
      },
      {
        sourceConceptId: 'token-bucket',
        relationshipKind: 'related-identity-term',
        targetTerms: ['bucket', 'limiter'],
        rationale: 'Bounded implementation terms broaden token-bucket recall.',
        sourceReference: {
          sourceKind: 'taxonomy-concept-definition',
          sourceId: 'token-bucket',
        },
      },
    ],
    releaseMetadata: {
      name: 'Synthetic retrieval expansion',
      notes: 'Unit-only source for deterministic expansion behavior.',
    },
  };
}
