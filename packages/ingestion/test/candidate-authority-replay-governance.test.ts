import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  CANDIDATE_AUTHORITY_DOSSIER_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_EVIDENCE_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_MAXIMUM_PARTIAL_FACT_RECORDS,
  CANDIDATE_AUTHORITY_MAXIMUM_PARTIAL_FACTS_PER_CANDIDATE,
  CANDIDATE_AUTHORITY_PARTIAL_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_PROFILE_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_READINESS_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_ROOT_MAXIMUM_SERIALIZED_BYTES,
  canonicalReplayAuthorityText,
  candidateAuthorityRootV4SemanticDigest,
  restoreCandidateAuthorityReplayOrder,
  validateCandidateAuthoritySourceCommitProof,
  type CandidateAuthorityReplayGitState,
  type CandidateAuthorityRootV4,
} from '../src/index.ts';

const ROOT = new URL('../../../', import.meta.url);
const SOURCE_PATH =
  'catalog/public-v1/candidate-authority-source-authority-v1.json';
const HEAD = 'a'.repeat(40);
const EXECUTION_HEAD = 'b'.repeat(40);
const SOURCE_TEXT = '{"fixture":"committed"}\n';

describe('candidate-authority replay governance', () => {
  it('requires the exact source bytes in current HEAD and an isolated source-freeze commit', () => {
    const valid = gitState();
    expect(() => {
      validateCandidateAuthoritySourceCommitProof({
        git: valid,
        serializedSourceAuthority: SOURCE_TEXT,
        collectionExecutionHead: EXECUTION_HEAD,
      });
    }).not.toThrow();
    for (const mutation of [
      { sourceTrackedAtHead: false },
      { sourceBytesAtHead: '{"fixture":"working-only"}\n' },
      { sourceBytesAtHead: null },
      { sourceBytesAtFreezeHead: '{"fixture":"later-edit"}\n' },
      { sourceFreezeParentHead: 'c'.repeat(40) },
      { sourceFreezeIsAncestor: false },
      { sourceFreezeHead: null },
      { sourceCommitPaths: [] },
      { sourceCommitPaths: [SOURCE_PATH, 'unexpected.json'] },
      { originHead: 'd'.repeat(40) },
    ] satisfies readonly Partial<CandidateAuthorityReplayGitState>[]) {
      expect(() => {
        validateCandidateAuthoritySourceCommitProof({
          git: { ...valid, ...mutation },
          serializedSourceAuthority: SOURCE_TEXT,
          collectionExecutionHead: EXECUTION_HEAD,
        });
      }).toThrow();
    }
  });

  it('freezes conservative structural record and serialized-size bounds', () => {
    expect(CANDIDATE_AUTHORITY_MAXIMUM_PARTIAL_FACTS_PER_CANDIDATE).toBe(313);
    expect(CANDIDATE_AUTHORITY_MAXIMUM_PARTIAL_FACT_RECORDS).toBe(46_950);
    expect({
      profiles: CANDIDATE_AUTHORITY_PROFILE_MAXIMUM_SERIALIZED_BYTES,
      partial: CANDIDATE_AUTHORITY_PARTIAL_MAXIMUM_SERIALIZED_BYTES,
      evidence: CANDIDATE_AUTHORITY_EVIDENCE_MAXIMUM_SERIALIZED_BYTES,
      dossiers: CANDIDATE_AUTHORITY_DOSSIER_MAXIMUM_SERIALIZED_BYTES,
      dossierProjection:
        CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_MAXIMUM_SERIALIZED_BYTES,
      readiness: CANDIDATE_AUTHORITY_READINESS_MAXIMUM_SERIALIZED_BYTES,
      root: CANDIDATE_AUTHORITY_ROOT_MAXIMUM_SERIALIZED_BYTES,
    }).toEqual({
      profiles: 67_108_864,
      partial: 402_653_184,
      evidence: 536_870_912,
      dossiers: 536_870_912,
      dossierProjection: 67_108_864,
      readiness: 4_194_304,
      root: 4_194_304,
    });
  });

  it('restores frozen candidate order after forward, reverse, or repeated processing and serializes canonically', () => {
    const ordered = ['candidate-a', 'candidate-b'];
    const forward = [
      { candidateId: 'candidate-a', value: 1 },
      { candidateId: 'candidate-b', value: 2 },
    ];
    const restore = (values: typeof forward) =>
      restoreCandidateAuthorityReplayOrder(
        ordered,
        values,
        ({ candidateId }) => candidateId,
      );
    expect(restore(forward)).toEqual(restore([...forward].reverse()));
    expect(restore(forward)).toEqual(restore(structuredClone(forward)));
    expect(canonicalReplayAuthorityText({ z: 1, a: 2 }, 100)).toBe(
      canonicalReplayAuthorityText({ a: 2, z: 1 }, 100),
    );
    expect(() =>
      canonicalReplayAuthorityText({ tooLarge: 'x'.repeat(100) }, 10),
    ).toThrow();
  });

  it('binds every replay authority and readiness report into the root digest', () => {
    const root = rootWithoutDigest();
    const initial = candidateAuthorityRootV4SemanticDigest(root);
    for (const key of Object.keys(
      root.authorityDigests,
    ) as (keyof typeof root.authorityDigests)[]) {
      const mutated = {
        ...root,
        authorityDigests: {
          ...root.authorityDigests,
          [key]: 'f'.repeat(64),
        },
      };
      expect(candidateAuthorityRootV4SemanticDigest(mutated)).not.toBe(initial);
    }
  });

  it('keeps replay and readiness command modules free of credentials, providers, network, database, model, and evaluation authority', async () => {
    const paths = [
      'packages/ingestion/src/candidate-authority-replay.ts',
      'packages/ingestion/src/candidate-authority-replay-runner.ts',
      'packages/ingestion/src/candidate-authority-measurement.ts',
      'packages/ingestion/scripts/candidate-authority-replay-cli.ts',
      'packages/ingestion/scripts/candidate-authority-replay-system-effects.ts',
    ];
    const text = (
      await Promise.all(
        paths.map((path) => readFile(new URL(path, ROOT), 'utf8')),
      )
    ).join('\n');
    for (const prohibited of [
      /evals\/ranking-v1/u,
      /baseline-predictions/u,
      /scorer-output/u,
      /process\.env/u,
      /readCredential/u,
      /candidate-authority-live-system-effects/u,
      /from ['"].*providers\.ts['"]/u,
      /\bfetch\s*\(/u,
      /@gitblocks\/persistence/u,
      /dockerCalls\s*\+=/u,
      /modelCalls\s*\+=/u,
    ]) {
      expect(text).not.toMatch(prohibited);
    }
  });
});

function gitState(): CandidateAuthorityReplayGitState {
  return {
    branch: 'feat/32-codebase-conditioned-ranking',
    head: HEAD,
    originHead: HEAD,
    sourceFreezeHead: HEAD,
    sourceFreezeParentHead: EXECUTION_HEAD,
    sourceFreezeIsAncestor: true,
    clean: true,
    sourceCommitPaths: [SOURCE_PATH],
    workingPaths: [],
    sourceTrackedAtHead: true,
    sourceBytesAtHead: SOURCE_TEXT,
    sourceBytesAtFreezeHead: SOURCE_TEXT,
  };
}

function rootWithoutDigest(): Omit<
  CandidateAuthorityRootV4,
  'canonicalAuthorityDigest'
> {
  const groups = {
    'capability-adoption': ['adoption-unit-type'],
    'stack-package': ['language-ecosystem'],
    'infrastructure-deployment': ['deployment-self-hosting'],
    'policy-risk': ['license-identity'],
  } as const;
  return {
    authorityVersion: 'candidate-authority-root/4.0.0',
    architectureDecisionBinding: { adr: 'ADR-0012' },
    liveAuthorizationBinding: { version: '2.0.0' },
    catalogBinding: { version: 'public-v1', digest: '1'.repeat(64) },
    taxonomyBinding: { version: '1.0.0', digest: '2'.repeat(64) },
    deterministicProfileBinding: {
      version: '1.0.0',
      digest: '3'.repeat(64),
    },
    rankingDecisionBinding: {
      denominatorVersion: 'ranking-decision-denominator/1.0.0',
      denominatorSize: '18',
    },
    readinessPolicyBinding: { version: '3.0.0', digest: '4'.repeat(64) },
    fieldPlanBinding: { version: '4.0.0', digest: '5'.repeat(64) },
    sourcePolicyBinding: { version: '4.0.0', digest: '6'.repeat(64) },
    partialSemanticRegistryBinding: {
      version: '2.0.0',
      digest: '7'.repeat(64),
    },
    partialEvidenceContractBinding: {
      version: '3.0.0',
      digest: '8'.repeat(64),
    },
    collection: {
      cutoff: '2026-08-01T00:00:00.000Z',
      candidateCount: 150,
      orderedCandidateIds: ['fixture'],
      orderedCandidateIdentitiesDigest: '9'.repeat(64),
    },
    authorityDigests: {
      source: 'a'.repeat(64),
      deterministicProfiles: 'b'.repeat(64),
      partialFieldEvidence: 'c'.repeat(64),
      evidence: 'd'.repeat(64),
      dossiers: 'e'.repeat(64),
      dossierProjection: '1'.repeat(64),
      coverageReadinessReport: '2'.repeat(64),
    },
    fieldReadinessCounts: {
      plannedDeterministicExtractionCapable: 13,
      realizedDeterministicReady: 13,
      deterministicFullClosure: 6,
    },
    plannedBreadthGroups: groups,
    realizedBreadthGroups: groups,
    cellOriginCounts: {
      'deterministic-known': 1,
      'deterministic-not-applicable': 0,
      'deterministic-partial-direct-evidence': 1,
      'human-reviewed-structured': 0,
      'model-derived': 0,
      unknown: 0,
      conflict: 0,
    },
    readinessDecision: 'go',
  };
}
