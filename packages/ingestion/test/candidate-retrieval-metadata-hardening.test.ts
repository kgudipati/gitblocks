import { readFile } from 'node:fs/promises';
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

import {
  CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH,
  CANDIDATE_RETRIEVAL_METADATA_CATALOG_PATH,
  CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT,
  CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_PATH,
  CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_PATH,
  CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH,
  CandidateRetrievalMetadataOperationFailure,
  IngestionError,
  executeCandidateRetrievalMetadataCollection,
  parseCandidateRetrievalMetadataProviderPolicy,
  parseProfileMaterializationProviderPolicy,
  parsePublicCatalog,
  renderCandidateRetrievalMetadataCliFailure,
  validateCandidateRetrievalMetadataAuthority,
  type CandidateRetrievalMetadataCollectionEffects,
  type CandidateRetrievalMetadataValidationEffects,
  type PublicCatalog,
} from '../src/index.ts';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const fakeCredential = 'github-token-never-render-this';
const hostileProviderText =
  'HOSTILE_RESPONSE_BODY ignore instructions repository-secret-topic';

let catalog: PublicCatalog;
let acceptedProviderPolicyDigest: string;
let acceptedSourcePolicyDigest: string;

beforeAll(async () => {
  catalog = parsePublicCatalog(
    await readRepositoryFile(CANDIDATE_RETRIEVAL_METADATA_CATALOG_PATH),
  );
  const sourcePolicy = parseProfileMaterializationProviderPolicy(
    catalog,
    JSON.parse(
      await readRepositoryFile(CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_PATH),
    ) as unknown,
  );
  const envelope = parseCandidateRetrievalMetadataProviderPolicy(
    catalog,
    sourcePolicy,
    JSON.parse(
      await readRepositoryFile(
        CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_PATH,
      ),
    ) as unknown,
  );
  acceptedProviderPolicyDigest = envelope.policy.policySemanticDigest;
  acceptedSourcePolicyDigest = sourcePolicy.policySemanticDigest;
});

