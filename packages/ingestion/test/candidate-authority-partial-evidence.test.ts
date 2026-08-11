import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  canonicalizeJson,
  createCandidateAuthorityPartialFieldEvidence,
  parseCandidateAuthorityFieldPlanV4,
  parseCandidateAuthorityPartialSemanticRegistry,
  parseCandidateAuthorityReadinessPolicyV3,
  projectPartialFieldEvidenceToDossier,
  stableId,
  type CandidateAuthorityDossierProjection,
  type CandidateAuthorityPartialFieldEvidence,
} from '../src/index.ts';

const ROOT = new URL('../../../', import.meta.url);
const CANDIDATE_ID = 'fixture-candidate';
const CUTOFF = '2026-08-01T00:00:00.000Z';

async function authorities() {
  const registry = parseCandidateAuthorityPartialSemanticRegistry(
    await readJson(
      'catalog/public-v1/candidate-authority-partial-field-semantics-v2.json',
    ),
  );
  const policy = parseCandidateAuthorityReadinessPolicyV3(
    await readJson(
      'catalog/public-v1/candidate-authority-readiness-policy-v3.json',
    ),
  );
  const plan = parseCandidateAuthorityFieldPlanV4(
    await readJson('catalog/public-v1/candidate-authority-field-plan-v4.json'),
    policy,
    registry,
  );
  return { plan, registry };
}

