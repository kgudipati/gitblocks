import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

import {
  parseCapabilityTaxonomyV1,
  type CapabilityTaxonomyV1,
} from '@gitblocks/contracts';

import {
  createProfileMaterializationSourceAuthority,
  createProfileMaterializationPersistenceProof,
  operationPolicy,
  parsePublicCatalog,
  parseProfileMaterializationProviderPolicy,
  type ProfileMaterializationProviderPolicy,
  type ProfileMaterializationCollectionResult,
  type ProfileMaterializationPersistenceProof,
  type ProfileMaterializationSourceAuthority,
  type ProfileMaterializationSourceRecordInput,
  type PublicCatalog,
} from '../src/index.ts';

const ROOT = new URL('../../../', import.meta.url);

export async function loadCatalogFixture(): Promise<PublicCatalog> {
  return parsePublicCatalog(
    await readFile(new URL('catalog/public-v1/manifest.json', ROOT), 'utf8'),
  );
}

export function fakeCollectionForCandidate(
  authority: ProfileMaterializationSourceAuthority,
  candidate: PublicCatalog['candidates'][number],
  collectedAt: string,
): ProfileMaterializationCollectionResult {
  const records = authority.sourceRecords.filter(
    (record) => record.candidateId === candidate.candidateId,
  );
  const value = (operation: string): Record<string, unknown> =>
    records.find((record) => record.operation === operation)
      ?.normalizedValue as Record<string, unknown>;
  const optionalValue = (
    operation: string,
  ): Record<string, unknown> | undefined =>
    records.find((record) => record.operation === operation)
      ?.normalizedValue as Record<string, unknown> | undefined;
  const repository = value('github-repository-metadata');
  const head = value('github-default-branch-head');
  const sha = String(head['sha']);
  const releases = optionalValue('github-release')?.['releases'] as
    readonly Record<string, unknown>[] | undefined;
  const tags = optionalValue('github-tag')?.['tags'] as
    readonly Record<string, unknown>[] | undefined;
  const license = records.find(
    (record) => record.operation === 'github-license',
  );
  const community = records.find(
    (record) => record.operation === 'github-community-profile',
  );
  const npm = records.find((record) => record.operation === 'npm-package');
  const npmValue = npm?.normalizedValue as Record<string, unknown> | undefined;
  const advisory = records.find(
    (record) => record.operation === 'github-advisory',
  );
  const advisoryValue = advisory?.normalizedValue as
    Record<string, unknown> | undefined;
  return {
    sourceRecords: records.map((record) => ({
      candidateId: record.candidateId,
      sourceType: record.sourceType,
      operation: record.operation,
      logicalSourceKey: record.logicalSourceKey,
      sourceMutability: record.sourceMutability,
      outcome: record.outcome,
      immutableReference: record.immutableReference,
      collectedAt,
      normalizedValue: record.normalizedValue,
      controlledCode: record.controlledCode,
      evidenceIds: [],
    })),
    qualifiedFailureCodes: [],
    legacyBundle: {
      candidate,
      collectedAt,
      repository: {
        canonicalOwner: String(repository['canonicalOwner']),
        canonicalRepository: String(repository['canonicalRepository']),
        htmlUrl: `https://github.com/${candidate.github.owner}/${candidate.github.repository}`,
        description: null,
        homepage: null,
        topics: repository['topics'] as readonly string[],
        defaultBranch: String(repository['defaultBranch']),
        isPublic: Boolean(repository['isPublic']),
        isFork: Boolean(repository['isFork']),
        isArchived: Boolean(repository['isArchived']),
        pushedAt: String(repository['pushedAt']),
        updatedAt: String(repository['updatedAt']),
        licenseSpdxId: nullableFixtureString(repository['licenseSpdxId']),
      },
      commit: {
        sha,
        htmlUrl: `https://github.com/${candidate.github.owner}/${candidate.github.repository}/commit/${sha}`,
        committedAt: String(head['committedAt']),
      },
      releases: (releases ?? []).map((release) => ({
        tag: String(release['tag']),
        htmlUrl: `https://github.com/${candidate.github.owner}/${candidate.github.repository}/releases/tag/${String(release['tag'])}`,
        publishedAt: String(release['publishedAt']),
        isDraft: Boolean(release['isDraft']),
        isPrerelease: Boolean(release['isPrerelease']),
      })),
      tags: (tags ?? []).map((tag) => ({
        name: String(tag['name']),
        commitSha: String(tag['commitSha']),
      })),
      license:
        license?.outcome === 'established-value'
          ? {
              spdxId:
                (license.normalizedValue as Record<string, unknown>)[
                  'spdxId'
                ] === null
                  ? null
                  : String(
                      (license.normalizedValue as Record<string, unknown>)[
                        'spdxId'
                      ],
                    ),
              path: String(
                (license.normalizedValue as Record<string, unknown>)['path'],
              ),
              sha: String(
                (license.normalizedValue as Record<string, unknown>)['sha'],
              ),
              sourceUrl: `https://api.github.com/repos/${candidate.github.owner}/${candidate.github.repository}/license`,
              immutableUrl: `https://github.com/${candidate.github.owner}/${candidate.github.repository}/blob/${sha}/LICENSE`,
            }
          : null,
      community:
        community?.outcome === 'established-value'
          ? {
              healthPercentage: Number(
                (community.normalizedValue as Record<string, unknown>)[
                  'healthPercentage'
                ],
              ),
              hasSecurityPolicy: Boolean(
                (community.normalizedValue as Record<string, unknown>)[
                  'securityPolicyPresent'
                ],
              ),
            }
          : null,
      files: records
        .filter(
          (record) =>
            record.operation === 'github-allowlisted-file' &&
            record.outcome === 'established-value',
        )
        .map((record) => {
          const file = record.normalizedValue as Record<string, unknown>;
          return {
            path: String(file['path']),
            sha: String(file['sha']),
            htmlUrl: `https://github.com/${candidate.github.owner}/${candidate.github.repository}/blob/${sha}/${String(file['path'])}`,
            text: '',
          };
        }),
      npm:
        npmValue === undefined
          ? null
          : {
              name: String(npmValue['name']),
              latestVersion: String(npmValue['selectedVersion']),
              publishedAt: String(npmValue['publishedAt']),
              registryUrl: `https://registry.npmjs.org/${encodeURIComponent(String(npmValue['name']))}/${String(npmValue['selectedVersion'])}`,
              repositoryUrl: `https://github.com/${candidate.github.owner}/${candidate.github.repository}`,
              license: nullableFixtureString(npmValue['licenseDeclaration']),
              nodeEngine: nullableFixtureString(npmValue['nodeEngine']),
              moduleType: nullableFixtureString(npmValue['moduleType']),
              exportShape:
                npmValue['exportsDeclared'] === true
                  ? ('declared' as const)
                  : ('not-declared' as const),
              deprecated: Boolean(npmValue['deprecated']),
              distTags: npmValue['distTags'] as Readonly<
                Record<string, string>
              >,
            },
      advisories:
        advisoryValue === undefined
          ? {
              advisories: [],
              complete: false,
              limitationCode: 'advisory-not-requested',
            }
          : {
              advisories: (
                advisoryValue['advisories'] as readonly Record<
                  string,
                  unknown
                >[]
              ).map((entry) => ({
                advisoryId: String(entry['advisoryId']),
                htmlUrl: `https://github.com/advisories/${String(entry['advisoryId'])}`,
                publishedAt: String(entry['publishedAt']),
                updatedAt: String(entry['updatedAt']),
                withdrawnAt: nullableFixtureString(entry['withdrawnAt']),
                severity: String(entry['severity']),
              })),
              complete: Boolean(advisoryValue['complete']),
              limitationCode: nullableFixtureString(
                advisoryValue['limitationCode'],
              ),
            },
    },
  };
}

