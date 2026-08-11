/* eslint-disable @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await -- Inert fixtures implement effect boundaries and assertion matchers without external effects. */

import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  CANDIDATE_AUTHORITY_LIVE_OPERATOR_V5_VERSION,
  CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS,
  CandidateAuthorityFirstFatalError,
  createCandidateAuthoritySuccessorSourceAuthority,
  createCandidateAuthoritySuccessorSourceCandidate,
} from '../src/candidate-authority-provider-contract.ts';
import {
  CANDIDATE_AUTHORITY_SUCCESSOR_ZERO_EFFECT_AUDIT,
  executeCandidateAuthoritySuccessor,
  preflightCandidateAuthoritySuccessor,
  renderCandidateAuthoritySuccessorFailure,
  type CandidateAuthoritySuccessorEffects,
  type CandidateAuthoritySuccessorPreflightResult,
} from '../src/candidate-authority-live-v5-runner.ts';
import {
  CANDIDATE_AUTHORITY_ACCEPTED_POSTMORTEM_HEAD,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_DIGEST,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_VERSION,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_DIGEST,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_PATH,
  CANDIDATE_AUTHORITY_REPLAY_V4_DIGEST,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_DIGEST,
  CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH,
  parseCandidateAuthoritySuccessorFixedAuthorities,
  parseCandidateAuthoritySuccessorSourceAuthority,
  serializeCandidateAuthoritySuccessorSourceAuthority,
} from '../src/candidate-authority-successor-contracts.ts';
import { validateCandidateAuthoritySuccessorSourceCommitProof } from '../src/candidate-authority-successor-replay-runner.ts';
import { candidateAuthorityReadinessDecision } from '../src/candidate-authority-readiness.ts';
import { ingestionError } from '../src/errors.ts';
import { parsePublicCatalog } from '../src/manifest.ts';

const ACCEPTED_HEAD = 'a'.repeat(40);

