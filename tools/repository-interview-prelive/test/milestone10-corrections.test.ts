import {
  createArtifactReceipt,
  parseArtifactReceipt,
  parseCompleteArtifactReceiptV1,
} from '@gitblocks/ingestion';
import { serializeCanonicalJson } from '@gitblocks/interviews';
import { describe, expect, it } from 'vitest';

import {
  PRELIVE_GATE_CODES,
  buildRepositoryInterviewPreliveExpectedV1,
  createRepositoryInterviewPreliveReadinessPolicyV1,
  parseRepositoryInterviewPreliveReadinessPolicyV1,
  repositoryInterviewPreliveReadinessPolicyDigestV1,
  validateCommittedRepositoryInterviewModelProfileV1,
} from '../src/index.ts';
import { syntheticArtifactAuthorityV1 } from './prelive-fixtures.ts';

const CALIBRATION_PREREQUISITES = [
  'offline-verification',
  'fresh-artifact-materialization',
  'retention-authority',
  'pricing-authority',
  'maintainer-live-authorization',
  'ephemeral-database',
  'provider-credential',
  'audit-assignment-readiness',
] as const;

describe('Milestone 10 correction authorities', () => {
  it('requires migration 0004 only at the complete pre-live receipt boundary', async () => {
    const fixture = await syntheticArtifactAuthorityV1();
    const migration3 = createArtifactReceipt({
      catalog: fixture.catalog,
      manifest: fixture.artifactManifest,
      runId: 'synthetic-historical-artifact-run',
      startedAt: '2026-07-30T18:00:00.000Z',
      completedAt: '2026-07-30T18:01:00.000Z',
      candidates: fixture.receipt.candidates,
      providerMetrics: {
        providerRequestCounts: { github: 0, npm: 0 },
        githubRateLimit: null,
      },
      databaseMigrationVersion: 3,
      operationalDecodedBytes: 0,
    });
    const authority = {
      catalogVersion: 'public-v1',
      catalogDigest: fixture.catalog.manifestDigest,
      artifactManifestVersion: 'public-artifacts-v1',
      artifactManifestDigest: fixture.artifactManifest.manifestDigest,
      candidateIds: fixture.candidateIds,
      databaseMigrationVersion: 4,
    } as const;

    expect(parseArtifactReceipt(serializeCanonicalJson(migration3))).toEqual(
      migration3,
    );
    expect(migration3.databaseMigrationVersion).toBe(3);
    expect(() => parseCompleteArtifactReceiptV1(migration3, authority)).toThrow(
      'invalid',
    );
    expect(() =>
      parseCompleteArtifactReceiptV1(
        { ...fixture.receipt, databaseMigrationVersion: 3 },
        authority,
      ),
    ).toThrow('invalid');
    expect(
      parseCompleteArtifactReceiptV1(fixture.receipt, authority)
        .databaseMigrationVersion,
    ).toBe(4);
  });

  it('derives calibration eligibility without treating its result as a prerequisite', () => {
    const readyBeforeCalibration =
      createRepositoryInterviewPreliveReadinessPolicyV1(
        readinessStatuses({ 'model-calibration': 'unsatisfied' }),
      );
    expect(readyBeforeCalibration).toMatchObject({
      calibrationStatus: 'ready',
      gateAStatus: 'blocked',
      gateBStatus: 'blocked',
      liveReady: true,
    });

    const readyAfterCalibration =
      createRepositoryInterviewPreliveReadinessPolicyV1(
        readinessStatuses({ 'model-calibration': 'satisfied' }),
      );
    expect(readyAfterCalibration).toMatchObject({
      calibrationStatus: 'ready',
      gateAStatus: 'blocked',
      gateBStatus: 'blocked',
      liveReady: true,
    });
  });

  it.each(CALIBRATION_PREREQUISITES)(
    'keeps calibration blocked while prerequisite %s is unsatisfied',
    (missing) => {
      const policy = createRepositoryInterviewPreliveReadinessPolicyV1(
        readinessStatuses({ [missing]: 'unsatisfied' }),
      );
      expect(policy.calibrationStatus).toBe('blocked');
      expect(policy.gateAStatus).toBe('blocked');
      expect(policy.gateBStatus).toBe('blocked');
      expect(policy.liveReady).toBe(false);
    },
  );

  it('does not treat not-applicable as satisfied for a calibration prerequisite', () => {
    const policy = createRepositoryInterviewPreliveReadinessPolicyV1(
      readinessStatuses({ 'retention-authority': 'not-applicable' }),
    );
    expect(policy.calibrationStatus).toBe('blocked');
    expect(policy.liveReady).toBe(false);
  });

  it.each([
    [
      'calibration ready with a missing prerequisite',
      readinessStatuses({ 'retention-authority': 'unsatisfied' }),
      { calibrationStatus: 'ready', liveReady: true },
    ],
    ['Gate A ready in v1', readinessStatuses(), { gateAStatus: 'ready' }],
    [
      'Gate B ready in v1',
      readinessStatuses({ 'model-calibration': 'satisfied' }),
      { gateBStatus: 'ready' },
    ],
    [
      'live ready while calibration is blocked',
      readinessStatuses({ 'pricing-authority': 'unsatisfied' }),
      { calibrationStatus: 'blocked', liveReady: true },
    ],
    [
      'live blocked while calibration is ready',
      readinessStatuses(),
      { calibrationStatus: 'ready', liveReady: false },
    ],
  ] as const)(
    'rejects rehashed forged readiness: %s',
    (_name, statuses, drift) => {
      expect(() =>
        parseRepositoryInterviewPreliveReadinessPolicyV1(
          readinessAuthority(statuses, drift),
        ),
      ).toThrow('authority is invalid');
    },
  );

  it('preserves the exact committed live-blocked readiness bytes', async () => {
    const expected = await buildRepositoryInterviewPreliveExpectedV1(
      process.cwd(),
    );
    expect(expected.readiness).toMatchObject({
      calibrationStatus: 'blocked',
      gateAStatus: 'blocked',
      gateBStatus: 'blocked',
      liveReady: false,
    });
    expect(expected.readiness.gates).toEqual(
      PRELIVE_GATE_CODES.map((gate) => ({
        gate,
        status: gate === 'offline-verification' ? 'satisfied' : 'unsatisfied',
      })),
    );
    expect(expected.readiness.policyDigest).toBe(
      '19e3bfbd3bca28cd0b69154d801fb7744631a2cba327b62f5e0c7ce2cb2d49ab',
    );
  });

  it('authenticates only the exact two committed complete model profiles', async () => {
    const expected = await buildRepositoryInterviewPreliveExpectedV1(
      process.cwd(),
    );
    for (const profile of expected.profiles) {
      const callerProfile = JSON.parse(JSON.stringify(profile)) as Record<
        string,
        unknown
      >;
      const accepted = validateCommittedRepositoryInterviewModelProfileV1(
        callerProfile,
        expected.profiles,
      );
      callerProfile['reasoningEffort'] = 'medium';
      expect(accepted).toEqual(profile);
      expect(accepted).not.toBe(callerProfile);
      expect(accepted.reasoningEffort).toBe('low');
      expect(Object.isFrozen(accepted)).toBe(true);
    }

    const profile = expected.profiles[0];
    const mutations: readonly unknown[] = [
      { ...profile, reasoningEffort: 'medium' },
      { ...profile, maximumOutputTokens: profile.maximumOutputTokens - 1 },
      { ...profile, maximumResponseBytes: profile.maximumResponseBytes - 1 },
      { ...profile, providerProjectionVersion: '1.0.1' },
      { ...profile, providerProjectionDigest: 'a'.repeat(64) },
      { ...profile, store: true },
      { ...profile, toolsEnabled: true },
      { ...profile, background: true },
      { ...profile, conversationState: true },
      { ...profile, previousResponseState: true },
      { ...profile, truncation: 'auto' },
      { ...profile, promptCacheRetention: '24h' },
      { ...profile, serviceTier: 'priority' },
      { ...profile, retryPolicyVersion: 'alternate-retry-v1' },
      { ...profile, modelSnapshot: 'gpt-5.4-2026-03-06' },
      { ...profile, extra: true },
      Object.fromEntries(
        Object.entries(profile).filter(([key]) => key !== 'serviceTier'),
      ),
    ];
    for (const mutation of mutations) {
      expect(() =>
        validateCommittedRepositoryInterviewModelProfileV1(
          mutation,
          expected.profiles,
        ),
      ).toThrow('verification failed');
    }
  });
});

