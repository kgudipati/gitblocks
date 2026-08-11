import { describe, expect, it } from 'vitest';

import { parseCandidateDossierV1 } from '../src/index.ts';
import { createCandidateDossier, EVIDENCE_CUTOFF } from './fixtures.ts';

const GIT_SHA = '0123456789abcdef0123456789abcdef01234567';
const OTHER_GIT_SHA = '89abcdef0123456789abcdef0123456789abcdef';
const PUBLISHED_AT = '2026-07-28T19:00:00Z';
const COLLECTED_AT = '2026-07-28T20:30:00Z';
const VALIDATED_AT = '2026-07-28T20:15:00Z';

type Source = Readonly<Record<string, unknown>>;

const gitCommitSource = (
  sourceType: 'license' | 'official-documentation' | 'official-repository',
): Source => ({
  kind: 'git-commit',
  sourceType,
  sourceUrl:
    sourceType === 'official-documentation'
      ? 'https://docs.example.com/runtime'
      : 'https://github.com/example/alpha',
  commitSha: GIT_SHA,
  immutableUrl:
    sourceType === 'official-documentation'
      ? `https://docs.example.com/revisions/${GIT_SHA}/runtime`
      : sourceType === 'license'
        ? `https://github.com/example/alpha/blob/${GIT_SHA}/LICENSE`
        : `https://github.com/example/alpha/tree/${GIT_SHA}`,
  publishedAt: PUBLISHED_AT,
  collectedAt: COLLECTED_AT,
});

const tagSource = (
  sourceType: 'license' | 'official-documentation' | 'official-repository',
): Source => ({
  kind: 'tag',
  sourceType,
  sourceUrl:
    sourceType === 'official-documentation'
      ? 'https://docs.example.com/runtime'
      : 'https://github.com/example/alpha',
  tag: 'v1.2.3',
  immutableUrl:
    sourceType === 'official-documentation'
      ? 'https://docs.example.com/tags/v1.2.3/runtime'
      : sourceType === 'license'
        ? 'https://github.com/example/alpha/blob/v1.2.3/LICENSE'
        : 'https://github.com/example/alpha/tree/v1.2.3',
  publishedAt: PUBLISHED_AT,
  collectedAt: COLLECTED_AT,
});

const releaseSource = (): Source => ({
  kind: 'release',
  sourceType: 'official-release',
  sourceUrl: 'https://github.com/example/alpha/releases',
  release: '2026.07.0',
  immutableUrl: 'https://github.com/example/alpha/releases/tag/2026.07.0',
  publishedAt: PUBLISHED_AT,
  collectedAt: COLLECTED_AT,
});

const packageVersionSource = (): Source => ({
  kind: 'package-version',
  sourceType: 'package-registry',
  sourceUrl: 'https://www.npmjs.com/package/example-alpha',
  packageVersion: '1.2.3',
  immutableUrl: 'https://www.npmjs.com/package/example-alpha/v/1.2.3',
  publishedAt: PUBLISHED_AT,
  collectedAt: COLLECTED_AT,
});

const securityAdvisorySource = (): Source => ({
  kind: 'security-advisory',
  sourceType: 'security-advisory',
  sourceUrl: 'https://github.com/advisories',
  advisoryId: 'ghsa-abcd-efgh-ijkl',
  immutableUrl: 'https://github.com/advisories/ghsa-abcd-efgh-ijkl',
  publishedAt: PUBLISHED_AT,
  collectedAt: COLLECTED_AT,
});

const mutableDocumentationSource = (): Source => ({
  kind: 'mutable-documentation',
  sourceType: 'official-documentation',
  sourceUrl: 'https://docs.example.com/runtime',
  limitationCode: 'source-is-mutable',
  collectedAt: COLLECTED_AT,
});

const approvedValidationSource = (): Source => ({
  kind: 'approved-validation',
  sourceType: 'approved-validation',
  validationReferenceId: 'validation-runtime-alpha',
  scope: 'runtime-compatibility',
  validatedAt: VALIDATED_AT,
});

const structuredProviderSnapshotSource = (): Source => ({
  kind: 'structured-provider-snapshot',
  sourceType: 'public-structured-provider',
  provider: 'github',
  sourceClass: 'repository-metadata',
  sourceIdentity: 'github-example-alpha',
  sourceUrl: 'https://api.github.com/repos/example/alpha',
  sourceAuthorityDigest: 'a'.repeat(64),
  sourceRecordDigest: 'b'.repeat(64),
  collectedAt: COLLECTED_AT,
  effectiveAsOf: COLLECTED_AT,
  sourceMutability: 'mutable',
  completenessState: 'complete',
  limitationCode: 'source-is-mutable',
});

