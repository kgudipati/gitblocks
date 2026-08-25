import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createConnection } from 'node:net';

import {
  Client,
  StreamableHTTPClientTransport,
  type FetchLike,
} from '@modelcontextprotocol/client';
import {
  getContractSchemaV1,
  repositoryFingerprintDigestV1,
} from '@gitblocks/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  HostedRecommendationApplicationV1,
  HostedRecommendationOperationResultV1,
} from '../src/application.ts';
import { HOSTED_FIT_MODEL } from '../src/configuration.ts';
import {
  GITBLOCKS_MCP_HOST,
  GITBLOCKS_HEALTH_PATH,
  GITBLOCKS_MCP_PATH,
  startGitBlocksMcpHttpServer,
  type GitBlocksMcpHttpServerV1,
} from '../src/mcp-http.ts';
import { GITBLOCKS_RECOMMEND_OSS_TOOL_NAME } from '../src/mcp-server.ts';
import { createOpenAiFitAssessmentModel } from '../src/openai-fit-model.ts';
import {
  candidateDossier,
  createAcceptedApplication,
  recommendationRequest,
} from './fixtures.ts';

const nativeFetch = globalThis.fetch.bind(globalThis);
const MCP_TOKEN = 'test-only-mcp-bearer-token';
const loopbackFetch: FetchLike = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname !== GITBLOCKS_MCP_HOST) {
    throw new Error('MCP tests permit loopback HTTP only.');
  }
  return nativeFetch(input, init);
};

