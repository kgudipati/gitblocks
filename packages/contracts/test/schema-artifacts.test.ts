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
    '1ea959ae0cb76608b7d0e8a902b9e508dc381c90c2fe2fd4df561b80d4398003',
  'capability-taxonomy':
    'd8d4c875fc38696e6ead9dcc2821e04754135aa4af71f0fb85198a98187d3f70',
  'capability-taxonomy-source':
    '357f34187ff26ea70c663f6009b07841b8045493ad54d2393713f7329a9e7933',
  'capability-query-input':
    '9e9a1bc54726100de71d6d1cbd2428ba5a87c3ad4341f7e39a96bed08b639dd6',
  'capability-query-normalization-result':
    'bdd7db9510937c0728f87b0d83f75dbd374555fa17c2b1e4a56399d9f9f2d06b',
  'deterministic-candidate-profile':
    '3bbfdf2050c13a3d70e9dc289db7c8768a6fdcba8605cf12191e08560387af61',
  'deterministic-candidate-profile-authority':
    '7a79a1671bf461127099e3ae2f75d29e949387987041bd3402f2614b747ed8cf',
  'deterministic-candidate-profile-v2':
    '0d3091137063e66d75eb8cd99f3a43f373733abbf9e5e27b899209b68aafd916',
  'deterministic-candidate-profile-authority-v2':
    'abda0dc2a70236e6a795ea9f0608120053833b3be1e1aa032ec639080315fc2f',
  'reviewed-concept-curation-authority-v2':
    '87c6403e207177f95de7162797538aabfcbf9ada021a483f611d5e9814429ddd',
  'candidate-retrieval-request':
    'c4e89ddcfacb0de0c37d91b5c3c02af979496d504ba836b33c135cddf2bdce36',
  'candidate-retrieval-result':
    '638050a0b06408e30e01014ab85075a904241102d24cec4836d8539b25281676',
  'capability-retrieval-expansion':
    '65a22cfe825e42f729eb9eb07aaf0a1a0fcdb40dc043c24a5726548f2e99f73d',
  'capability-retrieval-expansion-source':
    'd7fc05ed58ee4021744865678affcddcbedf35781eb220c4b05f7e4ff3ea5a56',
  'candidate-retrieval-metadata-authority':
    '11c131ced446b072b715585aea9bdaca977190600903c53a6fb4bea4b45f8c13',
  'error-envelope':
    '7a708cc440a7992cb164715dce6029befbe78970c3283d8a1bff9298c87603d0',
  'fit-assessment-request':
    'fcf09c1f5329cbc1660559326d2755d34fdbf1a504595086eb94dc9af57278bb',
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
    'b90f34711a7fca5df673ea78628898594e94a2fa5cc4003b1974fae5fdcf18fb',
  'target-fit-assessment-response':
    '51c7e8c46d8323e29fe02c674c74efece435acf372529c036e52a861f4f78428',
  'recommendation-assessment-response':
    'd7a5888d5e70697022976d1b7a0ac63efa75c7313a5ebc0f6c5a39de08ee115f',
  'recommendation-assessment-model-response':
    '47ab5d6ee9d7d44dc6f4754121b8cfe03756a5f480c84459f09d4c294efcff52',
  'responsible-option':
    '6de709f7f356b99190d5e8cd4ebe0bd5c08902934aeba89f5420f7f7cdddb7fe',
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
      'deterministic-candidate-profile-v2',
      'deterministic-candidate-profile-authority-v2',
      'reviewed-concept-curation-authority-v2',
      'candidate-retrieval-request',
      'candidate-retrieval-result',
      'capability-retrieval-expansion',
      'capability-retrieval-expansion-source',
      'candidate-retrieval-metadata-authority',
      'oss-recommendation-request',
      'target-fit-assessment-response',
      'recommendation-assessment-response',
      'recommendation-assessment-model-response',
      'responsible-option',
    ]);

    for (const name of CONTRACT_SCHEMA_NAMES) {
      const schema = getContractSchemaV1(name);
      expect(readProperty(schema, '$schema')).toBe(
        'https://json-schema.org/draft/2020-12/schema',
      );
      const version = name.endsWith('-v2')
        ? '2.0.0'
        : name === 'oss-recommendation-request'
          ? '2.0.0'
          : name === 'candidate-retrieval-request'
            ? '1.2.0'
            : name === 'candidate-retrieval-result'
              ? '1.3.0'
              : name === 'candidate-retrieval-metadata-authority'
                ? '1.1.0'
                : '1.0.0';
      const artifactName = name.endsWith('-v2') ? name.slice(0, -3) : name;
      expect(readProperty(schema, '$id')).toBe(
        `https://gitblocks.dev/schemas/contracts/${artifactName}/${version}`,
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

  it('preserves the legacy V1 schema while exposing the simpler V2 request', () => {
    const root = getContractSchemaV1('oss-recommendation-request');
    const variants = readProperty(root, 'anyOf');
    if (variants === undefined || !isSchemaArray(variants)) {
      throw new Error('Recommendation request root must expose V1 and V2.');
    }
    const v1 = variants[0];
    const v2 = variants[1];
    if (
      v1 === undefined ||
      v2 === undefined ||
      !isRecord(v1) ||
      !isRecord(v2)
    ) {
      throw new Error('Recommendation request variants must be objects.');
    }
    const schema: JsonSchemaValue = {
      $id: 'https://gitblocks.dev/schemas/contracts/oss-recommendation-request/1.0.0',
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      ...v1,
    };
    const legacyStructureDigest = createHash('sha256')
      .update(`${JSON.stringify(withoutDescriptions(schema), null, 2)}\n`)
      .digest('hex');

    expect(legacyStructureDigest).toBe(
      '20982e93d528f169a7d9ee9a60aeea33a101038ee8da070cdace1fe3afbf15e8',
    );
    expect(
      schemaDescriptionAt(schema, [
        'properties',
        'capabilityQuery',
        'properties',
        'capabilityTerms',
      ]),
    ).toContain(
      '[{"termId":"capability-001","originalTerm":"background jobs"}]',
    );
    expect(
      schemaDescriptionAt(schema, [
        'properties',
        'capabilityQuery',
        'properties',
        'successConditions',
      ]),
    ).toContain(
      '[{"conditionId":"success-001","statement":"Jobs retry after transient failures."}]',
    );
    expect(
      schemaDescriptionAt(schema, [
        'properties',
        'capabilityQuery',
        'properties',
        'draftConstraints',
      ]),
    ).toContain('{"constraintId":"constraint-001","modality":"required"');
    expect(
      schemaDescriptionAt(schema, [
        'properties',
        'capabilityQuery',
        'properties',
        'repositoryFingerprintReference',
      ]),
    ).toContain(
      '{"fingerprintId":"fingerprint-dogfood-001","fingerprintDigest":"0000000000000000000000000000000000000000000000000000000000000000"}',
    );
    expect(
      schemaDescriptionAt(schema, [
        'properties',
        'transmissionApproval',
        'properties',
        'approvedCategories',
      ]),
    ).toContain(
      '["bounded-evidence","candidate-dossiers","capability-request","repository-fingerprint"]',
    );

    expect(variants).toHaveLength(2);
    expect(readPropertyAt(v1, ['properties', 'contractVersion'])).toEqual({
      const: '1.0.0',
      type: 'string',
    });
    expect(readPropertyAt(v2, ['properties', 'contractVersion'])).toEqual({
      const: '2.0.0',
      type: 'string',
    });
    expect(
      readPropertyAt(v2, ['properties', 'capabilityTerms', 'items']),
    ).toMatchObject({ type: 'string' });
    expect(
      readPropertyAt(v2, ['properties', 'successConditions', 'items']),
    ).toMatchObject({ type: 'string' });
    expect(
      readPropertyAt(v2, ['properties', 'constraints', 'items', 'required']),
    ).toEqual(['modality', 'statement', 'term']);
  });

  it('adds hard-resolution threshold guidance through one description key only', () => {
    const schema = getContractSchemaV1(
      'recommendation-assessment-model-response',
    );
    const statePath = [
      'properties',
      'evidenceNeededHardConstraintResolutions',
      'items',
      'properties',
      'state',
    ] as const;

    expect(schemaDescriptionAt(schema, statePath)).toBe(
      'Judge only this disclosed evaluation; do not reconstruct or prove a candidate-wide complete feature or infrastructure inventory. ruleId identifies the deterministic check that was unresolved and does not define the model proof scope. Interpret conceptId as the exact taxonomy concept resolved in normalizedQuery; do not broaden it. For a required feature, candidate-owned evidence explicitly documenting the named concept is sufficient for satisfied; candidate-owned evidence explicitly establishing that the named concept is unsupported is conflict. For prohibited infrastructure, candidate-owned evidence establishing a complete alternative operating configuration that does not require the named component is sufficient for satisfied; candidate-owned evidence that the prohibited component is required is conflict. Use unresolved when supplied evidence genuinely does not speak to the concept or otherwise cannot ground satisfied or conflict. Never use unresolved solely to avoid inference, citation, or grounding requirements.',
    );
    const beforeSchemaDigest = createHash('sha256')
      .update(
        `${JSON.stringify(withoutKeyAt(schema, statePath, 'description'), null, 2)}\n`,
      )
      .digest('hex');
    expect(beforeSchemaDigest).toBe(
      '05519e8895a317e5fccf7c04d2c2cca05b7c3a69553c719fce2ae273a151d067',
    );
  });

  it('adds candidate display identity to retrieval results through property keys only', () => {
    const schema = getContractSchemaV1('candidate-retrieval-result');
    const candidatePaths = [
      ['properties', 'eligibleCandidates', 'items', 'properties'],
      ['properties', 'evidenceNeededCandidates', 'items', 'properties'],
    ] as const;

    for (const path of candidatePaths) {
      expect(readPropertyAt(schema, [...path, 'displayName'])).toBeDefined();
      expect(readPropertyAt(schema, [...path, 'repository'])).toBeDefined();
      expect(readPropertyAt(schema, [...path, 'package'])).toBeDefined();
    }

    let legacySchema = schema;
    for (const path of candidatePaths) {
      for (const key of ['displayName', 'repository', 'package']) {
        legacySchema = withoutKeyAt(legacySchema, path, key);
      }
    }
    const legacySchemaDigest = createHash('sha256')
      .update(`${JSON.stringify(legacySchema, null, 2)}\n`)
      .digest('hex');
    expect(legacySchemaDigest).toBe(
      'e5e8562593212942ec47c9962380030b2b1e79d5275ef2823ebe7b642835dd58',
    );
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
      'DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION_V2',
      'DETERMINISTIC_CANDIDATE_PROFILE_VERSION',
      'DETERMINISTIC_CANDIDATE_PROFILE_VERSION_V2',
      'DETERMINISTIC_PROFILE_BROAD_RETRIEVAL_FACETS',
      'DETERMINISTIC_PROFILE_CONCEPT_ASSERTION_FIELD_IDS',
      'DETERMINISTIC_PROFILE_DENOMINATOR_VERSION',
      'DETERMINISTIC_PROFILE_DENOMINATOR_VERSION_V2',
      'DETERMINISTIC_PROFILE_FIELD_IDS',
      'DETERMINISTIC_PROFILE_LAUNCH_HARD_FILTER_FACETS',
      'DETERMINISTIC_PROFILE_RULES_VERSION',
      'DETERMINISTIC_PROFILE_RULES_VERSION_V2',
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
      'REVIEWED_CONCEPT_CLAIM_VERSION_V2',
      'REVIEWED_CONCEPT_CURATION_AUTHORITY_VERSION_V2',
      'REVIEWED_CONCEPT_SCOPE_ADMISSION_VERSION_V2',
      'STRUCTURED_INFRASTRUCTURE_STATUS_PROJECTION_RULE_ID',
      'STRUCTURED_INFRASTRUCTURE_STATUS_SCHEMA_VERSION',
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
      'contractCanonicalDigest',
      'createCandidateRetrievalMetadataAuthorityV1',
      'createCandidateRetrievalRequestV1',
      'createCandidateRetrievalResultV1',
      'createCapabilityRequestFromRecommendationV1',
      'createDeterministicCandidateProfileAuthorityV1',
      'createDeterministicCandidateProfileAuthorityV2',
      'createDeterministicCandidateProfileV1',
      'createDeterministicCandidateProfileV2',
      'createModelExecutionV1',
      'createRecommendationAssessmentModelDecompositionSchemaV1',
      'createRecommendationAssessmentModelFitRequestV1',
      'createRepositoryArtifactChunkV1',
      'createRepositoryArtifactSetV1',
      'createRepositoryArtifactV1',
      'createRepositoryInterviewRequestV1',
      'createRepositoryInterviewV1',
      'createReviewedConceptCurationAuthorityV2',
      'deterministicCandidateProfileAuthoritySemanticDigest',
      'deterministicCandidateProfileAuthoritySemanticDigestV2',
      'deterministicCandidateProfileSemanticDigest',
      'deterministicCandidateProfileSemanticDigestV2',
      'expandOssRecommendationRequest',
      'getContractSchemaV1',
      'getDeterministicProfileFieldRegistry',
      'modelExecutionIdentityDigest',
      'modelExecutionModelProfileDigest',
      'modelExecutionRecordDigest',
      'modelExecutionReuseKeyDigest',
      'normalizeCapabilityQueryV1',
      'ossRecommendationRequestId',
      'ossRecommendationRequestSchema',
      'ossRecommendationRequestV1Schema',
      'ossRecommendationRequestV2Schema',
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
      'parseDeterministicCandidateProfileAuthority',
      'parseDeterministicCandidateProfileAuthorityV1',
      'parseDeterministicCandidateProfileAuthorityV2',
      'parseDeterministicCandidateProfileV1',
      'parseDeterministicCandidateProfileV2',
      'parseErrorEnvelopeV1',
      'parseFitAssessmentRequestV1',
      'parseFitAssessmentResponseV1',
      'parseModelExecutionModelProfileV1',
      'parseModelExecutionV1',
      'parseOssRecommendationRequest',
      'parseOssRecommendationRequestV1',
      'parseOssRecommendationRequestV2',
      'parseRecommendationAssessmentModelFitRequestV1',
      'parseRecommendationAssessmentModelResponseV1',
      'parseRecommendationAssessmentResponseV1',
      'parseRepositoryArtifactChunkV1',
      'parseRepositoryArtifactSetV1',
      'parseRepositoryArtifactV1',
      'parseRepositoryFingerprintV1',
      'parseRepositoryInterviewRequestV1',
      'parseRepositoryInterviewV1',
      'parseResponsibleOptionV1',
      'parseReviewedConceptCurationAuthorityV2',
      'parseTargetFitAssessmentResponseV1',
      'projectDeterministicCandidateProfileAuthorityToEvaluatorV2',
      'projectDeterministicCandidateProfileV1ToEvaluatorV2',
      'projectResponsibleOptionsV1',
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
      'responsibleOptionV1Schema',
      'reviewedConceptClaimDigestV2',
      'reviewedConceptCurationAuthoritySemanticDigestV2',
      'reviewedConceptScopeAdmissionDigestV2',
      'serializeCandidateRetrievalMetadataAuthorityV1',
      'serializeCandidateRetrievalRequestV1',
      'serializeCandidateRetrievalResultV1',
      'serializeCapabilityRetrievalExpansionV1',
      'serializeCapabilityTaxonomyV1',
      'serializeContractSchemaV1',
      'serializeDeterministicCandidateProfileAuthorityV1',
      'serializeDeterministicCandidateProfileAuthorityV2',
      'serializeDeterministicCandidateProfileV1',
      'serializeDeterministicCandidateProfileV2',
      'serializeReviewedConceptCurationAuthorityV2',
      'splitRepositoryArtifactLogicalLines',
      'targetFitAssessmentResponseV1Schema',
      'validateCandidateRetrievalExchangeV1',
      'validateCapabilityQueryNormalizationExchangeV1',
      'validateFitAssessmentExchangeV1',
      'validateRecommendationAssessmentExchangeV1',
      'validateRecommendationModelAssessmentExchangeV1',
      'validateRecommendationModelDecompositionExchangeV1',
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

function withoutDescriptions(value: JsonSchemaValue): JsonSchemaValue {
  if (isSchemaArray(value)) {
    return value.map((child) => withoutDescriptions(child));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'description')
        .map(([key, child]) => [key, withoutDescriptions(child)]),
    );
  }
  return value;
}

function schemaDescriptionAt(
  schema: JsonSchemaValue,
  path: readonly string[],
): string {
  let current = schema;
  for (const segment of path) {
    const next = readProperty(current, segment);
    if (next === undefined) {
      throw new Error(`Schema path is missing: ${path.join('.')}`);
    }
    current = next;
  }
  const description = readProperty(current, 'description');
  if (typeof description !== 'string') {
    throw new Error(`Schema description is missing: ${path.join('.')}`);
  }
  return description;
}

function readPropertyAt(
  schema: JsonSchemaValue,
  path: readonly string[],
): JsonSchemaValue | undefined {
  let current = schema;
  for (const segment of path) {
    const next = readProperty(current, segment);
    if (next === undefined) return undefined;
    current = next;
  }
  return current;
}

function withoutKeyAt(
  schema: JsonSchemaValue,
  path: readonly string[],
  key: string,
): JsonSchemaValue {
  const copy = structuredClone(schema);
  let current = copy;
  for (const segment of path) {
    const next = readProperty(current, segment);
    if (next === undefined) {
      throw new Error(`Schema path is missing: ${path.join('.')}`);
    }
    current = next;
  }
  if (!isRecord(current) || !Object.hasOwn(current, key)) {
    throw new Error(`Schema key is missing: ${[...path, key].join('.')}`);
  }
  Reflect.deleteProperty(current, key);
  return copy;
}
