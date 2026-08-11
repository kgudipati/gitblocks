import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  canonicalizeJson,
  createCandidateAuthorityPartialFieldEvidence,
  parseCandidateAuthorityFieldPlanV2,
  parseCandidateAuthorityReadinessPolicyV2,
  projectPartialFieldEvidenceToDossier,
  type CandidateAuthorityDossierProjection,
} from '../src/index.ts';

const ROOT = new URL('../../../', import.meta.url);
const CANDIDATE_ID = 'fixture-candidate';
const CUTOFF = '2026-08-01T00:00:00.000Z';

async function fieldPlan() {
  const policy = parseCandidateAuthorityReadinessPolicyV2(
    JSON.parse(
      await readFile(
        new URL(
          'catalog/public-v1/candidate-authority-readiness-policy.json',
          ROOT,
        ),
        'utf8',
      ),
    ) as unknown,
  );
  return parseCandidateAuthorityFieldPlanV2(
    JSON.parse(
      await readFile(
        new URL(
          'catalog/public-v1/candidate-authority-field-plan-v2.json',
          ROOT,
        ),
        'utf8',
      ),
    ) as unknown,
    policy,
  );
}

describe('field-bound deterministic partial evidence', () => {
  it('survives dossier projection while retaining the unresolved field unknown', async () => {
    const plan = await fieldPlan();
    const partial = packageAdoptionEvidence();
    const projection = projectPartialFieldEvidenceToDossier({
      completeProjection: baseProjection(),
      fieldPlan: plan,
      partialEvidence: [partial],
    });
    expect(projection.dossier.observations).toHaveLength(1);
    expect(projection.dossier.observations[0]?.observation).toContain(
      'factCode=published-installable-package',
    );
    expect(projection.dossier.unknowns).toHaveLength(1);
    expect(projection.dossier.unknowns[0]?.statement).toContain(
      'all unmentioned concepts remain unknown',
    );
    expect(projection.dossier.unknowns[0]?.evidenceIds).toEqual([
      projection.dossier.observations[0]?.evidenceId,
    ]);
    expect(projection.dossier.limitations[0]?.limitationCode).toBe(
      'field-remains-partial-adoption-unit-type',
    );
    expect(projection.partialFieldEvidenceBindings[0]?.partialEvidenceId).toBe(
      partial.partialEvidenceId,
    );
  });

  it('is stable under input order permutation', async () => {
    const plan = await fieldPlan();
    const adoption = packageAdoptionEvidence();
    const language = createCandidateAuthorityPartialFieldEvidence({
      ...partialInput(),
      fieldId: 'language-ecosystem',
      extractionRuleVersion: 'candidate-authority-language-ecosystem/2.0.0',
      factCode: 'npm-package-ecosystem',
      factValue: '@example/tool@1.2.3',
      unresolvedRemainder:
        'Additional implementation and consumer ecosystems remain unknown.',
    });
    const completeProjection = baseProjection({ includeLanguage: true });
    const forward = projectPartialFieldEvidenceToDossier({
      completeProjection,
      fieldPlan: plan,
      partialEvidence: [adoption, language],
    });
    const reverse = projectPartialFieldEvidenceToDossier({
      completeProjection,
      fieldPlan: plan,
      partialEvidence: [language, adoption],
    });
    expect(canonicalizeJson(forward).text).toBe(canonicalizeJson(reverse).text);
  });

  it('rejects partial negative evidence and missing unresolved remainder', () => {
    expect(() =>
      createCandidateAuthorityPartialFieldEvidence({
        ...partialInput(),
        polarity: 'negative',
        sourceCompleteness: 'partial',
      }),
    ).toThrow();
    expect(() =>
      createCandidateAuthorityPartialFieldEvidence({
        ...partialInput(),
        unresolvedRemainder: null,
      }),
    ).toThrow();
    expect(() =>
      createCandidateAuthorityPartialFieldEvidence({
        ...partialInput(),
        source: {
          kind: 'structured-provider-snapshot',
          sourceType: 'public-structured-provider',
          provider: 'github',
          sourceClass: 'security-advisory-index',
          sourceIdentity: 'github-advisory-fixture',
          sourceUrl: 'https://api.github.com/advisories',
          sourceAuthorityDigest: 'c'.repeat(64),
          sourceRecordDigest: 'b'.repeat(64),
          collectedAt: '2026-07-31T00:00:00.000Z',
          effectiveAsOf: '2026-07-31T00:00:00.000Z',
          sourceMutability: 'mutable',
          completenessState: 'partial',
          limitationCode: 'source-is-mutable',
        },
        sourceCompleteness: 'partial',
      }),
    ).toThrow();
  });

  it('rejects evidence-source kind disagreement and a partial claim over a closed profile field', async () => {
    const plan = await fieldPlan();
    const wrongSource = createCandidateAuthorityPartialFieldEvidence({
      ...partialInput(),
      source: {
        kind: 'git-commit',
        sourceType: 'official-repository',
        sourceUrl: 'https://github.com/example/tool',
        commitSha: '0123456789abcdef0123456789abcdef01234567',
        immutableUrl:
          'https://github.com/example/tool/tree/0123456789abcdef0123456789abcdef01234567',
        publishedAt: '2026-07-01T00:00:00.000Z',
        collectedAt: '2026-07-31T00:00:00.000Z',
      },
    });
    expect(() =>
      projectPartialFieldEvidenceToDossier({
        completeProjection: baseProjection(),
        fieldPlan: plan,
        partialEvidence: [wrongSource],
      }),
    ).toThrow();
    const base = baseProjection();
    const closed = {
      ...base,
      dossier: { ...base.dossier, unknowns: [] },
    };
    expect(() =>
      projectPartialFieldEvidenceToDossier({
        completeProjection: closed,
        fieldPlan: plan,
        partialEvidence: [packageAdoptionEvidence()],
      }),
    ).toThrow();
  });
});