function nullableFixtureString(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new Error('Expected a nullable string in the controlled fixture.');
  }
  return value;
}

export async function loadTaxonomyFixture(): Promise<CapabilityTaxonomyV1> {
  const parsed = parseCapabilityTaxonomyV1(
    JSON.parse(
      await readFile(
        new URL('catalog/capability-taxonomy/1.0.0/manifest.json', ROOT),
        'utf8',
      ),
    ),
  );
  if (!parsed.ok) throw new Error('Taxonomy fixture is invalid.');
  return parsed.value;
}

export async function loadMaterializationPolicyFixture(
  catalog?: PublicCatalog,
): Promise<ProfileMaterializationProviderPolicy> {
  return parseProfileMaterializationProviderPolicy(
    catalog ?? (await loadCatalogFixture()),
    JSON.parse(
      await readFile(
        new URL(
          'catalog/public-v1/profile-materialization-provider-policy.json',
          ROOT,
        ),
        'utf8',
      ),
    ) as unknown,
  );
}

export async function buildFakeSourceAuthority(
  options: {
    readonly collectedAt?: string;
    readonly mutate?: (
      records: ProfileMaterializationSourceRecordInput[],
    ) => void;
  } = {},
): Promise<{
  readonly catalog: PublicCatalog;
  readonly taxonomy: CapabilityTaxonomyV1;
  readonly policy: ProfileMaterializationProviderPolicy;
  readonly authority: ProfileMaterializationSourceAuthority;
}> {
  const catalog = await loadCatalogFixture();
  const taxonomy = await loadTaxonomyFixture();
  const policy = await loadMaterializationPolicyFixture(catalog);
  const collectedAt = options.collectedAt ?? '2026-08-05T00:00:00.000Z';
  const records: ProfileMaterializationSourceRecordInput[] = [];
  for (const candidate of catalog.candidates) {
    const sha = createHash('sha256')
      .update(candidate.candidateId)
      .digest('hex')
      .slice(0, 40);
    const add = (
      operation: Parameters<typeof operationPolicy>[1],
      normalizedValue: unknown,
      logicalSourceKey = 'singleton',
      immutableReference: string | null = null,
    ): void => {
      const operationAuthority = operationPolicy(policy, operation);
      records.push({
        candidateId: candidate.candidateId,
        sourceType: operationAuthority.sourceType,
        operation,
        logicalSourceKey,
        sourceMutability: operationAuthority.sourceMutability,
        outcome: 'established-value',
        immutableReference,
        collectedAt,
        normalizedValue,
        controlledCode: null,
        evidenceIds: [
          `ev-${createHash('sha256')
            .update(
              `${candidate.candidateId}\u0000${operation}\u0000${logicalSourceKey}`,
            )
            .digest('hex')
            .slice(0, 40)}`,
        ],
      });
    };
    add('github-repository-metadata', {
      canonicalOwner: candidate.github.owner,
      canonicalRepository: candidate.github.repository,
      topics: [candidate.primaryCapabilityFamily],
      defaultBranch: 'main',
      isPublic: true,
      isFork: false,
      isArchived: candidate.status === 'archived',
      pushedAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
      licenseSpdxId: 'MIT',
      primaryLanguage: 'TypeScript',
      upstreamRepository: null,
    });
    add(
      'github-default-branch-head',
      { sha, committedAt: '2026-08-01T00:00:00.000Z' },
      'singleton',
      sha,
    );
    if (candidate.expectedSourceTypes.includes('github-release')) {
      add('github-release', {
        releases: [
          {
            tag: 'v1.0.0',
            publishedAt: '2026-07-01T00:00:00.000Z',
            isDraft: false,
            isPrerelease: false,
          },
        ],
      });
    }
    if (candidate.expectedSourceTypes.includes('github-tag')) {
      add('github-tag', { tags: [{ name: 'v1.0.0', commitSha: sha }] });
    }
    if (candidate.expectedSourceTypes.includes('github-license')) {
      add(
        'github-license',
        { spdxId: 'MIT', path: 'LICENSE', sha },
        `commit:${sha}`,
        sha,
      );
    }
    if (candidate.expectedSourceTypes.includes('github-community')) {
      add('github-community-profile', {
        healthPercentage: 100,
        securityPolicyPresent: true,
      });
    }
    if (candidate.expectedSourceTypes.includes('github-file')) {
      for (const path of candidate.allowlistedFiles) {
        add(
          'github-allowlisted-file',
          { path, sha },
          `commit:${sha}:path:${path}`,
          `${sha}:${path}`,
        );
      }
    }
    if (candidate.expectedSourceTypes.includes('npm-package')) {
      const name = candidate.npmPackage;
      if (name === null) throw new Error('Mapped fixture package is missing.');
      add(
        'npm-package',
        {
          name,
          selectedVersion: '1.0.0',
          publishedAt: '2026-07-01T00:00:00.000Z',
          repositoryIdentity: {
            owner: candidate.github.owner,
            repository: candidate.github.repository,
          },
          licenseDeclaration: 'MIT',
          nodeEngine: '>=20',
          moduleType: 'module',
          exportsDeclared: true,
          deprecated: false,
          distTags: { latest: '1.0.0' },
        },
        'singleton',
        `${name}@1.0.0`,
      );
    }
    if (candidate.expectedSourceTypes.includes('github-advisory')) {
      if (candidate.npmPackage === null) {
        throw new Error('Advisory fixture package is missing.');
      }
      add('github-advisory', {
        packageName: candidate.npmPackage,
        packageVersion: '1.0.0',
        advisories: [
          {
            advisoryId: 'ghsa-2345-6789-cfgh',
            publishedAt: '2026-06-01T00:00:00.000Z',
            updatedAt: '2026-07-01T00:00:00.000Z',
            withdrawnAt: null,
            severity: 'high',
          },
        ],
        complete: true,
        limitationCode: null,
      });
    }
  }
  options.mutate?.(records);
  return {
    catalog,
    taxonomy,
    policy,
    authority: createProfileMaterializationSourceAuthority({
      policy,
      catalog,
      taxonomy,
      sourceRecords: records,
    }),
  };
}

