import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  CandidateAuthorityFirstFatalError,
  createCandidateAuthorityFatalDiagnostic,
  normalizeCandidateAuthorityAdvisorySeverity,
  parseCandidateAuthorityAdvisory,
  parseCandidateAuthorityGitTree,
  parseCandidateAuthorityOptionalGitBlob,
  parseCandidateAuthorityOptionalString,
  parseCandidateAuthorityOptionalStringRecord,
  parseCandidateAuthorityReleaseWindow,
  projectCandidateAuthorityLocalSecurityPolicy,
  runCandidateAuthorityFatalCancellingWorkers,
  serializeCandidateAuthorityFatalDiagnostic,
  type CandidateAuthorityFatalCounters,
  type CandidateAuthorityTreeEntry,
} from '../src/candidate-authority-provider-contract.ts';
import { extractApplicableSecurityAdvisoryFacts } from '../src/candidate-authority-partial-rules.ts';
import { ingestionError } from '../src/errors.ts';

const ROOT_SHA = '1'.repeat(40);
const DOT_GITHUB_SHA = '2'.repeat(40);
const DOCS_SHA = '3'.repeat(40);

describe('candidate authority successor provider contracts', () => {
  it('does not depend on an undocumented community-profile security_policy property', () => {
    const ordinaryCommunityProfile = { files: { code_of_conduct: null } };
    expect(ordinaryCommunityProfile.files).not.toHaveProperty(
      'security_policy',
    );
    expect(
      projectCandidateAuthorityLocalSecurityPolicy({
        root: tree(ROOT_SHA, []),
        dotGithub: tree(DOT_GITHUB_SHA, []),
        docs: tree(DOCS_SHA, []),
      }),
    ).toEqual({
      state: 'unknown',
      reason: 'account-level-default-policy-unresolved',
    });
  });

  it.each([
    {
      path: 'SECURITY.md' as const,
      root: [blob('SECURITY.md', 'a'.repeat(40))],
      dotGithub: [],
      docs: [],
    },
    {
      path: '.github/SECURITY.md' as const,
      root: [],
      dotGithub: [blob('SECURITY.md', 'b'.repeat(40))],
      docs: [],
    },
    {
      path: 'docs/SECURITY.md' as const,
      root: [],
      dotGithub: [],
      docs: [blob('SECURITY.md', 'c'.repeat(40))],
    },
  ])(
    'establishes only repository-local positive security evidence: $path',
    (fixture) => {
      const result = projectCandidateAuthorityLocalSecurityPolicy({
        root: tree(ROOT_SHA, fixture.root),
        dotGithub: tree(DOT_GITHUB_SHA, fixture.dotGithub),
        docs: tree(DOCS_SHA, fixture.docs),
      });
      expect(result).toMatchObject({
        state: 'known',
        value: { present: true },
        path: fixture.path,
      });
    },
  );

  it('keeps local security absence and unavailable/truncated subtrees unknown, never false', () => {
    const absent = projectCandidateAuthorityLocalSecurityPolicy({
      root: tree(ROOT_SHA, []),
      dotGithub: tree(DOT_GITHUB_SHA, []),
      docs: tree(DOCS_SHA, []),
    });
    const unavailable = projectCandidateAuthorityLocalSecurityPolicy({
      root: tree(ROOT_SHA, []),
      dotGithub: { state: 'qualified-unknown', reason: 'tree-truncated' },
      docs: tree(DOCS_SHA, []),
    });
    expect(absent).toEqual({
      state: 'unknown',
      reason: 'account-level-default-policy-unresolved',
    });
    expect(unavailable).toEqual({
      state: 'unknown',
      reason: 'local-security-tree-unavailable',
    });
    expect(JSON.stringify([absent, unavailable])).not.toContain('false');
  });

  it.each([
    ['low', 'low'],
    ['medium', 'moderate'],
    ['high', 'high'],
    ['critical', 'critical'],
    ['unknown', null],
  ] as const)(
    'normalizes provider severity %s without fabricating product severity',
    (provider, normalized) => {
      expect(normalizeCandidateAuthorityAdvisorySeverity(provider)).toEqual({
        providerSeverity: provider,
        normalizedSeverity: normalized,
      });
    },
  );

  it('treats an unexpected provider severity as unsupported structured data', () => {
    expect(normalizeCandidateAuthorityAdvisorySeverity('moderate')).toBeNull();
  });

  it('retains provider unknown, excludes withdrawn advisories, and preserves known partial evidence', () => {
    expect(
      parseCandidateAuthorityAdvisory({
        ghsa_id: 'GHSA-2345-6789-CFGH',
        severity: 'unknown',
        withdrawn_at: null,
      }),
    ).toEqual({
      kind: 'value',
      advisory: {
        advisoryId: 'GHSA-2345-6789-CFGH',
        providerSeverity: 'unknown',
        normalizedSeverity: null,
      },
    });
    expect(
      parseCandidateAuthorityAdvisory({
        ghsa_id: 'GHSA-2345-6789-CFGH',
        severity: 'critical',
        withdrawn_at: '2026-08-01T00:00:00Z',
      }),
    ).toEqual({ kind: 'withdrawn' });
    expect(
      extractApplicableSecurityAdvisoryFacts({
        expectedPackageName: 'example',
        expectedPackageVersion: '1.2.3',
        sourcePackageName: 'example',
        sourcePackageVersion: '1.2.3',
        outcome: 'established-value',
        advisories: [
          { advisoryId: 'GHSA-2345-6789-CFGH', severity: 'high' },
          { advisoryId: 'GHSA-6789-CFGH-JMPQ', severity: null },
        ],
      }),
    ).toMatchObject({
      state: 'established-facts',
      facts: [
        expect.objectContaining({ factCode: 'applicable-security-advisory' }),
      ],
    });
  });

  it('classifies valid tree truncation and the local semantic bound as qualified unknown', () => {
    expect(
      parseCandidateAuthorityGitTree({
        value: { sha: ROOT_SHA, truncated: true, tree: [] },
        expectedSha: ROOT_SHA,
        localSemanticEntryLimit: 10_000,
      }),
    ).toEqual({ state: 'qualified-unknown', reason: 'tree-truncated' });
    expect(
      parseCandidateAuthorityGitTree({
        value: {
          sha: ROOT_SHA,
          truncated: false,
          tree: [blob('one', '4'.repeat(40)), blob('two', '5'.repeat(40))],
        },
        expectedSha: ROOT_SHA,
        localSemanticEntryLimit: 1,
      }),
    ).toEqual({
      state: 'qualified-unknown',
      reason: 'tree-local-semantic-bound-exceeded',
    });
  });

  it('keeps wrong tree identity and malformed tree shape fatal', () => {
    expect(() =>
      parseCandidateAuthorityGitTree({
        value: { sha: '0'.repeat(40), truncated: false, tree: [] },
        expectedSha: ROOT_SHA,
        localSemanticEntryLimit: 10_000,
      }),
    ).toThrow(expect.objectContaining({ code: 'ingestion.provider-identity' }));
    expect(() =>
      parseCandidateAuthorityGitTree({
        value: { sha: ROOT_SHA, truncated: 'no', tree: [] },
        expectedSha: ROOT_SHA,
        localSemanticEntryLimit: 10_000,
      }),
    ).toThrow(expect.objectContaining({ code: 'ingestion.provider-response' }));
  });

  it('separates immutable blob identity from unsupported optional content', () => {
    const invalidUtf8 = Buffer.from([0xff]);
    const invalidEntry = blobForBytes('Dockerfile', invalidUtf8);
    expect(
      parseCandidateAuthorityOptionalGitBlob({
        value: blobResponse(invalidEntry, invalidUtf8),
        expectedEntry: invalidEntry,
        semanticMaximumBytes: 262_144,
      }),
    ).toEqual({
      state: 'qualified-unknown',
      reason: 'unsupported-optional-content',
    });

    const content = Buffer.from('FROM node:24\n', 'utf8');
    const entry = blobForBytes('Dockerfile', content);
    expect(() =>
      parseCandidateAuthorityOptionalGitBlob({
        value: { ...blobResponse(entry, content), sha: '0'.repeat(40) },
        expectedEntry: entry,
        semanticMaximumBytes: 262_144,
      }),
    ).toThrow(expect.objectContaining({ code: 'ingestion.provider-identity' }));
  });

  it('ignores accessible drafts before publication fields and sorts supported published releases', () => {
    const result = parseCandidateAuthorityReleaseWindow([
      {
        draft: true,
        published_at: null,
        tag_name: null,
        prerelease: false,
        html_url: null,
      },
      release('v1.0.0', '2026-01-01T00:00:00Z'),
      release('rolling', '2026-03-01T00:00:00Z'),
      release('v2.0.0', '2026-02-01T00:00:00Z'),
    ]);
    expect(result.ignoredDraftCount).toBe(1);
    expect(result.unsupportedPublishedReleaseCount).toBe(1);
    expect(result.releases.map((item) => item.tagName)).toEqual([
      'v2.0.0',
      'v1.0.0',
    ]);
  });

  it('isolates unsupported npm optional properties', () => {
    expect(parseCandidateAuthorityOptionalString(undefined, 100)).toEqual({
      state: 'absent',
      value: null,
    });
    expect(parseCandidateAuthorityOptionalString({ bad: true }, 100)).toEqual({
      state: 'unsupported',
      value: null,
    });
    expect(
      parseCandidateAuthorityOptionalStringRecord({ express: '^5.0.0' }, 200),
    ).toEqual({ state: 'supported', value: { express: '^5.0.0' } });
    expect(
      parseCandidateAuthorityOptionalStringRecord({ express: 5 }, 200),
    ).toEqual({ state: 'unsupported', value: null });
  });
});