describe('candidate authority final successor activation freeze', () => {
  it('keeps historical commands disabled and exposes only explicit successor command surfaces', async () => {
    const [historicalCli, packageText] = await Promise.all([
      readFile(
        'packages/ingestion/scripts/candidate-authority-live-cli.ts',
        'utf8',
      ),
      readFile('package.json', 'utf8'),
    ]);
    expect(historicalCli).toContain(
      "priorAuthorization: 'consumed-no-remaining-collections'",
    );
    const scripts = (
      JSON.parse(packageText) as { scripts: Record<string, string> }
    ).scripts;
    expect(scripts).toMatchObject({
      'candidate-authority:successor:preflight': expect.stringContaining(
        'candidate-authority-successor-cli.ts preflight',
      ),
      'candidate-authority:successor:collect': expect.stringContaining(
        'candidate-authority-successor-cli.ts collect',
      ),
      'candidate-authority:successor:source:validate':
        expect.stringContaining('source-validate'),
      'candidate-authority:successor:replay:preflight': expect.stringContaining(
        'successor-replay-cli.ts replay-preflight',
      ),
      'candidate-authority:successor:replay:generate':
        expect.stringContaining('replay-generate'),
      'candidate-authority:successor:replay:validate':
        expect.stringContaining('replay-validate'),
      'candidate-authority:successor:readiness:measure':
        expect.stringContaining('readiness-measure'),
      'candidate-authority:successor:readiness:validate':
        expect.stringContaining('readiness-validate'),
    });
  });

  it('loads the complete additive authority chain and corrects advisory provenance', async () => {
    const fixed = await fixedAuthorities();
    expect(fixed.sourcePolicy).toMatchObject({
      policyVersion: 'candidate-authority-source-policy/7.0.0',
      policySemanticDigest: CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_DIGEST,
      requestBudget: {
        githubLogicalRequests: 1810,
        npmLogicalRequests: 80,
        totalLogicalRequests: 1890,
        githubWorstCaseAttempts: 5430,
        npmWorstCaseAttempts: 240,
        totalWorstCaseAttempts: 5670,
      },
    });
    expect(fixed.authorization).toMatchObject({
      version: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_VERSION,
      digest: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_DIGEST,
      conditionalCollections: 1,
      activeCollections: 0,
      automaticRerun: false,
    });
    const provider = JSON.parse(
      await readFile(CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_PATH, 'utf8'),
    ) as {
      contractSemanticDigest: string;
      completeMatrixComposition: { replacementRows: unknown[] };
    };
    expect(provider.contractSemanticDigest).toBe(
      CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_DIGEST,
    );
    expect(provider.completeMatrixComposition.replacementRows).toEqual([
      {
        operationId: 'github-advisories',
        evidenceProvenance: {
          kind: 'structured-provider-snapshot',
          sourceType: 'public-structured-provider',
          provider: 'github',
          sourceClass: 'security-advisory-index',
        },
      },
    ]);
  });

  it('runs zero-effect preflight and refuses mismatched accepted heads before credential or cutoff access', async () => {
    const { preflight, source } = await fixture();
    const effects = effectsFor(preflight, source);
    await expect(
      preflightCandidateAuthoritySuccessor(effects, ACCEPTED_HEAD),
    ).resolves.toMatchObject({
      effectAudit: CANDIDATE_AUTHORITY_SUCCESSOR_ZERO_EFFECT_AUDIT,
    });
    let credentialReads = 0;
    let clockReads = 0;
    await expect(
      executeCandidateAuthoritySuccessor(
        {
          ...effects,
          preflight: async () => ({
            ...preflight,
            acceptedHead: 'b'.repeat(40),
            head: 'b'.repeat(40),
            originHead: 'b'.repeat(40),
          }),
          readCredential: () => {
            credentialReads += 1;
            return 'inert-secret-fixture';
          },
          now: () => {
            clockReads += 1;
            return new Date('2026-08-11T12:00:00.000Z');
          },
        },
        ACCEPTED_HEAD,
      ),
    ).rejects.toMatchObject({ code: 'ingestion.invalid-input' });
    expect({ credentialReads, clockReads }).toEqual({
      credentialReads: 0,
      clockReads: 0,
    });
  });

  it('roundtrips the full source-v2 authority and emits safe stage-specific post-provider diagnostics', async () => {
    const { preflight, source } = await fixture();
    const text = serializeCandidateAuthoritySuccessorSourceAuthority(source);
    expect(
      parseCandidateAuthoritySuccessorSourceAuthority({
        text,
        catalog: preflight.catalog,
        acceptedExecutionHead: ACCEPTED_HEAD,
      }),
    ).toEqual(source);
    const token = 'inert-secret-fixture';
    const effects = effectsFor(preflight, source, {
      stageExclusive: async () => {
        throw ingestionError('ingestion.internal-invariant');
      },
    });
    let failure: unknown;
    try {
      await executeCandidateAuthoritySuccessor(effects, ACCEPTED_HEAD);
    } catch (error) {
      failure = error;
    }
    const rendered = renderCandidateAuthoritySuccessorFailure(failure);
    expect(JSON.parse(rendered)).toMatchObject({
      operatorVersion: CANDIDATE_AUTHORITY_LIVE_OPERATOR_V5_VERSION,
      authorizationVersion: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_VERSION,
      authorizationDigest: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_DIGEST,
      collectionCutoff: '2026-08-11T12:00:00.000Z',
      failureStage: 'candidate-authority-successor-staging',
      githubLogicalRequests: 1,
      npmLogicalRequests: 0,
      totalLogicalRequests: 1,
      githubAttempts: 2,
      npmAttempts: 0,
      totalAttempts: 2,
      retries: 1,
      ownedStagingCleaned: true,
      sourceAuthorityPublished: false,
    });
    expect(rendered).not.toContain(token);
    expect(rendered).not.toMatch(/headers|responseBody|providerValue/iu);
  });

  it('classifies an atomic publication failure after collection as post-provider and retains counters', async () => {
    const { preflight, source } = await fixture();
    const effects = effectsFor(preflight, source, {
      publishStagedExclusive: async () => {
        throw ingestionError('ingestion.internal-invariant');
      },
    });
    let failure: unknown;
    try {
      await executeCandidateAuthoritySuccessor(effects, ACCEPTED_HEAD);
    } catch (error) {
      failure = error;
    }
    expect(
      JSON.parse(renderCandidateAuthoritySuccessorFailure(failure)),
    ).toMatchObject({
      failureStage: 'candidate-authority-successor-publication',
      collectionCutoff: '2026-08-11T12:00:00.000Z',
      totalLogicalRequests: 1,
      totalAttempts: 2,
      retries: 1,
      ownedStagingExisted: true,
      ownedStagingCleaned: true,
      sourceAuthorityPublished: false,
    });
  });

  it('preserves the causal first-fatal safe code and settled counters', async () => {
    const { preflight, source } = await fixture();
    const fatal = new CandidateAuthorityFirstFatalError({
      context: {
        candidateId: preflight.catalog.candidates[0]?.candidateId ?? 'missing',
        operationId: 'github-repository-metadata',
      },
      cause: ingestionError('ingestion.provider-response'),
      counters: {
        githubLogicalRequests: 5,
        npmLogicalRequests: 0,
        githubAttempts: 6,
        npmAttempts: 0,
        retries: 1,
        perOperation: {
          'github-repository-metadata': {
            logicalRequests: 5,
            attempts: 6,
          },
        },
      },
    });
    let failure: unknown;
    try {
      await executeCandidateAuthoritySuccessor(
        effectsFor(preflight, source, {
          collect: async () => {
            throw fatal;
          },
        }),
        ACCEPTED_HEAD,
      );
    } catch (error) {
      failure = error;
    }
    expect(
      JSON.parse(renderCandidateAuthoritySuccessorFailure(failure)),
    ).toMatchObject({
      safeErrorCode: 'ingestion.provider-response',
      firstFatalCandidateId: fatal.candidateId,
      firstFatalOperationId: fatal.operationId,
      githubLogicalRequests: 5,
      githubAttempts: 6,
      retries: 1,
    });
  });

  it('uses a mandatory real bounded collector transport with zero redirects and three attempts', async () => {
    const [systemEffects, runner] = await Promise.all([
      readFile(
        'packages/ingestion/scripts/candidate-authority-successor-system-effects.ts',
        'utf8',
      ),
      readFile(
        'packages/ingestion/src/candidate-authority-live-v5-runner.ts',
        'utf8',
      ),
    ]);
    expect(systemEffects).toContain('createTransport({');
    expect(systemEffects).toContain('fetch: config.fetch');
    expect(systemEffects).toContain('maximumRedirects: 0');
    expect(systemEffects).toContain('maximumAttempts: 3');
    expect(systemEffects).toContain(
      'collectCandidateAuthoritySourceAuthority({',
    );
    expect(systemEffects).not.toMatch(/config\.collect|collect\s*\?\?/u);
    expect(runner).not.toContain('neverTransport');
  });

  it('enforces the isolated source-freeze direct parent and exact source bytes', () => {
    const serialized = '{"source":"v2"}\n';
    const git = {
      branch: 'feat/32-codebase-conditioned-ranking',
      head: 'c'.repeat(40),
      originHead: 'c'.repeat(40),
      sourceFreezeHead: 'd'.repeat(40),
      sourceFreezeParentHead: ACCEPTED_HEAD,
      sourceFreezeIsAncestor: true,
      clean: true,
      sourceCommitPaths: [CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH],
      workingPaths: [],
      sourceTrackedAtHead: true,
      sourceBytesAtHead: serialized,
      sourceBytesAtFreezeHead: serialized,
    };
    expect(() =>
      validateCandidateAuthoritySuccessorSourceCommitProof({
        git,
        serializedSourceAuthority: serialized,
        collectionExecutionHead: ACCEPTED_HEAD,
      }),
    ).not.toThrow();
    expect(() =>
      validateCandidateAuthoritySuccessorSourceCommitProof({
        git: { ...git, sourceFreezeParentHead: 'e'.repeat(40) },
        serializedSourceAuthority: serialized,
        collectionExecutionHead: ACCEPTED_HEAD,
      }),
    ).toThrow(expect.objectContaining({ code: 'ingestion.invalid-input' }));
    expect(() =>
      validateCandidateAuthoritySuccessorSourceCommitProof({
        git: { ...git, sourceTrackedAtHead: false },
        serializedSourceAuthority: serialized,
        collectionExecutionHead: ACCEPTED_HEAD,
      }),
    ).toThrow();
  });

  it('keeps the frozen readiness count and breadth gate independent', () => {
    expect(
      candidateAuthorityReadinessDecision({
        realizedReadyFieldCount: 12,
        minimumRealizedReadyFields: 13,
        everyBreadthGroupRepresented: true,
      }),
    ).toBe('no-go');
    expect(
      candidateAuthorityReadinessDecision({
        realizedReadyFieldCount: 13,
        minimumRealizedReadyFields: 13,
        everyBreadthGroupRepresented: false,
      }),
    ).toBe('no-go');
    expect(
      candidateAuthorityReadinessDecision({
        realizedReadyFieldCount: 13,
        minimumRealizedReadyFields: 13,
        everyBreadthGroupRepresented: true,
      }),
    ).toBe('go');
  });
});

