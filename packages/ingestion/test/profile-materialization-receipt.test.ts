import { describe, expect, it } from 'vitest';

import {
  PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS,
  buildProfileMaterializationArtifacts,
  buildProfileMaterializationReceipt,
  compareProfileMaterializationSources,
  controlledFailureCounts,
  persistenceProofCounts,
  reconcileProfileMaterializationSourceAuthority,
  renderProfileMaterializationCompletion,
  sourceOutcomeCounts,
  sourceRecordCounts,
  validateProfileMaterializationCompletion,
  validateProfileMaterializationReceipt,
} from '../src/index.ts';
import {
  buildFakePersistenceProof,
  buildFakeSourceAuthority,
} from './profile-materialization-fixtures.ts';

describe('profile-materialization replay receipt', () => {
  it('binds both collections, all four passes, drift, and fixed completion text', async () => {
    const first = await buildFakeSourceAuthority({
      collectedAt: '2026-08-05T00:00:00.000Z',
    });
    const secondCollected = await buildFakeSourceAuthority({
      collectedAt: '2026-08-05T01:00:00.000Z',
    });
    const second = {
      ...secondCollected,
      authority: reconcileProfileMaterializationSourceAuthority(
        first.authority,
        secondCollected.authority.sourceRecords,
        first,
      ),
    };
    const firstArtifacts = buildProfileMaterializationArtifacts(
      first.catalog,
      first.taxonomy,
      first.authority,
    );
    const secondArtifacts = buildProfileMaterializationArtifacts(
      second.catalog,
      second.taxonomy,
      second.authority,
    );
    const drift = compareProfileMaterializationSources(
      first.authority,
      second.authority,
    );
    expect(
      drift.counts.reduce((total, count) => total + count.unchanged, 0),
    ).toBe(833);
    const firstPersistenceProof = buildFakePersistenceProof(
      first.authority,
      'first',
    );
    const secondPersistenceProof = buildFakePersistenceProof(
      second.authority,
      'second',
    );
    const receipt = buildProfileMaterializationReceipt({
      receiptVersion: 'profile-materialization-receipt/1.0.0',
      operatorVersion: 'profile-materialization-operator/1.0.0',
      providerPolicyVersion: 'profile-materialization-provider-policy/1.0.0',
      providerPolicyDigest: first.policy.policySemanticDigest,
      sourceAuthorityVersion: 'profile-materialization-source-authority/1.0.0',
      persistenceProofVersion:
        'profile-materialization-persistence-proof/1.0.0',
      firstPersistenceProofSemanticDigest:
        firstPersistenceProof.proofSemanticDigest,
      secondPersistenceProofSemanticDigest:
        secondPersistenceProof.proofSemanticDigest,
      firstPersistenceCounts: persistenceProofCounts(firstPersistenceProof),
      secondPersistenceCounts: persistenceProofCounts(secondPersistenceProof),
      firstSourceAuthoritySemanticDigest:
        first.authority.authoritySemanticDigest,
      secondSourceAuthoritySemanticDigest:
        second.authority.authoritySemanticDigest,
      finalSourceAuthoritySemanticDigest:
        second.authority.authoritySemanticDigest,
      firstSourceRecordCounts: sourceRecordCounts(first.authority),
      secondSourceRecordCounts: sourceRecordCounts(second.authority),
      firstSourceOutcomeCounts: sourceOutcomeCounts(first.authority),
      secondSourceOutcomeCounts: sourceOutcomeCounts(second.authority),
      sourceDriftComparisonDigest: drift.comparisonDigest,
      sourceDriftCounts: drift.counts,
      firstPassA: pass(firstArtifacts),
      firstPassB: pass(firstArtifacts),
      secondPassA: pass(secondArtifacts),
      secondPassB: pass(secondArtifacts),
      sameEvidenceReproduction: 'passed',
      liveIdempotency: 'passed',
      qualification: 'complete',
      catalogVersion: 'public-v1',
      catalogDigest: first.catalog.manifestDigest,
      taxonomyVersion: '1.0.0',
      taxonomyDigest: first.taxonomy.semanticDigest,
      profileSchemaDigest:
        '3bbfdf2050c13a3d70e9dc289db7c8768a6fdcba8605cf12191e08560387af61',
      profileAuthoritySchemaDigest:
        '7a79a1671bf461127099e3ae2f75d29e949387987041bd3402f2614b747ed8cf',
      profileRulesVersion: 'deterministic-candidate-profile-rules/1.0.0',
      projectionVersion: 'profile-materialization-projection/1.0.0',
      migrationInventoryDigest:
        PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.migrationInventoryDigest,
      migrationCount: 4,
      databaseSchemaDigest:
        PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.databaseSchemaDigest,
      productTableCount: 25,
      candidateCount: 150,
      aggregateFieldStates: secondArtifacts.coverage.aggregate.final,
      fieldCoverage: secondArtifacts.coverage.perField.map((field) => ({
        fieldId: field.fieldId,
        ...field.final,
      })),
      familyCoverage: secondArtifacts.coverage.perFamily.map((family) => ({
        family: family.family,
        ...family.final,
      })),
      controlledFailureCounts: controlledFailureCounts([
        first.authority,
        second.authority,
      ]),
      runIdDigest: 'c'.repeat(64),
    });
    expect(validateProfileMaterializationReceipt(receipt)).toEqual(receipt);
    const markdown = renderProfileMaterializationCompletion(
      receipt,
      secondArtifacts.coverage.coverageSemanticDigest,
    );
    expect(() => {
      validateProfileMaterializationCompletion(
        markdown,
        receipt,
        secondArtifacts.coverage.coverageSemanticDigest,
      );
    }).not.toThrow();
  });

  it('keeps semantic identity independent of run isolation while authenticating the record', async () => {
    const fixture = await buildFakeSourceAuthority();
    const artifacts = buildProfileMaterializationArtifacts(
      fixture.catalog,
      fixture.taxonomy,
      fixture.authority,
    );
    const input = minimalReceiptInput(fixture, artifacts);
    const first = buildProfileMaterializationReceipt({
      ...input,
      runIdDigest: '1'.repeat(64),
    });
    const second = buildProfileMaterializationReceipt({
      ...input,
      runIdDigest: '2'.repeat(64),
    });
    expect(first.receiptSemanticDigest).toBe(second.receiptSemanticDigest);
    expect(first.receiptRecordDigest).not.toBe(second.receiptRecordDigest);
    expect(() =>
      validateProfileMaterializationReceipt({
        ...first,
        runIdDigest: '2'.repeat(64),
      }),
    ).toThrow();
    const proofChanged = buildProfileMaterializationReceipt({
      ...input,
      firstPersistenceProofSemanticDigest: 'a'.repeat(64),
      runIdDigest: '1'.repeat(64),
    });
    expect(proofChanged.receiptSemanticDigest).not.toBe(
      first.receiptSemanticDigest,
    );
    expect(proofChanged.receiptRecordDigest).not.toBe(
      first.receiptRecordDigest,
    );
  });

  it('rejects source, database, timestamp, and unauthenticated-field leakage', async () => {
    const fixture = await buildFakeSourceAuthority();
    const artifacts = buildProfileMaterializationArtifacts(
      fixture.catalog,
      fixture.taxonomy,
      fixture.authority,
    );
    const receipt = buildProfileMaterializationReceipt({
      ...minimalReceiptInput(fixture, artifacts),
      runIdDigest: '3'.repeat(64),
    });
    for (const [key, value] of [
      ['databaseUrl', 'postgresql://secret'],
      ['providerBody', 'README text'],
      ['timestamp', '2026-08-05T00:00:00Z'],
      ['candidateId', 'candidate-secret'],
    ] as const) {
      expect(() =>
        validateProfileMaterializationReceipt({ ...receipt, [key]: value }),
      ).toThrow();
    }
  });

  it('rejects mismatched replay passes, final-source selection, bindings, and favorable drift claims', async () => {
    const fixture = await buildFakeSourceAuthority();
    const artifacts = buildProfileMaterializationArtifacts(
      fixture.catalog,
      fixture.taxonomy,
      fixture.authority,
    );
    const input = minimalReceiptInput(fixture, artifacts);
    const wrongPass = {
      ...input,
      firstPassB: {
        ...input.firstPassB,
        profileAuthorityDigest: '9'.repeat(64),
      },
      runIdDigest: '4'.repeat(64),
    };
    expect(() => buildProfileMaterializationReceipt(wrongPass)).toThrow();
    expect(() =>
      buildProfileMaterializationReceipt({
        ...input,
        finalSourceAuthoritySemanticDigest: '8'.repeat(64),
        runIdDigest: '4'.repeat(64),
      }),
    ).toThrow();
    expect(() =>
      buildProfileMaterializationReceipt({
        ...input,
        catalogDigest: '7'.repeat(64),
        runIdDigest: '4'.repeat(64),
      }),
    ).toThrow();

    const driftedCounts = input.sourceDriftCounts.map((entry, index) =>
      index === 0
        ? { ...entry, unchanged: entry.unchanged - 1, changed: 1 }
        : entry,
    );
    expect(() =>
      buildProfileMaterializationReceipt({
        ...input,
        sourceDriftCounts: driftedCounts,
        liveIdempotency: 'passed',
        runIdDigest: '4'.repeat(64),
      }),
    ).toThrow();
  });

  it('rejects fatal outcomes and qualifications that hide optional failures', async () => {
    const fixture = await buildFakeSourceAuthority();
    const artifacts = buildProfileMaterializationArtifacts(
      fixture.catalog,
      fixture.taxonomy,
      fixture.authority,
    );
    const input = minimalReceiptInput(fixture, artifacts);
    const fatalOutcomes = input.firstSourceOutcomeCounts.map((entry, index) =>
      index === 0
        ? {
            ...entry,
            establishedValue: entry.establishedValue - 1,
            fatal: 1,
          }
        : entry,
    );
    expect(() =>
      buildProfileMaterializationReceipt({
        ...input,
        firstSourceOutcomeCounts: fatalOutcomes,
        runIdDigest: '5'.repeat(64),
      }),
    ).toThrow();
    expect(() =>
      buildProfileMaterializationReceipt({
        ...input,
        controlledFailureCounts: [
          { code: 'provider-temporarily-unavailable', count: 1 },
        ],
        qualification: 'qualified-optional-source-failures',
        runIdDigest: '5'.repeat(64),
      }),
    ).toThrow();
  });

  it('rejects missing persistence bindings and seeded-catalog-only success claims', async () => {
    const fixture = await buildFakeSourceAuthority();
    const artifacts = buildProfileMaterializationArtifacts(
      fixture.catalog,
      fixture.taxonomy,
      fixture.authority,
    );
    const input = minimalReceiptInput(fixture, artifacts);
    const missingProof = { ...input } as Record<string, unknown>;
    delete missingProof['secondPersistenceProofSemanticDigest'];
    expect(() =>
      buildProfileMaterializationReceipt(missingProof as never),
    ).toThrow();
    expect(() =>
      buildProfileMaterializationReceipt({
        ...input,
        secondPersistenceCounts: input.firstPersistenceCounts,
        liveIdempotency: 'passed',
        runIdDigest: '6'.repeat(64),
      }),
    ).toThrow();
  });
});

