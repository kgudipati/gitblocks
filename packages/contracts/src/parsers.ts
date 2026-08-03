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
  repositoryArtifactChunkIdentityDigest,
  repositoryArtifactChunkRecordDigest,
  repositoryArtifactContentSha256,
  repositoryArtifactDisplayUrl,
  repositoryArtifactGitBlobObjectId,
  repositoryArtifactIdentityDigest,
  repositoryArtifactRecordDigest,
  repositoryArtifactSetIdentityDigest,
  repositoryArtifactSetRecordDigest,
  splitRepositoryArtifactLogicalLines,
  repositoryArtifactUtf8ByteLength,
} from './artifact-identity.ts';
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
  RepositoryArtifactChunkV1,
  RepositoryArtifactSetV1,
  RepositoryArtifactV1,
} from './schemas.ts';
import {
  candidateDossierV1Validator,
  capabilityRequestV1Validator,
  errorEnvelopeV1Validator,
  fitAssessmentRequestV1Validator,
  fitAssessmentResponseV1Validator,
  repositoryFingerprintV1Validator,
  repositoryArtifactChunkV1Validator,
  repositoryArtifactSetV1Validator,
  repositoryArtifactV1Validator,
  structurallyValidate,
  structurallyValidateRepositoryArtifact,
  type StructuralValidationResult,
} from './structural-validation.ts';

export function parseRepositoryArtifactV1(
  value: unknown,
): ContractParseResult<RepositoryArtifactV1, RepositoryArtifactV1> {
  const structural = structurallyValidateRepositoryArtifact(
    value,
    repositoryArtifactV1Validator,
  );
  return parseArtifactContract(structural, validateRepositoryArtifact);
}

export function parseRepositoryArtifactChunkV1(
  value: unknown,
): ContractParseResult<RepositoryArtifactChunkV1, RepositoryArtifactChunkV1> {
  const structural = structurallyValidateRepositoryArtifact(
    value,
    repositoryArtifactChunkV1Validator,
  );
  return parseArtifactContract(structural, validateRepositoryArtifactChunk);
}

export function parseRepositoryArtifactSetV1(
  value: unknown,
): ContractParseResult<RepositoryArtifactSetV1, RepositoryArtifactSetV1> {
  const structural = structurallyValidateRepositoryArtifact(
    value,
    repositoryArtifactSetV1Validator,
  );
  return parseArtifactContract(structural, validateRepositoryArtifactSet);
}

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

function parseArtifactContract<T>(
  structural: StructuralValidationResult<T>,
  validate: (input: T) => readonly ContractIssue[],
): ContractParseResult<T, T> {
  if (!structural.ok) {
    return structural;
  }
  try {
    const issues = finalizeContractIssues(validate(structural.value));
    if (issues.length > 0) {
      return { ok: false, issues };
    }
    return {
      ok: true,
      value: structural.value,
      domain: structural.value,
      issues: [],
    };
  } catch {
    return unsafeJavaScriptValueRejection();
  }
}

function validateRepositoryArtifact(
  value: RepositoryArtifactV1,
): readonly ContractIssue[] {
  const issues: ContractIssue[] = [];
  const invalidUnicode = hasUnpairedSurrogate(value.content);
  const byteCount = invalidUnicode
    ? -1
    : repositoryArtifactUtf8ByteLength(value.content);
  if (
    byteCount > 256 * 1_024 ||
    byteCount !== value.byteCount ||
    invalidUnicode
  ) {
    issues.push(boundsIssue('/content'));
  }
  if (value.content.includes('\0')) {
    issues.push(patternIssue('/content'));
  }
  if (
    !invalidUnicode &&
    splitRepositoryArtifactLogicalLines(value.content).length !==
      value.lineCount
  ) {
    issues.push(boundsIssue('/lineCount'));
  }
  if (!isSafeArtifactPath(value.path)) {
    issues.push(patternIssue('/path'));
  }
  if (invalidUnicode) {
    return issues;
  }
  if (repositoryArtifactContentSha256(value.content) !== value.contentSha256) {
    issues.push(patternIssue('/contentSha256'));
  }
  if (
    repositoryArtifactGitBlobObjectId(
      value.gitObjectAlgorithm,
      value.content,
    ) !== value.blobObjectId
  ) {
    issues.push(patternIssue('/blobObjectId'));
  }
  if (
    value.blobApiUrl !==
    `https://api.github.com/repositories/${value.providerRepositoryId}/git/blobs/${value.blobObjectId}`
  ) {
    issues.push(patternIssue('/blobApiUrl'));
  }
  if (
    value.displayUrl !== null &&
    value.displayUrl !==
      repositoryArtifactDisplayUrl({
        providerOwner: value.firstMaterialization.providerOwner,
        providerRepository: value.firstMaterialization.providerRepository,
        commitObjectId: value.commitObjectId,
        path: value.path,
      })
  ) {
    issues.push(patternIssue('/displayUrl'));
  }
  const identityDigest = repositoryArtifactIdentityDigest(value);
  if (
    value.identityDigest !== identityDigest ||
    value.artifactId !== `artifact-${identityDigest.slice(0, 48)}`
  ) {
    issues.push(patternIssue('/artifactId'));
  }
  if (repositoryArtifactRecordDigest(value) !== value.recordDigest) {
    issues.push(patternIssue('/recordDigest'));
  }
  return issues;
}