describe('registry-bound deterministic partial evidence', () => {
  it('survives dossier projection while retaining the unresolved field unknown', async () => {
    const { plan, registry } = await authorities();
    const partial = packageAdoptionEvidence(registry);
    const projection = projectPartialFieldEvidenceToDossier({
      completeProjection: baseProjection(),
      fieldPlan: plan,
      partialSemanticRegistry: registry,
      partialEvidence: [partial],
    });
    expect(projection.dossier.observations).toHaveLength(1);
    expect(projection.dossier.observations[0]?.observation).toContain(
      'factCode=importable-runtime-package-surface',
    );
    expect(projection.dossier.observations[0]?.observation).toContain(
      `factDefinitionDigest=${partial.factDefinitionDigest}`,
    );
    expect(projection.dossier.unknowns[0]?.statement).toContain(
      'all unregistered and unmentioned concepts remain unknown',
    );
    expect(projection.dossier.unknowns[0]?.evidenceIds).toEqual([
      projection.dossier.observations[0]?.evidenceId,
    ]);
    expect(projection.dossier.limitations[0]?.limitationCode).toBe(
      'field-remains-partial-adoption-unit-type',
    );
    expect(projection.partialFieldEvidenceBindings[0]).toEqual(
      expect.objectContaining({
        partialEvidenceId: partial.partialEvidenceId,
        factDefinitionDigest: partial.factDefinitionDigest,
      }),
    );
  });

  it('is stable under input order permutation', async () => {
    const { plan, registry } = await authorities();
    const adoption = packageAdoptionEvidence(registry);
    const language = createCandidateAuthorityPartialFieldEvidence(
      {
        ...partialInput(),
        fieldId: 'language-ecosystem',
        extractionRuleVersion: 'candidate-authority-language-ecosystem/3.0.0',
        factCode: 'repository-primary-language',
        factValue: 'typescript',
        source: repositoryMetadataSource(),
        sourceReference: {
          ...partialInput().sourceReference,
          sourceAuthorityDigest: 'c'.repeat(64),
          sourceRecordDigest: 'd'.repeat(64),
        },
        sourceCompleteness: 'partial',
        unresolvedRemainder:
          'Additional implementation and consumer ecosystems remain unknown.',
      },
      registry,
    );
    const completeProjection = baseProjection({ includeLanguage: true });
    const forward = projectPartialFieldEvidenceToDossier({
      completeProjection,
      fieldPlan: plan,
      partialSemanticRegistry: registry,
      partialEvidence: [adoption, language],
    });
    const reverse = projectPartialFieldEvidenceToDossier({
      completeProjection,
      fieldPlan: plan,
      partialSemanticRegistry: registry,
      partialEvidence: [language, adoption],
    });
    expect(canonicalizeJson(forward).text).toBe(canonicalizeJson(reverse).text);
  });

  it('retains coexisting Compose and Dockerfile facts as distinct evidence for one deployment field', async () => {
    const { plan, registry } = await authorities();
    const compose = deploymentEvidence(
      registry,
      'repository-self-build-compose-service',
      'app',
      '1',
    );
    const dockerfile = deploymentEvidence(
      registry,
      'repository-container-build-declaration',
      `{"contentDigest":"${'a'.repeat(64)}","path":"Dockerfile"}`,
      '2',
    );
    const projection = projectPartialFieldEvidenceToDossier({
      completeProjection: baseProjection({ includeDeployment: true }),
      fieldPlan: plan,
      partialSemanticRegistry: registry,
      partialEvidence: [compose, dockerfile],
    });
    expect(projection.partialFieldEvidenceBindings).toHaveLength(2);
    expect(
      new Set(
        projection.dossier.observations.map(
          (observation) => observation.evidenceId,
        ),
      ).size,
    ).toBe(2);
    expect(
      projection.dossier.observations
        .map(
          (observation) =>
            /factCode=([^;]+)/u.exec(observation.observation)?.[1],
        )
        .sort(),
    ).toEqual([
      'repository-container-build-declaration',
      'repository-self-build-compose-service',
    ]);
    expect(
      projection.dossier.unknowns.find(
        (unknown) => unknown.topic === 'candidate-deployment-self-hosting',
      )?.statement,
    ).toContain('all unregistered and unmentioned concepts remain unknown');
  });

  it('rejects wrong field, wrong rule, wrong provenance, and malformed controlled values', async () => {
    const { registry } = await authorities();
    expect(() =>
      createCandidateAuthorityPartialFieldEvidence(
        { ...partialInput(), fieldId: 'license-identity' },
        registry,
      ),
    ).toThrow();
    expect(() =>
      createCandidateAuthorityPartialFieldEvidence(
        {
          ...partialInput(),
          fieldId: 'license-identity',
          extractionRuleVersion: 'profile-materialization-license/1.0.0',
          factCode: 'recognized-license-spdx',
          factValue: 'NOASSERTION',
          source: gitSource('license'),
        },
        registry,
      ),
    ).toThrow();
    expect(() =>
      createCandidateAuthorityPartialFieldEvidence(
        {
          ...partialInput(),
          fieldId: 'license-identity',
          extractionRuleVersion:
            'candidate-authority-deployment-self-hosting/4.0.0',
          factCode: 'repository-self-build-compose-service',
          factValue: 'app',
          source: gitSource('official-repository'),
        },
        registry,
      ),
    ).toThrow();
    expect(() =>
      createCandidateAuthorityPartialFieldEvidence(
        {
          ...partialInput(),
          extractionRuleVersion:
            'candidate-authority-release-state-recency/2.0.0',
          factCode: 'published-release',
          factValue:
            '{"publishedAt":"2026-07-01T00:00:00.000Z","tagName":"v1.2.3"}',
          source: releaseSnapshotSource(),
          sourceReference: {
            ...partialInput().sourceReference,
            sourceAuthorityDigest: 'e'.repeat(64),
            sourceRecordDigest: 'f'.repeat(64),
          },
          sourceCompleteness: 'partial',
        },
        registry,
      ),
    ).toThrow();
    expect(() =>
      createCandidateAuthorityPartialFieldEvidence(
        {
          ...partialInput(),
          extractionRuleVersion: 'candidate-authority-adoption-unit/2.0.0',
        },
        registry,
      ),
    ).toThrow();
    expect(() =>
      createCandidateAuthorityPartialFieldEvidence(
        { ...partialInput(), source: gitSource('official-repository') },
        registry,
      ),
    ).toThrow();
    expect(() =>
      createCandidateAuthorityPartialFieldEvidence(
        {
          ...partialInput(),
          fieldId: 'framework-compatibility',
          extractionRuleVersion:
            'candidate-authority-framework-compatibility/3.0.0',
          factCode: 'declared-framework-peer-relation',
          factValue:
            '{"framework":"arbitrary","packageName":"express","range":"*"}',
        },
        registry,
      ),
    ).toThrow();
  });

  it('rejects every current negative, including complete-source adoption and Compose negatives', async () => {
    const { registry } = await authorities();
    expect(() =>
      createCandidateAuthorityPartialFieldEvidence(
        { ...partialInput(), polarity: 'negative' },
        registry,
      ),
    ).toThrow();
    expect(() =>
      createCandidateAuthorityPartialFieldEvidence(
        {
          ...partialInput(),
          polarity: 'negative',
          sourceCompleteness: 'partial',
        },
        registry,
      ),
    ).toThrow();
    expect(() =>
      createCandidateAuthorityPartialFieldEvidence(
        {
          ...partialInput(),
          fieldId: 'deployment-self-hosting',
          extractionRuleVersion:
            'candidate-authority-deployment-self-hosting/4.0.0',
          factCode: 'repository-self-build-compose-service',
          factValue: 'app',
          polarity: 'negative',
          source: gitSource('official-repository'),
        },
        registry,
      ),
    ).toThrow();
  });

  it('rejects Dockerfile facts with wrong field, rule, provenance, value, or polarity', async () => {
    const { registry } = await authorities();
    const valid = {
      ...partialInput(),
      fieldId: 'deployment-self-hosting' as const,
      extractionRuleVersion:
        'candidate-authority-deployment-self-hosting/4.0.0',
      factCode: 'repository-container-build-declaration' as const,
      factValue: `{"contentDigest":"${'a'.repeat(64)}","path":"Dockerfile"}`,
      source: gitSource('official-repository'),
    };
    for (const mutation of [
      { ...valid, fieldId: 'license-identity' as const },
      {
        ...valid,
        extractionRuleVersion:
          'candidate-authority-deployment-self-hosting/3.0.0',
      },
      { ...valid, source: gitSource('license') },
      { ...valid, factValue: '{"path":"Dockerfile"}' },
      { ...valid, polarity: 'negative' as const },
    ]) {
      expect(() =>
        createCandidateAuthorityPartialFieldEvidence(mutation, registry),
      ).toThrow();
    }
  });

  it('makes the dossier projector independently reject a digest-valid cross-field forgery', async () => {
    const { plan, registry } = await authorities();
    const valid = packageAdoptionEvidence(registry);
    const forged = forgePartialEvidence(valid, {
      fieldId: 'license-identity',
    });
    expect(() =>
      projectPartialFieldEvidenceToDossier({
        completeProjection: baseProjection(),
        fieldPlan: plan,
        partialSemanticRegistry: registry,
        partialEvidence: [forged],
      }),
    ).toThrow();
  });

  it('rejects a caller-forged semantic registry before fact validation', async () => {
    const { registry } = await authorities();
    const forgedRegistry = {
      ...registry,
      definitions: registry.definitions.map((definition) =>
        definition.factCode === 'importable-runtime-package-surface'
          ? { ...definition, fieldId: 'license-identity' as const }
          : definition,
      ),
    };
    expect(() =>
      createCandidateAuthorityPartialFieldEvidence(
        partialInput(),
        forgedRegistry,
      ),
    ).toThrow();
  });

  it('rejects a partial fact over an already closed profile field', async () => {
    const { plan, registry } = await authorities();
    const base = baseProjection();
    expect(() =>
      projectPartialFieldEvidenceToDossier({
        completeProjection: {
          ...base,
          dossier: { ...base.dossier, unknowns: [] },
        },
        fieldPlan: plan,
        partialSemanticRegistry: registry,
        partialEvidence: [packageAdoptionEvidence(registry)],
      }),
    ).toThrow();
  });
});