describe('candidate authority first-fatal cancellation', () => {
  it('aborts five workers, assigns no new work, settles siblings, and preserves the causal fatal', async () => {
    const items = Array.from({ length: 20 }, (_, index) => index);
    const started: number[] = [];
    const cancelled: number[] = [];
    const settled: number[] = [];
    const counters = mutableCounters();
    let thrown: unknown;
    try {
      await runCandidateAuthorityFatalCancellingWorkers({
        items,
        workerCount: 5,
        context: (item) => ({
          candidateId: `candidate-${String(item)}`,
          operationId: item === 2 ? 'github-advisories' : 'github-root-tree',
        }),
        execute: async (item, signal) => {
          started.push(item);
          counters.githubLogicalRequests += 1;
          counters.githubAttempts += 1;
          counters.perOperation['github-root-tree'] = {
            logicalRequests: counters.githubLogicalRequests,
            attempts: counters.githubAttempts,
          };
          try {
            if (item === 2) throw ingestionError('ingestion.provider-response');
            await new Promise<void>((resolve) => {
              const timer = setTimeout(resolve, 100);
              signal.addEventListener(
                'abort',
                () => {
                  clearTimeout(timer);
                  cancelled.push(item);
                  resolve();
                },
                { once: true },
              );
            });
          } finally {
            settled.push(item);
          }
        },
        readFinalCounters: () => frozenCounters(counters),
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(CandidateAuthorityFirstFatalError);
    expect(thrown).toMatchObject({
      candidateId: 'candidate-2',
      operationId: 'github-advisories',
      safeCode: 'ingestion.provider-response',
    });
    // The initial five workers may each claim one item before the first
    // rejection crosses the promise boundary. No sixth item may begin.
    expect(started).toEqual([0, 1, 2, 3, 4]);
    expect(cancelled).toEqual(expect.arrayContaining([0, 1, 3, 4]));
    expect(settled.sort((left, right) => left - right)).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect((thrown as CandidateAuthorityFirstFatalError).counters).toEqual(
      frozenCounters(counters),
    );
  });

  it('renders only the bounded safe fatal envelope after cancellation settles', () => {
    const counters = frozenCounters({
      ...mutableCounters(),
      githubLogicalRequests: 7,
      npmLogicalRequests: 1,
      githubAttempts: 8,
      npmAttempts: 1,
      retries: 1,
      perOperation: {
        'github-advisories': { logicalRequests: 7, attempts: 8 },
        'npm-package-metadata': { logicalRequests: 1, attempts: 1 },
      },
    });
    const fatal = new CandidateAuthorityFirstFatalError({
      context: {
        candidateId: 'candidate-safe-id',
        operationId: 'github-advisories',
      },
      cause: ingestionError('ingestion.provider-response'),
      counters,
    });
    const envelope = createCandidateAuthorityFatalDiagnostic({
      authorizationVersion: 'candidate-authority-live-authorization/4.0.0',
      authorizationDigest: 'a'.repeat(64),
      executionHead: 'b'.repeat(40),
      collectionCutoff: '2026-08-11T12:00:00.000Z',
      fatal,
      ownedStagingExisted: true,
      ownedStagingCleaned: true,
    });
    expect(envelope).toMatchObject({
      firstFatalCandidateId: 'candidate-safe-id',
      firstFatalOperationId: 'github-advisories',
      safeErrorCode: 'ingestion.provider-response',
      totalLogicalRequests: 8,
      totalAttempts: 9,
      retries: 1,
      sourceAuthorityPublished: false,
    });
    const rendered = serializeCandidateAuthorityFatalDiagnostic(envelope);
    for (const prohibited of [
      'credential',
      'authorizationHeader',
      'responseBody',
      'providerValue',
      'inert-fixture-token',
    ]) {
      expect(rendered).not.toContain(prohibited);
    }
  });
});

function tree(sha: string, entries: readonly CandidateAuthorityTreeEntry[]) {
  return { state: 'established-value' as const, sha, entries };
}

function blob(path: string, sha: string): CandidateAuthorityTreeEntry {
  return { path, mode: '100644', type: 'blob', sha, size: null };
}

function blobForBytes(
  path: string,
  bytes: Buffer,
): CandidateAuthorityTreeEntry {
  const sha = createHash('sha1')
    .update(Buffer.from(`blob ${String(bytes.byteLength)}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
  return { path, mode: '100644', type: 'blob', sha, size: bytes.byteLength };
}

function blobResponse(entry: CandidateAuthorityTreeEntry, bytes: Buffer) {
  return {
    sha: entry.sha,
    encoding: 'base64',
    size: bytes.byteLength,
    content: bytes.toString('base64'),
  };
}

function release(tagName: string, publishedAt: string) {
  return {
    draft: false,
    tag_name: tagName,
    published_at: publishedAt,
    prerelease: false,
    html_url: `https://github.com/example/project/releases/tag/${tagName}`,
  };
}

function mutableCounters(): {
  githubLogicalRequests: number;
  npmLogicalRequests: number;
  githubAttempts: number;
  npmAttempts: number;
  retries: number;
  perOperation: Record<
    string,
    { readonly logicalRequests: number; readonly attempts: number }
  >;
} {
  return {
    githubLogicalRequests: 0,
    npmLogicalRequests: 0,
    githubAttempts: 0,
    npmAttempts: 0,
    retries: 0,
    perOperation: {},
  };
}

function frozenCounters(
  counters: ReturnType<typeof mutableCounters>,
): CandidateAuthorityFatalCounters {
  return {
    githubLogicalRequests: counters.githubLogicalRequests,
    npmLogicalRequests: counters.npmLogicalRequests,
    githubAttempts: counters.githubAttempts,
    npmAttempts: counters.npmAttempts,
    retries: counters.retries,
    perOperation: { ...counters.perOperation },
  };
}
