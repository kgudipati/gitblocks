import { describe, expect, it } from 'vitest';

import {
  parseCapabilityRequestV1,
  parseFitAssessmentRequestV1,
  parseFitAssessmentResponseV1,
  parseRepositoryFingerprintV1,
  serializeContractSchemaV1,
  validateFitAssessmentExchangeV1,
} from '../src/index.ts';
import {
  createCapabilityRequest,
  createFitAssessmentRequest,
  createFitAssessmentResponse,
} from './fixtures.ts';

interface MutableRecord {
  [key: string]: unknown;
  assessmentProcessing?: unknown;
  candidateAssessments?: unknown;
  candidateId?: unknown;
  candidateLimitations?: unknown;
  candidates?: unknown;
  completeness?: unknown;
  evidenceIds?: unknown;
  evidence?: unknown;
  facts?: unknown;
  hardConstraintConflictIds?: unknown;
  inferenceIds?: unknown;
  inferences?: unknown;
  limitationCode?: unknown;
  limitationIds?: unknown;
  limitations?: unknown;
  materialUnknowns?: unknown;
  materialClaims?: unknown;
  outcome?: unknown;
  rankGroups?: unknown;
  reasons?: unknown;
  statement?: unknown;
  disposition?: unknown;
  direction?: unknown;
  unknownIds?: unknown;
  unknowns?: unknown;
}

const observedAt = '2026-07-28T20:00:00Z';

function componentFacts(repositoryCode: string): readonly MutableRecord[] {
  const provenance = {
    origin: 'manifest',
    epistemicStatus: 'direct',
    confidence: 'high',
    observedAt,
  };
  return [
    {
      kind: 'component',
      factId: `${repositoryCode}-typescript`,
      component: 'language',
      name: 'typescript',
      version: '6.0.3',
      provenance,
    },
    {
      kind: 'component',
      factId: `${repositoryCode}-nextjs`,
      component: 'framework',
      name: 'nextjs',
      version: '16.4.0',
      provenance,
    },
    {
      kind: 'component',
      factId: `${repositoryCode}-postgresql`,
      component: 'database',
      name: 'postgresql',
      version: '18.0',
      provenance,
    },
  ];
}

function codedFact(
  factId: string,
  category: string,
  code: string,
  value: MutableRecord,
  provenance: MutableRecord,
  subjectCode: string | null = null,
): MutableRecord {
  return {
    kind: 'coded',
    factId,
    category,
    code,
    subjectCode,
    value,
    provenance,
  };
}

function fingerprint(
  repositoryCode: string,
  facts: readonly MutableRecord[],
): MutableRecord {
  return {
    contractVersion: '1.0.0',
    factVocabularyVersion: '1.0.0',
    fingerprintId: `fingerprint-${repositoryCode}`,
    facts: [...componentFacts(repositoryCode), ...facts],
    withheldCategories: [
      'raw-source',
      'configuration-values',
      'environment',
      'credentials',
      'logs',
      'database-content',
      'untracked-files',
      'command-output',
    ],
  };
}

const direct = {
  origin: 'repository-structure',
  epistemicStatus: 'direct',
  confidence: 'high',
  observedAt,
};
const declared = {
  origin: 'supplied-declaration',
  epistemicStatus: 'declared',
  confidence: 'medium',
  observedAt,
};
const derived = {
  origin: 'scanner-analysis',
  epistemicStatus: 'derived',
  confidence: 'medium',
  observedAt,
};

