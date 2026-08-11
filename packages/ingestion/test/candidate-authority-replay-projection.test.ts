import { readFile } from 'node:fs/promises';

import {
  parseCapabilityTaxonomyV1,
  type DeterministicProfileFieldRecord,
} from '@gitblocks/contracts';
import { describe, expect, it } from 'vitest';

import {
  CANDIDATE_AUTHORITY_OPERATION_IDS,
  canonicalizeJson,
  parseCandidateAuthorityFieldPlanV4,
  parseCandidateAuthorityPartialSemanticRegistry,
  parseCandidateAuthorityReadinessPolicyV3,
  parsePublicCatalog,
  projectCandidateAuthorityReplayCandidate,
  type CandidateAuthoritySourceCandidateV1,
  type CandidateAuthoritySourceDatum,
} from '../src/index.ts';

const ROOT = new URL('../../../', import.meta.url);
const SHA = '0123456789abcdef0123456789abcdef01234567';
const TREE_SHA = 'fedcba9876543210fedcba9876543210fedcba98';
const CUTOFF = '2026-08-01T00:00:00.000Z';
const AUTHORITY_DIGEST = 'a'.repeat(64);

describe('pure candidate-authority replay projection', () => {
  it('projects source to profile, partial evidence, fit evidence, and exactly one deterministic dossier', async () => {
    const fixture = await fixtureInputs();
    const source = sourceCandidate(fixture.candidate, 'compose');
    const forward = projectCandidateAuthorityReplayCandidate({
      ...fixture,
      sourceCandidate: source,
      sourceAuthorityDigest: AUTHORITY_DIGEST,
      collectionCutoff: CUTOFF,
    });
    const reverse = projectCandidateAuthorityReplayCandidate({
      ...fixture,
      sourceCandidate: { ...source, sources: [...source.sources].reverse() },
      sourceAuthorityDigest: AUTHORITY_DIGEST,
      collectionCutoff: CUTOFF,
    });
    const repeated = projectCandidateAuthorityReplayCandidate({
      ...fixture,
      sourceCandidate: structuredClone(source),
      sourceAuthorityDigest: AUTHORITY_DIGEST,
      collectionCutoff: CUTOFF,
    });

    expect(forward.profile.candidateId).toBe(fixture.candidate.candidateId);
    expect(forward.dossier.identity.candidateId).toBe(
      fixture.candidate.candidateId,
    );
    expect([forward.dossier]).toHaveLength(1);
    expect(forward.partialEvidence.map(({ factCode }) => factCode)).toContain(
      'repository-self-build-compose-service',
    );
    expect(
      forward.evidence.partialFieldEvidenceBindings.length,
    ).toBeGreaterThan(0);
    expect(forward.dossier.unknowns.length).toBeGreaterThan(0);
    expect(
      forward.dossier.unknowns.some(({ statement }) =>
        statement.includes('unmentioned concepts remain unknown'),
      ),
    ).toBe(true);
    expect(
      new Set(forward.dossier.observations.map(({ evidenceId }) => evidenceId))
        .size,
    ).toBe(forward.dossier.observations.length);
    const licenseField = (
      forward.profile
        .fields as unknown as readonly DeterministicProfileFieldRecord[]
    ).find(({ fieldId }) => fieldId === 'license-identity');
    const licenseObservation = forward.dossier.observations.find(
      ({ topic }) => topic === 'candidate-license-identity',
    );
    expect(licenseField?.state).toBe('known');
    const licenseSource = licenseObservation?.source;
    if (licenseSource?.kind !== 'git-commit')
      throw new Error('invalid license evidence fixture');
    expect(licenseSource.commitSha).toBe(SHA);
    expect(licenseSource.immutableUrl).toContain(`/blob/${SHA}/LICENSE.md`);
    expect(licenseSource.immutableUrl).not.toMatch(/\/LICENSE$/u);
    expect(canonicalizeJson(forward).text).toBe(canonicalizeJson(reverse).text);
    expect(canonicalizeJson(forward).text).toBe(
      canonicalizeJson(repeated).text,
    );
  });

  it('realizes deployment partial evidence independently from Compose and Dockerfile facts while retaining profile unknown', async () => {
    const fixture = await fixtureInputs();
    for (const kind of ['compose', 'dockerfile'] as const) {
      const projected = projectCandidateAuthorityReplayCandidate({
        ...fixture,
        sourceCandidate: sourceCandidate(fixture.candidate, kind),
        sourceAuthorityDigest: AUTHORITY_DIGEST,
        collectionCutoff: CUTOFF,
      });
      const deployment = (
        projected.profile
          .fields as unknown as readonly DeterministicProfileFieldRecord[]
      ).find(({ fieldId }) => fieldId === 'deployment-self-hosting');
      expect(deployment?.state).toBe('unknown');
      expect(
        projected.partialEvidence.some(({ factCode }) =>
          kind === 'compose'
            ? factCode === 'repository-self-build-compose-service'
            : factCode === 'repository-container-build-declaration',
        ),
      ).toBe(true);
      expect(
        projected.evidence.partialFieldEvidenceBindings.some(
          ({ fieldId }) => fieldId === 'deployment-self-hosting',
        ),
      ).toBe(true);
    }
  });

  it('preserves another exact safely encoded license path and rejects cross-candidate repository provenance', async () => {
    const fixture = await fixtureInputs();
    const source = sourceCandidate(
      fixture.candidate,
      'compose',
      'legal/Apache License 2.0.txt',
    );
    const projected = projectCandidateAuthorityReplayCandidate({
      ...fixture,
      sourceCandidate: source,
      sourceAuthorityDigest: AUTHORITY_DIGEST,
      collectionCutoff: CUTOFF,
    });
    const observation = projected.dossier.observations.find(
      ({ topic }) => topic === 'candidate-license-identity',
    );
    expect(
      (observation?.source as { immutableUrl?: string } | undefined)
        ?.immutableUrl,
    ).toContain(`/blob/${SHA}/legal/Apache%20License%202.0.txt`);

    const mismatched = replaceLicenseValue(source, (value) => ({
      ...value,
      repositoryIdentity: { owner: 'wrong-owner', repository: 'wrong-repo' },
    }));
    expect(() =>
      projectCandidateAuthorityReplayCandidate({
        ...fixture,
        sourceCandidate: mismatched,
        sourceAuthorityDigest: AUTHORITY_DIGEST,
        collectionCutoff: CUTOFF,
      }),
    ).toThrow();
  });

  it.each(['NOASSERTION', null] as const)(
    'keeps %j license identity unknown and emits no favorable evidence',
    async (spdxId) => {
      const fixture = await fixtureInputs();
      const source = replaceLicenseValue(
        sourceCandidate(fixture.candidate, 'compose'),
        (value) => ({ ...value, spdxId, partialFacts: [] }),
      );
      const projected = projectCandidateAuthorityReplayCandidate({
        ...fixture,
        sourceCandidate: source,
        sourceAuthorityDigest: AUTHORITY_DIGEST,
        collectionCutoff: CUTOFF,
      });
      const licenseField = (
        projected.profile
          .fields as unknown as readonly DeterministicProfileFieldRecord[]
      ).find(({ fieldId }) => fieldId === 'license-identity');
      expect(licenseField?.state).toBe('unknown');
      expect(
        projected.dossier.observations.some(
          ({ topic }) => topic === 'candidate-license-identity',
        ),
      ).toBe(false);
    },
  );

  it('keeps established GitHub license absence unknown without inventing a path', async () => {
    const fixture = await fixtureInputs();
    const source = sourceCandidate(fixture.candidate, 'compose');
    const absent = replaceLicenseDatum(source, {
      operationId: 'github-license',
      outcome: 'established-absence',
      completeness: 'complete',
      limitationCode: null,
      value: null,
    });
    const projected = projectCandidateAuthorityReplayCandidate({
      ...fixture,
      sourceCandidate: absent,
      sourceAuthorityDigest: AUTHORITY_DIGEST,
      collectionCutoff: CUTOFF,
    });
    const licenseField = (
      projected.profile
        .fields as unknown as readonly DeterministicProfileFieldRecord[]
    ).find(({ fieldId }) => fieldId === 'license-identity');
    expect(licenseField?.state).toBe('unknown');
    expect(
      projected.dossier.observations.some(
        ({ topic }) => topic === 'candidate-license-identity',
      ),
    ).toBe(false);
  });
});

