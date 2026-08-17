import {
  Ajv2020,
  type AnySchema,
  type ErrorObject,
  type ValidateFunction,
} from 'ajv/dist/2020.js';

import {
  contractIssue,
  finalizeContractIssues,
  type ContractIssue,
  type ContractIssueCode,
  type ContractIssueMessage,
} from './diagnostics.ts';
import {
  preflightContractValue,
  preflightRepositoryArtifactContractValue,
} from './preflight.ts';
import {
  candidateDossierV1Schema,
  capabilityRequestV1Schema,
  errorEnvelopeV1Schema,
  fitAssessmentRequestV1Schema,
  fitAssessmentResponseV1Schema,
  repositoryFingerprintV1Schema,
  repositoryArtifactChunkV1Schema,
  repositoryArtifactSetV1Schema,
  repositoryArtifactV1Schema,
  type CandidateDossierV1,
  type CapabilityRequestV1,
  type ErrorEnvelopeV1,
  type FitAssessmentRequestV1,
  type FitAssessmentResponseV1,
  type RepositoryFingerprintV1,
  type RepositoryArtifactChunkV1,
  type RepositoryArtifactSetV1,
  type RepositoryArtifactV1,
} from './schemas.ts';
import {
  modelExecutionModelProfileV1Schema,
  modelExecutionV1Schema,
  repositoryInterviewRequestV1Schema,
  repositoryInterviewV1Schema,
  type ModelExecutionModelProfileV1,
  type ModelExecutionV1,
  type RepositoryInterviewRequestV1,
  type RepositoryInterviewV1,
} from './repository-interview-schemas.ts';
import {
  capabilityTaxonomySourceV1Schema,
  capabilityTaxonomyV1Schema,
  type CapabilityTaxonomySourceV1,
  type CapabilityTaxonomyV1,
} from './capability-taxonomy-schemas.ts';
import {
  capabilityQueryInputV1Schema,
  capabilityQueryNormalizationResultV1Schema,
  type CapabilityQueryInputV1,
  type CapabilityQueryNormalizationResultV1,
} from './capability-query-schemas.ts';
import {
  deterministicCandidateProfileAuthorityV1Schema,
  deterministicCandidateProfileV1Schema,
  deterministicProfileFieldRecordV1Schema,
  type DeterministicCandidateProfileAuthorityV1,
  type DeterministicCandidateProfileV1,
} from './deterministic-candidate-profile-schemas.ts';
import {
  candidateRetrievalRequestV1Schema,
  candidateRetrievalResultV1Schema,
  type CandidateRetrievalRequestV1,
  type CandidateRetrievalResultV1,
} from './candidate-retrieval-schemas.ts';
import {
  capabilityRetrievalExpansionSourceV1Schema,
  capabilityRetrievalExpansionV1Schema,
  type CapabilityRetrievalExpansionSourceV1,
  type CapabilityRetrievalExpansionV1,
} from './capability-retrieval-expansion-schemas.ts';
import {
  candidateRetrievalMetadataAuthorityV1Schema,
  type CandidateRetrievalMetadataAuthorityV1,
} from './candidate-retrieval-metadata-schemas.ts';
import {
  ossRecommendationRequestV1Schema,
  recommendationAssessmentModelFitRequestV1Schema,
  recommendationAssessmentModelResponseV1Schema,
  recommendationAssessmentResponseV1Schema,
  targetFitAssessmentResponseV1Schema,
  type OssRecommendationRequestV1,
  type RecommendationAssessmentModelFitRequestV1,
  type RecommendationAssessmentModelResponseV1,
  type RecommendationAssessmentResponseV1,
  type TargetFitAssessmentResponseV1,
} from './oss-recommendation-schemas.ts';

const AJV_OPTIONS = {
  allErrors: false,
  coerceTypes: false,
  messages: false,
  removeAdditional: false,
  strict: true,
  useDefaults: false,
  validateFormats: false,
  verbose: false,
} as const;

const ajv = new Ajv2020(AJV_OPTIONS);

const deterministicCandidateProfileEnvelopeSchema: AnySchema = {
  ...deterministicCandidateProfileV1Schema,
  $id: 'https://gitblocks.dev/schemas/contracts/deterministic-candidate-profile-envelope/1.0.0',
  properties: {
    ...deterministicCandidateProfileV1Schema.properties,
    fields: {
      ...deterministicCandidateProfileV1Schema.properties.fields,
      items: true,
    },
    semanticProfileDigest: true,
  },
};