async function fixedAuthorities() {
  const [
    providerV1,
    providerV2,
    sourceV6,
    sourceV7,
    replayV4,
    authorizationV5,
  ] = await Promise.all([
    readFile(
      'catalog/public-v1/candidate-authority-provider-contract-v1.json',
      'utf8',
    ),
    readFile(
      'catalog/public-v1/candidate-authority-provider-contract-v2.json',
      'utf8',
    ),
    readFile(
      'catalog/public-v1/candidate-authority-source-policy-v6.json',
      'utf8',
    ),
    readFile(
      'catalog/public-v1/candidate-authority-source-policy-v7.json',
      'utf8',
    ),
    readFile(
      'catalog/public-v1/candidate-authority-replay-algorithm-v4.json',
      'utf8',
    ),
    readFile(
      'catalog/public-v1/candidate-authority-live-authorization-v5.json',
      'utf8',
    ),
  ]);
  const result = parseCandidateAuthoritySuccessorFixedAuthorities({
    providerContractV1: providerV1,
    providerContractV2: providerV2,
    sourcePolicyV6: sourceV6,
    sourcePolicyV7: sourceV7,
    replayV4,
    authorizationV5,
  });
  expect(CANDIDATE_AUTHORITY_REPLAY_V4_DIGEST).toMatch(/^[a-f0-9]{64}$/u);
  return result;
}

