import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import {
  canonicalizeJson,
  compareProfileMaterializationSources,
  controlledFailureCounts,
  parseProfileMaterializationSourceAuthority,
  reconcileProfileMaterializationSourceAuthority,
  type ProfileMaterializationOperation,
  type ProfileMaterializationSourceRecordInput,
} from '../src/index.ts';
import { buildFakeSourceAuthority } from './profile-materialization-fixtures.ts';

const executeFile = promisify(execFile);

describe('profile-materialization source authority', () => {
  it('closes exactly 150 candidates and all mechanically expected sources', async () => {
    const { authority } = await buildFakeSourceAuthority();
    expect(authority.candidateCount).toBe(150);
    expect(authority.candidates).toHaveLength(150);
    expect(authority.sourceRecords).toHaveLength(833);
    expect(parseProfileMaterializationSourceAuthority(authority)).toEqual(
      authority,
    );
  });

  it('is stable under reversed source input and across a JSON round trip', async () => {
    const first = await buildFakeSourceAuthority();
    const reversed = await buildFakeSourceAuthority({
      mutate: (records) => records.reverse(),
    });
    expect(reversed.authority.authoritySemanticDigest).toBe(
      first.authority.authoritySemanticDigest,
    );
    expect(
      canonicalizeJson(
        parseProfileMaterializationSourceAuthority(
          JSON.parse(canonicalizeJson(first.authority).text),
        ),
      ).text,
    ).toBe(canonicalizeJson(first.authority).text);
  });

  it('rejects record-digest drift, unknown properties, and content leakage', async () => {
    const { authority } = await buildFakeSourceAuthority();
    const drifted = structuredClone(authority) as unknown as Record<
      string,
      unknown
    >;
    const records = drifted['sourceRecords'] as Record<string, unknown>[];
    records[0]!['controlledCode'] = 'tampered';
    expect(() => parseProfileMaterializationSourceAuthority(drifted)).toThrow();

    const unknown = structuredClone(authority) as unknown as Record<
      string,
      unknown
    >;
    (unknown['sourceRecords'] as Record<string, unknown>[])[0]!['rawBody'] =
      'README body';
    expect(() => parseProfileMaterializationSourceAuthority(unknown)).toThrow();

    for (const key of ['authorizationHeader', 'credential', 'databaseUrl']) {
      const leaked = structuredClone(authority) as unknown as Record<
        string,
        unknown
      >;
      (leaked['sourceRecords'] as Record<string, unknown>[])[0]![key] =
        'controlled-test-secret';
      expect(() =>
        parseProfileMaterializationSourceAuthority(leaked),
      ).toThrow();
    }
  });

  it('rejects incomplete and duplicate source closure', async () => {
    await expect(
      buildFakeSourceAuthority({
        mutate: (records) => records.pop(),
      }),
    ).rejects.toThrow();
    await expect(
      buildFakeSourceAuthority({
        mutate: (records) => records.push(structuredClone(records[0]!)),
      }),
    ).rejects.toThrow();
  });

  it('rejects wrong source relationships and immutable references', async () => {
    await expect(
      buildFakeSourceAuthority({
        mutate: (records) => {
          const repository = records.find(
            (record) => record.operation === 'github-repository-metadata',
          )!;
          (repository.normalizedValue as Record<string, unknown>)[
            'canonicalRepository'
          ] = 'invented-repository';
        },
      }),
    ).rejects.toThrow();
    await expect(
      buildFakeSourceAuthority({
        mutate: (records) => {
          const npmIndex = records.findIndex(
            (record) => record.operation === 'npm-package',
          );
          records[npmIndex] = {
            ...records[npmIndex]!,
            immutableReference: 'wrong-package@9.9.9',
          };
        },
      }),
    ).rejects.toThrow();
    await expect(
      buildFakeSourceAuthority({
        mutate: (records) => {
          const headIndex = records.findIndex(
            (record) => record.operation === 'github-default-branch-head',
          );
          records[headIndex] = {
            ...records[headIndex]!,
            sourceType: 'github-release',
          };
        },
      }),
    ).rejects.toThrow();
  });

  it('retains a moved catalog record only through exact provider canonical identity', async () => {
    const fixture = await buildFakeSourceAuthority({
      mutate: (records) => {
        const repository = records.find(
          (record) =>
            record.candidateId === 'auth-casbin-casbin' &&
            record.operation === 'github-repository-metadata',
        )!;
        const value = repository.normalizedValue as Record<string, unknown>;
        value['canonicalOwner'] = 'apache';
        value['canonicalRepository'] = 'casbin';
      },
    });
    const movedRecord = fixture.authority.sourceRecords.find(
      (record) =>
        record.candidateId === 'auth-casbin-casbin' &&
        record.operation === 'github-repository-metadata',
    )!;
    expect(movedRecord.normalizedValue).toMatchObject({
      canonicalOwner: 'apache',
      canonicalRepository: 'casbin',
    });
  });

  it('retains mutable drift and rejects divergent immutable identities', async () => {
    const first = await buildFakeSourceAuthority();
    const mutable = await buildFakeSourceAuthority({
      mutate: (records) => {
        const repository = records.find(
          (record) => record.operation === 'github-repository-metadata',
        )!;
        (repository.normalizedValue as Record<string, unknown>)['topics'] = [
          'changed',
        ];
      },
    });
    const reconciledMutable = reconcileProfileMaterializationSourceAuthority(
      first.authority,
      mutable.authority.sourceRecords,
      first,
    );
    expect(
      compareProfileMaterializationSources(
        first.authority,
        reconciledMutable,
      ).counts.reduce((total, entry) => total + entry.changed, 0),
    ).toBe(1);

    const headDrift = await buildFakeSourceAuthority({
      mutate: (records) => {
        const head = records.find(
          (record) => record.operation === 'github-default-branch-head',
        )!;
        (head.normalizedValue as Record<string, unknown>)['committedAt'] =
          '2026-08-02T00:00:00.000Z';
      },
    });
    const reconciledHead = reconcileProfileMaterializationSourceAuthority(
      first.authority,
      headDrift.authority.sourceRecords,
      first,
    );
    expect(
      compareProfileMaterializationSources(
        first.authority,
        reconciledHead,
      ).counts.reduce((total, entry) => total + entry.changed, 0),
    ).toBe(1);
  });

  it('reuses unchanged records byte-for-byte across a later collection clock', async () => {
    const first = await buildFakeSourceAuthority({
      collectedAt: '2026-08-05T00:00:00.000Z',
    });
    const later = await buildFakeSourceAuthority({
      collectedAt: '2026-08-05T01:00:00.000Z',
    });
    const reconciled = reconcileProfileMaterializationSourceAuthority(
      first.authority,
      later.authority.sourceRecords,
      first,
    );
    expect(reconciled.authoritySemanticDigest).toBe(
      first.authority.authoritySemanticDigest,
    );
    expect(canonicalizeJson(reconciled).text).toBe(
      canonicalizeJson(first.authority).text,
    );
    expect(canonicalizeJson(reconciled.sourceRecords[0]).text).toBe(
      canonicalizeJson(first.authority.sourceRecords[0]).text,
    );
  });

  it.each(['github-repository-metadata', 'npm-package'] as const)(
    'retains newly established %s evidence when equal provider content recovers',
    async (operation) => {
      const candidateId = 'auth-casbin-casbin-js';
      const first = await buildFakeSourceAuthority({
        mutate: (records) => {
          const index = records.findIndex(
            (record) =>
              record.candidateId === candidateId &&
              record.operation === operation,
          );
          records[index] = { ...records[index]!, evidenceIds: [] };
        },
      });
      const recovered = await buildFakeSourceAuthority({
        collectedAt: '2026-08-05T01:00:00.000Z',
      });
      const current = candidateOperationRecord(
        recovered.authority.sourceRecords,
        candidateId,
        operation,
      );
      const reconciled = reconcileProfileMaterializationSourceAuthority(
        first.authority,
        recovered.authority.sourceRecords,
        first,
      );
      const retained = candidateOperationRecord(
        reconciled.sourceRecords,
        candidateId,
        operation,
      );
      expect(retained.evidenceIds).toEqual(current.evidenceIds);
      expect(retained.evidenceIds.length).toBeGreaterThan(0);
      expect(retained.collectedAt).toBe(current.collectedAt);
      expect(retained.sourceRecordDigest).toBe(current.sourceRecordDigest);
    },
  );

  it('rejects different nonempty evidence identities for equal provider content', async () => {
    const candidateId = 'auth-casbin-casbin-js';
    const first = await buildFakeSourceAuthority();
    const changedEvidence = await buildFakeSourceAuthority({
      collectedAt: '2026-08-05T01:00:00.000Z',
      mutate: (records) => {
        const index = records.findIndex(
          (record) =>
            record.candidateId === candidateId &&
            record.operation === 'github-repository-metadata',
        );
        records[index] = {
          ...records[index]!,
          evidenceIds: ['ev-different-evidence'],
        };
      },
    });
    expect(() =>
      reconcileProfileMaterializationSourceAuthority(
        first.authority,
        changedEvidence.authority.sourceRecords,
        first,
      ),
    ).toThrow();
  });

  it('rejects missing current evidence for a complete candidate', async () => {
    const candidateId = 'auth-casbin-casbin-js';
    const first = await buildFakeSourceAuthority();
    const missingEvidence = await buildFakeSourceAuthority({
      collectedAt: '2026-08-05T01:00:00.000Z',
      mutate: (records) => {
        const index = records.findIndex(
          (record) =>
            record.candidateId === candidateId &&
            record.operation === 'github-repository-metadata',
        );
        records[index] = { ...records[index]!, evidenceIds: [] };
      },
    });
    expect(() =>
      reconcileProfileMaterializationSourceAuthority(
        first.authority,
        missingEvidence.authority.sourceRecords,
        first,
      ),
    ).toThrow();
  });

  it('binds immutable license and file identities to the exact head commit', async () => {
    const { authority } = await buildFakeSourceAuthority();
    for (const record of authority.sourceRecords.filter((entry) =>
      ['github-license', 'github-allowlisted-file'].includes(entry.operation),
    )) {
      expect(record.logicalSourceKey).toContain('commit:');
      if (record.operation === 'github-allowlisted-file') {
        expect(record.logicalSourceKey).toContain(':path:');
      }
    }
  });

  it('treats default-branch advancement as mutable drift plus exact-snapshot withdrawal and addition', async () => {
    const candidateId = 'auth-casbin-casbin-js';
    const first = await buildFakeSourceAuthority();
    const nextSha = 'f'.repeat(40);
    const advanced = await buildFakeSourceAuthority({
      mutate: (records) => {
        for (let index = 0; index < records.length; index += 1) {
          const record = records[index]!;
          if (record.candidateId !== candidateId) continue;
          if (record.operation === 'github-default-branch-head') {
            records[index] = {
              ...record,
              immutableReference: nextSha,
              normalizedValue: {
                sha: nextSha,
                committedAt: '2026-08-03T00:00:00.000Z',
              },
            };
          } else if (record.operation === 'github-license') {
            records[index] = {
              ...record,
              logicalSourceKey: `commit:${nextSha}`,
              immutableReference: nextSha,
              normalizedValue: {
                ...(record.normalizedValue as Record<string, unknown>),
                sha: nextSha,
              },
            };
          } else if (record.operation === 'github-allowlisted-file') {
            const file = record.normalizedValue as Record<string, unknown>;
            const filePath = String(file['path']);
            records[index] = {
              ...record,
              logicalSourceKey: `commit:${nextSha}:path:${filePath}`,
              immutableReference: `${nextSha}:${filePath}`,
              normalizedValue: { ...file, sha: nextSha },
            };
          }
        }
      },
    });
    const reconciled = reconcileProfileMaterializationSourceAuthority(
      first.authority,
      advanced.authority.sourceRecords,
      first,
    );
    const drift = compareProfileMaterializationSources(
      first.authority,
      reconciled,
    );
    expect(
      drift.counts.find((entry) => entry.sourceType === 'github-head-commit'),
    ).toMatchObject({ changed: 1 });
    expect(
      drift.counts
        .filter((entry) =>
          ['github-license', 'github-file'].includes(entry.sourceType),
        )
        .reduce((total, entry) => total + entry.new, 0),
    ).toBeGreaterThan(0);
    expect(
      drift.counts
        .filter((entry) =>
          ['github-license', 'github-file'].includes(entry.sourceType),
        )
        .reduce((total, entry) => total + entry.withdrawn, 0),
    ).toBeGreaterThan(0);
  });

  it('fails closed when the same exact-commit immutable identity changes content', async () => {
    const first = await buildFakeSourceAuthority();
    const mutated = await buildFakeSourceAuthority({
      mutate: (records) => {
        const index = records.findIndex(
          (record) => record.operation === 'github-license',
        );
        const license = records[index]!;
        records[index] = {
          ...license,
          normalizedValue: {
            ...(license.normalizedValue as Record<string, unknown>),
            spdxId: 'Apache-2.0',
          },
        };
      },
    });
    expect(() =>
      reconcileProfileMaterializationSourceAuthority(
        first.authority,
        mutated.authority.sourceRecords,
        first,
      ),
    ).toThrow();
  });

  it.each(['github-license', 'github-allowlisted-file'] as const)(
    'reconciles established %s value to controlled unavailability',
    async (operation) => {
      const established = await buildFakeSourceAuthority();
      const unavailable = await authorityWithOutcome(operation, 'unavailable');
      const reconciled = reconcileProfileMaterializationSourceAuthority(
        established.authority,
        unavailable.authority.sourceRecords,
        established,
      );
      expect(
        firstOperationRecord(reconciled.sourceRecords, operation),
      ).toMatchObject({
        outcome: 'unavailable',
        controlledCode: 'provider-temporarily-unavailable',
        normalizedValue: null,
      });
      expect(
        compareProfileMaterializationSources(
          established.authority,
          reconciled,
        ).counts.reduce((total, entry) => total + entry.changed, 0),
      ).toBe(1);
    },
  );

  it('retains an earlier controlled failure when the later collection succeeds', async () => {
    const unavailable = await authorityWithOutcome(
      'github-license',
      'unavailable',
    );
    const successful = await buildFakeSourceAuthority({
      collectedAt: '2026-08-05T01:00:00.000Z',
    });
    const reconciled = reconcileProfileMaterializationSourceAuthority(
      unavailable.authority,
      successful.authority.sourceRecords,
      unavailable,
    );
    expect(
      firstOperationRecord(reconciled.sourceRecords, 'github-license').outcome,
    ).toBe('established-value');
    expect(
      controlledFailureCounts([unavailable.authority, reconciled]),
    ).toEqual([{ code: 'provider-temporarily-unavailable', count: 1 }]);
  });

  it.each(['github-license', 'github-allowlisted-file'] as const)(
    'reconciles controlled %s unavailability to an established value',
    async (operation) => {
      const unavailable = await authorityWithOutcome(operation, 'unavailable');
      const established = await buildFakeSourceAuthority();
      const reconciled = reconcileProfileMaterializationSourceAuthority(
        unavailable.authority,
        established.authority.sourceRecords,
        unavailable,
      );
      expect(
        firstOperationRecord(reconciled.sourceRecords, operation).outcome,
      ).toBe('established-value');
    },
  );

  it.each(['github-license', 'github-allowlisted-file'] as const)(
    'reconciles established %s absence to and from controlled unavailability',
    async (operation) => {
      const absent = await authorityWithOutcome(
        operation,
        'established-absence',
      );
      const unavailable = await authorityWithOutcome(operation, 'unavailable');
      const toUnavailable = reconcileProfileMaterializationSourceAuthority(
        absent.authority,
        unavailable.authority.sourceRecords,
        absent,
      );
      expect(
        firstOperationRecord(toUnavailable.sourceRecords, operation).outcome,
      ).toBe('unavailable');
      const toAbsence = reconcileProfileMaterializationSourceAuthority(
        unavailable.authority,
        absent.authority.sourceRecords,
        unavailable,
      );
      expect(
        firstOperationRecord(toAbsence.sourceRecords, operation).outcome,
      ).toBe('established-absence');
    },
  );

  it('reuses identical immutable unavailability but retains a changed controlled code', async () => {
    const first = await authorityWithOutcome(
      'github-license',
      'unavailable',
      '2026-08-05T00:00:00.000Z',
    );
    const later = await authorityWithOutcome(
      'github-license',
      'unavailable',
      '2026-08-05T01:00:00.000Z',
    );
    const reused = reconcileProfileMaterializationSourceAuthority(
      first.authority,
      later.authority.sourceRecords,
      first,
    );
    expect(canonicalizeJson(reused).text).toBe(
      canonicalizeJson(first.authority).text,
    );

    const changed = await buildFakeSourceAuthority({
      collectedAt: '2026-08-05T02:00:00.000Z',
      mutate: (records) => {
        setOperationOutcome(
          records,
          'github-license',
          'unavailable',
          'provider-rate-limited',
        );
      },
    });
    const reconciled = reconcileProfileMaterializationSourceAuthority(
      first.authority,
      changed.authority.sourceRecords,
      first,
    );
    expect(
      firstOperationRecord(reconciled.sourceRecords, 'github-license')
        .controlledCode,
    ).toBe('provider-rate-limited');
  });

  it('rejects every contradiction between established immutable facts', async () => {
    const established = await buildFakeSourceAuthority();
    const absent = await authorityWithOutcome(
      'github-license',
      'established-absence',
    );
    expect(() =>
      reconcileProfileMaterializationSourceAuthority(
        established.authority,
        absent.authority.sourceRecords,
        established,
      ),
    ).toThrow();
    expect(() =>
      reconcileProfileMaterializationSourceAuthority(
        absent.authority,
        established.authority.sourceRecords,
        absent,
      ),
    ).toThrow();
  });

  it('reproduces the authority digest in a fresh process', async () => {
    const fixture = await buildFakeSourceAuthority();
    const script = [
      "import { buildFakeSourceAuthority } from './packages/ingestion/test/profile-materialization-fixtures.ts';",
      'const fixture = await buildFakeSourceAuthority();',
      'process.stdout.write(fixture.authority.authoritySemanticDigest);',
    ].join('\n');
    const result = await executeFile(
      process.execPath,
      ['--experimental-strip-types', '--input-type=module', '-e', script],
      { cwd: new URL('../../../', import.meta.url) },
    );
    expect(result.stdout).toBe(fixture.authority.authoritySemanticDigest);
  }, 20_000);

  it('does not bind an operator run ID into semantic identity', async () => {
    const { authority } = await buildFakeSourceAuthority();
    expect(canonicalizeJson(authority).text).not.toContain('m7-');
    expect(canonicalizeJson(authority).text).not.toContain('runId');
  });
});

