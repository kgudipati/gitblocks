import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  closePersistenceClient,
  createPersistenceClient,
  findReusableRepositoryInterview,
  knownMigrationInventory,
  loadRepositoryInterviewExchange,
  publishRepositoryInterviewExchange,
  type PersistenceClientConfig,
} from '../src/index.ts';
import {
  createFailedRepositoryInterviewExecution,
  createRepositoryInterviewPersistenceFixture,
} from './repository-interview-fixtures.ts';

const UNREACHABLE_CONFIG: PersistenceClientConfig = {
  host: '127.0.0.1',
  port: 1,
  database: 'gitblocks_test',
  username: 'gitblocks_test',
  password: 'test-only',
  ssl: false,
  connectTimeoutMilliseconds: 250,
};

describe('repository interview persistence boundary', () => {
  it('registers only the fourth forward migration', () => {
    expect(knownMigrationInventory().at(-1)).toEqual({
      version: 4,
      name: 'repository-interviews',
      fileName: '0004_repository_interviews.sql',
    });
    expect(knownMigrationInventory()).toHaveLength(4);
  });

  it('rejects malformed publish roots before database I/O', async () => {
    const client = createPersistenceClient(UNREACHABLE_CONFIG);
    const fixture = createRepositoryInterviewPersistenceFixture();
    try {
      await expect(
        publishRepositoryInterviewExchange(client, {
          request: { ...fixture.request, promptDigest: 'unsafe' },
          execution: fixture.execution,
          interview: fixture.interview,
        }),
      ).rejects.toMatchObject({ code: 'persistence.invalid-input' });
      await expect(
        publishRepositoryInterviewExchange(client, {
          request: fixture.request,
          execution: fixture.execution,
          interview: null,
        }),
      ).rejects.toMatchObject({ code: 'persistence.invalid-input' });
      const failed = createFailedRepositoryInterviewExecution(
        fixture.request,
        'refused',
      );
      await expect(
        publishRepositoryInterviewExchange(client, {
          request: fixture.request,
          execution: failed,
          interview: fixture.interview,
        }),
      ).rejects.toMatchObject({ code: 'persistence.invalid-input' });
    } finally {
      await closePersistenceClient(client);
    }
  });

  it('rejects open or malformed historical lookup unions before database I/O', async () => {
    const client = createPersistenceClient(UNREACHABLE_CONFIG);
    try {
      await expect(
        loadRepositoryInterviewExchange(client, {
          by: 'execution-id',
          executionId: `modelexec-${'a'.repeat(48)}`,
          extra: true,
        } as never),
      ).rejects.toMatchObject({ code: 'persistence.invalid-input' });
      await expect(
        loadRepositoryInterviewExchange(client, {
          by: 'interview-id',
          interviewId: 'unsafe',
        }),
      ).rejects.toMatchObject({ code: 'persistence.invalid-input' });
    } finally {
      await closePersistenceClient(client);
    }
  });

  it('rejects malformed reuse digests before database I/O', async () => {
    const client = createPersistenceClient(UNREACHABLE_CONFIG);
    try {
      await expect(
        findReusableRepositoryInterview(client, {
          requestIdentityDigest: 'unsafe',
          modelProfileDigest: 'b'.repeat(64),
          reuseKeyDigest: 'c'.repeat(64),
        }),
      ).rejects.toMatchObject({ code: 'persistence.invalid-input' });
    } finally {
      await closePersistenceClient(client);
    }
  });

  it('keeps the implementation side-effect free and dependency-inward', async () => {
    const source = await readFile(
      new URL('../src/repository-interview-operations.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toContain('process.env');
    expect(source).not.toContain('@gitblocks/interviews');
    expect(source).not.toContain('@gitblocks/ingestion');
    expect(source).not.toMatch(/\bconsole\./u);
    expect(source).not.toMatch(/\b(?:eval|Function)\s*\(/u);
    expect(source).not.toContain('.unsafe(');
  });
});
