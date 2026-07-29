import {
  parseCandidateDossierV1,
  type CandidateDossierV1,
} from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import { persistenceError } from './errors.ts';
import type {
  CandidateIdentityV1,
  CapabilityFamilyV1,
  OperationControl,
  StorageScope,
} from './types.ts';

const STABLE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const TIMESTAMP_PATTERN =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/u;
const CAPABILITY_FAMILIES = new Set<CapabilityFamilyV1>([
  'authorization',
  'audit-logging',
  'background-jobs',
  'rate-limiting',
  'webhooks',
]);

export interface ValidatedScope {
  readonly scope: 'public' | 'tenant';
  readonly tenantId: string | null;
  readonly expiresAt: string | null;
  readonly scopeKey: string;
}

export function validateScope(scope: StorageScope): ValidatedScope {
  if (scope.kind === 'public') {
    return {
      scope: 'public',
      tenantId: null,
      expiresAt: null,
      scopeKey: 'public',
    };
  }
  validateUuid(scope.tenantId);
  validateTimestamp(scope.expiresAt);
  return {
    scope: 'tenant',
    tenantId: scope.tenantId,
    expiresAt: scope.expiresAt,
    scopeKey: `tenant:${scope.tenantId}`,
  };
}

export function validateStableId(value: string): string {
  if (!STABLE_ID_PATTERN.test(value)) {
    throw persistenceError('persistence.invalid-input');
  }
  return value;
}

export function validateUuid(value: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw persistenceError('persistence.invalid-input');
  }
  return value;
}

export function validateTimestamp(value: string): string {
  if (!TIMESTAMP_PATTERN.test(value) || !Number.isFinite(Date.parse(value))) {
    throw persistenceError('persistence.invalid-input');
  }
  return value;
}

export function validateChronology(earlier: string, later: string): void {
  validateTimestamp(earlier);
  validateTimestamp(later);
  if (Date.parse(earlier) >= Date.parse(later)) {
    throw persistenceError('persistence.invalid-input');
  }
}

export function validateIdentity(
  identity: CandidateIdentityV1,
): CandidateIdentityV1 {
  return validateDossier({
    contractVersion: '1.0.0',
    identity,
    capabilityFamily: 'authorization',
    versionScope: null,
    observations: [],
    limitations: [],
    unknowns: [],
  }).identity;
}

export function validateCapabilityFamilies(
  identity: CandidateIdentityV1,
  values: readonly CapabilityFamilyV1[],
): readonly CapabilityFamilyV1[] {
  if (values.length > CAPABILITY_FAMILIES.size) {
    throw persistenceError('persistence.invalid-input');
  }
  const unique = new Set<CapabilityFamilyV1>();
  for (const value of values) {
    if (!CAPABILITY_FAMILIES.has(value) || unique.has(value)) {
      throw persistenceError('persistence.invalid-input');
    }
    validateDossier({
      contractVersion: '1.0.0',
      identity,
      capabilityFamily: value,
      versionScope: null,
      observations: [],
      limitations: [],
      unknowns: [],
    });
    unique.add(value);
  }
  return [...unique].sort(compareText);
}

export function validateDossier(value: unknown): CandidateDossierV1 {
  const parsed = parseCandidateDossierV1(value);
  if (!parsed.ok) {
    throw persistenceError('persistence.invalid-input');
  }
  return parsed.value;
}

export function validateStoredDossier(value: unknown): CandidateDossierV1 {
  const parsed = parseCandidateDossierV1(value);
  if (!parsed.ok) {
    throw persistenceError('persistence.corrupt-record');
  }
  return parsed.value;
}

export function validateControl(
  control: OperationControl | undefined,
  defaults: {
    readonly statementTimeoutMilliseconds: number;
    readonly lockTimeoutMilliseconds: number;
  },
): {
  readonly signal: AbortSignal | undefined;
  readonly statementTimeoutMilliseconds: number;
  readonly lockTimeoutMilliseconds: number;
} {
  return {
    signal: control?.signal,
    statementTimeoutMilliseconds: validateIntegerBound(
      control?.statementTimeoutMilliseconds ??
        defaults.statementTimeoutMilliseconds,
      1,
      60_000,
    ),
    lockTimeoutMilliseconds: validateIntegerBound(
      control?.lockTimeoutMilliseconds ?? defaults.lockTimeoutMilliseconds,
      1,
      30_000,
    ),
  };
}

export function validateIntegerBound(
  value: number,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw persistenceError('persistence.invalid-input');
  }
  return value;
}

export function validateCanonicalDigest(
  value: unknown,
  expected: string,
): void {
  if (canonicalizeJson(value).digest !== expected) {
    throw persistenceError('persistence.corrupt-record');
  }
}

export function validateReasonCode(value: string): string {
  return validateStableId(value);
}

function compareText(
  left: CapabilityFamilyV1,
  right: CapabilityFamilyV1,
): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
