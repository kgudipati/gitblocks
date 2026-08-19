import { PersistenceError } from '@gitblocks/persistence';

export type HostedDiscoveryErrorCode =
  | 'hosted.application-construction-failed'
  | 'hosted.discovery-failed'
  | 'hosted.fit-model-provider-authentication-failed'
  | 'hosted.fit-model-provider-authorization-failed'
  | 'hosted.fit-model-invalid-response'
  | 'hosted.fit-model-network-failed'
  | 'hosted.fit-model-provider-failed'
  | 'hosted.fit-model-provider-rate-limit-failed'
  | 'hosted.fit-model-provider-request-failed'
  | 'hosted.fit-model-provider-server-failed'
  | 'hosted.fit-model-provider-unexpected-status'
  | 'hosted.fit-model-refused'
  | 'hosted.fit-model-response-too-large'
  | 'hosted.fit-model-timeout'
  | 'hosted.internal'
  | 'hosted.invalid-configuration'
  | 'hosted.invalid-request-file'
  | 'hosted.invalid-static-policy'
  | 'hosted.retrieval-engine-construction-failed';

const ERROR_MESSAGES: Readonly<Record<HostedDiscoveryErrorCode, string>> = {
  'hosted.application-construction-failed':
    'Hosted discovery application construction failed.',
  'hosted.discovery-failed': 'Hosted discovery failed.',
  'hosted.fit-model-provider-authentication-failed':
    'Hosted fit model provider authentication failed.',
  'hosted.fit-model-provider-authorization-failed':
    'Hosted fit model provider authorization failed.',
  'hosted.fit-model-invalid-response':
    'Hosted fit model returned an invalid response.',
  'hosted.fit-model-network-failed': 'Hosted fit model network request failed.',
  'hosted.fit-model-provider-failed':
    'Hosted fit model provider request failed.',
  'hosted.fit-model-provider-rate-limit-failed':
    'Hosted fit model provider quota or rate limit failed.',
  'hosted.fit-model-provider-request-failed':
    'Hosted fit model provider rejected the request.',
  'hosted.fit-model-provider-server-failed':
    'Hosted fit model provider failed to complete the request.',
  'hosted.fit-model-provider-unexpected-status':
    'Hosted fit model provider returned an unexpected status.',
  'hosted.fit-model-refused': 'Hosted fit model declined the request.',
  'hosted.fit-model-response-too-large':
    'Hosted fit model response exceeded the accepted bound.',
  'hosted.fit-model-timeout': 'Hosted fit model request exceeded its deadline.',
  'hosted.internal': 'Hosted discovery operation failed.',
  'hosted.invalid-configuration': 'Hosted discovery configuration is invalid.',
  'hosted.invalid-request-file': 'Hosted discovery request file is invalid.',
  'hosted.invalid-static-policy': 'Hosted discovery static policy is invalid.',
  'hosted.retrieval-engine-construction-failed':
    'Hosted discovery retrieval engine construction failed.',
};

export interface HostedFitModelProviderFailureV1 {
  readonly httpStatus: number;
  readonly errorType?: string;
  readonly errorCode?: string;
}

export class HostedDiscoveryError extends Error {
  public readonly code: HostedDiscoveryErrorCode;
  public readonly providerFailure?: HostedFitModelProviderFailureV1;

  public constructor(
    code: HostedDiscoveryErrorCode,
    providerFailure?: HostedFitModelProviderFailureV1,
  ) {
    super(ERROR_MESSAGES[code]);
    this.name = 'HostedDiscoveryError';
    this.code = code;
    if (providerFailure !== undefined) {
      this.providerFailure = Object.freeze({ ...providerFailure });
    }
    Object.defineProperty(this, 'stack', {
      configurable: false,
      enumerable: false,
      value: undefined,
      writable: false,
    });
  }
}

export function hostedDiscoveryProviderFailure(
  error: unknown,
): HostedFitModelProviderFailureV1 | undefined {
  return error instanceof HostedDiscoveryError
    ? error.providerFailure
    : undefined;
}

export function hostedDiscoveryErrorCode(
  error: unknown,
): HostedDiscoveryErrorCode | PersistenceError['code'] {
  if (
    error instanceof HostedDiscoveryError ||
    error instanceof PersistenceError
  ) {
    return error.code;
  }
  return 'hosted.internal';
}
