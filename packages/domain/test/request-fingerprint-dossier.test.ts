import { describe, expect, it } from 'vitest';

import {
  validateCandidateDossier,
  validateCapabilityRequest,
  validateFitAssessmentRequest,
  validateRepositoryFingerprint,
} from '../src/index.ts';
import {
  candidateId,
  createCandidateDossier,
  createCapabilityRequest,
  createEvidence,
  createFitAssessmentRequest,
  createRepositoryFingerprint,
  evidenceReference,
  stableId,
} from './fixtures.ts';

function codes(
  result:
    | { readonly ok: true }
    | {
        readonly ok: false;
        readonly issues: readonly { readonly code: string }[];
      },
): readonly string[] {
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe('capability request invariants', () => {
  it('canonicalizes unordered catalogs without mutating the request', () => {
    const request = createCapabilityRequest();
    request.successConditions = [
      {
        successConditionId: stableId<'success-condition'>('z-last-condition'),
        statement: 'A later condition.',
      },
      ...request.successConditions,
    ];
    const before = structuredClone(request);

    const result = validateCapabilityRequest(request);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        result.value.successConditions.map(
          (condition) => condition.successConditionId,
        ),
      ).toEqual(['tenant-access', 'z-last-condition']);
      expect(result.value).not.toBe(request);
    }
    expect(request).toEqual(before);
  });

  it('rejects malformed and duplicate local catalog identifiers', () => {
    const request = createCapabilityRequest();
    request.successConditions.push({ ...request.successConditions[0]! });
    request.hardConstraints[0] = {
      ...request.hardConstraints[0]!,
      reasonCode: stableId<'reason-code'>('Bad Reason'),
    };

    const result = validateCapabilityRequest(request);

    expect(codes(result)).toEqual(
      expect.arrayContaining(['id.format', 'reference.duplicate-id']),
    );
  });
});

describe('repository fingerprint invariants', () => {
  it('canonicalizes facts and omitted categories on a fresh value', () => {
    const fingerprint = createRepositoryFingerprint();
    const before = structuredClone(fingerprint);

    const result = validateRepositoryFingerprint(fingerprint);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.facts.map((fact) => fact.repositoryFactId)).toEqual([
        'language-typescript',
        'runtime-node',
        'tenant-model',
      ]);
      expect(result.value.omittedCategories).toEqual([
        'configuration-values',
        'raw-source',
      ]);
      expect(result.value.facts).not.toBe(fingerprint.facts);
    }
    expect(fingerprint).toEqual(before);
  });

  it('rejects duplicate identifiers and duplicate semantic facts', () => {
    const fingerprint = createRepositoryFingerprint();
    const runtime = fingerprint.facts[0]!;
    fingerprint.facts.push({ ...runtime });
    fingerprint.facts.push({
      ...runtime,
      repositoryFactId: stableId<'repository-fact'>('runtime-node-duplicate'),
    });

    expect(codes(validateRepositoryFingerprint(fingerprint))).toEqual(
      expect.arrayContaining(['fact.duplicate', 'reference.duplicate-id']),
    );
  });

  it('rejects contradictory semantic facts rather than merging them', () => {
    const fingerprint = createRepositoryFingerprint();
    const runtime = fingerprint.facts[0]!;
    if (runtime.kind !== 'named-version') {
      throw new Error('fixture must contain a named-version runtime fact');
    }
    fingerprint.facts.push({
      ...runtime,
      repositoryFactId: stableId<'repository-fact'>('runtime-node-conflict'),
      version: '22.0.0',
    });

    expect(codes(validateRepositoryFingerprint(fingerprint))).toContain(
      'fact.contradictory',
    );
  });

  it('rejects overlapping residency conflicts and duplicate atomic values', () => {
    const fingerprint = createRepositoryFingerprint();
    const provenance = fingerprint.facts[0]!.provenance;
    fingerprint.facts.push(
      {
        kind: 'data-residency',
        repositoryFactId: stableId<'repository-fact'>('audit-residency-eu'),
        categories: ['audit-data'],
        storage: 'existing-postgresql',
        region: 'eu',
        provenance,
      },
      {
        kind: 'data-residency',
        repositoryFactId: stableId<'repository-fact'>(
          'audit-billing-residency-existing',
        ),
        categories: ['audit-data', 'billing-data'],
        storage: 'existing-postgresql',
        region: 'existing-region',
        provenance,
      },
      {
        kind: 'identity-context',
        repositoryFactId: stableId<'repository-fact'>('duplicate-identifiers'),
        sourceContext: 'request',
        identifiers: ['actor', 'actor'],
        normalization: 'none',
        credentials: 'not-stated',
        provenance,
      },
    );

    expect(codes(validateRepositoryFingerprint(fingerprint))).toEqual(
      expect.arrayContaining([
        'fact.contradictory',
        'reference.duplicate-reference',
      ]),
    );
  });
});