async function fixture() {
  const [catalogText, fixed] = await Promise.all([
    readFile('catalog/public-v1/manifest.json', 'utf8'),
    fixedAuthorities(),
  ]);
  const catalog = parsePublicCatalog(catalogText);
  const candidates = catalog.candidates.map((candidate) =>
    createCandidateAuthoritySuccessorSourceCandidate({
      candidateId: candidate.candidateId,
      github: candidate.github,
      npmPackage: candidate.npmPackage,
      sources: CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS.map(
        (operationId) => ({
          operationId,
          outcome: 'qualified-unknown' as const,
          completeness: 'partial' as const,
          limitationCode: 'synthetic-contract-fixture',
          value: null,
        }),
      ),
    }),
  );
  const perOperation = CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS.map(
    (operationId, index) => ({
      operationId,
      logicalRequests: index === 0 ? 1 : 0,
      attempts: index === 0 ? 2 : 0,
      establishedAbsences: 0,
      qualifiedUnknowns: index === 0 ? 150 : 0,
    }),
  );
  const source = createCandidateAuthoritySuccessorSourceAuthority({
    authorityVersion: 'candidate-authority-source-authority/2.0.0',
    operatorVersion: CANDIDATE_AUTHORITY_LIVE_OPERATOR_V5_VERSION,
    bindings: {
      ...fixed.authorization.bindings,
      catalogVersion: catalog.catalogVersion,
      catalogDigest: catalog.manifestDigest,
      taxonomyVersion: '1.0.0',
      taxonomyDigest:
        '838fa85b2e6937866854b6f733fe7045cf49d5f811cb5e4a8d503bfbd76a61c9',
      sourcePolicyVersion: fixed.sourcePolicy.policyVersion,
      sourcePolicyDigest: fixed.sourcePolicy.policySemanticDigest,
      liveAuthorizationVersion: fixed.authorization.version,
      liveAuthorizationDigest: fixed.authorization.digest,
      collectionExecutionHead: ACCEPTED_HEAD,
    },
    collectionCutoff: '2026-08-11T12:00:00.000Z',
    candidateCount: 150,
    orderedCandidateIds: catalog.candidates.map(
      ({ candidateId }) => candidateId,
    ),
    candidates,
    effectReceipt: {
      collectionExecutions: 1,
      githubLogicalRequests: 1,
      npmLogicalRequests: 0,
      totalLogicalRequests: 1,
      githubAttempts: 2,
      npmAttempts: 0,
      totalAttempts: 2,
      retries: 1,
      perOperation,
      controlledOptionalSourceFailures: {},
      credentialAvailable: true,
      databaseCalls: 0,
      dockerCalls: 0,
      modelCalls: 0,
      candidateExecutions: 0,
      allCandidateProjections: 0,
      coverageCalculations: 0,
    },
  });
  const preflight: CandidateAuthoritySuccessorPreflightResult = {
    status: 'passed',
    acceptedHead: ACCEPTED_HEAD,
    branch: 'feat/32-codebase-conditioned-ranking',
    head: ACCEPTED_HEAD,
    originHead: ACCEPTED_HEAD,
    parentHead: CANDIDATE_AUTHORITY_ACCEPTED_POSTMORTEM_HEAD,
    activationCommitCount: 1,
    clean: true,
    outputAndStagingPathsAbsent: true,
    catalog,
    sourcePolicy: fixed.sourcePolicy,
    authorization: fixed.authorization,
    effectAudit: CANDIDATE_AUTHORITY_SUCCESSOR_ZERO_EFFECT_AUDIT,
  };
  return { preflight, source };
}

function effectsFor(
  preflight: CandidateAuthoritySuccessorPreflightResult,
  source: Awaited<ReturnType<typeof fixture>>['source'],
  overrides: Partial<CandidateAuthoritySuccessorEffects> = {},
): CandidateAuthoritySuccessorEffects {
  return {
    preflight: async () => preflight,
    readCredential: () => 'inert-secret-fixture',
    now: () => new Date('2026-08-11T12:00:00.000Z'),
    collect: async () => source,
    readAttemptMetrics: () => ({
      githubAttempts: 2,
      npmAttempts: 0,
      retries: 1,
      perOperationAttempts: { 'github-repository-metadata': 2 },
    }),
    stageExclusive: async () => undefined,
    publishStagedExclusive: async () => undefined,
    removeOwnedStaging: async () => undefined,
    ...overrides,
  };
}
