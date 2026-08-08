import {
  Ajv2020,
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

export const capabilityRequestV1Validator = ajv.compile<CapabilityRequestV1>(
  capabilityRequestV1Schema,
);
export const repositoryFingerprintV1Validator =
  ajv.compile<RepositoryFingerprintV1>(repositoryFingerprintV1Schema);
export const candidateDossierV1Validator = ajv.compile<CandidateDossierV1>(
  candidateDossierV1Schema,
);
export const fitAssessmentRequestV1Validator =
  ajv.compile<FitAssessmentRequestV1>(fitAssessmentRequestV1Schema);
export const fitAssessmentResponseV1Validator =
  ajv.compile<FitAssessmentResponseV1>(fitAssessmentResponseV1Schema);
export const errorEnvelopeV1Validator = ajv.compile<ErrorEnvelopeV1>(
  errorEnvelopeV1Schema,
);
export const repositoryArtifactV1Validator = ajv.compile<RepositoryArtifactV1>(
  repositoryArtifactV1Schema,
);
export const repositoryArtifactChunkV1Validator =
  ajv.compile<RepositoryArtifactChunkV1>(repositoryArtifactChunkV1Schema);
export const repositoryArtifactSetV1Validator =
  ajv.compile<RepositoryArtifactSetV1>(repositoryArtifactSetV1Schema);
export const repositoryInterviewRequestV1Validator =
  ajv.compile<RepositoryInterviewRequestV1>(repositoryInterviewRequestV1Schema);
export const modelExecutionModelProfileV1Validator =
  ajv.compile<ModelExecutionModelProfileV1>(modelExecutionModelProfileV1Schema);
export const modelExecutionV1Validator = ajv.compile<ModelExecutionV1>(
  modelExecutionV1Schema,
);
export const repositoryInterviewV1Validator =
  ajv.compile<RepositoryInterviewV1>(repositoryInterviewV1Schema);
export const capabilityTaxonomySourceV1Validator =
  ajv.compile<CapabilityTaxonomySourceV1>(capabilityTaxonomySourceV1Schema);
export const capabilityTaxonomyV1Validator = ajv.compile<CapabilityTaxonomyV1>(
  capabilityTaxonomyV1Schema,
);
export const capabilityQueryInputV1Validator =
  ajv.compile<CapabilityQueryInputV1>(capabilityQueryInputV1Schema);
export const capabilityQueryNormalizationResultV1Validator =
  ajv.compile<CapabilityQueryNormalizationResultV1>(
    capabilityQueryNormalizationResultV1Schema,
  );
export const deterministicCandidateProfileV1Validator =
  ajv.compile<DeterministicCandidateProfileV1>(
    deterministicCandidateProfileV1Schema,
  );
export const deterministicCandidateProfileAuthorityV1Validator =
  ajv.compile<DeterministicCandidateProfileAuthorityV1>(
    deterministicCandidateProfileAuthorityV1Schema,
  );
export const candidateRetrievalRequestV1Validator =
  ajv.compile<CandidateRetrievalRequestV1>(candidateRetrievalRequestV1Schema);
export const candidateRetrievalResultV1Validator =
  ajv.compile<CandidateRetrievalResultV1>(candidateRetrievalResultV1Schema);
export const capabilityRetrievalExpansionSourceV1Validator =
  ajv.compile<CapabilityRetrievalExpansionSourceV1>(
    capabilityRetrievalExpansionSourceV1Schema,
  );
export const capabilityRetrievalExpansionV1Validator =
  ajv.compile<CapabilityRetrievalExpansionV1>(
    capabilityRetrievalExpansionV1Schema,
  );
export const candidateRetrievalMetadataAuthorityV1Validator =
  ajv.compile<CandidateRetrievalMetadataAuthorityV1>(
    candidateRetrievalMetadataAuthorityV1Schema,
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
  validator: ValidateFunction<T>,
): StructuralValidationResult<T> {
  const preflightIssues = preflightContractValue(value);
  if (preflightIssues.length > 0) {
    return { ok: false, issues: preflightIssues };
  }
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
  validator: ValidateFunction<T>,
): StructuralValidationResult<T> {
  return structurallyValidateWithPreflight(
    value,
    validator,
    preflightRepositoryArtifactContractValue,
  );
}

function structurallyValidateWithPreflight<T>(
  value: unknown,
  validator: ValidateFunction<T>,
  preflight: (input: unknown) => readonly ContractIssue[],
): StructuralValidationResult<T> {
  const preflightIssues = preflight(value);
  if (preflightIssues.length > 0) {
    return { ok: false, issues: preflightIssues };
  }
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