const validSources = [
  [
    'Git commit from an official repository',
    gitCommitSource('official-repository'),
  ],
  [
    'Git commit from versioned official documentation',
    gitCommitSource('official-documentation'),
  ],
  ['Git commit containing a license', gitCommitSource('license')],
  ['tag from an official repository', tagSource('official-repository')],
  [
    'tag from versioned official documentation',
    tagSource('official-documentation'),
  ],
  ['tag containing a license', tagSource('license')],
  ['official release', releaseSource()],
  ['package version', packageVersionSource()],
  ['security advisory', securityAdvisorySource()],
  ['mutable official documentation', mutableDocumentationSource()],
  ['public structured-provider snapshot', structuredProviderSnapshotSource()],
  ['approved validation', approvedValidationSource()],
] as const;

const allSourceTypes = [
  'approved-validation',
  'license',
  'official-documentation',
  'official-release',
  'official-repository',
  'package-registry',
  'public-structured-provider',
  'security-advisory',
] as const;

const sourceCompatibilityMatrix = [
  [
    gitCommitSource('official-repository'),
    ['license', 'official-documentation', 'official-repository'],
  ],
  [
    tagSource('official-repository'),
    ['license', 'official-documentation', 'official-repository'],
  ],
  [releaseSource(), ['official-release']],
  [packageVersionSource(), ['package-registry']],
  [securityAdvisorySource(), ['security-advisory']],
  [mutableDocumentationSource(), ['official-documentation']],
  [structuredProviderSnapshotSource(), ['public-structured-provider']],
  [approvedValidationSource(), ['approved-validation']],
] as const;

function parseDossierWithSource(
  source: Source,
  freshnessAsOf = EVIDENCE_CUTOFF,
) {
  const dossier = createCandidateDossier('candidate-alpha');
  const observation = dossier.observations[0] as unknown as {
    freshness: { asOf: string };
    source: Source;
  };
  observation.source = structuredClone(source);
  observation.freshness.asOf = freshnessAsOf;
  return parseCandidateDossierV1(dossier);
}

function expectRejected(source: Source, freshnessAsOf = EVIDENCE_CUTOFF) {
  const result = parseDossierWithSource(source, freshnessAsOf);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.issues;
}

describe('source-aware evidence provenance variants', () => {
  it.each(validSources)('accepts and exactly maps %s', (_label, source) => {
    const result = parseDossierWithSource(source);

    expect(result.ok).toBe(true);
    expect(
      result.ok ? result.domain.evidence[0]?.provenance : undefined,
    ).toEqual(source);
    expect(result.ok ? result.domain.evidence[0]?.directness : undefined).toBe(
      'direct',
    );
  });

  it('rejects every incompatible source and provenance-kind pairing', () => {
    for (const [source, allowedSourceTypes] of sourceCompatibilityMatrix) {
      for (const sourceType of allSourceTypes) {
        if (
          (allowedSourceTypes as readonly string[]).some(
            (allowed) => allowed === sourceType,
          )
        ) {
          continue;
        }
        const parsed = parseDossierWithSource({ ...source, sourceType });
        expect(parsed.ok, `${String(source['kind'])}/${sourceType}`).toBe(
          false,
        );
      }
    }
  });

  it.each([
    [
      'a Git commit classified as an official release',
      {
        ...gitCommitSource('official-repository'),
        sourceType: 'official-release',
      },
    ],
    [
      'a tag classified as a package-registry source',
      { ...tagSource('official-repository'), sourceType: 'package-registry' },
    ],
    [
      'a release classified as an official repository',
      { ...releaseSource(), sourceType: 'official-repository' },
    ],
    [
      'a package version classified as an official release',
      { ...packageVersionSource(), sourceType: 'official-release' },
    ],
    [
      'an advisory classified as official documentation',
      { ...securityAdvisorySource(), sourceType: 'official-documentation' },
    ],
    [
      'mutable documentation classified as an official repository',
      {
        ...mutableDocumentationSource(),
        sourceType: 'official-repository',
      },
    ],
    [
      'an approved validation classified as official documentation',
      {
        ...approvedValidationSource(),
        sourceType: 'official-documentation',
      },
    ],
  ] as const)('structurally rejects %s', (_label, source) => {
    const issues = expectRejected(source);

    expect(issues.some((issue) => issue.code.startsWith('contract.'))).toBe(
      true,
    );
  });

  it.each([
    [
      'a Git commit without a publication timestamp',
      { ...gitCommitSource('official-repository'), publishedAt: null },
    ],
    [
      'mutable documentation with a false immutable locator',
      {
        ...mutableDocumentationSource(),
        immutableUrl: 'https://docs.example.com/runtime/frozen',
      },
    ],
    [
      'mutable documentation without its explicit limitation',
      Object.fromEntries(
        Object.entries(mutableDocumentationSource()).filter(
          ([key]) => key !== 'limitationCode',
        ),
      ),
    ],
    [
      'approved validation pretending to have a public source URL',
      {
        ...approvedValidationSource(),
        sourceUrl: 'https://validation.example.com/results/runtime-alpha',
      },
    ],
    [
      'approved validation pretending to have a Git revision',
      {
        ...approvedValidationSource(),
        commitSha: GIT_SHA,
        immutableUrl: `https://validation.example.com/results/${GIT_SHA}`,
      },
    ],
  ] as const)('structurally rejects %s', (_label, source) => {
    const issues = expectRejected(source);

    expect(issues.some((issue) => issue.code.startsWith('contract.'))).toBe(
      true,
    );
  });
});

