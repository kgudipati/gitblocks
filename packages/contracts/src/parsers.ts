import {
  validateCandidateDossier,
  validateCapabilityRequest,
  validateFitAssessmentExchange,
  validateFitAssessmentRequest,
  validateFitAssessmentResult,
  validateRepositoryFingerprint,
  type FitAssessmentExchange,
} from '@gitblocks/domain';

import {
  contractIssue,
  finalizeContractIssues,
  mapDomainIssues,
  type ContractIssue,
  type ContractParseResult,
} from './diagnostics.ts';
import {
  mapCandidateDossierV1ToDomain,
  mapCapabilityRequestV1ToDomain,
  mapFitAssessmentRequestV1ToDomain,
  mapFitAssessmentResponseV1ToDomain,
  mapRepositoryFingerprintV1ToDomain,
} from './domain-mapping.ts';
import type {
  CandidateDossierV1,
  CapabilityRequestV1,
  ErrorEnvelopeV1,
  FitAssessmentRequestV1,
  FitAssessmentResponseV1,
  RepositoryFingerprintV1,
} from './schemas.ts';
import {
  candidateDossierV1Validator,
  capabilityRequestV1Validator,
  errorEnvelopeV1Validator,
  fitAssessmentRequestV1Validator,
  fitAssessmentResponseV1Validator,
  repositoryFingerprintV1Validator,
  structurallyValidate,
  type StructuralValidationResult,
} from './structural-validation.ts';

export function parseCapabilityRequestV1(
  value: unknown,
): ContractParseResult<
  CapabilityRequestV1,
  ReturnType<typeof mapCapabilityRequestV1ToDomain>
> {
  return parseOwnedContract(
    structurallyValidate(value, capabilityRequestV1Validator),
    mapCapabilityRequestV1ToDomain,
    validateCapabilityRequest,
  );
}

export function parseRepositoryFingerprintV1(
  value: unknown,
): ContractParseResult<
  RepositoryFingerprintV1,
  ReturnType<typeof mapRepositoryFingerprintV1ToDomain>
> {
  return parseOwnedContract(
    structurallyValidate(value, repositoryFingerprintV1Validator),
    mapRepositoryFingerprintV1ToDomain,
    validateRepositoryFingerprint,
  );
}

export function parseCandidateDossierV1(
  value: unknown,
): ContractParseResult<
  CandidateDossierV1,
  ReturnType<typeof mapCandidateDossierV1ToDomain>
> {
  return parseOwnedContract(
    structurallyValidate(value, candidateDossierV1Validator),
    mapCandidateDossierV1ToDomain,
    validateCandidateDossier,
  );
}

export function parseFitAssessmentRequestV1(
  value: unknown,
): ContractParseResult<
  FitAssessmentRequestV1,
  ReturnType<typeof mapFitAssessmentRequestV1ToDomain>
> {
  return parseOwnedContract(
    structurallyValidate(value, fitAssessmentRequestV1Validator),
    mapFitAssessmentRequestV1ToDomain,
    validateFitAssessmentRequest,
  );
}

export function parseFitAssessmentResponseV1(
  value: unknown,
): ContractParseResult<
  FitAssessmentResponseV1,
  ReturnType<typeof mapFitAssessmentResponseV1ToDomain>
> {
  return parseOwnedContract(
    structurallyValidate(value, fitAssessmentResponseV1Validator),
    mapFitAssessmentResponseV1ToDomain,
    validateFitAssessmentResult,
  );
}

export function parseErrorEnvelopeV1(
  value: unknown,
): ContractParseResult<ErrorEnvelopeV1, ErrorEnvelopeV1> {
  const structural = structurallyValidate(value, errorEnvelopeV1Validator);
  if (!structural.ok) {
    return structural;
  }
  try {
    const semanticIssues = validateErrorEnvelopeSemantics(structural.value);
    if (semanticIssues.length > 0) {
      return { ok: false, issues: semanticIssues };
    }
    const domain = canonicalizeErrorEnvelope(structural.value);
    return {
      ok: true,
      value: structural.value,
      domain,
      issues: [],
    };
  } catch {
    return unsafeJavaScriptValueRejection();
  }
}

export type FitAssessmentExchangeValidationResult =
  | {
      readonly ok: true;
      readonly request: FitAssessmentRequestV1;
      readonly response: FitAssessmentResponseV1;
      readonly domain: FitAssessmentExchange;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly ContractIssue[];
    };