async function authorityWithOutcome(
  operation: Extract<
    ProfileMaterializationOperation,
    'github-allowlisted-file' | 'github-license'
  >,
  outcome: 'established-absence' | 'unavailable',
  collectedAt = '2026-08-05T00:00:00.000Z',
) {
  return buildFakeSourceAuthority({
    collectedAt,
    mutate: (records) => {
      setOperationOutcome(
        records,
        operation,
        outcome,
        outcome === 'unavailable'
          ? 'provider-temporarily-unavailable'
          : 'provider-not-found',
      );
    },
  });
}

function setOperationOutcome(
  records: ProfileMaterializationSourceRecordInput[],
  operation: ProfileMaterializationOperation,
  outcome: 'established-absence' | 'unavailable',
  controlledCode: string,
): void {
  const index = records.findIndex((record) => record.operation === operation);
  records[index] = {
    ...records[index]!,
    outcome,
    normalizedValue: null,
    controlledCode,
    evidenceIds: [],
  };
}

function firstOperationRecord(
  records: readonly ProfileMaterializationSourceRecordInput[],
  operation: ProfileMaterializationOperation,
) {
  const record = records.find((entry) => entry.operation === operation);
  if (record === undefined) throw new Error('Missing operation fixture.');
  return record;
}

function candidateOperationRecord(
  records: readonly {
    readonly candidateId: string;
    readonly operation: ProfileMaterializationOperation;
    readonly evidenceIds: readonly string[];
    readonly collectedAt: string;
    readonly sourceRecordDigest: string;
  }[],
  candidateId: string,
  operation: ProfileMaterializationOperation,
) {
  const record = records.find(
    (entry) =>
      entry.candidateId === candidateId && entry.operation === operation,
  );
  if (record === undefined) throw new Error('Missing candidate operation.');
  return record;
}
