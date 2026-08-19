import { createHash } from 'node:crypto';

import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

import * as publicApi from '../src/index.ts';
import {
  CONTRACT_SCHEMA_NAMES,
  getContractSchemaV1,
  parseFitAssessmentResponseV1,
  serializeContractSchemaV1,
  type JsonSchemaValue,
} from '../src/index.ts';
import { createFitAssessmentResponse } from './fixtures.ts';

const EXPECTED_SCHEMA_DIGESTS = {
  'candidate-dossier':
    'd16d0424ed45edcf61d8084cbd21ebbb396366522d1b1a425b6cf8405e0680af',
  'capability-request':
    '3d1f213efdacd6ff550a66a74703b94abc56aead59cdcb08b7a2769b5a5a1ab9',
  'capability-taxonomy':
    'd8d4c875fc38696e6ead9dcc2821e04754135aa4af71f0fb85198a98187d3f70',
  'capability-taxonomy-source':
    '357f34187ff26ea70c663f6009b07841b8045493ad54d2393713f7329a9e7933',
  'capability-query-input':
    'd48e018b71f8e6947f60f4d3559c48047daba8a335168b51f37bfb5199c81b9b',
  'capability-query-normalization-result':
    'bdd7db9510937c0728f87b0d83f75dbd374555fa17c2b1e4a56399d9f9f2d06b',
  'deterministic-candidate-profile':
    '3bbfdf2050c13a3d70e9dc289db7c8768a6fdcba8605cf12191e08560387af61',
  'deterministic-candidate-profile-authority':
    '7a79a1671bf461127099e3ae2f75d29e949387987041bd3402f2614b747ed8cf',
  'candidate-retrieval-request':
    '5dd7d06b5665baae17b8f25c5c6fcf900e1e9040dcda6f58597845549d488d51',
  'candidate-retrieval-result':
    '6f3ecfd01ac0688f31919377e807a44c143752179b6ae34849135fe908e123c1',
  'capability-retrieval-expansion':
    '65a22cfe825e42f729eb9eb07aaf0a1a0fcdb40dc043c24a5726548f2e99f73d',
  'capability-retrieval-expansion-source':
    'd7fc05ed58ee4021744865678affcddcbedf35781eb220c4b05f7e4ff3ea5a56',
  'candidate-retrieval-metadata-authority':
    '11c131ced446b072b715585aea9bdaca977190600903c53a6fb4bea4b45f8c13',
  'error-envelope':
    '7a708cc440a7992cb164715dce6029befbe78970c3283d8a1bff9298c87603d0',
  'fit-assessment-request':
    'c130a56044cbb043fac97e66db4c372d48990d672784b4abfde9ab9e78c9e504',
  'fit-assessment-response':
    '330b5b3940858428b1881701774bac785a7c93cf2d50e6dcb4ec37091a696a4d',
  'repository-artifact':
    '994643368bdc95a5279a2d939ec350ed65932ad16a3c937ae32f52ff87113d16',
  'repository-artifact-chunk':
    'd79d2803e3e11e83a9554eae4a38bba1bf379da6f767be402105cc3bf57508a6',
  'repository-artifact-set':
    '0d78814c3361e76e9d82c29cc6464fbedb3e6b761269dba3641c0e1c2c894e54',
  'repository-fingerprint':
    '73f42c7a7cd20de24372ecddb7afa33925ca1f4d67cb1f9598cd9d56ea87477c',
  'repository-interview-request':
    'c009494390484a40ace4eea9b58ba3b288cf0577c13aab926fb7e5cdcfb7c673',
  'model-execution':
    'f362632090107fc97b20708a24d5888f3d0e531f724887cc37dd5aa777a272b7',
  'repository-interview':
    '99c749af8dd7d907d0b84b8342297b59b1222f32011a598a753364d168f5a7eb',
  'oss-recommendation-request':
    '1225225d5815e3d858b16d23e974879456566973582d07e454c9e658a71a2da4',
  'target-fit-assessment-response':
    '51c7e8c46d8323e29fe02c674c74efece435acf372529c036e52a861f4f78428',
  'recommendation-assessment-response':
    'aa619df4638fc12d1ee8d77b5bf2552b6ba0a03fcb88e41cc0dd1ed051087d46',
  'recommendation-assessment-model-response':
    '05519e8895a317e5fccf7c04d2c2cca05b7c3a69553c719fce2ae273a151d067',
} as const;