function validateRepositoryArtifactChunk(
  value: RepositoryArtifactChunkV1,
): readonly ContractIssue[] {
  const issues: ContractIssue[] = [];
  const invalidUnicode = hasUnpairedSurrogate(value.content);
  const byteCount = invalidUnicode
    ? -1
    : repositoryArtifactUtf8ByteLength(value.content);
  if (
    byteCount > 16 * 1_024 ||
    byteCount !== value.byteCount ||
    invalidUnicode ||
    value.endByteExclusive - value.startByte !== value.byteCount ||
    value.endByteExclusive < value.startByte
  ) {
    issues.push(boundsIssue('/content'));
  }
  if (
    value.content.includes('\0') ||
    repositoryArtifactContentSha256(value.content) !== value.contentSha256
  ) {
    issues.push(patternIssue('/contentSha256'));
  }
  if (value.endLine < value.startLine) {
    issues.push(boundsIssue('/endLine'));
  }
  if (invalidUnicode) {
    return issues;
  }
  const identityDigest = repositoryArtifactChunkIdentityDigest(value);
  if (
    value.identityDigest !== identityDigest ||
    value.chunkId !== `chunk-${identityDigest.slice(0, 48)}`
  ) {
    issues.push(patternIssue('/chunkId'));
  }
  if (repositoryArtifactChunkRecordDigest(value) !== value.recordDigest) {
    issues.push(patternIssue('/recordDigest'));
  }
  return issues;
}

function validateRepositoryArtifactSet(
  value: RepositoryArtifactSetV1,
): readonly ContractIssue[] {
  const issues: ContractIssue[] = [];
  const selectionIds = new Set<string>();
  const resolvedPaths = new Set<string>();
  for (const [index, entry] of value.entries.entries()) {
    if (entry.ordinal !== index) {
      issues.push(boundsIssue(`/entries/${String(index)}/ordinal`));
    }
    if (
      selectionIds.has(entry.selectionId) ||
      !/^selection-[0-9a-f]{48}$/.test(entry.selectionId)
    ) {
      issues.push(patternIssue(`/entries/${String(index)}/selectionId`));
    }
    selectionIds.add(entry.selectionId);
    if (entry.selector === 'root-readme') {
      if (
        entry.artifactKind !== 'readme' ||
        entry.requirement !== 'optional' ||
        entry.rationale !== null ||
        entry.requestedPath !== null
      ) {
        issues.push(patternIssue(`/entries/${String(index)}`));
      }
    } else if (
      entry.rationale === null ||
      entry.requestedPath === null ||
      !isSafeArtifactPath(entry.requestedPath)
    ) {
      issues.push(patternIssue(`/entries/${String(index)}`));
    }
    if (entry.outcome === 'present') {
      if (
        !isSafeArtifactPath(entry.resolvedPath) ||
        !/^artifact-[0-9a-f]{48}$/.test(entry.artifactId) ||
        resolvedPaths.has(entry.resolvedPath)
      ) {
        issues.push(patternIssue(`/entries/${String(index)}`));
      }
      resolvedPaths.add(entry.resolvedPath);
    }
  }
  const identityInput: Omit<
    RepositoryArtifactSetV1,
    'artifactSetId' | 'identityDigest' | 'recordDigest'
  > = {
    contractVersion: value.contractVersion,
    candidateId: value.candidateId,
    catalogVersion: value.catalogVersion,
    catalogDigest: value.catalogDigest,
    artifactManifestVersion: value.artifactManifestVersion,
    artifactManifestDigest: value.artifactManifestDigest,
    collectorVersion: value.collectorVersion,
    chunkerVersion: value.chunkerVersion,
    provider: value.provider,
    providerRepositoryId: value.providerRepositoryId,
    providerCanonicalOwner: value.providerCanonicalOwner,
    providerCanonicalRepository: value.providerCanonicalRepository,
    gitObjectAlgorithm: value.gitObjectAlgorithm,
    commitObjectId: value.commitObjectId,
    entries: value.entries,
    publishedAt: value.publishedAt,
  };
  const identityDigest = repositoryArtifactSetIdentityDigest(identityInput);
  if (
    value.identityDigest !== identityDigest ||
    value.artifactSetId !== `artifact-set-${identityDigest.slice(0, 48)}`
  ) {
    issues.push(patternIssue('/artifactSetId'));
  }
  if (repositoryArtifactSetRecordDigest(value) !== value.recordDigest) {
    issues.push(patternIssue('/recordDigest'));
  }
  return issues;
}

function isSafeArtifactPath(path: string): boolean {
  if (
    hasUnpairedSurrogate(path) ||
    repositoryArtifactUtf8ByteLength(path) > 512 ||
    path !== path.normalize('NFC') ||
    path.startsWith('/') ||
    path.endsWith('/') ||
    path.includes('\\') ||
    path.includes('%') ||
    path.includes('?') ||
    path.includes('#') ||
    /[\p{Cc}\p{Cf}]/u.test(path)
  ) {
    return false;
  }
  const segments = path.split('/');
  return (
    segments.length <= 8 &&
    segments.every(
      (segment) =>
        segment.length > 0 &&
        segment !== '.' &&
        segment !== '..' &&
        segment.trim() === segment,
    )
  );
}

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) {
        return true;
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function boundsIssue(path: string): ContractIssue {
  return contractIssue(
    'contract.bounds',
    path,
    'Contract value is outside the allowed bounds.',
  );
}

function patternIssue(path: string): ContractIssue {
  return contractIssue(
    'contract.pattern',
    path,
    'Contract value does not match the required pattern.',
  );
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