function pass(
  artifacts: ReturnType<typeof buildProfileMaterializationArtifacts>,
) {
  return {
    profileAuthorityDigest: artifacts.authority.semanticAuthorityDigest,
    profileCoverageDigest: artifacts.coverage.coverageSemanticDigest,
  };
}

function minimalReceiptInput(
  fixture: Awaited<ReturnType<typeof buildFakeSourceAuthority>>,
  artifacts: ReturnType<typeof buildProfileMaterializationArtifacts>,
) {
  const drift = compareProfileMaterializationSources(
    fixture.authority,
    fixture.authority,
  );
  const firstPersistenceProof = buildFakePersistenceProof(
    fixture.authority,
    'first',
  );
  const secondPersistenceProof = buildFakePersistenceProof(
    fixture.authority,
    'second',
  );
  return {
    receiptVersion: 'profile-materialization-receipt/1.0.0' as const,
    operatorVersion: 'profile-materialization-operator/1.0.0' as const,
    providerPolicyVersion:
      'profile-materialization-provider-policy/1.0.0' as const,
    providerPolicyDigest: fixture.policy.policySemanticDigest,
    sourceAuthorityVersion:
      'profile-materialization-source-authority/1.0.0' as const,
    persistenceProofVersion:
      'profile-materialization-persistence-proof/1.0.0' as const,
    firstPersistenceProofSemanticDigest:
      firstPersistenceProof.proofSemanticDigest,
    secondPersistenceProofSemanticDigest:
      secondPersistenceProof.proofSemanticDigest,
    firstPersistenceCounts: persistenceProofCounts(firstPersistenceProof),
    secondPersistenceCounts: persistenceProofCounts(secondPersistenceProof),
    firstSourceAuthoritySemanticDigest:
      fixture.authority.authoritySemanticDigest,
    secondSourceAuthoritySemanticDigest:
      fixture.authority.authoritySemanticDigest,
    finalSourceAuthoritySemanticDigest:
      fixture.authority.authoritySemanticDigest,
    firstSourceRecordCounts: sourceRecordCounts(fixture.authority),
    secondSourceRecordCounts: sourceRecordCounts(fixture.authority),
    firstSourceOutcomeCounts: sourceOutcomeCounts(fixture.authority),
    secondSourceOutcomeCounts: sourceOutcomeCounts(fixture.authority),
    sourceDriftComparisonDigest: drift.comparisonDigest,
    sourceDriftCounts: drift.counts,
    firstPassA: pass(artifacts),
    firstPassB: pass(artifacts),
    secondPassA: pass(artifacts),
    secondPassB: pass(artifacts),
    sameEvidenceReproduction: 'passed' as const,
    liveIdempotency: 'passed' as const,
    qualification: 'complete' as const,
    catalogVersion: 'public-v1' as const,
    catalogDigest: fixture.catalog.manifestDigest,
    taxonomyVersion: '1.0.0' as const,
    taxonomyDigest: fixture.taxonomy.semanticDigest,
    profileSchemaDigest:
      '3bbfdf2050c13a3d70e9dc289db7c8768a6fdcba8605cf12191e08560387af61',
    profileAuthoritySchemaDigest:
      '7a79a1671bf461127099e3ae2f75d29e949387987041bd3402f2614b747ed8cf',
    profileRulesVersion: 'deterministic-candidate-profile-rules/1.0.0' as const,
    projectionVersion: 'profile-materialization-projection/1.0.0' as const,
    migrationInventoryDigest:
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.migrationInventoryDigest,
    migrationCount: 4 as const,
    databaseSchemaDigest:
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.databaseSchemaDigest,
    productTableCount: 25 as const,
    candidateCount: 150 as const,
    aggregateFieldStates: artifacts.coverage.aggregate.final,
    fieldCoverage: artifacts.coverage.perField.map((field) => ({
      fieldId: field.fieldId,
      ...field.final,
    })),
    familyCoverage: artifacts.coverage.perFamily.map((family) => ({
      family: family.family,
      ...family.final,
    })),
    controlledFailureCounts: [],
  };
}
