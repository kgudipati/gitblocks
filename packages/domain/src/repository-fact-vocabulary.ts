import type {
  CodedRepositoryFact,
  RepositoryFactCategory,
  RepositoryFactVocabularyVersion,
} from './model.ts';

/**
 * The repository-fact vocabulary has its own version because adding a fact
 * code that uses an existing category, subject, and value variant does not
 * change the serialized contract shape.
 */
export const SUPPORTED_REPOSITORY_FACT_VOCABULARY_VERSION =
  '1.0.0' as const satisfies RepositoryFactVocabularyVersion;

export type SupportedRepositoryFactVocabularyVersion =
  typeof SUPPORTED_REPOSITORY_FACT_VOCABULARY_VERSION;

export const REPOSITORY_FACT_CATEGORIES = [
  'repository-capability',
  'repository-structure',
  'identity',
  'data-policy',
  'operations',
] as const satisfies readonly RepositoryFactCategory[];

export const REPOSITORY_FACT_PRESENCE_STATES = [
  'absent',
  'present',
  'unknown',
] as const;

export type RepositoryFactPresenceState = Extract<
  CodedRepositoryFact['value'],
  { readonly kind: 'presence' }
>['state'];

interface NoSubjectDefinition {
  readonly kind: 'none';
}

interface CodedSubjectDefinition {
  readonly kind: 'codes';
  readonly codes: readonly string[];
}

type SubjectDefinition = NoSubjectDefinition | CodedSubjectDefinition;

interface SubjectCodePolicy {
  readonly subject: string | null;
  readonly codes: readonly string[];
}

interface FactDefinitionBase {
  readonly category: RepositoryFactCategory;
  readonly code: string;
  readonly subject: SubjectDefinition;
}

interface PresenceFactDefinition extends FactDefinitionBase {
  readonly value: {
    readonly kind: 'presence';
    readonly states: readonly RepositoryFactPresenceState[];
  };
}

interface ClassificationFactDefinition extends FactDefinitionBase {
  readonly value: {
    readonly kind: 'classification';
    readonly codes: readonly string[];
    readonly codesBySubject: readonly SubjectCodePolicy[] | null;
  };
}

interface CodeSetFactDefinition extends FactDefinitionBase {
  readonly value: {
    readonly kind: 'code-set';
    readonly codes: readonly string[];
    readonly codesBySubject: readonly SubjectCodePolicy[] | null;
    readonly maximumCodes: number;
    readonly minimumCodes: number;
  };
}

interface IntegerFactDefinition extends FactDefinitionBase {
  readonly value: {
    readonly kind: 'integer';
    readonly maximum: number;
    readonly minimum: number;
  };
}

export type RepositoryFactVocabularyDefinition =
  | ClassificationFactDefinition
  | CodeSetFactDefinition
  | IntegerFactDefinition
  | PresenceFactDefinition;

const NO_SUBJECT = { kind: 'none' } as const;
const ALL_PRESENCE_STATES = REPOSITORY_FACT_PRESENCE_STATES;

const IDENTITY_CONTEXTS = [
  'access-token',
  'job-payload',
  'request',
  'route-key',
  'session',
] as const;

const DATA_CATEGORIES = [
  'audit-data',
  'billing-data',
  'invoice-state',
  'job-state',
  'regulated-customer-data',
] as const;

const OPERATIONAL_RESOURCES = [
  'additional-self-hosted-service',
  'background-worker',
  'container-service',
  'database-custom-extensions',
  'database-shared-preload-libraries',
  'durable-process-singleton',
  'external-network',
  'fetch',
  'long-lived-tcp',
  'long-running-node-worker',
  'node-worker-thread',
  'persistent-policy-service',
  'persistent-redis',
  'sidecar',
  'stdout-json-regional-archive',
  'worker-container',
] as const;

/**
 * This registry is deliberately data-only and closed. A vocabulary release may
 * append a code or bounded code value without adding an open metadata carrier
 * to repository facts. New value variants or fields remain schema evolution.
 */