const nonPilotFingerprints = [
  fingerprint('hybrid-runtime', [
    codedFact(
      'hybrid-runtime-routes',
      'repository-structure',
      'route-execution-runtimes',
      { kind: 'code-set', codes: ['node', 'edge'] },
      direct,
    ),
  ]),
  fingerprint('transactional-outbox', [
    codedFact(
      'transactional-outbox-existing',
      'repository-capability',
      'transactional-outbox',
      { kind: 'presence', state: 'present' },
      derived,
    ),
  ]),
  fingerprint('pooler-restricted', [
    codedFact(
      'pooler-restricted-pooling-policy',
      'operations',
      'database-connection-pooling',
      { kind: 'classification', code: 'transaction-pooler-required' },
      declared,
      'postgresql',
    ),
  ]),
  fingerprint('idempotent-api', [
    codedFact(
      'idempotent-api-key',
      'repository-capability',
      'idempotency-key-mechanism',
      { kind: 'presence', state: 'present' },
      declared,
    ),
  ]),
  fingerprint('row-level-security', [
    codedFact(
      'row-level-security-boundary',
      'data-policy',
      'authorization-data-boundary',
      { kind: 'classification', code: 'row-level-security' },
      direct,
      'postgresql-rows',
    ),
  ]),
  fingerprint('queued-scheduled-gateway', [
    codedFact(
      'queued-scheduled-gateway-queue',
      'repository-capability',
      'queue-capability',
      { kind: 'presence', state: 'present' },
      direct,
    ),
    codedFact(
      'queued-scheduled-gateway-scheduler',
      'repository-capability',
      'scheduler-capability',
      { kind: 'presence', state: 'present' },
      direct,
    ),
    codedFact(
      'queued-scheduled-gateway-gateway',
      'repository-capability',
      'gateway-capability',
      { kind: 'presence', state: 'present' },
      direct,
    ),
  ]),
] as const;

function correctedResponse(): MutableRecord {
  const response = createFitAssessmentResponse() as unknown as MutableRecord;
  delete response.completeness;
  response.assessmentProcessing = {
    state: 'complete',
    incompleteReasonCodes: [],
  };
  const assessments = response.candidateAssessments as MutableRecord[];
  assessments[0]!.limitationIds = ['limitation-alpha'];
  assessments[1]!.limitationIds = ['limitation-beta'];
  response.candidateLimitations = [
    {
      limitationId: 'limitation-alpha',
      limitationCode: 'live-validation-not-performed',
      candidateId: 'candidate-alpha',
      statement: 'No live candidate code was installed or executed.',
      evidenceIds: ['evidence-alpha'],
    },
    {
      limitationId: 'limitation-beta',
      limitationCode: 'live-validation-not-performed',
      candidateId: 'candidate-beta',
      statement: 'No live candidate code was installed or executed.',
      evidenceIds: ['evidence-beta'],
    },
  ];
  return response;
}

function correctedRequest(): MutableRecord {
  const request = createFitAssessmentRequest() as unknown as MutableRecord;
  const candidates = request.candidates as MutableRecord[];
  for (const candidate of candidates) {
    const limitations = candidate.limitations as MutableRecord[];
    limitations[0]!.limitationCode = 'live-validation-not-performed';
  }
  return request;
}

describe('independent-review fingerprint corrections', () => {
  it.each(nonPilotFingerprints)(
    'parses a non-pilot repository without changing the contract shape',
    (value) => {
      const schemaBefore = serializeContractSchemaV1('repository-fingerprint');
      expect(parseRepositoryFingerprintV1(value).ok).toBe(true);
      expect(serializeContractSchemaV1('repository-fingerprint')).toBe(
        schemaBefore,
      );
    },
  );

  it('does not enumerate ordinary controlled fact codes in the schema shape', () => {
    const schema = serializeContractSchemaV1('repository-fingerprint');
    expect(schema).not.toContain('transactional-outbox');
    expect(schema).not.toContain('gateway-capability');
  });

  it('rejects an unknown fact code without widening the schema', () => {
    const raw = structuredClone(nonPilotFingerprints[1]);
    const coded = (raw.facts as MutableRecord[]).find(
      (fact) => fact['kind'] === 'coded',
    );
    if (coded === undefined) {
      throw new Error('Expected a coded repository fact.');
    }
    coded['code'] = 'unregistered-capability';
    const parsed = parseRepositoryFingerprintV1(raw);
    expect(parsed.ok).toBe(false);
    expect(parsed.issues.map((issue) => issue.code)).toContain(
      'domain.fact.code-unknown',
    );
  });

  it('rejects an unsupported negotiated fact vocabulary in the domain', () => {
    const raw = structuredClone(nonPilotFingerprints[0]);
    raw['factVocabularyVersion'] = '1.1.0';

    const parsed = parseRepositoryFingerprintV1(raw);

    expect(parsed.ok).toBe(false);
    expect(parsed.issues.map((issue) => issue.code)).toContain(
      'domain.fact.vocabulary-version',
    );
  });

  it('rejects an incoherent repository source and epistemic status', () => {
    const raw = structuredClone(nonPilotFingerprints[0]);
    const firstFact = (raw.facts as MutableRecord[])[0]!;
    firstFact['provenance'] = {
      origin: 'supplied-declaration',
      epistemicStatus: 'direct',
      confidence: 'high',
      observedAt,
    };
    const parsed = parseRepositoryFingerprintV1(raw);
    expect(parsed.ok).toBe(false);
    expect(parsed.issues.map((issue) => issue.code)).toContain(
      'domain.fact.provenance',
    );
  });

  it('preserves direct, declared, and derived epistemic status exactly', () => {
    const statuses = nonPilotFingerprints.slice(0, 3).map((value) => {
      const parsed = parseRepositoryFingerprintV1(value);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) {
        throw new Error('Expected the non-pilot fingerprint to parse.');
      }
      return parsed.domain.facts.find((fact) => fact.kind === 'coded')
        ?.provenance.epistemicStatus;
    });
    expect(statuses).toEqual(['direct', 'derived', 'declared']);
  });

  it.each([
    ['rawSource', 'const secret = process.env.TOKEN'],
    ['configurationValues', { databaseUrl: 'secret-sentinel' }],
    ['environmentValues', ['TOKEN=secret-sentinel']],
    ['secret', 'secret-sentinel'],
    ['logs', ['secret-sentinel']],
    ['commandOutput', 'secret-sentinel'],
    ['metadata', { nested: { arbitrary: 'secret-sentinel' } }],
  ])('rejects the raw carrier %s without echoing its value', (field, value) => {
    const raw = structuredClone(nonPilotFingerprints[0]);
    (raw.facts as MutableRecord[])[3]![field] = value;
    const parsed = parseRepositoryFingerprintV1(raw);
    expect(parsed.ok).toBe(false);
    expect(JSON.stringify(parsed)).not.toContain('secret-sentinel');
  });
});