describe('candidate dossier and fit request invariants', () => {
  it('accepts a candidate-owned evidence dossier and canonicalizes it', () => {
    const dossier = createCandidateDossier('alpha');
    dossier.evidence.push(createEvidence('alpha', 'alpha-api', 'api'));

    const result = validateCandidateDossier(dossier);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.evidence.map((item) => item.evidenceId)).toEqual([
        'alpha-api',
        'alpha-license',
      ]);
    }
  });

  it('rejects evidence, unknown, and limitation ownership migration', () => {
    const dossier = createCandidateDossier('beta');
    dossier.evidence[0] = {
      ...dossier.evidence[0]!,
      candidateId: candidateId('alpha'),
    };
    dossier.unknowns[0] = {
      ...dossier.unknowns[0]!,
      candidateId: candidateId('alpha'),
    };
    dossier.limitations.push({
      limitationId: stableId<'limitation'>('limited-api'),
      candidateId: candidateId('alpha'),
      statement: 'The API surface is incomplete.',
      evidenceReferences: [evidenceReference('alpha', 'beta-license')],
    });

    expect(codes(validateCandidateDossier(dossier))).toContain(
      'reference.candidate-ownership',
    );
  });

  it('rejects unresolved dossier evidence references', () => {
    const dossier = createCandidateDossier('beta');
    dossier.unknowns[0] = {
      ...dossier.unknowns[0]!,
      evidenceReferences: [evidenceReference('beta', 'missing-evidence')],
    };

    expect(codes(validateCandidateDossier(dossier))).toContain(
      'reference.unknown-evidence',
    );
  });

  it('requires a bounded unique supplied candidate set in one family', () => {
    const request = createFitAssessmentRequest();
    request.candidateDossiers.push(createCandidateDossier('alpha'));
    request.candidateDossiers[1] = {
      ...request.candidateDossiers[1]!,
      capabilityFamily: 'webhooks',
    };
    request.requestedMaximumResults = 4;

    expect(codes(validateFitAssessmentRequest(request))).toEqual(
      expect.arrayContaining([
        'reference.duplicate-id',
        'request.candidate-family',
        'request.maximum-results',
      ]),
    );
  });

  it('rejects evidence IDs reused by different candidates', () => {
    const request = createFitAssessmentRequest();
    request.candidateDossiers[1] = {
      ...request.candidateDossiers[1]!,
      evidence: [
        {
          ...request.candidateDossiers[1]!.evidence[0]!,
          evidenceId: stableId<'evidence'>('alpha-license'),
        },
      ],
    };

    expect(codes(validateFitAssessmentRequest(request))).toContain(
      'reference.duplicate-id',
    );
  });

  it('rejects material-unknown IDs reused across candidate dossiers', () => {
    const request = createFitAssessmentRequest();
    request.candidateDossiers[0]!.unknowns.push({
      ...request.candidateDossiers[1]!.unknowns[0]!,
      candidateId: candidateId('alpha'),
    });

    expect(codes(validateFitAssessmentRequest(request))).toContain(
      'reference.duplicate-id',
    );
  });

  it('requires transmission approval for every included fact category', () => {
    const request = createFitAssessmentRequest();
    request.capabilityRequest.transmissionApproval.approvedFactCategories = [
      'capability-request',
    ];

    expect(codes(validateFitAssessmentRequest(request))).toContain(
      'request.transmission-approval',
    );
  });
});
