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
import { preflightContractValue } from './preflight.ts';
import {
  candidateDossierV1Schema,
  capabilityRequestV1Schema,
  errorEnvelopeV1Schema,
  fitAssessmentRequestV1Schema,
  fitAssessmentResponseV1Schema,
  repositoryFingerprintV1Schema,
  type CandidateDossierV1,
  type CapabilityRequestV1,
  type ErrorEnvelopeV1,
  type FitAssessmentRequestV1,
  type FitAssessmentResponseV1,
  type RepositoryFingerprintV1,
} from './schemas.ts';

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
  if (validator(value)) {
    return { ok: true, value, issues: [] };
  }
  return {
    ok: false,
    issues: formatAjvErrors(validator.errors),
  };
}

function formatAjvErrors(
  errors: readonly ErrorObject[] | null | undefined,
): readonly ContractIssue[] {
  return finalizeContractIssues(
    (errors ?? []).map((error) => {
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