function packageAdoptionEvidence() {
  return createCandidateAuthorityPartialFieldEvidence(partialInput());
}

function partialInput() {
  return {
    candidateId: CANDIDATE_ID,
    fieldId: 'adoption-unit-type' as const,
    extractionRuleVersion: 'candidate-authority-adoption-unit/2.0.0',
    factCode: 'published-installable-package' as const,
    factValue: '@example/tool@1.2.3',
    polarity: 'affirmative' as const,
    source: {
      kind: 'package-version' as const,
      sourceType: 'package-registry' as const,
      sourceUrl: 'https://www.npmjs.com/package/@example/tool',
      packageVersion: '1.2.3',
      immutableUrl: 'https://www.npmjs.com/package/@example/tool/v/1.2.3',
      publishedAt: '2026-07-01T00:00:00.000Z',
      collectedAt: '2026-07-31T00:00:00.000Z',
    },
    sourceReference: {
      sourceAuthorityVersion: 'candidate-authority-source-authority/1.0.0',
      sourceAuthorityDigest: 'a'.repeat(64),
      sourceRecordDigest: 'b'.repeat(64),
      evidenceIds: [] as string[],
    },
    sourceCompleteness: 'complete' as const,
    fieldCompleteness: 'partial' as const,
    unresolvedRemainder:
      'Other adoption forms and the complete adoption-unit concept set remain unknown.',
    freshness: { cutoff: CUTOFF, asOf: '2026-07-31T00:00:00.000Z' },
  };
}

function baseProjection(options?: {
  readonly includeLanguage?: boolean;
}): CandidateAuthorityDossierProjection {
  const topics = [
    ['adoption-unit-type', 'candidate-adoption-unit-type'],
    ...(options?.includeLanguage === true
      ? [['language-ecosystem', 'candidate-language-ecosystem']]
      : []),
  ] as const;
  return {
    candidateId: CANDIDATE_ID,
    deterministicProfileDigest: 'c'.repeat(64),
    dossier: {
      contractVersion: '1.0.0',
      identity: {
        candidateId: CANDIDATE_ID,
        displayName: 'Fixture Candidate',
        repository: { host: 'github', owner: 'example', name: 'tool' },
        package: { registry: 'npm', name: '@example/tool' },
      },
      capabilityFamily: 'audit-logging',
      versionScope: null,
      observations: [],
      limitations: [],
      unknowns: topics.map(([fieldId, topic]) => ({
        scope: 'candidate' as const,
        unknownId: `unknown-${fieldId}`,
        candidateId: CANDIDATE_ID,
        topic,
        statement: `Field ${fieldId} remains unknown under fixture-rule; no negative claim was inferred.`,
        evidenceIds: [],
      })),
    },
    dossierDigest: 'd'.repeat(64),
    fieldEvidenceBindings: [],
  };
}