const deterministicCandidateProfileDigestSchema: AnySchema = {
  type: 'object',
  required: ['semanticProfileDigest'],
  properties: {
    semanticProfileDigest:
      deterministicCandidateProfileV1Schema.properties.semanticProfileDigest,
  },
};

const deterministicProfileFieldBranches = (
  deterministicProfileFieldRecordV1Schema as unknown as {
    readonly anyOf: readonly AnySchema[];
  }
).anyOf;
const deterministicProfileFieldBranchesById = new Map<
  string,
  readonly AnySchema[]
>();
for (const branch of deterministicProfileFieldBranches) {
  const fieldId = (
    branch as {
      readonly properties: {
        readonly fieldId: { readonly const: string };
      };
    }
  ).properties.fieldId.const;
  const existing = deterministicProfileFieldBranchesById.get(fieldId) ?? [];
  deterministicProfileFieldBranchesById.set(fieldId, [...existing, branch]);
}

const deterministicProfileFieldCommonProperties = [
  'fieldId',
  'scope',
  'stateReasonCode',
  'stateRuleId',
  'versionScope',
  'sourceReferences',
  'state',
  'valueExtractionRuleId',
] as const;
const deterministicProfileFieldBranchShapes = [
  [...deterministicProfileFieldCommonProperties, 'value'],
  deterministicProfileFieldCommonProperties,
  [...deterministicProfileFieldCommonProperties, 'claims'],
].map((properties) => new Set<string>(properties));

// The public schema remains the authority. Its private envelope validator
// delegates profile items to the separately memoized profile validator so Ajv
// does not inline the same large profile program into the authority program.
const deterministicCandidateProfileAuthorityEnvelopeSchema: AnySchema = {
  ...deterministicCandidateProfileAuthorityV1Schema,
  $id: 'https://gitblocks.dev/schemas/contracts/deterministic-candidate-profile-authority-envelope/1.0.0',
  properties: {
    ...deterministicCandidateProfileAuthorityV1Schema.properties,
    profiles: {
      ...deterministicCandidateProfileAuthorityV1Schema.properties.profiles,
      items: true,
    },
    semanticAuthorityDigest: true,
  },
};

const deterministicCandidateProfileAuthorityDigestSchema: AnySchema = {
  type: 'object',
  required: ['semanticAuthorityDigest'],
  properties: {
    semanticAuthorityDigest:
      deterministicCandidateProfileAuthorityV1Schema.properties
        .semanticAuthorityDigest,
  },
};

type LazyStructuralValidator<T> = () => ValidateFunction<T>;

function createLazyStructuralValidator<T>(
  schema: AnySchema,
  prerequisites: readonly (() => unknown)[] = [],
): LazyStructuralValidator<T> {
  let validator: ValidateFunction<T> | undefined;
  return () => {
    for (const getPrerequisite of prerequisites) {
      getPrerequisite();
    }
    validator ??= ajv.compile<T>(schema);
    return validator;
  };
}

function createLazyCandidateProfileAuthorityValidator(
  getProfileValidator: LazyStructuralValidator<DeterministicCandidateProfileV1>,
): LazyStructuralValidator<DeterministicCandidateProfileAuthorityV1> {
  let validator:
    ValidateFunction<DeterministicCandidateProfileAuthorityV1> | undefined;
  return () => {
    if (validator !== undefined) {
      return validator;
    }
    const profileValidator = getProfileValidator();
    const envelopeValidator =
      ajv.compile<DeterministicCandidateProfileAuthorityV1>(
        deterministicCandidateProfileAuthorityEnvelopeSchema,
      );
    const digestValidator =
      ajv.compile<DeterministicCandidateProfileAuthorityV1>(
        deterministicCandidateProfileAuthorityDigestSchema,
      );
    const composite = ((value: unknown) => {
      composite.errors = null;
      if (!envelopeValidator(value)) {
        composite.errors = envelopeValidator.errors ?? null;
        return false;
      }
      const profiles = (value as DeterministicCandidateProfileAuthorityV1)
        .profiles;
      for (const [index, profile] of profiles.entries()) {
        if (!profileValidator(profile)) {
          composite.errors = (profileValidator.errors ?? []).map((error) => ({
            ...error,
            instancePath: `/profiles/${String(index)}${error.instancePath}`,
          }));
          return false;
        }
      }
      if (!digestValidator(value)) {
        composite.errors = digestValidator.errors ?? null;
        return false;
      }
      return true;
    }) as unknown as ValidateFunction<DeterministicCandidateProfileAuthorityV1>;
    composite.errors = null;
    validator = composite;
    return validator;
  };
}