export const REPOSITORY_FACT_VOCABULARY = [
  {
    category: 'repository-capability',
    code: 'redis',
    subject: NO_SUBJECT,
    value: { kind: 'presence', states: ALL_PRESENCE_STATES },
  },
  {
    category: 'repository-capability',
    code: 'transactional-outbox',
    subject: NO_SUBJECT,
    value: { kind: 'presence', states: ALL_PRESENCE_STATES },
  },
  {
    category: 'repository-capability',
    code: 'idempotency-key-mechanism',
    subject: NO_SUBJECT,
    value: { kind: 'presence', states: ALL_PRESENCE_STATES },
  },
  {
    category: 'repository-capability',
    code: 'queue-capability',
    subject: NO_SUBJECT,
    value: { kind: 'presence', states: ALL_PRESENCE_STATES },
  },
  {
    category: 'repository-capability',
    code: 'scheduler-capability',
    subject: NO_SUBJECT,
    value: { kind: 'presence', states: ALL_PRESENCE_STATES },
  },
  {
    category: 'repository-capability',
    code: 'gateway-capability',
    subject: NO_SUBJECT,
    value: { kind: 'presence', states: ALL_PRESENCE_STATES },
  },
  {
    category: 'repository-structure',
    code: 'route-execution-runtimes',
    subject: NO_SUBJECT,
    value: {
      kind: 'code-set',
      codes: ['edge', 'node'],
      codesBySubject: null,
      maximumCodes: 2,
      minimumCodes: 1,
    },
  },
  {
    category: 'repository-structure',
    code: 'workspace-layout',
    subject: NO_SUBJECT,
    value: {
      kind: 'classification',
      codes: ['multi-package', 'single-package'],
      codesBySubject: null,
    },
  },
  {
    category: 'identity',
    code: 'tenant-model',
    subject: NO_SUBJECT,
    value: {
      kind: 'classification',
      codes: ['multi-tenant', 'single-tenant', 'unknown'],
      codesBySubject: null,
    },
  },
  {
    category: 'identity',
    code: 'context-identifiers',
    subject: { kind: 'codes', codes: IDENTITY_CONTEXTS },
    value: {
      kind: 'code-set',
      codes: [
        'account',
        'actor',
        'client',
        'correlation',
        'invoice',
        'media',
        'organization',
        'route',
        'source',
        'tenant',
      ],
      codesBySubject: null,
      maximumCodes: 6,
      minimumCodes: 1,
    },
  },
  {
    category: 'identity',
    code: 'identifier-normalization',
    subject: { kind: 'codes', codes: IDENTITY_CONTEXTS },
    value: {
      kind: 'classification',
      codes: ['none', 'normalized'],
      codesBySubject: null,
    },
  },
  {
    category: 'identity',
    code: 'credential-presence',
    subject: { kind: 'codes', codes: IDENTITY_CONTEXTS },
    value: {
      kind: 'classification',
      codes: ['excluded', 'not-stated'],
      codesBySubject: null,
    },
  },
  {
    category: 'identity',
    code: 'credential-owner',
    subject: { kind: 'codes', codes: ['webhook-endpoint'] },
    value: {
      kind: 'classification',
      codes: ['provider', 'tenant'],
      codesBySubject: null,
    },
  },
  {
    category: 'identity',
    code: 'credential-isolation',
    subject: { kind: 'codes', codes: ['webhook-endpoint'] },
    value: {
      kind: 'classification',
      codes: ['per-provider-endpoint', 'per-tenant'],
      codesBySubject: null,
    },
  },
  {
    category: 'identity',
    code: 'credential-rotation',
    subject: { kind: 'codes', codes: ['webhook-endpoint'] },
    value: {
      kind: 'classification',
      codes: ['independently-rotatable', 'not-stated'],
      codesBySubject: null,
    },
  },
  {
    category: 'data-policy',
    code: 'excluded-data-categories',
    subject: { kind: 'codes', codes: ['audit-payload'] },
    value: {
      kind: 'code-set',
      codes: ['access-token', 'cookie', 'customer-email'],
      codesBySubject: null,
      maximumCodes: 3,
      minimumCodes: 1,
    },
  },
  {
    category: 'data-policy',
    code: 'data-storage',
    subject: { kind: 'codes', codes: DATA_CATEGORIES },
    value: {
      kind: 'classification',
      codes: ['existing-postgresql', 'unspecified'],
      codesBySubject: null,
    },
  },
  {
    category: 'data-policy',
    code: 'data-residency',
    subject: { kind: 'codes', codes: DATA_CATEGORIES },
    value: {
      kind: 'classification',
      codes: ['eu', 'eu-central-1', 'existing-region'],
      codesBySubject: null,
    },
  },
  {
    category: 'data-policy',
    code: 'data-shape-characteristics',
    subject: NO_SUBJECT,
    value: {
      kind: 'code-set',
      codes: [
        'document-tenant-owner-classification',
        'team-project-document-relationships',
      ],
      codesBySubject: null,
      maximumCodes: 8,
      minimumCodes: 1,
    },
  },
  {
    category: 'data-policy',
    code: 'data-store',
    subject: {
      kind: 'codes',
      codes: ['media-and-queue-state', 'rate-limit-counter'],
    },
    value: {
      kind: 'code-set',
      codes: ['existing-postgresql', 'existing-redis', 'upstash-redis'],
      codesBySubject: [
        {
          subject: 'media-and-queue-state',
          codes: ['existing-postgresql', 'existing-redis'],
        },
        { subject: 'rate-limit-counter', codes: ['upstash-redis'] },
      ],
      maximumCodes: 2,
      minimumCodes: 1,
    },
  },
  {
    category: 'data-policy',
    code: 'data-store-content-policy',
    subject: {
      kind: 'codes',
      codes: ['media-and-queue-state', 'rate-limit-counter'],
    },
    value: {
      kind: 'classification',
      codes: ['operational-counters-only', 'repository-declared'],
      codesBySubject: [
        {
          subject: 'media-and-queue-state',
          codes: ['repository-declared'],
        },
        {
          subject: 'rate-limit-counter',
          codes: ['operational-counters-only'],
        },
      ],
    },
  },
  {
    category: 'data-policy',
    code: 'data-lifecycle-policy',
    subject: {
      kind: 'codes',
      codes: ['rate-limit-counter', 'raw-webhook-body'],
    },
    value: {
      kind: 'classification',
      codes: [
        'reset-on-planned-restart-allowed',
        'retain-until-signature-verification',
      ],
      codesBySubject: [
        {
          subject: 'rate-limit-counter',
          codes: ['reset-on-planned-restart-allowed'],
        },
        {
          subject: 'raw-webhook-body',
          codes: ['retain-until-signature-verification'],
        },
      ],
    },
  },
  {
    category: 'data-policy',
    code: 'authorization-data-boundary',
    subject: { kind: 'codes', codes: ['postgresql-rows'] },
    value: {
      kind: 'classification',
      codes: ['application-enforced', 'row-level-security'],
      codesBySubject: null,
    },
  },
  {
    category: 'operations',
    code: 'resource-availability',
    subject: { kind: 'codes', codes: OPERATIONAL_RESOURCES },
    value: { kind: 'presence', states: ALL_PRESENCE_STATES },
  },
  {
    category: 'operations',
    code: 'resource-backing-store',
    subject: { kind: 'codes', codes: ['additional-self-hosted-service'] },
    value: {
      kind: 'classification',
      codes: ['postgresql'],
      codesBySubject: null,
    },
  },
  {
    category: 'operations',
    code: 'resource-instance-capacity',
    subject: { kind: 'codes', codes: ['additional-self-hosted-service'] },
    value: { kind: 'integer', maximum: 10_000, minimum: 0 },
  },
  {
    category: 'operations',
    code: 'database-connection-pooling',
    subject: { kind: 'codes', codes: ['postgresql'] },
    value: {
      kind: 'classification',
      codes: [
        'session-pooling',
        'transaction-pooler-required',
        'unrestricted',
        'unknown',
      ],
      codesBySubject: null,
    },
  },
] as const satisfies readonly RepositoryFactVocabularyDefinition[];

