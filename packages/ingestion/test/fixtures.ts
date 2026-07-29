import type { CandidateSourceBundle, CatalogCandidate } from '../src/index.ts';

export const TEST_CANDIDATE: CatalogCandidate = {
  candidateId: 'phase5-test-candidate',
  displayName: 'Phase 5 Test Candidate',
  github: { owner: 'gitblocks-test', repository: 'candidate' },
  npmPackage: '@gitblocks-test/candidate',
  primaryCapabilityFamily: 'authorization',
  additionalCapabilityFamilies: [],
  rationale: 'Reviewed deterministic test candidate.',
  selectionSources: [
    'https://github.com/gitblocks-test/candidate',
    'https://www.npmjs.com/package/%40gitblocks-test%2Fcandidate',
  ],
  expectedSourceTypes: [
    'github-repository',
    'github-release',
    'github-file',
    'npm-package',
    'github-advisory',
  ],
  status: 'active',
  allowlistedFiles: ['package.json'],
};

export function testBundle(
  overrides: Partial<CandidateSourceBundle> = {},
): CandidateSourceBundle {
  return {
    candidate: TEST_CANDIDATE,
    collectedAt: '2026-07-29T12:00:00.000Z',
    repository: {
      canonicalOwner: 'gitblocks-test',
      canonicalRepository: 'candidate',
      htmlUrl: 'https://github.com/gitblocks-test/candidate',
      description: 'A deterministic candidate fixture.',
      homepage: null,
      topics: ['authorization'],
      defaultBranch: 'main',
      isPublic: true,
      isFork: false,
      isArchived: false,
      pushedAt: '2026-07-28T12:00:00.000Z',
      updatedAt: '2026-07-28T12:00:00.000Z',
      licenseSpdxId: 'Apache-2.0',
    },
    commit: {
      sha: '1111111111111111111111111111111111111111',
      htmlUrl:
        'https://github.com/gitblocks-test/candidate/commit/1111111111111111111111111111111111111111',
      committedAt: '2026-07-28T12:00:00.000Z',
    },
    releases: [
      {
        tag: 'v1.2.3',
        htmlUrl:
          'https://github.com/gitblocks-test/candidate/releases/tag/v1.2.3',
        publishedAt: '2026-07-27T12:00:00.000Z',
        isDraft: false,
        isPrerelease: false,
      },
    ],
    tags: [
      {
        name: 'v1.2.3',
        commitSha: '1111111111111111111111111111111111111111',
      },
    ],
    license: {
      spdxId: 'Apache-2.0',
      htmlUrl: 'https://github.com/gitblocks-test/candidate/blob/main/LICENSE',
    },
    community: { healthPercentage: 80, hasSecurityPolicy: true },
    files: [
      {
        path: 'package.json',
        sha: '2222222222222222222222222222222222222222',
        htmlUrl:
          'https://github.com/gitblocks-test/candidate/blob/main/package.json',
        text: '{"name":"untrusted-and-never-executed"}',
      },
    ],
    npm: {
      name: '@gitblocks-test/candidate',
      latestVersion: '1.2.3',
      publishedAt: '2026-07-27T12:00:00.000Z',
      registryUrl:
        'https://www.npmjs.com/package/%40gitblocks-test%2Fcandidate/v/1.2.3',
      repositoryUrl: 'https://github.com/gitblocks-test/candidate',
      license: 'Apache-2.0',
      nodeEngine: '>=24',
      moduleType: 'module',
      exportShape: 'declared',
      deprecated: false,
      distTags: { latest: '1.2.3' },
    },
    advisories: { advisories: [], complete: true, limitationCode: null },
    incompleteSourceCodes: [],
    ...overrides,
  };
}