async function fixtureInputs() {
  const catalog = parsePublicCatalog(
    await readFile(new URL('catalog/public-v1/manifest.json', ROOT), 'utf8'),
  );
  const taxonomyResult = parseCapabilityTaxonomyV1(
    JSON.parse(
      await readFile(
        new URL('catalog/capability-taxonomy/1.0.0/manifest.json', ROOT),
        'utf8',
      ),
    ) as unknown,
  );
  if (!taxonomyResult.ok) throw new Error('invalid fixture taxonomy');
  const partialSemanticRegistry =
    parseCandidateAuthorityPartialSemanticRegistry(
      await readJson(
        'catalog/public-v1/candidate-authority-partial-field-semantics-v2.json',
      ),
    );
  const readiness = parseCandidateAuthorityReadinessPolicyV3(
    await readJson(
      'catalog/public-v1/candidate-authority-readiness-policy-v3.json',
    ),
  );
  const fieldPlan = parseCandidateAuthorityFieldPlanV4(
    await readJson('catalog/public-v1/candidate-authority-field-plan-v4.json'),
    readiness,
    partialSemanticRegistry,
  );
  const candidate = catalog.candidates[0];
  if (candidate?.npmPackage === undefined || candidate.npmPackage === null)
    throw new Error('invalid fixture candidate');
  return {
    candidate,
    catalog,
    taxonomy: taxonomyResult.value,
    fieldPlan,
    partialSemanticRegistry,
  };
}

