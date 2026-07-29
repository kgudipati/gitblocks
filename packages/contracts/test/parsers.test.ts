import { describe, expect, it } from 'vitest';

import {
  MAX_DIAGNOSTIC_ISSUES,
  MAX_DIAGNOSTIC_MESSAGE_LENGTH,
  MAX_DIAGNOSTIC_PATH_LENGTH,
  parseCandidateDossierV1,
  parseCapabilityRequestV1,
  parseErrorEnvelopeV1,
  parseFitAssessmentRequestV1,
  parseFitAssessmentResponseV1,
  parseRepositoryFingerprintV1,
  validateFitAssessmentExchangeV1,
  type ContractIssue,
} from '../src/index.ts';
import {
  cloneValue,
  createCandidateDossier,
  createCapabilityRequest,
  createErrorEnvelope,
  createFitAssessmentRequest,
  createFitAssessmentResponse,
  createRepositoryFingerprint,
} from './fixtures.ts';

describe('V1 parser happy paths', () => {
  it('maps all six root contract families into owned values', () => {
    const results = [
      parseCapabilityRequestV1(createCapabilityRequest()),
      parseRepositoryFingerprintV1(createRepositoryFingerprint()),
      parseCandidateDossierV1(createCandidateDossier('candidate-alpha')),
      parseFitAssessmentRequestV1(createFitAssessmentRequest()),
      parseFitAssessmentResponseV1(createFitAssessmentResponse()),
      parseErrorEnvelopeV1(createErrorEnvelope()),
    ];

    expect(results.every((result) => result.ok)).toBe(true);
    for (const result of results) {
      expect(result.issues).toEqual([]);
      expect(result.ok && result.domain).toBeDefined();
    }
  });

  it('validates a request and response as one fixed-candidate exchange', () => {
    const result = validateFitAssessmentExchangeV1(
      createFitAssessmentRequest(),
      createFitAssessmentResponse(),
    );

    expect(result).toMatchObject({
      ok: true,
      issues: [],
    });
  });

  it('returns a canonical domain value without mutating DTO order', () => {
    const request = createCapabilityRequest();
    request.preferences.push(
      {
        preferenceId: 'prefer-auditability',
        statement: 'Prefer an auditable integration.',
      },
      {
        preferenceId: 'prefer-bounded-state',
        statement: 'Prefer bounded internal state.',
      },
    );
    request.preferences.reverse();
    const originalOrder = request.preferences.map(
      (preference) => preference.preferenceId,
    );

    const result = parseCapabilityRequestV1(request);

    expect(result.ok).toBe(true);
    expect(
      result.ok
        ? result.domain.preferences.map((preference) => preference.preferenceId)
        : [],
    ).toEqual([
      'prefer-auditability',
      'prefer-bounded-state',
      'prefer-small-api',
    ]);
    expect(
      request.preferences.map((preference) => preference.preferenceId),
    ).toEqual(originalOrder);
  });

  it('preserves an absent evidence limitation without inventing a default', () => {
    const dossier = createCandidateDossier('candidate-alpha');
    dossier.observations[0]!.limitation = null;

    const result = parseCandidateDossierV1(dossier);

    expect(result.ok).toBe(true);
    expect(result.ok ? result.domain.evidence[0]?.limitation : undefined).toBe(
      null,
    );
  });
});

