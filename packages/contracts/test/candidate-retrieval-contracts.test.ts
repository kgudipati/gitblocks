import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS,
  CONTRACT_VERSION,
  createCandidateRetrievalRequestV1,
  createCandidateRetrievalResultV1,
  normalizeCapabilityQueryV1,
  parseCandidateRetrievalRequestV1,
  parseCandidateRetrievalResultV1,
  parseCapabilityRetrievalExpansionV1,
  parseCapabilityTaxonomyV1,
  parseDeterministicCandidateProfileAuthorityV1,
  serializeCandidateRetrievalRequestV1,
  serializeCandidateRetrievalResultV1,
  serializeContractSchemaV1,
  validateCandidateRetrievalExchangeV1,
  type CandidateRetrievalRequestV1,
  type CandidateRetrievalResultV1,
  type CapabilityRetrievalExpansionV1,
  type CapabilityTaxonomyV1,
  type DeterministicCandidateProfileAuthorityV1,
  type EligibleRetrievalCandidateV1,
  type EvidenceNeededRetrievalCandidateV1,
} from '../src/index.ts';
import { CANDIDATE_CONSTRAINT_EVALUATION_VERSION } from '@gitblocks/domain';

const taxonomyPath = fileURLToPath(
  new URL(
    '../../../catalog/capability-taxonomy/1.0.0/manifest.json',
    import.meta.url,
  ),
);
const profilesPath = fileURLToPath(
  new URL(
    '../../../catalog/public-v1/candidate-profile-authority.json',
    import.meta.url,
  ),
);
const expansionPath = fileURLToPath(
  new URL(
    '../../../catalog/capability-retrieval-expansion/1.0.0/manifest.json',
    import.meta.url,
  ),
);

let taxonomy: CapabilityTaxonomyV1;
let profiles: DeterministicCandidateProfileAuthorityV1;
let expansion: CapabilityRetrievalExpansionV1;
let request: CandidateRetrievalRequestV1;
let result: CandidateRetrievalResultV1;

beforeAll(async () => {
  const parsedTaxonomy = parseCapabilityTaxonomyV1(
    JSON.parse(await readFile(taxonomyPath, 'utf8')) as unknown,
  );
  const parsedProfiles = parseDeterministicCandidateProfileAuthorityV1(
    JSON.parse(await readFile(profilesPath, 'utf8')) as unknown,
  );
  const parsedExpansion = parseCapabilityRetrievalExpansionV1(
    JSON.parse(await readFile(expansionPath, 'utf8')) as unknown,
  );
  if (!parsedTaxonomy.ok || !parsedProfiles.ok || !parsedExpansion.ok) {
    throw new Error('Committed retrieval authority is invalid.');
  }
  taxonomy = parsedTaxonomy.value;
  profiles = parsedProfiles.value;
  expansion = parsedExpansion.value;
  const normalized = normalizeCapabilityQueryV1(
    {
      contractVersion: CONTRACT_VERSION,
      queryInputId: 'retrieval-contract-query',
      scope: 'local-pre-approval',
      summary: 'Retrieve authorization candidates.',
      capabilityTerms: [
        { termId: 'capability-one', originalTerm: 'authorization' },
      ],
      successConditions: [
        {
          conditionId: 'success-one',
          statement: 'Return plausible authorization candidates.',
        },
      ],
      draftConstraints: [],
      candidateReferences: [],
      repositoryFingerprintReference: null,
    },
    taxonomy,
  );
  if (!normalized.ok) throw new Error('Retrieval contract query failed.');
  request = createCandidateRetrievalRequestV1({
    normalization: normalized.value,
    authorityBindings: {
      taxonomy: {
        taxonomyVersion: taxonomy.taxonomyVersion,
        taxonomySemanticDigest: taxonomy.semanticDigest,
      },
      candidateProfiles: {
        authorityVersion: profiles.authorityVersion,
        semanticAuthorityDigest: profiles.semanticAuthorityDigest,
        profileRulesVersion: profiles.profileRulesVersion,
      },
      catalog: {
        catalogVersion: profiles.catalogVersion,
        catalogDigest: profiles.catalogDigest,
      },
      candidateConstraintEvaluationVersion:
        CANDIDATE_CONSTRAINT_EVALUATION_VERSION,
      retrievalExpansion: {
        authorityVersion: expansion.expansionVersion,
        semanticDigest: expansion.semanticDigest,
      },
      retrievalMetadata: {
        authorityVersion: 'candidate-retrieval-metadata-authority/1.1.0',
        authoritySemanticDigest:
          '23c38be5e5b117c74832049ae58f455f4fd1731e167cf170038da516c44e5ef1',
      },
    },
    eligibleResultLimit: 10,
    evidenceNeededResultLimit: 10,
  });
  result = createCandidateRetrievalResultV1({
    retrievalRequestId: request.retrievalRequestId,
    normalizationId: request.normalization.normalizationId,
    normalizationSemanticDigest: request.normalization.semanticDigest,
    authorityBindings: request.authorityBindings,
    channelBindings: CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS.map((binding) => ({
      ...binding,
    })),
    eligibleResultLimit: 10,
    evidenceNeededResultLimit: 10,
    preRetrievalLaneCounts: {
      eligible: 120,
      'evidence-needed': 0,
      excluded: 30,
    },
    eligibleCandidates: [eligibleCandidate('auth-aserto-topaz')],
    evidenceNeededCandidates: [],
    diagnostics: {
      candidatesExamined: 150,
      candidatesConstraintEvaluated: 150,
      activeChannelCount: 6,
      candidateChannelMatches: 1,
      negativeControlsExcluded: 10,
      exactRepositoryIdentityGroups: 0,
      exactPackageIdentityGroups: 0,
      exactIdentityDuplicatesRemoved: 0,
      eligibleCandidatesTruncated: 119,
      evidenceNeededCandidatesTruncated: 0,
      expansionSourceConcepts: 0,
      expansionEdgesApplied: 0,
      expansionEdgesTruncated: 0,
      candidateExpansionMatches: 0,
    },
  });
}, 60_000);

