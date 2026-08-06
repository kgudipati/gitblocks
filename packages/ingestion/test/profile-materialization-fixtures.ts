import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

import {
  parseCapabilityTaxonomyV1,
  type CapabilityTaxonomyV1,
} from '@gitblocks/contracts';

import {
  createProfileMaterializationSourceAuthority,
  operationPolicy,
  parsePublicCatalog,
  parseProfileMaterializationProviderPolicy,
  type ProfileMaterializationProviderPolicy,
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
        evidenceIds: [],
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
        'singleton',
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
        add('github-allowlisted-file', { path, sha }, path, `${sha}:${path}`);
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
