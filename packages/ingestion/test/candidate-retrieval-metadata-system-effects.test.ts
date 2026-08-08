import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_VERSION,
  CANDIDATE_RETRIEVAL_METADATA_SOURCE_OPERATION,
  CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_VERSION,
  createCandidateRetrievalMetadataAuthorityV1,
  serializeCandidateRetrievalMetadataAuthorityV1,
  type CandidateRetrievalMetadataAuthorityV1,
} from '@gitblocks/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import { createCandidateRetrievalMetadataSystemEffects } from '../scripts/candidate-retrieval-metadata-system-effects.ts';
import {
  CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH,
  CANDIDATE_RETRIEVAL_METADATA_CATALOG_PATH,
  CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT,
  CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_PATH,
  CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_PATH,
  CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH,
  CandidateRetrievalMetadataOperationFailure,
  executeCandidateRetrievalMetadataCollection,
  parseCandidateRetrievalMetadataProviderPolicy,
  parseProfileMaterializationProviderPolicy,
  parsePublicCatalog,
  validateCandidateRetrievalMetadataAuthority,
  type PublicCatalog,
} from '../src/index.ts';

const sourceRoot = fileURLToPath(new URL('../../..', import.meta.url));
const fixedInputPaths = [
  CANDIDATE_RETRIEVAL_METADATA_CATALOG_PATH,
  CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_PATH,
  CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_PATH,
] as const;

let authority: CandidateRetrievalMetadataAuthorityV1;

beforeAll(async () => {
  const catalog = parsePublicCatalog(
    await readFile(
      join(sourceRoot, CANDIDATE_RETRIEVAL_METADATA_CATALOG_PATH),
      'utf8',
    ),
  );
  authority = await buildAuthority(catalog);
});

