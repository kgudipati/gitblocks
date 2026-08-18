import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Client,
  StreamableHTTPClientTransport,
  type FetchLike,
} from '@modelcontextprotocol/client';
import {
  parseOssRecommendationRequestV1,
  parseRepositoryFingerprintV1,
  repositoryFingerprintDigestV1,
  validateRecommendationModelAssessmentExchangeV1,
  type OssRecommendationRequestV1,
  type RecommendationAssessmentModelResponseV1,
  type RepositoryFingerprintV1,
} from '@gitblocks/contracts';
import type {
  DeterministicCandidateProfile,
  DeterministicProfileFieldRecord,
} from '@gitblocks/domain';
import {
  appendCandidateLimitation,
  appendCandidateUnknown,
  appendEvidenceObservation,
  applyMigrations,
  closePersistenceClient,
  createPersistenceClient,
  publishRepositoryArtifactSet,
  publishServingCatalogSnapshot,
  putCatalogCandidate,
  setCandidateCapabilityFamilies,
  type PersistenceClient,
  type PersistenceClientConfig,
} from '@gitblocks/persistence';
import postgres, { type Sql } from 'postgres';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { FitAssessmentModelRequestV1 } from '../src/application.ts';
import { GITBLOCKS_MCP_HOST } from '../src/mcp-http.ts';
import { startGitBlocksMcpProcess } from '../src/mcp-process.ts';
import { GITBLOCKS_RECOMMEND_OSS_TOOL_NAME } from '../src/mcp-server.ts';
import {
  candidateDossier,
  candidateArtifactMaterial,
  candidateRepositoryHeadDossier,
  frozenBackgroundJobsDogfoodRequest,
  groundedModelResponse,
  loadAcceptedAuthorities,
  recommendationRequest,
  TEST_ARTIFACT_COMMIT_SHA,
} from './fixtures.ts';

const OWNER_CONFIG = readOwnerConfig();
const WRITER_CONFIG: PersistenceClientConfig = {
  ...OWNER_CONFIG,
  username: 'gitblocks_persistence_test',
  password: 'persistence-test-only',
  maximumConnections: 5,
};
const SERVING_CONFIG: PersistenceClientConfig = {
  ...OWNER_CONFIG,
  username: 'gitblocks_serving_test',
  password: 'serving-test-only',
  maximumConnections: 2,
};
const PUBLISHED_AT = '2026-08-12T18:00:00.000Z';
const EVIDENCE_CREATED_AT = '2026-08-12T19:00:00.000Z';
const EVIDENCE_CUTOFF = '2026-08-12T20:00:00.000Z';
const SCAN_OBSERVED_AT = '2026-08-12T19:30:00.000Z';
const SCANNER_PATH = fileURLToPath(
  new URL(
    '../../../.agents/skills/gitblocks-oss-adoption/scripts/fingerprint-codebase.mjs',
    import.meta.url,
  ),
);
const AUTHORIZATION_FINALISTS = [
  'auth-casbin-casbin',
  'auth-casbin-casbin-js',
  'auth-casbin-node-casbin',
  'auth-warrant',
  'auth-aserto-topaz',
] as const;
const BACKGROUND_JOB_FINALISTS = [
  'jobs-actionhero-node-resque',
  'jobs-asynq',
  'jobs-bree',
  'jobs-bullmq',
  'jobs-node-cron',
] as const;
const nativeFetch = globalThis.fetch.bind(globalThis);
const loopbackFetch: FetchLike = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname !== GITBLOCKS_MCP_HOST) {
    throw new Error('PostgreSQL MCP test permits loopback HTTP only.');
  }
  return nativeFetch(input, init);
};

let ownerSql: Sql;

beforeAll(() => {
  ownerSql = directSql(OWNER_CONFIG);
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await resetDatabase();
  await ownerSql.end({ timeout: 5 });
});

