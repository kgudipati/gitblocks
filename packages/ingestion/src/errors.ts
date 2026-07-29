export type IngestionErrorCode =
  | 'ingestion.invalid-input'
  | 'ingestion.invalid-manifest'
  | 'ingestion.invalid-receipt'
  | 'ingestion.identifier-collision'
  | 'ingestion.cancelled'
  | 'ingestion.deadline-exceeded'
  | 'ingestion.provider-not-found'
  | 'ingestion.provider-unavailable'
  | 'ingestion.provider-rate-limited'
  | 'ingestion.provider-authentication'
  | 'ingestion.provider-authorization'
  | 'ingestion.provider-response'
  | 'ingestion.provider-identity'
  | 'ingestion.body-too-large'
  | 'ingestion.content-type'
  | 'ingestion.redirect'
  | 'ingestion.internal-invariant'
  | 'ingestion.persistence';

export type ProviderOutcomeClass =
  | 'established-value'
  | 'established-absence'
  | 'retry-exhausted-temporary-unavailability'
  | 'rate-limited'
  | 'caller-cancellation'
  | 'deadline'
  | 'authentication-failure'
  | 'authorization-failure'
  | 'identity-mismatch'
  | 'malformed-response'
  | 'unsupported-content-type'
  | 'body-too-large'
  | 'unsafe-redirect'
  | 'internal-invariant-failure';

const SAFE_MESSAGES: Readonly<Record<IngestionErrorCode, string>> = {
  'ingestion.invalid-input': 'The ingestion input is invalid.',
  'ingestion.invalid-manifest': 'The public catalog manifest is invalid.',
  'ingestion.invalid-receipt': 'The ingestion receipt is invalid.',
  'ingestion.identifier-collision':
    'A deterministic ingestion identifier collided.',
  'ingestion.cancelled': 'The ingestion request was cancelled by the caller.',
  'ingestion.deadline-exceeded': 'The ingestion deadline was exceeded.',
  'ingestion.provider-not-found':
    'The approved public provider established that the source is absent.',
  'ingestion.provider-unavailable':
    'The approved public provider is temporarily unavailable.',
  'ingestion.provider-rate-limited':
    'The approved public provider rate limit was exceeded.',
  'ingestion.provider-authentication':
    'The approved public provider rejected authentication.',
  'ingestion.provider-authorization':
    'The approved public provider rejected authorization.',
  'ingestion.provider-response':
    'The approved public provider returned an invalid response.',
  'ingestion.provider-identity':
    'The approved public provider identity does not match the catalog.',
  'ingestion.body-too-large':
    'The approved public provider response exceeded its bound.',
  'ingestion.content-type':
    'The approved public provider returned an unsupported content type.',
  'ingestion.redirect':
    'The approved public provider returned an unsafe redirect.',
  'ingestion.internal-invariant':
    'An internal deterministic ingestion invariant failed.',
  'ingestion.persistence': 'The public evidence write could not be completed.',
};

export class IngestionError extends Error {
  public readonly code: IngestionErrorCode;
  public readonly retryable: boolean;
  public readonly retryAfterMilliseconds: number | null;

  public constructor(
    code: IngestionErrorCode,
    retryable = false,
    retryAfterMilliseconds: number | null = null,
  ) {
    super(SAFE_MESSAGES[code]);
    this.name = 'IngestionError';
    this.code = code;
    this.retryable = retryable;
    this.retryAfterMilliseconds = retryAfterMilliseconds;
    Object.defineProperty(this, 'stack', {
      configurable: false,
      enumerable: false,
      value: undefined,
      writable: false,
    });
  }
}

export function ingestionError(
  code: IngestionErrorCode,
  retryable = false,
  retryAfterMilliseconds: number | null = null,
): IngestionError {
  return new IngestionError(code, retryable, retryAfterMilliseconds);
}

export function asSafeErrorCode(error: unknown): IngestionErrorCode {
  return error instanceof IngestionError
    ? error.code
    : 'ingestion.internal-invariant';
}

export function providerOutcomeClass(
  code: IngestionErrorCode,
): ProviderOutcomeClass {
  switch (code) {
    case 'ingestion.provider-not-found':
      return 'established-absence';
    case 'ingestion.provider-unavailable':
      return 'retry-exhausted-temporary-unavailability';
    case 'ingestion.provider-rate-limited':
      return 'rate-limited';
    case 'ingestion.cancelled':
      return 'caller-cancellation';
    case 'ingestion.deadline-exceeded':
      return 'deadline';
    case 'ingestion.provider-authentication':
      return 'authentication-failure';
    case 'ingestion.provider-authorization':
      return 'authorization-failure';
    case 'ingestion.provider-identity':
      return 'identity-mismatch';
    case 'ingestion.provider-response':
      return 'malformed-response';
    case 'ingestion.content-type':
      return 'unsupported-content-type';
    case 'ingestion.body-too-large':
      return 'body-too-large';
    case 'ingestion.redirect':
      return 'unsafe-redirect';
    case 'ingestion.invalid-input':
    case 'ingestion.invalid-manifest':
    case 'ingestion.invalid-receipt':
    case 'ingestion.identifier-collision':
    case 'ingestion.internal-invariant':
    case 'ingestion.persistence':
      return 'internal-invariant-failure';
  }
}