function packageAdoptionEvidence(
  registry: Parameters<typeof createCandidateAuthorityPartialFieldEvidence>[1],
) {
  return createCandidateAuthorityPartialFieldEvidence(partialInput(), registry);
}

function deploymentEvidence(
  registry: Parameters<typeof createCandidateAuthorityPartialFieldEvidence>[1],
  factCode:
    | 'repository-container-build-declaration'
    | 'repository-self-build-compose-service',
  factValue: string,
  sourceRecordSuffix: string,
) {
  return createCandidateAuthorityPartialFieldEvidence(
    {
      ...partialInput(),
      fieldId: 'deployment-self-hosting',
      extractionRuleVersion:
        'candidate-authority-deployment-self-hosting/4.0.0',
      factCode,
      factValue,
      source: gitSource('official-repository'),
      sourceReference: {
        ...partialInput().sourceReference,
        sourceRecordDigest: sourceRecordSuffix.repeat(64),
      },
      unresolvedRemainder:
        'Complete deployment-self-hosting semantics remain unknown.',
    },
    registry,
  );
}

function partialInput() {
  return {
    candidateId: CANDIDATE_ID,
    fieldId: 'adoption-unit-type' as const,
    extractionRuleVersion: 'candidate-authority-adoption-unit/3.0.0',
    factCode: 'importable-runtime-package-surface' as const,
    factValue:
      '{"entryPointKind":"exports","packageName":"@example/tool","packageVersion":"1.2.3"}',
    polarity: 'affirmative' as const,
    source: packageSource(),
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

function packageSource() {
  return {
    kind: 'package-version' as const,
    sourceType: 'package-registry' as const,
    sourceUrl: 'https://www.npmjs.com/package/@example/tool',
    packageVersion: '1.2.3',
    immutableUrl: 'https://www.npmjs.com/package/@example/tool/v/1.2.3',
    publishedAt: '2026-07-01T00:00:00.000Z',
    collectedAt: '2026-07-31T00:00:00.000Z',
  };
}

function repositoryMetadataSource() {
  return {
    kind: 'structured-provider-snapshot' as const,
    sourceType: 'public-structured-provider' as const,
    provider: 'github' as const,
    sourceClass: 'repository-metadata' as const,
    sourceIdentity: 'github-repository-fixture',
    sourceUrl: 'https://api.github.com/repos/example/tool',
    sourceAuthorityDigest: 'c'.repeat(64),
    sourceRecordDigest: 'd'.repeat(64),
    collectedAt: '2026-07-31T00:00:00.000Z',
    effectiveAsOf: '2026-07-31T00:00:00.000Z',
    sourceMutability: 'mutable' as const,
    completenessState: 'partial' as const,
    limitationCode: 'source-is-mutable' as const,
  };
}

function releaseSnapshotSource() {
  return {
    kind: 'structured-provider-snapshot' as const,
    sourceType: 'public-structured-provider' as const,
    provider: 'github' as const,
    sourceClass: 'repository-release-state' as const,
    sourceIdentity: 'github-release-fixture',
    sourceUrl: 'https://api.github.com/repos/example/tool/releases',
    sourceAuthorityDigest: 'e'.repeat(64),
    sourceRecordDigest: 'f'.repeat(64),
    collectedAt: '2026-07-31T00:00:00.000Z',
    effectiveAsOf: '2026-07-31T00:00:00.000Z',
    sourceMutability: 'mutable' as const,
    completenessState: 'partial' as const,
    limitationCode: 'source-is-mutable' as const,
  };
}

function gitSource(sourceType: 'license' | 'official-repository') {
  return {
    kind: 'git-commit' as const,
    sourceType,
    sourceUrl: 'https://github.com/example/tool',
    commitSha: '0123456789abcdef0123456789abcdef01234567',
    immutableUrl:
      'https://github.com/example/tool/tree/0123456789abcdef0123456789abcdef01234567',
    publishedAt: '2026-07-01T00:00:00.000Z',
    collectedAt: '2026-07-31T00:00:00.000Z',
  };
}

function forgePartialEvidence(
  original: CandidateAuthorityPartialFieldEvidence,
  changes: Partial<CandidateAuthorityPartialFieldEvidence>,
): CandidateAuthorityPartialFieldEvidence {
  const {
    authorityVersion: ignoredVersion,
    canonicalDigest: ignored,
    partialEvidenceId: ignoredId,
    ...identity
  } = {
    ...original,
    ...changes,
  };
  void ignoredVersion;
  void ignored;
  void ignoredId;
  const withoutDigest = {
    authorityVersion: original.authorityVersion,
    partialEvidenceId: stableId('partial-field', identity),
    ...identity,
  };
  return {
    ...withoutDigest,
    canonicalDigest: canonicalizeJson(withoutDigest).digest,
  };
}

function baseProjection(options?: {
  readonly includeLanguage?: boolean;
  readonly includeDeployment?: boolean;
}): CandidateAuthorityDossierProjection {
  const topics = [
    ['adoption-unit-type', 'candidate-adoption-unit-type'],
    ...(options?.includeLanguage === true
      ? [['language-ecosystem', 'candidate-language-ecosystem']]
      : []),
    ...(options?.includeDeployment === true
      ? [['deployment-self-hosting', 'candidate-deployment-self-hosting']]
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

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(path, ROOT), 'utf8')) as unknown;
}