type GateStatus = 'satisfied' | 'unsatisfied' | 'not-applicable';

function readinessStatuses(
  overrides: Partial<
    Record<(typeof PRELIVE_GATE_CODES)[number], GateStatus>
  > = {},
): Record<(typeof PRELIVE_GATE_CODES)[number], GateStatus> {
  return Object.fromEntries(
    PRELIVE_GATE_CODES.map((gate) => [gate, overrides[gate] ?? 'satisfied']),
  ) as Record<(typeof PRELIVE_GATE_CODES)[number], GateStatus>;
}

function readinessAuthority(
  statuses: Record<(typeof PRELIVE_GATE_CODES)[number], GateStatus>,
  drift: Readonly<Record<string, unknown>>,
): unknown {
  const base = {
    schemaVersion: '1.0.0' as const,
    policyId: 'repository-interviews-prelive-readiness-v1' as const,
    gates: PRELIVE_GATE_CODES.map((gate) => ({ gate, status: statuses[gate] })),
    liveReady: true,
    calibrationStatus: 'ready' as const,
    gateAStatus: 'blocked' as const,
    gateBStatus: 'blocked' as const,
    ...drift,
  };
  return {
    ...base,
    policyDigest: repositoryInterviewPreliveReadinessPolicyDigestV1(base),
  };
}