describe('immutable evidence revision rules', () => {
  it.each([
    ['short', 'abc123'],
    ['uppercase', GIT_SHA.toUpperCase()],
    ['long', `${GIT_SHA}0`],
  ] as const)('rejects a %s Git commit SHA', (_label, commitSha) => {
    expectRejected({
      ...gitCommitSource('official-repository'),
      commitSha,
      immutableUrl: `https://github.com/example/alpha/tree/${commitSha}`,
    });
  });

  it.each([
    ['tag', tagSource('official-repository'), 'tag'],
    ['release', releaseSource(), 'release'],
    ['package version', packageVersionSource(), 'packageVersion'],
  ] as const)(
    'rejects every mutable alias used as a %s revision',
    (_label, source, revisionField) => {
      for (const alias of [
        'latest',
        'current',
        'stable',
        'next',
        'main',
        'master',
        'head',
        'canary',
        'LATEST',
        'Head',
      ]) {
        const issues = expectRejected({
          ...source,
          [revisionField]: alias,
          immutableUrl: `https://revisions.example.com/${alias}`,
        });
        expect(
          issues.some(
            (issue) =>
              issue.path === alias ||
              issue.message === alias ||
              issue.path.includes(`/${alias}`),
          ),
        ).toBe(false);
      }
    },
  );

  it.each([
    ['tag', tagSource('official-repository'), 'tag'],
    ['release', releaseSource(), 'release'],
  ] as const)(
    'rejects branch references and embedded mutable aliases used as a %s revision',
    (_label, source, revisionField) => {
      for (const revision of [
        'refs/heads/main',
        'refs/remotes/origin/stable',
        'origin/main',
        'latest.1',
        'release-current',
        'v1.2.3@canary',
      ]) {
        const parsed = parseDossierWithSource({
          ...source,
          [revisionField]: revision,
          immutableUrl: `https://revisions.example.com/${encodeURIComponent(revision)}`,
        });
        expect(parsed.ok, revision).toBe(false);
      }
    },
  );

  it.each([
    '1.x',
    '1.2',
    'latest.1',
    'refs/heads/main',
    'origin/main',
    '1.2.3@latest',
    '1.2.3-01',
    '1.2.3-alpha.01',
  ])('rejects non-exact package version %s', (packageVersion) => {
    expectRejected({
      ...packageVersionSource(),
      packageVersion,
      immutableUrl: `https://www.npmjs.com/package/example-alpha/v/${encodeURIComponent(packageVersion)}`,
    });
  });

  it.each([
    '1.2.3-rc.1+build.5',
    '1.2.3-0',
    '1.2.3-alpha.0',
    '2.0.0-canary.123',
    '2.0.0-next.1',
  ])('accepts exact prerelease package version %s', (packageVersion) => {
    expect(
      parseDossierWithSource({
        ...packageVersionSource(),
        packageVersion,
        immutableUrl: `https://www.npmjs.com/package/example-alpha/v/${packageVersion}`,
      }).ok,
    ).toBe(true);
  });

  it.each(['v2.0.0-canary.123', 'v2.0.0-next.1'])(
    'accepts concrete prerelease tag %s',
    (tag) => {
      expect(
        parseDossierWithSource({
          ...tagSource('official-repository'),
          tag,
          immutableUrl: `https://github.com/example/alpha/tree/${tag}`,
        }).ok,
      ).toBe(true);
    },
  );

  it.each([
    [
      'Git commit',
      {
        ...gitCommitSource('official-repository'),
        immutableUrl: `https://github.com/example/alpha/tree/${OTHER_GIT_SHA}`,
      },
    ],
    [
      'tag',
      {
        ...tagSource('official-repository'),
        immutableUrl: 'https://github.com/example/alpha/tree/v9.9.9',
      },
    ],
    [
      'release',
      {
        ...releaseSource(),
        immutableUrl: 'https://github.com/example/alpha/releases/tag/2026.08.0',
      },
    ],
    [
      'package version',
      {
        ...packageVersionSource(),
        immutableUrl: 'https://www.npmjs.com/package/example-alpha/v/9.9.9',
      },
    ],
    [
      'security advisory',
      {
        ...securityAdvisorySource(),
        immutableUrl: 'https://github.com/advisories/ghsa-zzzz-yyyy-xxxx',
      },
    ],
  ] as const)(
    'domain-rejects an immutable %s locator mismatch',
    (_label, source) => {
      const issues = expectRejected(source);

      expect(issues.some((issue) => issue.code.startsWith('domain.'))).toBe(
        true,
      );
    },
  );
});