describe('independent-review reason traceability corrections', () => {
  it('rejects a candidate reason with no related support', () => {
    const response = correctedResponse();
    const assessments = response.candidateAssessments as MutableRecord[];
    const reason = (assessments[0]!.reasons as MutableRecord[])[0]!;
    reason['reasonCode'] = 'maintenance-unknown';
    reason.evidenceIds = [];
    reason.inferenceIds = [];
    reason.unknownIds = [];
    const parsed = parseFitAssessmentResponseV1(response);
    expect(parsed.ok).toBe(false);
    expect(parsed.issues.map((issue) => issue.code)).toContain(
      'domain.reason.traceability',
    );
  });

  it('rejects another candidate evidence as reason support', () => {
    const response = correctedResponse();
    const assessments = response.candidateAssessments as MutableRecord[];
    const reason = (assessments[0]!.reasons as MutableRecord[])[0]!;
    reason.evidenceIds = ['evidence-beta'];
    const parsed = parseFitAssessmentResponseV1(response);
    expect(parsed.ok).toBe(false);
    expect(parsed.issues.map((issue) => issue.code)).toContain(
      'domain.reference.candidate-ownership',
    );
    expect(parsed.issues.map((issue) => issue.code)).toContain(
      'domain.reason.traceability',
    );
  });

  it('rejects another candidate inference as reason support', () => {
    const response = correctedResponse();
    const assessments = response.candidateAssessments as MutableRecord[];
    (response.inferences as MutableRecord[]).push({
      kind: 'inference',
      inferenceId: 'inference-beta',
      candidateId: 'candidate-beta',
      topic: 'runtime-support',
      statement: 'The beta evidence supports a beta-only inference.',
      rationale: 'The inference is owned by candidate beta.',
      evidenceIds: ['evidence-beta'],
    });
    assessments[1]!.inferenceIds = ['inference-beta'];
    const reason = (assessments[0]!.reasons as MutableRecord[])[0]!;
    reason.evidenceIds = [];
    reason.inferenceIds = ['inference-beta'];
    const parsed = parseFitAssessmentResponseV1(response);
    expect(parsed.ok).toBe(false);
    expect(parsed.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'domain.reference.candidate-ownership',
        'domain.reason.traceability',
      ]),
    );
  });

  it('accepts a reason supported only by a disclosed material unknown', () => {
    const response = correctedResponse();
    const assessments = response.candidateAssessments as MutableRecord[];
    const reason = (assessments[0]!.reasons as MutableRecord[])[0]!;
    reason['reasonCode'] = 'maintenance-unknown';
    reason.evidenceIds = [];
    reason.inferenceIds = [];
    reason.unknownIds = ['unknown-maintenance'];
    assessments[0]!.unknownIds = ['unknown-maintenance'];
    (response.materialUnknowns as MutableRecord[]).push({
      scope: 'candidate',
      unknownId: 'unknown-maintenance',
      candidateId: 'candidate-alpha',
      topic: 'maintenance-unknown',
      statement: 'Long-term maintenance remains unknown.',
      evidenceIds: [],
    });
    expect(parseFitAssessmentResponseV1(response).ok).toBe(true);
  });

  it('rejects an unsupported tradeoff even when a favorable claim is valid', () => {
    const response = correctedResponse();
    const assessments = response.candidateAssessments as MutableRecord[];
    (assessments[0]!.reasons as MutableRecord[]).push({
      candidateId: 'candidate-alpha',
      reasonCode: 'unsupported-tradeoff',
      statement: 'An unsupported tradeoff sentinel.',
      evidenceIds: [],
      inferenceIds: [],
      unknownIds: [],
    });
    const parsed = parseFitAssessmentResponseV1(response);
    expect(parsed.ok).toBe(false);
    expect(parsed.issues.map((issue) => issue.code)).toContain(
      'domain.reason.traceability',
    );
    expect(JSON.stringify(parsed)).not.toContain(
      'An unsupported tradeoff sentinel.',
    );
  });

  it('accepts a matching hard-conflict reason with preserved evidence', () => {
    const parsed = parseFitAssessmentResponseV1(correctedResponse());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error('Expected the corrected response to parse.');
    }
    const assessment = parsed.domain.assessments.find(
      (item) => item.candidateId === 'candidate-beta',
    );
    expect(assessment?.reasons[0]?.reasonCode).toBe('runtime-required');
    expect(assessment?.reasons[0]?.evidenceReferences).toEqual([
      {
        kind: 'evidence-reference',
        candidateId: 'candidate-beta',
        evidenceId: 'evidence-beta',
      },
    ]);
  });

  it.each(['rejected', 'insufficient-evidence'] as const)(
    'applies reason traceability to a %s candidate',
    (disposition) => {
      const response = correctedResponse();
      const assessments = response.candidateAssessments as MutableRecord[];
      const alpha = assessments[0]!;
      alpha.disposition = disposition;
      const reason = (alpha.reasons as MutableRecord[])[0]!;
      reason.evidenceIds = [];
      reason.inferenceIds = [];
      reason.unknownIds = [];
      response.outcome =
        disposition === 'rejected'
          ? 'no-viable-candidate'
          : 'insufficient-evidence';
      response.rankGroups = [];
      const claims = response.materialClaims as MutableRecord[];
      claims[0]!.direction =
        disposition === 'rejected' ? 'unfavorable' : 'neutral';
      const parsed = parseFitAssessmentResponseV1(response);
      expect(parsed.ok).toBe(false);
      expect(parsed.issues.map((issue) => issue.code)).toContain(
        'domain.reason.traceability',
      );
    },
  );
});