describe('hosted recommendation PostgreSQL and official MCP exercise', () => {
  it('composes the R7 scanner with the existing target-grounded MCP recommendation and rejects invented target facts', async () => {
    const writer = createPersistenceClient(WRITER_CONFIG);
    const targetRoot = await mkdtemp(join(tmpdir(), 'gitblocks-r7-target-'));
    await writeFile(
      join(targetRoot, 'package.json'),
      JSON.stringify({
        packageManager: 'pnpm@11.17.0',
        engines: { node: '>=24.12.0 <25' },
        devDependencies: { typescript: '6.0.3' },
      }),
    );
    await writeFile(join(targetRoot, 'tsconfig.json'), 'inert and unread');
    const scannerResult = await scanTargetRepository(targetRoot);
    const runtimeFact = scannerResult.fingerprint.facts.find(
      (fact) => fact.kind === 'component' && fact.component === 'runtime',
    );
    if (runtimeFact === undefined) {
      throw new Error('R7 integration fixture did not emit the Node runtime.');
    }
    const validRequest = recommendationRequestWithFingerprint(
      'postgres-valid-recommendation',
      scannerResult,
    );
    const invalidRequest = recommendationRequestWithFingerprint(
      'postgres-invalid-model-output',
      scannerResult,
    );
    const authorities = await loadAcceptedAuthorities();
    const model = vi.fn((input: FitAssessmentModelRequestV1) => {
      const response = structuredClone(groundedModelResponse(input));
      bindRepositoryFact(response, runtimeFact.factId);
      if (input.fitAssessmentRequest.assessmentRequestId.includes('invalid')) {
        inventRepositoryFact(response);
      }
      return Promise.resolve(response);
    });
    let hostedProcess;
    let client: Client | undefined;
    try {
      await seedAcceptedCandidateIdentities(writer);
      await seedFinalistEvidence(writer);
      await publishServingCatalogSnapshot(writer, {
        candidateProfileAuthority: authorities.profiles,
        candidateRetrievalMetadataAuthority: authorities.metadata,
        publishedAt: PUBLISHED_AT,
      });
      await closePersistenceClient(writer);

      hostedProcess = await startGitBlocksMcpProcess({
        database: SERVING_CONFIG,
        fitModel: { assess: model },
        clock: { now: () => EVIDENCE_CUTOFF },
        port: 0,
        token: 'test-only-mcp-token',
      });

      await ownerSql.unsafe(`
        revoke select on table
          gitblocks.serving_catalog_snapshots,
          gitblocks.serving_catalog_current_snapshot,
          gitblocks.serving_candidate_profile_records,
          gitblocks.serving_candidate_retrieval_metadata_records
        from gitblocks_serving
      `);

      client = new Client(
        { name: 'gitblocks-r6-postgresql-mcp-test', version: '0.0.0' },
        { versionNegotiation: { mode: { pin: '2026-07-28' } } },
      );
      await client.connect(
        new StreamableHTTPClientTransport(hostedProcess.endpoint, {
          authProvider: {
            token: () => Promise.resolve('test-only-mcp-token'),
          },
          fetch: loopbackFetch,
        }),
      );
      expect((await client.listTools()).tools.map(({ name }) => name)).toEqual([
        GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
      ]);

      const valid = await client.callTool({
        name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
        arguments: validRequest,
      });
      expect(valid.isError).not.toBe(true);
      expect(valid.structuredContent).toMatchObject({
        outcome: 'recommend',
        responsibleOptions: [{ candidateId: AUTHORIZATION_FINALISTS[0] }],
        targetFitAssessment: {
          inferenceRepositoryFactBindings: [
            { repositoryFactIds: [runtimeFact.factId] },
          ],
        },
      });
      expect(
        responsibleOptionCount(valid.structuredContent),
      ).toBeLessThanOrEqual(3);

      const invalid = await client.callTool({
        name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
        arguments: invalidRequest,
      });
      expect(invalid).toMatchObject({
        isError: true,
        content: [{ type: 'text', text: 'GitBlocks recommendation failed.' }],
      });
      expect(model).toHaveBeenCalledTimes(2);
      expect(
        model.mock.calls.every(
          ([input]) => input.fitAssessmentRequest.candidates.length === 5,
        ),
      ).toBe(true);
      expect(
        model.mock.calls[0]?.[0].fitAssessmentRequest.candidates.map(
          ({ identity }) => identity.candidateId,
        ),
      ).toEqual(AUTHORIZATION_FINALISTS);

      await client.close();
      client = undefined;
      await hostedProcess.close();
      hostedProcess = undefined;
      const sessions = await ownerSql<readonly { readonly count: number }[]>`
        select pg_catalog.count(*)::integer as count
        from pg_catalog.pg_stat_activity
        where datname = ${SERVING_CONFIG.database}
          and usename = ${SERVING_CONFIG.username}
          and application_name = 'gitblocks-persistence'
      `;
      expect(sessions).toEqual([{ count: 0 }]);
    } finally {
      await Promise.all([
        client?.close(),
        hostedProcess?.close(),
        closePersistenceClient(writer),
        rm(targetRoot, { recursive: true, force: true }),
      ]);
    }
  });

  it('resolves zero-eligible finalists from temporary candidate evidence and fails closed for unresolved or conflict promotion through official recommend_oss', async () => {
    const writer = createPersistenceClient(WRITER_CONFIG);
    const authorities = await loadAcceptedAuthorities();
    const validRequest = recommendationRequestId(
      frozenBackgroundJobsDogfoodRequest(),
      'postgres-r8-valid',
    );
    const invalidUnresolvedRequest = recommendationRequestId(
      frozenBackgroundJobsDogfoodRequest(),
      'postgres-r8-invalid-unresolved',
    );
    const invalidConflictRequest = recommendationRequestId(
      frozenBackgroundJobsDogfoodRequest(),
      'postgres-r8-invalid-conflict',
    );
    const model = vi.fn((input: FitAssessmentModelRequestV1) => {
      const response = controlledEvidenceNeededResponse(input);
      const assessmentId = input.fitAssessmentRequest.assessmentRequestId;
      if (assessmentId.includes('invalid-unresolved')) {
        promoteUnresolvedCandidate(response);
      }
      if (assessmentId.includes('invalid-conflict')) {
        promoteConflictCandidate(response);
      }
      return Promise.resolve(response);
    });
    let hostedProcess;
    let client: Client | undefined;
    try {
      await seedAcceptedCandidateIdentities(writer);
      await seedBackgroundJobFinalistEvidence(writer);
      await publishServingCatalogSnapshot(writer, {
        candidateProfileAuthority: authorities.profiles,
        candidateRetrievalMetadataAuthority: authorities.metadata,
        publishedAt: PUBLISHED_AT,
      });
      await closePersistenceClient(writer);

      hostedProcess = await startGitBlocksMcpProcess({
        database: SERVING_CONFIG,
        fitModel: { assess: model },
        clock: { now: () => EVIDENCE_CUTOFF },
        port: 0,
        token: 'test-only-mcp-token',
      });
      client = new Client(
        { name: 'gitblocks-r8-postgresql-mcp-test', version: '0.0.0' },
        { versionNegotiation: { mode: { pin: '2026-07-28' } } },
      );
      await client.connect(
        new StreamableHTTPClientTransport(hostedProcess.endpoint, {
          authProvider: {
            token: () => Promise.resolve('test-only-mcp-token'),
          },
          fetch: loopbackFetch,
        }),
      );
      expect((await client.listTools()).tools.map(({ name }) => name)).toEqual([
        GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
      ]);

      const valid = await client.callTool({
        name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
        arguments: validRequest,
      });
      expect(valid.isError).not.toBe(true);
      expect(valid.structuredContent).toMatchObject({
        outcome: 'recommend',
        responsibleOptions: [{ candidateId: BACKGROUND_JOB_FINALISTS[0] }],
      });
      expect(hardResolutionStates(valid.structuredContent)).toMatchObject({
        [BACKGROUND_JOB_FINALISTS[0]]: [
          'satisfied',
          'satisfied',
          'satisfied',
          'satisfied',
        ],
        [BACKGROUND_JOB_FINALISTS[1]]: [
          'satisfied',
          'conflict',
          'satisfied',
          'satisfied',
        ],
        [BACKGROUND_JOB_FINALISTS[2]]: [
          'unresolved',
          'unresolved',
          'unresolved',
          'unresolved',
        ],
      });
      expect(
        responsibleOptionCount(valid.structuredContent),
      ).toBeLessThanOrEqual(3);

      for (const request of [
        invalidUnresolvedRequest,
        invalidConflictRequest,
      ]) {
        expect(
          await client.callTool({
            name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
            arguments: request,
          }),
        ).toMatchObject({
          isError: true,
          content: [{ type: 'text', text: 'GitBlocks recommendation failed.' }],
        });
      }
      expect(model).toHaveBeenCalledTimes(3);
      expect(
        model.mock.calls.every(
          ([input]) =>
            input.retrievalFinalists.length === 5 &&
            input.retrievalFinalists.every(
              ({ lane }) => lane === 'evidence-needed',
            ),
        ),
      ).toBe(true);
      expect(
        model.mock.calls[0]?.[0].retrievalFinalists.map(
          ({ candidateId }) => candidateId,
        ),
      ).toEqual(BACKGROUND_JOB_FINALISTS);
    } finally {
      await Promise.all([
        client?.close(),
        hostedProcess?.close(),
        closePersistenceClient(writer),
      ]);
    }
  });

  it('supplies commit-coherent immutable excerpts to the frozen zero-eligible finalists through official recommend_oss without external effects', async () => {
    const writer = createPersistenceClient(WRITER_CONFIG);
    const authorities = await loadAcceptedAuthorities();
    let modelValidationIssues: readonly unknown[] = [];
    const model = vi.fn((input: FitAssessmentModelRequestV1) => {
      const response = controlledEvidenceNeededResponse(input);
      groundPositiveResolutionsInArtifact(response, input);
      const validation = validateRecommendationModelAssessmentExchangeV1({
        request: input.fitAssessmentRequest,
        normalization: input.normalization,
        retrievalFinalists: input.retrievalFinalists,
        response,
        assessmentId: 'assessment-persistence-integration',
        producedAt: EVIDENCE_CUTOFF,
      });
      modelValidationIssues = validation.ok ? [] : validation.issues;
      return Promise.resolve(response);
    });
    let hostedProcess;
    let client: Client | undefined;
    try {
      await seedAcceptedCandidateIdentities(writer);
      await seedBackgroundJobArtifactEvidence(writer);
      await publishServingCatalogSnapshot(writer, {
        candidateProfileAuthority: authorities.profiles,
        candidateRetrievalMetadataAuthority: authorities.metadata,
        publishedAt: PUBLISHED_AT,
      });
      await closePersistenceClient(writer);

      hostedProcess = await startGitBlocksMcpProcess({
        database: SERVING_CONFIG,
        fitModel: { assess: model },
        clock: { now: () => EVIDENCE_CUTOFF },
        port: 0,
        token: 'test-only-mcp-token',
      });
      client = new Client(
        { name: 'gitblocks-r9-postgresql-mcp-test', version: '0.0.0' },
        { versionNegotiation: { mode: { pin: '2026-07-28' } } },
      );
      await client.connect(
        new StreamableHTTPClientTransport(hostedProcess.endpoint, {
          authProvider: {
            token: () => Promise.resolve('test-only-mcp-token'),
          },
          fetch: loopbackFetch,
        }),
      );

      const result = await client.callTool({
        name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
        arguments: recommendationRequestId(
          frozenBackgroundJobsDogfoodRequest(),
          'postgres-r9-artifact-evidence',
        ),
      });

      expect(model).toHaveBeenCalledTimes(1);
      expect(modelValidationIssues).toEqual([]);
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        outcome: 'recommend',
        responsibleOptions: [{ candidateId: BACKGROUND_JOB_FINALISTS[0] }],
      });
      expect(hardResolutionStates(result.structuredContent)).toMatchObject({
        [BACKGROUND_JOB_FINALISTS[0]]: [
          'satisfied',
          'satisfied',
          'satisfied',
          'satisfied',
        ],
        [BACKGROUND_JOB_FINALISTS[1]]: [
          'satisfied',
          'conflict',
          'satisfied',
          'satisfied',
        ],
        [BACKGROUND_JOB_FINALISTS[2]]: [
          'unresolved',
          'unresolved',
          'unresolved',
          'unresolved',
        ],
      });
      expect(
        responsibleOptionCount(result.structuredContent),
      ).toBeLessThanOrEqual(3);
      const input = model.mock.calls[0]?.[0];
      expect(
        input?.retrievalFinalists.map(({ candidateId }) => candidateId),
      ).toEqual(BACKGROUND_JOB_FINALISTS);
      const artifactEvidenceCounts = input?.fitAssessmentRequest.candidates.map(
        (dossier) =>
          dossier.observations.filter(
            ({ topic }) => topic === 'artifact-excerpt',
          ).length,
      );
      expect(artifactEvidenceCounts).toEqual([2, 2, 0, 0, 0]);
      expect(
        input?.fitAssessmentRequest.candidates
          .flatMap(({ observations }) => observations)
          .filter(({ topic }) => topic === 'artifact-excerpt')
          .every(
            ({ source }) =>
              source.kind === 'git-commit' &&
              source.commitSha === TEST_ARTIFACT_COMMIT_SHA &&
              /#L\d+(?:-L\d+)?$/u.test(source.immutableUrl),
          ),
      ).toBe(true);
    } finally {
      await Promise.all([
        client?.close(),
        hostedProcess?.close(),
        closePersistenceClient(writer),
      ]);
    }
  });
});