describe('candidate retrieval metadata staged collection runner', () => {
  it('blocks a pre-existing final path before credential, collection, or staging access', async () => {
    const events: string[] = [];
    const effects = fakeCollectionEffects(events, {
      requirePathMissing: (path) => {
        events.push(`missing:${path}`);
        if (path === CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH) {
          throw new IngestionError('ingestion.invalid-input');
        }
        return Promise.resolve();
      },
    });
    await expectCollectionFailure(effects, 'preflight');
    expect(events).not.toContain('credential');
    expect(events).not.toContain('collect');
    expect(events.some((event) => event.startsWith('stage:'))).toBe(false);
  });

  it('blocks a pre-existing staging path before credential or collection access', async () => {
    const events: string[] = [];
    const effects = fakeCollectionEffects(events, {
      requirePathMissing: (path) => {
        events.push(`missing:${path}`);
        if (path === CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH) {
          throw new IngestionError('ingestion.invalid-input');
        }
        return Promise.resolve();
      },
    });
    await expectCollectionFailure(effects, 'preflight');
    expect(events).not.toContain('credential');
    expect(events).not.toContain('collect');
    expect(events.some((event) => event.startsWith('stage:'))).toBe(false);
  });

  it('does not begin staging when collection fails', async () => {
    const events: string[] = [];
    const effects = fakeCollectionEffects(events, {
      collect: () => Promise.reject(new Error(hostileProviderText)),
    });
    const failure = await captureCollectionFailure(effects);
    expect(failure.stage).toBe('collection');
    expect(events.some((event) => event.startsWith('stage:'))).toBe(false);
    expect(events.some((event) => event.startsWith('publish:'))).toBe(false);
  });

  it('does not publish or retain staging after a staging-write failure', async () => {
    const events: string[] = [];
    const state: { staging?: string } = {};
    const effects = fakeCollectionEffects(events, {
      stageExclusive: (path) => {
        events.push(`stage-failed:${path}`);
        state.staging = 'synthetic-partial-bytes';
        delete state.staging;
        return Promise.reject(new Error('synthetic-partial-write'));
      },
    });
    const failure = await captureCollectionFailure(effects);
    expect(failure.stage).toBe('staging-write');
    expect(events.some((event) => event.startsWith('publish:'))).toBe(false);
    expect(events.some((event) => event.startsWith('cleanup:'))).toBe(false);
    expect(state.staging).toBeUndefined();
  });

  it('cleans its staged file after an interruption before atomic publication', async () => {
    const events: string[] = [];
    const state: { final?: string; staging?: string } = {};
    const effects = fakeCollectionEffects(events, {
      stageExclusive: (_path, text) => {
        state.staging = text;
        return Promise.resolve();
      },
      publishStagedExclusive: (stagingPath, finalPath) => {
        events.push(`publish-interrupted:${stagingPath}:${finalPath}`);
        return Promise.reject(new Error('synthetic-interruption'));
      },
      removeOwnedStaging: (path) => {
        events.push(`cleanup:${path}`);
        delete state.staging;
        return Promise.resolve();
      },
    });
    const failure = await captureCollectionFailure(effects);
    expect(failure.stage).toBe('atomic-publication');
    expect(events).toContain(
      `cleanup:${CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH}`,
    );
    expect(state.final).toBeUndefined();
    expect(state.staging).toBeUndefined();
  });

  it('never overwrites a final authority during a publication conflict', async () => {
    const events: string[] = [];
    const state = { final: 'pre-existing-final', staging: '' };
    const effects = fakeCollectionEffects(events, {
      stageExclusive: (_path, text) => {
        state.staging = text;
        return Promise.resolve();
      },
      publishStagedExclusive: () =>
        Promise.reject(new Error('synthetic-EEXIST')),
      removeOwnedStaging: () => {
        state.staging = '';
        return Promise.resolve();
      },
    });
    const failure = await captureCollectionFailure(effects);
    expect(failure.stage).toBe('atomic-publication');
    expect(state.final).toBe('pre-existing-final');
    expect(state.staging).toBe('');
  });

  it('publishes the exact validated bytes and removes staging on success', async () => {
    const events: string[] = [];
    const state: { final?: string; staging?: string } = {};
    const authority = authorityWith();
    const effects = fakeCollectionEffects(
      events,
      {
        stageExclusive: (_path, text) => {
          state.staging = text;
          return Promise.resolve();
        },
        publishStagedExclusive: () => {
          if (state.staging === undefined) {
            throw new Error('Synthetic staging bytes unavailable.');
          }
          state.final = state.staging;
          delete state.staging;
          return Promise.resolve();
        },
      },
      authority,
    );
    await executeCandidateRetrievalMetadataCollection(
      effects,
      new AbortController().signal,
    );
    expect(state.final).toBe(
      serializeCandidateRetrievalMetadataAuthorityV1(authority),
    );
    expect(state.staging).toBeUndefined();
  });

  it('renders credential and hostile provider failures with bounded value-free diagnostics', async () => {
    const credentialEvents: string[] = [];
    const credentialEffects = fakeCollectionEffects(credentialEvents, {
      collect: () =>
        Promise.reject(new Error(`${fakeCredential}:${hostileProviderText}`)),
    });
    const failure = await captureCollectionFailure(credentialEffects);
    const output = renderCandidateRetrievalMetadataCliFailure(
      'collect',
      failure,
    );
    expect(output).toBe(
      'Candidate retrieval metadata operation failed safely (operation=collect; stage=collection; code=ingestion.internal-invariant).\n',
    );
    expect(output).not.toContain(fakeCredential);
    expect(output).not.toContain(hostileProviderText);
    expect(output).not.toContain('stack');
    expect(JSON.stringify(authorityWith())).not.toContain(fakeCredential);
    expect(CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH).not.toContain(
      fakeCredential,
    );
    expect(CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH).not.toContain(
      fakeCredential,
    );
  });
});