function createLazyCandidateProfileValidator(): LazyStructuralValidator<DeterministicCandidateProfileV1> {
  let validator: ValidateFunction<DeterministicCandidateProfileV1> | undefined;
  return () => {
    if (validator !== undefined) {
      return validator;
    }
    const envelopeValidator = ajv.compile<DeterministicCandidateProfileV1>(
      deterministicCandidateProfileEnvelopeSchema,
    );
    const digestValidator = ajv.compile<DeterministicCandidateProfileV1>(
      deterministicCandidateProfileDigestSchema,
    );
    const fieldValidators = new Map<string, ValidateFunction>();
    const getFieldValidator = (fieldId: string): ValidateFunction => {
      const branches = deterministicProfileFieldBranchesById.get(fieldId);
      if (branches === undefined) {
        throw new Error('Deterministic profile field ID is not registered.');
      }
      const existing = fieldValidators.get(fieldId);
      if (existing !== undefined) {
        return existing;
      }
      const compiled = ajv.compile({ anyOf: branches });
      fieldValidators.set(fieldId, compiled);
      return compiled;
    };
    const composite = ((value: unknown) => {
      composite.errors = null;
      if (!envelopeValidator(value)) {
        composite.errors = envelopeValidator.errors ?? null;
        return false;
      }
      const fields = (value as { readonly fields: readonly unknown[] }).fields;
      for (const [index, field] of fields.entries()) {
        const fieldId =
          typeof field === 'object' && field !== null && !Array.isArray(field)
            ? (field as Record<string, unknown>)['fieldId']
            : undefined;
        let fieldErrors: readonly ErrorObject[];
        if (
          typeof fieldId !== 'string' ||
          !deterministicProfileFieldBranchesById.has(fieldId)
        ) {
          fieldErrors = malformedFieldDiscriminatorErrors(field);
        } else {
          const fieldValidator = getFieldValidator(fieldId);
          if (fieldValidator(field)) {
            continue;
          }
          fieldErrors = fieldValidator.errors ?? [];
          if (nonmatchingFieldBranchReachesDiscriminator(field)) {
            fieldErrors = [
              ...fieldErrors,
              compatibilityAjvError('const', '/fieldId'),
            ];
          }
        }
        composite.errors = fieldErrors.map((error) => ({
          ...error,
          instancePath: `/fields/${String(index)}${error.instancePath}`,
        }));
        return false;
      }
      if (!digestValidator(value)) {
        composite.errors = digestValidator.errors ?? null;
        return false;
      }
      return true;
    }) as unknown as ValidateFunction<DeterministicCandidateProfileV1>;
    composite.errors = null;
    validator = composite;
    return validator;
  };
}

function malformedFieldDiscriminatorErrors(
  field: unknown,
): readonly ErrorObject[] {
  if (typeof field !== 'object' || field === null || Array.isArray(field)) {
    return [compatibilityAjvError('type', '')];
  }
  const errors: ErrorObject[] = [];
  for (const properties of deterministicProfileFieldBranchShapes) {
    if (
      [...properties].some(
        (property) => !Object.prototype.hasOwnProperty.call(field, property),
      )
    ) {
      errors.push(compatibilityAjvError('required', ''));
      continue;
    }
    if (Object.keys(field).some((property) => !properties.has(property))) {
      errors.push(compatibilityAjvError('additionalProperties', ''));
      continue;
    }
    errors.push(compatibilityAjvError('const', '/fieldId'));
    if (typeof (field as Record<string, unknown>)['fieldId'] !== 'string') {
      errors.push(compatibilityAjvError('type', '/fieldId'));
    }
  }
  return errors;
}

function nonmatchingFieldBranchReachesDiscriminator(field: unknown): boolean {
  if (typeof field !== 'object' || field === null || Array.isArray(field)) {
    return false;
  }
  const keys = Object.keys(field);
  return deterministicProfileFieldBranchShapes.some(
    (properties) =>
      [...properties].every((property) =>
        Object.prototype.hasOwnProperty.call(field, property),
      ) && keys.every((property) => properties.has(property)),
  );
}

function compatibilityAjvError(
  keyword: string,
  instancePath: string,
): ErrorObject {
  return {
    instancePath,
    schemaPath: '',
    keyword,
    params: {},
  } as ErrorObject;
}

export const capabilityRequestV1Validator =
  createLazyStructuralValidator<CapabilityRequestV1>(capabilityRequestV1Schema);
export const repositoryFingerprintV1Validator =
  createLazyStructuralValidator<RepositoryFingerprintV1>(
    repositoryFingerprintV1Schema,
  );