interface ScannerResult {
  readonly fingerprint: RepositoryFingerprintV1;
  readonly reference: {
    readonly fingerprintId: string;
    readonly fingerprintDigest: string;
  };
}

async function scanTargetRepository(
  repositoryRoot: string,
): Promise<ScannerResult> {
  const scan = await executeScanner([
    '--observed-at',
    SCAN_OBSERVED_AT,
    repositoryRoot,
  ]);
  if (scan.status !== 0 || scan.stderr !== '') {
    throw new Error('R7 scanner integration fixture failed.');
  }
  const parsedFingerprint = parseRepositoryFingerprintV1(
    JSON.parse(scan.stdout) as unknown,
  );
  if (!parsedFingerprint.ok) {
    throw new Error('R7 scanner output failed the authoritative parser.');
  }
  const referenceResult = await executeScanner(
    ['--reference'],
    scan.stdout,
    tmpdir(),
  );
  if (referenceResult.status !== 0 || referenceResult.stderr !== '') {
    throw new Error('R7 scanner reference mode failed.');
  }
  const reference: unknown = JSON.parse(referenceResult.stdout);
  if (
    typeof reference !== 'object' ||
    reference === null ||
    !('fingerprintId' in reference) ||
    typeof reference.fingerprintId !== 'string' ||
    !('fingerprintDigest' in reference) ||
    typeof reference.fingerprintDigest !== 'string'
  ) {
    throw new Error('R7 scanner reference output is invalid.');
  }
  const parsedReference = {
    fingerprintId: reference.fingerprintId,
    fingerprintDigest: reference.fingerprintDigest,
  };
  if (
    parsedReference.fingerprintId !== parsedFingerprint.value.fingerprintId ||
    parsedReference.fingerprintDigest !==
      repositoryFingerprintDigestV1(parsedFingerprint.value)
  ) {
    throw new Error('R7 scanner reference digest lacks contract parity.');
  }
  return { fingerprint: parsedFingerprint.value, reference: parsedReference };
}