describe('structural trust boundary', () => {
  it.each([
    ['capability request', parseCapabilityRequestV1, createCapabilityRequest],
    [
      'repository fingerprint',
      parseRepositoryFingerprintV1,
      createRepositoryFingerprint,
    ],
    [
      'candidate dossier',
      parseCandidateDossierV1,
      () => createCandidateDossier('candidate-alpha'),
    ],
    [
      'fit-assessment request',
      parseFitAssessmentRequestV1,
      createFitAssessmentRequest,
    ],
    [
      'fit-assessment response',
      parseFitAssessmentResponseV1,
      createFitAssessmentResponse,
    ],
    ['error envelope', parseErrorEnvelopeV1, createErrorEnvelope],
  ] as const)('rejects a wrong %s version', (_name, parse, create) => {
    const value = { ...create(), contractVersion: '2.0.0' };

    const result = parse(value);

    expect(result).toMatchObject({
      ok: false,
      issues: [
        {
          code: 'contract.version',
          path: '/contractVersion',
          message: 'Contract version is unsupported.',
        },
      ],
    });
  });

  it.each([
    [
      '/capabilityRequest/contractVersion',
      (request: ReturnType<typeof createFitAssessmentRequest>) => {
        request.capabilityRequest.contractVersion = '2.0.0' as '1.0.0';
      },
    ],
    [
      '/repositoryFingerprint/contractVersion',
      (request: ReturnType<typeof createFitAssessmentRequest>) => {
        request.repositoryFingerprint.contractVersion = '2.0.0' as '1.0.0';
      },
    ],
    [
      '/candidates/0/contractVersion',
      (request: ReturnType<typeof createFitAssessmentRequest>) => {
        request.candidates[0]!.contractVersion = '2.0.0' as '1.0.0';
      },
    ],
  ] as const)('classifies nested wrong version at %s', (path, mutate) => {
    const request = createFitAssessmentRequest();
    mutate(request);

    expect(parseFitAssessmentRequestV1(request)).toMatchObject({
      ok: false,
      issues: [
        {
          code: 'contract.version',
          path,
          message: 'Contract version is unsupported.',
        },
      ],
    });
  });

  it('rejects an extra hidden field without echoing its key or value', () => {
    const secretSentinel = 'sentinel-do-not-return';
    const result = parseCapabilityRequestV1({
      ...createCapabilityRequest(),
      hiddenPrompt: secretSentinel,
    });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.issues)).not.toContain('hiddenPrompt');
    expect(JSON.stringify(result.issues)).not.toContain(secretSentinel);
  });

  it('does not coerce strings into numbers', () => {
    const request = {
      ...createFitAssessmentRequest(),
      requestedMaximumResults: '1',
    };

    expect(parseFitAssessmentRequestV1(request)).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.type' }],
    });
    expect(request.requestedMaximumResults).toBe('1');
  });

  it('does not mutate a deeply frozen accepted input', () => {
    const request = createFitAssessmentRequest();
    const before = cloneValue(request);
    deepFreeze(request);

    const result = parseFitAssessmentRequestV1(request);

    expect(result.ok).toBe(true);
    expect(request).toEqual(before);
  });

  it('keeps arbitrary malicious-looking text inert', () => {
    const request = createCapabilityRequest();
    request.summary =
      '${process.env.SECRET}; import("node:fs"); rm -rf /; <script>alert(1)</script>';

    const result = parseCapabilityRequestV1(request);

    expect(result.ok).toBe(true);
    expect(result.ok ? result.value.summary : '').toBe(request.summary);
  });

  it('rejects accessors without invoking them', () => {
    const request = createCapabilityRequest();
    let invoked = false;
    Object.defineProperty(request, 'hidden', {
      enumerable: true,
      get() {
        invoked = true;
        return 'never-read';
      },
    });

    const result = parseCapabilityRequestV1(request);

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.input-shape' }],
    });
    expect(invoked).toBe(false);
  });

  it('rejects hidden array properties', () => {
    const request = createCapabilityRequest();
    Object.defineProperty(request.successConditions, 'hiddenToken', {
      enumerable: true,
      value: 'private-sentinel',
    });

    const result = parseCapabilityRequestV1(request);

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.input-shape' }],
    });
    expect(JSON.stringify(result.issues)).not.toContain('private-sentinel');
  });

  it('rejects array accessors without invoking them', () => {
    const request = createCapabilityRequest();
    let invoked = 0;
    Object.defineProperty(request.successConditions, '0', {
      enumerable: true,
      get() {
        invoked += 1;
        return createCapabilityRequest().successConditions[0];
      },
    });

    const result = parseCapabilityRequestV1(request);

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.input-shape' }],
    });
    expect(invoked).toBe(0);
  });

  it('rejects cyclic values before schema validation', () => {
    const request: Record<string, unknown> = {
      ...createCapabilityRequest(),
    };
    request['cycle'] = request;

    expect(parseCapabilityRequestV1(request)).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.input-shape' }],
    });
  });

  it('does not echo attacker-controlled keys from deep input', () => {
    const sentinel = 'secret-sentinel-property';
    let value: unknown = 'leaf';
    for (let depth = 0; depth < 40; depth += 1) {
      value = { [sentinel]: value };
    }

    const result = parseCapabilityRequestV1(value);

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.input-depth' }],
    });
    expect(JSON.stringify(result.issues)).not.toContain(sentinel);
  });

  it('bounds and deterministically orders every diagnostic', () => {
    const invalid = Object.fromEntries(
      Array.from({ length: 100 }, (_, index) => [
        `field-${String(index)}`,
        index,
      ]),
    );

    const first = parseFitAssessmentResponseV1(invalid);
    const second = parseFitAssessmentResponseV1(invalid);

    expect(first).toEqual(second);
    expect(first.issues.length).toBeLessThanOrEqual(MAX_DIAGNOSTIC_ISSUES);
    for (const issue of first.issues) {
      assertBoundedIssue(issue);
    }
  });

  it.each(['token', 'rawSource', 'environmentValue', 'stack'])(
    'has no repository-fingerprint carrier for %s',
    (field) => {
      const value: Record<string, unknown> = {
        ...createRepositoryFingerprint(),
        [field]: 'private-sentinel',
      };

      const result = parseRepositoryFingerprintV1(value);

      expect(result).toMatchObject({
        ok: false,
        issues: [{ code: 'contract.additional-property' }],
      });
      expect(JSON.stringify(result.issues)).not.toContain('private-sentinel');
      expect(JSON.stringify(result.issues)).not.toContain(field);
    },
  );

  it('rejects text and secret carriers inside a structured fingerprint fact', () => {
    const fingerprint = createRepositoryFingerprint();
    const identityFact = fingerprint.facts.find(
      (fact) => fact.kind === 'coded' && fact.category === 'identity',
    );
    expect(identityFact).toBeDefined();
    if (identityFact === undefined) {
      return;
    }
    (identityFact as unknown as Record<string, unknown>)['statement'] =
      'const secret = process.env.PRIVATE_TOKEN;';

    const result = parseRepositoryFingerprintV1(fingerprint);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      'contract.additional-property',
    );
    expect(JSON.stringify(result.issues)).not.toContain('PRIVATE_TOKEN');
    expect(JSON.stringify(result.issues)).not.toContain('statement');
  });

  it('rejects raw-source-like component names and configuration-like versions', () => {
    const fingerprint = createRepositoryFingerprint();
    const component = fingerprint.facts.find(
      (fact) => fact.kind === 'component',
    );
    expect(component).toBeDefined();
    if (component?.kind !== 'component') {
      return;
    }
    component.name = 'const source = dangerous()';
    component.version = 'TOKEN=private-sentinel';

    const result = parseRepositoryFingerprintV1(fingerprint);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      'contract.pattern',
    );
    expect(JSON.stringify(result.issues)).not.toContain('private-sentinel');
  });

  it('rejects incoherent controlled fact semantics', () => {
    const fingerprint = createRepositoryFingerprint();
    (fingerprint.facts as unknown[]).push({
      kind: 'coded',
      factId: 'fact-incoherent-fetch',
      category: 'operations',
      code: 'resource-availability',
      subjectCode: 'fetch',
      value: { kind: 'classification', code: 'postgresql' },
      provenance: { ...fingerprint.facts[0]!.provenance },
    });

    const result = parseRepositoryFingerprintV1(fingerprint);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      'domain.fact.semantics-unsupported',
    );
  });

  it.each(['stack', 'internalPath', 'tableName', 'providerPayload'])(
    'rejects unsafe error-envelope detail %s',
    (field) => {
      const value: Record<string, unknown> = {
        ...createErrorEnvelope(),
        [field]: 'private-sentinel',
      };

      const result = parseErrorEnvelopeV1(value);

      expect(result).toMatchObject({
        ok: false,
        issues: [{ code: 'contract.additional-property' }],
      });
      expect(JSON.stringify(result.issues)).not.toContain('private-sentinel');
      expect(JSON.stringify(result.issues)).not.toContain(field);
    },
  );

  it.each([
    '/Users/private/app/src/db.ts',
    '/var/run/private.sock',
    'queue-name?token=private-sentinel',
  ])('rejects unsafe error issue path carrier %s', (path) => {
    const envelope = createErrorEnvelope();
    (
      envelope.issues[0] as unknown as {
        path: string;
      }
    ).path = path;

    const result = parseErrorEnvelopeV1(envelope);

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.literal' }],
    });
    expect(JSON.stringify(result.issues)).not.toContain('private-sentinel');
    expect(JSON.stringify(result.issues)).not.toContain(path);
  });

  it('rejects an error code/message/retry combination that is not stable', () => {
    const envelope = createErrorEnvelope();
    envelope.message = 'The operation could not be completed.';
    envelope.retry = 'later';

    const result = parseErrorEnvelopeV1(envelope);

    expect(result).toMatchObject({
      ok: false,
      issues: [
        { code: 'domain.error-envelope-combination', path: '/message' },
        { code: 'domain.error-envelope-combination', path: '/retry' },
      ],
    });
  });
});

function deepFreeze<Value>(value: Value): Value {
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

function assertBoundedIssue(issue: ContractIssue): void {
  expect(issue.path.length).toBeLessThanOrEqual(MAX_DIAGNOSTIC_PATH_LENGTH);
  expect(issue.message.length).toBeLessThanOrEqual(
    MAX_DIAGNOSTIC_MESSAGE_LENGTH,
  );
}