describe('candidate retrieval product contracts', () => {
  it('accepts valid request/result roots and their exact exchange', () => {
    expect(parseCandidateRetrievalRequestV1(request).ok).toBe(true);
    expect(parseCandidateRetrievalResultV1(result).ok).toBe(true);
    expect(validateCandidateRetrievalExchangeV1(request, result).ok).toBe(true);
    expect(request.retrievalRequestVersion).toBe(
      'candidate-retrieval-request/1.2.0',
    );
    expect(result.retrievalResultVersion).toBe(
      'candidate-retrieval-result/1.3.0',
    );
    expect(result.retrievalAlgorithmVersion).toBe(
      'deterministic-candidate-retrieval/1.3.0',
    );
    expect(result.channelBindings).toEqual([
      {
        channelId: 'capability-family',
        channelVersion: 'capability-family/1.0.0',
      },
      {
        channelId: 'taxonomy-concept',
        channelVersion: 'taxonomy-concept/1.0.0',
      },
      {
        channelId: 'candidate-identity',
        channelVersion: 'candidate-identity/1.2.0',
      },
      {
        channelId: 'package-identity',
        channelVersion: 'package-identity/1.1.0',
      },
      {
        channelId: 'structured-profile',
        channelVersion: 'structured-profile/1.0.0',
      },
      {
        channelId: 'approved-metadata-lexical',
        channelVersion: 'approved-metadata-lexical/1.0.0',
      },
    ]);
    expect(request.authorityBindings.retrievalExpansion).toEqual({
      authorityVersion: 'capability-retrieval-expansion/1.0.0',
      semanticDigest:
        '1435521e117e2af18ec55bbf1f30e3f5d2f48fe07d54f0c657917ff027086f4a',
    });
    expect(request.authorityBindings.retrievalMetadata).toEqual({
      authorityVersion: 'candidate-retrieval-metadata-authority/1.1.0',
      authoritySemanticDigest:
        '23c38be5e5b117c74832049ae58f455f4fd1731e167cf170038da516c44e5ef1',
    });
  });

  it('changes request identity when only the metadata snapshot digest changes', () => {
    const changed = createCandidateRetrievalRequestV1({
      normalization: request.normalization,
      authorityBindings: {
        ...request.authorityBindings,
        retrievalMetadata: {
          ...request.authorityBindings.retrievalMetadata,
          authoritySemanticDigest: '0'.repeat(64),
        },
      },
      eligibleResultLimit: request.eligibleResultLimit,
      evidenceNeededResultLimit: request.evidenceNeededResultLimit,
    });
    expect(changed.normalization.semanticDigest).toBe(
      request.normalization.semanticDigest,
    );
    expect(changed.retrievalRequestId).not.toBe(request.retrievalRequestId);
  });

  it('echoes the metadata authority binding and rejects exchange disagreement', () => {
    const disagreeing = createCandidateRetrievalResultV1({
      retrievalRequestId: request.retrievalRequestId,
      normalizationId: request.normalization.normalizationId,
      normalizationSemanticDigest: request.normalization.semanticDigest,
      authorityBindings: {
        ...request.authorityBindings,
        retrievalMetadata: {
          ...request.authorityBindings.retrievalMetadata,
          authoritySemanticDigest: '0'.repeat(64),
        },
      },
      channelBindings: CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS.map((binding) => ({
        ...binding,
      })),
      eligibleResultLimit: 10,
      evidenceNeededResultLimit: 10,
      preRetrievalLaneCounts: result.preRetrievalLaneCounts,
      eligibleCandidates: result.eligibleCandidates,
      evidenceNeededCandidates: result.evidenceNeededCandidates,
      diagnostics: result.diagnostics,
    });
    expect(
      disagreeing.authorityBindings.retrievalMetadata.authoritySemanticDigest,
    ).toBe('0'.repeat(64));
    expect(validateCandidateRetrievalExchangeV1(request, disagreeing).ok).toBe(
      false,
    );
  });

  it('enforces metadata-only bounded provenance and exact component accounting', () => {
    const metadataCandidate: EligibleRetrievalCandidateV1 = {
      candidateId: 'auth-aserto-topaz',
      lane: 'eligible',
      retrievalScore: 400,
      matchedCapabilityConceptIds: [],
      matchedProfileFieldIds: [],
      channelMatches: [
        {
          channelId: 'approved-metadata-lexical',
          channelVersion: 'approved-metadata-lexical/1.0.0',
          componentScore: 400,
          matchedCapabilityConceptIds: [],
          matchedProfileFieldIds: [],
          matchedExpansionEdgeIds: [],
          matchedMetadataTerms: [
            { normalizedTerm: 'authorization', source: 'topic', points: 300 },
            {
              normalizedTerm: 'policy-engine',
              source: 'description',
              points: 100,
            },
          ],
        },
      ],
      unresolvedHardEvaluations: [],
    };
    expect(resultWithCandidate(metadataCandidate)).toMatchObject({
      eligibleCandidates: [metadataCandidate],
    });

    expect(() =>
      resultWithCandidate({
        ...metadataCandidate,
        retrievalScore: 300,
        channelMatches: [
          {
            ...metadataCandidate.channelMatches[0]!,
            componentScore: 300,
            matchedMetadataTerms: [],
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      resultWithCandidate({
        ...metadataCandidate,
        channelMatches: [
          {
            ...metadataCandidate.channelMatches[0]!,
            matchedExpansionEdgeIds: ['metadata-must-not-claim-expansion'],
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      resultWithCandidate({
        ...metadataCandidate,
        retrievalScore: 200,
        channelMatches: [
          {
            ...metadataCandidate.channelMatches[0]!,
            componentScore: 200,
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      resultWithCandidate({
        ...eligibleCandidate('auth-aserto-topaz'),
        channelMatches: [
          {
            ...eligibleCandidate('auth-aserto-topaz').channelMatches[0]!,
            matchedMetadataTerms: [
              {
                normalizedTerm: 'authorization',
                source: 'description',
                points: 100,
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });

  it('requires a normalized outcome and exact authority bindings', () => {
    expect(
      parseCandidateRetrievalRequestV1({
        ...request,
        normalization: {
          ...request.normalization,
          outcome: 'clarification-required',
          primaryFamilyId: null,
        },
      }).ok,
    ).toBe(false);
    expect(
      parseCandidateRetrievalRequestV1({
        ...request,
        authorityBindings: {
          ...request.authorityBindings,
          taxonomy: {
            ...request.authorityBindings.taxonomy,
            taxonomySemanticDigest: '0'.repeat(64),
          },
        },
      }).ok,
    ).toBe(false);
  });

  it('rejects normalized target-codebase fingerprint state', () => {
    const normalized = normalizeCapabilityQueryV1(
      {
        contractVersion: CONTRACT_VERSION,
        queryInputId: 'retrieval-target-query',
        scope: 'local-pre-approval',
        summary: 'Retrieve authorization candidates.',
        capabilityTerms: [
          { termId: 'capability-one', originalTerm: 'authorization' },
        ],
        successConditions: [
          {
            conditionId: 'success-one',
            statement: 'Return plausible authorization candidates.',
          },
        ],
        draftConstraints: [],
        candidateReferences: [],
        repositoryFingerprintReference: {
          fingerprintId: 'target-fingerprint',
          fingerprintDigest: 'a'.repeat(64),
        },
      },
      taxonomy,
    );
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    expect(() =>
      createCandidateRetrievalRequestV1({
        normalization: normalized.value,
        authorityBindings: request.authorityBindings,
        eligibleResultLimit: 10,
        evidenceNeededResultLimit: 10,
      }),
    ).toThrow('Candidate retrieval request is invalid.');
  });

  it.each([0, 11])('rejects lane limit %s', (limit) => {
    expect(
      parseCandidateRetrievalRequestV1({
        ...request,
        eligibleResultLimit: limit,
      }).ok,
    ).toBe(false);
  });

  it.each([1, 10])('accepts explicit lane limit %s', (limit) => {
    const candidate = createCandidateRetrievalRequestV1({
      normalization: request.normalization,
      authorityBindings: request.authorityBindings,
      eligibleResultLimit: limit,
      evidenceNeededResultLimit: limit,
    });
    expect(parseCandidateRetrievalRequestV1(candidate).ok).toBe(true);
  });

  it('rejects additional properties, invalid lanes, and malformed provenance', () => {
    expect(
      parseCandidateRetrievalRequestV1({ ...request, rawQuery: 'unsafe' }).ok,
    ).toBe(false);
    expect(
      parseCandidateRetrievalRequestV1({
        ...request,
        normalization: {
          ...request.normalization,
          normalizedCapabilityConcepts: Array.from(
            { length: 9 },
            (_, index) => ({
              conceptId: `oversized-${String(index)}`,
              sourceTermIds: ['capability-one'],
              ruleId: 'oversized-request-test',
            }),
          ),
        },
      }).ok,
    ).toBe(false);
    const candidate = structuredClone(result);
    candidate.eligibleCandidates[0] = {
      ...candidate.eligibleCandidates[0]!,
      lane: 'evidence-needed',
    } as never;
    expect(parseCandidateRetrievalResultV1(candidate).ok).toBe(false);

    const badProvenance = structuredClone(result);
    badProvenance.eligibleCandidates[0]!.channelMatches[0] = {
      ...badProvenance.eligibleCandidates[0]!.channelMatches[0]!,
      channelVersion: 'package-identity/1.0.0',
    } as never;
    expect(parseCandidateRetrievalResultV1(badProvenance).ok).toBe(false);

    const badFieldProvenance = structuredClone(result);
    badFieldProvenance.eligibleCandidates[0]!.matchedProfileFieldIds = [
      'not-a-profile-field',
    ] as never;
    expect(parseCandidateRetrievalResultV1(badFieldProvenance).ok).toBe(false);

    const badExpansionProvenance = structuredClone(result);
    badExpansionProvenance.eligibleCandidates[0]!.channelMatches[0]!.matchedExpansionEdgeIds =
      ['expansion-edge-0123456789abcdef0123456789abcdef'];
    expect(parseCandidateRetrievalResultV1(badExpansionProvenance).ok).toBe(
      false,
    );
  });

  it('rejects lane count sum and returned-array bound disagreement', () => {
    expect(
      parseCandidateRetrievalResultV1({
        ...result,
        preRetrievalLaneCounts: {
          ...result.preRetrievalLaneCounts,
          excluded: 29,
        },
      }).ok,
    ).toBe(false);
    expect(
      parseCandidateRetrievalResultV1({
        ...result,
        eligibleResultLimit: 1,
        eligibleCandidates: [
          eligibleCandidate('candidate-one'),
          eligibleCandidate('candidate-two'),
        ],
      }).ok,
    ).toBe(false);
  });

  it('accepts the exact 20-result maximum and rejects 11 in either lane', () => {
    const tenEligible = Array.from({ length: 10 }, (_, index) =>
      eligibleCandidate(`eligible-${String(index).padStart(2, '0')}`),
    );
    const tenEvidence = Array.from({ length: 10 }, (_, index) =>
      evidenceCandidate(`evidence-${String(index).padStart(2, '0')}`),
    );
    const maximum = createCandidateRetrievalResultV1({
      retrievalRequestId: request.retrievalRequestId,
      normalizationId: request.normalization.normalizationId,
      normalizationSemanticDigest: request.normalization.semanticDigest,
      authorityBindings: request.authorityBindings,
      channelBindings: CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS.map((binding) => ({
        ...binding,
      })),
      eligibleResultLimit: 10,
      evidenceNeededResultLimit: 10,
      preRetrievalLaneCounts: {
        eligible: 100,
        'evidence-needed': 20,
        excluded: 30,
      },
      eligibleCandidates: tenEligible,
      evidenceNeededCandidates: tenEvidence,
      diagnostics: {
        ...result.diagnostics,
        candidateChannelMatches: 20,
        eligibleCandidatesTruncated: 90,
        evidenceNeededCandidatesTruncated: 10,
      },
    });
    expect(maximum.eligibleCandidates).toHaveLength(10);
    expect(maximum.evidenceNeededCandidates).toHaveLength(10);
    expect(
      parseCandidateRetrievalResultV1({
        ...maximum,
        eligibleCandidates: [
          ...maximum.eligibleCandidates,
          eligibleCandidate('eligible-extra'),
        ],
      }).ok,
    ).toBe(false);
  });

  it('serializes roots and JSON Schemas byte-deterministically', () => {
    expect(serializeCandidateRetrievalRequestV1(request)).toBe(
      serializeCandidateRetrievalRequestV1(request),
    );
    expect(serializeCandidateRetrievalResultV1(result)).toBe(
      serializeCandidateRetrievalResultV1(result),
    );
    expect(serializeContractSchemaV1('candidate-retrieval-request')).toBe(
      serializeContractSchemaV1('candidate-retrieval-request'),
    );
    expect(serializeContractSchemaV1('candidate-retrieval-result')).toBe(
      serializeContractSchemaV1('candidate-retrieval-result'),
    );
  });

  it('rejects input mutation without mutating parsed owned values', () => {
    const supplied = structuredClone(request);
    const parsed = parseCandidateRetrievalRequestV1(supplied);
    expect(parsed.ok).toBe(true);
    supplied.normalization.normalizedCapabilityConcepts.length = 0;
    if (!parsed.ok) return;
    expect(
      parsed.value.normalization.normalizedCapabilityConcepts,
    ).not.toHaveLength(0);
  });
});

function resultWithCandidate(candidate: EligibleRetrievalCandidateV1) {
  return createCandidateRetrievalResultV1({
    retrievalRequestId: request.retrievalRequestId,
    normalizationId: request.normalization.normalizationId,
    normalizationSemanticDigest: request.normalization.semanticDigest,
    authorityBindings: request.authorityBindings,
    channelBindings: CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS.map((binding) => ({
      ...binding,
    })),
    eligibleResultLimit: 10,
    evidenceNeededResultLimit: 10,
    preRetrievalLaneCounts: {
      eligible: 1,
      'evidence-needed': 0,
      excluded: 149,
    },
    eligibleCandidates: [candidate],
    evidenceNeededCandidates: [],
    diagnostics: {
      ...result.diagnostics,
      candidateChannelMatches: candidate.channelMatches.length,
      eligibleCandidatesTruncated: 0,
    },
  });
}

function eligibleCandidate(candidateId: string): EligibleRetrievalCandidateV1 {
  return {
    candidateId,
    lane: 'eligible' as const,
    retrievalScore: 200,
    matchedCapabilityConceptIds: ['authorization'],
    matchedProfileFieldIds: ['capability-family'],
    channelMatches: [
      {
        channelId: 'capability-family' as const,
        channelVersion: 'capability-family/1.0.0' as const,
        componentScore: 200,
        matchedCapabilityConceptIds: ['authorization'],
        matchedProfileFieldIds: ['capability-family'],
        matchedExpansionEdgeIds: [],
        matchedMetadataTerms: [],
      },
    ],
    unresolvedHardEvaluations: [],
  };
}

function evidenceCandidate(
  candidateId: string,
): EvidenceNeededRetrievalCandidateV1 {
  return {
    ...eligibleCandidate(candidateId),
    lane: 'evidence-needed' as const,
    unresolvedHardEvaluations: [
      {
        evaluationId: 'required-deployment',
        sourceKind: 'normalized-constraint' as const,
        modality: 'required' as const,
        facet: 'deployment',
        conceptId: 'self-hosted-service',
        profileFieldId: 'deployment-self-hosting',
        match: 'unresolved' as const,
        state: 'unresolved' as const,
        ruleId: 'evaluate-deployment',
      },
    ],
  };
}