const clients: Client[] = [];
const servers: GitBlocksMcpHttpServerV1[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('GitBlocks recommendation MCP adapter', () => {
  it('accepts a natural capability phrase and a bare named candidate through an actual MCP client exchange', async () => {
    const application = await createAcceptedApplication();
    const recommendOss = vi.fn((input: unknown) =>
      application.recommendOss(input),
    );
    const { client } = await connectClient({ recommendOss });
    const listed = await client.listTools();
    const tool = listed.tools.find(
      ({ name }) => name === GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
    );
    expect(tool?.description).toContain('candidateReferences');
    expect(JSON.stringify(tool?.inputSchema)).toContain('bare string');
    expect(JSON.stringify(tool?.inputSchema)).toContain('pg-boss');

    const canonical = recommendationRequest({
      id: 'mcp-simple-background-jobs-pg-boss',
      term: 'background-jobs',
    });
    const called = await client.callTool({
      name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
      arguments: {
        contractVersion: '2.0.0',
        summary:
          'Find a durable background job library for this repository and assess pg-boss.',
        capabilityTerms: ['durable background jobs'],
        successConditions: [
          'Jobs persist across process restarts and retry transient failures.',
        ],
        constraints: [],
        candidateReferences: ['pg-boss'],
        repositoryFingerprint: canonical.repositoryFingerprint,
        transmissionApproval: {
          approvedBy: 'request-originator',
          approvedAt: canonical.transmissionApproval.approvedAt,
          approvedCategories: canonical.transmissionApproval.approvedCategories,
          fingerprintDigest: repositoryFingerprintDigestV1(
            canonical.repositoryFingerprint,
          ),
        },
      },
    });

    expect(recommendOss).toHaveBeenCalledTimes(1);
    expect(called.isError).not.toBe(true);
    expect(called.structuredContent).toMatchObject({
      outcome: 'recommend',
      normalization: {
        outcome: 'normalized',
        primaryFamilyId: 'background-jobs',
        resolvedCandidateReferences: [
          {
            referenceKind: 'candidate-id',
            intent: 'named-candidate',
            candidateId: 'jobs-pg-boss',
          },
        ],
      },
    });
  });

  it('names every accepted capability family in primary text when an unrecognized term needs clarification', async () => {
    const application = await createAcceptedApplication();
    const { client } = await connectClient(application);
    const called = await client.callTool({
      name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
      arguments: recommendationRequest({
        id: 'mcp-unknown-capability-guidance',
        term: 'uncategorized automation facility',
      }),
    });

    expect(called.isError).not.toBe(true);
    expect(called.structuredContent).toMatchObject({
      outcome: 'clarification-required',
    });
    expect(primaryText(called.content)).toContain(
      'Accepted capability families: authorization, audit-logging, background-jobs, rate-limiting, webhooks.',
    );
  });

  it('uses the official modern client to expose exactly recommend_oss and carries a complete option in primary text after one call', async () => {
    const application = await createAcceptedApplication();
    const recommendOss = vi.fn((input: unknown) =>
      application.recommendOss(input),
    );
    const { client } = await connectClient({ recommendOss });

    expect(client.getProtocolEra()).toBe('modern');
    const listed = await client.listTools();
    expect(listed.tools).toHaveLength(1);
    expect(listed.tools[0]).toMatchObject({
      name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
      inputSchema: getContractSchemaV1('oss-recommendation-request'),
    });
    expect(listed.tools.some(({ name }) => name === 'discover_oss')).toBe(
      false,
    );

    const called = await client.callTool({
      name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
      arguments: recommendationRequest({
        id: 'mcp-recommendation',
        term: 'authorization',
      }),
    });
    expect(recommendOss).toHaveBeenCalledTimes(1);
    expect(called.isError).not.toBe(true);
    const text = primaryText(called.content);
    expect(text).toContain('GitBlocks recommendation outcome: recommend.');
    expect(text).toContain('Responsible options (GitBlocks order; 1 option)');
    expect(text).toContain('Verification status: fully-verified');
    expect(text).toContain('Fit rationale:');
    expect(text).toContain('Candidate evidence:');
    expect(text).toContain('Target repository facts used:');
    expect(text).toContain('Important inferences:');
    expect(text).toContain('Limitations:');
    expect(text).toContain('Material unknowns:');
    expect(called.structuredContent).toMatchObject({
      outcome: 'recommend',
    });
    const options = responsibleOptions(called.structuredContent);
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThanOrEqual(3);
    expect(candidateId(options[0])).not.toBeNull();
    expect(options[0]).toMatchObject({
      verificationStatus: 'fully-verified',
      constraintStatuses: [],
    });
    expect(text).toContain(candidateId(options[0]) ?? 'missing-candidate-id');
    expect(recommendOss).toHaveBeenCalledTimes(1);
  });

  it('distinguishes curated PostgreSQL verification from the exact rate-limiter-flexible implementation unknown', async () => {
    const application = await createAcceptedApplication();
    const seeded = await application.recommendOss(
      recommendationRequest({
        id: 'mcp-rate-limiter-flexible-presentation',
        term: 'authorization',
      }),
    );
    if (!seeded.ok || seeded.result.outcome !== 'recommend') {
      throw new Error('Expected recommendation fixture outcome.');
    }
    const seededOption = seeded.result.responsibleOptions[0];
    const seededAssessment =
      seeded.result.targetFitAssessment.fitAssessment.candidateAssessments.find(
        ({ candidateId: assessmentCandidateId }) =>
          assessmentCandidateId === seededOption?.candidateId,
      );
    if (seededOption === undefined || seededAssessment === undefined) {
      throw new Error('Expected one responsible option fixture.');
    }
    const unknownId = 'unknown-postgresql-backed-state';
    const exactCase: HostedRecommendationOperationResultV1 = {
      ok: true,
      result: {
        ...seeded.result,
        responsibleOptions: [
          {
            ...seededOption,
            identity: {
              ...seededOption.identity,
              displayName: 'rate-limiter-flexible',
              repository: {
                host: 'github',
                owner: 'animir',
                name: 'node-rate-limiter-flexible',
              },
              package: { registry: 'npm', name: 'rate-limiter-flexible' },
            },
            verificationStatus: 'fully-verified',
            constraintStatuses: [
              {
                constraintId: 'postgresql-required',
                statement: 'Must use the existing PostgreSQL database.',
                modality: 'required',
                status: 'verified',
                grounding: [
                  {
                    evaluationId: 'normalized-postgresql-required',
                    basis: 'deterministic',
                    inferenceIds: [],
                  },
                ],
              },
            ],
          },
        ],
        targetFitAssessment: {
          ...seeded.result.targetFitAssessment,
          fitAssessment: {
            ...seeded.result.targetFitAssessment.fitAssessment,
            candidateAssessments:
              seeded.result.targetFitAssessment.fitAssessment.candidateAssessments.map(
                (assessment) =>
                  assessment.candidateId === seededAssessment.candidateId
                    ? {
                        ...assessment,
                        unknownIds: [...assessment.unknownIds, unknownId],
                      }
                    : assessment,
              ),
            materialUnknowns: [
              ...seeded.result.targetFitAssessment.fitAssessment
                .materialUnknowns,
              {
                scope: 'candidate',
                unknownId,
                candidateId: seededAssessment.candidateId,
                topic: 'postgresql-backed-state',
                statement:
                  'Candidate evidence does not establish PostgreSQL-backed rate-limit state without Redis.',
                evidenceIds: [],
              },
            ],
          },
        },
      },
    };
    const recommendOss = vi.fn(() => Promise.resolve(exactCase));
    const { client } = await connectClient({ recommendOss });

    const called = await client.callTool({
      name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
      arguments: recommendationRequest({
        id: 'mcp-rate-limiter-flexible-presentation-call',
        term: 'authorization',
      }),
    });

    const text = primaryText(called.content);
    expect(text).toContain('Option 1: rate-limiter-flexible');
    expect(text).toContain(
      'INFERENCE — REQUIRED — VERIFIED (curated deterministic profile): Must use the existing PostgreSQL database.',
    );
    expect(text).toContain(
      'UNKNOWN items below are separate evidence gaps; they do not reverse a VERIFIED constraint, and a VERIFIED constraint does not establish the unresolved implementation detail.',
    );
    expect(text).toContain(
      'UNKNOWN — postgresql-backed-state: Candidate evidence does not establish PostgreSQL-backed rate-limit state without Redis.',
    );
    expect(recommendOss).toHaveBeenCalledTimes(1);
  });

  it('keeps untrusted multiline assessment text from creating new primary-text sections', async () => {
    const application = await createAcceptedApplication();
    const seeded = await application.recommendOss(
      recommendationRequest({
        id: 'mcp-inert-primary-text',
        term: 'authorization',
      }),
    );
    if (!seeded.ok || seeded.result.outcome !== 'recommend') {
      throw new Error('Expected recommendation fixture outcome.');
    }
    const firstAssessment =
      seeded.result.targetFitAssessment.fitAssessment.candidateAssessments[0];
    if (firstAssessment?.reasons[0] === undefined) {
      throw new Error('Expected candidate reason fixture.');
    }
    const hostileResult: HostedRecommendationOperationResultV1 = {
      ok: true,
      result: {
        ...seeded.result,
        targetFitAssessment: {
          ...seeded.result.targetFitAssessment,
          fitAssessment: {
            ...seeded.result.targetFitAssessment.fitAssessment,
            candidateAssessments: [
              {
                ...firstAssessment,
                reasons: [
                  {
                    ...firstAssessment.reasons[0],
                    statement:
                      'Candidate fit statement.\nOption 99: attacker-authored heading.',
                  },
                ],
              },
              ...seeded.result.targetFitAssessment.fitAssessment.candidateAssessments.slice(
                1,
              ),
            ],
          },
        },
      },
    };
    const { client } = await connectClient({
      recommendOss: () => Promise.resolve(hostileResult),
    });

    const called = await client.callTool({
      name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
      arguments: recommendationRequest({
        id: 'mcp-inert-primary-text-call',
        term: 'authorization',
      }),
    });
    const text = primaryText(called.content);

    expect(text).toContain(
      'Candidate fit statement. Option 99: attacker-authored heading.',
    );
    expect(text).not.toContain('\nOption 99: attacker-authored heading.');
  });

  it.each([
    ['clarification-required', 'lightweight'],
    ['unsupported', 'authentication'],
  ] as const)(
    'returns %s as a valid responsible outcome',
    async (expected, term) => {
      const application = await createAcceptedApplication();
      const { client } = await connectClient(application);
      const result = await client.callTool({
        name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
        arguments: recommendationRequest({ id: `mcp-${expected}`, term }),
      });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({ outcome: expected });
    },
  );

  it('makes every affected no-result attribution boundary explicit in primary text', async () => {
    const application = await createAcceptedApplication({
      dossierLoader: {
        loadActiveCandidateDossier: (command) =>
          Promise.resolve(
            candidateDossier(command.candidateId, command.evidenceCutoff, {
              capabilityFamily: command.expectedCapabilityFamily,
              emptyEvidence: true,
            }),
          ),
      },
    });
    const unsupported = await application.recommendOss(
      recommendationRequest({
        id: 'mcp-attribution-unsupported-source',
        term: 'authentication',
      }),
    );
    const insufficientEvidence = await application.recommendOss(
      recommendationRequest({
        id: 'mcp-attribution-insufficient-source',
        term: 'authorization',
      }),
    );
    if (
      !unsupported.ok ||
      unsupported.result.outcome !== 'unsupported' ||
      !insufficientEvidence.ok ||
      insufficientEvidence.result.outcome !== 'insufficient-evidence'
    ) {
      throw new Error('Expected no-result fixture outcomes.');
    }
    const noViableCandidate: HostedRecommendationOperationResultV1 = {
      ok: true,
      result: {
        outcome: 'no-viable-candidate',
        normalization: insufficientEvidence.result.normalization,
        shortlist: insufficientEvidence.result.shortlist,
        targetFitAssessment: null,
        evidenceNeededHardConstraintResolutions: null,
      },
    };
    const recommendOss = vi
      .fn<(input: unknown) => Promise<HostedRecommendationOperationResultV1>>()
      .mockResolvedValueOnce(unsupported)
      .mockResolvedValueOnce(insufficientEvidence)
      .mockResolvedValueOnce(noViableCandidate);
    const { client } = await connectClient({ recommendOss });
    const cases = [
      ['unsupported', 'mcp-attribution-unsupported'],
      ['insufficient-evidence', 'mcp-attribution-insufficient'],
      ['no-viable-candidate', 'mcp-attribution-no-viable'],
    ] as const;

    for (const [outcome, id] of cases) {
      const result = await client.callTool({
        name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
        arguments: recommendationRequest({ id, term: 'authorization' }),
      });
      expect(result.content).toEqual([
        {
          type: 'text',
          text:
            `GitBlocks recommendation outcome: ${outcome}. ` +
            'GitBlocks validated no candidate; claims obtained from any other source are not GitBlocks results.',
        },
      ]);
    }
  });

  it('keeps retrieval scores in the application result but removes them from the default agent-facing payload', async () => {
    const application = await createAcceptedApplication({
      dossierLoader: {
        loadActiveCandidateDossier: (command) =>
          Promise.resolve(
            candidateDossier(command.candidateId, command.evidenceCutoff, {
              capabilityFamily: command.expectedCapabilityFamily,
              emptyEvidence: true,
            }),
          ),
      },
    });
    const applicationResult = await application.recommendOss(
      recommendationRequest({
        id: 'mcp-score-application-result',
        term: 'authorization',
      }),
    );
    if (
      !applicationResult.ok ||
      applicationResult.result.outcome !== 'insufficient-evidence'
    ) {
      throw new Error('Expected insufficient-evidence fixture outcome.');
    }
    const applicationCandidate =
      applicationResult.result.shortlist.eligibleCandidates[0] ??
      applicationResult.result.shortlist.evidenceNeededCandidates[0];
    expect(applicationCandidate?.retrievalScore).toEqual(expect.any(Number));

    const recommendOss = vi.fn(() => Promise.resolve(applicationResult));
    const { client } = await connectClient({ recommendOss });
    const result = await client.callTool({
      name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
      arguments: recommendationRequest({
        id: 'mcp-score-agent-facing-result',
        term: 'authorization',
      }),
    });

    expect(JSON.stringify(result.structuredContent)).not.toContain(
      'retrievalScore',
    );
    expect(JSON.stringify(result.structuredContent)).toContain(
      applicationCandidate?.candidateId,
    );
    const agentCandidate = shortlistCandidates(result.structuredContent).find(
      (candidate) =>
        candidateId(candidate) === applicationCandidate?.candidateId,
    );
    expect(hasCandidateDisplayIdentity(agentCandidate)).toBe(true);
    expect(
      shortlistCandidates(result.structuredContent).some(hasNpmPackageIdentity),
    ).toBe(true);
  });

  it('maps application and unexpected failures to one bounded value-free error', async () => {
    const failure: HostedRecommendationOperationResultV1 = {
      ok: false,
      failure: {
        kind: 'application',
        code: 'fit-model-failed',
        stage: 'model-assessment',
        path: 'fit-model-assessment',
        causeCode: 'hosted.fit-model-timeout',
      },
    };
    const failureEvents: unknown[] = [];
    const recommendOss = vi
      .fn<(input: unknown) => Promise<HostedRecommendationOperationResultV1>>()
      .mockResolvedValueOnce(failure)
      .mockRejectedValueOnce(new Error('provider credential sentinel'));
    const { client } = await connectClient({ recommendOss }, (event) =>
      failureEvents.push(event),
    );
    const request = recommendationRequest({
      id: 'mcp-bounded-failure',
      term: 'authorization',
    });

    const first = await client.callTool({
      name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
      arguments: request,
    });
    const second = await client.callTool({
      name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
      arguments: request,
    });
    expect([first, second]).toEqual([
      expect.objectContaining({
        isError: true,
        content: [{ type: 'text', text: 'GitBlocks recommendation failed.' }],
      }),
      expect.objectContaining({
        isError: true,
        content: [{ type: 'text', text: 'GitBlocks recommendation failed.' }],
      }),
    ]);
    expect(JSON.stringify([first, second])).not.toContain('sentinel');
    expect(failureEvents).toEqual([
      {
        operation: 'hosted.recommendation',
        correlationId: 'mcp-bounded-failure',
        status: 'failed',
        stage: 'model-assessment',
        path: 'fit-model-assessment',
        code: 'fit-model-failed',
        causeCode: 'hosted.fit-model-timeout',
      },
      {
        operation: 'hosted.recommendation',
        correlationId: 'mcp-bounded-failure',
        status: 'failed',
        stage: 'mcp',
        path: 'application-call',
        code: 'unexpected-application-error',
        causeCode: 'hosted.internal',
      },
    ]);
    expect(JSON.stringify(failureEvents)).not.toContain('sentinel');
  });

  it('logs bounded provider diagnostics while keeping every client failure byte-for-byte unchanged', async () => {
    const apiKey = 'sk-provider-log-credential-sentinel';
    const providerMessage =
      'You have no credits remaining. provider-message-sentinel';
    const cases = [
      {
        status: 401,
        causeCode: 'hosted.fit-model-provider-authentication-failed',
        providerFailure: { httpStatus: 401 },
      },
      {
        status: 429,
        causeCode: 'hosted.fit-model-provider-rate-limit-failed',
        providerFailure: {
          httpStatus: 429,
          errorType: 'insufficient_quota',
          errorCode: 'credit_balance_exhausted',
        },
      },
      {
        status: 500,
        causeCode: 'hosted.fit-model-provider-server-failed',
        providerFailure: { httpStatus: 500 },
      },
    ] as const;
    const failureEvents: unknown[] = [];
    const responses: unknown[] = [];
    for (const providerCase of cases) {
      const application = await createAcceptedApplication({
        fitModel: createOpenAiFitAssessmentModel({
          configuration: { apiKey, model: HOSTED_FIT_MODEL },
          fetch: () =>
            Promise.resolve(
              new Response(
                JSON.stringify({
                  error: {
                    message: providerMessage,
                    ...(providerCase.status === 429
                      ? {
                          type: 'insufficient_quota',
                          code: 'credit_balance_exhausted',
                        }
                      : {}),
                  },
                }),
                {
                  status: providerCase.status,
                  headers: { 'content-type': 'application/json' },
                },
              ),
            ),
        }),
      });
      const { client } = await connectClient(application, (event) =>
        failureEvents.push(event),
      );
      responses.push(
        await client.callTool({
          name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
          arguments: recommendationRequest({
            id: `mcp-provider-${String(providerCase.status)}-failure`,
            term: 'authorization',
          }),
        }),
      );
    }

    expect(responses).toEqual(
      cases.map(() => ({
        _meta: {
          'io.modelcontextprotocol/serverInfo': {
            name: 'gitblocks-hosted',
            version: '0.0.0',
          },
        },
        content: [{ type: 'text', text: 'GitBlocks recommendation failed.' }],
        isError: true,
      })),
    );
    expect(failureEvents).toEqual(
      cases.map(({ status, causeCode, providerFailure }) => ({
        operation: 'hosted.recommendation',
        correlationId: `mcp-provider-${String(status)}-failure`,
        status: 'failed',
        stage: 'model-assessment',
        path: 'fit-model-assessment',
        code: 'fit-model-failed',
        causeCode,
        providerFailure,
      })),
    );
    expect(JSON.stringify(failureEvents[1])).toBe(
      '{"operation":"hosted.recommendation","correlationId":"mcp-provider-429-failure","status":"failed","stage":"model-assessment","path":"fit-model-assessment","code":"fit-model-failed","causeCode":"hosted.fit-model-provider-rate-limit-failed","providerFailure":{"httpStatus":429,"errorType":"insufficient_quota","errorCode":"credit_balance_exhausted"}}',
    );
    const serialized = JSON.stringify({ responses, failureEvents });
    expect(serialized).not.toContain(providerMessage);
    expect(serialized).not.toContain(apiKey);
    expect(serialized).not.toContain('fingerprint-hosted-test');
    expect(serialized).not.toContain(
      'Select an OSS authorization capability for this repository.',
    );
  });

  it('keeps the bounded client failure unchanged when the log sink throws', async () => {
    const recommendOss = vi.fn(() =>
      Promise.resolve<HostedRecommendationOperationResultV1>({
        ok: false,
        failure: {
          kind: 'application',
          code: 'fit-model-failed',
          stage: 'model-assessment',
          path: 'fit-model-assessment',
          causeCode: 'hosted.fit-model-provider-failed',
        },
      }),
    );
    const { client } = await connectClient({ recommendOss }, () => {
      throw new Error('logging output sentinel');
    });

    expect(
      await client.callTool({
        name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
        arguments: recommendationRequest({
          id: 'mcp-failing-log-sink',
          term: 'authorization',
        }),
      }),
    ).toEqual(
      expect.objectContaining({
        isError: true,
        content: [{ type: 'text', text: 'GitBlocks recommendation failed.' }],
      }),
    );
  });

  it('keeps loopback authority behavior unchanged when the public host is unset', async () => {
    const application = await createAcceptedApplication();
    const server = await startGitBlocksMcpHttpServer({
      application,
      port: 0,
      token: MCP_TOKEN,
    });
    servers.push(server);
    expect(server.endpoint.hostname).toBe(GITBLOCKS_MCP_HOST);
    expect(server.endpoint.pathname).toBe(GITBLOCKS_MCP_PATH);
    expect(await rawStatus(server.endpoint, '/not-mcp')).toBe(404);
    expect(
      await rawStatus(server.endpoint, GITBLOCKS_MCP_PATH, {
        host: 'public.example.test',
      }),
    ).toBe(403);
    expect(
      await rawStatus(server.endpoint, GITBLOCKS_MCP_PATH, {
        origin: 'https://public.example.test',
      }),
    ).toBe(403);
  });

  it('keeps non-loopback bind authority behavior unchanged when the public host is unset', async () => {
    const application = await createAcceptedApplication();
    const server = await startGitBlocksMcpHttpServer({
      application,
      host: '0.0.0.0',
      port: 0,
      token: MCP_TOKEN,
    });
    servers.push(server);

    expect(
      await rawStatus(server.endpoint, GITBLOCKS_MCP_PATH, {
        host: 'public.example.test',
      }),
    ).toBe(403);
    expect(
      await rawStatus(server.endpoint, GITBLOCKS_MCP_PATH, {
        host: '0.0.0.0',
        origin: 'https://public.example.test',
      }),
    ).toBe(403);
    expect(
      await rawStatus(server.endpoint, GITBLOCKS_MCP_PATH, {
        host: '0.0.0.0',
      }),
    ).toBe(401);
  });

  it('uses a distinct public host for port-agnostic authority validation before the unchanged bearer check', async () => {
    const application = await createAcceptedApplication();
    const server = await startGitBlocksMcpHttpServer({
      application,
      host: '0.0.0.0',
      publicHost: 'example-app.fly.dev',
      port: 0,
      token: MCP_TOKEN,
    });
    servers.push(server);

    expect(
      await rawStatus(server.endpoint, GITBLOCKS_MCP_PATH, {
        host: 'different.example.test',
      }),
    ).toBe(403);
    expect(
      await rawStatus(server.endpoint, GITBLOCKS_MCP_PATH, {
        host: 'example-app.fly.dev',
      }),
    ).toBe(401);
    expect(
      await rawStatus(server.endpoint, GITBLOCKS_MCP_PATH, {
        host: 'example-app.fly.dev:8443',
        origin: 'https://example-app.fly.dev:443',
      }),
    ).toBe(401);
  });

  it('reports not-ready before snapshot readiness and ready afterwards without a credential', async () => {
    const application = await createAcceptedApplication();
    let ready = false;
    const server = await startGitBlocksMcpHttpServer({
      application,
      port: 0,
      token: MCP_TOKEN,
      readiness: () => ready,
    });
    servers.push(server);

    expect(await rawResponse(server.endpoint, GITBLOCKS_HEALTH_PATH)).toEqual(
      expect.objectContaining({
        status: 503,
        body: '{"status":"not-ready"}',
      }),
    );
    ready = true;
    expect(await rawResponse(server.endpoint, GITBLOCKS_HEALTH_PATH)).toEqual(
      expect.objectContaining({
        status: 200,
        body: '{"status":"ready"}',
      }),
    );
  });

  it('bounds listener drain time before forcibly closing an unfinished connection', async () => {
    const application = await createAcceptedApplication();
    const server = await startGitBlocksMcpHttpServer({
      application,
      port: 0,
      token: MCP_TOKEN,
      drainMilliseconds: 25,
    });
    servers.push(server);
    const socket = createConnection({
      host: server.endpoint.hostname,
      port: Number(server.endpoint.port),
    });
    await once(socket, 'connect');
    socket.write(
      `POST ${GITBLOCKS_MCP_PATH} HTTP/1.1\r\nHost: ${server.endpoint.host}\r\nAuthorization: Bearer ${MCP_TOKEN}\r\nContent-Length: 100\r\nContent-Type: application/json\r\n\r\n{`,
    );
    await new Promise((resolve) => setTimeout(resolve, 5));

    const startedAt = Date.now();
    await server.close();
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeGreaterThanOrEqual(15);
    expect(elapsed).toBeLessThan(500);
    socket.destroy();
  });

  it('returns the bounded unauthorized response when Authorization is missing', async () => {
    const server = await startServer();

    expect(
      await rawResponse(server.endpoint, GITBLOCKS_MCP_PATH),
    ).toMatchObject({
      status: 401,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: '{"error":"unauthorized"}',
    });
  });

  it('returns the same bounded unauthorized response for a wrong bearer token', async () => {
    const server = await startServer();

    expect(
      await rawResponse(server.endpoint, GITBLOCKS_MCP_PATH, {
        authorization: 'Bearer wrong-test-token',
      }),
    ).toMatchObject({
      status: 401,
      body: '{"error":"unauthorized"}',
    });
  });

  it('returns the same bounded unauthorized response for malformed Authorization', async () => {
    const server = await startServer();

    expect(
      await rawResponse(server.endpoint, GITBLOCKS_MCP_PATH, {
        authorization: `Basic ${MCP_TOKEN}`,
      }),
    ).toMatchObject({
      status: 401,
      body: '{"error":"unauthorized"}',
    });
  });

  it('never exposes bearer-token values through the response or transport error observer', async () => {
    const onError = vi.fn();
    const server = await startServer(onError);
    const wrongToken = 'wrong-token-output-sentinel';

    const response = await rawResponse(server.endpoint, GITBLOCKS_MCP_PATH, {
      authorization: `Bearer ${wrongToken}`,
    });

    expect(onError).not.toHaveBeenCalled();
    expect(JSON.stringify({ response, calls: onError.mock.calls })).not.toMatch(
      new RegExp(`${MCP_TOKEN}|${wrongToken}`, 'u'),
    );
  });

  it('keeps the MCP adapter free of persistence, retrieval, and model implementation imports', async () => {
    const source = await readFile(
      new URL('../src/mcp-server.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(
      /@gitblocks\/(?:persistence|retrieval)|openai-fit-model|loadActiveCandidateDossier/u,
    );
  });
});

async function connectClient(
  application: Pick<HostedRecommendationApplicationV1, 'recommendOss'>,
  onRecommendationFailure?: (event: unknown) => void,
): Promise<{
  readonly client: Client;
  readonly server: GitBlocksMcpHttpServerV1;
}> {
  const server = await startGitBlocksMcpHttpServer({
    application,
    port: 0,
    token: MCP_TOKEN,
    ...(onRecommendationFailure === undefined
      ? {}
      : {
          recommendationFailureObserver: {
            emit: onRecommendationFailure,
          },
        }),
  });
  servers.push(server);
  const client = new Client(
    { name: 'gitblocks-hosted-test', version: '0.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  clients.push(client);
  await client.connect(
    new StreamableHTTPClientTransport(server.endpoint, {
      authProvider: { token: () => Promise.resolve(MCP_TOKEN) },
      fetch: loopbackFetch,
    }),
  );
  return { client, server };
}

function responsibleOptions(value: unknown): readonly unknown[] {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('responsibleOptions' in value) ||
    !Array.isArray(value.responsibleOptions)
  ) {
    return [];
  }
  return value.responsibleOptions;
}

function primaryText(
  content: readonly { readonly type: string; readonly text?: string }[],
): string {
  const text = content.find((item) => item.type === 'text')?.text;
  if (text === undefined) {
    throw new Error('Expected primary MCP text content.');
  }
  return text;
}

function shortlistCandidates(value: unknown): readonly unknown[] {
  if (!isUnknownRecord(value) || !isUnknownRecord(value['shortlist'])) {
    return [];
  }
  const shortlist = value['shortlist'];
  const eligible = Array.isArray(shortlist['eligibleCandidates'])
    ? (shortlist['eligibleCandidates'] as readonly unknown[])
    : [];
  const evidenceNeeded = Array.isArray(shortlist['evidenceNeededCandidates'])
    ? (shortlist['evidenceNeededCandidates'] as readonly unknown[])
    : [];
  return [...eligible, ...evidenceNeeded];
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasCandidateDisplayIdentity(value: unknown): boolean {
  if (!isUnknownRecord(value) || !isUnknownRecord(value['repository'])) {
    return false;
  }
  const repository = value['repository'];
  return (
    typeof value['displayName'] === 'string' &&
    repository['host'] === 'github' &&
    typeof repository['owner'] === 'string' &&
    typeof repository['name'] === 'string'
  );
}

function rawStatus(
  endpoint: URL,
  path: string,
  headers: Readonly<Record<string, string>> = {},
): Promise<number | undefined> {
  return rawResponse(endpoint, path, headers).then(({ status }) => status);
}

function rawResponse(
  endpoint: URL,
  path: string,
  headers: Readonly<Record<string, string>> = {},
): Promise<{
  readonly status: number | undefined;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: string;
}> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        host: endpoint.hostname,
        port: endpoint.port,
        path,
        method: 'GET',
        headers,
      },
      (response) => {
        response.setEncoding('utf8');
        let body = '';
        response.on('data', (chunk: string) => {
          body += chunk;
        });
        response.once('end', () => {
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body,
          });
        });
      },
    );
    request.once('error', reject);
    request.end();
  });
}

async function startServer(onError?: () => void) {
  const application = await createAcceptedApplication();
  const server = await startGitBlocksMcpHttpServer({
    application,
    port: 0,
    token: MCP_TOKEN,
    ...(onError === undefined ? {} : { onError }),
  });
  servers.push(server);
  return server;
}

function candidateId(value: unknown): string | null {
  return typeof value === 'object' &&
    value !== null &&
    'candidateId' in value &&
    typeof value.candidateId === 'string'
    ? value.candidateId
    : null;
}

function hasNpmPackageIdentity(value: unknown): boolean {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('package' in value) ||
    typeof value.package !== 'object' ||
    value.package === null
  ) {
    return false;
  }
  return (
    'registry' in value.package &&
    value.package.registry === 'npm' &&
    'name' in value.package &&
    typeof value.package.name === 'string'
  );
}