describe('deterministic JSON Schema 2020-12 exports', () => {
  it('exports existing roots plus additive taxonomy, query, and profile roots', () => {
    expect(CONTRACT_SCHEMA_NAMES).toEqual([
      'candidate-dossier',
      'capability-request',
      'error-envelope',
      'fit-assessment-request',
      'fit-assessment-response',
      'repository-artifact',
      'repository-artifact-chunk',
      'repository-artifact-set',
      'repository-fingerprint',
      'repository-interview-request',
      'model-execution',
      'repository-interview',
      'capability-taxonomy',
      'capability-taxonomy-source',
      'capability-query-input',
      'capability-query-normalization-result',
      'deterministic-candidate-profile',
      'deterministic-candidate-profile-authority',
      'candidate-retrieval-request',
      'candidate-retrieval-result',
      'capability-retrieval-expansion',
      'capability-retrieval-expansion-source',
      'candidate-retrieval-metadata-authority',
      'oss-recommendation-request',
      'target-fit-assessment-response',
      'recommendation-assessment-response',
      'recommendation-assessment-model-response',
    ]);

    for (const name of CONTRACT_SCHEMA_NAMES) {
      const schema = getContractSchemaV1(name);
      expect(readProperty(schema, '$schema')).toBe(
        'https://json-schema.org/draft/2020-12/schema',
      );
      const version =
        name === 'candidate-retrieval-request'
          ? '1.2.0'
          : name === 'candidate-retrieval-result'
            ? '1.3.0'
            : name === 'candidate-retrieval-metadata-authority'
              ? '1.1.0'
              : '1.0.0';
      expect(readProperty(schema, '$id')).toBe(
        `https://gitblocks.dev/schemas/contracts/${name}/${version}`,
      );
    }
  });

  it('compiles every exported root in one strict Ajv2020 registry', () => {
    const ajv = new Ajv2020({
      allErrors: false,
      coerceTypes: false,
      messages: false,
      removeAdditional: false,
      strict: true,
      useDefaults: false,
      validateFormats: false,
      verbose: false,
    });

    for (const name of CONTRACT_SCHEMA_NAMES) {
      const schema = getContractSchemaV1(name);
      if (!isRecord(schema)) {
        throw new Error('Owned root schema must be an object.');
      }
      expect(() => ajv.compile({ ...schema })).not.toThrow();
    }
  }, 30_000);

  it('closes every object and contains no default insertion', () => {
    for (const name of CONTRACT_SCHEMA_NAMES) {
      walkSchema(getContractSchemaV1(name), (value) => {
        if (readProperty(value, 'type') === 'object') {
          expect(readProperty(value, 'additionalProperties')).toBe(false);
        }
        expect(hasProperty(value, 'default')).toBe(false);
      });
    }
  });

  it('requires every property in each repository-interview object', () => {
    for (const name of [
      'repository-interview-request',
      'model-execution',
      'repository-interview',
    ] as const) {
      walkSchema(getContractSchemaV1(name), (value) => {
        if (readProperty(value, 'type') !== 'object') {
          return;
        }
        const properties = readProperty(value, 'properties');
        const required = readProperty(value, 'required');
        if (
          properties === undefined ||
          required === undefined ||
          !isRecord(properties) ||
          !isSchemaArray(required)
        ) {
          throw new Error(
            'Repository-interview objects must declare required properties.',
          );
        }
        expect([...required].sort()).toEqual(Object.keys(properties).sort());
      });
    }
  });

  it('returns fresh artifacts that callers cannot use to mutate authority', () => {
    const first = getContractSchemaV1('capability-request');
    if (!isRecord(first)) {
      throw new Error('Capability-request schema must be an object.');
    }
    Reflect.set(first, 'title', 'caller mutation');

    expect(
      readProperty(getContractSchemaV1('capability-request'), 'title'),
    ).toBeUndefined();
  });

  it('detects exact artifact drift through committed serialization digests', () => {
    const actual = Object.fromEntries(
      CONTRACT_SCHEMA_NAMES.map((name) => [
        name,
        createHash('sha256')
          .update(serializeContractSchemaV1(name))
          .digest('hex'),
      ]),
    );

    expect(actual).toEqual(EXPECTED_SCHEMA_DIGESTS);
  });

  it('serializes canonically and newline-terminates each artifact', () => {
    for (const name of CONTRACT_SCHEMA_NAMES) {
      const first = serializeContractSchemaV1(name);
      const second = serializeContractSchemaV1(name);
      expect(first).toBe(second);
      expect(first.endsWith('\n')).toBe(true);
      expect(first).toBe(
        `${JSON.stringify(getContractSchemaV1(name), null, 2)}\n`,
      );
    }
  });

  it('does not expose evaluation-only result fields', () => {
    const productResult = createFitAssessmentResponse();
    const result = parseFitAssessmentResponseV1({
      ...productResult,
      schemaVersion: '1.0.0',
      caseId: 'evaluation-case',
      allowedAlternativeOutcomes: [],
      rationaleNotes: [],
      provenance: {
        status: 'proposed',
        independentReviewStatus: 'not-reviewed',
      },
    });

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.additional-property' }],
    });
  });

  it('keeps the runtime package surface narrow', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'CANDIDATE_RETRIEVAL_ALGORITHM_VERSION',
      'CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS',
      'CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_MAX_BYTES',
      'CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_VERSION',
      'CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT',
      'CANDIDATE_RETRIEVAL_METADATA_DESCRIPTION_MAX_CODE_UNITS',
      'CANDIDATE_RETRIEVAL_METADATA_LANGUAGE_MAX_CODE_UNITS',
      'CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_VERSION',
      'CANDIDATE_RETRIEVAL_METADATA_SOURCE_OPERATION',
      'CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_VERSION',
      'CANDIDATE_RETRIEVAL_METADATA_TOPIC_MAX_CODE_UNITS',
      'CANDIDATE_RETRIEVAL_METADATA_TOPIC_MAX_COUNT',
      'CANDIDATE_RETRIEVAL_REQUEST_VERSION',
      'CANDIDATE_RETRIEVAL_RESULT_VERSION',
      'CAPABILITY_RETRIEVAL_EXPANSION_VERSION',
      'CONTRACT_SCHEMA_NAMES',
      'CONTRACT_VERSION',
      'DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION',
      'DETERMINISTIC_CANDIDATE_PROFILE_VERSION',
      'DETERMINISTIC_PROFILE_BROAD_RETRIEVAL_FACETS',
      'DETERMINISTIC_PROFILE_DENOMINATOR_VERSION',
      'DETERMINISTIC_PROFILE_FIELD_IDS',
      'DETERMINISTIC_PROFILE_LAUNCH_HARD_FILTER_FACETS',
      'DETERMINISTIC_PROFILE_RULES_VERSION',
      'MAX_DIAGNOSTIC_ISSUES',
      'MAX_DIAGNOSTIC_MESSAGE_LENGTH',
      'MAX_DIAGNOSTIC_PATH_LENGTH',
      'MAX_INPUT_DEPTH',
      'MAX_INPUT_NODES',
      'MAX_INPUT_STRING_CODE_UNITS',
      'MAX_INPUT_TOTAL_STRING_CODE_UNITS',
      'MAX_OBJECT_PROPERTIES',
      'REPOSITORY_ARTIFACT_CHUNKER_VERSION',
      'REPOSITORY_ARTIFACT_VERSION',
      'REPOSITORY_INTERVIEW_BOUNDS',
      'REPOSITORY_INTERVIEW_TOPICS',
      'buildCapabilityRetrievalExpansionV1',
      'buildCapabilityTaxonomyV1',
      'candidateRetrievalAuthorityBindingsDigest',
      'candidateRetrievalMetadataAuthoritySemanticDigest',
      'candidateRetrievalMetadataSourceRecordDigest',
      'candidateRetrievalRequestSemanticDigest',
      'candidateRetrievalResultSemanticDigest',
      'capabilityQueryInputDigest',
      'capabilityQueryNormalizationSemanticDigest',
      'capabilityRetrievalExpansionSemanticDigest',
      'capabilityTaxonomySemanticDigest',
      'createCandidateRetrievalMetadataAuthorityV1',
      'createCandidateRetrievalRequestV1',
      'createCandidateRetrievalResultV1',
      'createCapabilityRequestFromRecommendationV1',
      'createDeterministicCandidateProfileAuthorityV1',
      'createDeterministicCandidateProfileV1',
      'createModelExecutionV1',
      'createRecommendationAssessmentModelFitRequestV1',
      'createRepositoryArtifactChunkV1',
      'createRepositoryArtifactSetV1',
      'createRepositoryArtifactV1',
      'createRepositoryInterviewRequestV1',
      'createRepositoryInterviewV1',
      'deterministicCandidateProfileAuthoritySemanticDigest',
      'deterministicCandidateProfileSemanticDigest',
      'getContractSchemaV1',
      'getDeterministicProfileFieldRegistry',
      'modelExecutionIdentityDigest',
      'modelExecutionModelProfileDigest',
      'modelExecutionRecordDigest',
      'modelExecutionReuseKeyDigest',
      'normalizeCapabilityQueryV1',
      'ossRecommendationRequestV1Schema',
      'parseCandidateDossierV1',
      'parseCandidateRetrievalMetadataAuthorityV1',
      'parseCandidateRetrievalRequestV1',
      'parseCandidateRetrievalResultV1',
      'parseCapabilityQueryInputV1',
      'parseCapabilityQueryNormalizationResultV1',
      'parseCapabilityRequestV1',
      'parseCapabilityRetrievalExpansionSourceV1',
      'parseCapabilityRetrievalExpansionV1',
      'parseCapabilityTaxonomySourceV1',
      'parseCapabilityTaxonomyV1',
      'parseDeterministicCandidateProfileAuthorityV1',
      'parseDeterministicCandidateProfileV1',
      'parseErrorEnvelopeV1',
      'parseFitAssessmentRequestV1',
      'parseFitAssessmentResponseV1',
      'parseModelExecutionModelProfileV1',
      'parseModelExecutionV1',
      'parseOssRecommendationRequestV1',
      'parseRecommendationAssessmentModelFitRequestV1',
      'parseRecommendationAssessmentModelResponseV1',
      'parseRecommendationAssessmentResponseV1',
      'parseRepositoryArtifactChunkV1',
      'parseRepositoryArtifactSetV1',
      'parseRepositoryArtifactV1',
      'parseRepositoryFingerprintV1',
      'parseRepositoryInterviewRequestV1',
      'parseRepositoryInterviewV1',
      'parseTargetFitAssessmentResponseV1',
      'recommendationAssessmentModelFitRequestV1Schema',
      'recommendationAssessmentModelResponseV1Schema',
      'recommendationAssessmentResponseV1Schema',
      'repositoryArtifactChunkIdentityDigest',
      'repositoryArtifactChunkRecordDigest',
      'repositoryArtifactContentSha256',
      'repositoryArtifactDisplayUrl',
      'repositoryArtifactGitBlobObjectId',
      'repositoryArtifactIdentityDigest',
      'repositoryArtifactRecordDigest',
      'repositoryArtifactSetIdentityDigest',
      'repositoryArtifactSetRecordDigest',
      'repositoryArtifactUtf8ByteLength',
      'repositoryFingerprintDigestV1',
      'repositoryInterviewCitationIdentityDigest',
      'repositoryInterviewClaimIdentityDigest',
      'repositoryInterviewContradictionIdentityDigest',
      'repositoryInterviewIdentityDigest',
      'repositoryInterviewLimitationIdentityDigest',
      'repositoryInterviewNestedRecordDigest',
      'repositoryInterviewRecordDigest',
      'repositoryInterviewRequestIdentityDigest',
      'repositoryInterviewRequestRecordDigest',
      'repositoryInterviewUnknownIdentityDigest',
      'serializeCandidateRetrievalMetadataAuthorityV1',
      'serializeCandidateRetrievalRequestV1',
      'serializeCandidateRetrievalResultV1',
      'serializeCapabilityRetrievalExpansionV1',
      'serializeCapabilityTaxonomyV1',
      'serializeContractSchemaV1',
      'serializeDeterministicCandidateProfileAuthorityV1',
      'serializeDeterministicCandidateProfileV1',
      'splitRepositoryArtifactLogicalLines',
      'targetFitAssessmentResponseV1Schema',
      'validateCandidateRetrievalExchangeV1',
      'validateCapabilityQueryNormalizationExchangeV1',
      'validateFitAssessmentExchangeV1',
      'validateRecommendationAssessmentExchangeV1',
      'validateRecommendationModelAssessmentExchangeV1',
      'validateRepositoryInterviewExecutionV1',
      'validateTargetFitAssessmentExchangeV1',
    ]);
  });
});

function walkSchema(
  value: JsonSchemaValue,
  visit: (value: JsonSchemaValue) => void,
): void {
  visit(value);
  if (isSchemaArray(value)) {
    for (const child of value) {
      walkSchema(child, visit);
    }
    return;
  }
  if (isRecord(value)) {
    for (const child of Object.values(value)) {
      walkSchema(child, visit);
    }
  }
}

function isSchemaArray(
  value: JsonSchemaValue,
): value is readonly JsonSchemaValue[] {
  return Array.isArray(value);
}

function readProperty(
  value: JsonSchemaValue,
  key: string,
): JsonSchemaValue | undefined {
  return isRecord(value) ? value[key] : undefined;
}

function hasProperty(value: JsonSchemaValue, key: string): boolean {
  return isRecord(value) && Object.hasOwn(value, key);
}

function isRecord(
  value: JsonSchemaValue,
): value is Record<string, JsonSchemaValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