export const candidateDossierV1Validator =
  createLazyStructuralValidator<CandidateDossierV1>(candidateDossierV1Schema);
export const fitAssessmentRequestV1Validator =
  createLazyStructuralValidator<FitAssessmentRequestV1>(
    fitAssessmentRequestV1Schema,
  );
export const fitAssessmentResponseV1Validator =
  createLazyStructuralValidator<FitAssessmentResponseV1>(
    fitAssessmentResponseV1Schema,
  );
export const errorEnvelopeV1Validator =
  createLazyStructuralValidator<ErrorEnvelopeV1>(errorEnvelopeV1Schema);
export const repositoryArtifactV1Validator =
  createLazyStructuralValidator<RepositoryArtifactV1>(
    repositoryArtifactV1Schema,
  );
export const repositoryArtifactChunkV1Validator =
  createLazyStructuralValidator<RepositoryArtifactChunkV1>(
    repositoryArtifactChunkV1Schema,
  );
export const repositoryArtifactSetV1Validator =
  createLazyStructuralValidator<RepositoryArtifactSetV1>(
    repositoryArtifactSetV1Schema,
  );
export const repositoryInterviewRequestV1Validator =
  createLazyStructuralValidator<RepositoryInterviewRequestV1>(
    repositoryInterviewRequestV1Schema,
  );
export const modelExecutionModelProfileV1Validator =
  createLazyStructuralValidator<ModelExecutionModelProfileV1>(
    modelExecutionModelProfileV1Schema,
  );
export const modelExecutionV1Validator =
  createLazyStructuralValidator<ModelExecutionV1>(modelExecutionV1Schema);
export const repositoryInterviewV1Validator =
  createLazyStructuralValidator<RepositoryInterviewV1>(
    repositoryInterviewV1Schema,
  );
export const capabilityTaxonomySourceV1Validator =
  createLazyStructuralValidator<CapabilityTaxonomySourceV1>(
    capabilityTaxonomySourceV1Schema,
  );
export const capabilityTaxonomyV1Validator =
  createLazyStructuralValidator<CapabilityTaxonomyV1>(
    capabilityTaxonomyV1Schema,
  );
export const capabilityQueryInputV1Validator =
  createLazyStructuralValidator<CapabilityQueryInputV1>(
    capabilityQueryInputV1Schema,
  );
export const capabilityQueryNormalizationResultV1Validator =
  createLazyStructuralValidator<CapabilityQueryNormalizationResultV1>(
    capabilityQueryNormalizationResultV1Schema,
  );
export const deterministicCandidateProfileV1Validator =
  createLazyCandidateProfileValidator();
export const deterministicCandidateProfileAuthorityV1Validator =
  createLazyCandidateProfileAuthorityValidator(
    deterministicCandidateProfileV1Validator,
  );
export const candidateRetrievalRequestV1Validator =
  createLazyStructuralValidator<CandidateRetrievalRequestV1>(
    candidateRetrievalRequestV1Schema,
  );
export const candidateRetrievalResultV1Validator =
  createLazyStructuralValidator<CandidateRetrievalResultV1>(
    candidateRetrievalResultV1Schema,
  );
export const capabilityRetrievalExpansionSourceV1Validator =
  createLazyStructuralValidator<CapabilityRetrievalExpansionSourceV1>(
    capabilityRetrievalExpansionSourceV1Schema,
  );
export const capabilityRetrievalExpansionV1Validator =
  createLazyStructuralValidator<CapabilityRetrievalExpansionV1>(
    capabilityRetrievalExpansionV1Schema,
  );
export const candidateRetrievalMetadataAuthorityV1Validator =
  createLazyStructuralValidator<CandidateRetrievalMetadataAuthorityV1>(
    candidateRetrievalMetadataAuthorityV1Schema,
  );
export const ossRecommendationRequestV1Validator =
  createLazyStructuralValidator<OssRecommendationRequestV1>(
    ossRecommendationRequestV1Schema,
  );
export const targetFitAssessmentResponseV1Validator =
  createLazyStructuralValidator<TargetFitAssessmentResponseV1>(
    targetFitAssessmentResponseV1Schema,
  );
export const recommendationAssessmentResponseV1Validator =
  createLazyStructuralValidator<RecommendationAssessmentResponseV1>(
    recommendationAssessmentResponseV1Schema,
  );
export const recommendationAssessmentModelFitRequestV1Validator =
  createLazyStructuralValidator<RecommendationAssessmentModelFitRequestV1>(
    recommendationAssessmentModelFitRequestV1Schema,
  );