function sourceCandidate(
  candidate: Awaited<ReturnType<typeof fixtureInputs>>['candidate'],
  deployment: 'compose' | 'dockerfile',
  licensePath = 'LICENSE.md',
): CandidateAuthoritySourceCandidateV1 {
  const packageName = candidate.npmPackage;
  if (packageName === null) throw new Error('invalid fixture package');
  const unknown = (
    operationId: (typeof CANDIDATE_AUTHORITY_OPERATION_IDS)[number],
  ): CandidateAuthoritySourceDatum => ({
    operationId,
    outcome: 'qualified-unknown',
    completeness: 'partial',
    limitationCode: `fixture-${operationId}-unknown`,
    value: null,
  });
  const values = new Map<
    (typeof CANDIDATE_AUTHORITY_OPERATION_IDS)[number],
    CandidateAuthoritySourceDatum
  >([
    [
      'github-repository-metadata',
      established('github-repository-metadata', {
        repositoryId: '12345',
        canonicalOwner: candidate.github.owner,
        canonicalRepository: candidate.github.repository,
        defaultBranch: 'main',
        archived: false,
        primaryLanguage: 'TypeScript',
        partialFacts: [
          {
            factCode: 'repository-primary-language',
            factValue: 'typescript',
          },
        ],
      }),
    ],
    [
      'github-default-branch-ref',
      established('github-default-branch-ref', {
        ref: 'refs/heads/main',
        objectType: 'commit',
        headSha: SHA,
      }),
    ],
    [
      'github-head-commit-object',
      established('github-head-commit-object', {
        headSha: SHA,
        rootTreeSha: TREE_SHA,
        authorDate: CUTOFF,
        committerDate: CUTOFF,
      }),
    ],
    [
      'github-maintenance-window',
      established('github-maintenance-window', {
        headSha: SHA,
        lastCommitAt: CUTOFF,
        count: 4,
      }),
    ],
    [
      'github-license',
      established('github-license', {
        repositoryIdentity: {
          owner: candidate.github.owner,
          repository: candidate.github.repository,
        },
        headSha: SHA,
        path: licensePath,
        blobSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        spdxId: 'MIT',
        partialFacts: [
          { factCode: 'recognized-license-spdx', factValue: 'MIT' },
        ],
      }),
    ],
    [
      'github-community-profile',
      established('github-community-profile', {
        securityPolicyPresent: true,
      }),
    ],
    [
      'github-release-window',
      established('github-release-window', {
        releases: [
          {
            tagName: 'v1.0.0',
            publishedAt: CUTOFF,
            draft: false,
            prerelease: false,
          },
        ],
        partialFacts: [],
      }),
    ],
    [
      'github-advisories',
      established('github-advisories', {
        packageName,
        packageVersion: '1.0.0',
        advisories: [],
        partialFacts: [],
      }),
    ],
    [
      'npm-package-metadata',
      established('npm-package-metadata', {
        name: packageName,
        selectedVersion: '1.0.0',
        publishedAt: CUTOFF,
        type: 'commonjs',
        nodeEngine: '>=18',
        exportsDeclared: true,
        repositoryIdentity: {
          owner: candidate.github.owner,
          repository: candidate.github.repository,
        },
        partialFacts: [
          {
            factCode: 'importable-runtime-package-surface',
            factValue: `{"entryPointKind":"exports","packageName":"${packageName}","packageVersion":"1.0.0"}`,
          },
          {
            factCode: 'declared-framework-peer-relation',
            factValue:
              '{"framework":"express","packageName":"express","range":"^5.0.0"}',
          },
        ],
      }),
    ],
    [
      'github-root-tree',
      established('github-root-tree', { treeSha: TREE_SHA, entries: [] }),
    ],
  ]);
  const deploymentOperation =
    deployment === 'compose'
      ? 'github-compose-json-blob'
      : 'github-dockerfile-blob';
  values.set(
    deploymentOperation,
    established(deploymentOperation, {
      partialFacts: [
        deployment === 'compose'
          ? {
              factCode: 'repository-self-build-compose-service',
              factValue: 'app',
            }
          : {
              factCode: 'repository-container-build-declaration',
              factValue: `{"contentDigest":"${'b'.repeat(64)}","path":"Dockerfile"}`,
            },
      ],
    }),
  );
  const sources = CANDIDATE_AUTHORITY_OPERATION_IDS.map(
    (operationId) => values.get(operationId) ?? unknown(operationId),
  );
  const withoutDigest = {
    candidateId: candidate.candidateId,
    github: candidate.github,
    npmPackage: packageName,
    sources,
  };
  return {
    ...withoutDigest,
    candidateSourceDigest: canonicalizeJson(withoutDigest).digest,
  };
}