function recommendationRequestWithFingerprint(
  id: string,
  scannerResult: ScannerResult,
): OssRecommendationRequestV1 {
  const fixture = recommendationRequest({ id, term: 'authorization' });
  const request = {
    ...fixture,
    capabilityQuery: {
      ...fixture.capabilityQuery,
      repositoryFingerprintReference: scannerResult.reference,
    },
    repositoryFingerprint: scannerResult.fingerprint,
  };
  const parsed = parseOssRecommendationRequestV1(request);
  if (!parsed.ok) {
    throw new Error('R7 scanner request failed the recommendation contract.');
  }
  return parsed.value;
}

interface ScannerProcessResult {
  readonly status: number | null;
  readonly stderr: string;
  readonly stdout: string;
}

function executeScanner(
  arguments_: readonly string[],
  stdin = '',
  cwd?: string,
): Promise<ScannerProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCANNER_PATH, ...arguments_], {
      ...(cwd === undefined ? {} : { cwd }),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (status) => {
      resolve({
        status,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
    child.stdin.end(stdin);
  });
}

function bindRepositoryFact(
  response: RecommendationAssessmentModelResponseV1,
  repositoryFactId: string,
): void {
  const binding =
    response.targetFitAssessment.inferenceRepositoryFactBindings[0];
  if (binding !== undefined) {
    binding.repositoryFactIds = [repositoryFactId];
  }
}

async function seedAcceptedCandidateIdentities(
  client: PersistenceClient,
): Promise<void> {
  const { profiles } = await loadAcceptedAuthorities();
  for (const contractProfile of profiles.profiles) {
    const profile = contractProfile as unknown as DeterministicCandidateProfile;
    const identity = profileIdentity(profile);
    const family = knownField(profile, 'capability-family');
    await putCatalogCandidate(client, {
      identity,
      createdAt: '2026-08-12T17:00:00.000Z',
    });
    await setCandidateCapabilityFamilies(client, {
      candidateId: profile.candidateId,
      capabilityFamilies: [
        family.value.primaryFamily,
        ...family.value.additionalFamilies,
      ],
    });
  }
}

async function seedFinalistEvidence(client: PersistenceClient): Promise<void> {
  const { profiles } = await loadAcceptedAuthorities();
  const profileById = new Map(
    profiles.profiles.map((profile) => [
      profile.candidateId,
      profile as unknown as DeterministicCandidateProfile,
    ]),
  );
  for (const candidateId of AUTHORIZATION_FINALISTS) {
    const profile = profileById.get(candidateId);
    if (profile === undefined) throw new Error('Finalist profile is missing.');
    const dossier = {
      ...candidateDossier(candidateId, EVIDENCE_CUTOFF),
      identity: profileIdentity(profile),
    };
    for (const observation of dossier.observations) {
      await appendEvidenceObservation(client, {
        observation,
        createdAt: EVIDENCE_CREATED_AT,
      });
    }
    for (const limitation of dossier.limitations) {
      await appendCandidateLimitation(client, {
        limitation,
        createdAt: EVIDENCE_CREATED_AT,
      });
    }
    for (const unknown of dossier.unknowns) {
      await appendCandidateUnknown(client, {
        unknown,
        createdAt: EVIDENCE_CREATED_AT,
      });
    }
  }
}

async function seedBackgroundJobFinalistEvidence(
  client: PersistenceClient,
): Promise<void> {
  const { profiles } = await loadAcceptedAuthorities();
  const profileById = new Map(
    profiles.profiles.map((profile) => [
      profile.candidateId,
      profile as unknown as DeterministicCandidateProfile,
    ]),
  );
  for (const [index, candidateId] of BACKGROUND_JOB_FINALISTS.entries()) {
    const profile = profileById.get(candidateId);
    if (profile === undefined)
      throw new Error('R8 finalist profile is missing.');
    const family = knownField(profile, 'capability-family').value.primaryFamily;
    const base = candidateDossier(candidateId, EVIDENCE_CUTOFF, {
      capabilityFamily: family,
    });
    const observation = base.observations[0];
    if (observation === undefined) throw new Error('R8 evidence is missing.');
    const dossier = {
      ...base,
      identity: profileIdentity(profile),
      observations: [
        {
          ...observation,
          observation:
            index === 0
              ? 'Synthetic official-repository evidence states automatic retry with configurable backoff, no Redis requirement, and current Node.js support.'
              : index === 1
                ? 'Synthetic official-repository evidence states automatic retry support and a required Redis service.'
                : 'Synthetic official-repository evidence describes durable worker processing but is silent about retry and Redis requirements.',
        },
      ],
    };
    for (const candidateObservation of dossier.observations) {
      await appendEvidenceObservation(client, {
        observation: candidateObservation,
        createdAt: EVIDENCE_CREATED_AT,
      });
    }
    for (const limitation of dossier.limitations) {
      await appendCandidateLimitation(client, {
        limitation,
        createdAt: EVIDENCE_CREATED_AT,
      });
    }
    for (const unknown of dossier.unknowns) {
      await appendCandidateUnknown(client, {
        unknown,
        createdAt: EVIDENCE_CREATED_AT,
      });
    }
  }
}

async function seedBackgroundJobArtifactEvidence(
  client: PersistenceClient,
): Promise<void> {
  const { profiles } = await loadAcceptedAuthorities();
  const profileById = new Map(
    profiles.profiles.map((profile) => [
      profile.candidateId,
      profile as unknown as DeterministicCandidateProfile,
    ]),
  );
  const contents = [
    'Failed jobs have automatic retries with configurable backoff.\nThis in-process queue does not require Redis.',
    'Failed jobs have automatic retries with configurable backoff.\nRedis is required to coordinate workers.',
    'Workers process durable jobs from a persistent queue.',
    'Failed jobs have automatic retries.\nRedis is required.',
  ] as const;
  for (const [index, candidateId] of BACKGROUND_JOB_FINALISTS.entries()) {
    const profile = profileById.get(candidateId);
    if (profile === undefined)
      throw new Error('R9 finalist profile is missing.');
    const identity = profileIdentity(profile);
    const family = knownField(profile, 'capability-family').value.primaryFamily;
    const dossier = {
      ...candidateRepositoryHeadDossier(candidateId, family),
      identity,
    };
    const repositoryHead = dossier.observations[0];
    if (repositoryHead === undefined) {
      throw new Error('R9 repository-head evidence is missing.');
    }
    try {
      await appendEvidenceObservation(client, {
        observation: repositoryHead,
        createdAt: EVIDENCE_CREATED_AT,
      });
      for (const unknown of dossier.unknowns) {
        await appendCandidateUnknown(client, {
          unknown,
          createdAt: EVIDENCE_CREATED_AT,
        });
      }
    } catch (error) {
      throw new Error(`R9 repository head failed for ${candidateId}.`, {
        cause: error,
      });
    }
    const content = contents[index];
    if (content === undefined) continue;
    const material = candidateArtifactMaterial({
      candidateId,
      catalogDigest: profiles.catalogDigest,
      content,
      commitSha: index === 3 ? '2'.repeat(40) : TEST_ARTIFACT_COMMIT_SHA,
      repositoryOwner: identity.repository.owner,
      repositoryName: identity.repository.name,
    });
    try {
      await publishRepositoryArtifactSet(client, material);
    } catch (error) {
      throw new Error(`R9 artifact publication failed for ${candidateId}.`, {
        cause: error,
      });
    }
  }
}

function controlledEvidenceNeededResponse(
  input: FitAssessmentModelRequestV1,
): RecommendationAssessmentModelResponseV1 {
  const response = structuredClone(groundedModelResponse(input));
  const candidateId = input.retrievalFinalists[1]?.candidateId;
  if (candidateId === undefined)
    throw new Error('R8 conflict finalist is missing.');
  const dossier = input.fitAssessmentRequest.candidates.find(
    ({ identity }) => identity.candidateId === candidateId,
  );
  const evidence =
    dossier?.observations.filter(({ topic }) => topic === 'artifact-excerpt') ??
    [];
  const groundedEvidence =
    evidence.length > 0 ? evidence : (dossier?.observations.slice(0, 1) ?? []);
  const firstGroundedEvidence = groundedEvidence[0];
  const assessment =
    response.targetFitAssessment.fitAssessment.candidateAssessments.find(
      (candidate) => candidate.candidateId === candidateId,
    );
  const resolutions = response.evidenceNeededHardConstraintResolutions.filter(
    (resolution) => resolution.candidateId === candidateId,
  );
  const reason = assessment?.reasons[0];
  if (
    firstGroundedEvidence === undefined ||
    assessment === undefined ||
    reason === undefined ||
    resolutions.length === 0
  ) {
    throw new Error('R8 controlled conflict input is incomplete.');
  }
  const inferenceId = `inference-hard-resolution-${candidateId}`;
  response.targetFitAssessment.fitAssessment.inferences.push({
    kind: 'inference',
    inferenceId,
    candidateId,
    topic: 'hard-constraint-resolution',
    statement:
      'The supplied candidate evidence establishes the hard-constraint state.',
    rationale:
      'The resolution uses only the supplied candidate-owned observation.',
    evidenceIds: groundedEvidence.map(({ evidenceId }) => evidenceId),
  });
  assessment.disposition = 'rejected';
  assessment.inferenceIds = [inferenceId];
  reason.inferenceIds = [inferenceId];
  for (const resolution of resolutions) {
    resolution.state = 'satisfied';
    resolution.inferenceIds = [inferenceId];
  }
  const conflictResolution = resolutions.find((resolution) => {
    const normalized = input.normalization.normalizedConstraints.find(
      ({ normalizedConstraintId }) =>
        normalizedConstraintId === resolution.evaluationId,
    );
    return normalized?.sourceConstraintIds.includes('no-redis') === true;
  });
  if (conflictResolution === undefined) {
    throw new Error('R8 Redis conflict resolution is missing.');
  }
  conflictResolution.state = 'conflict';
  const conflictId = `conflict-${candidateId}-redis`;
  assessment.hardConstraintConflictIds = [conflictId];
  reason.reasonCode = 'redis-unavailable';
  response.targetFitAssessment.fitAssessment.hardConstraintConflicts.push({
    conflictId,
    candidateId,
    constraintId: 'no-redis',
    reasonCode: 'redis-unavailable',
    evidenceIds: [
      groundedEvidence.find(({ observation }) => /redis/iu.test(observation))
        ?.evidenceId ?? firstGroundedEvidence.evidenceId,
    ],
  });
  return response;
}

function groundPositiveResolutionsInArtifact(
  response: RecommendationAssessmentModelResponseV1,
  input: FitAssessmentModelRequestV1,
): void {
  const candidateId = input.retrievalFinalists[0]?.candidateId;
  const dossier = input.fitAssessmentRequest.candidates.find(
    ({ identity }) => identity.candidateId === candidateId,
  );
  const artifactEvidence =
    dossier?.observations.filter(({ topic }) => topic === 'artifact-excerpt') ??
    [];
  const inference = response.targetFitAssessment.fitAssessment.inferences.find(
    (candidateInference) => candidateInference.candidateId === candidateId,
  );
  if (
    candidateId === undefined ||
    artifactEvidence.length === 0 ||
    inference === undefined
  ) {
    throw new Error('R9 positive artifact grounding is incomplete.');
  }
  inference.evidenceIds = artifactEvidence.map(({ evidenceId }) => evidenceId);
  inference.rationale =
    'The resolution uses only supplied commit-coherent repository excerpts.';
}

function promoteUnresolvedCandidate(
  response: RecommendationAssessmentModelResponseV1,
): void {
  const unresolved = response.evidenceNeededHardConstraintResolutions.find(
    ({ state }) => state === 'unresolved',
  );
  const assessment =
    response.targetFitAssessment.fitAssessment.candidateAssessments.find(
      ({ candidateId }) => candidateId === unresolved?.candidateId,
    );
  if (assessment !== undefined) assessment.disposition = 'viable';
}

function promoteConflictCandidate(
  response: RecommendationAssessmentModelResponseV1,
): void {
  const conflict = response.evidenceNeededHardConstraintResolutions.find(
    ({ state }) => state === 'conflict',
  );
  const assessment =
    response.targetFitAssessment.fitAssessment.candidateAssessments.find(
      ({ candidateId }) => candidateId === conflict?.candidateId,
    );
  if (assessment !== undefined) assessment.disposition = 'viable';
}

function recommendationRequestId(
  fixture: OssRecommendationRequestV1,
  id: string,
): OssRecommendationRequestV1 {
  return {
    ...fixture,
    recommendationRequestId: id,
    capabilityQuery: { ...fixture.capabilityQuery, queryInputId: id },
  };
}

function profileIdentity(profile: DeterministicCandidateProfile) {
  const repository = knownField(profile, 'repository-identity');
  const packageMapping = knownField(profile, 'package-identity-mapping');
  return {
    candidateId: profile.candidateId,
    displayName: repository.value.displayName,
    repository: {
      host: 'github' as const,
      owner: repository.value.githubOwner,
      name: repository.value.githubRepository,
    },
    package:
      packageMapping.value.mapping === 'mapped'
        ? {
            registry: 'npm' as const,
            name: packageMapping.value.packageName,
          }
        : null,
  };
}

function knownField<
  Id extends
    'capability-family' | 'package-identity-mapping' | 'repository-identity',
>(profile: DeterministicCandidateProfile, fieldId: Id) {
  const field = profile.fields.find(
    (candidate) => candidate.fieldId === fieldId,
  ) as DeterministicProfileFieldRecord<Id> | undefined;
  if (field?.state !== 'known') {
    throw new Error('Accepted serving identity field is unavailable.');
  }
  return field;
}

function inventRepositoryFact(
  value: RecommendationAssessmentModelResponseV1,
): void {
  const binding = value.targetFitAssessment.inferenceRepositoryFactBindings[0];
  if (binding !== undefined) binding.repositoryFactIds = ['fact-invented'];
}

function responsibleOptionCount(value: unknown): number {
  return typeof value === 'object' &&
    value !== null &&
    'responsibleOptions' in value &&
    Array.isArray(value.responsibleOptions)
    ? value.responsibleOptions.length
    : 0;
}

function hardResolutionStates(
  value: unknown,
): Readonly<Record<string, readonly string[]>> {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('evidenceNeededHardConstraintResolutions' in value) ||
    !Array.isArray(value.evidenceNeededHardConstraintResolutions)
  ) {
    return {};
  }
  const resolutions: readonly unknown[] =
    value.evidenceNeededHardConstraintResolutions;
  const states: Record<string, string[]> = {};
  for (const resolution of resolutions) {
    const parsed = plainRecord(resolution);
    const candidateId = parsed?.['candidateId'];
    const state = parsed?.['state'];
    if (typeof candidateId !== 'string' || typeof state !== 'string') {
      continue;
    }
    const candidateStates = states[candidateId] ?? [];
    candidateStates.push(state);
    states[candidateId] = candidateStates;
  }
  return states;
}

function plainRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

async function resetDatabase(): Promise<void> {
  await ownerSql.unsafe('drop schema if exists gitblocks cascade');
  const owner = createPersistenceClient(OWNER_CONFIG);
  try {
    await applyMigrations(owner);
  } finally {
    await closePersistenceClient(owner);
  }
}

function directSql(config: PersistenceClientConfig): Sql {
  return postgres({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl,
    max: config.maximumConnections ?? 5,
    connect_timeout: 5,
    idle_timeout: 5,
    onnotice: () => undefined,
    debug: false,
  });
}

function readOwnerConfig(): PersistenceClientConfig {
  if (process.env['GITBLOCKS_DB_TEST_ACK'] !== 'ephemeral') {
    throw new Error('PostgreSQL integration database must be ephemeral.');
  }
  return {
    host: requiredEnvironment('GITBLOCKS_TEST_DB_HOST'),
    port: parsePort(requiredEnvironment('GITBLOCKS_TEST_DB_PORT')),
    database: requiredEnvironment('GITBLOCKS_TEST_DB_DATABASE'),
    username: requiredEnvironment('GITBLOCKS_TEST_DB_OWNER'),
    password: requiredEnvironment('GITBLOCKS_TEST_DB_PASSWORD'),
    ssl: false,
    maximumConnections: 5,
    connectTimeoutMilliseconds: 5_000,
    idleTimeoutMilliseconds: 5_000,
    statementTimeoutMilliseconds: 60_000,
    lockTimeoutMilliseconds: 10_000,
  };
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error('PostgreSQL integration configuration is required.');
  }
  return value;
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PostgreSQL integration configuration is invalid.');
  }
  return port;
}