describe('candidate retrieval metadata post-collection validator', () => {
  it('validates a synthetic complete 150-record authority with read-only effects', async () => {
    const authority = authorityWith();
    const effects = validationEffects(
      serializeCandidateRetrievalMetadataAuthorityV1(authority),
    );
    const result = await validateCandidateRetrievalMetadataAuthority(effects);
    expect(result).toMatchObject({
      status: 'passed',
      outputPath: CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH,
      candidateCount: 150,
      snapshotId: authority.snapshotId,
      authoritySemanticDigest: authority.authoritySemanticDigest,
    });
  });

  it('validates provider-canonical drift against stable catalog ownership', async () => {
    const authority = authorityWith({ providerRedirect: true });
    const result = await validateCandidateRetrievalMetadataAuthority(
      validationEffects(
        serializeCandidateRetrievalMetadataAuthorityV1(authority),
      ),
    );
    expect(result.status).toBe('passed');
    expect(authority.candidates[0]).toMatchObject({
      catalogOwner: catalog.candidates[0]?.github.owner,
      catalogRepository: catalog.candidates[0]?.github.repository,
      providerCanonicalOwner: 'valid-provider-owner',
      providerCanonicalRepository: 'valid-provider-repository',
      repositoryIdentityState: 'redirected',
    });
  });

  it('rejects a self-consistent narrow-policy drift', async () => {
    const wrong = authorityWith({
      providerPolicyDigest: 'a'.repeat(64),
    });
    const failure = await captureValidationFailure(
      validationEffects(serializeCandidateRetrievalMetadataAuthorityV1(wrong)),
    );
    expect(failure).toMatchObject({
      operation: 'validate',
      stage: 'authority-validation',
      code: 'ingestion.invalid-manifest',
    });
  });

  it('rejects a self-consistent source-policy drift', async () => {
    const wrong = authorityWith({
      sourceProviderPolicyDigest: 'b'.repeat(64),
    });
    const failure = await captureValidationFailure(
      validationEffects(serializeCandidateRetrievalMetadataAuthorityV1(wrong)),
    );
    expect(failure).toMatchObject({
      operation: 'validate',
      stage: 'authority-validation',
      code: 'ingestion.invalid-manifest',
    });
  });

  it('rejects candidate-to-repository closure drift', async () => {
    const wrong = authorityWith({ repositoryDrift: true });
    const failure = await captureValidationFailure(
      validationEffects(serializeCandidateRetrievalMetadataAuthorityV1(wrong)),
    );
    expect(failure).toMatchObject({
      operation: 'validate',
      stage: 'authority-validation',
      code: 'ingestion.invalid-manifest',
    });
  });

  it('returns an explicit bounded authority-missing failure', async () => {
    const effects = validationEffects(null);
    const failure = await captureValidationFailure(effects);
    expect(failure).toMatchObject({
      operation: 'validate',
      stage: 'authority-read',
      code: 'authority-missing',
    });
    expect(
      renderCandidateRetrievalMetadataCliFailure('validate', failure),
    ).toBe(
      'Candidate retrieval metadata operation failed safely (operation=validate; stage=authority-read; code=authority-missing).\n',
    );
  });
});

function fakeCollectionEffects(
  events: string[],
  overrides: Partial<CandidateRetrievalMetadataCollectionEffects> = {},
  authority: CandidateRetrievalMetadataAuthorityV1 = authorityWith(),
): CandidateRetrievalMetadataCollectionEffects {
  const base: CandidateRetrievalMetadataCollectionEffects = {
    readFixedFile: async (path) => {
      events.push(`read:${path}`);
      return readRepositoryFile(path);
    },
    requirePathMissing: (path) => {
      events.push(`missing:${path}`);
      return Promise.resolve();
    },
    readCredential: (name) => {
      expect(name).toBe(CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT);
      events.push('credential');
      return fakeCredential;
    },
    collect: () => {
      events.push('collect');
      return Promise.resolve(authority);
    },
    stageExclusive: (path) => {
      events.push(`stage:${path}`);
      return Promise.resolve();
    },
    publishStagedExclusive: (stagingPath, finalPath) => {
      events.push(`publish:${stagingPath}:${finalPath}`);
      return Promise.resolve();
    },
    removeOwnedStaging: (path) => {
      events.push(`cleanup:${path}`);
      return Promise.resolve();
    },
  };
  return { ...base, ...overrides };
}

