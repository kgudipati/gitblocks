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
          groups: (value['groups'] as Record<string, unknown>[]).map(
            (group, index) =>
              index === 0
                ? {
                    ...group,
                    candidateIds: [
                      ...(group['candidateIds'] as string[]).slice(0, -1),
                      'unknown-candidate',
                    ].sort(),
                  }
                : group,
          ),
        }),
      ],
    ];
    for (const [path, mutate] of mutations) {
      const root = createRetrievalRepositoryFixture();
      mutateRetrievalDocument(root, path, mutate);
      expect(loadRetrievalCorpusV1(root).ok, path).toBe(false);
    }
  }, 90_000);

  it('rejects fabricated case balance and retrieval family assignment', () => {
    for (const removedTag of [
      'slot-exact-family',
      'required-constraint',
      'preferred-constraint',
      'prohibited-constraint',
      'negative-control-safety',
      'evidence-needed',
      'same-family-comparison',
    ]) {
      const root = createRetrievalRepositoryFixture();
      const path =
        removedTag === 'preferred-constraint'
          ? 'queries/retrieval/ret-authorization-03.json'
          : removedTag === 'required-constraint' ||
              removedTag === 'prohibited-constraint' ||
              removedTag === 'evidence-needed'
            ? 'queries/retrieval/ret-authorization-05.json'
            : removedTag === 'negative-control-safety'
              ? 'queries/retrieval/ret-authorization-06.json'
              : removedTag === 'same-family-comparison'
                ? 'queries/retrieval/ret-authorization-04.json'
                : 'queries/retrieval/ret-authorization-01.json';
      mutateRetrievalDocument(root, path, (value) => ({
        ...value,
        tags: (value['tags'] as string[]).filter((tag) => tag !== removedTag),
      }));
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
    const groups = equivalence['groups'] as Record<string, unknown>[];
    for (const value of [
      {
        ...equivalence,
        groups: [
          { ...groups[0], candidateIds: ['auth-casbin-casbin'] },
          ...groups.slice(1),
        ],
      },
      {
        ...equivalence,
        groups: [
          {
            ...groups[0],
            candidateIds: ['auth-casbin-casbin', 'auth-casbin-casbin'],
          },
          ...groups.slice(1),
        ],
      },
      {
        ...equivalence,
        groups: [
          { ...groups[0], relationshipKind: 'similar-name-only' },
          ...groups.slice(1),
        ],
      },
      {
        ...equivalence,
        groups: [{ ...groups[0], inferredFromName: true }, ...groups.slice(1)],
      },
      {
        ...equivalence,
        groups: [
          Object.fromEntries(
            Object.entries(groups[0]!).filter(([key]) => key !== 'provenance'),
          ),
          ...groups.slice(1),
        ],
      },
    ]) {
      expect(registry.validate('equivalence', value).length).toBeGreaterThan(0);
    }
  });

  it('rejects zero-positive ordinary cases and cross-group equivalence collisions', () => {
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

    for (const mutate of [
      (groups: Record<string, unknown>[]) => {
        const shared = (groups[0]!['candidateIds'] as string[])[0]!;
        return groups.map((group, index) =>
          index === 1
            ? {
                ...group,
                candidateIds: [
                  ...(group['candidateIds'] as string[]),
                  shared,
                ].sort(),
              }
            : group,
        );
      },
      (groups: Record<string, unknown>[]) =>
        groups.map((group, index) =>
          index === 1 ? { ...group, groupId: groups[0]!['groupId'] } : group,
        ),
      (groups: Record<string, unknown>[]) =>
        groups.map((group, index) =>
          index === 0
            ? {
                ...group,
                candidateIds: [
                  ...(group['candidateIds'] as string[]),
                ].reverse(),
              }
            : group,
        ),
    ]) {
      const root = createRetrievalRepositoryFixture();
      mutateRetrievalDocument(root, 'equivalence.json', (value) => ({
        ...value,
        groups: mutate(value['groups'] as Record<string, unknown>[]),
      }));
      expect(loadRetrievalCorpusV1(root).ok).toBe(false);
    }
  }, 30_000);
});