describe('independent-review limitation and processing corrections', () => {
  it('preserves all supplied limitations in a viable exchange', () => {
    const request = correctedRequest();
    const response = correctedResponse();
    expect(
      validateFitAssessmentExchangeV1(request as never, response as never).ok,
    ).toBe(true);
  });

  it('rejects a supplied limitation that disappears', () => {
    const request = correctedRequest();
    const response = correctedResponse();
    (response.candidateLimitations as MutableRecord[]).pop();
    const assessments = response.candidateAssessments as MutableRecord[];
    assessments[1]!.limitationIds = [];
    const parsed = validateFitAssessmentExchangeV1(
      request as never,
      response as never,
    );
    expect(parsed.ok).toBe(false);
    expect(parsed.issues.map((issue) => issue.code)).toContain(
      'domain.exchange.limitation-preservation',
    );
  });

  it('rejects a limitation moved to another candidate', () => {
    const request = correctedRequest();
    const response = correctedResponse();
    const limitations = response.candidateLimitations as MutableRecord[];
    limitations[0]!.candidateId = 'candidate-beta';
    limitations[0]!.limitationCode = 'moved-live-validation';
    limitations[0]!.statement =
      'The alpha limitation was reassigned to candidate beta.';
    limitations[0]!.evidenceIds = ['evidence-beta'];
    const assessments = response.candidateAssessments as MutableRecord[];
    assessments[0]!.limitationIds = [];
    assessments[1]!.limitationIds = ['limitation-alpha', 'limitation-beta'];
    const parsed = validateFitAssessmentExchangeV1(
      request as never,
      response as never,
    );
    expect(parsed.ok).toBe(false);
    expect(parsed.issues.map((issue) => issue.code)).toContain(
      'domain.exchange.limitation-ownership',
    );
  });

  it.each(['statement', 'evidence'] as const)(
    'rejects an altered limitation %s',
    (field) => {
      const request = correctedRequest();
      const response = correctedResponse();
      const limitation = (response.candidateLimitations as MutableRecord[])[0]!;
      if (field === 'statement') {
        limitation.statement = 'An altered bounded limitation.';
      } else {
        limitation.evidenceIds = [];
      }
      const parsed = validateFitAssessmentExchangeV1(
        request as never,
        response as never,
      );
      expect(parsed.ok).toBe(false);
      expect(parsed.issues.map((issue) => issue.code)).toContain(
        'domain.exchange.limitation-preservation',
      );
    },
  );

  it('rejects a duplicate semantic limitation', () => {
    const response = correctedResponse();
    const evidence = response.evidence as MutableRecord[];
    evidence.push({
      ...structuredClone(evidence[0]!),
      evidenceId: 'evidence-alpha-secondary',
    });
    (response.candidateLimitations as MutableRecord[]).push({
      limitationId: 'limitation-alpha-duplicate',
      limitationCode: 'relabelled-live-validation',
      candidateId: 'candidate-alpha',
      statement: 'No live candidate code was installed or executed.',
      evidenceIds: ['evidence-alpha-secondary'],
    });
    const assessments = response.candidateAssessments as MutableRecord[];
    (assessments[0]!.evidenceIds as unknown[]).push('evidence-alpha-secondary');
    assessments[0]!.limitationIds = [
      'limitation-alpha',
      'limitation-alpha-duplicate',
    ];
    const parsed = parseFitAssessmentResponseV1(response);
    expect(parsed.ok).toBe(false);
    expect(parsed.issues.map((issue) => issue.code)).toContain(
      'domain.limitation.duplicate',
    );
  });

  it('rejects a duplicated dossier limitation with relabeled support', () => {
    const request = correctedRequest();
    const candidates = request.candidates as MutableRecord[];
    const alpha = candidates[0]!;
    const observations = alpha['observations'] as MutableRecord[];
    observations.push({
      ...structuredClone(observations[0]!),
      evidenceId: 'evidence-alpha-secondary',
    });
    (alpha.limitations as MutableRecord[]).push({
      limitationId: 'limitation-alpha-duplicate',
      limitationCode: 'relabelled-live-validation',
      candidateId: 'candidate-alpha',
      statement: 'No live candidate code was installed or executed.',
      evidenceIds: ['evidence-alpha-secondary'],
    });

    const parsed = parseFitAssessmentRequestV1(request);

    expect(parsed.ok).toBe(false);
    expect(parsed.issues.map((issue) => issue.code)).toContain(
      'domain.limitation.duplicate',
    );
  });

  it('rejects contradictory limitations under one semantic code', () => {
    const response = correctedResponse();
    (response.candidateLimitations as MutableRecord[]).push({
      limitationId: 'limitation-alpha-contradiction',
      limitationCode: 'live-validation-not-performed',
      candidateId: 'candidate-alpha',
      statement: 'Live candidate execution was completed.',
      evidenceIds: [],
    });
    const assessments = response.candidateAssessments as MutableRecord[];
    assessments[0]!.limitationIds = [
      'limitation-alpha',
      'limitation-alpha-contradiction',
    ];
    const parsed = parseFitAssessmentResponseV1(response);
    expect(parsed.ok).toBe(false);
    expect(parsed.issues.map((issue) => issue.code)).toContain(
      'domain.limitation.contradictory',
    );
  });

  it('accepts a viable candidate that retains a material tradeoff', () => {
    const response = correctedResponse();
    const assessments = response.candidateAssessments as MutableRecord[];
    assessments[0]!.disposition = 'viable';
    expect(parseFitAssessmentResponseV1(response).ok).toBe(true);
  });

  it('accepts complete processing with an explicit material unknown', () => {
    const response = correctedResponse();
    const assessments = response.candidateAssessments as MutableRecord[];
    assessments[0]!.unknownIds = ['unknown-maintenance'];
    (response.materialUnknowns as MutableRecord[]).push({
      scope: 'candidate',
      unknownId: 'unknown-maintenance',
      candidateId: 'candidate-alpha',
      topic: 'maintenance',
      statement: 'Long-term maintenance remains unknown.',
      evidenceIds: [],
    });
    expect(parseFitAssessmentResponseV1(response).ok).toBe(true);
  });

  it('rejects partial evidence processing without a bounded reason', () => {
    const response = correctedResponse();
    response.assessmentProcessing = {
      state: 'partial-evidence',
      incompleteReasonCodes: [],
    };
    expect(parseFitAssessmentResponseV1(response).ok).toBe(false);
  });

  it('accepts partial evidence processing with explicit reason codes', () => {
    const response = correctedResponse();
    response.assessmentProcessing = {
      state: 'partial-evidence',
      incompleteReasonCodes: ['upstream-source-unavailable'],
    };
    expect(parseFitAssessmentResponseV1(response).ok).toBe(true);
  });

  it('accepts insufficient evidence after complete processing', () => {
    const response = correctedResponse();
    const assessments = response.candidateAssessments as MutableRecord[];
    assessments[0]!.disposition = 'insufficient-evidence';
    assessments[0]!.unknownIds = ['unknown-evidence-gap'];
    response.outcome = 'insufficient-evidence';
    response.rankGroups = [];
    const claims = response.materialClaims as MutableRecord[];
    claims[0]!.direction = 'neutral';
    (response.materialUnknowns as MutableRecord[]).push({
      scope: 'assessment',
      unknownId: 'unknown-evidence-gap',
      topic: 'evidence-availability',
      statement: 'Available evidence does not establish candidate fit.',
      evidenceIds: [],
    });
    expect(parseFitAssessmentResponseV1(response).ok).toBe(true);
  });

  it('rejects insufficient evidence without disclosed uncertainty', () => {
    const response = correctedResponse();
    const assessments = response.candidateAssessments as MutableRecord[];
    assessments[0]!.disposition = 'insufficient-evidence';
    response.outcome = 'insufficient-evidence';
    response.rankGroups = [];
    const claims = response.materialClaims as MutableRecord[];
    claims[0]!.direction = 'neutral';

    const parsed = parseFitAssessmentResponseV1(response);

    expect(parsed.ok).toBe(false);
    expect(parsed.issues.map((issue) => issue.code)).toContain(
      'domain.disposition.uncertainty',
    );
  });

  it('rejects suppression of a supplied unknown independently of processing state', () => {
    const request = correctedRequest();
    const candidates = request.candidates as MutableRecord[];
    (candidates[0]!.unknowns as MutableRecord[]).push({
      scope: 'candidate',
      unknownId: 'unknown-supplied-maintenance',
      candidateId: 'candidate-alpha',
      topic: 'maintenance',
      statement: 'Maintenance capacity remains unknown.',
      evidenceIds: [],
    });
    const parsed = validateFitAssessmentExchangeV1(
      request as never,
      correctedResponse() as never,
    );
    expect(parsed.ok).toBe(false);
    expect(parsed.issues.map((issue) => issue.code)).toContain(
      'domain.exchange.unknown-preservation',
    );
  });
});

describe('already-executable JavaScript values', () => {
  it('contains a throwing Proxy as one bounded safe rejection', () => {
    let trapInvoked = false;
    const proxy = new Proxy(createCapabilityRequest(), {
      get() {
        trapInvoked = true;
        throw new Error('proxy-trap-secret-sentinel');
      },
    });
    let parsed: ReturnType<typeof parseCapabilityRequestV1> | undefined;
    expect(() => {
      parsed = parseCapabilityRequestV1(proxy);
    }).not.toThrow();
    expect(trapInvoked).toBe(true);
    expect(parsed?.ok).toBe(false);
    if (parsed?.ok === false) {
      expect(parsed.issues).toHaveLength(1);
      expect(JSON.stringify(parsed.issues)).not.toContain(
        'proxy-trap-secret-sentinel',
      );
      expect(JSON.stringify(parsed.issues)).not.toContain('stack');
    }
  });
});
