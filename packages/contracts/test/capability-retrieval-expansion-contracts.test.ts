import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  buildCapabilityRetrievalExpansionV1,
  capabilityRetrievalExpansionSemanticDigest,
  parseCapabilityRetrievalExpansionSourceV1,
  parseCapabilityRetrievalExpansionV1,
  parseCapabilityTaxonomyV1,
  serializeCapabilityRetrievalExpansionV1,
  type CapabilityRetrievalExpansionSourceV1,
  type CapabilityRetrievalExpansionV1,
  type CapabilityTaxonomyV1,
} from '../src/index.ts';

const sourcePath = fileURLToPath(
  new URL(
    '../../../catalog/capability-retrieval-expansion/1.0.0/source.json',
    import.meta.url,
  ),
);
const manifestPath = fileURLToPath(
  new URL(
    '../../../catalog/capability-retrieval-expansion/1.0.0/manifest.json',
    import.meta.url,
  ),
);
const taxonomyPath = fileURLToPath(
  new URL(
    '../../../catalog/capability-taxonomy/1.0.0/manifest.json',
    import.meta.url,
  ),
);

let source: CapabilityRetrievalExpansionSourceV1;
let authority: CapabilityRetrievalExpansionV1;
let taxonomy: CapabilityTaxonomyV1;

beforeAll(async () => {
  const parsedSource = parseCapabilityRetrievalExpansionSourceV1(
    JSON.parse(await readFile(sourcePath, 'utf8')) as unknown,
  );
  const parsedAuthority = parseCapabilityRetrievalExpansionV1(
    JSON.parse(await readFile(manifestPath, 'utf8')) as unknown,
  );
  const parsedTaxonomy = parseCapabilityTaxonomyV1(
    JSON.parse(await readFile(taxonomyPath, 'utf8')) as unknown,
  );
  if (!parsedSource.ok || !parsedAuthority.ok || !parsedTaxonomy.ok) {
    throw new Error('Committed retrieval-expansion authority is invalid.');
  }
  source = parsedSource.value;
  authority = parsedAuthority.value;
  taxonomy = parsedTaxonomy.value;
});