describe('candidate retrieval metadata fixed filesystem publication', () => {
  it.each([
    CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH,
    CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH,
  ])('blocks pre-existing %s before credential access', async (blockedPath) => {
    const root = await preparedRoot();
    let credentialReads = 0;
    try {
      await writeFile(join(root, blockedPath), 'review-required', {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      });
      const effects = createCandidateRetrievalMetadataSystemEffects({
        repositoryRoot: root,
        environment: new Proxy(
          {},
          {
            get: () => {
              credentialReads += 1;
              throw new Error('credential-read-not-allowed');
            },
          },
        ),
        fetch: deniedFetch,
        now: deniedClock,
        collect: () => Promise.resolve(authority),
      });
      await expect(
        executeCandidateRetrievalMetadataCollection(
          effects,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ stage: 'preflight' });
      expect(credentialReads).toBe(0);
      expect(await readFile(join(root, blockedPath), 'utf8')).toBe(
        'review-required',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('publishes complete exact bytes through the same-directory staging path', async () => {
    const root = await preparedRoot();
    try {
      const effects = systemEffects(root, () => Promise.resolve(authority));
      const result = await executeCandidateRetrievalMetadataCollection(
        effects,
        new AbortController().signal,
      );
      expect(result.authoritySemanticDigest).toBe(
        authority.authoritySemanticDigest,
      );
      expect(
        await readFile(
          join(root, CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH),
          'utf8',
        ),
      ).toBe(serializeCandidateRetrievalMetadataAuthorityV1(authority));
      await expect(
        lstat(join(root, CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH)),
      ).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('preserves a conflicting final file and removes its owned staging file', async () => {
    const root = await preparedRoot();
    try {
      const finalPath = join(root, CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH);
      const effects = systemEffects(root, async () => {
        await writeFile(finalPath, 'publication-race-winner', {
          encoding: 'utf8',
          flag: 'wx',
          mode: 0o600,
        });
        return authority;
      });
      await expect(
        executeCandidateRetrievalMetadataCollection(
          effects,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ stage: 'atomic-publication' });
      expect(await readFile(finalPath, 'utf8')).toBe('publication-race-winner');
      await expect(
        lstat(join(root, CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH)),
      ).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('does not create final or staging state when collection fails', async () => {
    const root = await preparedRoot();
    try {
      const effects = systemEffects(root, () =>
        Promise.reject(new Error('hostile-provider-body-not-rendered')),
      );
      await expect(
        executeCandidateRetrievalMetadataCollection(
          effects,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ stage: 'collection' });
      for (const path of [
        CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH,
        CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH,
      ]) {
        await expect(lstat(join(root, path))).rejects.toMatchObject({
          code: 'ENOENT',
        });
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('validates a complete file read-only and rejects a symlinked authority', async () => {
    const root = await preparedRoot();
    try {
      const finalPath = join(root, CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH);
      await writeFile(
        finalPath,
        serializeCandidateRetrievalMetadataAuthorityV1(authority),
        { encoding: 'utf8', flag: 'wx', mode: 0o600 },
      );
      const effects = systemEffects(root, () => Promise.resolve(authority));
      await expect(
        validateCandidateRetrievalMetadataAuthority(effects),
      ).resolves.toMatchObject({ status: 'passed', candidateCount: 150 });
      await rm(finalPath);
      const outside = join(root, 'outside-authority.json');
      await writeFile(
        outside,
        serializeCandidateRetrievalMetadataAuthorityV1(authority),
        { encoding: 'utf8', flag: 'wx', mode: 0o600 },
      );
      await symlink(outside, finalPath);
      await expect(
        validateCandidateRetrievalMetadataAuthority(effects),
      ).rejects.toBeInstanceOf(CandidateRetrievalMetadataOperationFailure);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('reports a missing authority without network, credential, write, or clock access', async () => {
    const root = await preparedRoot();
    const calls = { credential: 0, network: 0, clock: 0 };
    try {
      const effects = createCandidateRetrievalMetadataSystemEffects({
        repositoryRoot: root,
        environment: new Proxy(
          {},
          {
            get: () => {
              calls.credential += 1;
              throw new Error('credential-read-not-allowed');
            },
          },
        ),
        fetch: () => {
          calls.network += 1;
          throw new Error('network-not-allowed');
        },
        now: () => {
          calls.clock += 1;
          throw new Error('clock-not-allowed');
        },
      });
      await expect(
        validateCandidateRetrievalMetadataAuthority(effects),
      ).rejects.toMatchObject({
        operation: 'validate',
        stage: 'authority-read',
        code: 'authority-missing',
      });
      expect(calls).toEqual({ credential: 0, network: 0, clock: 0 });
      await expect(
        lstat(join(root, CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH)),
      ).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(
        lstat(join(root, CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH)),
      ).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function systemEffects(
  root: string,
  collect: NonNullable<
    Parameters<
      typeof createCandidateRetrievalMetadataSystemEffects
    >[0]['collect']
  >,
) {
  return createCandidateRetrievalMetadataSystemEffects({
    repositoryRoot: root,
    environment: {
      [CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT]:
        'fake-token-never-rendered',
    },
    fetch: deniedFetch,
    now: deniedClock,
    collect,
  });
}

async function preparedRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'gitblocks-retrieval-metadata-'));
  for (const path of fixedInputPaths) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await readFile(join(sourceRoot, path)), {
      flag: 'wx',
      mode: 0o600,
    });
  }
  return root;
}

async function buildAuthority(
  catalog: PublicCatalog,
): Promise<CandidateRetrievalMetadataAuthorityV1> {
  const sourcePolicy = parseProfileMaterializationProviderPolicy(
    catalog,
    JSON.parse(
      await readFile(
        join(sourceRoot, CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_PATH),
        'utf8',
      ),
    ) as unknown,
  );
  const envelope = parseCandidateRetrievalMetadataProviderPolicy(
    catalog,
    sourcePolicy,
    JSON.parse(
      await readFile(
        join(sourceRoot, CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_PATH),
        'utf8',
      ),
    ) as unknown,
  );
  return createCandidateRetrievalMetadataAuthorityV1({
    catalogVersion: catalog.catalogVersion,
    catalogDigest: catalog.manifestDigest,
    providerPolicyVersion: CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_VERSION,
    providerPolicyDigest: envelope.policy.policySemanticDigest,
    sourceProviderPolicyVersion:
      CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_VERSION,
    sourceProviderPolicyDigest: sourcePolicy.policySemanticDigest,
    sourceOperation: CANDIDATE_RETRIEVAL_METADATA_SOURCE_OPERATION,
    collectedAt: '2026-08-07T00:00:00.000Z',
    candidates: catalog.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      canonicalOwner: candidate.github.owner,
      canonicalRepository: candidate.github.repository,
      description: null,
      topics: [],
      primaryLanguage: null,
    })),
  });
}

function deniedFetch(): Promise<Response> {
  throw new Error('network-not-allowed');
}

function deniedClock(): Date {
  throw new Error('clock-not-allowed');
}