function replaceLicenseValue(
  source: CandidateAuthoritySourceCandidateV1,
  replace: (value: Record<string, unknown>) => Record<string, unknown>,
): CandidateAuthoritySourceCandidateV1 {
  const license = source.sources.find(
    (datum) => datum.operationId === 'github-license',
  );
  if (
    license?.outcome !== 'established-value' ||
    typeof license.value !== 'object' ||
    license.value === null ||
    Array.isArray(license.value)
  )
    throw new Error('invalid license fixture');
  return replaceLicenseDatum(source, {
    ...license,
    value: replace(license.value as Record<string, unknown>),
  });
}

function replaceLicenseDatum(
  source: CandidateAuthoritySourceCandidateV1,
  replacement: CandidateAuthoritySourceDatum,
): CandidateAuthoritySourceCandidateV1 {
  const withoutDigest = {
    candidateId: source.candidateId,
    github: source.github,
    npmPackage: source.npmPackage,
    sources: source.sources.map((datum) =>
      datum.operationId === 'github-license' ? replacement : datum,
    ),
  };
  return {
    ...withoutDigest,
    candidateSourceDigest: canonicalizeJson(withoutDigest).digest,
  };
}

function established(
  operationId: (typeof CANDIDATE_AUTHORITY_OPERATION_IDS)[number],
  value: unknown,
): CandidateAuthoritySourceDatum {
  return {
    operationId,
    outcome: 'established-value',
    completeness: 'complete',
    limitationCode: null,
    value,
  };
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(path, ROOT), 'utf8')) as unknown;
}