export type SupportedRepositoryFactCode =
  (typeof REPOSITORY_FACT_VOCABULARY)[number]['code'];

export type RepositoryFactSemanticFailureReason =
  | 'category-mismatch'
  | 'integer-out-of-range'
  | 'subject-mismatch'
  | 'value-code-unsupported'
  | 'value-kind-mismatch'
  | 'value-set-duplicate'
  | 'value-set-size';

export type RepositoryFactSemanticValidationResult =
  | {
      readonly ok: true;
      readonly definition: RepositoryFactVocabularyDefinition;
    }
  | {
      readonly ok: false;
      readonly kind: 'unknown-code';
    }
  | {
      readonly ok: false;
      readonly kind: 'unsupported-semantics';
      readonly reason: RepositoryFactSemanticFailureReason;
    };

function containsValue(
  supportedValues: readonly string[],
  value: string,
): boolean {
  return supportedValues.some((supportedValue) => supportedValue === value);
}

function allowedCodesForSubject(
  allCodes: readonly string[],
  codesBySubject: readonly SubjectCodePolicy[] | null,
  subject: string | null,
): readonly string[] {
  if (codesBySubject === null) {
    return allCodes;
  }
  return (
    codesBySubject.find((policy) => policy.subject === subject)?.codes ?? []
  );
}

