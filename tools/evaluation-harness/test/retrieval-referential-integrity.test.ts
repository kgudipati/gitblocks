import { describe, expect, it } from 'vitest';

import { loadRetrievalCorpusV1 } from '../src/retrieval/corpus.ts';
import { createRetrievalSchemaRegistry } from '../src/retrieval/schema-registry.ts';
import {
  createRetrievalRepositoryFixture,
  mutateRetrievalDocument,
  readFixtureJson,
} from './retrieval-test-fixtures.ts';

describe('retrieval separated-gold referential integrity', () => {
  it('fails closed for normalization, clarification, projection, relevance, no-result, and equivalence drift', () => {
    const mutations: readonly [
      string,
      (value: Record<string, unknown>) => Record<string, unknown>,
    ][] = [
      [
        'gold/normalization/ret-authorization-01.json',
        (value) => ({
          ...value,
          expected: {
            ...(value['expected'] as Record<string, unknown>),
            primaryFamily: 'webhooks',
          },
        }),
      ],
      [
        'gold/normalization/norm-authorization-03.json',
        (value) => ({
          ...value,
          expected: {
            ...(value['expected'] as Record<string, unknown>),
            normalizedConstraints: (
              (value['expected'] as Record<string, unknown>)[
                'normalizedConstraints'
              ] as Record<string, unknown>[]
            ).map((constraint, index) =>
              index === 0
                ? { ...constraint, modality: 'preferred' }
                : constraint,
            ),
          },
        }),
      ],
      [
        'gold/normalization/norm-authorization-04.json',
        (value) => ({
          ...value,
          expected: {
            ...(value['expected'] as Record<string, unknown>),
            unresolved: [],
          },
        }),
      ],
      [
        'gold/normalization/norm-audit-logging-04.json',
        (value) => ({
          ...value,
          expected: {
            ...(value['expected'] as Record<string, unknown>),
            outcome: 'normalized',
          },
        }),
      ],
      [
        'gold/clarification/norm-authorization-02.json',
        (value) => ({
          ...value,
          clarifications: [
            ...(value['clarifications'] as unknown[]),
            {
              reasonCode: 'unnecessary-clarification',
              sourceIds: ['norm-authorization-02-term-01'],
              possibleConceptIds: [],
            },
          ],
        }),
      ],
      [
        'gold/clarification/norm-authorization-02.json',
        (value) => ({
          ...value,
          clarifications: (value['clarifications'] as unknown[]).slice(1),
        }),
      ],
      [
        'gold/hard-filters/ret-authorization-01.json',
        (value) => ({
          ...value,
          laneCounts: {
            ...(value['laneCounts'] as Record<string, number>),
            eligible:
              ((value['laneCounts'] as Record<string, number>)['eligible'] ??
                0) + 1,
          },
        }),
      ],
      [
        'gold/hard-filters/ret-authorization-01.json',
        (value) => ({
          ...value,
          auditSample: (value['auditSample'] as Record<string, unknown>[]).map(
            (sample, index) =>
              index === 0 ? { ...sample, lane: 'evidence-needed' } : sample,
          ),
        }),
      ],
      [
        'gold/hard-filters/ret-authorization-01.json',
        (value) => ({
          ...value,
          profileAuthorityDigest: '0'.repeat(64),
        }),
      ],
      [
        'gold/hard-filters/ret-authorization-01.json',
        (value) => ({
          ...value,
          projectionDigest: '0'.repeat(64),
        }),
      ],
      [
        'gold/relevance/ret-authorization-01.json',
        (value) => ({
          ...value,
          judgments: (value['judgments'] as unknown[]).slice(1),
        }),
      ],
      [
        'gold/no-result/ret-authorization-05.json',
        (value) => ({
          ...value,
          expectedOutcome: 'eligible-candidates-present',
        }),
      ],
      [
        'equivalence.json',
        (value) => ({
          ...value,
          groups: [
            equivalenceGroup(['auth-casbin-casbin', 'unknown-candidate']),
          ],
        }),
      ],
    ];
    for (const [path, mutate] of mutations) {
      const root = createRetrievalRepositoryFixture();
      mutateRetrievalDocument(root, path, mutate);
      expect(loadRetrievalCorpusV1(root).ok, path).toBe(false);
    }
  }, 90_000);

  it('rejects audit roles that generated authority does not prove and duplicate samples', () => {
    const semanticRoot = createRetrievalRepositoryFixture();
    mutateRetrievalDocument(
      semanticRoot,
      'gold/hard-filters/ret-authorization-01.json',
      (value) => {
        const samples = value['auditSample'] as Record<string, unknown>[];
        const eligible = samples.find(
          ({ sampleRole }) => sampleRole === 'eligible',
        )!;
        const conflict = samples.find(
          ({ sampleRole }) => sampleRole === 'hard-conflict',
        )!;
        return {
          ...value,
          auditSample: samples.map((sample) =>
            sample === eligible
              ? {
                  ...sample,
                  candidateId: conflict['candidateId'],
                  hardState: conflict['hardState'],
                  lane: conflict['lane'],
                }
              : sample === conflict
                ? {
                    ...sample,
                    candidateId: eligible['candidateId'],
                    hardState: eligible['hardState'],
                    lane: eligible['lane'],
                  }
                : sample,
          ),
        };
      },
    );
    expect(loadRetrievalCorpusV1(semanticRoot).ok).toBe(false);

    const duplicateRoot = createRetrievalRepositoryFixture();
    mutateRetrievalDocument(
      duplicateRoot,
      'gold/hard-filters/ret-authorization-01.json',
      (value) => {
        const samples = value['auditSample'] as Record<string, unknown>[];
        return {
          ...value,
          auditSample: samples.map((sample, index) =>
            index === 1
              ? {
                  ...sample,
                  candidateId: samples[0]!['candidateId'],
                  hardState: samples[0]!['hardState'],
                  lane: samples[0]!['lane'],
                }
              : sample,
          ),
        };
      },
    );
    expect(loadRetrievalCorpusV1(duplicateRoot).ok).toBe(false);
  }, 60_000);

  it('rejects fabricated case balance and retrieval family assignment', () => {
    for (const removedTag of [
      'required-constraint',
      'preferred-constraint',
      'prohibited-constraint',
      'negative-control-safety',
      'evidence-needed',
      'same-family-comparison',
    ]) {
      const root = createRetrievalRepositoryFixture();
      const caseId =
        removedTag === 'preferred-constraint'
          ? 'ret-authorization-03'
          : removedTag === 'required-constraint' ||
              removedTag === 'prohibited-constraint' ||
              removedTag === 'evidence-needed'
            ? 'ret-authorization-05'
            : removedTag === 'negative-control-safety'
              ? 'ret-authorization-06'
              : removedTag === 'same-family-comparison'
                ? 'ret-authorization-04'
                : 'ret-authorization-04';
      mutateRetrievalDocument(
        root,
        'audit/case-classification.json',
        (value) => ({
          ...value,
          entries: (value['entries'] as Record<string, unknown>[]).map(
            (entry) =>
              entry['caseId'] === caseId
                ? {
                    ...entry,
                    classifications: (
                      entry['classifications'] as string[]
                    ).filter((classification) => classification !== removedTag),
                  }
                : entry,
          ),
        }),
      );
      expect(loadRetrievalCorpusV1(root).ok, removedTag).toBe(false);
    }

    const familyRoot = createRetrievalRepositoryFixture();
    mutateRetrievalDocument(
      familyRoot,
      'queries/retrieval/ret-authorization-01.json',
      (value) => ({ ...value, capabilityFamily: 'webhooks' }),
    );
    expect(loadRetrievalCorpusV1(familyRoot).ok).toBe(false);
  }, 60_000);

  it('rejects matrices, ranking labels, free-form judgments, review claims, and malformed equivalence', () => {
    const root = createRetrievalRepositoryFixture();
    const registry = createRetrievalSchemaRegistry(root);
    const relevance = readFixtureJson(
      root,
      'evals/retrieval-v1/gold/relevance/ret-authorization-01.json',
    ) as Record<string, unknown>;
    const judgments = relevance['judgments'] as Record<string, unknown>[];
    for (const value of [
      {
        ...relevance,
        judgments: [{ ...judgments[0], grade: 4 }, ...judgments.slice(1)],
      },
      { ...relevance, ranking: ['auth-open-policy-agent'] },
      { ...relevance, pairwisePreference: ['a', 'b'] },
      { ...relevance, rationale: 'free-form judgment' },
      { ...relevance, reviewerNote: 'not allowed' },
      {
        ...relevance,
        provenance: {
          status: 'accepted',
          reviewStatus: 'reviewed',
          reviewer: null,
          reviewedAt: null,
          reviewReference: null,
        },
      },
    ]) {
      expect(registry.validate('relevance-gold', value).length).toBeGreaterThan(
        0,
      );
    }

    const hardFilter = readFixtureJson(
      root,
      'evals/retrieval-v1/gold/hard-filters/ret-authorization-01.json',
    ) as Record<string, unknown>;
    expect(
      registry.validate('hard-filter-projection', {
        ...hardFilter,
        candidateMatrix: Array(150).fill('eligible'),
      }).length,
    ).toBeGreaterThan(0);

    const equivalence = readFixtureJson(
      root,
      'evals/retrieval-v1/equivalence.json',
    ) as Record<string, unknown>;
    const validGroup = equivalenceGroup([
      'auth-casbin-casbin',
      'auth-casbin-casbin-js',
    ]);
    for (const value of [
      {
        ...equivalence,
        groups: [{ ...validGroup, candidateIds: ['auth-casbin-casbin'] }],
      },
      {
        ...equivalence,
        groups: [
          {
            ...validGroup,
            candidateIds: ['auth-casbin-casbin', 'auth-casbin-casbin'],
          },
        ],
      },
      {
        ...equivalence,
        groups: [{ ...validGroup, relationshipKind: 'similar-name-only' }],
      },
      {
        ...equivalence,
        groups: [{ ...validGroup, inferredFromName: true }],
      },
      {
        ...equivalence,
        groups: [
          Object.fromEntries(
            Object.entries(validGroup).filter(([key]) => key !== 'provenance'),
          ),
        ],
      },
      {
        ...equivalence,
        groups: [{ ...validGroup, relationshipKind: 'ecosystem-companion' }],
      },
      {
        ...equivalence,
        groups: [{ ...validGroup, relationshipKind: 'functional-overlap' }],
      },
    ]) {
      expect(registry.validate('equivalence', value).length).toBeGreaterThan(0);
    }
  });

  it('allows empty real equivalence and rejects zero-positive cases and group collisions', () => {
    const registry = createRetrievalSchemaRegistry(
      createRetrievalRepositoryFixture(),
    );
    expect(
      registry.validate('equivalence', {
        equivalenceVersion: 'retrieval-equivalence-authority/1.0.0',
        catalogVersion: 'public-v1',
        catalogDigest: 'a'.repeat(64),
        groups: [],
        provenance: proposedProvenance(),
      }),
    ).toEqual([]);
    const relevanceRoot = createRetrievalRepositoryFixture();
    mutateRetrievalDocument(
      relevanceRoot,
      'gold/relevance/ret-authorization-01.json',
      (value) => ({
        ...value,
        judgments: (value['judgments'] as Record<string, unknown>[]).map(
          (judgment) => ({ ...judgment, grade: 0 }),
        ),
      }),
    );
    expect(loadRetrievalCorpusV1(relevanceRoot).ok).toBe(false);

    const duplicateRoot = createRetrievalRepositoryFixture();
    mutateRetrievalDocument(
      duplicateRoot,
      'gold/relevance/ret-authorization-01.json',
      (value) => {
        const judgments = value['judgments'] as Record<string, unknown>[];
        return {
          ...value,
          judgments: [judgments[0], judgments[0], ...judgments.slice(2)],
        };
      },
    );
    expect(loadRetrievalCorpusV1(duplicateRoot).ok).toBe(false);

    const first = equivalenceGroup([
      'auth-casbin-casbin',
      'auth-casbin-casbin-js',
    ]);
    const second = {
      ...equivalenceGroup(['auth-cerbos-cerbos', 'auth-koa-roles']),
      groupId: 'equiv-second',
    };
    for (const groups of [
      [
        first,
        { ...second, candidateIds: ['auth-casbin-casbin', 'auth-koa-roles'] },
      ],
      [first, { ...second, groupId: first.groupId }],
      [{ ...first, candidateIds: [...first.candidateIds].reverse() }],
    ]) {
      const root = createRetrievalRepositoryFixture();
      mutateRetrievalDocument(root, 'equivalence.json', (value) => ({
        ...value,
        groups,
      }));
      expect(loadRetrievalCorpusV1(root).ok).toBe(false);
    }
  }, 30_000);
});

function proposedProvenance() {
  return {
    status: 'proposed',
    reviewStatus: 'not-reviewed',
    reviewer: null,
    reviewedAt: null,
    reviewReference: null,
  };
}

function equivalenceGroup(candidateIds: readonly string[]) {
  return {
    groupId: 'equiv-fixture',
    relationshipKind: 'actual-fork',
    candidateIds: [...candidateIds],
    provenance: proposedProvenance(),
  };
}
