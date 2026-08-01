import { readFile } from 'node:fs/promises';

import { modelExecutionModelProfileDigest } from '@gitblocks/contracts';
import {
  parseCompleteArtifactReceiptV1,
  type ArtifactReceipt,
} from '@gitblocks/ingestion';
import { serializeCanonicalJson } from '@gitblocks/interviews';
import { describe, expect, it } from 'vitest';

import { createRepositoryInterviewCandidatePlanV1 } from '@gitblocks/repository-interview-operator';
import {
  buildRepositoryInterviewPreliveExpectedV1,
  materializeRepositoryInterviewOperatorSelectionV1,
  parseRepositoryInterviewOfflineVerificationReportV1,
  parseRepositoryInterviewPreliveReadinessPolicyV1,
  validateCommittedRepositoryInterviewCandidatePlanV1,
  validateRepositoryInterviewPreliveFilesV1,
  validateRepositoryInterviewSelectionMaterializationClosureV1,
} from '../src/index.ts';
import {
  syntheticArtifactAuthorityV1,
  syntheticArtifactSetV1,
} from './prelive-fixtures.ts';

describe('repository interview pre-live verification', () => {
  it('reproduces the committed plans, profiles, readiness, report, and manifest exactly', async () => {
    const expected = await validateRepositoryInterviewPreliveFilesV1(
      process.cwd(),
    );
    expect(expected.plans.calibration.candidateIds).toEqual([
      'audit-datadog-trace-js',
      'auth-warrant',
      'jobs-dagster',
      'jobs-node-cron',
      'rate-redis-cell',
      'webhook-hookdeck',
    ]);
    expect(expected.plans.gateA.candidateIds).toHaveLength(30);
    expect(expected.plans.gateB.candidateIds).toEqual(
      expected.catalogCandidateIds,
    );
    expect(expected.readiness.liveReady).toBe(false);
    expect(expected.report.status).toBe('offline-verified-live-blocked');
    expect(
      expected.profiles.map(modelExecutionModelProfileDigest).sort(),
    ).toEqual(expected.report.modelProfileDigests);
    expect(
      JSON.stringify(expected.profiles) + JSON.stringify(expected.manifest),
    ).not.toContain('selected');
  });

  it('rejects a self-consistent alternate plan that is not committed authority', async () => {
    const expected = await buildRepositoryInterviewPreliveExpectedV1(
      process.cwd(),
    );
    const alternate = createRepositoryInterviewCandidatePlanV1({
      schemaVersion: '1.0.0',
      planId: expected.plans.calibration.planId,
      catalogVersion: expected.plans.calibration.catalogVersion,
      catalogDigest: expected.plans.calibration.catalogDigest,
      artifactManifestVersion:
        expected.plans.calibration.artifactManifestVersion,
      artifactManifestDigest: expected.plans.calibration.artifactManifestDigest,
      candidateIds: [
        'audit-bunyan',
        ...expected.plans.calibration.candidateIds.slice(1),
      ],
    });
    expect(() =>
      validateCommittedRepositoryInterviewCandidatePlanV1(
        alternate,
        expected.plans,
      ),
    ).toThrow('verification failed');
  });

  it('owns and freezes readiness and report input and rejects digest or open-object drift', async () => {
    const expected = await buildRepositoryInterviewPreliveExpectedV1(
      process.cwd(),
    );
    const readiness = JSON.parse(JSON.stringify(expected.readiness)) as {
      gates: { status: string }[];
    };
    const parsedReadiness =
      parseRepositoryInterviewPreliveReadinessPolicyV1(readiness);
    readiness.gates[0]!.status = 'unsatisfied';
    expect(parsedReadiness.gates[0]?.status).toBe('satisfied');
    expect(Object.isFrozen(parsedReadiness.gates)).toBe(true);
    expect(() =>
      parseRepositoryInterviewPreliveReadinessPolicyV1({
        ...expected.readiness,
        extra: true,
      }),
    ).toThrow('authority is invalid');
    expect(() =>
      parseRepositoryInterviewOfflineVerificationReportV1({
        ...expected.report,
        reportDigest: 'a'.repeat(64),
      }),
    ).toThrow('authority is invalid');
  });

  it('parses only a complete, successful, exact full-catalog raw receipt', async () => {
    const fixture = await syntheticArtifactAuthorityV1();
    const authority = {
      catalogVersion: 'public-v1',
      catalogDigest: fixture.catalog.manifestDigest,
      artifactManifestVersion: 'public-artifacts-v1',
      artifactManifestDigest: fixture.artifactManifest.manifestDigest,
      candidateIds: fixture.candidateIds,
    } as const;
    const mutable = JSON.parse(JSON.stringify(fixture.receipt)) as {
      candidates: { safeErrorCode: string | null }[];
    };
    const parsed = parseCompleteArtifactReceiptV1(mutable, authority);
    mutable.candidates[0]!.safeErrorCode = 'mutated';
    expect(parsed.candidates).toHaveLength(150);
    expect(parsed.candidates[0]?.safeErrorCode).toBeNull();
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.candidates)).toBe(true);
    expect(() =>
      parseCompleteArtifactReceiptV1(
        {
          ...fixture.receipt,
          candidates: fixture.receipt.candidates.slice(0, 149),
        },
        authority,
      ),
    ).toThrow('invalid');
    let getterCalled = false;
    const accessor = JSON.parse(JSON.stringify(fixture.receipt)) as Record<
      string,
      unknown
    >;
    delete accessor['receiptVersion'];
    Object.defineProperty(accessor, 'receiptVersion', {
      enumerable: true,
      get() {
        getterCalled = true;
        return 'public-artifact-receipt/1.0.0';
      },
    });
    expect(() => parseCompleteArtifactReceiptV1(accessor, authority)).toThrow(
      'invalid',
    );
    expect(getterCalled).toBe(false);
  });

  it.each([
    ['calibration', 6],
    ['gateA', 30],
    ['gateB', 150],
  ] as const)(
    'materializes the synthetic %s plan only through receipt-named exact set loads',
    async (planName, count) => {
      const fixture = await syntheticArtifactAuthorityV1();
      const expected = await buildRepositoryInterviewPreliveExpectedV1(
        process.cwd(),
      );
      const lookups: string[] = [];
      const result = await materializeRepositoryInterviewOperatorSelectionV1(
        {
          candidatePlan: expected.plans[planName],
          artifactReceipt: fixture.receipt,
          fullCatalogCandidateIds: fixture.candidateIds,
          selectionId: `synthetic-${planName.toLowerCase()}-selection`,
        },
        {
          loadRepositoryArtifactSet(artifactSetId) {
            lookups.push(artifactSetId);
            const set = fixture.sets.get(artifactSetId);
            if (set === undefined) throw new Error('missing synthetic set');
            return Promise.resolve(set);
          },
        },
      );
      expect(result.selection.members).toHaveLength(count);
      expect(lookups).toEqual(
        result.selection.members.map(({ artifactSetId }) => artifactSetId),
      );
      expect(
        result.selection.members.map(
          ({ artifactSetIdentityDigest }) =>
            fixture.sets.get(
              result.selection.members.find(
                (member) =>
                  member.artifactSetIdentityDigest ===
                  artifactSetIdentityDigest,
              )?.artifactSetId ?? '',
            )?.identityDigest,
        ),
      ).toEqual(
        result.selection.members.map(
          ({ artifactSetIdentityDigest }) => artifactSetIdentityDigest,
        ),
      );
      expect(
        validateRepositoryInterviewSelectionMaterializationClosureV1({
          candidatePlan: expected.plans[planName],
          artifactReceipt: fixture.receipt,
          fullCatalogCandidateIds: fixture.candidateIds,
          selection: result.selection,
          materialization: result.materialization,
        }).materialization.materializationDigest,
      ).toBe(result.materialization.materializationDigest);
      const repeated = await materializeRepositoryInterviewOperatorSelectionV1(
        {
          candidatePlan: expected.plans[planName],
          artifactReceipt: fixture.receipt,
          fullCatalogCandidateIds: fixture.candidateIds,
          selectionId: `synthetic-${planName.toLowerCase()}-selection`,
        },
        {
          loadRepositoryArtifactSet(artifactSetId) {
            return Promise.resolve(fixture.sets.get(artifactSetId)!);
          },
        },
      );
      expect(serializeCanonicalJson(repeated)).toBe(
        serializeCanonicalJson(result),
      );
    },
  );

  it('rejects a different same-candidate set and never derives from declarations or latest state', async () => {
    const fixture = await syntheticArtifactAuthorityV1();
    const expected = await buildRepositoryInterviewPreliveExpectedV1(
      process.cwd(),
    );
    const firstCandidate = expected.plans.calibration.candidateIds[0]!;
    const alternative = syntheticArtifactSetV1(firstCandidate, 999);
    let calls = 0;
    await expect(
      materializeRepositoryInterviewOperatorSelectionV1(
        {
          candidatePlan: expected.plans.calibration,
          artifactReceipt: fixture.receipt,
          fullCatalogCandidateIds: fixture.candidateIds,
          selectionId: 'synthetic-rejected-selection',
        },
        {
          loadRepositoryArtifactSet(artifactSetId) {
            calls += 1;
            const receiptSet = fixture.sets.get(artifactSetId)!;
            return Promise.resolve(
              receiptSet.candidateId === firstCandidate
                ? alternative
                : receiptSet,
            );
          },
        },
      ),
    ).rejects.toThrow('materialization is invalid');
    expect(calls).toBe(1);
  });

  it('commits no materialized selection, raw receipt, binding, or authorization', async () => {
    const manifestText = await readFile(
      'verification/repository-interviews-v1/manifest.json',
      'utf8',
    );
    const manifest = JSON.parse(manifestText) as Record<string, unknown>;
    expect(manifest).not.toHaveProperty('operatorSelectionMembers');
    expect(manifest).not.toHaveProperty('artifactReceipt');
    expect(manifest).not.toHaveProperty('selectionMaterialization');
    expect(manifest).not.toHaveProperty('authorization');
    expect(manifest).toHaveProperty('candidatePlanMembers');
  });
});

export function cloneReceipt(receipt: ArtifactReceipt): ArtifactReceipt {
  return JSON.parse(JSON.stringify(receipt)) as ArtifactReceipt;
}