function supportsSubject(
  definition: RepositoryFactVocabularyDefinition,
  subject: string | null,
): boolean {
  return definition.subject.kind === 'none'
    ? subject === null
    : subject !== null && containsValue(definition.subject.codes, subject);
}

export function isSupportedRepositoryFactVocabularyVersion(
  value: string,
): value is SupportedRepositoryFactVocabularyVersion {
  return value === SUPPORTED_REPOSITORY_FACT_VOCABULARY_VERSION;
}

export function validateRepositoryFactSemantics(
  fact: CodedRepositoryFact,
): RepositoryFactSemanticValidationResult {
  const definition: RepositoryFactVocabularyDefinition | undefined =
    REPOSITORY_FACT_VOCABULARY.find(
      (candidate) => candidate.code === fact.code,
    );
  if (definition === undefined) {
    return { ok: false, kind: 'unknown-code' };
  }
  if (definition.category !== fact.category) {
    return {
      ok: false,
      kind: 'unsupported-semantics',
      reason: 'category-mismatch',
    };
  }
  if (!supportsSubject(definition, fact.subjectCode)) {
    return {
      ok: false,
      kind: 'unsupported-semantics',
      reason: 'subject-mismatch',
    };
  }
  if (definition.value.kind !== fact.value.kind) {
    return {
      ok: false,
      kind: 'unsupported-semantics',
      reason: 'value-kind-mismatch',
    };
  }

  switch (definition.value.kind) {
    case 'presence':
      if (
        fact.value.kind !== 'presence' ||
        !containsValue(definition.value.states, fact.value.state)
      ) {
        return {
          ok: false,
          kind: 'unsupported-semantics',
          reason: 'value-code-unsupported',
        };
      }
      break;
    case 'classification': {
      if (fact.value.kind !== 'classification') {
        return {
          ok: false,
          kind: 'unsupported-semantics',
          reason: 'value-kind-mismatch',
        };
      }
      const allowedCodes = allowedCodesForSubject(
        definition.value.codes,
        definition.value.codesBySubject,
        fact.subjectCode,
      );
      if (!containsValue(allowedCodes, fact.value.code)) {
        return {
          ok: false,
          kind: 'unsupported-semantics',
          reason: 'value-code-unsupported',
        };
      }
      break;
    }
    case 'code-set': {
      if (fact.value.kind !== 'code-set') {
        return {
          ok: false,
          kind: 'unsupported-semantics',
          reason: 'value-kind-mismatch',
        };
      }
      if (
        fact.value.codes.length < definition.value.minimumCodes ||
        fact.value.codes.length > definition.value.maximumCodes
      ) {
        return {
          ok: false,
          kind: 'unsupported-semantics',
          reason: 'value-set-size',
        };
      }
      if (new Set(fact.value.codes).size !== fact.value.codes.length) {
        return {
          ok: false,
          kind: 'unsupported-semantics',
          reason: 'value-set-duplicate',
        };
      }
      const allowedCodes = allowedCodesForSubject(
        definition.value.codes,
        definition.value.codesBySubject,
        fact.subjectCode,
      );
      if (fact.value.codes.some((code) => !containsValue(allowedCodes, code))) {
        return {
          ok: false,
          kind: 'unsupported-semantics',
          reason: 'value-code-unsupported',
        };
      }
      break;
    }
    case 'integer':
      if (
        fact.value.kind !== 'integer' ||
        !Number.isSafeInteger(fact.value.value) ||
        fact.value.value < definition.value.minimum ||
        fact.value.value > definition.value.maximum
      ) {
        return {
          ok: false,
          kind: 'unsupported-semantics',
          reason: 'integer-out-of-range',
        };
      }
      break;
  }

  return { ok: true, definition };
}

export function repositoryFactSemanticKey(fact: CodedRepositoryFact): string {
  return [fact.category, fact.code, fact.subjectCode ?? ''].join('\u0000');
}

export function repositoryFactSemanticAssertion(
  fact: CodedRepositoryFact,
): string {
  switch (fact.value.kind) {
    case 'classification':
      return fact.value.code;
    case 'code-set':
      return [...fact.value.codes].sort().join('\u0000');
    case 'integer':
      return String(fact.value.value);
    case 'presence':
      return fact.value.state;
  }
}