describe('capability retrieval expansion authority', () => {
  it('reproduces the committed taxonomy-bound authority exactly', async () => {
    expect(authority).toMatchObject({
      expansionVersion: 'capability-retrieval-expansion/1.0.0',
      taxonomyVersion: '1.0.0',
      taxonomySemanticDigest:
        '838fa85b2e6937866854b6f733fe7045cf49d5f811cb5e4a8d503bfbd76a61c9',
      semanticDigest:
        '0068e4e007ce87abd3bf80fed0918b04d9f225a0c32a1aa924a1284865c54948',
    });
    expect(authority.edges).toHaveLength(170);
    expect(
      new Set(authority.edges.map(({ sourceConceptId }) => sourceConceptId))
        .size,
    ).toBe(55);
    expect(buildCapabilityRetrievalExpansionV1(source, taxonomy)).toEqual(
      authority,
    );
    expect(serializeCapabilityRetrievalExpansionV1(authority)).toBe(
      await readFile(manifestPath, 'utf8'),
    );
  });

  it('contains reviewed documentation language for every baseline concept that previously had no corpus match', () => {
    const addedTerms = Object.fromEntries(
      source.rules
        .filter(({ sourceConceptId }) =>
          [
            'external-hosted-service',
            'framework-authorization-middleware',
            'job-uniqueness-deduplication',
            'rate-limit-failure-mode',
            'replay-protection',
            'sensitive-field-handling',
            'webhook-idempotency',
          ].includes(sourceConceptId),
        )
        .map(({ sourceConceptId, targetTerms }) => [
          sourceConceptId,
          targetTerms,
        ]),
    );

    expect(addedTerms).toEqual({
      'external-hosted-service': ['cloud-hosted'],
      'framework-authorization-middleware': [
        'guard',
        'guards',
        'middleware',
        'middlewares',
      ],
      'job-uniqueness-deduplication': [
        'deduplicate',
        'deduplicated',
        'deduplication',
        'idempotent',
        'unique',
      ],
      'rate-limit-failure-mode': [
        'failover',
        'insurance',
        'passonstoreerror',
        'skiponerror',
        'unavailable',
      ],
      'replay-protection': ['replay', 'tolerance'],
      'sensitive-field-handling': [
        'masked',
        'masking',
        'redact',
        'redacted',
        'redaction',
      ],
      'webhook-idempotency': [
        'duplicate',
        'duplication',
        'idempotent',
        'idempotency',
      ],
    });
  });

  it('keeps source and generated authority closed, bounded, and exact-versioned', () => {
    expect(
      parseCapabilityRetrievalExpansionSourceV1({ ...source, unknown: true })
        .ok,
    ).toBe(false);
    expect(
      parseCapabilityRetrievalExpansionSourceV1({
        ...source,
        expansionVersion: 'capability-retrieval-expansion/1.0.1',
      }).ok,
    ).toBe(false);
    expect(
      parseCapabilityRetrievalExpansionSourceV1({
        ...source,
        rules: [
          {
            ...source.rules[0]!,
            targetTerms: Array.from(
              { length: 9 },
              (_, index) => `bounded-term-${String(index)}`,
            ),
          },
        ],
      }).ok,
    ).toBe(false);
    expect(
      parseCapabilityRetrievalExpansionV1({ ...authority, unknown: true }).ok,
    ).toBe(false);
    expect(
      parseCapabilityRetrievalExpansionV1({
        ...authority,
        semanticDigest: '0'.repeat(64),
      }).ok,
    ).toBe(false);
  });

  it('rejects duplicate sources, unknown concepts, alias-inclusive overflow, and reordered edges', () => {
    expect(
      parseCapabilityRetrievalExpansionSourceV1({
        ...source,
        rules: [source.rules[0]!, source.rules[0]!],
      }).ok,
    ).toBe(false);
    expect(() =>
      buildCapabilityRetrievalExpansionV1(
        {
          ...source,
          rules: [
            {
              ...source.rules[0]!,
              sourceConceptId: 'not-a-taxonomy-concept',
              sourceReference: {
                sourceKind: 'taxonomy-concept-definition',
                sourceId: 'not-a-taxonomy-concept',
              },
            },
          ],
        },
        taxonomy,
      ),
    ).toThrow('Capability retrieval expansion source is invalid.');
    expect(() =>
      buildCapabilityRetrievalExpansionV1(
        {
          ...source,
          rules: [
            {
              sourceConceptId: 'delayed-jobs',
              relationshipKind: 'related-identity-term',
              targetTerms: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'],
              rationale:
                'The active alias makes the generated edge count exceed eight.',
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
    expect(
      parseCapabilityRetrievalExpansionV1({
        ...authority,
        edges: [...authority.edges].reverse(),
      }).ok,
    ).toBe(false);
  });

  it('binds every semantic edge while excluding release presentation metadata', () => {
    const changedEdge = structuredClone(authority);
    changedEdge.edges[0]!.rationale = 'A different semantic rationale.';
    const releaseOnly = {
      ...authority,
      releaseMetadata: {
        ...authority.releaseMetadata,
        notes: 'Different non-semantic release notes.',
      },
    };

    expect(capabilityRetrievalExpansionSemanticDigest(changedEdge)).not.toBe(
      authority.semanticDigest,
    );
    expect(capabilityRetrievalExpansionSemanticDigest(releaseOnly)).toBe(
      authority.semanticDigest,
    );
  });

  it('contains no evaluation, candidate-boost, or model authority', () => {
    const serialized = JSON.stringify({ source, authority });
    for (const prohibited of [
      'caseId',
      'candidateId',
      'relevanceGrade',
      'noEligibleCandidate',
      'equivalenceGroup',
      'baselineOutput',
      'modelOutput',
      'ret-audit',
      'ret-authorization',
    ]) {
      expect(serialized).not.toContain(prohibited);
    }
    expect(serialized).not.toMatch(/\b(?:norm|ret)-[a-z0-9-]+/u);
  });
});
