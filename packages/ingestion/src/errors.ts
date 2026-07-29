export type IngestionErrorCode =
  | 'ingestion.invalid-input'
  | 'ingestion.invalid-manifest'
  | 'ingestion.invalid-receipt'
  | 'ingestion.identifier-collision'
  | 'ingestion.deadline-exceeded'
  | 'ingestion.provider-unavailable'
  | 'ingestion.provider-rate-limited'
  | 'ingestion.provider-response'
  | 'ingestion.provider-identity'
  | 'ingestion.body-too-large'
  | 'ingestion.content-type'
  | 'ingestion.redirect'
  | 'ingestion.persistence';

const SAFE_MESSAGES: Readonly<Record<IngestionErrorCode, string>> = {
  'ingestion.invalid-input': 'The ingestion input is invalid.',
  'ingestion.invalid-manifest': 'The public catalog manifest is invalid.',
  'ingestion.invalid-receipt': 'The ingestion receipt is invalid.',
  'ingestion.identifier-collision':
    'A deterministic ingestion identifier collided.',
  'ingestion.deadline-exceeded': 'The ingestion deadline was exceeded.',
  'ingestion.provider-unavailable':
    'The approved public provider is temporarily unavailable.',
  'ingestion.provider-rate-limited':
    'The approved public provider rate limit was exceeded.',
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
    : 'ingestion.provider-unavailable';
}