export function validateFitAssessmentExchangeV1(
  request: FitAssessmentRequestV1,
  response: FitAssessmentResponseV1,
): FitAssessmentExchangeValidationResult {
  const parsedRequest = parseFitAssessmentRequestV1(request);
  const parsedResponse = parseFitAssessmentResponseV1(response);
  if (!parsedRequest.ok || !parsedResponse.ok) {
    return {
      ok: false,
      issues: finalizeContractIssues([
        ...prefixIssues(
          parsedRequest.ok ? [] : parsedRequest.issues,
          '/request',
        ),
        ...prefixIssues(
          parsedResponse.ok ? [] : parsedResponse.issues,
          '/response',
        ),
      ]),
    };
  }
  const exchange = validateFitAssessmentExchange(
    parsedRequest.domain,
    parsedResponse.domain,
  );
  if (!exchange.ok) {
    return { ok: false, issues: mapDomainIssues(exchange.issues) };
  }
  return {
    ok: true,
    request: parsedRequest.value,
    response: parsedResponse.value,
    domain: exchange.value,
    issues: [],
  };
}

function parseOwnedContract<Dto, Domain>(
  structural: StructuralValidationResult<Dto>,
  mapToDomain: (value: Dto) => Domain,
  validateDomain: (value: Domain) =>
    | { readonly ok: true; readonly value: Domain }
    | {
        readonly ok: false;
        readonly issues: Parameters<typeof mapDomainIssues>[0];
      },
): ContractParseResult<Dto, Domain> {
  if (!structural.ok) {
    return structural;
  }
  try {
    const domain = validateDomain(mapToDomain(structural.value));
    if (!domain.ok) {
      return { ok: false, issues: mapDomainIssues(domain.issues) };
    }
    return {
      ok: true,
      value: structural.value,
      domain: domain.value,
      issues: [],
    };
  } catch {
    return unsafeJavaScriptValueRejection();
  }
}

function unsafeJavaScriptValueRejection(): {
  readonly ok: false;
  readonly issues: readonly ContractIssue[];
} {
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

const ERROR_SEMANTICS = {
  'invalid-request': {
    message: 'The request is invalid.',
    retry: 'after-correction',
  },
  'unsupported-contract-version': {
    message: 'The contract version is unsupported.',
    retry: 'after-correction',
  },
  'not-authorized': {
    message: 'The operation is not authorized.',
    retry: 'never',
  },
  'not-found': {
    message: 'The requested resource was not found.',
    retry: 'never',
  },
  conflict: {
    message: 'The request conflicts with the current state.',
    retry: 'after-correction',
  },
  'rate-limited': {
    message: 'The request rate limit was exceeded.',
    retry: 'later',
  },
  'temporarily-unavailable': {
    message: 'The service is temporarily unavailable.',
    retry: 'later',
  },
  'deadline-exceeded': {
    message: 'The operation deadline was exceeded.',
    retry: 'later',
  },
  'internal-error': {
    message: 'The operation could not be completed.',
    retry: 'later',
  },
} as const satisfies Readonly<
  Record<
    ErrorEnvelopeV1['code'],
    {
      readonly message: ErrorEnvelopeV1['message'];
      readonly retry: ErrorEnvelopeV1['retry'];
    }
  >
>;

function validateErrorEnvelopeSemantics(
  envelope: ErrorEnvelopeV1,
): readonly ContractIssue[] {
  const expected = ERROR_SEMANTICS[envelope.code];
  const issues: ContractIssue[] = [];
  if (envelope.message !== expected.message) {
    issues.push(
      contractIssue(
        'domain.error-envelope-combination',
        '/message',
        'Domain validation failed.',
      ),
    );
  }
  if (envelope.retry !== expected.retry) {
    issues.push(
      contractIssue(
        'domain.error-envelope-combination',
        '/retry',
        'Domain validation failed.',
      ),
    );
  }
  const issueKeys = envelope.issues.map(
    (issue) => `${issue.path}\0${issue.code}`,
  );
  if (new Set(issueKeys).size !== issueKeys.length) {
    issues.push(
      contractIssue(
        'domain.error-envelope-combination',
        '/issues',
        'Domain validation failed.',
      ),
    );
  }
  return finalizeContractIssues(issues);
}

function canonicalizeErrorEnvelope(envelope: ErrorEnvelopeV1): ErrorEnvelopeV1 {
  const common = {
    contractVersion: envelope.contractVersion,
    code: envelope.code,
    message: envelope.message,
    issues: [...envelope.issues]
      .map((issue) => ({ ...issue }))
      .sort((left, right) =>
        compareText(
          `${left.path}\0${left.code}`,
          `${right.path}\0${right.code}`,
        ),
      ),
    retry: envelope.retry,
  };
  return envelope.correlationId === undefined
    ? common
    : { ...common, correlationId: envelope.correlationId };
}

function prefixIssues(
  issues: readonly ContractIssue[],
  prefix: string,
): readonly ContractIssue[] {
  return issues.map((issue) =>
    contractIssue(issue.code, `${prefix}${issue.path}`, issue.message),
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
