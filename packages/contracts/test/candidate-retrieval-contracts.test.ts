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
  parseCapabilityTaxonomyV1,
  parseDeterministicCandidateProfileAuthorityV1,
  serializeCandidateRetrievalRequestV1,
  serializeCandidateRetrievalResultV1,
  serializeContractSchemaV1,
  validateCandidateRetrievalExchangeV1,
  type CandidateRetrievalRequestV1,
  type CandidateRetrievalResultV1,
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

let taxonomy: CapabilityTaxonomyV1;
let profiles: DeterministicCandidateProfileAuthorityV1;
let request: CandidateRetrievalRequestV1;
let result: CandidateRetrievalResultV1;

beforeAll(async () => {
  const parsedTaxonomy = parseCapabilityTaxonomyV1(
    JSON.parse(await readFile(taxonomyPath, 'utf8')) as unknown,
  );
  const parsedProfiles = parseDeterministicCandidateProfileAuthorityV1(
    JSON.parse(await readFile(profilesPath, 'utf8')) as unknown,
  );
  if (!parsedTaxonomy.ok || !parsedProfiles.ok) {
    throw new Error('Committed retrieval authority is invalid.');
  }
  taxonomy = parsedTaxonomy.value;
  profiles = parsedProfiles.value;
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
      activeChannelCount: 5,
      candidateChannelMatches: 1,
      negativeControlsExcluded: 10,
      exactRepositoryIdentityGroups: 0,
      exactPackageIdentityGroups: 0,
      exactIdentityDuplicatesRemoved: 0,
      eligibleCandidatesTruncated: 119,
      evidenceNeededCandidatesTruncated: 0,
    },
  });
}, 60_000);

describe('candidate retrieval product contracts', () => {
  it('accepts valid request/result roots and their exact exchange', () => {
    expect(parseCandidateRetrievalRequestV1(request).ok).toBe(true);
    expect(parseCandidateRetrievalResultV1(result).ok).toBe(true);
    expect(validateCandidateRetrievalExchangeV1(request, result).ok).toBe(true);
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
    };
    expect(parseCandidateRetrievalResultV1(badProvenance).ok).toBe(false);

    const badFieldProvenance = structuredClone(result);
    badFieldProvenance.eligibleCandidates[0]!.matchedProfileFieldIds = [
      'not-a-profile-field',
    ] as never;
    expect(parseCandidateRetrievalResultV1(badFieldProvenance).ok).toBe(false);
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
