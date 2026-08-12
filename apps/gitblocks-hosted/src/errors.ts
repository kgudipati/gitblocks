import { PersistenceError } from '@gitblocks/persistence';

export type HostedDiscoveryErrorCode =
  | 'hosted.application-construction-failed'
  | 'hosted.discovery-failed'
  | 'hosted.internal'
  | 'hosted.invalid-configuration'
  | 'hosted.invalid-request-file'
  | 'hosted.invalid-static-policy'
  | 'hosted.retrieval-engine-construction-failed';

const ERROR_MESSAGES: Readonly<Record<HostedDiscoveryErrorCode, string>> = {
  'hosted.application-construction-failed':
    'Hosted discovery application construction failed.',
  'hosted.discovery-failed': 'Hosted discovery failed.',
  'hosted.internal': 'Hosted discovery operation failed.',
  'hosted.invalid-configuration': 'Hosted discovery configuration is invalid.',
  'hosted.invalid-request-file': 'Hosted discovery request file is invalid.',
  'hosted.invalid-static-policy': 'Hosted discovery static policy is invalid.',
  'hosted.retrieval-engine-construction-failed':
    'Hosted discovery retrieval engine construction failed.',
};

export class HostedDiscoveryError extends Error {
  public readonly code: HostedDiscoveryErrorCode;

  public constructor(code: HostedDiscoveryErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'HostedDiscoveryError';
    this.code = code;
    Object.defineProperty(this, 'stack', {
      configurable: false,
      enumerable: false,
      value: undefined,
      writable: false,
    });
  }
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