describe('evidence provenance chronology', () => {
  it.each([
    [
      'publication after collection',
      {
        ...gitCommitSource('official-repository'),
        publishedAt: '2026-07-28T20:45:00Z',
      },
      EVIDENCE_CUTOFF,
    ],
    [
      'collection after freshness',
      {
        ...gitCommitSource('official-repository'),
        collectedAt: '2026-07-28T21:15:00Z',
      },
      EVIDENCE_CUTOFF,
    ],
    [
      'mutable-documentation collection after freshness',
      {
        ...mutableDocumentationSource(),
        collectedAt: '2026-07-28T21:15:00Z',
      },
      EVIDENCE_CUTOFF,
    ],
    [
      'approved validation after freshness',
      {
        ...approvedValidationSource(),
        validatedAt: '2026-07-28T21:15:00Z',
      },
      EVIDENCE_CUTOFF,
    ],
    [
      'structured snapshot effective time after collection',
      {
        ...structuredProviderSnapshotSource(),
        effectiveAsOf: '2026-07-28T20:45:00Z',
      },
      EVIDENCE_CUTOFF,
    ],
  ] as const)('domain-rejects %s', (_label, source, freshnessAsOf) => {
    const issues = expectRejected(source, freshnessAsOf);

    expect(issues.some((issue) => issue.code.startsWith('domain.'))).toBe(true);
  });
});

describe('closed and safe evidence provenance', () => {
  it.each([
    [
      'raw source body',
      {
        ...gitCommitSource('official-repository'),
        sourceBody: 'private-source-body-sentinel',
      },
      'private-source-body-sentinel',
    ],
    [
      'raw provider result',
      {
        ...approvedValidationSource(),
        providerResult: { private: 'provider-result-sentinel' },
      },
      'provider-result-sentinel',
    ],
    [
      'validation output',
      {
        ...approvedValidationSource(),
        validationOutput: 'validation-output-sentinel',
      },
      'validation-output-sentinel',
    ],
    [
      'arbitrary nested metadata',
      {
        ...releaseSource(),
        metadata: { nested: { private: 'metadata-sentinel' } },
      },
      'metadata-sentinel',
    ],
    [
      'structured provider raw body',
      {
        ...structuredProviderSnapshotSource(),
        rawBody: 'structured-body-sentinel',
      },
      'structured-body-sentinel',
    ],
  ] as const)(
    'rejects %s without echoing its value',
    (_label, source, sentinel) => {
      const issues = expectRejected(source);

      expect(
        issues.some((issue) => issue.code === 'contract.additional-property'),
      ).toBe(true);
      expect(JSON.stringify(issues)).not.toContain(sentinel);
    },
  );

  it('rejects a secret-bearing URL query without leaking its value', () => {
    const secret = 'secret-query-value-sentinel';
    const source = {
      ...gitCommitSource('official-repository'),
      sourceUrl: `https://github.com/example/alpha?token=${secret}`,
    };

    const issues = expectRejected(source);

    expect(JSON.stringify(issues)).not.toContain(secret);
    expect(JSON.stringify(issues)).not.toContain('token');
  });
});