export function buildFakePersistenceProof(
  authority: ProfileMaterializationSourceAuthority,
  collection: 'first' | 'second',
  outcome: 'created' | 'unchanged' = collection === 'first'
    ? 'created'
    : 'unchanged',
): ProfileMaterializationPersistenceProof {
  return createProfileMaterializationPersistenceProof(
    {
      collection,
      databaseSchemaDigest:
        '265fa5f21dbeaa1b80dd78bd6bdd678b27e5971f2852042a30cb872ba44a2952',
      migrationInventoryDigest:
        '6c2523252496b2e99c7034a109ac4c672fe347af10b8502ad098a0bd619926f4',
      catalogDigest: authority.catalogDigest,
      sourceAuthoritySemanticDigest: authority.authoritySemanticDigest,
      candidateCount: 150,
      entries: authority.candidates.map((candidate) => {
        const evidenceCount = candidate.sourceRecordDigests.length;
        return {
          candidateId: candidate.candidateId,
          disposition: 'persisted' as const,
          controlledOptionalSourceCodes: [],
          outcome,
          candidateState:
            outcome === 'created'
              ? ('created' as const)
              : ('idempotent' as const),
          snapshotState:
            outcome === 'created'
              ? ('created' as const)
              : ('idempotent' as const),
          snapshotId: `snap-${createHash('sha256')
            .update(candidate.candidateId)
            .digest('hex')
            .slice(0, 40)}`,
          evidenceAppended: outcome === 'created' ? evidenceCount : 0,
          evidenceIdempotent: outcome === 'unchanged' ? evidenceCount : 0,
          evidenceSuperseded: 0,
          evidenceInvalidated: 0,
          limitationCount: 0,
          unknownCount: 1,
        };
      }),
    },
    authority.candidates.map((entry) => entry.candidateId),
  );
}