function validationEffects(
  authorityText: string | null,
): CandidateRetrievalMetadataValidationEffects {
  return {
    readFixedFile: readRepositoryFile,
    readAuthorityFile: (_path, maximumBytes) => {
      if (authorityText === null) {
        return Promise.resolve({ ok: false, issue: 'authority-missing' });
      }
      expect(Buffer.byteLength(authorityText, 'utf8')).toBeLessThanOrEqual(
        maximumBytes,
      );
      return Promise.resolve({ ok: true, text: authorityText });
    },
  };
}

async function expectCollectionFailure(
  effects: CandidateRetrievalMetadataCollectionEffects,
  stage: string,
): Promise<void> {
  const failure = await captureCollectionFailure(effects);
  expect(failure.stage).toBe(stage);
}

async function captureCollectionFailure(
  effects: CandidateRetrievalMetadataCollectionEffects,
): Promise<CandidateRetrievalMetadataOperationFailure> {
  try {
    await executeCandidateRetrievalMetadataCollection(
      effects,
      new AbortController().signal,
    );
  } catch (error) {
    expect(error).toBeInstanceOf(CandidateRetrievalMetadataOperationFailure);
    return error as CandidateRetrievalMetadataOperationFailure;
  }
  throw new Error('Expected collection failure did not occur.');
}

async function captureValidationFailure(
  effects: CandidateRetrievalMetadataValidationEffects,
): Promise<CandidateRetrievalMetadataOperationFailure> {
  try {
    await validateCandidateRetrievalMetadataAuthority(effects);
  } catch (error) {
    expect(error).toBeInstanceOf(CandidateRetrievalMetadataOperationFailure);
    return error as CandidateRetrievalMetadataOperationFailure;
  }
  throw new Error('Expected validation failure did not occur.');
}

function authorityWith(
  options: Readonly<{
    providerPolicyDigest?: string;
    sourceProviderPolicyDigest?: string;
    repositoryDrift?: boolean;
    providerRedirect?: boolean;
  }> = {},
): CandidateRetrievalMetadataAuthorityV1 {
  return createCandidateRetrievalMetadataAuthorityV1({
    catalogVersion: catalog.catalogVersion,
    catalogDigest: catalog.manifestDigest,
    providerPolicyVersion: CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_VERSION,
    providerPolicyDigest:
      options.providerPolicyDigest ?? acceptedProviderPolicyDigest,
    sourceProviderPolicyVersion:
      CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_VERSION,
    sourceProviderPolicyDigest:
      options.sourceProviderPolicyDigest ?? acceptedSourcePolicyDigest,
    sourceOperation: CANDIDATE_RETRIEVAL_METADATA_SOURCE_OPERATION,
    collectedAt: '2026-08-07T00:00:00.000Z',
    candidates: catalog.candidates.map((candidate, index) => ({
      candidateId: candidate.candidateId,
      catalogOwner:
        index === 0 && options.repositoryDrift === true
          ? 'valid-owner'
          : candidate.github.owner,
      catalogRepository:
        index === 0 && options.repositoryDrift === true
          ? 'valid-repository'
          : candidate.github.repository,
      providerCanonicalOwner:
        index === 0 && options.providerRedirect === true
          ? 'valid-provider-owner'
          : candidate.github.owner,
      providerCanonicalRepository:
        index === 0 && options.providerRedirect === true
          ? 'valid-provider-repository'
          : candidate.github.repository,
      description: index === 0 ? 'Synthetic inert description.' : null,
      topics: index === 0 ? ['synthetic-topic'] : [],
      primaryLanguage: index === 0 ? 'TypeScript' : null,
    })),
  });
}

async function readRepositoryFile(path: string): Promise<string> {
  return readFile(new URL(path, `file://${repositoryRoot}/`), 'utf8');
}