export const recommendationAssessmentModelResponseV1Validator =
  createLazyStructuralValidator<RecommendationAssessmentModelResponseV1>(
    recommendationAssessmentModelResponseV1Schema,
  );

export type StructuralValidationResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly ContractIssue[];
    };

export function structurallyValidate<T>(
  value: unknown,
  getValidator: LazyStructuralValidator<T>,
): StructuralValidationResult<T> {
  const preflightIssues = preflightContractValue(value);
  if (preflightIssues.length > 0) {
    return { ok: false, issues: preflightIssues };
  }
  const validator = getValidator();
  try {
    if (validator(value)) {
      return { ok: true, value, issues: [] };
    }
    return {
      ok: false,
      issues: formatAjvErrors(validator.errors),
    };
  } catch {
    return {
      ok: false,
      issues: [
        contractIssue(
          'contract.input-shape',
          '',
          'Contract input has an unsupported object shape.',
        ),
      ],
    };
  }
}

export function structurallyValidateRepositoryArtifact<T>(
  value: unknown,
  getValidator: LazyStructuralValidator<T>,
): StructuralValidationResult<T> {
  return structurallyValidateWithPreflight(
    value,
    getValidator,
    preflightRepositoryArtifactContractValue,
  );
}

function structurallyValidateWithPreflight<T>(
  value: unknown,
  getValidator: LazyStructuralValidator<T>,
  preflight: (input: unknown) => readonly ContractIssue[],
): StructuralValidationResult<T> {
  const preflightIssues = preflight(value);
  if (preflightIssues.length > 0) {
    return { ok: false, issues: preflightIssues };
  }
  const validator = getValidator();
  try {
    if (validator(value)) {
      return { ok: true, value, issues: [] };
    }
    return {
      ok: false,
      issues: formatAjvErrors(validator.errors),
    };
  } catch {
    return {
      ok: false,
      issues: [
        contractIssue(
          'contract.input-shape',
          '',
          'Contract input has an unsupported object shape.',
        ),
      ],
    };
  }
}

function formatAjvErrors(
  errors: readonly ErrorObject[] | null | undefined,
): readonly ContractIssue[] {
  const candidates = errors ?? [];
  const withoutVariantSummary = candidates.some(
    (error) => error.keyword !== 'anyOf' && error.keyword !== 'oneOf',
  )
    ? candidates.filter(
        (error) => error.keyword !== 'anyOf' && error.keyword !== 'oneOf',
      )
    : candidates;
  const relevant = withoutVariantSummary.filter(
    (error) =>
      error.keyword !== 'required' ||
      !withoutVariantSummary.some(
        (other) =>
          other !== error &&
          other.keyword !== 'required' &&
          other.instancePath.startsWith(`${error.instancePath}/`),
      ),
  );
  return finalizeContractIssues(
    relevant.map((error) => {
      const mapping = mapAjvKeyword(error);
      return contractIssue(mapping.code, error.instancePath, mapping.message);
    }),
  );
}

function mapAjvKeyword(error: ErrorObject): {
  readonly code: ContractIssueCode;
  readonly message: ContractIssueMessage;
} {
  if (
    error.instancePath === '/contractVersion' ||
    error.instancePath.endsWith('/contractVersion')
  ) {
    return {
      code: 'contract.version',
      message: 'Contract version is unsupported.',
    };
  }
  switch (error.keyword) {
    case 'additionalProperties':
      return {
        code: 'contract.additional-property',
        message: 'Contract value contains an additional field.',
      };
    case 'anyOf':
    case 'oneOf':
      return {
        code: 'contract.variant',
        message: 'Contract value does not match an allowed variant.',
      };
    case 'const':
    case 'enum':
      return {
        code: 'contract.literal',
        message: 'Contract value does not match the required literal.',
      };
    case 'maxItems':
    case 'maxLength':
    case 'maximum':
    case 'minItems':
    case 'minLength':
    case 'minimum':
      return {
        code: 'contract.bounds',
        message: 'Contract value is outside the allowed bounds.',
      };
    case 'pattern':
      return {
        code: 'contract.pattern',
        message: 'Contract value does not match the required pattern.',
      };
    case 'required':
      return {
        code: 'contract.required',
        message: 'Required contract field is missing.',
      };
    case 'type':
      return {
        code: 'contract.type',
        message: 'Contract value has an invalid type.',
      };
    case 'uniqueItems':
      return {
        code: 'contract.duplicate',
        message: 'Contract value contains a duplicate item.',
      };
    default:
      return {
        code: 'contract.literal',
        message: 'Contract validation failed.',
      };
  }
}
